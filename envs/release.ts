import { spawn, execSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyDeploy, applyRollback, checkGate, EMPTY_STATE, isValidVersion, type EnvState, type Gate } from "./state.js";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEPLOY = process.env.DEPLOY_DIR ? resolve(process.env.DEPLOY_DIR) : join(ROOT, ".deploy");
export const REPORTS = join(ROOT, "reports");

interface EnvConfig { port: number; requiresGateFrom: string | null }
export const ENVIRONMENTS: Record<string, EnvConfig> = JSON.parse(readFileSync(join(ROOT, "envs", "environments.json"), "utf8"));

function envConfig(env: string): EnvConfig {
  const cfg = ENVIRONMENTS[env];
  if (!cfg) throw new Error(`Unknown environment ${env} (known: ${Object.keys(ENVIRONMENTS).join(", ")})`);
  return cfg;
}

const envDir = (env: string) => join(DEPLOY, "envs", env);
const releaseDir = (version: string) => join(DEPLOY, "releases", version);

function log(event: Record<string, unknown>): void {
  mkdirSync(DEPLOY, { recursive: true });
  const line = { at: new Date().toISOString(), ...event };
  appendFileSync(join(DEPLOY, "history.jsonl"), JSON.stringify(line) + "\n");
  console.log(`[release] ${JSON.stringify(line)}`);
}

export function readState(env: string): EnvState & { pid?: number } {
  const f = join(envDir(env), "state.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { ...EMPTY_STATE };
}

function writeState(env: string, state: EnvState & { pid?: number }): void {
  mkdirSync(envDir(env), { recursive: true });
  writeFileSync(join(envDir(env), "state.json"), JSON.stringify(state, null, 2));
}

function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "uncommitted";
  }
}

/** Package the compiled app (dist/) as an immutable, versioned release. */
export function createRelease(version: string): string {
  if (!isValidVersion(version)) throw new Error(`Invalid version: ${version}`);
  const dist = join(ROOT, "dist", "main.js");
  if (!existsSync(dist)) throw new Error("dist/main.js missing, run npm run build first");
  const dir = releaseDir(version);
  if (existsSync(dir)) throw new Error(`Release ${version} already exists (releases are immutable)`);
  mkdirSync(dir, { recursive: true });
  cpSync(join(ROOT, "dist"), join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "lernwerk-release", version, type: "module" }, null, 2));
  const files = readdirSync(join(dir, "dist")).length;
  writeFileSync(join(dir, "RELEASE.json"), JSON.stringify({ version, commit: gitCommit(), builtAt: new Date().toISOString(), files }, null, 2));
  log({ action: "release", version, commit: gitCommit() });
  return dir;
}

export function listReleases(): string[] {
  const d = join(DEPLOY, "releases");
  return existsSync(d) ? readdirSync(d).sort() : [];
}

export async function health(port: number): Promise<{ status: string; version: string; env: string } | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
    return r.ok ? ((await r.json()) as { status: string; version: string; env: string }) : null;
  } catch {
    return null;
  }
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

export async function stop(env: string): Promise<void> {
  const state = readState(env);
  const { port } = envConfig(env);
  if (state.pid) {
    try {
      process.kill(state.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
    delete state.pid;
    writeState(env, state);
  }
  await waitFor(async () => (await health(port)) === null, 5000);
}

async function start(env: string, version: string): Promise<number> {
  const { port } = envConfig(env);
  const dir = releaseDir(version);
  if (!existsSync(dir)) throw new Error(`Release ${version} does not exist`);
  mkdirSync(envDir(env), { recursive: true });
  const out = openSync(join(envDir(env), "app.log"), "a");
  const child = spawn(process.execPath, [join(dir, "dist", "main.js")], {
    cwd: dir,
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, PORT: String(port), APP_ENV: env, APP_VERSION: version, DATA_DIR: join(envDir(env), "data") },
  });
  child.unref();
  const ok = await waitFor(async () => (await health(port))?.version === version, 10000);
  if (!ok) throw new Error(`${env} did not become healthy on port ${port} with version ${version}`);
  return child.pid!;
}

export async function deploy(env: string, version: string): Promise<{ ms: number }> {
  const t0 = Date.now();
  envConfig(env);
  const state = readState(env);
  const next = applyDeploy(state, version);
  await stop(env);
  const pid = await start(env, version);
  writeState(env, { ...next, pid });
  const ms = Date.now() - t0;
  log({ action: "deploy", env, version, previous: state.current, ms });
  return { ms };
}

export function readGate(env: string): Gate | null {
  const f = join(REPORTS, `gate-${env}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Gate) : null;
}

export async function promote(target = "production"): Promise<{ version: string; ms: number }> {
  const source = envConfig(target).requiresGateFrom;
  if (!source) throw new Error(`${target} has no source environment to promote from`);
  const version = readState(source).current;
  const gate = checkGate(readGate(source), version);
  if (!gate.ok) {
    log({ action: "promote-blocked", from: source, to: target, version, reason: gate.reason });
    throw new Error(`Promotion blocked: ${gate.reason}`);
  }
  const { ms } = await deploy(target, version!);
  log({ action: "promote", from: source, to: target, version, gate: gate.reason });
  return { version: version!, ms };
}

export async function rollback(env: string): Promise<{ version: string; ms: number }> {
  const t0 = Date.now();
  const state = readState(env);
  const { state: next, target } = applyRollback(state);
  await stop(env);
  const pid = await start(env, target);
  writeState(env, { ...next, pid });
  const ms = Date.now() - t0;
  log({ action: "rollback", env, from: state.current, to: target, ms });
  return { version: target, ms };
}

export function backup(env: string): string {
  const data = join(envDir(env), "data");
  if (!existsSync(data)) throw new Error(`${env} has no data directory yet`);
  const name = `${env}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  cpSync(data, join(DEPLOY, "backups", name), { recursive: true });
  log({ action: "backup", env, name });
  return name;
}

export async function restore(env: string, name: string): Promise<void> {
  const src = join(DEPLOY, "backups", name);
  if (!existsSync(src)) throw new Error(`Backup ${name} not found`);
  const state = readState(env);
  if (!state.current) throw new Error(`${env} has no deployed version`);
  await stop(env);
  rmSync(join(envDir(env), "data"), { recursive: true, force: true });
  cpSync(src, join(envDir(env), "data"), { recursive: true });
  const pid = await start(env, state.current);
  writeState(env, { ...state, pid });
  log({ action: "restore", env, name });
}

export async function status(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [env, cfg] of Object.entries(ENVIRONMENTS)) {
    const s = readState(env);
    out[env] = { port: cfg.port, current: s.current, history: s.history, live: await health(cfg.port) };
  }
  return out;
}

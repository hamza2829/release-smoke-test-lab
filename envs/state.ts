/** Pure release state transitions, kept free of I/O so they are easy to unit test. */
export interface EnvState {
  current: string | null;
  /** previously active versions, most recent last */
  history: string[];
}

export const EMPTY_STATE: EnvState = { current: null, history: [] };

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function isValidVersion(v: string): boolean {
  return SEMVER.test(v);
}

export function compareVersions(a: string, b: string): number {
  const ma = a.match(SEMVER);
  const mb = b.match(SEMVER);
  if (!ma || !mb) throw new Error(`Invalid version: ${!ma ? a : b}`);
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d !== 0) return d;
  }
  if (ma[4] && !mb[4]) return -1;
  if (!ma[4] && mb[4]) return 1;
  return (ma[4] ?? "").localeCompare(mb[4] ?? "");
}

export function applyDeploy(state: EnvState, version: string): EnvState {
  if (!isValidVersion(version)) throw new Error(`Invalid version: ${version}`);
  if (state.current === version) return state; // redeploy of same version keeps history
  const history = state.current ? [...state.history, state.current] : [...state.history];
  return { current: version, history: history.slice(-10) };
}

export function applyRollback(state: EnvState): { state: EnvState; target: string } {
  if (state.history.length === 0) throw new Error("Nothing to roll back to");
  const target = state.history[state.history.length - 1];
  return { state: { current: target, history: state.history.slice(0, -1) }, target };
}

export interface Gate {
  env: string;
  version: string;
  passed: number;
  failed: number;
  skipped: number;
}

/** A version may be promoted only if the source environment ran it and every smoke test passed. */
export function checkGate(gate: Gate | null, sourceVersion: string | null): { ok: boolean; reason: string } {
  if (!sourceVersion) return { ok: false, reason: "source environment has no deployed version" };
  if (!gate) return { ok: false, reason: "no smoke test gate report for source environment" };
  if (gate.version !== sourceVersion) return { ok: false, reason: `gate report is for ${gate.version}, source runs ${sourceVersion}` };
  if (gate.passed === 0) return { ok: false, reason: "gate report contains no passed tests" };
  if (gate.failed > 0) return { ok: false, reason: `${gate.failed} smoke test(s) failed` };
  return { ok: true, reason: `${gate.passed} smoke tests passed on ${gate.env} ${gate.version}` };
}

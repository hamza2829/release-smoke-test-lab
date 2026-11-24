import { readFileSync } from "node:fs";
import { join } from "node:path";
import { backup, createRelease, deploy, ENVIRONMENTS, promote, restore, ROOT, rollback, status, stop } from "./release.js";

const pkgVersion = (): string => JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

async function main(argv: string[]): Promise<void> {
  const [cmd, a, b] = argv;
  switch (cmd) {
    case "release":
      console.log(createRelease(a ?? pkgVersion()));
      break;
    case "deploy": {
      if (!a) throw new Error("usage: deploy <env> [version]");
      const r = await deploy(a, b ?? pkgVersion());
      console.log(`deployed ${b ?? pkgVersion()} to ${a} in ${r.ms} ms`);
      break;
    }
    case "promote": {
      const r = await promote(a ?? "production");
      console.log(`promoted ${r.version} to ${a ?? "production"} in ${r.ms} ms`);
      break;
    }
    case "rollback": {
      if (!a) throw new Error("usage: rollback <env>");
      const r = await rollback(a);
      console.log(`rolled ${a} back to ${r.version} in ${r.ms} ms`);
      break;
    }
    case "backup":
      console.log(backup(a ?? "production"));
      break;
    case "restore":
      if (!a || !b) throw new Error("usage: restore <env> <backup-name>");
      await restore(a, b);
      break;
    case "status":
      console.log(JSON.stringify(await status(), null, 2));
      break;
    case "stop":
      for (const env of a && a !== "all" ? [a] : Object.keys(ENVIRONMENTS)) await stop(env);
      break;
    default:
      throw new Error("commands: release [v] | deploy <env> [v] | promote [env] | rollback <env> | backup <env> | restore <env> <name> | status | stop [env|all]");
  }
}

main(process.argv.slice(2)).catch((e: Error) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});

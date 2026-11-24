import { join } from "node:path";
import { Auth } from "./auth.js";
import { Faults } from "./faults.js";
import { createApp } from "./server.js";
import { ContentStore } from "./store.js";

const port = Number(process.env.PORT ?? 4100);
const env = process.env.APP_ENV ?? "local";
const version = process.env.APP_VERSION ?? "0.0.0-dev";
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), ".data", env);
const faults = Faults.fromEnv(process.env.FAULTS);

const store = new ContentStore(join(dataDir, "content.json"), faults);
const server = createApp({ store, auth: new Auth(undefined, faults), faults, env, version });
server.listen(port, "127.0.0.1", () => {
  console.log(`LernWerk ${version} (${env}) listening on http://127.0.0.1:${port} data=${dataDir} faults=${faults.list().join(",") || "none"}`);
});
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

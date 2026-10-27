import "dotenv/config";
import { pool } from "./db.js";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";
const app = createApp(pool, readConfig());
const port = Number(process.env.PORT ?? 4001);
const server = app.listen(port, "127.0.0.1", () => console.log(`API running at http://127.0.0.1:${port}`));
function shutdown() { server.close(() => { void pool.end().catch(() => { process.exitCode = 1; }); }); }
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

import { pool } from "./db.js";
import { readConfig } from "./config.js";
import { migrate } from "./migrations.js";
try { await migrate(pool, readConfig()); console.log("Account and workout database migrations are up to date."); }
finally { await pool.end(); }

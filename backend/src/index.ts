// Cloud entry point. The separate server.ts keeps local development on loopback.
import { createApp } from "./app.js";
import { pool } from "./db.js";
import { readConfig } from "./config.js";

export default createApp(pool, readConfig());

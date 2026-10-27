import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { createAuthFactory } from "./auth.js";
import type { AppConfig } from "./config.js";
import { exercises } from "./exercises.js";

export async function migrate(pool: Pool, config: AppConfig) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(159161514)");
    const auth = createAuthFactory(pool, config, false).forOrigin(config.origins[0]);
    await (await getMigrations(auth.options)).runMigrations();
    await client.query("BEGIN");
    await client.query("CREATE TABLE IF NOT EXISTS app_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const name = "001_workouts.sql";
    const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM app_migrations WHERE name=$1", [name]);
    if (existing.rows[0] && existing.rows[0].checksum !== checksum) throw new Error("An applied migration was changed. Add a new migration instead.");
    if (!existing.rowCount) {
      await client.query(sql);
      await client.query("INSERT INTO app_migrations(name,checksum) VALUES($1,$2)", [name, checksum]);
    }
    for (const exercise of exercises) await client.query("INSERT INTO exercises(id,name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET name=excluded.name", [exercise.id, exercise.name]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { await client.query("SELECT pg_advisory_unlock(159161514)"); client.release(); }
}

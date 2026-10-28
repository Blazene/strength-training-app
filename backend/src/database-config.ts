import type { PoolConfig } from "pg";

export function databaseConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const production = env.NODE_ENV === "production";
  let connectionString = env.DATABASE_URL;
  if (production && !connectionString) throw new Error("DATABASE_URL is required in production.");
  if (connectionString) {
    let url: URL;
    try { url = new URL(connectionString); } catch { throw new Error("DATABASE_URL must be a valid PostgreSQL URL."); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1) || url.hash) throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (production && local) throw new Error("Production requires a hosted PostgreSQL database.");
    // Connection URL overrides can silently disable certificate checks or load
    // local certificate files. Hosted connections use verified TLS explicitly.
    if (!local) {
      if ([...url.searchParams.keys()].some(key => !["sslmode", "channel_binding"].includes(key))) throw new Error("Hosted DATABASE_URL supports only sslmode and channel_binding options.");
      if (["disable", "allow", "prefer", "no-verify"].includes(url.searchParams.get("sslmode") ?? "")) throw new Error("Hosted PostgreSQL requires verified TLS.");
      url.searchParams.set("sslmode", "verify-full");
    }
    connectionString = url.toString();
  }
  return { ...(connectionString ? { connectionString } : {}), max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, allowExitOnIdle: true };
}

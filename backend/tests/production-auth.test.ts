import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { once } from "node:events";
import pg from "pg";
import { createApp } from "../src/app.js";
import { migrate } from "../src/migrations.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
test("production login limits persist across API instances and reject spoofed client identity", { skip: !databaseUrl }, async () => {
  if (!/(_test|_integration)$/.test(new URL(databaseUrl!).pathname)) throw new Error("Use a dedicated test database.");
  const schema = `production_auth_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: databaseUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 5 });
  const config = { secret: "isolated_production_auth_test_secret_123456789012", origins: ["https://gym.example"], production: true, vercel: true };
  const servers: ReturnType<ReturnType<typeof createApp>["listen"]>[] = [];
  try {
    await migrate(pool, config);
    await migrate(pool, config);
    for (let index = 0; index < 2; index++) {
      const server = createApp(pool, config).listen(0, "127.0.0.1");
      await once(server, "listening");
      servers.push(server);
    }
    const call = (index: number, path: string, body: unknown, extra: Record<string, string> = {}) => new Promise<{ status: number; cookies: string[] }>((resolve, reject) => {
      const address = servers[index].address();
      assert(address && typeof address !== "string");
      const data = JSON.stringify(body);
      const outgoing = request({ hostname: "127.0.0.1", port: address.port, path, method: "POST", headers: {
        host: "gym.example", origin: "https://gym.example", "x-forwarded-proto": "https", "x-vercel-forwarded-for": "203.0.113.10",
        "content-type": "application/json", "content-length": String(Buffer.byteLength(data)), ...extra
      } }, response => { response.resume(); response.on("end", () => resolve({ status: response.statusCode!, cookies: response.headers["set-cookie"] ?? [] })); });
      outgoing.on("error", reject); outgoing.end(data);
    });
    const email = `rate-${randomUUID()}@example.test`;
    const signup = await call(0, "/api/auth/sign-up/email", { name: "Production check", email, password: "TestPassword123!" });
    assert.equal(signup.status, 200);
    assert.match(signup.cookies.join(";"), /; Secure/i);
    assert.match(signup.cookies.join(";"), /HttpOnly/i);
    for (let index = 0; index < 10; index++) assert.equal((await call(index % 2, "/api/auth/sign-in/email", { email, password: "wrong password" }, { "x-strength-client-ip": `198.51.100.${index + 1}` })).status, 401);
    assert.equal((await call(1, "/api/auth/sign-in/email", { email, password: "TestPassword123!" }, { "x-forwarded-for": "198.51.100.99", "x-strength-client-ip": "198.51.100.99" })).status, 429);
    assert.equal((await call(1, "/api/auth/sign-in/email", { email, password: "TestPassword123!" }, { "x-vercel-forwarded-for": "203.0.113.11" })).status, 200);
    assert((await pool.query('SELECT count(*)::int AS count FROM "rateLimit"')).rows[0].count > 0);
  } finally {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

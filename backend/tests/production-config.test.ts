import test from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.js";
import { databaseConfig } from "../src/database-config.js";
const secret = "isolated_production_config_test_secret_1234567890";

test("production account origins fail closed and accept only configured HTTPS hosts", () => {
  for (const APP_ORIGINS of [undefined, "", "http://localhost:5173", "http://gym.example", "https://phone.local", "https://gym.example/path", "https://gym.example?x=1", "https://user:pass@gym.example"]) {
    assert.throws(() => readConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret, APP_ORIGINS }));
  }
  const config = readConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret, APP_ORIGINS: "https://gym.example,https://gym.example" });
  assert.deepEqual(config.origins, ["https://gym.example"]);
  assert.equal(config.production, true);
});
test("only the platform's exact deployment URL is added to trusted origins", () => {
  const env = { NODE_ENV: "production", BETTER_AUTH_SECRET: secret, APP_ORIGINS: "https://gym.example", VERCEL_URL: "gym-build-123.vercel.app" };
  assert.deepEqual(readConfig(env).origins, ["https://gym.example"]);
  assert.deepEqual(readConfig({ ...env, VERCEL: "1" }).origins, ["https://gym.example", "https://gym-build-123.vercel.app"]);
  assert.throws(() => readConfig({ ...env, VERCEL: "1", VERCEL_URL: "evil.example/path" }));
});
test("hosted database URLs take precedence over local settings and verify TLS", () => {
  const config = databaseConfig({ NODE_ENV: "production", DATABASE_URL: "postgresql://test:password@database.example/strength?sslmode=require&channel_binding=require", PGHOST: "localhost" });
  assert.match(config.connectionString!, /sslmode=verify-full/);
  assert.match(config.connectionString!, /database.example/);
  assert.equal(config.max, 5);
  assert.equal(databaseConfig({ PGHOST: "localhost" }).connectionString, undefined);
  for (const DATABASE_URL of [undefined, "bad secret", "postgresql://test:password@localhost/strength", "postgresql://test:password@database.example/strength?sslmode=disable", "postgresql://test:password@database.example/strength?sslmode=no-verify", "postgresql://test:password@database.example/strength?host=localhost", "postgresql://test:password@database.example/strength?sslrootcert=/secret"]) {
    assert.throws(() => databaseConfig({ NODE_ENV: "production", DATABASE_URL }));
  }
});

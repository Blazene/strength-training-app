import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { hostname, networkInterfaces } from "node:os";
import { parse } from "dotenv";
let source: string;
try { source = await readFile(".env", "utf8"); }
catch { source = await readFile(".env.example", "utf8"); }
const values = parse(source);
if (!values.BETTER_AUTH_SECRET || values.BETTER_AUTH_SECRET === "generate_with_npm_run_setup") {
  source = source.replace(/^BETTER_AUTH_SECRET=.*\n?/m, "");
  source += `\nBETTER_AUTH_SECRET=${randomBytes(48).toString("base64url")}\n`;
}
if (!values.APP_ORIGINS || values.APP_ORIGINS === "configure_with_npm_run_setup") {
  let name: string;
  try { name = execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim(); }
  catch { name = hostname().replace(/\.local$/, ""); }
  const ips = Object.values(networkInterfaces()).flatMap((entries) => (entries ?? []).filter((entry) => entry.family === "IPv4" && !entry.internal
    && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)).map((entry) => entry.address));
  const origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4001", "http://127.0.0.1:4001", `https://${name.toLowerCase()}.local:5443`, ...ips.map((ip) => `https://${ip}:5443`)];
  source = source.replace(/^APP_ORIGINS=.*\n?/m, "");
  source += `APP_ORIGINS=${[...new Set(origins)].join(",")}\n`;
}
await writeFile(".env", source, { mode: 0o600 });
await chmod(".env", 0o600);
console.log("Local authentication settings are ready in the ignored backend/.env. Existing database settings were preserved.");

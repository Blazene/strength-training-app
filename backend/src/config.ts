import "dotenv/config";

export type AppConfig = { secret: string; origins: string[] };
export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Run npm run setup to create a private authentication secret.");
  const origins = [...new Set((env.APP_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4001,http://127.0.0.1:4001").split(",").map((value) => {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("APP_ORIGINS must contain exact HTTP(S) origins.");
    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Remote account origins must use HTTPS.");
    return url.origin;
  }))];
  return { secret, origins };
}

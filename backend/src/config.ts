import "dotenv/config";

export type AppConfig = { secret: string; origins: string[]; production?: boolean; vercel?: boolean };
export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === "production";
  const vercel = env.VERCEL === "1";
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret === "generate_with_npm_run_setup") throw new Error("Configure a private authentication secret of at least 32 characters.");
  if (production && !env.APP_ORIGINS?.trim()) throw new Error("APP_ORIGINS is required in production.");
  const origins = [...new Set((env.APP_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4001,http://127.0.0.1:4001").split(",").map((value) => {
    let url: URL;
    try { url = new URL(value.trim()); } catch { throw new Error("APP_ORIGINS must contain exact HTTP(S) origins."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("APP_ORIGINS must contain exact HTTP(S) origins.");
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.hostname.endsWith(".local");
    if (production && (url.protocol !== "https:" || local)) throw new Error("Production account origins must be public HTTPS origins.");
    if (url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Remote account origins must use HTTPS.");
    return url.origin;
  }))];
  // Vercel supplies this exact build URL. Never trust an arbitrary *.vercel.app
  // Origin or a request-supplied forwarded hostname.
  if (vercel && env.VERCEL_URL) {
    if (!/^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL)) throw new Error("Invalid Vercel deployment hostname.");
    origins.push(`https://${env.VERCEL_URL}`);
  }
  return { secret, origins: [...new Set(origins)], production, vercel };
}

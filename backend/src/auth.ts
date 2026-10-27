import { betterAuth } from "better-auth";
import type { Pool } from "pg";
import type { AppConfig } from "./config.js";

function buildAuth(pool: Pool, config: AppConfig, origin: string, validateSchema: boolean) {
  return betterAuth({
        appName: "Strength Training",
        secret: config.secret,
        database: pool,
        baseURL: origin,
        trustedOrigins: [origin],
        emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
        session: { expiresIn: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
        advanced: {
          database: { validateSchema },
          ipAddress: { ipAddressHeaders: ["x-strength-client-ip"] },
          cookiePrefix: "strength",
          useSecureCookies: origin.startsWith("https://"),
          defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/api" }
        },
        rateLimit: { enabled: true, window: 60, max: 100, customRules: {
          "/sign-in/email": { window: 60, max: 10 },
          "/sign-up/email": { window: 60, max: 5 }
        } }
  });
}
export function createAuthFactory(pool: Pool, config: AppConfig, validateSchema = true) {
  const instances = new Map<string, ReturnType<typeof buildAuth>>();
  return {
    forOrigin(origin: string) {
      if (!config.origins.includes(origin)) throw new Error("Untrusted application origin.");
      const existing = instances.get(origin);
      if (existing) return existing;
      const auth = buildAuth(pool, config, origin, validateSchema);
      instances.set(origin, auth);
      return auth;
    }
  };
}

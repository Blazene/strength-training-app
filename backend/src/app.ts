import express from "express";
import { isIP } from "node:net";
import type { ErrorRequestHandler, Request, Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { Pool } from "pg";
import { createAuthFactory } from "./auth.js";
import type { AppConfig } from "./config.js";
import { applySyncOperation, downloadWorkouts, parseSyncOperation, SyncConflict } from "./sync.js";
import { exercises } from "./exercises.js";
import { InputError, pagination, parseWorkout, validId } from "./validation.js";
import { deleteDirectWorkout, getWorkout, listWorkouts, putWorkout, WorkoutConflict } from "./workouts.js";

export function publicOrigin(req: Request, config: AppConfig) {
  const protocol = req.get("x-forwarded-proto") ?? "http";
  if (protocol !== "http" && protocol !== "https") throw new InputError("Invalid request protocol.");
  const host = req.get("host");
  if (!host || /[\s/@?#]/.test(host)) throw new InputError("Invalid request host.");
  const origin = new URL(`${protocol}://${host}`).origin;
  if (!config.origins.includes(origin)) throw new InputError("Untrusted request host.");
  return origin;
}
export function createApp(pool: Pool, config: AppConfig) {
  const app = express();
  app.disable("x-powered-by");
  const auths = createAuthFactory(pool, config);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    // Only the Vercel runtime may supply this platform-overwritten address.
    // Local clients cannot spoof rate-limit identity through forwarded headers.
    const platformIp = config.vercel ? req.get("x-vercel-forwarded-for")?.split(",")[0].trim() : undefined;
    req.headers["x-strength-client-ip"] = platformIp && isIP(platformIp) ? platformIp : req.socket.remoteAddress ?? "127.0.0.1";
    try {
      const origin = publicOrigin(req, config);
      if ((req.get("origin") && req.get("origin") !== origin) || (!["GET", "HEAD"].includes(req.method) && req.get("origin") !== origin)) {
        res.status(403).json({ error: "Request origin is not allowed." }); return;
      }
      next();
    } catch { res.status(403).json({ error: "Request host is not allowed." }); }
  });
  app.all("/api/auth/*splat", (req, res) => toNodeHandler(auths.forOrigin(publicOrigin(req, config)))(req, res));
  app.use(express.json({ limit: "256kb" }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", message: "Strength training API is running" }));
  app.get("/api/health/db", async (_req, res) => {
    try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "connected" }); }
    catch { res.status(503).json({ status: "error", database: "unavailable" }); }
  });
  app.use(["/api/me", "/api/workouts", "/api/exercises", "/api/sync"], async (req, res, next) => {
    try {
      const session = await auths.forOrigin(publicOrigin(req, config)).api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) { res.status(401).json({ error: "Sign in to access your server account." }); return; }
      res.locals.user = { id: session.user.id, name: session.user.name, email: session.user.email };
      next();
    } catch (error) { next(error); }
  });
  const owner = (res: Response): string => res.locals.user.id as string;
  app.get("/api/me", (_req, res) => res.json({ user: res.locals.user }));
  app.get("/api/sync/workouts", async (req, res) => {
    if (req.query.accountId !== owner(res)) { res.status(403).json({ error: "Sign in to the account linked to these workouts." }); return; }
    const cursor = req.query.cursor;
    if (cursor !== undefined && !validId(cursor)) { res.status(400).json({ error: "Download cursor must be a UUID." }); return; }
    const { limit } = pagination({ limit: req.query.limit ?? "20" });
    res.json(await downloadWorkouts(pool, owner(res), cursor as string ?? null, Math.min(limit,50)));
  });
  app.post("/api/sync", async (req, res) => {
    const operation = parseSyncOperation(req.body);
    // Assert the expected account; only the verified session chooses the owner.
    if (operation.accountId !== owner(res)) { res.status(403).json({ error: "Sign in to the account linked to these saved workouts." }); return; }
    res.json(await applySyncOperation(pool, owner(res), operation, req.get("x-strength-sync-protocol")==="2"));
  });
  app.get("/api/exercises", (_req, res) => res.json({ exercises }));
  app.get("/api/workouts", async (req, res) => {
    const { limit, offset } = pagination(req.query);
    res.json(await listWorkouts(pool, owner(res), limit, offset));
  });
  app.get("/api/workouts/:id", async (req, res) => {
    if (!validId(req.params.id)) { res.status(400).json({ error: "Workout ID must be a UUID." }); return; }
    const workout = await getWorkout(pool, owner(res), req.params.id);
    if (!workout) { res.status(404).json({ error: "Workout not found." }); return; }
    res.json({ workout });
  });
  app.put("/api/workouts/:id", async (req, res) => {
    const workout = parseWorkout(req.body, req.params.id as string);
    res.json({ workout: await putWorkout(pool, owner(res), workout) });
  });
  app.delete("/api/workouts/:id", async (req, res) => {
    if (!validId(req.params.id)) { res.status(400).json({ error: "Workout ID must be a UUID." }); return; }
    if (!await deleteDirectWorkout(pool, owner(res), req.params.id)) { res.status(404).json({ error: "Workout not found." }); return; }
    res.status(204).end();
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint not found." }));
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof SyncConflict || error instanceof WorkoutConflict) { res.status(409).json({ error: error.message }); return; }
    if (error instanceof InputError) { res.status(400).json({ error: error.message }); return; }
    if (error.type === "entity.too.large") { res.status(413).json({ error: "Request is too large." }); return; }
    if (error instanceof SyntaxError && "body" in error) { res.status(400).json({ error: "Invalid JSON." }); return; }
    if (error.code === "23505" || error.code === "23503") { res.status(409).json({ error: "Workout item IDs conflict with existing data." }); return; }
    console.error("API request failed:", error instanceof Error ? error.message : "Unknown error");
    res.status(503).json({ error: "Account service is temporarily unavailable. Your local workouts are unchanged." });
  };
  app.use(handleError);
  return app;
}

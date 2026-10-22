import "dotenv/config";
import express from "express";
import { pool } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 4001);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Strength training API is running"
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    res.status(503).json({
      status: "error",
      database: "unavailable"
    });
  }
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`API running at http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    pool.end().catch((error: unknown) => {
      console.error("Failed to close database connections:", error);
      process.exitCode = 1;
    });
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

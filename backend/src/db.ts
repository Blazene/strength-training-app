import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

pool.on("error", (error) => {
  console.error("Unexpected database connection error:", error.message);
});

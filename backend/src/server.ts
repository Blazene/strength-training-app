import express from "express";

const app = express();
const port = 4001;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Strength training API is running"
  });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`API running at http://127.0.0.1:${port}`);
});

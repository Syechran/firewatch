import express from "express";
import { firesRouter } from "./routes/fires.js";
import { getSchedulerState } from "./scheduler.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", async (req, res) => {
    res.json({
      ok: true,
      service: "firewatch",
      scheduler: getSchedulerState(),
      time: new Date().toISOString(),
    });
  });

  app.use("/api", firesRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "Not found", path: req.originalUrl });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("[api]", err);
    res.status(500).json({ error: err.message || "Internal error" });
  });

  return app;
}

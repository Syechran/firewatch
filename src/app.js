import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { firesRouter } from "./routes/fires.js";
import { weatherRouter } from "./routes/weather.js";
import { getSchedulerState } from "./scheduler.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Folder aset frontend. Di Vercel, file di public/ disajikan CDN (express.static
// diabaikan); di lokal kita sajikan sendiri dari public/. Urutan resolusi:
// FRONTEND_ROOT → folder proyek lokal → cwd.
function resolveFrontendRoot() {
  if (process.env.FRONTEND_ROOT) {
    return path.resolve(process.env.FRONTEND_ROOT);
  }
  const localRoot = path.resolve(here, "..");
  if (fs.existsSync(path.join(localRoot, "public", "index.html"))) {
    return localRoot;
  }
  return process.cwd();
}

const frontendRoot = resolveFrontendRoot();
const publicDir = path.join(frontendRoot, "public");

export function createApp() {
  const app = express();
  app.use(express.json());

  // Permissive CORS so the frontend can also be developed on a separate
  // static server (e.g. http://localhost:8080).
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/health", async (req, res) => {
    res.json({
      ok: true,
      service: "firewatch",
      scheduler: getSchedulerState(),
      time: new Date().toISOString(),
    });
  });

  app.use("/api/weather", weatherRouter);
  app.use("/api", firesRouter);

  // Serve the static frontend (same origin as the API).
  app.use(express.static(publicDir));
  app.get(["/", "/indonesia-map.html"], (req, res) =>
    res.sendFile(path.join(publicDir, "index.html"))
  );

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

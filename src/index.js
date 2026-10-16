import { createApp } from "./app.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { startScheduler } from "./scheduler.js";
import { startNewsScheduler } from "./news/newsJob.js";

// Di Vercel (serverless) scheduler & migrasi tidak dijalankan otomatis:
// function bersifat sementara, dan migrasi dijalankan manual sekali.
const isServerless = Boolean(process.env.VERCEL);

if (!isServerless) {
  await migrate();
}

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(
    `firewatch API listening on http://${config.host}:${config.port}`
  );
});

const schedulerTask = isServerless ? null : startScheduler();
const newsTask = isServerless ? null : startNewsScheduler();

async function shutdown(signal) {
  console.log(`\n[shutdown] ${signal}`);
  if (schedulerTask) schedulerTask.stop();
  if (newsTask) newsTask.stop();
  server.close(() => process.exit(0));
  // Force-exit if connections hang
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

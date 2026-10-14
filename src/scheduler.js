import cron from "node-cron";
import { config } from "./config.js";
import { ingestRecent } from "./ingest/ingestJob.js";

let running = false;
let lastResult = null;
let lastError = null;

export function getSchedulerState() {
  return {
    enabled: !config.ingest.disableScheduler,
    cron: config.ingest.cron,
    running,
    lastResult,
    lastError,
  };
}

export async function runIngestCycle() {
  if (running) {
    return { skipped: true, reason: "ingest already running" };
  }
  running = true;
  try {
    lastResult = await ingestRecent();
    lastError = null;
    return lastResult;
  } catch (err) {
    lastError = err.message;
    lastResult = {
      status: "error",
      error: err.message,
      finishedAt: new Date(),
    };
    return lastResult;
  } finally {
    running = false;
  }
}

/**
 * Start the 10-minute poll. Default cron is offset a couple of minutes
 * after each Himawari slot so P-Tree has time to publish.
 */
export function startScheduler(log = console) {
  if (config.ingest.disableScheduler) {
    log.warn("[scheduler] disabled via DISABLE_SCHEDULER=1");
    return null;
  }

  if (!cron.validate(config.ingest.cron)) {
    throw new Error(`Invalid INGEST_CRON expression: ${config.ingest.cron}`);
  }

  const task = cron.schedule(config.ingest.cron, () => {
    runIngestCycle()
      .then((r) => {
        if (r?.skipped) {
          log.warn(`[ingest] skipped: ${r.reason}`);
          return;
        }
        log.info(
          `[ingest] status=${r.status} filesNew=${r.filesNew} points=${r.pointsInBbox}` +
            (r.errors?.length ? ` errors=${r.errors.length}` : "")
        );
      })
      .catch((err) => {
        log.error("[ingest] unexpected failure:", err);
      });
  });

  log.info(`[scheduler] cron '${config.ingest.cron}' (every 10 minutes, UTC)`);
  return task;
}

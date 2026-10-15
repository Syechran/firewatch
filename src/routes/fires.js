import { Router } from "express";
import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { getSchedulerState, runIngestCycle } from "../scheduler.js";

export const firesRouter = Router();

/**
 * GET /api/fires
 * Query params:
 *   from, to          ISO timestamps (default: last 24h)
 *   minLat,maxLat,minLon,maxLon  (default: Indonesia bbox)
 *   minReliability    1|3|5
 *   minFireLevel      1|2|3
 *   limit, offset
 */
firesRouter.get("/fires", async (req, res, next) => {
  try {
    const now = new Date();
    const from = parseDate(req.query.from) || new Date(now.getTime() - 24 * 3600 * 1000);
    const to = parseDate(req.query.to) || now;

    const minLon = num(req.query.minLon, config.indonesiaBbox.minLon);
    const minLat = num(req.query.minLat, config.indonesiaBbox.minLat);
    const maxLon = num(req.query.maxLon, config.indonesiaBbox.maxLon);
    const maxLat = num(req.query.maxLat, config.indonesiaBbox.maxLat);
    const minReliability = num(req.query.minReliability, null);
    const minFireLevel = num(req.query.minFireLevel, null);
    const limit = clamp(num(req.query.limit, 500), 1, 5000);
    const offset = Math.max(0, num(req.query.offset, 0) || 0);

    const where = [
      "observed_at >= $1",
      "observed_at <= $2",
      "lat >= $3",
      "lat <= $4",
      "lon >= $5",
      "lon <= $6",
    ];
    const params = [from, to, minLat, maxLat, minLon, maxLon];
    if (minReliability != null) {
      params.push(minReliability);
      where.push(`reliability >= $${params.length}`);
    }
    if (minFireLevel != null) {
      params.push(minFireLevel);
      where.push(`fire_level >= $${params.length}`);
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const { rows } = await pool.query(
      `SELECT id, source_file, hotspot_id, observed_at, lat, lon,
              area_km2, volcano_count, fire_level, reliability,
              frp_wm2, quality_flag, cluster_center_id, satellite
         FROM fire_hotspots
        WHERE ${where.join(" AND ")}
        ORDER BY observed_at DESC, frp_wm2 DESC NULLS LAST
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM fire_hotspots WHERE ${where.join(" AND ")}`,
      countParams
    );

    res.json({
      bbox: { minLon, minLat, maxLon, maxLat },
      from,
      to,
      total: countRows[0].total,
      limit,
      offset,
      count: rows.length,
      hotspots: rows,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fires/latest — hotspots from the most recent successful ingest */
firesRouter.get("/fires/latest", async (req, res, next) => {
  try {
    const { rows: slotRows } = await pool.query(
      `SELECT MAX(observed_slot) AS slot FROM ingested_files`
    );
    const slot = slotRows[0]?.slot;
    if (!slot) {
      return res.json({ slot: null, hotspots: [] });
    }

    const { rows } = await pool.query(
      `SELECT id, source_file, hotspot_id, observed_at, lat, lon,
              area_km2, volcano_count, fire_level, reliability,
              frp_wm2, quality_flag, cluster_center_id, satellite
         FROM fire_hotspots
        WHERE observed_at = $1
        ORDER BY frp_wm2 DESC NULLS LAST`,
      [slot]
    );

    res.json({ slot, count: rows.length, hotspots: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/fires/stats — counts bucketed by hour */
firesRouter.get("/fires/stats", async (req, res, next) => {
  try {
    const now = new Date();
    const from = parseDate(req.query.from) || new Date(now.getTime() - 24 * 3600 * 1000);
    const to = parseDate(req.query.to) || now;

    const { rows } = await pool.query(
      `SELECT date_trunc('hour', observed_at) AS hour,
              COUNT(*)::int AS hotspots,
              COUNT(*) FILTER (WHERE fire_level >= 3)::int AS flaming,
              ROUND(AVG(frp_wm2)::numeric, 2) AS avg_frp,
              ROUND(SUM(frp_wm2 * COALESCE(area_km2, 0))::numeric, 2) AS total_frp_area
         FROM fire_hotspots
        WHERE observed_at >= $1 AND observed_at <= $2
        GROUP BY 1
        ORDER BY 1 DESC`,
      [from, to]
    );

    res.json({ from, to, buckets: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ingest/status */
firesRouter.get("/ingest/status", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 10`
    );
    res.json({
      scheduler: getSchedulerState(),
      indonesiaBbox: config.indonesiaBbox,
      recentRuns: rows,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ingest/run — manual trigger (useful before credentials smoke-test) */
firesRouter.post("/ingest/run", async (req, res, next) => {
  try {
    const result = await runIngestCycle();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

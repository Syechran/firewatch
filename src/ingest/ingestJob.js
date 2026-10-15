import { config } from "../config.js";
import { pool } from "../db/pool.js";
import {
  withPtree,
  wlfSlotPath,
  listDirSafe,
  downloadText,
} from "./ptreeClient.js";
import { parseWlfCsv, parseWlfFilename } from "./wlfParser.js";
import { filterIndonesia } from "./indonesiaFilter.js";

/** 10-minute observation slots Himawari uses (UTC). */
export function* tenMinuteSlots(fromDate, toDate) {
  const from = new Date(fromDate);
  // Align down to the previous :00/:10/...
  from.setUTCMinutes(Math.floor(from.getUTCMinutes() / 10) * 10, 0, 0);
  for (let t = from.getTime(); t <= toDate.getTime(); t += 10 * 60 * 1000) {
    yield new Date(t);
  }
}

/**
 * Run one ingest cycle: scan recent WLF L2 slots and store Indonesia hits.
 * Idempotent — already-ingested files are skipped.
 */
export async function ingestRecent({
  lookbackMinutes = config.ingest.lookbackMinutes,
  now = new Date(),
} = {}) {
  const startedAt = new Date();
  const result = {
    startedAt,
    filesSeen: 0,
    filesNew: 0,
    pointsStored: 0,
    pointsInBbox: 0,
    errors: [],
  };

  const lookbackStart = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
  const slots = [...tenMinuteSlots(lookbackStart, now)];
  // Group by hour directory to cut FTP round-trips
  const byHour = new Map();
  for (const slot of slots) {
    const path = wlfSlotPath(slot);
    if (!byHour.has(path)) byHour.set(path, []);
    byHour.get(path).push(slot);
  }

  await withPtree(async (client) => {
    for (const [dirPath] of byHour) {
      let names;
      try {
        names = await listDirSafe(client, dirPath);
      } catch (err) {
        result.errors.push(`list ${dirPath}: ${err.message}`);
        continue;
      }

      for (const name of names) {
        result.filesSeen += 1;
        const meta = parseWlfFilename(name);
        if (!meta) continue;

        // Skip files outside the lookback window (already covered or future)
        if (meta.observedAt < lookbackStart || meta.observedAt > now) continue;

        const already = await pool.query(
          "SELECT 1 FROM ingested_files WHERE source_file = $1",
          [name]
        );
        if (already.rowCount > 0) continue;

        const remotePath = `${dirPath}/${name}`;
        let text;
        try {
          text = await downloadText(client, remotePath);
        } catch (err) {
          result.errors.push(`download ${name}: ${err.message}`);
          continue;
        }

        const { hotspots } = parseWlfCsv(text);
        const inBbox = filterIndonesia(hotspots, config.indonesiaBbox);
        result.pointsInBbox += inBbox.length;

        const clientDb = await pool.connect();
        try {
          await clientDb.query("BEGIN");
          await clientDb.query(
            `INSERT INTO ingested_files (source_file, remote_path, observed_slot, row_count, in_bbox_count)
             VALUES ($1, $2, $3, $4, $5)`,
            [name, remotePath, meta.observedAt, hotspots.length, inBbox.length]
          );

          for (const h of inBbox) {
            const inserted = await clientDb.query(
              `INSERT INTO fire_hotspots (
                 source_file, hotspot_id, observed_at, lat, lon,
                 area_km2, volcano_count, fire_level, reliability,
                 frp_wm2, quality_flag, cluster_center_id, satellite
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
               ON CONFLICT (source_file, hotspot_id) DO NOTHING`,
              [
                name,
                h.hotspotId,
                h.observedAt,
                h.lat,
                h.lon,
                h.areaKm2,
                h.volcanoCount,
                h.fireLevel,
                h.reliability,
                h.frpWm2,
                h.qualityFlag,
                h.clusterCenterId,
                meta.satellite,
              ]
            );
            result.pointsStored += inserted.rowCount;
          }

          await clientDb.query("COMMIT");
          result.filesNew += 1;
        } catch (err) {
          await clientDb.query("ROLLBACK");
          result.errors.push(`store ${name}: ${err.message}`);
        } finally {
          clientDb.release();
        }
      }
    }
  });

  result.finishedAt = new Date();
  result.status =
    result.errors.length === 0
      ? "success"
      : result.filesNew > 0
        ? "partial"
        : "error";

  await pool.query(
    `INSERT INTO ingest_runs
       (started_at, finished_at, status, files_seen, files_new, points_stored, points_in_bbox, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      result.startedAt,
      result.finishedAt,
      result.status,
      result.filesSeen,
      result.filesNew,
      result.pointsStored,
      result.pointsInBbox,
      result.errors.length ? result.errors.join("; ").slice(0, 4000) : null,
    ]
  );

  return result;
}

export async function latestRun() {
  const { rows } = await pool.query(
    `SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 1`
  );
  return rows[0] || null;
}

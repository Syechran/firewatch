import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer for ${name}: ${raw}`);
  return n;
}

function parseBbox(raw) {
  const parts = raw.split(",").map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`INDONESIA_BBOX must be minLon,minLat,maxLon,maxLat — got: ${raw}`);
  }
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon >= maxLon || minLat >= maxLat) {
    throw new Error(`INDONESIA_BBOX min must be < max — got: ${raw}`);
  }
  return { minLon, minLat, maxLon, maxLat };
}

export const config = {
  port: intEnv("PORT", 3000),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: required("DATABASE_URL"),
  ptree: {
    host: process.env.PTREE_HOST || "ftp.ptree.jaxa.jp",
    user: required("PTREE_USER"),
    password: required("PTREE_PASSWORD"),
    root: process.env.PTREE_ROOT || "/pub",
  },
  wlf: {
    version: process.env.WLF_VERSION || "010",
  },
  indonesiaBbox: parseBbox(
    process.env.INDONESIA_BBOX || "94.5,-11.5,141.5,6.5"
  ),
  ingest: {
    lookbackMinutes: intEnv("INGEST_LOOKBACK_MINUTES", 180),
    cron: process.env.INGEST_CRON || "2,12,22,32,42,52 * * * *",
    disableScheduler: process.env.DISABLE_SCHEDULER === "1",
  },
};

-- Firewatch schema for JAXA Himawari WLF (Wild Fire) hotspots

CREATE TABLE IF NOT EXISTS ingest_runs (
  id            BIGSERIAL PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'running'
                CHECK (status IN ('running', 'success', 'partial', 'error')),
  files_seen    INTEGER NOT NULL DEFAULT 0,
  files_new     INTEGER NOT NULL DEFAULT 0,
  points_stored INTEGER NOT NULL DEFAULT 0,
  points_in_bbox INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS fire_hotspots (
  id               BIGSERIAL PRIMARY KEY,
  source_file      TEXT NOT NULL,
  hotspot_id       TEXT NOT NULL,
  observed_at      TIMESTAMPTZ NOT NULL,
  lat              DOUBLE PRECISION NOT NULL,
  lon              DOUBLE PRECISION NOT NULL,
  area_km2         DOUBLE PRECISION,
  volcano_count    INTEGER,
  fire_level       INTEGER,
  reliability      INTEGER,
  frp_wm2          DOUBLE PRECISION,
  quality_flag     INTEGER,
  cluster_center_id TEXT,
  satellite        TEXT,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fire_hotspots_unique UNIQUE (source_file, hotspot_id)
);

CREATE INDEX IF NOT EXISTS idx_fire_hotspots_observed_at
  ON fire_hotspots (observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_fire_hotspots_lat_lon
  ON fire_hotspots (lat, lon);

CREATE INDEX IF NOT EXISTS idx_fire_hotspots_fire_level
  ON fire_hotspots (fire_level);

-- Track downloaded source files so re-runs are cheap and idempotent
CREATE TABLE IF NOT EXISTS ingested_files (
  source_file   TEXT PRIMARY KEY,
  remote_path   TEXT NOT NULL,
  observed_slot TIMESTAMPTZ NOT NULL,
  row_count     INTEGER NOT NULL DEFAULT 0,
  in_bbox_count INTEGER NOT NULL DEFAULT 0,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingested_files_slot
  ON ingested_files (observed_slot DESC);

-- Berita terkait kebakaran, dihimpun dari RSS media (job terjadwal).
CREATE TABLE IF NOT EXISTS news_items (
  id           BIGSERIAL PRIMARY KEY,
  link         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  source       TEXT NOT NULL,
  summary      TEXT,
  image_url    TEXT,
  published_at TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_items_published
  ON news_items (published_at DESC);

# firewatch

Node.js API that ingests **JAXA Himawari Wild Fire (WLF)** hotspots over Indonesia on a **10-minute** cadence and serves them over REST.

## Data source

| Item | Value |
|------|--------|
| Product | Himawari-8/9 Wild Fire (WLF) Level 2 |
| Cadence | 10 minutes |
| Format | CSV (hotspot ID, lat/lon, FRP, fire level, reliability, …) |
| Host | `ftp.ptree.jaxa.jp` (JAXA P-Tree) |
| Path | `/pub/himawari/L2/WLF/{VER}/{YYYYMM}/{DD}/{HH}` |
| Auth | Free P-Tree account (FTP user/password via email) |

WLF is **not** on the serverless JAXA Earth API. That service serves COGs/STAC imagery; the 10-minute fire product lives on P-Tree.

### Register for P-Tree

1. Open the JAXA P-Tree registration portal (linked from [JAXA Himawari Monitor](https://www.eorc.jaxa.jp/ptree/)).
2. Register with your email; you will receive an FTP password.
3. Put credentials in `.env` (never commit them).

## Architecture

```
node-cron (every 10 min, UTC offset)
    → FTP list/download WLF L2 CSVs for recent slots
    → parse CSV → filter Indonesia bbox → PostgreSQL
Express REST API reads PostgreSQL
```

Himawari has short housekeeping gaps (`02:40–02:50` and `14:40–14:50` UTC). Ingest treats missing files as empty and the lookback window (default 3h) fills gaps if a cycle is missed.

## Quick start

```bash
# 1. Postgres
docker compose up -d db

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# edit PTREE_USER / PTREE_PASSWORD / DATABASE_URL

# 4. Create tables
npm run migrate

# 5. One-shot ingest (validates FTP + schema)
npm run ingest:once

# 6. API + scheduler
npm start
```

## Configuration

See `.env.example`. Important keys:

| Var | Meaning |
|-----|---------|
| `PTREE_USER` / `PTREE_PASSWORD` | P-Tree FTP credentials |
| `WLF_VERSION` | Algorithm dir under `L2/WLF/` (default `010`) |
| `INDONESIA_BBOX` | `minLon,minLat,maxLon,maxLat` (default full archipelago) |
| `INGEST_CRON` | Poll schedule (default `2,12,22,32,42,52 * * * *`) |
| `INGEST_LOOKBACK_MINUTES` | Catch-up window per cycle (default 180) |
| `DISABLE_SCHEDULER` | `1` = API only, no background poll |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + scheduler state |
| GET | `/api/fires` | Hotspots (`from`,`to`,`minLat`…`maxLon`,`minReliability`,`minFireLevel`,`limit`,`offset`) |
| GET | `/api/fires/latest` | Points from the newest observation slot |
| GET | `/api/fires/stats` | Hourly counts / FRP aggregates |
| GET | `/api/ingest/status` | Recent ingest runs + scheduler |
| POST | `/api/ingest/run` | Force one poll cycle |

### Example

```bash
curl "http://localhost:3000/api/fires?minReliability=3&limit=100"
curl "http://localhost:3000/api/fires/latest"
curl -X POST http://localhost:3000/api/ingest/run
```

### Response shape (`/api/fires`)

```json
{
  "bbox": { "minLon": 94.5, "minLat": -11.5, "maxLon": 141.5, "maxLat": 6.5 },
  "from": "2026-10-13T02:00:00.000Z",
  "to": "2026-10-14T02:00:00.000Z",
  "total": 12,
  "count": 12,
  "hotspots": [
    {
      "hotspot_id": "104",
      "observed_at": "2026-10-14T02:00:00.000Z",
      "lat": -2.51,
      "lon": 106.82,
      "fire_level": 3,
      "reliability": 5,
      "frp_wm2": 42.5,
      "satellite": "H09"
    }
  ]
}
```

## How the 10-minute poll works

1. Cron fires at `:02, :12, :22, …` UTC (2 minutes after each Himawari slot).
2. The job scans the last `INGEST_LOOKBACK_MINUTES` of 10-minute slots.
3. For each hourly directory it lists `*.csv`, skips filenames already in `ingested_files`.
4. New files are parsed; rows inside `INDONESIA_BBOX` go to `fire_hotspots` (unique on `source_file + hotspot_id`).
5. Each cycle writes an `ingested_runs` row for observability.

## Tests

```bash
npm test
```

## Notes

- Fire level: `1` cold, `2` smoldering, `3` flaming.
- Reliability: `1` low, `3` normal, `5` high (frequent industrial hotspots often rate low).
- Cite JAXA P-Tree when publishing results built on this product.

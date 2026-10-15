# Firewatch

Pemantauan titik panas Karhutla Indonesia. Repo ini berisi **dua bagian**:

- **Backend** — Node.js/Express yang meng-ingest hotspot **JAXA Himawari WLF** tiap 10 menit ke PostgreSQL dan menyajikannya lewat REST.
- **Frontend** — peta interaktif (Leaflet + ES modules) di root repo: `indonesia-map.html`, `indonesia-map.css`, `js/`, `vendor/`.

Express juga menyajikan file frontend, sehingga keduanya jalan di **satu origin** (`http://localhost:3000`) tanpa masalah CORS.

---

## Menjalankan (gabungan)

```bash
# 1. Postgres
docker compose up -d db

# 2. Dependensi backend
npm install

# 3. Konfigurasi
cp .env.example .env        # lalu isi DATABASE_URL, PTREE_USER, PTREE_PASSWORD

# 4. Buat tabel
npm run migrate

# 5. Ingest sekali (opsional, untuk mengisi data)
npm run ingest:once

# 6. Jalankan API + frontend + scheduler
npm start
```

Lalu buka **http://localhost:3000/** — backend dan peta tampil dari satu server.

Ingin mengembangkan frontend dengan auto-reload? Tetap bisa dibuka lewat server statis
terpisah (`python3 -m http.server 8080`) selama `API_BASE` di `js/config.js` diarahkan
ke backend (`http://localhost:3000`); CORS sudah diaktifkan.

---

## Frontend

Struktur:

```
├─ indonesia-map.html     # markup + layout
├─ indonesia-map.css      # styling (legend, toggle, popup, seksi konten)
├─ js/
│  ├─ config.js           # konfigurasi terpusat (API base, warna, ambang)
│  ├─ api.js              # satu-satunya lapisan data (+ data mock opsional)
│  ├─ state.js            # store kecil (pub/sub)
│  ├─ map.js              # inisialisasi Leaflet + basemap
│  ├─ provinces.js        # batas provinsi: muat, pewarnaan, pilih/hover
│  ├─ hotspots.js         # layer titik panas
│  ├─ geo.js              # point-in-polygon: titik panas per provinsi
│  ├─ search.js           # pencarian alamat (Nominatim)
│  ├─ stats.js            # ringkasan nasional
│  ├─ checklist.js        # checklist tas siaga (localStorage)
│  ├─ report.js           # form laporan warga
│  ├─ ui.js               # legend, toggle layer, badge, status
│  ├─ utils.js            # helper
│  └─ main.js             # bootstrap
└─ vendor/leaflet/        # Leaflet 1.9.4 (lokal)
```

### Pemetaan data backend → UI

`GET /api/fires?limit=5000` mengembalikan:

```json
{
  "hotspots": [
    {
      "hotspot_id": "104",
      "observed_at": "2026-10-14T02:00:00.000Z",
      "lat": -2.51, "lon": 106.82,
      "fire_level": 3, "reliability": 5,
      "frp_wm2": 42.5, "area_km2": 0.8, "satellite": "H09"
    }
  ]
}
```

`js/api.js` menormalkannya menjadi
`{ id, latitude, longitude, observedAt, fireLevel, reliability, frp, area, satellite, source }`.

- **Warna titik**: `fire_level` (1 cold, 2 smoldering, 3 flaming).
- **Ukuran titik**: `frp_wm2`.
- **Choropleth provinsi**: dihitung di klien (`js/geo.js`, point-in-polygon) sebagai
  *kepadatan titik panas per provinsi* (0..1 relatif terhadap provinsi terbanyak),
  karena backend belum menyediakan endpoint indeks risiko.
- **Filter hari**: parameter `from` (default 24 jam terakhir) mengikuti rentang backend.

### Mode mock

Tanpa backend, set `USE_MOCK = true` di `js/config.js` untuk memakai data contoh.

### Catatan

- GeoJSON provinsi di-cache di `localStorage` 7 hari.
- Nominatim dibatasi 1 permintaan/detik; untuk trafik besar pindahkan ke backend.
- Form "Lapor titik api" ada di UI, tetapi **belum ada endpoint-nya di backend**
  (`REPORTS_ENABLED = false` di `js/config.js`); form menampilkan status belum tersedia.

---

## Backend

Node.js API that ingests **JAXA Himawari Wild Fire (WLF)** hotspots over Indonesia on a **10-minute** cadence and serves them over REST.

### Data source

| Item | Value |
|------|--------|
| Product | Himawari-8/9 Wild Fire (WLF) Level 2 |
| Cadence | 10 minutes |
| Format | CSV (hotspot ID, lat/lon, FRP, fire level, reliability, …) |
| Host | `ftp.ptree.jaxa.jp` (JAXA P-Tree) |
| Path | `/pub/himawari/L2/WLF/{VER}/{YYYYMM}/{DD}/{HH}` |
| Auth | Free P-Tree account (FTP user/password via email) |

WLF is **not** on the serverless JAXA Earth API. That service serves COGs/STAC imagery; the 10-minute fire product lives on P-Tree.

#### Register for P-Tree

1. Open the JAXA P-Tree registration portal (linked from [JAXA Himawari Monitor](https://www.eorc.jaxa.jp/ptree/)).
2. Register with your email; you will receive an FTP password.
3. Put credentials in `.env` (never commit them).

### Architecture

```
node-cron (every 10 min, UTC offset)
    → FTP list/download WLF L2 CSVs for recent slots
    → parse CSV → filter Indonesia bbox → PostgreSQL
Express REST API reads PostgreSQL (+ menyajikan frontend statis)
```

Himawari has short housekeeping gaps (`02:40–02:50` and `14:40–14:50` UTC). Ingest treats missing files as empty and the lookback window (default 3h) fills gaps if a cycle is missed.

### Configuration

See `.env.example`. Important keys:

| Var | Meaning |
|-----|---------|
| `PORT` / `HOST` | HTTP server bind (default `3000` / `0.0.0.0`) |
| `PTREE_USER` / `PTREE_PASSWORD` | P-Tree FTP credentials |
| `WLF_VERSION` | Algorithm dir under `L2/WLF/` (default `010`) |
| `INDONESIA_BBOX` | `minLon,minLat,maxLon,maxLat` (default full archipelago) |
| `INGEST_CRON` | Poll schedule (default `2,12,22,32,42,52 * * * *`) |
| `INGEST_LOOKBACK_MINUTES` | Catch-up window per cycle (default 180) |
| `DISABLE_SCHEDULER` | `1` = API only, no background poll |

### API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + scheduler state |
| GET | `/api/fires` | Hotspots (`from`,`to`,`minLat`…`maxLon`,`minReliability`,`minFireLevel`,`limit`,`offset`) |
| GET | `/api/fires/latest` | Points from the newest observation slot |
| GET | `/api/fires/stats` | Hourly counts / FRP aggregates |
| GET | `/api/ingest/status` | Recent ingest runs + scheduler |
| POST | `/api/ingest/run` | Force one poll cycle |

#### Example

```bash
curl "http://localhost:3000/api/fires?minReliability=3&limit=100"
curl "http://localhost:3000/api/fires/latest"
curl -X POST http://localhost:3000/api/ingest/run
```

### How the 10-minute poll works

1. Cron fires at `:02, :12, :22, …` UTC (2 minutes after each Himawari slot).
2. The job scans the last `INGEST_LOOKBACK_MINUTES` of 10-minute slots.
3. For each hourly directory it lists `*.csv`, skips filenames already in `ingested_files`.
4. New files are parsed; rows inside `INDONESIA_BBOX` go to `fire_hotspots` (unique on `source_file + hotspot_id`).
5. Each cycle writes an `ingested_runs` row for observability.

### Tests

```bash
npm test
```

### Notes

- Fire level: `1` cold, `2` smoldering, `3` flaming.
- Reliability: `1` low, `3` normal, `5` high (frequent industrial hotspots often rate low).
- Cite JAXA P-Tree when publishing results built on this product.

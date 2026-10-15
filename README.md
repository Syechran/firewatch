# Firewatch — Interactive Map

Frontend peta interaktif untuk pemantauan titik panas dan indeks risiko Karhutla
di Indonesia. Bagian dari proyek **SiagaApi**.

## Menjalankan

App ini pakai ES modules + `fetch`, jadi **harus disajikan lewat HTTP server**
(tidak bisa dibuka langsung via `file://`).

```bash
# dari direktori firewatch/firewatch
python3 -m http.server 8080
# lalu buka http://localhost:8080/indonesia-map.html
```

Atau: `npx serve .`

## Struktur

```
firewatch/firewatch/
├─ indonesia-map.html     # markup + layout
├─ indonesia-map.css      # styling (termasuk legend, toggle, popup)
├─ js/
│  ├─ config.js           # konfigurasi terpusat (API base, warna, ambang risiko)
│  ├─ api.js              # satu-satunya lapisan yang mengambil data (+ data mock)
│  ├─ state.js            # store kecil (pub/sub) untuk sinkronisasi UI
│  ├─ map.js              # inisialisasi peta Leaflet + basemap
│  ├─ provinces.js        # batas provinsi: muat, pewarnaan risiko, pilih/hover
│  ├─ hotspots.js         # layer titik panas (FIRMS)
│  ├─ search.js           # pencarian alamat (Nominatim, sementara)
│  ├─ ui.js               # legend, toggle layer, badge risiko, status
│  ├─ utils.js            # helper (escapeHtml, normalizeName, hash, format)
│  └─ main.js             # titik masuk / bootstrap
└─ vendor/leaflet/        # Leaflet 1.9.4 (lokal, agar tidak bergantung CDN)
```

## Data mock vs data backend

Saat ini `js/config.js` diset `USE_MOCK = true`, sehingga UI memakai data contoh
(titik panas & indeks risiko acak yang deterministik). Semua akses data lewat
`js/api.js`, jadi saat backend siap **tidak perlu mengubah modul lain**:

```js
// js/config.js
export const USE_MOCK = false;
export const API_BASE = "http://localhost:3000/api";
```

Sesuaikan `ENDPOINTS` dengan rute backend.

## Kontrak endpoint yang diharapkan

### `GET {API_BASE}/risiko/provinsi`

```json
[
  { "provinsi": "RIAU", "index": 0.82, "level": "tinggi" }
]
```

- `provinsi`: nama provinsi (dicocokkan tanpa peduli huruf besar/kecil).
- `index`: 0..1 → dipakai untuk pewarnaan choropleth.
- `level` opsional (boleh dihitung frontend dari `index`).

### `GET {API_BASE}/titik-panas?hari=1&provinsi=RIAU`

```json
[
  {
    "latitude": 0.51,
    "longitude": 101.45,
    "confidence": "high",
    "frp": 42.3,
    "daynight": "D",
    "acq_date": "2026-10-15T04:20:00Z",
    "source": "VIIRS_SNPP_NRT"
  }
]
```

- `confidence`: string apa adanya dari FIRMS (`low`/`nominal`/`high`) atau persen MODIS.
- `hari`: rentang hari (1..5), mengikuti batas API FIRMS.

### `POST {API_BASE}/laporan-warga`

Dipakai untuk laporan warga (belum ada UI-nya). Body bebas, minimal
`{ latitude, longitude, keterangan }`.

## Catatan

- **GeoJSON provinsi** di-cache di `localStorage` selama 7 hari untuk mempercepat
  muat ulang (lihat `GEOJSON_CACHE_TTL_MS`).
- **Nominatim** dipakai sementara dengan batas 1 permintaan/detik. Untuk trafik
  besar, sebaiknya geocoding dipindah ke backend.
- **Leaflet** di-vendor lokal; perbarui lewat `vendor/leaflet/` bila perlu.

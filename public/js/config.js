// Konfigurasi terpusat untuk aplikasi peta FIREWATCH.
// Ubah nilai di sini saat backend SiagaApi siap dipakai.

// Set true untuk memakai data contoh tanpa backend (mis. pengembangan UI).
export const USE_MOCK = false;

// Base URL backend. Kosong = same origin (Express menyajikan frontend ini).
// Contoh dev terpisah: "http://localhost:3000".
export const API_BASE = "";

// Kontrak endpoint backend (lihat src/routes/fires.js).
export const ENDPOINTS = {
  fires: "/api/fires",
  firesLatest: "/api/fires/latest",
  firesStats: "/api/fires/stats",
  weather: "/api/weather",
  news: "/api/news",
  health: "/health"
};

// Backend belum punya endpoint laporan warga; form ditandai belum tersedia.
export const REPORTS_ENABLED = false;

// Batas jumlah hotspot yang diambil per permintaan (maks backend 5000).
export const HOTSPOT_LIMIT = 5000;

// Sumber data eksternal (sementara, sampai backend mem-proxy-nya).
export const PROVINCE_GEOJSON_URL =
  "https://raw.githubusercontent.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces/main/GeoJSON/indonesia-38-provinces.geojson";

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Cache GeoJSON di localStorage agar tidak fetch ulang tiap reload.
export const GEOJSON_CACHE_KEY = "firewatch:provinces:v1";
export const GEOJSON_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

// Batas laju Nominatim (kebijakan: maks 1 permintaan/detik).
export const SEARCH_THROTTLE_MS = 1100;

// Timeout request ke backend (ms).
export const REQUEST_TIMEOUT_MS = 12000;

// Proyeksi peta.
export const MAP_BOUNDS_PADDING = [35, 35];
export const MAP_FIT_MAX_ZOOM = 6;
export const MAP_HOME_CENTER = [-2.5, 118];
export const MAP_HOME_ZOOM = 4.5;

// Warna & gaya peta (selaras dengan variabel di indonesia-map.css).
export const COLORS = {
  border: "#f2e4dc",
  hoverBorder: "#ffe0c7",
  hoverFill: "#ffb26b",
  selectedBorder: "#ffffff",
  selectedFill: "#ff5a2c",
  risk: {
    rendah: "#b6c98f",
    sedang: "#f0c266",
    tinggi: "#ffa470",
    ekstrem: "#ff4d2e"
  }
};

export const PROVINCE_STYLE = {
  default: {
    color: COLORS.border,
    weight: 1,
    opacity: 0.85,
    fillColor: "#6b4a42",
    fillOpacity: 0.18
  },
  hover: {
    color: COLORS.hoverBorder,
    weight: 2,
    opacity: 1,
    fillColor: COLORS.hoverFill,
    fillOpacity: 0.6
  },
  selected: {
    color: COLORS.selectedBorder,
    weight: 2.5,
    opacity: 1,
    fillColor: COLORS.selectedFill,
    fillOpacity: 0.72
  }
};

// Ambang batas indeks risiko (0..1) -> kategori.
export const RISK_THRESHOLDS = [
  { max: 0.4, level: "rendah" },
  { max: 0.7, level: "sedang" },
  { max: 0.9, level: "tinggi" },
  { max: Infinity, level: "ekstrem" }
];

export function riskLevel(index) {
  const found = RISK_THRESHOLDS.find((t) => index < t.max);
  return found ? found.level : "rendah";
}

export function riskColor(index) {
  return COLORS.risk[riskLevel(index)];
}

// --- Status lokasi "Find a Place" ---
// Ambang jarak & level untuk menilai apakah sebuah lokasi berada di zona
// kebakaran/potensi. Dipakai oleh js/risk.js dan js/status-popup.js.
export const FIRE_STATUS = {
  watchRadiusKm: 25, // ada titik panas dalam radius ini -> SIAGA
  evacuateRadiusKm: 10, // titik api aktif (level >= smoldering) -> SEGERA EVAKUASI
  immediateRadiusKm: 3, // titik menyala/flaming -> SEGERA MELARIKAN DIRI
  smokeRadiusKm: 60, // jangkauan asap/kabut (api di dalam radius ini bisa mencemari udara)
  smokeDenseRadiusKm: 35, // asap pekat bila ada api aktif (level >= smoldering) di sini
  smolderingLevel: 2,
  flamingLevel: 3
};

export const FIRE_STATUS_META = {
  aman: {
    label: "AMAN",
    description:
      "Tidak ada titik panas terdeteksi dalam 60 km dari lokasi ini."
  },
  asap: {
    label: "WASPADA ASAP",
    description:
      "Tidak ada api dekat, tetapi ada titik panas dalam 60 km. Asap/kabut dapat terbawa angin dan berisiko bagi pernapasan — pakai masker dan tutup ventilasi."
  },
  siaga: {
    label: "SIAGA",
    description:
      "Ada titik panas dalam 25 km. Pantau asap dan arah angin, pakai masker di luar ruangan, dan siapkan tas siaga."
  },
  evakuasi: {
    label: "SEGERA EVAKUASI",
    description:
      "Ada titik api aktif dalam 10 km. Bersiap evakuasi sebelum api menyebar, dan hindari paparan asap."
  },
  larikan_diri: {
    label: "SEGERA MELARIKAN DIRI",
    description:
      "Titik api menyala (flaming) sangat dekat. Tinggalkan lokasi sekarang dan bergerak melawan arah angin."
  }
};

export const SMOKE_NOTES = {
  haze: "Asap/kabut ringan terdeteksi di sekitar.",
  dense: "Asap pekat dari api aktif — kualitas udara berisiko tinggi bagi pernapasan."
};

// --- Simulasi sebaran api (eksperimental, hasil belum tervalidasi) ---
export const SIMULATION = {
  cellDeg: 0.01, // ukuran sel ~1,1 km (lebih cepat dari 0,005 di SiagaApi)
  hours: 6, // jumlah langkah; 1 langkah ≈ 1 jam
  maxCellsPerSide: 140, // batas ukuran grid demi performa
  ignitionRadiusKm: 30, // hanya klaster dalam radius ini dari lokasi
  baseProbability: 0.15, // peluang dasar tanpa pengaruh cuaca
  ignitionLevel: 2 // titik dengan fire_level >= ini jadi pemicu awal
};

// Skor risiko (0..100) dari kelembapan + angin + jumlah titik panas.
// Formula mengikuti SiagaApi (masih heuristik, belum divalidasi literatur).
export const RISK_INDEX = {
  weights: { humidity: 0.4, wind: 0.6, hotspot: 2.0 },
  hotspotCap: 20,
  bands: [
    { min: 70, key: "merah", label: "Tinggi" },
    { min: 40, key: "kuning", label: "Sedang" },
    { min: 0, key: "hijau", label: "Rendah" }
  ]
};

// Konversi arah angin (derajat, arah DARI mana angin bertiup) ke mata angin.
export const COMPASS_POINTS = [
  "Utara", "Timur Laut", "Timur", "Tenggara",
  "Selatan", "Barat Daya", "Barat", "Barat Laut"
];

// Daftar provinsi untuk data mock (dicocokkan tanpa peduli huruf besar/kecil).
export const PROVINCES = [
  "ACEH", "SUMATERA UTARA", "SUMATERA BARAT", "RIAU", "JAMBI",
  "SUMATERA SELATAN", "BENGKULU", "LAMPUNG", "KEPULAUAN BANGKA BELITUNG",
  "KEPULAUAN RIAU", "DKI JAKARTA", "JAWA BARAT", "JAWA TENGAH",
  "DI YOGYAKARTA", "JAWA TIMUR", "BANTEN", "BALI", "NUSA TENGGARA BARAT",
  "NUSA TENGGARA TIMUR", "KALIMANTAN BARAT", "KALIMANTAN TENGAH",
  "KALIMANTAN SELATAN", "KALIMANTAN TIMUR", "KALIMANTAN UTARA",
  "SULAWESI UTARA", "SULAWESI TENGAH", "SULAWESI SELATAN",
  "SULAWESI TENGGARA", "GORONTALO", "SULAWESI BARAT", "MALUKU",
  "MALUKU UTARA", "PAPUA", "PAPUA BARAT", "PAPUA SELATAN",
  "PAPUA TENGAH", "PAPUA PEGUNUNGAN", "PAPUA BARAT DAYA"
];

// Konfigurasi terpusat untuk aplikasi peta FIREWATCH.
// Ubah nilai di sini saat backend SiagaApi siap dipakai.

// Set false begitu backend temanmu jalan, lalu isi API_BASE di bawah.
export const USE_MOCK = true;

// Base URL backend (Node). Contoh: "http://localhost:3000/api".
export const API_BASE = "";

// Kontrak endpoint backend yang diharapkan. Sesuaikan path-nya nanti.
export const ENDPOINTS = {
  provinceRisk: "/risiko/provinsi",
  hotspots: "/titik-panas",
  laporan: "/laporan-warga"
};

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

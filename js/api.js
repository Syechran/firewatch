// Lapisan API: satu-satunya tempat yang tahu cara mengambil data.
// Saat USE_MOCK = true, fungsi mengembalikan data contoh agar UI bisa
// dibangun tanpa backend. Saat backend siap, cukup set USE_MOCK = false
// dan isi API_BASE di config.js — tidak perlu mengubah modul lain.

import {
  API_BASE,
  ENDPOINTS,
  USE_MOCK,
  REQUEST_TIMEOUT_MS,
  PROVINCES,
  riskLevel
} from "./config.js";
import { hashString, seededUnit } from "./utils.js";

// --- Helper request (dipakai mode nyata) ---

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      ...options
    });

    if (!response.ok) {
      throw new Error(`Permintaan gagal (${response.status})`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

// Jeda singkat agar transisi mock terasa seperti panggilan jaringan.
function mockDelay(value, ms = 250) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// --- Data mock ---

// Indeks risiko deterministik dari nama provinsi (0..1).
export function fallbackRiskIndex(name) {
  const seed = hashString(`risk:${name}`);
  return seededUnit(seed) * 0.95;
}

function buildMockProvinceRisk() {
  return PROVINCES.map((provinsi) => {
    const index = Number(fallbackRiskIndex(provinsi).toFixed(3));
    return { provinsi, index, level: riskLevel(index) };
  });
}

const HOTSPOT_SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "MODIS_NRT"];
const CONFIDENCE_LEVELS = ["low", "nominal", "high"];

function buildMockHotspots({ hari = 1 } = {}) {
  const count = 180 * Math.min(Math.max(hari, 1), 5);
  const now = Date.now();
  const hotspots = [];

  for (let i = 0; i < count; i += 1) {
    const seed = hashString(`hotspot:${i}:${hari}`);
    // Sebar titik di bounding box kepulauan Indonesia.
    const lat = -11 + seededUnit(seed) * 17; // -11 .. 6
    const lng = 95 + seededUnit(seed + 1) * 46; // 95 .. 141
    const confidence =
      CONFIDENCE_LEVELS[Math.floor(seededUnit(seed + 2) * CONFIDENCE_LEVELS.length)];
    const frp = Number((seededUnit(seed + 3) * 120 + 5).toFixed(1));
    const acqTime = now - Math.floor(seededUnit(seed + 4) * hari * 86400000);

    hotspots.push({
      id: `mock-${i}`,
      latitude: Number(lat.toFixed(5)),
      longitude: Number(lng.toFixed(5)),
      confidence,
      frp,
      daynight: seededUnit(seed + 5) > 0.7 ? "N" : "D",
      satellite: seededUnit(seed + 6) > 0.5 ? "N" : "1",
      source: HOTSPOT_SOURCES[Math.floor(seededUnit(seed + 7) * HOTSPOT_SOURCES.length)],
      acq_date: new Date(acqTime).toISOString()
    });
  }

  return hotspots;
}

// --- API publik ---

export async function getProvinceRisk() {
  if (USE_MOCK) return mockDelay(buildMockProvinceRisk());

  const data = await request(ENDPOINTS.provinceRisk);
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function getHotspots({ hari = 1, provinsi = null } = {}) {
  if (USE_MOCK) return mockDelay(buildMockHotspots({ hari }));

  const params = new URLSearchParams({ hari: String(hari) });
  if (provinsi) params.set("provinsi", provinsi);

  const data = await request(`${ENDPOINTS.hotspots}?${params}`);
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function postLaporan(payload) {
  if (USE_MOCK) {
    return mockDelay({ ok: true, id: `mock-laporan-${Date.now()}`, ...payload }, 400);
  }

  return request(ENDPOINTS.laporan, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
}

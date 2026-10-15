// Lapisan API: satu-satunya tempat yang tahu cara mengambil data.
// Saat USE_MOCK = true, fungsi mengembalikan data contoh agar UI bisa
// dibangun tanpa backend. Saat backend hidup, cukup set USE_MOCK = false
// di config.js — modul lain tidak perlu berubah.

import {
  API_BASE,
  ENDPOINTS,
  USE_MOCK,
  REQUEST_TIMEOUT_MS,
  HOTSPOT_LIMIT,
  PROVINCES,
  riskLevel
} from "./config.js";
import { hashString, seededUnit } from "./utils.js";

// --- Helper request (mode nyata) ---

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

function mockDelay(value, ms = 250) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function fromISO(hari) {
  const days = Math.min(Math.max(Number(hari) || 1, 1), 5);
  return new Date(Date.now() - days * 86400000).toISOString();
}

// --- Normalisasi bentuk data backend -> UI ---

export function normalizeHotspot(row) {
  return {
    id: row.id ?? row.hotspot_id,
    latitude: Number(row.lat ?? row.latitude),
    longitude: Number(row.lon ?? row.longitude),
    observedAt: row.observed_at ?? row.acq_date ?? null,
    fireLevel: row.fire_level != null ? Number(row.fire_level) : null,
    reliability: row.reliability != null ? Number(row.reliability) : null,
    frp: row.frp_wm2 != null ? Number(row.frp_wm2) : row.frp != null ? Number(row.frp) : null,
    area: row.area_km2 != null ? Number(row.area_km2) : null,
    satellite: row.satellite ?? null,
    source: row.source_file ?? row.source ?? null
  };
}

function isValidPoint(hotspot) {
  return Number.isFinite(hotspot.latitude) && Number.isFinite(hotspot.longitude);
}

// --- Data mock ---

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

const HOTSPOT_SOURCES = ["WLF_H09", "WLF_H08"];
const FIRE_LEVELS = [1, 1, 2, 2, 2, 3];

function buildMockHotspots({ hari = 1 } = {}) {
  const count = 180 * Math.min(Math.max(hari, 1), 5);
  const now = Date.now();
  const hotspots = [];

  for (let i = 0; i < count; i += 1) {
    const seed = hashString(`hotspot:${i}:${hari}`);
    const lat = -11 + seededUnit(seed) * 17;
    const lng = 95 + seededUnit(seed + 1) * 46;
    const observedAt = now - Math.floor(seededUnit(seed + 4) * hari * 86400000);

    hotspots.push({
      id: `mock-${i}`,
      latitude: Number(lat.toFixed(5)),
      longitude: Number(lng.toFixed(5)),
      observedAt: new Date(observedAt).toISOString(),
      fireLevel: FIRE_LEVELS[Math.floor(seededUnit(seed + 2) * FIRE_LEVELS.length)],
      reliability: [1, 3, 5][Math.floor(seededUnit(seed + 6) * 3)],
      frp: Number((seededUnit(seed + 3) * 120 + 5).toFixed(1)),
      area: Number((seededUnit(seed + 8) * 2).toFixed(2)),
      satellite: seededUnit(seed + 5) > 0.5 ? "H09" : "H08",
      source: HOTSPOT_SOURCES[Math.floor(seededUnit(seed + 7) * HOTSPOT_SOURCES.length)]
    });
  }

  return hotspots;
}

// --- API publik ---

export async function getHotspots({ hari = 1 } = {}) {
  if (USE_MOCK) return mockDelay(buildMockHotspots({ hari }));

  const params = new URLSearchParams({
    from: fromISO(hari),
    limit: String(HOTSPOT_LIMIT)
  });

  const data = await request(`${ENDPOINTS.fires}?${params}`);
  const rows = Array.isArray(data) ? data : data?.hotspots ?? [];
  return rows.map(normalizeHotspot).filter(isValidPoint);
}

export async function getHotspotsLatest() {
  if (USE_MOCK) return mockDelay(buildMockHotspots({ hari: 1 }));

  const data = await request(ENDPOINTS.firesLatest);
  const rows = Array.isArray(data) ? data : data?.hotspots ?? [];
  return rows.map(normalizeHotspot).filter(isValidPoint);
}

export async function getFireStats({ hari = 1 } = {}) {
  if (USE_MOCK) return mockDelay({ from: fromISO(hari), to: new Date().toISOString(), buckets: [] });

  return request(`${ENDPOINTS.firesStats}?from=${encodeURIComponent(fromISO(hari))}`);
}

export async function getHealth() {
  return request(ENDPOINTS.health);
}

// Backend belum menyediakan endpoint indeks risiko; choropleth dihitung
// di klien (js/geo.js). Fungsi ini dipertahankan untuk kompatibilitas.
export async function getProvinceRisk() {
  if (USE_MOCK) return mockDelay(buildMockProvinceRisk());
  return [];
}

export async function postLaporan(payload) {
  if (USE_MOCK) {
    return mockDelay({ ok: true, id: `mock-laporan-${Date.now()}`, ...payload }, 400);
  }

  throw new Error("Endpoint laporan warga belum tersedia di backend.");
}

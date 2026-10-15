// Ambil data cuaca (angin, kelembapan, PM2.5) lewat backend kita yang
// mem-proxy Open-Meteo. Null bila gagal — fitur tetap jalan tanpa cuaca.
import { API_BASE, COMPASS_POINTS, ENDPOINTS, REQUEST_TIMEOUT_MS } from "./config.js";

export async function getWeather(latitude, longitude) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${API_BASE}${ENDPOINTS.weather}?lat=${latitude}&lon=${longitude}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    const hasWind = Number.isFinite(data.windSpeedKmh);
    const hasHumidity = Number.isFinite(data.humidity);
    if (!hasWind && !hasHumidity) return null;

    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Arah angin meteorologis (dari mana angin bertiup) -> mata angin.
export function compassPoint(deg) {
  if (!Number.isFinite(deg)) return "—";
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_POINTS[index];
}

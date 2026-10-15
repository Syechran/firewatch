// Ringkasan nasional: dihitung dari data yang sedang aktif (mock atau backend).
import { state, subscribe } from "./state.js";
import { formatDateTime } from "./utils.js";

export function initStats() {
  subscribe("hotspots:loaded", render);
  subscribe("risk:loaded", render);
  render();
}

// Titik dengan fire_level 3 = api menyala (flaming).
function flamingCount() {
  return state.hotspots.filter((hotspot) => Number(hotspot.fireLevel) >= 3).length;
}

function provincesWithHotspots() {
  let count = 0;
  state.riskByProvince.forEach((entry) => {
    if ((entry.count ?? 0) > 0) count += 1;
  });
  return count;
}

function latestAcquisition() {
  const times = state.hotspots
    .map((hotspot) => new Date(hotspot.observedAt).getTime())
    .filter((time) => Number.isFinite(time));
  if (!times.length) return "—";
  return formatDateTime(new Date(Math.max(...times)).toISOString());
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function render() {
  setText("stat-hotspots", state.hotspots.length.toLocaleString("id-ID"));
  setText("stat-high", flamingCount().toLocaleString("id-ID"));
  setText("stat-risk", provincesWithHotspots().toLocaleString("id-ID"));
  setText("stat-updated", latestAcquisition());
}

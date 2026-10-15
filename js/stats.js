// Ringkasan nasional: dihitung dari data yang sedang aktif (mock atau backend).
import { state, subscribe } from "./state.js";
import { riskLevel } from "./config.js";
import { formatDateTime } from "./utils.js";

export function initStats() {
  subscribe("hotspots:loaded", render);
  subscribe("risk:loaded", render);
  render();
}

function highConfidenceCount() {
  return state.hotspots.filter(
    (hotspot) => String(hotspot.confidence).toLowerCase() === "high"
  ).length;
}

function highRiskCount() {
  let count = 0;
  state.riskByProvince.forEach((entry) => {
    const level = riskLevel(entry.index);
    if (level === "tinggi" || level === "ekstrem") count += 1;
  });
  return count;
}

function latestAcquisition() {
  const times = state.hotspots
    .map((hotspot) => new Date(hotspot.acq_date).getTime())
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
  setText("stat-high", highConfidenceCount().toLocaleString("id-ID"));
  setText("stat-risk", highRiskCount().toLocaleString("id-ID"));
  setText("stat-updated", latestAcquisition());
}

// Layer titik panas (hotspot) dari API FIRMS (via backend).
import { map } from "./map.js";
import { state, setState } from "./state.js";
import { escapeHtml, formatDateTime } from "./utils.js";

const CONFIDENCE_COLORS = {
  low: "#f0c266",
  nominal: "#ff8b4d",
  high: "#ff4d2e"
};

let hotspotLayer = null;

function confidenceColor(confidence) {
  return CONFIDENCE_COLORS[String(confidence).toLowerCase()] || "#e8843c";
}

function radiusForFrp(frp) {
  const value = Number(frp) || 0;
  return Math.min(4 + Math.sqrt(value) * 1.4, 16);
}

function popupHtml(hotspot) {
  const rows = [
    ["Koordinat", `${hotspot.latitude}, ${hotspot.longitude}`],
    ["Confidence", hotspot.confidence],
    ["FRP", hotspot.frp != null ? `${hotspot.frp} MW` : "—"],
    ["Waktu", formatDateTime(hotspot.acq_date)],
    ["Sumber", hotspot.source || "—"]
  ];

  const body = rows
    .map(
      ([label, value]) =>
        `<div class="hotspot-row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("");

  return `<div class="hotspot-popup"><h4>Fire Hotspot</h4>${body}</div>`;
}

export function renderHotspots(hotspots) {
  clearHotspots();
  setState({ hotspots }, "hotspots:loaded");

  hotspotLayer = L.layerGroup(
    hotspots.map((hotspot) =>
      L.circleMarker([hotspot.latitude, hotspot.longitude], {
        radius: radiusForFrp(hotspot.frp),
        color: confidenceColor(hotspot.confidence),
        weight: 1,
        fillColor: confidenceColor(hotspot.confidence),
        fillOpacity: 0.75
      }).bindPopup(popupHtml(hotspot))
    )
  );

  if (state.layers.hotspots) hotspotLayer.addTo(map);
}

export function clearHotspots() {
  if (hotspotLayer) {
    map.removeLayer(hotspotLayer);
    hotspotLayer = null;
  }
}

export function setHotspotsVisible(visible) {
  if (!hotspotLayer) return;
  if (visible && !map.hasLayer(hotspotLayer)) hotspotLayer.addTo(map);
  if (!visible && map.hasLayer(hotspotLayer)) map.removeLayer(hotspotLayer);
}

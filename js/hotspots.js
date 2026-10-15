// Layer titik panas dari backend (JAXA Himawari WLF via /api/fires).
import { map } from "./map.js";
import { state, setState } from "./state.js";
import { escapeHtml, formatDateTime } from "./utils.js";

const FIRE_LEVEL_COLORS = {
  1: "#d9b26b", // cold
  2: "#ff9a4d", // smoldering
  3: "#ff4d2e" // flaming
};

const FIRE_LEVEL_LABELS = {
  1: "Cold",
  2: "Smoldering",
  3: "Flaming"
};

let hotspotLayer = null;

function levelColor(level) {
  return FIRE_LEVEL_COLORS[Number(level)] || "#ff8b4d";
}

function radiusForFrp(frp) {
  const value = Number(frp) || 0;
  return Math.min(4 + Math.sqrt(value) * 1.4, 16);
}

function popupHtml(hotspot) {
  const level = Number(hotspot.fireLevel);
  const rows = [
    ["Koordinat", `${hotspot.latitude}, ${hotspot.longitude}`],
    ["Fire level", FIRE_LEVEL_LABELS[level] || "—"],
    ["Reliability", hotspot.reliability ?? "—"],
    ["FRP", hotspot.frp != null ? `${hotspot.frp} W/m²` : "—"],
    ["Luas", hotspot.area != null ? `${hotspot.area} km²` : "—"],
    ["Satelit", hotspot.satellite || "—"],
    ["Waktu", formatDateTime(hotspot.observedAt)],
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
        pane: "hotspots",
        radius: radiusForFrp(hotspot.frp),
        color: levelColor(hotspot.fireLevel),
        weight: 1,
        fillColor: levelColor(hotspot.fireLevel),
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

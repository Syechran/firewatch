// Modul UI: legend, toggle layer, tombol reset/clear, dan badge risiko.
import { COLORS, riskLevel, USE_MOCK } from "./config.js";
import { state, setState, subscribe } from "./state.js";
import { resetView } from "./map.js";
import { getProvinceLayer, clearSelection, refreshStyles } from "./provinces.js";
import { setHotspotsVisible } from "./hotspots.js";

export function initUI() {
  renderLegend();
  wireButtons();
  wireToggles();
  subscribe("province:selected", renderRiskBadge);
}

function renderLegend() {
  const legend = document.getElementById("map-legend");
  if (!legend) return;

  const order = ["rendah", "sedang", "tinggi", "ekstrem"];
  legend.querySelector("ul").innerHTML = order
    .map(
      (level) =>
        `<li><span class="legend-swatch" style="background:${COLORS.risk[level]}"></span>${level}</li>`
    )
    .join("");
}

function wireButtons() {
  document.getElementById("reset-map")?.addEventListener("click", () => {
    resetView(getProvinceLayer());
  });

  document.getElementById("clear-selection")?.addEventListener("click", clearSelection);
}

function wireToggles() {
  document.getElementById("toggle-risk")?.addEventListener("change", (event) => {
    setState({ layers: { ...state.layers, risk: event.target.checked } }, "layers:change");
    refreshStyles();
  });

  document
    .getElementById("toggle-hotspots")
    ?.addEventListener("change", (event) => {
      setState(
        { layers: { ...state.layers, hotspots: event.target.checked } },
        "layers:change"
      );
      setHotspotsVisible(event.target.checked);
    });
}

function renderRiskBadge(detail) {
  const badge = document.getElementById("province-risk");
  if (!badge) return;

  if (!detail || detail.index == null) {
    badge.textContent = "";
    badge.removeAttribute("data-level");
    return;
  }

  badge.textContent =
    detail.count != null
      ? `${detail.count} titik panas`
      : `${detail.level.toUpperCase()} · ${detail.index.toFixed(2)}`;
  badge.dataset.level = detail.level;
}

export function renderHotspotStatus(count) {
  const el = document.getElementById("hotspot-count");
  if (el) {
    el.textContent = `${count} titik panas`;
    el.dataset.level = riskLevel(Math.min(count / 500, 0.95));
  }
}

export function renderBackendStatus(online = null) {
  const el = document.getElementById("backend-status");
  if (!el) return;
  if (USE_MOCK) {
    el.textContent = "MOCK DATA";
  } else if (online === null) {
    el.textContent = "MENGHUBUNGKAN…";
  } else {
    el.textContent = online ? "LIVE" : "OFFLINE";
  }
}

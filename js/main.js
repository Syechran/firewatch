// Titik masuk aplikasi: memuat provinsi, titik panas, lalu menghitung
// kepadatan titik panas per provinsi untuk choropleth.
import { getHotspots, getHealth } from "./api.js";
import { state, setState } from "./state.js";
import { normalizeName } from "./utils.js";
import { loadProvinces, refreshStyles, getProvinceName } from "./provinces.js";
import { renderHotspots } from "./hotspots.js";
import { countPointsByProvince } from "./geo.js";
import { initSearch } from "./search.js";
import { initPlaceStatus } from "./status-popup.js";
import { initNotifications } from "./notify.js";
import { initUI, renderHotspotStatus, renderBackendStatus } from "./ui.js";
import { initStats } from "./stats.js";
import { initChecklist } from "./checklist.js";
import { initReport } from "./report.js";

initUI();
initSearch();
initPlaceStatus();
initNotifications();
renderBackendStatus();
initStats();
initChecklist();
initReport();

async function bootstrap() {
  checkBackend();

  await loadProvinces();

  let hotspots = [];
  try {
    hotspots = await getHotspots({ hari: 1 });
    renderHotspots(hotspots);
    renderHotspotStatus(hotspots.length);
  } catch (error) {
    console.error("Gagal memuat titik panas:", error);
    renderHotspotStatus(0);
  }

  applyProvinceDensity(hotspots);
}

async function checkBackend() {
  try {
    await getHealth();
    renderBackendStatus(true);
  } catch {
    renderBackendStatus(false);
  }
}

function applyProvinceDensity(hotspots) {
  const geojson = state.provincesGeoJSON;
  const riskByProvince = new Map();

  if (geojson && hotspots.length) {
    const { counts } = countPointsByProvince(geojson, hotspots, getProvinceName);
    const max = Math.max(1, ...counts.values());

    geojson.features.forEach((feature) => {
      const name = getProvinceName(feature);
      const count = counts.get(name) || 0;
      riskByProvince.set(normalizeName(name), {
        provinsi: name,
        count,
        index: count / max
      });
    });
  }

  setState({ riskByProvince }, "risk:loaded");
  refreshStyles();
}

bootstrap();

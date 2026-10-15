// Titik masuk aplikasi: memuat provinsi, risiko, dan titik panas.
import { getProvinceRisk, getHotspots } from "./api.js";
import { setState } from "./state.js";
import { normalizeName } from "./utils.js";
import { loadProvinces, refreshStyles } from "./provinces.js";
import { renderHotspots } from "./hotspots.js";
import { initSearch } from "./search.js";
import { initUI, renderHotspotStatus, renderBackendStatus } from "./ui.js";
import { initStats } from "./stats.js";
import { initChecklist } from "./checklist.js";
import { initReport } from "./report.js";

initUI();
initSearch();
renderBackendStatus();
initStats();
initChecklist();
initReport();

async function bootstrap() {
  const [, riskResult] = await Promise.allSettled([loadProvinces(), getProvinceRisk()]);

  if (riskResult.status === "fulfilled") {
    const riskByProvince = new Map();

    riskResult.value.forEach((row) => {
      const name = row.provinsi ?? row.province ?? row.name;
      const index = row.index ?? row.indeks ?? row.risiko;
      if (!name || index == null) return;
      riskByProvince.set(normalizeName(name), { provinsi: name, ...row, index });
    });

    setState({ riskByProvince }, "risk:loaded");
    refreshStyles();
  } else {
    console.error("Gagal memuat indeks risiko:", riskResult.reason);
  }

  try {
    const hotspots = await getHotspots({ hari: 1 });
    renderHotspots(hotspots);
    renderHotspotStatus(hotspots.length);
  } catch (error) {
    console.error("Gagal memuat titik panas:", error);
    renderHotspotStatus(0);
  }
}

bootstrap();

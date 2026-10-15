// Form laporan warga. Endpoint laporan belum ada di backend
// (REPORTS_ENABLED=false), tetapi laporan bisa dicek terhadap titik panas
// di sekitarnya (radius 5 km, mengikuti LaporanWarga.Verifikasi SiagaApi).
import { map } from "./map.js";
import { postLaporan } from "./api.js";
import { REPORTS_ENABLED } from "./config.js";
import { state } from "./state.js";
import { verifyNearbyHotspots } from "./risk.js";

const MATCH_RADIUS_KM = 5;

export function initReport() {
  const form = document.getElementById("report-form");
  if (!form) return;

  const lat = document.getElementById("report-lat");
  const lng = document.getElementById("report-lng");
  const note = document.getElementById("report-note");
  const status = document.getElementById("report-status");
  const submit = document.getElementById("report-submit");

  function refreshVerification() {
    const la = Number(lat.value);
    const lo = Number(lng.value);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return;

    if (!state.hotspots.length) {
      status.dataset.state = "";
      status.textContent = "Data titik panas belum termuat.";
      return;
    }

    const check = verifyNearbyHotspots(la, lo, state.hotspots, MATCH_RADIUS_KM);
    const nearest = check.nearest
      ? ` Terdekat ${check.nearest.distanceKm.toFixed(1)} km.`
      : "";

    if (check.matched) {
      status.dataset.state = "verified";
      status.textContent = `Terverifikasi: ${check.count} titik panas dalam ${MATCH_RADIUS_KM} km.${nearest}`;
    } else {
      status.dataset.state = "unverified";
      status.textContent = `Belum ada titik panas dalam ${MATCH_RADIUS_KM} km.${nearest}`;
    }
  }

  // Klik peta mengisi koordinat laporan lalu mengecek kedekatan titik panas.
  map.on("click", (event) => {
    lat.value = event.latlng.lat.toFixed(5);
    lng.value = event.latlng.lng.toFixed(5);
    refreshVerification();
  });
  lat.addEventListener("change", refreshVerification);
  lng.addEventListener("change", refreshVerification);

  if (!REPORTS_ENABLED) {
    submit.disabled = true;
    status.textContent =
      "Endpoint laporan belum tersedia — klik peta untuk memeriksa kedekatan dengan titik panas (radius 5 km).";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    submit.disabled = true;
    status.textContent = "Mengirim laporan…";

    try {
      await postLaporan({
        latitude: Number(lat.value),
        longitude: Number(lng.value),
        keterangan: note.value.trim()
      });

      status.textContent = "Laporan terkirim. Terima kasih.";
      form.reset();
    } catch (error) {
      console.error("Gagal mengirim laporan:", error);
      status.textContent = "Gagal mengirim laporan. Periksa koneksi lalu coba lagi.";
    } finally {
      submit.disabled = false;
    }
  });
}

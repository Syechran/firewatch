// Form laporan warga: mengirim ke postLaporan(). Koordinat bisa diisi
// dengan mengklik peta.
import { map } from "./map.js";
import { postLaporan } from "./api.js";

export function initReport() {
  const form = document.getElementById("report-form");
  if (!form) return;

  const lat = document.getElementById("report-lat");
  const lng = document.getElementById("report-lng");
  const note = document.getElementById("report-note");
  const status = document.getElementById("report-status");
  const submit = document.getElementById("report-submit");

  // Klik peta mengisi koordinat laporan.
  map.on("click", (event) => {
    lat.value = event.latlng.lat.toFixed(5);
    lng.value = event.latlng.lng.toFixed(5);
    status.textContent = "Koordinat diisi dari peta.";
  });

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

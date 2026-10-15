// UI simulasi sebaran api: menjalankan mesin di js/spread.js dan menggambar
// hasilnya sebagai overlay peta. EKSPERIMENTAL — belum tervalidasi.
import { map } from "./map.js";
import { state } from "./state.js";
import { runSpreadSimulation } from "./spread.js";

let context = null;
let layer = null;

export function initSimulation() {
  document.getElementById("simulate-button")?.addEventListener("click", run);
  document.getElementById("simulate-clear")?.addEventListener("click", () => {
    clear();
    setStatus("Overlay simulasi dihapus.");
  });
}

export function setSimulationContext(nextContext) {
  context = nextContext;
  clear();
  setStatus("");
}

export function clearSimulation() {
  clear();
}

function setStatus(text) {
  const el = document.getElementById("simulate-status");
  if (el) el.textContent = text;
}

function clear() {
  if (layer) {
    map.removeLayer(layer);
    layer = null;
  }
}

function run() {
  if (!context) return;

  const result = runSpreadSimulation({
    center: { lat: context.place.lat, lon: context.place.lng },
    hotspots: state.hotspots,
    weather: context.weather
  });

  clear();

  if (!result) {
    setStatus("Simulasi tidak dapat dijalankan.");
    return;
  }
  if (!result.ok) {
    setStatus(
      result.reason === "no-ignition"
        ? "Tidak ada titik api aktif (level >= 2) dalam radius simulasi."
        : "Tidak ada titik panas dalam radius simulasi."
    );
    return;
  }

  layer = render(result);
  setStatus(
    `Perkiraan ${result.hours} langkah: ${result.burnedCells} sel terdampak ` +
      `(dari ${result.ignitionCells} sel pemicu). Hasil eksperimental, belum tervalidasi.`
  );
}

function render(result) {
  const { baris, kolom, status, bounds } = result;
  const canvas = document.createElement("canvas");
  canvas.width = kolom;
  canvas.height = baris;

  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(kolom, baris);

  for (let b = 0; b < baris; b += 1) {
    for (let k = 0; k < kolom; k += 1) {
      const cell = status[b * kolom + k];
      if (cell === 0) continue;
      // Baris 0 = selatan (latMin); kanvas baris 0 = atas (utara) -> flip.
      const y = baris - 1 - b;
      const i = (y * kolom + k) * 4;
      image.data[i] = 255; // R
      image.data[i + 1] = cell === 1 ? 130 : 70; // G
      image.data[i + 2] = 40; // B
      image.data[i + 3] = cell === 1 ? 200 : 120; // A (terbakar lebih tegas)
    }
  }

  ctx.putImageData(image, 0, 0);

  return L.imageOverlay(canvas.toDataURL(), bounds, {
    pane: "simulation",
    opacity: 0.55,
    interactive: false
  }).addTo(map);
}

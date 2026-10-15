// Popup status lokasi yang tampil ke user DI LUAR peta (overlay halaman).
// Dipicu dari js/search.js setelah alamat ditemukan.
import { FIRE_STATUS_META, SMOKE_NOTES } from "./config.js";
import { compassPoint } from "./weather.js";

const FIRE_LEVEL_LABELS = { 1: "Cold", 2: "Smoldering", 3: "Flaming" };

const root = document.getElementById("place-status");
const card = root?.querySelector(".place-status-card");
const titleEl = document.getElementById("place-status-title");
const descEl = document.getElementById("place-status-desc");
const placeEl = document.getElementById("place-status-place");
const nearestEl = document.getElementById("place-status-nearest");
const nearEl = document.getElementById("place-status-near");
const smokeEl = document.getElementById("place-status-smoke");
const smokeNoteEl = document.getElementById("place-status-smoke-note");
const levelEl = document.getElementById("place-status-level");
const windEl = document.getElementById("place-status-wind");
const riskEl = document.getElementById("place-status-risk");

let lastFocused = null;

export function initPlaceStatus() {
  if (!root) return;

  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) hidePlaceStatus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !root.hidden) hidePlaceStatus();
  });
}

export function showPlaceStatus({
  place,
  assessment,
  weather = null,
  risk = null,
  dataAvailable = true
}) {
  if (!root || !card) return;

  const meta = FIRE_STATUS_META[assessment.level] ?? FIRE_STATUS_META.aman;

  card.dataset.level = assessment.level;
  titleEl.textContent = meta.label;
  descEl.textContent = dataAvailable
    ? meta.description
    : "Data titik panas belum termuat, jadi status belum dapat dinilai.";

  placeEl.textContent = place?.display_name || "";

  if (assessment.nearest) {
    nearestEl.textContent = `${assessment.nearest.distanceKm.toFixed(1)} km`;
  } else {
    nearestEl.textContent = "—";
  }

  nearEl.textContent = `${assessment.activeWithinEvacuate} titik`;

  const smoke = assessment.smoke ?? { level: "none", withinRadius: 0 };
  smokeEl.textContent = `${smoke.withinRadius} titik`;

  if (smoke.level === "none") {
    smokeNoteEl.hidden = true;
    smokeNoteEl.textContent = "";
    smokeNoteEl.removeAttribute("data-level");
  } else {
    smokeNoteEl.hidden = false;
    smokeNoteEl.dataset.level = smoke.level;
    let note = SMOKE_NOTES[smoke.level] || "";
    if (smoke.directional) {
      note += " Arah diperhitungkan dari angin.";
    }
    if (Number.isFinite(weather?.pm25)) {
      note += ` PM2.5 sekitar: ${Math.round(weather.pm25)} µg/m³.`;
    }
    smokeNoteEl.textContent = note;
  }

  levelEl.textContent =
    FIRE_LEVEL_LABELS[assessment.highestLevel] ||
    (assessment.highestLevel ? `L${assessment.highestLevel}` : "—");

  // Arah & kecepatan angin (meteorologis: arah DARI mana angin bertiup).
  if (weather && Number.isFinite(weather.windSpeedKmh)) {
    windEl.textContent = `${Math.round(weather.windSpeedKmh)} km/j · dari ${compassPoint(
      weather.windDirectionDeg
    )}`;
  } else {
    windEl.textContent = "—";
  }

  // Skor risiko multi-faktor (kelembapan + angin + jumlah titik panas).
  if (risk) {
    riskEl.textContent = `${risk.score}/100 · ${risk.label}`;
    riskEl.dataset.band = risk.band;
  } else {
    riskEl.textContent = "—";
    riskEl.removeAttribute("data-band");
  }

  lastFocused = document.activeElement;
  root.hidden = false;
  root.querySelector(".place-status-close")?.focus();
}

export function hidePlaceStatus() {
  if (!root || root.hidden) return;
  root.hidden = true;
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

// Pencarian alamat memakai Nominatim (sementara, sampai backend mem-proxy).
import { map } from "./map.js";
import { FIRE_STATUS, NOMINATIM_URL, SEARCH_THROTTLE_MS } from "./config.js";
import { escapeHtml } from "./utils.js";
import { state } from "./state.js";
import { assessLocation } from "./risk.js";
import { showPlaceStatus } from "./status-popup.js";
import { notifyStatus } from "./notify.js";

const form = document.getElementById("address-search-form");
const input = document.getElementById("address-input");
const status = document.getElementById("address-search-status");
const button = document.getElementById("address-search-button");

let marker = null;
let smokeLayer = null;
let lastSearch = 0;

export function initSearch() {
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const query = input.value.trim();
    if (!query) return;

    const elapsed = Date.now() - lastSearch;
    if (elapsed < SEARCH_THROTTLE_MS) {
      status.textContent = "Mohon tunggu sebentar sebelum mencari lagi.";
      return;
    }

    lastSearch = Date.now();
    button.disabled = true;
    status.textContent = "Mencari lokasi…";

    try {
      const place = await geocode(query);
      focusPlace(place);
      drawSmokeZone(place);
      status.textContent = `Lokasi ditemukan: ${place.display_name}`;

      const assessment = assessLocation(
        place.lat,
        place.lng,
        state.hotspots
      );
      showPlaceStatus({
        place,
        assessment,
        dataAvailable: state.hotspots.length > 0
      });
      notifyStatus({
        place,
        assessment,
        dataAvailable: state.hotspots.length > 0
      });
    } catch (error) {
      console.error("Address search failed:", error);
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function geocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "id"
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { Accept: "application/json", "Accept-Language": "en" }
  });

  if (!response.ok) {
    throw new Error("Layanan lokasi sedang tidak tersedia. Coba lagi.");
  }

  const results = await response.json();
  if (!results.length) {
    throw new Error("Lokasi tidak ditemukan di Indonesia. Coba alamat lain.");
  }

  const place = results[0];
  const lat = Number(place.lat);
  const lng = Number(place.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Lokasi mengembalikan koordinat yang tidak valid.");
  }

  return { ...place, lat, lng };
}

function focusPlace(place) {
  map.flyTo([place.lat, place.lng], 14, { duration: 1.2 });

  if (marker) map.removeLayer(marker);
  // Popup status ditampilkan di luar peta (js/status-popup.js); marker peta
  // cukup menandai titik dan menampilkan nama saat diklik.
  marker = L.marker([place.lat, place.lng]).addTo(map);
  marker.bindPopup(`<strong>${escapeHtml(place.display_name)}</strong>`);
}

// Zona asap (perkiraan radial): api di dalam radius ini bisa membuat udara
// di lokasi tercemar asap/kabut. Belum memperhitungkan arah angin.
function drawSmokeZone(place) {
  if (smokeLayer) {
    map.removeLayer(smokeLayer);
    smokeLayer = null;
  }

  const zones = [
    { radiusKm: FIRE_STATUS.smokeRadiusKm, color: "#ffb26b", fillOpacity: 0.04 },
    {
      radiusKm: FIRE_STATUS.smokeDenseRadiusKm,
      color: "#ff7a3d",
      fillOpacity: 0.07
    }
  ];

  smokeLayer = L.layerGroup(
    zones.map(
      (zone) =>
        L.circle([place.lat, place.lng], {
          pane: "zones",
          radius: zone.radiusKm * 1000,
          color: zone.color,
          weight: 1,
          dashArray: "5 6",
          fillColor: zone.color,
          fillOpacity: zone.fillOpacity,
          interactive: false
        })
    )
  ).addTo(map);
}

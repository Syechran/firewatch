// Pencarian alamat memakai Nominatim (sementara, sampai backend mem-proxy).
import { map } from "./map.js";
import { NOMINATIM_URL, SEARCH_THROTTLE_MS } from "./config.js";
import { escapeHtml } from "./utils.js";

const form = document.getElementById("address-search-form");
const input = document.getElementById("address-input");
const status = document.getElementById("address-search-status");
const button = document.getElementById("address-search-button");

let marker = null;
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
      status.textContent = `Lokasi ditemukan: ${place.display_name}`;
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
  marker = L.marker([place.lat, place.lng]).addTo(map);
  marker.bindPopup(`<strong>${escapeHtml(place.display_name)}</strong>`).openPopup();
}

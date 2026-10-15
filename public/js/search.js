// Pencarian alamat memakai Nominatim (sementara, sampai backend mem-proxy).
import { map } from "./map.js";
import { FIRE_STATUS, NOMINATIM_URL, SEARCH_THROTTLE_MS } from "./config.js";
import { escapeHtml } from "./utils.js";
import { state } from "./state.js";
import { assessLocation, riskIndex } from "./risk.js";
import { getWeather } from "./weather.js";
import { showPlaceStatus } from "./status-popup.js";
import { notifyStatus } from "./notify.js";
import { setSimulationContext } from "./simulation.js";

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
      status.textContent = "Mengambil data cuaca…";

      const weather = await getWeather(place.lat, place.lng);
      const dataAvailable = state.hotspots.length > 0;

      const assessment = assessLocation(place.lat, place.lng, state.hotspots, {
        weather
      });
      const risk = riskIndex({
        humidity: weather?.humidity,
        windSpeedKmh: weather?.windSpeedKmh,
        hotspotCount: assessment.withinWatch
      });

      drawSmokeZone(place, weather);
      setSimulationContext({ place, weather });

      status.textContent = `Lokasi ditemukan: ${place.display_name}`;
      showPlaceStatus({ place, assessment, weather, risk, dataAvailable });
      notifyStatus({ place, assessment, dataAvailable });
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

// Titik tujuan dari (lat, lon) menurut bearing (derajat) & jarak (km).
function destinationPoint(lat, lon, bearing, distanceKm) {
  const radius = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const delta = distanceKm / radius;
  const theta = toRad(bearing);
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [toDeg(phi2), toDeg(lambda2)];
}

// Poligon sektor (kerucut) untuk plume asap yang berarah.
function sector(place, centerBearing, halfAngleDeg, radiusKm, steps = 28) {
  const points = [[place.lat, place.lng]];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = centerBearing - halfAngleDeg + (2 * halfAngleDeg * i) / steps;
    points.push(destinationPoint(place.lat, place.lng, bearing, radiusKm));
  }
  points.push([place.lat, place.lng]);
  return points;
}

// Zona asap. Bila ada angin: plume berarah (kerucut searah angin bertiup).
// Bila tidak ada: cincin radial seperti sebelumnya.
function drawSmokeZone(place, weather) {
  if (smokeLayer) {
    map.removeLayer(smokeLayer);
    smokeLayer = null;
  }

  const hasWind = Boolean(weather) && Number.isFinite(weather.windDirectionDeg);
  const shapes = [];

  if (hasWind) {
    const toward = (weather.windDirectionDeg + 180) % 360;
    shapes.push(
      L.polygon(
        sector(place, toward, 32, FIRE_STATUS.smokeDenseRadiusKm),
        {
          pane: "zones",
          color: "#ff7a3d",
          weight: 1,
          dashArray: "5 6",
          fillColor: "#ff7a3d",
          fillOpacity: 0.1,
          interactive: false
        }
      ),
      L.polygon(sector(place, toward, 42, FIRE_STATUS.smokeRadiusKm), {
        pane: "zones",
        color: "#ffb26b",
        weight: 1,
        dashArray: "5 6",
        fillColor: "#ffb26b",
        fillOpacity: 0.05,
        interactive: false
      })
    );
  } else {
    const zones = [
      { radiusKm: FIRE_STATUS.smokeRadiusKm, color: "#ffb26b", fillOpacity: 0.04 },
      {
        radiusKm: FIRE_STATUS.smokeDenseRadiusKm,
        color: "#ff7a3d",
        fillOpacity: 0.07
      }
    ];
    zones.forEach((zone) =>
      shapes.push(
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
    );
  }

  smokeLayer = L.layerGroup(shapes).addTo(map);
}

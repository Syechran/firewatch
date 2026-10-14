const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: true,
  minZoom: 4,
  maxZoom: 12,
  zoomSnap: 0.25
});

// Terrain-style geographic basemap.
const terrainLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 12,
    attribution:
      'Tiles &copy; Esri — Sources: Esri, Garmin, USGS, NOAA, OpenStreetMap contributors'
  }
).addTo(map);

// A broad initial view while the province data loads.
map.setView([-2.5, 118], 4.5);

const provinceUrl =
  "https://raw.githubusercontent.com/denyherianto/indonesia-geojson-topojson-maps-with-38-provinces/main/GeoJSON/indonesia-38-provinces.geojson";

const defaultStyle = {
  color: "#f0f0d9",
  weight: 1,
  opacity: 0.9,
  fillColor: "#92b39a",
  fillOpacity: 0.22
};

const hoverStyle = {
  color: "#f8ffdb",
  weight: 2,
  opacity: 1,
  fillColor: "#e8f59b",
  fillOpacity: 0.75
};

const selectedStyle = {
  color: "#ffffff",
  weight: 2.5,
  opacity: 1,
  fillColor: "#c8eb66",
  fillOpacity: 0.85
};

let provinceLayer = null;
let selectedLayer = null;
let selectedFeature = null;
let hoveredLayer = null;

const provinceName = document.getElementById("province-name");
const provinceCode = document.getElementById("province-code");
const provinceCount = document.getElementById("province-count");

function getProvinceName(feature) {
  return (
    feature?.properties?.PROVINSI ||
    feature?.properties?.province ||
    feature?.properties?.name ||
    "Unknown province"
  );
}

function getProvinceCode(feature) {
  return (
    feature?.properties?.KODE_PROV ||
    feature?.properties?.id ||
    "—"
  );
}

function updateSelection(feature) {
  if (!feature) {
    provinceName.textContent = "No province selected";
    provinceCode.textContent = "Click a province on the map";
    return;
  }

  provinceName.textContent = getProvinceName(feature);
  provinceCode.textContent = `Province code: ${getProvinceCode(feature)}`;
}

function resetLayerStyle(layer) {
  if (!layer) return;

  if (layer === selectedLayer) {
    layer.setStyle(selectedStyle);
  } else {
    layer.setStyle(defaultStyle);
  }
}

function handleProvinceClick(event, feature) {
  const layer = event.target;

  // Restore the previous selection.
  if (selectedLayer && selectedLayer !== layer) {
    selectedLayer.setStyle(defaultStyle);
  }

  selectedLayer = layer;
  selectedFeature = feature;

  layer.setStyle(selectedStyle);
  layer.bringToFront();

  updateSelection(feature);
}

function handleProvinceHover(event) {
  const layer = event.target;
  hoveredLayer = layer;

  if (layer !== selectedLayer) {
    layer.setStyle(hoverStyle);
    layer.bringToFront();
  }
}

function handleProvinceMouseOut(event) {
  const layer = event.target;

  if (hoveredLayer === layer) {
    hoveredLayer = null;
  }

  resetLayerStyle(layer);
}

function onEachProvince(feature, layer) {
  const name = getProvinceName(feature);

  // Permanent geographic labels.
  layer.bindTooltip(name, {
    permanent: true,
    direction: "center",
    className: "province-label",
    opacity: 0.95
  });

  layer.on({
    mouseover: handleProvinceHover,
    mouseout: handleProvinceMouseOut,
    click: (event) => handleProvinceClick(event, feature)
  });
}

async function loadProvinces() {
  provinceName.textContent = "Loading provinces…";
  provinceCode.textContent = "Fetching geographic boundaries";

  try {
    const response = await fetch(provinceUrl);

    if (!response.ok) {
      throw new Error(`GeoJSON request failed: ${response.status}`);
    }

    const geojson = await response.json();

    if (!geojson.features || geojson.features.length === 0) {
      throw new Error("No province boundaries were found.");
    }

    provinceLayer = L.geoJSON(geojson, {
      style: () => ({ ...defaultStyle }),
      onEachFeature: onEachProvince
    }).addTo(map);

    const bounds = provinceLayer.getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 6
      });
    }

    provinceCount.textContent =
      `${geojson.features.length} provinces available`;

    updateSelection(null);
  } catch (error) {
    console.error("Could not load province boundaries:", error);

    provinceName.textContent = "Map data unavailable";
    provinceCode.textContent =
      "Check your internet connection and reload the page.";

    provinceCount.textContent = "Unable to load provinces";
  }
}

const addressForm = document.getElementById("address-search-form");
const addressInput = document.getElementById("address-input");
const addressStatus = document.getElementById("address-search-status");
const addressSearchButton = document.getElementById("address-search-button");

let addressMarker = null;
let lastAddressSearch = 0;

addressForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = addressInput.value.trim();

  if (!query) return;

  // Avoid searching too frequently on the public geocoding service.
  const elapsed = Date.now() - lastAddressSearch;

  if (elapsed < 1100) {
    addressStatus.textContent =
      "Please wait a moment before searching again.";
    return;
  }

  lastAddressSearch = Date.now();
  addressSearchButton.disabled = true;
  addressStatus.textContent = "Searching for your location…";

  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      countrycodes: "id"
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          "Accept": "application/json",
          "Accept-Language": "en"
        }
      }
    );

    if (!response.ok) {
      throw new Error("The location service is temporarily unavailable.");
    }

    const results = await response.json();

    if (!results.length) {
      addressStatus.textContent =
        "No matching location found in Indonesia. Try another address.";
      return;
    }

    const place = results[0];
    const lat = Number(place.lat);
    const lng = Number(place.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("The location returned invalid coordinates.");
    }

    // Move and zoom the map to the result.
    map.flyTo([lat, lng], 14, {
      duration: 1.2
    });

    // Replace the previous search marker.
    if (addressMarker) {
      map.removeLayer(addressMarker);
    }

    addressMarker = L.marker([lat, lng]).addTo(map);

    addressMarker.bindPopup(
      `<strong>${escapeHtml(place.display_name)}</strong>`
    ).openPopup();

    addressStatus.textContent =
      `Location found: ${place.display_name}`;
  } catch (error) {
    console.error("Address search failed:", error);

    addressStatus.textContent =
      "Could not complete the search. Check your connection and try again.";
  } finally {
    addressSearchButton.disabled = false;
  }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Reset the map position and zoom.
document.getElementById("reset-map").addEventListener("click", () => {
  if (provinceLayer && provinceLayer.getBounds().isValid()) {
    map.fitBounds(provinceLayer.getBounds(), {
      padding: [35, 35],
      maxZoom: 6
    });
  }
});

// Clear the active province selection.
document
  .getElementById("clear-selection")
  .addEventListener("click", () => {
    if (selectedLayer) {
      selectedLayer.setStyle(defaultStyle);
    }

    selectedLayer = null;
    selectedFeature = null;
    updateSelection(null);
  });

loadProvinces();
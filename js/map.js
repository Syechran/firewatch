// Inisialisasi peta Leaflet dan basemap.
import {
  MAP_HOME_CENTER,
  MAP_HOME_ZOOM,
  MAP_BOUNDS_PADDING,
  MAP_FIT_MAX_ZOOM
} from "./config.js";

export const map = L.map("map", {
  zoomControl: true,
  scrollWheelZoom: true,
  minZoom: 4,
  maxZoom: 12,
  zoomSnap: 0.25
});

// Basemap topografi.
L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 12,
    attribution:
      "Tiles &copy; Esri — Sources: Esri, Garmin, USGS, NOAA, OpenStreetMap contributors"
  }
).addTo(map);

// Tampilan awal sementara data dimuat.
map.setView(MAP_HOME_CENTER, MAP_HOME_ZOOM);

export function fitToLayer(layer) {
  if (!layer) return;
  const bounds = layer.getBounds?.();
  if (bounds && bounds.isValid()) {
    map.fitBounds(bounds, { padding: MAP_BOUNDS_PADDING, maxZoom: MAP_FIT_MAX_ZOOM });
  }
}

export function resetView(layer) {
  fitToLayer(layer);
}

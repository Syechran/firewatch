// Modul provinsi: memuat batas wilayah, mewarnai berdasarkan risiko,
// dan menangani interaksi pilih/hover.
import { map, fitToLayer } from "./map.js";
import { state, setState, emit } from "./state.js";
import {
  PROVINCE_STYLE,
  PROVINCE_GEOJSON_URL,
  GEOJSON_CACHE_KEY,
  GEOJSON_CACHE_TTL_MS,
  riskColor,
  riskLevel,
  USE_MOCK
} from "./config.js";
import { normalizeName } from "./utils.js";
import { fallbackRiskIndex } from "./api.js";

let provinceLayer = null;
let selectedLayer = null;

const provinceNameEl = document.getElementById("province-name");
const provinceCodeEl = document.getElementById("province-code");
const provinceCountEl = document.getElementById("province-count");

export function getProvinceName(feature) {
  return (
    feature?.properties?.PROVINSI ||
    feature?.properties?.province ||
    feature?.properties?.name ||
    "Unknown province"
  );
}

export function getProvinceCode(feature) {
  return feature?.properties?.KODE_PROV || feature?.properties?.id || "—";
}

function riskForFeature(feature) {
  const entry = state.riskByProvince.get(normalizeName(getProvinceName(feature)));
  if (entry) return entry.index;
  return USE_MOCK ? fallbackRiskIndex(getProvinceName(feature)) : null;
}

function baseStyleForFeature(feature) {
  const style = { ...PROVINCE_STYLE.default };
  const index = riskForFeature(feature);

  if (state.layers.risk && index != null) {
    style.fillColor = riskColor(index);
    style.fillOpacity = 0.6;
  }

  return style;
}

function applyLayerStyle(layer) {
  const feature = layer._firewatchFeature;
  if (layer === selectedLayer) {
    layer.setStyle(PROVINCE_STYLE.selected);
  } else {
    layer.setStyle(baseStyleForFeature(feature));
  }
}

export function refreshStyles() {
  if (!provinceLayer) return;
  provinceLayer.eachLayer((layer) => applyLayerStyle(layer));
}

function selectionDetail(feature) {
  if (!feature) return null;
  const index = riskForFeature(feature);
  return {
    provinsi: getProvinceName(feature),
    code: getProvinceCode(feature),
    index,
    level: index != null ? riskLevel(index) : null
  };
}

function updateSelection(feature) {
  const detail = selectionDetail(feature);

  if (!detail) {
    provinceNameEl.textContent = "No province selected";
    provinceCodeEl.textContent = "Click a province on the map";
    emit("province:selected", null);
    return;
  }

  provinceNameEl.textContent = detail.provinsi;
  provinceCodeEl.textContent = `Province code: ${detail.code}`;
  emit("province:selected", detail);
}

function handleClick(event, feature) {
  const layer = event.target;

  if (selectedLayer && selectedLayer !== layer) {
    applyLayerStyle(selectedLayer);
  }

  selectedLayer = layer;
  setState({ selectedProvince: selectionDetail(feature) }, "province:selected");

  layer.setStyle(PROVINCE_STYLE.selected);
  layer.bringToFront();
  updateSelection(feature);
}

function handleHover(event) {
  const layer = event.target;
  if (layer !== selectedLayer) {
    layer.setStyle(PROVINCE_STYLE.hover);
    layer.bringToFront();
  }
}

function handleMouseOut(event) {
  applyLayerStyle(event.target);
}

function onEachProvince(feature, layer) {
  layer._firewatchFeature = feature;

  layer.bindTooltip(getProvinceName(feature), {
    permanent: true,
    direction: "center",
    className: "province-label",
    opacity: 0.95
  });

  layer.on({
    mouseover: handleHover,
    mouseout: handleMouseOut,
    click: (event) => handleClick(event, feature)
  });
}

function readCache() {
  try {
    const raw = localStorage.getItem(GEOJSON_CACHE_KEY);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > GEOJSON_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(
      GEOJSON_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), data })
    );
  } catch {
    // Abaikan bila storage penuh / tidak tersedia.
  }
}

async function fetchProvinces() {
  const cached = readCache();
  if (cached) return cached;

  const response = await fetch(PROVINCE_GEOJSON_URL);
  if (!response.ok) {
    throw new Error(`GeoJSON request failed: ${response.status}`);
  }

  const geojson = await response.json();
  writeCache(geojson);
  return geojson;
}

export async function loadProvinces() {
  provinceNameEl.textContent = "Loading provinces…";
  provinceCodeEl.textContent = "Fetching geographic boundaries";

  try {
    const geojson = await fetchProvinces();

    if (!geojson.features?.length) {
      throw new Error("No province boundaries were found.");
    }

    provinceLayer = L.geoJSON(geojson, {
      style: (feature) => baseStyleForFeature(feature),
      onEachFeature: onEachProvince
    }).addTo(map);

    setState({ provincesGeoJSON: geojson }, "provinces:loaded");

    fitToLayer(provinceLayer);

    provinceCountEl.textContent = `${geojson.features.length} provinces available`;
    updateSelection(null);
  } catch (error) {
    console.error("Could not load province boundaries:", error);
    provinceNameEl.textContent = "Map data unavailable";
    provinceCodeEl.textContent = "Check your internet connection and reload the page.";
    provinceCountEl.textContent = "Unable to load provinces";
  }
}

export function getProvinceLayer() {
  return provinceLayer;
}

export function clearSelection() {
  if (selectedLayer) applyLayerStyle(selectedLayer);
  selectedLayer = null;
  setState({ selectedProvince: null }, "province:selected");
  updateSelection(null);
}

// Geometri ringan: menetapkan tiap titik panas ke provinsi lewat
// point-in-polygon (ray casting), dipakai untuk choropleth tanpa endpoint
// risiko dari backend.

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function bboxOf(polygons) {
  const bbox = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity };
  polygons.forEach((polygon) =>
    polygon.forEach((ring) =>
      ring.forEach(([lng, lat]) => {
        if (lng < bbox.minLng) bbox.minLng = lng;
        if (lng > bbox.maxLng) bbox.maxLng = lng;
        if (lat < bbox.minLat) bbox.minLat = lat;
        if (lat > bbox.maxLat) bbox.maxLat = lat;
      })
    )
  );
  return bbox;
}

// Ray casting untuk satu ring (array [lng, lat]).
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [lngI, latI] = ring[i];
    const [lngJ, latJ] = ring[j];
    const intersects =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Sebuah polygon GeoJSON = [ring luar, ...lubang].
function inPolygon(lng, lat, polygon) {
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
}

/**
 * Tetapkan titik ke provinsi.
 * @param {object} geojson FeatureCollection provinsi
 * @param {Array} points daftar { latitude, longitude }
 * @param {(feature: object) => string} nameOf pengambil nama provinsi
 * @returns {{ counts: Map<string, number> }}
 */
export function countPointsByProvince(geojson, points, nameOf) {
  const regions = [];

  for (const feature of geojson.features || []) {
    const polygons = polygonsOf(feature.geometry);
    if (!polygons.length) continue;
    regions.push({ name: nameOf(feature), polygons, bbox: bboxOf(polygons) });
  }

  const counts = new Map();

  for (const point of points) {
    const lng = point.longitude;
    const lat = point.latitude;

    for (const region of regions) {
      const { bbox } = region;
      if (lng < bbox.minLng || lng > bbox.maxLng || lat < bbox.minLat || lat > bbox.maxLat) {
        continue;
      }
      if (region.polygons.some((polygon) => inPolygon(lng, lat, polygon))) {
        counts.set(region.name, (counts.get(region.name) || 0) + 1);
        break;
      }
    }
  }

  return { counts };
}

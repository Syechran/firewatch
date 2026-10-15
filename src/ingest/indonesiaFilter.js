/**
 * Indonesia bounding box filter.
 * bbox: { minLon, minLat, maxLon, maxLat }
 */
export function inBbox(lat, lon, bbox) {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

export function filterIndonesia(hotspots, bbox) {
  return hotspots.filter((h) => inBbox(h.lat, h.lon, bbox));
}

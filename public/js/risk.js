// Penilaian status kebakaran untuk sebuah lokasi (Find a Place).
// Dua dimensi: kedekatan API (flaming/smoldering) dan jangkauan ASAP/KABUT.
// Asap bisa terbawa jauh melampaui api, jadi lokasi yang "aman" dari api tetap
// bisa berisiko bila berada di zona asap. Semua berbasis jarak radial —
// belum memperhitungkan arah/kecepatan angin (data belum tersedia).
import { FIRE_STATUS } from "./config.js";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {Array} hotspots daftar titik panas ternormalisasi (js/api.js)
 * @returns {{
 *   level: "aman"|"asap"|"siaga"|"evakuasi"|"larikan_diri",
 *   nearest: object|null,
 *   highestLevel: number,
 *   withinWatch: number,
 *   activeWithinEvacuate: number,
 *   flamingWithinImmediate: number,
 *   smoke: { level: "none"|"haze"|"dense", radiusKm: number, withinRadius: number, activeWithinDense: number },
 *   totalHotspots: number
 * }}
 */
export function assessLocation(latitude, longitude, hotspots = []) {
  let nearest = null;
  let highestLevel = 0;
  let withinWatch = 0;
  let activeWithinEvacuate = 0;
  let flamingWithinImmediate = 0;
  let smokeWithinRadius = 0;
  let activeWithinDense = 0;

  for (const hotspot of hotspots) {
    const distanceKm = haversineKm(
      latitude,
      longitude,
      hotspot.latitude,
      hotspot.longitude
    );
    const level = Number(hotspot.fireLevel) || 0;

    if (distanceKm <= FIRE_STATUS.watchRadiusKm) {
      withinWatch += 1;
      if (level > highestLevel) highestLevel = level;
    }
    if (
      distanceKm <= FIRE_STATUS.evacuateRadiusKm &&
      level >= FIRE_STATUS.smolderingLevel
    ) {
      activeWithinEvacuate += 1;
    }
    if (
      distanceKm <= FIRE_STATUS.immediateRadiusKm &&
      level >= FIRE_STATUS.flamingLevel
    ) {
      flamingWithinImmediate += 1;
    }
    if (distanceKm <= FIRE_STATUS.smokeRadiusKm) {
      smokeWithinRadius += 1;
    }
    if (
      distanceKm <= FIRE_STATUS.smokeDenseRadiusKm &&
      level >= FIRE_STATUS.smolderingLevel
    ) {
      activeWithinDense += 1;
    }

    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = {
        distanceKm,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        fireLevel: hotspot.fireLevel,
        frp: hotspot.frp,
        observedAt: hotspot.observedAt
      };
    }
  }

  const smokeLevel =
    activeWithinDense > 0 ? "dense" : smokeWithinRadius > 0 ? "haze" : "none";

  let level = "aman";
  if (smokeWithinRadius > 0) level = "asap";
  if (withinWatch > 0) level = "siaga";
  if (activeWithinEvacuate > 0) level = "evakuasi";
  if (flamingWithinImmediate > 0) level = "larikan_diri";

  return {
    level,
    nearest,
    highestLevel,
    withinWatch,
    activeWithinEvacuate,
    flamingWithinImmediate,
    smoke: {
      level: smokeLevel,
      radiusKm: FIRE_STATUS.smokeRadiusKm,
      withinRadius: smokeWithinRadius,
      activeWithinDense
    },
    totalHotspots: hotspots.length
  };
}

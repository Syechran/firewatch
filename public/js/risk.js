// Penilaian status kebakaran untuk sebuah lokasi (Find a Place).
// Dua dimensi: kedekatan API (flaming/smoldering) dan jangkauan ASAP/KABUT.
// Bila ada data cuaca (angin), zona asap menjadi BERARAH: api yang berada di
// sisi melawan angin (asap terbawa ke lokasi) lebih berbahaya. Semua berbasis
// titik panas satelit; ini indikatif, bukan model sebaran api tervalidasi.
import { FIRE_STATUS, RISK_INDEX } from "./config.js";

const EARTH_RADIUS_KM = 6371;
const SMOKE_PRESENCE_MIN = 0.75;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Bearing (0=Utara, 90=Timur, searah jarum jam) dari titik 1 ke titik 2.
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {Array} hotspots daftar titik panas ternormalisasi (js/api.js)
 * @param {{ weather?: object|null }} [options] weather opsional (angin/kelembapan)
 */
export function assessLocation(latitude, longitude, hotspots = [], options = {}) {
  const weather = options.weather ?? null;
  const hasWind = Boolean(weather) && Number.isFinite(weather.windDirectionDeg);
  // Arah angin meteorologis = arah DARI mana angin bertiup; asap menuju +180°.
  const windToward = hasWind ? (weather.windDirectionDeg + 180) % 360 : null;

  let nearest = null;
  let highestLevel = 0;
  let withinWatch = 0;
  let activeWithinEvacuate = 0;
  let flamingWithinImmediate = 0;
  let smokeWithinRadius = 0;
  let smokePresence = 0;
  let denseExposure = 0;

  for (const hotspot of hotspots) {
    const distanceKm = haversineKm(
      latitude,
      longitude,
      hotspot.latitude,
      hotspot.longitude
    );
    const level = Number(hotspot.fireLevel) || 0;

    // Bobot arah: 1 bila api tepat di sisi melawan angin (asap terbawa ke sini).
    let weight = 1;
    if (windToward != null) {
      const toUser = bearingDeg(
        hotspot.latitude,
        hotspot.longitude,
        latitude,
        longitude
      );
      const alignment = Math.cos(((toUser - windToward) * Math.PI) / 180);
      weight = Math.max(0, alignment);
    }

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
      smokePresence += weight;
    }
    if (
      distanceKm <= FIRE_STATUS.smokeDenseRadiusKm &&
      level >= FIRE_STATUS.smolderingLevel &&
      weight >= 0.5
    ) {
      denseExposure += 1;
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
    denseExposure > 0
      ? "dense"
      : smokePresence >= SMOKE_PRESENCE_MIN
        ? "haze"
        : "none";

  let level = "aman";
  if (smokeLevel !== "none") level = "asap";
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
      exposure: smokePresence,
      activeWithinDense: denseExposure,
      directional: hasWind
    },
    weather,
    totalHotspots: hotspots.length
  };
}

/**
 * Verifikasi titik laporan warga terhadap titik panas (mengikuti
 * LaporanWarga.Verifikasi di SiagaApi: radius pencocokan 5 km).
 */
export function verifyNearbyHotspots(
  latitude,
  longitude,
  hotspots = [],
  radiusKm = 5
) {
  let count = 0;
  let nearest = null;

  for (const hotspot of hotspots) {
    const distanceKm = haversineKm(
      latitude,
      longitude,
      hotspot.latitude,
      hotspot.longitude
    );
    if (distanceKm <= radiusKm) count += 1;
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { ...hotspot, distanceKm };
    }
  }

  return { matched: count > 0, count, radiusKm, nearest };
}

/**
 * Skor risiko 0..100 dari kelembapan + angin + jumlah titik panas.
 * Mengikuti KalkulatorRisiko SiagaApi (heuristik, belum tervalidasi).
 */
export function riskIndex({ humidity, windSpeedKmh, hotspotCount }) {
  const w = RISK_INDEX.weights;
  const h = Number.isFinite(humidity) ? humidity : 50; // asumsi kelembapan sedang
  const wind = Number.isFinite(windSpeedKmh) ? windSpeedKmh : 0;
  const count = Math.min(
    Number.isFinite(hotspotCount) ? hotspotCount : 0,
    RISK_INDEX.hotspotCap
  );

  const score = clamp(
    (100 - h) * w.humidity + wind * w.wind + count * w.hotspot,
    0,
    100
  );
  const band =
    RISK_INDEX.bands.find((entry) => score >= entry.min) ??
    RISK_INDEX.bands[RISK_INDEX.bands.length - 1];

  return { score: Math.round(score), band: band.key, label: band.label };
}

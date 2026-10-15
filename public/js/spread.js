// Mesin simulasi sebaran api (cellular automaton) — port dari
// GridGenerator + SimulasiPenyebaran di SiagaApi. EKSPERIMENTAL: formulanya
// heuristik dan belum divalidasi, jangan dipakai sebagai klaim akurasi.
import { SIMULATION } from "./config.js";
import { haversineKm } from "./risk.js";

const SAFE = 0;
const BURNING = 1;
const BURNED_OUT = 2;

const NEIGHBORS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * @param {{ center: {lat:number, lon:number}, hotspots: Array, weather: object|null }} input
 * @returns {object|null} hasil simulasi atau null bila input tidak valid
 */
export function runSpreadSimulation({ center, hotspots, weather = null }) {
  if (!center || !Array.isArray(hotspots)) return null;

  const {
    cellDeg: baseCellDeg,
    hours,
    maxCellsPerSide,
    ignitionRadiusKm,
    baseProbability,
    ignitionLevel
  } = SIMULATION;

  const local = hotspots.filter(
    (h) =>
      haversineKm(center.lat, center.lon, h.latitude, h.longitude) <=
      ignitionRadiusKm
  );
  if (!local.length) return { ok: false, reason: "no-hotspots" };

  const ignitions = local.filter((h) => Number(h.fireLevel) >= ignitionLevel);
  if (!ignitions.length) return { ok: false, reason: "no-ignition" };

  const lats = local.map((h) => h.latitude);
  const lons = local.map((h) => h.longitude);
  const latMinData = Math.min(...lats);
  const lonMinData = Math.min(...lons);
  const latSpan = Math.max(...lats) - latMinData;
  const lonSpan = Math.max(...lons) - lonMinData;

  const buffer = 3;
  let cellDeg = baseCellDeg;
  let baris = Math.ceil(latSpan / cellDeg) + buffer * 2 + 1;
  let kolom = Math.ceil(lonSpan / cellDeg) + buffer * 2 + 1;

  const maxSide = Math.max(baris, kolom);
  if (maxSide > maxCellsPerSide) {
    const factor = maxSide / maxCellsPerSide;
    cellDeg *= factor;
    baris = Math.ceil(latSpan / cellDeg) + buffer * 2 + 1;
    kolom = Math.ceil(lonSpan / cellDeg) + buffer * 2 + 1;
  }

  const latMin = latMinData - buffer * cellDeg;
  const lonMin = lonMinData - buffer * cellDeg;

  const index = (b, k) => b * kolom + k;
  let status = new Uint8Array(baris * kolom);
  let ignitionCells = 0;

  for (const h of ignitions) {
    const b = clampInt(Math.floor((h.latitude - latMin) / cellDeg), 0, baris - 1);
    const k = clampInt(Math.floor((h.longitude - lonMin) / cellDeg), 0, kolom - 1);
    if (status[index(b, k)] !== BURNING) {
      status[index(b, k)] = BURNING;
      ignitionCells += 1;
    }
  }

  const windSpeed = Number.isFinite(weather?.windSpeedKmh)
    ? weather.windSpeedKmh
    : 0;
  const humidity = Number.isFinite(weather?.humidity) ? weather.humidity : 50;
  const windToward =
    Number.isFinite(weather?.windDirectionDeg)
      ? (weather.windDirectionDeg + 180) % 360
      : null;

  const probability = (db, dk) => {
    let wind = 0;
    if (windToward != null) {
      const bearing = ((Math.atan2(dk, db) * 180) / Math.PI + 360) % 360;
      const alignment = Math.cos(((bearing - windToward) * Math.PI) / 180);
      wind = (windSpeed / 50) * Math.max(alignment, 0);
    }
    const moisture = -(humidity / 100) * 0.3;
    return Math.max(0.02, Math.min(0.6, baseProbability + wind + moisture));
  };

  for (let step = 0; step < hours; step += 1) {
    const previous = status;
    const next = Uint8Array.from(previous);

    for (let b = 0; b < baris; b += 1) {
      for (let k = 0; k < kolom; k += 1) {
        const cell = previous[index(b, k)];

        if (cell === BURNING) {
          next[index(b, k)] = BURNED_OUT;
          continue;
        }
        if (cell !== SAFE) continue;

        for (const [db, dk] of NEIGHBORS) {
          const nb = b + db;
          const nk = k + dk;
          if (nb < 0 || nb >= baris || nk < 0 || nk >= kolom) continue;
          if (previous[index(nb, nk)] !== BURNING) continue;

          if (Math.random() < probability(db, dk)) {
            next[index(b, k)] = BURNING;
            break;
          }
        }
      }
    }

    status = next;
  }

  let burnedCells = 0;
  for (let i = 0; i < status.length; i += 1) {
    if (status[i] !== SAFE) burnedCells += 1;
  }

  return {
    ok: true,
    baris,
    kolom,
    cellDeg,
    status,
    bounds: [
      [latMin, lonMin],
      [latMin + baris * cellDeg, lonMin + kolom * cellDeg]
    ],
    burnedCells,
    ignitionCells,
    hours,
    parameters: { windSpeed, windDirectionDeg: weather?.windDirectionDeg ?? null, humidity, windToward }
  };
}

/**
 * Parse JAXA Himawari Wild Fire (WLF) Level-2 CSV.
 *
 * File shape (from README_Himawari_L2WLF.txt):
 *   # acquisition / processed time header
 *   # column names
 *   ID,Date,Lat,Lon,Area,Volcano,Level,Reliability level,FRP,QF,HC
 *
 * Filename: Hnn_YYYYMMDD_hhmm_L2WLFVER_FLDK.xxxxx_yyyyy.csv
 */

const FILE_RE =
  /^H(?<sat>\d{2})_(?<date>\d{8})_(?<time>\d{4})_L2WLF(?<ver>\w+)_FLDK\./i;

export function parseWlfFilename(filename) {
  const m = FILE_RE.exec(filename);
  if (!m) return null;
  const { sat, date, time, ver } = m.groups;
  const observedAt = parseObservedAt(date, time);
  return {
    satellite: `H${sat}`,
    version: ver,
    observedAt,
  };
}

function parseObservedAt(date, time) {
  // date: YYYYMMDD, time: hhmm (UTC)
  const y = Number(date.slice(0, 4));
  const mo = Number(date.slice(4, 6)) - 1;
  const d = Number(date.slice(6, 8));
  const h = Number(time.slice(0, 2));
  const mi = Number(time.slice(2, 4));
  return new Date(Date.UTC(y, mo, d, h, mi, 0));
}

/**
 * @param {string} text CSV file body
 * @returns {{ hotspots: Array<object>, columns: string[] }}
 */
export function parseWlfCsv(text) {
  const lines = text.split(/\r?\n/);
  const columns = [];
  const hotspots = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      // Second header is the short column names
      const header = line.slice(1).trim();
      if (header && /ID/i.test(header) && /Lat/i.test(header)) {
        columns.push(...splitCsv(header));
      }
      continue;
    }

    const parts = splitCsv(line);
    if (parts.length < 8) continue;

    // Columns from the product README:
    // ID, Date, Lat, Lon, Area, Volcano, Level, Reliability level, FRP, QF, HC
    const [
      id,
      date,
      lat,
      lon,
      area,
      volcano,
      level,
      reliability,
      frp,
      qf,
      hc,
    ] = parts;

    const observedAt = parseDateField(date);
    if (!observedAt) continue;

    const latN = Number.parseFloat(lat);
    const lonN = Number.parseFloat(lon);
    if (Number.isNaN(latN) || Number.isNaN(lonN)) continue;

    hotspots.push({
      hotspotId: id.trim(),
      observedAt,
      lat: latN,
      lon: lonN,
      areaKm2: toNumber(area),
      volcanoCount: toInt(volcano),
      fireLevel: toInt(level),
      reliability: toInt(reliability),
      frpWm2: toNumber(frp),
      qualityFlag: toInt(qf),
      clusterCenterId: hc ? hc.trim() : null,
    });
  }

  return { hotspots, columns };
}

function splitCsv(line) {
  return line.split(",").map((s) => s.trim());
}

function parseDateField(value) {
  if (!value) return null;
  const v = value.trim();
  // Accept YYYYMMDDhhmm or YYYY-MM-DD hh:mm / hhmm
  let m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    return new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        0
      )
    );
  }
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(v);
  if (m) {
    return new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        0
      )
    );
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function toInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

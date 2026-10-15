/**
 * Parse JAXA Himawari Wild Fire (WLF) Level-2 CSV.
 *
 * File shape (from README_Himawari_L2WLF.txt):
 *   # acquisition / processed time header
 *   # column names
 *   ID,Year,Month,Day,Time(UTC),Lat,Lon,Area(km^2),Volcano,Level,Reliability,FRP(Wm^-2),QF,Hot(ID)
 *
 * Older releases used a single Date column:
 *   ID,Date,Lat,Lon,Area,Volcano,Level,Reliability level,FRP,QF,HC
 *
 * The parser is driven by the "# column names" header so it tolerates both
 * layouts (and future column additions) instead of assuming fixed positions.
 *
 * Filename: Hnn_YYYYMMDD_hhmm_L2WLFVER_FLDK.xxxxx_yyyyy.csv
 */

const FILE_RE =
  /^H(?<sat>\d{2})_(?<date>\d{8})_(?<time>\d{4})_L2WLF(?<ver>\w+)_FLDK\./i;

// Positional fallback used only when a data row appears before any header.
const LEGACY_COLUMNS = [
  "ID",
  "Date",
  "Lat",
  "Lon",
  "Area",
  "Volcano",
  "Level",
  "Reliability level",
  "FRP",
  "QF",
  "HC",
];

// Header names are normalized (lowercased, non-alphanumerics stripped) before
// matching, so "Time(UTC)" -> "timeutc" and "Area(km^2)" -> "areakm2".
const COLUMN_ALIASES = {
  id: ["id"],
  year: ["year"],
  month: ["month"],
  day: ["day"],
  time: ["timeutc", "time"],
  date: ["date", "datetime", "acqdate", "acquisitiondate"],
  lat: ["lat", "latitude"],
  lon: ["lon", "longitude"],
  area: ["areakm2", "area"],
  volcano: ["volcano"],
  level: ["level", "firelevel"],
  reliability: ["reliability", "reliabilitylevel"],
  frp: ["frpwm2", "frp"],
  qf: ["qf", "qualityflag"],
  cluster: ["hotid", "hot", "clustercenterid", "hc"],
};

export function parseWlfFilename(filename) {
  const m = FILE_RE.exec(filename);
  if (!m) return null;
  const { sat, date, time } = m.groups;
  const observedAt = parseObservedAt(date, time);
  return {
    satellite: `H${sat}`,
    version: m.groups.ver,
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

function normalizeHeader(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildColumnIndex(columns) {
  const byName = new Map();
  columns.forEach((name, i) => {
    const key = normalizeHeader(name);
    if (key && !byName.has(key)) byName.set(key, i);
  });

  const index = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    index[field] = aliases
      .map((alias) => byName.get(alias))
      .find((i) => i !== undefined) ?? -1;
  }
  return index;
}

/**
 * @param {string} text CSV file body
 * @returns {{ hotspots: Array<object>, columns: string[] }}
 */
export function parseWlfCsv(text) {
  const lines = text.split(/\r?\n/);
  const columns = [];
  const hotspots = [];
  let index = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      // Second header line carries the short column names.
      const header = line.slice(1).trim();
      if (header && /ID/i.test(header) && /Lat/i.test(header)) {
        columns.push(...splitCsv(header));
        index = buildColumnIndex(columns);
      }
      continue;
    }

    const parts = splitCsv(line);
    if (parts.length < 8) continue;

    const cols = index ?? buildColumnIndex(LEGACY_COLUMNS);

    const latN = Number.parseFloat(fieldValue(parts, cols, "lat"));
    const lonN = Number.parseFloat(fieldValue(parts, cols, "lon"));
    if (Number.isNaN(latN) || Number.isNaN(lonN)) continue;

    const observedAt = resolveObservedAt(parts, cols);
    if (!observedAt) continue;

    const rawId = fieldValue(parts, cols, "id");
    const rawCluster = fieldValue(parts, cols, "cluster");

    hotspots.push({
      hotspotId: rawId != null ? String(rawId).trim() : "",
      observedAt,
      lat: latN,
      lon: lonN,
      areaKm2: toNumber(fieldValue(parts, cols, "area")),
      volcanoCount: toInt(fieldValue(parts, cols, "volcano")),
      fireLevel: toInt(fieldValue(parts, cols, "level")),
      reliability: toInt(fieldValue(parts, cols, "reliability")),
      frpWm2: toNumber(fieldValue(parts, cols, "frp")),
      qualityFlag: toInt(fieldValue(parts, cols, "qf")),
      clusterCenterId:
        rawCluster != null && String(rawCluster).trim() !== ""
          ? String(rawCluster).trim()
          : null,
    });
  }

  return { hotspots, columns };
}

function fieldValue(parts, index, field) {
  const i = index[field];
  return i >= 0 && i < parts.length ? parts[i] : undefined;
}

function resolveObservedAt(parts, index) {
  const year = toInt(fieldValue(parts, index, "year"));
  const month = toInt(fieldValue(parts, index, "month"));
  const day = toInt(fieldValue(parts, index, "day"));

  if (year && month && day) {
    return buildObservedAt(year, month, day, fieldValue(parts, index, "time"));
  }

  return parseDateField(fieldValue(parts, index, "date"));
}

function buildObservedAt(year, month, day, time) {
  let hours = 0;
  let minutes = 0;

  if (time != null && String(time).trim() !== "") {
    const value = String(time).trim();
    const colon = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (colon) {
      hours = Number(colon[1]);
      minutes = Number(colon[2]);
    } else {
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 3) {
        hours = Number(digits.slice(0, digits.length - 2));
        minutes = Number(digits.slice(-2));
      }
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
}

function splitCsv(line) {
  return line.split(",").map((s) => s.trim());
}

function parseDateField(value) {
  if (!value) return null;
  const v = String(value).trim();
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

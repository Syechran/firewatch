import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWlfCsv, parseWlfFilename } from "../src/ingest/wlfParser.js";
import { filterIndonesia, inBbox } from "../src/ingest/indonesiaFilter.js";

const SAMPLE = `# 2026/10/14 02:00 UT, processed 2026/10/14 02:12 UT
# ID,Date,Lat,Lon,Area,Volcano,Level,Reliability level,FRP,QF,HC
1,202610140200,-2.5,106.8,4.0,0,3,5,42.5,0,1
2,202610140200,35.0,135.0,4.0,0,1,3,1.2,0,2
3,202610140200,-6.2,106.8,4.0,1,2,3,10.0,0,3
4,202610140200,-1.1,95.2,4.0,0,3,5,88.0,1,4
5,202610140200,-1.1,94.0,4.0,0,3,5,77.0,0,5
`;

test("parseWlfFilename extracts satellite and UTC slot", () => {
  const meta = parseWlfFilename("H09_20261014_0200_L2WLF010_FLDK.06001_06001.csv");
  assert.ok(meta);
  assert.equal(meta.satellite, "H09");
  assert.equal(meta.version, "010");
  assert.equal(meta.observedAt.toISOString(), "2026-10-14T02:00:00.000Z");
});

test("parseWlfCsv reads hotspots and skips bad rows", () => {
  const { hotspots } = parseWlfCsv(SAMPLE);
  assert.equal(hotspots.length, 5);
  assert.equal(hotspots[0].hotspotId, "1");
  assert.equal(hotspots[0].fireLevel, 3);
  assert.equal(hotspots[0].reliability, 5);
  assert.equal(hotspots[0].frpWm2, 42.5);
  assert.equal(hotspots[0].clusterCenterId, "1");
});

test("Indonesia filter keeps archipelago points only", () => {
  const bbox = { minLon: 94.5, minLat: -11.5, maxLon: 141.5, maxLat: 6.5 };
  const { hotspots } = parseWlfCsv(SAMPLE);
  const kept = filterIndonesia(hotspots, bbox);
  // row 2 is Japan, row 5 is west of 94.5
  assert.equal(kept.length, 3);
  assert.ok(kept.every((h) => inBbox(h.lat, h.lon, bbox)));
  assert.ok(!kept.some((h) => h.lat === 35.0));
});

#!/usr/bin/env node
/**
 * Builds public/assets/data/near-earth-asteroids.json -- every near-Earth
 * asteroid the scene stamps as a rock (src/js/scene/smallBodies/
 * nearEarthSwarm.js) -- from JPL Small-Body Database query downloads.
 *
 * Round 39. This session's network cannot reach JPL, so the owner
 * downloaded the query results in a browser into `webresponse/` (one file
 * per slice; see the README). Run:
 *
 *   node tools/neo-catalogue/build-neo-catalogue.mjs webresponse
 *
 * Query (sbdb_query.api, 10 October 2026):
 *   fields=full_name,pdes,class,a,e,i,om,w,ma,epoch,H,diameter,albedo,
 *          spec_B,moid,rot_per
 *   sb-class=IEO,ATE (one file), AMO and APO in slices of 10,000
 *   (limit / limit-from).
 *
 * Output is columnar (one array per field) and rounded to the precision
 * the query gave or less -- a to 4 decimals, angles to 0.01 degree --
 * with the full designation left out (`name` and `pdes` rebuild it) and
 * the usual epoch stored as 0: about 3.4 MB rather than 9, ~0.9 MB
 * compressed in transit. Rows are de-duplicated on
 * `pdes`, so overlapping slices do no harm.
 */
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "webresponse";
const out = process.argv[3] ?? "public/assets/data/near-earth-asteroids.json";
const CLASS = { IEO: 0, ATE: 1, APO: 2, AMO: 3 };
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const seen = new Set();
const cols = { name: [], pdes: [], cls: [], a: [], e: [], i: [], om: [], w: [], ma: [], epoch: [], H: [], D: [], alb: [], spec: [], moid: [], rot: [] };
const counts = {};
const num = (v, dp) => (v === null || v === undefined || v === "" ? 0 : Number(Number(v).toFixed(dp)));
const sig = (v, s) => (v === null || v === undefined || v === "" ? 0 : Number(Number(v).toPrecision(s)));
for (const file of files) {
  const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const f = Object.fromEntries(json.fields.map((k, i) => [k, i]));
  counts[file] = { rows: json.data.length, count: json.count };
  for (const row of json.data) {
    const pdes = String(row[f.pdes]).trim();
    if (seen.has(pdes)) continue;
    seen.add(pdes);
    const full = String(row[f.full_name]).trim();
    /* "433 Eros (A898 PA)" -> Eros; "(2024 NA2)" -> 2024 NA2;
     * "175921 (2000 DM1)" -> 2000 DM1 (the number stays in `des`). */
    const named = /^\d+\s+([^(]+?)\s*(\(|$)/.exec(full);
    const prov = /\(([^)]+)\)/.exec(full);
    const name = named ? named[1].trim() : prov ? prov[1].trim() : full;
    cols.name.push(name);
    cols.pdes.push(pdes);
    cols.cls.push(CLASS[row[f.class]] ?? 2);
    cols.a.push(num(row[f.a], 4));
    cols.e.push(num(row[f.e], 4));
    cols.i.push(num(row[f.i], 2));
    cols.om.push(num(row[f.om], 2));
    cols.w.push(num(row[f.w], 2));
    cols.ma.push(num(row[f.ma], 2));
    /* 0 means the usual epoch, JD 2461200.5 (most rows). */
    cols.epoch.push(Number(row[f.epoch]) === 2461200.5 ? 0 : num(row[f.epoch], 1));
    /* -1: no H on record (a few short arcs). */
    cols.H.push(row[f.H] === null || row[f.H] === undefined || row[f.H] === "" ? -1 : num(row[f.H], 2));
    cols.D.push(sig(row[f.diameter], 3));
    cols.alb.push(num(row[f.albedo], 3));
    cols.spec.push(row[f.spec_B] ?? "");
    /* MOID to 6 places (0.000001 AU = 150 km), so the closest paths -- some
     * a few thousand km from Earth's -- keep their distance; -1: none on
     * record (135 short arcs). Was 4 places with 0 for both, which made
     * "under 7,500 km" and "not known" the same. */
    cols.moid.push(row[f.moid] === null || row[f.moid] === undefined || row[f.moid] === "" ? -1 : num(row[f.moid], 6));
    cols.rot.push(sig(row[f.rot_per], 4));
  }
}
const result = {
  source: "NASA/JPL Small-Body Database Query API, classes IEO, ATE, APO, AMO; downloaded 10 October 2026",
  files: counts,
  count: cols.a.length,
  ...cols,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result));
const byClass = [0, 1, 2, 3].map((c) => cols.cls.filter((x) => x === c).length);
console.log(`${cols.a.length} rows (Atira ${byClass[0]}, Aten ${byClass[1]}, Apollo ${byClass[2]}, Amor ${byClass[3]}) -> ${out} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB)`);

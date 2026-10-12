/**
 * Crater maps for the near-Earth asteroids (round 39, the owner: "ensure
 * all those near objects have craters terrains").
 *
 *   node tools/binary-surface-lab/build-neo-maps.mjs <raw out folder>
 *   python tools/binary-surface-lab/encode-binary-maps.py <raw out folder> <encoded folder>
 *
 * Then copy into public/assets/textures/smallbodies/:
 *   - neo-stamp-1..6.jpg and neo-stamp-1..6-normal.png: the six rock stamps
 *     every one of the ~38,000 near-Earth asteroids is drawn with
 *     (nearEarthSwarm.js). Their old maps were the named rocks' fine grain
 *     maps with no craters in them, and at the stamps' 30 x 20 segments the
 *     sculpted craters were mostly lost, so the rocks read as smooth.
 *   - <file>-normal.png only, for the twenty named family rocks
 *     (nearEarthFamilies.js). Their colour maps stay as they are; the normal
 *     map adds craters the scene's Sun lights (the batch B binaries' way).
 *
 * Same generator, terrains and encoder as the binaries' maps
 * (surfaceGenerator.js, surfaceDesigns.js TERRAINS, encode-binary-maps.py).
 * Terrain by spectral class, as the family rocks were sculpted:
 *   C rubble piles (Bennu, Ryugu)      -> "rubble", with more craters
 *   S, E, baked Atiras (Eros, Itokawa) -> "saturated" (Callisto-like)
 *   the cratered lump stamp (C/D)       -> "giants" (Mathilde)
 *   the metal stamp and 1986 DA (M)     -> "saturated", shallower
 */
import fs from "node:fs";
import path from "node:path";
import { generateSurface } from "./surfaceGenerator.js";
import { TERRAINS } from "./surfaceDesigns.js";

const out = process.argv[2] ?? "neo-maps";
fs.mkdirSync(out, { recursive: true });

/* Grey: the stamps take their colour per rock (instance colour), and the
 * scene divides by the map's own mean (meanLinear), so only the variation
 * matters. Linear 0.045 / 0.22 / 0.55 (chosen by eye for a mottled grey). */
const GREY = { dark: "#3c3c3c", mid: "#828282", light: "#c4c4c4" };

const recipe = (terrain, extra = {}) => {
  const r = JSON.parse(JSON.stringify(TERRAINS[terrain].recipe));
  for (const [k, v] of Object.entries(extra)) r[k] = { ...(r[k] ?? {}), ...v };
  return r;
};
/* A rubble pile still carries craters (Bennu's largest are ~150 m on a
 * 490 m body; Ryugu's Urashima ~290 m on 900 m). */
const RUBBLE = () => recipe("rubble", { craters: { count: 180, rmin: 0.03, rmax: 0.22, slope: 1.6, wearMin: 0.15, wearBias: 1.1, fresh: 0.04 } });
const SATURATED = () => recipe("saturated");
const GIANTS = () => recipe("giants");
const METAL = () => recipe("saturated", { craters: { count: 1400, rmin: 0.014, rmax: 0.2, slope: 1.8, wearMin: 0.3, wearBias: 0.8, fresh: 0.03, rays: 0 } });

const MAPS = [
  /* The six stamps (nearEarthSwarm.js SHAPES, in order). 1024 x 512: they
   * are what the camera arrives at for every one of the 38,000. */
  /* contrast 1.8: a mottled surface, as the old grain maps had, rather
   * than an even grey (chosen by eye). */
  { file: "neo-stamp-1", recipe: RUBBLE(), seed: 901, size: 1024, albedo: true, tweaks: { contrast: 1.8 } },
  { file: "neo-stamp-2", recipe: SATURATED(), seed: 902, size: 1024, albedo: true, tweaks: { contrast: 1.8 } },
  { file: "neo-stamp-3", recipe: SATURATED(), seed: 903, size: 1024, albedo: true, tweaks: { contrast: 1.8, craters: 0.8 } },
  { file: "neo-stamp-4", recipe: SATURATED(), seed: 904, size: 1024, albedo: true, lobed: true, tweaks: { contrast: 1.8 } },
  { file: "neo-stamp-5", recipe: GIANTS(), seed: 905, size: 1024, albedo: true, tweaks: { contrast: 1.8, relief: 1.3 } },
  { file: "neo-stamp-6", recipe: METAL(), seed: 906, size: 1024, albedo: true, tweaks: { contrast: 1.4, relief: 0.8 } },
  /* The twenty named family rocks: normal maps only, 512 x 256 like their
   * colour maps. Seeds are their shape seeds. */
  { file: "atira", recipe: SATURATED(), seed: 163693 },
  { file: "aylochaxnim", recipe: SATURATED(), seed: 594913 },
  { file: "2021-ph27", recipe: SATURATED(), seed: 2021 },
  { file: "aten", recipe: SATURATED(), seed: 2062 },
  { file: "ra-shalom", recipe: RUBBLE(), seed: 2100 },
  { file: "hathor", recipe: SATURATED(), seed: 2340 },
  { file: "apollo", recipe: SATURATED(), seed: 1862 },
  { file: "icarus", recipe: SATURATED(), seed: 1566 },
  { file: "toro", recipe: SATURATED(), seed: 1685 },
  { file: "nereus", recipe: SATURATED(), seed: 4660 },
  { file: "castalia", recipe: RUBBLE(), seed: 4769, lobed: true },
  { file: "eger", recipe: SATURATED(), seed: 3103 },
  { file: "daedalus", recipe: SATURATED(), seed: 1864 },
  { file: "1989-ja", recipe: SATURATED(), seed: 7335 },
  { file: "ganymed", recipe: SATURATED(), seed: 1036 },
  { file: "don-quixote", recipe: RUBBLE(), seed: 3552 },
  { file: "ivar", recipe: SATURATED(), seed: 1627, lobed: true },
  { file: "florence", recipe: SATURATED(), seed: 3122 },
  { file: "betulia", recipe: RUBBLE(), seed: 1580 },
  { file: "1986-da", recipe: METAL(), seed: 6178, lobed: true },
];

const manifest = {};
for (const m of MAPS) {
  const size = m.size ?? 512;
  const started = Date.now();
  const result = generateSurface({
    width: size, height: size / 2, lobed: Boolean(m.lobed), seed: m.seed,
    palette: GREY, recipe: m.recipe, tweaks: m.tweaks ?? {},
  });
  fs.writeFileSync(path.join(out, `${m.file}.albedo.raw`), result.albedo);
  fs.writeFileSync(path.join(out, `${m.file}.normal.raw`), result.normal);
  manifest[m.file] = { body: m.file, width: size, height: size / 2, albedo: Boolean(m.albedo), meanLinear: result.meanLinear };
  console.log(`${m.file.padEnd(14)} ${size} ${Date.now() - started} ms`);
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

/**
 * Writes the scene's maps for the eleven binary bodies from the designs
 * picked in binary-surface-lab.html -- the same generator, the same seeds,
 * the same tuning, so what was approved there is what ships.
 *
 *   node tools/binary-surface-lab/build-binary-maps.mjs <out folder>
 *
 * Writes <file>.albedo.raw and <file>.normal.raw (RGBA, row 0 north) and a
 * manifest.json with each map's size and mean linear luminance; then
 * encode-binary-maps.py turns them into the JPEG and PNG the scene loads.
 */
import fs from "node:fs";
import path from "node:path";
import { generateSurface } from "./surfaceGenerator.js";
import { SYSTEMS, specFor } from "./surfaceDesigns.js";
import PICKS from "./picks.json" with { type: "json" };

const out = process.argv[2] ?? "binary-maps";
fs.mkdirSync(out, { recursive: true });

/* The scene's file names (SMALL_BODY_TEXTURES). */
const FILE = {
  Lempo: "lempo", Hiisi: "hiisi", Paha: "paha", Sila: "sila", Nunam: "nunam",
  Teharonhiawako: "teharonhiawako", Sawiskera: "sawiskera", Altjira: "altjira",
  "Altjira I": "altjira-moon", "Manwë": "manwe", Thorondor: "thorondor",
};
/* Two lobes in binaryCatalogue.js: the collar and neck features apply. */
const LOBED = new Set(["Altjira", "Manwë"]);

/* The lab's sliders are percentages; the generator takes multipliers. */
const DEFAULTS = { craters: 100, craterSize: 100, fresh: 100, boulders: 100, relief: 100, contrast: 100, redness: 100, hue: 0 };
const toTweaks = (t) => Object.fromEntries(Object.entries({ ...DEFAULTS, ...t }).map(([k, v]) => [k, v / 100]));

const manifest = {};
for (const system of SYSTEMS) {
  const pick = PICKS.systems[system.key];
  if (!pick) throw new Error(`No pick for ${system.key}`);
  const tweaks = toTweaks(pick.tweaks ?? {});
  for (const body of Object.keys(system.variants[pick.variant].terrains)) {
    const size = PICKS.mapSize;
    const spec = specFor(system, pick.variant, body, { width: size, height: size / 2, lobed: LOBED.has(body), tweaks });
    const started = Date.now();
    const result = generateSurface(spec);
    const file = FILE[body];
    fs.writeFileSync(path.join(out, `${file}.albedo.raw`), result.albedo);
    fs.writeFileSync(path.join(out, `${file}.normal.raw`), result.normal);
    manifest[file] = { body, width: size, height: size / 2, terrain: spec.terrain, variant: pick.variant, meanLinear: result.meanLinear };
    console.log(`${body.padEnd(15)} ${pick.variant} ${spec.terrain.padEnd(10)} ${Date.now() - started} ms`);
  }
}
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));

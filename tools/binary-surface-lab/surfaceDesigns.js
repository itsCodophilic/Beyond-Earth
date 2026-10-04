/**
 * The candidate designs for the five binary systems, for the surface lab.
 *
 * Each system has three variants, A, B and C; each variant gives every body
 * in the system a terrain (see surfaceGenerator.js for what each one is
 * modelled on) and each body keeps its own palette in every variant, so the
 * eleven stay distinguishable whatever is chosen.
 *
 * Palettes are sRGB, dark / mid / light, deliberately close together: a
 * real surface is low contrast in albedo (see the generator's header). They
 * follow the measured colours -- all eleven are red to very red, B-R 1.64 to
 * 1.74 (Lempo system V-R 0.69; Grundy, Benecchi, Rabinowitz et al.) -- and
 * the user's brief: Lempo strongly red, Teharonhiawako and Sawiskera dark
 * reddish-brown, Altjira deep dark red, Manwë and Thorondor dark ultra-red.
 */

import { COMETS } from "../../src/js/scene/smallBodies/cometCatalogue.js";
import { INTERSTELLAR_VISITORS } from "../../src/js/scene/smallBodies/interstellarCatalogue.js";
import { JUPITER_TROJANS } from "../../src/js/scene/smallBodies/trojanCatalogue.js";
import { NEAR_EARTH_ODDITIES } from "../../src/js/scene/smallBodies/neoCatalogue.js";

const BINARY_PALETTES = Object.freeze({
  Lempo: { dark: "#3d1410", mid: "#8c2f22", light: "#b8573f" },
  Hiisi: { dark: "#45190c", mid: "#9b4220", light: "#c47346" },
  Paha: { dark: "#37120f", mid: "#842a20", light: "#ad4f3c" },
  Sila: { dark: "#3e1c12", mid: "#8a4a31", light: "#b27456" },
  // Rose, where Sila is brick: the pair must not read as one body twice.
  Nunam: { dark: "#45191f", mid: "#9c4c55", light: "#c67d82" },
  Teharonhiawako: { dark: "#241510", mid: "#5a3528", light: "#7e5745" },
  Sawiskera: { dark: "#1f1210", mid: "#4f2b26", light: "#744a42" },
  Altjira: { dark: "#1f0a0b", mid: "#56201f", light: "#7f3c35" },
  "Altjira I": { dark: "#2a110c", mid: "#6a2e22", light: "#93513d" },
  "Manwë": { dark: "#2c140a", mid: "#7a3e22", light: "#a8663f" },
  Thorondor: { dark: "#331a0c", mid: "#8a4b28", light: "#b67a4e" },
});

/* The terrains. Radii and widths are in radians on the unit sphere. */
export const TERRAINS = Object.freeze({
  saturated: {
    label: "Saturated craters (Callisto)",
    recipe: {
      broad: 0.14, fine: 0.06, grain: 0.045, bake: 0.35,
      craters: { count: 2400, rmin: 0.011, rmax: 0.2, slope: 1.8, wearMin: 0.12, wearBias: 0.6, fresh: 0.05, rays: 0.3 },
    },
  },
  rubble: {
    label: "Boulder rubble pile (Bennu, Ryugu)",
    recipe: {
      broad: 0.1, fine: 0.09, grain: 0.08, bake: 0.4,
      rubble: { levels: [
        { freq: 9, amp: 0.5, toneVar: 0.22, gapDark: 0.04, cover: 0.85 },
        { freq: 26, amp: 0.45, toneVar: 0.28, gapDark: 0.05, cover: 0.8 },
        { freq: 70, amp: 0.35, toneVar: 0.28, gapDark: 0.04, cover: 0.7 },
      ] },
      craters: { count: 60, rmin: 0.03, rmax: 0.2, slope: 1.6, wearMin: 0.2, wearBias: 1.5, fresh: 0.03 },
    },
  },
  mounds: {
    label: "Smooth mounds, few craters (Arrokoth)",
    recipe: {
      broad: 0.12, fine: 0.05, grain: 0.03, bake: 0.25,
      mounds: { count: 14, rmin: 0.25, rmax: 0.55, amp: 0.085, toneVar: 0.14, edgeDark: 0.06 },
      patches: { freq: 3, threshold: 0.28, bright: 0.16 },
      craters: { count: 40, rmin: 0.02, rmax: 0.14, slope: 1.4, wearMin: 0.35, fresh: 0.08 },
      collar: 0.35,
    },
  },
  giants: {
    label: "Giant spalled craters (Mathilde)",
    recipe: {
      broad: 0.08, fine: 0.05, grain: 0.04, bake: 0.3,
      giants: { count: 5, rmin: 0.34, rmax: 0.6, slope: 1, wearMin: 0.6, spall: 0.07 },
      craters: { count: 320, rmin: 0.015, rmax: 0.1, slope: 2, wearMin: 0.25, fresh: 0.03 },
    },
  },
  grooved: {
    label: "Grooves and pit chains (Lutetia, Phobos)",
    recipe: {
      broad: 0.12, fine: 0.07, grain: 0.05, bake: 0.35,
      grooves: { families: 2, perFamily: 7, width: 0.012, depth: 0.012, pits: 22, dark: 0.03 },
      craters: { count: 420, rmin: 0.014, rmax: 0.16, slope: 1.9, wearMin: 0.2, wearBias: 0.7, fresh: 0.05 },
      patches: { freq: 5, threshold: 0.35, bright: 0.1 },
    },
  },
  cometPitted: {
    label: "Comet: pits and smooth flows (Tempel 1)",
    recipe: {
      broad: 0.12, fine: 0.07, grain: 0.05, bake: 0.45,
      pits: { count: 80, rmin: 0.025, rmax: 0.17, depth: 0.5, wall: 0.3, dark: 0.045 },
      craters: { count: 60, rmin: 0.02, rmax: 0.1, slope: 1.8, wearMin: 0.15, wearBias: 1.6, fresh: 0.02 },
      smooth: { freq: 1.4, threshold: 0.16, edge: 0.035, flatten: 0.85, bright: 0.05, scarp: 0.005 },
      flecks: 0.15,
    },
  },
  cometWild2: {
    label: "Comet: flat-floored pits, pinnacles (Wild 2)",
    recipe: {
      broad: 0.1, fine: 0.08, grain: 0.06, bake: 0.4,
      pits: { count: 44, rmin: 0.04, rmax: 0.34, slope: 1.3, depth: 0.55, wall: 0.32, dark: 0.05 },
      rubble: { levels: [{ freq: 40, amp: 0.3, toneVar: 0.2, gapDark: 0.02, cover: 0.35 }] },
    },
  },
  cometBorrelly: {
    label: "Comet: mesas, smooth plains, dark spots (Borrelly)",
    recipe: {
      broad: 0.16, fine: 0.07, grain: 0.05, bake: 0.3,
      mounds: { count: 18, rmin: 0.12, rmax: 0.3, amp: 0.05, toneVar: 0.1, edgeDark: 0.04 },
      smooth: { freq: 1.1, threshold: 0.08, edge: 0.05, flatten: 0.9, bright: 0.08, scarp: 0.004 },
      spots: { count: 7, rmin: 0.05, rmax: 0.12, dark: 0.2 },
      fractures: { count: 7, width: 0.006, depth: 0.008, length: 0.9, dark: 0.05 },
    },
  },
  cometHartley: {
    label: "Comet: mounded lobes, smooth waist (Hartley 2)",
    recipe: {
      broad: 0.12, fine: 0.08, grain: 0.06, bake: 0.35,
      mounds: { count: 90, rmin: 0.05, rmax: 0.14, amp: 0.2, toneVar: 0.2, edgeDark: 0.05 },
      rubble: { levels: [{ freq: 34, amp: 0.3, toneVar: 0.3, gapDark: 0.03, cover: 0.4 }] },
      smooth: { freq: 1.6, threshold: 0.22, edge: 0.04, flatten: 0.8, bright: 0.06, scarp: 0.003 },
      collar: 0.2,
    },
  },
  unresolved: {
    label: "Unresolved: soft mottling, worn craters",
    recipe: {
      broad: 0.16, fine: 0.06, grain: 0.04, bake: 0.3,
      craters: { count: 120, rmin: 0.02, rmax: 0.14, slope: 1.8, wearMin: 0.3, wearBias: 1.2, fresh: 0.03 },
    },
  },
  snowball: {
    label: "Dirty snowball: fresh icy craters, fractures",
    recipe: {
      broad: 0.16, fine: 0.08, grain: 0.06, bake: 0.3,
      craters: { count: 700, rmin: 0.012, rmax: 0.14, slope: 2.1, wearMin: 0.25, fresh: 0.16, rays: 0.15 },
      fractures: { count: 9, width: 0.006, depth: 0.01, length: 1.2, dark: 0.06 },
      flecks: 0.5,
    },
  },
});

/* Always true of a body, whatever variant: the brief. */
const BODY_EXTRAS = Object.freeze({
  // "Bright frost patches in crater floors"; "fractures near the neck".
  "Manwë": { frost: 0.75, fractures: { count: 10, width: 0.007, depth: 0.012, length: 0.55, dark: 0.07, aroundNeck: true } },
  // More battered than its partner.
  Sawiskera: { craterBoost: 1.35 },
  // "Paha the same colour", smaller and more pitted.
  Paha: { craterBoost: 1.2 },
});

function merge(terrain, body) {
  const base = TERRAINS[terrain].recipe;
  const extra = BODY_EXTRAS[body] ?? {};
  const recipe = JSON.parse(JSON.stringify(base));
  if (extra.frost) recipe.frost = extra.frost;
  if (extra.fractures) recipe.fractures = extra.fractures;
  if (extra.craterBoost && recipe.craters) recipe.craters.count *= extra.craterBoost;
  return recipe;
}

/*
 * The variants. `why` is what the lab shows beside the choice: which real
 * body each look is borrowed from, and why that is a plausible borrowing.
 */
const BINARY_SYSTEMS = Object.freeze([
  {
    key: "lempo",
    name: "Lempo · Hiisi · Paha",
    brief: "Strongly red (tholins), highly cratered, rubble pile; Paha the same colour.",
    variants: {
      A: { title: "Callisto-red", terrains: { Lempo: "saturated", Hiisi: "saturated", Paha: "saturated" },
        why: "Cratered to saturation, like Callisto: an old surface where every new impact lands on an older one. Young craters keep bright, paler haloes." },
      B: { title: "Ryugu rubble", terrains: { Lempo: "rubble", Hiisi: "rubble", Paha: "rubble" },
        why: "A rubble pile shows it: boulders of every size, as Bennu and Ryugu do, with only a few craters that the loose surface has not erased." },
      C: { title: "Mixed", terrains: { Lempo: "saturated", Hiisi: "giants", Paha: "rubble" },
        why: "Three histories: Lempo saturated, Hiisi scarred by a few giant impacts like Mathilde, small Paha a boulder pile." },
    },
  },
  {
    key: "sila",
    name: "Sila · Nunam",
    brief: "Cold classical near-equal pair, tidally locked; the population Arrokoth belongs to.",
    variants: {
      A: { title: "Arrokoth-like", terrains: { Sila: "mounds", Nunam: "mounds" },
        why: "Arrokoth is the only cold classical ever seen close up: smooth, few craters, rounded mounds and bright patches. The closest real analogue there is." },
      B: { title: "Lightly cratered", terrains: { Sila: "saturated", Nunam: "snowball" },
        why: "More cratering than Arrokoth -- Sila and Nunam are twenty times its size and have swept up more -- with icy fresh craters on Nunam." },
      C: { title: "Giant impacts", terrains: { Sila: "giants", Nunam: "giants" },
        why: "Mathilde-style: a handful of huge, angular craters on very uniform ground." },
    },
  },
  {
    key: "teharonhiawako",
    name: "Teharonhiawako · Sawiskera",
    brief: "Ultra-red, dark reddish-brown dirty snowballs, craters and fractures; Sawiskera more battered.",
    variants: {
      A: { title: "Snowball and battered", terrains: { Teharonhiawako: "snowball", Sawiskera: "saturated" },
        why: "Teharonhiawako a dirty snowball with fresh icy craters and fractures; Sawiskera cratered to saturation, the battered one." },
      B: { title: "Grooved", terrains: { Teharonhiawako: "grooved", Sawiskera: "grooved" },
        why: "Fractures as Lutetia and Phobos carry them: families of grooves and pit chains from old impacts." },
      C: { title: "Giant impacts", terrains: { Teharonhiawako: "snowball", Sawiskera: "giants" },
        why: "Sawiskera's elongation read as damage: a few giant spalled craters, as on Mathilde." },
    },
  },
  {
    key: "altjira",
    name: "Altjira · Altjira I",
    brief: "Deep dark red, porous rubble pile (density ~0.3 g/cm3); Altjira probably itself two bodies.",
    variants: {
      A: { title: "Bennu rubble", terrains: { Altjira: "rubble", "Altjira I": "rubble" },
        why: "Porous and loosely bound: boulder fields of every size, as on Bennu and Ryugu." },
      B: { title: "Mathilde-dark", terrains: { Altjira: "giants", "Altjira I": "giants" },
        why: "Mathilde is the porous rubble pile we have seen: half empty inside, very dark, and scarred by craters nearly as wide as itself." },
      C: { title: "Arrokoth pair", terrains: { Altjira: "mounds", "Altjira I": "rubble" },
        why: "If Altjira is two bodies touching, it may look like Arrokoth: smooth lobes with a bright neck. Its partner a rubble pile." },
    },
  },
  {
    key: "manwe",
    name: "Manwë · Thorondor",
    brief: "Dark ultra-red; Manwë a contact binary with fractures at the neck and frost in crater floors; Thorondor an irregular fragment.",
    variants: {
      A: { title: "Arrokoth contact", terrains: { "Manwë": "mounds", Thorondor: "grooved" },
        why: "Manwë like Arrokoth, a contact binary with a bright collar at the neck, plus the frosted crater floors and neck fractures asked for; Thorondor a grooved fragment." },
      B: { title: "Cratered", terrains: { "Manwë": "saturated", Thorondor: "saturated" },
        why: "Both heavily cratered; Manwë keeps its frost and neck fractures." },
      C: { title: "Fragment and rubble", terrains: { "Manwë": "snowball", Thorondor: "rubble" },
        why: "Manwë an icy snowball with bright fresh craters; Thorondor a loose boulder fragment." },
    },
  },
]);

/* Stable seeds, so a design looks the same every time it is opened. */
const BINARY_SEEDS = Object.freeze({
  Lempo: 101, Hiisi: 202, Paha: 303, Sila: 404, Nunam: 505,
  Teharonhiawako: 606, Sawiskera: 707, Altjira: 808, "Altjira I": 909,
  "Manwë": 1010, Thorondor: 1111,
});

/* ------------------------------------------------------------------------
 * Ranks 7-10: comets, the interstellar visitors, the Trojans and Lucy
 * targets, the near-Earth oddities -- 33 bodies in five groups.
 *
 * Palettes here are derived, not hand-picked: each body's measured chroma
 * (its card's colour, from B-V/V-R, a spectral slope or its class) sets the
 * hue, at a fixed mid brightness, with dark and light at 0.5x and 1.8x in
 * linear light. The scene divides every map by its own mean, so the
 * measured albedo still sets how bright the body is; the palette only gives
 * it its colour and its internal contrast.
 * ---------------------------------------------------------------------- */

const toSrgbHex = (linear) => `#${linear.map((v) => {
  const c = Math.min(1, Math.max(0, v));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255).toString(16).padStart(2, "0");
}).join("")}`;
function paletteFromChroma(chroma = [1, 1, 1]) {
  const mid = chroma.map((v) => 0.16 * v);
  return {
    dark: toSrgbHex(mid.map((v) => v * 0.5)),
    mid: toSrgbHex(mid),
    light: toSrgbHex(mid.map((v) => v * 1.8)),
  };
}

/* Every record and moon in the four catalogues, by name. */
export const RANK_RECORDS = new Map();
for (const record of [...COMETS, ...INTERSTELLAR_VISITORS, ...JUPITER_TROJANS, ...NEAR_EARTH_ODDITIES]) {
  RANK_RECORDS.set(record.name, record);
  for (const moon of record.moons ?? []) {
    RANK_RECORDS.set(moon.name, { ...moon, albedo: moon.albedo ?? record.albedo, chroma: moon.chroma ?? record.chroma });
  }
}

/* File names in public/assets/textures/smallbodies/. */
export const RANK_FILES = Object.freeze({
  "9P/Tempel 1": "tempel-1", "103P/Hartley 2": "hartley-2", "81P/Wild 2": "wild-2",
  "19P/Borrelly": "borrelly", "2P/Encke": "encke", "12P/Pons-Brooks": "pons-brooks",
  "C/2014 UN271": "un271", "C/1995 O1 Hale-Bopp": "hale-bopp", "C/2020 F3 NEOWISE": "neowise",
  "1I/ʻOumuamua": "oumuamua", "2I/Borisov": "borisov", "3I/ATLAS": "atlas-3i",
  Hektor: "hektor", Skamandrios: "skamandrios", Patroclus: "patroclus", Menoetius: "menoetius",
  Eurybates: "eurybates", Queta: "queta", Polymele: "polymele", Shaun: "shaun",
  Leucus: "leucus", Orus: "orus", Hilda: "hilda",
  Donaldjohanson: "donaldjohanson", Dinkinesh: "dinkinesh", Selam: "selam",
  Phaethon: "phaethon", Toutatis: "toutatis", "Kamoʻoalewa": "kamooalewa",
  Cruithne: "cruithne", Moshup: "moshup", Squannit: "squannit", Geographos: "geographos",
});

const RANK_GROUPS = Object.freeze([
  {
    key: "comets",
    name: "Comets",
    brief: "Nine nuclei. Four were visited (Tempel 1, Hartley 2, Wild 2, Borrelly) and their designs follow what the cameras saw; five were never resolved and borrow Tempel 1's pits and flows.",
    members: ["9P/Tempel 1", "103P/Hartley 2", "81P/Wild 2", "19P/Borrelly", "2P/Encke", "12P/Pons-Brooks", "C/2014 UN271", "C/1995 O1 Hale-Bopp", "C/2020 F3 NEOWISE"],
    variants: {
      A: { title: "As observed", terrains: {
        "9P/Tempel 1": "cometPitted", "103P/Hartley 2": "cometHartley", "81P/Wild 2": "cometWild2",
        "19P/Borrelly": "cometBorrelly", "2P/Encke": "cometPitted", "12P/Pons-Brooks": "cometPitted",
        "C/2014 UN271": "cometPitted", "C/1995 O1 Hale-Bopp": "cometPitted", "C/2020 F3 NEOWISE": "cometPitted" },
        why: "Each visited comet as its spacecraft saw it: Tempel 1's pits and smooth flows (Deep Impact), Hartley 2's mounded lobes and smooth waist (EPOXI), Wild 2's flat-floored pits (Stardust), Borrelly's mesas, plains and dark spots (Deep Space 1). The unresolved five take Tempel 1's." },
      B: { title: "All as dirty snowballs", terrains: Object.fromEntries(["9P/Tempel 1", "103P/Hartley 2", "81P/Wild 2", "19P/Borrelly", "2P/Encke", "12P/Pons-Brooks", "C/2014 UN271", "C/1995 O1 Hale-Bopp", "C/2020 F3 NEOWISE"].map((n) => [n, "snowball"])),
        why: "The binaries' snowball: small fresh icy craters and fractures. For comparison — no visited comet looks like this; they are pitted, not cratered." },
    },
  },
  {
    key: "interstellar",
    name: "Interstellar",
    brief: "None of the three has ever been resolved. ʻOumuamua showed no activity; Borisov and 3I/ATLAS are comets.",
    members: ["1I/ʻOumuamua", "2I/Borisov", "3I/ATLAS"],
    variants: {
      A: { title: "Rock and two comets", terrains: { "1I/ʻOumuamua": "unresolved", "2I/Borisov": "cometPitted", "3I/ATLAS": "cometPitted" },
        why: "ʻOumuamua as a plain, softly mottled body — nothing is known of its surface — and the two comets with a comet's pits and flows." },
      B: { title: "All unresolved", terrains: { "1I/ʻOumuamua": "unresolved", "2I/Borisov": "unresolved", "3I/ATLAS": "unresolved" },
        why: "The most cautious reading: soft mottling and worn craters on all three." },
    },
  },
  {
    key: "trojans",
    name: "Trojans & Hilda",
    brief: "Jupiter's Trojans and their moons, and Hilda. None seen close up yet: Lucy reaches Eurybates in August 2027. Old, dark, mostly very red D-types; Eurybates is grey.",
    members: ["Hektor", "Skamandrios", "Patroclus", "Menoetius", "Eurybates", "Queta", "Polymele", "Shaun", "Leucus", "Orus", "Hilda"],
    variants: {
      A: { title: "Ancient and cratered", terrains: {
        Hektor: "saturated", Skamandrios: "saturated", Patroclus: "saturated", Menoetius: "saturated",
        Eurybates: "giants", Queta: "rubble", Polymele: "saturated", Shaun: "rubble",
        Leucus: "giants", Orus: "saturated", Hilda: "saturated" },
        why: "Cratered to saturation like Callisto, because the Trojans are as old as the Solar System. Eurybates, the head of a shattered family, and Leucus with its big depression take Mathilde's giant craters; the small moons are rubble." },
      B: { title: "Kuiper-like", terrains: {
        Hektor: "mounds", Skamandrios: "rubble", Patroclus: "mounds", Menoetius: "mounds",
        Eurybates: "giants", Queta: "rubble", Polymele: "mounds", Shaun: "rubble",
        Leucus: "mounds", Orus: "mounds", Hilda: "saturated" },
        why: "If the Trojans are captured Kuiper Belt objects, they may look like Arrokoth: smooth mounds, few craters." },
    },
  },
  {
    key: "lucy",
    name: "Lucy's belt flybys",
    brief: "Seen close up by Lucy: Dinkinesh and its contact-binary moon Selam (2023), Donaldjohanson (2025).",
    members: ["Donaldjohanson", "Dinkinesh", "Selam"],
    variants: {
      A: { title: "As Lucy saw them", terrains: { Donaldjohanson: "saturated", Dinkinesh: "rubble", Selam: "rubble" },
        why: "Donaldjohanson's two cratered lobes (more craters on the larger); Dinkinesh and Selam as the rubble their ridge, trough and boulders show." },
      B: { title: "Grooved", terrains: { Donaldjohanson: "grooved", Dinkinesh: "rubble", Selam: "rubble" },
        why: "Donaldjohanson with grooves, for its landslide-marked neck." },
    },
  },
  {
    key: "neos",
    name: "Near-Earth oddities",
    brief: "Toutatis was photographed by Chang'e-2; Phaethon, Moshup and Geographos have radar shapes; Kamoʻoalewa has one Tianwen-2 image; Cruithne nothing.",
    members: ["Phaethon", "Toutatis", "Kamoʻoalewa", "Cruithne", "Moshup", "Squannit", "Geographos"],
    variants: {
      A: { title: "By what is known", terrains: {
        Phaethon: "rubble", Toutatis: "rubble", "Kamoʻoalewa": "unresolved", Cruithne: "unresolved",
        Moshup: "rubble", Squannit: "rubble", Geographos: "grooved" },
        why: "Phaethon a B-type like Bennu; Toutatis boulder-strewn as Chang'e-2 saw; Moshup the rubble its ridge implies; Geographos an S-type with Eros's grooves; the two unknowns plain." },
      B: { title: "Cratered", terrains: {
        Phaethon: "saturated", Toutatis: "saturated", "Kamoʻoalewa": "unresolved", Cruithne: "saturated",
        Moshup: "rubble", Squannit: "rubble", Geographos: "saturated" },
        why: "More craters, fewer boulders." },
    },
  },
]);

/* Lobed shapes in the catalogues: the collar and neck features apply. */
export const RANK_LOBED = new Set([...RANK_RECORDS.values()]
  .filter((r) => (r.shape?.lobes?.length ?? 0) >= 2).map((r) => r.name));

/*
 * Per-body tuning from the owner's third review (Prompts.md, round 3), laid
 * over whichever variant is picked for the group:
 *
 *   tweaks   multipliers on the lab's sliders (hue is added, not
 *            multiplied), so "a little terrain" is relief x1.4 and "heavy
 *            craters and terrain" craters x2, relief x2.3;
 *   add      recipe parts the terrain lacks -- craters on Borrelly's
 *            plains, boulders on Geographos, giant basins on Cruithne;
 *   chroma   the colour, where the owner described it: a linear R:G:B
 *            ratio (G = 1) that sets only the map's hue -- the measured
 *            albedo still sets brightness. Each follows the class or
 *            measurement quoted with it but is a step more saturated than
 *            the literal value (Leucus's D-type B-R 1.24 is R:G 1.10),
 *            because the scene's ACES tone map pulls a moderate chroma back
 *            towards grey (the Gǃòʼé ǃHú lesson, smallBodies.js) and the
 *            owner asked for the cast to be seen. They stay well under the
 *            TNO colour maps the owner approved (Chiminigagua R:G 2.95).
 *
 * The geometry got the matching relief in the catalogues; this is the map
 * half of the same request.
 */
const BODY_TUNING = Object.freeze({
  /* "A few craters and terrain". Deep Space 1 saw no impact craters but
   * did see pits and depressions (Britt et al. 2004), so these are shallow,
   * worn and few. */
  "19P/Borrelly": { tweaks: { relief: 1.6 },
    add: { craters: { count: 40, rmin: 0.02, rmax: 0.08, slope: 1.8, wearMin: 0.45, wearBias: 1.4, fresh: 0 } } },
  /* "Heavy terrain and craters". */
  "C/2014 UN271": { tweaks: { craters: 3, craterSize: 1.2, relief: 2.2 },
    add: { craters: { count: 260, rmin: 0.015, rmax: 0.16, slope: 1.8, wearMin: 0.2, wearBias: 0.8, fresh: 0.03 },
      giants: { count: 3, rmin: 0.25, rmax: 0.42, slope: 1, wearMin: 0.5, spall: 0.05 } } },
  /* "A little terrain". */
  "C/1995 O1 Hale-Bopp": { tweaks: { relief: 1.5, craters: 1.5 } },
  "C/2020 F3 NEOWISE": { tweaks: { relief: 1.5, craters: 1.5 } },
  /* "Some terrain". */
  "1I/ʻOumuamua": { tweaks: { relief: 1.8, craters: 1.6 } },
  "2I/Borisov": { tweaks: { relief: 1.6, craters: 1.6 } },
  "3I/ATLAS": { tweaks: { relief: 1.6, craters: 1.6 } },
  /* "A few more, deeper craters". */
  Hektor: { tweaks: { craters: 1.4, craterSize: 1.2, relief: 1.7 } },
  /* "Spectrally less-red ... significantly more neutral, greyish ...
   * shallower visible slope": Patroclus is in the less-red Trojan group
   * (Emery, Burr & Cruikshank 2011; Wong & Brown 2016). A barely warm grey. */
  Patroclus: { tweaks: { craters: 1.4, relief: 1.7 },
    chroma: [1.06, 1.0, 0.97] },
  /* "Slightly redder and more saturated ... dark brownish or faint reddish".
   * The pair's colour is only measured together; the split is the owner's
   * brief, kept inside the red Trojan range. */
  Menoetius: { tweaks: { craters: 1.4, relief: 1.7 },
    chroma: [1.35, 1.0, 0.85] },
  /* "More craters and heavy terrain". */
  Eurybates: { tweaks: { craters: 2.2, relief: 2.3 } },
  /* "Dark, neutral, carbonaceous ... less red (or bluer) than typical
   * Trojans": Queta shares Eurybates' grey C-type colour (its record). */
  Queta: { chroma: [0.95, 1.0, 1.08] },
  /* "Heavy craters and terrain"; "very dark, dark greyish, subtly reddish"
   * for both. Polymele is a P-type, less red than the D-types (its card),
   * B-R 1.13 from its catalogue colour indices. */
  Polymele: { tweaks: { craters: 2, craterSize: 1.2, relief: 2.3 },
    chroma: [1.2, 1.0, 0.93] },
  Shaun: { chroma: [1.2, 1.0, 0.93] },
  /* "Exceptionally dark, charcoal-grey rock with a distinct deep reddish or
   * rusty cast"; a little terrain. Leucus is a D-type, the reddest class
   * (its card). */
  Leucus: { tweaks: { relief: 1.4 },
    chroma: [1.6, 1.0, 0.8] },
  /* "Charcoal-dark rock with a subtle dark burgundy or reddish-brown tint";
   * slight terrain. */
  Orus: { tweaks: { relief: 1.3 },
    chroma: [1.4, 1.0, 0.95] },
  /* "A little terrain". */
  Hilda: { tweaks: { relief: 1.4 } },
  /* Craters and terrain, as Lucy saw (Levison et al. 2025). */
  Donaldjohanson: { tweaks: { craters: 1.6, relief: 1.8 } },
  /* "Dark, heavily scorched, slightly blue-tinged charcoal": a B-type with
   * a blue slope whose ground reaches ~750-780 C at its 0.14 AU perihelion
   * (its card). */
  Phaethon: { chroma: [0.93, 1.0, 1.12] },
  /* "Rocky, rugged, cratered ... homogeneous, muted brownish-red": an
   * S-type, as its catalogue colour records. */
  Toutatis: { tweaks: { craters: 1.8, relief: 1.6 },
    add: { craters: { count: 260, rmin: 0.015, rmax: 0.12, slope: 1.9, wearMin: 0.2, wearBias: 0.8, fresh: 0.03 } },
    chroma: [1.5, 1.0, 0.75] },
  /* "Heavy terrain heights"; reddened, "though recent observations show it
   * less red and more neutral / silicate-like" (Sharkey et al. 2021 red;
   * the 2026 JWST spectrum grey): a neutral grey with a faint warmth. */
  "Kamoʻoalewa": { tweaks: { relief: 2.6 },
    add: { rubble: { levels: [
      { freq: 10, amp: 0.55, toneVar: 0.18, gapDark: 0.03, cover: 0.8 },
      { freq: 28, amp: 0.4, toneVar: 0.2, gapDark: 0.03, cover: 0.7 },
    ] } },
    chroma: [1.16, 1.0, 0.88] },
  /* "Must have large craters". */
  Cruithne: { tweaks: { craterSize: 1.5 },
    add: { giants: { count: 4, rmin: 0.28, rmax: 0.5, slope: 1, wearMin: 0.5, spall: 0.05 } } },
  /* "Reddish-grey to light yellowish-brown ... rugged rubble pile: fine
   * regolith, fractured bedrock and large boulders". S-type (B-V 0.862). */
  Geographos: { tweaks: { relief: 1.8 },
    add: { rubble: { levels: [
      { freq: 12, amp: 0.45, toneVar: 0.2, gapDark: 0.035, cover: 0.6 },
      { freq: 32, amp: 0.35, toneVar: 0.22, gapDark: 0.03, cover: 0.5 },
    ] } },
    chroma: [1.3, 1.0, 0.72] },
});

export const PALETTES = Object.freeze({
  ...BINARY_PALETTES,
  ...Object.fromEntries([...RANK_RECORDS.values()].map((r) => [r.name,
    paletteFromChroma(BODY_TUNING[r.name]?.chroma ?? r.chroma)])),
});

/* A body's tuning, for the lab to show what was applied. */
export const bodyTuning = (name) => BODY_TUNING[name] ?? null;

export const SEEDS = Object.freeze({
  ...BINARY_SEEDS,
  ...Object.fromEntries([...RANK_RECORDS.values()].map((r, i) => [r.name, r.shape?.seed ?? 5000 + i])),
});

export const SYSTEMS = Object.freeze([...BINARY_SYSTEMS, ...RANK_GROUPS]);

export function specFor(system, variantKey, body, { width = 1024, height = 512, lobed = false, tweaks = {} } = {}) {
  const variant = system.variants[variantKey];
  const terrain = variant.terrains[body];
  const tuning = BODY_TUNING[body];
  const recipe = merge(terrain, body);
  let combined = tweaks;
  if (tuning) {
    // Parts the terrain already has are left as they are; the tweaks scale them.
    for (const [key, part] of Object.entries(tuning.add ?? {})) {
      if (!recipe[key]) recipe[key] = JSON.parse(JSON.stringify(part));
    }
    combined = { ...tweaks };
    for (const [key, value] of Object.entries(tuning.tweaks ?? {})) {
      combined[key] = key === "hue" ? (combined[key] ?? 0) + value : (combined[key] ?? 1) * value;
    }
  }
  return {
    width, height, lobed,
    seed: SEEDS[body] ?? 1,
    palette: PALETTES[body],
    recipe,
    tweaks: combined,
    terrain,
  };
}

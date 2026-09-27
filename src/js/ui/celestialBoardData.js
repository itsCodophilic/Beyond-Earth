import { PLANET_CONFIGS, TRANS_NEPTUNIAN_NAMES } from "../planets/index.js";
import {
  HELIOCENTRIC_ORBIT_AU,
  PLANET_SCALE_PROFILES,
} from "../config/celestialScale.js";
import { SMALL_BODIES } from "../scene/smallBodies/smallBodyCatalogue.js";
import { MAIN_BELT_WORLDS } from "../scene/smallBodies/mainBeltCatalogue.js";
import { CENTAURS } from "../scene/smallBodies/centaurCatalogue.js";
import { TRANS_NEPTUNIAN_WORLDS } from "../scene/smallBodies/tnoCatalogue.js";
import { KUIPER_BINARIES } from "../scene/smallBodies/binaryCatalogue.js";
import { BELT_MAJOR_ROCKS } from "../scene/beltMajorOrbitGuides.js";
import { hasIcyRingSystem } from "../planets/icyRings.js";
import { JUPITER_MOON_PROFILES } from "../planets/jupiter/satellites/jovianMoonCatalog.js";
import { SATURN_MOON_PROFILES } from "../planets/saturn/satellites/saturnianMoonCatalog.js";
import { URANUS_MOON_PROFILES } from "../planets/uranus/satellites/uranianMoonCatalog.js";
import { NEPTUNE_MOON_PROFILES } from "../planets/neptune/satellites/neptunianMoonCatalog.js";
import { PLUTO_MOON_PROFILES } from "../planets/pluto/satellites/plutonianMoonCatalog.js";
import { TRANS_NEPTUNIAN_MOON_SYSTEMS } from "../planets/satellites/transNeptunianMoonCatalog.js";

/**
 * Everything the scene can fly to, arranged by where it is.
 *
 * The data half of the celestial board (`celestialBoard.js` draws it). Kept
 * apart so it can be checked in plain Node, and so it is built from the same
 * catalogues the scene is built from -- nothing here is a second copy of a
 * measurement, only the arrangement is written here.
 *
 * ## The regions
 *
 * The board reads left to right as outward from the Sun, one column per
 * region, and a body sits in the region its *semi-major axis* falls in. That
 * is the standard way these populations are defined, with two consequences
 * worth knowing: Halley (a = 17.8 AU) sits among the giant planets although
 * it dives inside Venus's orbit, and 67P (a = 3.46 AU) sits with the belt.
 * Boundaries:
 *
 *   inner planets        < 1.8 AU, with the near-Earth asteroids
 *   main belt            1.8 - 4.2 AU. 2.1 - 3.3 is the conventional belt
 *                        (the 4:1 and 2:1 Kirkwood gaps); the margins take
 *                        the belt's own outliers
 *   giants & Centaurs    4.2 - 30.1 AU, Jupiter to Neptune
 *   plutinos             30.1 - 41.2 AU (inner Kuiper Belt and the 3:2)
 *   classical belt       41.2 - 47.7 AU, the "cliff" at 47.7
 *   scattered disc       47.7 - 150 AU
 *   detached & inner Oort  > 150 AU, beyond the heliopause (~120 AU)
 *   Oort Cloud           2,000 - 100,000 AU. Nothing drawn lives there;
 *                        it is shown because it is where the edge is.
 *
 * The same boundaries `kuiperBelt.js`'s region cards use, so the board and the
 * scene describe one Solar System.
 */

/* Mean semi-major axes (AU) of the five belt majors built inside the frozen
 * asteroidBelt.js, which exposes none: JPL SBDB, rounded to 3 decimals.
 * Diameters are the ones `beltMajorOrbitGuides.js`'s summaries quote. */
const BELT_MAJOR_ORBITS = Object.freeze({
  Ceres: { aAU: 2.767, diameterKm: 939 },
  Vesta: { aAU: 2.362, diameterKm: 525 },
  Pallas: { aAU: 2.773, diameterKm: 513 },
  Hygiea: { aAU: 3.142, diameterKm: 434 },
  Psyche: { aAU: 2.924, diameterKm: 222 },
});

/* A swatch per planet-builder world -- chosen by eye from each world's own
 * surface map, for a dot on a chart. Not a measurement, and not used as one. */
const WORLD_SWATCH = Object.freeze({
  Sun: "#ffcf7a",
  Mercury: "#9d958c", Venus: "#e6c992", Earth: "#4f86c6", Mars: "#c46a3f",
  Jupiter: "#d9b48c", Saturn: "#e3cf9f", Uranus: "#9fd8df", Neptune: "#5078d8",
  Pluto: "#d2b597", Orcus: "#9aa0a6", Haumea: "#e8e4dc", Quaoar: "#a8735a",
  Makemake: "#c9906a", Gonggong: "#a45a45", Eris: "#e9e6e0", Sedna: "#b04a36",
  Ixion: "#a8765e", Salacia: "#6e6862", Varuna: "#9c6a55", Varda: "#a88070",
});

/* Rings that are drawn in the scene for planet-builder worlds. The icy ring
 * table covers Haumea and Quaoar and the Centaurs; the giants' rings are
 * their own modules. */
const GIANT_RINGS = new Set(["Jupiter", "Saturn", "Uranus", "Neptune"]);

export const BOARD_REGIONS = Object.freeze([
  { key: "sun", title: "The Sun", from: 0, to: 0.3,
    blurb: "One star, with 99.86 per cent of the Solar System's mass." },
  { key: "inner", title: "Inner planets", from: 0.3, to: 1.8,
    blurb: "The four rocky worlds, and the asteroids whose orbits cross or skirt Earth's." },
  { key: "belt", title: "Main asteroid belt", from: 1.8, to: 4.2,
    blurb: "Between Mars and Jupiter. Most of its mass is in four bodies; the rest is millions of rocks." },
  { key: "giants", title: "Giant planets & Centaurs", from: 4.2, to: 30.1,
    blurb: "Jupiter to Neptune, and the icy Centaurs caught between them on orbits that last a few million years." },
  { key: "plutinos", title: "Plutinos", from: 30.1, to: 41.2,
    blurb: "The inner Kuiper Belt: Pluto and the worlds locked with it in Neptune's 3:2 resonance." },
  { key: "classical", title: "Classical Kuiper Belt", from: 41.2, to: 47.7,
    blurb: "The main body of the belt, ending at an unexplained cliff at 47.7 AU." },
  { key: "scattered", title: "Scattered disc", from: 47.7, to: 150,
    blurb: "Flung outward by Neptune onto long, tilted orbits. The heliopause is at about 120 AU." },
  { key: "detached", title: "Detached & inner Oort", from: 150, to: 2000,
    blurb: "Worlds whose closest approach is beyond Neptune's reach. Something else put them there." },
  { key: "oort", title: "Oort Cloud", from: 2000, to: 100000,
    blurb: "A shell of perhaps trillions of comet nuclei, out to 100,000 AU. Nothing here has ever been seen." },
]);

export function regionFor(aAU) {
  const a = Number(aAU);
  const region = BOARD_REGIONS.find((r) => a >= r.from && a < r.to);
  return region?.key ?? "oort";
}

/* Light-travel time to a distance, for the column headers: 499.0 s per AU. */
export function lightTime(aAU) {
  const seconds = Number(aAU) * 499.0;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 365) return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
  return `${(days / 365.25).toFixed(1)} years`;
}

/* Measured chroma -> a display swatch. Brightness is flattened on purpose: a
 * dot at a Kuiper Belt object's real albedo would be black. */
function swatchFromChroma(chroma) {
  const c = Array.isArray(chroma) ? chroma : [1, 1, 1];
  const base = [0.66, 0.62, 0.58];
  const hex = c.map((v, i) => Math.round(Math.min(1, Math.max(0, base[i] * v)) * 255)
    .toString(16).padStart(2, "0")).join("");
  return `#${hex}`;
}

function satellitesOf(record) {
  const list = Array.isArray(record?.moons) ? record.moons : (record?.moon ? [record.moon] : []);
  return list.filter(Boolean);
}

/*
 * A moon as the moon board needs it: how big, how far from its planet, how
 * long its year is, which way it goes round, and which family it belongs to.
 * All straight from each catalogue's profile. `family` is the catalogue's own
 * grouping (Galilean, Himalia family, Norse irregular...), which is how
 * planetary scientists group them too.
 */
function moonList(profiles) {
  return (profiles ?? [])
    .filter((p) => p?.name)
    .map((p) => ({
      name: p.name,
      diameterKm: Number(p.diameterKm) || null,
      distanceKm: Number(p.semiMajorAxisKm) || null,
      periodDays: Number(p.periodDays) || null,
      retrograde: Boolean(p.retrograde),
      family: p.family ?? "Moons",
    }));
}

const PLANET_MOONS = Object.freeze({
  /* The Moon: 384,399 km mean distance, 27.3217-day sidereal month (NASA
   * Moon fact sheet). */
  Earth: [{ name: "Moon", diameterKm: 3474.8, distanceKm: 384399, periodDays: 27.3217, retrograde: false, family: "Natural satellite" }],
  /* Phobos 22.5 km and Deimos 12.4 km mean diameters (Thomas 1989), as their
   * own modules quote; semi-major axes 9,376 and 23,463 km and periods 0.31891
   * and 1.26244 days from the NASA Mars fact sheet. Listed here so this file
   * stays Node-safe -- their modules import three.js factories. */
  Mars: [
    { name: "Phobos", diameterKm: 22.5, distanceKm: 9376, periodDays: 0.31891, retrograde: false, family: "Captured-asteroid moons" },
    { name: "Deimos", diameterKm: 12.4, distanceKm: 23463, periodDays: 1.26244, retrograde: false, family: "Captured-asteroid moons" },
  ],
  Jupiter: moonList(JUPITER_MOON_PROFILES),
  Saturn: moonList(SATURN_MOON_PROFILES),
  Uranus: moonList(URANUS_MOON_PROFILES),
  Neptune: moonList(NEPTUNE_MOON_PROFILES),
  Pluto: moonList(PLUTO_MOON_PROFILES),
  ...Object.fromEntries(Object.entries(TRANS_NEPTUNIAN_MOON_SYSTEMS)
    .map(([parent, profiles]) => [parent, moonList(profiles)])),
});

function kindForSmallBody(record) {
  const text = `${record.classification ?? ""} ${record.info?.population ?? ""}`;
  if (/centaur/i.test(text)) return "centaur";
  if (/comet/i.test(text)) return "comet";
  if (/trans-neptunian|sednoid|kuiper/i.test(text)) return "tno";
  if (/near-earth/i.test(text)) return "nea";
  return "asteroid";
}

export const BODY_KINDS = Object.freeze({
  sun: "Star",
  planet: "Planet",
  dwarf: "Dwarf planet",
  tno: "Trans-Neptunian world",
  asteroid: "Asteroid",
  nea: "Near-Earth asteroid",
  centaur: "Centaur",
  comet: "Comet",
});

let cached = null;

/*
 * Which systems are binaries, for the board's "Binaries & triples" filter.
 *
 * Two tests, either enough. The catalogue calls it one -- Didymos, Huya,
 * the Rank 4 batch B systems, anything whose partner is a "binary
 * companion" or "binary partner". Or the centre of mass lies outside the
 * primary: a q / (1 + q) > R1, with q = (d2 / d1)^3 at equal density, which
 * is the usual line between a planet with a moon and a double body -- it is
 * what makes Pluto and Charon a binary and Earth and the Moon not. Planets
 * are never counted. Worked through, the second test adds Pluto (2,300 km
 * outside a 1,188 km radius) and turns down Eris,
 * Haumea and Quaoar, whose moons are too small. (Orcus and Varda also pass
 * the first test, their partners being catalogued as binary companions.)
 */
function isBinarySystem(body) {
  if (body.kind === "planet" || body.kind === "sun" || !body.moons.length) return false;
  const text = `${body.classification ?? ""} ${body.detail ?? ""} ${body.moons.map((m) => m.family).join(" ")}`;
  if (/binary|triple/i.test(text)) return true;
  const r1 = Number(body.diameterKm) / 2;
  if (!Number.isFinite(r1) || r1 <= 0) return false;
  return body.moons.some((moon) => {
    const a = Number(moon.distanceKm);
    const d2 = Number(moon.diameterKm);
    if (!Number.isFinite(a) || !Number.isFinite(d2) || d2 <= 0) return false;
    const q = (d2 / (r1 * 2)) ** 3;
    return (a * q) / (1 + q) > r1;
  });
}

/**
 * @returns {{ regions, bodies, moonCount, bodyCount }}
 *   bodies: [{ name, kind, aAU, region, diameterKm, swatch, rings, moons }]
 */
export function buildCelestialBoard() {
  if (cached) return cached;
  const bodies = [];

  bodies.push({
    name: "Sun", kind: "sun", aAU: 0, region: "sun",
    diameterKm: 1_392_700, swatch: WORLD_SWATCH.Sun, rings: false, moons: [],
    detail: "G2V main-sequence star",
  });

  PLANET_CONFIGS.forEach((config) => {
    const name = config.name;
    const aAU = HELIOCENTRIC_ORBIT_AU[name];
    if (!Number.isFinite(aAU)) return;
    const type = String(config.info?.type ?? "");
    const kind = /^planet$/i.test(type) ? "planet" : "dwarf";
    bodies.push({
      name,
      kind,
      aAU,
      region: regionFor(aAU),
      diameterKm: PLANET_SCALE_PROFILES[name]?.diameterKm ?? config.physicalDiameterKm ?? null,
      swatch: WORLD_SWATCH[name] ?? "#b8a898",
      rings: GIANT_RINGS.has(name) || hasIcyRingSystem(name),
      moons: PLANET_MOONS[name] ?? [],
      detail: String(config.detail ?? "").split("|")[1]?.trim() || type,
      isTransNeptunian: TRANS_NEPTUNIAN_NAMES.includes(name),
    });
  });

  BELT_MAJOR_ROCKS.forEach(({ name, summary }) => {
    const orbit = BELT_MAJOR_ORBITS[name];
    if (!orbit) return;
    bodies.push({
      name,
      kind: name === "Ceres" ? "dwarf" : "asteroid",
      aAU: orbit.aAU,
      region: regionFor(orbit.aAU),
      diameterKm: orbit.diameterKm,
      swatch: name === "Psyche" ? "#b8b2a4" : "#b9a282",
      rings: false,
      moons: [],
      detail: summary,
    });
  });

  [...SMALL_BODIES, ...MAIN_BELT_WORLDS, ...CENTAURS, ...TRANS_NEPTUNIAN_WORLDS, ...KUIPER_BINARIES].forEach((record) => {
    const aAU = Number(record.orbit?.aAU);
    if (!Number.isFinite(aAU)) return;
    const kind = kindForSmallBody(record);
    bodies.push({
      name: record.name,
      kind,
      aAU,
      region: regionFor(aAU),
      diameterKm: Number(record.diameterKm) || null,
      swatch: swatchFromChroma(record.chroma),
      rings: hasIcyRingSystem(record.name),
      moons: satellitesOf(record).map((m) => ({
        name: m.name,
        diameterKm: Number(m.diameterKm) || null,
        distanceKm: Number(m.separationKm) || null,
        periodDays: Number(m.periodHours) ? Number(m.periodHours) / 24 : null,
        /* A mutual orbit tilted past 90 degrees goes round backwards --
         * Sawiskera, Altjira's partner, Nunam. Ordinary moons here have no
         * published tilt and stay prograde. */
        retrograde: Number(m.inclinationDeg) > 90,
        family: m.family ?? (m.barycentric ? "Binary partner" : "Moons"),
        partner: Boolean(m.barycentric),
        /* What the binary system view draws: the published mutual orbit
         * (eccentricity, mass ratio, which centre it goes round) and the
         * body's own spin and shape. Straight from binaryCatalogue.js. */
        eccentricity: Number(m.eccentricity) || 0,
        massRatio: Number.isFinite(Number(m.massRatio)) ? Number(m.massRatio) : null,
        around: m.around ?? null,
        inclinationDeg: Number.isFinite(Number(m.inclinationDeg)) ? Number(m.inclinationDeg) : null,
        locked: Boolean(m.tidallyLocked),
        rotationHours: Number(m.rotationHours) || null,
        lobed: (m.shape?.lobes?.length ?? 0) >= 2,
        classification: m.classification ?? "",
      })),
      detail: String(record.detail ?? "").split("|")[0]?.trim() || record.classification,
      classification: record.classification ?? "",
      rotationHours: Number(record.rotationHours) || null,
      locked: Boolean(record.tidallyLocked),
      lobed: (record.shape?.lobes?.length ?? 0) >= 2,
    });
  });

  bodies.forEach((body) => {
    body.binary = isBinarySystem(body);
    /* Every companion a partner going round a shared centre: the five Rank 4
     * batch B systems. These open the binary system view, not a moon board,
     * and are listed under all their names together. */
    body.partnerSystem = body.moons.length > 0 && body.moons.every((m) => m.partner);
  });
  bodies.sort((a, b) => a.aAU - b.aAU);
  const moonCount = bodies.reduce((sum, b) => sum + b.moons.length, 0);
  cached = Object.freeze({
    regions: BOARD_REGIONS,
    bodies,
    moonCount,
    bodyCount: bodies.length,
  });
  return cached;
}

import * as THREE from "three";
import { attachDecimatedPickPath } from "../orbitGuideHover.js";
import {
  SOLAR_ORBIT_SCALE,
  compressedPlanetRadius,
  getAsteroidVisualRadius,
  getSizeComparisonText,
} from "../../config/celestialScale.js";
import { markPointerProxy } from "../pointerProxies.js";
import { SMALL_BODIES, albedoToLinearValue } from "./smallBodyCatalogue.js";
import { MAIN_BELT_WORLDS } from "./mainBeltCatalogue.js";
import { CENTAURS } from "./centaurCatalogue.js";
import { TRANS_NEPTUNIAN_WORLDS } from "./tnoCatalogue.js";
import { createCentaurComa, updateCentaurComa } from "./centaurComa.js";
import { createIcyRingSystem, hasIcyRingSystem } from "../../planets/icyRings.js";
import { applyRingProximityVisibility } from "../../planets/ringProximity.js";

/*
 * Two catalogues, one builder.
 *
 * Rank 1 is the bodies a spacecraft has photographed; Rank 2 is the eleven
 * largest main-belt worlds nobody has been to, which have measured shapes
 * and borrowed surfaces; Rank 3 is the four Centaurs, which have never been
 * resolved at all and are known entirely from watching them pass in front of
 * stars. They are kept in separate files because the evidence behind them is
 * different and a reader should not have to check which kind a record is --
 * but they are the same *kind of object* to this module, so they go through
 * one loop rather than three.
 *
 * Two things only the Centaurs have: a measured pole, and rings. Both are
 * handled by the general builder rather than by a branch, because both are
 * optional fields on a record and neither is likely to stay unique for long.
 */
const ALL_SMALL_BODIES = Object.freeze([
  ...SMALL_BODIES,
  ...MAIN_BELT_WORLDS,
  ...CENTAURS,
  /* Rank 4, batch A: fourteen trans-Neptunian worlds and five moons. */
  ...TRANS_NEPTUNIAN_WORLDS,
]);
import { createSmallBodyGeometry, maxHalfExtent } from "./smallBodyShapes.js";

/**
 * The visited small bodies, as a self-contained scene module.
 *
 * Thirteen objects from Rank 1 of `docs/bodies-to-draw-next.md`, plus the two
 * moons that come with them -- Dactyl and Dimorphos. Everything they need
 * lives in this folder: the measurements in `smallBodyCatalogue.js`, the
 * silhouettes in `smallBodyShapes.js`, the placement and the per-frame motion
 * here. Nothing is scattered into `celestialScale.js`, `planets/index.js` or
 * `satelliteSystem.js`, and there is nothing to keep in sync in three files
 * when one of them changes.
 *
 * ## What this costs
 *
 * Fifteen meshes, fifteen draw calls, no textures, no orbit lines, no
 * transparency and no per-frame material work. The pointer proxies go on the
 * dedicated proxy layer, which the camera does not render -- see
 * `scene/pointerProxies.js` for why that mattered: four hundred and forty
 * invisible proxies were costing 2.7 ms a frame before they were moved. The
 * per-frame update is one Kepler solve and two quaternion compositions per
 * body, for fifteen bodies.
 *
 * Geometry is built once, co-operatively, during the progressive belt build,
 * because sculpting a body vertex by vertex is the expensive part and doing
 * fifteen of them in one synchronous pass would visibly stall the opening.
 *
 * ## Why these are not in the asteroid belt
 *
 * Three reasons. Most of them are not in the belt -- six are near-Earth
 * objects, one is a Kuiper Belt object 44 AU out and one is a comet currently
 * past Neptune. The belt's five major bodies are sculpted by its own archetype
 * system, which produces a plausible rock rather than a measured one, and
 * these have measured shapes that deserve to be drawn. And `asteroidBelt.js`
 * is off limits for editing.
 *
 * ## Moons without the satellite system
 *
 * Ida-Dactyl and Didymos-Dimorphos are parent-with-moon systems, and
 * `planets/satellites/satelliteSystem.js` is the machinery this project
 * normally uses for those. It is not used here, deliberately: that system is
 * built for planetary satellites -- it wants a `PARENT_ORBITAL_SCALE` row, an
 * orbit-line budget, a dense-field instancer and an idle-time hydration queue,
 * all sized for Jupiter's hundred and fifteen moons. Dactyl is 1.4 km across
 * and orbits 90 km out. Building it here is fifteen lines, and it keeps a
 * shared file that has broken every moon in the scene once before out of the
 * change set entirely.
 */

/*
 * Astronomical units to scene radius, for the inner Solar System.
 *
 * `celestialScale.js` exports `auToSceneRadius`, and it cannot be used here:
 * its anchor table starts at Neptune's 30.07 AU, so everything inside that
 * collapses onto one value. It was written for the outer boundaries and the
 * Kuiper Belt and it is right for them.
 *
 * These anchors are the positions the scene's existing bodies were actually
 * placed at, in orbit units, against their real semi-major axes -- Mercury at
 * 14, Earth at 29, Mars at 40, the belt spanning 44 to 52 for 2.2 to 3.2 AU,
 * Jupiter at 75, and so on out to Sedna. Interpolating in log space between
 * them means a new body lands *between* the worlds already there instead of
 * on top of one, which is the same rule the outer table follows and the same
 * reason it exists.
 *
 * The inner extension to 0.1 AU is chosen, not measured: nothing was ever
 * placed inside Mercury. It is there so Halley's 0.575 AU perihelion and
 * Apophis's 0.746 AU one land outside the Sun's rendered disc, which is 92
 * scene units -- 8.8 orbit units -- and would otherwise swallow them.
 */
const AU_ANCHORS = Object.freeze([
  [0.10, 10.8], [0.3871, 14], [0.7233, 21], [1.0, 29], [1.5237, 40],
  [2.2, 44], [3.2, 52], [5.2029, 75], [9.5367, 108], [19.1892, 145],
  [30.0699, 178], [39.482, 191], [45.571, 220], [67.934, 244], [506.44, 268],
  /* Past Sedna, the same run `celestialScale.js`'s AU_SCENE_ANCHORS uses to
   * 100,000 AU. Nothing reached beyond 506 AU until Leleākūhonua, whose far
   * point is about 2,600 AU; without this every point of its orbit past
   * Sedna's distance clamped onto one radius and the guide grew a flat arc. */
  [100_000, 601],
]);

export function smallBodyAuToScene(au) {
  const x = Math.log10(Math.max(0.02, au));
  for (let i = 0; i < AU_ANCHORS.length - 1; i += 1) {
    const [a0, s0] = AU_ANCHORS[i];
    const [a1, s1] = AU_ANCHORS[i + 1];
    const l0 = Math.log10(a0);
    const l1 = Math.log10(a1);
    if (x <= l1 || i === AU_ANCHORS.length - 2) {
      const t = THREE.MathUtils.clamp((x - l0) / (l1 - l0), 0, 1);
      return (s0 + (s1 - s0) * t) * SOLAR_ORBIT_SCALE;
    }
  }
  return AU_ANCHORS[0][1] * SOLAR_ORBIT_SCALE;
}

/*
 * Cancelling the Sun's falloff, so that what you see is the albedo.
 *
 * The scene has exactly one light reaching these bodies: a point light at
 * the Sun of intensity 28,000 with `decay` set to 1.28 rather than the
 * physical 2. Over the range they occupy that is still an enormous swing --
 * Apophis sits 245 scene units out and Arrokoth 2,181, so Apophis receives
 * sixteen times the irradiance. Rendered untouched, *where a body is* beats
 * *what a body is made of* by a wide margin, and the whole point of this
 * module goes with it.
 *
 * Measured before this existed, by reading the framebuffer with the body
 * focused and the camera settled: Eros came out with a median body pixel of
 * 190 out of 255 and its entire silhouette spanning 184 to 198 -- a
 * nine-per-cent range, no terminator, no craters, chalk. Measured after:
 * Eros 115, Arrokoth 93, Halley 53, Mathilde 49, and Eros against Mathilde
 * is a factor of 5.6 in linear light where their albedos differ by 5.7.
 *
 * So each body's base colour is pre-divided by the irradiance it will
 * actually receive, expressed relative to a reference radius. Every body then
 * renders as though it were lit from the same distance, and the only thing
 * left driving its brightness is its measured geometric albedo. That is a
 * deliberate departure from physical light transport, and it is the same
 * departure the scene already makes twice over: radial distance is compressed
 * by `smallBodyAuToScene` and body size by the asteroid curve. Photometric
 * accuracy at 43 AU would render Arrokoth at two per cent of Apophis and the
 * viewer would be looking at a black silhouette.
 *
 * The reference is 440 scene units, which is about 1.7 AU on this scene's
 * curve and sits in the middle of where these bodies actually are. The
 * exponent has to match `main.js`'s solar point light; if the Sun's `decay`
 * is ever retuned, this has to move with it, and the symptom will be the
 * inner bodies going bright and the outer ones going flat again.
 *
 * The clamp is a safety rail rather than a tuning knob. Nothing in the
 * catalogue reaches either end -- Apophis is the smallest factor at 0.47 and
 * Arrokoth the largest at 7.8 -- but a future body on a Sedna-like orbit
 * would otherwise ask for a multiplier in the hundreds and blow out.
 */
const SUN_DECAY_EXPONENT = 1.28;
const SUN_REFERENCE_RADIUS = 440;

function solarCompensation(sceneRadius) {
  return THREE.MathUtils.clamp(
    Math.pow(Math.max(1, sceneRadius) / SUN_REFERENCE_RADIUS, SUN_DECAY_EXPONENT),
    0.25,
    16,
  );
}

const DEG = Math.PI / 180;
/* Unix epoch in Julian Days, so today's date can be turned into a JD. */
const UNIX_EPOCH_JD = 2440587.5;

/*
 * Rotation, on the same clock the asteroid belt already uses.
 *
 * Real spin periods run from Didymos's 2.26 hours to Mathilde's 17.4 days.
 * Rendered literally, almost everything here would be motionless for the whole
 * of a visit, so the belt compresses them with a square-root curve into a
 * 4.8-to-52-second range and keeps the ordering. These are the belt's own
 * constants, repeated rather than imported because `asteroidBelt.js` does not
 * export them -- if they ever change there, change them here too.
 */
const ROTATION_REFERENCE_HOURS = 6;
const ROTATION_REFERENCE_SECONDS = 18;
const ROTATION_MIN_SECONDS = 4.8;
const ROTATION_MAX_SECONDS = 52;

function visualPeriodSeconds(periodHours) {
  const hours = Math.max(1 / 60, Number(periodHours) || ROTATION_REFERENCE_HOURS);
  return THREE.MathUtils.clamp(
    ROTATION_REFERENCE_SECONDS * Math.sqrt(hours / ROTATION_REFERENCE_HOURS),
    ROTATION_MIN_SECONDS,
    ROTATION_MAX_SECONDS,
  );
}

/*
 * Orbital rate, on the same implicit curve the planets use.
 *
 * Earth's authored `orbitSpeed` is 0.34 and main.js advances an orbit by
 * `orbitSpeed * 0.0022 * motionScale` per frame. Mars is 0.25 and Jupiter
 * 0.12, and those three points fit `(oneYear / period)^0.45` to better than
 * 10% -- the scene compresses the spread of orbital periods rather than
 * preserving it, so an outer body is not frozen on screen. Matching that
 * exponent means a new body moves at the right speed *relative to the planets
 * it is drawn next to*, which is the only comparison a viewer can make.
 */
const EARTH_ORBIT_SPEED = 0.34;
const ORBIT_SPEED_UNIT = 0.0022;
const ORBIT_PERIOD_EXPONENT = 0.45;

function visualMeanMotion(periodDays) {
  const days = Math.max(1, Number(periodDays) || 365.25);
  return EARTH_ORBIT_SPEED
    * ORBIT_SPEED_UNIT
    * Math.pow(365.25 / days, ORBIT_PERIOD_EXPONENT);
}

/** Newton-Raphson on Kepler's equation. Five passes is convergent to 1e-12 here. */
function eccentricAnomaly(meanAnomaly, e) {
  let E = e < 0.8 ? meanAnomaly : Math.PI;
  for (let i = 0; i < 8; i += 1) {
    const delta = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return E;
}

/**
 * Real heliocentric position, with the radius put through the scene's
 * compression curve.
 *
 * The angles are untouched: the argument of perihelion, the node and the
 * inclination are the published ones and the body really is in that direction
 * from the Sun. Only the distance is compressed, and it is compressed by the
 * same curve every other body in the scene sits on. What is *not* real is the
 * configuration: this scene's planets are at authored longitudes rather than
 * their true ones, so the angle between Apophis and Earth on screen is not a
 * sky you could go outside and check.
 */
function positionFromOrbit(target, orbit, meanAnomaly) {
  const e = orbit.e;
  const E = eccentricAnomaly(meanAnomaly, e);
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
  const radiusAU = orbit.aAU * (1 - e * Math.cos(E));
  const radius = smallBodyAuToScene(radiusAU);

  // Perifocal coordinates, then the three standard rotations. The scene's
  // ecliptic is the x-z plane with y up, so the usual z-up result is swapped.
  const u = orbit.argPeriRad + trueAnomaly;
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosNode = Math.cos(orbit.nodeRad);
  const sinNode = Math.sin(orbit.nodeRad);
  const cosInc = Math.cos(orbit.incRad);
  const sinInc = Math.sin(orbit.incRad);

  const x = radius * (cosNode * cosU - sinNode * sinU * cosInc);
  const yEcliptic = radius * (sinNode * cosU + cosNode * sinU * cosInc);
  const z = radius * (sinU * sinInc);

  target.set(x, z, yEcliptic);
  return { radiusAU };
}

/**
 * Turns the catalogue's orbit block into the working form, and propagates the
 * published mean anomaly forward from its own epoch to now.
 *
 * Every element set here is a JPL Small-Body Database solution fitted at a
 * stated epoch. Most are at JD 2461200.5 (9 June 2026) and need almost no
 * propagation; Bennu's is from 2011, 67P's from 2015 and Halley's from 1968.
 * Advancing the mean anomaly by the published mean motion is exact for a
 * two-body element set, and the error that accumulates is entirely in the
 * perturbations the osculating elements stop describing the moment they are
 * fitted. Over fifteen years that is small. Over Halley's fifty-eight it is
 * a few tenths of an AU, and its card says so rather than pretending.
 */
function prepareOrbit(orbit, nowJD) {
  const daysSinceEpoch = nowJD - orbit.epochJD;
  const advanced = orbit.meanAnomalyDeg + orbit.meanMotionDegPerDay * daysSinceEpoch;
  const wrapped = ((advanced % 360) + 360) % 360;
  return {
    aAU: orbit.aAU,
    e: orbit.e,
    incRad: orbit.iDeg * DEG,
    nodeRad: orbit.nodeDeg * DEG,
    argPeriRad: orbit.argPeriDeg * DEG,
    meanAnomaly: wrapped * DEG,
    periodDays: 360 / Math.max(1e-9, orbit.meanMotionDegPerDay),
    visualRate: visualMeanMotion(360 / Math.max(1e-9, orbit.meanMotionDegPerDay)),
    solution: orbit.solution,
  };
}

/**
 * The material.
 *
 * Deliberately plain: a standard material with vertex colours and no maps of
 * any kind. Colour, albedo variation, crater shading and boulder highlights
 * are all already in the geometry's colour attribute, written in linear light
 * from the body's measured geometric albedo -- so `color` stays white and does
 * not multiply into it.
 *
 * No map also means no `displacementMap`, and that is not an accident. The
 * generic rocky material in `planetFactory.js` feeds a body's surface map
 * straight into `displacementScale`, which is correct for procedural noise and
 * catastrophic for a photograph: four worlds shipped covered in spikes because
 * of it. There is no way for that to happen to anything in this folder.
 *
 * Roughness tracks albedo, weakly, because a brighter surface here generally
 * means less-weathered silicate and a darker one means carbonaceous fines;
 * neither is anywhere near specular.
 *
 * **Emissive has to be the body's own colour, not white.** Three.js applies a
 * vertex colour to `diffuseColor` only -- emissive is a flat material term and
 * a vertex attribute does not touch it. The first version set `emissive` to
 * 0xffffff at intensity 0.05 meaning "a whisper, proportional to albedo", and
 * it was nothing of the kind: it was the same flat white lift on every body
 * regardless of how dark it was. Measured, it put a floor of about 77/255 on
 * the median pixel, which is *brighter than Ceres*, and the four darkest
 * bodies in the set -- Halley, Mathilde, Bennu, Ryugu -- were sitting on it.
 * Setting emissive to the body's own base colour restores the proportionality
 * the whole module depends on: the lift is 0.28 x albedo x chroma, so it
 * scales with the body and never reorders the set.
 */
/*
 * Guarded, because this module is also imported by `scripts/check-small-
 * bodies.mjs`, which runs it in plain Node with no bundler and no DOM.
 * `import.meta.env` does not exist there, and reading `.BASE_URL` off it
 * threw at module load -- taking the whole headless harness down, which is
 * the one thing that checks these fifteen bodies still build.
 */
const PUBLIC_ASSET_ROOT = `${(import.meta.env && import.meta.env.BASE_URL) || "/"}assets`;

/**
 * Surface detail maps, and the constant that keeps them from changing a
 * measured albedo.
 *
 * Built by `tools/small-body-textures/build-small-body-textures.py` from the
 * spacecraft photographs in that folder -- see its README for which nine of
 * the fifteen are grown from a picture of the body itself and which six
 * borrow their relief from the nearest imaged analogue, and why.
 *
 * ## What the map does and does not carry
 *
 * Only variation. Every map is grey, because most of these bodies were
 * photographed by panchromatic cameras -- Bennu, Ryugu, 67P, Gaspra, Itokawa
 * and Lutetia all arrive with no measured chroma at all -- and inventing
 * colour from a monochrome frame would be fabrication. The colour that *is*
 * known already lives in the `CHROMA` table in the catalogue, measured per
 * body with its own source, next to its measured albedo. The catalogue owns
 * the absolute; the map owns the texture.
 *
 * ## `meanLinear`, and why it is not 1
 *
 * three.js multiplies the map by the vertex colour, and the vertex colours
 * here are the body's real reflectance. A mid-grey map has a mean linear
 * value near 0.22, so dropping one in would darken every body by a factor of
 * four and a half and quietly destroy the one number on each of these cards
 * that came from a published measurement.
 *
 * So the material's `color` and `emissiveIntensity` are divided by the map's
 * own mean, which the build script measures on the *saved JPEG* after sRGB
 * decode and prints for pasting here. The product is then exactly what it was
 * before the texture existed: same mean brightness, same hue, with the
 * variation laid over it. **If a map is rebuilt these numbers must be
 * rebuilt with it** -- the script prints them at the end of every run.
 *
 * Compensating on the *material* rather than on the geometry is deliberate.
 * If a file is missing or the network drops it, the material is never touched
 * and the body renders exactly as it did before, at the right brightness. A
 * compensation baked into the vertex colours would leave it 4.5x too bright.
 */
const SMALL_BODY_TEXTURES = Object.freeze({
  Arrokoth: { file: "arrokoth", meanLinear: 0.2213 },
  Apophis: { file: "apophis", meanLinear: 0.2281 },
  Bennu: { file: "bennu", meanLinear: 0.2456 },
  Ryugu: { file: "ryugu", meanLinear: 0.2413 },
  "67P/Churyumov\u2013Gerasimenko": { file: "comet67p", meanLinear: 0.2324 },
  Eros: { file: "eros", meanLinear: 0.2248 },
  Didymos: { file: "didymos", meanLinear: 0.2424 },
  Dimorphos: { file: "dimorphos", meanLinear: 0.2508 },
  "1P/Halley": { file: "halley", meanLinear: 0.2326 },
  Ida: { file: "ida", meanLinear: 0.2204 },
  Dactyl: { file: "dactyl", meanLinear: 0.2208 },
  Itokawa: { file: "itokawa", meanLinear: 0.2322 },
  Mathilde: { file: "mathilde", meanLinear: 0.2340 },
  Lutetia: { file: "lutetia", meanLinear: 0.2595 },
  Gaspra: { file: "gaspra", meanLinear: 0.2273 },

  /* Rank 2: the eleven large main-belt worlds and their six satellites.
   * Half-size maps (512x256, and 256x128 for the moons), because none of
   * these has ever been photographed and their relief is borrowed from a
   * spectral analogue -- a finer map would only be more invented detail.
   * See `mainBeltCatalogue.js` for what is measured on each and what is not. */
  Interamnia: { file: "interamnia", meanLinear: 0.2413 },
  "52 Europa": { file: "europa52", meanLinear: 0.2437 },
  Davida: { file: "davida", meanLinear: 0.2437 },
  Euphrosyne: { file: "euphrosyne", meanLinear: 0.2408 },
  Cybele: { file: "cybele", meanLinear: 0.2400 },
  Eunomia: { file: "eunomia", meanLinear: 0.2219 },
  Juno: { file: "juno", meanLinear: 0.2217 },
  Sylvia: { file: "sylvia", meanLinear: 0.2343 },
  Camilla: { file: "camilla", meanLinear: 0.2347 },
  Kalliope: { file: "kalliope", meanLinear: 0.2369 },
  Kleopatra: { file: "kleopatra", meanLinear: 0.2379 },
  Romulus: { file: "romulus", meanLinear: 0.2323 },
  Remus: { file: "remus", meanLinear: 0.2314 },
  Linus: { file: "linus", meanLinear: 0.2318 },
  Alexhelios: { file: "alexhelios", meanLinear: 0.2303 },
  Cleoselene: { file: "cleoselene", meanLinear: 0.2301 },
  "S/2019 (31) 1": { file: "euphrosyne-moon", meanLinear: 0.2316 },
  /* Rank 3, the four Centaurs. Full size rather than the 512 the Rank 2
   * worlds get: these are destinations, the tour lands on them, and two of
   * them can be zoomed past their own rings down to the ground. */
  Chariklo: { file: "chariklo", meanLinear: 0.2274 },
  Chiron: { file: "chiron", meanLinear: 0.2222 },
  Pholus: { file: "pholus", meanLinear: 0.2314 },
  Echeclus: { file: "echeclus", meanLinear: 0.2313 },
  /* Rank 4, batch A: fourteen worlds past Neptune and five moons.
   * Ten of them -- Aya, Chaos, Chiminigagua, DeeDee, Gǃkúnǁʼhòmdímà,
   * Goibniu, Huya, Leleākūhonua, Ritona, Xewioso -- and Huya I carry
   * *colour* maps, unwrapped from the reference images supplied for them by
   * `tools/dwarf-textures/build-dwarf-textures.py` (1024 x 512, polar rows
   * levelled), and their records are flagged `colourMap`. The rest keep the
   * grey Arrokoth-borrowed maps and the measured chroma. meanLinear is the
   * luminance mean of each saved JPEG, so the measured albedo still sets the
   * brightness either way. */
  "Máni": { file: "mani", meanLinear: 0.2212 },
  Chiminigagua: { file: "chiminigagua", meanLinear: 0.1006 },
  Achlys: { file: "achlys", meanLinear: 0.2213 },
  Aya: { file: "aya", meanLinear: 0.2050 },
  Uni: { file: "uni", meanLinear: 0.2212 },
  "Gǃkúnǁʼhòmdímà": { file: "gkunhomdima", meanLinear: 0.1419 },
  Huya: { file: "huya", meanLinear: 0.0969 },
  Goibniu: { file: "goibniu", meanLinear: 0.0660 },
  Ritona: { file: "ritona", meanLinear: 0.0633 },
  Xewioso: { file: "xewioso", meanLinear: 0.0863 },
  Rumina: { file: "rumina", meanLinear: 0.2212 },
  DeeDee: { file: "deedee", meanLinear: 0.1725 },
  Chaos: { file: "chaos", meanLinear: 0.0905 },
  "Leleākūhonua": { file: "leleakuhonua", meanLinear: 0.2616 },
  "Chiminigagua I": { file: "chiminigagua-moon", meanLinear: 0.2239 },
  "Achlys I": { file: "achlys-moon", meanLinear: 0.2239 },
  Tinia: { file: "tinia", meanLinear: 0.2237 },
  /* A colour map, not the grey one: the literal B-R 1.95 conversion on a grey
   * map read as grey-white-black on screen (reported twice) -- ACES pulls a
   * moderate chroma back towards grey. Its own rust-red map carries the
   * colour instead; the albedo still sets the brightness. */
  "Gǃòʼé ǃHú": { file: "gohu-red", meanLinear: 0.1805 },
  "Huya I": { file: "huya-moon", meanLinear: 0.0967 },
});

const smallBodyTextureCache = new Map();

/**
 * Attach a body's map, later, without ever being able to break it.
 *
 * Asynchronous on purpose: fifteen 1024x512 JPEGs are about 2.3 MB between
 * them, and the build already yields between bodies to keep the loader alive.
 * Blocking the sculpt on a network round trip would put that back. Until a
 * map arrives the body renders exactly as it always did, and if one never
 * arrives it stays that way -- `onError` is a no-op on purpose, because a
 * missing texture is a body that looks slightly plainer and an exception here
 * would be a body that does not exist.
 *
 * No `displacementMap` and no `bumpMap`, and this is not an oversight. The
 * generic rocky material in `planetFactory.js` feeds its surface map into
 * `displacementScale`, and handing that a photograph grows spikes all over
 * the body -- it happened to Ixion, Salacia and Varuna and took a while to
 * find. These are shape models measured by spacecraft; their relief is in the
 * vertices already and nothing here may move them.
 */
function applySmallBodyTexture(material, record) {
  // No DOM, no image decoding: the headless harness builds these bodies in
  // Node, where `TextureLoader` reaches for `document` and throws.
  if (typeof document === "undefined") return;
  const entry = SMALL_BODY_TEXTURES[record?.name];
  if (!entry) return;

  const url = `${PUBLIC_ASSET_ROOT}/textures/smallbodies/${entry.file}.jpg`;
  const attach = (map) => {
    material.map = map;
    // The emissive carries the map too. Without it, 28% of the body's light
    // is an unmodulated glow that dilutes every crater on it -- the texture
    // would be there and washed out. Both compensations are the same divide.
    material.emissiveMap = map;
    material.color.setScalar(1 / entry.meanLinear);
    material.emissiveIntensity = 0.28 / entry.meanLinear;
    material.needsUpdate = true;
  };

  const cached = smallBodyTextureCache.get(url);
  if (cached) {
    attach(cached);
    return;
  }
  queueSmallBodyTexture(url, attach);
}

/*
 * One texture at a time, decoded off the main thread.
 *
 * The first version handed all fifteen to `TextureLoader` at once, during the
 * scene build, and that does three expensive things simultaneously: fifteen
 * parallel fetches, fifteen JPEG decodes on the **main thread** (an
 * `HTMLImageElement` decodes there, and a 1024x512 frame costs a few
 * milliseconds each), and fifteen GPU uploads landing on whichever two or
 * three frames the images happened to arrive on.
 *
 * Reported as the fifteen bodies and their cards shaking, and the dossier
 * being slow to open. The exclusion list is what identified it: Ceres,
 * Vesta, Pallas, Hygiea and Psyche were the five unaffected, and they differ
 * from the other fifteen in exactly one way -- they are the ones without
 * textures.
 *
 * `createImageBitmap` moves the decode to a browser-internal thread, so the
 * animation loop never sees it. The queue then lets one through at a time
 * with a beat between, so the uploads land on fifteen different frames
 * rather than piling up. Nothing here is on the critical path: until a map
 * arrives the body renders exactly as it did before textures existed.
 *
 * Worth recording why this was invisible when measured: a hidden tab defers
 * image decoding entirely -- `img.decode()` never settles at all -- so the
 * test harness never paid the cost the viewer was paying.
 */
const smallBodyTextureQueue = [];
let smallBodyTextureBusy = false;

function queueSmallBodyTexture(url, attach) {
  smallBodyTextureQueue.push({ url, attach });
  pumpSmallBodyTextures();
}

function pumpSmallBodyTextures() {
  if (smallBodyTextureBusy) return;
  const next = smallBodyTextureQueue.shift();
  if (!next) return;
  smallBodyTextureBusy = true;

  const done = () => {
    smallBodyTextureBusy = false;
    // A beat between uploads so two never share a frame. `setTimeout` rather
    // than `requestIdleCallback`, because idle callbacks are starved while
    // the opening sequence is running -- which is exactly when these load.
    if (smallBodyTextureQueue.length) setTimeout(pumpSmallBodyTextures, 90);
  };

  fetch(next.url)
    .then((response) => (response.ok ? response.blob() : Promise.reject(response.status)))
    .then((blob) => createImageBitmap(blob, { imageOrientation: "flipY" }))
    .then((bitmap) => {
      const map = new THREE.Texture(bitmap);
      // The bitmap arrives already flipped by the option above, so three.js
      // must not flip it again or the map lands upside down.
      map.flipY = false;
      map.colorSpace = THREE.SRGBColorSpace;
      // Longitude wraps and latitude does not, which is what an
      // equirectangular map is. Clamping longitude would put a seam down the
      // body.
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      /*
     * The hardware maximum, not 4.
     *
     * Apophis and Itokawa were reported as flickering, and they are the two
     * smallest bodies with the most elongated silhouettes -- which is the
     * exact case anisotropic filtering exists for. A long thin body seen
     * obliquely compresses one texture axis far more than the other, and
     * with too few samples the minification picks different texels from one
     * frame to the next as it turns. That reads as a shimmer on the surface,
     * which at this size reads as the whole rock shaking.
     *
     * 16 samples on a handful of textures costs nothing measurable; the
     * lower contrast in the maps themselves is the other half of the fix.
     */
    // three.js clamps this to whatever the hardware actually supports at
    // upload time, so asking for 16 is safe everywhere.
    map.anisotropy = 16;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.needsUpdate = true;
      smallBodyTextureCache.set(next.url, map);
      next.attach(map);
      done();
    })
    .catch(() => {
      // A body without its map looks plainer. A body that threw during the
      // build does not exist.
      done();
    });
}

function createSmallBodyMaterial(record, baseColor, textured = true) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: THREE.MathUtils.clamp(0.99 - record.albedo * 0.30, 0.80, 0.99),
    metalness: record.metalness ?? 0,
    emissive: baseColor,
    emissiveIntensity: 0.28,
    envMapIntensity: 0.04,
    flatShading: false,
    dithering: true,
  });
  if (textured) applySmallBodyTexture(material, record);
  return material;
}

/**
 * The invisible sphere that makes a two-pixel body clickable.
 *
 * Acquisition for a small body is a raycast against this proxy -- the
 * screen-space assists in `main.js` only help you *hold* a hover you already
 * have. So the proxy has to be generously larger than the body.
 *
 * The cap is what stops that generosity breaking the two binaries. Dimorphos
 * orbits 1.14 km from a body 0.85 km across, which at rendered scale is 0.084
 * scene units from a proxy that wants to be 0.055 wide; leave both uncapped
 * and the moon's proxy swallows its own parent and steals every hover meant
 * for it. Each is therefore limited to a fraction of the separation, so the
 * two hit volumes stay disjoint.
 */
function buildInteractionProxy(name, reach, cap = Infinity) {
  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
    }),
  );
  proxy.name = `${name} interaction target`;
  proxy.scale.setScalar(Math.min(Math.max(reach * 2.2, 0.040), cap));
  markPointerProxy(proxy);
  return proxy;
}

/*
 * Framing a binary so both halves are on screen.
 *
 * A focused body is viewed at a fixed 30 degree *vertical* field of view --
 * `main.js` sets `focusFov` to 30 for anything focused -- so on a portrait
 * viewport the horizontal half-angle is the tight one: tan(15 deg) x aspect,
 * which is 0.186 at the 0.69 aspect the browser pane runs at and narrower
 * still on a phone held upright. Putting a moon at half of that half-width
 * gives the divisor below.
 *
 * Half, and not the 72% the first attempt used, because the focused body is
 * not at the centre of the frame. The focus camera eases toward a target
 * that is itself moving along an orbit, so it trails by an amount that
 * depends on how fast the body is going: measured with the camera settled,
 * Didymos sat 87 pixels right of centre in a 579-pixel-wide viewport, 30% of
 * the half-width, and Eros 93 pixels left of it. At 72% the moon then landed
 * at 103% and went off the edge -- which is the bug this constant exists to
 * prevent, reintroduced from the other side. Half leaves the whole remaining
 * half-width for the lag.
 *
 * It exists because the first pass got both binaries wrong in the same way.
 * Ida was framed at 9.5 x its own half-extent, 1.70 scene units, where the
 * half-width is 0.32 -- and Dactyl orbits at 0.54, so the moon sat off the
 * right edge of the frame. Didymos was worse: focused at 0.29 with a
 * half-width of 0.055, and Dimorphos at 0.084 was off the *left* edge.
 * Measured, not guessed: projecting each body's world position through the
 * live camera after the ease had settled put Dactyl at x = 663 and Dimorphos
 * at x = -66 in a 579-pixel-wide viewport. It resolves to 5.8 scene units
 * for Ida and 0.90 for Didymos, which is further out than either body would
 * be framed on its own -- deliberately, because the subject is the pair.
 *
 * That is the one failure these two bodies cannot have. Ida is in this scene
 * because it was the first asteroid found to have a moon and Didymos because
 * DART moved its moon; a viewer who focuses either and sees a single rock has
 * been shown the opposite of the point. So a body that is half of a pair --
 * parent or moon -- is framed on the *pair*, not on itself.
 */
const PAIR_FRAMING = 0.093;

/* See the moon-sizing note in `buildBody` for why this is not 1. */
const MOON_SIZE_EXPONENT = 0.62;

/**
 * Rendered distance from a parent to its moon, in scene units.
 *
 * Derived from the real ratio of the separation to the parent's mean radius
 * -- Dactyl at 5.73 Ida radii, Dimorphos at 3.17 Didymos radii -- so it is
 * knowable before either body is built, which is what lets the parent's
 * framing and its pointer-proxy cap both be set without waiting for the moon.
 */
function moonSeparation(record, renderedMeanRadius, moon = null) {
  const target = moon ?? satellitesOf(record)[0];
  if (!target) return 0;
  return renderedMeanRadius * (target.separationKm / (record.diameterKm / 2));
}

/**
 * A body's satellites, however the catalogue spelled them.
 *
 * Ida and Didymos each carry one moon and were written as `moon: {...}`.
 * Kleopatra has Alexhelios and Cleoselene; Sylvia has Romulus and Remus and
 * was the first triple asteroid ever found -- which is the single most
 * interesting thing about it and cannot be told with one satellite. So the
 * catalogue now also takes `moons: [...]`, and this collapses both spellings
 * into one list rather than having the builder branch on which was used.
 *
 * Sorted outward, so the innermost is always index 0. The parent's own
 * pointer-proxy cap is derived from the nearest satellite, and a cap set
 * from Romulus at 1,356 km would let Sylvia's proxy swallow Remus at 706.
 */
function satellitesOf(record) {
  const list = Array.isArray(record?.moons)
    ? record.moons.filter(Boolean)
    : (record?.moon ? [record.moon] : []);
  return [...list].sort((a, b) => (a.separationKm ?? 0) - (b.separationKm ?? 0));
}

/**
 * Metadata in the shape the rest of the app already reads.
 *
 * `info` is what the dossier panel renders; `heliocentricAU` is what the
 * Earth-distance instrument reads; `visualRadius` is what the pointer's
 * screen-space tests measure against. `isAsteroid` puts these on the belt's
 * hover path, which is the right behaviour for any small irregular body --
 * a generous release radius and the small-body cursor. It does *not* put them
 * on the belt's focus-appearance path: that is gated on a C/S/M composition
 * key read from `userData.composition` or an uppercase "C-TYPE" in
 * `userData.detail`, and neither is set here on purpose. Those neutralising
 * colours would lerp a measured albedo 30% toward mid-grey, which is the one
 * thing this whole module exists to avoid.
 */
function attachMetadata(group, record, {
  visualRadius,
  reach,
  heliocentricAU,
  parentName = null,
  pairSeparation = 0,
  elements = null,
  ringOuterRadius = 0,
  comaRadius = 0,
}) {
  const sizeComparison = getSizeComparisonText({
    diameterKm: record.diameterKm,
    name: record.name,
  });

  group.name = record.name;
  group.userData = {
    name: record.name,
    detail: record.detail,
    isAsteroid: true,
    isSmallBody: true,
    smallBodyId: record.id,
    parentPlanet: parentName,
    isSatellite: Boolean(parentName),
    visualRadius: reach,
    physicalDiameterKm: record.diameterKm,
    diameterEarths: record.diameterKm / 12_756,
    volumeEarths: Math.pow(record.diameterKm / 12_756, 3),
    sizeComparison,
    albedo: record.albedo,
    heliocentricAU,
    orbitalEccentricity: elements ? elements.e : 0,
    /*
     * The element set the Earth-distance instrument reads.
     *
     * `scene/distanceFromEarth.js` will otherwise fall back to treating
     * `heliocentricAU` as the semi-major axis and label the result a
     * generated orbit -- which was what the readout said for all thirteen of
     * these until this was added, under a card claiming a JPL solution
     * number. Handing it the real a and e makes the instrument's own
     * "verified small-body orbital scale" copy apply, and makes its
     * nearest-to-farthest range the real one: Halley read 0.28-3.05 AU from
     * Earth on the fallback and reads 0.6-36 AU on its actual orbit.
     */
    orbitalElements: elements
      ? {
        semiMajorAxisAU: elements.aAU,
        eccentricity: elements.e,
        source: "jpl-small-body",
      }
      : null,
    distanceBasis: "real-orbital-elements",
    /*
     * Small bodies need a much tighter camera than planets, and an elongated
     * one needs the distance measured from its *longest* axis or half of Eros
     * ends up outside the frame. `reach` is that half-extent.
     *
     * The multiplier is arithmetic, not taste. A focused body is seen at a
     * 30 degree vertical field of view, so at distance `k x reach` the body's
     * longest axis covers 1/(k x tan 15 deg) of the half-height, and on a
     * portrait viewport 1/(k x tan 15 deg x aspect) of the half-width. At the
     * 6.4 this started at that is 58% of the half-height and, at the 0.69
     * aspect the browser pane runs at, 84% of the half-width -- so the body
     * spanned 117% of the screen vertically and 168% horizontally and was
     * clipped on both. Observed on 67P, whose head lobe was cut off by the
     * top edge, and on Arrokoth, which touched both sides.
     *
     * At 11 it is 34% of the half-height and 49% of the half-width: the
     * longest axis fills about two thirds of a landscape window and nearly
     * all of a portrait one, and nothing is ever cut. Zooming closer is still
     * available down to `minFocusDistance`.
     */
    focusScale: 7.5,
    /*
     * A ringed body is framed on its rings, not on itself.
     *
     * The 11 above is derived for the body's longest axis. Chariklo's rings
     * reach 3.3 times further out than that, so the same multiplier would
     * frame the rock perfectly and cut both ansae off the sides -- which is
     * the one thing about Chariklo anybody wants to see. The ring multiplier
     * is smaller because it is applied to a much larger radius: at 7x the
     * outer ring, the system spans about 70% of the half-width on the 0.69
     * aspect the browser pane runs at, so nothing is clipped in portrait and
     * there is margin in landscape.
     *
     * `minFocusDistance` is left alone deliberately. Zooming in past the
     * rings to look at the body is worth having, and the rings fade out of
     * their own accord when the camera gets that close to the ground.
     */
    focusDistance: Math.max(
      0.26,
      reach * 11,
      ringOuterRadius * 7,
      /* A coma has no edge, so it is not framed the way a ring is -- the
       * multiplier is deliberately low and the halo is expected to run off
       * the sides. Three puts Echeclus's nucleus at about a quarter of the
       * half-height inside a cloud that fills the frame, which is what a
       * body in outburst looks like. Without this term Echeclus would be
       * framed on a 156-unit rock inside a 780-unit cloud and the viewer
       * would be looking at fog. */
      comaRadius * 3,
      pairSeparation / PAIR_FRAMING,
    ),
    minFocusDistance: Math.max(0.20, reach * 3.2),
    /* What the camera's own safety clamp must clear. Without the rings in
     * it, a close zoom would put the near ansa behind the near plane. */
    focusVisualRadius: Math.max(reach, ringOuterRadius * 1.35),
    focusEase: 0.14,
    info: {
      type: record.classification,
      sizeComparison,
      distanceFromEarth: parentName
        ? `Orbits ${parentName}; distance from Earth continuously varies`
        : `${heliocentricAU.toFixed(heliocentricAU < 10 ? 3 : 2)} AU from the Sun right now; distance from Earth continuously varies`,
      ...record.info,
      surfaceEvidence: record.info?.surfaceEvidence ?? record.surfaceEvidence,
    },
  };
  /* The panel reads `visualRadius` for its scale row and the pointer reads it
   * for hit testing; keep the rendered mean radius available separately for
   * anything that wants the un-elongated figure. */
  group.userData.renderedMeanRadius = visualRadius;
  return group;
}

/*
 * Which way up a body is, and the difference between guessing and knowing.
 *
 * Almost every record here gets a pseudo-random tilt derived from its seed.
 * That is not laziness: for a body whose pole nobody has measured, any
 * specific orientation would be an invention, and a scene where twenty-odd
 * rocks all stand perfectly upright is a scene that is quietly claiming they
 * do. A spread drawn from the seed is stable between reloads, says nothing,
 * and looks like a real population.
 *
 * Two of them are different. Chariklo's pole is known to half a degree --
 * its rings were edge-on and invisible in 2008 and open to 34 degrees by
 * 2013, and solving that geometry is how the pole was found -- and Chiron's
 * is known to a few degrees from the plane its own ring material sits in.
 * For those, `poleEclipticDeg` carries the measured direction and the body
 * is put on it.
 *
 * The scene's frame is the ecliptic with +y as the north pole, so an
 * ecliptic longitude and latitude become a unit vector directly, and the
 * tilt is the rotation that takes the body's local +y -- its spin axis -- to
 * that vector. Anything parented to the tilt group, rings included, inherits
 * it, which is the whole point: Chariklo's rings sit in its equator because
 * the occultations say they do to within their uncertainty, and the only way
 * to draw that is to have one orientation that both share.
 */
const _poleAxis = new THREE.Vector3();
const _poleUp = new THREE.Vector3(0, 1, 0);

function applyObliquity(tilt, record) {
  const pole = record.poleEclipticDeg;
  if (pole) {
    const lambda = pole.lambda * DEG;
    const beta = pole.beta * DEG;
    _poleAxis.set(
      Math.cos(beta) * Math.cos(lambda),
      Math.sin(beta),
      Math.cos(beta) * Math.sin(lambda),
    ).normalize();
    tilt.quaternion.setFromUnitVectors(_poleUp, _poleAxis);
    return;
  }
  tilt.rotation.set(
    (record.shape.seed % 47) / 47 * 0.9 - 0.45,
    0,
    (record.shape.seed % 31) / 31 * 0.8 - 0.4,
  );
}

function buildBody(record, {
  detailScale = 1,
  parentName = null,
  parentVisualRadius = null,
  proxyCap = Infinity,
  sceneRadius = SUN_REFERENCE_RADIUS,
  textured = true,
} = {}) {
  /* A `colourMap` body carries its colour in its surface map (built from a
   * supplied reference image), so the vertex colours carry albedo only --
   * otherwise the map's red would be multiplied by the measured red and the
   * body drawn twice as saturated as either source says. */
  const chroma = record.colourMap ? [1, 1, 1] : (record.chroma ?? [1, 1, 1]);
  const baseValue = albedoToLinearValue(record.albedo) * solarCompensation(sceneRadius);

  /*
   * A 96 x 64 sphere is about 12,000 triangles. Thirteen of those is 156,000,
   * and the most this scene ever has in frame at once is ten -- measured at
   * 40,000 extra triangles and ten extra draw calls from the widest view, out
   * of 808 calls, with no readable change in render time. So every named body
   * gets the full count: the crater rims and the equatorial ridges are the
   * point, and they need vertices.
   *
   * A moon gets 40 x 28, roughly 2,000 triangles. Dactyl and Dimorphos are
   * rendered a few pixels across next to a parent twenty times their size.
   */
  const width = Math.max(28, Math.round((parentName ? 40 : 96) * detailScale));
  const height = Math.max(20, Math.round((parentName ? 28 : 64) * detailScale));

  const geometry = createSmallBodyGeometry(record.shape, {
    widthSegments: width,
    heightSegments: height,
    chroma,
    baseValue,
  });

  /*
   * Kilometres to scene units.
   *
   * The mean diameter goes through the same compressed asteroid curve the
   * main belt uses, so Lutetia at 98 km sits sensibly below Psyche at 256 km
   * and the whole set is on one ordering with the rocks beside it. The body
   * is then scaled by the ratio of that rendered mean radius to its real mean
   * radius, which means the *axis ratios stay exact*: Eros is drawn 2.04
   * times longer than it is wide because it is.
   *
   * A moon is different. Dactyl is 1.4 km against Ida's 31.4, and the
   * compressed curve would draw it at a third of Ida's size instead of a
   * twentieth -- which would misstate the single most interesting thing about
   * the pair. So a moon is sized from its real ratio to its parent, softened
   * by an exponent so that a 151 m moonlet is still something a viewer can
   * see at all.
   *
   * The exponent is 0.62 and it started at 0.45. 0.45 draws Dactyl at 25% of
   * Ida's mean radius where the truth is 4.5%, and Dimorphos at 48% of
   * Didymos where the truth is 20% -- a five-and-a-half-fold and a
   * two-and-a-half-fold exaggeration of the one number each of those pairs is
   * famous for. Both cards said "the real size ratio", which made it worse:
   * the drawn separation is at the real ratio to the parent's radius, and the
   * drawn sizes never were. At 0.62 the exaggeration is 3.3x for Dactyl and
   * 1.85x for Dimorphos, and Dactyl still renders about ten pixels across
   * with the pair framed -- small, which is the point, and not a single
   * pixel, which would be useless. Both cards now state the drawn ratio and
   * the real one side by side.
   */
  const realMeanRadiusKm = record.diameterKm / 2;
  /* `sizeCurve: "dwarf"` is the Rank 4 trans-Neptunian worlds: sized on
   * the planet builder's curve, so Máni at 796 km is not drawn ten times
   * larger than Varuna at 668 a few degrees away. */
  const renderedMeanRadius = parentVisualRadius
    ? parentVisualRadius * Math.pow(record.diameterKm / record.parentDiameterKm, MOON_SIZE_EXPONENT)
    : record.sizeCurve === "dwarf"
      ? compressedPlanetRadius(record.diameterKm / 12_756)
      : getAsteroidVisualRadius(record.diameterKm, { minimum: 0.022, maximum: 0.92 });
  const kmToScene = renderedMeanRadius / realMeanRadiusKm;

  /* The material's emissive is this same linear triple -- see the material
   * factory for why it cannot be a white constant. `setRGB` with the linear
   * working space, because these numbers are linear reflectances and not
   * anything that came out of an sRGB image. */
  const baseColor = new THREE.Color().setRGB(
    baseValue * chroma[0],
    baseValue * chroma[1],
    baseValue * chroma[2],
    THREE.LinearSRGBColorSpace,
  );
  const material = createSmallBodyMaterial(record, baseColor, textured);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${record.name} surface`;
  mesh.scale.setScalar(kmToScene);

  const reach = maxHalfExtent(geometry) * kmToScene;

  /* The mesh spins about its own short axis -- which for every body in this
   * catalogue is local +y, because a body settles into rotation about the
   * axis of greatest moment of inertia and that is the short one. The tilt
   * group carries the obliquity so they are not all upright. */
  const spinner = new THREE.Group();
  spinner.name = `${record.name} spin`;
  spinner.add(mesh);

  const tilt = new THREE.Group();
  tilt.name = `${record.name} tilt`;
  applyObliquity(tilt, record);
  tilt.add(spinner);

  /* A parent's own cap is derived from where its moon will sit, which is
   * knowable here: the separation is fixed by the real ratio to the parent's
   * radius and does not depend on anything the moon build decides. */
  const nearestMoon = satellitesOf(record)[0];
  const selfCap = nearestMoon
    ? moonSeparation(record, renderedMeanRadius, nearestMoon) * 0.55
    : proxyCap;

  const group = new THREE.Group();
  group.add(tilt);
  group.add(buildInteractionProxy(record.name, reach, selfCap));

  return { group, tilt, spinner, mesh, reach, renderedMeanRadius };
}

/**
 * Builds every visited small body and adds them to the world.
 *
 * `yieldToBrowser`, when supplied, is awaited between bodies so the render
 * loop keeps running while fifteen shapes are sculpted vertex by vertex. The
 * belt build does the same thing for the same reason.
 */
export async function createSmallBodies({
  world,
  hoverTargets = [],
  quality = "high",
  yieldToBrowser = null,
  nowJD = null,
} = {}) {
  const detailScale = quality === "low" ? 0.7 : quality === "medium" ? 0.85 : 1;
  /*
   * Textured at every tier, including low.
   *
   * The first cut skipped the maps on `low`, reasoning that a machine asking
   * for fewer triangles should not also be asked for 2.3 MB of JPEG. That was
   * wrong twice. The whole set costs 2.3 MB of download and roughly 40 MB of
   * texture memory, which is small beside what the belt already holds -- and
   * measured on the machine this was built on, a ten-core laptop with 16 GB,
   * the chosen preset *is* `low`, so the rule hid the feature from the only
   * hardware it was ever tested on. What `low` protects is triangle count and
   * fill rate; a texture lookup costs neither.
   *
   * The flag stays threaded through rather than being deleted, so a future
   * tier that genuinely cannot afford them has somewhere to say so.
   */
  const textured = true;
  const referenceJD = Number.isFinite(nowJD)
    ? nowJD
    : UNIX_EPOCH_JD + Date.now() / 86_400_000;

  const system = new THREE.Group();
  system.name = "Visited small bodies";

  const bodies = [];

  for (let index = 0; index < ALL_SMALL_BODIES.length; index += 1) {
    const record = ALL_SMALL_BODIES[index];
    const orbit = prepareOrbit(record.orbit, referenceJD);
    /* The body's distance from the Sun has to be known *before* it is built,
     * because the colour baked into its vertices is pre-divided by the
     * irradiance it will receive there -- see `solarCompensation`. It is
     * computed once at build time and not tracked afterwards: the fastest
     * mover in the set is Apophis, whose heliocentric distance changes by
     * about 0.1 AU over an hour of wall-clock at the scene's compressed
     * orbital rate, which is a 3% change in irradiance. Re-baking 12,000
     * vertex colours for that would be absurd. */
    const currentAU = orbit.aAU * (1 - orbit.e * Math.cos(
      eccentricAnomaly(orbit.meanAnomaly, orbit.e),
    ));
    const sceneRadius = smallBodyAuToScene(currentAU);
    const built = buildBody(record, { detailScale, sceneRadius, textured });

    positionFromOrbit(built.group.position, orbit, orbit.meanAnomaly);

    /*
     * Rings, for the two bodies that have them.
     *
     * Reusing `planets/icyRings.js` rather than writing a second ring
     * renderer. Haumea's and Quaoar's are the same problem exactly -- a
     * handful of narrow bands a few kilometres wide around a body a few
     * hundred kilometres across, known only from occultations -- and that
     * module already solves the parts that are easy to get wrong: the rings
     * are independent particles rather than a translucent annulus, so they
     * foreshorten properly and the body passes in front of the near arc and
     * behind the far one; there is an invisible annulus per ring for the
     * pointer, because raycasting a sparse point cloud does not work; and
     * each band carries a card of its own.
     *
     * Hung off the tilt group, which for these two carries the *measured*
     * pole. That is what puts the rings in the body's equator where the
     * occultations found them, and it is why the tilt is not random here.
     */
    let rings = null;
    if (hasIcyRingSystem(record.name)) {
      rings = createIcyRingSystem({
        /* Hung on the tilt so they inherit the measured pole... */
        planet: built.tilt,
        /* ...but owned by the body, which is what a click on a ring has to
         * resolve to: its name opens the dossier and its userData frames the
         * camera. See the note on `owner` in icyRings.js. */
        owner: built.group,
        config: { name: record.name },
        radius: built.renderedMeanRadius,
        hoverTargets,
        pixelRatio: Math.min(
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          2,
        ),
      });
    }

    /*
     * And cometary activity, for the two that are comets as well as
     * asteroids: a halo, an anti-sunward dust fan, vents on the sunlit limb,
     * and for Echeclus a pair of jets and the fragment its 2005 outburst
     * threw off.
     *
     * Two parents. The halo, the fan and the fragment ignore the body's
     * rotation and hang off the outer group; the vents and jets are attached
     * to the surface and hang off the spinner, because a vent that does not
     * turn with the body is a decal rather than a geyser.
     */
    const coma = createCentaurComa(record, built.reach);
    if (coma) {
      /* The cloud is scenery: a 5-radius envelope that answered the ray would
       * give the nucleus a hit area five times its size, and the same
       * parent-steals-the-pointer failure the moon paths had. */
      coma.group.traverse((object) => { object.raycast = () => {}; });
      coma.spinning.traverse((object) => { object.raycast = () => {}; });
      built.group.add(coma.group);
      built.spinner.add(coma.spinning);
    }

    attachMetadata(built.group, record, {
      visualRadius: built.renderedMeanRadius,
      reach: built.reach,
      heliocentricAU: currentAU,
      /* `framePair: false` -- see tnoCatalogue.js. A moon twenty radii out
       * cannot share the frame with a readable primary. */
      pairSeparation: record.framePair === false
        ? 0
        : moonSeparation(record, built.renderedMeanRadius),
      elements: orbit,
      ringOuterRadius: rings?.outerRadius ?? 0,
      comaRadius: coma ? built.reach * (record.coma?.radii ?? 0) : 0,
    });
    built.group.userData.orbit = orbit;

    const entry = {
      record,
      orbit,
      group: built.group,
      spinner: built.spinner,
      spinRate: (Math.PI * 2) / visualPeriodSeconds(record.rotationHours)
        * ((record.shape.seed % 2) ? 1 : -1),
      /* A tumbler gets a second, slower rotation about a perpendicular axis.
       * Apophis and Halley are the two here that genuinely do this; drawing
       * them as clean spinners would drop a measured fact. */
      tumbleRate: record.rotationState === "tumbling"
        ? (Math.PI * 2) / visualPeriodSeconds(record.rotationHours) * 0.17
        : 0,
      /* `moon` is kept as the innermost satellite so nothing that already
       * reads it has to change; `moons` is the list everything new uses. */
      moon: null,
      moons: [],
      rings,
      /* In body radii, which is the unit `ringProximity` works in. */
      ringBodyRadius: built.renderedMeanRadius,
      coma,
    };

    satellitesOf(record).forEach((moon, moonIndex) => {
      const moonRecord = {
        ...moon,
        id: `${record.id}-moon-${moonIndex + 1}`,
        detail: `Natural satellite | ${record.name} system`,
        chroma: moon.chroma ?? record.chroma,
        metalness: record.metalness ?? 0,
        rotationHours: moon.periodHours,
        rotationState: "principal-axis",
        parentDiameterKm: record.diameterKm,
        orbit: null,
      };
      /* Separation at the real ratio to the parent's own radius: Dactyl at
       * 5.7 Ida radii, Dimorphos at 3.2 Didymos radii, Romulus at 9.9 Sylvia
       * radii. */
      const separation = moonSeparation(record, built.renderedMeanRadius, moon);

      const builtMoon = buildBody(moonRecord, {
        detailScale,
        textured,
        parentName: record.name,
        parentVisualRadius: built.renderedMeanRadius,
        proxyCap: separation * 0.40,
        /* The moon is a few hundred metres from its parent on a scale where
         * one unit is tens of millions of kilometres, so it gets the parent's
         * compensation rather than its own. Anything else would give two
         * touching bodies different exposure. */
        sceneRadius,
      });

      attachMetadata(builtMoon.group, moonRecord, {
        visualRadius: builtMoon.renderedMeanRadius,
        reach: builtMoon.reach,
        heliocentricAU: currentAU,
        parentName: record.name,
        /* The moon is framed on the pair too, and for the stronger reason:
         * Dactyl alone is a 20-pixel pebble that says nothing, while Dactyl
         * against Ida is the 1.4 km / 31.4 km ratio that made it worth
         * finding. Same number as the parent uses, so focusing either half
         * of a pair gives the same composition from the other side. */
        pairSeparation: record.framePair === false ? 0 : separation,
        /* A moon takes its parent's heliocentric element set, for the reason
         * the instrument's own satellite branch gives: Dactyl's 90 km orbit
         * around Ida is nothing beside Ida's 2.86 AU orbit around the Sun. */
        elements: orbit,
      });
      builtMoon.group.userData.info.distanceFromEarth =
        `Orbits ${record.name} at ${moon.separationKm < 10
          ? `${(moon.separationKm * 1000).toFixed(0)} m`
          : `${moon.separationKm} km`}; distance from Earth continuously varies`;

      const pivot = new THREE.Group();
      pivot.name = `${moon.name} orbit`;
      pivot.rotation.x = (moon.inclinationDeg ?? 0) * DEG;
      /*
       * Two moons of the same parent start on opposite sides of it.
       *
       * Their periods differ, so they would drift apart on their own
       * eventually -- but Romulus and Remus begin life at the same phase
       * from the same `elapsed`, and a first frame with both satellites
       * stacked on one side reads as one moon with a smear.
       */
      pivot.rotation.y = (moonIndex / Math.max(1, satellitesOf(record).length)) * Math.PI * 2;
      builtMoon.group.position.set(separation, 0, 0);
      pivot.add(builtMoon.group);
      built.group.add(pivot);
      /*
       * And a drawn path, which these were missing.
       *
       * Every other orbit in the scene has a line on it -- the planets, the
       * dwarf worlds, the fifteen small bodies, the five named belt rocks,
       * every major satellite system. These did not, and Dactyl is the pair
       * where it matters most: it is the reason anybody knows Ida's name,
       * and with no ring around Ida there is nothing to say that the speck
       * beside it is *going* anywhere.
       *
       * Hung off a fixed sibling rather than off the pivot, which rotates. A
       * circle looks identical either way, and a ring that spins is one more
       * matrix multiply per frame for no picture.
       */
      built.group.add(createMoonOrbitRing(separation, moon));

      const moonEntry = {
        pivot,
        group: builtMoon.group,
        spinner: builtMoon.spinner,
        rate: (Math.PI * 2) / visualPeriodSeconds(moon.periodHours),
        /* Dimorphos was tidally locked until DART hit it and now tumbles.
         * Dactyl's rotation was never measured. Both spin slowly here and
         * both cards say what is and is not known. */
        spinRate: (Math.PI * 2) / visualPeriodSeconds(moon.periodHours) * 0.6,
        /* The pivot starts turned, so its own clock has to start there too
         * or the first update would snap it back to zero. */
        phase: pivot.rotation.y,
      };
      entry.moons.push(moonEntry);
      if (!entry.moon) entry.moon = moonEntry;
      hoverTargets.push(builtMoon.group);
      bodies.push({ ...moonEntry, record: moonRecord, isMoon: true, group: builtMoon.group });
    });

    system.add(built.group);
    hoverTargets.push(built.group);
    bodies.push(entry);

    if (yieldToBrowser && index % 2 === 1) await yieldToBrowser();
  }

  /*
   * Orbit guides, and the reason they are not optional.
   *
   * Fifteen bodies between 1 and 45 AU, most of them a few pixels across,
   * scattered through a belt of a hundred and twenty thousand pebbles. The
   * first build had no lines and the honest verdict on it was "idk where to
   * test it out" -- which is right: a body you cannot find is a body that is
   * not really in the scene. The planets have had orbit guides from the
   * start for exactly this reason and these need them more, not less.
   *
   * Each line is the body's *own* ellipse, traced by the same
   * `positionFromOrbit` that moves it -- not a circle at its mean distance.
   * That matters here more than it does for the planets: Halley's
   * eccentricity is 0.967 and 67P's is 0.641, and a circle would be a
   * different orbit rather than a rough one.
   *
   * Cost: fifteen `LineLoop` draw calls, no textures, nothing per frame. The
   * geometry is built once and never updated, because an orbit does not
   * change.
   */
  const orbitGuides = new THREE.Group();
  orbitGuides.name = "Small-body orbit guides";
  bodies
    .filter((entry) => !entry.isMoon && entry.orbit)
    .forEach((entry) => {
      const guide = createSmallBodyOrbitGuide(
        entry.orbit,
        entry.record,
        entry.group?.userData?.visualRadius ?? 0.02,
      );
      guide.userData.bodyName = entry.record.name;
      guide.userData.body = entry.group;
      // Read by the hover card that main.js puts on an acquired guide. The
      // wording lives here because this is where the catalogue is: the card
      // should say what the thing at the end of the line *is*, and the module
      // that drew the line is the only one that knows.
      guide.userData.hoverSecondary = orbitGuideSummary(entry.record);
      orbitGuides.add(guide);
    });
  system.add(orbitGuides);

  world.add(system);

  return {
    system,
    orbitGuides,
    bodies: bodies.filter((entry) => !entry.isMoon),
    allTargets: bodies.map((entry) => entry.group),
    elapsedSeconds: 0,
    referenceJD,
  };
}

/*
 * Colour says which population a body belongs to, which is the one thing a
 * line can tell you at a glance that a label cannot. Warm for the belt, cool
 * green for the near-Earth objects that come in past us, blue for the comets
 * that fall in from outside, violet for the one cold classical object out
 * past Neptune.
 */
const ORBIT_GUIDE_COLOURS = Object.freeze([
  [/near-earth/i, 0x74d6c0],
  /* Before the comet rule, because two of the four Centaurs carry comet
   * designations as well -- 95P Chiron and 174P Echeclus -- and a population
   * whose members are half one colour and half another says nothing. Pale
   * ice-green for the bodies between the giant planets. */
  [/centaur/i, 0x9fe3c7],
  [/jupiter-family|halley-type|comet/i, 0x8fb0ff],
  /* The Rank 4 worlds, in the grey-blue the planet builder already gives
   * Varuna, Ixion, Salacia and Varda (orbitColor 0x8fa3ad), so one family of
   * bodies has one colour of path. Before the Kuiper rule, which would
   * otherwise paint them Arrokoth's violet. */
  [/trans-neptunian|sednoid/i, 0x8fa3ad],
  [/cold classical|kuiper/i, 0xc49ada],
  [/main asteroid belt/i, 0xd0aa79],
]);

/*
 * Sampled in *eccentric* anomaly -- see the guide builder -- and sampled
 * densely, because these guides are looked at from two tenths of a scene unit
 * away as well as from six thousand.
 *
 * 2,048 is not for the wide shot, where a tenth of this would be
 * indistinguishable. It is for the arrival: Bennu's drawn radius is 0.027
 * scene units on an orbit 360 units across, a ratio of thirteen thousand to
 * one, and a polyline's corner-cutting error has to be small against the
 * *rock*, not against the orbit. At 256 segments it was a third of Bennu's
 * radius and four and a half times 67P's, which is exactly the reported
 * symptom -- the line running past the body instead of through it.
 *
 * None of this is paid for by the pointer: `attachDecimatedPickPath` gives
 * the raycaster every eighth vertex, which is all a seven-pixel grab radius
 * can tell apart.
 */
const ORBIT_GUIDE_SEGMENTS = 2048;
/*
 * Every 16th vertex reaches the raycaster, not every 8th.
 *
 * Eight was right when there were thirteen of these. Rank 2 took the count
 * to twenty-four, and the pick is not linear in the number of guides -- the
 * camera sits *inside* most of these orbits, so every one of them passes
 * three.js's bounding-sphere rejection and gets walked segment by segment.
 * Measured at the wide view: 0.11 ms of added pick time with eighteen
 * guides, 0.58 ms with twenty-nine.
 *
 * At stride 16 a pick path is 128 segments, whose worst deviation from the
 * drawn line is about 0.3% of the orbit's radius -- one and a half scene
 * units on a belt orbit, against a grab radius that is nineteen units wide
 * at the view where these are picked. The drawn line is untouched: it is
 * still 2,048 segments and still passes through the body to a hundredth of
 * its radius.
 */
const ORBIT_GUIDE_PICK_STRIDE = 16;

function orbitGuideColour(record) {
  const population = String(record?.info?.population ?? "");
  for (const [pattern, colour] of ORBIT_GUIDE_COLOURS) {
    if (pattern.test(population)) return colour;
  }
  return 0x9aa7b8;
}

/*
 * The one-line description the hover card shows under the body's name: what
 * kind of object it is, and how big. Sized in metres below a kilometre,
 * because "0.5 km across" reads as a rounding of something larger and Bennu
 * is genuinely 484 m.
 */
function orbitGuideSummary(record) {
  const classification = String(record?.classification ?? record?.info?.population ?? "").trim();
  const diameter = Number(record?.diameterKm);
  if (!Number.isFinite(diameter) || diameter <= 0) return classification || null;
  const size = diameter < 1
    ? `${Math.round(diameter * 1000)} m across`
    : `${diameter < 10 ? diameter.toFixed(1) : Math.round(diameter)} km across`;
  return classification ? `${classification} · ${size}` : size;
}

/**
 * The circle a moon runs on, around its own parent.
 *
 * Deliberately not the same object as a heliocentric guide. This one is
 * measured in body radii rather than AU; it is never raycast, because you
 * reach Dactyl by clicking Dactyl, which is right there; and it has to stay
 * legible while the parent fills the frame. So: a plain closed `Line` at 256
 * segments, which on a circle this small is smooth to well under a pixel,
 * and dimmer than a heliocentric guide because at arrival range it is only
 * ever a few dozen pixels away from the body it belongs to.
 */
function createMoonOrbitRing(radius, moon) {
  const segments = 256;
  const vertices = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i += 1) {
    const angle = ((i % segments) / segments) * Math.PI * 2;
    vertices[i * 3] = Math.cos(angle) * radius;
    vertices[i * 3 + 1] = 0;
    vertices[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0x86d8c4,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    toneMapped: false,
  }));
  line.name = `${moon?.name ?? "Moon"} orbit path`;
  line.rotation.x = (moon?.inclinationDeg ?? 0) * DEG;
  line.renderOrder = -6;
  // A ring 0.15 scene units across has a bounding sphere the culler will
  // happily throw away when the camera is inside it, which is most of the
  // time you would want to see it.
  line.frustumCulled = false;
  /*
   * Drawn, never picked.
   *
   * The line hangs off the parent's group, so a raycast that grazes it walks
   * up the hierarchy and resolves to the *parent*. The moon sits on its own
   * path, and the hover raycast runs with a line threshold of 0.10-0.28
   * scene units -- two to six times the width of Remus -- so every ray aimed
   * at a moon hit its path first, a few hundredths of a unit nearer the lens
   * than the moon's own surface. Measured with a headless probe: focused on
   * Romulus and aimed at Remus, the first body along the ray was Sylvia; the
   * same for Alexhelios and Cleoselene around Kleopatra. The hover then
   * locked onto the parent, failed its "is the pointer still on it" test a
   * frame later and cleared -- no green target at all. Focusing the parent
   * hid it, because the focused body is excluded from hover; one-moon
   * systems hid it, because the only other body is the parent.
   */
  line.raycast = () => {};
  return line;
}

function createSmallBodyOrbitGuide(orbit, record, bodyRadius = 0.02) {
  /*
   * One extra vertex, repeating the first, and a `Line` rather than a
   * `LineLoop`.
   *
   * They draw identically -- the duplicate makes the closing segment explicit
   * instead of implicit -- but they do not *raycast* identically, and these
   * are raycast now. `THREE.Line.prototype.raycast` walks `i` from 0 to
   * count-2 and tests the segment from `i` to `i+1`; `LineLoop` inherits it
   * unchanged, so the wrap-around segment from the last vertex back to the
   * first is drawn and is not testable. On a near-circular orbit that is a
   * 1-in-512 dead spot, which nobody would ever find; on Halley, where the
   * vertices are sampled uniformly in mean anomaly, the segments around
   * perihelion are the longest on the whole path and the seam sits in the one
   * place the line sweeps furthest across the screen.
   */
  /*
   * Sampled uniformly in eccentric anomaly, not mean anomaly.
   *
   * The first version stepped mean anomaly evenly, on the reasoning that this
   * spaces the vertices the way the body actually moves. It does -- and that
   * is the problem, because equal *time* steps means the fastest part of the
   * orbit gets the fewest points, and the fastest part is perihelion, which
   * is also the most curved. Measured on Halley (e = 0.967) the longest chord
   * came out at 425 scene units against a mean of 9.9: its guide was cutting
   * a 425-unit straight line across the inner system exactly where it swings
   * past the Sun, which is the most-looked-at part of the whole scene.
   *
   * Eccentric anomaly is the angle on the ellipse's auxiliary circle, so an
   * even step in it is an even step around the ellipse: the spacing is finest
   * at perihelion, where the curvature is, and the longest chord falls to
   * about a·ΔE -- roughly 24 units for Halley, seventeen times better on half
   * the vertices. `positionFromOrbit` wants mean anomaly, and Kepler's
   * equation converts the other way for free (M = E - e·sin E), so this costs
   * nothing but a line.
   */
  /*
   * And then refined wherever a chord still misses the curve by more than a
   * fraction of the body.
   *
   * Even stepping in E is not enough for Leleākūhonua. At e = 0.95 the true
   * anomaly runs sqrt((1+e)/(1-e)) = 6.3 times faster than E at perihelion,
   * so one of 2,048 steps there is 1.1 degrees of arc; at 2,560 scene units
   * out the chord's sagitta is 0.12 units against a drawn radius of 0.024.
   * The line sat five body-radii off the body and only touched it when the
   * body passed a vertex -- reported as the orbit line "floating and hitting
   * sometimes". Each segment is now tested at its midpoint and halved until
   * the chord is within a fifth of the body's drawn radius, to six levels.
   * It only ever adds vertices, and only where the curve needs them: every
   * other guide gains a handful near perihelion or none at all.
   */
  const tolerance = Math.max(1e-4, bodyRadius * 0.2);
  const positions = [];
  const point = new THREE.Vector3();
  const chordMid = new THREE.Vector3();
  const at = (E, target) => positionFromOrbit(target, orbit, E - orbit.e * Math.sin(E));
  const refine = (E0, p0, E1, p1, depth) => {
    const Em = (E0 + E1) * 0.5;
    const pm = new THREE.Vector3();
    at(Em, pm);
    chordMid.copy(p0).add(p1).multiplyScalar(0.5);
    if (depth < 6 && pm.distanceTo(chordMid) > tolerance) {
      refine(E0, p0, Em, pm, depth + 1);
      refine(Em, pm, E1, p1, depth + 1);
      return;
    }
    positions.push(p1.x, p1.y, p1.z);
  };
  at(0, point);
  let previous = point.clone();
  positions.push(previous.x, previous.y, previous.z);
  for (let i = 1; i <= ORBIT_GUIDE_SEGMENTS; i += 1) {
    const E0 = ((i - 1) / ORBIT_GUIDE_SEGMENTS) * Math.PI * 2;
    const E1 = (i / ORBIT_GUIDE_SEGMENTS) * Math.PI * 2;
    const next = new THREE.Vector3();
    at(i === ORBIT_GUIDE_SEGMENTS ? 0 : E1, next);
    refine(E0, previous, E1, next, 0);
    previous = next;
  }
  const vertices = new Float32Array(positions);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: orbitGuideColour(record),
    transparent: true,
    /*
     * Fainter than a planet's guide (0.34). There are fifteen of these
     * crossing each other through the busiest part of the scene, and a line
     * bright enough to read on its own becomes a thicket when there are
     * fifteen. They are meant to be found when looked for, not noticed
     * constantly.
     */
    opacity: 0.22,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  }));
  line.name = `${record.name} orbit`;
  // An orbit that reaches 35 AU has a bounding sphere most of the scene wide,
  // so frustum culling on it is a cost with no benefit.
  line.frustumCulled = false;
  line.renderOrder = -12;
  attachDecimatedPickPath(line, ORBIT_GUIDE_PICK_STRIDE);
  return line;
}

const _position = new THREE.Vector3();

/**
 * One Kepler solve and two quaternion updates per body, per frame.
 *
 * Deliberately not throttled or level-of-detail'd: fifteen bodies is far too
 * few for that to be worth the branch. The belt's equivalent pass handles
 * three hundred and throttles; this one is a rounding error beside it.
 */
export function updateSmallBodies(
  smallBodies,
  motionScale = 1,
  spinSeconds = 1 / 60,
  camera = null,
) {
  if (!smallBodies) return;
  /*
   * Two clocks, deliberately. `motionScale` is the caller's per-frame orbital
   * scale and already has delta time folded into it -- it is the same number
   * the planets' `orbitSpeed * 0.0022 * frameMotionScale` uses. `spinSeconds`
   * is real elapsed seconds scaled only by the journey's motion, which is what
   * a rotation period wants. Feeding the frame scale to both, which the first
   * version did, multiplies delta time in twice and every body turns at a
   * sixtieth of its period.
   */
  smallBodies.elapsedSeconds += spinSeconds;
  const elapsed = smallBodies.elapsedSeconds;

  for (let i = 0; i < smallBodies.bodies.length; i += 1) {
    const entry = smallBodies.bodies[i];
    const orbit = entry.orbit;

    orbit.meanAnomaly += orbit.visualRate * motionScale;
    if (orbit.meanAnomaly > Math.PI * 2) orbit.meanAnomaly -= Math.PI * 2;
    positionFromOrbit(_position, orbit, orbit.meanAnomaly);
    entry.group.position.copy(_position);

    entry.spinner.rotation.y = entry.spinRate * elapsed;
    if (entry.tumbleRate) entry.spinner.rotation.z = entry.tumbleRate * elapsed;

    const moons = entry.moons ?? (entry.moon ? [entry.moon] : []);
    for (let m = 0; m < moons.length; m += 1) {
      const moon = moons[m];
      moon.pivot.rotation.y = (moon.phase ?? 0) + moon.rate * elapsed;
      moon.spinner.rotation.y = moon.spinRate * elapsed;
    }

    if (entry.rings) updateRingSystem(entry, spinSeconds, camera);
    if (entry.coma) updateCentaurComa(entry.coma, entry.group, camera);
  }
}

const _ringDistance = new THREE.Vector3();
/* `ringBodyRadius` is kept on the entry for anything that wants the body's
 * own scale; the fade below deliberately does not use it. */

/**
 * Turns a Centaur's rings a little, and switches them off when nobody can
 * see them.
 *
 * The same rule the giant planets' faint rings follow, from
 * `planets/ringProximity.js`, and for the same measured reason: a ring is a
 * large thin sheet, and folding the whole of it into a handful of pixels
 * makes every one of those pixels accumulate the sheet's full alpha, so from
 * far enough away the ring glows brighter than the body it belongs to. Below
 * 14 body radii the rings are drawn as authored, between 14 and 70 they fade,
 * and past 70 the system's `visible` goes false -- which also takes the
 * pointer annuli out, because three's raycaster does not check `visible` and
 * a ring nobody can see should not answer a hover.
 *
 * These are much smaller than the planets' rings in scene units, which makes
 * the rule matter more rather than less: Chariklo's outer ring is about one
 * unit across and the body sits 145 units from the Sun, so from the system
 * view the whole system is sub-pixel and would otherwise be a shimmering
 * speck. With no camera -- the headless harness -- the rings are left as
 * authored, because there is nothing to be far away from.
 */
function updateRingSystem(entry, spinSeconds, camera) {
  entry.rings.update(spinSeconds);
  if (!camera) return;
  /*
   * Measured in ring radii, not body radii, and the difference is the whole
   * reason this is not a straight call to the planet rule.
   *
   * `ringProximity` counts in *planet* radii and its thresholds -- full
   * below 14, gone above 70 -- were measured against planets whose rings
   * stop at about 2.4 radii and which the camera focuses at 4.2. Chariklo's
   * rings reach 3.3 body radii and Chiron's confined ones 4.5, so framing
   * them puts the camera at 23 to 32 *body* radii, which is already most of
   * the way through the planet fade. Fed the body radius, both systems
   * arrived at roughly three-quarters opacity in the one view they exist
   * for, and Chiron's switched off entirely.
   *
   * Normalising by the ring system's own outer radius asks the question the
   * rule is actually about -- how big is the ring on screen -- and makes the
   * two numbers transferable: framed is 7 ring radii, so full below 10 has
   * margin, and 55 is where the system has shrunk to about a twenty-eighth
   * of the area it covers when framed, which is the few pixels the planet
   * rule's 70 was chosen to catch.
   */
  const ringRadii = _ringDistance
    .copy(camera.position)
    .sub(entry.group.position)
    .length() / Math.max(1e-6, entry.rings.outerRadius);
  const fade = 1 - THREE.MathUtils.smoothstep(ringRadii, 10, 55);
  if (!applyRingProximityVisibility(entry.rings.group, fade)) return;
  for (let i = 0; i < entry.rings.fields.length; i += 1) {
    const field = entry.rings.fields[i];
    field.material.uniforms.uOpacity.value = field.ring.opacity * fade;
  }
}

/**
 * Quality hook, for parity with the belt and the Kuiper Belt.
 *
 * There is nothing density-based to thin here -- fifteen meshes with no
 * instancing and no point fields -- so this only exists so a caller can treat
 * all three population modules the same way.
 */
export function setSmallBodyQuality() {}

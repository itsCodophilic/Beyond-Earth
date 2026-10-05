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
import { KUIPER_BINARIES } from "./binaryCatalogue.js";
import { COMETS } from "./cometCatalogue.js";
import { JUPITER_TROJANS } from "./trojanCatalogue.js";
import { NEAR_EARTH_ODDITIES } from "./neoCatalogue.js";
import { createCentaurComa, updateCentaurComa, setComaStrength } from "./centaurComa.js";
import { createResonantSwarms, updateResonantSwarms } from "./resonantSwarms.js";
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
  /* Rank 4, batch B: five near-equal binaries, one a triple, drawn about
   * their barycentres -- see `updateBinarySystem`. */
  ...KUIPER_BINARIES,
  /* Rank 7: nine comets, each with a coma and tail that grow and fade with
   * its distance from the Sun -- see `cometActivity`. */
  ...COMETS,
  /* Rank 8, the three interstellar visitors, are no longer drawn as bodies:
   * they have left, and the owner moved them to the space events, where each
   * pass is a dated replay (scene/events/interstellarPassages.js, round 5).
   * `prepareHyperbolicOrbit` stays for any open orbit added later. */
  /* Rank 9: Jupiter's Trojans and the Lucy targets, drawn in Jupiter's own
   * frame -- see `CO_ORBITAL_PLANETS`. */
  ...JUPITER_TROJANS,
  /* Rank 10: near-Earth oddities; Cruithne and Kamoʻoalewa in Earth's frame. */
  ...NEAR_EARTH_ODDITIES,
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

/*
 * Smooth through the anchors, not straight between them.
 *
 * Reported as a "major issue": the orbits of C/2014 UN271 and several others
 * were not ellipses but bent with sudden sharp corners. They were. The curve
 * used to be straight lines in log(AU) between the anchors, so its slope
 * jumped at every anchor radius -- at Mars, the outer belt, Jupiter, the
 * Kuiper cliff, Sedna -- and any orbit crossing one of those radii was drawn
 * with a corner there: up to 37 degrees on Hale-Bopp's path at 506 AU, 30 on
 * UN271's, 21 on Halley's at 3.2 AU, 19 on Encke's. Every eccentric small
 * body had them; near-circular ones never cross an anchor and did not.
 *
 * Now a monotone cubic (Fritsch-Carlson) through the same anchors in
 * log(AU): it passes through every anchor exactly, so each body that sat at
 * an anchor distance still sits there and the order of everything is
 * unchanged, but the slope is continuous, so no path can have a corner.
 * Measured on every guide after the change: the largest turn beyond what
 * its neighbours turn is under a degree.
 */
const AU_ANCHOR_LOG = AU_ANCHORS.map(([a]) => Math.log10(a));
const AU_ANCHOR_SLOPES = (() => {
  const n = AU_ANCHORS.length;
  const d = [];
  for (let i = 0; i < n - 1; i += 1) {
    d.push((AU_ANCHORS[i + 1][1] - AU_ANCHORS[i][1]) / (AU_ANCHOR_LOG[i + 1] - AU_ANCHOR_LOG[i]));
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      // Weighted harmonic mean (Fritsch-Butland), which keeps it monotone.
      const h0 = AU_ANCHOR_LOG[i] - AU_ANCHOR_LOG[i - 1];
      const h1 = AU_ANCHOR_LOG[i + 1] - AU_ANCHOR_LOG[i];
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return m;
})();

export function smallBodyAuToScene(au) {
  const x = Math.log10(Math.max(0.02, au));
  const n = AU_ANCHORS.length;
  if (x <= AU_ANCHOR_LOG[0]) {
    return (AU_ANCHORS[0][1] + AU_ANCHOR_SLOPES[0] * (x - AU_ANCHOR_LOG[0])) * SOLAR_ORBIT_SCALE;
  }
  if (x >= AU_ANCHOR_LOG[n - 1]) {
    return AU_ANCHORS[n - 1][1] * SOLAR_ORBIT_SCALE;
  }
  let i = 0;
  while (i < n - 2 && x > AU_ANCHOR_LOG[i + 1]) i += 1;
  const h = AU_ANCHOR_LOG[i + 1] - AU_ANCHOR_LOG[i];
  const t = (x - AU_ANCHOR_LOG[i]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const y = (2 * t3 - 3 * t2 + 1) * AU_ANCHORS[i][1]
    + (t3 - 2 * t2 + t) * h * AU_ANCHOR_SLOPES[i]
    + (-2 * t3 + 3 * t2) * AU_ANCHORS[i + 1][1]
    + (t3 - t2) * h * AU_ANCHOR_SLOPES[i + 1];
  return y * SOLAR_ORBIT_SCALE;
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
  /* Danby's starting value, E = M + 0.85 e sign(sin M), and up to 50 passes:
   * the old start at pi with 8 passes did not converge for C/2014 UN271
   * (e = 0.99926, M a few thousandths of a degree short of 360), which was
   * drawn at 51.6 AU instead of 13.6. Everything else still converges in a
   * handful of passes and breaks out at once. */
  let E = meanAnomaly + 0.85 * e * Math.sign(Math.sin(meanAnomaly));
  for (let i = 0; i < 50; i += 1) {
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
/*
 * Kepler's equation for an open orbit: e sinh H - H = M.
 *
 * The three interstellar visitors are not bound to the Sun (e = 1.20, 3.36
 * and 6.14), so the ellipse's eccentric anomaly has no meaning for them and
 * the hyperbolic anomaly H takes its place. Newton from asinh(M / e), which
 * is within a fraction of a radian of the root for every M used here; the
 * derivative e cosh H - 1 is never below e - 1 > 0, so it cannot stall.
 */
function hyperbolicAnomaly(meanAnomaly, e) {
  let H = Math.asinh(meanAnomaly / e);
  for (let i = 0; i < 30; i += 1) {
    const delta = (e * Math.sinh(H) - H - meanAnomaly) / (e * Math.cosh(H) - 1);
    H -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return H;
}

/* Heliocentric distance on the orbit at a mean anomaly, in AU, without
 * placing anything: what the comets' activity reads every frame. */
function radiusAtMeanAnomaly(orbit, meanAnomaly) {
  if (orbit.hyperbolic) {
    return orbit.aAU * (orbit.e * Math.cosh(hyperbolicAnomaly(meanAnomaly, orbit.e)) - 1);
  }
  return orbit.aAU * (1 - orbit.e * Math.cos(eccentricAnomaly(meanAnomaly, orbit.e)));
}

function positionFromOrbit(target, orbit, meanAnomaly) {
  const e = orbit.e;
  let trueAnomaly;
  let radiusAU;
  if (orbit.hyperbolic) {
    /* aAU is stored positive for an open orbit (|a|), so r = |a|(e cosh H - 1)
     * and tan(nu / 2) = sqrt((e + 1)/(e - 1)) tanh(H / 2). */
    const H = hyperbolicAnomaly(meanAnomaly, e);
    trueAnomaly = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
    radiusAU = orbit.aAU * (e * Math.cosh(H) - 1);
  } else {
    const E = eccentricAnomaly(meanAnomaly, e);
    trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2),
    );
    radiusAU = orbit.aAU * (1 - e * Math.cos(E));
  }
  /* The drawn conic where the orbit has one (`sceneConic`), else the radial
   * mapping -- the co-orbital planet models, which only need an angle. */
  const radius = orbit.sceneP !== undefined
    ? orbit.sceneP / (1 + orbit.sceneE * Math.cos(trueAnomaly))
    : smallBodyAuToScene(radiusAU);

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

/*
 * Each path is drawn as a true conic -- an ellipse, or for a visitor a
 * hyperbola-like arc -- not as the real one squeezed point by point.
 *
 * Reported twice: the eccentric orbits were not ellipses. The first time
 * the cause was corners where the old straight-line distance curve changed
 * slope; that was fixed, and the paths were still wrong, "curvy, with very
 * sharp points at some ends". That is what any non-linear squeeze does to an
 * eccentric orbit. The scene compresses distance roughly logarithmically
 * (1 AU is 29 units, 30 AU is 178, 100,000 AU is 601), so a long ellipse
 * squeezed point by point keeps its near end round and fattened while the
 * whole far half -- where the real distance shoots up within a few degrees
 * of aphelion -- collapses into a spike. Halley's path became a teardrop;
 * UN271's, whose far point is ~29,500 AU, a near-circle with a horn.
 *
 * So the squeeze is applied only to the two ends. The nearest and farthest
 * distances go through `smallBodyAuToScene` exactly as before -- so every
 * perihelion and aphelion still lands where it did against the planets --
 * and the path between them is the one ellipse with the Sun at its focus
 * that has those two ends: scene semi-latus rectum p = 2 q' Q' / (q' + Q'),
 * eccentricity (Q' - q') / (Q' + q'). The body is placed on it at its real
 * true anomaly, so its direction from the Sun and its timing (fast at
 * perihelion, slow far out) are the real ones; only its drawn distance
 * between the two ends is the conic's. Distances on cards and in the HUD
 * come from the real orbit (`currentAU`) and are unaffected.
 *
 * An open orbit gets the conic through its drawn perihelion and its two
 * 60 AU loop ends at their real true anomalies -- see
 * `prepareHyperbolicOrbit`.
 */
function sceneConic(qAU, QAU) {
  const q = smallBodyAuToScene(qAU);
  const Q = smallBodyAuToScene(QAU);
  return { sceneP: (2 * q * Q) / (q + Q), sceneE: (Q - q) / (Q + q) };
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
/*
 * How far out an open orbit is drawn, and where its pass loops.
 *
 * A hyperbolic body comes in once and leaves for ever; drawn literally, the
 * three visitors would be at 12, 49 and 55 AU today and receding, and would
 * never be seen near the Sun again on the scene's clock. So each pass is
 * drawn between the two points where the path crosses 60 AU -- far enough
 * that all three of today's positions are on it (1I is the farthest, at
 * 54.6 AU on 27 September 2026, JPL Horizons) -- and when the body reaches
 * the outbound end it starts again at the inbound one. The line is open at
 * both ends, and the card says the loop is the scene's, not the object's.
 */
const HYPERBOLIC_LOOP_AU = 60;

function prepareHyperbolicOrbit(orbit, nowJD) {
  const aAU = Math.abs(orbit.aAU);
  const e = orbit.e;
  /* Mean anomaly is unbounded on an open orbit -- 3I's is 818 degrees at its
   * epoch -- so it is propagated and never wrapped. */
  const meanAnomalyNow = (orbit.meanAnomalyDeg
    + orbit.meanMotionDegPerDay * (nowJD - orbit.epochJD)) * DEG;
  const Hloop = Math.acosh((HYPERBOLIC_LOOP_AU / aAU + 1) / e);
  const loopM = e * Math.sinh(Hloop) - Hloop;
  const nRad = orbit.meanMotionDegPerDay * DEG;
  /* The pass, 60 AU in to 60 AU out, in real days; the scene's clock is the
   * one every body uses, applied to that span as if it were a period, and
   * scaled to the pass's own span in mean anomaly. */
  const passDays = (2 * loopM) / nRad;
  /* The drawn conic (see `sceneConic`): through the drawn perihelion, and
   * through the drawn 60 AU point at the loop end's real true anomaly. */
  const qAU = aAU * (e - 1);
  const nuEnd = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(Hloop / 2));
  const qScene = smallBodyAuToScene(qAU);
  const endScene = smallBodyAuToScene(HYPERBOLIC_LOOP_AU);
  const sceneE = (endScene - qScene) / (qScene - endScene * Math.cos(nuEnd));
  return {
    sceneP: qScene * (1 + sceneE),
    sceneE,
    hyperbolic: true,
    aAU,
    e,
    qAU: aAU * (e - 1),
    incRad: orbit.iDeg * DEG,
    nodeRad: orbit.nodeDeg * DEG,
    argPeriRad: orbit.argPeriDeg * DEG,
    meanAnomaly: THREE.MathUtils.clamp(meanAnomalyNow, -loopM, loopM),
    /* Where the real object is today -- the guide marks it, because the
     * body itself is replaying the pass and is usually somewhere else. */
    todayM: THREE.MathUtils.clamp(meanAnomalyNow, -loopM, loopM),
    loopM,
    loopH: Hloop,
    periodDays: passDays,
    visualRate: visualMeanMotion(passDays) * (2 * loopM) / (Math.PI * 2),
    solution: orbit.solution,
  };
}

/*
 * The planets a few bodies are drawn relative to.
 *
 * This scene's planets move on authored clocks from authored longitudes, so
 * a body placed on its real elements is at its real angle from the Sun but
 * not at its real angle from Jupiter or Earth. For most bodies nothing is
 * lost. For a Trojan it is everything -- the one fact about Hektor is that
 * it sits 60 degrees ahead of Jupiter -- and the same is true of Hilda's 3:2
 * resonance and of Cruithne and Kamoʻoalewa, which are only interesting
 * relative to Earth.
 *
 * So a record with `coOrbital: { planet: "Jupiter", ratio }` is drawn in a frame that turns
 * with the drawn planet: its position is computed on its real elements, a
 * model of the real planet is computed the same way on the same clock, and
 * the frame is turned about the Sun by whatever angle separates the drawn
 * planet from the modelled one. The body keeps its real longitude *relative
 * to the planet*, which is what makes L4, L5 and the quasi-satellite loop
 * appear where they belong.
 *
 * Elements: JPL "Keplerian Elements for Approximate Positions of the Major
 * Planets" (Standish), Table 1, J2000 ecliptic, valid 1800-2050 -- a, e, I,
 * L0 (mean longitude at J2000), longitude of perihelion, node. Earth's row
 * is the Earth-Moon barycentre's.
 */
const J2000_JD = 2451545.0;
const CO_ORBITAL_PLANETS = Object.freeze({
  Jupiter: { aAU: 5.20288700, e: 0.04838624, iDeg: 1.30439695, L0: 34.39644051, Ldot: 3034.74612775, varpi: 14.72847983, node: 100.47390909 },
  Earth: { aAU: 1.00000261, e: 0.01671123, iDeg: -0.00001531, L0: 100.46457166, Ldot: 35999.37244981, varpi: 102.93768193, node: 0 },
});

function coOrbitalModel(name, nowJD) {
  const p = CO_ORBITAL_PLANETS[name];
  const T = (nowJD - J2000_JD) / 36525;
  const L = p.L0 + p.Ldot * T;
  const periodDays = 36525 * 360 / p.Ldot;
  const meanAnomaly = ((((L - p.varpi) % 360) + 360) % 360) * DEG;
  return {
    aAU: p.aAU,
    e: p.e,
    incRad: p.iDeg * DEG,
    nodeRad: p.node * DEG,
    argPeriRad: (p.varpi - p.node) * DEG,
    meanAnomaly,
    periodDays,
    /* Earth's comes out at exactly its authored orbitSpeed of 0.34, which is
     * the reference the curve is built on. */
    visualRate: visualMeanMotion(periodDays),
  };
}

function prepareOrbit(orbit, nowJD) {
  if (orbit.e >= 1) return prepareHyperbolicOrbit(orbit, nowJD);
  const daysSinceEpoch = nowJD - orbit.epochJD;
  const advanced = orbit.meanAnomalyDeg + orbit.meanMotionDegPerDay * daysSinceEpoch;
  const wrapped = ((advanced % 360) + 360) % 360;
  return {
    ...sceneConic(orbit.aAU * (1 - orbit.e), orbit.aAU * (1 + orbit.e)),
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
  Itokawa: { file: "itokawa", meanLinear: 0.2324 }, // final round: Muses Sea re-grown (build-small-body-textures.py)
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
  /* Rank 4, batch B: the five binaries, eleven bodies. Designed in
   * binary-surface-lab.html and picked there by the project owner, then
   * written by tools/binary-surface-lab/build-binary-maps.mjs from the same
   * generator, seeds and tuning (tools/binary-surface-lab/picks.json):
   * Lempo, Hiisi and Paha cratered to saturation like Callisto; Sila
   * lightly cratered and Nunam a dirty snowball; Teharonhiawako and
   * Sawiskera grooved like Lutetia; Altjira and its partner boulder rubble
   * like Bennu; Manwë a snowball and Thorondor rubble. Each carries a
   * normal map (`normal`) as well: the craters, grooves and boulders are
   * relief that the Sun lights, not paint. meanLinear is measured on each
   * saved JPEG. */
  Lempo: { file: "lempo", meanLinear: 0.0773, normal: "lempo-normal" },
  Hiisi: { file: "hiisi", meanLinear: 0.1102, normal: "hiisi-normal" },
  Paha: { file: "paha", meanLinear: 0.0684, normal: "paha-normal" },
  Sila: { file: "sila", meanLinear: 0.1133, normal: "sila-normal" },
  Nunam: { file: "nunam", meanLinear: 0.1332, normal: "nunam-normal" },
  Teharonhiawako: { file: "teharonhiawako", meanLinear: 0.0519, normal: "teharonhiawako-normal" },
  Sawiskera: { file: "sawiskera", meanLinear: 0.0369, normal: "sawiskera-normal" },
  Altjira: { file: "altjira", meanLinear: 0.0281, normal: "altjira-normal" },
  "Altjira I": { file: "altjira-moon", meanLinear: 0.0458, normal: "altjira-moon-normal" },
  "Manwë": { file: "manwe", meanLinear: 0.0824, normal: "manwe-normal" },
  Thorondor: { file: "thorondor", meanLinear: 0.0941, normal: "thorondor-normal" },
  /* Ranks 7-10: comets, the interstellar visitors, the Trojans and Lucy
   * targets, the near-Earth oddities -- 33 bodies. Generated by the same lab
   * and build (tools/binary-surface-lab, groups comets, interstellar,
   * trojans, lucy, neos), each with a normal map. `lazy`: fetched only when
   * the camera first comes near the body (see `loadNearbyTextures`), because
   * together they are 24 MB and most viewers will visit a handful.
   * Twenty-three were rebuilt in round 3 (Prompts.md) with per-body terrain,
   * craters and described colours -- `BODY_TUNING` in surfaceDesigns.js --
   * and their meanLinear values re-measured with them. */
  "9P/Tempel 1": { file: "tempel-1", meanLinear: 0.1666, normal: "tempel-1-normal", lazy: true },
  "103P/Hartley 2": { file: "hartley-2", meanLinear: 0.1661, normal: "hartley-2-normal", lazy: true },
  "81P/Wild 2": { file: "wild-2", meanLinear: 0.1600, normal: "wild-2-normal", lazy: true },
  "19P/Borrelly": { file: "borrelly", meanLinear: 0.1655, normal: "borrelly-normal", lazy: true },
  "2P/Encke": { file: "encke", meanLinear: 0.1627, normal: "encke-normal", lazy: true },
  "12P/Pons-Brooks": { file: "pons-brooks", meanLinear: 0.1640, normal: "pons-brooks-normal", lazy: true },
  "C/2014 UN271": { file: "un271", meanLinear: 0.1650, normal: "un271-normal", lazy: true },
  "C/1995 O1 Hale-Bopp": { file: "hale-bopp", meanLinear: 0.1640, normal: "hale-bopp-normal", lazy: true },
  "C/2020 F3 NEOWISE": { file: "neowise", meanLinear: 0.1644, normal: "neowise-normal", lazy: true },
  "1I/ʻOumuamua": { file: "oumuamua", meanLinear: 0.1631, normal: "oumuamua-normal", lazy: true },
  "2I/Borisov": { file: "borisov", meanLinear: 0.1672, normal: "borisov-normal", lazy: true },
  "3I/ATLAS": { file: "atlas-3i", meanLinear: 0.1679, normal: "atlas-3i-normal", lazy: true },
  "Hektor": { file: "hektor", meanLinear: 0.1704, normal: "hektor-normal", lazy: true },
  "Skamandrios": { file: "skamandrios", meanLinear: 0.1668, normal: "skamandrios-normal", lazy: true },
  "Patroclus": { file: "patroclus", meanLinear: 0.1643, normal: "patroclus-normal", lazy: true },
  "Menoetius": { file: "menoetius", meanLinear: 0.1729, normal: "menoetius-normal", lazy: true },
  "Eurybates": { file: "eurybates", meanLinear: 0.1601, normal: "eurybates-normal", lazy: true },
  "Queta": { file: "queta", meanLinear: 0.1498, normal: "queta-normal", lazy: true },
  "Polymele": { file: "polymele", meanLinear: 0.1694, normal: "polymele-normal", lazy: true },
  "Shaun": { file: "shaun", meanLinear: 0.1535, normal: "shaun-normal", lazy: true },
  "Leucus": { file: "leucus", meanLinear: 0.1778, normal: "leucus-normal", lazy: true },
  "Orus": { file: "orus", meanLinear: 0.1753, normal: "orus-normal", lazy: true },
  "Hilda": { file: "hilda", meanLinear: 0.1619, normal: "hilda-normal", lazy: true },
  "Donaldjohanson": { file: "donaldjohanson", meanLinear: 0.1626, normal: "donaldjohanson-normal", lazy: true },
  "Dinkinesh": { file: "dinkinesh", meanLinear: 0.1507, normal: "dinkinesh-normal", lazy: true },
  "Selam": { file: "selam", meanLinear: 0.1512, normal: "selam-normal", lazy: true },
  "Phaethon": { file: "phaethon", meanLinear: 0.1484, normal: "phaethon-normal", lazy: true },
  "Toutatis": { file: "toutatis", meanLinear: 0.1622, normal: "toutatis-normal", lazy: true },
  "Kamoʻoalewa": { file: "kamooalewa", meanLinear: 0.1604, normal: "kamooalewa-normal", lazy: true },
  "Cruithne": { file: "cruithne", meanLinear: 0.1628, normal: "cruithne-normal", lazy: true },
  "Moshup": { file: "moshup", meanLinear: 0.1543, normal: "moshup-normal", lazy: true },
  "Squannit": { file: "squannit", meanLinear: 0.1538, normal: "squannit-normal", lazy: true },
  "Geographos": { file: "geographos", meanLinear: 0.1612, normal: "geographos-normal", lazy: true },
});

/* The map's URL for a body, for the board's binary view, which draws the
 * globes before the scene has necessarily fetched them. */
export function smallBodyTextureUrl(name) {
  const entry = SMALL_BODY_TEXTURES[name];
  return entry ? `${PUBLIC_ASSET_ROOT}/textures/smallbodies/${entry.file}.jpg` : null;
}

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
  if (entry.lazy && !material.userData.textureRequested) {
    /* Held until the camera comes near: `loadNearbyTextures` calls this
     * again with the flag set. */
    material.userData.loadTexture = () => {
      material.userData.textureRequested = true;
      applySmallBodyTexture(material, record);
    };
    return;
  }

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
  if (cached) attach(cached);
  else queueSmallBodyTexture(url, attach);

  /*
   * A normal map, for the bodies that have one (the batch B binaries).
   *
   * Not the displacement or bump map ruled out above: it moves no vertex
   * and changes no silhouette, it only tilts the shading normal, so the
   * craters and grooves designed in binary-surface-lab.html are lit by the
   * scene's Sun instead of being painted on. PNG, and linear -- it is data,
   * not colour. Scale 1, the relief as it was approved in the lab.
   */
  if (entry.normal) {
    const normalUrl = `${PUBLIC_ASSET_ROOT}/textures/smallbodies/${entry.normal}.png`;
    const attachNormal = (normalMap) => {
      material.normalMap = normalMap;
      material.normalScale.set(1, 1);
      material.needsUpdate = true;
    };
    const cachedNormal = smallBodyTextureCache.get(normalUrl);
    if (cachedNormal) attachNormal(cachedNormal);
    else queueSmallBodyTexture(normalUrl, attachNormal, { linear: true });
  }
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

function queueSmallBodyTexture(url, attach, { linear = false } = {}) {
  smallBodyTextureQueue.push({ url, attach, linear });
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
    // A data map (a normal map) must reach the GPU exactly as stored: no
    // colour-profile conversion on decode.
    .then((blob) => createImageBitmap(blob, next.linear
      ? { imageOrientation: "flipY", colorSpaceConversion: "none", premultiplyAlpha: "none" }
      : { imageOrientation: "flipY" }))
    .then((bitmap) => {
      const map = new THREE.Texture(bitmap);
      // The bitmap arrives already flipped by the option above, so three.js
      // must not flip it again or the map lands upside down.
      map.flipY = false;
      map.colorSpace = next.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
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
  applyNightSide(material);
  return material;
}

/*
 * The night side stays night.
 *
 * Reported: on the bodies with normal maps, the hemisphere facing away from
 * the Sun showed its craters and boulders in a pale, whitish relief, as if
 * lit from behind. It was lit from behind. Besides the Sun the scene has two
 * fixed directional fills (main.js: a cool one from (-50, 40, 90) and a warm
 * one from (120, 18, 36)) and, while an asteroid is focused, an ambient of
 * 0.46. On a plain sphere a fill only lifts the dark side evenly; through a
 * normal map it lights every crater wall that happens to face it, so the
 * relief appeared on ground the Sun cannot reach.
 *
 * So for these materials every direct light is gated by where the Sun is:
 * the Sun sits at the world origin, and a fragment whose *geometric* normal
 * (before the normal map, `nonPerturbedNormal`) faces away from it gets no
 * direct light at all, with a soft step across the terminator. That also
 * stops the normal map itself leaking light past the terminator, which a
 * strongly tilted crater wall otherwise does. The ambient and the emissive
 * lift are kept on the night side at 30%, so a body's dark limb is still a
 * shape against the sky rather than a hole in it. The day side is exactly
 * as before. Nothing is changed for any other body in the scene.
 */
const NIGHT_SIDE_LIFT = 0.3;
function applyNightSide(material) {
  material.onBeforeCompile = (shader) => {
    /* The direction from the body's centre to this point, for the second
     * gate below. */
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 sbRadial;")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n\tsbRadial = mvPosition.xyz - ( modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 sbRadial;");
    const begin = THREE.ShaderChunk.lights_fragment_begin
      .replace(
        "vec3 geometryNormal = normal;",
        `vec3 geometryNormal = normal;
        vec3 sbSunDirection = normalize( ( viewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz - geometryPosition );
        // Two gates. The surface must face the Sun, and so must the side of
        // the body it is on: there are no shadows here, so without the
        // second a crater or trough wall on the night side that happens to
        // face sunward was lit through the rock (Dinkinesh, round 5). The
        // second gate is lenient -- it only closes well past the terminator
        // -- so long bodies lit end-on keep their sunlit tips.
        float sbHemisphere = smoothstep( -0.35, -0.05, dot( normalize( sbRadial ), sbSunDirection ) );
        float sbDay = smoothstep( -0.04, 0.10, dot( nonPerturbedNormal, sbSunDirection ) ) * sbHemisphere;
        float sbNightLift = mix( ${NIGHT_SIDE_LIFT.toFixed(2)}, 1.0, sbDay );`,
      )
      .replaceAll("RE_Direct( directLight,", "directLight.color *= sbDay;\n\t\tRE_Direct( directLight,")
      .replace(
        "vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );",
        "vec3 irradiance = getAmbientLightIrradiance( ambientLightColor ) * sbNightLift;",
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_begin>",
      `${begin}
      totalEmissiveRadiance *= sbNightLift;`,
    );
  };
  material.customProgramCacheKey = () => "small-body-night-side-2";
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

/*
 * How far apart a binary's bodies can get: the sum of each mutual orbit's
 * apocentre separation, a(1 + e). For a pair that is the widest the two
 * ever are; for Lempo's hierarchy (Hiisi inside, Paha round the pair) it is
 * an upper bound on the distance from any one body to any other. Framing on
 * it keeps all of them on screen from whichever body is focused, for the
 * whole of their orbits.
 */
function binarySystemSpan(record, renderedMeanRadius) {
  return satellitesOf(record)
    .filter((moon) => moon.barycentric)
    .reduce((sum, moon) => sum
      + moonSeparation(record, renderedMeanRadius, moon)
        * (1 + THREE.MathUtils.clamp(Number(moon.eccentricity) || 0, 0, 0.95)), 0);
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
        /* An open orbit has no aphelion, so the instrument's nearest-to-
         * farthest range is withheld for it rather than computed wrong. */
        unbound: Boolean(elements.hyperbolic),
        /*
         * Where the body is now, not its semi-major axis. The instrument
         * placed every small body at a along its current direction, which
         * is right for a near-circular orbit and wrong for everything else:
         * Halley at 17.9 AU when it is at 35, and C/2014 UN271 at 14,767 AU
         * when it is at 13.6. Kept live by `updateSmallBodies`; a moon reads
         * its parent's, because `elements` is the parent's orbit.
         */
        get currentAU() { return elements.currentAU; },
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
      activity: record.info?.activity ?? activityNote(record),
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
  /* `meshDetail` is the Rank 7-10 bodies' share: 0.75 of the full sphere
   * (72 x 48, about 6,900 triangles). They carry normal maps, which is where
   * their craters and pits are drawn, so the vertices only have to carry
   * the silhouette -- and twenty-seven more of them at the full count would
   * add 330,000 triangles to a scene that measured 438,000. */
  const meshDetail = record.meshDetail ?? 1;
  const width = Math.max(28, Math.round((parentName ? 40 : 96) * detailScale * meshDetail));
  const height = Math.max(20, Math.round((parentName ? 28 : 64) * detailScale * meshDetail));

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
  /* (name) => the drawn planet's Object3D, for the co-orbital frames. Without
   * it (the headless harness) those frames simply do not turn. */
  resolvePlanet = null,
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
  /* Materials whose maps wait for the camera (the `lazy` texture entries). */
  const lazyTextures = [];

  /* One frame per planet that anything is drawn relative to; see
   * CO_ORBITAL_PLANETS. `model` is the real planet on the scene's clock. */
  const coOrbitalFrames = {};
  const coOrbitalFrameFor = (name) => {
    if (!CO_ORBITAL_PLANETS[name]) return null;
    if (!coOrbitalFrames[name]) {
      const frame = new THREE.Group();
      frame.name = `${name} co-orbital frame`;
      system.add(frame);
      coOrbitalFrames[name] = {
        name,
        frame,
        model: coOrbitalModel(name, referenceJD),
        planet: resolvePlanet?.(name) ?? null,
        guides: [],
        angle: 0,
      };
    }
    return coOrbitalFrames[name];
  };

  for (let index = 0; index < ALL_SMALL_BODIES.length; index += 1) {
    const record = ALL_SMALL_BODIES[index];
    const orbit = prepareOrbit(record.orbit, referenceJD);
    const coOrbital = record.coOrbital ? coOrbitalFrameFor(record.coOrbital.planet) : null;
    if (coOrbital) {
      /* On the planet's clock, at the resonance's exact ratio: Hektor and
       * Jupiter keep step (1), Hilda goes round 3 times to Jupiter's 2
       * (1.5). The ratio of long-term mean motions is what a resonance
       * is; the osculating periods differ from it by a few per cent, and
       * the scene's compressed curve (period^0.45) would turn 3:2 into
       * 1.2:1. */
      orbit.visualRate = coOrbital.model.visualRate * (record.coOrbital.ratio ?? 1);
      orbit.coOrbital = coOrbital;
    }
    /* The body's distance from the Sun has to be known *before* it is built,
     * because the colour baked into its vertices is pre-divided by the
     * irradiance it will receive there -- see `solarCompensation`. It is
     * computed once at build time and not tracked afterwards: the fastest
     * mover in the set is Apophis, whose heliocentric distance changes by
     * about 0.1 AU over an hour of wall-clock at the scene's compressed
     * orbital rate, which is a 3% change in irradiance. Re-baking 12,000
     * vertex colours for that would be absurd. */
    const currentAU = radiusAtMeanAnomaly(orbit, orbit.meanAnomaly);
    orbit.currentAU = currentAU;
    const sceneRadius = smallBodyAuToScene(currentAU);
    const built = buildBody(record, { detailScale, sceneRadius, textured });
    if (built.mesh.material.userData.loadTexture) lazyTextures.push({ group: built.group, material: built.mesh.material });

    /*
     * A binary is placed by its centre of mass, not by its primary.
     *
     * `frame` rides the heliocentric orbit; `inner` is the centre of mass of
     * the primary and its inner partner, which for a plain pair sits on
     * `frame` and for Lempo circles it with Paha. The primary hangs off
     * `inner` and is moved about it every frame by `updateBinarySystem`, so
     * everything that reads the primary's world position -- the camera, the
     * pointer, the distance instrument -- sees it where it really is.
     */
    const binary = satellitesOf(record).some((moon) => moon.barycentric)
      ? { frame: new THREE.Group(), inner: new THREE.Group(), orbits: [] }
      : null;
    if (binary) {
      binary.frame.name = `${record.name} system barycentre`;
      binary.inner.name = `${record.name} inner barycentre`;
      binary.frame.add(binary.inner);
      binary.inner.add(built.group);
      /* A locked body keeps its long axis on its partner, so its own
       * obliquity has to be zero: the orientation comes from the orbit. */
      if (record.tidallyLocked) built.tilt.rotation.set(0, 0, 0);
      binary.paths = [];
      /* The named body's label above its ring, its partners' below: Lempo
       * and Hiisi are nine pixels apart on arrival and their names would
       * otherwise print over each other. */
      binary.markers = [createBinaryMarker(record.name, built.group, built.renderedMeanRadius, true)];
      binary.active = false;
    }

    positionFromOrbit((binary ? binary.frame : built.group).position, orbit, orbit.meanAnomaly);

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
      /* A binary is framed on the whole system, `framePair` or not: the
       * subject is the bodies going round each other, and a frame holding
       * one of them is the planet-and-moon picture this is not. */
      pairSeparation: binary
        ? binarySystemSpan(record, built.renderedMeanRadius)
        : record.framePair === false
          ? 0
          : moonSeparation(record, built.renderedMeanRadius),
      elements: orbit,
      ringOuterRadius: rings?.outerRadius ?? 0,
      comaRadius: coma ? built.reach * (record.coma?.radii ?? 0) : 0,
    });
    built.group.userData.orbit = orbit;
    /* How far the system reaches from this body, for main.js to keep the
     * selection card clear of the partners. */
    if (binary) built.group.userData.selectionClearance = binarySystemSpan(record, built.renderedMeanRadius);

    const entry = {
      record,
      orbit,
      group: built.group,
      spinner: built.spinner,
      spinRate: record.tidallyLocked
        ? 0
        : (Math.PI * 2) / visualPeriodSeconds(record.rotationHours)
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
      binary,
      /* In body radii, which is the unit `ringProximity` works in. */
      ringBodyRadius: built.renderedMeanRadius,
      coma,
      /* A comet's coma follows its distance from the Sun; a Centaur's is
       * always on. */
      activity: coma && record.activity ? record.activity : null,
      coOrbital,
    };
    if (entry.activity) setComaStrength(coma, cometActivity(entry.activity, currentAU, record.orbit));

    satellitesOf(record).forEach((moon, moonIndex) => {
      const moonRecord = {
        ...moon,
        id: `${record.id}-moon-${moonIndex + 1}`,
        detail: `${moon.barycentric ? "Binary partner" : "Natural satellite"} | ${record.name} system`,
        chroma: moon.chroma ?? record.chroma,
        metalness: record.metalness ?? 0,
        /* A binary partner has a spin of its own, measured or not; an
         * ordinary moon here is drawn turning once per orbit. */
        rotationHours: moon.rotationHours ?? moon.periodHours,
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

      if (builtMoon.mesh.material.userData.loadTexture) lazyTextures.push({ group: builtMoon.group, material: builtMoon.mesh.material });
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
        pairSeparation: binary && moon.barycentric
          ? binarySystemSpan(record, built.renderedMeanRadius)
          : record.framePair === false ? 0 : separation,
        /* A moon takes its parent's heliocentric element set, for the reason
         * the instrument's own satellite branch gives: Dactyl's 90 km orbit
         * around Ida is nothing beside Ida's 2.86 AU orbit around the Sun. */
        elements: orbit,
      });
      if (binary && moon.barycentric) {
        builtMoon.group.userData.selectionClearance = binarySystemSpan(record, built.renderedMeanRadius);
      }
      builtMoon.group.userData.info.distanceFromEarth =
        `Orbits ${record.name} at ${moon.separationKm < 10
          ? `${(moon.separationKm * 1000).toFixed(0)} m`
          : `${moon.separationKm} km`}; distance from Earth continuously varies`;

      if (binary && moon.barycentric) {
        if (moon.tidallyLocked) builtMoon.tilt.rotation.set(0, 0, 0);
        const around = moon.around === "pair" ? "pair" : "primary";
        const holder = around === "pair" ? binary.frame : binary.inner;
        holder.add(builtMoon.group);
        const q = Math.max(0, Number(moon.massRatio) || 0);
        const e = THREE.MathUtils.clamp(Number(moon.eccentricity) || 0, 0, 0.95);
        const orientation = new THREE.Quaternion().setFromEuler(
          new THREE.Euler((moon.inclinationDeg ?? 0) * DEG, 0, 0),
        );
        const binaryOrbit = {
          group: builtMoon.group,
          around,
          separation,
          q,
          e,
          orientation,
          rate: (Math.PI * 2) / visualPeriodSeconds(moon.periodHours),
          /* Two partners of one system start on opposite sides. */
          phase: (moonIndex / Math.max(1, satellitesOf(record).length)) * Math.PI * 2,
          locked: Boolean(moon.tidallyLocked && record.tidallyLocked),
        };
        binary.orbits.push(binaryOrbit);
        /*
         * Two paths per pair, both about the centre of mass: the partner's,
         * scaled 1/(1+q) of the separation, and the primary's (or, for
         * Paha, the inner pair's centre's), scaled q/(1+q) and on the
         * opposite side. With the published eccentricity, so Thorondor's
         * 0.56 is visibly a stretched path and not a circle.
         */
        /* Hidden until one of the system's bodies is focused, then lit
         * together by `updateBinaryHighlights`: from the heliocentric view
         * they were a knot of crossing ellipses beside one guide, read as
         * mistaken lines (reported). The centre-of-mass cross is gone for
         * the same reason. */
        const partnerPath = createBinaryPath(separation, e, 1 / (1 + q), orientation, `${moon.name} path`, 0.34);
        const counterPath = createBinaryPath(separation, e, -q / (1 + q), orientation,
          `${around === "pair" ? `${record.name}–${satellitesOf(record)[0]?.name} centre` : record.name} path`, 0.24);
        [partnerPath, counterPath].forEach((path) => {
          path.visible = false;
          holder.add(path);
          binary.paths.push(path);
        });
        binary.markers.push(createBinaryMarker(moon.name, builtMoon.group, builtMoon.renderedMeanRadius));

        const moonEntry = {
          pivot: null,
          binaryOrbit,
          group: builtMoon.group,
          spinner: builtMoon.spinner,
          rate: binaryOrbit.rate,
          spinRate: binaryOrbit.locked
            ? 0
            : (Math.PI * 2) / visualPeriodSeconds(moonRecord.rotationHours) * 0.6,
          phase: binaryOrbit.phase,
        };
        entry.moons.push(moonEntry);
        if (!entry.moon) entry.moon = moonEntry;
        hoverTargets.push(builtMoon.group);
        bodies.push({ ...moonEntry, record: moonRecord, isMoon: true, group: builtMoon.group });
        return;
      }

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

    const holder = coOrbital ? coOrbital.frame : system;
    if (binary) {
      /* First placement, so frame one is not every body at its centre. */
      updateBinarySystem(entry, 0);
      holder.add(binary.frame);
    } else {
      holder.add(built.group);
    }
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
      if (entry.binary) {
        /* One guide carries the whole system -- it is the centre of mass's
         * path round the Sun -- so its card names every body on it. */
        const names = [entry.record.name, ...satellitesOf(entry.record)
          .filter((moon) => moon.barycentric).map((moon) => moon.name)];
        const joined = names.length > 2
          ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
          : names.join(" & ");
        guide.userData.hoverTitle = `${joined} orbit`;
        guide.userData.hoverAction = `Click this orbit to travel to the ${entry.record.name} system`;
        guide.userData.hoverSecondary = `${names.length > 2 ? "A triple: three" : "A binary: two"} bodies share this path round the Sun, circling each other as they go`;
      }
      if (entry.orbit.hyperbolic) {
        guide.userData.hoverSecondary = `${orbitGuideSummary(entry.record) ?? "Open orbit"} · passing through, never to return`;
      }
      /* A guide stays a direct child of `orbitGuides` -- the hover registry
       * only looks there -- and is turned with its frame by hand instead. */
      if (entry.coOrbital) entry.coOrbital.guides.push(guide);
      orbitGuides.add(guide);
    });
  system.add(orbitGuides);

  /* The Trojan swarms and the Hilda triangle: a statistical population, in
   * Jupiter's frame. See resonantSwarms.js. */
  const jupiterFrame = coOrbitalFrames.Jupiter;
  const swarms = jupiterFrame
    ? createResonantSwarms({ model: jupiterFrame.model, auToScene: smallBodyAuToScene, hoverTargets, markPointerProxy })
    : null;
  if (swarms) {
    jupiterFrame.frame.add(swarms.group);
    jupiterFrame.swarmGroup = swarms.group;
  }

  const frames = Object.values(coOrbitalFrames);
  updateCoOrbitalFrames(frames);

  world.add(system);

  return {
    system,
    orbitGuides,
    coOrbitalFrames: frames,
    swarms,
    lazyTextures,
    lazyCheck: 0,
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
  /* Rank 8. First, because two of the three are comets too: a path that
   * never closes gets a colour no closed one has. */
  [/interstellar/i, 0xe3a8ff],
  /* Rank 9: Jupiter's own orbitColor (0xe2bc8a), so the swarms and the
   * resonant bodies read as Jupiter's family. */
  [/jupiter trojan|hilda/i, 0xe2bc8a],
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
  /* An open orbit is sampled the same way in the hyperbolic anomaly, from
   * the inbound 60 AU crossing to the outbound one, and left open. */
  const open = Boolean(orbit.hyperbolic);
  const at = open
    ? (H, target) => positionFromOrbit(target, orbit, orbit.e * Math.sinh(H) - H)
    : (E, target) => positionFromOrbit(target, orbit, E - orbit.e * Math.sin(E));
  const start = open ? -orbit.loopH : 0;
  const span = open ? 2 * orbit.loopH : Math.PI * 2;
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
  at(start, point);
  let previous = point.clone();
  positions.push(previous.x, previous.y, previous.z);
  for (let i = 1; i <= ORBIT_GUIDE_SEGMENTS; i += 1) {
    const E0 = start + ((i - 1) / ORBIT_GUIDE_SEGMENTS) * span;
    const E1 = start + (i / ORBIT_GUIDE_SEGMENTS) * span;
    const next = new THREE.Vector3();
    at(i === ORBIT_GUIDE_SEGMENTS && !open ? 0 : E1, next);
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
    /*
     * Additive, not the default normal blending.
     *
     * Reported: zoomed right out, the Sun turned into a black spot. From the
     * outermost view every one of these guides passes within a few pixels of
     * the Sun, and with normal blending each one replaced a third of the
     * photosphere's light with its own dim colour -- sixty of them stacked
     * there and the brightest thing in the scene came out darker than the
     * sky. Measured in an offscreen render at the widest view: the Sun's
     * centre read 0.78 with the guides, 1.27 without, 1.27 with them
     * additive. (It was already dimming before Ranks 7-10; the 33 new guides
     * took it to black.) Additive light can only ever add, so a guide can no
     * longer darken anything it crosses, and on black space it looks the
     * same as before.
     */
    blending: THREE.AdditiveBlending,
  }));
  line.name = `${record.name} orbit`;
  // An orbit that reaches 35 AU has a bounding sphere most of the scene wide,
  // so frustum culling on it is a cost with no benefit.
  line.frustumCulled = false;
  line.renderOrder = -12;
  attachDecimatedPickPath(line, ORBIT_GUIDE_PICK_STRIDE, { closed: !open });
  return line;
}


const _position = new THREE.Vector3();
const _planetWorld = new THREE.Vector3();
const _lazyWorld = new THREE.Vector3();

/*
 * Fetches a lazy body's maps once the camera comes within twelve of its
 * framing distances -- a few seconds before arrival when flying to it, and
 * never for a body nobody visits. Checked every 30th frame; a handful of
 * distance tests when it runs, nothing at all once every map is in.
 */
function loadNearbyTextures(smallBodies, camera) {
  const list = smallBodies.lazyTextures;
  if (!camera || !list?.length) return;
  smallBodies.lazyCheck = (smallBodies.lazyCheck + 1) % 30;
  if (smallBodies.lazyCheck !== 0) return;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const { group, material } = list[i];
    group.getWorldPosition(_lazyWorld);
    const reach = (group.userData.focusDistance ?? 1) * 12;
    if (_lazyWorld.distanceToSquared(camera.position) > reach * reach) continue;
    material.userData.loadTexture?.();
    list.splice(i, 1);
  }
}

/*
 * Turns each co-orbital frame so the modelled real planet lands on the drawn
 * one. Two atan2s and a handful of rotations per frame.
 */
function updateCoOrbitalFrames(frames, motionScale = 0) {
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i];
    f.model.meanAnomaly += f.model.visualRate * motionScale;
    if (f.model.meanAnomaly > Math.PI * 2) f.model.meanAnomaly -= Math.PI * 2;
    positionFromOrbit(_position, f.model, f.model.meanAnomaly);
    const modelled = Math.atan2(_position.z, _position.x);
    if (f.swarmGroup) f.swarmGroup.rotation.y = -modelled;
    if (!f.planet) continue;
    f.planet.getWorldPosition(_planetWorld);
    if (_planetWorld.lengthSq() < 1e-8) continue;
    const drawn = Math.atan2(_planetWorld.z, _planetWorld.x);
    /* rotation.y = theta moves a longitude by -theta in this frame. */
    const angle = -(drawn - modelled);
    if (angle === f.angle) continue;
    f.angle = angle;
    f.frame.rotation.y = angle;
    for (let g = 0; g < f.guides.length; g += 1) f.guides[g].rotation.y = angle;
  }
}

/*
 * The card's "Activity" row: what the glow round a body is and when it is
 * there (Prompts.md round 3: "mention the reflectivity property in their
 * info cards"). The numbers are the record's own `activity` thresholds; a
 * record with something more specific to say (Phaethon) gives
 * `info.activity` itself.
 */
function activityNote(record) {
  /* Round 8 (the owner): "Chariklo, Pholus is not glowing?" -- right, and
   * the card now says so. No coma or outburst has ever been detected on
   * either (Chariklo's 1997-2008 brightness changes were its rings tilting,
   * Duffard et al. 2014, A&A 568, A79); only some Centaurs are active, Chiron
   * and Echeclus among them. */
  if (!record.coma) {
    return /^Centaur/.test(record.classification ?? "")
      ? "Never seen to glow. Unlike Chiron and Echeclus, no coma or outburst has ever been detected on it — out here it is too cold for its ice to turn to gas, so it stays a bare, dark rock."
      : null;
  }
  if (record.activity) {
    const { onsetAU } = record.activity;
    const q = record.orbit && record.orbit.e < 1 ? record.orbit.aAU * (1 - record.orbit.e) : null;
    const closest = q ? `brightest at its closest, ${q < 10 ? q.toFixed(2) : q.toFixed(1)} AU` : "brightest at its closest";
    return `Wakes inside about ${onsetAU} AU of the Sun and is ${closest}. Two kinds of light: dust reflecting sunlight — the pale, whitish-yellow coma and a broad dust tail that curves back along the orbit — and gas glowing under the Sun's ultraviolet — a green head of C₂ and cyanogen, and a straight, narrow blue tail of carbon-monoxide ions pointing exactly away from the Sun. The scene follows its real distance, so far out it is a bare nucleus — to watch it wake up, open All bodies and press "Check out its glow" on its row.`;
  }
  return "Shows a faint coma — gas and dust round the nucleus from outbursts — even this far from the Sun. Drawn on all the time.";
}

/*
 * How active a comet is at a distance from the Sun, 0 to 1 -- the "glow
 * capacity" the board and the glow view print.
 *
 * Water ice sublimates efficiently inside about 3 AU, which is where a
 * Jupiter-family comet's coma switches on (the standard limit; e.g. Meech &
 * Svoreň 2004, Comets II). Each record gives its own `onsetAU` -- where the
 * coma first appears -- because a CO-driven comet like C/2014 UN271 is
 * active at 24 AU and Hale-Bopp went quiet only at about 28.
 *
 * Round 9 (the owner): Encke read 100% at 0.54 AU, though it comes in to
 * 0.34. Two things did that. The top of the scale was the record's `fullAU`
 * (0.4 for Encke), and the round-7 curve, 1 - (1 - t)^2, is flat at that
 * end, so the last fifth of the way in all rounded to 100%. A comet does not
 * level off before perihelion: its brightness keeps climbing all the way in.
 * The standard description is a power law in distance -- total magnitude
 * m = H + 5 log(delta) + 2.5 n log(r) (e.g. Everhart 1967; n is typically
 * 2 to 6) -- which is a straight line in log r. So the glow now runs
 * straight in log distance, from 0 at `onsetAU` to 1 at the comet's own
 * perihelion, its closest point, where it is brightest:
 *
 *   glow = ln(onset / r) / ln(onset / q)
 *
 * The glow view's distance bar is logarithmic too, so the two bars move in
 * step. `orbit` (aAU, e) gives the perihelion; without it, `fullAU` stands in.
 */
export function cometActivity(activity, au, orbit = null) {
  const onset = activity.onsetAU;
  const perihelion = orbit && Number(orbit.e) < 1
    ? orbit.aAU * (1 - orbit.e)
    : activity.fullAU;
  const full = Math.min(perihelion, onset * 0.999);
  if (!(au < onset)) return 0;
  if (au <= full) return 1;
  return Math.log(onset / au) / Math.log(onset / full);
}

/*
 * Round 7: "Fly to that comet" from the glow view shows it as the viewer
 * left it there -- at the distance they chose, glowing that much -- rather
 * than wherever today's date puts it, which for most comets is dormant.
 *
 * Moves the comet along its own real orbit to the inbound point `rAU` from
 * the Sun (the same point the glow view draws), by setting its mean anomaly.
 * Nothing else changes: its clock carries on from there, so its coma,
 * position, orbit and distance read-outs all agree. `restoreCometToToday`
 * puts it back where its clock says it should be, counting any time that has
 * passed since. One comet at a time.
 */
export function placeCometAt(smallBodies, name, rAU, { outbound = false } = {}) {
  const entry = smallBodies?.bodies?.find((candidate) => candidate.record?.name === name && candidate.activity);
  if (!entry || entry.orbit.hyperbolic) return null;
  const orbit = entry.orbit;
  const { aAU, e } = orbit;
  const q = aAU * (1 - e);
  const Q = aAU * (1 + e);
  const r = THREE.MathUtils.clamp(rAU, q, Q);
  /* Inbound half (before perihelion): eccentric anomaly negative. Round 8:
   * the glow view now opens where the comet is today, which may be on its
   * way out, so the leg comes with the distance. */
  const E = (outbound ? 1 : -1) * Math.acos(THREE.MathUtils.clamp((1 - r / aAU) / e, -1, 1));
  let M = E - e * Math.sin(E);
  if (M < 0) M += Math.PI * 2;
  if (!entry.placement) entry.placement = { todayM: orbit.meanAnomaly, setM: M };
  else {
    /* Placed again: bank the time that passed since the last placement. */
    entry.placement.todayM += wrapAngle(orbit.meanAnomaly - entry.placement.setM);
    entry.placement.setM = M;
  }
  orbit.meanAnomaly = M;
  settleSmallBody(entry);
  return { name, au: orbit.currentAU, strength: entry.coma?.strength ?? 0 };
}

export function restoreCometToToday(smallBodies, name) {
  const entry = smallBodies?.bodies?.find((candidate) => candidate.record?.name === name && candidate.placement);
  if (!entry) return false;
  const { todayM, setM } = entry.placement;
  let M = todayM + wrapAngle(entry.orbit.meanAnomaly - setM);
  M = ((M % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  entry.placement = null;
  entry.orbit.meanAnomaly = M;
  settleSmallBody(entry);
  return true;
}

function wrapAngle(angle) {
  return ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

/* One body's share of `updateSmallBodies`, applied at once, so a jump lands
 * even while the universe is paused behind the board. The dust tail learns
 * its trailing side from frame-to-frame motion; a jump is not motion, so it
 * is told the real direction instead (where it was a moment earlier). */
const _settleBefore = new THREE.Vector3();
function settleSmallBody(entry) {
  const orbit = entry.orbit;
  orbit.currentAU = positionFromOrbit(_position, orbit, orbit.meanAnomaly).radiusAU;
  (entry.binary ? entry.binary.frame : entry.group).position.copy(_position);
  if (entry.activity) setComaStrength(entry.coma, cometActivity(entry.activity, orbit.currentAU, orbit));
  const emission = entry.coma?.emission;
  if (emission) {
    positionFromOrbit(_settleBefore, orbit, orbit.meanAnomaly - 0.002);
    emission.trailing.copy(_settleBefore).sub(_position);
    if (emission.trailing.lengthSq() > 1e-12) emission.trailing.normalize();
    else emission.trailing.set(1, 0, 0);
    emission.lastPosition = null;
  }
}

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
  /* Before the bodies, which hang inside these frames. The planets have
   * already taken this frame's step in main.js. */
  if (smallBodies.coOrbitalFrames) updateCoOrbitalFrames(smallBodies.coOrbitalFrames, motionScale);
  loadNearbyTextures(smallBodies, camera);
  /* The swarms fade out from far away, where they would pile onto the Sun. */
  updateResonantSwarms(
    smallBodies.swarms,
    camera,
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  for (let i = 0; i < smallBodies.bodies.length; i += 1) {
    const entry = smallBodies.bodies[i];
    const orbit = entry.orbit;

    orbit.meanAnomaly += cometSafeRate(entry) * motionScale;
    if (orbit.hyperbolic) {
      /* Out past 60 AU: start the pass again, inbound. */
      if (orbit.meanAnomaly > orbit.loopM) orbit.meanAnomaly -= 2 * orbit.loopM;
    } else if (orbit.meanAnomaly > Math.PI * 2) orbit.meanAnomaly -= Math.PI * 2;
    orbit.currentAU = positionFromOrbit(_position, orbit, orbit.meanAnomaly).radiusAU;
    if (entry.activity) setComaStrength(entry.coma, cometActivity(entry.activity, orbit.currentAU, orbit));
    if (entry.binary) {
      entry.binary.frame.position.copy(_position);
      updateBinarySystem(entry, elapsed);
    } else {
      entry.group.position.copy(_position);
    }

    entry.spinner.rotation.y = entry.spinRate * elapsed;
    if (entry.tumbleRate) entry.spinner.rotation.z = entry.tumbleRate * elapsed;

    const moons = entry.moons ?? (entry.moon ? [entry.moon] : []);
    for (let m = 0; m < moons.length; m += 1) {
      const moon = moons[m];
      if (moon.pivot) moon.pivot.rotation.y = (moon.phase ?? 0) + moon.rate * elapsed;
      moon.spinner.rotation.y = moon.spinRate * elapsed;
    }

    if (entry.rings) updateRingSystem(entry, spinSeconds, camera);
    if (entry.coma) updateCentaurComa(entry.coma, entry.group, camera);
  }
}

/*
 * Round 11 (the owner): a comet at 100% glow -- that is, at perihelion --
 * made "the orbital path dance". Measured, not guessed: per 60 fps frame
 * while it is focused (the scene clock runs at 0.026 then, main.js), a
 * comet at perihelion moved this much of the camera's framing distance:
 *
 *   Tempel 1 0.95%, Wild 2 1.3%, Hartley 2 1.3%, 67P 1.7%, Encke 3.3%,
 *   Pons-Brooks 6.4%, Halley 8.1%, Phaethon 11.6%, Hale-Bopp 20%,
 *   UN271 83%, NEOWISE 263%
 *
 * against about 0.2% at aphelion. Two things compound there: Kepler's
 * second law (at perihelion the true anomaly runs (1 + e)^2 / (1 - e^2)^1.5
 * times its average rate -- 236 times for Halley, about 62,000 for NEOWISE)
 * and the scene's own compressions, which shorten long periods far more
 * than they shrink perihelion distances. The camera follows the comet
 * rigidly, so the comet itself held still; everything near it -- its own
 * orbit line, the Sun's -- swept past several per cent of the screen every
 * frame, and with real frame-time jitter that reads as shaking.
 *
 * So a comet's clock is capped near perihelion: never faster than 0.4% of
 * its framing distance per focused frame (about a quarter of the frame per
 * second). Where it already moves slower -- all of the outer orbit -- the
 * rate is exactly as before. Position still comes from the mean anomaly, so
 * where it is, its distance and its glow are all still the real orbit's;
 * it only lingers a little longer at its closest, which is the part worth
 * watching. Comets only: nothing else in the scene changes.
 */
const COMET_FOCUSED_CLOCK = 0.026; // main.js: motionScale while a body is focused
const COMET_MAX_FOCUSED_STEP = 0.004; // of the framing distance, per 60 fps frame
function cometSafeRate(entry) {
  const orbit = entry.orbit;
  if (!entry.activity || orbit.hyperbolic || orbit.sceneP === undefined) return orbit.visualRate;
  const framing = entry.group.userData?.focusDistance ?? 1;
  const e = orbit.e;
  const E = eccentricAnomaly(orbit.meanAnomaly, e);
  const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
  const sinNu = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
  // Scene units travelled per unit of mean anomaly, along the drawn conic:
  // round (r dnu) and out (dr/dnu dnu) together -- far out on a long orbit
  // the outward part is most of it.
  const denominator = 1 + orbit.sceneE * cosNu;
  const sceneRadius = orbit.sceneP / denominator;
  const radialPerNu = (orbit.sceneP * orbit.sceneE * sinNu) / (denominator * denominator);
  const nuPerM = ((1 + e * cosNu) * (1 + e * cosNu)) / Math.pow(1 - e * e, 1.5);
  const unitsPerM = Math.hypot(sceneRadius, radialPerNu) * nuPerM;
  if (!(unitsPerM > 0)) return orbit.visualRate;
  const capRate = (COMET_MAX_FOCUSED_STEP * framing) / (unitsPerM * COMET_FOCUSED_CLOCK);
  return Math.min(orbit.visualRate, capRate);
}

/*
 * Moves a binary's bodies about their centre of mass.
 *
 * For each mutual orbit: the mean anomaly on the module's moon clock, the
 * eccentric anomaly from Kepler's equation, the relative position of the
 * partner in the orbit plane, and then each body at its share of it -- the
 * partner at 1/(1+q) on one side, the primary (or the inner pair's centre)
 * at q/(1+q) on the other. The relative vector is exact; only the clock is
 * compressed. A few dozen multiplies per system per frame.
 *
 * A doubly synchronous pair also turns so that each keeps its long axis on
 * the other: its group takes the orbit-plane orientation and the pair's
 * current angle, and its spin is zero.
 */
const _binaryRel = new THREE.Vector3();
const _binaryTurn = new THREE.Quaternion();
const _binaryUp = new THREE.Vector3(0, 1, 0);
function updateBinarySystem(entry, elapsed) {
  const { binary } = entry;
  for (let i = 0; i < binary.orbits.length; i += 1) {
    const o = binary.orbits[i];
    let meanAnomaly = (o.phase + o.rate * elapsed) % (Math.PI * 2);
    if (meanAnomaly < 0) meanAnomaly += Math.PI * 2;
    const E = eccentricAnomaly(meanAnomaly, o.e);
    const x = o.separation * (Math.cos(E) - o.e);
    const z = -o.separation * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
    _binaryRel.set(x, 0, z).applyQuaternion(o.orientation);
    o.group.position.copy(_binaryRel).multiplyScalar(1 / (1 + o.q));
    const counterweight = o.around === "pair" ? binary.inner : entry.group;
    counterweight.position.copy(_binaryRel).multiplyScalar(-o.q / (1 + o.q));
    if (o.locked) {
      _binaryTurn.setFromAxisAngle(_binaryUp, Math.atan2(-z, x));
      entry.group.quaternion.copy(o.orientation).multiply(_binaryTurn);
      o.group.quaternion.copy(entry.group.quaternion);
    }
  }
}

/* A partner's path about the centre of mass: the relative ellipse, scaled
 * (negative for the body on the far side), with the centre of mass at a
 * focus. Drawn, never picked -- see createMoonOrbitRing for why. */
function createBinaryPath(separation, e, scale, orientation, name, opacity) {
  const segments = 256;
  const vertices = new Float32Array((segments + 1) * 3);
  const minor = Math.sqrt(1 - e * e);
  for (let i = 0; i <= segments; i += 1) {
    const E = ((i % segments) / segments) * Math.PI * 2;
    vertices[i * 3] = separation * (Math.cos(E) - e) * scale;
    vertices[i * 3 + 1] = 0;
    vertices[i * 3 + 2] = -separation * minor * Math.sin(E) * scale;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0x86d8c4,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  }));
  line.name = name;
  line.quaternion.copy(orientation);
  line.renderOrder = -6;
  line.frustumCulled = false;
  line.raycast = () => {};
  return line;
}

/*
 * A ring and a name on each body of a focused binary.
 *
 * Framed on the whole system, most of these bodies are a pixel or two
 * across: Teharonhiawako and Sawiskera are 311 Teharonhiawako radii apart
 * (27,670 km against 89 km), and a frame that holds both cannot also show
 * either as more than a dot. That is the true picture and the point of it,
 * so it is kept -- but each dot gets a ring and its name, so the viewer can
 * see what is going round what. Screen-sized (`sizeAttenuation: false`),
 * never picked, drawn only while the system is focused, and faded out once
 * the body itself grows to fill the ring.
 *
 * BINARY_MARKER_SCALE is the sprite's height at unit distance, which with
 * attenuation off is its on-screen height as a fraction of 2 tan(fov/2):
 * at the app's 34-degree field that is 0.079 / 0.611 = 13 % of the viewport
 * height, so the 30-of-256-pixel ring below is about 13 px in radius on an
 * 850 px tall window and the 34 px name about 15 px -- the size of the
 * hover card's own text.
 */
const BINARY_MARKER_SCALE = 0.079;
const BINARY_MARKER_RING = 30 / 256;
function createBinaryMarker(name, group, radius, above = false) {
  /* Built on first use: a system nobody focuses never makes its canvases,
   * and the headless harness (no `document`) never makes any. */
  return { name, group, radius, above, sprite: null };
}

function buildBinaryMarkerSprite(marker) {
  if (marker.sprite || typeof document === "undefined") return marker.sprite;
  const { name, group, above } = marker;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    context.strokeStyle = "rgba(159, 240, 220, 0.95)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(256, 128, 30, 0, Math.PI * 2);
    context.stroke();
    let size = 34;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    do {
      context.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      size -= 2;
    } while (context.measureText(name).width > 490 && size > 18);
    context.lineWidth = 6;
    context.strokeStyle = "rgba(3, 10, 14, 0.85)";
    // Baselines: 206 puts the name under the ring, 76 over it.
    const baseline = above ? 76 : 206;
    context.strokeText(name, 256, baseline);
    context.fillStyle = "rgba(214, 248, 238, 0.98)";
    context.fillText(name, 256, baseline);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    sizeAttenuation: false,
  }));
  sprite.name = `${name} marker`;
  sprite.scale.set(BINARY_MARKER_SCALE * 2, BINARY_MARKER_SCALE, 1);
  sprite.renderOrder = 30;
  sprite.frustumCulled = false;
  sprite.visible = false;
  sprite.raycast = () => {};
  group.add(sprite);
  marker.sprite = sprite;
  return sprite;
}

/**
 * Lights a binary's mutual paths and markers while one of its bodies is
 * focused, and only then.
 *
 * The switch runs once per change, not per frame; the per-frame part is one
 * distance per marker of the focused system (two or three), to fade a ring
 * out as its body grows into it.
 */
const _markerWorld = new THREE.Vector3();
const _markerCamera = new THREE.Vector3();
export function updateBinaryHighlights(smallBodies, focusedBody = null, camera = null) {
  if (!smallBodies?.bodies) return;
  for (let i = 0; i < smallBodies.bodies.length; i += 1) {
    const entry = smallBodies.bodies[i];
    const binary = entry.binary;
    if (!binary?.markers) continue;
    const active = Boolean(focusedBody) && (focusedBody === entry.group
      || binary.orbits.some((orbit) => orbit.group === focusedBody));
    if (active !== binary.active) {
      binary.active = active;
      binary.paths.forEach((path) => {
        path.visible = active;
        /* Lit rather than merely shown: well over twice the old resting
         * opacity, the same step a hovered heliocentric guide takes. */
        const base = path.userData.baseOpacity ?? path.material.opacity;
        path.userData.baseOpacity = base;
        path.material.opacity = Math.min(0.9, base * 2.3);
      });
      binary.markers.forEach((marker) => {
        if (active) buildBinaryMarkerSprite(marker);
        if (marker.sprite) marker.sprite.visible = active;
      });
    }
    if (!active || !camera) continue;
    _markerCamera.setFromMatrixPosition(camera.matrixWorld);
    for (let m = 0; m < binary.markers.length; m += 1) {
      const marker = binary.markers[m];
      if (!marker.sprite) continue;
      marker.group.getWorldPosition(_markerWorld);
      const angular = marker.radius / Math.max(1e-6, _markerWorld.distanceTo(_markerCamera));
      /* Gone by the time the body's disc is 80 % of the ring's radius. */
      const fill = angular / (BINARY_MARKER_SCALE * BINARY_MARKER_RING);
      const opacity = 1 - THREE.MathUtils.smoothstep(fill, 0.35, 0.8);
      marker.sprite.material.opacity = opacity;
      marker.sprite.visible = opacity > 0.01;
    }
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

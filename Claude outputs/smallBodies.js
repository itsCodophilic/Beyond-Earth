import * as THREE from "three";
import {
  SOLAR_ORBIT_SCALE,
  getAsteroidVisualRadius,
  getSizeComparisonText,
} from "../../config/celestialScale.js";
import { markPointerProxy } from "../pointerProxies.js";
import { SMALL_BODIES, albedoToLinearValue } from "./smallBodyCatalogue.js";
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
function createSmallBodyMaterial(record, baseColor) {
  return new THREE.MeshStandardMaterial({
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
    orbitalEccentricity: record.orbit ? record.orbit.e : 0,
    distanceBasis: "real-orbital-elements",
    /* Small bodies need a much tighter camera than planets, and an elongated
     * one needs the distance measured from its *longest* axis or half of Eros
     * ends up outside the frame. `reach` is that half-extent. */
    focusScale: 7.5,
    focusDistance: Math.max(0.26, reach * (record.moon ? 9.5 : 6.4)),
    minFocusDistance: Math.max(0.20, reach * 3.2),
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

function buildBody(record, {
  detailScale = 1,
  parentName = null,
  parentVisualRadius = null,
  proxyCap = Infinity,
} = {}) {
  const chroma = record.chroma ?? [1, 1, 1];
  const baseValue = albedoToLinearValue(record.albedo);

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
   * by an exponent of 0.45 so that a 151 m moonlet is still something a
   * pointer can find. The card says the ratio is compressed.
   */
  const realMeanRadiusKm = record.diameterKm / 2;
  const renderedMeanRadius = parentVisualRadius
    ? parentVisualRadius * Math.pow(record.diameterKm / record.parentDiameterKm, 0.45)
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
  const material = createSmallBodyMaterial(record, baseColor);
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
  tilt.rotation.set(
    (record.shape.seed % 47) / 47 * 0.9 - 0.45,
    0,
    (record.shape.seed % 31) / 31 * 0.8 - 0.4,
  );
  tilt.add(spinner);

  /* A parent's own cap is derived from where its moon will sit, which is
   * knowable here: the separation is fixed by the real ratio to the parent's
   * radius and does not depend on anything the moon build decides. */
  const selfCap = record.moon
    ? renderedMeanRadius * (record.moon.separationKm / realMeanRadiusKm) * 0.55
    : proxyCap;

  const group = new THREE.Group();
  group.add(tilt);
  group.add(buildInteractionProxy(record.name, reach, selfCap));

  return { group, spinner, mesh, reach, renderedMeanRadius };
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
  const referenceJD = Number.isFinite(nowJD)
    ? nowJD
    : UNIX_EPOCH_JD + Date.now() / 86_400_000;

  const system = new THREE.Group();
  system.name = "Visited small bodies";

  const bodies = [];

  for (let index = 0; index < SMALL_BODIES.length; index += 1) {
    const record = SMALL_BODIES[index];
    const orbit = prepareOrbit(record.orbit, referenceJD);
    const built = buildBody(record, { detailScale });

    positionFromOrbit(built.group.position, orbit, orbit.meanAnomaly);
    const currentAU = orbit.aAU * (1 - orbit.e * Math.cos(
      eccentricAnomaly(orbit.meanAnomaly, orbit.e),
    ));

    attachMetadata(built.group, record, {
      visualRadius: built.renderedMeanRadius,
      reach: built.reach,
      heliocentricAU: currentAU,
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
      moon: null,
    };

    if (record.moon) {
      const moonRecord = {
        ...record.moon,
        id: `${record.id}-moon`,
        detail: `Natural satellite | ${record.name} system`,
        chroma: record.moon.chroma ?? record.chroma,
        metalness: record.metalness ?? 0,
        rotationHours: record.moon.periodHours,
        rotationState: "principal-axis",
        parentDiameterKm: record.diameterKm,
        orbit: null,
      };
      /* Separation at the real ratio to the parent's own radius: Dactyl at
       * 5.7 Ida radii, Dimorphos at 3.0 Didymos radii. */
      const separation = built.renderedMeanRadius
        * (record.moon.separationKm / (record.diameterKm / 2));

      const builtMoon = buildBody(moonRecord, {
        detailScale,
        parentName: record.name,
        parentVisualRadius: built.renderedMeanRadius,
        proxyCap: separation * 0.40,
      });

      attachMetadata(builtMoon.group, moonRecord, {
        visualRadius: builtMoon.renderedMeanRadius,
        reach: builtMoon.reach,
        heliocentricAU: currentAU,
        parentName: record.name,
      });
      builtMoon.group.userData.info.distanceFromEarth =
        `Orbits ${record.name} at ${record.moon.separationKm < 10
          ? `${(record.moon.separationKm * 1000).toFixed(0)} m`
          : `${record.moon.separationKm} km`}; distance from Earth continuously varies`;

      const pivot = new THREE.Group();
      pivot.name = `${record.moon.name} orbit`;
      pivot.rotation.x = (record.moon.inclinationDeg ?? 0) * DEG;
      builtMoon.group.position.set(separation, 0, 0);
      pivot.add(builtMoon.group);
      built.group.add(pivot);

      entry.moon = {
        pivot,
        group: builtMoon.group,
        spinner: builtMoon.spinner,
        rate: (Math.PI * 2) / visualPeriodSeconds(record.moon.periodHours),
        /* Dimorphos was tidally locked until DART hit it and now tumbles.
         * Dactyl's rotation was never measured. Both spin slowly here and
         * both cards say what is and is not known. */
        spinRate: (Math.PI * 2) / visualPeriodSeconds(record.moon.periodHours) * 0.6,
      };
      hoverTargets.push(builtMoon.group);
      bodies.push({ ...entry.moon, record: moonRecord, isMoon: true, group: builtMoon.group });
    }

    system.add(built.group);
    hoverTargets.push(built.group);
    bodies.push(entry);

    if (yieldToBrowser && index % 2 === 1) await yieldToBrowser();
  }

  world.add(system);

  return {
    system,
    bodies: bodies.filter((entry) => !entry.isMoon),
    allTargets: bodies.map((entry) => entry.group),
    elapsedSeconds: 0,
    referenceJD,
  };
}

const _position = new THREE.Vector3();

/**
 * One Kepler solve and two quaternion updates per body, per frame.
 *
 * Deliberately not throttled or level-of-detail'd: fifteen bodies is far too
 * few for that to be worth the branch. The belt's equivalent pass handles
 * three hundred and throttles; this one is a rounding error beside it.
 */
export function updateSmallBodies(smallBodies, motionScale = 1, spinSeconds = 1 / 60) {
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

    if (entry.moon) {
      entry.moon.pivot.rotation.y = entry.moon.rate * elapsed;
      entry.moon.spinner.rotation.y = entry.moon.spinRate * elapsed;
    }
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

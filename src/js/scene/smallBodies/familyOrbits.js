import * as THREE from "three";
import {
  ATIRA_ELEMENTS,
  ATEN_ELEMENTS,
  APOLLO_ELEMENTS,
  AMOR_ELEMENTS,
} from "./populationCatalogue.js";

/**
 * The near-Earth families, shown by their paths.
 *
 * Round 38 (Prompts.md: "when we hover over any of the Near earth asteroid
 * 4 families in space, it should show the orbital path of these asteroids").
 * The families used to be ~890 moving points (populationClouds.js), which
 * read as twinkling stars. They are now real rocks (nearEarthFamilies.js),
 * and the family itself is shown the way an astronomer draws it: as the
 * bundle of every member's orbit. Hover or focus any member -- one of the
 * new rocks, or Eros, Apophis, Bennu and the rest -- and its whole family's
 * paths light; the board can light a family too.
 *
 * Membership is the standard definition (CNEOS, "NEO Groups"), from q and Q:
 *   Atira   a < 1 AU and Q < 0.983 AU   (never reaches Earth's orbit)
 *   Aten    a < 1 AU and Q > 0.983 AU   (crosses it from inside)
 *   Apollo  a > 1 AU and q < 1.017 AU   (crosses it from outside)
 *   Amor    a > 1 AU, 1.017 < q < 1.3 AU (comes near, never crosses)
 * 0.983 and 1.017 AU are Earth's own perihelion and aphelion.
 *
 * The orbits are the same rows the clouds used: every Atira and the
 * kilometre-class Atens, Apollos and Amors (H < 17.75), from the JPL SBDB
 * query of 8 October 2026 (populationCatalogue.js) -- 891 paths in all
 * (38 + 30 + 427 + 396). The drawn rocks' own orbits are their own guides.
 *
 * ## Cost
 *
 * Four `LineSegments`, built once while the scene loads (`sampleOrbitPath`:
 * about 116,000 segments for all four, 2.8 MB, ~80 ms). Each is invisible -- no draw call -- until its family is lit, and
 * only one family is lit at a time (two while one fades out). Nothing runs
 * per frame but a fade.
 */

export const NEAR_EARTH_FAMILIES = Object.freeze({
  atira: {
    key: "atira",
    label: "Atiras",
    /* Colours as the clouds had them: warm inside Earth's orbit, cool
     * outside -- amber, gold, green, sky blue. */
    colour: 0xffbf86,
    rows: ATIRA_ELEMENTS,
  },
  aten: { key: "aten", label: "Atens", colour: 0xffe08a, rows: ATEN_ELEMENTS },
  apollo: { key: "apollo", label: "Apollos", colour: 0x9ff0b8, rows: APOLLO_ELEMENTS },
  amor: { key: "amor", label: "Amors", colour: 0x8ad6ff, rows: AMOR_ELEMENTS },
});

/* Earth's perihelion and aphelion, AU (CNEOS group boundaries). */
const EARTH_Q = 0.983;
const EARTH_BIG_Q = 1.017;
/* The Amors' outer limit: q < 1.3 AU is the definition of a near-Earth
 * object (CNEOS). */
const NEO_Q_LIMIT = 1.3;

/** The family an orbit belongs to, or null if it is not a near-Earth orbit. */
export function nearEarthFamilyOf(orbit) {
  if (!orbit || orbit.hyperbolic || !(orbit.aAU > 0) || !(orbit.e < 1)) return null;
  const a = orbit.aAU;
  const q = a * (1 - orbit.e);
  const Q = a * (1 + orbit.e);
  if (a < 1) return Q < EARTH_Q ? "atira" : "aten";
  if (q < EARTH_BIG_Q) return "apollo";
  if (q < NEO_Q_LIMIT) return "amor";
  return null;
}

const DEG = Math.PI / 180;

/*
 * Round 39, third pass (the owner: "the orbital paths are still misaligned
 * for all those near-Earth asteroids").
 *
 * The paths were 72 straight segments, evenly spaced in true anomaly. A
 * straight chord cuts inside the curve, by as much as 7 scene units at an
 * eccentric orbit's perihelion -- and the rocks on them are drawn 0.02-0.09
 * units in radius, so the line ran tens of rock-widths beside the rock it was the
 * path of. smallBodies.js met the same thing with the named bodies' guides
 * (Bennu, Leleakuhonua) and fixed it the same way as here:
 *
 *   - points evenly spaced in *eccentric* anomaly, which puts them closest
 *     where the curve is sharpest (perihelion), and
 *   - each chord split in two while its middle misses the curve by more
 *     than PATH_TOLERANCE.
 *
 * Every point is where a rock on that orbit is drawn: the true anomaly from
 * the real eccentricity, the radius on the drawn conic -- exactly
 * nearEarthSwarm.js `place` and smallBodies.js `positionFromOrbit`.
 *
 * The family's sheaf is the picture from afar (the board's "Show ... in
 * space" opens on the whole inner system, where a scene unit is a fraction
 * of a pixel), so it is held to 0.25 scene units: worst miss 0.25, was 6.97,
 * ~116,000 segments for all four families (was 64,000). Close to a rock the
 * sheaf steps aside (`updateFamilyOrbits`) and the rock's own path, drawn
 * through the rock itself (nearEarthSwarm.js `drawOrbits`), is the line
 * that reads.
 */
export const PATH_TOLERANCE = 0.25;

/**
 * Points along one drawn orbit, as segments (LineSegments), into
 * `sink(x0, y0, z0, x1, y1, z1)`. `p`, `ecc`: the drawn conic; `e`: the real eccentricity.
 */
export function sampleOrbitPath({ p, ecc, e, node, inc, arg }, sink, tolerance = PATH_TOLERANCE) {
  const cn = Math.cos(node); const sn = Math.sin(node);
  const ci = Math.cos(inc); const si = Math.sin(inc);
  const root1 = Math.sqrt(1 + e); const root2 = Math.sqrt(1 - e);
  /* x, y, z of eccentric anomaly E, into slot k of `pts`. */
  const at = (E, pts, k) => {
    const nu = 2 * Math.atan2(root1 * Math.sin(E / 2), root2 * Math.cos(E / 2));
    const r = p / (1 + ecc * Math.cos(nu));
    const u = arg + nu;
    const cu = Math.cos(u); const su = Math.sin(u);
    /* The scene's ecliptic is x-z with y up (positionFromOrbit). */
    pts[k] = r * (cn * cu - sn * su * ci);
    pts[k + 1] = r * (su * si);
    pts[k + 2] = r * (sn * cu + cn * su * ci);
  };
  /* A first spacing from the size of the orbit: a chord of dE on an
   * ellipse of semi-major axis a misses by about a dE^2 / 8. */
  const a = p / (1 - ecc * ecc);
  const base = Math.min(512, Math.max(32, Math.ceil((Math.PI * 2) / Math.sqrt((8 * tolerance) / a))));
  /* A small stack of points for the halving (depth 6 at most). */
  const pts = new Float64Array(3 * 16);
  const refine = (E0, i0, E1, i1, depth, free) => {
    const Em = (E0 + E1) * 0.5;
    at(Em, pts, free);
    const dx = pts[free] - (pts[i0] + pts[i1]) * 0.5;
    const dy = pts[free + 1] - (pts[i0 + 1] + pts[i1 + 1]) * 0.5;
    const dz = pts[free + 2] - (pts[i0 + 2] + pts[i1 + 2]) * 0.5;
    if (depth < 6 && dx * dx + dy * dy + dz * dz > tolerance * tolerance) {
      refine(E0, i0, Em, free, depth + 1, free + 3);
      refine(Em, free, E1, i1, depth + 1, free + 3);
      return;
    }
    sink(pts[i0], pts[i0 + 1], pts[i0 + 2], pts[i1], pts[i1 + 1], pts[i1 + 2]);
  };
  at(0, pts, 0);
  for (let k = 1; k <= base; k += 1) {
    const E1 = (k / base) * Math.PI * 2;
    at(k === base ? 0 : E1, pts, 3);
    refine(((k - 1) / base) * Math.PI * 2, 0, E1, 3, 0, 6);
    pts[0] = pts[3]; pts[1] = pts[4]; pts[2] = pts[5];
  }
}

/**
 * `auToScene` is smallBodies.js's distance compression; each path is the
 * same drawn conic a named body on that orbit rides (`sceneConic` there:
 * the one Sun-focused ellipse through the drawn perihelion and aphelion),
 * turned by the real node, inclination and argument of perihelion.
 */
export function createFamilyOrbits({ auToScene }) {
  const group = new THREE.Group();
  group.name = "Near-Earth family orbits";
  const layers = {};
  Object.values(NEAR_EARTH_FAMILIES).forEach((family) => {
    const count = family.rows.length;
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.LineBasicMaterial({
      color: family.colour,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.name = `${family.label} orbits`;
    lines.visible = false;
    lines.raycast = () => {};
    lines.renderOrder = -13;
    group.add(lines);
    /* Peak opacity per family: the crowded families fainter, so 427 Apollo
     * paths read as a sheaf rather than a solid disc (chosen by eye). */
    const peak = count > 200 ? 0.11 : 0.42;
    const layer = { family, lines, material, fade: 0, peak, count, built: false };
    layer.build = () => {
      if (layer.built) return;
      layer.built = true;
      let out = new Float32Array(count * 160 * 6);
      let n = 0;
      const push = (x0, y0, z0, x1, y1, z1) => {
        if (n + 6 > out.length) {
          const grown = new Float32Array(out.length * 2);
          grown.set(out);
          out = grown;
        }
        out[n] = x0; out[n + 1] = y0; out[n + 2] = z0;
        out[n + 3] = x1; out[n + 4] = y1; out[n + 5] = z1;
        n += 6;
      };
      family.rows.forEach((row) => {
        const [aAU, eRaw, iDeg, nodeDeg, argDeg] = row;
        /* As nearEarthSwarm.js `ingest`. */
        const e = Math.min(0.995, eRaw);
        const q = auToScene(aAU * (1 - e));
        const Q = auToScene(aAU * (1 + e));
        sampleOrbitPath({
          p: (2 * q * Q) / (q + Q),
          ecc: (Q - q) / (Q + q),
          e,
          node: nodeDeg * DEG,
          inc: iDeg * DEG,
          arg: argDeg * DEG,
        }, push);
      });
      geometry.setAttribute("position", new THREE.BufferAttribute(out.slice(0, n), 3));
      geometry.computeBoundingSphere();
      layer.segments = n / 6;
    };
    layers[family.key] = layer;
    /* Built now, while the scene loads, as the 72-segment paths were: about
     * 80 ms for all four, rather than a hitch the first time one lights. */
    layer.build();
  });
  return { group, layers, hovered: null, pinned: null };
}

/**
 * Called every frame from main.js with the hovered object and the focused
 * body. A family lights while one of its members is hovered or focused, or
 * while the board has pinned it.
 */
export function updateFamilyOrbits(orbits, hovered = null, focused = null, dt = 1 / 60, camera = null, closeTo = focused) {
  if (!orbits) return;
  const lit = familyFromObject(hovered) ?? familyFromObject(focused) ?? orbits.pinned;
  /* Round 39: with a stamped rock in hand, its own path is drawn bright
   * (nearEarthSwarm.js `drawOrbits`) and the family's sheaf steps back to
   * 35%, so the rock's path is the one that reads. */
  const inHand = Boolean(hovered?.userData?.isSwarmRock || focused?.userData?.isSwarmRock);
  /*
   * Round 39, third pass: and close to a focused member it goes. The sheaf
   * is true to 0.25 scene units (`PATH_TOLERANCE`), under a pixel from 175
   * units away (0.25 x ~700 px focal length); nearer than that its lines
   * would run visibly beside the rocks. The focused rock's own path -- a
   * swarm rock's from `drawOrbits`, a named body's its 2,048-segment guide
   * -- passes through it. Full sheaf from 240 units, none inside 120.
   */
  let near = 1;
  if (camera && closeTo && familyFromObject(closeTo)) {
    closeTo.getWorldPosition(_focus);
    near = THREE.MathUtils.smoothstep(_focus.distanceTo(camera.position), 120, 240);
  }
  const layers = Object.values(orbits.layers);
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const target = layer.family.key === lit ? 1 : 0;
    if (target === 0 && layer.fade === 0 && !layer.lines.visible) continue;
    if (target) layer.build();
    layer.fade += (target - layer.fade) * Math.min(1, dt * 5);
    if (Math.abs(layer.fade - target) < 0.004) layer.fade = target;
    layer.material.opacity = layer.peak * layer.fade * (inHand ? 0.35 : 1) * near;
    layer.lines.visible = layer.fade > 0.003 && layer.material.opacity > 0.0005;
  }
}
const _focus = new THREE.Vector3();

/** The board's "show their paths": pin one family, or null to clear. */
export function pinFamilyOrbits(orbits, key = null) {
  if (!orbits) return;
  orbits.pinned = key && orbits.layers[key] ? key : null;
}

function familyFromObject(object) {
  let node = object;
  for (let depth = 0; node && depth < 6; depth += 1) {
    const family = node.userData?.nearEarthFamily;
    if (family) return family;
    node = node.parent;
  }
  return null;
}

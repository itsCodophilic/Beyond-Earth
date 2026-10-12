import * as THREE from "three";
import {
  ATIRA_ELEMENTS,
  ATEN_ELEMENTS,
  APOLLO_ELEMENTS,
  AMOR_ELEMENTS,
} from "./populationCatalogue.js";

/**
 * Every known near-Earth asteroid, as a rock that appears when you are near.
 *
 * Round 39 (the owner: "the Atens consist of 3.4k bodies, the Apollos 24k
 * ... can we draw each of their respected bodies?"). 42,712 rocks on the
 * JPL list of 10 October 2026 cannot each be a hand-built body -- the whole
 * scene draws 196 of those. They are drawn here as *stamps*: a handful of
 * real rock shapes, made once, each stamped many times with its own size,
 * turn and colour.
 *
 * ## Only near the camera, never as dots
 *
 * Seen from afar a kilometre rock is far below a pixel, and drawing it
 * anyway is what made the families "sparkling stars" in round 37. So a
 * rock is drawn only while it would be at least ~3 px across, growing in
 * from nothing as the camera approaches, and every frame at most `CAP` of
 * them -- the largest on screen -- are drawn at all. The rest cost one
 * distance test.
 * That is the owner's brief from the families round: one or two rocks in
 * view, empty space around them.
 *
 * ## Where each one is
 *
 * Each rock rides the same drawn conic every small body here rides
 * (`sceneConic` in smallBodies.js: the Sun-focused ellipse through its drawn
 * perihelion and aphelion), at its real true anomaly, its mean anomaly
 * propagated from its own JPL epoch to the scene's date and then advanced
 * at the scene's compressed rate for its period (`visualMeanMotion`) -- the
 * rule the population clouds and named bodies follow, so a stamped rock and
 * a named one on the same orbit are at the same place. Positions of all
 * rocks are refreshed a 48th at a time (enough to choose which are near);
 * the ones drawn are placed exactly every frame.
 *
 * ## Hover, click, card
 *
 * The `PROXIES` nearest drawn rocks each carry an invisible hit target, a
 * group like any small body's, with a card built from the JPL row: name,
 * family, size (measured where JPL has one, else from brightness at an
 * albedo assumed for its type), closest approach to Earth's orbit (MOID),
 * rotation if measured. Focusing one holds its target to it.
 *
 * ## The data
 *
 * `public/assets/data/near-earth-asteroids.json`, built by
 * tools/neo-catalogue/build-neo-catalogue.mjs from the JPL SBDB query
 * (classes IEO, ATE, APO, AMO) the owner downloaded on 10 October 2026 --
 * this session's network cannot reach JPL. Loaded once, after the scene has
 * started. Until it exists the 891 kilometre-class orbits already in
 * populationCatalogue.js are used, unnamed.
 */

const CLASSES = ["atira", "aten", "apollo", "amor"];
const CLASS_LABEL = { atira: "Atira", aten: "Aten", apollo: "Apollo", amor: "Amor" };
const CLASS_RANGE = {
  atira: "wholly inside Earth's orbit",
  aten: "crosses Earth's orbit from inside",
  apollo: "crosses Earth's orbit from outside",
  amor: "comes near Earth's orbit, never crosses it",
};
const DEG = Math.PI / 180;
/* The most drawn at once, and how many of them carry a hit target. */
const CAP = 240;
const PROXIES = 16;
/* Round 39, second pass: hit targets reserved for named rocks -- the
 * family "spotlight" (its largest, labelled) and a rock flown to from the
 * board. */
const SPOT = 20;
const RESERVED = SPOT + 2;
/* Drawn from 1.5 px radius (3 px across), full size from 4 px: below
 * that a rock is a dot, and dots are what this replaces. */
const APPEAR_PX = 1.5;
const FULL_PX = 4;
/* Positions of all rocks are refreshed a 48th at a time (~800 a frame),
 * with a coarser Kepler solve -- they only choose which rocks are near;
 * the drawn ones are solved fully. */
const REFRESH_SLICES = 48;
const REFRESH_PASSES = 4;

/*
 * Types, and how a rock with none on record is given one. Albedo first
 * where JPL has it (C dark, S middling, E/X bright); otherwise the measured
 * near-Earth mix, roughly S/Q 60%, C 25%, X 10%, other 5% (Binzel et al.
 * 2019, Icarus 324, 41 -- rounded). Colours as reflectance ratios, the
 * scene's class colours (catalogueHelpers.js CLASS_CHROMA, mainBeltCatalogue
 * CLASS_CHROMA), and an albedo for the size estimate where none is measured
 * (typical class values: C 0.06, S 0.25, X 0.30, Q 0.30, D 0.05).
 */
const TYPES = {
  C: { chroma: [1.03, 1.0, 0.95], albedo: 0.06, shape: [0, 4], words: "C-type: dark, carbon-rich" },
  S: { chroma: [1.12, 0.99, 0.82], albedo: 0.25, shape: [1, 2, 3], words: "S-type: stony" },
  Q: { chroma: [1.09, 0.99, 0.85], albedo: 0.30, shape: [1, 2], words: "Q-type: fresh stony rock" },
  X: { chroma: [1.05, 0.99, 0.92], albedo: 0.30, shape: [5], words: "X-type: metal or enstatite" },
  D: { chroma: [1.14, 0.98, 0.83], albedo: 0.05, shape: [0, 4], words: "D-type: very dark and red" },
  V: { chroma: [1.08, 1.0, 0.86], albedo: 0.35, shape: [1, 3], words: "V-type: basalt, like Vesta" },
};
const typeOf = (spec) => {
  const s = String(spec ?? "").trim();
  if (!s) return null;
  if (/^[CB]/.test(s) || /^F/.test(s) || /^G/.test(s)) return "C";
  if (/^Q/.test(s)) return "Q";
  if (/^[XMEP]/.test(s)) return "X";
  if (/^[DT]/.test(s)) return "D";
  if (/^[VAOR]/.test(s)) return "V";
  return "S";
};

/* A stable pseudo-random number per rock. */
const hash = (i, k = 1) => {
  const x = Math.sin((i + 1) * 12.9898 * k + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * How close a path comes to Earth's orbit (JPL's MOID, AU), in words. 1 AU
 * is 149.6 million km, or 389 Moon-distances (149.6 million / 384,400 km);
 * under one Moon-distance it is kilometres, to the nearest thousand (the
 * catalogue keeps MOID to 0.000001 AU, 150 km).
 */
export function describeMoid(moid) {
  /* null >= 0 is true in JavaScript, so null is tested first. */
  if (moid === null || moid === undefined || !(moid >= 0)) return "—";
  const moons = moid * 389;
  if (moons < 1) {
    const km = moid * 149.6e6;
    return km < 1000 ? "under 1,000 km" : `${(Math.round(km / 1000) * 1000).toLocaleString("en-US")} km`;
  }
  if (moid < 0.05) return `${moons.toFixed(moons < 10 ? 1 : 0)} Moon-distances`;
  return `${moid.toFixed(3)} AU`;
}

export function createNearEarthSwarm({
  auToScene,
  visualMeanMotion,
  visualPeriodSeconds,
  visualRadiusFor,
  referenceJD,
  albedoScale,
  buildShape,
  makeMaterial,
  attachMetadata,
  markPointerProxy,
  exclude = new Set(),
  dataUrl,
  /* Round 40: the same machinery draws the Centaurs (centaurSwarm.js
   * `CENTAUR_PROFILE`): a profile replaces the near-Earth classing, colours,
   * card, names and fallback table. Without one, the near-Earth asteroids. */
  profile = null,
  /* Round 40: scene radius -> brightness multiplier for a rock there
   * (the Centaurs, lit for their own distance). None: as drawn. */
  solarScale = null,
}) {
  const kind = profile ?? {};
  const group = new THREE.Group();
  group.name = kind.groupName ?? "Near-Earth asteroid swarm";

  /*
   * Six rock shapes (stamps), each from the scene's own sculptor
   * (smallBodyShapes.js) at low resolution -- 30 x 20 segments, ~1,100
   * triangles -- with the surface of its type in a shared map:
   *   0 rubble pile (C)     1 potato (S)        2 spinning top (S/Q)
   *   3 two lobes (S)       4 cratered lump (C/D) 5 dense, scooped (X)
   * Normalised to a half-extent of 1; each instance is scaled to its size.
   */
  const SHAPES = [
    { lobes: [{ c: [0, 0, 0], r: [1.15, 0.92, 1.0] }], neck: 1, relief: 0.05, grain: 0.03, craterCount: 10, craterMin: 0.06, craterMax: 0.16, craterDepth: 0.02, boulders: 40, boulderSize: 0.07, seed: 901, map: "ra-shalom" },
    { lobes: [{ c: [0, 0, 0], r: [1.5, 0.8, 1.0] }], neck: 1, relief: 0.04, grain: 0.015, craterCount: 40, craterMin: 0.04, craterMax: 0.22, craterDepth: 0.035, boulders: 8, boulderSize: 0.035, seed: 902, map: "toro" },
    { lobes: [{ c: [0, 0, 0], r: [1.0, 0.86, 1.0] }], neck: 1, ridge: 0.08, relief: 0.035, grain: 0.015, craterCount: 22, craterMin: 0.04, craterMax: 0.18, craterDepth: 0.03, boulders: 14, boulderSize: 0.04, seed: 903, map: "1989-ja" },
    { lobes: [{ c: [-0.55, 0, 0], r: [0.62, 0.5, 0.55] }, { c: [0.6, 0.02, 0], r: [0.52, 0.44, 0.48] }], neck: 1, blend: "smooth", relief: 0.04, grain: 0.016, craterCount: 26, craterMin: 0.04, craterMax: 0.2, craterDepth: 0.03, boulders: 10, boulderSize: 0.035, seed: 904, map: "castalia" },
    { lobes: [{ c: [0, 0, 0], r: [1.25, 0.95, 1.1] }], neck: 1, relief: 0.05, grain: 0.02, craterCount: 60, craterMin: 0.03, craterMax: 0.26, craterDepth: 0.04, boulders: 12, boulderSize: 0.04, seed: 905, map: "ganymed" },
    { lobes: [{ c: [-0.4, 0, 0], r: [0.75, 0.6, 0.68] }, { c: [0.45, 0.03, 0], r: [0.65, 0.55, 0.6] }], neck: 1, blend: "smooth", relief: 0.05, grain: 0.022, craterCount: 14, craterMin: 0.05, craterMax: 0.24, craterDepth: 0.016, boulders: 0, seed: 906, map: "1986-da", metal: true },
  ];
  const meshes = SHAPES.map((shape, index) => {
    const geometry = buildShape(shape);
    const material = makeMaterial(shape, index);
    const mesh = new THREE.InstancedMesh(geometry, material, CAP);
    mesh.name = `${kind.stampName ?? "Near-Earth rock stamp"} ${index + 1}`;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    /* Picking goes through the hit targets below, never these. */
    mesh.raycast = () => {};
    group.add(mesh);
    return mesh;
  });

  /* Hit targets, rebound to the nearest drawn rocks. */
  const proxies = [];
  for (let k = 0; k < PROXIES + RESERVED; k += 1) {
    const target = new THREE.Group();
    target.name = kind.targetName ?? "Near-Earth asteroid";
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
    );
    hit.name = `${kind.targetName ?? "Near-Earth asteroid"} interaction target`;
    markPointerProxy(hit);
    target.add(hit);
    target.visible = false;
    group.add(target);
    /* Unbound targets answer no ray (see `bindRaycast`). */
    hit.raycast = () => {};
    proxies.push({ target, hit, row: -1, pin: null, pinnedAt: 0, label: null });
  }

  const swarm = {
    group,
    meshes,
    proxies,
    targets: proxies.map((p) => p.target),
    rows: 0,
    loaded: false,
    source: "none",
    clock: 0,
    tick: 0,
    chunk: 0,
    drawn: 0,
    /* What the board's rows and `pinRockByName` use for "fly to row". */
    keyPrefix: kind.keyPrefix ?? "neo:",
  };

  /* The board's near-Earth lists read this one; a profiled swarm is its
   * own. */
  if (!profile) ACTIVE.swarm = swarm;

  /*
   * Round 39, second pass (the owner: "when clicked the orbital paths are
   * not attached, they seem detached"). The family's paths are its 891
   * kilometre-class members; a smaller rock is on none of them, so it
   * looked adrift. Now every rock in hand -- focused, hovered, flown to,
   * or named in a spotlight -- shows its own path, in its family's colour,
   * on the same drawn conic it rides (`place`). One LineSegments, rebuilt
   * only when that set of rocks changes.
   */
  /*
   * Round 39, third pass (the owner: "the orbital paths are still
   * misaligned"). The first version was 160 chords evenly spaced in true
   * anomaly. A chord cuts inside the curve -- by 0.03-0.1 scene units on
   * these orbits, one to four times a rock's drawn radius -- so the line ran
   * beside the rock, not through it. Now each path is built *from the rock*:
   * one vertex exactly where the rock is drawn, the next ones half a rock
   * radius away and growing 1.1x a step out to 0.05 rad of eccentric
   * anomaly (CLOSE steps), then even steps of ~0.02 rad round the far side
   * (FAR steps; a chord there misses the curve by a dE^2 / 8, about 0.02
   * units on the largest of these orbits).
   *
   * The short steps matter as much as the vertex on the rock. The camera
   * follows a rock from close behind, nearly on its path; one long chord
   * from behind the camera through the rock is dropped by the GPU's
   * clipping (measured headless on Zeus: the path stopped 3 units short of
   * the rock), so the path near the rock is made of pieces shorter than the
   * camera's distance. It is rebuilt once the rock has moved two of its
   * radii along it (or a different set of rocks is in hand).
   */
  const CLOSE = 64;
  const FAR = 160;
  const ORBIT_SEGMENTS = 2 * (CLOSE + FAR);
  const CLOSE_E = 0.05;
  const ORBIT_MAX = PROXIES + RESERVED;
  const orbitPositions = new Float32Array(ORBIT_MAX * ORBIT_SEGMENTS * 2 * 3);
  const orbitColours = new Float32Array(ORBIT_MAX * ORBIT_SEGMENTS * 2 * 3);
  const orbitGeometry = new THREE.BufferGeometry();
  orbitGeometry.setAttribute("position", new THREE.BufferAttribute(orbitPositions, 3).setUsage(THREE.DynamicDrawUsage));
  orbitGeometry.setAttribute("color", new THREE.BufferAttribute(orbitColours, 3).setUsage(THREE.DynamicDrawUsage));
  orbitGeometry.setDrawRange(0, 0);
  const orbitLines = new THREE.LineSegments(orbitGeometry, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending,
  }));
  orbitLines.name = "Near-Earth rocks in hand: their own orbits";
  orbitLines.frustumCulled = false;
  orbitLines.raycast = () => {};
  orbitLines.visible = false;
  group.add(orbitLines);
  swarm.orbitKey = "";
  swarm.orbitBuiltE = new Map();
  /* Family colours as familyOrbits.js has them. */
  const FAMILY_RGB = [[1, 0.749, 0.525], [1, 0.878, 0.541], [0.624, 0.941, 0.722], [0.541, 0.839, 1]];
  swarm.drawOrbits = (entries) => {
    const key = entries.map((e) => `${e.row}:${e.weight}`).join(",");
    if (key === swarm.orbitKey) {
      /* Same rocks: rebuild only if one has left its close spacing. */
      let moved = false;
      for (let k = 0; k < entries.length && !moved; k += 1) {
        const row = entries[k].row;
        const d = Math.abs(anomaly(row) - swarm.orbitBuiltE.get(row));
        /* Two radii along the path: ds <= a dE, so dE > 2 VR / a is at
         * most two radii moved. */
        const a = P[row] / (1 - EC[row] * EC[row]);
        if (!(Math.min(d, Math.PI * 2 - d) * a < 2 * VR[row])) moved = true;
      }
      if (!moved) return;
    }
    swarm.orbitKey = key;
    swarm.orbitBuiltE.clear();
    let o = 0;
    const point = (row, E, out) => {
      const e = ER[row];
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      const r = P[row] / (1 + EC[row] * Math.cos(nu));
      const u = ARG[row] + nu;
      const cu = Math.cos(u); const su = Math.sin(u);
      const cn = Math.cos(NODE[row]); const sn = Math.sin(NODE[row]);
      const ci = Math.cos(INC[row]); const si = Math.sin(INC[row]);
      out[0] = r * (cn * cu - sn * su * ci);
      out[1] = r * (su * si);
      out[2] = r * (sn * cu + cn * su * ci);
    };
    const a = [0, 0, 0];
    const b = [0, 0, 0];
    const side = new Float64Array(CLOSE + FAR);
    entries.slice(0, ORBIT_MAX).forEach(({ row, weight }) => {
      const rgb = kind.orbitRGB ? kind.orbitRGB(row, GROUP) : (FAMILY_RGB[meta.cls[row]] ?? FAMILY_RGB[2]);
      /* The rock in hand: its family colour lifted towards white. */
      const lift = weight >= 1 ? 0.45 : 0;
      const cr = (rgb[0] + (1 - rgb[0]) * lift) * weight;
      const cg = (rgb[1] + (1 - rgb[1]) * lift) * weight;
      const cb = (rgb[2] + (1 - rgb[2]) * lift) * weight;
      const E0 = anomaly(row);
      swarm.orbitBuiltE.set(row, E0);
      /* Offsets from the rock, one side: half a radius, x1.1-ish a step to
       * CLOSE_E, then even steps to half way round. */
      const semi = P[row] / (1 - EC[row] * EC[row]);
      const first = Math.min(CLOSE_E / 4, (0.5 * VR[row]) / semi);
      const grow = (CLOSE_E / first) ** (1 / (CLOSE - 1));
      for (let k = 0; k < CLOSE; k += 1) side[k] = first * grow ** k;
      for (let k = 1; k <= FAR; k += 1) side[CLOSE - 1 + k] = CLOSE_E + ((Math.PI - CLOSE_E) * k) / FAR;
      /* -pi ... -first, 0 (the rock), first ... pi. */
      const at = (k) => (k < CLOSE + FAR ? -side[CLOSE + FAR - 1 - k] : k === CLOSE + FAR ? 0 : side[k - CLOSE - FAR - 1]);
      point(row, E0 + at(0), a);
      for (let k = 1; k <= ORBIT_SEGMENTS; k += 1) {
        point(row, E0 + at(k), b);
        orbitPositions.set(a, o);
        orbitPositions.set(b, o + 3);
        orbitColours[o] = cr; orbitColours[o + 1] = cg; orbitColours[o + 2] = cb;
        orbitColours[o + 3] = cr; orbitColours[o + 4] = cg; orbitColours[o + 5] = cb;
        o += 6;
        a[0] = b[0]; a[1] = b[1]; a[2] = b[2];
      }
    });
    orbitGeometry.setDrawRange(0, o / 3);
    orbitGeometry.attributes.position.needsUpdate = true;
    orbitGeometry.attributes.color.needsUpdate = true;
    orbitLines.visible = o > 0;
  };

  /* Columns, filled by `ingest`. */
  let N = 0;
  let P;     // scene semi-latus rectum
  let EC;    // scene eccentricity
  let ER;    // real eccentricity (for the true anomaly)
  let M0;    // mean anomaly at the scene's reference date (rad)
  let RATE;  // scene rate (rad per clock unit)
  let INC; let NODE; let ARG;
  let VR;    // drawn radius (scene units)
  let SPIN;  // rad per second
  let POS;   // refreshed positions
  let TYPE;  // index into TYPE_KEYS
  let SHAPE; // stamp index
  let COLOUR;
  let ALB;   // albedo the size and brightness are worked from
  let GROUP; // a profile's own grouping (the Centaurs: 0 grey, 1 red)
  let meta;  // per-row card data, for `describe`
  const TYPE_KEYS = Object.keys(TYPES);

  function ingest(table, source) {
    N = table.a.length;
    P = new Float32Array(N); EC = new Float32Array(N); ER = new Float32Array(N);
    M0 = new Float32Array(N); RATE = new Float32Array(N);
    INC = new Float32Array(N); NODE = new Float32Array(N); ARG = new Float32Array(N);
    VR = new Float32Array(N); SPIN = new Float32Array(N); POS = new Float32Array(N * 3);
    TYPE = new Uint8Array(N); SHAPE = new Uint8Array(N); COLOUR = new Float32Array(N * 3);
    ALB = new Float32Array(N); GROUP = new Uint8Array(N);
    meta = table;
    for (let i = 0; i < N; i += 1) {
      const a = table.a[i];
      const e = Math.min(0.995, table.e[i]);
      const q = auToScene(a * (1 - e));
      const Q = auToScene(a * (1 + e));
      P[i] = (2 * q * Q) / (q + Q);
      EC[i] = (Q - q) / (Q + q);
      ER[i] = e;
      const n = 0.9856076686 / a ** 1.5;
      /* 0 = the usual epoch (tools/neo-catalogue). */
      const epoch = table.epoch?.[i] || 2461200.5;
      M0[i] = ((((table.ma[i] + n * (referenceJD - epoch)) % 360) + 360) % 360) * DEG;
      RATE[i] = visualMeanMotion(360 / n);
      INC[i] = table.i[i] * DEG; NODE[i] = table.om[i] * DEG; ARG[i] = table.w[i] * DEG;
      if (kind.classify) {
        /* A profile's own: its group, shape, colour (a linear reflectance
         * triple) and albedo. */
        const c = kind.classify(i, table, hash);
        GROUP[i] = c.group;
        SHAPE[i] = c.shape;
        ALB[i] = c.albedo;
        VR[i] = visualRadiusFor(diameterOf(i));
        const rotK = table.rot?.[i] > 0 ? table.rot[i] : c.rotation ?? 3 + hash(i, 11) * 17;
        SPIN[i] = ((Math.PI * 2) / visualPeriodSeconds(rotK)) * (hash(i, 13) < 0.5 ? 1 : -1);
        const vK = albedoScale(c.albedo) * (0.94 + hash(i, 17) * 0.12);
        COLOUR[i * 3] = c.chroma[0] * vK; COLOUR[i * 3 + 1] = c.chroma[1] * vK; COLOUR[i * 3 + 2] = c.chroma[2] * vK;
        continue;
      }
      const typeKey = typeOf(table.spec?.[i]) ?? (() => {
        const alb = table.alb?.[i];
        if (alb > 0) return alb < 0.1 ? "C" : alb > 0.35 ? "X" : "S";
        const r = hash(i, 3);
        return r < 0.6 ? "S" : r < 0.85 ? "C" : r < 0.95 ? "X" : "Q";
      })();
      const t = TYPES[typeKey];
      TYPE[i] = TYPE_KEYS.indexOf(typeKey);
      SHAPE[i] = t.shape[Math.floor(hash(i, 5) * t.shape.length)];
      /* Family leanings from the owner's brief: Amors big and cratered,
       * Apollos varied, Atens small, Atiras baked (the cratered lump). */
      const cls = CLASSES[table.cls[i]];
      if (cls === "amor" && hash(i, 7) < 0.35) SHAPE[i] = 4;
      if (cls === "atira") SHAPE[i] = 4;
      ALB[i] = table.alb?.[i] > 0 ? table.alb[i] : t.albedo;
      const D = diameterOf(i);
      VR[i] = visualRadiusFor(D);
      const rot = table.rot?.[i] > 0 ? table.rot[i] : 3 + hash(i, 11) * 17;
      SPIN[i] = ((Math.PI * 2) / visualPeriodSeconds(rot)) * (hash(i, 13) < 0.5 ? 1 : -1);
      /* Colour: the type's, scaled for the rock's albedo against the
       * stamps' 0.15 (measured where JPL has it, else the type's), with a
       * +/-6% spread so no two match. */
      const albedo = table.alb?.[i] > 0 ? table.alb[i] : t.albedo;
      const v = albedoScale(albedo) * (0.94 + hash(i, 17) * 0.12);
      COLOUR[i * 3] = t.chroma[0] * v; COLOUR[i * 3 + 1] = t.chroma[1] * v; COLOUR[i * 3 + 2] = t.chroma[2] * v;
    }
    /* The farthest any rock gets from the Sun (scene units), and the
     * largest drawn radius, for skipping everything when the camera is
     * far outside the region. */
    let far = 0;
    let big = 0;
    for (let i = 0; i < N; i += 1) {
      far = Math.max(far, P[i] / (1 - EC[i]));
      big = Math.max(big, VR[i]);
    }
    swarm.farthest = far;
    swarm.largest = big;
    swarm.rows = N;
    swarm.byName = new Map();
    swarm.byKey = new Map();
    for (let i = 0; i < N; i += 1) {
      swarm.byName.set(String(meta.name[i]).trim(), i);
      swarm.byKey.set(String(meta.pdes?.[i] ?? meta.name[i]).trim(), i);
    }
    swarm.lists = {};
    swarm.loaded = true;
    swarm.source = source;
    for (let i = 0; i < N; i += 1) place(i, POS, i * 3);
  }

  function diameterOf(i) {
    const D = meta.D?.[i];
    if (D > 0) return D;
    const alb = ALB[i] > 0 ? ALB[i] : TYPES[TYPE_KEYS[TYPE[i]]].albedo;
    /* No H on record (-1, a few short arcs): drawn at H 25, ~30 m (a
     * profile may say otherwise). */
    const H = meta.H[i] >= 0 ? meta.H[i] : kind.missingH ?? 25;
    return (1329 / Math.sqrt(alb)) * 10 ** (-H / 5);
  }

  /* Kepler: the eccentric anomaly of row i now, from the real e. */
  function anomaly(i, passes = 8) {
    const M = M0[i] + RATE[i] * swarm.clock;
    const e = ER[i];
    const m = ((M % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let E = m + 0.85 * e * Math.sign(Math.sin(m));
    for (let k = 0; k < passes; k += 1) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    return E;
  }

  /* As smallBodies.js `positionFromOrbit`: true anomaly from the real e,
   * radius on the drawn conic, the real angles; scene y is up. */
  function place(i, out, o, passes = 8) {
    const E = anomaly(i, passes);
    const e = ER[i];
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = P[i] / (1 + EC[i] * Math.cos(nu));
    const u = ARG[i] + nu;
    const cu = Math.cos(u); const su = Math.sin(u);
    const cn = Math.cos(NODE[i]); const sn = Math.sin(NODE[i]);
    const ci = Math.cos(INC[i]); const si = Math.sin(INC[i]);
    out[o] = r * (cn * cu - sn * su * ci);
    out[o + 1] = r * (su * si);
    out[o + 2] = r * (sn * cu + cn * su * ci);
  }

  /* The card for row i, in the shape `attachMetadata` reads. */
  function describe(i) {
    if (kind.describe) {
      return kind.describe(i, {
        meta, group: GROUP[i], albedo: ALB[i], diameterKm: diameterOf(i), rows: swarm.rows,
        currentAU: () => Math.hypot(...positionAU(i)),
      });
    }
    const cls = CLASSES[meta.cls[i]];
    const name = String(meta.name[i]).trim();
    const pdes = String(meta.pdes?.[i] ?? "").trim();
    const designation = /^\d+$/.test(pdes) ? `(${pdes}) ${name}` : name;
    const typeKey = TYPE_KEYS[TYPE[i]];
    const measuredType = typeOf(meta.spec?.[i]);
    const D = diameterOf(i);
    const measured = meta.D?.[i] > 0;
    const size = D < 1 ? `${Math.round(D * 1000)} m` : `${D < 10 ? D.toFixed(1) : Math.round(D)} km`;
    const a = meta.a[i]; const e = meta.e[i];
    const moid = meta.moid?.[i];
    const rot = meta.rot?.[i];
    return {
      name,
      record: {
        id: `neo-${i}`,
        name,
        designation,
        classification: `Near-Earth asteroid · ${CLASS_LABEL[cls]}`,
        detail: `${CLASS_LABEL[cls]} · ${CLASS_RANGE[cls]} | JPL Small-Body Database`,
        diameterKm: D,
        albedo: meta.alb?.[i] > 0 ? meta.alb[i] : TYPES[typeKey].albedo,
        shape: { seed: i },
        surfaceEvidence: "A point of light: its orbit and brightness are what is known. Drawn as one of six stamped rock shapes for its type",
        info: {
          population: `Near-Earth asteroids · ${CLASS_LABEL[cls]} group — ${CLASS_RANGE[cls]}, ${(a * (1 - e)).toFixed(2)}–${(a * (1 + e)).toFixed(2)} AU`,
          diameter: measured
            ? `${size} (JPL Small-Body Database)`
            : meta.H[i] >= 0
              ? `≈${size} — from its brightness (H ${meta.H[i]}) at an albedo assumed for its type; not measured`
              : "Not known — no brightness on record; drawn at about 30 m",
          rotationPeriod: rot > 0 ? `${rot} h (JPL SBDB / LCDB)` : "Not measured — drawn turning at a chosen rate",
          gravity: "Not measured",
          surfaceEvidence: measuredType ? `${TYPES[measuredType].words} (spectral type ${meta.spec[i]}, JPL SBDB)` : `Type not measured — drawn as ${TYPES[typeKey].words.split(":")[0]}`,
          roughness: "unknown",
          orbitalSpeed: `One orbit every ${(a ** 1.5).toFixed(2)} years`,
          description: `One of ${swarm.rows.toLocaleString("en-US")} near-Earth asteroids on JPL's list. Its orbit ${CLASS_RANGE[cls]}${moid >= 0 ? `; at its closest its path comes within ${describeMoid(moid)} of Earth's orbit` : ""}. Like almost all of them it has never been seen as more than a point of light, so its shape here is a stand-in; its orbit, brightness and family are real.`,
        },
      },
      elements: {
        aAU: a,
        e,
        hyperbolic: false,
        get currentAU() { return Math.hypot(...positionAU(i)); },
      },
      family: cls,
    };
  }
  /* The real heliocentric distance for the readout (AU), from the real a. */
  function positionAU(i) {
    const M = M0[i] + RATE[i] * swarm.clock;
    const e = ER[i];
    let E = M + 0.85 * e * Math.sign(Math.sin(M));
    for (let k = 0; k < 8; k += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const r = meta.a[i] * (1 - e * Math.cos(E));
    return [r, 0, 0];
  }

  /* The rows of one family, largest first, for the board's list. */
  swarm.listFamily = (family) => {
    if (!swarm.loaded) return [];
    if (swarm.lists[family]) return swarm.lists[family];
    /* "all": every family together (the board's table). */
    const c = CLASSES.indexOf(family);
    const rows = [];
    for (let i = 0; i < N; i += 1) if (family === "all" || meta.cls[i] === c) rows.push(i);
    rows.sort((x, y) => diameterOf(y) - diameterOf(x));
    swarm.lists[family] = rows.map((i) => {
      const a = meta.a[i];
      const e = meta.e[i];
      return {
        name: String(meta.name[i]).trim(),
        pdes: String(meta.pdes?.[i] ?? "").trim(),
        /* What the board flies to: "neo:<JPL designation>", which no other
         * body's name can be (`pinRockByName`). */
        key: `neo:${String(meta.pdes?.[i] ?? meta.name[i]).trim()}`,
        family: CLASSES[meta.cls[i]],
        sizeKm: diameterOf(i),
        measured: meta.D?.[i] > 0,
        type: typeOf(meta.spec?.[i]),
        /* Closest approach of its path to Earth's (AU; 0 = not given). */
        moid: meta.moid?.[i] >= 0 ? meta.moid[i] : null,
        rotH: meta.rot?.[i] > 0 ? meta.rot[i] : null,
        q: a * (1 - e),
        Q: a * (1 + e),
        years: a ** 1.5,
      };
    });
    return swarm.lists[family];
  };
  swarm.ingest = ingest;
  swarm.place = place;
  swarm.describe = describe;
  swarm.exclude = exclude;
  swarm.dataUrl = dataUrl;
  swarm.fallbackTable = kind.fallbackTable ?? null;
  swarm.solarScale = solarScale;
  swarm.state = () => ({ VR, SPIN, POS, SHAPE, COLOUR, N });
  swarm.attachMetadata = attachMetadata;
  return swarm;
}

/* The fallback table: the 891 kilometre-class orbits already in the
 * scene, unnamed, until the full list is in place. */
export function fallbackTable() {
  const rows = [
    ...ATIRA_ELEMENTS.map((r) => [0, r]),
    ...ATEN_ELEMENTS.map((r) => [1, r]),
    ...APOLLO_ELEMENTS.map((r) => [2, r]),
    ...AMOR_ELEMENTS.map((r) => [3, r]),
  ];
  const col = (k) => rows.map(([, r]) => r[k]);
  return {
    name: rows.map(([c], i) => `Kilometre-class ${CLASS_LABEL[CLASSES[c]]} #${i + 1}`),
    cls: rows.map(([c]) => c),
    a: col(0), e: col(1), i: col(2), om: col(3), w: col(4), ma: col(5), H: col(6),
    epoch: rows.map(([, r]) => r[7] ?? 2461200.5),
  };
}

/*
 * Load the full list (or fall back), then keep the nearest rocks drawn.
 */
export async function loadNearEarthSwarm(swarm) {
  if (!swarm || swarm.loading || swarm.loaded) return;
  swarm.loading = true;
  let table = null;
  try {
    if (typeof fetch === "function" && swarm.dataUrl) {
      const response = await fetch(swarm.dataUrl);
      if (response.ok) table = await response.json();
    }
  } catch {
    table = null;
  }
  if (table?.a?.length) {
    /* Leave out the rocks drawn as named bodies (Eros, Bennu, the families'
     * twenty...), so none is drawn twice. */
    const keep = [];
    for (let k = 0; k < table.a.length; k += 1) {
      if (!swarm.exclude.has(String(table.pdes?.[k] ?? "").trim())) keep.push(k);
    }
    const pick = (column) => (Array.isArray(column) ? keep.map((k) => column[k]) : column);
    const filtered = {};
    Object.keys(table).forEach((key) => { filtered[key] = Array.isArray(table[key]) && table[key].length === table.a.length ? pick(table[key]) : table[key]; });
    swarm.ingest(filtered, "jpl");
  } else {
    swarm.ingest(swarm.fallbackTable ? swarm.fallbackTable() : fallbackTable(), "fallback");
  }
  swarm.loading = false;
  /* A spotlight asked for before the list arrived. */
  if (swarm.spotlight) spotlightFamily(swarm, swarm.spotlight);
}

const NO_RAY = () => {};
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _colour = new THREE.Color();
const _local = new THREE.Vector3();

/* The swarm in use, for the board's lists (ui/explainers/nearEarth.js). */
const ACTIVE = { swarm: null };

/** A family's rocks, largest first: [{ name, sizeKm, measured, type }]. */
export function getNearEarthList(family) {
  return ACTIVE.swarm?.listFamily(family) ?? [];
}
export function nearEarthListReady() {
  return Boolean(ACTIVE.swarm?.loaded);
}

/*
 * Round 39, second pass (the owner: "I only see orbital paths ... can't
 * you add their names ... let the user directly go and fly towards the
 * rocks?").
 *
 * `spotlightFamily`: with a family's paths shown from the board, its SPOT
 * largest rocks are held drawn wherever the camera is and each carries its
 * name on screen, with a hit target sized to stay clickable from afar --
 * click a name to fly there. `null` lets them go.
 *
 * `pinRockByName`: the board's list flies to any rock by name. The rock is
 * held (drawn, with a hit target) and returned for the camera to focus; it
 * is let go once it is no longer focused.
 */
export function spotlightFamily(swarm, family = null) {
  if (!swarm) return;
  swarm.spotlight = family;
  swarm.proxies.forEach((p) => { if (p.pin === "spot") { p.pin = null; p.row = -1; } });
  if (!family || !swarm.loaded) return;
  const rows = swarm.listFamily(family).slice(0, SPOT).map((entry) => swarm.byKey.get(entry.key.slice(4)));
  const free = swarm.proxies.filter((p) => !p.pin);
  rows.forEach((row, k) => {
    const p = free[free.length - 1 - k];
    if (!p || row === undefined) return;
    bindProxy(swarm, p, row);
    p.pin = "spot";
  });
}

export function pinRockByName(swarm, name) {
  if (!swarm?.loaded) return null;
  const text = String(name).trim();
  const prefix = swarm.keyPrefix ?? "neo:";
  const row = text.startsWith(prefix) ? swarm.byKey.get(text.slice(prefix.length)) : swarm.byName.get(text);
  if (row === undefined) return null;
  const existing = swarm.proxies.find((p) => p.row === row);
  if (existing) {
    if (!existing.pin) existing.pin = "travel";
    existing.pinnedAt = performance.now();
    return existing.target;
  }
  const p = swarm.proxies.find((q) => !q.pin && q.row < 0) ?? swarm.proxies.find((q) => !q.pin);
  if (!p) return null;
  bindProxy(swarm, p, row);
  p.pin = "travel";
  p.pinnedAt = performance.now();
  /* Placed now, so the camera has somewhere to fly before the next frame. */
  const { POS } = swarm.state();
  swarm.place(row, POS, row * 3);
  p.target.position.set(POS[row * 3], POS[row * 3 + 1], POS[row * 3 + 2]);
  p.target.visible = true;
  p.hit.raycast = THREE.Mesh.prototype.raycast;
  return p.target;
}

function bindProxy(swarm, p, row) {
  const { VR } = swarm.state();
  p.row = row;
  const card = swarm.describe(row);
  p.target.name = card.name;
  swarm.attachMetadata(p.target, card.record, {
    visualRadius: VR[row],
    reach: VR[row] * 1.3,
    heliocentricAU: card.elements.currentAU,
    elements: card.elements,
  });
  p.target.userData.nearEarthFamily = card.family ?? null;
  p.target.userData.isSwarmRock = true;
  p.hit.scale.setScalar(Math.max(VR[row] * 2.4, 0.04));
  if (p.label) {
    p.label.removeFromParent();
    p.label.material.map?.dispose();
    p.label.material.dispose();
    p.label = null;
  }
}

/* A rock's name on screen: fixed size, never hidden by anything. */
function nameSprite(text) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const font = "600 26px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 44;
  canvas.width = width;
  canvas.height = 44;
  ctx.font = font;
  ctx.strokeStyle = "rgba(255, 224, 160, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(14, 22, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(3, 8, 14, 0.85)";
  ctx.textBaseline = "middle";
  ctx.strokeText(text, 32, 23);
  ctx.fillStyle = "rgba(255, 240, 214, 0.98)";
  ctx.fillText(text, 32, 23);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false,
  }));
  /* 0.024 of the view's height: about 15 px text at 800 px. The ring sits
   * on the rock (centre at the ring's middle). */
  const h = 0.024;
  sprite.scale.set((h * width) / 44, h, 1);
  sprite.center.set(14 / width, 0.5);
  sprite.renderOrder = 41;
  /* Round 39, fourth pass: the name is clickable too -- people reach for
   * the word, not the ring. A hit walks up to the rock's target. Only while
   * it is shown: a raycast does not look at `visible` by itself. */
  sprite.raycast = function raycastShown(raycaster, intersects) {
    if (!this.visible || !this.parent?.visible) return;
    THREE.Sprite.prototype.raycast.call(this, raycaster, intersects);
  };
  return sprite;
}

/**
 * Per frame. `motionScale` is the scene's orbital step (the clouds' clock);
 * `elapsed` real seconds for spin; `focused`/`hovered` keep a bound hit
 * target on its rock, as do the spotlight and a rock flown to by name.
 */
export function updateNearEarthSwarm(swarm, { motionScale = 0, elapsed = 0, camera = null, focused = null, hovered = null, clock = null } = {}) {
  if (!swarm?.loaded || !camera) return;
  /* Round 40: a swarm may run on another's clock -- the Centaur rocks on
   * the Centaur dots' (populationClouds.js), so a rock appears exactly
   * where its dot was. */
  if (clock !== null) swarm.clock = clock;
  else swarm.clock += motionScale;
  const { VR, SPIN, POS, SHAPE, COLOUR, N } = swarm.state();
  if (!N) return;

  /* A rock flown to by name is let go once it has been reached and left
   * (not focused), or after 20 s if it never was. */
  const now = performance.now();
  swarm.proxies.forEach((p) => {
    if (p.pin !== "travel") return;
    if (p.target === focused) { p.pinnedAt = now; return; }
    if (now - p.pinnedAt > 20000) p.pin = null;
  });
  const held = swarm.proxies.filter((p) => p.row >= 0 && (p.pin || p.target === focused || p.target === hovered));
  const bound = new Set(held.map((p) => p.row));
  /* Their own paths: full strength for the rock in hand, softer for a
   * spotlight's names. */
  swarm.drawOrbits(held
    .map((p) => ({ row: p.row, weight: p.target === focused || p.target === hovered || p.pin === "travel" ? 1 : 0.5 }))
    .sort((x, y) => x.row - y.row));

  /* The camera in the swarm's frame. */
  swarm.group.updateWorldMatrix(true, false);
  _cam.setFromMatrixPosition(camera.matrixWorld);
  swarm.group.worldToLocal(_cam);
  const height = typeof window !== "undefined" ? window.innerHeight : 800;
  const focal = camera.projectionMatrix.elements[5] * height * 0.5;
  const worldScale = swarm.group.matrixWorld.getMaxScaleOnAxis() || 1;
  const pxPerUnit = focal * worldScale;

  /* Out past every rock's reach (the outer Solar System, or the whole-
   * system view): nothing could be 3 px across, so nothing is tested --
   * only held rocks (a spotlight, a rock being flown to) are kept. */
  const maxReach = (swarm.largest * pxPerUnit) / APPEAR_PX;
  const farAway = _cam.length() - swarm.farthest > maxReach;
  if (farAway && !bound.size) {
    if (swarm.drawn || swarm.proxies.some((p) => p.row >= 0)) {
      swarm.meshes.forEach((mesh) => { mesh.count = 0; mesh.visible = false; });
      swarm.proxies.forEach((p) => { p.row = -1; p.target.visible = false; p.target.userData.spotlit = false; p.hit.raycast = NO_RAY; if (p.label) p.label.visible = false; });
      swarm.drawn = 0;
    }
    swarm.idle = true;
    return;
  }
  /* Coming back in: restart the sliced refresh from the top. */
  if (swarm.idle && !farAway) {
    swarm.idle = false;
    swarm.chunk = 0;
  }

  const near = swarm._near ?? (swarm._near = []);
  near.length = 0;
  if (!farAway) {
    /* A slice of the rocks re-placed each frame: all of them every 48. */
    const step = Math.ceil(N / REFRESH_SLICES);
    const from = swarm.chunk * step;
    const to = Math.min(N, from + step);
    for (let i = from; i < to; i += 1) swarm.place(i, POS, i * 3, REFRESH_PASSES);
    swarm.chunk = (swarm.chunk + 1) % REFRESH_SLICES;

    /* Candidates: anything that could be over APPEAR_PX, with room for
     * the staleness of the sliced refresh. Each rock's squared reach is
     * recomputed only when the zoom or the window changes. */
    if (!swarm._reach2 || swarm._reachPx !== pxPerUnit) {
      swarm._reach2 = swarm._reach2 ?? new Float32Array(N);
      const k = (pxPerUnit / APPEAR_PX) * 1.6;
      for (let i = 0; i < N; i += 1) swarm._reach2[i] = (VR[i] * k) ** 2;
      swarm._reachPx = pxPerUnit;
    }
    const REACH2 = swarm._reach2;
    const cx = _cam.x; const cy = _cam.y; const cz = _cam.z;
    for (let i = 0, o = 0; i < N; i += 1, o += 3) {
      const dx = POS[o] - cx;
      const dy = POS[o + 1] - cy;
      const dz = POS[o + 2] - cz;
      if (dx * dx + dy * dy + dz * dz < REACH2[i]) near.push(i);
    }
  }
  bound.forEach((i) => { if (!near.includes(i)) near.push(i); });

  /* Exact positions and on-screen size for the candidates; keep the
   * largest CAP. Held rocks are always kept. */
  const exact = swarm._exact ?? (swarm._exact = new Float32Array(3));
  const shown = swarm._shown ?? (swarm._shown = []);
  shown.length = 0;
  const distance = swarm._distance ?? (swarm._distance = new Map());
  distance.clear();
  for (let k = 0; k < near.length; k += 1) {
    const i = near[k];
    swarm.place(i, exact, 0);
    POS[i * 3] = exact[0]; POS[i * 3 + 1] = exact[1]; POS[i * 3 + 2] = exact[2];
    const d = Math.hypot(exact[0] - _cam.x, exact[1] - _cam.y, exact[2] - _cam.z);
    distance.set(i, d);
    const px = (VR[i] * pxPerUnit) / Math.max(1e-6, d);
    if (px >= APPEAR_PX || bound.has(i)) shown.push({ i, px: bound.has(i) ? Infinity : px });
  }
  shown.sort((p, q) => q.px - p.px);
  if (shown.length > CAP) shown.length = CAP;

  /* Write the stamps. */
  const counts = swarm.meshes.map(() => 0);
  for (let k = 0; k < shown.length; k += 1) {
    const { i, px } = shown[k];
    const s = SHAPE[i];
    const mesh = swarm.meshes[s];
    const slot = counts[s];
    if (slot >= mesh.instanceMatrix.count) continue;
    counts[s] += 1;
    const grow = bound.has(i) ? 1 : THREE.MathUtils.smoothstep(px, APPEAR_PX, FULL_PX);
    _pos.set(POS[i * 3], POS[i * 3 + 1], POS[i * 3 + 2]);
    _axis.set(Math.sin(i * 1.7) * 0.4, 1, Math.cos(i * 2.3) * 0.4).normalize();
    _quat.setFromAxisAngle(_axis, SPIN[i] * elapsed + i);
    _scale.setScalar(VR[i] * Math.max(0.001, grow));
    _matrix.compose(_pos, _quat, _scale);
    mesh.setMatrixAt(slot, _matrix);
    _colour.setRGB(COLOUR[i * 3], COLOUR[i * 3 + 1], COLOUR[i * 3 + 2]);
    if (swarm.solarScale) _colour.multiplyScalar(swarm.solarScale(_pos.length()));
    mesh.setColorAt(slot, _colour);
  }
  swarm.meshes.forEach((mesh, s) => {
    mesh.count = counts[s];
    mesh.visible = counts[s] > 0;
    if (counts[s]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  });
  swarm.drawn = shown.length;

  /*
   * Hit targets: the held ones stay; the free ones go to the PROXIES
   * largest drawn rocks, and stay on a rock while it is drawn, so cards
   * are rebuilt only when a rock comes into view.
   */
  const drawnRows = swarm._drawnRows ?? (swarm._drawnRows = new Set());
  drawnRows.clear();
  shown.forEach((entry) => drawnRows.add(entry.i));
  swarm.proxies.forEach((p) => {
    if (p.row < 0 || bound.has(p.row) || drawnRows.has(p.row)) return;
    p.row = -1;
  });
  const taken = new Set(swarm.proxies.filter((p) => p.row >= 0).map((p) => p.row));
  const free = swarm.proxies.filter((p) => p.row < 0 && !p.pin);
  let dealt = 0;
  for (let k = 0; k < shown.length && dealt < PROXIES && free.length; k += 1) {
    const i = shown[k].i;
    if (taken.has(i)) { dealt += 1; continue; }
    bindProxy(swarm, free.shift(), i);
    taken.add(i);
    dealt += 1;
  }

  swarm.proxies.forEach((p) => {
    p.target.visible = p.row >= 0;
    /* A named rock of a family view: main.js lets it win the pointer at
     * any size (its ring and name are what is on screen). */
    p.target.userData.spotlit = p.pin === "spot" && p.row >= 0;
    /* A raycast ignores `visible`: an unbound target, parked at the
     * Sun, must not answer one. */
    p.hit.raycast = p.row >= 0 ? THREE.Mesh.prototype.raycast : NO_RAY;
    if (p.row < 0) {
      if (p.label) p.label.visible = false;
      return;
    }
    p.target.position.set(POS[p.row * 3], POS[p.row * 3 + 1], POS[p.row * 3 + 2]);
    /* Named rocks (the spotlight): a label, and a hit target that stays
     * about 14 px wide however far away the rock is. */
    if (p.pin === "spot") {
      if (!p.label) {
        p.label = nameSprite(p.target.userData.name ?? p.target.name);
        if (p.label) p.target.add(p.label);
      }
      /* Round 39, fifth pass (the owner: "the circular yellow ring appears
       * on the body ... must get hidden, because now I am visiting that
       * body -- there are two names"). The rock being visited has its card;
       * its ring and name step aside until it is left. */
      if (p.label) p.label.visible = p.target !== focused;
      const d = distance.get(p.row) ?? 1;
      p.hit.scale.setScalar(Math.max(VR[p.row] * 2.4, (14 * d) / Math.max(1e-6, pxPerUnit)));
    } else if (p.label) {
      p.label.visible = false;
    }
  });
}

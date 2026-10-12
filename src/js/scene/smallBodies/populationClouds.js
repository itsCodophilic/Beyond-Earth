import * as THREE from "three";
import { centaurLook, centaurDiameterKm } from "./centaurSwarm.js";
import {
  CENTAUR_ELEMENTS,
  NEPTUNE_TROJANS,
  PLANET_TROJANS,
} from "./populationCatalogue.js";

/**
 * The crowds, flying: every catalogued Centaur, the Neptune Trojans and the
 * Neptune Trojans, each a point on its own real orbit. (Round 38: the
 * near-Earth families and the other planets' Trojans, which were here too,
 * are drawn as bodies now -- nearEarthFamilies.js, planetTrojans.js -- and
 * the families' orbits by familyOrbits.js.)
 *
 * Final round (the owner: "do all buddy everything at once"). The data is in
 * `populationCatalogue.js`; this draws it.
 *
 * ## Every point moves, and the CPU never touches one
 *
 * About 1,080 bodies (round 38; 1,990 before), each on its own Kepler ellipse. Placing them on the
 * CPU every frame would be two thousand Kepler solves in JavaScript; here
 * each vertex carries its orbit and the vertex shader solves Kepler's
 * equation itself (twelve Newton passes from Danby's start -- the same
 * iteration `smallBodies.js` uses, enough for e up to 0.97). The CPU adds
 * one number per frame, the shared clock, and that is all.
 *
 * Distances go through the scene's own compression exactly as an
 * individually drawn small body's do: each orbit's perihelion and aphelion
 * are put through `smallBodyAuToScene`, and the point rides the one ellipse
 * with the Sun at its focus that has those two ends (`sceneConic` in
 * smallBodies.js). So a cloud point and a named body on the same orbit land
 * on the same spot, and every point is between the planets it is really
 * between. Angles -- node, inclination, argument of perihelion, true anomaly
 * -- are the real ones.
 *
 * Timing: each body's mean anomaly starts where its elements put it on the
 * scene's reference date and advances at the scene's compressed rate for its
 * period (`visualMeanMotion`, period^-0.45 against Earth), the rate every
 * small body here uses -- so an Apollo laps the Sun far faster than a
 * Centaur, and nothing is frozen.
 *
 * The Neptune Trojans hang in Neptune's co-orbital frame (smallBodies.js
 * `CO_ORBITAL_PLANETS`) and keep exactly Neptune's model rate, so they stay
 * 60 degrees ahead of and behind the *drawn* Neptune, which is the one fact
 * about them -- the same arrangement as Hektor and Jupiter.
 *
 * Round 37 added the other planets' Trojans here, each in its own planet's
 * co-orbital frame; round 38 made them bodies (planetTrojans.js), on the
 * same frames.
 *
 * ## Cost
 *
 * One `Points` object (the Centaurs; round 38's second pass made Neptune's
 * Trojans bodies), one draw call, ~1,036 vertices, built once. A far fade hides each cloud
 * outright (no draw call) when its region shrinks below ~30 pixels.
 */

const DEG = Math.PI / 180;

/*
 * Round 40 (the owner: "in practice these icy bodies are not sparkling
 * blue"). The Centaurs were one icy blue-grey for the whole population. Each
 * dot now has its own Centaur's colour -- grey or red, the colour
 * bimodality -- from the rule its rock uses (centaurSwarm.js `centaurLook`),
 * so a dot and its rock agree. `colour` below is only the fallback.
 * (The near-Earth families' colours moved with them to familyOrbits.js.)
 */
export const POPULATIONS = Object.freeze({
  centaurs: {
    key: "centaurs",
    label: "Centaurs",
    colour: 0xa9c4d6,
    rows: CENTAUR_ELEMENTS,
    fadeAU: 15,
    /* Round 40, second pass: 2.4 px at rest, never under 2 (see VERTEX).
     * The first pass made them 3.2 px, bright and additive, and the owner
     * found them "extraordinary shiny, glowing, without Light them up".
     * A dark rock 10-20 AU out is no star: at rest they are now small,
     * dim and matte, and only "Light them up" makes them bright. */
    size: 2.4,
    /* Each dot's colour and rock size from its own Centaur. */
    perBody: "centaur",
  },
  /* Round 38: the four near-Earth families are no longer points here. The
   * owner found them "sparkling things which sparkle, which aren't" -- 891
   * dots near Earth's orbit read as stars. They are drawn as real rocks
   * (nearEarthFamilies.js) and shown as families by their orbits
   * (familyOrbits.js), which use the same rows. */
  /* Round 38, second pass: Neptune's 42 Trojans are bodies now
   * (planetTrojans.js), so their two point camps are gone. The camp bands
   * below stay, for their hover cards. */
  /* Round 37 drew Venus's, Earth's, Mars's and Uranus's Trojans here as
   * points. Round 38: they are bodies now (planetTrojans.js), lit as camps
   * by `highlightTrojanCamps` in smallBodies.js. */
});

const STANDARD_EPOCH_JD = 2461200.5;

const VERTEX = /* glsl */ `
attribute vec4 aOrbitA;
attribute vec4 aOrbitB;
attribute float aShade;
attribute vec3 aColour;
attribute float aRadius;
uniform float uClock;
uniform float uSize;
uniform float uPixelRatio;
uniform float uHilite;
uniform float uFocal;
varying float vShade;
varying vec3 vColour;
varying float vHandoff;
void main() {
  float e = aOrbitA.z;
  float M = mod(aOrbitA.w + aOrbitB.w * uClock, 6.28318530718);
  float E = M + 0.85 * e * sign(sin(M));
  for (int k = 0; k < 12; k++) {
    E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  }
  float nu = 2.0 * atan(sqrt(1.0 + e) * sin(0.5 * E), sqrt(1.0 - e) * cos(0.5 * E));
  float r = aOrbitA.x / (1.0 + aOrbitA.y * cos(nu));
  float u = aOrbitB.z + nu;
  float cu = cos(u);
  float su = sin(u);
  float cn = cos(aOrbitB.y);
  float sn = sin(aOrbitB.y);
  float ci = cos(aOrbitB.x);
  float si = sin(aOrbitB.x);
  vec3 p = vec3(
    r * (cn * cu - sn * su * ci),
    r * (su * si),
    r * (sn * cu + cn * su * ci)
  );
  vShade = aShade;
  vColour = aColour;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // Round 40: the dot hands over to its rock (centaurSwarm.js), which is
  // drawn from 1.5 px radius: the dot is gone by then. aRadius is the rock's
  // drawn radius in scene units; 0 means no rock, the dot always stays.
  float rockPx = aRadius * uFocal / max(1e-3, -mv.z);
  vHandoff = aRadius > 0.0 ? 1.0 - smoothstep(0.7, 1.4, rockPx) : 1.0;
  gl_PointSize = max(2.0, uSize * (0.85 + 0.3 * aShade)) * (1.0 + 1.2 * uHilite) * uPixelRatio;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uGain;
varying float vShade;
varying vec3 vColour;
varying float vHandoff;
void main() {
  if (vHandoff <= 0.0) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  // A firmer core than before (0.35 -> 0.55), so the dot holds steady.
  float a = smoothstep(1.0, 0.55, d);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColour * (0.8 + 0.4 * vShade) * uGain, a * uOpacity * vHandoff);
}
`;

/**
 * `auToScene` and `visualMeanMotion` are smallBodies.js's own;
 * `referenceJD` is the date the scene's small bodies start from; `frames`
 * the co-orbital frames (Neptune's is used for the Trojans); `hoverTargets`
 * receives the Neptune Trojans' two invisible region bands.
 */
export function createPopulationClouds({
  auToScene,
  visualMeanMotion,
  referenceJD,
  neptuneFrame = null,
  /* Round 37: any planet's co-orbital frame, by name (smallBodies.js
   * `coOrbitalFrameFor`). Falls back to the Neptune frame alone. */
  frameFor = null,
  hoverTargets = null,
  markPointerProxy = null,
  pixelRatio = 1,
  /* Round 40: the rocks' size rule (smallBodies.js), for the hand-over. */
  visualRadiusFor = null,
}) {
  const group = new THREE.Group();
  group.name = "Small-body populations";
  const layers = {};
  const frameOf = (name) => (frameFor ? frameFor(name) : name === "Neptune" ? neptuneFrame : null);

  Object.values(POPULATIONS).forEach((pop) => {
    const count = pop.rows.length;
    const orbitA = new Float32Array(count * 4);
    const orbitB = new Float32Array(count * 4);
    const shade = new Float32Array(count);
    const colour = new Float32Array(count * 3);
    const radius = new Float32Array(count);
    const position = new Float32Array(count * 3);
    const fallback = new THREE.Color(pop.colour);
    const hs = pop.rows.map((row) => row[6]).filter((h) => h >= 0);
    const hMin = Math.min(...hs);
    const hMax = Math.max(...hs);
    let maxQ = 0;
    pop.rows.forEach((row, i) => {
      const [aAU, e, iDeg, nodeDeg, argDeg, mDeg, H, epoch = STANDARD_EPOCH_JD] = row;
      const n = 0.9856076686 / (aAU ** 1.5);
      const periodDays = 360 / n;
      const M0 = ((((mDeg + n * (referenceJD - epoch)) % 360) + 360) % 360) * DEG;
      const qScene = auToScene(aAU * (1 - e));
      const QScene = auToScene(aAU * (1 + e));
      maxQ = Math.max(maxQ, QScene);
      orbitA.set([(2 * qScene * QScene) / (qScene + QScene), (QScene - qScene) / (QScene + qScene), e, M0], i * 4);
      /* The Trojans keep Neptune's own model rate (set below), whatever
       * their osculating periods say: a 1:1 resonance is that ratio. */
      orbitB.set([iDeg * DEG, nodeDeg * DEG, argDeg * DEG, visualMeanMotion(periodDays)], i * 4);
      /* Brighter (lower H) bodies are drawn brighter and a little larger;
       * no H (a handful of short arcs) sits in the middle. */
      shade[i] = H >= 0 && hMax > hMin ? 1 - (H - hMin) / (hMax - hMin) : 0.5;
      if (pop.perBody === "centaur") {
        /* Its rock's colour, at 0.62 of the triple: the triple's mean is 1,
         * and additive dots that bright read as white sparks (chosen by
         * eye). Grey reads warm grey, red brick red. */
        const look = centaurLook(i, iDeg);
        colour.set(look.chroma.map((v) => v * 0.62), i * 3);
        radius[i] = visualRadiusFor ? visualRadiusFor(centaurDiameterKm(H, look.albedo)) : 0;
      } else {
        colour.set([fallback.r, fallback.g, fallback.b], i * 3);
      }
    });
    const coFrame = pop.coOrbital ? frameOf(pop.coOrbital) : null;
    if (coFrame) {
      for (let i = 0; i < count; i += 1) orbitB[i * 4 + 3] = coFrame.model.visualRate;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
    geometry.setAttribute("aOrbitA", new THREE.BufferAttribute(orbitA, 4));
    geometry.setAttribute("aOrbitB", new THREE.BufferAttribute(orbitB, 4));
    geometry.setAttribute("aShade", new THREE.BufferAttribute(shade, 1));
    geometry.setAttribute("aColour", new THREE.BufferAttribute(colour, 3));
    geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    /* The shader moves every vertex, so the bounds are the whole region
     * the orbits reach. */
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), maxQ * 1.05);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uClock: { value: 0 },
        uSize: { value: pop.size },
        uPixelRatio: { value: pixelRatio },
        uHilite: { value: 0 },
        uFocal: { value: 1 },
        uOpacity: { value: 0.6 },
        /* Colour gain: 0.45 at rest (dark, matte), 1 when lit. */
        uGain: { value: 0.45 },
      },
      transparent: true,
      depthWrite: false,
      /* Normal, not additive (round 40, second pass): additive dots pile
       * up into glowing bands where the orbits crowd, and each one reads
       * as a light, not a rock. */
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `${pop.label} cloud`;
    points.raycast = () => {};
    points.renderOrder = -14;
    points.frustumCulled = false;
    if (coFrame) coFrame.frame.add(points);
    else group.add(points);
    layers[pop.key] = {
      pop,
      points,
      material,
      count,
      hilite: 0,
      hiliteTarget: 0,
      fadeRadius: auToScene(pop.fadeAU),
    };
  });

  /*
   * Hover for the Neptune Trojans, as for Jupiter's: an invisible band per
   * camp on the pointer layer, authored with Neptune at longitude zero and
   * turned with the modelled Neptune every frame (the frame's `swarmGroup`,
   * which `updateCoOrbitalFrames` turns). Hovering lights the camp and shows
   * its card; clicking opens its record. The Centaurs and near-Earth
   * families get no band: theirs would cover the whole space between the
   * giant planets, or between Venus and Mars, and steal every hover there.
   * They are reached from the board instead.
   */
  const markers = [];
  /* Round 37: the same bands for Mars's two camps, which are the only other
   * ones with more than two members. Venus's, Earth's and Uranus's one or
   * two Trojans are reached from the board ("Every planet's Trojans"); a
   * band 75 degrees long round Earth's orbit for two specks would steal
   * every hover near Earth's orbit guide. */
  const addCampBands = (frame, prefix, innerAU, outerAU, camps, sections, systemName, lineName) => {
    if (!frame) return;
    const bandGroup = new THREE.Group();
    bandGroup.name = `${systemName} region bands`;
    const band = (key, fromDeg, spanDeg, record) => {
      const inner = auToScene(innerAU);
      const outer = auToScene(outerAU);
      const marker = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 96, 1, fromDeg * DEG, spanDeg * DEG),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }),
      );
      marker.rotation.x = Math.PI * 0.5;
      marker.name = `${record.short} region field`;
      markPointerProxy?.(marker);
      marker.userData = {
        name: record.name,
        detail: record.character,
        isRegion: true,
        isResonantPopulation: true,
        regionId: `${prefix}-${key.toLowerCase()}`,
        visualRadius: (outer - inner) * 0.5,
        focusVisualRadius: outer,
        info: {
          type: "Trojan population · orbits the Sun",
          description: record.lede,
          diameter: record.span,
          orbitalSpeed: record.motion,
          sizeComparison: record.population,
        },
        setHovered(active) {
          const layer = layers[`${prefix}${key}`];
          if (layer) layer.hiliteTarget = active ? 1 : 0;
        },
        region: {
          systemName,
          subtitle: record.order,
          lede: record.lede,
          span: record.span,
          period: record.motion,
          population: record.population,
          sections,
          members: record.members,
        },
        ringData: {
          systemName: lineName,
          order: record.order,
          character: record.character,
          description: record.lede,
          radialRange: record.span,
          motion: record.motion,
        },
      };
      bandGroup.add(marker);
      markers.push(marker);
      hoverTargets?.push(marker);
    };
    band("L4", 25, 75, camps.L4);
    band("L5", -100, 75, camps.L5);
    frame.frame.add(bandGroup);
    frame.swarmGroup = bandGroup;
  };
  /*
   * Hover for the Neptune Trojans, as for Jupiter's: an invisible band per
   * camp on the pointer layer, authored with Neptune at longitude zero and
   * turned with the modelled Neptune every frame (the frame's `swarmGroup`,
   * which `updateCoOrbitalFrames` turns). Hovering lights the camp and shows
   * its card; clicking opens its record. The Centaurs and near-Earth
   * families get no band: theirs would cover the whole space between the
   * giant planets, or between Venus and Mars, and steal every hover there.
   * They are reached from the board instead.
   */
  addCampBands(frameOf("Neptune"), "neptune", 29.3, 30.9, NEPTUNE_CAMPS, NEPTUNE_SECTIONS,
    "Neptune's company", "Neptune's company · orbits the Sun, shepherded by Neptune");
  /* Mars: 1.42-1.63 AU, inside the spread of these orbits' own perihelia
   * and aphelia (1.28-1.77 AU at e up to 0.16) but clear of the belt's
   * inner edge at 2.1 AU and of Earth's orbit. */
  addCampBands(frameOf("Mars"), "mars", 1.42, 1.63, MARS_CAMPS, MARS_SECTIONS,
    "Mars's Trojans", "Mars's Trojans · orbit the Sun, shepherded by Mars");

  return {
    group,
    layers,
    markers,
    clock: 0,
    counts: Object.fromEntries(Object.entries(layers).map(([k, l]) => [k, l.count])),
  };
}

/* What each Neptune camp is, for its hover card and record -- the same
 * shapes the Jupiter swarms fill (resonantSwarms.js). Sizes are from each
 * body's SBDB absolute magnitude at an assumed 5% albedo, D = 1329 km /
 * sqrt(p) x 10^(-H/5): no Neptune Trojan's size has been measured. */
const nameList = (camp) => NEPTUNE_TROJANS.filter((t) => t.camp === camp);
const NEPTUNE_CAMPS = Object.freeze({
  L4: {
    name: "Neptune's Trojans · L4",
    short: "Neptune L4 Trojans",
    order: "60° ahead of Neptune",
    character: "Swarm sharing Neptune's orbit",
    span: "About 30 AU from the Sun, spread some 30° either side of the point 60° ahead of Neptune",
    motion: "Round the Sun once every 165 years — Neptune's own year — while drifting about the L4 point over roughly 10,000 years",
    population: `${nameList("L4").length} known here (JPL Small-Body Database, 8 October 2026). Large ones may outnumber Jupiter's Trojans of the same size`,
    lede: "Icy bodies on Neptune's own orbit, 60° ahead of it — the far, cold counterpart of Jupiter's Trojans. Like those, they go round the Sun, not round Neptune, held at a point where the Sun's pull and Neptune's balance. The first was found in 2001; most of them since 2013, by surveys looking for exactly this.",
    members: [
      { body: "2001 QR322", order: "The first found, 2001", character: "L4 Trojan", range: "~140 km at 5% albedo", note: "The first Neptune Trojan discovered — and one of the less stable ones.", motion: "One orbit in about 165 years" },
      { body: "Otrera", order: "(385571) 2004 UP10", character: "Named for an Amazon queen", range: "~100 km at 5% albedo", note: "One of only two named Neptune Trojans.", motion: "One orbit in about 165 years" },
      { body: "Clete", order: "(385695) 2005 TO74", character: "Named for an Amazon attendant", range: "~120 km at 5% albedo", note: "The second named Neptune Trojan.", motion: "One orbit in about 165 years" },
    ],
  },
  L5: {
    name: "Neptune's Trojans · L5",
    short: "Neptune L5 Trojans",
    order: "60° behind Neptune",
    character: "Swarm sharing Neptune's orbit",
    span: "About 30 AU from the Sun, spread some 30° either side of the point 60° behind Neptune",
    motion: "Round the Sun once every 165 years — Neptune's own year",
    population: `${nameList("L5").length} known here (JPL Small-Body Database, 8 October 2026) — fewer than at L4, because this point lies against the dense star fields of the Milky Way's centre, where faint moving dots are hard to find`,
    lede: "The trailing camp, 60° behind Neptune. The first one, 2008 LC18, was only found in 2010, by a search aimed at the crowded star fields this point sits in front of. Fewer are known here than ahead of Neptune — mostly because they are harder to see, not because there are fewer of them.",
    members: [
      { body: "2008 LC18", order: "The first L5 Trojan, found 2010", character: "L5 Trojan", range: "~135 km at 5% albedo", note: "Found by Sheppard and Trujillo, looking where the Galaxy's star fields hide them.", motion: "One orbit in about 165 years" },
      { body: "2004 KV18", order: "A wide wanderer", character: "Large libration", range: "~105 km at 5% albedo", note: "Swings far from L5 — about 100° from Neptune today — and is thought to be a temporary capture.", motion: "One orbit in about 165 years" },
    ],
  },
});

const NEPTUNE_SECTIONS = Object.freeze([
  ["Not Neptune's moons", "Every one of these goes round the Sun on its own orbit, once every 165 years like Neptune. Neptune's gravity only decides where those orbits may be: 60° ahead of it or 60° behind."],
  ["How the balance works", "At the two points that make an equal-sided triangle with the Sun and Neptune, the two pulls combine so that a body there goes round at exactly Neptune's speed. It keeps its place for billions of years, rocking slowly about the point (Lagrange's L4 and L5)."],
  ["What is drawn", "Every known Neptune Trojan on its real orbit (JPL Small-Body Database, 8 October 2026), in Neptune's frame so the two camps stay with the drawn Neptune."],
]);

/* Round 37: Mars's two camps. Sizes from H at an assumed 20% albedo --
 * most Mars Trojans are bright, olivine-rich A or S types (Eureka's
 * spectrum: Rivkin et al. 2007; Borisov et al. 2017), so 5% would
 * overstate them -- D = 1329 km / sqrt(0.2) x 10^(-H/5). Eureka: H 16.1
 * gives 1.8 km, against 1.88 km (albedo 0.18) measured by NEOWISE. */
const marsList = (camp) => PLANET_TROJANS.filter((t) => t.planet === "Mars" && t.camp === camp);
const MARS_CAMPS = Object.freeze({
  L4: {
    name: "Mars's Trojans · L4",
    short: "Mars L4 Trojans",
    order: "60° ahead of Mars",
    character: "Two asteroids sharing Mars's orbit",
    span: "About 1.52 AU from the Sun, near the point 60° ahead of Mars",
    motion: "Round the Sun once every 687 days — Mars's own year",
    population: `${marsList("L4").length} known: 1999 UJ7 and 2023 FW14`,
    lede: "Only two asteroids hold Mars's leading point. 1999 UJ7 was the first, found in 1999; 2023 FW14 was confirmed as the second in 2024. Their spectra match each other and differ from the trailing camp's — so they are not pieces of Eureka.",
    members: [
      { body: "1999 UJ7", order: "(121514), the first L4 Trojan", character: "L4 Trojan", range: "~1.1 km at 20% albedo", note: "Turns very slowly, once in about two days.", motion: "One orbit in 687 days" },
      { body: "2023 FW14", order: "Confirmed in 2024", character: "L4 Trojan", range: "~150 m at 20% albedo", note: "The second Trojan ever found at Mars's leading point (de la Fuente Marcos et al. 2024).", motion: "One orbit in 687 days" },
    ],
  },
  L5: {
    name: "Mars's Trojans · L5",
    short: "Mars L5 Trojans",
    order: "60° behind Mars",
    character: "Eureka and its family",
    span: "About 1.52 AU from the Sun, spread some 20° about the point 60° behind Mars",
    motion: "Round the Sun once every 687 days — Mars's own year",
    population: `${marsList("L5").length} known — Eureka and the small ones round it`,
    lede: "Eureka, found in 1990, was the first Trojan of any planet besides Jupiter. Most of the small ones round it have orbits so like its own that they are thought to be its fragments — the Eureka family, probably spun off it by sunlight's slow push (the YORP effect).",
    members: [
      { body: "Eureka", order: "(5261), found 1990", character: "L5 Trojan, olivine-rich", range: "1.9 km — NEOWISE (Nugent et al. 2015)", note: "The first Mars Trojan. Its olivine spectrum is rare among asteroids — material from deep inside a body that once melted.", motion: "One orbit in 687 days" },
      { body: "1998 VF31", order: "(101429)", character: "L5 Trojan", range: "~1 km at 20% albedo", note: "The second Mars Trojan found, in 1998, on a steeper orbit (31°) than Eureka's family.", motion: "One orbit in 687 days" },
    ],
  },
});

const MARS_SECTIONS = Object.freeze([
  ["Not moons of Mars", "Every one of these goes round the Sun, once every 687 days like Mars. Mars's gravity only decides where: near the point 60° ahead of it, or 60° behind."],
  ["A family from one rock", "Most of the trailing camp share Eureka's orbit almost exactly. The leading idea is that sunlight, absorbed and re-radiated unevenly, spun Eureka up until pieces came away — and they have stayed in the same safe spot ever since."],
  ["What is drawn", "The 17 bodies that long-term integrations show to be stable Mars Trojans, on their real orbits (JPL Small-Body Database, 10 October 2026), in Mars's frame so both camps stay with the drawn Mars."],
]);

/*
 * Per frame: advance the shared clock (the same motion scale every small
 * body uses), fade each cloud out when its region is too small on screen to
 * mean anything, and ease the hover highlight.
 */
const FADE_FULL_PX = 90;
const FADE_GONE_PX = 30;
export function updatePopulationClouds(clouds, motionScale, camera, viewportHeight) {
  if (!clouds) return;
  clouds.clock += motionScale;
  const distance = camera ? Math.max(1e-3, camera.position.length()) : 1;
  const focalPixels = camera ? camera.projectionMatrix.elements[5] * (viewportHeight || 800) * 0.5 : 1;
  const layers = Object.values(clouds.layers);
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const ringPixels = (layer.fadeRadius / distance) * focalPixels * 2;
    const t = Math.min(1, Math.max(0, (ringPixels - FADE_GONE_PX) / (FADE_FULL_PX - FADE_GONE_PX)));
    const fade = t * t * (3 - 2 * t);
    if (layer.hilite !== layer.hiliteTarget) {
      layer.hilite += (layer.hiliteTarget - layer.hilite) * 0.18;
      if (Math.abs(layer.hilite - layer.hiliteTarget) < 0.01) layer.hilite = layer.hiliteTarget;
    }
    /* Round 40, third pass (the owner: "as per the internet, should it be
     * that visible?"). No. A Centaur is a dark (5-10% albedo) body 10-200
     * km across, 5-30 AU from the Sun: Chiron, one of the largest, is about
     * magnitude 18-19 even from Earth, tens of thousands of times fainter
     * than the faintest star an eye can see (about magnitude 6.5). From anywhere in this scene they are
     * invisible until you are close -- so at rest there are no dots at all,
     * as with the near-Earth asteroids, and each Centaur appears only as
     * its rock when you near it (centaurSwarm.js). The dots are now only
     * what "Light them up" shows, a way of seeing where the population is. */
    void fade;
    const opacity = Math.min(1, 0.6 * layer.hilite * (1 + 0.7 * layer.hilite));
    layer.points.visible = opacity > 0.002;
    const u = layer.material.uniforms;
    u.uOpacity.value = opacity;
    u.uHilite.value = layer.hilite;
    u.uGain.value = 0.45 + 0.55 * layer.hilite;
    u.uFocal.value = focalPixels;
    u.uClock.value = clouds.clock;
  }
}

/** Lights one population (or a set of keys) -- the board's explanations call it. */
export function highlightPopulations(clouds, keys = []) {
  if (!clouds) return;
  Object.entries(clouds.layers).forEach(([key, layer]) => {
    layer.hiliteTarget = keys.includes(key) ? 1 : 0;
  });
}

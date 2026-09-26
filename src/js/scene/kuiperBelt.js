import * as THREE from "three";
import { auToSceneRadius } from "../config/celestialScale.js";
import { markPointerProxy } from "./pointerProxies.js";

/**
 * The Kuiper Belt, as a population rather than a catalogue.
 *
 * Until now the scene had eight individually placed trans-Neptunian worlds --
 * Pluto, Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris, Sedna -- and
 * absolutely nothing between them. Neptune's orbit was the outer edge of
 * anything that looked like a structure, which is exactly backwards: past
 * Neptune is where the Solar System stops being eight planets and starts
 * being a disc of ice.
 *
 * There are more than a thousand catalogued Kuiper Belt objects and an
 * estimated hundred thousand larger than 100 km. Drawing them individually is
 * neither possible nor useful, so this draws a **statistically honest
 * population**: the right number of objects in the right places, with the real
 * orbital structure, and no claim that any particular speck is a particular
 * body.
 *
 * Five sub-populations, because the belt is not one thing:
 *
 *   cold classical    42-47.5 AU, almost circular, almost flat, and very red.
 *                     These formed roughly where they are and have never been
 *                     disturbed -- the least-changed material in the Solar
 *                     System.
 *   hot classical     the same distances, but inclined up to 35 deg and
 *                     neutral-grey. Scattered outward from nearer the Sun and
 *                     dropped here, which is why they look different.
 *   plutinos          locked in Neptune's 3:2 resonance at 39.4 AU, eccentric,
 *                     and -- the point of a resonance -- never near Neptune
 *                     even though their orbits cross its. Pluto is one.
 *   scattered disk    perihelion out past Neptune, aphelion anywhere out to
 *                     150 AU. Steeply inclined, highly eccentric. Eris and
 *                     Gonggong belong to this group.
 *   detached          perihelion so far out that Neptune cannot reach them at
 *                     all. Nobody is sure how they got there. Sedna is the
 *                     famous one, and there are very few.
 *
 * The one structural feature worth building deliberately is the **Kuiper
 * Cliff**: the classical belt does not fade out, it stops, at about 48 AU.
 * Why it stops is an open question. The radial distribution below has a hard
 * outer edge for that reason and not for a rendering one.
 */

/* The shared AU-to-scene mapping lives in config/celestialScale.js, so the
 * belt, the heliosphere and the Oort Cloud all land on one curve. */
const auToScene = auToSceneRadius;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Where Neptune is, so the Plutinos can be made to avoid it. */
const NEPTUNE_LONGITUDE = 0;

const POPULATIONS = Object.freeze([
  {
    id: "cold-classical",
    name: "Cold classical belt",
    share: 0.34,
    /*
     * A hard outer edge at 47.7 AU. This is the Kuiper Cliff and it is real:
     * the number of objects does not taper, it collapses. Anything drawn with
     * a soft falloff here is drawing the wrong Solar System.
     */
    aMin: 42.0, aMax: 47.7, cliff: true,
    eMax: 0.09,
    iMax: 4.5 * DEG,
    /* Deeply red: irradiated ices and tholins, never resurfaced. */
    colourA: 0x7a4a3c, colourB: 0xb07a5c,
    brightness: 1.0,
  },
  {
    id: "hot-classical",
    name: "Hot classical belt",
    share: 0.22,
    aMin: 39.5, aMax: 47.7, cliff: true,
    eMax: 0.24,
    iMax: 34 * DEG,
    /* Neutral grey-blue: a different origin, and it shows in the colour. */
    colourA: 0x5f6d7e, colourB: 0x9fb0c2,
    brightness: 0.94,
  },
  {
    id: "plutinos",
    name: "Plutinos · Neptune 3:2 resonance",
    share: 0.16,
    aMin: 39.0, aMax: 39.8,
    eMin: 0.08, eMax: 0.33,
    iMax: 22 * DEG,
    /* The resonance keeps them clustered either side of Neptune, never at it. */
    resonantAvoidance: true,
    colourA: 0x6f5245, colourB: 0xa78a72,
    brightness: 0.97,
  },
  {
    id: "twotinos",
    name: "Twotinos · Neptune 2:1 resonance",
    share: 0.05,
    aMin: 47.5, aMax: 48.3,
    eMin: 0.1, eMax: 0.35,
    iMax: 16 * DEG,
    resonantAvoidance: true,
    colourA: 0x67584c, colourB: 0x9c8b78,
    brightness: 0.9,
  },
  {
    id: "scattered",
    name: "Scattered disk",
    share: 0.19,
    aMin: 50, aMax: 150,
    eMin: 0.32, eMax: 0.74,
    iMax: 40 * DEG,
    /*
     * A scattered-disk object is scattered *by Neptune*, which means its
     * perihelion is out at Neptune's orbit and not inside it. Without this
     * floor a small-a high-e draw produced a perihelion of 13 AU -- which is
     * a Centaur, a different population living between Jupiter and Neptune,
     * and they piled up against the inner end of the distance mapping.
     */
    perihelionMinAu: 30,
    colourA: 0x5a5f6b, colourB: 0x93a0b0,
    brightness: 0.82,
  },
  {
    /*
     * The unresolved bulk, and why it has to exist.
     *
     * Built with only the six structured populations above, the belt was
     * honest and invisible: a few thousand single dim pixels scattered over a
     * sphere 2,800 units across, which from Neptune read as nothing at all.
     * That is a fair depiction -- the real belt is so sparse that New Horizons
     * flew through it and saw nothing -- and it is useless as a picture of a
     * region.
     *
     * The main asteroid belt already answered this question and the answer is
     * in its own source: 120,000 "unresolved pebbles ... the dust that makes a
     * belt look like a belt", underneath 14,500 resolved rocks. This is the
     * same device. These carry no orbital story -- they are the low-inclination
     * bulk of the classical belt, tiny and dim -- and they are what turns six
     * populations of specks into something with a shape.
     */
    id: "unresolved",
    name: "Unresolved population",
    haze: true,
    aMin: 38.5, aMax: 48.4, cliff: true,
    eMax: 0.14,
    iMax: 13 * DEG,
    colourA: 0x6d5044, colourB: 0x93a2b2,
    brightness: 0.72,
    sizeMin: 0.1, sizeMax: 0.42,
    alphaMin: 0.16, alphaMax: 0.52,
  },
  {
    id: "detached",
    name: "Detached objects",
    share: 0.04,
    aMin: 160, aMax: 480,
    eMin: 0.5, eMax: 0.82,
    iMax: 30 * DEG,
    /* Detached *means* out of Neptune's reach. Sedna's perihelion is 76 AU. */
    perihelionMinAu: 42,
    /* Perihelion beyond Neptune's reach entirely -- the Sedna class. */
    detached: true,
    colourA: 0x6b4a44, colourB: 0xa8776a,
    brightness: 0.7,
  },
]);

/*
 * `points` is the budget for the six structured populations; `haze` is the
 * separate budget for the unresolved bulk. They are counted apart because
 * they answer different questions -- the first is orbital structure, the
 * second is whether the region reads as a region at all -- and because the
 * haze is cheap: one draw call of flat, tiny, dim points with no per-object
 * story to tell.
 */
const QUALITY = Object.freeze({
  low:    { points: 4_600, haze: 34_000, sizeScale: 1.1 },
  medium: { points: 7_600, haze: 58_000, sizeScale: 1.0 },
  high:   { points: 11_000, haze: 86_000, sizeScale: 0.95 },
});

/** Deterministic, so the belt is the same belt on every load. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  uniform float uProjScale;
  uniform float uSizeScale;
  uniform float uFade;
  uniform float uHilite;
  uniform float uHiliteIn;
  uniform float uHiliteOut;
  varying vec3 vColour;
  varying float vAlpha;

  void main() {
    vColour = color;

    /*
     * Hover highlight, applied by orbital radius rather than by layer.
     *
     * A zone is a range of distances, and the populations cross each other --
     * the Plutinos reach inside Neptune's orbit and the scattered disk starts
     * where the classical belt ends. Brightening whole layers would light the
     * wrong objects. Testing each object's own distance from the Sun lights
     * exactly the band the cursor is over, whichever population it belongs to.
     */
    float orbitRadius = length(position.xz);
    float inZone = step(uHiliteIn, orbitRadius) * step(orbitRadius, uHiliteOut);
    float lift = 1.0 + uHilite * inZone * 2.6;
    vColour = mix(vColour, min(vColour * 2.1 + 0.10, vec3(1.0)), uHilite * inZone);

    vAlpha = aAlpha * uFade * lift;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    /*
     * The correct world-size-to-pixels conversion, and the reason it is
     * written out rather than approximated: a constant over view depth is
     * scale-dependent, and this scene spans six orders of magnitude of
     * camera distance. uProjScale carries projectionMatrix[1][1] * height / 2.
     */
    float px = aSize * uSizeScale * uProjScale / max(-mvPosition.z, 0.0001);
    px *= 1.0 + uHilite * inZone * 0.55;

    /*
     * Floor and ceiling both matter. Without the floor every object drops
     * below a pixel the moment the camera pulls back -- which is exactly when
     * the whole belt is on screen and most worth seeing. Without the ceiling a
     * close pass turns each one into a blob, and these are 100 km bodies.
     */
    gl_PointSize = clamp(px, 1.0, 3.4) * uPixelRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = /* glsl */`
  varying vec3 vColour;
  varying float vAlpha;

  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    float r2 = dot(offset, offset);
    if (r2 > 0.25) discard;
    float soft = 1.0 - smoothstep(0.04, 0.25, r2);
    float alpha = vAlpha * soft;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(vColour, alpha);
  }
`;

function buildPopulation(population, count, seed) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);

  const colourA = new THREE.Color(population.colourA);
  const colourB = new THREE.Color(population.colourB);
  const scratch = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;

    /*
     * Semi-major axis. The classical populations are weighted towards their
     * outer half and then stop dead at the cliff; everything else falls off
     * steadily outward, which is what a scattered population does.
     */
    const t = population.cliff
      ? 1 - Math.pow(random(), 1.7)
      : Math.pow(random(), 1.9);
    const a = population.aMin + t * (population.aMax - population.aMin);

    const eMin = population.eMin ?? 0;
    let eMax = population.eMax ?? 0.1;
    if (population.perihelionMinAu) {
      // e such that a(1 - e) >= perihelionMin.
      eMax = Math.min(eMax, Math.max(eMin, 1 - population.perihelionMinAu / a));
    }
    const e = eMin + random() * (eMax - eMin);
    const inclination = population.iMax * Math.pow(random(), 1.5) * (random() < 0.5 ? -1 : 1);

    /*
     * Longitude. A resonant object is not merely eccentric, it is *phased*:
     * the 3:2 and 2:1 resonances hold their members roughly 72 and 90 degrees
     * away from Neptune, on either side, and that is precisely why orbits
     * that cross Neptune's never produce an encounter. Drawing them uniformly
     * around the circle would throw away the only interesting thing about
     * them.
     */
    let node;
    if (population.resonantAvoidance) {
      const lead = random() < 0.5 ? 1 : -1;
      const centre = NEPTUNE_LONGITUDE + lead * (population.id === "plutinos" ? 72 : 92) * DEG;
      node = centre + (random() - 0.5) * 66 * DEG;
    } else {
      node = random() * TAU;
    }
    const argPeri = random() * TAU;
    const meanAnomaly = random() * TAU;

    /*
     * One Newton step on Kepler's equation. Three would be exact; one is
     * within a fraction of a pixel at these eccentricities and this is ten
     * thousand objects built during a loading screen.
     */
    let E = meanAnomaly + e * Math.sin(meanAnomaly);
    E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));

    const xOrbit = a * (Math.cos(E) - e);
    const yOrbit = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);

    const trueRadiusAu = Math.hypot(xOrbit, yOrbit);
    const trueAngle = Math.atan2(yOrbit, xOrbit) + argPeri;
    const sceneRadius = auToScene(trueRadiusAu);

    const cosNode = Math.cos(node), sinNode = Math.sin(node);
    const cosI = Math.cos(inclination), sinI = Math.sin(inclination);
    const px = sceneRadius * Math.cos(trueAngle);
    const pz = sceneRadius * Math.sin(trueAngle);

    positions[i3] = px * cosNode - pz * sinNode * cosI;
    positions[i3 + 1] = pz * sinI;
    positions[i3 + 2] = px * sinNode + pz * cosNode * cosI;

    /*
     * Colour. Kuiper Belt surfaces are genuinely bimodal -- a very red group
     * and a neutral group -- and that split is one of the strongest clues to
     * where each population formed. Each population therefore mixes between
     * its own two ends rather than sharing one palette.
     */
    const shade = random();
    scratch.copy(colourA).lerp(colourB, Math.pow(shade, 0.8));
    const lift = 0.55 + shade * 0.62;
    colours[i3] = scratch.r * lift;
    colours[i3 + 1] = scratch.g * lift;
    colours[i3 + 2] = scratch.b * lift;

    /* A steep size distribution: many small, very few large. */
    const sizeMin = population.sizeMin ?? 0.4;
    const sizeMax = population.sizeMax ?? 3.0;
    sizes[i] = sizeMin + Math.pow(random(), 3.1) * (sizeMax - sizeMin);
    const alphaMin = population.alphaMin ?? 0.26;
    const alphaMax = population.alphaMax ?? 0.92;
    alphas[i] = (alphaMin + Math.pow(random(), 1.4) * (alphaMax - alphaMin)) * population.brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.userData.fullDrawCount = count;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: 1 },
      uProjScale: { value: 800 },
      uSizeScale: { value: 1 },
      uFade: { value: 1 },
      uHilite: { value: 0 },
      uHiliteIn: { value: 0 },
      uHiliteOut: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = `Kuiper Belt · ${population.name}`;
  points.frustumCulled = false;
  points.renderOrder = 1;
  points.userData.population = population;
  return points;
}


/**
 * The band the population sits in.
 *
 * Measured in the browser: from the arrival view roughly 25,000 belt objects
 * are on screen and every one of them is clamped to the one-pixel floor,
 * because their true projected size is far below it. Twenty-five thousand
 * single dim pixels spread across a frame do not read as a region -- they read
 * as noise on top of a star field, which is exactly what was reported.
 *
 * Matching the main asteroid belt's surface density is not the answer. That
 * belt packs 134,500 rocks into an annulus of about 266,000 square scene
 * units; the classical Kuiper Belt covers 5.5 million. The same density would
 * need close to three million points.
 *
 * The honest answer is the word already in use: *unresolved*. A population
 * whose members are far below a pixel is, by definition, a diffuse glow, and
 * drawing it as one is not a cheat -- it is what unresolved means. So the
 * points carry the structure and this carries the light.
 *
 * The radial profile is the real one, and the sharp outer edge is the Kuiper
 * Cliff again: the classical belt does not taper at 47.7 AU, it stops.
 */
function createBeltGlow() {
  const innerAu = 34, outerAu = 62;
  const inner = auToScene(innerAu);
  const outer = auToScene(outerAu);

  const geometry = new THREE.RingGeometry(inner, outer, 256, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: inner },
      uOuter: { value: outer },
      uPeakIn: { value: auToScene(41.5) },
      uPeakOut: { value: auToScene(47.7) },
      uOpacity: { value: 0.115 },
      uHilite: { value: 0 },
      uHiliteIn: { value: 0 },
      uHiliteOut: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uInner;
      uniform float uOuter;
      uniform float uPeakIn;
      uniform float uPeakOut;
      uniform float uOpacity;
      uniform float uHilite;
      uniform float uHiliteIn;
      uniform float uHiliteOut;
      varying vec2 vLocal;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        float radius = length(vLocal);
        float angle = atan(vLocal.y, vLocal.x) / 6.28318530718 + 0.5;

        // Rise from the inner edge, hold across the classical belt, then stop
        // dead at the cliff and leave only a thin scattered-disk tail.
        float rise = smoothstep(uInner, uPeakIn, radius);
        float cliff = 1.0 - smoothstep(uPeakOut, uPeakOut * 1.035, radius);
        float tail = (1.0 - smoothstep(uPeakOut, uOuter, radius)) * 0.22;
        float density = rise * max(cliff, tail);

        // Clumpy rather than uniform: a real population is not a wash.
        float coarse = hash21(vec2(floor(angle * 220.0), floor(radius * 0.06)));
        float fine = hash21(vec2(floor(angle * 900.0), floor(radius * 0.2) + 7.0));
        float grain = 0.52 + 0.48 * (coarse * 0.6 + fine * 0.4);

        // The hovered band lifts out of the rest rather than the rest dimming:
        // a region is being pointed at, not selected out of a set.
        float inZone = step(uHiliteIn, radius) * step(radius, uHiliteOut);
        float alpha = uOpacity * density * grain * (1.0 + uHilite * inZone * 3.4);
        if (alpha < 0.0015) discard;

        // Cold classical ice is red; the hot and scattered groups are neutral.
        // The band shifts between them the way the population does.
        vec3 red = vec3(0.55, 0.38, 0.31);
        vec3 grey = vec3(0.42, 0.47, 0.55);
        vec3 colour = mix(grey, red, smoothstep(uPeakIn * 0.92, uPeakOut, radius));
        colour = mix(colour, vec3(0.86, 0.78, 0.62), uHilite * inZone * 0.55);

        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Kuiper Belt · unresolved band";
  mesh.rotation.x = Math.PI * 0.5;
  mesh.renderOrder = 0;
  mesh.frustumCulled = false;
  return mesh;
}


/**
 * Something to point at.
 *
 * The population is tens of thousands of sub-pixel specks and a diffuse band,
 * and none of that can be hovered -- there is nothing under the cursor with an
 * identity.
 *
 * The first attempt gave each sub-population one small invisible sphere. It
 * worked, and it was useless: measured in the browser, a 32-unit sphere 5,200
 * units away is a six-pixel target somewhere in a field of stars, and nobody
 * is ever going to find it by moving a mouse.
 *
 * So these are annuli instead, the same device the ring systems already use --
 * an invisible flat band per zone, covering the whole circle, so the pointer
 * finds the region anywhere over that part of the disc.
 *
 * The zones are radial and do not overlap, which also happens to be how the
 * belt is actually described: the resonance at the inner edge, the classical
 * belt, the cliff, the scattered disk beyond it, and the detached objects
 * past everything. The cold and hot classical populations share one zone
 * because they share the same distances -- telling them apart is a matter of
 * colour and inclination, not radius, and the card says so.
 *
 * They carry the `name` / `info` shape every other interactive object uses,
 * which is all `findInteractiveObject` needs: it walks up from the hit until
 * it finds `userData.name`. They sit on the pointer-proxy layer, so the camera
 * never draws them and they cost nothing per frame.
 */
const REGION_ZONES = Object.freeze([
  {
    id: "plutinos",
    population: "Over 1,700 catalogued · tens of thousands larger than 100 km",
    members: [
      { body: "Pluto", order: "IAU dwarf planet", character: "The largest Plutino, and the one the group is named for",
        range: "39.5 AU average · perihelion 29.7 AU, inside Neptune's orbit",
        note: "Two orbits for every three of Neptune's. Its closest approach to the Sun is nearer than Neptune ever gets, and the resonance still guarantees the two can never meet.",
        motion: "248-year orbit · five moons" },
      { body: "Ixion", order: "Dwarf planet candidate", character: "The same resonance, without the fame",
        range: "39.6 AU average · perihelion 30.1 AU",
        note: "Moderately red and strongly processed — tholins over whatever ice is left, with only the faintest water signature. It crosses inside Neptune's orbit on the same protected geometry Pluto uses.",
        motion: "250-year orbit · no known moon" },
      { body: "Orcus", order: "Dwarf planet candidate", character: "The anti-Pluto",
        range: "39.4 AU average",
        note: "The same 3:2 resonance as Pluto, at the opposite phase of it — when Pluto is at its closest to the Sun, Orcus is at its furthest. A near-twin running in mirror image.",
        motion: "247-year orbit · one large moon, Vanth" },
      /* Rank 4 plutinos, from tnoCatalogue.js. */
      { body: "Achlys", order: "Dwarf planet candidate", character: "Spun into a flattened, stretched shape",
        range: "39.7 AU average · 32.7 to 46.6 AU",
        note: "Four occultations traced a body 940 km on its long axis and under half that on its short one — what a loosely packed icy world becomes when it turns every 6.8 hours.",
        motion: "250-year orbit · one small moon" },
      { body: "Huya", order: "Dwarf planet candidate", character: "Very nearly a double world",
        range: "39.3 AU average · perihelion 28.5 AU, inside Neptune's orbit",
        note: "Its moon is more than half its width and circles it every three and a half days. Its surface is rich in carbon dioxide ice.",
        motion: "246-year orbit · one large moon" },
    ],
    dossier: {
      subtitle: "Locked to Neptune, two orbits for every three",
      lede: "Pluto is not an outlier out here. It is the largest member of a crowd of objects doing exactly the same thing, and what they are all doing is the most elegant trick in the outer Solar System.",
      facts: [
        ["Mean distance", "39.4 AU · 5.9 billion km"],
        ["Orbital period", "248 years"],
        ["Known members", "Over 1,700 catalogued"],
        ["Estimated population", "Tens of thousands larger than 100 km"],
        ["Inclinations", "0° to about 22°"],
        ["Largest members", "Pluto, Orcus, Ixion, Huya"],
      ],
      sections: [
        ["The trick", "A Plutino goes round the Sun twice for every three circuits Neptune makes. Its orbit is eccentric enough to cross inside Neptune's — Pluto's closest approach to the Sun is nearer than Neptune ever gets — and yet the two can never collide. The resonance forces every close approach to happen when Neptune is roughly seventy degrees away along its own orbit. The geometry repeats; the encounter never does."],
        ["Why it matters", "You cannot capture thousands of objects into a resonance by accident. The Plutinos are the strongest single piece of evidence that Neptune did not form where it is now: it migrated outward through the disc, and its resonances swept up everything in their path. The shape of this population is a record of that journey."],
        ["What is drawn", "A representative sample, phased the way the real population is — clustered either side of Neptune and never at it. Their closest approaches reach in to Neptune's orbit and no further, which is why the inner edge of this zone sits exactly where it does."],
      ],
    },
    name: "The Plutinos",
    innerAu: 36.5, outerAu: 41.2,
    type: "Kuiper Belt resonance",
    detail: "Neptune 3:2 resonance · Pluto's group",
    description: "Two orbits for every three of Neptune's, and that ratio is a form of protection. These objects are eccentric enough to cross inside Neptune's orbit, yet the resonance holds them roughly seventy degrees away from Neptune whenever they do — so an orbit that crosses another planet's never produces an encounter. Pluto is the largest member and the reason for the name.",
    span: "≈ 39.4 AU · locked to Neptune's 3:2 resonance",
    speed: "One orbit every 248 years — Pluto's year",
  },
  {
    id: "classical",
    population: "Over 100,000 objects larger than 100 km",
    members: [
      { body: "Makemake", order: "IAU dwarf planet", character: "The brightest classical object after Pluto",
        range: "45.6 AU average",
        note: "A methane-ice surface with no nitrogen, which sets it apart from Pluto and Eris. Bright enough that it was one of the objects whose discovery forced the dwarf planet definition.",
        motion: "306-year orbit · one known moon" },
      { body: "Quaoar", order: "Dwarf planet candidate", character: "Rings where a moon should be",
        range: "43.2 AU average",
        note: "Two narrow rings found by occultation in 2023, both orbiting outside the distance at which the material should have gathered into a moon. Explaining why they have not is an open problem.",
        motion: "285-year orbit · one moon, Weywot" },
      { body: "Salacia", order: "Dwarf planet candidate", character: "One of the darkest large worlds known",
        range: "42.2 AU average",
        note: "Very nearly Ceres-sized and reflecting about four per cent of the light that reaches it, which is why nothing found it until 2004. Its moon Actaea is a third of its diameter — closer to a binary than to a world with a satellite.",
        motion: "274-year orbit · one large moon, Actaea" },
      { body: "Varuna", order: "Dwarf planet candidate", character: "Spinning fast enough to deform",
        range: "42.9 AU average",
        note: "A day of 6.34 hours — quick enough that it cannot hold a round shape and has been stretched into an ellipsoid, the same thing that happened to Haumea. Its brightness varies by nearly a third as it turns.",
        motion: "281-year orbit · strongly red, water ice detected" },
      { body: "Varda", order: "Dwarf planet candidate", character: "A massive binary in the classical belt",
        range: "45.7 AU average",
        note: "Its companion Ilmarë is about 320 km across, making this one of the more massive pairs out here. The density points to a body with rather more rock than ice inside.",
        motion: "309-year orbit · one large moon, Ilmarë" },
      { body: "Haumea", order: "IAU dwarf planet", character: "The fastest large spin in the Solar System",
        range: "43.1 AU average",
        note: "Spun into an ellipsoid by a 3.9-hour rotation, and the first trans-Neptunian object found to have a ring. It sits near the classical belt but in a weak resonance of its own, and it has a collisional family — fragments of a single ancient impact.",
        motion: "285-year orbit · two moons and a ring" },
      /* Rank 4 classical-belt worlds, from tnoCatalogue.js. */
      { body: "Máni", order: "Dwarf planet candidate", character: "A crater half the width of the world",
        range: "41.6 AU average",
        note: "Sixty-one occultation chords in 2020 caught a depression 322 km wide and 45 km deep on a body 796 km across — far more relief than an icy world that size should hold.",
        motion: "268-year orbit · no known moon" },
      { body: "Aya", order: "Dwarf planet candidate", character: "Large, and alone",
        range: "47.4 AU average",
        note: "768 km across with no moon that Hubble can find — a control case for how the others got theirs.",
        motion: "326-year orbit · no moon" },
      { body: "Uni", order: "Dwarf planet candidate", character: "Less dense than water",
        range: "42.9 AU average",
        note: "Its moon Tinia weighs it at 0.82 g/cm³ — the largest body known to be that light, and a problem for how big worlds are thought to form.",
        motion: "281-year orbit · one moon, Tinia" },
      { body: "Goibniu", order: "Dwarf planet candidate", character: "Dark and fast-spinning",
        range: "41.9 AU average",
        note: "Reflects under eight per cent of its light and turns every 5.9 hours, fast enough to show as a stretched body in its lightcurve.",
        motion: "271-year orbit · no known moon" },
      { body: "Ritona", order: "Dwarf planet candidate", character: "The roundest orbit of the set",
        range: "41.5 AU average · 40.6 to 42.4 AU",
        note: "JWST found strong carbon dioxide ice on its surface in 2023.",
        motion: "267-year orbit · no known moon" },
      { body: "Chaos", order: "Kuiper Belt object", character: "Possibly two bodies touching",
        range: "46.1 AU average",
        note: "Found in 1998. Recent occultations suggest a two-lobed outline seen from the pole — not yet published in a refereed journal.",
        motion: "313-year orbit · no known moon" },
    ],
    dossier: {
      subtitle: "Two populations sharing one address",
      lede: "The main body of the belt, and the place where the Solar System keeps its least-disturbed material. It is also, quietly, two entirely different things that happen to occupy the same distances.",
      facts: [
        ["Distance", "42 – 47.7 AU · 6.3 – 7.1 billion km"],
        ["Orbital period", "About 290 years"],
        ["Orbital speed", "Roughly 4.5 km/s"],
        ["Estimated population", "Over 100,000 objects larger than 100 km"],
        ["Cold group", "Inclination under 5°, deep red, formed in place"],
        ["Hot group", "Inclination to 34°, neutral grey, arrived later"],
        ["Notable members", "Makemake, Quaoar, Albion (1992 QB1)"],
      ],
      sections: [
        ["The cold population", "Nearly circular orbits, barely tilted, and a deep red colour from billions of years of radiation working on surface ices. Nothing has ever moved them. A striking fraction are wide binaries — two objects orbiting each other so loosely that any close encounter with a planet would have torn them apart, which is the best evidence there is that no such encounter ever happened. This is the most pristine material within reach."],
        ["The hot population", "Same distances, completely different history. These orbits are tilted by up to thirty-four degrees and the surfaces are neutral grey rather than red, because this material formed much closer in and was thrown out here during the giant planets' migration. Distance cannot tell the two groups apart. Colour and inclination can, which is why the scene draws them as separate populations."],
        ["Where it began", "In 1992 David Jewitt and Jane Luu found a single faint object beyond Neptune and called it 1992 QB1, now named Albion. It was the first confirmation that anything at all lay out here besides Pluto. Everything in this zone is, in a sense, a consequence of that one detection."],
      ],
    },
    name: "The classical belt",
    innerAu: 41.2, outerAu: 47.7,
    type: "Kuiper Belt region",
    detail: "Two populations sharing one address",
    description: "The main body of the Kuiper Belt, and it is two things at once. The cold population formed roughly where it still is, on nearly circular orbits within five degrees of the ecliptic, and nothing has moved it since — the least-changed material in the Solar System, coloured deep red by billions of years of irradiated ice. The hot population sits at the same distances on orbits tilted up to thirty-four degrees, and is neutral grey, because it formed much closer to the Sun and was thrown out here during the giant planets' early migration. Distance cannot tell them apart; colour and inclination can.",
    span: "42 – 47.7 AU from the Sun",
    speed: "About 4.5 km/s · one orbit every 290 years",
  },
  {
    id: "cliff",
    population: "Object counts collapse here · the Twotinos are the resonant remnant",
    members: [],
    dossier: {
      subtitle: "Where the belt stops, and nobody knows why",
      lede: "The classical belt does not thin out towards its outer edge. It ends. The number of objects collapses at about 47.7 AU, and after more than thirty years of looking, that edge remains one of the outstanding unexplained features of the Solar System.",
      facts: [
        ["Location", "≈ 47.7 AU · 7.1 billion km"],
        ["Resonance", "Neptune 2:1 — the Twotinos"],
        ["Orbital period", "About 330 years"],
        ["Density drop", "Sharp, not gradual"],
        ["Status", "Open problem"],
      ],
      sections: [
        ["What is observed", "Object counts rise through the classical belt and then fall off a cliff. Surveys have repeatedly failed to find the population that ought to lie beyond it, and the shortfall is far too large to be a limit of the telescopes. Something truncated the disc."],
        ["The candidate explanations", "A star passing close to the young Sun and stripping the outer disc away. A planet-sized body that swept the region and has since been ejected, or now sits undetected much further out. Or a disc that simply never extended further, because the material to build from ran out. Each explains part of the observation; none has been shown to be correct."],
        ["The complication", "New Horizons, flying through this region on its way out, registered more dust than a truly empty belt should produce — which hints that something is still there, too small and too dark to see directly. The cliff may be an edge in large objects rather than in matter."],
      ],
    },
    name: "The Kuiper Cliff",
    innerAu: 47.7, outerAu: 50.2,
    type: "Kuiper Belt boundary",
    detail: "Neptune 2:1 resonance · where the belt stops",
    description: "The classical belt does not thin out at its outer edge. It stops. The number of objects collapses at about 47.7 AU, right where Neptune's 2:1 resonance sits — one orbit for every two of Neptune's — and the objects held in that resonance are called Twotinos. Why the belt ends here at all is an open question: an ancient passing star, a planet that has since left, and a limit on where the original disc could form have all been proposed, and none is settled.",
    span: "≈ 47.7 AU · the outer edge of the classical belt",
    speed: "One orbit every 330 years",
  },
  {
    id: "scattered",
    population: "Hundreds catalogued · the source of most short-period comets",
    members: [
      { body: "Eris", order: "IAU dwarf planet", character: "The object that reclassified Pluto",
        range: "67.9 AU average · 38 to 98 AU across its orbit",
        note: "Very nearly Pluto's size and briefly thought larger. A Solar System with ten planets, then eleven, then more, was not workable, and in 2006 the IAU defined the dwarf planet class instead.",
        motion: "558-year orbit · one moon, Dysnomia" },
      { body: "Gonggong", order: "Dwarf planet candidate", character: "One of the reddest worlds known",
        range: "66.9 AU average · 33 to 101 AU",
        note: "Deeply red from irradiated ices, with water ice and possibly methane frost on the surface. Its orbit is in a 3:10 resonance with Neptune, which is how it kept a path this eccentric without being ejected.",
        motion: "553-year orbit · one moon, Xiangliu" },
      /* Rank 4 scattered-disc worlds, from tnoCatalogue.js. */
      { body: "Chiminigagua", order: "Dwarf planet candidate", character: "The ninth-brightest world past Neptune",
        range: "58.9 AU average · 35.9 to 81.9 AU",
        note: "Tilted 33 degrees to the planets, 742 km across and brighter than most of its neighbours. Hubble found a moon in 2018.",
        motion: "452-year orbit · one moon" },
      { body: "Gǃkúnǁʼhòmdímà", order: "Dwarf planet candidate", character: "Weighed by its moon",
        range: "74.5 AU average · 37.6 to 111.4 AU",
        note: "Occultation-measured at 638 km, and its moon Gǃòʼé ǃHú puts its density near that of water. Named from the Juǀʼhoan people of the Kalahari.",
        motion: "643-year orbit · one moon, Gǃòʼé ǃHú" },
      { body: "Rumina", order: "Kuiper Belt object", character: "Grey, and covered in water ice",
        range: "92.0 AU average · 35.2 to 148.9 AU",
        note: "One of the few large worlds out here that is neutral rather than red, with strong fresh-ice bands.",
        motion: "883-year orbit · no known moon" },
      { body: "DeeDee", order: "Dwarf planet candidate", character: "The scattered disc's true reach",
        range: "109.7 AU average · 38.5 to 180.9 AU",
        note: "Formally 2014 UZ224, still with no official name. Found at 92 AU by the Dark Energy Survey; ALMA measured it at 635 km.",
        motion: "About 1,150-year orbit · no known moon" },
    ],
    dossier: {
      subtitle: "Thrown outward by Neptune, and never brought back",
      lede: "Beyond the cliff the belt does not stop so much as change character. These objects were scattered by Neptune onto long, steep, eccentric paths — and most of the comets that visit the inner Solar System on short orbits started here.",
      facts: [
        ["Perihelion", "Typically 30 – 38 AU, out at Neptune"],
        ["Aphelion", "100 AU and beyond"],
        ["Inclinations", "Up to about 40°"],
        ["Eccentricities", "0.3 to 0.75"],
        ["Notable members", "Eris, Gonggong"],
        ["Descendants", "Most short-period comets"],
      ],
      sections: [
        ["How they got here", "Each of these objects came close enough to Neptune for its gravity to fling it outward. The energy came out of Neptune's own orbit, which is part of why Neptune is where it is. The orbits that resulted are still anchored at Neptune's distance at their closest point — that is the signature, and it is why this population's inner edge is so sharply defined."],
        ["Eris, and why Pluto changed status", "Eris was found here in 2005 and is very nearly Pluto's size — briefly thought larger. A Solar System with ten planets, then eleven, then more, was not a workable idea, and in 2006 the IAU defined the dwarf planet class instead. Pluto did not shrink. The catalogue grew."],
        ["Where the comets come from", "Objects here are still being perturbed. Some fall inward, are captured by Jupiter's gravity, and become the short-period comets that return every few years. Both the sungrazer and the meteor shower already in this project trace back, eventually, to populations like this one."],
      ],
    },
    name: "The scattered disk",
    innerAu: 50.2, outerAu: 95,
    type: "Kuiper Belt region",
    detail: "Scattered by Neptune · steep and eccentric",
    description: "Objects flung outward by Neptune and never brought back. Their closest approach is still out at Neptune's orbit but their furthest can be a hundred and fifty astronomical units or more, on paths tilted steeply out of the plane everything else shares. Eris and Gonggong belong here. This is also where most short-period comets come from.",
    span: "Perihelion ≈ 30 AU · aphelion out past 150 AU",
    speed: "Centuries to millennia per orbit",
  },
  {
    id: "detached",
    population: "A handful known · the sample is too small to reason from confidently",
    members: [
      { body: "Sedna", order: "Dwarf planet candidate", character: "The most distant of the set",
        range: "Perihelion 76 AU · aphelion about 937 AU",
        note: "Neptune cannot have placed it here. Anything Neptune scatters keeps a closest approach near Neptune's own orbit, and Sedna's is more than twice that. Something else acted, and it is not acting now.",
        motion: "About 11,400 years for one orbit" },
      /* Rank 4, from tnoCatalogue.js. */
      { body: "Leleākūhonua", order: "Sednoid", character: "The third of its kind",
        range: "Perihelion 65 AU · aphelion about 2,300 AU",
        note: "With Sedna and 2012 VP113, one of three bodies whose closest approach is beyond anything Neptune could have arranged. Found near perihelion in 2015.",
        motion: "About 40,000 years for one orbit" },
    ],
    dossier: {
      subtitle: "Out of reach of everything we know about",
      lede: "A small group of objects whose closest approach to the Sun is so distant that Neptune cannot have put them there — and neither can anything else in the Solar System as it exists now. They are the clearest sign that something happened out here that has not been explained.",
      facts: [
        ["Perihelion", "Beyond 40 AU — Sedna's is 76 AU"],
        ["Aphelion", "Sedna reaches about 937 AU"],
        ["Orbital period", "Sedna: roughly 11,400 years"],
        ["Known members", "A handful — Sedna, 2012 VP113, Leleākūhonua"],
        ["Status", "Open problem"],
      ],
      sections: [
        ["Why they are a problem", "To lift an object onto an orbit like Sedna's, something has to raise its closest approach far beyond Neptune's reach. Neptune cannot do it — anything Neptune scatters keeps a perihelion near Neptune's own orbit, which is exactly what the scattered disk shows. So something else acted, and it is not acting now."],
        ["The candidate explanations", "A star passing close by while the Sun was still in its birth cluster, tugging these orbits outward. An undiscovered planet much further out, still shepherding them. Or capture from another star entirely during that crowded early period. The argument is unsettled and the sample is tiny — a handful of objects is not much to reason from."],
        ["What is drawn", "Very few objects, on very long orbits, spending almost all of their time near their furthest point — which is why they are so hard to find and why the known sample is so small. Sedna itself is near its closest approach now, and will not be again for over eleven thousand years."],
      ],
    },
    name: "The detached objects",
    innerAu: 95, outerAu: 300,
    type: "Kuiper Belt region",
    detail: "Beyond Neptune's reach entirely",
    description: "A small group whose closest approach to the Sun is so far out that Neptune cannot have put them there — and nothing else in the present Solar System can either. Sedna's perihelion is 76 AU and its orbit takes over eleven thousand years. The leading explanations involve a star passing close by early in the Sun's history, or a body further out that has not been found. This is an open problem, not a settled story.",
    span: "Perihelion beyond 40 AU · aphelion to 900 AU and more",
    speed: "Thousands of years per orbit",
  },
]);

function createRegionMarkers({ group, hoverTargets }) {
  const markers = [];
  REGION_ZONES.forEach((zone, index) => {
    const inner = auToScene(zone.innerAu);
    const outer = auToScene(zone.outerAu);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 160, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    marker.name = `${zone.name} region field`;
    marker.rotation.x = Math.PI * 0.5;
    marker.renderOrder = -90;
    markPointerProxy(marker);
    marker.userData = {
      name: zone.name,
      detail: zone.detail,
      /*
       * `isRegion` is the generic flag the hover ladder in main.js tests for;
       * `isKuiperRegion` is the specific one, kept for anything that later
       * needs to tell a Kuiper zone from a heliosphere or Oort one.
       */
      isRegion: true,
      isKuiperRegion: true,
      regionId: zone.id,
      visualRadius: (outer - inner) * 0.5,
      focusVisualRadius: outer,
      info: {
        type: zone.type,
        description: zone.dossier.lede,
        diameter: zone.span,
        orbitalSpeed: zone.speed,
        sizeComparison: zone.population,
      },
      /*
       * The hover card was built for ring groups and its shape fits a region
       * exactly: a system name, an order within that system, a one-word
       * character, a description, a radial range and a line about motion. So
       * regions fill the same payload rather than growing a second card.
       */
      /*
       * `setCelestialHover` calls this on the way in and calls the previous
       * target's with `false` on the way out, so the group only ever needs to
       * hold one range. `updateKuiperBelt` eases the strength toward it.
       */
      setHovered(active) {
        group.userData.hiliteTarget = active ? 1 : 0;
        if (active) {
          group.userData.hiliteIn = inner;
          group.userData.hiliteOut = outer;
        }
      },
      dossier: zone.dossier,
      zone,
      /*
       * Everything the celestial dossier needs to render a region in exactly
       * the same card a planet gets. The panel already falls back to
       * `userData.info` for anything without a PLANET_DETAILS entry, so most
       * of this is simply filling those fields with the region's equivalents
       * -- a span instead of a diameter, a population instead of a mass.
       */
      region: {
        systemName: "The Kuiper Belt",
        subtitle: zone.dossier.subtitle,
        lede: zone.dossier.lede,
        span: zone.span,
        period: zone.speed,
        population: zone.population,
        sections: zone.dossier.sections,
        members: zone.members ?? [],
      },
      ringData: {
        systemName: "The Kuiper Belt",
        order: `${index + 1} of ${REGION_ZONES.length} zones, from Neptune outward`,
        character: zone.type,
        description: zone.description,
        radialRange: zone.span,
        motion: zone.speed,
      },
    };
    group.add(marker);
    markers.push(marker);
    hoverTargets?.push(marker);
  });
  return markers;
}

export function createKuiperBelt({
  world,
  hoverTargets = null,
  quality = "medium",
  pixelRatio = 1,
} = {}) {
  const profile = QUALITY[quality] ?? QUALITY.medium;
  const group = new THREE.Group();
  group.name = "Kuiper Belt population";

  const layers = [];
  POPULATIONS.forEach((population, index) => {
    const count = population.haze
      ? profile.haze
      : Math.max(180, Math.round(profile.points * population.share));
    const points = buildPopulation(population, count, 0x4b554950 + index * 7919);
    group.add(points);
    layers.push(points);
  });

  const glow = createBeltGlow();
  group.add(glow);
  group.userData.glow = glow;

  group.userData.regionMarkers = createRegionMarkers({ group, hoverTargets });

  group.userData.layers = layers;
  group.userData.sizeScale = profile.sizeScale;
  group.userData.pixelRatio = pixelRatio;
  group.userData.drawn = true;
  group.userData.physicalModel = {
    innerEdgeAu: 30,
    classicalBeltAu: [42, 47.7],
    kuiperCliffAu: 47.7,
    scatteredDiskAu: [50, 150],
    populations: POPULATIONS.map((p) => ({ id: p.id, name: p.name, aAu: [p.aMin, p.aMax] })),
  };

  world.add(group);
  applyKuiperBeltQuality(group, quality, pixelRatio);
  return group;
}

export function applyKuiperBeltQuality(belt, quality = "medium", pixelRatio = 1) {
  if (!belt) return;
  const profile = QUALITY[quality] ?? QUALITY.medium;
  belt.userData.sizeScale = profile.sizeScale;
  belt.userData.pixelRatio = Math.min(Number(pixelRatio) || 1, 2);
  belt.userData.layers?.forEach((points) => {
    const uniforms = points.material?.uniforms;
    if (!uniforms) return;
    uniforms.uPixelRatio.value = belt.userData.pixelRatio;
    uniforms.uSizeScale.value = profile.sizeScale;
  });
}

export function updateKuiperBelt(belt, motionScale = 1, camera = null) {
  if (!belt) return;

  if (camera) {
    /*
     * gl_PointSize needs the projection's vertical scale and the drawing
     * buffer's height, and both can change -- a resize, a device-pixel-ratio
     * change, a field-of-view change during a cinematic move. Read per frame;
     * it is two multiplications.
     */
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const projScale = camera.projectionMatrix.elements[5] * height * 0.5;

    /*
     * There was a distance fade here and it was measuring the wrong distance.
     *
     * `belt.getWorldPosition` returns the group's origin, and the group sits
     * at the world origin -- on the Sun. So the fade was asking "how far is
     * the camera from the Sun?" and hiding the belt whenever the answer was
     * small. Standing 304 units out, where the nearest belt object is still
     * over fifteen hundred units away and the ring fills the sky ahead, the
     * belt was switched off. Measured in the browser: fade 0, visible false,
     * camera-to-origin 304.
     *
     * A ring has no single distance to be far from. The honest test is
     * apparent size, and gl_PointSize already applies it per object, with a
     * one-pixel floor so nothing winks out and a 3.4-pixel ceiling so a close
     * pass does not turn 100 km bodies into blobs. Seven draw calls is not
     * worth a second, worse test on top of that -- the main asteroid belt
     * draws five times as many points unconditionally.
     *
     * Seeing the belt from the inner system is also the point. It is what
     * gives the Solar System a visible edge.
     */
    belt.userData.layers?.forEach((points) => {
      const uniforms = points.material?.uniforms;
      if (!uniforms) return;
      uniforms.uProjScale.value = projScale;
      uniforms.uFade.value = 1;
    });
  }

  /*
   * Motion, and an admission about it.
   *
   * A real Kuiper Belt object takes between 250 and 300 years to go round,
   * and a scattered-disk object can take thousands. Nothing here would move a
   * pixel during a session, so this rotates each population as a rigid sheet
   * rather than advancing ten thousand objects along their own ellipses every
   * frame. The ordering is right -- inner populations lead -- and the cost is
   * six numbers instead of thirty thousand.
   */
  belt.userData.layers?.forEach((points, index) => {
    points.rotation.y += (0.0000082 - index * 0.0000009) * motionScale;
  });

  /*
   * The highlight, eased rather than switched.
   *
   * A band this large snapping to full brightness reads as a bug; a quarter
   * of a second of rise reads as the region answering. Rising faster than it
   * falls, because acquiring should feel immediate and letting go should not
   * flicker when the cursor crosses a boundary.
   */
  const target = belt.userData.hiliteTarget ?? 0;
  const current = belt.userData.hilite ?? 0;
  const eased = THREE.MathUtils.lerp(current, target, target > current ? 0.18 : 0.09);
  belt.userData.hilite = Math.abs(eased - target) < 0.002 ? target : eased;

  const inner = belt.userData.hiliteIn ?? 0;
  const outer = belt.userData.hiliteOut ?? 0;
  const push = (material) => {
    const u = material?.uniforms;
    if (!u?.uHilite) return;
    u.uHilite.value = belt.userData.hilite;
    u.uHiliteIn.value = inner;
    u.uHiliteOut.value = outer;
  };
  belt.userData.layers?.forEach((points) => push(points.material));
  push(belt.userData.glow?.material);
}

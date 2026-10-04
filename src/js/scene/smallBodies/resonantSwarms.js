import * as THREE from "three";

/**
 * Jupiter's Trojan swarms and the Hilda triangle, as clouds of points.
 *
 * Rank 9 of `docs/bodies-to-draw-next.md` calls the Trojans "the biggest
 * missing structure": two swarms of more than ten thousand known bodies
 * (11,552 registered with the Minor Planet Center on 26 January 2022, Li et
 * al. 2023, A&A 669, A68) sixty degrees ahead of and behind Jupiter, and no
 * sign of them in the scene. The named Trojans in `trojanCatalogue.js` are
 * drawn on their real orbits; this is the population around them.
 *
 * **It is a statistical picture, not a catalogue.** The MPC's element lists
 * could not be downloaded from where this was built, so each point is drawn
 * from the distributions the observed population follows, and nothing here
 * is a particular asteroid. What is measured and what is chosen:
 *
 *   L4 : L5 = 1.6            Li et al. 2023's debiased ratio, 1.6 ± 0.1 (the
 *                            raw count is about 1.8).
 *   inclinations            Rayleigh, sigma 12.3 degrees -- which puts 95%
 *                            below 30 degrees, as Li et al. 2023 report for
 *                            the real swarms -- capped at 50 degrees, their
 *                            observed maximum.
 *   libration amplitudes    chosen: 4 to 34 degrees, weighted to the small
 *                            end. The swarm is a tadpole round L4 or L5, and
 *                            a point's longitude is the Lagrange point plus
 *                            its amplitude times a random phase.
 *   eccentricities          chosen: up to 0.14, uniform. The real swarm
 *                            reaches 0.3 but thins out well before.
 *   the radial breathing    chosen: 0.9% of a per 10 degrees of amplitude,
 *                            in step with the libration phase, which is the
 *                            size of the tadpole's radial width.
 *
 * The Hildas are drawn the way the triangle actually arises, not as a
 * triangle: each point is a body in the 3:2 resonance, a = 3.97 AU (153
 * Hilda's own, JPL SBDB), eccentricity 0.08-0.28 and inclination Rayleigh
 * sigma 6 degrees (both chosen, to the group's spread), at a random moment
 * over two of Jupiter's orbits -- the time its path in Jupiter's frame takes
 * to close. Its conjunctions with Jupiter fall at its perihelion (the
 * resonant angle 3 lambda_J - 2 lambda - varpi librates about 0), so it
 * spends its slow aphelion time near L3, L4 and L5 and the population piles
 * up there. The triangle is what that looks like; it is not drawn in.
 * There are more than 6,000 Hildas (Wikipedia, "Hilda asteroid").
 *
 * ## Hover and the record
 *
 * Three populations, three point clouds (L4, L5, the Hildas), each with an
 * invisible band on the pointer layer that the scene's region hover already
 * understands: hover one and that whole population lights up and a card
 * says what it is -- and that it orbits the Sun, not Jupiter; click it and
 * its record opens. The board has a matching entry, "Jupiter's Trojans &
 * Hildas", which opens an animated explanation (ui/jupiterCompanyView.js).
 *
 * ## Cost
 *
 * Three `Points` objects, three draw calls, 5,600 vertices, built once.
 * They hang in Jupiter's co-orbital frame and are turned once a frame so
 * the clouds keep their place relative to the drawn Jupiter -- one
 * rotation, nothing per point. The clouds themselves are never raycast.
 */

const TROJAN_POINTS = 4200;
const L4_SHARE = 1.6 / 2.6;
const HILDA_POINTS = 1400;
const HILDA_A_AU = 3.968376768101129;

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;

function rayleigh(rand, sigma, cap) {
  for (;;) {
    const x = sigma * Math.sqrt(-2 * Math.log(1 - rand() * 0.999999));
    if (x <= cap) return x;
  }
}

function keplerE(M, e) {
  let E = M;
  for (let i = 0; i < 8; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/*
 * What each population is, for its hover card and its record. The numbers
 * are the ones in this file's header; the hover card and the dossier are
 * the shapes main.js already fills for the Kuiper Belt's zones (isRegion,
 * ringData, region), so these need no new UI there.
 */
const POPULATIONS = Object.freeze({
  L4: {
    name: "Jupiter's Trojans · L4, the Greek camp",
    short: "L4 Trojans",
    order: "60° ahead of Jupiter",
    character: "Swarm sharing Jupiter's orbit",
    span: "About 5.2 AU from the Sun, spread some 30° either side of the point 60° ahead of Jupiter",
    motion: "Round the Sun once every 11.9 years — Jupiter's own year — while drifting slowly about the L4 point over 150 years or so",
    population: "The larger camp: about 1.6 Trojans here for every one at L5 (Li et al. 2023)",
    lede: "Thousands of asteroids on Jupiter's own orbit, travelling 60° ahead of it. They go round the Sun, not round Jupiter — but at this one place the Sun's pull and Jupiter's balance, so a body can share Jupiter's path for billions of years without ever meeting it.",
    members: [
      { body: "Hektor", order: "Largest Trojan", character: "Two lobes and a moon", range: "250 km", note: "Two lobes of 220 and 183 km stuck together, with a 12 km moon, Skamandrios.", motion: "One orbit in about 12 years" },
      { body: "Eurybates", order: "Lucy, 12 Aug 2027", character: "Grey family head", range: "69 km", note: "The largest piece of the only collisional family among the Trojans, with a 1 km moon, Queta.", motion: "One orbit in about 12 years" },
      { body: "Polymele", order: "Lucy, 15 Sep 2027", character: "Flattened, with a moon", range: "21 km", note: "A squashed disc about 27 × 24 × 10 km; its moon was found when it passed in front of a star.", motion: "One orbit in about 12 years" },
      { body: "Leucus", order: "Lucy, 18 Apr 2028", character: "A very slow spinner", range: "41 km", note: "Takes about 446 hours to turn once.", motion: "One orbit in about 12 years" },
      { body: "Orus", order: "Lucy, 11 Nov 2028", character: "Spins backwards", range: "60 km", note: "A crater near its north pole is hinted at by its lightcurve.", motion: "One orbit in about 12 years" },
    ],
  },
  L5: {
    name: "Jupiter's Trojans · L5, the Trojan camp",
    short: "L5 Trojans",
    order: "60° behind Jupiter",
    character: "Swarm sharing Jupiter's orbit",
    span: "About 5.2 AU from the Sun, spread some 30° either side of the point 60° behind Jupiter",
    motion: "Round the Sun once every 11.9 years — Jupiter's own year — while drifting slowly about the L5 point",
    population: "The smaller camp: about one Trojan here for every 1.6 at L4 (Li et al. 2023)",
    lede: "The second swarm, 60° behind Jupiter on its orbit. Like the first, they orbit the Sun, held at this balance point by Jupiter and the Sun together. Why this camp has fewer members than the other is still argued about.",
    members: [
      { body: "Patroclus", order: "Lucy, 2 Mar 2033", character: "A near-equal binary", range: "113 km + 104 km", note: "Patroclus and Menoetius, two near-twins going round each other every 4.28 days — Lucy's last target.", motion: "One orbit in about 12 years" },
    ],
  },
  HILDA: {
    name: "The Hildas · 3:2 with Jupiter",
    short: "Hildas",
    order: "Between the asteroid belt and Jupiter",
    character: "Resonant group tracing a triangle",
    span: "About 3.4 to 4.6 AU from the Sun",
    motion: "Round the Sun exactly three times for every two of Jupiter's orbits, about 7.9 years each",
    population: "More than 6,000 known (Wikipedia, “Hilda asteroid”)",
    lede: "Asteroids that go round the Sun three times for every two orbits of Jupiter. They always meet Jupiter at their closest point to the Sun — as far from Jupiter as they ever get — so it never throws them out. Seen from Jupiter, the whole group bunches near three points and traces a slowly turning triangle.",
    members: [
      { body: "Hilda", order: "Gives the group its name", character: "Dark, 171 km", range: "3.4-4.5 AU", note: "Found by Johann Palisa in 1875.", motion: "One orbit in about 7.9 years" },
    ],
  },
});

const SECTIONS = Object.freeze([
  ["Not Jupiter's moons", "None of these goes round Jupiter. Every one goes round the Sun, on its own orbit. What Jupiter does is decide where those orbits are allowed to be: its gravity keeps the Trojans gathered at two balance points on its path, and keeps the Hildas in step three-to-two."],
  ["How the balance works", "Sixty degrees ahead of a planet and sixty behind, the pulls of the Sun and the planet combine to point at the Sun's and planet's shared centre with exactly the strength needed to go round at the planet's own speed. A body there keeps pace with the planet indefinitely, wobbling slowly around the point (Lagrange's L4 and L5)."],
  ["What is drawn", "A statistical picture, not a catalogue: 5,600 points drawn from the distributions the real populations follow (Li et al. 2023), in Jupiter's own frame so they stay with the drawn Jupiter. The named bodies inside them are on their real orbits."],
]);

/**
 * `model` is Jupiter's modelled orbit (smallBodies.js); `auToScene` the
 * scene's radial curve; `hoverTargets` gets the three invisible region
 * markers. Points are authored with Jupiter at longitude zero; the caller
 * turns the group to Jupiter's longitude every frame.
 */
export function createResonantSwarms({ model, auToScene, hoverTargets = null, markPointerProxy = null }) {
  const aJ = model.aAU;
  const rand = mulberry32(624617);
  const buffers = { L4: [], L5: [], HILDA: [] };

  const push = (key, rAU, longitude, latitude, shade) => {
    const r = auToScene(rAU);
    const cosB = Math.cos(latitude);
    buffers[key].push(r * cosB * Math.cos(longitude), r * Math.sin(latitude), r * cosB * Math.sin(longitude), shade);
  };

  for (let i = 0; i < TROJAN_POINTS; i += 1) {
    const leading = rand() < L4_SHARE;
    const centre = (leading ? 60 : -60) * DEG;
    const amplitude = (4 + 30 * Math.pow(rand(), 1.6)) * DEG;
    const phase = rand() * Math.PI * 2;
    /* The tadpole is lopsided: it reaches further from Jupiter than toward
     * it, so the side facing Jupiter is squeezed. */
    const swing = Math.sin(phase);
    const towardJupiter = leading ? swing < 0 : swing > 0;
    const longitude = centre + amplitude * swing * (towardJupiter ? 0.72 : 1.0);
    const a = aJ * (1 + 0.009 * (amplitude / (10 * DEG)) * Math.cos(phase));
    const e = rand() * 0.14;
    const E = rand() * Math.PI * 2;
    const r = a * (1 - e * Math.cos(E));
    const inc = rayleigh(rand, 12.3, 50) * DEG;
    const latitude = Math.asin(Math.sin(inc) * Math.sin(rand() * Math.PI * 2));
    push(leading ? "L4" : "L5", r, longitude, latitude, rand());
  }

  /* Time in Jupiter periods; the Hilda goes round 1.5 times per period. */
  for (let i = 0; i < HILDA_POINTS; i += 1) {
    const t = rand() * 2;
    const lambdaJ = t * Math.PI * 2;
    const e = 0.08 + rand() * 0.20;
    /* Libration of the resonant angle, up to about 30 degrees either way. */
    const varpi = (rand() - 0.5) * 60 * DEG;
    const M = (t * 1.5) * Math.PI * 2;
    const E = keplerE(M % (Math.PI * 2), e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    const r = HILDA_A_AU * (1 - e * Math.cos(E));
    const inc = rayleigh(rand, 6, 20) * DEG;
    const latitude = Math.asin(Math.sin(inc) * Math.sin(rand() * Math.PI * 2));
    push("HILDA", r, varpi + nu - lambdaJ, latitude, rand());
  }

  /*
   * Additive, and in the main belt's warm grey rather than a dark brown.
   *
   * Reported: from far out the clouds looked black and covered the Sun.
   * They were drawn with normal blending in a dim D-type brown, so where
   * they crossed the Sun they replaced its light with something darker.
   * Light that adds can only brighten what is behind it, so the swarms now
   * read as the belt does -- faint dust -- and can never put a hole in the
   * Sun. The two camps keep a trace of the Trojans' red; the Hildas are
   * greyer, as the P- and X-types are.
   */
  const colours = {
    L4: new THREE.Color(0xd9b48c),
    L5: new THREE.Color(0xd9b48c),
    HILDA: new THREE.Color(0xbdb4a8),
  };

  const group = new THREE.Group();
  group.name = "Jupiter resonant populations";
  const layers = {};
  Object.entries(buffers).forEach(([key, data]) => {
    const count = data.length / 4;
    const positions = new Float32Array(count * 3);
    const tint = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = data[i * 4];
      positions[i * 3 + 1] = data[i * 4 + 1];
      positions[i * 3 + 2] = data[i * 4 + 2];
      const shade = 0.55 + 0.6 * data[i * 4 + 3];
      tint[i * 3] = colours[key].r * shade;
      tint[i * 3 + 1] = colours[key].g * shade;
      tint[i * 3 + 2] = colours[key].b * shade;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(tint, 3));
    geometry.computeBoundingSphere();
    const material = new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `${POPULATIONS[key].short} cloud`;
    points.raycast = () => {};
    points.renderOrder = -14;
    group.add(points);
    layers[key] = { points, material, hilite: 0, hiliteTarget: 0 };
  });

  /*
   * Hover: an invisible band per population, on the pointer layer, so the
   * cursor can find "the L4 swarm" anywhere inside it. Hovering lights that
   * whole population (see `updateResonantSwarms`) and shows the card;
   * clicking opens its record. The bodies inside still win the pointer:
   * this is the same arrangement as the Kuiper Belt's zones.
   */
  const markers = [];
  const band = (key, innerAu, outerAu, fromDeg, spanDeg) => {
    const inner = auToScene(innerAu);
    const outer = auToScene(outerAu);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 96, 1, fromDeg * DEG, spanDeg * DEG),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }),
    );
    marker.rotation.x = Math.PI * 0.5;
    marker.name = `${POPULATIONS[key].short} region field`;
    markPointerProxy?.(marker);
    const pop = POPULATIONS[key];
    marker.userData = {
      name: pop.name,
      detail: pop.character,
      isRegion: true,
      isResonantPopulation: true,
      regionId: `jupiter-${key.toLowerCase()}`,
      visualRadius: (outer - inner) * 0.5,
      focusVisualRadius: outer,
      info: {
        type: "Asteroid population · orbits the Sun",
        description: pop.lede,
        diameter: pop.span,
        orbitalSpeed: pop.motion,
        sizeComparison: pop.population,
      },
      setHovered(active) {
        layers[key].hiliteTarget = active ? 1 : 0;
      },
      region: {
        systemName: "Jupiter's company",
        subtitle: pop.order,
        lede: pop.lede,
        span: pop.span,
        period: pop.motion,
        population: pop.population,
        sections: SECTIONS,
        members: pop.members,
      },
      ringData: {
        systemName: "Jupiter's company · orbits the Sun, shepherded by Jupiter",
        order: pop.order,
        character: pop.character,
        description: pop.lede,
        radialRange: pop.span,
        motion: pop.motion,
      },
    };
    group.add(marker);
    markers.push(marker);
    hoverTargets?.push(marker);
  };
  /* L4 and L5: Jupiter's distance +-0.4 AU, 25 to 100 degrees from it. */
  band("L4", 4.8, 5.6, 25, 75);
  band("L5", 4.8, 5.6, -100, 75);
  /* The Hildas: their whole band. */
  band("HILDA", 3.4, 4.6, 0, 360);

  return {
    group,
    layers,
    markers,
    points: layers.L4.points,
    trojanCount: TROJAN_POINTS,
    hildaCount: HILDA_POINTS,
    /* Jupiter's orbit on screen, for the far fade below. */
    ringRadius: auToScene(aJ),
    baseOpacity: 0.42,
    fade: 1,
  };
}

/*
 * Per frame: the far fade and the hover highlight.
 *
 * From the outermost view Jupiter's orbit is under a hundred pixels across
 * and the swarms are a smudge on the Sun's doorstep that says nothing, so
 * the clouds fade while Jupiter's orbit shrinks from 90 pixels across to 30
 * and are hidden outright (no draw calls) after that. A hovered population
 * is lifted to full brightness and larger points, eased.
 */
const FADE_FULL_PX = 90;
const FADE_GONE_PX = 30;
export function updateResonantSwarms(swarms, camera, viewportHeight) {
  if (!swarms || !camera) return;
  const distance = Math.max(1e-3, camera.position.length());
  const focalPixels = camera.projectionMatrix.elements[5] * (viewportHeight || 800) * 0.5;
  const ringPixels = (swarms.ringRadius / distance) * focalPixels * 2;
  const t = Math.min(1, Math.max(0, (ringPixels - FADE_GONE_PX) / (FADE_FULL_PX - FADE_GONE_PX)));
  const fade = t * t * (3 - 2 * t);
  swarms.fade = fade;
  const layers = Object.values(swarms.layers);
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    if (layer.hilite !== layer.hiliteTarget) {
      layer.hilite += (layer.hiliteTarget - layer.hilite) * 0.18;
      if (Math.abs(layer.hilite - layer.hiliteTarget) < 0.01) layer.hilite = layer.hiliteTarget;
    }
    const opacity = swarms.baseOpacity * fade * (1 + 1.2 * layer.hilite);
    layer.points.visible = opacity > 0.002;
    if (Math.abs(layer.material.opacity - opacity) > 0.002) layer.material.opacity = opacity;
    const size = 1.6 + 1.2 * layer.hilite;
    if (layer.material.size !== size) layer.material.size = size;
  }
}

import * as THREE from "three";
import { markPointerProxy } from "../scene/pointerProxies.js";

/**
 * The two ring systems nobody expected to exist.
 *
 * Rings were a giant-planet phenomenon until 2017, when a stellar occultation
 * caught one around Haumea -- a body a fiftieth of Neptune's diameter. Quaoar
 * turned out to have two, found the same way in 2023, and those are the ones
 * that broke the theory: **both orbit outside Quaoar's Roche limit**, at radii
 * where the material should long since have gathered itself into a moon and
 * did not. Nobody has a settled explanation.
 *
 * Built the way Saturn's and Uranus's are built here, and for the same reason:
 * a ring is not a translucent disc, it is a swarm of independent bodies each
 * on its own orbit. Drawn as a flat annulus it reads as a decal stuck over the
 * picture -- hard inner and outer edges no real ring has, no depth, no
 * occlusion. Drawn as particles it foreshortens correctly, the body passes in
 * front of the near arc and behind the far one, and the density falls off at
 * both edges because the particles do.
 *
 * Every radius here is measured, from the occultation light curves. So is the
 * fact that Quaoar's rings are absurdly far out: Q1R sits at 7.4 body radii,
 * where Saturn's main rings stop at about 2.3.
 */

const ICY_RING_SYSTEMS = {
  Haumea: {
    systemName: "Haumea ring system",
    // Mean radius 772 km, so the ring at 2,287 km is just under three radii.
    bodyRadiusKm: 772,
    tilt: 0.1400,
    rings: [
      {
        name: "Haumea's Ring",
        centreKm: 2287,
        widthKm: 70,
        colour: 0xcfe0ee,
        opacity: 0.62,
        particles: 2600,
        grain: 1.05,
        kind: "Narrow icy ring in 3:1 spin–orbit resonance",
        motion: "Water-ice debris · one orbit for every three of Haumea's 3.9-hour rotations",
        description: "The first ring ever found around a trans-Neptunian object, detected when Haumea passed in front of a star in January 2017. It lies in Haumea's equatorial plane and sits in a 3:1 resonance with the body's own rotation, which is almost certainly what holds it together. It has never been given a formal designation.",
      },
    ],
  },
  /*
   * Chariklo, and the discovery that started all of this.
   *
   * Haumea's ring was found in 2017 and Quaoar's in 2023; Chariklo's came
   * first, in June 2013, and it is the reason anybody went looking. A star
   * passed behind it and winked twice on the way in and twice on the way
   * out, thirteen seconds either side of the body, from every telescope in
   * South America that was watching. A 250 km asteroid is not supposed to be
   * able to hold a ring at all.
   *
   * The two are informally Oiapoque and Chuí, after the northernmost and
   * southernmost towns in Brazil, proposed by the discovery team. Neither
   * name is IAU-approved.
   *
   * Radii and widths: Morgado et al. 2021, A&A 652, A141, from occultations
   * observed between 2013 and 2020 -- C1R at 390.6 km with a width that
   * varies between 4.8 and 9.1 km around a mean of 6.5, C2R 14 km further
   * out. Optical depths are from the discovery paper, Braga-Ribas et al.
   * 2014, Nature 508, 72: about 0.4 for C1R and 0.06 for C2R, which is why
   * one of them is drawn six times as strongly as the other.
   *
   * Tilt is zero here and not a mistake. Every other system in this file
   * carries its own obliquity because its parent does not have one that is
   * known; Chariklo's pole *is* known, to half a degree, and the small-body
   * builder puts the whole body on it. The rings inherit it by being a child
   * of that tilt.
   */
  Chariklo: {
    systemName: "Chariklo ring system",
    /* Volume-equivalent radius, matching the figure the small-body builder
     * scales the mesh by -- so every kilometre here converts through the
     * same ratio the body does and the rings land where the star winked. */
    bodyRadiusKm: 124.5,
    tilt: 0,
    rings: [
      {
        name: "Oiapoque (C1R)",
        centreKm: 390.6,
        widthKm: 6.5,
        /* Brighter than the ground below it, and measurably so: ring albedo
         * 7.0 +/- 1.0 per cent against the body's 3.6 +/- 1.0. About a fifth
         * of the ring is water ice in grains under 100 microns, which is
         * what keeps it pale against an organic-rich body. */
        colour: 0xd3cec4,
        opacity: 0.66,
        particles: 2800,
        grain: 1.0,
        kind: "Dense narrow ring, optical depth ≈ 0.4",
        motion: "Sharply confined debris · 4.8 to 9.1 km wide, eccentricity below 0.022",
        description: "The first ring ever found around anything that is not a planet. It sits 390.6 km from Chariklo's centre — about 3.1 body radii — and is between 4.8 and 9.1 km wide depending on where you cut it, which is itself a hint that it is slightly eccentric. Roughly a fifth of it is water ice in grains under a tenth of a millimetre, and it reflects seven per cent of the light that reaches it against the body's 3.6, so for years Chariklo looked brighter than it should have and nobody knew why.",
      },
      {
        name: "Chuí (C2R)",
        centreKm: 404.8,
        widthKm: 3.4,
        colour: 0xc6c2ba,
        opacity: 0.20,
        particles: 1100,
        grain: 0.85,
        kind: "Faint outer ring, optical depth ≈ 0.06",
        motion: "Thin and tenuous · 14 km outside its companion",
        description: "The outer and much fainter of the two, 14 km beyond Oiapoque. Its optical depth is about 0.06 against its companion's 0.4, and averaged over all the occultations its equivalent width is only 117 metres — which is to say most of what a star passing behind it sees is empty space. What confines two rings this narrow, this close together, with a clean gap between them, is not settled; a small shepherding moon has been looked for and not found.",
      },
    ],
  },
  /*
   * Chiron, where the same phenomenon appears to be caught in the act.
   *
   * Material has been showing up around Chiron in occultation light curves
   * since 1994, and the reason it is drawn separately from Chariklo's is
   * that it does not stay put. Pereira et al. 2025 (ApJL 992, L19) compare
   * every epoch on record and find three confined rings at 273, 325 and
   * 438 km, a broad disc-like structure spanning roughly 200 to 800 km, and
   * a faint feature near 1,380 -- none of them permanent. Chariklo's rings
   * have looked the same for a decade. Chiron's appear, thicken and move,
   * which is what you would expect of a ring system still being assembled
   * out of the debris of the body's own outbursts.
   *
   * The widths are the weakest number here. The occultation chords constrain
   * the radii tightly and the widths only loosely, so the three narrow rings
   * are drawn at 10 km, which is the right order and not a measurement. The
   * card says so.
   */
  Chiron: {
    systemName: "Chiron ring system",
    bodyRadiusKm: 98,
    tilt: 0,
    rings: [
      {
        name: "Chiron inner ring",
        centreKm: 273,
        widthKm: 10,
        colour: 0xbfd6e2,
        opacity: 0.30,
        particles: 1500,
        grain: 0.9,
        kind: "Innermost confined ring · 2.8 body radii",
        motion: "Not permanent · absent in some epochs, present in others",
        description: "The innermost of the three confined rings, at 273 km. It is not in every occultation light curve: the material around Chiron changes between epochs in a way Chariklo's never has, which is the single most interesting thing about it.",
      },
      {
        name: "Chiron main ring",
        centreKm: 325,
        widthKm: 10,
        colour: 0xcfe2ec,
        opacity: 0.44,
        particles: 2000,
        grain: 1.0,
        kind: "The strongest detection · 3.3 body radii",
        motion: "Seen across several epochs · the most consistently detected of the three",
        description: "The best-attested ring, first proposed from the 2011 occultation and recovered repeatedly since. At 325 km it sits at almost exactly the same number of body radii as Chariklo's Oiapoque does — 3.3 against 3.1 — which is one of the arguments that the two systems form by the same mechanism.",
      },
      {
        name: "Chiron outer ring",
        centreKm: 438,
        widthKm: 10,
        colour: 0xb6ccd8,
        opacity: 0.26,
        particles: 1400,
        grain: 0.95,
        kind: "Outermost confined ring · 4.5 body radii",
        motion: "Variable · part of a system that is still changing",
        description: "The outermost of the three, at 438 km. Beyond it the occultations see no sharp edge but a broad haze that reaches out to around 800 km, and a faint something near 1,380 km that nobody has explained.",
      },
      {
        name: "Chiron debris disc",
        centreKm: 500,
        widthKm: 600,
        /* Not a ring: excluded from the figure the camera frames on. */
        diffuse: true,
        colour: 0x92aec0,
        opacity: 0.055,
        particles: 2200,
        grain: 0.8,
        kind: "Broad diffuse structure, 200-800 km",
        motion: "Unconfined dust · the raw material the rings appear to be forming out of",
        description: "Not a ring but a haze: a broad disc-like structure spanning roughly 200 to 800 km from the body, found alongside the three narrow rings. Chiron outbursts, and an outburst at 25 m/s escape velocity throws material off permanently. The most natural reading of the whole system is that this disc is the debris and the narrow rings are what parts of it are settling into.",
      },
    ],
  },
  Quaoar: {
    systemName: "Quaoar ring system",
    bodyRadiusKm: 545,
    tilt: 0.1200,
    rings: [
      {
        name: "Q2R",
        centreKm: 2520,
        widthKm: 10,
        colour: 0xdccbb8,
        opacity: 0.46,
        particles: 1700,
        grain: 0.9,
        kind: "Inner narrow ring",
        motion: "Dense, sharply confined debris · about ten kilometres wide",
        description: "The inner of Quaoar's two rings, found in the same 2023 occultation campaign as Q1R. Barely ten kilometres across, and — like its companion — orbiting comfortably outside the distance at which Quaoar's tides should have let the material gather into a moon.",
      },
      {
        name: "Q1R",
        centreKm: 4057,
        widthKm: 60,
        colour: 0xe6d6c4,
        opacity: 0.58,
        particles: 2400,
        grain: 1.15,
        kind: "Outer ring, far beyond the Roche limit",
        motion: "Clumped, uneven debris · dense arcs separated by near-empty stretches",
        description: "Quaoar's outer ring, at 7.4 body radii — more than three times further out than Quaoar's Roche limit, where standard theory says ring material cannot survive as a ring. It is markedly clumpy, with dense arcs and near-empty gaps, and it is close to a 1:3 resonance with Quaoar's rotation. Explaining why it has not collapsed into a moon is an open problem.",
      },
    ],
  },
};

export function hasIcyRingSystem(name) {
  return Object.prototype.hasOwnProperty.call(ICY_RING_SYSTEMS, name);
}

function makeGrainTexture() {
  /*
   * No canvas, no grain -- and that is fine.
   *
   * This module was only ever reached from `planetFactory`, which only runs
   * in a browser. It is now also reached from the small-body builder, and
   * that one is exercised headless by `scripts/check-small-bodies.mjs`,
   * where there is no `document` and no WebGL context either. A null map is
   * safe there precisely because nothing compiles the shader that would
   * sample it; in a browser this branch is never taken.
   */
  if (typeof document === "undefined") return null;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0.00, "rgba(255,255,255,1)");
  gradient.addColorStop(0.34, "rgba(255,255,255,0.82)");
  gradient.addColorStop(0.66, "rgba(255,255,255,0.20)");
  gradient.addColorStop(1.00, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const RING_VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixel;
  uniform float uHover;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha * uOpacity * (1.0 + uHover * 0.9);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float depth = max(0.0001, -viewPosition.z);
    /*
     * A floor on the projected size, because these rings are a few hundred
     * scene units across at most and without one every grain falls under a
     * pixel the moment the camera pulls back -- which is exactly when the
     * whole ring is on screen and most worth seeing. The ceiling stops a
     * close pass turning each grain into a blob.
     */
    gl_PointSize = clamp(aSize * uPixel * (140.0 / depth), 1.1, 5.5);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const RING_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColour;
  varying float vAlpha;
  void main() {
    float mask = texture2D(uMap, gl_PointCoord).a;
    float alpha = mask * vAlpha;
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

/** [inner, outer] minus a set of [inner, outer] bands, as the gaps left. */
function subtractBands([inner, outer], holes) {
  const sorted = holes
    .filter(([a, b]) => b > inner && a < outer)
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cursor = inner;
  sorted.forEach(([a, b]) => {
    if (a > cursor) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  });
  if (cursor < outer) gaps.push([cursor, outer]);
  // Slivers are not worth a draw-free mesh each; nothing hovers a hairline.
  return gaps.filter(([a, b]) => b - a > (outer - inner) * 0.01);
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Builds one body's rings as real orbiting debris.
 *
 * `radius` is the body's rendered radius, which stands for its mean physical
 * radius -- so every measured kilometre figure converts through one ratio and
 * the rings land where the occultations put them.
 */
/*
 * `planet` is where the rings hang; `owner` is whose they are.
 *
 * For a planet those are the same object and `owner` can be left out. For a
 * small body they are not, and getting it wrong broke three separate things
 * at once. The rings have to be parented to the body's *tilt* group, because
 * that is what carries the measured pole and is the only way the rings end
 * up in the body's equator where the occultations found them -- but the tilt
 * group is an unnamed transform with no userData. Clicking a ring reads
 * `parentPlanetObject` to decide whose dossier to open and what to focus, so
 * with the tilt group in that slot the dossier was queued for a body called
 * "Chariklo tilt" and never opened; the camera focused a node carrying the
 * body's obliquity, so the whole view came in rotated; there was no
 * `focusDistance` or `visualRadius` on it, so the framing fell back to
 * defaults and the body shrank; and nothing in the orbit registry matched
 * the focused object, so every guide in the scene dropped to its dim
 * baseline. All four were one wrong reference.
 */
export function createIcyRingSystem({
  planet,
  owner = null,
  config,
  radius,
  hoverTargets = [],
  pixelRatio = 1,
}) {
  const system = ICY_RING_SYSTEMS[config.name];
  if (!system) return null;

  const group = new THREE.Group();
  group.name = `${config.name} ring system`;
  const random = makeRandom(config.name.length * 7919 + 31);
  const grainTexture = makeGrainTexture();
  const fields = [];
  const disposables = grainTexture ? [grainTexture] : [];
  const perKm = radius / system.bodyRadiusKm;

  const interactionTargets = [];
  /* A ring's pointer band, in scene units: the drawn width, padded out to a
   * minimum so a ten-kilometre ring is still something a cursor can land on.
   * See the note on the pad below for why a fifth of a body radius. */
  const hitBandFor = (ring) => {
    const centre = ring.centreKm * perKm;
    const halfWidth = Math.max(radius * 0.006, (ring.widthKm * perKm) / 2);
    const minHit = radius * 0.20;
    const pad = Math.max(0, (minHit - halfWidth * 2) * 0.5);
    return [Math.max(radius * 1.02, centre - halfWidth - pad), centre + halfWidth + pad];
  };

  system.rings.forEach((ring, index) => {
    const centre = ring.centreKm * perKm;
    const halfWidth = Math.max(radius * 0.006, (ring.widthKm * perKm) / 2);
    const count = ring.particles;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const angle = random() * Math.PI * 2;
      /*
       * Radially, particles cluster toward the middle of the ring and thin
       * out at both edges -- a real ring has no hard boundary, and the
       * squared random is what produces that profile for free.
       */
      const offset = (random() + random() - 1) * halfWidth;
      const r = centre + offset;
      /*
       * Q1R is conspicuously clumpy in the occultation data: dense arcs with
       * near-empty stretches between them. Modulating the alpha by azimuth
       * reproduces that rather than a uniform band.
       */
      const clump = ring.name === "Q1R"
        ? 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(angle * 1.5 + 0.7)), 1.6)
        : 1;
      positions[i3] = Math.cos(angle) * r;
      // Vertical thickness: real rings are metres to kilometres thick against
      // thousands of kilometres of radius, so this is barely more than zero.
      positions[i3 + 1] = (random() - 0.5) * halfWidth * 0.16;
      positions[i3 + 2] = Math.sin(angle) * r;
      sizes[i] = ring.grain * (0.6 + Math.pow(random(), 2) * 1.5);
      alphas[i] = clump * (0.35 + random() * 0.65) * (1 - Math.abs(offset / halfWidth) * 0.55);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.computeBoundingSphere();

    const material = new THREE.ShaderMaterial({
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      uniforms: {
        uMap: { value: grainTexture },
        uColour: { value: new THREE.Color(ring.colour) },
        uOpacity: { value: ring.opacity },
        uPixel: { value: pixelRatio },
        uHover: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });

    const points = new THREE.Points(geometry, material);
    points.name = `${ring.name} particles`;
    points.frustumCulled = false;
    points.renderOrder = 4;
    group.add(points);
    fields.push({ points, material, ring });
    disposables.push(geometry, material);

    /*
     * An invisible annulus for the pointer to hit.
     *
     * Raycasting a Points cloud is unreliable at these sizes -- the ring is a
     * few pixels wide and the grains are sparse -- so hover and click go
     * through a solid ring of geometry that is never drawn. It is padded to a
     * minimum width so a ten-kilometre ring is still catchable.
     */
    /*
     * These bands are a few kilometres wide around a body a thousand across,
     * which projects to well under a pixel -- and Haumea's turns almost
     * edge-on. A ninth of the radius was still asking the viewer to land the
     * cursor inside a hairline while the system drifted. A fifth is a target
     * you can actually hit without being noticeably larger than the ring reads.
     */
    /*
     * The pieces of the annulus that answer the pointer.
     *
     * One piece for a narrow ring. For a `diffuse` band, the band *minus*
     * every narrow ring's own hit band -- and this is the whole of the fix
     * for Chiron, where hovering anywhere on the system reported the debris
     * disc and nothing else. The disc spans 200 to 800 km and the three
     * named rings sit at 273, 325 and 438, entirely inside it; the hit
     * annuli are coplanar, so the raycaster found two hits at the same
     * distance on every pixel and took whichever it met first, which was
     * always the disc. A narrow ring is the specific claim and the haze is
     * the general one, so the haze gives way: its target is cut into the
     * gaps between the rings and never competes with them.
     */
    const pieces = ring.diffuse
      ? subtractBands(hitBandFor(ring), system.rings.filter((other) => !other.diffuse).map(hitBandFor))
      : [hitBandFor(ring)];

    const targetMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    disposables.push(targetMaterial);
    const userData = {
      name: ring.name,
      isPlanetRing: true,
      ringIndex: index,
      parentPlanetObject: owner ?? planet,
      info: { type: `${config.name} ring`, description: ring.description },
      ringData: {
        systemName: system.systemName,
        order: `${index + 1} of ${system.rings.length} from ${config.name} outward`,
        character: ring.kind,
        radialRange: ring.diffuse
          ? `${Math.round(ring.centreKm - ring.widthKm / 2).toLocaleString("en-US")}–${Math.round(ring.centreKm + ring.widthKm / 2).toLocaleString("en-US")} km from ${config.name}'s centre · diffuse, no sharp edge`
          : `${ring.centreKm.toLocaleString("en-US")} km from ${config.name}'s centre · about ${ring.widthKm} km wide`,
        description: ring.description,
        motion: ring.motion,
      },
      setHovered(active) {
        material.uniforms.uHover.value = active ? 1 : 0;
      },
    };
    pieces.forEach(([inner, outer], pieceIndex) => {
      const targetGeometry = new THREE.RingGeometry(inner, outer, 192, 1);
      const target = new THREE.Mesh(targetGeometry, targetMaterial);
      target.name = pieces.length > 1
        ? `${ring.name} interaction field ${pieceIndex + 1}`
        : `${ring.name} interaction field`;
      markPointerProxy(target);
      target.rotation.x = Math.PI * 0.5;
      // Every piece is the same ring as far as the pointer is concerned.
      target.userData = userData;
      group.add(target);
      hoverTargets.push(target);
      interactionTargets.push(target);
      disposables.push(targetGeometry);
    });
  });

  /* Recorded so `applyRingProximityVisibility` can take the pointer annuli
   * out along with the rings. It reads this field and it was never set, so a
   * ring system that had faded out still answered hovers from a thousand
   * radii away -- for Haumea and Quaoar as well as the Centaurs. */
  group.userData.interactionTargets = interactionTargets;

  // The system inherits the body's obliquity: rings sit in the equator.
  group.rotation.z = system.tilt;
  planet.add(group);

  return {
    group,
    fields,
    /*
     * What a viewer has to be able to see, which is not the same as how far
     * the material reaches.
     *
     * Two corrections, both of which only started to matter when Chiron
     * arrived. `widthKm` is the *full* width -- the particle loop halves it
     * -- so adding the whole of it to the centre overstated the edge by half
     * a ring width. On a 10 km ring around a 500 km body that is a rounding
     * error; on Chiron's 600 km-wide debris disc it was 300 km of nothing.
     *
     * And a `diffuse` band is excluded outright. This figure is what the
     * camera frames on, and Chiron's disc is a haze with no edge that
     * reaches to eight body radii. Framing it would put the body at a
     * twenty-eighth of the screen to show a structure whose whole character
     * is that you cannot see where it stops. The confined rings are the
     * thing to frame; the haze can run off the edge, which is what haze does.
     */
    outerRadius: Math.max(
      ...system.rings
        .filter((ring) => !ring.diffuse)
        .map((ring) => (ring.centreKm + ring.widthKm * 0.5) * perKm),
    ),
    update(deltaSeconds) {
      // Slow differential rotation: the inner ring goes round faster, which is
      // Kepler's third law and the only motion these need.
      for (let i = 0; i < fields.length; i += 1) {
        const ring = fields[i].ring;
        fields[i].points.rotation.y += deltaSeconds * (0.045 / Math.sqrt(ring.centreKm / 2000));
      }
    },
    dispose() {
      disposables.forEach((item) => item.dispose?.());
    },
  };
}

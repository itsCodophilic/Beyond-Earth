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
export function createIcyRingSystem({ planet, config, radius, hoverTargets = [], pixelRatio = 1 }) {
  const system = ICY_RING_SYSTEMS[config.name];
  if (!system) return null;

  const group = new THREE.Group();
  group.name = `${config.name} ring system`;
  const random = makeRandom(config.name.length * 7919 + 31);
  const grainTexture = makeGrainTexture();
  const fields = [];
  const disposables = [grainTexture];
  const perKm = radius / system.bodyRadiusKm;

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
    const minHit = radius * 0.20;
    const pad = Math.max(0, (minHit - halfWidth * 2) * 0.5);
    const targetGeometry = new THREE.RingGeometry(
      Math.max(radius * 1.02, centre - halfWidth - pad),
      centre + halfWidth + pad,
      192,
      1,
    );
    const targetMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const target = new THREE.Mesh(targetGeometry, targetMaterial);
    target.name = `${ring.name} interaction field`;
    markPointerProxy(target);
    target.rotation.x = Math.PI * 0.5;
    target.userData = {
      name: ring.name,
      isPlanetRing: true,
      ringIndex: index,
      parentPlanetObject: planet,
      info: { type: `${config.name} ring`, description: ring.description },
      ringData: {
        systemName: system.systemName,
        order: `${index + 1} of ${system.rings.length} from ${config.name} outward`,
        character: ring.kind,
        radialRange: `${ring.centreKm.toLocaleString("en-US")} km from ${config.name}'s centre · about ${ring.widthKm} km wide`,
        description: ring.description,
        motion: ring.motion,
      },
      setHovered(active) {
        material.uniforms.uHover.value = active ? 1 : 0;
      },
    };
    group.add(target);
    hoverTargets.push(target);
    disposables.push(targetGeometry, targetMaterial);
  });

  // The system inherits the body's obliquity: rings sit in the equator.
  group.rotation.z = system.tilt;
  planet.add(group);

  return {
    group,
    fields,
    outerRadius: Math.max(
      ...system.rings.map((ring) => (ring.centreKm + ring.widthKm) * perKm),
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

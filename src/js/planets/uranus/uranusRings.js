import * as THREE from "three";

// Scratch vectors reused by the per-frame update below. Allocating a fresh
// Vector3 on every animation frame produced steady garbage-collector pressure,
// which surfaces as periodic frame-time spikes rather than a lower average FPS.
const uranusRingWorldPosition = new THREE.Vector3();

// Ring particle level of detail.
//
// Measured: hiding every planetary ring particle system doubled the frame rate
// in the outer system (29.9 -> 59.9 fps) while the triangle count stayed
// identical, so the cost is per-pixel, not per-vertex. Each particle is a
// blended sprite up to 8.4 * pixelRatio across, and uDistanceVisibility
// deliberately grows the sprites with distance to keep faint rings legible --
// which is exactly when the most of them are on screen at once.
//
// Rather than shrink the sprites (that is what makes the rings readable), draw
// proportionally fewer of them while the ring is small on screen. The ring keeps
// its shape, brightness profile and colour; it simply becomes sparser at the
// distance where individual grains were never resolvable anyway.
const RING_LOD = {
  // Projected ring radius, in pixels, at which the full population is drawn.
  fullDetailPixels: 420,
  // ...and at which the sparsest population is used.
  minimumDetailPixels: 55,
  minimumFraction: 0.14,
  // Below this the entire ring system is smaller than a couple of pixels and is
  // not drawn at all. Measured at the outer-system viewpoint: Uranus was 0.4px
  // across, its rings 0.8px, and 8,127 sprites were still being rendered --
  // each inflated to as much as 8.4 * pixelRatio by uDistanceVisibility, which
  // grows with distance by design. The result was millions of blended pixels
  // for an object under one pixel wide. Hysteresis avoids flicker at the edge.
  hideBelowPixels: 2.4,
  showAbovePixels: 3.2,
  // Decorative layers are pure overdraw at small sizes.
  haloBelowPixels: 110,
  glowBelowPixels: 150,
};

function setRingFieldDrawFraction(points, fraction) {
  if (!points?.geometry) return;
  const geometry = points.geometry;
  const total = geometry.userData.fullDrawCount
    ?? (geometry.userData.fullDrawCount = geometry.attributes.position?.count ?? 0);
  if (!total) return;
  const count = fraction >= 1
    ? total
    : Math.max(1, Math.ceil(total * fraction));
  if (geometry.drawRange.count !== count) geometry.setDrawRange(0, count);
}

/**
 * Scales every ring field by the ring's apparent size, and retires the purely
 * decorative halo/glow layers once they are too small to read.
 */
function applyUranusRingDetail(system, projectedRadiusPixels) {
  // Whole-system cull for sub-pixel rings.
  const wasHidden = system.userData.ringDetailHidden === true;
  const hidden = wasHidden
    ? projectedRadiusPixels < RING_LOD.showAbovePixels
    : projectedRadiusPixels < RING_LOD.hideBelowPixels;
  if (hidden !== wasHidden) {
    system.userData.ringDetailHidden = hidden;
    ["particleFields", "chunkFields", "haloFields", "glowFields"].forEach((key) => {
      system.userData[key]?.forEach((p) => { if (p) p.visible = !hidden; });
    });
  }
  if (hidden) return;

  const span = RING_LOD.fullDetailPixels - RING_LOD.minimumDetailPixels;
  const raw = (projectedRadiusPixels - RING_LOD.minimumDetailPixels) / Math.max(span, 1);
  const fraction = THREE.MathUtils.clamp(raw, RING_LOD.minimumFraction, 1);

  // These arrays are sparse: not every ring defines a halo, chunk or glow
  // layer, so entries can be null. The original updateField() guarded against
  // that and this must too -- an exception here happens inside the render loop
  // and kills the whole frame.
  system.userData.particleFields?.forEach((p) => setRingFieldDrawFraction(p, fraction));
  system.userData.chunkFields?.forEach((p) => setRingFieldDrawFraction(p, fraction));

  const haloVisible = projectedRadiusPixels >= RING_LOD.haloBelowPixels;
  system.userData.haloFields?.forEach((p) => {
    if (!p) return;
    if (p.visible !== haloVisible) p.visible = haloVisible;
    if (haloVisible) setRingFieldDrawFraction(p, fraction);
  });

  const glowAllowed = projectedRadiusPixels >= RING_LOD.glowBelowPixels;
  system.userData.glowFields?.forEach((p) => {
    if (!p) return;
    // The existing hover logic owns turning glow on; this only forces it off
    // when the ring is too small for a glow to be perceptible.
    if (!glowAllowed && p.visible) p.visible = false;
    if (glowAllowed) setRingFieldDrawFraction(p, fraction);
  });
}

const URANUS_EQUATORIAL_RADIUS_KM = 25_559;
const TAU = Math.PI * 2;
const PIXEL_RATIO = Math.min(
  typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  2,
);

// Ordered physically from Uranus outward. The render favours crisp particulate
// matter over soft cloudy sprites so the rings read as real debris populations.
const RINGS = [
  {
    name: "Zeta Ring",
    innerKm: 26_840,
    outerKm: 41_350,
    color: 0x4e5358,
    opacity: 0.070,
    particleShare: 1.22,
    sizeScale: 0.86,
    thicknessScale: 0.011,
    kind: "Diffuse inner dust ring",
    description: "Uranus's innermost known ring is a broad, extremely faint dust population. It is rendered as a dark particulate veil rather than a solid sheet.",
  },
  {
    name: "6 Ring",
    centerKm: 41_837,
    visualWidthKm: 170,
    color: 0x71787d,
    opacity: 0.46,
    particleShare: 0.80,
    sizeScale: 0.68,
    thicknessScale: 0.0035,
    kind: "Narrow dark main ring",
    description: "A very narrow, dark ring composed mainly of low-reflectivity particles and fine dust.",
  },
  {
    name: "5 Ring",
    centerKm: 42_234,
    visualWidthKm: 170,
    color: 0x747c81,
    opacity: 0.47,
    particleShare: 0.80,
    sizeScale: 0.68,
    thicknessScale: 0.0035,
    kind: "Narrow dark main ring",
    description: "A compact charcoal-grey ringlet within Uranus's tightly packed inner main ring system.",
  },
  {
    name: "4 Ring",
    centerKm: 42_570,
    visualWidthKm: 175,
    color: 0x6f767b,
    opacity: 0.48,
    particleShare: 0.82,
    sizeScale: 0.69,
    thicknessScale: 0.0035,
    kind: "Narrow dark main ring",
    description: "A thin, sharply separated ring of dark rocky and radiation-darkened material.",
  },
  {
    name: "Alpha Ring",
    centerKm: 44_718,
    visualWidthKm: 230,
    color: 0x7f878d,
    opacity: 0.54,
    particleShare: 0.96,
    sizeScale: 0.74,
    thicknessScale: 0.0039,
    kind: "Dark main ring",
    description: "One of Uranus's principal narrow rings, with a low-albedo grey surface and a clean gap on either side.",
  },
  {
    name: "Beta Ring",
    centerKm: 45_661,
    visualWidthKm: 250,
    color: 0x8a9399,
    opacity: 0.58,
    particleShare: 1.00,
    sizeScale: 0.76,
    thicknessScale: 0.0041,
    kind: "Dark main ring",
    description: "A narrow main ring slightly brighter than its neighbours, still extremely dark in visible light.",
  },
  {
    name: "Eta Ring",
    centerKm: 47_176,
    visualWidthKm: 310,
    color: 0x7c858a,
    opacity: 0.53,
    particleShare: 1.04,
    sizeScale: 0.78,
    thicknessScale: 0.0044,
    kind: "Structured main ring",
    description: "The eta ring contains narrow and broader components, represented here by closely packed particle lanes.",
  },
  {
    name: "Gamma Ring",
    centerKm: 47_627,
    visualWidthKm: 210,
    color: 0x889095,
    opacity: 0.57,
    particleShare: 0.96,
    sizeScale: 0.74,
    thicknessScale: 0.0038,
    kind: "Narrow dark main ring",
    description: "A sharply defined charcoal-grey ringlet in the dense central ring region.",
  },
  {
    name: "Delta Ring",
    centerKm: 48_300,
    visualWidthKm: 270,
    color: 0x949da3,
    opacity: 0.60,
    particleShare: 1.02,
    sizeScale: 0.78,
    thicknessScale: 0.0042,
    kind: "Narrow dark main ring",
    description: "A narrow, low-reflectivity ring surrounded by dusty material and small inner moons.",
  },
  {
    name: "Lambda Ring",
    centerKm: 50_023,
    visualWidthKm: 150,
    color: 0x757d82,
    opacity: 0.36,
    particleShare: 0.70,
    sizeScale: 0.66,
    thicknessScale: 0.0033,
    kind: "Faint dusty ring",
    description: "A very faint dusty ring lying just outside Cordelia's orbit and inside the epsilon ring.",
  },
  {
    name: "Epsilon Ring",
    centerKm: 51_149,
    visualWidthKm: 620,
    color: 0xc7d1d7,
    opacity: 0.80,
    particleShare: 1.30,
    sizeScale: 0.88,
    thicknessScale: 0.0048,
    kind: "Brightest main ring",
    description: "Uranus's brightest and most substantial narrow ring. Shepherd moons Cordelia and Ophelia confine its inner and outer edges.",
  },
  {
    name: "Nu Ring",
    innerKm: 65_400,
    outerKm: 69_900,
    color: 0x7c4b44,
    opacity: 0.12,
    particleShare: 1.04,
    sizeScale: 0.78,
    thicknessScale: 0.0085,
    kind: "Reddish outer dust ring",
    description: "The inner of Uranus's two outer dusty rings appears reddish, consistent with larger dust grains and dark organic-rich material.",
  },
  {
    name: "Mu Ring",
    innerKm: 86_000,
    outerKm: 103_000,
    color: 0x86b2e3,
    opacity: 0.14,
    particleShare: 1.20,
    sizeScale: 0.82,
    thicknessScale: 0.012,
    kind: "Blue outer ice-dust ring",
    description: "The broad outer mu ring appears blue because microscopic water-ice grains scatter short-wavelength light. The tiny moon Mab orbits within and likely replenishes it.",
  },
];

function bounds(ring) {
  if (ring.innerKm != null) return [ring.innerKm, ring.outerKm];
  const half = ring.visualWidthKm * 0.5;
  return [ring.centerKm - half, ring.centerKm + half];
}

function ringSeed(index, channel = 0) {
  return (0x9e3779b9 ^ (index * 2654435761) ^ (channel * 2246822519)) >>> 0;
}

function seededRandom(seed0) {
  let seed = seed0 >>> 0;
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hoverBoostFor(ring, index) {
  if (ring.name === "Zeta Ring") return 3.35;
  if (index <= 3) return 2.80;
  if (index <= 9) return 2.10;
  if (ring.name === "Epsilon Ring") return 1.85;
  return 1.55;
}

function chooseCount(ring, quality, layer = "core") {
  const qualityScale = quality === "low" ? 0.54 : quality === "medium" ? 0.76 : 1.0;
  const broadBase = ring.name === "Mu Ring" ? 7600 : ring.name === "Nu Ring" ? 4400 : 6200;
  const narrowBase = ring.name === "Epsilon Ring" ? 4600 : 2600;
  const base = ring.innerKm != null ? broadBase : narrowBase;
  const layerScale = layer === "glow" ? 0.11 : layer === "halo" ? 0.10 : layer === "chunk" ? 0.20 : 1.0;
  return Math.max(layer === "core" ? 540 : 120, Math.round(base * ring.particleShare * qualityScale * layerScale));
}

function sampleRadiusKm(ring, random, innerKm, outerKm, layer) {
  if (ring.innerKm != null) {
    const spread = outerKm - innerKm;
    if (ring.name === "Mu Ring") {
      const t = layer === "chunk" ? Math.pow(random(), 0.78) : Math.pow(random(), 0.88);
      return innerKm + spread * t;
    }
    if (ring.name === "Nu Ring") {
      const central = (random() + random() + random() + random()) / 4;
      return innerKm + spread * central;
    }
    const t = layer === "halo" ? random() : Math.pow(random(), 0.95);
    return innerKm + spread * t;
  }

  const width = outerKm - innerKm;
  const centre = ring.centerKm ?? ((innerKm + outerKm) * 0.5);
  const gaussianish = (random() + random() + random() + random()) / 4;
  return THREE.MathUtils.clamp(centre + (gaussianish - 0.5) * width * 0.84, innerKm, outerKm);
}

function createFieldMaterial({ additive = false, glow = false, halo = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacityBoost: { value: 1 },
      uHover: { value: 0 },
      uSystemHover: { value: 0 },
      uHoverBoost: { value: 1 },
      uPixelRatio: { value: PIXEL_RATIO },
      uDistanceVisibility: { value: 1 },
      uGlowLayer: { value: glow ? 1 : 0 },
      uHaloLayer: { value: halo ? 1 : 0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aSeed;
      attribute float aAspect;
      attribute float aSpin;
      attribute float aRockiness;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vAspect;
      varying float vSpin;
      varying float vRockiness;
      varying float vGlowLayer;
      varying float vHaloLayer;
      uniform float uPixelRatio;
      uniform float uDistanceVisibility;
      uniform float uHover;
      uniform float uHoverBoost;
      uniform float uGlowLayer;
      uniform float uHaloLayer;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vSeed = aSeed;
        vAspect = aAspect;
        vSpin = aSpin;
        vRockiness = aRockiness;
        vGlowLayer = uGlowLayer;
        vHaloLayer = uHaloLayer;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float depth = max(10.0, -mvPosition.z);
        float baseVisibility = mix(1.0, uDistanceVisibility, 0.84);
        float hoverScale = 1.0 + uHover * (0.44 + uHoverBoost * 0.18);
        float layerScale = uGlowLayer > 0.5 ? 1.95 : (uHaloLayer > 0.5 ? 1.18 : 1.0);
        float size = aSize * uPixelRatio * baseVisibility * hoverScale * layerScale * (118.0 / depth);
        gl_PointSize = clamp(size, 0.62 * uPixelRatio, 8.4 * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacityBoost;
      uniform float uHover;
      uniform float uSystemHover;
      uniform float uHoverBoost;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSeed;
      varying float vAspect;
      varying float vSpin;
      varying float vRockiness;
      varying float vGlowLayer;
      varying float vHaloLayer;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 p = gl_PointCoord - vec2(0.5);
        float cs = cos(vSpin);
        float sn = sin(vSpin);
        p = mat2(cs, -sn, sn, cs) * p;
        p.x *= vAspect;

        float r2 = dot(p, p);
        float r = sqrt(r2);
        float ang = atan(p.y, p.x);
        float edgeNoise =
          sin(ang * 5.0 + vSeed * 17.0) * 0.028 +
          sin(ang * 8.0 + vSeed * 31.0) * 0.015 +
          sin(ang * 13.0 + vSeed * 47.0) * 0.008;

        if (vGlowLayer > 0.5) {
          float glowMask = 1.0 - smoothstep(0.08, 0.50, r);
          float core = 1.0 - smoothstep(0.0, 0.22, r);
          float alpha = vAlpha * glowMask * (0.55 + core * 0.60) * uOpacityBoost;
          alpha *= 1.0 + uHover * (1.45 + uHoverBoost * 0.22);
          if (alpha < 0.008) discard;
          vec3 glowColour = mix(vColor, vec3(0.78, 0.95, 1.0), 0.56 + uHover * 0.18);
          gl_FragColor = vec4(glowColour, min(alpha, 0.92));
          return;
        }

        float radius = 0.47 + edgeNoise * mix(0.30, 1.0, vRockiness) + vHaloLayer * 0.01;
        if (r > radius) discard;

        float edge = 1.0 - smoothstep(radius - (vHaloLayer > 0.5 ? 0.16 : 0.08), radius, r);
        float sphereZ = sqrt(max(0.0001, radius * radius - r2));
        vec3 normal = normalize(vec3(p.x, p.y, sphereZ));
        vec3 lightDir = normalize(vec3(-0.38, 0.52, 0.76));
        float diffuse = max(dot(normal, lightDir), 0.0);
        float rim = pow(1.0 - max(normal.z, 0.0), 1.8);
        float crater = hash21(floor((p + 0.5) * (10.0 + vSeed * 8.0)) + vSeed * 19.0);
        float roughShadow = mix(0.88, 1.06, crater);
        float twinkle = 0.96 + 0.04 * sin(uTime * (0.22 + vSeed * 0.42) + vSeed * 29.0);
        float selectedBoost = 1.0 + uHover * (1.10 + uHoverBoost * 0.40);
        float nonSelectedDim = mix(1.0, 0.42, uSystemHover * (1.0 - uHover));

        float alpha = vAlpha * edge * selectedBoost * nonSelectedDim * roughShadow * twinkle * uOpacityBoost;
        alpha *= (vHaloLayer > 0.5 ? 0.78 : 1.0);
        if (alpha < 0.010) discard;

        vec3 colour = vColor;
        colour *= 0.42 + diffuse * 0.68;
        colour += vColor * rim * (vHaloLayer > 0.5 ? 0.18 : 0.08);
        colour += vec3(1.0) * pow(diffuse, 18.0) * 0.10;
        vec3 hoverColour = vec3(0.72, 0.95, 1.0);
        colour = mix(colour, hoverColour, uHover * min(0.86, 0.24 + uHoverBoost * 0.15));
        gl_FragColor = vec4(colour, min(alpha, 0.97));
      }
    `,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    depthTest: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

function createRingParticleField(radius, ring, index, quality, { layer = "core" } = {}) {
  const [innerKm, outerKm] = bounds(ring);
  const count = chooseCount(ring, quality, layer);
  const channel = layer === "halo" ? 1 : layer === "glow" ? 2 : layer === "chunk" ? 3 : 0;
  const random = seededRandom(ringSeed(index, channel));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const seeds = new Float32Array(count);
  const aspects = new Float32Array(count);
  const spins = new Float32Array(count);
  const rockiness = new Float32Array(count);
  const base = new THREE.Color(ring.color);
  const white = new THREE.Color(0xffffff);
  const isGlow = layer === "glow";
  const isHalo = layer === "halo";
  const isChunk = layer === "chunk";

  for (let i = 0; i < count; i += 1) {
    const clusterBand = Math.floor(random() * (ring.innerKm != null ? 30 : 22)) / (ring.innerKm != null ? 30 : 22);
    const clusterAngle = clusterBand * TAU;
    const angle = random() < (ring.innerKm != null ? 0.46 : 0.34)
      ? clusterAngle + (random() - 0.5) * (ring.innerKm != null ? 0.22 : 0.10)
      : random() * TAU;
    const radialKm = sampleRadiusKm(ring, random, innerKm, outerKm, layer);
    const visualRadius = radius * radialKm / URANUS_EQUATORIAL_RADIUS_KM;
    const heightSpread = radius * (ring.thicknessScale ?? 0.006) * (isHalo ? 1.55 : isGlow ? 1.05 : isChunk ? 0.85 : 1.0);
    const y = (random() - 0.5) * heightSpread;

    positions[i * 3] = Math.cos(angle) * visualRadius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * visualRadius;

    const brighten = ring.name === "Epsilon Ring"
      ? 0.14 + random() * 0.18
      : ring.name === "Mu Ring"
        ? 0.10 + random() * 0.16
        : 0.05 + random() * 0.12;
    const colour = base.clone().lerp(white, brighten + (isGlow ? 0.12 : 0));
    if (ring.name === "Nu Ring") colour.offsetHSL(0.0, 0.02, -0.03 + random() * 0.03);
    if (ring.name === "Mu Ring") colour.offsetHSL(0.0, 0.025, 0.02 + random() * 0.04);
    if (ring.name === "Zeta Ring") colour.multiplyScalar(0.72 + random() * 0.18);
    colors[i * 3] = colour.r;
    colors[i * 3 + 1] = colour.g;
    colors[i * 3 + 2] = colour.b;

    const pointClass = random();
    if (isGlow) {
      sizes[i] = (1.15 + random() * 1.30) * ring.sizeScale;
      alphas[i] = ring.opacity * (ring.name === "Zeta Ring" || index <= 3 ? 0.16 + random() * 0.10 : 0.10 + random() * 0.08);
      aspects[i] = 0.92 + random() * 0.18;
      rockiness[i] = 0.12 + random() * 0.18;
    } else if (isHalo) {
      sizes[i] = (0.80 + random() * 0.92) * ring.sizeScale;
      alphas[i] = ring.opacity * (0.030 + random() * 0.045);
      aspects[i] = 0.86 + random() * 0.28;
      rockiness[i] = 0.28 + random() * 0.26;
    } else if (isChunk) {
      sizes[i] = (1.18 + random() * 1.32) * ring.sizeScale;
      alphas[i] = ring.opacity * (0.16 + random() * 0.16);
      aspects[i] = 0.68 + random() * 0.54;
      rockiness[i] = 0.74 + random() * 0.26;
    } else {
      if (pointClass < 0.88) sizes[i] = (0.40 + random() * 0.34) * ring.sizeScale;
      else if (pointClass < 0.988) sizes[i] = (0.74 + random() * 0.52) * ring.sizeScale;
      else sizes[i] = (1.12 + random() * 0.74) * ring.sizeScale;
      const bandPosition = (radialKm - innerKm) / Math.max(1, outerKm - innerKm);
      const laneDensity = ring.innerKm != null
        ? 0.76 + 0.24 * Math.pow(0.5 + 0.5 * Math.sin(bandPosition * (ring.name === "Mu Ring" ? 16.0 : 20.0) + index * 1.31), 2.0)
        : 0.84 + 0.16 * Math.pow(0.5 + 0.5 * Math.sin(bandPosition * 54.0 + index * 1.17), 2.0);
      const clumpDensity = random() < (ring.innerKm != null ? 0.10 : 0.06) ? 1.25 : 0.88 + random() * 0.14;
      alphas[i] = ring.opacity * (0.36 + random() * 0.46) * laneDensity * clumpDensity;
      aspects[i] = 0.74 + random() * 0.32;
      rockiness[i] = ring.innerKm != null ? 0.42 + random() * 0.22 : 0.56 + random() * 0.26;
    }

    seeds[i] = random();
    spins[i] = random() * TAU;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aAspect", new THREE.BufferAttribute(aspects, 1));
  geometry.setAttribute("aSpin", new THREE.BufferAttribute(spins, 1));
  geometry.setAttribute("aRockiness", new THREE.BufferAttribute(rockiness, 1));
  geometry.computeBoundingSphere();

  const additive = isGlow || ring.name === "Mu Ring" || ring.name === "Nu Ring";
  const material = createFieldMaterial({ additive, glow: isGlow, halo: isHalo });
  material.uniforms.uOpacityBoost.value = isGlow ? 0.74 : isHalo ? 0.66 : isChunk ? 0.96 : 1.0;
  material.uniforms.uHoverBoost.value = hoverBoostFor(ring, index);

  const points = new THREE.Points(geometry, material);
  points.name = `${ring.name} ${layer} particles`;
  points.frustumCulled = false;
  points.renderOrder = isGlow ? 7 : isHalo ? 5 : isChunk ? 6 : 4;
  return points;
}

function formatKm(value) {
  return `${Math.round(value).toLocaleString("en-US")} km`;
}

export function createUranusRingSystem({ planet, radius, quality = "high", hoverTargets = [] }) {
  const group = new THREE.Group();
  group.name = "Uranus realistic 13-ring system";
  const particleFields = [];
  const haloFields = [];
  const glowFields = [];
  const chunkFields = [];
  const targets = [];

  RINGS.forEach((ring, index) => {
    const [innerKm, outerKm] = bounds(ring);
    const field = createRingParticleField(radius, ring, index, quality, { layer: "core" });
    group.add(field);
    particleFields.push(field);

    const needsHalo = ring.name === "Zeta Ring" || ring.name === "Nu Ring" || ring.name === "Mu Ring";
    const halo = needsHalo ? createRingParticleField(radius, ring, index, quality, { layer: "halo" }) : null;
    if (halo) group.add(halo);
    haloFields.push(halo);

    const needsChunks = ring.name === "Zeta Ring" || ring.name === "Mu Ring" || ring.name === "Nu Ring" || ring.name === "Epsilon Ring" || index <= 9;
    const chunk = needsChunks ? createRingParticleField(radius, ring, index, quality, { layer: "chunk" }) : null;
    if (chunk) group.add(chunk);
    chunkFields.push(chunk);

    const glow = createRingParticleField(radius, ring, index, quality, { layer: "glow" });
    glow.visible = false;
    group.add(glow);
    glowFields.push(glow);

    const inner = radius * innerKm / URANUS_EQUATORIAL_RADIUS_KM;
    const outer = radius * outerKm / URANUS_EQUATORIAL_RADIUS_KM;
    const baseHit = ring.name === "Zeta Ring" ? 0.064 : index <= 3 ? 0.048 : ring.innerKm != null ? 0.042 : 0.033;
    const minHit = radius * baseHit;
    const pad = Math.max(0, (minHit - (outer - inner)) * 0.5);
    const target = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(radius * 1.015, inner - pad), outer + pad, 256, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    target.name = `${ring.name} interaction field`;
    target.rotation.x = Math.PI * 0.5;
    target.userData = {
      name: ring.name,
      isPlanetRing: true,
      isUranusRing: true,
      ringIndex: index,
      parentPlanetObject: planet,
      info: { type: "Uranus ring", description: ring.description },
      ringData: {
        systemName: "Uranus ring system",
        order: `${index + 1} of ${RINGS.length} from Uranus outward`,
        character: ring.kind,
        radialRange: `${formatKm(innerKm)} – ${formatKm(outerKm)} from Uranus's centre`,
        description: ring.description,
        motion: ring.name === "Mu Ring"
          ? "Microscopic water-ice dust · Mab travels within this broad ring"
          : ring.name === "Nu Ring"
            ? "Dusty outer ring · reddish larger grains and organic-rich dark material"
            : "Dark rock, carbon-rich material, water ice, and fine dust",
      },
      setHovered(active) {
        group.userData.targetHover = active ? index : -1;
      },
    };
    group.add(target);
    targets.push(target);
  });

  group.userData = {
    particleFields,
    haloFields,
    glowFields,
    chunkFields,
    targets,
    hover: -1,
    targetHover: -1,
    hoverStrength: 0,
  };
  hoverTargets.push(...targets);
  planet.add(group);
  return group;
}

export function updateUranusRingSystem(system, time, camera = null) {
  if (!system?.userData?.particleFields) return;
  const target = system.userData.targetHover ?? -1;
  system.userData.hoverStrength = THREE.MathUtils.lerp(
    system.userData.hoverStrength ?? 0,
    target >= 0 ? 1 : 0,
    target >= 0 ? 0.25 : 0.16,
  );
  if (target >= 0) system.userData.hover = target;
  else if (system.userData.hoverStrength < 0.015) system.userData.hover = -1;

  let distanceVisibility = 1;
  if (camera) {
    const worldPosition = uranusRingWorldPosition;
    system.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    distanceVisibility = THREE.MathUtils.clamp(0.98 + distance / 46.0, 1.0, 2.25);

    // Apparent ring radius in pixels. The ring system spans roughly twice the
    // planet's visual radius, which is accurate enough to drive detail.
    const focalPixels = (window.innerHeight * 0.5)
      / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const ringRadius = Number(system.parent?.userData?.visualRadius ?? 1) * 2;
    applyUranusRingDetail(
      system,
      (ringRadius / Math.max(distance, 1e-4)) * focalPixels,
    );
  }

  const hoverIndex = system.userData.hover;
  const systemHover = hoverIndex >= 0 ? system.userData.hoverStrength : 0;
  const updateField = (points, index, boost = 1) => {
    if (!points) return;
    const selected = index === hoverIndex;
    const material = points.material;
    material.uniforms.uTime.value = time;
    material.uniforms.uHover.value = selected ? system.userData.hoverStrength * boost : 0;
    material.uniforms.uSystemHover.value = systemHover;
    material.uniforms.uDistanceVisibility.value = distanceVisibility;
  };

  system.userData.particleFields.forEach((points, index) => updateField(points, index, 1.0));
  system.userData.chunkFields.forEach((points, index) => updateField(points, index, 1.08));
  system.userData.haloFields.forEach((points, index) => updateField(points, index, 1.12));
  system.userData.glowFields.forEach((points, index) => {
    const selected = index === hoverIndex && system.userData.hoverStrength > 0.02;
    points.visible = selected;
    updateField(points, index, 1.42);
  });
}

/**
 * Particle-resolved Saturn ring system.
 *
 * Saturn's rings are not solid annuli. Every visible layer below is built from
 * independently orbiting ice grains, dusty fragments, and irregular chunks.
 * The animation contains no time-varying noise or jitter: orbital motion is
 * perfectly circular and follows Kepler's inverse-radius speed relationship.
 *
 * Physical reference values used by the simulation:
 * - Saturn equatorial radius: 60,268 km
 * - Saturn GM: 37,931,207.7 km^3/s^2
 * - Particles move from about 23.8 km/s at the D-ring inner edge to roughly
 *   8.9 km/s across the broad rendered core of the diffuse E ring.
 *
 * Time is uniformly compressed so the orbital flow remains visible in a
 * browser while preserving the scientifically correct relative relationship:
 * inner particles always overtake outer particles smoothly.
 */
import * as THREE from "three";
import { markPointerProxy } from "../../scene/pointerProxies.js";

const TAU = Math.PI * 2;
const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
const SATURN_GM_KM3_S2 = 37_931_207.7;
const PHYSICAL_SECONDS_PER_SCENE_SECOND = 900;

const QUALITY_PROFILES = {
  low: { grainCount: 52_000, chunkCount: 480 },
  medium: { grainCount: 92_000, chunkCount: 860 },
  high: { grainCount: 148_000, chunkCount: 1_440 },
};

/**
 * The named ring boundaries use physical kilometres. Particle share is a
 * rendering allocation, not a claim about ring mass. A large share is assigned
 * to the optically dense B ring so it remains luminous without a solid mesh.
 */
const RING_REGIONS = [
  {
    name: "D Ring",
    innerKm: 66_900,
    outerKm: 74_510,
    hoverInnerKm: 66_900,
    hoverOuterKm: 74_510,
    particleShare: 0.038,
    chunkShare: 0.016,
    lanes: 26,
    opacity: 0.31,
    thicknessScale: 0.00135,
    sizeScale: 0.88,
    iceFraction: 0.972,
    palette: [0xbba991, 0xd6c7ad, 0x8e806f],
    character: "Faint innermost ring",
    description: "The D Ring is Saturn's faint, dusty innermost ring group. Its extremely sparse ice-rich grains orbit independently just above the planet's upper atmosphere.",
  },
  {
    name: "C Ring",
    innerKm: 74_658,
    outerKm: 92_000,
    hoverInnerKm: 74_658,
    hoverOuterKm: 92_000,
    particleShare: 0.142,
    chunkShare: 0.104,
    lanes: 66,
    opacity: 0.52,
    thicknessScale: 0.00140,
    sizeScale: 0.96,
    iceFraction: 0.982,
    palette: [0xc9b798, 0xead8b8, 0x9f8d75],
    character: "Translucent main ring",
    description: "The C Ring is a broad, comparatively translucent part of Saturn's main visible system. It contains many narrow ringlets and gaps, including the Maxwell Gap.",
  },
  {
    name: "B Ring",
    innerKm: 92_000,
    outerKm: 117_580,
    hoverInnerKm: 92_000,
    hoverOuterKm: 117_580,
    particleShare: 0.410,
    chunkShare: 0.500,
    lanes: 124,
    opacity: 0.90,
    thicknessScale: 0.00105,
    sizeScale: 1.08,
    iceFraction: 0.994,
    palette: [0xf8edcf, 0xe8d7b5, 0xfff8e2],
    character: "Brightest and densest ring",
    description: "The B Ring is the brightest, widest, and optically densest portion of the main rings. Its outer edge borders the Cassini Division.",
  },
  {
    name: "A Ring",
    innerKm: 122_170,
    outerKm: 136_775,
    hoverInnerKm: 122_170,
    hoverOuterKm: 136_775,
    particleShare: 0.225,
    chunkShare: 0.335,
    lanes: 90,
    opacity: 0.77,
    thicknessScale: 0.00118,
    sizeScale: 1.02,
    iceFraction: 0.989,
    palette: [0xe7d4af, 0xf5e8ca, 0xc8b18d],
    character: "Outer bright main ring",
    description: "The A Ring is the outermost of Saturn's three bright main rings. The Encke and Keeler gaps carve narrow dark lanes through its independently orbiting particles.",
  },
  {
    name: "F Ring",
    innerKm: 139_780,
    outerKm: 140_660,
    hoverInnerKm: 139_720,
    hoverOuterKm: 140_720,
    particleShare: 0.035,
    chunkShare: 0.034,
    lanes: 7,
    opacity: 0.70,
    thicknessScale: 0.00235,
    sizeScale: 0.92,
    iceFraction: 0.988,
    palette: [0xfff5dc, 0xe3d4b9, 0xc7b699],
    character: "Narrow shepherded ring",
    description: "The narrow F Ring marks the outer boundary of the main ring system. Prometheus and Pandora help sculpt its strands, clumps, and changing structure.",
  },
  {
    name: "G Ring",
    innerKm: 166_000,
    outerKm: 175_000,
    hoverInnerKm: 167_000,
    hoverOuterKm: 173_400,
    particleShare: 0.050,
    chunkShare: 0.010,
    lanes: 28,
    opacity: 0.30,
    thicknessScale: 0.0048,
    sizeScale: 0.92,
    iceFraction: 0.975,
    palette: [0xbab7ac, 0xd4d1c4, 0x8f8d85],
    character: "Faint dusty outer ring",
    description: "The G Ring is a broad, very faint dusty ring. The tiny moon Aegaeon travels within a brighter arc near its inner region and supplies some of its debris.",
  },
  {
    name: "E Ring",
    innerKm: 180_000,
    outerKm: 480_000,
    hoverInnerKm: 190_000,
    hoverOuterKm: 315_000,
    particleShare: 0.100,
    chunkShare: 0.001,
    lanes: 206,
    opacity: 0.19,
    thicknessScale: 0.030,
    sizeScale: 0.86,
    iceFraction: 0.995,
    palette: [0xd8e2e5, 0xf4fbff, 0xbecbd0],
    character: "Enormous diffuse ice ring",
    description: "The E Ring is an immense, diffuse cloud of microscopic water-ice particles. Plumes from Enceladus continually feed its brightest central region, while its faint halo extends much farther outward.",
  },
];

// Narrow clearings are widened only enough to remain legible at screen scale.
const NAMED_GAPS = [
  { centerKm: 87_500, halfWidthKm: 245 }, // Maxwell Gap in the C ring
  { centerKm: 133_590, halfWidthKm: 260 }, // Encke Gap in the A ring
  { centerKm: 136_530, halfWidthKm: 105 }, // Keeler Gap in the A ring
];

const ICE_COLOURS = [
  new THREE.Color(0xfff8e8),
  new THREE.Color(0xf1e5ca),
  new THREE.Color(0xded1b8),
  new THREE.Color(0xffffff),
];
const DIRTY_ICE_COLOURS = [
  new THREE.Color(0xb8a486),
  new THREE.Color(0x9f8e78),
  new THREE.Color(0xcbb998),
];
const ROCK_COLOURS = [
  new THREE.Color(0x6f665c),
  new THREE.Color(0x88796a),
  new THREE.Color(0x514b45),
];

function createDeterministicRandom(seed = 0x51a7c0de) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function getRegionCounts(total, key) {
  const counts = RING_REGIONS.map((region) => Math.floor(total * region[key]));
  let assigned = counts.reduce((sum, count) => sum + count, 0);
  let cursor = 0;
  while (assigned < total) {
    counts[cursor % counts.length] += 1;
    assigned += 1;
    cursor += 1;
  }
  return counts;
}

function isInsideNamedGap(radiusKm) {
  return NAMED_GAPS.some(({ centerKm, halfWidthKm }) => (
    Math.abs(radiusKm - centerKm) < halfWidthKm
  ));
}

/**
 * Stratified lanes avoid clumps while retaining thousands of extremely narrow
 * ringlets. Randomness is used once for placement only; it never drives motion.
 */
function sampleRadiusKm(region, localIndex, regionCount, random) {
  const widthKm = region.outerKm - region.innerKm;
  const lane = localIndex % region.lanes;
  const laneWidthKm = widthKm / region.lanes;
  const pass = Math.floor(localIndex / region.lanes);
  const passCount = Math.max(1, Math.ceil(regionCount / region.lanes));

  const laneInset = laneWidthKm * 0.065;
  const usableLaneWidth = Math.max(1, laneWidthKm - laneInset * 2);
  const orderedOffset = ((pass + random() * 0.72) / passCount) * usableLaneWidth;
  let radiusKm = region.innerKm + lane * laneWidthKm + laneInset + orderedOffset;

  // Resample only around known gaps. The fallback keeps every loop bounded.
  for (let attempt = 0; attempt < 5 && isInsideNamedGap(radiusKm); attempt += 1) {
    radiusKm = region.innerKm + random() * widthKm;
  }
  return radiusKm;
}

function getAngularSpeed(radiusKm) {
  const physicalRadiansPerSecond = Math.sqrt(
    SATURN_GM_KM3_S2 / (radiusKm * radiusKm * radiusKm),
  );
  return physicalRadiansPerSecond * PHYSICAL_SECONDS_PER_SCENE_SECOND;
}

function chooseParticleColour(region, random, target) {
  const selector = random();
  let source;
  if (selector < region.iceFraction) {
    source = ICE_COLOURS[Math.floor(random() * ICE_COLOURS.length)];
  } else if (selector < region.iceFraction + (1 - region.iceFraction) * 0.78) {
    source = DIRTY_ICE_COLOURS[Math.floor(random() * DIRTY_ICE_COLOURS.length)];
  } else {
    source = ROCK_COLOURS[Math.floor(random() * ROCK_COLOURS.length)];
  }

  const regionalTone = new THREE.Color(
    region.palette[Math.floor(random() * region.palette.length)],
  );
  target.copy(source).lerp(regionalTone, 0.26 + random() * 0.26);
  target.multiplyScalar(0.88 + random() * 0.20);
  return target;
}

function createGrainMaterial(pixelRatio) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uHoveredRegion: { value: -10 },
      uHoverStrength: { value: 0 },
    },
    vertexShader: `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aHeight;
      attribute float aAngularSpeed;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aRegionIndex;
      attribute vec3 aColour;

      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uHoveredRegion;
      uniform float uHoverStrength;

      varying vec3 vColour;
      varying float vAlpha;
      varying float vHighlight;
      varying float vHoverStrength;
      varying float vHighlightBoost;

      void main() {
        float angle = mod(aAngle + uTime * aAngularSpeed, 6.28318530718);
        vec3 orbitalPosition = vec3(
          cos(angle) * aRadius,
          aHeight,
          sin(angle) * aRadius
        );

        vec4 mvPosition = modelViewMatrix * vec4(orbitalPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float distanceScale = 34.0 / max(1.0, -mvPosition.z);
        float regionMatch = 1.0 - step(0.36, abs(aRegionIndex - uHoveredRegion));
        float highlighted = regionMatch * uHoverStrength;
        float faintness = 1.0 - clamp(aAlpha, 0.0, 1.0);
        float sizeBoost = 0.58 + faintness * 1.52;
        gl_PointSize = clamp(
          aSize * (1.0 + highlighted * sizeBoost) * uPixelRatio * distanceScale,
          0.42 * uPixelRatio,
          10.8 * uPixelRatio
        );

        vColour = aColour;
        vAlpha = aAlpha;
        vHighlight = regionMatch;
        vHoverStrength = uHoverStrength;
        vHighlightBoost = 1.0 + faintness * 2.05;
      }
    `,
    fragmentShader: `
      varying vec3 vColour;
      varying float vAlpha;
      varying float vHighlight;
      varying float vHoverStrength;
      varying float vHighlightBoost;

      void main() {
        vec2 centred = gl_PointCoord - vec2(0.5);
        float distanceFromCentre = length(centred);
        if (distanceFromCentre > 0.5) discard;

        float softEdge = 1.0 - smoothstep(0.34, 0.5, distanceFromCentre);
        float icyCore = 1.0 - smoothstep(0.0, 0.42, distanceFromCentre);
        float selected = vHighlight * vHoverStrength;
        float otherDim = 1.0 - (1.0 - vHighlight) * vHoverStrength * 0.58;
        vec3 highlightColour = vec3(0.88, 0.98, 1.0);
        vec3 colour = mix(vColour, highlightColour, selected * min(0.68, 0.38 + (vHighlightBoost - 1.0) * 0.10));
        colour *= (0.92 + icyCore * 0.18) * otherDim * (1.0 + selected * (0.34 + (vHighlightBoost - 1.0) * 0.40));
        float alpha = softEdge * vAlpha * otherDim * (1.0 + selected * (0.22 + (vHighlightBoost - 1.0) * 0.92));
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
}

function createGrainField(radius, count, random, pixelRatio) {
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const angles = new Float32Array(count);
  const heights = new Float32Array(count);
  const angularSpeeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const regionIndices = new Float32Array(count);
  const colours = new Float32Array(count * 3);
  const regionCounts = getRegionCounts(count, "particleShare");
  const colour = new THREE.Color();

  let index = 0;
  RING_REGIONS.forEach((region, regionIndex) => {
    const regionCount = regionCounts[regionIndex];
    for (let localIndex = 0; localIndex < regionCount; localIndex += 1) {
      const i3 = index * 3;
      const radiusKm = sampleRadiusKm(region, localIndex, regionCount, random);
      const visualRadius = radius * (radiusKm / SATURN_EQUATORIAL_RADIUS_KM);
      const heightSpread = radius * region.thicknessScale;

      radii[index] = visualRadius;
      angles[index] = random() * TAU;
      heights[index] = (random() - 0.5) * 2 * heightSpread;
      angularSpeeds[index] = getAngularSpeed(radiusKm);

      // Tiny grains dominate. A small tail receives a larger sprite so nearby
      // views resolve pebbles and small boulders without millions of draw calls.
      const sizeSelector = random();
      if (sizeSelector < 0.965) sizes[index] = (0.72 + random() * 0.58) * region.sizeScale;
      else if (sizeSelector < 0.997) sizes[index] = (1.35 + random() * 0.95) * region.sizeScale;
      else sizes[index] = (2.35 + random() * 1.55) * region.sizeScale;

      alphas[index] = region.opacity * (0.70 + random() * 0.30);
      regionIndices[index] = regionIndex;
      chooseParticleColour(region, random, colour);
      colours[i3] = colour.r;
      colours[i3 + 1] = colour.g;
      colours[i3 + 2] = colour.b;

      // Position is intentionally zero. The GPU computes each orbit directly
      // from the per-particle physical radius and angular speed attributes.
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;
      index += 1;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
  geometry.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
  geometry.setAttribute("aAngularSpeed", new THREE.BufferAttribute(angularSpeeds, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aRegionIndex", new THREE.BufferAttribute(regionIndices, 1));
  geometry.setAttribute("aColour", new THREE.BufferAttribute(colours, 3));

  const material = createGrainMaterial(pixelRatio);
  const grains = new THREE.Points(geometry, material);
  grains.name = "Saturn independently orbiting ice grains";
  grains.frustumCulled = false;
  grains.renderOrder = 2;
  return grains;
}

function copyBaseGeometryToInstanced(baseGeometry) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = baseGeometry.index;
  Object.entries(baseGeometry.attributes).forEach(([name, attribute]) => {
    geometry.setAttribute(name, attribute);
  });
  return geometry;
}

function createChunkMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHoveredRegion: { value: -10 },
      uHoverStrength: { value: 0 },
    },
    vertexShader: `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aHeight;
      attribute float aAngularSpeed;
      attribute vec3 aScale;
      attribute vec3 aColour;
      attribute vec3 aSpinPhase;
      attribute vec3 aSpinRate;
      attribute float aRegionIndex;

      uniform float uTime;
      uniform float uHoveredRegion;
      uniform float uHoverStrength;

      varying vec3 vColour;
      varying vec3 vViewNormal;
      varying float vHighlight;
      varying float vHoverStrength;

      mat3 rotateX(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
      }

      mat3 rotateY(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
      }

      mat3 rotateZ(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
      }

      void main() {
        float orbitAngle = mod(aAngle + uTime * aAngularSpeed, 6.28318530718);
        vec3 spinAngles = aSpinPhase + uTime * aSpinRate;
        mat3 spinRotation = rotateZ(spinAngles.z)
          * rotateY(spinAngles.y)
          * rotateX(spinAngles.x);
        mat3 orbitalRotation = rotateY(-orbitAngle);

        vec3 localPosition = spinRotation * (position * aScale);
        localPosition = orbitalRotation * localPosition;
        vec3 orbitalCentre = vec3(
          cos(orbitAngle) * aRadius,
          aHeight,
          sin(orbitAngle) * aRadius
        );
        vec3 transformedPosition = orbitalCentre + localPosition;

        vec3 transformedNormal = orbitalRotation * spinRotation * normal;
        vViewNormal = normalize(normalMatrix * transformedNormal);
        vColour = aColour;
        vHighlight = 1.0 - step(0.36, abs(aRegionIndex - uHoveredRegion));
        vHoverStrength = uHoverStrength;

        vec4 mvPosition = modelViewMatrix * vec4(transformedPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColour;
      varying vec3 vViewNormal;
      varying float vHighlight;
      varying float vHoverStrength;

      void main() {
        vec3 lightDirection = normalize(vec3(0.42, 0.72, 0.55));
        float diffuse = max(dot(normalize(vViewNormal), lightDirection), 0.0);
        float backFill = max(dot(normalize(vViewNormal), -lightDirection), 0.0);
        float lighting = 0.30 + diffuse * 0.76 + backFill * 0.08;
        float selected = vHighlight * vHoverStrength;
        float otherDim = 1.0 - (1.0 - vHighlight) * vHoverStrength * 0.42;
        vec3 colour = mix(vColour, vec3(0.86, 0.97, 1.0), selected * 0.52);
        gl_FragColor = vec4(colour * lighting * otherDim * (1.0 + selected * 0.32), 1.0);
      }
    `,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: true,
  });
}

function createChunkField(radius, count, random) {
  const baseGeometry = new THREE.IcosahedronGeometry(1, 0);
  const geometry = copyBaseGeometryToInstanced(baseGeometry);
  baseGeometry.dispose();

  const radii = new Float32Array(count);
  const angles = new Float32Array(count);
  const heights = new Float32Array(count);
  const angularSpeeds = new Float32Array(count);
  const scales = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const spinPhases = new Float32Array(count * 3);
  const spinRates = new Float32Array(count * 3);
  const regionIndices = new Float32Array(count);
  const regionCounts = getRegionCounts(count, "chunkShare");
  const colour = new THREE.Color();

  let index = 0;
  RING_REGIONS.forEach((region, regionIndex) => {
    const regionCount = regionCounts[regionIndex];
    for (let localIndex = 0; localIndex < regionCount; localIndex += 1) {
      const i3 = index * 3;
      const radiusKm = sampleRadiusKm(region, localIndex, regionCount, random);
      const visualRadius = radius * (radiusKm / SATURN_EQUATORIAL_RADIUS_KM);
      const heightSpread = radius * region.thicknessScale * 0.78;

      radii[index] = visualRadius;
      angles[index] = random() * TAU;
      heights[index] = (random() - 0.5) * 2 * heightSpread;
      angularSpeeds[index] = getAngularSpeed(radiusKm);
      regionIndices[index] = regionIndex;

      // Most instanced bodies are car/house-scale visual representatives. A
      // very small fraction are enlarged mountain-class clumps for close views.
      const sizeSelector = random();
      let baseSize;
      if (sizeSelector < 0.925) baseSize = radius * (0.0010 + random() * 0.0017);
      else if (sizeSelector < 0.992) baseSize = radius * (0.0029 + random() * 0.0035);
      else baseSize = radius * (0.0070 + random() * 0.0085);
      baseSize *= region.sizeScale;

      scales[i3] = baseSize * (0.70 + random() * 0.70);
      scales[i3 + 1] = baseSize * (0.52 + random() * 0.72);
      scales[i3 + 2] = baseSize * (0.72 + random() * 0.82);

      chooseParticleColour(region, random, colour);
      colours[i3] = colour.r;
      colours[i3 + 1] = colour.g;
      colours[i3 + 2] = colour.b;

      spinPhases[i3] = random() * TAU;
      spinPhases[i3 + 1] = random() * TAU;
      spinPhases[i3 + 2] = random() * TAU;
      const spinSpeed = 0.045 + random() * 0.115;
      spinRates[i3] = spinSpeed * (0.45 + random());
      spinRates[i3 + 1] = spinSpeed * (0.45 + random());
      spinRates[i3 + 2] = spinSpeed * (0.45 + random());
      index += 1;
    }
  });

  geometry.instanceCount = count;
  geometry.setAttribute("aRadius", new THREE.InstancedBufferAttribute(radii, 1));
  geometry.setAttribute("aAngle", new THREE.InstancedBufferAttribute(angles, 1));
  geometry.setAttribute("aHeight", new THREE.InstancedBufferAttribute(heights, 1));
  geometry.setAttribute("aAngularSpeed", new THREE.InstancedBufferAttribute(angularSpeeds, 1));
  geometry.setAttribute("aScale", new THREE.InstancedBufferAttribute(scales, 3));
  geometry.setAttribute("aColour", new THREE.InstancedBufferAttribute(colours, 3));
  geometry.setAttribute("aSpinPhase", new THREE.InstancedBufferAttribute(spinPhases, 3));
  geometry.setAttribute("aSpinRate", new THREE.InstancedBufferAttribute(spinRates, 3));
  geometry.setAttribute("aRegionIndex", new THREE.InstancedBufferAttribute(regionIndices, 1));

  const material = createChunkMaterial();
  const chunks = new THREE.Mesh(geometry, material);
  chunks.name = "Saturn independently orbiting ice and rock chunks";
  chunks.frustumCulled = false;
  chunks.renderOrder = 3;
  return chunks;
}


function formatKilometres(value) {
  return `${Math.round(value).toLocaleString("en-US")} km`;
}

function createHoverOverlayMaterial(baseOpacity = 0.18) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uBaseOpacity: { value: baseOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform float uBaseOpacity;
      void main() {
        float innerFade = smoothstep(0.0, 0.16, vUv.y);
        float outerFade = 1.0 - smoothstep(0.84, 1.0, vUv.y);
        float band = innerFade * outerFade;
        float shimmer = 0.82 + 0.18 * sin(vUv.x * 50.265482 + vUv.y * 18.0);
        vec3 colour = mix(vec3(0.58, 0.70, 0.76), vec3(0.90, 0.97, 1.0), vUv.y);
        gl_FragColor = vec4(colour, band * shimmer * uBaseOpacity * uOpacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function createRingHoverOverlays({ group, radius }) {
  const overlays = new Map();
  RING_REGIONS.forEach((region, regionIndex) => {
    if (!["G Ring", "E Ring"].includes(region.name)) return;
    const overlayInnerKm = region.hoverInnerKm ?? region.innerKm;
    const overlayOuterKm = region.hoverOuterKm ?? region.outerKm;
    const innerRadius = radius * (overlayInnerKm / SATURN_EQUATORIAL_RADIUS_KM);
    const outerRadius = radius * (overlayOuterKm / SATURN_EQUATORIAL_RADIUS_KM);
    const overlay = new THREE.Mesh(
      new THREE.RingGeometry(innerRadius, outerRadius, region.name === "E Ring" ? 320 : 256, 1),
      createHoverOverlayMaterial(region.name === "E Ring" ? 0.24 : 0.19),
    );
    overlay.name = `${region.name} hover overlay`;
    overlay.rotation.x = Math.PI * 0.5;
    overlay.visible = false;
    overlay.renderOrder = 4;
    group.add(overlay);
    overlays.set(regionIndex, overlay);
  });
  return overlays;
}

/**
 * Invisible annuli are used only as precise pointer hit areas. They never write
 * colour or depth, so the visible ring system remains entirely particle-based.
 */
function createRingInteractionTargets({ group, planet, radius }) {
  return RING_REGIONS.map((region, regionIndex) => {
    const interactionInnerKm = region.hoverInnerKm ?? region.innerKm;
    const interactionOuterKm = region.hoverOuterKm ?? region.outerKm;
    const exactInner = radius * (interactionInnerKm / SATURN_EQUATORIAL_RADIUS_KM);
    const exactOuter = radius * (interactionOuterKm / SATURN_EQUATORIAL_RADIUS_KM);
    const minimumHitWidth = radius * (
      region.name === "F Ring" ? 0.045
        : region.name === "G Ring" ? 0.014
          : region.name === "E Ring" ? 0.020
            : 0.018
    );
    const radialPadding = Math.max(0, (minimumHitWidth - (exactOuter - exactInner)) * 0.5);
    const hitInner = Math.max(radius * 1.01, exactInner - radialPadding);
    const hitOuter = exactOuter + radialPadding;

    const target = new THREE.Mesh(
      new THREE.RingGeometry(hitInner, hitOuter, 256, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    target.name = `${region.name} interaction field`;
    markPointerProxy(target);
    target.rotation.x = Math.PI * 0.5;
    target.renderOrder = -100;
    target.userData = {
      name: region.name,
      isSaturnRing: true,
      isPlanetRing: true,
      ringIndex: regionIndex,
      parentPlanetObject: planet,
      info: {
        type: "Saturn ring group",
        description: region.description,
      },
      ringData: {
        order: `${regionIndex + 1} of ${RING_REGIONS.length} from Saturn outward`,
        character: region.character,
        radialRange: `${formatKilometres(region.innerKm)} – ${formatKilometres(region.outerKm)} from Saturn's centre`,
        description: region.description,
      },
      setHovered(active) {
        group.userData.setHoveredRegion?.(active ? regionIndex : -1);
      },
    };
    group.add(target);
    return target;
  });
}

/**
 * Creates Saturn's rings entirely from moving celestial particles. No
 * RingGeometry or textured solid annulus is used for Saturn.
 */
export function createSaturnRingSystem({
  planet,
  radius,
  quality = "high",
  hoverTargets = [],
}) {
  const profile = QUALITY_PROFILES[quality] ?? QUALITY_PROFILES.high;
  const random = createDeterministicRandom();
  const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);

  const group = new THREE.Group();
  group.name = "Saturn particle-resolved seven-group ring system";

  const grains = createGrainField(radius, profile.grainCount, random, pixelRatio);
  const chunks = createChunkField(radius, profile.chunkCount, random);
  group.add(grains, chunks);

  const hoverOverlays = createRingHoverOverlays({ group, radius });

  group.userData.animatedMaterials = [grains.material, chunks.material];
  group.userData.hoverOverlays = hoverOverlays;
  group.userData.hoveredRegionIndex = -1;
  group.userData.targetHoveredRegionIndex = -1;
  group.userData.hoverStrength = 0;
  group.userData.setHoveredRegion = (regionIndex) => {
    const nextIndex = Number.isInteger(regionIndex) && regionIndex >= 0
      ? regionIndex
      : -1;
    if (nextIndex >= 0 && group.userData.hoveredRegionIndex !== nextIndex) {
      group.userData.hoveredRegionIndex = nextIndex;
      group.userData.hoverStrength = Math.min(group.userData.hoverStrength, 0.34);
    }
    group.userData.targetHoveredRegionIndex = nextIndex;
  };

  const interactionTargets = createRingInteractionTargets({ group, planet, radius });
  group.userData.interactionTargets = interactionTargets;
  hoverTargets.push(...interactionTargets);

  group.userData.physicalModel = {
    saturnEquatorialRadiusKm: SATURN_EQUATORIAL_RADIUS_KM,
    saturnGMKm3S2: SATURN_GM_KM3_S2,
    physicalSecondsPerSceneSecond: PHYSICAL_SECONDS_PER_SCENE_SECOND,
    innerParticleSpeedKmS: Math.sqrt(SATURN_GM_KM3_S2 / RING_REGIONS[0].innerKm),
    outerParticleSpeedKmS: Math.sqrt(SATURN_GM_KM3_S2 / RING_REGIONS[RING_REGIONS.length - 1].outerKm),
    grainCount: profile.grainCount,
    chunkCount: profile.chunkCount,
    ringGroups: RING_REGIONS.map(({ name, innerKm, outerKm }) => ({ name, innerKm, outerKm })),
  };

  planet.add(group);
  return group;
}

const _saturnRingWorldPosition = new THREE.Vector3();

// Ring particle level of detail.
//
// Measured at the deep-zoom viewpoint: hiding Saturn's 148,000 ice grains alone
// moved the frame rate from 43.5 to 59.9 fps -- the single largest remaining
// cost in the scene, larger than all six moon systems and the whole asteroid
// belt combined.
//
// Unlike the Uranian rings this is NOT fill rate: these sprites shrink with
// distance and bottom out at 0.42 * pixelRatio. The cost is in the vertex
// shader, which resolves each grain's orbital position with a sin/cos pair per
// particle per frame -- 148,000 trig evaluations whether Saturn fills the screen
// or covers four pixels. Drawing fewer grains cuts that work proportionally.
//
// Saturn's rings are the most recognisable feature in the scene, so unlike the
// far fainter Uranian rings they are never culled outright; the population is
// only thinned, and always keeps a floor.
const SATURN_RING_LOD = {
  fullDetailPixels: 300,
  minimumDetailPixels: 22,
  minimumFraction: 0.10,
};

function applySaturnRingDetail(system, projectedRadiusPixels) {
  const span = SATURN_RING_LOD.fullDetailPixels - SATURN_RING_LOD.minimumDetailPixels;
  const raw = (projectedRadiusPixels - SATURN_RING_LOD.minimumDetailPixels) / Math.max(span, 1);
  const fraction = THREE.MathUtils.clamp(raw, SATURN_RING_LOD.minimumFraction, 1);

  system.traverse((object) => {
    // Guard everything: these subtrees are built conditionally, and a throw in
    // here happens inside the render loop and kills the frame.
    if (!object?.isPoints) return;
    const geometry = object.geometry;
    const position = geometry?.attributes?.position;
    if (!position) return;
    const total = geometry.userData.fullDrawCount
      ?? (geometry.userData.fullDrawCount = position.count);
    if (!total) return;
    const count = fraction >= 1 ? total : Math.max(1, Math.ceil(total * fraction));
    if (geometry.drawRange.count !== count) geometry.setDrawRange(0, count);
  });
}

export function updateSaturnRingSystem(system, time, camera = null) {
  if (!system?.userData?.animatedMaterials) return;

  if (camera && system.parent) {
    const worldPosition = _saturnRingWorldPosition;
    system.parent.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const focalPixels = (window.innerHeight * 0.5)
      / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const ringRadius = Number(system.parent.userData?.visualRadius ?? 1) * 2.3;
    applySaturnRingDetail(system, (ringRadius / Math.max(distance, 1e-4)) * focalPixels);
  }

  const targetIndex = system.userData.targetHoveredRegionIndex ?? -1;
  const targetStrength = targetIndex >= 0 ? 1 : 0;
  system.userData.hoverStrength = THREE.MathUtils.lerp(
    system.userData.hoverStrength ?? 0,
    targetStrength,
    targetStrength > 0 ? 0.18 : 0.12,
  );
  if (targetIndex < 0 && system.userData.hoverStrength < 0.012) {
    system.userData.hoverStrength = 0;
    system.userData.hoveredRegionIndex = -1;
  }

  system.userData.animatedMaterials.forEach((material) => {
    if (material?.uniforms?.uTime) material.uniforms.uTime.value = time;
    if (material?.uniforms?.uHoveredRegion) {
      material.uniforms.uHoveredRegion.value = system.userData.hoveredRegionIndex ?? -10;
    }
    if (material?.uniforms?.uHoverStrength) {
      material.uniforms.uHoverStrength.value = system.userData.hoverStrength ?? 0;
    }
  });

  system.userData.hoverOverlays?.forEach((overlay, regionIndex) => {
    const visible = targetIndex === regionIndex && (system.userData.hoverStrength ?? 0) > 0.02;
    overlay.visible = visible;
    if (overlay.material?.uniforms?.uOpacity) {
      overlay.material.uniforms.uOpacity.value = visible ? (system.userData.hoverStrength ?? 0) : 0;
    }
  });
}

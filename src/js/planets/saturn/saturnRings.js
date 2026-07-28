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
 * - Main ring particles move from about 23.8 km/s at the D-ring inner edge to
 *   about 16.4 km/s near the F ring.
 *
 * Time is uniformly compressed so the real 4.9-14.9 hour particle orbits are
 * visible in a browser while preserving their scientifically correct relative
 * speeds: inner particles always overtake outer particles smoothly.
 */
import * as THREE from "three";

const TAU = Math.PI * 2;
const SATURN_EQUATORIAL_RADIUS_KM = 60_268;
const SATURN_GM_KM3_S2 = 37_931_207.7;
const PHYSICAL_SECONDS_PER_SCENE_SECOND = 900;

const QUALITY_PROFILES = {
  low: { grainCount: 48_000, chunkCount: 460 },
  medium: { grainCount: 82_000, chunkCount: 820 },
  high: { grainCount: 132_000, chunkCount: 1_360 },
};

/**
 * The named ring boundaries use physical kilometres. Particle share is a
 * rendering allocation, not a claim about ring mass. A large share is assigned
 * to the optically dense B ring so it remains luminous without a solid mesh.
 */
const RING_REGIONS = [
  {
    name: "D ring",
    innerKm: 66_900,
    outerKm: 74_510,
    particleShare: 0.045,
    chunkShare: 0.018,
    lanes: 24,
    opacity: 0.34,
    thicknessScale: 0.00125,
    iceFraction: 0.972,
    palette: [0xbba991, 0xd6c7ad, 0x8e806f],
  },
  {
    name: "C ring",
    innerKm: 74_658,
    outerKm: 92_000,
    particleShare: 0.165,
    chunkShare: 0.105,
    lanes: 62,
    opacity: 0.54,
    thicknessScale: 0.00135,
    iceFraction: 0.982,
    palette: [0xc9b798, 0xead8b8, 0x9f8d75],
  },
  {
    name: "B ring",
    innerKm: 92_000,
    outerKm: 117_580,
    particleShare: 0.485,
    chunkShare: 0.505,
    lanes: 118,
    opacity: 0.88,
    thicknessScale: 0.00105,
    iceFraction: 0.994,
    palette: [0xf8edcf, 0xe8d7b5, 0xfff8e2],
  },
  {
    name: "A ring",
    innerKm: 122_170,
    outerKm: 136_775,
    particleShare: 0.265,
    chunkShare: 0.335,
    lanes: 86,
    opacity: 0.76,
    thicknessScale: 0.00115,
    iceFraction: 0.989,
    palette: [0xe7d4af, 0xf5e8ca, 0xc8b18d],
  },
  {
    name: "F ring",
    innerKm: 139_780,
    outerKm: 140_660,
    particleShare: 0.040,
    chunkShare: 0.037,
    lanes: 5,
    opacity: 0.68,
    thicknessScale: 0.00225,
    iceFraction: 0.988,
    palette: [0xfff5dc, 0xe3d4b9, 0xc7b699],
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
    },
    vertexShader: `
      attribute float aRadius;
      attribute float aAngle;
      attribute float aHeight;
      attribute float aAngularSpeed;
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 aColour;

      uniform float uTime;
      uniform float uPixelRatio;

      varying vec3 vColour;
      varying float vAlpha;

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
        gl_PointSize = clamp(
          aSize * uPixelRatio * distanceScale,
          0.42 * uPixelRatio,
          5.8 * uPixelRatio
        );

        vColour = aColour;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: `
      varying vec3 vColour;
      varying float vAlpha;

      void main() {
        vec2 centred = gl_PointCoord - vec2(0.5);
        float distanceFromCentre = length(centred);
        if (distanceFromCentre > 0.5) discard;

        float softEdge = 1.0 - smoothstep(0.34, 0.5, distanceFromCentre);
        float icyCore = 1.0 - smoothstep(0.0, 0.42, distanceFromCentre);
        vec3 colour = vColour * (0.92 + icyCore * 0.18);
        gl_FragColor = vec4(colour, softEdge * vAlpha);
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
      if (sizeSelector < 0.965) sizes[index] = 0.72 + random() * 0.58;
      else if (sizeSelector < 0.997) sizes[index] = 1.35 + random() * 0.95;
      else sizes[index] = 2.35 + random() * 1.55;

      alphas[index] = region.opacity * (0.70 + random() * 0.30);
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

      uniform float uTime;

      varying vec3 vColour;
      varying vec3 vViewNormal;

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

        vec4 mvPosition = modelViewMatrix * vec4(transformedPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColour;
      varying vec3 vViewNormal;

      void main() {
        vec3 lightDirection = normalize(vec3(0.42, 0.72, 0.55));
        float diffuse = max(dot(normalize(vViewNormal), lightDirection), 0.0);
        float backFill = max(dot(normalize(vViewNormal), -lightDirection), 0.0);
        float lighting = 0.30 + diffuse * 0.76 + backFill * 0.08;
        gl_FragColor = vec4(vColour * lighting, 1.0);
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

      // Most instanced bodies are car/house-scale visual representatives. A
      // very small fraction are enlarged mountain-class clumps for close views.
      const sizeSelector = random();
      let baseSize;
      if (sizeSelector < 0.925) baseSize = radius * (0.0010 + random() * 0.0017);
      else if (sizeSelector < 0.992) baseSize = radius * (0.0029 + random() * 0.0035);
      else baseSize = radius * (0.0070 + random() * 0.0085);

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

  const material = createChunkMaterial();
  const chunks = new THREE.Mesh(geometry, material);
  chunks.name = "Saturn independently orbiting ice and rock chunks";
  chunks.frustumCulled = false;
  chunks.renderOrder = 3;
  return chunks;
}

/**
 * Creates Saturn's rings entirely from moving celestial particles. No
 * RingGeometry or textured solid annulus is used for Saturn.
 */
export function createSaturnRingSystem({ planet, radius, quality = "high" }) {
  const profile = QUALITY_PROFILES[quality] ?? QUALITY_PROFILES.high;
  const random = createDeterministicRandom();
  const pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, 2);

  const group = new THREE.Group();
  group.name = "Saturn particle-resolved ring system";

  const grains = createGrainField(radius, profile.grainCount, random, pixelRatio);
  const chunks = createChunkField(radius, profile.chunkCount, random);
  group.add(grains, chunks);

  group.userData.animatedMaterials = [grains.material, chunks.material];
  group.userData.physicalModel = {
    saturnEquatorialRadiusKm: SATURN_EQUATORIAL_RADIUS_KM,
    saturnGMKm3S2: SATURN_GM_KM3_S2,
    physicalSecondsPerSceneSecond: PHYSICAL_SECONDS_PER_SCENE_SECOND,
    innerParticleSpeedKmS: Math.sqrt(SATURN_GM_KM3_S2 / 66_900),
    outerParticleSpeedKmS: Math.sqrt(SATURN_GM_KM3_S2 / 140_220),
    grainCount: profile.grainCount,
    chunkCount: profile.chunkCount,
  };

  planet.add(group);
  return group;
}

export function updateSaturnRingSystem(system, time) {
  if (!system?.userData?.animatedMaterials) return;
  system.userData.animatedMaterials.forEach((material) => {
    if (material?.uniforms?.uTime) material.uniforms.uTime.value = time;
  });
}

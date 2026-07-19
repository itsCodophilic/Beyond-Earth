import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Evidence-tiered 3D surfaces for Jupiter's complete 115-entry satellite
 * catalogue.
 *
 * Spacecraft-resolved moons receive geology-specific relief and materials.
 * Photometrically constrained outer moons receive family-appropriate colour,
 * albedo, shape and roughness. Unresolved objects receive deterministic,
 * individual asteroid-like shapes generated from their measured orbital family
 * and stable catalogue seed; their exact craters are intentionally not claimed
 * as real.
 */

export const JOVIAN_MOON_INSPECTION_LAYER = 6;

const SURFACE_PALETTES = Object.freeze({
  io: { base: 0xd8a82c, light: 0xffe8a2, dark: 0x3c251b, accent: 0xe85d18 },
  europa: { base: 0xb9ad98, light: 0xf2ead7, dark: 0x4e332e, accent: 0x9b553d },
  ganymede: { base: 0x66615b, light: 0xaaa493, dark: 0x292927, accent: 0x81776b },
  callisto: { base: 0x3b3834, light: 0x8c867c, dark: 0x151515, accent: 0xc0b59d },
  amalthea: { base: 0x774037, light: 0xad7b63, dark: 0x2c211f, accent: 0xd3b792 },
  thebe: { base: 0x5f3932, light: 0x8a6254, dark: 0x241d1c, accent: 0xa98770 },
  "inner-dark": { base: 0x47342f, light: 0x756057, dark: 0x1d1a19, accent: 0x9c7d6d },
  "c-type": { base: 0x5c5e5b, light: 0x858783, dark: 0x242525, accent: 0xa8a69e },
  "p-type": { base: 0x504843, light: 0x74675e, dark: 0x201e1d, accent: 0x8b796a },
  "d-type": { base: 0x664139, light: 0x8f5c4d, dark: 0x271d1a, accent: 0xac7962 },
  "mixed-dark": { base: 0x504a46, light: 0x766c65, dark: 0x201e1c, accent: 0x947665 },
});

const BASE_SURFACE = Object.freeze({
  broadRelief: 0.06,
  rockRelief: 0.028,
  fineRelief: 0.010,
  craterCount: 8,
  craterDepth: 0.065,
  craterRadiusMin: 0.075,
  craterRadiusMax: 0.21,
  ridgeCount: 0,
  ridgeWidthMin: 0.012,
  ridgeWidthMax: 0.028,
  ridgeRelief: 0,
  mountainCount: 0,
  mountainHeight: 0,
  mountainRadiusMin: 0.05,
  mountainRadiusMax: 0.14,
  chaosCount: 0,
  chaosRelief: 0,
  silhouetteWarp: 0.05,
  asymmetry: 0.035,
  bilobeStrength: 0.0,
  shardStrength: 0.035,
  colourContrast: 0.48,
  craterFloorDarkening: 0.54,
  craterRimBrightening: 0.30,
  flatShading: true,
  roughness: 1.0,
  clearcoat: 0,
  clearcoatRoughness: 1,
  emissiveIntensity: 0.012,
  envMapIntensity: 0.008,
});

const FAMILY_SURFACES = Object.freeze({
  "Galilean moon": {
    broadRelief: 0.005,
    rockRelief: 0.004,
    fineRelief: 0.002,
    craterCount: 10,
    craterDepth: 0.018,
    silhouetteWarp: 0.001,
    asymmetry: 0.0008,
    shardStrength: 0,
    flatShading: false,
    roughness: 0.90,
    emissiveIntensity: 0.010,
    envMapIntensity: 0.025,
  },
  "Inner regular moon": {
    broadRelief: 0.085,
    rockRelief: 0.036,
    fineRelief: 0.014,
    craterCount: 14,
    craterDepth: 0.095,
    craterRadiusMin: 0.08,
    craterRadiusMax: 0.25,
    silhouetteWarp: 0.075,
    asymmetry: 0.055,
    bilobeStrength: 0.015,
    shardStrength: 0.055,
    flatShading: true,
    roughness: 1,
  },
  "Himalia family": {
    broadRelief: 0.075,
    rockRelief: 0.033,
    fineRelief: 0.013,
    craterCount: 12,
    craterDepth: 0.082,
    silhouetteWarp: 0.065,
    asymmetry: 0.050,
    bilobeStrength: 0.018,
    shardStrength: 0.050,
  },
  "Ananke family": {
    broadRelief: 0.092,
    rockRelief: 0.038,
    fineRelief: 0.015,
    craterCount: 9,
    craterDepth: 0.080,
    silhouetteWarp: 0.085,
    asymmetry: 0.060,
    bilobeStrength: 0.030,
    shardStrength: 0.065,
  },
  "Carme family": {
    broadRelief: 0.088,
    rockRelief: 0.037,
    fineRelief: 0.015,
    craterCount: 10,
    craterDepth: 0.078,
    silhouetteWarp: 0.080,
    asymmetry: 0.058,
    bilobeStrength: 0.024,
    shardStrength: 0.060,
  },
  "Pasiphae family": {
    broadRelief: 0.100,
    rockRelief: 0.042,
    fineRelief: 0.016,
    craterCount: 8,
    craterDepth: 0.084,
    silhouetteWarp: 0.092,
    asymmetry: 0.065,
    bilobeStrength: 0.038,
    shardStrength: 0.072,
  },
  "Themisto group": {
    broadRelief: 0.094,
    rockRelief: 0.039,
    fineRelief: 0.015,
    craterCount: 8,
    craterDepth: 0.080,
    silhouetteWarp: 0.082,
    asymmetry: 0.060,
    bilobeStrength: 0.028,
    shardStrength: 0.064,
  },
  "Carpo group": {
    broadRelief: 0.106,
    rockRelief: 0.044,
    fineRelief: 0.017,
    craterCount: 7,
    craterDepth: 0.086,
    silhouetteWarp: 0.100,
    asymmetry: 0.075,
    bilobeStrength: 0.050,
    shardStrength: 0.082,
  },
  "Valetudo group": {
    broadRelief: 0.112,
    rockRelief: 0.046,
    fineRelief: 0.018,
    craterCount: 6,
    craterDepth: 0.088,
    silhouetteWarp: 0.110,
    asymmetry: 0.082,
    bilobeStrength: 0.058,
    shardStrength: 0.092,
  },
});

const NAMED_SURFACES = Object.freeze({
  Io: {
    broadRelief: 0.0032,
    rockRelief: 0.0026,
    fineRelief: 0.0014,
    // Io's continually renewed lava plains erase ordinary impact craters.
    // Its depressions are rendered separately as volcanic calderas/paterae.
    craterCount: 0,
    craterDepth: 0,
    mountainCount: 28,
    mountainHeight: 0.0125,
    mountainRadiusMin: 0.035,
    mountainRadiusMax: 0.105,
    colourContrast: 0.60,
    roughness: 0.83,
    emissiveIntensity: 0.020,
  },
  Europa: {
    broadRelief: 0.0010,
    rockRelief: 0.00085,
    fineRelief: 0.00055,
    craterCount: 3,
    craterDepth: 0.0020,
    craterRadiusMin: 0.035,
    craterRadiusMax: 0.10,
    ridgeCount: 56,
    ridgeWidthMin: 0.005,
    ridgeWidthMax: 0.018,
    ridgeRelief: -0.0025,
    chaosCount: 24,
    chaosRelief: 0.0021,
    colourContrast: 0.36,
    roughness: 0.70,
    clearcoat: 0.20,
    clearcoatRoughness: 0.54,
    envMapIntensity: 0.055,
  },
  Ganymede: {
    broadRelief: 0.0035,
    rockRelief: 0.0031,
    fineRelief: 0.0016,
    craterCount: 24,
    craterDepth: 0.0070,
    craterRadiusMin: 0.035,
    craterRadiusMax: 0.15,
    ridgeCount: 44,
    ridgeWidthMin: 0.008,
    ridgeWidthMax: 0.026,
    ridgeRelief: 0.0038,
    chaosCount: 7,
    chaosRelief: 0.0028,
    colourContrast: 0.50,
    roughness: 0.88,
    clearcoat: 0.045,
    clearcoatRoughness: 0.80,
  },
  Callisto: {
    broadRelief: 0.0040,
    rockRelief: 0.0031,
    fineRelief: 0.0017,
    craterCount: 58,
    craterDepth: 0.0105,
    craterRadiusMin: 0.026,
    craterRadiusMax: 0.14,
    colourContrast: 0.56,
    craterFloorDarkening: 0.62,
    craterRimBrightening: 0.58,
    roughness: 0.96,
  },
  Amalthea: {
    broadRelief: 0.095,
    rockRelief: 0.040,
    fineRelief: 0.016,
    craterCount: 16,
    craterDepth: 0.115,
    mountainCount: 5,
    mountainHeight: 0.040,
    silhouetteWarp: 0.095,
    asymmetry: 0.070,
    shardStrength: 0.065,
    colourContrast: 0.62,
  },
  Thebe: {
    broadRelief: 0.090,
    rockRelief: 0.038,
    fineRelief: 0.015,
    craterCount: 14,
    craterDepth: 0.108,
    silhouetteWarp: 0.090,
    asymmetry: 0.066,
    shardStrength: 0.062,
  },
  Metis: {
    // Galileo resolved the overall collision-shaped body, but not individual
    // craters. Do not invent prominent mapped bowls that the imagery cannot
    // support; its impact history is expressed through its silhouette instead.
    craterCount: 0,
    craterDepth: 0,
    silhouetteWarp: 0.088,
    asymmetry: 0.070,
    bilobeStrength: 0.035,
    shardStrength: 0.072,
  },
  Adrastea: {
    craterCount: 0,
    craterDepth: 0,
    silhouetteWarp: 0.100,
    asymmetry: 0.078,
    bilobeStrength: 0.045,
    shardStrength: 0.082,
  },
  Himalia: {
    craterCount: 18,
    craterDepth: 0.090,
    silhouetteWarp: 0.075,
    asymmetry: 0.055,
    bilobeStrength: 0.015,
    shardStrength: 0.050,
  },
  Elara: { craterCount: 13, craterDepth: 0.086, silhouetteWarp: 0.072 },
  Pasiphae: { craterCount: 13, craterDepth: 0.090, bilobeStrength: 0.040 },
  Sinope: { craterCount: 11, craterDepth: 0.086, colourContrast: 0.58 },
  Carme: { craterCount: 12, craterDepth: 0.086, colourContrast: 0.62 },
  Ananke: { craterCount: 11, craterDepth: 0.088, bilobeStrength: 0.032 },
  Themisto: { craterCount: 9, craterDepth: 0.086 },
  Carpo: { craterCount: 7, craterDepth: 0.090, shardStrength: 0.088 },
  Valetudo: { craterCount: 5, craterDepth: 0.092, shardStrength: 0.100 },
});

const NAMED_CRATERS = Object.freeze({
  Amalthea: [
    { center: [0.90, 0.18, 0.40], radius: 0.34, depth: 1.30, rim: 1.15 },
    { center: [-0.56, -0.18, 0.81], radius: 0.27, depth: 1.10, rim: 1.00 },
  ],
  Thebe: [
    { center: [0.76, 0.30, -0.57], radius: 0.31, depth: 1.28, rim: 1.12 },
  ],
  Callisto: [
    { center: [-0.42, 0.58, 0.70], radius: 0.24, depth: 0.78, rim: 1.25 },
  ],
});

const CALLOUT_DIRECTIONS = Object.freeze({
  callistoBasin: new THREE.Vector3(0.36, 0.62, -0.70).normalize(),
  amaltheaPatchA: new THREE.Vector3(0.76, 0.36, 0.54).normalize(),
  amaltheaPatchB: new THREE.Vector3(-0.58, -0.20, 0.79).normalize(),
});

function hash3(x, y, z, seed) {
  const value = Math.sin(
    x * 127.1
    + y * 311.7
    + z * 74.7
    + seed * 97.13,
  ) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function smoothNoise3(x, y, z, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const sample = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, seed);
  const x00 = THREE.MathUtils.lerp(sample(0, 0, 0), sample(1, 0, 0), ux);
  const x10 = THREE.MathUtils.lerp(sample(0, 1, 0), sample(1, 1, 0), ux);
  const x01 = THREE.MathUtils.lerp(sample(0, 0, 1), sample(1, 0, 1), ux);
  const x11 = THREE.MathUtils.lerp(sample(0, 1, 1), sample(1, 1, 1), ux);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(x00, x10, uy),
    THREE.MathUtils.lerp(x01, x11, uy),
    uz,
  );
}

function fbm3(direction, frequency, octaves, seed) {
  let value = 0;
  let amplitude = 0.5;
  let normalization = 0;
  let scale = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += smoothNoise3(
      direction.x * scale,
      direction.y * scale,
      direction.z * scale,
      seed + octave * 19.71,
    ) * amplitude;
    normalization += amplitude;
    amplitude *= 0.51;
    scale *= 2.04;
  }
  return value / Math.max(0.0001, normalization);
}

function smoothstep(edge0, edge1, value) {
  if (Math.abs(edge1 - edge0) < 1e-8) return value >= edge1 ? 1 : 0;
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function random01(seed, index, channel = 0) {
  const value = Math.sin(seed * 893.17 + index * 127.63 + channel * 311.91) * 43758.5453;
  return value - Math.floor(value);
}

function randomDirection(seed, index) {
  const z = random01(seed, index, 0) * 2 - 1;
  const angle = random01(seed, index, 1) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

function resolveSurfaceSettings(profile) {
  return {
    ...BASE_SURFACE,
    ...(FAMILY_SURFACES[profile.family] ?? {}),
    ...(NAMED_SURFACES[profile.catalogueName] ?? {}),
    roughness: NAMED_SURFACES[profile.catalogueName]?.roughness
      ?? profile.surfaceRoughness
      ?? FAMILY_SURFACES[profile.family]?.roughness
      ?? BASE_SURFACE.roughness,
  };
}

function detailFor(profile, quality, mode = "preview") {
  const isHero = profile.family === "Galilean moon";
  const isInner = profile.family === "Inner regular moon";
  const inspection = mode === "inspection";

  // Three.js's IcosahedronGeometry `detail` value is a linear subdivision count,
  // not an exponential level: detail 5 is only about 720 triangles. The former
  // values therefore exposed large polygon patches in close-up. These values
  // produce roughly 22k triangles for a high-quality Galilean inspection while
  // keeping all non-selected moons in a much smaller preview budget.
  if (inspection) {
    if (isHero) return quality === "low" ? 18 : quality === "medium" ? 26 : 32;
    if (isInner) return quality === "low" ? 12 : quality === "medium" ? 16 : 22;
    // Irregular moons must retain their battered silhouette in close-up
    // without exposing the triangles of the underlying icosahedron.
    return quality === "low" ? 10 : quality === "medium" ? 14 : 18;
  }

  if (isHero) return quality === "low" ? 4 : quality === "medium" ? 6 : 8;
  if (isInner) return quality === "low" ? 2 : quality === "medium" ? 3 : 4;
  return quality === "low" ? 1 : 2;
}

function resolveModeSettings(profile, mode = "preview") {
  const settings = resolveSurfaceSettings(profile);
  const inspection = mode === "inspection";
  const isHero = profile.family === "Galilean moon";
  const isInner = profile.family === "Inner regular moon";

  // Relief that is physically subtle becomes visually flat at cinematic scale.
  // Close inspection therefore uses the same restrained exaggeration principle
  // as Earth's Moon displacement mesh: enough true geometry to catch light,
  // while retaining each body's characteristic terrain and silhouette.
  const reliefBoost = inspection
    ? (isHero ? 1.52 : isInner ? 1.50 : 1.34)
    : (isHero ? 1.12 : 1.06);

  settings.broadRelief *= reliefBoost;
  settings.rockRelief *= reliefBoost;
  settings.fineRelief *= inspection ? reliefBoost * 1.12 : reliefBoost;
  settings.craterDepth *= inspection ? (isHero ? 1.28 : 1.30) : 1.02;
  settings.ridgeRelief *= inspection ? 1.85 : 1.08;
  settings.mountainHeight *= inspection ? 1.70 : 1.05;
  settings.chaosRelief *= inspection ? 1.85 : 1.05;
  settings.silhouetteWarp *= inspection ? 1.08 : 1.0;
  settings.asymmetry *= inspection ? 1.06 : 1.0;
  settings.shardStrength *= inspection ? 1.07 : 1.0;
  settings.craterRimBrightening *= inspection ? 1.18 : 1.0;
  settings.colourContrast *= inspection ? 1.16 : 1.0;

  if (inspection) {
    // A selected satellite is always smooth-shaded. Its silhouette and relief
    // remain true geometry, but the mesh no longer advertises its triangles as
    // a low-poly game asset. Preview rocks may remain lightly faceted because
    // they occupy only a few pixels and benefit from the cheaper geometry.
    settings.flatShading = false;

    // These counts describe feature density, not claimed crater coordinates.
    // Spacecraft-resolved worlds follow their observed geology; unresolved
    // irregular moons receive restrained, family-appropriate impact relief.
    if (profile.catalogueName === "Callisto") {
      settings.craterCount = Math.max(settings.craterCount, 68);
    } else if (profile.catalogueName === "Ganymede") {
      settings.craterCount = Math.max(settings.craterCount, 34);
    } else if (profile.catalogueName === "Europa") {
      settings.craterCount = Math.min(settings.craterCount, 3);
    } else if (profile.catalogueName === "Io") {
      settings.craterCount = 0;
    } else if (isInner && !["Metis", "Adrastea"].includes(profile.catalogueName)) {
      settings.craterCount = Math.max(settings.craterCount, 18);
    } else if (!isHero && !isInner) {
      settings.craterCount = Math.max(settings.craterCount, 16);
    }
  }

  settings.renderMode = mode;
  return settings;
}

function makeCraterField(profile, settings) {
  const craters = Array.from({ length: settings.craterCount }, (_, index) => {
    const radius = settings.craterRadiusMin
      + random01(profile.seed, index, 2) * (settings.craterRadiusMax - settings.craterRadiusMin);
    return {
      center: randomDirection(profile.seed + 3.17, index),
      radius,
      cosLimit: Math.cos(radius * 1.30),
      depth: settings.craterDepth * (0.42 + random01(profile.seed, index, 3) * 0.82),
      rim: settings.craterDepth * (0.16 + random01(profile.seed, index, 4) * 0.22),
    };
  });

  (NAMED_CRATERS[profile.catalogueName] ?? []).forEach((crater) => {
    craters.push({
      center: new THREE.Vector3(...crater.center).normalize(),
      radius: crater.radius,
      cosLimit: Math.cos(crater.radius * 1.30),
      depth: settings.craterDepth * crater.depth,
      rim: settings.craterDepth * 0.24 * crater.rim,
    });
  });
  return craters;
}

function sampleCrater(direction, crater) {
  const alignment = THREE.MathUtils.clamp(direction.dot(crater.center), -1, 1);
  // Most vertices are nowhere near a given crater. Reject them with a cheap
  // cosine comparison before paying for acos; this keeps 68-crater Callisto
  // responsive even with a real close-up mesh.
  if (alignment < crater.cosLimit) return { height: 0, floor: 0, rim: 0, ejecta: 0 };
  const angularDistance = Math.acos(alignment);
  const normalized = angularDistance / crater.radius;
  if (normalized > 1.30) return { height: 0, floor: 0, rim: 0, ejecta: 0 };
  const bowl = -crater.depth * Math.pow(Math.max(0, 1 - normalized * normalized), 1.30);
  const rim = crater.rim * Math.exp(-Math.pow((normalized - 0.97) / 0.12, 2));
  const ejecta = Math.exp(-Math.pow((normalized - 1.12) / 0.24, 2));
  return {
    height: bowl + rim,
    floor: 1 - smoothstep(0.08, 0.90, normalized),
    rim: Math.exp(-Math.pow((normalized - 0.98) / 0.13, 2)),
    ejecta,
  };
}

/**
 * Io's dark pits are volcanic paterae rather than impact craters. They use a
 * shallow collapsed floor, a broken rim, and occasional hot inner material so
 * the geometry matches the process instead of borrowing lunar crater logic.
 */
function makeIoVolcanicField(profile, mode = "preview") {
  if (profile.catalogueName !== "Io") return [];
  const count = mode === "inspection" ? 34 : 20;
  return Array.from({ length: count }, (_, index) => {
    const radius = 0.022 + random01(profile.seed, index, 12) * 0.072;
    return {
      center: randomDirection(profile.seed + 467.3, index),
      radius,
      cosLimit: Math.cos(radius * 1.24),
      depth: 0.0035 + random01(profile.seed, index, 14) * 0.0065,
      rim: 0.0012 + random01(profile.seed, index, 15) * 0.0022,
      hot: random01(profile.seed, index, 13) > 0.73,
    };
  });
}

function sampleIoCaldera(direction, caldera) {
  const alignment = THREE.MathUtils.clamp(direction.dot(caldera.center), -1, 1);
  if (alignment < caldera.cosLimit) return { height: 0, mask: 0, rim: 0 };
  const angularDistance = Math.acos(alignment);
  const normalized = angularDistance / caldera.radius;
  if (normalized > 1.24) return { height: 0, mask: 0, rim: 0 };
  const floor = -caldera.depth * (1 - smoothstep(0.34, 0.88, normalized));
  const rimMask = Math.exp(-Math.pow((normalized - 0.92) / 0.13, 2));
  return {
    height: floor + rimMask * caldera.rim,
    mask: 1 - smoothstep(0.16, 1.0, normalized),
    rim: rimMask,
  };
}

function makeGreatCircleFeatures(profile, settings) {
  return Array.from({ length: settings.ridgeCount }, (_, index) => ({
    normal: randomDirection(profile.seed + 31.7, index),
    width: settings.ridgeWidthMin
      + random01(profile.seed, index, 5) * (settings.ridgeWidthMax - settings.ridgeWidthMin),
    phase: random01(profile.seed, index, 6) * Math.PI * 2,
    relief: settings.ridgeRelief * (0.62 + random01(profile.seed, index, 7) * 0.65),
  }));
}

function sampleGreatCircle(direction, feature, seed) {
  const distance = Math.abs(direction.dot(feature.normal));
  const line = 1 - smoothstep(feature.width * 0.18, feature.width, distance);
  const broken = 0.54 + 0.46 * smoothNoise3(
    direction.x * 42,
    direction.y * 42,
    direction.z * 42,
    seed + feature.phase,
  );
  return line * THREE.MathUtils.clamp(broken + 0.20, 0, 1);
}

function makeMountainField(profile, settings) {
  return Array.from({ length: settings.mountainCount }, (_, index) => ({
    center: randomDirection(profile.seed + 67.3, index),
    radius: settings.mountainRadiusMin
      + random01(profile.seed, index, 8) * (settings.mountainRadiusMax - settings.mountainRadiusMin),
    height: settings.mountainHeight * (0.55 + random01(profile.seed, index, 9) * 0.85),
  }));
}

function sampleMountain(direction, mountain) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(mountain.center), -1, 1));
  const normalized = distance / mountain.radius;
  if (normalized > 1) return 0;
  return mountain.height * Math.pow(Math.max(0, 1 - normalized), 1.8);
}

function makePatchField(profile, settings) {
  return Array.from({ length: settings.chaosCount }, (_, index) => ({
    center: randomDirection(profile.seed + 103.9, index),
    radius: 0.07 + random01(profile.seed, index, 10) * 0.18,
    intensity: 0.45 + random01(profile.seed, index, 11) * 0.55,
  }));
}

function sampleSpot(direction, center, radius) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  return 1 - smoothstep(radius * 0.28, radius, distance);
}

function samplePatchField(direction, patches) {
  let mask = 0;
  patches.forEach((patch) => {
    mask = Math.max(mask, sampleSpot(direction, patch.center, patch.radius) * patch.intensity);
  });
  return mask;
}

function sampleCallistoBasin(direction) {
  const angularDistance = Math.acos(
    THREE.MathUtils.clamp(direction.dot(CALLOUT_DIRECTIONS.callistoBasin), -1, 1),
  );
  const basin = 1 - smoothstep(0.16, 0.42, angularDistance);
  let rings = 0;
  [0.18, 0.25, 0.32, 0.39, 0.46].forEach((ringRadius, index) => {
    const width = 0.012 + index * 0.002;
    rings = Math.max(rings, Math.exp(-Math.pow((angularDistance - ringRadius) / width, 2)));
  });
  return { basin, rings };
}

function morphologyWarp(direction, profile, settings) {
  if (profile.family === "Galilean moon") return 0;
  const axisA = randomDirection(profile.seed + 211.3, 0);
  const axisB = randomDirection(profile.seed + 277.9, 1);
  const axisC = randomDirection(profile.seed + 331.1, 2);
  const lobe = (Math.pow(Math.abs(direction.dot(axisA)), 3.2) - 0.28) * settings.silhouetteWarp;
  const asymmetry = direction.dot(axisB) * settings.asymmetry;
  const shard = Math.pow(Math.max(0, direction.dot(axisC)), 4.0) * settings.shardStrength;
  const neck = -Math.exp(-Math.pow(direction.dot(axisA) / 0.24, 2)) * settings.bilobeStrength;
  return lobe + asymmetry + shard + neck;
}

function setVertexColour(target, index, colour) {
  target[index * 3] = colour.r;
  target[index * 3 + 1] = colour.g;
  target[index * 3 + 2] = colour.b;
}

function createJovianGeometry(profile, quality, mode = "preview") {
  const settings = resolveModeSettings(profile, mode);
  const sourceGeometry = new THREE.IcosahedronGeometry(1, detailFor(profile, quality, mode));
  const positions = sourceGeometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const palette = SURFACE_PALETTES[profile.appearance] ?? SURFACE_PALETTES["mixed-dark"];
  const baseColour = new THREE.Color(palette.base);
  const lightColour = new THREE.Color(palette.light);
  const darkColour = new THREE.Color(palette.dark);
  const accentColour = new THREE.Color(palette.accent);
  const sulfurWhite = new THREE.Color(0xfff2b5);
  const sulfurOrange = new THREE.Color(0xef7a1e);
  const direction = new THREE.Vector3();
  const colour = new THREE.Color();
  const usesSpacecraftMosaic = HERO_GALILEAN_TEXTURES.has(profile.catalogueName);
  const craterField = usesSpacecraftMosaic ? [] : makeCraterField(profile, settings);
  const ridges = usesSpacecraftMosaic ? [] : makeGreatCircleFeatures(profile, settings);
  const mountains = usesSpacecraftMosaic ? [] : makeMountainField(profile, settings);
  const patches = usesSpacecraftMosaic ? [] : makePatchField(profile, settings);

  const ioVolcanoes = usesSpacecraftMosaic ? [] : makeIoVolcanicField(profile, mode);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    const broad = fbm3(direction, 1.45, 4, profile.seed + 7) * settings.broadRelief;
    const rocky = fbm3(direction, 6.2, 4, profile.seed + 47) * settings.rockRelief;
    const fine = fbm3(direction, 22.0, 3, profile.seed + 101) * settings.fineRelief;
    const morphology = morphologyWarp(direction, profile, settings);

    let craterHeight = 0;
    let craterFloor = 0;
    let craterRim = 0;
    let craterEjecta = 0;
    craterField.forEach((crater) => {
      const sample = sampleCrater(direction, crater);
      craterHeight += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rim);
      craterEjecta = Math.max(craterEjecta, sample.ejecta);
    });

    let ridgeMask = 0;
    let ridgeHeight = 0;
    ridges.forEach((ridge) => {
      const sample = sampleGreatCircle(direction, ridge, profile.seed);
      ridgeMask = Math.max(ridgeMask, sample);
      ridgeHeight += sample * ridge.relief;
    });

    let mountainHeight = 0;
    mountains.forEach((mountain) => {
      mountainHeight += sampleMountain(direction, mountain);
    });

    const patchMask = samplePatchField(direction, patches);
    const patchHeight = patchMask
      * settings.chaosRelief
      * (0.45 + 0.55 * fbm3(direction, 18, 3, profile.seed + 509));

    const callistoBasin = profile.catalogueName === "Callisto" && !usesSpacecraftMosaic
      ? sampleCallistoBasin(direction)
      : { basin: 0, rings: 0 };
    const basinHeight = profile.catalogueName === "Callisto" && !usesSpacecraftMosaic
      ? -callistoBasin.basin * 0.0035 + callistoBasin.rings * 0.0022
      : 0;

    let volcanicHeight = 0;
    let volcanicMask = 0;
    let volcanicHotMask = 0;
    let volcanicRim = 0;
    ioVolcanoes.forEach((caldera) => {
      const sample = sampleIoCaldera(direction, caldera);
      volcanicHeight += sample.height;
      volcanicMask = Math.max(volcanicMask, sample.mask);
      if (caldera.hot) volcanicHotMask = Math.max(volcanicHotMask, sample.mask);
      volcanicRim = Math.max(volcanicRim, sample.rim);
    });

    const proceduralReliefScale = usesSpacecraftMosaic
      ? (mode === "inspection" ? 0.12 : 0.035)
      : 1;
    const radialHeight = Math.max(
      profile.family === "Galilean moon" ? 0.97 : 0.55,
      1
        + (broad + rocky + fine) * proceduralReliefScale
        + morphology
        + craterHeight
        + ridgeHeight
        + mountainHeight
        + patchHeight
        + basinHeight
        + volcanicHeight,
    );

    positions.setXYZ(
      index,
      direction.x * radialHeight,
      direction.y * radialHeight,
      direction.z * radialHeight,
    );

    const colourNoise = fbm3(direction, 7.8, 4, profile.seed + 163) * 0.5 + 0.5;
    const macroMottle = fbm3(direction, 2.7, 3, profile.seed + 229) * 0.5 + 0.5;
    colour.copy(baseColour)
      .lerp(lightColour, THREE.MathUtils.clamp(colourNoise * settings.colourContrast, 0, 0.70))
      .lerp(darkColour, THREE.MathUtils.clamp((1 - macroMottle) * 0.18, 0, 0.24));

    colour.lerp(
      darkColour,
      THREE.MathUtils.clamp(craterFloor * settings.craterFloorDarkening, 0, 0.72),
    );
    colour.lerp(
      lightColour,
      THREE.MathUtils.clamp(craterRim * settings.craterRimBrightening, 0, 0.72),
    );

    if (profile.catalogueName === "Io") {
      const sulfurField = fbm3(direction, 3.8, 4, profile.seed + 601) * 0.5 + 0.5;
      colour.lerp(sulfurWhite, smoothstep(0.56, 0.88, sulfurField) * 0.52);
      colour.lerp(sulfurOrange, smoothstep(0.18, 0.50, 1 - sulfurField) * 0.30);
      colour.lerp(accentColour, volcanicMask * 0.76);
      colour.lerp(darkColour, volcanicHotMask * 0.96);
      colour.lerp(sulfurWhite, volcanicRim * 0.22);
    } else if (profile.catalogueName === "Europa") {
      colour.lerp(accentColour, THREE.MathUtils.clamp(ridgeMask * 0.88, 0, 0.90));
      colour.lerp(darkColour, THREE.MathUtils.clamp(patchMask * 0.20, 0, 0.25));
      colour.lerp(lightColour, (1 - patchMask) * 0.08);
    } else if (profile.catalogueName === "Ganymede") {
      colour.lerp(lightColour, THREE.MathUtils.clamp(ridgeMask * 0.56, 0, 0.64));
      colour.lerp(darkColour, THREE.MathUtils.clamp(patchMask * 0.40, 0, 0.48));
    } else if (profile.catalogueName === "Callisto") {
      colour.lerp(accentColour, THREE.MathUtils.clamp(craterRim * 0.64 + craterEjecta * 0.16, 0, 0.72));
      colour.lerp(lightColour, THREE.MathUtils.clamp(callistoBasin.rings * 0.50, 0, 0.58));
      colour.lerp(darkColour, THREE.MathUtils.clamp(callistoBasin.basin * 0.14, 0, 0.18));
    }

    if (profile.catalogueName === "Amalthea") {
      const patchA = sampleSpot(direction, CALLOUT_DIRECTIONS.amaltheaPatchA, 0.22);
      const patchB = sampleSpot(direction, CALLOUT_DIRECTIONS.amaltheaPatchB, 0.16);
      colour.lerp(accentColour, Math.max(patchA, patchB) * 0.68);
    }

    // Distant irregulars are family-coloured, but each receives unique impact
    // mottling and facet contrast from its stable seed.
    if (profile.surfaceEvidence !== "spacecraft-resolved") {
      const facetMottle = fbm3(direction, 13.0, 2, profile.seed + 733) * 0.5 + 0.5;
      colour.lerp(lightColour, smoothstep(0.72, 0.96, facetMottle) * 0.16);
      colour.lerp(darkColour, smoothstep(0.76, 0.98, 1 - facetMottle) * 0.18);
    }

    setVertexColour(colours, index, colour);
  }

  sourceGeometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  sourceGeometry.deleteAttribute("normal");

  let finalGeometry;
  if (settings.flatShading) {
    finalGeometry = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
    if (finalGeometry !== sourceGeometry) sourceGeometry.dispose();
    finalGeometry.computeVertexNormals();
  } else {
    finalGeometry = mergeVertices(sourceGeometry, 1e-5);
    sourceGeometry.dispose();
    finalGeometry.computeVertexNormals();
  }

  finalGeometry.computeBoundingSphere();
  finalGeometry.computeBoundingBox();
  finalGeometry.userData = {
    surfaceEvidence: profile.surfaceEvidence,
    surfaceStructure: profile.surfaceStructure,
    surfaceFamily: profile.family,
    flatShading: settings.flatShading,
  };
  return { geometry: finalGeometry, settings, palette };
}

function inspectionTextureWidth(profile, quality) {
  if (profile.family === "Galilean moon") {
    return quality === "low" ? 256 : quality === "medium" ? 320 : 384;
  }
  return quality === "low" ? 128 : quality === "medium" ? 192 : 256;
}

function createInspectionBumpTexture(profile, settings, quality = "high") {
  // The old 128×64 map spread each bump across a visibly broad patch. This
  // higher-resolution, lazily-created map keeps close-up pits, grooves and
  // regolith granular while allocating it only to the selected moon.
  const width = inspectionTextureWidth(profile, quality);
  const height = width * 0.5;
  const pixels = new Uint8Array(width * height * 4);
  const direction = new THREE.Vector3();
  const craters = makeCraterField(profile, {
    ...settings,
    craterCount: Math.min(settings.craterCount, profile.catalogueName === "Callisto" ? 68 : 34),
  });
  const ridges = makeGreatCircleFeatures(profile, settings);
  const mountains = makeMountainField(profile, settings);
  const patches = makePatchField(profile, settings);
  const ioVolcanoes = makeIoVolcanicField(profile, "inspection");

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const theta = v * Math.PI;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const phi = u * Math.PI * 2 - Math.PI;
      direction.set(
        Math.cos(phi) * sinTheta,
        cosTheta,
        Math.sin(phi) * sinTheta,
      );

      let relief = 0.50
        + fbm3(direction, 2.2, 4, profile.seed + 907) * 0.14
        + fbm3(direction, 13.5, 3, profile.seed + 977) * 0.055;

      craters.forEach((crater) => {
        const sample = sampleCrater(direction, crater);
        relief += sample.height * 2.15 + sample.rim * 0.20;
      });

      ridges.forEach((ridge) => {
        // Preserve the geological sign: Europa's reddish lineae cut subtly
        // into the ice while Ganymede's grooved terrain rises into ridges.
        relief += sampleGreatCircle(direction, ridge, profile.seed + 19)
          * ridge.relief
          * 9.0;
      });

      mountains.forEach((mountain) => {
        relief += sampleMountain(direction, mountain) * 2.4;
      });

      ioVolcanoes.forEach((caldera) => {
        relief += sampleIoCaldera(direction, caldera).height * 5.2;
      });

      const patch = samplePatchField(direction, patches);
      relief += patch * 0.045;

      if (profile.catalogueName === "Callisto") {
        const basin = sampleCallistoBasin(direction);
        relief += basin.rings * 0.10 - basin.basin * 0.045;
      }

      const value = Math.round(THREE.MathUtils.clamp(relief, 0, 1) * 255);
      const offset = (y * width + x) * 4;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.name = `${profile.name} procedural inspection relief`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}


const HERO_GALILEAN_TEXTURES = new Set(["Io", "Europa", "Ganymede", "Callisto"]);

const HERO_GALILEAN_ASSET_URLS = Object.freeze({
  Io: {
    albedo: new URL("../../../../assets/textures/jovian/io-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/jovian/io-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/jovian/io-roughness.jpg", import.meta.url).href,
  },
  Europa: {
    albedo: new URL("../../../../assets/textures/jovian/europa-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/jovian/europa-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/jovian/europa-roughness.jpg", import.meta.url).href,
  },
  Ganymede: {
    albedo: new URL("../../../../assets/textures/jovian/ganymede-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/jovian/ganymede-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/jovian/ganymede-roughness.jpg", import.meta.url).href,
  },
  Callisto: {
    albedo: new URL("../../../../assets/textures/jovian/callisto-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/jovian/callisto-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/jovian/callisto-roughness.jpg", import.meta.url).href,
  },
});

const HERO_GALILEAN_MATERIAL = Object.freeze({
  Io: {
    roughness: 0.84,
    previewBumpScale: 0.018,
    inspectionBumpScale: 0.038,
    displacementScale: 0.0060,
    displacementBias: -0.0030,
    envMapIntensity: 0.018,
  },
  Europa: {
    roughness: 0.68,
    previewBumpScale: 0.007,
    inspectionBumpScale: 0.018,
    displacementScale: 0.0026,
    displacementBias: -0.0013,
    envMapIntensity: 0.040,
  },
  Ganymede: {
    roughness: 0.90,
    previewBumpScale: 0.014,
    inspectionBumpScale: 0.032,
    displacementScale: 0.0055,
    displacementBias: -0.00275,
    envMapIntensity: 0.020,
  },
  Callisto: {
    roughness: 0.97,
    previewBumpScale: 0.020,
    inspectionBumpScale: 0.046,
    displacementScale: 0.0074,
    displacementBias: -0.0037,
    envMapIntensity: 0.012,
  },
});

const heroTextureLoader = new THREE.TextureLoader();
const heroTextureCache = new Map();

function loadPersistentHeroTexture(url, { color = false } = {}) {
  if (!url) return null;
  if (heroTextureCache.has(url)) return heroTextureCache.get(url);

  const texture = heroTextureLoader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.userData.persistentJovianTexture = true;
  heroTextureCache.set(url, texture);
  return texture;
}

function getHeroGalileanSurfaceMaps(profile) {
  const urls = HERO_GALILEAN_ASSET_URLS[profile.catalogueName];
  if (!urls) return null;
  return {
    albedoMap: loadPersistentHeroTexture(urls.albedo, { color: true }),
    heightMap: loadPersistentHeroTexture(urls.height),
    roughnessMap: loadPersistentHeroTexture(urls.roughness),
  };
}

function createJovianMaterial(profile, settings, palette, quality = "high", mode = "preview") {
  const inspection = mode === "inspection";
  const heroMaps = getHeroGalileanSurfaceMaps(profile);
  const heroSettings = HERO_GALILEAN_MATERIAL[profile.catalogueName] ?? null;
  const reliefMap = heroMaps?.heightMap
    ?? (inspection ? createInspectionBumpTexture(profile, settings, quality) : null);

  const common = {
    color: 0xffffff,
    map: heroMaps?.albedoMap ?? null,
    vertexColors: !heroMaps,
    roughness: heroSettings?.roughness
      ?? THREE.MathUtils.clamp(settings.roughness, 0.45, 1),
    roughnessMap: heroMaps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: heroSettings?.envMapIntensity ?? settings.envMapIntensity,
    flatShading: heroMaps ? false : settings.flatShading,
    dithering: true,
    emissive: heroMaps
      ? new THREE.Color(0x000000)
      : new THREE.Color(palette.dark).multiplyScalar(0.12),
    emissiveIntensity: heroMaps ? 0 : settings.emissiveIntensity,
    bumpMap: reliefMap,
    bumpScale: heroSettings
      ? (inspection ? heroSettings.inspectionBumpScale : heroSettings.previewBumpScale)
      : inspection
        ? (profile.family === "Galilean moon" ? 0.052 : profile.family === "Inner regular moon" ? 0.095 : 0.120)
        : 0,
    displacementMap: inspection ? reliefMap : null,
    displacementScale: inspection
      ? (heroSettings?.displacementScale
        ?? (profile.family === "Galilean moon" ? 0.010 : profile.family === "Inner regular moon" ? 0.045 : 0.056))
      : 0,
    displacementBias: inspection
      ? (heroSettings?.displacementBias
        ?? (profile.family === "Galilean moon" ? -0.005 : profile.family === "Inner regular moon" ? -0.0225 : -0.028))
      : 0,
  };

  const physicalClearcoat = profile.catalogueName === "Europa"
    ? Math.min(settings.clearcoat, 0.10)
    : 0;
  const material = physicalClearcoat > 0
    ? new THREE.MeshPhysicalMaterial({
      ...common,
      clearcoat: physicalClearcoat,
      clearcoatRoughness: Math.max(0.72, settings.clearcoatRoughness),
      reflectivity: 0.10,
    })
    : new THREE.MeshStandardMaterial(common);

  material.name = heroMaps
    ? `${profile.name} spacecraft mosaic material`
    : `${profile.name} evidence-tiered moon material`;
  material.userData = {
    surfaceEvidence: profile.surfaceEvidence,
    albedo: profile.albedo ?? null,
    roughness: common.roughness,
    usesSpacecraftMosaic: Boolean(heroMaps),
  };
  return material;
}

/**
 * Returns one unique physical 3D moon mesh. Orbit placement, cinematic scale,
 * focus metadata and interaction targets remain in satelliteSystem.js.
 */
export function createJovianMoonSurface(profile, quality = "high") {
  const { geometry, settings, palette } = createJovianGeometry(profile, quality, "preview");
  const material = createJovianMaterial(profile, settings, palette, quality, "preview");
  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = profile.surfaceEvidence;
  moon.userData.surfaceStructure = profile.surfaceStructure;
  moon.userData.surfaceRoughness = settings.roughness;
  moon.userData.surfaceDetailMode = "preview-3d";
  moon.userData.jovianSurfaceState = {
    profile,
    quality,
    mode: "preview",
    previewGeometry: geometry,
    previewMaterial: material,
    inspectionGeometry: null,
    inspectionMaterial: null,
  };
  return moon;
}

function disposeInspectionResources(state) {
  state.inspectionGeometry?.dispose?.();
  if (state.inspectionMaterial) {
    const textures = new Set([
      state.inspectionMaterial.map,
      state.inspectionMaterial.bumpMap,
      state.inspectionMaterial.roughnessMap,
      state.inspectionMaterial.displacementMap,
    ]);
    textures.forEach((texture) => {
      if (!texture?.userData?.persistentJovianTexture) texture?.dispose?.();
    });
    state.inspectionMaterial.dispose?.();
  }
  state.inspectionGeometry = null;
  state.inspectionMaterial = null;
}

/**
 * Promotes only the selected Jovian moon to its dense, Moon-style inspection
 * surface. All other satellites remain lightweight preview meshes, which is
 * the central performance fix for Jupiter's 115-body system.
 */
export function setJovianMoonInspectionDetail(moon, active) {
  const state = moon?.userData?.jovianSurfaceState;
  if (!state) return;

  if (active) {
    if (state.mode === "inspection") return;
    const detailed = createJovianGeometry(state.profile, state.quality, "inspection");
    state.inspectionGeometry = detailed.geometry;
    state.inspectionMaterial = createJovianMaterial(
      state.profile,
      detailed.settings,
      detailed.palette,
      state.quality,
      "inspection",
    );
    moon.geometry = state.inspectionGeometry;
    moon.material = state.inspectionMaterial;
    moon.layers.enable(JOVIAN_MOON_INSPECTION_LAYER);
    moon.userData.surfaceRoughness = detailed.settings.roughness;
    moon.userData.surfaceDetailMode = "inspection-3d";
    state.mode = "inspection";
    return;
  }

  if (state.mode !== "inspection") return;
  moon.geometry = state.previewGeometry;
  moon.material = state.previewMaterial;
  moon.layers.disable(JOVIAN_MOON_INSPECTION_LAYER);
  moon.userData.surfaceDetailMode = "preview-3d";
  state.mode = "preview";
  disposeInspectionResources(state);
}

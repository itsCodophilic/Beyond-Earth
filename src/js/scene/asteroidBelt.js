/**
 * Scientific, interactive main asteroid-belt builder.
 *
 * Visual goals:
 * - a sparse three-dimensional belt between Mars and Jupiter
 * - Kirkwood resonance gaps rather than one solid ring
 * - composition-specific C, S, and M class surfaces
 * - smooth, genuinely three-dimensional silhouettes
 * - crater bowls, raised rims, grooves, boulders, and rubble-pile forms
 * - individually clickable resolved bodies plus unresolved distant debris
 * - collision families and Jupiter Trojan swarms
 *
 * The resolved objects are not direct scans of real asteroids. They are
 * procedural models informed by spacecraft imagery of bodies such as Bennu,
 * Ryugu, Vesta, and metallic-asteroid mission concepts. This keeps the project
 * self-contained while avoiding a repeated low-poly "game rock" appearance.
 */
import * as THREE from "three";

const BELT_INNER_RADIUS = 44;
const BELT_OUTER_RADIUS = 52;
const JUPITER_ORBIT_RADIUS = 75;

// Rendering one mesh for every real asteroid would overwhelm both the CPU and
// the browser's memory. These two layers preserve the *visual population* of
// the million-plus-object belt while keeping the number of draw calls tiny:
// instanced rocks are genuine 3D geometry, and point-sized pebbles fill the
// far distance where individual geometry would occupy less than one pixel.
const INSTANCED_BOULDER_COUNTS = { C: 7000, S: 5000, M: 2500 };
const UNRESOLVED_PEBBLE_COUNT = 120000;

const COMPOSITIONS = {
  S: {
    label: "S-type (silicate)",
    description: "A stony inner-belt asteroid rich in silicate minerals, magnesium, and nickel-iron.",
    baseColors: ["#68635d", "#90867b", "#45433f"],
    roughness: 0.94,
    metalness: 0.035,
    bumpScale: 0.085,
    displacementScale: 0.055,
    density: "Silicate and nickel-iron",
    archetypes: ["elongated", "fractured", "irregular"],
  },
  M: {
    label: "M-type (metallic)",
    description: "A dense metal-rich asteroid containing substantial iron and nickel with rocky inclusions.",
    baseColors: ["#4a4c4b", "#73736e", "#292d2d"],
    roughness: 0.64,
    metalness: 0.48,
    bumpScale: 0.065,
    displacementScale: 0.042,
    density: "Iron-nickel metal mixed with silicate rock",
    archetypes: ["rounded", "elongated", "fractured"],
  },
  C: {
    label: "C-type (carbonaceous)",
    description: "A dark primitive asteroid rich in carbon compounds, hydrated minerals, and possible water-bearing material.",
    baseColors: ["#181a19", "#2d2e2b", "#0c0e0d"],
    roughness: 1,
    metalness: 0.005,
    bumpScale: 0.10,
    displacementScale: 0.064,
    density: "Carbon-rich hydrated rock",
    archetypes: ["rubble", "top", "irregular"],
  },
};

const MAJOR_BODIES = [
  {
    name: "Ceres",
    composition: "C",
    diameter: "939 km",
    radius: 47.8,
    angle: 0.58,
    size: 0.92,
    eccentricity: 0.075,
    inclination: 0.18,
    orbitalSpeed: 0.00052,
    archetype: "rounded",
    roundness: 0.82,
    description: "The largest body in the main belt and a dwarf planet, with a comparatively rounded shape and bright salt-bearing deposits.",
  },
  {
    name: "Vesta",
    composition: "S",
    diameter: "525 km",
    radius: 45.7,
    angle: 2.3,
    size: 0.67,
    eccentricity: 0.089,
    inclination: 0.12,
    orbitalSpeed: 0.00063,
    archetype: "basin",
    roundness: 0.38,
    description: "A differentiated rocky protoplanet with a basaltic crust and an enormous south-polar impact basin.",
  },
  {
    name: "Pallas",
    composition: "C",
    diameter: "512 km",
    radius: 48.4,
    angle: 4.12,
    size: 0.61,
    eccentricity: 0.23,
    inclination: 0.52,
    orbitalSpeed: 0.00049,
    archetype: "irregular",
    roundness: 0.28,
    description: "A large, heavily cratered body following one of the most inclined orbits among the major main-belt asteroids.",
  },
  {
    name: "Hygiea",
    composition: "C",
    diameter: "434 km",
    radius: 50.9,
    angle: 5.18,
    size: 0.54,
    eccentricity: 0.12,
    inclination: 0.07,
    orbitalSpeed: 0.00043,
    archetype: "rounded",
    roundness: 0.72,
    description: "A very dark carbonaceous body and the largest member of the Hygiea collision family.",
  },
  {
    name: "Psyche",
    composition: "M",
    diameter: "≈ 280 × 232 km",
    radius: 46.9,
    angle: 3.28,
    size: 0.43,
    eccentricity: 0.14,
    inclination: 0.05,
    orbitalSpeed: 0.00058,
    archetype: "irregular",
    roundness: 0.22,
    description: "A large metal-rich asteroid whose exposed mixture of metal and silicate rock may preserve material from an early planetesimal.",
  },
];

const _position = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _axisA = new THREE.Vector3();
const _axisB = new THREE.Vector3();

/** Stable pseudo-random value from any numeric seed. */
function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise3(x, y, z, seed) {
  const value = Math.sin(
    x * 1.73 +
    y * 2.11 +
    z * 2.47 +
    seed * 0.618,
  ) * 0.5 + 0.5;
  const second = Math.sin(
    x * 3.91 -
    y * 2.73 +
    z * 4.37 +
    seed * 1.127,
  ) * 0.5 + 0.5;
  return value * 0.66 + second * 0.34;
}

function fractalNoise(direction, seed) {
  let amplitude = 0.55;
  let frequency = 2.3;
  let total = 0;
  let weight = 0;

  for (let octave = 0; octave < 5; octave += 1) {
    total += smoothNoise3(
      direction.x * frequency,
      direction.y * frequency,
      direction.z * frequency,
      seed + octave * 11.3,
    ) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.08;
  }

  return total / weight;
}

/** Maps the project's artistic belt radius back to an approximate AU value. */
function radiusToAU(radius) {
  return THREE.MathUtils.mapLinear(
    radius,
    BELT_INNER_RADIUS,
    BELT_OUTER_RADIUS,
    2.2,
    3.2,
  );
}

/** Returns true when a radius falls inside one of the visual Kirkwood gaps. */
function isInsideKirkwoodGap(radius) {
  const gaps = [
    { centre: 46.35, halfWidth: 0.24 },
    { centre: 48.72, halfWidth: 0.18 },
    { centre: 50.05, halfWidth: 0.16 },
    { centre: 50.92, halfWidth: 0.20 },
  ];
  return gaps.some((gap) => Math.abs(radius - gap.centre) < gap.halfWidth);
}

/** Selects composition from distance, with small overlap between zones. */
function compositionForRadius(radius, seed) {
  const au = radiusToAU(radius);
  const random = seededRandom(seed);
  if (au < 2.55) return random < 0.82 ? "S" : "M";
  if (au < 2.85) return random < 0.48 ? "M" : random < 0.78 ? "S" : "C";
  return random < 0.84 ? "C" : "M";
}

/**
 * Creates colour, bump, and roughness maps tailored to one composition class.
 * The maps are generated once per variant and reused by many meshes.
 */
function createAsteroidTextureSet(compositionKey, variantSeed) {
  const composition = COMPOSITIONS[compositionKey];
  const width = 768;
  const height = 384;

  const colorCanvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  colorCanvas.width = bumpCanvas.width = roughnessCanvas.width = width;
  colorCanvas.height = bumpCanvas.height = roughnessCanvas.height = height;

  const colorContext = colorCanvas.getContext("2d");
  const bumpContext = bumpCanvas.getContext("2d");
  const roughnessContext = roughnessCanvas.getContext("2d");

  const colorImage = colorContext.createImageData(width, height);
  const bumpImage = bumpContext.createImageData(width, height);
  const roughnessImage = roughnessContext.createImageData(width, height);

  const base = composition.baseColors.map((hex) => new THREE.Color(hex));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const longitude = u * Math.PI * 2;
      const latitude = (v - 0.5) * Math.PI;
      const direction = new THREE.Vector3(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
      );

      const broad = fractalNoise(direction, variantSeed + 10);
      const fine = fractalNoise(
        direction.clone().multiplyScalar(3.2),
        variantSeed + 30,
      );
      const micro = smoothNoise3(
        direction.x * 33,
        direction.y * 33,
        direction.z * 33,
        variantSeed + 60,
      );

      const blendA = THREE.MathUtils.smoothstep(broad, 0.22, 0.78);
      const blendB = THREE.MathUtils.smoothstep(fine, 0.35, 0.82);
      const color = base[0].clone().lerp(base[1], blendA).lerp(base[2], blendB * 0.48);

      if (compositionKey === "M") {
        const metallicVein = Math.pow(Math.max(0, Math.sin(longitude * 8 + fine * 9)), 12);
        color.addScalar(metallicVein * 0.16);
      } else if (compositionKey === "C") {
        const carbonPatch = THREE.MathUtils.smoothstep(fine, 0.58, 0.9);
        color.multiplyScalar(0.72 + broad * 0.33 - carbonPatch * 0.14);
      } else {
        const ironPatch = THREE.MathUtils.smoothstep(micro, 0.72, 0.96);
        color.lerp(new THREE.Color("#5a463a"), ironPatch * 0.28);
      }

      const index = (y * width + x) * 4;
      colorImage.data[index] = Math.round(THREE.MathUtils.clamp(color.r, 0, 1) * 255);
      colorImage.data[index + 1] = Math.round(THREE.MathUtils.clamp(color.g, 0, 1) * 255);
      colorImage.data[index + 2] = Math.round(THREE.MathUtils.clamp(color.b, 0, 1) * 255);
      colorImage.data[index + 3] = 255;

      const bump = THREE.MathUtils.clamp((broad * 0.34 + fine * 0.46 + micro * 0.20), 0, 1);
      const bumpValue = Math.round(bump * 255);
      bumpImage.data[index] = bumpValue;
      bumpImage.data[index + 1] = bumpValue;
      bumpImage.data[index + 2] = bumpValue;
      bumpImage.data[index + 3] = 255;

      const rough = compositionKey === "M"
        ? 0.45 + (1 - fine) * 0.28
        : 0.75 + (1 - micro) * 0.22;
      const roughValue = Math.round(THREE.MathUtils.clamp(rough, 0, 1) * 255);
      roughnessImage.data[index] = roughValue;
      roughnessImage.data[index + 1] = roughValue;
      roughnessImage.data[index + 2] = roughValue;
      roughnessImage.data[index + 3] = 255;
    }
  }

  colorContext.putImageData(colorImage, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);
  roughnessContext.putImageData(roughnessImage, 0, 0);

  const craterCount = 42;
  for (let crater = 0; crater < craterCount; crater += 1) {
    const x = seededRandom(variantSeed * 17 + crater * 13) * width;
    const y = seededRandom(variantSeed * 23 + crater * 19) * height;
    const radius = 2 + Math.pow(seededRandom(variantSeed * 31 + crater * 29), 2.2) * 30;

    const bumpGradient = bumpContext.createRadialGradient(x, y, 0, x, y, radius);
    bumpGradient.addColorStop(0, "rgba(25,25,25,0.92)");
    bumpGradient.addColorStop(0.52, "rgba(55,55,55,0.65)");
    bumpGradient.addColorStop(0.72, "rgba(218,218,218,0.60)");
    bumpGradient.addColorStop(1, "rgba(128,128,128,0)");
    bumpContext.fillStyle = bumpGradient;
    bumpContext.beginPath();
    bumpContext.arc(x, y, radius, 0, Math.PI * 2);
    bumpContext.fill();

    const colorGradient = colorContext.createRadialGradient(x, y, 0, x, y, radius);
    colorGradient.addColorStop(0, "rgba(3,3,3,0.16)");
    colorGradient.addColorStop(0.62, "rgba(18,17,15,0.08)");
    colorGradient.addColorStop(0.80, "rgba(225,220,205,0.045)");
    colorGradient.addColorStop(1, "rgba(0,0,0,0)");
    colorContext.fillStyle = colorGradient;
    colorContext.beginPath();
    colorContext.arc(x, y, radius, 0, Math.PI * 2);
    colorContext.fill();
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  const roughnessTexture = new THREE.CanvasTexture(roughnessCanvas);

  colorTexture.colorSpace = THREE.SRGBColorSpace;
  [colorTexture, bumpTexture, roughnessTexture].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
  });

  return { colorTexture, bumpTexture, roughnessTexture };
}

/** Creates smooth material variants for the three composition classes. */
function createCompositionMaterials() {
  return Object.fromEntries(
    Object.entries(COMPOSITIONS).map(([key, composition]) => {
      const variants = Array.from({ length: 4 }, (_, index) => {
        const textures = createAsteroidTextureSet(key, 1000 + index * 137 + key.charCodeAt(0));
        return new THREE.MeshStandardMaterial({
          map: textures.colorTexture,
          bumpMap: textures.bumpTexture,
          bumpScale: composition.bumpScale,
          roughnessMap: textures.roughnessTexture,
          roughness: composition.roughness,
          metalness: composition.metalness,
          envMapIntensity: key === "M" ? 0.28 : 0.08,
          flatShading: false,
        });
      });
      return [key, variants];
    }),
  );
}

function randomUnitVector(seed) {
  const y = seededRandom(seed + 1) * 2 - 1;
  const angle = seededRandom(seed + 2) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  ).normalize();
}

/**
 * Builds a high-resolution asteroid geometry with composition-aware form.
 * Shared vertices and smooth normals remove the faceted low-poly appearance.
 */
function createAsteroidGeometry({
  seed,
  composition,
  archetype,
  detail = 4,
  roundness = 0.12,
  majorBasin = false,
}) {
  // SphereGeometry is indexed and carries smooth shared normals, like the Moon.
  // The high subdivision count also lets displacementMap physically move the
  // surface instead of only changing the colour of pixels.
  const widthSegments = detail >= 5 ? 144 : 80;
  const heightSegments = detail >= 5 ? 104 : 60;
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.attributes.position;

  const stretch = new THREE.Vector3(1, 1, 1);
  if (archetype === "elongated") {
    stretch.set(1.35, 0.72, 0.82);
  } else if (archetype === "fractured") {
    stretch.set(1.13, 0.75, 1.02);
  } else if (archetype === "top") {
    stretch.set(1.03, 1.16, 1.03);
  } else if (archetype === "rubble") {
    stretch.set(1.12, 0.92, 1.07);
  } else if (archetype === "basin") {
    stretch.set(1.05, 0.90, 1.02);
  } else if (archetype === "rounded") {
    stretch.set(1.02, 0.98, 1.00);
  } else {
    stretch.set(
      0.86 + seededRandom(seed + 1) * 0.34,
      0.76 + seededRandom(seed + 2) * 0.35,
      0.84 + seededRandom(seed + 3) * 0.36,
    );
  }
  stretch.lerp(new THREE.Vector3(1, 1, 1), roundness);

  const craterCount = majorBasin
    ? 14
    : 8 + Math.floor(seededRandom(seed + 4) * 11);

  const craters = Array.from({ length: craterCount }, (_, index) => ({
    direction: randomUnitVector(seed * 17 + index * 41),
    radius: 0.055 + Math.pow(seededRandom(seed * 31 + index * 13), 1.65) * 0.24,
    depth: 0.026 + seededRandom(seed * 43 + index * 19) * 0.105,
    rim: 0.010 + seededRandom(seed * 59 + index * 23) * 0.040,
  }));

  if (majorBasin) {
    craters.push({
      direction: new THREE.Vector3(0.18, -0.94, 0.27).normalize(),
      radius: 0.52,
      depth: 0.20,
      rim: 0.078,
    });
  }

  const fractureNormals = Array.from({ length: 2 }, (_, index) =>
    randomUnitVector(seed * 71 + index * 37),
  );

  for (let index = 0; index < positions.count; index += 1) {
    _position.fromBufferAttribute(positions, index);
    _direction.copy(_position).normalize();

    const low = fractalNoise(_direction, seed + 10) - 0.5;
    const medium = fractalNoise(_direction.clone().multiplyScalar(2.8), seed + 40) - 0.5;
    const fine = smoothNoise3(
      _direction.x * 29,
      _direction.y * 29,
      _direction.z * 29,
      seed + 80,
    ) - 0.5;

    let radialScale = 1 + low * 0.18 + medium * 0.075 + fine * 0.025;

    if (archetype === "top") {
      const equator = 1 - Math.abs(_direction.y);
      radialScale += Math.pow(equator, 4.5) * 0.16;
      radialScale -= Math.pow(Math.abs(_direction.y), 3.0) * 0.055;
    }

    if (archetype === "rubble") {
      radialScale += Math.max(0, medium) * 0.085;
    }

    for (const crater of craters) {
      const angularDistance = Math.acos(
        THREE.MathUtils.clamp(_direction.dot(crater.direction), -1, 1),
      );

      const bowl = 1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.06,
        crater.radius,
      );

      const rim = THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.68,
        crater.radius * 0.88,
      ) * (1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.88,
        crater.radius * 1.13,
      ));

      radialScale -= bowl * crater.depth;
      radialScale += rim * crater.rim;
    }

    fractureNormals.forEach((fractureNormal, fractureIndex) => {
      const distance = Math.abs(_direction.dot(fractureNormal));
      const groove = 1 - THREE.MathUtils.smoothstep(distance, 0.0, 0.022 + fractureIndex * 0.008);
      radialScale -= groove * (0.010 + fractureIndex * 0.005);
    });

    _position.multiplyScalar(radialScale).multiply(stretch);
    positions.setXYZ(index, _position.x, _position.y, _position.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  geometry.userData.craters = craters.map((crater) => ({
    direction: crater.direction.clone(),
    radius: crater.radius,
    depth: crater.depth,
  }));
  return geometry;
}

/** Computes a position on a mildly eccentric and inclined orbit. */
function positionFromOrbit(target, orbit, angle) {
  const semiMajor = orbit.semiMajor;
  const eccentricity = orbit.eccentricity;
  const distance = semiMajor * (1 - eccentricity * eccentricity)
    / (1 + eccentricity * Math.cos(angle));

  const orbitalX = Math.cos(angle) * distance;
  const orbitalZ = Math.sin(angle) * distance;
  const cosNode = Math.cos(orbit.node);
  const sinNode = Math.sin(orbit.node);
  const cosInclination = Math.cos(orbit.inclination);
  const sinInclination = Math.sin(orbit.inclination);

  target.set(
    orbitalX * cosNode - orbitalZ * cosInclination * sinNode,
    orbitalZ * sinInclination,
    orbitalX * sinNode + orbitalZ * cosInclination * cosNode,
  );
  return target;
}

/** Adds card metadata used by the existing celestial inspection UI. */
function attachAsteroidMetadata(object, {
  name,
  composition,
  diameter,
  semiMajor,
  orbitalSpeed,
  description,
  family = "Background population",
  population = "Main belt",
  archetype = "Irregular body",
  visualRadius = 0.1,
}) {
  const compositionData = COMPOSITIONS[composition];
  const au = radiusToAU(THREE.MathUtils.clamp(
    semiMajor,
    BELT_INNER_RADIUS,
    BELT_OUTER_RADIUS,
  ));

  object.name = name;
  object.userData = {
    name,
    detail: `${compositionData.label} | ${family}`,
    focusScale: 7.5,
    // Small asteroids need a much tighter camera than planets. This explicit
    // distance is consumed by main.js and is independent of orbital distance.
    focusDistance: Math.max(0.24, visualRadius * 4.35),
    minFocusDistance: Math.max(0.20, visualRadius * 3.4),
    focusEase: 0.14,
    isAsteroid: true,
    visualRadius,
    orbitRadius: semiMajor,
    info: {
      type: population === "Trojan cloud" ? "Jupiter Trojan asteroid" : "Asteroid",
      diameter,
      orbitalSpeed,
      distanceFromEarth: population === "Trojan cloud"
        ? "Near Jupiter's orbit; distance from Earth continuously varies"
        : `≈ ${au.toFixed(2)} AU from the Sun; distance from Earth continuously varies`,
      description: `${description} Composition: ${compositionData.density}. Shape: ${archetype}. Orbital group: ${family}.`,
    },
  };
}


function addSurfaceBoulders({ group, material, seed, count, composition }) {
  const boulderGeometry = new THREE.IcosahedronGeometry(1, 2);

  for (let index = 0; index < count; index += 1) {
    const direction = randomUnitVector(seed * 13 + index * 37);
    const boulder = new THREE.Mesh(boulderGeometry, material);
    const size = 0.035 + seededRandom(seed * 19 + index * 31) * 0.085;
    boulder.position.copy(direction).multiplyScalar(0.91 + size * 0.58);
    boulder.scale.set(
      size * (0.75 + seededRandom(seed + index * 7) * 0.7),
      size * (0.65 + seededRandom(seed + index * 11) * 0.65),
      size * (0.72 + seededRandom(seed + index * 17) * 0.72),
    );
    boulder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    boulder.rotation.z = seededRandom(seed + index * 23) * Math.PI;
    boulder.castShadow = false;
    boulder.receiveShadow = false;
    boulder.userData.isSurfaceDetail = true;

    if (composition === "M" && index % 3 === 0) {
      boulder.material = material.clone();
      boulder.material.metalness = Math.min(0.82, material.metalness + 0.12);
      boulder.material.roughness = Math.max(0.35, material.roughness - 0.10);
    }

    group.add(boulder);
  }
}

/** Creates one clickable resolved body and stores its orbital state. */
function createAsteroidObject({
  index,
  composition,
  size,
  orbit,
  materials,
  geometryPool,
  name,
  diameter,
  description,
  family,
  population = "Main belt",
  archetype,
  surfaceBoulders = 0,
}) {
  const compositionData = COMPOSITIONS[composition];
  const chosenArchetype = archetype
    ?? compositionData.archetypes[index % compositionData.archetypes.length];
  const materialSet = materials[composition];
  const material = materialSet[index % materialSet.length];
  const geometrySet = geometryPool[composition][chosenArchetype]
    ?? geometryPool[composition].irregular;
  const geometry = geometrySet[index % geometrySet.length];

  const group = new THREE.Group();
  const core = new THREE.Mesh(geometry, material);
  core.name = `${name} surface`;
  group.add(core);

  group.scale.setScalar(size);
  group.scale.multiply(new THREE.Vector3(
    0.88 + seededRandom(index * 3 + 1) * 0.26,
    0.86 + seededRandom(index * 3 + 2) * 0.24,
    0.88 + seededRandom(index * 3 + 3) * 0.27,
  ));

  group.rotation.set(
    seededRandom(index + 61) * Math.PI,
    seededRandom(index + 62) * Math.PI,
    seededRandom(index + 63) * Math.PI,
  );

  // Craters are cut directly into `createAsteroidGeometry`. Avoid adding flat
  // CircleGeometry/TorusGeometry decals here: those overlays were the main
  // reason nearby asteroids looked painted instead of physically excavated.

  if (surfaceBoulders > 0) {
    addSurfaceBoulders({
      group,
      material,
      seed: index + 500,
      count: surfaceBoulders,
      composition,
    });
  }

  positionFromOrbit(group.position, orbit, orbit.angle);

  attachAsteroidMetadata(group, {
    name,
    composition,
    diameter,
    semiMajor: orbit.semiMajor,
    orbitalSpeed: `${(14 + seededRandom(index + 90) * 7).toFixed(1)} km/s`,
    description,
    family,
    population,
    archetype: chosenArchetype,
    visualRadius: Math.max(group.scale.x, group.scale.y, group.scale.z),
  });

  group.userData.orbit = orbit;
  group.userData.spin = new THREE.Vector3(
    (seededRandom(index + 71) - 0.5) * 0.006,
    (seededRandom(index + 72) - 0.5) * 0.007,
    (seededRandom(index + 73) - 0.5) * 0.005,
  );
  group.userData.core = core;
  group.userData.archetype = chosenArchetype;
  return group;
}

/**
 * Creates one shared low-poly rock shape for thousands of GPU instances.
 * The vertices are pushed into an uneven silhouette and several crater bowls
 * are physically carved into it. Because every vertex really moves in 3D,
 * light produces proper ridges and shadows instead of a flat crater picture.
 */
function createInstancedRockGeometry(seed, composition, variant) {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.attributes.position;
  const stretch = composition === "M"
    ? new THREE.Vector3(1.18, 0.82, 0.94)
    : composition === "C"
      ? new THREE.Vector3(1.08, 0.91, 1.02)
      : new THREE.Vector3(1.28, 0.76, 0.91);

  // Two geometry variants per composition avoid an obviously repeated rock
  // silhouette while still requiring only six draw calls for the whole field.
  if (variant === 1) {
    stretch.set(stretch.z * 0.96, stretch.x * 0.91, stretch.y * 1.08);
  }

  const craters = Array.from({ length: 4 }, (_, index) => ({
    direction: randomUnitVector(seed + index * 37),
    radius: 0.12 + seededRandom(seed + index * 53) * 0.16,
    depth: 0.035 + seededRandom(seed + index * 71) * 0.055,
  }));

  for (let index = 0; index < positions.count; index += 1) {
    _position.fromBufferAttribute(positions, index);
    _direction.copy(_position).normalize();

    const broadNoise = fractalNoise(_direction, seed) - 0.5;
    const sharpNoise = smoothNoise3(
      _direction.x * 13,
      _direction.y * 13,
      _direction.z * 13,
      seed + 91,
    ) - 0.5;
    let radialScale = 1 + broadNoise * 0.25 + sharpNoise * 0.075;

    craters.forEach((crater) => {
      const angularDistance = Math.acos(
        THREE.MathUtils.clamp(_direction.dot(crater.direction), -1, 1),
      );
      const bowl = 1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.08,
        crater.radius,
      );
      radialScale -= bowl * crater.depth;
    });

    _position.multiplyScalar(radialScale).multiply(stretch);
    positions.setXYZ(index, _position.x, _position.y, _position.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Places thousands of real 3D boulders into the belt with InstancedMesh.
 * An instance has its own position, rotation, scale, and colour, but shares the
 * same geometry/material on the GPU. This is what makes a dense volumetric belt
 * possible without creating fifteen thousand JavaScript Mesh objects.
 */
function createInstancedBoulderField(materials) {
  const field = new THREE.Group();
  const meshes = [];
  field.name = "3D asteroid boulder field";

  Object.entries(INSTANCED_BOULDER_COUNTS).forEach(([composition, totalCount], compositionIndex) => {
    for (let variant = 0; variant < 2; variant += 1) {
      const count = variant === 0 ? Math.ceil(totalCount / 2) : Math.floor(totalCount / 2);
      const geometry = createInstancedRockGeometry(
        8100 + compositionIndex * 307 + variant * 97,
        composition,
        variant,
      );
      const material = materials[composition][variant].clone();
      // Mid-distance rocks get their depth from geometry and direct lighting.
      // A small bump map keeps the material grain without distorting silhouettes.
      material.bumpScale *= 0.55;
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      const dummy = new THREE.Object3D();
      const palette = COMPOSITIONS[composition].baseColors.map((value) => new THREE.Color(value));

      let accepted = 0;
      let attempt = 0;
      while (accepted < count && attempt < count * 30) {
        const seed = 12000 + compositionIndex * 50000 + variant * 17000 + attempt * 13;
        attempt += 1;

        let radius = BELT_INNER_RADIUS
          + seededRandom(seed + 1) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
        let angle = seededRandom(seed + 2) * Math.PI * 2;

        // About one in ten rocks belongs to a visible collision-family stream.
        // These overlapping streams make the belt a region with structure, not
        // a perfectly uniform decorative ring.
        if (accepted % 10 === 0 && composition !== "M") {
          const useOuterFamily = seededRandom(seed + 3) > 0.48;
          if (composition === "C") {
            radius = 50.2 + (seededRandom(seed + 4) - 0.5) * 0.8;
            angle = 3.7 + (seededRandom(seed + 5) - 0.5) * 1.05;
          } else if (useOuterFamily) {
            radius = 49.5 + (seededRandom(seed + 4) - 0.5) * 0.7;
            angle = 5.15 + (seededRandom(seed + 5) - 0.5) * 0.95;
          } else {
            radius = 44.9 + (seededRandom(seed + 4) - 0.5) * 0.7;
            angle = 1.1 + (seededRandom(seed + 5) - 0.5) * 0.95;
          }
        }

        if (isInsideKirkwoodGap(radius)) continue;
        if (compositionForRadius(radius, seed + 6) !== composition) continue;

        const orbit = {
          semiMajor: radius,
          eccentricity: seededRandom(seed + 7) * 0.13,
          inclination: (seededRandom(seed + 8) - 0.5) * 0.22,
          node: seededRandom(seed + 9) * Math.PI * 2,
        };
        positionFromOrbit(dummy.position, orbit, angle);
        dummy.rotation.set(
          seededRandom(seed + 10) * Math.PI,
          seededRandom(seed + 11) * Math.PI,
          seededRandom(seed + 12) * Math.PI,
        );

        // The steep power curve makes almost every object a pebble/small rock,
        // while leaving a rare tail of large, clearly readable boulders.
        const sizeBias = Math.pow(seededRandom(seed + 13), 5.2);
        const size = 0.014 + sizeBias * 0.18;
        dummy.scale.set(
          size * (0.68 + seededRandom(seed + 14) * 0.72),
          size * (0.62 + seededRandom(seed + 15) * 0.70),
          size * (0.70 + seededRandom(seed + 16) * 0.68),
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(accepted, dummy.matrix);

        const color = palette[Math.floor(seededRandom(seed + 17) * palette.length)].clone();
        color.multiplyScalar(0.72 + seededRandom(seed + 18) * 0.42);
        mesh.setColorAt(accepted, color);
        accepted += 1;
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.name = `${composition}-class instanced boulders ${variant + 1}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.rotationSpeed = 0.000055 + compositionIndex * 0.000012 + variant * 0.000009;
      field.add(mesh);
      meshes.push(mesh);
    }
  });

  return { field, meshes };
}

/**
 * Generates the unresolved population: tiny bodies that are physically below
 * a pixel at this scale. It is intentionally a point layer, while every object
 * large enough to inspect is represented by actual 3D geometry above.
 */
function createDistantDebris() {
  const positions = new Float32Array(UNRESOLVED_PEBBLE_COUNT * 3);
  const colors = new Float32Array(UNRESOLVED_PEBBLE_COUNT * 3);
  const sizes = new Float32Array(UNRESOLVED_PEBBLE_COUNT);
  const colorPalette = [
    new THREE.Color(0x73665b),
    new THREE.Color(0x373937),
    new THREE.Color(0x897667),
    new THREE.Color(0x232625),
  ];

  let accepted = 0;
  let attempt = 0;
  while (accepted < UNRESOLVED_PEBBLE_COUNT) {
    const seed = 500000 + attempt * 19;
    attempt += 1;
    const radius = BELT_INNER_RADIUS
      + seededRandom(seed + 1) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
    if (isInsideKirkwoodGap(radius)) continue;

    const angle = seededRandom(seed + 2) * Math.PI * 2;
    const orbit = {
      semiMajor: radius,
      eccentricity: seededRandom(seed + 3) * 0.12,
      // Adding several random values creates a centre-heavy distribution, so
      // the belt has a thin core plus a sparse halo above and below its plane.
      inclination: (
        seededRandom(seed + 4)
        + seededRandom(seed + 5)
        + seededRandom(seed + 6)
        - 1.5
      ) * 0.12,
      node: seededRandom(seed + 7) * Math.PI * 2,
    };
    positionFromOrbit(_position, orbit, angle);
    const positionIndex = accepted * 3;
    positions[positionIndex] = _position.x;
    positions[positionIndex + 1] = _position.y;
    positions[positionIndex + 2] = _position.z;

    const color = colorPalette[Math.floor(seededRandom(seed + 8) * colorPalette.length)];
    const brightness = 0.56 + seededRandom(seed + 9) * 0.58;
    colors[positionIndex] = color.r * brightness;
    colors[positionIndex + 1] = color.g * brightness;
    colors[positionIndex + 2] = color.b * brightness;
    sizes[accepted] = 0.34 + Math.pow(seededRandom(seed + 10), 3.4) * 0.92;
    accepted += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uOpacity: { value: 0.62 },
    },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * uPixelRatio * (105.0 / max(1.0, -viewPosition.z)), 0.7, 4.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float uOpacity;

      void main() {
        float distanceFromCentre = length(gl_PointCoord - vec2(0.5));
        float edge = 1.0 - smoothstep(0.28, 0.5, distanceFromCentre);
        if (edge < 0.02) discard;
        gl_FragColor = vec4(vColor, edge * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Virtual million-object pebble population";
  points.frustumCulled = false;
  return points;
}

/** Creates family members concentrated around one parent collision orbit. */
function createFamily({
  name,
  composition,
  centreRadius,
  centreAngle,
  inclination,
  count,
  seedOffset,
  container,
  rocks,
  materials,
  geometryPool,
}) {
  for (let member = 0; member < count; member += 1) {
    const index = seedOffset + member;
    const radius = centreRadius + (seededRandom(index + 4) - 0.5) * 0.55;
    const orbit = {
      semiMajor: radius,
      eccentricity: 0.025 + seededRandom(index + 5) * 0.055,
      inclination: inclination + (seededRandom(index + 6) - 0.5) * 0.045,
      node: seededRandom(index + 7) * Math.PI * 2,
      angle: centreAngle + (seededRandom(index + 8) - 0.5) * 0.62,
      speed: 0.00025 + seededRandom(index + 9) * 0.00022,
    };
    const size = 0.055 + Math.pow(seededRandom(index + 10), 2.8) * 0.18;
    const rock = createAsteroidObject({
      index,
      composition,
      size,
      orbit,
      materials,
      geometryPool,
      name: `${name} family member ${String(member + 1).padStart(2, "0")}`,
      diameter: `${Math.round(4 + size * 105)} km`,
      description: `A fragment produced by the ancient collision that formed the ${name} family.`,
      family: `${name} family`,
      surfaceBoulders: size > 0.14 ? 3 : 0,
    });
    container.add(rock);
    rocks.push(rock);
  }
}

/** Creates the leading or trailing Jupiter Trojan cloud. */
function createTrojanCloud({
  label,
  offset,
  seedOffset,
  count,
  container,
  rocks,
  materials,
  geometryPool,
}) {
  for (let member = 0; member < count; member += 1) {
    const index = seedOffset + member;
    const orbit = {
      semiMajor: JUPITER_ORBIT_RADIUS + (seededRandom(index + 2) - 0.5) * 4.2,
      eccentricity: 0.01 + seededRandom(index + 3) * 0.08,
      inclination: (seededRandom(index + 4) - 0.5) * 0.22,
      node: seededRandom(index + 5) * Math.PI * 2,
      angle: offset + (seededRandom(index + 6) - 0.5) * 0.56,
      speed: 0,
      trojanOffset: offset,
      trojanSpread: (seededRandom(index + 6) - 0.5) * 0.56,
    };
    const size = 0.045 + Math.pow(seededRandom(index + 8), 3) * 0.14;
    const rock = createAsteroidObject({
      index,
      composition: "C",
      size,
      orbit,
      materials,
      geometryPool,
      name: `${label} Trojan ${String(member + 1).padStart(2, "0")}`,
      diameter: `${Math.round(3 + size * 90)} km`,
      description: `A dark primitive body librating around Jupiter's ${label} Trojan region, roughly 60° from the planet.`,
      family: `${label} Trojan swarm`,
      population: "Trojan cloud",
      archetype: member % 3 === 0 ? "top" : "rubble",
      surfaceBoulders: size > 0.12 ? 4 : 0,
    });
    container.add(rock);
    rocks.push(rock);
  }
}

function createGeometryPool() {
  const pool = {};

  Object.entries(COMPOSITIONS).forEach(([composition, config]) => {
    pool[composition] = {};
    const archetypes = new Set([...config.archetypes, "irregular", "rounded", "basin"]);

    archetypes.forEach((archetype) => {
      pool[composition][archetype] = Array.from({ length: 4 }, (_, index) =>
        createAsteroidGeometry({
          seed: composition.charCodeAt(0) * 100 + archetype.length * 17 + index * 29,
          composition,
          archetype,
          detail: 4,
          roundness: archetype === "rounded" ? 0.62 : 0.08,
          majorBasin: false,
        }),
      );
    });
  });

  return pool;
}

/** Creates the complete interactive asteroid system. */
export function createAsteroidBelt({ world, hoverTargets = [] }) {
  const system = new THREE.Group();
  system.name = "Asteroid populations";

  const mainBelt = new THREE.Group();
  mainBelt.name = "Main asteroid belt";
  const trojans = new THREE.Group();
  trojans.name = "Jupiter Trojan clouds";
  system.add(mainBelt, trojans);

  const materials = createCompositionMaterials();
  const geometryPool = createGeometryPool();
  const rocks = [];

  MAJOR_BODIES.forEach((body, index) => {
    const orbit = {
      semiMajor: body.radius,
      eccentricity: body.eccentricity,
      inclination: body.inclination,
      node: seededRandom(index + 301) * Math.PI * 2,
      angle: body.angle,
      speed: body.orbitalSpeed,
    };

    const customGeometry = createAsteroidGeometry({
      seed: 900 + index,
      composition: body.composition,
      archetype: body.archetype,
      detail: 5,
      roundness: body.roundness,
      majorBasin: body.name === "Vesta",
    });

    geometryPool[body.composition][body.archetype] = [customGeometry];

    const rock = createAsteroidObject({
      index: 700 + index,
      composition: body.composition,
      size: body.size,
      orbit,
      materials,
      geometryPool,
      name: body.name,
      diameter: body.diameter,
      description: body.description,
      family: `${body.name} major body`,
      archetype: body.archetype,
      surfaceBoulders: body.name === "Ceres" ? 6 : body.name === "Vesta" ? 9 : 7,
    });
    mainBelt.add(rock);
    rocks.push(rock);
  });

  let accepted = 0;
  let attempts = 0;
  const backgroundCount = 250;

  while (accepted < backgroundCount && attempts < backgroundCount * 20) {
    const index = 1000 + attempts;
    attempts += 1;
    const semiMajor = BELT_INNER_RADIUS
      + seededRandom(index + 1) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
    if (isInsideKirkwoodGap(semiMajor)) continue;

    const composition = compositionForRadius(semiMajor, index + 2);
    const orbit = {
      semiMajor,
      eccentricity: 0.015 + seededRandom(index + 3) * 0.18,
      inclination: (seededRandom(index + 4) - 0.5) * 0.30,
      node: seededRandom(index + 5) * Math.PI * 2,
      angle: seededRandom(index + 6) * Math.PI * 2,
      speed: 0.00020 + seededRandom(index + 7) * 0.00042,
    };

    const size = 0.035 + Math.pow(seededRandom(index + 8), 4.6) * 0.34;
    const archetypes = COMPOSITIONS[composition].archetypes;
    const archetype = archetypes[Math.floor(seededRandom(index + 11) * archetypes.length)];
    const rock = createAsteroidObject({
      index,
      composition,
      size,
      orbit,
      materials,
      geometryPool,
      name: `${COMPOSITIONS[composition].label.split(" ")[0]} asteroid ${String(accepted + 1).padStart(3, "0")}`,
      diameter: `${Math.max(2, Math.round(size * 120))} km`,
      description: COMPOSITIONS[composition].description,
      family: "Background population",
      archetype,
      surfaceBoulders: size > 0.16 ? 4 + Math.floor(seededRandom(index + 12) * 4) : 0,
    });
    mainBelt.add(rock);
    rocks.push(rock);
    accepted += 1;
  }

  createFamily({
    name: "Flora",
    composition: "S",
    centreRadius: 44.9,
    centreAngle: 1.1,
    inclination: 0.08,
    count: 24,
    seedOffset: 2200,
    container: mainBelt,
    rocks,
    materials,
    geometryPool,
  });

  createFamily({
    name: "Eos",
    composition: "C",
    centreRadius: 50.2,
    centreAngle: 3.7,
    inclination: 0.18,
    count: 22,
    seedOffset: 2400,
    container: mainBelt,
    rocks,
    materials,
    geometryPool,
  });

  createFamily({
    name: "Koronis",
    composition: "S",
    centreRadius: 49.5,
    centreAngle: 5.15,
    inclination: 0.05,
    count: 20,
    seedOffset: 2600,
    container: mainBelt,
    rocks,
    materials,
    geometryPool,
  });

  createTrojanCloud({
    label: "L4 leading",
    offset: Math.PI / 3,
    seedOffset: 3000,
    count: 42,
    container: trojans,
    rocks,
    materials,
    geometryPool,
  });

  createTrojanCloud({
    label: "L5 trailing",
    offset: -Math.PI / 3,
    seedOffset: 3400,
    count: 42,
    container: trojans,
    rocks,
    materials,
    geometryPool,
  });

  // The belt is rendered as a depth hierarchy. Resolved bodies remain fully
  // interactive; instanced boulders supply nearby 3D mass; points represent
  // only the enormous population that is too small to resolve at this scale.
  const { field: instancedBoulderField, meshes: instancedBoulders } =
    createInstancedBoulderField(materials);
  const distantDebris = createDistantDebris();
  mainBelt.add(instancedBoulderField, distantDebris);

  world.add(system);
  // Raycasting the whole system would test every one of the 14,500 instances
  // on every pointer move. Only resolved, named bodies need inspection cards.
  hoverTargets.push(...rocks);

  return {
    system,
    mainBelt,
    trojans,
    rocks,
    instancedBoulderField,
    instancedBoulders,
    distantDebris,
  };
}

/** Advances the orbit and spin of every resolved asteroid. */
export function updateAsteroidBelt(asteroidBelt, motionScale = 1, jupiter = null) {
  if (!asteroidBelt) return;

  const jupiterAngle = jupiter?.userData?.angle ?? 0;

  asteroidBelt.rocks.forEach((rock) => {
    const orbit = rock.userData.orbit;
    if (!orbit) return;

    if (orbit.trojanOffset !== undefined) {
      orbit.angle = jupiterAngle + orbit.trojanOffset + orbit.trojanSpread;
    } else {
      orbit.angle += orbit.speed * motionScale;
    }

    positionFromOrbit(rock.position, orbit, orbit.angle);
    rock.rotation.x += rock.userData.spin.x * motionScale;
    rock.rotation.y += rock.userData.spin.y * motionScale;
    rock.rotation.z += rock.userData.spin.z * motionScale;
  });

  // Each instanced population band advances at a slightly different rate. The
  // small difference prevents the belt from behaving like one rigid vinyl ring.
  asteroidBelt.instancedBoulders?.forEach((mesh) => {
    mesh.rotation.y += mesh.userData.rotationSpeed * motionScale;
  });
  asteroidBelt.distantDebris.rotation.y += 0.000045 * motionScale;
}

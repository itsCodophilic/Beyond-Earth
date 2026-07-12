/**
 * Scientific, interactive main asteroid-belt builder.
 *
 * The visual system represents five related populations:
 * - a sparse 3D main belt between Mars and Jupiter
 * - Kirkwood resonance gaps where very few bodies are allowed
 * - composition zones: S-type, M-type, and C-type asteroids
 * - collision families sharing similar orbital elements
 * - Jupiter Trojan clouds around the leading and trailing Lagrange regions
 *
 * The browser cannot draw millions of individual kilometre-scale bodies, so a
 * few hundred clickable meshes represent the large population while a subtle
 * point cloud stands in for distant pebble-sized debris. Space remains the
 * dominant feature: this is intentionally not a dense movie-style rock tunnel.
 */
import * as THREE from "three";
import { makeRockTexture } from "../graphics/proceduralTextures.js";

const BELT_INNER_RADIUS = 44;
const BELT_OUTER_RADIUS = 52;
const JUPITER_ORBIT_RADIUS = 75;

const COMPOSITIONS = {
  S: {
    label: "S-type (silicate)",
    description: "A stony inner-belt asteroid rich in silicate minerals, magnesium, and nickel-iron.",
    colors: [0x9a8068, 0x786351, 0xb39a7e],
    roughness: 0.92,
    metalness: 0.06,
    density: "Silicate and nickel-iron",
  },
  M: {
    label: "M-type (metallic)",
    description: "A dense metallic asteroid dominated by iron and nickel, with possible trace precious metals.",
    colors: [0x6f706d, 0x8b8175, 0x535755],
    roughness: 0.67,
    metalness: 0.48,
    density: "Iron-nickel metal",
  },
  C: {
    label: "C-type (carbonaceous)",
    description: "A dark outer-belt asteroid rich in carbon compounds, hydrated minerals, and possible water ice.",
    colors: [0x302f2d, 0x46413c, 0x252725],
    roughness: 1,
    metalness: 0.015,
    density: "Carbon-rich hydrated rock",
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
    description: "The largest body in the main belt and a dwarf planet, containing a substantial fraction of the belt's total mass.",
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
    description: "A differentiated rocky protoplanet with a giant south-polar impact basin and a basaltic crust.",
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
    description: "A large, highly inclined asteroid following one of the most tilted orbits among the major belt bodies.",
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
    description: "A dark carbonaceous body and the largest member of the Hygiea collision family.",
  },
];

/** Stable pseudo-random value from any numeric seed. */
function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
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
    { centre: 46.35, halfWidth: 0.24, resonance: "3:1" },
    { centre: 48.72, halfWidth: 0.18, resonance: "5:2" },
    { centre: 50.05, halfWidth: 0.16, resonance: "7:3" },
    { centre: 50.92, halfWidth: 0.20, resonance: "2:1" },
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
 * Builds a genuinely three-dimensional asteroid mesh geometry.
 *
 * The geometry begins as a subdivided icosahedron. Every vertex is then:
 * - stretched independently on three axes
 * - displaced by multi-frequency surface roughness
 * - pushed inward around several crater centres
 * - raised around crater rims
 * - occasionally split by a shallow groove or impact fracture
 */
function createCrateredGeometry(seed, detail = 3, roundness = 0) {
  const geometry = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  const direction = new THREE.Vector3();

  const stretch = new THREE.Vector3(
    0.72 + seededRandom(seed + 1) * 0.68,
    0.62 + seededRandom(seed + 2) * 0.62,
    0.70 + seededRandom(seed + 3) * 0.78,
  ).lerp(new THREE.Vector3(1, 1, 1), roundness);

  const craterCount = 4 + Math.floor(seededRandom(seed + 4) * 7);
  const craters = [];
  for (let index = 0; index < craterCount; index += 1) {
    const y = seededRandom(seed * 17 + index * 7) * 2 - 1;
    const angle = seededRandom(seed * 23 + index * 11) * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    craters.push({
      direction: new THREE.Vector3(
        Math.cos(angle) * radial,
        y,
        Math.sin(angle) * radial,
      ).normalize(),
      radius: 0.10 + seededRandom(seed * 31 + index * 13) * 0.27,
      depth: 0.045 + seededRandom(seed * 41 + index * 19) * 0.13,
      rim: 0.02 + seededRandom(seed * 47 + index * 29) * 0.055,
    });
  }

  const grooveNormal = new THREE.Vector3(
    seededRandom(seed + 50) * 2 - 1,
    seededRandom(seed + 51) * 2 - 1,
    seededRandom(seed + 52) * 2 - 1,
  ).normalize();

  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);
    direction.copy(vertex).normalize();

    const lowFrequency =
      Math.sin(direction.x * 7.1 + seed * 0.8) *
      Math.sin(direction.y * 8.7 - seed * 0.4) * 0.075;
    const mediumFrequency =
      Math.sin(direction.x * 19.7 + direction.z * 13.4 + seed) * 0.038;
    const fineFrequency =
      Math.sin(direction.y * 47.2 - direction.z * 37.8 + seed * 1.7) * 0.015;

    let radialScale = 1 + lowFrequency + mediumFrequency + fineFrequency;

    for (const crater of craters) {
      const angularDistance = Math.acos(
        THREE.MathUtils.clamp(direction.dot(crater.direction), -1, 1),
      );
      const bowl = 1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.08,
        crater.radius,
      );
      const rim = THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.72,
        crater.radius * 0.94,
      ) * (1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.94,
        crater.radius * 1.16,
      ));
      radialScale -= bowl * crater.depth;
      radialScale += rim * crater.rim;
    }

    const grooveDistance = Math.abs(direction.dot(grooveNormal));
    const groove = 1 - THREE.MathUtils.smoothstep(grooveDistance, 0.0, 0.055);
    radialScale -= groove * 0.018;

    vertex.multiplyScalar(radialScale).multiply(stretch);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Creates material sets for the three broad composition classes. */
function createCompositionMaterials() {
  const texture = makeRockTexture();
  texture.repeat.set(2.8, 2.8);

  return Object.fromEntries(
    Object.entries(COMPOSITIONS).map(([key, composition]) => [
      key,
      composition.colors.map((color, index) => new THREE.MeshStandardMaterial({
        map: texture,
        bumpMap: texture,
        bumpScale: key === "M" ? 0.065 : 0.115,
        color,
        roughness: composition.roughness + index * 0.015,
        metalness: composition.metalness,
        flatShading: index === 1,
        envMapIntensity: key === "M" ? 0.36 : 0.12,
      })),
    ]),
  );
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
function attachAsteroidMetadata(mesh, {
  name,
  composition,
  diameter,
  semiMajor,
  orbitalSpeed,
  description,
  family = "Background population",
  population = "Main belt",
}) {
  const compositionData = COMPOSITIONS[composition];
  const au = radiusToAU(THREE.MathUtils.clamp(
    semiMajor,
    BELT_INNER_RADIUS,
    BELT_OUTER_RADIUS,
  ));

  mesh.name = name;
  mesh.userData = {
    name,
    detail: `${compositionData.label} | ${family}`,
    focusScale: 7.5,
    minFocusDistance: 1.35,
    orbitRadius: semiMajor,
    info: {
      type: population === "Trojan cloud" ? "Jupiter Trojan asteroid" : "Asteroid",
      diameter,
      orbitalSpeed,
      distanceFromEarth: population === "Trojan cloud"
        ? "Near Jupiter's orbit; distance from Earth continuously varies"
        : `≈ ${au.toFixed(2)} AU from the Sun; distance from Earth continuously varies`,
      description: `${description} Composition: ${compositionData.density}. Orbital group: ${family}.`,
    },
  };
}

/** Creates one clickable mesh and stores its orbital state. */
function createAsteroidMesh({
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
}) {
  const materialSet = materials[composition];
  const geometry = geometryPool[composition][index % geometryPool[composition].length];
  const mesh = new THREE.Mesh(geometry, materialSet[index % materialSet.length]);

  mesh.scale.setScalar(size);
  mesh.scale.multiply(new THREE.Vector3(
    0.82 + seededRandom(index * 3 + 1) * 0.45,
    0.75 + seededRandom(index * 3 + 2) * 0.42,
    0.86 + seededRandom(index * 3 + 3) * 0.48,
  ));
  mesh.rotation.set(
    seededRandom(index + 61) * Math.PI,
    seededRandom(index + 62) * Math.PI,
    seededRandom(index + 63) * Math.PI,
  );

  mesh.userData.orbit = orbit;
  mesh.userData.spin = new THREE.Vector3(
    (seededRandom(index + 71) - 0.5) * 0.006,
    (seededRandom(index + 72) - 0.5) * 0.007,
    (seededRandom(index + 73) - 0.5) * 0.005,
  );

  positionFromOrbit(mesh.position, orbit, orbit.angle);

  attachAsteroidMetadata(mesh, {
    name,
    composition,
    diameter,
    semiMajor: orbit.semiMajor,
    orbitalSpeed: `${(14 + seededRandom(index + 90) * 7).toFixed(1)} km/s`,
    description,
    family,
    population,
  });

  // Metadata assignment above replaces userData, so restore dynamic state.
  mesh.userData.orbit = orbit;
  mesh.userData.spin = new THREE.Vector3(
    (seededRandom(index + 71) - 0.5) * 0.006,
    (seededRandom(index + 72) - 0.5) * 0.007,
    (seededRandom(index + 73) - 0.5) * 0.005,
  );
  return mesh;
}

/** Generates a sparse point cloud for the millions of unresolved pebble bodies. */
function createDistantDebris() {
  const count = 4200;
  const positions = [];
  const colors = [];
  const colorPalette = [
    new THREE.Color(0x6e6258),
    new THREE.Color(0x393937),
    new THREE.Color(0x8a7766),
  ];

  let seed = 1;
  while (positions.length < count * 3) {
    const radius = BELT_INNER_RADIUS + seededRandom(seed++) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
    if (isInsideKirkwoodGap(radius)) continue;
    const angle = seededRandom(seed++) * Math.PI * 2;
    const inclination = (seededRandom(seed++) - 0.5) * 0.10;
    const vertical = Math.sin(angle * 1.7 + seed) * radius * inclination;
    positions.push(
      Math.cos(angle) * radius,
      vertical,
      Math.sin(angle) * radius,
    );
    const color = colorPalette[Math.floor(seededRandom(seed++) * colorPalette.length)];
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.055,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.28,
    vertexColors: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Unresolved asteroid debris";
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
    const rock = createAsteroidMesh({
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
    const composition = seededRandom(index + 7) < 0.75 ? "C" : "D";
    const mappedComposition = composition === "D" ? "C" : composition;
    const size = 0.045 + Math.pow(seededRandom(index + 8), 3) * 0.14;
    const rock = createAsteroidMesh({
      index,
      composition: mappedComposition,
      size,
      orbit,
      materials,
      geometryPool,
      name: `${label} Trojan ${String(member + 1).padStart(2, "0")}`,
      diameter: `${Math.round(3 + size * 90)} km`,
      description: `A dark primitive body librating around Jupiter's ${label} Trojan region, roughly 60° from the planet.`,
      family: `${label} Trojan swarm`,
      population: "Trojan cloud",
    });
    container.add(rock);
    rocks.push(rock);
  }
}

/**
 * Creates the complete interactive asteroid system.
 *
 * `hoverTargets` is optional for backwards compatibility. When supplied, the
 * whole system is raycast recursively, allowing every visible mesh to open the
 * same inspection card used by planets.
 */
export function createAsteroidBelt({ world, hoverTargets = [] }) {
  const system = new THREE.Group();
  system.name = "Asteroid populations";

  const mainBelt = new THREE.Group();
  mainBelt.name = "Main asteroid belt";
  const trojans = new THREE.Group();
  trojans.name = "Jupiter Trojan clouds";
  system.add(mainBelt, trojans);

  const materials = createCompositionMaterials();
  const geometryPool = {
    S: Array.from({ length: 8 }, (_, index) => createCrateredGeometry(100 + index, index % 3 === 0 ? 4 : 3)),
    M: Array.from({ length: 7 }, (_, index) => createCrateredGeometry(200 + index, index % 3 === 0 ? 4 : 3)),
    C: Array.from({ length: 9 }, (_, index) => createCrateredGeometry(300 + index, index % 4 === 0 ? 4 : 3)),
  };

  const rocks = [];

  // Four major bodies contain a large share of the belt's represented mass.
  MAJOR_BODIES.forEach((body, index) => {
    const orbit = {
      semiMajor: body.radius,
      eccentricity: body.eccentricity,
      inclination: body.inclination,
      node: seededRandom(index + 301) * Math.PI * 2,
      angle: body.angle,
      speed: body.orbitalSpeed,
    };
    const geometry = createCrateredGeometry(900 + index, 5, body.name === "Ceres" ? 0.68 : 0.20);
    geometryPool[body.composition].push(geometry);
    const rock = createAsteroidMesh({
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
    });
    mainBelt.add(rock);
    rocks.push(rock);
  });

  // Sparse background population with explicit resonance gaps.
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

    // A power distribution produces many small bodies and very few large ones.
    const size = 0.035 + Math.pow(seededRandom(index + 8), 4.6) * 0.34;
    const rock = createAsteroidMesh({
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

  const distantDebris = createDistantDebris();
  mainBelt.add(distantDebris);

  world.add(system);
  hoverTargets.push(system);

  return {
    system,
    mainBelt,
    trojans,
    rocks,
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

  asteroidBelt.distantDebris.rotation.y += 0.00016 * motionScale;
}

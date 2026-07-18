import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Jupiter's moons need two different kinds of scientific honesty:
 *
 * 1. Spacecraft have photographed the Galilean and small inner moons, so their
 *    characteristic geology, colour, and overall shapes can be represented.
 * 2. Most distant irregular moons are only points of light. For those bodies
 *    we build a unique 3D rock from the measured dynamical family and observed
 *    family colour, without pretending that its exact craters are known.
 *
 * All relief below is calculated in object-space. This prevents the flat,
 * repeating texture bands and circular decals that made earlier bodies look
 * painted instead of genuinely sculpted.
 */

const SURFACE_PALETTES = Object.freeze({
  io: { base: 0xd9a72b, light: 0xffe69a, dark: 0x4d2b1c, accent: 0xde5b19 },
  europa: { base: 0xb8aa91, light: 0xeee4ca, dark: 0x58372f, accent: 0x99573e },
  ganymede: { base: 0x69625a, light: 0xaaa18e, dark: 0x292825, accent: 0x81766a },
  callisto: { base: 0x403b35, light: 0x8b8477, dark: 0x171716, accent: 0xb8ae96 },
  amalthea: { base: 0x754036, light: 0xa77b64, dark: 0x2e2421, accent: 0xd0b489 },
  thebe: { base: 0x5f3a33, light: 0x876255, dark: 0x251f1e, accent: 0xa98771 },
  "inner-dark": { base: 0x4c3731, light: 0x786159, dark: 0x201d1c, accent: 0x9d8070 },
  "c-type": { base: 0x60615e, light: 0x858681, dark: 0x252625, accent: 0xa5a39a },
  "p-type": { base: 0x514943, light: 0x74685e, dark: 0x211f1e, accent: 0x8b7b6c },
  "d-type": { base: 0x654138, light: 0x8c5c4e, dark: 0x281e1b, accent: 0xa87863 },
  "mixed-dark": { base: 0x514b47, light: 0x756b64, dark: 0x211f1d, accent: 0x927664 },
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
  return value / normalization;
}

function smoothstep(edge0, edge1, value) {
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

function appearanceSettings(profile) {
  const isGalilean = profile.family === "Galilean moon";
  const isInner = profile.family === "Inner regular moon";
  const name = profile.catalogueName;
  if (name === "Io") return { broad: 0.004, rock: 0.0035, fine: 0.002, craters: 5, depth: 0.010 };
  if (name === "Europa") return { broad: 0.0018, rock: 0.0012, fine: 0.0008, craters: 3, depth: 0.004 };
  if (name === "Ganymede") return { broad: 0.007, rock: 0.006, fine: 0.003, craters: 13, depth: 0.025 };
  if (name === "Callisto") return { broad: 0.008, rock: 0.007, fine: 0.004, craters: 24, depth: 0.032 };
  if (isInner) return { broad: 0.075, rock: 0.032, fine: 0.012, craters: 12, depth: 0.085 };
  if (isGalilean) return { broad: 0.005, rock: 0.004, fine: 0.002, craters: 9, depth: 0.018 };
  return { broad: 0.095, rock: 0.040, fine: 0.016, craters: 7, depth: 0.075 };
}

function detailFor(profile, quality) {
  const isHero = profile.family === "Galilean moon";
  const isInner = profile.family === "Inner regular moon";

  // Polyhedron detail grows exponentially (roughly 4^detail). The previous
  // 10–14 values created an extreme geometry budget and pushed the adaptive
  // manager into a lower runtime tier after visiting Jupiter. These values keep
  // the hero moons smooth while holding the complete 115-moon system to a
  // predictable GPU/CPU budget.
  if (isHero) return quality === "low" ? 4 : quality === "medium" ? 5 : 6;
  if (isInner) return quality === "low" ? 3 : quality === "medium" ? 4 : 5;

  // Distant irregular moons are unresolved points at broad system scale. Their
  // silhouette becomes visible only during a close Jovian encounter, so a
  // modest sculpted mesh is enough and avoids 100+ expensive draw geometries.
  return quality === "low" ? 1 : quality === "medium" ? 2 : 3;
}

function makeCraterField(profile, settings) {
  return Array.from({ length: settings.craters }, (_, index) => {
    const heroScale = profile.family === "Galilean moon" ? 1 : 0.72;
    return {
      center: randomDirection(profile.seed + 3.17, index),
      radius: (0.075 + random01(profile.seed, index, 2) * 0.20) * heroScale,
      depth: settings.depth * (0.45 + random01(profile.seed, index, 3) * 0.75),
      rim: settings.depth * (0.17 + random01(profile.seed, index, 4) * 0.18),
    };
  });
}

function sampleCrater(direction, crater) {
  const angularDistance = Math.acos(
    THREE.MathUtils.clamp(direction.dot(crater.center), -1, 1),
  );
  const normalized = angularDistance / crater.radius;
  if (normalized > 1.28) return { height: 0, floor: 0, rim: 0 };
  const bowl = -crater.depth * Math.pow(Math.max(0, 1 - normalized * normalized), 1.35);
  const rim = crater.rim * Math.exp(-Math.pow((normalized - 0.96) / 0.12, 2));
  return {
    height: bowl + rim,
    floor: 1 - smoothstep(0.10, 0.88, normalized),
    rim: Math.exp(-Math.pow((normalized - 0.97) / 0.13, 2)),
  };
}

function makeGreatCircleFeatures(profile, count) {
  return Array.from({ length: count }, (_, index) => ({
    normal: randomDirection(profile.seed + 31.7, index),
    width: 0.012 + random01(profile.seed, index, 5) * 0.022,
    phase: random01(profile.seed, index, 6) * Math.PI * 2,
  }));
}

function sampleGreatCircle(direction, feature, seed) {
  const distance = Math.abs(direction.dot(feature.normal));
  const line = 1 - smoothstep(feature.width * 0.20, feature.width, distance);
  // Fractures and grooves are broken naturally instead of becoming perfect
  // machine-made rings around the sphere.
  const broken = 0.62 + 0.38 * smoothNoise3(
    direction.x * 38,
    direction.y * 38,
    direction.z * 38,
    seed + feature.phase,
  );
  return line * broken;
}

function sampleSpot(direction, center, radius) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  return 1 - smoothstep(radius * 0.30, radius, distance);
}

function setVertexColour(target, index, colour) {
  target[index * 3] = colour.r;
  target[index * 3 + 1] = colour.g;
  target[index * 3 + 2] = colour.b;
}

/**
 * Creates one unit-size, vertex-sculpted moon. The satellite system applies the
 * readable cinematic scale and places it on its measured orbital family.
 */
function createJovianGeometry(profile, quality) {
  const settings = appearanceSettings(profile);
  const geometry = new THREE.IcosahedronGeometry(1, detailFor(profile, quality));
  const positions = geometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const palette = SURFACE_PALETTES[profile.appearance] ?? SURFACE_PALETTES["mixed-dark"];
  const baseColour = new THREE.Color(palette.base);
  const lightColour = new THREE.Color(palette.light);
  const darkColour = new THREE.Color(palette.dark);
  const accentColour = new THREE.Color(palette.accent);
  const direction = new THREE.Vector3();
  const colour = new THREE.Color();
  const craterField = makeCraterField(profile, settings);
  const fractures = makeGreatCircleFeatures(
    profile,
    profile.catalogueName === "Europa" ? 17 : profile.catalogueName === "Ganymede" ? 10 : 0,
  );
  const volcanicSpots = profile.catalogueName === "Io"
    ? Array.from({ length: 14 }, (_, index) => ({
      center: randomDirection(profile.seed + 67.3, index),
      radius: 0.045 + random01(profile.seed, index, 8) * 0.11,
      hot: random01(profile.seed, index, 9) > 0.72,
    }))
    : [];

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm3(direction, 1.55, 4, profile.seed + 7) * settings.broad;
    const rocky = fbm3(direction, 6.4, 4, profile.seed + 47) * settings.rock;
    const fine = fbm3(direction, 21, 3, profile.seed + 101) * settings.fine;

    let craterHeight = 0;
    let craterFloor = 0;
    let craterRim = 0;
    craterField.forEach((crater) => {
      const sample = sampleCrater(direction, crater);
      craterHeight += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rim);
    });

    let fractureMask = 0;
    fractures.forEach((fracture) => {
      fractureMask = Math.max(
        fractureMask,
        sampleGreatCircle(direction, fracture, profile.seed),
      );
    });

    // Europa's ice lineae are shallow fractures, while Ganymede's bright
    // grooved terrain is slightly raised and interleaved with darker ground.
    const fractureRelief = profile.catalogueName === "Europa"
      ? -fractureMask * 0.0018
      : profile.catalogueName === "Ganymede"
        ? fractureMask * 0.0022
        : 0;
    const radialHeight = Math.max(
      0.72,
      1 + broad + rocky + fine + craterHeight + fractureRelief,
    );
    positions.setXYZ(
      index,
      direction.x * radialHeight,
      direction.y * radialHeight,
      direction.z * radialHeight,
    );

    const colourNoise = fbm3(direction, 7.8, 4, profile.seed + 163) * 0.5 + 0.5;
    colour.copy(baseColour).lerp(lightColour, colourNoise * 0.42);
    colour.lerp(darkColour, THREE.MathUtils.clamp(craterFloor * 0.46, 0, 0.62));
    colour.lerp(lightColour, THREE.MathUtils.clamp(craterRim * 0.28, 0, 0.38));

    if (profile.catalogueName === "Europa") {
      colour.lerp(accentColour, THREE.MathUtils.clamp(fractureMask * 0.78, 0, 0.82));
    } else if (profile.catalogueName === "Ganymede") {
      colour.lerp(lightColour, THREE.MathUtils.clamp(fractureMask * 0.48, 0, 0.56));
    } else if (profile.catalogueName === "Callisto") {
      // Bright icy ejecta around Callisto's impacts is one of its most legible
      // traits at a distance, especially against its ancient dark surface.
      colour.lerp(accentColour, THREE.MathUtils.clamp(craterRim * 0.60, 0, 0.66));
    }

    volcanicSpots.forEach((spot) => {
      const spotMask = sampleSpot(direction, spot.center, spot.radius);
      colour.lerp(spot.hot ? darkColour : accentColour, spotMask * (spot.hot ? 0.92 : 0.72));
    });

    // Amalthea's two famous bright patches contrast with its very red surface.
    if (profile.catalogueName === "Amalthea") {
      const patchA = sampleSpot(direction, new THREE.Vector3(0.76, 0.36, 0.54).normalize(), 0.22);
      const patchB = sampleSpot(direction, new THREE.Vector3(-0.58, -0.20, 0.79).normalize(), 0.16);
      colour.lerp(accentColour, Math.max(patchA, patchB) * 0.62);
    }

    setVertexColour(colours, index, colour);
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));

  // IcosahedronGeometry duplicates vertices at triangle boundaries. Merging
  // identical sculpted positions lets the normal calculation flow across those
  // boundaries, preserving a rough silhouette without visible triangular
  // lighting panels on the unresolved irregular moons.
  geometry.deleteAttribute("normal");
  const smoothGeometry = mergeVertices(geometry, 1e-5);
  smoothGeometry.computeVertexNormals();
  smoothGeometry.computeBoundingSphere();
  smoothGeometry.computeBoundingBox();
  geometry.dispose();
  return smoothGeometry;
}

/**
 * Returns a physical 3D moon mesh with a matte, low-reflectance surface. Exact
 * orbit placement, focus metadata, and interaction targets stay in the shared
 * satellite system so every one of Jupiter's moons behaves consistently.
 */
export function createJovianMoonSurface(profile, quality = "high") {
  const geometry = createJovianGeometry(profile, quality);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: profile.family === "Galilean moon" ? 0.94 : 1,
    metalness: 0,
    envMapIntensity: 0.012,
  });
  const moon = new THREE.Mesh(geometry, material);
  // Moon sizes are intentionally compressed/enlarged for readability. Letting
  // those cinematic scales cast physical shadows can create dark flashes across
  // the Sun and Jupiter when the whole system is viewed from far away.
  moon.castShadow = false;
  moon.receiveShadow = false;
  return moon;
}

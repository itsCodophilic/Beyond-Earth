import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PALETTES = Object.freeze({
  miranda: [0x8d9492, 0xc6cbc7, 0x4a4f4e, 0xa9afab],
  ariel: [0x9ea8a7, 0xd2dad6, 0x525958, 0xb9c3bf],
  umbriel: [0x454a4b, 0x747a79, 0x202425, 0x929590],
  titania: [0x707778, 0xa3aaaa, 0x383d3e, 0x8e9593],
  oberon: [0x5f5c59, 0x8a8780, 0x2c2c2b, 0x9a8072],
  puck: [0x505759, 0x767d7d, 0x242829, 0x686f70],
  caliban: [0x5c4d48, 0x806b62, 0x2a2523, 0x8a6255],
  sycorax: [0x574a46, 0x79645d, 0x282322, 0x8b6258],
  "inner-dark": [0x50595c, 0x737d7f, 0x24292b, 0x667174],
  "outer-neutral": [0x565b5d, 0x7a7f80, 0x272b2c, 0x6b7071],
  "outer-reddish": [0x5c4e49, 0x7d6961, 0x2b2523, 0x8e685b],
});

function hash3(x, y, z, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 97.13) * 43758.5453123;
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

function fbm(direction, frequency, octaves, seed) {
  let amplitude = 0.5;
  let value = 0;
  let total = 0;
  let scale = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += smoothNoise3(
      direction.x * scale,
      direction.y * scale,
      direction.z * scale,
      seed + octave * 17.3,
    ) * amplitude;
    total += amplitude;
    amplitude *= 0.51;
    scale *= 2.03;
  }
  return value / Math.max(0.0001, total);
}

function random01(seed, index, channel = 0) {
  const value = Math.sin(seed * 887.31 + index * 131.71 + channel * 313.19) * 43758.5453;
  return value - Math.floor(value);
}

function randomDirection(seed, index) {
  const z = random01(seed, index, 0) * 2 - 1;
  const angle = random01(seed, index, 1) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

function settingsFor(profile) {
  switch (profile.name) {
    case "Miranda": return { detail: 6, broad: 0.020, fine: 0.008, craters: 10, depth: 0.030, fractures: 16 };
    case "Ariel": return { detail: 6, broad: 0.007, fine: 0.003, craters: 9, depth: 0.018, fractures: 13 };
    case "Umbriel": return { detail: 6, broad: 0.009, fine: 0.004, craters: 18, depth: 0.028, fractures: 2 };
    case "Titania": return { detail: 6, broad: 0.008, fine: 0.004, craters: 15, depth: 0.024, fractures: 10 };
    case "Oberon": return { detail: 6, broad: 0.010, fine: 0.005, craters: 18, depth: 0.029, fractures: 4 };
    case "Puck": return { detail: 5, broad: 0.044, fine: 0.015, craters: 14, depth: 0.050, fractures: 0 };
    default: return { detail: 4, broad: 0.060, fine: 0.019, craters: 8, depth: 0.058, fractures: 0 };
  }
}

function sampleCrater(direction, crater) {
  const angularDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(crater.center), -1, 1));
  const q = angularDistance / crater.radius;
  if (q > 1.28) return { height: 0, floor: 0, rim: 0 };
  const bowl = q < 1 ? -crater.depth * Math.pow(1 - q * q, 1.45) : 0;
  const rim = crater.rim * Math.exp(-Math.pow((q - 0.96) / 0.12, 2));
  return {
    height: bowl + rim,
    floor: q < 1 ? Math.pow(1 - q, 1.2) : 0,
    rim: Math.exp(-Math.pow((q - 0.97) / 0.13, 2)),
  };
}

function makeFractures(profile, count) {
  return Array.from({ length: count }, (_, index) => ({
    normal: randomDirection(profile.seed + 13.7, index),
    width: 0.010 + random01(profile.seed, index, 6) * 0.022,
    offset: random01(profile.seed, index, 7) * Math.PI * 2,
  }));
}

function fractureMask(direction, fractures, seed) {
  let mask = 0;
  fractures.forEach((feature) => {
    const distance = Math.abs(direction.dot(feature.normal));
    const line = 1 - THREE.MathUtils.smoothstep(distance, feature.width * 0.22, feature.width);
    const broken = 0.55 + 0.45 * smoothNoise3(
      direction.x * 33,
      direction.y * 33,
      direction.z * 33,
      seed + feature.offset,
    );
    mask = Math.max(mask, line * broken);
  });
  return mask;
}

export function createUranianMoonSurface(profile, quality = "high") {
  const settings = settingsFor(profile);
  const detail = quality === "low"
    ? Math.max(3, settings.detail - 2)
    : quality === "medium"
      ? Math.max(4, settings.detail - 1)
      : settings.detail;
  const source = new THREE.IcosahedronGeometry(1, detail);
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const palette = PALETTES[profile.appearance] ?? PALETTES["outer-neutral"];
  const base = new THREE.Color(palette[0]);
  const light = new THREE.Color(palette[1]);
  const dark = new THREE.Color(palette[2]);
  const accent = new THREE.Color(palette[3]);
  const direction = new THREE.Vector3();
  const colour = new THREE.Color();
  const craterField = Array.from({ length: settings.craters }, (_, index) => ({
    center: randomDirection(profile.seed + 4.1, index),
    radius: 0.055 + random01(profile.seed, index, 2) * (profile.name === "Puck" ? 0.22 : 0.16),
    depth: settings.depth * (0.45 + random01(profile.seed, index, 3) * 0.70),
    rim: settings.depth * (0.16 + random01(profile.seed, index, 4) * 0.20),
  }));
  const fractures = makeFractures(profile, settings.fractures);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 1.7, 4, profile.seed + 5.2);
    const medium = fbm(direction, 6.4, 4, profile.seed + 41.9);
    const fine = fbm(direction, 20.0, 3, profile.seed + 87.4);
    let height = broad * settings.broad + medium * settings.broad * 0.45 + fine * settings.fine;
    let floor = 0;
    let rim = 0;

    craterField.forEach((crater) => {
      const sample = sampleCrater(direction, crater);
      height += sample.height;
      floor = Math.max(floor, sample.floor);
      rim = Math.max(rim, sample.rim);
    });

    const cracks = fractureMask(direction, fractures, profile.seed);
    if (profile.name === "Miranda") {
      // Patchwork coronae and broad scarps make Miranda visibly unlike a sphere.
      const longitude = Math.atan2(direction.z, direction.x);
      const latitude = Math.asin(direction.y);
      const patchwork = Math.abs(Math.sin(longitude * 4.5 + latitude * 3.0));
      height += THREE.MathUtils.smoothstep(patchwork, 0.70, 0.98) * 0.012;
      height -= cracks * 0.006;
    } else {
      height -= cracks * (profile.name === "Ariel" ? 0.0036 : 0.0020);
    }

    const radius = Math.max(0.70, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    colour.copy(base).lerp(light, THREE.MathUtils.clamp(0.26 + broad * 0.17 + medium * 0.12, 0, 0.52));
    colour.lerp(dark, THREE.MathUtils.clamp(floor * 0.52, 0, 0.62));
    colour.lerp(light, THREE.MathUtils.clamp(rim * 0.30, 0, 0.35));

    if (["Miranda", "Ariel", "Titania"].includes(profile.name)) {
      colour.lerp(accent, cracks * (profile.name === "Ariel" ? 0.35 : 0.22));
    }
    if (profile.name === "Umbriel") {
      const wunda = direction.dot(new THREE.Vector3(0.64, 0.26, -0.72).normalize());
      const ring = Math.exp(-Math.pow((wunda - 0.86) / 0.045, 2));
      colour.lerp(accent, ring * 0.62);
    }
    if (profile.name === "Oberon") {
      colour.lerp(accent, rim * 0.20 + Math.max(0, direction.x) * 0.05);
    }

    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  source.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source, 1e-5);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  source.dispose();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.985,
      metalness: 0,
      envMapIntensity: 0.012,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

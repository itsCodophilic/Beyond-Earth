import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PALETTES = Object.freeze({
  mimas: [0xb7b5ae, 0xe0ddd3, 0x66645f],
  enceladus: [0xe4eaec, 0xffffff, 0x8ca8b3],
  tethys: [0xc9c8c1, 0xf0eee7, 0x73716d],
  dione: [0xb5b6b3, 0xe5e7e3, 0x666a69],
  rhea: [0xaaa9a4, 0xd4d2ca, 0x5e5d59],
  titan: [0xb96f2e, 0xe3a95f, 0x6e3f24],
  hyperion: [0x8b735f, 0xb99b7c, 0x3e332b],
  iapetus: [0xa79d8d, 0xe2ded2, 0x282724],
  phoebe: [0x4b4a47, 0x77736d, 0x242423],
  "ring-ridge": [0xb9b5aa, 0xe0dbcd, 0x68645d],
  "ring-ice": [0xa8a69f, 0xd1cec3, 0x5b5954],
  "smooth-ice": [0xc8c7c1, 0xe7e5dd, 0x77756f],
  "ice-rock": [0x96938c, 0xc2bdb2, 0x514f4b],
});

function hash3(x, y, z, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 91.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function fbm(direction, frequency, seed) {
  let value = 0;
  let amplitude = 0.55;
  let total = 0;
  for (let octave = 0; octave < 4; octave += 1) {
    value += hash3(
      Math.floor(direction.x * frequency),
      Math.floor(direction.y * frequency),
      Math.floor(direction.z * frequency),
      seed + octave * 17.3,
    ) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

function randomDirection(seed, index) {
  const z = (Math.sin(seed * 43.7 + index * 19.1) * 0.5 + 0.5) * 2 - 1;
  const angle = (Math.sin(seed * 17.9 + index * 71.3) * 0.5 + 0.5) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

function craterSample(direction, center, radius, depth, rim) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  const normalized = distance / radius;
  if (normalized > 1.28) return { height: 0, floor: 0, rimMask: 0 };
  const bowl = normalized < 1 ? -depth * Math.pow(1 - normalized * normalized, 1.45) : 0;
  const rimMask = Math.exp(-Math.pow((normalized - 0.96) / 0.12, 2));
  return { height: bowl + rim * rimMask, floor: Math.max(0, 1 - normalized), rimMask };
}

function settings(profile) {
  const name = profile.name;
  if (name === "Titan") return { detail: 5, rough: 0.0018, craters: 0, craterDepth: 0 };
  if (name === "Enceladus") return { detail: 5, rough: 0.003, craters: 4, craterDepth: 0.006 };
  if (name === "Mimas") return { detail: 5, rough: 0.008, craters: 12, craterDepth: 0.025 };
  if (name === "Hyperion") return { detail: 4, rough: 0.055, craters: 28, craterDepth: 0.09 };
  if (name === "Phoebe") return { detail: 4, rough: 0.035, craters: 18, craterDepth: 0.055 };
  if (["Tethys", "Dione", "Rhea", "Iapetus"].includes(name)) return { detail: 5, rough: 0.010, craters: 16, craterDepth: 0.028 };
  return { detail: 3, rough: 0.026, craters: 9, craterDepth: 0.045 };
}

function createCraters(profile, count, depth) {
  const craters = Array.from({ length: count }, (_, index) => ({
    center: randomDirection(profile.seed + 0.31, index),
    radius: 0.07 + ((Math.sin(profile.seed * 97 + index * 13.7) * 0.5 + 0.5) * 0.17),
    depth: depth * (0.55 + (Math.sin(profile.seed * 31 + index * 7.9) * 0.5 + 0.5) * 0.65),
    rim: depth * 0.20,
  }));
  if (profile.name === "Mimas") {
    craters.push({ center: new THREE.Vector3(0.72, 0.18, 0.67).normalize(), radius: 0.54, depth: 0.12, rim: 0.028 });
  }
  return craters;
}

export function createSaturnianMoonSurface(profile, quality = "high") {
  const config = settings(profile);
  const detail = quality === "low" ? Math.max(2, config.detail - 2) : quality === "medium" ? Math.max(3, config.detail - 1) : config.detail;
  const source = new THREE.IcosahedronGeometry(1, detail);
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const paletteValues = PALETTES[profile.appearance] ?? PALETTES["ice-rock"];
  const base = new THREE.Color(paletteValues[0]);
  const light = new THREE.Color(paletteValues[1]);
  const dark = new THREE.Color(paletteValues[2]);
  const colour = new THREE.Color();
  const direction = new THREE.Vector3();
  const craters = createCraters(profile, config.craters, config.craterDepth);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 2.0, profile.seed + 1.7);
    const fine = fbm(direction, 12.0, profile.seed + 13.1);
    let height = broad * config.rough + fine * config.rough * 0.38;
    let floor = 0;
    let rimMask = 0;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
      floor = Math.max(floor, sample.floor);
      rimMask = Math.max(rimMask, sample.rimMask);
    });

    let fracture = 0;
    if (["Enceladus", "Dione", "Tethys"].includes(profile.name)) {
      const bands = Math.abs(Math.sin((Math.atan2(direction.z, direction.x) + direction.y * 1.8) * 11));
      fracture = THREE.MathUtils.smoothstep(0.91, 0.995, bands);
      height -= fracture * (profile.name === "Enceladus" ? 0.0035 : 0.0018);
    }

    if (profile.name === "Iapetus") {
      const ridge = Math.exp(-Math.pow(direction.y / 0.045, 2));
      height += ridge * 0.016;
    }

    const radius = Math.max(0.62, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    colour.copy(base).lerp(light, THREE.MathUtils.clamp(0.30 + broad * 0.22 + fine * 0.10, 0, 0.58));
    colour.lerp(dark, THREE.MathUtils.clamp(floor * 0.45, 0, 0.58));
    colour.lerp(light, THREE.MathUtils.clamp(rimMask * 0.20 + fracture * 0.45, 0, 0.55));

    if (profile.name === "Iapetus") {
      const darkHemisphere = THREE.MathUtils.smoothstep(-0.12, 0.42, direction.x);
      colour.lerp(dark, darkHemisphere * 0.82);
    }
    if (profile.name === "Titan") {
      const latitudeBands = 0.5 + 0.5 * Math.sin(direction.y * 18 + broad * 2);
      colour.lerp(light, latitudeBands * 0.12);
    }

    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  source.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source, 1e-5);
  geometry.computeVertexNormals();
  source.dispose();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: profile.name === "Titan" ? 0.90 : 0.98,
      metalness: 0,
      envMapIntensity: 0.018,
    }),
  );
}

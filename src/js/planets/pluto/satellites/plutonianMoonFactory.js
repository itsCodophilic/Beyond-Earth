import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PALETTES = Object.freeze({
  charon: [0x969491, 0xc0bdb8, 0x4a4948, 0x7a4b48],
  nix: [0xbab8b1, 0xe0ddd4, 0x686560, 0x9a6657],
  hydra: [0xb6b5af, 0xdcdad3, 0x64635f, 0x9a9993],
  kerberos: [0x66615f, 0x8b8580, 0x343130, 0x756a65],
  "small-bright": [0xaaa8a1, 0xd6d3cb, 0x5c5a57, 0x8f8b84],
});

function random01(seed, index, channel = 0) {
  const value = Math.sin(seed * 881.7 + index * 137.3 + channel * 317.9) * 43758.5453;
  return value - Math.floor(value);
}

function randomDirection(seed, index) {
  const z = random01(seed, index, 0) * 2 - 1;
  const angle = random01(seed, index, 1) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

function noise(direction, seed, frequency) {
  const value = Math.sin(
    Math.floor(direction.x * frequency) * 127.1
    + Math.floor(direction.y * frequency) * 311.7
    + Math.floor(direction.z * frequency) * 74.7
    + seed * 93.1,
  ) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function createPlutonianMoonSurface(profile, quality = "high") {
  const detail = quality === "low" ? 3 : quality === "medium" ? 4 : profile.name === "Charon" ? 6 : 4;
  const source = new THREE.IcosahedronGeometry(1, detail);
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const values = PALETTES[profile.appearance] ?? PALETTES["small-bright"];
  const base = new THREE.Color(values[0]);
  const light = new THREE.Color(values[1]);
  const dark = new THREE.Color(values[2]);
  const accent = new THREE.Color(values[3]);
  const colour = new THREE.Color();
  const direction = new THREE.Vector3();
  const craterCount = profile.name === "Charon" ? 14 : 6;
  const craterCenters = Array.from({ length: craterCount }, (_, index) => randomDirection(profile.seed + 2.7, index));

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = noise(direction, profile.seed + 1.9, 2.8);
    const fine = noise(direction, profile.seed + 8.2, 16.0);
    let height = broad * (profile.name === "Charon" ? 0.008 : 0.038)
      + fine * (profile.name === "Charon" ? 0.003 : 0.014);
    let craterFloor = 0;
    let craterRim = 0;

    craterCenters.forEach((center, craterIndex) => {
      const radius = 0.055 + random01(profile.seed, craterIndex, 3) * (profile.name === "Charon" ? 0.12 : 0.18);
      const angular = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
      const q = angular / radius;
      if (q > 1.26) return;
      if (q < 1) {
        const bowl = Math.pow(1 - q * q, 1.45);
        height -= bowl * (profile.name === "Charon" ? 0.022 : 0.045);
        craterFloor = Math.max(craterFloor, bowl);
      }
      const rim = Math.exp(-Math.pow((q - 0.96) / 0.13, 2));
      height += rim * (profile.name === "Charon" ? 0.005 : 0.010);
      craterRim = Math.max(craterRim, rim);
    });

    const radius = Math.max(0.70, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    colour.copy(base).lerp(light, THREE.MathUtils.clamp(0.25 + broad * 0.16 + fine * 0.08, 0, 0.50));
    colour.lerp(dark, craterFloor * 0.40);
    colour.lerp(light, craterRim * 0.16);

    if (profile.name === "Charon") {
      const northCap = THREE.MathUtils.smoothstep(direction.y, 0.48, 0.88);
      colour.lerp(accent, northCap * 0.62);
    } else if (profile.name === "Nix") {
      const redCrater = direction.dot(new THREE.Vector3(0.78, 0.12, -0.61).normalize());
      const redSpot = THREE.MathUtils.smoothstep(redCrater, 0.83, 0.97);
      colour.lerp(accent, redSpot * 0.72);
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

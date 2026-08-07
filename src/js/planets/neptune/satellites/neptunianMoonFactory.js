import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PALETTES = Object.freeze({
  naiad: [0xcfd1d2, 0xf2f3f3, 0x4a4d50, 0xe5e6e6],
  triton: [0xc7b4ad, 0xeadbd0, 0x75666a, 0x9a6d68],
  proteus: [0x4e5357, 0x74787a, 0x242729, 0x5d6163],
  nereid: [0x777c82, 0xa3a6aa, 0x3d4145, 0x858a8e],
  "inner-dark": [0x4a5055, 0x73787c, 0x222629, 0x5e656a],
  "outer-dark": [0x565b60, 0x7a7f84, 0x262a2e, 0x656b70],
});

const PUBLIC_TEXTURE_BASE = `${import.meta.env.BASE_URL}assets/textures/neptune/moons/`;
const NAIAD_TEXTURE_URL = `${PUBLIC_TEXTURE_BASE}naiad/naiad-equirectangular.png`;

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function getCachedTexture(url) {
  if (!textureCache.has(url)) {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    textureCache.set(url, texture);
  }
  return textureCache.get(url);
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

function randomDirection(seed, index) {
  const z = (Math.sin(seed * 31.3 + index * 11.7) * 0.5 + 0.5) * 2 - 1;
  const angle = (Math.sin(seed * 19.9 + index * 41.1) * 0.5 + 0.5) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(angle) * radius, z, Math.sin(angle) * radius);
}

function createBaseGeometry(profile, quality, hero) {
  if (profile.name === "Naiad") {
    const segments = quality === "low"
      ? [40, 28]
      : quality === "medium"
        ? [56, 40]
        : [72, 52];
    return new THREE.SphereGeometry(1, segments[0], segments[1]);
  }

  const detail = quality === "low" ? (hero ? 3 : 2) : quality === "medium" ? (hero ? 4 : 3) : (hero ? 5 : 3);
  return new THREE.IcosahedronGeometry(1, detail);
}

function createNaiadMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getCachedTexture(NAIAD_TEXTURE_URL),
    roughness: 0.985,
    metalness: 0,
    envMapIntensity: 0.02,
  });
}

export function createNeptunianMoonSurface(profile, quality = "high") {
  const hero = ["Naiad", "Triton", "Proteus", "Nereid"].includes(profile.name);
  const isNaiad = profile.name === "Naiad";
  const source = createBaseGeometry(profile, quality, hero);
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const paletteValues = PALETTES[profile.appearance] ?? PALETTES["outer-dark"];
  const base = new THREE.Color(paletteValues[0]);
  const light = new THREE.Color(paletteValues[1]);
  const dark = new THREE.Color(paletteValues[2]);
  const accent = new THREE.Color(paletteValues[3]);
  const colour = new THREE.Color();
  const direction = new THREE.Vector3();
  const craterCount = profile.name === "Proteus" ? 18 : profile.name === "Triton" ? 5 : isNaiad ? 12 : 9;
  const craterCenters = Array.from({ length: craterCount }, (_, index) => randomDirection(profile.seed + 0.4, index));

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = noise(direction, profile.seed + 1.1, isNaiad ? 2.0 : 2.4);
    const fine = noise(direction, profile.seed + 8.7, isNaiad ? 11.0 : 13.0);
    const roughness = isNaiad
      ? 0.014
      : profile.name === "Triton"
        ? 0.003
        : profile.name === "Proteus"
          ? 0.042
          : 0.022;
    let height = broad * roughness + fine * roughness * (isNaiad ? 0.20 : 0.32);
    let craterFloor = 0;

    craterCenters.forEach((center, craterIndex) => {
      const radius = isNaiad
        ? 0.05 + ((craterIndex * 0.071 + profile.seed) % 1) * 0.11
        : 0.07 + ((craterIndex * 0.071 + profile.seed) % 1) * 0.15;
      const angular = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
      const normalized = angular / radius;
      if (normalized < 1.25) {
        const bowlDepth = isNaiad ? 0.018 : profile.name === "Proteus" ? 0.060 : 0.025;
        const bowl = normalized < 1 ? -bowlDepth * Math.pow(1 - normalized * normalized, 1.4) : 0;
        const rim = (isNaiad ? 0.006 : 0.010) * Math.exp(-Math.pow((normalized - 0.96) / 0.13, 2));
        height += bowl + rim;
        craterFloor = Math.max(craterFloor, Math.max(0, 1 - normalized));
      }
    });

    let streak = 0;
    if (profile.name === "Triton") {
      const longitude = Math.atan2(direction.z, direction.x);
      streak = THREE.MathUtils.smoothstep(0.88, 0.99, Math.abs(Math.sin(longitude * 9 + direction.y * 13)));
      height -= streak * 0.0015;
    }

    if (isNaiad) {
      // Very gentle asymmetry: Naiad should stay slim and slightly lopsided,
      // but not become a jagged rock. The supplied texture provides most of
      // the visual identity; geometry only adds subtle silhouette realism.
      height += Math.max(direction.x, 0) * 0.010;
      height -= Math.max(-direction.x, 0) * 0.012;
      height -= Math.max(-direction.y, 0) * 0.008;
    }

    const radius = Math.max(0.68, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    colour.copy(base).lerp(light, THREE.MathUtils.clamp(0.30 + broad * 0.20 + fine * 0.10, 0, 0.52));
    colour.lerp(dark, craterFloor * (isNaiad ? 0.26 : 0.42));
    if (profile.name === "Triton") {
      const polarFrost = THREE.MathUtils.smoothstep(0.15, 0.82, direction.y);
      colour.lerp(light, polarFrost * 0.35);
      colour.lerp(accent, streak * 0.52);
    }
    if (isNaiad) {
      const brightCap = THREE.MathUtils.smoothstep(0.20, 0.88, direction.y * 0.8 + direction.x * 0.25);
      colour.lerp(accent, brightCap * 0.22);
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
    isNaiad
      ? createNaiadMaterial()
      : new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.98,
        metalness: 0,
        envMapIntensity: 0.015,
      }),
  );
}

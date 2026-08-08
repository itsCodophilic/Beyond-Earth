import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PALETTES = Object.freeze({
  naiad: [0xcfd1d2, 0xf2f3f3, 0x4a4d50, 0xe5e6e6],
  thalassa: [0xd8d3cb, 0xf1eee8, 0x6a655e, 0xe8e2d7],
  despina: [0xd4cec4, 0xefeae0, 0x605b56, 0xe2ddd2],
  galatea: [0xcac6be, 0xf0ede6, 0x585652, 0xe3ded4],
  triton: [0xc7b4ad, 0xeadbd0, 0x75666a, 0x9a6d68],
  proteus: [0x4e5357, 0x74787a, 0x242729, 0x5d6163],
  nereid: [0x777c82, 0xa3a6aa, 0x3d4145, 0x858a8e],
  "inner-dark": [0x4a5055, 0x73787c, 0x222629, 0x5e656a],
  "outer-dark": [0x565b60, 0x7a7f84, 0x262a2e, 0x656b70],
});

const PUBLIC_TEXTURE_BASE = `${import.meta.env.BASE_URL}assets/textures/neptune/moons/`;
const MAPPED_MOON_TEXTURES = Object.freeze({
  Naiad: `${PUBLIC_TEXTURE_BASE}naiad/naiad-equirectangular.png`,
  Thalassa: `${PUBLIC_TEXTURE_BASE}thalassa/thalassa-equirectangular.png`,
  Despina: `${PUBLIC_TEXTURE_BASE}despina/despina-equirectangular.png`,
  Galatea: `${PUBLIC_TEXTURE_BASE}galatea/galatea-equirectangular.png`,
});

// Textured inner moons need a slightly shifted UV seam so the least important
// part of the map stays toward the rear / darker side during inspection.
const MAPPED_MOON_UV_OFFSETS = Object.freeze({
  Naiad: 0.38,
  Thalassa: 0.32,
  Despina: 0.36,
  Galatea: 0.34,
});

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function getCachedTexture(url, offsetX = 0) {
  const key = `${url}|${offsetX}`;
  if (!textureCache.has(key)) {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.offset.x = offsetX;
    texture.needsUpdate = true;
    textureCache.set(key, texture);
  }
  return textureCache.get(key);
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

function isMappedInnerMoon(name) {
  return Object.hasOwn(MAPPED_MOON_TEXTURES, name);
}

function createBaseGeometry(profile, quality, hero) {
  if (isMappedInnerMoon(profile.name)) {
    const segments = quality === "low"
      ? [48, 36]
      : quality === "medium"
        ? [72, 52]
        : [96, 72];
    return new THREE.SphereGeometry(1, segments[0], segments[1]);
  }

  const detail = quality === "low" ? (hero ? 3 : 2) : quality === "medium" ? (hero ? 4 : 3) : (hero ? 5 : 3);
  return new THREE.IcosahedronGeometry(1, detail);
}

function createMappedMoonMaterial(profile) {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getCachedTexture(
      MAPPED_MOON_TEXTURES[profile.name],
      MAPPED_MOON_UV_OFFSETS[profile.name] ?? 0,
    ),
    roughness: 0.985,
    metalness: 0,
    envMapIntensity: 0.02,
  });
}

function createMappedMoonMesh(profile, quality) {
  // IMPORTANT: these moons use direct UV textures. To prevent seam tearing,
  // visible side gaps, or pinched/warped poles, keep the geometry as a clean
  // closed sphere. The silhouette elongation is handled later by profile.shape
  // in the shared satellite system, so we do not sculpt or merge vertices here.
  const geometry = createBaseGeometry(profile, quality, true);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, createMappedMoonMaterial(profile));
  mesh.name = `${profile.name} textured surface`;

  // Tiny orientation tuning so the texture seam sits away from the preferred
  // hero view and the polar wrap start is less noticeable.
  if (profile.name === "Thalassa") {
    mesh.rotation.y = 0.42;
    mesh.rotation.x = -0.03;
  } else if (profile.name === "Despina") {
    mesh.rotation.y = 0.54;
    mesh.rotation.x = -0.02;
  } else if (profile.name === "Galatea") {
    mesh.rotation.y = 0.46;
    mesh.rotation.x = -0.02;
  } else if (profile.name === "Naiad") {
    mesh.rotation.y = 0.38;
  }

  return mesh;
}

export function createNeptunianMoonSurface(profile, quality = "high") {
  const hero = ["Naiad", "Thalassa", "Despina", "Galatea", "Triton", "Proteus", "Nereid"].includes(profile.name);
  const isMappedMoon = isMappedInnerMoon(profile.name);

  if (isMappedMoon) {
    return createMappedMoonMesh(profile, quality);
  }

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
  const craterCount = profile.name === "Proteus" ? 18 : profile.name === "Triton" ? 5 : 9;
  const craterCenters = Array.from({ length: craterCount }, (_, index) => randomDirection(profile.seed + 0.4, index));

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = noise(direction, profile.seed + 1.1, 2.4);
    const fine = noise(direction, profile.seed + 8.7, 13.0);
    const roughness = profile.name === "Triton" ? 0.003 : profile.name === "Proteus" ? 0.042 : 0.022;
    let height = broad * roughness + fine * roughness * 0.32;
    let craterFloor = 0;

    craterCenters.forEach((center, craterIndex) => {
      const radius = 0.07 + ((craterIndex * 0.071 + profile.seed) % 1) * 0.15;
      const angular = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
      const normalized = angular / radius;
      if (normalized < 1.25) {
        const bowl = normalized < 1 ? -(profile.name === "Proteus" ? 0.060 : 0.025) * Math.pow(1 - normalized * normalized, 1.4) : 0;
        const rim = 0.010 * Math.exp(-Math.pow((normalized - 0.96) / 0.13, 2));
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

    const radius = Math.max(0.68, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    colour.copy(base).lerp(light, THREE.MathUtils.clamp(0.30 + broad * 0.20 + fine * 0.10, 0, 0.52));
    colour.lerp(dark, craterFloor * 0.42);
    if (profile.name === "Triton") {
      const polarFrost = THREE.MathUtils.smoothstep(0.15, 0.82, direction.y);
      colour.lerp(light, polarFrost * 0.35);
      colour.lerp(accent, streak * 0.52);
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
      roughness: 0.98,
      metalness: 0,
      envMapIntensity: 0.015,
    }),
  );
}

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PALETTES = Object.freeze({
  naiad: [0xcfd1d2, 0xf2f3f3, 0x4a4d50, 0xe5e6e6],
  thalassa: [0xd8d3cb, 0xf1eee8, 0x6a655e, 0xe8e2d7],
  despina: [0xd4cec4, 0xefeae0, 0x605b56, 0xe2ddd2],
  galatea: [0xcac6be, 0xf0ede6, 0x585652, 0xe3ded4],
  larissa: [0xd3d2cf, 0xf0efec, 0x56585a, 0xdeddd9],
  hippocamp: [0xd8d7d3, 0xf2f1ee, 0x626466, 0xe5e4e0],
  "proteus-mapped": [0x8f6e58, 0xb48a70, 0x4f3b31, 0x9b765f],
  "triton-mapped": [0xd8cbc5, 0xf1e8df, 0x817471, 0xc6b6b1],
  "nereid-mapped": [0xb8bbbe, 0xebeef0, 0x62676c, 0xd7dadd],
  halimede: [0x8b8d90, 0xc7c9cb, 0x43474b, 0xa5a8aa],
  sao: [0xb8b3ab, 0xe0dcd5, 0x514e4a, 0xc9c4bc],
  laomedeia: [0x777871, 0xa9aaa2, 0x41423e, 0x8d8e86],
  psamathe: [0xaaa9a4, 0xd2d1cb, 0x50514f, 0xbdbcb6],
  neso: [0xd8d5cc, 0xf2efe6, 0x68655f, 0xe5e0d7],
  "s-2021-n1": [0xa4a7a9, 0xd2d5d7, 0x4c5053, 0xb9bdc0],
  "s-2002-n5": [0xa4a7a9, 0xd2d5d7, 0x4c5053, 0xb9bdc0],
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
  Larissa: `${PUBLIC_TEXTURE_BASE}larissa/larissa-equirectangular.png`,
  Hippocamp: `${PUBLIC_TEXTURE_BASE}hippocamp/hippocamp-equirectangular.png`,
  Proteus: `${PUBLIC_TEXTURE_BASE}proteus/proteus-equirectangular.png`,
  Triton: `${PUBLIC_TEXTURE_BASE}triton/triton-equirectangular.png`,
  Nereid: `${PUBLIC_TEXTURE_BASE}nereid/nereid-equirectangular.png`,
  Halimede: `${PUBLIC_TEXTURE_BASE}halimede/halimede-equirectangular.png`,
  Sao: `${PUBLIC_TEXTURE_BASE}sao/sao-equirectangular.png`,
  Laomedeia: `${PUBLIC_TEXTURE_BASE}laomedeia/laomedeia-equirectangular.png`,
  Psamathe: `${PUBLIC_TEXTURE_BASE}psamathe/psamathe-equirectangular.png`,
  Neso: `${PUBLIC_TEXTURE_BASE}neso/neso-equirectangular.png`,
  "S/2021 N1": `${PUBLIC_TEXTURE_BASE}s-2021-n1/s-2021-n1-equirectangular.png`,
  "S/2002 N5": `${PUBLIC_TEXTURE_BASE}s-2002-n5/s-2002-n5-equirectangular.png`,
});

// Textured inner moons need a slightly shifted UV seam so the least important
// part of the map stays toward the rear / darker side during inspection.
const MAPPED_MOON_UV_OFFSETS = Object.freeze({
  Naiad: 0.38,
  Thalassa: 0.32,
  Despina: 0.36,
  Galatea: 0.34,
  Larissa: 0.29,
  Hippocamp: 0.33,
  Proteus: 0.27,
  Triton: 0.07,
  Nereid: 0.31,
  Halimede: 0.22,
  Sao: 0.18,
  Laomedeia: 0.33,
  Psamathe: 0.27,
  Neso: 0.31,
  "S/2021 N1": 0.24,
  "S/2002 N5": 0.24,
});

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

const FINAL_OUTER_MOON_MATERIAL_TUNING = Object.freeze({
  Sao: { roughness: 0.965, bumpScale: 0.026, envMapIntensity: 0.030 },
  Laomedeia: { roughness: 0.975, bumpScale: 0.018, envMapIntensity: 0.025 },
  Psamathe: { roughness: 0.955, bumpScale: 0.034, envMapIntensity: 0.032 },
  Neso: { roughness: 0.970, bumpScale: 0.022, envMapIntensity: 0.028 },
  "S/2021 N1": { roughness: 0.960, bumpScale: 0.030, envMapIntensity: 0.030 },
  "S/2002 N5": { roughness: 0.960, bumpScale: 0.030, envMapIntensity: 0.030 },
});

function getCachedTexture(url, offsetX = 0, repeatY = false) {
  const key = `${url}|${offsetX}|${repeatY ? "repeatY" : "clampY"}`;
  if (!textureCache.has(key)) {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
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

function isIrregularMappedMoon(name) {
  return [
    "Larissa",
    "Hippocamp",
    "Proteus",
    "Nereid",
    "Halimede",
    "Sao",
    "Laomedeia",
    "Psamathe",
    "Neso",
    "S/2021 N1",
    "S/2002 N5",
  ].includes(name);
}

function isStableWrappedIrregularMoon(name) {
  return ["Nereid", "Halimede"].includes(name);
}

function createBaseGeometry(profile, quality, hero) {
  if (["Nereid", "Halimede"].includes(profile.name)) {
    // Nereid and Halimede are intentionally based on a dense UV sphere rather
    // than an icosahedron. The earlier icosphere + custom projection exposed
    // the underlying triangular topology and, after the shader change, could
    // fail to render on some WebGL paths. A high-resolution SphereGeometry
    // gives us one predictable, closed shell with conventional UVs. The
    // normalized textures already match at 0/1 longitude and at both poles.
    const segments = quality === "low"
      ? [64, 48]
      : quality === "medium"
        ? [96, 72]
        : [144, 108];
    return new THREE.SphereGeometry(1, segments[0], segments[1]);
  }

  if (isMappedInnerMoon(profile.name)) {
    const isFinalOuterMoon = Object.hasOwn(FINAL_OUTER_MOON_MATERIAL_TUNING, profile.name);
    const segments = profile.name === "Triton"
      ? (quality === "low" ? [56, 40] : quality === "medium" ? [84, 60] : [112, 80])
      : isFinalOuterMoon
        ? (quality === "low" ? [56, 40] : quality === "medium" ? [84, 64] : [112, 84])
        : quality === "low"
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
  const surfaceTexture = getCachedTexture(
    MAPPED_MOON_TEXTURES[profile.name],
    MAPPED_MOON_UV_OFFSETS[profile.name] ?? 0,
  );
  const tuning = FINAL_OUTER_MOON_MATERIAL_TUNING[profile.name];

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: surfaceTexture,
    roughness: tuning?.roughness ?? 0.985,
    metalness: 0,
    envMapIntensity: tuning?.envMapIntensity ?? 0.02,
  });

  // The final six outer moons use high-detail grayscale/low-saturation maps.
  // Reusing the same continuous texture as a very shallow bump source gives
  // crater rims and rough terrain real lighting response without deforming the
  // mesh, opening seams, or introducing the polygon artifacts we fixed earlier.
  if (tuning) {
    material.bumpMap = surfaceTexture;
    material.bumpScale = tuning.bumpScale;
  }

  return material;
}

function smoothDirectionalRelief(direction, seed) {
  // Continuous object-space relief. No floor/fract hashing is used here:
  // duplicated UV-seam vertices therefore receive the same displacement and
  // can never pull apart to reveal the space background.
  return (
    Math.sin(direction.x * 3.73 + direction.y * 1.91 + seed * 6.7) * 0.46
    + Math.sin(direction.y * 4.31 - direction.z * 2.27 + seed * 9.3) * 0.31
    + Math.sin(direction.z * 5.17 + direction.x * 2.11 - seed * 4.9) * 0.23
  );
}

function deformIrregularMappedMoonGeometry(profile, geometry) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const direction = new THREE.Vector3();
  const featureA = randomDirection(profile.seed + 2.4, 0);
  const featureB = randomDirection(profile.seed + 2.4, 1);
  const featureC = randomDirection(profile.seed + 2.4, 2);
  const axisA = new THREE.Vector3(1.0, 0.10, -0.05).normalize();
  const axisB = new THREE.Vector3(-0.75, 0.18, 0.58).normalize();
  const axisC = new THREE.Vector3(-0.15, -0.92, -0.20).normalize();
  const shape = profile.shape ?? [1, 1, 1];

  for (let i = 0; i < positions.count; i += 1) {
    direction.fromBufferAttribute(positions, i).normalize();
    let radius = 1;

    if (profile.name === "Nereid") {
      // Nereid remains visibly irregular, but its relief is deliberately low
      // frequency and continuous so the texture never breaks into polygons.
      const relief = smoothDirectionalRelief(direction, profile.seed);
      const craterA = Math.max(0, direction.dot(featureA));
      const craterB = Math.max(0, direction.dot(featureB));
      const shoulder = Math.max(0, direction.dot(featureC));
      radius += relief * 0.026;
      radius -= Math.pow(craterA, 7.0) * 0.050;
      radius -= Math.pow(craterB, 8.0) * 0.032;
      radius += Math.pow(shoulder, 3.0) * 0.020;
    } else if (profile.name === "Halimede") {
      // Three broad support lobes give Halimede the triangular/blocky outline
      // from the reference while the transitions stay curved rather than
      // following individual mesh triangles.
      const lobeA = Math.max(0, direction.dot(axisA));
      const lobeB = Math.max(0, direction.dot(axisB));
      const lobeC = Math.max(0, direction.dot(axisC));
      const cavity = Math.max(0, direction.dot(featureA));
      const relief = smoothDirectionalRelief(direction, profile.seed + 0.37);
      radius += Math.pow(lobeA, 3.0) * 0.090;
      radius += Math.pow(lobeB, 3.1) * 0.070;
      radius += Math.pow(lobeC, 3.2) * 0.082;
      radius -= Math.pow(cavity, 7.0) * 0.052;
      radius += relief * 0.018;
    } else if (profile.name === "Larissa") {
      radius += noise(direction, profile.seed + 3.0, 4.0) * 0.022;
    } else if (profile.name === "Hippocamp") {
      radius += noise(direction, profile.seed + 4.0, 4.5) * 0.018;
    } else if (profile.name === "Proteus") {
      radius += noise(direction, profile.seed + 4.6, 4.0) * 0.028;
    } else if (profile.name === "Sao") {
      const relief = smoothDirectionalRelief(direction, profile.seed + 0.13);
      const shallowPit = Math.max(0, direction.dot(featureA));
      radius += relief * 0.030;
      radius -= Math.pow(shallowPit, 7.0) * 0.034;
    } else if (profile.name === "Laomedeia") {
      const relief = smoothDirectionalRelief(direction, profile.seed + 0.41);
      radius += relief * 0.014;
      radius += Math.max(0, direction.dot(featureB)) * 0.012;
    } else if (profile.name === "Psamathe") {
      const relief = smoothDirectionalRelief(direction, profile.seed + 0.67);
      const pit = Math.max(0, direction.dot(featureA));
      radius += relief * 0.024;
      radius -= Math.pow(pit, 7.0) * 0.040;
    } else if (profile.name === "Neso") {
      const relief = smoothDirectionalRelief(direction, profile.seed + 0.82);
      const shoulder = Math.max(0, direction.dot(featureC));
      radius += relief * 0.026;
      radius += Math.pow(shoulder, 3.0) * 0.024;
    } else if (profile.name === "S/2021 N1" || profile.name === "S/2002 N5") {
      const seedOffset = profile.name === "S/2021 N1" ? 1.11 : 1.73;
      const relief = smoothDirectionalRelief(direction, profile.seed + seedOffset);
      const pitA = Math.max(0, direction.dot(featureA));
      const shoulder = Math.max(0, direction.dot(featureB));
      radius += relief * 0.028;
      radius -= Math.pow(pitA, 7.0) * 0.034;
      radius += Math.pow(shoulder, 3.0) * 0.018;
    }

    radius = Math.max(0.88, radius);

    if (isStableWrappedIrregularMoon(profile.name)) {
      positions.setXYZ(
        i,
        direction.x * radius * shape[0],
        direction.y * radius * shape[1],
        direction.z * radius * shape[2],
      );

      // Use a continuous radial normal rather than per-triangle normals. It is
      // intentionally a little softer than the exact geometric normal, which
      // removes faceting while preserving the irregular silhouette.
      if (normals) {
        const nx = direction.x / Math.max(shape[0], 0.001);
        const ny = direction.y / Math.max(shape[1], 0.001);
        const nz = direction.z / Math.max(shape[2], 0.001);
        const invLength = 1 / Math.max(Math.hypot(nx, ny, nz), 0.0001);
        normals.setXYZ(i, nx * invLength, ny * invLength, nz * invLength);
      }
    } else {
      positions.setXYZ(i, direction.x * radius, direction.y * radius, direction.z * radius);
    }
  }

  if (!isStableWrappedIrregularMoon(profile.name)) {
    geometry.deleteAttribute("normal");
    geometry.computeVertexNormals();
  } else if (normals) {
    normals.needsUpdate = true;
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function createMappedMoonMesh(profile, quality) {
  // Mapped moons use closed bodies. Nereid and Halimede use dense spherical
  // topology with continuous radial relief and ordinary UV texture mapping.
  const geometry = createBaseGeometry(profile, quality, true);
  if (isIrregularMappedMoon(profile.name)) {
    deformIrregularMappedMoonGeometry(profile, geometry);
  } else {
    geometry.computeVertexNormals();
  }

  // Nereid and Halimede intentionally use the same proven MeshStandardMaterial
  // path as the other visible moons. No custom shader is involved, which also
  // avoids the WebGL compile path that made these two bodies disappear.
  const material = createMappedMoonMaterial(profile);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${profile.name} textured surface`;
  if (["Nereid", "Halimede"].includes(profile.name)) {
    mesh.userData.geometryIncludesShape = true;
    mesh.userData.sealedTopology = "dense-sphere-continuous-relief";
  }

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
  } else if (profile.name === "Larissa") {
    mesh.rotation.y = 0.24;
    mesh.rotation.x = -0.01;
  } else if (profile.name === "Hippocamp") {
    mesh.rotation.y = 0.51;
    mesh.rotation.x = -0.02;
  } else if (profile.name === "Proteus") {
    mesh.rotation.y = 0.34;
    mesh.rotation.x = -0.04;
  } else if (profile.name === "Triton") {
    mesh.rotation.y = 0.10;
    mesh.rotation.x = -0.02;
  } else if (profile.name === "Nereid") {
    mesh.rotation.y = 0.46;
    mesh.rotation.x = -0.03;
  } else if (profile.name === "Halimede") {
    mesh.rotation.y = 0.58;
    mesh.rotation.x = -0.07;
  } else if (profile.name === "Sao") {
    mesh.rotation.y = 0.36;
    mesh.rotation.x = -0.05;
  } else if (profile.name === "Laomedeia") {
    mesh.rotation.y = 0.22;
    mesh.rotation.x = -0.02;
  } else if (profile.name === "Psamathe") {
    mesh.rotation.y = 0.49;
    mesh.rotation.x = -0.04;
  } else if (profile.name === "Neso") {
    mesh.rotation.y = 0.31;
    mesh.rotation.x = -0.03;
  } else if (profile.name === "S/2021 N1") {
    mesh.rotation.y = 0.42;
    mesh.rotation.x = -0.06;
  } else if (profile.name === "S/2002 N5") {
    mesh.rotation.y = 0.18;
    mesh.rotation.x = 0.03;
  } else if (profile.name === "Naiad") {
    mesh.rotation.y = 0.38;
  }

  return mesh;
}

export function createNeptunianMoonSurface(profile, quality = "high") {
  const hero = ["Naiad", "Thalassa", "Despina", "Galatea", "Larissa", "Hippocamp", "Proteus", "Triton", "Nereid", "Halimede", "Sao", "Laomedeia", "Psamathe", "Neso", "S/2021 N1", "S/2002 N5"].includes(profile.name);
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

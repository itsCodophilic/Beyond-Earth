import * as THREE from "three";

const PUBLIC_ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;

/**
 * Every Pluto moon uses its own global texture set derived from the supplied
 * visual reference. A photographed disk cannot be wrapped directly around a
 * 3D body: its black background, baked lighting and photographed limb would
 * stretch into obvious seams. These assets retain each reference's colours
 * and geology as unlit, pole-safe equirectangular maps instead.
 */
const PLUTONIAN_SURFACE_ASSETS = Object.freeze({
  Charon: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/charon-albedo-v1.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/charon-height-v1.jpg`,
    roughness: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/charon-roughness-v1.jpg`,
  },
  Styx: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/styx-albedo-v1.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/styx-height-v1.jpg`,
  },
  Nix: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/nix-albedo-v1.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/nix-height-v1.jpg`,
  },
  Kerberos: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/kerberos-albedo-v1.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/kerberos-height-v1.jpg`,
  },
  Hydra: {
    albedo: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/hydra-albedo-v1.jpg`,
    height: `${PUBLIC_ASSET_ROOT}/textures/pluto/moons/hydra-height-v1.jpg`,
  },
});

const plutonianTextureLoader = new THREE.TextureLoader();
const plutonianTextureCache = new Map();

/**
 * Loads one reusable Pluto-system texture and configures it for a spherical
 * UV seam. Colour textures use sRGB; height/roughness maps remain linear data.
 */
function loadPlutonianTexture(label, url, { color = false } = {}) {
  if (plutonianTextureCache.has(url)) return plutonianTextureCache.get(url);

  const texture = plutonianTextureLoader.load(url);
  texture.name = `${label} ${color ? "albedo" : "surface data"} map`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.userData.persistentPlutonianTexture = true;
  plutonianTextureCache.set(url, texture);
  return texture;
}

function getPlutonianSurfaceMaps(name) {
  const assets = PLUTONIAN_SURFACE_ASSETS[name];
  if (!assets) return null;

  return {
    albedoMap: loadPlutonianTexture(name, assets.albedo, { color: true }),
    heightMap: loadPlutonianTexture(name, assets.height),
    roughnessMap: assets.roughness
      ? loadPlutonianTexture(name, assets.roughness)
      : null,
  };
}

function hash3(x, y, z, seed) {
  const value = Math.sin(
    x * 127.1
    + y * 311.7
    + z * 74.7
    + seed * 53.17,
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
  const y0 = THREE.MathUtils.lerp(x00, x10, uy);
  const y1 = THREE.MathUtils.lerp(x01, x11, uy);
  return THREE.MathUtils.lerp(y0, y1, uz);
}

function fbm3(direction, frequency, octaves, seed) {
  let amplitude = 0.5;
  let value = 0;
  let normalization = 0;
  let scale = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += smoothNoise3(
      direction.x * scale,
      direction.y * scale,
      direction.z * scale,
      seed + octave * 17.13,
    ) * amplitude;
    normalization += amplitude;
    amplitude *= 0.52;
    scale *= 2.03;
  }
  return normalization > 0 ? value / normalization : 0;
}

function smoothstep(edge0, edge1, value) {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function directionFromSeed(seed, index) {
  const theta = (seed * 97.31 + index * 2.3999632297) % (Math.PI * 2);
  const y = THREE.MathUtils.clamp(
    Math.sin(seed * 31.7 + index * 1.61803398875) * 0.82,
    -0.82,
    0.82,
  );
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize();
}

function craterSample(direction, center, angularRadius, depth, rimStrength = 0.25) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  const normalized = distance / angularRadius;
  if (normalized > 1.25) return { height: 0, floor: 0, rim: 0 };
  const bowl = -depth * Math.pow(Math.max(0, 1 - normalized * normalized), 1.65);
  const rim = depth * rimStrength * Math.exp(-Math.pow((normalized - 0.96) / 0.11, 2));
  return {
    height: bowl + rim,
    floor: 1 - smoothstep(0.18, 0.88, normalized),
    rim: Math.exp(-Math.pow((normalized - 0.96) / 0.14, 2)),
  };
}

/**
 * A regular UV sphere supplies stable 2:1 texture coordinates and enough
 * vertices for relief. It is only the starting topology: createGeometry()
 * sculpts the small moons into their irregular observed silhouettes before the
 * catalogue's measured axis ratios are applied by the satellite system.
 */
function createBaseGeometry(profile, quality) {
  const segments = profile.name === "Charon"
    ? (quality === "low" ? [80, 50] : quality === "medium" ? [128, 80] : [192, 120])
    : (quality === "low" ? [48, 30] : quality === "medium" ? [80, 50] : [128, 80]);
  return new THREE.SphereGeometry(1, segments[0], segments[1]);
}

function basePalette(name) {
  const palettes = {
    Charon: {
      base: 0x8c8782,
      light: 0xb1aca5,
      dark: 0x5b5552,
      accent: 0x6b3833,
    },
    Styx: {
      base: 0xbcbdb8,
      light: 0xe0e0d8,
      dark: 0x858780,
      accent: 0x9d9f98,
    },
    Nix: {
      base: 0xc9c5bc,
      light: 0xe5e1d7,
      dark: 0x8c8983,
      accent: 0x9a5b4c,
    },
    Kerberos: {
      base: 0xb5b4aa,
      light: 0xd7d6cb,
      dark: 0x7f8078,
      accent: 0x99988e,
    },
    Hydra: {
      base: 0xc4c7c3,
      light: 0xe2e4df,
      dark: 0x858b88,
      accent: 0x747b79,
    },
  };
  return palettes[name] ?? palettes.Styx;
}

function createGeometry(profile, quality) {
  const geometry = createBaseGeometry(profile, quality);
  const positions = geometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const palette = basePalette(profile.name);
  const base = new THREE.Color(palette.base);
  const light = new THREE.Color(palette.light);
  const dark = new THREE.Color(palette.dark);
  const accent = new THREE.Color(palette.accent);
  const colour = new THREE.Color();
  const craterCount = profile.name === "Charon" ? 18 : profile.name === "Nix" || profile.name === "Hydra" ? 10 : 6;
  const craterCenters = Array.from({ length: craterCount }, (_, index) => directionFromSeed(profile.seed + 0.37, index));
  const redSpotCenter = new THREE.Vector3(0.58, 0.18, 0.79).normalize();
  const hydraDarkCenter = new THREE.Vector3(-0.52, 0.55, 0.65).normalize();
  const nixHollowDirection = new THREE.Vector3(-0.78, 0.38, 0.50).normalize();
  const hydraUpperShoulder = new THREE.Vector3(-0.58, 0.68, 0.44).normalize();
  const hydraSideShoulder = new THREE.Vector3(0.76, 0.18, 0.62).normalize();
  const hydraLowerShoulder = new THREE.Vector3(-0.18, -0.82, 0.54).normalize();

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm3(direction, profile.name === "Charon" ? 2.1 : 1.55, 4, profile.seed);
    const medium = fbm3(direction, profile.name === "Charon" ? 7.5 : 5.4, 4, profile.seed + 29.4);
    const fine = fbm3(direction, 20.0, 3, profile.seed + 83.7);
    let radius = 1;
    let craterFloor = 0;
    let craterRim = 0;

    const reliefStrength = profile.name === "Charon" ? 0.010 : 0.030;
    radius += broad * reliefStrength;
    radius += medium * (profile.name === "Charon" ? 0.006 : 0.018);
    radius += fine * (profile.name === "Charon" ? 0.0025 : 0.008);

    craterCenters.forEach((center, craterIndex) => {
      const sizeBase = profile.name === "Charon" ? 0.08 : 0.12;
      const angularRadius = sizeBase + ((craterIndex * 0.137 + profile.seed) % 1) * (profile.name === "Charon" ? 0.11 : 0.13);
      const depth = (profile.name === "Charon" ? 0.010 : 0.025)
        + ((craterIndex * 0.193 + profile.seed) % 1) * (profile.name === "Charon" ? 0.017 : 0.035);
      const sample = craterSample(direction, center, angularRadius, depth);
      radius += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rim);
    });

    if (profile.name === "Charon") {
      // New Horizons revealed a moon-spanning tectonic belt near the equator.
      const equatorial = 1 - smoothstep(0.025, 0.19, Math.abs(direction.y));
      const canyonModulation = 0.45 + 0.55 * Math.abs(Math.sin(Math.atan2(direction.z, direction.x) * 4.0 + direction.y * 7.0));
      radius -= equatorial * canyonModulation * 0.010;
    } else if (profile.name === "Nix") {
      // Nix is a rounded, flattened jelly bean with a shallow bite-like hollow
      // on one end rather than a conventional ellipsoid.
      const hollowDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(nixHollowDirection), -1, 1));
      const endHollow = 1 - smoothstep(0.14, 0.42, hollowDistance);
      radius *= 1 - endHollow * 0.075 + Math.max(0, direction.x) * 0.025;
    } else if (profile.name === "Kerberos") {
      // A continuous radial pinch creates a watertight contact-binary form;
      // unlike two intersecting meshes, no crack can expose the starfield.
      const waist = Math.exp(-Math.pow(direction.x / 0.31, 2));
      const positiveLobe = Math.max(0, direction.x);
      const negativeLobe = Math.max(0, -direction.x);
      const planarFacet = Math.abs(direction.y * direction.z) * 0.025;
      radius *= 1 - waist * 0.205 + positiveLobe * 0.075 + negativeLobe * 0.045 - planarFacet;
    } else if (profile.name === "Styx") {
      // Styx has two soft unequal bulbs connected by a broad shallow neck.
      const waist = Math.exp(-Math.pow(direction.x / 0.40, 2));
      radius *= 1 - waist * 0.145
        + Math.max(0, direction.x) * 0.065
        + Math.max(0, -direction.x) * 0.035;
    } else if (profile.name === "Hydra") {
      // Hydra's blocky outline has several broad shoulders separated by deep
      // saddles. Smooth directional lobes keep the result one closed mesh.
      const upperShoulder = Math.max(0, direction.dot(hydraUpperShoulder)) ** 3;
      const sideShoulder = Math.max(0, direction.dot(hydraSideShoulder)) ** 3;
      const lowerShoulder = Math.max(0, direction.dot(hydraLowerShoulder)) ** 3;
      const centralSaddle = Math.exp(-Math.pow(direction.x / 0.34, 2))
        * Math.max(0, direction.z);
      const lobeWaist = Math.exp(-Math.pow(direction.x / 0.30, 2));
      radius *= 1
        + upperShoulder * 0.155
        + sideShoulder * 0.135
        + lowerShoulder * 0.115
        - centralSaddle * 0.115
        - lobeWaist * 0.135
        + Math.max(0, direction.x) * 0.085
        + Math.max(0, -direction.x) * 0.055;
    }

    radius = Math.max(profile.name === "Charon" ? 0.95 : 0.84, radius);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    const surfaceNoise = THREE.MathUtils.clamp(medium * 0.5 + fine * 0.22 + 0.5, 0, 1);
    colour.copy(base)
      .lerp(light, surfaceNoise * (profile.name === "Charon" ? 0.28 : 0.42))
      .lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.48, 0, 0.58));

    if (profile.name === "Charon") {
      const polarWeight = smoothstep(0.42, 0.84, direction.y)
        * (0.82 + 0.18 * Math.sin(Math.atan2(direction.z, direction.x) * 2.0 + 0.7));
      colour.lerp(accent, THREE.MathUtils.clamp(polarWeight * 0.78, 0, 0.80));
      const canyonTone = (1 - smoothstep(0.035, 0.20, Math.abs(direction.y))) * 0.14;
      colour.lerp(dark, canyonTone);
    } else if (profile.name === "Nix") {
      const spotDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(redSpotCenter), -1, 1));
      const spot = 1 - smoothstep(0.20, 0.42, spotDistance);
      colour.lerp(accent, spot * 0.64);
    } else if (profile.name === "Hydra") {
      const darkDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(hydraDarkCenter), -1, 1));
      const darkPatch = 1 - smoothstep(0.22, 0.50, darkDistance);
      colour.lerp(accent, darkPatch * 0.32);
    }

    colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.10, 0, 0.10));
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createPlutonianMoonSurface(profile, quality = "high") {
  const geometry = createGeometry(profile, quality);
  const surfaceMaps = getPlutonianSurfaceMaps(profile.name);
  const isCharon = profile.name === "Charon";
  const material = new THREE.MeshStandardMaterial(surfaceMaps
    ? {
      // Albedo preserves the supplied reference's regional colour identity;
      // shape and lighting remain true 3D rather than baked into the image.
      map: surfaceMaps.albedoMap,
      color: isCharon ? 0xffffff : 0xd7d4cf,
      vertexColors: false,
      // Displacement reveals major crater rims at the silhouette; bump mapping
      // carries fine regolith without producing a noisy or inflated body.
      displacementMap: surfaceMaps.heightMap,
      displacementScale: isCharon
        ? (quality === "low" ? 0.007 : 0.011)
        : (quality === "low" ? 0.009 : 0.016),
      displacementBias: isCharon
        ? (quality === "low" ? -0.0035 : -0.0055)
        : (quality === "low" ? -0.0045 : -0.008),
      bumpMap: surfaceMaps.heightMap,
      bumpScale: isCharon ? 0.020 : 0.032,
      roughnessMap: surfaceMaps.roughnessMap,
      roughness: isCharon ? 0.94 : 0.975,
      metalness: 0,
      envMapIntensity: isCharon ? 0.035 : 0.022,
      dithering: true,
    }
    : {
      vertexColors: true,
      roughness: 0.985,
      metalness: 0,
      envMapIntensity: 0.020,
      dithering: true,
    });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${profile.name} reference-derived watertight ice surface`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.plutonianSurfaceModel = surfaceMaps?.roughnessMap
    ? "reference-mapped-albedo-relief-roughness-3d"
    : "reference-mapped-albedo-relief-watertight-3d";
  return mesh;
}

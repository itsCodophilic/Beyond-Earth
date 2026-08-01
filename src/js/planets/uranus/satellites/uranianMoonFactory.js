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


/**
 * Reference-mapped major moons use carefully prepared surface evidence.
 *
 * Their supplied disk images are never placed directly on a sphere. Doing so
 * would also wrap the black picture background and collapse the photographed
 * limb into a pinched UV seam. Each reference is first converted into a global
 * albedo plus matching height/roughness maps with continuous longitude edges
 * and pole-safe rows. For Umbriel, only local terrain detail and palette
 * evidence are extracted from its single disk; baked limb lighting is removed
 * before that evidence is synthesized into one seamless cratered globe.
 */
const URANIAN_SURFACE_ASSETS = Object.freeze({
  Miranda: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/major-moons/miranda-albedo-v1.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/major-moons/miranda-height-v1.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/major-moons/miranda-roughness-v1.jpg",
      import.meta.url,
    ).href,
  }),
  Ariel: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/major-moons/ariel-albedo.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/major-moons/ariel-height.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/major-moons/ariel-roughness.jpg",
      import.meta.url,
    ).href,
  }),
  Umbriel: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/major-moons/umbriel-albedo-v4.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/major-moons/umbriel-height-v4.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/major-moons/umbriel-roughness-v4.jpg",
      import.meta.url,
    ).href,
  }),
  Titania: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/major-moons/titania-albedo-v2.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/major-moons/titania-height-v2.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/major-moons/titania-roughness-v2.jpg",
      import.meta.url,
    ).href,
  }),
  Oberon: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/major-moons/oberon-albedo-v1.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/major-moons/oberon-height-v1.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/major-moons/oberon-roughness-v1.jpg",
      import.meta.url,
    ).href,
  }),
  Cordelia: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/inner-moons/cordelia-albedo-v1.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/inner-moons/cordelia-height-v1.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/inner-moons/cordelia-roughness-v1.jpg",
      import.meta.url,
    ).href,
  }),
  Ophelia: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/uranian/inner-moons/ophelia-albedo-v1.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/uranian/inner-moons/ophelia-height-v1.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/uranian/inner-moons/ophelia-roughness-v1.jpg",
      import.meta.url,
    ).href,
  }),
});

const uranianTextureLoader = new THREE.TextureLoader();
const uranianTextureCache = new Map();

function loadUranianTexture(bodyName, url, { color = false } = {}) {
  if (uranianTextureCache.has(url)) return uranianTextureCache.get(url);

  const texture = uranianTextureLoader.load(url);
  texture.name = `${bodyName} ${color ? "reference albedo" : "surface data"} map`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.userData.persistentUranianTexture = true;
  uranianTextureCache.set(url, texture);
  return texture;
}

function getUranianSurfaceMaps(bodyName) {
  const assets = URANIAN_SURFACE_ASSETS[bodyName];
  if (!assets) return null;
  return {
    albedoMap: loadUranianTexture(bodyName, assets.albedo, { color: true }),
    heightMap: loadUranianTexture(bodyName, assets.height),
    roughnessMap: loadUranianTexture(bodyName, assets.roughness),
  };
}

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

function arielGeometrySegments(quality) {
  if (quality === "low") return [72, 46];
  if (quality === "medium") return [128, 80];
  return [192, 120];
}

function mirandaGeometrySegments(quality) {
  if (quality === "low") return [88, 56];
  if (quality === "medium") return [152, 96];
  return [224, 144];
}

function umbrielGeometrySegments(quality) {
  if (quality === "low") return [84, 52];
  if (quality === "medium") return [144, 90];
  return [208, 132];
}

function titaniaGeometrySegments(quality) {
  if (quality === "low") return [84, 52];
  if (quality === "medium") return [144, 90];
  return [208, 132];
}

function oberonGeometrySegments(quality) {
  if (quality === "low") return [84, 52];
  if (quality === "medium") return [144, 90];
  return [208, 132];
}

function shepherdGeometrySegments(quality) {
  if (quality === "low") return [72, 46];
  if (quality === "medium") return [120, 76];
  return [176, 112];
}

function createArielReferenceSurface(profile, quality) {
  const maps = getUranianSurfaceMaps("Ariel");
  const [widthSegments, heightSegments] = arielGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  // Ariel is nearly spherical, but a perfectly mathematical sphere reads as a
  // flat texture. Millimetric-looking macro relief gives the silhouette and
  // terminator a natural icy-body irregularity without turning it into an
  // asteroid or exaggerating the moon's geology.
  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 1.75, 4, profile.seed + 21.4);
    const medium = fbm(direction, 5.8, 3, profile.seed + 54.2);
    const radius = 1 + broad * 0.0036 + medium * 0.0013;
    positions.setXYZ(
      index,
      direction.x * radius,
      direction.y * radius,
      direction.z * radius,
    );
  }
  positions.needsUpdate = true;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const displacementScale = quality === "low" ? 0.006 : quality === "medium" ? 0.010 : 0.014;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.034 : quality === "medium" ? 0.046 : 0.058,
    displacementMap: maps?.heightMap ?? null,
    displacementScale,
    displacementBias: -displacementScale * 0.48,
    roughness: 0.96,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.018,
    dithering: true,
  });
  material.name = "Ariel user-reference mapped icy surface";

  const moon = new THREE.Mesh(geometry, material);
  moon.name = "Ariel reference-derived 3D surface";
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceDetailMode = "reference-derived-global-albedo-and-relief";
  moon.userData.referenceTextureSource = "User-supplied Ariel image";
  moon.userData.surfaceTextureCoverage =
    "Supplied hemisphere reprojected directly; unseen hemisphere reconstructed seamlessly from the same terrain evidence.";
  moon.userData.reconstructionTextureSource =
    "User-supplied Ariel image converted into albedo, height, and roughness maps.";
  return moon;
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

/**
 * Builds Miranda as one continuous, high-resolution tectonic moon.
 *
 * The texture carries the supplied reference's coronae, parallel ridges,
 * fault blocks, scarps, and older cratered plains across a sphere-safe 2:1
 * map. Matching relief lets those formations react to the real scene light
 * instead of behaving like a photograph painted onto a smooth ball.
 */
function createMirandaReferenceSurface(profile, quality) {
  const maps = getUranianSurfaceMaps("Miranda");
  const [widthSegments, heightSegments] = mirandaGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const shape = profile.shape ?? [1, 1, 1];

  // Miranda is globally round but its tectonic blocks create a subtly battered
  // silhouette. Keep this deformation restrained; the map-derived relief does
  // the close-up work without turning the moon into a low-gravity asteroid.
  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 1.65, 4, profile.seed + 12.7);
    const block = fbm(direction, 5.6, 3, profile.seed + 48.9);
    const radius = 1 + broad * 0.0042 + block * 0.0018;
    positions.setXYZ(
      index,
      direction.x * radius * shape[0],
      direction.y * radius * shape[1],
      direction.z * radius * shape[2],
    );
  }

  positions.needsUpdate = true;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const displacementScale = quality === "low" ? 0.006 : quality === "medium" ? 0.010 : 0.014;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.032 : quality === "medium" ? 0.044 : 0.056,
    displacementMap: maps?.heightMap ?? null,
    displacementScale,
    displacementBias: -displacementScale * 0.5,
    roughness: 0.95,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.012,
    dithering: true,
  });
  material.name = "Miranda seamless tectonic ice-rock material";

  const moon = new THREE.Mesh(geometry, material);
  moon.name = "Miranda continuous realistic 3D surface";
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceDetailMode =
    "single-seamless-reference-guided-coronae-scarps-and-impact-terrain";
  moon.userData.referenceTextureSource =
    "User-supplied Miranda image used as geological and color evidence";
  moon.userData.surfaceTextureCoverage =
    "Complete 360-degree terrain with blended longitude, pole-safe rows, and no circular photograph projection.";
  moon.userData.reconstructionTextureSource =
    "Reference-guided seamless albedo with matched multi-scale height and roughness maps.";
  return moon;
}

/**
 * Builds one continuous Umbriel globe from the supplied surface evidence.
 *
 * Large-scale disk lighting is removed before texture generation. Only the
 * reference's local crater/groove detail and neutral-grey palette are carried
 * into seamless global material maps. That means there is no photographic cap
 * to slide over the sphere, no hidden second surface, and no radial UV smear.
 */
function createUmbrielReferenceSurface(profile, quality) {
  const maps = getUranianSurfaceMaps("Umbriel");
  const [widthSegments, heightSegments] = umbrielGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  // Umbriel is a round differentiated moon rather than a rubble-pile rock.
  // Only restrained broad undulation is applied to the silhouette; crater
  // bowls and rims come from the matching displacement and bump maps below.
  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 1.8, 4, profile.seed + 17.2);
    const medium = fbm(direction, 6.7, 3, profile.seed + 58.6);
    const radius = 1 + broad * 0.0028 + medium * 0.0012;
    positions.setXYZ(
      index,
      direction.x * radius,
      direction.y * radius,
      direction.z * radius,
    );
  }

  positions.needsUpdate = true;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const displacementScale = quality === "low" ? 0.0045 : quality === "medium" ? 0.0075 : 0.0105;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.030 : quality === "medium" ? 0.045 : 0.060,
    displacementMap: maps?.heightMap ?? null,
    displacementScale,
    displacementBias: -displacementScale * 0.5,
    roughness: 0.975,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.010,
    dithering: true,
  });
  material.name = "Umbriel seamless image-derived crater material";

  const moon = new THREE.Mesh(geometry, material);
  moon.name = "Umbriel continuous realistic 3D surface";
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceDetailMode =
    "single-seamless-image-derived-albedo-relief-and-roughness-surface";
  moon.userData.referenceTextureSource =
    "User-supplied Umbriel image used as local terrain and palette evidence";
  moon.userData.surfaceTextureCoverage =
    "Complete 360-degree terrain with no photographic cap, exposed under-layer, or radial projection stretch.";
  moon.userData.reconstructionTextureSource =
    "Observed local crater detail combined with latitude-aware spherical impact terrain; photographed sky and baked limb shading excluded.";
  return moon;
}

/**
 * Builds Cordelia and Ophelia as complete low-gravity 3D shepherd moons.
 *
 * Voyager resolved their positions and ring-shepherding roles, but not global
 * surface geography. Consequently the geometry below is deliberately
 * conservative: measured scale ordering and plausible irregular silhouettes
 * are combined with non-specific cratered ice-rock regolith. No unrelated
 * moon photograph is projected onto either body.
 */
function createShepherdMoonSurface(profile, quality) {
  const maps = getUranianSurfaceMaps(profile.name);
  const [widthSegments, heightSegments] = shepherdGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const shape = profile.shape ?? [1, 1, 1];
  const isCordelia = profile.name === "Cordelia";

  // Small moons cannot relax into perfect spheres. Broad, low-frequency
  // deformation creates a real potato-like silhouette; fine relief is kept
  // much smaller so it reads as regolith rather than animated noise.
  const craterField = Array.from({ length: isCordelia ? 22 : 18 }, (_, index) => ({
    center: randomDirection(profile.seed + 24.8, index),
    radius: 0.040 + random01(profile.seed, index, 51) * (isCordelia ? 0.145 : 0.125),
    depth: 0.006 + random01(profile.seed, index, 52) * (isCordelia ? 0.018 : 0.014),
    rim: 0.0012 + random01(profile.seed, index, 53) * 0.0034,
  }));

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, isCordelia ? 1.36 : 1.52, 4, profile.seed + 18.2);
    const medium = fbm(direction, 5.4, 4, profile.seed + 61.7);
    const fine = fbm(direction, 19.0, 3, profile.seed + 93.1);
    let height = broad * (isCordelia ? 0.060 : 0.046)
      + medium * (isCordelia ? 0.020 : 0.016)
      + fine * 0.0045;

    craterField.forEach((crater) => {
      height += sampleCrater(direction, crater).height;
    });

    if (isCordelia) {
      // The artistic reference suggests an elongated, subtly bilobed body.
      // A broad waist and unequal end lobes create that volume without opening
      // seams or subtracting holes from the watertight surface.
      const waist = Math.exp(-Math.pow((direction.x + 0.04) / 0.30, 2));
      const positiveLobe = Math.pow(Math.max(0, direction.x), 2.2);
      const negativeLobe = Math.pow(Math.max(0, -direction.x), 2.0);
      height += positiveLobe * 0.040 + negativeLobe * 0.020 - waist * 0.026;
    } else {
      // Ophelia remains a compact asymmetric potato rather than sharing
      // Cordelia's elongated silhouette.
      height += Math.max(0, direction.x * 0.72 + direction.y * 0.30) ** 2 * 0.018;
      height -= Math.max(0, -direction.z * 0.78 + direction.y * 0.18) ** 2 * 0.012;
    }

    const radius = Math.max(0.82, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius * shape[0],
      direction.y * radius * shape[1],
      direction.z * radius * shape[2],
    );
  }

  positions.needsUpdate = true;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const displacementScale = quality === "low" ? 0.006 : quality === "medium" ? 0.010 : 0.014;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.040 : quality === "medium" ? 0.055 : 0.072,
    displacementMap: maps?.heightMap ?? null,
    displacementScale,
    displacementBias: -displacementScale * 0.50,
    roughness: 0.985,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.010,
    dithering: true,
  });
  material.name = `${profile.name} unresolved shepherd moon ice-rock material`;

  const moon = new THREE.Mesh(geometry, material);
  moon.name = `${profile.name} continuous realistic 3D shepherd surface`;
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceDetailMode =
    "scientifically-conservative-unresolved-3d-shepherd-moon-reconstruction";
  moon.userData.referenceTextureSource = isCordelia
    ? "User-supplied small-body image used only as artistic shape and regolith guidance"
    : "No unrelated photograph used; supplied Io image deliberately excluded";
  moon.userData.surfaceTextureCoverage =
    "Complete seamless 360-degree low-albedo regolith with pole-safe texture rows.";
  moon.userData.reconstructionTextureSource =
    "Non-specific cratered ice-rock material, separate albedo/height/roughness maps, and watertight procedural macro geometry.";
  return moon;
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

/**
 * Builds Titania as a physically continuous icy-rock sphere.
 *
 * The colour comes from the two user-supplied Titania references, reconstructed
 * into a seamless global texture. Large terrain is also sculpted into the mesh:
 * crater bowls move vertices inward, rims move them outward, and long fault
 * valleys cross the surface. The bitmap displacement is intentionally subtle
 * so it adds fine relief without inflating bright markings into mountains.
 */
function createTitaniaReferenceSurface(profile, quality) {
  const maps = getUranianSurfaceMaps("Titania");
  const [widthSegments, heightSegments] = titaniaGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  const craterField = Array.from({ length: 38 }, (_, index) => ({
    center: randomDirection(profile.seed + 18.7, index),
    radius: 0.040 + random01(profile.seed, index, 31) * 0.145,
    depth: 0.0035 + random01(profile.seed, index, 32) * 0.0090,
    rim: 0.0010 + random01(profile.seed, index, 33) * 0.0028,
  }));
  const fractureField = makeFractures(profile, 17);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 1.65, 4, profile.seed + 14.2);
    const medium = fbm(direction, 6.2, 4, profile.seed + 47.9);
    const fine = fbm(direction, 21.0, 3, profile.seed + 83.4);
    let height = broad * 0.0028 + medium * 0.0012 + fine * 0.00055;

    craterField.forEach((crater) => {
      height += sampleCrater(direction, crater).height;
    });

    // Titania is crossed by broad fault systems and graben. A small physical
    // depression lets these valleys catch the real Uranus-system sunlight.
    const faultValley = fractureMask(direction, fractureField, profile.seed);
    height -= faultValley * 0.0034;

    const radius = Math.max(0.965, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius,
      direction.y * radius,
      direction.z * radius,
    );
  }

  positions.needsUpdate = true;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const displacementScale = quality === "low"
    ? 0.0025
    : quality === "medium"
      ? 0.0042
      : 0.0060;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.018 : quality === "medium" ? 0.025 : 0.032,
    displacementMap: maps?.heightMap ?? null,
    displacementScale,
    displacementBias: -displacementScale * 0.50,
    roughness: 0.94,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.016,
    dithering: true,
  });
  material.name = "Titania two-reference seamless icy-rock surface";

  const moon = new THREE.Mesh(geometry, material);
  moon.name = "Titania reference-derived continuous 3D surface";
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceDetailMode =
    "two-reference-global-albedo-plus-physical-craters-and-fault-valleys";
  moon.userData.referenceTextureSource =
    "Two user-supplied Titania images reconstructed as a seamless global map";
  moon.userData.surfaceTextureCoverage =
    "Continuous 360-degree longitude coverage with blended seam and pole-safe texture rows.";
  moon.userData.reconstructionTextureSource =
    "User references converted into albedo, height, and roughness maps; no black disk background is used.";
  return moon;
}

/**
 * Builds Oberon as an old, impact-dominated ice-rock moon.
 *
 * The two supplied disk views determine its darker grey-mauve colour, bright
 * icy ejecta, and dark crater-floor markings. They are reconstructed into one
 * complete global map before use, so their black backgrounds never reach the
 * sphere. Physical geometry supplies overlapping crater bowls and rims,
 * subdued ancient faults, and a small mountain that can break the limb.
 */
function createOberonReferenceSurface(profile, quality) {
  const maps = getUranianSurfaceMaps("Oberon");
  const [widthSegments, heightSegments] = oberonGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  // Oberon's ancient surface has a denser and slightly deeper impact field
  // than Titania. The range includes many softened small craters and a handful
  // of broad basins without turning its nearly spherical silhouette to rubble.
  const craterField = Array.from({ length: 54 }, (_, index) => ({
    center: randomDirection(profile.seed + 31.6, index),
    radius: 0.030 + random01(profile.seed, index, 41) * 0.155,
    depth: 0.0032 + random01(profile.seed, index, 42) * 0.0105,
    rim: 0.0010 + random01(profile.seed, index, 43) * 0.0032,
  }));
  const fractureField = makeFractures(profile, 7);
  const limbMountainDirection = new THREE.Vector3(-0.81, -0.34, 0.48).normalize();

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 1.55, 4, profile.seed + 12.4);
    const medium = fbm(direction, 6.8, 4, profile.seed + 52.7);
    const fine = fbm(direction, 23.0, 3, profile.seed + 91.8);
    let height = broad * 0.0032 + medium * 0.00145 + fine * 0.00068;

    craterField.forEach((crater) => {
      height += sampleCrater(direction, crater).height;
    });

    // Oberon shows little recent internal activity, so faults remain subdued
    // beneath the dominant impact terrain.
    height -= fractureMask(direction, fractureField, profile.seed + 6.3) * 0.0018;

    // NASA notes a prominent mountain on Oberon's limb. A localised, restrained
    // rise gives the silhouette that identity without exaggerating the body.
    const mountainAngle = Math.acos(
      THREE.MathUtils.clamp(direction.dot(limbMountainDirection), -1, 1),
    );
    height += 0.0065 * Math.exp(-Math.pow(mountainAngle / 0.085, 2));

    const radius = Math.max(0.960, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius,
      direction.y * radius,
      direction.z * radius,
    );
  }

  positions.needsUpdate = true;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const displacementScale = quality === "low"
    ? 0.0028
    : quality === "medium"
      ? 0.0046
      : 0.0065;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.019 : quality === "medium" ? 0.027 : 0.035,
    displacementMap: maps?.heightMap ?? null,
    displacementScale,
    displacementBias: -displacementScale * 0.50,
    roughness: 0.97,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.014,
    dithering: true,
  });
  material.name = "Oberon two-reference seamless ancient icy-rock surface";

  const moon = new THREE.Mesh(geometry, material);
  moon.name = "Oberon reference-derived continuous 3D surface";
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceDetailMode =
    "two-reference-global-albedo-plus-dense-physical-impact-terrain";
  moon.userData.referenceTextureSource =
    "Two user-supplied Oberon images reconstructed as a seamless global map";
  moon.userData.surfaceTextureCoverage =
    "Continuous 360-degree longitude coverage with blended seam and pole-safe texture rows.";
  moon.userData.reconstructionTextureSource =
    "User references converted into albedo, height, and roughness maps; no black disk background is used.";
  return moon;
}

export function createUranianMoonSurface(profile, quality = "high") {
  if (profile.name === "Miranda") return createMirandaReferenceSurface(profile, quality);
  if (profile.name === "Ariel") return createArielReferenceSurface(profile, quality);
  if (profile.name === "Umbriel") return createUmbrielReferenceSurface(profile, quality);
  if (profile.name === "Titania") return createTitaniaReferenceSurface(profile, quality);
  if (profile.name === "Oberon") return createOberonReferenceSurface(profile, quality);
  if (["Cordelia", "Ophelia"].includes(profile.name)) {
    return createShepherdMoonSurface(profile, quality);
  }
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

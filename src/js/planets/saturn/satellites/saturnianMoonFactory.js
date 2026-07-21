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

/**
 * Titan, Iapetus, and Mimas are treated as hero moons. Their mapped surfaces
 * follow the same resolved-body path used for Jupiter's Galilean moons, while
 * geometry-level relief preserves each moon's defining structure.
 */
const SATURNIAN_SURFACE_ASSETS = Object.freeze({
  Titan: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/titan-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/titan-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/titan-roughness.jpg", import.meta.url).href,
  }),
  Iapetus: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/iapetus-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/iapetus-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/iapetus-roughness.jpg", import.meta.url).href,
  }),
  Mimas: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/mimas-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/mimas-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/mimas-roughness.jpg", import.meta.url).href,
  }),
  Enceladus: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/enceladus-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/enceladus-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/enceladus-roughness.jpg", import.meta.url).href,
  }),
  Tethys: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/tethys-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/tethys-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/tethys-roughness.jpg", import.meta.url).href,
  }),
  Dione: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/dione-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/dione-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/dione-roughness.jpg", import.meta.url).href,
  }),
  Rhea: Object.freeze({
    albedo: new URL("../../../../assets/textures/saturnian/rhea-albedo.jpg", import.meta.url).href,
    height: new URL("../../../../assets/textures/saturnian/rhea-height.jpg", import.meta.url).href,
    roughness: new URL("../../../../assets/textures/saturnian/rhea-roughness.jpg", import.meta.url).href,
  }),
});

const saturnianTextureLoader = new THREE.TextureLoader();
const saturnianTextureCache = new Map();

function loadSaturnianTexture(bodyName, url, { color = false } = {}) {
  if (saturnianTextureCache.has(url)) return saturnianTextureCache.get(url);

  const texture = saturnianTextureLoader.load(url);
  texture.name = `${bodyName} ${color ? "albedo" : "data"} map`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.userData.persistentSaturnianTexture = true;
  saturnianTextureCache.set(url, texture);
  return texture;
}

function getSaturnianSurfaceMaps(bodyName) {
  const assets = SATURNIAN_SURFACE_ASSETS[bodyName];
  if (!assets) return null;
  return {
    albedoMap: loadSaturnianTexture(bodyName, assets.albedo, { color: true }),
    heightMap: loadSaturnianTexture(bodyName, assets.height),
    roughnessMap: loadSaturnianTexture(bodyName, assets.roughness),
  };
}

function getTitanSurfaceMaps() {
  return getSaturnianSurfaceMaps("Titan");
}

function titanGeometrySegments(quality) {
  if (quality === "low") return [64, 40];
  if (quality === "medium") return [96, 56];
  return [144, 88];
}

function createTitanHazeMaterial({
  faceOpacity,
  rimOpacity,
  rimPower,
  additive = false,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWarmHaze: { value: new THREE.Color(0xd88b3f) },
      uUpperHaze: { value: new THREE.Color(0xffdf9f) },
      uNightHaze: { value: new THREE.Color(0x7c688e) },
      uFaceOpacity: { value: faceOpacity },
      uRimOpacity: { value: rimOpacity },
      uRimPower: { value: rimPower },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uWarmHaze;
      uniform vec3 uUpperHaze;
      uniform vec3 uNightHaze;
      uniform float uFaceOpacity;
      uniform float uRimOpacity;
      uniform float uRimPower;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sunDirection = normalize(-vWorldPosition);

        float viewFacing = clamp(dot(normal, viewDirection), 0.0, 1.0);
        float rim = pow(1.0 - viewFacing, uRimPower);
        float solarFacing = dot(normal, sunDirection);
        float daylight = smoothstep(-0.34, 0.24, solarFacing);
        float directLight = smoothstep(0.04, 0.92, solarFacing);

        vec3 colour = mix(uNightHaze, uWarmHaze, daylight);
        colour = mix(colour, uUpperHaze, directLight * 0.38);

        float alpha = uFaceOpacity * (0.50 + daylight * 0.50);
        alpha += rim * uRimOpacity * (0.62 + daylight * 0.38);
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}

function createTitanCloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCloudCream: { value: new THREE.Color(0xffe3b0) },
      uCloudAmber: { value: new THREE.Color(0xd68e47) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vLocalNormal = normalize(normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCloudCream;
      uniform vec3 uCloudAmber;

      varying vec2 vUv;
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash31(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float noise3(vec3 p) {
        vec3 cell = floor(p);
        vec3 fraction = fract(p);
        fraction = fraction * fraction * (3.0 - 2.0 * fraction);

        float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, fraction.x);
        float nx10 = mix(n010, n110, fraction.x);
        float nx01 = mix(n001, n101, fraction.x);
        float nx11 = mix(n011, n111, fraction.x);
        return mix(mix(nx00, nx10, fraction.y), mix(nx01, nx11, fraction.y), fraction.z);
      }

      float fbm3(vec3 p) {
        float value = 0.0;
        float amplitude = 0.56;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise3(p) * amplitude;
          p = p * 2.03 + vec3(7.1, 3.7, 5.9);
          amplitude *= 0.48;
        }
        return value;
      }

      void main() {
        float angle = uTime * 0.005;
        float cosine = cos(angle);
        float sine = sin(angle);
        vec3 sampleDirection = normalize(vLocalNormal);
        sampleDirection.xz = mat2(cosine, -sine, sine, cosine) * sampleDirection.xz;

        float broadCloud = fbm3(sampleDirection * vec3(5.5, 2.1, 5.5));
        float streakCloud = fbm3(sampleDirection * vec3(13.0, 1.25, 13.0) + vec3(4.2, 1.7, 8.4));
        float cloudField = broadCloud * 0.68 + streakCloud * 0.32;
        float cloudMask = smoothstep(0.60, 0.82, cloudField);

        float polarField = fbm3(sampleDirection * 8.0 + vec3(2.4, 5.6, 1.3));
        float polarWindow = smoothstep(0.70, 0.96, abs(sampleDirection.y));
        float polarCloud = polarWindow * smoothstep(0.48, 0.72, polarField);

        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 sunDirection = normalize(-vWorldPosition);
        float viewFacing = clamp(dot(normal, viewDirection), 0.0, 1.0);
        float daylight = smoothstep(-0.25, 0.34, dot(normal, sunDirection));

        float alpha = cloudMask * 0.070 + polarCloud * 0.052;
        alpha *= (0.44 + daylight * 0.56) * (0.38 + viewFacing * 0.62);
        vec3 colour = mix(uCloudAmber, uCloudCream, 0.46 + polarCloud * 0.34);
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
}

function createTitanSurface(profile, quality) {
  const [widthSegments, heightSegments] = titanGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const maps = getTitanSurfaceMaps();
  const useDisplacement = quality !== "low";

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.albedoMap,
    bumpMap: maps.heightMap,
    bumpScale: quality === "low" ? 0.006 : quality === "medium" ? 0.010 : 0.014,
    displacementMap: useDisplacement ? maps.heightMap : null,
    displacementScale: useDisplacement ? 0.0042 : 0,
    displacementBias: useDisplacement ? -0.0021 : 0,
    roughness: 0.86,
    roughnessMap: maps.roughnessMap,
    metalness: 0,
    envMapIntensity: 0.024,
    emissive: new THREE.Color(0x1b0d05),
    emissiveIntensity: 0.018,
    dithering: true,
  });
  material.name = "Titan Cassini-style mapped surface";

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;

  const shellSegments = quality === "low" ? 48 : quality === "medium" ? 64 : 88;
  const shellGeometry = new THREE.SphereGeometry(1, shellSegments, Math.floor(shellSegments * 0.58));

  const cloudMaterial = createTitanCloudMaterial();
  const clouds = new THREE.Mesh(shellGeometry, cloudMaterial);
  clouds.name = "Titan high-altitude methane cloud veil";
  clouds.scale.setScalar(1.0075);
  clouds.renderOrder = 2;
  clouds.onBeforeRender = () => {
    cloudMaterial.uniforms.uTime.value = performance.now() * 0.001;
  };
  moon.add(clouds);

  const lowerHaze = new THREE.Mesh(
    shellGeometry,
    createTitanHazeMaterial({
      faceOpacity: 0.026,
      rimOpacity: 0.18,
      rimPower: 2.15,
    }),
  );
  lowerHaze.name = "Titan lower photochemical haze";
  lowerHaze.scale.setScalar(1.016);
  lowerHaze.renderOrder = 3;
  moon.add(lowerHaze);

  const outerHaze = new THREE.Mesh(
    shellGeometry,
    createTitanHazeMaterial({
      faceOpacity: 0.0025,
      rimOpacity: 0.24,
      rimPower: 3.25,
      additive: true,
    }),
  );
  outerHaze.name = "Titan extended atmospheric limb";
  outerHaze.scale.setScalar(1.052);
  outerHaze.renderOrder = 4;
  moon.add(outerHaze);

  moon.userData.hasCustomAtmosphere = true;
  moon.userData.surfaceEvidence = "Cassini/VIMS-inspired false-colour surface reconstruction";
  moon.userData.surfaceStructure = "Smooth icy-organic terrain beneath dense nitrogen-methane haze";
  moon.userData.surfaceRoughness = 0.86;
  moon.userData.surfaceDetailMode = "mapped-surface-with-layered-atmosphere";
  moon.userData.titanSurfaceState = {
    profile,
    quality,
    maps,
    clouds,
    lowerHaze,
    outerHaze,
  };
  return moon;
}

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


function mappedMoonGeometrySegments(profileName, quality) {
  if (profileName === "Iapetus") {
    if (quality === "low") return [80, 50];
    if (quality === "medium") return [128, 80];
    return [192, 120];
  }

  if (quality === "low") return [72, 46];
  if (quality === "medium") return [120, 76];
  return [176, 110];
}

function smoothstepValue(value, edge0, edge1) {
  const t = THREE.MathUtils.clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function angularWindow(angle, center, halfWidth, softness = 0.18) {
  const distance = Math.abs(wrapAngle(angle - center));
  return 1 - smoothstepValue(distance, halfWidth, halfWidth + softness);
}

function directionFromUv(u, v, target = new THREE.Vector3()) {
  const phi = u * Math.PI * 2;
  const theta = v * Math.PI;
  const sinTheta = Math.sin(theta);
  return target.set(
    -Math.cos(phi) * sinTheta,
    Math.cos(theta),
    Math.sin(phi) * sinTheta,
  ).normalize();
}

function directionFromLatLon(latitudeDeg, longitudeDeg, target = new THREE.Vector3()) {
  const latitude = THREE.MathUtils.degToRad(latitudeDeg);
  const longitude = THREE.MathUtils.degToRad(longitudeDeg);
  const cosLatitude = Math.cos(latitude);
  return target.set(
    cosLatitude * Math.cos(longitude),
    Math.sin(latitude),
    -cosLatitude * Math.sin(longitude),
  ).normalize();
}

function createMappedCraterField(profile, count, {
  minRadius,
  maxRadius,
  minDepth,
  maxDepth,
  seedOffset = 0,
}) {
  return Array.from({ length: count }, (_, index) => {
    const radiusSeed = Math.sin((profile.seed + seedOffset) * 81.7 + index * 19.31) * 0.5 + 0.5;
    const depthSeed = Math.sin((profile.seed + seedOffset) * 43.9 + index * 7.73) * 0.5 + 0.5;
    const radius = THREE.MathUtils.lerp(minRadius, maxRadius, Math.pow(radiusSeed, 1.65));
    const depth = THREE.MathUtils.lerp(minDepth, maxDepth, depthSeed);
    return {
      center: randomDirection(profile.seed + seedOffset + 0.47, index),
      radius,
      depth,
      rim: depth * THREE.MathUtils.lerp(0.20, 0.34, radiusSeed),
    };
  });
}

function createMappedMoonMaterial(bodyName, maps, {
  roughness,
  bumpScale,
}) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps.albedoMap,
    bumpMap: maps.heightMap,
    bumpScale,
    roughness,
    roughnessMap: maps.roughnessMap,
    metalness: 0,
    envMapIntensity: 0.018,
    dithering: true,
  });
  material.name = `${bodyName} NASA/Cassini mapped surface`;
  return material;
}

function smoothSphereUvSeamNormals(geometry) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const normal = geometry.getAttribute("normal");
  if (!position || !uv || !normal) return;

  const seamPairs = new Map();
  const precision = 1000000;
  for (let index = 0; index < position.count; index += 1) {
    const u = uv.getX(index);
    if (u > 1e-4 && u < 1 - 1e-4) continue;

    const key = [
      Math.round(position.getX(index) * precision),
      Math.round(position.getY(index) * precision),
      Math.round(position.getZ(index) * precision),
    ].join(":");

    const pair = seamPairs.get(key) ?? { a: -1, b: -1 };
    if (u < 0.5) {
      pair.a = index;
    } else {
      pair.b = index;
    }
    seamPairs.set(key, pair);
  }

  const averaged = new THREE.Vector3();
  for (const pair of seamPairs.values()) {
    if (pair.a < 0 || pair.b < 0) continue;
    averaged.set(
      normal.getX(pair.a) + normal.getX(pair.b),
      normal.getY(pair.a) + normal.getY(pair.b),
      normal.getZ(pair.a) + normal.getZ(pair.b),
    ).normalize();
    normal.setXYZ(pair.a, averaged.x, averaged.y, averaged.z);
    normal.setXYZ(pair.b, averaged.x, averaged.y, averaged.z);

    const ax = (position.getX(pair.a) + position.getX(pair.b)) * 0.5;
    const ay = (position.getY(pair.a) + position.getY(pair.b)) * 0.5;
    const az = (position.getZ(pair.a) + position.getZ(pair.b)) * 0.5;
    position.setXYZ(pair.a, ax, ay, az);
    position.setXYZ(pair.b, ax, ay, az);
  }

  normal.needsUpdate = true;
  position.needsUpdate = true;
}

function createMimasSurface(profile, quality) {
  const [widthSegments, heightSegments] = mappedMoonGeometrySegments("Mimas", quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const herschelCenter = directionFromUv(0.108, 0.545);
  const craterCount = quality === "low" ? 42 : quality === "medium" ? 72 : 104;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.018,
    maxRadius: 0.122,
    minDepth: 0.0025,
    maxDepth: 0.014,
    seedOffset: 6.2,
  });

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    let height = fbm(direction, 3.0, profile.seed + 4.7) * 0.0032;
    height += fbm(direction, 16.0, profile.seed + 18.3) * 0.00145;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
    });

    const angularDistance = Math.acos(
      THREE.MathUtils.clamp(direction.dot(herschelCenter), -1, 1),
    );
    const normalizedDistance = angularDistance / 0.345;

    if (normalizedDistance < 1.34) {
      const inside = normalizedDistance < 1;
      const bowl = inside
        ? -0.043 * Math.pow(Math.max(0, 1 - normalizedDistance * normalizedDistance), 1.28)
        : 0;
      const rim = 0.026 * Math.exp(-Math.pow((normalizedDistance - 0.97) / 0.105, 2));
      const centralPeak = 0.031 * Math.exp(-Math.pow(normalizedDistance / 0.165, 2));
      const terraceWindow = inside
        ? smoothstepValue(normalizedDistance, 0.36, 0.92)
          * (1 - smoothstepValue(normalizedDistance, 0.92, 1.02))
        : 0;
      const terraces = terraceWindow * Math.sin(normalizedDistance * 54) * 0.00155;
      height += bowl + rim + centralPeak + terraces;
    }

    // NASA notes that shock from the Herschel impact may have produced
    // chasmata on the opposite hemisphere. Keep them restrained so they read
    // as fractures rather than decorative stripes.
    const oppositeStrength = smoothstepValue(-direction.dot(herschelCenter), 0.72, 0.96);
    if (oppositeStrength > 0) {
      const fracturePhase = Math.atan2(direction.z, direction.y) * 9.0 + direction.x * 4.0;
      const fracture = Math.pow(Math.max(0, Math.cos(fracturePhase)), 18);
      height -= fracture * oppositeStrength * 0.00125;
    }

    const radius = Math.max(0.84, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius,
      direction.y * radius,
      direction.z * radius,
    );
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const maps = getSaturnianSurfaceMaps("Mimas");
  const moon = new THREE.Mesh(
    geometry,
    createMappedMoonMaterial("Mimas", maps, {
      roughness: 0.94,
      bumpScale: quality === "low" ? 0.010 : quality === "medium" ? 0.016 : 0.021,
    }),
  );
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = "NASA Cassini global map PIA17214";
  moon.userData.surfaceStructure = "Heavily cratered water-ice crust with the 130 km Herschel basin, high walls, and a central peak";
  moon.userData.surfaceRoughness = 0.94;
  moon.userData.surfaceDetailMode = "nasa-map-with-geometry-level-herschel-relief";
  moon.userData.mimasSurfaceState = {
    profile,
    quality,
    maps,
    herschelCenter: herschelCenter.clone(),
  };
  return moon;
}

function addComplexCraterHeight(direction, center, {
  radius,
  depth,
  rim,
  peak = 0,
}) {
  const angularDistance = Math.acos(
    THREE.MathUtils.clamp(direction.dot(center), -1, 1),
  );
  const normalizedDistance = angularDistance / radius;
  if (normalizedDistance > 1.34) return 0;

  const inside = normalizedDistance < 1;
  const bowl = inside
    ? -depth * Math.pow(Math.max(0, 1 - normalizedDistance * normalizedDistance), 1.32)
    : 0;
  const raisedRim = rim * Math.exp(-Math.pow((normalizedDistance - 0.98) / 0.12, 2));
  const centralPeak = peak * Math.exp(-Math.pow(normalizedDistance / 0.17, 2));
  return bowl + raisedRim + centralPeak;
}

function createIapetusSurface(profile, quality) {
  const [widthSegments, heightSegments] = mappedMoonGeometrySegments("Iapetus", quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const craterCount = quality === "low" ? 32 : quality === "medium" ? 54 : 78;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.022,
    maxRadius: 0.145,
    minDepth: 0.0028,
    maxDepth: 0.017,
    seedOffset: 11.8,
  });

  const turgis = directionFromLatLon(17, -28);
  const engelier = directionFromLatLon(-41, 95);
  const gerin = directionFromLatLon(-46, 127);
  const ridgeScale = quality === "low" ? 0.014 : quality === "medium" ? 0.016 : 0.018;

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    let height = fbm(direction, 2.4, profile.seed + 3.1) * 0.0044;
    height += fbm(direction, 13.0, profile.seed + 15.7) * 0.0018;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
    });

    height += addComplexCraterHeight(direction, turgis, {
      radius: 0.40,
      depth: 0.030,
      rim: 0.010,
      peak: 0.004,
    });
    height += addComplexCraterHeight(direction, engelier, {
      radius: 0.35,
      depth: 0.027,
      rim: 0.009,
      peak: 0.003,
    });
    height += addComplexCraterHeight(direction, gerin, {
      radius: 0.30,
      depth: 0.022,
      rim: 0.007,
    });

    const latitude = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    const longitude = Math.atan2(-direction.z, direction.x);
    const arcDistance = Math.abs(wrapAngle(longitude));
    const ridgeCoverage = 1 - smoothstepValue(arcDistance, 1.65, 2.28);
    const segmentSignal = Math.sin(longitude * 5.0 + 0.7)
      + Math.sin(longitude * 11.0 - 0.4) * 0.42;
    const brokenMountainChain = 0.64 + 0.36 * smoothstepValue(segmentSignal, -0.65, 0.65);
    const ridge = Math.exp(-Math.pow(latitude / 0.032, 2))
      * ridgeCoverage
      * brokenMountainChain;
    height += ridge * ridgeScale;

    const radius = Math.max(0.82, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius * 1.012,
      direction.y * radius * 0.968,
      direction.z * radius * 1.012,
    );
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const maps = getSaturnianSurfaceMaps("Iapetus");
  const moon = new THREE.Mesh(
    geometry,
    createMappedMoonMaterial("Iapetus", maps, {
      roughness: 0.91,
      bumpScale: quality === "low" ? 0.010 : quality === "medium" ? 0.016 : 0.020,
    }),
  );
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = "NASA Cassini global hemispheres PIA11690";
  moon.userData.surfaceStructure = "Coal-dark Cassini Regio, bright icy trailing terrain, large impact basins, and a broken equatorial mountain ridge";
  moon.userData.surfaceRoughness = 0.91;
  moon.userData.surfaceDetailMode = "cassini-dichotomy-map-with-equatorial-ridge-relief";
  moon.userData.iapetusSurfaceState = {
    profile,
    quality,
    maps,
    ridgeScale,
  };
  return moon;
}


function createEnceladusScatterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIceScatter: { value: new THREE.Color(0x9fe8ff) },
      uRingLight: { value: new THREE.Color(0xeaf8ff) },
    },
    vertexShader: `
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vLocalNormal = normalize(normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uIceScatter;
      uniform vec3 uRingLight;
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normalize(vWorldNormal), viewDirection), 0.0, 1.0);
        float rim = pow(1.0 - facing, 3.6);
        float south = smoothstep(0.40, 0.98, -vLocalNormal.y);
        float nearSurface = smoothstep(0.0, 0.85, facing);
        float polarHaze = south * nearSurface * (0.004 + rim * 0.075);
        vec3 colour = mix(uIceScatter, uRingLight, rim * 0.55);
        gl_FragColor = vec4(colour, polarHaze);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createEnceladusTigerStripeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uGlowColour: { value: new THREE.Color(0xcff8ff) },
      uCoreColour: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vLocalNormal = normalize(normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uGlowColour;
      uniform vec3 uCoreColour;
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vLocalNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normalize(vWorldNormal), viewDirection), 0.0, 1.0);
        float south = smoothstep(0.46, 0.995, -normal.y);
        if (south <= 0.0) discard;

        float denominator = max(0.28, -normal.y);
        float tangentX = normal.x / denominator;
        float tangentZ = normal.z / denominator;
        float lengthWindow = 1.0 - smoothstep(0.84, 1.56, abs(tangentZ));

        float stripe = 0.0;
        float offsets[4];
        offsets[0] = -0.24;
        offsets[1] = -0.08;
        offsets[2] = 0.08;
        offsets[3] = 0.24;
        for (int stripeIndex = 0; stripeIndex < 4; stripeIndex += 1) {
          float center = offsets[stripeIndex]
            + sin(tangentZ * 3.6 + float(stripeIndex) * 1.43) * 0.044
            + sin(tangentZ * 8.1 - float(stripeIndex) * 0.71) * 0.014;
          float distance = abs(tangentX - center);
          stripe = max(stripe, exp(-pow(distance / 0.035, 2.0)));
        }

        float rim = pow(1.0 - facing, 2.8);
        float glow = south * lengthWindow * stripe;
        float alpha = glow * (0.06 + 0.16 * rim + 0.05 * facing);
        vec3 colour = mix(uGlowColour, uCoreColour, 0.45 + stripe * 0.35);
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createEnceladusPlumeSystem(quality) {
  const particleCount = quality === "low" ? 84 : quality === "medium" ? 148 : 236;
  const jetCount = quality === "low" ? 5 : 7;
  const positions = new Float32Array(particleCount * 3);
  const opacities = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const phases = new Float32Array(particleCount);
  const jetIndices = new Uint8Array(particleCount);
  const driftSeeds = new Float32Array(particleCount);
  const sourceX = new Float32Array(jetCount);
  const sourceZ = new Float32Array(jetCount);
  const jetAngles = new Float32Array(jetCount);

  for (let jet = 0; jet < jetCount; jet += 1) {
    const centered = jet - (jetCount - 1) * 0.5;
    sourceX[jet] = centered * 0.038;
    sourceZ[jet] = Math.sin(jet * 2.37) * 0.055;
    jetAngles[jet] = -0.82 + jet / Math.max(1, jetCount - 1) * 1.64
      + Math.sin(jet * 3.1) * 0.18;
  }

  for (let index = 0; index < particleCount; index += 1) {
    const hashA = Math.sin(index * 71.31 + 4.17) * 0.5 + 0.5;
    const hashB = Math.sin(index * 17.73 + 9.83) * 0.5 + 0.5;
    phases[index] = (index / particleCount + hashA * 0.31) % 1;
    jetIndices[index] = index % jetCount;
    driftSeeds[index] = hashB * Math.PI * 2;
    opacities[index] = 0;
    sizes[index] = 0.04;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColour: { value: new THREE.Color(0xd9f7ff) },
      uCoreColour: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: `
      attribute float aOpacity;
      attribute float aSize;
      varying float vOpacity;
      varying float vCore;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vOpacity = aOpacity;
        vCore = clamp(aSize * 12.0, 0.0, 1.0);
        gl_PointSize = clamp(aSize * (320.0 / max(0.45, -mvPosition.z)), 1.0, 34.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColour;
      uniform vec3 uCoreColour;
      varying float vOpacity;
      varying float vCore;

      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float radius = dot(point, point);
        if (radius > 1.0) discard;
        float halo = pow(1.0 - radius, 1.8);
        float core = pow(1.0 - radius, 5.0);
        vec3 colour = mix(uColour, uCoreColour, core * (0.35 + vCore * 0.45));
        gl_FragColor = vec4(colour, halo * vOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const plume = new THREE.Points(geometry, material);
  plume.name = "Enceladus south-polar water-ice plume";
  plume.frustumCulled = false;
  plume.renderOrder = 6;

  plume.onBeforeRender = () => {
    const time = performance.now() * 0.00016;
    for (let index = 0; index < particleCount; index += 1) {
      const jet = jetIndices[index];
      const speed = 0.78 + (index % 11) * 0.021;
      const t = (phases[index] + time * speed) % 1;
      const fadeIn = smoothstepValue(t, 0.01, 0.16);
      const fadeOut = 1 - smoothstepValue(t, 0.70, 1.0);
      const fade = fadeIn * fadeOut;
      const length = 0.008 + Math.pow(t, 0.90) * 1.68;
      const fan = 0.004 + t * t * (0.21 + (jet % 3) * 0.040);
      const angle = jetAngles[jet]
        + Math.sin(t * 8.0 + driftSeeds[index]) * (0.06 + t * 0.10);
      const sideNoise = Math.sin(t * 18.0 + driftSeeds[index] * 1.7) * t * 0.020;
      const stemPull = (1.0 - smoothstepValue(t, 0.0, 0.22)) * 0.010;

      positions[index * 3] = sourceX[jet] + Math.cos(angle) * fan + sideNoise;
      positions[index * 3 + 1] = -0.996 - length + stemPull;
      positions[index * 3 + 2] = sourceZ[jet] + Math.sin(angle) * fan
        + Math.cos(t * 14.0 + driftSeeds[index]) * t * 0.015;
      opacities[index] = fade * (0.18 + (index % 7) * 0.032);
      sizes[index] = (0.028 + (1 - t) * 0.040) * (0.80 + (index % 5) * 0.08);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aOpacity.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  };

  plume.userData.plumeState = {
    particleCount,
    jetCount,
    phases,
    jetIndices,
  };
  return plume;
}

function createEnceladusSurface(profile, quality) {
  const [widthSegments, heightSegments] = mappedMoonGeometrySegments("Enceladus", quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const craterCount = quality === "low" ? 12 : quality === "medium" ? 20 : 30;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.016,
    maxRadius: 0.075,
    minDepth: 0.0012,
    maxDepth: 0.0055,
    seedOffset: 22.4,
  });
  const stripeOffsets = [-0.24, -0.08, 0.08, 0.24];

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    let height = fbm(direction, 2.8, profile.seed + 6.2) * 0.0021;
    height += fbm(direction, 18.0, profile.seed + 19.5) * 0.00085;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
    });

    const south = smoothstepValue(-direction.y, 0.42, 0.98);
    if (south > 0) {
      const denominator = Math.max(0.28, -direction.y);
      const tangentX = direction.x / denominator;
      const tangentZ = direction.z / denominator;
      const lengthWindow = 1 - smoothstepValue(Math.abs(tangentZ), 0.82, 1.52);
      stripeOffsets.forEach((offset, stripeIndex) => {
        const center = offset
          + Math.sin(tangentZ * 3.6 + stripeIndex * 1.43) * 0.044
          + Math.sin(tangentZ * 8.1 - stripeIndex * 0.71) * 0.014;
        const distance = Math.abs(tangentX - center);
        const trench = Math.exp(-Math.pow(distance / 0.024, 2));
        const lips = Math.exp(-Math.pow((distance - 0.038) / 0.013, 2));
        height += south * lengthWindow * (-0.0072 * trench + 0.0030 * lips);
      });
    }

    const tectonicPhase = Math.atan2(direction.z, direction.x) * 8.0
      + direction.y * 12.0
      + Math.sin(direction.x * 8.0) * 0.7;
    const tectonicGroove = Math.pow(Math.max(0, Math.cos(tectonicPhase)), 24);
    const tectonicWindow = smoothstepValue(1 - Math.abs(direction.y), 0.15, 0.88);
    height -= tectonicGroove * tectonicWindow * 0.00115;

    const radius = Math.max(0.90, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const maps = getSaturnianSurfaceMaps("Enceladus");
  const moon = new THREE.Mesh(
    geometry,
    createMappedMoonMaterial("Enceladus", maps, {
      roughness: 0.76,
      bumpScale: quality === "low" ? 0.007 : quality === "medium" ? 0.011 : 0.015,
    }),
  );
  moon.material.envMapIntensity = 0.055;
  moon.castShadow = false;
  moon.receiveShadow = false;

  const shellSegments = quality === "low" ? 46 : quality === "medium" ? 64 : 82;
  const scatterShell = new THREE.Mesh(
    new THREE.SphereGeometry(1, shellSegments, Math.floor(shellSegments * 0.62)),
    createEnceladusScatterMaterial(),
  );
  scatterShell.name = "Enceladus reflected south-polar ice haze";
  scatterShell.scale.setScalar(1.008);
  scatterShell.renderOrder = 5;
  moon.add(scatterShell);

  const stripeGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1, shellSegments, Math.floor(shellSegments * 0.62)),
    createEnceladusTigerStripeGlowMaterial(),
  );
  stripeGlow.name = "Enceladus south-polar tiger-stripe surface glow";
  stripeGlow.scale.setScalar(1.004);
  stripeGlow.renderOrder = 6;
  moon.add(stripeGlow);

  const plume = createEnceladusPlumeSystem(quality);
  plume.renderOrder = 7;
  moon.add(plume);

  moon.userData.surfaceEvidence = "NASA Cassini global map PIA14937 and south-polar plume observations";
  moon.userData.surfaceStructure = "Exceptionally reflective water-ice crust, sparse craters, tectonic grooves, four south-polar tiger stripes, and water-ice jets";
  moon.userData.surfaceRoughness = 0.76;
  moon.userData.surfaceDetailMode = "cassini-map-with-tiger-stripe-relief-and-particle-plumes";
  moon.userData.enceladusSurfaceState = {
    profile,
    quality,
    maps,
    scatterShell,
    stripeGlow,
    plume,
  };
  return moon;
}

function createTethysSurface(profile, quality) {
  const [widthSegments, heightSegments] = mappedMoonGeometrySegments("Tethys", quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const odysseusCenter = directionFromUv(0.29, 0.46);
  const odysseusBasisA = new THREE.Vector3(0, 1, 0).cross(odysseusCenter).normalize();
  const odysseusBasisB = odysseusCenter.clone().cross(odysseusBasisA).normalize();
  const craterCount = quality === "low" ? 46 : quality === "medium" ? 78 : 112;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.018,
    maxRadius: 0.125,
    minDepth: 0.0018,
    maxDepth: 0.0145,
    seedOffset: 31.8,
  });

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    let height = fbm(direction, 2.6, profile.seed + 8.6) * 0.0032;
    height += fbm(direction, 15.0, profile.seed + 23.1) * 0.00125;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
    });

    const odysseusDistance = Math.acos(
      THREE.MathUtils.clamp(direction.dot(odysseusCenter), -1, 1),
    );
    const odysseusNormalized = odysseusDistance / 0.405;
    const floorMask = odysseusNormalized < 1
      ? Math.pow(Math.max(0, 1 - odysseusNormalized), 0.72)
      : 0;
    height *= 1 - floorMask * 0.32;
    height += addComplexCraterHeight(direction, odysseusCenter, {
      radius: 0.405,
      depth: 0.029,
      rim: 0.012,
      peak: 0.0018,
    });

    const tangentX = direction.dot(odysseusBasisA);
    const tangentY = direction.dot(odysseusBasisB);
    const azimuth = Math.atan2(tangentY, tangentX);
    const chasmaRadius = 1.03 + Math.sin(azimuth * 2.0 + 0.4) * 0.055
      + Math.sin(azimuth * 5.0 - 0.8) * 0.020;
    const chasmaDistance = Math.abs(odysseusDistance - chasmaRadius);
    const chasmaCoverage = smoothstepValue(Math.cos(azimuth - 0.35), -0.92, -0.74)
      * (0.88 + 0.12 * Math.max(0, Math.sin(azimuth * 4.2 + tangentY * 6.8 + 0.4)));
    const trough = Math.exp(-Math.pow(chasmaDistance / 0.0105, 2));
    const rims = Math.exp(-Math.pow((chasmaDistance - 0.016) / 0.0075, 2));
    height += chasmaCoverage * (-0.00055 * trough + 0.00018 * rims);

    const radius = Math.max(0.84, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius * 1.010,
      direction.y * radius * 0.992,
      direction.z * radius * 1.006,
    );
  }

  geometry.computeVertexNormals();
  smoothSphereUvSeamNormals(geometry);
  geometry.computeBoundingSphere();
  const maps = getSaturnianSurfaceMaps("Tethys");
  const moon = new THREE.Mesh(
    geometry,
    createMappedMoonMaterial("Tethys", maps, {
      roughness: 0.92,
      bumpScale: quality === "low" ? 0.011 : quality === "medium" ? 0.018 : 0.024,
    }),
  );
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = "NASA Cassini global map PIA14931";
  moon.userData.surfaceStructure = "Bright water-ice crust with the relaxed Odysseus impact basin, the immense Ithaca Chasma arc, and widespread impact craters";
  moon.userData.surfaceRoughness = 0.92;
  moon.userData.surfaceDetailMode = "cassini-map-with-odysseus-and-ithaca-geometry";
  moon.userData.tethysSurfaceState = { profile, quality, maps, odysseusCenter: odysseusCenter.clone() };
  return moon;
}

function createDioneSurface(profile, quality) {
  const [widthSegments, heightSegments] = mappedMoonGeometrySegments("Dione", quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const trailingCenter = directionFromUv(0.78, 0.50);
  const tangentA = new THREE.Vector3(0, 1, 0).cross(trailingCenter).normalize();
  const tangentB = trailingCenter.clone().cross(tangentA).normalize();
  const craterCount = quality === "low" ? 50 : quality === "medium" ? 84 : 122;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.018,
    maxRadius: 0.132,
    minDepth: 0.0018,
    maxDepth: 0.0155,
    seedOffset: 44.9,
  });
  const fractureOffsets = [-0.48, -0.34, -0.19, -0.04, 0.12, 0.29, 0.44];
  const evander = directionFromUv(0.50, 0.74);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    let height = fbm(direction, 2.5, profile.seed + 9.4) * 0.0034;
    height += fbm(direction, 16.0, profile.seed + 29.8) * 0.00135;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
    });
    height += addComplexCraterHeight(direction, evander, {
      radius: 0.23,
      depth: 0.019,
      rim: 0.006,
      peak: 0.0015,
    });

    const hemisphere = smoothstepValue(direction.dot(trailingCenter), 0.02, 0.84);
    if (hemisphere > 0) {
      const x = direction.dot(tangentA);
      const y = direction.dot(tangentB);
      const localAzimuth = Math.atan2(y, x);
      fractureOffsets.forEach((offset, fractureIndex) => {
        const center = offset
          + Math.sin(y * 4.2 + fractureIndex * 1.17) * 0.075
          + Math.sin(y * 10.2 - fractureIndex * 0.63) * 0.022;
        const distance = Math.abs(x - center);
        const canyon = Math.exp(-Math.pow(distance / 0.0095, 2));
        const brightWalls = Math.exp(-Math.pow((distance - 0.015) / 0.0058, 2));
        const primarySegment = angularWindow(localAzimuth, 1.92 - fractureIndex * 0.05, 0.54, 0.18);
        const secondarySegment = angularWindow(localAzimuth, -1.08 + fractureIndex * 0.03, 0.20, 0.11) * 0.38;
        const segmentMask = Math.max(primarySegment, secondarySegment);
        const lengthWindow = (1 - smoothstepValue(Math.abs(y), 0.72, 0.94))
          * (0.80 + 0.20 * Math.max(0, Math.sin(y * 12.0 + fractureIndex * 1.1)));
        height += hemisphere * segmentMask * lengthWindow * (-0.00045 * canyon + 0.00018 * brightWalls);
      });
    }

    const radius = Math.max(0.83, 1 + height);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);
  }

  geometry.computeVertexNormals();
  smoothSphereUvSeamNormals(geometry);
  geometry.computeBoundingSphere();
  const maps = getSaturnianSurfaceMaps("Dione");
  const moon = new THREE.Mesh(
    geometry,
    createMappedMoonMaterial("Dione", maps, {
      roughness: 0.88,
      bumpScale: 0,
    }),
  );
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = "NASA Cassini global maps PIA12814 and PIA18434";
  moon.userData.surfaceStructure = "Cratered water-ice surface with braided bright cliffs and tectonic chasmata across the trailing hemisphere";
  moon.userData.surfaceRoughness = 0.88;
  moon.userData.surfaceDetailMode = "cassini-map-with-braided-wispy-terrain-relief";
  moon.userData.dioneSurfaceState = { profile, quality, maps, trailingCenter: trailingCenter.clone() };
  return moon;
}

function createRheaSurface(profile, quality) {
  const [widthSegments, heightSegments] = mappedMoonGeometrySegments("Rhea", quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();
  const craterCount = quality === "low" ? 62 : quality === "medium" ? 104 : 148;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.016,
    maxRadius: 0.136,
    minDepth: 0.0019,
    maxDepth: 0.018,
    seedOffset: 58.2,
  });
  const tirawa = directionFromUv(0.17, 0.51);
  const mamaldi = directionFromUv(0.63, 0.57);
  const fractureCenter = directionFromUv(0.82, 0.54);
  const tangentA = new THREE.Vector3(0, 1, 0).cross(fractureCenter).normalize();
  const tangentB = fractureCenter.clone().cross(tangentA).normalize();

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    let height = fbm(direction, 2.3, profile.seed + 12.2) * 0.0040;
    height += fbm(direction, 17.0, profile.seed + 33.4) * 0.00155;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
    });
    height += addComplexCraterHeight(direction, tirawa, {
      radius: 0.29,
      depth: 0.023,
      rim: 0.008,
      peak: 0.0022,
    });
    height += addComplexCraterHeight(direction, mamaldi, {
      radius: 0.24,
      depth: 0.019,
      rim: 0.0065,
      peak: 0.0014,
    });

    const fractureWindow = smoothstepValue(direction.dot(fractureCenter), 0.12, 0.90);
    if (fractureWindow > 0) {
      const x = direction.dot(tangentA);
      const y = direction.dot(tangentB);
      for (let fractureIndex = 0; fractureIndex < 4; fractureIndex += 1) {
        const offset = -0.28 + fractureIndex * 0.19;
        const center = offset + Math.sin(y * 5.5 + fractureIndex * 1.3) * 0.045;
        const distance = Math.abs(x - center);
        const trough = Math.exp(-Math.pow(distance / 0.012, 2));
        const walls = Math.exp(-Math.pow((distance - 0.021) / 0.009, 2));
        height += fractureWindow * (1 - smoothstepValue(Math.abs(y), 0.66, 0.96))
          * (-0.0027 * trough + 0.00125 * walls);
      }
    }

    const radius = Math.max(0.82, 1 + height);
    positions.setXYZ(
      index,
      direction.x * radius * 1.004,
      direction.y * radius * 0.997,
      direction.z * radius * 1.003,
    );
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const maps = getSaturnianSurfaceMaps("Rhea");
  const moon = new THREE.Mesh(
    geometry,
    createMappedMoonMaterial("Rhea", maps, {
      roughness: 0.94,
      bumpScale: quality === "low" ? 0.012 : quality === "medium" ? 0.019 : 0.025,
    }),
  );
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = "NASA Cassini global map PIA14928";
  moon.userData.surfaceStructure = "Ancient densely cratered water-ice crust with overlapping basins, bright ejecta, and restrained tectonic fractures";
  moon.userData.surfaceRoughness = 0.94;
  moon.userData.surfaceDetailMode = "cassini-map-with-dense-crater-and-basin-relief";
  moon.userData.rheaSurfaceState = { profile, quality, maps, tirawa: tirawa.clone(), mamaldi: mamaldi.clone() };
  return moon;
}

export function createSaturnianMoonSurface(profile, quality = "high") {
  if (profile.name === "Titan") return createTitanSurface(profile, quality);
  if (profile.name === "Iapetus") return createIapetusSurface(profile, quality);
  if (profile.name === "Mimas") return createMimasSurface(profile, quality);
  if (profile.name === "Enceladus") return createEnceladusSurface(profile, quality);
  if (profile.name === "Tethys") return createTethysSurface(profile, quality);
  if (profile.name === "Dione") return createDioneSurface(profile, quality);
  if (profile.name === "Rhea") return createRheaSurface(profile, quality);

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
      envMapIntensity: 0.018,
    }),
  );
}

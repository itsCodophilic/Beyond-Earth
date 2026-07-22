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


const REFERENCE_MINOR_MOON_MODELS = Object.freeze({
  Pan: Object.freeze({
    kind: "pan-reference",
    shape: [1.30, 0.70, 1.03],
    roughness: 0.025,
    craterCount: 34,
    craterDepth: 0.024,
    ridgeHeight: 0.56,
    ridgeWidth: 0.255,
    palette: [0x85858a, 0xe7e4df, 0x34343a],
    structure: "Irregular icy core wrapped by a broad equatorial skirt of accreted ring material",
    evidence: "Cassini close-flyby imagery of Pan and NASA's ring-moon morphology summary",
  }),
  Daphnis: Object.freeze({
    kind: "daphnis-reference",
    shape: [1.18, 0.82, 0.84],
    roughness: 0.028,
    craterCount: 27,
    craterDepth: 0.030,
    ridgeHeight: 0.16,
    ridgeWidth: 0.105,
    palette: [0xa7a7a4, 0xf1efea, 0x555553],
    structure: "Small irregular ring moon with a restrained equatorial ridge and dusty icy coating",
    evidence: "Cassini close-flyby imagery of Daphnis and NASA's ring-moon montage",
  }),
  Atlas: Object.freeze({
    kind: "atlas-reference",
    shape: [1.22, 0.72, 1.00],
    roughness: 0.017,
    craterCount: 18,
    craterDepth: 0.024,
    ridgeHeight: 0.18,
    ridgeWidth: 0.34,
    palette: [0xc5c1b7, 0xf5f0e6, 0x4b4843],
    structure: "Pointed flying-saucer body with a thick, smooth equatorial ridge of ring debris",
    evidence: "Cassini close-flyby imagery and NASA Atlas overview",
  }),
  Prometheus: Object.freeze({
    kind: "prometheus-reference",
    shape: [1.42, 0.78, 0.70],
    roughness: 0.052,
    craterCount: 54,
    craterDepth: 0.050,
    palette: [0x9b9487, 0xd9cfb9, 0x514b43],
    structure: "Sweet-potato-shaped porous ice body with pockmarked terrain and several large craters",
    evidence: "NASA Prometheus overview and Cassini 2015 close-flyby imagery",
  }),
  Pandora: Object.freeze({
    kind: "pandora-reference",
    shape: [1.34, 0.80, 0.74],
    roughness: 0.040,
    craterCount: 48,
    craterDepth: 0.043,
    grooveStrength: 0.012,
    palette: [0x8d8d8b, 0xd5d4d0, 0x252526],
    structure: "Potato-shaped moon blanketed in fine icy dust, with softened craters, grooves, and low ridges",
    evidence: "NASA Pandora overview and Cassini close-up imagery",
  }),
  Janus: Object.freeze({
    kind: "janus-reference",
    shape: [1.18, 0.96, 0.92],
    roughness: 0.036,
    craterCount: 64,
    craterDepth: 0.070,
    palette: [0xa6a39b, 0xe4e0d7, 0x4f4c47],
    structure: "Blocky, battered co-orbital moon with a broad prominent basin, many smaller craters, and rough icy highlands",
    evidence: "Cassini Janus close imagery and the user-supplied reference frame",
  }),
  Epimetheus: Object.freeze({
    kind: "epimetheus-reference",
    shape: [1.16, 0.98, 0.92],
    roughness: 0.046,
    craterCount: 72,
    craterDepth: 0.082,
    palette: [0x9a978f, 0xd8d3c8, 0x48443f],
    structure: "Lumpy dirty-ice body with a large steep-walled crater, a battered left edge, and densely cratered broken terrain",
    evidence: "Cassini Epimetheus close imagery and the user-supplied reference frame",
  }),
  Aegaeon: Object.freeze({
    kind: "smooth-ellipsoid",
    shape: [1.27, 0.83, 0.74],
    roughness: 0.018,
    craterCount: 2,
    craterDepth: 0.012,
    palette: [0xaaa79f, 0xd5d1c8, 0x6b6761],
    structure: "Tiny elongated ring-arc moon represented conservatively from its resolved Cassini silhouette",
    evidence: "Cassini small-satellite photomontage; only limited resolved surface information exists",
  }),
  Methone: Object.freeze({
    kind: "methone-reference",
    shape: [1.18, 0.95, 0.92],
    roughness: 0.0025,
    craterCount: 0,
    craterDepth: 0,
    palette: [0xc7c5bf, 0xf1eee7, 0x8a877f],
    structure: "Very smooth, pale egg-shaped moon with an almost pristine surface and a muted darker cap region",
    evidence: "Cassini Methone imagery and the user-supplied smooth-ellipsoid reference",
  }),
  Anthe: Object.freeze({
    kind: "anthe-reference",
    shape: [1.08, 0.96, 0.90],
    roughness: 0.072,
    craterCount: 12,
    craterDepth: 0.060,
    palette: [0x64615d, 0x8f8a84, 0x2e2c2a],
    structure: "Tiny rugged irregular moon with a dark coarse surface, angular facets, and a couple of shallow basins",
    evidence: "Conservative reconstruction from the user-supplied Anthe image and small ring-moon morphology",
  }),
  Pallene: Object.freeze({
    kind: "smooth-ellipsoid",
    shape: [1.12, 0.96, 0.91],
    roughness: 0.007,
    craterCount: 3,
    craterDepth: 0.008,
    palette: [0xb2b0aa, 0xdbd7cf, 0x74716b],
    structure: "Small smooth icy ellipsoid with subtle albedo mottling and only subdued impact relief",
    evidence: "Cassini small-satellite photomontage and limited resolved imagery",
  }),
  Telesto: Object.freeze({
    kind: "telesto-reference",
    shape: [1.16, 0.98, 0.92],
    roughness: 0.011,
    craterCount: 8,
    craterDepth: 0.014,
    palette: [0xd6d6d0, 0xf7f5ed, 0x8e8b84],
    structure: "Very bright smooth teardrop-like Trojan moon with a swollen right lobe and a ragged broken left margin",
    evidence: "Cassini Telesto imagery and the user-supplied reference frame",
  }),
  Calypso: Object.freeze({
    kind: "calypso-reference",
    shape: [1.48, 0.60, 0.76],
    roughness: 0.014,
    craterCount: 7,
    craterDepth: 0.016,
    palette: [0xcecdc7, 0xf2f0e8, 0x807b74],
    structure: "Long flattened Trojan moon with a smooth bright upper face, blunt ends, and a darker scuffed lower-right underside",
    evidence: "Cassini Calypso imagery and the user-supplied reference frame",
  }),
  Helene: Object.freeze({
    kind: "helene-reference",
    shape: [1.00, 1.00, 0.96],
    roughness: 0.022,
    craterCount: 6,
    craterDepth: 0.013,
    palette: [0xd1d0ca, 0xf5f2ea, 0x8f8b83],
    structure: "Bright rounded moon with dramatic fan-like flow streaks across the right half and a smaller lower lobe",
    evidence: "Cassini Helene close imagery and the user-supplied reference frame",
  }),
  Polydeuces: Object.freeze({
    kind: "polydeuces-reference",
    shape: [0.96, 1.20, 0.88],
    roughness: 0.030,
    craterCount: 7,
    craterDepth: 0.024,
    palette: [0x98968f, 0xcfc9bf, 0x595650],
    structure: "Small upright potato-shaped Trojan moon with subdued basins, a rough pebbled surface, and a broader left shoulder",
    evidence: "Conservative reconstruction from the user-supplied Polydeuces image",
  }),
  Hyperion: Object.freeze({
    kind: "hyperion-reference",
    shape: [0.96, 1.26, 0.90],
    roughness: 0.078,
    craterCount: 132,
    craterDepth: 0.112,
    palette: [0x95836f, 0xcab79d, 0x2f2924],
    structure: "Tall sponge-like moon covered in dense pitting, with large deep-walled basins and a gnawed-away right edge",
    evidence: "Cassini Hyperion close imagery and the user-supplied reference frame",
  }),
  Phoebe: Object.freeze({
    kind: "phoebe-reference",
    shape: [0.98, 1.18, 0.90],
    roughness: 0.056,
    craterCount: 102,
    craterDepth: 0.084,
    palette: [0x585652, 0x9a9489, 0x252422],
    structure: "Dark captured irregular moon with two giant shadowed craters near the crown, many smaller pits, and a brighter sunlit right flank",
    evidence: "Cassini Phoebe flyby imagery and the user-supplied reference frame",
  }),
});

function resolvedMinorDetail(config, quality) {
  const hero = config.kind === "hyperion" || config.kind === "phoebe";
  if (quality === "low") return hero ? 5 : 4;
  if (quality === "medium") return hero ? 7 : 6;
  return hero ? 9 : 7;
}

function createReferenceCraterField(profile, config) {
  if (!config.craterCount) return [];
  const hyperionLike = config.kind === "hyperion" || config.kind === "hyperion-reference";
  const phoebeLike = config.kind === "phoebe" || config.kind === "phoebe-reference";
  const minRadius = hyperionLike ? 0.026 : phoebeLike ? 0.024 : 0.035;
  const maxRadius = hyperionLike ? 0.245 : phoebeLike ? 0.205 : 0.22;
  const craters = createMappedCraterField(profile, config.craterCount, {
    minRadius,
    maxRadius,
    minDepth: Math.max(0.0015, config.craterDepth * 0.16),
    maxDepth: Math.max(0.004, config.craterDepth),
    seedOffset: 81.7,
  });

  if (config.kind === "hyperion" || config.kind === "hyperion-reference") {
    craters.push(
      { center: directionFromLatLon(18, -24), radius: 0.36, depth: 0.120, rim: 0.015 },
      { center: directionFromLatLon(-22, 71), radius: 0.29, depth: 0.095, rim: 0.012 },
      { center: directionFromLatLon(44, 142), radius: 0.25, depth: 0.078, rim: 0.010 },
    );
  } else if (config.kind === "phoebe" || config.kind === "phoebe-reference") {
    craters.push(
      { center: directionFromLatLon(-8, 32), radius: 0.40, depth: 0.095, rim: 0.018 },
      { center: directionFromLatLon(41, -108), radius: 0.28, depth: 0.060, rim: 0.012 },
    );
  } else if (["coorbital-cratered", "coorbital-gnarled"].includes(config.kind)) {
    craters.push({
      center: directionFromLatLon(16, -42),
      radius: config.kind === "coorbital-gnarled" ? 0.31 : 0.27,
      depth: config.craterDepth * 1.15,
      rim: config.craterDepth * 0.22,
    });
  }
  return craters;
}


const UPLOADED_REFERENCE_KINDS = new Set([
  "pan-reference",
  "atlas-reference",
  "daphnis-reference",
  "prometheus-reference",
  "pandora-reference",
]);

const ADDITIONAL_REFERENCE_KINDS = new Set([
  "janus-reference",
  "epimetheus-reference",
  "methone-reference",
  "anthe-reference",
]);

const ADVANCED_REFERENCE_KINDS = new Set([
  "telesto-reference",
  "calypso-reference",
  "helene-reference",
  "polydeuces-reference",
  "hyperion-reference",
  "phoebe-reference",
]);

function uploadedReferenceDetail(quality) {
  if (quality === "low") return 7;
  if (quality === "medium") return 12;
  return 18;
}

function signedPower(value, exponent) {
  return Math.sign(value) * Math.pow(Math.abs(value), exponent);
}

function superellipsoidDirection(direction, exponent, target) {
  target.set(
    signedPower(direction.x, exponent),
    signedPower(direction.y, exponent),
    signedPower(direction.z, exponent),
  );
  return target.normalize();
}

function gaussianSurfaceMask(direction, center, angularRadius) {
  const angularDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  return Math.exp(-Math.pow(angularDistance / Math.max(1e-5, angularRadius), 2));
}

function createReferenceFeatureFrame(center) {
  const tangentA = new THREE.Vector3(0, 1, 0).cross(center);
  if (tangentA.lengthSq() < 1e-5) tangentA.set(1, 0, 0);
  tangentA.normalize();
  const tangentB = center.clone().cross(tangentA).normalize();
  return { tangentA, tangentB };
}

function elongatedSurfaceMask(direction, center, frame, widthA, widthB) {
  const facing = smoothstepValue(direction.dot(center), 0.45, 0.98);
  const a = direction.dot(frame.tangentA);
  const b = direction.dot(frame.tangentB);
  return facing * Math.exp(-Math.pow(a / widthA, 2) - Math.pow(b / widthB, 2));
}

function normaliseReferenceGeometry(geometry) {
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingSphere();
  const radius = Math.max(1e-6, geometry.boundingSphere.radius);
  geometry.scale(1 / radius, 1 / radius, 1 / radius);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Reconstructs the five supplied Cassini-reference silhouettes as true 3D
 * bodies rather than image billboards.  Each moon gets its own outline,
 * large-scale relief, crater placement, and albedo response.  The geometry is
 * normalised after sculpting so satelliteSystem can apply one physical visual
 * radius without re-applying the catalogue shape a second time.
 */
function createUploadedReferenceMoonSurface(profile, quality, config) {
  const source = new THREE.IcosahedronGeometry(1, uploadedReferenceDetail(quality));
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const shapedDirection = new THREE.Vector3();
  const base = new THREE.Color(config.palette[0]);
  const light = new THREE.Color(config.palette[1]);
  const dark = new THREE.Color(config.palette[2]);
  const colour = new THREE.Color();
  const craters = createReferenceCraterField(profile, config);

  const atlasCleft = directionFromLatLon(34, -68);
  const atlasCleftFrame = createReferenceFeatureFrame(atlasCleft);
  const atlasBrightPatch = directionFromLatLon(3, -118);
  const daphnisHeroCrater = directionFromLatLon(31, -112);
  const prometheusHeroCraters = [
    { center: directionFromLatLon(-24, -116), radius: 0.29, depth: 0.072, rim: 0.014 },
    { center: directionFromLatLon(6, -92), radius: 0.22, depth: 0.052, rim: 0.011 },
    { center: directionFromLatLon(27, -63), radius: 0.17, depth: 0.038, rim: 0.008 },
  ];
  const pandoraMainBasin = directionFromLatLon(10, -132);
  const pandoraChasm = directionFromLatLon(-8, -80);
  const pandoraChasmFrame = createReferenceFeatureFrame(pandoraChasm);
  const pandoraChasmBranch = directionFromLatLon(18, -73);
  const pandoraChasmBranchFrame = createReferenceFeatureFrame(pandoraChasmBranch);
  const pandoraLowerPit = directionFromLatLon(-48, -70);
  const pandoraTopBreak = directionFromLatLon(62, -52);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 2.05, profile.seed + 4.1);
    const medium = fbm(direction, 7.2, profile.seed + 19.7);
    const fine = fbm(direction, 25.0, profile.seed + 37.2);
    let height = broad * config.roughness
      + medium * config.roughness * 0.34
      + fine * config.roughness * 0.12;
    let craterFloor = 0;
    let craterRim = 0;
    let ridgeMask = 0;
    let cavityMask = 0;
    let specialBright = 0;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rimMask);
    });

    let px;
    let py;
    let pz;

    if (config.kind === "pan-reference") {
      const equator = 1 - smoothstepValue(Math.abs(direction.y), 0.10, 0.44);
      const skirtGrain = 0.94 + 0.06 * fbm(direction, 11.0, profile.seed + 91.2);
      ridgeMask = equator;
      height *= 1 - equator * 0.70;
      const bodyRadius = Math.max(0.70, 1 + height);
      const leftRightAsymmetry = 1 + direction.x * 0.045
        + Math.sin(Math.atan2(direction.z, direction.x) * 3.0 + 0.55) * 0.025;
      const skirt = config.ridgeHeight * equator * skirtGrain;
      px = direction.x * bodyRadius * (0.91 + skirt) * leftRightAsymmetry;
      py = direction.y * bodyRadius * 0.93 * (1 - equator * 0.055);
      pz = direction.z * bodyRadius * (0.82 + skirt * 0.76);
      const beltTrench = Math.exp(-Math.pow((direction.y + 0.050) / 0.062, 2));
      cavityMask = beltTrench * (0.60 + 0.40 * Math.max(0, medium));
      specialBright = equator * (0.72 + 0.28 * Math.max(0, fine));
    } else if (config.kind === "atlas-reference") {
      superellipsoidDirection(direction, 0.86, shapedDirection);
      const equator = Math.exp(-Math.pow(direction.y / config.ridgeWidth, 2));
      const cleft = elongatedSurfaceMask(direction, atlasCleft, atlasCleftFrame, 0.22, 0.105);
      ridgeMask = equator;
      height *= 1 - equator * 0.62;
      height -= cleft * 0.105;
      cavityMask = cleft;
      const bodyRadius = Math.max(0.70, 1 + height);
      const lopsided = 1 + direction.x * 0.055 - direction.z * 0.018;
      px = shapedDirection.x * bodyRadius * (0.98 + equator * config.ridgeHeight) * lopsided;
      py = shapedDirection.y * bodyRadius * 0.88 * (1 - equator * 0.025);
      pz = shapedDirection.z * bodyRadius * (0.92 + equator * config.ridgeHeight * 0.58);
      specialBright = equator * 0.52 + gaussianSurfaceMask(direction, atlasBrightPatch, 0.44) * 0.12;
    } else if (config.kind === "daphnis-reference") {
      const equator = Math.exp(-Math.pow(direction.y / config.ridgeWidth, 2));
      const heroSample = craterSample(direction, daphnisHeroCrater, 0.29, 0.057, 0.014);
      height += heroSample.height;
      craterFloor = Math.max(craterFloor, heroSample.floor);
      craterRim = Math.max(craterRim, heroSample.rimMask);
      ridgeMask = equator;
      const bodyRadius = Math.max(0.68, 1 + height);
      px = direction.x * bodyRadius * (1.22 + equator * config.ridgeHeight);
      py = direction.y * bodyRadius * 0.63 * (1 - equator * 0.045);
      pz = direction.z * bodyRadius * (0.82 + equator * config.ridgeHeight * 0.58);
      specialBright = equator * 0.40 + craterRim * 0.34;
    } else if (config.kind === "prometheus-reference") {
      prometheusHeroCraters.forEach((crater) => {
        const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
        height += sample.height;
        craterFloor = Math.max(craterFloor, sample.floor);
        craterRim = Math.max(craterRim, sample.rimMask);
      });
      const longitudinalT = direction.x * 0.5 + 0.5;
      const crossSection = 0.72 + longitudinalT * 0.18
        + medium * 0.055
        - Math.pow(Math.max(0, -direction.x), 3) * 0.11;
      const endRoughness = smoothstepValue(-direction.x, 0.38, 0.98);
      height += endRoughness * fine * 0.025;
      const bodyRadius = Math.max(0.61, 1 + height);
      px = direction.x * bodyRadius * 1.50
        - (1 - direction.x * direction.x) * 0.085
        + direction.y * 0.025;
      py = direction.y * bodyRadius * crossSection;
      pz = direction.z * bodyRadius * crossSection * 0.91;
      cavityMask = craterFloor;
      specialBright = craterRim * 0.26 + smoothstepValue(direction.x, 0.30, 0.95) * 0.10;
    } else {
      superellipsoidDirection(direction, 0.80, shapedDirection);
      const mainBasinSample = craterSample(direction, pandoraMainBasin, 0.43, 0.175, 0.025);
      const lowerPitSample = craterSample(direction, pandoraLowerPit, 0.23, 0.095, 0.014);
      const chasm = elongatedSurfaceMask(direction, pandoraChasm, pandoraChasmFrame, 0.16, 0.38);
      const chasmBranch = elongatedSurfaceMask(
        direction,
        pandoraChasmBranch,
        pandoraChasmBranchFrame,
        0.115,
        0.26,
      );
      height += mainBasinSample.height + lowerPitSample.height;
      height -= chasm * 0.145 + chasmBranch * 0.075;
      craterFloor = Math.max(craterFloor, mainBasinSample.floor, lowerPitSample.floor);
      craterRim = Math.max(craterRim, mainBasinSample.rimMask, lowerPitSample.rimMask);
      cavityMask = Math.max(craterFloor * 0.82, chasm, chasmBranch * 0.78);
      const bodyRadius = Math.max(0.52, 1 + height);
      const topBreak = 1 - gaussianSurfaceMask(direction, pandoraTopBreak, 0.32) * 0.08;
      px = shapedDirection.x * bodyRadius * 1.05 * topBreak;
      py = shapedDirection.y * bodyRadius * 0.91 * topBreak;
      pz = shapedDirection.z * bodyRadius * 0.84;
      specialBright = craterRim * 0.30 + mainBasinSample.rimMask * 0.25;
    }

    positions.setXYZ(index, px, py, pz);

    const brightness = THREE.MathUtils.clamp(
      0.38 + broad * 0.15 + medium * 0.09 + fine * 0.035,
      0.10,
      0.72,
    );
    colour.copy(base).lerp(light, brightness);
    colour.lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.48 + cavityMask * 0.72, 0, 0.94));
    colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.22 + specialBright * 0.34, 0, 0.58));

    if (config.kind === "pan-reference") {
      colour.lerp(light, ridgeMask * 0.36);
      colour.lerp(dark, cavityMask * 0.16);
    } else if (config.kind === "atlas-reference") {
      colour.lerp(light, ridgeMask * 0.30);
      colour.lerp(dark, cavityMask * 0.72);
    } else if (config.kind === "daphnis-reference") {
      colour.lerp(light, ridgeMask * 0.18);
    } else if (config.kind === "prometheus-reference") {
      colour.multiplyScalar(0.94 + Math.max(0, fine) * 0.10);
    } else {
      colour.lerp(dark, cavityMask * 0.38);
    }

    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  source.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source, 1e-5);
  normaliseReferenceGeometry(geometry);
  source.dispose();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: config.kind === "atlas-reference" ? 0.90 : 0.97,
    metalness: 0,
    envMapIntensity: config.kind === "atlas-reference" ? 0.028 : 0.014,
    dithering: true,
  });
  material.name = `${profile.name} uploaded-reference 3D surface`;

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.referenceImageSequence = ["Pan", "Atlas", "Daphnis", "Prometheus", "Pandora"];
  moon.userData.surfaceEvidence = `${config.evidence}; silhouette and major relief matched to the user-supplied reference image`;
  moon.userData.surfaceStructure = config.structure;
  moon.userData.surfaceRoughness = material.roughness;
  moon.userData.surfaceDetailMode = `uploaded-reference-${config.kind}`;
  moon.userData.referenceMinorMoonState = { profile, quality, config };
  return moon;
}

function createAdditionalReferenceMoonSurface(profile, quality, config) {
  const source = new THREE.IcosahedronGeometry(1, uploadedReferenceDetail(quality));
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const shapedDirection = new THREE.Vector3();
  const base = new THREE.Color(config.palette[0]);
  const light = new THREE.Color(config.palette[1]);
  const dark = new THREE.Color(config.palette[2]);
  const colour = new THREE.Color();
  const craters = createReferenceCraterField(profile, config);

  const janusMainCrater = directionFromLatLon(8, -22);
  const janusSecondaryCrater = directionFromLatLon(23, 42);
  const janusShoulderCut = directionFromLatLon(49, 134);
  const janusShoulderFrame = createReferenceFeatureFrame(janusShoulderCut);
  const janusLowerScarp = directionFromLatLon(-38, 146);
  const janusLowerScarpFrame = createReferenceFeatureFrame(janusLowerScarp);

  const epimetheusMainCrater = directionFromLatLon(6, -14);
  const epimetheusSecondaryCrater = directionFromLatLon(17, 54);
  const epimetheusGouge = directionFromLatLon(-3, 150);
  const epimetheusGougeFrame = createReferenceFeatureFrame(epimetheusGouge);

  const methoneCap = directionFromLatLon(54, -18);
  const methoneDimple = directionFromLatLon(39, -8);
  const methoneBulge = directionFromLatLon(-8, 92);

  const antheMainBasin = directionFromLatLon(8, -16);
  const antheSecondaryBasin = directionFromLatLon(-22, 52);
  const antheFacet = directionFromLatLon(44, -84);
  const antheFacetFrame = createReferenceFeatureFrame(antheFacet);
  const antheEdgeDamage = directionFromLatLon(-26, 150);
  const antheEdgeDamageFrame = createReferenceFeatureFrame(antheEdgeDamage);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 2.0, profile.seed + 4.1);
    const medium = fbm(direction, 7.0, profile.seed + 19.7);
    const fine = fbm(direction, 25.0, profile.seed + 37.2);
    let height = broad * config.roughness
      + medium * config.roughness * 0.34
      + fine * config.roughness * 0.12;
    let craterFloor = 0;
    let craterRim = 0;
    let cavityMask = 0;
    let specialBright = 0;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rimMask);
    });

    let px;
    let py;
    let pz;

    if (config.kind === "janus-reference") {
      superellipsoidDirection(direction, 0.72, shapedDirection);
      const main = craterSample(direction, janusMainCrater, 0.28, 0.120, 0.018);
      const secondary = craterSample(direction, janusSecondaryCrater, 0.13, 0.038, 0.008);
      const shoulder = elongatedSurfaceMask(direction, janusShoulderCut, janusShoulderFrame, 0.18, 0.32);
      const lowerScarp = elongatedSurfaceMask(direction, janusLowerScarp, janusLowerScarpFrame, 0.16, 0.24);
      height += main.height + secondary.height - shoulder * 0.030 - lowerScarp * 0.018;
      craterFloor = Math.max(craterFloor, main.floor, secondary.floor);
      craterRim = Math.max(craterRim, main.rimMask, secondary.rimMask);
      cavityMask = Math.max(main.floor, shoulder * 0.62, lowerScarp * 0.42);
      const flankDamage = smoothstepValue(-direction.x, 0.14, 0.96) * (0.35 + 0.65 * Math.max(0, medium));
      const topPlaning = 1 - smoothstepValue(direction.y, 0.48, 0.98) * 0.06;
      const bodyRadius = Math.max(0.60, 1 + height);
      px = shapedDirection.x * bodyRadius * 1.07 * (1 - flankDamage * 0.08) + direction.z * 0.018;
      py = shapedDirection.y * bodyRadius * 0.98 * topPlaning;
      pz = shapedDirection.z * bodyRadius * 0.97 * (1 + smoothstepValue(direction.x, -0.25, 0.95) * 0.05);
      specialBright = main.rimMask * 0.42 + secondary.rimMask * 0.18;
    } else if (config.kind === "epimetheus-reference") {
      superellipsoidDirection(direction, 0.76, shapedDirection);
      const main = craterSample(direction, epimetheusMainCrater, 0.25, 0.122, 0.018);
      const secondary = craterSample(direction, epimetheusSecondaryCrater, 0.16, 0.050, 0.010);
      const gouge = elongatedSurfaceMask(direction, epimetheusGouge, epimetheusGougeFrame, 0.18, 0.36);
      height += main.height + secondary.height - gouge * 0.055;
      craterFloor = Math.max(craterFloor, main.floor, secondary.floor);
      craterRim = Math.max(craterRim, main.rimMask, secondary.rimMask);
      cavityMask = Math.max(main.floor, secondary.floor * 0.82, gouge * 0.76);
      const gnarl = smoothstepValue(-direction.x, 0.18, 0.96) * (0.32 + 0.68 * Math.max(0, fine));
      const bodyRadius = Math.max(0.58, 1 + height);
      px = shapedDirection.x * bodyRadius * 1.04 * (1 - gnarl * 0.10) + direction.y * 0.015;
      py = shapedDirection.y * bodyRadius * 1.00 * (1 - gouge * 0.04);
      pz = shapedDirection.z * bodyRadius * 0.93;
      specialBright = main.rimMask * 0.40 + secondary.rimMask * 0.24;
    } else if (config.kind === "methone-reference") {
      superellipsoidDirection(direction, 1.28, shapedDirection);
      const dimple = craterSample(direction, methoneDimple, 0.16, 0.011, 0.004);
      const capMask = gaussianSurfaceMask(direction, methoneCap, 0.34);
      const bulge = gaussianSurfaceMask(direction, methoneBulge, 0.56);
      height = broad * config.roughness * 0.42 + medium * config.roughness * 0.18 + fine * config.roughness * 0.06;
      height += dimple.height + bulge * 0.016 - capMask * 0.008;
      craterFloor = dimple.floor * 0.42;
      craterRim = dimple.rimMask * 0.30;
      cavityMask = capMask * 0.40;
      const bodyRadius = Math.max(0.88, 1 + height);
      const egg = 1 + smoothstepValue(direction.x, -0.20, 0.95) * 0.06 - smoothstepValue(-direction.x, 0.18, 0.95) * 0.02;
      px = shapedDirection.x * bodyRadius * 1.02 * egg;
      py = shapedDirection.y * bodyRadius * 0.90 * (1 - capMask * 0.02);
      pz = shapedDirection.z * bodyRadius * 0.96;
      specialBright = bulge * 0.18 + craterRim * 0.12;
    } else {
      superellipsoidDirection(direction, 0.82, shapedDirection);
      const main = craterSample(direction, antheMainBasin, 0.28, 0.110, 0.014);
      const secondary = craterSample(direction, antheSecondaryBasin, 0.16, 0.050, 0.010);
      const facet = elongatedSurfaceMask(direction, antheFacet, antheFacetFrame, 0.15, 0.24);
      const edgeDamage = elongatedSurfaceMask(direction, antheEdgeDamage, antheEdgeDamageFrame, 0.12, 0.21);
      height += main.height + secondary.height - facet * 0.030 - edgeDamage * 0.045 + Math.max(0, fine) * 0.018;
      craterFloor = Math.max(craterFloor, main.floor, secondary.floor);
      craterRim = Math.max(craterRim, main.rimMask, secondary.rimMask);
      cavityMask = Math.max(main.floor, secondary.floor * 0.82, edgeDamage * 0.95);
      const bodyRadius = Math.max(0.56, 1 + height);
      const topBlock = 1 - smoothstepValue(direction.y, 0.55, 0.98) * 0.07;
      px = shapedDirection.x * bodyRadius * 1.02 * (1 - edgeDamage * 0.08);
      py = shapedDirection.y * bodyRadius * 0.95 * topBlock;
      pz = shapedDirection.z * bodyRadius * 0.88;
      specialBright = main.rimMask * 0.18 + secondary.rimMask * 0.12;
    }

    positions.setXYZ(index, px, py, pz);

    const brightness = THREE.MathUtils.clamp(
      config.kind === "methone-reference"
        ? 0.52 + broad * 0.06 + medium * 0.04
        : 0.36 + broad * 0.14 + medium * 0.08 + fine * 0.03,
      0.08,
      config.kind === "methone-reference" ? 0.84 : 0.70,
    );
    colour.copy(base).lerp(light, brightness);

    if (config.kind === "methone-reference") {
      colour.lerp(light, 0.28 + specialBright * 0.16);
      colour.lerp(dark, cavityMask * 0.34);
    } else if (config.kind === "anthe-reference") {
      colour.multiplyScalar(0.82 + Math.max(0, medium) * 0.08);
      colour.lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.36 + cavityMask * 0.74, 0, 0.96));
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.14 + specialBright * 0.10, 0, 0.24));
    } else {
      colour.lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.50 + cavityMask * 0.52, 0, 0.92));
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.24 + specialBright * 0.26, 0, 0.48));
      if (config.kind === "epimetheus-reference") {
        colour.lerp(dark, smoothstepValue(-direction.x, 0.16, 0.96) * 0.12);
      }
    }

    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  source.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source, 1e-5);
  normaliseReferenceGeometry(geometry);
  source.dispose();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: config.kind === "methone-reference" ? 0.84 : config.kind === "anthe-reference" ? 0.98 : 0.96,
    metalness: 0,
    envMapIntensity: config.kind === "methone-reference" ? 0.030 : 0.015,
    dithering: true,
  });
  material.name = `${profile.name} uploaded-reference 3D surface`;

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.referenceImageSequence = ["Janus", "Epimetheus", "Methone", "Anthe"];
  moon.userData.surfaceEvidence = `${config.evidence}; silhouette and major relief matched to the user-supplied reference image`;
  moon.userData.surfaceStructure = config.structure;
  moon.userData.surfaceRoughness = material.roughness;
  moon.userData.surfaceDetailMode = `uploaded-reference-${config.kind}`;
  moon.userData.referenceMinorMoonState = { profile, quality, config };
  return moon;
}

function createAdvancedReferenceMoonSurface(profile, quality, config) {
  const source = new THREE.IcosahedronGeometry(1, uploadedReferenceDetail(quality));
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const shapedDirection = new THREE.Vector3();
  const base = new THREE.Color(config.palette[0]);
  const light = new THREE.Color(config.palette[1]);
  const dark = new THREE.Color(config.palette[2]);
  const colour = new THREE.Color();
  const craters = createReferenceCraterField(profile, config);

  const telestoCentral = directionFromLatLon(-8, -8);
  const telestoLeftDamage = directionFromLatLon(-5, -165);
  const telestoLeftFrame = createReferenceFeatureFrame(telestoLeftDamage);
  const telestoLowerPit = directionFromLatLon(-37, -138);

  const calypsoTopPatch = directionFromLatLon(23, -28);
  const calypsoBottomScuff = directionFromLatLon(-26, 54);
  const calypsoBottomFrame = createReferenceFeatureFrame(calypsoBottomScuff);
  const calypsoCentralCrater = directionFromLatLon(4, 16);

  const heleneFanSource = directionFromLatLon(2, -10);
  const heleneFanFrame = createReferenceFeatureFrame(heleneFanSource);
  const heleneBottomLobe = directionFromLatLon(-48, -4);
  const heleneUpperPit = directionFromLatLon(32, 16);

  const polydeucesUpperFacet = directionFromLatLon(42, -14);
  const polydeucesShoulder = directionFromLatLon(-4, -48);
  const polydeucesBasin = directionFromLatLon(-18, 26);

  const hyperionMainBasin = directionFromLatLon(-30, 42);
  const hyperionCentralBasin = directionFromLatLon(6, -12);
  const hyperionUpperRim = directionFromLatLon(56, -18);
  const hyperionRightChew = directionFromLatLon(12, 116);
  const hyperionRightFrame = createReferenceFeatureFrame(hyperionRightChew);

  const phoebeTopLeft = directionFromLatLon(42, -136);
  const phoebeTopRight = directionFromLatLon(38, -22);
  const phoebeMidBasin = directionFromLatLon(-4, -32);
  const phoebeLowerCraters = directionFromLatLon(-28, -72);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 2.0, profile.seed + 5.3);
    const medium = fbm(direction, 7.4, profile.seed + 19.1);
    const fine = fbm(direction, 26.0, profile.seed + 37.8);
    let height = broad * config.roughness + medium * config.roughness * 0.34 + fine * config.roughness * 0.12;
    let craterFloor = 0;
    let craterRim = 0;
    let cavityMask = 0;
    let specialBright = 0;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rimMask);
    });

    let px;
    let py;
    let pz;

    if (config.kind === "telesto-reference") {
      superellipsoidDirection(direction, 1.12, shapedDirection);
      const central = craterSample(direction, telestoCentral, 0.14, 0.014, 0.004);
      const leftDamage = elongatedSurfaceMask(direction, telestoLeftDamage, telestoLeftFrame, 0.18, 0.38);
      const lowerPit = craterSample(direction, telestoLowerPit, 0.11, 0.022, 0.005);
      const leftTuftUpper = gaussianSurfaceMask(direction, directionFromLatLon(14, -156), 0.12);
      const leftTuftLower = gaussianSurfaceMask(direction, directionFromLatLon(-28, -148), 0.15);
      height += central.height + lowerPit.height - leftDamage * 0.028 + leftTuftUpper * 0.030 + leftTuftLower * 0.024;
      craterFloor = Math.max(craterFloor, central.floor, lowerPit.floor);
      craterRim = Math.max(craterRim, central.rimMask, lowerPit.rimMask);
      cavityMask = Math.max(leftDamage * 0.96, lowerPit.floor * 0.80);
      const bodyRadius = Math.max(0.88, 1 + height);
      const rightBulge = smoothstepValue(direction.x, 0.02, 0.98) * 0.13;
      const leftTrim = smoothstepValue(-direction.x, 0.12, 0.98) * 0.08;
      px = shapedDirection.x * bodyRadius * (0.97 + rightBulge) - leftDamage * 0.13 - leftTrim * 0.02;
      py = shapedDirection.y * bodyRadius * 0.99 - leftTuftLower * 0.02;
      pz = shapedDirection.z * bodyRadius * 0.97;
      specialBright = rightBulge * 0.34 + central.rimMask * 0.08 + leftTuftUpper * 0.06;
    } else if (config.kind === "calypso-reference") {
      superellipsoidDirection(direction, 1.26, shapedDirection);
      const central = craterSample(direction, calypsoCentralCrater, 0.10, 0.012, 0.003);
      const topPatch = gaussianSurfaceMask(direction, calypsoTopPatch, 0.30);
      const bottomScuff = elongatedSurfaceMask(direction, calypsoBottomScuff, calypsoBottomFrame, 0.15, 0.34);
      const rightShadowCap = gaussianSurfaceMask(direction, directionFromLatLon(-6, 84), 0.34);
      height += central.height - bottomScuff * 0.035 + topPatch * 0.004 - rightShadowCap * 0.008;
      craterFloor = Math.max(craterFloor, central.floor);
      craterRim = Math.max(craterRim, central.rimMask);
      cavityMask = Math.max(bottomScuff * 0.90, craterFloor, rightShadowCap * 0.55);
      const bodyRadius = Math.max(0.86, 1 + height);
      const leftTaper = smoothstepValue(-direction.x, 0.10, 0.98) * 0.06;
      const rightBlunt = smoothstepValue(direction.x, 0.20, 0.98) * 0.03;
      px = shapedDirection.x * bodyRadius * (1.42 - leftTaper + rightBlunt);
      py = shapedDirection.y * bodyRadius * 0.60 * (1 - topPatch * 0.018);
      pz = shapedDirection.z * bodyRadius * 0.77;
      specialBright = topPatch * 0.16 + central.rimMask * 0.04;
    } else if (config.kind === "helene-reference") {
      superellipsoidDirection(direction, 0.98, shapedDirection);
      const fanMask = gaussianSurfaceMask(direction, heleneFanSource, 0.58);
      const fa = direction.dot(heleneFanFrame.tangentA);
      const fb = direction.dot(heleneFanFrame.tangentB);
      const fanPhase = Math.atan2(fb, fa) * 20.0 + direction.dot(heleneFanSource) * 5.5;
      const fanLines = Math.pow(Math.max(0, Math.cos(fanPhase)), 26) * fanMask;
      const upperPit = craterSample(direction, heleneUpperPit, 0.10, 0.012, 0.004);
      const lowerPitA = craterSample(direction, directionFromLatLon(-42, -20), 0.16, 0.030, 0.006);
      const lowerPitB = craterSample(direction, directionFromLatLon(-52, 18), 0.12, 0.022, 0.005);
      const bottomLobe = gaussianSurfaceMask(direction, heleneBottomLobe, 0.30);
      const rightRagged = elongatedSurfaceMask(direction, directionFromLatLon(0, 96), createReferenceFeatureFrame(directionFromLatLon(0, 96)), 0.15, 0.44);
      height += upperPit.height + lowerPitA.height + lowerPitB.height + fanLines * 0.028 + bottomLobe * 0.072 - rightRagged * 0.018;
      craterFloor = Math.max(craterFloor, upperPit.floor, lowerPitA.floor, lowerPitB.floor);
      craterRim = Math.max(craterRim, upperPit.rimMask, lowerPitA.rimMask, lowerPitB.rimMask);
      cavityMask = Math.max(fanMask * 0.20, lowerPitA.floor * 0.76, rightRagged * 0.72);
      const bodyRadius = Math.max(0.84, 1 + height);
      px = shapedDirection.x * bodyRadius * 1.00;
      py = shapedDirection.y * bodyRadius * (0.98 + bottomLobe * 0.16);
      pz = shapedDirection.z * bodyRadius * 0.98 * (1 - rightRagged * 0.05);
      specialBright = fanMask * 0.26 + fanLines * 0.18 + upperPit.rimMask * 0.06;
    } else if (config.kind === "polydeuces-reference") {
      superellipsoidDirection(direction, 0.86, shapedDirection);
      const basin = craterSample(direction, polydeucesBasin, 0.16, 0.022, 0.006);
      const upperFacet = gaussianSurfaceMask(direction, polydeucesUpperFacet, 0.28);
      const shoulder = gaussianSurfaceMask(direction, polydeucesShoulder, 0.40);
      height += basin.height + upperFacet * 0.010 + shoulder * 0.020;
      craterFloor = Math.max(craterFloor, basin.floor);
      craterRim = Math.max(craterRim, basin.rimMask);
      const bodyRadius = Math.max(0.78, 1 + height);
      px = shapedDirection.x * bodyRadius * (0.92 + shoulder * 0.10);
      py = shapedDirection.y * bodyRadius * 1.18;
      pz = shapedDirection.z * bodyRadius * 0.86;
      cavityMask = basin.floor * 0.72;
      specialBright = upperFacet * 0.06 + basin.rimMask * 0.08;
    } else if (config.kind === "hyperion-reference") {
      superellipsoidDirection(direction, 0.72, shapedDirection);
      const main = craterSample(direction, hyperionMainBasin, 0.26, 0.130, 0.018);
      const central = craterSample(direction, hyperionCentralBasin, 0.18, 0.082, 0.012);
      const upperRim = craterSample(direction, hyperionUpperRim, 0.12, 0.030, 0.006);
      const rightChew = elongatedSurfaceMask(direction, hyperionRightChew, hyperionRightFrame, 0.22, 0.52);
      height += main.height + central.height + upperRim.height - rightChew * 0.085 + Math.max(0, fine) * 0.018;
      craterFloor = Math.max(craterFloor, main.floor, central.floor, upperRim.floor);
      craterRim = Math.max(craterRim, main.rimMask, central.rimMask, upperRim.rimMask);
      cavityMask = Math.max(main.floor, central.floor * 0.72, rightChew * 0.94);
      const bodyRadius = Math.max(0.54, 1 + height);
      px = shapedDirection.x * bodyRadius * 0.98 * (1 - rightChew * 0.10);
      py = shapedDirection.y * bodyRadius * 1.24;
      pz = shapedDirection.z * bodyRadius * 0.90;
      specialBright = main.rimMask * 0.12 + upperRim.rimMask * 0.08;
    } else {
      superellipsoidDirection(direction, 0.80, shapedDirection);
      const topLeft = craterSample(direction, phoebeTopLeft, 0.18, 0.090, 0.012);
      const topRight = craterSample(direction, phoebeTopRight, 0.26, 0.130, 0.018);
      const mid = craterSample(direction, phoebeMidBasin, 0.12, 0.040, 0.008);
      const lower = craterSample(direction, phoebeLowerCraters, 0.15, 0.032, 0.008);
      height += topLeft.height + topRight.height + mid.height + lower.height;
      craterFloor = Math.max(craterFloor, topLeft.floor, topRight.floor, mid.floor, lower.floor);
      craterRim = Math.max(craterRim, topLeft.rimMask, topRight.rimMask, mid.rimMask, lower.rimMask);
      cavityMask = Math.max(topRight.floor, topLeft.floor * 0.92, lower.floor * 0.60);
      const bodyRadius = Math.max(0.58, 1 + height);
      px = shapedDirection.x * bodyRadius * 0.98;
      py = shapedDirection.y * bodyRadius * 1.18;
      pz = shapedDirection.z * bodyRadius * 0.90;
      specialBright = smoothstepValue(direction.x, 0.16, 0.96) * 0.14 + craterRim * 0.08;
    }

    positions.setXYZ(index, px, py, pz);

    const brightness = THREE.MathUtils.clamp(
      (config.kind === "hyperion-reference" || config.kind === "phoebe-reference")
        ? 0.28 + broad * 0.16 + medium * 0.07
        : 0.46 + broad * 0.08 + medium * 0.05,
      0.08,
      (config.kind === "hyperion-reference" || config.kind === "phoebe-reference") ? 0.68 : 0.86,
    );
    colour.copy(base).lerp(light, brightness);

    if (config.kind === "telesto-reference" || config.kind === "calypso-reference" || config.kind === "helene-reference") {
      colour.lerp(light, 0.18 + specialBright * 0.20);
      colour.lerp(dark, cavityMask * 0.34);
    } else if (config.kind === "polydeuces-reference") {
      colour.lerp(light, 0.10 + specialBright * 0.12);
      colour.lerp(dark, craterFloor * 0.28 + cavityMask * 0.24);
    } else if (config.kind === "hyperion-reference") {
      colour.multiplyScalar(0.94 + Math.max(0, medium) * 0.10);
      colour.lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.92 + cavityMask * 0.54, 0, 0.96));
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.14 + specialBright * 0.12, 0, 0.24));
    } else {
      colour.lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.58 + cavityMask * 0.40, 0, 0.96));
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.18 + specialBright * 0.18, 0, 0.34));
    }

    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  source.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source, 1e-5);
  normaliseReferenceGeometry(geometry);
  source.dispose();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: (config.kind === "hyperion-reference" || config.kind === "phoebe-reference") ? 0.98 : 0.90,
    metalness: 0,
    envMapIntensity: 0.016,
    dithering: true,
  });
  material.name = `${profile.name} uploaded-reference 3D surface`;

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.referenceImageSequence = ["Telesto", "Calypso", "Helene", "Polydeuces", "Hyperion", "Phoebe"];
  moon.userData.surfaceEvidence = `${config.evidence}; silhouette and major relief matched to the user-supplied reference image`;
  moon.userData.surfaceStructure = config.structure;
  moon.userData.surfaceRoughness = material.roughness;
  moon.userData.surfaceDetailMode = `uploaded-reference-${config.kind}`;
  moon.userData.referenceMinorMoonState = { profile, quality, config };
  return moon;
}

function createResolvedMinorMoonSurface(profile, quality, config) {
  if (UPLOADED_REFERENCE_KINDS.has(config.kind)) {
    return createUploadedReferenceMoonSurface(profile, quality, config);
  }
  if (ADDITIONAL_REFERENCE_KINDS.has(config.kind)) {
    return createAdditionalReferenceMoonSurface(profile, quality, config);
  }
  if (ADVANCED_REFERENCE_KINDS.has(config.kind)) {
    return createAdvancedReferenceMoonSurface(profile, quality, config);
  }

  const detail = resolvedMinorDetail(config, quality);
  const source = new THREE.IcosahedronGeometry(1, detail);
  const positions = source.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const base = new THREE.Color(config.palette[0]);
  const light = new THREE.Color(config.palette[1]);
  const dark = new THREE.Color(config.palette[2]);
  const colour = new THREE.Color();
  const shape = config.shape ?? profile.shape ?? [1, 1, 1];
  const craters = createReferenceCraterField(profile, config);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 2.0, profile.seed + 4.1);
    const medium = fbm(direction, 6.5, profile.seed + 19.7);
    const fine = fbm(direction, 19.0, profile.seed + 37.2);
    let height = broad * config.roughness + medium * config.roughness * 0.34
      + fine * config.roughness * 0.12;
    let craterFloor = 0;
    let craterRim = 0;

    craters.forEach((crater) => {
      const sample = craterSample(direction, crater.center, crater.radius, crater.depth, crater.rim);
      height += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rimMask);
    });

    if (config.kind === "dust-coated" || config.kind === "trojan-dust") {
      height *= 0.70;
    }

    if (config.kind === "ring-ridge") {
      const equator = Math.exp(-Math.pow(direction.y / config.ridgeWidth, 2));
      const ridgeTexture = 0.82 + 0.18 * fbm(direction, 8.0, profile.seed + 91.2);
      const ridge = config.ridgeHeight * equator * ridgeTexture;
      const radial = 1 + ridge;
      const bodyRadius = Math.max(0.58, 1 + height * 0.70);
      positions.setXYZ(
        index,
        direction.x * bodyRadius * shape[0] * radial,
        direction.y * bodyRadius * shape[1] * (1 - equator * 0.12),
        direction.z * bodyRadius * shape[2] * radial,
      );
    } else {
      if (config.kind === "trojan-flow") {
        const flowHemisphere = smoothstepValue(direction.x, -0.12, 0.82);
        const flowPhase = Math.atan2(direction.z, direction.y) * 14.0
          + direction.x * 8.0 + Math.sin(direction.y * 10.0) * 1.3;
        const gullies = Math.pow(Math.max(0, Math.cos(flowPhase)), 26);
        height += flowHemisphere * gullies * config.grooveStrength;
      } else if (config.grooveStrength) {
        const groovePhase = Math.atan2(direction.z, direction.x) * 10.0
          + direction.y * 12.0 + broad * 2.2;
        const groove = Math.pow(Math.max(0, Math.cos(groovePhase)), 22);
        height += groove * config.grooveStrength * (config.kind === "coorbital-gnarled" ? -1 : 1);
      }

      if (config.kind === "hyperion" || config.kind === "hyperion-reference") {
        const porosity = Math.pow(Math.max(0, fine * 0.5 + 0.5), 5.0);
        height -= porosity * 0.020;
      }

      const radius = Math.max(config.kind === "hyperion" ? 0.50 : 0.60, 1 + height);
      positions.setXYZ(
        index,
        direction.x * radius * shape[0],
        direction.y * radius * shape[1],
        direction.z * radius * shape[2],
      );
    }

    const brightness = THREE.MathUtils.clamp(0.34 + broad * 0.18 + medium * 0.08, 0.08, 0.66);
    colour.copy(base).lerp(light, brightness);

    if (config.kind === "smooth-ellipsoid") {
      colour.lerp(light, 0.22 + Math.max(0, medium) * 0.08);
    }
    if (config.kind === "dust-coated" || config.kind === "trojan-dust" || config.kind === "trojan-flow") {
      colour.lerp(light, 0.14);
      colour.lerp(dark, craterFloor * 0.18);
    } else {
      const floorDarkening = config.kind === "hyperion" ? 0.88 : config.kind === "phoebe" ? 0.52 : 0.44;
      colour.lerp(dark, THREE.MathUtils.clamp(craterFloor * floorDarkening, 0, 0.90));
    }

    if (config.kind === "phoebe") {
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.34 + craterFloor * 0.08, 0, 0.42));
    } else if (config.kind === "hyperion") {
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.18, 0, 0.25));
    } else {
      colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.18, 0, 0.22));
    }

    if (config.kind === "ring-ridge") {
      const ridgeColour = Math.exp(-Math.pow(direction.y / (config.ridgeWidth * 1.28), 2));
      colour.lerp(light, ridgeColour * 0.24);
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

  const moon = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: config.kind === "smooth-ellipsoid" ? 0.82 : 0.96,
      metalness: 0,
      envMapIntensity: config.kind === "smooth-ellipsoid" ? 0.030 : 0.016,
      dithering: true,
    }),
  );
  moon.material.name = `${profile.name} Cassini-reference procedural surface`;
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.surfaceEvidence = config.evidence;
  moon.userData.surfaceStructure = config.structure;
  moon.userData.surfaceRoughness = moon.material.roughness;
  moon.userData.surfaceDetailMode = `reference-driven-${config.kind}`;
  moon.userData.referenceMinorMoonState = { profile, quality, config };
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

  const referenceModel = REFERENCE_MINOR_MOON_MODELS[profile.name];
  if (referenceModel) return createResolvedMinorMoonSurface(profile, quality, referenceModel);

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
    const unresolvedShape = profile.shape ?? [1, 1, 1];
    positions.setXYZ(
      index,
      direction.x * radius * unresolvedShape[0],
      direction.y * radius * unresolvedShape[1],
      direction.z * radius * unresolvedShape[2],
    );

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

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
function irregularReferenceAsset(albedo) {
  return Object.freeze({ albedo });
}

function irregularReferenceAssetSlug(name) {
  return name.toLowerCase().replaceAll("/", "").replaceAll(" ", "-");
}

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
  Ymir: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/saturnian/irregular-reference/ymir-albedo.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/saturnian/irregular-reference/ymir-height.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/saturnian/irregular-reference/ymir-roughness.jpg",
      import.meta.url,
    ).href,
  }),
  Paaliaq: Object.freeze({
    albedo: new URL(
      "../../../../assets/textures/saturnian/irregular-reference/paaliaq-albedo.jpg",
      import.meta.url,
    ).href,
    height: new URL(
      "../../../../assets/textures/saturnian/irregular-reference/paaliaq-height.jpg",
      import.meta.url,
    ).href,
    roughness: new URL(
      "../../../../assets/textures/saturnian/irregular-reference/paaliaq-roughness.jpg",
      import.meta.url,
    ).href,
  }),
  Tarvos: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/tarvos-albedo.jpg",
    import.meta.url,
  ).href),
  Ijiraq: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/ijiraq-albedo.jpg",
    import.meta.url,
  ).href),
  Suttungr: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/suttungr-albedo.jpg",
    import.meta.url,
  ).href),
  Kiviuq: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/kiviuq-albedo.jpg",
    import.meta.url,
  ).href),
  Mundilfari: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/mundilfari-albedo.jpg",
    import.meta.url,
  ).href),
  Albiorix: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/albiorix-albedo.jpg",
    import.meta.url,
  ).href),
  Skathi: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/skathi-albedo.jpg",
    import.meta.url,
  ).href),
  Erriapus: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/erriapus-albedo.jpg",
    import.meta.url,
  ).href),
  Siarnaq: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/siarnaq-albedo.jpg",
    import.meta.url,
  ).href),
  Thrymr: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/thrymr-albedo.jpg",
    import.meta.url,
  ).href),
  Narvi: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/narvi-albedo.jpg",
    import.meta.url,
  ).href),
  Methone: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/methone-albedo.jpg",
    import.meta.url,
  ).href),
  Aegir: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/aegir-albedo.jpg",
    import.meta.url,
  ).href),
  Bebhionn: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/bebhionn-albedo.jpg",
    import.meta.url,
  ).href),
  Bergelmir: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/bergelmir-albedo.jpg",
    import.meta.url,
  ).href),
  Bestla: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/bestla-albedo.jpg",
    import.meta.url,
  ).href),
  Farbauti: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/farbauti-albedo.jpg",
    import.meta.url,
  ).href),
  Fenrir: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/fenrir-albedo.jpg",
    import.meta.url,
  ).href),
  Fornjot: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/fornjot-albedo.jpg",
    import.meta.url,
  ).href),
  Hati: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/hati-albedo.jpg",
    import.meta.url,
  ).href),
  Hyrrokkin: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/hyrrokkin-albedo.jpg",
    import.meta.url,
  ).href),
  Kari: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/kari-albedo.jpg",
    import.meta.url,
  ).href),
  Loge: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/loge-albedo.jpg",
    import.meta.url,
  ).href),
  Skoll: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/skoll-albedo.jpg",
    import.meta.url,
  ).href),
  Surtur: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/surtur-albedo.jpg",
    import.meta.url,
  ).href),
  Jarnsaxa: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/jarnsaxa-albedo.jpg",
    import.meta.url,
  ).href),
  Greip: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/greip-albedo.jpg",
    import.meta.url,
  ).href),
  Tarqeq: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/tarqeq-albedo.jpg",
    import.meta.url,
  ).href),
  Gridr: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/gridr-albedo.jpg",
    import.meta.url,
  ).href),
  Angrboda: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/angrboda-albedo.jpg",
    import.meta.url,
  ).href),
  Skrymir: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/skrymir-albedo.jpg",
    import.meta.url,
  ).href),
  Gerd: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/gerd-albedo.jpg",
    import.meta.url,
  ).href),
  "S/2004 S26": irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/s2004-s26-albedo.jpg",
    import.meta.url,
  ).href),
  Eggther: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/eggther-albedo.jpg",
    import.meta.url,
  ).href),
  "S/2004 S29": irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/s2004-s29-albedo.jpg",
    import.meta.url,
  ).href),
  Beli: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/beli-albedo.jpg",
    import.meta.url,
  ).href),
  "S/2004 S27": irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/s2004-s27-albedo.jpg",
    import.meta.url,
  ).href),
  Gunnlod: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/gunnlod-albedo.jpg",
    import.meta.url,
  ).href),
  Thiazzi: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/thiazzi-albedo.jpg",
    import.meta.url,
  ).href),
  "S/2004 S17": irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/s2004-s17-albedo.jpg",
    import.meta.url,
  ).href),
  Alvaldi: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/alvaldi-albedo.jpg",
    import.meta.url,
  ).href),
  Geirrod: irregularReferenceAsset(new URL(
    "../../../../assets/textures/saturnian/irregular-reference/geirrod-albedo.jpg",
    import.meta.url,
  ).href),
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
    heightMap: assets.height ? loadSaturnianTexture(bodyName, assets.height) : null,
    roughnessMap: assets.roughness ? loadSaturnianTexture(bodyName, assets.roughness) : null,
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
  if (!position || !uv) return;

  const seamPairs = [];
  const widthSegments = geometry.parameters?.widthSegments;
  const heightSegments = geometry.parameters?.heightSegments;
  const expectedVertexCount = Number.isInteger(widthSegments)
    && Number.isInteger(heightSegments)
    ? (widthSegments + 1) * (heightSegments + 1)
    : -1;

  if (expectedVertexCount === position.count) {
    // SphereGeometry stores one duplicated vertex at u=0 and u=1 for every
    // latitude row. Pairing by the known grid layout is exact and remains
    // reliable even after strong crater/silhouette deformation.
    for (let row = 0; row <= heightSegments; row += 1) {
      const rowStart = row * (widthSegments + 1);
      seamPairs.push([rowStart, rowStart + widthSegments]);
    }
  } else {
    // Conservative fallback for sphere-derived geometries whose parameters
    // were stripped. Pair boundary vertices by their shared UV latitude,
    // never by their deformed 3D position.
    const pairsByLatitude = new Map();
    const precision = 1000000;
    for (let index = 0; index < position.count; index += 1) {
      const u = uv.getX(index);
      if (u > 1e-4 && u < 1 - 1e-4) continue;
      const key = Math.round(uv.getY(index) * precision);
      const pair = pairsByLatitude.get(key) ?? [-1, -1];
      pair[u < 0.5 ? 0 : 1] = index;
      pairsByLatitude.set(key, pair);
    }
    pairsByLatitude.forEach(([a, b]) => {
      if (a >= 0 && b >= 0) seamPairs.push([a, b]);
    });
  }

  // First make both sides of the UV cut occupy the exact same position. This
  // seals the volume before normals are regenerated, preventing stars,
  // orbit lines, or other moons from showing through a sub-pixel opening.
  seamPairs.forEach(([a, b]) => {
    const x = (position.getX(a) + position.getX(b)) * 0.5;
    const y = (position.getY(a) + position.getY(b)) * 0.5;
    const z = (position.getZ(a) + position.getZ(b)) * 0.5;
    position.setXYZ(a, x, y, z);
    position.setXYZ(b, x, y, z);
  });
  position.needsUpdate = true;

  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();

  // The duplicated columns still need a shared normal so the welded line
  // cannot appear as a false bright/dark lighting crack.
  const normal = geometry.getAttribute("normal");
  const averaged = new THREE.Vector3();
  seamPairs.forEach(([a, b]) => {
    averaged.set(
      normal.getX(a) + normal.getX(b),
      normal.getY(a) + normal.getY(b),
      normal.getZ(a) + normal.getZ(b),
    ).normalize();
    normal.setXYZ(a, averaged.x, averaged.y, averaged.z);
    normal.setXYZ(b, averaged.x, averaged.y, averaged.z);
  });
  normal.needsUpdate = true;
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
  const maps = getSaturnianSurfaceMaps(profile.name);
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
    map: config.kind === "methone-reference" ? maps?.albedoMap ?? null : null,
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
  if (config.kind === "methone-reference") {
    moon.userData.referenceSourceAsset = "assets/textures/saturnian/irregular-reference/methone-reference-source.png";
  }
  moon.userData.referenceMinorMoonState = { profile, quality, config, maps };
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

/**
 * Ymir reference reconstruction
 * -----------------------------
 * The supplied PNG contains a transparent, high-detail silhouette rather than
 * a global spacecraft map. Its alpha contour is sampled below as a compact
 * latitude loft: every row stores the centre and half-width of the visible
 * body, so the front/back silhouette follows the reference instead of merely
 * stretching a generic asteroid sphere. The accompanying 2:1 maps are cleaned,
 * de-lit and mirrored seamlessly from the same image so Three.js lighting can
 * still move naturally across the final object.
 */
const YMIR_REFERENCE_ASPECT = 0.845703125;

const YMIR_SILHOUETTE_CENTRE = Object.freeze([
  -0.30130, -0.30593, -0.30816, -0.30954, -0.30873, -0.30690, -0.30522, -0.30358,
  -0.30249, -0.30072, -0.29851, -0.29519, -0.29036, -0.28244, -0.27447, -0.26430,
  -0.24312, -0.17809, -0.12320, -0.09141, -0.07390, -0.06352, -0.06189, -0.05961,
  -0.05456, -0.04567, -0.03426, -0.03133, -0.03079, -0.02965, -0.02862, -0.02452,
  -0.01810, -0.01356, -0.01354, -0.01245, -0.01026, -0.00755, -0.00495, -0.00402,
  -0.00312, -0.00136, -0.00083, -0.00064, 0.00154, 0.00336, 0.00317, 0.00487,
  0.00563, 0.00813, 0.00799, 0.00703, 0.00290, -0.00397, -0.00986, -0.00572,
  0.00039, 0.00509, 0.01807, 0.02932, 0.03364, 0.03897, 0.04481, 0.04907,
  0.05518, 0.06238, 0.06912, 0.07680, 0.08081, 0.08037, 0.08094, 0.08469,
  0.08853, 0.09325, 0.09909, 0.10594, 0.11561, 0.12168, 0.12614, 0.12826,
  0.13306, 0.14299, 0.14402, 0.13993, 0.13723, 0.14878, 0.15930, 0.15736,
  0.16087, 0.15899, 0.15614, 0.14705, 0.14054, 0.13329, 0.11138, 0.10980,
]);

const YMIR_SILHOUETTE_HALF_WIDTH = Object.freeze([
  0.00000, 0.11270, 0.16225, 0.20534, 0.24258, 0.27414, 0.30170, 0.32749,
  0.35216, 0.37631, 0.39990, 0.42137, 0.44236, 0.46774, 0.49113, 0.51520,
  0.55124, 0.63137, 0.70089, 0.74682, 0.77859, 0.80270, 0.81659, 0.82886,
  0.84267, 0.86096, 0.88093, 0.89297, 0.90230, 0.91045, 0.92001, 0.92990,
  0.94083, 0.95048, 0.95788, 0.96651, 0.97325, 0.97934, 0.98595, 0.99151,
  0.99664, 0.99861, 0.99778, 0.99690, 0.99663, 0.99615, 0.99210, 0.98911,
  0.98808, 0.98775, 0.98551, 0.98171, 0.97479, 0.96498, 0.95421, 0.95153,
  0.95107, 0.94874, 0.95228, 0.95453, 0.95635, 0.95574, 0.94983, 0.94004,
  0.93228, 0.93053, 0.92658, 0.92058, 0.91288, 0.89808, 0.88208, 0.86370,
  0.85360, 0.84535, 0.83661, 0.82490, 0.80946, 0.79694, 0.78410, 0.76695,
  0.74461, 0.72519, 0.69335, 0.63652, 0.59209, 0.55723, 0.52201, 0.46974,
  0.41903, 0.36980, 0.32665, 0.27586, 0.22525, 0.17755, 0.11079, 0.00000,
]);

function sampleYmirSilhouette(values, latitudeT) {
  const scaled = THREE.MathUtils.clamp(latitudeT, 0, 1) * (values.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(values.length - 1, lower + 1);
  return THREE.MathUtils.lerp(values[lower], values[upper], scaled - lower);
}

function ymirGeometrySegments(quality) {
  if (quality === "low") return [88, 60];
  if (quality === "medium") return [136, 92];
  return [192, 128];
}

function createYmirReferenceSurface(profile, quality) {
  const maps = getSaturnianSurfaceMaps("Ymir");
  const [widthSegments, heightSegments] = ymirGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  const leftCrown = new THREE.Vector3(-0.38, 0.58, 0.72).normalize();
  const upperSaddle = new THREE.Vector3(0.28, 0.48, 0.83).normalize();
  const rightLobe = new THREE.Vector3(0.67, 0.13, 0.73).normalize();
  const lowerFront = new THREE.Vector3(-0.04, -0.55, 0.84).normalize();
  const rightBasin = new THREE.Vector3(0.53, -0.05, 0.85).normalize();

  const craterCount = quality === "low" ? 22 : quality === "medium" ? 38 : 58;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.028,
    maxRadius: 0.145,
    minDepth: 0.0035,
    maxDepth: 0.026,
    seedOffset: 319.4,
  });
  craters.push(
    { center: rightBasin, radius: 0.245, depth: 0.050, rim: 0.0065 },
    { center: lowerFront, radius: 0.205, depth: 0.038, rim: 0.0045 },
    {
      center: new THREE.Vector3(-0.62, -0.12, 0.78).normalize(),
      radius: 0.165,
      depth: 0.026,
      rim: 0.0035,
    },
  );

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    const latitudeT = THREE.MathUtils.clamp((1 - direction.y) * 0.5, 0, 1);
    const sinTheta = Math.sqrt(Math.max(1e-8, 1 - direction.y * direction.y));
    const longitudeCos = sinTheta > 1e-5 ? direction.x / sinTheta : 0;
    const longitudeSin = sinTheta > 1e-5 ? direction.z / sinTheta : 0;

    let centreX = sampleYmirSilhouette(YMIR_SILHOUETTE_CENTRE, latitudeT);
    let halfWidth = sampleYmirSilhouette(YMIR_SILHOUETTE_HALF_WIDTH, latitudeT);
    let y = (1 - latitudeT * 2) * YMIR_REFERENCE_ASPECT;

    const crownMask = gaussianSurfaceMask(direction, leftCrown, 0.58);
    const saddleMask = gaussianSurfaceMask(direction, upperSaddle, 0.43);
    const rightLobeMask = gaussianSurfaceMask(direction, rightLobe, 0.52);
    const lowerMask = smoothstepValue(-direction.y, -0.04, 0.84);
    const upperMask = smoothstepValue(direction.y, 0.10, 0.78);
    const frontness = Math.abs(longitudeSin);
    const edgePreservation = 0.22 + frontness * 0.78;

    const broad = fbm(direction, 2.25, profile.seed + 71.3);
    const medium = fbm(direction, 7.8, profile.seed + 113.7);
    const fine = fbm(direction, 23.0, profile.seed + 181.9);
    const brokenBand = Math.exp(-Math.pow((direction.y + 0.18) / 0.24, 2));

    let relief = broad * THREE.MathUtils.lerp(0.040, 0.020, upperMask);
    relief += medium * THREE.MathUtils.lerp(0.017, 0.008, upperMask);
    relief += fine * THREE.MathUtils.lerp(0.0060, 0.0025, upperMask);
    relief += brokenBand * medium * 0.011;

    craters.forEach((crater) => {
      relief += craterSample(
        direction,
        crater.center,
        crater.radius,
        crater.depth,
        crater.rim,
      ).height;
    });

    relief *= edgePreservation;
    centreX += broad * 0.009 * (0.35 + lowerMask * 0.65);
    halfWidth *= Math.max(0.72, 1 + relief);

    // The reference is visibly smoother across the crown and increasingly
    // broken below the mid-body scarp. Keep this in geometry so the body still
    // reads correctly even before the image maps finish loading.
    y += relief * direction.y * 0.42;
    y += crownMask * 0.018 - saddleMask * 0.024;

    let depth = halfWidth * (0.68 + lowerMask * 0.055);
    depth *= 1 + crownMask * 0.075 + rightLobeMask * 0.095;
    depth *= 1 - saddleMask * 0.155;
    depth *= Math.max(0.70, 1 + relief * 1.32);

    // Slight front/back imbalance prevents the loft from looking like a flat
    // extruded cut-out while retaining the supplied front silhouette.
    const rearBias = longitudeSin < 0 ? 0.965 : 1.025;
    depth *= rearBias;

    positions.setXYZ(
      index,
      centreX + longitudeCos * halfWidth,
      y,
      longitudeSin * depth,
    );
  }

  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  smoothSphereUvSeamNormals(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.025 : quality === "medium" ? 0.043 : 0.058,
    roughness: 0.93,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.018,
    dithering: true,
  });
  material.name = "Ymir user-reference seamless mapped surface";

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceEvidence = "User-supplied alpha silhouette and surface image with NASA-constrained physical metadata";
  moon.userData.surfaceStructure = "Reference-lofted asymmetric body with a rounded left crown, upper saddle, smaller right lobe, and rugged lower scarp";
  moon.userData.surfaceRoughness = 0.93;
  moon.userData.surfaceDetailMode = "user-reference-silhouette-loft-with-seamless-derived-wrap";
  moon.userData.referenceSourceAsset = "assets/textures/saturnian/irregular-reference/ymir-reference-source.png";
  moon.userData.ymirSurfaceState = { profile, quality, maps };
  return moon;
}

/**
 * Paaliaq reference reconstruction
 * --------------------------------
 * The supplied frame is used for surface colour and broad visual proportions,
 * but not as a literal extruded silhouette. A closed, compact ellipsoid volume
 * is sculpted instead so Paaliaq remains asteroid-like from every viewing angle.
 */
function paaliaqGeometrySegments(quality) {
  if (quality === "low") return [84, 60];
  if (quality === "medium") return [132, 92];
  return [184, 128];
}

function createPaaliaqReferenceSurface(profile, quality) {
  const maps = getSaturnianSurfaceMaps("Paaliaq");
  const [widthSegments, heightSegments] = paaliaqGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  // Paaliaq should read as one compact asteroid-like mass from every angle.
  // The earlier latitude-loft copied narrow rows from the reference frame and
  // produced a tall bird-like spike when the moon rotated. This version instead
  // sculpts a closed ellipsoid volume: broad on the left and gradually tapered
  // towards the right, matching the reference without extruding its 2D outline.
  const leftShoulder = new THREE.Vector3(-0.78, 0.16, 0.60).normalize();
  const upperPlateau = new THREE.Vector3(-0.18, 0.74, 0.64).normalize();
  const rightSnout = new THREE.Vector3(0.90, -0.04, 0.43).normalize();
  const lowerBelly = new THREE.Vector3(-0.18, -0.78, 0.52).normalize();
  const upperRightBasin = new THREE.Vector3(0.34, 0.52, 0.79).normalize();
  const leftFaceBasin = new THREE.Vector3(-0.54, 0.04, 0.84).normalize();

  const craterCount = quality === "low" ? 20 : quality === "medium" ? 34 : 52;
  const craters = createMappedCraterField(profile, craterCount, {
    minRadius: 0.024,
    maxRadius: 0.118,
    minDepth: 0.0028,
    maxDepth: 0.017,
    seedOffset: 371.8,
  });
  craters.push(
    { center: upperRightBasin, radius: 0.155, depth: 0.018, rim: 0.0033 },
    { center: leftFaceBasin, radius: 0.128, depth: 0.014, rim: 0.0028 },
    {
      center: new THREE.Vector3(0.58, -0.24, 0.78).normalize(),
      radius: 0.092,
      depth: 0.010,
      rim: 0.0022,
    },
  );

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    const x = direction.x;
    const rightward = smoothstepValue(x, -0.18, 0.96);
    const leftward = smoothstepValue(-x, -0.16, 0.98);
    const leftShoulderMask = gaussianSurfaceMask(direction, leftShoulder, 0.72);
    const upperPlateauMask = gaussianSurfaceMask(direction, upperPlateau, 0.56);
    const rightSnoutMask = gaussianSurfaceMask(direction, rightSnout, 0.46);
    const lowerBellyMask = gaussianSurfaceMask(direction, lowerBelly, 0.60);

    const broad = fbm(direction, 2.15, profile.seed + 61.1);
    const medium = fbm(direction, 7.4, profile.seed + 91.7);
    const fine = fbm(direction, 22.0, profile.seed + 153.6);
    const upperBrokenBand = Math.exp(-Math.pow((direction.y - 0.48) / 0.20, 2));
    const undersideBand = Math.exp(-Math.pow((direction.y + 0.48) / 0.28, 2));

    let relief = broad * 0.041;
    relief += medium * 0.014;
    relief += fine * 0.0048;
    relief += upperBrokenBand * medium * 0.0070;
    relief += undersideBand * medium * 0.0045;

    craters.forEach((crater) => {
      relief += craterSample(
        direction,
        crater.center,
        crater.radius,
        crater.depth,
        crater.rim,
      ).height;
    });

    // Cross-sections shrink smoothly towards the right-hand tip. The values
    // are deliberately restrained so no viewing angle can reveal a thin spike.
    const taper = THREE.MathUtils.lerp(1.04, 0.72, rightward);
    const leftBulk = 1 + leftward * 0.035 + leftShoulderMask * 0.075;
    const crownShape = 1 + upperPlateauMask * 0.035;
    const bellyShape = 1 + lowerBellyMask * 0.045;
    const snoutShape = 1 - rightSnoutMask * 0.055;
    const localRadius = Math.max(
      0.78,
      (1 + relief) * leftBulk * crownShape * bellyShape * snoutShape,
    );

    const xAxis = 1.20;
    const yAxis = 0.82 * taper;
    const zAxis = 0.74 * THREE.MathUtils.lerp(1.02, 0.78, rightward);

    // A mild centreline bend gives the object the reference's uneven potato
    // profile without ever copying the image's narrow top contour literally.
    const centrelineY = -0.055 * x + 0.028 * Math.sin((x + 0.22) * Math.PI);
    const centrelineZ = 0.025 * Math.sin((x - 0.10) * Math.PI * 1.35);

    let px = direction.x * xAxis * localRadius;
    let py = direction.y * yAxis * localRadius + centrelineY;
    let pz = direction.z * zAxis * localRadius + centrelineZ;

    // Keep the left end broad and rounded, while extending only a compact right
    // snout. These are smooth volumetric adjustments rather than protrusions.
    px -= leftShoulderMask * 0.045;
    px += rightSnoutMask * 0.040;
    py += upperPlateauMask * 0.018;
    py -= lowerBellyMask * 0.016;

    positions.setXYZ(index, px, py, pz);
  }

  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  smoothSphereUvSeamNormals(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    bumpMap: maps?.heightMap ?? null,
    bumpScale: quality === "low" ? 0.018 : quality === "medium" ? 0.030 : 0.042,
    roughness: 0.92,
    roughnessMap: maps?.roughnessMap ?? null,
    metalness: 0,
    envMapIntensity: 0.016,
    dithering: true,
  });
  material.name = "Paaliaq compact reference-sculpted mapped surface";

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceEvidence = "User-supplied surface reference with published Paaliaq orbital and size constraints";
  moon.userData.surfaceStructure = "Compact elongated irregular body with a broad rounded left shoulder, subdued broken crown, gently tapered right snout, and rounded underside";
  moon.userData.surfaceRoughness = 0.92;
  moon.userData.surfaceDetailMode = "user-reference-volumetric-sculpt-with-seamless-derived-wrap";
  moon.userData.referenceSourceAsset = "assets/textures/saturnian/irregular-reference/paaliaq-reference-source.png";
  moon.userData.paaliaqSurfaceState = { profile, quality, maps };
  return moon;
}

/**
 * User-reference reconstructions for unresolved irregular moons.
 *
 * The supplied pictures are visual concepts rather than spacecraft global
 * maps. Their cleaned colour is therefore used as an artistic albedo wrap,
 * while the actual volume, craters, ridges, and silhouette are rebuilt in
 * geometry. This keeps the bodies convincingly three-dimensional from every
 * camera angle and lets Saturn-system sunlight produce the day/night divide.
 */
const IRREGULAR_REFERENCE_MODELS = Object.freeze({
  Tarvos: Object.freeze({
    kind: "broken-wedge",
    axes: [1.12, 0.86, 0.88],
    roughness: 0.95,
    craterCount: 34,
    craterDepth: [0.010, 0.040],
    structure: "Rounded wedge with a broad face, rough broken crown, pitted regolith, and many restrained impact craters",
  }),
  Ijiraq: Object.freeze({
    kind: "flattened-potato",
    axes: [1.24, 0.72, 0.88],
    roughness: 0.94,
    craterCount: 30,
    craterDepth: [0.009, 0.037],
    structure: "Flattened elongated potato body with worn bowls, granular plains, and battered cratered margins",
  }),
  Suttungr: Object.freeze({
    kind: "oblate-dome",
    axes: [1.08, 0.74, 0.92],
    roughness: 0.96,
    craterCount: 27,
    craterDepth: [0.010, 0.040],
    structure: "Compact oblate cap with a rounded crown, subtly flattened underside, dark mineral patches, and eroded craters",
  }),
  Kiviuq: Object.freeze({
    kind: "offset-heart",
    axes: [1.00, 1.05, 0.84],
    roughness: 0.95,
    craterCount: 34,
    craterDepth: [0.010, 0.043],
    structure: "Asymmetric pear-and-heart-shaped mass with uneven upper lobes, a shallow notch, scarred flanks, and small craters",
  }),
  Mundilfari: Object.freeze({
    kind: "twin-shoulder",
    axes: [0.90, 1.18, 0.80],
    roughness: 0.98,
    craterCount: 24,
    craterDepth: [0.008, 0.034],
    structure: "Tall rubble body with two unequal crown shoulders, a shallow saddle, dense fluted wrinkles, pits, and worn craters",
  }),
  Albiorix: Object.freeze({
    kind: "contact-lobes",
    axes: [0.96, 1.06, 0.84],
    roughness: 0.93,
    craterCount: 38,
    craterDepth: [0.010, 0.044],
    structure: "Asymmetric contact-like body with a massive rounded lower lobe, pinched saddle, raised upper-right lobe, and cratered regolith",
  }),
  Skathi: Object.freeze({
    kind: "broken-egg",
    axes: [1.02, 1.08, 0.88],
    roughness: 0.96,
    craterCount: 34,
    craterDepth: [0.010, 0.043],
    structure: "Pale irregular egg-and-wedge body with a battered crown, dusty plains, pits, and worn impact craters",
  }),
  Erriapus: Object.freeze({
    kind: "sloped-boulder",
    axes: [1.10, 0.92, 0.88],
    roughness: 0.95,
    craterCount: 31,
    craterDepth: [0.009, 0.040],
    structure: "Sloped compact boulder with a pale rounded crown, broad smoother face, broken flank, pits, and shallow basins",
  }),
  Siarnaq: Object.freeze({
    kind: "cratered-globe",
    axes: [1.02, 1.00, 0.96],
    roughness: 0.94,
    craterCount: 48,
    craterDepth: [0.009, 0.045],
    structure: "Large nearly round lavender-gray body with subtly flattened poles, dark cratered highlands, overlapping basins, and dense pitting",
  }),
  Thrymr: Object.freeze({
    kind: "ring-basin-pebble",
    axes: [1.03, 0.98, 0.94],
    roughness: 0.94,
    craterCount: 24,
    craterDepth: [0.007, 0.031],
    structure: "Compact pale rounded pebble with restrained facets, fine pits, worn small craters, and one broad ringed basin",
  }),
  Narvi: Object.freeze({
    kind: "basin-block",
    axes: [1.08, 0.98, 0.90],
    roughness: 0.97,
    craterCount: 36,
    craterDepth: [0.011, 0.048],
    structure: "Blocky silver-gray boulder with a broken scarp, rounded shoulder, deep front basin, fractured ridges, and many pits",
  }),
  Aegir: Object.freeze({
    kind: "jagged-tower",
    axes: [0.88, 1.22, 0.80],
    roughness: 0.99,
    craterCount: 42,
    craterDepth: [0.014, 0.060],
    structure: "Tall jagged rubble shard with a narrower base, broken crown, sharp scarps, deep cavities, and dense pitting",
  }),
  Bebhionn: Object.freeze({
    kind: "squat-boulder",
    axes: [1.20, 0.78, 0.92],
    roughness: 0.93,
    craterCount: 14,
    craterDepth: [0.004, 0.020],
    structure: "Squat light-gray rounded block with a broad oval face, flattened underside, shallow crown groove, marbling, and sparse pits",
  }),
  Bergelmir: Object.freeze({
    kind: "eroded-wedge",
    axes: [0.92, 1.12, 0.78],
    roughness: 0.98,
    craterCount: 58,
    craterDepth: [0.014, 0.064],
    structure: "Bright eroded wedge-like body with an irregular bitten flank, dense overlapping crater bowls, deep floors, and shattered scarps",
  }),
  Bestla: Object.freeze({
    kind: "cavern-rubble",
    axes: [0.90, 1.12, 0.82],
    roughness: 0.99,
    craterCount: 48,
    craterDepth: [0.014, 0.060],
    structure: "Dark upright porous rubble body with an uneven crown, three immense cavern-like impact bowls, pale eroded rims, and dense pitting",
  }),
  Farbauti: Object.freeze({
    kind: "dark-contact-pebble",
    axes: [1.12, 0.88, 0.82],
    roughness: 0.98,
    craterCount: 25,
    craterDepth: [0.008, 0.034],
    structure: "Charcoal double-lobed pebble with a restrained waist, uneven shoulders, dusty ripples, and subdued impact pits",
  }),
  Fenrir: Object.freeze({
    kind: "mottled-crater-globe",
    axes: [1.01, 1.00, 0.97],
    roughness: 0.95,
    craterCount: 54,
    craterDepth: [0.010, 0.048],
    structure: "Near-spherical high-contrast cratered moon with overlapping bright highlands, dark basins, worn rims, and dense small impacts",
  }),
  Fornjot: Object.freeze({
    kind: "raised-shoulder-block",
    axes: [0.92, 1.16, 0.82],
    roughness: 0.98,
    craterCount: 27,
    craterDepth: [0.009, 0.038],
    structure: "Tall graphite block with a broad rounded face, raised upper shoulder, subtle waist, fine wrinkles, and worn pits",
  }),
  Hati: Object.freeze({
    kind: "flat-slab",
    axes: [1.12, 0.98, 0.72],
    roughness: 0.97,
    craterCount: 31,
    craterDepth: [0.009, 0.041],
    structure: "Flattened cool-gray slab with a clipped crown, thick rounded lower mass, dense fine ripples, and shallow crater scars",
  }),
  Hyrrokkin: Object.freeze({
    kind: "rust-basin-globe",
    axes: [1.02, 1.00, 0.93],
    roughness: 0.97,
    craterCount: 56,
    craterDepth: [0.012, 0.055],
    structure: "Rust-red battered globe with two dominant deep basins, broken scarps, overlapping bowls, and iron-dark crater floors",
  }),
  Kari: Object.freeze({
    kind: "pale-rounded-boulder",
    axes: [1.15, 0.90, 0.96],
    roughness: 0.90,
    craterCount: 18,
    craterDepth: [0.004, 0.021],
    structure: "Pale softly rounded pebble with a broad smooth crown, gently flattened base, faint mottling, and sparse shallow pits",
  }),
  Loge: Object.freeze({
    kind: "twin-basin-lobe",
    axes: [1.12, 0.92, 0.86],
    roughness: 0.96,
    craterCount: 35,
    craterDepth: [0.009, 0.043],
    structure: "Pale asymmetric oval moon with a slightly pinched lobe, two major bowl-shaped basins, worn ejecta, and many smaller pits",
  }),
  Skoll: Object.freeze({
    kind: "dark-twin-block",
    axes: [1.08, 1.04, 0.82],
    roughness: 0.99,
    craterCount: 25,
    craterDepth: [0.008, 0.034],
    structure: "Near-black twin-shouldered block with a deep central furrow, fluted regolith, worn ridges, pits, and shallow impact bowls",
  }),
  Surtur: Object.freeze({
    kind: "leaning-dark-boulder",
    axes: [0.92, 1.15, 0.82],
    roughness: 0.98,
    craterCount: 24,
    craterDepth: [0.008, 0.033],
    structure: "Dark leaning boulder with an asymmetric crown, broad worn panels, wrinkled terrain, pale scuffs, and shallow pits",
  }),
  Jarnsaxa: Object.freeze({
    kind: "ivory-rounded-globe",
    axes: [1.02, 1.00, 0.96],
    roughness: 0.94,
    craterCount: 46,
    craterDepth: [0.008, 0.041],
    structure: "Warm ivory rounded globe with a subtly polygonal outline, dusty plains, fine fractures, dark battered highlands, and many small craters",
  }),
  Greip: Object.freeze({
    kind: "granular-diamond",
    axes: [1.04, 1.02, 0.84],
    roughness: 0.99,
    craterCount: 38,
    craterDepth: [0.010, 0.046],
    structure: "Dark granular diamond-shaped rubble body with a broad side basin, coarse regolith, pebble-like relief, scarps, and dense pitting",
  }),
  Tarqeq: Object.freeze({
    kind: "face-stone",
    axes: [0.88, 1.15, 0.84],
    roughness: 0.94,
    craterCount: 18,
    craterDepth: [0.006, 0.026],
    structure: "Warm ochre upright stone with geological brow ridges, closed-eye grooves, a central nose-like ridge, cheek bulges, and a shallow mouth-like basin",
  }),
  Gridr: Object.freeze({
    kind: "rust-contact-rock",
    axes: [1.26, 0.72, 0.82],
    roughness: 0.97,
    craterCount: 46,
    craterDepth: [0.010, 0.047],
    structure: "Iron-red elongated contact-like rock with a small blunt head, broad rear mass, dusty scarps, overlapping bowls, and dense shallow craters",
  }),
  Angrboda: Object.freeze({
    kind: "green-wedge",
    axes: [1.18, 0.82, 0.86],
    roughness: 0.95,
    craterCount: 28,
    craterDepth: [0.008, 0.036],
    structure: "Gray-green mineral wedge with a tapered snout, raised shoulder, mottled dusty regolith, shallow bowls, and battered ridges",
  }),
  Skrymir: Object.freeze({
    kind: "dark-angular-column",
    axes: [0.86, 1.17, 0.82],
    roughness: 0.98,
    craterCount: 20,
    craterDepth: [0.007, 0.030],
    structure: "Dark angular upright column with an asymmetric waist, clipped planes, blue-gray dust, shallow scars, and sparse pits",
  }),
  Gerd: Object.freeze({
    kind: "silver-heart",
    axes: [1.02, 1.10, 0.86],
    roughness: 0.92,
    craterCount: 18,
    craterDepth: [0.005, 0.025],
    structure: "Silver-gray heart-like boulder with twin upper lobes, a soft central notch, cloudy mottling, and restrained shallow pitting",
  }),
  "S/2004 S26": Object.freeze({
    kind: "scarred-crater-globe",
    axes: [1.01, 1.00, 0.97],
    roughness: 0.98,
    craterCount: 62,
    craterDepth: [0.011, 0.054],
    structure: "Near-round ancient body with a heavily scarred crater field, broad trench-like scarp belt, pitted highlands, and dark compacted floors",
  }),
  Eggther: Object.freeze({
    kind: "broken-bowl",
    axes: [1.16, 0.75, 0.88],
    roughness: 0.96,
    craterCount: 44,
    craterDepth: [0.012, 0.052],
    structure: "Pale closed bowl-like body with a scalloped crown, broken-looking but sealed scarps, deep impact bowls, bright rims, and dense small pits",
  }),
  "S/2004 S29": Object.freeze({
    kind: "basin-shard",
    axes: [1.08, 0.82, 0.84],
    roughness: 0.97,
    craterCount: 50,
    craterDepth: [0.012, 0.056],
    structure: "Pale irregular basin shard with a blunt end, one dominant shadowed bowl, a battered crown, scattered crater rims, and compact gray regolith",
  }),
  Beli: Object.freeze({
    kind: "dark-waist-lobes",
    axes: [1.18, 0.88, 0.84],
    roughness: 0.98,
    craterCount: 24,
    craterDepth: [0.008, 0.034],
    structure: "Dark brown double-lobed body with a broad waist groove, worn fluted terrain, uneven shoulders, dust patches, and shallow pits",
  }),
  "S/2004 S27": Object.freeze({
    kind: "pale-oblate-dome",
    axes: [1.12, 0.78, 0.98],
    roughness: 0.88,
    craterCount: 12,
    craterDepth: [0.003, 0.014],
    structure: "Very pale smooth oblate dome with powdery ice regolith, a gently flattened underside, subtle mottling, and sparse shallow pits",
  }),
  Gunnlod: Object.freeze({
    kind: "bright-broken-block",
    axes: [1.08, 1.00, 0.84],
    roughness: 0.96,
    craterCount: 52,
    craterDepth: [0.012, 0.058],
    structure: "Bright rounded block with a deeply cut but sealed lower scarp, densely pitted ice-rock, dark crater floors, and chipped pale rims",
  }),
  Thiazzi: Object.freeze({
    kind: "dark-triangular-shard",
    axes: [1.16, 0.88, 0.78],
    roughness: 0.98,
    craterCount: 20,
    craterDepth: [0.007, 0.030],
    structure: "Dark triangular shard with clipped planes, a high angular crown, graphite regolith, silvery abrasion, and sparse shallow pits",
  }),
  "S/2004 S17": Object.freeze({
    kind: "quiet-crater-globe",
    axes: [1.01, 1.00, 0.98],
    roughness: 0.92,
    craterCount: 30,
    craterDepth: [0.006, 0.030],
    structure: "Quiet near-spherical gray moon with soft dusty mottling, sparse medium craters, numerous tiny pits, and gently worn plains",
  }),
  Alvaldi: Object.freeze({
    kind: "olive-crown-block",
    axes: [1.10, 0.98, 0.84],
    roughness: 0.95,
    craterCount: 24,
    craterDepth: [0.007, 0.033],
    structure: "Muted olive block with two raised crown shoulders, a soft notch, dusty mineral mottling, worn ridges, and scattered shallow pits",
  }),
  Geirrod: Object.freeze({
    kind: "pale-battered-wedge",
    axes: [1.08, 0.92, 0.80],
    roughness: 0.97,
    craterCount: 48,
    craterDepth: [0.012, 0.057],
    structure: "Pale battered wedge with dense impact pitting, three prominent deep bowls, near-black floors, bright rims, scarps, and rusty stains",
  }),
});

function irregularReferenceGeometrySegments(quality) {
  if (quality === "low") return [64, 44];
  if (quality === "medium") return [104, 72];
  return [144, 100];
}

function createIrregularReferenceSurface(profile, quality, config) {
  const maps = getSaturnianSurfaceMaps(profile.name);
  const [widthSegments, heightSegments] = irregularReferenceGeometrySegments(quality);
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.getAttribute("position");
  const direction = new THREE.Vector3();

  const craters = createMappedCraterField(profile, config.craterCount, {
    minRadius: 0.025,
    maxRadius: 0.145,
    minDepth: config.craterDepth[0],
    maxDepth: config.craterDepth[1],
    seedOffset: 601.7,
  });

  // Stable feature directions keep the recognizable outline in the initial
  // inspection view while still producing a closed volume from every angle.
  const tarvosCrown = directionFromLatLon(58, -18);
  const tarvosBrokenEdge = directionFromLatLon(42, 132);
  const kiviuqLeftLobe = directionFromLatLon(38, 142);
  const kiviuqRightLobe = directionFromLatLon(26, 34);
  const kiviuqNotch = directionFromLatLon(68, 82);
  const mundilfariLeftShoulder = directionFromLatLon(54, 148);
  const mundilfariRightShoulder = directionFromLatLon(60, 28);
  const mundilfariSaddle = directionFromLatLon(72, 88);
  const albiorixMainLobe = directionFromLatLon(-28, 148);
  const albiorixRaisedLobe = directionFromLatLon(48, 24);
  const albiorixSaddle = directionFromLatLon(20, 82);
  const skathiCrown = directionFromLatLon(58, -24);
  const skathiBrokenSide = directionFromLatLon(28, 142);
  const erriapusCrown = directionFromLatLon(48, -28);
  const erriapusBrokenFlank = directionFromLatLon(-8, 148);
  const siarnaqBasin = directionFromLatLon(16, -24);
  const thrymrBasin = directionFromLatLon(30, -18);
  const narviBasin = directionFromLatLon(-8, -20);
  const narviScarp = directionFromLatLon(34, 138);
  const aegirCavity = directionFromLatLon(-28, -18);
  const aegirBrokenCrown = directionFromLatLon(62, 118);
  const bebhionnGroove = directionFromLatLon(54, -12);
  const bergelmirBite = directionFromLatLon(8, -38);
  const bergelmirBasin = directionFromLatLon(-12, -22);
  const bestlaUpperCavity = directionFromLatLon(34, -26);
  const bestlaLowerCavity = directionFromLatLon(-22, -16);
  const bestlaSideCavity = directionFromLatLon(4, 34);
  const farbautiLeftLobe = directionFromLatLon(-8, 150);
  const farbautiRightLobe = directionFromLatLon(16, 18);
  const farbautiWaist = directionFromLatLon(8, 84);
  const fenrirLargeBasin = directionFromLatLon(20, -28);
  const fenrirDarkBasin = directionFromLatLon(-18, 42);
  const fornjotShoulder = directionFromLatLon(54, 24);
  const fornjotNotch = directionFromLatLon(42, 104);
  const hatiBrokenCrown = directionFromLatLon(52, 118);
  const hyrrokkinMainBasin = directionFromLatLon(18, -24);
  const hyrrokkinLowerBasin = directionFromLatLon(-34, -42);
  const kariCrown = directionFromLatLon(38, -20);
  const logeLeftBasin = directionFromLatLon(4, -42);
  const logeRightBasin = directionFromLatLon(12, 28);
  const logePinch = directionFromLatLon(34, 92);
  const skollLeftShoulder = directionFromLatLon(38, -34);
  const skollRightShoulder = directionFromLatLon(42, 30);
  const skollFurrow = directionFromLatLon(20, 0);
  const surturCrown = directionFromLatLon(58, 24);
  const surturRecess = directionFromLatLon(-10, -142);
  const greipBasin = directionFromLatLon(4, -28);
  // Tarqeq's face-like reading comes only from plausible terrain: paired
  // grooves, brow ridges, a central ridge, cheeks, and a shallow lower basin.
  const tarqeqLeftEye = directionFromLatLon(26, -22);
  const tarqeqRightEye = directionFromLatLon(26, 22);
  const tarqeqLeftBrow = directionFromLatLon(42, -24);
  const tarqeqRightBrow = directionFromLatLon(42, 24);
  const tarqeqNose = directionFromLatLon(4, 0);
  const tarqeqMouth = directionFromLatLon(-27, 0);
  const tarqeqLeftCheek = directionFromLatLon(-5, -31);
  const tarqeqRightCheek = directionFromLatLon(-5, 31);
  const gridrHead = directionFromLatLon(4, 156);
  const gridrBody = directionFromLatLon(2, 20);
  const gridrWaist = directionFromLatLon(2, 92);
  const angrbodaSnout = directionFromLatLon(8, 162);
  const angrbodaShoulder = directionFromLatLon(40, 18);
  const skrymirCrown = directionFromLatLon(58, -16);
  const skrymirWaist = directionFromLatLon(-4, 84);
  const gerdLeftLobe = directionFromLatLon(47, -32);
  const gerdRightLobe = directionFromLatLon(47, 30);
  const gerdNotch = directionFromLatLon(64, 0);
  const s26Basin = directionFromLatLon(10, -28);
  const eggtherBasin = directionFromLatLon(6, -28);
  const eggtherBrokenCrown = directionFromLatLon(62, 118);
  const s29Basin = directionFromLatLon(6, -34);
  const beliLeftLobe = directionFromLatLon(4, 150);
  const beliRightLobe = directionFromLatLon(12, 18);
  const beliWaist = directionFromLatLon(8, 86);
  const s27Dome = directionFromLatLon(58, -8);
  const gunnlodScarp = directionFromLatLon(-18, 138);
  const gunnlodBasin = directionFromLatLon(4, -30);
  const thiazziCrown = directionFromLatLon(50, 16);
  const alvaldiLeftCrown = directionFromLatLon(50, -34);
  const alvaldiRightCrown = directionFromLatLon(52, 32);
  const alvaldiNotch = directionFromLatLon(66, 0);
  const geirrodBasinA = directionFromLatLon(20, -30);
  const geirrodBasinB = directionFromLatLon(-16, -20);
  const geirrodBasinC = directionFromLatLon(2, 26);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm(direction, 2.1, profile.seed + 211.3);
    const medium = fbm(direction, 7.8, profile.seed + 337.1);
    const fine = fbm(direction, 25.0, profile.seed + 509.4);

    let relief = broad * 0.040 + medium * 0.014 + fine * 0.0045;
    craters.forEach((crater) => {
      relief += craterSample(
        direction,
        crater.center,
        crater.radius,
        crater.depth,
        crater.rim,
      ).height;
    });

    let localRadius = Math.max(0.70, 1 + relief);
    let xAxis = config.axes[0];
    let yAxis = config.axes[1];
    let zAxis = config.axes[2];
    let centreX = 0;
    let centreY = 0;
    let centreZ = 0;

    if (config.kind === "broken-wedge") {
      const crown = gaussianSurfaceMask(direction, tarvosCrown, 0.56);
      const brokenEdge = gaussianSurfaceMask(direction, tarvosBrokenEdge, 0.50);
      const crownJag = Math.max(0, medium * 0.65 + fine * 0.35);
      localRadius *= 1 + crown * (0.045 + crownJag * 0.075) - brokenEdge * 0.055;
      xAxis *= 1 - smoothstepValue(direction.y, 0.20, 0.96) * 0.08;
      yAxis *= 1 + crown * 0.055;
      centreX = -crown * 0.025;
    } else if (config.kind === "flattened-potato") {
      const leftBulk = smoothstepValue(-direction.x, 0.10, 0.92);
      const rightTaper = smoothstepValue(direction.x, 0.18, 0.96);
      localRadius *= 1 + leftBulk * 0.045 - rightTaper * 0.055;
      yAxis *= 1 - Math.abs(direction.x) * 0.035;
      centreY = broad * 0.018;
      centreZ = medium * 0.010;
    } else if (config.kind === "oblate-dome") {
      const crown = smoothstepValue(direction.y, -0.10, 0.98);
      const underside = smoothstepValue(-direction.y, 0.18, 0.98);
      localRadius *= 1 + crown * 0.040 - underside * 0.025;
      yAxis *= 1 - underside * 0.10;
      centreY = crown * 0.018;
    } else if (config.kind === "offset-heart") {
      const leftLobe = gaussianSurfaceMask(direction, kiviuqLeftLobe, 0.66);
      const rightLobe = gaussianSurfaceMask(direction, kiviuqRightLobe, 0.62);
      const notch = gaussianSurfaceMask(direction, kiviuqNotch, 0.34);
      const upperHalf = smoothstepValue(direction.y, 0.05, 0.92);
      const silhouetteNotch = upperHalf
        * (1 - smoothstepValue(Math.abs(direction.x), 0.10, 0.42));
      const leftSilhouetteLobe = upperHalf * smoothstepValue(-direction.x, -0.05, 0.88);
      const rightSilhouetteLobe = upperHalf * smoothstepValue(direction.x, -0.05, 0.88);
      localRadius *= 1
        + leftLobe * 0.125
        + rightLobe * 0.180
        + leftSilhouetteLobe * 0.060
        + rightSilhouetteLobe * 0.095
        - notch * 0.135
        - silhouetteNotch * 0.115;
      centreX = rightLobe * 0.075
        + rightSilhouetteLobe * 0.045
        - leftLobe * 0.030;
      centreY = leftLobe * 0.030 + rightLobe * 0.018;
      zAxis *= 1 - (notch + silhouetteNotch) * 0.045;
    } else if (config.kind === "twin-shoulder") {
      const leftShoulder = gaussianSurfaceMask(direction, mundilfariLeftShoulder, 0.52);
      const rightShoulder = gaussianSurfaceMask(direction, mundilfariRightShoulder, 0.48);
      const saddle = gaussianSurfaceMask(direction, mundilfariSaddle, 0.30);
      const flankWrinkles = Math.sin(
        direction.y * 92
        + Math.atan2(direction.z, direction.x) * 9
        + medium * 3.4,
      ) * 0.010;
      localRadius *= 1
        + leftShoulder * 0.115
        + rightShoulder * 0.075
        - saddle * 0.105
        + flankWrinkles;
      centreX = -leftShoulder * 0.035 + rightShoulder * 0.020;
      yAxis *= 1 + (leftShoulder + rightShoulder) * 0.045;
    } else if (config.kind === "contact-lobes") {
      const mainLobe = gaussianSurfaceMask(direction, albiorixMainLobe, 0.82);
      const raisedLobe = gaussianSurfaceMask(direction, albiorixRaisedLobe, 0.58);
      const saddle = gaussianSurfaceMask(direction, albiorixSaddle, 0.38);
      const lowerPrimary = smoothstepValue(-direction.y, -0.05, 0.88)
        * smoothstepValue(-direction.x, -0.18, 0.90);
      const upperRight = smoothstepValue(direction.y, 0.05, 0.88)
        * smoothstepValue(direction.x, -0.08, 0.82);
      const waistBand = Math.exp(-Math.pow((direction.y - 0.20) / 0.22, 2))
        * (1 - smoothstepValue(direction.x, 0.32, 0.92));
      localRadius *= 1
        + mainLobe * 0.145
        + lowerPrimary * 0.085
        + raisedLobe * 0.205
        + upperRight * 0.100
        - saddle * 0.115
        - waistBand * 0.065;
      // Keep Albiorix a star-shaped closed volume. The former per-vertex
      // centre offsets folded neighbouring triangles across one another,
      // exposing the background through apparent cracks during rotation.
      xAxis *= 1 + upperRight * 0.070 + lowerPrimary * 0.025;
      yAxis *= 1 + raisedLobe * 0.055 - saddle * 0.025;
      zAxis *= 1 - (saddle + waistBand) * 0.035;
    } else if (config.kind === "broken-egg") {
      const crown = gaussianSurfaceMask(direction, skathiCrown, 0.54);
      const brokenSide = gaussianSurfaceMask(direction, skathiBrokenSide, 0.48);
      const top = smoothstepValue(direction.y, 0.12, 0.96);
      localRadius *= 1
        + crown * (0.055 + Math.max(0, medium) * 0.055)
        - brokenSide * 0.075
        - top * Math.max(0, -fine) * 0.028;
      xAxis *= 1 - top * 0.045;
      yAxis *= 1 + crown * 0.035;
    } else if (config.kind === "sloped-boulder") {
      const crown = gaussianSurfaceMask(direction, erriapusCrown, 0.62);
      const brokenFlank = gaussianSurfaceMask(direction, erriapusBrokenFlank, 0.58);
      const leftBulk = smoothstepValue(-direction.x, 0.05, 0.92);
      localRadius *= 1 + crown * 0.060 + leftBulk * 0.035 - brokenFlank * 0.080;
      yAxis *= 1 - smoothstepValue(direction.x, 0.20, 0.96) * 0.065;
    } else if (config.kind === "cratered-globe") {
      const basin = craterSample(direction, siarnaqBasin, 0.25, 0.075, 0.014);
      localRadius = Math.max(0.78, localRadius + basin.height);
      xAxis *= 1 + broad * 0.012;
      yAxis *= 1 - 0.018;
    } else if (config.kind === "ring-basin-pebble") {
      const basin = craterSample(direction, thrymrBasin, 0.28, 0.068, 0.018);
      localRadius = Math.max(0.80, localRadius + basin.height);
      xAxis *= 1 + broad * 0.016;
      yAxis *= 1 + medium * 0.010;
    } else if (config.kind === "basin-block") {
      const basin = craterSample(direction, narviBasin, 0.31, 0.120, 0.020);
      const scarp = gaussianSurfaceMask(direction, narviScarp, 0.52);
      localRadius = Math.max(
        0.70,
        localRadius + basin.height - scarp * (0.045 + Math.max(0, -medium) * 0.040),
      );
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.56,
      );
      localRadius *= 0.965 + blockiness * 0.045;
    } else if (config.kind === "jagged-tower") {
      const cavity = craterSample(direction, aegirCavity, 0.29, 0.145, 0.015);
      const brokenCrown = gaussianSurfaceMask(direction, aegirBrokenCrown, 0.46);
      const crown = smoothstepValue(direction.y, 0.12, 0.97);
      const base = smoothstepValue(-direction.y, 0.25, 0.98);
      localRadius = Math.max(
        0.64,
        localRadius
          + cavity.height
          + crown * Math.max(0, medium) * 0.075
          - brokenCrown * 0.070,
      );
      xAxis *= 1 - base * 0.13 + crown * 0.045;
      zAxis *= 1 - base * 0.10;
    } else if (config.kind === "squat-boulder") {
      const groove = gaussianSurfaceMask(direction, bebhionnGroove, 0.34);
      const underside = smoothstepValue(-direction.y, 0.20, 0.98);
      localRadius *= 1 - groove * 0.042 - underside * 0.025;
      yAxis *= 1 - underside * 0.075;
      xAxis *= 1 + broad * 0.014;
    } else if (config.kind === "eroded-wedge") {
      const bite = gaussianSurfaceMask(direction, bergelmirBite, 0.54);
      const basin = craterSample(direction, bergelmirBasin, 0.32, 0.135, 0.020);
      const brokenFlank = bite * (0.55 + Math.max(0, -medium) * 0.45);
      localRadius = Math.max(
        0.56,
        localRadius + basin.height - brokenFlank * 0.225,
      );
      xAxis *= 1 - smoothstepValue(direction.x, 0.12, 0.96) * 0.105;
      yAxis *= 1 + smoothstepValue(direction.y, 0.08, 0.95) * 0.045;
    } else if (config.kind === "cavern-rubble") {
      // Bestla's reference suggests enormous cavities. Deep radial bowls
      // reproduce that silhouette while preserving a sealed manifold.
      const upperCavity = craterSample(direction, bestlaUpperCavity, 0.33, 0.215, 0.026);
      const lowerCavity = craterSample(direction, bestlaLowerCavity, 0.29, 0.180, 0.023);
      const sideCavity = craterSample(direction, bestlaSideCavity, 0.24, 0.135, 0.018);
      const crownRubble = smoothstepValue(direction.y, 0.20, 0.96)
        * Math.max(0, medium * 0.70 + fine * 0.30);
      localRadius = Math.max(
        0.52,
        localRadius
          + upperCavity.height
          + lowerCavity.height
          + sideCavity.height
          + crownRubble * 0.080,
      );
      xAxis *= 1 - smoothstepValue(direction.y, 0.18, 0.95) * 0.045;
    } else if (config.kind === "dark-contact-pebble") {
      const leftLobe = gaussianSurfaceMask(direction, farbautiLeftLobe, 0.76);
      const rightLobe = gaussianSurfaceMask(direction, farbautiRightLobe, 0.68);
      const waist = gaussianSurfaceMask(direction, farbautiWaist, 0.44);
      localRadius *= 1 + leftLobe * 0.095 + rightLobe * 0.125 - waist * 0.070;
      yAxis *= 1 - Math.abs(direction.x) * 0.035;
      zAxis *= 1 - waist * 0.025;
    } else if (config.kind === "mottled-crater-globe") {
      const largeBasin = craterSample(direction, fenrirLargeBasin, 0.27, 0.090, 0.018);
      const darkBasin = craterSample(direction, fenrirDarkBasin, 0.22, 0.070, 0.014);
      localRadius = Math.max(0.76, localRadius + largeBasin.height + darkBasin.height);
      xAxis *= 1 + broad * 0.010;
      yAxis *= 1 - 0.010;
    } else if (config.kind === "raised-shoulder-block") {
      const shoulder = gaussianSurfaceMask(direction, fornjotShoulder, 0.64);
      const notch = gaussianSurfaceMask(direction, fornjotNotch, 0.38);
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.62,
      );
      localRadius *= 0.965 + blockiness * 0.050 + shoulder * 0.135 - notch * 0.060;
      xAxis *= 1 + shoulder * 0.045;
      yAxis *= 1 + shoulder * 0.055;
    } else if (config.kind === "flat-slab") {
      const brokenCrown = gaussianSurfaceMask(direction, hatiBrokenCrown, 0.50);
      const crown = smoothstepValue(direction.y, 0.18, 0.95);
      const underside = smoothstepValue(-direction.y, 0.18, 0.95);
      localRadius *= 1
        - brokenCrown * 0.070
        - crown * Math.max(0, -medium) * 0.030
        + underside * 0.025;
      yAxis *= 1 - crown * 0.035;
      zAxis *= 1 - 0.035;
    } else if (config.kind === "rust-basin-globe") {
      const mainBasin = craterSample(direction, hyrrokkinMainBasin, 0.34, 0.150, 0.025);
      const lowerBasin = craterSample(direction, hyrrokkinLowerBasin, 0.29, 0.125, 0.020);
      localRadius = Math.max(0.62, localRadius + mainBasin.height + lowerBasin.height);
      xAxis *= 1 + broad * 0.012;
      zAxis *= 1 - 0.015;
    } else if (config.kind === "pale-rounded-boulder") {
      const crown = gaussianSurfaceMask(direction, kariCrown, 0.74);
      const underside = smoothstepValue(-direction.y, 0.20, 0.96);
      // Lower-frequency relief keeps Kari smooth and softly weathered.
      localRadius = 1 + (localRadius - 1) * 0.38;
      localRadius *= 1 + crown * 0.035 - underside * 0.025 - fine * 0.0025;
      yAxis *= 1 - underside * 0.055;
      xAxis *= 1 + broad * 0.010;
    } else if (config.kind === "twin-basin-lobe") {
      const leftBasin = craterSample(direction, logeLeftBasin, 0.30, 0.115, 0.020);
      const rightBasin = craterSample(direction, logeRightBasin, 0.25, 0.090, 0.017);
      const pinch = gaussianSurfaceMask(direction, logePinch, 0.43);
      localRadius = Math.max(
        0.64,
        localRadius + leftBasin.height + rightBasin.height - pinch * 0.065,
      );
      xAxis *= 1 + smoothstepValue(-direction.x, 0.08, 0.92) * 0.035;
      yAxis *= 1 - pinch * 0.030;
    } else if (config.kind === "dark-twin-block") {
      const left = gaussianSurfaceMask(direction, skollLeftShoulder, 0.60);
      const right = gaussianSurfaceMask(direction, skollRightShoulder, 0.58);
      const furrow = gaussianSurfaceMask(direction, skollFurrow, 0.27);
      const fluting = Math.sin(direction.y * 88 + Math.atan2(direction.z, direction.x) * 8)
        * 0.009;
      localRadius *= 1 + left * 0.095 + right * 0.105 - furrow * 0.105 + fluting;
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.66,
      );
      localRadius *= 0.970 + blockiness * 0.042;
    } else if (config.kind === "leaning-dark-boulder") {
      const crown = gaussianSurfaceMask(direction, surturCrown, 0.66);
      const recess = gaussianSurfaceMask(direction, surturRecess, 0.54);
      const lean = smoothstepValue(direction.x, -0.20, 0.90)
        * smoothstepValue(direction.y, 0.05, 0.90);
      localRadius *= 1 + crown * 0.095 + lean * 0.055 - recess * 0.065;
      xAxis *= 1 + lean * 0.045;
      zAxis *= 1 - recess * 0.025;
    } else if (config.kind === "ivory-rounded-globe") {
      const polygonal = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.72,
      );
      // Jarnsaxa stays predominantly round; the weak faceting only breaks the
      // perfect computer-sphere silhouette at grazing light.
      localRadius *= 0.984 + polygonal * 0.022;
      xAxis *= 1 + broad * 0.008;
      yAxis *= 1 + medium * 0.005;
    } else if (config.kind === "granular-diamond") {
      const basin = craterSample(direction, greipBasin, 0.30, 0.105, 0.020);
      const diamond = Math.pow(
        Math.abs(direction.x) + Math.abs(direction.y) + Math.abs(direction.z),
        0.32,
      );
      localRadius = Math.max(0.70, localRadius + basin.height);
      localRadius *= 0.905 + diamond * 0.075 + Math.max(0, fine) * 0.015;
    } else if (config.kind === "face-stone") {
      const leftEye = gaussianSurfaceMask(direction, tarqeqLeftEye, 0.20);
      const rightEye = gaussianSurfaceMask(direction, tarqeqRightEye, 0.20);
      const leftBrow = gaussianSurfaceMask(direction, tarqeqLeftBrow, 0.22);
      const rightBrow = gaussianSurfaceMask(direction, tarqeqRightBrow, 0.22);
      const nose = gaussianSurfaceMask(direction, tarqeqNose, 0.24);
      const mouth = gaussianSurfaceMask(direction, tarqeqMouth, 0.24);
      const leftCheek = gaussianSurfaceMask(direction, tarqeqLeftCheek, 0.28);
      const rightCheek = gaussianSurfaceMask(direction, tarqeqRightCheek, 0.28);
      localRadius *= 1
        - leftEye * 0.055
        - rightEye * 0.055
        + leftBrow * 0.050
        + rightBrow * 0.050
        + nose * 0.105
        - mouth * 0.060
        + leftCheek * 0.045
        + rightCheek * 0.045;
      yAxis *= 1 - smoothstepValue(-direction.y, 0.32, 0.96) * 0.035;
    } else if (config.kind === "rust-contact-rock") {
      const head = gaussianSurfaceMask(direction, gridrHead, 0.62);
      const body = gaussianSurfaceMask(direction, gridrBody, 0.82);
      const waist = gaussianSurfaceMask(direction, gridrWaist, 0.40);
      localRadius *= 1 + head * 0.085 + body * 0.145 - waist * 0.080;
      yAxis *= 1 - waist * 0.040;
      zAxis *= 1 - waist * 0.030;
    } else if (config.kind === "green-wedge") {
      const snout = gaussianSurfaceMask(direction, angrbodaSnout, 0.58);
      const shoulder = gaussianSurfaceMask(direction, angrbodaShoulder, 0.67);
      localRadius *= 1 + snout * 0.060 + shoulder * 0.115;
      yAxis *= 1 + shoulder * 0.040 - snout * 0.035;
      zAxis *= 1 - snout * 0.035;
    } else if (config.kind === "dark-angular-column") {
      const crown = gaussianSurfaceMask(direction, skrymirCrown, 0.58);
      const waist = gaussianSurfaceMask(direction, skrymirWaist, 0.48);
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.55,
      );
      localRadius *= 0.955 + blockiness * 0.060 + crown * 0.090 - waist * 0.060;
      xAxis *= 1 - waist * 0.035;
    } else if (config.kind === "silver-heart") {
      const left = gaussianSurfaceMask(direction, gerdLeftLobe, 0.60);
      const right = gaussianSurfaceMask(direction, gerdRightLobe, 0.60);
      const notch = gaussianSurfaceMask(direction, gerdNotch, 0.30);
      localRadius *= 1 + left * 0.100 + right * 0.100 - notch * 0.090;
      yAxis *= 1 - smoothstepValue(-direction.y, 0.35, 0.98) * 0.045;
    } else if (config.kind === "scarred-crater-globe") {
      const basin = craterSample(direction, s26Basin, 0.30, 0.095, 0.019);
      const longitude = Math.atan2(direction.z, direction.x);
      const trenchBand = Math.exp(-Math.pow(direction.y / 0.17, 2))
        * (0.55 + 0.45 * Math.sin(longitude * 2.5 + medium * 1.8));
      localRadius = Math.max(0.68, localRadius + basin.height - trenchBand * 0.045);
      xAxis *= 1 + broad * 0.008;
    } else if (config.kind === "broken-bowl") {
      const basin = craterSample(direction, eggtherBasin, 0.37, 0.150, 0.026);
      const brokenCrown = gaussianSurfaceMask(direction, eggtherBrokenCrown, 0.52);
      const scallop = smoothstepValue(direction.y, 0.25, 0.96)
        * Math.max(0, Math.sin(Math.atan2(direction.z, direction.x) * 5 + 0.8));
      localRadius = Math.max(
        0.60,
        localRadius + basin.height - brokenCrown * 0.085 - scallop * 0.045,
      );
      yAxis *= 1 - smoothstepValue(-direction.y, 0.30, 0.96) * 0.060;
    } else if (config.kind === "basin-shard") {
      const basin = craterSample(direction, s29Basin, 0.38, 0.175, 0.028);
      const crown = smoothstepValue(direction.y, 0.22, 0.96);
      localRadius = Math.max(
        0.58,
        localRadius + basin.height - crown * Math.max(0, -medium) * 0.055,
      );
      zAxis *= 1 - 0.025;
    } else if (config.kind === "dark-waist-lobes") {
      const left = gaussianSurfaceMask(direction, beliLeftLobe, 0.72);
      const right = gaussianSurfaceMask(direction, beliRightLobe, 0.68);
      const waist = gaussianSurfaceMask(direction, beliWaist, 0.42);
      const fluting = Math.sin(direction.y * 72 + Math.atan2(direction.z, direction.x) * 7)
        * 0.007;
      localRadius *= 1 + left * 0.095 + right * 0.120 - waist * 0.075 + fluting;
      yAxis *= 1 - waist * 0.035;
    } else if (config.kind === "pale-oblate-dome") {
      const dome = gaussianSurfaceMask(direction, s27Dome, 0.78);
      // Damp procedural roughness to preserve the reference's unusually
      // smooth powder-covered appearance.
      localRadius = 1 + (localRadius - 1) * 0.28;
      localRadius *= 1 + dome * 0.035;
      yAxis *= 1 - smoothstepValue(-direction.y, 0.15, 0.95) * 0.070;
    } else if (config.kind === "bright-broken-block") {
      const scarp = gaussianSurfaceMask(direction, gunnlodScarp, 0.54);
      const basin = craterSample(direction, gunnlodBasin, 0.32, 0.125, 0.022);
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.62,
      );
      localRadius = Math.max(0.60, localRadius + basin.height - scarp * 0.130);
      localRadius *= 0.965 + blockiness * 0.046;
    } else if (config.kind === "dark-triangular-shard") {
      const crown = gaussianSurfaceMask(direction, thiazziCrown, 0.64);
      const upper = smoothstepValue(direction.y, 0.08, 0.94);
      const sideTaper = smoothstepValue(-direction.x, 0.05, 0.92);
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.54,
      );
      localRadius *= 0.950 + blockiness * 0.062 + crown * 0.105;
      xAxis *= 1 - upper * sideTaper * 0.070;
      zAxis *= 1 - upper * 0.035;
    } else if (config.kind === "quiet-crater-globe") {
      localRadius = 1 + (localRadius - 1) * 0.66;
      xAxis *= 1 + broad * 0.006;
      yAxis *= 1 - 0.008;
    } else if (config.kind === "olive-crown-block") {
      const left = gaussianSurfaceMask(direction, alvaldiLeftCrown, 0.58);
      const right = gaussianSurfaceMask(direction, alvaldiRightCrown, 0.58);
      const notch = gaussianSurfaceMask(direction, alvaldiNotch, 0.28);
      const blockiness = Math.pow(
        Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z)),
        0.62,
      );
      localRadius *= 0.962 + blockiness * 0.046 + left * 0.080 + right * 0.100 - notch * 0.075;
    } else if (config.kind === "pale-battered-wedge") {
      const basinA = craterSample(direction, geirrodBasinA, 0.31, 0.145, 0.026);
      const basinB = craterSample(direction, geirrodBasinB, 0.27, 0.125, 0.022);
      const basinC = craterSample(direction, geirrodBasinC, 0.23, 0.105, 0.019);
      const taper = smoothstepValue(direction.x, 0.08, 0.94);
      localRadius = Math.max(
        0.56,
        localRadius + basinA.height + basinB.height + basinC.height,
      );
      yAxis *= 1 - taper * 0.050;
      zAxis *= 1 - taper * 0.045;
    }

    localRadius = Math.max(0.60, localRadius);
    positions.setXYZ(
      index,
      direction.x * xAxis * localRadius + centreX,
      direction.y * yAxis * localRadius + centreY,
      direction.z * zAxis * localRadius + centreZ,
    );
  }

  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  smoothSphereUvSeamNormals(geometry);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: maps?.albedoMap ?? null,
    roughness: config.roughness,
    metalness: 0,
    envMapIntensity: 0.014,
    emissive: 0x000000,
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
    dithering: true,
  });
  material.name = `${profile.name} user-reference volumetric mapped surface`;

  const moon = new THREE.Mesh(geometry, material);
  moon.castShadow = false;
  moon.receiveShadow = false;
  moon.userData.geometryIncludesShape = true;
  moon.userData.surfaceEvidence = profile.surfaceEvidence;
  moon.userData.surfaceStructure = config.structure;
  moon.userData.surfaceRoughness = config.roughness;
  moon.userData.surfaceDetailMode = `user-reference-${config.kind}-volumetric-sculpt`;
  moon.userData.referenceSourceAsset = `assets/textures/saturnian/irregular-reference/${irregularReferenceAssetSlug(profile.name)}-reference-source.png`;
  moon.userData.irregularReferenceState = { profile, quality, maps, config };
  return moon;
}

export function createSaturnianMoonSurface(profile, quality = "high") {
  if (profile.name === "Ymir") return createYmirReferenceSurface(profile, quality);
  if (profile.name === "Paaliaq") return createPaaliaqReferenceSurface(profile, quality);
  const irregularReferenceModel = IRREGULAR_REFERENCE_MODELS[profile.name];
  if (irregularReferenceModel) {
    return createIrregularReferenceSurface(profile, quality, irregularReferenceModel);
  }
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

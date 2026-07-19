/**
 * Shared realistic planet construction.
 *
 * Earth and the Moon keep their existing dedicated layers in main.js. The
 * remaining planets are still created through one factory, but each receives a
 * visual profile suited to its physical type: rocky world, cloud-covered world,
 * banded gas giant, ringed giant, or ice giant.
 */
import * as THREE from "three";
import { makeNoiseTexture } from "../graphics/proceduralTextures.js";
import { createOrbitLine } from "./orbits.js";

const GAS_PROFILES = {
  Jupiter: {
    cream: new THREE.Color(0xe8d5b2),
    lightBand: new THREE.Color(0xfff2d7),
    darkBand: new THREE.Color(0x4c271f),
    accent: new THREE.Color(0xb86636),
    polar: new THREE.Color(0x244b67),
    polarLight: new THREE.Color(0xb8d9e5),
    bandFrequency: 24,
    fineFrequency: 74,
    turbulence: 0.145,
    textureStrength: 0.35,
    atmosphereColor: 0x8fcbe0,
    atmosphereOpacity: 0.15,
  },
  Saturn: {
    cream: new THREE.Color(0xe8d6ad),
    lightBand: new THREE.Color(0xffedc7),
    darkBand: new THREE.Color(0x8e6a43),
    accent: new THREE.Color(0xb88d55),
    polar: new THREE.Color(0xb6c3b7),
    polarLight: new THREE.Color(0xe7eee3),
    bandFrequency: 31,
    fineFrequency: 92,
    turbulence: 0.045,
    textureStrength: 0.65,
    atmosphereColor: 0xf1d9a7,
    atmosphereOpacity: 0.085,
  },
  Uranus: {
    cream: new THREE.Color(0x8fdde4),
    lightBand: new THREE.Color(0xc8f6f4),
    darkBand: new THREE.Color(0x5599a4),
    accent: new THREE.Color(0xa8edf0),
    polar: new THREE.Color(0xd8ffff),
    polarLight: new THREE.Color(0xf0ffff),
    bandFrequency: 18,
    fineFrequency: 58,
    turbulence: 0.026,
    textureStrength: 0.48,
    atmosphereColor: 0xa8ffff,
    atmosphereOpacity: 0.12,
  },
  Neptune: {
    cream: new THREE.Color(0x1757c8),
    lightBand: new THREE.Color(0x72b7ff),
    darkBand: new THREE.Color(0x061b58),
    accent: new THREE.Color(0x22b8d3),
    polar: new THREE.Color(0x2d6fd8),
    polarLight: new THREE.Color(0xaad9ff),
    bandFrequency: 24,
    fineFrequency: 88,
    turbulence: 0.105,
    textureStrength: 0.34,
    atmosphereColor: 0x5ca9ff,
    atmosphereOpacity: 0.18,
  },
};


function createMercuryMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vObjectDirection = normalize(position);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
      }

      float fbm3D(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 5; octave++) {
          value += noise3D(p) * amplitude;
          p = p * 2.03 + vec3(7.2, 11.8, 5.4);
          amplitude *= 0.5;
        }
        return value;
      }

      float sphericalMask(vec3 direction, vec3 centre, float innerRadius, float outerRadius) {
        float angularDistance = acos(clamp(dot(direction, normalize(centre)), -1.0, 1.0));
        return 1.0 - smoothstep(innerRadius, outerRadius, angularDistance);
      }

      float hollowCluster(vec3 direction, vec3 centre, float radius, float seed) {
        float area = sphericalMask(direction, centre, radius * 0.56, radius);
        float cellular = fbm3D(direction * 175.0 + vec3(seed, seed * 1.73, seed * 0.41));
        float etched = smoothstep(0.60, 0.78, cellular);
        float brokenEdges = 0.56 + fbm3D(direction * 48.0 + vec3(seed * 2.1)) * 0.68;
        return area * etched * brokenEdges;
      }

      void main() {
        vec3 direction = normalize(vObjectDirection);
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

        vec3 observed = texture2D(uMap, vUv).rgb;
        float observedLuma = dot(observed, vec3(0.2126, 0.7152, 0.0722));
        float broadRock = fbm3D(direction * 5.4);
        float mediumRock = fbm3D(direction * 21.0 + vec3(3.1, 9.7, 5.2));
        float fineRock = fbm3D(direction * 88.0 + vec3(11.4, 2.8, 17.3));

        // MESSENGER true-colour views show a subdued grey-brown world. Preserve
        // that neutral visible-light character while increasing local contrast
        // so the terrain remains readable under the Sun's white light.
        vec3 charcoalRock = vec3(0.205, 0.198, 0.190);
        vec3 middleRock = vec3(0.455, 0.430, 0.398);
        vec3 sunlitRock = vec3(0.715, 0.675, 0.610);
        float terrainValue = clamp(
          observedLuma * 0.64
          + broadRock * 0.22
          + mediumRock * 0.11
          + fineRock * 0.03,
          0.0,
          1.0
        );
        vec3 colour = mix(charcoalRock, middleRock, smoothstep(0.16, 0.52, terrainValue));
        colour = mix(colour, sunlitRock, smoothstep(0.48, 0.88, terrainValue));

        // Retain restrained mineral colour variations from the observed map,
        // avoiding the saturated false-colour appearance of scientific maps.
        vec3 observedChroma = observed / max(observedLuma, 0.08);
        colour *= mix(vec3(1.0), clamp(observedChroma, 0.78, 1.20), 0.24);

        // Caloris-like smooth volcanic plains receive a subtle warm tint, while
        // low-reflectance material remains dark brown-charcoal around basins.
        float caloris = sphericalMask(direction, vec3(-0.78, 0.22, 0.58), 0.18, 0.34);
        float calorisInterior = sphericalMask(direction, vec3(-0.78, 0.22, 0.58), 0.0, 0.22);
        colour = mix(colour, vec3(0.61, 0.535, 0.435), calorisInterior * 0.34);
        float lowReflectance = smoothstep(0.63, 0.82, fbm3D(direction * 9.0 + vec3(21.0)))
          * (0.42 + caloris * 0.35);
        colour = mix(colour, vec3(0.155, 0.145, 0.140), lowReflectance * 0.54);

        // Mercury's hollows are shallow, irregular and unusually reflective.
        // Several deterministic clusters create blue-white pitted material on
        // crater floors, walls and central peaks without turning them emissive.
        float hollows = 0.0;
        hollows += hollowCluster(direction, vec3(0.34, 0.60, 0.72), 0.145, 2.4);
        hollows += hollowCluster(direction, vec3(-0.24, 0.18, 0.95), 0.118, 5.8);
        hollows += hollowCluster(direction, vec3(0.72, -0.28, 0.63), 0.126, 8.1);
        hollows += hollowCluster(direction, vec3(-0.66, -0.12, 0.74), 0.134, 11.7);
        hollows += hollowCluster(direction, vec3(0.15, -0.78, -0.60), 0.105, 14.2);
        hollows += hollowCluster(direction, vec3(-0.84, 0.41, -0.35), 0.114, 17.6);
        hollows = clamp(hollows, 0.0, 1.0);
        vec3 hollowMaterial = vec3(0.80, 0.845, 0.835);
        colour = mix(colour, hollowMaterial, hollows * 0.82);

        // Fresh ejecta and crater rims catch white sunlight with higher albedo.
        float freshMaterial = smoothstep(0.72, 0.90, fineRock)
          * smoothstep(0.48, 0.82, mediumRock);
        colour = mix(colour, vec3(0.77, 0.735, 0.675), freshMaterial * 0.24);

        float ndl = dot(normal, lightDirection);
        float dayBlend = smoothstep(-0.16, 0.24, ndl);
        float diffuse = 0.14 + max(ndl, 0.0) * 1.12;
        float microShadow = mix(0.87, 1.08, fineRock);
        colour *= mix(0.035, diffuse * microShadow, dayBlend);

        // A very restrained opposition lift helps crater relief remain readable
        // without adding an atmosphere or artificial rim glow.
        float opposition = pow(max(dot(viewDirection, lightDirection), 0.0), 18.0);
        colour += vec3(0.055, 0.052, 0.048) * opposition * dayBlend;

        gl_FragColor = vec4(max(colour, vec3(0.0)), 1.0);
      }
    `,
    depthWrite: true,
    depthTest: true,
  });
}

function createMarsMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0.0,
    envMapIntensity: 0.07,
  });
}

function createVenusSurfaceMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    // The rocky surface is hidden beneath an optically thick cloud deck in
    // visible light. Keep it dark and restrained so it never bleeds through the
    // atmosphere as an artificial orange globe.
    color: 0x5a3828,
    roughness: 1,
    metalness: 0,
    bumpMap: texture,
    bumpScale: 0.006,
    envMapIntensity: 0.01,
  });
}

function createRockyMaterial(config, textures) {
  const map = textures[config.texture] ?? makeNoiseTexture(config.texture);
  if (config.name === "Mercury") return createMercuryMaterial(map);
  if (config.name === "Mars") return createMarsMaterial(map);
  if (config.name === "Venus") return createVenusSurfaceMaterial(map);
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.96,
    metalness: 0,
    bumpMap: config.bump ? map : null,
    bumpScale: config.bump ?? 0,
    displacementMap: config.bump ? map : null,
    displacementScale: (config.bump ?? 0) * 0.35,
    displacementBias: -((config.bump ?? 0) * 0.18),
    normalMap: config.normalTexture ? textures[config.normalTexture] : null,
    normalScale: new THREE.Vector2(config.normalScale ?? 0.55, config.normalScale ?? 0.55),
    envMapIntensity: 0.1,
  });
}

/**
 * Deterministic 3D value noise used to sculpt geometry. Unlike a CanvasTexture,
 * this function changes vertex positions, so terrain affects the silhouette and
 * produces real lighting/shadow variation.
 */
function terrainHash(x, y, z) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function terrainNoise(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const mix = (a, b, t) => a + (b - a) * t;
  const x00 = mix(terrainHash(ix, iy, iz), terrainHash(ix + 1, iy, iz), ux);
  const x10 = mix(terrainHash(ix, iy + 1, iz), terrainHash(ix + 1, iy + 1, iz), ux);
  const x01 = mix(terrainHash(ix, iy, iz + 1), terrainHash(ix + 1, iy, iz + 1), ux);
  const x11 = mix(terrainHash(ix, iy + 1, iz + 1), terrainHash(ix + 1, iy + 1, iz + 1), ux);
  return mix(mix(x00, x10, uy), mix(x01, x11, uy), uz);
}

function terrainFbm(direction, frequency, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let total = 0;
  let x = direction.x * frequency;
  let y = direction.y * frequency;
  let z = direction.z * frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += terrainNoise(x, y, z) * amplitude;
    total += amplitude;
    x = x * 2.03 + 7.2;
    y = y * 2.03 + 11.8;
    z = z * 2.03 + 5.4;
    amplitude *= 0.5;
  }
  return value / total;
}

function seededCraterField(count, seed, minimumRadius, maximumRadius, depthScale) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const y = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const radial = Math.sqrt(1 - y * y);
    const angularRadius = minimumRadius + Math.pow(random(), 2.1) * (maximumRadius - minimumRadius);
    return {
      direction: new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial),
      angularRadius,
      depth: angularRadius * depthScale * (0.72 + random() * 0.5),
      rim: angularRadius * depthScale * (0.2 + random() * 0.22),
    };
  });
}

const MERCURY_CRATERS = [
  ...seededCraterField(118, 481516, 0.019, 0.15, 0.057),
  // Caloris Basin: broad and comparatively shallow, with a raised multi-ring edge.
  {
    direction: new THREE.Vector3(-0.78, 0.22, 0.58).normalize(),
    angularRadius: 0.29,
    depth: 0.014,
    rim: 0.0045,
  },
  // A handful of larger complex craters keep the silhouette from reading as a
  // uniformly noisy sphere when Mercury is inspected at close range.
  {
    direction: new THREE.Vector3(0.34, 0.60, 0.72).normalize(),
    angularRadius: 0.118,
    depth: 0.0080,
    rim: 0.0030,
  },
  {
    direction: new THREE.Vector3(-0.24, 0.18, 0.95).normalize(),
    angularRadius: 0.096,
    depth: 0.0068,
    rim: 0.0026,
  },
  {
    direction: new THREE.Vector3(0.72, -0.28, 0.63).normalize(),
    angularRadius: 0.104,
    depth: 0.0072,
    rim: 0.0028,
  },
  {
    direction: new THREE.Vector3(-0.66, -0.12, 0.74).normalize(),
    angularRadius: 0.112,
    depth: 0.0075,
    rim: 0.0029,
  },
];

const MARS_CRATERS = seededCraterField(34, 230319, 0.018, 0.095, 0.042);

function craterRelief(direction, crater, radius) {
  const angularDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(crater.direction), -1, 1));
  const q = angularDistance / crater.angularRadius;
  if (q > 1.28) return 0;
  const depression = q < 1 ? -Math.pow(1 - q * q, 2) * crater.depth * radius : 0;
  const rimDistance = (q - 1) / 0.16;
  const raisedRim = Math.exp(-(rimDistance * rimDistance)) * crater.rim * radius;
  return depression + raisedRim;
}

function wrappedLongitudeDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/**
 * Physically modifies a sphere's vertices. Mercury receives densely overlapping
 * impact basins; Mars receives subtler craters, Valles Marineris cuts, and a broad
 * shield volcano with a real summit caldera.
 */
function sculptRockyGeometry(geometry, config) {
  if (!["Mercury", "Mars"].includes(config.name)) return geometry;
  const positions = geometry.attributes.position;
  const direction = new THREE.Vector3();
  const radius = config.radius;
  const craters = config.name === "Mercury" ? MERCURY_CRATERS : MARS_CRATERS;

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broadNoise = terrainFbm(direction, config.name === "Mercury" ? 5.8 : 4.3, 5) - 0.5;
    const fineNoise = terrainFbm(direction, config.name === "Mercury" ? 22 : 15, 4) - 0.5;
    let height = radius * (
      broadNoise * (config.name === "Mercury" ? 0.016 : 0.011)
      + fineNoise * (config.name === "Mercury" ? 0.006 : 0.004)
    );

    craters.forEach((crater) => {
      height += craterRelief(direction, crater, radius);
    });

    if (config.name === "Mars") {
      const latitude = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
      const longitude = Math.atan2(direction.z, direction.x);

      // Three connected cuts form Valles Marineris as a depressed elongated system.
      const canyonCenters = [-0.9, -0.48, -0.06];
      canyonCenters.forEach((center, canyonIndex) => {
        const lonDelta = wrappedLongitudeDelta(longitude, center);
        const latDelta = latitude - (-0.2 + canyonIndex * 0.012);
        const canyonMask = Math.exp(-(lonDelta * lonDelta) / 0.12 - (latDelta * latDelta) / 0.0014);
        const branching = 0.72 + 0.28 * Math.sin(longitude * 19 + latitude * 31);
        height -= radius * 0.009 * canyonMask * branching;
      });

      // Olympus Mons is a broad shield built into terrain, not a cylinder sticker.
      const olympusDirection = new THREE.Vector3(-0.61, 0.31, -0.73).normalize();
      const olympusAngle = Math.acos(THREE.MathUtils.clamp(direction.dot(olympusDirection), -1, 1));
      const shield = Math.exp(-Math.pow(olympusAngle / 0.19, 2));
      const caldera = Math.exp(-Math.pow(olympusAngle / 0.035, 2));
      height += radius * 0.012 * shield;
      height -= radius * 0.0045 * caldera;
    }

    direction.multiplyScalar(radius + height);
    positions.setXYZ(index, direction.x, direction.y, direction.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  geometry.userData.terrainKind = config.name;
  return geometry;
}

function createGasMaterial(config, texture) {
  const profile = GAS_PROFILES[config.name];
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture },
      uCream: { value: profile.cream },
      uLightBand: { value: profile.lightBand },
      uDarkBand: { value: profile.darkBand },
      uAccent: { value: profile.accent },
      uPolar: { value: profile.polar },
      uPolarLight: { value: profile.polarLight },
      uBandFrequency: { value: profile.bandFrequency },
      uFineFrequency: { value: profile.fineFrequency },
      uTurbulence: { value: profile.turbulence },
      uTextureStrength: { value: profile.textureStrength },
      uPlanetKind: { value: config.name === "Jupiter" ? 1 : config.name === "Saturn" ? 2 : config.name === "Uranus" ? 3 : 4 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vObjectDirection = normalize(position);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uMap;
      uniform vec3 uCream;
      uniform vec3 uLightBand;
      uniform vec3 uDarkBand;
      uniform vec3 uAccent;
      uniform vec3 uPolar;
      uniform vec3 uPolarLight;
      uniform float uBandFrequency;
      uniform float uFineFrequency;
      uniform float uTurbulence;
      uniform float uTextureStrength;
      uniform int uPlanetKind;
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i + vec3(0,0,0));
        float n100 = hash31(i + vec3(1,0,0));
        float n010 = hash31(i + vec3(0,1,0));
        float n110 = hash31(i + vec3(1,1,0));
        float n001 = hash31(i + vec3(0,0,1));
        float n101 = hash31(i + vec3(1,0,1));
        float n011 = hash31(i + vec3(0,1,1));
        float n111 = hash31(i + vec3(1,1,1));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
      }
      float fbm3D(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += noise3D(p) * amplitude;
          p = p * 2.03 + vec3(7.2, 11.8, 5.4);
          amplitude *= 0.5;
        }
        return value;
      }
      float ellipseMask(vec3 direction, float lonCenter, float latCenter, float width, float height, float distortion) {
        float lon = atan(direction.z, direction.x);
        float lat = asin(clamp(direction.y, -1.0, 1.0));
        float dx = atan(sin(lon - lonCenter), cos(lon - lonCenter)) / width;
        float dy = (lat - latCenter) / height;
        float irregular = (fbm3D(direction * 58.0 + vec3(lonCenter * 3.0)) - 0.5) * distortion;
        return 1.0 - smoothstep(0.70, 1.08, length(vec2(dx, dy)) + irregular);
      }
      void main() {
        vec3 dir = normalize(vObjectDirection);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        float lon = atan(dir.z, dir.x);
        float differential = sin(lat * 10.0) * 0.015;
        float animatedLon = lon + uTime * (0.008 + differential);
        vec3 flowDir = normalize(vec3(cos(animatedLon) * cos(lat), sin(lat), sin(animatedLon) * cos(lat)));
        float broad = fbm3D(flowDir * 6.0 + vec3(uTime * 0.004, -uTime * 0.003, uTime * 0.002));
        float medium = fbm3D(flowDir * 22.0 + vec3(-uTime * 0.011, uTime * 0.008, uTime * 0.006));
        float fine = fbm3D(flowDir * 72.0 + vec3(uTime * 0.017, -uTime * 0.012, uTime * 0.009));
        float warpedLat = lat + (broad - 0.5) * uTurbulence + (medium - 0.5) * uTurbulence * 0.42;
        float bands = sin(warpedLat * uBandFrequency);
        float fineBands = sin(warpedLat * uFineFrequency + medium * 4.8);
        vec3 procedural = mix(uDarkBand, uCream, smoothstep(-0.52, 0.56, bands));
        procedural = mix(procedural, uLightBand, smoothstep(0.22, 0.92, fineBands) * 0.58);
        procedural = mix(procedural, uAccent, smoothstep(0.48, 0.96, -fineBands) * 0.34);

        float polar = smoothstep(0.42, 0.95, abs(dir.y));
        float polarNoise = fbm3D(dir * 38.0 + vec3(uTime * 0.005, -uTime * 0.004, uTime * 0.003));
        vec3 polarColor = mix(uPolar * 0.55, uPolarLight, smoothstep(0.35, 0.82, polarNoise));
        procedural = mix(procedural, polarColor, polar * (uPlanetKind == 1 ? 0.92 : 0.72));

        if (uPlanetKind == 1) {
          float polarCyclones = fbm3D(dir * 66.0 + vec3(uTime * 0.009, -uTime * 0.007, uTime * 0.005));
          float polarVortices = smoothstep(0.56, 0.89, polarCyclones) * polar;
          procedural = mix(procedural, vec3(0.11, 0.20, 0.29), polarVortices * 0.52);
          procedural += vec3(0.42, 0.65, 0.78) * smoothstep(0.72, 0.94, polarCyclones) * polar * 0.28;

          float grsOuter = ellipseMask(dir, -0.72, -0.34, 0.31, 0.125, 0.15);
          float grsMiddle = ellipseMask(dir, -0.72, -0.34, 0.225, 0.086, 0.18);
          float grsCore = ellipseMask(dir, -0.72, -0.34, 0.14, 0.052, 0.22);
          float grsTexture = fbm3D(dir * 84.0 + vec3(uTime * 0.004));
          float grsStripes = 0.5 + 0.5 * sin(atan(dir.y + 0.33, dir.x) * 28.0 + grsTexture * 8.0);
          vec3 grsOuterColor = mix(vec3(0.45, 0.10, 0.045), vec3(0.98, 0.42, 0.12), grsTexture);
          vec3 grsMiddleColor = mix(vec3(0.72, 0.18, 0.07), vec3(1.0, 0.60, 0.22), grsStripes);
          vec3 grsCoreColor = mix(vec3(0.52, 0.10, 0.045), vec3(1.0, 0.76, 0.42), grsTexture);
          procedural = mix(procedural, grsOuterColor, grsOuter * 0.94);
          procedural = mix(procedural, grsMiddleColor, grsMiddle * 0.90);
          procedural = mix(procedural, grsCoreColor, grsCore * 0.82);

          float ovalA = ellipseMask(dir, 1.42, -0.49, 0.09, 0.04, 0.12);
          float ovalB = ellipseMask(dir, 1.78, -0.53, 0.07, 0.034, 0.15);
          float ovalC = ellipseMask(dir, -2.25, 0.48, 0.07, 0.032, 0.14);
          procedural = mix(procedural, vec3(0.98, 0.97, 0.91), max(ovalA, max(ovalB, ovalC)) * 0.82);
        }

        if (uPlanetKind == 4) {
          float equatorialTeal = 1.0 - smoothstep(0.18, 0.75, abs(dir.y));
          procedural = mix(procedural, vec3(0.04, 0.50, 0.66), equatorialTeal * 0.16);

          float darkStormOuter = ellipseMask(dir, -0.52, -0.15, 0.29, 0.135, 0.18);
          float darkStormCore = ellipseMask(dir, -0.52, -0.15, 0.16, 0.072, 0.22);
          procedural = mix(procedural, vec3(0.012, 0.035, 0.145), darkStormOuter * 0.82);
          procedural = mix(procedural, vec3(0.003, 0.010, 0.055), darkStormCore * 0.72);

          float companionCloud = ellipseMask(dir, -0.19, -0.09, 0.20, 0.047, 0.12);
          float scooter = ellipseMask(dir, 1.85 + uTime * 0.018, -0.38, 0.13, 0.035, 0.11);
          float northernCloud = ellipseMask(dir, 0.82 + uTime * 0.012, 0.29, 0.10, 0.025, 0.10);
          float fastClouds = max(companionCloud, max(scooter, northernCloud));
          procedural = mix(procedural, vec3(0.90, 0.98, 1.0), fastClouds * 0.88);
          procedural += vec3(0.36, 0.84, 1.0) * fastClouds * 0.16;
        }

        if (uPlanetKind == 3) {
          float collar = smoothstep(0.61, 0.78, abs(dir.y)) * (1.0 - smoothstep(0.83, 0.96, abs(dir.y)));
          procedural = mix(procedural, vec3(0.75, 0.98, 0.98), collar * 0.22);
        }

        vec3 textureColor = texture2D(uMap, vec2(fract(vUv.x + uTime * 0.0008), vUv.y)).rgb;
        vec3 color = mix(procedural, textureColor, uTextureStrength);
        color *= 0.88 + broad * 0.18 + fine * 0.07;

        vec3 normal = normalize(vWorldNormal);
        vec3 lightDir = normalize(-vWorldPosition);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float ndl = dot(normal, lightDir);
        float terminator = smoothstep(-0.18, 0.28, ndl);
        float diffuse = 0.16 + max(ndl, 0.0) * 0.9;
        color *= mix(0.075, diffuse, terminator);
        float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
        color += mix(uAccent, uPolarLight, polar) * rim * (uPlanetKind == 4 ? 0.12 : 0.085);
        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
      }
    `,
    depthWrite: true,
    depthTest: true,
  });
}


function createAtmosphereMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        float fresnel = pow(1.0 - max(dot(normalize(vNormalView), normalize(vViewDirection)), 0.0), 3.5);
        float alpha = fresnel * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor * (0.72 + fresnel * 0.5), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
}

function getSegmentCount(base, scale, minimum) {
  return Math.max(minimum, Math.round(base * scale));
}

function addRealisticAtmosphere(planet, config, segmentScale = 1) {
  let color;
  let opacity;
  let scale;
  if (config.name === "Venus") { color = 0xffe4b0; opacity = 0.255; scale = 1.048; }
  else if (GAS_PROFILES[config.name]) {
    const profile = GAS_PROFILES[config.name];
    color = profile.atmosphereColor;
    opacity = profile.atmosphereOpacity;
    scale = config.name === "Jupiter" ? 1.014 : config.name === "Neptune" ? 1.024 : 1.018;
  } else if (config.name === "Mars") { color = 0xe38d53; opacity = 0.082; scale = 1.018; }
  else if (config.name === "Mercury") { return null; }
  else return null;

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(
      config.radius * scale,
      getSegmentCount(144, segmentScale, 72),
      getSegmentCount(120, segmentScale, 56),
    ),
    createAtmosphereMaterial(color, opacity),
  );
  shell.name = `${config.name} atmosphere`;
  planet.add(shell);
  return shell;
}

function createVenusCloudShader({
  baseColor,
  highlightColor,
  shadowColor,
  opacity,
  cloudTexture,
  layer = 0,
  flowSpeed = 1,
  opaque = false,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(baseColor) },
      uHighlight: { value: new THREE.Color(highlightColor) },
      uShadow: { value: new THREE.Color(shadowColor) },
      uOpacity: { value: opacity },
      uCloudMap: { value: cloudTexture },
      uLayer: { value: layer },
      uFlowSpeed: { value: flowSpeed },
      uOpaque: { value: opaque ? 1 : 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vObjectDirection = normalize(position);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uHighlight;
      uniform vec3 uShadow;
      uniform float uOpacity;
      uniform sampler2D uCloudMap;
      uniform float uLayer;
      uniform float uFlowSpeed;
      uniform float uOpaque;

      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
      }

      float fbm3D(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 5; octave++) {
          value += noise3D(p) * amplitude;
          p = p * 2.02 + vec3(8.2, 5.1, 11.4);
          amplitude *= 0.5;
        }
        return value;
      }

      mat2 rotate2D(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(c, -s, s, c);
      }

      void main() {
        vec3 direction = normalize(vObjectDirection);
        float longitude = atan(direction.z, direction.x);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float flowTime = uTime * uFlowSpeed;

        // Venus's cloud tops super-rotate around the planet. Advect the sampled
        // direction rather than merely sliding a flat map, so the flow remains
        // coherent at the poles and across the texture seam.
        vec2 advectedXZ = rotate2D(flowTime * 0.020) * direction.xz;
        vec3 advectedDirection = normalize(vec3(advectedXZ.x, direction.y, advectedXZ.y));
        float broad = fbm3D(advectedDirection * (4.8 + uLayer * 1.7)
          + vec3(flowTime * 0.018, -flowTime * 0.010, flowTime * 0.007));
        float medium = fbm3D(advectedDirection * (13.0 + uLayer * 4.5)
          + vec3(-flowTime * 0.009, flowTime * 0.014, -flowTime * 0.011));
        float fine = fbm3D(advectedDirection * (34.0 + uLayer * 7.0)
          + vec3(flowTime * 0.004, -flowTime * 0.006, flowTime * 0.005));

        // East-west bands, equatorial convection and filamentary streaks are
        // visible in processed spacecraft imagery. Their contrast is deliberately
        // restrained here because human-visible Venus is mostly creamy and bright.
        float zonal = 0.5 + 0.5 * sin(
          latitude * (23.0 + uLayer * 5.0)
          + broad * 4.2
          + sin(longitude * 2.0 + flowTime * 0.012) * 0.75
        );
        float equatorialWeight = 1.0 - smoothstep(0.18, 0.62, abs(direction.y));
        float convection = smoothstep(0.57, 0.81, medium + fine * 0.18)
          * equatorialWeight;
        float filaments = smoothstep(0.48, 0.74,
          0.58 * medium + 0.42 * zonal
        );

        // A subtle Y-shaped planetary wave references the famous ultraviolet
        // pattern without turning the visible-light rendering into false colour.
        float wavePhase = longitude + flowTime * 0.010;
        float yStem = exp(-pow(sin(wavePhase), 2.0) * 22.0)
          * exp(-pow(latitude * 4.6, 2.0));
        float yBranchLatitude = 0.12 + abs(sin(wavePhase * 0.5)) * 0.31;
        float yBranches = exp(-pow((abs(latitude) - yBranchLatitude) * 7.2, 2.0))
          * smoothstep(-0.35, 0.85, cos(wavePhase));
        float yWave = clamp(yStem * 0.42 + yBranches * 0.72, 0.0, 1.0);

        // Polar hoods are brighter and smoother than the turbulent equatorial
        // deck. Fine latitude-aligned structure keeps them from looking painted on.
        float polarHood = smoothstep(0.58, 0.91, abs(direction.y));
        float polarBands = (0.5 + 0.5 * sin(latitude * 56.0 + broad * 3.0))
          * polarHood;

        vec2 mapUv = vec2(
          fract(vUv.x - flowTime * (0.0010 + uLayer * 0.00032)),
          vUv.y
        );
        vec3 observedClouds = texture2D(uCloudMap, mapUv).rgb;
        float observedLuma = dot(observedClouds, vec3(0.2126, 0.7152, 0.0722));

        float structure = clamp(
          observedLuma * 0.32
          + broad * 0.32
          + medium * 0.22
          + fine * 0.06
          + zonal * 0.08,
          0.0,
          1.0
        );

        // In white sunlight Venus is a pearl-to-pale-gold cloud world. Use the
        // source texture only for structure so an orange fallback map cannot tint
        // the whole planet unnaturally.
        vec3 color = mix(uShadow, uBase, smoothstep(0.19, 0.68, structure));
        color = mix(color, uHighlight, smoothstep(0.58, 0.94, structure));
        color = mix(color, uHighlight, convection * 0.18);
        color = mix(color, uShadow * vec3(0.88, 0.92, 1.02), filaments * 0.14);
        color = mix(color, vec3(0.58, 0.45, 0.29), yWave * 0.11);
        color = mix(color, uHighlight, polarHood * (0.16 + polarBands * 0.10));

        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirectionWorld = normalize(cameraPosition - vWorldPosition);
        float ndl = dot(normal, lightDirection);
        float dayBlend = smoothstep(-0.18, 0.30, ndl);
        float diffuse = 0.18 + max(ndl, 0.0) * 0.98;
        float limb = pow(1.0 - max(dot(normal, viewDirectionWorld), 0.0), 2.7);
        float backscatter = pow(max(dot(viewDirectionWorld, lightDirection), 0.0), 10.0);

        // The nightside remains mostly dark in visible light, while the thick
        // atmosphere produces a warm, soft terminator and a luminous sun-facing limb.
        float illumination = mix(0.026 + limb * 0.018, diffuse, dayBlend);
        color *= illumination;
        color += uHighlight * backscatter * dayBlend * 0.075;
        color += vec3(1.0, 0.78, 0.48) * limb * (0.025 + dayBlend * 0.075);

        float density = 0.56 + broad * 0.24 + medium * 0.14 + polarHood * 0.08;
        float alpha = clamp(uOpacity * density + limb * uOpacity * 0.34, 0.0, 0.96);
        alpha = mix(alpha, 1.0, uOpaque);
        gl_FragColor = vec4(max(color, vec3(0.0)), alpha);
      }
    `,
    transparent: !opaque,
    depthWrite: opaque,
    depthTest: true,
  });
}

function addVenusClouds(planet, config, textures, segmentScale = 1) {
  const cloudGroup = new THREE.Group();
  cloudGroup.name = "Venus cloud deck";

  // The lower visible cloud top is deliberately opaque: ordinary visible light
  // cannot see Venus's volcanic surface through the sulfuric-acid cloud deck.
  const lowerClouds = new THREE.Mesh(
    new THREE.SphereGeometry(
      config.radius * 1.011,
      getSegmentCount(208, segmentScale, 104),
      getSegmentCount(168, segmentScale, 80),
    ),
    createVenusCloudShader({
      baseColor: 0xe3c894,
      highlightColor: 0xfff1cf,
      shadowColor: 0x9d7548,
      opacity: 1,
      cloudTexture: textures.venusAtmosphere,
      layer: 0,
      flowSpeed: 1.0,
      opaque: true,
    }),
  );
  lowerClouds.name = "Venus opaque visible cloud tops";
  lowerClouds.rotation.y = 0.28;
  lowerClouds.rotation.z = 0.012;
  cloudGroup.add(lowerClouds);

  const middleClouds = new THREE.Mesh(
    new THREE.SphereGeometry(
      config.radius * 1.019,
      getSegmentCount(176, segmentScale, 88),
      getSegmentCount(144, segmentScale, 72),
    ),
    createVenusCloudShader({
      baseColor: 0xe9cf9c,
      highlightColor: 0xffedc6,
      shadowColor: 0xae8350,
      opacity: 0.28,
      cloudTexture: textures.venusAtmosphere,
      layer: 1,
      flowSpeed: 1.24,
    }),
  );
  middleClouds.name = "Venus super-rotating middle cloud layer";
  middleClouds.rotation.y = 0.86;
  middleClouds.rotation.z = 0.022;
  cloudGroup.add(middleClouds);

  const upperClouds = new THREE.Mesh(
    new THREE.SphereGeometry(
      config.radius * 1.029,
      getSegmentCount(168, segmentScale, 84),
      getSegmentCount(136, segmentScale, 68),
    ),
    createVenusCloudShader({
      baseColor: 0xf0d9aa,
      highlightColor: 0xfff5d9,
      shadowColor: 0xc49a68,
      opacity: 0.155,
      cloudTexture: textures.venusAtmosphere,
      layer: 2,
      flowSpeed: 1.52,
    }),
  );
  upperClouds.name = "Venus high haze and polar hood layer";
  upperClouds.rotation.y = 1.37;
  upperClouds.rotation.z = -0.018;
  cloudGroup.add(upperClouds);

  const softGlow = new THREE.Mesh(
    new THREE.SphereGeometry(
      config.radius * 1.055,
      getSegmentCount(136, segmentScale, 68),
      getSegmentCount(104, segmentScale, 52),
    ),
    createAtmosphereMaterial(0xffdda2, 0.18),
  );
  softGlow.name = "Venus sunlit atmospheric limb";
  cloudGroup.add(softGlow);

  planet.add(cloudGroup);
  return cloudGroup;
}



/**
 * Creates one thin annular band.
 *
 * RingGeometry lies in the XY plane, so it is rotated into the planet's
 * equatorial XZ plane before being added to the ring group.
 */
function createRingBand({
  innerRadius,
  outerRadius,
  color,
  opacity,
  roughness = 0.9,
  texture = null,
  segments = 320,
}) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    roughness,
    metalness: 0,
    alphaTest: 0.008,
    depthWrite: false,
  });

  const band = new THREE.Mesh(
    new THREE.RingGeometry(innerRadius, outerRadius, segments),
    material,
  );
  band.rotation.x = Math.PI * 0.5;
  return band;
}

/**
 * Builds the scientifically known ring systems of the four giant planets.
 *
 * The proportions and opacity are visually exaggerated enough to be readable
 * in a browser, while preserving their relative character:
 * - Saturn: broad, bright and highly structured
 * - Uranus: narrow, dark, sharply separated rings
 * - Jupiter: extremely faint dusty rings
 * - Neptune: dim rings with brighter fragmented arcs
 */
function addGiantPlanetRings(planet, config, textures, segmentScale = 1) {
  const group = new THREE.Group();
  group.name = `${config.name} ring system`;
  const ringSegments = getSegmentCount(320, segmentScale, 128);
  const torusSegments = getSegmentCount(360, segmentScale, 160);

  if (config.name === "Saturn") {
    const r = config.radius;
    const saturnTexture = textures.saturnRing ?? null;

    const bands = [
      // D and C rings: inner, transparent and smoky.
      { innerRadius: r * 1.16, outerRadius: r * 1.30, color: 0x8d7963, opacity: 0.24 },
      { innerRadius: r * 1.31, outerRadius: r * 1.49, color: 0xbca783, opacity: 0.47 },
      // B ring: brightest and densest section.
      { innerRadius: r * 1.51, outerRadius: r * 1.73, color: 0xf0dfba, opacity: 0.91, texture: saturnTexture },
      // Cassini division is represented by the empty space between these bands.
      { innerRadius: r * 1.79, outerRadius: r * 1.96, color: 0xd6bf96, opacity: 0.76, texture: saturnTexture },
      // F ring: narrow outer filament.
      { innerRadius: r * 2.04, outerRadius: r * 2.065, color: 0xf2e6cc, opacity: 0.56 },
    ];

    bands.forEach((profile, index) => {
      const band = createRingBand({ ...profile, segments: ringSegments });
      band.name = `Saturn ring band ${index + 1}`;
      group.add(band);
    });

    // A second extremely thin ring provides a crisp outer glint.
    const outerGlint = createRingBand({
      innerRadius: r * 2.09,
      outerRadius: r * 2.105,
      color: 0xfff7df,
      opacity: 0.28,
      segments: ringSegments,
    });
    group.add(outerGlint);
  }

  if (config.name === "Jupiter") {
    const r = config.radius;
    const bands = [
      { innerRadius: r * 1.20, outerRadius: r * 1.28, color: 0x8b766b, opacity: 0.055 },
      { innerRadius: r * 1.31, outerRadius: r * 1.47, color: 0x9f8d83, opacity: 0.040 },
      { innerRadius: r * 1.49, outerRadius: r * 1.66, color: 0xb3a39a, opacity: 0.025 },
    ];
    bands.forEach((profile, index) => {
      const band = createRingBand({ ...profile, segments: ringSegments });
      band.name = `Jupiter dust ring ${index + 1}`;
      group.add(band);
    });
  }

  if (config.name === "Uranus") {
    const r = config.radius;

    /*
     * Uranus is nearly sideways, so perfectly flat RingGeometry can vanish when
     * viewed edge-on. These rings use very thin TorusGeometry instead, giving
     * every ring a small physical thickness while preserving its narrow shape.
     */
    const ringProfiles = [
      [1.42, 0.010, 0x6e929a, 0.42],
      [1.51, 0.012, 0x91bec5, 0.48],
      [1.60, 0.010, 0x607f87, 0.38],
      [1.71, 0.015, 0xbfe3e7, 0.56],
      [1.83, 0.011, 0x7199a1, 0.41],
      [1.96, 0.014, 0xd2eef0, 0.52],
      [2.11, 0.013, 0x8ebdc3, 0.45],
    ];

    ringProfiles.forEach(([radiusScale, tubeScale, color, opacity], index) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color).multiplyScalar(0.16),
        emissiveIntensity: 0.42,
        transparent: true,
        opacity,
        roughness: 0.72,
        metalness: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          r * radiusScale,
          Math.max(0.012, r * tubeScale),
          8,
          torusSegments,
        ),
        material,
      );
      ring.name = `Uranus three-dimensional ring ${index + 1}`;
      ring.rotation.x = Math.PI * 0.5;
      group.add(ring);
    });

    // A faint, broad dust sheet helps the narrow rings remain readable during
    // scroll-driven camera changes without making Uranus look like Saturn.
    const dustSheet = createRingBand({
      innerRadius: r * 1.38,
      outerRadius: r * 2.18,
      color: 0x87b6bd,
      opacity: 0.035,
      roughness: 1,
      segments: ringSegments,
    });
    dustSheet.name = "Uranus faint ring dust sheet";
    group.add(dustSheet);
  }

  if (config.name === "Neptune") {
    const r = config.radius;
    const bands = [
      { innerRadius: r * 1.40, outerRadius: r * 1.435, color: 0x7897b6, opacity: 0.075 },
      { innerRadius: r * 1.57, outerRadius: r * 1.605, color: 0x9ebfd7, opacity: 0.095 },
      { innerRadius: r * 1.78, outerRadius: r * 1.82, color: 0x64809e, opacity: 0.065 },
      { innerRadius: r * 2.02, outerRadius: r * 2.05, color: 0xaac8dc, opacity: 0.050 },
    ];

    bands.forEach((profile, index) => {
      const band = createRingBand({ ...profile, segments: ringSegments });
      band.name = `Neptune faint ring ${index + 1}`;
      group.add(band);
    });
  }

  // All rings are aligned to the planet's equator. Because the group is a child
  // of the planet mesh, Jupiter/Uranus/Neptune/Saturn axial tilt is inherited.
  planet.add(group);
  return group;
}

/** Creates Neptune's brighter fragmented Adams-ring arcs. */
function addNeptuneDustArcs(planet, config) {
  const count = 1180;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const palette = [
    new THREE.Color(0x7192b5),
    new THREE.Color(0xb6d8ed),
    new THREE.Color(0x4d6988),
    new THREE.Color(0xd0e7f4),
  ];

  for (let index = 0; index < count; index += 1) {
    const i3 = index * 3;
    const lane = index % 3;
    const radius = config.radius * (1.80 + lane * 0.115) + (Math.random() - 0.5) * 0.035;
    let angle = Math.random() * Math.PI * 2;

    // Neptune's Adams ring contains denser named arcs rather than an even ring.
    const selector = Math.random();
    if (selector < 0.50) angle = 0.22 + Math.random() * 0.68;
    else if (selector < 0.73) angle = 2.38 + Math.random() * 0.31;
    else if (selector < 0.88) angle = 4.50 + Math.random() * 0.24;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = (Math.random() - 0.5) * 0.018;
    positions[i3 + 2] = Math.sin(angle) * radius;

    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
    sizes[index] = 0.32 + Math.random() * 0.86;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.21 } },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (115.0 / max(30.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.05, length(uv)) * uOpacity;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const arcs = new THREE.Points(geometry, material);
  arcs.name = "Neptune fragmented Adams arcs";
  arcs.rotation.x = Math.PI * 0.5;
  arcs.rotation.z = 0.07;
  planet.add(arcs);
  return arcs;
}

function createPlanetMaterial(config, textures) {
  const texture = textures[config.texture] ?? makeNoiseTexture(config.texture);
  if (GAS_PROFILES[config.name]) return createGasMaterial(config, texture);
  return createRockyMaterial(config, textures);
}

/** Builds one planet, its specialised layers, and registers it for animation. */
export function createPlanet({
  config,
  textures,
  world,
  orbitRoot,
  planets,
  hoverTargets,
  quality = "high",
}) {
  const segmentScale = quality === "low" ? 0.58 : quality === "medium" ? 0.78 : 1;
  const baseSegments = GAS_PROFILES[config.name]
    ? [192, 128]
    : config.name === "Mercury"
      ? [192, 160]
      : config.name === "Mars"
        ? [200, 168]
        : config.name === "Venus"
          ? [184, 152]
          : [144, 112];
  const segments = [
    getSegmentCount(baseSegments[0], segmentScale, 80),
    getSegmentCount(baseSegments[1], segmentScale, 64),
  ];
  const geometry = new THREE.SphereGeometry(config.radius, segments[0], segments[1]);
  sculptRockyGeometry(geometry, config);
  const mesh = new THREE.Mesh(
    geometry,
    createPlanetMaterial(config, textures),
  );

  mesh.name = config.name;
  mesh.userData = {
    name: config.name,
    orbitRadius: config.orbitRadius,
    orbitSpeed: config.orbitSpeed,
    spinSpeed: config.spinSpeed,
    angle: config.angle,
    meanAnomaly: config.angle,
    orbitEccentricity: config.orbitEccentricity ?? 0,
    orbitRotation: config.orbitRotation ?? 0,
    orbitInclination: config.orbitInclination ?? 0,
    tilt: config.tilt ?? 0,
    focusScale: config.focusScale ?? 1,
    focusDistance: config.focusDistance,
    minFocusDistance: config.minFocusDistance,
    focusEase: config.focusEase,
    focusFov: config.focusFov,
    detail: config.detail,
    visualRadius: config.radius,
    physicalDiameterKm: config.physicalDiameterKm,
    diameterEarths: config.diameterEarths,
    volumeEarths: config.volumeEarths,
    sizeComparison: config.info?.sizeComparison,
    info: config.info,
    visualLayers: {},
  };
  mesh.rotation.z = config.axialTilt ?? 0;

  // Small rocky planets can be only a few pixels wide at system scale. This
  // invisible child enlarges their raycast target without changing appearance.
  if (["Mercury", "Venus", "Mars", "Pluto"].includes(config.name)) {
    const hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(config.radius * 1.32, 24, 24),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    );
    hitTarget.name = `${config.name} interaction target`;
    mesh.add(hitTarget);
  }

  const atmosphere = addRealisticAtmosphere(mesh, config, segmentScale);
  if (atmosphere) mesh.userData.visualLayers.atmosphere = atmosphere;
  if (config.name === "Venus") {
    mesh.userData.visualLayers.clouds = addVenusClouds(mesh, config, textures, segmentScale);
  }
  if (["Jupiter", "Saturn", "Uranus", "Neptune"].includes(config.name)) {
    mesh.userData.visualLayers.ringSystem = addGiantPlanetRings(mesh, config, textures, segmentScale);
    const ringBoundsMultiplier = {
      Jupiter: 1.92,
      Saturn: 2.58,
      Uranus: 2.34,
      Neptune: 2.10,
    }[config.name];
    mesh.userData.focusVisualRadius = config.radius * ringBoundsMultiplier;
  } else {
    mesh.userData.focusVisualRadius = config.radius;
  }
  if (config.name === "Neptune") {
    mesh.userData.visualLayers.dustArcs = addNeptuneDustArcs(mesh, config);
  }

  world.add(mesh);
  planets.push(mesh);
  hoverTargets.push(mesh);

  if (config.orbitRadius > 0) {
    createOrbitLine(
      orbitRoot,
      config.orbitRadius,
      config.orbitColor,
      config.orbitOpacity ?? 0.18,
      config.orbitInclination ?? config.tilt ?? 0,
      config.orbitEccentricity ?? 0,
      config.orbitRotation ?? 0,
    );
  }
  return mesh;
}

/** Updates visual layers that move independently from a planet's solid body. */
export function updatePlanetVisuals(planet, time, motionScale = 1) {
  if (planet.material?.uniforms?.uTime) planet.material.uniforms.uTime.value = time;
  const layers = planet.userData.visualLayers ?? {};
  if (layers.clouds) {
    // Venus's atmosphere super-rotates westward. Every cloud altitude moves in
    // the same broad direction, with small differential speeds between layers.
    layers.clouds.rotation.y -= 0.00024 * motionScale;
    layers.clouds.children.forEach((child, index) => {
      if (child.material?.uniforms?.uTime) child.material.uniforms.uTime.value = time + index * 11.0;
      if (index === 0) child.rotation.y -= 0.00082 * motionScale;
      if (index === 1) child.rotation.y -= 0.00106 * motionScale;
      if (index === 2) child.rotation.y -= 0.00134 * motionScale;
    });
  }
  if (layers.atmosphere) layers.atmosphere.rotation.y -= 0.00018 * motionScale;
  if (layers.ringSystem) layers.ringSystem.rotation.y += 0.000012 * motionScale;
  if (layers.dustArcs) layers.dustArcs.rotation.z += 0.000085 * motionScale;
}

/** Retained for Earth and any future simple layer that still needs it. */
export function addAtmosphere(planet, radius, color, opacity) {
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 96),
    createAtmosphereMaterial(color, opacity),
  );
  planet.add(shell);
  return shell;
}

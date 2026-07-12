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

function createRockyMaterial(config, textures) {
  const map = textures[config.texture] ?? makeNoiseTexture(config.texture);
  return new THREE.MeshStandardMaterial({
    map,
    roughness: config.name === "Venus" ? 0.9 : 0.96,
    metalness: 0,
    bumpMap: config.bump ? map : null,
    bumpScale: config.bump ?? 0,
    normalMap: config.normalTexture ? textures[config.normalTexture] : null,
    normalScale: new THREE.Vector2(config.normalScale ?? 0.55, config.normalScale ?? 0.55),
    envMapIntensity: 0.1,
  });
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

function addRealisticAtmosphere(planet, config) {
  let color;
  let opacity;
  let scale;
  if (config.name === "Venus") { color = 0xffc46b; opacity = 0.23; scale = 1.025; }
  else if (GAS_PROFILES[config.name]) {
    const profile = GAS_PROFILES[config.name];
    color = profile.atmosphereColor;
    opacity = profile.atmosphereOpacity;
    scale = config.name === "Jupiter" ? 1.014 : config.name === "Neptune" ? 1.024 : 1.018;
  } else if (config.name === "Mars") { color = 0xd86c3b; opacity = 0.055; scale = 1.012; }
  else if (config.name === "Mercury") { return null; }
  else return null;

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(config.radius * scale, 128, 96),
    createAtmosphereMaterial(color, opacity),
  );
  shell.name = `${config.name} atmosphere`;
  planet.add(shell);
  return shell;
}

function addVenusClouds(planet, config, texture) {
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(config.radius * 1.012, 128, 96),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffd29a,
      transparent: true,
      opacity: 0.32,
      roughness: 1,
      depthWrite: false,
    }),
  );
  clouds.name = "Venus cloud deck";
  planet.add(clouds);
  return clouds;
}


/**
 * Creates one thin annular band.
 *
 * RingGeometry lies in the XY plane, so it is rotated into the planet's
 * equatorial XZ plane before being added to the ring group.
 */
function createRingBand({ innerRadius, outerRadius, color, opacity, roughness = 0.9, texture = null }) {
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
    new THREE.RingGeometry(innerRadius, outerRadius, 320),
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
function addGiantPlanetRings(planet, config, textures) {
  const group = new THREE.Group();
  group.name = `${config.name} ring system`;

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
      const band = createRingBand(profile);
      band.name = `Saturn ring band ${index + 1}`;
      group.add(band);
    });

    // A second extremely thin ring provides a crisp outer glint.
    const outerGlint = createRingBand({
      innerRadius: r * 2.09,
      outerRadius: r * 2.105,
      color: 0xfff7df,
      opacity: 0.28,
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
      const band = createRingBand(profile);
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
          360,
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
      const band = createRingBand(profile);
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
export function createPlanet({ config, textures, world, orbitRoot, planets, hoverTargets }) {
  const segments = GAS_PROFILES[config.name] ? [192, 128] : [144, 112];
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(config.radius, segments[0], segments[1]),
    createPlanetMaterial(config, textures),
  );

  mesh.name = config.name;
  mesh.userData = {
    name: config.name,
    orbitRadius: config.orbitRadius,
    orbitSpeed: config.orbitSpeed,
    spinSpeed: config.spinSpeed,
    angle: config.angle,
    tilt: config.tilt ?? 0,
    focusScale: config.focusScale ?? 1,
    detail: config.detail,
    info: config.info,
    visualLayers: {},
  };
  mesh.rotation.z = config.axialTilt ?? 0;

  const atmosphere = addRealisticAtmosphere(mesh, config);
  if (atmosphere) mesh.userData.visualLayers.atmosphere = atmosphere;
  if (config.name === "Venus") {
    mesh.userData.visualLayers.clouds = addVenusClouds(mesh, config, textures.venus ?? makeNoiseTexture("venus"));
  }
  if (["Jupiter", "Saturn", "Uranus", "Neptune"].includes(config.name)) {
    mesh.userData.visualLayers.ringSystem = addGiantPlanetRings(mesh, config, textures);
  }
  if (config.name === "Neptune") {
    mesh.userData.visualLayers.dustArcs = addNeptuneDustArcs(mesh, config);
  }

  world.add(mesh);
  planets.push(mesh);
  hoverTargets.push(mesh);

  if (config.orbitRadius > 0) {
    createOrbitLine(orbitRoot, config.orbitRadius, config.orbitColor, config.orbitOpacity ?? 0.18, config.tilt ?? 0);
  }
  return mesh;
}

/** Updates visual layers that move independently from a planet's solid body. */
export function updatePlanetVisuals(planet, time, motionScale = 1) {
  if (planet.material?.uniforms?.uTime) planet.material.uniforms.uTime.value = time;
  const layers = planet.userData.visualLayers ?? {};
  if (layers.clouds) layers.clouds.rotation.y += 0.0016 * motionScale;
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

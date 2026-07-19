import * as THREE from "three";
import { createPlanetAuroraLayer, updatePlanetAuroraLayer, setPlanetAuroraStrength } from "../../graphics/planetAurora.js";

function createMarsAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
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
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(-vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 3.6);
        float daylight = smoothstep(-0.28, 0.30, dot(normal, lightDirection));
        float terminator = 1.0 - abs(dot(normal, lightDirection));
        float blueTwilight = pow(clamp(terminator, 0.0, 1.0), 9.0) * smoothstep(-0.20, 0.08, dot(normal, lightDirection));
        vec3 dustyDay = vec3(0.96, 0.62, 0.40);
        vec3 paleDust = vec3(0.80, 0.47, 0.29);
        vec3 blue = vec3(0.22, 0.56, 1.0);
        vec3 color = mix(paleDust, dustyDay, daylight);
        color = mix(color, blue, blueTwilight * 0.34);
        float alpha = fresnel * mix(0.018, 0.13, daylight);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
}

export function createMarsVisualSystem({ mars, radius, quality = "high" }) {
  const segments = quality === "low" ? 72 : quality === "medium" ? 104 : 144;
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.018, segments, segments),
    createMarsAtmosphereMaterial(),
  );
  atmosphere.name = "Mars thin atmosphere";
  mars.add(atmosphere);

  // Calm state: localized southern-hemisphere discrete aurora associated with
  // crustal magnetic anomalies such as Terra Sirenum / Terra Cimmeria.
  const aurora = createPlanetAuroraLayer({
    planet: mars,
    radius,
    quality,
    shellScale: 1.022,
    latitudeCenter: -0.56,
    latitudeWidth: 0.105,
    mirroredStrength: 0.0,
    longitudeCenter: 2.05,
    longitudeWidth: 0.52,
    secondaryLongitudeCenter: 1.22,
    secondaryLongitudeWidth: 0.42,
    secondaryLongitudeStrength: 0.72,
    globalDiffuseStrength: 0.0,
    intensity: 0.86,
    faceOnVisibility: 0.36,
    daysideVisibility: 0.01,
    arcFrequency: 6.2,
    spikeFrequency: 26.0,
    displacementStrength: 0.010,
    shellAlpha: 0.88,
    animationSpeed: 0.58,
    redFringeStrength: 0.10,
    primaryColor: 0x84C385,
    secondaryColor: 0x1D3557,
    tertiaryColor: 0x4A3B6B,
  });
  aurora.name = "Mars discrete southern aurora";
  aurora.rotation.z = -0.16;
  aurora.rotation.x = 0.05;

  // Solar-storm surge: expands coverage noticeably across a much larger part
  // of the southern nightside, then collapses back to the discrete baseline.
  const stormAurora = createPlanetAuroraLayer({
    planet: mars,
    radius,
    quality,
    shellScale: 1.029,
    latitudeCenter: -0.44,
    latitudeWidth: 0.30,
    mirroredStrength: 0.0,
    longitudeCenter: 2.05,
    longitudeWidth: 1.85,
    secondaryLongitudeCenter: 0.80,
    secondaryLongitudeWidth: 1.45,
    secondaryLongitudeStrength: 0.86,
    globalDiffuseStrength: 0.18,
    intensity: 0.98,
    faceOnVisibility: 0.34,
    daysideVisibility: 0.01,
    arcFrequency: 5.1,
    spikeFrequency: 21.0,
    displacementStrength: 0.009,
    shellAlpha: 0.84,
    animationSpeed: 0.52,
    redFringeStrength: 0.08,
    primaryColor: 0xA1D49B,
    secondaryColor: 0x3A506B,
    tertiaryColor: 0x4A3B6B,
  });
  stormAurora.name = "Mars storm aurora surge";
  stormAurora.rotation.z = -0.08;
  stormAurora.rotation.x = 0.03;
  setPlanetAuroraStrength(stormAurora, 0.0);

  return {
    atmosphere,
    aurora,
    stormAurora,
    stormElapsed: 0,
  };
}

export function updateMarsVisualSystem(system, frameScale = 1) {
  if (!system) return;
  system.atmosphere.rotation.y -= 0.00012 * frameScale;
  updatePlanetAuroraLayer(system.aurora, frameScale, { rotationSpeed: 0.00008 });
  updatePlanetAuroraLayer(system.stormAurora, frameScale, { rotationSpeed: 0.00005 });

  // After ~5 seconds, let a stronger solar-wave event expand the aurora across
  // a much larger southern region, then settle it back to the normal localized patch.
  system.stormElapsed += 0.0166667 * frameScale;
  const cycleDuration = 7.8;
  const calmDuration = 5.0;
  const stormTime = system.stormElapsed % cycleDuration;
  let stormStrength = 0;

  if (stormTime > calmDuration) {
    const phase = stormTime - calmDuration;
    if (phase < 0.85) {
      stormStrength = THREE.MathUtils.smoothstep(phase / 0.85, 0, 1);
    } else if (phase < 1.75) {
      stormStrength = 1.0;
    } else if (phase < 2.8) {
      stormStrength = 1.0 - THREE.MathUtils.smoothstep((phase - 1.75) / 1.05, 0, 1);
    }
  }

  setPlanetAuroraStrength(system.stormAurora, stormStrength);
}

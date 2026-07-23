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

  // Root-cause fix:
  // The earlier calm aurora used only two narrow longitude masks. When those
  // patches rotated onto Mars's far side or sunlit hemisphere, the shader was
  // working correctly but every visible fragment was either occluded or almost
  // fully suppressed by the nightside mask. The storm layer remained visible
  // because it covered a much broader longitude range.
  //
  // Keep the calm state scientifically localized by using two small auroral
  // groups at separated southern crustal-anomaly longitudes. Their combined
  // area remains restrained, but at least one group can normally reach the
  // visible nightside or limb during inspection.
  const aurora = createPlanetAuroraLayer({
    planet: mars,
    radius,
    quality,
    shellScale: 1.023,
    latitudeCenter: -0.58,
    latitudeWidth: 0.145,
    mirroredStrength: 0.0,
    longitudeCenter: 2.05,
    longitudeWidth: 0.62,
    secondaryLongitudeCenter: 1.22,
    secondaryLongitudeWidth: 0.48,
    secondaryLongitudeStrength: 0.80,
    globalDiffuseStrength: 0.0,
    intensity: 1.08,
    faceOnVisibility: 0.54,
    daysideVisibility: 0.025,
    arcFrequency: 6.2,
    spikeFrequency: 26.0,
    displacementStrength: 0.011,
    shellAlpha: 0.94,
    animationSpeed: 0.58,
    redFringeStrength: 0.12,
    primaryColor: 0x84C385,
    secondaryColor: 0x1D3557,
    tertiaryColor: 0x4A3B6B,
  });
  aurora.name = "Mars discrete southern aurora — Terra Sirenum group";
  aurora.rotation.z = -0.12;
  aurora.rotation.x = 0.04;

  const auroraCompanion = createPlanetAuroraLayer({
    planet: mars,
    radius,
    quality,
    shellScale: 1.024,
    latitudeCenter: -0.54,
    latitudeWidth: 0.125,
    mirroredStrength: 0.0,
    longitudeCenter: -0.62,
    longitudeWidth: 0.54,
    secondaryLongitudeCenter: -1.48,
    secondaryLongitudeWidth: 0.42,
    secondaryLongitudeStrength: 0.66,
    globalDiffuseStrength: 0.0,
    intensity: 0.94,
    faceOnVisibility: 0.52,
    daysideVisibility: 0.025,
    arcFrequency: 6.7,
    spikeFrequency: 28.0,
    displacementStrength: 0.010,
    shellAlpha: 0.92,
    animationSpeed: 0.54,
    redFringeStrength: 0.10,
    primaryColor: 0x84C385,
    secondaryColor: 0x1D3557,
    tertiaryColor: 0x4A3B6B,
  });
  auroraCompanion.name = "Mars discrete southern aurora — Terra Cimmeria group";
  auroraCompanion.rotation.z = 0.10;
  auroraCompanion.rotation.x = -0.03;

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
    daysideVisibility: 0.02,
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
    auroraCompanion,
    stormAurora,
    stormElapsed: 0,
  };
}

export function updateMarsVisualSystem(system, frameScale = 1, deltaSeconds = 1 / 60) {
  if (!system) return;
  system.atmosphere.rotation.y -= 0.00012 * frameScale;
  updatePlanetAuroraLayer(system.aurora, frameScale, { rotationSpeed: 0.000035 });
  updatePlanetAuroraLayer(system.auroraCompanion, frameScale, { rotationSpeed: -0.000028 });
  updatePlanetAuroraLayer(system.stormAurora, frameScale, { rotationSpeed: 0.00005 });

  // Calm-mode layers are always active; only the storm overlay is time-gated.
  setPlanetAuroraStrength(system.aurora, 1.0);
  setPlanetAuroraStrength(system.auroraCompanion, 1.0);

  // The event cadence uses real elapsed time rather than frameScale. frameScale
  // deliberately drops to a tiny value while Mars is focused, and previously
  // stretched this five-second wait into several minutes. The plasma animation
  // above still respects slow motion; only the event trigger keeps real time.
  const safeDeltaSeconds = THREE.MathUtils.clamp(
    Number.isFinite(deltaSeconds) ? deltaSeconds : 1 / 60,
    0,
    0.05,
  );
  system.stormElapsed += safeDeltaSeconds;

  // After ~5 seconds, let a stronger solar-wave event expand the aurora across
  // a much larger southern region, then settle it back to the normal localized patch.
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

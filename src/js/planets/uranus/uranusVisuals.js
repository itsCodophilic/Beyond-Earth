import * as THREE from "three";
import {
  createPlanetAuroraLayer,
  updatePlanetAuroraLayer,
  setPlanetAuroraStrength,
} from "../../graphics/planetAurora.js";

function createUranusHazeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vLocalNormal = normalize(position);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vLocalNormal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 local = normalize(vLocalNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float limb = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        float northHood = smoothstep(0.10, 0.82, local.y);
        float hoodCore = smoothstep(0.28, 0.96, local.y);
        float collar = smoothstep(0.02, 0.18, local.y) * (1.0 - smoothstep(0.28, 0.44, local.y));
        float equatorialShadow = 1.0 - smoothstep(0.06, 0.34, abs(local.y));
        vec3 base = vec3(0.81, 0.96, 0.96);
        vec3 hood = vec3(0.92, 1.0, 1.0);
        vec3 colour = mix(base, hood, northHood * 0.42 + hoodCore * 0.20 + collar * 0.16);
        colour = mix(colour, vec3(0.74, 0.90, 0.91), equatorialShadow * 0.10);
        float shimmer = 0.96 + 0.04 * sin(local.x * 10.0 + local.z * 7.0 + uTime * 0.15);
        float alpha = 0.07 + limb * 0.24 + northHood * 0.06;
        alpha *= shimmer;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

export function createUranusVisualSystem({ uranus, radius, quality = "high" }) {
  if (!uranus) return null;

  const genericAtmosphere = uranus.userData?.visualLayers?.atmosphere ?? null;
  if (genericAtmosphere) genericAtmosphere.visible = false;

  const segmentScale = quality === "low" ? 0.60 : quality === "medium" ? 0.80 : 1;
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius * 1.034,
      Math.round(156 * segmentScale),
      Math.round(112 * segmentScale),
    ),
    createUranusHazeMaterial(),
  );
  haze.name = "Uranus methane haze shell";
  haze.renderOrder = 5;
  uranus.add(haze);

  // Uranus auroras are not neatly centered on the geographic poles because the
  // magnetic field is strongly tilted and offset. Two off-axis bands plus a
  // broader glow suggest that lopsided geometry while remaining readable.
  const auroraNorth = createPlanetAuroraLayer({
    planet: uranus,
    radius,
    quality,
    shellScale: 1.041,
    latitudeCenter: 0.76,
    latitudeWidth: 0.050,
    mirroredStrength: 0.0,
    longitudeCenter: 0.62,
    longitudeWidth: 0.42,
    secondaryLongitudeCenter: 1.08,
    secondaryLongitudeWidth: 0.28,
    secondaryLongitudeStrength: 0.28,
    globalDiffuseStrength: 0.0,
    intensity: 1.08,
    faceOnVisibility: 0.86,
    daysideVisibility: 0.18,
    arcFrequency: 6.4,
    spikeFrequency: 24.0,
    displacementStrength: 0.0055,
    shellAlpha: 0.54,
    animationSpeed: 0.46,
    redFringeStrength: 0.04,
    primaryColor: 0xefffff,
    secondaryColor: 0x8fcfff,
    tertiaryColor: 0xffffff,
    spiralStrength: 0.82,
    spiralTurns: 1.05,
    spiralInnerRadius: 0.11,
    spiralRadiusSpan: 0.14,
    spiralArmWidth: 0.050,
    spiralPhase: -0.18,
    spiralDirection: 1,
    spiralTwistNoise: 0.10,
    spiralHemisphere: 1,
    side: THREE.FrontSide,
  });
  auroraNorth.name = "Uranus northern off-axis aurora";
  auroraNorth.rotation.z = 1.08;
  auroraNorth.rotation.x = 0.38;
  auroraNorth.rotation.y = 0.18;

  const auroraSouth = createPlanetAuroraLayer({
    planet: uranus,
    radius,
    quality,
    shellScale: 1.040,
    latitudeCenter: -0.70,
    latitudeWidth: 0.056,
    mirroredStrength: 0.0,
    longitudeCenter: -0.90,
    longitudeWidth: 0.40,
    secondaryLongitudeCenter: -1.32,
    secondaryLongitudeWidth: 0.26,
    secondaryLongitudeStrength: 0.24,
    globalDiffuseStrength: 0.0,
    intensity: 0.94,
    faceOnVisibility: 0.82,
    daysideVisibility: 0.15,
    arcFrequency: 6.0,
    spikeFrequency: 22.0,
    displacementStrength: 0.0050,
    shellAlpha: 0.48,
    animationSpeed: 0.40,
    redFringeStrength: 0.04,
    primaryColor: 0xf2ffff,
    secondaryColor: 0x84c4ff,
    tertiaryColor: 0xffffff,
    spiralStrength: 0.78,
    spiralTurns: 1.02,
    spiralInnerRadius: 0.12,
    spiralRadiusSpan: 0.13,
    spiralArmWidth: 0.054,
    spiralPhase: 0.16,
    spiralDirection: -1,
    spiralTwistNoise: 0.10,
    spiralHemisphere: -1,
    side: THREE.FrontSide,
  });
  auroraSouth.name = "Uranus southern off-axis aurora";
  auroraSouth.rotation.z = 0.98;
  auroraSouth.rotation.x = 0.34;
  auroraSouth.rotation.y = -0.12;

  const auroraGlow = createPlanetAuroraLayer({
    planet: uranus,
    radius,
    quality,
    shellScale: 1.047,
    latitudeCenter: 0.73,
    latitudeWidth: 0.092,
    mirroredStrength: 0.18,
    longitudeCenter: 0.55,
    longitudeWidth: 0.72,
    secondaryLongitudeCenter: -0.96,
    secondaryLongitudeWidth: 0.58,
    secondaryLongitudeStrength: 0.20,
    globalDiffuseStrength: 0.05,
    intensity: 0.58,
    faceOnVisibility: 0.84,
    daysideVisibility: 0.14,
    arcFrequency: 4.0,
    spikeFrequency: 14.0,
    displacementStrength: 0.0030,
    shellAlpha: 0.22,
    animationSpeed: 0.30,
    redFringeStrength: 0.03,
    primaryColor: 0xfbffff,
    secondaryColor: 0xc6e1ff,
    tertiaryColor: 0xffffff,
    spiralStrength: 0.38,
    spiralTurns: 1.0,
    spiralInnerRadius: 0.11,
    spiralRadiusSpan: 0.18,
    spiralArmWidth: 0.090,
    spiralPhase: -0.08,
    spiralDirection: 1,
    spiralTwistNoise: 0.08,
    spiralHemisphere: 1,
    side: THREE.FrontSide,
  });
  auroraGlow.name = "Uranus broad aurora glow";
  auroraGlow.rotation.z = 1.05;
  auroraGlow.rotation.x = 0.36;
  auroraGlow.rotation.y = 0.08;

  return { haze, auroraNorth, auroraSouth, auroraGlow, elapsed: 0 };
}

export function updateUranusVisualSystem(system, frameScale = 1, deltaSeconds = 1 / 60) {
  if (!system) return;
  system.elapsed += deltaSeconds;

  if (system.haze?.material?.uniforms?.uTime) {
    system.haze.material.uniforms.uTime.value += 0.018 * frameScale;
    system.haze.rotation.y += 0.00012 * frameScale;
  }

  updatePlanetAuroraLayer(system.auroraNorth, frameScale, { rotationSpeed: 0.00009 });
  updatePlanetAuroraLayer(system.auroraSouth, frameScale, { rotationSpeed: -0.00008 });
  updatePlanetAuroraLayer(system.auroraGlow, frameScale, { rotationSpeed: 0.00005 });

  const pulse = 1.02 + 0.10 * Math.sin(system.elapsed * 0.55);
  const northStrength = 1.02 + 0.10 * Math.sin(system.elapsed * 0.42 + 0.8);
  const southStrength = 0.94 + 0.09 * Math.sin(system.elapsed * 0.37 + 2.0);
  setPlanetAuroraStrength(system.auroraNorth, northStrength * pulse);
  setPlanetAuroraStrength(system.auroraSouth, southStrength * pulse);
  setPlanetAuroraStrength(system.auroraGlow, 0.98 * pulse);
}

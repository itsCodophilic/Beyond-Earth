import * as THREE from "three";
import {
  createPlanetAuroraLayer,
  updatePlanetAuroraLayer,
  setPlanetAuroraStrength,
} from "../../graphics/planetAurora.js";

export function createSaturnVisualSystem({ saturn, radius, quality = "high" }) {
  if (!saturn) return null;

  // Saturn's aurora is present at both poles. The northern oval is typically
  // tighter and a little brighter, while the southern oval is broader and more
  // subdued. In human-visible colour, lower hydrogen emission reads pinkish-
  // red and the upper parts shift into violet/purple.
  const northAurora = createPlanetAuroraLayer({
    planet: saturn,
    radius,
    quality,
    shellScale: 1.027,
    latitudeCenter: 0.968,
    latitudeWidth: 0.030,
    mirroredStrength: 0.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 1.22,
    faceOnVisibility: 0.68,
    daysideVisibility: 0.12,
    arcFrequency: 8.4,
    spikeFrequency: 34.0,
    displacementStrength: 0.010,
    shellAlpha: 0.82,
    animationSpeed: 0.76,
    redFringeStrength: 0.72,
    primaryColor: 0xFF6B7D,
    secondaryColor: 0xD570F4,
    tertiaryColor: 0x7B2CBF,
    spiralStrength: 1.0,
    spiralTurns: 1.52,
    spiralInnerRadius: 0.020,
    spiralRadiusSpan: 0.205,
    spiralArmWidth: 0.024,
    spiralPhase: -0.26,
    spiralDirection: 1,
    spiralTwistNoise: 0.22,
    spiralHemisphere: 1,
    side: THREE.FrontSide,
  });
  northAurora.name = "Saturn northern spiral aurora";
  northAurora.rotation.z = -0.05;
  northAurora.rotation.x = 0.02;

  const northGlow = createPlanetAuroraLayer({
    planet: saturn,
    radius,
    quality,
    shellScale: 1.032,
    latitudeCenter: 0.976,
    latitudeWidth: 0.034,
    mirroredStrength: 0.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.50,
    faceOnVisibility: 0.64,
    daysideVisibility: 0.10,
    arcFrequency: 6.6,
    spikeFrequency: 24.0,
    displacementStrength: 0.007,
    shellAlpha: 0.28,
    animationSpeed: 0.62,
    redFringeStrength: 0.58,
    primaryColor: 0xFF6B7D,
    secondaryColor: 0xB94FE9,
    tertiaryColor: 0x7B2CBF,
    spiralStrength: 1.0,
    spiralTurns: 1.40,
    spiralInnerRadius: 0.022,
    spiralRadiusSpan: 0.214,
    spiralArmWidth: 0.042,
    spiralPhase: -0.18,
    spiralDirection: 1,
    spiralTwistNoise: 0.28,
    spiralHemisphere: 1,
    side: THREE.FrontSide,
  });
  northGlow.name = "Saturn northern aurora glow";
  northGlow.rotation.z = -0.03;

  const southAurora = createPlanetAuroraLayer({
    planet: saturn,
    radius,
    quality,
    shellScale: 1.026,
    latitudeCenter: -0.958,
    latitudeWidth: 0.035,
    mirroredStrength: 0.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 1.08,
    faceOnVisibility: 0.64,
    daysideVisibility: 0.02,
    arcFrequency: 7.8,
    spikeFrequency: 31.0,
    displacementStrength: 0.009,
    shellAlpha: 0.74,
    animationSpeed: 0.70,
    redFringeStrength: 0.68,
    primaryColor: 0xFF6B7D,
    secondaryColor: 0xC968F2,
    tertiaryColor: 0x7B2CBF,
    spiralStrength: 1.0,
    spiralTurns: 1.46,
    spiralInnerRadius: 0.024,
    spiralRadiusSpan: 0.228,
    spiralArmWidth: 0.026,
    spiralPhase: 0.14,
    spiralDirection: -1,
    spiralTwistNoise: 0.22,
    spiralHemisphere: -1,
    side: THREE.FrontSide,
  });
  southAurora.name = "Saturn southern spiral aurora";
  southAurora.rotation.z = 0.04;
  southAurora.rotation.x = -0.02;

  const southGlow = createPlanetAuroraLayer({
    planet: saturn,
    radius,
    quality,
    shellScale: 1.031,
    latitudeCenter: -0.968,
    latitudeWidth: 0.040,
    mirroredStrength: 0.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.58,
    faceOnVisibility: 0.60,
    daysideVisibility: 0.015,
    arcFrequency: 6.2,
    spikeFrequency: 22.0,
    displacementStrength: 0.006,
    shellAlpha: 0.30,
    animationSpeed: 0.58,
    redFringeStrength: 0.56,
    primaryColor: 0xFF6B7D,
    secondaryColor: 0xB958EB,
    tertiaryColor: 0x7B2CBF,
    spiralStrength: 1.0,
    spiralTurns: 1.34,
    spiralInnerRadius: 0.026,
    spiralRadiusSpan: 0.238,
    spiralArmWidth: 0.046,
    spiralPhase: 0.22,
    spiralDirection: -1,
    spiralTwistNoise: 0.28,
    spiralHemisphere: -1,
    side: THREE.FrontSide,
  });
  southGlow.name = "Saturn southern aurora glow";
  southGlow.rotation.z = 0.02;

  // Optional brighter simultaneous surge roughly every five seconds, inspired
  // by the Mars time-gated effect, while preserving the calmer baseline ovals.
  const northSurge = createPlanetAuroraLayer({
    planet: saturn,
    radius,
    quality,
    shellScale: 1.036,
    latitudeCenter: 0.974,
    latitudeWidth: 0.046,
    mirroredStrength: 0.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.88,
    faceOnVisibility: 0.62,
    daysideVisibility: 0.10,
    arcFrequency: 5.8,
    spikeFrequency: 18.0,
    displacementStrength: 0.006,
    shellAlpha: 0.22,
    animationSpeed: 0.56,
    redFringeStrength: 0.66,
    primaryColor: 0xFF7C8C,
    secondaryColor: 0xCE72F5,
    tertiaryColor: 0x7B2CBF,
    spiralStrength: 1.0,
    spiralTurns: 1.28,
    spiralInnerRadius: 0.028,
    spiralRadiusSpan: 0.248,
    spiralArmWidth: 0.060,
    spiralPhase: -0.16,
    spiralDirection: 1,
    spiralTwistNoise: 0.26,
    spiralHemisphere: 1,
    side: THREE.FrontSide,
  });
  northSurge.name = "Saturn northern aurora surge";
  setPlanetAuroraStrength(northSurge, 0.0);

  const southSurge = createPlanetAuroraLayer({
    planet: saturn,
    radius,
    quality,
    shellScale: 1.035,
    latitudeCenter: -0.972,
    latitudeWidth: 0.050,
    mirroredStrength: 0.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.82,
    faceOnVisibility: 0.60,
    daysideVisibility: 0.015,
    arcFrequency: 5.5,
    spikeFrequency: 17.0,
    displacementStrength: 0.005,
    shellAlpha: 0.24,
    animationSpeed: 0.52,
    redFringeStrength: 0.62,
    primaryColor: 0xFF7A89,
    secondaryColor: 0xC86BF2,
    tertiaryColor: 0x7B2CBF,
    spiralStrength: 1.0,
    spiralTurns: 1.26,
    spiralInnerRadius: 0.030,
    spiralRadiusSpan: 0.255,
    spiralArmWidth: 0.064,
    spiralPhase: 0.18,
    spiralDirection: -1,
    spiralTwistNoise: 0.26,
    spiralHemisphere: -1,
    side: THREE.FrontSide,
  });
  southSurge.name = "Saturn southern aurora surge";
  setPlanetAuroraStrength(southSurge, 0.0);

  saturn.userData.visualLayers.saturnNorthAurora = northAurora;
  saturn.userData.visualLayers.saturnNorthGlow = northGlow;
  saturn.userData.visualLayers.saturnSouthAurora = southAurora;
  saturn.userData.visualLayers.saturnSouthGlow = southGlow;
  saturn.userData.visualLayers.saturnNorthSurge = northSurge;
  saturn.userData.visualLayers.saturnSouthSurge = southSurge;

  return {
    saturn,
    northAurora,
    northGlow,
    southAurora,
    southGlow,
    northSurge,
    southSurge,
    stormElapsed: 0,
  };
}

export function updateSaturnVisualSystem(system, frameScale = 1) {
  if (!system) return;

  updatePlanetAuroraLayer(system.northAurora, frameScale, { rotationSpeed: 0.00008 });
  updatePlanetAuroraLayer(system.northGlow, frameScale, { rotationSpeed: 0.00005 });
  updatePlanetAuroraLayer(system.southAurora, frameScale, { rotationSpeed: -0.00007 });
  updatePlanetAuroraLayer(system.southGlow, frameScale, { rotationSpeed: -0.00004 });
  updatePlanetAuroraLayer(system.northSurge, frameScale, { rotationSpeed: 0.00003 });
  updatePlanetAuroraLayer(system.southSurge, frameScale, { rotationSpeed: -0.00003 });

  setPlanetAuroraStrength(system.northAurora, 1.0);
  setPlanetAuroraStrength(system.northGlow, 1.0);
  setPlanetAuroraStrength(system.southAurora, 1.0);
  setPlanetAuroraStrength(system.southGlow, 1.0);

  system.stormElapsed += 0.0166667 * frameScale;
  const cycleDuration = 7.6;
  const calmDuration = 5.0;
  const stormTime = system.stormElapsed % cycleDuration;
  let stormStrength = 0;

  if (stormTime > calmDuration) {
    const phase = stormTime - calmDuration;
    if (phase < 0.80) {
      stormStrength = THREE.MathUtils.smoothstep(phase / 0.80, 0, 1);
    } else if (phase < 1.55) {
      stormStrength = 1.0;
    } else if (phase < 2.60) {
      stormStrength = 1.0 - THREE.MathUtils.smoothstep((phase - 1.55) / 1.05, 0, 1);
    }
  }

  setPlanetAuroraStrength(system.northSurge, stormStrength);
  setPlanetAuroraStrength(system.southSurge, stormStrength * 0.96);
}

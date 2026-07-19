import * as THREE from "three";
import {
  createJupiterAtmosphereMaterial,
  createJupiterSurfaceMaterial,
} from "./jupiter.js";
import {
  createPlanetAuroraLayer,
  updatePlanetAuroraLayer,
} from "../../graphics/planetAurora.js";

const origin = new THREE.Vector3();
const worldPosition = new THREE.Vector3();

export function createJupiterVisualSystem({
  jupiter,
  textures,
  radius,
  quality = "high",
}) {
  if (!jupiter) return null;

  // Root-cause correction: Jupiter is created by the shared planet factory.
  // The former specialised createJupiter() builder was never called by main.js,
  // so all authored cloud, polar, Great Red Spot, atmosphere, and aurora work
  // existed in an unused code path.
  const previousMaterial = jupiter.material;
  jupiter.material = createJupiterSurfaceMaterial(textures.jupiter);
  jupiter.material.needsUpdate = true;
  previousMaterial?.dispose?.();

  // Hide the generic giant-planet atmosphere so it cannot mute the dedicated
  // blue/violet/white polar colors and the narrow auroral ovals.
  const genericAtmosphere = jupiter.userData?.visualLayers?.atmosphere ?? null;
  if (genericAtmosphere) genericAtmosphere.visible = false;

  const segmentScale = quality === "low" ? 0.60 : quality === "medium" ? 0.80 : 1;
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius * 1.018,
      Math.round(160 * segmentScale),
      Math.round(112 * segmentScale),
    ),
    createJupiterAtmosphereMaterial(),
  );
  atmosphere.name = "Jupiter dedicated upper atmosphere";
  jupiter.add(atmosphere);

  // Telescope data is commonly mapped into visible electric blue, turquoise,
  // and orange. Jupiter's polar emission is kept compact and spiral-shaped,
  // but the pole center is now intentionally filled so the dark middle no
  // longer reads like a hollow hole. Three closely stacked layers build the
  // result: a tighter main spiral, a denser glow spiral, and a compact polar
  // cap that floods the center with auroral colour.
  const auroraOval = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.026,
    latitudeCenter: 0.984,
    latitudeWidth: 0.024,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 1.58,
    faceOnVisibility: 0.74,
    daysideVisibility: 0.20,
    arcFrequency: 8.8,
    spikeFrequency: 40.0,
    displacementStrength: 0.008,
    shellAlpha: 0.98,
    animationSpeed: 0.94,
    redFringeStrength: 0.84,
    primaryColor: 0x1268ff,
    secondaryColor: 0x2ff4dc,
    tertiaryColor: 0xff8a24,
    spiralStrength: 1.0,
    spiralTurns: 1.92,
    spiralInnerRadius: 0.018,
    spiralRadiusSpan: 0.224,
    spiralArmWidth: 0.026,
    spiralPhase: -0.42,
    spiralDirection: 1,
    spiralTwistNoise: 0.24,
  });
  auroraOval.name = "Jupiter compact electric-blue spiral aurora";

  const auroraCap = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.030,
    latitudeCenter: 0.988,
    latitudeWidth: 0.032,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.84,
    faceOnVisibility: 0.70,
    daysideVisibility: 0.14,
    arcFrequency: 7.0,
    spikeFrequency: 30.0,
    displacementStrength: 0.005,
    shellAlpha: 0.74,
    animationSpeed: 0.68,
    redFringeStrength: 0.60,
    primaryColor: 0x087cff,
    secondaryColor: 0x36ffe2,
    tertiaryColor: 0xffa13a,
    spiralStrength: 1.0,
    spiralTurns: 1.88,
    spiralInnerRadius: 0.020,
    spiralRadiusSpan: 0.214,
    spiralArmWidth: 0.046,
    spiralPhase: -0.35,
    spiralDirection: 1,
    spiralTwistNoise: 0.30,
  });
  auroraCap.name = "Jupiter turquoise spiral aurora glow";

  const auroraCore = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.024,
    latitudeCenter: 0.996,
    latitudeWidth: 0.074,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.22,
    intensity: 0.92,
    faceOnVisibility: 0.78,
    daysideVisibility: 0.18,
    arcFrequency: 5.8,
    spikeFrequency: 24.0,
    displacementStrength: 0.003,
    shellAlpha: 0.58,
    animationSpeed: 0.58,
    redFringeStrength: 0.46,
    primaryColor: 0x1e73ff,
    secondaryColor: 0x5dffe7,
    tertiaryColor: 0xffa95a,
    spiralStrength: 0.0,
    spiralTurns: 1.10,
    spiralInnerRadius: 0.0,
    spiralRadiusSpan: 0.10,
    spiralArmWidth: 0.090,
    spiralPhase: 0.0,
    spiralDirection: 1,
    spiralTwistNoise: 0.10,
  });
  auroraCore.name = "Jupiter polar aurora core fill";

  jupiter.userData.visualLayers.jupiterAtmosphere = atmosphere;
  jupiter.userData.visualLayers.jupiterAuroraOval = auroraOval;
  jupiter.userData.visualLayers.jupiterAuroraCap = auroraCap;
  jupiter.userData.visualLayers.jupiterAuroraCore = auroraCore;

  return {
    jupiter,
    atmosphere,
    auroraOval,
    auroraCap,
    auroraCore,
  };
}

export function updateJupiterVisualSystem(
  system,
  time,
  frameScale = 1,
) {
  if (!system) return;

  const {
    jupiter,
    atmosphere,
    auroraOval,
    auroraCap,
    auroraCore,
  } = system;

  if (jupiter.material?.uniforms?.uTime) {
    jupiter.material.uniforms.uTime.value = time;
  }

  if (atmosphere.material?.uniforms?.uTime) {
    atmosphere.material.uniforms.uTime.value = time;
  }

  if (jupiter.material?.uniforms?.uLightDirection) {
    jupiter.getWorldPosition(worldPosition);
    jupiter.material.uniforms.uLightDirection.value
      .copy(origin)
      .sub(worldPosition)
      .normalize();
  }

  atmosphere.rotation.y -= 0.00072 * frameScale;
  updatePlanetAuroraLayer(
    auroraOval,
    frameScale,
    { rotationSpeed: 0.00012 },
  );
  updatePlanetAuroraLayer(
    auroraCap,
    frameScale,
    { rotationSpeed: 0.00008 },
  );
  updatePlanetAuroraLayer(
    auroraCore,
    frameScale,
    { rotationSpeed: 0.00005 },
  );
}

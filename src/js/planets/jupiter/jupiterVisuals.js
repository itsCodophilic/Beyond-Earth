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
  // and orange. Jupiter's polar emission also curls inward as an open spiral,
  // so the former broad circular oval is replaced with two compact spiral
  // layers: a crisp main arm plus a softer, slightly offset particle glow.
  const auroraOval = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.026,
    latitudeCenter: 0.982,
    latitudeWidth: 0.022,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 1.36,
    faceOnVisibility: 0.72,
    daysideVisibility: 0.20,
    arcFrequency: 7.2,
    spikeFrequency: 34.0,
    displacementStrength: 0.008,
    shellAlpha: 0.98,
    animationSpeed: 0.92,
    redFringeStrength: 0.84,
    primaryColor: 0x1268ff,
    secondaryColor: 0x2ff4dc,
    tertiaryColor: 0xff8a24,
    spiralStrength: 1.0,
    spiralTurns: 1.38,
    spiralInnerRadius: 0.058,
    spiralRadiusSpan: 0.235,
    spiralArmWidth: 0.017,
    spiralPhase: -0.38,
    spiralDirection: 1,
    spiralTwistNoise: 0.34,
  });
  auroraOval.name = "Jupiter compact electric-blue spiral aurora";

  const auroraCap = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.030,
    latitudeCenter: 0.986,
    latitudeWidth: 0.028,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.64,
    faceOnVisibility: 0.66,
    daysideVisibility: 0.14,
    arcFrequency: 5.6,
    spikeFrequency: 25.0,
    displacementStrength: 0.005,
    shellAlpha: 0.72,
    animationSpeed: 0.66,
    redFringeStrength: 0.58,
    primaryColor: 0x087cff,
    secondaryColor: 0x36ffe2,
    tertiaryColor: 0xffa13a,
    spiralStrength: 1.0,
    spiralTurns: 1.32,
    spiralInnerRadius: 0.072,
    spiralRadiusSpan: 0.205,
    spiralArmWidth: 0.031,
    spiralPhase: -0.22,
    spiralDirection: 1,
    spiralTwistNoise: 0.42,
  });
  auroraCap.name = "Jupiter turquoise spiral aurora glow";

  jupiter.userData.visualLayers.jupiterAtmosphere = atmosphere;
  jupiter.userData.visualLayers.jupiterAuroraOval = auroraOval;
  jupiter.userData.visualLayers.jupiterAuroraCap = auroraCap;

  return {
    jupiter,
    atmosphere,
    auroraOval,
    auroraCap,
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
}

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

  // Jupiter has persistent auroral ovals around both magnetic poles. The oval
  // is narrow and intense; a softer cap layer supplies the surrounding haze.
  const auroraOval = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.035,
    latitudeCenter: 0.915,
    latitudeWidth: 0.058,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: Math.PI * 0.5,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.55,
    globalDiffuseStrength: 0.0,
    intensity: 1.48,
    faceOnVisibility: 0.68,
    daysideVisibility: 0.24,
    arcFrequency: 4.8,
    spikeFrequency: 27.0,
    displacementStrength: 0.014,
    shellAlpha: 1.0,
    animationSpeed: 1.0,
    redFringeStrength: 0.08,
    primaryColor: 0x70dcff,
    secondaryColor: 0xffffff,
    tertiaryColor: 0x8b78ff,
  });
  auroraOval.name = "Jupiter bright magnetic auroral ovals";

  const auroraCap = createPlanetAuroraLayer({
    planet: jupiter,
    radius,
    quality,
    shellScale: 1.043,
    latitudeCenter: 0.970,
    latitudeWidth: 0.090,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.10,
    intensity: 0.92,
    faceOnVisibility: 0.60,
    daysideVisibility: 0.16,
    arcFrequency: 3.4,
    spikeFrequency: 18.0,
    displacementStrength: 0.010,
    shellAlpha: 0.84,
    animationSpeed: 0.70,
    redFringeStrength: 0.10,
    primaryColor: 0x55d7ff,
    secondaryColor: 0xcbd8ff,
    tertiaryColor: 0x7662ff,
  });
  auroraCap.name = "Jupiter polar ultraviolet haze";

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
    { rotationSpeed: 0.00022 },
  );
  updatePlanetAuroraLayer(
    auroraCap,
    frameScale,
    { rotationSpeed: -0.00010 },
  );
}

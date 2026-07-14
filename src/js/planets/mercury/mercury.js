import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Mercury;

export const mercury = {
  name: "Mercury", texture: "mercury", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.72, spinSpeed: 0.003, axialTilt: 0.001, angle: 0.8,
  bump: 0.028, orbitColor: 0x9d9386,
  detail: "Smallest planet | 0.38× Earth diameter", focusScale: 2.8,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.10, focusFov: 36,
  info: {
    type: "Planet", diameter: "4,879 km", orbitalSpeed: "47.36 km/s",
    distanceFromEarth: "≈ 77 million km at closest approach",
    sizeComparison: getPlanetSizeComparison("Mercury"),
    description: "A cratered iron world racing around the Sun, where sunrise to sunset lasts longer than its year.",
  },
};

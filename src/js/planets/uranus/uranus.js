import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Uranus;

export const uranus = {
  name: "Uranus", texture: "uranus", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.055, spinSpeed: 0.011, axialTilt: 1.71, angle: 4.8,
  bump: 0.005, orbitColor: 0x9ee9f2,
  detail: "Ice giant | sideways axial tilt", focusScale: 1,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.07, focusFov: 34,
  info: {
    type: "Planet", diameter: "50,724 km", orbitalSpeed: "6.81 km/s",
    distanceFromEarth: "≈ 2.6 billion km at closest approach",
    sizeComparison: getPlanetSizeComparison("Uranus"),
    description: "A serene blue-green ice giant rotating almost on its side, surrounded by faint rings and distant moons.",
  },
};

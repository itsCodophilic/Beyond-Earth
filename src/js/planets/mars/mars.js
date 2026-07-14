import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Mars;

export const mars = {
  name: "Mars", texture: "mars", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.25, spinSpeed: 0.01, axialTilt: 0.44, angle: 5.3,
  bump: 0.065, orbitColor: 0xd06a37,
  detail: "Red planet | about half Earth diameter", focusScale: 2.1,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.10, focusFov: 36,
  info: {
    type: "Planet", diameter: "6,779 km", orbitalSpeed: "24.07 km/s",
    distanceFromEarth: "≈ 54.6 million km at closest approach",
    sizeComparison: getPlanetSizeComparison("Mars"),
    description: "A cold desert of rust-red dunes, immense volcanoes, ancient river valleys, and two tiny moons.",
  },
};

import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Venus;

export const venus = {
  name: "Venus", texture: "venus", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.46, spinSpeed: -0.0015, axialTilt: 3.1, angle: 2.2,
  bump: 0.01, orbitColor: 0xe0b36a,
  detail: "Earth-size world | retrograde spin", focusScale: 1.55,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.09, focusFov: 36,
  info: {
    type: "Planet", diameter: "12,104 km", orbitalSpeed: "35.02 km/s",
    distanceFromEarth: "≈ 38 million km at closest approach",
    sizeComparison: getPlanetSizeComparison("Venus"),
    description: "A luminous cloud-covered world with volcanic plains, crushing pressure, and a day longer than its year.",
  },
};

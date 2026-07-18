import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Pluto;

export const pluto = {
  name: "Pluto",
  texture: "pluto",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.030,
  spinSpeed: -0.0032,
  axialTilt: 2.09,
  angle: 4.72,
  orbitEccentricity: 0.2488,
  orbitRotation: 1.93,
  orbitInclination: 0.299,
  bump: 0.030,
  orbitColor: 0xa9a0b8,
  orbitOpacity: 0.14,
  detail: "Dwarf planet · Kuiper Belt world",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.88,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet",
    diameter: "2,376.6 km",
    orbitalSpeed: "4.74 km/s",
    distanceFromEarth: "Varies from roughly 4.28 to 7.52 billion km",
    sizeComparison: getPlanetSizeComparison("Pluto"),
    description: "A geologically active Kuiper Belt dwarf planet with nitrogen-ice plains, water-ice mountains, reddish tholins, and a five-moon system dominated by Charon.",
  },
};

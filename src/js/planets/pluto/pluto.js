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
  // Pluto is tiny compared with its scene-space orbit, so a denser guide keeps
  // the rendered polyline centred on the same analytical path as the dwarf planet.
  orbitSegments: 1440,
  bump: 0.030,
  orbitColor: 0xa9a0b8,
  orbitOpacity: 0.14,
  detail: "Dwarf planet · Kuiper Belt world",
  focusScale: 2.6,
  // Wider framing for the expanded five-moon portrait. The outer Hydra orbit
  // now has enough breathing room while Pluto and all moons remain visible.
  minFocusDistance: 3.35,
  focusDistance: 3.95,
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

import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Saturn;

export const saturn = {
  name: "Saturn", texture: "saturn", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.08, spinSpeed: 0.017, axialTilt: 0.47, angle: 3.1,
  orbitEccentricity: 0.0539, orbitRotation: 4.16, orbitInclination: 0.043,
  bump: 0.01, orbitColor: 0xd9bd84,
  detail: "Ringed giant | about 9× Earth diameter", focusScale: 0.82,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.07, focusFov: 34,
  info: {
    type: "Planet", diameter: "116,460 km", orbitalSpeed: "9.69 km/s",
    distanceFromEarth: "≈ 1.2 billion km at closest approach",
    sizeComparison: getPlanetSizeComparison("Saturn"),
    description: "A pale gas giant encircled by countless shards of ice and rock forming the Solar System's grandest rings.",
  },
};

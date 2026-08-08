import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Neptune;

export const neptune = {
  name: "Neptune", texture: "neptune", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.043, spinSpeed: 0.012, axialTilt: 0.49, angle: 0.05,
  orbitEccentricity: 0.0086, orbitRotation: 0.62, orbitInclination: 0.031,
  bump: 0.005, orbitColor: 0x5f83ff,
  detail: "Most distant planet | about 30 AU", focusScale: 1,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.07, focusFov: 34,
  info: {
    type: "Planet", diameter: "49,244 km", orbitalSpeed: "5.43 km/s",
    distanceFromEarth: "≈ 4.3 billion km at closest approach",
    sizeComparison: getPlanetSizeComparison("Neptune"),
    rings: "Five principal rings extend outward as Galle, Le Verrier, Lassell, Arago, and Adams. They are extremely faint and dusty compared with Saturn's bright icy rings. The outer Adams ring contains four prominent dust arcs: Liberté, Egalité, Fraternité, and Courage.",
    description: "A deep-blue ice giant where supersonic winds race through bright methane clouds at the edge of the planetary system.",
  },
};

import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Uranus;

export const uranus = {
  name: "Uranus", texture: "uranus", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.055, spinSpeed: 0.011, axialTilt: 1.71, angle: 4.8,
  orbitEccentricity: 0.0473, orbitRotation: 5.05, orbitInclination: 0.013,
  bump: 0.004, orbitColor: 0x9ee9f2,
  detail: "Ice giant | hydrogen, helium, and methane atmosphere", focusScale: 1,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.07, focusFov: 34,
  info: {
    type: "Planet", diameter: "50,724 km", orbitalSpeed: "6.81 km/s",
    distanceFromEarth: "≈ 2.6 billion km at closest approach",
    sizeComparison: getPlanetSizeComparison("Uranus"),
    rings: "Thirteen known rings extend outward as Zeta, 6, 5, 4, Alpha, Beta, Eta, Gamma, Delta, Lambda, Epsilon, Nu, and Mu. The narrow inner rings are dark grey; Nu is reddish and Mu is blue from fine water-ice dust.",
    description: "A pale methane-rich ice giant with a hydrogen-helium atmosphere, deep water-ammonia-methane interior, a broad bright polar hood, dark narrow rings, and off-axis auroras shaped by its strongly tilted magnetic field.",
  },
};

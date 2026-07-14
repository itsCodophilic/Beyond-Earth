import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Earth;

export const earth = {
  name: "Earth", texture: "earth", normalTexture: "earthNormal", radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius, physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.34, spinSpeed: 0.012, axialTilt: 0.41,
  angle: 4.35, normalScale: 0.55, orbitColor: 0x7de7ff,
  detail: "Home planet | 12,756 km diameter", focusScale: 1.75,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.08, focusFov: 34,
  info: {
    type: "Planet", diameter: "12,756 km", orbitalSpeed: "29.78 km/s",
    distanceFromEarth: "0 km — your current reference point",
    sizeComparison: getPlanetSizeComparison("Earth"),
    description: "An ocean world wrapped in a living atmosphere—the only known place where life has transformed an entire planet.",
  },
};

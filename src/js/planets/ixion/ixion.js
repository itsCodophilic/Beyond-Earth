import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Ixion;

/**
 * 28978 Ixion.
 *
 * One of the dwarf-planet candidates that was missing. Four were in the scene
 * -- Orcus, Quaoar, Gonggong, Sedna -- which is a selection rather than the
 * set: roughly ten more are considered very likely and over a hundred are
 * possible. These four are the strongest of the ones that were absent.
 *
 * Orbital elements are the real ones. The surface is generated rather than
 * photographed, from measured albedo and colour, for the reason set out in
 * `graphics/dwarfWorldTextures.js`: nothing out here has ever been resolved
 * into more than a handful of pixels.
 */
export const ixion = {
  name: "Ixion",
  texture: "ixion",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.0298,
  spinSpeed: 0.027,
  axialTilt: 0.12,
  angle: 1.94,
  orbitEccentricity: 0.2418,
  orbitRotation: 5.9832,
  orbitInclination: 0.3421,
  // Small on screen relative to how eccentric and inclined they are, so the
  // guide needs far more segments than an inner planet's to stay on the same
  // analytical path as the body travelling along it.
  orbitSegments: 1200,
  bump: 0.03,
  orbitColor: 0x8fa3ad,
  orbitOpacity: 0.26,
  detail: "Dwarf planet candidate | A Plutino in Pluto's resonance",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "697 (+11 / −9) km",
    orbitalSpeed: "4.72 km/s",
    distanceFromEarth: "Varies from roughly 4.49 to 7.38 billion km",
    sizeComparison: getPlanetSizeComparison("Ixion"),
    description: "A moderately red Plutino locked in the same 2:3 resonance with Neptune that Pluto is, on an orbit eccentric enough to cross inside Neptune's. Water ice has been detected only weakly; the surface is dominated by tholins, the reddish organic residue that forms when radiation works on simple ices for billions of years. No moon, and no ring: a 2026 occultation campaign that measured the body to within a few kilometres found no companion and no circum-object material. With no moon there is nothing to weigh it with, so Ixion's mass and density are still unknown.",
  },
};

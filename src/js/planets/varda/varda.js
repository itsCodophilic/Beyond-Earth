import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Varda;

/**
 * 174567 Varda.
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
export const varda = {
  name: "Varda",
  texture: "varda",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.0268,
  spinSpeed: 0.058,
  axialTilt: 0.2,
  angle: 0.77,
  orbitEccentricity: 0.1427,
  orbitRotation: 4.03,
  orbitInclination: 0.3757,
  // Small on screen relative to how eccentric and inclined they are, so the
  // guide needs far more segments than an inner planet's to stay on the same
  // analytical path as the body travelling along it.
  orbitSegments: 1200,
  bump: 0.03,
  orbitColor: 0x8fa3ad,
  orbitOpacity: 0.26,
  detail: "Dwarf planet candidate | A binary in the classical belt",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "740 ± 14 km",
    orbitalSpeed: "4.41 km/s",
    distanceFromEarth: "Varies from roughly 5.86 to 7.81 billion km",
    sizeComparison: getPlanetSizeComparison("Varda"),
    description: "A classical Kuiper Belt world with a large companion, Ilmarë — some 400 km across, holding between a tenth and a sixth of the system's mass, which is very nearly the Pluto–Charon ratio. JWST places Varda in the carbon-dioxide-dominated class: frozen CO₂ rather than water ice as the dominant surface material, at about 44 kelvin. Its orbit is stable on a twenty-two-billion-year timescale, which is longer than the universe has existed.",
  },
};

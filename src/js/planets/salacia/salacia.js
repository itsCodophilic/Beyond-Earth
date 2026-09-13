import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Salacia;

/**
 * 120347 Salacia.
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
export const salacia = {
  name: "Salacia",
  texture: "salacia",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.0283,
  spinSpeed: 0.056,
  axialTilt: 0.15,
  angle: 3.61,
  orbitEccentricity: 0.1062,
  orbitRotation: 1.22,
  orbitInclination: 0.4172,
  // Small on screen relative to how eccentric and inclined they are, so the
  // guide needs far more segments than an inner planet's to stay on the same
  // analytical path as the body travelling along it.
  orbitSegments: 1200,
  bump: 0.03,
  orbitColor: 0x8fa3ad,
  orbitOpacity: 0.26,
  detail: "Dwarf planet candidate | One of the darkest large worlds known",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "838 ± 44 km",
    orbitalSpeed: "4.58 km/s",
    distanceFromEarth: "Varies from roughly 5.20 to 7.44 billion km",
    sizeComparison: getPlanetSizeComparison("Salacia"),
    description: "Very nearly the size of Ceres, and reflecting about four per cent of the light that reaches it — one of the darkest large bodies in the Solar System, and why it was not found until 2004 despite that size. Its moon Actaea is nearly half its diameter, and the two are locked face to face: a 2025 study found Salacia's day and Actaea's month are the same 5.49 days, so neither body will ever see the other's far side.",
  },
};

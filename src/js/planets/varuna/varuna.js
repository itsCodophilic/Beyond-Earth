import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Varuna;

/**
 * 20000 Varuna.
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
export const varuna = {
  name: "Varuna",
  texture: "varuna",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.0279,
  spinSpeed: 0.105,
  axialTilt: 0.43,
  angle: 5.28,
  orbitEccentricity: 0.0511,
  orbitRotation: 2.44,
  orbitInclination: 0.2998,
  // Small on screen relative to how eccentric and inclined they are, so the
  // guide needs far more segments than an inner planet's to stay on the same
  // analytical path as the body travelling along it.
  orbitSegments: 1200,
  bump: 0.03,
  orbitColor: 0x8fa3ad,
  orbitOpacity: 0.26,
  detail: "Dwarf planet candidate | Spinning fast enough to deform",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "≈ 668 km equivalent · about 1,000 km on its long axis",
    orbitalSpeed: "4.54 km/s",
    distanceFromEarth: "Varies from roughly 6.09 to 6.75 billion km",
    sizeComparison: getPlanetSizeComparison("Varuna"),
    description: "One of the fastest rotators of its size anywhere: a day of 6 hours 21 minutes, quick enough that gravity has lost the argument with its own spin and the whole world has been pulled into a rugby-ball shape about a thousand kilometres along its long axis — a Jacobi ellipsoid, the same thing that happened to Haumea. Its density is a shade under water's, so it is less a solid body than a loosely bound pile of ice and rock that never quite collapsed into a sphere. No moon is confirmed: a residual wobble in its light curve has been read as a close-in companion, but that remains a hypothesis rather than a detection.",
  },
};

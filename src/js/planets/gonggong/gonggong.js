import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Gonggong;

/**
 * 225088 Gonggong.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const gonggong = {
  name: "Gonggong",
  texture: "gonggong",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 546.79-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.01361,
  // 22.4-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.02190,
  axialTilt: 0.1400,
  angle: 3.95,
  orbitEccentricity: 0.5043,
  orbitRotation: 3.2020,
  orbitInclination: 0.5393,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1440,
  bump: 0.028,
  orbitColor: 0xd08a72,
  orbitOpacity: 0.31,
  detail: "Dwarf planet candidate | One of the reddest worlds known",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "1,230 km",
    orbitalSpeed: "3.40 km/s",
    distanceFromEarth: "Varies from roughly 4.51 to 15.2 billion km",
    sizeComparison: getPlanetSizeComparison("Gonggong"),
    description: "Among the reddest large bodies beyond Neptune, its deep water-ice absorption bands buried under tholins, with carbon dioxide, ethane ice and complex organics detected by JWST. Locked in a 3:10 resonance with Neptune, its unusually slow 22-hour spin was probably braked by tides from its moon Xiangliu.",
  },
};

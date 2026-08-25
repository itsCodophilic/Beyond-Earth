import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Orcus;

/**
 * 90482 Orcus.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const orcus = {
  name: "Orcus",
  texture: "orcus",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 247.1-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.03011,
  // 13.19-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.03719,
  axialTilt: 0.1000,
  angle: 0.42,
  orbitEccentricity: 0.2205,
  orbitRotation: 5.9685,
  orbitInclination: 0.3588,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1200,
  bump: 0.03,
  orbitColor: 0x8fa3ad,
  orbitOpacity: 0.31,
  detail: "Dwarf planet candidate | The anti-Pluto",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "958.4 km",
    orbitalSpeed: "4.69 km/s",
    distanceFromEarth: "Varies from roughly 4.59 to 7.19 billion km",
    sizeComparison: getPlanetSizeComparison("Orcus"),
    description: "A neutral-grey Kuiper Belt world of crystalline water ice with ammonia and ethane, sharing Pluto's 2:3 resonance with Neptune on a near-mirror orbit — always at the opposite phase. Its moon Vanth is about 440 km across, making the pair very nearly a binary.",
  },
};

import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Quaoar;

/**
 * 50000 Quaoar.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const quaoar = {
  name: "Quaoar",
  texture: "quaoar",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 283.51-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.02624,
  // 17.6788-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.02775,
  axialTilt: 0.1200,
  angle: 2.05,
  orbitEccentricity: 0.0352,
  orbitRotation: 6.1458,
  orbitInclination: 0.1395,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1200,
  bump: 0.026,
  orbitColor: 0xc79b86,
  orbitOpacity: 0.31,
  detail: "Dwarf planet candidate | Rings where a moon should be",
  focusScale: 2.6,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "1,098 km",
    orbitalSpeed: "4.53 km/s",
    distanceFromEarth: "Varies from roughly 5.93 to 6.83 billion km",
    sizeComparison: getPlanetSizeComparison("Quaoar"),
    description: "A moderately red world of crystalline water ice with traces of methane, carbon dioxide and ethane, its crystalline ice hinting at past cryovolcanism. Two narrow rings found by occultation in 2023 orbit far outside its Roche limit, where theory says the material should long ago have gathered into a moon.",
  },
};

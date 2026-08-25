import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Sedna;

/**
 * 90377 Sedna.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const sedna = {
  name: "Sedna",
  texture: "sedna",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 11390-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.00065,
  // 10.273-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.04775,
  axialTilt: 0.1600,
  angle: 5.8,
  orbitEccentricity: 0.8496,
  orbitRotation: 1.6699,
  orbitInclination: 0.2082,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1440,
  bump: 0.03,
  orbitColor: 0xb85f45,
  orbitOpacity: 0.29,
  detail: "Sednoid | Perihelion beyond Neptune's reach",
  focusScale: 2.5,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet candidate",
    diameter: "≈ 906 km",
    orbitalSpeed: "1.04 km/s",
    distanceFromEarth: "Varies from roughly 11.2 to 140 billion km",
    sizeComparison: getPlanetSizeComparison("Sedna"),
    description: "One of the reddest objects in the Solar System, nearly as red as Mars, mixing water, carbon dioxide and ethane ices with methane-derived tholins. Its perihelion of 76 AU lies far outside Neptune's gravitational reach, which is why its detached orbit is cited as evidence either for an undiscovered distant planet or for a stellar encounter in the Sun's birth cluster.",
  },
};

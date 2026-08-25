import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Eris;

/**
 * 136199 Eris.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const eris = {
  name: "Eris",
  texture: "eris",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 559.94-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.01329,
  // 378.86-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.00129,
  axialTilt: 1.3614,
  angle: 5.02,
  orbitEccentricity: 0.4382,
  orbitRotation: 3.2603,
  orbitInclination: 0.7667,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1440,
  bump: 0.012,
  orbitColor: 0xeef2f6,
  orbitOpacity: 0.38,
  detail: "Dwarf planet | The reason Pluto was reclassified",
  focusScale: 2.9,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet",
    diameter: "2,326 km",
    orbitalSpeed: "3.43 km/s",
    distanceFromEarth: "Varies from roughly 5.55 to 14.7 billion km",
    sizeComparison: getPlanetSizeComparison("Eris"),
    description: "Almost pure white and among the most reflective surfaces known, coated in methane and nitrogen ice that JWST finds is continually refreshed by sublimation and refreezing. Slightly more massive than Pluto, its discovery forced the IAU to define the word planet in 2006. It is tidally locked to its moon Dysnomia.",
  },
};

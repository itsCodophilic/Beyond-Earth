import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Makemake;

/**
 * 136472 Makemake.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const makemake = {
  name: "Makemake",
  texture: "makemake",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 307.64-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.02418,
  // 22.83-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.02149,
  axialTilt: 1.0821,
  angle: 3.05,
  orbitEccentricity: 0.1589,
  orbitRotation: 0.2861,
  orbitInclination: 0.5066,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1440,
  bump: 0.022,
  orbitColor: 0xe0a98a,
  orbitOpacity: 0.36,
  detail: "Dwarf planet | Methane ice, no nitrogen",
  focusScale: 2.7,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet",
    diameter: "1,430 km",
    orbitalSpeed: "4.38 km/s",
    distanceFromEarth: "Varies from roughly 5.30 to 7.75 billion km",
    sizeComparison: getPlanetSizeComparison("Makemake"),
    description: "A very bright reddish-brown world reflecting some 82% of the light that reaches it, covered in centimetre-sized grains of frozen methane with ethane and acetylene tholins — and conspicuously lacking the nitrogen and carbon monoxide ices that coat Pluto and Eris. Hubble found a dark moon in 2016.",
  },
};

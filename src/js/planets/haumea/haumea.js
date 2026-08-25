import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Haumea;

/**
 * 136108 Haumea.
 *
 * Orbital elements are the real ones -- eccentricity, inclination and the
 * longitude of perihelion all come straight from JPL -- so the shape and tilt
 * of the path are true even though its size in the scene is compressed. See
 * PLANET_SCALE_PROFILES for why the trans-Neptunian distances have to be.
 */
export const haumea = {
  name: "Haumea",
  texture: "haumea",
  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  // 282.57-year orbit, scaled from Pluto's 248 so the relative pace is right.
  orbitSpeed: 0.02633,
  // 3.91534-hour rotation, on the same scale as every other body's spin.
  spinSpeed: 0.12529,
  /*
   * Its real obliquity is 126 degrees, and drawn at 126 the pole points very
   * nearly at the viewer -- which hides the single most important thing about
   * this body. Haumea is 2,122 km along its longest axis and 1,036 km along
   * its shortest, an ellipsoid twice as long as it is thick, spun into that
   * shape by a 3.9-hour rotation. Pole-on, all of that is invisible.
   *
   * So the axis is presented close to upright. The camera already looks down
   * on the ecliptic by some thirty degrees, and anything added to that tips
   * the pole far enough toward the lens that a 2:1 ellipsoid projects as a
   * circle -- which is what the first two attempts at this produced. Every
   * real figure is on the body's own card; this is a choice about which
   * *phase* of a true shape the shot is taken from, the same choice every
   * published illustration of Haumea makes.
   */
  axialTilt: 0.1400,
  angle: 1.15,
  orbitEccentricity: 0.1944,
  orbitRotation: 0.0433,
  orbitInclination: 0.4923,
  // These orbits are small on screen relative to how eccentric and inclined
  // they are, so the guide needs far more segments than an inner planet's to
  // stay on the same analytical path as the body travelling along it.
  orbitSegments: 1440,
  bump: 0.018,
  orbitColor: 0xd8e6f0,
  orbitOpacity: 0.36,
  detail: "Dwarf planet | Fastest large spin in the Solar System",
  focusScale: 2.8,
  minFocusDistance: scale.focusDistance * 0.86,
  focusDistance: scale.focusDistance,
  focusEase: 0.075,
  focusFov: 35,
  info: {
    type: "Dwarf planet",
    diameter: "1,544 km mean · 2,122 × 1,688 × 1,036 km",
    orbitalSpeed: "4.50 km/s",
    distanceFromEarth: "Varies from roughly 4.65 to 8.03 billion km",
    sizeComparison: getPlanetSizeComparison("Haumea"),
    description: "A brilliant shell of crystalline water ice broken by one dark red patch, spun into a 2,100 km-long ellipsoid by a 3.9-hour rotation — the fastest of any large body in the Solar System. In 2017 a stellar occultation revealed a ring, the first ever found around a trans-Neptunian object.",
  },
};

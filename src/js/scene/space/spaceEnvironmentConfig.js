/**
 * Central artistic and performance settings for the space environment.
 *
 * Counts favour tiny stable stars over large transparent clouds. The Milky Way
 * is a distant, restrained band and must never become a bright enclosing fog.
 */
export const JOURNEY_MAP = Object.freeze({
  sun: 0,
  mercury: 0.08,
  venus: 0.16,
  earth: 0.25,
  moon: 0.29,
  mars: 0.36,
  asteroidBelt: 0.46,
  jupiter: 0.56,
  saturn: 0.67,
  uranus: 0.77,
  neptune: 0.86,
  pluto: 0.92,
  kuiperBelt: 0.95,
  interstellar: 1,
});

export const QUALITY_PRESETS = Object.freeze({
  high: {
    backgroundStars: 30000,
    galacticStars: 26000,
    parallaxStars: 1300,
    heroStars: 72,
    galaxies: 96,
    dust: 1180,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: true,
    dustEnabled: true,
  },
  medium: {
    backgroundStars: 21000,
    galacticStars: 18500,
    parallaxStars: 900,
    heroStars: 52,
    galaxies: 72,
    dust: 760,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: true,
    dustEnabled: true,
  },
  low: {
    backgroundStars: 12000,
    galacticStars: 10000,
    parallaxStars: 480,
    heroStars: 28,
    galaxies: 40,
    dust: 280,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: false,
    dustEnabled: false,
  },
});

export const SPACE_ENVIRONMENT_CONFIG = Object.freeze({
  radii: {
    dustMaximum: 460,
    parallaxMinimum: 680,
    parallaxMaximum: 1120,
    galaxyShell: 1880,
    heroStarShell: 1940,
    backgroundStarShell: 2060,
    milkyWayShell: 2180,
  },
  exposure: {
    innerSolar: 1.00,
    middleSolar: 1.04,
    outerSolar: 1.08,
    interstellar: 1.12,
  },
  damping: {
    environment: 3.5,
  },
  // A diagonal galactic plane reads naturally during the long zoom-out while
  // avoiding the previous horizontal line wrapped around the entire scene.
  milkyWayRotation: [0.25, -0.10, -0.32],
});

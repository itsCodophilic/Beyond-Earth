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
  kuiperBelt: 0.94,
  interstellar: 1,
});

export const QUALITY_PRESETS = Object.freeze({
  high: {
    maxPixelRatio: 2,
    backgroundStars: 30000,
    galacticStars: 26000,
    parallaxStars: 1300,
    heroStars: 72,
    galaxies: 96,
    dust: 720,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: true,
    dustEnabled: true,
  },
  medium: {
    maxPixelRatio: 1.5,
    backgroundStars: 21000,
    galacticStars: 18500,
    parallaxStars: 900,
    heroStars: 52,
    galaxies: 72,
    dust: 420,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: true,
    dustEnabled: true,
  },
  low: {
    maxPixelRatio: 1.25,
    backgroundStars: 12000,
    galacticStars: 10000,
    parallaxStars: 480,
    heroStars: 28,
    galaxies: 40,
    dust: 180,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: false,
    dustEnabled: false,
  },
});

export const SPACE_ENVIRONMENT_CONFIG = Object.freeze({
  radii: {
    dustMaximum: 225,
    parallaxMinimum: 680,
    parallaxMaximum: 1120,
    galaxyShell: 1720,
    heroStarShell: 1780,
    backgroundStarShell: 1860,
    milkyWayShell: 1960,
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

/** Selects quality from measurable capabilities rather than user-agent text. */
export function detectQualityPreset({ reducedMotion = false } = {}) {
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  const demandingDisplay = window.devicePixelRatio > 2.2;

  if (shortSide < 560 || cores <= 4 || memory <= 3) return "low";
  if (reducedMotion || shortSide < 850 || cores <= 6 || memory <= 6 || demandingDisplay) {
    return "medium";
  }
  return "high";
}

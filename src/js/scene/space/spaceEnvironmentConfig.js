/**
 * Central artistic and performance settings for the space environment.
 *
 * Keeping these values outside the builders makes visual tuning possible
 * without searching through shader or geometry code.
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
    backgroundStars: 18500,
    galacticStars: 26000,
    parallaxStars: 1800,
    heroStars: 30,
    galaxies: 52,
    dust: 2800,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: true,
    dustEnabled: true,
  },
  medium: {
    maxPixelRatio: 1.5,
    backgroundStars: 11000,
    galacticStars: 16000,
    parallaxStars: 1050,
    heroStars: 20,
    galaxies: 34,
    dust: 1500,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: true,
    dustEnabled: true,
  },
  low: {
    maxPixelRatio: 1.25,
    backgroundStars: 6000,
    galacticStars: 8000,
    parallaxStars: 520,
    heroStars: 10,
    galaxies: 18,
    dust: 600,
    heroStarsEnabled: true,
    galaxiesEnabled: true,
    zodiacalLightEnabled: false,
    dustEnabled: false,
  },
});

export const SPACE_ENVIRONMENT_CONFIG = Object.freeze({
  radii: {
    dustMaximum: 235,
    parallaxMinimum: 760,
    parallaxMaximum: 1320,
    galaxyShell: 1780,
    heroStarShell: 1940,
    backgroundStarShell: 2050,
    milkyWayShell: 2140,
  },
  exposure: {
    innerSolar: 1.06,
    middleSolar: 1.13,
    outerSolar: 1.18,
    interstellar: 1.22,
  },
  damping: {
    environment: 3.8,
  },
  milkyWayRotation: [-0.17, 0, 0.18],
});

/**
 * Selects quality from measurable capabilities rather than user-agent text.
 * Reduced-motion users start one tier lower because they have explicitly asked
 * for a calmer experience, which also reduces transparent overdraw.
 */
export function detectQualityPreset({ reducedMotion = false } = {}) {
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  // Browsers that hide these optional signals should not automatically be
  // punished with a low tier; viewport and pixel density still provide guards.
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = navigator.deviceMemory ?? 8;
  const demandingDisplay = window.devicePixelRatio > 2.2;

  if (shortSide < 560 || cores <= 4 || memory <= 3) return "low";
  if (reducedMotion || shortSide < 850 || cores <= 6 || memory <= 6 || demandingDisplay) {
    return "medium";
  }
  return "high";
}

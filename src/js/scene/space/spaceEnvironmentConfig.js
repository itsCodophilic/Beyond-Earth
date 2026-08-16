/**
 * Central artistic and performance settings for the space environment.
 *
 * The solar system is presented against empty space. The former deep-sky
 * backdrop -- star shells, the Milky Way band, the distant galaxy field and the
 * interplanetary haze -- has been removed along with its modules; only the
 * zodiacal light remains, together with the journey-driven exposure curve.
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
  high: { zodiacalLightEnabled: true },
  medium: { zodiacalLightEnabled: true },
  low: { zodiacalLightEnabled: false },
});

export const SPACE_ENVIRONMENT_CONFIG = Object.freeze({
  radii: {
    zodiacalLightShell: 1260,
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
});

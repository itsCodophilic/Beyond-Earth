/**
 * Central artistic and performance settings for the space environment.
 *
 * The deep-sky backdrop was removed once and is back, rebuilt. The version
 * that was removed was a scatter of white dots on black, and a scatter of
 * white dots is worse than nothing: it reads as a screensaver and it flattens
 * the planets in front of it. Empty black really was the better of those two.
 *
 * It was not the only other option. What is there now is the actual sky -- the
 * Milky Way on its real great circle with its real dust lanes, the eighty-odd
 * stars brighter than magnitude 2.5 at their real J2000 positions in their
 * real colours, the naked-eye nebulae and clusters at their real angular
 * sizes, and Andromeda three degrees across up in the north. See deepSky.js.
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
  /*
   * The trans-Neptunian worlds share the last tenth of the journey with the
   * Kuiper Belt, because that is where they are. The spacing here is not the
   * spacing of their orbits -- Sedna's semi-major axis is thirteen times
   * Pluto's -- it is how much of the scroll each one is worth, and every one
   * of them is worth roughly the same: a small icy world a very long way out.
   */
  orcus: 0.925,
  haumea: 0.932,
  quaoar: 0.938,
  makemake: 0.944,
  kuiperBelt: 0.95,
  gonggong: 0.962,
  eris: 0.972,
  sedna: 0.986,
  interstellar: 1,
});

export const QUALITY_PRESETS = Object.freeze({
  /*
   * The star counts look extravagant and are not. This is one draw call of
   * one-pixel points with no overdraw and no texture fetch worth speaking of;
   * ninety thousand of them cost about a megabyte of static buffer and are
   * cheaper to render than the 1024x512 painted sphere they replaced. They
   * have to be that many, because the Milky Way is an unresolved star field
   * and the only way to draw one honestly is with a great many small stars.
   */
  high: { zodiacalLightEnabled: true, deepSkyEnabled: true, deepSkyStars: 90000, deepSkyMotes: 2800 },
  medium: { zodiacalLightEnabled: true, deepSkyEnabled: true, deepSkyStars: 60000, deepSkyMotes: 2000 },
  low: { zodiacalLightEnabled: false, deepSkyEnabled: true, deepSkyStars: 24000, deepSkyMotes: 800 },
});

export const SPACE_ENVIRONMENT_CONFIG = Object.freeze({
  radii: {
    zodiacalLightShell: 1260,
    /*
     * Outside Pluto's orbit (2,006 units) and well inside the far plane
     * (7,500). The number has no physical meaning -- the nearest thing on this
     * shell is four light years away and the furthest is two and a half
     * million, and no single scale represents both -- so the only constraints
     * on it are that nothing in the Solar System can reach it and that the
     * frustum can always contain it.
     */
    deepSkyShell: 3000,
    /* The near-field dust box, which the camera always sits in the middle of. */
    deepSkyMoteSpan: 320,
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

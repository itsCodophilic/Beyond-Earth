/**
 * Small conversions shared by the Rank 7-10 catalogues (comets, the
 * interstellar visitors, the Trojans and Lucy targets, the near-Earth
 * oddities), so the same measurement is turned into the same number in all
 * four files. Node-safe: no three.js, no DOM.
 */
import { chromaFromBR } from "./tnoCatalogue.js";

/* sqrt(GM_sun / 1 AU) = 29.7847 km/s: the circular speed at 1 AU
 * (GM_sun 1.32712440018e20 m^3/s^2, AU 149,597,870.7 km). */
const V1AU = 29.7847;

/** Vis-viva speed at distance r on an orbit of semi-major axis a, km/s. */
export function speedAt(aAU, rAU) {
  return V1AU * Math.sqrt(Math.max(0, 2 / rAU - 1 / aAU));
}

/** The same on an open orbit, |a| given: v^2 = GM (2/r + 1/|a|). */
export function hyperbolicSpeedAt(aAbsAU, rAU) {
  return V1AU * Math.sqrt(2 / rAU + 1 / aAbsAU);
}

/*
 * A card's orbital-speed line: the speed on 27 September 2026 at the JPL
 * Horizons distance quoted with each record, the speed at perihelion, and
 * the period.
 */
export function speedLine(aAU, e, rNowAU, { periodYears = aAU ** 1.5, note = "" } = {}) {
  const q = aAU * (1 - e);
  const now = speedAt(aAU, rNowAU);
  const peri = speedAt(aAU, q);
  const years = periodYears >= 100
    ? `${Math.round(periodYears).toLocaleString("en-GB")} years`
    : `${periodYears.toFixed(periodYears < 10 ? 2 : 1)} years`;
  return `${now.toFixed(1)} km/s now (${rNowAU.toFixed(2)} AU from the Sun, 27 Sep 2026); ${peri.toFixed(1)} km/s at perihelion · one orbit takes ${years}${note}`;
}

/*
 * The distance on 27 September 2026 (JD 2461310.5) from a record's own
 * element set, for bodies with no Horizons distance quoted: two-body
 * propagation of the mean anomaly from the set's epoch, as smallBodies.js
 * does when it places the body.
 */
export const CARD_DATE_JD = 2461310.5;
export function distanceOnCardDate(orbit) {
  const M = ((((orbit.meanAnomalyDeg + orbit.meanMotionDegPerDay * (CARD_DATE_JD - orbit.epochJD)) % 360) + 360) % 360) * Math.PI / 180;
  const e = orbit.e;
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return orbit.aAU * (1 - e * Math.cos(E));
}

/*
 * Fills `info.orbitalSpeed` where a record leaves it out, from its own
 * elements (`info.speedNote` is appended). Moons are left alone.
 */
export function withSpeedNow(record) {
  if (record.info?.orbitalSpeed) return record;
  const { speedNote = "", ...info } = record.info ?? {};
  const o = record.orbit;
  return {
    ...record,
    info: {
      ...info,
      orbitalSpeed: speedLine(o.aAU, o.e, distanceOnCardDate(o), {
        periodYears: 360 / o.meanMotionDegPerDay / 365.25,
        note: speedNote,
      }),
    },
  };
}

/*
 * Colour indices to the builder's chroma triple, through B-R (see
 * tnoCatalogue.js's provenance note, which this follows exactly).
 *
 * Only B-V published: the excess over the Sun's B-V is scaled by the ratio
 * of the B-to-R and B-to-V baselines at the Bessell effective wavelengths
 * 438, 545 and 641 nm, (641 - 438) / (545 - 438) = 1.90 -- exact for a
 * linearly rising spectrum, like the V-R rule. The Sun's B-V is 0.651, which
 * is tnoCatalogue's solar B-R 1.005 less its solar V-R 0.354.
 */
const SUN_BR = 1.005;
const SUN_BV = 0.651;
export const brFromBV = (bv) => SUN_BR + 1.90 * (bv - SUN_BV);

/* A spectral slope S (per cent per 100 nm, normalised at 550 nm) to B-R:
 * the reflectance at 641 nm over that at 438 nm, in magnitudes. */
export function brFromSlope(slopePctPer100nm) {
  const s = slopePctPer100nm / 100;
  const ratio = (1 + s * (641 - 550) / 100) / (1 + s * (438 - 550) / 100);
  return SUN_BR + 2.5 * Math.log10(ratio);
}

export { chromaFromBR };

/*
 * Class colours, for bodies with no colour of their own. Each is the value
 * `smallBodyCatalogue.js` already uses for a body of that class, so a class
 * has one colour across the scene:
 *   COMET   cometary nuclei, dark grey with a red cast -- the class average
 *           Halley's card uses.
 *   S_TYPE  an S-type -- Itokawa's, Hayabusa AMICA.
 *   SQ_TYPE Q/Sq, fresher ordinary-chondrite surface -- Apophis's.
 *   B_TYPE  the blue-sloped B class -- Bennu's (B-V 0.64, JPL SBDB).
 *   NEUTRAL flat, colourless: C-types and the grey 2026 JWST spectrum of
 *           Kamoʻoalewa.
 */
export const CLASS_CHROMA = Object.freeze({
  COMET: [1.086, 0.988, 0.869],
  S_TYPE: [1.089, 0.990, 0.841],
  SQ_TYPE: [1.088, 0.989, 0.850],
  B_TYPE: [0.973, 1.003, 1.053],
  NEUTRAL: [1.0, 1.0, 1.0],
});

/* Semi-axes from tri-axial diameters a >= b >= c, y (the spin axis) the
 * shortest -- tnoCatalogue's `ellipsoid`, repeated so this file needs no
 * other import for shapes. */
export const ellipsoid = (a, b, c) => [{ c: [0, 0, 0], r: [a / 2, c / 2, b / 2] }];

/* An element block for a record: the published set, as given. */
export const orbitOf = (solution, el) => ({ solution, ...el });

/*
 * A comet's dust and gas, in the Centaurs' format (centaurComa.js), and its
 * activity law (smallBodies.js `cometActivity`). The sizes are in the
 * nucleus's drawn radii and are chosen by eye so the coma reads at arrival
 * framing; a real coma is 10,000 to 100,000 times the nucleus, which no
 * framing can hold.
 */
export function cometDust({ onsetAU = 3.0, fullAU, radii = 6, opacity = 0.16, tail = 16, colour = 0xc6d3dc, tailColour = 0xb8cadb, vents = 3, emission = true } = {}) {
  return {
    coma: { radii, opacity, colour, sunwardBias: 0.14, forward: 0.2 },
    tail: { length: tail, width: 2.6, opacity: opacity * 0.5, colour: tailColour },
    vents: vents ? { count: vents, size: 0.3, opacity: 0.45, colour: 0xe2eef6 } : undefined,
    activity: { onsetAU, fullAU },
    /* Coma design E's layers (centaurComa.js `emissionFor`): true for a
     * comet's green C2/CN head, blue CO+ ion tail and dust tail, or an
     * object saying what this body has instead (Phaethon's sodium). */
    emission,
  };
}

/**
 * The three interstellar visitors: Rank 8 of `docs/bodies-to-draw-next.md`.
 *
 * 1I/ʻOumuamua (2017), 2I/Borisov (2019) and 3I/ATLAS (2025) -- every
 * object ever confirmed to have come from another star. **None of the three
 * has ever been resolved.** Every picture of them is a point of light, a
 * coma, or an artist's impression -- the famous dark-red cigar of ʻOumuamua
 * is ESO's illustration (eso1737), not a photograph. So every shape here is
 * inferred from a lightcurve or not known at all, every surface is invented
 * in the measured colour, and every card says so first.
 *
 * ## Not drawn as bodies any more (round 5)
 *
 * They have left. The owner asked for them to come out of the scene and the
 * board and be shown instead as space events -- a dated replay of each pass
 * (scene/events/interstellarPassages.js), which reads its orbits and facts
 * from these records. The small-body builder no longer imports it; the
 * surface lab still does, for the maps made for them.
 *
 * ## The orbits are open
 *
 * All three are on hyperbolas (e = 1.20, 3.36, 6.14): they are not bound to
 * the Sun, came in once and are leaving for good. `smallBodies.js` solves
 * the hyperbolic Kepler equation for them and draws each path between its
 * two 60 AU crossings, open at both ends; the body runs that pass, and when
 * it reaches the outbound end it starts again inbound. **That loop is the
 * scene's, not theirs** -- the cards say so.
 *
 * Elements: JPL Small-Body Database heliocentric osculating sets, each at its
 * own epoch and solution, fitted with non-gravitational terms. The mean
 * anomaly of an open orbit is unbounded -- 3I's is 818 degrees at its epoch
 * -- and is never wrapped. Propagated to 27 September 2026 they give 54.60,
 * 48.56 and 11.69 AU, against JPL Horizons' 54.594, 48.549 and 11.69.
 *
 * Speed at infinity: v = sqrt(GM_sun / |a|), from the same elements --
 * 26.4, 32.3 and 58.0 km/s.
 */
import {
  brFromSlope,
  chromaFromBR,
  CLASS_CHROMA,
  cometDust,
  ellipsoid,
  hyperbolicSpeedAt,
  orbitOf,
} from "./catalogueHelpers.js";

const vInf = (aAbs) => (29.7847 / Math.sqrt(aAbs)).toFixed(1);

function speedLineOpen(aAbs, rNow, qAU) {
  return `${hyperbolicSpeedAt(aAbs, rNow).toFixed(1)} km/s now, ${rNow.toFixed(1)} AU from the Sun and leaving; ${hyperbolicSpeedAt(aAbs, qAU).toFixed(1)} km/s at perihelion; ${vInf(aAbs)} km/s once free of the Sun · no period — it is not in orbit`;
}


export const INTERSTELLAR_VISITORS = Object.freeze([
  // ---------------------------------------------------------- ʻOumuamua
  {
    id: "oumuamua",
    name: "1I/ʻOumuamua",
    colourMap: true,
    meshDetail: 0.75,
    designation: "1I/2017 U1",
    classification: "Interstellar object · the first ever found",
    detail: "A messenger from afar, arriving first | Pan-STARRS1, 19 October 2017",
    /* Mashchenko 2019's favoured disc, 115 x 111 x 19 m (91% probability of
     * the observed deep minima, against 16% for a cigar); volume-equivalent
     * 62 m. The size scales with an albedo nobody has measured. */
    diameterKm: 0.062,
    diameterLabel: "Never resolved; drawn as a 115 × 111 × 19 m disc (Mashchenko 2019)",
    /* Unknown: 0.04 is the value its size estimates assume (Meech et al. 2017). */
    albedo: 0.04,
    /* 'Spectrally red' (Meech et al. 2017), no index adopted here: the
     * comet class colour, which is red of neutral. */
    chroma: CLASS_CHROMA.COMET,
    rotationHours: 7.937,
    /* Tumbling: periods near 7.4 and 7.9 h, no single one fits (Fraser et
     * al. 2018). */
    rotationState: "tumbling",
    metalness: 0,
    orbit: orbitOf("JPL SBDB orbit solution 16, epoch JD 2458080.5", {
      epochJD: 2458080.5,
      aAU: -1.27234500742808,
      e: 1.201133796102373,
      iDeg: 122.7417062847286,
      nodeDeg: 24.59690955523242,
      argPeriDeg: 241.8105360304898,
      meanAnomalyDeg: 51.1576197938249,
      meanMotionDegPerDay: 0.6867469493413392,
    }),
    shape: {
      lobes: ellipsoid(0.115, 0.111, 0.019),
      /* "Needs some terrain" (Prompts.md round 3): relief 0.02 -> 0.04 and
       * six shallow bowls. Invented, as the whole surface is -- it was a
       * point of light. */
      relief: 0.04,
      grain: 0.016,
      craterCount: 6,
      craterMin: 0.06,
      craterMax: 0.16,
      craterDepth: 0.015,
      boulders: 0,
      seed: 1717,
    },
    surfaceEvidence: "Never resolved — a single point of light whose brightness swung about tenfold as it tumbled. The disc is the best fit to that lightcurve; the surface is invented in a dark red. The famous cigar picture is an artist's impression (ESO, eso1737)",
    info: {
      population: "Interstellar objects · unbound, e = 1.20 · perihelion 0.26 AU",
      diameter: "Never resolved. Mean radius ~100 m if its albedo is 0.04 (Meech et al. 2017); disc 1:6 favoured over cigar 1:8 (Mashchenko 2019)",
      rotationPeriod: "Tumbling: about 7.4 and 7.9 h, no single period (Fraser et al. 2018)",
      orbitalSpeed: speedLineOpen(1.27234500742808, 54.594, 0.2559),
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Shape inferred from its lightcurve; surface invented",
      roughness: "unknown",
      description:
        "The first object ever seen passing through the Solar System from another star. Robert Weryk found it in Pan-STARRS1 images on 19 October 2017, after it had already swung within 0.26 AU of the Sun — inside Mercury's orbit — on 9 September and passed 24 million km from Earth. It was only ever a point of light. What made it famous was that it sped up slightly on the way out, a push detected at 30 sigma, with no gas or dust to be seen (Micheli et al. 2018); one natural explanation is hydrogen escaping from its ice (Bergner & Seligman 2023). It came from the direction of Vega in Lyra and is heading for Pegasus, 54.6 AU out today.",
    },
  },

  // ------------------------------------------------------------ Borisov
  {
    id: "borisov",
    name: "2I/Borisov",
    colourMap: true,
    meshDetail: 0.75,
    designation: "2I/2019 Q4 (C/2019 Q4)",
    classification: "Interstellar comet · the first confirmed",
    detail: "Found with a home-built telescope | Gennadiy Borisov, 30 August 2019",
    /* Hubble: 0.2 < r < 0.5 km for albedo 0.04 (Jewitt et al. 2020); drawn
     * at the middle, 0.7 km across. */
    diameterKm: 0.7,
    diameterLabel: "0.4-1.0 km (Hubble, Jewitt et al. 2020); drawn at 0.7 km",
    albedo: 0.04,
    /* Coma colours B-V 0.80, V-R 0.47 (Jewitt & Luu 2019) -> B-R 1.27. The
     * dust's colour: the nucleus's was never measured. */
    chroma: chromaFromBR(0.80 + 0.47),
    rotationHours: 12,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf("JPL SBDB orbit solution 54, epoch JD 2458853.5", {
      epochJD: 2458853.5,
      aAU: -0.8514922551937886,
      e: 3.356475782676596,
      iDeg: 44.05264247909138,
      nodeDeg: 308.1477292269942,
      argPeriDeg: 209.1236864378081,
      meanAnomalyDeg: 34.4294703072178,
      meanMotionDegPerDay: 1.254391263639903,
    }),
    /* Shape unknown: a mild elongation, chosen. */
    shape: {
      lobes: ellipsoid(0.8, 0.7, 0.62),
      /* "Needs some terrain" (Prompts.md round 3): relief 0.045 -> 0.065,
       * craters 10 -> 16. Chosen; never resolved. */
      relief: 0.065,
      grain: 0.024,
      craterCount: 16,
      craterMin: 0.05,
      craterMax: 0.14,
      craterDepth: 0.02,
      boulders: 4,
      boulderSize: 0.04,
      seed: 1919,
    },
    /* Active from about June 2019 (Jewitt & Luu 2019), 4.6 AU on these
     * elements; strongest at its 2.0 AU perihelion. Slightly reddish grey
     * dust. */
    ...cometDust({ onsetAU: 4.6, fullAU: 2.0, radii: 8, opacity: 0.2, colour: 0xcbc3bb, tailColour: 0xc2b9b0 }),
    surfaceEvidence: "Never resolved: the nucleus was always hidden in its coma. Size is an upper and lower bound from Hubble; the surface is a generic comet nucleus",
    info: {
      population: "Interstellar objects · unbound, e = 3.36 · perihelion 2.01 AU",
      diameter: "Radius 0.2-0.5 km (Jewitt et al. 2020, Hubble), assuming albedo 0.04",
      rotationPeriod: "Unknown — published values conflict; drawn at 12 h",
      orbitalSpeed: speedLineOpen(0.8514922551937886, 48.549, 2.00652),
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "Amateur astronomer Gennadiy Borisov found it on 30 August 2019 with a 0.65 m telescope he built himself, in Crimea — the first interstellar object found by an amateur, and unlike ʻOumuamua an unmistakable comet with a coma and tail. It came from Cassiopeia. Its gas held more carbon monoxide than water — at least 173% by Hubble's count, far beyond Solar System comets — and polarimetry suggests it may be the first truly pristine comet ever seen, one that had never passed close to a star before ours. In March 2020 Hubble watched a fragment break off and vanish within days; the comet survived. Its coma here switches on inside 4.6 AU.",
    },
  },

  // ------------------------------------------------------------ 3I/ATLAS
  {
    id: "atlas-3i",
    name: "3I/ATLAS",
    colourMap: true,
    meshDetail: 0.75,
    designation: "3I/2025 N1 (C/2025 N1)",
    classification: "Interstellar comet · the fastest and best observed",
    detail: "Watched from Earth, JWST and Mars | ATLAS, 1 July 2025",
    /* Hubble nucleus extraction: effective radius 1.3 +/- 0.2 km for albedo
     * 0.04 (Hui et al. 2026); axis ratio >= 2:1 if its lightcurve is
     * rotational. Drawn 2:1 with that volume: 4.13 x 2.06 x 2.06 km. */
    diameterKm: 2.6,
    diameterLabel: "About 2.6 km (radius 1.3 ± 0.2 km, Hui et al. 2026) — never resolved",
    albedo: 0.04,
    /* Red dust coma, spectral gradient ~22%/100 nm over 0.4-0.7 um
     * (Santana-Ros et al. 2025) -> B-R 1.51. The dust's colour. */
    chroma: chromaFromBR(brFromSlope(22)),
    rotationHours: 16.16,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf("JPL SBDB orbit solution 54, epoch JD 2461090.5", {
      epochJD: 2461090.5,
      aAU: -0.2638374502507929,
      e: 6.141351449317625,
      iDeg: 175.1164570850441,
      nodeDeg: 322.1696089290778,
      argPeriDeg: 128.0228697185194,
      meanAnomalyDeg: 818.22024580252,
      meanMotionDegPerDay: 7.27276260993825,
    }),
    shape: {
      lobes: ellipsoid(4.13, 2.06, 2.06),
      /* "Needs some terrain" (Prompts.md round 3): relief 0.045 -> 0.065,
       * craters 14 -> 20. Chosen; never resolved. */
      relief: 0.065,
      grain: 0.024,
      craterCount: 20,
      craterMin: 0.05,
      craterMax: 0.14,
      craterDepth: 0.02,
      boulders: 4,
      boulderSize: 0.04,
      seed: 2025,
    },
    /* Active at discovery, 4.5 AU on these elements (dust at 3.8 AU in
     * Hubble's July images); strongest at its 1.36 AU perihelion. A
     * CO2-rich coma of red dust. */
    ...cometDust({ onsetAU: 4.5, fullAU: 1.36, radii: 8, opacity: 0.2, colour: 0xd5bba8, tailColour: 0xcbb09c }),
    surfaceEvidence: "Never resolved by any telescope or spacecraft — Mars Reconnaissance Orbiter's HiRISE saw it at about 30 km per pixel, coma only. The size is an estimate from Hubble with the coma subtracted; the surface is a generic comet nucleus",
    info: {
      population: "Interstellar objects · unbound, e = 6.14 · perihelion 1.36 AU",
      diameter: "Effective radius 1.3 ± 0.2 km for albedo 0.04 (Hui et al. 2026); Hubble's first limit was under 2.8 km",
      rotationPeriod: "16.16 ± 0.01 h from the July 2025 lightcurve (Santana-Ros et al. 2025), uncertain through the coma",
      orbitalSpeed: speedLineOpen(0.2638374502507929, 11.69, 1.35648),
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "Reported on 1 July 2025 by the ATLAS survey telescope in Chile, and the fastest visitor ever recorded: about 58 km/s before the Sun's pull, 68 km/s at perihelion on 29 October 2025. Its orbit is retrograde and lies almost exactly in the plane of the planets. It came from the direction of Sagittarius, towards the centre of the Galaxy. JWST found its coma dominated by carbon dioxide, 7.6 times more than water. On 3 October 2025 it passed 29 million km from Mars and was photographed by the orbiters there and by the Perseverance rover — coma only. Population models suggest it may be over 7 billion years old, older than the Sun, though that is a statistical estimate. It passed Jupiter at 0.36 AU in March 2026 and is at 11.7 AU today, leaving at 12 AU a year.",
    },
  },
]);

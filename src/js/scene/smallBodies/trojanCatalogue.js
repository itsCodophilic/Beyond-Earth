/**
 * Jupiter's Trojans, the Lucy targets, and Hilda: Rank 9 of
 * `docs/bodies-to-draw-next.md`.
 *
 *   L4, 60 degrees ahead of Jupiter   624 Hektor (+ Skamandrios),
 *                                      3548 Eurybates (+ Queta),
 *                                      15094 Polymele (+ 'Shaun'),
 *                                      11351 Leucus, 21900 Orus
 *   L5, 60 degrees behind             617 Patroclus-Menoetius
 *   main belt, flown by Lucy          52246 Donaldjohanson,
 *                                      152830 Dinkinesh (+ Selam)
 *   the 3:2 resonance                 153 Hilda
 *
 * The swarms these belong to are drawn around them as a statistical cloud
 * (resonantSwarms.js).
 *
 * ## Drawn in Jupiter's frame
 *
 * The Trojans and Hilda carry `coOrbital: { planet: "Jupiter", ratio }`, and
 * `smallBodies.js` draws them in a frame that turns with the drawn Jupiter,
 * so Hektor sits 60 degrees ahead of the Jupiter on screen rather than of a
 * Jupiter at another longitude. `ratio` is the resonance -- 1 for a Trojan,
 * 3/2 for Hilda -- and is the ratio of their *long-term average* mean
 * motions, which is exactly what a resonance means; the osculating element
 * sets differ from it by a few per cent, which on the scene's clock would
 * slide Hektor off L4 within half an hour of watching.
 *
 * ## Evidence
 *
 * Only Donaldjohanson and Dinkinesh (with Selam) have been seen close up, by
 * Lucy in 2025 and 2023. The rest are points of light, with shapes from
 * occultations, lightcurves or adaptive optics, and Lucy flies past four of
 * them from August 2027. Every surface is generated (tools/binary-surface-
 * lab) in the measured colour; the cards say which.
 *
 * Elements: JPL SBDB, every one at JD 2461200.5 (9 June 2026), mean motion
 * as published. Colours: B-V from JPL SBDB, converted as the other
 * catalogues do (catalogueHelpers.js).
 */
import {
  brFromBV,
  chromaFromBR,
  CLASS_CHROMA,
  ellipsoid,
  orbitOf,
  withSpeedNow,
} from "./catalogueHelpers.js";

const SBDB = (solution) => `JPL SBDB orbit solution ${solution}, epoch JD 2461200.5, queried 27 September 2026`;
const TROJAN = Object.freeze({ planet: "Jupiter", ratio: 1 });

/* An old, heavily cratered surface for bodies nobody has seen: the Trojans
 * are thought to be as old as the Solar System, captured early. */
const OLD_RELIEF = Object.freeze({
  neck: 1,
  relief: 0.03,
  grain: 0.012,
  craterCount: 70,
  craterMin: 0.03,
  craterMax: 0.16,
  craterDepth: 0.02,
  boulders: 0,
});

/* D-type red: Hektor's B-V 0.776 (JPL SBDB) -> B-R 1.24. Used as the class
 * colour for the D-types with no index of their own (Leucus, Orus), and
 * flagged on their cards. */
const D_TYPE = chromaFromBR(brFromBV(0.776));

const mutualSpeed = (aKm, periodHours) =>
  `${((2 * Math.PI * aKm) / (periodHours * 3600) * 1000).toFixed(1)} m/s`;

const LUCY = "Lucy flyby";

const RECORDS = [
  // --------------------------------------------------------------- Hektor
  {
    id: "hektor",
    name: "Hektor",
    colourMap: true,
    meshDetail: 0.75,
    coOrbital: TROJAN,
    designation: "624 Hektor (A907 CF)",
    classification: "Jupiter Trojan · L4 · the largest, two-lobed, with a moon",
    detail: "Two lobes and a moon, 60° ahead of Jupiter | Keck adaptive optics, Marchis et al. 2014",
    diameterKm: 250,
    diameterLabel: "Two lobes, 220 and 183 km; 250 ± 26 km equivalent",
    albedo: 0.025,
    chroma: D_TYPE,
    rotationHours: 6.92050885,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(139), {
      epochJD: 2461200.5,
      aAU: 5.276986092673823,
      e: 0.02434489234275647,
      iDeg: 18.14715224028094,
      nodeDeg: 342.8018513679027,
      argPeriDeg: 181.288859678094,
      meanAnomalyDeg: 24.91385327109803,
      meanMotionDegPerDay: 0.08130647811170628,
    }),
    /* Lobe equivalent diameters 220 +/- 22 and 183 +/- 18 km (Marchis et
     * al. 2014), set touching: end to end about 400 km, the envelope the
     * '403 x 201 km' figure describes. */
    shape: {
      ...OLD_RELIEF,
      lobes: [
        { c: [-95, 0, 0], r: [112, 98, 106] },
        { c: [100, 0, 0], r: [93, 82, 88] },
      ],
      neck: 5,
      blend: "smooth",
      fillet: 40,
      /* "A few more, deeper craters" (Prompts.md round 3): 70 -> 95, depth
       * 0.02 -> 0.034, and two basins. Chosen; Hektor has only been seen by
       * adaptive optics (Marchis et al. 2014). */
      craterCount: 95,
      craterDepth: 0.034,
      bigCraters: [
        { dir: [-0.4, 0.75, 0.52], radius: 0.3, depth: 0.045, rim: 0.009 },
        { dir: [0.5, -0.6, -0.62], radius: 0.24, depth: 0.04, rim: 0.008 },
      ],
      seed: 624,
    },
    moons: [
      {
        name: "Skamandrios",
        colourMap: true,
        designation: "(624) Hektor I Skamandrios",
        classification: "Natural satellite · the only small moon of a Jupiter Trojan",
        diameterKm: 12,
        diameterLabel: "12 ± 3 km",
        albedo: 0.025,
        chroma: D_TYPE,
        /* a = 623.5 +/- 10 km, P = 2.9651 d, e = 0.31, i = 50.1 deg to
         * Hektor's equator (Marchis et al. 2014). Drawn as a circle. */
        separationKm: 623.5,
        periodHours: 71.1624,
        inclinationDeg: 50.1,
        shape: { ...OLD_RELIEF, lobes: ellipsoid(13, 12, 11), craterCount: 20, seed: 6241 },
        info: {
          diameter: "12 ± 3 km — Marchis et al. 2014",
          rotationPeriod: "Unknown",
          orbitalSpeed: `${mutualSpeed(623.5, 71.1624)} around Hektor — once every 2.97 days at 623.5 km`,
          surfaceEvidence: "A point beside Hektor in Keck adaptive-optics images (2006). Surface generated",
          description:
            "Found with the Keck telescope's adaptive optics in 2006: the first moon found around a Jupiter Trojan that is small beside its parent, rather than a near twin like Patroclus's. Its orbit is tilted about 50° to Hektor's equator and is quite eccentric, 0.31 — drawn here as a circle at the mean distance. Its motion is what weighs Hektor: about 7.9 × 10¹⁸ kg. Named after Hector's son.",
        },
      },
    ],
    surfaceEvidence: "Adaptive optics resolved two lobes; nothing finer. The surface is generated — an old, dark, cratered D-type — in Hektor's measured colour",
    info: {
      population: "Jupiter Trojans · L4, the Greek camp, 60° ahead of Jupiter",
      diameter: "250 ± 26 km equivalent; lobes 220 ± 22 and 183 ± 18 km (Marchis et al. 2014)",
      rotationPeriod: "6.9205 h — JPL SBDB",
      speedNote: " — in step with Jupiter",
      gravity: "Primary mass 7.9 ± 1.4 × 10¹⁸ kg, density about 1.0 g/cm³ (Marchis et al. 2014)",
      surfaceEvidence: "Two lobes seen by Keck adaptive optics. Surface generated",
      roughness: "unknown",
      description:
        "The largest Jupiter Trojan: two lobes about 220 and 183 km across, stuck together, turning in under seven hours, 60° ahead of Jupiter on its orbit. Its density is about that of water, so it is likely porous and icy — like the comets and Kuiper Belt objects the Trojans may have been captured from when the giant planets moved. It is one of the darkest large bodies known, albedo 0.025, and a very red D-type. It is not a Lucy target.",
    },
  },

  // --------------------------------------------------- Patroclus–Menoetius
  {
    id: "patroclus",
    name: "Patroclus",
    colourMap: true,
    meshDetail: 0.75,
    coOrbital: TROJAN,
    designation: "617 Patroclus (A906 UL)",
    classification: "Jupiter Trojan · L5 · near-equal binary, Lucy's last target",
    detail: "Two near-twins facing each other | Lucy flyby 2 March 2033",
    diameterKm: 113,
    diameterLabel: "113 ± 3 km (occultation, Buie et al. 2015)",
    albedo: 0.047,
    /* B-V 0.677 (JPL SBDB) -> B-R 1.05: the less-red Trojan colour group. */
    chroma: chromaFromBR(brFromBV(0.677)),
    rotationHours: 102.8,
    rotationState: "principal-axis",
    /* Synchronous with the 4.28-day mutual orbit (JPL SBDB rot_per 102.8 h). */
    tidallyLocked: true,
    metalness: 0,
    orbit: orbitOf(SBDB(87), {
      epochJD: 2461200.5,
      aAU: 5.205975173988769,
      e: 0.1391467916238868,
      iDeg: 22.06359071054631,
      nodeDeg: 44.34968792774898,
      argPeriDeg: 308.8377281363527,
      meanAnomalyDeg: 58.67543160284279,
      meanMotionDegPerDay: 0.08297570189160172,
    }),
    /* Modelled as oblate (Brozovic et al. 2024). */
    /* More craters and terrain (Prompts.md round 3): relief 0.03 -> 0.045,
     * craters 70 -> 95, depth 0.02 -> 0.028. Chosen. */
    shape: { ...OLD_RELIEF, lobes: ellipsoid(118, 116, 106), relief: 0.045, craterCount: 95, craterDepth: 0.028, seed: 617 },
    moons: [
      {
        name: "Menoetius",
        colourMap: true,
        designation: "(617) Patroclus I Menoetius",
        classification: "Binary partner · Patroclus's near-twin",
        diameterKm: 104,
        diameterLabel: "104 ± 3 km",
        /* a = 692.5 +/- 4.0 km, e = 0.004, P = 4.282753 d (Brozovic et al.
         * 2024). Tilt of the mutual orbit to the ecliptic not used: drawn
         * flat. */
        separationKm: 692.5,
        periodHours: 102.786,
        inclinationDeg: 0,
        eccentricity: 0.004,
        barycentric: true,
        /* Equal density on the published sizes, (104/113)^3 = 0.78, as for
         * the Kuiper binaries. Brozovic et al. adopt 22% of the system's
         * mass in Menoetius, which is an assumption, not a measurement. */
        massRatio: (104 / 113) ** 3,
        tidallyLocked: true,
        family: "Binary partner",
        albedo: 0.047,
        chroma: chromaFromBR(brFromBV(0.677)),
        rotationHours: 102.786,
        /* As Patroclus (Prompts.md round 3). */
        shape: { ...OLD_RELIEF, lobes: ellipsoid(109, 107, 97), relief: 0.045, craterCount: 95, craterDepth: 0.028, seed: 6171 },
        info: {
          diameter: "104 ± 3 km — Buie et al. 2015",
          rotationPeriod: "102.8 h, locked to the mutual orbit",
          orbitalSpeed: `${mutualSpeed(692.5, 102.786)} relative to Patroclus — once every 4.28 days, 692.5 km apart`,
          surfaceEvidence: "Occultation profiles only; Lucy arrives 2 March 2033. Surface generated",
          description:
            "Patroclus's partner, almost its twin: 104 km against 113, 692.5 km apart, circling their shared centre every 4.28 days on an almost perfect circle (e = 0.004). Each keeps one face towards the other. Discovered in 2001. In Homer, Menoetius is Patroclus's father.",
          gravity: "System density 1.05 ± 0.21 g/cm³ — Brozovic et al. 2024",
        },
      },
    ],
    surfaceEvidence: "Stellar occultations give both outlines; no image resolves either. Surfaces generated around the pair's measured colour: Patroclus a near-neutral grey (the less-red group), Menoetius a shade redder. Lucy flies past on 2 March 2033",
    info: {
      population: "Jupiter Trojans · L5, the Trojan camp, 60° behind Jupiter",
      diameter: "113 ± 3 km, Menoetius 104 ± 3 km (Buie et al. 2015, occultation)",
      rotationPeriod: "102.8 h — locked to the 4.28-day mutual orbit",
      speedNote: " — in step with Jupiter",
      gravity: "Density 1.05 ± 0.21 g/cm³ (Brozovic et al. 2024): about water",
      surfaceEvidence: "Occultation outlines. Surface generated",
      roughness: "unknown",
      description:
        "Two worlds of almost the same size going round each other: 113 and 104 km across, about 690 km apart, each keeping one face to the other. Their density is close to water's, which says porous and ice-rich — more like a Kuiper Belt binary than an asteroid, and pairs like this are thought to have formed out there, which is one reason the Trojans are suspected of being captured Kuiper Belt objects. Patroclus, found in October 1906, was the second Trojan discovered. It is Lucy's final target, on 2 March 2033.",
    },
  },

  // ------------------------------------------------------------ Eurybates
  {
    id: "eurybates",
    name: "Eurybates",
    colourMap: true,
    /* Full mesh detail (96 x 64) for the heavier terrain asked for in round 3. */
    meshDetail: 1,
    coOrbital: TROJAN,
    framePair: false,
    designation: "3548 Eurybates (1973 SO)",
    classification: "Jupiter Trojan · L4 · Lucy's first Trojan, with a moon",
    detail: "A grey family head with a tiny moon | Lucy flyby 12 August 2027",
    diameterKm: 69.3,
    diameterLabel: "77.5 × 71.3 × 61.8 km; 69.3 ± 1.4 km equivalent",
    albedo: 0.044,
    /* C-type, neutral grey -- unusual among the red Trojans. */
    chroma: CLASS_CHROMA.NEUTRAL,
    rotationHours: 8.7027283,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(61), {
      epochJD: 2461200.5,
      aAU: 5.217371617810976,
      e: 0.09059867172297777,
      iDeg: 8.05147293527498,
      nodeDeg: 43.5587275998936,
      argPeriDeg: 28.69968222483612,
      meanAnomalyDeg: 125.7480299363769,
      meanMotionDegPerDay: 0.08270398135406888,
    }),
    /* More craters and heavy terrain (Prompts.md round 3): relief 0.03 ->
     * 0.06, craters 70 -> 120, depth 0.02 -> 0.032, three basins.
     * Eurybates is the largest remnant of a collisional family (Broz &
     * Rozehnal 2011), so a battered surface is the plausible reading;
     * the amounts are chosen until Lucy's flyby in August 2027. */
    shape: { ...OLD_RELIEF, lobes: ellipsoid(77.5, 71.3, 61.8), relief: 0.06, grain: 0.018,
      craterCount: 120, craterDepth: 0.032,
      bigCraters: [
        { dir: [0.2, 0.9, 0.39], radius: 0.38, depth: 0.05, rim: 0.01 },
        { dir: [-0.85, -0.1, 0.52], radius: 0.3, depth: 0.045, rim: 0.009 },
        { dir: [0.5, -0.55, -0.67], radius: 0.26, depth: 0.04, rim: 0.008 },
      ],
      seed: 3548 },
    moons: [
      {
        name: "Queta",
        colourMap: true,
        designation: "(3548) Eurybates I Queta",
        classification: "Natural satellite · about 1 km, 2,350 km out",
        diameterKm: 1.2,
        diameterLabel: "About 1.2 ± 0.4 km",
        albedo: 0.044,
        chroma: CLASS_CHROMA.NEUTRAL,
        /* a = 2350 +/- 11 km, P = 82.46 d, e = 0.125 (Brown et al. 2021). */
        separationKm: 2350,
        periodHours: 1979.04,
        inclinationDeg: 0,
        shape: { ...OLD_RELIEF, lobes: ellipsoid(1.4, 1.2, 1.0), craterCount: 12, seed: 35481 },
        info: {
          diameter: "About 1.2 ± 0.4 km",
          rotationPeriod: "Unknown",
          orbitalSpeed: `${mutualSpeed(2350, 1979.04)} around Eurybates — once every 82 days at 2,350 km`,
          surfaceEvidence: "Found by Hubble in September 2018 (Noll et al.). Surface generated",
          description:
            "A moon about a kilometre across, 2,350 km — 68 of Eurybates's radii — from its parent, taking 82 days to go round once. Its orbit is what gives Eurybates's density, about 1.1 g/cm³. Lucy will look for it in August 2027. Queta is named after Queta Basilio, the first woman to light the Olympic flame, in 1968.",
        },
      },
    ],
    surfaceEvidence: "A point of light; shape from lightcurve inversion (Mottola et al. 2023). Surface generated in a neutral grey. Lucy flies past on 12 August 2027",
    info: {
      population: "Jupiter Trojans · L4, the Greek camp · Eurybates collisional family",
      diameter: "69.3 ± 1.4 km, albedo 0.044 (Mottola et al. 2023); 77.5 × 71.3 × 61.8 km",
      rotationPeriod: "8.7027283 h, retrograde (Mottola et al. 2023)",
      speedNote: " — in step with Jupiter",
      gravity: "Density 1.1 ± 0.3 g/cm³, from Queta's orbit (Brown et al. 2021)",
      surfaceEvidence: "Lightcurve shape. Surface generated",
      roughness: "unknown",
      description:
        "The largest piece of the only confirmed collisional family among the Trojans — the wreckage of a body that was shattered — and grey where almost every other Trojan is red. It spins backwards once every 8.7 hours, and has a moon about a kilometre across that goes round it every 82 days. Lucy's first Trojan: the flyby is on 12 August 2027.",
    },
  },

  // ------------------------------------------------------------- Polymele
  {
    id: "polymele",
    name: "Polymele",
    colourMap: true,
    /* Full mesh detail (96 x 64) for the heavier terrain asked for in round 3. */
    meshDetail: 1,
    coOrbital: TROJAN,
    framePair: false,
    designation: "15094 Polymele (1999 WB2)",
    classification: "Jupiter Trojan · L4 · flattened, with a moon",
    detail: "Lucy's smallest Trojan | Lucy flyby 15 September 2027",
    diameterKm: 21.075,
    diameterLabel: "27 × 24.4 × 10.4 km; 21.1 km equivalent",
    albedo: 0.091,
    /* B-V 0.652, V-R 0.477 (JPL SBDB) -> B-R 1.13. */
    chroma: chromaFromBR(0.652 + 0.477),
    rotationHours: 5.8607,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(21), {
      epochJD: 2461200.5,
      aAU: 5.191514133435046,
      e: 0.09592245810512318,
      iDeg: 12.97735158439746,
      nodeDeg: 50.33105662992578,
      argPeriDeg: 5.86529887136951,
      meanAnomalyDeg: 143.4220008064438,
      meanMotionDegPerDay: 0.08332263830560761,
    }),
    /* Squashed like a thick disc, from occultations (Buie et al. 2023). */
    /* Heavy craters and terrain (Prompts.md round 3): relief 0.04 -> 0.07,
     * craters 70 -> 110, depth 0.02 -> 0.035, two basins. Chosen; Lucy
     * flies past in September 2027. */
    shape: { ...OLD_RELIEF, lobes: ellipsoid(27, 24.4, 10.4), relief: 0.07, grain: 0.02,
      craterCount: 110, craterDepth: 0.035,
      bigCraters: [
        { dir: [0.6, 0.2, 0.77], radius: 0.36, depth: 0.05, rim: 0.01 },
        { dir: [-0.7, -0.3, -0.65], radius: 0.28, depth: 0.045, rim: 0.009 },
      ],
      seed: 15094 },
    moons: [
      {
        name: "Shaun",
        colourMap: true,
        designation: "Moon of (15094) Polymele — 'Shaun' is the Lucy team's nickname",
        classification: "Natural satellite · found by a blinking star",
        diameterKm: 5,
        diameterLabel: "5-6 km",
        albedo: 0.091,
        chroma: chromaFromBR(0.652 + 0.477),
        /* 204.4 +/- 2.6 km projected at discovery; the true distance is at
         * least that. Period not measured: 14.4-16.6 d is a Kepler estimate
         * for density 0.7-1 g/cm3 (Levison et al. 2023); drawn at 15.5 d. */
        separationKm: 204.4,
        periodHours: 372,
        inclinationDeg: 0,
        shape: { ...OLD_RELIEF, lobes: ellipsoid(5.6, 5.0, 4.6), craterCount: 20, seed: 150941 },
        info: {
          diameter: "5-6 km — from the 27 March 2022 occultation",
          rotationPeriod: "Unknown",
          orbitalSpeed: "Orbit not yet measured; drawn on a 15.5-day circle at the 204 km seen at discovery",
          surfaceEvidence: "Two of fourteen occultation teams saw a star blink behind it. Surface generated",
          description:
            "Found on 27 March 2022, when 14 teams watched a star disappear behind Polymele and two of them saw a second, shorter blink: a moon about 5 km across, some 200 km out. Its orbit is not known well enough yet for an official name, so the Lucy team calls it Shaun. The period drawn is an estimate.",
        },
      },
    ],
    surfaceEvidence: "Occultation outline only. Surface generated. Lucy flies past on 15 September 2027",
    info: {
      population: "Jupiter Trojans · L4, the Greek camp",
      diameter: "21.075 ± 0.136 km (NEOWISE, JPL SBDB); 27 × 24.4 × 10.4 km (Buie et al. 2023)",
      rotationPeriod: "5.8607 h (JPL SBDB); a 2021 study gives 11.5 h — unresolved",
      speedNote: " — in step with Jupiter",
      gravity: "Not measured",
      surfaceEvidence: "Occultation outline. Surface generated",
      roughness: "unknown",
      description:
        "The smallest of Lucy's Trojans, about 21 km, and the flattest: occultations show a squashed, bumpy disc about 27 × 24 × 10 km. It is a P-type, less red than Hektor or Leucus. Its moon was only found in 2022 by watching it pass in front of a star. Lucy flies past on 15 September 2027.",
    },
  },

  // --------------------------------------------------------------- Leucus
  {
    id: "leucus",
    name: "Leucus",
    colourMap: true,
    meshDetail: 0.75,
    coOrbital: TROJAN,
    designation: "11351 Leucus (1997 TS25)",
    classification: "Jupiter Trojan · L4 · one of the slowest spinners known",
    detail: "A day eighteen Earth days long | Lucy flyby 18 April 2028",
    diameterKm: 41,
    diameterLabel: "63.8 × 36.6 × 29.6 km; 41 km equivalent",
    albedo: 0.037,
    /* D-type, no index of its own: Hektor's D-type colour. */
    chroma: D_TYPE,
    rotationHours: 445.924,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(28), {
      epochJD: 2461200.5,
      aAU: 5.312382832170665,
      e: 0.06495789797701287,
      iDeg: 11.54341670108032,
      nodeDeg: 251.0799335752079,
      argPeriDeg: 162.4048390063255,
      meanAnomalyDeg: 139.1721755085774,
      meanMotionDegPerDay: 0.08049520802874313,
    }),
    /* Triaxial fit to five occultations, with a large depression at one end
     * (Buie et al. 2021). */
    shape: {
      ...OLD_RELIEF,
      lobes: ellipsoid(63.8, 36.6, 29.6),
      dents: [{ c: [30, -4, 0], r: 11, softness: 3 }],
      /* "A little terrain" (Prompts.md round 3): relief 0.03 -> 0.042 --
       * Buie et al. (2021) saw topography up to 5 km high on a 64 km body. */
      relief: 0.042,
      seed: 11351,
    },
    surfaceEvidence: "Five stellar occultations, with topography up to 30 km across and 5 km high (Buie et al. 2021). Surface generated; the colour is a D-type red, drawn as a charcoal rock with a deep rusty cast. Lucy flies past on 18 April 2028",
    info: {
      population: "Jupiter Trojans · L4, the Greek camp",
      diameter: "63.8 × 36.6 × 29.6 km (Buie et al. 2021); albedo 0.037",
      rotationPeriod: "445.9 h — about 18.6 days (JPL SBDB)",
      speedNote: " — in step with Jupiter",
      gravity: "Not measured",
      surfaceEvidence: "Occultation outline. Surface generated",
      roughness: "Topography up to 5 km high (Buie et al. 2021)",
      description:
        "Leucus takes about 446 hours — eighteen and a half Earth days — to turn once, which makes it one of the slowest-spinning asteroids known; it is drawn at the slowest spin the scene allows. Starlight passing its edges shows a long body about 64 × 37 × 30 km with a big depression at one end. It is darker than charcoal, reflecting under 4% of the light that reaches it. Lucy flies past on 18 April 2028.",
    },
  },

  // ----------------------------------------------------------------- Orus
  {
    id: "orus",
    name: "Orus",
    colourMap: true,
    meshDetail: 0.75,
    coOrbital: TROJAN,
    designation: "21900 Orus (1999 VQ10)",
    classification: "Jupiter Trojan · L4 · Lucy target",
    detail: "Spins backwards, a crater near its pole | Lucy flyby 11 November 2028",
    diameterKm: 60.5,
    diameterLabel: "70.7 × 63.0 × 51.4 km; 60.5 ± 0.9 km equivalent",
    albedo: 0.04,
    chroma: D_TYPE,
    rotationHours: 13.48619,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(40), {
      epochJD: 2461200.5,
      aAU: 5.123374239403683,
      e: 0.03672540559818106,
      iDeg: 8.468580378470353,
      nodeDeg: 258.5504431073313,
      argPeriDeg: 182.7884930129634,
      meanAnomalyDeg: 96.92267457127365,
      meanMotionDegPerDay: 0.08499041570407942,
    }),
    shape: {
      ...OLD_RELIEF,
      lobes: ellipsoid(70.7, 63.0, 51.4),
      /* A large crater near the north pole, hinted at by the lightcurve. */
      bigCraters: [{ dir: [0.15, 0.95, 0.27], radius: 0.36, depth: 0.05, rim: 0.01 }],
      /* "Slight terrain" (Prompts.md round 3): relief 0.03 -> 0.038. */
      relief: 0.038,
      seed: 21900,
    },
    surfaceEvidence: "A point of light; shape from lightcurves (Mottola et al. 2023). Surface generated; the colour is a D-type red, drawn as charcoal with a dark reddish-brown tint. Lucy flies past on 11 November 2028",
    info: {
      population: "Jupiter Trojans · L4, the Greek camp",
      diameter: "60.5 ± 0.9 km, albedo 0.040 (Mottola et al. 2023)",
      rotationPeriod: "13.48619 h, retrograde (Mottola et al. 2023)",
      speedNote: " — in step with Jupiter",
      gravity: "Not measured",
      surfaceEvidence: "Lightcurve shape. Surface generated",
      roughness: "unknown",
      description:
        "A 60 km D-type that spins backwards once every 13.5 hours, and whose lightcurve hints at a large crater near its north pole — drawn here where the hint puts it, and to be checked by Lucy on 11 November 2028. It is named after a Greek warrior killed by Hector in the Iliad; the Lucy Trojans are all named for the war at Troy, the Greeks at L4 and the Trojans at L5, with Hektor and Patroclus each the one exception in the wrong camp.",
    },
  },

  // ----------------------------------------------------- Donaldjohanson
  {
    id: "donaldjohanson",
    name: "Donaldjohanson",
    colourMap: true,
    meshDetail: 0.75,
    designation: "52246 Donaldjohanson (1981 EQ5)",
    classification: "Main-belt asteroid · Erigone family · flown by Lucy",
    detail: "Lucy's rehearsal, a tumbling peanut | Lucy flyby 20 April 2025",
    /* Volume-equivalent of 8.8 x 4.4 x 3.1 km (Marchi et al. 2026). */
    diameterKm: 4.96,
    diameterLabel: "8.8 × 4.4 × 3.1 km (Marchi et al. 2026)",
    albedo: 0.103,
    /* C-type, dark carbonaceous: neutral. */
    chroma: CLASS_CHROMA.NEUTRAL,
    rotationHours: 252.6,
    rotationState: "tumbling",
    metalness: 0,
    orbit: orbitOf(SBDB(22), {
      epochJD: 2461200.5,
      aAU: 2.383835831129859,
      e: 0.1868593763038477,
      iDeg: 4.425205239728406,
      nodeDeg: 262.7765342454273,
      argPeriDeg: 212.8821499078564,
      meanAnomalyDeg: 147.8525890028124,
      meanMotionDegPerDay: 0.267787042557632,
    }),
    /* Afar Lobus and Olduvai Lobus, joined by the narrower Windover Collum,
     * inside the 8.8 x 4.4 x 3.1 km box. Reported as "a dumbbell, a
     * ribbon": the lobes only touched, and the waist was a band. Lucy's
     * images show one continuous, irregular stone -- two lobes and a neck
     * that is narrower but solid, like a larger Selam -- so the lobes now
     * overlap, sit a little off-axis from each other, and merge through a
     * broad fillet. */
    shape: {
      lobes: [
        { c: [-1.85, 0.05, -0.12], r: [2.55, 1.55, 2.15] },
        { c: [2.05, -0.06, 0.14], r: [2.25, 1.38, 1.85] },
      ],
      neck: 6,
      blend: "smooth",
      fillet: 1.4,
      /* Craters and terrain (Prompts.md round 3): relief 0.035 -> 0.05,
       * craters 60 -> 85, depth 0.024 -> 0.03. Lucy saw two heavily
       * cratered lobes (Levison et al. 2025). */
      relief: 0.05,
      grain: 0.018,
      craterCount: 85,
      craterMin: 0.03,
      craterMax: 0.16,
      craterDepth: 0.03,
      boulders: 8,
      boulderSize: 0.035,
      collar: { centreKm: 0.1, widthKm: 1.4, gain: 1.12 },
      seed: 52246,
    },
    surfaceEvidence: "Lucy's L'LORRI camera from about 960 km, 20 April 2025: two cratered lobes, more craters on the larger, and a smoother neck with signs of landslides. The map is generated to match that, not taken from the images",
    info: {
      population: "Main asteroid belt · inner belt, Erigone family",
      diameter: "8.8 × 4.4 × 3.1 km (Marchi et al. 2026)",
      rotationPeriod: "Tumbling: 252.6 ± 0.4 h (10.5 days), with a second period of about 26.5 days (Marchi et al. 2026)",
      gravity: "Not measured",
      surfaceEvidence: "Lucy flyby, 2025. Map generated to match",
      roughness: "Cratered lobes, a smoother neck under 20 million years old",
      description:
        "Lucy's rehearsal: a small main-belt asteroid it flew past on 20 April 2025, on the way to the Trojans, to practise tracking a target. It turned out to be an 8.8 km peanut — two cratered lobes named for the Afar and Olduvai fossil sites, joined by a narrower neck, Windover Collum, where material has slid. It tumbles instead of spinning, once in about ten and a half days with a second wobble every twenty-six. Iron-rich clays on its surface say water once acted on its parent body, which broke apart about 155 million years ago. Named after the palaeoanthropologist who found the Lucy fossil.",
    },
  },

  // ------------------------------------------------------------ Dinkinesh
  {
    id: "dinkinesh",
    name: "Dinkinesh",
    colourMap: true,
    meshDetail: 0.75,
    designation: "152830 Dinkinesh (1999 VD57)",
    classification: "Main-belt asteroid · S-type · flown by Lucy, with a contact-binary moon",
    detail: "The first contact-binary moon ever seen | Lucy flyby 1 November 2023",
    diameterKm: 0.719,
    diameterLabel: "719 ± 24 m",
    albedo: 0.27,
    chroma: CLASS_CHROMA.S_TYPE,
    rotationHours: 3.7387,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(23), {
      epochJD: 2461200.5,
      aAU: 2.191768748791583,
      e: 0.1126817135846694,
      iDeg: 2.093117265661373,
      nodeDeg: 21.35270512523402,
      argPeriDeg: 66.91637126596935,
      meanAnomalyDeg: 29.60751779009531,
      meanMotionDegPerDay: 0.3037469868680356,
    }),
    /* A top: super-ellipsoid about 0.80 x 0.80 x 0.70 km, an equatorial
     * ridge 40-100 m high, and a large trough across it (Levison et al.
     * 2024) -- drawn as two dents in a line. */
    shape: {
      lobes: ellipsoid(0.8, 0.8, 0.7),
      ridge: 0.09,
      /* The trough Lucy saw, as a shallow groove: four small cuts in a line
       * across the +z face, each ~45 m deep on a 790 m body.
       *
       * Reported (round 5): "a hollow in the body that shows sunlight even
       * on the dark side". It was a hole, not a trough. `softness` is in the
       * shape's own units -- km here -- and was 2.2, written as if it were a
       * fraction: the smooth cut subtracted up to k/4 = 0.55 km from a body
       * 0.4 km in radius and dug a pit most of the way through it, whose far
       * wall faced the Sun from the night side. Now 0.03 km. */
      dents: [
        { c: [0.02, -0.12, 0.43], r: 0.075, softness: 0.03 },
        { c: [0.02, 0.0, 0.435], r: 0.08, softness: 0.03 },
        { c: [0.02, 0.12, 0.43], r: 0.075, softness: 0.03 },
        { c: [0.02, 0.23, 0.41], r: 0.065, softness: 0.03 },
      ],
      relief: 0.05,
      grain: 0.025,
      craterCount: 16,
      craterMin: 0.05,
      craterMax: 0.2,
      craterDepth: 0.03,
      boulders: 18,
      boulderSize: 0.04,
      seed: 152830,
    },
    moons: [
      {
        name: "Selam",
        colourMap: true,
        designation: "(152830) Dinkinesh I Selam",
        classification: "Natural satellite · the first contact-binary moon known",
        /* Volume-equivalent of two lobes, 212 and 234 m (Levison et al.
         * 2024). */
        diameterKm: 0.281,
        diameterLabel: "Two lobes, 212 ± 21 and 234 ± 23 m",
        albedo: 0.27,
        chroma: CLASS_CHROMA.S_TYPE,
        /* a = 3.11 +/- 0.05 km, P = 52.67 h, e ~ 0 (Levison et al. 2024);
         * close to Dinkinesh's equator. */
        separationKm: 3.11,
        periodHours: 52.67,
        inclinationDeg: 0,
        shape: {
          lobes: [
            { c: [-0.105, 0, 0], r: [0.12, 0.1, 0.1] },
            { c: [0.115, 0, 0], r: [0.14, 0.105, 0.11] },
          ],
          neck: 7,
          relief: 0.05,
          grain: 0.025,
          craterCount: 6,
          craterMin: 0.06,
          craterMax: 0.18,
          craterDepth: 0.03,
          boulders: 10,
          boulderSize: 0.05,
          seed: 1528301,
        },
        info: {
          diameter: "Lobes 212 ± 21 m and 234 ± 23 m (Levison et al. 2024)",
          rotationPeriod: "Probably synchronous with its 52.67 h orbit",
          orbitalSpeed: `${mutualSpeed(3.11, 52.67)} around Dinkinesh — once every 52.7 hours, 3.1 km out`,
          surfaceEvidence: "Lucy's L'LORRI, 1 November 2023. Map generated to match",
          description:
            "Lucy went past expecting one small asteroid and found a moon — and then, as it moved round, that the moon was two lobes stuck together. Nothing like it was known. It circles 3.1 km from Dinkinesh every 52.7 hours. Selam means 'peace' in Amharic, and is the name of a 3.3-million-year-old fossil child from Ethiopia, a nod to the Lucy fossil the mission is named after.",
        },
      },
    ],
    surfaceEvidence: "Lucy's L'LORRI camera, 1 November 2023, closest approach 431 km: an equatorial ridge, a trough across it, rubble. The map is generated to match, not taken from the images",
    info: {
      population: "Main asteroid belt · inner belt",
      diameter: "719 ± 24 m (Levison et al. 2024)",
      rotationPeriod: "3.7387 ± 0.0013 h, retrograde (Levison et al. 2024)",
      gravity: "Density 2.4 ± 0.35 g/cm³ (Levison et al. 2024)",
      surfaceEvidence: "Lucy flyby, 2023. Map generated to match",
      roughness: "An equatorial ridge 40-100 m high; a large trough",
      description:
        "Lucy's first flyby, 1 November 2023, added late to test the spacecraft's tracking. Dinkinesh is only 720 m across, a stony spinning top with a ridge up to 100 m high round its equator, and a trough running across the ridge that the team reads as a sudden structural failure. Its moon, Selam, was the surprise. Dinkinesh is the Amharic name of the Lucy fossil — 'you are marvellous'.",
    },
  },

  // --------------------------------------------------------------- Hilda
  {
    id: "hilda",
    name: "Hilda",
    colourMap: true,
    meshDetail: 0.75,
    /* The 3:2 resonance: three orbits for Jupiter's two. */
    coOrbital: Object.freeze({ planet: "Jupiter", ratio: 1.5 }),
    designation: "153 Hilda (A875 VC)",
    classification: "Hilda group · 3:2 resonance with Jupiter",
    detail: "The group that traces a triangle | Palisa, 2 November 1875",
    diameterKm: 170.63,
    diameterLabel: "170.6 ± 3.3 km (IRAS)",
    albedo: 0.0618,
    /* B-V 0.669 (JPL SBDB) -> B-R 1.04. */
    chroma: chromaFromBR(brFromBV(0.669)),
    rotationHours: 5.9585,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(87), {
      epochJD: 2461200.5,
      aAU: 3.968376768101129,
      e: 0.1384847714022829,
      iDeg: 7.831389294038131,
      nodeDeg: 228.0800257005049,
      argPeriDeg: 39.0661557941409,
      meanAnomalyDeg: 138.7461320041192,
      meanMotionDegPerDay: 0.1246765356472539,
    }),
    /* Shape unknown: a mild elongation, chosen. */
    /* "A little terrain" (Prompts.md round 3): relief 0.03 -> 0.042. */
    shape: { ...OLD_RELIEF, lobes: ellipsoid(182, 170, 160), relief: 0.042, seed: 153 },
    surfaceEvidence: "A point of light. Size and albedo from IRAS. Surface generated",
    info: {
      population: "Hilda group · 3:2 resonance with Jupiter, 3.42-4.52 AU",
      diameter: "170.6 ± 3.3 km, albedo 0.062 (IRAS, JPL SBDB)",
      rotationPeriod: "5.9585 h (JPL SBDB)",
      speedNote: " — three orbits for every two of Jupiter's",
      gravity: "Not measured",
      surfaceEvidence: "Point of light. Surface generated",
      roughness: "unknown",
      description:
        "Hilda goes round the Sun exactly three times for every two orbits of Jupiter, about 7.9 years each, and gives its name to a group of more than 6,000 asteroids in the same resonance. Their meetings with Jupiter always fall at their perihelion, as far from Jupiter as they get, which protects them; and so they spend their slow aphelion time near three places — Jupiter's L3, L4 and L5 points. Together, seen from Jupiter's point of view, they trace a triangle that turns with it. The drawn Hildas around the swarms show it. Discovered by Johann Palisa in Vienna on 2 November 1875.",
    },
  },
];

/* Each card's speed now, from its own elements (catalogueHelpers.js). */
export const JUPITER_TROJANS = Object.freeze(RECORDS.map(withSpeedNow));

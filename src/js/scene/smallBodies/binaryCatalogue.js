/**
 * Five near-equal binaries past Neptune, one of them a triple.
 *
 * Rank 4 of `docs/bodies-to-draw-next.md`, batch B. Batch A drew fourteen
 * worlds whose moons are small beside them; these are the systems where the
 * "moon" is nearly as big as the "planet" -- Lempo with Hiisi and Paha,
 * Sila with Nunam, Teharonhiawako with Sawiskera, Altjira with its unnamed
 * partner, Manwë with Thorondor. The scene had no example of the type, and
 * the type matters: pairs this equal, this far apart and this loosely bound
 * cannot have been made by one body capturing another or by a giant impact.
 * They are what a pebble cloud collapsing under its own gravity leaves
 * behind (Nesvorný et al. 2010, AJ 140, 785), and they survive only where
 * nothing has disturbed them since -- which is why four of the five are in
 * the cold classical belt, beside Arrokoth.
 *
 * ## Drawn about the barycentre
 *
 * In every other system in this scene the moon goes round a parent that
 * stays put. Here that would be the wrong picture: two bodies of nearly the
 * same mass both go round the point between them. Each companion therefore
 * carries `barycentric: true` and a `massRatio`, and the small-body builder
 * moves the *system's* centre of mass along the heliocentric orbit and both
 * bodies about it, on the published mutual eccentricity -- see
 * `updateBinarySystem` in smallBodies.js. Lempo is the hierarchical case:
 * Lempo and Hiisi go round their own centre every 1.9 days, and that centre
 * and Paha go round the system's every 50 (`around: "pair"`).
 *
 * The mass ratios come from the published component masses where they
 * exist (Lempo, Nelsen et al. 2024) and otherwise from the diameters at
 * equal density, q = (d2/d1)^3, which is the assumption every one of the
 * source papers makes when it splits a system mass between two bodies it
 * cannot resolve. Each record says which.
 *
 * ## What is drawn and what is chosen
 *
 * Measured: the heliocentric orbits (JPL SBDB), the sizes (Herschel,
 * Spitzer and Hubble photometry), the mutual orbits' size, period,
 * eccentricity and tilt (Hubble astrometry), the colours, Manwë's two lobes
 * and the lightcurve elongations. Not measured and so chosen: where along
 * each mutual orbit the pair starts, and the direction of each mutual
 * orbit's node, which the papers give in the sky plane rather than the
 * ecliptic -- both are set to zero, so the tilt is right and the heading is
 * not. Surfaces are borrowed from Arrokoth, the only body of this
 * population a spacecraft has seen.
 *
 * ## Colour maps
 *
 * Every body here carries `colourMap: true`. The surfaces were designed in
 * binary-surface-lab.html against real ones (Callisto, Bennu, Ryugu,
 * Mathilde, Lutetia, Arrokoth) and picked there by the project owner:
 * Lempo, Hiisi and Paha cratered to saturation; Sila lightly cratered and
 * Nunam a dirty snowball; Teharonhiawako and Sawiskera grooved; Altjira and
 * its partner boulder rubble; Manwë a snowball, frosted, cracked at the
 * neck, and Thorondor rubble. Each has a colour map and a normal map, so the
 * relief is lit by the Sun (tools/binary-surface-lab). The features are
 * illustrative; that all eleven are red to very red, and the albedos, are
 * measured.
 *
 * Mutual orbits run on the same compressed clock as every moon in this
 * module (4.8-52 s a revolution), so Teharonhiawako's 2.3-year orbit and
 * Sila's 12.5-day one both take about 52 s on screen. The cards give the
 * real periods.
 *
 * ## Provenance
 *
 * Orbital elements: JPL Small-Body Database, queried 27 September 2026 at
 * full precision, all at JD 2461200.5 -- the epoch of every other catalogue
 * here. Colours are converted with `chromaFromBR` and `brFromVR`, shared
 * with tnoCatalogue.js; "secondary" marks a number read in a compilation
 * whose primary paper could not be opened to confirm it.
 */
import {
  meanMotion,
  ellipsoid,
  chromaFromBR,
  brFromVR,
  orbitLine,
  ICY_RELIEF,
} from "./tnoCatalogue.js";

const orbitFrom = (solution, el) => ({
  solution: `JPL SBDB orbit solution ${solution}, epoch JD 2461200.5, queried 27 September 2026`,
  epochJD: 2461200.5,
  ...el,
  meanMotionDegPerDay: meanMotion(el.aAU),
});

/* Relative orbital speed, 2 pi a / P, for the cards. */
const mutualSpeed = (aKm, periodDays) =>
  `${((2 * Math.PI * aKm) / (periodDays * 86400) * 1000).toFixed(1)} m/s`;

/* Where the centre of mass sits: a q / (1 + q) from the primary. */
const baryFromPrimary = (aKm, q) => Math.round((aKm * q) / (1 + q));

/* Cold classicals are small bodies that never relaxed as far as the 700 km
 * worlds of batch A: a little more relief, more craters. Halfway between the
 * batch A setting and the Centaurs'. */
const COLD_RELIEF = Object.freeze({
  ...ICY_RELIEF,
  relief: 0.018,
  grain: 0.008,
  craterCount: 90,
  craterDepth: 0.013,
});

export const KUIPER_BINARIES = Object.freeze([
  // ------------------------------------------------------------------ Lempo
  {
    id: "lempo",
    name: "Lempo",
    colourMap: true,
    designation: "47171 Lempo (1999 TC36)",
    classification: "Trans-Neptunian · plutino · hierarchical triple",
    detail: "A close pair with a third body circling both | Hubble, Benecchi et al. 2010",
    sizeCurve: "dwarf",
    /* Mommert et al. 2012, A&A 541, A93: Herschel PACS with Spitzer, the
     * system's flux split by Hubble photometry. */
    diameterKm: 272,
    diameterLabel: "272 +17/−19 km",
    albedo: 0.079,
    /* System colours B-V 1.029, V-R 0.693 (secondary) -> B-R 1.722: red. The
     * three are not resolved in colour, so all three take it. */
    chroma: chromaFromBR(1.029 + 0.693),
    /* 6.21 h from a fragmentary lightcurve (JPL/LCDB, "may be completely
     * wrong"); kept because it is the only number there is. */
    rotationHours: 6.21,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(57, {
      aAU: 39.65642454418079,
      e: 0.2285304287303842,
      iDeg: 8.404037172604895,
      nodeDeg: 97.1624650655848,
      argPeriDeg: 295.8317561632739,
      meanAnomalyDeg: 15.44324079682706,
    }),
    shape: { ...COLD_RELIEF, lobes: ellipsoid(280, 272, 264), seed: 47171 },
    moons: [
      {
        /* Nelsen et al. 2024, Planet. Sci. J. (arXiv 2403.12785), Table 2:
         * a = 838 +13/-21 km, e = 0.123, i = 67.97 deg; masses Lempo 5.725,
         * Hiisi 7.657 x 10^18 kg -- Hiisi is the heavier of the two. Period
         * from Kepler's third law with that total mass: 1.867 d ("about 1.9
         * days", Benecchi et al. 2010). */
        name: "Hiisi",
        colourMap: true,
        designation: "(47171) Lempo II Hiisi",
        classification: "Binary partner · heavier than Lempo itself",
        diameterKm: 251,
        diameterLabel: "251 +16/−17 km",
        separationKm: 838,
        periodHours: 44.8,
        inclinationDeg: 67.97,
        eccentricity: 0.123,
        barycentric: true,
        /* 7.657 / 5.725, measured (Nelsen et al. 2024). Above one: the
         * centre of mass is nearer Hiisi than Lempo. */
        massRatio: 7.657 / 5.725,
        family: "Inner binary partner",
        albedo: 0.079,
        rotationHours: 6.21,
        shape: { ...COLD_RELIEF, lobes: ellipsoid(258, 251, 244), seed: 47172 },
        info: {
          diameter: "251 +16/−17 km — Mommert et al. 2012",
          rotationPeriod: "Unknown",
          orbitalSpeed: `${mutualSpeed(838, 1.867)} relative to Lempo — once every 1.9 days at 838 km. The pair's centre of mass is ${baryFromPrimary(838, 7.657 / 5.725)} km from Lempo`,
          surfaceEvidence: "Split from Lempo by Hubble in 2007; never resolved as a disc",
          description: "Lempo's inner partner, 838 kilometres away — six of Lempo's radii, closer than any other pair in this scene — and, by the most recent fit to fifteen years of Hubble positions, the heavier of the two, so it is Lempo that swings further round their shared centre. At about 0.9 g/cm³ against Lempo's 0.54 it is also the denser. Named after the Hiisi of Finnish myth, spirits of sacred groves turned into goblins when Christianity arrived.",
          gravity: "7.66 × 10¹⁸ kg · density about 0.93 g/cm³ — Nelsen et al. 2024",
        },
      },
      {
        /* Nelsen et al. 2024, Table 2: a = 7,606 +23/-24 km about the inner
         * pair's barycentre, e = 0.2903, i = 59.65 deg; mass 0.248 x 10^18 kg.
         * Period from those: 50.58 d (Benecchi et al. 2010 measured 50.302 d
         * at a = 7,411 km). */
        name: "Paha",
        colourMap: true,
        designation: "(47171) Lempo I Paha",
        classification: "Outer companion · circles the Lempo–Hiisi pair",
        diameterKm: 132,
        diameterLabel: "132 +8/−9 km",
        separationKm: 7606,
        periodHours: 1214,
        inclinationDeg: 59.65,
        eccentricity: 0.2903,
        barycentric: true,
        around: "pair",
        /* 0.248 / (5.725 + 7.657), measured (Nelsen et al. 2024). */
        massRatio: 0.248 / (5.725 + 7.657),
        family: "Outer companion",
        albedo: 0.079,
        shape: { ...COLD_RELIEF, lobes: ellipsoid(136, 132, 128), craterCount: 40, seed: 47173 },
        info: {
          diameter: "132 +8/−9 km — Mommert et al. 2012",
          rotationPeriod: "Unknown",
          orbitalSpeed: `${mutualSpeed(7606, 50.58)} — once every 50 days, 7,606 km from the inner pair's centre of mass`,
          surfaceEvidence: "Found by Hubble in 2001 as Lempo's 'moon'; that 'Lempo' was itself two bodies was found in 2007",
          description: "The third body of the system, circling the Lempo–Hiisi pair at nine times their separation. Its orbit is chaotic: the inner pair's pull on it changes every 1.9 days, and the long-term evolution cannot be predicted (Correia 2018, Icarus 305, 250). Its density comes out at only about 0.2 g/cm³ — an unreliably small mass, or a very porous body. Paha is the Finnish word for evil.",
          gravity: "0.25 × 10¹⁸ kg — Nelsen et al. 2024, poorly constrained",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Three bodies split by Hubble (Benecchi et al. 2010, Icarus 207, 978); sizes from Herschel and Spitzer (Mommert et al. 2012). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · plutino, 3:2 resonance with Neptune, 30.6-48.7 AU",
      diameter: "272 +17/−19 km — Herschel and Spitzer, Mommert et al. 2012",
      rotationPeriod: "6.21 h — fragmentary lightcurve (LCDB), may be wrong",
      orbitalSpeed: orbitLine(39.65642454418079),
      gravity: "5.73 × 10¹⁸ kg · density about 0.54 g/cm³ — Nelsen et al. 2024. System 13.6 × 10¹⁸ kg",
      surfaceEvidence: "A point of light Hubble can split into three. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Found in 1999 as a single plutino, given a moon, Paha, by Hubble in 2001 — and then in 2007 'Lempo' itself came apart into two bodies of nearly equal size, 838 kilometres apart. So it is a hierarchical triple: a tight pair going round each other every 1.9 days, and a third body going round the pair every 50. Nothing about it is stable in the long run; the outer orbit is chaotic. The whole system is less dense than water — Lempo alone about 0.54 g/cm³ — which says these are loosely packed ice and rubble. The names are from Finnish mythology, where Lempo, Hiisi and Paha are evil spirits.",
    },
  },

  // ------------------------------------------------------------ Sila–Nunam
  {
    id: "sila",
    name: "Sila",
    colourMap: true,
    designation: "79360 Sila–Nunam (1997 CS29)",
    classification: "Trans-Neptunian · cold classical · near-equal binary",
    detail: "Two bodies that always show each other the same face | Grundy et al. 2012",
    sizeCurve: "dwarf",
    /* Grundy et al. 2012, Icarus 220, 74: 250 +/- 30 and 235 +/- 28 km from
     * Herschel with the Hubble brightness split. */
    diameterKm: 250,
    diameterLabel: "≈250 ± 30 km",
    albedo: 0.09,
    /* B-R 1.74 (JPL/compilation; secondary): very red, as cold classicals
     * are. Both components take it. */
    chroma: chromaFromBR(1.74),
    /* Doubly synchronous: each spins once per 12.50995 d orbit (Rabinowitz
     * et al. 2014, Icarus 236, 72; LCDB 300.24 h). */
    rotationHours: 300.24,
    rotationState: "principal-axis",
    tidallyLocked: true,
    metalness: 0,
    framePair: false,
    orbit: orbitFrom(33, {
      aAU: 44.0834520075444,
      e: 0.01524656926541188,
      iDeg: 2.237982940736737,
      nodeDeg: 304.2518403824261,
      argPeriDeg: 216.6024112871467,
      meanAnomalyDeg: 350.4901495748081,
    }),
    /* "Both bodies are elongated with their long axes pointing to each
     * other" (Rabinowitz et al. 2014). The elongation is not given here, so
     * it is drawn at a/b = 1.1 -- chosen, and the card says so -- about the
     * volume-equivalent 250 km. */
    shape: { ...COLD_RELIEF, lobes: ellipsoid(266.4, 242.2, 242.2), seed: 79360 },
    moons: [
      {
        /* Grundy et al. 2012: a = 2,777 +/- 19 km, e = 0.020; Rabinowitz et
         * al. 2014: P = 12.50995 +/- 0.00036 d, i = 103.51 +/- 0.39 deg. */
        name: "Nunam",
        colourMap: true,
        designation: "(79360) Sila–Nunam, secondary",
        classification: "Binary partner · almost Sila's twin",
        diameterKm: 235,
        diameterLabel: "≈235 ± 28 km",
        separationKm: 2777,
        periodHours: 300.24,
        inclinationDeg: 103.51,
        eccentricity: 0.020,
        barycentric: true,
        /* Equal density: (235 / 250)^3. */
        massRatio: (235 / 250) ** 3,
        tidallyLocked: true,
        family: "Binary partner",
        albedo: 0.09,
        rotationHours: 300.24,
        shape: { ...COLD_RELIEF, lobes: ellipsoid(250.4, 227.6, 227.6), seed: 79361 },
        info: {
          diameter: "≈235 ± 28 km — Grundy et al. 2012",
          rotationPeriod: "12.51 days — the same as its orbit, and as Sila's: doubly synchronous (Rabinowitz et al. 2014)",
          orbitalSpeed: `${mutualSpeed(2777, 12.50995)} relative to Sila — once every 12.51 days at 2,777 km. Their centre of mass is ${baryFromPrimary(2777, (235 / 250) ** 3)} km from Sila`,
          surfaceEvidence: "Split from Sila by Hubble; the pair eclipsed each other from 2009 to 2017",
          description: "Sila's partner and very nearly its twin, 94 per cent of its width. The two have braked each other's spin until each turns once per orbit, so each keeps one face towards the other for ever — like the Moon to Earth, but both ways at once. Nunam is the Inuit earth goddess.",
          gravity: "System 1.08 × 10¹⁹ kg · density 0.72 +0.37/−0.22 g/cm³ — Grundy et al. 2012",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Split by Hubble; mutual eclipses 2009-2017 (Grundy et al. 2012, Icarus 220, 74; Rabinowitz et al. 2014, Icarus 236, 72). Elongation chosen, not measured. Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · cold classical Kuiper Belt, 43.4-44.8 AU",
      diameter: "≈250 ± 30 km — Herschel with Hubble photometry, Grundy et al. 2012",
      rotationPeriod: "12.51 days — locked to its partner (Rabinowitz et al. 2014)",
      orbitalSpeed: orbitLine(44.0834520075444),
      gravity: "System 1.08 × 10¹⁹ kg · density 0.72 +0.37/−0.22 g/cm³ — Grundy et al. 2012",
      surfaceEvidence: "Two points of light Hubble can split. Drawn slightly elongated towards Nunam, as Rabinowitz et al. 2014 describe — the axis ratio is chosen. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Two bodies of almost the same size, 2,777 kilometres apart, each turning once in the twelve and a half days they take to go round each other — so each shows the other only one face, and both are stretched along the line between them. From 2009 to 2017 the Earth was in the plane of their orbit and they took turns eclipsing each other, which is how the orbit and the shapes were pinned down. Very red, on a nearly circular orbit in the cold classical belt, where nothing has disturbed them since they formed. Named for Sila, the Inuit sky and weather spirit, and Nunam, the earth.",
    },
  },

  // ------------------------------------------------------- Teharonhiawako
  {
    id: "teharonhiawako",
    name: "Teharonhiawako",
    colourMap: true,
    designation: "88611 Teharonhiawako (2001 QT297)",
    classification: "Trans-Neptunian · cold classical · wide binary",
    detail: "The widest pair here: 311 of its own radii apart | Grundy et al. 2011",
    sizeCurve: "dwarf",
    /* Vilenius et al. 2014, A&A 564, A35: system 220 +41/-44 km, split
     * 178 +33/-36 and 129 +24/-26 km. */
    diameterKm: 178,
    diameterLabel: "178 +33/−36 km",
    albedo: 0.145,
    /* Osip et al. 2003, EM&P 92, 409: the primary's colours "about 0.3
     * magnitudes redder than solar", taken as V-R 0.354 + 0.30 -> B-R 1.64.
     * Sawiskera's colour varied with its brightness; it takes the same. */
    chroma: chromaFromBR(brFromVR(0.354 + 0.30)),
    rotationHours: 8,
    rotationState: "principal-axis",
    metalness: 0,
    framePair: false,
    orbit: orbitFrom(19, {
      aAU: 43.98889757762394,
      e: 0.02806136599327052,
      iDeg: 2.584394692595602,
      nodeDeg: 304.8753977387733,
      argPeriDeg: 232.8409914949756,
      meanAnomalyDeg: 175.1473894892783,
    }),
    /* No lightcurve for the primary ("no evidence for variability", Osip et
     * al. 2003): nearly round overall, but at 178 km too small to have pulled
     * itself smooth -- so rougher relief and a few large basins than the
     * bigger worlds, which is what gives it an uneven, lumpy outline. */
    shape: {
      ...COLD_RELIEF,
      lobes: ellipsoid(186, 178, 170),
      relief: 0.034,
      grain: 0.012,
      craterDepth: 0.028,
      bigCraters: [
        { dir: [0.5, 0.3, 0.81], radius: 0.42, depth: 0.05, rim: 0.012 },
        { dir: [-0.7, -0.1, 0.7], radius: 0.34, depth: 0.045, rim: 0.01 },
        { dir: [0.1, -0.8, -0.59], radius: 0.3, depth: 0.04, rim: 0.01 },
      ],
      seed: 88611,
    },
    moons: [
      {
        /* Grundy et al. 2011, Icarus 213, 678: a = 27,670 +/- 120 km,
         * P = 828.76 +/- 0.22 d, e = 0.2494 +/- 0.0021, i = 144.42 deg
         * (retrograde). */
        name: "Sawiskera",
        colourMap: true,
        designation: "(88611) Teharonhiawako I Sawiskera",
        classification: "Binary partner · an elongated tumbler",
        diameterKm: 129,
        diameterLabel: "129 +24/−26 km",
        separationKm: 27670,
        periodHours: 19890,
        inclinationDeg: 144.42,
        eccentricity: 0.2494,
        barycentric: true,
        /* Equal density: (129 / 178)^3. */
        massRatio: (129 / 178) ** 3,
        family: "Binary partner",
        albedo: 0.145,
        /* 9.505 h double-peaked, 0.6 mag amplitude (Osip et al. 2003). */
        rotationHours: 9.505,
        /* a/b >= 10^(0.4 x 0.6) = 1.74, about the 129 km volume-equivalent. */
        /* ...and battered: the smaller body, so rougher still. */
        shape: {
          ...COLD_RELIEF,
          lobes: ellipsoid(186.6, 107.2, 107.2),
          relief: 0.045,
          grain: 0.016,
          craterCount: 60,
          craterDepth: 0.035,
          bigCraters: [
            { dir: [0.9, 0.2, 0.39], radius: 0.4, depth: 0.06, rim: 0.012 },
            { dir: [-0.6, 0.5, -0.62], radius: 0.36, depth: 0.05, rim: 0.01 },
          ],
          seed: 88612,
        },
        info: {
          diameter: "129 +24/−26 km — Vilenius et al. 2014. At least 1.74 times longer than wide, from its 0.6-magnitude lightcurve",
          rotationPeriod: "9.51 h (or 4.75 h) — Osip et al. 2003",
          orbitalSpeed: `${mutualSpeed(27670, 828.76)} — about walking pace — once every 2.27 years at 27,670 km, backwards. Their centre of mass is ${baryFromPrimary(27670, (129 / 178) ** 3)} km from Teharonhiawako`,
          surfaceEvidence: "Split from its partner from the ground, with the Magellan telescopes in 2001 — one of the first Kuiper Belt binaries found",
          description: "Teharonhiawako's partner, 27,670 kilometres away — a separation of hundreds of their own radii, bound so weakly that the two drift round each other at a couple of metres a second. Its brightness swings by 0.6 magnitudes as it turns, so it is strongly elongated. In Mohawk tradition Sawiskera is the troublesome twin brother of Teharonhiawako.",
          gravity: "System 2.45 × 10¹⁸ kg — Grundy et al. 2011",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Split from the ground (Osip et al. 2003); mutual orbit from Hubble (Grundy et al. 2011, Icarus 213, 678); sizes from Herschel (Vilenius et al. 2014). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · cold classical Kuiper Belt, 42.8-45.2 AU",
      diameter: "178 +33/−36 km — Herschel, Vilenius et al. 2014",
      rotationPeriod: "Not measured — no lightcurve variation found; drawn turning once every 8 hours",
      orbitalSpeed: orbitLine(43.98889757762394),
      gravity: "System 2.45 × 10¹⁸ kg · density 1.15 +0.87/−0.91 g/cm³ — Grundy et al. 2011, Vilenius et al. 2014",
      surfaceEvidence: "A point of light, split in two. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "The widest pair drawn here: Teharonhiawako and Sawiskera are 27,670 kilometres apart — hundreds of their own radii — and take two and a quarter years to go round each other, backwards and on a stretched orbit. A pair this loosely bound would be pulled apart by any passing encounter, so it has had none: it is a survivor from the time the planets formed, of the kind gravitational collapse in the early pebble disc makes naturally and nothing else does. Found in 2001 by the Deep Ecliptic Survey. In Mohawk tradition Teharonhiawako is the god of farming, and Sawiskera his twin.",
    },
  },

  // --------------------------------------------------------------- Altjira
  {
    id: "altjira",
    name: "Altjira",
    colourMap: true,
    designation: "148780 Altjira (2001 UQ18)",
    classification: "Trans-Neptunian · cold classical · probably a triple",
    detail: "A pair whose larger member is itself probably two | Nelsen et al. 2025",
    sizeCurve: "dwarf",
    /* Vilenius et al. 2014: system 331 +51/-187 km, split 246 and ~222 km. */
    diameterKm: 246,
    diameterLabel: "246 km volume-equivalent · probably two bodies about 124 km apart",
    albedo: 0.14,
    /* B-V 0.91, V-R 0.74 (Vilenius et al. 2014 compilation) -> B-R 1.65. */
    chroma: chromaFromBR(0.91 + 0.74),
    /* Nelsen et al. 2025, PSJ ("Beyond Point Masses IV", arXiv 2403.12786):
     * the partner's orbit precesses as no single body could make it, and the
     * best explanation is that Altjira is itself a close pair -- near-equal
     * masses, about 124 km apart, going round every ~5.5 h. Two bodies of
     * 246 km's volume cannot sit 124 km apart without touching, so it is
     * drawn as a touching pair turning in those 5.5 hours; the authors note
     * the thermal sizes are probably overestimates. */
    rotationHours: 5.5,
    rotationState: "principal-axis",
    metalness: 0,
    framePair: false,
    orbit: orbitFrom(15, {
      aAU: 44.50554694434643,
      e: 0.05688956795580965,
      iDeg: 5.199764557542179,
      nodeDeg: 1.929499591517581,
      argPeriDeg: 302.7381719946373,
      meanAnomalyDeg: 131.8821393958222,
    }),
    /* Two equal lobes 124 km apart whose union has the 246 km volume:
     * radius 101 km each (union volume 7.79 x 10^6 km^3 against 7.80 for
     * the sphere). Rubble-pile relief: its density may be ~0.3 g/cm^3. */
    shape: {
      ...COLD_RELIEF,
      lobes: [
        { c: [-62, 0, 0], r: [101, 101, 101] },
        { c: [62, 0, 0], r: [101, 101, 101] },
      ],
      neck: 8,
      relief: 0.03,
      grain: 0.018,
      craterCount: 110,
      seed: 148780,
    },
    moons: [
      {
        /* Grundy et al. 2011: a = 9,904 +/- 56 km, P = 139.561 +/- 0.047 d,
         * e = 0.3445 +/- 0.0045, retrograde at 35.19 deg from prograde ->
         * drawn at 144.81 deg. */
        name: "Altjira I",
        colourMap: true,
        designation: "Companion of (148780) Altjira — no official designation",
        classification: "Binary partner · unnamed",
        diameterKm: 222,
        diameterLabel: "≈222 km",
        separationKm: 9904,
        periodHours: 3349.5,
        inclinationDeg: 144.81,
        eccentricity: 0.3445,
        barycentric: true,
        /* Equal density: (222 / 246)^3. */
        massRatio: (222 / 246) ** 3,
        family: "Binary partner",
        albedo: 0.14,
        shape: { ...COLD_RELIEF, lobes: ellipsoid(227, 222, 217), seed: 148781 },
        info: {
          diameter: "≈222 km — Vilenius et al. 2014",
          rotationPeriod: "Unknown",
          orbitalSpeed: `${mutualSpeed(9904, 139.561)} — once every 139.6 days at 9,904 km, backwards, on an orbit stretched to e = 0.34. Their centre of mass is ${baryFromPrimary(9904, (222 / 246) ** 3)} km from Altjira`,
          surfaceEvidence: "Found by Hubble in 2007; never resolved as a disc",
          description: "Altjira's partner, nine-tenths of its width and still without a name — a proposed designation, S/2007 (148780) 1, is not yet official. The two go round each other backwards, 9,904 kilometres apart, on a noticeably stretched orbit.",
          gravity: "System ≈4 × 10¹⁸ kg — Grundy et al. 2011",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Split by Hubble (Grundy et al. 2011, Icarus 213, 678); sizes from Herschel (Vilenius et al. 2014); probably a triple, from the partner's non-Keplerian motion (Nelsen et al. 2025). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · cold classical Kuiper Belt, 42.0-47.0 AU",
      diameter: "246 +38/−139 km — Herschel, Vilenius et al. 2014; the lower bound is loose",
      rotationPeriod: "About 5.5 h — if it is a close pair, the time its two halves take to go round each other (Nelsen et al. 2025)",
      orbitalSpeed: orbitLine(44.50554694434643),
      gravity: "System ≈4 × 10¹⁸ kg — Grundy et al. 2011 · density 0.3 +0.50/−0.14 g/cm³ — Vilenius et al. 2014",
      surfaceEvidence: "A point of light, split in two — and probably three. Surface borrowed from Arrokoth, coloured from its measured redness",
      roughness: "unknown",
      description:
        "Two bodies of nearly the same size going round each other backwards every 139.6 days, 9,904 kilometres apart — and the larger one is probably two more. In 2025 a team using seventeen years of Hubble and Keck positions found the partner's orbit slowly twisting in a way a single round body cannot cause; the best fit is that Altjira itself is a pair about 124 km apart, so close they are probably touching, like Arrokoth. Backwards mutual orbits turn up among these pairs alongside forward ones, and the mix of directions is one of the tests that models of how they formed are checked against. Its density may be as low as a third of water's, though with large error bars. Altjira is the creator of the Arrernte people of central Australia, who lives in the sky.",
    },
  },

  // ---------------------------------------------------------------- Manwë
  {
    id: "manwe",
    name: "Manwë",
    colourMap: true,
    designation: "385446 Manwë (2003 QW111)",
    classification: "Trans-Neptunian · binary with a two-lobed primary",
    detail: "A contact binary with a partner on a stretched orbit | Rabinowitz et al. 2019",
    sizeCurve: "dwarf",
    /* Rabinowitz et al. 2019 (arXiv 1911.08546): 150 km volume-equivalent,
     * "a highly bilobate contact binary", width/length about 0.30. */
    diameterKm: 150,
    diameterLabel: "150 km volume-equivalent · about 330 km end to end",
    albedo: 0.06,
    /* B-V 1.07, V-R 0.61 (secondary) -> B-R 1.68. */
    chroma: chromaFromBR(1.07 + 0.61),
    /* 11.88190 +/- 0.00005 h, double-peaked (Rabinowitz et al. 2019). */
    rotationHours: 11.8819,
    rotationState: "principal-axis",
    metalness: 0,
    framePair: false,
    orbit: orbitFrom(9, {
      aAU: 43.76613700406001,
      e: 0.1159754735970183,
      iDeg: 2.665691869958255,
      nodeDeg: 68.54393928019606,
      argPeriDeg: 19.99590797249916,
      meanAnomalyDeg: 289.5171982193772,
    }),
    /* Two equal prolate lobes touching end to end, at the published
     * width/length of 0.30 and the 150 km volume-equivalent: lobes 167.4 x
     * 100 x 100 km, centres 167.4 km apart, 335 km overall. Joined by the
     * same soft maximum that makes Arrokoth's neck. */
    shape: {
      ...COLD_RELIEF,
      lobes: [
        /* Overlapping by 20 km rather than touching at a point, which
         * drew the neck as a thin band (reported for the "dumbbell"
         * shapes); the lightcurve's width/length ratio of 0.30 is kept. */
        { c: [-73, 0, 0], r: [90, 50, 50] },
        { c: [73, 0, 0], r: [90, 50, 50] },
      ],
      neck: 10,
      blend: "smooth", fillet: 45, /* One continuous surface, not two lobes and a band (smallBodyShapes.js, "blend"). */
      seed: 385446,
    },
    moons: [
      {
        /* Grundy et al. 2014, Icarus 237, 1: a = 6,674 +/- 41 km, P =
         * 110.176 +/- 0.018 d, e = 0.5632 +/- 0.0070, i = 25.58 deg. */
        name: "Thorondor",
        colourMap: true,
        designation: "(385446) Manwë I Thorondor",
        classification: "Binary partner · on a highly stretched orbit",
        diameterKm: 108,
        diameterLabel: "108 km volume-equivalent",
        separationKm: 6674,
        periodHours: 2644.2,
        inclinationDeg: 25.58,
        eccentricity: 0.5632,
        barycentric: true,
        /* Equal density: (108 / 150)^3. */
        massRatio: (108 / 150) ** 3,
        family: "Binary partner",
        albedo: 0.09,
        /* ~309 d, slow and probably chaotic (Rabinowitz et al. 2019). */
        rotationHours: 7423,
        /* a/b >= 10^(0.4 x 0.55) = 1.66, about the 108 km volume-equivalent.
         * The paper's best ellipsoid is a flattened disc (a/c 7.3, b/c 6.7);
         * this file's rule is the lightcurve bound, and the card says both. */
        shape: {
          ...COLD_RELIEF,
          lobes: ellipsoid(151.4, 91.2, 91.2),
          relief: 0.045,
          grain: 0.016,
          craterCount: 60,
          craterDepth: 0.035,
          bigCraters: [
            { dir: [0.8, -0.3, 0.52], radius: 0.38, depth: 0.06, rim: 0.012 },
            { dir: [-0.5, 0.6, 0.62], radius: 0.3, depth: 0.05, rim: 0.01 },
          ],
          seed: 385447,
        },
        info: {
          diameter: "108 km volume-equivalent — Rabinowitz et al. 2019",
          rotationPeriod: "About 309 days, probably chaotic — Rabinowitz et al. 2019",
          orbitalSpeed: `${mutualSpeed(6674, 110.176)} — once every 110 days at 6,674 km on average, on an orbit stretched to e = 0.56. Their centre of mass is ${baryFromPrimary(6674, (108 / 150) ** 3)} km from Manwë`,
          surfaceEvidence: "Found by Hubble in 2006; the pair eclipsed each other between 2014 and 2018",
          description: "Manwë's partner, on the most stretched orbit of any pair here — it comes in to about 2,900 kilometres and goes out to about 10,400. It brightens and fades by more than half a magnitude over roughly 300 days, which one model reads as a strongly flattened body, a/c about 7; it is drawn at the elongation its lightcurve requires at least. Thorondor is the king of the eagles in Tolkien's legendarium.",
          gravity: "System 1.94 × 10¹⁸ kg · density about 0.8 g/cm³ — Grundy et al. 2014",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Two lobes from its lightcurve (Rabinowitz et al. 2019); mutual orbit from Hubble (Grundy et al. 2014, Icarus 237, 1). Surface relief borrowed from Arrokoth, itself a contact binary",
    info: {
      population: "Trans-Neptunian · Kuiper Belt, 38.7-48.8 AU",
      diameter: "150 km volume-equivalent, two lobes about 330 km end to end — Rabinowitz et al. 2019",
      rotationPeriod: "11.88190 ± 0.00005 h — Rabinowitz et al. 2019",
      orbitalSpeed: orbitLine(43.76613700406001),
      gravity: "System 1.94 × 10¹⁸ kg · density about 0.8 g/cm³ — Grundy et al. 2014",
      surfaceEvidence: "A point of light, split in two by Hubble; its own two lobes are inferred from the way its brightness changes. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "A binary in which one of the two is itself double: Manwë's lightcurve, measured through the 2014-2018 season when it and Thorondor took turns eclipsing each other, can only be matched by a body shaped like a barbell — two lobes touching, like Arrokoth, three times as long as it is wide. So the system is really three bodies, two of them stuck together. Thorondor circles it on a strongly stretched orbit every 110 days. Named after Manwë, lord of the winds and King of the Valar in Tolkien's legendarium — a pair for Varda and Ilmarë already in this scene.",
    },
  },
]);

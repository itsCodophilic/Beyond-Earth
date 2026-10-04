/**
 * Near-Earth oddities and Earth's co-orbitals: Rank 10 of
 * `docs/bodies-to-draw-next.md`.
 *
 *   3200 Phaethon          a 'rock comet', parent of the Geminids
 *   4179 Toutatis          a tumbling contact binary, flown by Chang'e-2
 *   469219 Kamoʻoalewa     Earth's quasi-satellite, Tianwen-2's target
 *   3753 Cruithne          Earth's horseshoe companion
 *   66391 Moshup           a spinning top with a moon, Squannit
 *   1620 Geographos        the most elongated body radar had seen
 *
 * Kamoʻoalewa and Cruithne carry `coOrbital: { planet: "Earth", ratio: 1 }`
 * and are drawn in a frame that turns with the drawn Earth (smallBodies.js),
 * because what makes them interesting is where they are *relative to Earth*:
 * on the same period, a slightly different ellipse and tilt carry
 * Kamoʻoalewa round a loop that stays near Earth all year. The ~770-year
 * horseshoe of Cruithne is far too slow to see on any clock the scene runs;
 * its card says so.
 *
 * Evidence: Toutatis was photographed by Chang'e-2 (2012) and Kamoʻoalewa by
 * Tianwen-2 (first image July 2026, few details published); Phaethon,
 * Moshup and Geographos are radar shape models; Cruithne has no shape at
 * all. Every surface is generated in the class colour, and the cards say so.
 *
 * Elements: JPL SBDB, every one at JD 2461200.5 (9 June 2026).
 */
import {
  brFromBV,
  chromaFromBR,
  CLASS_CHROMA,
  cometDust,
  ellipsoid,
  orbitOf,
  withSpeedNow,
} from "./catalogueHelpers.js";

const SBDB = (solution) => `JPL SBDB orbit solution ${solution}, epoch JD 2461200.5, queried 27 September 2026`;
const EARTH_1_1 = Object.freeze({ planet: "Earth", ratio: 1 });

const ROCKY = Object.freeze({
  neck: 1,
  relief: 0.04,
  grain: 0.018,
  craterCount: 24,
  craterMin: 0.04,
  craterMax: 0.16,
  craterDepth: 0.025,
  boulders: 12,
  boulderSize: 0.04,
});

/* Moshup: B-V 0.85, V-R 0.44 (Wikipedia) -> B-R 1.29. */
const MOSHUP_CHROMA = chromaFromBR(0.85 + 0.44);

const RECORDS = [
  // ------------------------------------------------------------- Phaethon
  {
    id: "phaethon",
    name: "Phaethon",
    colourMap: true,
    meshDetail: 0.75,
    designation: "3200 Phaethon (1983 TB)",
    classification: "Near-Earth asteroid · Apollo · B-type, parent of the Geminids",
    detail: "The rock that makes the Geminids | perihelion 0.14 AU",
    diameterKm: 5.0,
    diameterLabel: "6.4 × 6.1 × 4.5 km; 5.0 km equivalent",
    albedo: 0.1066,
    chroma: CLASS_CHROMA.B_TYPE,
    rotationHours: 3.604,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(1003), {
      epochJD: 2461200.5,
      aAU: 1.271464620920411,
      e: 0.8896722843692159,
      iDeg: 22.31052728047163,
      nodeDeg: 265.0988060455101,
      argPeriDeg: 322.300168483426,
      meanAnomalyDeg: 301.4858235833354,
      meanMotionDegPerDay: 0.6874603479501715,
    }),
    /* Radar + occultation + lightcurve model (Marshall et al. 2024-25, via
     * Thomas et al. 2025): 6.4 x 6.1 x 4.5 km, top-like, a suspected
     * equatorial ridge; a possible crater over 1 km below 30 degrees
     * latitude (Taylor et al. 2019). */
    shape: {
      ...ROCKY,
      lobes: ellipsoid(6.4, 6.1, 4.5),
      ridge: 0.05,
      bigCraters: [{ dir: [0.6, -0.35, 0.72], radius: 0.24, depth: 0.03, rim: 0.006 }],
      seed: 3200,
    },
    /* A faint sodium tail, seen by STEREO and SOHO near perihelion on 18
     * passages 1997-2022 (Zhang et al. 2023): gas, not dust. Only inside
     * about a quarter of an AU; a trace of coma, a yellow tail. */
    ...cometDust({ onsetAU: 0.25, fullAU: 0.14, radii: 2.4, opacity: 0.08, tail: 14, colour: 0xe8d9b0, tailColour: 0xffd27a, vents: 0,
      /* Design E: no green head (no C2 or CN has been seen), almost no dust
       * (Phaethon sheds far too little to have made the Geminids, see the
       * description), and a sodium tail -- neutral atoms, 589 nm, pushed
       * straight out by sunlight, not kinked by the solar wind as ions are,
       * so no ripple (Zhang et al. 2023). */
      emission: { gas: 0, ion: 0.85, ionColour: 0xffb347, ripple: 0, dust: 0.2 } }),
    surfaceEvidence: "Arecibo radar at 75 m resolution (December 2017) and occultations: a top-like shape, a possible large crater, a radar-dark area near a pole. No image. The surface is generated in a B-type's faintly blue grey. JAXA's DESTINY+ is planned to fly past in 2030",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.14-2.40 AU",
      diameter: "6.4 × 6.1 × 4.5 km, 5.0 km volume-equivalent (Marshall et al. model, via Thomas et al. 2025); radar 6.25 ± 0.15 km across the equator (Taylor et al. 2019)",
      rotationPeriod: "3.604 h, and shortening by about 4 ms a year (Marshall et al., DPS 2022)",
      gravity: "Not measured",
      surfaceEvidence: "Radar shape and occultations. Surface generated",
      roughness: "unknown",
      /* The sodium tail: STEREO/SOHO near perihelion, identified as sodium
       * in 2023 (description below); onset 0.25 AU as in cometDust above. */
      activity: "Not a comet, but not quite inert: inside about 0.25 AU of the Sun it gives off sodium gas, seen by Sun-watching spacecraft as a faint orange-yellow tail — sodium atoms glowing at 589 nm and pushed straight out by sunlight. No green head (no C₂ or CN) and almost no dust. The scene draws it only there; everywhere else Phaethon is a bare, scorched rock.",
      description:
        "The parent of the Geminids, the richest meteor shower of the year — which is odd, because it is an asteroid, not a comet. Its perihelion is only 0.14 AU from the Sun, far inside Mercury's orbit, and the ground reaches roughly 750-780 °C there. Spacecraft watching the Sun have seen a faint tail near perihelion on eighteen passes since 1997, and in 2023 it turned out to be sodium gas, not dust: Phaethon is losing far too little today to have made the Geminids, which probably came from a breakup a few thousand years ago. JWST found its surface baked dry. It is one of the bluest large near-Earth asteroids, and its spin is speeding up.",
    },
  },

  // ------------------------------------------------------------- Toutatis
  {
    id: "toutatis",
    name: "Toutatis",
    colourMap: true,
    meshDetail: 0.75,
    designation: "4179 Toutatis (1989 AC)",
    classification: "Near-Earth asteroid · Apollo · tumbling contact binary",
    detail: "Tumbling, photographed from 770 m | Chang'e-2, 13 December 2012",
    /* Equal-volume diameter of the Hudson et al. 2003 DEEVE, 4.26 x 2.03 x
     * 1.70 km. SBDB's 5.4 km is an old albedo-assumed figure. */
    diameterKm: 2.45,
    diameterLabel: "4.60 × 2.29 × 1.92 km (radar); 2.45 km equivalent",
    albedo: 0.405,
    chroma: CLASS_CHROMA.S_TYPE,
    /* Rotation about the long axis 5.41 d, precessing every 7.35 d (Hudson
     * & Ostro 1995): the first period drawn, with the tumble. */
    rotationHours: 129.8,
    rotationState: "tumbling",
    metalness: 0,
    orbit: orbitOf(SBDB(726), {
      epochJD: 2461200.5,
      aAU: 2.543047155641573,
      e: 0.6246302247178447,
      iDeg: 0.4480836624628189,
      nodeDeg: 125.3654799655549,
      argPeriDeg: 277.8615384113277,
      meanAnomalyDeg: 125.5161576467994,
      meanMotionDegPerDay: 0.2430370325415499,
    }),
    /* A large 'body' lobe and a 'head' about half its size, a sharp neck
     * (Huang et al. 2013), inside the 4.60 x 2.29 x 1.92 km radar box; the
     * 805 m basin at the big end. */
    shape: {
      ...ROCKY,
      /* Reported as looking like a dhol drum: the head was a separate ball
       * pinched onto the body. Chang'e-2's images show one elongated,
       * continuous body whose smaller end swells out of the larger, so the
       * lobes now overlap and merge through a broad fillet. */
      lobes: [
        { c: [-0.7, 0, 0], r: [1.65, 0.96, 1.12] },
        { c: [1.32, 0.06, 0.04], r: [1.0, 0.84, 0.9] },
      ],
      neck: 9,
      blend: "smooth",
      fillet: 0.75,
      /* "Rocky, rugged and cratered" (Prompts.md round 3): relief 0.04 ->
       * 0.055, craters 0.025 -> 0.032 deep. Chang'e-2 counted 50+ craters
       * (Huang et al. 2013), so the count stays. */
      relief: 0.055,
      craterDepth: 0.032,
      craterCount: 50,
      boulders: 40,
      bigCraters: [{ dir: [-0.97, 0.1, 0.2], radius: 0.4, depth: 0.05, rim: 0.008 }],
      seed: 4179,
    },
    surfaceEvidence: "Chang'e-2 flew past at 770 m on 13 December 2012, better than 3 m/pixel: a basin about 805 m across at the big end, over 50 craters, over 200 boulders (Huang et al. 2013; Jiang et al. 2015). The map is generated to match, not taken from the images",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.95-4.13 AU, almost in the ecliptic",
      diameter: "Radar model 4.60 × 2.29 × 1.92 km (Hudson et al. 2003); Chang'e-2 4.75 × 1.95 km",
      rotationPeriod: "Tumbling: 5.41 days about its long axis, which precesses every 7.35 days (Hudson & Ostro 1995)",
      gravity: "Not measured; porosity estimated at 25-37% (Huang et al. 2013)",
      surfaceEvidence: "Chang'e-2 flyby. Map generated to match",
      roughness: "An 805 m basin, 50+ craters 36-532 m, 200+ boulders 10-61 m",
      description:
        "Toutatis does not spin, it tumbles: it turns about its long axis every 5.4 days while that axis wheels round every 7.4, so it never shows the same face twice in the same way. It is a ginger-root of two lobes — a big body and a head half its size — joined at a sharp neck, where two of its largest boulders sit. China's Chang'e-2, on its way out after mapping the Moon, flew within 770 m of it on 13 December 2012: China's first asteroid encounter. Its orbit lies almost exactly in the plane of Earth's, and in 2004 it passed four lunar distances from us.",
    },
  },

  // ---------------------------------------------------------- Kamoʻoalewa
  {
    id: "kamooalewa",
    name: "Kamoʻoalewa",
    colourMap: true,
    /* Full mesh detail (96 x 64) so the round-3 relief has vertices to sit on. */
    meshDetail: 1,
    coOrbital: EARTH_1_1,
    designation: "469219 Kamoʻoalewa (2016 HO3)",
    classification: "Near-Earth asteroid · Earth's quasi-satellite · Tianwen-2's target",
    detail: "Earth's companion, with a spacecraft beside it now | Tianwen-2, July 2026",
    /* JWST: 18 +/- 2 m (Sharkey et al. 2026); Tianwen-2's first image ~20 m. */
    diameterKm: 0.018,
    diameterLabel: "About 18-20 m (JWST 2026; Tianwen-2)",
    albedo: 0.59,
    /* Neutral grey 1-2.5 um spectrum (JWST 2026); the 'lunar' red of 2021
     * is disputed. */
    chroma: CLASS_CHROMA.NEUTRAL,
    rotationHours: 0.465,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(37), {
      epochJD: 2461200.5,
      aAU: 1.000810461656002,
      e: 0.1022388434937281,
      iDeg: 7.802614368816799,
      nodeDeg: 65.59324199512295,
      argPeriDeg: 304.3632127863176,
      meanAnomalyDeg: 243.3871442328605,
      meanMotionDegPerDay: 0.9844106854820979,
    }),
    /* Projected 15-21 m, axis ratio ~1.4 (Sharkey et al. 2026); the third
     * axis unpublished, drawn at 12 m. Elongated, not bilobed (Bonamico,
     * Hanuš & Delbo 2026). */
    /* "Heavy terrain heights" (Prompts.md round 3): relief 0.04 -> 0.1 and
     * twelve boulders at 0.1 rad -- big enough for the mesh to carry (one
     * quad is 0.065 rad at full detail; see resolvableBoulderRadians). It
     * turns in 28 minutes (0.465 h, above), far faster than the ~2.2 h a
     * loose rubble pile survives (Pravec & Harris 2000), so the relief is
     * blocky ridges on coherent rock, not a boulder field. Chosen;
     * Tianwen-2's close imaging is still to come. */
    shape: { ...ROCKY, lobes: ellipsoid(0.021, 0.015, 0.012), relief: 0.1, grain: 0.03,
      craterCount: 4, boulders: 12, boulderSize: 0.1, seed: 469219 },
    surfaceEvidence: "Tianwen-2's first image from about 20 km (July 2026) shows an elongated grey body; no detailed surface has been published yet. The surface is generated in a neutral grey with a faint warmth — reddened in Sharkey et al.'s 2021 spectrum, greyer in the 2026 JWST one",
    info: {
      population: "Near-Earth asteroids · Earth quasi-satellite, 0.90-1.10 AU",
      diameter: "18 ± 2 m (Sharkey et al. 2026, JWST); about 20 m in Tianwen-2's first image",
      rotationPeriod: "0.465 h — about 28 minutes (Bonamico et al. 2026)",
      gravity: "Held together by cohesion, not gravity, at that spin",
      surfaceEvidence: "Tianwen-2 first image, July 2026. Surface generated",
      roughness: "unknown",
      speedNote: " — the same period as Earth",
      description:
        "Earth's most stable quasi-satellite: it goes round the Sun, not round Earth, but on the same one-year period and a slightly tilted, slightly more stretched ellipse — so, seen from Earth, it loops around us once a year and never strays far, between about 14.5 and 38.6 million km (NASA, 2016). It has done so for about a century and will for centuries more. That is the loop you see here: it is drawn in Earth's frame, so it stays near the Earth on screen. It is tiny — about 18 m, half the smallest earlier estimate — and spins every 28 minutes. It was proposed as a chip off the Moon from the Giordano Bruno crater; the 2026 JWST spectrum now argues against that. China's Tianwen-2 reached it in July 2026 to collect a sample, due back on Earth in November 2027.",
    },
  },

  // ------------------------------------------------------------- Cruithne
  {
    id: "cruithne",
    name: "Cruithne",
    colourMap: true,
    meshDetail: 0.75,
    coOrbital: EARTH_1_1,
    designation: "3753 Cruithne (1986 TO)",
    classification: "Near-Earth asteroid · Aten · Earth's horseshoe companion",
    detail: "Not a moon — a horseshoe | Duncan Waldron, 10 October 1986",
    diameterKm: 2.07,
    diameterLabel: "2.07 ± 0.11 km (NEOWISE)",
    albedo: 0.365,
    chroma: CLASS_CHROMA.SQ_TYPE,
    rotationHours: 27.3099,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(312), {
      epochJD: 2461200.5,
      aAU: 0.9977971735251305,
      e: 0.5149036013028605,
      iDeg: 19.80238133612434,
      nodeDeg: 126.1886918424181,
      argPeriDeg: 43.8830157643464,
      meanAnomalyDeg: 182.1324439338747,
      meanMotionDegPerDay: 0.9888733430885928,
    }),
    /* No shape model exists: a generic irregular rock, chosen. */
    /* "Must have large craters" (Prompts.md round 3): the range to 0.24
     * rad and three basins. Chosen -- there is no shape model -- but a
     * 5 km rock that has crossed the inner Solar System for a long time
     * carries them, as Eros, Gaspra and Ida all do. */
    shape: { ...ROCKY, lobes: ellipsoid(2.4, 2.0, 1.8), craterMax: 0.24, craterDepth: 0.03,
      bigCraters: [
        /* Depth ~0.2 of the radius in radians, a fresh-ish bowl (see
         * CRATER_REFERENCE_RADIANS): the first pass at 0.06 read as
         * shading, not as craters. */
        { dir: [0.8, 0.3, 0.52], radius: 0.45, depth: 0.09, rim: 0.016 },
        { dir: [-0.5, 0.6, -0.62], radius: 0.36, depth: 0.075, rim: 0.013 },
        { dir: [-0.2, -0.9, 0.39], radius: 0.3, depth: 0.065, rim: 0.011 },
      ],
      seed: 3753 },
    surfaceEvidence: "Never resolved by radar or spacecraft. Size and albedo from NEOWISE. Shape and surface are generic, in the colour of a fresh Q-type",
    info: {
      population: "Near-Earth asteroids · Aten group, 1:1 with Earth, 0.48-1.51 AU",
      diameter: "2.071 ± 0.106 km, albedo 0.365 (NEOWISE, JPL SBDB) — the often-quoted 5 km is an older estimate",
      rotationPeriod: "27.31 h (Erikson et al. 2000)",
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Shape and surface generic",
      roughness: "unknown",
      speedNote: " — the same period as Earth, within a day",
      description:
        "Often called Earth's second moon, and it is not one: it orbits the Sun. What it shares with Earth is the period — 364 days against 365 — on a very different ellipse, reaching from near Mercury's orbit to beyond Mars's and tilted almost 20°. Seen from a frame turning with Earth its path is a bean-shaped loop, and the bean itself creeps along Earth's orbit and back in a horseshoe that takes about 770 years (Wiegert, Innanen & Mikkola 1997). The bean is what the scene can show — it is drawn in Earth's frame; the horseshoe is far too slow. It does not come closer than about 36 lunar distances this century.",
    },
  },

  // --------------------------------------------------------------- Moshup
  {
    id: "moshup",
    name: "Moshup",
    colourMap: true,
    meshDetail: 0.75,
    designation: "66391 Moshup (1999 KW4)",
    classification: "Near-Earth asteroid · Aten · spinning top with a moon",
    detail: "A spinning top and its moon | Goldstone and Arecibo radar, May 2001",
    diameterKm: 1.317,
    diameterLabel: "1.532 × 1.495 × 1.347 km; 1.317 km equivalent",
    /* LCDB 'derived' albedo, not a thermal measurement. */
    albedo: 0.26,
    chroma: MOSHUP_CHROMA,
    rotationHours: 2.7645,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(368), {
      epochJD: 2461200.5,
      aAU: 0.6423893266185235,
      e: 0.6883840168509753,
      iDeg: 38.87861960632899,
      nodeDeg: 244.8955891771853,
      argPeriDeg: 192.6539401611728,
      meanAnomalyDeg: 5.456735051786742,
      meanMotionDegPerDay: 1.914285012731136,
    }),
    /* Ostro et al. 2006 radar model: an oblate top with a sharp equatorial
     * ridge. */
    shape: { ...ROCKY, lobes: ellipsoid(1.532, 1.495, 1.347), ridge: 0.085, boulders: 16, seed: 66391 },
    moons: [
      {
        name: "Squannit",
        colourMap: true,
        designation: "(66391) Moshup I Squannit",
        classification: "Natural satellite · always shows Moshup one face",
        diameterKm: 0.451,
        diameterLabel: "0.571 × 0.463 × 0.349 km; 451 ± 27 m equivalent",
        albedo: 0.26,
        chroma: MOSHUP_CHROMA,
        /* a = 2.548 +/- 0.015 km, P = 17.4223 h (Ostro et al. 2006 via
         * JPL SBDB); about in Moshup's equator. */
        separationKm: 2.548,
        periodHours: 17.4223,
        inclinationDeg: 0,
        shape: { ...ROCKY, lobes: ellipsoid(0.571, 0.463, 0.349), relief: 0.025, craterCount: 8, boulders: 6, seed: 663911 },
        info: {
          diameter: "0.571 × 0.463 × 0.349 km (Ostro et al. 2006)",
          rotationPeriod: "Synchronous with its 17.42 h orbit, with librations (Scheeres et al. 2006)",
          orbitalSpeed: `${((2 * Math.PI * 2.548) / (17.4223 * 3600) * 1000).toFixed(2)} m/s around Moshup — once every 17.4 hours, 2.55 km out`,
          surfaceEvidence: "Radar delay-Doppler images, May 2001. Surface generated",
          description:
            "Found by radar in May 2001, circling Moshup every 17.4 hours with its long axis always pointing at it. Its slopes are gentle — on average 9°, against Moshup's 28° — and it is denser than its parent, about 2.8 g/cm³. In Wampanoag legend Squannit is Moshup's wife.",
        },
      },
    ],
    surfaceEvidence: "Goldstone and Arecibo radar images, 21-29 May 2001: the shape model is real, the surface is generated",
    info: {
      population: "Near-Earth asteroids · Aten group, 0.20-1.08 AU",
      diameter: "1.532 × 1.495 × 1.347 km, 1.317 km equivalent (Ostro et al. 2006)",
      rotationPeriod: "2.7645 ± 0.0003 h (Ostro et al. 2006)",
      gravity: "Density 1.97 ± 0.24 g/cm³, about 50% empty space (Ostro et al. 2006)",
      surfaceEvidence: "Radar shape model. Surface generated",
      roughness: "Slopes average 28°, up to 70°",
      description:
        "The best-studied binary near-Earth asteroid. Radar showed a spinning top with a sharp ridge round its equator, turning every 2.76 hours — so fast that loose material at the equator is almost weightless, which is how the ridge formed and probably how the moon did: material shed from the equator gathered in orbit. Its perihelion is 0.20 AU, inside Mercury's orbit, and it goes round the Sun in 188 days. The names are from Wampanoag legend: Moshup a giant, Squannit his wife.",
    },
  },

  // ----------------------------------------------------------- Geographos
  {
    id: "geographos",
    name: "Geographos",
    colourMap: true,
    meshDetail: 0.75,
    designation: "1620 Geographos (1951 RA)",
    classification: "Near-Earth asteroid · Apollo · extremely elongated",
    detail: "Five kilometres long, two wide | Goldstone radar, 1994",
    diameterKm: 2.56,
    diameterLabel: "5.0 × 2.0 × 2.1 km; 2.56 km equivalent",
    albedo: 0.29,
    /* B-V 0.862 (JPL SBDB) -> B-R 1.41: slightly reddish grey. */
    chroma: chromaFromBR(brFromBV(0.862)),
    rotationHours: 5.223327,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SBDB(938), {
      epochJD: 2461200.5,
      aAU: 1.245803622716773,
      e: 0.3355177775701855,
      iDeg: 13.33675506013918,
      nodeDeg: 337.1348663015337,
      argPeriDeg: 277.0290683632651,
      meanAnomalyDeg: 354.679502705811,
      meanMotionDegPerDay: 0.708809761257947,
    }),
    /* Hudson & Ostro 1999: maximum dimensions 5.0, 2.0, 2.1 km, tapered
     * ends and a central bend -- two elongated lobes slightly offset. */
    shape: {
      ...ROCKY,
      lobes: [
        { c: [-1.25, 0.05, 0.08], r: [1.35, 0.95, 1.02] },
        { c: [1.25, -0.05, -0.08], r: [1.3, 0.92, 0.98] },
      ],
      neck: 5,
      /* Terrain (Prompts.md round 3): "a rugged, rubble-pile texture ... fine
       * regolith dust, fractured bedrock and large boulders". Relief 0.04 ->
       * 0.055 and eighteen boulders at 0.09 rad, large enough for the mesh
       * (see resolvableBoulderRadians). Radar resolved 75-151 m, which shows
       * none of this; chosen to the brief. */
      relief: 0.055,
      boulders: 18,
      boulderSize: 0.09,
      seed: 1620,
    },
    surfaceEvidence: "Over 400 Goldstone radar images, 28 August - 2 September 1994, at 75-151 m: the shape, a central bend and several probable craters. The surface is generated",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.83-1.66 AU",
      diameter: "5.0 × 2.0 × 2.1 km (Hudson & Ostro 1999)",
      rotationPeriod: "5.2233270 h, retrograde, and speeding up by about 2.7 ms a year from sunlight (Ďurech et al. 2008)",
      gravity: "Not measured",
      surfaceEvidence: "Radar shape. Surface generated",
      roughness: "Homogeneous, modest roughness at centimetre-to-metre scale (Ostro et al. 1996)",
      description:
        "In 1995 radar showed Geographos to be the most elongated body in the Solar System yet imaged: about 5 km long and 2 wide, with tapered ends and a bend in the middle. Sunlight is spinning it up — the YORP effect, heat re-radiated unevenly from an uneven body — by about 2.7 thousandths of a second a year, one of the first times that was ever measured. The Clementine spacecraft was meant to fly past in 1994 but failed on the way. It was discovered at Palomar on 14 September 1951.",
    },
  },
];

/* Each card's speed now, from its own elements (catalogueHelpers.js). */
export const NEAR_EARTH_ODDITIES = Object.freeze(RECORDS.map(withSpeedNow));

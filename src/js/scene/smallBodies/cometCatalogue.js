/**
 * Nine comets: Rank 7 of `docs/bodies-to-draw-next.md`.
 *
 * Halley and 67P were built in Rank 1. These are the rest of the row that can
 * be drawn as bodies -- Shoemaker-Levy 9 is left out on purpose; the doc
 * itself says it is better as an event than a body, and it no longer exists.
 *
 *   visited, nucleus resolved   9P/Tempel 1, 103P/Hartley 2, 81P/Wild 2,
 *                               19P/Borrelly
 *   never resolved              2P/Encke, 12P/Pons-Brooks,
 *                               C/2014 UN271, C/1995 O1 Hale-Bopp,
 *                               C/2020 F3 NEOWISE
 *
 * ## The orbits
 *
 * The five short-period comets use **JPL Horizons osculating elements at
 * 27 September 2026** (JD 2461310.5), not the Small-Body Database's own
 * solution. The SBDB sets are fitted at their last apparition -- Tempel 1's
 * at 2016 -- and a Jupiter-family comet's orbit is moved by Jupiter between
 * apparitions: propagating Tempel 1's 2016 set to now puts perihelion at
 * 1.54 AU when it is 1.77. The four long-period comets use their SBDB sets;
 * propagated to 27 September 2026 they land within 0.01 AU of the Horizons
 * distances (checked: 12P 8.822 against 8.824, UN271 13.585 / 13.584,
 * Hale-Bopp 51.143 / 51.144, NEOWISE 18.646 / 18.651).
 *
 * ## Activity
 *
 * Every one carries a coma and a dust tail (centaurComa.js, the Centaurs'
 * shader) that is **off far from the Sun and grows on the way in**: the
 * `activity` block gives the distance at which it appears and the distance
 * at which it is fully developed (see `cometActivity` in smallBodies.js).
 * Most use the ~3 AU water-ice limit. C/2014 UN271 is CO-driven and was
 * already active at 23.8 AU (2018); Hale-Bopp's activity stopped at about
 * 28 AU (Szabó et al. 2012), which is where it is set to begin.
 *
 * ## Surfaces
 *
 * Every map is generated (tools/binary-surface-lab), in the colour the
 * measurements give, on terrain chosen to match what was seen -- Tempel 1's
 * pits and smooth flows, Wild 2's flat-floored depressions, Borrelly's
 * mesas and dark spots. The five never resolved borrow a generic comet
 * surface, and their cards say so.
 *
 * Sources for every number are in the research compiled 27 September 2026
 * (JPL SBDB and Horizons, and the papers named on each card).
 */
import {
  brFromBV,
  chromaFromBR,
  CLASS_CHROMA,
  cometDust,
  ellipsoid,
  orbitOf,
  speedLine,
} from "./catalogueHelpers.js";

const HORIZONS_2026 = "JPL Horizons osculating elements, epoch JD 2461310.5 (27 September 2026)";

/* A generic nucleus relief for the ones never resolved: 67P and Tempel 1
 * are the reference, dark and pitted with smooth patches. */
const COMET_RELIEF = Object.freeze({
  neck: 4,
  relief: 0.05,
  grain: 0.02,
  craterCount: 18,
  craterMin: 0.05,
  craterMax: 0.16,
  craterDepth: 0.025,
  boulders: 6,
  boulderSize: 0.04,
});

export const COMETS = Object.freeze([
  // ------------------------------------------------------------- Tempel 1
  {
    id: "tempel-1",
    name: "9P/Tempel 1",
    colourMap: true,
    meshDetail: 0.75,
    designation: "9P/Tempel 1",
    classification: "Jupiter-family comet nucleus · struck by Deep Impact",
    detail: "The comet we hit on purpose | Deep Impact 2005, Stardust-NExT 2011",
    diameterKm: 5.66,
    diameterLabel: "7.6 × 4.9 km; 5.66 km equivalent",
    albedo: 0.04,
    /* B-V 0.84, V-R 0.50 (Li et al. 2007) -> B-R 1.34. */
    chroma: chromaFromBR(0.84 + 0.50),
    rotationHours: 40.7,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf(HORIZONS_2026, {
      epochJD: 2461310.5,
      aAU: 3.305565558977421,
      e: 0.4649036712252428,
      iDeg: 10.46968190531812,
      nodeDeg: 66.7704246939537,
      argPeriDeg: 184.6078367088727,
      meanAnomalyDeg: 277.5332428136012,
      meanMotionDegPerDay: 0.16399681420315707,
    }),
    /* 7.6 x 4.9 km (A'Hearn et al. 2005); the third axis 4.87 km makes the
     * volume match the 2.83 km mean radius of Thomas et al. 2013. */
    shape: {
      ...COMET_RELIEF,
      lobes: [
        { c: [-0.9, 0, 0], r: [2.9, 2.35, 2.45] },
        { c: [1.1, 0.15, 0], r: [2.7, 2.2, 2.3] },
      ],
      neck: 3,
      bigCraters: [
        /* The pitted rough terrain: pits up to ~1 km (Thomas et al. 2013). */
        { dir: [0.4, 0.3, 0.87], radius: 0.18, depth: 0.03, rim: 0.004 },
        { dir: [-0.6, -0.2, 0.77], radius: 0.15, depth: 0.028, rim: 0.004 },
      ],
      seed: 9001,
    },
    ...cometDust({ fullAU: 1.8 }),
    surfaceEvidence: "Deep Impact (4 July 2005) and Stardust-NExT (15 February 2011) imaged about 70% of the nucleus. The map here is generated to match what they saw — pitted rough ground, smooth flow deposits with retreating scarps — in the measured colour; it is not their mosaic",
    info: {
      population: "Jupiter-family comets · 1.77-4.84 AU",
      diameter: "7.6 × 4.9 km (A'Hearn et al. 2005); mean radius 2.83 ± 0.1 km (Thomas et al. 2013)",
      rotationPeriod: "40.7 h in 2005 (A'Hearn et al. 2005), and getting shorter: about 12 minutes lost over the 2000 perihelion (Belton et al. 2011)",
      orbitalSpeed: speedLine(3.305565558977421, 0.4649036712252428, 3.776, { periodYears: 2195.16 / 365.25 }),
      gravity: "Mass 4.5 × 10¹³ kg, surface gravity 0.34 mm/s², density about 0.4 g/cm³ — from the Deep Impact ejecta plume (Richardson et al. 2007)",
      surfaceEvidence: "Two spacecraft, two apparitions, about 70% of the surface imaged. Map generated to match; not the mosaic",
      roughness: "Half the surface pitted, a third smooth flow deposit; local relief up to 830 m (Veverka et al. 2013)",
      description:
        "On 4 July 2005 NASA's Deep Impact fired a 370 kg copper impactor into Tempel 1 at 10.2 km/s — about 19 gigajoules, the first time anyone had hit a comet. Six years later Stardust-NExT came back and found the scar: a subdued depression about 50 m across, far smaller than predicted, because the surface is so loose and porous. The nucleus is less than half as dense as ice. The ground is two kinds: pitted, rough terrain with round depressions up to a kilometre wide, and smooth deposits tens of metres thick lying in the lows, whose edges retreated by up to 50 m between the two visits. It is at 3.8 AU and heading in: perihelion is 11 February 2028. Its coma here switches on inside about 3 AU.",
    },
  },

  // ----------------------------------------------------------- Hartley 2
  {
    id: "hartley-2",
    name: "103P/Hartley 2",
    colourMap: true,
    meshDetail: 0.75,
    designation: "103P/Hartley 2",
    classification: "Jupiter-family comet nucleus · bilobed, hyperactive",
    detail: "A tiny peanut that throws out ice chunks | EPOXI flyby, 4 November 2010",
    diameterKm: 1.16,
    diameterLabel: "2.33 km long; 1.16 km equivalent",
    albedo: 0.045,
    /* B-V 0.75, V-R 0.43 (Li et al. 2013) -> B-R 1.18. */
    chroma: chromaFromBR(0.75 + 0.43),
    rotationHours: 18.34,
    /* Excited: the ~18 h cycle is the long axis precessing (A'Hearn 2011). */
    rotationState: "tumbling",
    metalness: 0,
    isComet: true,
    orbit: orbitOf(HORIZONS_2026, {
      epochJD: 2461310.5,
      aAU: 3.476626082427646,
      e: 0.693057992531434,
      iDeg: 13.5986439932845,
      nodeDeg: 219.7645968647785,
      argPeriDeg: 181.3334515636128,
      meanAnomalyDeg: 164.3547683284755,
      meanMotionDegPerDay: 0.1520432337476,
    }),
    /* 2.33 km long, 0.69 km at the waist, nearly axially symmetric, the
     * southern lobe the larger (Thomas et al. 2013). Two lobes and a soft
     * fillet that leaves the waist about 0.7 km thick. */
    shape: {
      lobes: [
        { c: [-0.52, 0, 0], r: [0.62, 0.52, 0.53] },
        { c: [0.6, 0, 0], r: [0.52, 0.42, 0.43] },
      ],
      neck: 5,
      /* One continuous surface with a smooth waist (smallBodyShapes.js). */
      blend: "smooth",
      fillet: 0.22,
      relief: 0.045,
      grain: 0.02,
      craterCount: 6,
      craterMin: 0.05,
      craterMax: 0.12,
      craterDepth: 0.015,
      boulders: 14,
      boulderSize: 0.05,
      collar: { centreKm: 0.05, widthKm: 0.35, gain: 1.18 },
      seed: 10302,
    },
    ...cometDust({ fullAU: 1.1, radii: 8, opacity: 0.2 }),
    surfaceEvidence: "EPOXI's cameras from 694 km, 4 November 2010: rough lobes with mounds and blocks up to ~50 m high, a smooth waist. The map is generated to match that description, not taken from the images",
    info: {
      population: "Jupiter-family comets · 1.07-5.89 AU",
      diameter: "2.33 km long, 0.69-2.33 km across; mean radius 0.58 km (Thomas et al. 2013)",
      rotationPeriod: "About 18.3 h at the encounter and lengthening — it tumbles, and the cycle is the long axis precessing (A'Hearn et al. 2011; Knight & Schleicher 2011)",
      orbitalSpeed: speedLine(3.476626082427646, 0.693057992531434, 5.855, { periodYears: 2367.75 / 365.25 }),
      gravity: "Density modelled at 0.2-0.4 g/cm³ (Thomas et al. 2013); mass not measured",
      surfaceEvidence: "One flyby, EPOXI 2010. Map generated to match the description",
      roughness: "Rough, mounded lobes; a smooth waist",
      description:
        "The smallest comet visited when EPOXI — the Deep Impact spacecraft, sent on — passed 694 km from it in November 2010: a 2.3 km peanut with a smooth waist. It was also the most active for its size. Carbon dioxide jetting from the small lobe drags out chunks of water ice 10-20 cm across, and most of the comet's water comes from those chunks sublimating in the coma rather than from the surface. It does not spin cleanly: its day was lengthening through the flyby, by about 0.1% each cycle. It is out near aphelion now, at 5.9 AU, and not due back to perihelion until April 2030.",
    },
  },

  // --------------------------------------------------------------- Wild 2
  {
    id: "wild-2",
    name: "81P/Wild 2",
    colourMap: true,
    meshDetail: 0.75,
    designation: "81P/Wild 2",
    classification: "Jupiter-family comet nucleus · sampled by Stardust",
    detail: "The comet whose dust came back to Earth | Stardust, 2 January 2004",
    diameterKm: 3.96,
    diameterLabel: "5.5 × 4.0 × 3.3 km; 3.96 km equivalent",
    albedo: 0.059,
    /* Stardust imaged through one filter; no nucleus colour exists (Li et
     * al. 2009). The comet class colour, as Halley's. */
    chroma: CLASS_CHROMA.COMET,
    rotationHours: 13.5,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf(HORIZONS_2026, {
      epochJD: 2461310.5,
      aAU: 3.450125010296067,
      e: 0.5381359843786727,
      iDeg: 3.238901822708521,
      nodeDeg: 136.1107211120814,
      argPeriDeg: 41.55670626613453,
      meanAnomalyDeg: 212.2761421472371,
      meanMotionDegPerDay: 0.1537984033235596,
    }),
    shape: {
      lobes: ellipsoid(5.5, 4.0, 3.3),
      relief: 0.04,
      grain: 0.018,
      craterCount: 10,
      craterMin: 0.05,
      craterMax: 0.12,
      craterDepth: 0.02,
      bigCraters: [
        /* Right Foot, up to 1.62 km across and ~260 m deep; Rahe, 1.3 km;
         * Left Foot, 0.8 km near the pole (Lim & Ishiguro 2024). Depth as a
         * fraction of the 1.98 km mean radius, eased. */
        { dir: [0.55, -0.15, 0.82], radius: 0.36, depth: 0.09, rim: 0.004 },
        { dir: [-0.62, 0.1, 0.78], radius: 0.3, depth: 0.07, rim: 0.004 },
        { dir: [0.1, 0.95, 0.3], radius: 0.2, depth: 0.05, rim: 0.003 },
      ],
      seed: 8102,
    },
    ...cometDust({ fullAU: 1.6 }),
    surfaceEvidence: "Stardust's 72 close-up frames from about 236 km, best 14 m/pixel, one filter. Flat-floored, steep-walled depressions and ~100 m pinnacles are measured; the map is generated to match them, and the colour is the comet class average",
    info: {
      population: "Jupiter-family comets · 1.59-5.31 AU",
      diameter: "5.5 × 4.0 × 3.3 km (Duxbury et al. 2004); effective radius 1.98 km",
      rotationPeriod: "13.5 ± 0.1 h, ground-based, poorly constrained",
      orbitalSpeed: speedLine(3.450125010296067, 0.5381359843786727, 5.182, { periodYears: 2340.73 / 365.25 }),
      gravity: "Not measured by Stardust",
      surfaceEvidence: "Stardust flyby, one filter. Depressions and pinnacles measured; map generated; colour is the comet average",
      roughness: "Depressions 0.25-2.5 km across and 50-500 m deep, steep walls, overhangs (Kirk et al. 2005)",
      description:
        "Stardust flew 236 km from Wild 2 on 2 January 2004 and caught its dust in aerogel; the capsule landed in Utah on 15 January 2006 — the first material ever brought back from a comet. The surprise inside was crystalline silicate that can only have formed at high temperature, close to the young Sun, and then been carried out to where comets froze. The surface is stiff enough to hold cliffs: flat-floored pits over 150 m deep and pinnacles 100 m tall. It has only been this close to the Sun since 1974, when a pass about a million kilometres from Jupiter cut its orbit from ~43 years to ~6.",
    },
  },

  // ------------------------------------------------------------- Borrelly
  {
    id: "borrelly",
    name: "19P/Borrelly",
    colourMap: true,
    meshDetail: 0.75,
    designation: "19P/Borrelly",
    classification: "Jupiter-family comet nucleus · bowling-pin shaped",
    detail: "One of the darkest surfaces known | Deep Space 1, 22 September 2001",
    diameterKm: 5.0,
    diameterLabel: "About 8 km long; 5.0 km equivalent",
    albedo: 0.029,
    /* Red in the near-infrared (Soderblom et al. 2002); no optical index.
     * The comet class colour. */
    chroma: CLASS_CHROMA.COMET,
    rotationHours: 26,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf(HORIZONS_2026, {
      epochJD: 2461310.5,
      aAU: 3.608981526332391,
      e: 0.6374405675051219,
      iDeg: 29.30188233632294,
      nodeDeg: 74.21390539332468,
      argPeriDeg: 352.0188491436046,
      meanAnomalyDeg: 244.0356083182986,
      meanMotionDegPerDay: 0.1437563658806322,
    }),
    /* About 8 km long (Soderblom et al. 2002), a/b 2.53 (Kokotanekova et
     * al. 2017): two unequal lobes, possibly two fragments in contact (Kirk
     * et al. 2004). */
    shape: {
      lobes: [
        { c: [-1.85, 0, 0], r: [2.3, 1.45, 1.65] },
        { c: [1.8, 0.1, 0], r: [2.15, 1.3, 1.5] },
      ],
      neck: 3,
      blend: "smooth",
      fillet: 1.0,
      /* Relief raised 0.04 -> 0.06 for the mesas and scarps ("needs a little
       * terrain", Prompts.md round 3). */
      relief: 0.06,
      grain: 0.02,
      /* No *impact* craters down to ~200 m (Britt et al. 2004) -- but Deep
       * Space 1 did see pits and shallow depressions on the mottled ends,
       * and the owner asked for "a few craters". Eight shallow bowls stand
       * for those depressions: the count is chosen, the depth (0.015) kept
       * under the 0.025 of a fresh crater so they read as sinks, not
       * impacts. */
      craterCount: 8,
      craterMin: 0.06,
      craterMax: 0.15,
      craterDepth: 0.015,
      boulders: 0,
      seed: 1901,
    },
    ...cometDust({ fullAU: 1.35 }),
    surfaceEvidence: "Deep Space 1 from about 2,200 km, best 45 m/pixel: mesas, smooth plains near the middle, darker mottled ends, dark spots two to three times darker than their surroundings. The map is generated to match; the colour is the comet class average",
    info: {
      population: "Jupiter-family comets · 1.31-5.91 AU",
      diameter: "About 8 km long (Soderblom et al. 2002); effective radius 2.5 km",
      rotationPeriod: "26 h (Soderblom et al. 2004), pole along the main jet",
      orbitalSpeed: speedLine(3.608981526332391, 0.6374405675051219, 5.362, { periodYears: 2504.24 / 365.25 }),
      gravity: "Density 0.18-0.3 g/cm³, modelled from its orbit's non-gravitational changes (Davidsson & Gutiérrez 2004)",
      surfaceEvidence: "Deep Space 1 flyby. Terrain measured; map generated; colour the comet average",
      roughness: "Mesas, ridges, troughs and deep fractures; no craters seen",
      description:
        "Geometric albedo 0.029: Borrelly reflects under 3 per cent of the light that falls on it, and its darkest spots about 1 per cent, which puts it among the darkest surfaces in the Solar System. Deep Space 1 — NASA's first ion-propelled probe — flew past on 22 September 2001 and took what were then the best pictures of a comet ever made. The nucleus is an 8 km bowling pin with smooth, brighter plains in the middle and rougher, darker ends; the surface was hot and dry, up to 345 K, with no water ice to be seen. Its main jet comes out of a basin near the middle and splits in three. Alphonse Borrelly found it from Marseille on 28 December 1904.",
    },
  },

  // --------------------------------------------------------------- Encke
  {
    id: "encke",
    name: "2P/Encke",
    colourMap: true,
    meshDetail: 0.75,
    designation: "2P/Encke",
    classification: "Encke-type comet nucleus · the shortest period",
    detail: "Round the Sun every 3.3 years | never visited",
    diameterKm: 4.8,
    diameterLabel: "About 4.8 km (radius 2.4 ± 0.3 km)",
    albedo: 0.046,
    /* B-V 0.73, V-R 0.39 (Lowry & Weissman 2007) -> B-R 1.12. */
    chroma: chromaFromBR(0.73 + 0.39),
    rotationHours: 11.083,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf(HORIZONS_2026, {
      epochJD: 2461310.5,
      aAU: 2.21773122102491,
      e: 0.8473163198131505,
      iDeg: 11.3477569448663,
      nodeDeg: 334.0189198334071,
      argPeriDeg: 187.2876235172061,
      meanAnomalyDeg: 319.3454236770556,
      meanMotionDegPerDay: 0.2984287832184963,
    }),
    /* Elongated, a/b >= 1.44 (Lowry & Weissman 2007): drawn at 1.6 with the
     * volume of a 4.8 km sphere. Shape otherwise unknown. */
    shape: { ...COMET_RELIEF, lobes: ellipsoid(6.56, 4.1, 4.1), seed: 2002 },
    ...cometDust({ fullAU: 0.4 }),
    surfaceEvidence: "Never imaged: CONTOUR, which was to have visited in 2003, was lost in 2002. Size, elongation and spin come from radar, thermal infrared and lightcurves. The surface is a generic comet nucleus",
    info: {
      population: "Encke-type comets · 0.34-4.10 AU, inside Jupiter's orbit",
      diameter: "Radius 2.4 ± 0.3 km (Fernández et al. 2000), 2.43 ± 0.06 km (Boehnhardt et al. 2008)",
      rotationPeriod: "11.083 ± 0.003 h (Lowry & Weissman 2007), possibly an excited spin",
      orbitalSpeed: speedLine(2.21773122102491, 0.8473163198131505, 2.191, { periodYears: 1206.32 / 365.25 }),
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "The shortest period of any reasonably bright comet: once round the Sun every 3.3 years, dipping to 0.34 AU — inside Mercury's orbit — at perihelion. Pierre Méchain first recorded it in 1786; Johann Encke worked out in 1819 that sightings in 1786, 1795, 1805 and 1818 were one object, making it only the second periodic comet known after Halley's. It is thought to be the parent of the Taurid meteors. Right now it is at 2.2 AU and closing on the Sun at 17 km/s, towards perihelion on 10 February 2027 — which is why its coma is starting to show here.",
    },
  },

  // --------------------------------------------------------- Pons-Brooks
  {
    id: "pons-brooks",
    name: "12P/Pons-Brooks",
    colourMap: true,
    meshDetail: 0.75,
    designation: "12P/Pons-Brooks",
    classification: "Halley-type comet nucleus · the 'devil comet'",
    detail: "Outbursts that gave its coma horns | perihelion 21 April 2024",
    /* Not measured. Jewitt & Luu 2025 find its outbursts need the sunlit
     * hemisphere of a nucleus of radius ~5.6 km; drawn at that. */
    diameterKm: 11.2,
    diameterLabel: "Not measured; ≈ 11 km drawn (radius ~5.6 km, Jewitt & Luu 2025)",
    albedo: 0.04,
    /* Only coma colours exist (A&A 2026). The comet class colour. */
    chroma: CLASS_CHROMA.COMET,
    rotationHours: 57,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf("JPL SBDB orbit solution K242/84, epoch JD 2460211.5", {
      epochJD: 2460211.5,
      aAU: 17.18491452314557,
      e: 0.9545612442767357,
      iDeg: 74.19091017013747,
      nodeDeg: 255.8553510995133,
      argPeriDeg: 198.9879994677832,
      meanAnomalyDeg: 357.0928096635318,
      meanMotionDegPerDay: 0.01383512251776258,
    }),
    /* Shape unknown: a mild 1.3 elongation, chosen. */
    shape: { ...COMET_RELIEF, lobes: ellipsoid(13.2, 10.2, 10.2), seed: 1212 },
    ...cometDust({ fullAU: 0.8, radii: 7 }),
    surfaceEvidence: "Never resolved: the nucleus has only ever been seen inside its coma. Size is inferred, not measured. The surface is a generic comet nucleus",
    info: {
      population: "Halley-type comets · 0.78-33.6 AU",
      diameter: "Not measured. Upper limit radius 17 ± 6 km (Ye et al. 2020); outburst power implies about 5.6 km (Jewitt & Luu 2025)",
      rotationPeriod: "57 ± 1 h from coma structure (Knight et al. 2024); a 2026 photometric study gives 29.45 or 58.90 h",
      orbitalSpeed: speedLine(17.18491452314557, 0.9545612442767357, 8.824, { periodYears: 26020.73 / 365.25 }),
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "Nicknamed the 'devil comet' in 2023, when outbursts threw its coma into a shape with two horns. It had nine big outbursts about two weeks apart on the way in, some brightening it a hundredfold, reached perihelion on 21 April 2024 at 0.78 AU, and was visible to the naked eye at about magnitude 3.8. Jean-Louis Pons found it on 12 July 1812 and William Brooks recovered it in 1883; older records go back to 1385. It is the parent of the December κ Draconid meteors. On a 71-year orbit, it is on its way out now, at 8.8 AU, and next returns around 2095.",
    },
  },

  // ---------------------------------------------------- C/2014 UN271
  {
    id: "bernardinelli-bernstein",
    name: "C/2014 UN271",
    colourMap: true,
    /* Full mesh detail (96 x 64): the heavier terrain asked for in round 3 needs the vertices to show; one body, ~2,700 more vertices. */
    meshDetail: 1,
    designation: "C/2014 UN271 (Bernardinelli-Bernstein)",
    classification: "Oort Cloud comet nucleus · the largest known",
    detail: "Twice Hale-Bopp's size, falling in from the Oort Cloud | Dark Energy Survey",
    diameterKm: 137,
    diameterLabel: "137 ± 17 km (ALMA); 119 ± 15 km if its dust is at its maximum",
    albedo: 0.053,
    /* 'Moderately red', no verified indices: the comet class colour. */
    chroma: CLASS_CHROMA.COMET,
    /* A 20.6-day period has been claimed and not confirmed; drawn at that,
     * which the rotation clock turns into its slowest spin. */
    rotationHours: 494,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf("JPL SBDB orbit solution 145, epoch JD 2459577.5", {
      epochJD: 2459577.5,
      aAU: 14766.64908640488,
      e: 0.999259317407813,
      iDeg: 95.43657896468834,
      nodeDeg: 189.911612302163,
      argPeriDeg: 326.3377723935801,
      meanAnomalyDeg: 359.9981794038491,
      meanMotionDegPerDay: 5.492640087161307e-7,
    }),
    /* Heavy terrain and craters (Prompts.md round 3). Never resolved, so
     * the amounts are chosen, not measured: relief 0.03 -> 0.07, sixty
     * craters to 0.22 rad and two basins -- what a 140 km body that has
     * sat in the Oort cloud for 4.5 billion years can carry; Phoebe, of
     * similar size, is cratered to saturation (Porco et al. 2005). */
    shape: { ...COMET_RELIEF, lobes: ellipsoid(145, 135, 131), relief: 0.07, grain: 0.025,
      craterCount: 60, craterMax: 0.22, craterDepth: 0.035,
      bigCraters: [
        { dir: [0.3, 0.5, 0.81], radius: 0.42, depth: 0.05, rim: 0.01 },
        { dir: [-0.7, -0.2, -0.68], radius: 0.33, depth: 0.04, rim: 0.008 },
      ],
      seed: 2714 },
    /* CO-driven: active at 23.8 AU in 2018 and seen jetting CO at 16.6 AU
     * in 2024 (ALMA); fully active by its perihelion at 10.9 AU. */
    ...cometDust({ onsetAU: 24, fullAU: 11, radii: 5, opacity: 0.14 }),
    surfaceEvidence: "Never resolved: the nucleus size comes from Hubble photometry with the coma subtracted and ALMA's thermal measurement. The surface is a generic comet nucleus",
    info: {
      population: "Oort Cloud comets · perihelion 10.9 AU, falling in from ~40,000 AU",
      diameter: "137 ± 17 km (Lellouch et al. 2022, ALMA); 119 ± 15 km (Hui et al. 2022, Hubble)",
      rotationPeriod: "A 20.6-day period is claimed (Ferrin & Ferrero 2022) and unconfirmed",
      orbitalSpeed: `${(29.7847 * Math.sqrt(2 / 13.584 - 1 / 14766.65)).toFixed(1)} km/s now, falling in at 13.6 AU; perihelion 10.9 AU in January 2031 · the barycentric orbit takes about 3 million years inbound (Wikipedia)`,
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "The largest comet nucleus ever measured, roughly 120-140 km across — about twice Hale-Bopp's. It was found in Dark Energy Survey images from 2014-2018 and announced in June 2021, and it was already active then, at nearly 24 AU, driven by carbon monoxide rather than water; ALMA caught CO jets in 2024. It never comes closer than 10.9 AU — just outside Saturn's orbit — and gets there in January 2031; the last time it came this close was some three million years ago. The semi-major axis its elements quote, 14,767 AU, is an osculating value with no physical meaning as a period.",
    },
  },

  // -------------------------------------------------------- Hale-Bopp
  {
    id: "hale-bopp",
    name: "C/1995 O1 Hale-Bopp",
    colourMap: true,
    meshDetail: 0.75,
    designation: "C/1995 O1 (Hale-Bopp)",
    classification: "Long-period comet nucleus · the Great Comet of 1997",
    detail: "Eighteen months to the naked eye | now a bare nucleus at 51 AU",
    diameterKm: 74,
    diameterLabel: "74 ± 6 km (Szabó et al. 2012)",
    albedo: 0.081,
    chroma: CLASS_CHROMA.COMET,
    rotationHours: 11.35,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf("JPL SBDB orbit solution 226, epoch JD 2459837.5", {
      epochJD: 2459837.5,
      aAU: 177.4333839117583,
      e: 0.9949810027633206,
      iDeg: 89.28759424740302,
      nodeDeg: 282.7334213961641,
      argPeriDeg: 130.4146670659176,
      meanAnomalyDeg: 3.878386339423241,
      meanMotionDegPerDay: 0.0004170144183266921,
    }),
    /* A little more terrain (Prompts.md round 3): relief 0.035 -> 0.05,
     * craters 18 -> 26. Chosen; the nucleus has never been resolved. */
    shape: { ...COMET_RELIEF, lobes: ellipsoid(80, 72, 70), relief: 0.05, craterCount: 26, seed: 1995 },
    /* Activity stopped between late 2007 and 2009 at about 28 AU (Szabó et
     * al. 2012); it was discovered active at 7.2 AU. */
    ...cometDust({ onsetAU: 28, fullAU: 1.0, radii: 7, opacity: 0.2, tail: 20 }),
    surfaceEvidence: "Never resolved. Size and albedo from Herschel and optical measurements of the bare nucleus at 31.5 AU. The surface is a generic comet nucleus",
    info: {
      population: "Long-period comets · 0.91-354 AU (osculating), about 2,400 years barycentric",
      diameter: "74 ± 6 km (Szabó et al. 2012, Herschel); 60 ± 20 km in older work",
      rotationPeriod: "11.35 ± 0.04 h (Wikipedia; primary source not checked)",
      orbitalSpeed: `${(29.7847 * Math.sqrt(2 / 51.144 - 1 / 177.433)).toFixed(1)} km/s now, at 51 AU and outbound; perihelion 0.91 AU on 1 April 1997 · next return around 4385`,
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "Found on 23 July 1995 by Alan Hale and Thomas Bopp at 7.2 AU — a record distance for an amateur find — it went on to be visible to the naked eye for about 569 days, twice the previous record. It showed a third kind of tail nobody had seen clearly before, made of sodium. Its nucleus, 60-74 km across, is several times Halley's. Activity stopped at about 28 AU in 2007-2009, and afterwards the bare nucleus was twice as reflective as before, which is read as fresh frost settling on it. It is 51 AU out now, past the Kuiper Belt, and drawn bare.",
    },
  },

  // ------------------------------------------------------------ NEOWISE
  {
    id: "neowise",
    name: "C/2020 F3 NEOWISE",
    colourMap: true,
    meshDetail: 0.75,
    designation: "C/2020 F3 (NEOWISE)",
    classification: "Long-period comet nucleus · the comet of July 2020",
    detail: "The brightest northern comet since Hale-Bopp | NEOWISE, 27 March 2020",
    diameterKm: 5,
    diameterLabel: "About 5 km (NEOWISE infrared)",
    /* Not measured; the comet-nucleus value used everywhere else. */
    albedo: 0.04,
    chroma: CLASS_CHROMA.COMET,
    rotationHours: 7.8,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: orbitOf("JPL SBDB orbit solution 31, epoch JD 2459036.5", {
      epochJD: 2459036.5,
      aAU: 358.4679565529321,
      e: 0.9991780262531292,
      iDeg: 128.9375027594809,
      nodeDeg: 61.01042818536988,
      argPeriDeg: 37.2786584481257,
      meanAnomalyDeg: 0.0003370720801246702,
      meanMotionDegPerDay: 0.0001452207126474352,
    }),
    /* A little more terrain (Prompts.md round 3): relief 0.05 -> 0.065.
     * Chosen; never resolved. */
    shape: { ...COMET_RELIEF, lobes: ellipsoid(5.9, 4.8, 4.5), relief: 0.065, seed: 2020 },
    ...cometDust({ fullAU: 0.3, radii: 7, tail: 20 }),
    surfaceEvidence: "Never resolved. Size from the NEOWISE discovery data; spin from the spiral dust shells in its coma (Manzini et al. 2021). The surface is a generic comet nucleus",
    info: {
      population: "Long-period comets · 0.29-717 AU (osculating)",
      diameter: "About 5 km — NASA/JPL, from the NEOWISE infrared data",
      rotationPeriod: "7.8 ± 0.2 h from spiral dust shells (Manzini et al. 2021)",
      orbitalSpeed: `${(29.7847 * Math.sqrt(2 / 18.651 - 1 / 358.468)).toFixed(1)} km/s now, at 18.7 AU and outbound; perihelion 0.29 AU on 3 July 2020 · one orbit about 6,800 years`,
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Generic comet surface",
      roughness: "unknown",
      description:
        "Found by NASA's NEOWISE infrared space telescope on 27 March 2020 and, that July, the brightest comet in the northern sky since Hale-Bopp — about magnitude 1. It passed 0.29 AU from the Sun on 3 July and closest to Earth, 0.69 AU, on 23 July. A sodium tail was confirmed on 13 July. It is at 18.7 AU now, drawn bare, and will not be back for about 6,800 years.",
    },
  },
]);

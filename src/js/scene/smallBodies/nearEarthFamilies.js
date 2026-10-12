/**
 * The near-Earth families, as real rocks.
 *
 * Round 38 (Prompts.md, "Near Earth Asteroid Four Families"): the families
 * were drawn as clouds of points, about 890 of them, and the owner's verdict
 * was that they read as twinkling stars -- "sparkling things which sparkle,
 * which aren't". They are gone (populationClouds.js). In their place, each
 * family is shown by a handful of its real members, each a full body you can
 * fly to and open, drawn the way the brief asks: by family for the shape
 * (Apollos varied, about one in six a binary; Amors larger and cratered;
 * Atens small and fast; Atiras baked by the Sun) and by spectral type for
 * the surface (C dark rubble, S stony and cratered with dust ponds, M
 * metal). The whole family is shown by its orbits, which light when one of
 * its members is hovered or focused (familyOrbits.js), not by dots.
 *
 * Together with the near-Earth bodies already drawn -- Eros (Amor); Apophis,
 * Cruithne and Moshup (Atens); Bennu, Ryugu, Itokawa, Didymos, Phaethon,
 * Toutatis, Geographos and Kamoʻoalewa (Apollos) -- that makes three Atiras,
 * six Atens, sixteen Apollos (three of them binaries: Didymos, 1862 Apollo,
 * 1989 JA) and seven Amors.
 *
 * ## Provenance
 *
 * Elements: JPL Small-Body Database (`sbdb.api`, full precision), queried 10
 * October 2026, every one at JD 2461200.5; each record names its orbit
 * solution. Sizes, albedos, rotation periods, colour indices and spectral
 * types are SBDB's `phys_par` entries with their own references, quoted on
 * each card; where SBDB's size rests on an *assumed* albedo the card says
 * so. Binary facts: Atira -- Deleon et al. 2024 (PSJ); 1862 Apollo -- Ostro
 * et al. 2005 (IAUC 8627) and SBDB (a 3.75 km, P 27.25 h); Florence -- the
 * JPL/CNEOS radar release of 1 September 2017; 1989 JA -- Goldstone radar,
 * May 2022. 1986 DA's metal -- Sanchez et al. 2021 (PSJ 2, 205), about 85%
 * metal. Shapes are chosen within those sizes, as every generated shape in
 * the scene is, and each card says what is measured and what is drawn.
 */
import {
  brFromBV,
  chromaFromBR,
  CLASS_CHROMA,
  ellipsoid,
  orbitOf,
  withSpeedNow,
} from "./catalogueHelpers.js";

const SBDB = (solution) => `JPL SBDB orbit solution ${solution}, epoch JD 2461200.5, queried 10 October 2026`;
const meanMotion = (aAU) => 0.9856076686 / (aAU ** 1.5);
const orbit = (solution, el) => orbitOf(SBDB(solution), { epochJD: 2461200.5, ...el, meanMotionDegPerDay: meanMotion(el.aAU) });
const range = (el) => `${(el.aAU * (1 - el.e)).toFixed(2)}-${(el.aAU * (1 + el.e)).toFixed(2)} AU`;

/*
 * The three surfaces of the brief, as shape settings for the builder
 * (smallBodyShapes.js). Amounts chosen by eye against the drawn Bennu, Eros
 * and the Rank 2 metal-rich bodies.
 *
 *   C   rubble pile: many boulders, few, shallow craters (Bennu, Ryugu)
 *   S   solid, crater-scarred bedrock; the dust ponds are in the map
 *       (an Eros/Itokawa relief) rather than the mesh
 *   M   dense metal: no boulders, shallow scoop-like depressions instead
 *       of bowls -- the brief's regmaglypts -- and a metallic material
 *   E   enstatite (Xe): bright, smooth, lightly cratered
 *   BAKED  an Atira's surface, scorched near the Sun: fractured, sharper
 *       grain, few loose boulders
 */
const C_RUBBLE = Object.freeze({ neck: 1, relief: 0.05, grain: 0.03, craterCount: 14, craterMin: 0.05, craterMax: 0.16, craterDepth: 0.02, boulders: 70, boulderSize: 0.06 });
const S_SOLID = Object.freeze({ neck: 1, relief: 0.04, grain: 0.014, craterCount: 64, craterMin: 0.03, craterMax: 0.22, craterDepth: 0.036, boulders: 10, boulderSize: 0.035 });
const M_METAL = Object.freeze({ neck: 1, relief: 0.05, grain: 0.022, craterCount: 26, craterMin: 0.05, craterMax: 0.24, craterDepth: 0.016, boulders: 0 });
const E_BRIGHT = Object.freeze({ neck: 1, relief: 0.03, grain: 0.01, craterCount: 30, craterMin: 0.04, craterMax: 0.18, craterDepth: 0.025, boulders: 4, boulderSize: 0.03 });
const BAKED = Object.freeze({ neck: 1, relief: 0.045, grain: 0.03, craterCount: 40, craterMin: 0.03, craterMax: 0.2, craterDepth: 0.03, boulders: 4, boulderSize: 0.03 });

/* Shallow elongated scoops for the metal body: wide, shallow bigCraters. */
const SCOOPS = [
  { dir: [0.8, 0.2, 0.56], radius: 0.42, depth: 0.03, rim: 0.004 },
  { dir: [-0.6, 0.5, 0.62], radius: 0.36, depth: 0.026, rim: 0.004 },
  { dir: [-0.3, -0.8, 0.52], radius: 0.34, depth: 0.024, rim: 0.004 },
  { dir: [0.4, -0.3, -0.86], radius: 0.4, depth: 0.028, rim: 0.004 },
];

/* Mesh: 0.55 of the full sphere (53 x 35, about 3,700 triangles) for the
 * kilometre-sized rocks, 0.7 for the two big Amors -- the maps carry the
 * small craters and boulders, the vertices the outline and the big
 * craters. Twenty at full count would add ~240,000 triangles to the scene
 * (check-small-bodies.mjs); at these they add about 90,000 -- 688,000 drawn
 * in all, measured round 38. Most are a few pixels across most of the time. */

/* Colour from a measured B-V where SBDB has one. */
const fromBV = (bv) => chromaFromBR(brFromBV(bv));
/* Atiras: reddened by long exposure close to the Sun (space weathering) --
 * B-R 1.25, chosen; no colour has been measured for these three. */
const BAKED_CHROMA = chromaFromBR(1.25);
/* D-type: the reddest, darkest class -- B-R 1.45, chosen as typical; Don
 * Quixote's own colours are not in SBDB. */
const D_CHROMA = chromaFromBR(1.45);

const RECORDS = [
  /* ================================================================ Atiras */
  {
    id: "atira",
    name: "Atira",
    family: "atira",
    spectralType: "Not measured",
    meshDetail: 0.55,
    designation: "163693 Atira (2003 CP20)",
    classification: "Near-Earth asteroid · Atira · a binary that never leaves Earth's orbit",
    detail: "The family's namesake, and a pair | radar 2017",
    diameterKm: 4.92,
    diameterLabel: "4.92 ± 0.95 km (volume-equivalent), with a 0.8 km moon",
    /* From H 16.41 and the radar size, p = (1329 / D x 10^(-H/5))^2. */
    albedo: 0.02,
    chroma: BAKED_CHROMA,
    rotationHours: 3.398,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(225, { aAU: 0.7409583303816879, e: 0.3221621429651009, iDeg: 25.61888842246143, nodeDeg: 103.8678398163903, argPeriDeg: 252.92789742633, meanAnomalyDeg: 346.3219696841728 }),
    /* A fast spinner with a moon: drawn as a top with an equatorial ridge,
     * like Moshup and Didymos. */
    shape: { ...BAKED, lobes: ellipsoid(5.2, 5.0, 4.6), ridge: 0.07, seed: 163693 },
    moons: [
      {
        name: "Atira I",
        designation: "(163693) Atira I",
        classification: "Natural satellite · about 0.8 km, 7.8 km out",
        diameterKm: 0.8,
        diameterLabel: "0.80 ± 0.30 km (Deleon et al. 2024)",
        albedo: 0.02,
        chroma: BAKED_CHROMA,
        separationKm: 7.8,
        periodHours: 15.577,
        inclinationDeg: 0,
        shape: { ...BAKED, lobes: ellipsoid(0.9, 0.8, 0.7), craterCount: 10, seed: 1636931 },
        info: {
          diameter: "0.80 ± 0.30 km (Deleon et al. 2024)",
          rotationPeriod: "Not measured",
          orbitalSpeed: `${((2 * Math.PI * 7.8) / (15.577 * 3600) * 1000).toFixed(2)} m/s around Atira — once every 15.6 hours, 7.8 km out`,
          surfaceEvidence: "Radar, 2017 (Rivera-Valentin et al., CBET 4347). Surface generated",
          description: "Atira's moon, found by radar at Arecibo in 2017: a body about 800 m across going round its parent every 15.6 hours, 7.8 km out. Its orbit weighs Atira — about 1.4 g/cm³, a loose rubble pile.",
        },
      },
    ],
    surfaceEvidence: "Radar and lightcurves (Deleon et al. 2024). Never imaged; surface generated as a baked, weathered body",
    info: {
      population: "Near-Earth asteroids · Atira group — wholly inside Earth's orbit, 0.50-0.98 AU",
      diameter: "4.92 ± 0.95 km volume-equivalent, moon 0.80 ± 0.30 km at 7.8 ± 0.5 km (Deleon et al. 2024, Planetary Science Journal)",
      rotationPeriod: "3.398 h (LCDB)",
      gravity: "Density 1.43 ± 0.87 g/cm³, from its moon's 15.577 h orbit (Deleon et al. 2024)",
      surfaceEvidence: "Never imaged. Drawn dark and reddened, as a surface baked close to the Sun",
      roughness: "unknown",
      description: "The first Atira found to be a binary, and the asteroid the whole family is named after — the first asteroid known to orbit entirely inside Earth's orbit, found by LINEAR in 2003. It never comes further out than 0.98 AU, so it is only ever seen near the Sun in a twilight sky, which is why so few of its kind are known. Radar at Arecibo found its moon in 2017. Named for the Pawnee goddess of the evening star.",
    },
  },
  {
    id: "aylochaxnim",
    name: "ʼAylóʼchaxnim",
    family: "atira",
    spectralType: "Not measured",
    meshDetail: 0.55,
    designation: "594913 ʼAylóʼchaxnim (2020 AV2)",
    classification: "Near-Earth asteroid · Atira · the first found wholly inside Venus's orbit",
    detail: "Never as far out as Venus | Zwicky Transient Facility, January 2020",
    diameterKm: 1.7,
    diameterLabel: "≈1.7 km, from H 16.2 at an assumed albedo of 0.20",
    albedo: 0.2,
    chroma: BAKED_CHROMA,
    rotationHours: 6,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(46, { aAU: 0.5552913383621794, e: 0.1773461889677603, iDeg: 15.86822558810007, nodeDeg: 6.678381631839548, argPeriDeg: 187.4006557972202, meanAnomalyDeg: 61.02552902668404 }),
    shape: { ...BAKED, lobes: ellipsoid(2.0, 1.7, 1.45), seed: 594913 },
    surfaceEvidence: "A point of light. Size from its brightness at an assumed albedo; surface generated as a baked body",
    info: {
      population: "Near-Earth asteroids · Atira group — a 'Vatira', wholly inside Venus's orbit, 0.46-0.65 AU",
      diameter: "≈1.7 km — from H 16.2 at an assumed albedo of 0.20; not measured",
      rotationPeriod: "Not measured — drawn turning once every 6 hours",
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. Its surface spends its whole life at 0.46-0.65 AU, two to five times Earth's sunlight",
      roughness: "unknown",
      description: "Found by the Zwicky Transient Facility on 4 January 2020: the first asteroid known to stay entirely inside Venus's orbit, between 0.46 and 0.65 AU from the Sun. A body like this can only be seen low in twilight, just after sunset or before dawn, which is why none was found before. Its name, from the Luiseño people of southern California, means 'Venus girl'.",
    },
  },
  {
    id: "2021ph27",
    name: "2021 PH27",
    family: "atira",
    spectralType: "Not measured",
    meshDetail: 0.55,
    designation: "(2021 PH27)",
    classification: "Near-Earth asteroid · Atira · the closest to the Sun of any known asteroid",
    detail: "Closer to the Sun than Mercury | Dark Energy Camera, August 2021",
    diameterKm: 0.87,
    diameterLabel: "≈0.9 km, from H 17.67 at an assumed albedo of 0.20",
    albedo: 0.2,
    chroma: BAKED_CHROMA,
    rotationHours: 6,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(20, { aAU: 0.4617629210470229, e: 0.7115443089925902, iDeg: 31.93855483908925, nodeDeg: 39.39419809326461, argPeriDeg: 8.583100072046056, meanAnomalyDeg: 316.6761498758718 }),
    shape: { ...BAKED, lobes: ellipsoid(1.05, 0.88, 0.7), grain: 0.04, seed: 2021 },
    surfaceEvidence: "A point of light. Size from its brightness at an assumed albedo; surface generated as a scorched body",
    info: {
      population: "Near-Earth asteroids · Atira group, 0.13-0.79 AU",
      diameter: "≈0.9 km — from H 17.67 at an assumed albedo of 0.20; not measured",
      rotationPeriod: "Not measured — drawn turning once every 6 hours",
      gravity: "Not measured",
      surfaceEvidence: "Never resolved. At perihelion, 0.13 AU, its surface reaches about 500 °C — hot enough to melt lead",
      roughness: "unknown",
      description: "The asteroid with the smallest orbit known: it goes round the Sun every 113 days and comes within 0.13 AU of it, closer than Mercury ever does. Found by Scott Sheppard in August 2021 in twilight images from the Dark Energy Camera in Chile. At its closest its surface reaches about 500 °C. Its orbit is so close to the Sun that general relativity shifts it measurably — more than Mercury's famous shift.",
    },
  },

  /* ================================================================= Atens */
  {
    id: "aten",
    name: "Aten",
    family: "aten",
    spectralType: "S (stony) · Sr",
    meshDetail: 0.55,
    designation: "2062 Aten (1976 AA)",
    classification: "Near-Earth asteroid · Aten · the family's namesake, S-type",
    detail: "The first asteroid found with an orbit smaller than Earth's | 1976",
    diameterKm: 1.1,
    diameterLabel: "1.1 km (Tedesco 1994)",
    albedo: 0.26,
    chroma: fromBV(0.93),
    rotationHours: 42.15,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(149, { aAU: 0.9669667478344453, e: 0.1828582815030813, iDeg: 18.93555636228816, nodeDeg: 108.5278436050604, argPeriDeg: 148.0681858555706, meanAnomalyDeg: 239.9606677900453 }),
    shape: { ...S_SOLID, lobes: ellipsoid(1.3, 1.1, 0.95), seed: 2062 },
    surfaceEvidence: "A point of light; type from its spectrum (Sr). Surface generated as stony, cratered rock",
    info: {
      population: "Near-Earth asteroids · Aten group, 0.79-1.14 AU",
      diameter: "1.1 km, albedo 0.26 (Tedesco, Hazards due to Comets and Asteroids, 1994)",
      rotationPeriod: "42.15 h — a slow turner (Mottola et al. 1995)",
      gravity: "Not measured",
      surfaceEvidence: "Stony (S, Sr class) from its spectrum: silicate rock, iron-nickel grains",
      roughness: "unknown",
      description: "Found by Eleanor Helin at Palomar on 7 January 1976 — the first asteroid known to go round the Sun in less than a year, which made it the founder of a whole new family. Atens spend most of their time inside Earth's orbit and cross it near their farthest point. This one takes 347 days to go round, and turns only once every 42 hours. Named for the Egyptian sun-disc god.",
    },
  },
  {
    id: "rashalom",
    name: "Ra-Shalom",
    family: "aten",
    spectralType: "C (carbon-rich) · Xc",
    meshDetail: 0.55,
    designation: "2100 Ra-Shalom (1978 RA)",
    classification: "Near-Earth asteroid · Aten · dark, carbon-rich (C)",
    detail: "A dark carbon-rich Aten, studied by radar | Shepard et al. 2008",
    diameterKm: 2.3,
    diameterLabel: "2.3 ± 0.2 km (Shepard et al. 2008)",
    albedo: 0.13,
    chroma: fromBV(0.712),
    rotationHours: 19.797,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(508, { aAU: 0.8320380956623273, e: 0.436499569805015, iDeg: 15.75910219462338, nodeDeg: 170.7613746850092, argPeriDeg: 356.0814951474854, meanAnomalyDeg: 148.8399521233831 }),
    shape: { ...C_RUBBLE, lobes: ellipsoid(2.6, 2.3, 2.05), seed: 2100 },
    surfaceEvidence: "Radar and thermal infrared (Shepard et al. 2008). Never imaged; drawn as a dark carbon-rich rubble pile",
    info: {
      population: "Near-Earth asteroids · Aten group, 0.47-1.20 AU",
      diameter: "2.3 ± 0.2 km, albedo 0.13 ± 0.03 (Shepard et al. 2008, Icarus 193, 20)",
      rotationPeriod: "19.8 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Tholen C, SMASS Xc: dark, carbon-bearing rock",
      roughness: "Radar: a surface of coarse regolith over rock",
      description: "A dark, carbon-rich Aten about 2.3 km across, turning once every 20 hours. Found at Palomar in 1978 during the Camp David peace talks, and named for both peoples' words: the Egyptian sun god Ra and the Hebrew 'shalom', peace.",
    },
  },
  {
    id: "hathor",
    name: "Hathor",
    family: "aten",
    spectralType: "S (stony) · Sq",
    meshDetail: 0.55,
    designation: "2340 Hathor (1976 UA)",
    classification: "Near-Earth asteroid · Aten · small, fast, stony (Sq)",
    detail: "A 300-metre rock on a fast, Earth-crossing orbit | 1976",
    diameterKm: 0.3,
    diameterLabel: "≈0.3 km, at an assumed albedo of 0.15",
    albedo: 0.15,
    chroma: fromBV(0.77),
    rotationHours: 3.35,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(62, { aAU: 0.8437498723561032, e: 0.4499561430699934, iDeg: 5.860185941757463, nodeDeg: 211.2073161458129, argPeriDeg: 40.20390513814882, meanAnomalyDeg: 96.28838570207772 }),
    shape: { ...S_SOLID, lobes: ellipsoid(0.36, 0.3, 0.25), craterCount: 30, seed: 2340 },
    surfaceEvidence: "A point of light; type from its spectrum (Sq). Surface generated",
    info: {
      population: "Near-Earth asteroids · Aten group, 0.46-1.22 AU",
      diameter: "≈0.3 km at an assumed albedo of 0.15 (Tedesco 1994)",
      rotationPeriod: "3.35 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Stony (Sq): fresher ordinary-chondrite rock",
      roughness: "unknown",
      description: "One of the smallest numbered asteroids, about 300 m across, on a fast orbit of 283 days that carries it from inside Venus's distance to just outside Earth's. Found by Charles Kowal at Palomar in October 1976, the second Aten after Aten itself. Named for the Egyptian sky goddess.",
    },
  },

  /* =============================================================== Apollos */
  {
    id: "apollo",
    name: "Apollo",
    family: "apollo",
    spectralType: "Q (fresh stony)",
    meshDetail: 0.55,
    designation: "1862 Apollo (1932 HA)",
    classification: "Near-Earth asteroid · Apollo · the family's namesake, with a moon",
    detail: "The first Earth-crosser ever found — and a binary | 1932",
    diameterKm: 1.5,
    diameterLabel: "1.5 km, with a moon about 80 m across",
    albedo: 0.25,
    chroma: fromBV(0.819),
    rotationHours: 3.065,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(579, { aAU: 1.470715141636512, e: 0.5601800481295997, iDeg: 6.352178986018433, nodeDeg: 35.50294307615321, argPeriDeg: 286.0977380402823, meanAnomalyDeg: 224.3616015046227 }),
    shape: { ...S_SOLID, lobes: ellipsoid(1.7, 1.55, 1.35), ridge: 0.06, seed: 1862 },
    moons: [
      {
        name: "Apollo I",
        designation: "(1862) Apollo I",
        classification: "Natural satellite · about 80 m, 3.75 km out",
        diameterKm: 0.08,
        diameterLabel: "About 80 m (Ostro et al. 2005)",
        albedo: 0.25,
        chroma: fromBV(0.819),
        separationKm: 3.75,
        periodHours: 27.25,
        inclinationDeg: 0,
        shape: { ...S_SOLID, lobes: ellipsoid(0.09, 0.08, 0.07), craterCount: 6, seed: 18621 },
        info: {
          diameter: "About 80 m (Ostro et al. 2005, IAUC 8627)",
          rotationPeriod: "Not measured",
          orbitalSpeed: `${((2 * Math.PI * 3.75) / (27.25 * 3600) * 1000).toFixed(2)} m/s around Apollo — once every 27.25 hours, 3.75 km out`,
          surfaceEvidence: "Arecibo radar, November 2005. Surface generated",
          description: "Found by radar at Arecibo in 2005: a boulder-sized moon about 80 m across, circling Apollo once a day at 3.75 km.",
        },
      },
    ],
    surfaceEvidence: "Radar; type from its spectrum (Q). Never imaged; surface generated as fresh stony rock",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.65-2.29 AU",
      diameter: "1.5 km, albedo 0.25 (Tedesco 1994); moon ~80 m at 3.75 km, 27.25 h (Ostro et al. 2005)",
      rotationPeriod: "3.065 h, and speeding up — one of the first bodies seen spun up by sunlight (the YORP effect, Kaasalainen et al. 2007)",
      gravity: "Not measured",
      surfaceEvidence: "Q-type: fresh, unweathered ordinary-chondrite rock — the kind of rock most stony meteorites are",
      roughness: "unknown",
      description: "The asteroid the biggest near-Earth family is named after: found by Karl Reinmuth on 24 April 1932, the first asteroid known to cross Earth's orbit — then lost for 41 years before it was recovered in 1973. Radar found a small moon in 2005. Its spin is slowly speeding up, pushed by the heat its own surface gives off. Named for the Greek god.",
    },
  },
  {
    id: "icarus",
    name: "Icarus",
    family: "apollo",
    spectralType: "Q (fresh stony)",
    meshDetail: 0.55,
    designation: "1566 Icarus (1949 MA)",
    classification: "Near-Earth asteroid · Apollo · flies closer to the Sun than Mercury",
    detail: "Inside Mercury's orbit every 409 days | Baade, 1949",
    diameterKm: 1.0,
    diameterLabel: "1.0 km (Tedesco 1994)",
    albedo: 0.51,
    chroma: fromBV(0.774),
    rotationHours: 2.2726,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(196, { aAU: 1.077994212576463, e: 0.8270188506942974, iDeg: 22.8016402405493, nodeDeg: 87.94856455261704, argPeriDeg: 31.44439445693802, meanAnomalyDeg: 329.1826622860697 }),
    shape: { ...S_SOLID, lobes: ellipsoid(1.15, 1.05, 0.85), ridge: 0.05, grain: 0.022, seed: 1566 },
    surfaceEvidence: "A point of light and a radar echo; drawn as fresh stony rock",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.19-1.97 AU",
      diameter: "1.0 km, albedo 0.51 (Tedesco 1994)",
      rotationPeriod: "2.27 h — a fast spinner (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Q-type colours (B-V 0.77): fresh stony rock, heated to about 600 °C at perihelion",
      roughness: "unknown",
      description: "Found by Walter Baade in 1949, and named for the boy who flew too close to the Sun: at 0.19 AU it passes nearer the Sun than Mercury does, heating its surface to several hundred degrees. In 1968 it passed 6 million km from Earth and became the first asteroid ever observed by radar. Its orbit was used as an early test of general relativity.",
    },
  },
  {
    id: "toro",
    name: "Toro",
    family: "apollo",
    spectralType: "S (stony)",
    meshDetail: 0.55,
    designation: "1685 Toro (1948 OA)",
    classification: "Near-Earth asteroid · Apollo · S-type, in step with Earth and Venus",
    detail: "Locked in rhythm with Earth (5:8) and Venus (5:13) | 1948",
    diameterKm: 3.4,
    diameterLabel: "3.4 km (Tedesco 1994)",
    albedo: 0.31,
    chroma: fromBV(0.88),
    rotationHours: 10.1995,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(908, { aAU: 1.367859437152833, e: 0.4359922205696652, iDeg: 9.381775895529808, nodeDeg: 274.2078473258248, argPeriDeg: 127.270037779535, meanAnomalyDeg: 205.9145025924727 }),
    shape: { ...S_SOLID, lobes: ellipsoid(4.2, 3.2, 2.9), seed: 1685,
      bigCraters: [{ dir: [0.7, 0.3, 0.65], radius: 0.4, depth: 0.08, rim: 0.014 }, { dir: [-0.5, -0.4, 0.77], radius: 0.3, depth: 0.06, rim: 0.011 }] },
    surfaceEvidence: "A point of light; type from its spectrum (S). Surface generated: cratered bedrock with dust ponds",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.77-1.96 AU",
      diameter: "3.4 km, albedo 0.31 (Tedesco 1994)",
      rotationPeriod: "10.2 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "S-type: silicate rock with iron-nickel grains",
      roughness: "unknown",
      description: "A 3.4 km stony Apollo whose orbit is in a near-resonance with both Earth (5 of its orbits to 8 of ours) and Venus (5 to 13), which shepherds its close approaches — it was once called Earth's 'second moon' for it, wrongly: it goes round the Sun. Found at Lick Observatory in 1948 and named for Betulia Toro Herrick.",
    },
  },
  {
    id: "nereus",
    name: "Nereus",
    family: "apollo",
    spectralType: "E (enstatite) · Xe",
    meshDetail: 0.55,
    designation: "4660 Nereus (1982 DB)",
    classification: "Near-Earth asteroid · Apollo · bright enstatite (Xe), radar-shaped",
    detail: "A bright 330-metre rock, one of the easiest to reach | radar 2002",
    diameterKm: 0.33,
    diameterLabel: "0.33 km (Delbo et al. 2003); radar 510 × 330 × 241 m",
    albedo: 0.55,
    chroma: CLASS_CHROMA.NEUTRAL,
    rotationHours: 15.1749,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(278, { aAU: 1.485112611970113, e: 0.3587435768252949, iDeg: 1.453541710528756, nodeDeg: 313.105557499926, argPeriDeg: 159.5568090407644, meanAnomalyDeg: 158.7251334482576 }),
    /* Brozovic et al. 2009 radar shape: elongated, 510 x 330 x 241 m. */
    shape: { ...E_BRIGHT, lobes: ellipsoid(0.51, 0.33, 0.241), seed: 4660 },
    surfaceEvidence: "Arecibo and Goldstone radar shape (Brozovic et al. 2009). Surface generated as bright enstatite rock",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.95-2.02 AU",
      diameter: "0.33 km, albedo 0.55 (Delbo et al. 2003); radar shape 510 × 330 × 241 m (Brozovic et al. 2009)",
      rotationPeriod: "15.17 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Xe-type: enstatite, a pale magnesium silicate — the rock of aubrite meteorites",
      roughness: "unknown",
      description: "A small, very bright rock — half the light that falls on it comes back — made of enstatite, the pale silicate of the rare aubrite meteorites. Its orbit is so like Earth's that it is one of the cheapest asteroids in the whole Solar System to reach, and it was a target for several missions that were never flown. Named for the Greek sea god.",
    },
  },
  {
    id: "castalia",
    name: "Castalia",
    family: "apollo",
    spectralType: "Not measured",
    meshDetail: 0.55,
    designation: "4769 Castalia (1989 PB)",
    classification: "Near-Earth asteroid · Apollo · the first asteroid ever imaged by radar — a contact binary",
    detail: "Two lumps stuck together | Arecibo, August 1989",
    diameterKm: 1.4,
    diameterLabel: "1.8 × 0.8 km, two lobes (Hudson & Ostro 1994)",
    albedo: 0.092,
    chroma: CLASS_CHROMA.NEUTRAL,
    rotationHours: 4.095,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(187, { aAU: 1.06308849137437, e: 0.4831758015789954, iDeg: 8.885190449241405, nodeDeg: 325.4991410102804, argPeriDeg: 121.4523453593787, meanAnomalyDeg: 143.6125672636032 }),
    /* Two lobes, about 0.8 km each, touching (Hudson & Ostro 1994). */
    shape: { ...C_RUBBLE, boulders: 40, blend: "smooth", lobes: [
      { c: [-0.45, 0, 0], r: [0.46, 0.38, 0.4] },
      { c: [0.45, 0, 0.02], r: [0.42, 0.36, 0.38] },
    ], seed: 4769 },
    surfaceEvidence: "Arecibo radar images, August 1989, and the shape built from them (Hudson & Ostro 1994). Surface generated",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.55-1.58 AU",
      diameter: "About 1.8 × 0.8 km in two lobes (Hudson & Ostro 1994, Science 263, 940); albedo 0.092 (NEOWISE)",
      rotationPeriod: "4.095 h (Ostro et al. 1990)",
      gravity: "Not measured",
      surfaceEvidence: "Radar shape; colour not measured. Drawn dark grey",
      roughness: "unknown",
      description: "The first asteroid ever imaged by radar, at Arecibo in August 1989 — and the pictures showed two lumps of rock, about 800 m each, resting against each other: the first contact binary ever seen. It was the proof that some asteroids are two bodies that came together gently. Named for a nymph of Greek myth.",
    },
  },
  {
    id: "eger",
    name: "Eger",
    family: "apollo",
    spectralType: "E (enstatite) · Xe",
    meshDetail: 0.55,
    designation: "3103 Eger (1982 BB)",
    classification: "Near-Earth asteroid · Apollo · bright enstatite — a source of aubrite meteorites",
    detail: "Very bright, and probably where aubrites come from | 1982",
    diameterKm: 1.5,
    diameterLabel: "1.5 km (Tedesco 1994)",
    albedo: 0.64,
    chroma: fromBV(0.732),
    rotationHours: 5.7103,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(924, { aAU: 1.404035848122111, e: 0.354120301108387, iDeg: 20.93089854400592, nodeDeg: 129.7302664844906, argPeriDeg: 254.0974676796998, meanAnomalyDeg: 299.6218619654081 }),
    shape: { ...E_BRIGHT, lobes: ellipsoid(1.8, 1.4, 1.25), seed: 3103 },
    surfaceEvidence: "A point of light; type from its spectrum (Xe). Surface generated as bright enstatite rock",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.91-1.90 AU",
      diameter: "1.5 km, albedo 0.64 (Tedesco 1994)",
      rotationPeriod: "5.71 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Xe-type: enstatite, matching the aubrite meteorites",
      roughness: "unknown",
      description: "One of the brightest asteroids for its size — almost two-thirds of the sunlight on it bounces back — because it is made of enstatite, the near-white silicate of the rare aubrite meteorites; it is thought to be one of the places they come from. Found by Miklós Lovas in Hungary in 1982 and named for the Hungarian town.",
    },
  },
  {
    id: "daedalus",
    name: "Daedalus",
    family: "apollo",
    spectralType: "S (stony) · Sr",
    meshDetail: 0.55,
    designation: "1864 Daedalus (1971 FA)",
    classification: "Near-Earth asteroid · Apollo · S-type",
    detail: "Icarus's father, on a steep orbit inside Mercury's reach | 1971",
    diameterKm: 3.7,
    diameterLabel: "3.7 km at an assumed albedo of 0.15; NEOWISE albedo 0.27",
    albedo: 0.273,
    chroma: fromBV(0.83),
    rotationHours: 8.572,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(850, { aAU: 1.4608806795516, e: 0.6144605486502296, iDeg: 22.21679138437392, nodeDeg: 6.596263339293885, argPeriDeg: 325.6600919749538, meanAnomalyDeg: 9.215543085632438 }),
    shape: { ...S_SOLID, lobes: ellipsoid(4.4, 3.5, 3.2), seed: 1864,
      bigCraters: [{ dir: [-0.6, 0.5, 0.62], radius: 0.38, depth: 0.075, rim: 0.013 }] },
    surfaceEvidence: "A point of light; type from its spectrum (Sr). Surface generated",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.56-2.36 AU",
      diameter: "3.7 km at an assumed albedo of 0.15 (Tedesco 1994); NEOWISE albedo 0.273 ± 0.055 suggests nearer 2.8 km",
      rotationPeriod: "8.57 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Sr-type: stony",
      roughness: "unknown",
      description: "Found by Tom Gehrels at Palomar in 1971 and named for the inventor of Greek myth who built the wings that carried his son Icarus too near the Sun — fittingly, its orbit runs from inside Mercury's down at 0.56 AU out past Mars.",
    },
  },
  {
    id: "1989ja",
    name: "1989 JA",
    family: "apollo",
    spectralType: "Not measured",
    meshDetail: 0.55,
    designation: "7335 (1989 JA)",
    classification: "Near-Earth asteroid · Apollo · a fast-spinning top with a moon",
    detail: "Radar caught its moon as it passed in May 2022",
    diameterKm: 1.8,
    diameterLabel: "≈1.8 km (JPL), with a small moon",
    albedo: 0.448,
    chroma: CLASS_CHROMA.NEUTRAL,
    rotationHours: 2.58988,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(233, { aAU: 1.772338398035787, e: 0.4846564288797887, iDeg: 15.15630744776688, nodeDeg: 61.20660240436186, argPeriDeg: 232.4334474834381, meanAnomalyDeg: 239.6320141353328 }),
    shape: { ...S_SOLID, lobes: ellipsoid(1.95, 1.85, 1.6), ridge: 0.08, seed: 7335 },
    moons: [
      {
        name: "1989 JA I",
        designation: "(7335) 1989 JA I",
        classification: "Natural satellite · size and orbit not yet published",
        diameterKm: 0.3,
        diameterLabel: "Not published — drawn at about 300 m",
        albedo: 0.448,
        chroma: CLASS_CHROMA.NEUTRAL,
        /* Not published: drawn at 3 km and a 16 h orbit (chosen). */
        separationKm: 3,
        periodHours: 16,
        inclinationDeg: 0,
        shape: { ...S_SOLID, lobes: ellipsoid(0.34, 0.3, 0.26), craterCount: 8, seed: 73351 },
        info: {
          diameter: "Not published — drawn at about 300 m",
          rotationPeriod: "Not measured",
          orbitalSpeed: "Orbit not yet published — drawn at 3 km, once every 16 hours (chosen)",
          surfaceEvidence: "Goldstone radar, May 2022. Surface generated",
          description: "A moon found by NASA's Goldstone radar as 1989 JA passed Earth in May 2022. Its size and orbit have not been published; it is drawn small and close, and the card says so.",
        },
      },
    ],
    surfaceEvidence: "Goldstone radar, May 2022. Never imaged; surface generated",
    info: {
      population: "Near-Earth asteroids · Apollo group, 0.91-2.63 AU",
      diameter: "≈1.8 km (JPL); NEOWISE albedo 0.448 ± 0.043",
      rotationPeriod: "2.59 h — a fast top (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "Colour not measured; bright (albedo 0.45)",
      roughness: "unknown",
      description: "Found at Palomar in 1989 and watched by radar when it passed 4 million km from Earth on 27 May 2022, when Goldstone found that it has a moon. About one in six near-Earth asteroids bigger than 200 m turn out to be binaries — most of them, like this one, fast-spinning tops that have shed material from their equators.",
    },
  },

  /* ================================================================= Amors */
  {
    id: "ganymed",
    name: "Ganymed",
    family: "amor",
    spectralType: "S (stony)",
    meshDetail: 0.7,
    designation: "1036 Ganymed (A924 UB)",
    classification: "Near-Earth asteroid · Amor · the largest of all, S-type",
    detail: "The biggest near-Earth asteroid, 38 km | Baade, 1924",
    diameterKm: 37.675,
    diameterLabel: "37.7 ± 0.4 km (NEOWISE)",
    albedo: 0.238,
    chroma: fromBV(0.842),
    rotationHours: 10.297,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(1541, { aAU: 2.664068815977234, e: 0.5335006672216854, iDeg: 26.68765340379128, nodeDeg: 215.3977394974259, argPeriDeg: 132.5072976556281, meanAnomalyDeg: 142.9653116916981 }),
    shape: { ...S_SOLID, lobes: ellipsoid(41, 37, 34), craterCount: 110, craterMax: 0.26, seed: 1036,
      bigCraters: [
        { dir: [0.7, 0.4, 0.59], radius: 0.5, depth: 0.09, rim: 0.016 },
        { dir: [-0.7, 0.2, 0.68], radius: 0.4, depth: 0.08, rim: 0.014 },
        { dir: [0.1, -0.9, 0.42], radius: 0.36, depth: 0.07, rim: 0.012 },
      ] },
    surfaceEvidence: "A point of light, radar-ranged (2011); type from its spectrum (S). Surface generated: crater-scarred bedrock with dust ponds",
    info: {
      population: "Near-Earth asteroids · Amor group, 1.24-4.09 AU — it never crosses Earth's orbit",
      diameter: "37.7 ± 0.4 km, albedo 0.24 (NEOWISE, Mainzer et al. 2011)",
      rotationPeriod: "10.3 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "S-type: silicate rock with iron-nickel grains",
      roughness: "unknown",
      description: "The largest near-Earth asteroid by far — about 38 km across, twice the size of Eros. Found by Walter Baade in 1924. It is an Amor: it comes inside Mars's orbit but never quite reaches Earth's. Its closest pass this century was 0.36 AU in October 2011, when radar pinged it. An object this size hitting Earth would end most life, and none is coming: Ganymed's orbit cannot reach us for millions of years.",
    },
  },
  {
    id: "donquixote",
    name: "Don Quixote",
    family: "amor",
    spectralType: "D (dark, primitive) — and a comet",
    meshDetail: 0.7,
    designation: "3552 Don Quixote (1983 SA)",
    classification: "Near-Earth asteroid · Amor · a dark D-type that turned out to be a comet",
    detail: "An asteroid with a coma | Spitzer, 2009",
    diameterKm: 19,
    diameterLabel: "19 km (Tedesco 1994)",
    albedo: 0.03,
    chroma: D_CHROMA,
    rotationHours: 6.665,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(349, { aAU: 4.270699442924407, e: 0.7074018380419645, iDeg: 31.05272514571933, nodeDeg: 349.967252592082, argPeriDeg: 316.4915649809392, meanAnomalyDeg: 330.6201460958141 }),
    shape: { ...C_RUBBLE, lobes: ellipsoid(23, 18, 16), craterCount: 40, boulders: 30, seed: 3552 },
    surfaceEvidence: "A point of light; D-type, very dark. A coma of carbon dioxide gas was seen by Spitzer in 2009 (Mommert et al. 2014). Surface generated",
    info: {
      population: "Near-Earth asteroids · Amor group, 1.25-7.29 AU — out past Jupiter at its farthest",
      diameter: "19 km, albedo 0.03 (Tedesco 1994)",
      rotationPeriod: "6.67 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "D-type: among the darkest, reddest surfaces known, rich in organic compounds",
      roughness: "unknown",
      description: "The third-largest near-Earth object, and not really an asteroid: in 2009 the Spitzer Space Telescope saw a faint coma and tail of carbon dioxide gas round it (Mommert et al. 2014) — it is an extinct or sleeping comet nucleus, frozen gas trapped under a dark crust, on an orbit that reaches out beyond Jupiter. Found by Paul Wild in 1983 and named for Cervantes's knight.",
    },
  },
  {
    id: "ivar",
    name: "Ivar",
    family: "amor",
    spectralType: "S (stony)",
    meshDetail: 0.7,
    designation: "1627 Ivar (1929 SH)",
    classification: "Near-Earth asteroid · Amor · long, S-type",
    detail: "A long stony body twice as long as it is wide | radar 2013",
    diameterKm: 9.12,
    diameterLabel: "9.1 km equivalent (Delbo et al. 2003); about 15 km long",
    albedo: 0.15,
    chroma: fromBV(0.872),
    rotationHours: 4.795,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(1526, { aAU: 1.863110322448416, e: 0.3973348248661048, iDeg: 8.456346737466372, nodeDeg: 133.0740277833029, argPeriDeg: 167.8308291532969, meanAnomalyDeg: 28.98026256136011 }),
    /* Elongated, with a waist, as Arecibo's 2013 images suggested;
     * proportions chosen to a 9.1 km equivalent. */
    shape: { ...S_SOLID, blend: "smooth", craterCount: 80, lobes: [
      { c: [-3.6, 0, 0], r: [4.4, 3.2, 3.5] },
      { c: [3.8, 0, 0.1], r: [4.0, 3.0, 3.3] },
    ], seed: 1627 },
    surfaceEvidence: "Arecibo radar, July 2013. Shape chosen within it; surface generated",
    info: {
      population: "Near-Earth asteroids · Amor group, 1.12-2.60 AU",
      diameter: "9.12 km equivalent, albedo 0.15 (Delbo et al. 2003); elongated, about 15 km long",
      rotationPeriod: "4.795 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "S-type: silicate rock with iron-nickel grains",
      roughness: "unknown",
      description: "A long stony Amor, found by Ejnar Hertzsprung in 1929. Radar at Arecibo in 2013 showed an elongated body about 15 km long with a narrow waist. Amors come inside Mars's orbit but stay outside Earth's; Ivar's closest approaches are still millions of kilometres off.",
    },
  },
  {
    id: "florence",
    name: "Florence",
    family: "amor",
    spectralType: "S (stony)",
    meshDetail: 0.55,
    designation: "3122 Florence (1981 ET3)",
    classification: "Near-Earth asteroid · Amor · a triple — two moons",
    detail: "Two moons found by radar | Goldstone, 1 September 2017",
    diameterKm: 4.5,
    diameterLabel: "About 4.5 km (Goldstone radar, 2017)",
    albedo: 0.231,
    chroma: CLASS_CHROMA.S_TYPE,
    rotationHours: 2.3581,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(1063, { aAU: 1.768952762122564, e: 0.4232224394609472, iDeg: 22.14242023332167, nodeDeg: 336.0392375954034, argPeriDeg: 27.8745219297435, meanAnomalyDeg: 252.0668855042523 }),
    shape: { ...S_SOLID, lobes: ellipsoid(4.8, 4.6, 4.1), ridge: 0.075, seed: 3122 },
    /* Periods from the release (inner ~8 h, outer 22-27 h); separations
     * from Kepler's law at a primary density of 2 g/cm3 (chosen): 5.6 km
     * and 11.6 km. Sizes "probably 100-300 m". */
    moons: [
      {
        name: "Florence I",
        designation: "(3122) Florence I",
        classification: "Natural satellite · inner, about 8 hours",
        diameterKm: 0.18,
        diameterLabel: "Probably 100-300 m (JPL/CNEOS 2017) — drawn at 180 m",
        albedo: 0.231,
        chroma: CLASS_CHROMA.S_TYPE,
        separationKm: 5.6,
        periodHours: 8,
        inclinationDeg: 0,
        shape: { ...S_SOLID, lobes: ellipsoid(0.2, 0.18, 0.16), craterCount: 6, seed: 31221 },
        info: {
          diameter: "Probably 100-300 m (JPL/CNEOS, September 2017)",
          rotationPeriod: "Not measured",
          orbitalSpeed: "Roughly 8 hours round Florence; distance about 5.6 km if Florence's density is 2 g/cm³ (derived, not measured)",
          surfaceEvidence: "Goldstone radar, 29 August - 1 September 2017. Surface generated",
          description: "The inner of Florence's two moons, found by Goldstone radar during Florence's 2017 pass — the first triple near-Earth asteroid ever seen.",
        },
      },
      {
        name: "Florence II",
        designation: "(3122) Florence II",
        classification: "Natural satellite · outer, 22-27 hours",
        diameterKm: 0.25,
        diameterLabel: "Probably 100-300 m (JPL/CNEOS 2017) — drawn at 250 m",
        albedo: 0.231,
        chroma: CLASS_CHROMA.S_TYPE,
        separationKm: 11.6,
        periodHours: 24.5,
        inclinationDeg: 0,
        shape: { ...S_SOLID, lobes: ellipsoid(0.28, 0.25, 0.21), craterCount: 8, seed: 31222 },
        info: {
          diameter: "Probably 100-300 m (JPL/CNEOS, September 2017)",
          rotationPeriod: "Not measured",
          orbitalSpeed: "22-27 hours round Florence; distance about 11.6 km at 2 g/cm³ (derived, not measured)",
          surfaceEvidence: "Goldstone radar, 2017. Surface generated",
          description: "The outer of Florence's two moons.",
        },
      },
    ],
    surfaceEvidence: "Goldstone radar images, August-September 2017. Surface generated",
    info: {
      population: "Near-Earth asteroids · Amor group, 1.02-2.52 AU",
      diameter: "About 4.5 km (Goldstone radar 2017); NEOWISE albedo 0.23",
      rotationPeriod: "2.358 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "S-type: silicate rock with iron-nickel grains",
      roughness: "Radar: a ridge, many small craters and boulders",
      description: "One of the largest near-Earth asteroids to pass this close: on 1 September 2017 it came within 7 million km, its closest since 1890, and radar at Goldstone found it is a triple — two small moons going round it, every 8 hours and every day or so. It will not pass this close again until after 2500. Named for Florence Nightingale.",
    },
  },
  {
    id: "betulia",
    name: "Betulia",
    family: "amor",
    spectralType: "C (carbon-rich)",
    meshDetail: 0.55,
    designation: "1580 Betulia (1950 KA)",
    classification: "Near-Earth asteroid · Amor · dark, carbon-rich (C), steeply tilted",
    detail: "Tilted 52° to the planets | radar 2002 and 2021",
    diameterKm: 5.8,
    diameterLabel: "5.8 km (Tedesco 1994)",
    albedo: 0.08,
    chroma: fromBV(0.656),
    rotationHours: 6.1324,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbit(404, { aAU: 2.194758150794741, e: 0.4876366719217214, iDeg: 52.19064411030264, nodeDeg: 62.22083601961318, argPeriDeg: 159.7072540224905, meanAnomalyDeg: 140.9091405528516 }),
    shape: { ...C_RUBBLE, lobes: ellipsoid(6.4, 5.9, 5.2), craterCount: 30, seed: 1580 },
    surfaceEvidence: "Arecibo radar (Magri et al. 2007). Never imaged; drawn as a dark carbon-rich rubble pile",
    info: {
      population: "Near-Earth asteroids · Amor group, 1.12-3.27 AU",
      diameter: "5.8 km, albedo 0.08 (Tedesco 1994)",
      rotationPeriod: "6.13 h (LCDB)",
      gravity: "Not measured",
      surfaceEvidence: "C-type: dark, carbon-bearing rock (B-V 0.66)",
      roughness: "Radar: a rough surface with a large concavity",
      description: "A dark, carbon-rich Amor about 6 km across on one of the most steeply tilted near-Earth orbits — 52° to the plane of the planets. Found by Ernest Johnson in South Africa in 1950 and named for Betulia Toro, the wife of Samuel Herrick (Toro's namesake too).",
    },
  },
  {
    id: "1986da",
    name: "1986 DA",
    family: "amor",
    spectralType: "M (metal) — about 85% iron-nickel",
    meshDetail: 0.55,
    designation: "6178 (1986 DA)",
    classification: "Near-Earth asteroid · Amor · metal: about 85% iron-nickel",
    detail: "Radar bounced off metal | Ostro et al. 1991",
    diameterKm: 2.8,
    diameterLabel: "2.8 ± 0.4 km (Harris & Drube 2014)",
    albedo: 0.096,
    /* Nickel-silver with a faint bronze cast: a neutral-to-warm grey. */
    chroma: [1.04, 1.0, 0.95],
    rotationHours: 3.5002,
    rotationState: "principal-axis",
    /* Round 38: metal, so a metallic material with a lower roughness than
     * the builder's rock default (`createSmallBodyMaterial`). */
    metalness: 0.85,
    roughness: 0.4,
    orbit: orbit(240, { aAU: 2.813340461489325, e: 0.5850216210438263, iDeg: 4.315057068045602, nodeDeg: 64.46520358832409, argPeriDeg: 127.4782601047586, meanAnomalyDeg: 180.1192869142985 }),
    /* "A nonconvex irregular shape, possibly bifurcated" (Ostro et al.
     * 1991): two lobes; scoop-like depressions, not bowl craters. */
    shape: { ...M_METAL, blend: "smooth", lobes: [
      { c: [-0.7, 0, 0], r: [1.1, 0.9, 1.0] },
      { c: [0.8, 0.05, 0], r: [0.95, 0.8, 0.9] },
    ], bigCraters: SCOOPS, seed: 6178 },
    surfaceEvidence: "Arecibo radar: the strongest radar echo of any asteroid then known, the signature of metal (Ostro et al. 1991). Spectrum: about 85% metal, 15% pyroxene (Sanchez et al. 2021). Surface generated",
    info: {
      population: "Near-Earth asteroids · Amor group, 1.17-4.46 AU",
      diameter: "2.8 ± 0.4 km, albedo 0.096 (Harris & Drube 2014)",
      rotationPeriod: "3.50 h (LCDB)",
      gravity: "Surface bulk density about 3.8 g/cm³ from radar (Sanchez et al. 2021)",
      surfaceEvidence: "M-type metal: about 85% iron-nickel and 15% pyroxene, like a stony-iron meteorite",
      roughness: "Radar: extremely irregular at the 10-100 m scale (Ostro et al. 1991)",
      description: "A small mountain of metal. Radar at Arecibo in 1986 bounced back far more strongly than off rock — the signature of iron and nickel — and a 2021 study of its spectrum put it at about 85% metal. It is probably a piece of the core of a body that melted and separated early in the Solar System's history, broken out by collisions. Its iron, nickel, cobalt and platinum-group metals have been estimated to be worth more than the world's known reserves — an estimate, not a plan.",
    },
  },
];

/* Each card's speed now, from its own elements (catalogueHelpers.js). */
/* `cullTiny`: skip drawing while under half a pixel (smallBodies.js). */
export const NEAR_EARTH_FAMILY_ROCKS = Object.freeze(RECORDS.map((r) => withSpeedNow({ ...r, cullTiny: true })));

/* Named range for a record, used by the board (q-Q). */
export const familyRange = (record) => range(record.orbit);

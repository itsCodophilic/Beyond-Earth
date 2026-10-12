/**
 * The asteroid families' namesakes that were not yet drawn.
 *
 * Round 38, second pass (Prompts.md: "the families mentioned in the
 * dashboard which are eos, themis, koronis etc.. all of them which are named
 * must also be listed at the bottom for an option to fly there"). The
 * Kirkwood view (ui/explainers/belt.js) names eight families. Vesta and
 * Hygiea are drawn in the frozen belt, Eunomia is a Rank 2 world, and Ida
 * (a Koronis member) and Gaspra (a Flora member) are Rank 1 bodies. The
 * other six namesakes -- Flora, Nysa, Polana, Koronis, Eos and Themis --
 * are drawn here so that every family has a body to fly to.
 *
 * Provenance: JPL Small-Body Database (`sbdb.api`, full precision,
 * physical parameters), queried 10 October 2026; every element set at JD
 * 2461200.5 and each record names its orbit solution. Diameters and
 * albedos are NEOWISE (Mainzer et al. 2014) except Nysa's diameter (IRAS)
 * and Themis's (IRTF, J.G. Williams 1990), as SBDB gives them; rotation
 * periods from the LCDB; colours from each body's measured B-V; types from
 * the Tholen and SMASSII taxonomies. None has been resolved, so every shape
 * is a chosen ellipsoid at the measured size and every surface is borrowed
 * relief (tools/small-body-textures), as each card says.
 */
import { brFromBV, chromaFromBR, ellipsoid, orbitOf, withSpeedNow } from "./catalogueHelpers.js";

const SBDB = (solution) => `JPL SBDB orbit solution ${solution}, epoch JD 2461200.5, queried 10 October 2026`;
const orbit = (solution, el) => orbitOf(SBDB(solution), { epochJD: 2461200.5, ...el });
const fromBV = (bv) => chromaFromBR(brFromBV(bv));
const period = (n) => `${(360 / n / 365.25).toFixed(2)} years`;

const RECORDS = [
  {
    id: "flora",
    name: "Flora",
    designation: "8 Flora (A847 UA)",
    classification: "Main-belt asteroid · S-type · Flora family",
    detail: "Parent of the Flora family | found by J. R. Hind, 1847",
    diameterKm: 147.491,
    diameterLabel: "147.5 ± 1.0 km (NEOWISE)",
    albedo: 0.226,
    chroma: fromBV(0.885),
    rotationHours: 12.865,
    rotationState: "principal-axis",
    metalness: 0.02,
    meshDetail: 0.6,
    orbit: orbit(152, { aAU: 2.201560614294881, e: 0.1561964033906808, iDeg: 5.890315098602565, nodeDeg: 110.8433074868032, argPeriDeg: 285.408347619081, meanAnomalyDeg: 259.2621317520155, meanMotionDegPerDay: 0.30172278183574 }),
    /* Chosen proportions, 1.12 : 1 : 0.9. */
    shape: { lobes: ellipsoid(160, 143, 129), neck: 1, relief: 0.03, grain: 0.011, craterCount: 120, craterMin: 0.018, craterMax: 0.12, craterDepth: 0.022, boulders: 0, seed: 8 },
    surfaceEvidence: "A point of light. Size and albedo from NEOWISE; relief borrowed from Ida (S-type)",
    info: {
      population: "Main asteroid belt · Flora family, inner belt, 1.86-2.54 AU",
      diameter: "147.5 ± 1.0 km, albedo 0.23 (NEOWISE, Mainzer et al. 2014)",
      rotationPeriod: "12.865 h (LCDB)",
      orbitalSpeed: `One orbit takes ${period(0.30172278183574)}`,
      gravity: "Not measured",
      surfaceEvidence: "S-type (Tholen): stony, B-V 0.885",
      roughness: "unknown",
      description: "The largest body of the Flora family, one of the oldest and most spread-out families in the inner belt, right beside the ν6 resonance that feeds rocks towards Earth. Gaspra, which Galileo photographed in 1991, is one of its members, and the family may be where many LL-chondrite meteorites — the kind Itokawa turned out to be made of — come from (Vernazza et al. 2008). Found by John Russell Hind in London in 1847.",
    },
  },
  {
    id: "nysa",
    name: "Nysa",
    designation: "44 Nysa (A857 KA)",
    classification: "Main-belt asteroid · E-type · Nysa–Polana complex",
    detail: "A very bright enstatite asteroid | found by H. Goldschmidt, 1857",
    diameterKm: 70.64,
    diameterLabel: "70.6 ± 4.0 km (IRAS)",
    albedo: 0.482,
    chroma: fromBV(0.703),
    rotationHours: 6.422,
    rotationState: "principal-axis",
    metalness: 0.02,
    meshDetail: 0.55,
    orbit: orbit(151, { aAU: 2.422499624292143, e: 0.1496735116405386, iDeg: 3.713137130620973, nodeDeg: 131.4762396518531, argPeriDeg: 343.8930847472048, meanAnomalyDeg: 41.45745492537208, meanMotionDegPerDay: 0.2614017533885556 }),
    /* Its lightcurve has a large amplitude: drawn elongated, 1.45 : 1. */
    shape: { lobes: ellipsoid(92, 64, 58), neck: 1, relief: 0.025, grain: 0.009, craterCount: 70, craterMin: 0.02, craterMax: 0.12, craterDepth: 0.02, boulders: 0, seed: 44 },
    surfaceEvidence: "A point of light; type from its spectrum (E / Xc). Relief borrowed from Itokawa, softened",
    info: {
      population: "Main asteroid belt · Nysa–Polana complex, 2.06-2.78 AU",
      diameter: "70.6 ± 4.0 km (IRAS); albedo 0.48 (NEOWISE)",
      rotationPeriod: "6.422 h (LCDB)",
      orbitalSpeed: `One orbit takes ${period(0.2614017533885556)}`,
      gravity: "Not measured",
      surfaceEvidence: "E-type (Tholen), Xc (SMASSII): enstatite, nearly iron-free silicate",
      roughness: "unknown",
      description: "One of the brightest asteroids for its size — nearly half the light on it is reflected — because it is made of enstatite, like the aubrite meteorites. It gives its name to half of the Nysa–Polana complex: two families lying on top of each other in the inner belt, one bright (Nysa's) and one very dark (Polana's), which were long counted as one. Found by Hermann Goldschmidt in Paris in 1857.",
    },
  },
  {
    id: "polana",
    name: "Polana",
    designation: "142 Polana (A875 BA)",
    classification: "Main-belt asteroid · F / B-type · Nysa–Polana complex",
    detail: "The dark family Bennu and Ryugu probably came from | Palisa, 1875",
    diameterKm: 54.812,
    diameterLabel: "54.8 km (NEOWISE)",
    albedo: 0.047,
    chroma: fromBV(0.621),
    rotationHours: 9.764,
    rotationState: "principal-axis",
    metalness: 0,
    meshDetail: 0.55,
    orbit: orbit(78, { aAU: 2.419192123784419, e: 0.1328207882615142, iDeg: 2.242554209440512, nodeDeg: 291.0582934673843, argPeriDeg: 292.6747995110621, meanAnomalyDeg: 3.501640779154536, meanMotionDegPerDay: 0.2619380162199745 }),
    shape: { lobes: ellipsoid(60, 55, 50), neck: 1, relief: 0.03, grain: 0.012, craterCount: 90, craterMin: 0.02, craterMax: 0.15, craterDepth: 0.026, boulders: 0, seed: 142 },
    surfaceEvidence: "A point of light; dark and blue-grey (F / B-type). Relief borrowed from Mathilde",
    info: {
      population: "Main asteroid belt · Nysa–Polana complex, 2.10-2.74 AU",
      diameter: "54.8 km, albedo 0.047 (NEOWISE)",
      rotationPeriod: "9.764 h (LCDB)",
      orbitalSpeed: `One orbit takes ${period(0.2619380162199745)}`,
      gravity: "Not measured",
      surfaceEvidence: "F-type (Tholen), B (SMASSII): dark carbonaceous rock, slightly bluish (B-V 0.62)",
      roughness: "unknown",
      description: "A dark, carbon-rich body, the largest of the Polana family — the dark half of the Nysa–Polana complex. Its family is one of the two most likely birthplaces of Bennu and Ryugu, the two asteroids sampled by spacecraft (Campins et al. 2010; Bottke et al. 2015): they were probably knocked out of it and drifted into near-Earth orbits. Found by Johann Palisa at Pola in 1875, and named after that town.",
    },
  },
  {
    id: "koronis",
    name: "Koronis",
    designation: "158 Koronis (A876 BA)",
    classification: "Main-belt asteroid · S-type · Koronis family",
    detail: "Parent of Ida's family | found by V. Knorre, 1876",
    diameterKm: 39.025,
    diameterLabel: "39.0 ± 0.5 km (NEOWISE)",
    albedo: 0.213,
    chroma: fromBV(0.859),
    rotationHours: 14.218,
    rotationState: "principal-axis",
    metalness: 0.02,
    meshDetail: 0.55,
    orbit: orbit(77, { aAU: 2.868732356988836, e: 0.05371702297731352, iDeg: 1.005618864673534, nodeDeg: 277.6458942221435, argPeriDeg: 147.68536466, meanAnomalyDeg: 20.32255826969589, meanMotionDegPerDay: 0.2028472040624391 }),
    shape: { lobes: ellipsoid(48, 37, 33), neck: 1, relief: 0.035, grain: 0.012, craterCount: 110, craterMin: 0.02, craterMax: 0.15, craterDepth: 0.025, boulders: 0, seed: 158 },
    surfaceEvidence: "A point of light; S-type. Relief borrowed from Ida, its family's photographed member",
    info: {
      population: "Main asteroid belt · Koronis family, 2.72-3.02 AU",
      diameter: "39.0 ± 0.5 km, albedo 0.21 (NEOWISE)",
      rotationPeriod: "14.218 h (LCDB)",
      orbitalSpeed: `One orbit takes ${period(0.2028472040624391)}`,
      gravity: "Not measured",
      surfaceEvidence: "S-type (Tholen and SMASSII): stony, B-V 0.86",
      roughness: "unknown",
      description: "The namesake of the Koronis family, the pieces of a stony body broken up perhaps two billion years ago. Ida, which Galileo photographed in 1993 with its moon Dactyl, is one of them. The family is famous for a strange order in its spins: many of its members' spin axes point the same way, lined up over billions of years by sunlight's slow push (Slivan 2002; Vokrouhlický et al. 2003). Found by Viktor Knorre in Berlin in 1876.",
    },
  },
  {
    id: "eos",
    name: "Eos",
    designation: "221 Eos (A882 BA)",
    classification: "Main-belt asteroid · K-type · Eos family",
    detail: "Parent of a rare-rock family | found by J. Palisa, 1882",
    diameterKm: 95.469,
    diameterLabel: "95.5 ± 1.7 km (NEOWISE)",
    albedo: 0.166,
    chroma: fromBV(0.768),
    rotationHours: 10.443,
    rotationState: "principal-axis",
    metalness: 0.02,
    meshDetail: 0.55,
    orbit: orbit(76, { aAU: 3.011901179820204, e: 0.1008881723322702, iDeg: 10.89071954273448, nodeDeg: 141.7109999877788, argPeriDeg: 192.428954778228, meanAnomalyDeg: 26.70213169054731, meanMotionDegPerDay: 0.1885571459584167 }),
    shape: { lobes: ellipsoid(112, 92, 84), neck: 1, relief: 0.03, grain: 0.011, craterCount: 110, craterMin: 0.02, craterMax: 0.13, craterDepth: 0.022, boulders: 0, seed: 221 },
    surfaceEvidence: "A point of light; K-type. Relief borrowed from Eros",
    info: {
      population: "Main asteroid belt · Eos family, 2.71-3.31 AU",
      diameter: "95.5 ± 1.7 km, albedo 0.17 (NEOWISE)",
      rotationPeriod: "10.443 h (LCDB)",
      orbitalSpeed: `One orbit takes ${period(0.1885571459584167)}`,
      gravity: "Not measured",
      surfaceEvidence: "S (Tholen), K (SMASSII): between stony and carbonaceous",
      roughness: "unknown",
      description: "The largest of the Eos family, whose members are mostly of the uncommon K type — between the stony and the carbon-rich kinds, and a match for CO and CV carbonaceous chondrite meteorites (Mothé-Diniz et al. 2005). The family's rock suggests its parent body had partly melted and separated inside before it broke up. Found by Johann Palisa in Vienna in 1882 and named for the Greek goddess of the dawn.",
    },
  },
  {
    id: "themis",
    name: "Themis",
    designation: "24 Themis (A853 GA)",
    classification: "Main-belt asteroid · C / B-type · Themis family",
    detail: "Water ice on its surface | Rivkin & Emery 2010; Campins et al. 2010",
    diameterKm: 198,
    diameterLabel: "198 km (IRTF, albedo 0.067)",
    albedo: 0.067,
    chroma: fromBV(0.684),
    rotationHours: 8.374,
    rotationState: "principal-axis",
    metalness: 0,
    meshDetail: 0.65,
    orbit: orbit(154, { aAU: 3.143997721720467, e: 0.115379978796777, iDeg: 0.7366196417446064, nodeDeg: 36.39075346960584, argPeriDeg: 109.2217643897621, meanAnomalyDeg: 92.01695639431603, meanMotionDegPerDay: 0.1767993809007035 }),
    shape: { lobes: ellipsoid(210, 196, 186), neck: 1, relief: 0.028, grain: 0.011, craterCount: 120, craterMin: 0.018, craterMax: 0.14, craterDepth: 0.024, boulders: 0, seed: 24 },
    surfaceEvidence: "A point of light. Water ice and organic compounds detected in its spectrum (Rivkin & Emery 2010; Campins et al. 2010). Relief borrowed from Mathilde",
    info: {
      population: "Main asteroid belt · Themis family, outer belt, 2.78-3.51 AU",
      diameter: "198 km at an IRTF albedo of 0.067 (J. G. Williams 1990, via SBDB)",
      rotationPeriod: "8.374 h (LCDB)",
      orbitalSpeed: `One orbit takes ${period(0.1767993809007035)}`,
      gravity: "Not measured",
      surfaceEvidence: "C (Tholen), B (SMASSII): dark carbonaceous rock with a thin frost of water ice and organic compounds",
      roughness: "unknown",
      description: "In 2010 two teams found water ice spread thinly over the whole surface of Themis, and organic compounds with it (Rivkin & Emery 2010; Campins et al. 2010, Nature 464) — the first ice found on an asteroid. Ice cannot last long on a bare surface 3 AU from the Sun, so it must be replenished from inside. Its family includes the first known main-belt comets, rocks that sprout tails when they warm up (Hsieh & Jewitt 2006). Found by Annibale de Gasparis in Naples in 1853.",
    },
  },
];

/* `cullTiny`: skip drawing while under half a pixel (smallBodies.js). */
export const FAMILY_NAMESAKES = Object.freeze(RECORDS.map((r) => withSpeedNow({ ...r, cullTiny: true })));

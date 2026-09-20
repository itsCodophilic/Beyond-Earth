/**
 * The eleven largest main-belt worlds that no spacecraft has ever visited.
 *
 * Rank 2 of `docs/bodies-to-draw-next.md`. Rank 1 was the bodies with a
 * photograph; these are the ones with a *disc* -- resolved by the VLT's
 * SPHERE instrument into images twenty to sixty pixels across, which is
 * enough for a shape and nowhere near enough for a surface.
 *
 * ## What that difference means for how they are drawn
 *
 * Every Rank 1 body in `smallBodyCatalogue.js` has a published shape model
 * built from spacecraft stereo, and a surface grown from a real photograph
 * of that body. These have neither. What they do have, from Vernazza et al.
 * 2021 (A&A 654, A56) and the papers around it, is a genuine tri-axial
 * ellipsoid measured from deconvolved adaptive-optics imaging -- so the
 * *proportions* here are real even though the craters are not.
 *
 * So the rule for this file is: shape and size and orbit and albedo are
 * measured; relief is borrowed from the nearest spectral analogue that *was*
 * visited, and every card says so. An S-type takes Ida's and Gaspra's
 * regolith, a C-type takes Mathilde's, an M/X-type takes Lutetia's. That is
 * the same bargain `tools/small-body-textures` already strikes for the six
 * Rank 1 bodies whose photographs never arrived, and it is the honest one:
 * a surface invented from nothing would be a lie, and a surface borrowed
 * from the right class of body is a stated approximation.
 *
 * ## Provenance
 *
 * Orbital elements: JPL Small-Body Database, queried 20 September 2026, at
 * full precision, all at the same epoch as the Rank 1 set -- JD 2461200.5,
 * 9 June 2026. Each record names its orbit solution number.
 *
 * Mean motion is computed from the semi-major axis as
 * n = 0.9856002628 * a^-1.5 deg/day rather than being quoted. Where JPL's
 * own `n` was fetched for comparison -- 704 and 216 -- the two agree to
 * seven significant figures, and the propagation from epoch to today is
 * about a hundred days, so the difference is far below a pixel.
 *
 * Diameters, albedos, rotation periods and spectral types: JPL SBDB physical
 * parameters, same query. Tri-axial dimensions and densities: the SPHERE
 * survey and the individual papers, cited per body.
 *
 * ## Satellites
 *
 * Six, on four parents. Sylvia was the first triple asteroid ever found and
 * Kleopatra is a dog-bone with two of its own, which is most of why either
 * is worth drawing. Where a satellite's orbit is published as a period
 * rather than a distance -- Kleopatra's pair -- the semi-major axis is
 * derived from the system mass through Kepler's third law, stated in the
 * record, because a drawn separation has to be consistent with the drawn
 * orbital speed or the pair will not look like it is orbiting anything.
 *
 * 107 Camilla has two satellites and neither is drawn. S/2001 (107) 1 and
 * S/2016 (107) 1 are real, but the orbit solutions available here disagree
 * with each other by enough that drawing one would be inventing it. Its card
 * says they exist and that this scene does not show them, which is better
 * than a moon in the wrong place.
 */

/*
 * Colour, by spectral class rather than by body.
 *
 * The Rank 1 chroma table is measured per body from published colour
 * indices. These eleven do not all have one, so each takes the
 * class-typical B-V and the cards say "class-typical" rather than
 * implying a measurement of that object. Solar B-V is 0.65, so the
 * difference from 0.65 is how much redder than sunlight the body is, and
 * these triples are that difference expressed as a reflectance ratio
 * normalised to a mean of one.
 *
 * ## They were too weak, and were strengthened
 *
 * The first set was a literal conversion of the colour index, and on screen
 * under tone mapping it produced eleven bodies that were all, visibly, the
 * same grey -- reported as "their color their surface texture are so so so
 * much same". The separation between an S-type at B-V 0.85 and a C-type at
 * 0.70 is real, and it is what every NASA release of Eros or Ida or Gaspra
 * shows plainly; it was being thrown away between the colour index and the
 * pixel.
 *
 * So the *hue direction* of each class is unchanged -- S is warm, B is cool,
 * P is warmest and darkest -- and the saturation is pushed roughly 1.6x, to
 * where the difference survives an ACES curve. That is a rendering decision
 * about a quantity the table only ever claimed to know to a class, and it is
 * stated here rather than hidden. The measured per-body triples in
 * `smallBodyCatalogue.js` are not touched by this.
 */
const CLASS_CHROMA = Object.freeze({
  /* S-type. Silicate, space-weathered, and the warmest class in the belt --
   * this is the butterscotch of Eros and Ida in every NEAR and Galileo
   * release. B-V about 0.85 against the Sun's 0.65. */
  S: [1.190, 0.985, 0.735],
  /* C-type. Nearly neutral with a warm cast; dark rather than coloured. */
  C: [1.048, 1.000, 0.930],
  /* B-type: the one class *bluer* than sunlight, with a spectrum that keeps
   * falling into the near infrared. Interamnia. */
  B: [0.962, 1.000, 1.048],
  /* M/X-type. Metal reads warm and flat -- measured on Lutetia at
   * [1.052, 0.992, 0.923], pushed a little past it because these are the
   * metal-richest bodies in the belt and Lutetia is only borderline M. */
  X: [1.085, 0.990, 0.885],
  /* P-type. The darkest and reddest of the belt classes; Cybele's is
   * organic-rich primitive material, closer to a comet than to a rock. */
  P: [1.140, 0.980, 0.830],
});
/* n = 0.9856002628 * a^-1.5 deg/day. See the provenance note. */
const meanMotion = (aAU) => 0.9856002628 / (aAU ** 1.5);

/* One ellipsoid, from published tri-axial *diameters* a >= b >= c in km.
 * The builder wants semi-axes, and its y axis is the spin axis, which for a
 * relaxed body is the shortest -- so the order is [a/2, c/2, b/2]. */
const ellipsoid = (a, b, c) => [{ c: [0, 0, 0], r: [a / 2, c / 2, b / 2] }];

export const MAIN_BELT_WORLDS = Object.freeze([
  {
    id: "interamnia",
    name: "Interamnia",
    designation: "704 Interamnia (A910 TC)",
    classification: "Main-belt asteroid · B-type (Tholen F)",
    detail: "Largest unvisited main-belt body | VLT/SPHERE, 2017-2019",
    diameterKm: 332,
    diameterLabel: "362 × 348 × 310 ± 8 km; 332 ± 6 km volume-equivalent",
    albedo: 0.078,
    chroma: CLASS_CHROMA.B,
    rotationHours: 8.727,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 179, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.056811711282865,
      e: 0.1550586536072489,
      iDeg: 17.31528178196839,
      nodeDeg: 280.1672242333686,
      argPeriDeg: 94.06172596616008,
      meanAnomalyDeg: 221.144848377515,
      meanMotionDegPerDay: meanMotion(3.056811711282865),
    },
    /* Nearly round, and that is the point: at 332 km it sits right at the
     * size where self-gravity starts winning, and SPHERE found it within 8%
     * of a sphere in every direction. Relief borrowed from Mathilde, the
     * nearest visited carbonaceous body. */
    shape: {
      lobes: ellipsoid(362, 348, 310),
      neck: 1,
      relief: 0.020,
      grain: 0.008,
      craterCount: 96,
      craterMin: 0.020,
      craterMax: 0.110,
      craterDepth: 0.016,
      boulders: 0,
      seed: 704,
    },
    surfaceEvidence: "VLT/SPHERE ZIMPOL adaptive-optics imaging, 2017-2019, deconvolved to about 20 mas — Hanuš et al. 2020, A&A 633, A65. No spacecraft has ever been near it",
    info: {
      population: "Main asteroid belt · outer belt, 2.58-3.53 AU",
      diameter: "362 × 348 × 310 ± 8 km, 332 ± 6 km volume-equivalent — VLT/SPHERE, Hanuš et al. 2020",
      rotationPeriod: "8.727 h — JPL SBDB physical parameters",
      orbitalSpeed: "16.9 km/s · one orbit takes 5.34 years — from the JPL element set",
      gravity: "Density 1.84 ± 0.28 g/cm³; escape velocity ≈ 180 m/s — Hanuš et al. 2020",
      surfaceEvidence: "Resolved only as a disc 20-60 pixels across by VLT/SPHERE. The shape is measured; the surface detail here is borrowed from Mathilde, the nearest carbonaceous body anyone has photographed",
      roughness: "unknown — no image resolves a crater on it",
      description:
        "The largest body in the asteroid belt that no spacecraft has been near, and the fifth largest of any kind: only Ceres, Vesta, Pallas and Hygiea beat it. It is also the largest that is not a dwarf planet candidate, which is a close-run thing — SPHERE measured it at 362 by 310 km, within eight per cent of round, and a body that nearly relaxed is a body that nearly qualified. Its density of 1.84 says it is porous and icy rather than rock, and its B-type spectrum is one of the few in the belt that is *bluer* than sunlight. Discovered from Teramo in 1910 and named for the town's Latin name; still, more than a century later, a disc rather than a world.",
    },
  },
  {
    id: "europa-asteroid",
    name: "52 Europa",
    designation: "52 Europa (A858 SA)",
    classification: "Main-belt asteroid · C-type",
    detail: "Sixth-largest asteroid | VLT/SPHERE and Keck",
    diameterKm: 315,
    diameterLabel: "379 × 330 × 249 km; 315 ± 7 km volume-equivalent",
    albedo: 0.057,
    chroma: CLASS_CHROMA.C,
    rotationHours: 5.6304,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 138, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.094135859941014,
      e: 0.1124826698655506,
      iDeg: 7.481504555174181,
      nodeDeg: 128.5733918853921,
      argPeriDeg: 342.8039959999205,
      meanAnomalyDeg: 348.9227964095758,
      meanMotionDegPerDay: meanMotion(3.094135859941014),
    },
    shape: {
      lobes: ellipsoid(379, 330, 249),
      neck: 1,
      relief: 0.024,
      grain: 0.009,
      craterCount: 104,
      craterMin: 0.022,
      craterMax: 0.130,
      craterDepth: 0.019,
      boulders: 0,
      seed: 52,
    },
    surfaceEvidence: "Keck II adaptive optics, Merline et al. 2013, and the VLT/SPHERE survey. Not visited",
    info: {
      population: "Main asteroid belt · outer belt, 2.75-3.44 AU",
      diameter: "379 × 330 × 249 km, 315 ± 7 km volume-equivalent — Merline et al. 2013",
      rotationPeriod: "5.6304 h — JPL SBDB physical parameters",
      orbitalSpeed: "16.8 km/s · one orbit takes 5.44 years",
      gravity: "Density 1.41 ± 0.23 g/cm³, among the lowest measured for a large asteroid",
      surfaceEvidence: "A resolved disc only. Relief borrowed from Mathilde, the nearest imaged C-type",
      roughness: "unknown",
      description:
        "Not the moon — this is 52 Europa, found in 1858 and named before anyone worried about the collision. It is the sixth-largest asteroid and one of the least dense large bodies known at 1.41 g/cm³, which means a great deal of it is empty space or ice. Adaptive optics resolved a markedly triaxial shape, 379 km along its longest axis and 249 across its shortest, too irregular for a body this size to have relaxed. It reflects 5.7 per cent of the light that reaches it.",
    },
  },
  {
    id: "davida",
    name: "Davida",
    designation: "511 Davida (A903 KB)",
    classification: "Main-belt asteroid · C-type",
    detail: "Seventh-largest asteroid | VLT/SPHERE, Vernazza et al. 2021",
    diameterKm: 298,
    diameterLabel: "357 × 294 × 231 km; 298 ± 4 km volume-equivalent",
    albedo: 0.076,
    chroma: CLASS_CHROMA.C,
    rotationHours: 5.1297,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 181, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.161792846903028,
      e: 0.1893732654213308,
      iDeg: 15.94980163416854,
      nodeDeg: 107.5541377792688,
      argPeriDeg: 336.5298509620977,
      meanAnomalyDeg: 70.43603818535601,
      meanMotionDegPerDay: meanMotion(3.161792846903028),
    },
    shape: {
      lobes: ellipsoid(357, 294, 231),
      neck: 1,
      relief: 0.026,
      grain: 0.009,
      craterCount: 112,
      craterMin: 0.020,
      craterMax: 0.140,
      craterDepth: 0.020,
      /* SPHERE resolved a single very large depression on the southern
       * hemisphere, the one surface feature anybody has ever seen on it. */
      bigCraters: [{ dir: [0.18, -0.72, 0.67], radius: 0.33, depth: 0.045, rim: 0.010 }],
      boulders: 0,
      seed: 511,
    },
    surfaceEvidence: "VLT/SPHERE, Vernazza et al. 2021, A&A 654, A56. Not visited",
    info: {
      population: "Main asteroid belt · outer belt, 2.56-3.76 AU",
      diameter: "357 × 294 × 231 km, 298 ± 4 km volume-equivalent — Vernazza et al. 2021",
      rotationPeriod: "5.1297 h — JPL SBDB physical parameters",
      orbitalSpeed: "16.6 km/s · one orbit takes 5.62 years",
      gravity: "Density 1.92 ± 0.53 g/cm³ — Vernazza et al. 2021",
      surfaceEvidence: "A resolved disc. SPHERE found one very large depression in the south; everything finer here is borrowed from Mathilde",
      roughness: "unknown, beyond one large basin",
      description:
        "Seventh-largest asteroid and, for a while after its 1903 discovery, a candidate for the largest that nobody had properly measured. SPHERE finally resolved it in 2021: 357 km long, 231 km through the short axis, and carrying one enormous depression in the southern hemisphere — the only individual feature ever seen on its surface. It is a C-type, dark at 7.6 per cent reflectance, and it swings between 2.56 and 3.76 AU on an orbit tilted 16° out of the plane.",
    },
  },
  {
    id: "sylvia",
    name: "Sylvia",
    designation: "87 Sylvia (A866 KA)",
    classification: "Main-belt asteroid · X-type · first known triple",
    detail: "Triple system | Romulus 2001, Remus 2004",
    diameterKm: 274,
    diameterLabel: "374 × 248 × 194 ± 5 km; 274 ± 5 km volume-equivalent",
    albedo: 0.046,
    chroma: CLASS_CHROMA.X,
    rotationHours: 5.183641,
    rotationState: "principal-axis",
    metalness: 0.04,
    orbit: {
      solution: "JPL SBDB orbit solution 190, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.490930821312107,
      e: 0.09424185252826336,
      iDeg: 10.84931414002298,
      nodeDeg: 72.94598366200401,
      argPeriDeg: 267.1015444388611,
      meanAnomalyDeg: 123.9199379392146,
      meanMotionDegPerDay: meanMotion(3.490930821312107),
    },
    shape: {
      lobes: ellipsoid(374, 248, 194),
      neck: 1,
      relief: 0.030,
      grain: 0.010,
      craterCount: 120,
      craterMin: 0.020,
      craterMax: 0.125,
      craterDepth: 0.022,
      boulders: 0,
      seed: 87,
    },
    moons: [
      {
        name: "Romulus",
        designation: "(87) Sylvia I Romulus",
        classification: "Natural satellite · outer moon of the first known triple",
        diameterLabel: "23.1 ± 0.7 km",
        diameterKm: 23.1,
        separationKm: 1340.6,
        periodHours: 87.39024,
        inclinationDeg: 8.0,
        albedo: 0.046,
        shape: {
          lobes: [{ c: [0, 0, 0], r: [13.0, 10.6, 11.8] }],
          neck: 1,
          relief: 0.052,
          grain: 0.024,
          craterCount: 16,
          craterMin: 0.06,
          craterMax: 0.24,
          craterDepth: 0.038,
          boulders: 0,
          seed: 8701,
        },
        info: {
          diameter: "23.1 ± 0.7 km",
          rotationPeriod: "Unknown; assumed synchronous here, which is the usual state for a moon this close",
          orbitalSpeed: "About 27 m/s around Sylvia",
          surfaceEvidence: "Keck II adaptive optics, discovered 18 February 2001 by Brown and Margot; orbit refined by later VLT campaigns. No image has ever resolved its surface; the shape drawn here is a smooth ellipsoid at the measured size",
          description: "The outer of Sylvia's two moons and the larger, 23 km across, going round once every 3.64 days at 1,341 km. It was found in 2001 and named, with its twin, for the children of Rhea Silvia — the asteroid had carried her name since 1866. Weighing the two of them is what revealed that Sylvia is barely half solid.",
        },
      },
      {
        name: "Remus",
        designation: "(87) Sylvia II Remus",
        classification: "Natural satellite · inner moon of the first known triple",
        diameterLabel: "about 10 km",
        diameterKm: 10,
        separationKm: 694.2,
        periodHours: 32.568,
        inclinationDeg: 8.0,
        albedo: 0.046,
        shape: {
          lobes: [{ c: [0, 0, 0], r: [5.6, 4.6, 5.1] }],
          neck: 1,
          relief: 0.052,
          grain: 0.024,
          craterCount: 10,
          craterMin: 0.06,
          craterMax: 0.24,
          craterDepth: 0.038,
          boulders: 0,
          seed: 8702,
        },
        info: {
          diameter: "about 10 km",
          rotationPeriod: "Unknown",
          orbitalSpeed: "About 37 m/s around Sylvia",
          surfaceEvidence: "Discovered 9 August 2004 by Marchis, Descamps, Hestroffer and Berthier using the VLT. No image has ever resolved its surface; the shape drawn here is a smooth ellipsoid at the measured size",
          description: "The inner and smaller of the pair, roughly 10 km across at 694 km, going round in 1.36 days. Its discovery in 2004 made Sylvia the first asteroid known to have two moons — a triple system — and for several years it was the only one.",
        },
      },
    ],
    surfaceEvidence: "Keck and VLT adaptive optics; ADAM shape model, 1 July 2021 epoch. Not visited",
    info: {
      population: "Main asteroid belt · Cybele group, 3.16-3.82 AU",
      diameter: "374 × 248 × 194 ± 5 km, 274 ± 5 km volume-equivalent — ADAM shape model, 2021",
      rotationPeriod: "5.183641 ± 0.000039 h",
      orbitalSpeed: "15.8 km/s · one orbit takes 6.52 years",
      gravity: "Density 1.378 ± 0.045 g/cm³ — a rubble pile, more than half void",
      surfaceEvidence: "A resolved disc. Relief borrowed from Lutetia, the nearest imaged X-type",
      roughness: "unknown",
      description:
        "The first asteroid found to have two moons, and still the best-known triple. Romulus turned up in 2001 and Remus in 2004, both named for the twins Rhea Silvia bore — the asteroid was named for her in 1866, which made the naming almost inevitable. Their orbits are what weigh it: 1.378 g/cm³, which for a body of rock means more than half of it is empty space. Sylvia is a rubble pile 374 km long held together by nothing but its own gravity, and the two moons are very probably pieces of it that never got away.",
    },
  },
  {
    id: "eunomia",
    name: "Eunomia",
    designation: "15 Eunomia (A851 OA)",
    classification: "Main-belt asteroid · S-type",
    detail: "Largest S-type in the belt | VLT/SPHERE, Vernazza et al. 2021",
    diameterKm: 270,
    diameterLabel: "340 × 248 × 229 ± 14 km; 270 ± 3 km volume-equivalent",
    albedo: 0.248,
    chroma: CLASS_CHROMA.S,
    rotationHours: 6.083,
    rotationState: "principal-axis",
    metalness: 0.02,
    orbit: {
      solution: "JPL SBDB orbit solution 147, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.641958730730434,
      e: 0.1877707677912555,
      iDeg: 11.76139314431215,
      nodeDeg: 292.8807830122993,
      argPeriDeg: 98.46131825798194,
      meanAnomalyDeg: 159.6891049210672,
      meanMotionDegPerDay: meanMotion(2.641958730730434),
    },
    shape: {
      lobes: ellipsoid(340, 248, 229),
      neck: 1,
      relief: 0.028,
      grain: 0.010,
      craterCount: 118,
      craterMin: 0.018,
      craterMax: 0.115,
      craterDepth: 0.020,
      boulders: 0,
      seed: 15,
    },
    surfaceEvidence: "VLT/SPHERE, Vernazza et al. 2021, A&A 654, A56. Not visited",
    info: {
      population: "Main asteroid belt · Eunomia family, 2.15-3.14 AU",
      diameter: "340 × 248 × 229 ± 14 km, 270 ± 3 km volume-equivalent — Vernazza et al. 2021",
      rotationPeriod: "6.083 h — JPL SBDB physical parameters",
      orbitalSpeed: "18.2 km/s · one orbit takes 4.30 years",
      gravity: "Density 2.96 ± 0.21 g/cm³ — solid rock, unlike most of this list",
      surfaceEvidence: "A resolved disc. Relief borrowed from Ida, the nearest imaged S-type of comparable family",
      roughness: "unknown",
      description:
        "The largest stony asteroid in the belt, and the parent of a family of some five thousand fragments that carry its name. At 2.96 g/cm³ it is one of the few large asteroids that is actually solid rock rather than a pile of rubble — most of this list is half empty space. SPHERE resolved it as a distinctly elongated body, 340 km by 229, bright at nearly a quarter reflectance, which is what an unweathered silicate surface looks like beside the carbonaceous bodies around it.",
    },
  },
  {
    id: "euphrosyne",
    name: "Euphrosyne",
    designation: "31 Euphrosyne (A854 EA)",
    classification: "Main-belt asteroid · C-type",
    detail: "Steepest orbit of any large asteroid | VLT/SPHERE",
    diameterKm: 268,
    diameterLabel: "294 × 280 × 248 km; 268 ± 4 km volume-equivalent",
    albedo: 0.053,
    chroma: CLASS_CHROMA.C,
    rotationHours: 5.529595,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 155, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.161898681996629,
      e: 0.2157957592592173,
      iDeg: 26.30908762537488,
      nodeDeg: 30.78655626760269,
      argPeriDeg: 62.00909688426435,
      meanAnomalyDeg: 182.9145772062318,
      meanMotionDegPerDay: meanMotion(3.161898681996629),
    },
    shape: {
      lobes: ellipsoid(294, 280, 248),
      neck: 1,
      relief: 0.021,
      grain: 0.008,
      craterCount: 92,
      craterMin: 0.020,
      craterMax: 0.115,
      craterDepth: 0.017,
      boulders: 0,
      seed: 31,
    },
    moons: [
      {
        name: "S/2019 (31) 1",
        designation: "S/2019 (31) 1",
        classification: "Natural satellite · provisional designation only",
        diameterLabel: "about 4 km, assuming the primary's albedo",
        diameterKm: 4,
        separationKm: 670,
        periodHours: 28.8,
        inclinationDeg: 6.0,
        albedo: 0.053,
        shape: {
          lobes: [{ c: [0, 0, 0], r: [2.2, 1.8, 2.0] }],
          neck: 1,
          relief: 0.052,
          grain: 0.024,
          craterCount: 5,
          craterMin: 0.06,
          craterMax: 0.24,
          craterDepth: 0.038,
          boulders: 0,
          seed: 3101,
        },
        info: {
          diameter: "about 4 km, assuming the primary's albedo",
          rotationPeriod: "Unknown",
          orbitalSpeed: "About 14 m/s around Euphrosyne",
          surfaceEvidence: "Discovered 15 March 2019 in VLT/SPHERE imaging. No image has ever resolved its surface; the shape drawn here is a smooth ellipsoid at the measured size",
          description: "A four-kilometre companion found in the same SPHERE campaign that measured Euphrosyne's shape. It has no name yet, only a provisional designation. Its 1.2-day orbit at 670 km is what gives Euphrosyne a mass, and therefore a density.",
        },
      },
    ],
    surfaceEvidence: "VLT/SPHERE, 2019. Not visited",
    info: {
      population: "Main asteroid belt · Euphrosyne family, 2.48-3.85 AU",
      diameter: "294 × 280 × 248 km, 268 ± 4 km volume-equivalent — VLT/SPHERE",
      rotationPeriod: "5.529595 h",
      orbitalSpeed: "16.6 km/s · one orbit takes 5.62 years",
      gravity: "Density 1.64 ± 0.27 g/cm³",
      surfaceEvidence: "A resolved disc. Relief borrowed from Mathilde, the nearest imaged C-type",
      roughness: "unknown",
      description:
        "Its orbit is tilted 26° out of the plane of the Solar System, steeper than any other asteroid this size, and that tilt is the fossil of whatever smashed it apart — the Euphrosyne family it heads is one of the largest in the belt. SPHERE found it nearly round, 294 by 248 km, and found a four-kilometre moon beside it in 2019, which is how its mass was weighed. Dark at 5.3 per cent, and swinging from 2.48 to 3.85 AU.",
    },
  },
  {
    id: "cybele",
    name: "Cybele",
    designation: "65 Cybele (A861 EA)",
    classification: "Main-belt asteroid · P-type (SMASS Xc)",
    detail: "Namesake of the belt's outermost group",
    diameterKm: 263,
    diameterLabel: "297 × 291 × 213 km; 263 ± 3 km volume-equivalent",
    albedo: 0.0706,
    chroma: CLASS_CHROMA.P,
    rotationHours: 6.0814,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 141, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.407149089657219,
      e: 0.1278729312517013,
      iDeg: 3.565275404821638,
      nodeDeg: 155.0999502979274,
      argPeriDeg: 104.2270765148171,
      meanAnomalyDeg: 303.9032104989881,
      meanMotionDegPerDay: meanMotion(3.407149089657219),
    },
    shape: {
      lobes: ellipsoid(297, 291, 213),
      neck: 1,
      relief: 0.023,
      grain: 0.009,
      craterCount: 100,
      craterMin: 0.020,
      craterMax: 0.120,
      craterDepth: 0.018,
      boulders: 0,
      seed: 65,
    },
    surfaceEvidence: "Thermal modelling (Müller & Blommaert 2004) and adaptive optics. Not visited",
    info: {
      population: "Main asteroid belt · Cybele group, beyond the 2:1 resonance, 2.97-3.84 AU",
      diameter: "297 × 291 × 213 km, 263 ± 3 km volume-equivalent",
      rotationPeriod: "6.0814 ± 0.0001 h",
      orbitalSpeed: "15.9 km/s · one orbit takes 6.29 years",
      gravity: "Density 1.55 ± 0.19 g/cm³",
      surfaceEvidence: "Never resolved into surface detail. Relief borrowed from Mathilde; the colour is class-typical for a P-type rather than measured on this body",
      roughness: "unknown",
      description:
        "It names the group of asteroids that live beyond the 2:1 resonance with Jupiter, out where the belt thins into nothing. P-type: among the darkest and reddest material in the belt, primitive, organic-rich, closer in composition to a comet nucleus than to the stony asteroids further in. In 2010 two teams reported water ice and organics on its surface from the infrared, which if right makes it one of the very few asteroids with ice anyone has actually detected. Flat orbit — 3.6° — and slow, six and a quarter years for a lap.",
    },
  },
  {
    id: "juno",
    name: "Juno",
    designation: "3 Juno (A804 RA)",
    classification: "Main-belt asteroid · S-type (Sk)",
    detail: "Third asteroid ever found | VLT/SPHERE, 2021",
    diameterKm: 254,
    diameterLabel: "288 × 250 × 225 ± 5 km; 254 ± 2 km volume-equivalent",
    albedo: 0.214,
    chroma: CLASS_CHROMA.S,
    rotationHours: 7.21,
    rotationState: "principal-axis",
    metalness: 0.02,
    orbit: {
      solution: "JPL SBDB orbit solution 145, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.670989527103278,
      e: 0.2556999836681878,
      iDeg: 12.98659236598085,
      nodeDeg: 169.8115953492418,
      argPeriDeg: 247.8950743075613,
      meanAnomalyDeg: 262.7322944883855,
      meanMotionDegPerDay: meanMotion(2.670989527103278),
    },
    shape: {
      lobes: ellipsoid(288, 250, 225),
      neck: 1,
      relief: 0.027,
      grain: 0.010,
      craterCount: 108,
      craterMin: 0.018,
      craterMax: 0.120,
      craterDepth: 0.019,
      /* A 100 km bite out of one side, resolved from the ground in 2003 --
       * one of the first surface features ever seen on any asteroid from
       * Earth. Baliunas et al. 2003, using the Hooker telescope. */
      bigCraters: [{ dir: [0.62, 0.28, -0.73], radius: 0.36, depth: 0.052, rim: 0.012 }],
      boulders: 0,
      seed: 3,
    },
    surfaceEvidence: "VLT/SPHERE 2021; the large southern crater resolved by adaptive optics from the Hooker telescope in 2003. Not visited",
    info: {
      population: "Main asteroid belt · inner belt, 1.99-3.35 AU",
      diameter: "288 × 250 × 225 ± 5 km, 254 ± 2 km volume-equivalent — VLT/SPHERE, 2021",
      rotationPeriod: "7.21 h — JPL SBDB physical parameters",
      orbitalSpeed: "17.9 km/s · one orbit takes 4.37 years",
      gravity: "Density 3.15 ± 0.28 g/cm³ — solid silicate rock",
      surfaceEvidence: "Resolved from the ground, not from space: SPHERE for the shape, and a 2003 Hooker-telescope campaign for the 100 km crater. Finer relief is borrowed from Ida",
      roughness: "one very large impact scar; the rest unknown",
      description:
        "The third asteroid ever discovered, in 1804, back when the first four were still called planets. It is one of the brightest things in the belt — 21 per cent reflectance on a stony surface — and occasionally reaches naked-eye visibility at opposition. Ground-based adaptive optics in 2003 resolved a 100 km crater on it, which was remarkable at the time: a surface feature on an asteroid, seen from Earth. Its orbit is the most eccentric of the big four, carrying it from 1.99 AU out to 3.35.",
    },
  },
  {
    id: "camilla",
    name: "Camilla",
    designation: "107 Camilla (A868 WA)",
    classification: "Main-belt asteroid · X-type (Tholen C)",
    detail: "Two satellites, neither drawn here | Cybele group",
    diameterKm: 254,
    diameterLabel: "344 × 246 × 205 km; 254 ± 12 km volume-equivalent",
    albedo: 0.059,
    chroma: CLASS_CHROMA.X,
    rotationHours: 4.844,
    rotationState: "principal-axis",
    metalness: 0.03,
    orbit: {
      solution: "JPL SBDB orbit solution 161, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 3.496730120606315,
      e: 0.06725823702333292,
      iDeg: 10.00612918005919,
      nodeDeg: 172.3941527470202,
      argPeriDeg: 303.0136413979765,
      meanAnomalyDeg: 3.466180718189857,
      meanMotionDegPerDay: meanMotion(3.496730120606315),
    },
    shape: {
      lobes: ellipsoid(344, 246, 205),
      neck: 1,
      relief: 0.029,
      grain: 0.010,
      craterCount: 116,
      craterMin: 0.020,
      craterMax: 0.125,
      craterDepth: 0.021,
      boulders: 0,
      seed: 107,
    },
    surfaceEvidence: "Keck and VLT adaptive optics, Pajuelo et al. 2018, Icarus. Not visited",
    info: {
      population: "Main asteroid belt · Cybele group, 3.26-3.73 AU",
      diameter: "344 × 246 × 205 km, 254 ± 12 km volume-equivalent",
      rotationPeriod: "4.844 h — JPL SBDB physical parameters",
      orbitalSpeed: "15.8 km/s · one orbit takes 6.54 years",
      gravity: "Density 1.28 ± 0.04 g/cm³ — one of the emptiest large bodies known",
      surfaceEvidence: "A resolved disc. Relief borrowed from Lutetia, the nearest imaged X-type",
      roughness: "unknown",
      description:
        "A 344 km rubble pile out in the Cybele group with two moons of its own — S/2001 (107) 1, about 11 km across and found in 2001, and S/2016 (107) 1, smaller and found fifteen years later. Neither is drawn in this scene, and that is deliberate: the published orbit solutions for them disagree by more than the separation itself, and a moon in the wrong place would be worse than no moon. What their existence does give is a mass, and the mass gives a density of 1.28 g/cm³ — emptier than water ice, which for a body made of rock means well over half of it is void.",
    },
  },
  {
    id: "kalliope",
    name: "Kalliope",
    designation: "22 Kalliope (A852 WA)",
    classification: "Main-belt asteroid · M-type (Tholen) / X (SMASS)",
    detail: "Metal-rich, with the moon Linus | discovered 2001",
    diameterKm: 150,
    diameterLabel: "235 × 144 × 124 km; 150 ± 5 km volume-equivalent",
    albedo: 0.166,
    chroma: CLASS_CHROMA.X,
    rotationHours: 4.1483,
    rotationState: "principal-axis",
    metalness: 0.20,
    orbit: {
      solution: "JPL SBDB orbit solution 138, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.909165783133826,
      e: 0.0988424401654017,
      iDeg: 13.70212718634476,
      nodeDeg: 65.96536371272761,
      argPeriDeg: 358.3124076298034,
      meanAnomalyDeg: 350.3284069622562,
      meanMotionDegPerDay: meanMotion(2.909165783133826),
    },
    shape: {
      lobes: ellipsoid(235, 144, 124),
      neck: 1,
      relief: 0.030,
      grain: 0.011,
      craterCount: 92,
      craterMin: 0.018,
      craterMax: 0.110,
      craterDepth: 0.020,
      boulders: 0,
      seed: 22,
    },
    moons: [
      {
        /* Linus: a ~1,100 km orbit (published) and a period derived from it
         * through JPL's GM of 0.491 km³/s², so the drawn separation and the
         * drawn speed agree with each other. */
        name: "Linus",
        designation: "(22) Kalliope I Linus",
        classification: "Natural satellite · unusually large for a main-belt moon",
        diameterLabel: "about 28 km",
        diameterKm: 28,
        separationKm: 1100,
        periodHours: 90.9,
        inclinationDeg: 5.0,
        albedo: 0.166,
        shape: {
          lobes: [{ c: [0, 0, 0], r: [15.4, 13.0, 14.2] }],
          neck: 1,
          relief: 0.052,
          grain: 0.024,
          craterCount: 18,
          craterMin: 0.06,
          craterMax: 0.24,
          craterDepth: 0.038,
          boulders: 0,
          seed: 2201,
        },
        info: {
          diameter: "about 28 km",
          rotationPeriod: "Unknown",
          orbitalSpeed: "About 21 m/s around Kalliope",
          surfaceEvidence: "Discovered 29 August 2001 by Margot and Brown, and independently by Merline and colleagues. No image has ever resolved its surface; the shape drawn here is a smooth ellipsoid at the measured size",
          description: "Nearly a fifth of its parent's diameter, which makes it one of the largest satellites relative to its primary anywhere in the belt. Named for the son of the muse Kalliope. Tracking it is how Kalliope was weighed, and the answer — 4.36 g/cm³ — is why Kalliope is called metal-rich.",
        },
      },
    ],
    surfaceEvidence: "Keck, VLT and Gemini adaptive optics; Ferrais et al. 2022, A&A 662, A71. Not visited",
    info: {
      population: "Main asteroid belt · middle belt, 2.62-3.20 AU",
      diameter: "235 × 144 × 124 km, 150 ± 5 km volume-equivalent",
      rotationPeriod: "4.1483 h — JPL SBDB physical parameters",
      orbitalSpeed: "17.4 km/s · one orbit takes 4.96 years",
      gravity: "Density 4.36 ± 0.50 g/cm³ — the densest large asteroid measured, and the reason it is called metal-rich",
      surfaceEvidence: "A resolved disc. Relief borrowed from Lutetia, the nearest imaged M/X-type",
      roughness: "unknown",
      description:
        "Denser than any other large asteroid measured: 4.36 g/cm³, which is nickel-iron territory and puts it in the same short list as Psyche as a candidate exposed planetary core. Its moon Linus — named for the son of the muse Kalliope — was found in 2001 and is unusually large for a main-belt satellite at about 28 km, nearly a fifth of its parent's diameter. Weighing Linus is how the density was measured, and the density is the whole story.",
    },
  },
  {
    id: "kleopatra",
    name: "Kleopatra",
    designation: "216 Kleopatra (A880 GB)",
    classification: "Main-belt asteroid · M-type (SMASS Xe) · contact binary",
    detail: "The dog-bone, with two moons | VLT/SPHERE, Marchis et al. 2021",
    diameterKm: 120,
    diameterLabel: "276 × 94 × 78 km end to end; 120 ± 2 km volume-equivalent",
    albedo: 0.1164,
    chroma: CLASS_CHROMA.X,
    rotationHours: 5.385280,
    rotationState: "principal-axis",
    metalness: 0.18,
    orbit: {
      solution: "JPL SBDB orbit solution 157, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.795272753074668,
      e: 0.2501676832686795,
      iDeg: 13.11552664581115,
      nodeDeg: 215.3098461839713,
      argPeriDeg: 179.7697642293943,
      meanAnomalyDeg: 259.8567076625492,
      meanMotionDegPerDay: meanMotion(2.795272753074668),
    },
    /*
     * The only two-lobed body in this file, and the reason it is worth
     * drawing at all. Radar first showed the dog-bone in 2000 and SPHERE
     * confirmed it in 2021: two masses joined by a narrow bridge, 276 km
     * from tip to tip and only 94 by 78 across. The lobes are placed so the
     * overall length matches the published figure exactly, and the neck is
     * pinched hard, because a soft join would draw a peanut and Kleopatra is
     * not a peanut.
     */
    shape: {
      lobes: [
        { c: [-66, 0, 0], r: [72, 39, 44] },
        { c: [66, 0, 0], r: [72, 38, 42] },
      ],
      neck: 9,
      relief: 0.026,
      grain: 0.010,
      craterCount: 74,
      craterMin: 0.018,
      craterMax: 0.075,
      craterDepth: 0.018,
      boulders: 0,
      seed: 216,
    },
    moons: [
      {
        /* Alexhelios and Cleoselene are published with periods rather than
         * distances, so each separation is derived from the system mass of
         * 2.97e18 kg (Marchis et al. 2021) through Kepler's third law. */
        name: "Alexhelios",
        designation: "(216) Kleopatra I Alexhelios",
        classification: "Natural satellite · outer moon of the dog-bone",
        diameterLabel: "8.9 ± 1.6 km",
        diameterKm: 8.9,
        separationKm: 649,
        periodHours: 64.8,
        inclinationDeg: 4.0,
        albedo: 0.1164,
        shape: {
          lobes: [{ c: [0, 0, 0], r: [5.0, 4.1, 4.6] }],
          neck: 1,
          relief: 0.052,
          grain: 0.024,
          craterCount: 8,
          craterMin: 0.06,
          craterMax: 0.24,
          craterDepth: 0.038,
          boulders: 0,
          seed: 21601,
        },
        info: {
          diameter: "8.9 ± 1.6 km",
          rotationPeriod: "Unknown",
          orbitalSpeed: "About 17 m/s around Kleopatra",
          surfaceEvidence: "Discovered 2008 from Keck II adaptive optics; orbit from Marchis et al. 2021. No image has ever resolved its surface; the shape drawn here is a smooth ellipsoid at the measured size",
          description: "The outer of Kleopatra's two moons, named for Alexander Helios, son of Cleopatra VII. Its 2.7-day orbit is what weighed the dog-bone. The separation drawn here is derived from the measured system mass through Kepler's third law, because the published solution gives a period rather than a distance.",
        },
      },
      {
        name: "Cleoselene",
        designation: "(216) Kleopatra II Cleoselene",
        classification: "Natural satellite · inner moon of the dog-bone",
        diameterLabel: "6.9 ± 1.6 km",
        diameterKm: 6.9,
        separationKm: 495,
        periodHours: 43.2,
        inclinationDeg: 4.0,
        albedo: 0.1164,
        shape: {
          lobes: [{ c: [0, 0, 0], r: [3.9, 3.2, 3.6] }],
          neck: 1,
          relief: 0.052,
          grain: 0.024,
          craterCount: 6,
          craterMin: 0.06,
          craterMax: 0.24,
          craterDepth: 0.038,
          boulders: 0,
          seed: 21602,
        },
        info: {
          diameter: "6.9 ± 1.6 km",
          rotationPeriod: "Unknown",
          orbitalSpeed: "About 20 m/s around Kleopatra",
          surfaceEvidence: "Discovered 2008 from Keck II adaptive optics; orbit from Marchis et al. 2021. No image has ever resolved its surface; the shape drawn here is a smooth ellipsoid at the measured size",
          description: "The inner moon, named for Cleopatra Selene, daughter of Cleopatra VII and twin of Alexander Helios. It circles the dog-bone every 1.8 days. Both moons are very probably material shed from the ends of a body spinning close to its break-up limit.",
        },
      },
    ],
    surfaceEvidence: "Arecibo radar delay-Doppler 2000; VLT/SPHERE 2017-2019, Marchis et al. 2021, A&A 653, A57. Not visited",
    info: {
      population: "Main asteroid belt · middle belt, 2.10-3.49 AU",
      diameter: "276 × 94 × 78 km end to end, 120 ± 2 km volume-equivalent — Marchis et al. 2021",
      rotationPeriod: "5.385280 ± 0.000001 h — one of the most precisely measured rotation periods of any asteroid",
      orbitalSpeed: "17.8 km/s · one orbit takes 4.67 years",
      gravity: "Density 3.38 ± 0.50 g/cm³; it spins close to the speed at which it would fly apart",
      surfaceEvidence: "Radar and adaptive optics gave the shape; no image has ever resolved a feature on the surface. Relief borrowed from Lutetia, the nearest imaged M-type",
      roughness: "unknown",
      description:
        "The most visually arresting asteroid there is: a dog-bone, 276 km from end to end, two lumps of metal joined by a narrow bridge. Radar found the shape in 2000 and nobody quite believed it until SPHERE resolved the same thing twenty years later. It spins once every 5.39 hours, close enough to the break-up limit that material can lift off the ends — which is the leading explanation for its two moons, Alexhelios and Cleoselene, both found in 2008 and both named for children of Cleopatra VII. At 3.38 g/cm³ it is metal-rich, and the pair of moons is how that was weighed.",
    },
  },
]);

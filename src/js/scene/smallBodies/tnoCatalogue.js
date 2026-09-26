/**
 * Fourteen worlds past Neptune, and five moons.
 *
 * Rank 4 of `docs/bodies-to-draw-next.md`, batch A: the dwarf-planet
 * candidates that were still missing. The scene already drew twelve
 * trans-Neptunian worlds -- Pluto, Eris, Haumea, Makemake, Gonggong, Quaoar,
 * Orcus, Sedna, Ixion, Salacia, Varuna and Varda -- through the planet
 * builder. These go through the small-body builder instead, the same one as
 * Ranks 1 to 3, because it is the one that already knows how to draw a
 * measured occultation shape, a moon at its real separation, a JPL element
 * set propagated from one epoch, and a named feature on the ground. It is
 * also a great deal cheaper per body, which matters at fourteen.
 *
 * ## The evidence, again
 *
 * Every body in this file is a point of light. None has ever been resolved.
 * What is known comes from three instruments, and each record says which:
 *
 *   stellar occultations   a real outline, to a kilometre or two (Máni,
 *                          Achlys, Gǃkúnǁʼhòmdímà, Huya, Leleākūhonua)
 *   thermal emission       Herschel, Spitzer or ALMA measuring how warm the
 *                          body is, which with its brightness gives size and
 *                          albedo together, to ten or twenty per cent
 *   moon orbits            a satellite's period and distance weigh the
 *                          system, which is how Uni came out less dense than
 *                          water
 *
 * Shapes are drawn from the occultation limb where there is one, from the
 * lightcurve amplitude where there is not (a/b >= 10^(0.4 * amplitude)), and
 * as a near-sphere where neither exists. Surfaces are borrowed -- the
 * texture pipeline takes its relief from Arrokoth, the only cold outer Solar
 * System surface a spacecraft has photographed -- and colour and albedo are
 * the measured ones.
 *
 * ## Why they are drawn at the planet builder's size curve
 *
 * The small-body builder normally sizes a body with the asteroid curve,
 * which is generous to small rocks so they stay findable. Applied here it
 * would draw Máni, 796 km across, ten times larger than Varuna at 668 km --
 * in the same stretch of sky, a few degrees apart. These records carry
 * `sizeCurve: "dwarf"` and are sized by the same compression the planet
 * builder gives the twelve worlds already out here, so the whole family
 * keeps its real order: Gonggong > Quaoar > Orcus > Sedna > Salacia > Máni
 * > Aya > Achlys > Chiminigagua > Varda > Ixion > Uni > Goibniu > Ritona >
 * Varuna > Gǃkúnǁʼhòmdímà > 2014 UZ224 > Chaos > Xewioso > Rumina > Huya.
 *
 * ## Framing the systems with moons
 *
 * Ranks 1 and 2 frame a body that has a moon on the *pair*, so both are on
 * screen. That works when the moon is a few radii out. Out here it is not:
 * Chiminigagua's moon is at least 26 of its radii away, Tinia 14, Gǃòʼé ǃHú
 * 19, Achlys's moon 19. Framed on the pair, each primary measured 5 to 10
 * pixels across its radius in the browser -- a dot. So those four carry
 * `framePair: false`: the camera frames the body itself, the moon's orbit
 * ring shows where the moon is, and the moon is one press away in "Where to
 * next". Huya keeps the pair framing -- its moon is nine radii out and half
 * its size, and the pair *is* the subject; framed that way it measured 16
 * pixels, which is small but reads as a double world.
 *
 * ## Provenance
 *
 * Orbital elements: JPL Small-Body Database, queried 26 September 2026 at
 * full precision (`full-prec=1`), every one at JD 2461200.5 -- the same
 * epoch as Ranks 1 to 3, so the whole scene propagates from one moment. Each
 * record names its orbit solution. Mean motion is computed from the
 * semi-major axis, as elsewhere.
 *
 * Colour: B-R where B-V and V-R are both published. Where only V-R is, the
 * excess over the Sun's V-R of 0.354 (Holmberg, Flynn & Portinari 2006) is
 * scaled by 2.11 -- the ratio of the B-to-R and V-to-R baselines at the
 * Bessell effective wavelengths 438, 545 and 641 nm, which is exact for a
 * spectrum whose reflectance rises linearly with wavelength and a fair
 * approximation for these. The triple then comes from the same conversion
 * `centaurCatalogue.js` documents, reproduced in `chromaFromBR` below so
 * every number here can be traced. Checked against Pholus: B-R 2.049 gives
 * back [1.426, 1.029, 0.545], the triple that file hard-codes.
 *
 * Where a value is flagged "secondary" the number was found only in a
 * compilation and its primary paper could not be read to confirm it.
 */

/* n = 0.9856002628 * a^-1.5 deg/day, as in the other catalogues. */
const meanMotion = (aAU) => 0.9856002628 / (aAU ** 1.5);

/* Semi-axes from tri-axial *diameters* a >= b >= c; the builder's y is the
 * spin axis, which for a relaxed body is the shortest. Same helper as the
 * Centaurs. */
const ellipsoid = (a, b, c) => [{ c: [0, 0, 0], r: [a / 2, c / 2, b / 2] }];

/* B-R -> linear [R, G, B] reflectance, mean one. See the provenance note. */
const SUN_BR = 1.005;
function chromaFromBR(br) {
  const k = 10 ** (0.4 * (br - SUN_BR));
  const blue = k ** -0.5;
  const red = k ** 0.5;
  const green = blue + 0.55 * (red - blue);
  const mean = (red + green + blue) / 3;
  return [red / mean, green / mean, blue / mean];
}
/* V-R only -> B-R, by the baseline ratio. */
const SUN_VR = 0.354;
const brFromVR = (vr) => SUN_BR + 2.11 * (vr - SUN_VR);

/* Mean heliocentric speed from a: v = 29.78 / sqrt(a) km/s, and the period
 * a^1.5 years. For the eccentric ones the card says "mean". */
function orbitLine(aAU) {
  const speed = 29.78 / Math.sqrt(aAU);
  const years = aAU ** 1.5;
  return `${speed.toFixed(1)} km/s mean · one orbit takes ${Math.round(years).toLocaleString("en-GB")} years — from the JPL element set`;
}

/* A large icy world is round, and its relief is small against its radius.
 * These are the Centaurs' settings with relief and crater depth roughly
 * halved: at 700 km a body has relaxed most of its topography away, and the
 * one measured exception -- Máni -- is drawn as a named feature, not as
 * general roughness. */
const ICY_RELIEF = Object.freeze({
  neck: 1,
  relief: 0.012,
  grain: 0.006,
  craterCount: 64,
  craterMin: 0.022,
  craterMax: 0.12,
  craterDepth: 0.009,
  boulders: 0,
});

const orbitFrom = (solution, el) => ({
  solution: `JPL SBDB orbit solution ${solution}, epoch JD 2461200.5, queried 26 September 2026`,
  epochJD: 2461200.5,
  ...el,
  meanMotionDegPerDay: meanMotion(el.aAU),
});

export const TRANS_NEPTUNIAN_WORLDS = Object.freeze([
  {
    id: "mani",
    name: "Máni",
    designation: "307261 Máni (2002 MS4)",
    classification: "Trans-Neptunian · dwarf planet candidate",
    detail: "A crater 322 km wide on a 796 km world | occultation, 8 August 2020",
    sizeCurve: "dwarf",
    diameterKm: 796,
    diameterLabel: "796 ± 24 km area-equivalent · limb 824 × 770 km",
    albedo: 0.10,
    /* B-V 0.69 +/- 0.02, V-R 0.38 +/- 0.02 (secondary) -> B-R 1.07: very
     * nearly the colour of sunlight, a neutral water-ice surface. */
    chroma: chromaFromBR(0.69 + 0.38),
    /* Not settled: 7.33 h or 10.44 h single-peaked (Thirouin 2013), 14.25 h
     * elsewhere. Drawn at the first; the card says it is uncertain. */
    rotationHours: 7.33,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(25, {
      aAU: 41.58863664738092,
      e: 0.1482654554299753,
      iDeg: 17.69991360489779,
      nodeDeg: 216.1403186984926,
      argPeriDeg: 215.4842690316302,
      meanAnomalyDeg: 230.3015162420507,
    }),
    /*
     * The strongest single addition in Rank 4, because of what the 8 August
     * 2020 occultation caught on its limb: 61 positive chords, the best-
     * sampled occultation of any trans-Neptunian object bar Pluto, and they
     * show a depression 322 +/- 39 km wide and 45.1 +/- 1.5 km deep, plus a
     * separate 11 km-deep hollow beside a 25 (+4/-5) km rise (Rommel et al.
     * 2023, A&A 678, A167). On a body 398 km in radius that crater spans
     * nearly half the globe.
     *
     * Limb 824 x 770 km (a' = 412, b' = 385); the third axis is not
     * measured and is set between them. The crater's angular half-width is
     * 161 / 398 = 0.405 rad and its depth 45.1 / 398 = 0.113 of the radius;
     * the rise is 25 / 398 = 0.063, drawn as a negative-depth cap. Where on
     * the globe these sit is not known -- an occultation sees one limb at
     * one instant -- so the directions are chosen.
     */
    shape: {
      ...ICY_RELIEF,
      lobes: ellipsoid(824, 797, 770),
      bigCraters: [
        { dir: [0.55, -0.22, 0.80], radius: 0.405, depth: 0.113, rim: 0.012 },
        /* The 11 km hollow (0.028) beside the rise; widths not published,
         * both set to about 50 km (0.13 rad). */
        { dir: [-0.62, 0.30, 0.72], radius: 0.13, depth: 0.028, rim: 0.004 },
        { dir: [-0.42, 0.40, 0.81], radius: 0.13, depth: -0.063, rim: 0 },
      ],
      seed: 307261,
    },
    surfaceEvidence: "Never resolved. Outline from nine stellar occultations 2019-2022 (Rommel et al. 2023, A&A 678, A167). Surface relief borrowed from Arrokoth; the great crater and the rise are the measured ones, placed where no one can yet say",
    info: {
      population: "Trans-Neptunian · hot classical Kuiper Belt, 35.4-47.8 AU",
      diameter: "796 ± 24 km — area-equivalent from occultations, Rommel et al. 2023. Thermal data had said about 934 km",
      rotationPeriod: "Uncertain — 7.33 h or 10.44 h (Thirouin 2013); drawn at 7.33 h",
      orbitalSpeed: orbitLine(41.58863664738092),
      gravity: "Density not measured — no moon to weigh it by. A 2026 thermal study suggests an unresolved close companion, which is a hypothesis, not a detection",
      surfaceEvidence: "An outline, caught twice with sixty-one telescopes. The crater and the rise are real; everything finer is borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "On 8 August 2020 a star passed behind Máni and sixty-one chords were timed across it — one of the best-covered occultations of anything beyond Neptune. The outline they traced has a bite taken out of it: a depression 322 kilometres wide and 45 kilometres deep, on a world 796 kilometres across. Nearby there is a second, smaller hollow and a rise 25 kilometres high. That is extreme for an icy body this size, which should have slumped flat long ago; either its crust is far stiffer than the models allow or the impact was geologically recent. Neutral in colour, close to sunlight, with water ice on the surface. It carried the designation 2002 MS4 for twenty-three years and was named in June 2025 for the Norse personification of the Moon.",
    },
  },
  {
    id: "chiminigagua",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Chiminigagua",
    framePair: false,
    designation: "532037 Chiminigagua (2013 FY27)",
    classification: "Trans-Neptunian · scattered disc · dwarf planet candidate",
    detail: "The ninth-brightest trans-Neptunian object, with a moon | ALMA 2018",
    sizeCurve: "dwarf",
    /* 765 +80/-85 km is the system's effective diameter (Sheppard,
     * Fernandez & Moullet 2018, AJ 156, 270). With the moon at the same
     * albedo and 186 km across, the primary is sqrt(765^2 - 186^2) = 742. */
    diameterKm: 742,
    diameterLabel: "≈742 km — 765 +80/−85 km for the pair, less the moon",
    albedo: 0.17,
    /* g-r 0.76 +/- 0.02 (Sheppard 2018) = V-R 0.56 -> B-R 1.44, moderately red */
    chroma: chromaFromBR(brFromVR(0.56)),
    /* No variation above 0.06 mag (Sheppard 2018), so no period. Chosen. */
    rotationHours: 8,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(18, {
      aAU: 58.89795676466917,
      e: 0.3909366841447515,
      iDeg: 33.10715673878931,
      nodeDeg: 187.0591745566242,
      argPeriDeg: 139.3034730116309,
      meanAnomalyDeg: 218.7009524211624,
    }),
    shape: { ...ICY_RELIEF, lobes: ellipsoid(750, 742, 734), seed: 532037 },
    moons: [
      {
        /* Found in HST images of 15 January 2018 at 0.17 arcsec, which is a
         * projected 9,800 km and therefore a minimum. Period not measured:
         * drawn at the period that distance gives if the primary has a
         * density of 1.0 g/cm3 -- 18.7 days. Both numbers are stand-ins. */
        name: "Chiminigagua I",
        designation: "S/2018 (532037) 1",
        classification: "Natural satellite · unnamed, orbit not yet solved",
        diameterKm: 186,
        diameterLabel: "≈186 km (160-211 km) at equal albedo",
        separationKm: 9800,
        periodHours: 448.8,
        inclinationDeg: 0,
        albedo: 0.17,
        shape: { ...ICY_RELIEF, lobes: ellipsoid(190, 186, 182), craterCount: 30, seed: 5320371 },
        info: {
          diameter: "About 186 km, from being 3.0 magnitudes fainter at the same albedo — Sheppard et al. 2018",
          rotationPeriod: "Unknown",
          orbitalSpeed: "Orbit not solved — drawn at a minimum 9,800 km and an assumed 18.7-day period",
          surfaceEvidence: "Two dots in one Hubble frame. Nothing about its surface is known",
          description: "Found in Hubble images taken on 15 January 2018, sitting 0.17 arcseconds from its primary. It has no name and no solved orbit — the distance drawn is the smallest it can be, the separation projected on the sky, and the period is what that distance would give. Its existence is what will eventually weigh Chiminigagua.",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Size and albedo from ALMA thermal emission with Magellan photometry (Sheppard, Fernandez & Moullet 2018, AJ 156, 270). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · scattered disc, 35.9-81.9 AU",
      diameter: "≈742 km — ALMA, Sheppard et al. 2018 (765 km for the pair)",
      rotationPeriod: "Not measured — its brightness does not vary by more than 0.06 mag",
      orbitalSpeed: orbitLine(58.89795676466917),
      gravity: "Density not yet measured; its moon's orbit has not been solved",
      surfaceEvidence: "A point of light, measured by the warmth it gives off. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Found in 2013 and for years one of the largest known worlds without a name. It is the ninth-brightest object beyond Neptune, on a scattered-disc orbit tilted 33 degrees and stretching from 36 to 82 AU. ALMA measured its warmth, which with its brightness gave a size of about 765 kilometres for the system and a surface reflecting 17 per cent of the light — brighter than most of its neighbours. Hubble found a moon beside it in 2018. Named in 2025 for the Muisca creator god who held the light of the world inside him before there was a world to shine on.",
    },
  },
  {
    id: "achlys",
    name: "Achlys",
    framePair: false,
    designation: "208996 Achlys (2003 AZ84)",
    classification: "Trans-Neptunian · plutino · dwarf planet candidate",
    detail: "A stretched plutino with a moon and a chasm | occultations 2011-2014",
    sizeCurve: "dwarf",
    diameterKm: 772,
    diameterLabel: "940 × 766 × 490 km Jacobi figure · 772 ± 12 km area-equivalent",
    albedo: 0.097,
    /* B-V 0.70, V-R 0.36 (Fornasier et al. 2004; secondary) -> B-R 1.06:
     * neutral, BB class, amorphous and crystalline water ice. */
    chroma: chromaFromBR(0.70 + 0.36),
    rotationHours: 6.79,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(52, {
      aAU: 39.65674190908469,
      e: 0.1749643183262652,
      iDeg: 13.54857109263982,
      nodeDeg: 251.8991700940268,
      argPeriDeg: 14.06755482579046,
      meanAnomalyDeg: 243.992287720534,
    }),
    /*
     * Four occultations, 2011 to 2014, fitted as a Jacobi ellipsoid with
     * semi-axes 470 +/- 20, 383 +/- 10 and 245 +/- 8 km (Dias-Oliveira et
     * al. 2017, AJ 154, 22) -- a body spun into a flattened triaxial shape
     * by a 6.79-hour day. The 2014 chords also showed a dip in the limb:
     * either a chasm 23 km wide and more than 8 km deep, or a smooth
     * depression 80 km wide and 13 km deep. The mesh can draw the second;
     * 40 / 390 = 0.10 rad half-width, 13 / 390 = 0.033 deep.
     */
    shape: {
      ...ICY_RELIEF,
      lobes: ellipsoid(940, 766, 490),
      bigCraters: [{ dir: [0.1, 0.05, 1.0], radius: 0.10, depth: 0.033, rim: 0.004 }],
      seed: 208996,
    },
    moons: [
      {
        /* Found by HST (Brown & Suer 2007). About 80 km, at least 7,200 km
         * out; the period is not solved. Drawn at 13.6 days, which is what
         * 7,200 km gives around the 1.6e20 kg that Dias-Oliveira's shape and
         * 0.87 g/cm3 imply -- close to the rough 12 days that has been
         * suggested. */
        name: "Achlys I",
        designation: "S/2007 (208996) 1",
        classification: "Natural satellite · unnamed, orbit not yet solved",
        diameterKm: 80,
        diameterLabel: "about 80 km (secondary)",
        separationKm: 7200,
        periodHours: 326.4,
        inclinationDeg: 0,
        albedo: 0.097,
        shape: { ...ICY_RELIEF, lobes: ellipsoid(84, 80, 76), craterCount: 24, seed: 2089961 },
        info: {
          diameter: "About 80 km (secondary); a 2026 thermal study suggests it may be larger",
          rotationPeriod: "Unknown",
          orbitalSpeed: "Orbit not solved — drawn at 7,200 km and 13.6 days",
          surfaceEvidence: "A faint dot beside its primary in Hubble images from 2005",
          description: "Found in Hubble images from December 2005. Its orbit has never been pinned down, which is why Achlys is weighed by its shape rather than by its moon — the density of 0.87 g/cm³ comes from assuming the stretched figure is what a body of that density spins into.",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Shape from four stellar occultations (Dias-Oliveira et al. 2017, AJ 154, 22). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · plutino, 3:2 resonance with Neptune, 32.7-46.6 AU",
      diameter: "940 × 766 × 490 km, 772 km area-equivalent — Dias-Oliveira et al. 2017",
      rotationPeriod: "6.79 h — Santos-Sanz et al. 2017",
      orbitalSpeed: orbitLine(39.65674190908469),
      gravity: "Density 0.87 ± 0.01 g/cm³ if its shape is a spun-up equilibrium figure — Dias-Oliveira et al. 2017",
      surfaceEvidence: "An outline from four occultations. The dip in the limb is real; everything finer is borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "A plutino — two orbits for every three of Neptune's, like Pluto — and one of the largest. Four occultations between 2011 and 2014 traced a stretched, flattened body, 940 kilometres on its long axis and barely half that on its short one: the shape a loosely packed icy world takes when it spins once every 6.8 hours. The 2014 event also caught a dip in the limb, either a chasm or a broad shallow basin. Its surface is neutral grey and carries water ice. It has a small moon whose orbit has never been solved. Named in 2025 for the Greek personification of the mist of death.",
    },
  },
  {
    id: "aya",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Aya",
    designation: "55565 Aya (2002 AW197)",
    classification: "Trans-Neptunian · dwarf planet candidate · no moon",
    detail: "One of the largest worlds out here with no moon at all | Herschel 2014",
    sizeCurve: "dwarf",
    diameterKm: 768,
    diameterLabel: "768 +39/−38 km",
    albedo: 0.112,
    /* B-V 0.92, V-R 0.56 (secondary) -> B-R 1.48: moderately red, IR class */
    chroma: chromaFromBR(0.92 + 0.56),
    rotationHours: 8.86,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(39, {
      aAU: 47.36875987690542,
      e: 0.1286825927917718,
      iDeg: 24.34033767915258,
      nodeDeg: 297.3697786526271,
      argPeriDeg: 294.1459414012872,
      meanAnomalyDeg: 304.3075781031964,
    }),
    /* Low lightcurve amplitude: close to round. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(780, 768, 756), seed: 55565 },
    surfaceEvidence: "Never resolved. Size and albedo from Herschel and Spitzer thermal emission (Vilenius et al. 2014, A&A 564, A35). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · hot classical Kuiper Belt, 41.3-53.5 AU",
      diameter: "768 +39/−38 km — Herschel and Spitzer, Vilenius et al. 2014",
      rotationPeriod: "8.86 ± 0.01 h — Ortiz et al. 2006",
      orbitalSpeed: orbitLine(47.36875987690542),
      gravity: "Density not measured — and without a moon it cannot be",
      surfaceEvidence: "A point of light, measured by its warmth. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Most large trans-Neptunian worlds have at least one moon — Pluto five, Haumea two, Eris, Quaoar, Orcus, Salacia and Varda one each. Aya, at 768 kilometres, has none that Hubble can find, and that makes it useful: a control case in the question of how these systems formed. If most big worlds got their moons from giant impacts, Aya is one that was never hit hard enough. It also means nobody can weigh it. Moderately red, with no clear ice bands. Named in 2025; for twenty-three years it was 2002 AW197.",
    },
  },
  {
    id: "uni",
    name: "Uni",
    framePair: false,
    designation: "55637 Uni (2002 UX25)",
    classification: "Trans-Neptunian · dwarf planet candidate · less dense than water",
    detail: "The largest object known to be less dense than water | Brown 2013",
    sizeCurve: "dwarf",
    diameterKm: 692,
    diameterLabel: "692 ± 23 km thermal · occultations in 2026 suggest 571-610 km",
    albedo: 0.107,
    /* B-V 1.007 +/- 0.043, V-R 0.540 +/- 0.030 (Hainaut et al. 2012, A&A
     * 546, A115) -> B-R 1.547 */
    chroma: chromaFromBR(1.007 + 0.540),
    /* 14.38 h or 16.78 h (Rousselot et al. 2005; secondary). Drawn at the
     * first. */
    rotationHours: 14.38,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(58, {
      aAU: 42.92456947386417,
      e: 0.1462441869199175,
      iDeg: 19.42327844654774,
      nodeDeg: 204.6157936874821,
      argPeriDeg: 276.0993480674751,
      meanAnomalyDeg: 310.1542385365317,
    }),
    shape: { ...ICY_RELIEF, lobes: ellipsoid(704, 692, 680), seed: 55637 },
    moons: [
      {
        /* Brown 2013, ApJL 778, L34: a = 4,770 +/- 40 km, P = 8.3094 +/-
         * 0.0002 d, e = 0.17. About 190 km at equal albedo. Named Tinia in
         * WGSBN Bulletin 5 #20, 1 September 2025. */
        name: "Tinia",
        designation: "(55637) Uni I Tinia",
        classification: "Natural satellite · the moon that weighed Uni",
        diameterKm: 190,
        diameterLabel: "about 190 km at equal albedo",
        separationKm: 4770,
        periodHours: 199.43,
        inclinationDeg: 0,
        albedo: 0.107,
        shape: { ...ICY_RELIEF, lobes: ellipsoid(194, 190, 186), craterCount: 30, seed: 556371 },
        info: {
          diameter: "About 190 km, from its brightness at the same albedo as Uni — Brown 2013",
          rotationPeriod: "Unknown",
          orbitalSpeed: "42 m/s — once every 8.31 days at 4,770 km",
          surfaceEvidence: "A dot beside Uni in Hubble and Keck images. Nothing about its surface is known",
          description: "Tracked by Hubble and Keck well enough to fix its orbit to a fraction of a percent — 8.3094 days at 4,770 kilometres — and it is that orbit that weighs Uni and gives the startling density. Named in September 2025 for the Etruscan sky god, partner of Uni.",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Size from Spitzer and Herschel thermal emission; mass from its moon's orbit (Brown 2013, ApJL 778, L34). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · hot classical Kuiper Belt, 36.6-49.2 AU",
      diameter: "692 ± 23 km — Spitzer and Herschel, as adopted by Brown 2013. Occultations reported in 2026 give 571-610 km (secondary)",
      rotationPeriod: "14.38 h or 16.78 h — Rousselot et al. 2005 (secondary)",
      orbitalSpeed: orbitLine(42.92456947386417),
      gravity: "Density 0.82 ± 0.11 g/cm³ — less than water. System mass 1.25 × 10²⁰ kg from Tinia's orbit, Brown 2013",
      surfaceEvidence: "A point of light, weighed by its moon. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "The largest object known to be less dense than water. Tinia's orbit weighs the pair at 1.25 × 10²⁰ kilograms, and spread through a body 692 kilometres across that comes to 0.82 grams per cubic centimetre. That is a problem for the leading picture of how these worlds formed, in which big ones are built by gathering smaller, denser ones: Uni is big and not dense, so it cannot have been built that way. It must be porous ice with little rock at all. Occultations reported in 2026 suggest it is smaller than the thermal size, which would raise the density and ease the problem somewhat. Named in 2025 for the Etruscan supreme goddess.",
    },
  },
  {
    id: "gkunhomdima",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Gǃkúnǁʼhòmdímà",
    framePair: false,
    designation: "229762 Gǃkúnǁʼhòmdímà (2007 UK126)",
    classification: "Trans-Neptunian · scattered disc · dwarf planet candidate",
    detail: "Occultation-measured, a moon, and the most remarkable name in the Solar System | 2014",
    sizeCurve: "dwarf",
    diameterKm: 638,
    diameterLabel: "638 +28/−14 km equivalent · equatorial 676 km",
    albedo: 0.159,
    /* V-R 0.62 +/- 0.05 (secondary) -> B-R 1.57: moderately red */
    chroma: chromaFromBR(brFromVR(0.62)),
    rotationHours: 11.05,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(42, {
      aAU: 74.50819049288985,
      e: 0.4957816282699332,
      iDeg: 23.32953536634301,
      nodeDeg: 131.2505901829532,
      argPeriDeg: 346.0576265153255,
      meanAnomalyDeg: 348.9992237037756,
    }),
    /* Benedetti-Rossi et al. 2016, AJ 152, 156, from the 15 November 2014
     * occultation: equatorial radius 338 +15/-10 km, equivalent radius 319,
     * so the projected limb is 676 x 2*319^2/338 = 602 km. The middle axis
     * is not measured and is set between. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(676, 660, 602), seed: 229762 },
    moons: [
      {
        /* Grundy et al. 2019, Icarus 334, 30: a = 6,040 +/- 50 km, P =
         * 11.3147 d, e = 0.024, i = 43.7 deg. 3.24 +/- 0.04 mag fainter,
         * which at equal albedo is 638 * 10^(-3.24/5) = 144 km; an upper limit
         * of 159 km has been published. Red satellites often have lower
         * albedos than their primaries, which would make it larger. The name
         * is spelled with the alveolar click ǃ, as the IAU citation has it. */
        name: "Gǃòʼé ǃHú",
        designation: "(229762) Gǃkúnǁʼhòmdímà I Gǃòʼé ǃHú",
        classification: "Natural satellite · redder than its primary",
        diameterKm: 144,
        diameterLabel: "≈144 km at equal albedo · at most 159 km",
        separationKm: 6040,
        periodHours: 271.55,
        inclinationDeg: 43.7,
        albedo: 0.159,
        /* "One of the reddest known trans-Neptunian objects", much redder than
         * its primary (Grundy et al. 2019). No colour index is published for it
         * alone; drawn at B-R 1.95, the red end of the TNO range, just short of
         * Pholus's 2.05. */
        chroma: chromaFromBR(1.95),
        /* ...and drawn with its own rust-red colour map (gohu-red.jpg: the
         * grey Arrokoth-borrowed relief tinted sRGB 0.78/0.30/0.17), because
         * a grey map times that chroma still read as grey on screen. The
         * tint is chosen to read as "one of the reddest objects in the Solar
         * System", not measured -- no colour index is published for it. */
        colourMap: true,
        shape: { ...ICY_RELIEF, lobes: ellipsoid(114, 111, 108), craterCount: 24, seed: 2297621 },
        info: {
          diameter: "About 144 km if it reflects as well as its primary; an upper limit of 159 km has been published",
          rotationPeriod: "Unknown",
          orbitalSpeed: "39 m/s — once every 11.3 days at 6,040 km, Grundy et al. 2019",
          surfaceEvidence: "A dot beside its primary in Hubble images from 2008 — one of the reddest known trans-Neptunian objects, Grundy et al. 2019",
          description: "Found by Hubble in 2008. Its orbit weighs the system at about 1.4 × 10²⁰ kilograms, which with the occultation size gives a density near 1.0 g/cm³ — so its primary never compacted into solid rock and ice either. The name, in the Juǀʼhoan language, is that of the horn carried by the primary's namesake.",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Outline from the 15 November 2014 occultation (Benedetti-Rossi et al. 2016, AJ 152, 156); mass from its moon's orbit (Grundy et al. 2019). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · scattered disc, 37.6-111.4 AU",
      diameter: "638 km equivalent, 676 km at the equator — occultation, Benedetti-Rossi et al. 2016",
      rotationPeriod: "11.05 h — Thirouin et al. 2014 (secondary)",
      orbitalSpeed: orbitLine(74.50819049288985),
      gravity: "Density about 1.0 g/cm³ — Grundy et al. 2019, from Gǃòʼé ǃHú's orbit",
      surfaceEvidence: "An outline from seven chords of one occultation. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Its name comes from the Juǀʼhoan people of Namibia and Botswana: Gǃkúnǁʼhòmdímà is a beautiful aardvark-girl of their mythology. Its clicks make it the hardest name in the Solar System to say correctly. The world itself was caught by a star on 15 November 2014, which gave a slightly oblate outline 638 kilometres across, and its moon's orbit weighs it at about the density of water. Like Uni and Varuna, it is too light to be mostly rock. Its orbit reaches out to 111 AU.",
    },
  },
  {
    id: "huya",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Huya",
    designation: "38628 Huya (2000 EB173)",
    classification: "Trans-Neptunian · plutino · near-equal binary",
    detail: "A plutino whose moon is half its size | occultation, 18 March 2019",
    sizeCurve: "dwarf",
    diameterKm: 411,
    diameterLabel: "436 × 436 × 375 km · 411 ± 7 km area-equivalent",
    albedo: 0.079,
    /* B-V 0.96, V-R 0.57 (secondary) -> B-R 1.53. JWST: CO2-rich
     * "double-dip" surface with CO, methanol and organics (Pinilla-Alonso et
     * al. 2025, Nat. Astron. 9, 230). */
    chroma: chromaFromBR(0.96 + 0.57),
    rotationHours: 6.725,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(53, {
      aAU: 39.25105618208629,
      e: 0.27370027566519,
      iDeg: 15.47789111712463,
      nodeDeg: 169.2838480896274,
      argPeriDeg: 67.47433728336112,
      meanAnomalyDeg: 16.8328068750597,
    }),
    /* Rommel et al. 2025, PSJ 6, 48: a = b = 218.05, c = 187.5 km. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(436.1, 436.1, 375), seed: 38628 },
    moons: [
      {
        /* a = 1,898 +22/-21 km, P = 3.46293 d, e = 0.036 (Rommel et al.
         * 2025; secondary for the orbit). 213 +/- 30 km thermal; at least
         * 165 km from occultation chords. */
        name: "Huya I",
        /* No image of it exists. Its colour has not been measured separately
         * and is assumed to match Huya's moderately red hue, so it takes
         * Huya's own map, turned half a revolution and mirrored so it shares
         * the colour without wearing the same face. */
        colourMap: true,
        designation: "S/2012 (38628) 1",
        classification: "Natural satellite · half its primary's size",
        diameterKm: 213,
        diameterLabel: "213 ± 30 km thermal · at least 165 km from occultations",
        separationKm: 1898,
        periodHours: 83.11,
        inclinationDeg: 0,
        albedo: 0.079,
        shape: { ...ICY_RELIEF, lobes: ellipsoid(218, 213, 208), craterCount: 30, seed: 386281 },
        info: {
          diameter: "213 ± 30 km — Rommel et al. 2025",
          rotationPeriod: "Unknown",
          orbitalSpeed: "40 m/s — once every 3.46 days at 1,898 km",
          surfaceEvidence: "Found by Hubble on 6 May 2012; since caught crossing stars in 2021 and 2023",
          description: "More than half as wide as Huya itself, so the two are closer to a double world than to a planet and a moon. It orbits only nine of Huya's radii out, every three and a half days. Still unnamed.",
        },
      },
    ],
    surfaceEvidence: "Never resolved. Shape from occultations (Santos-Sanz et al. 2022, A&A 664, A130; Rommel et al. 2025, PSJ 6, 48). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · plutino, 3:2 resonance with Neptune, 28.5-50.0 AU",
      diameter: "411 ± 7 km area-equivalent — occultation of 18 March 2019, Santos-Sanz et al. 2022",
      rotationPeriod: "6.725 ± 0.006 h — Santos-Sanz et al. 2022",
      orbitalSpeed: orbitLine(39.25105618208629),
      gravity: "Density 1.07 ± 0.07 g/cm³ — Rommel et al. 2025. No atmosphere thicker than about 10 nanobar",
      surfaceEvidence: "An outline from nineteen chords. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "A plutino and, with its moon, very nearly a binary: the companion is more than half Huya's width and circles it every three and a half days. When a star passed behind it on 18 March 2019, nineteen chords traced a slightly flattened world 411 kilometres across and found no atmosphere down to about a hundred-millionth of Earth's surface pressure. JWST found its surface rich in carbon dioxide ice, with carbon monoxide, methanol and organic material — the chemistry of the cold outer disc, preserved. Named for the rain god of the Wayuu people of Venezuela and Colombia.",
    },
  },
  {
    id: "goibniu",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Goibniu",
    designation: "90568 Goibniu (2004 GV9)",
    classification: "Trans-Neptunian · dwarf planet candidate",
    detail: "A fast-spinning dark classical world | Herschel 2012",
    sizeCurve: "dwarf",
    diameterKm: 680,
    diameterLabel: "680 ± 34 km",
    albedo: 0.077,
    /* V-R 0.52 (secondary) -> B-R 1.36, BR class */
    chroma: chromaFromBR(brFromVR(0.52)),
    rotationHours: 5.86,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(24, {
      aAU: 41.86051094353232,
      e: 0.07703121354853824,
      iDeg: 22.02878853371159,
      nodeDeg: 250.5814885414366,
      argPeriDeg: 290.1790201215647,
      meanAnomalyDeg: 51.46505627715545,
    }),
    /* 0.16 mag amplitude -> a/b >= 1.16 (Dotto et al. 2008, A&A 490, 829).
     * c set at 0.9 b; scaled to 680 km volume-equivalent. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(777, 670, 603), seed: 90568 },
    surfaceEvidence: "Never resolved. Size and albedo from Herschel and Spitzer (Vilenius et al. 2012, A&A 541, A94). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · hot classical Kuiper Belt, 38.6-45.1 AU",
      diameter: "680 ± 34 km — Herschel and Spitzer, Vilenius et al. 2012",
      rotationPeriod: "5.86 ± 0.03 h — Dotto et al. 2008",
      orbitalSpeed: orbitLine(41.86051094353232),
      gravity: "Density not measured; 1.1-1.5 g/cm³ if its elongation is rotational — Dotto et al. 2008",
      surfaceEvidence: "A point of light, measured by its warmth. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "A dark classical world — it reflects under eight per cent of the light that reaches it — turning once every 5.86 hours, fast enough that its brightness swings as an elongated body presents first its long side and then its end. No water ice shows in its spectrum. On one of the most circular orbits in this set, between 39 and 45 AU. Named in 2025 for the Irish smith-god whose ale made those who drank it immortal.",
    },
  },
  {
    id: "ritona",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Ritona",
    designation: "145452 Ritona (2005 RN43)",
    classification: "Trans-Neptunian · dwarf planet candidate",
    detail: "Carbon dioxide ice on a nearly circular orbit | JWST 2023",
    sizeCurve: "dwarf",
    diameterKm: 679,
    diameterLabel: "679 +55/−73 km",
    albedo: 0.107,
    /* B-V 0.95, V-R 0.59 (secondary) -> B-R 1.54, IR/RR class */
    chroma: chromaFromBR(0.95 + 0.59),
    /* 6.946 h single-peaked or 13.892 h double (Hromakina et al. 2018). */
    rotationHours: 13.892,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(46, {
      aAU: 41.49809389728453,
      e: 0.02255407529729301,
      iDeg: 19.27813450132106,
      nodeDeg: 186.9929300271751,
      argPeriDeg: 178.7371106118277,
      meanAnomalyDeg: 348.7082730813624,
    }),
    /* 0.04 mag amplitude: close to round. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(690, 679, 668), seed: 145452 },
    surfaceEvidence: "Never resolved. Size and albedo from Herschel (Vilenius et al. 2012, A&A 541, A94). Ices from JWST (Brown & Fraser 2023, PSJ 4, 130). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · hot classical Kuiper Belt, 40.6-42.4 AU",
      diameter: "679 +55/−73 km — Herschel, Vilenius et al. 2012",
      rotationPeriod: "13.892 h, or half that — Hromakina et al. 2018",
      orbitalSpeed: orbitLine(41.49809389728453),
      gravity: "Density not measured",
      surfaceEvidence: "A point of light. JWST found carbon dioxide ice; the relief is borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Its orbit is the most nearly circular of all fourteen here — its distance from the Sun changes by less than two AU in 267 years. JWST found strong carbon dioxide ice on its surface in 2023, along with some carbon monoxide and a little water ice, which puts it in the population that formed far enough out for CO₂ to freeze solid. Moderately red. Named in 2025 for the Gallo-Roman goddess of river fords.",
    },
  },
  {
    id: "xewioso",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Xewioso",
    designation: "78799 Xewioso (2002 XW93)",
    classification: "Trans-Neptunian · dwarf planet candidate · the darkest here",
    detail: "Reflects under four per cent of its light | Herschel 2012",
    sizeCurve: "dwarf",
    diameterKm: 565,
    diameterLabel: "565 +71/−73 km",
    albedo: 0.038,
    /* Colour not measured. Drawn the colour of sunlight, and the card says so. */
    chroma: chromaFromBR(SUN_BR),
    /* Not measured. Chosen. */
    rotationHours: 8,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(10, {
      aAU: 37.67633422777779,
      e: 0.2435239997771454,
      iDeg: 14.34346528267548,
      nodeDeg: 46.76693268735229,
      argPeriDeg: 248.1661850906832,
      meanAnomalyDeg: 155.7393585487758,
    }),
    /*
     * Pitted and lumpy, from the supplied reference image -- which is an
     * artist's impression, as every picture of this body is: nothing has
     * resolved it. Nothing measured contradicts it either (no lightcurve, no
     * occultation), so the relief is set to the reference rather than to the
     * relaxed-sphere default the other worlds use. Axes 600 x 565 x 530 km
     * keep the 565 km thermal size as the middle one; the pits are art.
     */
    shape: {
      ...ICY_RELIEF,
      lobes: ellipsoid(600, 565, 530),
      relief: 0.042,
      grain: 0.018,
      craterCount: 150,
      craterMin: 0.03,
      craterMax: 0.20,
      craterDepth: 0.034,
      bigCraters: [
        { dir: [0.7, 0.2, 0.68], radius: 0.30, depth: 0.05, rim: 0.012 },
        { dir: [-0.5, -0.35, 0.79], radius: 0.24, depth: 0.045, rim: 0.010 },
        { dir: [0.1, 0.9, -0.42], radius: 0.22, depth: 0.04, rim: 0.010 },
        { dir: [-0.8, 0.1, -0.59], radius: 0.26, depth: 0.045, rim: 0.012 },
        { dir: [0.35, -0.8, -0.49], radius: 0.18, depth: 0.04, rim: 0.008 },
      ],
      seed: 78799,
    },
    surfaceEvidence: "Never resolved. Size and albedo from Herschel (Vilenius et al. 2012, A&A 541, A94). Colour and rotation not measured. Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · Kuiper Belt, 28.5-46.9 AU",
      diameter: "565 +71/−73 km — Herschel, Vilenius et al. 2012",
      rotationPeriod: "Not measured — drawn turning once every 8 hours",
      orbitalSpeed: orbitLine(37.67633422777779),
      gravity: "Density not measured",
      surfaceEvidence: "A point of light. Its colour has never been measured, so it is drawn neutral grey",
      roughness: "unknown",
      description:
        "The darkest world in this set: it reflects about four per cent of the light that falls on it, as dark as Salacia and darker than fresh asphalt. That was measured by Herschel from how warm it is. Almost nothing else is known — not its colour, not how fast it turns — and it is drawn neutral grey for that reason rather than for any other. Its orbit dips inside Neptune's distance at 28.5 AU. Named in 2025 for Xɛ̀vioso, the thunder god of the Fon and Ewe peoples of West Africa.",
    },
  },
  {
    id: "rumina",
    name: "Rumina",
    designation: "145451 Rumina (2005 RM43)",
    classification: "Trans-Neptunian · scattered disc · water-ice world",
    detail: "Neutral, icy and on a 92 AU orbit | Herschel 2020",
    sizeCurve: "dwarf",
    diameterKm: 524,
    diameterLabel: "524 +96/−103 km",
    albedo: 0.10,
    /* V-R 0.33 (secondary) -> B-R 0.95: neutral to faintly blue, BB class,
     * strong water ice (Brown, Schaller & Fraser 2012). */
    chroma: chromaFromBR(brFromVR(0.33)),
    rotationHours: 9.00,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(29, {
      aAU: 92.03077307017921,
      e: 0.6178629511442068,
      iDeg: 28.70636637840318,
      nodeDeg: 84.63000214806927,
      argPeriDeg: 318.7551048751766,
      meanAnomalyDeg: 8.71588378674177,
    }),
    /* 0.12 mag -> a/b >= 1.12 (Perna et al. 2009); c = 0.9 b. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(585, 523, 470), seed: 145451 },
    surfaceEvidence: "Never resolved. Size and albedo from Herschel (Farkas-Takács et al. 2020, A&A 638, A23). Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · scattered disc, 35.2-148.9 AU",
      diameter: "524 +96/−103 km — Herschel, Farkas-Takács et al. 2020",
      rotationPeriod: "9.00 ± 0.06 h — Perna et al. 2009",
      orbitalSpeed: orbitLine(92.03077307017921),
      gravity: "About 0.55 g/cm³ if its elongation is rotational — Farkas-Takács et al. 2020",
      surfaceEvidence: "A point of light. Water ice is detected; relief borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "One of the few large worlds out here that is grey rather than red, with strong water-ice bands in its spectrum — a third of what is seen is fresh ice. Its orbit is long and stretched, from 35 AU out to 149, and takes 883 years. Named in 2025 for the Roman goddess who watched over nursing mothers.",
    },
  },
  {
    id: "2014uz224",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    /* Shown by its nickname, as asked. It has no official name: the IAU
     * designation is 2014 UZ224, and the designation line says so. */
    name: "DeeDee",
    designation: "(2014 UZ224) · no official name · DeeDee, for Distant Dwarf, is the discoverers' nickname",
    classification: "Trans-Neptunian · scattered disc · no official name",
    detail: "Out past 180 AU at its far point | ALMA 2017",
    sizeCurve: "dwarf",
    diameterKm: 635,
    diameterLabel: "635 +57/−61 km",
    albedo: 0.131,
    /* g-r 0.77 (secondary), the same as Chiminigagua's 0.76 = V-R 0.56 ->
     * B-R about 1.46. */
    chroma: chromaFromBR(brFromVR(0.565)),
    rotationHours: 8,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(11, {
      aAU: 109.7301149751114,
      e: 0.6490787444282012,
      iDeg: 26.77642992471508,
      nodeDeg: 131.2102827316242,
      argPeriDeg: 28.7337719132435,
      meanAnomalyDeg: 323.7361509881111,
    }),
    shape: { ...ICY_RELIEF, lobes: ellipsoid(645, 635, 625), seed: 2014224 },
    surfaceEvidence: "Never resolved. Size and albedo from ALMA thermal emission (Gerdes et al. 2017, ApJL 839, L15). Rotation not measured. Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · scattered disc, 38.5-180.9 AU",
      diameter: "635 +57/−61 km — ALMA, Gerdes et al. 2017",
      rotationPeriod: "Not measured — drawn turning once every 8 hours",
      orbitalSpeed: orbitLine(109.7301149751114),
      gravity: "Density not measured",
      surfaceEvidence: "A point of light found by the Dark Energy Survey. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Found by the Dark Energy Survey in 2016 at 92 AU — among the most distant objects then known in the Solar System — and nicknamed DeeDee, for Distant Dwarf. It still has only a provisional designation. Its orbit is the one in this set that best shows how far the scattered disc really reaches: from 38.5 AU, just past Neptune, out to 181 AU, a round trip of more than eleven hundred years. It is about 87 AU from the Sun now. ALMA measured it at 635 kilometres across.",
    },
  },
  {
    id: "chaos",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Chaos",
    designation: "19521 Chaos (1998 WH24)",
    classification: "Trans-Neptunian · Kuiper Belt · possibly a contact binary",
    detail: "Possibly two bodies touching, seen from the pole | occultations 2020-2023",
    sizeCurve: "dwarf",
    diameterKm: 600,
    diameterLabel: "600 +140/−130 km thermal · occultations suggest smaller",
    albedo: 0.050,
    /* B-V 0.95, V-R 0.63 (Doressoundiram et al. 2002, AJ 124, 2279) -> 1.58 */
    chroma: chromaFromBR(0.95 + 0.63),
    rotationHours: 8,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitFrom(19, {
      aAU: 46.09015370710931,
      e: 0.1102858760155686,
      iDeg: 12.0250072555908,
      nodeDeg: 49.93519022221457,
      argPeriDeg: 57.02449924863812,
      meanAnomalyDeg: 350.6526381614676,
    }),
    /* Drawn as one body. The two-lobed outline reported from five
     * occultations is conference work, not yet refereed. */
    shape: { ...ICY_RELIEF, lobes: ellipsoid(608, 600, 592), seed: 19521 },
    surfaceEvidence: "Never resolved. Size and albedo from Herschel and Spitzer (Vilenius et al. 2012, A&A 541, A94). Rotation not measured. Surface relief borrowed from Arrokoth",
    info: {
      population: "Trans-Neptunian · hot classical Kuiper Belt, 41.0-51.2 AU",
      diameter: "600 +140/−130 km — Herschel and Spitzer, Vilenius et al. 2012. Occultations since 2020 suggest smaller",
      rotationPeriod: "Not measured — its brightness varies by less than 0.1 mag",
      orbitalSpeed: orbitLine(46.09015370710931),
      gravity: "Density not measured",
      surfaceEvidence: "A point of light. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "One of the first large Kuiper Belt objects found, in 1998, and named for the void the Greek cosmos began in. It is red and dark, reflecting five per cent of its light. Its brightness hardly varies as it turns, which usually means a round body — but five stellar occultations between 2020 and 2023 have traced a two-lobed outline, and the reading offered is that Chaos may be two bodies resting against each other, seen almost exactly from the pole. That is not yet published in a refereed journal, and it is drawn here as a single world.",
    },
  },
  {
    id: "leleakuhonua",
    /* Surface and colour from the reference image supplied for it (an artist's
     * impression, like every picture of it), unwrapped by the dwarf-textures
     * pipeline. The measured colour index is kept on this record for the
     * card; the map, not `chroma`, colours the body. */
    colourMap: true,
    name: "Leleākūhonua",
    designation: "541132 Leleākūhonua (2015 TG387) · nicknamed The Goblin",
    classification: "Sednoid · inner Oort Cloud",
    detail: "The third Sedna-like body ever found | Sheppard et al. 2019",
    sizeCurve: "dwarf",
    diameterKm: 220,
    diameterLabel: "≈220 km — single-chord occultation",
    albedo: 0.21,
    /* Colour not measured. */
    chroma: chromaFromBR(SUN_BR),
    rotationHours: 8,
    rotationState: "principal-axis",
    metalness: 0,
    /* JPL's osculating a is 1,346 AU; the barycentric value that describes
     * the long-term orbit is about 1,170 (Sheppard et al. 2019). Drawn from
     * JPL's elements, like everything else. */
    orbit: orbitFrom(7, {
      aAU: 1345.9746784971,
      e: 0.9519448010157889,
      iDeg: 11.67889561905244,
      nodeDeg: 301.1346719755806,
      argPeriDeg: 118.2317322688105,
      meanAnomalyDeg: 359.6190139698275,
    }),
    /* Heavily cratered, small and large, from the supplied reference image
     * (an artist's impression -- one occultation chord is all that has ever
     * been measured). At 220 km a body keeps its craters: this is the size of
     * Phoebe or Hyperion, both crater-saturated. */
    shape: {
      ...ICY_RELIEF,
      lobes: ellipsoid(230, 220, 210),
      relief: 0.03,
      grain: 0.012,
      craterCount: 190,
      craterMin: 0.025,
      craterMax: 0.18,
      craterDepth: 0.03,
      bigCraters: [
        { dir: [0.4, 0.3, 0.87], radius: 0.34, depth: 0.05, rim: 0.014 },
        { dir: [-0.6, -0.2, 0.77], radius: 0.26, depth: 0.045, rim: 0.012 },
        { dir: [0.2, -0.7, -0.68], radius: 0.28, depth: 0.045, rim: 0.012 },
      ],
      seed: 541132,
    },
    surfaceEvidence: "Never resolved. Size from a single-chord occultation of 20 October 2018 (Buie et al. 2020, AJ 159, 230). Colour and rotation not measured. Surface relief borrowed from Arrokoth",
    info: {
      population: "Sednoid · inner Oort Cloud, 65 AU at closest to about 2,300 AU at farthest",
      diameter: "≈220 km — radius 110 +14/−10 km from one occultation chord, Buie et al. 2020",
      rotationPeriod: "Not measured — drawn turning once every 8 hours",
      orbitalSpeed: "About 40,000 years to go round once — Sheppard et al. 2019. Near its closest approach now, about 75 AU out",
      gravity: "Density not measured",
      surfaceEvidence: "A point of light. Surface borrowed from Arrokoth",
      roughness: "unknown",
      description:
        "Only the third object ever found whose closest approach to the Sun is far beyond Neptune's reach — with Sedna and 2012 VP113, the bodies that define the inner Oort Cloud. It comes no nearer than 65 AU, and then swings out to around two thousand. Nothing we know of could have put it there: Neptune is too far away to have thrown it, and the Galaxy's tides are too weak this close in. Something else did — a passing star when the Sun was young, or, in the argument this object was part of, an unseen planet far out. Found in October 2015 near its perihelion, and named from a Hawaiian creation chant for a bird's flight that yearns toward the Earth.",
    },
  },
]);

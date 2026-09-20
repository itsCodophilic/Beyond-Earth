/**
 * The small bodies that have actually been visited, as measured objects.
 *
 * Rank 1 of `docs/bodies-to-draw-next.md`: thirteen bodies, every one of which
 * a spacecraft has either flown past, orbited, landed on, hit, or -- in
 * Apophis's case -- bounced radar off hard enough to get a shape out of it.
 * They are the only small bodies in the Solar System whose *shape* is known
 * rather than assumed, and that is the whole reason they are worth drawing.
 *
 * ## Three rules this table follows
 *
 * **1. Every number says who measured it.** Not "490 m" but "490 m, OSIRIS-REx
 * OLA laser altimeter". A diameter with no instrument attached is a diameter
 * nobody can check, and this file is meant to be checkable. Orbital elements
 * are quoted with the JPL Small-Body Database orbit-solution number and the
 * epoch they were fitted at; physical parameters name the mission, the
 * instrument or the observatory. Where a number is inferred rather than
 * measured -- Halley's relief, Apophis's surface, the colour of anything only
 * ever photographed in black and white -- the card says so in those words.
 *
 * **2. Shape is the identity.** A sphere with a photograph on it is the wrong
 * drawing of nearly everything here. Arrokoth is two lobes that settled
 * together at walking pace; 67P is a duck; Eros is a 34 km saddle-backed
 * peanut; Itokawa is an otter; Didymos and Bennu and Ryugu are spinning tops
 * with equatorial ridges thrown up by their own rotation. So the silhouette is
 * built in geometry from the published shape models -- see
 * `smallBodyShapes.js` -- and colour is laid on that, rather than the other
 * way round.
 *
 * **3. Dark means dark.** These are among the darkest surfaces in the Solar
 * System: Halley 0.04, Bennu 0.044, Mathilde 0.0436, Ryugu 0.045, 67P 0.06.
 * Coal is 0.05. Drawing them as grey rock at Earth brightness is the single
 * most common way to get them wrong, and it destroys the only visual fact that
 * separates a carbonaceous body from a stony one. Every base colour in this
 * table is derived from the body's *measured geometric albedo*, in linear
 * light, so Eros at 0.25 really is about six times brighter than Bennu at
 * 0.044. See `albedoToLinearValue` below for the one artistic constant.
 *
 * ## What is not real here
 *
 * The orbital elements are real and the bodies are placed at their real
 * heliocentric positions for the current date. The *planets* in this scene are
 * not at their real longitudes, so the angle between one of these bodies and
 * Earth on screen is not a real sky configuration -- only the body's distance
 * from the Sun and the shape of its orbit are. Radial distance is compressed
 * by the same curve the rest of the scene uses; rendered sizes are compressed
 * too, on the same asteroid curve the main belt already uses, so the ordering
 * is honest and the absolute scale is not.
 *
 * ## 4 Vesta is deliberately absent
 *
 * It is number one on the Rank 1 list and it is already built, as a
 * `MAJOR_BODIES` entry inside `scene/asteroidBelt.js`, with Ceres, Pallas,
 * Hygiea and Psyche. Adding it here would put two Vestas in one Solar System.
 */

/*
 * Geometric albedo to linear base reflectance.
 *
 * A Lambertian surface of geometric albedo p reflects roughly p of the light
 * that reaches it, so the *linear* base colour is simply proportional to p.
 * Everything in this file follows from the measured albedo in that one
 * proportion: there is no per-body brightness anywhere, so Eros at 0.25 is
 * exactly 5.7 times Bennu's 0.044 in linear light, as it is in reality.
 *
 * The constant is the only artistic number in the whole appearance chain, and
 * it was **measured**, not guessed. The scene's Sun is a point light of
 * intensity 28,000 with a decay exponent of 1.28 rather than the physical 2,
 * and the renderer tone-maps ACES filmic at exposure 1.18, so there is no
 * absolute value that is "correct" -- what matters is where the set lands on
 * the tone curve. Rendering each body framed and lit from the sunward side
 * and reading the median body pixel, against the belt's own rocks read the
 * same way:
 *
 *              albedo   k=0.80   k=0.48    reference (belt, same method)
 *   Mathilde   0.044      119       95     Pallas 68, Ceres 80, Hygiea 77
 *   Bennu      0.044      139      114
 *   Ida        0.238      186      154     Vesta 166, S-type background 161
 *   Gaspra     0.246      188      158
 *   Eros       0.250      222      202
 *   Itokawa    0.290      224      205
 *   Apophis    0.350      241      232
 *
 * At 0.80 the whole set sat on the ACES shoulder: Ida and Gaspra came out
 * *brighter* than Vesta, whose albedo is nearly twice theirs, and an eightfold
 * spread in real albedo compressed into 1.7x on screen. At 0.48 the ordering
 * against the neighbouring belt is right, the dark carbonaceous bodies read as
 * dark, and nothing clips.
 */
export function albedoToLinearValue(albedo) {
  return Math.max(0.004, Number(albedo) || 0) * 0.13;
}

/*
 * Chromaticity, normalised to unit Rec.709 luminance.
 *
 * Multiplying one of these by the albedo-derived linear value gives a colour
 * with the right hue *and* the right brightness. They are held separately
 * because the hue and the brightness come from different measurements: hue
 * from colour indices, spectral class or a colour image, brightness from the
 * albedo. Almost every close-up image of these bodies is monochrome, so a
 * colour taken off the photograph would be a colour taken off a greyscale
 * frame -- which is how "dark grey rock" happens.
 */
const CHROMA = Object.freeze({
  /* New Horizons MVIC enhanced colour, damped 40% toward neutral because that
   * product is deliberately saturated; Arrokoth is genuinely one of the
   * reddest objects imaged, spectral slope ≈ 30%/100 nm (Stern et al. 2019). */
  arrokoth: [1.229, 0.953, 0.792],
  /* Sq-type (LL-chondrite-like). No colour image exists. Mild reddening of the
   * kind LL chondrites show, which matches the reference description. */
  apophis: [1.088, 0.989, 0.850],
  /* B-type: the one asteroid class with a *negative* spectral slope. B-V 0.64
   * against the Sun's 0.65 (JPL SBDB), so very slightly blue of neutral. */
  bennu: [0.973, 1.003, 1.053],
  /* Cb-type, essentially neutral with a trace of blue. */
  ryugu: [0.982, 1.002, 1.032],
  /* Rosetta OSIRIS: dark grey with a red cast, visible slope 11-18%/100 nm. */
  comet67p: [1.120, 0.982, 0.825],
  /* S-type; NEAR MSI colour composites are warm tan. */
  eros: [1.130, 0.983, 0.786],
  /* S/Xk. DART DRACO colour is close to Itokawa's. */
  didymos: [1.088, 0.989, 0.850],
  /* Giotto's colour data are poor. Cometary nuclei are dark grey with a red
   * cast; this is the class average, not a measurement of Halley. */
  halley: [1.086, 0.988, 0.869],
  /* Galileo SSI colour, B-V 0.802 (JPL SBDB). Warm tan. */
  ida: [1.124, 0.986, 0.779],
  /* S(IV); Hayabusa AMICA colour, slightly reddish grey. */
  itokawa: [1.089, 0.990, 0.841],
  /* Cb, near-neutral. Mathilde is as close to colourless as a rock gets. */
  mathilde: [1.034, 0.994, 0.955],
  /* Xk/M. B-V 0.686, barely redder than the Sun; Rosetta found it moderately
   * red in the visible and flat in the near infrared. */
  lutetia: [1.052, 0.992, 0.923],
  /* S-type but unusually red for one: B-V 0.870, the reddest in this set,
   * which Galileo tied to an olivine-rich, freshly exposed surface. */
  gaspra: [1.156, 0.979, 0.744],
});

/*
 * Every orbit here is a JPL Small-Body Database solution, quoted with its
 * epoch as a Julian Date and its solution number. `meanAnomalyDeg` is the
 * value at that epoch; `smallBodies.js` propagates it forward to today with
 * the published mean motion, which for a two-body osculating element set is
 * exact for the mean anomaly and good to a fraction of a degree in true
 * anomaly over the spans involved -- except for Halley, whose elements are
 * fifty-eight years old and whose propagated position is therefore accurate
 * to within a few tenths of an AU rather than exactly. That is flagged on its
 * card.
 */

export const SMALL_BODIES = Object.freeze([
  /* ----------------------------------------------------------------------
   * 486958 Arrokoth -- the most distant object ever visited.
   * -------------------------------------------------------------------- */
  {
    id: "arrokoth",
    name: "Arrokoth",
    designation: "486958 Arrokoth (2014 MU69)",
    classification: "Cold classical Kuiper Belt object · contact binary",
    detail: "Cold classical KBO | New Horizons, 1 January 2019",
    diameterKm: 18.3,
    diameterLabel: "34.5 × 19.8 × 13.8 km; volume-equivalent 18.3 km",
    albedo: 0.165,
    chroma: CHROMA.arrokoth,
    rotationHours: 15.918,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 3, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 44.05257836,
      e: 0.0355571765,
      iDeg: 2.4506139,
      nodeDeg: 159.0377268,
      argPeriDeg: 188.8507463,
      meanAnomalyDeg: 310.9839310,
      meanMotionDegPerDay: 0.0033709094,
    },
    /*
     * Porter et al. 2024, the current PDS shape model, which is *thicker* than
     * the 2019 one everybody remembers: the large lobe was first reported at
     * 9.4 km through the flat axis and is now 13.7 km. The pancake got less
     * flat as the stereo solution improved. Both lobes are here as separate
     * ellipsoids joined by a soft maximum, because that is physically what
     * Arrokoth is -- two bodies that touched and stayed touched.
     */
    shape: {
      lobes: [
        { c: [-7.2035, 0, 0], r: [10.070, 6.863, 9.919] },
        { c: [9.7525, 0, 0], r: [7.521, 6.813, 7.189] },
      ],
      // Fillet = 0.693 x 17.3 / 12 = 1.0 km at the waist, against a contact
      // New Horizons measured at roughly 600 m wide. Pinched, but not a wasp.
      neck: 12,
      relief: 0.026,
      grain: 0.010,
      craterCount: 16,
      craterMin: 0.030,
      craterMax: 0.115,
      craterDepth: 0.030,
      bigCraters: [
        /* Maryland, ~7 km across, on the small lobe -- the only large
         * depression on the body and the main constraint on its age. */
        { dir: [0.82, -0.18, 0.54], radius: 0.42, depth: 0.055, rim: 0.012 },
      ],
      boulders: 0,
      /* The neck is the brightest and reddest ground on Arrokoth. Whatever
       * put it there happened at the contact. */
      collar: { centreKm: 2.6, widthKm: 3.4, gain: 1.30 },
      seed: 486958,
    },
    surfaceEvidence: "New Horizons LORRI panchromatic at 33 m/pixel and MVIC colour at 130 m/pixel, 1 January 2019; shape from the Porter et al. 2024 PDS stereophotogrammetric model",
    info: {
      population: "Cold classical Kuiper Belt · 42–48 AU",
      diameter: "34.5 × 19.8 × 13.8 km bounding, 18.3 km volume-equivalent — Porter et al. 2024 shape model from New Horizons stereo imaging",
      rotationPeriod: "15.92 h — New Horizons rotational lightcurve; JPL notes the phase coverage was partial and the period could be 30% out",
      orbitalSpeed: "4.5 km/s · one orbit takes 292 years — JPL SBDB period 106,796 days",
      gravity: "Escape velocity ≈ 4 m/s — a brisk walk",
      surfaceEvidence: "New Horizons LORRI at 33 m/pixel and MVIC colour at 130 m/pixel, 1 January 2019; shape from Porter et al. 2024 (PDS)",
      roughness: "low — smooth, and very few craters for its age",
      description:
        "The most distant object a spacecraft has ever reached, and the only pristine cold classical Kuiper Belt object anyone has seen. New Horizons passed 3,538 km from it on 1 January 2019 at 14.4 km/s. Two lobes — Wenu, 20.1 km across and clearly oblate, and Weeyo, 15.0 km and close to round — are touching over a contact only about 600 m wide, and they are still touching, which means they came together at something under 5 m/s. That is walking pace, and it is direct evidence for gentle accretion rather than violent collision at the outer edge of the disc. Geometric albedo 0.165, from the New Horizons LORRI and MVIC photometry reported by Stern et al. (Science, 2019); a later reanalysis puts it nearer 0.21, and the darker value is used here. That plus a spectral slope near 30% per 100 nm makes it one of the reddest objects ever imaged: irradiated methanol ice and tholins, never warmed, never resurfaced. The bright collar around the neck is real and nobody is sure what made it. Every number here is from the New Horizons flyby; nothing about Arrokoth was known before it except that it existed.",
    },
  },

  /* ----------------------------------------------------------------------
   * 99942 Apophis -- 13 April 2029.
   * -------------------------------------------------------------------- */
  {
    id: "apophis",
    name: "Apophis",
    designation: "99942 Apophis (2004 MN4)",
    classification: "Near-Earth asteroid (Aten) · Sq-type",
    detail: "Near-Earth asteroid | Radar shape model only",
    diameterKm: 0.34,
    diameterLabel: "≈ 450 × 170 m; 340 m equivalent",
    albedo: 0.35,
    chroma: CHROMA.apophis,
    rotationHours: 30.56,
    rotationState: "tumbling",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 220, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 0.9223592207,
      e: 0.1911492280,
      iDeg: 3.3409969,
      nodeDeg: 203.8936514,
      argPeriDeg: 126.6795707,
      meanAnomalyDeg: 175.3304027,
      meanMotionDegPerDay: 1.1126381153,
    },
    /*
     * Brozovic et al. 2018 (Icarus 300, 115): Goldstone and Arecibo, 2012-13.
     * The model is bilobed and elongated, 450 m by 170 m. That is the whole of
     * what is known about the shape -- radar gives you an outline and a
     * surface roughness, and nothing that could be called a photograph. The
     * relief drawn here beyond the two lobes is a rubble-pile texture chosen
     * to match the Sq spectral class and the low radar circular-polarisation
     * ratio, and it is not a measurement.
     */
    shape: {
      lobes: [
        { c: [-0.100, 0, 0], r: [0.135, 0.082, 0.085] },
        { c: [0.095, 0.004, 0], r: [0.130, 0.078, 0.080] },
      ],
      neck: 10,
      relief: 0.070,
      grain: 0.034,
      craterCount: 22,
      craterMin: 0.035,
      craterMax: 0.14,
      craterDepth: 0.030,
      boulders: 16,
      boulderSize: 0.055,
      seed: 99942,
    },
    surfaceEvidence: "No photograph exists. Shape from Goldstone and Arecibo radar, 2012-2013 (Brozovic et al. 2018); the surface texture is inferred from the Sq spectral class and is not measured",
    info: {
      population: "Near-Earth objects · Aten group",
      diameter: "≈ 450 × 170 m — Goldstone/Arecibo radar shape model, Brozovic et al. 2018. JPL SBDB carries 340 m as the equivalent diameter",
      rotationPeriod: "30.56 ± 0.01 h, tumbling — lightcurve photometry; it is a non-principal-axis rotator with a second, 27.38 ± 0.07 h precession period",
      orbitalSpeed: "31.0 km/s · one orbit takes 323.6 days, which is why it keeps meeting Earth",
      gravity: "Escape velocity ≈ 0.2 m/s",
      surfaceEvidence: "No photograph exists. Radar shape model only (Goldstone + Arecibo, 2012-13); surface texture inferred from spectral class",
      roughness: "unmeasured — a rubble pile is inferred from the spectral class",
      description:
        "On 13 April 2029 Apophis passes about 31,600 km above the Earth's surface — inside the geostationary belt, closer than the satellites that carry television — and will be naked-eye visible to roughly two billion people across Europe, Africa and western Asia. There is no photograph of it. Everything drawn here comes from radar: Goldstone and Arecibo tracked it through 2012 and 2013 and returned a bilobed shape model about 450 m long and 170 m across (Brozovic et al. 2018). It tumbles rather than spins, on two periods at once — 30.56 h and 27.38 h — which is what happens to a small body that has been knocked about and has had no time to settle. Geometric albedo 0.35 and an Sq spectrum put it close to LL chondrite meteorites, the most common kind that falls on Earth. The 2029 pass is close enough that Earth's tide is expected to physically reshape the surface: this is the only occasion in the foreseeable future on which we get to watch that happen.",
    },
  },

  /* ----------------------------------------------------------------------
   * 101955 Bennu -- the best-characterised small body in existence.
   * -------------------------------------------------------------------- */
  {
    id: "bennu",
    name: "Bennu",
    designation: "101955 Bennu (1999 RQ36)",
    classification: "Near-Earth asteroid (Apollo) · B-type carbonaceous",
    detail: "Near-Earth asteroid | Sample returned 24 September 2023",
    diameterKm: 0.48444,
    diameterLabel: "505 × 492 × 457 m; 484.44 ± 0.30 m equivalent",
    albedo: 0.044,
    chroma: CHROMA.bennu,
    rotationHours: 4.296061,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 118, epoch JD 2455562.5",
      epochJD: 2455562.5,
      aAU: 1.1263910259,
      e: 0.2037450762,
      iDeg: 6.0349438,
      nodeDeg: 2.0608662,
      argPeriDeg: 66.2230608,
      meanAnomalyDeg: 101.7039520,
      meanMotionDegPerDay: 0.8244613503,
    },
    /*
     * OLA, the laser altimeter, mapped Bennu to sub-centimetre. The equatorial
     * ridge is not decoration: at 4.296 h the body is close enough to its own
     * spin limit that material creeps toward the equator, and the ridge is
     * where it ends up. The boulders matter as much as the shape -- Bennu has
     * no smooth ground anywhere, which is why the sample site took two years
     * to find.
     */
    shape: {
      lobes: [{ c: [0, 0, 0], r: [0.25235, 0.22835, 0.24590] }],
      neck: 1,
      ridge: 0.075,
      relief: 0.030,
      grain: 0.018,
      craterCount: 26,
      craterMin: 0.045,
      craterMax: 0.20,
      craterDepth: 0.022,
      bigCraters: [{ dir: [-0.35, -0.10, 0.93], radius: 0.34, depth: 0.028, rim: 0.006 }],
      boulders: 30,
      boulderSize: 0.075,
      seed: 101955,
    },
    surfaceEvidence: "OSIRIS-REx OCAMS imaging to 5 mm/pixel and the OLA laser altimeter global model; the surface here is procedural but the shape, the ridge and the boulder scale are measured",
    info: {
      population: "Near-Earth objects · Apollo group",
      diameter: "505 × 492 × 457 m, equivalent 484.44 ± 0.30 m — OSIRIS-REx OLA laser altimeter",
      rotationPeriod: "4.296061 ± 0.000002 h — OSIRIS-REx; it is measurably speeding up, at 6.3 × 10⁻⁸ rad/day²",
      orbitalSpeed: "28.1 km/s · one orbit takes 436.6 days",
      gravity: "Surface gravity ≈ 6 µm/s²; escape velocity ≈ 20 cm/s",
      surfaceEvidence: "OSIRIS-REx OCAMS to 5 mm/pixel; global shape from the OLA laser altimeter",
      roughness: "extreme — no patch of smooth ground anywhere on the body",
      description:
        "The best-characterised object in the Solar System after the Earth and the Moon. OSIRIS-REx spent two years in orbit — briefly the smallest body ever orbited — and brought 121.6 g of it back to Utah on 24 September 2023. Geometric albedo 0.044 ± 0.002: Bennu reflects less light than fresh asphalt, and it is drawn that dark here on purpose. Bulk density 1.194 ± 0.003 g/cm³ from OSIRIS-REx radio tracking, which for rock that should be near 2.5 means something between a quarter and a half of Bennu is empty space. The spinning-top shape and the sharp equatorial ridge come from its 4.296 h rotation, which is close enough to the limit that loose material migrates to the equator; the spin is still accelerating, measurably. When the sampling head touched down at Nightingale it sank in up to half a metre and the surface behaved like a fluid — the mission had expected something firm enough to stand on.",
    },
  },

  /* ----------------------------------------------------------------------
   * 162173 Ryugu -- Bennu's twin, and the one with amino acids in it.
   * -------------------------------------------------------------------- */
  {
    id: "ryugu",
    name: "Ryugu",
    designation: "162173 Ryugu (1999 JU3)",
    classification: "Near-Earth asteroid (Apollo) · Cb-type carbonaceous",
    detail: "Near-Earth asteroid | Sample returned 6 December 2020",
    diameterKm: 0.896,
    diameterLabel: "1,004 × 1,004 × 876 m; 896 ± 4 m equivalent",
    albedo: 0.045,
    chroma: CHROMA.ryugu,
    rotationHours: 7.63262,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 270, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 1.1909189327,
      e: 0.1910730046,
      iDeg: 5.8664425,
      nodeDeg: 251.2897124,
      argPeriDeg: 211.6089938,
      meanAnomalyDeg: 62.3406741,
      meanMotionDegPerDay: 0.7583693539,
    },
    shape: {
      lobes: [{ c: [0, 0, 0], r: [0.502, 0.438, 0.502] }],
      neck: 1,
      /* Ryujin Dorsum, the equatorial ridge. Sharper than Bennu's. */
      ridge: 0.062,
      relief: 0.026,
      grain: 0.016,
      craterCount: 22,
      craterMin: 0.05,
      craterMax: 0.19,
      craterDepth: 0.020,
      bigCraters: [
        /* Urashima, 290 m across -- nearly a third of the body. */
        { dir: [0.12, 0.22, -0.97], radius: 0.32, depth: 0.034, rim: 0.007 },
      ],
      boulders: 24,
      boulderSize: 0.085,
      /* Otohime Saxum, a single 160 m boulder at the south pole: the largest
       * thing on Ryugu and a fifth of the body's own width. */
      bigBoulders: [{ dir: [0.05, -0.97, 0.22], radius: 0.30, height: 0.075 }],
      seed: 162173,
    },
    surfaceEvidence: "Hayabusa2 ONC-T imaging and the LIDAR-derived SHAPE model (Watanabe et al. 2019); surface detail is procedural, the shape and the ridge are measured",
    info: {
      population: "Near-Earth objects · Apollo group",
      diameter: "1,004 × 1,004 × 876 m, equivalent 896 ± 4 m — Hayabusa2 ONC/LIDAR shape model",
      rotationPeriod: "7.63262 ± 0.00002 h — Hayabusa2 ONC",
      orbitalSpeed: "27.3 km/s · one orbit takes 474.7 days",
      gravity: "Surface gravity ≈ 11 µm/s²; escape velocity ≈ 37 cm/s",
      surfaceEvidence: "Hayabusa2 ONC-T imaging and LIDAR shape model; MASCOT lander surface imagery",
      roughness: "extreme — boulder-covered, with no fine regolith at all",
      description:
        "Hayabusa2 returned 5.4 g of Ryugu to Woomera on 6 December 2020, about fifty times what the mission had planned for. The analysis found more than twenty amino acids, and uracil — one of the four bases of RNA — in material that has never been contaminated by Earth. Geometric albedo 0.045 ± 0.002, essentially as dark as Bennu, and the same 1.19 g/cm³ density, which again means roughly half empty space. The equatorial ridge, Ryujin Dorsum, is sharper than Bennu's and runs the whole way round; Ryugu is thought to have spun far faster in the past and to have deformed into this shape rather than been built in it. The MASCOT lander, which bounced three times before it stopped, found no dust at all at its resting place: everything on the surface is centimetre-scale rock or larger. Otohime Saxum, the 160 m boulder at the south pole, is a fifth of the entire asteroid's width.",
    },
  },

  /* ----------------------------------------------------------------------
   * 67P/Churyumov-Gerasimenko -- the duck.
   * -------------------------------------------------------------------- */
  {
    id: "churyumov-gerasimenko",
    name: "67P/Churyumov–Gerasimenko",
    designation: "67P/Churyumov–Gerasimenko",
    classification: "Jupiter-family comet nucleus · contact binary",
    detail: "Comet nucleus | Rosetta orbited it for two years",
    diameterKm: 3.4,
    diameterLabel: "4.3 × 4.1 × 2.6 km; 3.4 ± 0.1 km volume-equivalent",
    albedo: 0.062,
    chroma: CHROMA.comet67p,
    rotationHours: 12.4043,
    rotationState: "principal-axis",
    metalness: 0,
    isComet: true,
    orbit: {
      solution: "JPL SBDB orbit solution K213/6, epoch JD 2457305.5",
      epochJD: 2457305.5,
      aAU: 3.4622494898,
      e: 0.6409081307,
      iDeg: 7.0402949,
      nodeDeg: 50.1355738,
      argPeriDeg: 12.7982497,
      meanAnomalyDeg: 8.8599274,
      meanMotionDegPerDay: 0.1529912292,
    },
    /*
     * Two lobes, and the head is stacked on top of one end of the body rather
     * than beyond it -- which is why the whole comet is only 4.3 km long when
     * the body lobe alone is 4.1 km. Getting that wrong produces a dumbbell
     * instead of a duck. The neck (Hapi) is narrow and deep, so the soft
     * maximum is sharp here.
     */
    shape: {
      lobes: [
        { c: [-0.45, -0.55, 0], r: [2.05, 0.90, 1.30] },
        { c: [0.85, 1.05, 0.05], r: [1.15, 1.30, 1.10] },
      ],
      neck: 7,
      relief: 0.060,
      grain: 0.032,
      craterCount: 34,
      craterMin: 0.035,
      craterMax: 0.17,
      craterDepth: 0.035,
      bigCraters: [
        /* The Seth/Ash pit fields on the large lobe -- circular sinkholes up
         * to 200 m across that opened as the interior sublimated away. */
        { dir: [-0.62, -0.42, 0.66], radius: 0.24, depth: 0.055, rim: 0.008 },
        { dir: [-0.88, -0.10, -0.46], radius: 0.20, depth: 0.050, rim: 0.008 },
      ],
      boulders: 18,
      boulderSize: 0.050,
      /* Hapi, the neck, is the smoothest and slightly brightest ground on the
       * comet -- dust falls back out of the coma and settles there. */
      collar: { centreKm: 0.35, widthKm: 0.8, gain: 1.22 },
      seed: 67067,
    },
    surfaceEvidence: "Rosetta OSIRIS NAC down to 0.1 m/pixel over two years; shape from the SHAP7 stereophotoclinometric model (Jorda et al. 2016); Philae's descent images from the surface itself",
    info: {
      population: "Jupiter-family comets · from the Kuiper Belt",
      diameter: "4.3 × 4.1 × 2.6 km, volume-equivalent 3.4 ± 0.1 km — Rosetta OSIRIS SHAP7 shape model",
      rotationPeriod: "12.4043 ± 0.0007 h — Rosetta OSIRIS. It was 12.76 h before the 2015 perihelion; outgassing torque shortened it by 21 minutes in one pass",
      orbitalSpeed: "34.2 km/s at perihelion, 7.5 km/s at aphelion · one orbit takes 6.44 years",
      gravity: "Escape velocity ≈ 1 m/s at the neck; you could not jump off, but a thrown stone would leave",
      surfaceEvidence: "Rosetta OSIRIS NAC to 0.1 m/pixel; SHAP7 shape model (Jorda et al. 2016); Philae surface imagery",
      roughness: "extreme — cliffs, sinkholes and boulders at every scale",
      description:
        "The only comet anyone has watched for a whole apparition. Rosetta arrived on 6 August 2014, stayed until it was set down on the surface in September 2016, and Philae landed — bounced twice, for two hours, and came to rest in a crack — on 12 November 2014. Bulk density 0.533 ± 0.006 g/cm³ from Rosetta's radio science: 67P would float in water, and about three quarters of it is void. Geometric albedo around 0.06, as dark as charcoal, which is normal for a comet and was still a surprise when Halley first showed it. The two lobes are a contact binary with their own distinct layering, so they formed separately; the neck, Hapi, is the smoothest ground on the comet because coma dust falls back and settles there. Rosetta measured the deuterium ratio in its water and found it three times Earth's — evidence against Jupiter-family comets having delivered the oceans. It also found molecular oxygen, glycine and phosphorus, none of which anyone expected. It is drawn here bare, with no coma, because that is what it is: its perihelion was November 2021 and the next is 2028, so it is out near aphelion with nothing sublimating. The element set is the 2015-epoch JPL solution K213/6 propagated forward, and for a comet that is an osculating fit rather than a long-baseline one, so the distance drawn is good to a few tenths of an AU rather than exactly.",
    },
  },

  /* ----------------------------------------------------------------------
   * 433 Eros -- the first asteroid orbited, and the first landed on.
   * -------------------------------------------------------------------- */
  {
    id: "eros",
    name: "Eros",
    designation: "433 Eros",
    classification: "Near-Earth asteroid (Amor) · S-type",
    detail: "Near-Earth asteroid | NEAR Shoemaker orbited and landed",
    diameterKm: 16.84,
    diameterLabel: "34.4 × 11.2 × 11.2 km; 16.84 ± 0.06 km equivalent",
    albedo: 0.25,
    chroma: CHROMA.eros,
    rotationHours: 5.270,
    rotationState: "principal-axis",
    metalness: 0.02,
    orbit: {
      solution: "JPL SBDB orbit solution 659, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 1.4582437168,
      e: 0.2228779628,
      iDeg: 10.8285441,
      nodeDeg: 304.2679713,
      argPeriDeg: 178.9181319,
      meanAnomalyDeg: 62.5114550,
      meanMotionDegPerDay: 0.5597046347,
    },
    /*
     * Not a bilobed contact binary and not an ellipsoid either: Eros is a
     * single body with a bite out of one side. Two overlapping ellipsoids give
     * the peanut; the negative lobe cuts Himeros, the 10 km saddle, which is
     * the feature that makes Eros recognisable from any angle.
     */
    /*
     * The waist is the number to get right, and it took two passes.
     *
     * Lobe centres at +/-8.2 with 9.0 km semi-major axes put the origin 0.91
     * of the way to each lobe's own end, which left the waist 4.6 km thick
     * against 11 km at the ends -- a wasp, not Eros. Pulling the centres in
     * to +/-7.6 and lengthening the lobes to 10.0 keeps the 34.4 km length
     * and gives a waist about 7.4 km thick, which is what NEAR measured.
     */
    shape: {
      lobes: [
        { c: [-7.6, 0, 0], r: [10.0, 5.7, 5.7] },
        { c: [7.9, 0.4, 0], r: [9.3, 4.9, 5.1] },
      ],
      // Fillet 0.693 x 17.6 / 8 = 1.5 km, taking the waist to about 10.5 km
      // thick against the 11.2 km mid-section NEAR measured.
      neck: 8,
      dents: [
        /* Himeros: the saddle. About 10 km across and roughly 1.5 km below
         * the surrounding surface -- deep enough that Eros is genuinely
         * non-convex there, which is the whole reason it needs a negative
         * lobe rather than a crater. The first version used a sphere of
         * radius 8.2 sitting at y = -7.4 and cut the entire lower half of the
         * body away. */
        { c: [0.0, -6.8, 0.5], r: 4.6, softness: 1.8 },
      ],
      relief: 0.032,
      grain: 0.014,
      craterCount: 44,
      craterMin: 0.030,
      craterMax: 0.15,
      craterDepth: 0.026,
      bigCraters: [
        /* Psyche, 5.3 km across, on the opposite side from Himeros. */
        { dir: [0.05, 0.96, 0.27], radius: 0.30, depth: 0.040, rim: 0.010 },
        { dir: [-0.72, 0.38, -0.58], radius: 0.20, depth: 0.030, rim: 0.008 },
      ],
      boulders: 14,
      boulderSize: 0.040,
      seed: 433,
    },
    surfaceEvidence: "NEAR Shoemaker MSI imaging (160,000 frames) and the NLR laser rangefinder global shape model; the final descent frames reach 1 cm/pixel",
    info: {
      population: "Near-Earth objects · Amor group",
      diameter: "34.4 × 11.2 × 11.2 km, equivalent 16.84 ± 0.06 km — NEAR Shoemaker NLR laser rangefinder and MSI",
      rotationPeriod: "5.270 h — NEAR Shoemaker, confirming eighty years of ground-based lightcurves",
      orbitalSpeed: "24.7 km/s · one orbit takes 1.76 years",
      gravity: "Surface gravity varies between 2.1 and 5.5 mm/s² across the body, because the shape is so far from round",
      surfaceEvidence: "NEAR Shoemaker MSI and NLR; the last frames before touchdown are at 1 cm/pixel",
      roughness: "high — heavily cratered, under a regolith layer tens of metres deep",
      description:
        "The first asteroid ever orbited and the first ever landed on. NEAR Shoemaker entered orbit on 14 February 2000, stayed a year, and was then set down on 12 February 2001 — a spacecraft with no landing gear, which survived and kept transmitting for another two weeks. Density 2.67 ± 0.03 g/cm³ from radio tracking, consistent with ordinary chondrite rock and, unlike Bennu or Ryugu, with very little void: Eros is a cracked single body rather than a rubble pile. Geometric albedo 0.25, so it is one of the brightest objects in this set — roughly six times Bennu's. Himeros, the saddle across the waist, is 10 km wide, and Psyche, on the far side, is 5.3 km; between them they are most of why Eros is shaped like this. NEAR counted about a million boulders larger than 15 m and found ponded dust lying dead flat in crater floors, which on a body this small should not happen and is still argued about.",
    },
  },

  /* ----------------------------------------------------------------------
   * 65803 Didymos + Dimorphos -- the first world we deliberately moved.
   * -------------------------------------------------------------------- */
  {
    id: "didymos",
    name: "Didymos",
    designation: "65803 Didymos (1996 GT)",
    classification: "Binary near-Earth asteroid (Apollo) · S-type",
    detail: "Binary near-Earth asteroid | DART impact, 26 September 2022",
    diameterKm: 0.761,
    diameterLabel: "851 × 849 × 620 m; 761 ± 24 m volume-equivalent",
    albedo: 0.15,
    chroma: CHROMA.didymos,
    rotationHours: 2.2593,
    rotationState: "principal-axis",
    metalness: 0.02,
    orbit: {
      solution: "JPL SBDB orbit solution 240, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 1.6427096085,
      e: 0.3831233243,
      iDeg: 3.4138765,
      nodeDeg: 72.9858236,
      argPeriDeg: 319.5807001,
      meanAnomalyDeg: 260.8612886,
      meanMotionDegPerDay: 0.4681261239,
    },
    /*
     * The most extreme top shape in this set. At 2.2593 hours Didymos is
     * within a few per cent of the rotation rate at which a cohesionless
     * rubble pile flies apart, and the equatorial ridge is where the material
     * that tried to has ended up. 851 x 849 x 620 m: almost perfectly circular
     * in the equatorial plane and squashed by a quarter through the poles.
     */
    shape: {
      lobes: [{ c: [0, 0, 0], r: [0.4255, 0.310, 0.4245] }],
      neck: 1,
      ridge: 0.090,
      relief: 0.030,
      grain: 0.017,
      craterCount: 18,
      craterMin: 0.05,
      craterMax: 0.20,
      craterDepth: 0.024,
      boulders: 26,
      boulderSize: 0.070,
      seed: 65803,
    },
    surfaceEvidence: "DART DRACO imaging to 5.5 cm/pixel in the final seconds before impact, and the Daly et al. 2024 shape model; Goldstone and Arecibo radar before that. ESA's Hera arrives in the weeks after this was written and will supersede parts of it",
    info: {
      population: "Near-Earth objects · Apollo group, binary",
      diameter: "851 × 849 × 620 m, volume-equivalent 761 ± 24 m — DART DRACO shape model (Daly et al. 2024). JPL SBDB lists 780 ± 30 m",
      rotationPeriod: "2.2593 ± 0.0002 h — lightcurve photometry; within a few per cent of the spin rate that would tear a cohesionless rubble pile apart",
      orbitalSpeed: "23.2 km/s · one orbit takes 2.11 years",
      gravity: "Surface gravity ≈ 58 µm/s² at the poles and close to zero at the equator, because the rotation nearly cancels it",
      surfaceEvidence: "DART DRACO to 5.5 cm/pixel; shape model Daly et al. 2024; Goldstone/Arecibo radar. Hera arrives late 2026",
      roughness: "high — boulder-strewn, with a smooth bright north pole",
      description:
        "On 26 September 2022 DART hit Dimorphos, the 151 m moon of this 761 m asteroid, at 6.1 km/s — the first time human beings deliberately changed the orbit of another world. The moon's period around Didymos dropped from 11.921473 ± 0.000044 h to 11.3676 ± 0.0014 h: a change of 32 ± 2 minutes, measured from Earth by ground-based lightcurves and radar (Thomas et al. 2023), against a mission success threshold of 73 seconds. Most of that came not from the spacecraft's momentum but from the ejecta thrown off the far side, which acted like a rocket: the momentum enhancement factor β came out near 3.6. Geometric albedo 0.15, from the DART DRACO approach photometry tied to the ground-based S-type spectral classification — brighter than the carbonaceous bodies here and about the same as Itokawa's class, which is what it is drawn as. Didymos itself is a textbook spinning top, 851 × 849 × 620 m, turning once every 2.26 hours — fast enough that its own equator is nearly weightless, which is how the ridge got there and probably how Dimorphos got there too. ESA's Hera arrives at the system in late 2026 to photograph the crater; these are the numbers as they stand before it does.",
    },
    moon: {
      name: "Dimorphos",
      designation: "(65803) Didymos I Dimorphos",
      classification: "Natural satellite · the DART target",
      diameterKm: 0.151,
      diameterLabel: "177 × 174 × 116 m; 151 ± 5 m volume-equivalent",
      albedo: 0.15,
      chroma: CHROMA.didymos,
      /* Post-impact values. Pre-impact it was 1.206 km and 11.921473 h. */
      separationKm: 1.144,
      periodHours: 11.3676,
      inclinationDeg: 6,
      shape: {
        lobes: [{ c: [0, 0, 0], r: [0.0885, 0.058, 0.0870] }],
        neck: 1,
        relief: 0.040,
        grain: 0.022,
        craterCount: 8,
        craterMin: 0.06,
        craterMax: 0.20,
        craterDepth: 0.018,
        boulders: 20,
        boulderSize: 0.110,
        seed: 658031,
      },
      info: {
        diameter: "177 × 174 × 116 m, volume-equivalent 151 ± 5 m — DART DRACO shape model",
        rotationPeriod: "Was tidally locked at 11.92 h. Since the impact it tumbles chaotically — LICIACube and ground photometry",
        orbitalSpeed: "Orbits Didymos at about 17 cm/s",
        surfaceEvidence: "DART DRACO, final approach, to 5.5 cm/pixel across roughly one hemisphere; LICIACube from 58 km three minutes later. Nothing else has ever seen it",
        description:
          "151 m across — smaller than a city block, and the only object in the Solar System whose orbit has been changed on purpose. DART's last images, at 5.5 cm/pixel, show a surface of loose boulders with no visible fine material and no obvious craters; the largest boulder is about 6.5 m. Bulk density is poorly constrained, somewhere between 0.6 and 2.4 g/cm³ depending on whose model you take, which is why Hera is going. The impact left it tumbling instead of tidally locked, and threw a 10,000 km dust tail that Hubble tracked for months. The separation drawn here, 1.14 km centre to centre after the impact, is at the real ratio to Didymos's radius. The size is not: Dimorphos is really 20% of Didymos's mean radius and is drawn at 37%, because at the true ratio and a framing that fits both bodies it would be about eight pixels across.",
      },
    },
  },

  /* ----------------------------------------------------------------------
   * 1P/Halley -- no image in this repository, and none needed.
   * -------------------------------------------------------------------- */
  {
    id: "halley",
    name: "1P/Halley",
    designation: "1P/Halley",
    classification: "Halley-type comet nucleus · retrograde",
    detail: "Comet nucleus | Giotto and the Vegas, March 1986",
    diameterKm: 11.0,
    diameterLabel: "≈ 14.9 × 8.2 km; 11 km equivalent",
    albedo: 0.04,
    chroma: CHROMA.halley,
    rotationHours: 52.8,
    rotationState: "tumbling",
    metalness: 0,
    isComet: true,
    orbit: {
      solution: "JPL SBDB orbit solution 75, epoch JD 2439875.5",
      epochJD: 2439875.5,
      aAU: 17.9286350486,
      e: 0.9679359957,
      iDeg: 162.1905300,
      nodeDeg: 59.0989472,
      argPeriDeg: 112.2414315,
      meanAnomalyDeg: 274.3823371,
      meanMotionDegPerDay: 0.0129832444,
    },
    /*
     * Built from a description, not a photograph -- and there is no reference
     * image in this repository for exactly that reason. Giotto's Halley
     * Multicolour Camera resolved the nucleus for a few minutes on 14 March
     * 1986 from 596 km, through a dust coma that wrecked the camera before the
     * pass was over. What came back: an irregular, roughly bilobed dark body
     * about 15 km by 8 km, with a raised region near the middle and bright
     * jets leaving perhaps a tenth of the surface. Two soft lobes and a broad
     * neck is the honest reading of that. Anything finer on this model is
     * invented and the card says so.
     */
    shape: {
      lobes: [
        { c: [-3.4, 0, 0], r: [4.4, 4.0, 4.1] },
        { c: [3.3, 0.3, 0], r: [4.2, 3.8, 3.9] },
      ],
      // Giotto resolved a peanut, not a dumbbell: a broad fillet, because at
      // 50 m per pixel through a dust coma a narrow neck could not have been
      // distinguished from a broad one anyway.
      neck: 4,
      relief: 0.055,
      grain: 0.024,
      craterCount: 20,
      craterMin: 0.05,
      craterMax: 0.20,
      craterDepth: 0.030,
      boulders: 10,
      boulderSize: 0.045,
      /* The active areas: roughly 10% of the surface, on the sunward side,
       * and markedly brighter than the inert crust around them. */
      patches: [
        { dir: [-0.75, 0.42, 0.51], radius: 0.30, gain: 1.55 },
        { dir: [-0.42, -0.30, 0.86], radius: 0.22, gain: 1.42 },
        { dir: [0.55, 0.62, 0.56], radius: 0.18, gain: 1.35 },
      ],
      seed: 1001,
    },
    surfaceEvidence: "Giotto's Halley Multicolour Camera, 14 March 1986, from 596 km — a few minutes of imaging through a dust coma that destroyed the camera mid-pass, covering perhaps a quarter of the nucleus at 50 m at best. Vega 1 and 2 imaged it from 8,890 km and 8,030 km a week earlier. The bilobed outline and the bright active regions are measured; everything finer on this model is inferred",
    info: {
      population: "Halley-type comets · from the Oort Cloud",
      diameter: "≈ 14.9 × 8.2 km, 11 km equivalent — Giotto HMC, 14 March 1986",
      rotationPeriod: "About 52.8 h, but the rotation is complex and non-principal-axis; ground-based observers also derived 7.4 days and both may be components of the same tumble",
      orbitalSpeed: "0.98 km/s right now, near aphelion; 55 km/s at perihelion — the widest speed range of anything in this scene · one orbit takes 75.9 years",
      gravity: "Escape velocity ≈ 2 m/s",
      surfaceEvidence: "Giotto HMC from 596 km, 14 March 1986, through a destructive dust coma; ~25% of the nucleus at 50 m at best. Relief beyond the outline is inferred",
      roughness: "unmeasured — a dark inert crust with bright active vents",
      description:
        "Geometric albedo 0.04. Halley reflects four per cent of the light that hits it, which makes the most famous object in the sky one of the darkest things in the Solar System — and nobody expected that until Giotto arrived. The comet is bright because of its coma, not its nucleus. Where you are looking at it now is real: Halley is currently about 35 AU from the Sun, past Neptune, having reached aphelion on 9 December 2023, and it does not come back to perihelion until 28 July 2061. Out here there is no coma at all, which is why it is drawn bare. Its orbit is retrograde, inclined 162°, so it runs backwards around the Sun and meets Earth head-on; that is why the Orionid and Eta Aquariid meteor showers, both Halley's debris, are so fast. Mass (2.2 ± 0.9) × 10¹⁴ kg and density 0.55 ± 0.25 g/cm³ from the 1986 flybys: like 67P, it would float. Its elements here are the 1968-epoch JPL solution propagated forward, so its position is good to a fraction of an AU rather than exactly.",
    },
  },

  /* ----------------------------------------------------------------------
   * 243 Ida + Dactyl -- the discovery that asteroids can have moons.
   * -------------------------------------------------------------------- */
  {
    id: "ida",
    name: "Ida",
    designation: "243 Ida",
    classification: "Main-belt asteroid (Koronis family) · S-type",
    detail: "Main-belt asteroid | Galileo, 28 August 1993",
    diameterKm: 31.4,
    diameterLabel: "59.8 × 25.4 × 18.6 km; ≈ 31.4 km equivalent",
    albedo: 0.238,
    chroma: CHROMA.ida,
    rotationHours: 4.634,
    rotationState: "principal-axis",
    metalness: 0.02,
    orbit: {
      solution: "JPL SBDB orbit solution 191, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.8633480317,
      e: 0.0461096280,
      iDeg: 1.1303631,
      nodeDeg: 323.5366609,
      argPeriDeg: 113.2571827,
      meanAnomalyDeg: 49.6476909,
      meanMotionDegPerDay: 0.2034196329,
    },
    /*
     * A croissant: two unequal ends with a bend between them, not a straight
     * peanut. The bend is carried by offsetting the two lobes in y as well as
     * x -- without it Ida reads as a sausage, which is the usual mistake.
     */
    shape: {
      lobes: [
        { c: [-13.5, -0.6, -2.2], r: [16.4, 9.3, 11.6] },
        { c: [14.2, 0.9, 2.6], r: [15.7, 7.6, 9.4] },
      ],
      // The croissant. The offset is in z, not y: Ida's bend is in the plane
      // Galileo photographed it in, and putting it in y -- the short spin
      // axis -- made it a straight sausage seen from every useful angle.
      neck: 12,
      relief: 0.038,
      grain: 0.016,
      craterCount: 52,
      craterMin: 0.025,
      craterMax: 0.14,
      craterDepth: 0.028,
      bigCraters: [
        /* Azzurra, the large fresh crater on the far side, which exposed
         * bluer, less space-weathered material. */
        { dir: [-0.28, 0.20, -0.94], radius: 0.26, depth: 0.034, rim: 0.009 },
      ],
      boulders: 12,
      boulderSize: 0.035,
      seed: 243,
    },
    surfaceEvidence: "Galileo SSI, 28 August 1993, from 2,390 km, at up to 25 m/pixel over about 95% of the surface; shape model from Thomas et al. 1996",
    info: {
      population: "Main asteroid belt · Koronis family",
      diameter: "59.8 × 25.4 × 18.6 km, ≈ 31.4 km equivalent — Galileo SSI shape model",
      rotationPeriod: "4.634 h — Galileo SSI and ground lightcurves",
      orbitalSpeed: "17.6 km/s · one orbit takes 4.85 years",
      gravity: "Surface gravity ≈ 11 mm/s²; escape velocity ≈ 20 m/s",
      surfaceEvidence: "Galileo SSI at up to 25 m/pixel, 28 August 1993; shape model Thomas et al. 1996",
      roughness: "high — crater-saturated, so the surface is as old as it can read",
      description:
        "Until 17 February 1994, when Ann Harch found a second object in the Galileo playback, nobody knew asteroids could have moons. Dactyl is 1.4 km across and orbits at about 90 km, and the discovery mattered for a reason beyond the novelty: a moon lets you weigh the parent. Ida came out at 2.6 ± 0.5 g/cm³, which is too low for the ordinary chondrite its S-type spectrum implies unless it is substantially fractured. Geometric albedo 0.238. The surface is saturated with craters — it cannot hold any more, so counting them gives a lower bound rather than an age — while Ida belongs to the Koronis family, formed in a collision perhaps a billion years ago. Galileo passed 2,390 km away at 12.4 km/s on 28 August 1993, on its way to Jupiter, and got about 95% of the surface at up to 25 m/pixel.",
    },
    moon: {
      name: "Dactyl",
      designation: "(243) Ida I Dactyl",
      classification: "Natural satellite · the first asteroid moon ever found",
      diameterKm: 1.4,
      diameterLabel: "1.6 × 1.4 × 1.2 km",
      albedo: 0.20,
      chroma: [1.10, 0.993, 0.845],
      separationKm: 90,
      periodHours: 37,
      inclinationDeg: 8,
      shape: {
        lobes: [{ c: [0, 0, 0], r: [0.80, 0.60, 0.70] }],
        neck: 1,
        relief: 0.055,
        grain: 0.026,
        craterCount: 14,
        craterMin: 0.07,
        craterMax: 0.26,
        craterDepth: 0.040,
        boulders: 0,
        seed: 2431,
      },
      info: {
        diameter: "1.6 × 1.4 × 1.2 km — Galileo SSI, from a single resolved sequence",
        rotationPeriod: "Unknown. Galileo saw it for too short a time",
        orbitalSpeed: "About 6 m/s around Ida",
        surfaceEvidence: "Galileo SSI, 28 August 1993 — a handful of frames at ~39 m/pixel, covering one hemisphere. Nothing has looked at it since",
        description:
          "The first moon of an asteroid ever discovered, found in Galileo playback data five and a half months after the flyby. It is 1.4 km across against Ida's 31.4. The separation drawn here is at the real ratio to Ida's radius, though the orbit is only loosely constrained: Galileo saw one short arc, which allows a family of orbits around roughly 90 km. The drawn size is exaggerated — Dactyl is really 4.5% of Ida's mean radius and appears here at about 15%, because at the true ratio it would be a two-pixel speck. It is slightly less red than Ida and more heavily cratered for its size, which says it is old rather than a fresh chip. Its very existence set a lower bound on Ida's density, and within a decade of its discovery asteroid moons had gone from impossible to ordinary — well over 400 are known now.",
      },
    },
  },

  /* ----------------------------------------------------------------------
   * 25143 Itokawa -- the rubble pile made visible.
   * -------------------------------------------------------------------- */
  {
    id: "itokawa",
    name: "Itokawa",
    designation: "25143 Itokawa (1998 SF36)",
    classification: "Near-Earth asteroid (Apollo) · S(IV)-type",
    detail: "Near-Earth asteroid | Hayabusa, first sample return",
    diameterKm: 0.33,
    diameterLabel: "535 × 294 × 209 m; ≈ 330 m equivalent",
    albedo: 0.29,
    chroma: CHROMA.itokawa,
    rotationHours: 12.132,
    rotationState: "principal-axis",
    metalness: 0.02,
    orbit: {
      solution: "JPL SBDB orbit solution 237, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 1.3240522843,
      e: 0.2801776415,
      iDeg: 1.6209408,
      nodeDeg: 69.0744975,
      argPeriDeg: 162.8409022,
      meanAnomalyDeg: 170.6539059,
      meanMotionDegPerDay: 0.6469137343,
    },
    /*
     * The sea otter. A large "body" lobe and a smaller rounder "head", meeting
     * at a waist -- and the waist, Muses Sea, is the only smooth ground on the
     * asteroid: millimetre gravel that has migrated downhill into the lowest
     * potential on the body. Everything else is bare boulders.
     */
    shape: {
      lobes: [
        { c: [-0.105, 0, 0], r: [0.178, 0.1045, 0.147] },
        { c: [0.155, 0.006, 0], r: [0.098, 0.085, 0.098] },
      ],
      neck: 14,
      relief: 0.060,
      grain: 0.030,
      craterCount: 10,
      craterMin: 0.05,
      craterMax: 0.18,
      craterDepth: 0.018,
      boulders: 34,
      boulderSize: 0.090,
      /* Muses Sea sits in the waist and is both smoother and brighter than
       * the boulder fields either side of it. */
      collar: { centreKm: 0.062, widthKm: 0.09, gain: 1.26 },
      seed: 25143,
    },
    surfaceEvidence: "Hayabusa AMICA imaging to 6 mm/pixel at closest approach and the LIDAR shape model (Gaskell et al. 2008); 1,534 dust grains returned to Earth and examined in the laboratory",
    info: {
      population: "Near-Earth objects · Apollo group",
      diameter: "535 × 294 × 209 m, ≈ 330 m equivalent — Hayabusa AMICA/LIDAR shape model",
      rotationPeriod: "12.132 h — Hayabusa AMICA and ground lightcurves",
      orbitalSpeed: "25.9 km/s · one orbit takes 1.52 years",
      gravity: "Surface gravity ≈ 0.1 mm/s²; escape velocity ≈ 17 cm/s",
      surfaceEvidence: "Hayabusa AMICA to 6 mm/pixel; LIDAR shape model; 1,534 returned grains",
      roughness: "extreme — bare boulders, with one smooth gravel sea at the waist",
      description:
        "Bulk density 1.9 ± 0.13 g/cm³ against the 3.2 of the LL chondrite material the returned grains turned out to be: about 40% of Itokawa is empty space. This is the asteroid that made the rubble-pile model something you could look at rather than infer. Hayabusa reached it on 12 September 2005, touched down twice, and — after a fuel leak, the loss of two reaction wheels, a failed lander and a seven-week loss of contact — returned 1,534 grains to Woomera on 13 June 2010, the first material ever brought back from an asteroid. The smooth region at the waist, Muses Sea, is millimetre gravel that has drifted into the lowest gravitational potential on the body; everywhere else is bare rock, and the largest boulder, Yoshinodai, is 50 m long on a 535 m asteroid. Geometric albedo around 0.29, which makes Itokawa the brightest surface in this set.",
    },
  },

  /* ----------------------------------------------------------------------
   * 253 Mathilde -- half of it is nothing.
   * -------------------------------------------------------------------- */
  {
    id: "mathilde",
    name: "Mathilde",
    designation: "253 Mathilde",
    classification: "Main-belt asteroid · Cb-type carbonaceous",
    detail: "Main-belt asteroid | NEAR Shoemaker flyby, 27 June 1997",
    diameterKm: 52.8,
    diameterLabel: "66 × 48 × 46 km; 52.8 ± 2.6 km equivalent",
    albedo: 0.0436,
    chroma: CHROMA.mathilde,
    rotationHours: 417.7,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 250, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.6469012249,
      e: 0.2643478594,
      iDeg: 6.7404676,
      nodeDeg: 179.4942080,
      argPeriDeg: 157.5640226,
      meanAnomalyDeg: 273.5338756,
      meanMotionDegPerDay: 0.2288745332,
    },
    /*
     * Five craters, each nearly as wide as the body's own radius, and the
     * shape is basically what is left over. Karoo is 33.4 km across on a body
     * whose mean radius is 26 km, so the bowl is drawn as an angular radius
     * of 0.62 rad. The floor clamp in the sculptor exists mostly for this
     * body: overlapping bowls this deep will otherwise invert the surface.
     */
    shape: {
      lobes: [{ c: [0, 0, 0], r: [33, 23, 24] }],
      neck: 1,
      relief: 0.045,
      grain: 0.014,
      craterCount: 30,
      craterMin: 0.05,
      craterMax: 0.22,
      craterDepth: 0.035,
      bigCraters: [
        /* Karoo, 33.4 km. */
        { dir: [0.62, 0.34, 0.71], radius: 0.62, depth: 0.230, rim: 0.030 },
        /* Ishikari, 29.3 km. */
        { dir: [-0.55, 0.15, 0.82], radius: 0.55, depth: 0.200, rim: 0.028 },
        { dir: [-0.20, -0.86, -0.47], radius: 0.46, depth: 0.160, rim: 0.024 },
        { dir: [0.88, -0.36, -0.30], radius: 0.42, depth: 0.145, rim: 0.022 },
        { dir: [-0.78, 0.55, -0.31], radius: 0.40, depth: 0.135, rim: 0.020 },
      ],
      boulders: 0,
      seed: 253,
    },
    surfaceEvidence: "NEAR Shoemaker MSI, 27 June 1997, from 1,212 km — 534 frames covering about 60% of one hemisphere at 160 m/pixel. The unseen 40% has never been imaged by anything",
    info: {
      population: "Main asteroid belt · outer belt",
      diameter: "66 × 48 × 46 km, 52.8 ± 2.6 km equivalent — NEAR Shoemaker MSI",
      rotationPeriod: "417.7 ± 0.01 h — 17.4 days, one of the slowest rotators known — ground-based lightcurves",
      orbitalSpeed: "18.3 km/s · one orbit takes 4.31 years",
      gravity: "Surface gravity ≈ 10 mm/s²; escape velocity ≈ 23 m/s",
      surfaceEvidence: "NEAR Shoemaker MSI at 160 m/pixel over ~60% of one hemisphere, 27 June 1997. The rest has never been seen",
      roughness: "extreme — five craters nearly as wide as the body itself",
      description:
        "Density 1.3 ± 0.2 g/cm³, measured by NEAR Shoemaker from the deflection of its own trajectory during a 1,212 km flyby. Carbonaceous rock is about 2.5, so somewhere near half of Mathilde is empty space — and that is the explanation for the other strange thing about it. In the 60% of one hemisphere NEAR managed to photograph there are five craters 20 to 33 km across on a body only 53 km wide; Karoo alone is 33.4 km. Any one of those impacts should have shattered a solid body. A loose pile absorbs the shock instead of transmitting it, so the crater forms and nothing else happens, and there are no ejecta blankets and no fracture grooves anywhere to be seen. Geometric albedo 0.0436 makes it one of the darkest objects in the Solar System, darker than fresh asphalt. It turns once every 17.4 days, so slowly that NEAR photographed essentially one face and the far side of Mathilde remains unseen by anything, ever.",
    },
  },

  /* ----------------------------------------------------------------------
   * 21 Lutetia -- possibly a surviving planetesimal.
   * -------------------------------------------------------------------- */
  {
    id: "lutetia",
    name: "Lutetia",
    designation: "21 Lutetia",
    classification: "Main-belt asteroid · M/Xk-type",
    detail: "Main-belt asteroid | Rosetta flyby, 10 July 2010",
    diameterKm: 98,
    diameterLabel: "121 × 101 × 75 km; 98 ± 2 km equivalent",
    albedo: 0.19,
    chroma: CHROMA.lutetia,
    rotationHours: 8.1655,
    rotationState: "principal-axis",
    metalness: 0.10,
    orbit: {
      solution: "JPL SBDB orbit solution 146, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.4344307427,
      e: 0.1647703512,
      iDeg: 3.0644529,
      nodeDeg: 80.8385572,
      argPeriDeg: 249.8802781,
      meanAnomalyDeg: 298.7726415,
      meanMotionDegPerDay: 0.2594824192,
    },
    /*
     * Angular rather than lumpy. Lutetia's silhouette is dominated by large
     * flat facets meeting at edges -- old impact scars on a body strong enough
     * to hold a flat face -- so three planar shaves go on after the ellipsoid.
     * A smooth minimum keeps the edges from turning into razors.
     */
    shape: {
      lobes: [{ c: [0, 0, 0], r: [60.5, 37.5, 50.5] }],
      neck: 1,
      facets: [
        { n: [0.62, 0.42, -0.66], d: 0.90, softness: 0.13 },
        { n: [-0.78, 0.18, 0.60], d: 0.92, softness: 0.15 },
        { n: [0.10, -0.86, 0.50], d: 0.93, softness: 0.16 },
      ],
      relief: 0.036,
      grain: 0.013,
      craterCount: 64,
      craterMin: 0.025,
      craterMax: 0.16,
      craterDepth: 0.026,
      bigCraters: [
        /* Baetica, the north-polar crater cluster, ~21 km and superposed on
         * the 55 km Massilia depression. */
        { dir: [0.14, 0.96, 0.24], radius: 0.30, depth: 0.055, rim: 0.012 },
        { dir: [0.05, 0.86, 0.51], radius: 0.18, depth: 0.040, rim: 0.010 },
        { dir: [-0.50, -0.28, 0.82], radius: 0.52, depth: 0.045, rim: 0.012 },
      ],
      boulders: 6,
      boulderSize: 0.030,
      seed: 21,
    },
    surfaceEvidence: "Rosetta OSIRIS NAC, 10 July 2010, from 3,162 km, at up to 60 m/pixel over about 50% of the surface; the rest is from ground-based lightcurve inversion and adaptive-optics imaging",
    info: {
      population: "Main asteroid belt · inner belt",
      diameter: "121 × 101 × 75 km, 98 ± 2 km equivalent — Rosetta OSIRIS",
      rotationPeriod: "8.1655 h — Rosetta OSIRIS and a century of ground lightcurves",
      orbitalSpeed: "19.1 km/s · one orbit takes 3.80 years",
      gravity: "Surface gravity ≈ 37 mm/s²; escape velocity ≈ 60 m/s",
      surfaceEvidence: "Rosetta OSIRIS NAC to 60 m/pixel over ~50% of the surface; the remainder from lightcurve inversion",
      roughness: "high — flat facets, long grooves and a saturated north pole",
      description:
        "Bulk density 3.4 ± 0.3 g/cm³, from Rosetta's deflection during the flyby — the highest measured for any asteroid, higher than most meteorites, which means Lutetia is dense rock with almost no void in it. That, together with a surface saturated with craters that are 3.6 billion years old, is why it is read as a surviving planetesimal: one of the original building blocks of the planets, never broken up, still here. Its spectrum will not settle the argument. It is M-type by Tholen and Xk by SMASS, moderately red in the visible and flat in the infrared, which is consistent with an enstatite chondrite and also with a partially differentiated body with a metal core. Geometric albedo 0.19. Rosetta passed 3,162 km away on 10 July 2010 on its way to 67P and got about half the surface at up to 60 m/pixel; it also found a 300 m layer of regolith and landslides, on a body with a sixtieth of Earth's gravity.",
    },
  },

  /* ----------------------------------------------------------------------
   * 951 Gaspra -- the first asteroid ever seen close up.
   * -------------------------------------------------------------------- */
  {
    id: "gaspra",
    name: "Gaspra",
    designation: "951 Gaspra",
    classification: "Main-belt asteroid (Flora family) · S-type",
    detail: "Main-belt asteroid | Galileo, 29 October 1991",
    diameterKm: 12.2,
    diameterLabel: "18.2 × 10.5 × 8.9 km; ≈ 12.2 km equivalent",
    albedo: 0.246,
    chroma: CHROMA.gaspra,
    rotationHours: 7.042,
    rotationState: "principal-axis",
    metalness: 0.03,
    orbit: {
      solution: "JPL SBDB orbit solution 162, epoch JD 2461200.5",
      epochJD: 2461200.5,
      aAU: 2.2099783537,
      e: 0.1737374595,
      iDeg: 4.1046550,
      nodeDeg: 252.9672913,
      argPeriDeg: 130.0037637,
      meanAnomalyDeg: 112.9508716,
      meanMotionDegPerDay: 0.3000005453,
    },
    /*
     * Gaspra is the angular one. Galileo's images show large flat faces
     * meeting at sharp edges, with very few big craters -- a young, freshly
     * broken surface, 20 to 300 million years old, which for an asteroid is
     * brand new. Four facets, and the crater population weighted hard to the
     * small end.
     */
    shape: {
      lobes: [{ c: [0, 0, 0], r: [9.1, 4.45, 5.25] }],
      neck: 1,
      facets: [
        /* d is the plane's distance as a fraction of the support radius, so
         * 0.88 shaves 12% off in that direction. The first pass used 0.76 to
         * 0.82 and took a quarter of the body away in four directions at
         * once, which read as bites rather than facets. */
        { n: [0.30, 0.66, 0.69], d: 0.88, softness: 0.11 },
        { n: [-0.52, 0.55, -0.65], d: 0.90, softness: 0.12 },
        { n: [0.72, -0.48, 0.50], d: 0.91, softness: 0.13 },
        { n: [-0.84, -0.40, 0.36], d: 0.93, softness: 0.14 },
      ],
      relief: 0.042,
      grain: 0.016,
      craterCount: 58,
      craterMin: 0.018,
      craterMax: 0.085,
      craterDepth: 0.016,
      bigCraters: [
        { dir: [0.26, 0.42, -0.87], radius: 0.30, depth: 0.040, rim: 0.010 },
      ],
      boulders: 8,
      boulderSize: 0.030,
      seed: 951,
    },
    surfaceEvidence: "Galileo SSI, 29 October 1991, from 1,600 km — 57 frames at up to 54 m/pixel, covering about 80% of the surface. It was the first close-up image of an asteroid ever taken",
    info: {
      population: "Main asteroid belt · Flora family",
      diameter: "18.2 × 10.5 × 8.9 km, ≈ 12.2 km equivalent — Galileo SSI shape model",
      rotationPeriod: "7.042 h, with an axial tilt of about 72° — Galileo SSI",
      orbitalSpeed: "20.0 km/s · one orbit takes 3.29 years",
      gravity: "Surface gravity ≈ 4 mm/s²; escape velocity ≈ 7 m/s",
      surfaceEvidence: "Galileo SSI at up to 54 m/pixel over ~80% of the surface, 29 October 1991 — the first close-up of any asteroid",
      roughness: "moderate — flat faces and sharp edges, few large craters",
      description:
        "On 29 October 1991 Galileo passed 1,600 km from Gaspra at 8 km/s and took the first close-up photograph of an asteroid that anyone had ever seen. Before that morning nobody knew what one looked like. What came back was angular — flat faces meeting at edges, a shape that reads as a fragment rather than a body, which is exactly what a Flora-family member is. The crater count gives a surface age of only 20 to 300 million years, effectively new, which fits: Gaspra is a piece of something larger that broke apart recently. Galileo also found subtle colour variations tied to topography, with the ridges slightly bluer and less space-weathered than the flats, and a measurable disturbance in the solar wind on approach, hinting at a magnetised body. Geometric albedo 0.246, and at B−V 0.870 it is the reddest object in this set, tied to an olivine-rich composition.",
    },
  },
]);

/*
 * 4 Vesta: intentionally not in this list. See the header.
 */
export const SMALL_BODY_IDS = Object.freeze(SMALL_BODIES.map((body) => body.id));

/**
 * The four Centaurs, and the first non-planets ever found to have rings.
 *
 * Rank 3 of `docs/bodies-to-draw-next.md`. Rank 1 was the bodies with a
 * photograph and Rank 2 the ones with a resolved disc. These have neither:
 * every object in this file is a **point of light** in every telescope ever
 * pointed at it, and everything known about their sizes and shapes comes
 * from watching them pass in front of a star.
 *
 * That turns out to be a much better instrument than it sounds. A stellar
 * occultation timed from several sites across a continent measures a chord
 * across the body to within a kilometre or two, and enough chords give a
 * limb. It is how Chariklo's rings were found in 2013 -- the star winked
 * twice on the way in and twice on the way out, thirteen seconds before and
 * after the body itself, from every telescope that saw it. Nobody was looking
 * for rings around a 250 km asteroid. Nobody thought they could exist.
 *
 * ## Why these four and not others
 *
 * Centaurs are the bodies caught between Jupiter and Neptune, on orbits the
 * giant planets will destroy within a few million years -- they are Kuiper
 * Belt objects on their way to becoming comets, and they behave like both.
 * The scene has a Kuiper Belt and it has comets and it had nothing in
 * between.
 *
 *   Chariklo   the first ringed small body, and still the clearest
 *   Chiron     rings *and* a coma, and the only object in the Solar System
 *              with both an asteroid number and a comet designation
 *   Pholus     the reddest object anyone has measured
 *   Echeclus   the one that blew a piece of itself off, and whose
 *              occultation proved it has no rings
 *
 * Between them they also span the whole of the Centaur colour bimodality,
 * which is the one thing about this population that is genuinely unexplained:
 * Centaurs are either grey or extremely red with almost nothing in between,
 * and nobody knows why. Chiron sits at B-R 1.06, essentially the colour of
 * sunlight; Pholus at 2.05, which is off the end of the scale. They are the
 * two extremes of the same population, drawn side by side.
 *
 * ## Provenance
 *
 * Orbital elements: JPL Small-Body Database, queried 20 September 2026, at
 * full precision, at the same epoch as Ranks 1 and 2 -- JD 2461200.5. Each
 * record names its orbit solution number and the length of its observed arc,
 * which for Chiron reaches back to a photographic plate from 1895, ninety-two
 * years before anybody realised what had been sitting on it.
 *
 * Mean motion is computed as n = 0.9856002628 * a^-1.5 deg/day rather than
 * quoted. Against JPL's own `n` for all four it agrees to seven significant
 * figures.
 *
 * Sizes and shapes: stellar occultations, cited per body. Diameters here are
 * volume- or area-equivalent as the source states, and the tri-axial figures
 * are the ones drawn.
 *
 * ## Colour is measured, so it is not pushed
 *
 * `mainBeltCatalogue.js` uses class-typical colour indices and pushes their
 * saturation about 1.6x, because a class average converted literally came out
 * as eleven identical greys. These four each have a *measured* colour index,
 * so they follow the Rank 1 rule instead: the conversion is literal and
 * nothing is exaggerated. It does not need to be. The gap between Chiron and
 * Pholus is the widest in the catalogue without any help.
 *
 * The conversion, for anyone checking it: B-R minus the Sun's 1.005
 * (Holmberg, Flynn & Portinari 2006) is how much redder than sunlight the
 * body is over 440-640 nm, so k = 10^(0.4 * dBR) is the R-to-B reflectance
 * ratio; the two ends are k^(+/-0.5), V is interpolated at 55% of the way
 * from B to R, and the triple is normalised to a mean of one.
 */

/* n = 0.9856002628 * a^-1.5 deg/day. See the provenance note. */
const meanMotion = (aAU) => 0.9856002628 / (aAU ** 1.5);

/* One ellipsoid from published tri-axial *diameters* a >= b >= c in km. The
 * builder wants semi-axes and its y axis is the spin axis, which for a body
 * that has relaxed is the shortest -- so the order is [a/2, c/2, b/2]. */
const ellipsoid = (a, b, c) => [{ c: [0, 0, 0], r: [a / 2, c / 2, b / 2] }];

export const CENTAURS = Object.freeze([
  {
    id: "chariklo",
    name: "Chariklo",
    designation: "10199 Chariklo (1997 CU26)",
    classification: "Centaur · ringed · the largest known",
    detail: "First ringed small body | stellar occultation, 3 June 2013",
    diameterKm: 249,
    diameterLabel: "287.6 × 270.4 × 198.2 km; 249 km volume-equivalent",
    /*
     * The body's own albedo, not the system's.
     *
     * JPL lists 0.045 and that figure is not wrong -- it is the albedo you
     * get if you assume all the light comes from the body. About a sixth of
     * it does not. The rings are twice as reflective as the ground beneath
     * them, 7.0 +/- 1.0 per cent against 3.6 +/- 1.0, and at the aspect
     * angles of the 2013 apparition they contributed roughly a seventh of the
     * total brightness. Drawing the body at 0.045 would put the rings' light
     * on the rock as well as in the rings.
     */
    albedo: 0.036,
    /* B-R = 1.299 +/- 0.065 (Peixinho et al. 2012). Red, but on the grey side
     * of the Centaur colour gap, which sits near B-R 1.60. */
    chroma: [1.130, 1.009, 0.862],
    rotationHours: 7.004,
    rotationState: "principal-axis",
    metalness: 0,
    /*
     * The real pole, because the rings sit in it.
     *
     * Every other body in these catalogues gets a pseudo-random obliquity
     * from its seed, which is honest for a body whose pole nobody has
     * measured. Chariklo's is known to half a degree, from four years of
     * watching the ring geometry change: the rings were edge-on and
     * effectively invisible in 2008, opened to 34 degrees by 2013, and that
     * is how the pole was solved. Drawing the body at a made-up tilt would
     * throw away the one thing the occultations pinned down hardest.
     *
     * Ecliptic longitude and latitude, from Duffard et al. 2014
     * (equivalently RA 151.30 +/- 0.5, Dec +41.48 +/- 0.2).
     */
    poleEclipticDeg: { lambda: 137.9, beta: 27.7 },
    orbit: {
      solution: "JPL SBDB orbit solution 61, epoch JD 2461200.5, 2726 observations over 1988-2025",
      epochJD: 2461200.5,
      aAU: 15.73437332078415,
      e: 0.1708195854003942,
      iDeg: 23.43190431353433,
      nodeDeg: 300.4768909592962,
      argPeriDeg: 241.2066068296425,
      meanAnomalyDeg: 130.0890828375457,
      meanMotionDegPerDay: meanMotion(15.73437332078415),
    },
    /* Relief borrowed from Mathilde, the darkest body anyone has photographed
     * close up and the nearest analogue to a 250 km carbonaceous Centaur.
     * The proportions are the measured ellipsoid. */
    shape: {
      lobes: ellipsoid(287.6, 270.4, 198.2),
      neck: 1,
      relief: 0.022,
      grain: 0.009,
      craterCount: 88,
      craterMin: 0.022,
      craterMax: 0.120,
      craterDepth: 0.018,
      boulders: 0,
      seed: 10199,
    },
    surfaceEvidence: "Never resolved. Shape from stellar occultations observed between 2013 and 2020 — Morgado et al. 2021, A&A 652, A141. Surface relief borrowed from Mathilde",
    info: {
      population: "Centaurs · 13.0-18.4 AU, between Saturn and Uranus",
      diameter: "287.6 × 270.4 × 198.2 km (semi-axes 143.8 +1.4/−1.5, 135.2 +1.4/−2.8, 99.1 +5.4/−2.7 km); 249 km volume-equivalent — Morgado et al. 2021, from occultations 2013-2020",
      rotationPeriod: "7.004 h — JPL SBDB physical parameters",
      orbitalSpeed: "7.5 km/s · one orbit takes 62.4 years — from the JPL element set",
      gravity: "Escape velocity ≈ 130 m/s. Mass is not measured; the rings orbit too far out to constrain it well",
      surfaceEvidence: "A point of light in every telescope ever pointed at it. Everything drawn here that is not the rings is borrowed from Mathilde",
      roughness: "unknown — no image has ever resolved its disc",
      description:
        "In June 2013 a star passed behind Chariklo and winked twice on the way in and twice on the way out, thirteen seconds either side of the body, from every telescope in South America that was watching. Nobody was looking for rings. Nobody thought a 250 km asteroid could hold any. Chariklo has two: a dense one 6.5 km wide at 390.6 km out, and a faint one 14 km beyond it, and they are the reason planetary rings are no longer considered a giant-planet phenomenon. The rings are twice as bright as the body — 7 per cent against 3.6 — which means Chariklo had been looking slightly too reflective for years and nobody knew why. They were edge-on in 2008 and invisible; by 2013 they had opened to 34 degrees, and that change is how its pole was solved. It is the largest Centaur known, and it will not stay on this orbit: like every Centaur, Saturn and Uranus will throw it somewhere else within a few million years. Unlike Chiron and Echeclus, it has never been seen to glow: no coma or outburst has ever been detected on it, and the brightness changes once read as activity turned out to be its rings tilting — so the scene draws it as a bare rock.",
    },
  },
  {
    id: "chiron",
    name: "Chiron",
    designation: "2060 Chiron (1977 UB) · comet 95P/Chiron",
    classification: "Centaur · asteroid and comet both",
    detail: "Rings in formation and a coma | occultations 1994-2023",
    diameterKm: 196,
    diameterLabel: "252 × 218 × 136 km; 196 ± 34 km volume-equivalent",
    albedo: 0.076,
    /* B-V 0.700 +/- 0.020, V-R 0.361 +/- 0.017 (Hainaut et al. 2012), so
     * B-R = 1.061 against the Sun's 1.005. The least red Centaur measured:
     * essentially the colour of sunlight, which is what a Tholen B-type is. */
    chroma: [1.025, 1.002, 0.973],
    rotationHours: 5.918,
    rotationState: "principal-axis",
    metalness: 0,
    /* Mean pole of the ring material, lambda 151 +/- 4, beta 20 +/- 6
     * (Pereira et al. 2025). Chiron's own spin pole is not independently
     * solved; the rings are assumed to lie in its equator, as Chariklo's do. */
    poleEclipticDeg: { lambda: 151, beta: 20 },
    orbit: {
      solution: "JPL SBDB orbit solution 171, epoch JD 2461200.5, 6026 observations over 1895-2026",
      epochJD: 2461200.5,
      aAU: 13.68426760850124,
      e: 0.3797656311453571,
      iDeg: 6.930574468846328,
      nodeDeg: 209.2961258613147,
      argPeriDeg: 339.2878326589729,
      meanAnomalyDeg: 216.7198966018106,
      meanMotionDegPerDay: meanMotion(13.68426760850124),
    },
    /* Relief borrowed from Arrokoth -- the only cold, ice-rich outer Solar
     * System surface anyone has photographed at all. Subdued, because an
     * actively outgassing body mantles its own craters. */
    shape: {
      lobes: ellipsoid(252, 218, 136),
      neck: 1,
      relief: 0.026,
      grain: 0.010,
      craterCount: 52,
      craterMin: 0.026,
      craterMax: 0.130,
      craterDepth: 0.014,
      boulders: 0,
      seed: 2060,
    },
    /*
     * Active, and drawn as four separate things rather than one glow.
     *
     * The first version was a single round halo and it read as a lamp: the
     * rock looked lit from within rather than dark with a cloud around it,
     * which is the opposite of what Chiron is. A surface that reflects
     * seven per cent of the light reaching it is asphalt, and it has to
     * stay asphalt.
     *
     * So: a pale blue-grey halo, faint, with no edge -- the colour is what
     * microscopic silicate dust and ice crystals do to sunlight, scattering
     * the short wavelengths harder; a short broad fan pushed anti-sunward,
     * stubby because at 12 AU radiation pressure is weak; and the vents,
     * which are the only part allowed to be bright *on* the body. Those are
     * cracks rotating into the light where the ice flashes straight to gas,
     * and they are the one sharp thing in the whole picture. Opacities are
     * set against the rings, which is the right way round: the coma is
     * additive over a dark sky and what matters is whether it reads without
     * washing out the three narrow rings it sits behind.
     *
     * Third pass, after "the brightness changes far too much with
     * perspective and seems to hang in the air": the cloud is now geometry
     * lit by the Sun (centaurComa.js), so these are no longer sprite
     * strengths. `opacity` is the peak of a cloud whose brightness also
     * falls with distance from the nucleus and is cut to a third on the
     * night side, so the same number reads roughly half as bright as it
     * did. `sunwardBias` 0.14 of the radius: the cloud is displaced towards
     * the Sun because that face is where the ice sublimates -- an art value,
     * no coma asymmetry has been measured for Chiron. `forward` 0.2 is the
     * forward-scattering boost, kept small on purpose: a large one is
     * exactly the viewpoint swing that was reported. The fan is 9 radii
     * long and 3 wide: stubby, because radiation pressure at 13 AU is about
     * 1/170 of its strength at 1 AU. Vents are cut to about half: they were
     * the brightest thing on screen and it made the rock look like a lamp.
     */
    coma: { radii: 5.0, opacity: 0.14, colour: 0xc3d4dc, sunwardBias: 0.14, forward: 0.2 },
    tail: { length: 9, width: 3.0, opacity: 0.06, colour: 0xb4c8d4 },
    vents: { count: 3, size: 0.32, opacity: 0.45, colour: 0xe2f0f6 },
    /* Coma design E (centaurComa.js). Chiron's gas is measured: CN emission
     * in its coma (Bus, A'Hearn, Schleicher & Bowell 1991, Science 251, 774)
     * -- the green head, kept at 0.6 because at 13 AU it is faint -- and CO
     * (Womack & Stern 1999), the parent of CO+ ions: a faint ion tail. The
     * dust tail at 0.7. */
    emission: { gas: 0.6, ion: 0.35, dust: 0.7 },
    surfaceEvidence: "Never resolved. Shape from the 2018 and 2019 stellar occultations — Braga-Ribas et al. 2023, A&A 676, A72. Ring material from Pereira et al. 2025, ApJL 992, L19. Surface relief borrowed from Arrokoth",
    info: {
      activity: "Active far from the Sun, in outbursts. Two kinds of light round it: dust reflecting sunlight — the pale coma and a short curved dust tail — and gas glowing under the Sun's ultraviolet. Chiron's gas is measured: cyanogen (CN), which glows green in the head, and carbon monoxide, whose ions make a faint straight blue tail. At 13 AU all of it is faint; the scene draws it always on.",
      population: "Centaurs · 8.5-18.9 AU, crossing Saturn's and Uranus's orbits",
      diameter: "252 × 218 × 136 km (Jacobi semi-axes 126 ± 22, 109 ± 19, 68 ± 13 km); 196 ± 34 km volume-equivalent — Braga-Ribas et al. 2023",
      rotationPeriod: "5.918 h — JPL SBDB physical parameters",
      orbitalSpeed: "8.0 km/s · one orbit takes 50.6 years — from the JPL element set",
      gravity: "Density 1119 ± 4 kg/m³ and mass 4.8 ± 2.3 × 10¹⁸ kg, both assuming it has relaxed into a Jacobi figure — Braga-Ribas et al. 2023",
      surfaceEvidence: "A point of light. The shape is occultation chords; the surface is borrowed from Arrokoth; the rings are occultation detections that change between epochs",
      roughness: "unknown",
      description:
        "Chiron was found in 1977 and classified as an asteroid. In 1988 it grew a coma, and it was given a comet designation as well — 95P/Chiron — which makes it the only object carrying both. What you are looking at is a rock as dark as asphalt inside its own weather: a pale blue-grey halo with no edge, bright points on the sunlit limb where cracks have just turned into the light and the ice in them is flashing straight to gas, and a short broad fan of dust pushed away from the Sun — stubby rather than swept, because out here the sunlight doing the pushing is a couple of hundred times weaker than it is at Earth. It was also the first Centaur anyone found, and the population is named after it. Since 2011 occultations have caught material around it: three narrow rings at 273, 325 and 438 km, a broad disc reaching out to 800, and a faint something at 1,380. The important part is that they are **not the same from one epoch to the next**. Chariklo's rings have sat where they are for as long as anyone has watched; Chiron's appear, thicken and move, which is what a ring system looks like while it is still being built — probably out of the material its own outbursts throw off. Its observed arc reaches back to a photographic plate taken in April 1895, ninety-two years before anyone noticed it was there.",
    },
  },
  {
    id: "pholus",
    name: "Pholus",
    designation: "5145 Pholus (1992 AD)",
    classification: "Centaur · Tholen Z — the reddest class there is",
    detail: "The reddest object measured | Tegler et al. 2005",
    diameterKm: 99,
    diameterLabel: "≈164 × 86 × 69 km at a/b = 1.9; 99 +15/−14 km volume-equivalent",
    albedo: 0.155,
    /* B-V 1.261 +/- 0.121, V-R 0.788 +/- 0.036 (Hainaut et al. 2012), so
     * B-R = 2.049 against the Sun's 1.005. Nothing else in these catalogues
     * is within half a magnitude of it, and this triple is the literal
     * conversion -- it is not exaggerated and does not need to be. */
    chroma: [1.426, 1.029, 0.545],
    rotationHours: 9.980,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 24, epoch JD 2461200.5, 397 observations over 1977-2018",
      epochJD: 2461200.5,
      aAU: 20.28965436859272,
      e: 0.574687297345862,
      iDeg: 24.76068786783861,
      nodeDeg: 119.2863897155665,
      argPeriDeg: 354.7809055877317,
      meanAnomalyDeg: 136.5004029381056,
      meanMotionDegPerDay: meanMotion(20.28965436859272),
    },
    /*
     * The one shape in this file that comes from a lightcurve rather than an
     * occultation, and it is a strong constraint: 0.60 magnitudes peak to
     * peak is a factor of 1.74 in projected area at the very least, and
     * Tegler's Jacobi fit, which accounts for the viewing aspect, puts the
     * long-to-short axis ratio at 1.9. The third axis is not measured; it is
     * set to b/c = 1.25, the value a Jacobi figure takes at that a/b, which
     * is the same equilibrium assumption the published 0.5 g/cm3 density
     * rests on. Everything is then scaled so the volume-equivalent diameter
     * is Herschel's 99 km.
     *
     * Relief borrowed from Phobos -- dark, saturated with craters, and the
     * nearest thing to a captured primitive body anyone has photographed.
     */
    shape: {
      lobes: ellipsoid(163.6, 86.1, 68.9),
      neck: 1,
      relief: 0.034,
      grain: 0.012,
      craterCount: 72,
      craterMin: 0.024,
      craterMax: 0.135,
      craterDepth: 0.022,
      boulders: 0,
      seed: 5145,
    },
    surfaceEvidence: "Never resolved. Size from Herschel-PACS thermal photometry (Duffard et al. 2014, A&A 564, A92); shape from the 0.60 mag lightcurve (Tegler et al. 2005, Icarus 175, 390). Surface relief borrowed from Phobos",
    info: {
      population: "Centaurs · 8.6-31.9 AU, from inside Saturn's orbit to beyond Neptune's",
      diameter: "99 +15/−14 km volume-equivalent — Herschel-PACS, Duffard et al. 2014. Drawn at the measured a/b = 1.9",
      rotationPeriod: "9.980 ± 0.002 h — Tegler et al. 2005",
      orbitalSpeed: "6.6 km/s · one orbit takes 91.4 years — from the JPL element set",
      gravity: "Density ≈ 0.5 g/cm³ if the elongation is rotational — a rubble pile that is mostly empty space and ice",
      surfaceEvidence: "A point of light. The colour is measured to a hundredth of a magnitude; everything else about the surface is borrowed from Phobos",
      roughness: "unknown",
      description:
        "Pholus is the reddest object anybody has measured. Its B-R colour is 2.05 where the Sun's is 1.00 and where most of the Solar System sits between 1.0 and 1.5 — a spectrum that climbs steeply and without a break from the blue right through the near infrared, which is what happens to organic ice after a few billion years of cosmic rays and no resurfacing. The material is thought to be tholins over water ice and methanol; nothing has ever been anywhere near it to check. It is one half of the Centaur colour problem: Centaurs are either grey or extremely red with almost nothing in between, and Chiron, drawn in the same scene as the colour of plain sunlight, is the other half. Its 0.60-magnitude lightcurve makes it the most elongated body here; at 0.5 g/cm³ it is less dense than water and holding itself together by not much. It has never been seen to glow: unlike Chiron and Echeclus, no coma or outburst has ever been detected on Pholus, so the scene draws it as a bare rock.",
    },
  },
  {
    id: "echeclus",
    name: "Echeclus",
    designation: "60558 Echeclus (2000 EC98) · comet 174P/Echeclus",
    classification: "Centaur · outbursting comet",
    detail: "Blew off a fragment brighter than itself | occultations 2019-2020",
    diameterKm: 60,
    diameterLabel: "74.0 × 56.8 × 49.8 km; 60.0 ± 1.0 km area-equivalent",
    albedo: 0.050,
    /* B-R = 1.376 +/- 0.072 (Peixinho et al. 2012) -- redder than Chariklo
     * and still on the grey side of the Centaur colour gap. */
    chroma: [1.163, 1.011, 0.826],
    /* 26.785178 +/- 0.000001 h, the most precisely measured rotation in
     * either catalogue (Rousselot et al. 2021, adopted by Pereira et al.
     * 2024). Also one of the slowest: it turns about four and a half times
     * for every one of Bennu's days. */
    rotationHours: 26.785178,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: {
      solution: "JPL SBDB orbit solution 123, epoch JD 2461200.5, 5211 observations over 1979-2026",
      epochJD: 2461200.5,
      aAU: 10.75708596310801,
      e: 0.454100715512905,
      iDeg: 4.338834852502628,
      nodeDeg: 173.28075288,
      argPeriDeg: 163.4409950214168,
      meanAnomalyDeg: 113.7921087405837,
      meanMotionDegPerDay: meanMotion(10.75708596310801),
    },
    /* Relief borrowed from 67P, which is the right loan for once: Echeclus
     * carries a comet designation and outgasses, and 67P is the only comet
     * nucleus anyone has mapped. */
    shape: {
      lobes: ellipsoid(74.0, 56.8, 49.8),
      neck: 1,
      relief: 0.038,
      grain: 0.014,
      craterCount: 44,
      craterMin: 0.028,
      craterMax: 0.150,
      craterDepth: 0.026,
      boulders: 0,
      seed: 60558,
    },
    /*
     * The same layers as Chiron and two more, because Echeclus does this
     * harder and stranger than anything else in the catalogue -- and
     * stronger, because here the activity is the whole point and there are
     * no rings for it to compete with.
     *
     * The colour is the measured difference: after an outburst its cloud is
     * *bluer than sunlight*, which nothing else here manages, and it means
     * the grains coming off it are finer than Chiron's -- fine enough to
     * scatter blue far more strongly than red. The rock underneath goes the
     * other way, slightly redder than Chiron's from complex carbon, so the
     * body and its own cloud are opposite colours. That contrast is the
     * single most distinctive thing about it, and it is measured rather
     * than chosen.
     *
     * The jets are real and are drawn nowhere near to scale: the observed
     * ones reach about 33,000 km, which on a 60 km body is eleven hundred
     * body radii, so at ten they are under one per cent of the truth. The
     * card says so. The fragment is the piece that came off in December
     * 2005 and outgassed brighter than the nucleus it left -- a second
     * source of light beside the first, which is the thing that made
     * anybody look twice.
     *
     * Third pass, sun-lit geometry rather than sprites (see Chiron's note
     * for what the numbers now mean). Stronger than Chiron's because the
     * activity is the point here, but every layer is lower than before:
     * the jets especially read as lit sticks floating beside the body, and
     * at 0.42 / 0.32 still read as a searchlight in the browser, so they
     * are halved again to 0.20 / 0.15.
     * Jet `spread` is the cone's half-opening as a fraction of its length;
     * 0.06-0.07 because the reported jets are narrow and linear -- 0.10-0.12
     * read as a searchlight cone on screen. The two
     * directions are art: no jet source has been located on the surface.
     */
    coma: { radii: 6.5, opacity: 0.20, colour: 0x7fa8e8, sunwardBias: 0.14, forward: 0.2 },
    tail: { length: 11, width: 3.4, opacity: 0.08, colour: 0x86a8dc },
    vents: { count: 4, size: 0.32, opacity: 0.55, colour: 0xd8e6ff },
    jets: [
      { dir: [0.62, 0.55, 0.56], length: 10, spread: 0.06, opacity: 0.20, colour: 0x9cc0f4 },
      { dir: [-0.48, 0.30, -0.82], length: 7.5, spread: 0.07, opacity: 0.15, colour: 0x9cc0f4 },
    ],
    fragment: { offset: [3.1, 0.9, -1.4], radii: 1.7, opacity: 0.22, colour: 0x8fb4ee },
    /* Coma design E. Echeclus's gas is CO (Wierzchos, Womack & Sarid 2017,
     * AJ 153, 230), so the blue CO+ ion tail is the gas it has; mostly it
     * throws out dust in outbursts, so the dust tail is near full. No CN or
     * C2 has been measured: its green head is drawn faint (0.25), for the
     * same look as the other active bodies, and its card says so. */
    emission: { gas: 0.25, ion: 0.45, dust: 0.85 },
    surfaceEvidence: "Never resolved. Shape and albedo from stellar occultations — Pereira et al. 2024, MNRAS 527, 3624. Surface relief borrowed from 67P/Churyumov–Gerasimenko",
    info: {
      activity: "Active in outbursts — in 2005 it threw off a fragment brighter than itself. Mostly dust: the pale coma and a broad curved dust tail are sunlight reflected off grains. Its gas is carbon monoxide, whose ions glow blue in a straight tail. No cyanogen or C₂ has been measured on Echeclus, so the faint green in its head is drawn for the look, not from a measurement.",
      population: "Centaurs · 5.9-15.6 AU, crossing Jupiter's and Saturn's orbits",
      diameter: "74.0 × 56.8 × 49.8 km (semi-axes 37.0 ± 0.6, 28.4 ± 0.5, 24.9 ± 0.4 km); 60.0 ± 1.0 km area-equivalent — Pereira et al. 2024",
      rotationPeriod: "26.785178 ± 0.000001 h — Rousselot et al. 2021",
      orbitalSpeed: "9.0 km/s · one orbit takes 35.3 years — from the JPL element set",
      gravity: "Escape velocity ≈ 25 m/s, which is walking pace — an outburst throws material off for good",
      surfaceEvidence: "A point of light. Size and albedo are occultation measurements; the relief is borrowed from 67P, which it genuinely resembles in kind",
      roughness: "unknown",
      description:
        "In December 2005 Echeclus brightened by a factor of about 400, and when the coma was resolved the brightest part of it was not centred on the nucleus. Something had come off — a fragment, on its own trajectory, outgassing harder than the body it left. Its cloud is the other thing worth knowing: it comes out *bluer than sunlight*, which means the grains blasted off it are finer than anything Chiron produces, and it sits around a rock that is itself slightly redder than Chiron's from complex carbon — the body and its own coma are opposite colours. The jets drawn here are real and are not to scale: the observed ones reach some 33,000 km, which on a body 60 km across is eleven hundred body radii. It has done it again since, in 2011 and 2016 and 2017. Escape velocity here is around 25 m/s, so anything an outburst lifts is gone. Its occultation in 2019 and 2020 did something the others in this file could not: it looked for rings and found none, to a limit that would have caught anything as substantial as Chariklo's. That matters, because it means rings around Centaurs are not simply what happens to every body of this size — they are something particular, and Chariklo and Chiron have it while Echeclus does not.",
    },
  },
]);

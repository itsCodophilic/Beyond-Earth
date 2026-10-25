import { event, smooth } from "./kit.js";
import { voyage, curveThrough } from "./deepVoyage.js";
import { supernovaScene, novaScene, mergerScene } from "./deepScenes.js";
import { magnetarScene, proximaScene, betelgeuseScene, tdeScene, sgrAScene, galaxyMergerScene } from "./deepCustom.js";
import { V } from "./deepObjects.js";

/**
 * Round 88 (Prompts.md: the twelve deep-sky events "make real" -- travel
 * there, see it happen, come home and see it from here): the deep-sky
 * events rebuilt as voyages (deepVoyage.js) to the real objects. Positions
 * are J2000 right ascension (hours) and declination (degrees) from SIMBAD
 * unless a comment says otherwise. The round-79 dioramas are kept in
 * docs/archive/deep-dioramas-round79/deep.js.
 */

export const H = (h, m = 0, s = 0) => h + m / 60 + s / 3600;
export const D = (d, m = 0, s = 0) => (Object.is(d, -0) || d < 0 ? -1 : 1) * (Math.abs(d) + m / 60 + s / 3600);

export const CRAB = event({
  id: "crab-supernova",
  section: "deep",
  title: "The Crab supernova",
  place: "Taurus · about 6,500 light-years",
  kind: "recorded",
  family: "stellar",
  when: "4 July 1054",
  often: "once, 1054",
  timeline: { last: "4 July 1054" },
  detail: "A 'guest star' bright enough to see in daylight for 23 days — and in its place today, the Crab Nebula, with a dead star spinning 30 times a second",
  frequency: "Once. Its light reached Earth in 1054; the star itself had exploded about 6,500 years before that",
  cause: "A massive star ran out of fuel and its core collapsed into a neutron star, blasting the rest of the star into space. The debris is still flying outward at about 1,500 km/s, lit from within by the neutron star's wind.",
  note: "Astronomers of China's Song dynasty recorded the 'guest star' near ζ Tauri on 4 July 1054: visible by day for 23 days and at night for 653. The pulsar at the Crab's heart, found in 1968, turns once every 33.7 milliseconds — about 30 times a second.",
  accuracy: "Its place in the sky and in the galaxy are real. The star, the neutron star and the nebula are drawn, not to scale with each other (the neutron star is 20 km across, the nebula about 11 light-years), and the pulsar's beams turn far slower than its real 30 times a second. The last picture is the photograph you supplied of the Crab Nebula today.",
  art: { main: "nebula", second: "neutronstar", fx: "pulse" },
  body: "Earth",
  /* Round 88: a voyage to the real Crab. */
  scene: (ctx) => voyage(ctx, {
    /* The Crab Nebula (M1): RA 05h 34m 31.9s, Dec +22° 00′ 52″ (SIMBAD);
     * about 2 kpc = 6,500 light-years (Trimble 1973; Kaplan et al. 2008). */
    target: { name: "The Crab Nebula (M1)", short: "The Crab", ra: H(5, 34, 31.9), dec: D(22, 0, 52), ly: 6500, where: "in Taurus" },
    duration: 60,
    tells: [
      { at: 0, label: "4 July 1054", text: "Astronomers in China record a 'guest star' in Taurus, bright enough to see by day." },
      { at: 0.07, label: "6,500 light-years", text: "We go to where it happened — the light took 6,500 years to reach Earth." },
      { at: 0.27, label: "A dying star", text: "A star about ten times the Sun's mass has run out of fuel." },
      { at: 0.4, label: "Collapse", text: "Its core falls in on itself in under a second and becomes a neutron star; the rest of the star is blasted out." },
      { at: 0.6, label: "The Crab Nebula", text: "The debris is still flying outward at about 1,500 km/s, lit by the spinning neutron star at its heart." },
      { at: 0.86, label: "Looking back", text: "In 1054 its light reached Earth: a new star by day for 23 days, by night for nearly two years." },
    ],
    build: supernovaScene({
      kind: "core",
      /* The progenitor: about 8–10 Suns (Nomoto et al. 1982; Smith 2013),
       * a red supergiant. Drawn, not to scale. */
      /* A red supergiant: a few huge convection cells, wrapped in dust. */
      star: { r: 2.2, kind: "rsg" },
      leftover: "pulsar",
      remR: 64,
      /* Filaments red-orange (hydrogen, nitrogen, sulphur) round a blue
       * haze (synchrotron light from the pulsar's wind), as photographed. */
      remnant: { count: 6000, filament: ["#ff5a3a", "#ff9a6a", "#ffcf7f", "#ff6ab0"], haze: "#8fb0ff", hazeShare: 0.35, stretch: [1.25, 0.85, 0.9] },
      /* The Crab today, rebuilt in 3D from the photograph: its filaments
       * on an expanding shell, the blue glow of the pulsar wind inside. */
      photo: { file: "crab-nebula.jpg", width: 150, mode: "shell", step: 4, threshold: 0.05, floor: 0.09, depth: 0.5, keep: 1.3, gain: 0.5, inner: 0.55, sizeK: 2.3 },
      labels: {
        star: ["The star, before", "about 10 times the Sun's mass"],
        leftover: ["The neutron star", "20 km across · 30 turns a second"],
        remnant: ["The debris, still flying out", "about 1,500 km/s"],
      },
      titles: [
        [0, ["The star, 6,500 years before 1054", "a red supergiant in Taurus, wrapped in its dust"]],
        [0.08, ["Inside it", "shells of lighter elements round an iron core"]],
        [0.14, ["Its core collapses", "in under a second, to a neutron star"]],
        [0.22, ["The supernova", "the rest of the star blasted into space"]],
        [0.42, ["Nearly a thousand years later", "the debris, lit by the pulsar"]],
        [0.5, ["The Crab pulsar", "20 km across, 30 turns a second, inside its wind of gas"]],
        [0.72, ["The Crab Nebula today", "6,500 light-years from Earth"]],
      ],
      /* How bright it looked from Earth: about magnitude −6 at first, by
       * day for 23 days, then fading over 653 nights (Song dynasty
       * records; Stephenson & Green 2002). Shape drawn through those dates. */
      chart: {
        title: "As seen from Earth, 1054–56",
        ticks: [[0, "Jul 1054"], [0.5, "1055"], [1, "Apr 1056"]],
        yTicks: [[0.95, "by day"], [0.35, "by eye"]],
        fn: curveThrough([[0, 0], [0.01, 1], [0.035, 0.92], [0.06, 0.6], [0.3, 0.42], [0.7, 0.32], [1, 0.3]]),
        colour: "#ffd27f",
      },
    }),
    end: (q) => ({
      glow: Math.min(1, q * 6) * (0.85 + 0.15 * Math.sin(q * 40)),
      size: 0.045,
      colour: "#fff4dc",
      label: ["The 'guest star' of 1054", "seen by day for 23 days"],
      title: ["4 July 1054, from Earth", "a new star near ζ Tauri"],
    }),
  }),
});


/* A light in the sky at home: how the object looks from Earth afterwards. */
const seen = (peak, colour, label, title, { size = 0.03, rise = 6, aura = 0 } = {}) => (q) => ({
  glow: Math.min(1, q * rise) * peak * (0.9 + 0.1 * Math.sin(q * 50)),
  size, colour, label, title,
  aura: aura * Math.min(1, q * 4) * (1 - Math.min(1, q * 1.2)) + aura * 0.2 * Math.min(1, q * 4),
});

/* ------------------------------------------------------------ SN 1987A */

export const SN1987A = event({
  id: "sn-1987a",
  section: "deep",
  title: "Supernova 1987A",
  place: "Large Magellanic Cloud · 168,000 light-years",
  kind: "recorded",
  family: "stellar",
  when: "23 February 1987 (neutrinos at 07:35 UT; first seen by eye on the 24th)",
  often: "once, 1987",
  timeline: { last: "23 February 1987" },
  detail: "The nearest supernova seen in nearly 400 years — and the first whose neutrinos were caught, hours before its light",
  frequency: "A supernova goes off in a galaxy like ours perhaps once or twice a century, but most are hidden by dust. None as close had been seen since Kepler's in 1604",
  cause: "A blue supergiant, Sanduleak −69° 202, ran out of fuel. Its iron core collapsed in under a second into a neutron star, releasing a flood of neutrinos at once. The shock took hours to reach the star's surface, so the light left later than the neutrinos did.",
  note: "Kamiokande-II in Japan, IMB in the United States and Baksan in Russia caught about two dozen neutrinos in 13 seconds — out of some 10^58 the collapse released. At its brightest, in May 1987, it reached about magnitude +2.9. Around it are three rings of gas the star shed 20,000 years earlier; since 2001 the debris has been hitting the inner one, lighting it up like a string of pearls. In 2024 the Webb telescope found signs of the neutron star at its heart (Fransson et al., Science).",
  accuracy: "Its place in the sky and its distance are real. The star, the rings and the debris are drawn, not to scale with each other (the inner ring is about 1.3 light-years across). The last picture is the photograph you supplied of SN 1987A today.",
  art: { main: "galaxy", fx: "burst" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* SN 1987A: RA 05h 35m 28.0s, Dec −69° 16′ 11″; the Large Magellanic
     * Cloud, 49.6 kpc = 162,000 ly (Pietrzyński et al. 2019) -- the
     * round-79 168,000 is the older figure, kept. */
    target: { name: "Supernova 1987A", short: "SN 1987A", ra: H(5, 35, 28), dec: D(-69, 16, 11), ly: 168000, where: "in the Large Magellanic Cloud" },
    extragalactic: true,
    tells: [
      { at: 0, label: "23 February 1987", text: "Underground detectors in Japan, the US and Russia catch a burst of neutrinos — hours before anyone sees a thing." },
      { at: 0.07, label: "168,000 light-years", text: "We leave the Milky Way for its neighbour, the Large Magellanic Cloud." },
      { at: 0.27, label: "A blue supergiant", text: "Sanduleak −69° 202, a star of about 20 Suns, has run out of fuel." },
      { at: 0.4, label: "Neutrinos first", text: "Its core collapses: neutrinos stream out at once; the light follows hours later." },
      { at: 0.6, label: "The rings", text: "Gas the star shed long before forms three rings; the debris has been striking the inner one since 2001." },
      { at: 0.86, label: "Looking back", text: "From the southern hemisphere it was easy to see by eye — the first supernova in nearly 400 years." },
    ],
    build: supernovaScene({
      kind: "core",
      /* Sanduleak −69° 202: a blue supergiant of about 18–20 Suns. */
      /* A blue supergiant -- a surprise in 1987: astronomers expected red. */
      star: { r: 1.6, kind: "bsg" },
      leftover: "neutron",
      rings: true,
      remR: 50,
      remnant: { count: 3000, filament: ["#ffb08a", "#8fd0ff", "#ffd27f"], haze: "#6a8aff", hazeShare: 0.4, stretch: [0.6, 0.6, 0.6] },
      /* SN 1987A today, rebuilt in 3D from the photograph: the ring of
       * hot spots lifted onto its plane, tilted 43° to us. */
      photo: { file: "sn-1987a.jpg", width: 130, mode: "plane", tilt: 43, step: 2, threshold: 0.04, floor: 0.11, keep: 0.62, gain: 0.65, sizeK: 2.6 },
      labels: {
        star: ["Sanduleak −69° 202", "a blue supergiant, about 20 Suns"],
        leftover: ["A neutron star", "signs of it seen by Webb, 2024"],
        remnant: ["The debris", ""],
        rings: ["The inner ring", "lit up by the debris since 2001"],
      },
      titles: [
        [0, ["Sanduleak −69° 202", "a blue supergiant in the Large Magellanic Cloud"]],
        [0.08, ["Inside it", "shells of lighter elements round an iron core"]],
        [0.14, ["Its core collapses", "neutrinos leave at once"]],
        [0.22, ["The supernova", "the light follows, hours later"]],
        [0.42, ["Thirty years on", "the debris hitting the inner ring"]],
        [0.5, ["At the heart", "a neutron star, hidden in dust until Webb found its signs"]],
        [0.72, ["SN 1987A today", "the ring of hot spots"]],
      ],
      /* As seen from Earth: about magnitude 4.5 on 24 February, rising to
       * 2.9 in May, then fading (Hamuy & Suntzeff 1990), shape. */
      chart: {
        title: "As seen from Earth, 1987",
        ticks: [[0, "Feb"], [0.25, "May"], [1, "Dec"]],
        yTicks: [[0.95, "mag 2.9"], [0.55, "4.5"]],
        fn: curveThrough([[0, 0.05], [0.01, 0.55], [0.1, 0.62], [0.25, 0.95], [0.4, 0.75], [1, 0.25]]),
        colour: "#bcd8ff",
      },
    }),
    end: seen(0.9, "#e8f0ff", ["SN 1987A, February 1987", "visible by eye from the south"], ["24 February 1987, from Earth", "a new star in the Large Magellanic Cloud"], { size: 0.035 }),
  }),
});

/* ------------------------------------------------------------ magnetar */

export const MAGNETAR = event({
  id: "magnetar-flare",
  section: "deep",
  title: "A magnetar's giant flare",
  place: "SGR 1806-20 · Sagittarius · about 30,000–50,000 light-years",
  kind: "recorded",
  family: "stellar",
  when: "27 December 2004",
  often: "once, 2004",
  timeline: { last: "27 December 2004" },
  detail: "A dead star 20 km across, with the strongest magnetic field known, let out more energy in a fifth of a second than the Sun does in 100,000 years",
  frequency: "Giant flares like this are rare: only three had been seen from magnetars in our galaxy and its neighbours by 2004, in 1979, 1998 and this one, by far the brightest",
  cause: "A magnetar is a neutron star whose magnetic field is about a thousand trillion times Earth's. The field strains the star's solid crust until it cracks — a starquake; the field snaps into a new shape and dumps its energy in a fireball of gamma rays. Part of the fireball stays trapped in the field and pulses as the star turns.",
  note: "Its distance is uncertain — estimates run from about 30,000 to 50,000 light-years, on the far side of the galaxy's centre. Even so, its gamma rays briefly disturbed Earth's ionosphere, and swamped detectors on many spacecraft. The trapped fireball then pulsed every 7.56 seconds for about six minutes.",
  accuracy: "Its place in the sky is real; its distance is uncertain. The star, its cracks and its field are drawn, not to scale; the field is drawn as a simple dipole, which the real one is not.",
  art: { main: "neutronstar", fx: "flare" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* SGR 1806−20: RA 18h 08m 39.3s, Dec −20° 24′ 40″; 8.7–15 kpc. */
    target: { name: "SGR 1806−20", short: "SGR 1806−20", ra: H(18, 8, 39.3), dec: D(-20, 24, 40), ly: 42000, lyText: "about 30,000–50,000 light-years", where: "in Sagittarius" },
    tells: [
      { at: 0, label: "27 December 2004", text: "A flash of gamma rays from beyond the galaxy's centre swamps detectors on many spacecraft." },
      { at: 0.07, label: "Across the galaxy", text: "We travel to SGR 1806−20, on the far side of the Milky Way's heart." },
      { at: 0.27, label: "A magnetar", text: "A neutron star 20 km across with a magnetic field a thousand trillion times Earth's." },
      { at: 0.45, label: "A starquake", text: "The field strains the crust until it cracks; the field snaps into a new shape." },
      { at: 0.52, label: "The giant flare", text: "In a fifth of a second it gives out more energy than the Sun does in 100,000 years." },
      { at: 0.86, label: "Looking back", text: "Even from 50,000 light-years its gamma rays disturbed Earth's upper atmosphere." },
    ],
    build: magnetarScene({
      spin: 0.13,
      titles: [
        [0, ["SGR 1806−20", "a magnetar, turning once every 7.6 seconds"]],
        [0.3, ["A starquake", "the crust cracks under the field's strain"]],
        [0.4, ["The giant flare", "a fifth of a second"]],
        [0.55, ["The fireball, trapped", "pulsing every 7.56 seconds"]],
      ],
      /* The flare's shape (Hurley et al. 2005; Palmer et al. 2005): a
       * spike of about 0.2 s, then a tail pulsing at 7.56 s for minutes. */
      chart: {
        title: "Gamma rays reaching Earth (shape)",
        ticks: [[0, "0"], [0.1, "0.2 s"], [1, "6 min"]],
        yTicks: [[0.95, "spike"]],
        fn: (u) => (u < 0.02 ? 0.05 : u < 0.06 ? 0.95 * (1 - (u - 0.02) / 0.04) + 0.05 : 0.05 + 0.25 * Math.exp(-(u - 0.06) * 2.5) * (0.5 + 0.5 * Math.cos(u * 48 * Math.PI))),
        samples: 500,
        colour: "#cfe2ff",
      },
    }),
    end: seen(0.4, "#e8f0ff", ["SGR 1806−20", "invisible to the eye — a flash of gamma rays"], ["27 December 2004, from Earth", "gamma rays shook the ionosphere"], { size: 0.02, aura: 0.9 }),
  }),
});

/* ------------------------------------------------------------ GW150914 */

export const GW150914 = event({
  id: "gw150914",
  section: "deep",
  title: "Two black holes merge: the first gravitational waves",
  place: "About 1.3 billion light-years · the southern sky",
  kind: "recorded",
  family: "deepSky",
  when: "14 September 2015, 09:50:45 UTC",
  often: "once, 2015",
  timeline: { last: "14 September 2015" },
  detail: "Black holes of 36 and 29 Suns spiral together and merge — and space itself rings, a shiver LIGO caught a century after Einstein predicted it",
  frequency: "The first of many: LIGO, Virgo and KAGRA now catch a black-hole merger every few days while they are running",
  cause: "Two black holes going round each other stir space-time and send out gravitational waves, which carry away energy. The orbit shrinks, the waves grow stronger, and in the last fraction of a second the two plunge together and merge into one black hole, which rings down to rest.",
  note: "In the last 0.2 seconds the signal swept from 35 to 250 Hz. The final black hole weighed 62 Suns: the other 3 Suns' worth of mass left as gravitational waves — for an instant more power than all the stars in the observable universe. At LIGO's 4-km arms it was a stretch of a few thousandths of a proton's width.",
  accuracy: "The black holes are ray-traced: the light of the stars behind them is bent as general relativity says (each hole on its own; where two overlap the picture is approximate). Where it happened is known only roughly — a patch of about 600 square degrees in the southern sky — and its direction here is the middle of that patch.",
  art: { main: "blackhole", second: "blackhole", fx: "ripple" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* GW150914's sky patch (LIGO 2016): a long arc in the southern sky,
     * roughly toward the Magellanic Clouds; RA ~ 8h, Dec ~ −70° is near
     * its middle. 410 Mpc = 1.3 billion light-years. */
    stars: false,
    target: { name: "GW150914", short: "GW150914", ra: 8, dec: -70, ly: 1.3e9, lyText: "about 1.3 billion light-years", where: "somewhere in the southern sky" },
    extragalactic: true,
    tells: [
      { at: 0, label: "14 September 2015", text: "Both LIGO detectors, 3,000 km apart, feel the same shiver in space for a fifth of a second." },
      { at: 0.07, label: "1.3 billion light-years", text: "We go to where it came from, as far as anyone can tell." },
      { at: 0.27, label: "Two black holes", text: "Black holes of 36 and 29 Suns circle each other, bending the light of the stars behind them." },
      { at: 0.42, label: "Merger", text: "In the last fifth of a second they whirl round dozens of times and merge." },
      { at: 0.55, label: "Space rings", text: "One black hole of 62 Suns: three Suns' worth of mass has gone out as gravitational waves." },
      { at: 0.86, label: "Looking back", text: "A century after Einstein predicted them, the first gravitational waves were felt on Earth." },
    ],
    build: mergerScene({
      kind: "bh",
      sep: 9,
      rsA: 0.75, rsB: 0.62, rsC: 1.3,
      massRatio: 29 / 65,
      q: { merge: 0.42 },
      afterView: 30,
      labels: { a: ["36 Suns"], b: ["29 Suns"], below: true, after: ["One black hole", "62 Suns"], waves: ["Gravitational waves", "ripples in space itself"] },
      titles: [
        [0, ["Two black holes", "36 and 29 times the Sun's mass"]],
        [0.3, ["The last moments", "faster and faster"]],
        [0.42, ["They merge", "one black hole of 62 Suns"]],
        [0.55, ["Ringing down", "3 Suns' worth of mass gone as waves"]],
      ],
      /* The chirp LIGO recorded (Abbott et al. 2016): frequency rising
       * from 35 to 250 Hz and the strain growing, then ringing down;
       * drawn with far fewer cycles. */
      chart: {
        title: "The signal at LIGO Hanford: the 'chirp'",
        ticks: [[0, "−0.2 s"], [0.8, "merger"], [1, ""]],
        yTicks: [[0.5, "0"]],
        fn: (u) => {
          const tau = Math.max(1e-3, 0.8 - u);
          const env = u < 0.8 ? 0.08 + 0.38 * Math.pow(0.8 / (0.8 + tau * 12), 2) : 0.46 * Math.exp(-(u - 0.8) * 30);
          const ph = u < 0.8 ? -Math.pow(tau, 0.625) * 70 : (u - 0.8) * 220;
          return 0.5 + env * Math.sin(ph);
        },
        samples: 600,
        colour: "#9fc8ff",
        from: 0.15,
        to: 0.55,
      },
    }),
    end: seen(0, "#ffffff", ["Gravitational waves", "felt by LIGO, not seen"], ["14 September 2015, on Earth", "space stretched by a thousandth of a proton"], { aura: 0.6 }),
  }),
});

/* ------------------------------------------------------------ Proxima */

export const PROXIMA = event({
  id: "proxima-superflare",
  section: "deep",
  title: "Proxima Centauri's superflare",
  place: "Proxima Centauri · 4.24 light-years",
  kind: "recorded",
  family: "stellar",
  when: "18 March 2016",
  often: "once, 2016 — and several times a year",
  timeline: { last: "18 March 2016" },
  detail: "Our nearest star, a small red dwarf, brightened about 68 times in minutes — a blast that would scorch the rocky planet orbiting close beside it",
  frequency: "Proxima flares many times a day. Superflares of this size were estimated at about five a year (Howard et al. 2018)",
  cause: "Red dwarfs like Proxima are churned by convection right through, which tangles their magnetic fields. When a tangle snaps and reconnects, it releases its energy as a flare — like the Sun's, but far bigger compared with the star's own light.",
  note: "The Evryscope array caught the flare on 18 March 2016: Proxima brightened about 68 times, to the edge of naked-eye visibility (Howard et al. 2018). Its planet Proxima b, at least 1.07 Earth masses, orbits only 0.0485 AU out — 20 times closer than Earth is to the Sun — so it takes the full force; repeated flares like this could strip an Earth-like ozone layer. Our Sun's biggest flares brighten it by well under 1%.",
  accuracy: "Its place and distance are real. The planet's orbit is drawn about 6 times too small compared with the star (it is really 68 star-radii out), and the planet is enlarged. The Sun beside it is to the same scale as the star. The light curve is the flare's shape and height.",
  art: { main: "star", fx: "flare" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Proxima Centauri: RA 14h 29m 42.9s, Dec −62° 40′ 46″; 1.30 pc =
     * 4.24 light-years (Gaia DR3). */
    target: { name: "Proxima Centauri", short: "Proxima", ra: H(14, 29, 42.9), dec: D(-62, 40, 46), ly: 4.24, lyText: "4.24 light-years", lightTime: "4 years and 3 months", where: "in Centaurus" },
    tells: [
      { at: 0, label: "Our nearest star", text: "Proxima Centauri, 4.24 light-years away — too faint to see without a telescope." },
      { at: 0.07, label: "4.24 light-years", text: "We travel to it: the closest star to the Sun." },
      { at: 0.27, label: "A red dwarf and its planet", text: "A small, cool star with a rocky planet, Proxima b, orbiting very close." },
      { at: 0.48, label: "The superflare", text: "18 March 2016: a magnetic loop snaps, and the star brightens 68 times in minutes." },
      { at: 0.58, label: "The planet takes the blast", text: "So close in, Proxima b is hit hard; flares like this could strip away an ozone layer." },
      { at: 0.76, label: "Compared with the Sun", text: "Proxima is a seventh of the Sun's width — yet its flares are far fiercer for its size." },
      { at: 0.86, label: "Looking back", text: "Even at the flare's peak, it was only just visible to the eye from Earth." },
    ],
    build: proximaScene({
      titles: [
        [0, ["Proxima Centauri and Proxima b", "a red dwarf and its planet"]],
        [0.32, ["The superflare", "18 March 2016"]],
        [0.5, ["The planet in the blast", "0.0485 AU from its star"]],
        [0.82, ["Proxima beside our Sun", "to the same scale"]],
      ],
      /* Evryscope, 18 March 2016 (Howard et al. 2018): to 68 times the
       * star's light in minutes, back in about an hour. */
      chart: {
        title: "Proxima's light, 18 March 2016",
        ticks: [[0, "0"], [0.15, "5 min"], [1, "1 hour"]],
        yTicks: [[0.95, "×68"], [0.05, "×1"]],
        fn: curveThrough([[0, 0.02], [0.08, 0.02], [0.14, 0.95], [0.25, 0.4], [0.5, 0.12], [1, 0.03]]),
        colour: "#ffb08a",
      },
    }),
    end: seen(0.5, "#ffb08a", ["Proxima Centauri", "at the flare's peak: just visible to the eye"], ["18 March 2016, from Earth", "our nearest star, flaring"], { size: 0.02 }),
  }),
});

/* ------------------------------------------------------------ Betelgeuse */

export const BETELGEUSE = event({
  id: "betelgeuse-dimming",
  section: "deep",
  title: "Betelgeuse's Great Dimming",
  place: "Orion · about 550 light-years",
  kind: "recorded",
  family: "stellar",
  when: "December 2019 – February 2020, faintest in mid-February",
  often: "once, 2019–20",
  timeline: { last: "Dec 2019 – Feb 2020" },
  detail: "The red supergiant at Orion's shoulder faded to about a third of its usual light — not because it was dying, but behind a veil of its own dust",
  frequency: "A one-off. Betelgeuse always varies a little, over about 400 days and about 6 years, but nothing like this had been seen in a century of careful measurement",
  cause: "In 2019 the star threw off a large bubble of hot gas from its southern half. Over the following months the gas cooled and condensed into dust, which blocked part of the star's light as seen from Earth. A cooler patch on the surface beneath may have helped the dust form.",
  note: "By February 2020 it had fallen from about magnitude +0.5 to +1.6. It is so big that, put where the Sun is, it would reach past Mars toward Jupiter. It will one day explode as a supernova — probably in about 100,000 years. From 550 light-years that would be as bright as a half Moon for weeks, visible by day, and harmless: a supernova needs to be within about 50 light-years to hurt Earth's ozone.",
  accuracy: "Its place and distance are real (548 light-years, Joyce et al. 2020). The bubble and dust are drawn where the telescope images showed the star darkened. The Solar System's orbits round it are to the same scale as the star.",
  art: { main: "redgiant", fx: "dust" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Betelgeuse: RA 05h 55m 10.3s, Dec +07° 24′ 25″; 168 pc = 548 ly
     * (Joyce et al. 2020). */
    target: { name: "Betelgeuse", short: "Betelgeuse", ra: H(5, 55, 10.3), dec: D(7, 24, 25), ly: 548, lyText: "about 550 light-years", where: "in Orion" },
    tells: [
      { at: 0, label: "Winter 2019–20", text: "Orion's red shoulder star fades to a third of its usual light. Is it about to explode?" },
      { at: 0.07, label: "550 light-years", text: "We travel to Betelgeuse." },
      { at: 0.27, label: "A red supergiant", text: "One of the biggest stars we can see, its surface boiling with giant cells of gas." },
      { at: 0.38, label: "A bubble of gas", text: "In 2019 it threw off a bubble from its southern half…" },
      { at: 0.47, label: "…which turned to dust", text: "The gas cooled into dust and hid part of the star from Earth: the Great Dimming." },
      { at: 0.7, label: "How big it is", text: "Put where the Sun is, it would swallow Mercury, Venus, Earth and Mars." },
      { at: 0.86, label: "Looking back", text: "One day it will explode — as bright as a half Moon, seen by day, but harmlessly far away." },
    ],
    build: betelgeuseScene({
      titles: [
        [0, ["Betelgeuse", "a red supergiant, 548 light-years away"]],
        [0.14, ["2019: a bubble of gas", "thrown off from its southern half"]],
        [0.3, ["The gas cools into dust", "the Great Dimming"]],
        [0.66, ["Its size", "the inner Solar System, to scale"]],
      ],
      /* AAVSO V magnitudes, simplified (Guinan et al. 2020): +0.5 in
       * October 2019, +1.6 on about 13 February 2020, back near +0.5 by
       * April. */
      chart: {
        title: "Betelgeuse's brightness, Oct 2019 – Apr 2020",
        ticks: [[0, "Oct"], [0.5, "Jan"], [0.72, "mid-Feb"], [1, "Apr"]],
        yTicks: [[0.9, "+0.5"], [0.1, "+1.6"]],
        fn: curveThrough([[0, 0.9], [0.25, 0.75], [0.5, 0.35], [0.72, 0.1], [0.85, 0.45], [1, 0.85]]),
        colour: "#ffb08a",
      },
    }),
    end: (q) => ({
      glow: 0.9, size: 0.03, colour: "#ffb08a",
      label: q < 0.5 ? ["Betelgeuse, February 2020", "a third of its usual light"] : ["Betelgeuse as a supernova, one day", "as bright as a half Moon — and harmless"],
      title: q < 0.5 ? ["February 2020, from Earth", "Orion's shoulder, dimmed"] : ["Its impact on us", "a daytime star for weeks; no danger from 550 ly"],
    }),
  }),
});

/* ------------------------------------------------------------ T CrB */

export const T_CRB = event({
  id: "t-crb-nova",
  section: "deep",
  title: "T Coronae Borealis: a nova we're waiting for",
  place: "Corona Borealis · about 3,000 light-years",
  kind: "recurring",
  family: "stellar",
  when: "Erupted May 1866 and February 1946; the next is expected any time",
  often: "about every 80 years",
  timeline: { last: "February 1946", next: "expected any time" },
  detail: "A white dwarf steals gas from a red giant, and every 80 years or so the stolen layer explodes — taking the star from invisible to as bright as the North Star",
  frequency: "It has erupted twice on record, in 1866 and 1946, 80 years apart. Since 2015 it has behaved the way it did in the years before 1946, so astronomers have been expecting the next one since 2024",
  cause: "T CrB is a pair: a red giant and a white dwarf going round each other every 228 days. Hydrogen from the giant spills onto the white dwarf, whose gravity crushes and heats it. When the layer is deep enough it ignites in a runaway nuclear explosion on the surface — a nova. The white dwarf survives, and starts collecting again.",
  note: "Usually about magnitude +10, it peaked near +2 in 1866 and near +3 in 1946, and fades again within a week. When it goes it will be bright enough to see without a telescope for a few days — look between Arcturus and Vega, beside the semicircle of Corona Borealis.",
  accuracy: "Its place and distance are real (about 914 parsecs, Gaia). The two stars, the stream and the disc are drawn, not to scale (the real white dwarf is about the size of Earth). The dates and magnitudes are the recorded ones.",
  art: { main: "whitedwarf", second: "redgiant", fx: "flash" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* T CrB: RA 15h 59m 30.2s, Dec +25° 55′ 13″; 914 pc ≈ 3,000 ly. */
    target: { name: "T Coronae Borealis", short: "T CrB", ra: H(15, 59, 30.2), dec: D(25, 55, 13), ly: 3000, lyText: "about 3,000 light-years", where: "in Corona Borealis" },
    tells: [
      { at: 0, label: "Waiting", text: "Beside the Northern Crown is a star too faint to see — until it erupts, about once every 80 years." },
      { at: 0.07, label: "3,000 light-years", text: "We travel to T Coronae Borealis." },
      { at: 0.27, label: "A giant and a dwarf", text: "A white dwarf orbits a red giant every 228 days, pulling hydrogen off it." },
      { at: 0.42, label: "1866, 1946…", text: "When the stolen layer is deep enough, it explodes. Then the white dwarf starts collecting again." },
      { at: 0.75, label: "Any time now", text: "Since 2015 it has behaved just as it did before 1946: the next eruption is due." },
      { at: 0.86, label: "Looking back", text: "When it goes, look beside the Northern Crown: a new star as bright as the North Star, for a few days." },
    ],
    build: novaScene({
      donor: { r: 2.6, at: 8, colour: "#ff6a3a", hot: "#ffa070" },
      discR: 2.3,
      eruptions: [0.24, 0.55, 0.88],
      shell: { R: 22 },
      view: 22,
      labels: { donor: ["Red giant", "orbit: 228 days"], wd: ["White dwarf"], shell: ["The nova", "the layer blown off"] },
      years: [[0, ["1866", "12 May: the first"]], [0.24, ["1866", "magnitude +2"]], [0.4, ["1946", "80 years later"]], [0.55, ["1946", "9 February: magnitude +3"]], [0.7, ["2015–2026", "it dims and brightens as before 1946"]], [0.88, ["Next", "any time now"]]],
      titles: [
        [0, ["A red giant and a white dwarf", "feeding"]],
        [0.24, ["The nova", "it erupts"]],
        [0.68, ["Collecting again", "and now due"]],
      ],
      /* Its record (Schaefer 2023): spikes in 1866 and 1946, with the
       * pre-eruption dip of 2023 drawn before the next. */
      chart: {
        title: "T CrB: eruptions on record",
        ticks: [[0.0, "1860"], [0.37, "1946"], [0.94, "2026"]],
        yTicks: [[0.95, "mag +2"], [0.1, "+10"]],
        fn: (u) => {
          const y = 1860 + u * 175;
          const sp = (e, h) => (y >= e ? h * Math.exp(-(y - e) / 0.5) : 0);
          const next = y >= 2026.5 ? 0.85 * Math.exp(-(y - 2026.5) / 0.5) : 0;
          return 0.1 + sp(1866.4, 0.85) + sp(1946.1, 0.75) + (y > 2020 && y < 2026.5 ? -0.04 : 0) + (u > 0.95 ? next : 0);
        },
        samples: 700,
        colour: "#ffb0c0",
        from: 0.15,
        to: 0.9,
      },
    }),
    end: seen(1, "#fff0f4", ["T Coronae Borealis, when it goes", "a new star as bright as the North Star"], ["Look beside the Northern Crown", "between Arcturus and Vega"], { size: 0.034 }),
  }),
});

/* ------------------------------------------------------------ BOAT */

export const BOAT = event({
  id: "grb-boat",
  section: "deep",
  title: "The brightest gamma-ray burst ever (\"the BOAT\")",
  place: "Sagitta · about 2.4 billion light-years",
  kind: "recorded",
  family: "deepSky",
  when: "9 October 2022",
  often: "once, 2022",
  timeline: { last: "9 October 2022" },
  detail: "GRB 221009A: a giant star collapsed into a black hole, and the gamma rays from its jet still shook Earth's upper atmosphere after 2 billion years",
  frequency: "Gamma-ray bursts are seen about once a day, from all over the sky. One as bright as this one is estimated to come along about once in 10,000 years (Burns et al. 2023)",
  cause: "When a very massive, fast-spinning star runs out of fuel, its core collapses straight into a black hole. Gas swirling into it launches two narrow jets at almost the speed of light, which punch out through the star. If one points at Earth, we see a flash of gamma rays.",
  note: "It came from a galaxy at redshift 0.151 — about 2.4 billion light-years away; its light set out about 2 billion years ago. Its gamma rays measurably disturbed Earth's ionosphere, and swamped many of the detectors that caught it. It was nicknamed the BOAT: the Brightest Of All Time.",
  accuracy: "Its direction and distance are real. The star, the jets and the black hole are drawn, not to scale.",
  art: { main: "blackhole", fx: "beam" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* GRB 221009A: RA 19h 13m 03.5s, Dec +19° 46′ 24″; z = 0.151. */
    target: { name: "GRB 221009A (the BOAT)", short: "GRB 221009A", ra: H(19, 13, 3.5), dec: D(19, 46, 24), ly: 2.4e9, lyText: "about 2.4 billion light-years", lightTime: "about 2 billion years", where: "in Sagitta" },
    extragalactic: true,
    tells: [
      { at: 0, label: "9 October 2022", text: "The brightest burst of gamma rays ever recorded swamps detectors in orbit." },
      { at: 0.07, label: "2.4 billion light-years", text: "We leave our galaxy far behind." },
      { at: 0.27, label: "A giant star", text: "A massive, fast-spinning star has run out of fuel." },
      { at: 0.4, label: "A black hole and two jets", text: "Its core collapses into a black hole; jets drill out at nearly the speed of light — one pointed at Earth." },
      { at: 0.86, label: "Looking back", text: "Two billion years later its gamma rays reached Earth and disturbed the upper atmosphere." },
    ],
    build: supernovaScene({
      kind: "hyper",
      /* A Wolf-Rayet star: stripped, blue-white, in its own dense wind. */
      star: { r: 1.8, kind: "wr" },
      leftover: "blackhole",
      remR: 56,
      burstColours: ["#ffffff", "#cfe2ff", "#e8d0ff", "#ffd27f"],
      remnant: { count: 3000, filament: ["#bcd8ff", "#ffd27f", "#ff8a6a"], haze: "#6a8aff", hazeShare: 0.3 },
      q: { collapse: 0.16, blast: 0.24, remnant: 0.6, photo: 2 },
      labels: { star: ["A massive star", "spinning fast, out of fuel"], leftover: ["A black hole", "born in the collapse"], remnant: ["The jet toward Earth", "gamma rays, nearly at light speed"] },
      titles: [
        [0, ["A dying giant", "2.4 billion light-years from Earth"]],
        [0.16, ["Collapse to a black hole", ""]],
        [0.24, ["Two jets", "one aimed straight at us"]],
        [0.6, ["The brightest of all time", "about once in 10,000 years"]],
      ],
      /* Fermi GBM, first ten minutes, shape: a precursor, the main pulse
       * at about 200–300 s, a long tail (Lesage et al. 2023). */
      chart: {
        title: "Gamma rays at Fermi, first 10 minutes (shape)",
        ticks: [[0, "0"], [0.4, "4 min"], [1, "10 min"]],
        yTicks: [[0.95, "saturated"]],
        fn: curveThrough([[0, 0], [0.02, 0.2], [0.04, 0.03], [0.3, 0.05], [0.36, 0.95], [0.42, 0.7], [0.46, 0.92], [0.55, 0.3], [1, 0.05]]),
        colour: "#e8d0ff",
      },
    }),
    end: seen(0.3, "#e8d0ff", ["GRB 221009A", "invisible to the eye — a flood of gamma rays"], ["9 October 2022, on Earth", "the upper atmosphere disturbed"], { size: 0.02, aura: 1 }),
  }),
});

/* ------------------------------------------------------------ TDE */

export const TDE = event({
  id: "tidal-disruption",
  section: "deep",
  title: "A star torn apart by a black hole",
  place: "AT2019qiz · Eridanus · about 215 million light-years",
  kind: "recurring",
  family: "galactic",
  when: "Found 19 September 2019 (AT2019qiz)",
  often: "once every 10,000–100,000 years in a galaxy",
  timeline: { last: "September 2019 (AT2019qiz)" },
  detail: "A star strays too close to a giant black hole and is stretched into a stream — half flung away, half swallowed in a flare that lasts for months",
  frequency: "In any one galaxy, perhaps once every 10,000 to 100,000 years. With millions of galaxies to watch, sky surveys now find dozens a year",
  cause: "Gravity weakens with distance, so near a black hole of millions of Suns the pull on a star's near side is much stronger than on its far side. Close enough, that difference beats the star's own gravity: it is pulled into a long stream (spaghettified). About half the gas is bound and falls back; the rest escapes.",
  note: "AT2019qiz, in a spiral galaxy about 215 million light-years away, was caught early and watched closely: a star about the Sun's mass torn apart by a black hole of about a million Suns (Nicholl et al. 2020). In 2024 X-ray flashes from it were seen repeating every 48 hours — probably another star or a black hole punching through the leftover disc (Nicholl et al. 2024, Nature).",
  accuracy: "Its place and distance are real. The star is drawn far larger than it is next to the black hole; the black hole is ray-traced. The stream's shape follows the orbit, squeezed in time.",
  art: { main: "blackhole", second: "star", fx: "stream" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* AT2019qiz: RA 04h 46m 37.9s, Dec −10° 13′ 35″; 66 Mpc ≈ 215 Mly. */
    stars: false,
    target: { name: "AT2019qiz", short: "AT2019qiz", ra: H(4, 46, 37.9), dec: D(-10, 13, 35), ly: 215e6, lyText: "about 215 million light-years", where: "in Eridanus" },
    extragalactic: true,
    tells: [
      { at: 0, label: "September 2019", text: "A sky survey sees the heart of a distant galaxy suddenly brighten." },
      { at: 0.07, label: "215 million light-years", text: "We leave our galaxy to see why." },
      { at: 0.27, label: "Too close", text: "A star like the Sun falls toward a black hole of a million Suns." },
      { at: 0.45, label: "Spaghettified", text: "Its near side is pulled far harder than its far side: it is stretched into a stream." },
      { at: 0.62, label: "The flare", text: "Half the gas escapes; half falls back, swirls into a disc and blazes for months." },
      { at: 0.86, label: "Looking back", text: "In our sky, a galaxy's centre flaring for a few months — seen only by big telescopes." },
    ],
    build: tdeScene({
      titles: [
        [0, ["A star falls toward a black hole", "a million Suns"]],
        [0.33, ["Torn apart", "the black hole's tide beats the star's own gravity"]],
        [0.55, ["Half falls back", "a hot disc, and a flare"]],
      ],
      /* AT2019qiz's light curve, simplified (Nicholl et al. 2020): a rise
       * of about a month, then a fall roughly as t^(−5/3). */
      chart: {
        title: "AT2019qiz's light, first six months",
        ticks: [[0, "Sep 2019"], [0.2, "Oct"], [1, "Mar 2020"]],
        yTicks: [[0.95, "peak"]],
        fn: (u) => (u < 0.18 ? 0.95 * Math.pow(u / 0.18, 2) : 0.95 * Math.pow(1 + (u - 0.18) * 6, -5 / 3)),
        colour: "#e8f0ff",
      },
    }),
    end: seen(0.25, "#e8f0ff", ["AT2019qiz", "a galaxy's heart flaring — telescope only"], ["Autumn 2019, from Earth", ""], { size: 0.015 }),
  }),
});

/* ------------------------------------------------------------ Sgr A* */

export const SGR_A = event({
  id: "sgr-a-flares",
  section: "deep",
  title: "Flares at the Milky Way's heart",
  place: "Sagittarius A* · about 26,700 light-years",
  kind: "recurring",
  family: "galactic",
  often: "about daily",
  detail: "The black hole at the centre of our galaxy, 4.3 million times the Sun's mass, flickers and flares about once a day",
  frequency: "It flickers all the time in infrared; a bright X-ray flare comes about once a day, and much bigger ones now and then",
  cause: "Sagittarius A* is a black hole of about 4.3 million Suns. It is starved: only a trickle of gas reaches it. As clumps of that hot gas swirl close to the edge, tangled magnetic fields heat them, and they flare in infrared and X-rays — in 2018 the GRAVITY instrument watched hot spots circling it in under an hour.",
  note: "Its mass is known from the stars that whip round it: one, S2, passes within 120 times the Earth–Sun distance every 16 years, at 7,650 km/s (GRAVITY 2018). The Event Horizon Telescope imaged its shadow in 2022. Andrea Ghez and Reinhard Genzel shared the 2020 Nobel Prize in Physics for proving it is there.",
  accuracy: "Its place and distance are real (8.2 kpc, GRAVITY 2019). The galaxy is drawn from the site's model; the S-stars' orbits are drawn to shape, not to their real tilts. The black hole is ray-traced (no spin), seen about 30° from its axis as the EHT saw it.",
  art: { main: "blackhole", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Sgr A*: RA 17h 45m 40.0s, Dec −29° 00′ 28″; 8.18 kpc ≈ 26,700 ly. */
    target: { name: "Sagittarius A*", short: "Sgr A*", ra: H(17, 45, 40), dec: D(-29, 0, 28), ly: 26700, where: "in Sagittarius" },
    phases: { map: 0.15, at: 0.33 },
    /* Prompts.md: "zoom out and show the Milky Way ... then reach the
     * centre": out above the galaxy, then down into its heart. */
    mapView: (q, U, { mw, sunPos }) => {
      /* The whole galaxy first (turning a little), then the dive. */
      const dive = easeIn(smooth(q, 0.5, 1));
      const centre = sunPos.clone().multiplyScalar(0.45 * (1 - smooth(q, 0.35, 0.75)));
      const dist = mw.R * 2.3 * Math.pow(0.012, dive);
      const yaw = 0.35 + 0.5 * q;
      U.view(centre.clone().add(V(Math.sin(yaw) * 0.5, 0.86, Math.cos(yaw) * 0.5).normalize().multiplyScalar(dist)), centre);
    },
    tells: [
      { at: 0, label: "Toward Sagittarius", text: "Behind the dust of the Milky Way, toward Sagittarius, lies our galaxy's centre." },
      { at: 0.07, label: "26,700 light-years", text: "We leave the Sun's neighbourhood…" },
      { at: 0.15, label: "The Milky Way", text: "…rise above the galaxy, and dive into its heart." },
      { at: 0.33, label: "Stars whipping round nothing", text: "Stars race round an unseen mass: 4.3 million Suns, in a space smaller than our Solar System." },
      { at: 0.58, label: "Sagittarius A*", text: "A black hole — its shadow ringed by glowing gas, as the Event Horizon Telescope saw it in 2022." },
      { at: 0.72, label: "Flares", text: "Clumps of hot gas circle it in under an hour and flare, about once a day." },
      { at: 0.86, label: "Looking back", text: "In our sky it is hidden behind dust — seen only in radio, infrared and X-rays." },
    ],
    build: sgrAScene({
      titles: [
        [0, ["The heart of the Milky Way", "the S-stars"]],
        [0.45, ["Sagittarius A*", "4.3 million Suns"]],
        [0.62, ["A flare", "hot gas circling the edge"]],
      ],
      /* A day in near-infrared, sketched after GRAVITY/Keck records:
       * constant flicker with a few flares. */
      chart: {
        title: "Near-infrared light over one day (sketch)",
        ticks: [[0, "0 h"], [0.5, "12 h"], [1, "24 h"]],
        yTicks: [[0.9, "flare"]],
        fn: (u) => 0.15 + 0.08 * Math.sin(u * 90) * Math.sin(u * 37) + 0.7 * Math.exp(-Math.pow((u - 0.35) / 0.02, 2)) + 0.45 * Math.exp(-Math.pow((u - 0.72) / 0.015, 2)),
        samples: 400,
        colour: "#ffd2a8",
      },
    }),
    end: seen(0, "#ffd2a8", ["Sagittarius A*", "hidden by dust — seen in radio, infrared, X-rays"], ["In our sky", "toward Sagittarius"]),
  }),
});

/* ------------------------------------------------------------ FRB */

export const FRB = event({
  id: "fast-radio-bursts",
  section: "deep",
  title: "Fast radio bursts",
  place: "SGR 1935+2154 · Vulpecula · about 30,000 light-years — and other galaxies",
  kind: "recurring",
  family: "deepSky",
  when: "First found in 2007 (in data recorded in 2001); one from SGR 1935+2154 on 28 April 2020",
  often: "about a thousand a day, over the whole sky",
  timeline: { last: "every few minutes, somewhere in the sky" },
  detail: "Flashes of radio waves lasting a thousandth of a second, from across the universe — some repeat, and at least one came from a magnetar in our own galaxy",
  frequency: "Estimated at around a thousand a day over the whole sky, though radio telescopes see only a sliver of it at once. The CHIME telescope alone has found thousands",
  cause: "Not fully known. The leading idea is magnetars — neutron stars with enormous magnetic fields — and the burst from SGR 1935+2154 in 2020 showed that at least some come from them. The burst's lower frequencies arrive later than the higher ones, slowed by the thin gas they cross, which tells how far they have come.",
  note: "The first, the 'Lorimer burst', was found in 2007 by Duncan Lorimer and his student David Narkevic in Parkes telescope data from 2001. On 28 April 2020 the CHIME and STARE2 telescopes caught a burst from the magnetar SGR 1935+2154, inside the Milky Way (FRB 200428) — the first time an FRB's source was known. One repeater, FRB 20121102A, flashed 1,652 times in 47 days (Li et al. 2021).",
  accuracy: "Its place is real; its distance is uncertain (about 6.6–12.5 kpc). The magnetar and its burst are drawn, not to scale, and the burst is slowed from a thousandth of a second. The sweep in the chart has the real shape (delay growing as 1/frequency²).",
  art: { main: "galaxy", fx: "flash" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* SGR 1935+2154: RA 19h 34m 55.6s, Dec +21° 53′ 48″; ~9 kpc. */
    target: { name: "SGR 1935+2154", short: "SGR 1935+2154", ra: H(19, 34, 55.6), dec: D(21, 53, 48), ly: 30000, lyText: "about 30,000 light-years", where: "in Vulpecula" },
    tells: [
      { at: 0, label: "A thousandth of a second", text: "Radio telescopes catch flashes lasting a millisecond — about a thousand a day across the sky." },
      { at: 0.07, label: "28 April 2020", text: "One came from inside our own galaxy. We travel to its source." },
      { at: 0.27, label: "A magnetar", text: "SGR 1935+2154: a neutron star with a monstrous magnetic field." },
      { at: 0.48, label: "The burst", text: "A burst of X-rays — and with it, a millisecond flash of radio waves." },
      { at: 0.62, label: "Low notes arrive late", text: "The thin gas between the stars slows the lower frequencies: the burst arrives as a sweep." },
      { at: 0.86, label: "Looking back", text: "Most bursts come from other galaxies, billions of light-years away. This one showed what makes at least some of them." },
    ],
    build: magnetarScene({
      frb: true,
      spin: 0.3,
      q: { quake: 0.32, flare: 0.42 },
      labels: { star: ["SGR 1935+2154", "a magnetar, 20 km across"], quake: ["The field strains", ""], flare: ["A fast radio burst", "one thousandth of a second"] },
      titles: [
        [0, ["SGR 1935+2154", "a magnetar in our own galaxy"]],
        [0.42, ["FRB 200428", "28 April 2020"]],
        [0.6, ["The sweep", "high frequencies first, low ones later"]],
      ],
      /* The dispersion sweep: arrival delay ∝ 1/f² (here drawn from 1.5
       * GHz to 400 MHz; FRB 200428's dispersion measure 333 pc/cm³, so
       * about 8.6 s across CHIME's band). */
      chart: {
        title: "Arrival time against frequency (the sweep)",
        ticks: [[0, "early"], [1, "8.6 s later"]],
        yTicks: [[0.95, "1.5 GHz"], [0.05, "400 MHz"]],
        fn: (u) => {
          const f = 1 / Math.sqrt(1 / (1.5 * 1.5) + u * (1 / (0.4 * 0.4) - 1 / (1.5 * 1.5)));
          return (f - 0.4) / 1.1;
        },
        colour: "#ff9ad0",
        from: 0.45,
        to: 0.8,
      },
    }),
    end: seen(0, "#ff9ad0", ["SGR 1935+2154", "a radio flash, heard by CHIME and STARE2"], ["28 April 2020, on Earth", "the first FRB with a known source"]),
  }),
});

/* ------------------------------------------------------------ Andromeda */

export const ANDROMEDA = event({
  id: "milky-way-andromeda",
  section: "deep",
  title: "Milky Way meets Andromeda",
  place: "The Local Group · Andromeda 2.5 million light-years away",
  kind: "transient",
  family: "galactic",
  when: "Billions of years from now — perhaps",
  often: "in billions of years, perhaps",
  timeline: { next: "about 50% chance within 10 billion years" },
  detail: "Andromeda is heading our way at about 110 km/s. A collision was long thought certain — now it looks like a coin toss",
  frequency: "Once, if at all. Big galaxies merging is common in the history of the universe; the Milky Way has swallowed many smaller ones already",
  cause: "Andromeda, 2.5 million light-years away, is falling toward us under the two galaxies' mutual gravity. Whether they merge depends on its sideways motion, which is very hard to measure, and on the pull of their neighbours, Triangulum (M33) and the Large Magellanic Cloud.",
  note: "The classic forecast (van der Marel et al. 2012, from Hubble measurements) was a head-on collision in about 4.5 billion years. Sawala et al. (2025, Nature Astronomy), with Gaia and Hubble data and the neighbours included, found about a 50% chance of a merger within 10 billion years. If it happens, stars almost never collide — they are too far apart — but the two spirals become one big elliptical galaxy.",
  accuracy: "Andromeda's place in the sky and its distance are real. The merger is a simple simulation of test stars round two point masses — a picture of the classic forecast, not of any study's results; the galaxies are drawn closer together than they are at the start.",
  art: { main: "galaxy", second: "galaxy", fx: "spiral" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* M31: RA 00h 42m 44.3s, Dec +41° 16′ 09″; 765 kpc ≈ 2.5 Mly. */
    target: { name: "The Andromeda Galaxy (M31)", short: "Andromeda", ra: H(0, 42, 44.3), dec: D(41, 16, 9), ly: 2.5e6, lyText: "2.5 million light-years", where: "in Andromeda" },
    extragalactic: true,
    tells: [
      { at: 0, label: "The farthest thing you can see", text: "On a dark night, Andromeda is a faint smudge: a galaxy of a trillion stars, 2.5 million light-years away." },
      { at: 0.07, label: "Leaving the Milky Way", text: "We rise out of our galaxy to see both." },
      { at: 0.27, label: "Falling together", text: "Andromeda is coming toward us at about 110 km/s." },
      { at: 0.5, label: "If they meet", text: "In a few billion years they may pass through each other, flinging out long tails of stars." },
      { at: 0.75, label: "'Milkomeda'", text: "Their stars almost never collide; the two spirals settle into one big elliptical galaxy." },
      { at: 0.86, label: "Looking back", text: "The latest study puts it at a coin toss: about a 50% chance within 10 billion years." },
    ],
    build: galaxyMergerScene({
      titles: [
        [0, ["The Milky Way and Andromeda", "falling together"]],
        [0.4, ["The first pass", "a few billion years from now — perhaps"]],
        [0.7, ["Merged", "one elliptical galaxy"]],
      ],
      chart: {
        title: "Chance of a merger, by time from now (Sawala et al. 2025)",
        ticks: [[0, "now"], [0.5, "5 Gyr"], [1, "10 Gyr"]],
        yTicks: [[0.5, "50%"]],
        fn: curveThrough([[0, 0], [0.3, 0.02], [0.45, 0.2], [0.6, 0.35], [0.8, 0.45], [1, 0.5]]),
        colour: "#ffe2b0",
      },
    }),
    end: seen(0.6, "#e8e0ff", ["The Andromeda Galaxy", "a faint smudge on a dark night"], ["In our sky", "look in Andromeda, near Cassiopeia"], { size: 0.06 }),
  }),
});

function easeIn(x) { return x * x; }

export const REDESIGNED_DEEP_EVENTS = [CRAB, SN1987A, MAGNETAR, GW150914, PROXIMA, BETELGEUSE, T_CRB, BOAT, TDE, SGR_A, FRB, ANDROMEDA];

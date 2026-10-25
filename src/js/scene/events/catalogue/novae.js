import { event, span, win, smooth, clamp01 } from "./kit.js";
import { voyage, curveThrough } from "./deepVoyage.js";
import { supernovaScene, novaScene, mergerScene } from "./deepScenes.js";

/**
 * Round 88 (Prompts.md: "Each type of nova will be individual space
 * event ... travelling beyond the solar system ... to the stars which went
 * nova ... see the explosion ... go back to the solar system, seeing the
 * explosion happening from the solar system"): one voyage for each kind of
 * stellar explosion, each to a real star that did it.
 *
 *   True novae (the white dwarf survives): classical (V1500 Cygni, 1975),
 *   recurrent (RS Ophiuchi, 1898–2021), micronova (TV Columbae, 2022),
 *   symbiotic (RR Telescopii, 1944).
 *   Supernovae (the star is destroyed): Type Ia (Tycho's star, 1572),
 *   core collapse (Cassiopeia A, about 1670 -- the round-1 "supernova"
 *   event, redesigned).
 *   Relatives: kilonova (GW170817, 2017 -- the round-1 "kilonova" event,
 *   redesigned), hypernova (SN 1998bw, 1998), luminous red nova (V838
 *   Monocerotis, 2002).
 *
 * Positions are J2000 from SIMBAD unless a comment says otherwise; the
 * distances carry their sources. The words for the narrator are in
 * speech-forDeep-sky.txt.
 */

const H = (h, m = 0, s = 0) => h + m / 60 + s / 3600;
const D = (d, m = 0, s = 0, neg = false) => (neg ? -1 : 1) * (Math.abs(d) + m / 60 + s / 3600);
/* A new star brightening in the sky at home, then settling. */
const newStar = (peak, colour, label, title, { size = 0.035, rise = 6 } = {}) => (q) => ({
  glow: Math.min(1, q * rise) * peak * (0.9 + 0.1 * Math.sin(q * 50)),
  size,
  colour,
  label,
  title,
});

/* ------------------------------------------------------------ what is a nova */

/*
 * Round 91 (Prompts.md: "we describe nova and many things, but this makes
 * the event slow ... instead we can have a different event explaining
 * nova"): her four opening paragraphs, on their own. At home a "new star"
 * flares in the real sky and fades (the word: Latin for new); then the
 * three kinds, one after another, each drawn by the scene its own event
 * uses -- a nova (a white dwarf's stolen layer ignites; it survives), a
 * supernova (a star's core collapses; the star is destroyed), a kilonova
 * (two neutron stars collide).
 *
 * acts: [{ from, to, build, titles }] in the "at" phase's own 0..1; the
 * acts not playing are run at alpha 0 (so nothing of theirs shows), and
 * the one playing last, so its camera is the one used.
 */
function acts(list) {
  return (U, ctx, H, site, tag) => {
    const built = list.map((act) => ({ ...act, s: act.build(U, ctx, H, site, tag) }));
    const at = (q) => built.find((b) => q < b.to) ?? built[built.length - 1];
    const titleAt = (titles, q) => {
      let tt = titles[0][1];
      titles.forEach(([k, words]) => { if (q >= k) tt = words; });
      return tt;
    };
    return {
      title: (q) => { const b = at(q); return titleAt(b.titles, clamp01(span(q, b.from, b.to))); },
      update(q, p, dt, a) {
        const cur = at(q);
        built.forEach((b) => { if (b !== cur) b.s.update(clamp01(span(q, b.from, b.to)), p, dt, 0); });
        const k = clamp01(span(q, cur.from, cur.to));
        const edge = (cur === built[0] ? 1 : smooth(q, cur.from, cur.from + 0.02)) * (cur === built[built.length - 1] ? 1 : 1 - smooth(q, cur.to - 0.02, cur.to));
        cur.s.update(k, p, dt, a * edge);
      },
    };
  };
}

/* V1500 Cygni's place: the example of a "new star" at home. */
const V1500 = { ra: H(21, 11, 36.6), dec: D(48, 9, 2) };

export const WHAT_IS_A_NOVA = event({
  id: "what-is-a-nova",
  section: "deep",
  title: "What is a nova? Nova, supernova and kilonova",
  place: "Anywhere in the sky — here, Cygnus",
  kind: "ongoing",
  family: "stellar",
  when: "The first 'guest star' on record: 185 AD, in China; Tycho Brahe's book De nova stella (1573) gave the name",
  often: "dozens of novae a year in our galaxy; a supernova every 50 years or so",
  timeline: { last: "every year" },
  detail: "Nova is Latin for new: a star that seemed to appear from nowhere. Most are old stars flaring — and they flare in three very different ways",
  frequency: "About 30–50 novae a year in the Milky Way (Shafter 2017); a supernova about every 50 years (Rozwadowska et al. 2021); kilonovae far more rarely",
  cause: "A nova is a white dwarf's stolen layer of hydrogen exploding; the white dwarf survives. A supernova destroys a star: a white dwarf pushed past 1.4 Suns, or a giant star whose core collapses. A kilonova is two neutron stars colliding — about a thousand times a nova's light, hence its name.",
  note: "In 1572 Tycho Brahe watched a 'new star' in Cassiopeia and called it nova stella in his book of 1573; it was really a supernova. The word kilonova was coined in 2010 (Metzger et al.), and the first was seen in 2017.",
  accuracy: "The ringed place at the start is V1500 Cygni's, as an example. The three kinds are drawn with the same scenes as their own events — not to scale, and much faster than they happen.",
  art: { main: "whitedwarf", second: "star", fx: "flash" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    target: { name: "A 'new star'", short: "A new star", ra: V1500.ra, dec: V1500.dec, ly: 5100, where: "in Cygnus" },
    map: false,
    /* Her paragraphs (speech-forDeep-sky-1, 0.0–112.0 s): what the word
     * means (to 20.8 s), a nova (to 55.9 s), a supernova (to 81.0 s), a
     * kilonova and the summary (to 112.0 s). Home holds the first; the
     * acts the other three. */
    phases: { out: 0.17, map: 0.2, at: 0.2, back: 0.975, end: 0.985 },
    home: (q) => ({
      /* A star where none was seen: it flares, then fades. */
      glow: smooth(q, 0.3, 0.42) * (1 - 0.7 * smooth(q, 0.6, 0.95)),
      size: 0.04,
      colour: "#fff2e8",
      label: ["A 'new star'", "nova: Latin for new"],
    }),
    tells: [
      { at: 0, label: "What is a nova?", text: "Nova is Latin for new: a star that seemed to appear where there had been none." },
      { at: 0.19, label: "A nova", text: "A white dwarf steals gas from a partner until the layer ignites — and the white dwarf survives." },
      { at: 0.5, label: "A supernova", text: "The death of a whole star: a white dwarf blown apart, or a giant's core collapsing." },
      { at: 0.73, label: "A kilonova", text: "Two neutron stars collide; the debris forges gold and platinum." },
      { at: 0.9, label: "Three ways to flare", text: "A nova: a flare on a surviving star. A supernova: a star's death. A kilonova: two dead ones colliding." },
    ],
    build: acts([
      {
        from: 0,
        to: 0.392,
        titles: [[0, ["A nova", "a white dwarf, and a partner it steals from"]], [0.55, ["It ignites", "the layer is blown off — the white dwarf survives"]]],
        build: novaScene({
          donor: { r: 0.95, at: 4.2, colour: "#ff6a3a", hot: "#ffa070" },
          eruptions: [0.55],
          shell: { R: 16 },
          labels: { donor: ["Its partner", "a small red star"], wd: ["White dwarf", "Earth-sized, as heavy as the Sun"], shell: ["The layer, blown off", "the star shines thousands of times brighter"] },
        }),
      },
      {
        from: 0.392,
        to: 0.68,
        titles: [[0, ["A supernova", "the death of a whole star"]], [0.45, ["The core collapses", "in under a second; the star is blown apart"]]],
        build: supernovaScene({
          star: { r: 2, kind: "rsg" },
          remR: 50,
          q: { collapse: 0.3, blast: 0.45, remnant: 0.75, ns: 2, nsEnd: 2, photo: 2 },
          labels: { star: ["A giant star", "many times the Sun's mass"], core: ["Its core", "iron, about to collapse"], remnant: ["For weeks it outshines", "a whole galaxy"] },
        }),
      },
      {
        from: 0.68,
        to: 1,
        titles: [[0, ["A kilonova", "two neutron stars"]], [0.4, ["They collide", "about a thousand times a nova's light"]], [0.65, ["Three ways to flare", "a nova survives; a supernova dies; a kilonova: two dead stars collide"]]],
        build: mergerScene({
          kind: "neutron",
          sep: 7,
          q: { merge: 0.4 },
          labels: { a: ["Neutron star", "a dead giant's crushed core"], b: ["Neutron star", ""], debris: ["The debris", "gold, platinum, uranium forming"], waves: ["", ""] },
        }),
      },
    ]),
    end: newStar(0.2, "#fff2e8", ["A 'new star'", "now faded"], ["", ""], { size: 0.02 }),
  }),
});

/* ------------------------------------------------------------ classical */

export const CLASSICAL_NOVA = event({
  id: "classical-nova",
  section: "deep",
  title: "A classical nova: Nova Cygni 1975",
  place: "V1500 Cygni · Cygnus · about 5,100 light-years",
  kind: "recorded",
  family: "stellar",
  when: "29–30 August 1975",
  often: "a few dozen are found in our galaxy every year",
  timeline: { last: "30 August 1975" },
  detail: "A white dwarf's stolen skin of hydrogen explodes — and a star too faint for any telescope but the biggest became, for a night, one of the brightest in the sky",
  frequency: "Astronomers find about 5 to 15 novae a year in the Milky Way and think around 30 to 50 go off (Shafter 2017); one as bright as this comes along every few decades",
  cause: "A white dwarf — the Earth-sized core left by a Sun-like star — orbits close to a small red dwarf and pulls hydrogen off it. The gas piles up on the white dwarf's surface, crushed and heated by its gravity, until at about 20 million °C it ignites all at once: a hydrogen bomb the size of a planet. The layer is blown off; the white dwarf survives, and starts collecting again.",
  note: "V1500 Cygni rose more than 19 magnitudes — over 40 million times — in about a day, to magnitude 1.7 on 30 August 1975, the brightest nova since 1918 and the fastest ever recorded. Its white dwarf is strongly magnetic, and the pair go round each other in 3.35 hours.",
  accuracy: "Its place in the sky and the galaxy are real (Gaia: about 1,600 parsecs). The white dwarf, the red dwarf, the stream and the disc are drawn far larger than they are next to the space between them, and the shell is slowed so it can be seen.",
  art: { main: "whitedwarf", second: "star", fx: "flash" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* V1500 Cyg: RA 21h 11m 36.6s, Dec +48° 09′ 02″; Gaia DR3: about
     * 1,600 pc = 5,100 light-years. */
    target: { name: "V1500 Cygni (Nova Cygni 1975)", short: "V1500 Cygni", ra: H(21, 11, 36.6), dec: D(48, 9, 2), ly: 5100, where: "in Cygnus" },
    /* Round 91: the opening paragraphs on what a nova, a supernova and a
     * kilonova are now have an event of their own ("What is a nova?"), so
     * this one runs only her lines on V1500 Cygni (about 60 s). */
    tells: [
      { at: 0, label: "29 August 1975", text: "A new star appears in Cygnus overnight — by the next evening it is one of the brightest in the sky." },
      { at: 0.07, label: "5,100 light-years", text: "We travel to it." },
      { at: 0.27, label: "A stolen skin", text: "A white dwarf pulls hydrogen off its red-dwarf partner; it swirls into a disc and settles on the surface." },
      { at: 0.5, label: "Ignition", text: "Crushed and heated to millions of degrees, the layer ignites all at once and is blasted off." },
      { at: 0.72, label: "It survives", text: "The white dwarf is still there, and starts collecting again — a classical nova is a surface explosion, not a death." },
      { at: 0.86, label: "Looking back", text: "In our sky: a star that rose 40 million times in brightness in about a day." },
    ],
    build: novaScene({
      donor: { r: 0.95, at: 4.2, colour: "#ff6a3a", hot: "#ffa070" },
      eruptions: [0.42],
      shell: { R: 16 },
      labels: { donor: ["Red dwarf", "a fifth of the Sun's mass"], wd: ["White dwarf", "Earth-sized, with the Sun's mass"], shell: ["The blown-off layer", "about 1,500 km/s"] },
      titles: [
        [0, ["A white dwarf and a red dwarf", "3 hours 21 minutes round each other"]],
        [0.12, ["Feeding", "hydrogen spills onto the white dwarf"]],
        [0.42, ["The nova", "the hydrogen layer ignites"]],
        [0.72, ["The white dwarf survives", "and starts collecting again"]],
      ],
      /* AAVSO light curve, simplified: >21 to 1.7 in about a day, then
       * fading by about 3 magnitudes in 4 days (Young et al. 1976). */
      chart: {
        title: "Brightness from Earth, August–September 1975",
        ticks: [[0, "28 Aug"], [0.2, "30 Aug"], [1, "mid-Sept"]],
        yTicks: [[0.95, "mag 1.7"], [0.05, "too faint"]],
        fn: curveThrough([[0, 0.02], [0.17, 0.06], [0.2, 1], [0.32, 0.72], [0.55, 0.45], [1, 0.22]]),
        colour: "#ffb0c0",
        from: 0.36,
        to: 0.8,
      },
    }),
    end: newStar(1, "#fff0f4", ["Nova Cygni 1975", "magnitude 1.7 — as bright as Deneb's brightest neighbours"], ["30 August 1975, from Earth", "a new bright star in the Swan"]),
  }),
});

/* ------------------------------------------------------------ recurrent */

export const RECURRENT_NOVA = event({
  id: "recurrent-nova",
  section: "deep",
  title: "A recurrent nova: RS Ophiuchi",
  place: "RS Ophiuchi · Ophiuchus · about 5,000 light-years",
  kind: "recurring",
  family: "stellar",
  when: "1898, 1933, 1958, 1967, 1985, 2006, 2021",
  often: "about every 15–20 years",
  timeline: { last: "8 August 2021", next: "around the late 2030s, perhaps" },
  detail: "The same white dwarf has blown up at least seven times since 1898 — every 15 to 20 years it goes from invisible to just visible to the eye",
  frequency: "Eruptions seen in 1898, 1933, 1958, 1967, 1985, 2006 and 2021, and two more found later in old records (1907 and 1945): one every 9 to 26 years",
  cause: "A white dwarf close to the 1.4-Sun limit orbits a red giant every 454 days and feeds on its wind. Because the white dwarf is so heavy, its gravity crushes the stolen gas hard, and only a thin layer is needed to ignite — so it goes off every couple of decades instead of every 100,000 years. Its blast slams into the giant's wind, making shock waves that shine in X-rays and gamma rays.",
  note: "In 2021 it reached about magnitude 4.6, and the H.E.S.S. and MAGIC telescopes caught the most energetic gamma rays ever seen from a nova — proof that its shock waves accelerate cosmic rays. T Coronae Borealis, in its own event, is a recurrent nova too.",
  accuracy: "Its place and its eruption years are real; its distance is uncertain (about 1,200–2,000 parsecs). The stars, the disc and the shells are drawn, not to scale, and the decades between eruptions are squeezed into seconds.",
  art: { main: "whitedwarf", second: "redgiant", fx: "flash" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* RS Oph: RA 17h 50m 13.2s, Dec −06° 42′ 28″; about 5,000 light-years
     * (estimates 1.2–2.0 kpc). */
    target: { name: "RS Ophiuchi", short: "RS Ophiuchi", ra: H(17, 50, 13.2), dec: D(6, 42, 28, true), ly: 5000, where: "in Ophiuchus" },
    tells: [
      { at: 0, label: "Again and again", text: "RS Ophiuchi has erupted at least seven times since 1898 — the last on 8 August 2021." },
      { at: 0.07, label: "5,000 light-years", text: "We travel to it." },
      { at: 0.27, label: "Feeding on a giant", text: "A heavy white dwarf feeds on the wind of a red giant it orbits every 454 days." },
      { at: 0.4, label: "Every 20 years", text: "So heavy is the white dwarf that a thin layer is enough to ignite — it erupts again and again." },
      { at: 0.86, label: "Looking back", text: "In our sky it jumps from magnitude 12.5 to about 4.5 — just visible to the eye for a few days." },
    ],
    build: novaScene({
      donor: { r: 2.6, at: 8, colour: "#ff6a3a", hot: "#ffa070" },
      discR: 2.2,
      eruptions: [0.18, 0.36, 0.54, 0.72],
      shell: { R: 22, colours: ["#ff6a8a", "#ffb0c8", "#bfe0ff", "#ffffff"] },
      view: 22,
      labels: { donor: ["Red giant", "orbit: 454 days"], wd: ["White dwarf", "near the 1.4-Sun limit"], shell: ["Blast into the giant's wind", "shock waves, gamma rays"] },
      years: [[0, ["1898", "first eruption on record"]], [0.18, ["1933", "…and 1958, 1967"]], [0.36, ["1985", ""]], [0.54, ["2006", ""]], [0.72, ["2021", "8 August — the latest"]]],
      titles: [
        [0, ["A white dwarf and a red giant", "feeding on the giant's wind"]],
        [0.18, ["It erupts", "and again, every 15–20 years"]],
        [0.85, ["Collecting again", "the next one perhaps in the late 2030s"]],
      ],
      /* The eruption years (AAVSO; Schaefer 2010), as spikes. */
      chart: {
        title: "Eruptions since 1890",
        /* Round 91: 1985, 2006 and 2021 sat too close to read; every
         * other eruption is labelled. */
        ticks: [[0.06, "1898"], [0.33, "1933"], [0.58, "1967"], [0.87, "2006"]],
        yTicks: [[0.9, "mag 4.5"], [0.05, "12.5"]],
        fn: (u) => {
          const years = [1898, 1907, 1933, 1945, 1958, 1967, 1985, 2006, 2021];
          const y = 1890 + u * 132;
          return 0.05 + 0.85 * Math.max(...years.map((e) => (y >= e ? Math.exp(-(y - e) / 0.6) : 0)));
        },
        samples: 600,
        colour: "#ffb0c0",
        from: 0.1,
        to: 0.8,
      },
    }),
    end: newStar(0.7, "#fff0f4", ["RS Ophiuchi, August 2021", "magnitude 4.6 — just visible to the eye"], ["8 August 2021, from Earth", "a faint new star in Ophiuchus"], { size: 0.028 }),
  }),
});

/* ------------------------------------------------------------ micronova */

export const MICRONOVA = event({
  id: "micronova",
  section: "deep",
  title: "A micronova: TV Columbae",
  place: "TV Columbae · Columba · about 1,600 light-years",
  kind: "recurring",
  family: "stellar",
  when: "Found in 2022 (Scaringi et al., Nature)",
  often: "every few days or weeks",
  timeline: { last: "found 2022" },
  detail: "A tiny thermonuclear burst on one magnetic pole of a white dwarf — over in a few hours, a millionth the size of a nova",
  frequency: "TESS caught bursts on TV Columbae, EI Ursae Majoris and ASASSN-19bh; each lasts about 10 hours, and they recur",
  cause: "Some white dwarfs have magnetic fields strong enough to stop a disc reaching them: the gas is caught by the field and channelled down onto the two magnetic poles. Hydrogen piles up there in a small patch. When it gets hot and dense enough it ignites — only the patch, only for hours.",
  note: "Each burst burns about 20 million billion kg of hydrogen — about 3.5 billion Great Pyramids of Giza (ESO press release, April 2022) — yet that is a millionth of a classical nova. TV Columbae's white dwarf spins once every 32 minutes and its partner goes round every 5.5 hours.",
  accuracy: "Its place in the sky and the galaxy are real (Gaia: 503 parsecs). The white dwarf, its field, the stream and the burst are drawn, not to scale; the burst is drawn bigger and quicker than it is.",
  art: { main: "whitedwarf", fx: "flash" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* TV Col: RA 05h 29m 25.5s, Dec −32° 49′ 04″; Gaia EDR3: 503 pc =
     * 1,640 light-years (Mukai, NASA GSFC catalogue). */
    target: { name: "TV Columbae", short: "TV Columbae", ra: H(5, 29, 25.5), dec: D(32, 49, 4, true), ly: 1640, where: "in Columba" },
    tells: [
      { at: 0, label: "2022", text: "NASA's TESS satellite catches white dwarfs flaring for a few hours — a new, tiny kind of nova." },
      { at: 0.07, label: "1,600 light-years", text: "We travel to TV Columbae." },
      { at: 0.27, label: "Down the field lines", text: "The white dwarf's magnetic field catches the gas and pours it onto its poles." },
      { at: 0.5, label: "A micronova", text: "The hydrogen on one pole ignites — a burst a millionth the size of a nova, over in about ten hours." },
      { at: 0.86, label: "Looking back", text: "Too faint to see by eye: TESS saw TV Columbae brighten about threefold for a few hours." },
    ],
    build: novaScene({
      donor: { r: 0.9, at: 3.6, colour: "#ff6a3a", hot: "#ffa070" },
      magnetic: true,
      micro: true,
      wdR: 0.22,
      eruptions: [0.42],
      view: 11,
      labels: { donor: ["Red dwarf", "round every 5.5 hours"], wd: ["White dwarf", "spinning every 32 minutes"], pole: ["The burst", "on one magnetic pole — a few hours"] },
      titles: [
        [0, ["A magnetic white dwarf", "its field reaches out to the gas"]],
        [0.12, ["Gas channelled to the poles", "no disc — the field takes it"]],
        [0.42, ["The micronova", "only the polar patch ignites"]],
        [0.62, ["Gone in hours", "a millionth of a nova"]],
      ],
      /* TESS light curve shape (Scaringi et al. 2022): a rise of about 3
       * times in under an hour, about 10 hours to fade. */
      chart: {
        title: "TV Columbae seen by TESS, one day",
        ticks: [[0, "0 h"], [0.5, "12 h"], [1, "24 h"]],
        yTicks: [[0.9, "×3"], [0.25, "×1"]],
        fn: curveThrough([[0, 0.25], [0.3, 0.27], [0.33, 0.9], [0.4, 0.62], [0.55, 0.35], [0.75, 0.27], [1, 0.25]]),
        colour: "#ffe2a8",
        from: 0.3,
        to: 0.75,
      },
    }),
    end: newStar(0.35, "#fff2d8", ["TV Columbae", "too faint for the eye — a telescope's flicker"], ["In our sky", "a few hours, three times brighter"], { size: 0.018 }),
  }),
});

/* ------------------------------------------------------------ symbiotic */

export const SYMBIOTIC_NOVA = event({
  id: "symbiotic-nova",
  section: "deep",
  title: "A slow symbiotic nova: RR Telescopii",
  place: "RR Telescopii · Telescopium · about 8,800 light-years",
  kind: "recorded",
  family: "stellar",
  when: "Began late 1944; brightest 1948–49; still fading",
  often: "once — and still going",
  timeline: { last: "1944 – today" },
  detail: "A white dwarf fed by the wind of a pulsating red giant flared up in 1944 — and has been fading ever since, for 80 years",
  frequency: "Very slow novae like this are rare: only about a dozen are known",
  cause: "In a symbiotic star, a white dwarf orbits far out from a red giant and catches some of its wind. Here the white dwarf is light, so the gas must pile very deep before it ignites — and then it burns steadily for decades instead of blowing off in days.",
  note: "Before 1944 RR Tel was a Mira-type red giant, pulsing every 387 days between about magnitude 9 and 16. It rose to about magnitude 6 by 1948 and began to fade only in 1949; in 1977 it was still at magnitude 10, and about 12 in 2013. The white dwarf is about 140,000 °C.",
  accuracy: "Its place in the sky and the galaxy are real (about 2,700 parsecs). The two stars are drawn far closer together than they are (their orbit takes years or decades), and eighty years are squeezed into seconds.",
  art: { main: "whitedwarf", second: "redgiant", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* RR Tel: RA 20h 04m 18.5s, Dec −55° 43′ 33″; 2,700 pc = 8,800 ly. */
    target: { name: "RR Telescopii", short: "RR Telescopii", ra: H(20, 4, 18.5), dec: D(55, 43, 33, true), ly: 8800, where: "in Telescopium" },
    tells: [
      { at: 0, label: "1944", text: "A pulsating red giant in the southern sky begins to brighten — and does not stop for years." },
      { at: 0.07, label: "8,800 light-years", text: "We travel to it." },
      { at: 0.27, label: "Living in a giant's wind", text: "A white dwarf orbits far out from a red giant and catches some of the gas it sheds." },
      { at: 0.4, label: "A slow burn", text: "When the deep layer ignites it does not blow off — it burns for decades." },
      { at: 0.86, label: "Looking back", text: "In our sky it rose to magnitude 6 by 1948, and 80 years later it is still fading." },
    ],
    build: novaScene({
      donor: { r: 3.4, at: 12, colour: "#ff5a2a", hot: "#ff9050" },
      wind: true,
      discR: 2.6,
      eruptions: [0.34],
      slow: true,
      shell: { R: 26, colours: ["#ff8aa0", "#ffd0dc", "#a8e0ff"] },
      view: 30,
      labels: { donor: ["Pulsating red giant", "it swells and shrinks every 387 days"], wd: ["White dwarf", "about 140,000 °C"], shell: ["Burning for decades", ""] },
      years: [[0, ["1930s", "a Mira star, magnitude 9–16"]], [0.34, ["1944", "it begins"]], [0.46, ["1948", "magnitude 6 — the peak"]], [0.62, ["1977", "still magnitude 10"]], [0.8, ["2013", "magnitude 12 — still going"]]],
      titles: [
        [0, ["A red giant and a white dwarf", "a symbiotic star"]],
        [0.34, ["A very slow nova", "it brightens over four years"]],
        [0.6, ["Decades at its peak", "fading only slowly"]],
      ],
      /* Simplified from the AAVSO record (Heck & Manfroid 1985; the
       * Wikipedia summary of the magnitudes above). */
      chart: {
        title: "Brightness from Earth, 1930–2020",
        ticks: [[0, "1930"], [0.155, "1944"], [0.5, "1975"], [1, "2020"]],
        yTicks: [[0.92, "mag 6"], [0.1, "mag 14"]],
        /* mag 13 before (y = 0.92 − (m − 6) × 0.1025); 7 by 1946, 6 in
         * 1948, fading from 1949; 10 in 1977; 12 in 2013. */
        fn: curveThrough([[0, 0.2], [0.155, 0.2], [0.18, 0.82], [0.2, 0.92], [0.21, 0.92], [0.52, 0.51], [0.92, 0.305], [1, 0.3]]),
        colour: "#ffb0c0",
        from: 0.25,
        to: 0.85,
      },
    }),
    end: newStar(0.5, "#ffe8ee", ["RR Telescopii", "about magnitude 12 today — a telescope star again"], ["1944 to now", "the slowest nova on record"], { size: 0.02, rise: 2 }),
  }),
});

/* ------------------------------------------------------------ Type Ia */

export const TYPE_IA = event({
  id: "type-ia-supernova",
  section: "deep",
  title: "A Type Ia supernova: Tycho's star, 1572",
  place: "SN 1572 · Cassiopeia · about 8,000 light-years",
  kind: "recorded",
  family: "stellar",
  when: "11 November 1572 (seen by Tycho Brahe)",
  often: "about one every 300 years in a galaxy like ours",
  timeline: { last: "November 1572" },
  detail: "A white dwarf fed past 1.4 times the Sun's mass blew itself apart completely — a new star in Cassiopeia as bright as Venus",
  frequency: "Type Ia supernovae happen about once every few centuries in a galaxy like ours. The last two seen in the Milky Way were Tycho's (1572) and, probably, Kepler's (1604)",
  cause: "A white dwarf in a pair keeps gaining mass — from a companion's gas, or by merging with another white dwarf. Near 1.4 Suns (the Chandrasekhar limit) its carbon ignites everywhere at once, and in a second the whole star is turned into new elements — much of it iron, by way of radioactive nickel — and flung out. Nothing is left behind.",
  note: "Tycho Brahe saw it on 11 November 1572; it was about magnitude −4, visible by day for two weeks and to the eye until March 1574. His careful measurements showed it did not move against the stars, so it was far beyond the Moon — the heavens could change. In 2008 astronomers caught its light echoing off distant dust and took its spectrum: a Type Ia (Krause et al., Nature).",
  accuracy: "Its place in the sky and the galaxy are real (estimates 8,000–9,800 light-years). The white dwarf, its companion and the disc are drawn, not to scale; the remnant today is about 20 light-years across.",
  art: { main: "whitedwarf", fx: "burst" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Tycho's supernova remnant (3C 10): RA 00h 25m 18s, Dec +64° 08′ 37″;
     * distance about 2.5–3 kpc (≈ 8,000–9,800 light-years). */
    target: { name: "Tycho's supernova (SN 1572)", short: "Tycho's star", ra: H(0, 25, 18), dec: D(64, 8, 37), ly: 8000, lyText: "about 8,000 light-years", where: "in Cassiopeia" },
    tells: [
      { at: 0, label: "11 November 1572", text: "Tycho Brahe sees a new star in Cassiopeia, brighter than Jupiter." },
      { at: 0.07, label: "8,000 light-years", text: "We travel to it." },
      { at: 0.27, label: "A white dwarf, overfed", text: "A white dwarf takes gas from its companion and creeps toward 1.4 Suns — the most it can bear." },
      { at: 0.42, label: "Detonation", text: "Its carbon ignites everywhere at once: in a second the whole star is destroyed." },
      { at: 0.62, label: "Nothing left", text: "No neutron star, no black hole — only an expanding cloud, rich in iron." },
      { at: 0.86, label: "Looking back", text: "In our sky: as bright as Venus, by day for two weeks, visible for 16 months." },
    ],
    build: supernovaScene({
      kind: "ia",
      star: { r: 2 },
      remR: 56,
      burstColours: ["#ffffff", "#fff2c8", "#ffd27f", "#bcd8ff"],
      /* The remnant: a near-round shell, X-ray hot (iron, silicon), as
       * Chandra shows it. */
      remnant: { count: 5000, filament: ["#ff9a5a", "#ffd27f", "#8fd0ff", "#ff6a6a"], haze: "#6a8aff", hazeShare: 0.25, stretch: [1, 1, 1] },
      q: { collapse: 0.2, blast: 0.24, remnant: 0.55, photo: 0.74 },
      /* Round 91: the remnant today, rebuilt in 3D from the owner's
       * picture of it (Chandra X-ray, with optical stars): a ball of hot
       * gas, the knots of ejecta through it, a thin blue rim where the
       * blast wave runs into space. */
      photo: { file: "tycho-sn1572.jpg", width: 130, mode: "ball", step: 4, threshold: 0.06, floor: 0.07, depth: 0.85, keep: 0.98, gain: 0.38, sizeK: 2.9 },
      labels: { star: ["White dwarf", "1.3 → 1.4 Suns"], companion: ["Its companion", "giving up gas"], remnant: ["Tycho's remnant today", "about 20 light-years across"] },
      titles: [
        [0, ["A white dwarf and its companion", "in Cassiopeia, 8,000 years before 1572"]],
        [0.24, ["A Type Ia supernova", "the white dwarf is destroyed"]],
        [0.55, ["Four and a half centuries later", "the cloud, still racing out at 5,000 km/s"]],
        [0.74, ["Tycho's remnant today", "about 20 light-years across"]],
      ],
      /* As Tycho recorded it: about −4 in November 1572, fading to the
       * limit of the eye by March 1574 (Baade 1945's light curve). */
      chart: {
        title: "As seen from Earth, 1572–74",
        ticks: [[0, "Nov 1572"], [0.5, "1573"], [1, "Mar 1574"]],
        yTicks: [[0.95, "like Venus"], [0.1, "gone"]],
        fn: curveThrough([[0, 0.9], [0.03, 0.95], [0.15, 0.75], [0.4, 0.5], [0.75, 0.25], [1, 0.08]]),
        colour: "#fff2c8",
        from: 0.28,
        to: 0.9,
      },
    }),
    end: newStar(1, "#fffbe8", ["Tycho's 'new star'", "as bright as Venus — November 1572"], ["November 1572, from Earth", "a new star in Cassiopeia"], { size: 0.05 }),
  }),
});

/* ------------------------------------------------------------ core collapse */

/*
 * The round-1 "supernova" event (solarSystemEvents.js, a Type II-P
 * diorama) is redesigned as this voyage: solarSystemEvents.js now builds
 * its "supernova" entry from CORE_COLLAPSE_SCENE.
 */
export const CORE_COLLAPSE_SCENE = (ctx) => voyage(ctx, {
  /* Cassiopeia A: RA 23h 23m 24s, Dec +58° 48′ 54″; 3.4 kpc = 11,000
   * light-years (Reed et al. 1995). */
  target: { name: "Cassiopeia A", short: "Cassiopeia A", ra: H(23, 23, 24), dec: D(58, 48, 54), ly: 11000, where: "in Cassiopeia" },
  tells: [
    { at: 0, label: "About 1670", text: "The light of a supernova reached Earth around 1670 — and almost nobody noticed: dust dimmed it." },
    { at: 0.07, label: "11,000 light-years", text: "We travel to Cassiopeia A." },
    { at: 0.27, label: "A giant runs out of fuel", text: "A star of about 15–20 Suns has burned its core all the way to iron, which cannot burn." },
    { at: 0.4, label: "Collapse", text: "The iron core falls in on itself in under a second — a neutron star — and the star above it rebounds and explodes." },
    { at: 0.62, label: "Cassiopeia A today", text: "A shell 10 light-years across, still flying out at 5,000 km/s, with the neutron star at its heart." },
    { at: 0.86, label: "Looking back", text: "In our sky it should have been bright — but the galaxy's dust hid it. The next one could come any year." },
  ],
  build: supernovaScene({
    kind: "core",
    /* The progenitor: a red supergiant of about 15–20 Suns that had shed
     * most of its hydrogen — Cas A was a Type IIb, from its light echo
     * (Krause et al. 2008, Science). */
    /* Cassiopeia A was a Type IIb: its star had lost most of its hydrogen,
     * a yellow supergiant at the end (like SN 2011dh's; Krause et al. 2008). */
    star: { r: 2.4, kind: "ysg" },
    leftover: "neutron",
    remR: 60,
    remnant: { count: 6000, filament: ["#8fd0ff", "#ffd27f", "#ff6a5a", "#b88aff"], haze: "#5a8aff", hazeShare: 0.22, stretch: [1, 1, 1] },
    q: { collapse: 0.14, blast: 0.24, remnant: 0.44, ns: 0.56, nsEnd: 0.76, photo: 0.8 },
    /* Round 92: it ends on Cassiopeia A as the Webb telescope saw it in
     * 2023 (the owner's picture, NASA/ESA/CSA), rebuilt in 3D: the
     * orange-pink filaments and the grey smoke of the debris on a shell,
     * its middle dark. */
    photo: { file: "cassiopeia-a.jpg", width: 144, mode: "shell", step: 4, threshold: 0.1, floor: 0.08, depth: 0.5, keep: 0.9, gain: 0.7, inner: 0.35, sizeK: 2.2 },
    labels: { star: ["Yellow supergiant", "about 15–20 Suns, stripped"], leftover: ["Neutron star", "found by Chandra, 1999 — hot, quiet, no jets"], remnant: ["Cassiopeia A today", "10 light-years across"] },
    titles: [
      [0, ["A massive star, out of fuel", "a yellow supergiant: most of its hydrogen gone"]],
      [0.08, ["Inside it", "shells of lighter elements round an iron core"]],
      [0.14, ["Its core collapses", "a city-sized neutron star, in under a second"]],
      [0.24, ["A core-collapse supernova", "the star bounces and explodes"]],
      [0.44, ["About 350 years later", "the shell, still flying out at 5,000 km/s"]],
      [0.56, ["The neutron star", "20 km across, inside its own glowing gas"]],
      [0.8, ["Cassiopeia A today", "a shell of debris 10 light-years across"]],
    ],
    /* A Type II light curve, shape only (a rise over about 10 days, a
     * plateau, then the slow radioactive tail). */
    chart: {
      title: "How such a supernova fades (shape)",
      ticks: [[0, "day 0"], [0.3, "100"], [1, "a year"]],
      yTicks: [[0.95, "peak"]],
      fn: curveThrough([[0, 0], [0.03, 0.95], [0.08, 0.85], [0.28, 0.78], [0.36, 0.42], [1, 0.18]]),
      colour: "#ffd2a8",
      from: 0.3,
      to: 0.9,
    },
  }),
  end: newStar(0.35, "#ffe2c8", ["Cassiopeia A, about 1670", "dimmed by dust — barely noticed"], ["About 1670, from Earth", "a supernova almost no one saw"], { size: 0.02 }),
});

/* ------------------------------------------------------------ kilonova */

/* The round-1 "kilonova" event redesigned (solarSystemEvents.js builds
 * its "kilonova" entry from this). */
export const KILONOVA_SCENE = (ctx) => voyage(ctx, {
  /* NGC 4993: RA 13h 09m 47.7s, Dec −23° 23′ 02″; about 40 Mpc = 130
   * million light-years (LIGO/Virgo 2017). */
  target: { name: "GW170817, in NGC 4993", short: "NGC 4993", ra: H(13, 9, 47.7), dec: D(23, 23, 2, true), ly: 130e6, lyText: "130 million light-years", where: "in Hydra" },
  extragalactic: true,
  tells: [
    { at: 0, label: "17 August 2017", text: "LIGO and Virgo feel space shiver for 100 seconds; 1.7 seconds after it ends, a burst of gamma rays." },
    { at: 0.07, label: "130 million light-years", text: "We leave our galaxy for NGC 4993." },
    { at: 0.27, label: "Two neutron stars", text: "Two city-sized dead stars, each heavier than the Sun, spiral together faster and faster." },
    { at: 0.42, label: "Merger", text: "They collide. A jet punches out — the gamma-ray burst — and debris is flung out at a third of the speed of light." },
    { at: 0.6, label: "A kilonova", text: "In the debris, gold, platinum and uranium are made in seconds; it glows blue, then red, for days." },
    { at: 0.86, label: "Looking back", text: "Seventy telescopes watched it. Most of the gold on Earth was made this way." },
  ],
  build: mergerScene({
    kind: "neutron",
    sep: 7,
    q: { merge: 0.4 },
    labels: { a: ["Neutron star", "1.4 Suns, 20 km across"], b: ["Neutron star", ""], after: ["What is left", "a black hole, probably"], debris: ["The kilonova", "gold and platinum forming"], waves: ["Gravitational waves", "felt by LIGO and Virgo"] },
    titles: [
      [0, ["Two neutron stars", "130 million years ago"]],
      [0.3, ["The last seconds", "hundreds of orbits a second"]],
      [0.4, ["They merge", "a gamma-ray burst 1.7 s later"]],
      [0.55, ["The kilonova", "blue for a day, red for a week"]],
    ],
    /* AT2017gfo: blue light peaking in under a day, red/infrared lasting
     * about a week (Kasen et al. 2017); shape only. */
    chart: {
      title: "AT 2017gfo: the glow after the merger (shape)",
      ticks: [[0, "0"], [0.2, "day 2"], [1, "day 10"]],
      yTicks: [[0.95, "blue"], [0.55, "red"]],
      fn: curveThrough([[0, 0], [0.05, 0.95], [0.25, 0.65], [0.5, 0.45], [1, 0.12]]),
      colour: "#bcd8ff",
      from: 0.42,
      to: 0.9,
    },
  }),
  end: newStar(0.3, "#ffd2b0", ["NGC 4993, August 2017", "a dot of light only big telescopes saw"], ["17 August 2017, from Earth", "first seen in gravitational waves"], { size: 0.016 }),
});

/* ------------------------------------------------------------ hypernova */

export const HYPERNOVA = event({
  id: "hypernova",
  section: "deep",
  title: "A hypernova: SN 1998bw",
  place: "SN 1998bw · ESO 184-G82 · about 120 million light-years",
  kind: "recorded",
  family: "deepSky",
  when: "25 April 1998 (GRB 980425)",
  often: "about 1 in 100 core-collapse supernovae",
  timeline: { last: "25 April 1998" },
  detail: "A huge, fast-spinning star collapsed into a black hole and exploded with about ten times the energy of an ordinary supernova — the first one tied to a gamma-ray burst",
  frequency: "Hypernovae — broad-lined Type Ic supernovae — are about 1 in 100 core-collapse supernovae, and only some come with a gamma-ray burst",
  cause: "A very massive star that has lost its outer layers and spins fast collapses at the end. Its core becomes a black hole; gas spinning round it launches two jets at nearly the speed of light, and the star is torn apart with ten or more times the usual energy. Not the same as a 'superluminous' supernova, which is about brightness, not energy — SN 2006gy, for one.",
  note: "On 25 April 1998 BeppoSAX caught gamma-ray burst GRB 980425; a supernova, SN 1998bw, was found in the same spot in a spiral galaxy about 120 million light-years away — the first link between gamma-ray bursts and supernovae (Galama et al. 1998, Nature).",
  accuracy: "Its direction is real; its distance is from its redshift (z = 0.0085). The star, the jets, the black hole and the debris are drawn, not to scale.",
  art: { main: "blackhole", fx: "beam" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* SN 1998bw: RA 19h 35m 03.3s, Dec −52° 50′ 46″; z = 0.0085 ≈ 37 Mpc
     * ≈ 120 million light-years. */
    target: { name: "SN 1998bw (GRB 980425)", short: "SN 1998bw", ra: H(19, 35, 3.3), dec: D(52, 50, 46, true), ly: 120e6, lyText: "about 120 million light-years", where: "in Telescopium" },
    extragalactic: true,
    tells: [
      { at: 0, label: "25 April 1998", text: "A satellite catches a burst of gamma rays; a supernova is found in the same spot." },
      { at: 0.07, label: "120 million light-years", text: "We leave our galaxy for the spiral galaxy ESO 184-G82." },
      { at: 0.27, label: "A giant, spinning fast", text: "A star stripped of its outer layers, spinning fast, runs out of fuel." },
      { at: 0.42, label: "A black hole and two jets", text: "Its core collapses straight into a black hole; jets drill out of the star at nearly the speed of light." },
      { at: 0.6, label: "A hypernova", text: "The star is blown apart with ten times the energy of an ordinary supernova." },
      { at: 0.86, label: "Looking back", text: "The first time a gamma-ray burst was matched with an exploding star." },
    ],
    build: supernovaScene({
      kind: "hyper",
      /* A Wolf-Rayet star: stripped, blue-white, in its own dense wind. */
      star: { r: 1.8, kind: "wr" },
      leftover: "blackhole",
      remR: 58,
      burstColours: ["#ffffff", "#cfe2ff", "#ffd27f", "#ff9a5a"],
      remnant: { count: 4000, filament: ["#bcd8ff", "#ffd27f", "#ff8a6a"], haze: "#6a8aff", hazeShare: 0.3 },
      q: { collapse: 0.16, blast: 0.24, remnant: 0.6, photo: 2 },
      labels: { star: ["Wolf–Rayet star", "stripped, spinning fast"], leftover: ["A black hole", "born in the collapse"], remnant: ["The debris", "at up to 30,000 km/s"] },
      titles: [
        [0, ["A massive star, stripped and spinning", "in a galaxy 120 million light-years away"]],
        [0.16, ["Collapse to a black hole", ""]],
        [0.24, ["Two jets break out", "a gamma-ray burst — and a hypernova"]],
        [0.6, ["Ten times a supernova's energy", "a 'broad-lined' Type Ic"]],
      ],
      chart: {
        title: "Energy of the blast (×10⁴⁴ joules)",
        ticks: [[0.2, "supernova"], [0.75, "hypernova"]],
        yTicks: [[0.1, "1"], [0.95, "~30"]],
        fn: (u) => (u < 0.4 ? (u > 0.1 ? 0.1 : 0) : u > 0.6 ? 0.95 : 0),
        colour: "#bcd8ff",
        from: 0.3,
        to: 0.7,
      },
    }),
    end: newStar(0.3, "#e0ecff", ["SN 1998bw", "seen only by telescopes — magnitude 14"], ["25 April 1998, from Earth", "a gamma-ray flash, then a supernova"], { size: 0.016 }),
  }),
});

/* ------------------------------------------------------------ red nova */

export const RED_NOVA = event({
  id: "luminous-red-nova",
  section: "deep",
  title: "A luminous red nova: V838 Monocerotis",
  place: "V838 Monocerotis · Monoceros · about 19,000 light-years",
  kind: "recorded",
  family: "stellar",
  when: "January–March 2002",
  often: "a few a decade, across nearby galaxies",
  timeline: { last: "February 2002" },
  detail: "Two stars collided and merged — the new star swelled for a while into one of the biggest in the galaxy, and its flash lit up the dust around it in an echo",
  frequency: "Luminous red novae are found a few times a decade in our galaxy and its neighbours; V1309 Scorpii (2008) was caught before, during and after its merger",
  cause: "Two ordinary stars in a tight pair spiral together as one loses gas and the orbit shrinks. When they touch, they merge in an outburst that throws off gas, which cools quickly, so the light turns red. The merged star puffs up into a cool giant.",
  note: "V838 Mon brightened in January 2002, flared to about a million times the Sun's light in February, then turned deep red. Its flash travelled outward through dust shed long before, lighting it up shell by shell: the Hubble images of this light echo (2002–2006) are among its most famous. That the outburst was a merger is the leading explanation (Tylenda & Soker 2006).",
  accuracy: "Its place and distance are real (about 5.9 kpc, Sparks et al. 2008). The stars are drawn, not to scale; the echo is shown as shells of dust lit in turn.",
  art: { main: "redgiant", second: "star", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* V838 Mon: RA 07h 04m 04.8s, Dec −03° 50′ 51″; 5.9 kpc = 19,000 ly. */
    target: { name: "V838 Monocerotis", short: "V838 Mon", ra: H(7, 4, 4.8), dec: D(3, 50, 51, true), ly: 19000, where: "in Monoceros" },
    tells: [
      { at: 0, label: "January 2002", text: "A faint star in Monoceros suddenly brightens — and keeps changing for months." },
      { at: 0.07, label: "19,000 light-years", text: "We travel to it." },
      { at: 0.27, label: "Two stars", text: "Two stars in a tight pair spiral closer and closer." },
      { at: 0.42, label: "They merge", text: "They collide and merge, flaring to a million times the Sun's light." },
      { at: 0.6, label: "A red giant, and an echo", text: "The merged star swells and turns red; its flash lights up old dust, shell by shell." },
      { at: 0.86, label: "Looking back", text: "Hubble watched the echo grow for years." },
    ],
    build: mergerScene({
      kind: "stars",
      sep: 5,
      rA: 1.0,
      rB: 0.6,
      giantR: 7,
      echo: 40,
      /* Round 91: the dust round it, rebuilt in 3D from the owner's
       * Hubble picture (2002–2004), lit as the flash reaches it. */
      echoPhoto: { file: "v838-monocerotis.jpg", width: 110, mode: "shell", step: 4, threshold: 0.08, floor: 0.06, depth: 0.55, keep: 1.0, gain: 0.38, sizeK: 2.2, hole: 0.05 },
      afterView: 150,
      q: { merge: 0.36 },
      labels: { a: ["A star", "several Suns"], b: ["A smaller star", ""], after: ["The merged star", "swollen, cool and red"], echo: ["The light echo", "old dust, lit by the flash"] },
      titles: [
        [0, ["Two stars, close together", "19,000 light-years from Earth"]],
        [0.36, ["They merge", "a luminous red nova"]],
        [0.55, ["A light echo", "the flash reaching shells of old dust"]],
      ],
      /* V838 Mon in 2002, simplified (Munari et al. 2002): three peaks
       * January–March, then a fall as it turned red. */
      chart: {
        title: "V838 Mon, January–April 2002",
        ticks: [[0, "Jan"], [0.33, "Feb"], [0.66, "Mar"], [1, "Apr"]],
        yTicks: [[0.95, "×1 million Suns"]],
        fn: curveThrough([[0, 0.05], [0.05, 0.5], [0.2, 0.4], [0.35, 0.95], [0.5, 0.7], [0.62, 0.8], [0.8, 0.25], [1, 0.1]]),
        colour: "#ff9a7a",
        from: 0.36,
        to: 0.75,
      },
    }),
    end: newStar(0.5, "#ffb08a", ["V838 Monocerotis, 2002", "flared, then turned red"], ["February 2002, from Earth", "a star that changed colour"], { size: 0.022 }),
  }),
});

export const NOVA_EVENTS = [WHAT_IS_A_NOVA, CLASSICAL_NOVA, RECURRENT_NOVA, MICRONOVA, SYMBIOTIC_NOVA, TYPE_IA, HYPERNOVA, RED_NOVA];

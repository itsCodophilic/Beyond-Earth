/**
 * Space Dictionary: the board's words, in plain language, each with a small
 * moving picture.
 *
 * "Plutinos", "Centaurs", "scattered disc", "binaries & triples" -- the
 * board is arranged by the names astronomers use, and those names were
 * reported as jargon. Each one has a short definition and an animated
 * diagram of the thing it names: a "?" beside every region title opens that
 * region's, and "Space Dictionary" in the board's header opens all of them,
 * centred, searchable and grouped into bunches -- distance and light, the
 * neighbourhood, small worlds, pairs and rings, how things move, and why
 * surfaces look the way they do. (It was "Words, explained", then "Space
 * Decoded"; named Space Dictionary on request.)
 *
 * The pictures are SVG with SMIL animation, built only when shown and
 * removed when closed, so the board costs nothing extra while nobody is
 * reading them. Anything that moves on an orbit is moved on a Kepler track
 * -- positions at equal steps of *time*, solved from the mean anomaly -- so
 * a comet visibly whips round the Sun and crawls at the far end, the way
 * the real ones do, and Pluto's three-to-two beat against Neptune is the
 * real ratio. Sizes and distances inside a picture are schematic.
 *
 * Text in the decoder answers the pointer the way the planet dossier's does
 * (planetDetailsPanel.js): letters near it lift, turn and glow, and a soft
 * wave runs outward through them as it moves -- the same radii (46 and
 * 78 px), the same multipliers, once per animation frame.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/* ------------------------------------------------------------- the words */

/*
 * The groups ("bunches"), each with its own hue for its cards and mark.
 */
export const GLOSSARY_GROUPS = Object.freeze([
  { key: "light", title: "Distance & light", blurb: "How far things are, and how long their light takes to reach us", hue: 38 },
  { key: "places", title: "Our neighbourhood", blurb: "The regions of the Solar System, from the Sun outward", hue: 192 },
  { key: "worlds", title: "Small worlds", blurb: "Everything out here that is not a planet", hue: 14 },
  { key: "pairs", title: "Pairs, moons & rings", blurb: "Bodies that go round each other, and what circles them", hue: 276 },
  { key: "motion", title: "How things move", blurb: "Orbits, their shapes and their rhythms", hue: 150 },
  { key: "surfaces", title: "Why they look that way", blurb: "Brightness and colour", hue: 350 },
]);

/*
 * The definitions. Numbers in them, with where they come from:
 *  - AU: 149,597,870.7 km (IAU 2012 Resolution B2); light takes 499.0 s,
 *    8 min 19 s. Neptune's 30.07 AU is 15,004 s of light, 4 h 10 min.
 *  - Speed of light: 299,792.458 km/s exactly (SI definition); Earth's
 *    equatorial circumference 40,075 km, so 7.5 laps a second.
 *  - Light-year: 9.4607e12 km = 63,241 AU (IAU, Julian year).
 *  - Parsec: 3.2616 light-years = 206,265 AU (IAU 2015 Resolution B2).
 *    Proxima Centauri: 4.24 light-years, 1.30 pc.
 *  - Heliopause: Voyager 1 crossed at 121.6 AU (2012), Voyager 2 at 119 AU
 *    (2018).
 *  - Near-Earth asteroid: perihelion under 1.3 AU (the CNEOS definition).
 *  - Plutinos: in 3:2 mean-motion resonance with Neptune -- two orbits for
 *    Neptune's three.
 *  - Classical belt edge: about 47.7 AU, as the board's own region says;
 *    cold classicals' high binary fraction: about 30 per cent (Noll et al.
 *    2008, "Binaries in the Kuiper Belt").
 *  - Oort Cloud: out to about 100,000 AU (the board's region); Proxima
 *    Centauri is 268,000 AU away, so "over a third of the way".
 *  - Earth–Moon centre of mass: 4,671 km from Earth's centre, inside a
 *    6,371 km Earth (NASA Moon fact sheet).
 *  - The five IAU dwarf planets: Ceres, Pluto, Haumea, Makemake, Eris.
 *  - Albedo: Earth's Bond albedo 0.306 (NASA Earth fact sheet); fresh snow
 *    about 0.8-0.9; soot and the darkest comet nuclei about 0.04.
 *  - Rubble piles: Bennu and Ryugu (OSIRIS-REx, Hayabusa2). Contact binary:
 *    Arrokoth (New Horizons, 2019).
 */
export const GLOSSARY = Object.freeze([
  // ---- distance & light
  {
    key: "au", group: "light",
    term: "AU",
    also: "astronomical unit",
    plain: "The distance from Earth to the Sun, used as a ruler for the Solar System: about 150 million km. Light takes 8 minutes 19 seconds to cross it. Neptune is 30 AU out.",
  },
  {
    key: "lightspeed", group: "light",
    term: "Speed of light",
    plain: "299,792 km every second, the fastest anything can go. Fast enough to circle Earth seven and a half times in one second, and still slow enough that space makes it wait.",
  },
  {
    key: "lighttime", group: "light",
    term: "Light-time",
    also: "looking back in time",
    plain: "How long light takes to reach us, which means how old the view is. You see the Sun as it was 8 minutes ago and Neptune as it was 4 hours ago. The board's clock counts it out, region by region.",
  },
  {
    key: "lightyear", group: "light",
    term: "Light-year",
    plain: "A distance, not a time: how far light travels in one year, about 9.46 trillion km, or 63,241 AU. The nearest star, Proxima Centauri, is 4.24 light-years away.",
  },
  {
    key: "parsec", group: "light",
    term: "Parsec",
    plain: "3.26 light-years. As Earth goes round the Sun, a star this far away seems to shift against the far background by one second of arc (a 3,600th of a degree). That tiny shift is how star distances were first measured.",
  },
  // ---- the neighbourhood
  {
    key: "inner", group: "places",
    term: "Inner planets",
    plain: "The four small rocky planets nearest the Sun: Mercury, Venus, Earth and Mars. Solid ground, thin air or none, and hardly any moons.",
  },
  {
    key: "belt", group: "places",
    term: "Main asteroid belt",
    plain: "A wide ring of rocky leftovers between Mars and Jupiter. Millions of rocks, spread so thinly that spacecraft cross it without dodging. Jupiter's pull kept them from ever gathering into a planet.",
  },
  {
    key: "giants", group: "places",
    term: "Giant planets",
    plain: "Jupiter, Saturn, Uranus and Neptune: huge worlds of gas and ice with no solid surface to stand on, each with rings and dozens of moons.",
  },
  {
    key: "kuiper", group: "places",
    term: "Kuiper Belt",
    plain: "A thick ring of icy worlds beyond Neptune, from about 30 to 50 AU. Like the asteroid belt, but far wider and made mostly of ice. The board splits it into Plutinos and the classical belt.",
  },
  {
    key: "plutinos", group: "places",
    term: "Plutinos",
    plain: "Worlds that go round the Sun twice for every three laps of Neptune, in step with Pluto (hence the name). The rhythm means Neptune is never nearby when they cross its path, so they are never thrown out.",
  },
  {
    key: "classical", group: "places",
    term: "Classical Kuiper Belt",
    plain: "The belt's main crowd, 42 to 48 AU out, on calm, nearly round orbits that Neptune never stirred. So undisturbed that about three in ten of its coldest members are still pairs from the day they formed.",
  },
  {
    key: "scattered", group: "places",
    term: "Scattered disc",
    plain: "Bodies that Neptune kicked long ago onto long, stretched, tilted orbits. They swing in to about Neptune's distance and out to hundreds of AU.",
  },
  {
    key: "heliosphere", group: "places",
    term: "Heliosphere",
    also: "the Sun's bubble",
    plain: "The bubble blown by the solar wind, the stream of particles the Sun gives off. Its edge, the heliopause, is where the wind meets the gas between the stars: about 120 AU out, where both Voyagers crossed it.",
  },
  {
    key: "detached", group: "places",
    term: "Detached & inner Oort",
    plain: "Worlds whose nearest point to the Sun is too far out for Neptune to touch. Something else lifted them there: a passing star, perhaps, or a planet not yet found. Sedna is the best known.",
  },
  {
    key: "oort", group: "places",
    term: "Oort Cloud",
    plain: "A huge, thin shell of icy comet cores thought to surround the whole Solar System, out to about 100,000 AU, over a third of the way to the next star. Never seen directly: we know it from the comets that fall in from it.",
  },
  // ---- small worlds
  {
    key: "asteroid", group: "worlds",
    term: "Asteroid",
    plain: "A lump of rock or metal left over from when the planets formed. Too small to pull itself round, so most are potato-shaped. From a few metres to a few hundred kilometres across.",
  },
  {
    key: "nea", group: "worlds",
    term: "Near-Earth asteroid",
    plain: "An asteroid whose orbit brings it within 1.3 AU of the Sun, close to Earth's own path. These are the ones watched most carefully.",
  },
  {
    key: "centaur", group: "worlds",
    term: "Centaur",
    plain: "An icy body that has drifted in from beyond Neptune and now loops between the giant planets. Part asteroid, part comet, like the half-horse of the myth. A giant planet will fling it away within a few million years.",
  },
  {
    key: "comet", group: "worlds",
    term: "Comet",
    plain: "A dirty snowball. Far out it is a dark frozen lump; near the Sun its ice turns to gas and streams off in a glowing tail that always points away from the Sun.",
  },
  {
    key: "tno", group: "worlds",
    term: "Trans-Neptunian",
    plain: "Anything whose orbit lies, on average, beyond Neptune's: more than 30 AU from the Sun. Pluto is the famous one; thousands more are known.",
  },
  {
    key: "dwarf", group: "worlds",
    term: "Dwarf planet",
    plain: "Big enough that its own gravity has pulled it round, but not big enough to clear its path of other bodies, so it shares its orbit with a crowd. The official five are Ceres, Pluto, Haumea, Makemake and Eris.",
  },
  {
    key: "rubble", group: "worlds",
    term: "Rubble pile",
    plain: "Not one solid rock but a loose heap of boulders and gravel, held together only by its own weak gravity. Bennu and Ryugu, both sampled by spacecraft, are rubble piles; Altjira may be one too.",
  },
  {
    key: "contact", group: "worlds",
    term: "Contact binary",
    plain: "Two bodies that drifted together so gently they stuck, touching at a narrow neck. Arrokoth, seen by New Horizons, is one; Manwë here is another.",
  },
  // ---- pairs, moons & rings
  {
    key: "binary", group: "pairs",
    term: "Binaries & triples",
    plain: "Two bodies of similar weight going round each other. The point they both circle lies in open space between them, not inside either one, so neither is the other's moon. A triple has a third body circling the pair.",
  },
  {
    key: "planet-moon", group: "pairs",
    term: "Planet and moon",
    plain: "A heavy body and a much lighter one. The point they circle sits inside the heavy one (for Earth and the Moon, 4,671 km from Earth's centre, under the ground), so the planet only wobbles and the moon does the going round.",
  },
  {
    key: "tidallock", group: "pairs",
    term: "Tidal locking",
    plain: "A moon that spins exactly once per orbit, so it always shows the same face. Our Moon does it; Sila and Nunam do it to each other, each keeping one face turned to the other.",
  },
  {
    key: "rings", group: "pairs",
    term: "Rings",
    plain: "Countless pieces of ice and rock circling in one thin, flat band. Not only the giant planets have them: so do small worlds like Chariklo, Haumea and Quaoar.",
  },
  // ---- how things move
  {
    key: "orbit", group: "motion",
    term: "Orbit",
    plain: "Falling, and always missing. A moon or a planet is falling towards what it circles the whole time, but moving sideways so fast that the ground curves away beneath it.",
  },
  {
    key: "eccentricity", group: "motion",
    term: "Eccentricity",
    plain: "How stretched an orbit is. 0 is a perfect circle; close to 1 is long and thin, like a comet's. The more stretched, the more a body speeds up close in and dawdles far out.",
  },
  {
    key: "retrograde", group: "motion",
    term: "Retrograde",
    plain: "Going round backwards: against the direction almost everything else in the Solar System turns. Many small, captured moons do; the board marks them with ↺.",
  },
  {
    key: "resonance", group: "motion",
    term: "Resonance",
    plain: "Two orbits whose times fit a simple ratio, like 2 to 1 or 3 to 2. The regular tugs add up, and can either protect an orbit (the Plutinos) or clear one out (the gaps in the asteroid belt).",
  },
  // ---- why they look that way
  {
    key: "albedo", group: "surfaces",
    term: "Albedo",
    plain: "How much of the light that falls on a surface it throws back. Soot reflects about 4 per cent, Earth about 30, fresh snow about 80. Most worlds past Neptune are darker than you would think.",
  },
  {
    key: "tholins", group: "surfaces",
    term: "Tholins",
    also: "why far worlds are red",
    plain: "Reddish-brown gunk made when sunlight and cosmic rays break up simple ices like methane over millions of years. It is why Pluto's darker regions and most of the far worlds on this board are red.",
  },
]);

const BY_KEY = new Map(GLOSSARY.map((entry) => [entry.key, entry]));
export function glossaryEntry(key) {
  return BY_KEY.get(key) ?? null;
}

/* Which word explains each board region. */
export const REGION_WORD = Object.freeze({
  inner: "inner",
  belt: "belt",
  giants: "giants",
  plutinos: "plutinos",
  classical: "classical",
  scattered: "scattered",
  detached: "detached",
  oort: "oort",
});

/* ------------------------------------------------------------- the art */

const f = (n) => (Math.round(n * 100) / 100).toString();

/* Kepler's equation, a few Newton steps: enough for e up to 0.995 here. */
function eccentricAnomaly(M, e) {
  let E = e > 0.8 ? Math.PI : M;
  for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/*
 * Positions round an ellipse at equal steps of time: the Sun at (sx, sy),
 * semi-major axis a, eccentricity e, the pericentre pointing `peri` degrees
 * (SVG angles, clockwise from +x), `laps` orbits in the track, `phase` as a
 * fraction of an orbit. Also the distance from the Sun at each step, for
 * a comet's tail.
 */
function keplerTrack({ sx = 0, sy = 0, a, e, peri = 0, steps = 72, laps = 1, phase = 0, sense = 1 }) {
  const points = [];
  const cp = Math.cos((peri * Math.PI) / 180);
  const sp = Math.sin((peri * Math.PI) / 180);
  const b = a * Math.sqrt(1 - e * e);
  for (let i = 0; i <= steps; i += 1) {
    const M = ((i / steps) * laps + phase) * Math.PI * 2;
    const E = eccentricAnomaly(M % (Math.PI * 2), e);
    const x = a * (Math.cos(E) - e);
    const y = -sense * b * Math.sin(E);
    points.push({
      x: sx + x * cp - y * sp,
      y: sy + x * sp + y * cp,
      r: Math.hypot(x, y),
    });
  }
  return points;
}

function ellipsePath({ sx = 0, sy = 0, a, e, peri = 0 }) {
  const b = a * Math.sqrt(1 - e * e);
  const cx = sx + -a * e * Math.cos((peri * Math.PI) / 180);
  const cy = sy + -a * e * Math.sin((peri * Math.PI) / 180);
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(a)}" ry="${f(b)}" transform="rotate(${f(peri)} ${f(cx)} ${f(cy)})" class="cgloss__path" />`;
}

/* A body carried round a Kepler track. */
function mover(track, dur, inner) {
  const values = track.map((p) => `${f(p.x)} ${f(p.y)}`).join(";");
  return `<g><animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" repeatCount="indefinite" />${inner}</g>`;
}

/* A comet: head on the track, tail pointing straight away from the Sun and
 * longest near it. */
function comet(track, dur, sun, { tail = 16, head = 1.5 } = {}) {
  const values = track.map((p) => `${f(p.x)} ${f(p.y)}`).join(";");
  const angles = track.map((p) => f((Math.atan2(p.y - sun.y, p.x - sun.x) * 180) / Math.PI)).join(";");
  const rMin = Math.min(...track.map((p) => p.r));
  const lengths = track.map((p) => f(tail * Math.min(1, (rMin / Math.max(p.r, rMin)) ** 1.2) + 1)).join(";");
  return `<g><animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" repeatCount="indefinite" />`
    + `<g><animateTransform attributeName="transform" type="rotate" values="${angles}" dur="${dur}s" repeatCount="indefinite" />`
    + `<line x1="0" y1="0" x2="${tail}" y2="0" class="cgloss__tail"><animate attributeName="x2" values="${lengths}" dur="${dur}s" repeatCount="indefinite" /></line></g>`
    + `<circle r="${head}" class="cgloss__ice" /></g>`;
}

/* Turning about a point, at a steady rate. */
function spin(dur, inner, { cx = 0, cy = 0, reverse = false } = {}) {
  const to = reverse ? -360 : 360;
  return `<g><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="${to} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite" />${inner}</g>`;
}

function sun(r = 3.2, x = 0, y = 0) {
  return `<circle cx="${x}" cy="${y}" r="${r * 2.4}" class="cgloss__glow" /><circle cx="${x}" cy="${y}" r="${r}" class="cgloss__sun" />`;
}

function ring(r, cls = "cgloss__path") {
  return `<circle r="${f(r)}" class="${cls}" />`;
}

/* Deterministic scatter, so a picture is the same every time it opens. */
function scatter(count, seed, place) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: count }, (_, i) => place(rand, i)).join("");
}

function pair({ r1 = 5, r2 = 4.4, sep = 20, q = (4.4 / 5) ** 3, dur = 6, cls1 = "cgloss__rock", cls2 = "cgloss__rock is-b", cx = 0, cy = 0 } = {}) {
  const d1 = (sep * q) / (1 + q);
  const d2 = sep / (1 + q);
  return `<circle cx="${cx}" cy="${cy}" r="${f(d1)}" class="cgloss__path is-lit" /><circle cx="${cx}" cy="${cy}" r="${f(d2)}" class="cgloss__path is-lit" />`
    + spin(dur, `<circle cx="${f(cx - d1)}" cy="${cy}" r="${r1}" class="${cls1}" /><circle cx="${f(cx + d2)}" cy="${cy}" r="${r2}" class="${cls2}" />`, { cx, cy })
    + `<circle cx="${cx}" cy="${cy}" r="1.1" class="cgloss__centre" />`;
}

const ART = {
  au() {
    return sun(5, -44, 4)
      + `<circle cx="42" cy="4" r="2.6" class="cgloss__earth" />`
      + `<line x1="-36" y1="4" x2="38" y2="4" class="cgloss__path" />`
      + `<circle r="1.3" class="cgloss__light"><animateMotion path="M -38 4 L 39 4" dur="4.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.9;1" dur="4.2s" repeatCount="indefinite" /></circle>`
      + `<text x="0" y="-8" class="cgloss__text">1 AU · 150 million km</text>`
      + `<text x="0" y="18" class="cgloss__text is-soft">light: 8 min 19 s</text>`;
  },
  inner() {
    const planets = [[9, 1.3, 2.4, "cgloss__rock"], [14, 2, 6.1, "cgloss__venus"], [20, 2.1, 10, "cgloss__earth"], [27, 1.6, 18.8, "cgloss__mars"]];
    return sun(3.4)
      + planets.map(([r]) => ring(r)).join("")
      + planets.map(([r, size, dur, cls], i) => spin(dur, `<circle cx="${r}" cy="0" r="${size}" class="${cls}" />`, { }).replace("from=\"0", `from="${i * 80}`).replace(`to="360`, `to="${i * 80 + 360}`)).join("");
  },
  belt() {
    const rocks = scatter(70, 11, (rand) => {
      const angle = rand() * Math.PI * 2;
      const r = 19 + rand() * 9;
      return `<circle cx="${f(Math.cos(angle) * r)}" cy="${f(Math.sin(angle) * r)}" r="${f(0.35 + rand() * 0.55)}" class="cgloss__grain" />`;
    });
    return sun(2.8) + ring(13) + ring(34)
      + spin(9, `<circle cx="13" cy="0" r="1.5" class="cgloss__mars" />`)
      + spin(44, rocks)
      + spin(70, `<circle cx="-34" cy="0" r="3.6" class="cgloss__jupiter" />`);
  },
  asteroid() {
    return spin(14, `<path d="M -14 -3 C -13 -11 -3 -13 4 -11 C 12 -9 17 -4 16 3 C 15 10 7 13 -1 12 C -9 11 -15 5 -14 -3 Z" class="cgloss__rockbig" />`
      + `<circle cx="-5" cy="-3" r="2.4" class="cgloss__crater" /><circle cx="6" cy="4" r="3.1" class="cgloss__crater" /><circle cx="3" cy="-7" r="1.4" class="cgloss__crater" /><circle cx="-6" cy="6" r="1.2" class="cgloss__crater" />`)
      + `<text x="0" y="31" class="cgloss__text is-soft">metres to hundreds of km</text>`;
  },
  nea() {
    const track = keplerTrack({ a: 23, e: 0.42, peri: 200, steps: 90 });
    return sun(3) + ring(20, "cgloss__path is-lit") + ellipsePath({ a: 23, e: 0.42, peri: 200 })
      + spin(8, `<circle cx="20" cy="0" r="1.9" class="cgloss__earth" />`)
      + mover(track, 6.5, `<circle r="1.2" class="cgloss__rock" />`)
      + `<text x="0" y="36" class="cgloss__text is-soft">crosses Earth's path</text>`;
  },
  giants() {
    const planets = [[12, 3.1, 8, "cgloss__jupiter"], [19, 2.7, 13, "cgloss__saturn"], [27, 2, 21, "cgloss__uranus"], [34, 2, 28, "cgloss__neptune"]];
    return sun(2)
      + planets.map(([r]) => ring(r)).join("")
      + planets.map(([r, size, dur, cls], i) => spin(dur, `<circle cx="${r}" cy="0" r="${size}" class="${cls}" />`
        + (cls === "cgloss__saturn" ? `<ellipse cx="${r}" cy="0" rx="${size * 1.9}" ry="${size * 0.6}" class="cgloss__ringline" />` : "")).replace("from=\"0", `from="${i * 95}`).replace(`to="360`, `to="${i * 95 + 360}`)).join("");
  },
  centaur() {
    const track = keplerTrack({ a: 24, e: 0.38, peri: 35, steps: 96 });
    return sun(2) + ring(14) + ring(31)
      + spin(12, `<circle cx="14" cy="0" r="2.6" class="cgloss__saturn" />`)
      + spin(24, `<circle cx="-31" cy="0" r="2.1" class="cgloss__uranus" />`)
      + ellipsePath({ a: 24, e: 0.38, peri: 35 })
      + comet(track, 9, { x: 0, y: 0 }, { tail: 6, head: 1.3 })
      + `<text x="0" y="37" class="cgloss__text is-soft">between the giants</text>`;
  },
  comet() {
    const s = { x: -36, y: 0 };
    const track = keplerTrack({ sx: s.x, sy: s.y, a: 44, e: 0.82, peri: 180, steps: 120 });
    return sun(3.4, s.x, s.y) + ellipsePath({ sx: s.x, sy: s.y, a: 44, e: 0.82, peri: 180 })
      + comet(track, 7, s, { tail: 20, head: 1.7 });
  },
  tno() {
    const dots = scatter(26, 7, (rand, i) => {
      const r = 26 + rand() * 11;
      const dur = (30 + rand() * 30).toFixed(1);
      return spin(dur, `<circle cx="${f(r)}" cy="0" r="${f(0.6 + rand() * 0.8)}" class="cgloss__ice" />`).replace("from=\"0", `from="${f(i * 137.5)}`).replace(`to="360`, `to="${f(i * 137.5 + 360)}`);
    });
    return `<circle r="37" class="cgloss__zone" /><circle r="23" class="cgloss__hole" />` + sun(2.2)
      + ring(20, "cgloss__path is-lit") + spin(14, `<circle cx="20" cy="0" r="2" class="cgloss__neptune" />`) + dots
      + `<text x="0" y="-26" class="cgloss__text is-soft">Neptune</text>`;
  },
  kuiper() {
    const dots = scatter(90, 21, (rand) => {
      const angle = rand() * Math.PI * 2;
      const r = 24 + rand() * 13;
      return `<circle cx="${f(Math.cos(angle) * r)}" cy="${f(Math.sin(angle) * r)}" r="${f(0.35 + rand() * 0.6)}" class="cgloss__ice" />`;
    });
    return sun(2) + ring(18, "cgloss__path is-lit") + spin(12, `<circle cx="18" cy="0" r="1.8" class="cgloss__neptune" />`)
      + spin(60, dots);
  },
  plutinos() {
    /*
     * The 3:2 beat, real: Neptune's period is two-thirds of the plutino's,
     * so over one 18 s loop Neptune laps three times and the plutino twice.
     * a = 1.5^(2/3) = 1.31 Neptune radii; e = 0.25, near Pluto's 0.249.
     * Neptune starts 90 degrees from the plutino's perihelion, which is
     * where the resonance holds it: when the plutino crosses inside
     * Neptune's orbit, Neptune is a quarter of a lap away.
     */
    const aN = 22;
    const neptune = keplerTrack({ a: aN, e: 0, peri: 0, steps: 180, laps: 3, phase: 0.25 });
    const pluto = keplerTrack({ a: aN * 1.31, e: 0.25, peri: 0, steps: 180, laps: 2 });
    return sun(2.2) + ring(aN, "cgloss__path is-lit") + ellipsePath({ a: aN * 1.31, e: 0.25, peri: 0 })
      + mover(neptune, 18, `<circle r="2.4" class="cgloss__neptune" />`)
      + mover(pluto, 18, `<circle r="1.5" class="cgloss__pluto" />`)
      + `<text x="0" y="37" class="cgloss__text is-soft">2 laps for Neptune's 3</text>`;
  },
  classical() {
    const dots = scatter(60, 5, (rand) => {
      const angle = rand() * Math.PI * 2;
      const r = 26 + rand() * 8;
      return `<circle cx="${f(Math.cos(angle) * r)}" cy="${f(Math.sin(angle) * r)}" r="${f(0.4 + rand() * 0.5)}" class="cgloss__ice" />`;
    });
    // One of the crowd is a pair, turning about its own centre.
    const couple = `<g transform="translate(30 0)">${spin(3, `<circle cx="-1.6" cy="0" r="1.2" class="cgloss__pluto" /><circle cx="1.8" cy="0" r="1" class="cgloss__pluto" />`)}</g>`;
    return sun(2) + ring(18) + spin(12, `<circle cx="18" cy="0" r="1.8" class="cgloss__neptune" />`)
      + spin(70, dots + couple);
  },
  scattered() {
    const orbits = [
      { a: 30, e: 0.58, peri: 20, dur: 11, phase: 0.1 },
      { a: 34, e: 0.62, peri: 150, dur: 13, phase: 0.5 },
      { a: 27, e: 0.52, peri: 260, dur: 9.5, phase: 0.75 },
    ];
    return sun(2) + ring(12, "cgloss__path is-lit") + spin(8, `<circle cx="12" cy="0" r="1.7" class="cgloss__neptune" />`)
      + orbits.map((o) => ellipsePath(o) + mover(keplerTrack({ ...o, steps: 96 }), o.dur, `<circle r="1.1" class="cgloss__ice" />`)).join("");
  },
  detached() {
    const s = { x: -32, y: 2 };
    // Perihelion 16, aphelion 88 from the Sun: a = 52, e = 0.69.
    const o = { sx: s.x, sy: s.y, a: 52, e: 0.69, peri: 180 };
    return sun(2.4, s.x, s.y)
      + `<circle cx="${s.x}" cy="${s.y}" r="9" class="cgloss__reach" />`
      + `<circle cx="${s.x}" cy="${s.y}" r="6" class="cgloss__path is-lit" />`
      + ellipsePath(o) + mover(keplerTrack({ ...o, steps: 120 }), 14, `<circle r="1.5" class="cgloss__ice" />`)
      + `<text x="${s.x}" y="${s.y + 17}" class="cgloss__text is-soft">Neptune's reach</text>`;
  },
  oort() {
    const shell = scatter(150, 3, (rand) => {
      const angle = rand() * Math.PI * 2;
      const r = 21 + Math.sqrt(rand()) * 16;
      return `<circle cx="${f(Math.cos(angle) * r)}" cy="${f(Math.sin(angle) * r * 0.9)}" r="${f(0.25 + rand() * 0.45)}" class="cgloss__ice" />`;
    });
    const fall = keplerTrack({ a: 18, e: 0.94, peri: 225, steps: 140 });
    return spin(120, shell) + `<circle r="4.2" class="cgloss__path is-lit" />` + sun(1.4)
      + comet(fall, 10, { x: 0, y: 0 }, { tail: 7, head: 1 });
  },
  dwarf() {
    const bits = scatter(26, 17, (rand) => {
      const angle = (-30 + rand() * 60) * (Math.PI / 180);
      const r = 90 + (rand() - 0.5) * 3;
      return `<circle cx="${f(-90 + Math.cos(angle) * r)}" cy="${f(Math.sin(angle) * r)}" r="${f(0.4 + rand() * 0.6)}" class="cgloss__grain" />`;
    });
    return `<circle cx="-90" cy="0" r="90" class="cgloss__path" />`
      + `<g><animateTransform attributeName="transform" type="rotate" values="-7 -90 0;7 -90 0;-7 -90 0" dur="16s" repeatCount="indefinite" />${bits}</g>`
      + `<circle cx="0" cy="0" r="9" class="cgloss__round" />`
      + `<text x="22" y="30" class="cgloss__text is-soft">round, but not alone</text>`;
  },
  binary() {
    return pair({ r1: 5.2, r2: 4.7, sep: 30, q: (4.7 / 5.2) ** 3, dur: 7 })
      + `<text x="0" y="31" class="cgloss__text is-soft">the centre is in open space</text>`;
  },
  triple() {
    const inner = pair({ r1: 3.6, r2: 3.3, sep: 13, q: (3.3 / 3.6) ** 3, dur: 2.6 });
    return `<circle r="6" class="cgloss__path is-lit" /><circle r="27" class="cgloss__path is-lit" />`
      + spin(12, `<g transform="translate(-6 0)">${inner}</g><circle cx="27" cy="0" r="2.6" class="cgloss__rock is-c" />`)
      + `<circle r="1.1" class="cgloss__centre" />`;
  },
  "planet-moon"() {
    // The planet wobbles round a centre inside itself; the moon goes round.
    return spin(7, `<circle cx="-1.6" cy="0" r="11" class="cgloss__earth-big" /><circle cx="26" cy="0" r="2.4" class="cgloss__rock" />`)
      + `<circle r="26" class="cgloss__path is-lit" />`
      + `<circle r="1.1" class="cgloss__centre" />`
      + `<text x="0" y="36" class="cgloss__text is-soft">the centre is inside the planet</text>`;
  },
  rings() {
    return `<ellipse cx="0" cy="0" rx="26" ry="7.5" class="cgloss__ringband" transform="rotate(-12)" />`
      + `<circle r="10" class="cgloss__round" />`
      + `<path d="M -26 0 A 26 7.5 0 0 0 26 0" class="cgloss__ringband is-front" transform="rotate(-12)" />`
      + `<ellipse cx="0" cy="0" rx="26" ry="7.5" class="cgloss__ringspark" transform="rotate(-12)"><animate attributeName="stroke-dashoffset" from="0" to="-40" dur="6s" repeatCount="indefinite" /></ellipse>`;
  },
  lightspeed() {
    // 299,792 km/s against Earth's 40,075 km: 7.5 laps a second. Drawn at a
    // lap in 0.8 s -- slowed by a factor of six so the eye can follow it.
    return `<circle r="12" class="cgloss__earth-big" /><circle r="16" class="cgloss__path" />`
      + spin(0.8, `<path d="M 16 0 A 16 16 0 0 1 4.1 15.5" class="cgloss__beam" /><circle cx="16" cy="0" r="1.5" class="cgloss__light" />`, { reverse: true })
      + `<text x="0" y="-22" class="cgloss__text">299,792 km every second</text>`
      + `<text x="0" y="30" class="cgloss__text is-soft">7.5 times round Earth, each second</text>`;
  },
  lighttime() {
    const pulse = (delay) => `<circle cx="-46" cy="0" r="4" class="cgloss__pulse"><animate attributeName="r" values="4;112" dur="6s" begin="${delay}s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.8;0" dur="6s" begin="${delay}s" repeatCount="indefinite" /></circle>`;
    return pulse(0) + pulse(2) + pulse(4) + sun(4, -46, 0)
      + `<circle cx="-24" cy="0" r="2.2" class="cgloss__earth" /><circle cx="44" cy="0" r="2.6" class="cgloss__neptune" />`
      + `<text x="-24" y="12" class="cgloss__text">8 min</text><text x="44" y="12" class="cgloss__text">4 hours</text>`
      + `<text x="0" y="-26" class="cgloss__text is-soft">every view is a view of the past</text>`;
  },
  lightyear() {
    const ticks = Array.from({ length: 13 }, (_, i) => {
      const x = -40 + (i * 82) / 12;
      return `<line x1="${f(x)}" y1="${i % 3 ? 2 : 4}" x2="${f(x)}" y2="${i % 3 ? -2 : -4}" class="cgloss__tick" />`;
    }).join("");
    return sun(3.4, -44, 0)
      + `<line x1="-40" y1="0" x2="42" y2="0" class="cgloss__path" />` + ticks
      + `<path d="M 46 -5 L 47.2 -1.2 L 51 0 L 47.2 1.2 L 46 5 L 44.8 1.2 L 41 0 L 44.8 -1.2 Z" class="cgloss__star" />`
      + `<circle r="1.5" class="cgloss__light"><animateMotion path="M -40 0 L 42 0" dur="6s" repeatCount="indefinite" /></circle>`
      + `<text x="0" y="-12" class="cgloss__text">1 light-year · 9.46 trillion km</text>`
      + `<text x="0" y="17" class="cgloss__text is-soft">12 months of light, end to end</text>`;
  },
  parsec() {
    // Earth on its orbit; the sight-line to a near star swings as it goes.
    const earth = keplerTrack({ sx: -34, sy: 0, a: 11, e: 0, steps: 72 });
    const xs = earth.map((p) => f(p.x)).join(";");
    const ys = earth.map((p) => f(p.y)).join(";");
    return sun(2.4, -34, 0) + `<circle cx="-34" cy="0" r="11" class="cgloss__path" />`
      + `<line x2="40" y2="-2" class="cgloss__sight"><animate attributeName="x1" values="${xs}" dur="7s" repeatCount="indefinite" /><animate attributeName="y1" values="${ys}" dur="7s" repeatCount="indefinite" /></line>`
      + mover(earth, 7, `<circle r="1.8" class="cgloss__earth" />`)
      + `<path d="M 40 -7 L 41.2 -3.2 L 45 -2 L 41.2 -0.8 L 40 3 L 38.8 -0.8 L 35 -2 L 38.8 -3.2 Z" class="cgloss__star" />`
      + `<text x="4" y="-22" class="cgloss__text">1 parsec · 3.26 light-years</text>`
      + `<text x="4" y="26" class="cgloss__text is-soft">the star seems to sway, very slightly</text>`;
  },
  heliosphere() {
    const wind = scatter(26, 9, (rand, i) => {
      const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
      const r = 28 + rand() * 4;
      const x = f(Math.cos(a) * r * (Math.cos(a) < 0 ? 0.8 : 1.25));
      const y = f(Math.sin(a) * r * 0.82);
      return `<circle r="0.7" class="cgloss__wind"><animateMotion path="M -8 0 L ${x} ${y}" dur="${(3 + rand() * 2).toFixed(2)}s" begin="${(rand() * 3).toFixed(2)}s" repeatCount="indefinite" /><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="${(3 + rand() * 2).toFixed(2)}s" repeatCount="indefinite" /></circle>`;
    });
    return `<path d="M 34 -26 C 10 -34 -34 -30 -34 0 C -34 30 10 34 34 26 C 46 22 56 12 58 0 C 56 -12 46 -22 34 -26 Z" class="cgloss__bubble" />`
      + wind + sun(3, -8, 0)
      + `<text x="-8" y="-33" class="cgloss__text is-soft">heliopause · about 120 AU</text>`;
  },
  rubble() {
    const rocks = scatter(16, 31, (rand, i) => {
      const a = (i / 16) * Math.PI * 2 + rand();
      const r = i < 4 ? rand() * 4 : 7 + rand() * 7;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      const s = 3.2 + rand() * 3.6;
      const pts = Array.from({ length: 6 }, (_, k) => {
        const ang = (k / 6) * Math.PI * 2 + rand() * 0.5;
        const rr = s * (0.7 + rand() * 0.4);
        return `${f(x + Math.cos(ang) * rr)} ${f(y + Math.sin(ang) * rr)}`;
      }).join(" L ");
      const dx = f((rand() - 0.5) * 1.6);
      const dy = f((rand() - 0.5) * 1.6);
      return `<path d="M ${pts} Z" class="cgloss__boulder"><animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${(2.5 + rand() * 2).toFixed(2)}s" repeatCount="indefinite" /></path>`;
    });
    return spin(30, rocks) + `<text x="0" y="31" class="cgloss__text is-soft">boulders, held by weak gravity</text>`;
  },
  contact() {
    return spin(10, `<ellipse cx="-9" cy="0" rx="11" ry="8.5" class="cgloss__rockbig" /><ellipse cx="10" cy="0" rx="9" ry="7" class="cgloss__rockbig" /><circle cx="-11" cy="-2" r="1.8" class="cgloss__crater" /><circle cx="12" cy="2" r="1.4" class="cgloss__crater" />`)
      + `<text x="0" y="31" class="cgloss__text is-soft">two bodies, touching at a neck</text>`;
  },
  tidallock() {
    // The face mark sits on the side towards the planet and turns with the
    // orbit: one rotation per lap.
    return `<circle r="10" class="cgloss__earth-big" /><circle r="27" class="cgloss__path is-lit" />`
      + spin(9, `<circle cx="27" cy="0" r="4.2" class="cgloss__moon" /><circle cx="24.2" cy="0" r="1.3" class="cgloss__face" />`)
      + `<text x="0" y="37" class="cgloss__text is-soft">always the same face inward</text>`;
  },
  orbit() {
    // Newton's cannon: slow shots fall back; one fast enough keeps missing.
    return `<circle r="11" class="cgloss__earth-big" /><path d="M 0 -13 L 0 -17" class="cgloss__tick" />`
      + `<path d="M 0 -17 Q 9 -17 12 -6" class="cgloss__arc" /><path d="M 0 -17 Q 16 -17 17 3" class="cgloss__arc" />`
      + `<circle r="17" class="cgloss__path is-lit" />`
      + spin(5, `<circle cx="0" cy="-17" r="1.8" class="cgloss__light" />`)
      + `<text x="0" y="30" class="cgloss__text is-soft">falling, and always missing</text>`;
  },
  eccentricity() {
    // a = 28 about the Sun at a focus; e from 0 to 0.85 and back:
    // b = a sqrt(1 - e^2) = 14.7, centre offset ae = 23.8.
    return sun(2.6)
      + `<ellipse cx="0" cy="0" rx="28" ry="28" class="cgloss__path is-lit"><animate attributeName="cx" values="0;-23.8;0" dur="8s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" /><animate attributeName="ry" values="28;14.7;28" dur="8s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" /></ellipse>`
      + `<text x="0" y="36" class="cgloss__text is-soft">round (e = 0) to stretched (e near 1)</text>`;
  },
  retrograde() {
    return `<circle r="8" class="cgloss__round" /><circle r="17" class="cgloss__path" /><circle r="28" class="cgloss__path is-lit" />`
      + spin(6, `<circle cx="17" cy="0" r="2.4" class="cgloss__ice" />`, { reverse: true })
      + spin(9, `<circle cx="28" cy="0" r="2.6" class="cgloss__retro" />`)
      + `<text x="0" y="37" class="cgloss__text is-soft">the amber one goes the other way ↺</text>`;
  },
  resonance() {
    // Periods 1:2, so radii 1 : 2^(2/3) = 14 : 22.2; aligned once per lap
    // of the outer one, at the same place every time.
    const inner = keplerTrack({ a: 14, e: 0, steps: 96, laps: 2 });
    const outer = keplerTrack({ a: 22.2, e: 0, steps: 96, laps: 1 });
    const v = (t, k) => t.map((p) => f(p[k])).join(";");
    return sun(2.4) + ring(14) + ring(22.2)
      + `<line class="cgloss__sight"><animate attributeName="x1" values="${v(inner, "x")}" dur="8s" repeatCount="indefinite" /><animate attributeName="y1" values="${v(inner, "y")}" dur="8s" repeatCount="indefinite" /><animate attributeName="x2" values="${v(outer, "x")}" dur="8s" repeatCount="indefinite" /><animate attributeName="y2" values="${v(outer, "y")}" dur="8s" repeatCount="indefinite" /></line>`
      + mover(inner, 8, `<circle r="2" class="cgloss__ice" />`)
      + mover(outer, 8, `<circle r="2.6" class="cgloss__jupiter" />`)
      + `<text x="0" y="35" class="cgloss__text is-soft">two laps for every one</text>`;
  },
  albedo() {
    const ball = (x, cls, keep, label) => `<line x1="${x - 16}" y1="-26" x2="${x - 3}" y2="-6" class="cgloss__ray" /><line x1="${x + 3}" y1="-6" x2="${x + 16}" y2="-26" class="cgloss__ray" style="opacity:${keep}" /><circle cx="${x}" cy="0" r="7" class="${cls}" /><text x="${x}" y="18" class="cgloss__text is-soft">${label}</text>`;
    return ball(-36, "cgloss__soot", 0.12, "soot 4%") + ball(0, "cgloss__earth-big", 0.45, "Earth 30%") + ball(36, "cgloss__snow", 0.95, "snow 80%");
  },
  tholins() {
    const zig = (x, y, d) => `<path d="M ${x} ${y} l 4 3 l -3 2 l 4 3 l -3 2 l 4 3" class="cgloss__uv"><animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.6s" begin="${d}s" repeatCount="indefinite" /></path>`;
    return zig(-30, -24, 0) + zig(-22, -30, 0.5) + zig(-36, -14, 1)
      + `<circle r="12" class="cgloss__grainball"><animate attributeName="fill" values="#e3eefa;#d8b39d;#a8472c;#a8472c;#e3eefa" keyTimes="0;0.35;0.7;0.92;1" dur="9s" repeatCount="indefinite" /></circle>`
      + `<text x="0" y="28" class="cgloss__text is-soft">ice + sunlight + time = red</text>`;
  },
};

/**
 * The picture for a word, as an <svg> element. Moving unless the viewer
 * asks for less motion, in which case it is the first frame, still.
 */
export function glossaryArt(key, className = "cgloss__art") {
  const draw = ART[key];
  const node = document.createElementNS(SVG_NS, "svg");
  node.setAttribute("viewBox", "-60 -40 120 80");
  node.setAttribute("class", className);
  node.setAttribute("aria-hidden", "true");
  node.innerHTML = draw ? draw() : "";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    try { node.pauseAnimations?.(); } catch { /* nothing to pause */ }
  }
  return node;
}

/* ------------------------------------------------------------- the UI */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function normalise(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const REDUCED = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/* ---- letters that answer the pointer (see the header) */

function prepareCosmicText(element) {
  if (!element || element.dataset.cosmicReady) return;
  const text = element.textContent.replace(/\s+/g, " ").trim();
  if (!text) return;
  element.dataset.cosmicReady = "1";
  element.setAttribute("aria-label", text);
  element.textContent = "";
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) {
      element.append(document.createTextNode(" "));
      return;
    }
    const token = el("span", "cdec__token");
    token.setAttribute("aria-hidden", "true");
    Array.from(part).forEach((character) => token.append(el("span", "cdec__glyph", character)));
    element.append(token);
  });
}

function createCosmicField(root) {
  let active = null;
  let frame = 0;
  let pending = null;
  let lastRippleAt = 0;
  let lastX = 0;
  let lastY = 0;

  function reset(target = active) {
    target?.querySelectorAll(".cdec__glyph").forEach((glyph) => {
      glyph.classList.remove("is-reacting", "is-rippling");
      glyph.removeAttribute("style");
    });
  }

  function animate(target, x, y, now) {
    const changed = active !== target;
    if (active && changed) reset(active);
    active = target;
    const shouldRipple = changed || Math.hypot(x - lastX, y - lastY) > 20 || now - lastRippleAt > 420;
    const ripple = [];
    target.querySelectorAll(".cdec__glyph").forEach((glyph) => {
      const rect = glyph.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      // The dossier's radii and multipliers, unchanged.
      const influence = Math.max(0, 1 - distance / 46);
      const rippleInfluence = Math.max(0, 1 - distance / 78);
      if (shouldRipple && rippleInfluence > 0) {
        const lift = 0.45 + rippleInfluence * 1.55;
        glyph.style.setProperty("--cosmic-ripple-lift", `${lift}px`);
        glyph.style.setProperty("--cosmic-ripple-settle", `${lift * 0.28}px`);
        glyph.style.setProperty("--cosmic-ripple-delay", `${Math.round(distance * 2.15)}ms`);
        ripple.push(glyph);
      }
      if (influence <= 0) {
        glyph.classList.remove("is-reacting");
        glyph.style.removeProperty("--cosmic-character-x");
        glyph.style.removeProperty("--cosmic-character-y");
        glyph.style.removeProperty("--cosmic-character-turn");
        glyph.style.removeProperty("--cosmic-character-scale");
        return;
      }
      glyph.style.setProperty("--cosmic-character-x", `${dx * influence * 0.045}px`);
      glyph.style.setProperty("--cosmic-character-y", `${dy * influence * 0.06 - influence * 3}px`);
      glyph.style.setProperty("--cosmic-character-turn", `${dx * influence * 0.09}deg`);
      glyph.style.setProperty("--cosmic-character-scale", String(1 + influence * 0.16));
      glyph.classList.toggle("is-reacting", influence > 0.08);
    });
    if (shouldRipple && ripple.length) {
      target.querySelectorAll(".cdec__glyph.is-rippling").forEach((g) => g.classList.remove("is-rippling"));
      void target.offsetWidth;
      ripple.forEach((g) => g.classList.add("is-rippling"));
      lastRippleAt = now;
      lastX = x;
      lastY = y;
    }
  }

  // The newest pointer sample only, once per frame, as the dossier does.
  const onMove = (event) => {
    if (REDUCED()) return;
    const target = event.target.closest?.("[data-cosmic-text]");
    if (!target) {
      if (active) {
        reset(active);
        active = null;
      }
      return;
    }
    prepareCosmicText(target);
    pending = { target, x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame((now) => {
      frame = 0;
      if (pending) animate(pending.target, pending.x, pending.y, now);
      pending = null;
    });
  };
  const onLeave = () => {
    if (active) reset(active);
    active = null;
  };
  root.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
  };
}

/* ---- one word's card */

function card(entry, { compact = false, index = 0 } = {}) {
  const node = el("article", `cgloss__card cdec__card${compact ? " is-compact" : ""}${entry.key === "binary" ? " is-pair" : ""}`);
  node.dataset.word = entry.key;
  node.style.setProperty("--k", String(index));
  // A binary is shown beside a triple: the word covers both.
  const arts = el("div", "cgloss__arts");
  (entry.key === "binary" ? ["binary", "triple"] : [entry.key])
    .forEach((key) => arts.append(glossaryArt(key)));
  node.append(arts);
  const text = el("div", "cgloss__words");
  const head = el("h4", "cgloss__term");
  const term = el("span", null, entry.term);
  term.dataset.cosmicText = "";
  head.append(term);
  if (entry.also) head.append(el("span", "cgloss__also", ` · ${entry.also}`));
  const plain = el("p", "cgloss__plain", entry.plain);
  plain.dataset.cosmicText = "";
  text.append(head, plain);
  node.append(text);
  return node;
}

/* A small animated mark for a bunch: its words as stars joined up. */
function bunchMark(count, hue) {
  const node = document.createElementNS(SVG_NS, "svg");
  node.setAttribute("viewBox", "-20 -20 40 40");
  node.setAttribute("class", "cdec__mark");
  node.setAttribute("aria-hidden", "true");
  const n = Math.max(3, Math.min(8, count));
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (hue % 7) * 0.3;
    const r = 9 + ((i * 37 + hue) % 7);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"} ${f(x)} ${f(y)}`).join(" ");
  node.innerHTML = `<path d="${path} Z" class="cdec__mark-line" />`
    + pts.map(([x, y], i) => `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" class="cdec__mark-star"><animate attributeName="opacity" values="0.35;1;0.35" dur="${(2.4 + (i % 3) * 0.7).toFixed(1)}s" begin="${(i * 0.3).toFixed(1)}s" repeatCount="indefinite" /></circle>`).join("")
    + spin(24, `<circle r="3" class="cdec__mark-core" />`);
  return node;
}

/**
 * @param {HTMLElement} host  the board's root; popover and decoder live in it
 */
export function createBoardGlossary(host) {
  let popover = null;
  let popoverKey = null;
  let popoverField = null;
  let decoder = null;

  function closePopover() {
    if (!popover) return false;
    popoverField?.();
    popoverField = null;
    popover.remove();
    popover = null;
    popoverKey = null;
    host.querySelectorAll("[data-gloss][aria-expanded=\"true\"]")
      .forEach((node) => node.setAttribute("aria-expanded", "false"));
    return true;
  }

  function showPopover(key, anchor) {
    if (popoverKey === key) {
      closePopover();
      return;
    }
    closePopover();
    const entry = glossaryEntry(key);
    if (!entry) return;
    popover = el("div", "cgloss cgloss__pop");
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `${entry.term}, in plain words`);
    popover.append(el("span", "cboard__eyebrow", "Space Dictionary"));
    popover.append(card(entry, { compact: true }));
    const more = el("button", "cgloss__more", "Open Space Dictionary: every word →");
    more.type = "button";
    more.dataset.glossSheet = "1";
    popover.append(more);
    host.append(popover);
    popoverField = createCosmicField(popover);
    popoverKey = key;
    anchor?.setAttribute("aria-expanded", "true");

    // Under the "?", kept on screen; above it if there is no room below.
    const box = anchor?.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    if (box) {
      const left = Math.min(Math.max(12, box.left - 20), window.innerWidth - width - 12);
      let top = box.bottom + 10;
      if (top + height > window.innerHeight - 12) top = Math.max(12, box.top - height - 10);
      popover.style.left = `${left - hostBox.left}px`;
      popover.style.top = `${top - hostBox.top}px`;
    }
  }

  // ---------------------------------------------------------- the decoder

  function openDecoder(origin = null) {
    closePopover();
    if (decoder) return;
    const overlay = el("div", "cgloss cdec");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Space Dictionary: the board's words in plain language");
    const veil = el("div", "cdec__veil");
    veil.dataset.glossClose = "1";
    overlay.append(veil);

    const panel = el("section", "cdec__panel");
    // The panel opens out of whatever opened it.
    const hostBox = host.getBoundingClientRect();
    const from = origin?.getBoundingClientRect?.();
    const ox = from ? from.left + from.width / 2 - hostBox.left : hostBox.width / 2;
    const oy = from ? from.top + from.height / 2 - hostBox.top : hostBox.height / 2;
    overlay.style.setProperty("--ox", `${ox}px`);
    overlay.style.setProperty("--oy", `${oy}px`);

    const sky = el("div", "cdec__sky");
    sky.setAttribute("aria-hidden", "true");
    sky.append(el("span", "cdec__orbit is-a"), el("span", "cdec__orbit is-b"), el("span", "cdec__orbit is-c"));
    panel.append(sky);

    // Head: name, search, the bunches.
    const head = el("header", "cdec__head");
    const brand = el("div", "cdec__brand");
    const logo = el("span", "cdec__logo");
    logo.setAttribute("aria-hidden", "true");
    logo.append(el("i", "cdec__logo-core"), el("i", "cdec__logo-ring"), el("i", "cdec__logo-moon"));
    const titles = el("div", "cdec__titles");
    titles.append(el("span", "cboard__eyebrow cdec__eyebrow", "Space Dictionary"));
    const h = el("h3", "cdec__title", "The universe, in plain words");
    h.dataset.cosmicText = "";
    titles.append(h);
    titles.append(el("p", "cdec__count", `${GLOSSARY.length} words in ${GLOSSARY_GROUPS.length} bunches · each with a picture that moves`));
    brand.append(logo, titles);
    head.append(brand);

    const shut = el("button", "cgloss__shut cdec__shut");
    shut.type = "button";
    shut.dataset.glossClose = "1";
    shut.setAttribute("aria-label", "Close Space Dictionary");
    shut.append(el("span", "cdec__shut-x"), el("span", null, "Close"));
    head.append(shut);

    const search = el("label", "cdec__search");
    search.append(el("span", "cdec__search-icon"));
    const input = el("input");
    input.type = "search";
    input.placeholder = "Search a word — light-year, comet, AU, orbit…";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Search Space Dictionary");
    search.append(input);
    const found = el("span", "cdec__found");
    found.setAttribute("aria-live", "polite");
    search.append(found);
    head.append(search);

    const chips = el("nav", "cdec__chips");
    chips.setAttribute("aria-label", "Bunches");
    const all = el("button", "cdec__chip is-on", "All");
    all.type = "button";
    all.dataset.decGroup = "all";
    chips.append(all);
    GLOSSARY_GROUPS.forEach((group) => {
      const chip = el("button", "cdec__chip");
      chip.type = "button";
      chip.dataset.decGroup = group.key;
      chip.style.setProperty("--hue", String(group.hue));
      chip.append(el("i", "cdec__chip-dot"), document.createTextNode(group.title),
        el("span", "cdec__chip-count", String(GLOSSARY.filter((e) => e.group === group.key).length)));
      chips.append(chip);
    });
    head.append(chips);
    panel.append(head);

    // Body: one bunch per group.
    const body = el("div", "cdec__body");
    const bunches = GLOSSARY_GROUPS.map((group, gi) => {
      const section = el("section", "cdec__bunch");
      section.dataset.group = group.key;
      section.style.setProperty("--hue", String(group.hue));
      section.style.setProperty("--g", String(gi));
      const entries = GLOSSARY.filter((e) => e.group === group.key);
      const bhead = el("header", "cdec__bunch-head");
      bhead.append(bunchMark(entries.length, group.hue));
      const bt = el("div");
      const title = el("h4", "cdec__bunch-title", group.title);
      title.dataset.cosmicText = "";
      bt.append(title, el("p", "cdec__bunch-blurb", group.blurb));
      bhead.append(bt);
      section.append(bhead);
      const grid = el("div", "cdec__cards");
      const cards = entries.map((entry, k) => {
        const node = card(entry, { index: k });
        grid.append(node);
        return { node, entry, text: normalise(`${entry.term} ${entry.also ?? ""} ${entry.plain}`), term: normalise(`${entry.term} ${entry.also ?? ""}`) };
      });
      section.append(grid);
      body.append(section);
      return { section, cards, group };
    });
    const none = el("p", "cdec__none");
    none.hidden = true;
    body.append(none);
    panel.append(body);
    overlay.append(panel);
    host.append(overlay);
    // The circle the panel opens out of, in the panel's own coordinates
    // (the overlay fills the host, so its offsets are the host's).
    panel.style.setProperty("--cx", `${ox - panel.offsetLeft}px`);
    panel.style.setProperty("--cy", `${oy - panel.offsetTop}px`);

    let group = "all";
    function apply() {
      const query = normalise(input.value.trim());
      let shown = 0;
      bunches.forEach((bunch) => {
        let inBunch = 0;
        const groupOn = group === "all" || bunch.group.key === group;
        bunch.cards.forEach(({ node, text, term }, k) => {
          const on = groupOn && (!query || text.includes(query));
          node.hidden = !on;
          node.classList.toggle("is-match", Boolean(query) && on && term.includes(query));
          if (on) {
            node.style.setProperty("--k", String(inBunch));
            inBunch += 1;
          }
          void k;
        });
        bunch.section.hidden = inBunch === 0;
        shown += inBunch;
        // Replay the entrance for what is left, so a filter reads as a
        // reshuffle rather than a cut.
        bunch.section.classList.remove("is-entering");
        void bunch.section.offsetWidth;
        bunch.section.classList.add("is-entering");
      });
      found.textContent = query ? `${shown} ${shown === 1 ? "word" : "words"}` : "";
      none.hidden = shown > 0;
      none.textContent = shown ? "" : `Nothing called “${input.value.trim()}” yet. Try a shorter word, or clear the search.`;
      chips.querySelectorAll(".cdec__chip").forEach((chip) => chip.classList.toggle("is-on", chip.dataset.decGroup === group));
      body.scrollTop = 0;
    }
    input.addEventListener("input", apply);
    chips.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-dec-group]");
      if (!chip) return;
      group = chip.dataset.decGroup;
      apply();
    });

    const stopField = createCosmicField(panel);
    decoder = { overlay, input, stopField, origin };
    bunches.forEach((b) => b.section.classList.add("is-entering"));
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    setTimeout(() => input.focus({ preventScroll: true }), REDUCED() ? 0 : 420);
    window.dispatchEvent(new CustomEvent("beyond-earth:decoder-state", { detail: { open: true } }));
  }

  function closeDecoder({ immediate = false } = {}) {
    if (!decoder) return false;
    const { overlay, stopField, origin } = decoder;
    decoder = null;
    stopField();
    window.dispatchEvent(new CustomEvent("beyond-earth:decoder-state", { detail: { open: false } }));
    if (immediate || REDUCED()) {
      overlay.remove();
    } else {
      overlay.classList.remove("is-open");
      overlay.classList.add("is-closing");
      setTimeout(() => overlay.remove(), 420);
    }
    if (origin?.isConnected) origin.focus?.({ preventScroll: true });
    return true;
  }

  /* Escape and outside clicks close the top layer only; a search with text
   * in it is cleared first. */
  function closeTop() {
    if (closePopover()) return true;
    if (decoder?.input.value) {
      decoder.input.value = "";
      decoder.input.dispatchEvent(new Event("input"));
      return true;
    }
    return closeDecoder();
  }

  function closeAll() {
    closePopover();
    closeDecoder({ immediate: true });
  }

  function handleClick(event) {
    const trigger = event.target.closest("[data-gloss]");
    if (trigger) {
      showPopover(trigger.dataset.gloss, trigger);
      return true;
    }
    const opener = event.target.closest("[data-gloss-sheet]");
    if (opener) {
      openDecoder(opener);
      return true;
    }
    if (event.target.closest("[data-gloss-close]")) {
      closeDecoder();
      return true;
    }
    // Anything inside the decoder stays with the decoder.
    if (event.target.closest(".cdec")) return true;
    if (popover && !event.target.closest(".cgloss__pop")) closePopover();
    return false;
  }

  return {
    handleClick,
    closeTop,
    closePopover,
    closeAll,
    openDecoder,
    isOpen: () => Boolean(popover || decoder),
  };
}

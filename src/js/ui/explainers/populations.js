import {
  CENTAUR_ELEMENTS,
  NEPTUNE_TROJANS,
  PLANET_TROJANS,
} from "../../scene/smallBodies/populationCatalogue.js";
import { CENTAURS } from "../../scene/smallBodies/centaurCatalogue.js";
import { PLANET_TROJAN_BODIES, TROJAN_BODY_NAME } from "../../scene/smallBodies/planetTrojans.js";
import { JUPITER_TROJANS } from "../../scene/smallBodies/trojanCatalogue.js";
import {
  TAU, DEG, NOW_JD, PLANETS, planetAt, prepareRow, rowAt, placeOnOrbit,
  drawSun, ring, dot, tag,
  SVG_HEAD, svgSun, svgRing, svgDot, svgText, svgEllipse,
} from "./common.js";

/**
 * The crowds, explained by moving them: the Centaurs, and the Trojans of
 * every planet but Jupiter (round 39: split into the inner planets' and
 * Uranus's and Neptune's; the near-Earth families moved to nearEarth.js in
 * round 38). Every dot is one catalogued
 * object on its real orbit (populationCatalogue.js, JPL SBDB 8 October
 * 2026), starting where it is today; the planets are on Standish's
 * elements for the same date. Distances are to scale with each other; time
 * is sped up.
 */

const point = { x: 0, y: 0, r: 0 };

/*
 * Round 38, second pass (Prompts.md: "all the listed trojans names should be
 * there in the dashboard ... at the RHS bottom"): one fly-to row per drawn
 * Trojan of a planet, from the bodies themselves (planetTrojans.js), with
 * its camp and its size as the card has it.
 */
const TROJAN_SWATCH = { Venus: "#ffd9a0", Earth: "#7fd0ff", Mars: "#ff9a7a", Uranus: "#9fe8e6", Neptune: "#9fb8ff", Jupiter: "#d9b48c" };
function trojanRows(planet) {
  return PLANET_TROJAN_BODIES
    .filter((b) => b.coOrbital?.planet === planet)
    .map((b) => {
      const camp = /L[45]/.exec(b.classification)?.[0] ?? "";
      const size = b.diameterKm < 1 ? `${Math.round(b.diameterKm * 1000)} m` : `${b.diameterKm < 10 ? b.diameterKm.toFixed(1) : Math.round(b.diameterKm)} km`;
      return { name: b.name, mode: planet, where: `${planet} ${camp}`, note: `≈${size}${b.diameterLabel?.includes("assumed") ? " (from its brightness)" : ""}`, swatch: TROJAN_SWATCH[planet] };
    });
}
/* Jupiter's own drawn Trojans (trojanCatalogue.js), for the full list;
 * its 11,000+ others are the swarms in Jupiter's own view. */
function jupiterRows() {
  return JUPITER_TROJANS
    .filter((r) => /jupiter trojan/i.test(r.classification ?? ""))
    .map((r) => ({ name: r.name, where: `Jupiter ${/L[45]/.exec(r.classification)?.[0] ?? ""}`.trim(), note: r.detail?.split("|")[0]?.trim() ?? "", swatch: TROJAN_SWATCH.Jupiter }));
}

/* Days per second of animation, from a topic's lap: `t` counts laps. */
const daysAt = (t, lapDays) => NOW_JD + t * lapDays;

function drawPlanet(ctx, name, jd, toXY, size = 4, label = true) {
  planetAt(name, jd, point);
  const [x, y] = toXY(point.x, point.y);
  dot(ctx, x, y, size, PLANETS[name].colour);
  if (label) tag(ctx, name, x, y - size - 9, { colour: "rgba(230,236,246,0.85)" });
  return [x, y];
}

/* ------------------------------------------------------------ Centaurs */

const CENTAUR_COLOURS = { grey: "#a9c4d6", red: "#e08a62" };
const NAMED_CENTAURS = ["Chariklo", "Chiron", "Pholus", "Echeclus", "Nessus", "Asbolus", "Hylonome", "Bienor"];

const centaurs = {
  key: "centaurs",
  aria: "The Centaurs",
  eyebrow: "Between the giant planets, on the way in",
  title: "The Centaurs",
  count: "1,056 known (JPL Small-Body Database, 8 October 2026) · perhaps 44,000 larger than 1 km · eight drawn as bodies",
  lapSeconds: 8,
  modes: [
    { key: "all", label: "1 · All of them", sub: "Every catalogued Centaur" },
    { key: "named", label: "2 · The eight drawn", sub: "Their own orbits" },
  ],
  setup() {
    const rows = CENTAUR_ELEMENTS.map(prepareRow);
    const named = CENTAURS.filter((c) => NAMED_CENTAURS.includes(c.name)).map((c) => ({
      name: c.name,
      colour: (c.chroma?.[0] ?? 1) > 1.25 ? CENTAUR_COLOURS.red : "#cfe2ee",
      p: prepareRow([c.orbit.aAU, c.orbit.e, c.orbit.iDeg, c.orbit.nodeDeg, c.orbit.argPeriDeg, c.orbit.meanAnomalyDeg, 0, c.orbit.epochJD]),
    }));
    return { rows, named };
  },
  legend: [
    { colour: "#fff4d6", text: "Sun" },
    { colour: "#d9b48c", text: "Jupiter to Neptune" },
    { colour: CENTAUR_COLOURS.grey, text: "Centaurs" },
    { colour: "#cfe2ee", text: "Drawn bodies · grey" },
    { colour: CENTAUR_COLOURS.red, text: "Drawn bodies · red" },
  ],
  caption: (mode) => mode === "all"
    ? "Every catalogued Centaur on its real orbit, from where it is today — one Jupiter year passes every 8 seconds. They swarm across the orbits of Saturn, Uranus and Neptune, and none of those orbits is safe from them."
    : "The eight Centaurs the scene draws as bodies, each with its whole orbit. Two (Pholus, Nessus) are very red; the rest are grey — the colour split nobody can yet explain.",
  draw(ctx, w, t, mode, data) {
    const c = w / 2;
    const scale = (w * 0.47) / 36;
    const toXY = (x, y) => [c + x * scale, c - y * scale];
    const jd = daysAt(t, 11.862 * 365.25);
    ["Jupiter", "Saturn", "Uranus", "Neptune"].forEach((name) => ring(ctx, c, c, PLANETS[name].a * scale, "rgba(217, 180, 140, 0.28)"));
    if (mode === "all") {
      ctx.fillStyle = "rgba(169, 196, 214, 0.75)";
      for (let i = 0; i < data.rows.length; i += 1) {
        rowAt(data.rows[i], jd, point);
        if (point.r > 37) continue;
        const [x, y] = toXY(point.x, point.y);
        ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      }
    }
    data.named.forEach((b) => {
      if (mode === "named") {
        ctx.strokeStyle = `${b.colour}aa`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k <= 120; k += 1) {
          placeOnOrbit(b.p.node, b.p.arg, b.p.inc, b.p.e, b.p.a, (k / 120) * TAU, point);
          const [x, y] = toXY(point.x, point.y);
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      rowAt(b.p, jd, point);
      const [x, y] = toXY(point.x, point.y);
      dot(ctx, x, y, 3.2, b.colour);
      if (mode === "named") tag(ctx, b.name, x + 6, y - 6, { align: "left", size: w });
    });
    drawSun(ctx, c, c, 5);
    ["Jupiter", "Saturn", "Uranus", "Neptune"].forEach((name) => drawPlanet(ctx, name, jd, toXY, 3.6, mode === "all"));
  },
  stepsTitle: "Half asteroid, half comet — in five steps",
  steps: [
    {
      title: "Caught between the giants",
      text: "A Centaur is a small icy body whose orbit lies among the giant planets — by JPL's definition, a semi-major axis between Jupiter's (5.5 AU) and Neptune's (30.1 AU). There are no safe orbits there: sooner or later every Centaur passes near a giant planet and is thrown somewhere else.",
      svg: `${SVG_HEAD}${svgRing(14)}${svgRing(24)}${svgRing(36)}${svgRing(48)}${svgSun(60, 60, 3)}${svgEllipse(30, 0.45, 40, "#a9c4d6")}${svgText(60, 112, "Jupiter, Saturn, Uranus, Neptune")}</svg>`,
    },
    {
      title: "Kuiper Belt objects on their way in",
      text: "They come from beyond Neptune. Neptune nudges a Kuiper Belt object inward; then Uranus, Saturn and Jupiter pass it along. A typical Centaur lasts only a few million years like this — an instant, astronomically — before it is flung out of the Solar System or pushed into the inner planets.",
      svg: `${SVG_HEAD}${svgRing(36)}${svgRing(48)}${svgSun(60, 60, 3)}${svgEllipse(46, 0.12, 120, "rgba(169,196,214,0.5)", 60, 60, 1, "2 2")}${svgEllipse(30, 0.5, 120, "#a9c4d6")}${svgEllipse(16, 0.6, 120, "#9ff0dc")}${svgText(60, 112, "Kuiper Belt → Centaur → comet")}</svg>`,
    },
    {
      title: "Comets in waiting",
      text: "Pushed far enough in, a Centaur warms and its ices start to boil off: it becomes a Jupiter-family comet. Some already show the start of it — Chiron and Echeclus have both been seen with comas and outbursts far from the Sun, which is why both carry comet names too.",
      svg: `${SVG_HEAD}${svgSun(30, 60, 4)}${svgDot(80, 60, 3.5, "#cfe2ee")}<path d="M 80 60 L 112 50 L 112 70 Z" fill="rgba(159,200,240,0.35)"/><circle cx="80" cy="60" r="9" fill="rgba(159,200,240,0.2)"/>${svgText(80, 90, "a coma, far from the Sun")}</svg>`,
    },
    {
      title: "Grey, or very red",
      text: "Centaurs come in two colours with almost nothing between: grey, close to the colour of sunlight (Chiron, Chariklo, Bienor), or very red (Pholus, Nessus). Nobody yet knows why. The red is thought to be organic ices darkened by billions of years of radiation.",
      svg: `${SVG_HEAD}${svgDot(38, 60, 14, "#cfe2ee")}${svgDot(82, 60, 14, "#e08a62")}${svgText(38, 90, "grey")}${svgText(82, 90, "red")}${svgText(60, 106, "almost nothing in between")}</svg>`,
    },
    {
      title: "What is drawn",
      text: "Every dot is one real Centaur, on its own orbit from the JPL Small-Body Database. The eight largest or best-studied are drawn as bodies you can fly to; the rest fly as points in the scene. Distances are to scale; time is sped up.",
      svg: "",
    },
  ],
  members: NAMED_CENTAURS.map((name) => ({
    name,
    where: "Centaur",
    swatch: ["Pholus", "Nessus"].includes(name) ? CENTAUR_COLOURS.red : "#cfe2ee",
    note: {
      Chariklo: "The largest — and the first small body found with rings",
      Chiron: "The first found, 1977 · asteroid and comet both",
      Pholus: "The reddest object anyone has measured",
      Echeclus: "Blew off a fragment brighter than itself",
      Nessus: "Red, nearly as red as Pholus",
      Asbolus: "Hubble saw a fresh, icy crater on it",
      Hylonome: "On the outer edge, just inside Neptune's reach",
      Bienor: "Long and stretched — and maybe two bodies",
    }[name],
  })),
  actions: [{ label: "Light them up in the scene", detail: { populations: ["centaurs"] } }],
  source: "Orbits: JPL Small-Body Database query, orbit class CEN (5.5 < a < 30.1 AU), 8 October 2026 — 1,056 objects, of which 10 are Neptune Trojans and are shown with Neptune instead. The 44,000 larger than 1 km is Horner, Evans & Bailey 2004's estimate (MNRAS 354, 798), as is the few-million-year lifetime. Colours of the drawn bodies: Peixinho et al. 2012.",
};

/* Round 38: the near-Earth families' point-cloud explanation was removed
 * (Prompts.md: "remove the current implementation") -- replaced by
 * explainers/nearEarth.js, one view per family with real rocks. */

/* Neptune's own view ("Neptune's company") was removed in round 39: its 42
 * Trojans are in the outer-Trojans view below, with Uranus's. */

/* ------------------------------------------- every planet's Trojans */

/*
 * Round 37 (the owner: "implement all out"): the co-orbital story finished.
 * One mode per planet that has Trojans drawn in the scene, each held still
 * at the top so its camps stand where they are; every dot is one known
 * Trojan on its real orbit (populationCatalogue.js), kept at the planet's
 * own pace, with the loop it traces in the planet's frame over one year --
 * the shape an eccentric, inclined orbit makes when you ride along with the
 * planet. Jupiter's own two swarms have their own view.
 */
const TROJAN_PLANETS = Object.freeze({
  Venus: { colour: "#ffd9a0", rows: () => PLANET_TROJANS.filter((t) => t.planet === "Venus") },
  Earth: { colour: "#7fd0ff", rows: () => PLANET_TROJANS.filter((t) => t.planet === "Earth") },
  Mars: { colour: "#ff9a7a", rows: () => PLANET_TROJANS.filter((t) => t.planet === "Mars") },
  Uranus: { colour: "#9fe8e6", rows: () => PLANET_TROJANS.filter((t) => t.planet === "Uranus") },
  Neptune: { colour: "#9fb8ff", rows: () => NEPTUNE_TROJANS },
});
const TROJAN_COUNTS = Object.fromEntries(Object.entries(TROJAN_PLANETS).map(([k, v]) => [k, v.rows().length]));
const planetYearDays = (name) => (36525 * 360) / PLANETS[name].Ldot;

const trojans = {
  key: "planet-trojans",
  aria: "Every planet's Trojans",
  eyebrow: "Sharing a planet's orbit, 60° ahead or behind",
  title: "Every planet's Trojans",
  count: `Venus ${TROJAN_COUNTS.Venus} · Earth ${TROJAN_COUNTS.Earth} · Mars ${TROJAN_COUNTS.Mars} · Jupiter over 11,000 · Saturn none · Uranus ${TROJAN_COUNTS.Uranus} · Neptune ${TROJAN_COUNTS.Neptune}`,
  lapSeconds: 10,
  initialMode: "Mars",
  modes: Object.keys(TROJAN_PLANETS).map((name) => ({ key: name, label: name, sub: `${TROJAN_COUNTS[name]} known` })),
  pickable: true,
  setup() {
    const out = { hits: [], hover: null };
    Object.entries(TROJAN_PLANETS).forEach(([planet, spec]) => {
      out[planet] = spec.rows().map((t) => ({ name: TROJAN_BODY_NAME[t.name] ?? t.name, camp: t.camp, p: prepareRow(t.el), trail: null }));
    });
    return out;
  },
  legend: (mode) => [
    { colour: "#fff4d6", text: "Sun" },
    { colour: PLANETS[mode]?.colour ?? "#fff", text: `${mode}, held still at the top` },
    { colour: TROJAN_PLANETS[mode]?.colour ?? "#fff", text: `${mode}'s Trojans · the loop each traces in a year` },
  ],
  caption: (mode) => ({
    Venus: "Venus's only known Trojan, 2013 ND15, held with Venus at the top. Its orbit is so stretched (e = 0.61) that, riding along with Venus, it swings in a huge loop — out past Earth's distance and back. It is only passing through: the planets will pull it out of the spot again.",
    Earth: "Earth's two: 2010 TK7, the first ever identified (2011), and 2020 XL5 (2021), both on the side 60° ahead. Both swing a long way from their point, and neither will stay for more than a few thousand years.",
    Mars: "Mars's seventeen, with Mars at the top: two ahead (1999 UJ7 and 2023 FW14), and Eureka with fourteen companions behind. Their orbits are nearly circular, so their loops are small — these have been here for most of the Solar System's life.",
    Uranus: "Uranus's two, 2011 QF99 and 2014 YX49, both ahead of it. Each is a Centaur caught for a while — Saturn and Jupiter tug them out again, after about a million years.",
    Neptune: "Neptune's 42: 31 ahead, 11 behind — fewer behind only because that point sits in front of the Milky Way's crowded centre, where faint dots are hard to find.",
  })[mode] ?? "",
  draw(ctx, w, t, mode, data) {
    const name = TROJAN_PLANETS[mode] ? mode : "Mars";
    const spec = TROJAN_PLANETS[name];
    const c = w / 2;
    const pa = PLANETS[name].a;
    /* Room for the widest loop: 2013 ND15 reaches 1.62 of Venus's distance. */
    const reach = Math.max(1.45, ...data[name].map((b) => (b.p.a * (1 + b.p.e)) / pa));
    const R = (w * 0.44) / reach;
    const scale = R / pa;
    const year = planetYearDays(name);
    const jd = NOW_JD + t * year;
    const planetPoint = { x: 0, y: 0, r: 0 };
    const lonAt = (date) => { planetAt(name, date, planetPoint); return Math.atan2(planetPoint.y, planetPoint.x); };
    /* A body's place at a date, kept at the planet's own pace: the 1:1
     * resonance is that ratio, whatever its osculating period says. */
    const bodyAt = (b, date) => {
      const p = b.p;
      const M = p.M0 + p.n * (NOW_JD - p.epoch) + ((date - NOW_JD) / year) * TAU;
      const frame = -lonAt(date) + Math.PI / 2;
      placeOnOrbit(p.node, p.arg, p.inc, p.e, p.a, M, point);
      const lon = Math.atan2(point.y, point.x) + frame;
      const r = Math.hypot(point.x, point.y) * scale;
      return [c + Math.cos(lon) * r, c - Math.sin(lon) * r];
    };
    ring(ctx, c, c, R, "rgba(200, 215, 235, 0.32)");
    ["L4 · 60° ahead", "L5 · 60° behind"].forEach((label, k) => {
      const a = Math.PI / 2 + (k === 0 ? 60 : -60) * DEG;
      const x = c + Math.cos(a) * R;
      const y = c - Math.sin(a) * R;
      ring(ctx, x, y, 6, "rgba(255,255,255,0.35)");
      tag(ctx, label, c + Math.cos(a) * R * 1.45, c - Math.sin(a) * R * 1.45, { colour: "rgba(230,236,246,0.8)" });
    });
    const bodies = data[name];
    bodies.forEach((b) => {
      if (!b.trail) {
        b.trail = [];
        for (let k = 0; k <= 72; k += 1) b.trail.push(bodyAt(b, NOW_JD + (k / 72) * year));
      }
      ctx.strokeStyle = `${spec.colour}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      b.trail.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    });
    const few = bodies.length <= 3;
    /* Round 38, second pass: every dot can be picked (explainerView
     * `pickable`); the hovered one is ringed and named. */
    data.hits = [];
    bodies.forEach((b) => {
      const [x, y] = bodyAt(b, jd);
      const hovered = data.hover === b.name;
      dot(ctx, x, y, hovered ? 4.6 : few ? 3.6 : 2.6, hovered ? "#ffffff" : spec.colour);
      if (hovered) ring(ctx, x, y, 8, "rgba(255,255,255,0.8)");
      if (few || hovered || b.name === "Eureka") tag(ctx, b.name, x + 6, y - 6, { align: "left", colour: hovered ? "#ffffff" : spec.colour });
      data.hits.push({ name: b.name, label: `${b.name} · ${name} ${b.camp}`, x, y });
    });
    drawSun(ctx, c, c, 6);
    dot(ctx, c, c - R, 6, PLANETS[name].colour);
    tag(ctx, name, c, c - R - 15);
  },
  stepsTitle: "Six planets, one trick — in five steps",
  steps: [
    {
      title: "The same two points on every orbit",
      text: "Any planet's orbit has two places where the Sun's pull and the planet's together keep a small body going round at exactly the planet's speed: 60° ahead (L4) and 60° behind (L5). Jupiter's are famous; every planet has them.",
      svg: `${SVG_HEAD}${svgRing(40, "rgba(200,215,235,0.5)")}${svgSun()}${svgDot(60, 20, 5, "#c46a3f")}${svgDot(25.4, 40, 3, "#ff9a7a")}${svgDot(94.6, 40, 3, "#ff9a7a")}${svgText(22, 32, "L4")}${svgText(98, 32, "L5")}</svg>`,
    },
    {
      title: "Whether anything stays",
      text: "Having the points is not the same as keeping anything in them. Mars's and Neptune's Trojans have been there for billions of years. Earth's, Venus's and Uranus's are visitors that wander in for thousands to millions of years and leave — the other planets keep pulling them out.",
      svg: "",
    },
    {
      title: "Saturn has none",
      text: "Not one Saturn Trojan has been found, and the models say why: Jupiter's and Saturn's near 5:2 rhythm, and the giant planets' early wandering, cleared Saturn's points long ago.",
      svg: "",
    },
    {
      title: "Mars's family",
      text: "Most of Mars's trailing Trojans share Eureka's orbit almost exactly. They are probably pieces of it, spun off by sunlight's slow push — a family of fragments still sitting in the spot their parent found.",
      svg: "",
    },
    {
      title: "What is drawn",
      text: "Every known Trojan of Venus, Earth, Mars, Uranus and Neptune, on its real orbit, kept at its planet's pace. Each one is a real body in the scene, riding with its planet. Hover a dot in the diagram — or pick a name from the list below — to fly to it and open its card.",
      svg: "",
    },
  ],
  /* Round 38, second pass: every Trojan drawn as a body, by planet --
   * Venus 1, Earth 2, Mars 17, Uranus 2, Neptune 42 -- and Jupiter's named
   * ones; each row flies there and opens its card. No lighting. */
  membersTitle: "Fly to one — every Trojan drawn",
  members: [
    ...trojanRows("Venus"),
    ...trojanRows("Earth"),
    ...trojanRows("Mars"),
    ...jupiterRows(),
    ...trojanRows("Uranus"),
    ...trojanRows("Neptune"),
  ],
  source: "Orbits: JPL Small-Body Database, 8 and 10 October 2026. Mars: the 17 shown stable by long-term integrations (de la Fuente Marcos & de la Fuente Marcos; Christou), as listed on 10 October 2026. Earth: Connors et al. 2011 (2010 TK7); Santana-Ros et al. 2022 (2020 XL5). Uranus: Alexandersen et al. 2013 (2011 QF99); de la Fuente Marcos & de la Fuente Marcos 2017 (2014 YX49). Venus: de la Fuente Marcos & de la Fuente Marcos 2014 (2013 ND15). Neptune: see Neptune's Trojans.",
};

/*
 * Round 39 (Prompts.md: "are you sure the Uranus, Neptune Trojans are part
 * of the inner planets?" and "the Trojans in Giant planets & Centaurs and
 * in Every planet's Trojans ... are the same, right?"). They were: one card
 * in the inner column held Uranus's and Neptune's Trojans too, and a second
 * card in the giants column repeated Neptune's 42. Now each lives in its
 * planets' column -- the same view, split -- and Neptune's separate card is
 * gone. Jupiter's keep their own view ("Jupiter's Trojans & Hildas").
 */
const trojanTopic = (key, planets, extra) => ({
  ...trojans,
  key,
  ...extra,
  initialMode: extra.initialMode ?? planets[planets.length - 1],
  modes: trojans.modes.filter((m) => planets.includes(m.key)),
  members: planets.flatMap((planet) => trojanRows(planet)),
});

const innerTrojans = trojanTopic("inner-trojans", ["Venus", "Earth", "Mars"], {
  aria: "The Trojans of Venus, Earth and Mars",
  title: "Trojans of Venus, Earth & Mars",
  count: `Venus ${TROJAN_COUNTS.Venus} · Earth ${TROJAN_COUNTS.Earth} · Mars ${TROJAN_COUNTS.Mars} — every one known, each a body you can fly to`,
  initialMode: "Mars",
  /* Round 39: the list shows the chosen planet's only. */
  membersTitle: (mode) => `Fly to one — ${mode}'s ${TROJAN_COUNTS[mode] === 1 ? "only one" : `${TROJAN_COUNTS[mode]}`}`,
});

const outerTrojans = trojanTopic("outer-trojans", ["Uranus", "Neptune"], {
  aria: "The Trojans of Uranus and Neptune",
  title: "Trojans of Uranus & Neptune",
  count: `Uranus ${TROJAN_COUNTS.Uranus} · Neptune ${TROJAN_COUNTS.Neptune} — every one known, each a body you can fly to · Jupiter's have their own view`,
  initialMode: "Neptune",
  membersTitle: (mode) => `Fly to one — ${mode}'s ${TROJAN_COUNTS[mode]}`,
});

export const POPULATION_TOPICS = Object.freeze({
  centaurs,
  "inner-trojans": innerTrojans,
  "outer-trojans": outerTrojans,
});

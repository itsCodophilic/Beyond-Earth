import {
  TAU, DEG, PLANETS, drawSun, ring, dot, tag,
  SVG_HEAD, svgSun, svgRing, svgDot, svgText,
} from "./common.js";

/**
 * The asteroid belt's structure: the Kirkwood gaps, and the families.
 *
 * Round 37 (the owner: "implement all out"). `docs/populations-not-yet-
 * built.md` section 7 and `not-covered.md` list "asteroid families and
 * Kirkwood gaps" as missing: the belt in the scene is a field, not a
 * structured population. The field itself lives in `asteroidBelt.js`, which
 * is frozen and is not touched here -- so the structure is shown in this
 * explanation instead, from the real catalogue. (Round 38: that field in
 * fact already leaves the 3:1, 5:2 and 7:3 lanes empty; the "Show the gaps
 * in our belt" action marks them on it -- scene/kirkwoodOverlay.js.)
 *
 * ## The count (mode 1)
 *
 * `BELT_COUNTS`: every *numbered* asteroid in the JPL Small-Body Database
 * (sb-kind=a, sb-ns=n), counted by osculating semi-major axis in 0.02 AU
 * bins from 2.00 to 3.50 AU and 0.05 AU bins from 3.50 to 4.15 AU -- 88
 * queries of the SBDB query API's `count`, 10 October 2026, 861,399 bodies
 * in all. The coarse bins are drawn per 0.02 AU (divided by 2.5) so the
 * histogram is one density. Numbered asteroids only, so the inner belt's
 * small bodies are over-represented relative to the outer (they are nearer
 * and easier to find); the gaps are not affected, because a gap is a
 * place where almost nothing is at any size.
 *
 * Resonance positions: a = a_J (q/p)^(2/3) for an asteroid going round p
 * times while Jupiter goes round q times, a_J = 5.2029 AU (Standish).
 *
 * ## The families (mode 3)
 *
 * Proper-element centres and rough extents of the largest collisional
 * families, from Nesvorný, Brož & Carruba 2015 (Asteroids IV, "Identification
 * and dynamical properties of asteroid families") -- drawn as soft regions
 * on an a-sin(i) plane, not as members.
 */

const FINE_FROM = 2.0;
const FINE_STEP = 0.02;
const FINE = [378, 129, 52, 54, 117, 341, 1031, 2591, 4802, 7289, 9460, 11418, 12814, 15136, 17471, 19297, 20366, 21548, 21936, 21965, 19455, 15974, 12489, 7926, 2374, 2908, 14428, 21208, 24497, 24755, 25234, 25012, 23852, 22645, 22080, 19145, 20441, 20792, 21976, 18223, 10684, 2702, 6879, 9058, 5963, 6446, 6087, 4289, 10596, 13585, 14593, 14796, 19127, 20628, 22943, 23751, 23806, 23301, 23801, 16346, 11021, 6219, 2530, 311, 129, 172, 256, 342, 493, 457, 467, 554, 399, 244, 173];
const COARSE_FROM = 3.5;
const COARSE_STEP = 0.05;
const COARSE = [269, 243, 25, 26, 11, 7, 20, 25, 1139, 2628, 242, 5, 2];
export const BELT_COUNTS = Object.freeze({ fineFrom: FINE_FROM, fineStep: FINE_STEP, fine: FINE, coarseFrom: COARSE_FROM, coarseStep: COARSE_STEP, coarse: COARSE });
const TOTAL = FINE.reduce((s, n) => s + n, 0) + COARSE.reduce((s, n) => s + n, 0);

const A_J = 5.2029;
const resonance = (p, q) => A_J * (q / p) ** (2 / 3);
/* [p, q, label, kind]: kind "gap" empties, "group" gathers. */
const RESONANCES = [
  [4, 1, "4:1", "gap"],
  [3, 1, "3:1", "gap"],
  [5, 2, "5:2", "gap"],
  [7, 3, "7:3", "gap"],
  [2, 1, "2:1", "gap"],
  [3, 2, "3:2 · Hildas", "group"],
].map(([p, q, label, kind]) => ({ p, q, label, kind, a: resonance(p, q) }));

const FAMILIES = [
  { name: "Vesta", a: 2.36, sinI: 0.11, da: 0.1, dsin: 0.02, colour: "#d9a0ff", note: "Pieces knocked off Vesta by the Rheasilvia impact, about a billion years ago" },
  { name: "Flora", a: 2.21, sinI: 0.09, da: 0.08, dsin: 0.03, colour: "#ffb070", note: "One of the oldest and most spread-out" },
  { name: "Nysa–Polana", a: 2.38, sinI: 0.05, da: 0.08, dsin: 0.02, colour: "#9fd0ff", note: "Two families on top of each other — one bright, one dark" },
  { name: "Eunomia", a: 2.62, sinI: 0.23, da: 0.08, dsin: 0.02, colour: "#ffe08a", note: "Shards of a stony body, 15 Eunomia the largest left" },
  { name: "Koronis", a: 2.88, sinI: 0.04, da: 0.06, dsin: 0.01, colour: "#9ff0b8", note: "Galileo flew past one of its members, Ida, and found its moon Dactyl" },
  { name: "Eos", a: 3.02, sinI: 0.17, da: 0.06, dsin: 0.02, colour: "#ff9a9a", note: "A rare kind of rock, probably from a body that partly melted" },
  { name: "Themis", a: 3.14, sinI: 0.02, da: 0.08, dsin: 0.01, colour: "#8fb8ff", note: "Ice was found on the surface of 24 Themis itself" },
  { name: "Hygiea", a: 3.14, sinI: 0.09, da: 0.06, dsin: 0.015, colour: "#c8c0b0", note: "Debris of the impact that left 10 Hygiea round" },
];

function histogramBins() {
  const bins = FINE.map((n, k) => ({ a: FINE_FROM + k * FINE_STEP, w: FINE_STEP, n }));
  COARSE.forEach((n, k) => bins.push({ a: COARSE_FROM + k * COARSE_STEP, w: COARSE_STEP, n: n * (FINE_STEP / COARSE_STEP) }));
  return bins;
}

const kirkwood = {
  key: "kirkwood",
  aria: "The asteroid belt's gaps and families",
  /* Round 38 (Prompts.md): say plainly that this is the belt's structure,
   * not an object or a group of objects. */
  eyebrow: "The structure of the main belt — not an object, not a group",
  title: "Kirkwood gaps & asteroid families",
  count: `${TOTAL.toLocaleString("en-GB")} numbered asteroids counted · 5 gaps Jupiter cleared · 1 group it gathers · 8 families from broken bodies`,
  lapSeconds: 16,
  modes: [
    { key: "count", label: "1 · The count", sub: "Every numbered asteroid" },
    { key: "why", label: "2 · Why the gaps", sub: "Meeting Jupiter in step" },
    { key: "families", label: "3 · The families", sub: "Broken bodies" },
  ],
  setup() {
    return { bins: histogramBins() };
  },
  legend: (mode) => mode === "count"
    ? [{ colour: "#a9c4d6", text: "Numbered asteroids per 0.02 AU of orbit size" }, { colour: "#ff8a6a", text: "Jupiter resonances that empty" }, { colour: "#9ff0b8", text: "One that gathers (the Hildas)" }]
    : mode === "why"
      ? [{ colour: PLANETS.Jupiter.colour, text: "Jupiter" }, { colour: "#ff8a6a", text: "An asteroid at the 3:1 — passes Jupiter at the same two places" }, { colour: "#9fd0ff", text: "One at 2.70 AU, not in step — passes it everywhere" }]
      : FAMILIES.map((f) => ({ colour: f.colour, text: f.name })),
  caption: (mode) => ({
    count: "Every numbered asteroid, counted by the size of its orbit (JPL Small-Body Database, 10 October 2026). The belt is not smooth: at five places almost nothing orbits — the Kirkwood gaps, found by Daniel Kirkwood in 1866 — and each is where an asteroid would go round exactly 4, 3, 5/2, 7/3 or 2 times for every one of Jupiter's laps. Out at the 3:2 the opposite happens: the Hildas gather there.",
    why: "Seen from above. Each ring marks a place where an asteroid overtook Jupiter, when Jupiter's tug on it is strongest. The one at the 3:1 goes round three times for each of Jupiter's laps, so it overtakes Jupiter twice a lap, always at the same two places: the tugs add up instead of cancelling, its orbit stretches, and within a few million years it is thrown into the inner Solar System. The one not in step passes Jupiter all round its orbit, and the tugs average away.",
    families: "The largest asteroid families, each a cloud of fragments from one collision, plotted by orbit size and tilt (the 'proper' values that stay fixed over millions of years). Nesvorný, Brož & Carruba 2015. The gaps cut through them.",
  })[mode] ?? "",
  draw(ctx, w, t, mode, data) {
    if (mode === "why") return drawWhy(ctx, w, t);
    const left = w * 0.1;
    const right = w * 0.96;
    const top = w * 0.1;
    const base = w * 0.8;
    const aMin = 1.95;
    const aMax = 4.2;
    const x = (a) => left + ((a - aMin) / (aMax - aMin)) * (right - left);
    ctx.strokeStyle = "rgba(200, 215, 235, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(right, base);
    ctx.stroke();
    [2.0, 2.5, 3.0, 3.5, 4.0].forEach((a) => {
      ctx.beginPath();
      ctx.moveTo(x(a), base);
      ctx.lineTo(x(a), base + 4);
      ctx.stroke();
      tag(ctx, `${a.toFixed(1)} AU`, x(a), base + 14, { colour: "rgba(200,215,235,0.75)", font: "500 10px ui-sans-serif, system-ui, sans-serif" });
    });
    tag(ctx, "Size of orbit (semi-major axis)", (left + right) / 2, base + 30, { colour: "rgba(200,215,235,0.6)", font: "500 10px ui-sans-serif, system-ui, sans-serif" });
    if (mode === "count") {
      const max = Math.max(...data.bins.map((b) => b.n));
      /* A slow sweep brightens the bars it passes, so the eye runs along
       * the belt from the Sun outwards. */
      const sweep = aMin + (t % 1) * (aMax - aMin);
      data.bins.forEach((b) => {
        const h = Math.sqrt(b.n / max) * (base - top);
        const lit = Math.max(0, 1 - Math.abs(b.a - sweep) / 0.15);
        ctx.fillStyle = `rgba(169, 196, 214, ${0.7 + 0.3 * lit})`;
        ctx.fillRect(x(b.a) + 0.5, base - h, Math.max(1, x(b.a + b.w) - x(b.a) - 1), h);
      });
      tag(ctx, "√ scale — the gaps are deeper than they look", left, top - 14, { align: "left", colour: "rgba(200,215,235,0.6)", font: "500 10px ui-sans-serif, system-ui, sans-serif" });
      RESONANCES.forEach((r, i) => {
        const colour = r.kind === "gap" ? "#ff8a6a" : "#9ff0b8";
        ctx.strokeStyle = `${colour}aa`;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x(r.a), top + 10);
        ctx.lineTo(x(r.a), base);
        ctx.stroke();
        ctx.setLineDash([]);
        tag(ctx, r.label, x(r.a), top + (i % 2 ? 22 : 4), { colour, font: "700 10px ui-sans-serif, system-ui, sans-serif" });
      });
      return;
    }
    // Families: a vs sin(i).
    const sMax = 0.3;
    const y = (s) => base - (s / sMax) * (base - top);
    [0, 0.1, 0.2, 0.3].forEach((s) => {
      tag(ctx, `${Math.round(Math.asin(s) / DEG)}°`, left - 14, y(s), { colour: "rgba(200,215,235,0.7)", font: "500 10px ui-sans-serif, system-ui, sans-serif" });
    });
    tag(ctx, "tilt", left - 14, top - 12, { colour: "rgba(200,215,235,0.6)", font: "500 10px ui-sans-serif, system-ui, sans-serif" });
    RESONANCES.filter((r) => r.kind === "gap" && r.a < 3.4).forEach((r) => {
      ctx.fillStyle = "rgba(255, 138, 106, 0.08)";
      ctx.fillRect(x(r.a) - 3, top, 6, base - top);
      tag(ctx, r.label, x(r.a), top - 4, { colour: "#ff8a6a", font: "700 10px ui-sans-serif, system-ui, sans-serif" });
    });
    const pulse = 0.85 + 0.15 * Math.sin(t * TAU);
    FAMILIES.forEach((f, i) => {
      const cx = x(f.a);
      const cy = y(f.sinI);
      const rx = Math.max(6, x(f.a + f.da) - cx);
      const ry = Math.max(5, y(f.sinI) - y(f.sinI + f.dsin));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, `${f.colour}cc`);
      g.addColorStop(1, `${f.colour}00`);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = g;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, rx, 0, TAU);
      ctx.fill();
      ctx.restore();
      tag(ctx, f.name, cx, cy - ry - 8 - (i === 7 ? 8 : 0), { colour: f.colour, font: "600 10px ui-sans-serif, system-ui, sans-serif" });
    });
  },
  stepsTitle: "Gaps and families — in five steps",
  steps: [
    {
      title: "Not a smooth ring",
      text: "Count the asteroids by the size of their orbits and the belt has holes in it: almost nothing goes round at 2.50, 2.82, 2.96 or 3.28 AU. Daniel Kirkwood noticed the gaps in 1866, when fewer than a hundred asteroids were known.",
      svg: `${SVG_HEAD}${svgSun()}${svgRing(30, "rgba(169,196,214,0.7)")}${svgRing(36, "rgba(169,196,214,0.25)")}${svgRing(42, "rgba(169,196,214,0.7)")}${svgText(60, 112, "a ring with a gap in it")}</svg>`,
    },
    {
      title: "Jupiter's rhythm",
      text: "Each gap is where an asteroid would go round a whole number of times for each of Jupiter's laps — 3:1, 5:2, 7:3, 2:1. Meeting Jupiter at the same spots over and over, it is pushed the same way each time until its orbit is stretched across Mars's or Earth's and it is lost from the belt.",
      svg: `${SVG_HEAD}${svgSun()}${svgRing(22, "rgba(255,138,106,0.7)")}${svgRing(44, "rgba(217,180,140,0.6)")}${svgDot(60, 16, 5, "#d9b48c")}${svgDot(60, 38, 3, "#ff8a6a")}${svgDot(60, 82, 3, "#ff8a6a")}${svgText(60, 112, "the same two meeting places")}</svg>`,
    },
    {
      title: "Where meteorites come from",
      text: "The 3:1 gap is a delivery chute. Rocks nudged into it are thrown onto Earth-crossing orbits within a few million years, which is why so many meteorites that land on Earth trace back to the inner belt.",
      svg: "",
    },
    {
      title: "Families: one rock, many pieces",
      text: "Some asteroids share almost the same orbit size, stretch and tilt — the debris of one collision. The Vesta family was blasted off Vesta's south pole by the impact that made the Rheasilvia basin; the Koronis family includes Ida, which Galileo flew past.",
      svg: "",
    },
    {
      title: "See them in our belt",
      text: "The belt in this scene leaves the same empty lanes: the 3:1, 5:2 and 7:3 gaps, plus one narrower lane, and its edges stop where the 4:1 and 2:1 begin. Press “Show the gaps in our belt” and they are marked on it with dashed rings. The families are not drawn as separate clouds in the scene — they are shown here. The Hildas, gathered at the 3:2, are in the scene with Jupiter's Trojans.",
      svg: "",
    },
  ],
  actions: [{ label: "Show the gaps in our belt", detail: { kirkwood: true } }],
  /* Round 38, second pass (Prompts.md: "all of them which are named must
   * also be listed at the bottom for an option to fly there"): a row for
   * every family on the chart -- its namesake, each a body in the scene
   * (Flora, Nysa, Polana, Koronis, Eos and Themis drawn for this, in
   * familyNamesakes.js) -- plus the two photographed members. */
  membersTitle: "Fly to each family",
  members: [
    { name: "Vesta", label: "Vesta", where: "Vesta family", note: "Its parent: pieces blasted off by the Rheasilvia impact", swatch: "#d9a0ff" },
    { name: "Flora", label: "Flora", where: "Flora family", note: "147 km, stony; one of the oldest families, beside the ν6 resonance", swatch: "#ffb070" },
    { name: "Gaspra", label: "Gaspra", where: "Flora family", note: "A member, photographed by Galileo in 1991", swatch: "#ffb070" },
    { name: "Nysa", label: "Nysa", where: "Nysa–Polana", note: "The bright half: enstatite, half the light reflected", swatch: "#9fd0ff" },
    { name: "Polana", label: "Polana", where: "Nysa–Polana", note: "The dark half — where Bennu and Ryugu probably came from", swatch: "#9fd0ff" },
    { name: "Eunomia", label: "Eunomia", where: "Eunomia family", note: "Its parent: the largest stony asteroid in the belt", swatch: "#ffe08a" },
    { name: "Koronis", label: "Koronis", where: "Koronis family", note: "Its parent: members' spins line up", swatch: "#9ff0b8" },
    { name: "Ida", label: "Ida", where: "Koronis family", note: "A member, with its moon Dactyl (Galileo, 1993)", swatch: "#9ff0b8" },
    { name: "Eos", label: "Eos", where: "Eos family", note: "Its parent: rare K-type rock", swatch: "#ff9a9a" },
    { name: "Themis", label: "Themis", where: "Themis family", note: "Its parent: water ice on its surface", swatch: "#8fb8ff" },
    { name: "Hygiea", label: "Hygiea", where: "Hygiea family", note: "Its parent, left round by the impact", swatch: "#c8c0b0" },
  ],
  source: "Counts: JPL Small-Body Database query API, every numbered asteroid by osculating semi-major axis, 10 October 2026. Resonances: Jupiter's a from Standish. Families: Nesvorný, Brož & Carruba 2015, Asteroids IV, approximate proper-element centres. Kirkwood 1867, Meteoric Astronomy.",
};

/* Mode 2: seen from above, nothing held still. An asteroid at the 3:1 and
 * one at 2.70 AU (not in step) go round with Jupiter, and every place where
 * one has overtaken Jupiter -- a conjunction, when the tug is strongest --
 * stays marked. The 3:1 one laps Jupiter twice per Jupiter orbit, always at
 * the same two longitudes; the other's meetings creep round the whole
 * circle. Circular orbits for the picture. */
function drawWhy(ctx, w, t) {
  const c = w / 2;
  const scale = (w * 0.42) / A_J;
  const lap = t * 2; // Jupiter laps: two per animation loop
  const jLon = lap * TAU;
  ring(ctx, c, c, A_J * scale, "rgba(217,180,140,0.35)");
  const bodies = [
    { a: resonance(3, 1), rate: 3, colour: "#ff8a6a", phase: 0.3 },
    { a: 2.7, rate: (A_J / 2.7) ** 1.5, colour: "#9fd0ff", phase: 1.9 },
  ];
  bodies.forEach((b) => {
    ring(ctx, c, c, b.a * scale, `${b.colour}33`);
    /* Its longitude is phase + rate * 2pi * lap; Jupiter's 2pi * lap. They
     * meet when the difference is a whole number of turns. */
    const meetEvery = 1 / (b.rate - 1);
    const first = ((-b.phase / TAU) % 1 + 1) % 1 * meetEvery;
    for (let when = first; when <= lap; when += meetEvery) {
      const lon = when * TAU;
      const x = c + Math.cos(lon) * b.a * scale;
      const y = c - Math.sin(lon) * b.a * scale;
      ring(ctx, x, y, 4, `${b.colour}aa`);
      ctx.strokeStyle = `${b.colour}22`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(c + Math.cos(lon) * A_J * scale, c - Math.sin(lon) * A_J * scale);
      ctx.stroke();
    }
    const lon = b.phase + b.rate * lap * TAU;
    dot(ctx, c + Math.cos(lon) * b.a * scale, c - Math.sin(lon) * b.a * scale, 4, b.colour);
  });
  drawSun(ctx, c, c, 6);
  const jx = c + Math.cos(jLon) * A_J * scale;
  const jy = c - Math.sin(jLon) * A_J * scale;
  dot(ctx, jx, jy, 7, PLANETS.Jupiter.colour);
  tag(ctx, "Jupiter", jx, jy - 16);
  tag(ctx, `Jupiter laps: ${Math.floor(lap)}`, 52, 18, { colour: "#9ff0dc", font: "700 11px ui-sans-serif, system-ui, sans-serif" });
}

export const BELT_TOPICS = Object.freeze({ kirkwood });

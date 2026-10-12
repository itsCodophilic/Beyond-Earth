import { TAU, drawSun, dot, tag, SVG_HEAD, svgSun, svgRing, svgDot, svgText } from "./common.js";

/**
 * How the Solar System formed, as a timeline you can step through.
 *
 * Round 37 (the owner: "implement all out"). The last item under
 * "mechanisms shown, not stated" in `docs/not-covered.md` and the project's
 * what's-left audit: "Solar System formation as a historical timeline".
 *
 * Each stage is a mode; inside a stage the picture moves through that
 * stage's own span of time, and the bar along the bottom shows where the
 * stage sits on the whole first billion years (a logarithmic clock, because
 * the first million years hold as much change as the next billion). The
 * pictures are diagrams -- particle counts, sizes and colours are chosen to
 * be read, not measured -- and the dates are the measured ones:
 *
 *   t = 0         CAIs, the oldest solids: 4,567.30 +/- 0.16 Myr ago
 *                 (Connelly et al. 2012, Science 338, 651)
 *   ~1 Myr        Jupiter's core, inferred from the isotope split between
 *                 inner and outer meteorites (Kruijer et al. 2017, PNAS 114,
 *                 6712)
 *   1-3 Myr       chondrules form; Mars-sized embryos in the inner disc
 *   ~2-4 Myr      Mars essentially complete (Dauphas & Pourmand 2011,
 *                 Nature 473, 489)
 *   3.8-4.8 Myr   the gas disc is gone (paleomagnetism of angrites, Wang et
 *                 al. 2017, Science 355, 623)
 *   ~30-150 Myr   Earth finished; the Moon-forming impact (most estimates
 *                 between about 50 and 150 Myr)
 *   < 100 Myr     the giant planets' instability, in the "early instability"
 *                 view (Nesvorný 2018, ARA&A 56, 137) -- scattering the
 *                 Kuiper Belt, capturing Trojans, filling the Oort Cloud
 *   ~160 Myr      the oldest mineral grains on Earth, Jack Hills zircons at
 *                 4.4 Gyr (Wilde et al. 2001, Nature 409, 175)
 */

const STAGES = [
  { key: "cloud", label: "1 · Cloud", sub: "Before t = 0", from: -0.1, to: 0.0, span: "A few hundred thousand years before t = 0" },
  { key: "disc", label: "2 · Disc", sub: "0–1 Myr", from: 0.0, to: 1.0, span: "The first million years" },
  { key: "jupiter", label: "3 · Jupiter", sub: "1–5 Myr", from: 1.0, to: 5.0, span: "Jupiter's core by about 1 million years; the gas gone by about 4" },
  { key: "rocky", label: "4 · Rocky worlds", sub: "5–150 Myr", from: 5, to: 150, span: "Mars done early; Earth and the Moon by about 100 million years" },
  { key: "shuffle", label: "5 · Giants move", sub: "≲100 Myr", from: 10, to: 100, span: "The giant planets' instability" },
  { key: "settled", label: "6 · Settled", sub: "4.4 Gyr ago →", from: 150, to: 4567, span: "From the oldest Earth crystals to today" },
];

/* A tiny seeded random, so the particles are the same every frame. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function particles(n, seed, rMin, rMax) {
  const rnd = seeded(seed);
  return Array.from({ length: n }, () => {
    const r = rMin + (rMax - rMin) * Math.sqrt(rnd());
    return { r, a: rnd() * TAU, w: 0.6 + rnd() * 0.8, s: rnd() };
  });
}

/* Clock bar: log time from 0.01 Myr to 4,567 Myr. */
function drawClock(ctx, w, stage, t) {
  const left = w * 0.08;
  const right = w * 0.92;
  const y = w * 0.94;
  const lx = (myr) => left + ((Math.log10(Math.max(0.01, myr)) + 2) / (Math.log10(4567) + 2)) * (right - left);
  ctx.strokeStyle = "rgba(200,215,235,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  [[0.01, "10 thousand yr"], [1, "1 Myr"], [100, "100 Myr"], [4567, "today"]].forEach(([m, label]) => {
    ctx.beginPath();
    ctx.moveTo(lx(m), y - 3);
    ctx.lineTo(lx(m), y + 3);
    ctx.stroke();
    tag(ctx, label, lx(m), y + 12, { colour: "rgba(200,215,235,0.6)", font: "500 9px ui-sans-serif, system-ui, sans-serif" });
  });
  if (stage.to <= 0) {
    /* The collapse comes before the clock starts. */
    dot(ctx, left, y, 3.5, "#9ff0dc");
    tag(ctx, "before the first solids — the clock has not started", left, y - 12, { align: "left", colour: "rgba(200,215,235,0.55)", font: "500 9px ui-sans-serif, system-ui, sans-serif" });
    return;
  }
  const from = Math.max(0.01, stage.from);
  const to = stage.to;
  ctx.fillStyle = "rgba(159,240,220,0.25)";
  ctx.fillRect(lx(from), y - 4, Math.max(3, lx(to) - lx(from)), 8);
  const now = from * (to / from) ** (t % 1);
  dot(ctx, lx(now), y, 3.5, "#9ff0dc");
  tag(ctx, "after the first solids", left, y - 12, { align: "left", colour: "rgba(200,215,235,0.55)", font: "500 9px ui-sans-serif, system-ui, sans-serif" });
}

const formation = {
  key: "formation",
  aria: "How the Solar System formed",
  eyebrow: "4,567 million years ago, in six steps",
  title: "How the Solar System formed",
  count: "Dated from meteorites to ±0.16 million years · the planets built in the first ~100 million",
  lapSeconds: 9,
  modes: STAGES.map((s) => ({ key: s.key, label: s.label, sub: s.sub })),
  setup() {
    return {
      cloud: particles(700, 11, 0.15, 1.0),
      dust: particles(900, 23, 0.08, 1.0),
      planetesimals: particles(220, 37, 0.12, 0.95),
      belt: particles(260, 41, 0.42, 0.55),
      kuiper: particles(320, 53, 0.86, 1.0),
    };
  },
  legend: (mode) => ({
    cloud: [{ colour: "#c9b8ff", text: "Gas and dust of the collapsing cloud core" }],
    disc: [{ colour: "#ffd9a0", text: "Hot inner disc: rock and metal" }, { colour: "#9fd0ff", text: "Cold outer disc: ice too, beyond the snow line" }],
    jupiter: [{ colour: "#d9b48c", text: "Jupiter, growing and opening a gap" }, { colour: "#9fd0ff", text: "Icy pebbles kept outside it" }],
    rocky: [{ colour: "#c46a3f", text: "Rocky embryos colliding" }, { colour: "#ffe08a", text: "A giant impact" }],
    shuffle: [{ colour: "#d9b48c", text: "Giant planets moving outwards" }, { colour: "#9fb8ff", text: "Icy bodies scattered" }],
    settled: [{ colour: "#a9c4d6", text: "What is left: belts, Trojans, the Oort Cloud" }],
  })[mode] ?? [],
  caption: (mode) => ({
    cloud: "A dense knot in a cloud of gas and dust falls in on itself — perhaps nudged by a nearby exploding star, whose short-lived atoms turn up in meteorites. As it shrinks it spins faster and flattens.",
    disc: "Time zero: the oldest solids, calcium-aluminium-rich grains found in meteorites, condense near the young Sun 4,567.3 million years ago. Around the star, a flat disc of gas and dust; inside the snow line only rock and metal survive as solids, outside it ice does too.",
    jupiter: "Jupiter's core grows fastest, out where ice adds to the solids, and within about a million years it is big enough to carve a gap that keeps the outer disc's material out — which is why inner and outer meteorites are two different chemical families. By about four million years the Sun's wind has blown the gas away.",
    rocky: "In the inner disc, a few dozen Moon- to Mars-sized embryos crash together over tens of millions of years. Mars, finished early, may be a leftover embryo. Earth's last giant collision, with a Mars-sized body, threw off the debris that became the Moon.",
    shuffle: "The giant planets did not stay where they formed. In the leading model their orbits became unstable within the first hundred million years: Neptune and Uranus were thrown outwards, scattering the icy disc — into the Kuiper Belt, onto Jupiter's Trojan points, and far out into the Oort Cloud.",
    settled: "By 4,400 million years ago Earth had crust and probably water — tiny zircon crystals of that age survive in Western Australia. What remains of the building blocks is the asteroid belt, the Trojans, the Kuiper Belt and the Oort Cloud.",
  })[mode] ?? "",
  draw(ctx, w, t, mode, data) {
    const stage = STAGES.find((s) => s.key === mode) ?? STAGES[0];
    const c = w / 2;
    const cy = w * 0.44;
    const R = w * 0.4;
    const u = t % 1;
    const spinOf = (p, speed) => p.a + (speed * u * TAU) / Math.sqrt(p.r ** 3 + 0.02);
    if (mode === "cloud") {
      const shrink = 1 - 0.55 * u;
      const flat = 1 - 0.75 * u;
      data.cloud.forEach((p) => {
        const a = spinOf(p, 0.2 + u);
        const r = p.r * R * shrink;
        const x = c + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * (0.35 + 0.65 * flat) * (p.s - 0.5) * 2;
        ctx.fillStyle = `rgba(201, 184, 255, ${0.25 + 0.4 * p.w * 0.6})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      });
      drawSun(ctx, c, cy, 2 + 6 * u);
      drawClock(ctx, w, stage, t);
      return;
    }
    const snow = 0.36;
    const discDust = (alpha = 1, gapAt = 0, gapWidth = 0, fade = 1) => {
      data.dust.forEach((p) => {
        if (gapWidth && Math.abs(p.r - gapAt) < gapWidth) return;
        const a = spinOf(p, 1.2);
        const x = c + Math.cos(a) * p.r * R;
        const y = cy + Math.sin(a) * p.r * R * 0.42;
        const icy = p.r > snow;
        ctx.fillStyle = icy ? `rgba(159, 208, 255, ${0.45 * alpha * fade})` : `rgba(255, 217, 160, ${0.5 * alpha * fade})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      });
    };
    if (mode === "disc") {
      discDust(0.6 + 0.4 * u);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = "rgba(159, 208, 255, 0.5)";
      ctx.beginPath();
      ctx.ellipse(c, cy, snow * R, snow * R * 0.42, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      tag(ctx, "snow line", c + snow * R + 4, cy - 10, { align: "left", colour: "#9fd0ff" });
      drawSun(ctx, c, cy, 8);
      drawClock(ctx, w, stage, t);
      return;
    }
    if (mode === "jupiter") {
      const gas = 1 - u;
      ctx.fillStyle = `rgba(150, 140, 200, ${0.12 * gas})`;
      ctx.beginPath();
      ctx.ellipse(c, cy, R, R * 0.42, 0, 0, TAU);
      ctx.fill();
      const jr = 0.46;
      discDust(0.9, jr, 0.03 + 0.05 * u);
      const ja = 0.4 + u * TAU * 0.6;
      dot(ctx, c + Math.cos(ja) * jr * R, cy + Math.sin(ja) * jr * R * 0.42, 3 + 6 * u, "#d9b48c");
      tag(ctx, "Jupiter", c + Math.cos(ja) * jr * R, cy + Math.sin(ja) * jr * R * 0.42 - 16, { colour: "#d9b48c" });
      if (u > 0.6) tag(ctx, "the gas clears", c, cy + R * 0.42 + 18, { colour: "rgba(200,215,235,0.7)" });
      drawSun(ctx, c, cy, 8);
      drawClock(ctx, w, stage, t);
      return;
    }
    if (mode === "rocky") {
      /* Embryos merge: the count falls from many to four. */
      const n = Math.max(4, Math.round(data.planetesimals.length * (1 - u) ** 2.2));
      const inner = data.planetesimals.filter((p) => p.r < 0.32).slice(0, n);
      inner.forEach((p, i) => {
        const a = spinOf(p, 2.2);
        const size = 1.2 + (data.planetesimals.length / Math.max(n, 1)) ** 0.33 * 0.9;
        dot(ctx, c + Math.cos(a) * p.r * R * 1.3, cy + Math.sin(a) * p.r * R * 0.55, size, i % 7 === 0 ? "#ffe08a" : "#c46a3f");
      });
      ctx.strokeStyle = "rgba(217,180,140,0.25)";
      ctx.beginPath();
      ctx.ellipse(c, cy, 0.46 * R, 0.46 * R * 0.42, 0, 0, TAU);
      ctx.stroke();
      dot(ctx, c + 0.46 * R * Math.cos(u * 4), cy + 0.46 * R * 0.42 * Math.sin(u * 4), 7, "#d9b48c");
      if (u > 0.55 && u < 0.8) {
        const flash = 1 - Math.abs(u - 0.67) / 0.13;
        const x = c + R * 0.33;
        const y = cy - R * 0.06;
        ctx.fillStyle = `rgba(255, 230, 160, ${0.7 * flash})`;
        ctx.beginPath();
        ctx.arc(x, y, 6 + 10 * flash, 0, TAU);
        ctx.fill();
        tag(ctx, "the Moon-forming impact", x, y - 22, { colour: "#ffe08a" });
      }
      drawSun(ctx, c, cy, 7);
      drawClock(ctx, w, stage, t);
      return;
    }
    if (mode === "shuffle") {
      /* Four giants drifting outward; icy bodies flung. */
      const giants = [
        { from: 0.34, to: 0.36, size: 7, colour: "#d9b48c", name: "Jupiter" },
        { from: 0.44, to: 0.52, size: 6, colour: "#e3cf9f", name: "Saturn" },
        { from: 0.55, to: 0.74, size: 4.5, colour: "#9fd8df", name: "Uranus" },
        { from: 0.62, to: 0.92, size: 4.5, colour: "#5078d8", name: "Neptune" },
      ];
      data.kuiper.forEach((p, i) => {
        const fling = u * (0.4 + p.s * 1.4);
        const r = (0.72 + 0.2 * p.r) + fling * (i % 3 === 0 ? 0.9 : 0.25);
        const a = spinOf(p, 0.4);
        const x = c + Math.cos(a) * r * R * 0.62;
        const y = cy + Math.sin(a) * r * R * 0.26 * (i % 3 === 0 ? 1 + u * 2 * (p.s - 0.5) : 1);
        ctx.fillStyle = `rgba(159, 184, 255, ${0.55 * (1 - 0.6 * u * (i % 3 === 0 ? 1 : 0))})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      });
      giants.forEach((g, i) => {
        const r = (g.from + (g.to - g.from) * u) * R * 0.95;
        ctx.strokeStyle = "rgba(200,215,235,0.12)";
        ctx.beginPath();
        ctx.ellipse(c, cy, r, r * 0.42, 0, 0, TAU);
        ctx.stroke();
        const a = 0.8 + i * 1.7 + u * (3 - i * 0.5);
        const x = c + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.42;
        dot(ctx, x, y, g.size, g.colour);
        tag(ctx, g.name, x, y - g.size - 9, { colour: g.colour });
      });
      drawSun(ctx, c, cy, 7);
      drawClock(ctx, w, stage, t);
      return;
    }
    // settled
    data.belt.forEach((p) => {
      const a = spinOf(p, 1);
      ctx.fillStyle = "rgba(169, 196, 214, 0.6)";
      ctx.fillRect(c + Math.cos(a) * p.r * R * 0.62, cy + Math.sin(a) * p.r * R * 0.26, 1.3, 1.3);
    });
    data.kuiper.forEach((p) => {
      const a = spinOf(p, 0.3);
      ctx.fillStyle = "rgba(159, 184, 255, 0.45)";
      ctx.fillRect(c + Math.cos(a) * p.r * R, cy + Math.sin(a) * p.r * R * 0.42, 1.3, 1.3);
    });
    [[0.14, "#9d958c"], [0.2, "#e6c992"], [0.26, "#4f86c6"], [0.34, "#c46a3f"], [0.6, "#d9b48c"], [0.7, "#e3cf9f"], [0.78, "#9fd8df"], [0.84, "#5078d8"]].forEach(([r, colour], i) => {
      ctx.strokeStyle = "rgba(200,215,235,0.12)";
      ctx.beginPath();
      ctx.ellipse(c, cy, r * R * (r < 0.5 ? 1.2 : 1), r * R * (r < 0.5 ? 0.5 : 0.42), 0, 0, TAU);
      ctx.stroke();
      const a = 0.6 + i * 0.9 + u * TAU * (1.2 - r);
      dot(ctx, c + Math.cos(a) * r * R * (r < 0.5 ? 1.2 : 1), cy + Math.sin(a) * r * R * (r < 0.5 ? 0.5 : 0.42), r < 0.5 ? 2.6 : 4.2, colour);
    });
    tag(ctx, "asteroid belt", c, cy + 0.55 * R * 0.26 + 14, { colour: "rgba(169,196,214,0.8)" });
    tag(ctx, "Kuiper Belt", c, cy + R * 0.42 + 14, { colour: "rgba(159,184,255,0.8)" });
    drawSun(ctx, c, cy, 7);
    drawClock(ctx, w, stage, t);
  },
  stepsTitle: "How we know — in five steps",
  steps: [
    {
      title: "Meteorites are the clock",
      text: "Uranium in the oldest grains of primitive meteorites decays to lead at a known rate. Measuring both dates those grains to 4,567.30 million years ago, give or take 160,000 years — the moment the Solar System's first solids formed.",
      svg: `${SVG_HEAD}${svgDot(60, 56, 26, "#6b5a4a")}${svgDot(52, 50, 4, "#f0f0f0")}${svgDot(68, 62, 3, "#f0f0f0")}${svgDot(60, 44, 2.5, "#f0f0f0")}${svgText(60, 104, "white grains: the first solids")}</svg>`,
    },
    {
      title: "Discs round other stars",
      text: "Telescopes like ALMA see the same thing happening now: young stars wrapped in flat discs of dust, with dark rings where planets are probably clearing their paths.",
      svg: `${SVG_HEAD}${svgSun()}${svgRing(20, "rgba(255,217,160,0.7)")}${svgRing(30, "rgba(255,217,160,0.35)")}${svgRing(40, "rgba(159,208,255,0.6)")}${svgText(60, 112, "rings and gaps in a young disc")}</svg>`,
    },
    {
      title: "Two families of meteorite",
      text: "Meteorites split into two chemical groups that never mixed — inner and outer. The simplest reading is that young Jupiter grew fast enough, within about a million years, to wall the two parts of the disc off from each other.",
      svg: "",
    },
    {
      title: "The Moon's story",
      text: "Moon rocks brought back by Apollo match Earth's oxygen almost exactly, and the Moon has little iron. Both fit a giant collision with a Mars-sized body that threw out mostly rocky mantle, which gathered into the Moon.",
      svg: "",
    },
    {
      title: "What is drawn",
      text: "Diagrams, not to scale: the numbers of grains, the sizes and the colours are chosen to be read. The dates on the bar are the measured ones; how the giant planets moved is the leading model, not a certainty.",
      svg: "",
    },
  ],
  members: [
    { name: "Arrokoth", note: "An untouched building block from the outer disc — New Horizons, 2019", swatch: "#c67a58" },
    { name: "Vesta", note: "A surviving inner embryo that melted and layered", swatch: "#d9a0ff" },
    { name: "Moon", note: "Made in the last giant collision", swatch: "#c8c8c8" },
  ],
  source: "Connelly et al. 2012 (Science 338, 651) for t = 0; Kruijer et al. 2017 (PNAS 114, 6712) for Jupiter's early core; Dauphas & Pourmand 2011 (Nature 473, 489) for Mars; Wang et al. 2017 (Science 355, 623) for the gas disc's end; Nesvorný 2018 (ARA&A 56, 137) for the giant planets' instability; Wilde et al. 2001 (Nature 409, 175) for the oldest zircons.",
};

export const FORMATION_TOPICS = Object.freeze({ formation });

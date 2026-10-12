import { TAU, DEG, drawSun, ring, dot, tag, SVG_HEAD, svgSun, svgRing, svgDot, svgText, svgLine } from "./common.js";

/**
 * Three things the scene's cards used to state, shown moving instead:
 * tidal locking and the Io-Europa-Ganymede 1:2:4 resonance. (Seasons moved
 * to the planned space events in round 38.)
 * Each picture is to the real ratios of what it is about (periods, angles);
 * sizes are for legibility.
 */

/* ------------------------------------------------------- tidal locking */

function drawMoonFace(ctx, x, y, r, faceAngle) {
  // The disc, with a marked "near-side" crater pattern facing `faceAngle`.
  dot(ctx, x, y, r, "#cfcfcf");
  ctx.fillStyle = "rgba(60, 64, 72, 0.55)";
  const fx = x + Math.cos(faceAngle) * r * 0.45;
  const fy = y - Math.sin(faceAngle) * r * 0.45;
  ctx.beginPath();
  ctx.arc(fx, fy, r * 0.32, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(fx + Math.cos(faceAngle + 1.6) * r * 0.25, fy - Math.sin(faceAngle + 1.6) * r * 0.25, r * 0.16, 0, TAU);
  ctx.fill();
  // The marker: a short line from the centre through the face.
  ctx.strokeStyle = "#ffb060";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(faceAngle) * r * 1.5, y - Math.sin(faceAngle) * r * 1.5);
  ctx.stroke();
}

const tidalLocking = {
  key: "tidal-locking",
  aria: "Tidal locking",
  eyebrow: "Why we only ever see one side of the Moon",
  title: "Tidal locking",
  count: "The Moon turns once for every orbit: 27.3 days for both · every large moon in the Solar System does the same",
  lapSeconds: 6,
  modes: [
    { key: "locked", label: "1 · As it is", sub: "One turn per orbit" },
    { key: "compare", label: "2 · Side by side", sub: "Locked vs not turning" },
  ],
  legend: [{ colour: "#4f86c6", text: "Earth" }, { colour: "#cfcfcf", text: "Moon" }, { colour: "#ffb060", text: "The Moon's near side", line: true }],
  caption: (mode) => mode === "locked"
    ? "The orange mark is the middle of the Moon's near side. As the Moon goes once round Earth it also turns once on its own axis, so the mark always points at Earth — and from Earth we always see the same face."
    : "Left: the real Moon, turning once per orbit, always facing Earth. Right: a Moon that does not turn at all — its mark keeps pointing the same way in space, and Earth would see every side of it in turn. The real Moon does turn; that is the surprising part.",
  draw(ctx, w, t, mode) {
    const orbit = (cx, cy, R, locked) => {
      ring(ctx, cx, cy, R, "rgba(200,215,235,0.25)");
      dot(ctx, cx, cy, R * 0.18, "#4f86c6");
      const a = t * TAU;
      const mx = cx + Math.cos(a) * R;
      const my = cy - Math.sin(a) * R;
      const face = locked ? a + Math.PI : Math.PI;
      drawMoonFace(ctx, mx, my, R * 0.11, face);
      if (locked) {
        ctx.strokeStyle = "rgba(255,176,96,0.35)";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    if (mode === "locked") {
      orbit(w / 2, w / 2, w * 0.34, true);
      tag(ctx, "Earth", w / 2, w / 2 + w * 0.34 * 0.18 + 12);
      // Tidal bulges on Earth pointing at the Moon (exaggerated).
      const a = t * TAU;
      ctx.strokeStyle = "rgba(127, 216, 255, 0.7)";
      ctx.beginPath();
      ctx.ellipse(w / 2, w / 2, w * 0.34 * 0.24, w * 0.34 * 0.19, -a, 0, TAU);
      ctx.stroke();
      tag(ctx, "Earth's tidal bulge (exaggerated)", w / 2, w * 0.9, { colour: "#9fe6ff" });
    } else {
      orbit(w * 0.27, w / 2, w * 0.2, true);
      orbit(w * 0.73, w / 2, w * 0.2, false);
      tag(ctx, "Locked: always the same face", w * 0.27, w * 0.2);
      tag(ctx, "Not turning: every face in turn", w * 0.73, w * 0.2);
    }
  },
  stepsTitle: "How a moon gets locked — in four steps",
  steps: [
    { title: "One turn per orbit", text: "The Moon takes 27.3 days to go round Earth and exactly the same 27.3 days to turn once on its axis. Because the two match, the same half always faces us. We had never seen the far side until a Soviet probe, Luna 3, photographed it in 1959.", svg: `${SVG_HEAD}${svgRing(36)}${svgDot(60, 60, 8, "#4f86c6")}${[0, 90, 180, 270].map((d) => { const a = d * DEG; const x = 60 + Math.cos(a) * 36; const y = 60 - Math.sin(a) * 36; return `${svgDot(x, y, 5, "#cfcfcf")}${svgLine(x.toFixed(1), y.toFixed(1), (x - Math.cos(a) * 9).toFixed(1), (y + Math.sin(a) * 9).toFixed(1), "#ffb060", { width: 1.6 })}`; }).join("")}${svgText(60, 112, "the mark always faces Earth")}</svg>` },
    { title: "Tides stretch it", text: "Earth's gravity pulls harder on the Moon's near side than its far side, stretching it slightly into an egg shape along the line to Earth. The Moon does the same to Earth's oceans — and to Earth's rock.", svg: `${SVG_HEAD}${svgDot(30, 60, 12, "#4f86c6")}<ellipse cx="88" cy="60" rx="13" ry="10" fill="#cfcfcf"/>${svgLine(44, 60, 72, 60, "rgba(255,176,96,0.6)", { dash: "2 2" })}${svgText(60, 100, "stretched along the line")}</svg>` },
    { title: "Friction does the rest", text: "If a young moon spins faster than it orbits, its bulge is carried ahead of the line to the planet, and the planet's pull on that bulge acts as a brake. Over millions of years the spin slows until the bulge stays put: one turn per orbit. Then there is no more braking — it is locked.", svg: "" },
    { title: "Who else is locked", text: "Almost every large moon: Io, Europa, Ganymede and Callisto all keep one face to Jupiter, Titan to Saturn. Pluto and Charon have gone further — each is locked to the other, so Charon hangs still in Pluto's sky. And Earth is slowly being braked by the Moon too: our day lengthens by about 2 milliseconds a century.", svg: "" },
  ],
  members: [
    { name: "Moon", note: "Always the same face to Earth", swatch: "#cfcfcf" },
    { name: "Io", note: "Locked to Jupiter", swatch: "#e8d16a" },
    { name: "Charon", note: "Locked to Pluto — and Pluto to it", swatch: "#b9b2a6" },
    { name: "Pluto", note: "Locked to Charon", swatch: "#d2b597" },
  ],
  source: "Periods: the Moon's sidereal month and rotation, 27.32 days. Day lengthening: about 2.3 ms per century from tidal braking (Stephenson et al. 2016, historical eclipses).",
};

/* ----------------------------------------------- the Laplace resonance */

/* Sidereal periods, days (JPL). */
const IO = 1.769138;
const EUROPA = 3.551181;
const GANYMEDE = 7.154553;

const laplace = {
  key: "laplace",
  aria: "The 1:2:4 resonance of Io, Europa and Ganymede",
  eyebrow: "Three moons in step",
  title: "Io, Europa, Ganymede · 1 : 2 : 4",
  count: "For every orbit of Ganymede, Europa makes two and Io four — and the three are never all lined up on the same side",
  lapSeconds: 7,
  modes: [
    { key: "orbits", label: "1 · Watch them", sub: "Conjunctions flash" },
    { key: "counter", label: "2 · Count the laps", sub: "4 : 2 : 1" },
  ],
  legend: [{ colour: "#e8d16a", text: "Io" }, { colour: "#c9b9a0", text: "Europa" }, { colour: "#b9b2a6", text: "Ganymede" }, { colour: "#ff8ad8", text: "A pair lining up", line: true }],
  caption: (mode) => mode === "orbits"
    ? "Real periods — 1.77, 3.55 and 7.15 days — with one orbit of Ganymede every 7 seconds. A line flashes whenever two of them line up on the same side of Jupiter. Io and Europa always line up on one side, Europa and Ganymede on another: the three are never together."
    : "Each time Ganymede goes round once, Europa goes round twice and Io four times. The lap counters keep that ratio for ever, and the resonance angle λIo − 3λEuropa + 2λGanymede stays at 180° — the reason a triple line-up can never happen.",
  draw(ctx, w, t, mode) {
    const c = w / 2;
    const R = w * 0.42;
    const r = { io: R * 0.38, eu: R * 0.6, ga: R * 0.96 };
    ring(ctx, c, c, r.io, "rgba(232,209,106,0.35)");
    ring(ctx, c, c, r.eu, "rgba(201,185,160,0.35)");
    ring(ctx, c, c, r.ga, "rgba(185,178,166,0.35)");
    const days = t * GANYMEDE;
    /* Phases chosen so the resonance angle is exactly 180 degrees:
     * lambda_I - 3 lambda_E + 2 lambda_G = 180 at day 0. */
    const lG = TAU * (days / GANYMEDE);
    const lE = TAU * (days / EUROPA) + 0.6;
    const lI = Math.PI + 3 * 0.6 + TAU * (days / IO);
    const pos = (l, rr) => [c + Math.cos(l) * rr, c - Math.sin(l) * rr];
    const near = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI) < 6 * DEG;
    const pairs = [[lI, lE, r.io, r.eu], [lE, lG, r.eu, r.ga], [lI, lG, r.io, r.ga]];
    pairs.forEach(([a, b, ra, rb]) => {
      if (!near(a, b)) return;
      const [x1, y1] = pos(a, ra);
      const [x2, y2] = pos(b, rb);
      ctx.strokeStyle = "rgba(255, 138, 216, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x1, y1, 7, 0, TAU);
      ctx.stroke();
    });
    dot(ctx, c, c, R * 0.16, "#d9b48c");
    tag(ctx, "Jupiter", c, c + R * 0.16 + 12);
    const draw1 = (l, rr, colour, name) => {
      const [x, y] = pos(l, rr);
      dot(ctx, x, y, 5, colour);
      tag(ctx, name, x, y - 13, { size: w });
    };
    draw1(lI, r.io, "#e8d16a", "Io");
    draw1(lE, r.eu, "#c9b9a0", "Europa");
    draw1(lG, r.ga, "#b9b2a6", "Ganymede");
    if (mode === "counter") {
      const laps = (p) => Math.floor(days / p);
      tag(ctx, `Io ${laps(IO)} laps`, 12, 18, { align: "left", colour: "#e8d16a", font: "700 12px ui-sans-serif, system-ui, sans-serif" });
      tag(ctx, `Europa ${laps(EUROPA)}`, 12, 38, { align: "left", colour: "#c9b9a0", font: "700 12px ui-sans-serif, system-ui, sans-serif" });
      tag(ctx, `Ganymede ${laps(GANYMEDE)}`, 12, 58, { align: "left", colour: "#b9b2a6", font: "700 12px ui-sans-serif, system-ui, sans-serif" });
      const angle = ((((lI - 3 * lE + 2 * lG) / DEG) % 360) + 360) % 360;
      tag(ctx, `λIo − 3λEuropa + 2λGanymede = ${angle.toFixed(0)}°`, w - 12, w - 16, { align: "right", colour: "#ff8ad8" });
    }
  },
  stepsTitle: "A cosmic clockwork — in four steps",
  steps: [
    { title: "Four, two, one", text: "Io goes round Jupiter in 1.77 days, Europa in 3.55 and Ganymede in 7.15: almost exactly 1 : 2 : 4. Pierre-Simon Laplace showed in the 1780s that this is no accident, and the arrangement carries his name.", svg: `${SVG_HEAD}${svgDot(60, 60, 8, "#d9b48c")}${svgRing(18, "rgba(232,209,106,0.6)")}${svgRing(30, "rgba(201,185,160,0.6)")}${svgRing(46, "rgba(185,178,166,0.6)")}${svgText(60, 112, "4 laps · 2 laps · 1 lap")}</svg>` },
    { title: "Regular nudges", text: "Because the timing repeats, Io and Europa always meet at the same points in their orbits, and so do Europa and Ganymede. Each meeting gives a small tug in the same place, and the tugs add up instead of cancelling, holding the orbits slightly oval.", svg: "" },
    { title: "Never all three", text: "The three can never line up on one side of Jupiter together: the combination λIo − 3λEuropa + 2λGanymede stays locked at 180°. When Io and Europa line up, Ganymede is always somewhere else.", svg: "" },
    { title: "Why Io has volcanoes", text: "Those slightly oval orbits are the point. Io's distance from Jupiter changes through each orbit, so Jupiter squeezes and relaxes it like a stress ball — about 100 metres of rise and fall in its solid surface. That flexing heats its interior and makes it the most volcanic world in the Solar System, and keeps Europa's ocean liquid.", svg: "" },
  ],
  members: [
    { name: "Io", note: "4 laps · the most volcanic world", swatch: "#e8d16a" },
    { name: "Europa", note: "2 laps · an ocean under ice", swatch: "#c9b9a0" },
    { name: "Ganymede", note: "1 lap · the largest moon", swatch: "#b9b2a6" },
    { name: "Jupiter", note: "The planet at the centre", swatch: "#d9b48c" },
  ],
  source: "Periods: JPL planetary satellite mean elements (sidereal, days). Resonance: Laplace (1780s); the tidal flexing of Io's surface, about 100 m, from Peale, Cassen & Reynolds (1979), who predicted Io's volcanoes just before Voyager 1 saw them.",
};

/* Round 38: "Why there are seasons" moved to the planned space events
 * (Prompts.md); its first version is kept in
 * docs/archive/space-events-coming-soon/explainer-seasons.js. */

export const MECHANISM_TOPICS = Object.freeze({
  "tidal-locking": tidalLocking,
  laplace,
});

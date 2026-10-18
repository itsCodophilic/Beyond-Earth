/*
 * Archived in round 84 (Prompts.md: "since we have added this event we can
 * remove the Io:Europa item from dashboard"): the dashboard explainer for
 * the Io-Europa-Ganymede 1:2:4 resonance. The space event "The 1:2:4 dance"
 * now shows it on the real moons. To restore: put this file back as
 * src/js/ui/explainers/mechanisms.js and the "laplace" card back in
 * src/js/ui/celestialBoardData.js (key laplace, filters [moons], region giants,
 * art resonance).
 */
import { TAU, DEG, drawSun, ring, dot, tag, SVG_HEAD, svgSun, svgRing, svgDot, svgText, svgLine } from "./common.js";

/**
 * Things the scene's cards used to state, shown moving instead: the
 * Io-Europa-Ganymede 1:2:4 resonance. (Seasons moved to the planned space
 * events in round 38; tidal locking in round 84, now the space event "Why
 * we see one face" -- archived in
 * docs/archive/space-events-coming-soon/explainer-tidal-locking.js.)
 * Each picture is to the real ratios of what it is about (periods, angles);
 * sizes are for legibility.
 */


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
  laplace,
});

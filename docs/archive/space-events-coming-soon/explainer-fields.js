import { MAGNETOSPHERES } from "../../graphics/magnetospheres.js";
import { TAU, DEG, drawSun, ring, dot, tag, arrow, SVG_HEAD, svgSun, svgRing, svgDot, svgText, svgArrowDefs, svgLine } from "./common.js";

/**
 * Two invisible things that shape everything near them: the magnetic
 * bubbles round the planets, and the wind they shelter from.
 *
 * The magnetosphere diagrams here are cross-sections through the
 * noon-midnight plane, Sun to the left, to scale in each body's own radii
 * (MAGNETOSPHERES, magnetospheres.js: the same numbers the scene draws).
 * The solar-wind picture is the heliosphere on a stretched scale, with the
 * Voyagers' measured crossings marked.
 */

export const MAGNETOSPHERE_TEXT = Object.freeze({
  Mercury: { colour: "#9d958c", text: "Mercury's field is weak — about 1% of Earth's — and the Sun's wind is strong this close in, so its magnetosphere is tiny: the wall is only about 1.45 Mercury radii from the centre, a few hundred kilometres above the ground, and on a gusty day the wind reaches the surface itself. That is why its aurora is on the ground." },
  Earth: { colour: "#4f86c6", text: "Earth's field holds the solar wind off about 10 Earth radii out on the day side, and drags out a tail hundreds of radii long on the night side — far past the Moon. Two belts of trapped radiation, the Van Allen belts, ring the planet. Storms in the wind snap field lines in the tail, and the particles they fling home light the aurora round both poles." },
  Jupiter: { colour: "#d9b48c", text: "The largest structure in the Solar System after the heliosphere itself. On the day side its wall stands 45 to 100 Jupiter radii out, depending on the wind; on the night side the tail reaches past Saturn's orbit. Seen from Earth it would look several times the size of the full Moon. Io feeds it a ton of sulfur and oxygen a second, which spreads into a glowing torus along Io's orbit, and its radiation belts are the harshest anywhere." },
  Saturn: { colour: "#e3cf9f", text: "Saturn's wall is about 22 Saturn radii out — usually just outside Titan's orbit, so Titan spends part of each orbit outside the bubble in the raw solar wind. Its magnetic axis is lined up with its spin axis to within a few hundredths of a degree, which no theory of planetary fields predicts. Enceladus's geysers feed a ring of plasma along its orbit." },
  Uranus: { colour: "#9fd8df", text: "Uranus's magnetic axis is tipped 59° from its spin axis and its centre is a third of a radius off the planet's, so as Uranus turns its whole magnetosphere wobbles and the tail twists into a corkscrew. Voyager 2 is the only spacecraft to have measured it, in 1986." },
  Neptune: { colour: "#5078d8", text: "Neptune's field is tilted 47° and offset more than half a radius from the centre — the strangest of all — so the cusps where the wind can reach the atmosphere swing round the planet as it turns. Triton orbits well inside the bubble, at about 14 Neptune radii." },
  Ganymede: { colour: "#b9b2a6", text: "The only moon with its own magnetic field — a little bubble about two Ganymede radii across, inside Jupiter's much bigger one. Jupiter's plasma flows past slower than its own waves can travel, so there is no bow shock: instead the field bends into two 'wings'. Its two auroral rings rock as Jupiter's field sweeps by, less than they would without a salty ocean under the ice." },
});

const point = { x: 0, y: 0 };

function shueRadius(r0, theta) {
  return r0 * Math.sqrt(2 / (1 + Math.cos(theta)));
}

function drawMagnetosphere(ctx, w, t, name) {
  const spec = MAGNETOSPHERES[name];
  const upstream = (spec.bs || spec.mp) * 1.7;
  const downstream = Math.min(spec.tail, (spec.bs || spec.mp) * 3.2);
  const span = upstream + downstream;
  const s = (w * 0.94) / span;
  const cx = w * 0.03 + upstream * s;
  const cy = w / 2;
  const X = (x) => cx + x * s;
  const Y = (y) => cy - y * s;

  // The solar wind (or Jupiter's plasma), streaming in from the left and
  // deflected round the wall.
  for (let k = 0; k < 26; k += 1) {
    const yy = ((k / 25) - 0.5) * 2 * (spec.bs || spec.mp) * 1.7;
    const phase = ((t * 3 + k * 0.137) % 1);
    const x = -upstream + phase * span;
    let y = yy;
    const r = Math.hypot(x, y);
    const theta = Math.atan2(Math.abs(y), -x);
    const wall = shueRadius(spec.mp, Math.min(theta, 150 * DEG)) * 1.06;
    if (r < wall && x > -spec.mp * 1.3) y = Math.sign(y || 1) * Math.sqrt(Math.max(0, wall * wall - x * x));
    if (Math.abs(x) < downstream) dot(ctx, X(x), Y(y), 1.4, name === "Ganymede" ? "rgba(217,180,140,0.8)" : "rgba(255,226,168,0.8)");
  }
  // Bow shock.
  if (spec.bs > 0) {
    const e = 0.8;
    const L = spec.bs * (1 + e);
    ctx.strokeStyle = "rgba(255, 210, 160, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = -60; k <= 60; k += 1) {
      const th = (k / 60) * 128 * DEG;
      const r = L / (1 + e * Math.cos(th));
      const x = -r * Math.cos(th);
      const y = r * Math.sin(th);
      if (k === -60) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();
    tag(ctx, "Bow shock", X(-spec.bs) - 4, Y(spec.bs * 0.85), { align: "right", size: w, colour: "#ffd8a8" });
  }
  // Magnetopause and tail.
  ctx.strokeStyle = "rgba(127, 216, 255, 0.95)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let k = -60; k <= 60; k += 1) {
    const th = (k / 60) * 150 * DEG;
    const r = shueRadius(spec.mp, Math.abs(th));
    const x = -r * Math.cos(th);
    const y = r * Math.sin(th);
    if (k === -60) ctx.moveTo(X(downstream), Y(y * 1.06)), ctx.lineTo(X(x), Y(y));
    else ctx.lineTo(X(x), Y(y));
  }
  const yEnd = shueRadius(spec.mp, 150 * DEG) * Math.sin(150 * DEG);
  ctx.lineTo(X(downstream), Y(yEnd * 1.06));
  ctx.stroke();
  tag(ctx, name === "Ganymede" ? "Magnetopause (no bow shock)" : "Magnetopause", X(-spec.mp * 0.62), Y(spec.mp * 0.98), { align: "left", size: w, colour: "#9fe6ff" });
  tag(ctx, "Magnetotail →", X(downstream * 0.7), Y(-yEnd * 1.32), { size: w, colour: "#9fe6ff" });

  // Field lines: a tilted dipole, squashed by day, dragged out by night.
  const tilt = spec.tiltDeg * DEG + Math.sin(t * TAU * 0.25) * (spec.tiltDeg > 30 ? 0.35 : 0.05);
  const ox = spec.offset?.[0] ?? 0;
  const oy = spec.offset?.[1] ?? 0;
  ctx.strokeStyle = "rgba(159, 220, 255, 0.45)";
  ctx.lineWidth = 1;
  spec.lines.forEach((L) => {
    [1, -1].forEach((side) => {
      ctx.beginPath();
      const latMax = Math.acos(Math.min(1, Math.sqrt(1 / L)));
      for (let k = 0; k <= 60; k += 1) {
        const lat = -latMax + (2 * latMax * k) / 60;
        const r = L * Math.cos(lat) ** 2;
        let x = side * r * Math.cos(lat);
        let y = r * Math.sin(lat);
        // Tilt about the centre, then offset.
        const xr = x * Math.cos(tilt) - y * Math.sin(tilt) + ox;
        const yr = x * Math.sin(tilt) + y * Math.cos(tilt) + oy;
        x = xr; y = yr;
        if (x > 0) x *= 1 + (L > spec.mp * 0.35 ? 2.4 : 0.6) * Math.min(1, x / Math.max(1, L));
        else {
          const lim = shueRadius(spec.mp, Math.atan2(Math.abs(y), -x)) * 0.97;
          const rr = Math.hypot(x, y);
          if (rr > lim) { x *= lim / rr; y *= lim / rr; }
        }
        if (k === 0) ctx.moveTo(X(x), Y(y)); else ctx.lineTo(X(x), Y(y));
      }
      ctx.stroke();
    });
  });
  // Belts and tori, in the magnetic equator.
  [...spec.belts, ...spec.tori.map((q) => ({ from: q.at - q.width / 2, to: q.at + q.width / 2, colour: q.colour, label: q.label, at: q.at }))].forEach((b, i) => {
    ctx.fillStyle = `#${b.colour.toString(16).padStart(6, "0")}55`;
    [-1, 1].forEach((side) => {
      const mid = (b.from + b.to) / 2;
      const x = side * mid * Math.cos(tilt) + ox;
      const y = side * mid * Math.sin(tilt) + oy;
      ctx.beginPath();
      ctx.ellipse(X(x), Y(y), ((b.to - b.from) / 2) * s, ((b.to - b.from) / 2.6) * s, -tilt, 0, TAU);
      ctx.fill();
    });
    /* Labels stacked under the planet, each with a short leader to its
     * blob, so small belts round a small planet do not pile up. */
    const lx = X((b.from + b.to) / 2 * Math.cos(tilt) + ox);
    const ly = Y((b.from + b.to) / 2 * Math.sin(tilt) + oy);
    const ty = Y(0) + Math.max(26, s * 1.6) + i * 18;
    ctx.strokeStyle = "rgba(226, 198, 255, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ty - 6);
    ctx.stroke();
    tag(ctx, b.at ? `${b.label} · at ${b.at} radii` : `${b.label} · ${b.from}-${b.to} radii`, lx, ty, { size: w, colour: "#e2c6ff" });
  });
  // The body, and its aurora where the field lines meet the poles.
  dot(ctx, X(0), Y(0), Math.max(3, s), MAGNETOSPHERE_TEXT[name].colour);
  const pole = (sgn) => [X((ox - Math.sin(tilt) * sgn) * 1), Y((oy + Math.cos(tilt) * sgn) * 1)];
  [1, -1].forEach((sgn) => {
    const [px, py] = pole(sgn);
    dot(ctx, px, py, Math.max(2, s * 0.25), "rgba(140, 255, 190, 0.85)");
  });
  tag(ctx, "aurora at the poles", X(0), Y(0) - Math.max(18, s * 1.8), { size: w, colour: "#9ff0b8" });
  // Scale bar.
  const bar = Math.pow(10, Math.floor(Math.log10(span / 4)));
  ctx.strokeStyle = "rgba(230,236,246,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, w - 18);
  ctx.lineTo(14 + bar * s, w - 18);
  ctx.stroke();
  tag(ctx, `${bar} ${name} radii`, 14, w - 30, { align: "left", size: w });
  tag(ctx, name === "Ganymede" ? "Jupiter's plasma →" : "Solar wind →", 14, 18, { align: "left", size: w, colour: "#ffe2a8" });
}

const ORDER = ["Earth", "Jupiter", "Saturn", "Uranus", "Neptune", "Mercury", "Ganymede"];

const magnetospheres = {
  key: "magnetospheres",
  aria: "Magnetospheres",
  eyebrow: "Shields made of magnetism",
  title: "Magnetospheres",
  count: "Seven bodies make their own: Mercury, Earth, Jupiter, Saturn, Uranus, Neptune — and one moon, Ganymede",
  lapSeconds: 10,
  modesLabel: "Choose a body",
  modes: ORDER.map((name) => ({ key: name, label: name, sub: `${MAGNETOSPHERES[name].mp} radii to the wall` })),
  legend: [
    { colour: "#ffd2a0", text: "Bow shock" },
    { colour: "#7fd8ff", text: "Magnetopause & tail" },
    { colour: "#9fdcff", text: "Field lines" },
    { colour: "#c77dff", text: "Belts & tori" },
    { colour: "#9ff0b8", text: "Aurora" },
  ],
  caption: (mode) => `${mode}: ${MAGNETOSPHERE_TEXT[mode].text}`,
  draw(ctx, w, t, mode) { drawMagnetosphere(ctx, w, t, mode); },
  stepsTitle: "How a planet hides from the wind — in five steps",
  steps: [
    {
      title: "The Sun never stops blowing",
      text: "The solar wind — charged particles boiling off the Sun at 400 to 750 km/s — fills the whole Solar System. Without a shield it would strip a planet's air, slowly, over billions of years. Mars, which lost its field, lost most of its atmosphere.",
      svg: `${SVG_HEAD}${svgArrowDefs("cexpWind", "#ffe2a8")}${svgSun(16, 60, 8)}${[30, 45, 60, 75, 90].map((y) => svgLine(32, y, 104, y, "#ffe2a8", { marker: "cexpWind", width: 1 })).join("")}${svgText(60, 112, "400-750 km/s, always")}</svg>`,
    },
    {
      title: "A magnetic field pushes back",
      text: "A planet with a molten, churning, electrically conducting core — iron in Earth's, metallic hydrogen in Jupiter's — makes a magnetic field. The wind cannot cross field lines easily, so it is held off, and flows round: the magnetopause is where the two pressures balance.",
      svg: `${SVG_HEAD}${svgDot(64, 60, 7, "#4f86c6")}<path d="M 112 22 Q 40 22 40 60 Q 40 98 112 98" fill="none" stroke="#7fd8ff" stroke-width="1.4"/>${svgText(30, 112, "wall")}</svg>`,
    },
    {
      title: "A shock, upstream",
      text: "The wind is moving faster than its own pressure waves, so it cannot ease round the obstacle — it slams into a standing shock in front of it first, slows and heats, like the water in front of a ship's bow. That is the bow shock.",
      svg: `${SVG_HEAD}${svgDot(70, 60, 6, "#4f86c6")}<path d="M 112 26 Q 50 26 50 60 Q 50 94 112 94" fill="none" stroke="#7fd8ff" stroke-width="1.2"/><path d="M 112 10 Q 26 12 26 60 Q 26 108 112 110" fill="none" stroke="#ffd2a0" stroke-width="1.4"/></svg>`,
    },
    {
      title: "A tail, and the aurora",
      text: "Downwind, the wind drags the field out into a tail hundreds of planet radii long. When a gust snaps and rejoins field lines there, particles are fired back along them into the atmosphere near the poles — and it glows. Every aurora in this scene starts in a magnetosphere.",
      svg: `${SVG_HEAD}${svgDot(40, 60, 6, "#4f86c6")}<path d="M 6 30 Q 30 30 40 54 M 6 90 Q 30 90 40 66" fill="none" stroke="#9fdcff"/><path d="M 40 54 Q 70 30 116 40 M 40 66 Q 70 90 116 80" fill="none" stroke="#9fdcff"/>${svgDot(40, 53, 2, "#9ff0b8")}${svgDot(40, 67, 2, "#9ff0b8")}</svg>`,
    },
    {
      title: "Trapped radiation",
      text: "Some particles get caught inside, bouncing from pole to pole along the field lines: the radiation belts. Earth's two Van Allen belts were the first discovery of the space age (Explorer 1, 1958). Jupiter's are so intense that spacecraft there are built like bank vaults.",
      svg: `${SVG_HEAD}${svgDot(60, 60, 8, "#4f86c6")}<ellipse cx="60" cy="60" rx="22" ry="11" fill="none" stroke="#ff8ad8" stroke-width="5" opacity="0.6"/><ellipse cx="60" cy="60" rx="40" ry="18" fill="none" stroke="#c77dff" stroke-width="9" opacity="0.4"/></svg>`,
    },
  ],
  membersTitle: "See one round its planet",
  members: ORDER.map((name) => ({
    name,
    label: name,
    travel: false,
    swatch: MAGNETOSPHERE_TEXT[name].colour,
    note: `Fly there and show its magnetosphere · wall at ${MAGNETOSPHERES[name].mp} radii`,
    sceneAction: { magnetosphere: name, travel: name },
  })),
  source: "Sizes in each body's own radii: Mercury, Winslow et al. 2013 (MESSENGER); Earth, standard averages; Jupiter, Joy et al. 2002; Saturn, Achilleos et al. 2008; Uranus and Neptune, Voyager 2 (Ness et al. 1986, 1989); Ganymede, Kivelson et al. 1996 (Galileo). Magnetopause shape after Shue et al. 1997. In the scene, distances go through the same curve as each planet's moons, so the diagram and the moons agree.",
};

/* --------------------------------------------------------- solar wind */

/* A repeatable scatter in [0, 1). */
function hash(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function logR(rAU, R) {
  return R * Math.max(0, Math.log10(Math.max(rAU, 0.02) / 0.02) / Math.log10(260 / 0.02));
}

const VOYAGER_CROSSINGS = [
  { name: "Voyager 1", colour: "#9ff0dc", lonDeg: 255, ts: 94, hp: 121.6 },
  { name: "Voyager 2", colour: "#8ad6ff", lonDeg: 290, ts: 84, hp: 119 },
];

const solarWind = {
  key: "solar-wind",
  aria: "The solar wind and the heliosphere",
  eyebrow: "The Sun's own weather, out to where it stops",
  title: "The solar wind",
  count: "400-750 km/s · about a million tonnes a second · out to the termination shock (~85-94 AU), the heliosheath, and the heliopause (~120 AU)",
  lapSeconds: 6,
  modes: [
    { key: "inner", label: "1 · Near the Sun", sub: "The Parker spiral" },
    { key: "outer", label: "2 · Out to the edge", sub: "Shock, sheath, heliopause" },
  ],
  legend: (mode) => mode === "inner"
    ? [{ colour: "#ffe2a8", text: "Solar wind" }, { colour: "#ffd38a", text: "Magnetic field, wound into a spiral", line: true }, { colour: "#4f86c6", text: "Earth's orbit" }]
    : [{ colour: "#ffe2a8", text: "Solar wind" }, { colour: "#ff8c52", text: "Heliosheath (slowed, hot)" }, { colour: "#d8ec86", text: "Termination shock", line: true }, { colour: "#ffb877", text: "Heliopause", line: true }, { colour: "#9ff0dc", text: "Voyagers' crossings" }],
  caption: (mode) => mode === "inner"
    ? "The wind blows straight out from the Sun, but the Sun turns once every 25 days, so the magnetic field the wind carries is wound into a spiral — like water from a turning garden sprinkler. At Earth the field lines cross our orbit at about 45°."
    : "Far out, the wind runs into the thin gas between the stars. At the termination shock it suddenly slows; in the heliosheath it piles up, heats and turns back down the tail; at the heliopause it stops. Distances on a stretched scale; the Voyagers' crossings are marked where they really happened.",
  draw(ctx, w, t, mode) {
    const c = w / 2;
    if (mode === "inner") {
      const scale = (w * 0.46) / 5.6;
      ring(ctx, c, c, 1 * scale, "rgba(79,134,198,0.7)");
      ring(ctx, c, c, 5.2 * scale, "rgba(217,180,140,0.35)");
      ring(ctx, c, c, 1.52 * scale, "rgba(196,106,63,0.35)");
      const spin = t * TAU * (6 / 25.38) * 0.4;
      ctx.strokeStyle = "rgba(255, 211, 138, 0.55)";
      ctx.lineWidth = 1.1;
      for (let a = 0; a < 8; a += 1) {
        ctx.beginPath();
        for (let k = 0; k <= 200; k += 1) {
          const r = 0.03 + (5.6 * k) / 200;
          const phi = (a / 8) * TAU + spin - 1.0715 * r;
          const x = c + Math.cos(phi) * r * scale;
          const y = c - Math.sin(phi) * r * scale;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      for (let k = 0; k < 220; k += 1) {
        const ang = hash(k) * TAU;
        const r = ((t * 0.9 + hash(k + 999)) % 1) * 5.6;
        dot(ctx, c + Math.cos(ang) * r * scale, c - Math.sin(ang) * r * scale, 1.3, "rgba(255,226,168,0.85)");
      }
      drawSun(ctx, c, c, 6);
      tag(ctx, "Earth's orbit", c, c - scale - 2);
      tag(ctx, "Jupiter's orbit", c, c - 5.2 * scale + 12);
      return;
    }
    const R = w * 0.46;
    const ts = logR(88, R);
    const hp = logR(120, R);
    // The heliosheath: a warm band between the two.
    ctx.fillStyle = "rgba(255, 140, 82, 0.13)";
    ctx.beginPath();
    ctx.arc(c, c, hp, 0, TAU);
    ctx.arc(c, c, ts, 0, TAU, true);
    ctx.fill();
    ring(ctx, c, c, ts, "rgba(216,236,134,0.85)", [5, 4], 1.4);
    ring(ctx, c, c, hp, "rgba(255,184,119,0.9)", [5, 4], 1.6);
    [[1, "1 AU"], [5.2, "5 AU"], [30, "30 AU"]].forEach(([au, label]) => {
      ring(ctx, c, c, logR(au, R), "rgba(200,215,235,0.16)");
      tag(ctx, label, c + logR(au, R), c + 10, { colour: "rgba(200,215,235,0.7)", font: "500 9px ui-sans-serif, system-ui, sans-serif" });
    });
    for (let k = 0; k < 360; k += 1) {
      const ang = hash(k) * TAU;
      const u = (t * 0.55 + hash(k + 777)) % 1;
      let rp;
      let colour = "rgba(255,226,168,0.8)";
      if (u < 0.8) rp = (u / 0.8) * ts;
      else { rp = ts + ((u - 0.8) / 0.2) * (hp - ts); colour = "rgba(255,140,82,0.85)"; }
      dot(ctx, c + Math.cos(ang) * rp, c - Math.sin(ang) * rp, 1.3, colour);
    }
    // The interstellar wind arriving from the direction the Sun is heading.
    for (let k = -3; k <= 3; k += 1) arrow(ctx, w - 8, c + k * 28, hp + c + 10, c + k * 28 * 0.9, "rgba(170, 200, 255, 0.55)", 6, 1.2);
    tag(ctx, "Gas between the stars", w - 70, 22, { size: w, colour: "#b8ccff" });
    VOYAGER_CROSSINGS.forEach((v, i) => {
      const a = v.lonDeg * DEG;
      [ts, hp].forEach((rr, k) => dot(ctx, c + Math.cos(a) * rr, c - Math.sin(a) * rr, 3.4, k ? "#ffffff" : v.colour));
      tag(ctx, `${v.name}: shock ${v.ts} AU, heliopause ${v.hp} AU`, i ? w - 6 : 6, w - 34 + i * 18, { align: i ? "right" : "left", size: w, colour: v.colour });
    });
    drawSun(ctx, c, c, 5);
    /* The three names at three different angles: on this scale the two
     * boundaries are close together. */
    const at = (deg, rr) => [c + Math.cos(deg * DEG) * rr, c - Math.sin(deg * DEG) * rr];
    { const [x, y] = at(150, ts); tag(ctx, "Termination shock →", x + 4, y, { align: "right", size: w, colour: "#d8ec86" }); }
    { const [x, y] = at(115, (ts + hp) / 2); tag(ctx, "Heliosheath", x, y - 10, { size: w, colour: "#ffb08a" }); }
    { const [x, y] = at(90, hp); tag(ctx, "Heliopause", x, y - 12, { size: w, colour: "#ffb877" }); }
  },
  stepsTitle: "The wind, from start to stop — in five steps",
  steps: [
    { title: "Too hot to stay put", text: "The Sun's outer atmosphere, the corona, is over a million degrees — hot enough that it cannot be held down by the Sun's gravity. It boils off in every direction as the solar wind: slow wind (~400 km/s) from near the Sun's equator, fast wind (~750 km/s) from the cooler holes near its poles.", svg: `${SVG_HEAD}${svgSun(60, 60, 14)}${[0, 45, 90, 135, 180, 225, 270, 315].map((d) => { const a = d * DEG; return svgLine((60 + Math.cos(a) * 24).toFixed(1), (60 - Math.sin(a) * 24).toFixed(1), (60 + Math.cos(a) * (d % 180 === 90 ? 54 : 40)).toFixed(1), (60 - Math.sin(a) * (d % 180 === 90 ? 54 : 40)).toFixed(1), "#ffe2a8"); }).join("")}${svgText(60, 112, "fast over the poles", "#cfd8e3", 7)}</svg>` },
    { title: "A spiral, because the Sun turns", text: "Each piece of wind flies straight out, but its source turns with the Sun every 25 days, so the magnetic field it drags along is wound into a spiral, the Parker spiral. Space-weather forecasters use it: a storm launched from the Sun's western side is aimed along it towards Earth.", svg: "" },
    { title: "Shields and tails", text: "Wherever it meets a planet with a magnetic field the wind is held off and flows round — see Magnetospheres. Where it meets a comet it blows the gas out into a straight blue ion tail, always pointing away from the Sun.", svg: "" },
    { title: "The termination shock and the heliosheath", text: "Around 85 to 94 AU the wind meets the gas between the stars and suddenly drops below its own sound speed: the termination shock. Beyond it, in the heliosheath, the slowed wind piles up, heats to around a million kelvin and is swept back down a long tail.", svg: `${SVG_HEAD}${svgSun(60, 60, 4)}${svgRing(30, "rgba(216,236,134,0.8)", 60, 60, "3 3")}${svgRing(42, "rgba(255,184,119,0.8)", 60, 60, "3 3")}<circle cx="60" cy="60" r="36" fill="none" stroke="rgba(255,140,82,0.35)" stroke-width="12"/>${svgText(60, 112, "shock · sheath · heliopause")}</svg>` },
    { title: "The heliopause — where it stops", text: "At about 120 AU the wind's push and the interstellar gas's push balance, and the wind goes no further. Voyager 1 crossed it in 2012 and Voyager 2 in 2018 — the only crossings ever made. It is the edge of the Sun's wind, not of the Solar System: the Oort Cloud is far beyond.", svg: "" },
  ],
  membersTitle: "Fly to",
  members: [
    { name: "Sun", note: "Where the wind starts", swatch: "#ffcf7a" },
    { name: "Parker Solar Probe", note: "Flying through where the wind is born", swatch: "#ffe08a" },
    { name: "Voyager 1", note: "Crossed the heliopause in 2012", swatch: "#9ff0dc" },
    { name: "Voyager 2", note: "Crossed it in 2018, and measured it directly", swatch: "#8ad6ff" },
  ],
  actions: [{ label: "Show the solar wind in the scene", detail: { solarWind: true } }],
  source: "Speeds: Ulysses near solar minimum (McComas et al. 2000). Spiral angle: the Parker model, 1.07 rad per AU at 400 km/s and the Sun's 25.4-day turn. Crossings: NASA/JPL (Voyager 1, termination shock December 2004 at 94 AU, heliopause 25 August 2012 at 121.6 AU; Voyager 2, August 2007 at 84 AU and 5 November 2018 at 119 AU). Directions on this picture are approximate.",
};

export const FIELD_TOPICS = Object.freeze({
  magnetospheres,
  "solar-wind": solarWind,
});

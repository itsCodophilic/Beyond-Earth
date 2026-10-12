import { TAU, DEG, drawSun, ring, dot, tag, SVG_HEAD, svgSun, svgRing, svgDot, svgText, svgLine } from "./common.js";


/* ------------------------------------------------------------- seasons */

const TILTS = { Earth: 23.44, Mars: 25.19, Uranus: 97.77 };
const PERIODS = { Earth: "One Earth year every 10 s", Mars: "One Mars year (687 days) every 10 s", Uranus: "One Uranus year (84 years) every 10 s" };

const seasons = {
  key: "seasons",
  aria: "Why there are seasons",
  eyebrow: "It is the tilt, not the distance",
  title: "Seasons",
  count: "Earth's axis is tipped 23.44° and points the same way in space all year · Mars 25.19° · Uranus 97.77°",
  lapSeconds: 10,
  modes: [
    { key: "Earth", label: "Earth", sub: "23.44°" },
    { key: "Mars", label: "Mars", sub: "25.19°" },
    { key: "Uranus", label: "Uranus", sub: "97.77° — on its side" },
  ],
  legend: [{ colour: "#fff4d6", text: "Sun" }, { colour: "#ffb060", text: "Spin axis (north end)", line: true }, { colour: "#9ff0dc", text: "Where the Sun is overhead" }],
  caption: (mode) => ({
    Earth: "One year in 10 seconds. Earth's axis keeps pointing the same way in space, so for half the year the north is tipped towards the Sun (northern summer) and for half away. The green dot is where the Sun stands straight overhead: it swings from 23.4° north to 23.4° south and back.",
    Mars: "Mars is tilted almost exactly as much as Earth, so it has seasons like ours — twice as long, and made more extreme by its oval orbit. Its polar caps grow and shrink with them.",
    Uranus: "Uranus is tipped right over. For about 21 years at a time one pole faces the Sun in continuous daylight while the other is in a night 21 years long; in between, the Sun rises and sets every 17 hours.",
  })[mode],
  draw(ctx, w, t, mode) {
    const c = w / 2;
    const R = w * 0.32;
    const tilt = TILTS[mode] * DEG;
    // The orbit, seen from a little above.
    ctx.strokeStyle = "rgba(200,215,235,0.3)";
    ctx.beginPath();
    ctx.ellipse(c, c, R, R * 0.42, 0, 0, TAU);
    ctx.stroke();
    drawSun(ctx, c, c, 9);
    const a = t * TAU;
    const px = c + Math.cos(a) * R;
    const py = c + Math.sin(a) * R * 0.42;
    const pr = w * 0.07;
    // The axis keeps one direction in space: tipped towards +x on screen.
    const ax = Math.sin(tilt);
    const ay = -Math.cos(tilt);
    /* Subsolar latitude: delta = asin(sin(tilt) cos(lambda)), lambda the
     * angle between the Sun's direction and the axis's lean (+x here),
     * measured in the orbit plane (screen y un-squashed by 0.42). */
    const declination = (angle) => {
      const qx = c + Math.cos(angle) * R;
      const qz = (Math.sin(angle) * R * 0.42) / 0.42;
      const toSunX = c - qx;
      const len = Math.hypot(toSunX, qz) || 1;
      return Math.asin(Math.sin(tilt) * (toSunX / len)) / DEG;
    };
    const subsolarDeg = declination(a);
    const rising = declination(a + 0.01) > subsolarDeg;
    dot(ctx, px, py, pr, mode === "Earth" ? "#4f86c6" : mode === "Mars" ? "#c46a3f" : "#9fd8df");
    // Night half.
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.beginPath();
    const sunAng = Math.atan2(c - py, c - px);
    ctx.arc(px, py, pr, sunAng + Math.PI / 2, sunAng + Math.PI * 1.5);
    ctx.fill();
    // The axis.
    ctx.strokeStyle = "#ffb060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - ax * pr * 1.6, py - ay * pr * 1.6);
    ctx.lineTo(px + ax * pr * 1.6, py + ay * pr * 1.6);
    ctx.stroke();
    tag(ctx, "N", px + ax * pr * 1.9, py + ay * pr * 1.9, { colour: "#ffb060" });
    // The subsolar point: the dot moves up and down the disc's face.
    const sy = py - Math.sin(subsolarDeg * DEG) * pr * 0.9;
    dot(ctx, px + Math.cos(sunAng) * pr * 0.4, sy, 3.2, "#9ff0dc");
    const opposite = { summer: "winter", winter: "summer", spring: "autumn", autumn: "spring" };
    const north = subsolarDeg > 3 ? "summer" : subsolarDeg < -3 ? "winter" : rising ? "spring" : "autumn";
    const northWord = Math.abs(subsolarDeg) <= 1.5
      ? "Equinox: day and night equal everywhere"
      : `North: ${north} · South: ${opposite[north]}`;
    tag(ctx, northWord, c, w - 22, { colour: "#e6ecf6", font: "700 12px ui-sans-serif, system-ui, sans-serif" });
    tag(ctx, `Sun overhead at ${Math.abs(subsolarDeg).toFixed(1)}° ${subsolarDeg >= 0 ? "N" : "S"}`, c, w - 42, { colour: "#9ff0dc" });
    tag(ctx, PERIODS[mode], c, 18, { colour: "rgba(200,215,235,0.8)" });
  },
  stepsTitle: "Why summer is hot — in four steps",
  steps: [
    { title: "Not because we are closer", text: "Earth is actually closest to the Sun in early January — in the middle of northern winter. The 3% change in distance makes far less difference than the tilt does.", svg: `${SVG_HEAD}${svgSun(60, 60, 6)}<ellipse cx="60" cy="60" rx="44" ry="18" fill="none" stroke="rgba(200,215,235,0.5)"/>${svgDot(17, 60, 4, "#4f86c6")}${svgText(60, 100, "closest to the Sun: January")}</svg>` },
    { title: "The axis keeps pointing one way", text: "Earth spins about an axis tipped 23.44° from upright, and through the year that axis keeps pointing at the same place in the sky (near the Pole Star). So in June the northern half leans towards the Sun, and in December away.", svg: `${SVG_HEAD}${svgSun(60, 60, 6)}${svgDot(18, 60, 6, "#4f86c6")}${svgDot(102, 60, 6, "#4f86c6")}${svgLine(14, 70, 22, 50, "#ffb060", { width: 1.6 })}${svgLine(98, 70, 106, 50, "#ffb060", { width: 1.6 })}${svgText(18, 84, "December")}${svgText(102, 84, "June")}</svg>` },
    { title: "Steeper sunlight, longer days", text: "The half leaning towards the Sun gets sunlight from higher in the sky — more energy on each square metre — and for more hours a day. That is summer. Six months later the same half leans away and gets low, weak sunlight for short days: winter.", svg: "" },
    { title: "Other worlds, other seasons", text: "Mars is tilted like Earth and has seasons like ours, twice as long. Venus and Jupiter are hardly tilted at all, so hardly have seasons. Uranus is tipped on its side, so each pole gets 42 years of light then 42 years of dark.", svg: "" },
  ],
  members: [
    { name: "Earth", note: "Tilted 23.44°", swatch: "#4f86c6" },
    { name: "Mars", note: "Tilted 25.19°, seasons twice as long", swatch: "#c46a3f" },
    { name: "Uranus", note: "Tilted 97.77° — rolling round on its side", swatch: "#9fd8df" },
  ],
  source: "Obliquities: IAU/NASA planetary fact sheets (Earth 23.44°, Mars 25.19°, Uranus 97.77°). Perihelion in early January; Earth's distance from the Sun varies by about 3%.",
};


export const SEASONS_TOPIC = seasons;

/*
 * Archived (round 84, Prompts.md: the board's "Why one face of the Moon"
 * card is covered by the space event "Why we see one face: tidal
 * locking", so the card is removed). This is the explainer that card
 * opened, as it was in src/js/ui/explainers/mechanisms.js. To bring it
 * back, put it there again, add "tidal-locking": tidalLocking to
 * MECHANISM_TOPICS, and restore the card in ui/celestialBoardData.js.
 */
import { TAU, DEG, drawSun, ring, dot, tag, SVG_HEAD, svgSun, svgRing, svgDot, svgText, svgLine } from "./common.js";

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

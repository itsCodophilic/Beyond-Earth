import * as THREE from "three";
import { SMALL_BODIES } from "../scene/smallBodies/smallBodyCatalogue.js";
import { COMETS } from "../scene/smallBodies/cometCatalogue.js";
import { createSmallBodyGeometry, maxHalfExtent } from "../scene/smallBodies/smallBodyShapes.js";
import { createCentaurComa, setComaStrength, updateCentaurComa } from "../scene/smallBodies/centaurComa.js";
import { cometActivity, smallBodyAuToScene } from "../scene/smallBodies/smallBodies.js";

/**
 * "Watch a comet glow": take any comet round the Sun and see it wake up.
 *
 * Round 6 (the owner): a viewer does not know that a comet only glows near
 * the Sun -- in the scene most of them are dormant at any moment (on 4
 * October 2026 only Encke and UN271 were active), so the glow is easy to
 * miss entirely. This view makes the rule something you can play with: pick
 * a comet and drag it nearer the Sun or farther out, and watch the same coma
 * the scene draws -- design E, from centaurComa.js -- grow from nothing as it
 * nears the Sun and fade as it leaves.
 *
 * Round 6, second pass (the owner): nothing moves by itself. There are two
 * bars and the viewer holds both: **distance from the Sun**, and **glow
 * capacity**. Drag either and the other follows -- distance sets the glow
 * through the activity law, and the glow sets the distance through its
 * inverse. "Closest to the Sun" is full glow; "Farthest out" is none.
 *
 * Round 7 (the owner): one comet at a time. The view opens from a comet's own
 * row on the board and is titled with its name; the board card and the
 * comet picker are gone. The 3D comet turns, zooms and moves under the mouse.
 * "Fly to" takes the comet with you: the scene shows it at the distance set
 * here, glowing as much (`placeCometAt` in smallBodies.js), with a way back
 * to today's position in the scene.
 *
 * Nothing here is separate from the scene's physics:
 *
 * - **How strong:** `cometActivity` from smallBodies.js, the same law that
 *   switches the scene's comae on and off -- each record's own `onsetAU`
 *   (where it wakes), rising straight in log distance to full at its
 *   perihelion (round 9).
 * - **What it looks like:** `createCentaurComa` with the record's own coma,
 *   tail and vents, driven by `setComaStrength` -- the scene's own code.
 * - **Where it is:** the real orbit (a, e) from the record. The distance
 *   bar runs from perihelion to aphelion on a log scale (UN271's far end is
 *   29,500 AU); the comet is placed on its inbound leg at that distance, with
 *   the real time to perihelion shown beside it. The map
 *   draws it on the scene's own compressed distance scale (the same conic
 *   rule as the orbit lines), with Earth's, Jupiter's and Neptune's orbits
 *   for reference.
 *
 * Built in the shell the other board views use (`cmoons`). Cost while open:
 * one small WebGL canvas and one 2D canvas; the universe is paused while the
 * board is open, and both are disposed on close.
 */

const TAU = Math.PI * 2;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* Every comet the scene draws, in order of how close to the Sun it comes. */
export const GLOW_COMETS = [...SMALL_BODIES.filter((r) => r.activity && r.coma), ...COMETS]
  .filter((r) => r.activity && r.coma && r.orbit && r.orbit.e < 1)
  .sort((a, b) => a.orbit.aAU * (1 - a.orbit.e) - b.orbit.aAU * (1 - b.orbit.e));

const REFERENCE_ORBITS = [
  ["Earth", 1.0],
  ["Jupiter", 5.2],
  ["Neptune", 30.07],
];

const fmtAU = (au) => (au < 10 ? au.toFixed(2) : au < 1000 ? au.toFixed(1) : Math.round(au).toLocaleString("en-GB"));

function yearsLabel(days) {
  const years = Math.abs(days) / 365.25;
  if (years < 0.05) return "at its closest to the Sun";
  const span = years < 2 ? (Math.round(years * 12) <= 1 ? "about a month" : `${Math.round(years * 12)} months`) : years < 100 ? `${years.toFixed(1)} years` : `${Math.round(years).toLocaleString("en-GB")} years`;
  return days < 0 ? `${span} before its closest approach` : `${span} after its closest approach`;
}

function stateFor(strength) {
  if (strength <= 0.005) return { key: "asleep", label: "Asleep" };
  if (strength >= 0.995) return { key: "full", label: "Full glow" };
  if (strength >= 0.5) return { key: "glowing", label: "Glowing" };
  return { key: "waking", label: "Waking up" };
}

const STEPS = [
  ["A frozen rock, far out", "A comet's nucleus is a dark lump of ice, rock and dust a few kilometres across — darker than coal, reflecting only 3–4% of the light that hits it. Far from the Sun it is too cold for anything to happen: no glow, no tail."],
  ["It wakes as it nears the Sun", "Closer in, sunlight warms the surface until the ice turns straight to gas, dragging dust off with it. For most comets that starts inside about 3 AU — three times Earth's distance from the Sun. Comets rich in carbon monoxide, which turns to gas at far lower temperatures, wake much farther out: C/2014 UN271 was already active at 24 AU."],
  ["Two kinds of light", "The dust reflects sunlight, so the cloud round the head (the coma) and the broad, curved dust tail look whitish-yellow. The gas glows on its own under the Sun's ultraviolet: a green head from carbon molecules (C₂ and CN), and a narrow, straight blue tail of carbon-monoxide ions blown out by the solar wind."],
  ["Brightest at its closest", "The nearer the Sun, the more ice boils off and the bigger and brighter it all gets — full glow at its closest approach. Then it fades on the way out. The tails always point away from the Sun, so on the way out a comet travels tail first."],
];

export function buildCometGlowView({ closeButton, initial = null, liveState = null }) {
  const record = GLOW_COMETS.find((r) => r.name === initial) ?? GLOW_COMETS.find((r) => r.name === "1P/Halley") ?? GLOW_COMETS[0];
  /* Distance from the Sun, AU: the one number the viewer controls. */
  /* Round 8: `outbound` is which leg it is on (it opens where the comet is
   * today, which may be on its way out); `moved` is whether the viewer has
   * changed the distance -- only then does "Fly to" move the scene's comet. */
  const state = { r: 0, outbound: false, moved: false };

  // ------------------------------------------------------------ header
  const board = el("section", "cmoons cglow");
  board.setAttribute("role", "dialog");
  board.setAttribute("aria-label", `Watch ${record.name} glow`);
  const head = el("header", "cmoons__head");
  const back = el("button", "cmoons__back");
  back.type = "button";
  back.dataset.moonBack = "1";
  back.innerHTML = "<span aria-hidden=\"true\">←</span> All celestial bodies";
  head.append(back);
  const title = el("div", "cmoons__title");
  title.append(el("span", "cboard__eyebrow", "Watch it glow · comets only glow near the Sun"));
  title.append(el("h2", "cboard__h", record.name));
  title.append(el("p", "cboard__count", "Bring it nearer the Sun or send it farther out, and watch its glow capacity"));
  head.append(title);
  const shut = closeButton("Back to all bodies");
  shut.dataset.moonBack = "1";
  head.append(shut);
  board.append(head);

  // ------------------------------------------------------------ stage
  const stage = el("div", "cmoons__stage");
  const sky = el("div", "cmoons__sky cglow__sky");

  const views = el("div", "cglow__views");
  const glWrap = el("div", "cglow__gl-wrap");
  const glCanvas = el("canvas", "cglow__gl");
  glCanvas.setAttribute("role", "img");
  const glHint = el("p", "cglow__gl-hint", "Drag to turn · scroll to zoom · right-drag to move · double-click to reset");
  glWrap.append(glCanvas, glHint);
  const mapCanvas = el("canvas", "cglow__map");
  mapCanvas.setAttribute("role", "img");
  views.append(glWrap, mapCanvas);

  const meter = el("div", "cglow__meter");
  const meterTop = el("div", "cglow__meter-top");
  const meterLabel = el("span", "cglow__meter-label", "Glow capacity");
  const meterValue = el("strong", "cglow__meter-value", "0%");
  const meterBadge = el("span", "cglow__badge", "");
  meterTop.append(meterLabel, meterValue, meterBadge);
  /* The glow bar is a slider the viewer can drag: set the glow and the
   * comet moves to the distance that gives it. */
  const glowRange = el("input", "cglow__range cglow__glow-range");
  glowRange.type = "range";
  glowRange.min = "0";
  glowRange.max = "100";
  glowRange.setAttribute("aria-label", "Glow capacity: drag to set how strongly it glows");
  const status = el("p", "cglow__status", "");
  meter.append(meterTop, glowRange, status);

  const controls = el("div", "cglow__controls");
  const distanceTop = el("div", "cglow__meter-top");
  const distanceLabel = el("span", "cglow__meter-label", "Distance from the Sun");
  const distanceValue = el("strong", "cglow__meter-value", "");
  distanceTop.append(distanceLabel, distanceValue);
  const slider = el("input", "cglow__range cglow__distance-range");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1000";
  slider.setAttribute("aria-label", "Distance from the Sun: drag towards the Sun to make it glow");
  /* Where it wakes up, marked on the bar itself (round 7). */
  const track = el("div", "cglow__track");
  const wakeMark = el("span", "cglow__wake", "");
  wakeMark.setAttribute("aria-hidden", "true");
  track.append(slider, wakeMark);
  const ends = el("div", "cglow__ends");
  const closest = el("button", "cglow__btn", "☀ Closest to the Sun");
  closest.type = "button";
  const farthest = el("button", "cglow__btn", "Farthest out ❄");
  farthest.type = "button";
  ends.append(closest, farthest);
  controls.append(distanceTop, track, ends);
  const where = el("p", "cmoons__note cglow__where", "");
  /* Under the bars, not in the facts (round 6). */
  const flyBar = el("div", "cglow__flybar");
  const fly = el("button", "cglow__btn cglow__fly", "");
  fly.type = "button";
  flyBar.append(fly);

  sky.append(views, meter, controls, where, flyBar);

  // ------------------------------------------------------------ side
  const side = el("aside", "cmoons__side cglow__side");
  side.append(el("h3", "cmoons__side-title", `About ${record.name}`));
  const more = el("div", "csys__more");
  side.append(more);
  const facts = el("section", "cglow__facts");
  more.append(facts);
  more.append(el("h3", "cmoons__side-title cglow__why", "Why comets glow near the Sun"));
  STEPS.forEach(([heading, body], index) => {
    const card = el("section", "cglow__step");
    card.append(el("h4", "cglow__step-title", `${index + 1} · ${heading}`));
    card.append(el("p", "cglow__step-text", body));
    more.append(card);
  });

  stage.append(sky, side);
  board.append(stage);

  // ------------------------------------------------------------ 3D
  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  /* The scene's own: ACES at exposure 1.18 (main.js). */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060a);
  /* The Sun at the origin, as in the scene: the coma code reads the Sun's
   * direction from the body's position, so the comet sits out along +x. */
  const sunLight = new THREE.PointLight(0xfff4e6, 3.4, 0, 0);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x30405a, 0.06));
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 4000);
  const AT = new THREE.Vector3(40, 0, 0);
  let holder = null;
  let spinner = null;
  let parts = null;
  let comaRadius = 6;

  function buildComet() {
    if (holder) {
      scene.remove(holder);
      holder.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose?.()); });
    }
    holder = new THREE.Group();
    holder.position.copy(AT);
    const geometry = createSmallBodyGeometry(record.shape, { widthSegments: 96, heightSegments: 64 });
    const scale = 1 / maxHalfExtent(geometry);
    geometry.scale(scale, scale, scale);
    const albedo = Math.max(0.03, Number(record.albedo) || 0.04);
    const nucleus = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: new THREE.Color().setScalar(Math.min(1, albedo * 4)), roughness: 1, metalness: 0,
    }));
    spinner = new THREE.Group();
    spinner.add(nucleus);
    holder.add(spinner);
    parts = createCentaurComa(record, 1);
    if (parts) {
      holder.add(parts.group);
      spinner.add(parts.spinning);
      /* Still, so the dust tail cannot learn which way it is moving: the
       * orbit seen edge-on, the comet heading up the screen. */
      if (parts.emission) parts.emission.trailing.set(0, -1, 0);
    }
    comaRadius = record.coma?.radii ?? 6;
    scene.add(holder);
  }

  // ------------------------------------------------------------ the orbit
  /* Where the comet is when it is r AU from the Sun, on the way in. */
  function orbitAt(rAU) {
    const { aAU, e, meanMotionDegPerDay } = record.orbit;
    const cosE = THREE.MathUtils.clamp((1 - rAU / aAU) / e, -1, 1);
    const E = (state.outbound ? 1 : -1) * Math.acos(cosE); // inbound: before perihelion; outbound: after
    const r = aAU * (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    let M = E - e * Math.sin(E);
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI; // -pi..pi about perihelion
    const days = (M * 180 / Math.PI) / meanMotionDegPerDay;
    return { r, nu, days };
  }

  const mapCtx = mapCanvas.getContext("2d");
  let mapSize = 300;
  let mapRatio = 1;

  function drawMap(pos, strength) {
    const w = mapSize;
    const ctx = mapCtx;
    ctx.setTransform(mapRatio, 0, 0, mapRatio, 0, 0);
    ctx.clearRect(0, 0, w, w);
    const { aAU, e } = record.orbit;
    const q = aAU * (1 - e);
    const Q = aAU * (1 + e);
    /* The scene's distance scale, and the scene's conic through both ends. */
    const fq = smallBodyAuToScene(q);
    const fQ = smallBodyAuToScene(Q);
    const P = (2 * fq * fQ) / (fq + fQ);
    const E2 = (fQ - fq) / (fQ + fq);
    const sceneR = (nu) => P / (1 + E2 * Math.cos(nu));
    /* Fit the whole orbit: perihelion to the right of the Sun, aphelion left. */
    const span = fq + fQ;
    const k = (w * 0.86) / span;
    const sx = w * 0.07 + fQ * k;
    const sy = w * 0.5;
    const toXY = (nu, r) => [sx + Math.cos(nu) * r * k, sy - Math.sin(nu) * r * k];

    // Where it glows: a warm disc out to the wake-up distance, brighter to full.
    const onset = smallBodyAuToScene(record.activity.onsetAU) * k;
    const full = smallBodyAuToScene(q) * k;
    const zone = ctx.createRadialGradient(sx, sy, 0, sx, sy, onset);
    zone.addColorStop(0, "rgba(120, 230, 170, 0.32)");
    zone.addColorStop(Math.min(0.999, full / onset), "rgba(120, 230, 170, 0.22)");
    zone.addColorStop(1, "rgba(120, 230, 170, 0.04)");
    ctx.fillStyle = zone;
    ctx.beginPath();
    ctx.arc(sx, sy, onset, 0, TAU);
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(120, 230, 170, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, onset, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // Planets' orbits, for scale.
    ctx.font = "500 10px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    REFERENCE_ORBITS.forEach(([name, au]) => {
      const rr = smallBodyAuToScene(au) * k;
      if (rr < 6 || rr > w) return;
      ctx.strokeStyle = "rgba(170, 190, 220, 0.25)";
      ctx.beginPath();
      ctx.arc(sx, sy, rr, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "rgba(170, 190, 220, 0.6)";
      ctx.fillText(name, sx, sy - rr - 3);
    });

    // The comet's orbit.
    ctx.strokeStyle = "rgba(143, 176, 255, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 360; i += 1) {
      const nu = (i / 360) * TAU;
      const [x, y] = toXY(nu, sceneR(nu));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // The Sun.
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
    glow.addColorStop(0, "rgba(255, 230, 170, 1)");
    glow.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, TAU);
    ctx.fill();

    // The comet, with a little tail pointing away from the Sun.
    const [cx, cy] = toXY(pos.nu, sceneR(pos.nu));
    const away = [cx - sx, cy - sy];
    const len = Math.hypot(away[0], away[1]) || 1;
    if (strength > 0.01) {
      ctx.strokeStyle = `rgba(140, 180, 255, ${0.25 + 0.6 * strength})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (away[0] / len) * (6 + 22 * strength), cy + (away[1] / len) * (6 + 22 * strength));
      ctx.stroke();
      ctx.fillStyle = `rgba(120, 240, 170, ${0.35 * strength})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 4 + 6 * strength, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#e8f1ff";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.4, 0, TAU);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(120, 230, 170, 0.9)";
    ctx.fillText(`glows inside ${fmtAU(record.activity.onsetAU)} AU`, 8, w - 10);
  }

  // ------------------------------------------------------------ update
  function setup() {
    buildComet();
    const { aAU, e } = record.orbit;
    const q = aAU * (1 - e);
    const Q = aAU * (1 + e);
    const period = 360 / record.orbit.meanMotionDegPerDay / 365.25;
    facts.textContent = "";
    /* Round 7: one line for full glow, not two. "Full glow inside 0.6 AU"
     * beside "Closest to the Sun 0.59 AU" read as two different claims; the
     * glow is full at the closest point, so that is the line. */
    const rows = [
      ["Wakes up inside", `${fmtAU(record.activity.onsetAU)} AU from the Sun`],
      ["Closest to the Sun", `${fmtAU(q)} AU · full glow`],
      ["Farthest out", `${fmtAU(Q)} AU · asleep`],
      ["One lap takes", period < 100 ? `${period.toFixed(1)} years` : `${Math.round(period).toLocaleString("en-GB")} years`],
    ];
    const live = liveState?.(record.name);
    if (live) rows.push(["In the scene today", `${fmtAU(live.au)} AU — ${stateFor(live.strength).label.toLowerCase()}${live.strength > 0.005 ? ` (${Math.round(live.strength * 100)}%)` : ""}`]);
    const dl = el("dl", "cglow__facts-list");
    rows.forEach(([dt, dd]) => { dl.append(el("dt", null, dt), el("dd", null, dd)); });
    facts.append(dl);
    fly.dataset.travel = record.name;
    /* The wake-up mark on the distance bar, at the thumb's centre for that
     * value (the thumb is 22px wide, so its centre runs 11px in from each end). */
    const wakeAt = distanceToSlider(record.activity.onsetAU) / 1000;
    wakeMark.style.left = `calc(11px + (100% - 22px) * ${wakeAt.toFixed(4)})`;
    wakeMark.textContent = `wakes up · ${fmtAU(record.activity.onsetAU)} AU`;
    wakeMark.classList.toggle("is-far", wakeAt > 0.7);
    /* Round 8 (the owner): the board said "glowing now · 10%" for Tempel 1
     * and this view opened at 81% -- it opened at a made-up starting point
     * between waking up and full glow. It now opens where the comet is
     * today, on the leg it is on, so both read the same number. Only if the
     * scene cannot say does it fall back to that starting point. */
    if (live && Number.isFinite(live.au)) {
      state.r = live.au;
      state.outbound = Boolean(live.outbound);
    } else {
      state.r = Math.sqrt(record.activity.onsetAU * qOf());
    }
    state.moved = false;
    update();
  }

  const qOf = () => record.orbit.aAU * (1 - record.orbit.e);
  const QOf = () => record.orbit.aAU * (1 + record.orbit.e);
  /* The distance bar is logarithmic: 0 = closest, 1000 = farthest. */
  const distanceToSlider = (r) => Math.round(1000 * Math.log(r / qOf()) / Math.log(QOf() / qOf()));
  const sliderToDistance = (v) => qOf() * Math.exp((v / 1000) * Math.log(QOf() / qOf()));
  /* The activity law's inverse: the distance that gives a glow g (0..1).
   * The law is straight in log distance from onset to perihelion q (round
   * 9), so r = onset * (q / onset)^g. Full glow is the closest point, as
   * the "Closest to the Sun" button says. */
  function distanceForGlow(g) {
    const { onsetAU } = record.activity;
    if (g <= 0) return onsetAU;
    if (g >= 1) return qOf();
    return Math.max(qOf(), onsetAU * Math.pow(qOf() / onsetAU, g));
  }

  function update({ fromGlow = null } = {}) {
    state.r = THREE.MathUtils.clamp(state.r, qOf(), QOf());
    const pos = orbitAt(state.r);
    const strength = fromGlow ?? cometActivity(record.activity, pos.r, record.orbit);
    if (state.moved) {
      fly.dataset.glowAu = String(pos.r);
      fly.dataset.glowLeg = state.outbound ? "out" : "in";
      fly.textContent = `✈ Fly to ${record.name} — see it there: ${fmtAU(pos.r)} AU, ${Math.round(strength * 100)}% glow`;
      fly.setAttribute("aria-label", `Fly to ${record.name} in the scene, placed ${fmtAU(pos.r)} AU from the Sun, glowing ${Math.round(strength * 100)}%`);
    } else {
      delete fly.dataset.glowAu;
      delete fly.dataset.glowLeg;
      fly.textContent = `✈ Fly to ${record.name} — as it is today`;
      fly.setAttribute("aria-label", `Fly to ${record.name} in the scene, where it is today`);
    }
    if (parts) setComaStrength(parts, strength);
    const pct = Math.round(strength * 100);
    meterValue.textContent = `${pct}%`;
    if (document.activeElement !== glowRange || fromGlow === null) glowRange.value = String(pct);
    glowRange.style.setProperty("--fill", `${pct}%`);
    if (document.activeElement !== slider || fromGlow !== null) slider.value = String(distanceToSlider(pos.r));
    distanceValue.textContent = `${fmtAU(pos.r)} AU`;
    const st = stateFor(strength);
    board.dataset.glowState = st.key;
    meterBadge.textContent = st.key === "full" ? "★ Full glow" : st.label;
    status.textContent = st.key === "asleep"
      ? `Asleep — ${fmtAU(pos.r)} AU from the Sun. Too cold out here for its ice to turn to gas. It wakes up inside ${fmtAU(record.activity.onsetAU)} AU — the mark on the distance bar.`
      : st.key === "full"
        ? `Full glow — ${fmtAU(pos.r)} AU from the Sun. Coma, green gas head, blue ion tail and curved dust tail all at full strength.`
        : st.key === "waking"
          ? `Waking up — ${fmtAU(pos.r)} AU from the Sun, inside its wake-up distance of ${fmtAU(record.activity.onsetAU)} AU. The first ice is turning to gas: a faint coma and a short tail. Closer in, it grows fast.`
          : `Glowing — ${fmtAU(pos.r)} AU from the Sun. Ice is turning to gas and lifting dust off: the closer it gets, the brighter it glows.`;
    where.textContent = `${record.name} is ${fmtAU(pos.r)} AU from the Sun, ${yearsLabel(pos.days)}.`;
    drawMap(pos, strength);
    glCanvas.setAttribute("aria-label", status.textContent);
  }

  /* The camera, under the viewer's mouse (round 7): drag to turn round the
   * comet, wheel to zoom, right- or Shift-drag to move, double-click to go
   * back. It starts where the view always looked from: phase ~70 degrees
   * from the Sun, a little above, aimed a little down the tail so the head
   * and the tails share the frame. The nucleus is scaled to radius 1. */
  const view = { target: new THREE.Vector3(), orbit: new THREE.Spherical() };
  const _offset = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  function resetView() {
    const dist = Math.max(comaRadius * 3.2, 14);
    view.target.set(AT.x + comaRadius * 0.9, 0, 0);
    _offset.set(AT.x - Math.cos(1.2) * dist, dist * 0.22, Math.sin(1.2) * dist).sub(view.target);
    view.orbit.setFromVector3(_offset);
  }
  const zoomLimits = () => [2.2, Math.max(comaRadius * 14, 60)];
  function placeCamera() {
    _offset.setFromSpherical(view.orbit);
    camera.position.copy(view.target).add(_offset);
    camera.lookAt(view.target);
  }
  let drag = null;
  glCanvas.style.touchAction = "none";
  glCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
  glCanvas.addEventListener("pointerdown", (event) => {
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, pan: event.button === 2 || event.shiftKey };
    glCanvas.setPointerCapture?.(event.pointerId);
    glCanvas.classList.add("is-dragging");
  });
  glCanvas.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.pan) {
      /* Move the point looked at across the screen, at a rate that keeps
       * the comet under the cursor at any zoom. */
      const perPixel = (2 * view.orbit.radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, glCanvas.clientHeight);
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);
      view.target.addScaledVector(_right, -dx * perPixel).addScaledVector(_up, dy * perPixel);
    } else {
      view.orbit.theta -= dx * 0.008;
      view.orbit.phi = THREE.MathUtils.clamp(view.orbit.phi - dy * 0.008, 0.08, Math.PI - 0.08);
    }
  });
  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    glCanvas.classList.remove("is-dragging");
  };
  glCanvas.addEventListener("pointerup", endDrag);
  glCanvas.addEventListener("pointercancel", endDrag);
  glCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const [near, far] = zoomLimits();
    view.orbit.radius = THREE.MathUtils.clamp(view.orbit.radius * Math.exp(event.deltaY * 0.0012), near, far);
  }, { passive: false });
  glCanvas.addEventListener("dblclick", () => resetView());

  function render3d() {
    if (!holder) return;
    const t = performance.now() / 1000;
    spinner.rotation.y = t * 0.25;
    placeCamera();
    holder.updateMatrixWorld(true);
    if (parts) updateCentaurComa(parts, holder);
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------ loop
  let frameId = 0;
  /* Nothing moves on its own: the loop only draws the 3D view (the
   * nucleus turning, the ion tail rippling). */
  function tick() {
    render3d();
    frameId = requestAnimationFrame(tick);
  }

  function fit() {
    const width = Math.max(260, sky.clientWidth - 24);
    const glW = Math.floor(Math.min(width * 0.6, 640));
    const glH = Math.floor(Math.max(220, Math.min(glW * 0.72, sky.clientHeight * 0.5)));
    renderer.setSize(glW, glH, false);
    glCanvas.style.width = `${glW}px`;
    glCanvas.style.height = `${glH}px`;
    camera.aspect = glW / glH;
    camera.updateProjectionMatrix();
    mapSize = Math.floor(Math.max(200, Math.min(width - glW - 16, glH)));
    mapRatio = Math.min(2, window.devicePixelRatio || 1);
    mapCanvas.width = Math.round(mapSize * mapRatio);
    mapCanvas.height = Math.round(mapSize * mapRatio);
    mapCanvas.style.width = `${mapSize}px`;
    mapCanvas.style.height = `${mapSize}px`;
    update();
    render3d();
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  observer?.observe(sky);

  slider.addEventListener("input", () => {
    state.r = sliderToDistance(Number(slider.value));
    state.moved = true;
    update();
  });
  glowRange.addEventListener("input", () => {
    const g = Number(glowRange.value) / 100;
    state.r = distanceForGlow(g);
    state.moved = true;
    update({ fromGlow: g });
  });
  closest.addEventListener("click", () => { state.r = qOf(); state.moved = true; update(); });
  farthest.addEventListener("click", () => { state.r = QOf(); state.moved = true; update(); });

  setup();
  resetView();
  frameId = requestAnimationFrame(tick);

  function render() { update(); render3d(); }
  function clearSelection() { return false; }
  /* Where the board dives on "Fly to" (round 8): into the comet itself, as
   * the moon boards dive into the moon pressed -- the nucleus, projected
   * from the 3D view onto the screen. */
  const _screen = new THREE.Vector3();
  function departPoint() {
    if (!holder) return null;
    const box = glCanvas.getBoundingClientRect();
    if (!box.width) return null;
    _screen.copy(AT).project(camera);
    if (_screen.z > 1) return null;
    return {
      x: box.left + THREE.MathUtils.clamp((_screen.x + 1) / 2, 0, 1) * box.width,
      y: box.top + THREE.MathUtils.clamp((1 - _screen.y) / 2, 0, 1) * box.height,
    };
  }

  function destroy() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    observer?.disconnect();
    /*
     * Round 8 (the owner): on "Fly to" the 3D panel went white while the
     * board dived away. Dropping the GL context blanks the canvas, and the
     * board is still on screen for its 560ms exit. So the last frame is kept
     * as a picture in the canvas's place first: drawn and copied in the
     * same task, while the drawing buffer still holds it.
     */
    try {
      if (glCanvas.isConnected && holder) {
        render3d();
        /* A 2D copy, not an <img>: a data URL decodes asynchronously and
         * would leave a blank frame of its own; drawImage is immediate. */
        const still = document.createElement("canvas");
        still.width = glCanvas.width;
        still.height = glCanvas.height;
        still.className = glCanvas.className;
        still.style.width = glCanvas.style.width;
        still.style.height = glCanvas.style.height;
        still.getContext("2d")?.drawImage(glCanvas, 0, 0);
        glCanvas.replaceWith(still);
      }
    } catch { /* no picture, no matter: the board is leaving */ }
    scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => m.dispose?.()); });
    renderer.dispose();
    renderer.forceContextLoss?.();
  }

  return { board, filterBox: null, back, fit, render, clearSelection, destroy, departPoint };
}

/* For the board: how strong a comet's glow is in the live scene. */
export function glowStateLabel(strength) {
  return stateFor(strength);
}

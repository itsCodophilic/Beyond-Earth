import { JUPITER_TROJANS } from "../scene/smallBodies/trojanCatalogue.js";

/**
 * Jupiter's company: the Trojans and the Hildas, explained by moving them.
 *
 * Reported: the swarms looked as if they belonged to Jupiter, and the honest
 * statement -- they orbit the Sun, and Jupiter only decides where those
 * orbits may be -- is hard to see in the scene, where everything moves at
 * once. The way to see it is to watch the same motion twice:
 *
 *   From above the Sun   everything goes round the Sun. Jupiter goes round;
 *                        the two swarms go round with it, one 60° ahead and
 *                        one 60° behind, each on its own orbit about the Sun
 *                        (Hektor's is drawn: it is a circle round the Sun,
 *                        not round Jupiter). The Hildas go round faster, three
 *                        laps to Jupiter's two.
 *   Riding with Jupiter  the same bodies, with the picture turned so Jupiter
 *                        stays still. Now the swarms sit at L4 and L5 and
 *                        wobble slowly about them, and the Hildas pile up at
 *                        three corners -- L3, L4 and L5 -- because they always
 *                        pass Jupiter at their closest point to the Sun, as
 *                        far from Jupiter as they get, and dawdle at the far
 *                        end of their orbits.
 *
 * Nothing here is invented to make the point: the Trojans share Jupiter's
 * period; the Hildas are real Kepler ellipses in exact 3:2, with their
 * closest approach to the Sun falling at their meetings with Jupiter (the
 * resonant angle 3 lambda_J - 2 lambda - varpi librating about zero); the
 * L4 : L5 numbers are 1.6 : 1 (Li et al. 2023). What is compressed is time
 * (one Jupiter year is 16 seconds) and the Trojans' slow wobble about their
 * points, which really takes about 150 years and is shown at about 12
 * Jupiter years here. Distances are to scale with each other: Hilda's
 * a = 3.97 AU against Jupiter's 5.20.
 *
 * Round 3 (Prompts.md): reported as confusing -- the two view names were
 * hard to follow, L1 and L2 crowded Jupiter for no reason (nothing here
 * lives at them), and the named bodies people had just visited -- Eurybates,
 * Polymele and the rest -- were nowhere in the picture. So: plain view
 * names ("1 · The real motion", "2 · Hold Jupiter still"); only the three
 * points that matter, L3, L4 and L5, each labelled with what it is; and
 * every named body drawn where it really is relative to Jupiter on 27
 * September 2026 (`namedBodies`, from the catalogue's own SBDB elements),
 * each labelled with a leader line so the crowded L4 camp stays readable.
 *
 * Built in the same shell as the binary system view (`cmoons`), opened from
 * the board's "Jupiter's Trojans & Hildas" entry and from the Space
 * Dictionary. Cost while open: one rAF drawing about 600 dots on a canvas;
 * the universe is paused while the board is open.
 */

const LAP_SECONDS = 16;
const HILDA_A = 3.968 / 5.203;
/* Trojan libration shown at ~12 Jupiter years per wobble (really ~150 yr). */
const WOBBLE_LAPS = 12;
const L4_COUNT = 220;
const L5_COUNT = 140;
const HILDA_COUNT = 260;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function kepler(M, e) {
  let E = M;
  for (let i = 0; i < 8; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/*
 * The named bodies, where they really are.
 *
 * Heliocentric ecliptic longitude and distance on the card date, 27
 * September 2026 (JD 2461310.5), from each record's SBDB elements; Jupiter's
 * from Standish's "Keplerian Elements for Approximate Positions of the Major
 * Planets", Table 1 (the same row smallBodies.js uses for its co-orbital
 * frames). Each then moves on its own ellipse at the diagram's exact
 * resonance -- one lap per Jupiter lap for a Trojan, three per two for
 * Hilda -- so it keeps its real angle from Jupiter (a Trojan's wobble about
 * L4 or L5 takes ~150 years) and stays exactly on its own drawn orbit.
 * Measured today: Hektor +67 deg from Jupiter, Orus +61, Leucus +75,
 * Eurybates and Polymele +83, Patroclus -56, Hilda -65.
 */
const CARD_JD = 2461310.5;
const JUPITER_STANDISH = { aAU: 5.20288700, e: 0.04838624, iDeg: 1.30439695, L0: 34.39644051, Ldot: 3034.74612775, varpi: 14.72847983, node: 100.47390909 };

function eclipticPlace(nodeRad, argPeriRad, incRad, e, M, aAU) {
  const E = kepler(((M % TAU) + TAU) % TAU, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const u = argPeriRad + nu;
  return { lon: nodeRad + Math.atan2(Math.cos(incRad) * Math.sin(u), Math.cos(u)), r: aAU * (1 - e * Math.cos(E)) };
}

function jupiterToday() {
  const j = JUPITER_STANDISH;
  const T = (CARD_JD - 2451545.0) / 36525;
  const L = j.L0 + j.Ldot * T;
  return eclipticPlace(j.node * DEG, (j.varpi - j.node) * DEG, j.iDeg * DEG, j.e, (L - j.varpi) * DEG, j.aAU);
}

const NAMED = Object.freeze(["Hektor", "Eurybates", "Polymele", "Leucus", "Orus", "Patroclus", "Hilda"]);

function namedBodies() {
  const jupiter = jupiterToday();
  return JUPITER_TROJANS.filter((r) => NAMED.includes(r.name)).map((r) => {
    const o = r.orbit;
    const M0 = (o.meanAnomalyDeg + o.meanMotionDegPerDay * (CARD_JD - o.epochJD)) * DEG;
    const now = eclipticPlace(o.nodeDeg * DEG, o.argPeriDeg * DEG, o.iDeg * DEG, o.e, M0, o.aAU);
    const ratio = r.coOrbital?.ratio ?? 1;
    const offset = now.lon - jupiter.lon;
    return {
      name: r.name,
      hilda: ratio !== 1,
      camp: ratio !== 1 ? "Hilda" : Math.sin(offset) > 0 ? "L4" : "L5",
      /* Its own ellipse, distances in units of Jupiter's semi-major axis. */
      orbit: { node: o.nodeDeg * DEG, argPeri: o.argPeriDeg * DEG, inc: o.iDeg * DEG, e: o.e, M0, a: o.aAU / JUPITER_STANDISH.aAU, ratio },
      jupiterLon0: jupiter.lon,
    };
  });
}

/* The particles: angles in radians, distances in units of Jupiter's orbit. */
function makeParticles() {
  const rand = mulberry32(5203);
  const trojans = [];
  const add = (count, centreDeg, camp) => {
    for (let i = 0; i < count; i += 1) {
      trojans.push({
        camp,
        centre: centreDeg * DEG,
        amp: (4 + 26 * Math.pow(rand(), 1.6)) * DEG,
        phase: rand() * TAU,
        dr: (rand() - 0.5) * 0.06,
        size: 0.8 + rand() * 0.9,
      });
    }
  };
  add(L4_COUNT, 60, "L4");
  add(L5_COUNT, -60, "L5");
  const hildas = [];
  for (let i = 0; i < HILDA_COUNT; i += 1) {
    const varpi = rand() * TAU;
    hildas.push({
      varpi,
      tau: varpi / TAU,
      e: 0.08 + rand() * 0.2,
      lib: (rand() - 0.5) * 50 * DEG,
      libPhase: rand() * TAU,
      size: 0.7 + rand() * 0.8,
    });
  }
  return { trojans, hildas };
}

/* A Hilda's longitude and distance at time t (in Jupiter years). */
function hildaAt(h, t, out) {
  const varpi = h.varpi + h.lib * Math.sin(TAU * t / 9 + h.libPhase);
  const M = TAU * 1.5 * (t - h.tau);
  const E = kepler(((M % TAU) + TAU) % TAU, h.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + h.e) * Math.sin(E / 2), Math.sqrt(1 - h.e) * Math.cos(E / 2));
  out.lon = varpi + nu;
  out.r = HILDA_A * (1 - h.e * Math.cos(E));
  return out;
}

const MEMBERS = Object.freeze([
  { name: "Hektor", where: "L4", note: "The largest Trojan: two lobes and a moon" },
  { name: "Eurybates", where: "L4", note: "Lucy flyby 12 August 2027" },
  { name: "Polymele", where: "L4", note: "Lucy flyby 15 September 2027" },
  { name: "Leucus", where: "L4", note: "Lucy flyby 18 April 2028" },
  { name: "Orus", where: "L4", note: "Lucy flyby 11 November 2028" },
  { name: "Patroclus", where: "L5", note: "A binary · Lucy's last target, 2 March 2033" },
  { name: "Hilda", where: "3:2", note: "Gives the Hildas their name" },
  { name: "Jupiter", where: "", note: "The planet that shepherds them all" },
]);


/* Small still diagrams for the five steps. Sun at (60, 60) in a 120 box;
 * Jupiter's orbit radius 40; Jupiter at the top; anticlockwise motion,
 * so "ahead" is to the left of Jupiter as drawn. */
const SVG_HEAD = '<svg viewBox="0 0 120 120" role="img" aria-hidden="true">';
const SUN = '<circle cx="60" cy="60" r="5" fill="#fff4d6"/><circle cx="60" cy="60" r="9" fill="rgba(255,220,150,0.25)"/>';
const ORBIT = '<circle cx="60" cy="60" r="40" fill="none" stroke="rgba(226,188,138,0.45)" stroke-width="1"/>';
const JUPITER = '<circle cx="60" cy="20" r="5" fill="#e2bc8a"/>';
const at = (deg, r = 40) => [60 + Math.cos(((90 + deg) * Math.PI) / 180) * r, 60 - Math.sin(((90 + deg) * Math.PI) / 180) * r].map((v) => v.toFixed(1));
const ARROW = (() => {
  const [x1, y1] = at(12, 46);
  const [x2, y2] = at(38, 46);
  return `<path d="M ${x1} ${y1} A 46 46 0 0 0 ${x2} ${y2}" fill="none" stroke="#9ff0dc" stroke-width="1.4" marker-end="url(#cjupArrow)"/>`
    + '<defs><marker id="cjupArrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#9ff0dc"/></marker></defs>';
})();
const swarm = (deg, n, seed) => {
  let out = "";
  let t = seed;
  for (let i = 0; i < n; i += 1) {
    t = (t * 9301 + 49297) % 233280;
    const a = deg + ((t / 233280) - 0.5) * 34;
    t = (t * 9301 + 49297) % 233280;
    const r = 40 + ((t / 233280) - 0.5) * 7;
    const [x, y] = at(a, r);
    out += `<circle cx="${x}" cy="${y}" r="1" fill="#d9b48c"/>`;
  }
  return out;
};
const text = (x, y, words, colour = "#cfd8e3") => `<text x="${x}" y="${y}" fill="${colour}" font-size="7" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif">${words}</text>`;
const [l4x, l4y] = at(60);
const [l5x, l5y] = at(-60);
const STEPS = Object.freeze([
  {
    title: "Everything circles the Sun",
    text: "Jupiter goes round the Sun once every 11.9 years. So does every rock in this picture — each on its own path round the Sun. None of them goes round Jupiter, so none of them is a moon.",
    svg: `${SVG_HEAD}${ORBIT}${SUN}${JUPITER}${ARROW}${swarm(60, 10, 3)}${swarm(-60, 7, 9)}${text(60, 12, "Jupiter")}${text(22, 10, "moves", "#9ff0dc")}${text(22, 18, "this way", "#9ff0dc")}</svg>`,
  },
  {
    title: "Two calm spots ride along with Jupiter",
    text: "Draw a triangle with three equal sides: the Sun, Jupiter, and a third corner on Jupiter's path. At that corner the Sun's pull and Jupiter's pull together keep a rock moving at exactly Jupiter's speed. There are two such corners. L4 is 60° ahead along Jupiter's path — the spot Jupiter itself will reach in about 2 years (a sixth of its 11.9-year orbit). L5 is 60° behind — the spot Jupiter passed about 2 years ago.",
    svg: `${SVG_HEAD}${ORBIT}<path d="M 60 60 L 60 20 L ${l4x} ${l4y} Z M 60 20 L ${l5x} ${l5y} L 60 60" fill="none" stroke="rgba(159,240,220,0.55)" stroke-width="0.9" stroke-dasharray="2 2"/>${SUN}${JUPITER}<circle cx="${l4x}" cy="${l4y}" r="3" fill="none" stroke="#fff" stroke-width="0.9"/><circle cx="${l5x}" cy="${l5y}" r="3" fill="none" stroke="#fff" stroke-width="0.9"/>${ARROW}${text(Number(l4x) - 2, Number(l4y) - 13, "L4 · Jupiter")}${text(Number(l4x) - 2, Number(l4y) - 6, "in 2 years")}${text(Number(l5x) + 2, Number(l5y) - 13, "L5 · Jupiter")}${text(Number(l5x) + 2, Number(l5y) - 6, "2 years ago")}</svg>`,
  },
  {
    title: "The Trojans are rocks parked in those spots",
    text: "Over 11,000 known rocks sit in the two spots, about 1.6 ahead for every 1 behind. Because each goes round the Sun in the same 11.9 years as Jupiter, the gaps never change: Jupiter is always heading for the L4 rocks' spot and never gets there, because they move on at its own speed; and the L5 rocks are always following through the spot Jupiter left two years earlier, never closing in. That has held for billions of years. Hektor, Eurybates, Polymele, Leucus and Orus are ahead; Patroclus is behind.",
    svg: `${SVG_HEAD}${ORBIT}${SUN}${JUPITER}${swarm(60, 26, 5)}${swarm(-60, 17, 17)}${ARROW}${text(l4x, Number(l4y) + 14, "ahead (L4)")}${text(l5x, Number(l5y) + 14, "behind (L5)")}${text(60, 12, "Jupiter")}</svg>`,
  },
  {
    title: "The Hildas keep a rhythm instead",
    text: "Closer to the Sun, the Hildas go round three times while Jupiter goes round twice. The timing works out so that whenever Jupiter passes, a Hilda is far away from it — so Jupiter never pulls it off course. Held still next to Jupiter, their paths trace a rounded triangle.",
    svg: (() => {
      let d = "";
      for (let i = 0; i <= 90; i += 1) {
        const t = (i / 90) * 2;
        const lon = Math.PI * 2 * 1.5 * t - Math.PI * 2 * t;
        const r = 30 * (1 - 0.18 * Math.cos(Math.PI * 2 * 1.5 * t));
        const x = 60 + Math.cos(lon + Math.PI / 2) * r;
        const y = 60 - Math.sin(lon + Math.PI / 2) * r;
        d += `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      return `${SVG_HEAD}${ORBIT}<path d="${d}" fill="none" stroke="#bdb4a8" stroke-width="1.1"/>${SUN}${JUPITER}${text(60, 12, "Jupiter (held still)")}${text(60, 112, "3 laps for every 2 of Jupiter")}</svg>`;
    })(),
  },
  {
    title: "Reading the big diagram",
    text: "View 1 shows the real motion: everything turns round the Sun together. View 2 turns the picture with Jupiter so Jupiter stays at the top — then the two Trojan camps stand still beside it and the Hildas' triangle appears. The bright dots are the named bodies, where they really are today. Click any name to fly there.",
    svg: `${SVG_HEAD}${ORBIT}${SUN}${JUPITER}<rect x="12" y="92" width="44" height="14" rx="3" fill="none" stroke="rgba(159,240,220,0.6)"/><rect x="64" y="92" width="44" height="14" rx="3" fill="rgba(159,240,220,0.12)" stroke="rgba(159,240,220,0.6)"/>${text(34, 101.5, "1 · real motion")}${text(86, 101.5, "2 · Jupiter still")}<circle cx="${l4x}" cy="${l4y}" r="2.4" fill="#9ff0dc"/>${text(Number(l4x) - 2, Number(l4y) - 6, "Hektor", "#cffaf0")}</svg>`,
  },
]);

export function buildJupiterCompanyView({ closeButton }) {
  const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const { trojans, hildas } = makeParticles();
  const state = { mode: "sun", t: 0, last: 0 };

  // ------------------------------------------------------------ header
  const board = el("section", "cmoons cjup");
  board.setAttribute("role", "dialog");
  board.setAttribute("aria-label", "Jupiter's Trojans and the Hildas");
  const head = el("header", "cmoons__head");
  const back = el("button", "cmoons__back");
  back.type = "button";
  back.dataset.moonBack = "1";
  back.innerHTML = "<span aria-hidden=\"true\">←</span> All celestial bodies";
  head.append(back);
  const title = el("div", "cmoons__title");
  title.append(el("span", "cboard__eyebrow", "They orbit the Sun. Jupiter decides where."));
  title.append(el("h2", "cboard__h", "Jupiter's Trojans & the Hildas"));
  title.append(el("p", "cboard__count", "Over 11,000 Trojans known, in two camps · more than 6,000 Hildas · none of them moons of Jupiter"));
  head.append(title);
  const ask = el("button", "cgloss__ask csys__ask", "What is a Lagrange point?");
  ask.type = "button";
  ask.dataset.gloss = "trojan";
  ask.setAttribute("aria-expanded", "false");
  head.append(ask);
  const shut = closeButton("Back to all bodies");
  shut.dataset.moonBack = "1";
  head.append(shut);
  board.append(head);

  // ------------------------------------------------------------ the map
  const stage = el("div", "cmoons__stage");
  const sky = el("div", "cmoons__sky cjup__sky");
  const modes = el("div", "cjup__modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Point of view");
  const modeButtons = [
    ["sun", "1 · The real motion", "Everything circles the Sun"],
    ["jupiter", "2 · Hold Jupiter still", "See where they gather"],
  ].map(([key, label, sub]) => {
    const button = el("button", "cjup__mode");
    button.type = "button";
    button.dataset.jupMode = key;
    button.append(el("span", "cjup__mode-label", label), el("span", "cjup__mode-sub", sub));
    modes.append(button);
    return button;
  });
  const canvas = el("canvas", "cjup__canvas");
  canvas.setAttribute("role", "img");
  const caption = el("p", "cmoons__note cjup__caption");
  const legend = el("div", "cjup__legend");
  const pathKey = document.createTextNode("Hektor's own orbit");
  [["is-sun", "Sun"], ["is-jupiter", "Jupiter"], ["is-trojan", "Trojans"], ["is-hilda", "Hildas"], ["is-named", "Named bodies (where they are today)"], ["is-path", pathKey]]
    .forEach(([cls, text]) => {
      const item = el("span", "cjup__key");
      item.append(el("i", `cjup__swatch ${cls}`), typeof text === "string" ? document.createTextNode(text) : text);
      legend.append(item);
    });
  /* The names on the diagram are buttons (round 5: "on double click it
   * does not travel"). A layer of real buttons sits over the canvas, moved
   * each frame onto the drawn labels, so a click -- or a double click, or
   * Enter on the keyboard -- goes through the board's own `data-travel`
   * route like every other "fly to" on the board. */
  const canvasWrap = el("div", "cjup__canvas-wrap");
  const hits = el("div", "cjup__hits");
  canvasWrap.append(canvas, hits);
  const hint = el("p", "cmoons__note cjup__hint", "Click a name to fly there");
  sky.append(modes, canvasWrap, hint, legend, caption);

  // ------------------------------------------------------------ the side
  const side = el("aside", "cmoons__side cjup__side");
  side.append(el("h3", "cmoons__side-title", "Not Jupiter's moons — in five steps"));
  const more = el("div", "csys__more");
  side.append(more);
  /*
   * Round 5: asked for "a simpler explanation, detailed but simple, with a
   * diagram" -- and "ahead" and "behind" Jupiter were hard to picture. So the
   * side is now five short steps, each with its own small still diagram, in
   * the order the idea builds: everything circles the Sun; two calm spots
   * ride with Jupiter; Trojans sit in them; Hildas keep a rhythm; how to
   * read the big diagram.
   */
  STEPS.forEach((step, index) => {
    const card = el("section", "cjup__step");
    const art = el("div", "cjup__step-art");
    art.innerHTML = step.svg;
    const words = el("div", "cjup__step-words");
    words.append(el("h4", "cjup__step-title", `${index + 1} · ${step.title}`));
    words.append(el("p", "cjup__step-text", step.text));
    card.append(art, words);
    more.append(card);
  });
  more.append(el("h3", "cmoons__side-title csys__list-title", "Fly to one"));
  const list = el("ol", "csys__list");
  MEMBERS.forEach((member) => {
    const row = el("button", "csys__row");
    row.type = "button";
    row.dataset.travel = member.name;
    const dot = el("span", "csys__row-dot");
    dot.style.setProperty("--swatch", member.where === "3:2" ? "#bdb4a8" : member.where ? "#d9b48c" : "#e2bc8a");
    const text = el("span", "csys__row-text");
    text.append(el("span", "csys__row-name", member.where ? `${member.name} · ${member.where}` : member.name));
    text.append(el("span", "csys__row-meta", member.note));
    row.append(dot, text);
    const item = el("li");
    item.append(row);
    list.append(item);
  });
  more.append(list);
  more.append(el("p", "cmoons__note cjup__source",
    "The clouds are a statistical picture: L4 : L5 = 1.6 : 1 and the spread of the real swarms (Li et al. 2023). The named bodies are not: each is drawn at its real angle from Jupiter on 27 September 2026, from its JPL orbit. Distances to scale; time sped up — one Jupiter year is 16 seconds, and the Trojans' slow wobble, about 150 years, is shown far faster for the clouds."));

  stage.append(sky, side);
  board.append(stage);

  // ------------------------------------------------------------ drawing
  let size = 400;
  let ratio = 1;
  const ctx = canvas.getContext("2d");
  const point = { lon: 0, r: 1 };
  const named = namedBodies();
  /* Today's Jupiter longitude: t = 0 is the card date, so the named bodies
   * start where they really are. The cloud model is turned to match. */
  const JUPITER_LON0 = named[0]?.jupiterLon0 ?? 0;
  const hitButtons = new Map();
  [...named.map((b) => b.name), "Jupiter"].forEach((name) => {
    const button = el("button", "cjup__hit");
    button.type = "button";
    button.dataset.travel = name;
    button.setAttribute("aria-label", `Fly to ${name}`);
    button.title = `Fly to ${name}`;
    hits.append(button);
    hitButtons.set(name, button);
  });
  const dots = new Map();
  const placeHit = (name, x, y, width, height) => {
    const button = hitButtons.get(name);
    if (!button) return;
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.style.width = `${width}px`;
    button.style.height = `${height}px`;
  };
  /* A click or double click on the canvas itself, near a dot, flies there too. */
  const nearestDot = (event) => {
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    let best = null;
    let bestD = 16;
    dots.forEach((p, name) => {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bestD) { bestD = d; best = name; }
    });
    return best;
  };
  canvas.addEventListener("click", (event) => {
    const name = nearestDot(event);
    if (name) hitButtons.get(name)?.click();
  });

  function setMode(mode) {
    state.mode = mode;
    modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.jupMode === mode)));
    pathKey.textContent = mode === "sun" ? "Hektor's own orbit" : "Hilda's path, seen with Jupiter held still";
    caption.textContent = mode === "sun"
      ? "The real motion: Jupiter and every dot go round the Sun, anticlockwise. The two Trojan camps travel with Jupiter, one ahead and one behind; the Hildas go round faster, inside. The bright circle is Hektor's own orbit — round the Sun, not round Jupiter."
      : "The same motion with Jupiter held still at the top. Now the pattern shows: the Trojans stay in two camps, L4, 60° ahead — where Jupiter will be in about 2 years — and L5, 60° behind — where it was about 2 years ago; the Hildas bunch at three corners, tracing a triangle — the bright loop is Hilda's path.";
    canvas.setAttribute("aria-label", caption.textContent);
    if (reduceMotion) draw();
  }

  function draw() {
    const w = size;
    const c = w / 2;
    /* 0.34 of the width, not 0.4: room outside Jupiter's orbit for the
     * named bodies' labels. */
    const R = w * 0.34;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, w);
    const jupiterLon = JUPITER_LON0 + TAU * state.t;
    const frame = state.mode === "jupiter" ? -jupiterLon + Math.PI / 2 : 0;
    const xy = (lon, r) => [c + Math.cos(lon + frame) * r * R, c - Math.sin(lon + frame) * r * R];

    // Jupiter's orbit and, faintly, the Hilda zone.
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(226, 188, 138, 0.28)";
    ctx.beginPath();
    ctx.arc(c, c, R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(189, 180, 168, 0.18)";
    ctx.beginPath();
    ctx.arc(c, c, R * HILDA_A, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // One body's own path, in whichever view.
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(159, 240, 220, 0.75)";
    ctx.beginPath();
    if (state.mode === "sun") {
      // Hektor's own orbit, from its elements: round the Sun, Jupiter's size.
      const hektor = named.find((b) => b.name === "Hektor");
      for (let i = 0; i <= 180 && hektor; i += 1) {
        const o = hektor.orbit;
        const place = eclipticPlace(o.node, o.argPeri, o.inc, o.e, (i / 180) * TAU, o.a);
        const [x, y] = xy(place.lon, place.r);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    } else {
      // Hilda's own loop in Jupiter's frame: two Jupiter years closes it.
      const hilda = named.find((b) => b.hilda);
      for (let i = 0; i <= 240; i += 1) {
        const tt = state.t + (i / 240) * 2;
        if (hilda) namedAt(hilda, tt, point);
        else { hildaAt(hildas[0], tt, point); point.lon += JUPITER_LON0; }
        const rel = point.lon - (JUPITER_LON0 + TAU * tt) + Math.PI / 2;
        const [x, y] = [c + Math.cos(rel) * point.r * R, c - Math.sin(rel) * point.r * R];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // The three points that matter, with Jupiter held still. L1 and L2
    // are left out: nothing in this picture lives at them, and beside
    // Jupiter they only crowded it.
    if (state.mode === "jupiter") {
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      [["L4 · Jupiter in 2 yrs", 60], ["L5 · Jupiter 2 yrs ago", -60], ["L3 · opposite", 180]].forEach(([label, deg]) => {
        const [x, y] = xy(jupiterLon + deg * DEG, 1);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.stroke();
        // Inside the orbit, towards the Sun -- the outside is for the names
        // -- on a dark tab so the swarm behind cannot swallow it.
        const [lx, ly] = xy(jupiterLon + deg * DEG, 0.7);
        const width = ctx.measureText(label).width + 10;
        ctx.fillStyle = "rgba(6, 9, 14, 0.82)";
        ctx.fillRect(lx - width / 2, ly - 6, width, 15);
        ctx.fillStyle = "rgba(230, 236, 246, 0.85)";
        ctx.fillText(label, lx, ly + 5);
      });
    }

    // The Hildas.
    ctx.fillStyle = "rgba(189, 180, 168, 0.85)";
    for (let i = 0; i < hildas.length; i += 1) {
      hildaAt(hildas[i], state.t, point);
      const [x, y] = xy(point.lon + JUPITER_LON0, point.r);
      ctx.beginPath();
      ctx.arc(x, y, hildas[i].size, 0, TAU);
      ctx.fill();
    }

    // The Trojans: Jupiter's longitude plus their place in the swarm.
    for (let i = 0; i < trojans.length; i += 1) {
      const p = trojans[i];
      const swing = Math.sin(TAU * state.t / WOBBLE_LAPS + p.phase);
      const toward = p.camp === "L4" ? swing < 0 : swing > 0;
      const lon = jupiterLon + p.centre + p.amp * swing * (toward ? 0.72 : 1);
      const [x, y] = xy(lon, 1 + p.dr);
      ctx.fillStyle = p.camp === "L4" ? "rgba(217, 180, 140, 0.9)" : "rgba(217, 180, 140, 0.75)";
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, TAU);
      ctx.fill();
    }

    drawNamed(jupiterLon, xy, c, R, w);

    // The Sun, and Jupiter.
    const glow = ctx.createRadialGradient(c, c, 0, c, c, 22);
    glow.addColorStop(0, "rgba(255, 220, 150, 0.9)");
    glow.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c, c, 22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff4d6";
    ctx.beginPath();
    ctx.arc(c, c, 7, 0, TAU);
    ctx.fill();
    const [jx, jy] = xy(jupiterLon, 1);
    ctx.fillStyle = "#e2bc8a";
    ctx.beginPath();
    ctx.arc(jx, jy, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(230, 236, 246, 0.85)";
    // Inside its orbit, towards the Sun: outside belongs to the names.
    {
      const [lx, ly] = xy(jupiterLon, 0.86);
      ctx.textAlign = "center";
      ctx.fillText("Jupiter", lx, ly + 4);
      const width = ctx.measureText("Jupiter").width;
      placeHit("Jupiter", lx - width / 2 - 4, ly - 8, width + 8, 16);
      dots.set("Jupiter", [jx, jy]);
    }
    /* Which way Jupiter is going, and so which camp is ahead and which
     * behind (round 5: "Jupiter ahead / behind isn't shown"). An arc arrow
     * just outside its orbit, from Jupiter forwards. */
    ctx.strokeStyle = "rgba(159, 240, 220, 0.8)";
    ctx.fillStyle = "rgba(159, 240, 220, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k <= 16; k += 1) {
      const [ax, ay] = xy(jupiterLon + (8 + k) * DEG, 1.09);
      if (k === 0) ctx.moveTo(ax, ay);
      else ctx.lineTo(ax, ay);
    }
    ctx.stroke();
    {
      const [hx, hy] = xy(jupiterLon + 26 * DEG, 1.09);
      const [bx, by] = xy(jupiterLon + 22 * DEG, 1.09);
      const ang = Math.atan2(hy - by, hx - bx);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx - Math.cos(ang - 0.45) * 7, hy - Math.sin(ang - 0.45) * 7);
      ctx.lineTo(hx - Math.cos(ang + 0.45) * 7, hy - Math.sin(ang + 0.45) * 7);
      ctx.closePath();
      ctx.fill();
      // Outside the orbit, running away from it, so it never sits on the
      // "Jupiter" label just inside.
      const [tx, ty] = xy(jupiterLon + 17 * DEG, 1.16);
      ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
      // Kept inside the canvas: on a narrow canvas the right-aligned text
      // ran off the left edge.
      const label = "Jupiter moves this way";
      const width = ctx.measureText(label).width;
      const left = tx < size / 2 ? Math.max(4, tx - width) : Math.min(size - width - 4, tx);
      ctx.textAlign = "left";
      ctx.fillText(label, left, ty + 3);
    }
    if (state.mode === "sun") {
      // The camps named in words in view 1 too (view 2 labels the points).
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      [["ahead: Jupiter's spot in 2 yrs", 60], ["behind: Jupiter's spot 2 yrs ago", -60]].forEach(([label, deg]) => {
        const [lx, ly] = xy(jupiterLon + deg * DEG, 0.72);
        const width = ctx.measureText(label).width + 10;
        ctx.fillStyle = "rgba(6, 9, 14, 0.82)";
        ctx.fillRect(lx - width / 2, ly - 6, width, 15);
        ctx.fillStyle = "rgba(230, 236, 246, 0.85)";
        ctx.fillText(label, lx, ly + 5);
      });
    }
    ctx.textAlign = "center";
    ctx.fillText("Sun", c, c + 24);
  }

  /* A named body on its own ellipse at time t (Jupiter years from the card
   * date), at the diagram's exact resonance -- in units of Jupiter's orbit. */
  function namedAt(body, t, out) {
    const o = body.orbit;
    const place = eclipticPlace(o.node, o.argPeri, o.inc, o.e, o.M0 + TAU * o.ratio * t, o.a);
    out.lon = place.lon;
    out.r = place.r;
    return out;
  }

  /*
   * The named bodies: a bright dot each, and the names stacked in a column
   * outside Jupiter's orbit beside their camp, each joined to its dot by a
   * leader line. Eurybates and Polymele are within half a degree of each
   * other today; drawn side by side their names would sit on top of each
   * other, stacked they cannot.
   */
  function drawNamed(jupiterLon, xy, c, R, w) {
    /* Grouped by where they are on screen, not by camp: Hilda swings past
     * both camps, and next to Patroclus two separate columns collided. */
    const groups = [];
    named.forEach((body) => {
      namedAt(body, state.t, point);
      const [x, y] = xy(point.lon, point.r);
      const near = groups.find((g) => g.some((m) => Math.hypot(m.x - x, m.y - y) < R * 0.45));
      if (near) near.push({ name: body.name, x, y });
      else groups.push([{ name: body.name, x, y }]);
    });
    ctx.font = "500 11px ui-sans-serif, system-ui, sans-serif";
    const lineHeight = 14;
    groups.forEach((members) => {
      const mx = members.reduce((sum, m) => sum + m.x, 0) / members.length;
      const my = members.reduce((sum, m) => sum + m.y, 0) / members.length;
      const dx = mx - c;
      const dy = my - c;
      const len = Math.hypot(dx, dy) || 1;
      const reach = R * 1.3;
      const right = dx >= 0;
      const ax = c + (dx / len) * reach;
      const ay = c + (dy / len) * reach;
      members.sort((a, b) => a.y - b.y);
      const top = Math.max(10, Math.min(w - 4 - members.length * lineHeight, ay - ((members.length - 1) * lineHeight) / 2));
      members.forEach((m, index) => {
        const width = ctx.measureText(m.name).width;
        let tx = right ? ax : ax - width;
        tx = Math.max(4, Math.min(w - width - 4, tx));
        const ty = top + index * lineHeight;
        const joinX = right ? tx - 3 : tx + width + 3;
        ctx.strokeStyle = "rgba(159, 240, 220, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(joinX, ty - 4);
        ctx.stroke();
        ctx.fillStyle = "#cffaf0";
        ctx.textAlign = "left";
        ctx.fillText(m.name, tx, ty);
        placeHit(m.name, tx - 3, ty - 12, width + 6, 16);
        dots.set(m.name, [m.x, m.y]);
      });
      members.forEach((m) => {
        ctx.fillStyle = "#9ff0dc";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3.2, 0, TAU);
        ctx.fill();
      });
    });
  }

  let frameId = 0;
  function tick(now) {
    const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0;
    state.last = now;
    state.t += dt / LAP_SECONDS;
    draw();
    frameId = requestAnimationFrame(tick);
  }

  function fit() {
    const room = sky.clientHeight - modes.offsetHeight - hint.offsetHeight - legend.offsetHeight - caption.offsetHeight - 50;
    size = Math.max(240, Math.floor(Math.min(sky.clientWidth - 16, room)));
    ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    draw();
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  observer?.observe(sky);

  modes.addEventListener("click", (event) => {
    const button = event.target.closest("[data-jup-mode]");
    if (button) setMode(button.dataset.jupMode);
  });
  setMode("sun");
  if (!reduceMotion) frameId = requestAnimationFrame(tick);

  function render() { draw(); }
  function clearSelection() { return false; }
  function destroy() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    observer?.disconnect();
  }

  return { board, filterBox: null, back, fit, render, clearSelection, destroy };
}

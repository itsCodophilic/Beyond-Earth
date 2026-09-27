import { glossaryArt } from "./boardGlossary.js";
import { smallBodyTextureUrl } from "../scene/smallBodies/smallBodies.js";

/**
 * A binary or triple system, drawn as what it is.
 *
 * The five Rank 4 batch B systems -- Lempo, Sila, Teharonhiawako, Altjira and
 * Manwë -- used to open the moon board: the body in the middle, the partner
 * on a ring round it. That is the picture of a planet and its moon, and it is
 * the one thing these are not (reported). Nunam is nearly Sila's size; Hiisi
 * is heavier than Lempo. Each pair goes round a point in open space between
 * them.
 *
 * So this view puts the *shared centre* in the middle and moves every body
 * round it, at its real share of the separation (the partner at 1/(1+q),
 * the other at q/(1+q) on the far side), on the published eccentricity, with
 * Kepler's equation setting the pace round the ellipse. Lempo's hierarchy is
 * two levels: Lempo and Hiisi round their own centre, and that centre and
 * Paha round the system's. Beside it: the facts, a moving comparison with a
 * planet and its moon, and every body listed.
 *
 * Scale: the paths are to scale with each other (the inner pair of a triple
 * is widened, and the note says by how much), the bodies are enlarged by one
 * common factor so their sizes stay true to each other, and a strip under
 * the map shows the real spacing. Time is compressed.
 *
 * Cost: while open, one rAF that moves two or three buttons and one or two
 * lines. The universe is paused while the board is open.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/* One lap of the widest orbit on screen, in seconds. By eye: slow enough to
 * follow a body round, quick enough to see the eccentric ones speed up. */
const TOP_LAP_S = 18;
/* An inner pair's lap, compressed from the true ratio (Lempo–Hiisi go round
 * 27 times per Paha lap) by this power so it is still readable: 27^0.35 is
 * 3.2 inner laps per outer one. */
const INNER_LAP_POWER = 0.35;
/* Earth–Moon centre of mass, 4,671 km from Earth's centre, inside a
 * 6,371 km Earth (NASA Moon fact sheet). */
const EARTH_MOON_CENTRE_KM = 4671;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function formatKm(d) {
  if (!Number.isFinite(d) || d <= 0) return null;
  if (d < 10) return `${d.toFixed(1)} km`;
  return `${Math.round(d).toLocaleString("en-GB")} km`;
}

function formatPeriod(days) {
  if (!Number.isFinite(days) || days <= 0) return null;
  if (days < 1) return `${(days * 24).toFixed(1)} hours`;
  if (days < 365) return `${days < 20 ? days.toFixed(1) : Math.round(days)} days`;
  return `${(days / 365.25).toFixed(1)} years`;
}

function formatHours(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

function kepler(M, e) {
  let E = e > 0.8 ? Math.PI : M;
  for (let i = 0; i < 8; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/** Every companion a partner round a shared centre. */
export function isPartnerSystem(body) {
  return Boolean(body?.moons?.length) && body.moons.every((m) => m.partner);
}

/** The system's names, the named body first and then outward. */
export function systemNames(body) {
  return [body.name, ...[...(body.moons ?? [])]
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    .map((m) => m.name)];
}

/**
 * @param {object} body  a board body with `partnerSystem`
 * @param {object} options
 * @param {Function} options.surfaceFor   name -> { image, flipY } | null
 * @param {Function} options.closeButton  the board's own close button
 * @param {Function} options.travel       (name, fromNode) -> fly there
 */
export function buildBinarySystemView(body, { surfaceFor = null, closeButton, travel }) {
  const partners = [...body.moons].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  const inner = partners.find((m) => m.around !== "pair") ?? partners[0];
  const outer = partners.find((m) => m !== inner && m.around === "pair") ?? null;
  const probablyTriple = /probably a triple/i.test(body.classification ?? "");
  const contactPrimary = /two-lobed|contact/i.test(`${body.classification ?? ""} ${body.detail ?? ""}`);
  const isTriple = Boolean(outer);
  const count = 1 + partners.length;

  /* Mass ratios as the catalogue gives them: the inner partner relative to
   * the named body, an outer partner relative to the pair. Equal density
   * where one is missing. */
  const qi = inner.massRatio ?? ((inner.diameterKm ?? 1) / (body.diameterKm ?? 1)) ** 3;
  const qo = outer ? (outer.massRatio ?? 0) : 0;
  const massOf = [1, qi, outer ? qo * (1 + qi) : null].filter((m) => m != null);
  const totalMass = massOf.reduce((a, b) => a + b, 0);

  const members = [
    {
      name: body.name, diameterKm: body.diameterKm, lobed: body.lobed, locked: body.locked,
      rotationHours: body.rotationHours, classification: body.classification, role: "primary",
    },
    { ...inner, role: "partner" },
    ...(outer ? [{ ...outer, role: "outer" }] : []),
  ];
  members.forEach((m, i) => { m.mass = massOf[i]; });
  const heaviest = members.reduce((a, b) => (b.mass > a.mass ? b : a));

  /* Where the centre is, measured from the named body. */
  const centreFromPrimary = (inner.distanceKm * qi) / (1 + qi);
  const primaryRadius = (body.diameterKm ?? 0) / 2;
  const centreInOpenSpace = centreFromPrimary > primaryRadius;

  // ------------------------------------------------------------ geometry
  /*
   * Map units: a 1000-unit square, the system's centre at (0, 0). The top
   * orbit (the only one, or Paha's) is scaled so its widest path reaches
   * 390 units from the centre; a triple's inner pair is widened to about
   * 220 units apart so the two can be told from each other, up to 12x.
   */
  const top = outer ?? inner;
  const qTop = outer ? qo : qi;
  const eTop = top.eccentricity ?? 0;
  const shareMax = Math.max(1, qTop) / (1 + qTop);
  const S = 390 / (top.distanceKm * (1 + eTop) * shareMax);
  const widen = outer ? Math.min(12, Math.max(1, 220 / (inner.distanceKm * S))) : 1;
  const Si = S * widen;
  /*
   * One enlargement for every body, so their sizes stay true to each
   * other: the largest drawn 80 units across, unless that would leave a
   * pair less than their own size apart at their closest -- then less.
   * Never below true size. (By eye: at 125 and 0.72 Lempo and Hiisi hid
   * their own paths and both centres.)
   */
  const largest = Math.max(...members.map((m) => m.diameterKm || 0));
  const periInner = inner.distanceKm * (1 - (inner.eccentricity ?? 0)) * Si;
  const touch = (0.45 * periInner * 2) / (((body.diameterKm || 0) + (inner.diameterKm || 0)) * S);
  const enlarge = Math.max(1, Math.min(80 / (largest * S), touch));
  members.forEach((m) => {
    m.drawn = Math.max(12, (m.diameterKm || 0) * S * enlarge);
  });

  const orbitOf = (moon, scale, peri, phase) => ({
    a: moon.distanceKm * scale,
    e: Math.min(0.95, Math.max(0, moon.eccentricity ?? 0)),
    peri: (peri * Math.PI) / 180,
    sense: (moon.inclinationDeg ?? 0) > 90 ? -1 : 1,
    phase,
  });
  const topLap = TOP_LAP_S;
  const innerLap = outer
    ? Math.max(3.5, topLap * (inner.periodDays / outer.periodDays) ** INNER_LAP_POWER)
    : topLap;
  const innerOrbit = { ...orbitOf(inner, Si, outer ? 40 : -25, 0.1), lap: innerLap };
  const outerOrbit = outer ? { ...orbitOf(outer, S, -25, 0.35), lap: topLap } : null;

  function rel(orbit, t, out) {
    const M = (((t / orbit.lap) + orbit.phase) % 1) * Math.PI * 2;
    const E = kepler(M, orbit.e);
    const x = orbit.a * (Math.cos(E) - orbit.e);
    const y = -orbit.sense * orbit.a * Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E);
    const c = Math.cos(orbit.peri);
    const s = Math.sin(orbit.peri);
    out.x = x * c - y * s;
    out.y = x * s + y * c;
    return out;
  }

  /* The path a body with this `share` of the relative orbit traces. */
  function pathFor(orbit, share) {
    const points = [];
    const steps = 160;
    const tmp = { x: 0, y: 0 };
    for (let i = 0; i <= steps; i += 1) {
      const E = (i / steps) * Math.PI * 2;
      const x = orbit.a * (Math.cos(E) - orbit.e);
      const y = orbit.a * Math.sqrt(1 - orbit.e * orbit.e) * Math.sin(E);
      tmp.x = (x * Math.cos(orbit.peri) - y * Math.sin(orbit.peri)) * share;
      tmp.y = (x * Math.sin(orbit.peri) + y * Math.cos(orbit.peri)) * share;
      points.push(`${tmp.x.toFixed(1)} ${tmp.y.toFixed(1)}`);
    }
    return `M ${points.join(" L ")} Z`;
  }

  // ------------------------------------------------------------ header
  const board = el("section", "cmoons csys");
  board.setAttribute("role", "dialog");
  board.setAttribute("aria-label", `The ${body.name} system`);

  const head = el("header", "cmoons__head");
  const back = el("button", "cmoons__back");
  back.type = "button";
  back.dataset.moonBack = "1";
  back.innerHTML = "<span aria-hidden=\"true\">←</span> All celestial bodies";
  head.append(back);

  const title = el("div", "cmoons__title");
  title.append(el("span", "cboard__eyebrow", isTriple
    ? "Three bodies, going round shared centres"
    : "Two bodies, going round one shared centre"));
  title.append(el("h2", "cboard__h csys__names", systemNames(body).join(" · ")));
  title.append(el("p", "cboard__count", [
    isTriple ? "A triple system" : (probablyTriple ? "A binary, probably a triple" : "A binary system"),
    outer
      ? `${formatKm(inner.distanceKm)} and ${formatKm(outer.distanceKm)} apart`
      : `${formatKm(inner.distanceKm)} apart`,
    outer
      ? `round every ${formatPeriod(inner.periodDays)} and ${formatPeriod(outer.periodDays)}`
      : `round every ${formatPeriod(inner.periodDays)}`,
  ].join(" · ")));
  head.append(title);
  const whatIs = el("button", "cgloss__ask csys__ask", "What is a binary?");
  whatIs.type = "button";
  whatIs.dataset.gloss = "binary";
  whatIs.setAttribute("aria-expanded", "false");
  head.append(whatIs);
  const shut = closeButton("Back to all bodies");
  shut.dataset.moonBack = "1";
  head.append(shut);
  board.append(head);

  // ------------------------------------------------------------ the map
  const stage = el("div", "cmoons__stage");
  const sky = el("div", "cmoons__sky csys__sky");
  const map = el("div", "csys__map");
  const paths = svg("svg", { class: "csys__paths", viewBox: "-500 -500 1000 1000", "aria-hidden": "true" });

  const pathNodes = [];
  function addPath(d, member, parent) {
    const node = svg("path", { d, class: "csys__path" });
    parent.append(node);
    pathNodes.push({ node, member });
    return node;
  }
  const innerGroup = svg("g", { class: "csys__inner" });
  if (outerOrbit) {
    addPath(pathFor(outerOrbit, 1 / (1 + qo)), 2, paths);
    addPath(pathFor(outerOrbit, -qo / (1 + qo)), -1, paths).classList.add("is-centre-path");
  }
  addPath(pathFor(innerOrbit, -qi / (1 + qi)), 0, innerGroup);
  addPath(pathFor(innerOrbit, 1 / (1 + qi)), 1, innerGroup);
  paths.append(innerGroup);
  const tie = svg("line", { class: "csys__tie" });
  paths.append(tie);
  const outerTie = outer ? svg("line", { class: "csys__tie is-outer" }) : null;
  if (outerTie) paths.append(outerTie);

  // The shared centre, and a triple's inner one, which moves.
  const centre = svg("g", { class: "csys__centre" });
  centre.append(svg("circle", { r: 7, class: "csys__centre-ring" }), svg("circle", { r: 2.4, class: "csys__centre-dot" }));
  const centreText = svg("text", { class: "csys__centre-label" });
  centreText.textContent = isTriple ? "centre of all three" : "shared centre";
  centre.append(centreText);
  paths.append(centre);
  let pairCentre = null;
  if (outer) {
    pairCentre = svg("g", { class: "csys__centre is-pair" });
    pairCentre.append(svg("circle", { r: 5, class: "csys__centre-ring" }), svg("circle", { r: 1.8, class: "csys__centre-dot" }));
    /* Unlabelled: for Lempo it is 5 units from the system's centre, and
     * two labels there were one unreadable one. The card and the text at
     * the side say what it is. */
    innerGroup.append(pairCentre);
  }
  map.append(paths);

  // The globes.
  const surfaces = [];
  const globes = members.map((member, index) => {
    const button = el("button", "csys__body");
    button.type = "button";
    button.dataset.sys = String(index);
    button.dataset.sysName = member.name;
    button.setAttribute("aria-label", `${member.name}: show its facts. Double-click to fly there.`);
    const globe = el("span", `csys__globe${member.lobed ? " is-lobed" : ""}`);
    /* A turn every few seconds, slower for the slow spinners: 5.5 h
     * Altjira in about 6 s, 11.9 h Manwë in about 8 s; the 300 h locked
     * pair turn only to keep facing each other. */
    const hours = member.rotationHours ?? 8;
    globe.style.setProperty("--spin", `${Math.min(40, Math.max(6, 8 * (hours / 10) ** 0.4)).toFixed(1)}s`);
    const turn = el("span", "csys__turn");
    const lobes = member.lobed ? [el("span", "csys__lobe"), el("span", "csys__lobe")] : [el("span", "csys__lobe is-whole")];
    lobes.forEach((lobe) => {
      const canvas = el("canvas", `csys__surface${member.locked ? " is-locked" : ""}`);
      lobe.style.setProperty("--swatch", body.swatch ?? "#a5694f");
      lobe.append(canvas, el("span", "csys__shade"));
      turn.append(lobe);
      surfaces.push({ canvas, member, lobe });
    });
    globe.append(turn);
    button.append(globe, el("span", "csys__label", member.name));
    map.append(button);
    return { button, globe, turn, member, x: 0, y: 0 };
  });

  const hint = el("p", "cmoons__hint");
  hint.setAttribute("aria-live", "polite");
  const hintIcon = el("span", "cmoons__hint-icon");
  hintIcon.setAttribute("aria-hidden", "true");
  const hintText = el("span", "cmoons__hint-text");
  hint.append(hintIcon, hintText);

  const note = el("p", "cmoons__note csys__note", [
    "Seen from above the orbits",
    "paths to scale",
    enlarge < 1.15 ? "bodies to scale" : `bodies drawn ${enlarge < 3 ? enlarge.toFixed(1) : Math.round(enlarge)}× larger`,
    widen > 1.05 ? `inner pair's orbit drawn ${Math.round(widen)}× wider` : null,
    "time sped up",
  ].filter(Boolean).join(" · "));

  /* The real spacing, on one line: the two named-most bodies at their true
   * size and their true distance apart. */
  const scaleStrip = el("div", "csys__scale");
  const trueSep = top.distanceKm;
  const widths = trueSep / (body.diameterKm || 1);
  const stripW = 300;
  const px = (stripW - 20) / trueSep;
  const rA = Math.max(0.8, ((body.diameterKm || 0) / 2) * px);
  const other = outer ?? inner;
  const rB = Math.max(0.8, ((other.diameterKm || 0) / 2) * px);
  const strip = svg("svg", { class: "csys__scale-art", viewBox: `0 0 ${stripW} 22`, "aria-hidden": "true" });
  strip.innerHTML = `<line x1="10" y1="11" x2="${stripW - 10}" y2="11" class="csys__scale-line" />`
    + `<circle cx="10" cy="11" r="${rA.toFixed(2)}" class="csys__scale-dot" />`
    + `<circle cx="${stripW - 10}" cy="11" r="${rB.toFixed(2)}" class="csys__scale-dot" />`;
  scaleStrip.append(el("span", "csys__scale-title", "True to scale"), strip,
    el("span", "csys__scale-text", `${outer ? `${outer.name} and the ${body.name}–${inner.name} pair` : `${body.name} and ${inner.name}`}: ${Math.round(widths).toLocaleString("en-GB")} of ${body.name}'s widths apart`));

  sky.append(hint, map, note, scaleStrip);

  // ------------------------------------------------------------ the side
  const side = el("aside", "cmoons__side csys__side");
  const card = el("div", "cmoons__card");
  card.setAttribute("aria-live", "polite");
  side.append(card);
  side.append(el("h3", "cmoons__side-title", isTriple
    ? "Why this is a triple, not a planet with moons"
    : "Why this is a binary, not a planet and moon"));
  const more = el("div", "csys__more");
  side.append(more);

  const compare = el("div", "csys__compare");
  const planetMoon = el("figure", "csys__fig");
  planetMoon.append(glossaryArt("planet-moon", "csys__art"), el("figcaption", null, "A planet and its moon"));
  const thisOne = el("figure", "csys__fig is-this");
  thisOne.append(glossaryArt(isTriple ? "triple" : "binary", "csys__art"), el("figcaption", null, `The ${body.name} system`));
  compare.append(planetMoon, thisOne);
  more.append(compare);

  const ratio = centreFromPrimary / Math.max(1, primaryRadius);
  const why = [];
  if (isTriple) {
    why.push(`${body.name} and ${inner.name} go round their own shared centre every ${formatPeriod(inner.periodDays)}. ${outer.name} goes round that pair every ${formatPeriod(outer.periodDays)}. Three bodies, two levels of going round, and every centre in open space.`);
  } else {
    why.push(`Earth's Moon goes round a point ${EARTH_MOON_CENTRE_KM.toLocaleString("en-GB")} km from Earth's centre, inside Earth. Here the shared centre is ${formatKm(centreFromPrimary)} from ${body.name}'s centre, ${ratio >= 2 ? `${Math.round(ratio)} times` : "more than"} its radius, out in the space between the two.`);
    why.push(`So ${body.name} and ${inner.name} both go round it. Neither is the other's moon.`);
  }
  if (probablyTriple) {
    why.push(`${body.name} itself is probably two bodies about 124 km apart, too close for any telescope to split (Nelsen et al. 2025). That would make this a triple, drawn here as ${body.name}'s two lobes.`);
  } else if (contactPrimary) {
    why.push(`${body.name} itself is two lobes touching at a narrow neck, a "contact binary", so there are three pieces here in all.`);
  }
  why.forEach((text) => more.append(el("p", "csys__why", text)));

  more.append(el("h3", "cmoons__side-title csys__list-title", isTriple ? "The three" : "The two"));
  const list = el("ol", "csys__list");
  const rows = members.map((member, index) => {
    const row = el("button", "csys__row");
    row.type = "button";
    row.dataset.sys = String(index);
    const swatch = el("span", "csys__row-dot");
    swatch.style.setProperty("--swatch", body.swatch ?? "#a5694f");
    const text = el("span", "csys__row-text");
    text.append(el("span", "csys__row-name", member.name));
    text.append(el("span", "csys__row-meta", [
      formatKm(member.diameterKm) && `${formatKm(member.diameterKm)} across`,
      `${Math.round((member.mass / totalMass) * 100)}% of the mass`,
    ].filter(Boolean).join(" · ")));
    row.append(swatch, text);
    const item = el("li");
    item.append(row);
    list.append(item);
    return row;
  });
  more.append(list);

  stage.append(sky, side);
  board.append(stage);

  // ------------------------------------------------------------ the card
  function facts(pairs) {
    const dl = el("dl", "cmoons__facts");
    pairs.filter(([, value]) => value).forEach(([term, value]) => {
      const cell = el("div");
      cell.append(el("dt", null, term), el("dd", null, value));
      dl.append(cell);
    });
    return dl;
  }
  function flyButton(name, label = `Fly to ${name} →`) {
    const fly = el("button", "cmoons__fly", label);
    fly.type = "button";
    fly.dataset.travel = name;
    return fly;
  }

  const roleWords = (member) => {
    if (member.role === "primary") return `Named body${member.name === heaviest.name ? " · the heaviest" : ""}`;
    if (member.role === "partner") return `Partner of ${body.name}${member.name === heaviest.name ? " · the heaviest" : ""}`;
    return `Goes round the ${body.name}–${inner.name} pair`;
  };
  const toCentre = (member) => {
    if (member.role === "primary") return formatKm(centreFromPrimary);
    if (member.role === "partner") return formatKm(inner.distanceKm / (1 + qi));
    return formatKm(outer.distanceKm / (1 + qo));
  };

  let shown = undefined;
  function writeCard(index) {
    if (index === shown) return;
    shown = index;
    card.textContent = "";
    const member = index == null ? null : members[index];
    if (!member) {
      card.append(el("span", "cboard__eyebrow", isTriple ? "Triple system" : "Binary system"));
      card.append(el("h3", "cmoons__card-name", `The ${body.name} system`));
      card.append(el("p", "cmoons__card-sub",
        String(body.classification ?? "").split("·").slice(1).map((s) => s.trim()).filter(Boolean).join(" · ")
          || `${count} bodies`));
      card.append(facts([
        ["Apart", outer ? `${Math.round(inner.distanceKm).toLocaleString("en-GB")} · ${formatKm(outer.distanceKm)}` : formatKm(inner.distanceKm)],
        ["Once round", outer ? `${formatPeriod(inner.periodDays).replace(" days", "")} · ${formatPeriod(outer.periodDays)}` : formatPeriod(inner.periodDays)],
        ["Shared centre", centreInOpenSpace ? "In open space" : `Inside ${body.name}`],
        ["Heaviest", heaviest.name],
        ["Path shape", describeShape(top.eccentricity ?? 0)],
        ["Direction", (top.inclinationDeg ?? 0) > 90 ? "Backwards" : "Forwards"],
      ]));
      const actions = el("div", "cmoons__actions");
      actions.append(flyButton(body.name, "Fly to the system →"));
      card.append(actions);
      return;
    }
    card.append(el("span", "cboard__eyebrow", roleWords(member)));
    card.append(el("h3", "cmoons__card-name", member.name));
    card.append(el("p", "cmoons__card-sub", member.classification || "Binary partner"));
    card.append(facts([
      ["Across", formatKm(member.diameterKm)],
      ["Share of the mass", `${Math.round((member.mass / totalMass) * 100)}%`],
      [member.role === "primary" || member.role === "partner" ? (outer ? "To the pair's centre" : "To the shared centre") : "To the system's centre", toCentre(member)],
      ["Spins in", member.locked ? "Locked: one face to its partner" : formatHours(member.rotationHours)],
      ["Shape", member.lobed ? "Two lobes" : null],
    ]));
    const actions = el("div", "cmoons__actions");
    actions.append(flyButton(member.name));
    card.append(actions);
  }

  function describeShape(e) {
    if (e < 0.05) return "Nearly round";
    return `Oval, e = ${e.toFixed(2)}`;
  }

  // ------------------------------------------------------------ state
  const state = { pick: null, hover: null };
  let hintFor;
  function writeHint() {
    const index = state.hover ?? state.pick;
    const name = index != null ? members[index].name : null;
    if (name === hintFor) return;
    hintFor = name;
    hintText.textContent = "";
    const first = el("span", "cmoons__hint-line");
    first.append("Double-click ", el("b", null, name ?? "a body"));
    hintText.append(first, el("span", "cmoons__hint-line", "to fly there"));
    hint.classList.toggle("is-named", Boolean(name));
  }
  function render() {
    const lit = state.hover ?? state.pick;
    globes.forEach((g, i) => {
      g.button.classList.toggle("is-picked", i === state.pick);
      g.button.classList.toggle("is-hot", i === lit);
    });
    rows.forEach((row, i) => row.classList.toggle("is-picked", i === state.pick));
    pathNodes.forEach(({ node, member }) => node.classList.toggle("is-lit", lit != null && member === lit));
    map.classList.toggle("has-lit", lit != null);
    writeCard(state.pick);
    writeHint();
  }

  board.addEventListener("click", (event) => {
    const hit = event.target.closest("[data-sys]");
    if (!hit) return;
    const index = Number(hit.dataset.sys);
    state.pick = state.pick === index ? null : index;
    render();
  });
  board.addEventListener("dblclick", (event) => {
    const hit = event.target.closest("[data-sys]");
    if (!hit) return;
    const index = Number(hit.dataset.sys);
    travel(members[index].name, globes[index].button);
  });
  board.addEventListener("pointerover", (event) => {
    const hit = event.target.closest?.("[data-sys]");
    const index = hit ? Number(hit.dataset.sys) : null;
    if (index === state.hover) return;
    state.hover = index;
    render();
  });
  board.addEventListener("pointerout", (event) => {
    if (event.relatedTarget?.closest?.("[data-sys]")) return;
    if (state.hover == null) return;
    state.hover = null;
    render();
  });

  // ------------------------------------------------------------ motion
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const _o = { x: 0, y: 0 };
  const _i = { x: 0, y: 0 };
  let unit = 0.5; // px per map unit
  let frame = 0;
  let started = 0;

  function place(t) {
    let cx = 0;
    let cy = 0;
    if (outerOrbit) {
      rel(outerOrbit, t, _o);
      cx = (-_o.x * qo) / (1 + qo);
      cy = (-_o.y * qo) / (1 + qo);
      globes[2].x = _o.x / (1 + qo);
      globes[2].y = _o.y / (1 + qo);
      innerGroup.setAttribute("transform", `translate(${cx.toFixed(2)} ${cy.toFixed(2)})`);
    }
    rel(innerOrbit, t, _i);
    globes[0].x = cx - (_i.x * qi) / (1 + qi);
    globes[0].y = cy - (_i.y * qi) / (1 + qi);
    globes[1].x = cx + _i.x / (1 + qi);
    globes[1].y = cy + _i.y / (1 + qi);
    globes.forEach((g) => {
      g.button.style.transform = `translate(${(g.x * unit).toFixed(1)}px, ${(g.y * unit).toFixed(1)}px)`;
    });
    /* A locked pair keeps one face on the other: each turns to point along
     * the line between them. */
    const angle = Math.atan2(globes[1].y - globes[0].y, globes[1].x - globes[0].x);
    if (members[0].locked) globes[0].turn.style.transform = `rotate(${angle.toFixed(3)}rad)`;
    if (members[1].locked) globes[1].turn.style.transform = `rotate(${(angle + Math.PI).toFixed(3)}rad)`;
    tie.setAttribute("x1", globes[0].x.toFixed(1));
    tie.setAttribute("y1", globes[0].y.toFixed(1));
    tie.setAttribute("x2", globes[1].x.toFixed(1));
    tie.setAttribute("y2", globes[1].y.toFixed(1));
    if (outerTie) {
      outerTie.setAttribute("x1", cx.toFixed(1));
      outerTie.setAttribute("y1", cy.toFixed(1));
      outerTie.setAttribute("x2", globes[2].x.toFixed(1));
      outerTie.setAttribute("y2", globes[2].y.toFixed(1));
    }
  }

  function tick(now) {
    if (!started) started = now;
    place((now - started) / 1000);
    frame = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ surfaces
  function paint({ canvas, member, lobe }, diameterPx) {
    const found = surfaceFor?.(member.name) ?? null;
    const draw = (image, flipY) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const h = Math.max(24, Math.round(diameterPx * dpr));
      const w = h * 4;
      if (canvas.width === w && canvas.height === h && canvas.dataset.painted) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      try {
        for (let copy = 0; copy < 2; copy += 1) {
          ctx.save();
          if (flipY) {
            ctx.translate(0, h);
            ctx.scale(1, -1);
          }
          ctx.drawImage(image, copy * (w / 2), 0, w / 2, h);
          ctx.restore();
        }
        canvas.dataset.painted = "1";
        /* Each body's own colour for its row in the list: the map averaged
         * to one pixel. Partners are painted differently now (Hiisi
         * scarlet-orange beside crimson Lempo), and one system swatch for
         * all of them said the opposite. */
        try {
          const probe = document.createElement("canvas");
          probe.width = 1;
          probe.height = 1;
          const pctx = probe.getContext("2d");
          pctx.drawImage(canvas, 0, 0, 1, 1);
          const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
          const row = rows[members.indexOf(member)];
          row?.querySelector(".csys__row-dot")?.style.setProperty("--swatch", `rgb(${r} ${g} ${b})`);
        } catch {
          // A map from another origin can be drawn but not read; keep the swatch.
        }
        lobe.classList.add("has-surface");
      } catch {
        lobe.classList.remove("has-surface");
      }
    };
    if (found?.image) {
      draw(found.image, found.flipY);
      return;
    }
    // Not loaded by the scene yet: fetch the same file it would.
    const url = smallBodyTextureUrl(member.name);
    if (!url) return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { if (canvas.isConnected) draw(image, false); };
    image.src = url;
  }

  // ------------------------------------------------------------ size
  function fit() {
    const room = sky.clientHeight - note.offsetHeight - scaleStrip.offsetHeight - 36;
    const size = Math.max(240, Math.floor(Math.min(sky.clientWidth - 16, room)));
    map.style.width = `${size}px`;
    map.style.height = `${size}px`;
    unit = size / 1000;
    globes.forEach((g) => {
      const d = g.member.drawn * unit;
      const w = g.member.lobed ? d * 1.45 : d;
      g.globe.style.width = `${w.toFixed(1)}px`;
      g.globe.style.height = `${d.toFixed(1)}px`;
      g.button.style.setProperty("--d", `${d.toFixed(1)}px`);
    });
    surfaces.forEach((surface) => {
      const d = surface.member.drawn * unit * (surface.member.lobed ? 0.78 : 1);
      paint(surface, d);
    });
    paths.style.setProperty("--u", String(1 / unit));
    // Labels a fixed number of pixels off their centre, above and below,
    // so a triple's two centres (5 units apart for Lempo) do not collide.
    paths.querySelectorAll(".csys__centre-label").forEach((text) => {
      text.setAttribute("y", String((text.classList.contains("is-below") ? 20 : -11) / unit));
    });
    if (reduceMotion) place(3);
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  observer?.observe(sky);

  if (reduceMotion) place(3);
  else frame = requestAnimationFrame(tick);

  function clearSelection() {
    if (state.pick == null) return false;
    state.pick = null;
    render();
    return true;
  }

  function destroy() {
    cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
  }

  return { board, filterBox: null, back, fit, render, clearSelection, destroy };
}

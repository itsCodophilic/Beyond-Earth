import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { WHITE_SUN } from "./real.js";
import { halleyReal, haleBoppReal, neowiseReal, tsuchinshanReal, holmesReal, breakupReal, enckeReal } from "./cometScenes.js";

/**
 * Section 9 of the catalogue: comets (round 79).
 *
 * Eight events: Halley's return, the great comets of 1997, 2020 and 2024,
 * Holmes's outburst, a comet falling apart, a tail snapped off by the Sun,
 * and why a comet has two tails. The site's interstellar comets and its
 * sungrazer are separate events. Round 87: the first seven now play on the
 * site's real Sun, Earth, Mars and comets (cometScenes.js); Hale–Bopp's
 * and Holmes's round-79 pictures follow their real-body views. The old
 * dioramas are kept in docs/archive/comet-dioramas-round79/comets.js.
 *
 * Orbits are from JPL's Small-Body Database (ssd.jpl.nasa.gov) unless a
 * comment says otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const tmpV = new THREE.Vector3();

/** Eccentric anomaly by bisection (robust for e near 1). */
function keplerE(M, e) {
  const m = ((M % TAU) + TAU) % TAU;
  let lo = 0;
  let hi = TAU;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) < m) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Position on an orbit, focus at the origin, perihelion along +x: [x, y]. */
function orbitAt(a, e, M) {
  const E = keplerE(M, e);
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
}

/*
 * Perspective stretches a sphere drawn far off the lens's axis into an oval
 * (the hud sits left of centre). This squeezes it back to a circle on
 * screen: the stretch is 1/cos of the angle off-axis, in each direction.
 */
const _inv = new THREE.Matrix4();
function roundOnScreen(ctx, mesh) {
  mesh.scale.set(1, 1, 1);
  _inv.copy(ctx.camera.matrixWorld).invert();
  const v = mesh.getWorldPosition(tmpV).applyMatrix4(_inv);
  const d = -v.z;
  if (d <= 0) return;
  mesh.scale.set(Math.cos(Math.atan(v.x / d)), Math.cos(Math.atan(v.y / d)), 1);
}

/*
 * A comet drawn with particles: a coma, a broad curving dust tail and a
 * narrow straight ion tail. `draw` takes the head and two unit vectors in
 * the parent's space: `anti` (away from the Sun) and `back` (opposite the
 * comet's motion, which the dust lags toward). `normal` is the plane the
 * tails lie in. Lengths in hud units.
 */
function makeComet(ctx, { parent = ctx.root, dust = 800, ion = 420, seed = 5, size = 1, dustColour = "#fff1d8", ionColour = "#6fa6ff", comaColour = "#cfe8ff" } = {}) {
  const group = new THREE.Group();
  parent.add(group);
  const r = rng(seed);
  const dustCloud = dust ? ctx.cloud(dust, { parent: group, size: 3 * size }) : null;
  const ionCloud = ion ? ctx.cloud(ion, { parent: group, size: 2.6 * size }) : null;
  const dc = new THREE.Color(dustColour);
  const warm = new THREE.Color("#ffd49a");
  const ic = new THREE.Color(ionColour);
  const ic2 = new THREE.Color("#bfe0ff");
  const dustP = Array.from({ length: dust }, (_, i) => {
    dustCloud.tint(i, dc.clone().lerp(warm, r() * 0.6));
    dustCloud.size[i] = 3 * size * (0.6 + r() * 0.9);
    return { s: Math.pow(r(), 0.8), u: r() * 2 - 1, g: r() };
  });
  const ionP = Array.from({ length: ion }, (_, i) => {
    ionCloud.tint(i, ic.clone().lerp(ic2, r() * 0.35));
    return { s: r(), u: (r() * 2 - 1) * Math.pow(r(), 1.5), g: r(), ray: Math.floor(r() * 5) - 2 };
  });
  const coma = ctx.glow(comaColour, 0.15, { opacity: 0.85, parent: group });
  const core = ctx.glow("#ffffff", 0.045, { opacity: 1, parent: group });
  const perp = new THREE.Vector3();
  const pos = new THREE.Vector3();
  return {
    group, dustCloud, ionCloud, coma, core,
    draw({ head, anti, back = null, normal = null, dustLen = 0.45, ionLen = 0.65, spread = 0.2, curve = 0.35, dustOn = 1, ionOn = 1, comaSize = 0.15, glow = 1, alpha = 1, t = 0 }) {
      perp.crossVectors(normal ?? new THREE.Vector3(0, 0, 1), anti).normalize();
      const bk = back ?? perp;
      group.visible = alpha > 0.002;
      for (let i = 0; i < dust; i += 1) {
        const d = dustP[i];
        const L = dustLen * d.s;
        pos.copy(head).addScaledVector(anti, L).addScaledVector(bk, curve * L * d.s).addScaledVector(perp, d.u * spread * L);
        dustCloud.set(i, pos.x, pos.y, pos.z);
        dustCloud.alpha[i] = Math.min(1, alpha * dustOn * Math.pow(1 - d.s, 1.1) * (0.4 + 0.6 * d.g) * (1 - 0.45 * d.u * d.u));
      }
      if (dust) dustCloud.commit();
      for (let i = 0; i < ion; i += 1) {
        const d = ionP[i];
        const L = ionLen * d.s;
        const across = d.u * 0.012 * size + d.ray * 0.01 * d.s * size + 0.012 * d.s * Math.sin(d.s * 8 + t * 1.3 + d.ray);
        pos.copy(head).addScaledVector(anti, L).addScaledVector(perp, across);
        ionCloud.set(i, pos.x, pos.y, pos.z);
        ionCloud.alpha[i] = Math.min(1, alpha * ionOn * Math.pow(1 - d.s, 0.6) * (0.45 + 0.55 * d.g));
      }
      if (ion) ionCloud.commit();
      coma.position.copy(head);
      core.position.copy(head);
      coma.scale.setScalar(Math.max(0.001, comaSize * (0.6 + 0.4 * glow)));
      core.scale.setScalar(Math.max(0.001, comaSize * 0.3));
      ctx.fade(coma, alpha * glow);
      ctx.fade(core, alpha * Math.min(1, 0.4 + glow));
    },
  };
}

/*
 * An evening sky: stars, a twilight glow and a dark horizon drawn over the
 * comet's lower end (renderOrder 28, after the particles and glows).
 */
function nightSky(ctx, { seed = 9, twilight = "#ff8a4a", twilightOpacity = 0.32, city = false } = {}) {
  const group = new THREE.Group();
  ctx.add(group);
  ctx.starfield(240, { radius: 0.66, depth: -0.5, seed, parent: group });
  const glow = ctx.glow(twilight, 2.0, { opacity: twilightOpacity, parent: group });
  glow.position.set(-0.15, -0.5, -0.4);
  if (city) {
    const lights = ctx.glow("#ffb36b", 1.1, { opacity: 0.4, parent: group });
    lights.position.set(0.5, -0.56, -0.3);
  }
  const r = rng(seed + 3);
  const pts = [[-1.2, -1.25]];
  for (let i = 0; i <= 40; i += 1) {
    const x = lerp(-1.2, 1.2, i / 40);
    pts.push([x, -0.52 + 0.035 * Math.sin(x * 4.1 + 1) + 0.02 * Math.sin(x * 11 + 2) + r() * 0.006]);
  }
  pts.push([1.2, -1.25]);
  const ground = ctx.shape(pts, { colour: "#000000", opacity: 1, parent: group });
  ground.renderOrder = 28;
  ground.position.z = 0.05;
  return group;
}

/*
 * Round 87: the round-79 Hale–Bopp sky, now a picture played after the
 * real comet (cometScenes.js) on its own clock q (0..1): the months of 1997
 * with the comet moving night by night against the stars, the nuclei to
 * scale, then the two tails named.
 */
function haleBoppSky(ctx) {
  nightSky(ctx, { seed: 13, twilight: "#4a6aa8", twilightOpacity: 0.28, city: true });
  const comet = makeComet(ctx, { dust: 1500, ion: 600, seed: 21, size: 1.1 });
  /* Nuclei to scale: Hale–Bopp ~60 km (Szabó et al. 2012 give ~74 ± 8;
   * most estimates 40–80); Halley 15 × 8 km (Giotto); 67P ~4 km (Rosetta).
   * Radius 0.004 hud per km. */
  const kN = 0.004;
  const nuclei = new THREE.Group();
  ctx.add(nuclei);
  const hb = ctx.rock(30 * kN, { seed: 3, lumps: 0.18, colour: "#5a5550", parent: nuclei });
  hb.position.set(0.36, -0.2, 0);
  const ha = ctx.rock(7.5 * kN, { seed: 8, lumps: 0.25, stretch: [1, 0.55, 0.55], colour: "#4a4642", parent: nuclei });
  ha.position.set(0.68, -0.2, 0);
  const cg = ctx.rock(2.05 * kN, { seed: 12, lumps: 0.3, stretch: [1, 0.8, 0.6], colour: "#4a4642", parent: nuclei, detail: 2 });
  cg.position.set(0.9, -0.2, 0);
  const nucleusLabels = [
    ctx.label(["Hale–Bopp", "~60 km"], { at: [0.36, 0.0, 0], height: 0.03 }),
    ctx.label(["Halley", "15 km"], { at: [0.68, -0.34, 0], height: 0.03 }),
    ctx.label(["67P", "~4 km"], { at: [0.92, -0.08, 0], height: 0.03 }),
  ];
  const nucleiTitle = ctx.label(["Nuclei to scale"], { at: [0.62, 0.2, 0], height: 0.026, colour: "#ffe2a8" });
  const ionLabel = ctx.label(["Gas (ion) tail", "straight and blue"], { height: 0.034, colour: "#9fc6ff", sub: "#7fa6d8" });
  const dustLabel = ctx.label(["Dust tail", "broad, curved, white"], { height: 0.034, colour: "#fff1d8" });
  const counter = ctx.label(["", ""], { at: [0.55, 0.72, 0], height: 0.04 });
  const nightsLabel = ctx.label(["It moves a little each night", "against the stars"], { at: [0.55, 0.5, 0], height: 0.032, colour: "#cfe0ff" });
  /* The Sun below the north-western horizon, lower left: the tails point
   * up and away from it. (A picture of spring 1997, not a star chart.) */
  const sunBelow = new THREE.Vector3(-1.4, -1.3, 0);
  const headAt = (m) => new THREE.Vector3(lerp(-0.72, 0.05, m / 18), -0.36 + 0.42 * Math.sin((Math.PI * m) / 18), 0);
  return {
    update(q) {
      /* 18 naked-eye months, brightest near perihelion (month ~11). */
      const month = 18 * span(q, 0.0, 0.38);
      const bright = 0.35 + 0.65 * Math.exp(-(((month - 11) / 4.5) ** 2));
      const keepOn = q > 0.38 ? 1 : bright;
      const head = headAt(Math.min(month, 18));
      const anti = head.clone().sub(sunBelow).normalize();
      const back = new THREE.Vector3(-anti.y, anti.x, 0);
      const dim = 1 - 0.45 * win(q, 0.4, 0.7, 0.04);
      comet.draw({ head, anti, back, dustLen: 0.5 * (0.6 + 0.4 * keepOn), ionLen: 0.7 * (0.6 + 0.4 * keepOn), spread: 0.42, curve: 0.55, dustOn: keepOn, ionOn: keepOn, comaSize: 0.17, glow: keepOn, alpha: dim * smooth(q, 0, 0.03), t: ctx.t });
      counter.userData.draw(q < 0.38 ? [`Month ${Math.max(1, Math.ceil(month))} of about 18`, Math.abs(month - 11) < 1.2 ? "perihelion: April 1, 1997" : "visible without a telescope"] : ["Hale–Bopp, 1997", "about 18 months to the naked eye"]);
      ctx.fade(nightsLabel, win(q, 0.04, 0.38, 0.03));
      const nA = win(q, 0.4, 0.72, 0.03);
      ctx.fade(nuclei, nA);
      nucleusLabels.forEach((l) => ctx.fade(l, nA));
      ctx.fade(nucleiTitle, nA);
      [hb, ha, cg].forEach((m, i) => { m.rotation.set(0.3, ctx.t * 0.3 + i, 0); });
      const tA = smooth(q, 0.72, 0.78);
      ionLabel.position.copy(head).addScaledVector(anti, 0.6).add(new THREE.Vector3(0.16, 0, 0));
      dustLabel.position.copy(head).addScaledVector(anti, 0.3).addScaledVector(back, 0.3).add(new THREE.Vector3(-0.1, 0, 0));
      ctx.fade(ionLabel, tA);
      ctx.fade(dustLabel, tA);
    },
  };
}

/*
 * Round 87: the round-79 Holmes picture -- the dust cloud beside the Sun,
 * to one scale -- now played after the real-orbit view (cometScenes.js),
 * on its own clock q (the outburst at 0.14–0.24, growth to 0.86).
 */
function holmesPanel(ctx) {
  /* Sun radius 695,700 km (IAU); coma ~1.4 million km across by 9 Nov
   * 2007 (16 days after the outburst). */
  const RS = 0.26;
  const k = RS / 695700;
  const DAYS = 16;
  const DMAX = 1.4e6;
  const sun = ctx.sun(RS, { halo: 1.7, haloOpacity: 0.35, ...WHITE_SUN });
  sun.position.set(0.66, 0.02, 0);
  const sunLabel = ctx.label(["The Sun, same scale", "1.39 million km wide"], { at: [0.66, -0.4, 0], height: 0.03 });
  const CEN = new THREE.Vector3(-0.38, 0.02, 0);
  const comaGlow = ctx.glow("#ffe6a8", 0.1, { opacity: 0.7 });
  const N = 1400;
  const shell = ctx.cloud(N, { size: 2 });
  const r = rng(47);
  const shellP = Array.from({ length: N }, () => {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    return { v, d: Math.pow(r(), 0.35), g: r() };
  });
  shellP.forEach((q, i) => shell.tint(i, q.g > 0.7 ? "#fff6dc" : "#ffd98f"));
  const core = ctx.glow("#ffffff", 0.05, { opacity: 1 });
  const ring = ctx.circle(1, { plane: "xy", colour: "#ffe2a8", opacity: 0.6, dashed: true, dash: 0.02, gap: 0.02 });
  const size = ctx.label(["", ""], { at: [-0.38, -0.5, 0], height: 0.034 });
  const tmp = new THREE.Vector3();
  return {
    update(q) {
      sun.rotation.y = ctx.t * 0.15;
      const days = DAYS * span(q, 0.22, 0.86);
      const D = Math.max(20000, DMAX * (days / DAYS));
      const R = (D / 2) * k;
      const drift = R * 0.25;
      const centre = tmp.copy(CEN).add(new THREE.Vector3(-drift, 0, 0)).clone();
      for (let i = 0; i < N; i += 1) {
        const s = shellP[i];
        shell.set(i, centre.x + s.v.x * s.d * R, centre.y + s.v.y * s.d * R, centre.z + s.v.z * s.d * R * 0.3);
        shell.alpha[i] = (0.25 + 0.5 * s.g) * (0.4 + 0.6 * s.d);
      }
      shell.commit();
      comaGlow.position.copy(centre);
      comaGlow.scale.setScalar(Math.max(0.03, R * 2.4));
      core.position.copy(CEN);
      core.scale.setScalar(0.06);
      ring.position.copy(centre);
      ring.scale.setScalar(Math.max(0.001, R));
      ctx.fade(ring, smooth(q, 0.62, 0.7));
      size.userData.draw([`Day ${Math.round(days)}: ${fmt(Math.round(D / 10000) * 10000)} km across`, D >= 1.39e6 ? "wider than the Sun" : `${Math.round((D / 1.3914e6) * 100)}% of the Sun's width`]);
      size.position.y = Math.min(-0.36, -R - 0.12);
      ctx.fade(sunLabel, 1);
    },
  };
}

export const COMET_EVENTS = [
  /* ------------------------------------------------------------------ 88 */
  event({
    id: "halley-2061",
    section: "comets",
    title: "Halley's return",
    place: "Inner Solar System",
    kind: "recurring",
    family: "smallBody",
    when: "Next perihelion July 28, 2061",
    often: "about every 76 years",
    timeline: { last: "February 9, 1986", next: "July 28, 2061" },
    detail: "The most famous comet comes back about every 76 years — next at its closest to the Sun on July 28, 2061",
    frequency: "About every 76 years; the exact gap varies between about 74 and 79 years as the planets tug on it. Its returns have been recorded at least since 240 BC.",
    cause: "Halley's Comet travels a long, narrow orbit that runs backwards compared with the planets. It swings in to 0.59 AU from the Sun, inside Venus's orbit, and out to about 35 AU, beyond Neptune. It reached that farthest point in December 2023 and is now falling back toward the Sun.",
    note: "It is in the Bayeux Tapestry, seen in 1066 before the Norman Conquest. Edmond Halley showed that the comets of 1531, 1607 and 1682 were one object and predicted its return; it came back in 1758–59, sixteen years after his death.",
    accuracy: "The site's own Halley, carried along its own orbit (the site draws it as a true conic on its squeezed distance scale) with its own coma and tails, round the site's Sun; 75 years pass in the length of her line. The record of returns along the bottom is to scale in time.",
    art: { main: "comet", second: "sun", fx: "orbit" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: halleyReal,
  }),

  /* ------------------------------------------------------------------ 89 */
  event({
    id: "hale-bopp",
    section: "comets",
    title: "Comet Hale–Bopp",
    place: "Inner Solar System",
    kind: "recorded",
    family: "smallBody",
    when: "Perihelion April 1, 1997",
    often: "once in about 2,500 years",
    timeline: { last: "Perihelion April 1, 1997", next: "Around the year 4380 (estimate)" },
    detail: "In 1997 Hale–Bopp hung in the sky for about 18 months, bright enough to see from cities, with a blue gas tail and a white dust tail",
    frequency: "Once in a lifetime: its orbit takes about 2,500 years, so its next visit is expected around the year 4380.",
    cause: "Hale–Bopp's nucleus is unusually large — roughly 60 km across (estimates run from about 40 to 80 km), several times the size of most comets. A big nucleus gives off huge amounts of gas and dust, so it was bright even far from the Sun: it was found in July 1995, while still beyond Jupiter's orbit.",
    note: "It was visible to the naked eye for a record of about 18 months, twice as long as the previous record holder, the Great Comet of 1811. It reached perihelion on April 1, 1997, about 0.91 AU from the Sun.",
    accuracy: "First the site's own Hale–Bopp on its own orbit, from 7.2 AU in July 1995 to perihelion, and close on it there. Then the sky scene, an illustration: the comet's slow drift against the stars over the months is a picture, not a star chart. The three nuclei are to scale with each other (Hale–Bopp about 60 km, Halley about 15 × 8 km, 67P about 4 km).",
    art: { main: "comet", fx: "twotails" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: haleBoppReal(haleBoppSky),
  }),

  /* ------------------------------------------------------------------ 90 */
  event({
    id: "tsuchinshan-atlas",
    section: "comets",
    title: "Comet Tsuchinshan–ATLAS",
    place: "Inner Solar System",
    kind: "recorded",
    family: "smallBody",
    when: "October 2024 (perihelion September 27, 2024)",
    often: "once, October 2024",
    timeline: { last: "Perihelion September 27, 2024" },
    detail: "In October 2024 a bright evening comet showed a rare anti-tail: a thin spike that seemed to point toward the Sun",
    frequency: "A one-off visitor. Anti-tails are seen only when Earth passes close to a comet's orbital plane while the comet is bright — a rare line-up.",
    cause: "A comet's dust spreads into a thin sheet in the plane of its orbit, with the oldest, heaviest grains left behind along the orbit. In mid-October 2024 Earth passed through that plane, so we saw the sheet edge-on: the trailing dust lined up and, from our viewpoint, appeared on the Sun's side of the head. It never really pointed at the Sun.",
    note: "C/2023 A3 was found in January 2023 by the Purple Mountain Observatory (Tsuchinshan) in China and in February by the ATLAS survey. It passed 0.39 AU from the Sun on September 27, 2024, and closest to Earth on October 12.",
    accuracy: "The site's own Sun and Earth (put where Earth was on each date), with the comet drawn by the event on its real orbit (JPL elements, drawn parabolic) on the site's distance scale. The dust sheet along the orbit and the tails are pictures of the real geometry; their brightness and length are not to scale.",
    art: { main: "comet", fx: "tail" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: tsuchinshanReal,
  }),

  /* ------------------------------------------------------------------ 91 */
  event({
    id: "neowise",
    section: "comets",
    title: "Comet NEOWISE",
    place: "Inner Solar System",
    kind: "recorded",
    family: "smallBody",
    when: "July 2020 (perihelion July 3, 2020)",
    often: "once in about 6,800 years",
    timeline: { last: "Perihelion July 3, 2020", next: "In about 6,800 years" },
    detail: "In July 2020 Comet NEOWISE became the brightest comet seen from the northern hemisphere in more than twenty years",
    frequency: "Once in about 6,800 years: after this pass, its orbit carries it out to roughly 700 AU before it falls back.",
    cause: "C/2020 F3 was discovered on March 27, 2020, by the NEOWISE space telescope. It passed 0.29 AU from the Sun on July 3 — closer than Mercury — and survived, which many comets that close do not. Heated hard, it threw off a long, curving dust tail and a fainter blue gas tail, and it came closest to Earth on July 23, about 103 million km away.",
    note: "It was the brightest comet from the northern hemisphere since Hale–Bopp in 1997, easily seen without a telescope in July 2020: first low in the morning sky, then in the evening sky.",
    accuracy: "The site's own NEOWISE carried along its own orbit, with its own coma and tails, and the site's Earth put where it was on each date. The far view uses the site's squeezed distance scale, so the 700 AU orbit is to that scale, not a linear one.",
    art: { main: "comet", fx: "tail" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: neowiseReal,
  }),

  /* ------------------------------------------------------------------ 92 */
  event({
    id: "holmes-outburst",
    section: "comets",
    title: "17P/Holmes blows up",
    place: "Inner Solar System · beyond Mars",
    kind: "recorded",
    family: "smallBody",
    when: "October 24, 2007",
    often: "once, 2007 (and 1892)",
    timeline: { last: "October 24, 2007" },
    detail: "In October 2007 a faint comet brightened half a million times in under a day, and its dust cloud grew wider than the Sun",
    frequency: "Rare. Holmes did it before: Edwin Holmes discovered the comet in November 1892 because of a similar outburst. It orbits the Sun every 6.9 years.",
    cause: "Nobody is sure. The comet was about 2.4 AU from the Sun, past its closest point, when a huge amount of dust burst out at once — perhaps from gas building up under the surface, or from a collapse that exposed fresh ice. The dust spread into a sphere that kept expanding for weeks.",
    note: "Within about a day it jumped from magnitude 17, visible only in large telescopes, to about magnitude 3, an easy naked-eye fuzzy star in Perseus. By November 9 the dust cloud was about 1.4 million km across — wider than the Sun.",
    accuracy: "First the site's own Sun, Earth and Mars on the real dates, with Holmes drawn on its real orbit; its dust cloud there is drawn 40 times its real size so it shows. Then, on black, the cloud and the Sun to one true scale, day by day.",
    art: { main: "comet", second: "sun", fx: "burst" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: holmesReal(holmesPanel),
  }),

  /* ------------------------------------------------------------------ 93 */
  event({
    id: "comet-breakup",
    section: "comets",
    title: "A comet falls apart",
    place: "Inner Solar System · Comet 73P",
    kind: "recorded",
    family: "smallBody",
    when: "1995; dozens of pieces by 2006",
    often: "1995, 2006 — still breaking",
    timeline: { last: "Return of 2022, still fragmenting" },
    detail: "Comet Schwassmann–Wachmann 3 began breaking up in 1995; by 2006 it was dozens of pieces strung along its orbit, each with its own tail",
    frequency: "73P comes round every 5.4 years and has kept fragmenting at almost every return since 1995. Many comets break up eventually; this is one of the best-watched cases.",
    cause: "A comet nucleus is a loose, weak pile of ice and dust. Heated near the Sun, gas pressure, fast spin or tidal stress can crack it, and each crack exposes fresh ice that flares up and weakens it further. 73P split in 1995 after a sudden outburst, and its fragments then broke up again and again.",
    note: "In 2006 it passed only about 12 million km from Earth, and Hubble watched fragment B shed dozens of mini-fragments. Dust from the 1995 breakup produced the tau Herculid meteors in 2022.",
    accuracy: "The site's own Sun and Earth, with 73P drawn on its real orbit; the fragments' spacing along the orbit is a picture of the real string (C and B about two days apart), and the number of pieces is illustrative.",
    art: { main: "comet", fx: "split" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: breakupReal,
  }),

  /* ------------------------------------------------------------------ 94 */
  event({
    id: "encke-tail",
    section: "comets",
    title: "The solar wind snaps a comet's tail",
    place: "Comet Encke · inside Mercury's orbit",
    kind: "recorded",
    family: "smallBody",
    when: "April 20, 2007",
    often: "once, April 20, 2007 (seen)",
    timeline: { last: "April 20, 2007 (seen by STEREO-A)" },
    detail: "In April 2007 a blast of plasma from the Sun swept over Comet Encke and tore its ion tail clean off",
    frequency: "Tail disconnections happen often — whenever a comet meets a sharp change in the solar wind — but this was the first one watched in such detail, by NASA's STEREO-A spacecraft.",
    cause: "A coronal mass ejection, a huge cloud of magnetised plasma thrown out by the Sun, swept over the comet. The comet's ion tail is held by magnetic field lines draped around its head. When the CME's oppositely directed field met them, the field lines reconnected and the tail was cut loose (Vourlidas et al. 2007).",
    note: "Encke has the shortest orbit of any well-known comet: 3.3 years. It swings in to 0.34 AU from the Sun, inside Mercury's orbit, which is where it was when the CME hit. The cut-off tail drifted away and the comet grew a new one.",
    accuracy: "The site's own Encke, put where it was on April 20, 2007, with its own coma; its ion tail is drawn by the event so it can break. The CME's speed and size are a picture, and the hours of the event are compressed into seconds.",
    art: { main: "comet", second: "sun", fx: "wave" },
    body: "Sun",
    /* Round 87: on the real bodies (cometScenes.js). */
    scene: enckeReal,
  }),

  /* ------------------------------------------------------------------ 95 */
  event({
    id: "comet-two-tails",
    section: "comets",
    title: "Why a comet has two tails",
    place: "Any comet",
    kind: "ongoing",
    family: "smallBody",
    often: "every active comet",
    detail: "A curved white dust tail and a straight blue gas tail, both pointing away from the Sun whichever way the comet is moving",
    frequency: "Every comet that comes close enough to the Sun to warm up — roughly inside Jupiter's orbit, and strongest near the Sun.",
    cause: "Sunlight warms the ice in the nucleus, which turns to gas and carries dust off with it. Dust grains are pushed gently by the pressure of sunlight, so they drift slowly away and lag behind along the comet's path: a broad, curving tail, white from reflected sunlight. Gas is ionised by sunlight and swept up by the solar wind, which blows straight out from the Sun at hundreds of kilometres a second: a narrow, straight tail that glows blue, mostly from carbon monoxide ions.",
    note: "Because both are pushed outward by the Sun, the tails point away from it, not behind the comet. Heading back out after rounding the Sun, a comet travels tail-first.",
    accuracy: "A diagram: the orbit, the Sun and the comet are not to scale, and the tails' lengths are exaggerated so they read. The directions — dust curved and lagging, gas straight out from the Sun — are right.",
    art: { main: "comet", second: "sun", fx: "twotails" },
    scene(ctx) {
      /* layout: orbit a 0.58, e 0.6, Sun at the focus. */
      const A = 0.58;
      const E = 0.6;
      const sunPos = new THREE.Vector3(0.26, -0.14, 0);
      const sys = new THREE.Group();
      sys.position.copy(sunPos);
      ctx.add(sys);
      /* Round 87 (Prompts.md: "just make the sun white"). */
      const sun = ctx.sun(0.07, { halo: 3.4, parent: sys, ...WHITE_SUN });
      ctx.orbit(A, E, { plane: "xy", colour: "#bfe6ff", opacity: 0.35, dashed: true, dash: 0.025, gap: 0.02, parent: sys });
      const comet = makeComet(ctx, { parent: sys, dust: 1000, ion: 480, seed: 77, size: 1 });
      /* The solar wind: faint particles streaming straight out. */
      const W = 360;
      const wind = ctx.cloud(W, { parent: sys, size: 1.6 });
      const r = rng(81);
      const wp = Array.from({ length: W }, () => ({ a: r() * TAU, ph: r() }));
      wp.forEach((_, i) => wind.tint(i, "#ffe2a8"));
      const motion = ctx.arrow([0, 0, 0], [0.1, 0, 0], { colour: "#ffffff", head: 0.04, parent: sys });
      /* Tail labels sit in fixed places, with pointers to their tails. */
      const dustLabel = ctx.label(["Dust tail", "curved, white — pushed by sunlight"], { at: [0.5, -0.76, 0], height: 0.024, colour: "#fff1d8" });
      const ionLabel = ctx.label(["Gas (ion) tail", "straight, blue — blown by the solar wind"], { at: [0.5, 0.7, 0], height: 0.024, colour: "#9fc6ff", sub: "#7fa6d8" });
      const dustPointer = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#fff1d8", opacity: 0.5 });
      const ionPointer = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#9fc6ff", opacity: 0.6 });
      const moveLabel = ctx.label(["Direction of travel"], { height: 0.022 });
      const windLabel = ctx.label(["Solar wind"], { at: [sunPos.x + 0.02, sunPos.y - 0.2, 0], height: 0.022, colour: "#ffe2a8" });
      const status = ctx.label(["", ""], { at: [-0.62, 0.76, 0], height: 0.032 });

      ctx.tell([
        { at: 0, label: "Two tails", text: "A comet falling in toward the Sun. As it warms, its ice turns to gas and it grows two tails." },
        { at: 0.24, label: "Dust", text: "Dust, pushed gently by sunlight, lags along the comet's path: a broad, curving tail that shines white." },
        { at: 0.44, label: "Gas", text: "Gas, ionised and carried off by the solar wind blowing straight out from the Sun: a narrow, straight blue tail." },
        { at: 0.66, label: "Away from the Sun", text: "Rounding the Sun and heading out, the comet now travels tail-first. Both tails still point away from the Sun." },
      ]);
      const toRoot = (v) => v.clone().add(sunPos);
      /* Keeps a tracking label inside the hud (layout). */
      const keep = (v) => { v.x = THREE.MathUtils.clamp(v.x, -0.8, 0.82); v.y = THREE.MathUtils.clamp(v.y, -0.76, 0.6); return v; };
      const vel = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          sun.rotation.y = ctx.t * 0.2;
          roundOnScreen(ctx, sun);
          /* From near aphelion, inbound, round perihelion and out again. */
          const M = lerp(-Math.PI + 0.75, Math.PI - 0.9, p);
          const [x, y] = orbitAt(A, E, M);
          const [x2, y2] = orbitAt(A, E, M + 0.002);
          const head = new THREE.Vector3(x, y, 0);
          vel.set(x2 - x, y2 - y, 0).normalize();
          const rr = head.length();
          const anti = head.clone().normalize();
          const act = clamp01((0.9 - rr) / 0.6);
          comet.draw({ head, anti, back: vel.clone().negate(), dustLen: 0.12 + 0.42 * act, ionLen: 0.15 + 0.55 * act, spread: 0.22, curve: 0.5, dustOn: 0.3 + 0.7 * act, ionOn: 0.3 + 0.7 * act, comaSize: 0.08 + 0.06 * act, glow: 0.4 + 0.6 * act, t: ctx.t });
          motion.userData.set(head.clone().addScaledVector(vel, 0.06), head.clone().addScaledVector(vel, 0.2));
          /* Wind: pure in p, looping outward. */
          for (let i = 0; i < W; i += 1) {
            const q = wp[i];
            const s = (q.ph + p * 4) % 1;
            const d = 0.1 + s * 0.85;
            wind.set(i, Math.cos(q.a) * d, Math.sin(q.a) * d, -0.01);
            const px = sunPos.x + Math.cos(q.a) * d;
            const py = sunPos.y + Math.sin(q.a) * d;
            wind.alpha[i] = 0.35 * (1 - s) * (1 - smooth(Math.abs(px), 1.0, 1.1)) * (1 - smooth(Math.abs(py), 0.75, 0.84));
          }
          wind.commit();
          /* Labels near each tail's end. */
          /* Each label sits beside its own tail: dust on the lagging side,
           * gas on the other. */
          const dustMid = head.clone().addScaledVector(anti, 0.5 * (0.12 + 0.42 * act)).addScaledVector(vel, -0.18 * (0.12 + 0.42 * act));
          ctx.setLine(dustPointer, [[0.5, -0.71, 0], toRoot(dustMid)]);
          const ionMid = head.clone().addScaledVector(anti, 0.6 * (0.15 + 0.55 * act));
          ctx.setLine(ionPointer, [[0.5, 0.65, 0], toRoot(ionMid)]);
          const dA = smooth(p, 0.24, 0.3);
          const iA = smooth(p, 0.44, 0.5);
          ctx.fade(dustLabel, dA);
          ctx.fade(dustPointer, dA);
          ctx.fade(ionLabel, iA);
          ctx.fade(ionPointer, iA);
          moveLabel.position.copy(keep(toRoot(head.clone().addScaledVector(vel, 0.2).addScaledVector(anti, -0.1))));
          ctx.fade(moveLabel, smooth(p, 0.02, 0.08) * (1 - smooth(p, 0.22, 0.26)) + smooth(p, 0.68, 0.74));
          ctx.fade(windLabel, win(p, 0.44, 0.66));
          const radial = vel.dot(anti);
          status.userData.draw(radial > 0.5 ? ["Heading out", "now it travels tail-first"] : radial > 0.15 ? ["Heading out", "the tails still point away from the Sun"] : radial < -0.15 ? ["Falling in", "the tails stream behind"] : ["Rounding the Sun", "the tails swing round"]);
        },
      };
    },
  }),
];

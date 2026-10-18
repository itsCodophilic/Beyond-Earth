import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";

/**
 * Section 9 of the catalogue: comets (round 79).
 *
 * Eight dioramas in front of the lens (body: null): Halley's return, the
 * great comets of 1997, 2020 and 2024, Holmes's outburst, a comet falling
 * apart, a tail snapped off by the Sun, and why a comet has two tails. The
 * site's interstellar comets and its sungrazer are separate events.
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
    accuracy: "The orbit, the Sun and the planets' orbits are to one scale (sizes are not), with Halley's 18° tilt to the planets' plane. Its motion follows Kepler's laws: the slow crawl far out and the quick swing past the Sun are real.",
    art: { main: "comet", second: "sun", fx: "orbit" },
    scene(ctx) {
      /* Halley: a 17.83 AU, e 0.967, q 0.586 AU, Q 35.1 AU, i 162° (JPL).
       * Perihelia 1986 Feb 9 and 2061 Jul 28: 75.47 years apart. */
      const A = 17.83;
      const E = 0.96714;
      const T0 = 1986.11;
      const P = 75.47;
      /* Semi-major axes, AU (NASA). */
      const PLANETS = [["Earth", 1], ["Jupiter", 5.2], ["Saturn", 9.54], ["Uranus", 19.19], ["Neptune", 30.07]];
      /* layout */
      const k = 0.033;
      const sys = new THREE.Group();
      sys.position.set(0.06, 0.14, 0);
      sys.rotation.x = 0.62;
      ctx.add(sys);
      ctx.light.set(1, 0.2, 0.4).normalize();
      const sun = ctx.sun(0.03, { halo: 4 });
      sys.add(sun);
      PLANETS.forEach(([, au]) => ctx.circle(au * k, { plane: "xz", colour: "#8fb6d8", opacity: au > 20 ? 0.35 : 0.25, parent: sys }));
      const nepLabel = ctx.label(["Neptune's orbit"], { at: [30.07 * k * 0.72, 0, 30.07 * k * 0.72], height: 0.022, sub: "#9fb3c8", colour: "#9fb3c8", parent: sys });
      const hp = new THREE.Group();
      hp.rotation.x = 18 * DEG;
      sys.add(hp);
      ctx.orbit(A * k, E, { plane: "xz", colour: "#bfe6ff", opacity: 0.6, parent: hp });
      const comet = makeComet(ctx, { parent: hp, dust: 400, ion: 220, size: 0.8, seed: 11 });
      const at = (year) => {
        const [x, y] = orbitAt(A, E, (TAU * (year - T0)) / P);
        /* Retrograde: the opposite sense to the planets. */
        return new THREE.Vector3(x * k, 0, y * k);
      };
      const nowMark = ctx.glow("#ffe2a8", 0.06, { opacity: 0.9, parent: hp });
      nowMark.position.copy(at(2026.8));
      const local = (v) => tmpV.copy(v).applyMatrix4(hp.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(ctx.root.matrixWorld).invert()).clone();
      const aphLabel = ctx.label(["December 2023", "farthest out: 35 AU"], { height: 0.022 });
      const nowLabel = ctx.label(["Today", "2026"], { height: 0.022, colour: "#ffe2a8" });
      const periLabel = ctx.label(["July 28, 2061", "closest to the Sun"], { height: 0.026, colour: "#ffe2a8" });
      const year = ctx.label(["", ""], { at: [-0.66, 0.78, 0], height: 0.034 });
      const cometLabel = ctx.label(["Halley"], { height: 0.024, colour: "#cfeaff" });

      /* The timeline of returns (perihelion years; negative = BC). */
      const RETURNS = [-239, -163, -86, -11, 66, 141, 218, 295, 374, 451, 530, 607, 684, 760, 837, 912, 989, 1066, 1145, 1222, 1301, 1378, 1456, 1531, 1607, 1682, 1759, 1835, 1910, 1986, 2061];
      const TY = -0.74;
      const tx = (y) => lerp(-1.02, 1.02, (y + 240) / (2061 + 240));
      ctx.line([[tx(-240), TY, 0], [tx(2061), TY, 0]], { colour: "#9fb3c8", opacity: 0.45 });
      const ticks = RETURNS.map((y) => {
        const big = [1066, 1682, 1759, 1986, 2061].includes(y);
        const line = ctx.line([[tx(y), TY - 0.025, 0], [tx(y), TY + (big ? 0.05 : 0.03), 0]], { colour: big ? "#ffe2a8" : "#bfe6ff", opacity: 0.9 });
        return { y, line };
      });
      const tl1066 = ctx.label(["1066", "Bayeux Tapestry"], { at: [tx(1066), TY + 0.11, 0], height: 0.022 });
      const tlHalley = ctx.label(["1682 → 1759", "Halley's prediction"], { at: [tx(1720), TY + 0.11, 0], height: 0.022 });
      const tl240 = ctx.label(["240 BC", "earliest sure record"], { at: [tx(-150), TY + 0.11, 0], height: 0.022 });
      const tlNext = ctx.label(["2061"], { at: [tx(2061) - 0.04, TY + 0.1, 0], height: 0.024, colour: "#ffe2a8" });

      ctx.tell([
        { at: 0, label: "Every 76 years", text: "Halley's Comet on its long, backward orbit, out past Neptune and back. Each tick below is a return." },
        { at: 0.26, label: "1066", text: "Watched for over 2,000 years: in 1066 it was woven into the Bayeux Tapestry." },
        { at: 0.44, label: "Halley's prediction", text: "Edmond Halley saw that the comets of 1531, 1607 and 1682 were one, and predicted its return. It came back in 1758–59, after his death." },
        { at: 0.62, label: "On its way back", text: "Last here in 1986, it turned round beyond Neptune in December 2023 and is now falling back toward the Sun." },
        { at: 0.86, label: "July 28, 2061", text: "Its next closest approach to the Sun — and its next show in our skies." },
      ]);
      const v1 = new THREE.Vector3();
      return {
        duration: 22,
        update(p) {
          const y = T0 + P * smooth(p, 0.04, 0.92);
          const head = at(y);
          v1.copy(at(y + 0.01)).sub(head).normalize().negate();
          const rAU = head.length() / k;
          const act = clamp01((4 - rAU) / 3.2);
          const anti = head.clone().normalize();
          comet.draw({ head, anti, back: v1, normal: new THREE.Vector3(0, 1, 0), dustLen: 0.16 * act, ionLen: 0.26 * act, spread: 0.25, curve: 0.4, dustOn: act, ionOn: act, comaSize: 0.08 + 0.08 * act, glow: 0.6 + 0.4 * act, t: ctx.t });
          sun.rotation.y = ctx.t * 0.2;
          cometLabel.position.copy(local(head)).add(new THREE.Vector3(0, 0.07, 0));
          ctx.fade(cometLabel, rAU > 3 ? 1 : 0);
          year.userData.draw([`${Math.floor(y)}`, rAU < 4 ? `${rAU.toFixed(1)} AU from the Sun · active` : `${rAU.toFixed(1)} AU from the Sun`]);
          /* Orbit labels. */
          aphLabel.position.copy(local(at(2023.94))).add(new THREE.Vector3(0.08, 0.1, 0));
          ctx.fade(aphLabel, win(p, 0.58, 0.88));
          nowLabel.position.copy(local(at(2026.8))).add(new THREE.Vector3(0.05, -0.1, 0));
          ctx.fade(nowLabel, win(p, 0.6, 0.88));
          ctx.fade(nowMark, win(p, 0.6, 0.88));
          periLabel.position.copy(local(at(T0 + P))).add(new THREE.Vector3(-0.08, 0.14, 0));
          ctx.fade(periLabel, smooth(p, 0.86, 0.9));
          ctx.fade(nepLabel, 1 - smooth(p, 0.56, 0.62) + smooth(p, 0.88, 0.92));
          /* Timeline: ticks sweep in, then the highlights. */
          ticks.forEach((tk, i) => ctx.fade(tk.line, smooth(p, 0.02 + (i / ticks.length) * 0.2, 0.05 + (i / ticks.length) * 0.2)));
          ctx.fade(tl240, win(p, 0.08, 0.26));
          ctx.fade(tl1066, win(p, 0.26, 0.46));
          ctx.fade(tlHalley, win(p, 0.44, 0.64));
          ctx.fade(tlNext, smooth(p, 0.64, 0.7));
        },
      };
    },
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
    accuracy: "The sky scene is an illustration. The three nuclei are to scale with each other (Hale–Bopp about 60 km, Halley about 15 × 8 km, 67P about 4 km); the brightness curve is a sketch, not a measured light curve.",
    art: { main: "comet", fx: "twotails" },
    scene(ctx) {
      nightSky(ctx, { seed: 13, twilight: "#4a6aa8", twilightOpacity: 0.28, city: true });
      const comet = makeComet(ctx, { dust: 1500, ion: 600, seed: 21, size: 1.1 });
      /* Nuclei to scale: Hale–Bopp ~60 km (Szabó et al. 2012 give ~74 ±
       * 8; most estimates 40–80); Halley 15 × 8 km (Giotto); 67P ~4 km
       * (Rosetta). Radius 0.004 hud per km. */
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
        ctx.label(["Hale–Bopp", "~60 km"], { at: [0.36, 0.0, 0], height: 0.022 }),
        ctx.label(["Halley", "15 km"], { at: [0.68, -0.34, 0], height: 0.022 }),
        ctx.label(["67P", "~4 km"], { at: [0.92, -0.08, 0], height: 0.022 }),
      ];
      const nucleiTitle = ctx.label(["Nuclei to scale"], { at: [0.62, 0.2, 0], height: 0.024, colour: "#ffe2a8" });
      const ionLabel = ctx.label(["Gas (ion) tail", "straight and blue"], { at: [0.26, 0.6, 0], height: 0.024, colour: "#9fc6ff", sub: "#7fa6d8" });
      const dustLabel = ctx.label(["Dust tail", "broad, curved, white"], { at: [-0.72, 0.5, 0], height: 0.024, colour: "#fff1d8" });
      const counter = ctx.label(["", ""], { at: [0.55, 0.72, 0], height: 0.032 });

      ctx.tell([
        { at: 0, label: "1997", text: "Comet Hale–Bopp over the evening sky, bright enough to see even from city streets." },
        { at: 0.12, label: "18 months", text: "It stayed visible to the naked eye for about 18 months — a record — and was brightest around perihelion, on April 1, 1997." },
        { at: 0.5, label: "A giant nucleus", text: "Its icy core was roughly 60 km wide: four times Halley's, and many times larger than most comets'." },
        { at: 0.76, label: "Two tails", text: "A straight blue tail of gas, blown by the solar wind, and a broad, curving white tail of dust." },
      ]);
      const anti = new THREE.Vector3(0.42, 0.91, 0).normalize();
      const back = new THREE.Vector3(-1, 0.05, 0).normalize();
      return {
        duration: 21,
        update(p) {
          /* 18 naked-eye months; brightest near perihelion (month ~11 in this sketch). */
          const month = 18 * span(p, 0.1, 0.48);
          const bright = p < 0.1 ? 0.75 : 0.35 + 0.65 * Math.exp(-(((month - 11) / 4.5) ** 2));
          const keep = p > 0.48 ? 1 : bright;
          const head = new THREE.Vector3(lerp(-0.42, -0.3, p), lerp(-0.08, 0.02, p), 0);
          const dim = 1 - 0.45 * win(p, 0.5, 0.76);
          comet.draw({ head, anti, back, dustLen: 0.55 * (0.6 + 0.4 * keep), ionLen: 0.78 * (0.6 + 0.4 * keep), spread: 0.42, curve: 0.55, dustOn: keep, ionOn: keep, comaSize: 0.19, glow: keep, alpha: dim * smooth(p, 0, 0.04), t: ctx.t });
          counter.userData.draw(p < 0.1 ? ["Naked-eye comet", "spring 1997"]
            : p < 0.48 ? [`Month ${Math.max(1, Math.ceil(month))} of about 18`, Math.abs(month - 11) < 1.2 ? "perihelion: April 1, 1997" : "visible without a telescope"]
              : ["Hale–Bopp, 1997", "about 18 months to the naked eye"]);
          const nA = win(p, 0.5, 0.76);
          ctx.fade(nuclei, nA);
          nucleusLabels.forEach((l) => ctx.fade(l, nA));
          ctx.fade(nucleiTitle, nA);
          [hb, ha, cg].forEach((m, i) => { m.rotation.set(0.3, ctx.t * 0.3 + i, 0); });
          const tA = smooth(p, 0.76, 0.82);
          ctx.fade(ionLabel, tA);
          ctx.fade(dustLabel, tA);
        },
      };
    },
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
    accuracy: "The sky scene is an illustration. The view from above is a diagram: the orbit's shape near the Sun is right (perihelion 0.39 AU), but Earth's position is simplified to show the edge-on line of sight.",
    art: { main: "comet", fx: "tail" },
    scene(ctx) {
      /* ---- Panel 1: the evening sky. */
      const sky = nightSky(ctx, { seed: 17, twilight: "#ff8a4a", twilightOpacity: 0.36 });
      const comet = makeComet(ctx, { parent: sky, dust: 900, ion: 380, seed: 33, size: 1 });
      const N = 260;
      const spike = ctx.cloud(N, { parent: sky, size: 2.8 });
      const sr = rng(5);
      const spikeP = Array.from({ length: N }, () => ({ s: Math.pow(sr(), 0.7), u: (sr() - 0.5) * 0.01, g: sr() }));
      spikeP.forEach((_, i) => spike.tint(i, "#ffe9c8"));
      const spikeLabel = ctx.label(["Anti-tail", "pointing toward the set Sun"], { at: [0.22, -0.32, 0], height: 0.024, colour: "#ffe2a8", parent: sky });
      const date = ctx.label(["", ""], { at: [-0.6, 0.72, 0], height: 0.032, parent: sky });

      /* ---- Panel 2: the view from above. Parabola with q = 0.39 AU
       * (JPL), drawn r = 2q / (1 + cos ν); 0.7 hud per AU (layout). */
      const diag = new THREE.Group();
      diag.position.set(-0.4, -0.42, 0);
      ctx.add(diag);
      const S = 0.7;
      const Q = 0.39;
      const orbitPt = (nuDeg) => {
        const nu = nuDeg * DEG;
        const rr = (2 * Q) / (1 + Math.cos(nu));
        return new THREE.Vector3(-Math.cos(nu) * rr * S, Math.sin(nu) * rr * S, 0);
      };
      const sun = ctx.sun(0.05, { halo: 3.5, parent: diag });
      const orbitLine = ctx.line(Array.from({ length: 120 }, (_, i) => orbitPt(lerp(-70, 112, i / 119))), { colour: "#bfe6ff", opacity: 0.5, parent: diag });
      void orbitLine;
      const C = orbitPt(100);
      /* Earth near 1 AU, placed so the line of sight is edge-on (diagram). */
      const earthPos = new THREE.Vector3(0.85, 0.53, 0).normalize().multiplyScalar(S);
      const earth = ctx.ball(0.035, { body: "Earth", parent: diag });
      earth.position.copy(earthPos);
      ctx.circle(S, { plane: "xy", from: 0.1, to: 1.0, colour: "#7fb8ff", opacity: 0.35, parent: diag });
      const head = ctx.glow("#ffffff", 0.07, { opacity: 1, parent: diag });
      head.position.copy(C);
      /* The dust sheet: between the anti-sun direction and the orbit behind. */
      const D = 700;
      const sheet = ctx.cloud(D, { parent: diag, size: 2.8 });
      const dr = rng(9);
      const A = C.clone().normalize();
      const T = orbitPt(70).sub(C).normalize();
      const sheetP = Array.from({ length: D }, () => ({ b: Math.pow(dr(), 0.8), d: Math.pow(dr(), 0.7), g: dr() }));
      sheetP.forEach((q, i) => sheet.tint(i, q.b > 0.7 ? "#ffb070" : "#fff1d8"));
      const sight = ctx.line([earthPos, C.clone().addScaledVector(C.clone().sub(earthPos).normalize(), 0.35)], { colour: "#7fb8ff", opacity: 0.7, dashed: true, dash: 0.025, gap: 0.02, parent: diag });
      const labels2 = [
        ctx.label(["Sun"], { at: [0, -0.1, 0], height: 0.024, parent: diag }),
        ctx.label(["Earth", "in the comet's orbital plane"], { at: [earthPos.x + 0.16, earthPos.y - 0.1, 0], height: 0.022, parent: diag }),
        ctx.label(["Old, heavy dust", "trailing along the orbit"], { at: [C.x - 0.42, C.y - 0.02, 0], height: 0.022, colour: "#ffc890", parent: diag }),
        ctx.label(["Main tail", "away from the Sun"], { at: [C.x + 0.3, C.y + 0.24, 0], height: 0.022, parent: diag }),
      ];
      const edgeLabel = ctx.label(["Seen edge-on from Earth,", "the trailing dust lines up on the Sun's side"], { at: [0.5, -0.74, 0], height: 0.024, colour: "#ffe2a8" });
      ctx.fade(diag, 0);

      ctx.tell([
        { at: 0, label: "October 2024", text: "Comet Tsuchinshan–ATLAS low in the western sky after sunset, its tail streaming upward." },
        { at: 0.2, label: "An anti-tail", text: "For a few days in mid-October a thin spike grew out of the head, pointing down toward the set Sun." },
        { at: 0.52, label: "Not really sunward", text: "From above: the comet's dust spreads in a thin sheet in its orbital plane, with the oldest, heaviest grains trailing along the orbit." },
        { at: 0.74, label: "Edge-on", text: "In mid-October Earth crossed that plane. Seen edge-on, the trailing dust lined up on the Sun's side of the head." },
      ]);
      const headSky = new THREE.Vector3(-0.12, -0.26, 0);
      const anti = new THREE.Vector3(0.25, 0.97, 0).normalize();
      const back = new THREE.Vector3(1, -0.1, 0).normalize();
      const down = anti.clone().negate();
      const pos = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          const skyA = 1 - smooth(p, 0.5, 0.56);
          ctx.fade(sky, skyA);
          comet.draw({ head: headSky, anti, back, dustLen: 0.6, ionLen: 0.75, spread: 0.18, curve: 0.25, comaSize: 0.12, alpha: skyA * smooth(p, 0, 0.04), t: ctx.t });
          const grow = smooth(p, 0.2, 0.36);
          for (let i = 0; i < N; i += 1) {
            const q = spikeP[i];
            pos.copy(headSky).addScaledVector(down, q.s * 0.3 * grow).add(new THREE.Vector3(q.u, 0, 0));
            spike.set(i, pos.x, pos.y, 0.01);
            spike.alpha[i] = skyA * grow * (1 - q.s * 0.7) * (0.4 + 0.5 * q.g);
          }
          spike.commit();
          ctx.fade(spikeLabel, skyA * smooth(p, 0.3, 0.36));
          const day = Math.round(lerp(10, 17, span(p, 0.04, 0.48)));
          date.userData.draw([`${day} October 2024`, day >= 12 ? "anti-tail visible" : "evening sky, after sunset"]);
          ctx.fade(date, skyA);

          /* Diagram. */
          const dA = smooth(p, 0.54, 0.6);
          ctx.fade(diag, dA);
          sun.rotation.y = ctx.t * 0.2;
          roundOnScreen(ctx, sun);
          const fill = smooth(p, 0.56, 0.7);
          for (let i = 0; i < D; i += 1) {
            const q = sheetP[i];
            pos.copy(A).lerp(T, q.b).normalize();
            const len = (q.b > 0.7 ? 0.36 : 0.42) * q.d * fill;
            sheet.set(i, C.x + pos.x * len, C.y + pos.y * len, 0);
            sheet.alpha[i] = dA * (1 - q.d * 0.5) * (0.5 + 0.5 * q.g) * (q.b > 0.7 ? 0.6 + 0.4 * smooth(p, 0.74, 0.8) : 1);
          }
          sheet.commit();
          ctx.fade(sight, dA * smooth(p, 0.74, 0.8));
          labels2.forEach((l, i) => ctx.fade(l, dA * (i < 2 ? 1 : smooth(p, 0.6 + i * 0.03, 0.66 + i * 0.03))));
          ctx.fade(edgeLabel, smooth(p, 0.76, 0.82));
        },
      };
    },
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
    accuracy: "The sky scene is an illustration. The orbit view is to one scale: an orbit of about 6,800 years means a semi-major axis of about 360 AU, so the ellipse is extremely thin; the Sun and planets are far too small to see at this scale.",
    art: { main: "comet", fx: "tail" },
    scene(ctx) {
      /* ---- Panel 1: the sky in July 2020. */
      const sky = nightSky(ctx, { seed: 29, twilight: "#ff9a5a", twilightOpacity: 0.3 });
      const comet = makeComet(ctx, { parent: sky, dust: 1100, ion: 300, seed: 41, size: 1, dustColour: "#ffe8c0" });
      const date = ctx.label(["", ""], { at: [-0.6, 0.72, 0], height: 0.032, parent: sky });
      const tailLabel = ctx.label(["A long, curving dust tail"], { at: [0.42, 0.5, 0], height: 0.024, colour: "#ffe8c0", parent: sky });

      /* ---- Panel 2: the orbit. Period ~6,800 yr → a = 6800^(2/3) ≈ 359 AU
       * (Kepler's third law); q 0.295 AU (JPL) → e = 1 − q/a ≈ 0.9992. */
      const PERIOD = 6800;
      const A = Math.pow(PERIOD, 2 / 3);
      const E = 1 - 0.295 / A;
      const k = 1.9 / (2 * A);
      const orbitG = new THREE.Group();
      orbitG.position.set(A * E * k, 0.05, 0);
      ctx.add(orbitG);
      ctx.orbit(A * k, E, { plane: "xy", colour: "#ffe8c0", opacity: 0.55, segments: 2048, parent: orbitG });
      /* Neptune's orbit 30.07 AU; the heliopause ~120 AU (Voyagers). */
      const nep = ctx.circle(30.07 * k, { plane: "xy", colour: "#8fb6d8", opacity: 0.6, parent: orbitG });
      const hel = ctx.circle(120 * k, { plane: "xy", colour: "#8fb6d8", opacity: 0.35, dashed: true, dash: 0.02, gap: 0.02, parent: orbitG });
      const sunDot = ctx.glow("#ffd27f", 0.08, { opacity: 1, parent: orbitG });
      void sunDot;
      const dot = ctx.glow("#ffffff", 0.06, { opacity: 1, parent: orbitG });
      const nepLabel = ctx.label(["Neptune's orbit"], { at: [0.62, -0.17, 0], height: 0.022 });
      const helLabel = ctx.label(["Edge of the solar wind", "~120 AU"], { at: [0.62, 0.43, 0], height: 0.022, sub: "#9fb3c8" });
      const aphLabel = ctx.label(["~720 AU", "farthest out"], { at: [-0.93, 0.2, 0], height: 0.024 });
      const clock = ctx.label(["", ""], { at: [-0.2, 0.62, 0], height: 0.034 });
      ctx.fade(orbitG, 0);

      ctx.tell([
        { at: 0, label: "July 2020", text: "Comet NEOWISE rounds the Sun on July 3, closer than Mercury, then climbs into the northern summer sky." },
        { at: 0.2, label: "Brightest in decades", text: "The brightest comet seen from the north since Hale–Bopp in 1997, with a long, curving dust tail." },
        { at: 0.5, label: "A long way out", text: "Its orbit stretches about 700 AU from the Sun — over twenty times Neptune's distance." },
        { at: 0.76, label: "About 6,800 years", text: "It will not be back for about 6,800 years: around the year 8800." },
      ]);
      const anti = new THREE.Vector3(0.55, 0.84, 0).normalize();
      const back = new THREE.Vector3(1, -0.25, 0).normalize();
      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          const skyA = 1 - smooth(p, 0.47, 0.53);
          ctx.fade(sky, skyA);
          /* Dates: July 3 (perihelion) to July 23 (closest to Earth). */
          const d = Math.round(lerp(3, 23, span(p, 0.02, 0.44)));
          const head = new THREE.Vector3(lerp(-0.55, -0.35, span(p, 0.02, 0.44)), lerp(-0.36, -0.12, span(p, 0.02, 0.44)), 0);
          comet.draw({ head, anti, back, dustLen: 0.85, ionLen: 0.7, spread: 0.12, curve: 0.55, ionOn: 0.45, comaSize: 0.1, alpha: skyA * smooth(p, 0, 0.04), t: ctx.t });
          date.userData.draw([`July ${d}, 2020`, d < 6 ? "perihelion: July 3" : d > 20 ? "closest to Earth: July 23" : "naked-eye comet"]);
          ctx.fade(tailLabel, skyA * smooth(p, 0.2, 0.26));

          const oA = smooth(p, 0.49, 0.53);
          ctx.fade(orbitG, oA);
          const yrs = PERIOD * smooth(p, 0.56, 0.95);
          const [x, y] = orbitAt(A, E, (TAU * yrs) / PERIOD);
          dot.position.set(x * k, y * k, 0.01);
          ctx.fade(nep, oA);
          ctx.fade(hel, oA);
          ctx.fade(nepLabel, oA);
          ctx.fade(helLabel, oA);
          ctx.fade(aphLabel, oA);
          clock.userData.draw([`+${fmt(Math.round(yrs / 10) * 10)} years`, `${fmt(Math.hypot(x, y))} AU from the Sun`]);
          ctx.fade(clock, oA);
        },
      };
    },
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
    accuracy: "The cloud and the Sun are drawn to one scale, the growth day by day. The comet's offset bright core and the shape of the cloud are simplified.",
    art: { main: "comet", second: "sun", fx: "burst" },
    scene(ctx) {
      /* Sun radius 695,700 km (IAU); coma ~1.4 million km across by
       * 9 Nov 2007 (16 days after the outburst; Wikipedia / ESA). */
      const RS = 0.26;
      const k = RS / 695700;
      const DAYS = 16;
      const DMAX = 1.4e6;
      /* layout */
      const sun = ctx.sun(RS, { halo: 1.7, haloOpacity: 0.35 });
      sun.position.set(0.66, 0.02, 0);
      const sunLabel = ctx.label(["The Sun, same scale", "1.39 million km wide"], { at: [0.66, -0.4, 0], height: 0.024 });
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
      const flash = ctx.glow("#fff3d0", 0.6, { opacity: 1 });
      flash.position.copy(CEN);
      const ring = ctx.circle(1, { plane: "xy", colour: "#ffe2a8", opacity: 0.6, dashed: true, dash: 0.02, gap: 0.02 });
      const bright = ctx.label(["", ""], { at: [-0.38, 0.72, 0], height: 0.034 });
      const size = ctx.label(["", ""], { at: [-0.38, -0.5, 0], height: 0.028 });

      ctx.tell([
        { at: 0, label: "A faint comet", text: "October 2007: Comet 17P/Holmes, a small comet beyond Mars, far too faint to see without a large telescope." },
        { at: 0.14, label: "Outburst", text: "On October 24, in less than a day, it brightened about half a million times and became visible to the naked eye." },
        { at: 0.36, label: "Growing", text: "A sphere of dust burst out and kept expanding, day after day, at about half a kilometre a second." },
        { at: 0.72, label: "Bigger than the Sun", text: "By November 9 the cloud was about 1.4 million km across — for a while wider than the Sun itself." },
      ]);
      const tmp = new THREE.Vector3();
      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          sun.rotation.y = ctx.t * 0.15;
          /* Brightness: magnitude 17 → ~2.8 in about a day. */
          const burst = smooth(p, 0.14, 0.24);
          const mag = lerp(17, 2.8, burst);
          const factor = Math.pow(10, (17 - mag) / 2.5);
          bright.userData.draw([`Magnitude ${mag.toFixed(1)}`, factor < 1.5 ? "faint — telescopes only" : `${fmt(Math.round(factor / (factor > 1000 ? 1000 : 1)) * (factor > 1000 ? 1000 : 1))}× brighter`]);
          ctx.fade(flash, win(p, 0.14, 0.28, 0.05) * 0.9);
          flash.scale.setScalar(0.25 + 0.8 * span(p, 0.14, 0.28));
          /* Days since the outburst, and the cloud's width. */
          const days = DAYS * span(p, 0.22, 0.86);
          const D = Math.max(20000, DMAX * (days / DAYS));
          const R = (D / 2) * k;
          /* The cloud drifts away from the Sun relative to the nucleus. */
          const drift = R * 0.25;
          const centre = tmp.copy(CEN).add(new THREE.Vector3(-drift, 0, 0)).clone();
          for (let i = 0; i < N; i += 1) {
            const q = shellP[i];
            shell.set(i, centre.x + q.v.x * q.d * R, centre.y + q.v.y * q.d * R, centre.z + q.v.z * q.d * R * 0.3);
            shell.alpha[i] = p < 0.18 ? 0 : (0.25 + 0.5 * q.g) * (0.4 + 0.6 * q.d) * smooth(p, 0.18, 0.26);
          }
          shell.commit();
          comaGlow.position.copy(centre);
          comaGlow.scale.setScalar(Math.max(0.03, R * 2.4));
          ctx.fade(comaGlow, p < 0.16 ? 0.15 : 0.7 * smooth(p, 0.16, 0.24));
          core.position.copy(CEN);
          core.scale.setScalar(p < 0.16 ? 0.03 : 0.06);
          ctx.fade(core, p < 0.16 ? 0.5 : 1);
          ring.position.copy(centre);
          ring.scale.setScalar(Math.max(0.001, R));
          ctx.fade(ring, smooth(p, 0.62, 0.7));
          size.userData.draw(p < 0.22 ? ["Comet Holmes", p < 0.14 ? "October 23, 2007" : "October 24, 2007"]
            : [`Day ${Math.round(days)}: ${fmt(Math.round(D / 10000) * 10000)} km across`, D >= 1.39e6 ? "wider than the Sun" : `${Math.round((D / 1.3914e6) * 100)}% of the Sun's width`]);
          size.position.y = Math.min(-0.36, -R - 0.12);
          ctx.fade(sunLabel, smooth(p, 0.3, 0.36));
        },
      };
    },
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
    accuracy: "A diagram: the Sun, the orbit and the spacing of the fragments are not to scale, and the number of pieces is illustrative. The fragments' tails point away from the Sun, as real ones do.",
    art: { main: "comet", fx: "split" },
    scene(ctx) {
      ctx.light.set(-1, 0.25, 0.4).normalize();
      /* layout */
      const sunPos = new THREE.Vector3(-0.72, 0.42, 0);
      const sun = ctx.sun(0.07, { halo: 3.4 });
      sun.position.copy(sunPos);
      const path = (s) => new THREE.Vector3(lerp(-0.62, 1.0, s), 0.2 - 0.62 * Math.pow(s, 1.25), 0);
      ctx.line(Array.from({ length: 80 }, (_, i) => path(i / 79)), { colour: "#bfe6ff", opacity: 0.3, dashed: true, dash: 0.025, gap: 0.02 });
      const r = rng(59);
      /* Fragments: offsets along the orbit (layout); 0 and 1 are C and B. */
      const F = 44;
      const frags = Array.from({ length: F }, (_, i) => ({
        off: i === 0 ? 0.04 : i === 1 ? -0.1 : i < 4 ? (r() - 0.5) * 0.25 : (r() - 0.5) * 0.9,
        size: i === 0 ? 1 : i === 1 ? 0.75 : i < 4 ? 0.5 : 0.15 + r() * 0.3,
        early: i < 4,
        side: (r() - 0.5) * 0.04,
      }));
      const rocks = frags.slice(0, 4).map((f, i) => ctx.rock(0.045 * f.size, { seed: 3 + i, lumps: 0.3, colour: "#7a7068" }));
      const TAILP = 14;
      const tails = ctx.cloud(F * TAILP, { size: 2.8 });
      for (let i = 0; i < F * TAILP; i += 1) tails.tint(i, i % 3 ? "#cfe4ff" : "#fff1d8");
      const heads = ctx.cloud(F, { size: 4 });
      frags.forEach((_, i) => heads.tint(i, "#ffffff"));
      const flash = ctx.glow("#fff1d0", 0.3, { opacity: 1 });
      const year = ctx.label(["", ""], { at: [0.2, 0.72, 0], height: 0.034 });
      const cLabel = ctx.label(["Fragment C", "the largest"], { height: 0.024 });
      const bLabel = ctx.label(["Fragment B", "breaking up again"], { height: 0.024 });
      const name = ctx.label(["73P/Schwassmann–Wachmann 3", "orbit: 5.4 years"], { at: [-0.4, -0.62, 0], height: 0.028 });

      ctx.tell([
        { at: 0, label: "One comet", text: "Comet 73P/Schwassmann–Wachmann 3, a small comet that comes round every 5.4 years." },
        { at: 0.18, label: "1995: it cracks", text: "In 1995 it flared up suddenly and split into several pieces." },
        { at: 0.44, label: "2006: dozens", text: "By its 2006 return it had broken into dozens of fragments, strung out along its orbit." },
        { at: 0.74, label: "Each with a tail", text: "Every piece grew its own tail — and some kept breaking up as telescopes watched." },
      ]);
      const pos = new THREE.Vector3();
      const anti = new THREE.Vector3();
      const w = new THREE.Vector3();
      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          sun.rotation.y = ctx.t * 0.2;
          roundOnScreen(ctx, sun);
          const centreS = lerp(0.3, 0.5, p);
          const split1 = easeInOut(span(p, 0.2, 0.42));
          const spread2 = easeInOut(span(p, 0.46, 0.9));
          frags.forEach((f, i) => {
            let s = centreS;
            let a = 1;
            if (f.early) s += f.off * (0.25 * split1 + 0.75 * spread2);
            else { s += f.off * spread2; a = smooth(p, 0.46, 0.56); }
            if (i > 0 && f.early) a = smooth(p, 0.2, 0.26);
            if (i === 0) a = 1;
            pos.copy(path(s)).add(new THREE.Vector3(0, f.side * spread2, 0));
            anti.copy(pos).sub(sunPos).normalize();
            if (i < 4) {
              rocks[i].position.copy(pos);
              rocks[i].rotation.set(ctx.t * 0.5 + i, ctx.t * 0.7, 0);
              ctx.fade(rocks[i], a);
            }
            heads.set(i, pos.x, pos.y, 0.02);
            heads.alpha[i] = a * (0.5 + 0.5 * f.size);
            heads.size[i] = 3 + 4 * f.size;
            const L = 0.12 + 0.3 * f.size;
            for (let k = 0; k < TAILP; k += 1) {
              const u = k / TAILP;
              tails.set(i * TAILP + k, pos.x + anti.x * u * L, pos.y + anti.y * u * L + (k % 3 - 1) * 0.004 * u, 0);
              tails.alpha[i * TAILP + k] = a * (1 - u) * 0.9;
            }
          });
          tails.commit();
          heads.commit();
          flash.position.copy(path(centreS));
          flash.scale.setScalar(0.1 + 0.4 * span(p, 0.18, 0.28));
          ctx.fade(flash, win(p, 0.18, 0.3, 0.04));
          year.userData.draw(p < 0.18 ? ["Before 1995", "one nucleus"] : p < 0.44 ? ["1995", "split into several pieces"] : [`${Math.round(lerp(1995, 2006, smooth(p, 0.44, 0.6)))}`, p > 0.6 ? "dozens of fragments" : "breaking up further"]);
          rocks[0].getWorldPosition(w);
          cLabel.position.copy(ctx.root.worldToLocal(w)).add(new THREE.Vector3(0.04, 0.12, 0));
          rocks[1].getWorldPosition(w);
          bLabel.position.copy(ctx.root.worldToLocal(w)).add(new THREE.Vector3(-0.06, -0.12, 0));
          const named = smooth(p, 0.6, 0.66);
          ctx.fade(cLabel, named);
          ctx.fade(bLabel, named);
          ctx.fade(name, 1 - smooth(p, 0.6, 0.66) * 0.4);
        },
      };
    },
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
    accuracy: "A diagram: the Sun, the comet and the CME are not to scale, and the hours of the event are compressed into seconds.",
    art: { main: "comet", second: "sun", fx: "wave" },
    scene(ctx) {
      /* layout */
      const sunPos = new THREE.Vector3(-0.66, 0.04, 0);
      const sun = ctx.sun(0.11, { halo: 2.8 });
      sun.position.copy(sunPos);
      const head = new THREE.Vector3(-0.02, 0.06, 0);
      const anti = head.clone().sub(sunPos).normalize();
      const perp = new THREE.Vector3(-anti.y, anti.x, 0);
      const comet = makeComet(ctx, { dust: 360, ion: 0, seed: 63, size: 0.9 });
      /* The ion tail, drawn here so it can break: old (cut) and new. */
      const N = 520;
      const r = rng(71);
      const tp = Array.from({ length: N }, () => ({ s: r(), u: (r() * 2 - 1) * Math.pow(r(), 1.5), g: r(), ray: Math.floor(r() * 5) - 2 }));
      const oldTail = ctx.cloud(N, { size: 2.8 });
      const newTail = ctx.cloud(N, { size: 2.8 });
      tp.forEach((_, i) => { oldTail.tint(i, i % 4 ? "#6fa6ff" : "#bfe0ff"); newTail.tint(i, i % 4 ? "#6fa6ff" : "#bfe0ff"); });
      /* The CME: an arc of plasma from the Sun. */
      const M = 600;
      const cme = ctx.cloud(M, { size: 3 });
      const cm = Array.from({ length: M }, () => ({ a: (r() - 0.5) * 1.3, d: Math.pow(r(), 2) * 0.16, g: r() }));
      cm.forEach((_, i) => cme.tint(i, i % 3 ? "#ffcf9a" : "#fff0d8"));
      const cmeLabel = ctx.label(["Coronal mass ejection", "magnetised plasma from the Sun"], { height: 0.024, colour: "#ffd2a8" });
      const tailLabel = ctx.label(["Ion tail"], { at: [0.55, 0.3, 0], height: 0.026, colour: "#9fc6ff" });
      const cutLabel = ctx.label(["The tail breaks off"], { height: 0.026, colour: "#bfe0ff" });
      const newLabel = ctx.label(["A new tail grows"], { at: [0.2, -0.12, 0], height: 0.024, colour: "#9fc6ff" });
      const cometLabel = ctx.label(["Comet Encke"], { at: [-0.06, -0.12, 0], height: 0.026 });
      const date = ctx.label(["April 20, 2007"], { at: [-0.3, 0.72, 0], height: 0.034 });
      void date;

      ctx.tell([
        { at: 0, label: "April 2007", text: "Comet Encke, inside Mercury's orbit, its blue ion tail streaming straight away from the Sun." },
        { at: 0.1, label: "A blast from the Sun", text: "A coronal mass ejection — a vast cloud of magnetised plasma — races outward." },
        { at: 0.3, label: "Snap", text: "It sweeps over the comet. Its magnetic field reconnects with the field draped round the comet, and the ion tail is cut loose." },
        { at: 0.58, label: "A new tail", text: "The broken tail drifts away into space, and the comet soon grows a new one." },
      ]);
      const pos = new THREE.Vector3();
      const HIT = 0.3;
      const L0 = 0.9;
      const dist = head.distanceTo(sunPos);
      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          sun.rotation.y = ctx.t * 0.2;
          roundOnScreen(ctx, sun);
          comet.draw({ head, anti, back: new THREE.Vector3(0, -1, 0), dustLen: 0.3, ionLen: 0, spread: 0.25, curve: 0.3, dustOn: 0.55, comaSize: 0.12, t: ctx.t });
          /* CME front radius: reaches the comet at p = HIT. */
          const front = lerp(0.12, 2.0, span(p, 0.1, 0.6));
          const reach = (HIT - 0.1) / 0.5;
          void reach;
          for (let i = 0; i < M; i += 1) {
            const q = cm[i];
            const rr = Math.max(0.12, front - q.d);
            pos.set(sunPos.x + Math.cos(q.a) * rr, sunPos.y + Math.sin(q.a) * rr, 0.01);
            cme.set(i, pos.x, pos.y, pos.z);
            const inside = (1 - smooth(Math.abs(pos.x), 1.0, 1.1)) * (1 - smooth(Math.abs(pos.y), 0.75, 0.84));
            cme.alpha[i] = (p > 0.1 && p < 0.62 ? 1 : 0) * (0.45 + 0.55 * q.g) * (1 - q.d * 5) * inside;
          }
          cme.commit();
          cmeLabel.position.set(sunPos.x + Math.min(front, 1.9) * 0.82, 0.62, 0);
          ctx.fade(cmeLabel, win(p, 0.12, 0.4));
          /* The hit time: when the front passes the comet. */
          const hitP = 0.1 + ((dist - 0.12) / (2.0 - 0.12)) * 0.5;
          const kink = win(p, hitP - 0.01, hitP + 0.08, 0.03);
          const drift = Math.max(0, p - (hitP + 0.04)) * 1.6;
          const oldA = 1 - smooth(p, 0.62, 0.9);
          for (let i = 0; i < N; i += 1) {
            const q = tp[i];
            const L = L0 * q.s;
            /* Before the break: attached. After: a gap opens at the head. */
            const s0 = p > hitP + 0.04 ? 0.08 : 0;
            const along = L + drift + s0 * L0 * (1 - q.s);
            const bend = kink * 0.06 * Math.exp(-q.s * 4) * Math.sin(q.s * 9);
            const across = q.u * 0.014 + q.ray * 0.01 * q.s + 0.012 * q.s * Math.sin(q.s * 8 + ctx.t * 1.3 + q.ray) + bend;
            pos.copy(head).addScaledVector(anti, along).addScaledVector(perp, across);
            oldTail.set(i, pos.x, pos.y, 0);
            const inside = 1 - smooth(pos.x, 1.0, 1.1);
            oldTail.alpha[i] = oldA * Math.pow(1 - q.s, 0.5) * (0.5 + 0.5 * q.g) * inside;
          }
          oldTail.commit();
          const Lnew = L0 * smooth(p, hitP + 0.1, 0.95);
          for (let i = 0; i < N; i += 1) {
            const q = tp[i];
            pos.copy(head).addScaledVector(anti, Lnew * q.s).addScaledVector(perp, q.u * 0.012 + q.ray * 0.008 * q.s);
            newTail.set(i, pos.x, pos.y, 0);
            newTail.alpha[i] = (Lnew > 0.01 ? 1 : 0) * Math.pow(1 - q.s, 0.6) * (0.5 + 0.5 * q.g);
          }
          newTail.commit();
          ctx.fade(tailLabel, 1 - smooth(p, hitP, hitP + 0.04));
          cutLabel.position.set(Math.min(0.8, head.x + 0.45 + drift), 0.34, 0);
          ctx.fade(cutLabel, win(p, hitP + 0.05, 0.86));
          ctx.fade(newLabel, smooth(p, 0.6, 0.66));
          ctx.fade(cometLabel, 1 - smooth(p, 0.56, 0.6));
        },
      };
    },
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
      const sun = ctx.sun(0.07, { halo: 3.4, parent: sys });
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

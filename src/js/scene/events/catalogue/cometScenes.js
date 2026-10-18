import * as THREE from "three";
import { smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { yawFor, yawWithRight, cutter, WHITE_SUN } from "./real.js";
import { toHud, worldRadius, pitchFor, holdShot, distanceFor, hudKit, pin, shotDirection, diorama, sceneObjects, leanLeft } from "./bodyKit.js";
import { smallBodyAuToScene } from "../../smallBodies/smallBodies.js";
import { setOrbitPosition } from "../../orbits.js";

/**
 * Round 87 (Prompts.md: "Halley's return, Comet Tsuchinshan–ATLAS, A comet
 * falls apart, The solar wind snaps a comet's tail, 17P/Holmes blows up,
 * Comet NEOWISE -> Can we show this using real space bodies of solar
 * system? ... realistic"; "Comet Hale–Bopp -> first show the real space
 * body ... then the animation we have now"): the comet events played on the
 * site's real Sun, Earth and Mars and on its real comets (Halley, Hale–Bopp,
 * NEOWISE and Encke, moved along their own orbits with main.js's
 * placeComet, which the glow view uses -- their comas and tails follow).
 * The three comets the site does not carry (Tsuchinshan–ATLAS, 73P and
 * 17P/Holmes) are drawn by the event on their real orbits, in the same
 * scene.
 *
 * Every event has duration 24, so the runner fits it to her line.
 *
 * Orbital elements: JPL Small-Body Database (ssd.jpl.nasa.gov), J2000
 * ecliptic, unless a comment says otherwise. Gaussian constant k =
 * 0.01720209895 (AU^1.5 / day).
 */

const DEG = Math.PI / 180;
const K_GAUSS = 0.01720209895;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

/* ------------------------------------------------------------ time and orbits */

/* Julian day of a calendar date (UT, Meeus ch. 7). */
function jd(y, m, d) {
  let Y = y;
  let M = m;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
function dateOf(J) {
  /* Meeus ch. 7, inverse. */
  const Z = Math.floor(J + 0.5);
  const F = J + 0.5 - Z;
  const alpha = Math.floor((Z - 1867216.25) / 36524.25);
  const A = Z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = Math.floor(B - D - Math.floor(30.6001 * E) + F);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return { year, month, day, text: `${MONTHS[month - 1]} ${day}, ${year}` };
}

/* Eccentric anomaly by bisection (robust for e near 1). */
function keplerE(M, e) {
  const m = ((M % TAU) + TAU) % TAU;
  let lo = 0;
  let hi = TAU;
  for (let i = 0; i < 64; i += 1) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) < m) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/*
 * A comet's heliocentric place on a date from its elements { q, e, i, node,
 * peri (degrees), T (JD of perihelion) }: { ecl (AU, ecliptic x y z), r,
 * nu }. Elliptic orbits by Kepler's equation; a parabolic one (e
 * of exactly 1) by Barker's equation.
 */
function cometPlace(el, J) {
  const dt = J - el.T;
  let r;
  let nu;
  if (Math.abs(el.e - 1) < 1e-6) {
    const W = (K_GAUSS * dt) / Math.sqrt(2 * el.q ** 3);
    const s = Math.cbrt(1.5 * W + Math.sqrt(2.25 * W * W + 1));
    const D = s - 1 / s;
    nu = 2 * Math.atan(D);
    r = el.q * (1 + D * D);
  } else {
    const a = el.q / (1 - el.e);
    const n = K_GAUSS / Math.pow(a, 1.5);
    const E = keplerE(n * dt, el.e);
    r = a * (1 - el.e * Math.cos(E));
    nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  }
  const u = el.peri * DEG + nu;
  const O = el.node * DEG;
  const inc = el.i * DEG;
  const ecl = new THREE.Vector3(
    r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(inc)),
    r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(inc)),
    r * Math.sin(u) * Math.sin(inc),
  );
  return { ecl, r, nu };
}
/*
 * Ecliptic AU to the scene, the way the site places its small bodies
 * (smallBodies.js positionFromOrbit): scene x, y, z = ecliptic x, z, y, the
 * distance through smallBodyAuToScene. Relative to the Sun's world position.
 */
function eclToScene(ecl, sunWorld, out = new THREE.Vector3()) {
  const r = ecl.length();
  const k = r > 1e-9 ? smallBodyAuToScene(r) / r : 0;
  return out.set(ecl.x * k, ecl.z * k, ecl.y * k).add(sunWorld);
}

/*
 * The planets' heliocentric ecliptic longitudes on a date (low-precision:
 * mean longitude plus the equation of centre; Meeus ch. 25 and the
 * Astronomical Almanac's approximate formulae), degrees.
 */
function earthLongitude(J) {
  const d = J - 2451545.0;
  const g = (357.528 + 0.9856003 * d) * DEG;
  const sunLon = 280.46 + 0.9856474 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return (((sunLon + 180) % 360) + 360) % 360;
}
function marsLongitude(J) {
  const d = J - 2451545.0;
  const M = (19.41248 + 0.52402068 * d) * DEG;
  const L = 355.45332 + 0.5240384 * d + 10.691 * Math.sin(M) + 0.623 * Math.sin(2 * M);
  return ((L % 360) + 360) % 360;
}
/*
 * Moves a site planet to a heliocentric longitude on its own orbit (the
 * same as inner.js's putAtLongitude: setOrbitPosition puts true anomaly nu
 * at nu + orbitRotation, and the scene's x and z are the ecliptic's x, y).
 */
function putPlanet(planet, lamDeg) {
  if (!planet) return;
  const d = planet.userData;
  const lam = lamDeg * DEG;
  const e = THREE.MathUtils.clamp(d.orbitEccentricity ?? 0, 0, 0.92);
  const nu = lam - (d.orbitRotation ?? 0);
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  d.meanAnomaly = E - e * Math.sin(E);
  setOrbitPosition(planet.position, d.orbitRadius, d.orbitEccentricity ?? 0, d.meanAnomaly, d.orbitInclination ?? 0, d.orbitRotation ?? 0);
  planet.updateMatrixWorld(true);
}
function keepPlanet(planet) {
  if (!planet) return () => {};
  const M0 = planet.userData.meanAnomaly;
  const p0 = planet.position.clone();
  return () => {
    planet.userData.meanAnomaly = M0;
    planet.position.copy(p0);
  };
}

/* ------------------------------------------------------------ drawing */

/*
 * A comet the site does not carry, drawn in the event's stage: a bright
 * point and coma, a straight blue ion tail away from the Sun and a broad
 * dust tail curving back along the orbit. Positions in world units; the
 * stage's root is the Sun's (1 = the Sun's drawn radius, world axes).
 */
function sceneComet(ctx, { seed = 5, dust = 520, ion = 260, size = 1, dustColour = "#fff1d8" } = {}) {
  const r = rng(seed);
  const S = ctx.host.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  const dustCloud = ctx.cloud(dust, { size: 2.6 * size });
  const ionCloud = ctx.cloud(ion, { size: 2.2 * size });
  const dc = new THREE.Color(dustColour);
  const warm = new THREE.Color("#ffd49a");
  const dustP = Array.from({ length: dust }, (_, i) => {
    dustCloud.tint(i, dc.clone().lerp(warm, r() * 0.6));
    return { s: Math.pow(r(), 0.8), u: r() * 2 - 1, g: r() };
  });
  const ionP = Array.from({ length: ion }, (_, i) => {
    ionCloud.tint(i, i % 4 ? "#6fa6ff" : "#bfe0ff");
    return { s: r(), u: (r() * 2 - 1) * Math.pow(r(), 1.5), g: r() };
  });
  const coma = ctx.glow("#cfe8ff", 1, { opacity: 0.85 });
  const core = ctx.glow("#ffffff", 1, { opacity: 1 });
  const at = new THREE.Vector3();
  const anti = new THREE.Vector3();
  const perp = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const toRoot = (w, out) => out.copy(w).sub(S).divideScalar(U);
  return {
    dustCloud, ionCloud, coma, core,
    /* head: world; back: world unit vector opposite the motion; len: the
     * tails' length in world units; act 0..1. */
    draw({ head, back, len = 40, coma: comaSize = 6, act = 1, alpha = 1, ionOn = 1, dustOn = 1 }) {
      at.copy(head);
      anti.copy(head).sub(S).normalize();
      perp.crossVectors(anti, back).normalize();
      if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0);
      for (let i = 0; i < dust; i += 1) {
        const d = dustP[i];
        const L = len * 0.8 * d.s * act;
        pos.copy(at).addScaledVector(anti, L).addScaledVector(back, 0.55 * L * d.s).addScaledVector(perp, d.u * 0.18 * L);
        toRoot(pos, pos);
        dustCloud.set(i, pos.x, pos.y, pos.z);
        dustCloud.alpha[i] = alpha * dustOn * act * Math.pow(1 - d.s, 1.1) * (0.4 + 0.6 * d.g);
      }
      dustCloud.commit();
      for (let i = 0; i < ion; i += 1) {
        const d = ionP[i];
        const L = len * d.s * act;
        pos.copy(at).addScaledVector(anti, L).addScaledVector(perp, d.u * len * 0.02);
        toRoot(pos, pos);
        ionCloud.set(i, pos.x, pos.y, pos.z);
        ionCloud.alpha[i] = alpha * ionOn * act * Math.pow(1 - d.s, 0.6) * (0.45 + 0.55 * d.g);
      }
      ionCloud.commit();
      toRoot(at, pos);
      coma.position.copy(pos);
      core.position.copy(pos);
      coma.scale.setScalar(Math.max(1e-4, (comaSize * (0.5 + 0.5 * act)) / U));
      core.scale.setScalar(Math.max(1e-4, (comaSize * 0.35) / U));
      ctx.fade(coma, alpha * (0.35 + 0.65 * act));
      ctx.fade(core, alpha);
    },
    hide() {
      dustCloud.alpha.fill(0);
      ionCloud.alpha.fill(0);
      dustCloud.commit();
      ionCloud.commit();
      ctx.fade(coma, 0);
      ctx.fade(core, 0);
    },
  };
}

/* A line through a comet's orbit, sampled by date (world points). */
function orbitPath(el, sunWorld, J0, J1, n = 360) {
  return Array.from({ length: n + 1 }, (_, i) => eclToScene(cometPlace(el, lerp(J0, J1, i / n)).ecl, sunWorld));
}
/* The world points of a path relative to the Sun stage's root. */
const rooted = (ctx, pts) => {
  const S = ctx.host.getWorldPosition(new THREE.Vector3());
  return pts.map((p) => p.clone().sub(S).divideScalar(ctx.unit));
};

/* A site comet's place on a date: placeComet by distance and leg (on the
 * way out while the mean anomaly is under half a turn). */
function placeSiteComet(ctx, name, el, J) {
  const { r } = cometPlace(el, J);
  let out = J > el.T;
  if (el.e < 1) {
    const a = el.q / (1 - el.e);
    const n = K_GAUSS / Math.pow(a, 1.5);
    const M = (((n * (J - el.T)) % TAU) + TAU) % TAU;
    out = M < Math.PI;
  }
  return ctx.placeComet(name, r, out);
}
/*
 * A site comet's own drawn path (world points), sampled by putting it at
 * distances along each leg and reading where the site draws it -- the
 * site draws comet orbits as true conics in scene space (smallBodies.js
 * sceneConic), so this follows the comet exactly. Put back after.
 */
function siteCometPath(ctx, name, body, rNear, rFar, { legs = [false, true], n = 160 } = {}) {
  const pts = [];
  const w = new THREE.Vector3();
  legs.forEach((out) => {
    for (let i = 0; i <= n; i += 1) {
      const f = i / n;
      /* Inbound runs far to near, outbound near to far: one path. */
      const r = out ? rNear * Math.pow(rFar / rNear, f) : rFar * Math.pow(rNear / rFar, f);
      if (!ctx.placeComet(name, r, out)) continue;
      body.updateWorldMatrix(true, false);
      pts.push(body.getWorldPosition(w).clone());
    }
  });
  ctx.restoreComet(name);
  return pts;
}

/* Each scene with the picture leaned left of the event card. */
function withLean(ctx, make, share = 0.16) {
  const lean = leanLeft(ctx, share);
  const scene = make(ctx);
  return {
    duration: scene.duration ?? 24,
    update(p, ...rest) {
      lean.apply();
      scene.update?.(p, ...rest);
    },
    dispose(...rest) {
      lean.release();
      scene.dispose?.(...rest);
    },
  };
}

/* The camera's right and up for a yaw and pitch, world. */
function shotAxes(yaw, pitch) {
  const back = shotDirection(yaw, pitch);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right).normalize();
  return { back, right, up };
}


/* ------------------------------------------------------------ Halley */

/*
 * Halley's return: the site's real Halley carried along its real orbit
 * from its last perihelion (February 9, 1986) out past Neptune (December
 * 2023) and back to the next (July 28, 2061), round the real Sun, with
 * the record of its returns along the bottom; then close on the real
 * Halley at perihelion, its coma and tails lit.
 */
function halleyScene(ctx) {
  /* 1P/Halley: q 0.586 AU, i 162.26°, node 58.42°, peri 111.33° (JPL);
   * perihelia February 9.46, 1986 and July 28, 2061 (the period between
   * them, 75.47 years, sets a = 17.86 AU and so e = 1 - q/a = 0.9672). */
  const NAME = "1P/Halley";
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const halley = ctx.findBody(NAME);
  const T1 = 2446470.96;
  const T2 = jd(2061, 7, 28.5);
  const a = Math.pow((T2 - T1) / 365.25, 2 / 3);
  const el = { q: 0.586, e: 1 - 0.586 / a, i: 162.26, node: 58.42, peri: 111.33, T: T1 };
  const Q = a * (1 + el.e);
  /* Its own drawn path, both legs. */
  const path = halley ? siteCometPath(ctx, NAME, halley, el.q, Q * 0.999, { n: 220 }) : [];
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 50;
  const reach = smallBodyAuToScene(Q) * 1.08;
  const shot = holdShot(ctx, "Sun", sun, { yaw: 0.55, pitch: 0.95, distance: distanceFor(reach, 0.86, 50) });
  const pathLine = ctx.line(rooted(ctx, path), { colour: "#bfe6ff", opacity: 0.7, additive: false });
  pathLine.renderOrder = 30;
  const trail = ctx.cloud(80, { size: 3 });
  for (let i = 0; i < 80; i += 1) trail.tint(i, "#cfeaff");

  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.035, { plane: "xy", colour: "#cfeaff", opacity: 1, additive: false });
  const name = H.label(["Halley", ""], { height: 0.046, colour: "#cfeaff", declutter: false });
  const year = H.label(["", ""], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  /* The record of its returns (perihelion years; negative = BC). */
  const RETURNS = [-239, -163, -86, -11, 66, 141, 218, 295, 374, 451, 530, 607, 684, 760, 837, 912, 989, 1066, 1145, 1222, 1301, 1378, 1456, 1531, 1607, 1682, 1759, 1835, 1910, 1986, 2061];
  const TY = -0.72;
  const tx = (y) => lerp(-1.4, 0.2, (y + 240) / (2061 + 240));
  const base = H.line([[tx(-240), TY, 0], [tx(2061), TY, 0]], { colour: "#9fb3c8", opacity: 0.5 });
  const ticks = RETURNS.map((y) => {
    const big = [1066, 1682, 1759, 1986, 2061].includes(y);
    return H.line([[tx(y), TY - 0.025, 0], [tx(y), TY + (big ? 0.05 : 0.03), 0]], { colour: big ? "#ffe2a8" : "#bfe6ff", opacity: 0.9 });
  });
  const tl240 = H.label(["240 BC", "earliest sure record"], { at: [tx(-150), TY + 0.12, 0], height: 0.04, declutter: false });
  const tl1066 = H.label(["1066", "Bayeux Tapestry"], { at: [tx(1066), TY + 0.12, 0], height: 0.04, declutter: false });
  const tlHalley = H.label(["1682 → 1759", "Halley's prediction"], { at: [tx(1700), TY + 0.12, 0], height: 0.04, declutter: false });
  const tlNext = H.label(["2061"], { at: [tx(2061), TY + 0.1, 0], height: 0.03, colour: "#ffe2a8", declutter: false });
  [finder, name, year, base, ...ticks, tl240, tl1066, tlHalley, tlNext].forEach((o) => ctx.fade(o, 0));

  ctx.tell([
    { at: 0, label: "Every 76 years", text: "The real Halley's Comet on its long, backward orbit round the real Sun: in past the planets, out beyond Neptune and back. Each tick below is a return." },
    { at: 0.26, label: "1066", text: "Watched for over 2,000 years: in 1066 it was woven into the Bayeux Tapestry." },
    { at: 0.46, label: "Halley's prediction", text: "Edmond Halley saw that the comets of 1531, 1607 and 1682 were one, and predicted its return. It came back in 1758–59, after his death." },
    { at: 0.72, label: "July 28, 2061", text: "Turned round beyond Neptune in December 2023, it is falling back. Its next closest approach to the Sun: July 28, 2061." },
  ]);
  const cut = cutter(ctx, null);
  const w = new THREE.Vector3();
  const prev = [];
  let close = false;
  return {
    duration: 24,
    update(p) {
      const J = lerp(T1, T2, span(p, 0.03, 0.75));
      if (halley) placeSiteComet(ctx, NAME, el, J);
      if (!close) shot.keep();
      /* The close view: black across the flight, then the real Halley at
       * perihelion, its tails off to the left. */
      if (p >= 0.77 && !close && halley) {
        close = true;
        const anti = halley.getWorldPosition(new THREE.Vector3()).sub(S).normalize();
        const back = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), anti).normalize();
        const view = back.clone().addScaledVector(anti, -0.2).addScaledVector(new THREE.Vector3(0, 1, 0), 0.3).normalize();
        ctx.refocus(NAME, { shotYaw: yawFor(view), shotPitch: pitchFor(view), shotZoom: 3 });
      }
      /* Black across the flight (it takes a few seconds). */
      cut(p >= 0.76 && p < 0.87);
      const d = dateOf(J);
      const rAU = cometPlace(el, J).r;
      year.userData.draw([`${d.year}`, `${rAU.toFixed(rAU < 10 ? 2 : 1)} AU from the Sun${rAU < 3 ? " · active" : ""}`]);
      ctx.fade(year, smooth(p, 0.0, 0.04));
      /* Where it is, and a short trail. */
      if (halley) {
        halley.getWorldPosition(w);
        prev.unshift(w.clone().sub(S).divideScalar(ctx.unit));
        if (prev.length > 80) prev.pop();
        prev.forEach((v, i) => { trail.set(i, v.x, v.y, v.z); trail.alpha[i] = close ? 0 : 0.8 * (1 - i / 80); });
        trail.commit();
        const h = toHud(ctx, w);
        finder.position.set(h.x, h.y, 0);
        name.position.set(h.x, h.y + 0.1, 0);
        name.userData.draw(["Halley", J > jd(2023, 12, 9) && J < jd(2024, 2, 1) ? "farthest out: 35 AU" : ""]);
      }
      ctx.fade(finder, close ? 0 : smooth(p, 0.0, 0.04));
      ctx.fade(name, close ? 0 : smooth(p, 0.0, 0.04));
      ctx.fade(pathLine, close ? 0 : smooth(p, 0.0, 0.05) * 0.8);
      /* The record. */
      const rec = smooth(p, 0.02, 0.06);
      ctx.fade(base, rec);
      ticks.forEach((tk, i) => ctx.fade(tk, smooth(p, 0.02 + (i / ticks.length) * 0.2, 0.05 + (i / ticks.length) * 0.2)));
      ctx.fade(tl240, win(p, 0.08, 0.26, 0.03));
      ctx.fade(tl1066, win(p, 0.26, 0.46, 0.03));
      ctx.fade(tlHalley, win(p, 0.46, 0.7, 0.03));
      ctx.fade(tlNext, smooth(p, 0.7, 0.76));
    },
    dispose() {
      sun.userData.focusFov = fov0;
      ctx.restoreComet(NAME);
    },
  };
}

/* ------------------------------------------------------------ Hale–Bopp */

/*
 * Hale–Bopp: first the real comet, the site's own, falling in from beyond
 * Jupiter (found July 1995, 7.2 AU out) to perihelion on April 1, 1997, and
 * close on it there; then the evening sky of 1997, the comet now moving
 * night by night against the stars, the nuclei to scale and its two tails.
 */
function haleBoppScene(ctx, skyScene) {
  /* C/1995 O1: q 0.9141 AU, e 0.99508, i 89.43°, node 282.47°, peri
   * 130.59°, T April 1.14, 1997 (JPL). */
  const NAME = "C/1995 O1 Hale-Bopp";
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const hb = ctx.findBody(NAME);
  const el = { q: 0.9141, e: 0.99508, i: 89.43, node: 282.47, peri: 130.59, T: jd(1997, 4, 1.14) };
  const J0 = jd(1995, 7, 23);
  const path = hb ? siteCometPath(ctx, NAME, hb, el.q, 8, { legs: [false], n: 160 }) : [];
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 50;
  const shot = holdShot(ctx, "Sun", sun, { yaw: 0.4, pitch: 0.7, distance: distanceFor(smallBodyAuToScene(7.6), 0.86, 50) });
  const pathLine = ctx.line(rooted(ctx, path), { colour: "#bfe6ff", opacity: 0.7, additive: false });
  pathLine.renderOrder = 30;
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.035, { plane: "xy", colour: "#cfeaff", opacity: 1, additive: false });
  const name = H.label(["Hale–Bopp"], { height: 0.034, colour: "#cfeaff", declutter: false });
  const dateL = H.label(["", ""], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  [finder, name, dateL].forEach((o) => ctx.fade(o, 0));
  /* The sky of 1997, after: the round-79 picture, on black. */
  const D = diorama(ctx, skyScene, { x: -0.56, y: 0, scale: 0.8 });
  D.show(0);
  ctx.tell([
    { at: 0, label: "Found beyond Jupiter", text: "The real Hale–Bopp, found in July 1995 while still beyond Jupiter's orbit, falling in toward the real Sun." },
    { at: 0.22, label: "April 1, 1997", text: "At its closest to the Sun: a huge coma and two long tails." },
    { at: 0.42, label: "18 months", text: "From Earth it hung in the evening sky for about a year and a half, moving slowly against the stars from night to night — bright enough to see from cities." },
    { at: 0.66, label: "A giant nucleus", text: "Its icy core was roughly 60 km wide: four times Halley's, and many times larger than most comets'." },
    { at: 0.84, label: "Two tails", text: "A straight blue tail of gas, blown by the solar wind, and a broad, curving white tail of dust." },
  ]);
  const cut = cutter(ctx, null);
  const w = new THREE.Vector3();
  let close = false;
  return {
    duration: 24,
    update(p) {
      const J = p < 0.2 ? lerp(J0, el.T, 1 - Math.pow(1 - span(p, 0.03, 0.2), 1.6)) : el.T;
      if (hb) placeSiteComet(ctx, NAME, el, Math.min(J, el.T - 0.01));
      if (!close) shot.keep();
      if (p >= 0.2 && !close && hb) {
        close = true;
        const anti = hb.getWorldPosition(new THREE.Vector3()).sub(S).normalize();
        const back = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), anti).normalize();
        const view = back.clone().addScaledVector(anti, -0.2).addScaledVector(new THREE.Vector3(0, 1, 0), 0.3).normalize();
        ctx.refocus(NAME, { shotYaw: yawFor(view), shotPitch: pitchFor(view), shotZoom: 3 });
      }
      const sky = p >= 0.42;
      cut((p >= 0.2 && p < 0.29) || sky);
      const d = dateOf(J);
      const rAU = cometPlace(el, J).r;
      dateL.userData.draw([d.text, `${rAU.toFixed(2)} AU from the Sun`]);
      ctx.fade(dateL, sky ? 0 : smooth(p, 0.0, 0.04));
      if (hb) {
        hb.getWorldPosition(w);
        const h = toHud(ctx, w);
        finder.position.set(h.x, h.y, 0);
        name.position.set(h.x, h.y + 0.08, 0);
      }
      ctx.fade(finder, close ? 0 : smooth(p, 0.0, 0.04));
      ctx.fade(name, close ? 0 : smooth(p, 0.0, 0.04));
      ctx.fade(pathLine, close ? 0 : 0.8 * smooth(p, 0.0, 0.05));
      D.show(sky ? smooth(p, 0.42, 0.45) : 0);
      D.update(span(p, 0.42, 1));
    },
    dispose() {
      sun.userData.focusFov = fov0;
      ctx.restoreComet(NAME);
      D.dispose();
    },
  };
}

/* ------------------------------------------------------------ NEOWISE */

/*
 * NEOWISE: the site's real comet carried through July 2020 round the real
 * Sun, with the real Earth on the same dates -- in to perihelion (July 3,
 * inside Mercury's orbit) and out past Earth (closest July 23) -- then close
 * on it, tails out; then far out, its orbit reaching about 700 AU, a dot
 * running round it for the next 6,800 years.
 */
function neowiseScene(ctx) {
  /* C/2020 F3: q 0.29467 AU, e 0.99918, i 128.94°, node 61.01°, peri
   * 37.28°, T July 3.68, 2020 (JPL). a = q/(1 - e) ≈ 359 AU; period
   * a^1.5 ≈ 6,800 years; aphelion ≈ 718 AU. */
  const NAME = "C/2020 F3 NEOWISE";
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const nw = ctx.findBody(NAME);
  const earth = ctx.findBody("Earth");
  const putBackEarth = keepPlanet(earth);
  const el = { q: 0.29467, e: 0.99918, i: 128.94, node: 61.01, peri: 37.28, T: jd(2020, 7, 3.68) };
  const A = el.q / (1 - el.e);
  const PERIOD = Math.pow(A, 1.5);
  const QAU = A * (1 + el.e);
  const near = nw ? siteCometPath(ctx, NAME, nw, el.q, 2.2, { n: 140 }) : [];
  const far = nw ? siteCometPath(ctx, NAME, nw, el.q, QAU * 0.999, { n: 260 }) : [];
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 50;
  const nearD = distanceFor(smallBodyAuToScene(1.25), 0.86, 50);
  const farD = Math.min(10800, distanceFor(smallBodyAuToScene(QAU) * 1.05, 0.9, 70));
  const shot = holdShot(ctx, "Sun", sun, { yaw: 0.9, pitch: 0.9, distance: nearD });
  const nearLine = ctx.line(rooted(ctx, near), { colour: "#ffe8c0", opacity: 0.75, additive: false });
  const farLine = ctx.line(rooted(ctx, far), { colour: "#ffe8c0", opacity: 0.75, additive: false });
  nearLine.renderOrder = 30;
  farLine.renderOrder = 30;
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.035, { plane: "xy", colour: "#ffe8c0", opacity: 1, additive: false });
  const name = H.label(["NEOWISE"], { height: 0.034, colour: "#ffe8c0", declutter: false });
  const eRing = H.circle(0.035, { plane: "xy", colour: "#7fc4ff", opacity: 1, additive: false });
  const eName = H.label(["Earth"], { height: 0.03, colour: "#9fd0ff", declutter: false });
  const dateL = H.label(["", ""], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  const farLabel = H.label(["~720 AU", "farthest out"], { height: 0.046, declutter: false });
  [finder, name, eRing, eName, dateL, farLabel, nearLine, farLine].forEach((o) => ctx.fade(o, 0));
  ctx.tell([
    { at: 0, label: "July 2020", text: "The real Comet NEOWISE rounds the real Sun on July 3, closer than Mercury, then heads out past Earth." },
    { at: 0.28, label: "Brightest in decades", text: "The brightest comet seen from the north since Hale–Bopp in 1997, with a long, curving dust tail." },
    { at: 0.52, label: "A long way out", text: "Its orbit stretches about 700 AU from the Sun — over twenty times Neptune's distance." },
    { at: 0.76, label: "About 6,800 years", text: "It will not be back for about 6,800 years: around the year 8800." },
  ]);
  const cut = cutter(ctx, null);
  const w = new THREE.Vector3();
  const J0 = jd(2020, 6, 10);
  const J1 = jd(2020, 7, 23);
  let phase = 0;
  return {
    duration: 24,
    update(p) {
      /* 0–0.28: June 10 – July 23 round the Sun; 0.3–0.5 close on it
       * (July 15); 0.52–1 far out, round its whole orbit. */
      let J;
      if (p < 0.28) J = lerp(J0, J1, span(p, 0.02, 0.28));
      else if (p < 0.52) J = jd(2020, 7, 15);
      else J = el.T + PERIOD * 365.25 * easeInOut(span(p, 0.56, 0.97)) * 0.998;
      if (nw) placeSiteComet(ctx, NAME, el, J);
      if (earth && p < 0.52) putPlanet(earth, earthLongitude(Math.min(J, J1)));
      if (phase === 0 && p >= 0.28 && nw) {
        phase = 1;
        const anti = nw.getWorldPosition(new THREE.Vector3()).sub(S).normalize();
        const back = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), anti).normalize();
        const view = back.clone().addScaledVector(anti, -0.2).addScaledVector(new THREE.Vector3(0, 1, 0), 0.3).normalize();
        ctx.refocus(NAME, { shotYaw: yawFor(view), shotPitch: pitchFor(view), shotZoom: 3 });
      }
      if (phase === 1 && p >= 0.5) {
        phase = 2;
        sun.userData.focusFov = 70;
        ctx.refocus("Sun", { shotYaw: 0.9, shotPitch: 0.9, shotDistance: farD });
      }
      if (phase === 0) shot.keep();
      if (phase === 2) shot.keep(farD, 0.9, 0.9);
      cut((p >= 0.27 && p < 0.36) || (p >= 0.49 && p < 0.58));
      const d = dateOf(J);
      const rAU = cometPlace(el, J).r;
      dateL.userData.draw(p < 0.52 ? [d.text, `${rAU.toFixed(2)} AU from the Sun`] : [`+${fmt(Math.round((J - el.T) / 365.25 / 10) * 10)} years`, `${fmt(rAU)} AU from the Sun`]);
      ctx.fade(dateL, smooth(p, 0.0, 0.04));
      if (nw) {
        nw.getWorldPosition(w);
        const h = toHud(ctx, w);
        finder.position.set(h.x, h.y, 0);
        name.position.set(h.x, h.y + 0.08, 0);
      }
      const markers = phase !== 1 ? smooth(p, 0.0, 0.04) : 0;
      ctx.fade(finder, markers);
      ctx.fade(name, markers);
      if (earth) {
        earth.getWorldPosition(w);
        const h = toHud(ctx, w);
        eRing.position.set(h.x, h.y, 0);
        eName.position.set(h.x, h.y - 0.08, 0);
      }
      ctx.fade(eRing, phase === 0 ? 1 : 0);
      ctx.fade(eName, phase === 0 ? 1 : 0);
      ctx.fade(nearLine, phase === 0 ? 0.8 : 0);
      ctx.fade(farLine, phase === 2 ? 0.8 * smooth(p, 0.54, 0.58) : 0);
      if (far.length) {
        const h = toHud(ctx, far[Math.floor(far.length / 2)]);
        farLabel.position.set(h.x - 0.1, h.y + 0.1, 0);
      }
      ctx.fade(farLabel, phase === 2 ? smooth(p, 0.58, 0.62) : 0);
    },
    dispose() {
      sun.userData.focusFov = fov0;
      ctx.restoreComet(NAME);
      putBackEarth();
    },
  };
}

/* ------------------------------------------------------------ Tsuchinshan–ATLAS */

/*
 * Tsuchinshan–ATLAS: drawn on its real orbit round the real Sun with the
 * real Earth on the same dates (September–October 2024). Its dust spreads
 * in a sheet in its orbital plane, the oldest grains trailing along the
 * orbit. Mid-October Earth crossed that plane; then, from just behind the
 * real Earth, the sheet is seen edge-on and lines up on the Sun's side of
 * the head: the anti-tail.
 */
function tsuchinshanScene(ctx) {
  /* C/2023 A3: q 0.39143 AU, e 1.00009 (near-parabolic; drawn parabolic),
   * i 139.11°, node 21.56°, peri 308.49°, T September 27.74, 2024 (JPL).
   * Closest to Earth October 12 (0.47 AU); Earth crossed the comet's
   * orbital plane about October 14. */
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  const earth = ctx.findBody("Earth");
  const putBackEarth = keepPlanet(earth);
  const el = { q: 0.39143, e: 1, i: 139.11, node: 21.56, peri: 308.49, T: jd(2024, 9, 27.74) };
  const J0 = jd(2024, 9, 18);
  const J1 = jd(2024, 10, 16);
  const pathPts = orbitPath(el, S, jd(2024, 7, 1), jd(2025, 1, 15), 400);
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 50;
  /* Earth (and the comet near it) on the left of the picture, clear of
   * the card: Earth's direction in mid-October runs right to left. */
  const lamE = earthLongitude(jd(2024, 10, 12)) * DEG;
  const shot = holdShot(ctx, "Sun", sun, { yaw: yawWithRight(new THREE.Vector3(-Math.cos(lamE), 0, -Math.sin(lamE))), pitch: 0.85, distance: distanceFor(smallBodyAuToScene(1.3), 0.86, 50) });
  const pathLine = ctx.line(rooted(ctx, pathPts), { colour: "#bfe6ff", opacity: 0.7, additive: false });
  pathLine.renderOrder = 30;
  const comet = sceneComet(ctx, { seed: 33, dust: 600, ion: 300 });
  /* The dust sheet: grains shed earlier, spread along the orbit behind the
   * head (older = further back), a little off it within the plane. */
  const NS = 900;
  const sheet = ctx.cloud(NS, { size: 2.6 });
  const sr = rng(9);
  const sheetP = Array.from({ length: NS }, () => ({ age: Math.pow(sr(), 0.7), off: (sr() - 0.5), g: sr() }));
  sheetP.forEach((q, i) => sheet.tint(i, q.age > 0.6 ? "#ffb070" : "#fff1d8"));
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.035, { plane: "xy", colour: "#cfeaff", opacity: 1, additive: false });
  const name = H.label(["Tsuchinshan–ATLAS"], { height: 0.032, colour: "#cfeaff", declutter: false });
  const eRing = H.circle(0.035, { plane: "xy", colour: "#7fc4ff", opacity: 1, additive: false });
  const eName = H.label(["Earth"], { height: 0.03, colour: "#9fd0ff", declutter: false });
  const dateL = H.label(["", ""], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  const anti = H.label(["Anti-tail", "the old dust, seen edge-on"], { height: 0.046, colour: "#ffd2a0", declutter: false });
  const main = H.label(["Main tail", "away from the Sun"], { height: 0.046, colour: "#cfe0ff", declutter: false });
  [finder, name, eRing, eName, dateL, anti, main].forEach((o) => ctx.fade(o, 0));
  ctx.tell([
    { at: 0, label: "October 2024", text: "The real Earth and Comet Tsuchinshan–ATLAS on its real orbit, swinging round the real Sun on September 27 and out past us." },
    { at: 0.24, label: "A dust sheet", text: "Its dust spreads in a thin sheet in its orbital plane, the oldest, heaviest grains trailing along the orbit." },
    { at: 0.48, label: "An anti-tail", text: "In mid-October Earth crossed that plane. From just behind the real Earth, the sheet is seen edge-on — a thin spike on the Sun's side of the head." },
    { at: 0.76, label: "Not really sunward", text: "It never really pointed at the Sun: we were seeing the dust trail from the side, lined up with Earth." },
  ]);
  const cut = cutter(ctx, null);
  const head = new THREE.Vector3();
  const back = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const w = new THREE.Vector3();
  let fromEarth = false;
  const earthFov0 = earth?.userData.focusFov;
  return {
    duration: 24,
    update(p) {
      const J = p < 0.46 ? lerp(J0, J1, span(p, 0.02, 0.46)) : jd(2024, 10, 15);
      if (earth) putPlanet(earth, earthLongitude(J));
      eclToScene(cometPlace(el, J).ecl, S, head);
      eclToScene(cometPlace(el, J - 1).ecl, S, back).sub(head).normalize();
      comet.draw({ head, back, len: 70, coma: 5, act: 1 });
      /* The sheet along the orbit behind the head, out to ~40 days back. */
      for (let i = 0; i < NS; i += 1) {
        const q = sheetP[i];
        eclToScene(cometPlace(el, J - 1 - q.age * 40).ecl, S, tmp);
        tmp.lerp(head, 0.15 * (1 - q.age)).addScaledVector(tmp.clone().sub(S).normalize(), q.off * 8 * q.age);
        tmp.sub(S).divideScalar(U);
        sheet.set(i, tmp.x, tmp.y, tmp.z);
        sheet.alpha[i] = smooth(p, 0.22, 0.3) * (0.3 + 0.5 * q.g) * (1 - q.age * 0.4);
      }
      sheet.commit();
      if (!fromEarth) shot.keep();
      /* From just behind the real Earth, looking toward the comet (a wide
       * lens, put back after), the comet above the middle. */
      if (!fromEarth && p >= 0.48 && earth) {
        fromEarth = true;
        earth.userData.focusFov = 64;
        const E = earth.getWorldPosition(new THREE.Vector3());
        const c = head.clone().sub(E).normalize();
        const down = new THREE.Vector3(0, -1, 0).addScaledVector(c, c.y).normalize();
        const fwd = c.clone().multiplyScalar(Math.cos(22 * DEG)).addScaledVector(down, Math.sin(22 * DEG)).normalize();
        const view = fwd.negate();
        ctx.refocus("Earth", { shotYaw: yawFor(view), shotPitch: pitchFor(view), shotDistance: 9 });
      }
      cut(p >= 0.46 && p < 0.56);
      const d = dateOf(J);
      dateL.userData.draw([d.text, p < 0.46 ? `${cometPlace(el, J).r.toFixed(2)} AU from the Sun` : "Earth in the comet's orbital plane"]);
      ctx.fade(dateL, smooth(p, 0.0, 0.04));
      const hc = toHud(ctx, head);
      finder.position.set(hc.x, hc.y, 0);
      name.position.set(hc.x, hc.y + 0.08, 0);
      ctx.fade(finder, fromEarth ? 0 : smooth(p, 0.0, 0.04));
      ctx.fade(name, fromEarth ? 0 : smooth(p, 0.0, 0.04));
      if (earth) {
        earth.getWorldPosition(w);
        const h = toHud(ctx, w);
        eRing.position.set(h.x, h.y, 0);
        eName.position.set(h.x, h.y - 0.08, 0);
      }
      ctx.fade(eRing, fromEarth ? 0 : 1);
      ctx.fade(eName, fromEarth ? 0 : 1);
      ctx.fade(pathLine, fromEarth ? 0.25 : 0.75);
      /* Labels on the two tails, from Earth. */
      const hs = toHud(ctx, S);
      const toSun = hs.clone().sub(hc).normalize();
      anti.position.copy(hc).addScaledVector(toSun, 0.22).add(new THREE.Vector3(-0.12, 0, 0));
      main.position.copy(hc).addScaledVector(toSun, -0.32).add(new THREE.Vector3(-0.1, 0.04, 0));
      ctx.fade(anti, fromEarth ? smooth(p, 0.56, 0.62) : 0);
      ctx.fade(main, fromEarth ? smooth(p, 0.56, 0.62) : 0);
    },
    dispose() {
      sun.userData.focusFov = fov0;
      if (earth) earth.userData.focusFov = earthFov0;
      putBackEarth();
    },
  };
}

/* ------------------------------------------------------------ 17P/Holmes */

/*
 * 17P/Holmes: drawn on its real orbit beyond Mars round the real Sun, the
 * real Earth and Mars on the same dates (October 2007). On October 24 it
 * brightens half a million times and a sphere of dust swells out round it;
 * then, on black, the cloud beside the Sun to one scale.
 */
function holmesScene(ctx, panelScene) {
  /* 17P: q 2.0534 AU, e 0.43242, i 19.11°, node 326.86°, peri 24.25°,
   * T May 4.5, 2007 (JPL). Outburst October 23.7, 2007, at 2.44 AU. */
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  const earth = ctx.findBody("Earth");
  const mars = ctx.findBody("Mars");
  const putBackEarth = keepPlanet(earth);
  const putBackMars = keepPlanet(mars);
  const el = { q: 2.0534, e: 0.43242, i: 19.11, node: 326.86, peri: 24.25, T: jd(2007, 5, 4.5) };
  const a = el.q / (1 - el.e);
  const P = Math.pow(a, 1.5) * 365.25;
  const pathPts = orbitPath(el, S, el.T - P / 2, el.T + P / 2, 360);
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 50;
  /* From high above, Holmes on the left of the Sun, clear of the card. */
  const hDir = eclToScene(cometPlace(el, jd(2007, 10, 24)).ecl, new THREE.Vector3()).setY(0).normalize();
  const shot = holdShot(ctx, "Sun", sun, { yaw: yawWithRight(hDir.clone().negate()), pitch: 1.0, distance: distanceFor(smallBodyAuToScene(2.9), 0.86, 50) });
  const pathLine = ctx.line(rooted(ctx, pathPts), { colour: "#bfe6ff", opacity: 0.7, additive: false });
  pathLine.renderOrder = 30;
  const comet = sceneComet(ctx, { seed: 47, dust: 200, ion: 80 });
  /* The dust sphere, drawn 40 times its real size so it shows at this
   * scale (1.4 million km across by November 9, ~0.0094 AU). */
  const NS = 1200;
  const shell = ctx.cloud(NS, { size: 2.2 });
  const r = rng(47);
  const shellP = Array.from({ length: NS }, () => ({ v: new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize(), d: Math.pow(r(), 0.35), g: r() }));
  shellP.forEach((q, i) => shell.tint(i, q.g > 0.7 ? "#fff6dc" : "#ffd98f"));
  const flash = ctx.glow("#fff3d0", 1, { opacity: 1 });
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.035, { plane: "xy", colour: "#ffe2a8", opacity: 1, additive: false });
  const name = H.label(["Comet Holmes", ""], { height: 0.046, colour: "#ffe2a8", declutter: false });
  const marsL = H.label(["Mars"], { height: 0.028, colour: "#ffb08a", declutter: false });
  const earthL = H.label(["Earth"], { height: 0.028, colour: "#9fd0ff", declutter: false });
  const dateL = H.label(["", ""], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  [finder, name, marsL, earthL, dateL].forEach((o) => ctx.fade(o, 0));
  const D = diorama(ctx, panelScene, { x: -0.56, y: 0, scale: 0.8 });
  D.show(0);
  ctx.tell([
    { at: 0, label: "A faint comet", text: "October 2007: the real Sun, Earth and Mars, and Comet 17P/Holmes on its real orbit beyond Mars — far too faint to see without a large telescope." },
    { at: 0.16, label: "Outburst", text: "On October 24, in less than a day, it brightened about half a million times and became visible to the naked eye." },
    { at: 0.36, label: "Growing", text: "A sphere of dust burst out and kept expanding, day after day, at about half a kilometre a second." },
    { at: 0.6, label: "Bigger than the Sun", text: "Side by side, to one scale: by November 9 the cloud was about 1.4 million km across — for a while wider than the Sun itself." },
  ]);
  const cut = cutter(ctx, null);
  const head = new THREE.Vector3();
  const back = new THREE.Vector3();
  const w = new THREE.Vector3();
  const J0 = jd(2007, 10, 10);
  const JB = jd(2007, 10, 23.7);
  const J1 = jd(2007, 11, 9);
  /* AU to scene units near the comet, for the cloud's true size. */
  const sceneAU = (smallBodyAuToScene(2.46) - smallBodyAuToScene(2.42)) / 0.04;
  return {
    duration: 24,
    update(p) {
      const J = p < 0.16 ? lerp(J0, JB, span(p, 0.02, 0.16)) : lerp(JB, J1, span(p, 0.16, 0.56));
      if (earth) putPlanet(earth, earthLongitude(J));
      if (mars) putPlanet(mars, marsLongitude(J));
      eclToScene(cometPlace(el, J).ecl, S, head);
      eclToScene(cometPlace(el, J - 1).ecl, S, back).sub(head).normalize();
      const burst = smooth(p, 0.16, 0.22);
      comet.draw({ head, back, len: 6, coma: 2 + 10 * burst, act: 0.2 + 0.4 * burst });
      /* Days since the outburst; the cloud's width (km), ×40. */
      const days = Math.max(0, J - JB);
      const Dkm = Math.min(1.4e6, Math.max(2e4, 1.4e6 * (days / (J1 - JB))));
      const R = ((Dkm / 2) / 1.496e8) * sceneAU * 40;
      for (let i = 0; i < NS; i += 1) {
        const q = shellP[i];
        w.copy(head).addScaledVector(q.v, q.d * R).sub(S).divideScalar(U);
        shell.set(i, w.x, w.y, w.z);
        shell.alpha[i] = p < 0.17 ? 0 : (0.25 + 0.5 * q.g) * (0.4 + 0.6 * q.d) * smooth(p, 0.17, 0.24);
      }
      shell.commit();
      flash.position.copy(head).sub(S).divideScalar(U);
      flash.scale.setScalar((6 + 30 * span(p, 0.16, 0.26)) / U);
      ctx.fade(flash, win(p, 0.16, 0.3, 0.05));
      shot.keep();
      const panel = p >= 0.58;
      cut(panel);
      const mag = lerp(17, 2.8, burst);
      dateL.userData.draw([dateOf(J).text, `magnitude ${mag.toFixed(1)}${burst > 0.5 ? " · naked eye" : " · telescopes only"}`]);
      ctx.fade(dateL, panel ? 0 : smooth(p, 0.0, 0.04));
      const hc = toHud(ctx, head);
      finder.position.set(hc.x, hc.y, 0);
      name.position.set(hc.x, hc.y + 0.11, 0);
      name.userData.draw(["Comet Holmes", p > 0.24 ? "dust cloud drawn ×40" : ""]);
      ctx.fade(finder, panel ? 0 : smooth(p, 0.0, 0.04) * (1 - smooth(p, 0.22, 0.26)));
      ctx.fade(name, panel ? 0 : smooth(p, 0.0, 0.04));
      if (mars) pin(ctx, marsL, mars.getWorldPosition(w), 0, 0.07);
      if (earth) pin(ctx, earthL, earth.getWorldPosition(w), 0, -0.07);
      ctx.fade(marsL, panel ? 0 : smooth(p, 0.02, 0.06));
      ctx.fade(earthL, panel ? 0 : smooth(p, 0.02, 0.06));
      ctx.fade(pathLine, panel ? 0 : 0.75);
      D.show(panel ? smooth(p, 0.58, 0.61) : 0);
      D.update(lerp(0.3, 1, span(p, 0.58, 1)));
    },
    dispose() {
      sun.userData.focusFov = fov0;
      putBackEarth();
      putBackMars();
      D.dispose();
    },
  };
}

/* ------------------------------------------------------------ 73P */

/*
 * A comet falls apart: 73P/Schwassmann–Wachmann 3, drawn on its real orbit
 * round the real Sun. Through perihelion in 1995 it flares and splits;
 * by 2006 dozens of pieces are strung along the orbit, each with its own
 * tail, passing the real Earth in May -- seen at last from just behind
 * Earth.
 */
function breakupScene(ctx) {
  /* 73P (fragment C, 2006): q 0.9390 AU, e 0.6930, i 11.40°, node 69.90°,
   * peri 198.80°, T June 7.0, 2006 (JPL); perihelion 1995 September 22.7.
   * Closest to Earth: C on May 12, 2006 (0.079 AU), B on May 14. */
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  const earth = ctx.findBody("Earth");
  const putBackEarth = keepPlanet(earth);
  const el06 = { q: 0.939, e: 0.693, i: 11.4, node: 69.9, peri: 198.8, T: jd(2006, 6, 7.0) };
  const el95 = { ...el06, T: jd(1995, 9, 22.7) };
  const a = el06.q / (1 - el06.e);
  const P = Math.pow(a, 1.5) * 365.25;
  const pathPts = orbitPath(el06, S, el06.T - P / 2, el06.T + P / 2, 360);
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 50;
  /* Earth in May 2006 on the left of the picture. */
  const lamE = earthLongitude(jd(2006, 5, 12)) * DEG;
  const shot = holdShot(ctx, "Sun", sun, { yaw: yawWithRight(new THREE.Vector3(-Math.cos(lamE), 0, -Math.sin(lamE))), pitch: 0.8, distance: distanceFor(smallBodyAuToScene(2.2), 0.86, 50) });
  const pathLine = ctx.line(rooted(ctx, pathPts), { colour: "#bfe6ff", opacity: 0.6, additive: false });
  pathLine.renderOrder = 30;
  /* Fragments: lag behind C along the orbit, in days. 0 is C, 1 is B. */
  const r = rng(59);
  const F = 44;
  const frags = Array.from({ length: F }, (_, i) => ({
    lag: i === 0 ? 0 : i === 1 ? 2.2 : i < 5 ? (r() - 0.3) * 6 : 2.2 + (r() - 0.5) * 9,
    size: i === 0 ? 1 : i === 1 ? 0.8 : i < 5 ? 0.5 : 0.15 + r() * 0.3,
    early: i < 5,
  }));
  const TAILP = 16;
  const tails = ctx.cloud(F * TAILP, { size: 2.6 });
  for (let i = 0; i < F * TAILP; i += 1) tails.tint(i, i % 3 ? "#cfe4ff" : "#fff1d8");
  const heads = ctx.cloud(F, { size: 5 });
  frags.forEach((_, i) => heads.tint(i, "#ffffff"));
  const flash = ctx.glow("#fff1d0", 1, { opacity: 1 });
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.04, { plane: "xy", colour: "#cfeaff", opacity: 1, additive: false });
  const name = H.label(["73P/Schwassmann–Wachmann 3"], { height: 0.032, colour: "#cfeaff", declutter: false });
  const eRing = H.circle(0.035, { plane: "xy", colour: "#7fc4ff", opacity: 1, additive: false });
  const eName = H.label(["Earth"], { height: 0.03, colour: "#9fd0ff", declutter: false });
  const dateL = H.label(["", ""], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  const cLabel = H.label(["Fragment C", "the largest"], { height: 0.044, declutter: false });
  const bLabel = H.label(["Fragment B", "breaking up again"], { height: 0.044, declutter: false });
  [finder, name, eRing, eName, dateL, cLabel, bLabel].forEach((o) => ctx.fade(o, 0));
  ctx.tell([
    { at: 0, label: "One comet", text: "Comet 73P/Schwassmann–Wachmann 3 on its real orbit round the real Sun, coming round every 5.4 years." },
    { at: 0.18, label: "1995: it cracks", text: "At its 1995 return it flared up suddenly and split into several pieces." },
    { at: 0.42, label: "2006: dozens", text: "By its 2006 return it had broken into dozens of fragments, strung out along its orbit." },
    { at: 0.66, label: "Each with a tail", text: "In May 2006 they passed the real Earth. Every piece grew its own tail — and some kept breaking up as telescopes watched." },
  ]);
  const cut = cutter(ctx, null);
  const pos = new THREE.Vector3();
  const anti = new THREE.Vector3();
  const w = new THREE.Vector3();
  let fromEarth = false;
  const earthFov0 = earth?.userData.focusFov;
  return {
    duration: 24,
    update(p) {
      const in95 = p < 0.4;
      const el = in95 ? el95 : el06;
      const J = in95 ? lerp(el95.T - 70, el95.T + 50, span(p, 0.02, 0.38)) : p < 0.64 ? lerp(jd(2006, 4, 10), jd(2006, 5, 12), span(p, 0.42, 0.64)) : lerp(jd(2006, 5, 12), jd(2006, 5, 15), span(p, 0.66, 1));
      if (earth && !in95) putPlanet(earth, earthLongitude(J));
      const split = easeInOut(span(p, 0.18, 0.38));
      const head0 = eclToScene(cometPlace(el, J).ecl, S, new THREE.Vector3());
      frags.forEach((f, i) => {
        let a = 1;
        let lag = f.lag;
        if (in95) {
          lag = f.early ? f.lag * 0.25 * split : 0;
          a = i === 0 ? 1 : f.early ? smooth(p, 0.18, 0.24) : 0;
        } else if (!f.early) a = smooth(p, 0.42, 0.5);
        eclToScene(cometPlace(el, J - lag).ecl, S, pos);
        anti.copy(pos).sub(S).normalize();
        const L = (fromEarth ? 0.9 : 6) * (0.4 + f.size) * (in95 ? 1 + 2 * smooth(p, 0.16, 0.22) : 1);
        w.copy(pos).sub(S).divideScalar(U);
        heads.set(i, w.x, w.y, w.z);
        heads.alpha[i] = a * (0.5 + 0.5 * f.size);
        heads.size[i] = 3 + 5 * f.size;
        for (let k = 0; k < TAILP; k += 1) {
          const u = k / TAILP;
          w.copy(pos).addScaledVector(anti, u * L * 4).sub(S).divideScalar(U);
          tails.set(i * TAILP + k, w.x, w.y, w.z);
          tails.alpha[i * TAILP + k] = a * (1 - u) * 0.85;
        }
      });
      heads.commit();
      tails.commit();
      flash.position.copy(head0).sub(S).divideScalar(U);
      flash.scale.setScalar((4 + 16 * span(p, 0.16, 0.26)) / U);
      ctx.fade(flash, win(p, 0.16, 0.28, 0.04));
      if (!fromEarth) shot.keep();
      if (!fromEarth && p >= 0.62 && earth) {
        fromEarth = true;
        earth.userData.focusFov = 64;
        const E = earth.getWorldPosition(new THREE.Vector3());
        const c = head0.clone().sub(E).normalize();
        const down = new THREE.Vector3(0, -1, 0).addScaledVector(c, c.y).normalize();
        const fwd = c.clone().multiplyScalar(Math.cos(20 * DEG)).addScaledVector(down, Math.sin(20 * DEG)).normalize();
        const view = fwd.negate();
        ctx.refocus("Earth", { shotYaw: yawFor(view), shotPitch: pitchFor(view), shotDistance: 6 });
      }
      cut((p >= 0.38 && p < 0.42) || (p >= 0.61 && p < 0.71));
      dateL.userData.draw(in95 ? [dateOf(J).text, p < 0.18 ? "one nucleus" : "split into several pieces"] : [dateOf(J).text, fromEarth ? "the fragments passing Earth" : "dozens of fragments"]);
      ctx.fade(dateL, smooth(p, 0.0, 0.04));
      const hc = toHud(ctx, head0);
      finder.position.set(hc.x, hc.y, 0);
      name.position.set(hc.x, hc.y + 0.09, 0);
      ctx.fade(finder, fromEarth ? 0 : smooth(p, 0.0, 0.04) * (in95 ? 1 : 0));
      ctx.fade(name, fromEarth ? 0 : smooth(p, 0.0, 0.04));
      if (earth) {
        earth.getWorldPosition(w);
        const h = toHud(ctx, w);
        eRing.position.set(h.x, h.y, 0);
        eName.position.set(h.x, h.y - 0.08, 0);
      }
      ctx.fade(eRing, !in95 && !fromEarth ? 1 : 0);
      ctx.fade(eName, !in95 && !fromEarth ? 1 : 0);
      ctx.fade(pathLine, fromEarth ? 0.3 : 0.7);
      /* Names on C and B, from Earth. */
      const named = fromEarth ? smooth(p, 0.72, 0.78) : 0;
      eclToScene(cometPlace(el, J).ecl, S, pos);
      pin(ctx, cLabel, pos, 0, 0.1);
      eclToScene(cometPlace(el, J - frags[1].lag).ecl, S, pos);
      pin(ctx, bLabel, pos, 0, -0.1);
      ctx.fade(cLabel, named);
      ctx.fade(bLabel, named);
    },
    dispose() {
      sun.userData.focusFov = fov0;
      if (earth) earth.userData.focusFov = earthFov0;
      putBackEarth();
    },
  };
}

/* ------------------------------------------------------------ Encke */

/*
 * The solar wind snaps a comet's tail: the site's real Encke, put where it
 * was on April 20, 2007 -- just past perihelion, 0.34 AU from the real Sun
 * -- its ion tail streaming away from the Sun. A coronal mass ejection
 * sweeps out of the Sun and over it; the tail is cut loose, drifts off,
 * and a new one grows.
 */
function enckeScene(ctx) {
  /* 2P/Encke: perihelion April 19.3, 2007, q 0.3385 AU (JPL); STEREO-A
   * saw the disconnection on April 20, 2007 (Vourlidas et al. 2007). The
   * CME's speed is a picture; the hours are compressed into seconds. */
  const NAME = "2P/Encke";
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  const encke = ctx.findBody(NAME);
  if (!encke) return { duration: 24, update() {} };
  ctx.placeComet(NAME, 0.345, true);
  const E = encke.getWorldPosition(new THREE.Vector3());
  const anti = E.clone().sub(S).normalize();
  const dist = E.distanceTo(S);
  const siteTail = encke.getObjectByName(`${NAME} ion tail`);
  const siteTailVis = siteTail?.visible ?? true;
  /* Side on: the Sun on the left, the tail streaming right. A wider lens
   * for this event (put back after). */
  const fovE = encke.userData.focusFov;
  encke.userData.focusFov = 60;
  const right = anti.clone();
  const yaw = Math.atan2(-right.z, right.x);
  const shot = holdShot(ctx, NAME, encke, { yaw, pitch: 0.12, distance: dist * 1.8 });
  /* Its head, bright enough to see from here. */
  const coma = ctx.glow("#cfe8ff", 7 / U, { opacity: 0.9 });
  const core = ctx.glow("#ffffff", 2.4 / U, { opacity: 1 });
  coma.position.copy(E).sub(S).divideScalar(U);
  core.position.copy(coma.position);
  /* The ion tail, drawn so it can break: the old (cut) one and the new. */
  const N = 900;
  const r = rng(71);
  const tp = Array.from({ length: N }, () => ({ s: r(), u: (r() * 2 - 1) * Math.pow(r(), 1.5), g: r(), ray: Math.floor(r() * 5) - 2 }));
  const oldTail = ctx.cloud(N, { size: 3.4 });
  const newTail = ctx.cloud(N, { size: 3.4 });
  tp.forEach((_, i) => { oldTail.tint(i, i % 4 ? "#6fa6ff" : "#bfe0ff"); newTail.tint(i, i % 4 ? "#6fa6ff" : "#bfe0ff"); });
  const perp = new THREE.Vector3().crossVectors(anti, new THREE.Vector3(0, 1, 0)).normalize();
  /* The CME: a cap of plasma round the Sun–Encke line. */
  const M = 1600;
  const cme = ctx.cloud(M, { size: 4 });
  const cm = Array.from({ length: M }, () => {
    const t = Math.sqrt(r()) * 0.9;
    const ph = r() * TAU;
    const dir = anti.clone().multiplyScalar(Math.cos(t)).addScaledVector(perp, Math.sin(t) * Math.cos(ph)).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(t) * Math.sin(ph)).normalize();
    return { dir, d: Math.pow(r(), 2) * 0.12, g: r() };
  });
  cm.forEach((_, i) => cme.tint(i, i % 3 ? "#ffcf9a" : "#fff0d8"));
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const cometL = H.label(["Comet Encke", "0.34 AU from the Sun"], { height: 0.046, declutter: false });
  const tailL = H.label(["Ion tail"], { height: 0.032, colour: "#9fc6ff", declutter: false });
  const cmeL = H.label(["Coronal mass ejection", "magnetised plasma from the Sun"], { height: 0.046, colour: "#ffd2a8", declutter: false });
  const cutL = H.label(["The tail breaks off"], { height: 0.032, colour: "#bfe0ff", declutter: false });
  const newL = H.label(["A new tail grows"], { height: 0.032, colour: "#9fc6ff", declutter: false });
  const dateL = H.label(["April 20, 2007", "seen by NASA's STEREO-A"], { at: [-1.05, 0.62, 0], height: 0.058, declutter: false });
  [cometL, tailL, cmeL, cutL, newL, dateL].forEach((o) => ctx.fade(o, 0));
  ctx.tell([
    { at: 0, label: "April 2007", text: "The real Comet Encke, just past the real Sun, its blue ion tail streaming straight away from it." },
    { at: 0.1, label: "A blast from the Sun", text: "A coronal mass ejection — a vast cloud of magnetised plasma — races outward." },
    { at: 0.3, label: "Snap", text: "It sweeps over the comet. Its magnetic field reconnects with the field draped round the comet, and the ion tail is cut loose." },
    { at: 0.58, label: "A new tail", text: "The broken tail drifts away into space, and the comet soon grows a new one." },
  ]);
  const L0 = dist * 0.62;
  const R0 = 1.05;
  const front = (p) => lerp(R0 * U, dist * 2.4, span(p, 0.1, 0.62));
  /* The front reaches the comet when front(p) = dist. */
  const hitP = 0.1 + ((dist - R0 * U) / (dist * 2.4 - R0 * U)) * 0.52;
  const pos = new THREE.Vector3();
  const toRoot = (v) => v.sub(S).divideScalar(U);
  return {
    duration: 24,
    update(p) {
      ctx.placeComet(NAME, 0.345, true);
      shot.keep();
      if (siteTail) siteTail.visible = false;
      const f = front(p);
      for (let i = 0; i < M; i += 1) {
        const q = cm[i];
        pos.copy(S).addScaledVector(q.dir, Math.max(R0 * U, f - q.d * dist));
        toRoot(pos);
        cme.set(i, pos.x, pos.y, pos.z);
        cme.alpha[i] = (p > 0.1 && p < 0.64 ? 1 : 0) * (0.45 + 0.55 * q.g) * (1 - q.d * 6);
      }
      cme.commit();
      const kink = win(p, hitP - 0.01, hitP + 0.08, 0.03);
      const drift = Math.max(0, p - (hitP + 0.04)) * dist * 2.2;
      const oldA = 1 - smooth(p, 0.62, 0.9);
      for (let i = 0; i < N; i += 1) {
        const q = tp[i];
        const L = L0 * q.s;
        const s0 = p > hitP + 0.04 ? 0.1 : 0;
        const along = L + drift + s0 * L0 * (1 - q.s);
        const bend = kink * 0.07 * L0 * Math.exp(-q.s * 4) * Math.sin(q.s * 9);
        const across = q.u * 0.03 * L0 + q.ray * 0.016 * q.s * L0 + 0.015 * L0 * q.s * Math.sin(q.s * 8 + ctx.t * 1.3 + q.ray) + bend;
        pos.copy(E).addScaledVector(anti, along).addScaledVector(perp, across);
        toRoot(pos);
        oldTail.set(i, pos.x, pos.y, pos.z);
        oldTail.alpha[i] = oldA * Math.pow(1 - q.s, 0.5) * (0.5 + 0.5 * q.g);
      }
      oldTail.commit();
      const Lnew = L0 * smooth(p, hitP + 0.12, 0.96);
      for (let i = 0; i < N; i += 1) {
        const q = tp[i];
        pos.copy(E).addScaledVector(anti, Lnew * q.s).addScaledVector(perp, q.u * 0.03 * L0 + q.ray * 0.016 * L0 * q.s);
        toRoot(pos);
        newTail.set(i, pos.x, pos.y, pos.z);
        newTail.alpha[i] = (Lnew > 0.01 * L0 ? 1 : 0) * Math.pow(1 - q.s, 0.6) * (0.5 + 0.5 * q.g);
      }
      newTail.commit();
      pin(ctx, cometL, E, 0.05, -0.14);
      ctx.fade(cometL, smooth(p, 0.0, 0.05) * (1 - smooth(p, 0.56, 0.6)));
      pin(ctx, tailL, E.clone().addScaledVector(anti, L0 * 0.6), 0, 0.1);
      ctx.fade(tailL, smooth(p, 0.02, 0.06) * (1 - smooth(p, hitP, hitP + 0.04)));
      const hf = toHud(ctx, S.clone().addScaledVector(anti, Math.min(f, dist * 1.4)));
      cmeL.position.set(Math.max(-1.2, Math.min(0.1, hf.x)), 0.5, 0);
      ctx.fade(cmeL, win(p, 0.12, 0.46, 0.04));
      pin(ctx, cutL, E.clone().addScaledVector(anti, L0 * 0.5 + drift), 0, 0.12);
      ctx.fade(cutL, win(p, hitP + 0.05, 0.86, 0.04));
      pin(ctx, newL, E.clone().addScaledVector(anti, L0 * 0.3), 0, -0.12);
      ctx.fade(newL, smooth(p, 0.62, 0.68));
      ctx.fade(dateL, smooth(p, 0.0, 0.04));
    },
    dispose() {
      if (siteTail) siteTail.visible = siteTailVis;
      encke.userData.focusFov = fovE;
      ctx.restoreComet(NAME);
    },
  };
}

/* ------------------------------------------------------------ exports */

export const halleyReal = (ctx) => withLean(ctx, halleyScene);
export const haleBoppReal = (skyScene) => (ctx) => withLean(ctx, (c) => haleBoppScene(c, skyScene), 0.1);
export const neowiseReal = (ctx) => withLean(ctx, neowiseScene);
export const tsuchinshanReal = (ctx) => withLean(ctx, tsuchinshanScene);
export const holmesReal = (panelScene) => (ctx) => withLean(ctx, (c) => holmesScene(c, panelScene), 0.1);
export const breakupReal = (ctx) => withLean(ctx, breakupScene);
export const enckeReal = (ctx) => withLean(ctx, enckeScene);

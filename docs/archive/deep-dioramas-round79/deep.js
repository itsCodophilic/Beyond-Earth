import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";

/**
 * Section 11 of the catalogue: beyond the Solar System (round 79).
 *
 * Twelve historical (or expected) events far outside the Solar System, each
 * a diorama in front of the lens (body: null). None of them can be drawn to
 * scale -- a black hole 1.3 billion light-years away and the Earth it shook
 * do not fit one picture -- so these are diagrams, and each `accuracy` says
 * what is and is not to scale. The site's generic "supernova" and
 * "kilonova" events cover the general cases; these are specific ones, with
 * their dates and numbers.
 *
 * Sources are given next to each number. Where a number is a sketch (a light
 * curve drawn to show its shape, not plotted from data), the comment says so.
 */

/* ------------------------------------------------------------- helpers */

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayDate = (baseUtc, days) => {
  const d = new Date(baseUtc + days * 864e5);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Piecewise-linear through [[x, y], ...] (x ascending), held at the ends. */
function keyed(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return points[points.length - 1][1];
}

/** A smooth curve (Catmull-Rom) through [[x, y], ...], held at the ends. */
function curveThrough(points, x) {
  const n = points.length;
  if (x <= points[0][0]) return points[0][1];
  if (x >= points[n - 1][0]) return points[n - 1][1];
  let i = 1;
  while (points[i][0] < x) i += 1;
  const p0 = points[Math.max(0, i - 2)][1];
  const p1 = points[i - 1][1];
  const p2 = points[i][1];
  const p3 = points[Math.min(n - 1, i + 1)][1];
  const t = (x - points[i - 1][0]) / (points[i][0] - points[i - 1][0]);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/**
 * A small chart: a dark panel, two axes, tick labels and a curve drawn from
 * left to right by `show(u)`. `fn(u)` gives the height (0..1) at u (0..1).
 */
function chart(ctx, { x, y, w, h, title, ticks = [], yTicks = [], colour = "#ffd27f", fn, samples = 220, parent = ctx.root }) {
  const group = new THREE.Group();
  parent.add(group);
  ctx.shape([[x - 0.03, y - 0.04], [x + w + 0.03, y - 0.04], [x + w + 0.03, y + h + 0.03], [x - 0.03, y + h + 0.03]], { colour: "#030812", opacity: 0.6, parent: group });
  ctx.line([[x, y + h, 0], [x, y, 0], [x + w, y, 0]], { colour: "#7f93a8", opacity: 0.6, parent: group, additive: false });
  ctx.label([title], { at: [x, y + h + 0.06, 0], align: "left", height: 0.022, colour: "#cfe0f2", parent: group, declutter: false });
  ticks.forEach(([u, text]) => ctx.label([text], { at: [x + u * w, y - 0.065, 0], height: 0.019, colour: "#9fb3c8", parent: group, declutter: false }));
  yTicks.forEach(([v, text]) => ctx.label([text], { at: [x - 0.035, y + v * h, 0], align: "right", height: 0.019, colour: "#9fb3c8", parent: group, declutter: false }));
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    const u = i / samples;
    return new THREE.Vector3(x + u * w, y + clamp01(fn(u)) * h, 0.01);
  });
  const curve = ctx.line(points.slice(0, 2), { colour, opacity: 0.95, parent: group, additive: false });
  const head = ctx.glow(colour, 0.07, { opacity: 0.9, parent: group });
  return {
    group,
    show(u) {
      const n = Math.max(2, Math.round(clamp01(u) * samples) + 1);
      ctx.setLine(curve, points.slice(0, n));
      head.position.copy(points[n - 1]);
    },
  };
}

/** A flat ring that faces the viewer (kit rings lie flat in XZ). */
function facingRing(ctx, inner, outer, options) {
  const ring = ctx.ring(inner, outer, { additive: true, ...options });
  ring.rotation.x = Math.PI / 2;
  return ring;
}

/** A black hole: a black ball that hides what is behind it, a bright photon ring and a soft glow. */
function blackHole(ctx, r, { parent = ctx.root, ringColour = "#ffcf8a", glowColour = "#ff9a4a", glow = 5, ringOpacity = 0.85 } = {}) {
  const holder = new THREE.Group();
  parent.add(holder);
  const shadow = ctx.ball(r, { colour: "#000000", night: 0, segments: 48, parent: holder });
  const halo = ctx.glow(glowColour, r * glow, { opacity: 0.4, parent: holder });
  const ring = facingRing(ctx, r * 1.02, r * 1.28, { colour: ringColour, opacity: ringOpacity, parent: holder });
  return { holder, shadow, halo, ring };
}

/** An accretion disc of particles in the holder's XZ plane; `spin(angle)` turns it, inner parts faster. */
function discCloud(ctx, n, rin, rout, { parent = ctx.root, seed = 3, inner = "#fff1d0", outer = "#ff7a2a", size = 2.4 } = {}) {
  const cloud = ctx.cloud(n, { parent, size });
  const r = rng(seed);
  const cIn = new THREE.Color(inner);
  const cOut = new THREE.Color(outer);
  const c = new THREE.Color();
  const data = [];
  for (let i = 0; i < n; i += 1) {
    const d = rin + (rout - rin) * Math.pow(r(), 1.6);
    data.push({ d, a: r() * TAU, w: Math.pow(rin / d, 1.5), y: (r() - 0.5) * 0.05 * d });
    c.copy(cIn).lerp(cOut, (d - rin) / (rout - rin));
    cloud.tint(i, c);
    cloud.alpha[i] = 0.35 + 0.5 * r();
    cloud.size[i] = size * (0.7 + 0.8 * r());
  }
  return {
    cloud,
    data,
    spin(angle) {
      for (let i = 0; i < n; i += 1) {
        const s = data[i];
        const a = s.a + angle * s.w;
        cloud.set(i, Math.cos(a) * s.d, s.y, Math.sin(a) * s.d);
      }
      cloud.commit();
    },
  };
}

/** A spiral galaxy of particles, flat in its holder's XZ plane (tilt the holder with rotation.x). */
function spiralGalaxy(ctx, n, { radius = 0.5, arms = 2, wind = 2.6, bar = 0, seed = 9, core = "#ffe4b8", arm = "#b4c8ff", pink = 0.05, size = 2.2, parent = ctx.root, thickness = 0.03, bulge = 0.22 } = {}) {
  const holder = new THREE.Group();
  parent.add(holder);
  const glow = ctx.glow(core, radius * 0.8, { opacity: 0.35, parent: holder });
  const cloud = ctx.cloud(n, { parent: holder, size });
  const r = rng(seed);
  const cCore = new THREE.Color(core);
  const cArm = new THREE.Color(arm);
  const c = new THREE.Color();
  const r0 = radius * (bar > 0 ? bar : 0.12);
  for (let i = 0; i < n; i += 1) {
    let x;
    let y;
    let z;
    const kind = r();
    if (kind < bulge) {
      const d = radius * 0.16 * Math.pow(r(), 1.3);
      const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(d);
      x = v.x;
      y = v.y * 0.6;
      z = v.z;
      c.copy(cCore);
      cloud.alpha[i] = 0.5 + 0.4 * r();
      cloud.size[i] = size * (1 + r());
    } else if (bar > 0 && kind < bulge + 0.1) {
      const t = (r() * 2 - 1) * r0;
      x = t;
      z = (r() + r() - 1) * radius * 0.05;
      y = (r() - 0.5) * thickness;
      c.copy(cCore).lerp(cArm, 0.15);
      cloud.alpha[i] = 0.45 + 0.35 * r();
      cloud.size[i] = size * (0.8 + r());
    } else {
      const d = r0 + (radius - r0) * Math.sqrt(r());
      const k = Math.floor(r() * arms);
      const spread = (r() + r() + r() - 1.5) * 0.42;
      const a = (k * TAU) / arms + wind * Math.log(d / r0) + spread;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
      y = (r() - 0.5) * thickness;
      c.copy(cCore).lerp(cArm, Math.min(1, (d / radius) * 1.5));
      if (r() < pink) c.set("#ff8fb8");
      cloud.alpha[i] = 0.3 + 0.5 * r();
      cloud.size[i] = size * (0.6 + 0.9 * r());
    }
    cloud.set(i, x, y, z);
    cloud.tint(i, c);
  }
  cloud.commit();
  return { holder, cloud, glow };
}

/** Random unit vectors (for shells and bursts). */
function directions(n, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, () => {
    const z = r() * 2 - 1;
    const a = r() * TAU;
    const s = Math.sqrt(1 - z * z);
    return new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s, z);
  });
}

/* Kepler's equation for a conic with pericentre distance q and eccentricity
 * e, time t after pericentre, gravitational parameter mu. Returns [r, nu]. */
function conic(q, e, mu, t) {
  if (Math.abs(e - 1) < 1e-4) {
    /* Parabola: Barker's equation, solved in closed form. */
    const W = 3 * t * Math.sqrt(mu / (2 * q * q * q));
    const Y = Math.cbrt(W / 2 + Math.sqrt((W * W) / 4 + 1));
    const D = Y - 1 / Y;
    return [q * (1 + D * D), 2 * Math.atan(D)];
  }
  if (e < 1) {
    const a = q / (1 - e);
    const M = Math.sqrt(mu / (a * a * a)) * t;
    let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
    for (let k = 0; k < 12; k += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return [a * (1 - e * Math.cos(E)), 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))];
  }
  const a = q / (e - 1);
  const M = Math.sqrt(mu / (a * a * a)) * t;
  let H = Math.asinh(M / e);
  for (let k = 0; k < 14; k += 1) H -= (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
  return [a * (e * Math.cosh(H) - 1), 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2))];
}

/*
 * Two galaxies falling together (Milky Way and Andromeda): a restricted
 * three-body run in the manner of Toomre & Toomre (1972). The two galaxies
 * are softened point masses with a drag term standing in for dynamical
 * friction, so they swing past once, fall back and merge; their stars are
 * test particles. Run once when the event starts and stored as snapshots,
 * so the replay is a pure function of progress. Units are the diorama's;
 * the masses (Andromeda 1.25 x the Milky Way) and the drag are drawing
 * choices tuned so the encounter reads clearly, not a fit to any study.
 */
function mergerSim({ n = 1000, frames = 150, tEnd = 4.2, steps = 1800, seed = 5 } = {}) {
  const M = [1, 1.25];
  const eps = 0.12;
  const drag = 0.6;
  const vt = 0.06;
  const P = [[-0.62, 0, 0], [0.62, 0, 0]];
  const V = [[0, 0, (vt * M[1]) / (M[0] + M[1])], [0, 0, (-vt * M[0]) / (M[0] + M[1])]];
  const R = [0.27, 0.3];
  const normals = [[0.1, 0.85, 0.5], [-0.45, 0.4, 0.8]].map((v) => {
    const l = Math.hypot(...v);
    return v.map((x) => x / l);
  });
  const N = n * 2;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const r = rng(seed);
  for (let g = 0; g < 2; g += 1) {
    const nv = normals[g];
    const a = Math.abs(nv[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = [nv[1] * a[2] - nv[2] * a[1], nv[2] * a[0] - nv[0] * a[2], nv[0] * a[1] - nv[1] * a[0]];
    const l = Math.hypot(...e1);
    e1 = e1.map((x) => x / l);
    const e2 = [nv[1] * e1[2] - nv[2] * e1[1], nv[2] * e1[0] - nv[0] * e1[2], nv[0] * e1[1] - nv[1] * e1[0]];
    for (let j = 0; j < n; j += 1) {
      const i = g * n + j;
      const d = R[g] * (0.08 + 0.92 * Math.pow(r(), 0.75));
      const th = r() * TAU;
      const h = (r() - 0.5) * 0.012;
      const vc = Math.sqrt((M[g] * d * d) / Math.pow(d * d + eps * eps, 1.5));
      for (let c = 0; c < 3; c += 1) {
        pos[i * 3 + c] = P[g][c] + d * (Math.cos(th) * e1[c] + Math.sin(th) * e2[c]) + h * nv[c];
        vel[i * 3 + c] = V[g][c] + vc * (-Math.sin(th) * e1[c] + Math.cos(th) * e2[c]);
      }
    }
  }
  const snaps = new Float32Array(frames * N * 3);
  const centres = new Float32Array(frames * 6);
  const dt = tEnd / steps;
  const every = steps / (frames - 1);
  let frame = 0;
  const save = () => {
    snaps.set(pos, frame * N * 3);
    centres.set([...P[0], ...P[1]], frame * 6);
    frame += 1;
  };
  save();
  for (let s = 1; s <= steps; s += 1) {
    const d = [0, 1, 2].map((c) => P[1][c] - P[0][c]);
    const r2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const f = 1 / Math.pow(r2 + eps * eps, 1.5);
    const k = drag * Math.exp(-r2 / 0.09);
    for (let c = 0; c < 3; c += 1) {
      const rv = V[1][c] - V[0][c];
      V[0][c] += (M[1] * d[c] * f + (k * rv * M[1]) / (M[0] + M[1])) * dt;
      V[1][c] += (-M[0] * d[c] * f - (k * rv * M[0]) / (M[0] + M[1])) * dt;
    }
    for (let c = 0; c < 3; c += 1) {
      P[0][c] += V[0][c] * dt;
      P[1][c] += V[1][c] * dt;
    }
    for (let i = 0; i < N; i += 1) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (let g = 0; g < 2; g += 1) {
        const dx = P[g][0] - pos[i * 3];
        const dy = P[g][1] - pos[i * 3 + 1];
        const dz = P[g][2] - pos[i * 3 + 2];
        const q = M[g] / Math.pow(dx * dx + dy * dy + dz * dz + eps * eps, 1.5);
        ax += dx * q;
        ay += dy * q;
        az += dz * q;
      }
      vel[i * 3] += ax * dt;
      vel[i * 3 + 1] += ay * dt;
      vel[i * 3 + 2] += az * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }
    if ((Math.floor(s / every) > Math.floor((s - 1) / every) || s === steps) && frame < frames) save();
  }
  while (frame < frames) save();
  return { snaps, centres, frames, N, n };
}

/* ------------------------------------------------------------- events */

export const DEEP_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "betelgeuse-dimming",
    section: "deep",
    title: "Betelgeuse's Great Dimming",
    place: "Orion · about 550 light-years",
    kind: "recorded",
    family: "stellar",
    when: "December 2019 – February 2020, faintest in mid-February",
    often: "once, 2019–20",
    timeline: { last: "Dec 2019 – Feb 2020" },
    detail: "The red supergiant at Orion's shoulder faded to about a third of its usual light — not because it was dying, but behind a veil of its own dust",
    frequency: "A one-off. Betelgeuse always varies a little, over about 400 days and about 6 years, but nothing like this had been seen in a century of careful measurement",
    cause: "In 2019 the star threw off a large bubble of hot gas from its southern half. Over the following months the gas cooled and condensed into dust, which blocked part of the star's light as seen from Earth. A cooler patch on the surface beneath may have helped the dust form.",
    note: "By February 2020 it had fallen from about magnitude +0.5 to +1.6 — from one of the ten brightest stars to about the twentieth. Images from the Very Large Telescope showed its southern half darkened (Montargès et al. 2021). It will one day explode as a supernova, but probably not for about 100,000 years.",
    accuracy: "A diagram. The star's size is not to scale with anything else here. The brightness curve is a sketch of the measured one (about +0.5 to +1.6), and the dust is drawn where the telescope images showed the star darkened.",
    art: { main: "redgiant", fx: "dust" },
    scene(ctx) {
      ctx.starfield(300, { seed: 21 });
      /* layout */
      const C = new THREE.Vector3(-0.45, 0.12, 0);
      const R = 0.36;
      const BASE = new THREE.Color("#d9481f");
      const HOT = new THREE.Color("#ffb072");
      const star = ctx.sun(R, { colour: "#d9481f", hot: "#ffb072", halo: 2.0, haloColour: "#ff5a2a", haloOpacity: 0.45, granule: 5 });
      star.position.copy(C);
      const halo = star.userData.halo;

      /* Hot gas leaving the southern half (lat -35° facing us, drawing choice). */
      const r = rng(77);
      const PLUME = 260;
      const plume = ctx.cloud(PLUME, { size: 4 });
      const plumeData = Array.from({ length: PLUME }, (_, i) => {
        plume.tint(i, r() < 0.5 ? "#ffb36b" : "#ffd59a");
        plume.size[i] = 3 + r() * 4;
        return { dir: ctx.onSphere(1, -35 + (r() - 0.5) * 40, -25 + (r() - 0.5) * 60), speed: 0.5 + 0.7 * r(), delay: r() };
      });
      /* The dust: dark motes over the southern half, in front of the star. */
      const DUST = 900;
      const dust = ctx.cloud(DUST, { additive: false, size: 12 });
      dust.points.renderOrder = 27;
      const dustMax = [];
      for (let i = 0; i < DUST; i += 1) {
        const a = -Math.PI / 2 - 0.25 + (r() - 0.5) * 2.4;
        const d = R * (0.1 + 1.0 * Math.sqrt(r()));
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d * 0.9;
        const z = Math.sqrt(Math.max(0, R * R - x * x - y * y)) + 0.02 + r() * 0.04;
        dust.set(i, C.x + x, C.y + y, C.z + z);
        dust.tint(i, r() < 0.5 ? "#2a1208" : "#3b1a0c");
        dust.size[i] = 10 + r() * 12;
        dustMax.push(0.3 + 0.5 * r());
        dust.alpha[i] = 0;
      }
      dust.commit();
      const dustLabel = ctx.label(["Dust cloud", "gas that cooled into soot"], { at: [C.x - 0.42, C.y - 0.36, 0], height: 0.026 });
      const dustPointer = ctx.line([[C.x - 0.3, C.y - 0.32, 0.4], [C.x - 0.14, C.y - 0.2, 0.4]], { colour: "#cfb79a", opacity: 0.7, additive: false });

      /* "Supernova?": a ghost shell that never comes. */
      const ghost = ctx.circle(R * 1.25, { plane: "xy", colour: "#ffd2a8", opacity: 0.6, dashed: true, dash: 0.025, gap: 0.02 });
      ghost.position.copy(C);
      const ghostLabel = ctx.label(["About to explode?", "not this time"], { at: [C.x, C.y + R + 0.2, 0], height: 0.03 });

      /* Orion as seen by eye: RA/Dec (J2000) projected, east to the left. */
      const ORION = [
        ["Betelgeuse", 88.79, 7.41, 0.5], ["Bellatrix", 81.28, 6.35, 1.64], ["Alnitak", 85.19, -1.94, 1.77],
        ["Alnilam", 84.05, -1.2, 1.69], ["Mintaka", 83.0, -0.3, 2.23], ["Saiph", 86.94, -9.67, 2.09], ["Rigel", 78.63, -8.2, 0.13],
      ];
      const O = new THREE.Vector3(0.66, 0.42, 0);
      const oK = 0.024; /* layout: hud units per degree */
      const oxy = ORION.map(([, ra, dec]) => new THREE.Vector3(O.x - (ra - 83.5) * oK, O.y + dec * oK, 0));
      [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]].forEach(([a, b]) => ctx.line([oxy[a], oxy[b]], { colour: "#7f93a8", opacity: 0.35 }));
      const orion = ctx.cloud(ORION.length, { size: 4 });
      ORION.forEach(([name, , , mag], i) => {
        orion.set(i, oxy[i].x, oxy[i].y, oxy[i].z);
        orion.size[i] = 8 - 2 * mag;
        orion.tint(i, name === "Betelgeuse" ? "#ff9a5a" : "#cfe0ff");
      });
      orion.commit();
      ctx.label(["Orion, by eye"], { at: [O.x, O.y + 0.3, 0], height: 0.024, colour: "#cfe0f2" });

      /* Brightness, V magnitude: approximate values read off the AAVSO
       * light curve (minimum about +1.61 in 7–13 Feb 2020, per Guinan and
       * the AAVSO); a sketch of its shape, not a plot of data. Day 0 is
       * 1 October 2019. */
      const MAG = [[0, 0.55], [30, 0.72], [61, 1.02], [80, 1.25], [100, 1.45], [120, 1.57], [134, 1.61], [150, 1.45], [165, 1.15], [183, 0.85], [212, 0.6]];
      const magAt = (day) => curveThrough(MAG, day);
      const DAYS = 212;
      const lc = chart(ctx, {
        x: 0.05, y: -0.78, w: 0.88, h: 0.3,
        title: "Brightness (magnitude), Oct 2019 – Apr 2020",
        ticks: [[0, "Oct 2019"], [92 / DAYS, "Jan 2020"], [183 / DAYS, "Apr 2020"]],
        yTicks: [[1, "+0.5"], [0, "+1.6"]],
        colour: "#ff9a5a",
        fn: (u) => (1.62 - magAt(u * DAYS)) / (1.62 - 0.5),
      });
      const counter = ctx.label(["", ""], { at: [0.49, -0.24, 0], height: 0.032 });
      const BASE_UTC = Date.UTC(2019, 9, 1);

      ctx.tell([
        { at: 0, label: "Orion's shoulder", text: "Betelgeuse, a red supergiant about 550 light-years away. Late 2019." },
        { at: 0.12, label: "The Great Dimming", text: "It faded from about magnitude +0.5 to +1.6 — to about a third of its usual light." },
        { at: 0.3, label: "About to explode?", text: "A star like this will one day go supernova, so people wondered. It was not exploding." },
        { at: 0.5, label: "A veil of dust", text: "It had puffed out a bubble of hot gas from its southern half. The gas cooled into dust and hid part of the star." },
        { at: 0.76, label: "Back by spring", text: "The dust thinned and drifted away; by April 2020 Betelgeuse was almost back to normal." },
      ]);

      return {
        duration: 22,
        update(p) {
          /* The calendar: fast to the minimum, slow through it, then out. */
          const day = keyed([[0.03, 0], [0.47, 134], [0.72, 140], [0.95, DAYS]], p);
          const m = magAt(day);
          /* Share of the usual light: 10^(-0.4 Δm). */
          const share = Math.pow(10, -0.4 * (m - 0.55));
          const veil = clamp01((m - 0.55) / (1.61 - 0.55));
          const k = 0.5 + 0.5 * share;
          star.material.uniforms.uColor.value.copy(BASE).multiplyScalar(k);
          star.material.uniforms.uHot.value.copy(HOT).multiplyScalar(k);
          halo.material.opacity = 0.45 * (0.3 + 0.7 * share);
          star.rotation.y = ctx.t * 0.03;

          for (let i = 0; i < PLUME; i += 1) {
            const s = plumeData[i];
            const u = span(p, 0.03 + s.delay * 0.12, 0.34);
            const d = R * (1 + u * 0.55 * s.speed);
            plume.set(i, C.x + s.dir.x * d, C.y + s.dir.y * d, C.z + s.dir.z * d);
            plume.alpha[i] = u > 0 ? 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - veil * 0.8) : 0;
          }
          plume.commit();
          for (let i = 0; i < DUST; i += 1) dust.alpha[i] = dustMax[i] * veil;
          dust.commit();

          const g = span(p, 0.3, 0.48);
          ghost.scale.setScalar(1 + g * 0.6);
          ctx.fade(ghost, win(p, 0.3, 0.48) * (1 - g * 0.6));
          ctx.fade(ghostLabel, win(p, 0.3, 0.5, 0.03));
          ctx.fade(dustLabel, win(p, 0.5, 0.84));
          ctx.fade(dustPointer, win(p, 0.5, 0.84));

          orion.size[0] = 2 + 5 * share;
          orion.alpha[0] = 0.5 + 0.5 * share;
          orion.commit();

          lc.show(day / DAYS);
          counter.userData.draw([dayDate(BASE_UTC, day), `magnitude +${m.toFixed(2)} · ${Math.round(share * 100)}% of its usual light`]);
          ctx.fade(counter, smooth(p, 0.02, 0.06));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "t-crb-nova",
    section: "deep",
    title: "T Coronae Borealis: a nova we're waiting for",
    place: "Corona Borealis · about 3,000 light-years",
    kind: "recurring",
    family: "stellar",
    when: "Erupted May 1866 and February 1946; the next is expected any time",
    often: "about every 80 years",
    timeline: { last: "February 1946", next: "expected any time" },
    detail: "A white dwarf steals gas from a red giant, and every 80 years or so the stolen layer explodes — taking the star from invisible to as bright as the North Star",
    frequency: "It has erupted twice on record, in 1866 and 1946, 80 years apart. Since 2015 it has behaved the way it did in the years before 1946, so astronomers have been expecting the next one since 2024",
    cause: "T CrB is a pair: a red giant and a white dwarf going round each other every 228 days. Hydrogen from the giant spills onto the white dwarf, whose gravity crushes and heats it. When the layer is deep enough it ignites in a runaway nuclear explosion on the surface — a nova. The white dwarf survives, and starts collecting again.",
    note: "Usually about magnitude +10, it peaked near +2 in 1866 and near +3 in 1946, and fades again within a week. It will be bright enough to see without a telescope for a few days — the first time in 80 years.",
    accuracy: "A diagram: the two stars, the stream and the disc are drawn for clarity, not to scale (the real white dwarf is about the size of Earth). The dates and magnitudes are the recorded ones.",
    art: { main: "whitedwarf", second: "redgiant", fx: "flash" },
    scene(ctx) {
      ctx.starfield(300, { seed: 31 });
      /* layout */
      const GIANT = new THREE.Vector3(-0.52, 0.24, 0);
      const WD = new THREE.Vector3(0.3, 0.24, 0);
      const giant = ctx.sun(0.27, { colour: "#d8502a", hot: "#ffa060", halo: 1.8, haloColour: "#ff6a3a", haloOpacity: 0.35, granule: 7 });
      giant.position.copy(GIANT);
      giant.scale.set(1.08, 1, 1);
      const wd = ctx.sun(0.022, { colour: "#cfe0ff", hot: "#ffffff", halo: 4, haloColour: "#bcd4ff", haloOpacity: 0.8 });
      wd.position.copy(WD);
      const discHolder = new THREE.Group();
      discHolder.position.copy(WD);
      discHolder.rotation.x = 0.35;
      ctx.add(discHolder);
      const disc = discCloud(ctx, 700, 0.04, 0.15, { parent: discHolder, inner: "#e8f0ff", outer: "#ff9a5a", seed: 4 });
      /* The stream: from the giant's inner point to the disc's rim. */
      const S0 = new THREE.Vector3(GIANT.x + 0.29, GIANT.y, 0.02);
      const S1 = new THREE.Vector3(-0.02, 0.06, 0.05);
      const S2 = new THREE.Vector3(WD.x - 0.14, WD.y - 0.02, 0.05);
      const bez = (u, out) => {
        const a = (1 - u) * (1 - u);
        const b = 2 * u * (1 - u);
        const c = u * u;
        return out.set(a * S0.x + b * S1.x + c * S2.x, a * S0.y + b * S1.y + c * S2.y, a * S0.z + b * S1.z + c * S2.z);
      };
      const STREAM = 240;
      const stream = ctx.cloud(STREAM, { size: 3 });
      const rs = rng(5);
      const streamData = Array.from({ length: STREAM }, (_, i) => {
        stream.tint(i, rs() < 0.5 ? "#ffb07a" : "#ffd6a8");
        return { u0: rs(), j: (rs() - 0.5) * 0.02 };
      });
      const tmp = new THREE.Vector3();
      ctx.label(["Red giant"], { at: [GIANT.x, GIANT.y - 0.36, 0], height: 0.026 });
      ctx.label(["White dwarf", "the size of Earth"], { at: [WD.x, WD.y + 0.2, 0], height: 0.026 });

      /* The fuel gauge: hydrogen piled on the white dwarf since the last eruption. */
      const gaugeX = WD.x + 0.3;
      const gaugeY = 0.06;
      const GH = 0.32; /* layout */
      ctx.line([[gaugeX, gaugeY, 0], [gaugeX + 0.045, gaugeY, 0], [gaugeX + 0.045, gaugeY + GH, 0], [gaugeX, gaugeY + GH, 0], [gaugeX, gaugeY, 0]], { colour: "#9fb3c8", opacity: 0.6, additive: false });
      const fuel = ctx.shape([[0, 0], [0.035, 0], [0.035, 1], [0, 1]], { colour: "#7fd8ff", opacity: 0.85 });
      fuel.position.set(gaugeX + 0.005, gaugeY + 0.005, 0);
      ctx.label(["Fuel"], { at: [gaugeX + 0.022, gaugeY - 0.05, 0], height: 0.022 });

      /* The eruption: flash, and a shell of gas thrown off at thousands of km/s. */
      const flash = ctx.glow("#e8f0ff", 1, { opacity: 1 });
      flash.position.copy(WD);
      const SHELL = 500;
      const shell = ctx.cloud(SHELL, { size: 3 });
      const shellDirs = directions(SHELL, 9);
      shellDirs.forEach((_, i) => shell.tint(i, i % 3 ? "#bcd8ff" : "#ffffff"));

      /* The record, 1850 to 2040. Eruptions: 12 May 1866 and 9 February
       * 1946 (AAVSO; Schaefer 2023). */
      const Y0 = 1850;
      const Y1 = 2040;
      const E1 = 1866.36;
      const E2 = 1946.11;
      const TODAY = 2026.78; /* 14 October 2026 */
      const TX = (y) => -0.9 + (1.8 * (y - Y0)) / (Y1 - Y0);
      const TY = -0.56;
      ctx.line([[TX(Y0), TY, 0], [TX(Y1), TY, 0]], { colour: "#9fb3c8", opacity: 0.5, additive: false });
      [[1850, "1850"], [1900, "1900"], [1950, "1950"], [2000, "2000"]].forEach(([yy, t]) => {
        ctx.line([[TX(yy), TY - 0.015, 0], [TX(yy), TY + 0.015, 0]], { colour: "#9fb3c8", opacity: 0.5, additive: false });
        ctx.label([t], { at: [TX(yy), TY - 0.06, 0], height: 0.019, colour: "#7f93a8", declutter: false });
      });
      const marks = [E1, E2].map((y) => {
        const g = ctx.glow("#bcd8ff", 0.09, { opacity: 0.9 });
        g.position.set(TX(y), TY, 0.01);
        const l = ctx.label([y === E1 ? "1866" : "1946"], { at: [TX(y), TY + 0.07, 0], height: 0.024, declutter: false });
        return { y, g, l };
      });
      const nextMark = ctx.label(["next: any time"], { at: [TX(2032), TY + 0.07, 0], height: 0.024, colour: "#ffd27f", declutter: false });
      const cursor = ctx.glow("#ffd27f", 0.06, { opacity: 1 });
      const yearLabel = ctx.label([""], { at: [0, TY - 0.13, 0], height: 0.03 });
      const magLabel = ctx.label(["", ""], { at: [-0.12, -0.2, 0], height: 0.03 });

      ctx.tell([
        { at: 0, label: "Waiting", text: "T Coronae Borealis, about 3,000 light-years away. Usually magnitude +10: binoculars needed." },
        { at: 0.14, label: "Stolen gas", text: "A red giant and a white dwarf. Gas spills from the giant onto the dwarf and piles up on its surface." },
        { at: 0.3, label: "Every 80 years", text: "When the layer is deep enough it ignites in a nuclear runaway: in 1866, and again in 1946." },
        { at: 0.58, label: "Next time", text: "In a few hours it will jump from +10 to about +2 — as bright as the North Star — then fade within a week." },
        { at: 0.86, label: "Any time now", text: "Eighty years after 1946, astronomers are watching it every night." },
      ]);

      return {
        duration: 22,
        update(p) {
          disc.spin(ctx.t * 1.5);
          giant.rotation.y = ctx.t * 0.05;
          for (let i = 0; i < STREAM; i += 1) {
            const s = streamData[i];
            const u = (s.u0 + ctx.t * 0.18) % 1;
            bez(u, tmp);
            stream.set(i, tmp.x, tmp.y + s.j * (1 - u), tmp.z);
            stream.alpha[i] = 0.75 * Math.sin(Math.PI * u) * smooth(p, 0.1, 0.18);
          }
          stream.commit();

          /* The years, then the imagined next eruption. */
          const year = p < 0.56 ? lerp(Y0, TODAY, span(p, 0.2, 0.55)) : TODAY;
          const last = year < E1 ? E1 - 80 : year < E2 ? E1 : E2;
          const erupting = smooth(p, 0.6, 0.62);
          const level = p < 0.6 ? clamp01((year - last) / 80) : lerp(1, 0, erupting) + 0.25 * smooth(p, 0.75, 1);
          fuel.scale.set(1, Math.max(0.001, level * (GH - 0.01)), 1);
          const pastFlash = marks.reduce((f, m) => f + Math.exp(-(((year - m.y) / 3) ** 2)), 0) * (p < 0.57 ? 1 : 0);
          marks.forEach((m) => {
            ctx.fade(m.g, year >= m.y ? 1 : 0.15);
            ctx.fade(m.l, year >= m.y ? 1 : 0.25);
          });
          ctx.fade(nextMark, smooth(p, 0.54, 0.58));
          cursor.position.set(TX(year), TY, 0.02);
          ctx.fade(cursor, smooth(p, 0.18, 0.22) * (1 - smooth(p, 0.86, 0.9)));
          yearLabel.position.x = TX(year);
          yearLabel.userData.draw([p < 0.55 ? `${Math.floor(year)}` : "today"]);
          ctx.fade(yearLabel, smooth(p, 0.18, 0.22) * (1 - smooth(p, 0.6, 0.64)));

          /* The nova: rises in hours, fades in about a week (drawn compressed). */
          const nova = smooth(p, 0.6, 0.63) * (1 - smooth(p, 0.66, 0.86));
          const f = Math.max(nova, pastFlash * 0.6);
          flash.scale.setScalar(0.08 + 1.3 * f);
          flash.material.opacity = Math.min(1, f * 1.2);
          flash.visible = f > 0.01;
          const shellT = span(p, 0.6, 0.9);
          for (let i = 0; i < SHELL; i += 1) {
            const d = shellDirs[i];
            const rr = 0.03 + shellT * 0.75 * (0.85 + 0.15 * ((i * 37) % 10) / 10);
            shell.set(i, WD.x + d.x * rr, WD.y + d.y * rr, WD.z + d.z * rr * 0.3);
            shell.alpha[i] = shellT > 0 ? 0.8 * (1 - shellT) : 0;
          }
          shell.commit();
          /* Magnitude: about +10 quiet (AAVSO), about +2 at peak, the
           * expected brightness (Schaefer 2023); Polaris is +1.98. */
          const mag = lerp(10, 2, nova);
          magLabel.userData.draw([`Magnitude +${mag.toFixed(1)}`, nova > 0.9 ? "as bright as the North Star" : mag > 6.5 ? "too faint to see by eye" : "visible to the naked eye"]);
          ctx.fade(magLabel, smooth(p, 0.02, 0.06));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "grb-boat",
    section: "deep",
    title: "The brightest gamma-ray burst ever (\"the BOAT\")",
    place: "Sagitta · about 2.4 billion light-years",
    kind: "recorded",
    family: "deepSky",
    when: "9 October 2022",
    often: "once, 2022",
    timeline: { last: "9 October 2022" },
    detail: "GRB 221009A: a giant star collapsed into a black hole, and the gamma rays from its jet still shook Earth's upper atmosphere after 2 billion years",
    frequency: "Gamma-ray bursts are seen about once a day, from all over the sky. One as bright as this one is estimated to come along about once in 10,000 years (Burns et al. 2023)",
    cause: "When a very massive, fast-spinning star runs out of fuel, its core collapses straight into a black hole. Gas swirling into it launches two narrow jets at almost the speed of light, which punch out through the star. If one points at Earth, we see a flash of gamma rays.",
    note: "It came from a galaxy at redshift 0.151 — about 2.4 billion light-years away; its light set out about 2 billion years ago. Its gamma rays measurably disturbed Earth's ionosphere, and swamped many of the detectors that caught it.",
    accuracy: "A diagram. The star, the jets and Earth are not to scale, and the distance between them is shrunk beyond measure. The gamma-ray curve is a sketch of the burst's shape, not a plot of the data.",
    art: { main: "blackhole", fx: "beam" },
    scene(ctx) {
      ctx.starfield(340, { seed: 41 });
      /* layout */
      const S = new THREE.Vector3(-0.66, 0.2, 0);
      const E = new THREE.Vector3(0.8, 0.2, 0);
      const star = ctx.sun(0.16, { colour: "#9fc4ff", hot: "#f2f6ff", halo: 2.4, haloColour: "#9fc4ff", haloOpacity: 0.5, granule: 10 });
      star.position.copy(S);
      const bh = blackHole(ctx, 0.028, { ringColour: "#ffe0b0", glow: 6 });
      bh.holder.position.copy(S);
      const discHolder = new THREE.Group();
      discHolder.position.copy(S);
      /* The disc's axis along the jets (+x), tipped slightly toward us. */
      discHolder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.94, 0.1, 0.32).normalize());
      ctx.add(discHolder);
      const disc = discCloud(ctx, 500, 0.035, 0.11, { parent: discHolder, inner: "#ffffff", outer: "#ff9a4a", seed: 12 });
      /* The jets: two narrow streams along ±x. */
      const JET = 600;
      const jets = ctx.cloud(JET, { size: 3 });
      const rj = rng(14);
      const jetData = Array.from({ length: JET }, (_, i) => {
        jets.tint(i, rj() < 0.5 ? "#e3d4ff" : "#bcd4ff");
        return { u0: rj(), side: i % 2 ? 1 : -1, a: rj() * TAU, w: rj() };
      });

      /* The way to Earth. */
      const path = ctx.line([[S.x + 0.2, S.y - 0.2, 0], [E.x - 0.1, E.y - 0.2, 0]], { colour: "#7f93a8", opacity: 0.5, dashed: true, dash: 0.03, gap: 0.025 });
      const pathLabel = ctx.label(["about 2.4 billion light-years", "its light set out about 2 billion years ago"], { at: [0.07, S.y - 0.28, 0], height: 0.026 });
      const front = ctx.circle(1, { plane: "xy", from: -0.32, to: 0.32, colour: "#e8dcff", opacity: 0.95, segments: 48 });
      front.position.copy(S);
      const frontGlow = ctx.glow("#d8c8ff", 0.22, { opacity: 0.9 });

      ctx.light.set(-0.85, 0.35, 0.4).normalize();
      const earth = ctx.ball(0.07, { body: "Earth", rim: 0.5, rimColour: "#7fb8ff" });
      earth.position.copy(E);
      const iono = facingRing(ctx, 0.082, 0.098, { colour: "#7fe0ff", opacity: 0.25 });
      iono.position.copy(E);
      const ionoHit = ctx.glow("#9fe8ff", 0.35, { opacity: 0.8 });
      ionoHit.position.set(E.x - 0.07, E.y, 0.02);
      const earthLabel = ctx.label(["Earth", ""], { at: [E.x, E.y - 0.17, 0], height: 0.026 });
      const boat = ctx.label(["The BOAT", "Brightest Of All Time"], { at: [0.12, 0.6, 0], height: 0.042, colour: "#f0e6ff" });

      /* Gamma rays over the first ten minutes: a sketch of the shape (a
       * faint first pulse, then the main, overwhelming episodes some 200 s
       * later; Lesage et al. 2023), not the data. */
      const gamma = (u) => {
        const s = u * 600;
        let v = 0.03 + 0.025 * Math.abs(Math.sin(s * 1.7) * Math.sin(s * 0.37));
        v += 0.22 * Math.exp(-(((s - 5) / 3) ** 2));
        [[200, 0.55, 6], [214, 1, 5], [226, 0.8, 4], [238, 1, 6], [252, 0.75, 5], [266, 0.5, 6], [285, 0.3, 12], [395, 0.35, 14], [425, 0.25, 18]]
          .forEach(([c, hh, ww]) => { v += hh * Math.exp(-(((s - c) / ww) ** 2)); });
        return Math.min(0.98, v);
      };
      const lc = chart(ctx, {
        x: -0.75, y: -0.8, w: 1.5, h: 0.3,
        title: "Gamma rays reaching Earth, first ten minutes (sketch)",
        ticks: [[0, "0"], [0.5, "5 min"], [1, "10 min"]],
        colour: "#d8c8ff",
        fn: gamma,
      });

      ctx.tell([
        { at: 0, label: "9 October 2022", text: "The brightest gamma-ray burst ever recorded, GRB 221009A, swept over Earth." },
        { at: 0.1, label: "A star collapses", text: "A giant star's core fell in on itself and became a black hole. Jets burst out of the star at nearly the speed of light." },
        { at: 0.38, label: "2.4 billion light-years", text: "One jet pointed at us. Its gamma rays crossed space for about 2 billion years." },
        { at: 0.6, label: "Felt on Earth", text: "Even from there, it disturbed Earth's ionosphere, the electrified top of the atmosphere." },
        { at: 0.82, label: "The BOAT", text: "So bright it overwhelmed many of the instruments that caught it: the brightest of all time." },
      ]);

      return {
        duration: 22,
        update(p) {
          /* Collapse: the star shrinks into the black hole. */
          const collapse = smooth(p, 0.08, 0.22);
          star.scale.setScalar(Math.max(0.001, 1 - collapse));
          star.visible = collapse < 0.99;
          star.rotation.y = ctx.t * 0.2;
          ctx.fade(bh.holder, smooth(p, 0.16, 0.24));
          ctx.fade(disc.cloud.points, smooth(p, 0.18, 0.26));
          disc.spin(ctx.t * 3);
          const L = 0.55 * smooth(p, 0.22, 0.34);
          for (let i = 0; i < JET; i += 1) {
            const s = jetData[i];
            const u = (s.u0 + ctx.t * 0.6) % 1;
            const x = s.side * (0.03 + u * L);
            const spread = Math.abs(x) * 0.07 * s.w;
            jets.set(i, S.x + x, S.y + Math.cos(s.a) * spread, Math.sin(s.a) * spread);
            jets.alpha[i] = L > 0.01 ? 0.85 * (1 - u * 0.7) : 0;
          }
          jets.commit();

          /* The flash crosses (the gap is not to scale). */
          const travel = span(p, 0.36, 0.6);
          const fx = lerp(S.x + 0.1, E.x - 0.09, travel);
          front.scale.setScalar(Math.max(0.01, fx - S.x));
          ctx.fade(front, win(p, 0.36, 0.61, 0.02));
          frontGlow.position.set(fx, S.y, 0.02);
          ctx.fade(frontGlow, win(p, 0.36, 0.61, 0.02));
          ctx.fade(path, smooth(p, 0.34, 0.4));
          ctx.fade(pathLabel, win(p, 0.37, 0.7));

          /* Earth's ionosphere, struck. */
          const hit = smooth(p, 0.59, 0.61) * (1 - smooth(p, 0.72, 0.9));
          const flicker = 0.75 + 0.25 * Math.sin(ctx.t * 22);
          iono.material.opacity = 0.25 + 0.6 * hit * flicker;
          iono.scale.setScalar(1 + 0.12 * hit);
          ctx.fade(ionoHit, hit * flicker);
          earth.rotation.y = ctx.t * 0.2;
          earthLabel.userData.draw(["Earth", hit > 0.05 ? "ionosphere disturbed" : ""]);

          lc.show(span(p, 0.6, 0.95));
          ctx.fade(lc.group, smooth(p, 0.58, 0.64));
          ctx.fade(boat, smooth(p, 0.82, 0.88));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "sn-1987a",
    section: "deep",
    title: "Supernova 1987A",
    place: "Large Magellanic Cloud · 168,000 light-years",
    kind: "recorded",
    family: "stellar",
    when: "23 February 1987 (neutrinos at 07:35 UT; first seen by eye on the 24th)",
    often: "once, 1987",
    timeline: { last: "23 February 1987" },
    detail: "The nearest supernova seen in nearly 400 years — and the first whose neutrinos were caught, hours before its light",
    frequency: "A supernova goes off in a galaxy like ours perhaps once or twice a century, but most are hidden by dust. None as close had been seen since Kepler's in 1604",
    cause: "A blue supergiant, Sanduleak −69° 202, ran out of fuel. Its iron core collapsed in under a second into a neutron star, releasing a flood of neutrinos at once. The shock took hours to reach the star's surface, so the light left later than the neutrinos did.",
    note: "Kamiokande-II in Japan, IMB in the United States and Baksan in Russia caught about two dozen neutrinos in 13 seconds — out of some 10^58 the collapse released. At its brightest, in May 1987, the supernova reached about magnitude +2.9, easy to see from the southern hemisphere.",
    accuracy: "A diagram: the galaxy, the star and Earth are not to scale, and the 168,000 light-years is shrunk to fit. The race at the end is drawn with the neutrinos' few-hour lead greatly enlarged.",
    art: { main: "galaxy", fx: "burst" },
    scene(ctx) {
      ctx.starfield(320, { seed: 51 });
      /* layout */
      const L = new THREE.Vector3(-0.42, 0.2, 0);
      const r = rng(19);
      /* The LMC: an off-centre bar inside a lopsided disc (drawing choice). */
      const LMC = 2200;
      const lmc = ctx.cloud(LMC, { size: 2.2 });
      for (let i = 0; i < LMC; i += 1) {
        let x;
        let y;
        if (i < 800) {
          const t = (r() * 2 - 1) * 0.27;
          x = t;
          y = (r() + r() + r() - 1.5) * 0.05 + t * 0.15;
          lmc.tint(i, r() < 0.7 ? "#ffe7c4" : "#fff6e6");
        } else {
          const a = r() * TAU;
          const d = 0.42 * Math.sqrt(r()) * (0.85 + 0.25 * Math.sin(a * 3 + 1));
          x = Math.cos(a) * d + 0.04;
          y = Math.sin(a) * d * 0.82;
          lmc.tint(i, r() < 0.06 ? "#ff9fc4" : r() < 0.5 ? "#c6d6ff" : "#eef2ff");
        }
        lmc.set(i, L.x + x, L.y + y, -0.02);
        lmc.alpha[i] = 0.25 + 0.5 * r();
        lmc.size[i] = 1.5 + 1.6 * r();
      }
      lmc.commit();
      const tarantula = ctx.glow("#ff7fb0", 0.22, { opacity: 0.6 });
      tarantula.position.set(L.x - 0.2, L.y + 0.12, 0);
      const SN = new THREE.Vector3(L.x - 0.165, L.y + 0.07, 0.01);
      const lmcLabel = ctx.label(["Large Magellanic Cloud", "168,000 light-years"], { at: [L.x, L.y - 0.47, 0], height: 0.028 });
      const starDot = ctx.glow("#9fc4ff", 0.06, { opacity: 1 });
      starDot.position.copy(SN);
      const blast = ctx.glow("#fff4dc", 1, { opacity: 1 });
      blast.position.copy(SN);
      const snLabel = ctx.label(["Sanduleak −69° 202", "a blue supergiant"], { at: [SN.x - 0.02, SN.y + 0.13, 0], height: 0.024 });

      /* Supernovae seen by eye in our galaxy before it: Tycho's (1572) and
       * Kepler's (1604). */
      const HY = -0.6;
      const HX = (y) => -0.9 + (1.3 * (y - 1550)) / (2000 - 1550);
      const history = new THREE.Group();
      ctx.add(history);
      ctx.line([[HX(1550), HY, 0], [HX(2000), HY, 0]], { colour: "#9fb3c8", opacity: 0.5, additive: false, parent: history });
      const gap = ctx.line([[HX(1604), HY, 0.01], [HX(1987), HY, 0.01]], { colour: "#ffd27f", opacity: 0.9, additive: false, parent: history });
      void gap;
      [[1572, "Tycho's, 1572"], [1604, "Kepler's, 1604"], [1987, "1987A"]].forEach(([y, t], i) => {
        const g = ctx.glow(i === 2 ? "#fff4dc" : "#ffd27f", 0.08, { opacity: 1, parent: history });
        g.position.set(HX(y), HY, 0.02);
        ctx.label([t], { at: [HX(y), HY + (i === 0 ? 0.07 : -0.07), 0], height: 0.021, parent: history, declutter: false });
      });
      ctx.label(["383 years"], { at: [HX(1795), HY + 0.06, 0], height: 0.024, colour: "#ffd27f", parent: history, declutter: false });
      const peak = ctx.label(["Peak: magnitude +2.9, May 1987", "seen by eye from the southern hemisphere"], { at: [0.55, -0.35, 0], height: 0.026 });

      /* The race: neutrinos (green) and light (gold). */
      const E = new THREE.Vector3(0.84, 0.2, 0);
      ctx.light.set(-0.8, 0.4, 0.45).normalize();
      const earth = ctx.ball(0.05, { body: "Earth", rim: 0.5, rimColour: "#7fb8ff" });
      earth.position.copy(E);
      const raceLine = ctx.line([SN, E], { colour: "#7f93a8", opacity: 0.4, dashed: true, dash: 0.03, gap: 0.025 });
      const nu = ctx.glow("#7dffb0", 0.11, { opacity: 1 });
      const light = ctx.glow("#ffe6a0", 0.13, { opacity: 1 });
      const raceClock = ctx.label(["", ""], { at: [0.25, 0.48, 0], height: 0.03 });
      const detectors = ctx.label(["Neutrinos caught", "Kamiokande-II 11 · IMB 8 · Baksan 5"], { at: [0.56, 0.0, 0], height: 0.025, colour: "#9fffc4" });

      /* The ring today: gas shed long before, lit by the blast since the
       * mid-1990s (Hubble). About 0.6 light-years across... drawn enlarged. */
      const ringGroup = new THREE.Group();
      ringGroup.position.copy(SN);
      ctx.add(ringGroup);
      const BEADS = 28;
      const beads = Array.from({ length: BEADS }, (_, i) => {
        const a = (i / BEADS) * TAU + 0.1 * Math.sin(i * 7);
        const g = ctx.glow(i % 3 ? "#fff0d0" : "#ffffff", 0.05 + 0.03 * ((i * 13) % 5) / 5, { opacity: 0.95, parent: ringGroup });
        g.position.set(Math.cos(a) * 0.25, Math.sin(a) * 0.17, 0.02);
        return g;
      });
      const ringLine = ctx.orbit(1, 0, { plane: "xy", colour: "#ffb07a", opacity: 0.35, parent: ringGroup });
      ringLine.scale.set(0.25, 0.17, 1);
      const outerA = ctx.orbit(1, 0, { plane: "xy", colour: "#ff7fa0", opacity: 0.25, parent: ringGroup });
      outerA.scale.set(0.3, 0.2, 1);
      outerA.position.set(0.05, 0.13, -0.01);
      const outerB = ctx.orbit(1, 0, { plane: "xy", colour: "#ff7fa0", opacity: 0.25, parent: ringGroup });
      outerB.scale.set(0.3, 0.2, 1);
      outerB.position.set(-0.05, -0.13, -0.01);
      const core = ctx.glow("#ff9a6a", 0.12, { opacity: 0.6, parent: ringGroup });
      void core;
      const ringLabel = ctx.label(["The ring today", "gas the star shed long before it died, lit by the blast"], { at: [SN.x + 0.12, SN.y - 0.33, 0], height: 0.025 });

      ctx.tell([
        { at: 0, label: "February 1987", text: "A star exploded in the Large Magellanic Cloud, a small galaxy orbiting ours, 168,000 light-years away." },
        { at: 0.2, label: "The closest in 383 years", text: "The nearest supernova seen since Kepler's in 1604 — and visible without a telescope from the south." },
        { at: 0.42, label: "Neutrinos first", text: "The collapsing core released a flood of neutrinos at once. The light escaped only hours later, when the shock reached the surface." },
        { at: 0.66, label: "23 February, 07:35 UT", text: "Three detectors caught about two dozen neutrinos in 13 seconds. The light arrived about three hours later." },
        { at: 0.84, label: "Today", text: "A ring of gas the star shed long before it died, now lit up by the blast." },
      ]);

      return {
        duration: 22,
        update(p) {
          const lmcFade = 1 - 0.7 * smooth(p, 0.82, 0.88);
          ctx.fade(lmc.points, lmcFade);
          ctx.fade(tarantula, lmcFade);
          ctx.fade(lmcLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.38, 0.42)));
          ctx.fade(snLabel, win(p, 0.02, 0.12));
          /* The explosion as we saw it: a flash, then a slow fade. */
          const boom = smooth(p, 0.1, 0.13) * (1 - 0.75 * smooth(p, 0.16, 0.42));
          blast.scale.setScalar(0.05 + 0.5 * boom);
          blast.material.opacity = Math.min(1, boom * 1.3) * (1 - smooth(p, 0.82, 0.86));
          ctx.fade(starDot, 1 - smooth(p, 0.1, 0.12));
          ctx.fade(history, win(p, 0.2, 0.42));
          ctx.fade(peak, win(p, 0.2, 0.42));

          /* The race (a replay): neutrinos leave at the collapse, light hours later. */
          const vis = win(p, 0.42, 0.82);
          ctx.fade(raceLine, vis);
          const nuT = span(p, 0.45, 0.66);
          const lightT = span(p, 0.49, 0.7);
          nu.position.lerpVectors(SN, E, nuT).setZ(0.03);
          light.position.lerpVectors(SN, E, lightT).setZ(0.03);
          ctx.fade(nu, vis * (nuT > 0 && nuT < 1 ? 1 : 0.0));
          ctx.fade(light, vis * (lightT > 0 && lightT < 1 ? 1 : 0.0));
          const years = 168000 * Math.min(nuT, 1);
          const text = p < 0.45 ? ["The core collapses", "neutrinos leave at once"]
            : p < 0.49 ? ["Hours later", "the shock breaks out: light leaves"]
              : nuT < 1 ? [`${fmt(years)} years on the way`, "neutrinos a few hours ahead"]
                : lightT < 1 ? ["23 February 1987, 07:35 UT", "the neutrinos arrive"]
                  : ["About 3 hours later", "the light arrives"];
          raceClock.userData.draw(text);
          ctx.fade(raceClock, vis);
          ctx.fade(detectors, smooth(p, 0.66, 0.69) * (1 - smooth(p, 0.8, 0.83)));
          const earthFlash = Math.exp(-(((p - 0.66) / 0.012) ** 2)) + Math.exp(-(((p - 0.7) / 0.012) ** 2));
          earth.scale.setScalar(1 + 0.25 * earthFlash);
          earth.rotation.y = ctx.t * 0.2;
          ctx.fade(earth, win(p, 0.4, 0.84));

          /* The ring. */
          const ring = smooth(p, 0.84, 0.9);
          ctx.fade(ringGroup, ring);
          beads.forEach((b, i) => { b.material.opacity = ring * (0.6 + 0.4 * Math.sin(ctx.t * 2 + i)); });
          ctx.fade(ringLabel, smooth(p, 0.86, 0.9));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 5 */
  event({
    id: "crab-supernova",
    section: "deep",
    title: "The Crab supernova",
    place: "Taurus · about 6,500 light-years",
    kind: "recorded",
    family: "stellar",
    when: "4 July 1054",
    often: "once, 1054",
    timeline: { last: "4 July 1054" },
    detail: "A 'guest star' bright enough to see in daylight for 23 days — and in its place today, the Crab Nebula, with a dead star spinning 30 times a second",
    frequency: "Once. Its light reached Earth in 1054; the star itself had exploded about 6,500 years before that",
    cause: "A massive star ran out of fuel and its core collapsed into a neutron star, blasting the rest of the star into space. The debris is still flying outward at about 1,500 km/s, lit from within by the neutron star's wind.",
    note: "Astronomers of China's Song dynasty recorded the 'guest star' near ζ Tauri on 4 July 1054: visible by day for 23 days and at night for 653. The pulsar at the Crab's heart, found in 1968, turns once every 33.7 milliseconds — about 30 times a second.",
    accuracy: "The sky is drawn from real star positions in Taurus. The nebula and pulsar are a diagram, not to scale, and the pulsar's beams are drawn about a hundred times slower than they really turn.",
    art: { main: "nebula", second: "neutronstar", fx: "pulse" },
    scene(ctx) {
      ctx.starfield(260, { seed: 55 });
      /* layout */
      const N = new THREE.Vector3(-0.32, 0.1, 0);
      /* Taurus: RA, Dec (J2000, degrees) and V magnitude (Yale Bright Star
       * Catalogue); the guest star near ζ Tauri at the Crab's position. */
      const STARS = [
        ["Aldebaran", 68.98, 16.51, 0.86], ["Elnath", 81.57, 28.61, 1.65], ["ζ Tau", 84.41, 21.14, 3.0],
        ["γ Tau", 64.95, 15.63, 3.65], ["δ Tau", 65.73, 17.54, 3.76], ["ε Tau", 67.15, 19.18, 3.53], ["θ Tau", 67.17, 15.87, 3.4],
        ["λ Tau", 60.17, 12.49, 3.4], ["Alcyone", 56.87, 24.1, 2.87], ["Atlas", 57.29, 24.05, 3.6], ["Electra", 56.22, 24.11, 3.7],
        ["Maia", 56.46, 24.37, 3.9], ["Merope", 56.58, 23.95, 4.1], ["Taygeta", 56.3, 24.47, 4.3],
      ];
      const CRAB = [83.63, 22.01];
      const K = 0.03; /* layout: hud units per degree */
      const proj = (ra, dec) => new THREE.Vector3(-(ra - CRAB[0]) * 0.94 * K, (dec - CRAB[1]) * K, 0);
      const sky = new THREE.Group();
      sky.position.copy(N);
      ctx.add(sky);
      const window_ = ctx.disc(0.6, { colour: "#3b72b8", opacity: 0.85, parent: sky });
      window_.position.set(0.33, 0, -0.05);
      const rim = ctx.circle(0.6, { plane: "xy", colour: "#9fc4ff", opacity: 0.4, parent: sky });
      rim.position.copy(window_.position);
      const taurus = ctx.cloud(STARS.length, { size: 4, parent: sky });
      STARS.forEach(([name, ra, dec, mag], i) => {
        const v = proj(ra, dec);
        taurus.set(i, v.x, v.y, 0.01);
        taurus.size[i] = Math.max(2, 9 - 2 * mag);
        taurus.tint(i, name === "Aldebaran" ? "#ffb98a" : "#eef4ff");
      });
      taurus.commit();
      const aldebaran = proj(68.98, 16.51);
      const pleiades = proj(56.7, 24.1);
      const zeta = proj(84.41, 21.14);
      const skyLabels = [
        ctx.label(["Aldebaran"], { at: [aldebaran.x, aldebaran.y - 0.06, 0], height: 0.022, parent: sky }),
        ctx.label(["Pleiades"], { at: [pleiades.x, pleiades.y + 0.07, 0], height: 0.022, parent: sky }),
        ctx.label(["ζ Tauri"], { at: [zeta.x + 0.03, zeta.y - 0.05, 0], height: 0.022, parent: sky }),
      ];
      const guest = ctx.glow("#fffbe8", 0.3, { opacity: 1, parent: sky });
      guest.position.set(0, 0, 0.02);
      const spikes = [
        ctx.line([[-0.1, 0, 0.02], [0.1, 0, 0.02]], { colour: "#fffbe8", opacity: 0.8, parent: sky }),
        ctx.line([[0, -0.1, 0.02], [0, 0.1, 0.02]], { colour: "#fffbe8", opacity: 0.8, parent: sky }),
      ];
      const guestLabel = ctx.label(["Guest star"], { at: [-0.02, 0.1, 0], height: 0.028, parent: sky });
      const dayLabel = ctx.label(["", ""], { at: [0.0, -0.62, 0], height: 0.032 });

      /* The nebula: filaments in an ellipsoid (the Crab is about 1.4 times
       * longer than wide, drawing from its images), a blue glow inside. */
      const neb = new THREE.Group();
      neb.position.copy(N);
      ctx.add(neb);
      const rn = rng(61);
      const FIL = 2600;
      const fil = ctx.cloud(FIL, { size: 2.6, parent: neb });
      const strands = Array.from({ length: 70 }, () => ({
        d: new THREE.Vector3(rn() - 0.5, rn() - 0.5, rn() - 0.5).normalize(),
        bend: new THREE.Vector3(rn() - 0.5, rn() - 0.5, rn() - 0.5).multiplyScalar(0.5),
        colour: rn() < 0.25 ? "#e8e070" : rn() < 0.6 ? "#ff7a4a" : "#ff9f7a",
      }));
      const filBase = [];
      for (let i = 0; i < FIL; i += 1) {
        const s = strands[i % strands.length];
        const t = 0.35 + 0.65 * rn();
        const v = s.d.clone().multiplyScalar(t).addScaledVector(s.bend, t * t * 0.3);
        v.x *= 1.0;
        v.y *= 0.68;
        v.z *= 0.75;
        v.x += (rn() - 0.5) * 0.04;
        v.y += (rn() - 0.5) * 0.04;
        filBase.push(v);
        fil.tint(i, s.colour);
        fil.alpha[i] = 0.35 + 0.5 * rn();
        fil.size[i] = 1.6 + 2.2 * rn();
      }
      const SYN = 900;
      const syn = ctx.cloud(SYN, { size: 3, parent: neb });
      const synBase = directions(SYN, 63).map((d, i) => {
        const k = Math.cbrt(rn()) * 0.75;
        syn.tint(i, rn() < 0.5 ? "#8fb4ff" : "#c8d8ff");
        syn.alpha[i] = 0.18 + 0.2 * rn();
        return new THREE.Vector3(d.x * k, d.y * k * 0.68, d.z * k * 0.75);
      });
      const blue = ctx.glow("#7fa8ff", 0.5, { opacity: 0.5, parent: neb });
      void blue;
      const pulsar = ctx.glow("#ffffff", 0.05, { opacity: 1, parent: neb });
      const torus = ctx.ring(0.035, 0.07, { colour: "#bcd4ff", opacity: 0.35, additive: true, parent: neb });
      torus.rotation.set(1.1, 0, 0.5);
      const beamA = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#d8e8ff", opacity: 0.9, parent: neb });
      const beamB = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#d8e8ff", opacity: 0.9, parent: neb });
      const axis = new THREE.Vector3(0.3, 0.9, 0.3).normalize();
      const mag0 = new THREE.Vector3(1, 0.2, 0).normalize();
      const nebLabel = ctx.label(["The Crab Nebula", "about 10 light-years across, still expanding"], { at: [N.x, N.y - 0.5, 0], height: 0.028 });
      const pulsarLabel = ctx.label(["The pulsar", "30 turns a second — shown 100× slower"], { at: [N.x + 0.66, N.y + 0.38, 0], height: 0.026 });
      const pulsarPointer = ctx.line([[N.x + 0.5, N.y + 0.32, 0.3], [N.x + 0.06, N.y + 0.03, 0.3]], { colour: "#bcd4ff", opacity: 0.6, additive: false });
      const yearLabel = ctx.label(["", ""], { at: [N.x + 0.75, N.y - 0.25, 0], height: 0.032 });
      const tmp = new THREE.Vector3();

      ctx.tell([
        { at: 0, label: "4 July 1054", text: "Astronomers of the Song dynasty in China record a 'guest star' near ζ Tauri." },
        { at: 0.12, label: "Seen in daylight", text: "Bright enough to see in the daytime sky for 23 days, and at night for nearly two years." },
        { at: 0.4, label: "A supernova", text: "A massive star had exploded. Its debris is still flying outward at about 1,500 km/s." },
        { at: 0.66, label: "The Crab today", text: "6,500 light-years away. At its heart, the star's collapsed core: a neutron star spinning 30 times a second." },
      ]);

      return {
        duration: 22,
        update(p) {
          /* Day by day: 23 days in daylight (to p 0.27), then 653 nights. */
          const day = p < 0.3 ? 1 + 29 * span(p, 0.03, 0.3) : 30 + 623 * span(p, 0.3, 0.38);
          const daylight = 1 - smooth(day, 22.5, 24.5);
          window_.material.color.set("#0a1428").lerp(new THREE.Color("#3b72b8"), daylight);
          taurus.alpha.forEach((_, i) => { taurus.alpha[i] = 0.15 + 0.85 * (1 - daylight); });
          taurus.commit();
          const fadeGuest = 1 - smooth(day, 300, 653);
          guest.scale.setScalar(0.06 + 0.3 * fadeGuest);
          ctx.fade(guest, 0.3 + 0.7 * fadeGuest);
          spikes.forEach((s) => { ctx.fade(s, fadeGuest * 0.9); s.scale.setScalar(0.4 + 0.6 * fadeGuest); });
          dayLabel.userData.draw(day < 23.5 ? [`Day ${Math.floor(day)}`, "visible in broad daylight"] : day < 652 ? [`Night ${Math.floor(day)}`, "visible after dark only"] : ["Day 653", "lost from sight, April 1056"]);
          ctx.fade(dayLabel, smooth(p, 0.02, 0.05) * (1 - smooth(p, 0.38, 0.41)));

          /* The zoom into the nebula. */
          const zoom = smooth(p, 0.38, 0.46);
          sky.scale.setScalar(1 + 2 * zoom);
          ctx.fade(sky, 1 - zoom);
          skyLabels.forEach((l) => ctx.fade(l, 1 - smooth(p, 0.35, 0.38)));
          ctx.fade(guestLabel, win(p, 0.03, 0.36));

          /* Expansion: 1054 to 2026, size growing with age. */
          const year = Math.round(lerp(1054, 2026, smooth(p, 0.42, 0.78)));
          const size = 0.05 + 0.5 * smooth(p, 0.4, 0.78);
          ctx.fade(neb, smooth(p, 0.39, 0.45));
          for (let i = 0; i < FIL; i += 1) {
            const b = filBase[i];
            fil.set(i, b.x * size, b.y * size, b.z * size);
          }
          fil.commit();
          for (let i = 0; i < SYN; i += 1) {
            const b = synBase[i];
            syn.set(i, b.x * size, b.y * size, b.z * size);
          }
          syn.commit();
          neb.rotation.y = 0.15 * Math.sin(ctx.t * 0.1);
          blue.scale.setScalar(size * 1.4);

          /* The lighthouse: beams sweep round the spin axis. */
          const turn = ctx.t * TAU * 0.3;
          tmp.copy(mag0).applyAxisAngle(axis, turn);
          const len = 0.32 * smooth(p, 0.6, 0.66);
          ctx.setLine(beamA, [[0, 0, 0], [tmp.x * len, tmp.y * len, tmp.z * len]]);
          ctx.setLine(beamB, [[0, 0, 0], [-tmp.x * len, -tmp.y * len, -tmp.z * len]]);
          ctx.fade(beamA, smooth(p, 0.6, 0.66));
          ctx.fade(beamB, smooth(p, 0.6, 0.66));
          const blink = Math.pow(Math.max(0, Math.abs(tmp.z)), 6);
          pulsar.scale.setScalar(0.04 + 0.1 * blink);
          ctx.fade(pulsarLabel, smooth(p, 0.64, 0.7));
          ctx.fade(pulsarPointer, smooth(p, 0.64, 0.7));
          ctx.fade(nebLabel, smooth(p, 0.7, 0.76));
          yearLabel.userData.draw([`${year}`, `${year - 1054} years after`]);
          ctx.fade(yearLabel, smooth(p, 0.42, 0.46));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "gw150914",
    section: "deep",
    title: "Two black holes merge: the first gravitational waves",
    place: "About 1.3 billion light-years",
    kind: "recorded",
    family: "deepSky",
    when: "14 September 2015, 09:50:45 UTC",
    often: "once, 2015",
    timeline: { last: "14 September 2015" },
    detail: "Black holes of 36 and 29 Suns spiral together and merge — and space itself rings, a shiver LIGO caught a century after Einstein predicted it",
    frequency: "The first of many: LIGO, Virgo and KAGRA now catch a black-hole merger every few days while they are running",
    cause: "Two black holes going round each other stir space-time and send out gravitational waves, which carry away energy. The orbit shrinks, the waves grow stronger, and in the last fraction of a second the two plunge together and merge into one black hole, which rings down to rest.",
    note: "In the last 0.2 seconds the signal swept from 35 to 250 Hz. The final black hole weighed 62 Suns: the other 3 Suns' worth of mass left as gravitational waves — for an instant more power than all the stars in the observable universe. At LIGO's 4-km arms it was a stretch of a few thousandths of a proton's width.",
    accuracy: "A diagram. The rubber sheet is a picture of curved space, not a map of it; the black holes are drawn hundreds of times too big for their orbit; and the chirp is drawn with far fewer cycles than the real signal.",
    art: { main: "blackhole", second: "blackhole", fx: "ripple" },
    scene(ctx) {
      ctx.starfield(300, { seed: 61 });
      /* layout */
      const G = new THREE.Group();
      G.position.set(0, -0.2, 0);
      G.rotation.x = 0.5;
      ctx.add(G);
      /* Masses, in Suns (Abbott et al. 2016, PRL 116, 061102): 36 + 29,
       * final 62, so 3 radiated. Radii drawn in proportion to mass. */
      const M1 = 36;
      const M2 = 29;
      const MF = 62;
      const RS = 0.0014; /* drawing choice: hud units per solar mass */
      const TM = 0.6; /* layout: the merger, as progress */
      const ORBITS = 9; /* drawing choice: orbits shown before the merger */
      const tau = (p) => clamp01((TM - p) / TM);
      const sep = (p) => 0.42 * Math.pow(tau(p), 0.25);
      const phase = (p) => -TAU * ORBITS * Math.pow(Math.max(tau(p), 0.02), 0.625);
      const amp = (p) => (p < TM ? Math.min(0.06, 0.014 * Math.pow(Math.max(tau(p), 1e-4), -0.25)) : 0.06 * Math.exp(-(p - TM) / 0.015));
      /* The strain for the chart (fuller chirp than the grid can show). */
      const strainPhase = (p) => -TAU * 14 * Math.pow(Math.max(tau(p), 0.0015), 0.625);
      const strain = (p) => (p < TM ? amp(p) * Math.cos(2 * strainPhase(p)) : amp(p) * Math.cos(2 * strainPhase(TM - 1e-4) + (p - TM) * 600));

      const holes = [M1, M2].map((m) => blackHole(ctx, m * RS, { parent: G, ringColour: "#cfe0ff", glowColour: "#6f9fff", glow: 4, ringOpacity: 0.7 }));
      holes.forEach((h) => { h.ring.rotation.x = Math.PI / 2 - G.rotation.x; });
      const final = blackHole(ctx, MF * RS, { parent: G, ringColour: "#cfe0ff", glowColour: "#6f9fff", glow: 4, ringOpacity: 0.8 });
      final.ring.rotation.x = Math.PI / 2 - G.rotation.x;

      /* The sheet: rings and spokes, dipped under each mass, rippled by a
       * quadrupole wave (cos 2(φ − θ)) leaving at the wave speed. */
      const RINGS = 12;
      const SPOKES = 24;
      const RMAX = 1.0;
      const SEG = 120;
      const SPOKE_PTS = 70;
      const C = 2.4; /* drawing choice: wave speed, hud units per unit of progress */
      const rings = Array.from({ length: RINGS }, (_, k) => ({ r: (RMAX * (k + 1)) / RINGS, line: ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#5f8fd0", opacity: 0.4, parent: G }) }));
      const spokes = Array.from({ length: SPOKES }, (_, j) => ({ a: (j / SPOKES) * TAU, line: ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#5f8fd0", opacity: 0.28, parent: G }) }));
      const holePos = [new THREE.Vector3(), new THREE.Vector3()];
      let merged = false;
      const height = (x, z, p) => {
        let y = 0;
        if (!merged) {
          y -= (M1 / 65) * 0.05 / Math.sqrt((x - holePos[0].x) ** 2 + (z - holePos[0].z) ** 2 + 0.012);
          y -= (M2 / 65) * 0.05 / Math.sqrt((x - holePos[1].x) ** 2 + (z - holePos[1].z) ** 2 + 0.012);
        } else {
          y -= (MF / 65) * 0.05 / Math.sqrt(x * x + z * z + 0.012);
        }
        const r = Math.hypot(x, z);
        const tr = p - r / C;
        if (tr > 0) {
          const th = Math.atan2(z, x);
          const ph = tr < TM ? phase(tr) : phase(TM - 1e-4) + (tr - TM) * 260;
          y += amp(tr) * 1.6 * Math.cos(2 * (ph - th));
        }
        return y * 0.9;
      };

      const lc = chart(ctx, {
        x: -0.85, y: 0.5, w: 1.7, h: 0.26,
        title: "The chirp: space stretched and squeezed (sketch)",
        ticks: [[0, "orbiting"], [(TM - 0.02) / 0.68, "merger"]],
        colour: "#9fd0ff",
        samples: 900,
        fn: (u) => 0.5 + strain(0.02 + u * 0.68) / 0.13,
      });
      const lab1 = ctx.label(["36 Suns"], { height: 0.026, parent: G });
      const lab2 = ctx.label(["29 Suns"], { height: 0.026, parent: G });
      const labF = ctx.label(["62 Suns", "3 Suns' worth went into the waves"], { height: 0.028, parent: G });
      const info = ctx.label(["", ""], { at: [0.62, -0.64, 0], height: 0.028 });

      ctx.tell([
        { at: 0, label: "14 September 2015", text: "LIGO's two detectors, 3,000 km apart, felt space stretch and squeeze — by a few thousandths of a proton's width." },
        { at: 0.14, label: "Two black holes", text: "36 and 29 times the Sun's mass, spiralling together faster and faster, 1.3 billion light-years away." },
        { at: 0.56, label: "One black hole", text: "In a fraction of a second they merged into one of 62 Suns. Three Suns' worth of mass left as gravitational waves." },
        { at: 0.8, label: "A century after Einstein", text: "The first gravitational waves ever detected, 100 years after Einstein predicted them." },
      ]);

      const pts = Array.from({ length: Math.max(SEG, SPOKE_PTS) + 1 }, () => new THREE.Vector3());
      return {
        duration: 22,
        update(p) {
          merged = p >= TM;
          const a = sep(p);
          const ph = phase(p);
          const r1 = (a * M2) / (M1 + M2);
          const r2 = (a * M1) / (M1 + M2);
          holePos[0].set(Math.cos(ph) * r1, 0, Math.sin(ph) * r1);
          holePos[1].set(-Math.cos(ph) * r2, 0, -Math.sin(ph) * r2);
          holes.forEach((h, i) => {
            const m = i ? M2 : M1;
            h.holder.position.set(holePos[i].x, height(holePos[i].x, holePos[i].z, p) * 0.4 + m * RS, holePos[i].z);
            ctx.fade(h.holder, merged ? 0 : 1);
          });
          lab1.position.copy(holes[0].holder.position).add(new THREE.Vector3(0, 0.12, 0));
          lab2.position.copy(holes[1].holder.position).add(new THREE.Vector3(0, 0.12, 0));
          ctx.fade(lab1, win(p, 0.06, TM - 0.08));
          ctx.fade(lab2, win(p, 0.06, TM - 0.08));
          const ring = merged ? 1 + 0.25 * Math.exp(-(p - TM) / 0.02) * Math.sin((p - TM) * 900) : 1;
          final.holder.scale.set(ring, 1 / ring, 1);
          final.holder.position.set(0, height(0.001, 0.001, p) * 0.4 + MF * RS, 0);
          ctx.fade(final.holder, merged ? 1 : 0);
          labF.position.set(0, final.holder.position.y + 0.16, 0);
          ctx.fade(labF, smooth(p, TM + 0.02, TM + 0.06));

          rings.forEach(({ r, line }) => {
            for (let i = 0; i <= SEG; i += 1) {
              const t = (i / SEG) * TAU;
              const x = Math.cos(t) * r;
              const z = Math.sin(t) * r;
              pts[i].set(x, height(x, z, p), z);
            }
            ctx.setLine(line, pts.slice(0, SEG + 1));
          });
          spokes.forEach(({ a: th, line }) => {
            for (let i = 0; i <= SPOKE_PTS; i += 1) {
              const r = 0.06 + ((RMAX - 0.06) * i) / SPOKE_PTS;
              const x = Math.cos(th) * r;
              const z = Math.sin(th) * r;
              pts[i].set(x, height(x, z, p), z);
            }
            ctx.setLine(line, pts.slice(0, SPOKE_PTS + 1));
          });

          lc.show(clamp01((p - 0.02) / 0.68));
          info.userData.draw(p < TM ? ["1.3 billion light-years away", `${(0.2 * tau(p) ** 0.4 * 1000).toFixed(0)} ms to merger (time slowed)`]
            : p < 0.8 ? ["Merged", "the ringing dies away in milliseconds"]
              : ["Reached Earth 14 Sept 2015", "Livingston, then Hanford 7 ms later"]);
          ctx.fade(info, smooth(p, 0.04, 0.08));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 7 */
  event({
    id: "magnetar-flare",
    section: "deep",
    title: "A magnetar's giant flare",
    place: "SGR 1806-20 · Sagittarius · about 50,000 light-years",
    kind: "recorded",
    family: "stellar",
    when: "27 December 2004",
    often: "once, 2004",
    timeline: { last: "27 December 2004" },
    detail: "A dead star 20 km across, with the strongest magnetic field known, let out more energy in a fifth of a second than the Sun does in 100,000 years",
    frequency: "Giant flares like this are rare: only three had been seen from magnetars in our galaxy and its neighbours by 2004, in 1979, 1998 and this one, by far the brightest",
    cause: "A magnetar is a neutron star whose magnetic field is about a thousand trillion times Earth's. The field strains the star's solid crust until it cracks; the field snaps into a new shape and dumps its energy in a fireball of gamma rays.",
    note: "Its distance is uncertain — estimates run from about 30,000 to 50,000 light-years, on the far side of the galaxy's centre. Even so, its gamma rays briefly disturbed Earth's ionosphere, and swamped detectors on many spacecraft.",
    accuracy: "A diagram. The star, its field lines and the galaxy are drawn for clarity, not to scale; the field is drawn as a simple dipole, which the real one is not.",
    art: { main: "neutronstar", fx: "flare" },
    scene(ctx) {
      ctx.starfield(300, { seed: 71 });
      /* layout */
      const NS = new THREE.Vector3(-0.25, 0.08, 0);
      const mag = new THREE.Group();
      mag.position.copy(NS);
      ctx.add(mag);
      const star = ctx.ball(0.06, { colour: "#dfe8ff", emissive: "#3a4a70", rim: 0.9, rimColour: "#9fc4ff", parent: mag });
      const starGlow = ctx.glow("#9fc4ff", 0.35, { opacity: 0.6, parent: mag });
      /* The field: dipole loops r = L sin²θ, tilted. */
      const field = new THREE.Group();
      field.rotation.z = 0.35;
      mag.add(field);
      const LOOPS = [0.13, 0.19, 0.27, 0.38, 0.52];
      const AZ = 6;
      const loops = [];
      LOOPS.forEach((L, li) => {
        for (let k = 0; k < AZ; k += 1) {
          const line = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: li < 2 ? "#9fd8ff" : "#7fa8ff", opacity: 0.55, parent: field });
          loops.push({ L, phi: (k / AZ) * TAU + li * 0.3, line });
        }
      });
      const loopPts = Array.from({ length: 49 }, () => new THREE.Vector3());
      const drawLoop = (loop, twist, scale) => {
        const th0 = Math.asin(Math.min(1, Math.sqrt(0.06 / loop.L)));
        for (let i = 0; i <= 48; i += 1) {
          const th = th0 + ((Math.PI - 2 * th0) * i) / 48;
          const rr = loop.L * Math.sin(th) ** 2 * scale;
          const ph = loop.phi + twist * (th - Math.PI / 2);
          loopPts[i].set(rr * Math.sin(th) * Math.cos(ph), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(ph));
        }
        ctx.setLine(loop.line, loopPts);
      };
      const fireball = ctx.glow("#ffffff", 1, { opacity: 1, parent: mag });
      const BURST = 700;
      const burst = ctx.cloud(BURST, { size: 3, parent: mag });
      const burstDirs = directions(BURST, 73);
      burstDirs.forEach((_, i) => burst.tint(i, i % 4 ? "#d8c8ff" : "#ffffff"));
      const shock = ctx.circle(1, { plane: "xy", colour: "#e8dcff", opacity: 0.8, parent: mag });
      const magLabel = ctx.label(["SGR 1806-20", "a magnetar, about 20 km across"], { at: [NS.x, NS.y - 0.62, 0], height: 0.028 });
      const energy = ctx.label(["", ""], { at: [0.55, 0.42, 0], height: 0.034 });

      /* Across the galaxy (face-on, drawing): Sun 26,000 ly from the centre;
       * the magnetar beyond the centre, about 50,000 ly from us. */
      const GC = new THREE.Vector3(-0.2, 0.08, 0);
      const KPC = 0.04; /* layout: hud units per kiloparsec */
      const gal = spiralGalaxy(ctx, 3500, { radius: 0.62, arms: 4, wind: 2.4, bar: 0.22, seed: 74, size: 2 });
      gal.holder.position.copy(GC);
      gal.holder.rotation.x = Math.PI / 2;
      const SUN = new THREE.Vector3(GC.x, GC.y - 8.2 * KPC, 0.02);
      const MAGP = new THREE.Vector3(SUN.x + 15.3 * KPC * Math.sin(0.175), SUN.y + 15.3 * KPC * Math.cos(0.175), 0.02);
      const sunDot = ctx.glow("#ffd27f", 0.07, { opacity: 1 });
      sunDot.position.copy(SUN);
      const magDot = ctx.glow("#d8c8ff", 0.1, { opacity: 1 });
      magDot.position.copy(MAGP);
      const pulse = ctx.circle(1, { plane: "xy", colour: "#e8dcff", opacity: 0.85 });
      pulse.position.copy(MAGP);
      const sunLabel = ctx.label(["Sun"], { at: [SUN.x - 0.1, SUN.y - 0.04, 0], height: 0.026 });
      const galLabel = ctx.label(["SGR 1806-20", "about 50,000 light-years from us"], { at: [MAGP.x, MAGP.y + 0.12, 0], height: 0.026 });
      const E = new THREE.Vector3(0.72, -0.3, 0);
      ctx.light.set(-0.9, 0.5, 0.35).normalize();
      const earth = ctx.ball(0.09, { body: "Earth", rim: 0.5, rimColour: "#7fb8ff" });
      earth.position.copy(E);
      const iono = facingRing(ctx, 0.105, 0.125, { colour: "#7fe0ff", opacity: 0.3 });
      iono.position.copy(E);
      const ionoHit = ctx.glow("#9fe8ff", 0.4, { opacity: 0.8 });
      ionoHit.position.set(E.x - 0.08, E.y + 0.03, 0.03);
      const earthLabel = ctx.label(["Earth", "ionosphere disturbed"], { at: [E.x, E.y - 0.2, 0], height: 0.026 });
      const link = ctx.line([SUN, E], { colour: "#7f93a8", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.02 });

      ctx.tell([
        { at: 0, label: "A magnetar", text: "A neutron star 20 km across, with a magnetic field about a thousand trillion times Earth's." },
        { at: 0.2, label: "27 December 2004", text: "The field strained the crust until it cracked. The field snapped into a new shape: a giant flare." },
        { at: 0.36, label: "A fifth of a second", text: "In that instant it gave out more energy than the Sun does in 100,000 years." },
        { at: 0.56, label: "Across the galaxy", text: "From about 50,000 light-years away, beyond the galaxy's centre, it still disturbed Earth's ionosphere." },
      ]);

      return {
        duration: 22,
        update(p) {
          const stage1 = 1 - smooth(p, 0.52, 0.58);
          ctx.fade(mag, stage1);
          star.rotation.y = ctx.t * 0.8;
          /* The twist builds, then snaps at p = 0.3. */
          const twist = 1.6 * smooth(p, 0.06, 0.29) * (p < 0.3 ? 1 : 0);
          const open = smooth(p, 0.3, 0.42);
          const relax = smooth(p, 0.42, 0.52);
          loops.forEach((loop) => {
            const outer = loop.L > 0.2;
            drawLoop(loop, twist + (p < 0.3 ? Math.sin(ctx.t * 9 + loop.phi) * 0.05 * smooth(p, 0.2, 0.29) : 0), outer ? 1 + 1.5 * open * (1 - relax) : 1);
            loop.line.material.opacity = 0.55 * (outer ? (1 - open * (1 - relax) * 0.9) : 1) * stage1 * (0.6 + 0.4 * smooth(p, 0.06, 0.29));
          });
          field.rotation.y = ctx.t * 0.15;
          const flare = smooth(p, 0.295, 0.305) * Math.exp(-Math.max(0, p - 0.305) / 0.04);
          fireball.scale.setScalar(0.05 + 1.6 * flare);
          fireball.material.opacity = Math.min(1, flare * 1.4) * stage1;
          starGlow.material.opacity = (0.6 + 0.4 * flare) * stage1;
          const bt = span(p, 0.3, 0.5);
          for (let i = 0; i < BURST; i += 1) {
            const d = burstDirs[i];
            const rr = 0.07 + bt * (0.6 + 0.3 * ((i * 17) % 10) / 10);
            burst.set(i, d.x * rr, d.y * rr, d.z * rr * 0.4);
            burst.alpha[i] = bt > 0 && bt < 1 ? 0.9 * (1 - bt) : 0;
          }
          burst.commit();
          shock.scale.setScalar(Math.max(0.01, 0.08 + bt * 0.9));
          ctx.fade(shock, bt > 0 ? (1 - bt) * stage1 : 0);
          ctx.fade(magLabel, win(p, 0.02, 0.5));
          /* Energy: about 2 × 10^46 erg in the first 0.2 s for a distance of
           * 15 kpc (Hurley et al. 2005, Palmer et al. 2005); the Sun gives
           * 1.2 × 10^41 erg a year, so well over 100,000 years' worth. */
          const yrs = 100000 * smooth(p, 0.32, 0.46);
          energy.userData.draw(p < 0.46 ? ["In 0.2 seconds:", `the Sun's output for ${fmt(yrs)} years`] : ["In 0.2 seconds:", "more than the Sun gives in 100,000 years"]);
          ctx.fade(energy, smooth(p, 0.32, 0.35) * (1 - smooth(p, 0.54, 0.58)));

          const stage2 = smooth(p, 0.54, 0.6);
          ctx.fade(gal.holder, stage2 * 0.9);
          gal.holder.rotation.y = -0.05 * ctx.t;
          ctx.fade(sunDot, stage2);
          ctx.fade(magDot, stage2);
          ctx.fade(sunLabel, stage2);
          ctx.fade(galLabel, stage2);
          const reach = MAGP.distanceTo(SUN);
          const pr = span(p, 0.62, 0.78);
          pulse.scale.setScalar(Math.max(0.01, pr * reach * 1.4));
          ctx.fade(pulse, pr > 0 ? stage2 * (1 - smooth(pr, 0.75, 1)) : 0);
          magDot.scale.setScalar(0.1 + 0.25 * Math.exp(-(((p - 0.62) / 0.015) ** 2)));
          const arrive = smooth(p, 0.75, 0.77);
          ctx.fade(link, arrive);
          ctx.fade(earth, smooth(p, 0.6, 0.66));
          earth.rotation.y = ctx.t * 0.2;
          const hit = arrive * (1 - smooth(p, 0.86, 0.98));
          const flick = 0.75 + 0.25 * Math.sin(ctx.t * 20);
          iono.material.opacity = (0.3 + 0.6 * hit * flick) * smooth(p, 0.6, 0.66);
          ctx.fade(ionoHit, hit * flick);
          ctx.fade(earthLabel, smooth(p, 0.76, 0.8));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 8 */
  event({
    id: "tidal-disruption",
    section: "deep",
    title: "A star torn apart by a black hole",
    place: "The hearts of other galaxies",
    kind: "recurring",
    family: "galactic",
    often: "once every 10,000–100,000 years in a galaxy",
    detail: "A star strays too close to a giant black hole and is stretched into a stream — half flung away, half swallowed in a flare that lasts for months",
    frequency: "In any one galaxy, perhaps once every 10,000 to 100,000 years. With millions of galaxies to watch, sky surveys now find dozens a year",
    cause: "Gravity weakens with distance, so near a black hole of millions of Suns the pull on a star's near side is much stronger than on its far side. Close enough, that difference beats the star's own gravity: it is pulled into a long stream (spaghettified). About half the gas is bound and falls back; the rest escapes.",
    note: "ASASSN-14li, found in November 2014 in a galaxy about 290 million light-years away, is one of the best watched: it glowed in X-rays, ultraviolet and radio for years. Its fading — roughly as time to the power −5/3 — is the signature of debris raining back.",
    accuracy: "A diagram: the star is drawn far larger than it is next to the black hole, and the debris orbits are computed with Kepler's laws but squeezed in time so the gas returns within the event.",
    art: { main: "blackhole", second: "star", fx: "stream" },
    scene(ctx) {
      ctx.starfield(300, { seed: 81 });
      /* layout */
      const B = new THREE.Vector3(0.2, 0.0, 0);
      const bh = blackHole(ctx, 0.05, { ringColour: "#ffcf8a", glow: 5 });
      bh.holder.position.copy(B);
      const flare = ctx.glow("#dfe8ff", 1, { opacity: 1 });
      flare.position.copy(B);
      /* Orbit: pericentre q, gravitational parameter MU, in diagram units;
       * pericentre passage at p = 0.3 (drawing choices). */
      const Q = 0.12;
      const MU = 1.63;
      const TP = 0.3;
      const starBall = ctx.sun(0.035, { colour: "#ffe0a0", hot: "#fff6dc", halo: 3, haloColour: "#ffd27f", haloOpacity: 0.6 });
      const path = [];
      for (let i = 0; i <= 120; i += 1) {
        const nu = THREE.MathUtils.degToRad(-135 + (270 * i) / 120);
        const rr = (2 * Q) / (1 + Math.cos(nu));
        path.push(new THREE.Vector3(B.x + rr * Math.cos(nu), B.y + rr * Math.sin(nu), -0.01));
      }
      const pathLine = ctx.line(path, { colour: "#7f93a8", opacity: 0.35, dashed: true, dash: 0.025, gap: 0.02 });
      /* The debris: eccentricities spread either side of 1, half bound, half not. */
      const D = 1600;
      const debris = ctx.cloud(D, { size: 3 });
      const rd = rng(83);
      const deb = Array.from({ length: D }, (_, i) => {
        const bound = i % 2 === 0;
        const e = bound ? 0.1 + 0.85 * rd() : 1.05 + 0.85 * rd();
        const P = bound ? TAU * Math.sqrt((Q / (1 - e)) ** 3 / MU) : Infinity;
        debris.tint(i, bound ? "#ffc89a" : "#ffe6c0");
        return { e, P, dt: (e - 1) * 0.02, w: (rd() - 0.5) * 0.02, disc: 0.06 + 0.12 * rd(), a0: rd() * TAU };
      });
      const hot = new THREE.Color("#cfe0ff");

      const labStar = ctx.label(["Star"], { height: 0.026 });
      const labBH = ctx.label(["Black hole", "millions of Suns"], { at: [B.x, B.y - 0.16, 0], height: 0.026 });
      const labStream = ctx.label(["Stretched into a stream"], { at: [B.x - 0.08, B.y + 0.3, 0], height: 0.026 });
      const labAway = ctx.label(["About half flung away"], { at: [-0.62, 0.62, 0], height: 0.026 });
      const labIn = ctx.label(["The rest falls back:", "a flare that lasts months"], { at: [B.x + 0.05, B.y - 0.3, 0], height: 0.026 });

      /* Brightness after disruption: a fast rise, then a fall as t^-5/3
       * (Rees 1988; Phinney 1989). Shape only. */
      const lum = (month) => (month < 1 ? smooth(month, 0, 1) : Math.pow(month, -5 / 3));
      const lc = chart(ctx, {
        x: 0.45, y: 0.45, w: 0.5, h: 0.28,
        title: "Brightness, first year (shape)",
        ticks: [[0, "0"], [0.5, "6 months"], [1, "1 yr"]],
        colour: "#cfe0ff",
        fn: (u) => lum(u * 12) * 0.95,
      });

      ctx.tell([
        { at: 0, label: "Too close", text: "A star on a long, looping orbit falls toward the giant black hole at the heart of its galaxy." },
        { at: 0.22, label: "Spaghettified", text: "Gravity pulls much harder on the star's near side than its far side. It is stretched into a long stream." },
        { at: 0.45, label: "Half flung away", text: "About half the gas escapes the black hole for good; the rest is bound, and swings back." },
        { at: 0.62, label: "Months of light", text: "The returning gas piles into a hot, swirling disc that blazes for months. ASASSN-14li, in 2014, was one." },
      ]);

      return {
        duration: 22,
        update(p) {
          const T = p - TP;
          bh.holder.rotation.z = 0;
          /* The star, on its parabola until it is torn. */
          const [rs, nus] = conic(Q, 1, MU, Math.min(T, 0));
          const sx = B.x + rs * Math.cos(nus);
          const sy = B.y + rs * Math.sin(nus);
          starBall.position.set(sx, sy, 0.02);
          const stretch = 1 + 2.2 * smooth(p, 0.22, 0.3);
          starBall.scale.set(stretch, 1 / Math.sqrt(stretch), 1);
          starBall.rotation.z = nus + Math.PI / 2;
          ctx.fade(starBall, 1 - smooth(p, 0.285, 0.31));
          labStar.position.set(sx, sy + 0.09, 0);
          ctx.fade(labStar, win(p, 0.02, 0.24));
          ctx.fade(pathLine, win(p, 0.02, 0.4));

          /* The debris, each on its own conic since pericentre. */
          let returned = 0;
          for (let i = 0; i < D; i += 1) {
            const s = deb[i];
            const t = T + s.dt;
            if (T < -0.015) {
              debris.alpha[i] = 0;
              continue;
            }
            if (t >= s.P) {
              /* Back at pericentre: into the disc, circling and cooling. */
              const age = t - s.P;
              const ang = s.a0 + Math.sqrt(MU / s.disc ** 3) * age;
              debris.set(i, B.x + Math.cos(ang) * s.disc, B.y + Math.sin(ang) * s.disc * 0.45, 0.02);
              debris.alpha[i] = 0.9 * Math.exp(-age / 0.6);
              debris.tint(i, hot);
              returned += 1;
              continue;
            }
            const [rr, nu] = conic(Q, s.e, MU, t);
            const x = B.x + rr * Math.cos(nu) - Math.sin(nu) * s.w;
            const y = B.y + rr * Math.sin(nu) + Math.cos(nu) * s.w;
            debris.set(i, x, y, 0.01);
            const inside = Math.abs(x) < 1.05 && Math.abs(y) < 0.85;
            debris.alpha[i] = inside ? 0.8 * smooth(T, -0.015, 0.01) : 0;
          }
          debris.commit();
          bh.halo.material.opacity = 0.4 + 0.4 * clamp01(returned / 300);

          const month = 12 * span(p, 0.54, 0.97);
          const L = p > 0.54 ? lum(month) : 0;
          flare.scale.setScalar(0.1 + 0.9 * L);
          flare.material.opacity = 0.9 * L;
          flare.visible = L > 0.01;
          lc.show(month / 12);
          ctx.fade(lc.group, smooth(p, 0.52, 0.56));

          ctx.fade(labStream, win(p, 0.3, 0.5));
          ctx.fade(labAway, win(p, 0.46, 0.75));
          ctx.fade(labIn, smooth(p, 0.62, 0.66));
          ctx.fade(labBH, win(p, 0.02, 0.3));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 9 */
  event({
    id: "sgr-a-flares",
    section: "deep",
    title: "Flares at the Milky Way's heart",
    place: "Sagittarius A* · about 26,000 light-years",
    kind: "recurring",
    family: "galactic",
    often: "about daily",
    detail: "The black hole at the centre of our galaxy, 4 million times the Sun's mass, flickers and flares about once a day",
    frequency: "It flickers all the time in infrared; a bright X-ray flare comes about once a day, and much bigger ones now and then",
    cause: "Sagittarius A* is a black hole of about 4.3 million Suns. It is starved: only a trickle of gas reaches it. As clumps of that hot gas swirl close to the edge, tangled magnetic fields heat them, and they flare in infrared and X-rays — in 2018 the GRAVITY instrument watched hot spots circling it in under an hour.",
    note: "Its mass is known from the stars that whip round it: one, S2, passes within 120 times the Earth–Sun distance every 16 years. The Event Horizon Telescope imaged its shadow in 2022. It sits about 26,000 light-years away (8.2 kiloparsecs, GRAVITY 2019).",
    accuracy: "A diagram. The galaxy, the zoom and the black hole are not to scale. The glowing ring is drawn after the Event Horizon Telescope image; the day of flares is a sketch of a typical day, not a recorded one.",
    art: { main: "blackhole", fx: "glow" },
    scene(ctx) {
      ctx.starfield(300, { seed: 91 });
      /* layout */
      const GAL = new THREE.Vector3(-0.15, 0.05, 0);
      const outer = new THREE.Group();
      outer.position.copy(GAL);
      ctx.add(outer);
      const gal = spiralGalaxy(ctx, 4200, { radius: 0.75, arms: 4, wind: 2.2, bar: 0.25, seed: 92, size: 2.2, parent: outer });
      gal.holder.rotation.x = 1.0;
      /* The Sun: 8.2 kpc from the centre of a disc about 15 kpc in radius (drawing). */
      const sunLocal = new THREE.Vector3(0, 0, 0.75 * (8.2 / 15));
      const sunDot = ctx.glow("#ffd27f", 0.07, { opacity: 1, parent: gal.holder });
      sunDot.position.copy(sunLocal);
      const sunWorld = sunLocal.clone().applyEuler(gal.holder.rotation).add(GAL);
      const centreDot = ctx.glow("#ffffff", 0.08, { opacity: 1, parent: outer });
      void centreDot;
      const labSun = ctx.label(["Sun"], { at: [sunWorld.x + 0.1, sunWorld.y - 0.02, 0], height: 0.026 });
      const labGal = ctx.label(["Sagittarius A*", "26,000 light-years from us"], { at: [GAL.x, GAL.y + 0.17, 0], height: 0.026 });
      const sight = ctx.line([sunWorld, GAL], { colour: "#ffd27f", opacity: 0.6, dashed: true, dash: 0.02, gap: 0.02 });

      /* Close in: the shadow, the glowing flow, a hot spot. */
      const H = new THREE.Vector3(-0.25, 0.18, 0);
      const inner = new THREE.Group();
      inner.position.copy(H);
      ctx.add(inner);
      const bh = blackHole(ctx, 0.15, { parent: inner, ringColour: "#ffb066", glowColour: "#ff8a3a", glow: 4.5, ringOpacity: 0.7 });
      const flowHolder = new THREE.Group();
      flowHolder.rotation.x = 1.25;
      inner.add(flowHolder);
      const flow = discCloud(ctx, 2600, 0.2, 0.42, { parent: flowHolder, inner: "#fff0c8", outer: "#ff6a1a", seed: 93, size: 2.6 });
      const flowAlpha = Float32Array.from(flow.cloud.alpha);
      const spot = ctx.glow("#fff6e0", 0.12, { opacity: 1, parent: flowHolder });
      const labBH = ctx.label(["Sagittarius A*", "about 4 million Suns"], { at: [H.x, H.y + 0.52, 0], height: 0.03 });
      const labSpot = ctx.label(["Hot gas, circling the edge"], { at: [H.x + 0.62, H.y + 0.05, 0], height: 0.024 });
      const clock = ctx.label(["", ""], { at: [0.62, -0.22, 0], height: 0.03 });

      /* A day of flickering: a low simmer, an X-ray-scale flare once a day,
       * a few smaller infrared ones (Genzel et al. 2010; shape only). */
      const FLARES = [[3.2, 0.45, 0.35], [8.7, 0.25, 0.25], [14.4, 1, 0.45], [19.9, 0.55, 0.3]];
      const bright = (hour) => {
        let v = 0.1 + 0.04 * Math.sin(hour * 5.3) * Math.sin(hour * 2.1 + 1);
        FLARES.forEach(([c, h, w]) => { v += h * Math.exp(-(((hour - c) / w) ** 2)) * (hour > c ? 1 : 1.8); });
        return Math.min(1, v);
      };
      const lc = chart(ctx, {
        x: -0.85, y: -0.8, w: 1.7, h: 0.26,
        title: "Brightness near the black hole over one day (sketch)",
        ticks: [[0, "0 h"], [0.5, "12 h"], [1, "24 h"]],
        colour: "#ffb066",
        fn: (u) => bright(u * 24) * 0.95,
      });

      ctx.tell([
        { at: 0, label: "The galaxy's heart", text: "26,000 light-years from us, at the centre of the Milky Way." },
        { at: 0.22, label: "Sagittarius A*", text: "A black hole of about 4 million Suns, weighed by the stars that race around it." },
        { at: 0.42, label: "Mostly quiet", text: "Very little gas reaches it, so it glows faintly — far dimmer than it could." },
        { at: 0.6, label: "Flares", text: "About once a day it flares, as clumps of hot gas swirl close to its edge." },
      ]);

      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          gal.holder.rotation.y = -0.03 * ctx.t;
          const zoom = smooth(p, 0.22, 0.36);
          outer.scale.setScalar(1 + 7 * zoom);
          ctx.fade(outer, 1 - smooth(p, 0.26, 0.36));
          ctx.fade(labSun, win(p, 0.03, 0.22));
          ctx.fade(labGal, win(p, 0.03, 0.22));
          ctx.fade(sight, win(p, 0.05, 0.22));

          const zin = smooth(p, 0.28, 0.38);
          inner.scale.setScalar(0.25 + 0.75 * zin);
          ctx.fade(inner, zin);
          ctx.fade(labBH, smooth(p, 0.36, 0.4));

          const hour = 24 * span(p, 0.4, 0.97);
          const f = p > 0.4 ? bright(hour) : 0.1;
          flow.spin(ctx.t * 0.7);
          /* Doppler beaming: the side coming toward us is brighter. */
          for (let i = 0; i < flow.data.length; i += 1) {
            const s = flow.data[i];
            const a = s.a + ctx.t * 0.7 * s.w;
            flow.cloud.alpha[i] = flowAlpha[i] * (0.35 + 0.65 * f) * (0.7 + 0.5 * Math.cos(a));
          }
          flow.cloud.commit();
          const sa = ctx.t * 1.3;
          spot.position.set(Math.cos(sa) * 0.24, 0, Math.sin(sa) * 0.24);
          spot.scale.setScalar(0.06 + 0.3 * f);
          spot.material.opacity = 0.4 + 0.6 * f;
          bh.halo.material.opacity = (0.25 + 0.5 * f) * zin;
          bh.ring.material.opacity = (0.45 + 0.5 * f) * zin;
          ctx.fade(labSpot, win(p, 0.44, 0.7));
          lc.show(hour / 24);
          ctx.fade(lc.group, smooth(p, 0.38, 0.42));
          clock.userData.draw([`Hour ${Math.floor(hour)}`, f > 0.5 ? "flaring" : "quiet, flickering"]);
          ctx.fade(clock, smooth(p, 0.4, 0.44));
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 10 */
  event({
    id: "fast-radio-bursts",
    section: "deep",
    title: "Fast radio bursts",
    place: "Other galaxies — and once, our own",
    kind: "recurring",
    family: "deepSky",
    when: "First found in 2007 (in data recorded in 2001); one from SGR 1935+2154 on 28 April 2020",
    often: "about a thousand a day, over the whole sky",
    timeline: { last: "every few minutes, somewhere in the sky" },
    detail: "Flashes of radio waves lasting a thousandth of a second, from across the universe — some repeat, and at least one came from a magnetar in our own galaxy",
    frequency: "Estimated at around a thousand a day over the whole sky, though radio telescopes see only a sliver of it at once. The CHIME telescope alone has found thousands",
    cause: "Not fully known. The leading idea is magnetars — neutron stars with enormous magnetic fields — and the burst from SGR 1935+2154 in 2020 showed that at least some come from them. The burst's lower frequencies arrive later than the higher ones, slowed by the thin gas they cross, which tells how far they have come.",
    note: "The first, the 'Lorimer burst', was found in 2007 by Duncan Lorimer and his student David Narkevic in Parkes telescope data from 2001. One repeater, FRB 20121102A, flashed 1,652 times in 47 days (Li et al. 2021). In its millisecond, a burst gives out about as much energy as the Sun does in days.",
    accuracy: "A diagram: the galaxies and the distance are not to scale, and the spread between frequencies is greatly enlarged. The sweep in the chart has the real shape (delay growing as 1/frequency²).",
    art: { main: "galaxy", fx: "flash" },
    scene(ctx) {
      ctx.starfield(300, { seed: 101 });
      /* layout */
      const TOP = 0.42;
      const host = spiralGalaxy(ctx, 900, { radius: 0.15, arms: 2, wind: 2.8, seed: 102, size: 1.8 });
      host.holder.position.set(-0.82, TOP, 0);
      host.holder.rotation.set(1.0, 0, 0.3);
      const hostFlash = ctx.glow("#ffffff", 0.4, { opacity: 1 });
      hostFlash.position.set(-0.8, TOP, 0.05);
      const E = new THREE.Vector3(0.84, TOP, 0);
      ctx.light.set(-0.8, 0.4, 0.45).normalize();
      const earth = ctx.ball(0.045, { body: "Earth", rim: 0.5 });
      earth.position.copy(E);
      const pathLine = ctx.line([[-0.62, TOP, 0], [E.x - 0.07, TOP, 0]], { colour: "#7f93a8", opacity: 0.4, dashed: true, dash: 0.03, gap: 0.025 });
      const labHost = ctx.label(["A distant galaxy", "millions to billions of light-years"], { at: [-0.72, TOP + 0.2, 0], height: 0.024 });
      const labEarth = ctx.label(["Earth"], { at: [E.x, TOP - 0.1, 0], height: 0.024 });
      /* The pulse: eight frequency bands, high (blue) leading low (red). */
      const BANDS = 8;
      const pulses = Array.from({ length: BANDS }, (_, k) => {
        const c = new THREE.Color().setHSL(0.62 - (0.62 * k) / (BANDS - 1), 0.9, 0.65);
        return ctx.glow(c, 0.09, { opacity: 1 });
      });
      /* Waterfall: frequency (rows) against time; delay ∝ ν^-2. Band
       * 1.2–1.6 GHz like Parkes' (drawing choice). */
      const WX = -0.85;
      const WY = -0.8;
      const WW = 0.95;
      const WH = 0.44;
      const water = new THREE.Group();
      ctx.add(water);
      ctx.shape([[WX - 0.03, WY - 0.04], [WX + WW + 0.03, WY - 0.04], [WX + WW + 0.03, WY + WH + 0.03], [WX - 0.03, WY + WH + 0.03]], { colour: "#030812", opacity: 0.65, parent: water });
      ctx.line([[WX, WY + WH, 0], [WX, WY, 0], [WX + WW, WY, 0]], { colour: "#7f93a8", opacity: 0.6, additive: false, parent: water });
      ctx.label(["What the telescope records"], { at: [WX, WY + WH + 0.06, 0], align: "left", height: 0.022, colour: "#cfe0f2", parent: water, declutter: false });
      ctx.label(["time →"], { at: [WX + WW - 0.08, WY - 0.06, 0], height: 0.019, colour: "#9fb3c8", parent: water, declutter: false });
      ctx.label(["high"], { at: [WX - 0.035, WY + WH - 0.02, 0], align: "right", height: 0.019, colour: "#9fb3c8", parent: water, declutter: false });
      ctx.label(["low"], { at: [WX - 0.035, WY + 0.02, 0], align: "right", height: 0.019, colour: "#9fb3c8", parent: water, declutter: false });
      const ROWS = 40;
      const COLS = 60;
      const noise = ctx.cloud(ROWS * COLS, { size: 3, parent: water });
      const rw = rng(104);
      for (let i = 0; i < ROWS; i += 1) {
        for (let j = 0; j < COLS; j += 1) {
          const k = i * COLS + j;
          noise.set(k, WX + 0.01 + ((WW - 0.02) * j) / (COLS - 1), WY + 0.01 + ((WH - 0.02) * i) / (ROWS - 1), 0.01);
          noise.alpha[k] = 0.05 + 0.1 * rw();
          noise.tint(k, "#5f7fb0");
        }
      }
      noise.commit();
      const sweep = ctx.cloud(ROWS * 3, { size: 6, parent: water });
      const sweepAt = [];
      for (let i = 0; i < ROWS; i += 1) {
        const ghz = 1.2 + (0.4 * i) / (ROWS - 1);
        /* Delay relative to the top of the band, ∝ (ν^-2 − ν_top^-2). */
        const delay = (1 / (ghz * ghz) - 1 / (1.6 * 1.6)) / (1 / (1.2 * 1.2) - 1 / (1.6 * 1.6));
        for (let k = 0; k < 3; k += 1) {
          const idx = i * 3 + k;
          sweep.set(idx, WX + 0.08 + delay * (WW - 0.2) + (k - 1) * 0.008, WY + 0.01 + ((WH - 0.02) * i) / (ROWS - 1), 0.02);
          sweep.tint(idx, k === 1 ? "#ffffff" : "#ffd27f");
          sweep.alpha[idx] = 0;
        }
        sweepAt.push(1 - delay);
      }
      sweep.commit();
      const energy = ctx.label(["1 millisecond", "as much energy as the Sun gives out in days"], { at: [0.62, -0.42, 0], height: 0.026 });
      /* Repeats: ticks under the host galaxy. */
      const REPEATS = [0.55, 0.59, 0.61, 0.66, 0.7];
      const ticks = REPEATS.map((_, i) => {
        const l = ctx.line([[-0.95 + i * 0.07, TOP - 0.24, 0], [-0.95 + i * 0.07, TOP - 0.16, 0]], { colour: "#ffd27f", opacity: 0.9, additive: false });
        return l;
      });
      const labRepeat = ctx.label(["Some repeat", "FRB 20121102A: 1,652 bursts in 47 days"], { at: [-0.45, TOP - 0.36, 0], height: 0.026 });

      /* Our galaxy, face-on: the magnetar SGR 1935+2154 (distance uncertain,
       * roughly 20,000–40,000 ly; drawn at about 30,000). */
      const MW = new THREE.Vector3(-0.3, 0.1, 0);
      const mw = spiralGalaxy(ctx, 3200, { radius: 0.6, arms: 4, wind: 2.4, bar: 0.22, seed: 105, size: 2 });
      mw.holder.position.copy(MW);
      mw.holder.rotation.x = Math.PI / 2;
      const SUNP = new THREE.Vector3(MW.x, MW.y - 0.33, 0.02);
      const MAGP = new THREE.Vector3(SUNP.x + 0.31, SUNP.y + 0.2, 0.02);
      const sunDot = ctx.glow("#ffd27f", 0.07, { opacity: 1 });
      sunDot.position.copy(SUNP);
      const magDot = ctx.glow("#d8c8ff", 0.1, { opacity: 1 });
      magDot.position.copy(MAGP);
      const wave = ctx.circle(1, { plane: "xy", colour: "#ffd27f", opacity: 0.8 });
      wave.position.copy(MAGP);
      const labSun = ctx.label(["Sun"], { at: [SUNP.x - 0.09, SUNP.y - 0.03, 0], height: 0.026 });
      const labMag = ctx.label(["SGR 1935+2154", "a magnetar · 28 April 2020"], { at: [MAGP.x + 0.36, MAGP.y + 0.04, 0], height: 0.026 });

      ctx.tell([
        { at: 0, label: "A millisecond flash", text: "A burst of radio waves a thousandth of a second long, from a galaxy far beyond our own." },
        { at: 0.22, label: "The sweep", text: "Crossing thin gas between the galaxies, the low frequencies fall behind. In that millisecond: the Sun's energy for days." },
        { at: 0.52, label: "Some repeat", text: "Most flash once. A few repeat — one flashed 1,652 times in 47 days." },
        { at: 0.74, label: "Close to home", text: "On 28 April 2020 a magnetar in our own galaxy, SGR 1935+2154, fired one. At least some come from magnetars." },
      ]);

      return {
        duration: 22,
        update(p) {
          const top = 1 - smooth(p, 0.72, 0.77);
          host.holder.rotation.y = 0.05 * ctx.t;
          ctx.fade(host.holder, top);
          ctx.fade(earth, top);
          ctx.fade(pathLine, top * smooth(p, 0.04, 0.08));
          ctx.fade(labHost, win(p, 0.02, 0.4));
          ctx.fade(labEarth, top);
          earth.rotation.y = ctx.t * 0.2;
          /* The first burst leaves at p 0.06 and arrives at p 0.4. */
          const flashes = [0.06, ...REPEATS].reduce((f, c) => f + Math.exp(-(((p - c) / 0.008) ** 2)), 0);
          hostFlash.scale.setScalar(0.05 + 0.35 * flashes);
          hostFlash.material.opacity = Math.min(1, flashes) * top;
          hostFlash.visible = flashes > 0.01;
          const travel = span(p, 0.06, 0.4);
          pulses.forEach((g, k) => {
            const lag = (k / (BANDS - 1)) * 0.22 * travel;
            const x = lerp(-0.62, E.x - 0.06, clamp01(travel - lag * 0.9));
            g.position.set(x, TOP, 0.03);
            ctx.fade(g, travel > 0 && p < 0.44 + k * 0.004 ? 1 : 0);
          });
          /* The sweep, drawn as the bands arrive (p 0.36 to 0.46). */
          const rec = span(p, 0.36, 0.46);
          for (let i = 0; i < ROWS; i += 1) {
            const on = rec >= sweepAt[i] * 0.98 ? 1 : 0;
            for (let k = 0; k < 3; k += 1) sweep.alpha[i * 3 + k] = on * (k === 1 ? 1 : 0.5);
          }
          sweep.commit();
          ctx.fade(water, smooth(p, 0.3, 0.36) * (1 - smooth(p, 0.72, 0.77)));
          ctx.fade(energy, win(p, 0.4, 0.74));
          ticks.forEach((t, i) => ctx.fade(t, smooth(p, REPEATS[i] - 0.005, REPEATS[i] + 0.005) * top));
          ctx.fade(labRepeat, win(p, 0.53, 0.74));

          const mwIn = smooth(p, 0.74, 0.8);
          ctx.fade(mw.holder, mwIn * 0.9);
          mw.holder.rotation.y = -0.04 * ctx.t;
          ctx.fade(sunDot, mwIn);
          ctx.fade(magDot, mwIn);
          ctx.fade(labSun, mwIn);
          ctx.fade(labMag, smooth(p, 0.8, 0.84));
          const w = span(p, 0.82, 0.95);
          wave.scale.setScalar(Math.max(0.01, w * 0.55));
          ctx.fade(wave, w > 0 ? 1 - w : 0);
          magDot.scale.setScalar(0.1 + 0.3 * Math.exp(-(((p - 0.82) / 0.012) ** 2)));
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 11 */
  event({
    id: "proxima-superflare",
    section: "deep",
    title: "Proxima Centauri's superflare",
    place: "Proxima Centauri · 4.24 light-years",
    kind: "recorded",
    family: "stellar",
    when: "18 March 2016",
    often: "once, 2016 — and several times a year",
    timeline: { last: "18 March 2016" },
    detail: "Our nearest star, a small red dwarf, brightened about 68 times in minutes — a blast that would scorch the rocky planet orbiting close beside it",
    frequency: "Proxima flares many times a day. Superflares of this size were estimated at about five a year (Howard et al. 2018)",
    cause: "Red dwarfs like Proxima are churned by convection right through, which tangles their magnetic fields. When a tangle snaps and reconnects, it releases its energy as a flare — like the Sun's, but far bigger compared with the star's own light.",
    note: "The Evryscope array caught the flare on 18 March 2016: Proxima brightened about 68 times, to the edge of naked-eye visibility (Howard et al. 2018). Its planet Proxima b, at least 1.07 Earth masses, orbits only 0.0485 AU out, so it takes the full force; repeated flares like this could strip an Earth-like ozone layer.",
    accuracy: "A diagram. The planet's orbit is drawn about 3 times too small compared with the star (it is really about 68 star-radii out), and the planet is enlarged. The light curve is a sketch of the flare's shape and height.",
    art: { main: "star", fx: "flare" },
    scene(ctx) {
      ctx.starfield(300, { seed: 111 });
      /* layout */
      const P = new THREE.Vector3(-0.42, 0.14, 0);
      const BASE = new THREE.Color("#c8401f");
      const HOT = new THREE.Color("#ff8a50");
      const WHITE = new THREE.Color("#fff2e8");
      const star = ctx.sun(0.2, { colour: "#c8401f", hot: "#ff8a50", halo: 2.4, haloColour: "#ff4a2a", haloOpacity: 0.45, granule: 9 });
      star.position.copy(P);
      const orbit = new THREE.Group();
      orbit.position.copy(P);
      orbit.rotation.x = 0.42;
      ctx.add(orbit);
      ctx.circle(0.55, { colour: "#b08060", opacity: 0.4, parent: orbit });
      const planet = ctx.ball(0.04, { colour: "#a87a5a", rim: 0.4, rimColour: "#ffb08a", parent: orbit });
      const labPlanet = ctx.label(["Proxima b", "at least 1.07 Earths · 11.2-day orbit"], { height: 0.024 });
      /* The flare: a bright knot on the limb with a loop above it. */
      const spotDir = ctx.onSphere(1, 28, -35);
      const knot = ctx.glow("#ffffff", 1, { opacity: 1 });
      knot.position.copy(P).addScaledVector(spotDir, 0.21);
      const loopPts = [];
      for (let i = 0; i <= 40; i += 1) {
        const t = i / 40;
        const v = ctx.onSphere(1, 28 + (t - 0.5) * 22, -35 + (t - 0.5) * 10).multiplyScalar(0.2 * (1 + 0.45 * Math.sin(Math.PI * t)));
        loopPts.push(v.add(P));
      }
      const loop = ctx.line(loopPts, { colour: "#ffd8c0", opacity: 0.95 });
      const front = ctx.circle(1, { plane: "xy", colour: "#ffe0d0", opacity: 0.8 });
      front.position.copy(P);
      /* The planet's air, blown off. */
      const WIND = 260;
      const wind = ctx.cloud(WIND, { size: 3 });
      const rw = rng(113);
      const windData = Array.from({ length: WIND }, (_, i) => {
        wind.tint(i, rw() < 0.5 ? "#9fd0ff" : "#ffd0b0");
        return { u0: rw(), a: (rw() - 0.5) * 0.8, s: 0.6 + 0.6 * rw() };
      });
      const labStar = ctx.label(["Proxima Centauri", "the nearest star · 4.24 light-years"], { at: [P.x, P.y + 0.45, 0], height: 0.028 });
      const counter = ctx.label([""], { at: [0.55, -0.22, 0], height: 0.04 });

      /* Brightness: a rise in about a minute to ×68 (Howard et al. 2018),
       * then a decay over tens of minutes (shape a sketch). */
      const flux = (min) => {
        if (min < 6) return 1;
        const t = min - 6;
        return t < 1 ? 1 + 67 * smooth(t, 0, 1) : 1 + 67 * (0.75 * Math.exp(-(t - 1) / 1.6) + 0.25 * Math.exp(-(t - 1) / 7));
      };
      const lc = chart(ctx, {
        x: 0.12, y: -0.8, w: 0.82, h: 0.32,
        title: "Brightness, minute by minute (shape sketched)",
        ticks: [[0, "0"], [0.5, "15 min"], [1, "30 min"]],
        yTicks: [[1 / 70, "×1"], [68 / 70, "×68"]],
        colour: "#ffb08a",
        fn: (u) => flux(u * 30) / 70,
      });
      const tmp = new THREE.Vector3();

      ctx.tell([
        { at: 0, label: "Our nearest star", text: "Proxima Centauri, 4.24 light-years away: a red dwarf about an eighth of the Sun's mass." },
        { at: 0.22, label: "18 March 2016", text: "A superflare: in about a minute it brightened some 68 times, to the edge of naked-eye visibility." },
        { at: 0.5, label: "Scorched", text: "Its planet Proxima b orbits 20 times closer than Earth does to the Sun, and takes the full blast." },
        { at: 0.76, label: "A violent temper", text: "Flares like this strike several times a year — hard on any atmosphere a close planet might have." },
      ]);

      return {
        duration: 22,
        update(p) {
          const u = span(p, 0.22, 0.62);
          const min = u * 30;
          const f = p >= 0.22 ? flux(min) : 1;
          const k = clamp01((f - 1) / 67);
          star.material.uniforms.uColor.value.copy(BASE).lerp(WHITE, 0.5 * k);
          star.material.uniforms.uHot.value.copy(HOT).lerp(WHITE, 0.8 * k);
          star.userData.halo.material.opacity = 0.45 + 0.5 * k;
          star.userData.halo.scale.setScalar(2.4 * 0.2 * (1 + 1.5 * k));
          star.rotation.y = ctx.t * 0.1;
          knot.scale.setScalar(0.05 + 0.7 * k);
          knot.material.opacity = Math.min(1, 0.2 + k * 1.2) * smooth(p, 0.27, 0.3);
          ctx.fade(loop, smooth(p, 0.27, 0.3) * (0.3 + 0.7 * Math.sqrt(k)));
          const fr = span(p, 0.3, 0.48);
          front.scale.setScalar(Math.max(0.01, 0.21 + fr * 0.8));
          ctx.fade(front, fr > 0 && fr < 1 ? 1 - fr : 0);

          /* The planet: slow and pure in p, near the front during the flare. */
          const ang = 0.4 + p * 1.6;
          planet.position.set(Math.cos(ang) * 0.55, 0, Math.sin(ang) * 0.55);
          tmp.copy(planet.position).applyEuler(orbit.rotation).add(P);
          ctx.light.set(P.x - tmp.x, P.y - tmp.y, 0.3).normalize();
          labPlanet.position.set(tmp.x, tmp.y - 0.1, 0);
          ctx.fade(labPlanet, smooth(p, 0.04, 0.1));
          const scorch = smooth(p, 0.36, 0.4) * (1 - 0.7 * smooth(p, 0.6, 0.9));
          planet.material.uniforms.uEmissive.value.setRGB(0.45 * scorch, 0.18 * scorch, 0.08 * scorch);
          planet.rotation.y = ctx.t * 0.3;
          const away = tmp.clone().sub(P).normalize();
          for (let i = 0; i < WIND; i += 1) {
            const s = windData[i];
            const w = (s.u0 + ctx.t * 0.35 * s.s) % 1;
            const side = new THREE.Vector3(-away.y, away.x, 0).multiplyScalar(s.a * w * 0.12);
            wind.set(i, tmp.x + away.x * (0.05 + w * 0.3) + side.x, tmp.y + away.y * (0.05 + w * 0.3) + side.y, tmp.z + 0.02);
            wind.alpha[i] = 0.7 * (1 - w) * scorch;
          }
          wind.commit();

          lc.show(u);
          ctx.fade(lc.group, smooth(p, 0.18, 0.22));
          counter.userData.draw([`Brightness ×${Math.round(f)}`]);
          ctx.fade(counter, smooth(p, 0.2, 0.24));
          ctx.fade(labStar, smooth(p, 0.02, 0.06));
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 12 */
  event({
    id: "milky-way-andromeda",
    section: "deep",
    title: "Milky Way meets Andromeda",
    place: "The Local Group",
    kind: "transient",
    family: "galactic",
    when: "Billions of years from now — perhaps",
    often: "in billions of years, perhaps",
    timeline: { next: "about 50% chance within 10 billion years" },
    detail: "Andromeda is heading our way at about 110 km/s. A collision was long thought certain — now it looks like a coin toss",
    frequency: "Once, if at all. Big galaxies merging is common in the history of the universe; the Milky Way has swallowed many smaller ones already",
    cause: "Andromeda, 2.5 million light-years away, is falling toward us under the two galaxies' mutual gravity. Whether they merge depends on its sideways motion, which is very hard to measure, and on the pull of their neighbours, Triangulum (M33) and the Large Magellanic Cloud.",
    note: "The classic forecast (van der Marel et al. 2012, from Hubble measurements) was a head-on collision in about 4.5 billion years. Sawala et al. (2025, Nature Astronomy), with Gaia and Hubble data and the neighbours included, found about a 50% chance of a merger within 10 billion years: M33 makes it likelier, the LMC less likely.",
    accuracy: "A diagram. The galaxies are drawn about ten times too big for the distance between them, and the merger is a simple simulation of test stars around two point masses — a picture of the classic forecast, not of any study's results.",
    art: { main: "galaxy", second: "galaxy", fx: "spiral" },
    scene(ctx) {
      ctx.starfield(320, { seed: 121 });
      const sim = mergerSim();
      const { snaps, centres, frames, N, n } = sim;
      /* layout */
      const G = new THREE.Group();
      G.position.set(0, 0.06, 0);
      G.rotation.x = 0.5;
      ctx.add(G);
      const stars = ctx.cloud(N, { size: 2.2, parent: G });
      const r = rng(122);
      for (let i = 0; i < N; i += 1) {
        const mw = i < n;
        const k = r();
        stars.tint(i, k < 0.05 ? "#ff9fc4" : mw ? (k < 0.5 ? "#fff0d8" : "#b8ccff") : (k < 0.5 ? "#ffe2c0" : "#a8c0ff"));
        stars.alpha[i] = 0.35 + 0.5 * r();
        stars.size[i] = 1.6 + 1.6 * r();
      }
      /* Bulges ride with each galaxy's centre. */
      const BULGE = 300;
      const bulge = ctx.cloud(BULGE * 2, { size: 3, parent: G });
      const bulgeOff = directions(BULGE * 2, 123).map((d) => d.multiplyScalar(0.05 * Math.pow(r(), 1.2)));
      for (let i = 0; i < BULGE * 2; i += 1) {
        bulge.tint(i, i < BULGE ? "#ffe6c0" : "#ffdcb0");
        bulge.alpha[i] = 0.5 + 0.4 * r();
        bulge.size[i] = 2 + 2 * r();
      }
      const coreA = ctx.glow("#ffe6c0", 0.22, { opacity: 0.6, parent: G });
      const coreB = ctx.glow("#ffdcb0", 0.24, { opacity: 0.6, parent: G });
      const labMW = ctx.label(["Milky Way"], { height: 0.028 });
      const labM31 = ctx.label(["Andromeda", "2.5 million light-years · closing at 110 km/s"], { height: 0.026 });
      const clock = ctx.label(["", ""], { at: [0, 0.66, 0], height: 0.034 });
      /* Frames of the simulation against progress; first close pass at
       * frame ~36 (drawing choice: shown as the classic 4.5 billion years). */
      const FIRST = 36;
      const frameAt = (p) => keyed([[0, 0], [0.22, 6], [0.38, FIRST], [0.57, frames - 1]], p);

      /* The 2025 odds. */
      const odds = new THREE.Group();
      ctx.add(odds);
      const BX = -0.7;
      const BW = 1.4;
      const BY = -0.6;
      ctx.shape([[BX - 0.04, BY - 0.16], [BX + BW + 0.04, BY - 0.16], [BX + BW + 0.04, BY + 0.14], [BX - 0.04, BY + 0.14]], { colour: "#030812", opacity: 0.7, parent: odds });
      const fill = ctx.shape([[0, -0.03], [1, -0.03], [1, 0.03], [0, 0.03]], { colour: "#ffb066", opacity: 0.9, parent: odds });
      fill.position.set(BX, BY, 0.01);
      const rest = ctx.shape([[0, -0.03], [1, -0.03], [1, 0.03], [0, 0.03]], { colour: "#5f6f88", opacity: 0.7, parent: odds });
      rest.position.set(BX + BW / 2, BY, 0.01);
      rest.scale.x = BW / 2;
      ctx.label(["Chance of a merger within 10 billion years (Sawala et al. 2025)"], { at: [BX, BY + 0.08, 0], align: "left", height: 0.022, parent: odds, declutter: false });
      ctx.label(["merge: about 50%"], { at: [BX + BW / 4, BY - 0.09, 0], height: 0.024, colour: "#ffd2a0", parent: odds, declutter: false });
      ctx.label(["no merger yet: about 50%"], { at: [BX + (3 * BW) / 4, BY - 0.09, 0], height: 0.024, colour: "#b8c4d8", parent: odds, declutter: false });

      /* Stars passing through each other, close up. */
      const close = new THREE.Group();
      close.position.set(0.0, 0.08, 0.1);
      ctx.add(close);
      ctx.disc(0.36, { colour: "#02050c", opacity: 0.88, parent: close });
      ctx.circle(0.36, { plane: "xy", colour: "#9fb3c8", opacity: 0.6, parent: close });
      const PASS = 60;
      const passers = ctx.cloud(PASS, { size: 5, parent: close });
      const rp = rng(124);
      const passData = Array.from({ length: PASS }, (_, i) => {
        passers.tint(i, i % 2 ? "#b8ccff" : "#ffe2c0");
        return { y: (rp() - 0.5) * 0.6, x0: (rp() - 0.5) * 0.7, dir: i % 2 ? 1 : -1, z: (rp() - 0.5) * 0.1 };
      });
      const labClose = ctx.label(["Stars almost never touch", "the Sun's nearest neighbour is 30 million Sun-widths away"], { at: [0, -0.4, 0.1], height: 0.026 });
      const tmpA = new THREE.Vector3();
      const tmpB = new THREE.Vector3();

      ctx.tell([
        { at: 0, label: "On its way", text: "The Andromeda galaxy, 2.5 million light-years away, is approaching at about 110 km/s." },
        { at: 0.22, label: "The classic forecast", text: "For years the forecast was a head-on collision in about 4.5 billion years, and one merged galaxy." },
        { at: 0.58, label: "A coin toss", text: "A 2025 study, with newer data and the neighbouring galaxies included, put the chance of a merger within 10 billion years at about one half." },
        { at: 0.8, label: "Stars won't touch", text: "Even if they merge, stars are so far apart that almost none would ever collide." },
      ]);

      return {
        duration: 22,
        update(p) {
          const fr = frameAt(p);
          const f0 = Math.min(frames - 2, Math.floor(fr));
          const t = fr - f0;
          const a = f0 * N * 3;
          const b = (f0 + 1) * N * 3;
          for (let i = 0; i < N * 3; i += 1) stars.position[i] = snaps[a + i] + (snaps[b + i] - snaps[a + i]) * t;
          stars.commit();
          const c0 = f0 * 6;
          const c1 = (f0 + 1) * 6;
          tmpA.set(lerp(centres[c0], centres[c1], t), lerp(centres[c0 + 1], centres[c1 + 1], t), lerp(centres[c0 + 2], centres[c1 + 2], t));
          tmpB.set(lerp(centres[c0 + 3], centres[c1 + 3], t), lerp(centres[c0 + 4], centres[c1 + 4], t), lerp(centres[c0 + 5], centres[c1 + 5], t));
          for (let i = 0; i < BULGE * 2; i += 1) {
            const c = i < BULGE ? tmpA : tmpB;
            const o = bulgeOff[i];
            bulge.set(i, c.x + o.x, c.y + o.y, c.z + o.z);
          }
          bulge.commit();
          coreA.position.copy(tmpA);
          coreB.position.copy(tmpB);

          /* Labels sit above each galaxy, in hud space. */
          const la = tmpA.clone().applyEuler(G.rotation).add(G.position);
          const lb = tmpB.clone().applyEuler(G.rotation).add(G.position);
          labMW.position.set(la.x, la.y + 0.36, 0);
          labM31.position.set(lb.x, lb.y + 0.38, 0);
          ctx.fade(labMW, win(p, 0.02, 0.26));
          ctx.fade(labM31, win(p, 0.02, 0.24));

          const gyr = 4.5 * Math.min(fr, FIRST) / FIRST;
          clock.userData.draw(p < 0.22 ? ["Today", "the classic forecast, run forward"]
            : fr < FIRST - 0.5 ? [`+${gyr.toFixed(1)} billion years`, "the classic forecast"]
              : fr < 80 ? ["+4.5 billion years", "first collision (classic forecast)"]
                : ["Billions of years later", "one merged galaxy"]);
          ctx.fade(clock, smooth(p, 0.03, 0.07) * (1 - smooth(p, 0.56, 0.6)));

          const dim = 1 - 0.55 * smooth(p, 0.57, 0.62) - 0.25 * smooth(p, 0.8, 0.84);
          ctx.fade(stars.points, dim);
          ctx.fade(bulge.points, dim);
          ctx.fade(coreA, dim);
          ctx.fade(coreB, dim);
          G.rotation.y = 0.04 * Math.sin(ctx.t * 0.2);

          ctx.fade(odds, win(p, 0.6, 0.82));
          const grow = smooth(p, 0.62, 0.7);
          fill.scale.x = Math.max(0.001, (BW / 2) * grow);

          const cl = smooth(p, 0.82, 0.87);
          ctx.fade(close, cl);
          ctx.fade(labClose, smooth(p, 0.84, 0.88));
          const pt = span(p, 0.82, 1);
          for (let i = 0; i < PASS; i += 1) {
            const s = passData[i];
            let x = s.x0 + s.dir * (pt - 0.5) * 0.5;
            x = ((x + 0.35) % 0.7 + 0.7) % 0.7 - 0.35;
            passers.set(i, x, s.y, s.z + 0.02);
            passers.alpha[i] = Math.hypot(x, s.y) < 0.34 ? 1 : 0;
          }
          passers.commit();
        },
      };
    },
  }),
];

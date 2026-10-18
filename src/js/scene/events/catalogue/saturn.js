import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut, planetMap } from "./kit.js";
import { bodyRadius, yawFor, cutter } from "./real.js";
import { toHud, worldRadius, pitchFor, holdShot, distanceFor, hudKit, diorama, pin, ringOn, shotDirection, dirAt, turnToward } from "./bodyKit.js";

const DEG = Math.PI / 180;

/**
 * Section 7 of the catalogue: Saturn and its moons (round 79).
 *
 * Eight events: the polar hexagon, the rings seen edge-on, ring rain,
 * propellers, the F ring's shepherds, Titan's methane weather, Hyperion's
 * chaotic spin and Iapetus's two faces. Round 84 (Prompts.md): all now play
 * on the real Saturn, its rings and moons, with three round-79 dioramas
 * kept where a close-up explains better. The round-79 file is in
 * docs/archive/giants-dioramas-round79/saturn.js.
 *
 * Sizes, distances and periods are NASA's planetary and satellite fact
 * sheets (nssdc.gsfc.nasa.gov/planetary/factsheet, ssd.jpl.nasa.gov
 * /sats/elem) unless a comment says otherwise.
 */

/* Saturn's equatorial radius, km (NASA fact sheet). */
const SATURN_R_KM = 60268;
/* The bundled ring map (saturn-ring-2k.png) runs from the C ring's inner
 * edge, 74,658 km, out past the A ring to about 140,000 km (ring radii as
 * in planets/saturn/saturnRings.js). */
const RING_IN = 74658 / SATURN_R_KM;
const RING_OUT = 140000 / SATURN_R_KM;
const D2R = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

/** A point on a sphere at latitude/longitude in degrees (+z at lon 0, y north). */
function sph(r, latDeg, lonDeg) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  return new THREE.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
}

/** Saturn with its ring map, in a group whose rotation sets the tilt. */
function saturn(ctx, R, { parent, ringOpacity = 0.95 } = {}) {
  const group = new THREE.Group();
  (parent ?? ctx.root).add(group);
  const ball = ctx.ball(R, { body: "Saturn", parent: group, rim: 0.2, rimColour: "#ffe6b0" });
  const rings = ctx.ring(R * RING_IN, R * RING_OUT, { map: planetMap("Saturn ring"), colour: "#ffffff", opacity: ringOpacity, parent: group, segments: 192 });
  return { group, ball, rings };
}

/** A dipole field line r = L sin²θ (L in body radii) in the meridian at azimuth az; y is the axis. */
function dipoleLine(radius, L, az, n = 80) {
  const theta0 = Math.asin(Math.sqrt(1 / L));
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const th = lerp(theta0, Math.PI - theta0, i / n);
    const r = L * radius * Math.sin(th) ** 2;
    points.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), -r * Math.sin(th) * Math.sin(az)));
  }
  return points;
}
function along(points, s) {
  const f = clamp01(s) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  return points[i].clone().lerp(points[i + 1], f - i);
}

/** A triangle-fan patch on a sphere: an irregular blob around (lat, lon). */
function spherePatch(ctx, r, latDeg, lonDeg, radiusDeg, { colour, opacity = 1, parent, seed = 1, squash = 1 }) {
  const rr = rng(seed);
  const k = [rr(), rr(), rr()];
  const centre = sph(r, latDeg, lonDeg);
  const positions = [centre.x, centre.y, centre.z];
  const n = 48;
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * TAU;
    const wob = 1 + 0.25 * Math.sin(3 * a + k[0] * 6) + 0.15 * Math.sin(5 * a + k[1] * 6) + 0.1 * Math.sin(8 * a + k[2] * 6);
    const lat = latDeg + Math.sin(a) * radiusDeg * wob * squash;
    const lon = lonDeg + (Math.cos(a) * radiusDeg * wob) / Math.max(0.2, Math.cos(lat * D2R));
    const v = sph(r, lat, lon);
    positions.push(v.x, v.y, v.z);
  }
  const index = [];
  for (let i = 1; i <= n; i += 1) index.push(0, i, i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, fog: false }));
  mesh.raycast = () => {};
  mesh.renderOrder = 21;
  mesh.userData.baseOpacity = opacity;
  parent.add(mesh);
  return mesh;
}

/** A hexagon of circumradius d (km) round the north pole of a sphere of radius r (drawn) / bodyKm. */
function polarHexagon(r, bodyKm, dKm, turn = 0, per = 24) {
  const d = (dKm / bodyKm) * r;
  const points = [];
  for (let side = 0; side < 6; side += 1) {
    const a0 = turn + (side / 6) * TAU;
    const a1 = turn + ((side + 1) / 6) * TAU;
    for (let j = 0; j < per; j += 1) {
      const u = j / per;
      const x = lerp(d * Math.cos(a0), d * Math.cos(a1), u);
      const z = lerp(d * Math.sin(a0), d * Math.sin(a1), u);
      points.push(new THREE.Vector3(x, Math.sqrt(Math.max(0, r * r - x * x - z * z)), z));
    }
  }
  points.push(points[0].clone());
  return points;
}

/** A flat hexagon (hud plane) of circumradius c, centred at (cx, cy). */
function flatHexagon(cx, cy, c, turn = 0, per = 20) {
  const points = [];
  for (let side = 0; side < 6; side += 1) {
    const a0 = turn + (side / 6) * TAU;
    const a1 = turn + ((side + 1) / 6) * TAU;
    for (let j = 0; j < per; j += 1) {
      const u = j / per;
      points.push(new THREE.Vector3(cx + lerp(c * Math.cos(a0), c * Math.cos(a1), u), cy + lerp(c * Math.sin(a0), c * Math.sin(a1), u), 0.01));
    }
  }
  points.push(points[0].clone());
  return points;
}

/* Round 84: three round-79 dioramas kept as functions, shown on black after
 * the real-body part (bodyKit.js diorama()). */
function propellerDiorama(ctx) {
  ctx.light.set(-0.3, 0.4, 0.86).normalize();
  /* layout */
  const X0 = -1.02;
  const X1 = 1.02;
  const Y0 = -0.66;
  const Y1 = 0.42;
  const cy = (Y0 + Y1) / 2;
  ctx.shape([[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]], { colour: "#0c0a07", opacity: 0.92 });
  const N = 12000;
  const ring = ctx.cloud(N, { additive: false, size: 2.6 });
  const pr = rng(73);
  const data = Array.from({ length: N }, () => ({ x: lerp(X0, X1, pr()), y: lerp(Y0 + 0.01, Y1 - 0.01, pr()), k: pr(), s: 1.8 + pr() * 2.2 }));
  data.forEach((d, i) => { ring.tint(i, d.k > 0.7 ? "#efe6d2" : d.k > 0.3 ? "#cbbfa6" : "#a39780"); ring.size[i] = d.s; });
  const moonlet = ctx.rock(0.018, { seed: 9, colour: "#d8cfbf", lumps: 0.3, stretch: [1.3, 1, 0.9] });
  moonlet.position.set(0, cy, 0.02);
  const halo = ctx.glow("#fff3d6", 0.12, { opacity: 0 });
  halo.position.set(0, cy, 0.03);
  /* Context: Saturn small, upper left, with the A ring marked. */
  const mini = saturn(ctx, 0.07);
  mini.group.position.set(-0.86, 0.66, 0);
  mini.group.rotation.x = 0.4;
  const mark = ctx.glow("#ffd27f", 0.06, { opacity: 0.9 });
  mark.position.set(-0.86 + 0.07 * 2.05, 0.66 - 0.022, 0.05);
  ctx.label(["The A ring, close up"], { at: [-0.62, 0.66, 0], height: 0.024, align: "left" });
  const aIn = ctx.arrow([-0.92, cy - 0.22, 0.03], [-0.68, cy - 0.22, 0.03], { colour: "#9fd0ff", head: 0.04 });
  const aOut = ctx.arrow([-0.68, cy + 0.22, 0.03], [-0.92, cy + 0.22, 0.03], { colour: "#9fd0ff", head: 0.04 });
  const lIn = ctx.label(["inside: overtakes"], { at: [-0.64, cy - 0.22, 0.03], height: 0.02, align: "left", colour: "#bfe0ff" });
  const lOut = ctx.label(["outside: falls behind"], { at: [-0.64, cy + 0.22, 0.03], height: 0.02, align: "left", colour: "#bfe0ff" });
  const lMoon = ctx.label(["A moonlet", "about 100 m – 1 km"], { at: [0.0, cy + 0.08, 0.03], height: 0.022 });
  const lProp = ctx.label(["Propeller", "a few km long"], { at: [0.6, cy + 0.3, 0.03], height: 0.024, colour: "#ffe6b0" });
  ctx.label(["Saturn ↓"], { at: [0.9, Y0 - 0.05, 0], height: 0.02, colour: "#9fb3c8" });

  ctx.tell([
    { at: 0, label: "Inside the ring", text: "Close up, Saturn's A ring is a crowd of ice pieces, each on its own orbit." },
    { at: 0.2, label: "A hidden moonlet", text: "Here and there sits a moonlet a few hundred metres across — far too small to see." },
    { at: 0.38, label: "The propeller", text: "As ring particles stream past, its gravity nudges them aside, carving two gaps shaped like a propeller." },
    { at: 0.75, label: "Found by Cassini", text: "Cassini found many, in belts in the A ring. The biggest were nicknamed after aviators — Blériot, Earhart, Santos-Dumont." },
  ]);

  const W = X1 - X0;
  return {
    duration: 20,
    update(p) {
      const amp = smooth(p, 0.36, 0.56);
      const T = p * 1.4;
      for (let i = 0; i < N; i += 1) {
        const d = data[i];
        const y = d.y - cy; /* + is outward */
        /* Keplerian shear in the moonlet's frame: v ∝ −y. */
        let x = d.x - 0.9 * y * T;
        x = X0 + ((((x - X0) % W) + W) % W);
        let yy = y;
        let a = 0.95;
        /* Gap: on the downstream side, |y| in a band near the moonlet's
         * orbit, closing up with distance (drawing model). */
        const down = y > 0 ? -x : x;
        const ay = Math.abs(y);
        if (down > 0 && amp > 0) {
          const decay = Math.exp(-down / 0.42) * smooth(down, 0.0, 0.06);
          const inner = 0.016;
          const outerY = inner + 0.13 * decay + 0.012;
          if (ay > inner && ay < outerY && d.k < amp * (0.15 + 0.85 * decay)) {
            /* Pushed to the edge of the gap: a bright wake. */
            yy = Math.sign(y) * (outerY + (d.k * 0.02));
            a = 0.95;
          }
        }
        ring.set(i, x, cy + yy, 0.0);
        ring.alpha[i] = a * 0.8;
      }
      ring.commit();
      const moonOn = smooth(p, 0.18, 0.26);
      ctx.fade(moonlet, moonOn);
      moonlet.rotation.z = ctx.t * 0.4;
      halo.material.opacity = 0.6 * moonOn;
      ctx.fade(lMoon, moonOn);
      ctx.fade(lProp, smooth(p, 0.5, 0.56));
      [aIn, aOut, lIn, lOut].forEach((o) => ctx.fade(o, smooth(p, 0.04, 0.1)));
    },
  };
}

function shepherdDiorama(ctx) {
  ctx.light.set(-0.4, 0.5, 0.77).normalize();
  /* layout: x along the orbit (1 unit ≈ 10,000 km), y outward
   * (1 unit ≈ 4,000 km). */
  const KX = 1 / 10000;
  const KY = 1 / 4000;
  const ringY = 0.02;
  /* Orbits relative to the F ring (JPL): Prometheus a = 139,380 km,
   * e = 0.0022 (±307 km); Pandora a = 141,720 km, e = 0.0042 (±595 km);
   * F ring 140,220 km. */
  const P_DY = (139380 - 140220) * KY;
  const P_EPI = 307 * KY;
  const Q_DY = (141720 - 140220) * KY;
  const Q_EPI = 595 * KY;
  /* Prometheus moves 3.27° per orbit relative to the ring: 8,000 km. */
  const STEP = 140220 * 3.27 * D2R * KX;
  const N = 3600;
  const ring = ctx.cloud(N, { size: 2.4 });
  const fr = rng(74);
  const STRANDS = [-0.035, -0.012, 0, 0.014, 0.034];
  const data = Array.from({ length: N }, () => {
    const strand = Math.floor(fr() * STRANDS.length);
    return { x: lerp(-1.05, 1.05, fr()), strand, j: (fr() - 0.5) * (strand === 2 ? 0.01 : 0.022), k: fr() };
  });
  data.forEach((d, i) => ring.tint(i, d.strand === 2 ? "#fff4e0" : d.k > 0.5 ? "#e4d6bc" : "#bfae90"));
  /* Prometheus 136 × 79 × 59 km, Pandora 104 × 81 × 64 km (NASA),
   * drawn about 9× larger (4 × 2.2). */
  const prom = ctx.rock(136 / 2 * KX * 4, { seed: 31, colour: "#c9bca8", stretch: [1, 0.58, 0.43], lumps: 0.25 });
  const pand = ctx.rock(104 / 2 * KX * 4, { seed: 32, colour: "#c2b6a2", stretch: [1, 0.78, 0.62], lumps: 0.25 });
  [prom, pand].forEach((m) => { m.scale.setScalar(2.2); });
  const pTrack = ctx.line([[-1.05, ringY + P_DY, 0], [1.05, ringY + P_DY, 0]], { colour: "#9fd0ff", opacity: 0.25, dashed: true, dash: 0.02, gap: 0.02 });
  const qTrack = ctx.line([[-1.05, ringY + Q_DY, 0], [1.05, ringY + Q_DY, 0]], { colour: "#ffb08a", opacity: 0.25, dashed: true, dash: 0.02, gap: 0.02 });
  void pTrack; void qTrack;
  const lP = ctx.label(["Prometheus", "inside, faster"], { height: 0.024, colour: "#bfe0ff" });
  const lQ = ctx.label(["Pandora", "outside, slower"], { height: 0.024, colour: "#ffc8a8" });
  const lF = ctx.label(["F ring"], { at: [-0.88, ringY + 0.08, 0], height: 0.026 });
  const lS = ctx.label(["streamers and channels"], { at: [0.0, ringY - 0.42, 0], height: 0.022, colour: "#e8f1ff" });
  ctx.label(["Saturn ↓"], { at: [-0.9, -0.66, 0], height: 0.02, colour: "#9fb3c8" });

  ctx.tell([
    { at: 0, label: "A narrow ring", text: "Saturn's F ring: a thin, knotted strand of ice just outside the main rings." },
    { at: 0.16, label: "Two shepherds", text: "Prometheus orbits just inside it and Pandora just outside. Their gravity herds stray particles back and keeps the ring narrow." },
    { at: 0.45, label: "Streamers", text: "Once every orbit Prometheus swings close and pulls out a streamer of ice, leaving a dark channel behind." },
    { at: 0.75, label: "Braids and knots", text: "Orbit after orbit the streamers shear out and repeat along the ring, twisting it into knots and braids." },
  ]);

  return {
    duration: 20,
    update(p) {
      /* Prometheus orbits elapsed: 0 → 2.4 over the event. */
      const n = 2.4 * span(p, 0.03, 0.97) - 0.2;
      const px = -0.95 + STEP * (n + 0.2);
      const py = ringY + P_DY + P_EPI * Math.cos(TAU * n);
      prom.position.set(px, py, 0.02);
      prom.rotation.z = TAU * n; /* tidally locked: turns once per orbit */
      const qx = lerp(0.62, 0.32, p);
      const qy = ringY + Q_DY + Q_EPI * Math.cos(TAU * n * 0.6 + 1);
      pand.position.set(qx, qy, 0.02);
      pand.rotation.z = TAU * n * 0.97;
      lP.position.set(px, py - 0.11, 0.02);
      lQ.position.set(qx, qy + 0.1, 0.02);
      /* Streamers: one per close approach (integer n ≥ 0), sheared
       * with time since; deepest when fresh. */
      const pull = smooth(p, 0.4, 0.5);
      for (let i = 0; i < N; i += 1) {
        const d = data[i];
        const base = STRANDS[d.strand] + d.j;
        let y = base + 0.012 * Math.sin(d.x * 7 + d.strand * 1.7) * (d.strand === 2 ? 0.5 : 1);
        for (let k = 0; k <= Math.floor(n); k += 1) {
          const age = n - k;
          const xk = -0.95 + STEP * (k + 0.2);
          const dx = d.x - xk + 0.9 * base * age * 4 - age * 0.05;
          const g = Math.exp(-((dx / 0.045) ** 2));
          y -= pull * 0.24 * g * Math.exp(-age / 2.4) * (1 + base * 6);
        }
        /* Approach in progress: drawn toward Prometheus. */
        const near = Math.exp(-(((d.x - px) / 0.06) ** 2)) * Math.max(0, Math.cos(TAU * n)) ** 3;
        y -= pull * 0.16 * near;
        ring.set(i, d.x, ringY + y, 0);
        ring.alpha[i] = 0.85;
      }
      ring.commit();
      ctx.fade(lF, smooth(p, 0.0, 0.05));
      ctx.fade(lS, smooth(p, 0.5, 0.56));
      [prom, pand, lP, lQ].forEach((o) => ctx.fade(o, smooth(p, 0.14, 0.2)));
    },
  };
}

function hyperionDiorama(ctx) {
  ctx.light.set(-0.45, 0.4, 0.8).normalize();
  /* The spin-orbit model, n = 1: θ'' = −(ω0²/2)(a/r)³ sin 2(θ − f),
   * with ω0² = 3(B − A)/C = 0.89 and e = 0.1 (Wisdom, Peale & Mignard
   * 1984). Two twins start 0.01 rad (≈ 0.6°) apart. */
  const E = 0.1;
  const W2 = 0.89;
  const ORBITS = 9;
  const kep = (M) => {
    let Ea = M;
    for (let i = 0; i < 10; i += 1) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea));
    return { f: 2 * Math.atan2(Math.sqrt(1 + E) * Math.sin(Ea / 2), Math.sqrt(1 - E) * Math.cos(Ea / 2)), ar: 1 / (1 - E * Math.cos(Ea)) };
  };
  const acc = (t, th) => { const { f, ar } = kep(t); return -(W2 / 2) * ar ** 3 * Math.sin(2 * (th - f)); };
  const integrate = (th0, w0) => {
    const dt = 0.005;
    const T = ORBITS * TAU;
    const out = [];
    let th = th0;
    let w = w0;
    let t = 0;
    let k = 0;
    while (t <= T + dt) {
      if (k % 10 === 0) out.push([th, w]);
      const a1 = acc(t, th);
      const a2 = acc(t + dt / 2, th + (dt / 2) * w);
      const a3 = acc(t + dt / 2, th + (dt / 2) * (w + (dt / 2) * a1));
      const a4 = acc(t + dt, th + dt * (w + (dt / 2) * a2));
      th += (dt / 6) * (w + 2 * (w + (dt / 2) * a1) + 2 * (w + (dt / 2) * a2) + (w + dt * a3));
      w += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
      t += dt;
      k += 1;
    }
    return { out, step: dt * 10 };
  };
  const A = integrate(0, 1.0);
  const B = integrate(0.01, 1.0);
  const sample = (run, t) => {
    const f = Math.min(run.out.length - 1.001, t / run.step);
    const i = Math.floor(f);
    const u = f - i;
    return [lerp(run.out[i][0], run.out[i + 1][0], u), lerp(run.out[i][1], run.out[i + 1][1], u)];
  };

  /* Hyperion 360 × 266 × 205 km (Thomas 2007): stretch 1.35 : 1 : 0.77. */
  const makeHyperion = (seed) => {
    const holder = new THREE.Group();
    ctx.add(holder);
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.5;
    holder.add(tilt);
    const body = ctx.rock(0.2, { seed, colour: "#b5a68e", stretch: [1.35, 1, 0.77], lumps: 0.28, detail: 5, parent: tilt });
    /* Pits: dark spots on the surface, turning with it. */
    const pos = body.geometry.attributes.position;
    const P = 520;
    const pits = ctx.cloud(P, { additive: false, parent: body, size: 5 });
    const pr = rng(seed + 1);
    for (let i = 0; i < P; i += 1) {
      const j = Math.floor(pr() * pos.count);
      pits.set(i, pos.getX(j) * 1.012, pos.getY(j) * 1.012, pos.getZ(j) * 1.012);
      pits.tint(i, pr() > 0.5 ? "#2a2218" : "#4a3c2c");
      pits.size[i] = 3 + pr() * 7;
      pits.alpha[i] = 0.75;
    }
    pits.commit();
    return { holder, body };
  };
  const hA = makeHyperion(76);
  const hB = makeHyperion(76);
  const lA = ctx.label(["Hyperion", "about 360 × 266 × 205 km"], { height: 0.026 });
  const lB = ctx.label(["Its twin", "started 0.6° differently"], { height: 0.024, colour: "#ffc8a8" });
  const lSponge = ctx.label(["Density 0.54 g/cm³", "perhaps 40% empty space"], { at: [0.62, -0.1, 0], height: 0.024 });

  /* Orbit diagram (not to scale): Saturn, Titan's orbit, Hyperion's
   * stretched orbit; Titan makes 4 laps while Hyperion makes 3. */
  const oc = new THREE.Vector3(0.66, 0.42, 0);
  const orbitGroup = new THREE.Group();
  ctx.add(orbitGroup);
  const sat = ctx.ball(0.03, { body: "Saturn", parent: orbitGroup });
  sat.position.copy(oc);
  const tOrbit = ctx.circle(0.15, { plane: "xy", colour: "#d9a556", opacity: 0.5, parent: orbitGroup });
  tOrbit.position.copy(oc);
  /* Hyperion a/aTitan = 1,481,000 / 1,221,870 = 1.21 (JPL); e drawn 0.12. */
  const hOrbit = ctx.orbit(0.15 * 1.21, 0.12, { plane: "xy", colour: "#b5a68e", opacity: 0.5, parent: orbitGroup });
  hOrbit.position.copy(oc);
  const tDot = ctx.ball(0.016, { body: "Titan", parent: orbitGroup });
  const hDot = ctx.ball(0.01, { colour: "#b5a68e", parent: orbitGroup });
  const lOrbit = ctx.label(["Titan: 4 laps", "Hyperion: 3 laps"], { at: [oc.x, oc.y - 0.27, 0], height: 0.022, parent: orbitGroup });

  /* The plot: spin rate (turns per orbit) of the twins against time. */
  const PX0 = -0.95;
  const PX1 = 0.85;
  const PY0 = -0.76;
  const PY1 = -0.42;
  const plot = new THREE.Group();
  ctx.add(plot);
  ctx.line([[PX0, PY0, 0], [PX1, PY0, 0]], { colour: "#9fb3c8", opacity: 0.5, parent: plot, additive: false });
  ctx.line([[PX0, PY0, 0], [PX0, PY1, 0]], { colour: "#9fb3c8", opacity: 0.5, parent: plot, additive: false });
  ctx.label(["spin rate"], { at: [PX0 + 0.02, PY1 + 0.03, 0], height: 0.02, align: "left", parent: plot, colour: "#9fb3c8" });
  ctx.label([`${ORBITS} orbits →`], { at: [PX1, PY0 - 0.04, 0], height: 0.02, align: "right", parent: plot, colour: "#9fb3c8" });
  const curveA = ctx.line([[PX0, PY0, 0], [PX0, PY0, 0]], { colour: "#e8f1ff", opacity: 0.9, parent: plot });
  const curveB = ctx.line([[PX0, PY0, 0], [PX0, PY0, 0]], { colour: "#ff9f6a", opacity: 0.9, parent: plot });
  const wMax = 2.6;
  const curvePts = (run, tNow) => {
    const pts = [];
    const steps = 220;
    for (let i = 0; i <= steps; i += 1) {
      const t = (tNow * i) / steps;
      const [, w] = sample(run, t);
      pts.push(new THREE.Vector3(lerp(PX0, PX1, t / (ORBITS * TAU)), lerp(PY0, PY1, clamp01(w / wMax)), 0.01));
    }
    return pts;
  };

  ctx.tell([
    { at: 0, label: "A sponge moon", text: "Hyperion, a lumpy ball of ice and rubble, riddled with deep craters — it is mostly empty space inside." },
    { at: 0.18, label: "Tugged by Titan", text: "Titan's 4-to-3 rhythm keeps Hyperion's orbit stretched, and each close pass by Saturn gives its long body a twist." },
    { at: 0.42, label: "Twins", text: "Two Hyperions, started a fraction of a degree apart. For a few orbits they turn together…" },
    { at: 0.64, label: "Chaos", text: "…then they go their own ways. Hyperion's spin can never be predicted for long." },
  ]);

  return {
    duration: 22,
    update(p) {
      const t = ORBITS * TAU * span(p, 0.03, 0.97);
      const [thA] = sample(A, t);
      const [thB] = sample(B, t);
      hA.body.rotation.z = thA;
      hB.body.rotation.z = thB;
      /* Layout: one large Hyperion, then the twins side by side. */
      const twin = easeInOut(span(p, 0.4, 0.48));
      hA.holder.position.set(lerp(-0.3, -0.5, twin), lerp(0.08, 0.18, twin), 0);
      hA.holder.scale.setScalar(lerp(1.5, 1, twin));
      hB.holder.position.set(0.15, 0.18, 0);
      ctx.fade(hB.holder, twin);
      lA.position.set(hA.holder.position.x, hA.holder.position.y - lerp(0.42, 0.3, twin), 0.2);
      lB.position.set(0.15, 0.18 - 0.3, 0.2);
      ctx.fade(lA, smooth(p, 0, 0.05));
      ctx.fade(lB, twin);
      ctx.fade(lSponge, win(p, 0.04, 0.2));
      ctx.fade(orbitGroup, win(p, 0.17, 0.42));
      const laps = span(p, 0.17, 0.42) * 3;
      tDot.position.set(oc.x + Math.cos(laps * (4 / 3) * TAU) * 0.15, oc.y + Math.sin(laps * (4 / 3) * TAU) * 0.15, 0.01);
      const { f, ar } = kep(laps * TAU);
      const rH = (0.15 * 1.21) * (1 - 0.12 * 0.12) / (1 + 0.12 * Math.cos(f));
      void ar;
      hDot.position.set(oc.x + Math.cos(f) * rH, oc.y + Math.sin(f) * rH, 0.01);
      ctx.fade(plot, twin);
      ctx.setLine(curveA, curvePts(A, t));
      ctx.setLine(curveB, curvePts(B, t));
    },
  };
}

export const SATURN_EVENTS = [
  /* ------------------------------------------------------------------ 70 */
  event({
    id: "saturn-hexagon",
    section: "giants",
    title: "Saturn's hexagon",
    place: "Saturn · the north pole",
    kind: "ongoing",
    family: "planetary",
    often: "seen since 1980–81",
    detail: "A jet stream with six straight sides circles Saturn's north pole — each side about 14,500 km, wider than Earth",
    frequency: "Continuous. Seen in Voyager images from 1980–81, by telescopes from Earth, and through Cassini's whole mission to 2017 — it has lasted at least four decades.",
    cause: "The hexagon is a jet stream, a narrow river of wind blowing at about 100 m/s around the pole. Where winds of different speeds meet, the boundary can buckle into a stable wave; with six crests round the pole, the path becomes a hexagon. Spinning tanks of fluid in the laboratory make the same kind of polygons.",
    note: "It turns with the planet's interior, roughly every 10 h 39 min, and has hardly changed shape in forty years. Between 2012 and 2016, as northern summer came on, Cassini saw its inside change from blue to gold.",
    accuracy: "The site's own Saturn, with the hexagon traced round its north pole at the real size (corners 14,500 km from the pole) and Earth beside it to the same scale (12,742 km). The jet's flow is drawn as moving dots, not to its real speed.",
    art: { main: "saturn", fx: "hexagon" },
    body: "Saturn",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "use the real bodies to just highlight the
       * hexagon and show the sides and earth along with it"): the hexagon
       * traced on the real Saturn round its north pole (78° N), its jet
       * flowing, and Earth beside one side, to scale.
       */
      /* Each side about 14,500 km (Godfrey 1988; Cassini); the hexagon's
       * corners lie on a circle of that radius round the pole. Earth's
       * diameter 12,742 km. Saturn 60,268 km. */
      const saturnBody = ctx.host;
      const R = worldRadius(saturnBody);
      const RL = bodyRadius(saturnBody);
      const S = saturnBody.getWorldPosition(new THREE.Vector3());
      const q = new THREE.Quaternion();
      saturnBody.getWorldQuaternion(q);
      const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      const sunDir = S.clone().negate().normalize();
      /* From over the north pole as far as the event camera goes (52° up),
       * on the side the pole leans toward, and toward the Sun so it is lit. */
      const lean = pole.clone().setY(0);
      const az = lean.lengthSq() > 1e-4 ? lean.normalize() : sunDir.clone().setY(0).normalize();
      const view = az.clone().multiplyScalar(0.55).addScaledVector(sunDir.clone().setY(0).normalize(), 0.25).normalize();
      const fov = saturnBody.userData?.focusFov ?? 30;
      const shot = holdShot(ctx, "Saturn", saturnBody, { yaw: yawFor(view), pitch: 1.1, distance: distanceFor(R, 0.62, fov) });
      /* Just above Saturn's haze shell (1.024 R, planetFactory.js). */
      /* Round 86 (Prompts.md: "the hexagon line drawn ... should be aligned
       * with the hexagon of Saturn"): turned to the site's own painted
       * hexagon. saturn.js draws it in the mesh's frame from the unit
       * direction's (x, z), turned by -30° (its rotate2D), with corners at
       * 0°, 60°, ... there -- so at 30° + k·60° measured from +x toward +z,
       * and its edge at hexDistance ≈ 0.21, a corner radius of 0.2425 of
       * the sphere (14,615 km, against the real ~14,500). */
      const hexPts = polarHexagon(RL * 1.03, SATURN_R_KM, 0.2425 * SATURN_R_KM, Math.PI / 6, 30);
      const hex = new THREE.Group();
      ctx.attach(saturnBody, hex);
      const hexLines = [0, 1, 2].map((k) => {
        const l = ctx.line(hexPts.map((v) => v.clone().multiplyScalar(1 + k * 0.0015)), { colour: "#ffd27f", opacity: 1, parent: hex, additive: false });
        l.renderOrder = 31;
        return l;
      });
      const n = hexPts.length - 1;
      /* The jet: dots running round the hexagon. */
      const FLOW = 60;
      const flow = Array.from({ length: FLOW }, () => ctx.glow("#bfe9ff", RL * 0.03, { opacity: 1, parent: hex }));
      /* Earth, to scale, beside one side. */
      const ER = (6371 / SATURN_R_KM) * RL;
      const earthBall = ctx.ball(ER, { body: "Earth", parent: hex });
      const sideMid = hexPts[Math.round(n / 12)].clone().normalize();
      earthBall.position.copy(sideMid.clone().multiplyScalar(RL * 1.03 + ER * 1.1));
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const hexLabel = H.label(["The hexagon", "a jet stream with six straight sides"], { align: "right", height: 0.046, colour: "#ffe3a8", declutter: false });
      const sideLabel = H.label(["Each side about 14,500 km", "longer than Earth is wide"], { at: [-0.5, -0.58, 0], height: 0.046, colour: "#ffe3a8", declutter: false });
      const earthLabel = H.label(["Earth, to scale"], { align: "left", height: 0.036, colour: "#9fd0ff", declutter: false });
      const why = H.label(["Where winds of different speeds meet", "the boundary buckles into six crests"], { at: [-0.5, 0.58, 0], height: 0.044, declutter: false });
      [hexLabel, sideLabel, earthLabel, why, earthBall].forEach((o) => ctx.fade(o, 0));
      hexLines.forEach((l) => ctx.fade(l, 0));
      flow.forEach((g) => ctx.fade(g, 0));
      ctx.tell([
        { at: 0, label: "The north pole", text: "The real Saturn, from over its north pole." },
        { at: 0.12, label: "Six straight sides", text: "Around the pole runs a hexagon: a jet stream with six straight sides, seen since the Voyagers flew past in 1980–81." },
        { at: 0.42, label: "Wider than Earth", text: "Each side is about 14,500 km — longer than Earth, beside it to scale, is wide." },
        { at: 0.7, label: "Why six", text: "Where winds of different speeds meet, the boundary buckles into a stable wave — and here the wave has six crests." },
      ]);
      const w = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          shot.keep();
          /* Traced side by side. */
          const trace = span(p, 0.12, 0.36);
          const m = Math.max(2, Math.round(n * trace) + 1);
          hexLines.forEach((l) => { ctx.setLine(l, hexPts.slice(0, m).map((v, i) => v.clone().multiplyScalar(1 + hexLines.indexOf(l) * 0.0015))); ctx.fade(l, trace > 0 ? 1 : 0); });
          flow.forEach((g, i) => {
            const s = ((i / FLOW) + ctx.t * 0.03) % 1;
            g.position.copy(hexPts[Math.floor(s * n)]).multiplyScalar(1.004);
            ctx.fade(g, smooth(p, 0.66, 0.72));
          });
          ctx.fade(earthBall, smooth(p, 0.42, 0.48));
          earthBall.rotation.y = ctx.t * 0.3;
          pin(ctx, hexLabel, hex.localToWorld(hexPts[Math.round(n * 0.6)].clone()), -0.06, 0.04);
          ctx.fade(hexLabel, smooth(p, 0.2, 0.26));
          ctx.fade(sideLabel, smooth(p, 0.42, 0.48));
          earthBall.getWorldPosition(w);
          pin(ctx, earthLabel, w, 0.06, 0.04);
          ctx.fade(earthLabel, smooth(p, 0.44, 0.5));
          ctx.fade(why, smooth(p, 0.7, 0.76));
        },
      };
    },

  }),

  /* ------------------------------------------------------------------ 71 */
  event({
    id: "ring-plane-crossing",
    section: "giants",
    title: "The rings vanish: ring-plane crossing",
    place: "Saturn, seen from Earth",
    kind: "recurring",
    family: "ring",
    when: "Mar 23, 2025",
    often: "every 13.75 or 15.75 years",
    timeline: { last: "March 23, 2025", next: "2038–39" },
    detail: "Saturn's rings are hundreds of thousands of kilometres wide but about ten metres thick — so when Earth lines up with them, they almost disappear",
    frequency: "Twice in each 29.5-year orbit of Saturn, alternately about 13.75 and 15.75 years apart, because Saturn's orbit is slightly stretched. The last was on March 23, 2025; the one before, September 2009; the next falls in 2038–39.",
    cause: "Saturn's rings lie in the plane of its equator, which is tilted about 27° to its orbit and keeps pointing the same way in space as Saturn goes round the Sun. So from Earth we see the rings tilted one way for years, then the other — and twice per orbit we look exactly along their plane.",
    note: "The main rings span about 270,000 km but are typically only about 10 m thick: to the same proportions, a sheet of paper almost 3 km wide. Edge-on, they shrink to a thin line or vanish, and faint moons are easier to spot.",
    accuracy: "The site's own Saturn and rings, seen from the direction of the Sun (Earth is always close to it as seen from Saturn). The tilt follows a smooth curve through the real dates (most open in late 2017, edge-on in March 2025); Earth's own motion makes the real crossings wobble, and that is left out.",
    art: { main: "saturn", fx: "edgeon" },
    body: "Saturn",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "show it wrt Earth pov ... how the rings
       * vanish when it is aligned, using real space bodies"): the real
       * Saturn seen from Earth's direction, the line of sight tipping from
       * 27° above the ring plane (2017) to edge-on (March 23, 2025) and on
       * to the other face.
       */
      /* Ring tilt to Earth B: +26.9° in October 2017, 0 on March 23, 2025,
       * the next edge-on in 2038–39; a quarter of Saturn's 29.46-year orbit
       * (JPL). Modelled as B = 26.9° sin(2 pi (2025.22 - t) / 29.46). */
      const saturnBody = ctx.host;
      const R = worldRadius(saturnBody);
      const S = saturnBody.getWorldPosition(new THREE.Vector3());
      const q = new THREE.Quaternion();
      saturnBody.getWorldQuaternion(q);
      const N = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      const sunDir = S.clone().negate().normalize();
      const e1 = sunDir.clone().addScaledVector(N, -sunDir.dot(N)).normalize();
      const fov = saturnBody.userData?.focusFov ?? 30;
      const dist = distanceFor(R * 2.4, 0.78, fov);
      const B = (t) => 26.9 * DEG * Math.sin((TAU * (2025.22 - t)) / 29.46);
      /* Late 2017 to edge-on (March 2025) by the caption at 0.5, then on. */
      /* Round 86 (Prompts.md: "the rings ... must for a split second
       * disappear right at one POV from Earth"): the clock holds on the
       * crossing itself, March 23, 2025, from 0.52 to 0.56. */
      const yearAt = (p) => (p < 0.52 ? lerp(2017.8, 2025.22, easeInOut(span(p, 0.04, 0.52)))
        : p < 0.56 ? 2025.22 : lerp(2025.22, 2026.6, span(p, 0.56, 0.92)));
      /* How much of the rings shows. Their lit face is seen foreshortened by
       * sin B; edge-on only their ~10 m thickness faces us, which at
       * Saturn's distance is nothing. The site's grains are sprites with a
       * minimum size, so without this they would stay a bright line. Faded
       * over the last 1.2° (about three months either side). */
      const ringSystem = saturnBody.getObjectByName("Saturn particle-resolved seven-group ring system");
      const ringShow = (b) => THREE.MathUtils.clamp(Math.sin(Math.abs(b)) / Math.sin(1.2 * DEG), 0, 1) ** 0.8;
      const dirAtYear = (t) => e1.clone().multiplyScalar(Math.cos(B(t))).addScaledVector(N, Math.sin(B(t))).normalize();
      const d0 = dirAtYear(yearAt(0));
      const shot = holdShot(ctx, "Saturn", saturnBody, { yaw: yawFor(d0), pitch: pitchFor(d0), distance: dist });

      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const title = H.label(["", ""], { at: [-0.5, 0.62, 0], height: 0.05, declutter: false });
      const thin = H.label(["Hundreds of thousands of km wide", "but only about ten metres thick"], { at: [-0.5, -0.6, 0], height: 0.046, colour: "#ffe3a8", declutter: false });
      /* The geometry, small, bottom left: the ring plane and our line of
       * sight from Earth. */
      const G = new THREE.Group();
      G.position.set(-0.86, -0.18, 0);
      hud.add(G);
      const GK = hudKit(ctx, G);
      GK.line([[-0.16, 0, 0], [0.16, 0, 0]], { colour: "#e8dcc0", opacity: 0.9 });
      GK.ball(0.04, { body: "Saturn" });
      const sight = GK.line([[0, 0, 0], [0.2, 0, 0]], { colour: "#9fd0ff", opacity: 1 });
      const eDot = GK.glow("#7fc4ff", 0.05, { opacity: 1 });
      GK.label(["our line of sight"], { at: [0, -0.1, 0], height: 0.022, colour: "#9fd0ff", declutter: false });
      [thin].forEach((o) => ctx.fade(o, 0));
      ctx.fade(G, 0);
      ctx.tell([
        { at: 0, label: "Wide open", text: "The real Saturn as Earth sees it, late 2017: the rings tipped 27° toward us, as open as they get." },
        { at: 0.22, label: "Closing", text: "As Saturn moves along its orbit, our line of sight swings toward the plane of the rings." },
        { at: 0.5, label: "March 23, 2025", text: "Edge-on: the rings, hundreds of thousands of kilometres wide but only about ten metres thick, nearly vanish." },
        { at: 0.72, label: "The other face", text: "Then they open again, showing their southern face. The next edge-on: 2038–39." },
      ]);
      return {
        duration: 24,
        update(p) {
          const t = yearAt(p);
          const d = dirAtYear(t);
          shot.keep(dist, yawFor(d), pitchFor(d));
          ringSystem?.userData.setEventFade?.(ringShow(B(t)));
          const b = B(t) / DEG;
          const yr = Math.floor(t);
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
          const mo = months[Math.min(11, Math.floor((t - yr) * 12))];
          title.userData.draw([`${mo} ${yr}`, Math.abs(b) < 0.05 ? "edge-on: the rings vanish" : Math.abs(b) < 1.2 ? "almost edge-on" : `rings tipped ${Math.abs(b).toFixed(0)}° ${b > 0 ? "toward us (north face)" : "(south face)"}`]);
          ctx.fade(title, smooth(p, 0.0, 0.04));
          ctx.fade(thin, smooth(p, 0.48, 0.54) * (1 - smooth(p, 0.78, 0.84)));
          ctx.fade(G, smooth(p, 0.06, 0.12));
          const ang = B(t);
          ctx.setLine(sight, [[0, 0, 0], [Math.cos(ang) * 0.22, Math.sin(ang) * 0.22, 0]]);
          eDot.position.set(Math.cos(ang) * 0.24, Math.sin(ang) * 0.24, 0);
        },
        dispose() { ringSystem?.userData.setEventFade?.(1); },
      };
    },

  }),

  /* ------------------------------------------------------------------ 72 */
  event({
    id: "ring-rain",
    section: "giants",
    title: "Ring rain",
    place: "Saturn and its rings",
    kind: "ongoing",
    family: "ring",
    often: "all the time",
    detail: "Ice from Saturn's rings is falling into the planet — fast enough that the rings may be mostly gone in a few hundred million years",
    frequency: "Continuous, measured from Earth (Keck telescope, 2011) and by Cassini's Grand Finale dives between the rings and the planet in 2017.",
    cause: "Sunlight and micrometeorite impacts charge tiny ice grains in the rings. Once charged, a grain is steered by Saturn's magnetic field instead of orbiting freely, and slides along the field lines down into the upper atmosphere at mid-latitudes. Cassini also found material falling straight in from the innermost ring, near the equator.",
    note: "NASA's 2018 estimate: enough water to fill an Olympic swimming pool every half hour. At that rate the rings may be mostly gone in under about 300 million years — so we may be living at a good time to see them.",
    accuracy: "The site's own Saturn and rings, to scale with each other. The field is drawn as a simple dipole lined up with the spin axis (Saturn's really is very nearly aligned); the grains are hugely enlarged and their flow is a picture; the bands where the rain falls are drawn at 40° N and S.",
    art: { main: "saturn", fx: "rain" },
    body: "Saturn",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "Ring rain -> showing saturn ring and saturn
       * using real space bodies"): ice grains leaving the real rings along
       * the real Saturn's magnetic field lines and falling into its
       * atmosphere at mid-latitudes.
       */
      /* Ring rain enters near 40° N and S (O'Donoghue et al. 2013: dark
       * bands at 25–55° latitude). A field line reaching latitude lat
       * crosses the ring plane at L = 1 / cos²(lat): about 1.7 Saturn radii
       * for 40° -- the inner B ring. Cassini (2017) measured roughly 400 kg
       * to 3 tonnes a second (O'Donoghue et al. 2019 range 432–2870 kg/s). */
      const saturnBody = ctx.host;
      const R = worldRadius(saturnBody);
      const RL = bodyRadius(saturnBody);
      const S = saturnBody.getWorldPosition(new THREE.Vector3());
      const q = new THREE.Quaternion();
      saturnBody.getWorldQuaternion(q);
      const N = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      const sunDir = S.clone().negate().normalize();
      const e1 = sunDir.clone().addScaledVector(N, -sunDir.dot(N)).normalize();
      /* Side on, a little above the rings, lit. */
      const view = e1.clone().applyAxisAngle(N, 0.7).multiplyScalar(Math.cos(0.32)).addScaledVector(N, Math.sin(0.32)).normalize();
      const fov = saturnBody.userData?.focusFov ?? 30;
      const shot = holdShot(ctx, "Saturn", saturnBody, { yaw: yawFor(view), pitch: pitchFor(view), distance: distanceFor(R * 2.4, 0.82, fov) });
      const deck = new THREE.Group();
      ctx.attach(saturnBody, deck);
      const K = hudKit(ctx, deck);
      /* Field lines at several azimuths, L from 1.5 to 1.9. */
      const lines = [];
      for (let k = 0; k < 10; k += 1) {
        const az = (k / 10) * TAU;
        const Lv = 1.5 + (k % 3) * 0.2;
        const pts = dipoleLine(RL, Lv, az, 90);
        lines.push({ pts, line: K.line(pts, { colour: "#9fd0ff", opacity: 0.55 }) });
      }
      /* Grains running down the lines from the ring plane, both ways. */
      const GR = 360;
      const r = rng(41);
      const grains = Array.from({ length: GR }, () => ({ k: Math.floor(r() * lines.length), ph: r(), north: r() > 0.5 }));
      const cloud = K.cloud(GR, { size: 2.6 });
      grains.forEach((g, i) => cloud.tint(i, "#e8f6ff"));
      /* Where it falls: glowing bands near 40° N and S. */
      const band = (lat) => {
        const pts = [];
        for (let i = 0; i <= 160; i += 1) {
          const a = (i / 160) * TAU;
          pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(lat) * RL * 1.03, Math.sin(lat) * RL * 1.03, Math.sin(a) * Math.cos(lat) * RL * 1.03));
        }
        return K.line(pts, { colour: "#7fd0ff", opacity: 1 });
      };
      const bands = [band(40 * DEG), band(-40 * DEG)];
      [...lines.map((l) => l.line), ...bands].forEach((o) => ctx.fade(o, 0));
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const l1 = H.label(["ice grains from the rings", "electrically charged"], { at: [-0.62, 0.42, 0], height: 0.044, colour: "#e8f6ff", declutter: false });
      const l2 = H.label(["steered by the magnetic field", "down into the atmosphere"], { at: [-0.62, -0.5, 0], height: 0.044, colour: "#9fd0ff", declutter: false });
      const l3 = H.label(["Cassini, 2017: roughly 400 kg", "to 3 tonnes falling every second"], { at: [-0.62, 0.66, 0], height: 0.044, colour: "#ffe3a8", declutter: false });
      const l4 = H.label(["Gone, mostly, in a few hundred million years?", "we may be living at the best time to see them"], { at: [-0.45, -0.68, 0], height: 0.044, colour: "#ffe3a8", declutter: false });
      [l1, l2, l3, l4].forEach((o) => ctx.fade(o, 0));
      ctx.tell([
        { at: 0, label: "The rings", text: "The real Saturn and its rings: countless pieces of ice, from dust grains to boulders." },
        { at: 0.18, label: "Ring rain", text: "Tiny grains become electrically charged, and Saturn's magnetic field steers them down into its atmosphere." },
        { at: 0.48, label: "Measured", text: "Cassini measured this ring rain in 2017, diving between the rings and the planet." },
        { at: 0.72, label: "Not forever", text: "At this rate the rings may be mostly gone in a few hundred million years — we may be living at the best time to see them." },
      ]);
      return {
        duration: 24,
        update(p) {
          shot.keep();
          const on = smooth(p, 0.16, 0.24);
          lines.forEach((l) => ctx.fade(l.line, on * 0.55));
          bands.forEach((b) => ctx.fade(b, smooth(p, 0.3, 0.38) * (0.7 + 0.3 * Math.sin(ctx.t * 3))));
          grains.forEach((g, i) => {
            const s = (g.ph + ctx.t * 0.12) % 1;
            /* From the ring plane (the middle of the line) to one end. */
            const f = g.north ? 0.5 - 0.5 * s : 0.5 + 0.5 * s;
            const v = along(lines[g.k].pts, f);
            cloud.set(i, v.x, v.y, v.z);
            cloud.alpha[i] = on * (1 - s * 0.3);
          });
          cloud.commit();
          ctx.fade(l1, smooth(p, 0.16, 0.22));
          ctx.fade(l2, smooth(p, 0.24, 0.3));
          ctx.fade(l3, smooth(p, 0.48, 0.54));
          ctx.fade(l4, smooth(p, 0.72, 0.78));
        },
      };
    },

  }),

  /* ------------------------------------------------------------------ 73 */
  event({
    id: "ring-propellers",
    section: "giants",
    title: "Propellers in the rings",
    place: "Saturn · the A ring",
    kind: "ongoing",
    family: "ring",
    often: "always there",
    detail: "Moonlets a few hundred metres across, too small to see, stir up the ring around them into propeller-shaped gaps",
    frequency: "Continuous. Cassini found the first in 2006, then many more, gathered in belts in the middle of the A ring.",
    cause: "A moonlet orbiting inside the ring pulls on the particles that pass it. Particles just inside its orbit go round a little faster and overtake it; those just outside fall behind. Each stream is nudged aside as it passes, leaving a short gap ahead on one side and behind on the other — a two-bladed shape, like a propeller, with the moonlet at its hub.",
    note: "The moonlets themselves, about 100 m to 1 km across, are too small to see; the propellers are a few kilometres long. The biggest few were followed for years and given nicknames after pioneer aviators, such as Blériot, Earhart and Santos-Dumont.",
    accuracy: "The site's own rings, from above. The Encke gap is marked at its real radius with the real moon Pan put in it; the propeller is drawn in the outer A ring about 30 times its real size so it shows. The close-up after is a diagram in the moonlet's own frame.",
    art: { main: "saturn", fx: "ring" },
    body: "Saturn",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "show this in the saturn real rings ...
       * highlighting where we see gaps and the moonlet"): the real rings
       * from above, the Encke gap marked with the real moon Pan in it -- a
       * moonlet big enough to clear a whole gap -- and, in the outer A ring,
       * a propeller: a moonlet too small to, with its two short gaps (drawn
       * enlarged). Then the round-79 close-up, on black.
       */
      /* Encke gap 133,589 km, 325 km wide; Pan a = 133,584 km; the large
       * propellers (Blériot and others) lie in the outer A ring near
       * 134,000–136,000 km; propeller moonlets ~100 m to ~1 km
       * (Tiscareno et al. 2010). */
      const saturnBody = ctx.host;
      const RL = bodyRadius(saturnBody);
      const R = worldRadius(saturnBody);
      const S = saturnBody.getWorldPosition(new THREE.Vector3());
      const km = RL / SATURN_R_KM;
      const q = new THREE.Quaternion();
      saturnBody.getWorldQuaternion(q);
      const N = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      const sunDir = S.clone().negate().normalize();
      const e1 = sunDir.clone().addScaledVector(N, -sunDir.dot(N)).normalize();
      /* From above the lit face of the rings, at 55° (a wider lens for this
       * view, restored after). */
      const fov0 = saturnBody.userData.focusFov;
      saturnBody.userData.focusFov = 52;
      const view = e1.clone().multiplyScalar(Math.cos(0.95)).addScaledVector(N, Math.sin(0.95)).normalize();
      const shot = holdShot(ctx, "Saturn", saturnBody, { yaw: yawFor(view), pitch: pitchFor(view), distance: distanceFor(R * 2.35, 0.9, 52) });
      /* In the ring plane (Saturn's own frame: y is its axis). */
      const deck = new THREE.Group();
      ctx.attach(saturnBody, deck);
      const K = hudKit(ctx, deck);
      const ringAt = (rKm, colour, opacity) => K.circle(rKm * km, { colour, opacity, additive: false, segments: 360 });
      const encke = ringAt(133589, "#ff9a6a", 1);
      encke.renderOrder = 32;
      /* Pan, put in its gap. */
      const pan = ctx.findBody("Pan");
      const panPivot = pan?.parent;
      const panPlane = panPivot?.parent;
      const panScale = panPlane?.getWorldScale(new THREE.Vector3()).x || 1;
      const PAN_A = (133584 * km * saturnBody.getWorldScale(new THREE.Vector3()).x) / panScale;
      /* The propeller: in the outer A ring, on the side toward the camera,
       * drawn 30 times its real size so it shows. Two lobes, one each side
       * of the moonlet, offset along the orbit. */
      const PROP_R = 135200 * km;
      const camLocal = shotDirection(shot.yaw, shot.pitch).applyQuaternion(q.clone().invert());
      const propAz = Math.atan2(camLocal.z, camLocal.x) + 0.5;
      const prop = new THREE.Group();
      deck.add(prop);
      prop.position.set(Math.cos(propAz) * PROP_R, 0.002 * RL, Math.sin(propAz) * PROP_R);
      prop.rotation.y = -propAz;
      const PK = hudKit(ctx, prop);
      const L = 0.09 * RL;
      const lobe = (sgn) => {
        const pts = [];
        for (let i = 0; i <= 30; i += 1) {
          const a = (i / 30) * TAU;
          pts.push([Math.cos(a) * L * 0.07 + sgn * L * 0.06, Math.sin(a) * L * 0.5 + sgn * L * 0.45]);
        }
        const m = PK.shape(pts, { colour: "#05070c", opacity: 0.85 });
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 33;
        return m;
      };
      const lobes = [lobe(1), lobe(-1)];
      const moonlet = PK.glow("#ffffff", L * 0.18, { opacity: 1 });
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const enckeLabel = H.label(["The Encke gap", "kept clear by the moon Pan"], { align: "right", height: 0.044, colour: "#ffb08a", declutter: false });
      const panRing = H.circle(0.03, { plane: "xy", colour: "#ffb08a", opacity: 1, additive: false });
      const propRing = H.circle(0.06, { plane: "xy", colour: "#ffd27f", opacity: 1, additive: false });
      const propLabel = H.label(["A propeller", "a moonlet too small to clear a gap (drawn ×30)"], { align: "left", height: 0.044, colour: "#ffe3a8", declutter: false });
      [enckeLabel, panRing, propRing, propLabel, encke, ...lobes, moonlet].forEach((o) => ctx.fade(o, 0));
      /* The close-up, on black. */
      const D = diorama(ctx, propellerDiorama, { x: -0.44, y: 0.0, scale: 0.62 });
      D.show(0);
      ctx.tell([
        { at: 0, label: "Saturn's rings", text: "The real rings from above. In the A ring runs the Encke gap, swept clear by the small moon Pan." },
        { at: 0.24, label: "Hidden moonlets", text: "Hidden in the rings are far smaller moonlets, only a few hundred metres across — too small to clear a gap of their own." },
        { at: 0.5, label: "Propellers", text: "As ring particles stream past, a moonlet's gravity stirs them aside on either side, carving two gaps shaped like a propeller." },
        { at: 0.78, label: "Found by Cassini", text: "Cassini found many of them, in belts in the A ring." },
      ]);
      const cut = cutter(ctx, null);
      const w = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          const real = p < 0.5;
          if (real) shot.keep();
          cut(!real);
          if (pan && panPivot) {
            pan.position.x = PAN_A;
            pan.visible = true;
          }
          ctx.fade(encke, real ? smooth(p, 0.04, 0.08) : 0);
          const pl = real ? smooth(p, 0.24, 0.3) : 0;
          lobes.forEach((m) => ctx.fade(m, pl));
          ctx.fade(moonlet, pl);
          moonlet.scale.setScalar(L * (0.18 + 0.05 * Math.sin(ctx.t * 4)));
          if (pan) {
            pan.getWorldPosition(w);
            const h = toHud(ctx, w);
            panRing.position.set(h.x, h.y, 0);
            /* Beside Pan, to its left, and kept below the site's top bar. */
            enckeLabel.position.set(h.x - 0.06, Math.min(h.y, 0.6), 0);
          }
          ctx.fade(panRing, real ? smooth(p, 0.06, 0.1) : 0);
          ctx.fade(enckeLabel, real ? smooth(p, 0.06, 0.1) : 0);
          prop.getWorldPosition(w);
          const hp = toHud(ctx, w);
          propRing.position.set(hp.x, hp.y, 0);
          propLabel.position.set(hp.x + 0.08, hp.y - 0.08, 0);
          ctx.fade(propRing, pl);
          ctx.fade(propLabel, pl);
          D.show(real ? 0 : smooth(p, 0.5, 0.53));
          D.update(lerp(0.2, 1, span(p, 0.5, 1)));
        },
        dispose() { saturnBody.userData.focusFov = fov0; D.dispose(); },
      };
    },

  }),

  /* ------------------------------------------------------------------ 74 */
  event({
    id: "shepherd-moons",
    section: "giants",
    title: "Shepherd moons",
    place: "Saturn · the F ring",
    kind: "ongoing",
    family: "ring",
    often: "every 14.7 hours",
    detail: "Prometheus inside and Pandora outside keep Saturn's F ring narrow — and Prometheus keeps tugging it into streamers and knots",
    frequency: "Continuous. Prometheus comes closest to the ring once per orbit, every 14.7 hours, each time a little farther along it, so the streamers repeat round the ring like the teeth of a comb.",
    cause: "The F ring is a narrow ring just outside the A ring, at about 140,200 km. Prometheus orbits about 800 km inside it and Pandora about 1,500 km outside. Their gravity nudges particles that stray toward them back toward the ring — herding it, like sheepdogs. Prometheus's orbit is slightly stretched, so once per orbit it swings close and drags out a streamer of ice, leaving a dark channel behind.",
    note: "Voyager 1 saw the F ring's 'braids' in 1980. Cassini showed the streamers, channels and knots changing from day to day; small moonlets inside the ring add clumps and jets of their own.",
    accuracy: "The site's own rings, with the F ring marked at its real radius and the real Prometheus and Pandora put on their real orbits (the site usually draws them farther out); the moons are drawn far larger than real and their motion is sped up. The strip of the ring after is a diagram: radial distances stretched, the streamers a simplified model.",
    art: { main: "saturn", fx: "ring" },
    body: "Saturn",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "Shepherd moons -> using real space bodies"):
       * the real F ring highlighted on the real rings, and the real
       * Prometheus and Pandora put on their real orbits just inside and
       * just outside it, moving at their real rates (sped up). Then the
       * round-79 strip of the ring, its streamers and braids, on black.
       */
      /* F ring a = 140,180 km; Prometheus 139,380 km, period 0.6130 d;
       * Pandora 141,720 km, 0.6285 d (JPL satellite mean elements). */
      const saturnBody = ctx.host;
      const RL = bodyRadius(saturnBody);
      const R = worldRadius(saturnBody);
      const S = saturnBody.getWorldPosition(new THREE.Vector3());
      const km = RL / SATURN_R_KM;
      const q = new THREE.Quaternion();
      saturnBody.getWorldQuaternion(q);
      const N = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      const sunDir = S.clone().negate().normalize();
      const e1 = sunDir.clone().addScaledVector(N, -sunDir.dot(N)).normalize();
      const fov0 = saturnBody.userData.focusFov;
      saturnBody.userData.focusFov = 52;
      const view = e1.clone().applyAxisAngle(N, -0.5).multiplyScalar(Math.cos(0.9)).addScaledVector(N, Math.sin(0.9)).normalize();
      const shot = holdShot(ctx, "Saturn", saturnBody, { yaw: yawFor(view), pitch: pitchFor(view), distance: distanceFor(R * 2.4, 0.9, 52) });
      const deck = new THREE.Group();
      ctx.attach(saturnBody, deck);
      const K = hudKit(ctx, deck);
      const fRing = K.circle(140180 * km, { colour: "#ffd27f", opacity: 1, additive: false, segments: 400 });
      fRing.renderOrder = 32;
      const swS = saturnBody.getWorldScale(new THREE.Vector3()).x;
      const MOONS = [
        { name: "Prometheus", aKm: 139380, P: 0.6130, colour: "#9fd0ff" },
        { name: "Pandora", aKm: 141720, P: 0.6285, colour: "#ffb08a" },
      ].map((m) => {
        const mesh = ctx.findBody(m.name);
        const pivot = mesh?.parent;
        const plane = pivot?.parent;
        const sc = plane?.getWorldScale(new THREE.Vector3()).x || 1;
        return { ...m, mesh, pivot, base: pivot?.rotation.y ?? 0, a: (m.aKm * km * swS) / sc };
      }).filter((m) => m.mesh && m.pivot);
      /* Start both on the side toward the camera. */
      const camPlane = MOONS[0]?.pivot.parent ? shotDirection(shot.yaw, shot.pitch).applyQuaternion(MOONS[0].pivot.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : new THREE.Vector3(1, 0, 0);
      const th0 = Math.atan2(-camPlane.z, camPlane.x);
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const rings = MOONS.map((m) => H.circle(0.035, { plane: "xy", colour: m.colour, opacity: 1, additive: false }));
      const names = MOONS.map((m) => H.label([m.name, m.name === "Prometheus" ? "just inside" : "just outside"], { height: 0.04, colour: m.colour, declutter: false }));
      const fLabel = H.label(["The F ring", "thin and knotted"], { at: [-0.62, 0.58, 0], height: 0.046, colour: "#ffe3a8", declutter: false });
      [...rings, ...names, fLabel, fRing].forEach((o) => ctx.fade(o, 0));
      const D = diorama(ctx, shepherdDiorama, { x: -0.44, y: 0.0, scale: 0.62 });
      D.show(0);
      ctx.tell([
        { at: 0, label: "The F ring", text: "The real rings: just outside the main rings runs the thin F ring." },
        { at: 0.14, label: "Two shepherds", text: "It is guarded by two small moons, Prometheus just inside it and Pandora just outside, here on their real orbits." },
        { at: 0.32, label: "Herding", text: "Their gravity herds stray particles back and keeps the ring narrow." },
        { at: 0.54, label: "Streamers", text: "Every time Prometheus swings close it pulls out streamers of ice, twisting the ring into knots and braids." },
      ]);
      const cut = cutter(ctx, null);
      const w = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          const real = p < 0.52;
          if (real) shot.keep();
          cut(!real);
          /* Half a day of real time, sped up: about 0.8 of an orbit. */
          const days = 0.5 * span(p, 0.02, 0.52);
          MOONS.forEach((m, i) => {
            m.pivot.rotation.y = th0 - 0.6 + (days / m.P) * TAU * 0.25;
            m.mesh.position.x = m.a;
            m.mesh.visible = true;
            m.mesh.getWorldPosition(w);
            const h = toHud(ctx, w);
            rings[i].position.set(h.x, h.y, 0);
            names[i].position.set(h.x, h.y + (i ? -0.09 : 0.09), 0);
            ctx.fade(rings[i], real ? smooth(p, 0.14, 0.18) : 0);
            ctx.fade(names[i], real ? smooth(p, 0.14, 0.18) : 0);
          });
          ctx.fade(fRing, real ? smooth(p, 0.02, 0.06) : 0);
          ctx.fade(fLabel, real ? smooth(p, 0.02, 0.06) : 0);
          D.show(real ? 0 : smooth(p, 0.52, 0.55));
          D.update(lerp(0.35, 1, span(p, 0.52, 1)));
        },
        dispose() { saturnBody.userData.focusFov = fov0; D.dispose(); },
      };
    },

  }),

  /* ------------------------------------------------------------------ 75 */
  event({
    id: "titan-methane-rain",
    section: "giants",
    title: "Methane rain and lakes on Titan",
    place: "Titan",
    kind: "recurring",
    family: "surface",
    often: "seasonal storms",
    detail: "On Titan methane rains from orange skies, carves rivers, and fills lakes and seas near the poles",
    frequency: "Seasonal. Titan's year is Saturn's 29.5 years; Cassini saw big storm clouds come and go, and surfaces darken after rain. Rain may be rare in any one place — perhaps once in centuries in the deserts — but heavy when it comes.",
    cause: "At about −179 °C, measured by the Huygens probe in 2005, methane and ethane are liquid. They evaporate, form clouds and fall as rain, as water does on Earth: Titan has a full weather cycle, only with methane. The thick nitrogen air, half again Earth's surface pressure, is filled with an orange haze of organic smog made by sunlight.",
    note: "The biggest sea, Kraken Mare, is about the size of the Caspian Sea; Ligeia Mare is the second largest. Titan is the only world besides Earth known to have stable liquid on its surface.",
    accuracy: "The site's own Titan, its haze thinned so the north polar seas show; the rings mark Kraken Mare and Ligeia Mare at their catalogued positions, and the rain over the pole is a picture. The landscape beside it is an illustration, not a real view.",
    art: { main: "titan", fx: "rain" },
    body: "Titan",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "show this on Titan real planet and the
       * mountain animation side by side; the mountain keeps flickering"):
       * the real Titan on the right, its northern seas ringed and rain
       * falling over them, the haze thinning so they show; beside it the
       * landscape of hills, rain, rivers and a sea, on the same clock (its
       * shapes now each on their own layer, which ends the flicker).
       */
      const titan = ctx.host;
      const R = worldRadius(titan);
      const T = titan.getWorldPosition(new THREE.Vector3());
      const q = new THREE.Quaternion();
      titan.getWorldQuaternion(q);
      const pole = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      const sunDir = T.clone().negate().normalize();
      const fov = titan.userData?.focusFov ?? 30;
      /* Seas, approximate centres (USGS Gazetteer; west longitude given as
       * east): Kraken Mare 68° N 310° W, Ligeia Mare 79° N 248° W. */
      const kraken = ringOn(ctx, titan, dirAt(68, 50), 9 * DEG, "#9fe8ff", { inner: 0.86, lift: 1.06 });
      const ligeia = ringOn(ctx, titan, dirAt(79, 112), 5 * DEG, "#9fe8ff", { inner: 0.8, lift: 1.06 });
      /* Looking down on the north polar seas (between the two, in the world,
       * with Titan held still), leaning to the Sun's side so they are lit:
       * the seas sit near the middle of Titan, clear of the card. */
      const seasDir = dirAt(74, 80).applyQuaternion(q).normalize();
      void pole;
      /* (Only a touch of the Sun's side: seen from near the pole the seas'
       * own direction is mostly "up", so a bigger lean swung the view round
       * and left them on the right-hand limb.) */
      const view = seasDir.clone().addScaledVector(sunDir, 0.12).normalize();
      const SHARE = 0.32;
      const shot = holdShot(ctx, "Titan", titan, { yaw: yawFor(view), pitch: pitchFor(view), distance: distanceFor(R, SHARE, fov) });
      /* The haze layers, thinned so the seas show (restored after). */
      const hazes = titan.children.filter((c) => /haze|veil|limb/i.test(c.name ?? ""));
      const hazeStore = hazes.map((h) => ({ h, u: h.material?.uniforms?.uOpacity?.value, o: h.material?.opacity }));
      const setHaze = (k) => hazeStore.forEach(({ h, u, o }) => {
        if (h.material?.uniforms?.uOpacity && Number.isFinite(u)) h.material.uniforms.uOpacity.value = u * k;
        else if (Number.isFinite(o)) h.material.opacity = o * k;
      });
      /* Rain over the north: short streaks falling to the surface. */
      const RL = bodyRadius(titan);
      const r = rng(90);
      const DROPS = 140;
      const drops = Array.from({ length: DROPS }, () => {
        const lat = 55 + r() * 30;
        const lon = (r() - 0.5) * 360;
        return { d: dirAt(lat, lon), ph: r() };
      });
      const rainGroup = new THREE.Group();
      ctx.attach(titan, rainGroup);
      const rain = ctx.cloud(DROPS * 2, { size: 2.2, parent: rainGroup });
      for (let i = 0; i < DROPS * 2; i += 1) rain.tint(i, "#ffe8c8");

      /* The landscape, left of Titan: hills, cloud, rain, a river and a
       * sea. Every shape has its own render order and depth. */
      const hud = ctx.hudLayer();
      const LG = new THREE.Group();
      LG.position.set(-0.92, -0.08, 0);
      LG.scale.setScalar(0.62);
      hud.add(LG);
      const K = hudKit(ctx, LG);
      const X0 = -0.66;
      const X1 = 0.66;
      const Y1 = 0.62;
      const SKY = ["#5a2c10", "#7a3e14", "#9a561c", "#b56f2a", "#c9883c", "#d59e52"];
      SKY.forEach((c, i) => {
        const y0 = lerp(Y1, -0.3, i / SKY.length);
        const y1 = lerp(Y1, -0.3, (i + 1) / SKY.length);
        const m = K.shape([[X0, y1], [X1, y1], [X1, y0], [X0, y0]], { colour: c, opacity: 1 });
        m.position.z = -0.03;
        m.renderOrder = 14;
      });
      const groundPts = [[X0, -0.9], [X0, -0.1], [X0 + 0.14, -0.02], [X0 + 0.3, -0.14], [X0 + 0.46, -0.2], [X0 + 0.62, -0.34], [X0 + 0.72, -0.4], [X1, -0.4], [X1, -0.9]];
      const ground = K.shape(groundPts, { colour: "#3a2a1c", opacity: 1 });
      ground.position.z = -0.02;
      ground.renderOrder = 15;
      const lake = K.shape([[X0 + 0.7, -0.41], [X1, -0.41], [X1, -0.86], [X0 + 0.58, -0.86], [X0 + 0.56, -0.6]], { colour: "#0e1620", opacity: 1 });
      lake.position.z = -0.01;
      lake.renderOrder = 16;
      const RIVER = [[X0 + 0.05, -0.08], [X0 + 0.14, -0.1], [X0 + 0.22, -0.18], [X0 + 0.32, -0.24], [X0 + 0.4, -0.32], [X0 + 0.48, -0.38], [X0 + 0.56, -0.46], [X0 + 0.64, -0.52]].map(([x, y]) => new THREE.Vector3(x, y, 0.005));
      const river = K.line(RIVER.slice(0, 2), { colour: "#3a6a8e", opacity: 1, additive: false });
      river.renderOrder = 17;
      const clouds = [0.2, 0.5, 0.8].map((fx) => {
        const g = K.glow("#f6e2c2", 0.34, { opacity: 0.6, additive: false });
        g.position.set(lerp(X0, X1, fx), 0.36, 0.01);
        g.renderOrder = 18;
        return g;
      });
      const RN = 260;
      const lrain = K.cloud(RN, { size: 2.4 });
      const rd = Array.from({ length: RN }, () => ({ x: lerp(X0 + 0.02, X1 - 0.02, r()), off: r(), sp: 0.7 + r() * 0.5 }));
      for (let i = 0; i < RN; i += 1) lrain.tint(i, "#ffe8c8");
      const frame = K.line([[X0, -0.9, 0.01], [X1, -0.9, 0.01], [X1, Y1, 0.01], [X0, Y1, 0.01], [X0, -0.9, 0.01]], { colour: "#e0a050", opacity: 0.7, additive: false });
      void frame;
      const lRain = K.label(["methane rain", "big drops, falling slowly"], { at: [0, 0.2, 0.02], height: 0.05, colour: "#fff0dc", declutter: false });
      const lRiver = K.label(["rivers"], { at: [X0 + 0.24, -0.34, 0.02], height: 0.04, colour: "#cfe6ff", declutter: false });
      const lSea = K.label(["a sea of methane", "and ethane"], { at: [0.3, -0.66, 0.02], height: 0.05, colour: "#cfe6ff", declutter: false });
      const lTitle = K.label(["On the ground", "an illustration"], { at: [0, Y1 + 0.1, 0], height: 0.05, declutter: false });
      ctx.fade(LG, 0);

      const H = hudKit(ctx, hud);
      const tLabel = H.label(["Titan", "−179 °C · under a thick orange haze"], { height: 0.046, declutter: false });
      const kLabel = H.label(["Kraken Mare"], { align: "left", height: 0.03, colour: "#cfe6ff", declutter: false });
      const gLabel = H.label(["Ligeia Mare"], { align: "left", height: 0.03, colour: "#cfe6ff", declutter: false });
      /* Drawn in a fixed order, so the two never swap places in depth. */
      kLabel.renderOrder = 60;
      gLabel.renderOrder = 61;
      let labelsPlaced = false;
      [tLabel, kLabel, gLabel].forEach((o) => ctx.fade(o, 0));
      ctx.tell([
        { at: 0, label: "Titan", text: "The real Titan, Saturn's largest moon, under a thick orange haze. At −179 °C, water is rock-hard ice." },
        { at: 0.18, label: "Methane rain", text: "But methane — a gas on Earth — is liquid here. It forms clouds and falls as rain." },
        { at: 0.42, label: "Rivers", text: "The rain runs off the hills and carves river channels, just as water does on Earth." },
        { at: 0.62, label: "Lakes and seas", text: "It fills lakes and seas near the poles: Kraken Mare, Ligeia Mare. Titan is the only other world with liquid on its surface." },
      ]);
      const spin0 = titan.rotation.clone();
      /* Titan is held still in the world: as it moves on round Saturn its
       * orbit pivot turns it, so its own rotation is set against that every
       * frame and the seas stay facing the camera. */
      const q0 = q.clone();
      const parentQ = new THREE.Quaternion();
      return {
        duration: 24,
        update(p) {
          shot.keep();
          titan.parent.getWorldQuaternion(parentQ);
          titan.quaternion.copy(parentQ.invert().multiply(q0));
          const storm = win(p, 0.16, 0.7, 0.06);
          /* Rain over the real Titan. */
          drops.forEach((d, i) => {
            const f = (d.ph + ctx.t * 0.5) % 1;
            const top = RL * (1.12 - f * 0.1);
            const v = d.d.clone().multiplyScalar(top);
            const v2 = d.d.clone().multiplyScalar(top + RL * 0.015);
            rain.set(i * 2, v.x, v.y, v.z);
            rain.set(i * 2 + 1, v2.x, v2.y, v2.z);
            rain.alpha[i * 2] = storm * 0.9;
            rain.alpha[i * 2 + 1] = storm * 0.5;
          });
          rain.commit();
          const clear = smooth(p, 0.6, 0.7);
          setHaze(1 - 0.75 * clear);
          ctx.fade(kraken.ring, smooth(p, 0.62, 0.66));
          ctx.fade(ligeia.ring, smooth(p, 0.64, 0.68));
          /* Round 86 (Prompts.md: the two names "are overlapping and
           * flickering"): each name sits on the far side of its own sea from
           * the other, along the line between them, a fixed 0.12 out, with
           * its anchor on that side -- so they never meet -- and the
           * positions are eased so a tiny camera settle does not shake them. */
          const hk = toHud(ctx, kraken.centre());
          const hg = toHud(ctx, ligeia.centre());
          const apart = hk.clone().sub(hg);
          if (apart.lengthSq() < 1e-8) apart.set(-1, 0, 0);
          apart.normalize();
          const kAt = hk.clone().addScaledVector(apart, 0.12);
          const gAt = hg.clone().addScaledVector(apart, -0.12);
          const ease = labelsPlaced ? 0.2 : 1;
          kLabel.position.lerp(kAt, ease);
          gLabel.position.lerp(gAt, ease);
          labelsPlaced = true;
          kLabel.center.set(apart.x < 0 ? 1 : 0, 0.5);
          gLabel.center.set(apart.x < 0 ? 0 : 1, 0.5);
          ctx.fade(kLabel, smooth(p, 0.64, 0.68));
          ctx.fade(gLabel, smooth(p, 0.66, 0.7));
          /* Below Titan on the screen (its disc is SHARE of the half-height). */
          pin(ctx, tLabel, titan.getWorldPosition(new THREE.Vector3()), -0.14, -(SHARE + 0.09));
          ctx.fade(tLabel, smooth(p, 0, 0.04));
          /* The landscape beside it. */
          ctx.fade(LG, smooth(p, 0.12, 0.18));
          clouds.forEach((c) => ctx.fade(c, 0.6 * storm));
          for (let i = 0; i < RN; i += 1) {
            const d = rd[i];
            const f = (d.off + ctx.t * 0.45 * d.sp) % 1;
            const y = lerp(0.3, -0.86, f);
            const gy = d.x < X0 + 0.72 ? -0.1 - (d.x - X0) * 0.45 : -0.41;
            lrain.set(i, d.x + f * 0.03, y, 0.012);
            lrain.alpha[i] = y > gy ? storm * 0.85 : 0;
          }
          lrain.commit();
          const carve = smooth(p, 0.4, 0.58);
          const n = Math.max(2, Math.floor(RIVER.length * carve));
          K.setLine(river, RIVER.slice(0, n));
          ctx.fade(river, carve > 0.05 ? 1 : 0);
          ctx.fade(lRain, storm);
          ctx.fade(lRiver, smooth(p, 0.46, 0.52));
          ctx.fade(lSea, smooth(p, 0.62, 0.68));
          ctx.fade(lTitle, smooth(p, 0.12, 0.18));
        },
        dispose() { setHaze(1); titan.rotation.copy(spin0); },
      };
    },

  }),

  /* ------------------------------------------------------------------ 76 */
  event({
    id: "hyperion-tumble",
    section: "giants",
    title: "Hyperion's chaotic tumble",
    place: "Hyperion",
    kind: "ongoing",
    family: "orbit",
    often: "never the same twice",
    detail: "A sponge-like moon tugged by Titan into a tumble so chaotic that its spin cannot be predicted for long",
    frequency: "Continuous. Voyager 2 (1981) and Cassini (2005 onward) found its spin changing from one look to the next.",
    cause: "Hyperion is lumpy, about 360 × 266 × 205 km, and its orbit is strongly stretched — kept that way by a 3:4 resonance with Titan, which goes round four times for every three of Hyperion's. Each time Hyperion swings close to Saturn, Saturn's pull twists its long axis by a different amount, depending on exactly how it is pointing. The result is chaos: tiny differences grow until its future spin is unknowable.",
    note: "Its density is only about 0.54 g/cm³, so it is perhaps 40% empty space inside — a rubble pile of ice. Craters do not blast out much ejecta; they punch down into it, which gives it its sponge-like look.",
    accuracy: "The site's own Hyperion, turned by the classic flat model of its tumble (Wisdom, Peale and Mignard, 1984), in which the long axis turns in the orbit plane (a small wobble is added; the real tumble is fully three-dimensional). The twins after are the same model from two nearly equal starts.",
    art: { main: "rock", fx: "wobble" },
    body: "Hyperion",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "Hyperion's chaotic tumble ... shown using
       * real space bodies"): the real Hyperion turning by the classic flat
       * model of its chaotic spin (Wisdom, Peale and Mignard 1984), with
       * the real Titan whose tug keeps its orbit stretched; then the round-79
       * twins, on black, showing how two nearly identical starts go their
       * own ways.
       */
      /* Hyperion: orbit e 0.1230, period 21.28 d; asymmetry
       * omega0^2 = 3 (B - A) / C ~ 0.89 (Wisdom et al. 1984). The angle
       * theta of the long axis obeys theta'' = -(omega0^2 / 2 r^3) sin 2(theta - f),
       * with r and f from Kepler's equation; integrated here in orbit units. */
      const hyperion = ctx.host;
      const titanBody = ctx.findBody("Titan");
      const R = worldRadius(hyperion);
      const Hp = hyperion.getWorldPosition(new THREE.Vector3());
      const sunDir = Hp.clone().negate().normalize();
      const fov = hyperion.userData?.focusFov ?? 30;
      const shot = holdShot(ctx, "Hyperion", hyperion, { yaw: yawFor(sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.4)), pitch: 0.3, distance: distanceFor(R, 0.24, fov) });
      const E = 0.123;
      const W2 = 0.89;
      const kepler = (M) => { let Ea = M; for (let i = 0; i < 8; i += 1) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea)); return Ea; };
      const steps = 4000;
      const tMax = TAU * 3;
      const thetas = [];
      let th = 0.3;
      let om = 1.2;
      const dt = tMax / steps;
      for (let i = 0; i <= steps; i += 1) {
        thetas.push(th);
        const M = i * dt;
        const Ea = kepler(M);
        const rr = 1 - E * Math.cos(Ea);
        const f = 2 * Math.atan2(Math.sqrt(1 + E) * Math.sin(Ea / 2), Math.sqrt(1 - E) * Math.cos(Ea / 2));
        const acc = -(W2 / (2 * rr ** 3)) * Math.sin(2 * (th - f));
        om += acc * dt;
        th += om * dt;
      }
      const thetaAt = (u) => {
        const x = Math.min(steps - 1, Math.max(0, u * steps));
        const i = Math.floor(x);
        return lerp(thetas[i], thetas[i + 1], x - i);
      };
      const rot0 = hyperion.quaternion.clone();
      const axis = new THREE.Vector3(0, 1, 0);
      const wobbleAxis = new THREE.Vector3(1, 0, 0);
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const title = H.label(["Hyperion", "about 360 km long · mostly empty space"], { height: 0.046, declutter: false });
      const tug = H.label(["Titan's tug", "keeps Hyperion's orbit stretched"], { align: "left", height: 0.044, colour: "#ffd27f", declutter: false });
      const rate = H.label(["", ""], { at: [-0.5, -0.6, 0], height: 0.046, colour: "#ffe3a8", declutter: false });
      const titanLine = H.line([[0, 0, 0], [0.01, 0, 0]], { colour: "#ffd27f", opacity: 0.8, dashed: true, dash: 0.02, gap: 0.015 });
      [title, tug, rate, titanLine].forEach((o) => ctx.fade(o, 0));
      const D = diorama(ctx, hyperionDiorama, { x: -0.44, y: 0.0, scale: 0.62 });
      D.show(0);
      ctx.tell([
        { at: 0, label: "A sponge moon", text: "The real Hyperion: a lumpy ball of ice, riddled with deep craters — it is mostly empty space inside." },
        { at: 0.2, label: "Tugged by Titan", text: "Titan's tug keeps Hyperion's orbit stretched, and each pass close to Saturn gives its long body a twist." },
        { at: 0.36, label: "No regular spin", text: "So it tumbles chaotically, speeding up, slowing down, flipping." },
        { at: 0.58, label: "Unpredictable", text: "Two Hyperions started a fraction of a degree apart soon go their own ways: its spin can never be predicted for long." },
      ]);
      const cut = cutter(ctx, null);
      const w = new THREE.Vector3();
      const tw = new THREE.Vector3();
      let last = thetaAt(0);
      return {
        duration: 24,
        update(p) {
          const real = p < 0.56;
          if (real) shot.keep();
          cut(!real);
          const u = span(p, 0.04, 0.56);
          const thv = thetaAt(u);
          const qq = new THREE.Quaternion().setFromAxisAngle(axis, thv).multiply(new THREE.Quaternion().setFromAxisAngle(wobbleAxis, 0.25 * Math.sin(thv * 1.7)));
          hyperion.quaternion.copy(rot0).multiply(qq);
          ctx.fade(title, real ? smooth(p, 0, 0.04) : 0);
          /* The name below Hyperion, on the screen (its disc is 0.24 of the
           * half-height). */
          pin(ctx, title, hyperion.getWorldPosition(w), -0.2, -0.34);
          if (titanBody) {
            titanBody.getWorldPosition(tw);
            hyperion.getWorldPosition(w);
            const a = toHud(ctx, w);
            const b = toHud(ctx, tw);
            const dir = b.clone().sub(a);
            const len = dir.length();
            dir.normalize();
            const end = a.clone().addScaledVector(dir, Math.min(len, 0.55));
            H.setLine(titanLine, [a.clone().addScaledVector(dir, 0.3), end]);
            /* Kept below the site's top bar and left of the card. */
            tug.position.set(Math.min(end.x + 0.02, 0.1), Math.min(end.y + 0.06, 0.6), 0);
            ctx.fade(titanLine, real ? smooth(p, 0.2, 0.26) : 0);
            ctx.fade(tug, real ? smooth(p, 0.2, 0.26) : 0);
          }
          const spinRate = Math.abs(thv - last) * 60;
          last = thv;
          rate.userData.draw(["Its spin, from moment to moment", `${spinRate < 0.3 ? "slow" : spinRate < 0.8 ? "steady" : "fast"} · ${thv - thetaAt(Math.max(0, u - 0.01)) > 0 ? "forward" : "backward"}`]);
          ctx.fade(rate, real ? smooth(p, 0.36, 0.42) : 0);
          D.show(real ? 0 : smooth(p, 0.56, 0.59));
          D.update(lerp(0.42, 1, span(p, 0.56, 1)));
        },
        dispose() { hyperion.quaternion.copy(rot0); D.dispose(); },
      };
    },

  }),

  /* ------------------------------------------------------------------ 77 */
  event({
    id: "iapetus-two-faces",
    section: "giants",
    title: "Iapetus: the two-faced moon",
    place: "Iapetus",
    kind: "ongoing",
    family: "surface",
    often: "always",
    detail: "One side of Iapetus is as dark as coal, the other as bright as snow — and a ridge up to 20 km high runs round its equator",
    frequency: "Permanent. Giovanni Cassini noticed in 1671 that Iapetus was bright on one side of Saturn and faint on the other; the spacecraft named after him showed why.",
    cause: "Iapetus keeps one face forward as it orbits. That leading side sweeps up dark dust spiralling in from far out — from the huge, faint ring fed by the moon Phoebe. The darkened ice soaks up more sunlight and warms, so its ice slowly evaporates and refreezes on the colder, brighter side and the poles. The dark side loses its ice and gets darker; the bright side gains it and gets brighter: a runaway.",
    note: "The dark region, Cassini Regio, reflects only a few per cent of the light that falls on it; the bright side reflects about half or more. The equatorial ridge runs more than 1,300 km and rises up to about 20 km — how it formed is still debated.",
    accuracy: "The site's own Iapetus and its Cassini-based map. The ridge is drawn along the equator across the dark side; the dust and the moving ice are pictures of the process, not to scale.",
    art: { main: "moon", fx: "phases" },
    body: "Iapetus",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "Iapetus: the two-faced moon ... shown using
       * real space bodies"): the real Iapetus turned through a full turn so
       * both faces show; dark dust from the Phoebe ring swept onto its
       * leading face; ice leaving the warm dark side for the cold bright one;
       * and its equatorial ridge.
       */
      /* The dark region, Cassini Regio, covers the leading hemisphere,
       * centred near 0°, 90° W (= -90° E); the ridge runs along the equator
       * there, up to ~20 km high (Porco et al. 2005). */
      const iapetus = ctx.host;
      const R = worldRadius(iapetus);
      const RL = bodyRadius(iapetus);
      const I = iapetus.getWorldPosition(new THREE.Vector3());
      const sunDir = I.clone().negate().normalize();
      const fov = iapetus.userData?.focusFov ?? 30;
      const shot = holdShot(ctx, "Iapetus", iapetus, { yaw: yawFor(sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35)), pitch: 0.12, distance: distanceFor(R, 0.3, fov) });
      /* Where Cassini Regio is on the site's own map (iapetus-albedo.jpg,
       * measured round 85: the dark band runs from u = 0.33 to 0.71 along
       * the equator, centre u = 0.52, i.e. dirAt longitude +7 in this
       * kit's convention) -- the map's longitudes start elsewhere than the
       * IAU 90° W, so the event follows the map, not the catalogue number.
       * The site's mapped Iapetus puts its ridge relief there too. */
      const DARK_LON = 7;
      const LEAD = dirAt(0, DARK_LON);
      const TRAIL = dirAt(0, DARK_LON + 180);
      const spin0 = iapetus.rotation.y;
      const camDir = () => shotDirection(shot.yaw, shot.pitch);
      /* The ridge, along the equator across the dark side. */
      const ridgePts = [];
      for (let i = 0; i <= 80; i += 1) {
        const lon = DARK_LON - 80 + (i / 80) * 160;
        ridgePts.push(dirAt(0, lon).multiplyScalar(RL * 1.012));
      }
      const ridge = ctx.line(ridgePts, { colour: "#ffd27f", opacity: 1, additive: false });
      ctx.attach(iapetus, ridge);
      ridge.renderOrder = 31;
      /* Dust coming in toward the leading face, and ice hopping across. */
      const r = rng(17);
      const DUST = 220;
      const dustGroup = new THREE.Group();
      ctx.attach(iapetus, dustGroup);
      const dust = ctx.cloud(DUST, { size: 2.6, additive: false, parent: dustGroup });
      const dustSeeds = Array.from({ length: DUST }, () => ({ off: new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.8, r() - 0.5).multiplyScalar(1.6), ph: r() }));
      for (let i = 0; i < DUST; i += 1) dust.tint(i, "#5a4030");
      const ICE = 60;
      const ice = ctx.cloud(ICE, { size: 3, parent: dustGroup });
      const iceSeeds = Array.from({ length: ICE }, () => ({ lat: (r() - 0.5) * 70, ph: r(), lon0: DARK_LON + (r() - 0.5) * 60 }));
      for (let i = 0; i < ICE; i += 1) ice.tint(i, "#eaf6ff");
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const face = H.label(["", ""], { at: [-0.5, 0.6, 0], height: 0.05, declutter: false });
      const dustLabel = H.label(["dark dust from the Phoebe ring", "swept up by the leading face"], { at: [-0.5, -0.56, 0], height: 0.044, colour: "#d8b89a", declutter: false });
      const iceLabel = H.label(["ice leaves the warm dark side", "and freezes on the cold bright side"], { at: [-0.5, -0.56, 0], height: 0.044, colour: "#cfe6ff", declutter: false });
      const ridgeLabel = H.label(["the equatorial ridge", "up to 20 km high"], { at: [-0.5, -0.56, 0], height: 0.044, colour: "#ffe3a8", declutter: false });
      [face, dustLabel, iceLabel, ridgeLabel].forEach((o) => ctx.fade(o, 0));
      ctx.fade(ridge, 0);
      ctx.tell([
        { at: 0, label: "Two faces", text: "The real Iapetus. The side that leads as it orbits is as dark as coal…" },
        { at: 0.16, label: "…and snow", text: "…and the other side is as bright as snow." },
        { at: 0.36, label: "Dark dust", text: "Leading the way, Iapetus sweeps up dark dust spiralling in from far out, from the faint ring of the moon Phoebe." },
        { at: 0.6, label: "A runaway", text: "The dark side warms in sunlight; its ice moves away to the cold bright side. Dark gets darker; bright gets brighter." },
        { at: 0.84, label: "The ridge", text: "And round its equator runs a ridge up to 20 km high — how it formed is still debated." },
      ]);
      return {
        duration: 24,
        update(p) {
          shot.keep();
          /* Dark face first, then round to the bright one and back. */
          const facing = p < 0.16 ? LEAD : p < 0.34 ? TRAIL.clone().lerp(LEAD, 1 - smooth(p, 0.16, 0.3)).normalize() : LEAD.clone().lerp(TRAIL, 0.25).normalize();
          turnToward(iapetus, p < 0.16 ? LEAD : facing, camDir(), 0.08);
          const showLead = p < 0.16 || p > 0.32;
          face.userData.draw(showLead ? ["The leading face", "as dark as coal"] : ["The trailing face", "as bright as snow"]);
          ctx.fade(face, smooth(p, 0, 0.04));
          const dIn = smooth(p, 0.36, 0.42) * (1 - smooth(p, 0.58, 0.62));
          dustSeeds.forEach((s, i) => {
            const f = (s.ph + ctx.t * 0.3) % 1;
            const target = LEAD.clone().multiplyScalar(RL * 1.01).add(s.off.clone().multiplyScalar(RL * 0.35));
            const from = LEAD.clone().multiplyScalar(RL * 3.2).add(s.off.clone().multiplyScalar(RL));
            const v = from.lerp(target, f);
            dust.set(i, v.x, v.y, v.z);
            dust.alpha[i] = dIn * 0.9;
          });
          dust.commit();
          ctx.fade(dustLabel, dIn);
          const iOn = smooth(p, 0.6, 0.66) * (1 - smooth(p, 0.82, 0.86));
          iceSeeds.forEach((s, i) => {
            const f = (s.ph + ctx.t * 0.25) % 1;
            const lon = lerp(s.lon0, s.lon0 + 180, f);
            const v = dirAt(s.lat, lon).multiplyScalar(RL * (1.02 + 0.1 * Math.sin(Math.PI * f)));
            ice.set(i, v.x, v.y, v.z);
            ice.alpha[i] = iOn;
          });
          ice.commit();
          ctx.fade(iceLabel, iOn);
          ctx.fade(ridge, smooth(p, 0.84, 0.88));
          ctx.fade(ridgeLabel, smooth(p, 0.84, 0.88));
          void spin0;
        },
        dispose() { iapetus.rotation.y = spin0; },
      };
    },

  }),
];

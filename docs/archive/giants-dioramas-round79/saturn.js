import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut, planetMap } from "./kit.js";

/**
 * Section 7 of the catalogue: Saturn and its moons (round 79).
 *
 * Eight dioramas in front of the lens (body: null): the polar hexagon, the
 * rings seen edge-on, ring rain, propellers, the F ring's shepherds,
 * Titan's methane weather, Hyperion's chaotic spin and Iapetus's two faces.
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
    accuracy: "Saturn, the hexagon and Earth are to one scale in the close-up (side 14,500 km, Earth 12,742 km). The flow of the jet is drawn as moving dots, not to its real speed.",
    art: { main: "saturn", fx: "hexagon" },
    scene(ctx) {
      ctx.light.set(-0.3, 0.5, 0.8).normalize();
      /* layout */
      const R = 0.31;
      const s = saturn(ctx, R, { ringOpacity: 0.85 });
      s.group.position.set(-0.38, -0.02, 0);
      s.group.rotation.x = 1.2; /* north pole tipped toward us */
      /* Hexagon: side = circumradius ≈ 14,500 km (Godfrey 1988; Cassini). */
      const HEX_KM = 14500;
      const hexOnGlobe = ctx.line(polarHexagon(R * 1.004, SATURN_R_KM, HEX_KM), { colour: "#9fe0ff", opacity: 0.95, parent: s.group, additive: false });
      const poleRoot = new THREE.Vector3(0, R, 0).applyEuler(s.group.rotation).add(s.group.position);
      const poleLabel = ctx.label(["North pole"], { at: [poleRoot.x - 0.02, poleRoot.y + 0.13, 0.3], height: 0.024 });

      /* The close-up, upper right: to scale with itself. */
      const ic = new THREE.Vector3(0.74, 0.2, 0);
      const IR = 0.31;
      const back = ctx.disc(IR, { colour: "#3a3020", opacity: 0.95 });
      back.position.copy(ic);
      const rim = ctx.circle(IR, { plane: "xy", colour: "#d8c49a", opacity: 0.5 });
      rim.position.copy(ic);
      const C = 0.2; /* hexagon circumradius in the close-up */
      const hexFill = new THREE.Mesh(new THREE.CircleGeometry(C, 6), new THREE.MeshBasicMaterial({ color: "#5d7690", transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, fog: false }));
      hexFill.position.set(ic.x, ic.y, 0.005);
      hexFill.renderOrder = 20;
      hexFill.userData.baseOpacity = 0.55;
      ctx.add(hexFill);
      const hexEdge = ctx.line(flatHexagon(ic.x, ic.y, C), { colour: "#bfeaff", opacity: 0.95, additive: false });
      /* Jet dots along the hexagon, slower winds outside, the polar vortex. */
      const J = 260;
      const jet = ctx.cloud(J, { size: 2.6 });
      for (let i = 0; i < J; i += 1) jet.tint(i, i % 3 ? "#e6f6ff" : "#9fd8ff");
      const O = 220;
      const outer = ctx.cloud(O, { size: 2 });
      const orr = rng(70);
      const outerData = Array.from({ length: O }, () => ({ a: orr() * TAU, r: lerp(C * 1.25, IR * 0.95, orr()) }));
      for (let i = 0; i < O; i += 1) outer.tint(i, "#e8d6a8");
      const V = 260;
      const vortex = ctx.cloud(V, { size: 2.2 });
      const vData = Array.from({ length: V }, () => ({ a: orr() * TAU, r: Math.sqrt(orr()) * C * 0.35 }));
      for (let i = 0; i < V; i += 1) vortex.tint(i, i % 2 ? "#cfe6ff" : "#8fb0d0");
      /* Earth to scale: 12,742 km against a 14,500 km side. */
      const earthR = C * (6371 / HEX_KM);
      const earth = ctx.ball(earthR, { body: "Earth", rim: 0.4, rimColour: "#7fb8ff" });
      earth.position.set(ic.x, ic.y - C * Math.cos(Math.PI / 6) - earthR - 0.006, 0.05);
      const sideLabel = ctx.label(["Each side ≈ 14,500 km"], { at: [ic.x, ic.y + IR + 0.06, 0], height: 0.026, colour: "#bfeaff" });
      const earthLabel = ctx.label(["Earth, to scale"], { at: [ic.x + 0.13, ic.y - IR - 0.03, 0.06], height: 0.022, align: "left" });
      const jetLabel = ctx.label(["A jet stream", "about 100 m/s"], { at: [ic.x - 0.13, ic.y - IR - 0.05, 0], height: 0.022, align: "right" });
      const pointer = ctx.line([poleRoot, [ic.x - IR, ic.y + 0.02, 0]], { colour: "#d8c49a", opacity: 0.35, dashed: true });

      ctx.tell([
        { at: 0, label: "The north pole", text: "Saturn seen from above its north pole, rings and all." },
        { at: 0.18, label: "Six straight sides", text: "Around the pole runs a hexagon: a jet stream with six straight sides, seen since Voyager in 1980–81." },
        { at: 0.45, label: "Wider than Earth", text: "Each side is about 14,500 km — longer than Earth is wide." },
        { at: 0.7, label: "Why six", text: "Where winds of different speeds meet, the boundary buckles into a stable wave — and here the wave has six crests." },
      ]);

      /* Points along the closed hexagon perimeter. */
      const hexPts = flatHexagon(ic.x, ic.y, C, 0, 40);
      return {
        duration: 20,
        update(p) {
          /* The pattern turns with the planet; spun slowly here. */
          const turn = lerp(0, 0.5, p);
          s.ball.rotation.y = turn;
          ctx.setLine(hexOnGlobe, polarHexagon(R * 1.004, SATURN_R_KM, HEX_KM, -turn));
          const traced = smooth(p, 0.18, 0.36);
          ctx.fade(hexOnGlobe, traced);
          const show = smooth(p, 0.16, 0.24);
          [back, rim, hexFill, pointer].forEach((o) => ctx.fade(o, show));
          const n = Math.max(2, Math.floor(hexPts.length * traced));
          ctx.setLine(hexEdge, hexPts.slice(0, n));
          ctx.fade(hexEdge, show);
          const flow = p * 3;
          for (let i = 0; i < J; i += 1) {
            const f = ((i / J) + flow * 0.12) % 1;
            const v = hexPts[Math.floor(f * (hexPts.length - 1))];
            const wob = ((i * 7919) % 13) / 13 - 0.5;
            jet.set(i, v.x + wob * 0.012, v.y + wob * 0.012, 0.012);
            jet.alpha[i] = 0.9;
          }
          jet.commit();
          jet.opacity = show * traced;
          for (let i = 0; i < O; i += 1) {
            const d = outerData[i];
            const a = d.a + flow * 0.25 * (C / d.r);
            outer.set(i, ic.x + Math.cos(a) * d.r, ic.y + Math.sin(a) * d.r, 0.011);
            outer.alpha[i] = 0.5;
          }
          outer.commit();
          outer.opacity = show * smooth(p, 0.7, 0.76) + show * 0.4 * (1 - smooth(p, 0.7, 0.76));
          for (let i = 0; i < V; i += 1) {
            const d = vData[i];
            const a = d.a + flow * (1.2 - d.r / C);
            vortex.set(i, ic.x + Math.cos(a) * d.r, ic.y + Math.sin(a) * d.r, 0.011);
            vortex.alpha[i] = 0.7;
          }
          vortex.commit();
          vortex.opacity = show;
          const e = smooth(p, 0.45, 0.52);
          ctx.fade(earth, e);
          earth.rotation.y = ctx.t * 0.3;
          ctx.fade(earthLabel, e);
          ctx.fade(sideLabel, smooth(p, 0.36, 0.42));
          ctx.fade(jetLabel, smooth(p, 0.62, 0.68));
          ctx.fade(poleLabel, 1 - smooth(p, 0.15, 0.2));
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
    accuracy: "The tilt follows a smooth curve through the real dates (most open in October 2017, edge-on in March 2025). Earth's own motion makes the real crossings wobble — sometimes three in a row — and that is left out. The small orbit diagram is not to scale.",
    art: { main: "saturn", fx: "edgeon" },
    scene(ctx) {
      ctx.light.set(-0.15, 0.25, 0.95).normalize();
      /* layout */
      const R = 0.24;
      const s = saturn(ctx, R);
      s.group.position.set(0.22, 0.1, 0);
      const edge = ctx.line([[-R * RING_OUT, 0, 0], [R * RING_OUT, 0, 0]], { colour: "#e8dcc0", opacity: 0.6, parent: s.group, additive: false });
      const clock = ctx.label(["", ""], { at: [0.22, -0.32, 0], height: 0.036 });
      /* Orbit diagram, upper left: Saturn round the Sun, the ring plane
       * fixed in space; crossings at the two nodes. */
      const oc = new THREE.Vector3(-0.72, 0.44, 0);
      const OR = 0.24;
      const sun = ctx.sun(0.035, { halo: 3, haloOpacity: 0.4 });
      sun.position.copy(oc);
      ctx.circle(OR, { plane: "xy", colour: "#e3cf9b", opacity: 0.35 }).position.copy(oc);
      ctx.line([[oc.x - OR - 0.06, oc.y, 0], [oc.x + OR + 0.06, oc.y, 0]], { colour: "#9fb3c8", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.015 });
      const dot = ctx.ball(0.022, { body: "Saturn" });
      ctx.label(["2025"], { at: [oc.x + OR + 0.1, oc.y + 0.04, 0], height: 0.022, align: "left" });
      ctx.label(["2009", "2038–39"], { at: [oc.x - OR - 0.1, oc.y + 0.05, 0], height: 0.022, align: "right" });
      ctx.label(["Saturn's 29.5-year orbit", "edge-on at the dashed line"], { at: [oc.x, oc.y - OR - 0.1, 0], height: 0.02 });
      const thin = ctx.label(["About 10 m thick, 270,000 km wide", "like a sheet of paper almost 3 km across"], { at: [0.22, -0.56, 0], height: 0.024, colour: "#ffd27f" });

      ctx.tell([
        { at: 0, label: "Wide open", text: "Saturn from Earth in 2017: the rings tipped 27° toward us, as open as they get." },
        { at: 0.22, label: "Closing", text: "As Saturn moves along its orbit, our view swings toward the plane of the rings." },
        { at: 0.47, label: "March 23, 2025", text: "Edge-on: the rings, only about ten metres thick, nearly vanish." },
        { at: 0.62, label: "The other face", text: "Then they open again, showing their southern face. Next edge-on: 2038–39." },
      ]);

      /* Ring opening from Earth, degrees: ±26.7 · sin(2π(year − 2025.22)
       * / 29.457), zero on 2025 Mar 23, largest Oct 2017 (drawing choice:
       * a smooth fit through those dates). */
      const tilt = (year) => -26.7 * Math.sin((TAU * (year - 2025.22)) / 29.457);
      return {
        duration: 20,
        update(p) {
          /* Years 2017.9 → 2032.6, lingering near the crossing. */
          const u = lerp(-1, 1, span(p, 0.04, 0.96));
          const year = 2025.22 + 7.36 * Math.sign(u) * Math.abs(u) ** 1.7;
          const B = tilt(year);
          s.group.rotation.x = B * D2R;
          s.ball.rotation.y = ctx.t * 0.3;
          ctx.fade(edge, 1 - smooth(Math.abs(B), 0.3, 2.5));
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const m = Math.floor((year % 1) * 12);
          clock.userData.draw([Math.abs(year - 2025.22) < 0.05 ? "March 23, 2025" : `${months[m]} ${Math.floor(year)}`,
            Math.abs(B) < 0.3 ? "edge-on: the rings vanish" : `rings open ${Math.abs(B).toFixed(1)}° — ${B > 0 ? "north" : "south"} face`]);
          ctx.fade(clock, smooth(p, 0.02, 0.06));
          const a = (TAU * (year - 2025.22)) / 29.457;
          dot.position.set(oc.x + Math.cos(a) * OR, oc.y + Math.sin(a) * OR, 0.01);
          ctx.fade(thin, smooth(p, 0.8, 0.86));
        },
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
    accuracy: "Saturn and its rings to scale with each other. The field is drawn as a simple dipole lined up with the spin axis (Saturn's really is very nearly aligned). The grains are hugely enlarged, and the fading of the rings is a sketch of a long, uncertain future.",
    art: { main: "saturn", fx: "rain" },
    scene(ctx) {
      ctx.light.set(-0.35, 0.35, 0.87).normalize();
      /* layout */
      const R = 0.36;
      const s = saturn(ctx, R);
      s.group.position.set(-0.15, -0.02, 0);
      s.group.rotation.x = 0.22;
      /* Field lines from the inner rings (L = 1.35–2.0 Saturn radii) to
       * mid-latitudes, on both limbs. Foot latitude: cos²λ = 1/L, so
       * 31°–45° (dipole). */
      const SHELLS = [1.35, 1.6, 1.8, 2.0];
      const lines = [];
      [0, Math.PI].forEach((az) => SHELLS.forEach((L) => {
        const pts = dipoleLine(R, L, az);
        ctx.line(pts, { colour: "#7fb8ff", opacity: 0.22, parent: s.group });
        lines.push(pts);
      }));
      /* Where it lands: mid-latitude bands. */
      const bands = new THREE.Group();
      s.group.add(bands);
      [1.35, 2.0].forEach((L) => {
        const lat = Math.acos(Math.sqrt(1 / L));
        [1, -1].forEach((sgn) => {
          const c = ctx.circle(R * Math.cos(lat) * 1.004, { plane: "xz", parent: bands, colour: "#bfe6ff", opacity: 0.5 });
          c.position.y = sgn * R * Math.sin(lat) * 1.004;
        });
      });
      /* Grains: each on a field line, sliding from the ring plane to a foot. */
      const N = 420;
      const grains = ctx.cloud(N, { parent: s.group, size: 4 });
      const gr = rng(72);
      const gd = Array.from({ length: N }, () => ({ line: Math.floor(gr() * lines.length), up: gr() < 0.5, off: gr(), sp: 0.6 + gr() * 0.6 }));
      for (let i = 0; i < N; i += 1) grains.tint(i, i % 3 ? "#dff2ff" : "#9fd8ff");
      /* The Grand Finale: material falling straight in near the equator. */
      const M = 160;
      const inflow = ctx.cloud(M, { parent: s.group, size: 3.4 });
      const md = Array.from({ length: M }, () => ({ a: gr() * TAU, off: gr(), dy: (gr() - 0.5) * 0.02 }));
      for (let i = 0; i < M; i += 1) inflow.tint(i, "#ffe6b0");

      const label = ctx.label(["Charged ice grains", "follow the magnetic field down"], { at: [0.62, 0.42, 0], height: 0.024, colour: "#bfe6ff" });
      const finale = ctx.label(["Cassini's Grand Finale, 2017", "more falling in at the equator"], { at: [0.62, -0.42, 0], height: 0.024, colour: "#ffe6b0" });
      const pool = ctx.label(["≈ an Olympic pool of water", "every half hour (NASA, 2018)"], { at: [-0.15, 0.62, 0], height: 0.026 });
      const clock = ctx.label(["", ""], { at: [-0.15, -0.66, 0], height: 0.034 });

      ctx.tell([
        { at: 0, label: "The rings", text: "Saturn's rings: countless pieces of ice, from dust grains to boulders." },
        { at: 0.16, label: "Charged", text: "Tiny grains pick up an electric charge — and then Saturn's magnetic field steers them, down into the atmosphere." },
        { at: 0.5, label: "Cassini's dives", text: "In 2017 Cassini flew between the rings and the planet and measured this ring rain — and more pouring in at the equator." },
        { at: 0.76, label: "Not forever", text: "At this rate the rings may be mostly gone in a few hundred million years. We may be living at the best time to see them." },
      ]);

      return {
        duration: 20,
        update(p) {
          s.ball.rotation.y = ctx.t * 0.25;
          const rain = smooth(p, 0.16, 0.26);
          for (let i = 0; i < N; i += 1) {
            const d = gd[i];
            const pts = lines[d.line];
            const f = (d.off + p * 2.2 * d.sp) % 1;
            const sPos = d.up ? 0.5 - f * 0.5 : 0.5 + f * 0.5;
            const v = along(pts, sPos);
            grains.set(i, v.x, v.y, v.z);
            grains.alpha[i] = rain * Math.sin(Math.min(1, f * 1.15) * Math.PI) * 0.9 + rain * 0.1;
          }
          grains.commit();
          const fin = smooth(p, 0.5, 0.58);
          for (let i = 0; i < M; i += 1) {
            const d = md[i];
            const f = (d.off + p * 2.5) % 1;
            const r = lerp(R * RING_IN, R * 1.0, f);
            const a = d.a + f * 1.2;
            inflow.set(i, Math.cos(a) * r, d.dy * (1 - f), -Math.sin(a) * r);
            inflow.alpha[i] = fin * (1 - f * 0.6);
          }
          inflow.commit();
          ctx.fade(bands, rain * 0.9);
          ctx.fade(label, win(p, 0.18, 0.74));
          ctx.fade(finale, win(p, 0.52, 0.74));
          ctx.fade(pool, smooth(p, 0.34, 0.4) * (1 - smooth(p, 0.74, 0.78)));
          /* The future: rings thin out over 0.78–0.94. */
          const future = smooth(p, 0.78, 0.94);
          ctx.fade(s.rings, 1 - 0.78 * future);
          clock.userData.draw([`+${fmt(300 * future)} million years`, future > 0.95 ? "the rings mostly gone?" : ""]);
          ctx.fade(clock, smooth(p, 0.76, 0.8));
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
    accuracy: "A diagram, seen in the moonlet's own frame. The ring particles are drawn far larger and sparser than the real ones, which range from grains to boulders; the gaps are a simplified model of the real shape.",
    art: { main: "saturn", fx: "ring" },
    scene(ctx) {
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
    accuracy: "A flattened strip of the ring, seen in its own frame. Radial distances are stretched about 2.5 times and the moons enlarged about 9 times; the streamer shapes are a simplified model.",
    art: { main: "saturn", fx: "ring" },
    scene(ctx) {
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
    accuracy: "Titan's globe is drawn as radar and infrared reveal it, with the haze thinned so the north polar seas show; their outlines are simplified. The landscape is an illustration, not a real view.",
    art: { main: "titan", fx: "rain" },
    scene(ctx) {
      ctx.light.set(-0.3, 0.5, 0.8).normalize();
      /* layout */
      const tc = new THREE.Vector3(-0.62, 0.24, 0);
      const TR = 0.36;
      const holder = new THREE.Group();
      holder.position.copy(tc);
      holder.rotation.x = 0.75; /* north pole toward us */
      ctx.add(holder);
      const titan = ctx.ball(TR, { colour: "#b98a4a", parent: holder, night: 0.08 });
      const globe = new THREE.Group();
      titan.add(globe);
      /* Dark dune fields along the equator, bright uplands (drawing choice). */
      const dr = rng(75);
      for (let i = 0; i < 14; i += 1) spherePatch(ctx, TR * 1.002, (dr() - 0.5) * 50, dr() * 360, 8 + dr() * 14, { colour: "#6e4f2e", opacity: 0.55, parent: globe, seed: 100 + i, squash: 0.5 });
      /* Seas, approximate centres (USGS/IAU names; west longitude → east
       * negative): Kraken Mare 68° N 310° W, Ligeia Mare 79° N 248° W,
       * Punga Mare 85° N 339° W. */
      const SEAS = [
        { name: "Kraken Mare", lat: 68, lon: 50, size: 11, seed: 3 },
        { name: "Ligeia Mare", lat: 79, lon: 112, size: 6, seed: 4 },
        { name: "Punga Mare", lat: 85, lon: 21, size: 3.5, seed: 5 },
      ];
      const seas = SEAS.map((s) => spherePatch(ctx, TR * 1.003, s.lat, s.lon, s.size, { colour: "#14202e", opacity: 0.92, parent: globe, seed: s.seed }));
      for (let i = 0; i < 12; i += 1) spherePatch(ctx, TR * 1.003, 70 + dr() * 18, dr() * 360, 1 + dr() * 1.8, { colour: "#1b2a3a", opacity: 0.85, parent: globe, seed: 200 + i });
      titan.rotation.y = -70 * D2R;
      /* The haze: a soft orange shell and glow. */
      const haze = ctx.ball(TR * 1.08, { colour: "#e0a050", parent: holder, opacity: 0.32, transparent: true, depthWrite: false, rim: 1.2, rimColour: "#ffb860" });
      haze.userData.baseOpacity = 0.32;
      const hazeGlow = ctx.glow("#ff9a3c", TR * 3.2, { opacity: 0.35 });
      hazeGlow.position.copy(tc).setZ(-0.1);
      const lKraken = ctx.label(["Kraken Mare"], { height: 0.022, colour: "#cfe6ff" });
      const lLigeia = ctx.label(["Ligeia Mare"], { height: 0.022, colour: "#cfe6ff" });
      const lTitan = ctx.label(["Titan", "−179 °C at the surface"], { at: [tc.x, tc.y - TR - 0.12, 0], height: 0.026 });

      /* The landscape, lower right. */
      const X0 = -0.12;
      const X1 = 1.05;
      const Y0 = -0.78;
      const Y1 = 0.02;
      const SKY = ["#5a2c10", "#7a3e14", "#9a561c", "#b56f2a", "#c9883c", "#d59e52"];
      SKY.forEach((c, i) => {
        const y0 = lerp(Y1, -0.42, i / SKY.length);
        const y1 = lerp(Y1, -0.42, (i + 1) / SKY.length);
        ctx.shape([[X0, y1], [X1, y1], [X1, y0], [X0, y0]], { colour: c, opacity: 0.95 });
      });
      const ground = [[X0, Y0], [X0, -0.3], [X0 + 0.12, -0.24], [X0 + 0.26, -0.33], [X0 + 0.4, -0.38], [X0 + 0.55, -0.48], [X0 + 0.62, -0.52], [X1, -0.52], [X1, Y0]];
      ctx.shape(ground, { colour: "#3a2a1c", opacity: 1 });
      const lake = ctx.shape([[X0 + 0.6, -0.53], [X1, -0.53], [X1, Y0 + 0.02], [X0 + 0.5, Y0 + 0.02], [X0 + 0.48, -0.66]], { colour: "#0e1620", opacity: 1 });
      lake.position.z = 0.002;
      const shine = ctx.line([[X0 + 0.66, -0.6, 0.01], [X1 - 0.05, -0.6, 0.01]], { colour: "#ffb860", opacity: 0.35 });
      /* A river carved down the slope into the lake. */
      const RIVER = [[X0 + 0.05, -0.27], [X0 + 0.13, -0.3], [X0 + 0.2, -0.36], [X0 + 0.28, -0.4], [X0 + 0.34, -0.47], [X0 + 0.42, -0.5], [X0 + 0.48, -0.56], [X0 + 0.55, -0.6]].map(([x, y]) => new THREE.Vector3(x, y, 0.01));
      const river = ctx.line(RIVER.slice(0, 2), { colour: "#26445e", opacity: 1, additive: false });
      const river2 = ctx.line(RIVER.slice(0, 2), { colour: "#26445e", opacity: 1, additive: false });
      const clouds = [0.12, 0.38, 0.66, 0.9].map((fx, i) => {
        const g = ctx.glow("#f6e2c2", 0.26 - i * 0.015, { opacity: 0, additive: false });
        g.position.set(lerp(X0 + 0.08, X1 - 0.08, fx), -0.1 - (i % 2) * 0.04, 0.01);
        return g;
      });
      const R_N = 420;
      const rain = ctx.cloud(R_N, { size: 2.6 });
      const rr = rng(750);
      const rd = Array.from({ length: R_N }, () => ({ x: lerp(X0 + 0.02, X1 - 0.02, rr()), off: rr(), sp: 0.7 + rr() * 0.5 }));
      for (let i = 0; i < R_N; i += 1) rain.tint(i, "#ffe8c8");
      const lRain = ctx.label(["Methane rain", "big drops, falling slowly"], { at: [0.8, -0.18, 0.02], height: 0.022, colour: "#fff0dc" });
      const lSea = ctx.label(["A sea of methane", "and ethane"], { at: [0.74, -0.66, 0.02], height: 0.022, colour: "#cfe6ff" });
      const lRiver = ctx.label(["Rivers"], { at: [X0 + 0.2, -0.46, 0.02], height: 0.022, colour: "#cfe6ff" });

      ctx.tell([
        { at: 0, label: "Titan", text: "Saturn's largest moon, under a thick orange haze. At −179 °C, water is rock-hard ice." },
        { at: 0.2, label: "Methane rain", text: "But methane — a gas on Earth — is liquid here. It forms clouds and falls as rain." },
        { at: 0.45, label: "Rivers", text: "The rain runs off the hills and carves river channels, just as water does on Earth." },
        { at: 0.68, label: "Lakes and seas", text: "It collects in lakes and seas near the poles: Kraken Mare, Ligeia Mare. Titan is the only other world with liquid on its surface." },
      ]);

      const scratch = new THREE.Vector3();
      const place = (lbl, sea, dy) => {
        scratch.copy(sph(TR, sea.lat, sea.lon)).applyEuler(titan.rotation).applyEuler(holder.rotation).add(holder.position);
        lbl.position.set(scratch.x, scratch.y + dy, 0.4);
      };
      return {
        duration: 20,
        update(p) {
          titan.rotation.y = -70 * D2R + lerp(-0.25, 0.25, p);
          /* The haze thins so the seas show. */
          const clear = smooth(p, 0.6, 0.72);
          ctx.fade(haze, 1 - 0.65 * clear);
          seas.forEach((s) => ctx.fade(s, 0.5 + 0.5 * clear));
          place(lKraken, SEAS[0], -0.06);
          place(lLigeia, SEAS[1], 0.05);
          ctx.fade(lKraken, smooth(p, 0.7, 0.76));
          ctx.fade(lLigeia, smooth(p, 0.72, 0.78));
          ctx.fade(lTitan, smooth(p, 0, 0.05));
          /* Weather in the landscape. */
          const storm = win(p, 0.18, 0.66, 0.06);
          clouds.forEach((c, i) => { c.material.opacity = 0.55 * storm; c.position.x += Math.sin(ctx.t * 0.2 + i) * 0.0002; });
          for (let i = 0; i < R_N; i += 1) {
            const d = rd[i];
            const f = (d.off + p * 3.2 * d.sp) % 1;
            const y = lerp(-0.06, -0.66, f);
            const ground = d.x < X0 + 0.55 ? -0.3 - (d.x - X0) * 0.4 : -0.55;
            rain.set(i, d.x + f * 0.03, y, 0.015);
            rain.alpha[i] = y > ground ? storm * 0.8 : 0;
          }
          rain.commit();
          const carve = smooth(p, 0.42, 0.6);
          const n = Math.max(2, Math.floor(RIVER.length * carve));
          ctx.setLine(river, RIVER.slice(0, n));
          ctx.setLine(river2, RIVER.slice(0, n).map((v) => v.clone().add(new THREE.Vector3(0.004, -0.004, 0))));
          ctx.fade(river, carve > 0.05 ? 1 : 0);
          ctx.fade(river2, carve > 0.05 ? 1 : 0);
          lake.scale.y = 1;
          ctx.fade(shine, 0.35 + 0.2 * Math.sin(ctx.t * 1.5));
          ctx.fade(lRain, storm);
          ctx.fade(lRiver, smooth(p, 0.5, 0.56));
          ctx.fade(lSea, smooth(p, 0.62, 0.68));
        },
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
    accuracy: "The spin is calculated with the classic flat model of Hyperion's tumble (Wisdom, Peale and Mignard, 1984), in which the long axis turns in the orbit plane; the real tumble is fully three-dimensional. The orbit diagram is not to scale; Hyperion's shape is a rough model.",
    art: { main: "rock", fx: "wobble" },
    scene(ctx) {
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
    accuracy: "Iapetus's two-tone pattern and the ridge's place are drawn from Cassini's maps but simplified; the ridge is drawn taller than its true height to be seen. The dust and the moving ice are diagrams of the process.",
    art: { main: "moon", fx: "phases" },
    scene(ctx) {
      ctx.light.set(-0.25, 0.35, 0.9).normalize();
      /* layout */
      const R = 0.46;
      const ic = new THREE.Vector3(0.0, 0.04, 0);
      const holder = new THREE.Group();
      holder.position.copy(ic);
      holder.rotation.x = 0.12;
      ctx.add(holder);
      /* The map: painted on a canvas, redrawn as the contrast grows. The
       * dark region is centred on the leading side (map lon 0 here). */
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const g2 = canvas.getContext("2d");
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const nr = rng(77);
      const craters = Array.from({ length: 160 }, () => ({ x: nr() * 512, y: 30 + nr() * 196, r: 2 + nr() * 9 }));
      let painted = -1;
      const paint = (c) => {
        const level = Math.round(c * 20) / 20;
        if (level === painted) return;
        painted = level;
        const dark = new THREE.Color("#8a8276").lerp(new THREE.Color("#2a1d14"), level);
        const bright = new THREE.Color("#8a8276").lerp(new THREE.Color("#ece7dc"), level);
        g2.fillStyle = `#${bright.getHexString()}`;
        g2.fillRect(0, 0, 512, 256);
        /* sph lon L sits at canvas x = (L + 90)/360 · 512 (three's sphere
         * starts its u at −x). Dark region: lon −95…95, narrowing toward
         * the poles, with a ragged edge. */
        g2.fillStyle = `#${dark.getHexString()}`;
        g2.beginPath();
        for (let i = 0; i <= 64; i += 1) {
          const lat = lerp(-58, 58, i / 64);
          const half = 95 * Math.sqrt(Math.max(0, 1 - (lat / 62) ** 2)) + 7 * Math.sin(lat * D2R * 4);
          const x = ((-half + 90) / 360) * 512;
          const y = ((90 - lat) / 180) * 256;
          if (i === 0) g2.moveTo(x, y); else g2.lineTo(x, y);
        }
        for (let i = 64; i >= 0; i -= 1) {
          const lat = lerp(-58, 58, i / 64);
          const half = 95 * Math.sqrt(Math.max(0, 1 - (lat / 62) ** 2)) + 7 * Math.cos(lat * D2R * 3);
          g2.lineTo(((half + 90) / 360) * 512, ((90 - lat) / 180) * 256);
        }
        g2.closePath();
        g2.fill();
        craters.forEach((cr) => {
          g2.fillStyle = "rgba(0,0,0,0.07)";
          g2.beginPath();
          g2.arc(cr.x, cr.y, cr.r, 0, TAU);
          g2.fill();
        });
        texture.needsUpdate = true;
      };
      paint(0.35);
      const globe = ctx.ball(R, { map: texture, colour: "#ffffff", parent: holder, rim: 0.2, rimColour: "#e8f1ff" });
      /* The ridge: 110° of the equator across the dark side (drawn about
       * four times its true 20 km height). */
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.02, 8, 96, 110 * D2R), ctx.material({ colour: "#c8b8a2", night: 0.06 }));
      ridge.rotation.x = Math.PI / 2;
      ridge.rotation.z = 35 * D2R; /* arc spans map lon −55…55 */
      ridge.raycast = () => {};
      ridge.renderOrder = 20;
      globe.add(ridge);

      /* Dust from the left, sweeping onto the leading face. */
      const DN = 360;
      const dust = ctx.cloud(DN, { size: 3.6 });
      const dd = Array.from({ length: DN }, () => ({ y: (nr() - 0.5) * 1.6 * R, z: (nr() - 0.5) * 1.6 * R, off: nr() }));
      for (let i = 0; i < DN; i += 1) dust.tint(i, "#d09a68");
      /* Ice vapour: from the dark side over to the bright side. */
      const VN = 140;
      const vapour = ctx.cloud(VN, { size: 4.2 });
      const vd = Array.from({ length: VN }, () => ({ lat: (nr() - 0.5) * 100, off: nr(), h: 0.15 + nr() * 0.25 }));
      for (let i = 0; i < VN; i += 1) vapour.tint(i, "#dff2ff");
      const lDark = ctx.label(["Leading side", "dark as coal"], { at: [ic.x - R - 0.2, ic.y + 0.34, 0], height: 0.026 });
      const lBright = ctx.label(["Trailing side", "bright as snow"], { at: [ic.x + R + 0.22, ic.y + 0.34, 0], height: 0.026 });
      const lDust = ctx.label(["Dust from the Phoebe ring"], { at: [-0.78, -0.42, 0], height: 0.022, colour: "#e0b890" });
      const lIce = ctx.label(["Darkened ice warms and evaporates,", "refreezing on the bright side"], { at: [ic.x, ic.y + R + 0.14, 0], height: 0.022, colour: "#dff2ff" });
      const lRidge = ctx.label(["Equatorial ridge", "up to about 20 km high"], { at: [ic.x, ic.y - R - 0.12, 0], height: 0.024 });
      const motion = ctx.arrow([ic.x - R - 0.08, ic.y - 0.56, 0], [ic.x - R - 0.36, ic.y - 0.56, 0], { colour: "#9fd0ff", head: 0.04 });
      const lMotion = ctx.label(["direction of orbit"], { at: [ic.x - R - 0.22, ic.y - 0.62, 0], height: 0.02, colour: "#bfe0ff" });

      ctx.tell([
        { at: 0, label: "Two faces", text: "Iapetus, one of Saturn's moons. The side that leads as it orbits is as dark as coal…" },
        { at: 0.12, label: "…and snow", text: "…and the other side is as bright as snow." },
        { at: 0.3, label: "Dark dust", text: "Leading the way, Iapetus sweeps up dark dust spiralling in from far out, from the faint ring of the moon Phoebe." },
        { at: 0.56, label: "A runaway", text: "Dark ice warms in sunlight and evaporates, refreezing on the cold, bright side. Dark gets darker; bright gets brighter." },
        { at: 0.84, label: "The ridge", text: "And around its equator runs a ridge up to 20 km high — how it formed is still debated." },
      ]);

      return {
        duration: 20,
        update(p) {
          /* Turn: dark face → bright face (0–0.2), then a half-and-half view
           * with the dark side to the left (0.24–1). */
          const showBright = easeInOut(span(p, 0.08, 0.2));
          const half = easeInOut(span(p, 0.22, 0.3));
          /* Rotation 0: dark centre faces us; π: bright; 3π/2: dark to the left. */
          globe.rotation.y = p < 0.22 ? Math.PI * showBright : Math.PI + (Math.PI / 2) * half + 0.9 * easeInOut(span(p, 0.84, 0.94));
          paint(lerp(0.45, 1, smooth(p, 0.3, 0.85)));
          ctx.fade(lDark, win(p, 0.0, 0.14) + smooth(p, 0.28, 0.34));
          ctx.fade(lBright, win(p, 0.12, 0.24) + smooth(p, 0.28, 0.34));
          /* Dust: 0.3–0.6, moving +x until it hits the sphere. */
          const dOn = win(p, 0.28, 0.62, 0.04);
          for (let i = 0; i < DN; i += 1) {
            const d = dd[i];
            const f = (d.off + p * 3) % 1;
            const x = lerp(-1.1, ic.x, f);
            const inside = d.y * d.y + d.z * d.z < R * R;
            const hitX = inside ? ic.x - Math.sqrt(R * R - d.y * d.y - d.z * d.z) : 99;
            dust.set(i, x, ic.y + d.y, d.z);
            dust.alpha[i] = x < hitX && Math.abs(d.y) < R * 0.95 ? dOn * 0.8 : 0;
          }
          dust.commit();
          ctx.fade(lDust, dOn);
          ctx.fade(motion, smooth(p, 0.3, 0.36));
          ctx.fade(lMotion, smooth(p, 0.3, 0.36));
          /* Vapour arcs from the dark (left) hemisphere to the bright one. */
          const vOn = win(p, 0.56, 0.86, 0.05);
          for (let i = 0; i < VN; i += 1) {
            const d = vd[i];
            const f = (d.off + p * 2.4) % 1;
            const lon = lerp(-80, 80, f) * D2R;
            const lat = d.lat * D2R;
            const r = R * (1.02 + d.h * Math.sin(f * Math.PI));
            vapour.set(i, ic.x + r * Math.cos(lat) * Math.sin(lon), ic.y + r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
            vapour.alpha[i] = vOn * Math.sin(f * Math.PI);
          }
          vapour.commit();
          ctx.fade(lIce, vOn);
          ctx.fade(lRidge, smooth(p, 0.84, 0.9));
          ctx.fade(ridge, 0.6 + 0.4 * smooth(p, 0.84, 0.9));
        },
      };
    },
  }),
];

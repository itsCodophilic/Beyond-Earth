import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";

/**
 * Section 4 of the catalogue: Mercury, Venus and Mars (round 79).
 *
 * Transits, a Sun that rises twice, winds that outrun a planet, a volcano
 * caught changing, and Mars from Earth (opposition, the backwards loop) and
 * from its own ground (blue sunsets, dust devils, spring geysers, polar
 * avalanches), ending with Phobos's slow fall.
 *
 * Every event is a hud diorama (body: null). Orbital positions for Earth
 * and Mars are computed from J2000 mean elements, so the dates on screen
 * are the dates the sky gives; sizes and distances are NASA's planetary
 * fact sheets unless a comment says otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/* Julian date of J2000.0 (IAU). */
const J2000 = 2451545.0;

/** Julian date to "Jan 16, 2025" (Meeus, Astronomical Algorithms, ch. 7). */
function calendar(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = Math.floor(b - d - Math.floor(30.6001 * e) + f);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** Kepler's equation M = E - e sin E, by Newton's method. */
function eccentricAnomaly(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}
function trueAnomaly(M, e) {
  const E = eccentricAnomaly(M, e);
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

/*
 * J2000 mean elements and their rates per Julian century (Standish, JPL
 * "Approximate Positions of the Planets", table 1, valid 1800–2050):
 * mean longitude L, longitude of perihelion w, semi-major axis a (AU),
 * eccentricity e, inclination i, ascending node.
 */
const EARTH = { L: 100.46457166, rate: 35999.37244981, w: 102.93768193, a: 1.00000261, e: 0.01671123, i: 0, node: 0 };
const MARS = { L: -4.55343205, rate: 19140.30268499, w: -23.94362959, a: 1.52371034, e: 0.0933941, i: 1.84969142, node: 49.55953891 };

/** Heliocentric ecliptic position (AU) of a planet at Julian date jd. */
function heliocentric(el, jd, out = new THREE.Vector3()) {
  const T = (jd - J2000) / 36525;
  const M = (el.L + el.rate * T - el.w) * DEG;
  const E = eccentricAnomaly(M, el.e);
  const v = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const r = el.a * (1 - el.e * Math.cos(E));
  const u = v + (el.w - el.node) * DEG;
  const node = el.node * DEG;
  const inc = el.i * DEG;
  return out.set(
    r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc)),
    r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc)),
    r * Math.sin(u) * Math.sin(inc),
  );
}

/** A flat panel (MeshBasicMaterial) facing the viewer. */
function panel(ctx, w, h, { colour = "#ffffff", map = null, opacity = 1, order = 19, segments = [1, 1], vertexColors = false, parent = ctx.root } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h, segments[0], segments[1]),
    new THREE.MeshBasicMaterial({ color: colour, map, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false, vertexColors }),
  );
  mesh.renderOrder = order;
  mesh.userData.baseOpacity = opacity;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

/** A canvas texture painted once. */
function paint(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A filled polygon from [[x, y], ...] drawn in front (ground silhouettes). */
function solid(ctx, points, { colour = "#000000", order = 29, z = 0, opacity = 1, depthTest = true, parent = ctx.root } = {}) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, depthWrite: false, depthTest, side: THREE.DoubleSide, toneMapped: false, fog: false,
  }));
  mesh.position.z = z;
  mesh.renderOrder = order;
  mesh.userData.baseOpacity = opacity;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

/**
 * Marks drawn on the face of a sphere (a transit dot, its path) sit at
 * z = 0 and skip the depth test, so they are painted over the sphere by
 * render order. Raising them toward the lens instead would magnify them
 * in perspective and slide them off the disc.
 */
function onTop(object, order = 28) {
  object.traverse((o) => {
    if (o.material) o.material.depthTest = false;
    o.renderOrder = order;
  });
  return object;
}

/** Hours and minutes from minutes past midnight: "15:20". */
const clockTime = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/* Mars mean radius 3,389.5 km (NASA fact sheet). */
const MARS_RADIUS = 3389.5;
/* Kilometres per AU (IAU 2012). */
const AU_KM = 149597870.7;

export const INNER_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "transit-mercury",
    section: "inner",
    title: "Transit of Mercury",
    place: "The Sun and Mercury",
    kind: "recurring",
    family: "alignment",
    when: "Last Nov 11, 2019 · next Nov 13, 2032",
    often: "about 13 a century",
    timeline: { last: "November 11, 2019", next: "November 13, 2032" },
    detail: "Mercury crosses the face of the Sun as a tiny black dot, taking a few hours from edge to edge",
    frequency: "About 13 or 14 times a century, always in early May or early November. After November 13, 2032 come November 7, 2039 and May 7, 2049.",
    cause: "Mercury passes between Earth and the Sun every 116 days, but its orbit is tilted 7° to Earth's, so it usually slips just above or below the Sun. It can only cross the disc when that happens near one of the two points where its orbit cuts through Earth's, and Earth lines up with those in May and November.",
    note: "The 2019 transit took about five and a half hours. Mercury is only about 1/194 of the Sun's width, too small to see without a telescope, and the Sun must only ever be watched through a proper solar filter.",
    accuracy: "The path across the Sun is the 2019 one, its distance from the centre to scale; the dot is drawn twice its true size so it shows. The inset is a view from above, with both orbits to scale.",
    art: { main: "sun", second: "mercury", fx: "transit" },
    scene(ctx) {
      /* layout */
      const R = 0.5;
      const C = new THREE.Vector3(0.18, 0.06, 0);
      const sun = ctx.sun(R, { halo: 1.45, haloOpacity: 0.35, granule: 24 });
      sun.position.copy(C);
      /* Nov 11, 2019: Mercury 10.0″ across, the Sun 1,937″ (NASA/Espenak,
       * "Transits of Mercury"): 1/194 of the Sun's width. Drawn ×2
       * (drawing choice) so it is more than a pixel. */
      const dotR = (R / 194) * 2;
      const dot = onTop(ctx.disc(dotR, { colour: "#000000" }));
      const marker = onTop(ctx.circle(0.032, { plane: "xy", colour: "#8fd8ff", opacity: 0.9 }), 29);
      /* Least distance from the Sun's centre 76″ of its 969″ radius
       * (Espenak); the path's tilt on screen is a drawing choice. */
      const miss = (76 / 969) * R;
      const tilt = 0.16;
      const along = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
      const across = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0);
      const mid = C.clone().addScaledVector(across, -miss);
      const half = Math.sqrt(R * R - miss * miss) + dotR;
      const path = ctx.line([mid.clone().addScaledVector(along, -half), mid.clone().addScaledVector(along, half)], { colour: "#3a2000", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.015, additive: false });
      onTop(path, 27);
      const mercuryLabel = ctx.label(["Mercury"], { height: 0.026, colour: "#bfe9ff" });
      const clock = ctx.label(["", ""], { at: [C.x, C.y - R - 0.13, 0], height: 0.036 });

      /* Inset: from above, to scale (0.3 hud units per AU). */
      const inset = new THREE.Group();
      inset.position.set(-0.76, 0.4, 0);
      ctx.add(inset);
      const AU = 0.3;
      ctx.sun(0.022, { halo: 3, haloOpacity: 0.5, parent: inset });
      /* Mercury: a 0.387 AU, e 0.2056, perihelion longitude 77.46°; Earth
       * a 1 AU (Standish J2000). */
      ctx.orbit(0.387 * AU, 0.2056, { plane: "xy", rotate: 77.46 * DEG, colour: "#c9c0b6", opacity: 0.75, parent: inset });
      ctx.circle(AU, { plane: "xy", colour: "#4f7fbf", opacity: 0.55, parent: inset });
      /* Mercury's ascending node 48.33° (J2000): its orbit crosses Earth's
       * plane along this line. */
      const nodeAngle = 48.33 * DEG;
      ctx.line([[-Math.cos(nodeAngle) * 0.34, -Math.sin(nodeAngle) * 0.34, 0], [Math.cos(nodeAngle) * 0.34, Math.sin(nodeAngle) * 0.34, 0]], { colour: "#ffd27f", opacity: 0.7, dashed: true, dash: 0.015, gap: 0.012, parent: inset });
      /* Earth on Nov 11 is at heliocentric longitude ~49° (the Sun appears
       * at 229°, JPL Horizons). */
      const earthAngle = 49 * DEG;
      const earth = ctx.ball(0.022, { body: "Earth", parent: inset });
      earth.position.set(Math.cos(earthAngle) * AU, Math.sin(earthAngle) * AU, 0);
      ctx.line([[0, 0, 0], earth.position.clone()], { colour: "#ffffff", opacity: 0.35, parent: inset });
      const mercury = ctx.ball(0.014, { body: "Mercury", parent: inset });
      const mercuryAt = (angle) => {
        const nu = angle - 77.46 * DEG;
        const r = (0.387 * (1 - 0.2056 ** 2)) / (1 + 0.2056 * Math.cos(nu));
        return new THREE.Vector3(Math.cos(angle) * r * AU, Math.sin(angle) * r * AU, 0);
      };
      const insetTitle = ctx.label(["Seen from above", "dashed: where the orbits cross"], { at: [-0.76, 0.79, 0], height: 0.036 });
      const next = ctx.label(["Next: November 13, 2032", "then Nov 7, 2039 · May 7, 2049"], { at: [-0.72, -0.1, 0], height: 0.04, colour: "#ffe3a8" });
      ctx.light.set(0, 0.2, 1).normalize();

      ctx.tell([
        { at: 0, label: "November 11, 2019", text: "Mercury passes between Earth and the Sun — and this time exactly in line with it." },
        { at: 0.1, label: "A tiny black dot", text: "First contact at 12:35 UT. Mercury is 1/194 of the Sun's width: only a filtered telescope shows it." },
        { at: 0.42, label: "Why so rare", text: "Mercury's orbit is tilted 7°. It crosses the disc only when it passes us near the dashed line — in May or November." },
        { at: 0.7, label: "Next time", text: "About thirteen a century. Last contact came at 18:04 UT. The next transit: November 13, 2032." },
      ]);

      /* Contacts I and IV, 12:35 and 18:04 UT (Espenak). */
      const IN = 12 * 60 + 35;
      const OUT = 18 * 60 + 4;
      return {
        duration: 20,
        update(p) {
          const u = span(p, 0.08, 0.68);
          const pos = mid.clone().addScaledVector(along, lerp(-half, half, u));
          dot.position.copy(pos);
          marker.position.copy(pos);
          marker.scale.setScalar(1 + 0.18 * Math.sin(ctx.t * 4));
          const onDisc = p > 0.07 && p < 0.69;
          ctx.fade(dot, onDisc ? 1 : 0);
          ctx.fade(marker, onDisc ? 1 : 0);
          mercuryLabel.position.set(pos.x, pos.y + 0.07, 0);
          ctx.fade(mercuryLabel, win(p, 0.09, 0.66));
          ctx.fade(path, smooth(p, 0.02, 0.08) * 0.9);
          const minutes = lerp(IN, OUT, u);
          const since = minutes - IN;
          clock.userData.draw([
            `Nov 11, 2019 · ${clockTime(p < 0.08 ? IN - 20 * (1 - span(p, 0, 0.08)) : minutes)} UT`,
            p < 0.08 ? "minutes before first contact" : p > 0.68 ? "transit over: 5 h 29 min" : `${Math.floor(since / 60)} h ${String(Math.round(since % 60)).padStart(2, "0")} min on the disc`,
          ]);
          /* The inset: Mercury closing on conjunction, then holding there. */
          const a = earthAngle - 0.9 * (1 - easeInOut(span(p, 0, 0.3)));
          mercury.position.copy(mercuryAt(a));
          ctx.fade(insetTitle, smooth(p, 0.38, 0.45) * (1 - smooth(p, 0.66, 0.7)));
          ctx.fade(next, smooth(p, 0.7, 0.76));
          sun.rotation.y = ctx.t * 0.03;
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "transit-venus",
    section: "inner",
    title: "Transit of Venus",
    place: "The Sun and Venus",
    kind: "recorded",
    family: "alignment",
    when: "June 5–6, 2012 · next Dec 10–11, 2117",
    often: "pairs, 8 years apart, over a century between",
    timeline: { last: "June 5–6, 2012", next: "December 10–11, 2117" },
    detail: "Venus crossed the Sun as a round black silhouette in 2012; the next crossing is in December 2117",
    frequency: "In pairs eight years apart, the pairs separated by 121.5 and 105.5 years in turn: 1631 and 1639, 1761 and 1769, 1874 and 1882, 2004 and 2012, then 2117 and 2125.",
    cause: "Venus's orbit is tilted 3.4° to Earth's, so at most passes between Earth and the Sun it misses the disc above or below. Only when a pass falls close to where the two orbits cross — in early June or early December — does it cross the Sun's face.",
    note: "In 1761 and 1769 expeditions, James Cook's among them, timed the transit from distant corners of the world. Venus's path shifts a little with the observer's position, and comparing the timings gave the first good measurement of the Sun's distance.",
    accuracy: "Venus's size against the Sun and its path are those of 2012, to scale; the tilt of the path is a drawing choice. The northern and southern paths are separated several times more than in reality.",
    art: { main: "sun", second: "venus", fx: "transit" },
    scene(ctx) {
      /* layout */
      const R = 0.46;
      const C = new THREE.Vector3(0.14, 0.2, 0);
      const sun = ctx.sun(R, { halo: 1.45, haloOpacity: 0.35, granule: 24 });
      sun.position.copy(C);
      /* June 2012: Venus 58″ across, the Sun 1,891″ (NASA/Espenak,
       * "Transits of Venus"): 1/32.6 of its width — drawn to scale. */
      const dotR = R / 32.6;
      const venus = onTop(ctx.disc(dotR, { colour: "#000000" }));
      /* Least distance from centre 554″ of a 946″ radius, Venus passing
       * north of centre (Espenak); tilt a drawing choice. */
      const miss = (554 / 946) * R;
      const tilt = -0.12;
      const along = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0);
      const across = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0);
      const chord = (offset) => {
        const m = C.clone().addScaledVector(across, offset);
        const h = Math.sqrt(Math.max(0, R * R - offset * offset)) + dotR;
        return { m, h };
      };
      const main = chord(miss);
      const pathLine = (c, colour, opacity) => {
        const l = ctx.line([c.m.clone().addScaledVector(along, -c.h), c.m.clone().addScaledVector(along, c.h)], { colour, opacity, dashed: true, dash: 0.02, gap: 0.015, additive: false });
        onTop(l, 27);
        return l;
      };
      const path = pathLine(main, "#3a2000", 0.5);
      /* Parallax: north and south observers' paths, separated ~5× more than
       * the real ~40″ (drawing choice, said in accuracy). */
      const shift = 0.1 * R;
      const north = chord(miss - shift);
      const south = chord(miss + shift);
      const northPath = pathLine(north, "#1a4fa0", 0.85);
      const southPath = pathLine(south, "#a01a3a", 0.85);
      const northLabel = ctx.label(["from far north"], { at: [C.x - R - 0.05, C.y + miss - shift - 0.02, 0], align: "right", height: 0.024, colour: "#9fc4ff" });
      const southLabel = ctx.label(["from far south"], { at: [C.x - R - 0.05, C.y + miss + shift + 0.04, 0], align: "right", height: 0.024, colour: "#ffa0b4" });
      const clock = ctx.label(["", ""], { at: [C.x, C.y - R - 0.12, 0], height: 0.036 });

      /* The pairs (Espenak, "Six Millennium Catalog of Venus Transits"). */
      const PAIRS = [[1631, 1639], [1761, 1769], [1874, 1882], [2004, 2012], [2117, 2125]];
      const timeline = new THREE.Group();
      ctx.add(timeline);
      const x0 = -0.98;
      const x1 = 0.98;
      const yearX = (y) => lerp(x0, x1, (y - 1600) / (2150 - 1600));
      const ty = -0.56;
      ctx.line([[x0, ty, 0], [x1, ty, 0]], { colour: "#9fb3c8", opacity: 0.6, parent: timeline });
      const pairLabels = PAIRS.map(([a, b], i) => {
        [a, b].forEach((y) => ctx.line([[yearX(y), ty - 0.03, 0], [yearX(y), ty + 0.03, 0]], { colour: y === 2012 ? "#ffd27f" : y === 2117 ? "#8fd8ff" : "#e8f1ff", opacity: 0.95, parent: timeline }));
        return ctx.label([`${a} · ${b}`], { at: [yearX((a + b) / 2), ty + (i % 2 ? -0.08 : 0.08), 0], height: 0.026, colour: i === 3 ? "#ffd27f" : i === 4 ? "#8fd8ff" : "#e8f1ff", parent: timeline });
      });
      ctx.fade(timeline, 0);

      ctx.tell([
        { at: 0, label: "June 5–6, 2012", text: "Venus crosses the face of the Sun: a round black silhouette, drawn to scale." },
        { at: 0.18, label: "Six hours forty", text: "First contact 22:09 UT on June 5; last contact 04:49 UT on June 6." },
        { at: 0.46, label: "Measuring the Solar System", text: "Observers far apart see slightly different paths. In 1761 and 1769 expeditions timed them to find the Sun's distance." },
        { at: 0.7, label: "Pairs, a century apart", text: "Transits come in pairs eight years apart, then over a century of none. Next: December 10–11, 2117." },
      ]);

      /* Contacts I and IV: 22:09 UT June 5 to 04:49 UT June 6 (Espenak). */
      const IN = 22 * 60 + 9;
      const OUT = IN + 6 * 60 + 40;
      return {
        duration: 20,
        update(p) {
          const u = span(p, 0.06, 0.66);
          const pos = main.m.clone().addScaledVector(along, lerp(-main.h, main.h, u));
          venus.position.copy(pos);
          ctx.fade(venus, p > 0.05 && p < 0.67 ? 1 : 0);
          ctx.fade(path, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.66, 0.72)));
          const par = win(p, 0.46, 0.7);
          ctx.fade(northPath, par);
          ctx.fade(southPath, par);
          ctx.fade(northLabel, par);
          ctx.fade(southLabel, par);
          const minutes = lerp(IN, OUT, u);
          const day = minutes >= 1440 ? "June 6" : "June 5";
          const since = minutes - IN;
          clock.userData.draw([
            `${day}, 2012 · ${clockTime(p < 0.06 ? IN - 15 * (1 - span(p, 0, 0.06)) : minutes)} UT`,
            p < 0.06 ? "minutes before first contact" : p > 0.66 ? "transit over: 6 h 40 min" : `${Math.floor(since / 60)} h ${String(Math.round(since % 60)).padStart(2, "0")} min on the disc`,
          ]);
          ctx.fade(clock, 1 - smooth(p, 0.86, 0.9) * 0.4);
          const t = smooth(p, 0.7, 0.78);
          ctx.fade(timeline, t);
          pairLabels.forEach((l, i) => ctx.fade(l, smooth(p, 0.7 + i * 0.03, 0.76 + i * 0.03)));
          sun.rotation.y = ctx.t * 0.03;
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "mercury-double-sunrise",
    section: "inner",
    title: "Mercury's double sunrise",
    place: "Mercury",
    kind: "recurring",
    family: "orbit",
    often: "every 2 Mercury years",
    detail: "On parts of Mercury the Sun rises, stops, sinks back below the horizon, then rises again for good",
    frequency: "Near every perihelion, at the two longitudes where the Sun is on the horizon then. A day on Mercury lasts two of its years (176 Earth days), so each of those places sees it once every 176 days.",
    cause: "Mercury spins three times for every two orbits: once in 58.6 days, against an 88-day year. Its orbit is very eccentric, and for about eight days around perihelion its orbital speed around the Sun outruns its spin. While that lasts, the Sun drifts backwards across the sky.",
    note: "Elsewhere on Mercury the same backwards drift makes the Sun stop and loop in the middle of the sky, or set twice. At perihelion the Sun looks more than three times as wide as it does from Earth.",
    accuracy: "Computed from Mercury's real spin, orbit and eccentricity, for an observer on the equator 90° from the hot poles. The Sun's size and its heights are to the same scale — about 0.17 hud units per degree — and the scene is a diagram of that one spot.",
    art: { main: "mercury", second: "sun", fx: "loop" },
    scene(ctx) {
      /* Sidereal rotation 58.646 d, orbit 87.969 d, e 0.2056 (NASA). */
      const ROT = 58.646;
      const YEAR = 87.969;
      const E = 0.2056;
      /* The Sun's hour angle from the horizon, degrees, t days from
       * perihelion: spin minus orbital motion. The offset of -0.6° puts the
       * observer where the Sun half-rises, sinks and rises again (drawing
       * choice within the band of longitudes where it happens). */
      const height = (t) => (TAU * t / ROT - trueAnomaly(TAU * t / YEAR, E)) / DEG - 0.6;
      /* Orbital angular rate, degrees per day: n (1 + e cos v)² / (1 - e²)^1.5. */
      const orbitRate = (t) => {
        const v = trueAnomaly(TAU * t / YEAR, E);
        return (360 / YEAR) * ((1 + E * Math.cos(v)) ** 2) / ((1 - E * E) ** 1.5);
      };
      const spinRate = 360 / ROT;
      /* The Sun's angular radius from Mercury at perihelion: 0.2665° at 1 AU
       * (IAU solar radius) / 0.3075 AU = 0.87°. */
      const SUN_RADIUS_DEG = 0.2665 / 0.3075;

      /* layout */
      const K = 0.17;
      const horizon = -0.22;
      const sunX = -0.4;
      const T0 = -10;
      const T1 = 11;
      const sun = ctx.sun(SUN_RADIUS_DEG * K, { colour: "#fff0cf", hot: "#ffffff", halo: 1.7, haloColour: "#fff2c0", haloOpacity: 0.35, granule: 16 });
      /* The ground: Mercury's cratered horizon, in front of the Sun. */
      const r = rng(5);
      const groundPts = [[-1.08, -0.85]];
      for (let i = 0; i <= 40; i += 1) {
        const x = lerp(-1.08, 0.28, i / 40);
        const bump = 0.012 * Math.sin(i * 1.7) + 0.02 * Math.exp(-(((x + 0.85) / 0.1) ** 2)) + 0.014 * Math.exp(-(((x - 0.05) / 0.12) ** 2)) + r() * 0.004;
        groundPts.push([x, horizon + bump]);
      }
      groundPts.push([0.28, -0.85]);
      solid(ctx, groundPts, { colour: "#2e2b28", depthTest: false });
      onTop(ctx.line(groundPts.slice(1, -1).map(([x, y]) => [x, y, 0]), { colour: "#8a8279", opacity: 0.7, additive: false }), 29);
      /* The Sun's track: straight up from the horizon on the equator. */
      ctx.line([[sunX, horizon, -0.01], [sunX, horizon + 4 * K, -0.01]], { colour: "#ffe3a8", opacity: 0.25, dashed: true, dash: 0.02, gap: 0.02 });
      const status = ctx.label(["", ""], { at: [sunX, 0.62, 0], height: 0.044 });

      /* The graph: the Sun's height against days from perihelion. */
      const gx0 = 0.42;
      const gx1 = 1.02;
      const gy = 0.48;
      const gk = 0.09;
      const gX = (t) => lerp(gx0, gx1, (t - T0) / (T1 - T0));
      const gY = (h) => gy + h * gk;
      ctx.line([[gx0, gY(0), 0], [gx1, gY(0), 0]], { colour: "#9fb3c8", opacity: 0.55, dashed: true, dash: 0.015, gap: 0.012 });
      ctx.line([[gX(0), gY(-2.6), 0], [gX(0), gY(2.6), 0]], { colour: "#ffd27f", opacity: 0.35 });
      ctx.label(["Height of the Sun", "days −10 to +11 from perihelion"], { at: [(gx0 + gx1) / 2, 0.8, 0], height: 0.036 });
      ctx.label(["horizon"], { at: [gx1 + 0.01, gY(0) - 0.03, 0], align: "right", height: 0.02, colour: "#9fb3c8" });
      const curvePts = [];
      for (let i = 0; i <= 220; i += 1) {
        const t = lerp(T0, T1, i / 220);
        curvePts.push(new THREE.Vector3(gX(t), gY(height(t)), 0));
      }
      const curve = ctx.line(curvePts.slice(0, 2), { colour: "#ffe3a8", opacity: 0.95 });
      const dot = ctx.glow("#fff3c4", 0.05, { opacity: 1 });

      /* Two rates: Mercury's spin and its orbit's swing round the Sun. */
      const bk = 0.085;
      const by = 0.12;
      const spinBar = ctx.line([[gx0, by, 0], [gx0 + spinRate * bk, by, 0]], { colour: "#9fd0ff", opacity: 0.95, additive: false });
      const orbitBar = ctx.line([[gx0, by - 0.05, 0], [gx0 + 0.1, by - 0.05, 0]], { colour: "#ffb27a", opacity: 0.95, additive: false });
      void spinBar;
      const rates = ctx.label(["", ""], { at: [gx0, by + 0.07, 0], align: "left", height: 0.036 });

      ctx.tell([
        { at: 0, label: "Dawn on Mercury", text: "On Mercury's equator, 90° from its hottest places: the Sun is about to rise, just as Mercury nears perihelion." },
        { at: 0.3, label: "It stops", text: "Four days before perihelion the Sun halts, half risen, and starts back down." },
        { at: 0.5, label: "It sets again", text: "For about eight days Mercury's orbit swings it round the Sun faster than it spins, so the Sun runs backwards." },
        { at: 0.76, label: "Up for good", text: "Then the spin wins again and the Sun rises for good. It will not set for another 88 Earth days." },
      ]);

      const vis = (h) => h > -SUN_RADIUS_DEG;
      return {
        duration: 20,
        update(p) {
          const t = lerp(T0, T1, span(p, 0.02, 0.96));
          const h = height(t);
          sun.position.set(sunX, horizon + h * K, 0);
          sun.rotation.y = ctx.t * 0.05;
          const n = Math.max(2, Math.round(220 * (t - T0) / (T1 - T0)) + 1);
          ctx.setLine(curve, curvePts.slice(0, n));
          dot.position.set(gX(t), gY(h), 0.01);
          const dh = height(t + 0.05) - height(t - 0.05);
          let phase;
          if (!vis(h)) phase = t < 0 ? "before sunrise" : "set again — below the horizon";
          else if (Math.abs(dh) < 0.004) phase = "the Sun stands still";
          else if (dh > 0) phase = t < -4 ? "sunrise" : "rising again — for good";
          else phase = "sinking back";
          const day = t >= 0 ? `+${t.toFixed(1)}` : t.toFixed(1);
          status.userData.draw([phase, `day ${day} from perihelion`]);
          const or = orbitRate(t);
          ctx.setLine(orbitBar, [[gx0, by - 0.05, 0], [gx0 + or * bk, by - 0.05, 0]]);
          rates.userData.draw([`Spin ${spinRate.toFixed(2)}° a day`, `Orbit ${or.toFixed(2)}° a day${or > spinRate ? " — faster!" : ""}`]);
          ctx.fade(rates, smooth(p, 0.4, 0.46));
          ctx.fade(spinBar, smooth(p, 0.4, 0.46));
          ctx.fade(orbitBar, smooth(p, 0.4, 0.46));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "venus-superrotation",
    section: "inner",
    title: "Venus's super-rotating winds",
    place: "Venus",
    kind: "ongoing",
    family: "planetary",
    often: "always",
    detail: "The ground turns once in 243 days, but the cloud tops race all the way round in about four",
    frequency: "Continuous, and as far as anyone can tell permanent: every spacecraft since the 1960s has seen it.",
    cause: "Venus's surface turns slowly backwards, once in 243 days — 1.8 m/s at the equator. The atmosphere does not follow: around the cloud tops, about 70 km up, winds of roughly 100 m/s carry the clouds round the planet in about four days, sixty times faster than the ground. The Sun's heating drives tides and waves in the atmosphere that are thought to pump the upper layers faster, but the full balance is still being worked out.",
    note: "Near the ground the air barely moves, a metre or so per second — but the atmosphere there is 90 times as dense as Earth's, so even a gentle wind pushes hard.",
    accuracy: "The two rates are the real ones (243 days and about 4 days), so the clouds go round sixty times as fast as the ground. The cloud deck is drawn thicker than it is, and the wind in fact varies with latitude.",
    art: { main: "venus", fx: "storm" },
    scene(ctx) {
      /* Sidereal rotation 243.025 d retrograde (NASA); cloud tops about 4
       * days (ESA Venus Express; Sánchez-Lavega et al. 2008). */
      const ROT = 243.025;
      const CLOUD = 4;
      /* layout */
      const R = 0.4;
      const C = new THREE.Vector3(-0.22, 0.06, 0);
      const ground = ctx.ball(R, { body: "Venus surface", rim: 0.2, rimColour: "#ffcf8a" });
      ground.position.copy(C);
      const clouds = ctx.ball(R * 1.06, { body: "Venus", opacity: 0.999, rim: 0.5, rimColour: "#fff0c8" });
      clouds.position.copy(C);
      const flag = ctx.ball(0.016, { colour: "#ff5a5a", emissive: "#600000", parent: ground });
      flag.position.copy(ctx.onSphere(R * 1.005, 8, 0));
      const puff = ctx.ball(0.018, { colour: "#bfefff", emissive: "#2a6080", parent: clouds });
      puff.position.copy(ctx.onSphere(R * 1.065, 4, 0));
      /* The wind ring round the equator, tilted toward us. */
      const ringGroup = new THREE.Group();
      ringGroup.position.copy(C);
      ringGroup.rotation.x = 0.28;
      ctx.add(ringGroup);
      ctx.circle(R * 1.22, { colour: "#bfefff", opacity: 0.35, parent: ringGroup });
      const runners = Array.from({ length: 6 }, () => ctx.glow("#bfefff", 0.05, { opacity: 0.9, parent: ringGroup }));

      /* Lap counters. */
      const bx = 0.38;
      const bw = 0.66;
      const bars = [
        { y: 0.46, colour: "#bfefff", title: "Cloud tops, 70 km up" },
        { y: 0.2, colour: "#ff8a8a", title: "The ground" },
      ].map((b) => {
        ctx.line([[bx, b.y, 0], [bx + bw, b.y, 0]], { colour: "#3a4a5a", opacity: 0.8, additive: false });
        const line = ctx.line([[bx, b.y, 0], [bx + 0.001, b.y, 0]], { colour: b.colour, opacity: 1, additive: false });
        const label = ctx.label(["", ""], { at: [bx, b.y + 0.08, 0], align: "left", height: 0.036, colour: b.colour });
        return { ...b, line, label };
      });
      const days = ctx.label([""], { at: [C.x, C.y - R - 0.16, 0], height: 0.044 });
      const ratio = ctx.label(["60 times faster than the ground", "about 100 m/s against 1.8 m/s"], { at: [bx + bw / 2, -0.06, 0], height: 0.04, colour: "#ffe3a8" });

      ctx.tell([
        { at: 0, label: "The slow planet", text: "Venus's surface turns once every 243 days — backwards, at walking pace: 1.8 m/s at the equator." },
        { at: 0.22, label: "The racing clouds", text: "But the cloud tops, about 70 km up, circle the whole planet in about four days." },
        { at: 0.52, label: "Super-rotation", text: "Winds of about 100 m/s — 360 km/h — blowing the same way the planet turns, sixty times faster." },
        { at: 0.78, label: "Still a puzzle", text: "The Sun's heat drives tides and waves in the air that keep it spinning faster. Exactly how is still being worked out." },
      ]);
      return {
        duration: 20,
        update(p) {
          const d = 12 * span(p, 0.03, 0.95);
          /* Retrograde: both turn the "backwards" way (negative about y). */
          const groundTurns = d / ROT;
          const cloudLaps = d / CLOUD;
          ground.rotation.y = -groundTurns * TAU;
          clouds.rotation.y = -cloudLaps * TAU;
          const c = smooth(p, 0.2, 0.3);
          ctx.fade(clouds, 0.88 * c);
          ctx.fade(ringGroup, c);
          runners.forEach((g, i) => {
            const a = -cloudLaps * TAU + (i / runners.length) * TAU + Math.PI / 2;
            g.position.set(Math.cos(a) * R * 1.22, 0, Math.sin(a) * R * 1.22);
          });
          days.userData.draw([`Day ${d.toFixed(1)}`]);
          const lapsFrac = Math.min(1, cloudLaps / 3);
          ctx.setLine(bars[0].line, [[bx, bars[0].y, 0], [bx + Math.max(0.001, bw * lapsFrac), bars[0].y, 0]]);
          ctx.setLine(bars[1].line, [[bx, bars[1].y, 0], [bx + Math.max(0.001, bw * Math.min(1, groundTurns / 3)), bars[1].y, 0]]);
          bars[0].label.userData.draw([bars[0].title, `${cloudLaps.toFixed(2)} laps`]);
          bars[1].label.userData.draw([bars[1].title, `${groundTurns.toFixed(3)} turns`]);
          ctx.fade(bars[0].line, c);
          ctx.fade(bars[0].label, c);
          ctx.fade(ratio, smooth(p, 0.52, 0.58));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 5 */
  event({
    id: "venus-volcano",
    section: "inner",
    title: "Venus is still volcanic",
    place: "Venus · Maat Mons",
    kind: "recorded",
    family: "geology",
    when: "Feb–Oct 1991 · found in 2023",
    often: "seen once, 1991",
    timeline: { last: "1991 (found 2023)", next: "VERITAS and EnVision, 2030s" },
    detail: "Two radar images taken eight months apart in 1991 show a volcanic vent on Maat Mons growing and filling with lava",
    frequency: "Seen once, in Magellan radar images from February and October 1991; spotted in 2023. Venus probably erupts often, but only a handful of spacecraft have ever mapped it.",
    cause: "Venus is nearly Earth's size and still hot inside, so it was expected to be volcanic — but no eruption had ever been seen. Robert Herrick and Scott Hensley compared old Magellan images by eye and found a vent on the north flank of Maat Mons that grew from about 2.2 km² to about 4 km², changed shape and filled almost to its rim, with what looks like fresh flows downhill.",
    note: "They checked that the change was not just the two images being taken from different angles. NASA's VERITAS and ESA's EnVision will map Venus again in the 2030s, and look for more.",
    accuracy: "The two radar frames are drawings made to match the published description (area, shape, filling), not the Magellan pixels. The globe's marker shows the region, not an exact spot.",
    art: { main: "venus", fx: "glow" },
    scene(ctx) {
      /* layout */
      const globe = ctx.ball(0.2, { body: "Venus surface", rim: 0.3, rimColour: "#ffcf8a" });
      globe.position.set(0.72, 0.46, 0);
      /* Maat Mons, 0.5°N 194.6°E (USGS Gazetteer); the map's longitude
       * zero is assumed at its centre, so the marker is approximate. */
      const lon = 194.6 - 360;
      const phi = ((lon + 180) / 360) * TAU;
      const spot = new THREE.Vector3(-Math.cos(phi), 0.01, Math.sin(phi));
      const turn = -Math.atan2(spot.x, spot.z) + 0.35;
      const pin = ctx.ball(0.016, { colour: "#ff8a3a", emissive: "#ff5a00", parent: globe });
      pin.position.copy(spot).multiplyScalar(0.2);
      const globeLabel = ctx.label(["Maat Mons", "Venus's tallest volcano"], { at: [0.72, 0.16, 0], height: 0.036 });

      /* Radar frames: grey speckle, lit from the left as SAR is. */
      const frame = (stage) => paint(256, 256, (g, w, h) => {
        const rr = rng(31);
        const img = g.createImageData(w, h);
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const k = (y * w + x) * 4;
            const ridge = 18 * Math.sin(x * 0.05 + y * 0.02) + 10 * Math.sin(y * 0.11 - x * 0.03);
            const v = 118 + ridge + (rr() - 0.5) * 70;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.max(0, Math.min(255, v));
            img.data[k + 3] = 255;
          }
        }
        g.putImageData(img, 0, 0);
        const cx = 128;
        const cy = 120;
        if (stage === 0) {
          /* February 1991: a round, steep-walled vent, about 2.2 km² —
           * 1.7 km across on a frame 8 km wide (drawing choice). */
          const rad = 27;
          g.fillStyle = "rgba(25,25,25,0.95)";
          g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
          g.strokeStyle = "rgba(235,235,235,0.9)"; g.lineWidth = 5;
          g.beginPath(); g.arc(cx, cy, rad, Math.PI * 0.6, Math.PI * 1.4); g.stroke();
          g.strokeStyle = "rgba(60,60,60,0.9)";
          g.beginPath(); g.arc(cx, cy, rad, -Math.PI * 0.4, Math.PI * 0.4); g.stroke();
        } else {
          /* October 1991: about 4 km², irregular, shallower, filled almost
           * to the rim, with new flows downslope. */
          g.fillStyle = "rgba(170,170,170,0.55)";
          g.beginPath();
          g.moveTo(cx - 6, cy + 30);
          g.bezierCurveTo(cx - 30, cy + 70, cx - 18, cy + 105, cx - 4, cy + 128);
          g.bezierCurveTo(cx + 10, cy + 100, cx + 26, cy + 70, cx + 12, cy + 30);
          g.fill();
          g.beginPath();
          g.moveTo(cx + 20, cy + 22);
          g.bezierCurveTo(cx + 45, cy + 55, cx + 60, cy + 80, cx + 70, cy + 108);
          g.bezierCurveTo(cx + 52, cy + 90, cx + 34, cy + 60, cx + 10, cy + 30);
          g.fill();
          g.fillStyle = "rgba(70,70,70,0.95)";
          g.beginPath();
          const pts = 28;
          for (let i = 0; i <= pts; i += 1) {
            const a = (i / pts) * TAU;
            const rad = 36 + 8 * Math.sin(a * 3 + 0.6) + 5 * Math.sin(a * 5 + 1.3);
            const x = cx + Math.cos(a) * rad * 1.1;
            const y = cy + Math.sin(a) * rad * 0.92;
            if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.fill();
          g.strokeStyle = "rgba(220,220,220,0.75)"; g.lineWidth = 3;
          g.stroke();
        }
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.fillRect(20, 236, 64, 4);
      });
      const S = 0.6;
      const frames = [
        { x: -0.66, title: "February 1991", sub: "Magellan, first look" },
        { x: 0.02, title: "October 1991", sub: "eight months later" },
      ].map((f, i) => {
        const mesh = panel(ctx, S, S, { map: frame(i), order: 19 });
        mesh.position.set(f.x, -0.02, 0);
        const border = ctx.line([[-S / 2, -S / 2, 0.001], [S / 2, -S / 2, 0.001], [S / 2, S / 2, 0.001], [-S / 2, S / 2, 0.001], [-S / 2, -S / 2, 0.001]], { colour: "#ffd27f", opacity: 0.8, parent: mesh });
        void border;
        const label = ctx.label([f.title, f.sub], { at: [f.x, 0.36, 0], height: 0.04 });
        ctx.fade(mesh, 0);
        ctx.fade(label, 0);
        return { mesh, label };
      });
      ctx.label(["2 km"], { at: [-0.66 - S / 2 + 0.2, -0.02 - S / 2 + 0.035, 0.01], align: "left", height: 0.022 });
      /* February's outline laid over October's frame. */
      const ghost = ctx.circle((27 / 256) * S, { plane: "xy", colour: "#8fd8ff", opacity: 0.95, dashed: true, dash: 0.012, gap: 0.01 });
      ghost.position.set(0.02, -0.02 + (128 - 120) / 256 * S, 0.01);
      const lead = ctx.line([[0.62, 0.42, 0], [0.02 + S / 2, 0.24, 0]], { colour: "#ff8a3a", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.015 });
      const area = ctx.label(["Vent: about 2.2 km² → about 4 km²", "reshaped, and filled almost to the rim"], { at: [-0.32, -0.46, 0], height: 0.04, colour: "#ffe3a8" });

      ctx.tell([
        { at: 0, label: "Maat Mons", text: "Venus's tallest volcano, 8 km high, mapped through the clouds by the Magellan radar in 1991." },
        { at: 0.2, label: "February 1991", text: "A round vent on the volcano's north flank, about 2.2 square kilometres." },
        { at: 0.42, label: "October 1991", text: "Eight months later the same vent is twice the size, misshapen, and filled almost to its rim." },
        { at: 0.68, label: "Found in 2023", text: "Herrick and Hensley spotted it in the old images: the first direct sign of a recent eruption on Venus." },
      ]);
      return {
        duration: 20,
        update(p) {
          globe.rotation.y = turn + ctx.t * 0.02;
          pin.scale.setScalar(1 + 0.3 * Math.sin(ctx.t * 4));
          ctx.fade(globeLabel, 1 - smooth(p, 0.2, 0.26) * 0.5);
          ctx.fade(lead, smooth(p, 0.12, 0.2));
          ctx.fade(frames[0].mesh, smooth(p, 0.16, 0.24));
          ctx.fade(frames[0].label, smooth(p, 0.16, 0.24));
          ctx.fade(frames[1].mesh, smooth(p, 0.4, 0.48));
          ctx.fade(frames[1].label, smooth(p, 0.4, 0.48));
          const g = smooth(p, 0.52, 0.58);
          ctx.fade(ghost, g * (0.6 + 0.4 * Math.sin(ctx.t * 3) ** 2));
          ctx.fade(area, smooth(p, 0.54, 0.6));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "mars-opposition",
    section: "inner",
    title: "Mars at opposition",
    place: "Earth and Mars",
    kind: "recurring",
    family: "alignment",
    when: "Last Jan 16, 2025 · next February 2027",
    often: "every 26 months",
    timeline: { last: "January 16, 2025", next: "February 2027" },
    detail: "Earth overtakes Mars on the inside track, and Mars sits opposite the Sun: up all night, and at its brightest",
    frequency: "Every 780 days on average — about two years and two months — because Earth gains one lap on Mars in that time. Close, bright oppositions come every 15 or 17 years, when the overtaking happens near Mars's perihelion.",
    cause: "Earth goes round the Sun in 365 days, Mars in 687. Every so often Earth catches up and passes it, and for a few weeks the Sun, Earth and Mars stand in a line. Mars is then opposite the Sun in our sky: it rises at sunset, is highest at midnight and is closer, larger and brighter than at any other time.",
    note: "In January 2025 Mars came within 96 million km, two days before opposition — closest approach and opposition differ slightly because Mars's orbit is an ellipse. Launch windows to Mars open a few months before each opposition.",
    accuracy: "Positions are computed from the planets' real orbits, so the dates and distances on screen are the sky's own. Earth and Mars are drawn far larger than their orbits allow; the telescope view is Mars's real apparent size to one scale.",
    art: { main: "mars", second: "earth", fx: "lineup" },
    scene(ctx) {
      /* layout */
      const AU = 0.44;
      const C = new THREE.Vector3(-0.4, -0.02, 0);
      const sun = ctx.sun(0.05, { halo: 3, haloOpacity: 0.5 });
      sun.position.copy(C);
      const orbitPts = (el, period) => {
        const pts = [];
        for (let i = 0; i <= 200; i += 1) {
          const v = heliocentric(el, J2000 + (i / 200) * period);
          pts.push(new THREE.Vector3(C.x + v.x * AU, C.y + v.y * AU, 0));
        }
        return pts;
      };
      /* Periods 365.256 and 686.980 days (NASA). */
      ctx.line(orbitPts(EARTH, 365.256), { colour: "#4f7fbf", opacity: 0.55 });
      ctx.line(orbitPts(MARS, 686.98), { colour: "#c1653b", opacity: 0.6 });
      const earth = ctx.ball(0.035, { body: "Earth", rim: 0.4 });
      const mars = ctx.ball(0.03, { body: "Mars", rim: 0.3 });
      const link = ctx.line([[0, 0, 0], [1, 0, 0]], { colour: "#ffffff", opacity: 0.5 });
      const lineUp = ctx.line([[0, 0, 0], [1, 0, 0]], { colour: "#ffd27f", opacity: 0.9 });
      const distance = ctx.label([""], { height: 0.026 });
      const dateLabel = ctx.label([""], { at: [C.x, 0.8, 0], height: 0.046 });

      /* The telescope view: Mars's apparent diameter to one scale. */
      const tele = new THREE.Vector3(0.74, 0.42, 0);
      ctx.circle(0.24, { plane: "xy", colour: "#9fb3c8", opacity: 0.4 }).position.copy(tele);
      const disc = ctx.ball(0.1, { body: "Mars", rim: 0.25 });
      disc.position.copy(tele);
      const teleLabel = ctx.label(["Mars in a telescope", ""], { at: [tele.x, tele.y - 0.33, 0], height: 0.036 });

      /* Dates: Aug 1, 2024 to Apr 15, 2025, then on to the 2027 opposition
       * (JD from Meeus). Opposition JD 2460691.6 = Jan 16, 2025, which these
       * elements reproduce. */
      const JD_A = 2460523.5;
      const JD_OPP = 2460691.5;
      const JD_B = 2460780.5;
      const JD_2027 = 2461456.0;
      const dateAt = (p) => (p < 0.64
        ? lerp(JD_A, JD_B, span(p, 0.02, 0.64))
        : lerp(JD_B, JD_2027, easeInOut(span(p, 0.68, 0.9))));
      const e = new THREE.Vector3();
      const m = new THREE.Vector3();
      ctx.light.set(0, 0.25, 1).normalize();

      ctx.tell([
        { at: 0, label: "Two orbits", text: "Earth on the inside track goes round the Sun in 365 days; Mars, farther out, takes 687." },
        { at: 0.16, label: "Catching up", text: "Earth gains on Mars, and the gap between them shrinks." },
        { at: 0.36, label: "Opposition", text: "January 16, 2025: Sun, Earth and Mars in a line. Mars rises at sunset and shines all night, at its brightest." },
        { at: 0.66, label: "Every 26 months", text: "About 780 days later Earth laps it again. The next opposition is in February 2027." },
      ]);
      return {
        duration: 20,
        update(p) {
          const jd = dateAt(p);
          heliocentric(EARTH, jd, e);
          heliocentric(MARS, jd, m);
          earth.position.set(C.x + e.x * AU, C.y + e.y * AU, 0);
          mars.position.set(C.x + m.x * AU, C.y + m.y * AU, 0);
          earth.rotation.y = ctx.t * 0.6;
          mars.rotation.y = ctx.t * 0.5;
          disc.rotation.y = ctx.t * 0.4;
          ctx.setLine(link, [earth.position, mars.position]);
          const d = m.clone().sub(e).length();
          const mid = earth.position.clone().add(mars.position).multiplyScalar(0.5);
          distance.position.set(mid.x + 0.02, mid.y + 0.06, 0);
          distance.userData.draw([`${Math.round((d * AU_KM) / 1e6)} million km`]);
          /* Alignment: how close the heliocentric longitudes are. */
          let dl = Math.atan2(m.y, m.x) - Math.atan2(e.y, e.x);
          dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const aligned = 1 - smooth(Math.abs(dl), 0.04, 0.2);
          ctx.setLine(lineUp, [C, mars.position.clone().sub(C).multiplyScalar(1.12).add(C)]);
          ctx.fade(lineUp, aligned);
          dateLabel.userData.draw([calendar(jd)]);
          /* Apparent diameter: 206,265″ × 2R / distance. */
          const arcsec = (206265 * 2 * MARS_RADIUS) / (d * AU_KM);
          disc.scale.setScalar((arcsec * 0.0125) / 0.1);
          teleLabel.userData.draw(["Mars in a telescope", `${arcsec.toFixed(1)}″ across`]);
          ctx.fade(link, 1 - aligned * 0.6);
          void JD_OPP;
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 7 */
  event({
    id: "mars-retrograde",
    section: "inner",
    title: "Mars's backwards loop",
    place: "Earth and Mars · Gemini and Cancer",
    kind: "recurring",
    family: "orbit",
    when: "Last Dec 7, 2024 – Feb 24, 2025",
    often: "every 26 months",
    timeline: { last: "Dec 2024 – Feb 2025", next: "Jan – Apr 2027" },
    detail: "Seen from Earth, Mars stops, runs backwards across the stars for about ten weeks, then turns forward again",
    frequency: "Every time Earth overtakes Mars — every 780 days on average — centred on opposition and lasting 60 to 80 days.",
    cause: "Mars never reverses. Earth, on the faster inside track, overtakes it, and while it does the line of sight from Earth to Mars swings backwards across the distant stars — as a car you overtake seems to slide backwards against the hills. Mars's orbit is tilted 1.85° to Earth's, so the path is drawn out into a loop or a zigzag rather than a straight back-and-forth.",
    note: "Retrograde loops were the great puzzle of ancient astronomy: Ptolemy explained them with circles on circles. Copernicus's Sun-centred system explained them as simply as this.",
    accuracy: "Computed from the planets' real orbits for the 2024–25 apparition. The sky strip is to true angular scale in both directions; the orbit view is to scale except for the planets' sizes.",
    art: { main: "mars", second: "earth", fx: "loop" },
    scene(ctx) {
      /* The sky strip: ecliptic longitude 140°…90° left to right (east is
       * left on a sky map), latitude to the same scale. */
      const LAM0 = 140;
      const LAM1 = 90;
      const sx0 = -0.98;
      const sx1 = 0.98;
      const sk = (sx1 - sx0) / (LAM0 - LAM1);
      const sy = 0.6;
      const BETA0 = 3;
      const skyX = (lam) => sx0 + (LAM0 - lam) * sk;
      const skyY = (beta) => sy + (beta - BETA0) * sk;
      const strip = panel(ctx, sx1 - sx0 + 0.04, 0.42, { colour: "#06101e", opacity: 0.75, order: 15 });
      strip.position.set((sx0 + sx1) / 2, sy + 0.02, -0.02);
      ctx.line([[sx0, skyY(0), 0], [sx1, skyY(0), 0]], { colour: "#ffd27f", opacity: 0.3, dashed: true, dash: 0.02, gap: 0.02 });
      const r = rng(17);
      const stars = ctx.cloud(150, { size: 2 });
      for (let i = 0; i < 150; i += 1) {
        stars.set(i, lerp(sx0, sx1, r()), lerp(skyY(-1.5), skyY(7.8), r()), -0.01);
        stars.size[i] = 1 + r() * 2;
        stars.alpha[i] = 0.3 + r() * 0.5;
      }
      stars.commit();
      /* Pollux: ecliptic λ 113.2°, β +6.7°; the Beehive cluster (M44):
       * λ 127.3°, β +1.5° (J2000, from their RA/Dec). */
      const pollux = ctx.glow("#ffd9a0", 0.06, { opacity: 1 });
      pollux.position.set(skyX(113.2), skyY(6.7), 0);
      ctx.label(["Pollux"], { at: [skyX(113.2) + 0.03, skyY(6.7), 0], align: "left", height: 0.022, colour: "#c8d6e6" });
      const hive = ctx.cloud(14, { size: 2.2 });
      for (let i = 0; i < 14; i += 1) hive.set(i, skyX(127.3) + (r() - 0.5) * 0.05, skyY(1.5) + (r() - 0.5) * 0.04, 0);
      hive.commit();
      ctx.label(["Beehive"], { at: [skyX(127.3), skyY(1.5) - 0.045, 0], height: 0.02, colour: "#c8d6e6" });
      ctx.label(["east ←"], { at: [sx0 + 0.02, sy + 0.17, 0], align: "left", height: 0.02, colour: "#7f93a8" });

      /* The orbit view: up is ecliptic longitude 116°, toward Mars at
       * opposition, so a sight line's tilt reads as its place in the strip. */
      const O = new THREE.Vector3(-0.15, -0.44, 0);
      const AU = 0.25;
      const turn = (90 - 116) * DEG;
      const toView = (v) => new THREE.Vector3(
        O.x + (v.x * Math.cos(turn) - v.y * Math.sin(turn)) * AU,
        O.y + (v.x * Math.sin(turn) + v.y * Math.cos(turn)) * AU,
        0,
      );
      const sun = ctx.sun(0.035, { halo: 3, haloOpacity: 0.5 });
      sun.position.copy(O);
      const ring = (el, period) => {
        const pts = [];
        for (let i = 0; i <= 200; i += 1) pts.push(toView(heliocentric(el, J2000 + (i / 200) * period)));
        return pts;
      };
      ctx.line(ring(EARTH, 365.256), { colour: "#4f7fbf", opacity: 0.5 });
      ctx.line(ring(MARS, 686.98), { colour: "#c1653b", opacity: 0.55 });
      const earth = ctx.ball(0.026, { body: "Earth" });
      const mars = ctx.ball(0.022, { body: "Mars" });
      const sight = ctx.line([[0, 0, 0], [0, 1, 0]], { colour: "#ffe3a8", opacity: 0.9 });
      const TOP = 0.34;
      const sightEnd = (a, b) => {
        const dir = b.clone().sub(a).normalize();
        const L = dir.y > 0.05 ? Math.min(1.3, (TOP - a.y) / dir.y) : 0.9;
        return a.clone().addScaledVector(dir, L);
      };

      /* Dates: Sept 13, 2024 to May 21, 2025, centred on opposition
       * (JD 2460691.5 = Jan 16, 2025). */
      const JD_MID = 2460691.5;
      const JD_A = JD_MID - 125;
      const JD_B = JD_MID + 125;
      const geo = (jd) => {
        const m = heliocentric(MARS, jd);
        const e = heliocentric(EARTH, jd);
        const g = m.sub(e);
        let lam = Math.atan2(g.y, g.x) / DEG;
        if (lam < 0) lam += 360;
        return { lam, beta: Math.atan2(g.z, Math.hypot(g.x, g.y)) / DEG };
      };
      const N = 250;
      const track = [];
      for (let i = 0; i <= N; i += 1) {
        const s = geo(lerp(JD_A, JD_B, i / N));
        track.push(new THREE.Vector3(skyX(s.lam), skyY(s.beta), 0.01));
      }
      const trail = ctx.line(track.slice(0, 2), { colour: "#ff9a6a", opacity: 0.95 });
      /* Ghost sight lines, one every 25 days. */
      const ghosts = [];
      for (let k = 0; k <= 10; k += 1) {
        const jd = JD_A + k * 25;
        const a = toView(heliocentric(EARTH, jd));
        const b = toView(heliocentric(MARS, jd));
        const line = ctx.line([a, sightEnd(a, b)], { colour: "#ffe3a8", opacity: 0.16 });
        const tick = ctx.glow("#ff9a6a", 0.03, { opacity: 0.9 });
        tick.position.copy(track[Math.round((k * 25 * N) / (JD_B - JD_A))]);
        ghosts.push({ jd, line, tick });
      }
      const marsDot = ctx.glow("#ff7a4a", 0.08, { opacity: 1 });
      const dateLabel = ctx.label(["", ""], { at: [0.62, -0.22, 0], height: 0.044 });

      ctx.tell([
        { at: 0, label: "Against the stars", text: "Autumn 2024: night by night, Mars creeps east (left) through Gemini toward Cancer." },
        { at: 0.3, label: "It stops", text: "December 7, 2024: Mars stands still near the Beehive cluster…" },
        { at: 0.42, label: "Backwards", text: "…and drifts west for about eleven weeks. Midway, on January 16, Earth overtakes it." },
        { at: 0.66, label: "Forward again", text: "February 24, 2025: it stops again, then resumes its eastward way." },
        { at: 0.84, label: "An illusion", text: "Mars never turns back. Earth, on the faster inside track, passes it — like a car you overtake." },
      ]);
      return {
        duration: 22,
        update(p) {
          const u = span(p, 0.02, 0.96);
          const jd = lerp(JD_A, JD_B, u);
          const ev = heliocentric(EARTH, jd);
          const mv = heliocentric(MARS, jd);
          earth.position.copy(toView(ev));
          mars.position.copy(toView(mv));
          earth.rotation.y = ctx.t * 0.6;
          ctx.setLine(sight, [earth.position, sightEnd(earth.position, mars.position)]);
          const n = Math.max(2, Math.round(u * N) + 1);
          ctx.setLine(trail, track.slice(0, n));
          const s = geo(jd);
          marsDot.position.set(skyX(s.lam), skyY(s.beta), 0.02);
          ghosts.forEach((g) => {
            const on = jd >= g.jd ? 1 : 0;
            ctx.fade(g.line, on);
            ctx.fade(g.tick, on);
          });
          const back = geo(jd + 0.5).lam < geo(jd - 0.5).lam;
          dateLabel.userData.draw([calendar(jd), back ? "moving west — retrograde" : "moving east"]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 8 */
  event({
    id: "mars-blue-sunset",
    section: "inner",
    title: "Blue sunset on Mars",
    place: "Mars · Gale crater",
    kind: "recurring",
    family: "surface",
    often: "every clear evening",
    detail: "On Mars the day sky is butterscotch, but the glow around the setting Sun is a cool, pale blue",
    frequency: "Every clear sunset (and sunrise); it is brightest when there is plenty of fine dust in the air.",
    cause: "Mars's sky colour comes from fine dust, grains about a micrometre across, not from the air itself. The dust absorbs blue light and scatters red light widely, so the daytime sky is reddish. But grains that size scatter blue light into a narrow cone straight ahead, so looking toward the Sun — most strongly at dusk, through the longest path of dust — a blue glow surrounds it.",
    note: "The Spirit rover photographed a blue sunset over Gusev crater on May 19, 2005, and Curiosity one over Gale crater on April 15, 2015. Seen from Mars, the Sun is about two-thirds the width it appears from Earth.",
    accuracy: "A diagram of a sunset, with colours chosen to match the rovers' photographs; the Sun's size and the timing are not to scale. The inset shows the scattering idea, not a calculation.",
    art: { main: "mars", second: "sun", fx: "glow" },
    scene(ctx) {
      /* layout */
      const W = 1.62;
      const H = 1.46;
      const PC = new THREE.Vector3(-0.25, 0.1, -0.01);
      const sky = panel(ctx, W, H, { segments: [32, 32], vertexColors: true, order: 16 });
      sky.position.copy(PC);
      const colours = new Float32Array(sky.geometry.attributes.position.count * 3);
      sky.geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      const horizon = -0.3;
      /* Ground: the far rim of Gale crater, then the near plain. */
      const pts = [[PC.x - W / 2, PC.y - H / 2]];
      for (let i = 0; i <= 50; i += 1) {
        const x = lerp(PC.x - W / 2, PC.x + W / 2, i / 50);
        const y = horizon + 0.05 * Math.exp(-(((x + 0.75) / 0.25) ** 2)) + 0.035 * Math.exp(-(((x - 0.35) / 0.3) ** 2)) + 0.006 * Math.sin(i * 1.3);
        pts.push([x, y]);
      }
      pts.push([PC.x + W / 2, PC.y - H / 2]);
      solid(ctx, pts, { colour: "#1c1410", depthTest: false });
      const sun = ctx.sun(0.022, { colour: "#fff8ec", hot: "#ffffff", halo: 3, haloColour: "#fff2e0", haloOpacity: 0.7, granule: 8 });
      const blue = ctx.glow("#4f86e0", 0.5, { opacity: 0 });
      const place = ctx.label(["Gale crater, Mars", "after Curiosity · April 15, 2015"], { at: [PC.x - W / 2 + 0.04, PC.y + H / 2 - 0.08, 0], align: "left", height: 0.04 });
      void place;
      const time = ctx.label([""], { at: [PC.x, PC.y - H / 2 + 0.1, 0], height: 0.03 });

      /* Inset: one dust grain. */
      const g0 = new THREE.Vector3(0.84, 0.48, 0);
      const inset = new THREE.Group();
      inset.position.copy(g0);
      ctx.add(inset);
      ctx.disc(0.035, { colour: "#b97a4e", parent: inset }).renderOrder = 25;
      ctx.arrow([-0.24, 0, 0], [-0.05, 0, 0], { colour: "#ffffff", head: 0.03, parent: inset });
      const ray = (angle, len, colour) => ctx.arrow([Math.cos(angle) * 0.05, Math.sin(angle) * 0.05, 0], [Math.cos(angle) * len, Math.sin(angle) * len, 0], { colour, head: 0.025, parent: inset });
      [-0.12, 0, 0.12].forEach((a) => ray(a, 0.22, "#6fa0ff"));
      [0.9, 1.6, 2.3, -0.9, -1.6, -2.3, 3.14].forEach((a) => ray(a, 0.15, "#ff8a4a"));
      const insetLabel = ctx.label(["One dust grain", "blue: thrown forward · red: everywhere"], { at: [g0.x, g0.y - 0.24, 0], height: 0.036 });
      ctx.fade(inset, 0);
      ctx.fade(insetLabel, 0);

      const DAY_TOP = new THREE.Color("#a77a52");
      const DAY_LOW = new THREE.Color("#dcb68c");
      const DUSK_TOP = new THREE.Color("#120e0c");
      const DUSK_LOW = new THREE.Color("#3e3026");
      const BLUE = new THREE.Color("#6d95cf");
      const c = new THREE.Color();
      const top = new THREE.Color();
      const low = new THREE.Color();

      ctx.tell([
        { at: 0, label: "Mars by day", text: "Fine dust in the thin air scatters red light across the whole sky: a butterscotch afternoon." },
        { at: 0.3, label: "Dusk", text: "As the Sun sinks, its light crosses more and more dust. Grains a micrometre across throw blue light forward." },
        { at: 0.56, label: "Blue sunset", text: "So the glow hugging the setting Sun turns cool and pale blue. Curiosity photographed this on April 15, 2015." },
        { at: 0.82, label: "Afterglow", text: "The blue lingers after the Sun has gone, lit by dust high in the sky." },
      ]);
      return {
        duration: 20,
        update(p) {
          const fall = easeInOut(span(p, 0.02, 0.82));
          const sx = lerp(-0.02, -0.22, fall);
          const syy = lerp(0.52, horizon - 0.04, fall);
          sun.position.set(sx, syy, 0);
          ctx.fade(sun, 1 - smooth(p, 0.78, 0.83));
          const dusk = smooth(p, 0.25, 0.92);
          const glow = smooth(p, 0.3, 0.7) * (1 - 0.65 * smooth(p, 0.86, 1));
          blue.position.set(sx, Math.max(syy, horizon + 0.02), 0.01);
          blue.scale.setScalar(lerp(0.3, 0.75, glow));
          ctx.fade(blue, glow * 0.85);
          top.copy(DAY_TOP).lerp(DUSK_TOP, dusk);
          low.copy(DAY_LOW).lerp(DUSK_LOW, dusk);
          const pos = sky.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 1) {
            const x = pos.getX(i) + PC.x;
            const y = pos.getY(i) + PC.y;
            const h = clamp01((y - horizon) / (PC.y + H / 2 - horizon));
            c.copy(low).lerp(top, Math.pow(h, 0.7));
            const d2 = (x - sx) ** 2 + ((y - Math.max(syy, horizon)) * 1.4) ** 2;
            c.lerp(BLUE, glow * 0.85 * Math.exp(-d2 / 0.06));
            colours[i * 3] = c.r;
            colours[i * 3 + 1] = c.g;
            colours[i * 3 + 2] = c.b;
          }
          sky.geometry.attributes.color.needsUpdate = true;
          const ins = smooth(p, 0.3, 0.38);
          ctx.fade(inset, ins);
          ctx.fade(insetLabel, ins);
          time.userData.draw([p < 0.28 ? "Afternoon" : p < 0.8 ? "Sunset" : "After sunset"]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 9 */
  event({
    id: "mars-dust-devils",
    section: "inner",
    title: "Martian dust devils",
    place: "Mars · the plains",
    kind: "recurring",
    family: "surface",
    often: "every spring and summer afternoon",
    detail: "Whirlwinds kilometres tall wander the Martian plains, scrubbing off bright dust and leaving dark scribbles behind",
    frequency: "Every day in the warm season in many regions, most often in the early afternoon. Spirit filmed hundreds in Gusev crater.",
    cause: "Sunlight heats the dark ground, and the ground heats a thin layer of air above it. That warm air rises in plumes; any slight swirl in the inflowing air is spun up as it is drawn in, like a skater pulling in their arms, until a whirling column stands on the plain. It lifts the thin layer of bright dust and leaves darker ground exposed.",
    note: "In 2012 the HiRISE camera caught one in Amazonis Planitia about 20 km tall and 70 m wide. Dust devils also cleaned the solar panels of the Spirit and Opportunity rovers, helping them last for years.",
    accuracy: "A diagram. The devils' heights are compressed against the width of the ground, and the tracks are drawn wider than real ones (tens of metres).",
    art: { main: "mars", fx: "storm" },
    scene(ctx) {
      /* layout */
      const G = new THREE.Group();
      G.position.set(0.0, -0.22, 0);
      ctx.add(G);
      const GW = 1.5;
      const GD = 0.95;
      const plain = paint(512, 384, (g, w, h) => {
        const rr = rng(9);
        g.fillStyle = "#c8916a";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i += 1) {
          const x = rr() * w;
          const y = rr() * h;
          const s = 1 + rr() * 6;
          g.fillStyle = rr() > 0.5 ? "rgba(230,180,140,0.25)" : "rgba(120,70,45,0.18)";
          g.fillRect(x, y, s, s);
        }
        for (let i = 0; i < 9; i += 1) {
          g.strokeStyle = "rgba(90,55,35,0.18)";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(rr() * w, rr() * h, 10 + rr() * 30, 0, TAU);
          g.stroke();
        }
      });
      const ground = panel(ctx, GW, GD, { map: plain, order: 17, parent: G });
      ground.rotation.x = -Math.PI / 2;
      /* Three devils on wandering paths (drawing choice). */
      const r = rng(21);
      const devils = [0, 1, 2].map((k) => {
        const start = [new THREE.Vector3(-0.62, 0, 0.12), new THREE.Vector3(-0.45, 0, -0.3), new THREE.Vector3(0.05, 0, 0.3)][k];
        const heading = [-0.15, 0.25, -0.5][k];
        const path = [];
        let pos = start.clone();
        let a = heading;
        for (let i = 0; i <= 120; i += 1) {
          path.push(pos.clone());
          a += Math.sin(i * 0.11 + k * 2) * 0.06;
          pos = pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.0085, 0, Math.sin(a) * 0.006));
          pos.x = Math.max(-GW / 2 + 0.06, Math.min(GW / 2 - 0.06, pos.x));
          pos.z = Math.max(-GD / 2 + 0.06, Math.min(GD / 2 - 0.06, pos.z));
        }
        return { path, t0: [0.02, 0.18, 0.34][k], t1: [0.7, 0.82, 0.92][k], H: [0.7, 0.55, 0.6][k], w: [0.055, 0.045, 0.05][k] };
      });
      const TRACK = 121;
      const tracks = ctx.cloud(devils.length * TRACK, { additive: false, size: 7, parent: G });
      devils.forEach((d, k) => d.path.forEach((q, i) => {
        tracks.set(k * TRACK + i, q.x, 0.002, q.z);
        tracks.tint(k * TRACK + i, "#4a2c1e");
        tracks.alpha[k * TRACK + i] = 0;
      }));
      tracks.commit();
      const PER = 420;
      const dust = ctx.cloud(devils.length * PER, { additive: false, size: 4, parent: G });
      const seeds = Array.from({ length: devils.length * PER }, () => ({ h: Math.pow(r(), 0.8), a: r() * TAU, j: 0.6 + r() * 0.6, s: 2 + r() * 3 }));
      seeds.forEach((s, i) => { dust.tint(i, r() > 0.4 ? "#e0b48c" : "#b88460"); dust.size[i] = s.s; });
      const tall = ctx.label(["kilometres tall"], { height: 0.028, align: "left" });
      const trackLabel = ctx.label(["dark track", "bright dust swept away"], { height: 0.036, colour: "#ffe3a8" });
      ctx.light.set(-0.4, 0.8, 0.4).normalize();

      ctx.tell([
        { at: 0, label: "A Martian whirlwind", text: "Sun-warmed ground heats the air above it; the rising air starts to spin and lifts dust into a column." },
        { at: 0.24, label: "Bigger than Earth's", text: "Many are kilometres tall. One seen from orbit in 2012 towered about 20 km." },
        { at: 0.48, label: "Dark scribbles", text: "They sweep up the thin layer of bright dust and uncover the darker ground below." },
        { at: 0.72, label: "From above", text: "Seen from orbit the tracks criss-cross the plains, until the next dust storm paints them over." },
      ]);
      return {
        duration: 20,
        update(p) {
          G.rotation.x = lerp(0.38, 1.2, easeInOut(span(p, 0.72, 0.86)));
          devils.forEach((d, k) => {
            const u = span(p, d.t0, d.t1);
            const life = win(p, d.t0, d.t1, 0.05);
            const idx = Math.min(d.path.length - 1, Math.floor(u * (d.path.length - 1)));
            const c = d.path[idx];
            for (let i = 0; i < TRACK; i += 1) tracks.alpha[k * TRACK + i] = i <= idx && u > 0 ? 0.55 : 0;
            for (let i = 0; i < PER; i += 1) {
              const s = seeds[k * PER + i];
              const y = s.h * d.H;
              const rad = d.w * (0.35 + 1.6 * s.h * s.h) * s.j;
              const a = s.a + ctx.t * (5 - 3 * s.h) * (k % 2 ? -1 : 1);
              const sway = Math.sin(ctx.t * 0.7 + k) * 0.03 * s.h;
              dust.set(k * PER + i, c.x + Math.cos(a) * rad + sway, y, c.z + Math.sin(a) * rad);
              dust.alpha[k * PER + i] = life * (0.8 - 0.45 * s.h);
            }
            if (k === 0) {
              G.updateMatrix();
              tall.position.copy(new THREE.Vector3(c.x + 0.2, d.H * 0.85, c.z).applyMatrix4(G.matrix));
              ctx.fade(tall, win(p, 0.22, 0.6));
            }
          });
          tracks.commit();
          dust.commit();
          G.updateMatrix();
          const mid = devils[0].path[40];
          trackLabel.position.copy(new THREE.Vector3(mid.x, 0, mid.z + 0.14).applyMatrix4(G.matrix));
          ctx.fade(trackLabel, smooth(p, 0.48, 0.54));
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 10 */
  event({
    id: "mars-spiders",
    section: "inner",
    title: "Spring geysers at Mars's south pole",
    place: "Mars · the south polar cap",
    kind: "recurring",
    family: "surface",
    often: "every southern spring",
    detail: "Sunlight through clear dry ice heats the ground beneath; trapped gas bursts out in dusty jets that carve spider-shaped channels",
    frequency: "Every southern spring on Mars — once per Martian year, 687 Earth days — in the sunlit months after the polar night.",
    cause: "In winter, carbon dioxide freezes out of the air into a slab of clear ice over the ground. In spring sunlight passes through the slab and warms the dark ground under it, so the ice turns to gas from the bottom. Gas builds up under the slab until it breaks through a weak spot and erupts, carrying dust that the wind lays down in dark fans. This is the Kieffer model, named for the scientist who proposed it in 2006 and 2007.",
    note: "Nothing on Earth works quite like this. The channels, nicknamed spiders, range from tens of metres to about a kilometre across, carved over many springs.",
    accuracy: "A cross-section diagram: the ice slab is drawn far thicker than its real thickness (up to around a metre) and the jet's height is not to scale. The view from orbit is a sketch of a typical spider, not a real one.",
    art: { main: "mars", fx: "jets" },
    scene(ctx) {
      /* layout: the cross-section, left. */
      const X0 = -1.02;
      const X1 = 0.3;
      const iceTop = -0.02;
      const iceBot = -0.17;
      const vx = -0.42;
      /* Ground with a channel under the vent. */
      const groundPts = [[X0, -0.62], [X0, iceBot]];
      for (let i = 0; i <= 40; i += 1) {
        const x = lerp(X0, X1, i / 40);
        groundPts.push([x, iceBot - 0.05 * Math.exp(-(((x - vx) / 0.05) ** 2))]);
      }
      groundPts.push([X1, iceBot], [X1, -0.62]);
      solid(ctx, groundPts, { colour: "#4a3326", order: 18 });
      /* The ice slab, with a gap at the vent. */
      const ice = solid(ctx, [[X0, iceBot], [vx - 0.012, iceBot], [vx - 0.012, iceTop], [X0, iceTop]], { colour: "#cfe6f5", order: 19, opacity: 0.4 });
      const ice2 = solid(ctx, [[vx + 0.012, iceBot], [X1, iceBot], [X1, iceTop], [vx + 0.012, iceTop]], { colour: "#cfe6f5", order: 19, opacity: 0.4 });
      void ice; void ice2;
      ctx.line([[X0, iceTop, 0.01], [vx - 0.012, iceTop, 0.01]], { colour: "#e8f6ff", opacity: 0.9, additive: false });
      ctx.line([[vx + 0.012, iceTop, 0.01], [X1, iceTop, 0.01]], { colour: "#e8f6ff", opacity: 0.9, additive: false });
      ctx.label(["clear CO₂ ice"], { at: [-0.98, (iceTop + iceBot) / 2, 0.02], align: "left", height: 0.026, colour: "#e8f6ff" });
      ctx.label(["ground"], { at: [-0.85, -0.42, 0.02], align: "left", height: 0.026, colour: "#d8b8a0" });
      /* Sunlight: low spring Sun, rays through the ice. */
      const rays = [-0.9, -0.66, -0.12, 0.12].map((x) => ctx.arrow([x - 0.28, 0.5, 0], [x, iceBot + 0.005, 0], { colour: "#ffe08a", head: 0.035 }));
      const sunLabel = ctx.label(["sunlight passes through"], { at: [-0.98, 0.56, 0], align: "left", height: 0.03, colour: "#ffe08a" });
      /* Gas: bubbles flowing along the base to the vent. */
      const r = rng(13);
      const GAS = 160;
      const gas = ctx.cloud(GAS, { size: 3 });
      const gasSeeds = Array.from({ length: GAS }, () => ({ x: lerp(X0 + 0.05, X1 - 0.05, r()), ph: r(), s: 2 + r() * 2 }));
      gasSeeds.forEach((s, i) => { gas.tint(i, "#ffffff"); gas.size[i] = s.s; });
      /* The jet: gas and dark dust, bent downwind (to the right). */
      const JET = 520;
      const jet = ctx.cloud(JET, { additive: false, size: 3.5 });
      const jetSeeds = Array.from({ length: JET }, () => ({ ph: r(), sp: (r() - 0.5) * 0.06, dark: r() > 0.35, s: 2 + r() * 3 }));
      jetSeeds.forEach((s, i) => { jet.tint(i, s.dark ? "#2a1a12" : "#e8eef4"); jet.size[i] = s.s; });
      /* The fan: dust settled on the ice downwind. */
      const FAN = 240;
      const fan = ctx.cloud(FAN, { additive: false, size: 4 });
      for (let i = 0; i < FAN; i += 1) {
        const d = Math.pow(r(), 0.7) * 0.42;
        fan.set(i, vx + 0.02 + d, iceTop + 0.006 + r() * 0.01, 0.02);
        fan.tint(i, "#2a1a12");
      }
      const jetLabel = ctx.label(["gas jet", "carries dark dust out"], { at: [vx + 0.08, 0.5, 0], align: "left", height: 0.036 });
      const fanLabel = ctx.label(["dark fan, laid by the wind →"], { at: [vx + 0.25, iceTop + 0.07, 0.02], height: 0.026, colour: "#ffe3a8" });

      /* The view from orbit: a spider, right. */
      const S = new THREE.Vector3(0.74, 0.32, 0);
      ctx.disc(0.3, { colour: "#b9b2a8", opacity: 0.95 }).position.copy(S);
      const branches = [];
      const grow = (from, angle, len, depth) => {
        const to = from.clone().add(new THREE.Vector3(Math.cos(angle) * len, Math.sin(angle) * len, 0));
        branches.push({ from, to, depth });
        if (depth < 3) {
          const n = depth === 0 ? 2 : 2;
          for (let i = 0; i < n; i += 1) grow(to, angle + (i ? 1 : -1) * (0.35 + r() * 0.3), len * (0.55 + r() * 0.15), depth + 1);
        }
      };
      for (let k = 0; k < 7; k += 1) grow(S.clone().setZ(0.01), (k / 7) * TAU + r() * 0.3, 0.1 + r() * 0.02, 0);
      /* Channels as chains of dark points, so they have some width. */
      const PER_BRANCH = 16;
      const channels = ctx.cloud(branches.length * PER_BRANCH, { additive: false, size: 4.5 });
      branches.forEach((b, j) => {
        for (let i = 0; i < PER_BRANCH; i += 1) {
          const q = b.from.clone().lerp(b.to, i / (PER_BRANCH - 1));
          channels.set(j * PER_BRANCH + i, q.x, q.y, 0.015);
          channels.tint(j * PER_BRANCH + i, "#3a2418");
          channels.size[j * PER_BRANCH + i] = 5.5 - b.depth * 1.2;
          channels.alpha[j * PER_BRANCH + i] = 0;
        }
      });
      channels.commit();
      const fans = ctx.cloud(7 * 30, { additive: false, size: 5 });
      for (let k = 0; k < 7; k += 1) {
        /* Fans spill from vents near the centre, downwind (to the right). */
        const tip = S.clone().lerp(branches.filter((b) => b.depth === 0)[k].to, 0.35);
        for (let i = 0; i < 30; i += 1) {
          const d = r() * 0.07;
          fans.set(k * 30 + i, tip.x + d, tip.y + (r() - 0.5) * d * 0.5, 0.02);
          fans.tint(k * 30 + i, "#24160f");
          fans.alpha[k * 30 + i] = 0;
        }
      }
      fans.commit();
      const orbitLabel = ctx.label(["From orbit: a 'spider'", "tens of metres to 1 km across"], { at: [S.x, S.y - 0.38, 0], height: 0.036 });

      ctx.tell([
        { at: 0, label: "Spring at the south pole", text: "All winter a slab of clear carbon-dioxide ice has covered the ground. Now the Sun returns." },
        { at: 0.18, label: "Warmed from below", text: "Sunlight passes through the clear ice and heats the dark ground. The ice turns to gas from its base." },
        { at: 0.42, label: "Eruption", text: "The trapped gas breaks out through a weak spot, carrying dark dust that the wind lays down in fans." },
        { at: 0.7, label: "Spiders", text: "Spring after spring, the gas rushing to the vents carves branching channels: from orbit, giant spiders." },
      ]);
      return {
        duration: 20,
        update(p) {
          const light = smooth(p, 0.02, 0.12);
          rays.forEach((a) => ctx.fade(a, light * (1 - 0.5 * smooth(p, 0.5, 0.6))));
          ctx.fade(sunLabel, light * (1 - smooth(p, 0.4, 0.46)));
          /* Gas builds 0.18–0.42, then streams to the vent. */
          const build = smooth(p, 0.16, 0.3);
          const flow = smooth(p, 0.38, 0.46);
          gasSeeds.forEach((s, i) => {
            const toward = Math.sign(vx - s.x);
            const drift = flow * ((s.ph + ctx.t * 0.25) % 1);
            let x = s.x + toward * Math.min(Math.abs(vx - s.x), drift * 0.7);
            const near = Math.abs(x - vx) < 0.015;
            x = near ? vx : x;
            gas.set(i, x, iceBot + 0.012 + 0.008 * Math.sin(i), 0.02);
            gas.alpha[i] = build * 0.75 * (near ? 0 : 1);
          });
          gas.commit();
          const erupt = smooth(p, 0.4, 0.46) * (1 - 0.5 * smooth(p, 0.86, 0.98));
          jetSeeds.forEach((s, i) => {
            const q = (s.ph + ctx.t * 0.6) % 1;
            const y = iceTop + q * 0.5;
            const x = vx + s.sp * q + q * q * 0.22;
            jet.set(i, x, y, 0.03);
            jet.alpha[i] = erupt * (1 - q) * 0.85;
          });
          jet.commit();
          const settle = smooth(p, 0.45, 0.7);
          for (let i = 0; i < FAN; i += 1) fan.alpha[i] = i < FAN * settle ? 0.65 : 0;
          fan.commit();
          ctx.fade(jetLabel, win(p, 0.44, 0.72));
          ctx.fade(fanLabel, win(p, 0.52, 0.8));
          /* The spider grows, branch level by level. */
          branches.forEach((b, j) => {
            const g = span(p, 0.56 + b.depth * 0.06, 0.64 + b.depth * 0.06);
            for (let i = 0; i < PER_BRANCH; i += 1) channels.alpha[j * PER_BRANCH + i] = g > 0 && i / (PER_BRANCH - 1) <= g ? 0.9 : 0;
          });
          channels.commit();
          const f = smooth(p, 0.78, 0.9);
          for (let i = 0; i < fans.count; i += 1) fans.alpha[i] = f * 0.7;
          fans.commit();
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 11 */
  event({
    id: "mars-avalanches",
    section: "inner",
    title: "Avalanches on the north polar cliffs",
    place: "Mars · the north polar cap",
    kind: "recurring",
    family: "surface",
    often: "every northern spring",
    detail: "Spring sunshine cracks frost and ice on cliffs hundreds of metres tall, and avalanches crash down in clouds of dust",
    frequency: "Every northern spring on Mars, once a Martian year (687 Earth days). HiRISE has photographed them in the act many times since 2008.",
    cause: "The north polar cap ends in steep cliffs of layered ice and dust, steeper than 60° and hundreds of metres tall. In spring the Sun warms them, carbon-dioxide frost turns to gas and the ice expands and cracks. Blocks of ice and dust break off the edge and fall, raising clouds of fine material at the bottom.",
    note: "The first were caught on February 19, 2008, when one HiRISE picture held four avalanches at once; the largest dust cloud was about 180 m across. Some of the falling blocks are as big as a house.",
    accuracy: "A side-on diagram. The cliff's height and slope are roughly in proportion; the layers are fewer and the blocks larger than in reality.",
    art: { main: "mars", fx: "dust" },
    scene(ctx) {
      /* layout */
      const top = 0.38;
      const base = -0.42;
      /* Slope about 65° (steeper than 60°, HiRISE/NASA PIA10236). */
      const run = (top - base) / Math.tan(65 * DEG);
      const xTop = -0.25;
      const xBase = xTop + run;
      const L = -1.05;
      const Rx = 0.75;
      const scarpX = (y) => lerp(xBase, xTop, (y - base) / (top - base)) + 0.02 * Math.sin(y * 30);
      /* Layers: bands of icy (pale) and dusty (tan) material. */
      const layers = 11;
      for (let k = 0; k < layers; k += 1) {
        const y0 = lerp(base, top, k / layers);
        const y1 = lerp(base, top, (k + 1) / layers);
        const colour = k < 2 ? "#5d4a3d" : k % 2 ? "#d7d0c4" : "#a8927c";
        solid(ctx, [[L, y0], [scarpX(y0), y0], [scarpX(y1), y1], [L, y1]], { colour, order: 18, z: 0 });
      }
      solid(ctx, [[L, -0.75], [Rx, -0.75], [Rx, base], [L, base]], { colour: "#4a3a30", order: 18 });
      const frost = solid(ctx, [[L, top - 0.025], [scarpX(top - 0.025), top - 0.025], [xTop + 0.01, top], [xTop + 0.01, top + 0.012], [L, top + 0.012]], { colour: "#f4f8ff", order: 19 });
      ctx.label(["layered ice and dust"], { at: [-0.62, 0.05, 0.02], height: 0.03, colour: "#2a1e16" });
      const frostLabel = ctx.label(["spring frost"], { at: [-0.7, top + 0.07, 0.02], height: 0.026 });
      /* Height marker: over 500 m. */
      ctx.arrow([Rx - 0.08, base, 0], [Rx - 0.08, top, 0], { colour: "#9fd0ff", head: 0.03 });
      ctx.arrow([Rx - 0.08, top, 0], [Rx - 0.08, base, 0], { colour: "#9fd0ff", head: 0.03 });
      ctx.label(["about 500 m", "slopes over 60°"], { at: [Rx - 0.04, (top + base) / 2 + 0.02, 0], align: "left", height: 0.036, colour: "#bfe0ff" });
      /* A low spring Sun, upper right. */
      const sun = ctx.sun(0.04, { halo: 3, haloOpacity: 0.5 });
      sun.position.set(0.55, 0.72, -0.1);
      ctx.light.set(0.6, 0.5, 0.6).normalize();
      /* Cracks along the edge, then blocks. */
      const crack = ctx.line([[xTop - 0.1, top, 0.02], [xTop - 0.08, top - 0.08, 0.02], [xTop - 0.11, top - 0.15, 0.02], [xTop - 0.06, top - 0.22, 0.02]], { colour: "#1a120c", opacity: 1, additive: false });
      const r = rng(41);
      const blocks = Array.from({ length: 7 }, (_, i) => {
        const size = 0.018 + r() * 0.03;
        const rock = ctx.rock(size, { seed: 50 + i, colour: i % 2 ? "#d8d2c6" : "#a8927c", lumps: 0.3 });
        return {
          rock, size,
          start: new THREE.Vector3(xTop - 0.03 - r() * 0.08, top - 0.02 - r() * 0.2, 0.05),
          t0: 0.42 + i * 0.025 + r() * 0.02,
          out: 0.15 + r() * 0.45,
          spin: new THREE.Vector3(r(), r(), r()),
        };
      });
      const DUST = 700;
      const dust = ctx.cloud(DUST, { additive: false, size: 6 });
      const dustSeeds = Array.from({ length: DUST }, () => ({ a: r() * Math.PI, d: Math.sqrt(r()), s: 4 + r() * 8, t0: 0.46 + r() * 0.1 }));
      dustSeeds.forEach((s, i) => { dust.tint(i, r() > 0.5 ? "#c9b8a5" : "#a89482"); dust.size[i] = s.s; });
      const cloudLabel = ctx.label(["dust cloud", "up to ~180 m across"], { at: [xBase + 0.22, base + 0.36, 0.05], height: 0.036, colour: "#ffe3a8" });

      ctx.tell([
        { at: 0, label: "Spring in the north", text: "The Sun climbs over Mars's north polar cap and warms the cliffs of layered ice and dust at its edge." },
        { at: 0.22, label: "Cracking", text: "Frost turns to gas and the ice expands; cracks open along the cliff edge." },
        { at: 0.42, label: "Avalanche", text: "Blocks of ice and dust break away and crash hundreds of metres down slopes steeper than 60°." },
        { at: 0.68, label: "Caught in the act", text: "On February 19, 2008, HiRISE caught four at once, their dust clouds up to about 180 m across." },
      ]);
      return {
        duration: 20,
        update(p) {
          ctx.fade(frost, 1 - smooth(p, 0.05, 0.4));
          ctx.fade(frostLabel, 1 - smooth(p, 0.3, 0.4));
          ctx.fade(crack, smooth(p, 0.22, 0.34));
          blocks.forEach((b) => {
            const u = span(p, b.t0, b.t0 + 0.2);
            const fallH = b.start.y - base - b.size;
            /* Off the edge, accelerating, then bouncing out over the floor. */
            const fallU = Math.min(1, u / 0.6);
            const y = b.start.y - fallH * fallU * fallU;
            const x = b.start.x + (scarpX(Math.max(base, y)) - xTop + 0.02) * fallU + b.out * smooth(u, 0.6, 1);
            const bounce = u > 0.6 ? Math.sin(Math.PI * span(u, 0.6, 1)) * 0.04 : 0;
            b.rock.position.set(x, Math.max(base + b.size, y) + bounce, 0.05);
            b.rock.rotation.set(b.spin.x * u * 12, b.spin.y * u * 12, b.spin.z * u * 12);
            b.rock.visible = p > 0.2;
          });
          dustSeeds.forEach((s, i) => {
            const u = span(p, s.t0, s.t0 + 0.35);
            const rad = 0.05 + u * 0.32 * s.d;
            dust.set(i, xBase + 0.08 + Math.cos(s.a) * rad * 1.2, base + Math.sin(s.a) * rad * 0.9, 0.06);
            dust.alpha[i] = u > 0 ? (1 - u * 0.6) * 0.5 * (1 - smooth(p, 0.9, 1) * 0.5) : 0;
          });
          dust.commit();
          ctx.fade(cloudLabel, smooth(p, 0.62, 0.68));
          sun.rotation.y = ctx.t * 0.1;
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 12 */
  event({
    id: "phobos-fall",
    section: "inner",
    title: "Phobos's slow fall",
    place: "Mars and Phobos",
    kind: "ongoing",
    family: "orbit",
    when: "Breakup in 30–50 million years",
    often: "1.8 m closer every century",
    timeline: { last: "falling now", next: "a ring, in 30–50 million years" },
    detail: "Mars's inner moon orbits faster than Mars spins, and the tides it raises are dragging it down, about 1.8 m a century",
    frequency: "Continuous: Phobos sinks about 1.8 metres closer to Mars every hundred years, and the fall speeds up as it gets nearer.",
    cause: "Phobos orbits 6,000 km above Mars, three times every Martian day — faster than Mars turns. The bulge it raises on Mars is carried round more slowly than Phobos moves, so it lags behind and pulls back on it, stealing orbital energy. Phobos sinks; in 30 to 50 million years tides will tear it apart and its pieces will spread into a ring.",
    note: "Deimos, the outer moon, orbits beyond the point where a moon keeps pace with Mars's spin, so it is drifting slowly outward instead. The long grooves on Phobos may already be stretch marks from Mars's tides.",
    accuracy: "Mars, Phobos's orbit and the synchronous orbit are to scale; Phobos and Deimos are drawn hundreds of times too large. The spiral and the breakup are a diagram: the point where Phobos breaks up and the ring's width are estimates.",
    art: { main: "mars", second: "rock", fx: "spiral" },
    scene(ctx) {
      /* Phobos semi-major axis 9,376 km = 2.77 Mars radii; synchronous
       * orbit 20,428 km = 6.03 radii (NASA). Inward 1.8 cm/yr (Jacobson
       * 2010). */
      const PHOBOS_A = 9376 / MARS_RADIUS;
      const SYNC = 20428 / MARS_RADIUS;
      /* Breakup taken at ~1.6 Mars radii (an estimate; drawing choice). */
      const BREAK = 1.6;
      /* layout */
      const RM = 0.12;
      const C = new THREE.Vector3(-0.22, 0.02, 0);
      const tiltGroup = new THREE.Group();
      tiltGroup.position.copy(C);
      tiltGroup.rotation.x = 1.08;
      ctx.add(tiltGroup);
      const mars = ctx.ball(RM, { body: "Mars", rim: 0.3, rimColour: "#ffb08a" });
      mars.position.copy(C);
      /* The tidal bulge, lagging behind Phobos (exaggerated). */
      const bulgePts = [];
      for (let i = 0; i <= 96; i += 1) {
        const a = (i / 96) * TAU;
        bulgePts.push([Math.cos(a) * RM * 1.3, 0, Math.sin(a) * RM * 1.06]);
      }
      const bulge = ctx.line(bulgePts, { colour: "#ffb08a", opacity: 0.9, parent: tiltGroup });
      ctx.circle(SYNC * RM, { colour: "#9fd0ff", opacity: 0.45, dashed: true, dash: 0.025, gap: 0.02, parent: tiltGroup });
      const syncLabel = ctx.label(["Synchronous orbit", "moons here keep pace with Mars's spin"], { at: [C.x + 0.48, C.y + 0.36, 0], height: 0.036, colour: "#bfe0ff" });
      const phobosOrbit = ctx.circle(PHOBOS_A * RM, { colour: "#ffd27f", opacity: 0.35, parent: tiltGroup });
      const zone = ctx.ring(RM * 1.35, RM * BREAK, { colour: "#ff6a4a", opacity: 0.18, parent: tiltGroup, additive: true });
      const spiralLine = ctx.line([[0, 0, 0], [0, 0, 0.001]], { colour: "#ffd27f", opacity: 0.85, parent: tiltGroup });
      const phobos = ctx.rock(0.026, { seed: 12, stretch: [1.25, 0.9, 1], colour: "#8a7d70", lumps: 0.3, parent: tiltGroup });
      /* Deimos: 23,463 km = 6.92 radii (NASA). */
      const deimos = ctx.rock(0.016, { seed: 3, colour: "#9a8f84", lumps: 0.25, parent: tiltGroup });
      const DEIMOS_A = 23463 / MARS_RADIUS;
      const phobosLabel = ctx.label(["Phobos", ""], { height: 0.036 });
      const deimosLabel = ctx.label(["Deimos", "drifting outward"], { height: 0.03 });
      const clock = ctx.label(["", ""], { at: [C.x, -0.62, 0], height: 0.044 });
      /* The ring: debris spread over 1.3–2.0 radii (drawing choice). */
      const RING = 900;
      const ring = ctx.cloud(RING, { size: 2.6, parent: tiltGroup });
      const r = rng(7);
      const debris = Array.from({ length: RING }, () => ({ rad: lerp(1.3, 2.0, r()), off: (r() - 0.5), dr: (r() - 0.5) * 0.06 }));
      debris.forEach((_, i) => ring.tint(i, r() > 0.5 ? "#b8a898" : "#8a7d70"));
      ctx.light.set(-0.5, 0.5, 0.7).normalize();

      /* Radius against time: tidal decay keeps a^6.5 falling linearly
       * (a standard result for tides raised on the planet), scaled so
       * breakup comes at about 40 million years (drawing choice within
       * the 30–50 Myr estimates). */
      const radiusAt = (f) => Math.pow(Math.pow(PHOBOS_A, 6.5) - f * (Math.pow(PHOBOS_A, 6.5) - Math.pow(BREAK, 6.5)), 1 / 6.5);
      const spiralPts = [];
      for (let i = 0; i <= 400; i += 1) {
        const f = i / 400;
        const a = radiusAt(f);
        /* Angle: many turns, a drawing choice. */
        const th = f * 36;
        spiralPts.push(new THREE.Vector3(Math.cos(th) * a * RM, 0, Math.sin(th) * a * RM));
      }

      ctx.tell([
        { at: 0, label: "A moon too close", text: "Phobos orbits 6,000 km above Mars, three times a Martian day — faster than Mars itself turns." },
        { at: 0.18, label: "Tides pull it in", text: "The bulge Phobos raises on Mars lags behind it and tugs it back. It sinks about 1.8 m every century." },
        { at: 0.45, label: "Spiralling down", text: "Millions of years pass. The closer it gets, the faster it falls." },
        { at: 0.72, label: "Torn apart", text: "In 30 to 50 million years Mars's tides break it up, and its pieces spread into a ring around the planet." },
      ]);
      const ph = new THREE.Vector3();
      return {
        duration: 20,
        update(p) {
          mars.rotation.y = ctx.t * 0.2;
          const f = easeInOut(span(p, 0.42, 0.74));
          const a = radiusAt(f);
          /* Before the fall: ~1.5 orbits; during it: the spiral's angle. */
          const th = p < 0.42 ? (p / 0.42) * TAU * 1.5 - TAU * 1.5 : f * 36;
          ph.set(Math.cos(th) * a * RM, 0, Math.sin(th) * a * RM);
          phobos.position.copy(ph);
          phobos.rotation.y = -th;
          const intact = p < 0.75;
          phobos.visible = intact;
          bulge.rotation.y = -th + 0.32;
          ctx.fade(bulge, smooth(p, 0.18, 0.26) * (1 - smooth(p, 0.75, 0.8)));
          const n = Math.max(2, Math.round(400 * f) + 1);
          ctx.setLine(spiralLine, spiralPts.slice(0, n));
          ctx.fade(spiralLine, smooth(p, 0.42, 0.46) * (1 - smooth(p, 0.84, 0.92)));
          ctx.fade(phobosOrbit, 1 - smooth(p, 0.42, 0.5) * 0.6);
          ctx.fade(zone, smooth(p, 0.5, 0.6));
          const dth = ctx.t * 0.05;
          deimos.position.set(Math.cos(dth) * DEIMOS_A * RM, 0, Math.sin(dth) * DEIMOS_A * RM);
          tiltGroup.updateMatrixWorld();
          const world = ph.clone().applyMatrix4(tiltGroup.matrix);
          phobosLabel.position.set(world.x, world.y + 0.07, 0.1);
          const km = a * MARS_RADIUS - MARS_RADIUS;
          phobosLabel.userData.draw(["Phobos", `${fmt(Math.round(km / 100) * 100)} km up`]);
          ctx.fade(phobosLabel, intact ? 1 : 0);
          const dw = deimos.position.clone().applyMatrix4(tiltGroup.matrix);
          deimosLabel.position.set(dw.x, dw.y - 0.06, 0.1);
          ctx.fade(deimosLabel, win(p, 0.02, 0.44));
          ctx.fade(syncLabel, win(p, 0.04, 0.42));
          /* Breakup and spreading. */
          const spread = smooth(p, 0.75, 0.96);
          debris.forEach((d, i) => {
            const ang = th + d.off * (0.3 + spread * TAU) + ctx.t * 0.25 / d.rad;
            const rad = lerp(BREAK, d.rad, spread) + d.dr * (1 - spread);
            ring.set(i, Math.cos(ang) * rad * RM, 0, Math.sin(ang) * rad * RM);
            ring.alpha[i] = p > 0.745 ? 0.85 : 0;
          });
          ring.commit();
          const myr = p < 0.42 ? 0 : p < 0.75 ? 40 * f : lerp(40, 50, span(p, 0.75, 0.95));
          clock.userData.draw([
            p < 0.42 ? "Today" : `+${myr.toFixed(0)} million years`,
            p < 0.42 ? "falling 1.8 m a century" : p < 0.75 ? "falling faster" : "a ring around Mars",
          ]);
        },
      };
    },
  }),
];

import * as THREE from "three";
import { event, smooth, span, lerp, planetMap } from "./kit.js";

/**
 * Section 10 of the catalogue: sky alignments (round 79).
 *
 * Three events about lines of sight: Jupiter overtaking Saturn, a "parade"
 * of planets along the ecliptic, and the Moon hiding Saturn. Planet positions
 * are computed here, not drawn by hand, from JPL's approximate Keplerian
 * elements (E. M. Standish, "Keplerian Elements for Approximate Positions of
 * the Major Planets", Table 1, valid 1800-2050) -- good to a few arcminutes,
 * plenty for a diagram. Checked: they put Jupiter and Saturn 0.10° apart on
 * 21 Dec 2020, as observed.
 */

const D2R = Math.PI / 180;

/* a (AU), e, I, L, long. perihelion, long. node (deg) at J2000, then rates
 * per Julian century (JPL Table 1). */
const ELEMENTS = {
  Mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  Venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  Earth: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0, 0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  Mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  Jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  Saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  Uranus: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503, -0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  Neptune: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, 0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
};
/* Orbital periods, days (NASA fact sheets), for sampling whole orbits. */
const PERIOD = { Mercury: 87.97, Venus: 224.7, Earth: 365.256, Mars: 686.98, Jupiter: 4332.59, Saturn: 10759.22, Uranus: 30685.4, Neptune: 60189 };

/** Heliocentric ecliptic position (AU, J2000 axes) at Julian date jd. */
function helio(name, jd) {
  const T = (jd - 2451545) / 36525;
  const el = ELEMENTS[name];
  const [a, e, I, L, w, O] = el.slice(0, 6).map((v, i) => v + el[i + 6] * T);
  const om = (w - O) * D2R;
  const M = ((((L - w) % 360) + 540) % 360 - 180) * D2R;
  let E = M;
  for (let k = 0; k < 12; k += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = Math.cos(om); const so = Math.sin(om);
  const cO = Math.cos(O * D2R); const sO = Math.sin(O * D2R);
  const cI = Math.cos(I * D2R); const sI = Math.sin(I * D2R);
  return new THREE.Vector3(
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  );
}
/** Geocentric ecliptic longitude and latitude, degrees. */
function geocentric(name, jd) {
  const g = helio(name, jd).sub(helio("Earth", jd));
  return { lon: ((Math.atan2(g.y, g.x) / D2R) + 360) % 360, lat: Math.atan2(g.z, Math.hypot(g.x, g.y)) / D2R, vec: g };
}
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateOf = (jd) => {
  const d = new Date((jd - 2440587.5) * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};

/*
 * A heliocentric position mapped into a diorama group lying in its XZ plane,
 * with distances compressed by a power law so the inner and outer planets
 * both fit (r' = scale * r^power). Ecliptic north is the group's +Y.
 */
const compress = (scale, power) => (v) => {
  const r = v.length();
  const s = r > 0 ? (scale * r ** power) / r : 0;
  return new THREE.Vector3(v.x * s, v.z * s, -v.y * s);
};

/* The Moon as a flat disc with an orthographic sphere shader, so it can be
 * magnified far past where a real sphere would reach the lens. */
const MOON_VERTEX = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const MOON_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uColor;
uniform vec3 uLight;
uniform float uOpacity;
varying vec2 vPos;
void main() {
  float rr = dot(vPos, vPos);
  if (rr > 1.0) discard;
  float z = sqrt(1.0 - rr);
  vec3 n = vec3(vPos, z);
  float lat = asin(clamp(vPos.y, -1.0, 1.0));
  float lon = atan(vPos.x, z);
  vec2 uv = vec2(0.5 + lon / 6.2831853, 0.5 + lat / 3.14159265);
  vec3 base = uColor;
  if (uHasMap > 0.5) base = texture2D(uMap, uv).rgb;
  float day = smoothstep(-0.05, 0.25, dot(n, normalize(uLight)));
  vec3 col = base * (0.035 + 1.05 * day);
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
function moonDisc(ctx, light) {
  const map = planetMap("Moon");
  const material = new THREE.ShaderMaterial({
    vertexShader: MOON_VERTEX,
    fragmentShader: MOON_FRAGMENT,
    uniforms: {
      uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uColor: { value: new THREE.Color("#a9a7a2") },
      uLight: { value: light.clone().normalize() }, uOpacity: { value: 1 },
    },
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 360), material);
  mesh.renderOrder = 23;
  mesh.raycast = () => {};
  ctx.add(mesh);
  return mesh;
}

/* Saturn with its rings, unit equatorial radius (rings 1.24-2.27 radii,
 * NASA Saturn ring fact sheet: C ring inner edge to A ring outer edge). */
function saturnWithRings(ctx, tilt = 0.42) {
  const group = new THREE.Group();
  ctx.add(group);
  ctx.ball(1, { body: "Saturn", parent: group, rim: 0.2 });
  const ringMap = planetMap("Saturn ring");
  ctx.ring(1.24, 2.27, { colour: ringMap ? "#ffffff" : "#e8d9b5", opacity: 0.9, map: ringMap, parent: group });
  group.rotation.set(tilt, 0, -0.12);
  return group;
}

export const ALIGNMENT_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "great-conjunction",
    section: "alignments",
    title: "The Great Conjunction",
    place: "Jupiter and Saturn",
    kind: "recorded",
    family: "alignment",
    when: "21 December 2020",
    often: "every 19.9 years",
    timeline: { last: "21 December 2020 — 0.1° apart", next: "Late 2040 — about 1° apart" },
    detail: "Jupiter and Saturn passed only 0.1° apart in our sky — the closest since 1623",
    frequency: "Jupiter laps Saturn every 19.86 years, so a 'great conjunction' comes round about every 20 years. Most pass about a degree apart; one as tight as 2020's is rare. The next as close will be on 15 March 2080.",
    cause: "Both planets orbit in nearly the same plane as Earth. Jupiter goes round the Sun in 11.9 years, Saturn in 29.5, so every 19.9 years Jupiter overtakes Saturn, and from Earth the two appear to meet in the sky. How close they look depends on the slight tilts of their orbits where the pass happens.",
    note: "In 1623 they came closer still, but too near the Sun to be seen. The last time a pass this close was easy to watch was in 1226. They only looked close: Saturn was about twice as far away as Jupiter.",
    accuracy: "Positions are computed from JPL's orbital elements. The orbit view compresses distances (Earth 1 AU, Jupiter 5.2, Saturn 9.6) so all three fit; the sky inset's angles are true, with the planets' discs enlarged and the moons placed for illustration.",
    art: { main: "jupiter", second: "saturn", fx: "lineup" },
    scene(ctx) {
      const hw = ctx.halfWidth;
      /* Model closest approaches (JPL elements): 2000 May 28 (1.15°) and
       * 2020 Dec 21, 06 UT (0.100°; observed: 6.1′ on 21 Dec). */
      const JD0 = 2451691.25;
      const JD1 = 2459205.75;
      const map = compress(0.62 / 9.6 ** 0.6, 0.6);
      const G = new THREE.Group();
      G.position.set(-hw * 0.95 + 0.66, -0.12, 0);
      G.rotation.x = 1.0;
      ctx.add(G);
      ctx.light.set(0.2, 0.6, 0.75).normalize();
      ctx.sun(0.045, { halo: 3, parent: G });
      const orbitOf = (name, colour) => {
        const pts = [];
        for (let k = 0; k <= 200; k += 1) pts.push(map(helio(name, JD1 + (k / 200) * PERIOD[name])));
        return ctx.line(pts, { colour, opacity: 0.35, parent: G });
      };
      orbitOf("Earth", "#7fb8ff");
      orbitOf("Jupiter", "#d8b48a");
      orbitOf("Saturn", "#e3cf9b");
      const earth = ctx.ball(0.024, { body: "Earth", parent: G });
      const jupiter = ctx.ball(0.045, { body: "Jupiter", parent: G });
      const saturn = ctx.ball(0.03, { body: "Saturn", parent: G });
      ctx.ring(0.03 * 1.24, 0.03 * 2.27, { colour: "#e8d9b5", opacity: 0.7, parent: saturn });
      const sightJ = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd9a8", opacity: 0.6, parent: G });
      const sightS = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#fff0c0", opacity: 0.6, parent: G, dashed: true, dash: 0.02, gap: 0.015 });
      const labels = [["Earth", earth], ["Jupiter", jupiter], ["Saturn", saturn]].map(([name, ball]) => ({ ball, label: ctx.label([name], { height: 0.024, parent: G }) }));
      const dateLabel = ctx.label(["", ""], { at: [G.position.x, 0.76, 0], height: 0.032 });

      /* The sky inset. */
      const IC = new THREE.Vector3(Math.min(0.72, hw * 0.66), 0.4, 0);
      const IH = 0.26;
      const inset = new THREE.Group();
      inset.position.copy(IC);
      ctx.add(inset);
      ctx.shape([[-IH, -IH], [IH, -IH], [IH, IH], [-IH, IH]], { colour: "#03060d", opacity: 0.85, parent: inset });
      ctx.line([[-IH, -IH, 0.01], [IH, -IH, 0.01], [IH, IH, 0.01], [-IH, IH, 0.01], [-IH, -IH, 0.01]], { colour: "#9fb3c8", opacity: 0.6, parent: inset });
      const skyJ = ctx.ball(0.016, { body: "Jupiter", parent: inset, night: 0.6 });
      const skyS = saturnWithRings(ctx, 0.45);
      inset.add(skyS);
      skyS.scale.setScalar(0.011);
      /* Galilean moons and Titan: offsets in arcminutes, illustrative. */
      const MOONS = [[2.1, 0.05], [-3.4, -0.08], [5.2, 0.1], [-8.1, -0.15]];
      const moons = ctx.cloud(5, { parent: inset, size: 3 });
      const ghost = ctx.circle(1, { plane: "xy", colour: "#cfd7e6", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.02, parent: inset });
      const ghostLabel = ctx.label(["Full Moon's width"], { height: 0.018, parent: inset, colour: "#cfd7e6" });
      const insetLabel = ctx.label(["", ""], { at: [IC.x, IC.y + IH + 0.07, 0], height: 0.028 });
      const box = inset.children.slice(0, 2);

      ctx.tell([
        { at: 0, label: "Every 20 years", text: "Jupiter goes round the Sun in 11.9 years, Saturn in 29.5. Starting from their last meeting, in May 2000, watch Jupiter catch up." },
        { at: 0.3, label: "Catching up", text: "Seen from Earth, the lines of sight to the two planets swing closer together, year by year." },
        { at: 0.62, label: "21 December 2020", text: "They passed just 0.1° apart — a fifth of the full Moon's width, the closest since 1623." },
        { at: 0.84, label: "One view", text: "Through a small telescope both fitted in the same view: Jupiter with its moons, Saturn with its rings." },
      ]);

      return {
        duration: 21,
        update(p) {
          const u = span(p, 0.04, 0.8);
          const jd = JD0 + (JD1 - JD0) * (1 - (1 - u) ** 3);
          const e = map(helio("Earth", jd));
          const j = map(helio("Jupiter", jd));
          const s = map(helio("Saturn", jd));
          earth.position.copy(e);
          jupiter.position.copy(j);
          saturn.position.copy(s);
          jupiter.rotation.y = ctx.t * 0.5;
          const ext = (to) => e.clone().add(to.clone().sub(e).normalize().multiplyScalar(0.8));
          ctx.setLine(sightJ, [e, ext(j)]);
          ctx.setLine(sightS, [e, ext(s)]);
          labels.forEach(({ ball, label }) => label.position.copy(ball.position).add(new THREE.Vector3(0, 0.0, -0.09)));
          const dt = dateOf(jd);
          dateLabel.userData.draw(u >= 1 ? ["21 December 2020", "the Great Conjunction"] : [`${MONTHS[dt.m]} ${dt.y}`, u <= 0 ? "the previous conjunction" : "Jupiter gains on Saturn"]);

          /* The inset: true angles from Earth, centred between the two. */
          const gj = geocentric("Jupiter", jd);
          const gs = geocentric("Saturn", jd);
          const sep = gj.vec.angleTo(gs.vec) / D2R;
          const dLon = wrap180(gj.lon - gs.lon);
          const midLon = gs.lon + dLon / 2;
          const midLat = (gj.lat + gs.lat) / 2;
          const fov = Math.min(60, Math.max(0.62, sep * 2.4));
          const k = (2 * IH) / fov;
          /* East to the left, as in the sky facing south. */
          const place = (g) => [-wrap180(g.lon - midLon) * Math.cos(midLat * D2R) * k, (g.lat - midLat) * k];
          const [jx, jy] = place(gj);
          const [sx, sy] = place(gs);
          const inside = (x, y) => Math.abs(x) < IH - 0.03 && Math.abs(y) < IH - 0.03;
          skyJ.position.set(jx, jy, 0.03);
          skyJ.visible = inside(jx, jy);
          skyS.position.set(sx, sy, 0.03);
          skyS.visible = inside(sx, sy);
          const showMoons = (1 - smooth(fov, 2, 4)) * (skyJ.visible ? 1 : 0);
          MOONS.forEach(([dx, dy], i) => { moons.set(i, jx + (dx / 60) * k, jy + (dy / 60) * k, 0.04); moons.alpha[i] = showMoons * 0.9; moons.tint(i, "#e8e2d6"); });
          moons.set(4, sx - (3.0 / 60) * k, sy + (0.4 / 60) * k, 0.04);
          moons.alpha[4] = showMoons * 0.7;
          moons.tint(4, "#e0b070");
          moons.commit();
          /* The full Moon, ~0.52° wide, for scale. */
          ghost.scale.setScalar(0.26 * k);
          ghost.position.set((jx + sx) / 2, (jy + sy) / 2, 0.02);
          const g = smooth(p, 0.82, 0.88);
          ctx.fade(ghost, g);
          ghostLabel.position.set(ghost.position.x, ghost.position.y - 0.26 * k - 0.035, 0.02);
          ctx.fade(ghostLabel, g);
          const sepText = sep < 1 ? `${sep.toFixed(2)}° apart (${(sep * 60).toFixed(1)}′)` : `${sep.toFixed(1)}° apart`;
          insetLabel.userData.draw(["Seen from Earth", sepText]);
          /* The frame comes in once the two are within ~25° (layout). */
          const boxA = 1 - smooth(sep, 25, 45);
          box.forEach((b) => ctx.fade(b, boxA));
          skyJ.visible = skyJ.visible && boxA > 0.5;
          skyS.visible = skyS.visible && boxA > 0.5;
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "planet-parade",
    section: "alignments",
    title: "Planet parade",
    place: "The whole Solar System",
    kind: "recurring",
    family: "alignment",
    when: "e.g. 28 February 2025 (all seven)",
    often: "several planets: most years",
    timeline: { last: "28 February 2025 — all seven", next: "Smaller gatherings most years" },
    detail: "Several planets strung along one arc of the evening sky — not lined up in space, just all sharing one flat plane",
    frequency: "Some gathering of several planets in the evening or morning sky happens most years. All seven together, as on 28 February 2025, is rarer — and even then Mercury and Saturn were low in the twilight, and Uranus and Neptune needed binoculars or a telescope.",
    cause: "The planets formed from one flat disc of gas and dust around the young Sun, so their orbits still lie within a few degrees of the same plane. From Earth, inside that plane, we always see them along the same line across the sky: the ecliptic, the Sun's yearly path. A 'parade' just means several happen to be on the same side of the Sun as seen from Earth, so they are up together after sunset or before dawn.",
    note: "'Planet parade' is a popular name, not an astronomical term. On 28 February 2025 the seven spread over about 125° of sky, from Saturn near the setting Sun to Mars high in the east.",
    accuracy: "Positions for 28 February 2025 are computed from JPL's orbital elements. The view from above compresses distances so all eight orbits fit; the sky view is a schematic of the evening sky, with each planet placed at its true angle from the Sun along the ecliptic.",
    art: { main: "jupiter", second: "venus", fx: "lineup" },
    scene(ctx) {
      const hw = ctx.halfWidth;
      /* 28 Feb 2025, 18:00 UT. */
      const JD = 2460735.25;
      const NAMES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
      const map = compress(0.8 / 30.1 ** 0.45, 0.45);
      const A = new THREE.Group();
      A.position.set(-0.08, 0.02, 0);
      ctx.add(A);
      ctx.light.set(0.1, 0.7, 0.7).normalize();
      ctx.sun(0.04, { halo: 3, parent: A });
      const earthPos = map(helio("Earth", JD));
      const bodies = ["Earth", ...NAMES].map((name) => {
        const pts = [];
        for (let k = 0; k <= 160; k += 1) pts.push(map(helio(name, JD + (k / 160) * PERIOD[name])));
        ctx.line(pts, { colour: name === "Earth" ? "#7fb8ff" : "#9fb3c8", opacity: name === "Earth" ? 0.6 : 0.3, parent: A });
        const big = name === "Jupiter" || name === "Saturn";
        const ball = ctx.ball(big ? 0.03 : 0.018, { body: name, parent: A, rim: 0.3 });
        ball.position.copy(map(helio(name, JD)));
        const sight = name === "Earth" ? null : ctx.line([earthPos, ball.position.clone()], { colour: "#ffe6a8", opacity: 0.5, parent: A });
        return { name, ball, sight };
      });
      const LABELLED = ["Earth", "Venus", "Mars", "Jupiter", "Saturn"];
      const aLabels = bodies.filter((b) => LABELLED.includes(b.name)).map((b) => ctx.label([b.name], { at: b.ball.position.clone().add(new THREE.Vector3(0, 0, -0.06)), height: 0.022, parent: A, colour: b.name === "Earth" ? "#bfe0ff" : "#e8f1ff" }));
      const header = ctx.label(["", ""], { at: [0, 0.76, 0], height: 0.03 });

      /* The evening sky (schematic). */
      const B = new THREE.Group();
      ctx.add(B);
      const X0 = -hw * 0.92;
      const X1 = hw * 0.88;
      const GX1 = hw * 0.95;
      const HORIZON = -0.5;
      ctx.shape([[X0, -0.84], [GX1, -0.84], [GX1, HORIZON], [X0, HORIZON]], { colour: "#02040a", opacity: 0.95, parent: B });
      ctx.line([[X0, HORIZON, 0.01], [GX1, HORIZON, 0.01]], { colour: "#6f86a8", opacity: 0.7, parent: B });
      const P0 = new THREE.Vector2(X0 + 0.1, -0.68);
      const P1 = new THREE.Vector2(-0.15, 0.98);
      const P2 = new THREE.Vector2(X1, -0.02);
      const twilight = ctx.glow("#ff9a50", 1.5, { opacity: 0.55, parent: B });
      twilight.position.set(P0.x + 0.1, HORIZON, -0.05);
      /* The ecliptic as a Bezier, measured by arc length so equal angles get
       * equal steps (0° at the Sun to 140°). */
      const bez = (t) => new THREE.Vector2(
        (1 - t) ** 2 * P0.x + 2 * t * (1 - t) * P1.x + t * t * P2.x,
        (1 - t) ** 2 * P0.y + 2 * t * (1 - t) * P1.y + t * t * P2.y,
      );
      const samples = [];
      let acc = 0;
      for (let k = 0; k <= 400; k += 1) {
        const v = bez(k / 400);
        if (k) acc += v.distanceTo(samples[k - 1].v);
        samples.push({ v, acc });
      }
      const total = acc;
      const along = (elong) => {
        const target = (elong / 140) * total;
        const i = samples.findIndex((s) => s.acc >= target);
        return samples[Math.max(0, i)].v;
      };
      const ecl = ctx.line(samples.filter((s) => s.v.y > HORIZON).map((s) => [s.v.x, s.v.y, 0]), { colour: "#ffd27f", opacity: 0.45, dashed: true, dash: 0.025, gap: 0.02, parent: B });
      void ecl;
      const sunGeo = (() => { const g = helio("Earth", JD).negate(); return ((Math.atan2(g.y, g.x) / D2R) + 360) % 360; })();
      const sky = NAMES.map((name) => {
        const g = geocentric(name, JD);
        const elong = wrap180(g.lon - sunGeo);
        const at = along(elong);
        const faint = name === "Uranus" || name === "Neptune";
        const size = name === "Venus" ? 0.022 : name === "Jupiter" ? 0.02 : faint ? 0.008 : 0.014;
        const ball = ctx.ball(size, { body: name, parent: B, night: 0.9 });
        ball.position.set(at.x, at.y, 0.02);
        const halo = ctx.glow(faint ? "#9fc8ff" : "#fff2d0", size * (faint ? 5 : 7), { opacity: faint ? 0.35 : 0.6, parent: B });
        halo.position.copy(ball.position);
        return { name, elong, ball, halo };
      });
      const byName = Object.fromEntries(sky.map((s) => [s.name, s]));
      const skyLabel = (lines, name, dy = 0.07) => {
        const at = byName[name].ball.position.clone().add(new THREE.Vector3(0, dy, 0));
        return ctx.label(lines, { at, height: 0.023, parent: B });
      };
      const bLabels = [
        skyLabel(["Venus"], "Venus"),
        skyLabel(["Jupiter"], "Jupiter"),
        skyLabel(["Mars"], "Mars"),
        skyLabel(["Uranus", "binoculars"], "Uranus", -0.08),
        ctx.label(["Mercury, Saturn, Neptune", "low in the twilight"], { at: [byName.Mercury.ball.position.x + 0.32, HORIZON + 0.06, 0], height: 0.023, parent: B }),
        ctx.label(["Looking west after sunset"], { at: [P0.x + 0.25, HORIZON - 0.08, 0], height: 0.019, parent: B, colour: "#9fb3c8" }),
      ];
      const eclLabel = ctx.label(["The ecliptic"], { at: [along(55).x, along(55).y + 0.06, 0], height: 0.024, parent: B, colour: "#ffd27f" });
      bLabels.push(eclLabel);

      ctx.tell([
        { at: 0, label: "28 February 2025", text: "All seven other planets were in the evening sky at once. Seen from above, here is where they really were: spread all round the Sun." },
        { at: 0.27, label: "One flat plane", text: "Tilt the view edge-on. Every orbit lies in nearly the same plane — so from inside it, the planets all fall along one line." },
        { at: 0.5, label: "From Earth", text: "That line in our sky is the ecliptic, the Sun's path. Every planet is always somewhere along it." },
        { at: 0.7, label: "The parade", text: "So after sunset they stood along one arc: Saturn, Mercury and Neptune low in the twilight, then Venus, Uranus, Jupiter and Mars." },
      ]);

      return {
        duration: 21,
        update(p) {
          A.rotation.x = lerp(1.25, 0.04, smooth(p, 0.28, 0.44));
          const aShow = 1 - smooth(p, 0.46, 0.52);
          ctx.fade(A, aShow);
          bodies.forEach((b) => { if (b.sight) ctx.fade(b.sight, aShow * smooth(p, 0.08, 0.15) * 0.8); b.ball.rotation.y = ctx.t * 0.4; });
          aLabels.forEach((l) => ctx.fade(l, aShow * smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.3, 0.36))));
          header.userData.draw(p < 0.28 ? ["28 February 2025", "the planets seen from above"] : ["Edge-on", "the same planets, seen along their plane"]);
          ctx.fade(header, aShow);
          const bShow = smooth(p, 0.5, 0.56);
          ctx.fade(B, bShow);
          sky.forEach((s, i) => {
            const order = [...sky].sort((a, b) => a.elong - b.elong).indexOf(s);
            const on = bShow * smooth(p, 0.56 + order * 0.03, 0.6 + order * 0.03);
            ctx.fade(s.ball, on);
            ctx.fade(s.halo, on * (0.85 + 0.15 * Math.sin(ctx.t * 3 + i)));
          });
          bLabels.forEach((l, i) => ctx.fade(l, bShow * smooth(p, 0.62 + Math.min(i, 5) * 0.02, 0.68 + Math.min(i, 5) * 0.02)));
          ctx.fade(eclLabel, bShow * smooth(p, 0.54, 0.6));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "lunar-occultation",
    section: "alignments",
    title: "The Moon hides a planet",
    place: "Earth's sky · the Moon and Saturn",
    kind: "recurring",
    family: "alignment",
    often: "several times a year, somewhere",
    detail: "The Moon slides in front of Saturn: its airless edge slices across the globe and rings, and about an hour later they reappear on the other side",
    frequency: "The Moon hides each planet in runs: while its path crosses a planet's, it covers it once a month for a year or more, each time seen only from part of the Earth. Bright stars are hidden the same way.",
    cause: "The Moon moves across the stars by about its own width every hour as it orbits Earth. When a planet lies on its path, the Moon passes in front of it. Because the Moon is so close, where you stand on Earth shifts its position against the sky by up to about two of its own widths, so each event is seen only from part of the globe.",
    note: "With no air at the Moon's edge there is no fading: a star winks out at once. A planet takes longer only because it is a disc — Saturn's globe goes in about half a minute, its rings in a little over a minute.",
    accuracy: "The Moon and Saturn are to one scale in each view: the Moon about 31 arcminutes wide, Saturn's rings about 40 arcseconds. The Moon's motion is speeded up between the close-ups, and the clock shows real time. The rings' tilt is chosen for clarity.",
    art: { main: "moon", second: "saturn", fx: "eclipse" },
    scene(ctx) {
      /* Angles in arcseconds: Moon radius 932″ (31′ wide, mean); Saturn
       * equatorial radius 8.5″ (typical); the Moon moves 0.549″ a second
       * against the stars (360° in 27.32 days). */
      const MOON_R = 932;
      const SAT_R = 8.5;
      const RING_R = SAT_R * 2.27;
      const V = 0.549;
      const CHORD = -380; /* Moon centre 380″ south of Saturn: drawing choice */
      const HALF = Math.sqrt(MOON_R * MOON_R - CHORD * CHORD);
      /* T = 0 when the leading edge touches the rings' near tip. */
      const X0 = -RING_R - HALF;
      /* layout */
      const S = new THREE.Vector3(0.3, 0.08, 0);
      const K0 = 0.55 / MOON_R;
      ctx.light.set(0.6, 0.35, 0.75).normalize();
      const saturn = saturnWithRings(ctx, 0.42);
      const speck = ctx.glow("#ffe9b0", 0.07, { opacity: 0.9 });
      speck.renderOrder = 22;
      speck.position.copy(S);
      const moon = moonDisc(ctx, new THREE.Vector3(0.75, 0.1, 0.65));
      const moonLabel = ctx.label(["The Moon", "31′ wide"], { height: 0.026 });
      const satLabel = ctx.label(["Saturn", "rings ~40″ wide"], { height: 0.024 });
      const zoomLabel = ctx.label([""], { at: [S.x, 0.56, 0], height: 0.02, colour: "#9fb3c8" });
      const clock = ctx.label(["", ""], { at: [S.x, 0.7, 0], height: 0.032 });

      /* Real seconds since first contact, as a function of progress. */
      const STEPS = [
        [0, -900, 1], [0.18, -300, 1], [0.34, -15, 14], [0.58, 95, 14], [0.64, 600, 1],
        [0.72, 2950, 1], [0.78, 3080, 14], [0.97, 3200, 14], [1, 3210, 14],
      ];
      const at = (p) => {
        for (let i = 1; i < STEPS.length; i += 1) {
          const [pa, ta, za] = STEPS[i - 1];
          const [pb, tb, zb] = STEPS[i];
          if (p <= pb) {
            const u = span(p, pa, pb);
            const e = u * u * (3 - 2 * u);
            return { T: lerp(ta, tb, za === zb ? u : e), Z: lerp(za, zb, e) };
          }
        }
        return { T: 3210, Z: 14 };
      };
      const END_IN = (2 * RING_R) / V;
      const START_OUT = (2 * HALF) / V;

      ctx.tell([
        { at: 0, label: "To scale", text: "The Moon and Saturn as a telescope shows them, to one scale. Saturn is the speck beside the Moon's edge." },
        { at: 0.18, label: "Closer", text: "Magnify fourteen times. The Moon's edge creeps across the sky at about half an arcsecond a second." },
        { at: 0.34, label: "Gone", text: "No air, so no fading: the sharp edge slices away a ring tip, the globe, then the rest of the rings." },
        { at: 0.6, label: "An hour later", text: "The Moon carries on across. About 52 minutes later Saturn reaches its far edge." },
        { at: 0.78, label: "Back again", text: "On the far side the rings reappear first, then the globe — as suddenly as they went." },
      ]);

      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          const { T, Z } = at(p);
          const k = K0 * Z;
          const xc = X0 + V * T;
          moon.position.set(S.x + xc * k, S.y + CHORD * k, 0.05);
          moon.scale.setScalar(MOON_R * k);
          saturn.position.copy(S);
          saturn.scale.setScalar(SAT_R * k);
          saturn.children[0].rotation.y = ctx.t * 0.2;
          ctx.fade(speck, 1 - smooth(Z, 1.5, 4));
          moonLabel.position.set(moon.position.x, moon.position.y - MOON_R * k - 0.06, 0);
          ctx.fade(moonLabel, (1 - smooth(Z, 1.2, 2)) * smooth(p, 0.01, 0.05));
          satLabel.position.set(S.x, S.y + Math.max(0.07, RING_R * k * 0.6 + 0.09), 0);
          /* Hide Saturn's label while the Moon covers it. */
          const covered = T > 0 && T < START_OUT + END_IN;
          ctx.fade(satLabel, smooth(p, 0.02, 0.06) * (covered ? 0 : 1));
          zoomLabel.userData.draw([Z > 1.05 ? `Magnified ×${Math.round(Z)}` : "Moon and Saturn to one scale"]);
          ctx.fade(zoomLabel, smooth(p, 0.02, 0.06));
          let lines;
          if (T < 0) lines = ["Moon's edge approaching", `contact in ${Math.ceil(-T)} s`];
          else if (T <= END_IN + 1) lines = ["Disappearing", `${Math.floor(T)} s`];
          else if (T < START_OUT) lines = ["Saturn is behind the Moon", `+${Math.floor(T / 60)} min`];
          else if (T <= START_OUT + END_IN + 1) lines = ["Reappearing", `+${Math.floor(T / 60)} min ${Math.floor(T % 60)} s`];
          else lines = ["Back", `hidden for ${Math.round((START_OUT + END_IN) / 60)} minutes`];
          clock.userData.draw(lines);
          ctx.fade(clock, smooth(p, 0.02, 0.06));
        },
      };
    },
  }),
];


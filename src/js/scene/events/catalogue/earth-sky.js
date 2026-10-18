import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut, planetMap, BODY_COLOURS } from "./kit.js";
import { bodyRadius, surfacePoint as bodyPoint, yawFor, flyTo, WHITE_SUN, cutter, yawWithRight, cameraAxes } from "./real.js";
import { earthLayers, earthSkin, moonRig, moonShadow, limbRing, moltenBall, spinner } from "./earthMoon.js";

/**
 * Section 3 of the catalogue: Earth's sky -- eclipses and the Moon (round 79).
 *
 * Eleven events: the three eclipses, the supermoon, the phases, the tides,
 * tidal locking, libration, earthshine, the Moon's birth and moonquakes.
 * Round 83 (Prompts.md: "do it with the real bodies"): the lunar and annular
 * eclipses, the supermoon, the tides, tidal locking, libration, earthshine
 * and the Moon's birth now play on the site's own Earth, Moon and Sun
 * (earthMoon.js); the phases, the 2027 eclipse and moonquakes stay
 * dioramas. Each says in `accuracy` what is to scale and what is not.
 *
 * Sizes and distances are NASA's planetary fact sheets (nssdc.gsfc.nasa.gov
 * /planetary/factsheet) and eclipse data are Fred Espenak's tables
 * (eclipse.gsfc.nasa.gov, eclipsewise.com) unless a comment says otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, "0")} s`;
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/* Mean radii, km (NASA fact sheets). */
const EARTH_RADIUS = 6371;
const MOON_RADIUS = 1737.4;
const MARS_RADIUS = 3389.5;

/*
 * A point at latitude/longitude (degrees) on a sphere drawn with a planet
 * map: three.js SphereGeometry puts u = 0 (longitude -180) on -x and
 * longitude 0 on +x, with east toward -z.
 */
function geo(r, lat, lon) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
/* Turns a mapped sphere so (lat, lon) faces the viewer, north up. */
function face(mesh, lat, lon) {
  mesh.rotation.set(lat * DEG, -(Math.PI / 2 + lon * DEG), 0);
}

/* ------------------------------------------------------------ the Moon */

/*
 * The Moon with its own light and Earth's shadow on it. Unlike kit's lit
 * balls it keeps its own light direction (an inset can show a phase while
 * the main diagram is lit from elsewhere), and it can carry an umbra and
 * penumbra -- circles in the plane of the screen, in Moon radii -- with the
 * umbra glowing copper, and a faint earthshine on its night side.
 */
const MOON_VERTEX = /* glsl */ `
uniform float uRadius;
varying vec3 vNormalView;
varying vec2 vUv;
varying vec2 vRel;
void main() {
  vUv = uv;
  vNormalView = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float scale = length(modelViewMatrix[0].xyz) * uRadius;
  vRel = (mv.xy - centre.xy) / scale;
  gl_Position = projectionMatrix * mv;
}
`;
const MOON_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uColor;
uniform vec3 uLight;
uniform vec2 uShadow;
uniform float uUmbra;
uniform float uPenumbra;
uniform float uRed;
uniform float uEarthshine;
uniform float uGain;
uniform float uOpacity;
varying vec3 vNormalView;
varying vec2 vUv;
varying vec2 vRel;
void main() {
  vec3 base = uColor;
  if (uHasMap > 0.5) base = texture2D(uMap, vUv).rgb * uColor;
  vec3 n = normalize(vNormalView);
  float day = smoothstep(-0.05, 0.2, dot(n, normalize(uLight)));
  float d = length(vRel - uShadow);
  float pen = mix(0.42, 1.0, smoothstep(uUmbra, uPenumbra, d));
  vec3 lit = base * day * pen * uGain;
  float lum = dot(base, vec3(0.3, 0.5, 0.2));
  float edge = clamp(d / max(uUmbra, 0.001), 0.0, 1.0);
  vec3 copper = vec3(0.78, 0.2, 0.06) * lum * mix(0.55, 1.5, edge * edge) * uRed;
  float inUmbra = 1.0 - smoothstep(uUmbra - 0.07, uUmbra + 0.05, d);
  vec3 col = mix(lit, copper * day, inUmbra);
  col += base * (1.0 - day) * uEarthshine * vec3(0.6, 0.72, 0.98);
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
function moonBall(ctx, radius, { parent = ctx.root, light = [0, 0, 1], gain = 1, earthshine = 0 } = {}) {
  const map = planetMap("Moon");
  const material = new THREE.ShaderMaterial({
    vertexShader: MOON_VERTEX,
    fragmentShader: MOON_FRAGMENT,
    uniforms: {
      uMap: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uColor: { value: new THREE.Color(map ? "#ffffff" : BODY_COLOURS.Moon) },
      uLight: { value: new THREE.Vector3(...light).normalize() },
      uRadius: { value: radius },
      uShadow: { value: new THREE.Vector2(99, 99) },
      uUmbra: { value: 0 },
      uPenumbra: { value: 0.001 },
      uRed: { value: 0 },
      uEarthshine: { value: earthshine },
      uGain: { value: gain },
      uOpacity: { value: 1 },
    },
    toneMapped: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), material);
  mesh.raycast = () => {};
  mesh.renderOrder = 20;
  /* Near side to the viewer: selenographic longitude 0 is the map's centre. */
  mesh.rotation.y = -Math.PI / 2;
  parent.add(mesh);
  mesh.userData.u = material.uniforms;
  return mesh;
}

/* The Moon's black disc in front of the Sun, drawn over the Sun's glow. */
function silhouette(ctx, radius, parent) {
  const disc = ctx.disc(radius, { colour: "#000000", depthTest: false, parent });
  disc.renderOrder = 29;
  return disc;
}

/* A filled outline whose radius changes with angle (the tidal bulges). */
function fan(ctx, segments, { colour = "#3a8fe0", opacity = 0.6, parent = ctx.root } = {}) {
  const position = new Float32Array((segments + 2) * 3);
  const index = [];
  for (let i = 1; i <= segments; i += 1) index.push(0, i, i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
  }));
  mesh.renderOrder = 19;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = opacity;
  mesh.userData.shape = (radiusAt) => {
    for (let i = 0; i <= segments; i += 1) {
      const a = (i / segments) * TAU;
      const r = radiusAt(a);
      position[(i + 1) * 3] = Math.cos(a) * r;
      position[(i + 1) * 3 + 1] = Math.sin(a) * r;
      position[(i + 1) * 3 + 2] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
  };
  parent.add(mesh);
  return mesh;
}

/* Area of overlap of two discs (radii R, r, centres d apart). */
function overlap(R, r, d) {
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return Math.PI * Math.min(R, r) ** 2;
  const a = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
  const b = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
  const c = 0.5 * Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
  return a + b - c;
}

/* The solar corona: an inner glow, streamers and a haze of particles. */
function corona(ctx, R, parent) {
  const group = new THREE.Group();
  parent.add(group);
  ctx.glow("#f6f3ff", R * 3.4, { opacity: 0.85, parent: group });
  ctx.glow("#c9d8ff", R * 7, { opacity: 0.3, parent: group });
  const r = rng(27);
  /* drawing choice: 34 streamers, the longest near the Sun's equator, as
   * in photographs of the corona away from solar minimum's flat shape. */
  const streamers = Array.from({ length: 34 }, (_, i) => {
    const a = (i / 34) * TAU + (r() - 0.5) * 0.15;
    const len = 0.7 + 1.9 * Math.abs(Math.cos(a)) ** 3 + r() * 0.7;
    return { a, len, bend: (r() - 0.5) * 0.25 };
  });
  streamers.forEach((s) => {
    const points = [];
    for (let k = 0; k <= 12; k += 1) {
      const t = k / 12;
      const rr = R * (1 + s.len * t);
      const a = s.a + s.bend * t * t;
      points.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0));
    }
    ctx.line(points, { colour: "#e4ebff", opacity: 0.16 + r() * 0.16, parent: group });
  });
  const N = 2600;
  const haze = ctx.cloud(N, { parent: group, size: 2.4 });
  for (let i = 0; i < N; i += 1) {
    const s = streamers[Math.floor(r() * streamers.length)];
    const t = Math.pow(r(), 1.8);
    const rr = R * (1.0 + s.len * t);
    const a = s.a + s.bend * t * t + (r() - 0.5) * 0.12 * (1 + t);
    haze.set(i, Math.cos(a) * rr, Math.sin(a) * rr, 0);
    haze.alpha[i] = 0.5 * (1 - t) ** 2 + 0.05;
    haze.size[i] = 1.6 + r() * 2.4;
    haze.tint(i, r() > 0.5 ? "#f2f4ff" : "#cddcff");
  }
  haze.commit();
  /* Prominences: pink hydrogen-alpha loops at the limb. */
  [[0.5, 0.05], [2.4, 0.04], [3.9, 0.06], [5.3, 0.035]].forEach(([a, size]) => {
    const glow = ctx.glow("#ff4f78", size, { opacity: 0.95, parent: group });
    glow.position.set(Math.cos(a) * R * 1.03, Math.sin(a) * R * 1.03, 0);
  });
  return group;
}

export const EARTH_SKY_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "lunar-eclipse",
    section: "earth",
    body: "Earth",
    title: "Total lunar eclipse: the “blood moon”",
    place: "Earth and the Moon",
    kind: "recurring",
    family: "alignment",
    often: "about 85 a century",
    timeline: { last: "March 3, 2026", next: "December 31, 2028" },
    detail: "Earth's shadow creeps over the full Moon and turns it copper-red, lit by the light of every sunrise and sunset on Earth",
    frequency: "Only at full Moon, and only when the Moon is near a crossing point of its orbit, which is tilted about 5° to Earth's. The 21st century has 85 total lunar eclipses, in clusters: two in 2025, one on March 3, 2026, then none until December 31, 2028.",
    cause: "Earth blocks the Sun and casts a shadow: a dark core, the umbra, inside a paler penumbra. At the Moon's distance the umbra is about 2.7 Moons wide. Sunlight passing through Earth's atmosphere is bent into the umbra, and on the way the blue is scattered out, so what reaches the Moon is red.",
    note: "Unlike a solar eclipse, a lunar eclipse is seen from the whole night side of Earth at once, and it is safe to watch with the naked eye. How red it turns depends on how much dust and cloud is in Earth's atmosphere at the time.",
    accuracy: "Played on the site's own Earth and Moon, with the real Sun's direction. The site draws the Moon about 19 times closer than it really is, so its orbit is shown flat in the plane of Earth's orbit, and the shadow is drawn in its true width against the Moon: the umbra 2.65 Moon radii, the penumbra 4.7. How fast the Moon moves is sped up; the eclipse of March 3, 2026 lasted 58 minutes in totality.",
    art: { main: "moon", second: "earth", fx: "eclipse" },
    shotZoom: 2.3,
    shotPitch: 0.16,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody) return { duration: 24, update() {} };
      const U = ctx.unit;
      const D = rig.distance;
      const Rm = rig.radius;
      /* Shadow radii at the Moon's mean distance, in Moon radii: umbra
       * ~4,600 km, penumbra ~8,200 km (cone geometry from the Sun's 695,700
       * km and Earth's 6,371 km radii, 1 AU and 384,400 km; the atmosphere
       * widens the real umbra by about 2%), over the Moon's 1,737 km. */
      const UMBRA = 2.65 * Rm;
      const PEN = 4.7 * Rm;
      const shadow = moonShadow(ctx, rig, { umbra: UMBRA, pen: PEN });
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      const E = new THREE.Vector3();
      const S = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      earth.getWorldPosition(E);
      sunBody.getWorldPosition(S);
      const anti0 = E.clone().sub(S).setY(0).normalize();
      /* Side-on, the Sun off to the right and the shadow running left,
       * so the Moon comes in on the clear side of the screen (the event
       * card sits on the right). */
      ctx.refocus("Earth", { shotYaw: yawWithRight(anti0.clone().negate()), shotZoom: 2.6, shotPitch: 0.16 });

      /* ---- Earth's shadow behind it: umbra and penumbra, true width at
       * the Moon, drawn out past the Moon's orbit (root: Earth radii). */
      const cones = new THREE.Group();
      ctx.add(cones);
      const L = (D / U) * 1.55;
      const cone = (rEnd, colour, opacity) => {
        const g = new THREE.CylinderGeometry(rEnd, 1, L, 64, 1, true);
        g.translate(0, L / 2, 0);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
        m.userData.baseOpacity = opacity;
        m.renderOrder = 3;
        m.raycast = () => {};
        m.quaternion.setFromUnitVectors(up, anti0);
        cones.add(m);
        return m;
      };
      /* Radius at the far end, from Earth's at its limb to the true one at
       * the Moon's distance, carried on in a straight line. */
      const at = (r) => 1 + ((r / U) - 1) * (L / (D / U));
      cone(at(PEN), "#2a3550", 0.16);
      cone(at(UMBRA), "#000000", 0.42);
      const side0 = new THREE.Vector3().crossVectors(up, anti0).normalize();
      const edges = [UMBRA, PEN].flatMap((r, k) => [1, -1].map((s) => ctx.line([
        side0.clone().multiplyScalar(s),
        anti0.clone().multiplyScalar(L).addScaledVector(side0, s * at(r)),
      ], { colour: k ? "#7f8fb8" : "#b9c6e6", opacity: k ? 0.35 : 0.6, dashed: k === 1, dash: 0.08, gap: 0.06, parent: cones })));
      void edges;
      const orbit = ctx.circle(D / U, { plane: "xz", colour: "#cfd7e6", opacity: 0.28, dashed: true, dash: 0.08, gap: 0.08 });
      const umbraLabel = ctx.label(["Umbra", "Earth's dark shadow"], { at: anti0.clone().multiplyScalar(L * 0.86).add(new THREE.Vector3(0, 0.15, 0)), height: 0.026, declutter: false });
      const penLabel = ctx.label(["Penumbra"], { at: anti0.clone().multiplyScalar(L * 0.86).addScaledVector(side0, at(PEN) * 0.9).add(new THREE.Vector3(0, 0.6, 0)), height: 0.022, sub: "#9fb3c8", declutter: false });
      const moonLabel = ctx.label(["Full Moon"], { height: 0.026, declutter: false });

      /* ---- Earth's limb, red with every sunrise and sunset, seen from the
       * Moon (root: Earth radii, so 1 is the surface). */
      const ring = limbRing(ctx, 0.99, 1.1, { colour: "#ff6a2e", opacity: 0.95 });
      ctx.fade(ring, 0);

      const hud = ctx.hudLayer();
      const title = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const sunArrow = ctx.arrow([1.3, 0.66, 0], [1.0, 0.66, 0], { colour: "#ffffff", opacity: 0.85, head: 0.04, parent: hud });
      const sunWords = ctx.label(["Sunlight"], { parent: hud, at: [1.15, 0.73, 0], height: 0.024, declutter: false });
      const cutWords = ctx.label([""], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      ctx.tell([
        { at: 0, label: "Full Moon", text: "The Sun, Earth and the Moon come into line. Earth casts a long shadow: a dark umbra inside a paler penumbra." },
        { at: 0.16, label: "Into the shadow", text: "The Moon's orbit is tilted about 5°, so most full Moons pass above or below it. This one goes straight in." },
        { at: 0.34, label: "Seen from Earth", text: "From Earth's night side: the umbra's curved edge creeps across the Moon. The curve is the outline of Earth itself." },
        { at: 0.52, label: "Blood moon", text: "Totality: the Moon does not vanish. It glows copper-red. Last: March 3, 2026. Next: December 31, 2028." },
        { at: 0.74, label: "Why red", text: "Seen from the Moon, Earth hides the Sun and its edge glows red: sunlight bent through Earth's air, every sunrise and sunset at once." },
      ]);

      const cut = cutter(ctx, veil);
      let shot = 0;
      const M = new THREE.Vector3();
      const toE = new THREE.Vector3();
      /* The Moon's angle from the middle of the shadow, degrees, prograde
       * (anticlockwise seen from the north): penumbra first contact near
       * -41°, umbra near -25°, totality inside -11° (with the shadow radii
       * above and the site's Moon distance). */
      const angleAt = (p) => (p < 0.32 ? lerp(-58, -27, easeInOut(span(p, 0.02, 0.3)))
        : p < 0.72 ? lerp(-27, 1, span(p, 0.34, 0.72)) : lerp(1, 8, span(p, 0.74, 1)));
      return {
        duration: 24,
        update(p) {
          earth.getWorldPosition(E);
          sunBody.getWorldPosition(S);
          const anti = E.clone().sub(S).setY(0).normalize();
          const a = angleAt(p);
          M.copy(anti).applyAxisAngle(up, a * DEG).multiplyScalar(D).add(E);
          M.y += 0.06 * Rm;
          rig.place(M);
          shadow.userData.update(E, S);
          /* How deep it is in: centre's distance from the shadow's axis. */
          const rel = M.clone().sub(E);
          const along = rel.dot(anti);
          const dAxis = rel.addScaledVector(anti, -along).length();
          const phase = dAxis > PEN + Rm ? 0 : dAxis > UMBRA + Rm ? 1 : dAxis > UMBRA - Rm ? 2 : 3;
          shadow.userData.u.uRed.value = lerp(0.25, 1, smooth(dAxis, UMBRA + Rm * 0.6, UMBRA - Rm * 1.2));

          /* Shots: side-on; from Earth's night side; from beside the Moon. */
          if (p > 0.3 && shot === 0) {
            shot = 1;
            toE.copy(E).sub(M).normalize();
            flyTo(ctx, "Moon", { shotYaw: yawFor(toE), shotPitch: 0.06, shotDistance: 1.5 }, { near: 6 });
          }
          if (p > 0.7 && shot === 1) shot = 2;
          if (p > 0.73 && shot === 2) {
            shot = 3;
            /* We are at the Moon now: it is hidden, so it does not sit in
             * front of Earth. */
            veil.push(rig.moon);
            /* Inside the umbra, beyond the Moon: Earth hides the Sun. */
            flyTo(ctx, "Earth", { shotYaw: yawFor(anti) + 0.04, shotPitch: 0.1, shotDistance: 7.5 }, { near: 12 });
          }
          cut(shot === 2 || (shot === 3 && p < 0.745));
          cutWords.userData.draw(["Seen from the Moon"]);
          ctx.fade(cutWords, shot === 2 || (shot === 3 && p < 0.745) ? 1 : 0);

          ctx.fade(cones, 1 - smooth(p, 0.28, 0.32));
          ctx.fade(orbit, 1 - smooth(p, 0.28, 0.32));
          ctx.fade(umbraLabel, smooth(p, 0.04, 0.08) * (1 - smooth(p, 0.28, 0.32)));
          ctx.fade(penLabel, smooth(p, 0.06, 0.1) * (1 - smooth(p, 0.28, 0.32)));
          moonLabel.position.copy(M).sub(E).divideScalar(U).add(new THREE.Vector3(0, (Rm / U) * 2.2, 0));
          ctx.fade(moonLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.28, 0.32)));
          ctx.fade(sunArrow, 1 - smooth(p, 0.28, 0.32));
          ctx.fade(sunWords, 1 - smooth(p, 0.28, 0.32));
          ring.userData.face(ctx.camera);
          ctx.fade(ring, smooth(p, 0.76, 0.84) * (0.85 + 0.15 * Math.sin(ctx.t * 1.3)));

          const names = ["Before the eclipse", "Penumbral: a faint dimming", "Partial: the umbra bites in", "Totality: the blood moon"];
          title.userData.draw([p > 0.74 ? "Earth hides the Sun" : names[phase], p > 0.74 ? "its air glows red all round" : "March 3, 2026 · 58 minutes of totality"]);
          ctx.fade(title, shot === 2 || (shot === 3 && p < 0.745) ? 0 : smooth(p, 0.0, 0.04));
        },
        dispose() { rig.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "annular-eclipse",
    section: "earth",
    body: "Earth",
    title: "Annular eclipse: “ring of fire”",
    place: "Earth, the Moon and the Sun",
    kind: "recurring",
    family: "alignment",
    often: "about once a year",
    when: "Example shown: October 14, 2023",
    timeline: { last: "February 17, 2026 · Antarctica", next: "February 6, 2027 · Chile, Argentina" },
    detail: "When the Moon is near its farthest, its disc is too small to cover the Sun, and a blazing ring of sunlight is left around it",
    frequency: "Most years have one. The next is on February 6, 2027, with up to 7 min 51 s of annularity over Chile, Argentina and the South Atlantic.",
    cause: "The Moon's orbit is an oval: its distance swings between about 363,000 and 405,000 km. If a solar eclipse happens while the Moon is far, its disc looks smaller than the Sun's and cannot cover it. On October 14, 2023 the Moon's disc was 95.2% as wide as the Sun's.",
    note: "That eclipse's ring crossed the United States from Oregon to Texas, then Central America, Colombia and Brazil, lasting up to 5 min 17 s. Annulus is Latin for a ring. About a tenth of the Sun stays uncovered, so the sky never goes dark and eye protection is needed throughout.",
    accuracy: "Played on the site's own Earth, Moon and Sun. The site draws the Moon about 19 times closer than it really is, so seen from Earth's surface it looks far bigger than the real half-degree; the Sun is enlarged by the same factor for this view, so the two discs keep their true ratio for October 14, 2023 (the Moon's 95.2% of the Sun's). The orbit inset is a diagram, its oval much exaggerated.",
    art: { main: "sun", second: "moon", fx: "eclipse" },
    shotZoom: 2.4,
    shotPitch: 0.14,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody) return { duration: 22, update() {} };
      /* Magnitude 0.952: the Moon's apparent diameter over the Sun's at
       * mid-eclipse on the central line (NASA/Espenak). */
      const RATIO = 0.952;
      const U = ctx.unit;
      const moonFov = rig.moon.userData.focusFov;
      const up = new THREE.Vector3(0, 1, 0);
      const E = earth.getWorldPosition(new THREE.Vector3());
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const sunward = S.clone().sub(E).setY(0).normalize();
      /* Near apogee: 405,000 / 384,400 km of the site's mean distance. */
      const D = rig.distance * (405000 / 384400);
      const M = E.clone().addScaledVector(sunward, D);
      const moonOffset = M.clone().sub(E);
      rig.place(M);
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      ctx.refocus("Earth", { shotYaw: yawWithRight(sunward.clone().negate()), shotZoom: 2.4, shotPitch: 0.14 });

      /* From just above Earth's sunward face, looking up at the Moon. */
      const camDist = D - U * 1.12;
      const antiYaw = yawFor(sunward.clone().negate());
      const sunR = bodyRadius(sunBody);
      const moonAngle = Math.asin(Math.min(0.99, (rig.radius * 1.008) / camDist));
      const sunAngle = moonAngle / RATIO;
      const camToSun = S.distanceTo(M) + camDist;
      /* The Sun's model scaled (main.js setSunLook, a share of its full
       * size) so its disc from here is the Moon's over 0.952. */
      const sunScale = (camToSun * Math.tan(sunAngle)) / sunR;

      const line = ctx.line([new THREE.Vector3(), sunward.clone().multiplyScalar(40)], { colour: "#ffffff", opacity: 0.35, dashed: true, dash: 0.3, gap: 0.2 });
      const moonLabel = ctx.label(["The Moon", "near its farthest"], { at: M.clone().sub(E).divideScalar(U).add(new THREE.Vector3(0, 0.75, 0)), height: 0.026, declutter: false });
      const hud = ctx.hudLayer();
      const sunArrow = ctx.arrow([-0.8, 0.3, 0], [-1.04, 0.3, 0], { colour: "#ffffff", opacity: 0.85, head: 0.04, parent: hud });
      const sunWords = ctx.label(["to the Sun"], { parent: hud, at: [-0.92, 0.37, 0], height: 0.024, declutter: false });
      /* The orbit inset: an oval, Earth at a focus, the Moon at apogee. */
      const inset = new THREE.Group();
      inset.position.set(-0.78, 0.5, 0);
      hud.add(inset);
      ctx.disc(0.27, { colour: "#02040a", opacity: 0.8, parent: inset }).position.z = -0.01;
      /* drawing choice: eccentricity 0.35 (the real one is 0.055). */
      const A = 0.17;
      const Ecc = 0.35;
      ctx.orbit(A, Ecc, { plane: "xy", rotate: Math.PI, colour: "#cfd7e6", opacity: 0.5, parent: inset });
      ctx.glow("#7fb8ff", 0.07, { opacity: 0.9, parent: inset });
      const insetMoon = ctx.glow("#e8e8e8", 0.05, { opacity: 1, parent: inset });
      ctx.label(["Apogee: farther, smaller"], { at: [0.0, -0.17, 0], height: 0.02, parent: inset, declutter: false });
      const title = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const readout = ctx.label(["", ""], { parent: hud, at: [0, -0.6, 0], height: 0.03, declutter: false });
      const cutWords = ctx.label(["From Earth's surface"], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);
      /* The ring's glare round the Moon at annularity (hud units: the
       * Moon's disc is moonAngle over the lens's half-height). */
      const fire = limbRing(ctx, 1.0, 1.45, { colour: "#ffe9b8", opacity: 0.8, parent: hud });
      ctx.fade(fire, 0);

      ctx.tell([
        { at: 0, label: "An oval orbit", text: "New Moon: the Moon passes between the Sun and Earth. This time it is near apogee, the far end of its oval orbit." },
        { at: 0.22, label: "From Earth", text: "Seen from the ground under its shadow, the Moon slides onto the Sun. Its disc is only 95% as wide." },
        { at: 0.56, label: "Ring of fire", text: "At mid-eclipse a ring of sunlight blazes all round the Moon. Annulus is Latin for a ring." },
        { at: 0.8, label: "Never dark", text: "About a tenth of the Sun still shines, so the sky only dims, the corona stays hidden, and eye protection is needed throughout." },
      ]);

      const cut = cutter(ctx, veil);
      let stage = 0;
      /* The line of sight swings across the Sun: its offset from the Moon's
       * centre, radians. First contact at moon + sun angles. */
      const contact = moonAngle + sunAngle;
      const offsetAt = (p) => (p < 0.6 ? lerp(contact * 1.55, 0, easeOut(span(p, 0.26, 0.6))) : lerp(0, -0.04 * sunAngle, span(p, 0.6, 1)));
      return {
        duration: 22,
        update(p) {
          /* Kept the same offset from Earth, which creeps along its orbit
           * while focused (round 84). */
          rig.place(earth.getWorldPosition(new THREE.Vector3()).add(moonOffset));
          /* Inset: the Moon runs round to apogee and stays there. */
          /* (the oval is drawn turned half round: a true anomaly nu sits at
           * angle nu + pi, so apogee is on the right) */
          const nu = lerp(Math.PI / 2, Math.PI, easeInOut(span(p, 0.0, 0.18)));
          const r = (A * (1 - Ecc * Ecc)) / (1 + Ecc * Math.cos(nu));
          insetMoon.position.set(r * Math.cos(nu + Math.PI), r * Math.sin(nu + Math.PI), 0);
          if (p > 0.19 && stage === 0) {
            stage = 1;
            /* Brighter, so the thin ring blazes (a share over 1 brightens
             * the real Sun's own colours; main.js setSunLook). */
            ctx.setSunLook({ scale: sunScale, tint: new THREE.Color(1.9, 1.75, 1.5) });
          }
          if (p > 0.21 && stage === 1) {
            stage = 2;
            /* A wider lens for this view (restored after), so the Moon's
             * disc does not fill the screen. */
            rig.moon.userData.focusFov = 52;
            flyTo(ctx, "Moon", { shotYaw: antiYaw - offsetAt(p), shotPitch: 0, shotDistance: camDist }, { near: 8 });
          }
          cut(stage === 1 || (stage === 2 && p < 0.25));
          ctx.fade(cutWords, stage === 1 || (stage === 2 && p < 0.25) ? 1 : 0);
          if (stage === 2 && p >= 0.25) ctx.aim(antiYaw - offsetAt(p), 0);
          ctx.fade(line, 1 - smooth(p, 0.17, 0.19));
          ctx.fade(moonLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.17, 0.19)));
          ctx.fade(sunArrow, 1 - smooth(p, 0.17, 0.19));
          ctx.fade(sunWords, 1 - smooth(p, 0.17, 0.19));
          ctx.fade(inset, 1 - 0.45 * smooth(p, 0.3, 0.4));
          /* How much of the Sun is covered, from the two discs' overlap. */
          const off = Math.abs(offsetAt(p));
          const covered = overlap(sunAngle, moonAngle, off) / (Math.PI * sunAngle * sunAngle);
          title.userData.draw(p < 0.2 ? ["October 14, 2023", "the Moon near apogee"] : ["October 14, 2023", "Oregon to Brazil"]);
          readout.userData.draw(p < 0.22 ? ["", ""] : [
            covered >= 0.9 ? "Annularity" : covered > 0 ? "Partial eclipse" : "The Moon approaches",
            `Moon's disc 95.2% of the Sun's · ${Math.round(covered * 100)}% of the Sun covered`,
          ]);
          ctx.fade(readout, smooth(p, 0.26, 0.3));
          const discR = Math.tan(moonAngle) / Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov * 0.5));
          fire.scale.setScalar(discR * 1.02);
          ctx.fade(fire, stage === 2 && p > 0.25 ? 0.55 * smooth(covered, 0.85, 0.93) : 0);
          ctx.fade(title, stage === 1 || (stage === 2 && p < 0.25) ? 0 : 1);
        },
        dispose() { rig.restore(); ctx.setSunLook(null); rig.moon.userData.focusFov = moonFov; },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "eclipse-2027",
    section: "earth",
    title: "The next great eclipse",
    place: "Spain, North Africa, Egypt and Arabia",
    kind: "transient",
    family: "alignment",
    when: "August 2, 2027",
    often: "once, August 2, 2027",
    timeline: { next: "August 2, 2027 · totality up to 6 min 23 s" },
    detail: "The Moon's shadow crosses southern Spain, North Africa and Egypt, and near Luxor the Sun is hidden for about 6 minutes 23 seconds",
    frequency: "A one-off: total eclipses this long are rare. The path of totality is about 258 km wide.",
    cause: "Three things line up to make it long. The Moon is near perigee, so its disc is large, 7.9% wider than the Sun's. Earth is a month past aphelion, its farthest from the Sun, so the Sun's disc is small. And near Luxor the Sun is almost overhead, where the shadow crosses the ground at its slowest.",
    note: "The shadow touches down in the Atlantic, crosses the Strait of Gibraltar and Spain's southern tip, runs along Morocco, Algeria, Tunisia and Libya to Egypt, then crosses the Red Sea to Saudi Arabia, Yemen and the tip of Somalia. One of the longest total eclipses of the 21st century.",
    accuracy: "The track is the central line from Espenak's eclipse tables, drawn on a globe to scale; the umbra dot is drawn a little larger than its 258 km. In the close-up the Moon and Sun are their true apparent sizes; the corona is a drawing.",
    art: { main: "sun", second: "moon", fx: "eclipse" },
    scene(ctx) {
      /* Central line, [lat, lon] at 10-minute steps, 08:26 to 11:48 UT,
       * then the sunset end (eclipsewise.com, SE2027Aug02T path table). */
      const TRACK = [
        [30.49, -36.21], [35.0, -14.63], [35.66, -6.72], [35.71, -0.33], [35.47, 3.82], [34.72, 9.86],
        [33.62, 15.08], [32.24, 19.69], [30.64, 23.81], [28.85, 27.56], [26.89, 31.02], [24.77, 34.26],
        [22.51, 37.35], [20.1, 40.37], [17.53, 43.39], [14.79, 46.48], [11.85, 49.77], [8.66, 53.41],
        [1.1, 63.01], [-3.91, 70.87], [-11.11, 86.45], [-12.49, 90.44],
      ];
      /* Greatest duration 6 min 23.24 s (26.8° N, 31.1° E); greatest
       * eclipse near Luxor, 25.5° N, 32.9° E, 6 min 22.6 s; Moon/Sun
       * diameter ratio 1.079 (eclipsewise.com). */
      const TOTALITY = 383;
      const RATIO = 1.079;
      /* layout */
      const globeG = new THREE.Group();
      const sky = new THREE.Group();
      ctx.add(globeG);
      ctx.add(sky);
      const RG = 0.58;
      const globe = ctx.ball(RG, { body: "Earth", rim: 0.5, rimColour: "#8fc4ff", parent: globeG });
      globe.position.set(-0.15, 0.04, 0);
      face(globe, 27, 16);
      ctx.light.set(0.12, 0.25, 1).normalize();
      /* The track, along great circles between the table's points. */
      const path = [];
      for (let i = 0; i < TRACK.length - 1; i += 1) {
        const a = geo(1, ...TRACK[i]);
        const b = geo(1, ...TRACK[i + 1]);
        const angle = a.angleTo(b);
        const steps = Math.max(2, Math.ceil(angle / 0.01));
        for (let k = 0; k < steps; k += 1) {
          const t = k / steps;
          const v = a.clone().multiplyScalar(Math.sin((1 - t) * angle)).add(b.clone().multiplyScalar(Math.sin(t * angle))).divideScalar(Math.sin(angle));
          path.push(v.normalize());
        }
      }
      path.push(geo(1, ...TRACK[TRACK.length - 1]));
      const lonOf = (v) => Math.atan2(-v.z, v.x) / DEG;
      ctx.line(path.map((v) => v.clone().multiplyScalar(RG * 1.004)), { colour: "#ffd27f", opacity: 0.3, dashed: true, dash: 0.012, gap: 0.01, parent: globe, additive: false });
      const trail = ctx.line(path.slice(0, 2).map((v) => v.clone().multiplyScalar(RG * 1.005)), { colour: "#ffd27f", opacity: 0.95, parent: globe, additive: false });
      const penumbra = ctx.glow("#000000", 0.75, { opacity: 0.55, parent: globe, additive: false });
      const umbra = ctx.glow("#000000", 0.07, { opacity: 1, parent: globe, additive: false });
      const luxor = ctx.ball(0.009, { colour: "#ff6b6b", emissive: "#ff2020", parent: globe });
      luxor.position.copy(geo(RG * 1.003, 25.69, 32.64));
      const toRoot = (lat, lon) => geo(RG, lat, lon).applyEuler(globe.rotation).add(globe.position);
      const spain = toRoot(36.7, -5.0);
      const africa = toRoot(32.5, 11);
      const egypt = toRoot(25.69, 32.64);
      const arabia = toRoot(19.5, 42);
      ctx.label(["Southern Spain"], { at: [spain.x - 0.03, spain.y + 0.05, 0.6], align: "right", height: 0.022, parent: globeG });
      ctx.label(["North Africa"], { at: [africa.x, africa.y - 0.07, 0.6], height: 0.022, parent: globeG });
      ctx.label(["Luxor", "about 6 min 23 s"], { at: [egypt.x - 0.03, egypt.y - 0.08, 0.6], align: "right", height: 0.024, parent: globeG });
      ctx.label(["Saudi Arabia"], { at: [arabia.x + 0.03, arabia.y - 0.02, 0.6], align: "left", height: 0.022, parent: globeG });
      const where = ctx.label(["", ""], { at: [-0.15, -0.7, 0], height: 0.03, parent: globeG });

      /* ---- totality at Luxor */
      const RS = 0.26;
      const SY = 0.06;
      const halo = ctx.add(new THREE.Group(), sky);
      halo.position.set(0, SY, 0);
      const crown = corona(ctx, RS, halo);
      /* Round 83 (Prompts.md: "make the Sun white"). */
      const sun = ctx.sun(RS, { ...WHITE_SUN, halo: 3, haloOpacity: 0.6, parent: sky });
      sun.position.set(0, SY, 0);
      const moon = silhouette(ctx, RS * RATIO, sky);
      const diamond = ctx.glow("#ffffff", 0.5, { opacity: 1, parent: sky });
      diamond.material.depthTest = false;
      diamond.renderOrder = 31;
      const title = ctx.label(["August 2, 2027 · near Luxor"], { at: [0, 0.76, 0], height: 0.03, parent: sky });
      const clock = ctx.label(["", ""], { at: [0, -0.52, 0], height: 0.034, parent: sky });
      void title;

      ctx.tell([
        { at: 0, label: "August 2, 2027", text: "The Moon's shadow lands in the Atlantic, crosses the Strait of Gibraltar and the southern tip of Spain, then runs along North Africa." },
        { at: 0.24, label: "Over Egypt", text: "Near Luxor the Sun is almost overhead and the shadow is slowest. Then it crosses the Red Sea to Arabia." },
        { at: 0.47, label: "Totality", text: "The Moon is near its closest and looks 8% wider than the Sun, which is small because Earth is near its farthest. The corona appears." },
        { at: 0.74, label: "6 min 23 s", text: "One of the longest total eclipses of the century, along a path about 258 km wide." },
      ]);

      return {
        duration: 22,
        update(p) {
          const ga = 1 - smooth(p, 0.43, 0.49);
          const sa = smooth(p, 0.45, 0.51);
          ctx.fade(globeG, ga);
          ctx.fade(sky, sa);

          /* The shadow along the track: Atlantic to the Indian Ocean. */
          const s = lerp(0.03, 0.82, span(p, 0.03, 0.42));
          const n = Math.max(2, Math.floor(path.length * s));
          ctx.setLine(trail, path.slice(0, n).map((v) => v.clone().multiplyScalar(RG * 1.005)));
          const head = path[n - 1];
          umbra.position.copy(head).multiplyScalar(RG * 1.012);
          penumbra.position.copy(head).multiplyScalar(RG * 1.01);
          const lon = lonOf(head);
          where.userData.draw(["August 2, 2027", lon < -9 ? "the shadow over the Atlantic"
            : lon < 1 ? "Strait of Gibraltar · southern Spain"
              : lon < 25 ? "Morocco, Algeria, Tunisia, Libya"
                : lon < 34 ? "Egypt · longest totality near Luxor"
                  : lon < 43 ? "Red Sea · Saudi Arabia"
                    : lon < 51 ? "Yemen · tip of Somalia" : "out over the Indian Ocean"]);

          /* The close-up: second contact at 0.55, third at 0.93. */
          const gap = RS * RATIO - RS;
          const dx = p < 0.55 ? lerp(0.5, gap, easeOut(span(p, 0.45, 0.55)))
            : p < 0.93 ? lerp(gap, -gap, span(p, 0.55, 0.93))
              : lerp(-gap, -0.12, span(p, 0.93, 1));
          moon.position.set(dx, SY, 0.01);
          const tot = win(p, 0.548, 0.934, 0.012);
          ctx.fade(crown, sa * lerp(0.08, 1, tot));
          crown.rotation.z = 0.15;
          ctx.fade(sun.userData.halo, sa * (1 - tot) * 0.8);
          sun.rotation.y = ctx.t * 0.1;
          const flash = Math.max(Math.exp(-(((p - 0.55) / 0.008) ** 2)), Math.exp(-(((p - 0.932) / 0.008) ** 2)));
          diamond.position.set(p < 0.75 ? -RS * 0.98 : RS * 0.98, SY, 0.02);
          ctx.fade(diamond, sa * flash);
          diamond.scale.setScalar(0.25 + 0.35 * flash);
          if (p < 0.55) clock.userData.draw(["Partial", "the last crescent of Sun"]);
          else if (p < 0.932) clock.userData.draw([`Totality ${mmss(TOTALITY * span(p, 0.55, 0.932))}`, "of about 6 min 23 s"]);
          else clock.userData.draw(["Third contact", "the Sun returns"]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "supermoon",
    section: "earth",
    body: "Earth",
    title: "Supermoon",
    place: "Earth and the Moon",
    kind: "recurring",
    family: "orbit",
    often: "a few times a year",
    detail: "A full Moon near its closest looks about 14% wider and 30% brighter than one near its farthest",
    frequency: "The Moon passes perigee every 27.6 days, but it is full only every 29.5 days, so full Moons drift in and out of step with the near point. Supermoons come in runs of three or four in a row, about once a year.",
    cause: "The Moon's orbit is an oval. A full Moon near perigee can be about 357,000 km away; one near apogee about 406,000 km. 406,000 ÷ 357,000 is 1.14, so the near one looks 14% wider, and its disc has 30% more area, so it is about 30% brighter.",
    note: "The word supermoon was coined by an astrologer, Richard Nolle, in 1979; astronomers call it a perigee full Moon. The Moon looking huge near the horizon is a different thing, an illusion that happens every month.",
    accuracy: "Played on the site's own Earth and Moon. The site draws the Moon about 19 times closer than it really is; its oval here keeps the true ratio of the near and far distances, 357,000 to 406,000 km, so the change in size is the real 14%. The orbit is drawn flat in the plane of Earth's orbit. The comparison at the end draws the two Moons to their true relative sizes, the near one 30% brighter.",
    art: { main: "moon", fx: "glow" },
    shotZoom: 4.9,
    shotPitch: 0.95,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      const moonFov = rig?.moon?.userData?.focusFov;
      if (!rig || !sunBody) return { duration: 24, update() {} };
      /* Full-Moon extremes, km: close perigee ~357,000, far apogee ~406,000
       * (NASA; the range in any year is a few thousand km either way). */
      const PERIGEE = 357000;
      const APOGEE = 406000;
      const MEAN = 384400;
      const K = APOGEE / PERIGEE;
      const U = ctx.unit;
      const up = new THREE.Vector3(0, 1, 0);
      const E = earth.getWorldPosition(new THREE.Vector3());
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const anti = E.clone().sub(S).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(up, anti).normalize();
      /* The oval, Earth at a focus, perigee on the night side (so a full
       * Moon there is a supermoon); world units. */
      const rp = rig.distance * (PERIGEE / MEAN);
      const ra = rig.distance * (APOGEE / MEAN);
      const a = (rp + ra) / 2;
      const e = (ra - rp) / (ra + rp);
      const at = (nu, out = new THREE.Vector3()) => {
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
        return out.copy(anti).multiplyScalar(Math.cos(nu) * r).addScaledVector(side, Math.sin(nu) * r).add(E);
      };
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      ctx.refocus("Earth", { shotYaw: yawWithRight(side), shotZoom: 4.9, shotPitch: 0.95 });

      const ovalPts = [];
      for (let i = 0; i <= 200; i += 1) ovalPts.push(at((i / 200) * TAU).sub(E).divideScalar(U));
      const oval = ctx.line(ovalPts, { colour: "#cfd7e6", opacity: 0.45, dashed: true, dash: 0.08, gap: 0.06 });
      const periLabel = ctx.label(["Perigee", "about 357,000 km"], { at: at(0).sub(E).divideScalar(U).addScaledVector(anti, 0.9), height: 0.026, declutter: false });
      const apoLabel = ctx.label(["Apogee", "about 406,000 km"], { at: at(Math.PI).sub(E).divideScalar(U).addScaledVector(anti, -0.9), height: 0.026, declutter: false });
      const sunHint = ctx.label(["↑ sunlight from this side"], { at: anti.clone().multiplyScalar(-(ra / U) * 0.62), height: 0.022, sub: "#9fb3c8", declutter: false });

      const hud = ctx.hudLayer();
      /* A live gauge: the Moon's width as seen from Earth now. */
      const gauge = new THREE.Group();
      gauge.position.set(-1.1, 0.3, 0);
      hud.add(gauge);
      ctx.disc(0.3, { colour: "#02040a", opacity: 0.8, parent: gauge }).position.z = -0.01;
      /* The disc is the Moon as seen from Earth now; the dashed ring its
       * size at apogee (same scale; the change is the real 14%). */
      const disc = ctx.disc(0.2, { colour: "#e8e4dc", opacity: 1, parent: gauge });
      const ref = ctx.circle(0.2, { plane: "xy", colour: "#9fd0ff", opacity: 0.95, dashed: true, dash: 0.02, gap: 0.015, parent: gauge });
      ref.position.z = 0.01;
      const gaugeLabel = ctx.label(["", ""], { parent: hud, at: [-1.1, -0.08, 0], height: 0.024, declutter: false });
      const title = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      /* In the views from Earth: the far Moon's outline, for comparison. */
      /* Round 84 (Prompts.md: the ring "does not fit"): a thick dashed
       * ring -- 36 dark arcs -- that reads on the bright Moon (a hairline
       * of light blue did not), unit radius, scaled each frame. */
      const ghost = new THREE.Group();
      hud.add(ghost);
      for (let k = 0; k < 36; k += 1) {
        const arc = new THREE.Mesh(
          new THREE.RingGeometry(0.975, 1.025, 6, 1, (k / 36) * TAU, (TAU / 36) * 0.6),
          new THREE.MeshBasicMaterial({ color: "#0b2a66", transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
        );
        arc.userData.baseOpacity = 0.95;
        arc.renderOrder = 45;
        arc.raycast = () => {};
        ghost.add(arc);
      }
      ctx.fade(ghost, 0);
      const ghostWords = ctx.label(["Dashed ring: the same Moon at apogee", "the full Moon at perigee is about 14% wider"], { parent: hud, at: [0, -0.62, 0], height: 0.04, declutter: false });
      ctx.fade(ghostWords, 0);
      const cutWords = ctx.label([""], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      /* ---- the comparison on black, at the end (true relative sizes) */
      const pair = new THREE.Group();
      hud.add(pair);
      const R = 0.25;
      const far = moonBall(ctx, R, { parent: pair, gain: 1 / (K * K), light: [0, 0.08, 1] });
      far.position.set(-0.95, 0.02, 0);
      const close = moonBall(ctx, R * K, { parent: pair, gain: 1, light: [0, 0.08, 1] });
      close.position.set(-0.22, 0.02, 0);
      ctx.label(["Apogee full Moon", "406,000 km"], { at: [-0.95, -0.4, 0], height: 0.026, parent: pair, declutter: false });
      ctx.label(["Perigee full Moon", "357,000 km"], { at: [-0.22, -0.4, 0], height: 0.026, parent: pair, declutter: false });
      const outline = ctx.circle(R, { plane: "xy", colour: "#9fd0ff", opacity: 0.9, dashed: true, dash: 0.02, gap: 0.015, parent: pair });
      const verdict = ctx.label(["About 14% wider · about 30% brighter"], { at: [-0.58, 0.56, 0], height: 0.034, parent: pair, declutter: false });
      ctx.fade(pair, 0);

      /* The Earth-Moon distance, drawn and read out as the Moon goes round. */
      const span3 = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.8, dashed: true, dash: 0.1, gap: 0.08 });
      const kmLabel = ctx.label(["", ""], { height: 0.026, colour: "#ffd27f", declutter: false });

      ctx.tell([
        { at: 0, label: "An oval orbit", text: "The Moon goes round Earth on an oval. At apogee, its far point, it is about 406,000 km away." },
        { at: 0.16, label: "Small, then large", text: "As it swings in toward perigee, its near point, about 357,000 km, it looks bigger from Earth: watch the gauge." },
        { at: 0.5, label: "From Earth", text: "A full Moon at perigee, seen from Earth: the supermoon. The dashed ring is how big the same Moon looks at apogee." },
        { at: 0.72, label: "Side by side", text: "The two full Moons to the same scale: the near one about 14% wider, and about 30% brighter." },
      ]);

      const cut = cutter(ctx, veil);
      let shot = 0;
      const M = new THREE.Vector3();
      const camOff = new THREE.Vector3();
      const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov * 0.5));
      return {
        /* Fitted to her line (owner, round 84: the event must end with
         * the speech). */
        duration: 24,
        update(p) {
          /* Round 84 (Prompts.md: "the moon goes into the earth"): Earth
           * creeps along its own orbit while it is focused, and the oval is
           * drawn round where it is now -- so the Moon is placed round
           * where it is now too, not where it was when the event began. */
          earth.getWorldPosition(E);
          /* The Moon only ever moves along the drawn oval: apogee (pi)
           * round, slowly, to perigee (2 pi), where it stays, full. */
          const nu = Math.PI + Math.PI * easeInOut(span(p, 0.03, 0.44));
          at(nu, M);
          rig.place(M);
          const dist = M.distanceTo(E);
          const km = MEAN * (dist / rig.distance);
          /* Gauge: width relative to the apogee Moon. */
          const rel = ra / dist;
          disc.scale.setScalar(rel);
          const pct = Math.round((rel - 1) * 100);
          gaugeLabel.userData.draw(["The Moon seen from Earth", pct > 0 ? `${pct}% wider than at apogee` : "at apogee (dashed ring)"]);
          ctx.fade(gauge, 1 - smooth(p, 0.46, 0.48));
          ctx.fade(gaugeLabel, 1 - smooth(p, 0.46, 0.48));
          void ref;
          const mL = M.clone().sub(E).divideScalar(U);
          ctx.setLine(span3, [mL.clone().setLength(1.1), mL.clone().setLength(mL.length() - (rig.radius / U) * 1.2)]);
          kmLabel.position.copy(mL).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0));
          kmLabel.userData.draw([`${fmt(Math.round(km / 1000) * 1000)} km`, nu < Math.PI * 1.15 ? "near apogee" : nu > Math.PI * 1.85 ? "near perigee" : ""]);
          ctx.fade(span3, smooth(p, 0.02, 0.05) * (1 - smooth(p, 0.45, 0.47)));
          ctx.fade(kmLabel, smooth(p, 0.02, 0.05) * (1 - smooth(p, 0.45, 0.47)));

          /* From Earth's night side, just above the ground, at perigee. */
          if (p > 0.46 && shot === 0) shot = 1;
          if (p > 0.48 && shot === 1) {
            shot = 2;
            camOff.copy(E).sub(M).normalize();
            /* Round 84 (Prompts.md: "the dotted ring does not fit"): a
             * wider lens for this view, as the annular eclipse has, so the
             * whole perigee Moon and the apogee ring both fit left of the
             * card (the site draws the Moon 19 times too close, so from
             * Earth's surface it would otherwise fill the screen). */
            rig.moon.userData.focusFov = 64;
            flyTo(ctx, "Moon", { shotYaw: yawFor(camOff), shotPitch: 0.02, shotDistance: rp - U * 1.12 }, { near: 10 });
          }
          if (p > 0.69) shot = Math.max(shot, 3);
          const dark = shot === 1 || shot === 3 || (shot === 2 && p < 0.5);
          cut(dark);
          cutWords.userData.draw([shot >= 3 ? "Side by side" : "From Earth"]);
          ctx.fade(cutWords, dark && p < 0.71 ? 1 : 0);
          ctx.fade(pair, smooth(p, 0.71, 0.75));
          /* The apogee Moon's outline over the perigee one, measured from
           * where the camera really is: the same Moon, (apogee - perigee)
           * farther along the same line of sight. */
          const dc = ctx.camera.position.distanceTo(M);
          const farAngle = Math.asin(Math.min(0.99, rig.radius / (dc + (ra - rp))));
          ghost.scale.setScalar(Math.tan(farAngle) / tanHalf());
          ctx.fade(ghost, shot === 2 && p > 0.53 && p < 0.69 ? 1 : 0);
          ctx.fade(ghostWords, shot === 2 && p > 0.55 && p < 0.69 ? 1 : 0);
          ctx.fade(oval, 1 - smooth(p, 0.45, 0.47));
          ctx.fade(periLabel, smooth(p, 0.04, 0.08) * (1 - smooth(p, 0.45, 0.47)));
          ctx.fade(apoLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.45, 0.47)));
          ctx.fade(sunHint, 1 - smooth(p, 0.45, 0.47));
          title.userData.draw(p < 0.46 ? ["The Moon's oval orbit", "seen from above Earth's north pole"] : ["Full Moon at perigee", "about 357,000 km: a supermoon"]);
          ctx.fade(title, dark || p > 0.7 ? 0 : 1);
          /* The apogee Moon's outline slides onto the perigee Moon. */
          const slide = easeInOut(span(p, 0.8, 0.9));
          outline.position.set(lerp(-0.95, -0.22, slide), 0.02, 0.4);
          ctx.fade(outline, smooth(p, 0.78, 0.81));
          ctx.fade(verdict, smooth(p, 0.82, 0.86));
          far.rotation.y = -Math.PI / 2 + Math.sin(ctx.t * 0.2) * 0.02;
          close.rotation.y = far.rotation.y;
        },
        dispose() { rig.restore(); rig.moon.userData.focusFov = moonFov; },
      };
    },
  }),

  /* ------------------------------------------------------------------ 5 */
  event({
    id: "moon-phases",
    section: "earth",
    title: "Moon phases",
    place: "Earth and the Moon",
    kind: "recurring",
    family: "orbit",
    often: "every 29.5 days",
    detail: "The Moon is always half lit by the Sun; the phases are how much of that lit half faces us",
    frequency: "One cycle from new Moon to new Moon takes 29.53 days, the synodic month. It is two days longer than the 27.3 days the Moon takes to orbit, because Earth has moved along its own orbit meanwhile.",
    cause: "Sunlight always lights the half of the Moon that faces the Sun. As the Moon goes round Earth, we see that lit half from different angles: none of it at new Moon, half of it at the quarters, all of it at full Moon.",
    note: "Earth's shadow has nothing to do with the phases: that only happens in a lunar eclipse. In the southern hemisphere the Moon is seen the other way up, so a waxing crescent is lit on the left.",
    accuracy: "A diagram seen from above Earth's north pole, not to scale, with the Sun far off to the left. The inset shows the phase as seen from Earth's northern hemisphere, computed from the Moon's position.",
    art: { main: "moon", second: "earth", fx: "phases" },
    scene(ctx) {
      /* Synodic month 29.530589 days (NASA). */
      const MONTH = 29.530589;
      /* layout */
      const O = new THREE.Vector3(-0.38, 0, 0);
      const R = 0.44;
      ctx.light.set(-1, 0, 0.25).normalize();
      ctx.circle(R, { plane: "xy", colour: "#cfd7e6", opacity: 0.3, dashed: true, dash: 0.02, gap: 0.02 }).position.copy(O);
      const axis = new THREE.Group();
      axis.position.copy(O);
      axis.rotation.x = Math.PI / 2;
      ctx.add(axis);
      const earth = ctx.ball(0.11, { body: "Earth", rim: 0.5, parent: axis });
      const moon = ctx.ball(0.05, { body: "Moon" });
      /* The half of the Moon that faces Earth, outlined. */
      const facing = new THREE.Group();
      ctx.add(facing);
      ctx.circle(0.064, { plane: "xy", from: -Math.PI / 2, to: Math.PI / 2, colour: "#8fd0ff", opacity: 0.95, parent: facing });
      const sight = ctx.line([[0, 0, 0], [1, 0, 0]], { colour: "#8fd0ff", opacity: 0.4, dashed: true, dash: 0.02, gap: 0.02 });
      /* Round 83 (Prompts.md: "change sunlight colour to white"). */
      [0.6, 0.3, -0.3, -0.6].forEach((y) => ctx.arrow([-1.02, y, 0], [-0.86, y, 0], { colour: "#ffffff", opacity: 0.85, head: 0.04 }));
      ctx.label(["Sunlight"], { at: [-0.94, 0.72, 0], height: 0.024, colour: "#ffffff" });
      const day = ctx.label([""], { at: [O.x, 0.64, 0], height: 0.032 });

      /* The inset: the Moon as seen from Earth. */
      const IX = 0.6;
      const inset = moonBall(ctx, 0.24, { light: [0, 0, -1], earthshine: 0.03 });
      inset.position.set(IX, 0.06, 0);
      ctx.label(["Seen from Earth"], { at: [IX, 0.42, 0], height: 0.026, sub: "#9fb3c8" });
      const phase = ctx.label(["", ""], { at: [IX, -0.3, 0], height: 0.03 });

      ctx.tell([
        { at: 0, label: "Always half lit", text: "Seen from above Earth's north pole: the Sun always lights the half of the Moon facing it." },
        { at: 0.12, label: "Waxing", text: "As the Moon moves round, more of its lit half turns toward us: a crescent, then a half Moon at first quarter." },
        { at: 0.42, label: "Full Moon", text: "Opposite the Sun, the whole lit half faces Earth." },
        { at: 0.6, label: "Waning", text: "Then back: gibbous, last quarter, a thin morning crescent." },
        { at: 0.86, label: "Day and night", text: "The phases are just the Moon's day and night, seen from here. One cycle takes 29.5 days." },
      ]);

      const names = (e) => (e < 8 || e > 352 ? "New Moon" : e < 82 ? "Waxing crescent" : e < 98 ? "First quarter" : e < 172 ? "Waxing gibbous"
        : e < 188 ? "Full Moon" : e < 262 ? "Waning gibbous" : e < 278 ? "Last quarter" : "Waning crescent");

      return {
        duration: 20,
        update(p) {
          /* Elongation from the Sun, 0 (new) to 360 (new again). */
          const e = 360 * span(p, 0.03, 0.95);
          const theta = Math.PI + e * DEG;
          moon.position.set(O.x + R * Math.cos(theta), O.y + R * Math.sin(theta), 0);
          moon.rotation.z = theta;
          facing.position.copy(moon.position);
          facing.rotation.z = theta + Math.PI;
          ctx.setLine(sight, [[O.x + 0.12 * Math.cos(theta), O.y + 0.12 * Math.sin(theta), 0], [moon.position.x - 0.06 * Math.cos(theta), moon.position.y - 0.06 * Math.sin(theta), 0]]);
          earth.rotation.y = ctx.t * 0.4;
          /* The inset's light: waxing phases lit on the right. */
          const er = e * DEG;
          inset.userData.u.uLight.value.set(Math.sin(er), 0.02, -Math.cos(er)).normalize();
          const lit = (1 - Math.cos(er)) / 2;
          phase.userData.draw([names(e), `${Math.round(lit * 100)}% lit`]);
          day.userData.draw([`Day ${((e / 360) * MONTH).toFixed(1)} of 29.5`]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "tides",
    section: "earth",
    body: "Earth",
    title: "Spring and neap tides",
    place: "Earth, the Moon and the Sun",
    kind: "recurring",
    family: "orbit",
    often: "twice a day; spring tides twice a month",
    detail: "The Moon and the Sun stretch Earth's oceans into two bulges; when they line up the tides are biggest, at right angles the smallest",
    frequency: "High tide comes round about every 12 hours 25 minutes, twice in each 24 h 50 min lunar day. Spring tides follow each new and full Moon, neap tides each quarter Moon, so they alternate about every 7.4 days.",
    cause: "The Moon pulls hardest on the side of Earth facing it and least on the far side. The difference stretches the oceans into two bulges, one toward the Moon and one away. The Sun does the same, with 46% of the Moon's strength: lined up, the two add; at right angles, they partly cancel.",
    note: "Spring tides have nothing to do with the season: the name comes from the water springing up. Real tides are shaped by coastlines and ocean basins, so the time and height of high water differ from place to place, from almost nothing to over 15 m in the Bay of Fundy.",
    accuracy: "Played on the site's own Earth and Moon, seen from above the north pole, with the real Sun's direction. The water's bulges are hugely exaggerated (in the open ocean they are well under a metre) and drawn as the ideal 'equilibrium tide', the Sun's part 46% of the Moon's. The arrows show the tidal pull (the difference between the Moon's pull here and at Earth's centre), not its true size. Earth's spin and the Moon's orbit are sped up and the Moon's orbit drawn flat.",
    art: { main: "earth", second: "moon", fx: "tides" },
    shotZoom: 4.6,
    shotPitch: 1.05,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody) return { duration: 24, update() {} };
      /* Solar tidal force / lunar = 0.46 (Sun 1.99e30 kg at 1 AU against
       * the Moon 7.35e22 kg at 384,400 km, inverse cube). */
      const SOLAR = 0.46;
      const U = ctx.unit;
      const up = new THREE.Vector3(0, 1, 0);
      const E = earth.getWorldPosition(new THREE.Vector3());
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const sunward = S.clone().sub(E).setY(0).normalize();
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      /* From above, the Sun off to the right (beyond the event card) and the
       * full Moon on the left. */
      ctx.refocus("Earth", { shotYaw: yawWithRight(sunward), shotZoom: 4.6, shotPitch: 1.05 });

      /* ---- the ocean: a shell over the real Earth, pulled into bulges.
       * Height above the ground (Earth radii) = BASE + AMP x the
       * equilibrium tide, cos 2(angle to Moon) + 0.46 cos 2(angle to Sun),
       * worked out per vertex from the two directions (world). */
      const BASE = 0.04;
      const AMP = 0.13;
      const water = new THREE.Mesh(
        new THREE.SphereGeometry(1, 160, 80),
        new THREE.ShaderMaterial({
          uniforms: {
            uMoon: { value: new THREE.Vector3(1, 0, 0) },
            uSun: { value: new THREE.Vector3(-1, 0, 0) },
            uSolar: { value: SOLAR },
            uAmp: { value: AMP },
            uBase: { value: BASE },
            uTime: { value: 0 },
            uOpacity: { value: 0.8 },
          },
          vertexShader: /* glsl */ `
            uniform vec3 uMoon;
            uniform vec3 uSun;
            uniform float uSolar;
            uniform float uAmp;
            uniform float uBase;
            varying float vH;
            varying vec3 vN;
            varying vec3 vW;
            varying vec3 vDir;
            void main() {
              vec3 d = normalize(position);
              float cm = dot(d, uMoon);
              float cs = dot(d, uSun);
              float h = (2.0 * cm * cm - 1.0) + uSolar * (2.0 * cs * cs - 1.0);
              vH = h / (1.0 + uSolar);
              vDir = d;
              vec3 p = d * (1.0 + uBase + uAmp * 0.5 * (h + 1.0 + uSolar));
              vec4 w = modelMatrix * vec4(p, 1.0);
              vW = w.xyz;
              vN = normalize(mat3(modelMatrix) * d);
              gl_Position = projectionMatrix * viewMatrix * w;
            }
          `,
          fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform float uOpacity;
            uniform vec3 uMoon;
            varying float vH;
            varying vec3 vN;
            varying vec3 vW;
            varying vec3 vDir;
            void main() {
              vec3 n = normalize(vN);
              vec3 view = normalize(cameraPosition - vW);
              float rim = pow(1.0 - max(dot(n, view), 0.0), 2.0);
              vec3 low = vec3(0.05, 0.22, 0.55);
              vec3 high = vec3(0.25, 0.7, 1.0);
              vec3 col = mix(low, high, smoothstep(-0.6, 0.9, vH));
              /* Crests: bright ripples running in toward the bulges. */
              float flow = sin(28.0 * acos(clamp(abs(dot(vDir, uMoon)), 0.0, 1.0)) + uTime * 3.0);
              col += vec3(0.6, 0.85, 1.0) * smoothstep(0.82, 1.0, flow) * 0.22 * smoothstep(-0.2, 0.8, vH);
              col += vec3(0.85, 0.95, 1.0) * smoothstep(0.82, 1.0, vH) * 0.35;
              float a = uOpacity * (0.45 + 0.55 * rim) * (0.55 + 0.45 * smoothstep(-0.8, 0.9, vH));
              gl_FragColor = vec4(col, a);
              #include <colorspace_fragment>
            }
          `,
          transparent: true, depthWrite: false, toneMapped: false,
        }),
      );
      water.renderOrder = 8;
      water.raycast = () => {};
      ctx.add(water);
      const wu = water.material.uniforms;

      /* The tidal pull: arrows round Earth, toward the Moon on the near and
       * far sides (away from Earth's centre), inward at the sides. */
      const N_ARROWS = 16;
      const arrows = Array.from({ length: N_ARROWS }, () => ctx.arrow([0, 0, 0], [1, 0, 0], { colour: "#ffd27f", opacity: 0.9, head: 0.12 }));
      const harbour = ctx.glow("#ff4040", 0.34, { opacity: 1 });
      const orbit = ctx.circle(rig.distance / U, { plane: "xz", colour: "#cfd7e6", opacity: 0.28, dashed: true, dash: 0.08, gap: 0.08 });
      const moonLabel = ctx.label(["Moon"], { height: 0.024, declutter: false });
      const pullLabel = ctx.label(["The Moon's tidal pull"], { height: 0.022, colour: "#ffd27f", declutter: false });

      const hud = ctx.hudLayer();
      /* The Sun, off to the left, drawn white. */
      const sunIcon = ctx.sun(0.05, { ...WHITE_SUN, halo: 3.2, parent: hud });
      sunIcon.position.set(1.42, 0.66, 0);
      ctx.label(["Sun", "far off this way"], { parent: hud, at: [1.42, 0.56, 0], height: 0.02, declutter: false });
      const sunRays = [0.7, 0.62].map((y) => ctx.arrow([1.3, y, 0], [1.08, y, 0], { colour: "#ffffff", opacity: 0.7, head: 0.03, parent: hud }));
      void sunRays;
      const readout = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.032, declutter: false });
      /* The tide gauge at the red dot: a trace of the water's height. */
      const G = { x0: -1.45, x1: -0.85, y: -0.5, h: 0.11 };
      ctx.line([[G.x0, G.y, 0], [G.x1, G.y, 0]], { colour: "#9fb3c8", opacity: 0.35, parent: hud });
      const trace = ctx.line([[G.x0, G.y, 0], [G.x0, G.y, 0]], { colour: "#7fd0ff", opacity: 0.95, parent: hud, additive: false });
      ctx.label(["Tide at the red dot"], { parent: hud, at: [(G.x0 + G.x1) / 2, G.y + G.h + 0.07, 0], height: 0.022, declutter: false });
      const history = [];

      ctx.tell([
        { at: 0, label: "Two bulges", text: "The Moon pulls hardest on Earth's near side and least on the far side. The difference, the tidal pull (arrows), stretches the oceans into two bulges." },
        { at: 0.16, label: "Twice a day", text: "Earth turns under both bulges, so the red dot meets high water about every 12 hours 25 minutes." },
        { at: 0.36, label: "Spring tide", text: "Full Moon: the Sun and Moon in line. The Sun's own pull, 46% of the Moon's, adds to it: the highest highs and lowest lows." },
        { at: 0.58, label: "Neap tide", text: "A week later the Moon is at right angles to the Sun. Their bulges partly cancel: the gentlest tides." },
        { at: 0.82, label: "Spring again", text: "At new Moon they line up once more. Spring and neap tides alternate about every week." },
      ]);

      const M = new THREE.Vector3();
      const toMoon = new THREE.Vector3();
      const spin = spinner(earth);
      const layers = earthLayers(earth);
      layers.fade("clouds", 0.35);
      let lastT = ctx.t;
      const dot = new THREE.Vector3();
      const tideAt = (d, m, s) => {
        const cm = d.dot(m);
        const cs = d.dot(s);
        return ((2 * cm * cm - 1) + SOLAR * (2 * cs * cs - 1)) / (1 + SOLAR);
      };
      return {
        duration: 24,
        update(p) {
          E.copy(earth.getWorldPosition(E));
          S.copy(sunBody.getWorldPosition(S));
          sunward.copy(S).sub(E).setY(0).normalize();
          const anti = sunward.clone().negate();
          /* The Moon: full (opposite the Sun), round to last quarter, then
           * new (toward the Sun). */
          const theta = p < 0.5 ? (Math.PI / 2) * easeInOut(span(p, 0.36, 0.56))
            : (Math.PI / 2) * (1 + easeInOut(span(p, 0.7, 0.88)));
          toMoon.copy(anti).applyAxisAngle(up, theta);
          M.copy(E).addScaledVector(toMoon, rig.distance);
          rig.place(M);
          wu.uMoon.value.copy(toMoon);
          wu.uSun.value.copy(sunward);
          wu.uTime.value = ctx.t;
          /* Earth turns faster than real, so the bulges sweep the coasts. */
          const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
          lastT = ctx.t;
          spin.add(dt * lerp(1.6, 0.7, smooth(p, 0.3, 0.4)));
          rig.place(M);
          /* The red dot: a coast near the equator (Lagos, 6.5° N 3.4° E),
           * turning with Earth (its world direction, flattened onto the
           * plane of the drawing). */
          dot.copy(bodyPoint(earth, 6.5, 3.4, 1)).applyMatrix4(earth.matrixWorld).sub(E).setY(0).normalize();
          const h = tideAt(dot, toMoon, sunward);
          harbour.position.copy(dot).multiplyScalar(1 + BASE + AMP * 0.5 * (h * (1 + SOLAR) + 1 + SOLAR) + 0.02);
          /* Tidal pull arrows: F ~ (3 (d.m) m - d), drawn from the water. */
          arrows.forEach((arrow, i) => {
            const ang = (i / N_ARROWS) * TAU;
            const d = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
            const f = toMoon.clone().multiplyScalar(3 * d.dot(toMoon)).sub(d).multiplyScalar(0.28);
            const from = d.clone().multiplyScalar(1.22);
            arrow.userData.set(from, from.clone().add(f));
          });
          const pa = 1 - 0.55 * smooth(p, 0.3, 0.36);
          arrows.forEach((arrow) => ctx.fade(arrow, smooth(p, 0.02, 0.06) * pa));
          pullLabel.position.copy(toMoon).multiplyScalar(1.95).add(new THREE.Vector3(0, 0.25, 0));
          ctx.fade(pullLabel, smooth(p, 0.04, 0.08) * (1 - smooth(p, 0.3, 0.34)));
          moonLabel.position.copy(toMoon).multiplyScalar(rig.distance / U).add(new THREE.Vector3(0, 0.75, 0));
          void orbit;
          /* The gauge: the last stretch of the tide at the dot. */
          history.push(h);
          if (history.length > 240) history.shift();
          ctx.setLine(trace, history.length > 1 ? history.map((v, i) => [lerp(G.x0, G.x1, i / 239), G.y + v * G.h, 0.01]) : [[G.x0, G.y, 0], [G.x0, G.y, 0]]);
          const spring = Math.abs(Math.cos(2 * theta));
          readout.userData.draw(p < 0.34 ? ["Two bulges, and Earth turning under them", "high water twice a day at the red dot"]
            : spring > 0.8 ? ["Spring tide", theta < 1 ? "full Moon · Sun and Moon in line" : "new Moon · Sun and Moon in line"]
              : spring < 0.3 ? ["Neap tide", "Sun and Moon at right angles"] : ["Between", "the bulges shrinking and growing"]);
          sunIcon.rotation.y = ctx.t * 0.1;
        },
        dispose() { rig.restore(); spin.restore(); layers.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 7 */
  event({
    id: "tidal-locking",
    section: "earth",
    body: "Earth",
    title: "Why we see one face: tidal locking",
    place: "The Moon",
    kind: "ongoing",
    family: "orbit",
    often: "always",
    detail: "The Moon turns exactly once for every trip around Earth, so the same face always points at us",
    frequency: "Always: the Moon turns once on its axis and orbits once in the same 27.3 days.",
    cause: "Long ago the young Moon spun faster. Earth's gravity raised tidal bulges in its rock, and as the spin carried the bulges out of line, Earth's pull on them braked the spin, until one turn took exactly one orbit. Once there, the bulges stay pointed at Earth and the lock holds.",
    note: "Nobody saw the far side until the Soviet probe Luna 3 photographed it in October 1959. Most of the big moons in the Solar System are locked the same way, and Pluto and Charon are locked to each other.",
    accuracy: "Played on the site's own Earth and Moon, seen from above Earth's north pole; the Moon's orbit is drawn flat and sped up (one orbit is really 27.3 days). The red arrow marks the middle of the Moon's near side; the 'no spin' Moon is a thought experiment, not something that happened.",
    art: { main: "moon", second: "earth", fx: "orbit" },
    shotZoom: 4.4,
    shotPitch: 1.05,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody) return { duration: 26, update() {} };
      const U = ctx.unit;
      const D = rig.distance;
      const up = new THREE.Vector3(0, 1, 0);
      const E = earth.getWorldPosition(new THREE.Vector3());
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const sunward = S.clone().sub(E).setY(0).normalize();
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      const across = new THREE.Vector3().crossVectors(up, sunward).normalize();
      ctx.refocus("Earth", { shotYaw: yawWithRight(across), shotZoom: 4.4, shotPitch: 1.05 });

      const orbit = ctx.circle(D / U, { plane: "xz", colour: "#cfd7e6", opacity: 0.32, dashed: true, dash: 0.08, gap: 0.08 });
      /* The red arrow: the middle of the near side (longitude 0), standing
       * out of the Moon, turning with it. */
      const R = rig.radius;
      const pin = new THREE.Group();
      ctx.attach(rig.moon, pin);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.05, R * 0.05, R * 1.0, 12), new THREE.MeshBasicMaterial({ color: "#ff4a4a", toneMapped: false }));
      shaft.rotation.z = -Math.PI / 2;
      shaft.position.x = R * 1.45;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.4, 16), new THREE.MeshBasicMaterial({ color: "#ff4a4a", toneMapped: false }));
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = R * 2.1;
      const spot = new THREE.Mesh(new THREE.CircleGeometry(R * 0.2, 32), new THREE.MeshBasicMaterial({ color: "#ff4a4a", toneMapped: false, side: THREE.DoubleSide }));
      spot.rotation.y = Math.PI / 2;
      spot.position.x = R * 1.02;
      pin.add(shaft, tip, spot);
      [shaft, tip, spot].forEach((m) => { m.raycast = () => {}; m.renderOrder = 9; });
      /* A fixed direction among the stars, to measure the Moon's turn by. */
      const starRef = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffffff", opacity: 0.55, dashed: true, dash: 0.06, gap: 0.05 });
      const turnArc = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.95, additive: false });
      const turnLabel = ctx.label(["", ""], { height: 0.026, colour: "#ffd27f", declutter: false });
      const starWords = ctx.label(["toward a distant star"], { height: 0.02, sub: "#9fb3c8", declutter: false });
      const ghosts = [0, 1, 2, 3].map(() => ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ff6b6b", opacity: 0.55, additive: false }));

      const hud = ctx.hudLayer();
      const title = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label(["The far side"], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      ctx.tell([
        { at: 0, label: "A thought experiment", text: "First, a Moon that does not spin at all. The red arrow keeps pointing the same way in space, so as it goes round, Earth would see every side of it." },
        { at: 0.34, label: "The real Moon", text: "The real Moon turns once on its axis in exactly one orbit, 27.3 days. So the red arrow always points at Earth: we always see the same face." },
        { at: 0.5, label: "It does turn", text: "Measured against the stars, it turns a full 360° in each orbit. It is locked to Earth, not standing still." },
        { at: 0.72, label: "The far side", text: "The other face is not dark, just never turned to us. No one saw it until the Soviet probe Luna 3 photographed it in October 1959." },
      ]);

      const cut = cutter(ctx, veil);
      let stage = 0;
      const M = new THREE.Vector3();
      const toMoon = new THREE.Vector3();
      const fixedFace = across.clone();
      const ghostAngles = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI];
      const local = (w) => w.clone().sub(E).divideScalar(U);
      return {
        duration: 26,
        update(p) {
          E.copy(earth.getWorldPosition(E));
          let ang;
          if (p < 0.32) {
            ang = TAU * easeInOut(span(p, 0.03, 0.3));
          } else if (p < 0.7) {
            ang = TAU * easeInOut(span(p, 0.34, 0.68));
          } else {
            /* New Moon: between Earth and the Sun, its far side sunlit. */
            ang = 0;
          }
          toMoon.copy(sunward).applyAxisAngle(up, ang + (p < 0.7 ? Math.PI / 2 : 0));
          M.copy(E).addScaledVector(toMoon, D);
          if (p < 0.32) {
            rig.place(M, { faceEarth: false });
            rig.face(fixedFace);
          } else {
            rig.place(M);
          }
          /* Snapshots at the quarter points in the 'no spin' case. */
          ghostAngles.forEach((g, i) => {
            const pos = local(E.clone().addScaledVector(sunward.clone().applyAxisAngle(up, g + Math.PI / 2), D));
            const dirArrow = p < 0.32 ? fixedFace.clone() : sunward.clone().applyAxisAngle(up, g + Math.PI / 2).negate();
            ctx.setLine(ghosts[i], [pos.clone().addScaledVector(dirArrow, (R / U) * 1.1), pos.clone().addScaledVector(dirArrow, (R / U) * 2.4)]);
            const passed = (p < 0.32 ? span(p, 0.03, 0.3) : span(p, 0.34, 0.68)) * 4 > i + 0.15;
            ctx.fade(ghosts[i], p < 0.7 && passed ? 1 : 0);
          });
          /* The turn, against a fixed direction (screen-up, a far star). */
          const mL = local(M);
          const star = sunward.clone();
          ctx.setLine(starRef, [mL, mL.clone().addScaledVector(star, (R / U) * 4)]);
          const faceDir = p < 0.32 ? fixedFace.clone() : toMoon.clone().negate();
          let turned = Math.atan2(star.clone().cross(faceDir).y, star.dot(faceDir));
          const startTurn = Math.atan2(star.clone().cross(sunward.clone().applyAxisAngle(up, Math.PI / 2).negate()).y, star.dot(sunward.clone().applyAxisAngle(up, Math.PI / 2).negate()));
          const total = p < 0.32 ? 0 : ang;
          const arcPts = [];
          const steps = 48;
          for (let k = 0; k <= steps; k += 1) {
            const a = startTurn + (total * k) / steps;
            arcPts.push(mL.clone().addScaledVector(star.clone().applyAxisAngle(up, a), (R / U) * 3.0));
          }
          ctx.setLine(turnArc, arcPts);
          ctx.fade(turnArc, p > 0.36 && p < 0.7 ? 1 : 0);
          ctx.fade(starRef, p > 0.36 && p < 0.7 ? 1 : 0);
          starWords.position.copy(mL).addScaledVector(star, (R / U) * 4.6);
          ctx.fade(starWords, p > 0.38 && p < 0.7 ? 1 : 0);
          turnLabel.position.copy(mL).add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(toMoon, 1.2);
          turnLabel.userData.draw(p < 0.32 ? ["No spin", "the arrow always points the same way"] : [`Turned ${Math.round((total / TAU) * 360)}°`, `orbit ${Math.round(span(p, 0.34, 0.68) * 100)}% done`]);
          ctx.fade(turnLabel, p < 0.7 ? smooth(p, 0.04, 0.08) : 0);
          void turned;
          ctx.fade(orbit, p < 0.7 ? 1 : 0);

          /* The far side: fly round behind the Moon, between it and the Sun. */
          if (p > 0.69 && stage === 0) stage = 1;
          if (p > 0.71 && stage === 1) {
            stage = 2;
            flyTo(ctx, "Moon", { shotYaw: yawFor(sunward), shotPitch: 0.1, shotDistance: R * 4.2 }, { near: 8 });
          }
          cut(stage === 1 || (stage === 2 && p < 0.735));
          ctx.fade(cutWords, stage === 1 || (stage === 2 && p < 0.735) ? 1 : 0);
          title.userData.draw(p < 0.32 ? ["If the Moon did not spin", "Earth would see all of it in turn"] : p < 0.7 ? ["The real Moon: locked", "one turn per orbit, the arrow always on Earth"] : ["The far side", "first seen by Luna 3, October 1959"]);
          ctx.fade(title, stage === 1 || (stage === 2 && p < 0.735) ? 0 : 1);
        },
        dispose() { rig.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 8 */
  event({
    id: "libration",
    section: "earth",
    body: "Moon",
    title: "Libration: the Moon's wobble",
    place: "The Moon",
    kind: "recurring",
    family: "orbit",
    often: "every month",
    detail: "The Moon seems to rock and nod over a month, so from Earth we see about 59% of its surface, not just half",
    frequency: "Continuous: the rocking follows the Moon's 27.6-day trip from perigee to perigee, the nodding its 27.2-day trip from node to node.",
    cause: "The Moon spins at a steady rate, but its orbit is an oval, so it moves faster near Earth and slower far away: the spin runs ahead, then behind, and we see up to 7.9° round its east and west edges. Its equator is tilted 6.7° to its orbit, so we also look over its north pole, then its south.",
    note: "A third, smaller effect comes from Earth's own size: between moonrise and moonset we see the Moon from points about 12,700 km apart, and peek another degree round its edge. Together, 59% of the Moon can be seen from Earth at one time or another; 41% never can.",
    accuracy: "The site's own Moon, seen from Earth. The rocking and nodding are drawn at their true maximum angles, 7.9° and 6.7°, but much faster than a month and with a simplified rhythm. The ring marks Mare Crisium (centre 17.0° N, 59.1° E, about 556 km across); the shaded edge band is the strip libration lets us see.",
    art: { main: "moon", fx: "wobble" },
    shotZoom: 1,
    shotPitch: 0.02,
    scene(ctx) {
      /* Maximum optical libration: 7.9° in longitude, 6.7° in latitude
       * (Moon's equator to its orbit, 6.68°). NASA: 59% visible. */
      const LON = 7.9;
      const LAT = 6.7;
      const moon = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody) return { duration: 22, update() {} };
      const R = rig.radius;
      const up = new THREE.Vector3(0, 1, 0);
      const E = rig.earthAt();
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const anti = E.clone().sub(S).setY(0).normalize();
      /* Full Moon, so the whole near side is lit. */
      const M = E.clone().addScaledVector(anti, rig.distance);
      rig.place(M);
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      const toEarth = anti.clone().negate();
      /* Far enough back that the whole Moon sits left of the event card:
       * its east limb, where Mare Crisium is, is on the right. */
      ctx.refocus("Moon", { shotYaw: yawFor(toEarth), shotPitch: 0.02, shotDistance: R * 10.5 });

      /* Mare Crisium's outline on the real Moon (Gazetteer of Planetary
       * Nomenclature: 17.0° N, 59.1° E, diameter 555.9 km). */
      const crisium = new THREE.Group();
      ctx.attach(moon, crisium);
      const CR = 555.9 / 2 / 1737.4;
      const c = bodyPoint(moon, 17.0, 59.1, 1).normalize();
      const helper = Math.abs(c.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up;
      const e1 = new THREE.Vector3().crossVectors(helper, c).normalize();
      const e2 = new THREE.Vector3().crossVectors(c, e1).normalize();
      const ringPts = [];
      for (let k = 0; k <= 96; k += 1) {
        const a = (k / 96) * TAU;
        ringPts.push(c.clone().multiplyScalar(Math.cos(CR)).addScaledVector(e1, Math.sin(CR) * Math.cos(a)).addScaledVector(e2, Math.sin(CR) * Math.sin(a)).multiplyScalar(R * 1.02));
      }
      const ring = ctx.line(ringPts, { colour: "#ffd27f", opacity: 1, parent: crisium, additive: false });
      ring.renderOrder = 30;
      const tag = new THREE.Group();
      tag.position.copy(c).multiplyScalar(R * 1.02).add(new THREE.Vector3(0, R * 0.55, 0));
      crisium.add(tag);
      const crisiumLabel = ctx.label(["Mare Crisium", "watch it near the edge"], { parent: tag, height: 0.024, colour: "#ffd27f", align: "right", declutter: false });

      /* The edge band only libration shows: beyond 90° from the mean
       * near-side centre, out to the most it can rock (7.9° east-west,
       * 6.7° north-south). A tint on the real Moon. */
      const band = new THREE.Mesh(
        new THREE.SphereGeometry(R * 1.012, 96, 48),
        new THREE.ShaderMaterial({
          uniforms: { uOpacity: { value: 0 } },
          vertexShader: /* glsl */ `
            varying vec3 vP;
            void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `,
          fragmentShader: /* glsl */ `
            uniform float uOpacity;
            varying vec3 vP;
            void main() {
              float ang = degrees(acos(clamp(vP.x, -1.0, 1.0)));
              vec2 q = normalize(vP.yz + 1e-5);
              float reach = 90.0 + mix(7.9, 6.7, abs(q.x));
              float inBand = step(90.0, ang) * (1.0 - smoothstep(reach - 0.6, reach + 0.6, ang));
              gl_FragColor = vec4(vec3(0.3, 0.85, 1.0) * inBand, 0.7 * inBand * uOpacity);
              #include <colorspace_fragment>
            }
          `,
          transparent: true, depthWrite: false, toneMapped: false,
        }),
      );
      band.renderOrder = 6;
      band.raycast = () => {};
      ctx.attach(moon, band);

      const hud = ctx.hudLayer();
      /* The box: where the Moon's centre points, in libration angles. */
      const BX = -1.2;
      const BY = 0.36;
      const H = 0.15;
      ctx.line([[BX - H, BY - H, 0], [BX + H, BY - H, 0], [BX + H, BY + H, 0], [BX - H, BY + H, 0], [BX - H, BY - H, 0]], { colour: "#9fb3c8", opacity: 0.45, parent: hud });
      ctx.line([[BX - H, BY, 0], [BX + H, BY, 0]], { colour: "#9fb3c8", opacity: 0.2, parent: hud });
      ctx.line([[BX, BY - H, 0], [BX, BY + H, 0]], { colour: "#9fb3c8", opacity: 0.2, parent: hud });
      ctx.label(["The wobble"], { at: [BX, BY + H + 0.06, 0], height: 0.022, parent: hud, declutter: false });
      const trace = ctx.line([[BX, BY, 0], [BX, BY, 0]], { colour: "#8fd0ff", opacity: 0.9, parent: hud });
      const dot = ctx.glow("#bfe9ff", 0.05, { opacity: 1, parent: hud });
      const angles = ctx.label(["", ""], { at: [-0.1, -0.58, 0], height: 0.028, parent: hud, declutter: false });
      const edge = ctx.label(["", ""], { at: [-1.2, -0.05, 0], height: 0.026, parent: hud, colour: "#ffd27f", declutter: false });
      const share = ctx.label(["59% seen from Earth", "41% never seen from here"], { at: [-0.1, 0.6, 0], height: 0.03, parent: hud, declutter: false });

      /* Rock only, then nod only, then both: a pure function of p. */
      const lib = (p) => {
        const m = TAU * 2.6 * p;
        const aLon = 1 - win(p, 0.27, 0.5, 0.05);
        const aLat = smooth(p, 0.25, 0.31);
        return [LON * aLon * Math.sin(m), LAT * aLat * Math.sin(m * 1.08 + 1.2)];
      };

      ctx.tell([
        { at: 0, label: "Almost one face", text: "Seen from Earth: tidally locked, the Moon keeps one face toward us, but it does not hold perfectly still." },
        { at: 0.08, label: "Side to side", text: "Its orbit is an oval, so it seems to rock up to 7.9° east and west. Watch Mare Crisium, the ringed sea: it slides in from the edge, then back toward it." },
        { at: 0.28, label: "Up and down", text: "Its equator is tilted 6.7° to its orbit, so over a month we look over its north pole, then its south." },
        { at: 0.55, label: "59%", text: "The shaded band is the extra strip the wobble lets us see. Together, over time, about 59% of the Moon, not just half." },
      ]);

      const view = new THREE.Vector3();
      const cw = new THREE.Vector3();
      return {
        duration: 22,
        update(p) {
          E.copy(rig.earthAt(E));
          const [lon, lat] = lib(p);
          /* Turn the near side away from Earth by the libration angles. */
          const side = new THREE.Vector3().crossVectors(up, toEarth).normalize();
          const dir = toEarth.clone().applyAxisAngle(up, -lon * DEG).applyAxisAngle(side, -lat * DEG);
          rig.place(M, { faceEarth: false });
          rig.face(dir);
          /* How far Crisium sits from the edge we see. */
          crisium.updateMatrixWorld(true);
          cw.copy(c).applyQuaternion(moon.getWorldQuaternion(new THREE.Quaternion()));
          view.copy(ctx.camera.position).sub(M).normalize();
          const fromEdge = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cw.dot(view), -1, 1)));
          edge.userData.draw(["Mare Crisium", `${fromEdge.toFixed(0)}° in from the edge`]);
          ctx.fade(edge, smooth(p, 0.08, 0.12));
          ctx.fade(crisiumLabel, smooth(p, 0.06, 0.1) * (1 - smooth(p, 0.5, 0.55)));
          ctx.fade(ring, smooth(p, 0.04, 0.08));
          band.material.uniforms.uOpacity.value = smooth(p, 0.55, 0.62);
          const pts = [];
          for (let q = 0; q <= p; q += 0.004) {
            const [a, b] = lib(q);
            pts.push([BX + (a / 9) * H, BY + (b / 9) * H, 0]);
          }
          pts.push([BX + (lon / 9) * H, BY + (lat / 9) * H, 0]);
          if (pts.length < 2) pts.push(pts[0]);
          ctx.setLine(trace, pts);
          dot.position.set(BX + (lon / 9) * H, BY + (lat / 9) * H, 0.01);
          angles.userData.draw([
            `Rock: ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "east edge shown" : "west edge shown"}`,
            `Nod: ${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "over the north pole" : "under the south pole"}`,
          ]);
          ctx.fade(share, smooth(p, 0.56, 0.62));
        },
        dispose() { rig.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 9 */
  event({
    id: "earthshine",
    section: "earth",
    body: "Moon",
    title: "Earthshine",
    place: "The Moon",
    kind: "recurring",
    family: "planetary",
    often: "every crescent Moon",
    detail: "The dark part of a crescent Moon glows faintly with sunlight that has bounced off Earth",
    frequency: "Every month, for a few days either side of new Moon: best on a thin evening or morning crescent in a dark, clear sky.",
    cause: "When we see a thin crescent, the Moon is nearly between us and the Sun, so from the Moon Earth looks nearly full. Sunlight reflects off Earth's clouds and oceans, lights the Moon's night side, and a little of it reflects back to us.",
    note: "Leonardo da Vinci explained it around 1510, in the notebook now called the Codex Leicester. Today astronomers measure earthshine to track how much sunlight Earth reflects, which changes with its cloud cover. Folk name: the old Moon in the new Moon's arms.",
    accuracy: "Played on the site's own Moon, Earth and Sun, with the Moon placed 38° from the Sun as seen from Earth (about 11% of its disc lit). The earthshine is brightened to be visible: it is thousands of times fainter than the crescent. The site draws the Moon about 19 times closer than it is; the light paths are drawn between the real bodies.",
    art: { main: "moon", second: "earth", fx: "glow" },
    shotZoom: 1,
    shotPitch: 0.04,
    scene(ctx) {
      const moon = ctx.host;
      const earth = ctx.findBody("Earth");
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody || !earth) return { duration: 22, update() {} };
      /* drawing choice: elongation 38°, about 11% of the disc lit. */
      const ELONG = 38 * DEG;
      const R = rig.radius;
      const up = new THREE.Vector3(0, 1, 0);
      const E = rig.earthAt();
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const sunward = S.clone().sub(E).setY(0).normalize();
      /* West of the Sun: a morning crescent, its lit edge on the left as
       * seen from the northern hemisphere (clear of the event card). */
      const toMoon = sunward.clone().applyAxisAngle(up, -ELONG);
      const M = E.clone().addScaledVector(toMoon, rig.distance);
      const moonOffset = M.clone().sub(E);
      rig.place(M);
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      const back = toMoon.clone().negate();
      ctx.refocus("Moon", { shotYaw: yawFor(back), shotPitch: 0.04, shotDistance: R * 6.5 });

      /* Earthshine on the real Moon: its own map, faintly lit grey-blue on
       * the night side (strength set by `uShine`). */
      const shineMat = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: moon.material?.map ?? null }, uShine: { value: 0 }, uSun: { value: sunward.clone() } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vN;
          void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform float uShine;
          uniform vec3 uSun;
          varying vec2 vUv;
          varying vec3 vN;
          void main() {
            float night = 1.0 - smoothstep(-0.08, 0.12, dot(normalize(vN), normalize(uSun)));
            vec3 base = texture2D(uMap, vUv).rgb;
            gl_FragColor = vec4(base * vec3(0.55, 0.68, 1.0) * uShine * night, 1.0);
            #include <colorspace_fragment>
          }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      });
      const shine = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 96, 48), shineMat);
      shine.renderOrder = 6;
      shine.raycast = () => {};
      ctx.attach(moon, shine);

      /* ---- the light's path between the real bodies (root: Moon radii) */
      const U = ctx.unit;
      const rel = (w) => w.clone().sub(M).divideScalar(U);
      const eL = rel(E);
      const paths = new THREE.Group();
      ctx.add(paths);
      const inFrom = eL.clone().addScaledVector(sunward, 14);
      const leg = (a, b, colour, opacity) => ctx.arrow(a, b, { colour, opacity, head: 0.9, parent: paths });
      const toward = (a, b, gap) => {
        const d = b.clone().sub(a).normalize();
        return [a.clone().addScaledVector(d, gap), b.clone().addScaledVector(d, -gap)];
      };
      const legs = [
        leg(...toward(inFrom, eL, 3.2), "#ffffff", 0.95),
        leg(...toward(eL.clone().add(new THREE.Vector3(0, 0.5, 0)), new THREE.Vector3(0, 0.5, 0), 3.4), "#8fd0ff", 0.95),
        leg(...toward(new THREE.Vector3(0, -0.5, 0), eL.clone().add(new THREE.Vector3(0, -0.5, 0)), 3.4), "#b9c4d8", 0.7),
      ];
      const earthLabel = ctx.label(["Earth", "nearly full, seen from the Moon"], { at: eL.clone().add(new THREE.Vector3(0, 4.2, 0)), height: 0.024, declutter: false });
      const moonLabel = ctx.label(["Moon"], { at: new THREE.Vector3(0, 2.2, 0), height: 0.024, declutter: false });
      const sunLabel = ctx.label(["Sunlight"], { at: inFrom.clone().add(eL).multiplyScalar(0.5).add(new THREE.Vector3(0, 1.6, 0)), height: 0.024, declutter: false });

      const hud = ctx.hudLayer();
      const step = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.032, declutter: false });
      const leonardo = ctx.label(["Leonardo da Vinci, about 1510", "Codex Leicester"], { parent: hud, at: [0, -0.62, 0], height: 0.028, declutter: false });

      ctx.tell([
        { at: 0, label: "A crescent", text: "From Earth, a thin crescent Moon in the twilight before dawn, its lit edge toward the Sun." },
        { at: 0.14, label: "The rest of it", text: "Look again: the dark part glows faintly, grey-blue. This is earthshine." },
        { at: 0.34, label: "Light bounced twice", text: "Sunlight lights Earth's day side, reflects to the Moon, and a little reflects back to us. From the Moon, Earth is nearly full." },
        { at: 0.76, label: "Leonardo", text: "Leonardo da Vinci explained it around 1510. Today earthshine is used to measure how much sunlight Earth reflects." },
      ]);

      let stage = 0;
      return {
        duration: 22,
        update(p) {
          rig.place(earth.getWorldPosition(new THREE.Vector3()).add(moonOffset));
          shineMat.uniforms.uSun.value.copy(sunward);
          shineMat.uniforms.uShine.value = 0.12 * smooth(p, 0.12, 0.3);
          if (p > 0.33 && stage === 0) {
            stage = 1;
            /* Up and back, over the Earth-Moon pair, the Sun off to one side. */
            ctx.refocus("Moon", { shotYaw: yawFor(back.clone().applyAxisAngle(up, 0.9)), shotPitch: 1.0, shotDistance: rig.distance * 5 });
          }
          if (p > 0.72 && stage === 1) {
            stage = 2;
            ctx.refocus("Moon", { shotYaw: yawFor(back), shotPitch: 0.04, shotDistance: R * 6.5 });
          }
          const show = smooth(p, 0.36, 0.4) * (1 - smooth(p, 0.7, 0.73));
          ctx.fade(paths, show);
          const steps = [smooth(p, 0.4, 0.45), smooth(p, 0.5, 0.55), smooth(p, 0.6, 0.65)];
          legs.forEach((l, i) => ctx.fade(l, show * steps[i]));
          ctx.fade(earthLabel, show);
          ctx.fade(moonLabel, show);
          ctx.fade(sunLabel, show);
          step.userData.draw(p < 0.36 ? ["A crescent Moon", p < 0.14 ? "before dawn" : "and the rest of it, faintly"]
            : p < 0.5 ? ["1 · Sunlight lights Earth", "its clouds and oceans shine"] : p < 0.6 ? ["2 · Earth's light reaches the Moon", "and lights its night side"] : ["3 · and bounces back to your eye", "as earthshine"]);
          ctx.fade(leonardo, smooth(p, 0.76, 0.8));
        },
        dispose() { rig.restore(); },
      };
    },
  }),

  /* ----------------------------------------------------------------- 10 */
  event({
    id: "theia-impact",
    section: "earth",
    body: "Earth",
    title: "How the Moon was born: the Theia impact",
    place: "The young Earth",
    kind: "transient",
    family: "origins",
    when: "About 4.5 billion years ago",
    often: "once, about 4.5 billion years ago",
    detail: "A Mars-sized world strikes the young Earth a glancing blow, and the molten debris it throws into orbit gathers into the Moon",
    frequency: "Once. It is the leading explanation for the Moon's origin, proposed in the 1970s, but it is still a theory: the details are debated.",
    cause: "Tens of millions of years after the planets formed, a body about the size of Mars, often called Theia, hit the proto-Earth at an angle. Much of both mantles melted and vaporised, and Theia's iron core largely merged with Earth's. A disc of molten rock and vapour was left in orbit, and its outer part gathered into the Moon.",
    note: "The clues: Moon rocks brought back by Apollo have almost exactly Earth's oxygen isotopes; the Moon has only a small iron core; and it is very dry, as if baked. Simulations disagree on how fast the Moon formed, from hours to a century or so.",
    accuracy: "Played on the site's own Earth, turned back in time: its surface is replaced by a painted molten crust (a drawing, after artists' impressions of the young Earth), its clouds, oceans and city lights removed, and the Moon hidden until it forms. Theia is drawn at Mars's size against Earth (0.53 of Earth's radius). The disc, and how fast the Moon gathers, are illustrative; the new Moon is placed on the site's own Moon orbit.",
    art: { main: "earth", second: "rock", fx: "impact" },
    shotZoom: 2.1,
    shotPitch: 0.45,
    facesSun: true,
    shotSwing: 0.85,
    scene(ctx) {
      const earth = ctx.host;
      /* The camera on the sunlit side, swung 0.85 rad off the Sun's line
       * (set here, so it does not depend on where the camera came from). */
      ctx.refocus("Earth", { shotYaw: yawFor(ctx.sunDir.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.85)), shotZoom: 2.1, shotPitch: 0.45 });
      const rig = moonRig(ctx);
      const U = ctx.unit;
      /* Theia ~Mars-sized: 3,389.5 / 6,371 = 0.53 Earth radii (NASA). */
      const RT = MARS_RADIUS / EARTH_RADIUS;
      const layers = earthLayers(earth);
      const spin = spinner(earth);
      const skin = earthSkin(ctx, earth, "proto");
      const su = skin.userData.u;
      /* The Moon does not exist yet. */
      const veil = rig?.system ? [rig.system] : [];
      ctx.setVeil(veil);
      /* The disc lies in the plane of Earth's orbit, where the Moon's orbit
       * lies (within 5°); seen from a little above. */
      const discNormal = new THREE.Vector3(0, 1, 0);
      const d1 = new THREE.Vector3().crossVectors(discNormal, Math.abs(discNormal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)).normalize();
      const d2 = new THREE.Vector3().crossVectors(discNormal, d1).normalize();
      const moonOrbit = (rig?.distance ?? U * 3.15) / U;

      const theia = ctx.rock(RT, { colour: "#7d6e60", seed: 3, lumps: 0.08, emissive: "#140400" });
      theia.visible = false;
      const theiaGlow = ctx.glow("#ff9a5a", RT * 2.6, { opacity: 0 });
      const flash = ctx.glow("#fff1c4", 3, { opacity: 0 });
      const plume = ctx.glow("#ff7a2e", 2, { opacity: 0 });

      /* Debris: thrown out of the impact, then settling into a disc in the
       * plane of the Moon's orbit, turning (faster nearer Earth); the outer
       * part gathers into the Moon, the inner part rains back. */
      const N = 2600;
      const debris = ctx.cloud(N, { size: 2.6 });
      const r = rng(41);
      const bits = Array.from({ length: N }, () => {
        const rho = 1.12 + (moonOrbit * 1.25 - 1.12) * Math.pow(r(), 0.75);
        return {
          rho,
          phi0: r() * TAU,
          y: (r() - 0.5) * 0.12,
          spread: r(),
          outer: rho > moonOrbit * 0.72,
          delay: r() * 0.08,
          v: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5),
          off: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.5),
        };
      });
      bits.forEach((b, i) => {
        const hot = r();
        debris.tint(i, hot > 0.6 ? "#ffcf7a" : hot > 0.25 ? "#ff8a4a" : "#c9b8a6");
        debris.size[i] = 1.6 + r() * 2.4;
        debris.alpha[i] = 0;
      });
      debris.commit();
      const newMoon = moltenBall(ctx, (rig?.radius ?? U * 0.37) / U, { seed: 9 });
      newMoon.visible = false;

      const hud = ctx.hudLayer();
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.036, declutter: false });
      const theiaLabel = ctx.label(["Theia", "about the size of Mars"], { height: 0.026, declutter: false });
      const moonLabel = ctx.label(["The Moon", "molten, and far closer than today"], { height: 0.026, declutter: false });
      ctx.fade(theiaLabel, 0);
      ctx.fade(moonLabel, 0);

      ctx.tell([
        { at: 0, label: "Back in time", text: "Our Earth, wound back four and a half billion years: the clouds, the oceans and the Moon all disappear." },
        { at: 0.16, label: "Proto-Earth", text: "The young Earth: a glowing, half-molten world, cracked with lava and battered by impacts." },
        { at: 0.24, label: "Theia", text: "A world about the size of Mars, often called Theia, is on a collision course." },
        { at: 0.36, label: "Impact", text: "A glancing blow. Much of both worlds melts and vaporises, and Theia's iron core sinks into Earth's." },
        { at: 0.48, label: "A disc", text: "Molten rock and vapour are thrown into orbit: a hot ring of debris spinning round the battered Earth." },
        { at: 0.68, label: "The Moon gathers", text: "Within a short time the outer disc clumps into the Moon. Apollo's Moon rocks share Earth's oxygen isotopes: a family likeness." },
      ]);

      let lastT = ctx.t;
      let frame = null;
      const C = new THREE.Vector3();
      const vIn = new THREE.Vector3();
      const n = new THREE.Vector3();
      const P = new THREE.Vector3();
      const moonPos = new THREE.Vector3();
      const E = new THREE.Vector3();
      let moonPhi0 = null;
      let unveiled = false;
      return {
        duration: 26,
        update(p) {
          const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
          lastT = ctx.t;
          /* Rewind: Earth spins backwards, faster and faster, then slows. */
          const rewind = win(p, 0.02, 0.17, 0.05);
          spin.add(-dt * 14 * rewind * rewind + dt * 0.25 * smooth(p, 0.17, 0.22));
          su.uMix.value = smooth(p, 0.07, 0.15);
          su.uTime.value = ctx.t;
          su.uHeat.value = lerp(0.25, 1, smooth(p, 0.36, 0.42)) * (1 - 0.45 * smooth(p, 0.75, 1));
          layers.fade("clouds", 1 - smooth(p, 0.05, 0.12));
          layers.fade("lights", 1 - smooth(p, 0.04, 0.08));
          layers.fade("aurora", 1 - smooth(p, 0.04, 0.08));
          layers.fade("air", lerp(1, 0.35, smooth(p, 0.06, 0.14)));
          const years = p < 0.16 ? 4.5e9 * Math.pow(span(p, 0.02, 0.15), 2) : 4.5e9;
          clock.userData.draw(p < 0.02 ? ["Today", ""] : [years >= 1e9 ? `${(years / 1e9).toFixed(1)} billion years ago` : `${Math.round(years / 1e6)} million years ago`, p < 0.16 ? "winding back time" : "the young Earth"]);

          /* Theia's path, set once the camera has arrived: in from the
           * upper left, a glancing blow on the left-hand limb. */
          if (!frame && p > 0.2) {
            const { right, up } = cameraAxes(ctx.camera);
            /* On the left-hand limb, clear of the event card. */
            n.copy(right).multiplyScalar(-0.82).addScaledVector(up, 0.32).addScaledVector(ctx.camDir, 0.42).normalize();
            const t = up.clone().addScaledVector(n, -up.dot(n)).normalize();
            vIn.copy(n).multiplyScalar(-0.5).addScaledVector(t, -0.86).normalize();
            C.copy(n).multiplyScalar(1 + RT * 0.85);
            frame = true;
            ctx.setZoom(3.3);
          }
          if (frame) {
            const approach = span(p, 0.22, 0.36);
            const sink = span(p, 0.36, 0.44);
            const pos = C.clone().addScaledVector(vIn, -16 * Math.pow(1 - approach, 1.5)).addScaledVector(vIn, 0.9 * sink);
            theia.position.copy(pos);
            theia.rotation.set(ctx.t * 0.2, ctx.t * 0.3, 0);
            theia.visible = p > 0.21 && p < 0.44;
            theia.scale.setScalar(Math.max(0.001, 1 - 0.9 * sink));
            ctx.fade(theiaGlow, theia.visible ? 0.25 + 0.75 * smooth(p, 0.33, 0.36) : 0);
            theiaGlow.position.copy(pos);
            theiaLabel.position.copy(pos).add(new THREE.Vector3(0, RT + 0.5, 0));
            ctx.fade(theiaLabel, smooth(p, 0.23, 0.26) * (1 - smooth(p, 0.33, 0.35)));
            const f = win(p, 0.355, 0.46, 0.012) * (1 - span(p, 0.36, 0.46) * 0.6);
            flash.position.copy(n).multiplyScalar(1.15);
            flash.scale.setScalar(1.5 + 7 * span(p, 0.355, 0.42));
            ctx.fade(flash, f);
            plume.position.copy(n).multiplyScalar(1.5 + 1.2 * span(p, 0.36, 0.5));
            plume.scale.setScalar(2 + 4 * span(p, 0.36, 0.5));
            ctx.fade(plume, win(p, 0.36, 0.56, 0.03) * 0.8);
          }

          /* The new Moon's place: on the site's own Moon orbit, gathering
           * on the left of the screen (clear of the event card) and drifting
           * slowly round. */
          earth.getWorldPosition(E);
          const tau = span(p, 0.38, 1);
          if (moonPhi0 === null && frame) {
            const { right } = cameraAxes(ctx.camera);
            moonPhi0 = Math.atan2(-right.dot(d2), -right.dot(d1)) - 0.5;
          }
          const moonPhi = (moonPhi0 ?? 0) + 0.5 * smooth(p, 0.6, 1);
          moonPos.copy(d1).multiplyScalar(Math.cos(moonPhi) * moonOrbit).addScaledVector(d2, Math.sin(moonPhi) * moonOrbit);
          const shown = frame && p > 0.36;
          for (let i = 0; i < N; i += 1) {
            const b = bits[i];
            if (!shown) { debris.alpha[i] = 0; continue; }
            const settle = smooth(tau, 0.06 + b.delay, 0.38 + b.delay);
            const phi = b.phi0 + 1.1 * tau * 6 * Math.pow(2 / b.rho, 1.5);
            const disc = d1.clone().multiplyScalar(Math.cos(phi) * b.rho).addScaledVector(d2, Math.sin(phi) * b.rho).addScaledVector(discNormal, b.y);
            /* Thrown out of the impact along Theia's way, spreading. */
            const fly = Math.min(1, tau * 4);
            P.copy(n).multiplyScalar(1.05).addScaledVector(vIn, 2.4 * fly * (0.4 + b.spread)).addScaledVector(n, 1.6 * fly * b.spread).addScaledVector(b.v, 2.2 * fly);
            P.lerp(disc, settle);
            let alpha = 0.85;
            if (b.outer) {
              const g = smooth(p, 0.66 + b.delay, 0.88 + b.delay * 0.5);
              P.lerp(moonPos.clone().add(b.off.clone().multiplyScalar(1 - g)), g);
              alpha *= 1 - smooth(g, 0.75, 1);
            } else {
              const g = smooth(p, 0.62 + b.delay, 0.86 + b.delay);
              P.multiplyScalar(lerp(1, 1.0 / Math.max(P.length(), 1e-3), g));
              alpha *= 1 - smooth(g, 0.6, 1);
            }
            debris.set(i, P.x, P.y, P.z);
            debris.alpha[i] = alpha;
          }
          debris.commit();
          const grow = smooth(p, 0.7, 0.9);
          newMoon.visible = grow > 0.01 && !unveiled;
          newMoon.position.copy(moonPos);
          newMoon.scale.setScalar(Math.max(0.001, grow));
          newMoon.rotation.y = ctx.t * 0.2;
          newMoon.userData.heat(1 - smooth(p, 0.84, 0.95));
          moonLabel.position.copy(moonPos).add(new THREE.Vector3(0, 1.0, 0));
          ctx.fade(moonLabel, smooth(p, 0.84, 0.9));
          /* The site's own Moon takes its place (put back on its own orbit
           * when the event ends). */
          if (p > 0.95 && rig) {
            rig.place(moonPos.clone().multiplyScalar(U).add(E));
            if (!unveiled) {
              unveiled = true;
              ctx.setVeil(null);
            }
          }
        },
        dispose() { layers.restore(); spin.restore(); rig?.restore(); },
      };
    },
  }),

  /* ----------------------------------------------------------------- 11 */
  event({
    id: "moonquakes",
    section: "earth",
    title: "Moonquakes",
    place: "The Moon",
    kind: "ongoing",
    family: "geology",
    often: "still happening",
    detail: "The Moon still quakes, and because its rock is dry and cold, the shaking rings on for tens of minutes",
    frequency: "Apollo's seismometers recorded more than 12,000 events between 1969 and 1977, most of them tiny. Only 28 were strong shallow moonquakes, but those reached about magnitude 5.",
    cause: "Most moonquakes are deep, around 700 km down, and come in rhythm with the tides Earth raises in the Moon. Shallow ones, a few tens of kilometres down, are rarer and stronger: some line up with young faults pushed up as the Moon shrinks while its interior cools. Others come from meteorite impacts and from the rock heating and cooling between day and night.",
    note: "On Earth, water in the rock damps seismic waves, and shaking fades within minutes. The Moon's rock is dry, cold and shattered: waves scatter round and round with little loss, and the Moon rings like a bell.",
    accuracy: "The seismograph traces are schematic: their envelopes are shaped like Apollo's records of a shallow moonquake and like a typical earthquake record, not copies of either. The wavefronts are a drawing. The four Apollo seismometer sites are placed at their true locations.",
    art: { main: "moon", fx: "ripple" },
    scene(ctx) {
      /* Apollo Passive Seismic Experiment stations (lat, lon): Apollo 12
       * 3.01° S 23.42° W, 14 3.64° S 17.48° W, 15 26.13° N 3.63° E, 16
       * 8.97° S 15.50° E (NASA NSSDCA). Network ran Nov 1969 to Sept 1977. */
      const STATIONS = [[-3.01, -23.42], [-3.64, -17.48], [26.13, 3.63], [-8.97, 15.5]];
      /* drawing choice: a shallow quake in the northern highlands */
      const EPI = [22, -38];
      /* layout */
      const MX = -0.66;
      const MY = 0.14;
      const R = 0.34;
      ctx.light.set(-0.3, 0.3, 1).normalize();
      const moon = moonBall(ctx, R, { light: [-0.3, 0.3, 1] });
      moon.position.set(MX, MY, 0);
      STATIONS.forEach(([lat, lon]) => {
        const dot = ctx.ball(0.011, { colour: "#5aff9a", emissive: "#108040", parent: moon });
        dot.position.copy(geo(R * 1.005, lat, lon));
      });
      const epi = ctx.ball(0.014, { colour: "#ff6b6b", emissive: "#a00000", parent: moon });
      const c = geo(1, ...EPI);
      epi.position.copy(c).multiplyScalar(R * 1.006);
      const u = new THREE.Vector3(0, 1, 0).cross(c).normalize();
      const w = c.clone().cross(u).normalize();
      const RINGS = 5;
      const rings = Array.from({ length: RINGS }, () => ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffb08a", opacity: 0.8, parent: moon }));
      const ringPoints = (delta) => {
        const pts = [];
        for (let k = 0; k <= 72; k += 1) {
          const t = (k / 72) * TAU;
          const v = c.clone().multiplyScalar(Math.cos(delta))
            .add(u.clone().multiplyScalar(Math.cos(t) * Math.sin(delta)))
            .add(w.clone().multiplyScalar(Math.sin(t) * Math.sin(delta)));
          pts.push(v.multiplyScalar(R * 1.008));
        }
        return pts;
      };
      ctx.label(["Apollo seismometers", "12, 14, 15 and 16"], { at: [MX, MY - R - 0.12, 0], height: 0.024, colour: "#8dffb8" });

      /* The traces: 60 minutes, one sample every ~5 s. */
      const X0 = -0.16;
      const X1 = 0.98;
      const MINUTES = 60;
      const SAMPLES = 720;
      const r = rng(19);
      const noise = Array.from({ length: SAMPLES + 1 }, () => r() - 0.5);
      const phases = [r() * TAU, r() * TAU, r() * TAU];
      const wiggle = (i) => Math.sin(i * 1.9 + phases[0]) * 0.45 + Math.sin(i * 3.1 + phases[1]) * 0.3 + noise[i] * 0.5;
      /* drawing choice: onset at 1 min; the Moon's envelope builds over
       * minutes and decays with a ~20 min time constant, Earth's within
       * about a minute. */
      const moonEnv = (t) => (t < 1 ? 0 : (1 - Math.exp(-(t - 1) / 2.5)) * Math.exp(-(t - 1) / 20));
      const earthEnv = (t) => (t < 1 ? 0 : Math.exp(-(t - 1) / 0.7));
      const traceY = [0.34, -0.2];
      const AMPL = 0.14;
      const series = [moonEnv, earthEnv].map((env, s) => Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const t = (i / SAMPLES) * MINUTES;
        return new THREE.Vector3(lerp(X0, X1, i / SAMPLES), traceY[s] + AMPL * env(t) * wiggle(i) * 1.6 / (s === 0 ? 0.7 : 1), 0);
      }));
      const traces = traceY.map((y, s) => {
        ctx.line([[X0, y - AMPL - 0.04, 0], [X1, y - AMPL - 0.04, 0]], { colour: "#9fb3c8", opacity: 0.35 });
        [0, 10, 20, 30, 40, 50, 60].forEach((m) => {
          const x = lerp(X0, X1, m / MINUTES);
          ctx.line([[x, y - AMPL - 0.04, 0], [x, y - AMPL - 0.065, 0]], { colour: "#9fb3c8", opacity: 0.4 });
        });
        return ctx.line(series[s].slice(0, 2), { colour: s === 0 ? "#ffb08a" : "#8fd0ff", opacity: 0.95, additive: false });
      });
      ctx.label(["On the Moon", "a shallow moonquake"], { at: [X0, traceY[0] + 0.2, 0], align: "left", height: 0.026 });
      ctx.label(["On Earth", "a quake of similar size"], { at: [X0, traceY[1] + 0.2, 0], align: "left", height: 0.026 });
      ctx.label(["0", "", ""], { at: [X0, traceY[1] - AMPL - 0.1, 0], height: 0.02, declutter: false });
      ctx.label(["60 min"], { at: [X1, traceY[1] - AMPL - 0.1, 0], height: 0.02, declutter: false });
      const pens = [ctx.glow("#ffd2b8", 0.05), ctx.glow("#cfe8ff", 0.05)];
      const clock = ctx.label([""], { at: [0.42, -0.6, 0], height: 0.032 });
      const base = moon.position.clone();

      ctx.tell([
        { at: 0, label: "Listening", text: "Apollo 12, 14, 15 and 16 left seismometers on the Moon. From 1969 to 1977 they recorded more than 12,000 events." },
        { at: 0.16, label: "A shallow quake", text: "Most moonquakes are tiny and deep, set off by Earth's tides. The rare shallow ones reach about magnitude 5." },
        { at: 0.42, label: "Ringing like a bell", text: "Dry, cold, shattered rock barely damps the waves. On Earth the shaking fades within minutes; on the Moon it rings on for tens of minutes." },
        { at: 0.74, label: "Still shaking", text: "The Moon is slowly shrinking as it cools, and some shallow quakes line up with young faults that the squeeze has pushed up." },
      ]);

      return {
        duration: 20,
        update(p) {
          const minutes = MINUTES * span(p, 0.14, 0.94);
          const n = Math.max(2, Math.floor((minutes / MINUTES) * SAMPLES) + 1);
          traces.forEach((line, s) => {
            ctx.setLine(line, series[s].slice(0, n));
            const head = series[s][n - 1];
            pens[s].position.set(head.x, head.y, 0.01);
          });
          clock.userData.draw([minutes < 1 ? "Quiet" : `${Math.floor(minutes)} min after the quake`]);
          /* Wavefronts spreading from the epicentre, again and again. */
          const since = Math.max(0, minutes - 1);
          const env = moonEnv(minutes);
          rings.forEach((line, k) => {
            const delta = ((since * 0.11 + k / RINGS) % 1) * 2.2;
            ctx.setLine(line, ringPoints(Math.max(0.01, delta)));
            ctx.fade(line, since > 0 ? (1 - delta / 2.2) * clamp01(env * 2 + 0.15) : 0);
          });
          const shake = 0.006 * env;
          moon.position.set(base.x + shake * Math.sin(ctx.t * 41), base.y + shake * Math.cos(ctx.t * 37), base.z);
          moon.rotation.y = -Math.PI / 2;
        },
      };
    },
  }),
];

import * as THREE from "three";
import { event, smooth, win, span, lerp, TAU, rng, easeInOut } from "./kit.js";
import { bodyRadius, surfacePoint as bodyPoint, latLonOf, turnBodyToward, yawFor, earthAurora, sunSpots, sideGlow, flyTo } from "./real.js";

/**
 * Section 2 of the catalogue: the Sun (round 79).
 *
 * Ten events on and from our star: flares and the great storms they drive,
 * the 11-year cycle, prominences, coronal holes, the uneven spin, the boiling
 * surface, neutrinos, and the Sun's own far future. Round 82: the flares,
 * storms, prominences, coronal hole, neutrinos and red giant now play on the
 * site's own Sun and Earth; the cycle, the spin and the granulation stay
 * dioramas, with the Sun drawn white.
 *
 * Solar numbers are NASA's Sun fact sheet (nssdc.gsfc.nasa.gov/planetary/
 * factsheet/sunfact.html) unless a comment says otherwise.
 */

const D2R = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
/* Sun's radius 695,700 km (IAU 2015 nominal); Earth's mean 6,371 km (NASA). */
const SUN_KM = 695700;
const EARTH_KM = 6371;
/* 1 AU = 149,597,871 km; light crosses it in 499.0 s (IAU). */
const AU_KM = 149597871;
const LIGHT_AU_S = 499.005;

/* ------------------------------------------------------------ local helpers */

/*
 * A flat patch of solar surface: a cell pattern (granulation) drawn with a
 * Voronoi shader. As a disc (`radius`) it also darkens toward its edge like
 * the real limb; as a rectangle it fades out at its borders. `uEvolve` is set
 * from progress, so the cells' shapes are a pure function of p.
 */
const SURFACE_VERTEX = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SURFACE_FRAGMENT = /* glsl */ `
uniform float uCells;
uniform float uEvolve;
uniform float uRadius;
uniform vec2 uHalf;
uniform vec3 uColor;
uniform vec3 uHot;
uniform vec3 uLane;
uniform float uOpacity;
uniform float uBright;
varying vec2 vPos;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
void main() {
  vec2 q = vPos * uCells;
  vec2 ip = floor(q);
  vec2 fp = fract(q);
  float d1 = 9.0;
  float d2 = 9.0;
  float life = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 h = hash2(ip + g);
      vec2 o = 0.5 + 0.36 * sin(uEvolve * (0.55 + 0.5 * h.yx) + 6.2831 * h);
      vec2 d = g + o - fp;
      float dd = dot(d, d);
      if (dd < d1) { d2 = d1; d1 = dd; life = h.x; } else if (dd < d2) { d2 = dd; }
    }
  }
  float edge = sqrt(d2) - sqrt(d1);
  float cell = smoothstep(0.02, 0.3, edge);
  float pulse = 0.72 + 0.28 * sin(uEvolve * 1.3 + life * 6.2831);
  float centre = clamp(1.0 - sqrt(d1) * 1.5, 0.0, 1.0);
  vec3 col = mix(uLane, uColor, cell * pulse);
  col = mix(col, uHot, centre * cell * 0.6 * pulse);
  float a = uOpacity;
  if (uRadius > 0.0) {
    float r = length(vPos) / uRadius;
    float mu = sqrt(max(0.0, 1.0 - r * r));
    col *= 0.38 + 0.62 * pow(mu, 0.5);
  } else {
    vec2 e = abs(vPos) / uHalf;
    a *= (1.0 - smoothstep(0.84, 1.0, e.x)) * (1.0 - smoothstep(0.8, 1.0, e.y));
  }
  gl_FragColor = vec4(col * uBright, a);
  #include <colorspace_fragment>
}
`;

function surface(ctx, { radius = 0, width = 2, height = 1.3, cells = 26, colour = "#ff9a3a", hot = "#fff0b8", lane = "#6e2205", bright = 1.12, parent = ctx.root } = {}) {
  const geometry = radius > 0 ? new THREE.CircleGeometry(radius, 256) : new THREE.PlaneGeometry(width, height);
  const material = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    uniforms: {
      uCells: { value: cells }, uEvolve: { value: 0 }, uRadius: { value: radius },
      uHalf: { value: new THREE.Vector2(width / 2, height / 2) },
      uColor: { value: new THREE.Color(colour) }, uHot: { value: new THREE.Color(hot) }, uLane: { value: new THREE.Color(lane) },
      uOpacity: { value: 1 }, uBright: { value: bright },
    },
    transparent: true, depthWrite: false, toneMapped: false, fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 18;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

/* A patch lying on a sphere of radius R (sunspots, a coronal hole), with a
 * slightly irregular edge. Centred at latitude/longitude, `ang` degrees wide
 * (angular radius). Drawn just above the surface, hidden behind the limb. */
function spherePatch(ctx, parent, R, latDeg, lonDeg, ang, { colour = "#1c0b03", opacity = 0.92, seed = 1, wobble = 0.22, lift = 1.004, stretch = 1 } = {}) {
  const c = ctx.onSphere(1, latDeg, lonDeg).normalize();
  const helper = Math.abs(c.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const e1 = new THREE.Vector3().crossVectors(helper, c).normalize();
  const e2 = new THREE.Vector3().crossVectors(c, e1).normalize();
  const r = rng(seed);
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const edge = (a) => 1 + wobble * (0.55 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(3 * a + ph[1]) + 0.15 * Math.sin(5 * a + ph[2]));
  const RINGS = 5;
  const SEG = 40;
  const pos = [];
  const push = (v) => pos.push(v.x, v.y, v.z);
  push(c.clone().multiplyScalar(R * lift));
  for (let k = 1; k <= RINGS; k += 1) {
    for (let s = 0; s < SEG; s += 1) {
      const a = (s / SEG) * TAU;
      const g = ang * D2R * (k / RINGS) * edge(a);
      const dir = e1.clone().multiplyScalar(Math.cos(a) * stretch).add(e2.clone().multiplyScalar(Math.sin(a))).normalize();
      push(c.clone().multiplyScalar(Math.cos(g)).add(dir.multiplyScalar(Math.sin(g))).multiplyScalar(R * lift));
    }
  }
  const index = [];
  const vi = (k, s) => 1 + (k - 1) * SEG + (s % SEG);
  for (let s = 0; s < SEG; s += 1) index.push(0, vi(1, s), vi(1, s + 1));
  for (let k = 1; k < RINGS; k += 1) {
    for (let s = 0; s < SEG; s += 1) {
      const a = vi(k, s); const b = vi(k, s + 1); const cc = vi(k + 1, s); const d = vi(k + 1, s + 1);
      index.push(a, cc, b, b, cc, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
  }));
  mesh.renderOrder = 21;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = opacity;
  parent.add(mesh);
  return mesh;
}

/* A sunspot on a sphere: a brown penumbra round a near-black umbra. */
function sunspot(ctx, parent, R, lat, lon, size, seed) {
  const group = new THREE.Group();
  parent.add(group);
  spherePatch(ctx, group, R, lat, lon, size, { colour: "#5a1f06", opacity: 0.8, seed, lift: 1.003 });
  spherePatch(ctx, group, R, lat, lon, size * 0.45, { colour: "#140501", opacity: 0.95, seed: seed + 7, lift: 1.005 });
  return group;
}

/*
 * A coronal mass ejection as a cloud: an expanding bubble whose leading edge
 * runs from `from` to `to` as s goes 0 to 1 (hud plane).
 */
function cmeCloud(ctx, count, seed, { colour = "#ffcf8a", size = 2.6 } = {}) {
  const cloud = ctx.cloud(count, { size });
  const r = rng(seed);
  const pts = Array.from({ length: count }, () => ({ a: (r() - 0.5) * 1.6, w: r(), z: r() - 0.5 }));
  pts.forEach((_, i) => cloud.tint(i, i % 4 ? colour : "#ffffff"));
  return {
    cloud,
    set(from, to, s, alpha) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const L = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const d = s * L;
      const rad = 0.42 * d + 0.015;
      const cx = from.x + Math.cos(ang) * (d - rad);
      const cy = from.y + Math.sin(ang) * (d - rad);
      pts.forEach((q, i) => {
        const th = ang + q.a;
        const rr = rad * (0.8 + 0.2 * q.w);
        cloud.set(i, cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, q.z * rad * 0.4);
        cloud.alpha[i] = alpha * (0.35 + 0.65 * (1 - Math.abs(q.a) / 0.8));
      });
      cloud.commit();
    },
  };
}

/*
 * Earth with an aurora oval, for the storms. The oval is a ring of points
 * round the geomagnetic north pole: green (oxygen, ~100-200 km up) and a
 * fainter red band (oxygen, 200-400 km up) reaching farther toward the
 * equator. Points on the sunlit side are dimmed.
 */
function stormGlobe(ctx, { radius, at, tilt = 0.42, pole = [80.7, -72.7], count = 2600, seed = 5 }) {
  const holder = new THREE.Group();
  holder.position.set(...at);
  holder.rotation.x = tilt;
  ctx.add(holder);
  const spin = new THREE.Group();
  holder.add(spin);
  const earth = ctx.ball(radius, { body: "Earth", night: 0.13, rim: 0.55, rimColour: "#6fa8ff", parent: spin });
  /* Map longitude (east +) onto the kit's sphere: the map's 0° faces +x. */
  const geo = (lat, lon, r = 1) => ctx.onSphere(r, lat, lon + 90);
  const P = geo(pole[0], pole[1]).normalize();
  const U = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), P).normalize();
  const V = new THREE.Vector3().crossVectors(P, U).normalize();
  const aurora = ctx.cloud(count, { parent: spin, size: 3.2 });
  const r = rng(seed);
  const pts = Array.from({ length: count }, (_, i) => ({ phi: r() * TAU, w: r(), red: i % 3 === 0, f: r() * TAU }));
  pts.forEach((q, i) => aurora.tint(i, q.red ? "#ff4d5e" : "#57ff98"));
  const q = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const facing = (local) => {
    q.copy(holder.quaternion).multiply(spin.quaternion);
    return dir.copy(local).normalize().applyQuaternion(q);
  };
  return {
    holder, spin, earth, geo, facing,
    /* edge: the green oval's equatorward edge, magnetic latitude in degrees. */
    set(edge, strength, t) {
      q.copy(holder.quaternion).multiply(spin.quaternion);
      pts.forEach((pt, i) => {
        const mlat = pt.red ? edge - 8 + pt.w * 15 : edge + pt.w * 9;
        const c = (90 - mlat) * D2R;
        const wave = 0.035 * Math.sin(pt.phi * 6 + t * 0.7);
        tmp.copy(P).multiplyScalar(Math.cos(c + wave))
          .addScaledVector(U, Math.sin(c + wave) * Math.cos(pt.phi))
          .addScaledVector(V, Math.sin(c + wave) * Math.sin(pt.phi));
        const alt = pt.red ? 1.07 : 1.03;
        aurora.set(i, tmp.x * radius * alt, tmp.y * radius * alt, tmp.z * radius * alt);
        const sunward = dir.copy(tmp).applyQuaternion(q).dot(ctx.light);
        const night = 1 - 0.85 * smooth(sunward, -0.2, 0.25);
        const flicker = 0.6 + 0.4 * Math.sin(t * 2.3 + pt.f);
        aurora.alpha[i] = strength * night * flicker * (pt.red ? 0.5 : 0.85);
      });
      aurora.commit();
    },
  };
}

/* A clock string from seconds: "4 min 10 s". */
const minSec = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, "0")} s`;


/* White, as the Sun really is above the air (owner, round 82: "make the Sun
 * white, not yellow"). Drawing choice for the star shader's two tones. */
const WHITE_SUN = { colour: "#d9d0c4", hot: "#ffffff", haloColour: "#fff1dc" };

/* ------------------------------------------------- real-body staging (round 82) */

/*
 * Round 82 (Prompts.md: "use our real Sun and Earth -- the Sun storming out
 * and reaching our real Earth, and the aurora we drew spreading across the
 * globe"). Most of these events are now staged on the site's own Sun, and
 * cut across to its own Earth part-way through (ctx.refocus), behind a
 * moment of black while the camera flies.
 */

/* Where a camera sits side-on to the Sun-Earth line, Earth off to the left
 * of the Sun on screen: its azimuth (main.js refocus, shotYaw). For an
 * offset (sin y, 0, cos y) the screen's right is (cos y, 0, -sin y); that
 * is set to point away from Earth. */
function sideOnYaw(toEarth) {
  /* Earth on the left: the event card sits on the right. */
  return Math.atan2(toEarth.z, -toEarth.x);
}

/* The azimuth that looks at Earth mostly from its night side, `deg` round
 * from the sunward direction (180 = straight down the shadow). */
function nightYaw(earthW, deg = 130) {
  const sunward = earthW.clone().negate().setY(0).normalize();
  const o = sunward.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg));
  return yawFor(o);
}

/* A cut: black (the hud stage alone) between two progress values. */
function cutter(ctx) {
  let dark = null;
  return (on) => {
    if (on === dark) return;
    dark = on;
    ctx.setVeil(on ? { blackout: true, keep: [ctx.hudAnchor()] } : null);
  };
}

/* A place on the real Earth: a glowing dot and its name, turning with it. */
function earthPlace(ctx, earth, lat, lon, words, colour = "#ff8a8a") {
  const group = new THREE.Group();
  group.position.copy(bodyPoint(earth, lat, lon, 1.012));
  ctx.attach(earth, group);
  const dot = ctx.glow(colour, bodyRadius(earth) * 0.12, { opacity: 0.95, parent: group });
  const label = ctx.label(words, { parent: group, at: bodyPoint(earth, lat, lon, 1).normalize().multiplyScalar(bodyRadius(earth) * 0.18), height: 0.026, align: "left", declutter: false });
  ctx.fade(dot, 0);
  ctx.fade(label, 0);
  return { group, dot, label, lat, lon };
}

/*
 * A coronal mass ejection leaving the real Sun: a cloud of plasma launched
 * from `from` (world) along `dir`, its leading edge `dist` world units out,
 * spreading as it goes. Lives in the event's root (world axes, in units of
 * the host's radius).
 */
function sunCme(ctx, count, seed, colour = "#ffd9a8") {
  const cloud = ctx.cloud(count, { size: 3 });
  const r = rng(seed);
  const pts = Array.from({ length: count }, () => ({ a: r() * TAU, w: Math.sqrt(r()), d: r() }));
  pts.forEach((_, i) => cloud.tint(i, i % 4 ? colour : "#ffffff"));
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const host = new THREE.Vector3();
  return {
    cloud,
    set(from, dir, dist, alpha) {
      ctx.host.getWorldPosition(host);
      side.crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      up.crossVectors(dir, side).normalize();
      const spread = 0.12 + 0.35 * dist / (dist + 60);
      pts.forEach((q, i) => {
        const along = dist * (0.72 + 0.28 * q.d);
        const rad = along * spread * q.w;
        const x = from.x + dir.x * along + (side.x * Math.cos(q.a) + up.x * Math.sin(q.a)) * rad;
        const y = from.y + dir.y * along + (side.y * Math.cos(q.a) + up.y * Math.sin(q.a)) * rad;
        const z = from.z + dir.z * along + (side.z * Math.cos(q.a) + up.z * Math.sin(q.a)) * rad;
        cloud.set(i, (x - host.x) / ctx.unit, (y - host.y) / ctx.unit, (z - host.z) / ctx.unit);
        cloud.alpha[i] = alpha * (0.35 + 0.65 * q.d) * (1 - 0.6 * q.w);
      });
      cloud.commit();
    },
  };
}

/* Magnetic loops over a real sunspot group: arcs between footpoints either
 * side of `centre` (a unit direction in the Sun's frame), sheared by
 * `twist` and `height` (fractions of the radius). On the Sun itself. */
function activeLoops(ctx, centre, n = 6) {
  const R = ctx.hostRadius();
  const helper = Math.abs(centre.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const e1 = new THREE.Vector3().crossVectors(helper, centre).normalize();
  const e2 = new THREE.Vector3().crossVectors(centre, e1).normalize();
  const group = new THREE.Group();
  ctx.onHost(group);
  const lines = Array.from({ length: n }, () => ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffc27a", opacity: 0.85, parent: group, additive: false }));
  const at = (i, stress, relax) => {
    const half = 0.018 + 0.008 * i;
    const h = lerp((0.035 + 0.012 * i) * (1 + 0.6 * stress), 0.02 + 0.007 * i, relax);
    const twist = stress * (1 - relax) * 0.012 * (1 + 0.3 * i);
    const pts = [];
    for (let k = 0; k <= 40; k += 1) {
      const t = k / 40;
      const d = centre.clone().addScaledVector(e1, lerp(-half, half, t)).addScaledVector(e2, twist * Math.sin(TAU * t)).normalize();
      pts.push(d.multiplyScalar(R * (1.002 + h * Math.sin(Math.PI * t))));
    }
    return pts;
  };
  return {
    group, lines, e1, e2,
    set(stress, relax, hot) {
      lines.forEach((line, i) => {
        ctx.setLine(line, at(i, stress, relax));
        line.material.color.set(relax > 0.5 ? "#ffe2a8" : "#ffb36b").lerp(new THREE.Color("#ffffff"), hot);
      });
    },
  };
}

/* The real Sun turned so a direction in its frame sits on the visible limb,
 * up and to one side of the camera's view (sx, sy in screen terms). */
function limbToward(ctx, dirLocal, sx, sy, amount = 0.08) {
  const cam = ctx.camera;
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const upv = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  const want = right.multiplyScalar(sx).addScaledVector(upv, sy).addScaledVector(ctx.camDir, 0.25).normalize();
  const { lat, lon } = latLonOf(dirLocal);
  ctx.turnHostToward(lat, lon, want, amount);
}

/* --------------------------------------------------------------- the events */

export const SUN_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "sun-flare",
    section: "sun",
    body: "Sun",
    title: "Solar flare (X-class)",
    place: "The Sun",
    kind: "recurring",
    family: "solar",
    often: "dozens a year near solar maximum",
    detail: "Magnetic loops above a sunspot group snap and reconnect, and in minutes the Sun's X-ray output jumps a hundredfold — light that reaches Earth 8 minutes later",
    frequency: "Flares are graded A, B, C, M and X, each ten times stronger than the one before. NOAA counts about 175 X-class flares in an average 11-year cycle, bunched around solar maximum; near minimum, months can pass without one.",
    cause: "Sunspots are where strong magnetic fields break through the surface. As the gas beneath them churns, the field lines above are twisted and sheared, storing energy. When they suddenly snap and reconnect, that energy is released in minutes — up to about 10²⁵ joules in the biggest flares, as much as billions of one-megaton bombs — heating gas to tens of millions of degrees.",
    note: "The light arrives first. Fast protons can follow within tens of minutes, and a coronal mass ejection, if one is launched, takes one to three days. The largest flare measured, on 4 November 2003, overloaded the detectors: it is estimated at X28 at least, and perhaps about X45.",
    accuracy: "Played on the site's own Sun, at one of its own sunspot groups turned to the edge, then on its own Earth. The loops are drawn about twice as tall as real ones so they can be seen. The X-ray curve is a typical X-class shape, not one particular flare; the 8 min 19 s is the real light time.",
    art: { main: "sun", second: "earth", fx: "flare" },
    shotZoom: 2.2,
    shotPitch: 0.15,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      const R = ctx.hostRadius();
      /* The site's biggest sunspot group (photosphere shader, spot 0). */
      const spot = sunSpots(sun)[0] ?? new THREE.Vector3(0.82, 0.16, 0.55).normalize();
      const loops = activeLoops(ctx, spot, 6);
      const flash = ctx.glow("#ffffff", R * 0.16, { opacity: 1 });
      ctx.onHost(flash);
      flash.position.copy(spot).multiplyScalar(R * 1.03);
      const ribbons = ctx.glow("#fff3c0", R * 0.07, { opacity: 1 });
      ctx.onHost(ribbons);
      ribbons.position.copy(spot).multiplyScalar(R * 1.004);
      const pin = new THREE.Group();
      pin.position.copy(spot).multiplyScalar(R * 1.12);
      ctx.onHost(pin);
      const spotLabel = ctx.label(["A sunspot group", "on the Sun's edge"], { parent: pin, height: 0.028, declutter: false });

      /* The X-ray light curve, over the sky (no backing): GOES 1-8 Å band,
       * log flux -7 to -3 W/m². */
      const hud = ctx.hudLayer();
      const hw = ctx.halfWidth;
      const P = { x0: -hw * 1.2, x1: -hw * 1.2 + 0.8, y0: 0.22, y1: 0.62 };
      const fy = (lg) => P.y0 + ((lg + 7) / 4) * (P.y1 - P.y0);
      ctx.line([[P.x0, P.y0, 0], [P.x1, P.y0, 0]], { colour: "#e8f1ff", opacity: 0.85, parent: hud, additive: false });
      ctx.line([[P.x0, P.y0, 0], [P.x0, P.y1, 0]], { colour: "#e8f1ff", opacity: 0.85, parent: hud, additive: false });
      /* Class thresholds: C 1e-6, M 1e-5, X 1e-4 W/m² (NOAA). */
      [["C", -6], ["M", -5], ["X", -4]].forEach(([c, lg]) => {
        ctx.line([[P.x0, fy(lg), 0], [P.x1, fy(lg), 0]], { colour: "#cfe0f5", opacity: 0.5, dashed: true, dash: 0.015, gap: 0.015, parent: hud });
        ctx.label([c], { parent: hud, at: [P.x1 + 0.03, fy(lg), 0], height: 0.026, align: "left", colour: "#ffffff", declutter: false });
      });
      /* A typical profile: C1 background, a few minutes' rise to X2, a slower
       * decay (drawing choice). */
      const flux = (q) => {
        const base = -5.92 + 0.05 * Math.sin(q * 37) + 0.04 * Math.sin(q * 91);
        const rise = smooth(q, 0.34, 0.39);
        const decay = q < 0.39 ? 1 : 0.25 + 0.75 * Math.exp(-(q - 0.39) / 0.14);
        return base + 2.22 * rise * decay;
      };
      const curve = ctx.line([[P.x0, fy(-6), 0], [P.x0, fy(-6), 0]], { colour: "#ffe08a", opacity: 1, parent: hud, additive: false });
      const head = ctx.glow("#fff2c0", 0.06, { opacity: 1, parent: hud });
      const xrayLabel = ctx.label(["", ""], { parent: hud, at: [P.x0, P.y1 + 0.07, 0], height: 0.028, align: "left", declutter: false });
      const clock = ctx.label(["", ""], { parent: hud, at: [0.1, -0.7, 0], height: 0.034, declutter: false });
      ctx.fade(clock, 0);

      /* On Earth: the day side's upper atmosphere, charged by the X-rays. */
      const ionosphere = sideGlow(bodyRadius(earth) * 1.06, "#9a8cff", { power: 1.2, opacity: 0.85 });
      if (earth) ctx.attach(earth, ionosphere);
      const dayFlash = sideGlow(bodyRadius(earth) * 1.03, "#ffffff", { power: 2, opacity: 1 });
      if (earth) ctx.attach(earth, dayFlash);
      ctx.fade(ionosphere, 0);
      ctx.fade(dayFlash, 0);
      const earthWords = ctx.label(["", ""], { parent: hud, at: [0.1, 0.62, 0], height: 0.032, declutter: false });
      ctx.fade(earthWords, 0);

      ctx.tell([
        { at: 0, label: "Sunspots", text: "On the Sun's edge, one of its sunspot groups. Above it, magnetic loops hold up glowing gas." },
        { at: 0.1, label: "Twisting", text: "The spots shuffle and the loops are wound tighter and tighter, storing energy like a twisted rubber band." },
        { at: 0.36, label: "Snap", text: "The field snaps and reconnects. In minutes the Sun's X-ray output jumps a hundredfold: an X-class flare." },
        { at: 0.48, label: "8 minutes", text: "Its light reaches Earth 8 min 19 s later — before anything else the flare sends." },
        { at: 0.72, label: "Radio blackout", text: "The X-rays charge the upper atmosphere on Earth's day side, and shortwave radio there fades out for about an hour." },
      ]);
      const cut = cutter(ctx);
      const earthW = new THREE.Vector3();
      let onEarth = false;
      return {
        duration: 20,
        update(p) {
          /* On the Sun: the spot group held on the upper-left edge. */
          if (!onEarth) limbToward(ctx, spot, -0.75, 0.55, 0.1);
          const stress = smooth(p, 0.08, 0.36);
          const relax = smooth(p, 0.38, 0.46);
          const hot = smooth(p, 0.36, 0.38) * (1 - smooth(p, 0.4, 0.5));
          loops.set(stress, relax, hot);
          ctx.fade(loops.group, 1 - smooth(p, 0.44, 0.46));
          ctx.fade(spotLabel, smooth(p, 0.01, 0.05) * (1 - smooth(p, 0.3, 0.34)));
          const fl = smooth(p, 0.355, 0.37) * (1 - smooth(p, 0.38, 0.47));
          flash.scale.setScalar(R * (0.06 + 0.3 * fl));
          ctx.fade(flash, fl);
          const rib = smooth(p, 0.36, 0.38) * (1 - smooth(p, 0.44, 0.46));
          ribbons.scale.setScalar(R * (0.05 + 0.05 * rib));
          ctx.fade(ribbons, rib);

          /* The cut to Earth while the camera flies (light on its way). */
          cut(p > 0.45 && p < 0.53);
          if (p > 0.46 && !onEarth && earth) {
            onEarth = true;
            earth.getWorldPosition(earthW);
            /* Sunward, swung a little so the lit face is seen from the side. */
            flyTo(ctx, "Earth", { shotYaw: yawFor(earthW.clone().negate().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5)), shotZoom: 1.25, shotPitch: 0.25 });
          }
          if (earth) {
            earth.getWorldPosition(earthW);
            const sunDir = earthW.clone().negate().normalize();
            ionosphere.material.uniforms.uDir.value.copy(sunDir);
            dayFlash.material.uniforms.uDir.value.copy(sunDir);
          }
          /* Light to Earth: 499 s per AU (IAU). */
          const u = span(p, 0.48, 0.7);
          const secs = LIGHT_AU_S * u;
          clock.userData.draw(u >= 1 ? ["8 min 19 s", "the flare's light reaches Earth"] : ["The light is on its way", minSec(secs)]);
          ctx.fade(clock, smooth(p, 0.47, 0.5));
          const arrive = smooth(p, 0.69, 0.71) * (1 - smooth(p, 0.72, 0.8));
          ctx.fade(dayFlash, arrive);
          const bo = smooth(p, 0.72, 0.78);
          ctx.fade(ionosphere, bo * (0.75 + 0.25 * Math.sin(ctx.t * 6)));
          earthWords.userData.draw(["Radio blackout", "shortwave fades across the day side"]);
          ctx.fade(earthWords, bo);

          /* The X-ray curve, drawn up to now. */
          const pts = [];
          const n = Math.max(2, Math.ceil(p * 200));
          for (let k = 0; k <= n; k += 1) {
            const q = Math.min(p, k / 200);
            pts.push([lerp(P.x0, P.x1, q), fy(flux(q)), 0.01]);
          }
          ctx.setLine(curve, pts);
          const lg = flux(p);
          head.position.set(lerp(P.x0, P.x1, p), fy(lg), 0.02);
          const letters = ["A", "B", "C", "M", "X"];
          const dec = Math.floor(lg);
          const cls = `${letters[Math.min(4, Math.max(0, dec + 8))]}${(10 ** (lg - dec)).toFixed(1)}`;
          xrayLabel.userData.draw(["X-rays from the whole Sun", `class ${cls}`]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "sun-carrington",
    section: "sun",
    body: "Sun",
    title: "The Carrington Event",
    place: "The Sun and Earth",
    kind: "recorded",
    family: "solar",
    when: "1–2 September 1859",
    often: "once, 1859",
    timeline: { last: "1–2 September 1859", next: "Unpredictable" },
    detail: "The biggest solar storm on record: a white-light flare seen by Richard Carrington, then aurora near the tropics less than a day later",
    frequency: "Nothing as strong has been measured since; the great storm of May 1921 may have come close. How often one this size happens is uncertain: published estimates of the chance of another within any ten years range from under 1% to about 12%.",
    cause: "A large, complex sunspot group launched a fast coronal mass ejection straight at Earth. An earlier eruption a few days before had probably swept the way clear, so this one crossed the 150 million km in about 17.6 hours instead of the usual two to four days. Its magnetic field slammed into Earth's and drove a huge geomagnetic storm.",
    note: "Carrington's flare, also seen independently by Richard Hodgson, was the first solar flare ever recorded. Gold miners in the Rocky Mountains reportedly got up and made breakfast, thinking it was dawn. A storm like it today could damage satellites and power grids.",
    accuracy: "Played on the site's own Sun, from one of its sunspot groups, and on its own Earth with its own aurora driven as the storm. The flare's time and the 17.6-hour crossing are from the records; how far the aurora reached is drawn from where it was reported (Cuba, about 23° N), not measured.",
    art: { main: "sun", second: "earth", fx: "aurora" },
    shotZoom: 2.4,
    shotPitch: 0.12,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      const R = ctx.hostRadius();
      const spot = sunSpots(sun)[1] ?? new THREE.Vector3(0.76, 0.12, 0.64).normalize();
      const sunW = sun.getWorldPosition(new THREE.Vector3());
      const earthW = earth ? earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(300, 0, 0);
      const toEarth = earthW.clone().sub(sunW).normalize();
      /* Side-on to the Sun-Earth line, Earth off to the right. */
      ctx.refocus("Sun", { shotYaw: sideOnYaw(toEarth), shotZoom: 2.4, shotPitch: 0.12 });
      /* Carrington's "two patches of intensely bright and white light". */
      const beads = [0, 1].map((k) => {
        const g = ctx.glow("#ffffff", R * 0.05, { opacity: 1 });
        ctx.onHost(g);
        const d = spot.clone().add(new THREE.Vector3(0.01 * (k ? 1 : -1), 0.008, 0)).normalize();
        g.position.copy(d).multiplyScalar(R * 1.01);
        return g;
      });
      const pin = new THREE.Group();
      pin.position.copy(spot).multiplyScalar(R * 1.14);
      ctx.onHost(pin);
      const flareLabel = ctx.label(["11:18 a.m.: two beads", "of brilliant white light"], { parent: pin, height: 0.028, declutter: false });
      const cme = sunCme(ctx, 1400, 12);
      const spotW = new THREE.Vector3();
      const aurora = earthAurora(earth);
      const places = earth ? [
        earthPlace(ctx, earth, 23.1, -82.4, ["Cuba", "aurora overhead"]),
        earthPlace(ctx, earth, 42.4, -71.1, ["Boston", "telegraph sparks"], "#bfe6ff"),
      ] : [];
      const sparks = earth ? Array.from({ length: 5 }, (_, i) => {
        const g = ctx.glow("#d8ecff", bodyRadius(earth) * 0.08, { opacity: 1 });
        g.position.copy(bodyPoint(earth, 41 + i * 0.9, -74 + i * 1.4, 1.015));
        ctx.attach(earth, g);
        ctx.fade(g, 0);
        return g;
      }) : [];
      const hud = ctx.hudLayer();
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.62, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label(["17.6 hours later"], { parent: hud, at: [0, 0, 0], height: 0.05, declutter: false });
      ctx.fade(cutWords, 0);

      ctx.tell([
        { at: 0, label: "1 September 1859", text: "Richard Carrington, sketching sunspots south of London, watches a large group of them." },
        { at: 0.14, label: "11:18 a.m.", text: "Two beads of brilliant white light flare up in the group, and fade within five minutes. A huge cloud of magnetised gas is already leaving." },
        { at: 0.38, label: "17.6 hours", text: "It crossed to Earth in about 17.6 hours — one of the fastest crossings on record." },
        { at: 0.46, label: "The storm", text: "Earth's aurora spreads from the poles toward the tropics — seen from Cuba, and in the north-eastern US bright enough to read a newspaper by." },
        { at: 0.72, label: "Sparks", text: "Telegraph lines picked up currents from the storm: operators got shocks, and between Boston and Portland, Maine, messages were sent with the batteries unplugged." },
      ]);
      const cut = cutter(ctx);
      let onEarth = false;
      return {
        duration: 20,
        update(p) {
          /* The spot group turned toward Earth, at the edge we see. */
          if (!onEarth) {
            const { lat, lon } = latLonOf(spot);
            ctx.turnHostToward(lat, lon, toEarth.clone().addScaledVector(ctx.camDir, 0.6).normalize(), 0.1);
          }
          const beadA = smooth(p, 0.13, 0.16) * (1 - smooth(p, 0.24, 0.3));
          beads.forEach((g, i) => { ctx.fade(g, beadA * (0.8 + 0.2 * Math.sin(ctx.t * 7 + i))); g.scale.setScalar(R * (0.03 + 0.05 * beadA)); });
          ctx.fade(flareLabel, smooth(p, 0.13, 0.17) * (1 - smooth(p, 0.3, 0.34)));
          /* The ejection leaving the Sun toward Earth (a few Sun widths out
           * before the cut). */
          sun.updateMatrixWorld(true);
          spotW.copy(spot).multiplyScalar(R * 1.02);
          sun.localToWorld(spotW);
          const s = easeInOut(span(p, 0.18, 0.38));
          cme.set(spotW, toEarth, 6 + s * R * 1.4, smooth(p, 0.18, 0.21) * (1 - smooth(p, 0.36, 0.38)));

          /* Cut: 17.6 hours later, on Earth. */
          cut(p > 0.37 && p < 0.45);
          ctx.fade(cutWords, smooth(p, 0.375, 0.39) * (1 - smooth(p, 0.43, 0.45)));
          if (p > 0.38 && !onEarth && earth) {
            onEarth = true;
            flyTo(ctx, "Earth", { shotYaw: nightYaw(earthW, 125), shotZoom: 1.8, shotPitch: 0.35 });
          }
          if (onEarth && earth) {
            /* The Americas toward us, on the night side. */
            const camOff = ctx.camera.position.clone().sub(earth.getWorldPosition(earthW)).normalize();
            turnBodyToward(earth, 32, -78, camOff, 0.08);
          }
          /* The storm: the oval's middle from ~67° toward ~25° latitude,
           * widening and brightening, with more of the high red glow
           * (drawing choice, to match the reported low-latitude sightings). */
          const storm = smooth(p, 0.46, 0.72);
          aurora.set({ lat: lerp(67, 27, storm), width: lerp(1, 2.6, storm), gain: lerp(1, 2.4, storm), red: 0.35 * storm });
          places.forEach((pl, i) => {
            const on = i === 0 ? smooth(p, 0.56, 0.62) : smooth(p, 0.72, 0.78);
            ctx.fade(pl.label, on);
            ctx.fade(pl.dot, on * (0.7 + 0.3 * Math.sin(ctx.t * 4 + i)));
          });
          sparks.forEach((g, i) => ctx.fade(g, smooth(p, 0.74, 0.78) * Math.max(0, Math.sin(ctx.t * 11 + i * 2.1)) ** 3));
          if (p < 0.37) clock.userData.draw(["1 September 1859", p < 0.13 ? "Redhill, England" : "11:18 a.m."]);
          else clock.userData.draw(["2 September 1859", storm > 0.5 ? "aurora near the tropics" : "the storm hits"]);
          ctx.fade(clock, p > 0.37 && p < 0.45 ? 0 : 1);
        },
        dispose() { aurora.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "sun-gannon-storm",
    section: "sun",
    body: "Sun",
    title: "The May 2024 superstorm",
    place: "The Sun and Earth",
    kind: "recorded",
    family: "solar",
    when: "10–11 May 2024",
    often: "once, May 2024",
    timeline: { last: "10–11 May 2024", next: "Unpredictable" },
    detail: "Eruption after eruption from sunspot region AR 3664 hit Earth on 10–11 May 2024: the first G5 'extreme' storm since 2003, with aurora seen from India to Mexico",
    frequency: "NOAA's scale expects about four days of G5 storms in an average 11-year cycle, mostly around solar maximum. Before May 2024 the last was in October 2003.",
    cause: "AR 3664 was a huge, magnetically tangled sunspot group, big enough to see through eclipse glasses. From 8 May it fired a run of X-class flares and at least five coronal mass ejections aimed at Earth. Arriving together on 10 May, their magnetic fields pressed on Earth's for many hours, pumping in energy and driving the aurora far from the poles.",
    note: "Researchers have named it the Gannon storm, after the space-weather physicist Jennifer Gannon, who died shortly before it. Phone cameras helped millions see it: their long exposures pick up red aurora too faint for the eye.",
    accuracy: "Played on the site's own Sun, from one of its sunspot groups (standing in for AR 3664), and on its own Earth with its own aurora driven as the storm. The five ejections' spacing is a drawing choice; the storm levels and times are NOAA's. The marked places are real sites where the aurora was photographed, mostly as a red glow low on the northern horizon.",
    art: { main: "earth", second: "sun", fx: "aurora" },
    shotZoom: 2.4,
    shotPitch: -0.1,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      const R = ctx.hostRadius();
      /* AR 3664 sat about 18° south: the site's southern spot group 5. */
      const spot = sunSpots(sun)[5] ?? new THREE.Vector3(0.22, -0.58, 0.78).normalize();
      const sunW = sun.getWorldPosition(new THREE.Vector3());
      const earthW = earth ? earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(300, 0, 0);
      const toEarth = earthW.clone().sub(sunW).normalize();
      ctx.refocus("Sun", { shotYaw: sideOnYaw(toEarth), shotZoom: 2.4, shotPitch: -0.1 });
      const ring = ctx.glow("#ffffff", R * 0.06, { opacity: 1 });
      ctx.onHost(ring);
      ring.position.copy(spot).multiplyScalar(R * 1.01);
      const pin = new THREE.Group();
      pin.position.copy(spot).multiplyScalar(R * 1.13);
      ctx.onHost(pin);
      const arLabel = ctx.label(["AR 3664"], { parent: pin, height: 0.03, declutter: false });
      /* At least five Earth-directed CMEs (NOAA SWPC). */
      const cmes = Array.from({ length: 5 }, (_, k) => ({ cloud: sunCme(ctx, 360, 40 + k), launch: 0.04 + 0.055 * k }));
      const spotW = new THREE.Vector3();
      const aurora = earthAurora(earth);
      /* Places the aurora was photographed (approximate coordinates). */
      const places = earth ? [
        { ...earthPlace(ctx, earth, 32.8, 79.0, ["Ladakh, India", "red glow in the north"]), at: 0.52 },
        { ...earthPlace(ctx, earth, 28.3, -16.6, ["Canary Islands"]), at: 0.66 },
        { ...earthPlace(ctx, earth, 23.6, -102.5, ["Mexico"]), at: 0.8 },
      ] : [];
      const hud = ctx.hudLayer();
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.62, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label(["10 May 2024", "they arrive"], { parent: hud, at: [0, 0, 0], height: 0.045, declutter: false });
      ctx.fade(cutWords, 0);

      ctx.tell([
        { at: 0, label: "AR 3664", text: "May 2024: one of the biggest sunspot groups in decades faces Earth. From 8 May it fires flare after flare." },
        { at: 0.06, label: "One after another", text: "At least five coronal mass ejections leave toward Earth, one behind the other." },
        { at: 0.36, label: "G5", text: "On 10 May they arrive together. By 22:54 UT the storm reaches G5, 'extreme' — the first since October 2003." },
        { at: 0.5, label: "Far from the poles", text: "Earth's aurora swells toward the equator. Cameras catch the red glow low in the north from Ladakh in India, the Canary Islands and Mexico." },
      ]);
      const cut = cutter(ctx);
      let onEarth = false;
      let watching = -1;
      return {
        duration: 21,
        update(p) {
          if (!onEarth) {
            const { lat, lon } = latLonOf(spot);
            ctx.turnHostToward(lat, lon, toEarth.clone().addScaledVector(ctx.camDir, 0.6).normalize(), 0.1);
          }
          sun.updateMatrixWorld(true);
          spotW.copy(spot).multiplyScalar(R * 1.02);
          sun.localToWorld(spotW);
          let flashA = 0;
          cmes.forEach((c) => {
            const s = span(p, c.launch, c.launch + 0.12);
            c.cloud.set(spotW, toEarth, 6 + easeInOut(s) * R * 1.3, smooth(p, c.launch, c.launch + 0.02) * (1 - smooth(p, c.launch + 0.1, c.launch + 0.13)) * (p < 0.34 ? 1 : 0));
            flashA = Math.max(flashA, smooth(p, c.launch - 0.012, c.launch) * (1 - smooth(p, c.launch, c.launch + 0.03)));
          });
          ctx.fade(ring, 0.35 + 0.65 * flashA);
          ring.scale.setScalar(R * (0.04 + 0.1 * flashA));
          ctx.fade(arLabel, smooth(p, 0.01, 0.05) * (1 - smooth(p, 0.3, 0.34)));

          cut(p > 0.33 && p < 0.41);
          ctx.fade(cutWords, smooth(p, 0.335, 0.35) * (1 - smooth(p, 0.39, 0.41)));
          if (p > 0.34 && !onEarth && earth) {
            onEarth = true;
            flyTo(ctx, "Earth", { shotYaw: nightYaw(earthW, 125), shotZoom: 1.8, shotPitch: 0.4 });
          }
          /* Each place turned toward us in turn, on the night side. */
          const now = places.reduce((k, pl, i) => (p >= pl.at - 0.06 ? i : k), 0);
          if (onEarth && earth && places.length) {
            if (now !== watching) watching = now;
            const camOff = ctx.camera.position.clone().sub(earth.getWorldPosition(earthW)).normalize();
            turnBodyToward(earth, places[watching].lat, places[watching].lon, camOff, 0.06);
          }
          /* Universal time, 16:30 on 10 May to 06:00 on 11 May. G4 reached
           * 17:37 UT, G5 22:54 UT on 10 May (NOAA SWPC). The oval's reach is
           * illustrative. */
          const ut = lerp(16.5, 30, span(p, 0.36, 0.96));
          const storm = smooth(p, 0.4, 0.62);
          aurora.set({ lat: lerp(67, 33, storm), width: lerp(1, 2.4, storm), gain: lerp(1, 2.2, storm), red: 0.6 * storm });
          places.forEach((pl, i) => {
            const on = smooth(p, pl.at, pl.at + 0.04) * (i === now ? 1 : 0.35);
            ctx.fade(pl.label, on);
            ctx.fade(pl.dot, on * (0.7 + 0.3 * Math.sin(ctx.t * 4 + i)));
          });
          if (p < 0.34) {
            const n = cmes.filter((c) => p >= c.launch).length;
            clock.userData.draw(["8–9 May 2024", n ? `${n} ejection${n > 1 ? "s" : ""} launched` : "AR 3664 erupts"]);
          } else {
            const day = ut >= 24 ? 11 : 10;
            const h = Math.floor(ut % 24);
            const m = Math.floor(((ut % 24) - h) * 60);
            const level = ut >= 22.9 ? "G5 · extreme" : ut >= 17.62 ? "G4 · severe" : "storm begins";
            clock.userData.draw([`${day} May, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UT`, level]);
          }
          ctx.fade(clock, p > 0.33 && p < 0.41 ? 0 : 1);
        },
        dispose() { aurora.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "sun-cycle",
    section: "sun",
    title: "The 11-year sunspot cycle",
    place: "The Sun",
    kind: "recurring",
    family: "solar",
    often: "about every 11 years",
    timeline: { last: "Maximum around late 2024 (Cycle 25)", next: "Minimum expected around 2030" },
    detail: "The Sun's spots come and go in a cycle about 11 years long, and around each maximum its magnetic poles swap places",
    frequency: "About every 11 years, though single cycles have run from about 9 to 14. Cycle 25 began in December 2019 and peaked around the end of 2024; the next minimum is expected around 2030.",
    cause: "The Sun's uneven spin winds up its magnetic field until loops of it float up through the surface as sunspots. As the spots decay, their leftover field drifts toward the poles, cancels the old polar field and builds a new one of the opposite sign. So the poles flip around every maximum, and a full magnetic cycle, back to the start, takes about 22 years.",
    note: "Sunspots have been watched through telescopes since about 1610. From about 1645 to 1715 — the Maunder Minimum — they almost vanished.",
    accuracy: "The curve is a smooth fit through the measured minima and maxima of cycles 24 and 25 (SILSO, Royal Observatory of Belgium), without the month-to-month bumps; after 2026 it is a forecast. The spots on the Sun follow the curve in number and appear at the latitudes real spots do. The flip dates are approximate.",
    art: { main: "sun", fx: "spot" },
    scene(ctx) {
      const hw = ctx.halfWidth;
      /* Smoothed sunspot number, one shape per cycle: rises to the peak and
       * falls more slowly (drawing choice, fitted to SILSO's numbers):
       * cycle 23 peak 180 in Nov 2001; cycle 24 min Dec 2008, peak 116.4 in
       * Apr 2014; cycle 25 min Dec 2019, peak ~160 around Oct 2024
       * (provisional). */
      const CYCLES = [
        { start: 1996.4, peak: 2001.9, amp: 180 },
        { start: 2008.96, peak: 2014.29, amp: 116.4 },
        { start: 2019.96, peak: 2024.79, amp: 160 },
      ];
      const shape = (c, t) => {
        const x = t - c.start;
        if (x <= 0) return 0;
        const u = x / (c.peak - c.start);
        return c.amp * u ** 4 * Math.exp(2 * (1 - u * u));
      };
      const ssn = (t) => CYCLES.reduce((s, c) => s + shape(c, t), 0);

      /* The Sun, its spots and its magnetic axis. */
      const sunR = 0.3;
      const holder = new THREE.Group();
      holder.position.set(0, 0.4, 0);
      holder.rotation.x = 0.12;
      ctx.add(holder);
      ctx.sun(sunR, { ...WHITE_SUN, halo: 2.2, haloOpacity: 0.4, parent: holder });
      /* A pool of spots, born month by month in proportion to the curve, at
       * each cycle's latitude: ~30° at the start, ~8° at the end (Spörer). */
      const pool = [];
      const r = rng(17);
      for (let t = 2008.5; t < 2031; t += 1 / 12) {
        CYCLES.forEach((c) => {
          const n = shape(c, t) / 20 + r();
          for (let k = 0; k < Math.floor(n); k += 1) {
            const phase = Math.min(1, (t - c.start) / 11);
            const lat = (r() < 0.5 ? 1 : -1) * Math.max(3, 30 - 22 * phase + (r() - 0.5) * 9);
            pool.push({ t, life: 0.12 + r() * 0.2, lat, lon: (r() - 0.5) * 130, size: 3 + r() * 4 });
          }
        });
      }
      const spots = ctx.cloud(pool.length, { parent: holder, additive: false, size: 4 });
      pool.forEach((s, i) => {
        const v = ctx.onSphere(sunR * 1.01, s.lat, s.lon);
        spots.set(i, v.x, v.y, v.z);
        spots.tint(i, "#2a0d02");
        spots.size[i] = s.size;
        spots.alpha[i] = 0;
      });
      spots.commit();
      const magnet = new THREE.Group();
      holder.add(magnet);
      ctx.arrow([0, -0.42, 0], [0, 0.44, 0], { colour: "#7fd8ff", opacity: 0.85, head: 0.06, parent: magnet });
      const north = ctx.label(["magnetic N"], { at: [0, 0.5, 0], height: 0.024, parent: magnet, colour: "#bfe9ff" });

      /* The graph. */
      const G = { x0: -Math.min(0.98, hw * 0.88), x1: Math.min(0.98, hw * 0.88), y0: -0.8, y1: -0.2, t0: 2008.5, t1: 2031, max: 180 };
      const gx = (t) => lerp(G.x0, G.x1, (t - G.t0) / (G.t1 - G.t0));
      const gy = (s) => lerp(G.y0, G.y1, s / G.max);
      ctx.line([[G.x0, G.y0, 0], [G.x1, G.y0, 0]], { colour: "#9fb3c8", opacity: 0.55 });
      ctx.line([[G.x0, G.y0, 0], [G.x0, G.y1, 0]], { colour: "#9fb3c8", opacity: 0.55 });
      [2010, 2020, 2030].forEach((y) => {
        ctx.line([[gx(y), G.y0, 0], [gx(y), G.y0 - 0.02, 0]], { colour: "#9fb3c8", opacity: 0.6 });
        ctx.label([String(y)], { at: [gx(y), G.y0 - 0.05, 0], height: 0.022, colour: "#9fb3c8" });
      });
      /* Polar field reversals: cycle 24 ~2012-2014, cycle 25 ~2023-2024
       * (WSO polar fields; approximate). */
      const FLIPS = [2013.6, 2024.3];
      const flipLines = FLIPS.map((y) => ctx.line([[gx(y), G.y0, 0], [gx(y), G.y1, 0]], { colour: "#7fd8ff", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.02 }));
      const NOW = 2026.75;
      const solid = ctx.line([[G.x0, G.y0, 0], [G.x0, G.y0, 0]], { colour: "#ffffff", opacity: 0.95, additive: false });
      const dashed = ctx.line([[G.x0, G.y0, 0], [G.x0, G.y0, 0]], { colour: "#ffffff", opacity: 0.75, dashed: true, dash: 0.02, gap: 0.015 });
      const marker = ctx.glow("#ffffff", 0.07, { opacity: 1 });
      const readout = ctx.label(["", ""], { at: [G.x0 + 0.04, G.y1 + 0.03, 0], height: 0.028, align: "left" });

      ctx.tell([
        { at: 0, label: "Solar minimum", text: "December 2008: the Sun is calm and almost spotless." },
        { at: 0.12, label: "Rising", text: "Spots appear and multiply — first near 30° latitude, then closer and closer to the equator." },
        { at: 0.23, label: "The flip", text: "Around the maximum, the Sun's magnetic poles swap places: north becomes south." },
        { at: 0.48, label: "Cycle 25", text: "A new cycle began in December 2019, with new spots high on the Sun." },
        { at: 0.68, label: "Maximum", text: "It peaked around the end of 2024, stronger than the last — and the poles flipped again. Two flips make the full 22-year magnetic cycle." },
      ]);

      return {
        duration: 21,
        update(p) {
          const t = lerp(2008.6, 2030.9, span(p, 0.04, 0.92));
          pool.forEach((s, i) => {
            spots.alpha[i] = 0.9 * win(t, s.t, s.t + s.life, 0.03);
          });
          spots.commit();
          const flip = FLIPS.reduce((a, y) => a + smooth(t, y - 0.5, y + 0.5), 0);
          magnet.rotation.z = Math.PI * flip;
          ctx.fade(north, 1);
          const pts = [];
          const dash = [];
          for (let y = G.t0; y <= t + 1e-6; y += 1 / 12) {
            const v = [gx(y), gy(ssn(y)), 0.01];
            if (y <= NOW) pts.push(v);
            if (y >= NOW - 1 / 12) dash.push(v);
          }
          const tip = [gx(t), gy(ssn(t)), 0.01];
          if (t <= NOW) pts.push(tip); else dash.push(tip);
          ctx.setLine(solid, pts.length > 1 ? pts : [tip, tip]);
          ctx.setLine(dashed, dash.length > 1 ? dash : [tip, tip]);
          ctx.fade(dashed, t > NOW ? 1 : 0);
          marker.position.set(tip[0], tip[1], 0.02);
          flipLines.forEach((l, i) => ctx.fade(l, smooth(t, FLIPS[i] - 0.3, FLIPS[i])));
          const flipping = FLIPS.some((y) => Math.abs(t - y) < 0.6);
          const year = Math.floor(t);
          readout.userData.draw([
            `${year}${t > NOW ? " (forecast)" : ""}`,
            flipping ? "the magnetic poles flip" : `about ${fmt(ssn(t))} sunspots (smoothed number)`,
          ]);
        },
      };
    },
  }),


  /* ------------------------------------------------------------------ 5 */
  event({
    id: "sun-prominence",
    section: "sun",
    body: "Sun",
    title: "Prominence eruption",
    place: "The Sun",
    kind: "recurring",
    family: "solar",
    often: "many times a month near maximum",
    detail: "A loop of glowing gas many Earths tall, held above the Sun by its magnetic field — until it breaks loose into space",
    frequency: "Prominences are on the Sun almost all the time. Eruptions are commonest near solar maximum, when the Sun launches several coronal mass ejections a day, many of them carrying an erupting prominence.",
    cause: "A prominence is gas at about 10,000 °C, about a hundred times cooler and denser than the million-degree corona around it. It rests in dips of twisted magnetic field, like a hammock. If the twisted field becomes unstable, the whole structure lifts off and becomes part of a coronal mass ejection.",
    note: "Seen against the bright disc instead of at the edge, a prominence looks dark and is called a filament. In a total eclipse, prominences show as pink flames round the Moon's edge — the red light of hydrogen.",
    accuracy: "On the site's own Sun, at its edge: the loop stands about 80,000 km high, to the Sun's own scale, and the small globe beside it is the size Earth would be at that scale. The eruption is speeded up — real ones lift off over hours.",
    art: { main: "sun", fx: "loop" },
    shotZoom: 2.3,
    shotPitch: 0.1,
    scene(ctx) {
      /* In the stage's own units (the Sun's radius = 1), world-aligned: the
       * loop is kept on the Sun's upper-left edge as the camera sees it. */
      const R = ctx.hostRadius() / ctx.unit;
      const group = new THREE.Group();
      ctx.add(group);
      /* Heights: ~80,000 km = 0.115 of the Sun's radius (695,700 km). */
      const H0 = 80000 / SUN_KM;
      const N = 2600;
      const rope = ctx.cloud(N, { size: 3.2, parent: group });
      const r = rng(41);
      const pts = Array.from({ length: N }, () => ({ s: r(), phi: r() * TAU, rr: Math.sqrt(r()), drain: r(), hot: r() }));
      pts.forEach((q, i) => rope.tint(i, q.hot > 0.75 ? "#ffd2b8" : "#ff6a4a"));
      const foot = 0.07;
      const centre = new THREE.Vector3();
      const e1 = new THREE.Vector3();
      const view = new THREE.Vector3();
      const ropeAt = (s, e, kink) => {
        const along = (s - 0.5) * 2 * foot * (1 + 1.3 * e * Math.sin(Math.PI * s)) + kink * 0.01 * Math.sin(TAU * s);
        const h = (H0 * (1 + 0.15 * kink) + 1.6 * e * e) * Math.sin(Math.PI * s) ** 0.8;
        return centre.clone().addScaledVector(e1, along).normalize().multiplyScalar(R * (1.003 + h)).addScaledVector(view, R * 0.01 * kink * Math.sin(Math.PI * s));
      };
      /* Overlying field lines, which stretch open as it erupts. */
      const arches = Array.from({ length: 4 }, () => ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#8fc8ff", opacity: 0.4, parent: group }));
      const archPoints = (i, e) => {
        const half = 0.12 + 0.03 * i;
        const h = (0.16 + 0.04 * i) * (1 + 2.4 * e * e);
        const out = [];
        for (let k = 0; k <= 48; k += 1) {
          const t = k / 48;
          const d = centre.clone().addScaledVector(e1, (t - 0.5) * 2 * half).normalize();
          out.push(d.multiplyScalar(R * (1.002 + h * Math.sin(Math.PI * t) ** (1 + e))));
        }
        return out;
      };
      /* Earth, to the Sun's scale (6,371 / 695,700 of its radius), beside it. */
      const earthBall = ctx.ball(R * (EARTH_KM / SUN_KM), { body: "Earth", rim: 0.6, rimColour: "#7fb8ff", parent: group });
      const earthTag = ctx.label(["Earth, to scale"], { parent: group, height: 0.024, declutter: false });
      const hud = ctx.hudLayer();
      const height = ctx.label(["", ""], { parent: hud, at: [-0.4, 0.6, 0], height: 0.032, declutter: false });

      ctx.tell([
        { at: 0, label: "A loop of gas", text: "On the Sun's edge, glowing hydrogen arches far above the surface. The small globe beside it is Earth, to the same scale." },
        { at: 0.2, label: "Held by magnetism", text: "The gas is threaded on twisted magnetic field that holds it up against the Sun's gravity. Quiet ones hang like this for weeks." },
        { at: 0.46, label: "Unstable", text: "This one's field is twisted too far. It kinks, and the loop begins to rise." },
        { at: 0.6, label: "Eruption", text: "It tears free and flies out into space: billions of tonnes of plasma, the heart of a coronal mass ejection." },
      ]);
      const right = new THREE.Vector3();
      const upv = new THREE.Vector3();
      return {
        duration: 20,
        update(p) {
          /* The frame from where the camera is now. */
          view.copy(ctx.camDir);
          right.set(1, 0, 0).applyQuaternion(ctx.camera.quaternion);
          upv.set(0, 1, 0).applyQuaternion(ctx.camera.quaternion);
          centre.copy(right).multiplyScalar(-0.72).addScaledVector(upv, 0.69);
          centre.addScaledVector(view, -centre.dot(view)).normalize();
          e1.crossVectors(view, centre).normalize();
          const kink = smooth(p, 0.44, 0.56) * (1 - smooth(p, 0.7, 0.85));
          const e = smooth(p, 0.5, 0.95);
          const grow = smooth(p, 0.0, 0.08);
          arches.forEach((line, i) => {
            ctx.setLine(line, archPoints(i, e));
            ctx.fade(line, smooth(p, 0.12, 0.2) * (1 - smooth(p, 0.75, 0.92)) * 0.8);
          });
          for (let i = 0; i < N; i += 1) {
            const q = pts[i];
            const s = (q.s + (q.drain > 0.85 ? 0.02 * ctx.t * Math.sign(q.s - 0.5) : 0) + 2) % 1;
            const c = ropeAt(s, e, kink);
            const tw = q.phi + s * 9 + ctx.t * 0.4;
            const thick = R * (0.006 + 0.03 * e) * q.rr;
            const nrm = c.clone().normalize();
            rope.set(i, c.x + view.x * Math.cos(tw) * thick + nrm.x * Math.sin(tw) * thick, c.y + view.y * Math.cos(tw) * thick + nrm.y * Math.sin(tw) * thick, c.z + view.z * Math.cos(tw) * thick + nrm.z * Math.sin(tw) * thick);
            const top = Math.sin(Math.PI * s);
            rope.alpha[i] = grow * (0.4 + 0.5 * top) * (1 - smooth(e, 0.55, 1) * (0.4 + 0.6 * top));
          }
          rope.commit();
          earthBall.position.copy(centre).addScaledVector(e1, -0.24).normalize().multiplyScalar(R * 1.07);
          earthTag.position.copy(earthBall.position).multiplyScalar(1.035);
          earthBall.rotation.y = ctx.t * 0.3;
          ctx.fade(earthTag, smooth(p, 0.03, 0.08) * (1 - smooth(p, 0.5, 0.56)));
          const Hkm = (H0 * (1 + 0.15 * kink) + 1.6 * e * e) * SUN_KM;
          height.userData.draw([`Height: about ${fmt(Math.round(Hkm / 1000) * 1000)} km`, `${Math.round(Hkm / (2 * EARTH_KM))} Earths stacked`]);
          ctx.fade(height, smooth(p, 0.04, 0.1));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "sun-coronal-hole",
    section: "sun",
    body: "Sun",
    title: "Coronal hole",
    place: "The Sun",
    kind: "recurring",
    family: "solar",
    often: "most of the time",
    detail: "A dark patch in the Sun's outer atmosphere, where the magnetic field opens into space and the fastest solar wind pours out",
    frequency: "Coronal holes are there most of the time. Big ones cover the poles near solar minimum; others appear anywhere, and a long-lived hole can face Earth again every 27 days as the Sun turns.",
    cause: "Over most of the Sun, magnetic field lines loop back down and trap the hot corona. In a coronal hole they open straight out into space, so the gas streams away, leaving the region thinner and darker in ultraviolet and X-rays. The wind from a hole blows at 500 to 800 km/s, about twice the speed of the ordinary slow wind.",
    note: "A coronal hole is not a sunspot. Sunspots — the dark specks on the site's Sun — are dark in ordinary light, where strong field holds heat in; a coronal hole is in the corona above and only shows dark in ultraviolet. When a fast stream from one catches up with slower wind ahead, Earth gets a few days of auroras and minor storms, often repeating month after month as the hole comes round.",
    accuracy: "On the site's own Sun and Earth. The hole is painted on the Sun as it would look in ultraviolet (the site's Sun is drawn in ordinary light, where coronal holes cannot be seen). Wind speeds and the 2–3-day crossing are real averages; the aurora is a minor storm.",
    art: { main: "sun", second: "earth", fx: "stream" },
    shotZoom: 2.3,
    shotPitch: 0.1,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      const R = ctx.hostRadius();
      const sunW = sun.getWorldPosition(new THREE.Vector3());
      const earthW = earth ? earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(300, 0, 0);
      const toEarth = earthW.clone().sub(sunW).normalize();
      ctx.refocus("Sun", { shotYaw: sideOnYaw(toEarth), shotZoom: 2.3, shotPitch: 0.1 });
      /* The hole, near the Sun's equator (drawing choice). */
      const HOLE = { lat: 4, lon: 40, size: 16 };
      const holeDir = ctx.surfacePoint(HOLE.lat, HOLE.lon, 1).normalize();
      const { lat: hLat, lon: hLon } = latLonOf(holeDir);
      const holder = new THREE.Group();
      ctx.onHost(holder);
      /* spherePatch draws in a kit sphere frame (onSphere); build it in the
       * Sun's own frame by aiming its centre at the hole. */
      const frame = new THREE.Group();
      holder.add(frame);
      frame.quaternion.setFromUnitVectors(ctx.onSphere(1, 0, 0).normalize(), holeDir);
      const dark = spherePatch(ctx, frame, R, 0, 0, HOLE.size, { colour: "#120602", opacity: 0.88, seed: 5, wobble: 0.3, lift: 1.003 });
      const darker = spherePatch(ctx, frame, R, 0, 0, HOLE.size * 0.6, { colour: "#040100", opacity: 0.6, seed: 6, wobble: 0.3, lift: 1.005 });
      /* Open field lines from the hole, fanning out. */
      const er = rng(13);
      const open = [];
      for (let i = 0; i < 11; i += 1) {
        const d = ctx.onSphere(1, (er() - 0.5) * 22, (er() - 0.5) * 22).normalize();
        const centre = ctx.onSphere(1, 0, 0).normalize();
        const pts = [];
        for (let k = 0; k <= 30; k += 1) {
          const rr = 1 + (k / 30) * 0.9;
          pts.push(d.clone().add(d.clone().sub(centre).multiplyScalar(0.9 * (rr - 1))).normalize().multiplyScalar(R * rr));
        }
        open.push(ctx.line(pts, { colour: "#9fd8ff", opacity: 0.6, parent: frame }));
      }
      const pin = new THREE.Group();
      pin.position.copy(holeDir).multiplyScalar(R * 1.2);
      holder.add(pin);
      const holeLabel = ctx.label(["A coronal hole", "dark in ultraviolet"], { parent: pin, height: 0.028, declutter: false });
      /* Wind particles from the hole toward Earth (world space). */
      const FAST = 900;
      const fast = ctx.cloud(FAST, { size: 2.8 });
      const wr = rng(21);
      const fastP = Array.from({ length: FAST }, () => ({ ph: wr(), a: wr() * TAU, w: Math.sqrt(wr()) }));
      fastP.forEach((_, i) => fast.tint(i, "#bfe6ff"));
      const aurora = earthAurora(earth);
      const hud = ctx.hudLayer();
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.62, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label(["Two days later"], { parent: hud, at: [0, 0, 0], height: 0.05, declutter: false });
      ctx.fade(cutWords, 0);
      const arrival = ctx.cloud(700, { size: 2.6 });
      const ar = rng(31);
      const arrP = Array.from({ length: 700 }, () => ({ ph: ar(), y: (ar() - 0.5) * 2, z: (ar() - 0.5) * 2 }));
      arrP.forEach((_, i) => arrival.tint(i, "#bfe6ff"));

      ctx.tell([
        { at: 0, label: "A dark patch", text: "In ultraviolet light the Sun's corona glows — except in a coronal hole, which looks dark. Here it is painted on the Sun as ultraviolet would show it." },
        { at: 0.18, label: "Open field", text: "Elsewhere the magnetic field loops back down. Here it opens straight out into space, and the gas escapes." },
        { at: 0.32, label: "Fast wind", text: "The wind from the hole blows at up to about 800 km/s, twice the speed of the ordinary solar wind." },
        { at: 0.56, label: "Days later", text: "When the hole faces Earth, the fast stream arrives two or three days later — and auroras often follow." },
      ]);
      const cut = cutter(ctx);
      const holeW = new THREE.Vector3();
      const host = new THREE.Vector3();
      let onEarth = false;
      return {
        duration: 20,
        update(p) {
          /* Mostly toward us, a little toward Earth, so the hole is seen face-on. */
          if (!onEarth) ctx.turnHostToward(hLat, hLon, toEarth.clone().multiplyScalar(0.45).add(ctx.camDir).normalize(), 0.1);
          ctx.fade(holeLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.46, 0.5)));
          ctx.fade(dark, 1);
          ctx.fade(darker, 1);
          open.forEach((l) => ctx.fade(l, smooth(p, 0.16, 0.24) * 0.7));
          /* The fast stream, flowing out of the hole toward Earth. */
          sun.updateMatrixWorld(true);
          holeW.copy(holeDir).multiplyScalar(R);
          sun.localToWorld(holeW);
          ctx.host.getWorldPosition(host);
          const outDir = holeW.clone().sub(host).normalize().lerp(toEarth, 0.5).normalize();
          const side = new THREE.Vector3().crossVectors(outDir, new THREE.Vector3(0, 1, 0)).normalize();
          const up = new THREE.Vector3().crossVectors(side, outDir).normalize();
          const flow = smooth(p, 0.3, 0.38) * (p < 0.5 ? 1 : 0);
          for (let i = 0; i < FAST; i += 1) {
            const q = fastP[i];
            const s = (q.ph + p * 2.6) % 1;
            const along = s * R * 1.8;
            const rad = R * 0.22 * q.w * (0.4 + s);
            const x = holeW.x + outDir.x * along + (side.x * Math.cos(q.a) + up.x * Math.sin(q.a)) * rad;
            const y = holeW.y + outDir.y * along + (side.y * Math.cos(q.a) + up.y * Math.sin(q.a)) * rad;
            const z = holeW.z + outDir.z * along + (side.z * Math.cos(q.a) + up.z * Math.sin(q.a)) * rad;
            fast.set(i, (x - host.x) / ctx.unit, (y - host.y) / ctx.unit, (z - host.z) / ctx.unit);
            fast.alpha[i] = flow * (1 - s ** 3) * 0.85;
          }
          fast.commit();

          cut(p > 0.49 && p < 0.57);
          ctx.fade(cutWords, smooth(p, 0.495, 0.51) * (1 - smooth(p, 0.55, 0.57)));
          if (p > 0.5 && !onEarth && earth) {
            onEarth = true;
            flyTo(ctx, "Earth", { shotYaw: nightYaw(earthW, 105), shotZoom: 1.6, shotPitch: 0.3 });
          }
          /* The stream sweeping past Earth from the sunward side. */
          if (earth) {
            earth.getWorldPosition(earthW);
            const sunward = earthW.clone().negate().normalize();
            const s2 = new THREE.Vector3().crossVectors(sunward, new THREE.Vector3(0, 1, 0)).normalize();
            const u2 = new THREE.Vector3().crossVectors(s2, sunward).normalize();
            const ER = bodyRadius(earth);
            const on = smooth(p, 0.56, 0.6) * (1 - smooth(p, 0.9, 0.97));
            for (let i = 0; i < arrP.length; i += 1) {
              const q = arrP[i];
              const s = (q.ph + p * 3) % 1;
              const along = lerp(ER * 8, -ER * 8, s);
              const x = earthW.x + sunward.x * along + s2.x * q.y * ER * 4 + u2.x * q.z * ER * 4;
              const y = earthW.y + sunward.y * along + s2.y * q.y * ER * 4 + u2.y * q.z * ER * 4;
              const z = earthW.z + sunward.z * along + s2.z * q.y * ER * 4 + u2.z * q.z * ER * 4;
              arrival.set(i, (x - host.x) / ctx.unit, (y - host.y) / ctx.unit, (z - host.z) / ctx.unit);
              const inside = Math.hypot(q.y, q.z) * 4 < 1.4 && along < 0 ? 0 : 1;
              arrival.alpha[i] = on * 0.7 * inside;
            }
            arrival.commit();
          }
          /* A minor storm (G1): the oval a little brighter and lower. */
          const storm = smooth(p, 0.62, 0.8);
          aurora.set({ lat: lerp(67, 58, storm), width: lerp(1, 2, storm), gain: lerp(1, 2.2, storm), red: 0.15 * storm });
          clock.userData.draw(p < 0.3 ? ["Ultraviolet view", "the corona glows; the hole is dark"] : p < 0.5 ? ["Fast wind", "about 800 km/s"] : [`Day ${(2.2 * smooth(p, 0.5, 0.62)).toFixed(1)}`, storm > 0.3 ? "the stream reaches Earth: auroras" : "the stream crosses to Earth"]);
          ctx.fade(clock, p > 0.49 && p < 0.57 ? 0 : 1);
        },
        dispose() { aurora.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 7 */
  event({
    id: "sun-differential-rotation",
    section: "sun",
    title: "The Sun spins faster at its equator",
    place: "The Sun",
    kind: "ongoing",
    family: "solar",
    often: "always",
    detail: "The Sun's equator turns once in about 25 days and its polar regions in about 34 — so a straight line across it shears into a curve",
    frequency: "Always. It was first noticed by tracking sunspots in the 1630s and is now measured from the Doppler shift of the surface itself.",
    cause: "The Sun is a ball of gas, not a solid. Its outer convective layer, the top 30% or so, turns fastest at the equator and slower toward the poles. That shear stretches the magnetic field round and round the Sun like thread on a spool, strengthening it until loops burst through as sunspots — the engine of the 11-year cycle.",
    note: "Seen from Earth, which moves along its orbit in the same direction, a spot at the equator takes about 26 days to come round again; the standard 'Carrington rotation' used to number the Sun's turns is 27.3 days.",
    accuracy: "Rotation rates are the measured ones (Snodgrass & Ulrich 1990): 24.5 days at the equator, about 30 at 60° and 34 near the poles. The view turns with the Sun at mid-latitude, so the shear stands out; time is speeded up.",
    art: { main: "sun", fx: "spiral" },
    scene(ctx) {
      const hw = ctx.halfWidth;
      /* Sidereal rotation, degrees a day: 14.713 - 2.396 sin²φ - 1.787 sin⁴φ
       * (Snodgrass & Ulrich 1990). */
      const omega = (lat) => { const s2 = Math.sin(lat * D2R) ** 2; return 14.713 - 2.396 * s2 - 1.787 * s2 * s2; };
      const FRAME = omega(35);
      const R = 0.5;
      const holder = new THREE.Group();
      holder.position.set(-0.1, 0.0, 0);
      holder.rotation.x = 0.22;
      ctx.add(holder);
      ctx.sun(R, { ...WHITE_SUN, halo: 1.9, haloOpacity: 0.4, parent: holder });
      const LON0 = -12;
      const lats = [];
      for (let lat = -80; lat <= 80; lat += 2) lats.push(lat);
      const ghost = ctx.line(lats.map((lat) => ctx.onSphere(R * 1.01, lat, LON0)), { colour: "#ffffff", opacity: 0.4, dashed: true, dash: 0.02, gap: 0.02, parent: holder });
      const line = ctx.line(lats.map((lat) => ctx.onSphere(R * 1.012, lat, LON0)), { colour: "#7fe0ff", opacity: 0.95, additive: false, parent: holder });
      const markLats = [-60, -30, 0, 30, 60];
      const marks = ctx.cloud(markLats.length, { parent: holder, size: 7 });
      markLats.forEach((lat, i) => marks.tint(i, lat === 0 ? "#ffffff" : "#bfefff"));
      const rates = ctx.label(["One turn takes:", "24.5 days at the equator", "30 days at latitude 60°", "about 34 days near the poles"], { at: [-hw * 0.92, 0.7, 0], height: 0.026 * 2.2, align: "left" });
      const clock = ctx.label([""], { at: [0.62, -0.62, 0], height: 0.04 });
      const lonAt = (lat, days) => LON0 + (omega(lat) - FRAME) * days;

      ctx.tell([
        { at: 0, label: "A straight line", text: "Imagine a line of markers drawn on the Sun, from pole to pole." },
        { at: 0.1, label: "Day by day", text: "The equator turns fastest, once in 24.5 days. Near the poles a turn takes about 34." },
        { at: 0.5, label: "Sheared", text: "After a month, the line has bent into an arc: the equator has pulled ahead." },
        { at: 0.66, label: "Wound up", text: "Keep going and the line — like the Sun's magnetic field — wraps round and round. That winding drives the sunspots and the 11-year cycle." },
      ]);

      return {
        duration: 20,
        update(p) {
          const days = p < 0.62 ? 30 * smooth(p, 0.1, 0.6) : lerp(30, 150, smooth(p, 0.64, 0.96));
          ctx.setLine(line, lats.map((lat) => ctx.onSphere(R * 1.012, lat, lonAt(lat, days))));
          markLats.forEach((lat, i) => {
            const v = ctx.onSphere(R * 1.02, lat, lonAt(lat, days));
            marks.set(i, v.x, v.y, v.z);
          });
          marks.commit();
          ctx.fade(ghost, smooth(p, 0.1, 0.16) * (1 - smooth(p, 0.62, 0.7)));
          ctx.fade(rates, smooth(p, 0.08, 0.14));
          clock.userData.draw([`Day ${Math.floor(days)}`]);
          ctx.fade(clock, smooth(p, 0.06, 0.1));
        },
      };
    },
  }),


  /* ------------------------------------------------------------------ 8 */
  event({
    id: "sun-granulation",
    section: "sun",
    title: "Granulation: the Sun's boiling surface",
    place: "The Sun's surface",
    kind: "ongoing",
    family: "solar",
    often: "always",
    detail: "Up close, the Sun's surface is a boiling mesh of bright cells, each about the size of a country and each living about ten minutes",
    frequency: "Always. Each cell lasts roughly 8 to 20 minutes before it fades and new ones take its place.",
    cause: "Below the surface the Sun carries its heat outward by convection, like a pan of boiling soup. Hot gas wells up in the bright centre of each cell at about a kilometre a second, spreads out, cools by a few hundred degrees as it gives off its light, and sinks again in the darker lanes between cells.",
    note: "Granules are about 1,000 to 1,500 km across — France is about 1,000 km — and there are around four million on the Sun at any moment. Bigger flows, supergranules about 30,000 km across, herd them into a pattern that lasts a day or so. The Inouye Solar Telescope in Hawaii has photographed detail as small as about 30 km.",
    accuracy: "The cell pattern is generated, not a real image, but drawn at the right size against the scale bar. Time is speeded up about 60 times. The side view below is a diagram.",
    art: { main: "sun", fx: "cells" },
    scene(ctx) {
      const hw = ctx.halfWidth;
      /* layout: a patch of surface, ~1,300 km per cell (typical granule). */
      const W = Math.min(2.1, hw * 1.85);
      const H = 1.2;
      const CELLS0 = 7.6;
      const kmPerUnit = 1300 * CELLS0;
      /* White, as the Sun is in ordinary light (owner, round 82). */
      const patch = surface(ctx, { width: W, height: H, cells: CELLS0, bright: 1.05, colour: "#ece2d2", hot: "#ffffff", lane: "#6e6252" });
      patch.position.set(0, 0.18, 0);
      const barY = 0.18 - H / 2 + 0.08;
      const barX = -W / 2 + 0.12;
      const bar = ctx.line([[barX, barY, 0.02], [barX + 0.2, barY, 0.02]], { colour: "#ffffff", opacity: 0.95, additive: false });
      const barLabel = ctx.label([""], { at: [barX, barY + 0.05, 0.02], height: 0.026, align: "left" });
      const clock = ctx.label(["", ""], { at: [-W / 2 + 0.06, 0.18 + H / 2 + 0.06, 0], height: 0.03, align: "left" });

      /* The side view: convection rolls, up in each cell's middle. */
      const SY = -0.62;
      const SW = Math.min(1.8, hw * 1.6);
      ctx.line([[-SW / 2, SY + 0.09, 0], [SW / 2, SY + 0.09, 0]], { colour: "#ffd27f", opacity: 0.7 });
      const cellsAcross = 4;
      const cw = SW / cellsAcross;
      const rolls = [];
      for (let c = 0; c < cellsAcross; c += 1) {
        const cx = -SW / 2 + cw * (c + 0.5);
        rolls.push({ x: cx - cw / 4, dir: 1 }, { x: cx + cw / 4, dir: -1 });
      }
      const PER = 26;
      const flow = ctx.cloud(rolls.length * PER, { size: 3.4 });
      const HOTC = new THREE.Color("#fff2b0");
      const COOLC = new THREE.Color("#ff6a2a");
      const mixC = new THREE.Color();
      const sideLabel = ctx.label(["Side view: hot gas rises in the middle,", "cools and sinks at the edges"], { at: [0, SY - 0.17, 0], height: 0.05 });
      ctx.fade(sideLabel, 0);

      ctx.tell([
        { at: 0, label: "The surface", text: "A patch of the Sun's surface a few Earths wide. Each bright cell is a column of hot gas rising from below." },
        { at: 0.28, label: "Rising and sinking", text: "Gas wells up in the middle, spreads, cools, and sinks again in the darker lanes." },
        { at: 0.52, label: "Ten minutes", text: "Each cell lives about ten minutes. Watch them swell, split and fade." },
        { at: 0.78, label: "Four million", text: "Zoom out: there are around four million of them covering the Sun at any moment." },
      ]);

      return {
        duration: 20,
        update(p) {
          const minutes = 22 * span(p, 0.03, 0.97);
          patch.material.uniforms.uEvolve.value = minutes * 0.75;
          const zoom = lerp(1, 3, easeInOut(span(p, 0.78, 0.9)));
          patch.material.uniforms.uCells.value = CELLS0 * zoom;
          const km = zoom > 1.5 ? 10000 : 2000;
          const len = (km / kmPerUnit) * zoom;
          ctx.setLine(bar, [[barX, barY, 0.02], [barX + len, barY, 0.02]]);
          barLabel.userData.draw([`${fmt(km)} km`]);
          clock.userData.draw([`${Math.floor(minutes)} min`, p > 0.8 ? "~4 million cells cover the Sun" : "cells ~1,300 km across"]);
          ctx.fade(clock, smooth(p, 0.02, 0.06));
          ctx.fade(barLabel, 1);
          rolls.forEach((roll, ri) => {
            for (let k = 0; k < PER; k += 1) {
              const a = (k / PER) * TAU + roll.dir * p * TAU * 3;
              const i = ri * PER + k;
              flow.set(i, roll.x + Math.cos(a) * cw * 0.22, SY + Math.sin(a) * 0.075, 0.02);
              const up = roll.dir * Math.cos(a);
              mixC.copy(COOLC).lerp(HOTC, 0.5 + 0.5 * up);
              flow.tint(i, mixC);
              flow.alpha[i] = smooth(p, 0.22, 0.3) * 0.9;
            }
          });
          flow.commit();
          ctx.fade(sideLabel, smooth(p, 0.25, 0.32));
        },
      };
    },
  }),


  /* ------------------------------------------------------------------ 9 */
  event({
    id: "sun-neutrinos",
    section: "sun",
    body: "Sun",
    title: "Neutrinos passing through you",
    place: "From the Sun's core, through Earth",
    kind: "ongoing",
    family: "solar",
    often: "always, day and night",
    detail: "Every second, about 65 billion neutrinos from the Sun's core pass through each square centimetre of you — and straight on through the Earth",
    frequency: "Always, day and night: at night they come up through the ground, having crossed the whole planet.",
    cause: "In the core, hydrogen fuses into helium. To build one helium nucleus from four protons, two protons must turn into neutrons, and each change releases a neutrino. Neutrinos have almost no mass and no charge and barely interact with anything, so they fly straight out of the Sun in about two seconds, and through Earth as if it were empty.",
    note: "The first detector, in the Homestake gold mine in the 1960s, caught only about a third of the neutrinos expected — the 'solar neutrino problem'. It was solved in 2001–2002, when they were found to change type on the way.",
    accuracy: "On the site's own Sun and Earth. Neutrinos are invisible; each dot stands for an enormous number of them, drawn passing through the Sun and Earth as they really do. The flux (about 6.5 × 10¹⁰ per cm² per second, Bahcall), the timings and the detector are real.",
    art: { main: "sun", second: "earth", fx: "beam" },
    shotZoom: 2.6,
    shotPitch: 0.1,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      const sunW = sun.getWorldPosition(new THREE.Vector3());
      const earthW = earth ? earth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(300, 0, 0);
      const toEarth = earthW.clone().sub(sunW).normalize();
      ctx.refocus("Sun", { shotYaw: sideOnYaw(toEarth), shotZoom: 2.6, shotPitch: 0.1 });
      const R = ctx.hostRadius() / ctx.unit;
      /* The core, seen through the Sun (drawn over it). */
      const core = ctx.glow("#ffffff", R * 0.6, { opacity: 0.9 });
      core.material.depthTest = false;
      core.renderOrder = 45;
      const coreTag = ctx.label(["The core", "15 million °C"], { at: [0, -R * 0.38, 0], height: 0.026, declutter: false });
      /* From the core, every way, most drawn toward Earth. */
      const N = 1400;
      const nu = ctx.cloud(N, { size: 2.6 });
      nu.points.material.depthTest = false;
      nu.points.renderOrder = 46;
      const r = rng(77);
      const pts = Array.from({ length: N }, (_, i) => {
        const v = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        if (i % 10 < 6) v.lerp(toEarth, 0.85).normalize();
        return { v, ph: r() };
      });
      pts.forEach((_, i) => nu.tint(i, i % 5 ? "#bfe8ff" : "#ffffff"));
      /* On Earth: the stream going straight through, and Super-Kamiokande
       * (Kamioka, Japan, 36.4° N 137.3° E). */
      const M = 900;
      const through = ctx.cloud(M, { size: 2.6 });
      through.points.material.depthTest = false;
      through.points.renderOrder = 46;
      const tr = rng(91);
      const tp = Array.from({ length: M }, () => ({ ph: tr(), y: tr() * 2 - 1, z: tr() * 2 - 1 }));
      tp.forEach((_, i) => through.tint(i, i % 5 ? "#bfe8ff" : "#ffffff"));
      const tank = earth ? earthPlace(ctx, earth, 36.4, 137.3, ["Super-Kamiokande", "1 km under a mountain in Japan"], "#7fe8ff") : null;
      const rings = earth ? [0, 1].map(() => {
        const g = ctx.circle(1, { plane: "xy", colour: "#9ff0ff", opacity: 0.95 });
        ctx.fade(g, 0);
        return g;
      }) : [];
      const hud = ctx.hudLayer();
      const flux = ctx.label(["", ""], { parent: hud, at: [0, 0.6, 0], height: 0.036, declutter: false });
      const cutWords = ctx.label(["8 minutes later, at Earth"], { parent: hud, at: [0, 0, 0], height: 0.045, declutter: false });
      ctx.fade(cutWords, 0);

      ctx.tell([
        { at: 0, label: "The core", text: "Fusion in the Sun's core makes light — and neutrinos, two for every helium nucleus built." },
        { at: 0.16, label: "Straight out", text: "Light needs tens of thousands of years to struggle out. Neutrinos fly through the Sun in about two seconds." },
        { at: 0.44, label: "Through everything", text: "About 65 billion pass through every square centimetre each second — through your thumbnail, and through the whole Earth, night and day." },
        { at: 0.74, label: "Catching one", text: "Almost none ever stops. Super-Kamiokande, 50,000 tonnes of pure water a kilometre underground, catches a few as faint rings of light." },
      ]);
      const cut = cutter(ctx);
      const host = new THREE.Vector3();
      const tankW = new THREE.Vector3();
      let onEarth = false;
      return {
        duration: 20,
        update(p) {
          const flick = 0.85 + 0.15 * Math.sin(ctx.t * 6);
          const onSun = 1 - smooth(p, 0.38, 0.4);
          ctx.fade(core, smooth(p, 0, 0.08) * flick * onSun);
          ctx.fade(coreTag, smooth(p, 0.02, 0.08) * (1 - smooth(p, 0.3, 0.36)));
          for (let i = 0; i < N; i += 1) {
            const q = pts[i];
            const s = (q.ph + p * 2.4) % 1;
            const d = s * R * 3.2;
            nu.set(i, q.v.x * d, q.v.y * d, q.v.z * d);
            nu.alpha[i] = smooth(p, 0.05, 0.12) * onSun * (1 - s ** 4) * 0.9;
          }
          nu.commit();

          cut(p > 0.39 && p < 0.46);
          ctx.fade(cutWords, smooth(p, 0.395, 0.41) * (1 - smooth(p, 0.44, 0.46)));
          if (p > 0.4 && !onEarth && earth) {
            onEarth = true;
            flyTo(ctx, "Earth", { shotYaw: nightYaw(earthW, 140), shotZoom: 1.5, shotPitch: 0.3 });
          }
          if (earth) {
            earth.getWorldPosition(earthW);
            ctx.host.getWorldPosition(host);
            if (onEarth) {
              const camOff = ctx.camera.position.clone().sub(earthW).normalize();
              /* Japan toward us, on the night side: they come up through the
               * ground there. */
              turnBodyToward(earth, 36.4, 137.3, camOff, 0.06);
            }
            const away = earthW.clone().sub(host).normalize();
            const s2 = new THREE.Vector3().crossVectors(away, new THREE.Vector3(0, 1, 0)).normalize();
            const u2 = new THREE.Vector3().crossVectors(s2, away).normalize();
            const ER = bodyRadius(earth);
            const on = smooth(p, 0.45, 0.5);
            for (let i = 0; i < M; i += 1) {
              const q = tp[i];
              const s = (q.ph + p * 4) % 1;
              const along = lerp(-ER * 6, ER * 6, s);
              const x = earthW.x + away.x * along + s2.x * q.y * ER * 1.6 + u2.x * q.z * ER * 1.6;
              const y = earthW.y + away.y * along + s2.y * q.y * ER * 1.6 + u2.y * q.z * ER * 1.6;
              const z = earthW.z + away.z * along + s2.z * q.y * ER * 1.6 + u2.z * q.z * ER * 1.6;
              through.set(i, (x - host.x) / ctx.unit, (y - host.y) / ctx.unit, (z - host.z) / ctx.unit);
              through.alpha[i] = on * 0.8;
            }
            through.commit();
            if (tank) {
              ctx.fade(tank.label, smooth(p, 0.74, 0.8));
              ctx.fade(tank.dot, smooth(p, 0.72, 0.78) * (0.6 + 0.4 * Math.sin(ctx.t * 3)));
              tank.group.getWorldPosition(tankW);
              /* A catch: a ring of Cherenkov light (drawing choice: two flashes). */
              rings.forEach((g, k) => {
                const a = k ? 0.9 : 0.8;
                const grow = span(p, a, a + 0.06);
                const show = win(p, a, a + 0.06, 0.01);
                g.position.copy(tankW).sub(host).divideScalar(ctx.unit);
                g.quaternion.copy(ctx.camera.quaternion);
                g.scale.setScalar((ER / ctx.unit) * (0.05 + grow * 0.3));
                ctx.fade(g, show * (1 - grow));
              });
            }
          }
          flux.userData.draw(p < 0.4 ? ["Out of the Sun in about 2 seconds", "to Earth in 8 min 19 s"] : ["65,000,000,000", "per cm² every second, night and day"]);
          ctx.fade(flux, (smooth(p, 0.16, 0.22) * (1 - smooth(p, 0.38, 0.4))) + smooth(p, 0.46, 0.52));
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 10 */
  event({
    id: "sun-red-giant",
    section: "sun",
    body: "Sun",
    title: "The Sun becomes a red giant",
    place: "The Sun and the inner planets",
    kind: "transient",
    family: "stellar",
    when: "in about 5 billion years",
    often: "once, ~5 billion years from now",
    detail: "In about five billion years the Sun swells into a red giant past the orbits of Mercury and Venus, then sheds its outer layers and shrinks to a white dwarf",
    frequency: "Once. The Sun is 4.6 billion years old, roughly halfway through its hydrogen-burning life.",
    cause: "When hydrogen runs short in the core, the core shrinks and heats, and hydrogen starts burning in a shell around it. The extra energy pushes the outer layers out: in one detailed model the Sun grows to about 256 times its present radius, 1.2 AU. Later it burns helium, swells again, and finally puffs its outer layers into space, leaving its hot core behind.",
    note: "Long before then, the slowly brightening Sun will have boiled Earth's oceans away, in about a billion years. Whether Earth itself is swallowed is uncertain: as the Sun loses mass its grip loosens and Earth's orbit widens to about 1.5 AU, but tides raised on the giant may drag it in.",
    accuracy: "The site's own Sun and planets, seen from above. The site draws the Sun far bigger than true against its orbits, so the giant is sized against the planets' orbits instead: it reaches past Venus's and nearly to Earth's, as in one model (Schröder & Smith 2008, largest at +7.6 billion years, mass falling to two-thirds and the orbits widening as it does); other models differ by tens of percent. Everything is put back afterwards.",
    art: { main: "redgiant", second: "whitedwarf", fx: "ring" },
    shotDistance: 1500,
    shotPitch: 1.0,
    scene(ctx) {
      const RSUN_AU = SUN_KM / AU_KM;
      const names = ["Mercury", "Venus", "Earth", "Mars"];
      /* Semi-major axes, AU (NASA). */
      const AU = { Mercury: 0.387, Venus: 0.723, Earth: 1.0, Mars: 1.524 };
      const bodies = names.map((name) => {
        const body = ctx.findBody(name);
        return body ? { name, body, r0: body.userData.orbitRadius ?? body.position.length(), visible: body.visible } : null;
      }).filter(Boolean);
      /* AU to the site's orbit scale, through its own planets' orbits. */
      const pairs = [[0, 0], ...bodies.map((b) => [AU[b.name], b.r0])].sort((a, b) => a[0] - b[0]);
      const siteOf = (au) => {
        for (let i = 1; i < pairs.length; i += 1) {
          if (au <= pairs[i][0]) return lerp(pairs[i - 1][1], pairs[i][1], (au - pairs[i - 1][0]) / (pairs[i][0] - pairs[i - 1][0]));
        }
        const [a0, b0] = pairs[pairs.length - 2];
        const [a1, b1] = pairs[pairs.length - 1];
        return b1 + ((au - a1) * (b1 - b0)) / (a1 - a0);
      };
      const R0 = ctx.hostRadius();
      /* Model (Schröder & Smith 2008): tip of the red-giant branch at +7.59
       * Gyr, radius 256 R☉, mass 0.668 M☉; white dwarf 0.54 M☉. Early growth
       * (to ~1.4 R☉ at +5 Gyr, ~10 R☉ at +7 Gyr) is approximate. */
      const radiusAt = (gyr) => {
        if (gyr <= 5) return lerp(1, 1.4, gyr / 5);
        if (gyr <= 7) return Math.exp(lerp(Math.log(1.4), Math.log(10), (gyr - 5) / 2));
        return Math.exp(lerp(Math.log(10), Math.log(256), Math.min(1, (gyr - 7) / 0.59) ** 1.6));
      };
      const massAt = (rSun) => lerp(1, 0.668, ((Math.log(rSun) / Math.log(256)) ** 3));
      const RED = new THREE.Color("#ff6a3a");
      const WHITE = new THREE.Color("#ffffff");
      const DWARF = new THREE.Color("#cfe0ff");
      const tint = new THREE.Color();
      /* Names on the planets, found from above. */
      const tags = bodies.map((b) => ({ ...b, label: ctx.label([b.name], { height: 0.026, declutter: false }) }));
      /* The shed envelope: a planetary nebula, flung out past the planets. */
      const NEB = 2400;
      const nebula = ctx.cloud(NEB, { size: 3 });
      const r = rng(55);
      const neb = Array.from({ length: NEB }, () => ({ v: new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).normalize(), w: r(), j: r() }));
      neb.forEach((q, i) => nebula.tint(i, q.w > 0.6 ? "#ff5a6a" : q.w > 0.25 ? "#5fe0d0" : "#a9b8ff"));
      const hud = ctx.hudLayer();
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.62, 0], height: 0.034, declutter: false });
      const fate = ctx.label(["", ""], { parent: hud, at: [-0.4, -0.72, 0], height: 0.028, declutter: false });

      ctx.tell([
        { at: 0, label: "Today", text: "The Sun and the inner planets, from above." },
        { at: 0.14, label: "Running short", text: "In about five billion years the hydrogen in the core runs low, and the Sun begins to swell." },
        { at: 0.38, label: "Red giant", text: "It balloons to about 250 times its width, swallowing Mercury and then Venus. Earth's orbit widens as the Sun loses mass — it may escape, or be dragged in." },
        { at: 0.68, label: "White dwarf", text: "Finally it throws off its outer layers as a glowing planetary nebula, leaving a white dwarf about the size of Earth." },
      ]);
      const pos = new THREE.Vector3();
      const host = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          const gyr = p < 0.28 ? 5 * smooth(p, 0.12, 0.28) : p < 0.38 ? lerp(5, 7, span(p, 0.28, 0.38)) : p < 0.62 ? lerp(7, 7.59, span(p, 0.38, 0.62)) : lerp(7.59, 7.72, span(p, 0.66, 0.78));
          const giant = p < 0.66;
          const rSun = giant ? radiusAt(gyr) : 256;
          const mass = massAt(rSun);
          const rAU = rSun * RSUN_AU;
          /* The giant against the orbits; never smaller than the Sun as drawn. */
          const siteR = Math.max(R0, siteOf(rAU));
          const shed = smooth(p, 0.66, 0.8);
          /* White dwarf: about Earth's size (the site's Earth is 0.9 units). */
          const scale = lerp(siteR / R0, 1.1 / R0, shed);
          const redness = smooth(Math.log(rSun), Math.log(2), Math.log(60));
          tint.copy(WHITE).lerp(RED, redness * (1 - shed)).lerp(DWARF, shed);
          ctx.setSunLook({ scale, tint: shed > 0 ? tint.clone().multiplyScalar(lerp(1, 1.6, shed)) : tint });
          /* Orbits widen as the Sun's mass falls (a ∝ 1/M). */
          ctx.host.getWorldPosition(host);
          tags.forEach((b) => {
            const wide = siteOf(AU[b.name] / (giant ? mass : 0.54 + 0.128 * (1 - shed)));
            b.body.userData.orbitRadius = wide;
            const swallowed = (b.name === "Mercury" || b.name === "Venus") && siteR * (1 - shed) > b.r0 * 0.98 && p > 0.3;
            if (swallowed) b.gone = true;
            b.body.visible = b.gone ? false : b.visible;
            b.body.getWorldPosition(pos);
            b.label.position.copy(pos).sub(host).divideScalar(ctx.unit).add(new THREE.Vector3(0, 0.25, 0));
            b.label.userData.draw(b.gone ? [`${b.name} — swallowed`] : b.name === "Earth" && p > 0.45 ? ["Earth", "its orbit widens"] : [b.name]);
            ctx.fade(b.label, smooth(p, 0.02, 0.06) * (b.gone ? 0.75 : 1));
          });
          const rN = lerp(siteR, siteOf(3.2), smooth(p, 0.66, 0.97)) / ctx.unit;
          neb.forEach((q, i) => {
            const rr = rN * (0.78 + 0.22 * q.w) * (1 + 0.06 * Math.sin(q.j * 40));
            nebula.set(i, q.v.x * rr, q.v.y * rr, q.v.z * rr);
            nebula.alpha[i] = smooth(p, 0.66, 0.72) * (1 - 0.5 * smooth(p, 0.8, 0.97)) * (0.4 + 0.6 * q.j);
          });
          nebula.commit();
          if (p < 0.12) clock.userData.draw(["Today", "the Sun is 4.6 billion years old"]);
          else if (p < 0.66) clock.userData.draw([`+${gyr.toFixed(2)} billion years`, `radius ${rSun < 10 ? rSun.toFixed(1) : fmt(rSun)} × today's (${rAU.toFixed(rAU < 0.1 ? 3 : 2)} AU)`]);
          else clock.userData.draw([`+${gyr.toFixed(2)} billion years`, p < 0.78 ? "the outer layers are thrown off" : "a white dwarf in a planetary nebula"]);
          if (p > 0.5 && p < 0.7) fate.userData.draw(["Earth?", "orbit widened to ~1.5 AU"]);
          else if (p >= 0.78) fate.userData.draw(["White dwarf", "Earth-sized, 0.54 Suns of mass"]);
          ctx.fade(fate, smooth(p, 0.5, 0.55) * (1 - smooth(p, 0.68, 0.72)) + smooth(p, 0.8, 0.85));
        },
        dispose() {
          ctx.setSunLook(null);
          tags.forEach((b) => { b.body.userData.orbitRadius = b.r0; b.body.visible = b.visible; });
        },
      };
    },
  }),
];

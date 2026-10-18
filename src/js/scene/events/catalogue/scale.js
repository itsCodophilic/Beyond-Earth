import * as THREE from "three";
import { event, smooth, span, lerp, TAU, rng, easeInOut, mapUrl } from "./kit.js";
import { setOrbitPosition } from "../../orbits.js";

/**
 * Section 1 of the catalogue: size and scale (round 79, reworked in round 80
 * from the owner's notes in Prompts.md).
 *
 * Not things that happen -- things that are true, shown so they can be
 * felt. Most are dioramas on plain black in the middle of the screen; four
 * are staged on the real bodies of the site's own Solar System: Venus going
 * round the real Sun, Olympus Mons and Valles Marineris on the real Mars,
 * and the real Moon drifting away from the real Earth.
 *
 * Sizes and distances are NASA's planetary fact sheets (nssdc.gsfc.nasa.gov
 * /planetary/factsheet) unless a comment says otherwise.
 */

/* Mean radius, km (NASA fact sheets). */
const EARTH_RADIUS = 6371;
const MOON_RADIUS = 1737.4;
/* Equatorial diameter of Earth, km (NASA). */
const EARTH_DIAMETER = 12756;
/* Earth–Moon centre to centre, km (NASA Moon fact sheet): mean semi-major
 * axis 384,400; typical perigee 363,300 and apogee 405,500. */
const MOON_MEAN = 384400;
const MOON_PERIGEE = 363300;
const MOON_APOGEE = 405500;
/* Mean diameters for the line-up, km (NASA). Mean, not equatorial, because
 * the giants are flattened and the honest comparison is the average width;
 * the sum is the familiar "about 380,000 km". */
const MEAN_DIAMETER = {
  Mercury: 4879.4, Venus: 12103.6, Mars: 6779.0, Jupiter: 139820, Saturn: 116460, Uranus: 50724, Neptune: 49244,
};
const LINEUP = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];

/* White, as the Sun really is above the air (owner: "the Sun should be
 * white, not yellow"). Drawing choice for the star shader's two tones. */
const WHITE_SUN = { colour: "#d9d0c4", hot: "#ffffff", haloColour: "#fff1dc" };

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const pad2 = (n) => String(Math.floor(n)).padStart(2, "0");

/** A flat picture painted on a canvas, as a plane in the hud (w x h units). */
function paintedPlane(ctx, w, h, pxW, paint, { parent, anchorBottom = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = pxW;
  canvas.height = Math.round((pxW * h) / w);
  paint(canvas.getContext("2d"), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const geometry = new THREE.PlaneGeometry(w, h);
  if (anchorBottom) geometry.translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 1, depthWrite: false, toneMapped: false, fog: false,
  }));
  mesh.renderOrder = 19;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = 1;
  (parent ?? ctx.root).add(mesh);
  return mesh;
}

/** A ring of points on a body's surface round a feature (local frame). */
function surfaceRing(ctx, latDeg, lonDeg, angularRadiusDeg, lift = 1.004, n = 96) {
  const centre = ctx.surfacePoint(latDeg, lonDeg, lift);
  const normal = centre.clone().normalize();
  const helper = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(normal, helper).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  const r = centre.length();
  const a = THREE.MathUtils.degToRad(angularRadiusDeg);
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * TAU;
    const dir = normal.clone().multiplyScalar(Math.cos(a))
      .add(u.clone().multiplyScalar(Math.sin(a) * Math.cos(t)))
      .add(v.clone().multiplyScalar(Math.sin(a) * Math.sin(t)));
    points.push(dir.multiplyScalar(r));
  }
  return points;
}

/**
 * A glowing band painted on a body's surface along a path of surface points
 * (the body's own frame): wide enough to see from orbit, unlike a 1-px line.
 * Its drawn length is set with `reveal(fraction)`.
 */
function surfaceRibbon(points, halfWidth, { colour = "#ffc070", opacity = 0.6, closed = false } = {}) {
  const n = points.length;
  const position = new Float32Array(n * 2 * 3);
  const across = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const tangent = next.clone().sub(prev).normalize();
    const side = new THREE.Vector3().crossVectors(p.clone().normalize(), tangent).normalize().multiplyScalar(halfWidth);
    p.clone().add(side).toArray(position, i * 6);
    p.clone().sub(side).toArray(position, i * 6 + 3);
    across[i * 2] = 1;
    across[i * 2 + 1] = -1;
  }
  const index = [];
  for (let i = 0; i < n - 1; i += 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("across", new THREE.BufferAttribute(across, 1));
  geometry.setIndex(index);
  /* Soft edges: bright along the middle, fading to the sides. */
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(colour) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      attribute float across;
      varying float vAcross;
      void main() {
        vAcross = across;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAcross;
      void main() {
        float a = 1.0 - abs(vAcross);
        float core = smoothstep(0.55, 1.0, a);
        vec3 col = mix(uColor, vec3(1.0), core * 0.6);
        gl_FragColor = vec4(col, uOpacity * (a * 0.75 + core * 0.25));
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 23;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = opacity;
  mesh.userData.reveal = (f) => geometry.setDrawRange(0, Math.max(0, Math.floor((n - 1) * Math.min(1, f))) * 6);
  void closed;
  return mesh;
}


/* Smooth value noise, for terrain detail. Drawing choice. */
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}
function fbm(x, y) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i += 1) { sum += amp * noise2(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return sum;
}
/* smoothstep that allows edge0 > edge1. */
function smoothStep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * A lit landform: a grid on the XZ plane raised by `height(x, z)`, coloured
 * from a rectangle of a planet map (u0, v0, du, dv) where the place is, with
 * snow drawn above `snowAbove`. Its edges fade out. For the hud stage of a
 * body event, so the light is given in view space.
 */
function terrain({ width, depth, segments, height, map = null, rect = [0, 0, 1, 1], colour = [0.6, 0.4, 0.3], light, fadeEdge = 0.15, snowAbove = Infinity }) {
  const geometry = new THREE.PlaneGeometry(width, depth, segments[0], segments[1]);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) position.setY(i, height(position.getX(i), position.getZ(i)));
  geometry.computeVertexNormals();
  const texture = map ? new THREE.TextureLoader().load(map) : null;
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture }, uHasMap: { value: texture ? 1 : 0 }, uRect: { value: new THREE.Vector4(...rect) },
      uColour: { value: new THREE.Color(...colour) }, uLight: { value: light.clone() }, uOpacity: { value: 1 },
      uSnow: { value: snowAbove }, uFade: { value: fadeEdge },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying float vY;
      varying float vUp;
      void main() {
        vUv = uv;
        vY = position.y;
        vUp = normal.y;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform vec4 uRect;
      uniform vec3 uColour;
      uniform vec3 uLight;
      uniform float uOpacity;
      uniform float uSnow;
      uniform float uFade;
      varying vec2 vUv;
      varying vec3 vN;
      varying float vY;
      varying float vUp;
      void main() {
        vec3 base = uColour;
        if (uHasMap > 0.5) base = mix(uColour, texture2D(uMap, uRect.xy + vUv * uRect.zw).rgb * 1.1, 0.8);
        float snow = smoothstep(uSnow, uSnow * 1.15, vY) * smoothstep(0.35, 0.7, vUp);
        base = mix(base, vec3(0.93, 0.95, 1.0), snow);
        vec3 n = normalize(vN);
        float diffuse = max(dot(n, normalize(uLight)), 0.0);
        vec3 col = base * (0.2 + 0.95 * diffuse);
        vec2 e = abs(vUv * 2.0 - 1.0);
        float edge = max(e.x, e.y);
        float alpha = uOpacity * (1.0 - smoothstep(1.0 - uFade, 1.0, edge));
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: true, side: THREE.DoubleSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 18;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = 1;
  mesh.userData.texture = texture;
  return mesh;
}

export const SCALE_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "scale-planets-between",
    section: "scale",
    title: "All the planets fit between Earth and the Moon",
    place: "Between Earth and the Moon",
    kind: "ongoing",
    family: "scale",
    often: "always true — when the Moon is far",
    detail: "Mercury to Neptune, edge to edge: 380,000 km. They fit in the gap — but only when the Moon is near its farthest",
    frequency: "The Moon swings between about 363,300 km and 405,500 km every 27.3 days, so they fit for part of every month",
    cause: "The seven other planets' mean diameters add up to about 380,000 km. Measured centre to centre, the Moon's average distance is 384,400 km — but the planets have to fit between the two surfaces, which leaves 376,300 km at the average distance. Near apogee the gap opens to about 397,000 km, and they fit with room for Pluto too.",
    note: "Saturn is measured without its rings. With them it would not fit — the main rings alone are about 270,000 km across.",
    accuracy: "Every size and distance on screen is to one true scale. The planets are drawn in a row above the Earth–Moon line, so none hides another; the dashed lines carry the row's two ends down to the gap. The Moon's distance is the typical perigee and apogee.",
    art: { main: "earth", second: "moon", fx: "lineup" },
    scene(ctx) {
      /* layout: the gap fills 92% of the usable width; the line-up sits
       * above the Earth–Moon line, so the Moon is never behind a planet. */
      /* The event card covers the lower right of the screen, so the
       * Earth–Moon line runs across the middle and the row sits above it;
       * the readouts go below, on the left and centre. */
      const W = ctx.halfWidth * 2 * 0.86;
      const k = W / (MOON_APOGEE + EARTH_RADIUS + MOON_RADIUS);
      const x0 = -W / 2;
      const lowY = -0.02;
      const topY = 0.36;
      ctx.light.set(-0.35, 0.45, 0.82).normalize();

      const earth = ctx.ball(EARTH_RADIUS * k, { body: "Earth", rim: 0.6, rimColour: "#7fb8ff" });
      earth.position.set(x0 + EARTH_RADIUS * k, lowY, 0);
      const earthSurface = earth.position.x + EARTH_RADIUS * k;
      const moon = ctx.ball(MOON_RADIUS * k, { body: "Moon" });
      const moonX = (d) => earth.position.x + d * k;
      moon.position.set(moonX(MOON_MEAN), lowY, 0);
      const earthLabel = ctx.label(["Earth"], { at: [earth.position.x, lowY - 0.07, 0], height: 0.028, declutter: false });
      const moonLabel = ctx.label(["The Moon"], { at: [moon.position.x, lowY + 0.07, 0], height: 0.028, declutter: false });
      /* The Moon is a speck at this scale: a ring round it to find it by. */
      const moonRing = ctx.circle(0.03, { plane: "xy", colour: "#cfd8e3", opacity: 0.8, segments: 48 });
      const gapLine = ctx.line([[earthSurface, lowY, 0], [moon.position.x, lowY, 0]], { colour: "#7fd8ff", opacity: 0.55 });
      const gapLabel = ctx.label([""], { at: [-0.2, lowY - 0.16, 0], colour: "#bfe9ff", height: 0.03, declutter: false });

      /* The row of planets, edge to edge from Earth's surface. */
      let x = earthSurface;
      const planets = LINEUP.map((name, i) => {
        const r = (MEAN_DIAMETER[name] / 2) * k;
        const mesh = ctx.ball(r, { body: name, rim: 0.25, segments: 48 });
        const home = new THREE.Vector3(x + r, topY, 0);
        x += r * 2;
        const small = r < 0.04;
        /* Small worlds' names stand to the left of the row, stacked, on
         * leaders (they are narrower than their names); big ones' above. */
        const at = small
          ? new THREE.Vector3(earthSurface - 0.12, topY + 0.16 - i * 0.11, 0)
          : new THREE.Vector3(home.x, topY + r + 0.07, 0);
        const label = ctx.label([name, `${fmt(MEAN_DIAMETER[name])} km`], { at, height: 0.026, align: small ? "right" : "center", declutter: false });
        const leader = small ? ctx.line([home, at.clone().add(new THREE.Vector3(0.01, 0, 0))], { colour: "#9fb3c8", opacity: 0.5, additive: false }) : null;
        return { mesh, home, label, leader, from: new THREE.Vector3(home.x, 1.1, 0) };
      });
      const rowEnd = x;
      const total = LINEUP.reduce((sum, n) => sum + MEAN_DIAMETER[n], 0);
      /* The row's two ends carried down to the gap. */
      const startGuide = ctx.line([[earthSurface, topY + 0.02, 0], [earthSurface, lowY, 0]], { colour: "#9fb3c8", opacity: 0.45, dashed: true, dash: 0.02, gap: 0.015 });
      const endGuide = ctx.line([[rowEnd, topY + 0.02, 0], [rowEnd, lowY, 0]], { colour: "#7dffb0", opacity: 0.9, dashed: true, dash: 0.02, gap: 0.015 });
      const totalLabel = ctx.label(["", ""], { at: [-0.2, lowY - 0.32, 0], height: 0.034, declutter: false });

      ctx.tell([
        { at: 0, label: "The gap", text: "Earth and the Moon to one true scale, at the Moon's average distance: 384,400 km centre to centre." },
        { at: 0.12, label: "The line-up", text: "Above them, Mercury, Venus, Mars, Jupiter, Saturn, Uranus and Neptune, edge to edge from Earth's surface." },
        { at: 0.5, label: "Average distance", text: `Together ${fmt(total)} km — just over the 376,300 km between the two surfaces. The row's end overshoots the Moon.` },
        { at: 0.62, label: "At apogee", text: "The Moon swings out to about 405,500 km. Now the gap is 397,000 km — they all fit, with room for Pluto." },
        { at: 0.84, label: "At perigee", text: "At its closest, 363,300 km, they would not fit. It depends on the day of the month." },
      ]);

      return {
        duration: 22,
        update(p) {
          earth.rotation.y = ctx.t * 0.2;
          moon.rotation.y = ctx.t * 0.1;
          planets.forEach((planet, i) => {
            const t = easeInOut(span(p, 0.12 + i * 0.045, 0.2 + i * 0.045));
            planet.mesh.position.lerpVectors(planet.from, planet.home, t);
            planet.mesh.visible = t > 0.001;
            planet.mesh.rotation.y = ctx.t * 0.3;
            ctx.fade(planet.label, smooth(t, 0.7, 1));
            if (planet.leader) ctx.fade(planet.leader, smooth(t, 0.7, 1) * 0.5);
          });
          const d = p < 0.62 ? MOON_MEAN
            : p < 0.84 ? lerp(MOON_MEAN, MOON_APOGEE, easeInOut(span(p, 0.62, 0.74)))
              : lerp(MOON_APOGEE, MOON_PERIGEE, easeInOut(span(p, 0.84, 0.93)));
          moon.position.x = moonX(d);
          moonLabel.position.x = moon.position.x;
          moonRing.position.copy(moon.position);
          const gap = d - EARTH_RADIUS - MOON_RADIUS;
          const moonSurface = moon.position.x - MOON_RADIUS * k;
          ctx.setLine(gapLine, [[earthSurface, lowY, 0], [moonSurface, lowY, 0]]);
          gapLabel.userData.draw([`Surface to surface: ${fmt(gap)} km`]);
          const lined = smooth(p, 0.46, 0.52);
          const fits = total <= gap;
          ctx.fade(startGuide, lined * 0.45);
          ctx.fade(endGuide, lined * 0.9);
          endGuide.material.color.set(fits ? "#7dffb0" : "#ff7a6b");
          totalLabel.userData.draw([`Seven planets, edge to edge: ${fmt(total)} km`, fits ? `They fit — ${fmt(gap - total)} km to spare` : `${fmt(total - gap)} km too long`]);
          ctx.fade(totalLabel, lined);
          ctx.fade(earthLabel, smooth(p, 0, 0.04));
          ctx.fade(moonLabel, smooth(p, 0, 0.04));
          ctx.fade(gapLabel, smooth(p, 0.02, 0.07));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "scale-thirty-earths",
    section: "scale",
    title: "Thirty Earths to the Moon",
    place: "Between Earth and the Moon",
    kind: "ongoing",
    family: "scale",
    often: "always",
    detail: "The Moon looks close in pictures. Side by side, about thirty Earths fill the gap",
    frequency: "Always — the number swings from about 28 to 32 as the Moon's distance changes over the month",
    cause: "Pictures of Earth and the Moon together are almost never drawn to scale: the distance is shrunk so both fit. At the Moon's average distance, 384,400 km, you could line up 30.1 Earths (12,756 km wide) centre to centre.",
    note: "Light makes the trip in 1.3 seconds. The Apollo astronauts took about three days.",
    accuracy: "To true scale: the Earth–Moon line below and the row of Earth-wide slots above use the same kilometres per unit. Each Earth in the row is drawn a little smaller than its slot so they can be told apart; every slot is one full Earth wide.",
    art: { main: "earth", second: "moon", fx: "row" },
    scene(ctx) {
      /* layout */
      const W = ctx.halfWidth * 2 * 0.9;
      const k = W / (MOON_MEAN + EARTH_RADIUS + MOON_RADIUS);
      const x0 = -W / 2;
      const lowY = 0.02;
      const topY = 0.36;
      const D = EARTH_DIAMETER * k;
      ctx.light.set(-0.35, 0.45, 0.82).normalize();
      const earth = ctx.ball(EARTH_RADIUS * k, { body: "Earth", rim: 0.6, rimColour: "#7fb8ff" });
      earth.position.set(x0 + EARTH_RADIUS * k, lowY, 0);
      const moon = ctx.ball(MOON_RADIUS * k, { body: "Moon" });
      moon.position.set(earth.position.x + MOON_MEAN * k, lowY, 0);
      ctx.line([[earth.position.x, lowY, 0], [moon.position.x, lowY, 0]], { colour: "#7fd8ff", opacity: 0.45 });
      ctx.label(["Earth"], { at: [earth.position.x, lowY - 0.07, 0], height: 0.028, declutter: false });
      ctx.label(["The Moon", "384,400 km away"], { at: [moon.position.x - 0.03, lowY + 0.08, 0], height: 0.026, align: "right", declutter: false });
      ctx.circle(0.025, { plane: "xy", colour: "#cfd8e3", opacity: 0.8, segments: 48 }).position.copy(moon.position);
      /* Ends of the row carried down to Earth's and the Moon's centres. */
      ctx.line([[earth.position.x, topY, 0], [earth.position.x, lowY, 0]], { colour: "#9fb3c8", opacity: 0.35, dashed: true, dash: 0.02, gap: 0.015 });
      ctx.line([[moon.position.x, topY, 0], [moon.position.x, lowY, 0]], { colour: "#9fb3c8", opacity: 0.35, dashed: true, dash: 0.02, gap: 0.015 });
      /* 384,400 / 12,756 = 30.1: thirty whole Earths and a sliver, centre
       * of the first on Earth's centre. */
      const count = Math.floor(MOON_MEAN / EARTH_DIAMETER);
      const row = [];
      for (let i = 0; i <= count; i += 1) {
        const ball = ctx.ball(D * 0.38, { body: "Earth", segments: 32, rim: 0.4, rimColour: "#7fb8ff" });
        ball.position.set(earth.position.x + i * D, topY, 0);
        ball.visible = false;
        const tick = (i % 5 === 0 && i > 0)
          ? ctx.label([String(i)], { at: [ball.position.x, topY + 0.07, 0], height: 0.022, declutter: false })
          : null;
        if (tick) ctx.fade(tick, 0);
        row.push({ ball, tick });
      }
      const counter = ctx.label(["", ""], { at: [-0.2, -0.26, 0], height: 0.044, declutter: false });
      ctx.tell([
        { at: 0, label: "To scale", text: "Earth on the left, the Moon on the right, at its average distance of 384,400 km." },
        { at: 0.12, label: "Counting", text: "Above, Earths side by side, each in a slot 12,756 km wide — one Earth's width." },
        { at: 0.82, label: "About thirty", text: "Thirty Earths and a sliver of a thirty-first. Light crosses the gap in 1.3 seconds." },
      ]);
      return {
        duration: 20,
        update(p) {
          const shown = Math.round(count * smooth(p, 0.12, 0.78));
          row.forEach(({ ball, tick }, i) => {
            ball.visible = i <= shown;
            ball.rotation.y = ctx.t * 0.3 + i;
            if (tick) ctx.fade(tick, i <= shown ? 1 : 0);
          });
          earth.rotation.y = ctx.t * 0.3;
          counter.userData.draw([`${shown} Earth${shown === 1 ? "" : "s"} from Earth's centre`, shown >= count ? "≈ 30.1 to the Moon's centre" : ""]);
          ctx.fade(counter, smooth(p, 0.1, 0.16));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "scale-earths-in-sun",
    section: "scale",
    title: "1.3 million Earths inside the Sun",
    place: "The Sun",
    kind: "ongoing",
    family: "scale",
    often: "always",
    detail: "The Sun is 109 Earths wide — and by volume, it could swallow about 1.3 million of them",
    frequency: "Always — the Sun will barely change size for another few billion years",
    cause: "The Sun's radius is 695,700 km, 109.2 times Earth's. Volume grows with the cube of the width, so the Sun holds 109.2³ ≈ 1.3 million Earths.",
    note: "And it holds 99.86% of all the mass in the Solar System. Everything else — every planet, moon, asteroid and comet — is the last 0.14%.",
    accuracy: "Earth and the Sun to true scale; the circle beside Earth shows it magnified so it can be seen. The Sun is drawn white, its true colour above the air. The dots inside are a count, not a packing: each stands for about 217 Earths.",
    art: { main: "sun", second: "earth", fx: "fill" },
    scene(ctx) {
      /* Sun radius 695,700 km (IAU 2015 nominal); Earth 6,371 km. */
      const R = 0.6;
      const sunX = 0.3;
      const sunY = 0.1;
      const sun = ctx.sun(R, { ...WHITE_SUN, halo: 1.5, haloOpacity: 0.3 });
      sun.position.set(sunX, sunY, 0);
      const earthR = R * (6371 / 695700);
      const earthX = -0.78;
      const earth = ctx.ball(earthR, { body: "Earth", segments: 24 });
      earth.position.set(earthX, sunY, 0);
      const earthDot = ctx.glow("#8fc6ff", 0.05, { opacity: 0.9 });
      earthDot.position.copy(earth.position);
      /* A magnifier, so Earth reads as a planet and not as a ring. */
      const lens = new THREE.Vector3(earthX, sunY + 0.36, 0);
      const big = ctx.ball(0.11, { body: "Earth", rim: 0.7, rimColour: "#7fb8ff" });
      big.position.copy(lens);
      ctx.circle(0.14, { plane: "xy", colour: "#8fc6ff", opacity: 0.35 }).position.copy(lens);
      ctx.line([earth.position.clone().add(new THREE.Vector3(0, 0.02, 0)), lens.clone().add(new THREE.Vector3(0, -0.135, 0))], { colour: "#8fc6ff", opacity: 0.5, dashed: true, dash: 0.015, gap: 0.012 });
      ctx.label(["Earth", "true size: the dot below · here ×20"], { at: [earthX, sunY + 0.58, 0], height: 0.026, declutter: false });
      /* Lit from the Sun's side (the right), turned toward the viewer. */
      ctx.light.set(0.6, 0.2, 0.75).normalize();
      /* 109 Earth-wide dots across the Sun's diameter. */
      const across = ctx.cloud(109, { size: 3.4, additive: false });
      across.points.material.depthTest = false;
      for (let i = 0; i < 109; i += 1) {
        across.set(i, sunX - R + (i + 0.5) * ((2 * R) / 109), sunY, 0);
        across.tint(i, "#1f5cff");
        across.alpha[i] = 0;
      }
      across.commit();
      /* 6,000 dots for the volume: 1,300,000 / 6,000 ≈ 217 Earths a dot. */
      const N = 6000;
      const dots = ctx.cloud(N, { size: 2.6, additive: false });
      dots.points.material.depthTest = false;
      const random = rng(11);
      for (let i = 0; i < N; i += 1) {
        const v = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
        const d = Math.cbrt(random()) * R * 0.96;
        v.multiplyScalar(d);
        dots.set(i, sunX + v.x, sunY + v.y, v.z);
        dots.tint(i, "#1f5cff");
        dots.alpha[i] = 0;
      }
      dots.commit();
      const counter = ctx.label(["", ""], { at: [-0.5, -0.45, 0], height: 0.036, declutter: false });
      ctx.tell([
        { at: 0, label: "Side by side", text: "The Sun and Earth to one scale. Earth is the dot on the left — magnified in the circle above it." },
        { at: 0.14, label: "109 across", text: "Line Earths up across the Sun's face: 109 of them." },
        { at: 0.42, label: "Filling it", text: "By volume it holds 109 × 109 × 109 Earths: about 1.3 million. Each blue dot stands for 217." },
        { at: 0.86, label: "99.86%", text: "And it holds 99.86% of the Solar System's mass — every planet together is the rest." },
      ]);
      return {
        duration: 20,
        update(p) {
          const a = Math.floor(109 * smooth(p, 0.14, 0.38));
          for (let i = 0; i < 109; i += 1) across.alpha[i] = i < a ? 0.95 * (1 - smooth(p, 0.42, 0.5)) : 0;
          across.commit();
          const shown = Math.floor(N * smooth(p, 0.42, 0.84));
          for (let i = 0; i < N; i += 1) dots.alpha[i] = i < shown ? 0.85 : 0;
          dots.commit();
          sun.rotation.y = ctx.t * 0.04;
          big.rotation.y = ctx.t * 0.3;
          const earths = Math.round(1300000 * smooth(p, 0.42, 0.84));
          counter.userData.draw(p < 0.42 ? [`${a} Earths across`, ""] : [`${fmt(earths)} Earths`, "each blue dot = 217 Earths"]);
          ctx.fade(counter, smooth(p, 0.14, 0.18));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "scale-great-red-spot",
    section: "scale",
    body: "Jupiter",
    title: "A storm wider than Earth",
    place: "Jupiter · the Great Red Spot",
    kind: "ongoing",
    family: "scale",
    often: "watched since at least 1831",
    detail: "Jupiter's Great Red Spot is a storm wider than our whole planet — and it has been shrinking for 150 years",
    frequency: "Continuous. Seen without a break since 1831, possibly since 1665",
    cause: "A high-pressure storm (an anticyclone) wedged between two jet streams blowing in opposite directions, which keep feeding it spin. Jupiter has no solid ground to slow a storm down, so it lasts for centuries.",
    note: "In the 1880s it was about 40,000 km wide — three Earths side by side. By 2017 Juno and Hubble measured it at about 16,350 km: 1.3 Earths.",
    accuracy: "First the site's own Jupiter, turned so the Great Red Spot — where its real Cassini map has it — faces the Sun. Then the spot lifted out (its own picture, cut from that map) with Earths beneath it to one scale: its width as measured; the oval's height is illustrative.",
    art: { main: "jupiter", fx: "spot" },
    facesSun: true,
    /* A little from the south, so the spot at 21° S is near the middle. */
    shotPitch: -0.25,
    shotZoom: 1.05,
    scene(ctx) {
      /* The spot in the Cassini map (measured: u = 0.370, 21.0° S). The
       * site's Jupiter shader slides its map east by 0.0015 x uTime in u
       * (jupiter.js, "vUv.x + cloudTime * 0.0015"), so where the spot is on
       * the globe is worked out from that, every frame. */
      const GRS_U = 0.369;
      const GRS_LAT = -21;
      let surface = null;
      ctx.host.traverse((o) => { if (!surface && o.material?.uniforms?.uMap && o.material.uniforms.uTime) surface = o; });
      const drift = () => {
        const u = surface?.material?.uniforms;
        return 0.0015 * (u?.uTime?.value ?? 0) * (u?.uCloudMotion?.value ?? 1);
      };
      const lonAt = (s) => (((GRS_U - s) % 1) + 1) % 1 * 360 - 180;
      const s0 = drift();
      const lon0 = lonAt(s0);
      /* On the globe: a glowing ring round the spot (it is ~13° across on
       * Jupiter's 69,911-km radius) and its name, on a holder that follows
       * the map's slide. */
      const holder = new THREE.Group();
      ctx.onHost(holder);
      const ring = surfaceRibbon(surfaceRing(ctx, GRS_LAT, lon0, 9.5, 1.01), ctx.hostRadius() * 0.012, { colour: "#ffc46a", opacity: 0.95 });
      holder.add(ring);
      const spotCentre = new THREE.Object3D();
      spotCentre.position.copy(ctx.surfacePoint(GRS_LAT, lon0, 1.0));
      holder.add(spotCentre);
      const pin = new THREE.Group();
      pin.position.copy(ctx.surfacePoint(GRS_LAT - 16, lon0, 1.03));
      holder.add(pin);
      const pinLabel = ctx.label(["The Great Red Spot"], { parent: pin, height: 0.03, declutter: false });

      /* Lifted out, on black: the spot's own picture, in the middle. */
      const hud = ctx.hudLayer();
      /* 40,000 km = 1.2 hud units (layout). */
      const k = 1.2 / 40000;
      const spotY = 0.28;
      const spot = new THREE.Group();
      hud.add(spot);
      const crop = new THREE.TextureLoader().load(mapUrl("Jupiter"));
      crop.colorSpace = THREE.SRGBColorSpace;
      crop.repeat.set(0.066, 0.075);
      crop.offset.set(GRS_U - 0.033, (GRS_LAT + 90) / 180 - 0.0375);
      const fill = ctx.disc(0.5, { colour: "#ffffff", opacity: 1, parent: spot });
      fill.material.map = crop;
      fill.material.needsUpdate = true;
      const edge = ctx.circle(0.5, { plane: "xy", colour: "#ffc9a8", opacity: 0.7, parent: spot, additive: false });
      void edge;
      const swirl = ctx.cloud(500, { size: 2.2, parent: spot });
      swirl.points.material.depthTest = false;
      const rr = rng(4);
      const sw = Array.from({ length: 500 }, () => ({ a: rr() * TAU, d: Math.sqrt(rr()) }));
      sw.forEach((_, i) => swirl.tint(i, i % 3 ? "#f2b48a" : "#ffe1c4"));
      /* The Earths beneath it: 12,756 km each, side by side, to the same
       * scale as the spot's width. */
      const er = (EARTH_DIAMETER / 2) * k;
      const earthY = -0.42;
      const earths = [-1, 0, 1].map((i) => {
        const e = ctx.ball(er, { body: "Earth", rim: 0.8, rimColour: "#8fc6ff", parent: hud });
        e.position.set(i * er * 2, earthY, 0);
        return e;
      });
      /* The spot's two edges carried down to the Earths. */
      const leftEdge = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.85, parent: hud, dashed: true, dash: 0.025, gap: 0.018 });
      const rightEdge = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.85, parent: hud, dashed: true, dash: 0.025, gap: 0.018 });
      const width = ctx.label(["", ""], { parent: hud, at: [0, 0.78, 0], height: 0.036, declutter: false });
      const fitLabel = ctx.label([""], { parent: hud, at: [0, earthY - er - 0.08, 0], height: 0.03, declutter: false });
      const panel = [spot, ...earths, leftEdge, rightEdge, width, fitLabel];
      panel.forEach((o) => ctx.fade(o, 0));

      ctx.tell([
        { at: 0, label: "Jupiter", text: "The Great Red Spot, ringed, turned to face the Sun — a storm watched without a break since 1831." },
        { at: 0.3, label: "Lifted out", text: "The spot itself, cut from the same Cassini map Jupiter wears." },
        { at: 0.45, label: "The 1880s", text: "About 40,000 km across: three Earths could have fitted side by side." },
        { at: 0.8, label: "Today", text: "Juno and Hubble, 2017: about 16,350 km — only one Earth and a third." },
      ]);
      const world = new THREE.Vector3();
      const from = new THREE.Vector3();
      let blackout = false;
      let fromSet = false;
      return {
        duration: 22,
        update(p) {
          /* The ring follows the map's slide; the spot is turned sunward. */
          const s = drift();
          holder.rotation.y = -TAU * (s - s0);
          ctx.turnHostToward(GRS_LAT, lonAt(s), ctx.sunDir.clone().lerp(ctx.camDir, 0.5).normalize(), 0.12);
          const onGlobe = 1 - smooth(p, 0.3, 0.34);
          ctx.fade(ring, smooth(p, 0.03, 0.08) * (0.75 + 0.25 * Math.sin(ctx.t * 4)) * onGlobe);
          ctx.fade(pinLabel, smooth(p, 0.06, 0.11) * onGlobe);
          const toPanel = p > 0.31;
          if (toPanel !== blackout) {
            blackout = toPanel;
            ctx.setVeil(toPanel ? { blackout: true, keep: [ctx.hudAnchor()] } : null);
          }
          /* Where the spot is on screen, so the lifted copy starts there. */
          if (!toPanel || !fromSet) {
            spotCentre.getWorldPosition(world).project(ctx.camera);
            from.set(world.x * (ctx.camera.aspect || 1.6), world.y, 0);
            fromSet = toPanel;
          }
          /* After the blackout the hud's balls are lit from the front-left. */
          if (toPanel) {
            ctx.lightFollowsSun = false;
            ctx.light.set(-0.45, 0.4, 0.8).normalize().applyQuaternion(ctx.camera.quaternion);
          }
          const lift = easeInOut(span(p, 0.3, 0.42));
          const km = lerp(40000, 16350, easeInOut(span(p, 0.78, 0.92)));
          const w = lerp(0.12, km * k, lift);
          spot.position.set(lerp(from.x, 0, lift), lerp(from.y, spotY, lift), 0);
          spot.scale.set(w, w * 0.6, 1);
          ctx.fade(spot, smooth(p, 0.29, 0.32));
          for (let i = 0; i < 500; i += 1) {
            const q = sw[i];
            const ang = q.a + ctx.t * (0.4 - q.d * 0.25);
            swirl.set(i, Math.cos(ang) * q.d * 0.48, Math.sin(ang) * q.d * 0.48, 0.01);
            swirl.alpha[i] = 0.16;
          }
          swirl.commit();
          const inEarths = smooth(p, 0.44, 0.5);
          const half = (km * k) / 2;
          earths.forEach((e, i) => {
            e.rotation.y = ctx.t * 0.25 + i;
            const outside = Math.abs(e.position.x) + er > half + 0.01;
            ctx.fade(e, inEarths * (outside ? 0.28 : 1));
          });
          const top = spotY - (w * 0.6) / 2;
          ctx.setLine(leftEdge, [[-half * lift, top, 0], [-half * lift, earthY - er - 0.02, 0]]);
          ctx.setLine(rightEdge, [[half * lift, top, 0], [half * lift, earthY - er - 0.02, 0]]);
          ctx.fade(leftEdge, inEarths * 0.85);
          ctx.fade(rightEdge, inEarths * 0.85);
          const year = p < 0.78 ? "1880s" : String(Math.round(lerp(1880, 2017, easeInOut(span(p, 0.78, 0.92)))));
          width.userData.draw([`${year}: about ${fmt(Math.round(km / 50) * 50)} km across`, "the Great Red Spot, lifted out of Jupiter"]);
          ctx.fade(width, smooth(p, 0.36, 0.42));
          const fits = km / EARTH_DIAMETER;
          fitLabel.userData.draw([p < 0.78 ? "Three Earths fit across it" : fits > 2.9 ? "Three Earths fit across it" : `Now only ${fits.toFixed(1)} Earths`]);
          ctx.fade(fitLabel, inEarths);
        },
        dispose() { crop.dispose(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 5 */
  event({
    id: "scale-venus-day-year",
    section: "scale",
    body: "Sun",
    title: "A day on Venus is longer than its year",
    place: "Venus, round the Sun",
    kind: "ongoing",
    family: "orbit",
    often: "always",
    detail: "Venus turns once in 243 Earth days, but goes round the Sun in 225 — and it turns backwards",
    frequency: "Every orbit",
    cause: "Venus spins very slowly, and the wrong way: its sidereal day is 243.0 Earth days, retrograde, longer than its 224.7-day year. Why is not settled — the Sun's tides on its thick atmosphere, or an early giant impact, are the leading ideas.",
    note: "From sunrise to sunrise takes 116.75 days, because the slow backwards spin and the orbit add together. And the Sun rises in the west.",
    accuracy: "The site's own Venus, moved round its own orbit about the site's Sun and turned on its axis, both at their true rates against a clock sped up. Venus is about a pixel across at this distance, so the circle shows it magnified: the same Venus, turned the same way and lit from where the Sun really is. The red mark is a fixed spot on its ground; its sunrises are where the light really reaches it.",
    art: { main: "venus", second: "sun", fx: "orbit" },
    /* Looking down on the Sun, out to Venus's orbit (~221 units from the
     * Sun, whose own radius is 92). Drawing choices. */
    shotZoom: 5.8,
    shotPitch: 1.05,
    scene(ctx) {
      /* Sidereal rotation 243.025 d retrograde, orbit 224.701 d; solar day
       * 116.75 d (NASA Venus fact sheet). */
      const ROT = 243.025;
      const YEAR = 224.701;
      const venus = ctx.findBody("Venus");
      if (!venus?.parent) return { duration: 22, update() {} };
      const data = venus.userData;
      const parent = venus.parent;
      const M0 = data.meanAnomaly ?? data.angle ?? 0;
      const R0 = venus.rotation.y;
      const orbitRadius = data.orbitRadius ?? venus.position.length();
      const orbitAt = (M, target = new THREE.Vector3()) => setOrbitPosition(target, orbitRadius, data.orbitEccentricity ?? 0, M, data.orbitInclination ?? 0, data.orbitRotation ?? 0);
      const sunAt = ctx.host.getWorldPosition(new THREE.Vector3());
      parent.updateWorldMatrix(true, false);
      const parentQ = parent.getWorldQuaternion(new THREE.Quaternion());

      /* Its orbit, highlighted, in the frame the site moves it in; and the
       * stretch it has covered, brighter. */
      const extras = [];
      const orbitPoints = Array.from({ length: 361 }, (_, i) => orbitAt(M0 + (i / 360) * TAU));
      const orbitLine = ctx.line(orbitPoints, { colour: "#f2dca6", opacity: 0.5, parent });
      const trail = ctx.line(orbitPoints.slice(0, 2), { colour: "#ffd27f", opacity: 1, parent, additive: false });
      orbitLine.renderOrder = 30;
      trail.renderOrder = 31;
      extras.push(orbitLine, trail);

      /*
       * Which way it turns. The site tilts Venus over (3.1 rad), so the sense
       * of rotation.y is read off the geometry, and the spin is set against
       * the orbit's sense, as Venus's really is.
       */
      const eulerAt = (rotY) => new THREE.Euler(venus.rotation.x, rotY, venus.rotation.z, venus.rotation.order);
      const worldDir = (localDir, rotY, out = new THREE.Vector3()) => out.copy(localDir).applyEuler(eulerAt(rotY)).applyQuaternion(parentQ).normalize();
      const o0 = orbitAt(M0).applyQuaternion(parentQ);
      const o1 = orbitAt(M0 + 0.01).applyQuaternion(parentQ);
      const orbitSense = Math.sign(new THREE.Vector3().crossVectors(o0, o1).y) || 1;
      const probe = new THREE.Vector3(1, 0, 0);
      const spinSenseUp = Math.sign(new THREE.Vector3().crossVectors(worldDir(probe, R0), worldDir(probe, R0 + 0.01)).y) || 1;
      const spinSign = spinSenseUp === orbitSense ? -1 : 1;
      const meanAt = (days) => M0 + (days / YEAR) * TAU;
      const rotationAt = (days) => R0 + spinSign * (days / ROT) * TAU;

      /* The clock: still while Venus is found; a year and a day; then on
       * through more sunrises. */
      const daysAt = (p) => (p < 0.1 ? 0 : p < 0.62 ? 243 * span(p, 0.1, 0.62) : 243 + 120 * span(p, 0.62, 0.97));

      /* Finding it: a ring round the real Venus and its name. */
      const ringTex = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d");
        g.strokeStyle = "#ffd27f";
        g.lineWidth = 7;
        g.beginPath();
        g.arc(64, 64, 52, 0, TAU);
        g.stroke();
        return new THREE.CanvasTexture(c);
      })();
      const finder = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      finder.renderOrder = 40;
      ctx.root.add(finder);
      const venusName = ctx.label(["Venus"], { height: 0.032, declutter: false });
      ctx.label(["The Sun"], { at: [0, -1.35, 0], height: 0.03, declutter: false });

      /* The close-up: the same Venus, magnified, in a circle. */
      const hud = ctx.hudLayer();
      const IX = -ctx.halfWidth * 1.05;
      const IY = 0.36;
      const IR = 0.27;
      ctx.circle(IR, { plane: "xy", colour: "#ffd27f", opacity: 0.8, parent: hud, additive: false }).position.set(IX, IY, 0);
      const backing = ctx.disc(IR, { colour: "#000000", opacity: 0.85, parent: hud });
      backing.position.set(IX, IY, -0.01);
      const ball = ctx.ball(IR * 0.8, { body: "Venus", rim: 0.25, rimColour: "#ffe2a8", parent: hud });
      ball.position.set(IX, IY, 0.02);
      ctx.label(["Venus, magnified", "the red mark is a fixed spot on its ground"], { parent: hud, at: [IX, IY - IR - 0.08, 0], height: 0.024, declutter: false });
      /* The red mark, on the face that looks up at the camera. */
      const flipped = Math.cos(venus.rotation.z || 0) < 0;
      const markLocal = ctx.surfacePoint(flipped ? -28 : 28, 20, 1).normalize();
      const markDot = new THREE.Mesh(new THREE.SphereGeometry(IR * 0.8 * 0.09, 16, 12), new THREE.MeshBasicMaterial({ color: "#ff3b2e", toneMapped: false, transparent: true }));
      markDot.position.copy(markLocal).multiplyScalar(IR * 0.8 * 1.01);
      ball.add(markDot);
      const leader = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.55, parent: hud, dashed: true, dash: 0.02, gap: 0.016 });

      /* Readouts. */
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.72, 0], height: 0.038, declutter: false });
      const counts = ctx.label(["", ""], { parent: hud, at: [-0.3, -0.62, 0], height: 0.03, declutter: false });
      const rises = ctx.label(["", ""], { parent: hud, at: [IX, IY - IR - 0.26, 0], height: 0.026, colour: "#ffd9a8", declutter: false });
      [clock, counts, rises].forEach((o) => ctx.fade(o, 0));

      ctx.tell([
        { at: 0, label: "Finding Venus", text: "Venus, second from the Sun, on its own orbit — and, in the circle, magnified." },
        { at: 0.1, label: "Two clocks", text: "Its clock sped up: it really goes round the Sun, and really turns, both at their true rates." },
        { at: 0.5, label: "A year, then a day", text: "One year: 224.7 days. One turn on its axis, backwards: 243 — the day is longer than the year." },
        { at: 0.66, label: "Sunrise in the west", text: "Each time the red mark turns into the light, the Sun rises — in the west — about 117 days apart." },
      ]);

      ctx.lightFollowsSun = false;
      const venusWorld = new THREE.Vector3();
      const sunDir = new THREE.Vector3();
      const ndc = new THREE.Vector3();
      const hudQ = new THREE.Quaternion();
      const q = new THREE.Quaternion();
      const sunrises = [];
      let lastLit = null;
      return {
        duration: 22,
        update(p) {
          const days = daysAt(p);
          /* The real Venus: round its orbit and on its axis. */
          data.meanAnomaly = meanAt(days);
          venus.position.copy(orbitAt(data.meanAnomaly));
          venus.rotation.y = rotationAt(days);
          venus.updateMatrixWorld(true);
          venus.getWorldPosition(venusWorld);
          sunDir.copy(sunAt).sub(venusWorld).normalize();
          ctx.light.copy(sunDir);
          ctx.reframe();

          /* The orbit covered so far. */
          const n = Math.max(2, Math.min(361, Math.round((days / YEAR) * 360) + 1));
          ctx.setLine(trail, orbitPoints.slice(0, n));
          ctx.fade(trail, days > 0 ? 1 : 0);
          ctx.fade(orbitLine, smooth(p, 0.0, 0.05) * 0.5);

          /* The ring and name on the real Venus. */
          const local = venusWorld.clone().sub(sunAt).divideScalar(ctx.unit);
          finder.position.copy(local);
          finder.scale.setScalar(0.05 / ctx.unit);
          finder.material.opacity = 0.75 + 0.25 * Math.sin(ctx.t * 5);
          venusName.position.copy(local).add(new THREE.Vector3(0, 0.22, 0));
          ctx.fade(venusName, smooth(p, 0.01, 0.05));

          /* The close-up turned exactly as the real one, seen from here. */
          hud.getWorldQuaternion(hudQ).invert();
          q.setFromEuler(eulerAt(venus.rotation.y)).premultiply(parentQ).premultiply(hudQ);
          ball.quaternion.copy(q);
          /* A line from the circle to where Venus is on screen. */
          ndc.copy(venusWorld).project(ctx.camera);
          const vx = ndc.x * (ctx.camera.aspect || 1.6);
          const vy = ndc.y;
          const dir = new THREE.Vector2(vx - IX, vy - IY).normalize();
          ctx.setLine(leader, [[IX + dir.x * IR, IY + dir.y * IR, 0], [vx - dir.x * 0.05, vy - dir.y * 0.05, 0]]);

          /* Sunrise at the red mark, from where the Sun really is. */
          const lit = worldDir(markLocal, venus.rotation.y).dot(sunDir) > 0;
          if (lastLit === false && lit) sunrises.push(days);
          lastLit = lit;
          const on = smooth(p, 0.08, 0.12);
          ctx.fade(clock, on);
          ctx.fade(counts, on);
          clock.userData.draw([`Day ${Math.floor(days)}`, `at the red mark: ${lit ? "day" : "night"}`]);
          counts.userData.draw([
            `Round the Sun: ${(days / YEAR).toFixed(2)}${days >= YEAR ? " — one year" : ""}`,
            `Turned on its axis: ${(days / ROT).toFixed(2)}, backwards${days >= ROT ? " — one day" : ""}`,
          ]);
          const last = sunrises.slice(-2);
          rises.userData.draw(last.length === 2
            ? [`Sunrises on days ${Math.round(last[0])} and ${Math.round(last[1])}`, `${Math.round(last[1] - last[0])} days apart — in the west`]
            : last.length === 1 ? [`Sunrise at the red mark: day ${Math.round(last[0])}`, "the Sun comes up in the west"] : ["", ""]);
          ctx.fade(rises, last.length ? 1 : 0);
        },
        dispose() {
          extras.forEach((o) => { o.parent?.remove(o); o.geometry?.dispose(); o.material?.dispose(); });
          ringTex.dispose();
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "scale-olympus-everest",
    section: "scale",
    body: "Mars",
    title: "Olympus Mons and Everest",
    place: "Mars · Tharsis",
    kind: "ongoing",
    family: "scale",
    often: "always",
    detail: "The tallest volcano in the Solar System is about two and a half times the height of Everest — and as wide as France",
    frequency: "Always — it has been quiet for millions of years",
    cause: "Mars has no moving plates. On Earth, a volcano drifts off its hot spot and a chain of smaller ones forms; on Mars the crust stayed put over the same plume for hundreds of millions of years, and the lower gravity let the pile grow taller.",
    note: "Its slopes are so gentle — about 5° — that standing on them you would not know you were on a mountain. Its summit caldera alone is 80 km across.",
    accuracy: "Everest, then the site's own Mars turned to show Olympus Mons where its real map has it (18.6° N, 133.8° W), then the two as lit 3D landforms side by side. Heights are to one scale; widths are squeezed (Olympus Mons is about 600 km across). Their colours are taken from the site's own Earth and Mars maps at those places; Everest's snow is drawn above 5.5 km.",
    art: { main: "mars", fx: "mountain" },
    /* Opens on Everest, on black: the flight to Mars happens behind it. */
    startsDark: true,
    facesSun: true,
    shotSwing: 0.35,
    shotPitch: 0.3,
    shotZoom: 1.1,
    scene(ctx) {
      /* Olympus Mons: 18.65° N, 226.2° E (USGS); summit ~21.9 km above
       * Mars datum (MOLA, Plescia 2004); ~600 km across, basal cliffs up to
       * ~8 km, caldera ~3 km deep. Everest 8,849 m (2020 survey), 27.99° N,
       * 86.93° E. An airliner cruises at about 10.7 km (35,000 ft). */
      const LAT = 18.65;
      const LON = -133.8;
      /* On Mars: a glowing ring round the volcano and its name. */
      const ring = surfaceRibbon(surfaceRing(ctx, LAT, LON, 6.5, 1.012), ctx.hostRadius() * 0.014, { colour: "#ffc46a", opacity: 0.9 });
      ctx.onHost(ring);
      const pin = new THREE.Group();
      pin.position.copy(ctx.surfacePoint(LAT + 16, LON, 1.04));
      ctx.onHost(pin);
      const pinLabel = ctx.label(["Olympus Mons"], { parent: pin, height: 0.03, declutter: false });

      /* The comparison, in 3D, on black. layout: ground below the middle,
       * clear of the event card. */
      const hud = ctx.hudLayer();
      const G = -0.4;
      /* Heights to one scale: 21.9 km = 0.95 units. */
      const ky = 0.95 / 21.9;
      const stage = new THREE.Group();
      stage.position.set(0, G, 0);
      stage.rotation.x = 0.2;
      hud.add(stage);
      const light = new THREE.Vector3(-0.65, 0.55, 0.5).normalize();
      /* A dusty Martian sky behind, fading up into black. */
      const sky = paintedPlane(ctx, 6, 1.6, 600, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.62, "rgba(70,40,26,0.55)");
        grad.addColorStop(0.92, "rgba(150,96,62,0.75)");
        grad.addColorStop(1, "rgba(120,70,44,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }, { parent: hud });
      sky.position.set(0, G + 0.45, -1.2);
      sky.renderOrder = 15;
      const ground = terrain({
        width: 6, depth: 2.6, segments: [180, 80],
        height: (x, z) => 0.004 * fbm(x * 9, z * 9),
        map: mapUrl("Mars"), rect: [0.02, 0.57, 0.05, 0.05], /* Amazonis Planitia, plain ground west of the volcano */
        colour: [0.55, 0.3, 0.18], light, fadeEdge: 0.3, snowAbove: Infinity,
      });
      stage.add(ground);
      ground.renderOrder = 16;
      /* Olympus Mons: a broad shield, a cliff at its foot, a caldera. Its
       * colours come from the Mars map around 18.6° N, 133.8° W. */
      const OR = 0.92;
      const olympus = terrain({
        width: OR * 2.3, depth: OR * 2.3, segments: [170, 170],
        height: (x, z) => {
          const r = Math.hypot(x, z) / OR;
          if (r > 1.02) return 0;
          let h;
          if (r > 0.9) h = 0.32 * smoothStep(1.02, 0.9, r);
          else h = 0.32 + 0.68 * (1 - Math.pow(r / 0.9, 1.5));
          if (r < 0.1) h -= 0.13 * (1 - Math.pow(r / 0.1, 4));
          const a = Math.atan2(z, x);
          h += 0.005 * Math.sin(a * 46 + r * 9) * (r > 0.12 && r < 0.9 ? 1 : 0) + 0.008 * fbm(x * 14, z * 14);
          return Math.max(0, h) * 21.9 * ky;
        },
        map: mapUrl("Mars"), rect: [0.12833 - 0.0178, 0.6036 - 0.0338, 0.0356, 0.0676],
        colour: [0.72, 0.38, 0.22], light, fadeEdge: 0.12, snowAbove: Infinity,
      });
      const OX = -0.05;
      olympus.position.set(OX, 0, 0);
      stage.add(olympus);
      /* Everest: a steep pyramid of three ridges among lower peaks, snow
       * above ~5.5 km. Colours from the Earth map around 28° N, 87° E. */
      const ER = 0.24;
      const everest = terrain({
        width: ER * 2.6, depth: ER * 2.6, segments: [120, 120],
        height: (x, z) => {
          const r = Math.hypot(x, z) / ER;
          if (r > 1.05) return 0;
          const a = Math.atan2(z, x);
          const ridge = 0.5 + 0.5 * Math.cos(3 * (a - 0.4));
          let h = Math.pow(Math.max(0, 1 - r), 1.35 - 0.45 * ridge);
          h += 0.18 * Math.max(0, 1 - Math.hypot(x / ER - 0.45, z / ER + 0.2) / 0.35);
          h += 0.05 * fbm(x * 30, z * 30) * (1 - r);
          return Math.max(0, Math.min(1, h)) * 8.849 * ky;
        },
        map: mapUrl("Earth"), rect: [0.74146 - 0.004, 0.65549 - 0.006, 0.008, 0.012],
        colour: [0.42, 0.38, 0.34], light, fadeEdge: 0.15, snowAbove: 5.5 * ky, heightScale: 1,
      });
      const EX = -Math.max(1.05, ctx.halfWidth * 1.12);
      everest.position.set(EX, 0, 0.05);
      stage.add(everest);
      const lineY = G + 10.7 * ky;
      const airline = ctx.line([[EX - 0.4, lineY, 0.3], [0.8, lineY, 0.3]], { colour: "#9fd0ff", opacity: 0.7, parent: hud, dashed: true, dash: 0.03, gap: 0.02 });
      const tags = {
        everest: ctx.label(["Everest", "8.85 km"], { parent: hud, at: [EX, G + 8.849 * ky + 0.12, 0.2], height: 0.03, declutter: false }),
        olympus: ctx.label(["Olympus Mons", "about 21.9 km high"], { parent: hud, at: [OX, G + 21.9 * ky + 0.12, 0.2], height: 0.03, declutter: false }),
        airline: ctx.label(["an airliner cruises here · 10.7 km"], { parent: hud, at: [0.8, lineY + 0.035, 0.3], height: 0.022, align: "right", declutter: false }),
        width: ctx.label(["about 600 km across · two and a half Everests high"], { parent: hud, at: [OX - 0.15, G - 0.22, 0.3], height: 0.026, declutter: false }),
        note: ctx.label(["Heights to scale · widths squeezed"], { parent: hud, at: [OX - 0.15, G - 0.32, 0.3], height: 0.022, colour: "#9fb3c8", declutter: false }),
      };
      const panel = [sky, ground, olympus, everest, airline, ...Object.values(tags)];
      panel.forEach((o) => ctx.fade(o, 0));
      let blackout = null;
      ctx.tell([
        { at: 0, label: "Everest", text: "The tallest mountain on Earth: 8,849 m above sea level." },
        { at: 0.27, label: "Olympus Mons, on Mars", text: "The ring marks it on the site's own Mars: the biggest volcano in the Solar System." },
        { at: 0.5, label: "Side by side", text: "About 21.9 km high — two and a half Everests — and some 600 km across." },
        { at: 0.7, label: "Why so big", text: "No moving plates: Mars's crust sat over one hot spot for ages, and the volcano kept growing." },
      ]);
      return {
        duration: 22,
        update(p) {
          /* Mars, between the two looks at the mountains: the volcano turned
           * toward the Sun (the camera is on the Sun's side). */
          ctx.turnHostToward(LAT, LON, ctx.sunDir.clone().lerp(ctx.camDir, 0.5).normalize(), 0.12);
          const onMars = smooth(p, 0.28, 0.32) * (1 - smooth(p, 0.48, 0.5));
          ctx.fade(ring, onMars * (0.75 + 0.25 * Math.sin(ctx.t * 4)));
          ctx.fade(pinLabel, onMars);
          const dark = p < 0.27 || p > 0.5;
          if (dark !== blackout) {
            blackout = dark;
            ctx.setVeil(dark ? { blackout: true, keep: [ctx.hudAnchor()] } : null);
          }
          const panelOn = dark ? 1 : 0;
          /* A slow turn, so they read as solid. Decorative. */
          stage.rotation.y = 0.12 * Math.sin(ctx.t * 0.25);
          ctx.fade(sky, panelOn);
          ctx.fade(ground, panelOn);
          /* First Everest alone, rising; then, after Mars, Olympus beside it. */
          everest.scale.y = Math.max(0.001, easeInOut(span(p, 0.02, 0.14)));
          ctx.fade(everest, panelOn);
          ctx.fade(tags.everest, panelOn * smooth(p, 0.12, 0.16));
          ctx.fade(tags.note, panelOn * smooth(p, 0.12, 0.16));
          olympus.scale.y = Math.max(0.001, easeInOut(span(p, 0.51, 0.66)));
          ctx.fade(olympus, p > 0.5 ? 1 : 0);
          ctx.fade(tags.olympus, smooth(p, 0.64, 0.68));
          ctx.fade(airline, smooth(p, 0.56, 0.6) * (p > 0.5 ? 1 : 0));
          ctx.fade(tags.airline, smooth(p, 0.58, 0.62) * (p > 0.5 ? 1 : 0));
          ctx.fade(tags.width, smooth(p, 0.67, 0.72));
        },
        dispose() { [ground, olympus, everest].forEach((m) => m.userData.texture?.dispose()); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 7 */
  event({
    id: "scale-valles-marineris",
    section: "scale",
    body: "Mars",
    title: "Grand Canyon of the Solar System",
    place: "Mars · Valles Marineris",
    kind: "ongoing",
    family: "scale",
    often: "always",
    detail: "Valles Marineris, the Solar System's grand canyon: about 4,000 km long — New York to Los Angeles — and up to 7 km deep",
    frequency: "Always — it has been there for billions of years",
    cause: "It was not cut by a river. As the Tharsis volcanoes swelled up beside it, they stretched and cracked Mars's crust; the cracks opened into rift valleys, and landslides — and perhaps water, long ago — widened them further. It runs along the equator for about a fifth of the way round Mars.",
    note: "The Grand Canyon in Arizona is 446 km long and about 1.8 km deep. Valles Marineris is nearly ten times longer and four times deeper; in places it is 200 km wide, and from one rim you could not see the other.",
    accuracy: "First the site's own Mars, turned so the canyon faces the Sun, traced where its real map has it (about 14° S, from 100° W to 35° W). Then the two canyons compared: lengths to one scale, and depths to another.",
    art: { main: "mars", fx: "canyon" },
    facesSun: true,
    shotSwing: 0.25,
    shotPitch: -0.15,
    shotZoom: 1.05,
    scene(ctx) {
      /* The trough's centre line, east longitude (USGS Mars nomenclature):
       * Noctis Labyrinthus ~100° W, Ius ~85° W, Melas/Coprates ~70–60° W,
       * Eos and Capri Chasma ~45–35° W. */
      const TRACE = [[-7, -100], [-8, -92], [-8.5, -85], [-10, -77], [-12, -70], [-13.5, -63], [-14, -57], [-13.5, -50], [-12.5, -44], [-11, -38], [-10, -33]];
      const CENTRE = [-12, -66];
      const points = TRACE.map(([la, lo]) => ctx.surfacePoint(la, lo, 1.012));
      const smoothPath = new THREE.CatmullRomCurve3(points).getPoints(200);
      const trace = surfaceRibbon(smoothPath, ctx.hostRadius() * 0.035, { colour: "#ffb050", opacity: 0.85 });
      ctx.onHost(trace);
      const pin = new THREE.Group();
      pin.position.copy(ctx.surfacePoint(CENTRE[0] - 6, CENTRE[1], 1.3));
      ctx.onHost(pin);
      const pinLabel = ctx.label(["Valles Marineris", "about 4,000 km"], { parent: pin, height: 0.03, declutter: false });
      /* The comparison panel. layout: lengths above, depths below, all left
       * of the event card. */
      const hud = ctx.hudLayer();
      const X0 = -0.95;
      /* Lengths to one scale: 4,200 km = 1.7 units. */
      const kL = 1.7 / 4200;
      const bar = (km, y, colour, words) => {
        const rect = ctx.shape([[0, -0.022], [1, -0.022], [1, 0.022], [0, 0.022]], { colour, opacity: 0.95, parent: hud });
        rect.position.set(X0, y, 0);
        rect.scale.x = 0.001;
        const label = ctx.label(words, { parent: hud, at: [X0, y + 0.065, 0], height: 0.026, align: "left", declutter: false });
        return { rect, label, km, y };
      };
      /* Valles Marineris ~4,000 km (USGS); New York–Los Angeles 3,940 km
       * great-circle; Grand Canyon 446 km long, ~1.8 km deep (US NPS). */
      const bars = [
        bar(4000, 0.62, "#ff8a5c", ["Valles Marineris, Mars", "about 4,000 km long"]),
        bar(3940, 0.42, "#9fd0ff", ["New York → Los Angeles", "3,940 km"]),
        bar(446, 0.22, "#ffd27f", ["Grand Canyon, Arizona", "446 km long"]),
      ];
      /* Depths, to one scale: 7 km = 0.42 units; widths are not to scale. */
      const kD = 0.42 / 7;
      const section = (x, w, depthKm, layers, words) => {
        const h = 0.56;
        const plane = paintedPlane(ctx, w, h, 700, (g, cw, ch) => {
          /* rock strata, top to bottom */
          layers.forEach((c, i) => {
            g.fillStyle = c;
            g.fillRect(0, (i / layers.length) * ch, cw, ch / layers.length + 1);
          });
          const shade = g.createLinearGradient(0, 0, 0, ch);
          shade.addColorStop(0, "rgba(0,0,0,0)");
          shade.addColorStop(1, "rgba(0,0,0,0.55)");
          g.fillStyle = shade;
          g.fillRect(0, 0, cw, ch);
          /* the canyon, cut out: steep walls, a flat-ish floor */
          const depth = (depthKm * kD) / h * ch;
          g.globalCompositeOperation = "destination-out";
          g.beginPath();
          g.moveTo(cw * 0.12, 0);
          for (let i = 0; i <= 60; i += 1) {
            const u = i / 60;
            const wall = Math.min(1, Math.sin(Math.PI * u) * 1.6);
            g.lineTo(cw * (0.12 + 0.76 * u), depth * Math.pow(wall, 0.8) + (i % 7 === 3 ? 2 : 0));
          }
          g.lineTo(cw * 0.88, 0);
          g.closePath();
          g.fill();
        }, { parent: hud });
        plane.position.set(x, -0.15 - h / 2, 0);
        const label = ctx.label(words, { parent: hud, at: [x, -0.15 - h - 0.07, 0], height: 0.026, declutter: false });
        const floor = ctx.line([[x - w * 0.38, -0.15 - depthKm * kD, 0.01], [x + w * 0.38, -0.15 - depthKm * kD, 0.01]], { colour: "#ffffff", opacity: 0.5, parent: hud, dashed: true, dash: 0.02, gap: 0.015 });
        return [plane, label, floor];
      };
      const marsCut = section(-0.42, 0.8, 7, ["#c46a3e", "#a9552e", "#8e4524", "#76391e", "#5e2c17"], ["Valles Marineris", "up to 7 km deep"]);
      const azCut = section(0.42, 0.62, 1.8, ["#d7884a", "#c06a3a", "#e2b07a", "#9a4f2c", "#7a5a48"], ["Grand Canyon", "about 1.8 km deep"]);
      const depthTags = [...marsCut, ...azCut];
      const panel = [...depthTags, ...bars.flatMap((b) => [b.rect, b.label])];
      panel.forEach((o) => ctx.fade(o, 0));
      let blackout = false;
      ctx.tell([
        { at: 0, label: "Mars", text: "Turned so the canyon faces the Sun: Valles Marineris runs along the equator, east of the Tharsis volcanoes." },
        { at: 0.36, label: "Length", text: "About 4,000 km — farther than New York to Los Angeles. The Grand Canyon is 446 km." },
        { at: 0.66, label: "Depth", text: "Up to 7 km deep: four Grand Canyons stacked." },
        { at: 0.84, label: "Not a river", text: "Torn open as the Tharsis volcanoes swelled beside it, then widened by landslides." },
      ]);
      return {
        duration: 22,
        update(p) {
          ctx.turnHostToward(CENTRE[0], CENTRE[1], ctx.sunDir.clone().lerp(ctx.camDir, 0.4).normalize(), 0.12);
          trace.userData.reveal(smooth(p, 0.06, 0.26));
          ctx.fade(trace, (0.8 + 0.2 * Math.sin(ctx.t * 4)) * (1 - smooth(p, 0.34, 0.37)));
          ctx.fade(pinLabel, smooth(p, 0.2, 0.26) * (1 - smooth(p, 0.34, 0.37)));
          const toPanel = p > 0.36;
          if (toPanel !== blackout) {
            blackout = toPanel;
            ctx.setVeil(toPanel ? { blackout: true, keep: [ctx.hudAnchor()] } : null);
          }
          bars.forEach((b, i) => {
            const grow = easeInOut(span(p, 0.38 + i * 0.07, 0.5 + i * 0.07));
            b.rect.scale.x = Math.max(0.001, b.km * kL * grow);
            ctx.fade(b.rect, smooth(p, 0.37, 0.4));
            ctx.fade(b.label, smooth(p, 0.38 + i * 0.07, 0.42 + i * 0.07));
          });
          const depth = smooth(p, 0.64, 0.72);
          depthTags.forEach((o) => ctx.fade(o, depth));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 8 */
  event({
    id: "scale-moon-receding",
    section: "scale",
    body: "Earth",
    title: "The Moon is leaving us",
    place: "Earth and the Moon",
    kind: "ongoing",
    family: "orbit",
    often: "3.8 cm every year",
    detail: "The Moon drifts 3.8 cm farther away every year, and Earth's day grows longer as it goes",
    frequency: "Continuous — measured to the millimetre since 1969 by bouncing lasers off reflectors left on the Moon",
    cause: "The Moon raises tides on Earth. Earth spins faster than the Moon orbits, so the tidal bulge is dragged ahead of the Moon and pulls it forward along its orbit — lifting it outward — while the Moon pulls back on the bulge and slows Earth's spin.",
    note: "1.4 billion years ago the day was about 18 hours long. The rate has not been steady: it depends on the shape of the oceans.",
    accuracy: "Played on the site's own Earth and Moon. The Moon is moved outward on its real orbit by today's rate (38,000 km per billion years, about 10% of its distance per billion years), sped up; the real rate has varied over Earth's history.",
    art: { main: "earth", second: "moon", fx: "orbit" },
    shotZoom: 5.5,
    shotPitch: 0.75,
    scene(ctx) {
      const moon = ctx.findBody("Moon");
      const pivot = moon?.parent ?? null;
      const home = moon ? moon.position.clone() : null;
      const extras = [];
      /* Rings in the Moon's own orbital plane: its pivot's frame. */
      const ringIn = (radius, colour, opacity, dashed) => {
        if (!pivot) return null;
        const r = ctx.circle(radius, { plane: "xz", colour, opacity, dashed, dash: 0.08, gap: 0.06, parent: pivot });
        extras.push(r);
        return r;
      };
      const radius0 = home ? home.length() : 2.83;
      const today = ringIn(radius0, "#7fb8ff", 0.5, true);
      const grown = ringIn(radius0, "#ffd27f", 0.9, false);
      const hud = ctx.hudLayer();
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.66, 0], height: 0.036, declutter: false });
      const key = ctx.label(["Dashed: the Moon's orbit today · gold: where it is heading"], { parent: hud, at: [0, -0.8, 0], height: 0.024, declutter: false });
      ctx.tell([
        { at: 0, label: "Today", text: "The Moon on its orbit round Earth — 384,400 km on average." },
        { at: 0.18, label: "Fast forward", text: "At 3.8 cm a year — the rate the lasers measure — the orbit grows 38,000 km every billion years." },
        { at: 0.72, label: "And the day", text: "As the Moon climbs, Earth's spin slows: the day lengthens by about 1.7 milliseconds a century." },
      ]);
      return {
        duration: 22,
        update(p) {
          const gyr = 1.5 * smooth(p, 0.18, 0.86);
          /* 3.8 cm/yr × 1e9 yr = 38,000 km per billion years. */
          const km = MOON_MEAN + 38000 * gyr;
          const factor = km / MOON_MEAN;
          if (moon && home) moon.position.copy(home).multiplyScalar(factor);
          if (grown) grown.scale.setScalar(factor);
          if (today) ctx.fade(today, smooth(p, 0.15, 0.22) * 0.5);
          clock.userData.draw([`+${gyr.toFixed(2)} billion years`, `the Moon at ${fmt(km)} km`]);
          ctx.fade(key, smooth(p, 0.2, 0.26));
        },
        dispose() {
          if (moon && home) moon.position.copy(home);
          extras.forEach((o) => { o.parent?.remove(o); o.geometry?.dispose(); o.material?.dispose(); });
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 9 */
  event({
    id: "scale-light-travel",
    section: "scale",
    title: "Sunlight is 8 minutes old",
    place: "From the Sun to Neptune",
    kind: "ongoing",
    family: "scale",
    often: "always",
    detail: "Light from the Sun takes 8 minutes 20 seconds to reach Earth — and over 4 hours to reach Neptune",
    frequency: "Always — you never see the Sun as it is, only as it was",
    cause: "Light travels at 299,792 km a second: one astronomical unit (149.6 million km) takes 499 seconds. Every planet sees the Sun as it was a little while ago.",
    note: "If the Sun vanished, Earth would keep orbiting — and seeing it shine — for 8 minutes 20 seconds. Gravity travels at the speed of light too.",
    accuracy: "The planets are placed on a stretched (logarithmic) distance line so all eight fit; the times are exact for each planet's average distance. The Sun is drawn white, its true colour above the air.",
    art: { main: "sun", fx: "pulse" },
    scene(ctx) {
      /* Semi-major axes, AU (NASA); 499.005 s per AU (IAU light time). */
      const AU = { Mercury: 0.387, Venus: 0.723, Earth: 1, Mars: 1.524, Jupiter: 5.203, Saturn: 9.537, Uranus: 19.19, Neptune: 30.07 };
      const LT = 499.005;
      const names = Object.keys(AU);
      const x0 = -ctx.halfWidth * 0.95;
      const x1 = ctx.halfWidth * 0.95;
      const at = (au) => lerp(x0 + 0.22, x1, Math.log10(au / 0.3) / Math.log10(30.07 / 0.3));
      /* layout: the line a little above the middle, clear of the card. */
      const Y = 0.16;
      const sun = ctx.sun(0.12, { ...WHITE_SUN, halo: 3 });
      sun.position.set(x0, Y, 0);
      ctx.line([[x0, Y, 0], [x1, Y, 0]], { colour: "#fff4e2", opacity: 0.2 });
      const timeText = (secs) => (secs < 3600
        ? `${pad2(secs / 60)} min ${pad2(secs % 60)} s`
        : `${Math.floor(secs / 3600)} h ${pad2((secs % 3600) / 60)} min`);
      const marks = names.map((name, i) => {
        const x = at(AU[name]);
        const ball = ctx.ball(["Jupiter", "Saturn"].includes(name) ? 0.045 : 0.026, { body: name });
        ball.position.set(x, Y, 0);
        const secs = AU[name] * LT;
        const label = ctx.label([name, timeText(secs)], { at: [x, Y + (i % 2 ? -1 : 1) * 0.13, 0], height: 0.026, declutter: false });
        ctx.fade(label, 0.35);
        return { x, ball, label, secs };
      });
      ctx.light.set(-1, 0.1, 0.35).normalize();
      const pulse = ctx.glow("#ffffff", 0.14, { opacity: 1 });
      pulse.position.y = Y;
      /* Anchored at its left edge, so the words "Light time" never move as
       * the numbers after them change. */
      const clock = ctx.label(["Light time 00 min 00 s"], { at: [-0.36, Y + 0.42, 0], height: 0.042, align: "left", declutter: false });
      ctx.tell([
        { at: 0, label: "Out from the Sun", text: "The planets on a stretched line, so all eight fit. One flash of light is about to leave the Sun." },
        { at: 0.1, label: "The flash", text: "299,792 km every second. Mercury after 3 minutes; Earth after 8 min 20 s." },
        { at: 0.55, label: "The giants", text: "Jupiter after 43 minutes, Saturn after 79." },
        { at: 0.8, label: "The edge", text: "Uranus after 2 h 40 min, Neptune after 4 h 10 min." },
      ]);
      const total = AU.Neptune * LT;
      return {
        duration: 22,
        update(p) {
          const u = span(p, 0.1, 0.95);
          const secs = total * Math.pow(u, 2.6);
          const au = secs / LT;
          pulse.position.x = au < 0.3 ? lerp(x0, at(0.3), au / 0.3) : at(au);
          ctx.fade(pulse, p > 0.1 && p < 0.97 ? 1 : 0);
          marks.forEach((m) => ctx.fade(m.label, secs >= m.secs ? 1 : 0.35));
          /* Whole seconds only, in a fixed-width form: the readout no longer
           * jumps about as its width changes. */
          clock.userData.draw([`Light time ${timeText(Math.floor(secs))}`]);
          sun.rotation.y = ctx.t * 0.2;
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 10 */
  event({
    id: "scale-photon-escape",
    section: "scale",
    title: "Sunlight's long way out",
    place: "Inside the Sun",
    kind: "ongoing",
    family: "scale",
    often: "always",
    detail: "Light made in the Sun's core spends tens of thousands of years bouncing its way out — then 8 minutes to Earth",
    frequency: "Continuous",
    cause: "The core makes energy by fusing hydrogen into helium. Through the dense radiative zone, light is absorbed and re-emitted countless times, each step in a random direction: a random walk. Estimates of the escape time run from about 10,000 to 170,000 years. Above that, the convective zone carries the energy up by boiling, in weeks.",
    note: "So the sunlight on your face today started out as energy in the core before the first farms, or even before the first humans left Africa.",
    accuracy: "A cut-away to scale in radius: core to 0.25, radiative zone to 0.7, convective zone to the surface. The zigzag paths are drawn far coarser than the real ones, whose steps are about a millimetre. The Sun is drawn white, its true colour above the air.",
    art: { main: "sun", fx: "zigzag" },
    scene(ctx) {
      /* layout: a flat cut-away on the left, Earth on the right, all above
       * the event card's corner. */
      const R = 0.6;
      const cx = -0.42;
      const cy = 0.1;
      const C = new THREE.Vector3(cx, cy, 0);
      /* The Sun's glow round the cut-away, white (its true colour). */
      const halo = ctx.glow("#fff4e6", R * 3.1, { opacity: 0.38 });
      halo.position.set(cx, cy, -0.02);
      const zone = (r, colour, z) => {
        const disc = ctx.disc(r, { colour, opacity: 1 });
        disc.position.set(cx, cy, z);
        return disc;
      };
      /* Zones (radius fraction): core < 0.25, radiative 0.25–0.7, convective
       * 0.7–1 (helioseismology; NASA). Drawing colours, white to warm. */
      zone(R, "#f2c68e", 0);
      zone(R * 0.7, "#fde8c8", 0.002);
      zone(R * 0.25, "#ffffff", 0.004);
      ctx.circle(R, { plane: "xy", colour: "#fff6ea", opacity: 0.9, additive: false }).position.set(cx, cy, 0.006);
      ctx.circle(R * 0.7, { plane: "xy", colour: "#c98a4a", opacity: 0.5, additive: false }).position.set(cx, cy, 0.006);
      ctx.circle(R * 0.25, { plane: "xy", colour: "#d9a060", opacity: 0.6, additive: false }).position.set(cx, cy, 0.006);
      ctx.label(["Core", "15 million °C"], { at: [cx, cy - 0.04, 0.02], height: 0.022, colour: "#5a3a12", sub: "#7a5222", declutter: false });
      ctx.label(["Radiative zone"], { at: [cx, cy + R * 0.5, 0.02], height: 0.022, colour: "#6b4510", sub: "#6b4510", declutter: false });
      ctx.label(["Convective zone"], { at: [cx, cy + R * 0.86, 0.02], height: 0.022, colour: "#4a2806", sub: "#4a2806", declutter: false });
      /* Convection cells: loops turning in the outer zone. */
      const cells = [];
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * TAU;
        const loop = ctx.circle(R * 0.11, { plane: "xy", colour: "#a8601e", opacity: 0.7, from: 0, to: TAU * 0.78, additive: false });
        loop.position.set(cx + Math.cos(a) * R * 0.85, cy + Math.sin(a) * R * 0.85, 0.01);
        cells.push(loop);
      }
      /* Three photons on random walks out of the core, each with a trail. */
      const walks = [0, 1, 2].map((seed) => {
        const r = rng(23 + seed * 7);
        const path = [C.clone().setZ(0.012)];
        let pos = path[0].clone();
        while (Math.hypot(pos.x - cx, pos.y - cy) < R * 0.7 && path.length < 1400) {
          const a = r() * TAU;
          pos = pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0));
          /* a slight outward drift, so the walk ends inside the picture's time */
          const out = new THREE.Vector3(pos.x - cx, pos.y - cy, 0).normalize();
          pos.add(out.multiplyScalar(0.004));
          path.push(pos);
        }
        const trail = ctx.line(path.slice(0, 2), { colour: ["#d4500f", "#b8360a", "#e07a14"][seed], opacity: 0.95, additive: false });
        const head = ctx.glow("#ff9a2e", 0.08, { opacity: 1, additive: false });
        return { path, trail, head };
      });
      /* Earth, and light leaving the surface toward it. */
      const earthAt = new THREE.Vector3(ctx.halfWidth * 0.86, 0.3, 0);
      const earth = ctx.ball(0.05, { body: "Earth", rim: 0.6 });
      earth.position.copy(earthAt);
      ctx.label(["Earth"], { at: [earthAt.x, earthAt.y - 0.1, 0], height: 0.026, declutter: false });
      ctx.light.set(-1, -0.2, 0.4).normalize();
      const rays = Array.from({ length: 11 }, (_, i) => {
        const a = ((i - 5) / 5) * 0.55 + Math.atan2(earthAt.y - cy, earthAt.x - cx);
        const from = new THREE.Vector3(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 0.01);
        const ray = ctx.line([from, from], { colour: "#fff6e0", opacity: 0.85 });
        return { from, ray };
      });
      const clock = ctx.label([""], { at: [cx, cy - R - 0.14, 0], height: 0.036, declutter: false });
      ctx.tell([
        { at: 0, label: "The core", text: "Hydrogen fuses into helium at 15 million °C, and the energy leaves as light." },
        { at: 0.08, label: "The random walk", text: "In the radiative zone, light is absorbed and re-emitted endlessly, each time in a random direction." },
        { at: 0.56, label: "Boiling up", text: "Above 0.7 of the radius the Sun convects: hot gas rises and carries the energy up in weeks." },
        { at: 0.74, label: "8 minutes", text: "From the surface, the light reaches Earth in 8 minutes 20 seconds." },
      ]);
      return {
        duration: 22,
        update(p) {
          walks.forEach(({ path, trail, head }, i) => {
            const end = Math.max(2, Math.floor(path.length * smooth(p, 0.06 + i * 0.03, 0.56)));
            /* Only the last stretch of the path, so it reads as a trail. */
            ctx.setLine(trail, path.slice(Math.max(0, end - 220), end));
            const tip = path[end - 1];
            const hp = tip.clone();
            if (p > 0.56) {
              /* Carried up by convection, round a loop to the surface. */
              const rise = span(p, 0.56, 0.74);
              const out = new THREE.Vector3(tip.x - cx, tip.y - cy, 0).normalize();
              hp.set(cx, cy, 0.014).addScaledVector(out, lerp(R * 0.7, R, rise));
              hp.addScaledVector(new THREE.Vector3(-out.y, out.x, 0), Math.sin(rise * Math.PI) * 0.06);
            }
            head.position.copy(hp);
            ctx.fade(head, 1 - smooth(p, 0.74, 0.78));
            ctx.fade(trail, 0.95 * (1 - smooth(p, 0.6, 0.72)));
          });
          cells.forEach((c, i) => { c.rotation.z = ctx.t * (i % 2 ? 0.6 : -0.6); ctx.fade(c, 0.45 + 0.4 * smooth(p, 0.5, 0.6)); });
          const beam = span(p, 0.74, 0.94);
          rays.forEach(({ from, ray }) => {
            ctx.setLine(ray, [from, from.clone().lerp(earthAt, beam)]);
            ctx.fade(ray, beam > 0 ? 0.8 : 0);
          });
          earth.rotation.y = ctx.t * 0.4;
          const years = Math.round((100000 * smooth(p, 0.06, 0.56)) / 100) * 100;
          const secs = Math.floor(Math.min(500, beam * 500));
          clock.userData.draw([p < 0.56 ? `about ${fmt(years)} years` : p < 0.74 ? "a few weeks of convection" : `+ ${pad2(secs / 60)} min ${pad2(secs % 60)} s to Earth`]);
        },
      };
    },
  }),
];

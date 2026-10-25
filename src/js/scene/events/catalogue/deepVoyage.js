import * as THREE from "three";
import { smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { yawFor, cutter } from "./real.js";
import { pitchFor, holdShot, hudKit, leanLeft, toHud } from "./bodyKit.js";
import { celestialToVector } from "../../space/skyCatalogue.js";

/**
 * Round 88 (Prompts.md: the deep-sky events -- "we will travel space ... at
 * a great speed, light speed, to reach that star ... once it goes nova we
 * will see the explosion ... and then we will go back to the Solar System,
 * seeing the explosion happening from the Solar System"): the voyage every
 * deep-sky event shares.
 *
 *   home    the real Earth, the camera looking past it into the real sky
 *           (the site's own star map) toward the object, ringed and named
 *   out     the site goes dark and starlight streaks past, in colour, with
 *           faint glowing gas between (round 91: lightStreaks)
 *   map     where it is: the Milky Way from above, closing in on the Sun
 *           until the object stands apart (or, for an object in another
 *           galaxy, pulling away from ours)
 *   at      the object itself, in 3D, and what happens there
 *   back    the same, on the way home
 *   end     the real Earth again, the object now seen from home
 *
 * The universe is a group hung in front of the lens (in the kit's hud
 * holder, so it lives in the camera's frame and is cleared with the event);
 * a virtual camera set by view() moves through it. Its units are scene
 * units, chosen per object; everything stays inside the camera's near and
 * far planes (main.js: near up to 4.2, far 26,000).
 */

export const DEG = Math.PI / 180;
export const fmt = (n) => Math.round(n).toLocaleString("en-US");

/* ------------------------------------------------------------ coordinates */

/*
 * J2000 equatorial to galactic (l, b in degrees): the IAU rotation, north
 * galactic pole at RA 192.85948°, Dec +27.12825°, and the north celestial
 * pole at galactic longitude 122.93192° (Reid & Brunthaler 2004 values).
 */
export function toGalactic(raHours, decDeg) {
  const ra = raHours * 15 * DEG;
  const dec = decDeg * DEG;
  const raP = 192.85948 * DEG;
  const decP = 27.12825 * DEG;
  const lNCP = 122.93192 * DEG;
  const sb = Math.sin(dec) * Math.sin(decP) + Math.cos(dec) * Math.cos(decP) * Math.cos(ra - raP);
  const b = Math.asin(THREE.MathUtils.clamp(sb, -1, 1));
  const y = Math.cos(dec) * Math.sin(ra - raP);
  const x = Math.sin(dec) * Math.cos(decP) - Math.cos(dec) * Math.sin(decP) * Math.cos(ra - raP);
  const l = lNCP - Math.atan2(y, x);
  return { l: ((l / DEG) % 360 + 360) % 360, b: b / DEG };
}
/* The site's sky direction for RA (hours) / Dec (degrees) (skyCatalogue.js). */
export const skyDir = (ra, dec) => celestialToVector(ra, dec, new THREE.Vector3()).normalize();

/* ------------------------------------------------------------ the universe */

/*
 * A group in front of the lens with a virtual camera. view(eye, target, up)
 * sets the virtual camera; apply() each frame.
 */
export function universe(ctx) {
  const root = ctx.hudLayer();
  const holder = root.parent;
  const world = new THREE.Group();
  world.matrixAutoUpdate = false;
  world.name = "Space event: deep-sky universe";
  holder.add(world);
  /* A camera object, so lookAt points its -z at the target (a plain
   * Object3D would point +z and the view would face away). */
  const cam = new THREE.PerspectiveCamera();
  const eye = new THREE.Vector3(0, 0, 10);
  const look = new THREE.Vector3(0, 0, 0);
  const upV = new THREE.Vector3(0, 1, 0);
  const inv = new THREE.Matrix4();
  const shift = new THREE.Matrix4();
  const tmpD = new THREE.Vector3();
  return {
    world,
    holder,
    eye,
    look,
    view(e, t, u = null) {
      eye.copy(e);
      look.copy(t);
      upV.copy(u ?? new THREE.Vector3(0, 1, 0));
    },
    apply() {
      cam.position.copy(eye);
      cam.up.copy(upV);
      cam.lookAt(look);
      cam.updateMatrix();
      inv.copy(cam.matrix).invert();
      const d = Math.max(0.3, ctx.camera.near * 4);
      shift.makeTranslation(0, 0, d);
      world.matrix.copy(shift).multiply(inv);
      world.matrixWorldNeedsUpdate = true;
    },
    /* Hud position (x scaled by the aspect) of a universe point, through
     * the real lens's projection (it carries leanLeft's view offset), or
     * null if behind the virtual camera. */
    toHud(p, out = new THREE.Vector3()) {
      out.copy(p).applyMatrix4(inv);
      if (out.z >= -1e-3) return null;
      out.applyMatrix4(ctx.camera.projectionMatrix);
      return out.set(out.x * (ctx.camera.aspect || 1.6), out.y, 0);
    },
    /* How far a universe point is from the virtual camera. */
    depth(p) { return tmpD.copy(p).applyMatrix4(inv).length(); },
  };
}

/*
 * Round 91 (Prompts.md: "the earlier pattern ... lining white lines, keep
 * that but make it colourful, show faint gases as well in between
 * travelling stars ... use that pattern for all events"): the trip drawn
 * as streaks of starlight rushing past -- each star in its own colour (the
 * real spread of star colours, blue-white to orange-red, Harvard classes O
 * to M, with a few tinted by the gas they shine through) -- and faint
 * clouds of glowing gas drifting by between them in the colours nebulae
 * glow in: hydrogen red-pink (H-alpha, 656 nm), oxygen teal (O III,
 * 501 nm), reflection-nebula blue, dusty orange. A picture of speed, not
 * what the eye would see (round 90's relativistic sky was that; the owner
 * prefers this).
 *
 * Everything lives in the camera's own frame (the kit's hud holder): stars
 * in a tube round the line of travel, moving toward the camera and
 * starting again far ahead when they pass. drive(b, a): b 0..0.995, how
 * fast (the streaks lengthen as it rises); a the fade.
 */
const STREAK_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aEnd;
attribute float aBright;
uniform float uAlpha;
varying vec3 vC;
varying float vA;
void main() {
  vC = aColor;
  vA = (1.0 - aEnd) * aBright * uAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const STREAK_FRAGMENT = /* glsl */ `
varying vec3 vC;
varying float vA;
void main() {
  gl_FragColor = vec4(vC, vA);
  #include <colorspace_fragment>
}
`;
const GAS_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aBright;
uniform float uPx;
uniform float uAlpha;
varying vec3 vC;
varying float vA;
void main() {
  vC = aColor;
  vA = aBright * uAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx / max(1.0, -mv.z), 1.0, 512.0);
}
`;
const GAS_FRAGMENT = /* glsl */ `
varying vec3 vC;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * 9.0);
  gl_FragColor = vec4(vC, a * vA);
  #include <colorspace_fragment>
}
`;
const STAR_TINTS = [
  /* [colour, share]: O/B blue-white, A white, F/G yellow-white, K orange,
   * M orange-red, and a few seen through gas. */
  ["#9fbcff", 0.14], ["#cfdcff", 0.16], ["#ffffff", 0.18], ["#fff1cc", 0.16],
  ["#ffd29a", 0.13], ["#ff9f78", 0.09], ["#c8a0ff", 0.05], ["#8ff0ff", 0.05], ["#ff9ad0", 0.04],
];
const GAS_TINTS = ["#ff4a8a", "#ff6aa8", "#3ad8c8", "#5a7aff", "#a06aff", "#ff9a5a"];
const TUBE = 2600;
export function lightStreaks(ctx, U, { stars = 1800, gas = 110, seed = 3 } = {}) {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  U.holder.add(group);
  const r = rng(seed);
  const pick = () => {
    let x = r();
    for (const [c, w] of STAR_TINTS) { if (x < w) return c; x -= w; }
    return "#ffffff";
  };
  /* Stars: two vertices each (head, tail). */
  const S = Array.from({ length: stars }, () => {
    const a = r() * TAU;
    const rho = 14 + 260 * Math.sqrt(r());
    return { x: Math.cos(a) * rho, y: Math.sin(a) * rho, z: -20 - r() * TUBE, k: 0.4 + 0.6 * Math.pow(r(), 2), c: new THREE.Color(pick()) };
  });
  const sPos = new Float32Array(stars * 6);
  const sCol = new Float32Array(stars * 6);
  const sEnd = new Float32Array(stars * 2);
  const sBri = new Float32Array(stars * 2);
  S.forEach((o, i) => {
    sCol.set([o.c.r, o.c.g, o.c.b, o.c.r, o.c.g, o.c.b], i * 6);
    sEnd[i * 2 + 1] = 1;
  });
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3).setUsage(THREE.DynamicDrawUsage));
  sGeo.setAttribute("aColor", new THREE.BufferAttribute(sCol, 3));
  sGeo.setAttribute("aEnd", new THREE.BufferAttribute(sEnd, 1));
  sGeo.setAttribute("aBright", new THREE.BufferAttribute(sBri, 1).setUsage(THREE.DynamicDrawUsage));
  const sMat = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERTEX, fragmentShader: STREAK_FRAGMENT, uniforms: { uAlpha: { value: 1 } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const lines = new THREE.LineSegments(sGeo, sMat);
  lines.frustumCulled = false;
  lines.renderOrder = 6;
  group.add(lines);
  /* Gas: big soft clouds, farther out from the line of travel. */
  const G = Array.from({ length: gas }, () => {
    const a = r() * TAU;
    const rho = 60 + 520 * Math.sqrt(r());
    return { x: Math.cos(a) * rho, y: Math.sin(a) * rho, z: -40 - r() * TUBE, c: new THREE.Color(GAS_TINTS[Math.floor(r() * GAS_TINTS.length)]), s: 160 + 320 * r(), k: 0.4 + 0.6 * r() };
  });
  const gPos = new Float32Array(gas * 3);
  const gCol = new Float32Array(gas * 3);
  const gSize = new Float32Array(gas);
  const gBri = new Float32Array(gas);
  G.forEach((o, i) => { gCol.set([o.c.r, o.c.g, o.c.b], i * 3); gSize[i] = o.s; });
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage));
  gGeo.setAttribute("aColor", new THREE.BufferAttribute(gCol, 3));
  gGeo.setAttribute("aSize", new THREE.BufferAttribute(gSize, 1));
  gGeo.setAttribute("aBright", new THREE.BufferAttribute(gBri, 1).setUsage(THREE.DynamicDrawUsage));
  const gMat = new THREE.ShaderMaterial({
    vertexShader: GAS_VERTEX, fragmentShader: GAS_FRAGMENT, uniforms: { uAlpha: { value: 1 }, uPx: { value: 400 } },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const clouds = new THREE.Points(gGeo, gMat);
  clouds.frustumCulled = false;
  clouds.renderOrder = 5;
  const sizeV = new THREE.Vector2();
  clouds.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(sizeV);
    gMat.uniforms.uPx.value = (sizeV.y * camera.projectionMatrix.elements[5]) / 2;
  };
  group.add(clouds);
  /* The point we are heading for: a faint glow. */
  const ahead = ctx.glow("#dfe8ff", 1, { opacity: 1, parent: group });
  ahead.renderOrder = 5;
  let lastT = null;
  return {
    group,
    /* dir -1: run backwards (the trip home). */
    drive(b, a = 1, dir = 1) {
      const d = Math.max(0.3, ctx.camera.near * 4);
      group.matrix.makeTranslation(0, 0, d);
      group.matrixWorldNeedsUpdate = true;
      group.visible = a > 0.002;
      const t = ctx.t;
      const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (!group.visible) return;
      const k = clamp01(b / 0.995);
      const v = 2200 * k * k;
      const len = 6 + 420 * k * k * k;
      for (let i = 0; i < stars; i += 1) {
        const o = S[i];
        o.z += v * dt * dir;
        if (o.z > -12) o.z -= TUBE;
        if (o.z < -12 - TUBE) o.z += TUBE;
        const near = 1 - (-o.z) / TUBE;
        sPos[i * 6] = o.x; sPos[i * 6 + 1] = o.y; sPos[i * 6 + 2] = o.z;
        /* The tail trails behind the motion: away from us going out,
         * toward us coming home. */
        sPos[i * 6 + 3] = o.x; sPos[i * 6 + 4] = o.y; sPos[i * 6 + 5] = Math.min(-12, o.z - dir * len * (0.6 + 0.4 * o.k));
        const br = o.k * Math.pow(near, 1.3) * (0.35 + 0.65 * k);
        sBri[i * 2] = br;
        sBri[i * 2 + 1] = br;
      }
      sGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.aBright.needsUpdate = true;
      for (let i = 0; i < gas; i += 1) {
        const o = G[i];
        o.z += v * 0.55 * dt * dir;
        if (o.z > -30) o.z -= TUBE;
        if (o.z < -30 - TUBE) o.z += TUBE;
        gPos[i * 3] = o.x; gPos[i * 3 + 1] = o.y; gPos[i * 3 + 2] = o.z;
        const near = 1 - (-o.z) / TUBE;
        /* Faint, and gone before it would fill the view. */
        gBri[i] = 0.07 * o.k * Math.sin(Math.PI * near) * smooth(-o.z, 60, 260);
      }
      gGeo.attributes.position.needsUpdate = true;
      gGeo.attributes.aBright.needsUpdate = true;
      sMat.uniforms.uAlpha.value = a;
      gMat.uniforms.uAlpha.value = a * (0.4 + 0.6 * k);
      ahead.position.set(0, 0, -TUBE * 0.6);
      ahead.scale.setScalar(TUBE * 0.12);
      ctx.fade(ahead, a * 0.35 * k);
    },
  };
}

/* ------------------------------------------------------------ the Milky Way map */

/*
 * The Milky Way from outside: a barred spiral about 100,000 light-years
 * across, the Sun 26,700 light-years from the centre (GRAVITY
 * Collaboration 2019). Units: 1 = 50 light-years. The galactic centre is at
 * the origin, the disc in the x-z plane, north galactic pole +y; the Sun at
 * (+R0, 0, 0), so the direction to the centre (l = 0) is -x and l = 90°
 * (the way the Sun travels) is -z. Arms after the round-1 intro (four arms,
 * 12° pitch, the bar 27° to the Sun–centre line).
 */
export const LY_PER_UNIT = 50;
export const R0_LY = 26700;
export function galacticPosition(l, b, dLy) {
  const lr = l * DEG;
  const br = b * DEG;
  const k = dLy / LY_PER_UNIT;
  return new THREE.Vector3(R0_LY / LY_PER_UNIT - Math.cos(br) * Math.cos(lr) * k, Math.sin(br) * k, -Math.cos(br) * Math.sin(lr) * k);
}
export function milkyWay(ctx, parent, { count = 16000, seed = 21, size = 2 } = {}) {
  const g = new THREE.Group();
  parent.add(g);
  const R = 50000 / LY_PER_UNIT;
  const r = rng(seed);
  const cloud = ctx.cloud(count, { parent: g, size });
  const cCore = new THREE.Color("#ffd9a0");
  const cArm = new THREE.Color("#b8ccff");
  const cPink = new THREE.Color("#ff8fb8");
  const c = new THREE.Color();
  const pitch = Math.tan(12 * DEG);
  for (let i = 0; i < count; i += 1) {
    const kind = r();
    let x;
    let y;
    let z;
    if (kind < 0.1) {
      const t = (r() * 2 - 1) * R * 0.22;
      const w = (r() + r() - 1) * R * 0.06;
      const a = 27 * DEG;
      x = t * Math.cos(a) - w * Math.sin(a);
      z = t * Math.sin(a) + w * Math.cos(a);
      y = (r() + r() - 1) * R * 0.03;
      c.copy(cCore);
      cloud.alpha[i] = 0.06 + 0.16 * r();
    } else if (kind < 0.86) {
      const arm = Math.floor(r() * 4);
      const rr = R * (0.18 + 0.82 * Math.pow(r(), 0.7));
      const th = (arm * TAU) / 4 + Math.log(rr / (R * 0.18)) / pitch + (r() + r() + r() - 1.5) * 0.28;
      x = Math.cos(th) * rr;
      z = Math.sin(th) * rr;
      y = (r() + r() - 1) * R * 0.012;
      c.copy(cCore).lerp(cArm, Math.min(1, rr / (R * 0.5)));
      if (r() < 0.06) c.copy(cPink);
      cloud.alpha[i] = 0.25 + 0.5 * r();
    } else {
      const rr = R * Math.sqrt(r());
      const th = r() * TAU;
      x = Math.cos(th) * rr;
      z = Math.sin(th) * rr;
      y = (r() + r() - 1) * R * 0.02;
      c.copy(cArm).lerp(cCore, 0.3);
      cloud.alpha[i] = 0.12 + 0.25 * r();
    }
    cloud.set(i, x, y, z);
    cloud.tint(i, c);
    cloud.size[i] = size * (0.6 + r());
  }
  cloud.commit();
  const glow = ctx.glow("#ffd9a8", R * 0.5, { opacity: 0.3, parent: g });
  return { group: g, cloud, glow, R };
}

/* ------------------------------------------------------------ pictures */

/* A photograph hung in space, facing +z (turn it with lookAt). `w` wide;
 * additive, so the black of the photo is the black of space. */
export function picture(ctx, parent, url, w, { additive = true } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 12;
  mesh.scale.set(w, w, 1);
  mesh.visible = false;
  parent.add(mesh);
  new THREE.TextureLoader().load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
    mat.needsUpdate = true;
    const img = tex.image;
    if (img?.width) mesh.scale.set(w, (w * img.height) / img.width, 1);
  });
  const m4 = new THREE.Matrix4();
  return {
    mesh,
    show(a) { mat.opacity = a; mesh.visible = a > 0.002 && Boolean(mat.map); },
    /* Square on to the virtual camera, upright with it (lookAt alone
     * would roll it). Its parent must be unrotated in the universe. */
    face(U) {
      m4.lookAt(U.eye, U.look, new THREE.Vector3(0, 1, 0));
      mesh.quaternion.setFromRotationMatrix(m4);
    },
  };
}
const ASSET_ROOT = `${import.meta.env.BASE_URL}assets/deep-sky/`;
export const deepAsset = (file) => `${ASSET_ROOT}${encodeURIComponent(file)}`;

/* ------------------------------------------------------------ charts */

/*
 * A small chart on the hud: panel, axes, ticks, a curve drawn left to right
 * by show(u); fn(u) gives 0..1. Built in hud units at (x, y, w, h).
 *
 * Round 90 (Prompts.md: "graph charts ... overlay, instead align it with
 * the event info card on the right"): each frame the chart is moved and
 * scaled to sit just above the event card, its width the card's width --
 * or, where there is no room above (a short window), just left of the
 * card, level with its bottom. Labels keep their size on screen.
 */
const CARD_SELECTOR = ".solar-event-notice";
const CARD_GAP_PX = 10;
export function chart(ctx, H, { x, y, w, h, title, ticks = [], yTicks = [], colour = "#ffd27f", fn, samples = 220 }) {
  const group = new THREE.Group();
  H.root.add(group);
  const K = hudKit(ctx, group);
  const padL = yTicks.length ? 0.2 : 0.05;
  const box = { l: x - padL, r: x + w + 0.05, b: y - 0.09, t: y + h + 0.1 };
  const panel = K.shape([[box.l, box.b], [box.r, box.b], [box.r, box.t], [box.l, box.t]], { colour: "#030812", opacity: 0.8 });
  K.line([[x, y + h, 0], [x, y, 0], [x + w, y, 0]], { colour: "#7f93a8", opacity: 0.7, additive: false });
  /* A long title is set smaller to fit inside the panel (its width
   * estimated from its length: about one height a character, as
   * measured on the tick labels). */
  const room = box.r - box.l - 0.05;
  const titleH = Math.min(0.026, room / (Math.max(1, String(title).length) * 1.0));
  const titleL = K.label([title], { at: [x - padL + 0.03, y + h + 0.055, 0], align: "left", height: titleH, colour: "#cfe0f2", declutter: false });
  const words = [titleL];
  ticks.forEach(([u, text]) => { if (text) words.push(K.label([text], { at: [x + u * w, y - 0.05, 0], height: 0.018, colour: "#9fb3c8", declutter: false })); });
  yTicks.forEach(([v, text]) => words.push(K.label([text], { at: [x - 0.015, y + v * h, 0], align: "right", height: 0.018, colour: "#9fb3c8", declutter: false })));
  /* Labels keep their size on screen by themselves; the chart's must
   * shrink and grow with its panel, so their base sizes follow its scale. */
  const wordBase = words.map((l) => l?.userData?.baseScale?.clone());
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    const u = i / samples;
    return new THREE.Vector3(x + u * w, y + clamp01(fn(u)) * h, 0.01);
  });
  const curve = K.line(points.slice(0, 2), { colour, opacity: 1, additive: false });
  const head = K.glow(colour, 0.05, { opacity: 1 });
  /* Drawn over its own panel: the panel first, then everything on it. */
  group.traverse((o) => { if (o !== group) o.renderOrder = o === panel ? 41 : 42; });
  ctx.fade(group, 0);
  let placed = false;
  const place = () => {
    const card = typeof document !== "undefined" ? document.querySelector(CARD_SELECTOR) : null;
    const W = globalThis.innerWidth || 1600;
    const Hp = globalThis.innerHeight || 900;
    const rect = card?.getBoundingClientRect?.();
    const aspect = ctx.camera.aspect || W / Hp;
    if (!rect || rect.width < 10 || !card.classList.contains("is-visible")) {
      /* The card between two steps: stay where it last was (or, with no
       * card yet, off to the right where it will be). */
      if (!placed) { group.scale.setScalar(0.8); group.position.set(aspect * 0.55 - box.r * 0.8, -0.2 - box.b * 0.8, 0); }
      return;
    }
    placed = true;
    const px = 2 / Hp; /* hud units per pixel */
    const s = (rect.width * px) / (box.r - box.l);
    const heightPx = ((box.t - box.b) * s) / px;
    const above = rect.top - CARD_GAP_PX - heightPx > 64;
    api.side = above ? "above" : "left";
    group.scale.setScalar(s);
    words.forEach((l, i) => { if (wordBase[i]) l.userData.baseScale.copy(wordBase[i]).multiplyScalar(s); });
    if (above) {
      const left = (rect.left / W) * 2 * aspect - aspect;
      const bottom = 1 - (rect.top - CARD_GAP_PX) * px;
      group.position.set(left - box.l * s, bottom - box.b * s, 0);
    } else {
      const right = ((rect.left - CARD_GAP_PX) / W) * 2 * aspect - aspect;
      const bottom = 1 - rect.bottom * px;
      group.position.set(right - box.r * s, bottom - box.b * s, 0);
    }
  };
  const api = {
    group,
    side: "above",
    show(u, a = 1) {
      ctx.fade(group, a);
      if (a <= 0.002) return;
      place();
      const n = Math.max(2, Math.round(clamp01(u) * samples) + 1);
      K.setLine(curve, points.slice(0, n));
      curve.renderOrder = 42;
      head.position.copy(points[n - 1]);
    },
  };
  return api;
}

/*
 * Round 90 (Prompts.md: "nova explosion ... we have to glow the whole
 * screen, we are so near"): light filling the whole view, brightest in the
 * middle, for an explosion seen from close by. set(alpha, k): k runs the
 * colour from blue-white (the hottest first moments) through warm white
 * to orange-red as the fireball cools.
 */
let flashTexture = null;
export function screenFlash(ctx, H) {
  if (!flashTexture) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g2 = c.getContext("2d");
    const grad = g2.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.45, "rgba(255,255,255,0.8)");
    grad.addColorStop(1, "rgba(255,255,255,0.45)");
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 256, 256);
    flashTexture = new THREE.CanvasTexture(c);
  }
  const mat = new THREE.MeshBasicMaterial({ map: flashTexture, color: "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mat);
  mesh.renderOrder = 44;
  mesh.visible = false;
  H.root.add(mesh);
  const hot = new THREE.Color("#dfe9ff");
  const warm = new THREE.Color("#fff0d8");
  const cool = new THREE.Color("#ff7a4a");
  return {
    mesh,
    set(a, k = 0) {
      mat.opacity = a;
      mesh.visible = a > 0.002;
      if (k < 0.5) mat.color.copy(hot).lerp(warm, k / 0.5);
      else mat.color.copy(warm).lerp(cool, (k - 0.5) / 0.5);
    },
  };
}

/* ------------------------------------------------------------ the voyage */

const DEFAULT_PHASES = { out: 0.07, map: 0.15, at: 0.27, back: 0.86, end: 0.9 };

/*
 * Where the camera sits for the home shot: behind the real Earth, looking
 * past it toward the object so the object stands 18° above Earth in the
 * picture -- or, for an object far in the southern sky, below it (the
 * site's camera cannot look more than about 50° up or down: main.js caps an
 * event's pitch at 1.1 in its own measure, about 52° of elevation).
 * Returns the camera's offset direction from Earth.
 */
function homeAim(t) {
  const dec = Math.asin(THREE.MathUtils.clamp(t.y, -1, 1)) / DEG;
  let e = dec - 18;
  if (e < -50) e = Math.max(dec + 18, -50);
  e = THREE.MathUtils.clamp(e, -50, 50);
  const h = new THREE.Vector3(t.x, 0, t.z);
  if (h.lengthSq() < 1e-6) h.set(1, 0, 0);
  h.normalize();
  const fwd = h.multiplyScalar(Math.cos(e * DEG)).add(new THREE.Vector3(0, Math.sin(e * DEG), 0)).normalize();
  return fwd.negate();
}

/*
 * The shared journey. `cfg`:
 *   target   { name, short, ra, dec, ly, lyText, where, lightTime }
 *   extragalactic  the object is in another galaxy
 *   map      false for a place no one has found (a wormhole)
 *   mapView(q, U, { mw, sunPos, tgtPos })  a map camera of its own
 *   phases   { out, map, at, back, end } as fractions of the event
 *   build(U, ctx, H, site, tag) -> { update(q, p, dt, alpha), title(q), dispose }
 *            the object, drawn round the origin of the universe; q runs 0..1
 *            through the "at" phase; it sets the virtual camera (U.view)
 *   home(q)  the same, for the start (optional)
 *   end(q)   -> { glow, size, colour, label, title, ring } the object seen
 *            from home afterwards (size: its glow's width as a share of the
 *            view distance)
 *   tells    the card's captions
 */
export function voyage(ctx, cfg) {
  const earth = ctx.host;
  const P = { ...DEFAULT_PHASES, ...(cfg.phases ?? {}) };
  const T = cfg.target;
  /* A place no one has found (a wormhole) has no place in the sky: the
   * camera looks out along `look` instead and nothing is ringed. */
  const hasSky = Number.isFinite(T.ra);
  const t = hasSky ? skyDir(T.ra, T.dec) : skyDir(cfg.look?.ra ?? 6, cfg.look?.dec ?? 10);
  const fov0 = earth.userData.focusFov;
  earth.userData.focusFov = 50;
  const offset = homeAim(t);
  const R = Number(earth.userData.visualRadius) || 0.9;
  const shot = holdShot(ctx, "Earth", earth, { yaw: yawFor(offset), pitch: pitchFor(offset), distance: R * 4.6 });
  const lean = leanLeft(ctx, cfg.lean ?? 0.2);
  const cut = cutter(ctx, null);
  const U = universe(ctx);
  const warp = lightStreaks(ctx, U);
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const tag = (lines, opts = {}) => {
    const label = H.label(lines, { height: 0.04, declutter: false, ...opts });
    ctx.fade(label, 0);
    const tv = new THREE.Vector3();
    label.userData.at = (point, dx = 0, dy = 0.08, alpha = 1) => {
      const h = alpha > 0.002 ? U.toHud(point, tv) : null;
      if (!h) { ctx.fade(label, 0); return label; }
      label.position.set(h.x + dx, h.y + dy, 0);
      ctx.fade(label, alpha);
      return label;
    };
    return label;
  };
  const ly = T.lyText ?? `${fmt(T.ly ?? 0)} light-years`;

  /* Home: the object's place in the real sky. */
  const ring = H.circle(0.06, { plane: "xy", colour: "#ffe2a8", opacity: 1, additive: false });
  const nameL = H.label([T.name, `${T.where ? `${T.where} · ` : ""}${ly} away`], { height: 0.05, colour: "#ffe2a8", declutter: false });
  const skyStar = ctx.glow("#ffffff", 1, { opacity: 1, parent: U.holder });
  skyStar.renderOrder = 8;
  const phaseL = H.label(["", ""], { at: [-1.02, 0.7, 0], height: 0.058, align: "left", declutter: false });
  /* Round 93 (Prompts.md: "remove the wordings and keep simple
   * 'Travelling from the Sun to ...' ... and coming back 'Travelling back
   * to Earth'"): the trip's only words, in the title's place; the speed
   * readout is gone. */
  const outWords = ["Travelling from the Sun", `to ${T.short ?? T.name}`];
  const backWords = ["Travelling back to Earth", ""];
  /* A glow round the real Earth (gamma rays reaching its upper air, say),
   * for an ending that asks for one: root is centred on Earth, in units of
   * its drawn radius. */
  const aura = ctx.glow("#9fd0ff", 3.2, { opacity: 0.8 });
  ctx.fade(aura, 0);

  /* The map: the Milky Way, the Sun and the object. */
  const hasMap = cfg.map !== false;
  const map = new THREE.Group();
  U.world.add(map);
  const mw = milkyWay(ctx, map);
  const MK = hudKit(ctx, map);
  const sunPos = galacticPosition(0, 0, 0);
  const g = hasSky ? toGalactic(T.ra, T.dec) : { l: 0, b: 0 };
  const dirG = galacticPosition(g.l, g.b, LY_PER_UNIT).sub(sunPos).normalize();
  const lyMap = T.ly ?? 1000;
  const mapLy = cfg.extragalactic ? Math.min(lyMap, 3.5 * 50000) : lyMap;
  const tgtPos = sunPos.clone().addScaledVector(dirG, mapLy / LY_PER_UNIT);
  const sunDot = MK.glow("#ffe9a8", 14, { opacity: 1 });
  sunDot.position.copy(sunPos);
  const tgtDot = MK.glow(cfg.markColour ?? "#ff9a6a", 18, { opacity: 1 });
  tgtDot.position.copy(tgtPos);
  if (cfg.extragalactic) {
    const farGlow = MK.glow("#cfd8ff", 120, { opacity: 0.5 });
    farGlow.position.copy(tgtPos);
  }
  MK.line([sunPos, tgtPos], { colour: "#ffe2a8", opacity: 0.9, additive: false });
  /* Nearby stars round the Sun, for the close end of the map's zoom (a
   * drawing). */
  const local = cloudOfStars(ctx, map, sunPos, 4000 / LY_PER_UNIT);
  const sunL = tag(["The Sun"], { height: 0.034, colour: "#ffe9a8" });
  const tgtL = tag([T.short ?? T.name, cfg.extragalactic && lyMap > mapLy ? `${ly} — drawn much closer` : ly], { height: 0.044, colour: "#ffc8a8" });
  const mapNote = H.label(cfg.extragalactic ? ["Our galaxy, the Milky Way", "100,000 light-years across"] : ["The Milky Way, from above", "100,000 light-years across"], { at: [-1.02, -0.6, 0], height: 0.044, align: "left", declutter: false });

  /* The object. */
  const site = new THREE.Group();
  U.world.add(site);
  /* The stars behind the object (and for a black hole to bend). */
  if (cfg.stars !== false) backStars(ctx, site, cfg.starSeed ?? 5);
  const obj = cfg.build(U, ctx, H, site, tag) ?? {};
  ctx.tell(cfg.tells);
  [ring, nameL, phaseL, mapNote].forEach((o) => ctx.fade(o, 0));
  ctx.fade(map, 0);
  site.visible = false;
  /*
   * Shaders compile the first time something is drawn, which can stall a
   * frame (the ray-traced black hole most of all), and the event clock runs
   * on wall time. So for the first two frames everything in the universe
   * is drawn once, at whatever opacity it has (mostly none), from a virtual
   * camera looking away -- while the camera is still flying to Earth and
   * the clock is held -- and then put back.
   */
  let warm = 3;
  const saved = new Map();
  const warmUp = () => {
    if (warm <= 0) return;
    warm -= 1;
    if (warm > 0) {
      U.world.traverse((o) => {
        if (!saved.has(o)) saved.set(o, [o.visible, o.frustumCulled]);
        o.visible = true;
        o.frustumCulled = false;
      });
      U.view(new THREE.Vector3(0, 0, 20000), new THREE.Vector3(0, 0, 40000));
      U.apply();
    } else {
      saved.forEach(([v, f], o) => { o.visible = v; o.frustumCulled = f; });
      saved.clear();
    }
  };
  let lastT = ctx.t;
  let objLive = false;
  const qCam = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const far = new THREE.Vector3();
  const back = new THREE.Vector3();
  return {
    duration: cfg.duration ?? 60,
    update(p) {
      const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
      lastT = ctx.t;
      lean.apply();
      const home = p < P.out || p >= P.end;
      cut(!home);
      shot.keep();
      ctx.camera.updateMatrixWorld();
      /* The object in the real sky, and how it looks from home after. */
      const d = Math.max(0.3, ctx.camera.near * 4);
      qCam.copy(ctx.camera.quaternion).invert();
      tmp.copy(t).applyQuaternion(qCam);
      const ahead = tmp.z < 0;
      skyStar.position.copy(tmp).multiplyScalar(d * 0.9).add(back.set(0, 0, d));
      /* home(q): the same for the start (round 91: a new star appearing
       * in the sky, for "What is a nova?"). */
      const look = p >= P.end && cfg.end ? cfg.end(span(p, P.end, 1), p) : (p < P.out && cfg.home ? cfg.home(span(p, 0, P.out), p) : null);
      if (look && ahead) {
        skyStar.material.color.set(look.colour ?? "#ffffff");
        skyStar.scale.setScalar(Math.max(1e-5, d * 0.9 * (look.size ?? 0.03)));
        ctx.fade(skyStar, look.glow ?? 1);
      } else ctx.fade(skyStar, 0);
      far.copy(ctx.camera.position).addScaledVector(t, 1000);
      const h = toHud(ctx, far);
      ring.position.set(h.x, h.y, 0);
      /* The name beside the ring, never over it (Prompts.md round 90: the
       * words covered the circle): to its right, or to its left when the
       * ring is near the right edge of the clear area. */
      const leftSide = h.x > 0.35;
      nameL.center.set(leftSide ? 1 : 0, 0.5);
      nameL.position.set(h.x + (leftSide ? -0.1 : 0.1), h.y, 0);
      const marks = hasSky && home && ahead ? (p < P.out ? smooth(p, 0.004, 0.02) * (1 - smooth(p, P.out - 0.012, P.out)) : smooth(p, P.end + 0.01, P.end + 0.03)) : 0;
      ctx.fade(ring, marks * (look?.ring ?? 1));
      ctx.fade(nameL, marks);
      if (look?.label) nameL.userData.draw(look.label);
      if (look?.aura) aura.material.color.set(look.auraColour ?? "#9fd0ff");
      ctx.fade(aura, look?.aura ?? 0);
      /* Near the speed of light, out and home again: b rises to 0.995
       * (g = 10) and falls as we arrive. The readout gives the real cost:
       * the time that passes on Earth and on board at that speed. */
      let beta = 0;
      let wa = 0;
      let dir = 1;
      /* noTrip (a wormhole, which no one can travel to): no journey. */
      if (cfg.noTrip) {
        /* nothing */
      } else if (p >= P.out && p < P.map + 0.015) {
        const q = span(p, P.out, P.map);
        beta = 0.995 * Math.pow(Math.sin(Math.PI * clamp01(q * 0.92 + 0.04)), 0.55);
        wa = smooth(p, P.out, P.out + 0.012) * (1 - smooth(p, P.map - 0.008, P.map + 0.012));
      } else if (p >= P.back && p < P.end) {
        const q = span(p, P.back, P.end);
        beta = 0.995 * Math.pow(Math.sin(Math.PI * q), 0.55);
        wa = smooth(p, P.back, P.back + 0.01) * (1 - smooth(p, P.end - 0.01, P.end));
        /* Home again: the same view run backwards (Prompts.md: "when we
         * are coming back make it just reversal"). */
        dir = -1;
      }
      warp.drive(beta, wa, dir);
      /* The map. */
      const mapA = hasMap && p >= P.map && p < P.at ? win(p, P.map, P.at, 0.015) : 0;
      ctx.fade(map, mapA);
      if (mapA > 0) {
        const q = span(p, P.map, P.at);
        if (cfg.mapView) cfg.mapView(q, U, { mw, sunPos, tgtPos });
        else if (cfg.extragalactic) {
          const span3 = tgtPos.clone().sub(sunPos);
          const mid = sunPos.clone().lerp(tgtPos, 0.25 + 0.3 * easeInOut(q));
          const side = new THREE.Vector3(0, 1, 0).cross(span3).normalize();
          const reach = mw.R * 1.6 + span3.length() * (0.5 + 0.5 * easeInOut(q));
          U.view(mid.clone().addScaledVector(side, reach * 0.8).add(new THREE.Vector3(0, reach * 0.7, 0)), mid);
        } else {
          /* Wide (the whole galaxy) to close (a few times the distance). */
          const wide = mw.R * 2.3;
          const close = Math.max((lyMap / LY_PER_UNIT) * 3.2, 1600 / LY_PER_UNIT);
          const k = easeInOut(smooth(q, 0.35, 0.9));
          const dist = wide * Math.pow(close / wide, k);
          const centre = sunPos.clone().multiplyScalar(0.45).lerp(sunPos.clone().lerp(tgtPos, 0.5), k);
          /* From above the Sun's side of the galaxy, so the Sun sits low
           * in the picture and clear of the card. */
          const swing = 0.15 * q;
          U.view(centre.clone().add(new THREE.Vector3(0.5, 0.82, 0.18 + swing).normalize().multiplyScalar(dist)), centre);
        }
        U.apply();
        /* The galaxy's glow is a big sprite: from close in it would wash the
         * whole view (brown), so it goes as the view closes on the Sun. */
        mw.glow.visible = cfg.mapView || cfg.extragalactic ? true : q < 0.55;
        local.show(mapA * smooth(q, 0.45, 0.85));
        /* One label for both while they are too close on screen to tell
         * apart. */
        const hs = U.toHud(sunPos, new THREE.Vector3());
        const ht = U.toHud(tgtPos, new THREE.Vector3());
        const apart = hs && ht ? smooth(hs.distanceTo(ht), 0.08, 0.16) : 1;
        sunL.userData.draw(apart > 0.5 ? ["The Sun"] : ["The Sun", `and ${T.short ?? T.name}, ${ly} away`]);
        sunL.userData.at(sunPos, 0, -0.08, mapA);
        tgtL.userData.at(tgtPos, 0, 0.09, mapA * apart);
      } else {
        ctx.fade(sunL, 0);
        ctx.fade(tgtL, 0);
      }
      ctx.fade(mapNote, mapA * (1 - smooth(span(p, P.map, P.at), 0.4, 0.55)));
      /* The object. */
      const atA = p >= P.at && p < P.back ? win(p, P.at, P.back, 0.012) : 0;
      site.visible = atA > 0.002;
      if (p >= P.at - 0.01 && p < P.back + 0.01) {
        obj.update?.(span(p, P.at, P.back), p, dt, atA);
        U.apply();
        objLive = true;
      } else if (objLive) {
        /* Left between two frames: one last call so its labels on the hud
         * fade too (they stayed lit on the way home). */
        obj.update?.(clamp01(span(p, P.at, P.back)), p, dt, 0);
        objLive = false;
      }
      /* The title at the top left. */
      /* Round 90: no title at home or on the way (the ring and its name
       * say it); titles only where it is and at the object. */
      const titled = p >= P.map && p < P.back;
      if (titled) {
        phaseL.userData.draw(p < P.at ? (hasMap ? ["Where it is", ly] : (cfg.noMapTitle ?? ["Where is it?", "nowhere we know of"]))
          : (obj.title?.(span(p, P.at, P.back)) ?? [T.short ?? T.name, ly]));
        ctx.fade(phaseL, win(p, P.map, P.back, 0.012));
      } else if (wa > 0.002) {
        phaseL.userData.draw(dir > 0 ? outWords : backWords);
        ctx.fade(phaseL, wa);
      } else ctx.fade(phaseL, 0);
      warmUp();
    },
    dispose() {
      earth.userData.focusFov = fov0;
      lean.release();
      obj.dispose?.();
    },
  };
}

/* A sky of stars round the object, far off (9,000 units). */
function backStars(ctx, parent, seed, count = 2200) {
  const rr = rng(seed);
  const cloud = ctx.cloud(count, { parent, size: 1.7 });
  for (let i = 0; i < count; i += 1) {
    const d = new THREE.Vector3(rr() * 2 - 1, rr() * 2 - 1, rr() * 2 - 1);
    if (d.lengthSq() < 1e-4) d.set(0, 1, 0);
    d.normalize().multiplyScalar(9000);
    cloud.set(i, d.x, d.y, d.z);
    cloud.alpha[i] = 0.2 + 0.7 * Math.pow(rr(), 2);
    cloud.size[i] = 1.2 + 1.6 * rr();
    const k = rr();
    cloud.tint(i, k < 0.2 ? "#ffd2a8" : k < 0.4 ? "#bcd4ff" : "#f2f4ff");
  }
  cloud.commit();
  return cloud;
}

/* Stars round the Sun for the map's close end: a flattened ball. */
function cloudOfStars(ctx, parent, centre, r, count = 900) {
  const rr = rng(77);
  const cloud = ctx.cloud(count, { parent, size: 1.6 });
  for (let i = 0; i < count; i += 1) {
    const d = new THREE.Vector3(rr() * 2 - 1, (rr() * 2 - 1) * 0.35, rr() * 2 - 1).multiplyScalar(r).add(centre);
    cloud.set(i, d.x, d.y, d.z);
    cloud.alpha[i] = 0.25 + 0.5 * rr();
    cloud.tint(i, rr() < 0.7 ? "#ffd9b0" : "#cfe0ff");
  }
  cloud.commit();
  return { cloud, show(a) { cloud.opacity = a; cloud.points.visible = a > 0.002; } };
}

/* ------------------------------------------------------------ helpers for events */

/* A curve through points [[u, v], ...] (u, v in 0..1), eased between. */
export function curveThrough(points) {
  return (u) => {
    if (u <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i += 1) {
      if (u <= points[i][0]) {
        const [u0, v0] = points[i - 1];
        const [u1, v1] = points[i];
        const k = easeInOut((u - u0) / (u1 - u0));
        return v0 + (v1 - v0) * k;
      }
    }
    return points[points.length - 1][1];
  };
}

/* The virtual camera on a sphere round `centre`: yaw/pitch in radians. */
export function orbitView(U, centre, dist, yaw, pitch = 0.25) {
  U.view(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist).add(centre), centre);
}

export { smooth, win, span, lerp, clamp01, TAU, rng, easeInOut };

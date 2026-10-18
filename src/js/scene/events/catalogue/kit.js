import * as THREE from "three";
import { textSprite, declutterLabels, glow as glowTexture } from "../interstellarPassages.js";
import { TEXTURE_URLS } from "../../../config/textures.js";
import { STORY } from "./stories.js";

/**
 * The toolkit for the space events catalogue (round 79, the owner: "users
 * demanded more space events -- capture all of them").
 *
 * The first 24 events are each a hand-built module of several hundred lines.
 * A hundred and ten more at that weight would be thirty thousand lines, so
 * this file holds everything they share and each new event is a short scene
 * description written against it.
 *
 * Two kinds of stage:
 *
 *   "hud"   A diorama held in front of the lens, like a hologram: it turns
 *           with the camera, sits in the clear part of the screen (left of
 *           the event card) and is drawn in its own units, where 1 is half
 *           the height of the screen. Used for anything the scene cannot
 *           show at its own scale -- planets side by side, a star 6,500
 *           light-years away, an impact 66 million years ago. Staged with
 *           `body: null`, so the runner hosts it on the deep-sky anchor,
 *           which rides with the camera.
 *
 *   "body"  Drawn around a real body of the scene (Saturn, Mars, the Sun...)
 *           in world axes centred on it, so the body's own spin and scale do
 *           not reach the drawing, in units of the body's drawn radius.
 *
 * Every lit material here shades itself from one light direction given in
 * view space (`uLight`), which the runner updates every frame: the Sun's
 * direction for a body stage, a fixed studio light (or whatever the scene
 * sets) for a hud stage. The scene's own lights are not used -- the Sun is a
 * point light with physical falloff at the origin, and a diorama in front of
 * the lens would otherwise be lit by wherever the Sun happens to be.
 *
 * Cost: nothing until an event is staged; each stage is built on request and
 * disposed of when it ends, textures excepted (they are cached, a handful of
 * planet maps the scene has already loaded once).
 */

export const TAU = Math.PI * 2;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = THREE.MathUtils.lerp;
/** 0 before a, 1 after b, smooth between. */
export const smooth = (p, a, b) => THREE.MathUtils.smoothstep(p, a, b);
/** 1 between a and b, faded in and out over `fade` at each end. */
export const win = (p, a, b, fade = 0.04) => smooth(p, a, a + fade) * (1 - smooth(p, b - fade, b));
/** Progress mapped into [0, 1] across [a, b]. */
export const span = (p, a, b) => clamp01((p - a) / (b - a));
export const easeInOut = (t) => t * t * (3 - 2 * t);

export function rng(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const DPR = () => Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);

/* ---------------------------------------------------------------- textures */

/*
 * The planet maps the scene already uses (config/textures.js), loaded once
 * and shared. Neptune has no map (the scene draws it with a shader), and the
 * Sun's comes from a host the site cannot rely on, so both are drawn here
 * with colours and the sun shader instead.
 */
const MAP_KEYS = {
  Mercury: "mercury", Venus: "venusAtmosphere", "Venus surface": "venus", Earth: "earth",
  Moon: "moon", Mars: "mars", Jupiter: "jupiter", Saturn: "saturn", Uranus: "uranus",
  Pluto: "pluto", Haumea: "haumea", Eris: "eris", Makemake: "makemake",
  "Saturn ring": "saturnRing",
};
/* Mean colours for bodies drawn without a map (and while a map loads). */
export const BODY_COLOURS = {
  Sun: "#ffcf6b", Mercury: "#9c958e", Venus: "#e6cf9c", Earth: "#4f7fbf", Moon: "#a9a7a2",
  Mars: "#c1653b", Jupiter: "#d8b48a", Saturn: "#e3cf9b", Uranus: "#9fd6dc", Neptune: "#4b70dd",
  Pluto: "#cfb59a", Charon: "#9a948e", Ceres: "#8d8a86", Vesta: "#a39c90", Titan: "#d9a556",
  Io: "#e8d36a", Europa: "#cbbba3", Ganymede: "#9d958a", Callisto: "#6f665c", Triton: "#d8c4bb",
};
const loader = new THREE.TextureLoader();
const mapCache = new Map();
/** The URL of a body's map, for a scene that needs its own copy (a crop). */
export const mapUrl = (name) => TEXTURE_URLS[MAP_KEYS[name]] ?? null;
export function planetMap(name) {
  const key = MAP_KEYS[name];
  if (!key || !TEXTURE_URLS[key]) return null;
  if (!mapCache.has(key)) {
    const texture = loader.load(TEXTURE_URLS[key]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    mapCache.set(key, texture);
  }
  return mapCache.get(key);
}

/* ---------------------------------------------------------------- shaders */

const LIT_VERTEX = /* glsl */ `
varying vec3 vNormalView;
varying vec2 vUv;
varying vec3 vViewPosition;
void main() {
  vUv = uv;
  vNormalView = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
const LIT_FRAGMENT = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uColor;
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uNight;
uniform float uOpacity;
uniform vec3 uRimColor;
uniform float uRim;
uniform vec3 uEmissive;
uniform float uTint;
uniform vec3 uTintColor;
varying vec3 vNormalView;
varying vec2 vUv;
varying vec3 vViewPosition;
void main() {
  vec3 n = normalize(vNormalView);
  vec3 base = uColor;
  if (uHasMap > 0.5) base = texture2D(uMap, vUv).rgb * uColor;
  base = mix(base, uTintColor, uTint);
  float lambert = dot(n, normalize(uLight));
  float day = smoothstep(-0.08, 0.35, lambert);
  vec3 col = base * (uNight + (1.0 - uNight) * day);
  vec3 viewDir = normalize(vViewPosition);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  col += uRimColor * rim * uRim * (0.25 + 0.75 * day);
  col += uEmissive;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;

const SUN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uHot;
uniform float uOpacity;
uniform float uGranule;
varying vec3 vNormalView;
varying vec2 vUv;
varying vec3 vViewPosition;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec3 n = normalize(vNormalView);
  vec3 viewDir = normalize(vViewPosition);
  float mu = max(dot(n, viewDir), 0.0);
  float limb = 0.42 + 0.58 * pow(mu, 0.55);
  vec2 q = vUv * vec2(uGranule * 2.0, uGranule);
  float g = noise(q + uTime * 0.05) * 0.6 + noise(q * 2.3 - uTime * 0.04) * 0.4;
  vec3 col = mix(uColor, uHot, g * 0.55) * limb;
  gl_FragColor = vec4(col * 1.25, uOpacity);
  #include <colorspace_fragment>
}
`;

/* Particles: per-point colour, alpha and size in pixels. */
const POINT_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
attribute float aSize;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio;
}
`;
const POINT_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(c));
  gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;

/* ------------------------------------------------------------ the runner */

/**
 * Turns a scene description into the instance solarSystemEvents.js runs.
 *
 * `sceneFn(ctx)` builds what it needs with ctx's helpers and returns
 *   { duration, update(p, ctx) }
 * where p runs 0 to 1 over the event and ctx.t is real seconds since the
 * start (for spins and flickers that should not speed up with the clock).
 *
 * Options:
 *   mode       "hud" (default) or "body"
 *   distance   hud only: how far in front of the lens, in scene units
 *   backdrop   hud only: opacity of the soft dark disc behind the diorama
 *   veil       "system" or an array of names to hide while it runs
 */
export function stage(sceneFn, { mode = "hud", distance = 3, backdrop = 0.62, veil = null, blackout = true } = {}) {
  return (host, camera, options = {}, api = null) => {
    const group = new THREE.Group();
    group.name = "Space event (catalogue)";
    group.matrixAutoUpdate = false;
    const root = new THREE.Group();
    group.add(root);
    const lit = new Set();
    const suns = new Set();
    const labels = [];
    const allLabels = [];
    /*
     * A label keeps one size on screen (sizeAttenuation off), which three
     * works out from its world scale and the lens. So a label is rescaled
     * for whatever it hangs in -- the hud stage (scaled with its distance),
     * the hud layer of a body event, or a body's own frame -- to the size
     * it has in the hud at the designed distance of 3 with a 56-degree lens:
     * 3 / (parent's world scale x the projection's vertical factor).
     */
    function fitLabel(sprite) {
      const b = sprite.userData.baseScale;
      if (!b || !sprite.parent) return;
      sprite.parent.updateWorldMatrix(true, false);
      const S = sprite.parent.matrixWorld.getMaxScaleOnAxis() || 1;
      const P = camera.projectionMatrix.elements[5] || 1.88;
      const f = 3 / (S * P);
      sprite.scale.set(b.x * f, b.y * f, 1);
    }
    const scratch = new THREE.Vector3();
    const scratchQ = new THREE.Quaternion();
    const hostInverse = new THREE.Matrix4();
    const target = new THREE.Matrix4();
    const startedAt = performance.now();
    const unit = mode === "body" ? (Number(host?.userData?.visualRadius) || 1) : 1;

    const ctx = {
      mode, root, camera, api, options, host, unit, t: 0,
      /** Light direction in root space (hud) or world space (body). */
      light: new THREE.Vector3(-0.55, 0.45, 0.7).normalize(),
      /** Body stage: whether the light follows the Sun every frame. */
      lightFollowsSun: mode === "body",
      /** Direction to the Sun from the host, world axes (body stage). */
      sunDir: new THREE.Vector3(0, 0, 1),
      /** Direction to the camera from the host, world axes (body stage). */
      camDir: new THREE.Vector3(0, 0, 1),
      /** Body stage: the host's own north (its local +Y), world axes. */
      hostUp: new THREE.Vector3(0, 1, 0),
      /** Hud: half the width of the usable area, in hud units (height = 1). */
      halfWidth: 1,
      findBody: options.findBody ?? (() => null),
      stages: null,
      setStage: (s) => api?.setStage?.(s),
      setVeil: (w) => api?.setVeil?.(w),
      setZoom: (z) => api?.setZoom?.(z),
      /* Round 80: the camera's distance from the body, in scene units. */
      setZoomDistance: (d) => api?.setZoomDistance?.(d),
      /* Round 82: move the camera on to another real body mid-event, with
       * that body's shot ({ facesSun, shotZoom, shotPitch, shotSwing,
       * shotDistance }). */
      refocus: (name, shot) => api?.refocus?.(name, shot) ?? false,
      /* Round 82: the real Sun's { scale, tint }; null restores it. */
      setSunLook: (look) => api?.setSunLook?.(look),
      /* Round 83: the camera's azimuth (and elevation) round the focused
       * body, absolute, eased (main.js refocus has the same convention). */
      aim: (yawValue, pitchValue) => api?.aim?.(yawValue, pitchValue),
      /* Round 87: one of the site's real comets put `au` from the Sun on its
       * own orbit (its coma and tails follow), and back to today. */
      placeComet: (name, au, outbound = false) => api?.placeComet?.(name, au, outbound) ?? null,
      restoreComet: (name) => api?.restoreComet?.(name) ?? false,
    };

    /* ---- helpers, bound to this stage */

    ctx.add = (object, parent = root) => { parent.add(object); return object; };

    ctx.material = ({ colour = "#ffffff", map = null, night = 0.05, rim = 0, rimColour = "#9fd0ff", emissive = "#000000", opacity = 1, transparent = false, side = THREE.FrontSide, depthWrite = true } = {}) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: LIT_VERTEX,
        fragmentShader: LIT_FRAGMENT,
        uniforms: {
          uLight: { value: new THREE.Vector3(0, 0, 1) },
          uColor: { value: new THREE.Color(map ? "#ffffff" : colour) },
          uMap: { value: map },
          uHasMap: { value: map ? 1 : 0 },
          uNight: { value: night },
          uOpacity: { value: opacity },
          uRimColor: { value: new THREE.Color(rimColour) },
          uRim: { value: rim },
          uEmissive: { value: new THREE.Color(emissive) },
          uTint: { value: 0 },
          uTintColor: { value: new THREE.Color("#000000") },
        },
        transparent: transparent || opacity < 1,
        depthWrite,
        side,
        toneMapped: false,
        fog: false,
      });
      material.userData.lit = true;
      lit.add(material);
      return material;
    };

    /** A lit sphere. `body` names a planet whose map (and colour) to use. */
    ctx.ball = (radius, { body = null, colour, map, segments = 64, parent = root, ...rest } = {}) => {
      const useMap = map ?? (body ? planetMap(body) : null);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segments, Math.max(16, segments / 2)),
        ctx.material({ colour: colour ?? (body ? BODY_COLOURS[body] : "#cccccc"), map: useMap, ...rest }),
      );
      /* Round 79: a ball made translucent keeps that as its full opacity
       * under ctx.fade. */
      if (rest.opacity !== undefined) mesh.userData.baseOpacity = rest.opacity;
      mesh.raycast = () => {};
      mesh.renderOrder = 20;
      parent.add(mesh);
      return mesh;
    };

    /** A glowing star surface, with a halo. */
    ctx.sun = (radius, { colour = "#ffb54a", hot = "#fff3c4", halo = 3.2, haloColour = "#ffb347", haloOpacity = 0.55, granule = 18, parent = root } = {}) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: LIT_VERTEX,
        fragmentShader: SUN_FRAGMENT,
        uniforms: {
          uTime: { value: 0 }, uColor: { value: new THREE.Color(colour) }, uHot: { value: new THREE.Color(hot) },
          uOpacity: { value: 1 }, uGranule: { value: granule },
        },
        transparent: true, toneMapped: false, fog: false,
      });
      suns.add(material);
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), material);
      mesh.raycast = () => {};
      mesh.renderOrder = 20;
      parent.add(mesh);
      if (halo > 0) {
        const sprite = ctx.glow(haloColour, radius * halo, { opacity: haloOpacity, parent: mesh });
        mesh.userData.halo = sprite;
      }
      return mesh;
    };

    /** A lumpy rock: an icosphere pushed in and out by smooth noise. */
    ctx.rock = (radius, { seed = 7, lumps = 0.22, stretch = [1, 1, 1], colour = "#8c8378", detail = 4, parent = root, ...rest } = {}) => {
      const geometry = new THREE.IcosahedronGeometry(radius, detail);
      const position = geometry.attributes.position;
      const r = rng(seed);
      const bumps = Array.from({ length: 9 }, () => ({
        d: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
        a: (r() - 0.35) * lumps,
        w: 1.2 + r() * 3.5,
      }));
      const v = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 1) {
        v.fromBufferAttribute(position, i).normalize();
        let k = 1;
        bumps.forEach((b) => { k += b.a * Math.exp(-b.w * (1 - v.dot(b.d))); });
        k += (Math.sin(v.x * 9.1 + seed) * Math.sin(v.y * 7.3) * Math.sin(v.z * 8.7)) * lumps * 0.12;
        v.multiplyScalar(radius * k);
        position.setXYZ(i, v.x * stretch[0], v.y * stretch[1], v.z * stretch[2]);
      }
      geometry.computeVertexNormals();
      /* Round 79: smooth shading. The icosphere has a vertex per face
       * corner, so its normals are per facet; average them over corners
       * that share a position (the geometry stays non-indexed). */
      const normal = geometry.attributes.normal;
      const sums = new Map();
      const keyOf = (i) => `${Math.round(position.getX(i) * 1e5)},${Math.round(position.getY(i) * 1e5)},${Math.round(position.getZ(i) * 1e5)}`;
      for (let i = 0; i < position.count; i += 1) {
        const key = keyOf(i);
        const sum = sums.get(key) ?? new THREE.Vector3();
        sum.x += normal.getX(i); sum.y += normal.getY(i); sum.z += normal.getZ(i);
        sums.set(key, sum);
      }
      for (let i = 0; i < position.count; i += 1) {
        const n = sums.get(keyOf(i)).clone().normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
      normal.needsUpdate = true;
      const mesh = new THREE.Mesh(geometry, ctx.material({ colour, night: 0.06, ...rest }));
      mesh.raycast = () => {};
      mesh.renderOrder = 20;
      parent.add(mesh);
      return mesh;
    };

    /** A flat ring (planetary rings, discs), in the XZ plane. */
    ctx.ring = (inner, outer, { colour = "#e8dcc0", opacity = 0.8, map = null, segments = 128, parent = root, additive = false } = {}) => {
      const geometry = new THREE.RingGeometry(inner, outer, segments, 1);
      /* Radial UVs, so a 1D ring texture (the Saturn ring map) runs outward. */
      const pos = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      for (let i = 0; i < pos.count; i += 1) {
        const rr = Math.hypot(pos.getX(i), pos.getY(i));
        uv.setXY(i, (rr - inner) / (outer - inner), 0.5);
      }
      geometry.rotateX(-Math.PI / 2);
      const material = new THREE.MeshBasicMaterial({
        color: colour, map, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.raycast = () => {};
      mesh.renderOrder = 21;
      mesh.userData.baseOpacity = opacity;
      parent.add(mesh);
      return mesh;
    };

    /** A line through points (array of Vector3 or [x,y,z]). */
    ctx.line = (points, { colour = "#9fd0ff", opacity = 0.8, dashed = false, dash = 0.04, gap = 0.03, parent = root, additive = true } = {}) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
      const material = dashed
        ? new THREE.LineDashedMaterial({ color: colour, dashSize: dash, gapSize: gap, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false })
        : new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const line = new THREE.Line(geometry, material);
      if (dashed) line.computeLineDistances();
      line.frustumCulled = false;
      line.raycast = () => {};
      line.renderOrder = 22;
      line.userData.baseOpacity = opacity;
      parent.add(line);
      return line;
    };

    /** Replaces a line's points (same count or not). */
    ctx.setLine = (line, points) => {
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
      if (line.material.isLineDashedMaterial) line.computeLineDistances();
    };

    /** A circle of radius r: plane "xz" (orbits) or "xy" (facing the hud). */
    ctx.circle = (radius, { plane = "xz", segments = 192, from = 0, to = TAU, ...rest } = {}) => {
      const points = [];
      for (let i = 0; i <= segments; i += 1) {
        const a = from + ((to - from) * i) / segments;
        points.push(plane === "xz"
          ? new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a))
          : new THREE.Vector3(radius * Math.cos(a), radius * Math.sin(a), 0));
      }
      return ctx.line(points, rest);
    };

    /** An ellipse with the focus at the origin (orbits): a (semi-major), e. */
    ctx.orbit = (a, e = 0, { plane = "xz", segments = 256, rotate = 0, ...rest } = {}) => {
      const points = [];
      for (let i = 0; i <= segments; i += 1) {
        const nu = (i / segments) * TAU;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
        const x = r * Math.cos(nu + rotate);
        const y = r * Math.sin(nu + rotate);
        points.push(plane === "xz" ? new THREE.Vector3(x, 0, y) : new THREE.Vector3(x, y, 0));
      }
      return ctx.line(points, rest);
    };

    /** An arrow from a to b. */
    ctx.arrow = (from, to, { colour = "#ffd27f", opacity = 0.9, head = 0.05, parent = root } = {}) => {
      const a = from.isVector3 ? from.clone() : new THREE.Vector3(...from);
      const b = to.isVector3 ? to.clone() : new THREE.Vector3(...to);
      const holder = new THREE.Group();
      const line = ctx.line([a, b], { colour, opacity, parent: holder, additive: false });
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(head * 0.45, head, 12),
        new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false }),
      );
      cone.userData.baseOpacity = opacity;
      const dir = b.clone().sub(a).normalize();
      cone.position.copy(b);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cone.raycast = () => {};
      holder.add(cone);
      holder.userData.set = (f, t) => {
        const fa = f.isVector3 ? f : new THREE.Vector3(...f);
        const tb = t.isVector3 ? t : new THREE.Vector3(...t);
        ctx.setLine(line, [fa, tb]);
        cone.position.copy(tb);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tb.clone().sub(fa).normalize());
      };
      parent.add(holder);
      return holder;
    };

    /** A soft glow (world-sized sprite). */
    ctx.glow = (colour, size, { opacity = 0.8, parent = root, additive = true } = {}) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: colour, transparent: true, opacity, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
      }));
      sprite.scale.setScalar(size);
      sprite.renderOrder = 26;
      sprite.raycast = () => {};
      sprite.userData.baseOpacity = opacity;
      parent.add(sprite);
      return sprite;
    };

    /**
     * A label that keeps its size on screen. `lines` is a string or
     * [title, subtitle...]. `height` is the share of the screen's height.
     * `align` "left" (anchor at its left edge), "center" or "right".
     */
    ctx.label = (lines, { height = 0.034, colour = "#e8f1ff", sub = "#9fb3c8", align = "center", at = null, parent = root, opacity = 1, declutter = true } = {}) => {
      const sprite = textSprite(lines, { colour, sub, height });
      sprite.center.set(align === "left" ? 0 : align === "right" ? 1 : 0.5, 0.5);
      sprite.material.opacity = opacity;
      sprite.userData.baseOpacity = 1;
      sprite.raycast = () => {};
      if (at) sprite.position.copy(at.isVector3 ? at : new THREE.Vector3(...at));
      parent.add(sprite);
      if (declutter) labels.push(sprite);
      /* Round 79: a label's size on screen must not grow with the stage's
       * distance (see frame()): its drawn scale is kept as `baseScale` and
       * every frame multiplied by ctx.labelScale. */
      const rawDraw = sprite.userData.draw;
      sprite.userData.draw = (text) => {
        /* Redrawn only when the words change: a label redrawn every frame
         * re-uploads its texture and flickers (Prompts.md, "Sunlight is 8
         * minutes old": "the timer flickers"). */
        const key = JSON.stringify(text);
        if (key === sprite.userData.lastText) return;
        sprite.userData.lastText = key;
        rawDraw(text);
        sprite.userData.baseScale = sprite.scale.clone();
        fitLabel(sprite);
      };
      sprite.userData.lastText = JSON.stringify(lines);
      sprite.userData.baseScale = sprite.scale.clone();
      fitLabel(sprite);
      allLabels.push(sprite);
      sprite.userData.text = (text) => sprite.userData.draw(text);
      return sprite;
    };

    /** A particle cloud: fill its arrays, then call commit(). */
    ctx.cloud = (count, { opacity = 1, additive = true, parent = root, size = 3 } = {}) => {
      const geometry = new THREE.BufferGeometry();
      const position = new Float32Array(count * 3);
      const colour = new Float32Array(count * 3).fill(1);
      const alpha = new Float32Array(count).fill(1);
      const sizes = new Float32Array(count).fill(size);
      geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colour, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.ShaderMaterial({
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        uniforms: { uPixelRatio: { value: DPR() }, uOpacity: { value: opacity } },
        transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.raycast = () => {};
      points.renderOrder = 24;
      parent.add(points);
      return {
        points, position, colour, alpha, size: sizes, count,
        set(i, x, y, z) { position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z; },
        tint(i, c) { const col = c.isColor ? c : new THREE.Color(c); colour[i * 3] = col.r; colour[i * 3 + 1] = col.g; colour[i * 3 + 2] = col.b; },
        commit() {
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.aColor.needsUpdate = true;
          geometry.attributes.aAlpha.needsUpdate = true;
          geometry.attributes.aSize.needsUpdate = true;
        },
        set opacity(v) { material.uniforms.uOpacity.value = v; },
        get opacity() { return material.uniforms.uOpacity.value; },
      };
    };

    /** A flat filled disc facing the hud (plane "xy") or lying flat ("xz"). */
    ctx.disc = (radius, { colour = "#ffffff", opacity = 1, plane = "xy", segments = 96, parent = root, additive = false, depthTest = true } = {}) => {
      const geometry = new THREE.CircleGeometry(radius, segments);
      if (plane === "xz") geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, depthTest,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
      }));
      mesh.raycast = () => {};
      mesh.renderOrder = 19;
      mesh.userData.baseOpacity = opacity;
      parent.add(mesh);
      return mesh;
    };

    /** A flat filled shape from 2D points [[x, y], ...], in the hud plane. */
    ctx.shape = (points, { colour = "#ffffff", opacity = 1, parent = root, additive = false } = {}) => {
      const outline = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshBasicMaterial({
        color: colour, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
      }));
      mesh.raycast = () => {};
      mesh.renderOrder = 19;
      mesh.userData.baseOpacity = opacity;
      parent.add(mesh);
      return mesh;
    };

    /** A star field for the hud backdrop (deep-sky dioramas). */
    ctx.starfield = (count = 400, { radius = 1.6, depth = -1.2, seed = 3, parent = root } = {}) => {
      const r = rng(seed);
      const stars = ctx.cloud(count, { parent });
      for (let i = 0; i < count; i += 1) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * radius;
        stars.set(i, Math.cos(a) * d * 1.6, Math.sin(a) * d, depth - r() * 0.2);
        stars.size[i] = 1 + r() * 2.2;
        stars.alpha[i] = 0.25 + r() * 0.6;
        const warm = r();
        stars.tint(i, warm > 0.8 ? "#ffd9b0" : warm < 0.2 ? "#bcd4ff" : "#f2f4ff");
      }
      stars.commit();
      return stars;
    };

    /**
     * Fades an object and everything in it to `a` times its own opacity.
     * Visibility follows, so nothing invisible is drawn.
     */
    ctx.fade = (object, a) => {
      if (!object) return;
      object.visible = a > 0.002;
      object.traverse((child) => {
        const material = child.material;
        if (!material) return;
        const base = child.userData.baseOpacity ?? 1;
        if (material.userData.baseTransparent === undefined) material.userData.baseTransparent = material.transparent;
        if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = base * a;
        else material.opacity = base * a;
        material.transparent = material.userData.baseTransparent || base * a < 0.999;
      });
    };

    /** Says each stage once, as the progress reaches it: [{at, label, text}]. */
    ctx.tell = (stages) => {
      let current = -1;
      ctx.stages = (p) => {
        let index = -1;
        stages.forEach((s, i) => { if (p >= s.at) index = i; });
        if (index !== current) {
          current = index;
          api?.setStage?.(index >= 0 ? stages[index] : null);
        }
      };
    };

    /** Point on a sphere of radius r at latitude/longitude (degrees). */
    ctx.onSphere = (r, latDeg, lonDeg) => {
      const lat = THREE.MathUtils.degToRad(latDeg);
      const lon = THREE.MathUtils.degToRad(lonDeg);
      return new THREE.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
    };

    /* ---- the backdrop: a soft dark disc behind a hud diorama */
    let backdropSprite = null;
    if (mode === "hud" && backdrop > 0) {
      backdropSprite = ctx.glow("#000000", 3.6, { opacity: backdrop, additive: false });
      backdropSprite.position.set(0, 0, -1.6);
      backdropSprite.renderOrder = 10;
    }

    /* ---- framing, every frame */
    function hudFrame(at = distance) {
      const d = Math.max(at, (camera.near || 0.1) * 4);
      const halfH = d * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      ctx.halfWidth = (camera.aspect || 1.6) * 0.66;
      return { d, halfH };
    }
    function frame() {
      camera.updateMatrixWorld();
      host.updateWorldMatrix(true, false);
      hostInverse.copy(host.matrixWorld).invert();
      if (mode === "hud") {
        /* Hud units: 1 = half the screen's height at `distance`. The
         * diorama's centre sits in the clear part of the screen: left of the
         * event card (310 px at the bottom right, cinematic-ui.css) and a
         * little above the distance readout. */
        /* Round 79: the site moves its near plane with the view (3.1 in the
         * journey view, 0.02 close to a body), so the diorama stands at
         * least four near-planes out; its size scales with the distance,
         * so the picture is the same either way. */
        /* Round 79 (Prompts.md: "everything is on the left -- it should be
         * in the middle of the screen"): centred on the screen now. */
        const { d, halfH } = hudFrame();
        target.copy(camera.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, 0, -d));
        group.matrix.copy(hostInverse).multiply(target);
        root.scale.setScalar(halfH);
        group.matrixWorldNeedsUpdate = true;
      } else {
        /* World axes, centred on the body. */
        host.getWorldPosition(scratch);
        target.makeTranslation(scratch.x, scratch.y, scratch.z);
        group.matrix.copy(hostInverse).multiply(target);
        root.scale.setScalar(unit);
        group.matrixWorldNeedsUpdate = true;
        ctx.sunDir.copy(scratch).negate();
        if (ctx.sunDir.lengthSq() < 1e-8) ctx.sunDir.set(0, 0, 1);
        ctx.sunDir.normalize();
        ctx.camDir.copy(camera.position).sub(scratch).normalize();
        host.getWorldQuaternion(scratchQ);
        ctx.hostUp.set(0, 1, 0).applyQuaternion(scratchQ).normalize();
        if (ctx.lightFollowsSun) ctx.light.copy(ctx.sunDir);
      }
      /* The light into view space for every lit material. */
      root.updateWorldMatrix(true, false);
      const view = new THREE.Vector3().copy(ctx.light);
      if (mode === "hud") {
        // root-local == view space (the diorama turns with the lens)
      } else {
        view.transformDirection(camera.matrixWorldInverse);
      }
      lit.forEach((m) => m.uniforms.uLight.value.copy(view));
      suns.forEach((m) => { m.uniforms.uTime.value = ctx.t; });
      /* A body event's hud layer, held in front of the lens like a stage. */
      if (hudLayer) {
        /* Round 83: a body event's hud layer stands just in front of the
         * lens (0.3 units, or four near-planes), not 3 units out, so a real
         * body the camera is close to (the Moon from 1.5 units) cannot hide
         * its lines and panels. It is scaled with its distance, so it looks
         * the same. */
        const { d, halfH } = hudFrame(0.3);
        hudLayer.parent.updateWorldMatrix(true, false);
        hudLayer.holder.matrix.copy(hudLayer.parent.matrixWorld).invert()
          .multiply(camera.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, 0, -d));
        hudLayer.holder.matrixWorldNeedsUpdate = true;
        hudLayer.root.scale.setScalar(halfH);
      }
      allLabels.forEach(fitLabel);
    }

    /*
     * Round 79: for an event staged on a real body (Mars, Venus, Earth...),
     * a second stage held in front of the lens -- for captions, insets and
     * the comparison panels the owner asked for after the real-body part.
     * Hud units, like a hud event; hung from the deep-sky anchor so a
     * blackout can keep it and hide everything else.
     */
    let hudLayer = null;
    ctx.hudLayer = () => {
      if (hudLayer) return hudLayer.root;
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      const hroot = new THREE.Group();
      holder.add(hroot);
      const parent = options.skyAnchor ?? group;
      parent.add(holder);
      hudLayer = { holder, root: hroot, parent };
      frame();
      return hroot;
    };
    /* The hud layer's anchor, for a blackout that keeps only it. */
    ctx.hudAnchor = () => options.skyAnchor ?? null;

    /* ---- helpers for a real body (body stage) */
    const onHost = [];
    /** Adds an object to the body itself, so it turns with it. */
    ctx.onHost = (object) => { host.add(object); onHost.push(object); return object; };
    /* Round 82: adds an object to any real body (it turns with it), taken
     * off again when the event ends. */
    ctx.attach = (body, object) => { if (!body) return object; body.add(object); onHost.push(object); return object; };
    /** The body's own radius in its local units (its mesh's geometry). */
    ctx.hostRadius = () => {
      const geometry = host.geometry;
      if (geometry && !geometry.boundingSphere) geometry.computeBoundingSphere?.();
      return geometry?.boundingSphere?.radius ?? unit;
    };
    /*
     * A point on the body's surface at a latitude and east longitude, in the
     * body's own frame. The site's planet maps are simple cylindrical with
     * longitude -180 at the left edge (checked on the Mars map: Olympus Mons
     * at u = 0.125, 18.6 N, 133.8 W), wrapped by three's SphereGeometry:
     * x = -cos(2 pi u) sin(theta), y = cos(theta), z = sin(2 pi u) sin(theta).
     */
    ctx.surfacePoint = (latDeg, lonDeg, lift = 1) => {
      const r = ctx.hostRadius() * lift;
      const u = (lonDeg + 180) / 360;
      const th = THREE.MathUtils.degToRad(90 - latDeg);
      return new THREE.Vector3(-r * Math.cos(TAU * u) * Math.sin(th), r * Math.cos(th), r * Math.sin(TAU * u) * Math.sin(th));
    };
    /*
     * Turns the body about its own axis so a surface point faces a world
     * direction (the Sun, the camera), `amount` of the way there. The site
     * spins planets by adding to rotation.y each frame, so it carries on
     * from here afterwards rather than snapping back.
     */
    ctx.turnHostToward = (latDeg, lonDeg, worldDir, amount = 1) => {
      /* Round 80: the site tilts a planet with rotation.z on the mesh itself
       * (planetFactory: rotation.z = axialTilt), applied before the spin
       * (Euler XYZ), so the point is tilted first. Venus's tilt is 3.1 rad:
       * without this it turned the wrong way. */
      const f = ctx.surfacePoint(latDeg, lonDeg).applyAxisAngle(new THREE.Vector3(0, 0, 1), host.rotation.z || 0);
      const parentQ = new THREE.Quaternion();
      host.parent?.getWorldQuaternion(parentQ);
      const dLocal = worldDir.clone().applyQuaternion(parentQ.invert());
      const want = Math.atan2(dLocal.x, dLocal.z) - Math.atan2(f.x, f.z);
      let delta = want - host.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      host.rotation.y += delta * amount;
    };

    /* Round 80: re-frames now -- for a scene that moves its host (the real
     * Venus round its orbit) in update(), so what hangs on the stage does
     * not trail one step behind. */
    ctx.reframe = () => frame();

    /*
     * Round 82: holds the event's clock while `predicate()` is true (the
     * camera still flying to a second body), for at most `maxSeconds` of
     * real time, so a slow machine does not miss the picture.
     */
    let hold = null;
    ctx.holdWhile = (predicate, maxSeconds = 4) => {
      hold = { predicate, until: performance.now() + maxSeconds * 1000 };
    };
    const holding = () => {
      if (!hold) return false;
      if (performance.now() > hold.until || !hold.predicate()) { hold = null; return false; }
      return true;
    };

    /* Framed once first, so the scene can read ctx.halfWidth and sunDir. */
    frame();
    const scene = sceneFn(ctx) ?? {};
    /* Round 79 (Prompts.md): a hud diorama plays on plain black -- the solar
     * system and the sky behind it are hidden while it runs. */
    if (veil) api?.setVeil?.(veil);
    else if (mode === "hud" && blackout) api?.setVeil?.("blackout");
    frame();

    return {
      group,
      holding,
      duration: scene.duration ?? 30,
      update(progress, liveApi) {
        ctx.t = (performance.now() - startedAt) / 1000;
        frame();
        ctx.stages?.(progress);
        scene.update?.(progress, ctx, liveApi);
        if (labels.length) {
          /* declutterLabels reads a label's own scale as its height on
           * screen; labels here sit inside scaled stages, so it is given
           * their world scale for the measurement and they get theirs back. */
          const ks = labels.map((l) => l.parent?.matrixWorld.getMaxScaleOnAxis() || 1);
          labels.forEach((l, i) => l.scale.multiplyScalar(ks[i]));
          declutterLabels(labels, camera);
          labels.forEach((l, i) => l.scale.multiplyScalar(1 / ks[i]));
        }
      },
      dispose(liveApi) {
        (liveApi ?? api)?.setStage?.(null);
        (liveApi ?? api)?.setVeil?.(null);
        scene.dispose?.(ctx);
        onHost.forEach((object) => object.parent?.remove(object));
        if (hudLayer) hudLayer.parent.remove(hudLayer.holder);
        const extras = [...onHost, ...(hudLayer ? [hudLayer.holder] : [])];
        [group, ...extras].forEach((top) => top.traverse((object) => {
          object.geometry?.dispose?.();
          const material = object.material;
          if (material) {
            /* Label textures are this stage's own; the glow and the planet
             * maps are shared and stay. */
            if (material.map?.isCanvasTexture && material.map !== glowTexture()) material.map.dispose?.();
            material.dispose?.();
          }
        }));
        lit.clear();
        suns.clear();
      },
    };
  };
}

/* ------------------------------------------------------------ definitions */

/**
 * One event definition, in solarSystemEvents.js's format, plus the fields
 * the dashboard and narrator read:
 *   section   which chip it sits under in the Space events panel
 *   often     the short "how often" tag on its card
 *   timeline  { last, next } for the card, where it has dates
 *   story     what the narrator says (docs/voice-script.md, Part 3L+)
 *   art       how its card picture is drawn (ui/eventVignettes.js)
 */
export function event(definition) {
  const { scene, stageOptions, ...rest } = definition;
  return {
    ...rest,
    story: STORY[rest.id] ?? rest.story ?? null,
    body: rest.body === undefined ? null : rest.body,
    build: stage(scene, { mode: rest.body ? "body" : "hud", ...(stageOptions ?? {}) }),
  };
}

import * as THREE from "three";
import { TAU, rng, clamp01, smooth } from "./kit.js";

/**
 * Round 88: the things the deep-sky voyages arrive at, drawn in 3D --
 * stars, white dwarfs fed by a companion, explosions, neutron stars, black
 * holes (ray-traced), nebulae, galaxies, ring systems, planets, a Dyson
 * swarm, the cosmic web and a wormhole. Each builder takes the kit (`ctx`)
 * and a parent group in the voyage's universe, and returns its object with
 * an update. Sizes are drawing units; each event picks its own scale and
 * says so. Numbers that are measurements carry their source where they are
 * used (in the event files).
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DEG = Math.PI / 180;
const gauss = (r) => (r() + r() + r() - 1.5) / 1.5;

/* ------------------------------------------------------------ stars */

/* A star: the kit's glowing surface with its halo. */
export function star(ctx, parent, r, { colour = "#ffb54a", hot = "#fff3c4", halo = 3.2, haloColour = null, haloOpacity = 0.55, granule = 18 } = {}) {
  return ctx.sun(r, { colour, hot, halo, haloColour: haloColour ?? colour, haloOpacity, granule, parent });
}
/* Recolours a kit star (and its halo). */
export function tintStar(s, colour, hot = null) {
  s.material.uniforms.uColor.value.set(colour);
  if (hot) s.material.uniforms.uHot.value.set(hot);
  s.userData.halo?.material.color.set(colour);
}

/*
 * A planet lit by a point in its parent's space (userData.setLight): a
 * map, or bands drawn from colours; an atmosphere rim; an optional glow of
 * its own (a young planet still hot from forming). Its own shader, because
 * the kit's lit material takes one light for the whole event.
 */
const PLANET_VERTEX = /* glsl */ `
uniform vec3 uLightLocal;
varying vec3 vN;
varying vec3 vL;
varying vec3 vV;
varying vec2 vUv;
varying vec3 vLocal;
void main() {
  vUv = uv;
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 lv = modelViewMatrix * vec4(uLightLocal, 1.0);
  vN = normalize(normalMatrix * normal);
  vL = normalize(lv.xyz - mv.xyz);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const PLANET_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uBands;
uniform vec3 uRim;
uniform float uRimK;
uniform float uNight;
uniform float uOpacity;
uniform float uSeed;
uniform float uGlowK;
uniform float uLit;
uniform vec3 uGlow;
varying vec3 vN;
varying vec3 vL;
varying vec3 vV;
varying vec2 vUv;
varying vec3 vLocal;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 n = normalize(vN);
  vec3 p = normalize(vLocal);
  vec3 base;
  if (uHasMap > 0.5) base = texture2D(uMap, vUv).rgb;
  else {
    float w = n3(p * 3.0 + uSeed) * 0.5 + n3(p * 7.0 - uSeed) * 0.25;
    float band = sin((p.y + w * 0.18) * uBands) * 0.5 + 0.5;
    base = mix(uA, uB, band);
    base = mix(base, uC, smoothstep(0.55, 0.8, n3(p * 5.0 + uSeed * 2.0)) * 0.6);
  }
  float lam = dot(n, normalize(vL));
  float day = mix(1.0, smoothstep(-0.05, 0.4, lam), uLit);
  vec3 col = base * (uNight + (1.0 - uNight) * day);
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.6);
  col += uRim * rim * uRimK * (0.15 + 0.85 * mix(1.0, smoothstep(-0.3, 0.4, lam), uLit));
  col += uGlow * uGlowK * (0.6 + 0.4 * n3(p * 6.0 + uSeed));
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
export function planet(ctx, parent, r, { map = null, a = "#c9a27a", b = "#8d6a4a", c = "#e9d6b8", bands = 14, rim = "#9fc8ff", rimK = 0.5, night = 0.03, seed = 1.3, glow = "#ff5a2a", glowK = 0, lit = 1 } = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: PLANET_VERTEX,
    fragmentShader: PLANET_FRAGMENT,
    uniforms: {
      uLightLocal: { value: V(10, 0, 0) },
      uMap: { value: map }, uHasMap: { value: map ? 1 : 0 },
      uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uC: { value: new THREE.Color(c) },
      uBands: { value: bands }, uRim: { value: new THREE.Color(rim) }, uRimK: { value: rimK },
      uNight: { value: night }, uOpacity: { value: 1 }, uSeed: { value: seed },
      uGlow: { value: new THREE.Color(glow) }, uGlowK: { value: glowK }, uLit: { value: lit },
    },
    transparent: true, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  mesh.scale.setScalar(r);
  mesh.renderOrder = 20;
  mesh.raycast = () => {};
  parent.add(mesh);
  const q = new THREE.Quaternion();
  mesh.userData.setLight = (pos) => {
    q.copy(mesh.quaternion).invert();
    material.uniforms.uLightLocal.value.copy(pos).sub(mesh.position).applyQuaternion(q).divideScalar(mesh.scale.x);
  };
  return mesh;
}

/*
 * Round 90 (Prompts.md: "the star we show isn't realistic ... all
 * supernova stars do not have the same colours ... research how each looks,
 * their surface texture"): a star's surface as telescopes and models show
 * it, by kind --
 *
 *   rsg  red supergiant (~3,500 K): a few giant convection cells, each a
 *        large fraction of the star (Betelgeuse imaged by VLTI/PIONIER,
 *        Montargès et al.; Schwarzschild 1975), dark lanes between, strong
 *        limb darkening, wrapped in its own dust
 *   ysg  yellow supergiant (~6,000-7,000 K, e.g. SN 2011dh's progenitor,
 *        and the stripped star behind Cassiopeia A, a Type IIb): smaller
 *        cells, yellow-white
 *   bsg  blue supergiant (~15,000-20,000 K, Sanduleak -69 202 of SN 1987A):
 *        fine, faint granulation, blue-white
 *   wr   Wolf-Rayet star (~50,000+ K, the stripped stars behind hypernovae):
 *        small, blue-white, hidden in its own fast, dense wind
 *
 * Colours from the stars' temperatures (blackbody); cells from 3D Worley
 * noise on the surface, drifting over time; `cut` opens a wedge so the
 * layers inside (onion) can be seen.
 */
const REAL_STAR_VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const REAL_STAR_FRAGMENT = /* glsl */ `
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;
uniform float uCells;
uniform float uContrast;
uniform float uLimb;
uniform float uTime;
uniform float uOpacity;
uniform float uCut;
uniform float uFlicker;
uniform float uSpots;
uniform float uCrack;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
vec3 rh3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
vec2 worley(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  float d1 = 9.0; float d2 = 9.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = rh3(i + g);
    o = 0.5 + 0.45 * sin(uTime * 0.15 + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(d1, d2);
}
float vn(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = rh3(i).x; float b = rh3(i + vec3(1,0,0)).x; float c = rh3(i + vec3(0,1,0)).x; float d = rh3(i + vec3(1,1,0)).x;
  float e = rh3(i + vec3(0,0,1)).x; float f2 = rh3(i + vec3(1,0,1)).x; float g = rh3(i + vec3(0,1,1)).x; float h = rh3(i + vec3(1,1,1)).x;
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, f2, f.x), mix(g, h, f.x), f.y), f.z);
}
void main() {
  if (uCut > 0.5 && vObj.x > 0.0 && vObj.z > 0.0) discard;
  vec3 n = normalize(vN);
  float mu = abs(dot(n, normalize(vV)));
  vec2 w = worley(vObj * uCells);
  /* Bright cell centres, dark lanes where cells meet. */
  float lane = smoothstep(0.0, 0.35, w.y - w.x);
  float cellB = 1.0 - 0.55 * w.x;
  float fine = vn(vObj * uCells * 6.0 + uTime * 0.05) * 0.5 + vn(vObj * uCells * 13.0) * 0.5;
  float b = mix(1.0, cellB * (0.55 + 0.45 * lane) * (0.85 + 0.3 * fine), uContrast);
  float spot = uSpots * smoothstep(0.62, 0.8, vn(vObj * 2.3 + 4.0));
  b *= 1.0 - 0.5 * spot;
  float limb = pow(mu, uLimb);
  float heat = clamp(b * limb, 0.0, 1.2);
  vec3 col = heat < 0.5 ? mix(uCool, uMid, heat / 0.5) : mix(uMid, uHot, (heat - 0.5) / 0.7);
  col *= (0.35 + 0.9 * heat) * (1.0 + uFlicker);
  /* The thin glowing edge of the atmosphere. */
  col += uMid * pow(1.0 - mu, 4.0) * 0.35;
  /* Cracks (a neutron star's crust): the lanes between cells glow. */
  col += uHot * (1.0 - lane) * uCrack * (0.55 + 0.45 * fine) * (0.5 + 0.5 * limb);
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
export const STAR_KINDS = {
  rsg: { hot: "#ffb36b", mid: "#e0571e", cool: "#5a1205", cells: 2.2, contrast: 1, limb: 0.9, spots: 0.6, halo: "#ff6a2a" },
  ysg: { hot: "#fff3d0", mid: "#ffc76a", cool: "#8a4a14", cells: 4, contrast: 0.8, limb: 0.7, spots: 0.25, halo: "#ffd27a" },
  bsg: { hot: "#ffffff", mid: "#bcd2ff", cool: "#4a6ab8", cells: 7, contrast: 0.65, limb: 0.65, spots: 0, halo: "#9fc4ff" },
  wr: { hot: "#dfe9ff", mid: "#9fbcf5", cool: "#3a5aa8", cells: 10, contrast: 0.5, limb: 0.55, spots: 0, halo: "#8fb8ff" },
  rd: { hot: "#ffb47a", mid: "#ff6a2a", cool: "#6a1a08", cells: 10, contrast: 0.55, limb: 0.65, spots: 0.4, halo: "#ff7a3a" },
  sun: { hot: "#fff8ea", mid: "#ffdca0", cool: "#a8601a", cells: 18, contrast: 0.55, limb: 0.6, spots: 0.2, halo: "#ffe2a8" },
  /* Round 91, after the owner's pictures (artists' impressions built on
   * the physics): a neutron star's crust, cracked plates of blue-hot
   * matter with white-hot seams (the kilonova picture: about 10^6 K at the
   * surface); a magnetar, blue-white, its surface fine-grained, hot spots
   * where field lines plunge in. */
  ns: { hot: "#ffffff", mid: "#6aa8ff", cool: "#0e2c74", cells: 3.2, contrast: 0.95, limb: 0.35, spots: 0, halo: "#9fc8ff", crack: 1.1 },
  magnetar: { hot: "#ffffff", mid: "#b8d4ff", cool: "#4a78d8", cells: 7, contrast: 0.5, limb: 0.45, spots: 0.15, halo: "#a8c8ff", crack: 0 },
};
export function realStar(ctx, parent, r, kind = "rsg", opts = {}) {
  const k = { ...STAR_KINDS[kind] ?? STAR_KINDS.rsg, ...opts };
  const material = new THREE.ShaderMaterial({
    vertexShader: REAL_STAR_VERTEX,
    fragmentShader: REAL_STAR_FRAGMENT,
    uniforms: {
      uHot: { value: new THREE.Color(k.hot) }, uMid: { value: new THREE.Color(k.mid) }, uCool: { value: new THREE.Color(k.cool) },
      uCells: { value: k.cells }, uContrast: { value: k.contrast }, uLimb: { value: k.limb }, uSpots: { value: k.spots },
      uTime: { value: 0 }, uOpacity: { value: 1 }, uCut: { value: 0 }, uFlicker: { value: 0 }, uCrack: { value: k.crack ?? 0 },
    },
    transparent: true, toneMapped: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 48), material);
  mesh.renderOrder = 20;
  mesh.raycast = () => {};
  mesh.onBeforeRender = () => { material.uniforms.uTime.value = ctx.t; };
  parent.add(mesh);
  const halo = ctx.glow(k.halo, r * (kind === "wr" ? 5 : 2.6), { opacity: kind === "rsg" ? 0.4 : 0.55, parent: mesh });
  mesh.userData.halo = halo;
  /* A red supergiant's dust: clumps of it, shed over centuries, round
   * the star and partly in front of it. A Wolf-Rayet star's wind. */
  if (kind === "rsg" && k.dust !== false) {
    const rr = rng(23);
    const clumps = Array.from({ length: 14 }, () => V(gauss(rr), gauss(rr), gauss(rr)).normalize());
    mesh.userData.dust = cloudOf(ctx, parent, 2600, (rnd) => {
      const c = clumps[Math.floor(rnd() * clumps.length)];
      const d = c.clone().add(V(gauss(rnd), gauss(rnd), gauss(rnd)).multiplyScalar(0.4)).normalize();
      return { p: d.multiplyScalar(r * (1.15 + 1.2 * rnd())), c: rnd() < 0.7 ? "#2a1408" : "#5a2a12", a: 0.35 * rnd(), s: 1 + rnd() };
    }, { size: 9, seed: 24, additive: false });
  }
  if (kind === "wr") {
    mesh.userData.wind = shock(ctx, parent, "#8fb8ff", { power: 2.4, seed: 9 });
    mesh.userData.wind.set(r * 1.9, 0.2);
  }
  return mesh;
}

/*
 * The inside of a massive star at the end, as an onion (Woosley, Heger &
 * Weaver 2002): hydrogen outside, then helium, carbon, neon-oxygen,
 * silicon, and an iron core. Round 90: drawn as the two flat faces the
 * wedge cut leaves (x = 0 and z = 0, the quarter x > 0, z > 0 taken out of
 * the star), each coloured by depth -- hotter, whiter, further in -- so it
 * reads as a cut-open ball, not a target. The boundaries are churned
 * (uSlosh): in the last hours silicon and neon break into each other's
 * shells (Chandra, Sato et al. 2021, Cassiopeia A). Radii are drawn for
 * clarity (the real shells are far thinner toward the centre).
 * show(a, coreScale, slosh): coreScale shrinks the iron core as it falls.
 */
const ONION_LAYERS = [
  /* [name, outer radius as a share of the star's, colour] -- colour by
   * temperature: a red-orange envelope (a few thousand K at the top) to a
   * blue-white iron core (about 10 billion K before collapse; Woosley &
   * Janka 2005). */
  ["H", 1.0, "#b8320c"],
  ["He", 0.78, "#e8661c"],
  ["C", 0.6, "#ff9a2e"],
  ["Ne/O", 0.45, "#ffc95a"],
  ["Si", 0.3, "#fff0b0"],
  ["Fe", 0.16, "#dfe8ff"],
];
const ONION_VERTEX = /* glsl */ `
varying vec2 vUv2;
void main() {
  vUv2 = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const ONION_FRAGMENT = /* glsl */ `
uniform float uR;
uniform float uOpacity;
uniform float uCore;
uniform float uSlosh;
uniform float uTime;
uniform vec3 uC[6];
uniform float uF[6];
varying vec2 vUv2;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  if (vUv2.x < 0.0) discard;
  vec2 p = vUv2 / uR;
  float r = length(p);
  if (r > 1.0) discard;
  /* Churned boundaries: plumes of one shell into the next. */
  float ang = atan(p.y, p.x);
  float churn = (n2(vec2(ang * 3.0, r * 6.0 - uTime * 0.4)) - 0.5) * 0.06 + (n2(vec2(ang * 7.0 + 3.0, r * 14.0 + uTime * 0.7)) - 0.5) * 0.05 * (1.0 + 2.5 * uSlosh);
  float rr = r + churn * smoothstep(0.08, 0.2, r);
  vec3 col = uC[0];
  float edge = 1.0;
  for (int i = 1; i < 6; i++) {
    float f = uF[i] * (i == 5 ? uCore : 1.0);
    if (rr < f) col = uC[i];
    edge = min(edge, abs(rr - f));
  }
  /* The core falling in: what is left of it white-hot. */
  if (r < uF[5] * uCore * 0.35) col = vec3(1.0);
  float glow = 0.75 + 0.45 * (1.0 - r);
  float grain = 0.9 + 0.2 * n2(p * 40.0 + uTime * 0.2);
  col *= glow * grain;
  col *= 0.72 + 0.28 * smoothstep(0.0, 0.012, edge);
  col *= 0.6 + 0.4 * (1.0 - smoothstep(0.94, 1.0, r));
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
export function onion(ctx, parent, r, { stripped = false } = {}) {
  /* stripped: a star that lost its hydrogen before the end (a Wolf-Rayet
   * star, the hypernova's and the BOAT's) -- helium on the outside. */
  const g = new THREE.Group();
  parent.add(g);
  const uniforms = {
    uR: { value: r }, uOpacity: { value: 1 }, uCore: { value: 1 }, uSlosh: { value: 0 }, uTime: { value: 0 },
    uC: { value: ONION_LAYERS.map(([, , c], i) => new THREE.Color(stripped && i === 0 ? ONION_LAYERS[1][2] : c)) },
    uF: { value: ONION_LAYERS.map(([, f]) => f) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: ONION_VERTEX, fragmentShader: ONION_FRAGMENT, uniforms,
    transparent: true, depthWrite: true, side: THREE.DoubleSide, toneMapped: false,
  });
  /* Face 1: the plane z = 0, its x > 0 half. Face 2: the plane x = 0, its
   * z > 0 half (the plane turned so local +x is world +z). */
  const geo = new THREE.PlaneGeometry(2 * r, 2 * r, 1, 1);
  const f1 = new THREE.Mesh(geo, material);
  const f2 = new THREE.Mesh(geo, material);
  f2.rotation.y = -Math.PI / 2;
  [f1, f2].forEach((m) => { m.renderOrder = 19; m.raycast = () => {}; g.add(m); });
  f1.onBeforeRender = () => { uniforms.uTime.value = ctx.t; };
  return {
    group: g,
    show(a, coreScale = 1, slosh = 0) {
      g.visible = a > 0.002;
      uniforms.uOpacity.value = a;
      uniforms.uCore.value = Math.max(1e-3, coreScale);
      uniforms.uSlosh.value = slosh;
    },
  };
}

/*
 * What is left after a core collapse, close up (Prompts.md round 90: "zoom
 * in ... see the neutron star, gas coming out, spinning fast, not lines"):
 * the pulsar wind nebula Chandra and Hubble photographed in the Crab
 * (Weisskopf et al. 2000; Hester et al. 2002) -- a tiny white-hot ball
 * flickering as its beams sweep past (30 times a second in the Crab), an
 * inner ring of bright knots round its equator, a thick torus of glowing
 * gas, wisps forming at the ring and drifting out (about half the speed of
 * light) while the whole swirls with the spin, and a jet of puffs along
 * the spin axis, kinked and brighter on one side (the far one dimmed by
 * Doppler beaming). Soft gas (large faint points) over fine sparks; no
 * drawn lines.
 */
export function pulsarWind(ctx, parent, r, { torusR = 14, jetLen = 26, spin = 1, colour = "#bcd8ff", quiet = false } = {}) {
  /* quiet: a young neutron star that is not (or not yet seen as) a
   * pulsar -- Cassiopeia A's is a hot "central compact object" with no
   * wind nebula (Chandra, 1999-): just a faint haze, no jets. */
  /* g: turned by the caller about the line of sight (the Crab's jet
   * points to the south-east, Ng & Romani 2004); spinning inside it. */
  const g = new THREE.Group();
  parent.add(g);
  const ball = ctx.sun(r, { colour: "#dfe8ff", hot: "#ffffff", halo: 10, haloColour: "#cfe0ff", haloOpacity: 0.9, granule: 12, parent: g });
  const beat = ctx.glow("#e8f0ff", torusR * 0.5, { opacity: 0.6, parent: g });
  /* The synchrotron haze the whole wind glows with (blue-white). */
  const haze = ctx.glow(colour, torusR * 3.4, { opacity: quiet ? 0.08 : 0.22, parent: g });
  const rr = rng(77);
  const NG = 2600;
  const NS = 2200;
  const gas = ctx.cloud(NG, { parent: g, size: 12 });
  const spark = ctx.cloud(NS, { parent: g, size: 2.2 });
  const cBlue = new THREE.Color(colour);
  const cWhite = new THREE.Color("#ffffff");
  const cViolet = new THREE.Color("#9f8cff");
  const make = (i, n) => {
    const k = rr();
    if (k < 0.2) return { kind: "jet", s: rr() < 0.72 ? 1 : -1, u: rr(), w: gauss(rr) * 0.12, ph: rr() * TAU, puff: Math.floor(rr() * 9) };
    if (k < 0.36) return { kind: "ring", u: rr(), th: rr() * TAU, w: gauss(rr) * 0.06 };
    return { kind: "torus", u: rr(), th: rr() * TAU, y: gauss(rr) * 0.12, w: gauss(rr) * 0.1, clump: Math.floor(rr() * 7) };
  };
  const gasP = Array.from({ length: NG }, (_, i) => make(i, NG));
  const sparkP = Array.from({ length: NS }, (_, i) => make(i, NS));
  gasP.forEach((p, i) => {
    gas.tint(i, p.kind === "jet" ? cBlue.clone().lerp(cWhite, 0.3) : cBlue.clone().lerp(cViolet, rr() * 0.5));
    gas.size[i] = (p.kind === "ring" ? 7 : p.kind === "jet" ? 16 : 12) * (0.7 + 0.8 * rr());
  });
  sparkP.forEach((p, i) => { spark.tint(i, cBlue.clone().lerp(cWhite, 0.5 + 0.5 * rr())); spark.size[i] = 1.4 + 1.6 * rr(); });
  const place = (cl, P, i, t, soft) => {
    const p = P[i];
    if (p.kind === "jet") {
      /* Puffs flowing out along the axis, a slow kink along it. */
      const u = (p.u + t * 0.22) % 1;
      const kink = Math.sin(u * 5 + t * 0.6 + p.s) * 0.08 * jetLen * u;
      const spread = p.w * jetLen * (0.25 + 0.9 * u);
      cl.set(i, spread + kink, p.s * (r * 2 + u * jetLen), p.w * jetLen * 0.4);
      const knot = 0.5 + 0.5 * Math.sin(u * 22 + p.ph);
      cl.alpha[i] = quiet ? 0 : (soft ? 0.06 + 0.1 * knot : 0.06 + 0.22 * knot) * Math.sin(Math.PI * Math.min(1, u * 1.2)) * (p.s > 0 ? 1 : 0.4);
    } else if (p.kind === "ring") {
      /* The inner ring of knots, close in, turning fast. */
      const th = p.th + t * spin * 2.2;
      const rad = torusR * 0.38 * (1 + p.w);
      cl.set(i, Math.cos(th) * rad, p.w * torusR * 0.3, Math.sin(th) * rad);
      const knot = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(p.th * 9), 3);
      cl.alpha[i] = (soft ? 0.16 : 0.32) * knot * (quiet ? 0.2 : 1);
    } else {
      /* Wisps: born at the ring, drifting out through the torus, swirling. */
      const u = (p.u + t * 0.07) % 1;
      const rad = torusR * (0.4 + 0.85 * u) * (1 + p.w);
      const th = p.th + t * spin * (1.4 - u) + p.clump * 0.9;
      cl.set(i, Math.cos(th) * rad, p.y * torusR * (0.6 + u), Math.sin(th) * rad);
      const wisp = 0.55 + 0.45 * Math.sin(u * 18 - t * 1.2 + p.clump);
      cl.alpha[i] = (soft ? 0.15 : 0.4) * wisp * Math.sin(Math.PI * u) * (quiet ? 0.35 : 1);
    }
  };
  return {
    group: g, ball,
    update(t, a = 1) {
      gas.points.visible = spark.points.visible = a > 0.002;
      ctx.fade(ball, a);
      /* The beams sweep past us: a flicker of the glow (shown slowed --
       * the real 30 a second would only shimmer on a screen). */
      const pulse = quiet ? 0.2 : Math.pow(0.5 + 0.5 * Math.sin(t * 9 * spin), 8);
      ctx.fade(beat, a * (0.15 + 0.85 * pulse));
      ctx.fade(haze, a);
      if (a <= 0.002) return;
      for (let i = 0; i < NG; i += 1) place(gas, gasP, i, t, true);
      for (let i = 0; i < NS; i += 1) place(spark, sparkP, i, t, false);
      gas.commit();
      spark.commit();
      gas.opacity = a;
      spark.opacity = a;
      ball.rotation.y = t * 6 * spin;
    },
  };
}

/*
 * Round 91 (Prompts.md: the hypernova's and the kilonova's "conical shape
 * up and down ... can we make it realistic?"): a jet as what it is -- gas
 * shot out along the spin axis at nearly the speed of light by the
 * spinning hole or star and its disc (a collapsar, MacFadyen & Woosley
 * 1999; GW170817's jet, Mooley et al. 2018), very narrow (a few degrees),
 * glowing, in knots, and dimming as it spreads. Puffs of gas flowing out,
 * not a solid cone. set(t, alpha, reach): reach 0..1 how far it has got.
 */
export function particleJet(ctx, parent, len, { count = 1400, width = 0.04, colour = "#cfe2ff", core = "#ffffff", seed = 33, size = 9, twoSided = true, speed = 0.6 } = {}) {
  const r = rng(seed);
  const parts = Array.from({ length: count }, () => ({ s: twoSided ? (r() < 0.5 ? 1 : -1) : 1, u: r(), w: gauss(r), v: gauss(r), ph: r() * TAU, k: r() }));
  const cloud = ctx.cloud(count, { parent, size });
  const cA = new THREE.Color(colour);
  const cB = new THREE.Color(core);
  parts.forEach((p, i) => { cloud.size[i] = size * (0.5 + 1.1 * p.k); cloud.tint(i, cA.clone().lerp(cB, 1 - p.k)); });
  return {
    cloud,
    set(t, alpha = 1, reach = 1) {
      cloud.opacity = alpha;
      cloud.points.visible = alpha > 0.002;
      if (!cloud.points.visible) return;
      for (let i = 0; i < count; i += 1) {
        const p = parts[i];
        const u = ((p.u + t * speed * (0.8 + 0.4 * p.k)) % 1) * reach;
        const y = len * u;
        const wid = len * width * (0.15 + u);
        cloud.set(i, p.w * wid, p.s * y, p.v * wid);
        const knot = 0.55 + 0.45 * Math.sin(u * 26 + p.ph);
        cloud.alpha[i] = (0.12 + 0.3 * (1 - p.k)) * knot * Math.pow(1 - u, 1.4) * Math.min(1, u * 30);
      }
      cloud.commit();
    },
  };
}

/* ------------------------------------------------------------ particles */

/*
 * An expanding cloud of debris: `count` pieces flung out from the centre,
 * each with its own direction and speed (a share of the front), clumped
 * by a few lobes. set(R, alpha) puts the front at R.
 */
export function burst(ctx, parent, { count = 2200, colours = ["#ffffff", "#ffd9a0", "#ff8a5a"], seed = 5, size = 2.6, lobes = 6, flat = 0, thick = 0.45, aim = null, focus = 0 } = {}) {
  const r = rng(seed);
  const cloud = ctx.cloud(count, { parent, size });
  /* `aim` (a direction) and `focus` (0..1): a jet-like blast one way. */
  const lobeDirs = aim ? [aim.clone().normalize()] : Array.from({ length: lobes }, () => V(r() - 0.5, (r() - 0.5) * (1 - flat), r() - 0.5).normalize());
  const parts = Array.from({ length: count }, () => {
    const d = V(r() * 2 - 1, (r() * 2 - 1) * (1 - flat), r() * 2 - 1);
    if (d.lengthSq() < 1e-4) d.set(1, 0, 0);
    d.normalize();
    const lobe = lobeDirs[Math.floor(r() * lobeDirs.length)];
    d.lerp(lobe, focus + (1 - focus) * r() * 0.45).normalize();
    return { d, k: 1 - thick + thick * Math.pow(r(), 0.5) + 0.05 * r(), c: new THREE.Color(colours[Math.floor(r() * colours.length)]), a: 0.4 + 0.6 * r(), s: 0.6 + r() * 0.9 };
  });
  parts.forEach((p, i) => { cloud.tint(i, p.c); cloud.size[i] = size * p.s; });
  let lastR = -1;
  const o = {
    cloud,
    set(R, alpha = 1) {
      cloud.points.visible = alpha > 0.002;
      cloud.opacity = alpha;
      if (!cloud.points.visible || R === lastR) return o;
      lastR = R;
      for (let i = 0; i < count; i += 1) {
        const p = parts[i];
        cloud.set(i, p.d.x * R * p.k, p.d.y * R * p.k, p.d.z * R * p.k);
        cloud.alpha[i] = p.a;
      }
      cloud.commit();
      return o;
    },
  };
  o.set(0, 0);
  return o;
}

/*
 * A disc of gas going round (Keplerian: angular speed ~ r^-1.5), hot
 * inside, cooler out; in the x-z plane of its parent. update(t, k, alpha).
 */
export function accretion(ctx, parent, rin, rout, { count = 2600, hot = "#e8f0ff", cool = "#ff8a3a", size = 2.4, seed = 9, thick = 0.03, rate = 1 } = {}) {
  const r = rng(seed);
  const cloud = ctx.cloud(count, { parent, size });
  const ch = new THREE.Color(hot);
  const cc = new THREE.Color(cool);
  const c = new THREE.Color();
  const parts = Array.from({ length: count }, () => {
    const rr = rin + (rout - rin) * Math.pow(r(), 1.6);
    return { rr, a0: r() * TAU, y: (r() + r() - 1) * thick * rr, w: Math.pow(rin / rr, 1.5) };
  });
  parts.forEach((p, i) => {
    c.copy(ch).lerp(cc, Math.pow((p.rr - rin) / (rout - rin), 0.6));
    cloud.tint(i, c);
    cloud.alpha[i] = 0.3 + 0.6 * r();
    cloud.size[i] = size * (0.6 + r() * 0.8);
  });
  return {
    cloud,
    update(t, k = 1, alpha = 1) {
      cloud.opacity = alpha * k;
      cloud.points.visible = alpha * k > 0.002;
      if (!cloud.points.visible) return;
      for (let i = 0; i < count; i += 1) {
        const p = parts[i];
        const a = p.a0 + t * rate * p.w * 2.2;
        cloud.set(i, Math.cos(a) * p.rr, p.y, -Math.sin(a) * p.rr);
      }
      cloud.commit();
    },
  };
}

/*
 * Gas pulled off a companion at `from` toward a disc of radius `discR`
 * round the origin, curving the way the disc turns. update(t, from, alpha).
 */
export function stream(ctx, parent, { count = 500, colour = "#ff9a6a", size = 2.2, seed = 4, discR = 1 } = {}) {
  const r = rng(seed);
  const cloud = ctx.cloud(count, { parent, size });
  const parts = Array.from({ length: count }, () => ({ u: r(), j: (r() - 0.5), a: 0.3 + 0.6 * r() }));
  parts.forEach((p, i) => { cloud.tint(i, colour); cloud.alpha[i] = p.a; });
  const side = V();
  return {
    cloud,
    update(t, from, alpha = 1) {
      cloud.opacity = alpha;
      cloud.points.visible = alpha > 0.002;
      if (!cloud.points.visible) return;
      const L = from.length();
      side.set(-from.z, 0, from.x).normalize();
      for (let i = 0; i < count; i += 1) {
        const p = parts[i];
        const u = (p.u + t * 0.25) % 1;
        const rr = L * (1 - u) + discR * u;
        const ang = Math.atan2(-from.z, from.x) + u * u * 1.6;
        const w = 0.03 * L * (1 - u) + 0.08 * discR;
        cloud.set(i, Math.cos(ang) * rr + side.x * p.j * w, p.j * w * 0.3, -Math.sin(ang) * rr + side.z * p.j * w);
      }
      cloud.commit();
    },
  };
}

/* ------------------------------------------------------------ black hole */

/*
 * The sky a black hole bends: dense stars and a faint band of glowing
 * gas, as a function of direction, so that a sky sphere (lensSky) and the
 * rays a black hole bends (blackHole) see the same sky and join without a
 * seam. Drawing, not a real star map.
 */
const SKY_GLSL = /* glsl */ `
float skh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float skn(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(skh(i), skh(i + vec3(1,0,0)), f.x), mix(skh(i + vec3(0,1,0)), skh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(skh(i + vec3(0,0,1)), skh(i + vec3(1,0,1)), f.x), mix(skh(i + vec3(0,1,1)), skh(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 starLayer(vec3 d, float S, float thr, float rad) {
  vec3 p = d * S;
  vec3 c = floor(p);
  float h = skh(c);
  vec3 o = vec3(skh(c + 1.7), skh(c + 3.1), skh(c + 5.3));
  float dist = length(fract(p) - o);
  float s = step(thr, h) * smoothstep(rad, 0.0, dist);
  vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.72, 0.84, 1.0), skh(c + 9.1));
  return tint * s * (0.6 + 0.8 * skh(c + 2.2));
}
vec3 skyCol(vec3 d) {
  vec3 col = starLayer(d, 70.0, 0.82, 0.16) + starLayer(d, 160.0, 0.9, 0.2) * 0.7 + starLayer(d, 30.0, 0.95, 0.12) * 1.6;
  float n = skn(d * 3.0) * 0.6 + skn(d * 7.0) * 0.3 + skn(d * 15.0) * 0.1;
  float band = exp(-pow((d.y + 0.25 * (n - 0.5)) * 3.2, 2.0));
  col += vec3(0.32, 0.22, 0.36) * band * n * 0.3 + vec3(0.03, 0.035, 0.05) * n;
  return col;
}
`;
const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying vec3 vDir;
${SKY_GLSL}
void main() {
  gl_FragColor = vec4(skyCol(normalize(vDir)) * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;
/* The sky sphere round a black-hole scene (radius R, centred on the
 * parent's origin, unrotated). */
export function lensSky(ctx, parent, R = 6000) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
    uniforms: { uOpacity: { value: 1 } },
    side: THREE.BackSide, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32), material);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  parent.add(mesh);
  return { mesh, show(a) { material.uniforms.uOpacity.value = a; mesh.visible = a > 0.002; } };
}

/*
 * Black holes, ray-traced: every pixel follows a ray of light back from
 * the camera, bent by one or two holes (each by the Schwarzschild photon
 * equation in Cartesian form, x'' = -1.5 rs h^2 x / r^5, summed -- exact
 * for one hole, an approximation for two), until it falls in (black),
 * escapes (the sky behind, lensed: skyCol, the same sky as lensSky) or
 * crosses the first hole's accretion disc (its glow, brighter on the side
 * coming toward us -- Doppler beaming, g^3 -- and dimmer near the hole:
 * gravitational redshift). This is how the Event Horizon Telescope
 * pictures are modelled, simplified (no spin, a thin disc). Near the edge
 * of the traced sphere the bending is blended out, so it meets the sky
 * sphere without a seam. Units: scene units in the mesh's frame; the mesh
 * must stay unrotated (its sky must line up with lensSky's).
 */
const BH_VERTEX = /* glsl */ `
uniform float uB;
varying vec3 vPos;
void main() {
  vPos = position * uB;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const BH_FRAGMENT = /* glsl */ `
uniform vec3 uCam;
uniform float uB;
uniform float uTime;
uniform vec3 uP1;
uniform float uR1;
uniform vec3 uP2;
uniform float uR2;
uniform float uRin;
uniform float uRout;
uniform float uDisc;
uniform float uSky;
uniform float uOpacity;
uniform vec3 uHot;
uniform vec3 uCool;
varying vec3 vPos;
${SKY_GLSL}
void main() {
  vec3 ro = uCam;
  vec3 rd = normalize(vPos - uCam);
  vec3 pos = ro;
  float lr = length(ro);
  if (lr > uB) {
    float b = dot(ro, rd);
    float c = lr * lr - uB * uB;
    float disc = b * b - c;
    if (disc < 0.0) discard;
    pos = ro + rd * max(-b - sqrt(disc), 0.0);
  }
  float b0 = length(cross(pos, rd));
  vec3 vel = rd;
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  bool done = false;
  float rmin = min(uR1, uR2 > 0.0 ? uR2 : uR1);
  for (int i = 0; i < 180; i++) {
    vec3 d1 = pos - uP1;
    float r1 = length(d1);
    if (r1 < uR1) { alpha = 1.0; done = true; break; }
    vec3 h1 = cross(d1, vel);
    vec3 acc = -1.5 * uR1 * dot(h1, h1) * d1 / pow(r1, 5.0);
    float rr2 = 1e9;
    if (uR2 > 0.0) {
      vec3 d2 = pos - uP2;
      rr2 = length(d2);
      if (rr2 < uR2) { alpha = 1.0; done = true; break; }
      vec3 h2 = cross(d2, vel);
      acc += -1.5 * uR2 * dot(h2, h2) * d2 / pow(rr2, 5.0);
    }
    if (length(pos) > uB * 1.01 && dot(pos, vel) > 0.0) break;
    float dt = clamp(0.08 * min(r1, rr2), 0.025 * rmin, uB * 0.08);
    vel += acc * dt;
    vel = normalize(vel);
    vec3 np = pos + vel * dt;
    if (uDisc > 0.0 && (pos.y - uP1.y) * (np.y - uP1.y) < 0.0) {
      vec3 x = mix(pos, np, (pos.y - uP1.y) / (pos.y - np.y)) - uP1;
      float rr = length(x.xz) / uR1;
      if (rr > uRin && rr < uRout) {
        float phi = atan(x.z, x.x);
        float temp = pow(uRin / rr, 0.75) * pow(max(1.0 - sqrt(uRin / rr), 0.0), 0.25) * 2.2;
        float v = sqrt(0.5 / rr);
        vec3 ph = normalize(vec3(-x.z, 0.0, x.x));
        float cosA = dot(ph, -vel);
        float g = sqrt(1.0 - v * v) / (1.0 - v * cosA) * sqrt(max(1.0 - 1.0 / rr, 0.0));
        float turb = 0.55 + 0.45 * skn(vec3(rr * 2.2, phi * 3.0 - uTime * 14.0 * pow(rr, -1.5), 0.5));
        float edge = smoothstep(uRin, uRin * 1.15, rr) * (1.0 - smoothstep(uRout * 0.7, uRout, rr));
        float I = temp * pow(g, 3.0) * turb * edge * uDisc;
        /* Round 90 (Prompts.md: "in Interstellar it wasn't white, it was
         * yellowish orange and white"): a four-stop palette, deep orange
         * at the cool outer edge, through orange and gold, to warm white
         * only where the gas is hottest and beamed toward us -- as in
         * NASA's 2019 visualisation and the film. */
        float heat = clamp(temp * g * 0.8, 0.0, 1.5);
        vec3 c1 = vec3(0.5, 0.1, 0.02);
        vec3 c4 = vec3(1.0, 0.94, 0.82);
        vec3 pal = heat < 0.4 ? mix(c1, uCool, heat / 0.4) : heat < 0.85 ? mix(uCool, uHot, (heat - 0.4) / 0.45) : mix(uHot, c4, clamp((heat - 0.85) / 0.65, 0.0, 1.0));
        vec3 cc = pal * I * 1.15;
        float a = clamp(I * 1.6, 0.0, 0.95);
        col += cc * (1.0 - alpha);
        alpha += a * (1.0 - alpha);
      }
    }
    pos = np;
  }
  if (!done && uSky > 0.0) {
    /* Escaped: the sky behind, in the bent direction -- the bending
     * blended out toward the traced sphere's rim. */
    float w = 1.0 - smoothstep(0.5 * uB, 0.97 * uB, b0);
    vec3 dir = normalize(mix(rd, vel, w));
    col += skyCol(dir) * uSky * (1.0 - alpha);
    alpha = 1.0;
  }
  if (alpha < 0.002) discard;
  col = col / max(alpha, 0.001);
  /* Bright gas keeps its colour rather than burning out to white: scale the
   * colour down by its largest channel instead of clipping each one. */
  float m = max(col.r, max(col.g, col.b));
  if (m > 1.0) col /= m;
  gl_FragColor = vec4(col, alpha * uOpacity);
  #include <colorspace_fragment>
}
`;
/*
 * One black hole of radius `rs` at the mesh's centre (and optionally a
 * second, set with setHoles). `bound`: the traced sphere's radius in rs.
 * `sky`: 1 to show the lensed sky (use with lensSky), 0 for a black hole
 * on a plain background (only the shadow and the disc).
 */
export function blackHole(ctx, parent, rs, { bound = 26, rin = 3, rout = 12, disc = 1, sky = 0, stars, hot = "#ffc456", cool = "#ff7418" } = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: BH_VERTEX,
    fragmentShader: BH_FRAGMENT,
    uniforms: {
      uCam: { value: V(0, 0, 40) }, uB: { value: rs * bound }, uTime: { value: 0 },
      uP1: { value: V() }, uR1: { value: rs }, uP2: { value: V() }, uR2: { value: 0 },
      uRin: { value: rin }, uRout: { value: rout }, uDisc: { value: disc }, uSky: { value: sky || stars || 0 },
      uOpacity: { value: 1 }, uHot: { value: new THREE.Color(hot) }, uCool: { value: new THREE.Color(cool) },
    },
    /* Writes depth, so far-off stars drawn later cannot shine through the
     * shadow. */
    transparent: true, depthWrite: true, side: THREE.BackSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.scale.setScalar(rs * bound);
  mesh.renderOrder = 18;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  const camW = V();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    camera.getWorldPosition(camW);
    mesh.worldToLocal(camW);
    material.uniforms.uCam.value.copy(camW).multiplyScalar(material.uniforms.uB.value);
    material.uniforms.uTime.value = ctx.t;
  };
  parent.add(mesh);
  return {
    mesh,
    uniforms: material.uniforms,
    setRs(v) { material.uniforms.uR1.value = v; },
    /* Two holes: positions relative to the mesh, radii; r2 = 0 for one. */
    setHoles(p1, r1, p2 = null, r2 = 0) {
      material.uniforms.uP1.value.copy(p1);
      material.uniforms.uR1.value = r1;
      if (p2) material.uniforms.uP2.value.copy(p2);
      material.uniforms.uR2.value = r2;
    },
  };
}

/* ------------------------------------------------------------ neutron stars */

/*
 * A neutron star: a small hot ball, its magnetic field (a dipole: field
 * lines r = L sin^2 theta about the magnetic axis), and two beams along the
 * magnetic axis, tilted from the spin axis (+y) by `tilt`; update(t, turns
 * per second) spins it. The beams sweeping past us are a pulsar's pulses.
 */
export function neutronStar(ctx, parent, r, { tilt = 0.5, beamLen = 30, field = true, colour = "#cfe2ff", beamColour = "#9fd0ff", lines = 8, reach = [3, 5, 8] } = {}) {
  const spin = new THREE.Group();
  parent.add(spin);
  const mag = new THREE.Group();
  mag.rotation.z = tilt;
  spin.add(mag);
  const ball = ctx.sun(r, { colour, hot: "#ffffff", halo: 5, haloColour: colour, haloOpacity: 0.7, granule: 10, parent: spin });
  const fieldGroup = new THREE.Group();
  mag.add(fieldGroup);
  if (field) {
    reach.forEach((L, li) => {
      for (let k = 0; k < lines; k += 1) {
        const az = (k / lines) * TAU + li * 0.3;
        const pts = [];
        const th0 = Math.asin(Math.sqrt(Math.min(1, 1.02 / L)));
        for (let i = 0; i <= 60; i += 1) {
          const th = th0 + ((Math.PI - 2 * th0) * i) / 60;
          const rr = r * L * Math.sin(th) ** 2;
          pts.push(V(rr * Math.sin(th) * Math.cos(az), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(az)));
        }
        ctx.line(pts, { colour: "#7fb0ff", opacity: 0.35 - li * 0.06, parent: fieldGroup });
      }
    });
  }
  const beams = [1, -1].map((s) => {
    const geo = new THREE.ConeGeometry(beamLen * 0.12, beamLen, 32, 1, true);
    geo.translate(0, -beamLen / 2, 0);
    const mat = new THREE.MeshBasicMaterial({ color: beamColour, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const cone = new THREE.Mesh(geo, mat);
    cone.userData.baseOpacity = 0.35;
    cone.rotation.x = s > 0 ? Math.PI : 0;
    cone.renderOrder = 23;
    mag.add(cone);
    const core = ctx.line([V(0, r * 1.2 * s, 0), V(0, beamLen * s, 0)], { colour: "#ffffff", opacity: 0.8, parent: mag });
    return { cone, core };
  });
  let angle = 0;
  let lastT = null;
  return {
    spin, mag, ball, fieldGroup, beams,
    get angle() { return angle; },
    update(t, turnsPerSecond = 0.3) {
      if (lastT == null) lastT = t;
      angle += Math.max(0, t - lastT) * turnsPerSecond * TAU;
      lastT = t;
      spin.rotation.y = angle;
    },
    /* The magnetic axis in the parent's frame. */
    axis(out = V()) {
      spin.updateMatrix();
      mag.updateMatrix();
      return out.set(0, 1, 0).applyQuaternion(mag.quaternion).applyQuaternion(spin.quaternion);
    },
  };
}

/* ------------------------------------------------------------ clouds */

/*
 * A cloud of `count` points placed by `place(r, i) -> {p, c, a, s}`
 * (position, colour, alpha, size factor). Additive for glowing gas, normal
 * for dark dust.
 */
export function cloudOf(ctx, parent, count, place, { size = 3, seed = 11, additive = true } = {}) {
  const r = rng(seed);
  const cloud = ctx.cloud(count, { parent, size, additive });
  const base = new Float32Array(count * 3);
  const alpha0 = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const o = place(r, i);
    cloud.set(i, o.p.x, o.p.y, o.p.z);
    base[i * 3] = o.p.x; base[i * 3 + 1] = o.p.y; base[i * 3 + 2] = o.p.z;
    cloud.tint(i, o.c);
    cloud.alpha[i] = o.a;
    alpha0[i] = o.a;
    cloud.size[i] = size * (o.s ?? 1);
  }
  cloud.commit();
  let lastScale = 1;
  return {
    cloud, base, alpha0,
    /* Scales the cloud about its centre (an expansion) and sets alpha. */
    set(scale = 1, alpha = 1) {
      cloud.opacity = alpha;
      cloud.points.visible = alpha > 0.002;
      if (!cloud.points.visible || scale === lastScale) return;
      lastScale = scale;
      cloud.points.scale.setScalar(Math.max(1e-4, scale));
    },
    show(alpha) { cloud.opacity = alpha; cloud.points.visible = alpha > 0.002; },
  };
}

/* A filamentary shell (a supernova remnant): filaments as arcs of great
 * circles on a lumpy shell of radius R, and a haze inside. */
export function remnant(ctx, parent, R, { count = 5000, filament = ["#ff6a4a", "#ffb08a", "#ffd27f"], haze = "#7fa8ff", hazeShare = 0.3, seed = 13, stretch = [1, 1, 1], size = 2.6 } = {}) {
  const fil = [];
  const rr = rng(seed + 1);
  for (let k = 0; k < 40; k += 1) {
    const a = V(gauss(rr), gauss(rr), gauss(rr)).normalize();
    const b = V(gauss(rr), gauss(rr), gauss(rr)).cross(a).normalize();
    fil.push({ a, b, ph: rr() * TAU, len: 0.6 + rr() * 1.6, col: filament[k % filament.length] });
  }
  const st = V(...stretch);
  return cloudOf(ctx, parent, count, (r, i) => {
    if (r() < hazeShare) {
      const d = V(gauss(r), gauss(r), gauss(r)).normalize().multiplyScalar(R * Math.pow(r(), 0.7) * 0.8);
      return { p: d.multiply(st), c: haze, a: 0.12 + 0.2 * r(), s: 1.2 };
    }
    const f = fil[i % fil.length];
    const t = f.ph + (r() - 0.5) * f.len;
    const d = f.a.clone().multiplyScalar(Math.cos(t)).addScaledVector(f.b, Math.sin(t));
    d.x += gauss(r) * 0.05; d.y += gauss(r) * 0.05; d.z += gauss(r) * 0.05;
    const k = R * (0.82 + 0.18 * r()) * (1 + 0.12 * Math.sin(3 * t + f.ph));
    return { p: d.normalize().multiplyScalar(k).multiply(st), c: f.col, a: 0.35 + 0.5 * r(), s: 0.7 + 0.6 * r() };
  }, { size, seed });
}

/* ------------------------------------------------------------ photographs into 3D */

/*
 * Round 90 (Prompts.md: "we have to create like that image ... the visual,
 * the colour, the texture ... not showing image, experience the event"):
 * a nebula rebuilt in 3D from a photograph of it. The picture is read
 * pixel by pixel; each patch of light becomes a soft glowing point with
 * that patch's colour, placed at a depth that fits what the object is:
 *
 *   shell  a supernova remnant: the bright filaments on an expanding
 *          ellipsoidal shell (front or back half), the blue haze of the
 *          pulsar wind filling the inside (the Crab)
 *   plane  rings seen at a tilt: each point lifted onto the tilted plane
 *          its ring lies in (SN 1987A's equatorial ring, inclined ~43°,
 *          Sugerman et al. 2005), the ejecta in the middle given depth
 *   layers a dark cloud in front of glowing gas (the Horsehead): the
 *          bluish sky farthest, the pink glowing wall behind, the brown
 *          dust in front, darker = nearer
 *   ball   a remnant filled through (Tycho's, round 91): every point
 *          somewhere inside the sphere its outline draws, so the rim stays
 *          a thin bright edge and the knots fill the middle in depth
 *
 * Round 91: `hole` (a radius, as a share of the half-width) leaves out the
 * middle, where something drawn in 3D of its own sits (Eta Carinae's
 * lobes, V838 Mon's star); reveal(R, w) shows only what light has reached
 * by radius R (a light echo), brightest near R.
 *
 * So the camera can move round it and see it as an object in space, with
 * the photograph's own colours. Points are sized in world units (they grow
 * as the camera comes closer), so it holds together at any distance.
 */
const NEB_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uPx;
uniform float uGrow;
uniform float uReach;
uniform float uReachW;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  if (uReach >= 0.0) {
    float d = length(position);
    vAlpha *= (1.0 - smoothstep(uReach - uReachW * 0.3, uReach + uReachW * 0.3, d)) * (0.35 + 0.65 * exp(-abs(uReach - d) / uReachW));
  }
  vec4 mv = modelViewMatrix * vec4(position * uGrow, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx / max(0.001, -mv.z), 1.0, 64.0);
}
`;
const NEB_FRAGMENT = /* glsl */ `
uniform float uOpacity;
uniform float uFall;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = exp(-dot(c, c) * uFall) * (1.0 - smoothstep(0.42, 0.5, length(c)));
  gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`;
export function imageNebula(ctx, parent, url, width, { mode = "shell", step = 4, threshold = 0.05, depth = 0.4, keep = 1.2, tilt = 43, additive = true, gain = 0.75, sizeK = 1.7, seed = 5, floor = 0, inner = 1, backfill = null, hole = 0, gas = 0 } = {}) {
  /* gas 0..1 (round 93, Prompts.md: "it has a chips kind of structure --
   * make it like the gaseous designs of our space background"): softer,
   * fainter, bigger points that melt into one another, and over them a
   * coarse layer of very large, very faint ones -- a haze in the picture's
   * own colours -- so it reads as gas, not flakes. */
  /* backfill (layers mode): a colour for the glowing wall behind the dust,
   * put behind every dust pixel too, so where the dust slides aside there
   * is lit gas, not a hole (IC 434 runs on behind the Horsehead). */
  const back = backfill ? new THREE.Color(backfill) : null;
  /* floor: the photograph's background level (its sky is not quite black),
   * taken off every pixel so space stays black. */
  const g = new THREE.Group();
  parent.add(g);
  const material = new THREE.ShaderMaterial({
    vertexShader: NEB_VERTEX, fragmentShader: NEB_FRAGMENT,
    uniforms: { uPx: { value: 400 }, uOpacity: { value: 0 }, uGrow: { value: 1 }, uReach: { value: -1 }, uReachW: { value: 1 }, uFall: { value: 10 - 5 * gas } },
    transparent: true, depthWrite: false, toneMapped: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  let points = null;
  const sizeV = new THREE.Vector2();
  const img = new Image();
  img.onload = () => {
    const cw = Math.max(8, Math.floor(img.width / step));
    const ch = Math.max(8, Math.floor(img.height / step));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const c2 = canvas.getContext("2d", { willReadFrequently: true });
    c2.drawImage(img, 0, 0, cw, ch);
    const data = c2.getImageData(0, 0, cw, ch).data;
    const r = rng(seed);
    const scale = width / cw;
    const H2 = (ch * scale) / 2;
    const W2 = width / 2;
    const pos = [];
    const col = [];
    const siz = [];
    const alp = [];
    const c = new THREE.Color();
    const ti = Math.tan((tilt * Math.PI) / 180);
    for (let y = 0; y < ch; y += 1) {
      for (let x = 0; x < cw; x += 1) {
        const k = (y * cw + x) * 4;
        const R = Math.max(0, data[k] / 255 - floor) / (1 - floor);
        const G = Math.max(0, data[k + 1] / 255 - floor) / (1 - floor);
        const B = Math.max(0, data[k + 2] / 255 - floor) / (1 - floor);
        const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        if (additive && lum < threshold) continue;
        const nx = (x + 0.5) / cw * 2 - 1;
        const ny = 1 - (y + 0.5) / ch * 2;
        const rad = Math.hypot(nx, ny * (ch / cw));
        if (rad > keep || rad < hole) continue;
        const px = nx * W2 + (r() - 0.5) * scale;
        const py = ny * H2 + (r() - 0.5) * scale;
        let pz = 0;
        if (mode === "shell") {
          const s2 = Math.min(1, (nx * nx) / 1 + (ny * ny));
          const bluish = B > R * 1.05 && B > 0.25;
          const surface = Math.sqrt(Math.max(0, 1 - s2));
          pz = (bluish ? (r() * 2 - 1) * surface * 0.85 : (r() < 0.5 ? 1 : -1) * surface * (0.8 + 0.25 * r())) * W2 * depth;
        } else if (mode === "ball") {
          const s2 = Math.min(1, nx * nx + ny * ny);
          pz = (r() * 2 - 1) * Math.sqrt(Math.max(0, 1 - s2)) * W2 * depth;
        } else if (mode === "plane") {
          pz = py * ti + (rad < 0.12 ? (r() - 0.5) * W2 * 0.12 : (r() - 0.5) * scale * 2);
        } else {
          const sky = B > R * 1.02 && lum > 0.12;
          const dust = R > B * 1.15;
          pz = sky ? -W2 * depth * (0.8 + 0.2 * r()) : dust ? W2 * depth * (0.05 + 0.5 * (1 - Math.min(1, lum * 2.2))) * (0.7 + 0.6 * r()) : -W2 * depth * (0.35 + 0.2 * r());
        }
        c.setRGB(R, G, B, THREE.SRGBColorSpace);
        /* Layers (a nebula seen face-on, round 93): the picture's edges
         * fade out, so no straight border shows as the camera moves. */
        const edgeK = mode === "layers" ? clamp01((1 - Math.max(Math.abs(nx), Math.abs(ny))) / 0.14) : 1;
        if (edgeK <= 0.01) continue;
        if (back && mode === "layers" && R > B * 1.15) {
          pos.push(px, py, -W2 * depth * (0.8 + 0.2 * r()));
          col.push(back.r * gain, back.g * gain, back.b * gain);
          siz.push(scale * sizeK * 1.2);
          alp.push(0.92 * edgeK);
        }
        pos.push(px, py, pz);
        /* inner: the glow filling a shell's inside (the Crab's blue-white
         * synchrotron light) drawn fainter, so the filaments carry it. */
        const gk = mode === "shell" && B > R * 1.05 && B > 0.25 ? gain * inner : gain;
        col.push(c.r * gk, c.g * gk, c.b * gk);
        siz.push(scale * sizeK * (0.8 + 0.4 * r()) * (1 + 0.6 * gas));
        alp.push((additive ? 1 - 0.45 * gas : 0.92 - 0.5 * gas) * edgeK);
        /* The haze: every third pixel each way, a big faint point a little
         * behind it. */
        if (gas > 0 && x % 3 === 0 && y % 3 === 0) {
          pos.push(px, py, pz - scale * 2);
          col.push(c.r * gk, c.g * gk, c.b * gk);
          siz.push(scale * sizeK * 4.5);
          alp.push((additive ? 0.16 : 0.22) * gas * edgeK);
        }
      }
    }
    /* Normal blending draws in order: far first. */
    let order = Array.from({ length: pos.length / 3 }, (_, i) => i);
    if (!additive) order = order.sort((a, b) => pos[a * 3 + 2] - pos[b * 3 + 2]);
    const P = new Float32Array(order.length * 3);
    const C = new Float32Array(order.length * 3);
    const S = new Float32Array(order.length);
    const A = new Float32Array(order.length);
    order.forEach((o, i) => {
      P[i * 3] = pos[o * 3]; P[i * 3 + 1] = pos[o * 3 + 1]; P[i * 3 + 2] = pos[o * 3 + 2];
      C[i * 3] = col[o * 3]; C[i * 3 + 1] = col[o * 3 + 1]; C[i * 3 + 2] = col[o * 3 + 2];
      S[i] = siz[o]; A[i] = alp[o];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(C, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(S, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(A, 1));
    points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    points.renderOrder = 14;
    points.onBeforeRender = (renderer, scene, camera) => {
      renderer.getDrawingBufferSize(sizeV);
      material.uniforms.uPx.value = (sizeV.y * camera.projectionMatrix.elements[5]) / 2;
    };
    g.add(points);
  };
  img.src = url;
  return {
    group: g,
    /* A light echo: only what light has reached by R, brightest near R
     * (R < 0: everything). */
    reveal(R, w = 1) {
      material.uniforms.uReach.value = R;
      material.uniforms.uReachW.value = Math.max(1e-3, w);
    },
    show(a, grow = 1) {
      material.uniforms.uOpacity.value = a;
      material.uniforms.uGrow.value = grow;
      g.visible = a > 0.002;
    },
    get ready() { return Boolean(points); },
  };
}

/* ------------------------------------------------------------ galaxies */

/*
 * A galaxy of points, in its own x-z plane, radius R. Types (Hubble, 1926):
 * "spiral", "barred", "elliptical" (with `axes` [a, b, c]), "lenticular",
 * "irregular".
 */
export function galaxy(ctx, parent, type, R, { count = 6000, seed = 7, size = 2, arms = 2, pitchDeg = 14, axes = [1, 0.75, 0.6], core = "#ffe2b0", arm = "#b8ccff", pink = "#ff8fb8", dust = false } = {}) {
  const cCore = new THREE.Color(core);
  const cArm = new THREE.Color(arm);
  const cPink = new THREE.Color(pink);
  const pitch = Math.tan(pitchDeg * DEG);
  const g = new THREE.Group();
  parent.add(g);
  const blobs = (() => { const r = rng(seed + 9); return Array.from({ length: 7 }, () => ({ p: V(gauss(r) * R * 0.5, gauss(r) * R * 0.12, gauss(r) * R * 0.45), s: R * (0.12 + r() * 0.25) })); })();
  const c = new THREE.Color();
  const body = cloudOf(ctx, g, count, (r) => {
    if (type === "elliptical") {
      const k = Math.pow(r(), 2.2);
      const d = V(gauss(r), gauss(r), gauss(r)).normalize().multiplyScalar(R * k);
      d.multiply(V(axes[0], axes[1], axes[2]));
      c.copy(cCore).lerp(new THREE.Color("#ffd0a0"), r() * 0.4);
      return { p: d, c: c.clone(), a: 0.25 + 0.55 * (1 - k), s: 0.8 + r() * 0.6 };
    }
    if (type === "irregular") {
      const b = blobs[Math.floor(r() * blobs.length)];
      const d = V(gauss(r), gauss(r) * 0.5, gauss(r)).multiplyScalar(b.s).add(b.p);
      c.copy(cArm).lerp(cCore, r() * 0.5);
      if (r() < 0.1) c.copy(cPink);
      return { p: d, c: c.clone(), a: 0.2 + 0.5 * r(), s: 0.7 + r() };
    }
    const kind = r();
    const bulge = type === "lenticular" ? 0.45 : 0.18;
    if (kind < bulge) {
      if (type === "barred" && r() < 0.6) {
        const t = (r() * 2 - 1) * R * 0.3;
        return { p: V(t, gauss(r) * R * 0.03, gauss(r) * R * 0.05), c: cCore.clone(), a: 0.45 + 0.4 * r(), s: 1 };
      }
      const d = V(gauss(r), gauss(r) * 0.6, gauss(r)).multiplyScalar(R * 0.12);
      return { p: d, c: cCore.clone(), a: 0.5 + 0.4 * r(), s: 1.1 };
    }
    if (type === "lenticular") {
      const rr = R * Math.pow(r(), 0.8);
      const th = r() * TAU;
      c.copy(cCore).lerp(new THREE.Color("#f4e6d0"), rr / R);
      return { p: V(Math.cos(th) * rr, gauss(r) * R * 0.02, Math.sin(th) * rr), c: c.clone(), a: 0.18 + 0.35 * r() * (1 - rr / R), s: 0.9 };
    }
    const start = type === "barred" ? 0.3 : 0.12;
    const which = Math.floor(r() * arms);
    const rr = R * (start + (1 - start) * Math.pow(r(), 0.75));
    /* A third of the disc's stars lie between the arms. */
    if (r() < 0.33) {
      const th2 = r() * TAU;
      c.copy(cCore).lerp(cArm, Math.min(1, rr / (R * 0.6)));
      return { p: V(Math.cos(th2) * rr, gauss(r) * R * 0.02, Math.sin(th2) * rr), c: c.clone(), a: 0.1 + 0.2 * r(), s: 0.7 };
    }
    const th = (which * TAU) / arms + Math.log(rr / (R * start)) / pitch + gauss(r) * 0.38;
    c.copy(cCore).lerp(cArm, Math.min(1, rr / (R * 0.55)));
    if (r() < 0.07) c.copy(cPink);
    return { p: V(Math.cos(th) * rr, gauss(r) * R * 0.015, Math.sin(th) * rr), c: c.clone(), a: 0.25 + 0.55 * r(), s: 0.7 + r() * 0.8 };
  }, { size, seed });
  let dustCloud = null;
  if (dust) {
    dustCloud = cloudOf(ctx, g, Math.round(count * 0.25), (r) => {
      const rr = R * (0.3 + 0.6 * r());
      const th = r() * TAU;
      return { p: V(Math.cos(th) * rr, gauss(r) * R * 0.006, Math.sin(th) * rr), c: "#1a0e08", a: 0.5 * r(), s: 1.6 };
    }, { size: size * 1.6, seed: seed + 3, additive: false });
  }
  const glowS = ctx.glow(core, R * (type === "elliptical" ? 1.1 : 0.55), { opacity: type === "elliptical" ? 0.35 : 0.4, parent: g });
  return {
    group: g, body, dust: dustCloud, glow: glowS,
    show(a) { body.show(a); dustCloud?.show(a); ctx.fade(glowS, a); },
  };
}

/* ------------------------------------------------------------ rings */

/* A ring system with `profile(u) -> [opacity, r, g, b]` across it (u from
 * the inner to the outer edge), drawn into a strip texture; in its
 * parent's x-z plane. */
export function ringSystem(ctx, parent, inner, outer, profile, { opacity = 0.9 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 4;
  const g2 = canvas.getContext("2d");
  for (let x = 0; x < 1024; x += 1) {
    const [a, r, g, b] = profile(x / 1023);
    g2.fillStyle = `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
    g2.fillRect(x, 0, 1, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = ctx.ring(inner, outer, { colour: "#ffffff", map: tex, opacity, segments: 256, parent });
  mesh.material.alphaTest = 0.01;
  return mesh;
}

/* ------------------------------------------------------------ Dyson rings */

/*
 * Round 93 (Prompts.md: the swarm "looks like chips ... I have added an
 * image of a Dyson sphere; the panels which harness the Sun -- make it like
 * that in 3D"): a Dyson swarm as it is usually drawn and as the picture
 * shows it -- broad bands of collectors on orbits at many tilts round the
 * star, each band packed with curved panels facing the star, glowing gold
 * and orange in its light, with a lattice of tiny lights on a sphere round
 * it all. (Dyson 1960 proposed a swarm of separate orbiting collectors,
 * not a solid shell.) update(t, built, alpha): `built` 0..1 adds the bands
 * one after another, each filling round its orbit.
 */
export function dysonRings(ctx, parent, R, { bands = 9, around = 60, across = 3, seed = 17 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  parent.add(g);
  const panelW = (TAU * R) / around * 0.9;
  const panelH = R * 0.042;
  const geo = new THREE.PlaneGeometry(panelW, panelH);
  /* Solid panels (they block light: that is the point), lit orange-gold
   * by the star; normal blending so overlapping bands do not burn white. */
  const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, side: THREE.DoubleSide, toneMapped: false, depthWrite: true });
  const total = bands * around * across;
  const inst = new THREE.InstancedMesh(geo, mat, total);
  inst.frustumCulled = false;
  inst.renderOrder = 22;
  g.add(inst);
  const cA = new THREE.Color("#a8460e");
  const cB = new THREE.Color("#ffb04a");
  const c = new THREE.Color();
  const B = Array.from({ length: bands }, (_, i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * Math.PI, r() * TAU, (r() - 0.5) * Math.PI));
    return { q, rr: R * (0.94 + 0.12 * r()), w: 0.6 + 0.9 * r(), speed: (0.05 + 0.08 * r()) * (r() < 0.5 ? 1 : -1), ph: r() * TAU, order: i };
  });
  let k = 0;
  B.forEach((b) => {
    for (let j = 0; j < around; j += 1) {
      for (let m = 0; m < across; m += 1) {
        c.copy(cA).lerp(cB, r()).multiplyScalar(0.55 + 0.45 * r());
        inst.setColorAt(k, c);
        k += 1;
      }
    }
  });
  inst.instanceColor.needsUpdate = true;
  /* The lattice of lights. */
  const dots = cloudOf(ctx, g, 2400, (rn) => {
    const d = V(gauss(rn), gauss(rn), gauss(rn)).normalize();
    return { p: d.multiplyScalar(R * 1.12), c: rn() < 0.7 ? "#ffb05a" : "#fff2c8", a: 0.3 + 0.5 * rn(), s: 0.6 + rn() * 0.6 };
  }, { size: 1.8, seed: seed + 3 });
  const m4 = new THREE.Matrix4();
  const pos = V();
  const local = V();
  const qq = new THREE.Quaternion();
  const look = new THREE.Matrix4();
  const up = V(0, 1, 0);
  const origin = V();
  const one = V(1, 1, 1);
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    group: g,
    update(t, built = 1, alpha = 1) {
      g.visible = alpha > 0.002;
      mat.opacity = 0.95 * alpha;
      dots.show(alpha * 0.8 * clamp01(built * 1.5));
      if (!g.visible) return;
      let i = 0;
      B.forEach((b, bi) => {
        /* This band's share of the build: each fills round its orbit. */
        const share = clamp01(built * bands - bi);
        const shown = Math.floor(share * around);
        const turn = b.ph + t * b.speed;
        for (let j = 0; j < around; j += 1) {
          for (let mm = 0; mm < across; mm += 1) {
            if (j >= shown) { inst.setMatrixAt(i, hidden); i += 1; continue; }
            const th = turn + (j / around) * TAU;
            const v = ((mm + 0.5) / across - 0.5) * panelH * across * 1.05 * b.w;
            local.set(Math.cos(th) * b.rr, v, Math.sin(th) * b.rr).applyQuaternion(b.q);
            pos.copy(local);
            look.lookAt(pos, origin, up);
            qq.setFromRotationMatrix(look);
            m4.compose(pos, qq, one);
            inst.setMatrixAt(i, m4);
            i += 1;
          }
        }
      });
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------ swarm */

/* A Dyson swarm: `count` flat collectors in orbits round a star, radius R;
 * update(t, built, alpha) shows the first `built` share of them. */
export function swarm(ctx, parent, R, { count = 1400, seed = 17, panel = 0.06 } = {}) {
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(panel * R, panel * R * 0.6);
  const mat = new THREE.MeshBasicMaterial({ color: "#c9d6e8", transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  inst.renderOrder = 22;
  parent.add(inst);
  const orbits = Array.from({ length: count }, () => {
    const n = V(gauss(r), gauss(r), gauss(r)).normalize();
    const a = V(1, 0, 0).cross(n);
    if (a.lengthSq() < 1e-3) a.set(0, 0, 1);
    a.normalize();
    const b = n.clone().cross(a).normalize();
    return { a, b, ph: r() * TAU, w: 0.25 + 0.1 * r(), rr: R * (0.96 + 0.08 * r()) };
  });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = V();
  const s = V(1, 1, 1);
  const look = new THREE.Matrix4();
  const origin = V();
  const up = V(0, 1, 0);
  return {
    mesh: inst,
    update(t, built = 1, alpha = 1) {
      const n = Math.round(count * clamp01(built));
      inst.count = n;
      mat.opacity = 0.9 * alpha;
      inst.visible = alpha > 0.002 && n > 0;
      if (!inst.visible) return;
      for (let i = 0; i < n; i += 1) {
        const o = orbits[i];
        const th = o.ph + t * o.w;
        p.copy(o.a).multiplyScalar(Math.cos(th) * o.rr).addScaledVector(o.b, Math.sin(th) * o.rr);
        look.lookAt(p, origin, up);
        q.setFromRotationMatrix(look);
        m.compose(p, q, s);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ------------------------------------------------------------ cosmic web */

/*
 * The large-scale structure: galaxies along filaments between clusters in
 * a cube of half-size L, with an empty sphere (a void) of radius `voidR`
 * at the origin holding only `inside` galaxies.
 */
export function cosmicWeb(ctx, parent, L, { voidR = 0, inside = 60, count = 9000, seed = 31, size = 2 } = {}) {
  const r = rng(seed);
  const nodes = [];
  let guard = 0;
  while (nodes.length < 150 && guard < 20000) {
    guard += 1;
    const p = V((r() * 2 - 1) * L, (r() * 2 - 1) * L, (r() * 2 - 1) * L);
    if (p.length() > voidR * 1.15) nodes.push(p);
  }
  const edges = [];
  nodes.forEach((a, i) => {
    const near = nodes.map((b, j) => ({ j, d: a.distanceTo(b) })).filter((o) => o.j !== i).sort((x, y) => x.d - y.d).slice(0, 4);
    near.forEach((o) => { if (o.j > i) edges.push([a, nodes[o.j]]); });
  });
  const tmp = V();
  return cloudOf(ctx, parent, count, (rr, i) => {
    if (i < inside && voidR > 0) {
      const d = V(gauss(rr), gauss(rr), gauss(rr)).normalize().multiplyScalar(voidR * Math.cbrt(rr()) * 0.9);
      return { p: d, c: "#ffe2a8", a: 0.95, s: 1.8 };
    }
    if (rr() < 0.25) {
      const n = nodes[Math.floor(rr() * nodes.length)];
      const d = V(gauss(rr), gauss(rr), gauss(rr)).multiplyScalar(L * 0.03).add(n);
      return { p: d, c: "#ffd9b0", a: 0.5 + 0.4 * rr(), s: 1.1 };
    }
    for (let tries = 0; tries < 6; tries += 1) {
      const [a, b] = edges[Math.floor(rr() * edges.length)];
      tmp.copy(a).lerp(b, rr());
      tmp.x += gauss(rr) * L * 0.035; tmp.y += gauss(rr) * L * 0.035; tmp.z += gauss(rr) * L * 0.035;
      if (tmp.length() > voidR) break;
    }
    return { p: tmp.clone(), c: rr() < 0.5 ? "#b8ccff" : "#e8dcff", a: 0.18 + 0.35 * rr(), s: 0.7 };
  }, { size, seed });
}

/* ------------------------------------------------------------ wormhole */

/*
 * A wormhole's mouth as it might look: a sphere through which another sky
 * is seen, squeezed toward the rim (light from the far side bent round the
 * throat), with a bright ring where the two skies meet. A picture, not a
 * calculation -- no wormhole has ever been found.
 */
const WH_VERTEX = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const WH_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uSkyA;
uniform vec3 uSkyB;
uniform float uWhite;
varying vec3 vN;
varying vec3 vV;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 n = normalize(vN);
  float mu = max(dot(n, normalize(vV)), 0.0);
  float rim = 1.0 - mu;
  vec2 uv = n.xy / max(mu, 0.08) * (0.6 + 0.4 * mu);
  uv = vec2(atan(uv.y, uv.x) * 1.6 + uTime * 0.05, log(length(uv) + 0.05) * 2.5 - uTime * 0.2 * uWhite);
  float neb = n2(uv * 2.0) * 0.6 + n2(uv * 5.0 + 3.0) * 0.4;
  vec3 col = mix(uSkyA, uSkyB, neb) * (0.35 + 0.65 * neb);
  vec2 g = uv * 18.0;
  float s = step(0.93, h2(floor(g))) * smoothstep(0.35, 0.0, length(fract(g) - 0.5));
  col += vec3(s);
  col += vec3(1.0, 0.92, 0.8) * pow(rim, 6.0) * 2.2;
  col = mix(col, vec3(1.0, 0.97, 0.92) * (0.8 + 0.4 * neb), uWhite * (0.4 + 0.6 * mu));
  gl_FragColor = vec4(col, uOpacity * smoothstep(0.0, 0.08, mu + 0.02));
  #include <colorspace_fragment>
}
`;
export function wormhole(ctx, parent, r, { skyA = "#2a1660", skyB = "#4ad0ff", white = 0 } = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: WH_VERTEX,
    fragmentShader: WH_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uSkyA: { value: new THREE.Color(skyA) }, uSkyB: { value: new THREE.Color(skyB) }, uWhite: { value: white } },
    transparent: true, toneMapped: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), material);
  mesh.renderOrder = 21;
  mesh.onBeforeRender = () => { material.uniforms.uTime.value = ctx.t; };
  parent.add(mesh);
  return mesh;
}

/*
 * Round 93 (Prompts.md: "redesign the wormhole more realistic -- it looks
 * blue but it is ideally black ... and show how travelling into it looks,
 * all the stars and galaxies circling round"): a traversable wormhole's
 * mouth as it was rendered for Interstellar (James, von Tunzelmann,
 * Franklin & Thorne 2015, "Visualizing Interstellar's wormhole"): a sphere
 * like a crystal ball. Looking into it you see the sky of the far end --
 * deep black space with its own stars and a galaxy -- squeezed and bent,
 * the view swinging further round the closer to the rim you look; round
 * the rim, a ring of our own sky, bent right round the throat (an Einstein
 * ring). It has no horizon, so it is not black like a black hole -- but it
 * is mostly the black of the far end's space.
 *
 * Each pixel: the ray from the camera, its closeness to the rim x (0 at the
 * centre, 1 at the rim); through the throat it is turned by pi * x^1.6;
 * near the rim our sky (skyCol, the same as lensSky), turned by
 * pi * (1 + (x - 1) * 4). uSwap 1 shows it from the far side.
 */
const WHM_VERTEX = /* glsl */ `
varying vec3 vW;
void main() {
  vW = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const WHM_GLSL = /* glsl */ `
vec3 rotAx(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }
/* The far end's sky: black, its own stars, one spiral galaxy and a faint
 * band of gas -- another place. */
vec3 farSky(vec3 d) {
  vec3 col = starLayer(d.zxy, 60.0, 0.86, 0.15) * 0.9 + starLayer(d.yzx, 140.0, 0.92, 0.2) * 0.5;
  vec3 gdir = normalize(vec3(0.3, 0.25, -1.0));
  float ga = acos(clamp(dot(d, gdir), -1.0, 1.0));
  vec3 gx = normalize(cross(gdir, vec3(0.0, 1.0, 0.0)));
  vec3 gy = cross(gx, gdir);
  vec2 pp = vec2(dot(d, gx), dot(d, gy)) / 0.16;
  float rr = length(pp);
  float arm = 0.5 + 0.5 * cos(2.0 * (atan(pp.y, pp.x) - 2.4 * log(rr + 0.05)));
  float gal = exp(-rr * 2.2) * (0.6 + 0.8 * arm) + exp(-rr * 9.0) * 1.5;
  col += mix(vec3(0.55, 0.65, 1.0), vec3(1.0, 0.86, 0.62), exp(-rr * 4.0)) * gal * 0.55 * step(ga, 1.2);
  float n = skn(d * 4.0 + 7.0) * 0.6 + skn(d * 9.0) * 0.4;
  float band = exp(-pow((d.x + 0.3 * (n - 0.5)) * 4.0, 2.0));
  col += vec3(0.25, 0.12, 0.3) * band * n * 0.25;
  return col;
}
`;
const WHM_FRAGMENT = /* glsl */ `
uniform vec3 uCam;
uniform float uR;
uniform float uOpacity;
uniform float uSwap;
varying vec3 vW;
${SKY_GLSL}
${WHM_GLSL}
void main() {
  /* In the mouth's own frame: its centre at the origin. */
  vec3 rd = normalize(vW - uCam);
  vec3 toC = -uCam;
  float dc = length(toC);
  vec3 cdir = toC / dc;
  /* Closeness to the rim, by the angle the ray makes with the centre. */
  float ang = acos(clamp(dot(rd, cdir), -1.0, 1.0));
  float edgeAng = asin(clamp(uR / dc, 0.0, 1.0));
  float x = clamp(ang / max(edgeAng, 1e-4), 0.0, 1.0);
  vec3 k = cross(rd, cdir);
  k = length(k) > 1e-5 ? normalize(k) : vec3(0.0, 1.0, 0.0);
  vec3 through = rotAx(rd, k, -3.14159 * pow(x, 1.6));
  vec3 rnd = rotAx(rd, k, 3.14159 * (1.0 + (x - 1.0) * 4.0));
  vec3 farC = uSwap > 0.5 ? skyCol(through) : farSky(through);
  vec3 nearC = uSwap > 0.5 ? farSky(rnd) : skyCol(rnd);
  float w = smoothstep(0.78, 0.93, x);
  vec3 col = mix(farC, nearC * 1.25, w);
  /* The thin bright edge where the two images meet. */
  col += vec3(0.9, 0.92, 1.0) * exp(-pow((x - 0.78) / 0.02, 2.0)) * 0.12;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
export function wormholeMouth(ctx, parent, r) {
  const uniforms = { uCam: { value: V() }, uR: { value: r }, uOpacity: { value: 1 }, uSwap: { value: 0 } };
  const material = new THREE.ShaderMaterial({ vertexShader: WHM_VERTEX, fragmentShader: WHM_FRAGMENT, uniforms, transparent: true, toneMapped: false, depthWrite: true });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 96, 48), material);
  mesh.renderOrder = 21;
  mesh.raycast = () => {};
  mesh.onBeforeRender = (renderer, scene, camera) => {
    camera.getWorldPosition(uniforms.uCam.value);
    mesh.worldToLocal(uniforms.uCam.value);
  };
  parent.add(mesh);
  return mesh;
}

/*
 * The crossing (round 94: the owner sent the Interstellar clip of the
 * Endurance going through -- used as a reference for the look, nothing
 * of it copied): inside the throat the view is a tunnel whose walls are
 * the sky itself, lensed into long curving sheets -- dark, cool teal-grey,
 * full of star-points smeared along the way we are moving, glassy rings
 * where the sheets fold, bright gold-white seams where a galaxy's light is
 * drawn out into arcs, dark smoky streams sliding past close by, a few
 * blue glints -- and, far ahead, the exit: a small crystal ball holding
 * the far end's sky, growing until it takes the whole view. The tunnel
 * slowly rolls and the view shakes a little.
 *
 * Coordinates: for each direction, its angle round the way ahead (phi)
 * and the depth along a tube of radius 1 at which it meets the wall
 * (z = cot of its angle from ahead); the wall pattern scrolls toward us in
 * z and twists with depth. set(k, ahead, eye, alpha): k 0..1 how far
 * through.
 */
const TUNNEL_VERTEX = /* glsl */ `
varying vec3 vD;
void main() {
  vD = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const TUNNEL_FRAGMENT = /* glsl */ `
uniform vec3 uF;
uniform vec3 uUp;
uniform float uK;
uniform float uTime;
uniform float uOpacity;
varying vec3 vD;
${SKY_GLSL}
${WHM_GLSL}
float fbm(vec3 p) {
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * skn(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}
/* Star-points on the wall, each drawn out along z (motion blur). */
float spark(vec2 p, float thr, float stretch) {
  vec2 c = floor(p);
  float h = skh(vec3(c, 1.0));
  vec2 o = vec2(0.2 + 0.6 * skh(vec3(c, 2.0)), 0.2 + 0.6 * skh(vec3(c, 3.0)));
  vec2 dd = (fract(p) - o) * vec2(1.0, stretch);
  return step(thr, h) * (1.0 - smoothstep(0.0, 0.1, length(dd))) * (0.5 + 0.8 * skh(vec3(c, 4.0)));
}
void main() {
  vec3 d = normalize(vD);
  vec3 f = normalize(uF);
  vec3 ax = normalize(cross(f, uUp));
  vec3 ay = cross(ax, f);
  float cz = dot(d, f);
  float sx = dot(d, ax);
  float sy = dot(d, ay);
  float rho = max(length(vec2(sx, sy)), 1e-4);
  float psi = atan(rho, cz);
  float phi = atan(sy, sx);
  /* Depth along the tube where this ray meets the wall. */
  float z = clamp(cz / rho, -4.0, 30.0);
  float travel = uTime * 2.2 + uK * 36.0;
  float zz = z + travel;
  float tw = phi + 0.28 * z + 0.25 * sin(zz * 0.35);
  /* Ahead the wall's pattern shrinks to nothing: fade it out with depth. */
  float farFade = 1.0 - smoothstep(6.0, 22.0, z);
  /* The wall: very dark teal-grey, mottled (linear values: the output
   * is brightened by the sRGB conversion). */
  float sm = fbm(vec3(cos(tw) * 1.6, sin(tw) * 1.6, zz * 0.25));
  vec3 col = vec3(0.003, 0.009, 0.011) * (0.3 + 2.2 * sm * sm);
  /* Glassy arcs where the lensed sheets fold. */
  col += vec3(0.018, 0.045, 0.05) * pow(0.5 + 0.5 * sin(zz * 1.7 + sm * 4.0), 40.0);
  /* Stars smeared along the way: two layers. Close by (small z) they
   * would be huge bars: dimmed there. */
  float near = smoothstep(0.25, 1.4, abs(z));
  float st = spark(vec2(tw * 14.0, zz * 3.0), 0.86, 0.18) + spark(vec2(tw * 34.0 + 3.0, zz * 7.0), 0.88, 0.3) * 0.7;
  float blue = step(0.93, skh(vec3(floor(vec2(tw * 14.0, zz * 3.0)), 7.0)));
  col += mix(vec3(0.75, 0.9, 1.0), vec3(0.2, 0.4, 1.0), blue) * st * near * 0.9 * (1.0 - 0.65 * smoothstep(0.22, 0.6, psi));
  /* Gold-white seams: a galaxy's light drawn out into thin, broken,
   * crinkled arcs (caustics of the lens). */
  float wob = fbm(vec3(tw * 3.0, zz * 0.8, 5.0));
  float seam = pow(max(0.0, sin(tw * 2.0 + zz * 0.45 + 1.3 + 1.6 * wob)), 500.0);
  float broken = smoothstep(0.42, 0.62, fbm(vec3(tw * 8.0, zz * 2.0, 2.0)));
  col += vec3(1.0, 0.78, 0.45) * seam * broken * 1.2;
  col += vec3(1.0, 0.9, 0.7) * spark(vec2(tw * 40.0, zz * 9.0), 0.7, 0.4) * pow(max(0.0, sin(tw * 2.0 + zz * 0.45 + 1.3 + 1.6 * wob)), 60.0) * 1.5;
  /* Dark smoke sliding past, close by. */
  float smoke = smoothstep(0.5, 0.72, fbm(vec3(cos(tw + 0.8) * 1.2, sin(tw + 0.8) * 1.2, zz * 0.12 - uTime * 0.05)));
  col = mix(col, vec3(0.012, 0.02, 0.024), smoke * 0.85 * smoothstep(0.15, 0.6, psi));
  col *= farFade;
  /* Ahead: the exit, a crystal ball showing the far end, growing. */
  float r0 = 0.05 + 0.12 * uK + 2.9 * smoothstep(0.82, 1.0, uK);
  float x = psi / r0;
  vec3 kx = normalize(cross(d, f) + vec3(1e-5));
  vec3 thru = rotAx(d, kx, -3.14159 * pow(clamp(x, 0.0, 1.0), 1.6));
  vec3 ball = farSky(thru) * 1.3 + vec3(0.3, 0.5, 0.55) * exp(-pow((x - 0.96) / 0.04, 2.0)) * 0.25;
  col = mix(col, ball, 1.0 - smoothstep(0.92, 1.0, x));
  /* A faint glow round the exit, lighting the tunnel's far end. */
  col += vec3(0.02, 0.05, 0.06) * exp(-psi / max(r0 * 2.5, 1e-3));
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;
export function wormholeTunnel(ctx, parent, R = 40) {
  const uniforms = { uF: { value: V(0, 0, -1) }, uUp: { value: V(0, 1, 0) }, uK: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 } };
  /* Opaque over everything while inside. */
  const material = new THREE.ShaderMaterial({ vertexShader: TUNNEL_VERTEX, fragmentShader: TUNNEL_FRAGMENT, uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, transparent: true });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), material);
  mesh.renderOrder = 40;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.visible = false;
  parent.add(mesh);
  const f = V();
  const up = V();
  return {
    mesh,
    set(k, ahead, eye, alpha) {
      const t = ctx.t;
      /* A little shake, and a slow roll of the tunnel round us. */
      const shake = 0.012 * (0.5 + 0.5 * Math.sin(t * 1.3));
      f.copy(ahead).add(V(Math.sin(t * 7.1) * shake, Math.sin(t * 5.3 + 1) * shake, Math.sin(t * 6.2 + 2) * shake)).normalize();
      up.set(0, 1, 0).applyAxisAngle(f, t * 0.25 + k * 1.5);
      uniforms.uK.value = k;
      uniforms.uF.value.copy(f);
      uniforms.uUp.value.copy(up);
      uniforms.uTime.value = t;
      uniforms.uOpacity.value = alpha;
      mesh.position.copy(eye);
      mesh.visible = alpha > 0.002;
    },
  };
}

/* A sky sphere of the far end's sky (farSky), for after the crossing. */
export function farSkySphere(ctx, parent, R = 6000) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: /* glsl */ `
uniform float uOpacity;
varying vec3 vDir;
${SKY_GLSL}
${WHM_GLSL}
void main() {
  gl_FragColor = vec4(farSky(normalize(vDir)) * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`,
    uniforms: { uOpacity: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 32), material);
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  parent.add(mesh);
  return { mesh, show(a) { material.uniforms.uOpacity.value = a; mesh.visible = a > 0.002; } };
}

/*
 * The "embedding diagram": space drawn as a sheet, bent into a funnel by a
 * mass -- and for a wormhole, two sheets joined by a throat (Flamm's
 * paraboloid, z = 2 sqrt(rs (r - rs)), mirrored). A grid of lines.
 */
export function funnel(ctx, parent, { rs = 1, R = 8, both = true, colour = "#7fb0ff", rings = 14, spokes = 28, opacity = 0.55 } = {}) {
  const g = new THREE.Group();
  parent.add(g);
  const z = (rr) => 2 * Math.sqrt(rs * Math.max(0, rr - rs));
  [1, ...(both ? [-1] : [])].forEach((s) => {
    for (let i = 0; i <= rings; i += 1) {
      const rr = rs + ((R - rs) * i * i) / (rings * rings);
      const pts = [];
      for (let k = 0; k <= 96; k += 1) {
        const a = (k / 96) * TAU;
        pts.push(V(Math.cos(a) * rr, s * z(rr), Math.sin(a) * rr));
      }
      ctx.line(pts, { colour, opacity, parent: g });
    }
    for (let k = 0; k < spokes; k += 1) {
      const a = (k / spokes) * TAU;
      const pts = [];
      for (let i = 0; i <= 40; i += 1) {
        const rr = rs + ((R - rs) * i * i) / 1600;
        pts.push(V(Math.cos(a) * rr, s * z(rr), Math.sin(a) * rr));
      }
      ctx.line(pts, { colour, opacity, parent: g });
    }
  });
  return g;
}

/* ------------------------------------------------------------ shock */

/*
 * A blast wave: a sphere that glows at its rim (where the line of sight
 * runs along the shell, so it reads as a bubble), additive. set(R, alpha).
 */
const SHOCK_VERTEX = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vP = position;
  gl_Position = projectionMatrix * mv;
}
`;
const SHOCK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uPower;
uniform float uSeed;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  float mu = abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(1.0 - mu, uPower);
  vec3 d = normalize(vP);
  float lumps = 0.55 + 0.45 * n3(d * 6.0 + uSeed) + 0.25 * n3(d * 17.0 - uSeed);
  gl_FragColor = vec4(uColor * rim * 0.9 * lumps, uOpacity);
  #include <colorspace_fragment>
}
`;
export function shock(ctx, parent, colour = "#ffd8b0", { power = 2.2, seed = 1 } = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SHOCK_VERTEX,
    fragmentShader: SHOCK_FRAGMENT,
    uniforms: { uColor: { value: new THREE.Color(colour) }, uOpacity: { value: 0 }, uPower: { value: power }, uSeed: { value: seed } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  mesh.renderOrder = 23;
  mesh.visible = false;
  mesh.raycast = () => {};
  parent.add(mesh);
  return {
    mesh,
    set(R, alpha) {
      mesh.scale.setScalar(Math.max(1e-4, R));
      material.uniforms.uOpacity.value = alpha;
      mesh.visible = alpha > 0.002 && R > 1e-3;
    },
  };
}

/* ------------------------------------------------------------ small things */

/* A soft flash (glow sprite) in the universe. */
export function flash(ctx, parent, colour = "#ffffff") {
  const g = ctx.glow(colour, 1, { opacity: 1, parent });
  g.renderOrder = 27;
  ctx.fade(g, 0);
  return {
    sprite: g,
    set(size, alpha) { g.scale.setScalar(Math.max(1e-4, size)); ctx.fade(g, alpha); },
  };
}

/* A point in `obj`'s frame expressed in `root`'s frame (an ancestor):
 * local matrices multiplied up the chain, without needing world matrices. */
export function inFrame(obj, root, p = new THREE.Vector3()) {
  const out = p.clone();
  for (let o = obj; o && o !== root; o = o.parent) {
    o.updateMatrix();
    out.applyMatrix4(o.matrix);
  }
  return out;
}

export { V, gauss, smooth };

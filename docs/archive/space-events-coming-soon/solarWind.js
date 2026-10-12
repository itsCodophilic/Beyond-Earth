import * as THREE from "three";
import { heliosphereRadiusAlong } from "./outerBoundaries.js";

/**
 * The solar wind, as its own object: the Sun's outflow streaming out through
 * the planets to the termination shock, slowing and turning in the
 * heliosheath, and stopping at the heliopause -- plus the Parker spiral its
 * magnetic field is wound into by the Sun's turning.
 *
 * Final round (the owner: "do all buddy everything at once" -- "the solar
 * wind and the heliosheath as their own objects").
 *
 * ## What is real and what is a diagram
 *
 *   timing    on the scene's own clock, one Earth year = one lap of the
 *             drawn Earth. The slow wind (~400 km/s) takes about a year to
 *             reach the termination shock, so a slow particle here takes
 *             one drawn Earth year to cross from the Sun to the drawn shock;
 *             the fast wind (~750 km/s, from the polar coronal holes) does
 *             it in about half that.
 *   where     fast wind above 25 degrees of solar latitude, slow wind near
 *             the Sun's equator -- the pattern Ulysses found near solar
 *             minimum (McComas et al. 2000).
 *   spiral    the field lines drawn in the ecliptic are Parker spirals, the
 *             radial wind carrying field out from a Sun that turns once in
 *             25.4 days: phi = phi0 - (Omega / v)(r - R_sun), Omega / v =
 *             1.07 rad per AU at 400 km/s -- 45 degrees from radial at
 *             Earth. Drawn to 10 AU, where they have wound round ten times.
 *   boundary  each particle slows to about a third of its speed between the
 *             drawn termination shock and the drawn heliopause along its own
 *             direction (outerBoundaries.js), turns towards the heliotail,
 *             reddens (it is hotter there) and fades at the heliopause.
 *   spacing   radial distances are the scene's compressed ones, so the
 *             particles crowd near the Sun less than real ones would.
 *
 * ## Cost
 *
 * One `Points` draw (6,000 vertices, moved in the vertex shader) and one
 * `LineSegments` for the spirals, only while switched on.
 */

/* 6,000: enough that the stream reads as a stream at whole-system scale
 * (4,000 at 1.3 px vanished, round 36 screenshots); still one draw. */
const PARTICLES = 6000;
/* Omega / v: 2 pi / 25.38 d over 400 km/s, in radians per AU. */
const SPIRAL_RAD_PER_AU = 1.0715;
const SUN_RADIUS_AU = 0.00465;
/* The drawn Earth's angular rate per unit of the scene's motion clock
 * (orbitSpeed 0.34 x 0.0022, main.js): one Earth year is 2 pi / this. */
const EARTH_RATE = 0.34 * 0.0022;
/* The Sun turns 365.25 / 25.38 = 14.39 times per Earth year. */
const SUN_TURNS_PER_YEAR = 14.39;

const VERTEX = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aParams;
uniform float uYears;
uniform float uSunR;
uniform float uPixelRatio;
varying float vHeat;
varying float vFade;
void main() {
  float speed = aParams.x;
  float ts = aParams.y;
  float hp = aParams.z;
  float u = fract(aParams.w + uYears * speed);
  float r;
  float sheath = 0.0;
  if (u < 0.8) {
    r = mix(uSunR, ts, u / 0.8);
  } else {
    sheath = (u - 0.8) / 0.2;
    r = mix(ts, hp, sheath);
  }
  vec3 d = normalize(aDir + vec3(0.0, 0.0, 0.9 * sheath * sheath));
  vec3 p = d * r;
  vHeat = sheath;
  vFade = smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.75, 1.0, sheath));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.1 + 1.2 * sheath) * uPixelRatio;
}
`;
const FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying float vHeat;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.15, length(c));
  vec3 cool = vec3(1.0, 0.93, 0.74);
  vec3 hot = vec3(1.0, 0.55, 0.32);
  gl_FragColor = vec4(mix(cool, hot, vHeat), a * vFade * uOpacity);
}
`;

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `auToScene` is smallBodies.js's curve (used for the spirals); the
 * particles run between the drawn Sun's surface (`sunRadius`, scene units)
 * and the drawn boundaries.
 */
export function createSolarWind({ auToScene, sunRadius = 92, pixelRatio = 1 }) {
  const rand = mulberry32(400750);
  const dir = new Float32Array(PARTICLES * 3);
  const params = new Float32Array(PARTICLES * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < PARTICLES; i += 1) {
    // Uniform on the sphere.
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    v.set(s * Math.cos(phi), z, s * Math.sin(phi));
    dir.set([v.x, v.y, v.z], i * 3);
    const latitude = Math.asin(Math.abs(v.y)) / (Math.PI / 180);
    // Slow wind ~400 km/s: one drawn year to the shock; fast ~750: 400/750.
    const fast = latitude > 25;
    const yearsToShock = (fast ? 400 / 750 : 1) * (0.9 + 0.2 * rand());
    const ts = heliosphereRadiusAlong(v, "termination-shock") ?? auToScene(85);
    const hp = heliosphereRadiusAlong(v, "heliopause") ?? auToScene(120);
    /* u runs 0 -> 0.8 to the shock: rate 0.8 / yearsToShock per year; then
     * the sheath's 0.2 takes the same time again -- the wind slows to about
     * a third of its speed over a much shorter distance. */
    params.set([0.8 / yearsToShock, ts, hp, rand()], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));
  geometry.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
  geometry.setAttribute("aParams", new THREE.BufferAttribute(params, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), auToScene(200) * 1.5);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uYears: { value: 0 },
      uSunR: { value: sunRadius },
      uPixelRatio: { value: pixelRatio },
      uOpacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Solar wind";
  points.frustumCulled = false;
  points.raycast = () => {};
  points.renderOrder = -12;

  // Parker spirals in the ecliptic: eight arms, real AU -> scene radius.
  const spiralPositions = [];
  const arms = 8;
  for (let a = 0; a < arms; a += 1) {
    const phi0 = (a / arms) * Math.PI * 2;
    let prev = null;
    for (let k = 0; k <= 400; k += 1) {
      const rAU = SUN_RADIUS_AU + (10 * k) / 400;
      const phi = phi0 - SPIRAL_RAD_PER_AU * (rAU - SUN_RADIUS_AU);
      const rs = Math.max(sunRadius, auToScene(Math.max(0.1, rAU)));
      const p = [rs * Math.cos(phi), 0, rs * Math.sin(phi)];
      if (prev) spiralPositions.push(...prev, ...p);
      prev = p;
    }
  }
  const spiralGeo = new THREE.BufferGeometry();
  spiralGeo.setAttribute("position", new THREE.Float32BufferAttribute(spiralPositions, 3));
  const spiralMat = new THREE.LineBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const spirals = new THREE.LineSegments(spiralGeo, spiralMat);
  spirals.name = "Parker spiral field lines";
  spirals.frustumCulled = false;
  spirals.raycast = () => {};

  const group = new THREE.Group();
  group.name = "Solar wind layer";
  group.add(points, spirals);
  group.visible = false;

  const state = { on: false, fade: 0, years: 0, sunAngle: 0 };
  return {
    group,
    get on() { return state.on; },
    set(on) { state.on = Boolean(on); if (state.on) group.visible = true; },
    toggle() { state.on = !state.on; if (state.on) group.visible = true; return state.on; },
    update(motionScale, dt = 1 / 60) {
      const target = state.on ? 1 : 0;
      state.fade += (target - state.fade) * Math.min(1, dt * 3);
      if (Math.abs(state.fade - target) < 0.003) state.fade = target;
      group.visible = state.fade > 0.002;
      if (!group.visible) return;
      /* Advance in Earth years on the scene's clock, but never stand still:
       * while a body is focused the clock nearly stops, and a frozen wind
       * reads as broken, so the wind keeps a slow minimum pace. */
      const step = Math.max(motionScale, 0.15 * dt * 60);
      state.years += (step * EARTH_RATE) / (Math.PI * 2);
      state.sunAngle = (state.years * SUN_TURNS_PER_YEAR * Math.PI * 2) % (Math.PI * 2);
      material.uniforms.uYears.value = state.years % 1000;
      material.uniforms.uOpacity.value = 0.8 * state.fade;
      spiralMat.opacity = 0.4 * state.fade;
      spirals.rotation.y = -state.sunAngle;
    },
  };
}

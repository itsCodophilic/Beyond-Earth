import * as THREE from "three";
import { smallBodyAuToScene } from "../smallBodies/smallBodies.js";
import { heliosphereRadiusAlong } from "../outerBoundaries.js";
import { textSprite, glow, declutterLabels } from "./interstellarPassages.js";

/**
 * The four "coming soon" space events, built (round 43, the owner: "let's
 * implement all the remaining coming soon items as well").
 *
 *   solar-system-formation  How the Solar System formed      (around the Sun)
 *   solar-wind              The solar wind                    (around the Sun)
 *   earth-magnetosphere     A magnetic shield in a storm      (at Earth)
 *   seasons                 Why there are seasons             (around the Sun)
 *
 * Their first versions were a board explanation and two always-on scene
 * layers, pulled in round 38 (docs/archive/space-events-coming-soon/, whose
 * README says what they did and why they went). These are rebuilt as events
 * in solarSystemEvents.js's format: staged once, on request, with a stage
 * caption on the event card (`api.setStage`) where the event tells a story in
 * steps, and the rest of the system hidden (`api.setVeil`) where it would
 * contradict the picture -- planets that exist before they have formed, or a
 * second Earth beside the diagram one.
 *
 * Each group is held in world axes (its matrix is the inverse of its host's
 * world matrix, as interstellarPassages.js does), so the Sun's or Earth's own
 * scale and spin do not reach it. Distances go through `smallBodyAuToScene`,
 * the scene's own compressed AU scale, so the drawings line up with the
 * planets' drawn orbits.
 *
 * Cost: nothing while not running. While running, one Points draw (moved on
 * the CPU for the formation, in the vertex shader for the wind), a few lines
 * and sprites.
 */

const au2s = (au) => smallBodyAuToScene(au);
const smooth = THREE.MathUtils.smoothstep;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const window01 = (p, a, b, fade = 0.03) => smooth(p, a, a + fade) * (1 - smooth(p, b - fade, b));
const DPR = () => Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Holds `group` in world axes, centred on the world origin or on `host`. */
function worldHold(host, group, centred = false) {
  const inverse = new THREE.Matrix4();
  const shift = new THREE.Matrix4();
  const at = new THREE.Vector3();
  group.matrixAutoUpdate = false;
  return () => {
    host.updateWorldMatrix(true, false);
    inverse.copy(host.matrixWorld).invert();
    if (centred) {
      at.setFromMatrixPosition(host.matrixWorld);
      shift.makeTranslation(at.x, at.y, at.z);
      inverse.multiply(shift);
    }
    group.matrix.copy(inverse);
    group.matrixWorldNeedsUpdate = true;
  };
}

/** The first mesh in the scene carrying this body's name. */
function findSceneBody(from, name) {
  let root = from;
  while (root.parent) root = root.parent;
  let found = null;
  root.traverse((object) => {
    if (!found && object.isMesh && (object.userData?.name === name || object.name === name)) found = object;
  });
  return found;
}

/* One shader for every particle cloud here: per-point colour, alpha and size
 * in pixels (no distance attenuation -- these are system-scale pictures). */
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
}
`;

function makeCloud(count) {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(count * 3);
  const colour = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  const size = new Float32Array(count);
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colour, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader: POINT_VERTEX,
    fragmentShader: POINT_FRAGMENT,
    uniforms: { uPixelRatio: { value: DPR() }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.raycast = () => {};
  points.renderOrder = 24;
  return { points, position, colour, alpha, size, geometry, material };
}

function glowSprite(colour, scale, { attenuate = true, opacity = 0 } = {}) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow(), color: colour, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: attenuate, toneMapped: false, fog: false,
  }));
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 26;
  sprite.raycast = () => {};
  return sprite;
}

function label(lines, options = {}) {
  const sprite = textSprite(lines, { height: 0.03, ...options });
  sprite.material.opacity = 0;
  sprite.raycast = () => {};
  return sprite;
}

function ring(radius, colour, segments = 256) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    points.push(radius * Math.cos(a), 0, radius * Math.sin(a));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: colour, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
  }));
  line.frustumCulled = false;
  line.raycast = () => {};
  return line;
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose?.();
    if (object.material) {
      if (object.material.map && object.material.map !== glow()) object.material.map.dispose?.();
      object.material.dispose?.();
    }
  });
}

/** Says each stage once, as the progress reaches it. */
function stageTeller(api, stages) {
  let current = -1;
  return (p) => {
    let index = -1;
    stages.forEach((stage, i) => { if (p >= stage.at) index = i; });
    if (index !== current) {
      current = index;
      api?.setStage?.(index >= 0 ? stages[index] : null);
    }
  };
}

/* ======================================================================
 * 1. How the Solar System formed
 * ====================================================================== */

/*
 * Six steps on a clock that is not linear -- the first million years hold as
 * much change as the next billion. The dates are the measured ones:
 *   t = 0       the oldest solids (CAIs), 4,567.30 +/- 0.16 Myr ago
 *               (Connelly et al. 2012)
 *   ~1 Myr      Jupiter's core, from the split between inner and outer
 *               meteorite families (Kruijer et al. 2017)
 *   3.8-4.8 Myr the gas disc gone (angrite palaeomagnetism, Wang et al. 2017)
 *   ~50-150 Myr Earth finished; the Moon-forming impact
 *   < 100 Myr   the giant planets' instability (Nesvorny 2018, review)
 *   4,400 Myr ago  the oldest crystals on Earth, Jack Hills zircons
 *               (Wilde et al. 2001)
 */
const FORMATION_STAGES = [
  { at: 0, label: "A few hundred thousand years before t = 0", text: "A cold cloud of gas and dust collapses under its own gravity, spinning faster as it shrinks." },
  { at: 0.2, label: "t = 0 · 4,567.3 million years ago", text: "The cloud has flattened into a disc round the young Sun. The first solids condense — grains still found in meteorites. Inside the snow line only rock and metal survive; outside it, ice does too." },
  { at: 0.32, label: "About 1 to 4 million years", text: "Jupiter's core grows fastest, where ice adds to the solids, and carves a gap that keeps inner and outer material apart. By about 4 million years the young Sun has blown the gas away." },
  { at: 0.48, label: "About 5 to 150 million years", text: "In the inner disc, Moon- to Mars-sized embryos crash together. Earth's last giant impact throws off the debris that becomes the Moon." },
  { at: 0.64, label: "Within about 100 million years", text: "The giant planets' orbits become unstable. Uranus and Neptune are thrown outwards, scattering the icy disc into the Kuiper Belt, onto Jupiter's Trojan points and out to the Oort Cloud." },
  { at: 0.82, label: "4,400 million years ago → today", text: "What is left of the building blocks: the asteroid belt, the Trojans and the Kuiper Belt. Earth already has crust and probably water — zircon crystals that old survive in Western Australia." },
];

/* The giants: where they formed in the leading "early instability" model
 * (compact, between about 5.5 and 17 AU) and where they are now. */
const GIANTS = [
  { name: "Jupiter", from: 5.6, to: 5.2, appear: 0.32, colour: 0xf0c890, size: 70 },
  { name: "Saturn", from: 7.9, to: 9.58, appear: 0.37, colour: 0xf3e0a8, size: 58 },
  { name: "Uranus", from: 11.5, to: 19.2, appear: 0.41, colour: 0xa9eef5, size: 44 },
  { name: "Neptune", from: 15, to: 30.1, appear: 0.43, colour: 0x7fa4ff, size: 44 },
];
/* The rocky planets' final distances; embryos snap to these. */
const ROCKY = [0.39, 0.72, 1.0, 1.52];
const FORMATION_SECONDS = 58;

function buildFormation(host, camera, options, api) {
  const group = new THREE.Group();
  group.name = "Solar System formation";
  const hold = worldHold(host, group);
  hold();
  const rand = mulberry32(4567);

  const N = 9000;
  const GAS = 2400;
  const cloud = makeCloud(N + GAS);
  group.add(cloud.points);

  /* Each grain: where in the disc it ends up (AU, log-uniform 0.3-45),
   * where it starts in the cloud, what it is, and what happens to it. */
  const grains = [];
  const embryoCount = 12;
  const embryos = Array.from({ length: embryoCount }, (_, i) => {
    const a = 0.4 + (i / (embryoCount - 1)) * 1.6;
    const survivor = ROCKY.reduce((best, r, k) => (Math.abs(r - a) < Math.abs(ROCKY[best] - a) ? k : best), 0);
    return { a, phi: rand() * Math.PI * 2, survivor, sprite: glowSprite(0xffc890, 26) };
  });
  embryos.forEach((e) => group.add(e.sprite));
  for (let i = 0; i < N + GAS; i += 1) {
    const gas = i >= N;
    const a = 0.3 * (45 / 0.3) ** rand();
    const ice = a > 2.7;
    const u = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const cr = 2200 + rand() * 1400;
    let outcome = "keep";
    let finalR = au2s(a);
    let trojan = 0;
    if (!gas) {
      if (a < 2.1) outcome = "embryo";
      else if (a <= 3.3) outcome = "belt";
      else if (a < 6.6) outcome = rand() < 0.06 ? "trojan" : "accreted";
      else {
        const roll = rand();
        if (roll < 0.28) { outcome = "kuiper"; finalR = au2s(36 + rand() * 12); }
        else if (roll < 0.36) { outcome = "trojan"; }
        else if (roll < 0.52) { outcome = "ejected"; finalR = 3400 + rand() * 1800; }
        else outcome = "accreted";
      }
      if (outcome === "trojan") trojan = (rand() < 0.5 ? 1 : -1) * (Math.PI / 3) + (rand() - 0.5) * 0.5;
    }
    grains.push({
      gas, ice, a, rs: au2s(a), phi: rand() * Math.PI * 2,
      w: Math.min(1.0, 0.9 * a ** -1.5),
      h: (rand() - 0.5) * au2s(a) * (gas ? 0.3 : 0.16),
      cx: cr * s * Math.cos(t), cy: cr * u * 0.8, cz: cr * s * Math.sin(t),
      outcome, finalR, trojan, scatterY: (rand() - 0.5) * 900,
      trojanR: au2s(5.2) * (1 + (rand() - 0.5) * 0.12),
      embryo: Math.min(embryoCount - 1, Math.max(0, Math.round(((a - 0.4) / 1.6) * (embryoCount - 1)))),
      jitter: rand(),
    });
    cloud.size[i] = gas ? 9 : 2.3 + rand() * 1.2;
  }
  cloud.geometry.attributes.aSize.needsUpdate = true;

  const protoSun = glowSprite(0xffd7a0, 1400);
  group.add(protoSun);
  const snowLine = ring(au2s(2.7), 0x9fd0ff);
  group.add(snowLine);
  const snowLabel = label(["Snow line · about 2.7 AU", "ice survives beyond it"], { colour: "#cfe6ff" });
  snowLabel.position.set(au2s(2.7) * Math.cos(-0.7), 0, au2s(2.7) * Math.sin(-0.7));
  group.add(snowLabel);
  const giants = GIANTS.map((g) => {
    const core = glowSprite(g.colour, g.size);
    const tag = label([g.name], { colour: "#fff1dc", height: 0.024 });
    group.add(core, tag);
    return { ...g, core, tag, phi: rand() * Math.PI * 2 };
  });
  const flash = glowSprite(0xfff2c4, 160);
  group.add(flash);
  const moonLabel = label(["The Moon-forming impact", "Earth and a Mars-sized body"], { colour: "#fff3d6" });
  group.add(moonLabel);

  const tell = stageTeller(api, FORMATION_STAGES);
  let veiled = false;
  const tmp = new THREE.Vector3();
  const cWarm = new THREE.Color(0xffc68a);
  const cHot = new THREE.Color(0xfff0d0);
  const cIce = new THREE.Color(0x9fd0ff);
  const cDust = new THREE.Color(0xb8a8c8);
  const cGas = new THREE.Color(0x8f86c8);
  const c = new THREE.Color();

  return {
    group,
    duration: FORMATION_SECONDS,
    update(p) {
      hold();
      tell(p);
      /* The planets of today are hidden until the very end: they have not
       * formed yet. Lifted as the settled system fades in. */
      const wantVeil = p < 0.9;
      if (wantVeil !== veiled) { veiled = wantVeil; api?.setVeil?.(wantVeil ? "system" : null); }

      const T = p * FORMATION_SECONDS;
      const collapse = smooth(p, 0.03, 0.2);
      const thin = 1 - 0.75 * smooth(p, 0.2, 0.46);
      const gap = smooth(p, 0.33, 0.43);
      const gasGone = smooth(p, 0.42, 0.5);
      const merge = smooth(p, 0.48, 0.6);
      const snap = smooth(p, 0.56, 0.64);
      const shuffle = smooth(p, 0.64, 0.8);
      const settle = smooth(p, 0.82, 0.9);
      const end = smooth(p, 0.9, 0.985);
      const intro = smooth(p, 0, 0.04);
      const jupiterPhi = giants[0].phi + 0.9 * 5.4 ** -1.5 * T;

      // Embryos: appear, merge onto four survivors, then hand over.
      embryos.forEach((e) => {
        const target = ROCKY[e.survivor];
        const a = THREE.MathUtils.lerp(e.a, target, snap);
        const phi = e.phi + Math.min(1, 0.9 * a ** -1.5) * T;
        const r = au2s(a);
        e.x = r * Math.cos(phi);
        e.z = r * Math.sin(phi);
        e.sprite.position.set(e.x, 0, e.z);
        const isSurvivor = Math.abs(e.a - target) === Math.min(...embryos.filter((o) => o.survivor === e.survivor).map((o) => Math.abs(o.a - target)));
        e.sprite.material.opacity = smooth(p, 0.5, 0.56) * (isSurvivor ? 1 - end : 1 - snap) * 0.9;
        e.sprite.scale.setScalar(18 + 22 * merge * (isSurvivor ? 1 : 0.5));
      });

      for (let i = 0; i < grains.length; i += 1) {
        const g = grains[i];
        let r = g.rs;
        let phi = g.phi + g.w * T;
        let y = g.h * thin;
        let alpha = g.gas ? 0.1 : g.ice ? 0.5 : 0.6;
        if (g.gas) {
          r *= 1 + 0.8 * gasGone;
          alpha *= 1 - gasGone;
        } else {
          switch (g.outcome) {
            case "embryo": {
              const e = embryos[g.embryo];
              alpha *= 1 - smooth(p, 0.55, 0.62);
              const x0 = r * Math.cos(phi);
              const z0 = r * Math.sin(phi);
              const x = THREE.MathUtils.lerp(x0, e.x ?? x0, merge * (0.7 + 0.3 * g.jitter));
              const z = THREE.MathUtils.lerp(z0, e.z ?? z0, merge * (0.7 + 0.3 * g.jitter));
              r = Math.hypot(x, z);
              phi = Math.atan2(z, x);
              break;
            }
            case "belt":
              alpha *= 1 - 0.55 * settle;
              break;
            case "accreted":
              alpha *= 1 - (g.a < 6.6 ? gap : shuffle);
              break;
            case "trojan": {
              const at = smooth(p, 0.66, 0.8);
              const tphi = jupiterPhi + g.trojan;
              r = THREE.MathUtils.lerp(r, g.trojanR, at);
              phi = phi + (tphi - phi) * at;
              if (g.a < 6.6) alpha *= 1 - gap * (1 - at);
              break;
            }
            case "kuiper":
              r = THREE.MathUtils.lerp(r, g.finalR, shuffle);
              y += g.scatterY * 0.12 * shuffle;
              alpha *= 1 - 0.4 * settle;
              break;
            case "ejected":
              r = THREE.MathUtils.lerp(r, g.finalR, shuffle);
              y += g.scatterY * shuffle;
              alpha *= 1 - smooth(p, 0.7, 0.82);
              break;
            default:
              break;
          }
        }
        // Collapse: from the cloud to the disc, turning faster as it shrinks.
        const spin = 0.12 * T * (1 + 3 * collapse);
        const cxr = g.cx * Math.cos(spin) - g.cz * Math.sin(spin);
        const czr = g.cx * Math.sin(spin) + g.cz * Math.cos(spin);
        const dx = r * Math.cos(phi);
        const dz = r * Math.sin(phi);
        cloud.position[i * 3] = THREE.MathUtils.lerp(cxr, dx, collapse);
        cloud.position[i * 3 + 1] = THREE.MathUtils.lerp(g.cy, y, collapse);
        cloud.position[i * 3 + 2] = THREE.MathUtils.lerp(czr, dz, collapse);

        if (g.gas) c.copy(cGas);
        else if (g.ice) c.copy(cIce);
        else c.copy(cWarm).lerp(cHot, clamp01(1 - (g.a - 0.3) / 1.5));
        c.lerp(cDust, 1 - collapse);
        cloud.colour[i * 3] = c.r;
        cloud.colour[i * 3 + 1] = c.g;
        cloud.colour[i * 3 + 2] = c.b;
        cloud.alpha[i] = alpha * intro * (1 - end);
      }
      cloud.geometry.attributes.position.needsUpdate = true;
      cloud.geometry.attributes.aColor.needsUpdate = true;
      cloud.geometry.attributes.aAlpha.needsUpdate = true;

      // The young Sun: a large, bright glow while it is still accreting.
      protoSun.material.opacity = 0.9 * smooth(p, 0.04, 0.16) * (1 - 0.6 * smooth(p, 0.3, 0.6)) * (1 - end);
      protoSun.scale.setScalar(1500 - 800 * smooth(p, 0.1, 0.5));

      const snow = window01(p, 0.2, 0.5, 0.04);
      snowLine.material.opacity = 0.45 * snow;
      snowLabel.material.opacity = snow;

      giants.forEach((g) => {
        const a = THREE.MathUtils.lerp(g.from, g.to, shuffle);
        const phi = g.phi + 0.9 * a ** -1.5 * T;
        const r = au2s(a);
        g.core.position.set(r * Math.cos(phi), 0, r * Math.sin(phi));
        const grow = smooth(p, g.appear, g.appear + 0.08);
        g.core.material.opacity = grow * (1 - smooth(p, 0.86, 0.92));
        g.core.scale.setScalar(g.size * (0.3 + 0.7 * grow));
        g.tag.position.copy(g.core.position).add(tmp.set(0, g.size * 0.6, 0));
        g.tag.material.opacity = grow * (1 - smooth(p, 0.84, 0.9)) * 0.9;
      });

      // The Moon-forming impact, at Earth's survivor.
      const earth = embryos.find((e) => e.survivor === 2);
      const bang = window01(p, 0.585, 0.64, 0.012);
      flash.position.set(earth.x ?? 0, 0, earth.z ?? 0);
      flash.material.opacity = bang;
      flash.scale.setScalar(60 + 240 * bang);
      moonLabel.position.copy(flash.position).add(tmp.set(0, 40, 0));
      moonLabel.material.opacity = window01(p, 0.585, 0.66, 0.02);
    },
    dispose(skyApi) {
      api?.setVeil?.(null);
      api?.setStage?.(null);
      skyApi?.setVeil?.(null);
      disposeGroup(group);
    },
  };
}

/* ======================================================================
 * 2. The solar wind
 * ====================================================================== */

/*
 * Round 44 rebuild (Prompts.md: "it looks like it is sending out scattered
 * lights, but they are winds, a gaseous type, and the lines you drew were
 * not real ... start the camera on the Sun, show how it releases the wind,
 * then go far out ... a streaming flow"). Built the way the heliophysics
 * visualisations show it (NASA SVS solar-wind and Parker Solar Probe
 * animations; the WSA-ENLIL model's density spirals): a continuous gas
 * that streams out radially, drawn as soft overlapping puffs (the density)
 * and short moving streaks (the flow), with no drawn field lines.
 *
 *   spiral    not drawn: it emerges. Each stream leaves the Sun radially
 *             from a source that turns with the Sun (one turn in 25.38
 *             days), so the gas released over time lies on a spiral, as
 *             water from a turning garden sprinkler does -- about 45
 *             degrees from radial at Earth for 400 km/s (Parker 1958).
 *   sources   slow wind (~400 km/s) from the streamer belt near the solar
 *             equator, here four streams 90 degrees apart, plus a thin
 *             spread; fast wind (~750 km/s) from the polar coronal holes,
 *             above ~30 degrees latitude (Ulysses, McComas et al. 2000)
 *   speed     it accelerates near the Sun (supersonic within roughly ten
 *             solar radii) and then coasts at nearly constant speed,
 *             thinning as it spreads; it slows sharply only at the
 *             termination shock. Modelled as r = v (t - tau (1 - e^-t/tau)),
 *             tau 0.4 day.
 *   clock     the event's clock is not linear: the first quarter is the
 *             first ~3 days near the Sun, the end ~800 days, by which the
 *             slow wind is through the heliosheath:
 *             days = 0.594 (e^(7.2 p) - 1).
 *   distance  the scene's compressed AU scale (smallBodyAuToScene) beyond
 *             0.39 AU; inside it, from the drawn Sun's surface to Mercury's
 *             distance linearly (the drawn Sun changes size with the
 *             camera, so its radius is read every frame).
 *   boundary  the drawn termination shock and heliopause (outerBoundaries.js,
 *             recovered here as the same ellipsoids): past the shock the
 *             gas slows to ~a third, heats (redder) and bends towards the
 *             heliotail (+Z); it fades at the heliopause.
 *   camera    the event moves the camera (api.setZoom): close on the Sun,
 *             then out through the planets, then out to the heliopause.
 */
const WIND_SECONDS = 48;
const SUN_TURN_DAYS = 25.38;
const AU_PER_DAY = (kms) => (kms * 86400) / 149597870.7;
const windDays = (p) => 0.594 * (Math.exp(7.2 * p) - 1);
const MAP_SAMPLES = 96;
const MAP_LOG0 = Math.log10(0.39);
const MAP_LOG1 = Math.log10(160);

const WIND_COMMON = /* glsl */ `
uniform float uDays;
uniform float uSunR;
uniform float uMap[96];
uniform vec3 uTs;
uniform vec3 uHp;
uniform float uOmega;
attribute vec4 aSource;
attribute vec4 aLife;
varying float vAlpha;
varying vec3 vColor;

float mapAU(float r) {
  if (r < 0.39) {
    float t = clamp((r - 0.00465) / (0.39 - 0.00465), 0.0, 1.0);
    return mix(uSunR, max(uMap[0], uSunR * 1.05), t);
  }
  float x = (log(r) / log(10.0) - ${MAP_LOG0.toFixed(6)}) / (${(MAP_LOG1 - MAP_LOG0).toFixed(6)}) * 95.0;
  x = clamp(x, 0.0, 94.999);
  int i = int(floor(x));
  float f = x - float(i);
  return mix(uMap[i], uMap[i + 1], f);
}

float shellRadius(vec3 d, vec3 s) {
  float A = (d.x * d.x + d.y * d.y) / (s.x * s.x) + (d.z * d.z) / (s.y * s.y);
  float B = -2.0 * d.z * s.z / (s.y * s.y);
  float C = (s.z * s.z) / (s.y * s.y) - 1.0;
  return (-B + sqrt(max(0.0, B * B - 4.0 * A * C))) / (2.0 * A);
}

vec3 windPosition(float lag, out float heat, out float fade, out float rScene) {
  float speed = aSource.z;
  float life = aLife.x;
  float t = uDays - aLife.y - lag;
  fade = step(0.0, t);
  float age = mod(max(t, 0.0), life);
  float tau = 0.4;
  float rAU = 0.00465 + speed * (age - tau * (1.0 - exp(-age / tau)));
  float lon = aSource.x + uOmega * (uDays - lag - age);
  float lat = aSource.y;
  vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  float r = mapAU(rAU);
  float ts = shellRadius(d, uTs);
  float hp = shellRadius(d, uHp);
  heat = 0.0;
  if (r > ts) {
    float over = (r - ts) * 0.33;
    heat = clamp(over / max(1.0, hp - ts), 0.0, 1.0);
    r = ts + over;
    d = normalize(d + vec3(0.0, 0.0, 1.1 * heat * heat));
  }
  fade *= smoothstep(0.0, 0.25, age) * (1.0 - smoothstep(0.85, 1.0, heat));
  fade *= 1.0 - smoothstep(0.9, 1.0, age / life);
  rScene = r;
  return d * r;
}

vec3 windColour(float heat, float r) {
  float fast = step(0.33, aSource.z);
  vec3 near = vec3(1.0, 0.93, 0.78);
  vec3 slow = vec3(1.0, 0.70, 0.40);
  vec3 quick = vec3(0.72, 0.84, 1.0);
  vec3 c = mix(slow, quick, fast);
  c = mix(near, c, smoothstep(uSunR * 1.05, uSunR * 2.2, r));
  return mix(c, vec3(1.0, 0.42, 0.32), heat);
}
`;

const HAZE_VERTEX = /* glsl */ `
${WIND_COMMON}
uniform float uViewport;
uniform float uOpacity;
void main() {
  float heat;
  float fade;
  float r;
  vec3 p = windPosition(0.0, heat, fade, r);
  vColor = windColour(heat, r);
  vAlpha = fade * aLife.z * uOpacity;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float world = max(uSunR * 0.12, r * 0.07) * aLife.w;
  gl_PointSize = clamp(world * projectionMatrix[1][1] * uViewport * 0.5 / max(1.0, -mv.z), 1.5, 42.0);
}
`;
const HAZE_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float g = exp(-dot(c, c) * 14.0);
  gl_FragColor = vec4(vColor, g * vAlpha);
}
`;
const STREAK_VERTEX = /* glsl */ `
${WIND_COMMON}
attribute float aEnd;
uniform float uOpacity;
uniform float uTrail;
void main() {
  float heat;
  float fade;
  float r;
  vec3 p = windPosition(aEnd * uTrail, heat, fade, r);
  vColor = windColour(heat, r);
  vAlpha = fade * (1.0 - aEnd) * uOpacity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const STREAK_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const WIND_STAGES = [
  { at: 0, label: "The corona boils away", text: "The Sun's outer atmosphere is over a million degrees — too hot for its gravity to hold. It streams off in every direction and speeds up as it goes: within about ten solar radii it is already faster than sound." },
  { at: 0.2, label: "A turning sprinkler · days", text: "Every stream flies straight out, but the Sun turns once in about 25 days, so the gas it releases lies on a spiral, like water from a turning garden sprinkler. Slow wind (about 400 km/s) from near the equator reaches Earth in about four days; fast wind (about 750 km/s) pours from the poles." },
  { at: 0.48, label: "Coasting and thinning · months", text: "The wind does not slow down on the way out — it coasts at nearly the same speed and thins as it spreads over an ever larger sphere. It sweeps past every planet and on out of the Solar System." },
  { at: 0.7, label: "About a year · the termination shock", text: "About 90 AU out it is so thin that it drops below the speed of sound and slows abruptly, heating up. Voyager 1 crossed this shock in December 2004 at 94 AU, Voyager 2 in August 2007 at 84 AU." },
  { at: 0.84, label: "The heliopause", text: "The slowed wind is turned back by the gas between the stars and swept into a tail. Beyond this edge is interstellar space: Voyager 1 crossed it in August 2012 at 121.6 AU, Voyager 2 in November 2018 at 119 AU." },
];

/* The camera's choreography, in multiples of the Sun's own framing. */
function windZoom(p) {
  const near = 3.6;
  const mid = 15;
  const far = 54;
  return near
    + (mid - near) * smooth(p, 0.2, 0.46)
    + (far - mid) * smooth(p, 0.5, 0.74);
}

/* The drawn heliosphere shells as ellipsoids (flank, semi-axis along Z,
 * centre on Z), recovered from three directions of heliosphereRadiusAlong. */
function shellParams(id, fallback) {
  const rx = heliosphereRadiusAlong(new THREE.Vector3(1, 0, 0), id) ?? fallback;
  const rp = heliosphereRadiusAlong(new THREE.Vector3(0, 0, 1), id) ?? fallback;
  const rn = heliosphereRadiusAlong(new THREE.Vector3(0, 0, -1), id) ?? fallback;
  const c = (rp + rn) / 2;
  const z0 = (rp - rn) / 2;
  const a = rx / Math.sqrt(Math.max(0.05, 1 - (z0 / c) ** 2));
  return new THREE.Vector3(a, c, z0);
}

function buildSolarWind(host, camera, options, api) {
  const group = new THREE.Group();
  group.name = "Solar wind event";
  const hold = worldHold(host, group);
  hold();
  const rand = mulberry32(400750);

  const map = new Float32Array(MAP_SAMPLES);
  for (let i = 0; i < MAP_SAMPLES; i += 1) {
    map[i] = au2s(10 ** (MAP_LOG0 + ((MAP_LOG1 - MAP_LOG0) * i) / (MAP_SAMPLES - 1)));
  }
  const uniforms = {
    uDays: { value: 0 },
    uSunR: { value: 90 },
    uMap: { value: Array.from(map) },
    uTs: { value: shellParams("termination-shock", au2s(85)) },
    uHp: { value: shellParams("heliopause", au2s(120)) },
    uOmega: { value: (2 * Math.PI) / SUN_TURN_DAYS },
    uViewport: { value: 800 },
    uOpacity: { value: 0 },
    uTrail: { value: 0.5 },
  };

  /* One gas parcel: [source longitude, latitude, speed AU/day, -] and
   * [lifetime days, birth fraction, alpha, size]. Two populations: a
   * short-lived dense one that fills the space near the Sun from the first
   * second, and a long-lived one that carries the wind to the heliopause. */
  const SLOW = AU_PER_DAY(400);
  const FAST = AU_PER_DAY(750);
  function parcel() {
    const roll = rand();
    let lon;
    let lat;
    let speed;
    if (roll < 0.62) {
      // Slow wind: four streamer-belt streams, near the solar equator.
      lon = Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.38;
      lat = (rand() - 0.5) * 0.42 * (0.4 + rand());
      speed = SLOW * (0.9 + 0.2 * rand());
    } else if (roll < 0.74) {
      // A thin spread of slow wind between the streams.
      lon = rand() * Math.PI * 2;
      lat = (rand() - 0.5) * 0.6;
      speed = SLOW * (0.9 + 0.25 * rand());
    } else {
      // Fast wind from the polar coronal holes.
      lon = rand() * Math.PI * 2;
      lat = (rand() < 0.5 ? 1 : -1) * (0.55 + rand() * 0.95);
      speed = FAST * (0.92 + 0.16 * rand());
    }
    return [lon, lat, speed];
  }
  function fill(count, nearSun, withEnds) {
    const verts = withEnds ? count * 2 : count;
    const source = new Float32Array(verts * 4);
    const life = new Float32Array(verts * 4);
    const ends = withEnds ? new Float32Array(verts) : null;
    for (let i = 0; i < count; i += 1) {
      const [lon, lat, speed] = parcel();
      /* Near the Sun: short lives that wrap, so the space round the Sun is
       * full from the first second. Far out: one trip each, released
       * evenly through the event (not evenly in days -- the clock speeds
       * up, and evenly in days would leave most parcels unborn until the
       * end, the sparse "scattered lights" look). */
      const L = nearSun ? 2.2 + rand() * 1.6 : 1e6;
      /* rand()^0.6 thins the very first releases, which otherwise travel
       * out together as one dense ring, so the flow reads as a stream. */
      const birth = nearSun ? rand() * L : windDays(rand() ** 0.6 * 0.97);
      const s = [lon, lat, speed, 0];
      const l = [L, birth, nearSun ? 0.11 + 0.08 * rand() : 0.07 + 0.06 * rand(), 0.6 + 0.8 * rand()];
      const copies = withEnds ? 2 : 1;
      for (let k = 0; k < copies; k += 1) {
        const v = i * copies + k;
        source.set(s, v * 4);
        life.set(l, v * 4);
        if (ends) ends[v] = k;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    geometry.setAttribute("aSource", new THREE.BufferAttribute(source, 4));
    geometry.setAttribute("aLife", new THREE.BufferAttribute(life, 4));
    if (ends) geometry.setAttribute("aEnd", new THREE.BufferAttribute(ends, 1));
    return geometry;
  }
  const hazeMaterial = (opacity) => new THREE.ShaderMaterial({
    vertexShader: HAZE_VERTEX,
    fragmentShader: HAZE_FRAGMENT,
    uniforms: { ...uniforms, uOpacity: { value: opacity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const nearHaze = new THREE.Points(fill(9000, true, false), hazeMaterial(0));
  const farHaze = new THREE.Points(fill(24000, false, false), hazeMaterial(0));
  const streakMaterial = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERTEX,
    fragmentShader: STREAK_FRAGMENT,
    uniforms: { ...uniforms, uOpacity: { value: 0 }, uTrail: { value: 0.3 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const streaks = new THREE.LineSegments(fill(5000, false, true), streakMaterial);
  const nearStreaks = new THREE.LineSegments(fill(3000, true, true), streakMaterial.clone());
  [nearHaze, farHaze, streaks, nearStreaks].forEach((object) => {
    object.frustumCulled = false;
    object.raycast = () => {};
    object.renderOrder = 24;
    group.add(object);
  });
  const materials = [nearHaze.material, farHaze.material, streakMaterial, nearStreaks.material];
  /* Shared values: one object per uniform, so every material sees each
   * update. (The spread above copied the object references.) */
  materials.forEach((m) => {
    ["uDays", "uSunR", "uMap", "uTs", "uHp", "uOmega", "uViewport"].forEach((k) => { m.uniforms[k] = uniforms[k]; });
  });

  const tsNoseR = heliosphereRadiusAlong(new THREE.Vector3(0, 0, -1), "termination-shock") ?? au2s(85);
  const hpNoseR = heliosphereRadiusAlong(new THREE.Vector3(0, 0, -1), "heliopause") ?? au2s(120);
  const labels = {
    corona: label(["The corona", "over a million degrees"], { colour: "#fff1d0", height: 0.034 }),
    fast: label(["Fast wind · about 750 km/s", "from the poles"], { colour: "#d8e6ff", height: 0.034 }),
    slow: label(["Slow wind · about 400 km/s", "from near the equator"], { colour: "#ffd9a8", height: 0.034 }),
    earth: label(["Earth · about 4 days"], { colour: "#cfe6ff", height: 0.03 }),
    ts: label(["Termination shock", "Voyager 1: 94 AU, 2004"], { colour: "#ffd0a0", height: 0.036 }),
    hp: label(["Heliopause · interstellar space", "Voyager 1: 121.6 AU, 2012"], { colour: "#ffc0a0", height: 0.036 }),
  };
  labels.ts.position.set(0, 0, -tsNoseR);
  labels.hp.position.set(au2s(4), 0, -hpNoseR);
  Object.values(labels).forEach((l) => group.add(l));
  const earth = findSceneBody(host, "Earth");
  const earthAt = new THREE.Vector3();
  const scale = new THREE.Vector3();
  if (!host.geometry?.boundingSphere) host.geometry?.computeBoundingSphere?.();
  const baseRadius = host.geometry?.boundingSphere?.radius ?? 90;
  const tell = stageTeller(api, WIND_STAGES);

  return {
    group,
    duration: WIND_SECONDS,
    update(p) {
      hold();
      tell(p);
      api?.setZoom?.(windZoom(p));
      host.updateWorldMatrix(true, false);
      scale.setFromMatrixScale(host.matrixWorld);
      const sunR = baseRadius * scale.x;
      uniforms.uSunR.value = sunR;
      uniforms.uDays.value = windDays(p);
      uniforms.uViewport.value = (typeof window !== "undefined" ? window.innerHeight : 800) * DPR();
      const fade = smooth(p, 0, 0.04) * (1 - smooth(p, 0.95, 1));
      const nearFade = 1 - smooth(p, 0.5, 0.7);
      nearHaze.material.uniforms.uOpacity.value = 1.0 * fade * nearFade;
      nearStreaks.material.uniforms.uOpacity.value = 0.18 * fade * nearFade;
      farHaze.material.uniforms.uOpacity.value = 1.0 * fade;
      streakMaterial.uniforms.uOpacity.value = 0.22 * fade;
      /* Streak length in days of travel: a short trail near the Sun, longer
       * as the clock speeds up, so the flow always reads as motion. */
      const trail = Math.max(0.12, windDays(p) * 0.05);
      streakMaterial.uniforms.uTrail.value = trail;
      nearStreaks.material.uniforms.uTrail.value = Math.min(0.5, trail);

      labels.corona.position.set(sunR * 1.6, sunR * 0.9, 0);
      labels.fast.position.set(0, sunR * 2.4 + au2s(0.39) * smooth(p, 0.2, 0.5) * 3, 0);
      labels.slow.position.set(sunR * 2.2 + au2s(0.7) * smooth(p, 0.2, 0.5) * 2, 0, sunR * 0.4);
      labels.corona.material.opacity = window01(p, 0.03, 0.24, 0.03);
      labels.fast.material.opacity = window01(p, 0.08, 0.6, 0.04);
      labels.slow.material.opacity = window01(p, 0.1, 0.6, 0.04);
      if (earth) {
        earth.getWorldPosition(earthAt);
        labels.earth.position.copy(earthAt);
      }
      labels.earth.material.opacity = earth ? window01(p, 0.22, 0.5, 0.04) : 0;
      labels.ts.material.opacity = smooth(p, 0.7, 0.75) * fade;
      labels.hp.material.opacity = smooth(p, 0.84, 0.88) * fade;
      declutterLabels([labels.hp, labels.ts, labels.corona, labels.fast, labels.slow, labels.earth], camera);
    },
    dispose() {
      api?.setStage?.(null);
      api?.setZoom?.(null);
      disposeGroup(group);
    },
  };
}

/* ======================================================================
 * 3. Earth's magnetosphere in a storm
 * ====================================================================== */

/*
 * Drawn to true scale in Earth radii (Re), round Earth, in a frame whose +x
 * points downwind (away from the Sun):
 *   magnetopause  Shue et al. 1998: r = r0 (2 / (1 + cos theta))^alpha,
 *                 alpha 0.58, r0 ~10 Re on a quiet day (theta from the
 *                 Sun-Earth line)
 *   bow shock     about 1.3 x the magnetopause stand-off (~13 Re), flaring
 *                 wider (alpha 0.8, chosen to read as the outer shell)
 *   storm         a coronal mass ejection pushes the stand-off in to ~6.6 Re
 *                 -- the orbit of geostationary satellites, which the
 *                 strongest storms cross (e.g. March 1989, October 2003)
 *   belts         Van Allen: inner ~1.2-2.5 Re, outer ~3-7 Re
 *   aurora        ovals near 67 degrees magnetic latitude, spreading
 *                 equatorward in a storm (drawn to 58)
 *   dipole tilt   ~11 degrees from the spin axis
 * The Moon, really 60 Re away, would be far off this picture; the scene
 * draws it at 3.15 Re, inside the magnetopause, so it is hidden while this
 * runs.
 */
const MAG_SECONDS = 36;
const MAG_STAGES = [
  { at: 0, label: "A quiet day", text: "Earth's magnetic field holds the solar wind off about 10 Earth radii (64,000 km) upstream. The wind is slowed at the bow shock, flows round the magnetopause and stretches the field into a long tail." },
  { at: 0.3, label: "A coronal mass ejection arrives", text: "A cloud of magnetised plasma thrown off the Sun one to three days earlier hits at several times the usual pressure." },
  { at: 0.48, label: "A geomagnetic storm", text: "The magnetopause is pushed in — in the strongest storms inside 6.6 Earth radii, where geostationary satellites orbit. Energy pours down the field lines: the auroral ovals brighten and spread towards the equator." },
  { at: 0.76, label: "Recovery", text: "Over hours to days the field relaxes back to its usual shape. The shield never switches off; it only flexes." },
];

/* Profile of a shell, sampled at stand-off 1, as (x downwind, rho). */
function shellProfile(alpha, maxTheta, tail) {
  const out = [];
  for (let k = 0; k <= 90; k += 1) {
    const theta = (k / 90) * maxTheta;
    const r = (2 / (1 + Math.cos(theta))) ** alpha;
    out.push({ x: -r * Math.cos(theta), rho: r * Math.sin(theta) });
  }
  const last = out[out.length - 1];
  for (let k = 1; k <= 20; k += 1) {
    const x = last.x + (k / 20) * (tail - last.x);
    out.push({ x, rho: last.rho * (1 + 0.12 * (k / 20)) });
  }
  return out;
}
function rhoAt(profile, x) {
  if (x < profile[0].x) return 0;
  for (let k = 1; k < profile.length; k += 1) {
    if (x <= profile[k].x) {
      const a = profile[k - 1];
      const b = profile[k];
      const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
      return a.rho + (b.rho - a.rho) * t;
    }
  }
  return profile[profile.length - 1].rho;
}

const SHELL_VERTEX = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vX;
void main() {
  vUv = uv;
  vX = position.x;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
const SHELL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uTail;
varying vec3 vNormalW;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vX;
void main() {
  float facing = abs(dot(normalize(vNormalW), normalize(vViewDir)));
  float rim = pow(1.0 - facing, 2.2);
  float flow = 0.5 + 0.5 * sin(vUv.y * 70.0 - uTime * 2.4);
  float tailFade = 1.0 - smoothstep(uTail * 0.45, uTail, vX);
  float a = (0.015 + rim * 0.7 + flow * 0.04) * uOpacity * tailFade;
  gl_FragColor = vec4(uColor, a);
}
`;

function shellMesh(profile, colour) {
  const points = profile.map((q) => new THREE.Vector2(Math.max(0.0001, q.rho), q.x));
  const geometry = new THREE.LatheGeometry(points, 96);
  // Lathe revolves round +y; turn it so the axis is +x (downwind).
  geometry.rotateZ(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    uniforms: { uColor: { value: new THREE.Color(colour) }, uOpacity: { value: 0 }, uTime: { value: 0 }, uTail: { value: 40 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  mesh.renderOrder = 22;
  return mesh;
}

function buildMagnetosphere(host, camera, options, api) {
  const group = new THREE.Group();
  group.name = "Earth magnetosphere event";
  const hold = worldHold(host, group, true);
  hold();
  host.updateWorldMatrix(true, false);
  if (!host.geometry?.boundingSphere) host.geometry?.computeBoundingSphere?.();
  const scale = new THREE.Vector3().setFromMatrixScale(host.matrixWorld).x || 1;
  const Re = (host.geometry?.boundingSphere?.radius ?? 0.9) * scale;

  // The frame that turns with the Sun direction: +x downwind.
  const wind = new THREE.Group();
  wind.scale.setScalar(Re);
  group.add(wind);

  /* Profiles at stand-off 1; the tails reach ~60 Re at the quiet stand-off. */
  const MP = shellProfile(0.58, (150 * Math.PI) / 180, 6.5);
  const BS = shellProfile(0.8, (128 * Math.PI) / 180, 5);
  const magnetopause = shellMesh(MP, 0x7fd8ff);
  const bowShock = shellMesh(BS, 0xffc27a);
  wind.add(bowShock, magnetopause);

  // The dipole frame: Earth's spin axis tilted ~11 degrees, in wind axes.
  const dipole = new THREE.Vector3();
  const spinAxis = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();

  // Van Allen belts: two soft tori round the dipole axis.
  const belts = new THREE.Group();
  const beltMaterial = (colour) => new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        float facing = abs(dot(normalize(vNormalW), normalize(vViewDir)));
        gl_FragColor = vec4(uColor, (0.08 + 0.5 * pow(facing, 1.5)) * uOpacity);
      }
    `,
    uniforms: { uColor: { value: new THREE.Color(colour) }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.5, 24, 96), beltMaterial(0xffb27a));
  const outer = new THREE.Mesh(new THREE.TorusGeometry(4.6, 1.5, 24, 96), beltMaterial(0xb69bff));
  [inner, outer].forEach((m) => { m.rotation.x = Math.PI / 2; m.scale.z = 0.55; m.raycast = () => {}; m.frustumCulled = false; m.renderOrder = 21; belts.add(m); });
  wind.add(belts);

  // Aurora ovals, both poles.
  const auroraMaterial = new THREE.MeshBasicMaterial({ color: 0x6dff9c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  const ovals = [1, -1].map((hemisphere) => {
    const oval = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 96), auroraMaterial);
    oval.userData.hemisphere = hemisphere;
    oval.raycast = () => {};
    oval.renderOrder = 23;
    belts.add(oval);
    return oval;
  });

  // Field lines: dipole lines r = L cos^2(lat), squeezed and stretched.
  const SHELLS = [2.2, 3.2, 4.6, 6.5, 8.5, 11];
  const LONGITUDES = 10;
  const STEPS = 48;
  const lineCount = SHELLS.length * LONGITUDES;
  const linePositions = new Float32Array(lineCount * STEPS * 2 * 3);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  const fieldLines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({
    color: 0x9fe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  fieldLines.frustumCulled = false;
  fieldLines.raycast = () => {};
  wind.add(fieldLines);

  // The solar wind: particles streaming downwind, deflected round the shells.
  const WIND = 2600;
  const stream = makeCloud(WIND);
  wind.add(stream.points);
  const rand = mulberry32(1989);
  const flow = Array.from({ length: WIND }, () => ({
    x: -45 + rand() * 110,
    rho: Math.sqrt(rand()) * 34,
    ang: rand() * Math.PI * 2,
    speed: 7 + rand() * 4,
    cme: rand() < 0.45,
  }));
  for (let i = 0; i < WIND; i += 1) stream.size[i] = flow[i].cme ? 3.4 : 2.6;
  stream.geometry.attributes.aSize.needsUpdate = true;

  const labels = {
    wind: label(["Solar wind"], { colour: "#fff1d0" }),
    bow: label(["Bow shock"], { colour: "#ffd7a0" }),
    mp: label(["Magnetopause · 10 Earth radii"], { colour: "#bfefff" }),
    belts: label(["Van Allen belts"], { colour: "#e0d0ff" }),
    tail: label(["Magnetotail"], { colour: "#bfefff" }),
    aurora: label(["Aurora"], { colour: "#b8ffcf" }),
  };
  Object.values(labels).forEach((l) => wind.add(l));
  labels.wind.position.set(-30, 12, 0);
  labels.tail.position.set(32, 9, 0);

  const moon = findSceneBody(host, "Moon");
  if (moon) api?.setVeil?.([moon]);

  const tell = stageTeller(api, MAG_STAGES);
  const c = new THREE.Color();
  const cWind = new THREE.Color(0xffe6b8);
  const cHot = new THREE.Color(0xffa060);
  const cCme = new THREE.Color(0xff8fb0);
  const v = new THREE.Vector3();

  return {
    group,
    duration: MAG_SECONDS,
    update(p) {
      hold();
      tell(p);
      const T = p * MAG_SECONDS;
      host.getWorldPosition(sunDir);
      sunDir.normalize(); // downwind = away from the Sun at the origin
      tmpQ.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sunDir);
      wind.quaternion.copy(tmpQ);
      // Earth's spin axis in wind axes, tipped 11 degrees for the dipole.
      host.updateWorldMatrix(true, false);
      spinAxis.setFromMatrixColumn(host.matrixWorld, 1).normalize().applyQuaternion(tmpQ.clone().invert());
      dipole.copy(spinAxis).applyAxisAngle(new THREE.Vector3(1, 0, 0), (11 * Math.PI) / 180).normalize();
      belts.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dipole);

      const fade = smooth(p, 0, 0.06) * (1 - smooth(p, 0.94, 1));
      // The storm: the CME front crosses from upstream; the stand-off goes
      // from 10 to 6.6 Re, holds, and relaxes.
      const front = -45 + 110 * smooth(p, 0.3, 0.62);
      const squeeze = smooth(p, 0.38, 0.5) * (1 - smooth(p, 0.74, 0.88));
      const r0 = 10 - 3.4 * squeeze;
      const bs = r0 * 1.3;
      magnetopause.scale.setScalar(r0);
      bowShock.scale.setScalar(bs);
      magnetopause.material.uniforms.uOpacity.value = 0.42 * fade;
      bowShock.material.uniforms.uOpacity.value = 0.18 * fade;
      magnetopause.material.uniforms.uTail.value = 60 / r0;
      bowShock.material.uniforms.uTail.value = 50 / bs;
      magnetopause.material.uniforms.uTime.value = T;
      bowShock.material.uniforms.uTime.value = T * 1.3;
      inner.material.uniforms.uOpacity.value = 0.35 * fade;
      outer.material.uniforms.uOpacity.value = (0.22 + 0.25 * squeeze) * fade;

      // Aurora: 67 degrees quiet, out to 58 in the storm; brighter.
      const lat = ((67 - 9 * squeeze) * Math.PI) / 180;
      ovals.forEach((oval) => {
        const h = oval.userData.hemisphere;
        oval.position.set(0, h * 1.02 * Math.sin(lat), 0);
        oval.rotation.set(Math.PI / 2, 0, 0);
        oval.scale.set(1.02 * Math.cos(lat), 1.02 * Math.cos(lat), 1);
      });
      auroraMaterial.opacity = (0.35 + 0.6 * squeeze) * fade;

      // Field lines in the dipole frame, then deformed in wind axes.
      const qd = belts.quaternion;
      let k = 0;
      SHELLS.forEach((L) => {
        for (let lon = 0; lon < LONGITUDES; lon += 1) {
          const phi = (lon / LONGITUDES) * Math.PI * 2;
          const latMax = Math.acos(Math.sqrt(1 / L));
          let prev = null;
          for (let s = 0; s <= STEPS; s += 1) {
            const la = -latMax + (2 * latMax * s) / STEPS;
            const r = L * Math.cos(la) ** 2;
            v.set(r * Math.cos(la) * Math.cos(phi), r * Math.sin(la), r * Math.cos(la) * Math.sin(phi)).applyQuaternion(qd);
            // Squeezed on the day side, stretched down the tail.
            if (v.x < 0) v.x *= 1 - (1 - r0 / 10) * Math.min(1, -v.x / 4);
            else v.x *= 1 + (0.35 + 0.5 * squeeze) * Math.min(1, r / 6) * (L / 6);
            // Lines that would cross the wall are open to the wind: cut there.
            const keep = v.x > -r0 * 0.97 && Math.hypot(v.y, v.z) <= rhoAt(MP, v.x / r0) * r0 * 0.98;
            if (prev && keep && prev.keep) {
              linePositions.set([prev.x, prev.y, prev.z, v.x, v.y, v.z], k);
            } else {
              linePositions.fill(0, k, k + 6);
            }
            if (s > 0) k += 6;
            prev = { x: v.x, y: v.y, z: v.z, keep };
          }
        }
      });
      lineGeometry.attributes.position.needsUpdate = true;
      fieldLines.material.opacity = 0.32 * fade;

      // The wind.
      for (let i = 0; i < WIND; i += 1) {
        const f = flow[i];
        const fast = f.cme ? 1.6 : 1;
        let x = ((f.x + 45 + f.speed * fast * T) % 110) - 45;
        let rho = f.rho;
        let heat = 0;
        const rhoBs = rhoAt(BS, x / bs) * bs;
        const rhoMp = rhoAt(MP, x / r0) * r0;
        if (x > -bs && rho < rhoBs) {
          // Inside the bow shock: squeezed into the sheath round the wall.
          const t = rho / Math.max(0.001, rhoBs);
          rho = rhoMp + (rhoBs - rhoMp) * (0.15 + 0.85 * t);
          heat = 1;
        }
        const born = !f.cme || x < front;
        stream.position[i * 3] = x;
        stream.position[i * 3 + 1] = rho * Math.sin(f.ang);
        stream.position[i * 3 + 2] = rho * Math.cos(f.ang);
        c.copy(f.cme ? cCme : cWind).lerp(cHot, heat * 0.6);
        stream.colour[i * 3] = c.r;
        stream.colour[i * 3 + 1] = c.g;
        stream.colour[i * 3 + 2] = c.b;
        const ends = smooth(x, -45, -38) * (1 - smooth(x, 55, 65));
        const cmeOn = f.cme ? (born ? window01(p, 0.3, 0.8, 0.06) : 0) : 1;
        stream.alpha[i] = (f.cme ? 0.75 : 0.45) * ends * cmeOn * fade;
      }
      stream.geometry.attributes.position.needsUpdate = true;
      stream.geometry.attributes.aColor.needsUpdate = true;
      stream.geometry.attributes.aAlpha.needsUpdate = true;

      // Labels.
      labels.bow.position.set(-bs, 2, 0);
      labels.mp.position.set(-r0, -2.2, 0);
      const mpText = squeeze > 0.5 ? "Magnetopause · pushed in to 6.6 Earth radii" : "Magnetopause · 10 Earth radii";
      if (labels.mp.userData.text !== mpText) { labels.mp.userData.text = mpText; labels.mp.userData.draw([mpText]); }
      labels.belts.position.set(0, -5.6, 0);
      labels.aurora.position.copy(dipole).multiplyScalar(1.6);
      Object.values(labels).forEach((l) => { l.material.opacity = smooth(p, 0.04, 0.1) * (1 - smooth(p, 0.9, 0.96)); });
      labels.aurora.material.opacity *= 0.4 + 0.6 * squeeze;
    },
    dispose() {
      api?.setStage?.(null);
      api?.setVeil?.(null);
      disposeGroup(group);
    },
  };
}

/* ======================================================================
 * 4. Why there are seasons
 * ====================================================================== */

/*
 * A diagram Earth goes once round the scene's own Earth orbit in the time of
 * the event, its axis tipped 23.44 degrees and pointing the same way in space
 * all year (the planets of today are hidden meanwhile, so there is one
 * Earth). The real numbers:
 *   tilt         23.44 degrees
 *   sub-solar    latitude = asin(sin 23.44 x sin(solar longitude))
 *   distance     perihelion ~3 January, 147.1 million km; aphelion ~4 July,
 *                152.1 million km (a 3% difference; eccentricity 0.0167)
 * The orbit is drawn as the scene's circle; the dates are placed by solar
 * longitude, March equinox at 0.
 */
const SEASON_SECONDS = 36;
const TILT = (23.44 * Math.PI) / 180;
const SEASON_STAGES = [
  { at: 0, label: "The axis keeps its direction", text: "Earth's axis is tipped 23.4° and keeps pointing the same way in space — towards Polaris — all the way round the orbit." },
  { at: 0.2, label: "June solstice", text: "The northern half leans towards the Sun: the Sun stands high, days are long and sunlight lands more squarely. Northern summer, southern winter." },
  { at: 0.4, label: "September equinox", text: "Neither half leans towards the Sun. Day and night are about equal everywhere." },
  { at: 0.58, label: "December solstice", text: "Now the southern half leans in: southern summer, northern winter." },
  { at: 0.68, label: "It is not the distance", text: "Earth is closest to the Sun in early January — in the middle of northern winter. The orbit is nearly a circle (3% difference in distance); the tilt is what makes the seasons." },
  { at: 0.86, label: "Other worlds", text: "Mars, tipped 25°, has seasons like Earth's, each about twice as long. Uranus, tipped 98°, gives each pole about 42 years of sunlight and then 42 of darkness." },
];

const GLOBE_VERTEX = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vLocal = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
const GLOBE_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uOpacity;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormalW;
varying vec2 vUv;
float band(float lat, float at, float w) {
  return 1.0 - smoothstep(0.0, w, abs(lat - at));
}
void main() {
  vec3 base = mix(vec3(0.12, 0.28, 0.55), texture2D(uMap, vUv).rgb, uHasMap);
  vec3 sunDir = normalize(-vWorld);
  float ndl = dot(normalize(vNormalW), sunDir);
  float day = smoothstep(-0.05, 0.12, ndl);
  vec3 colour = base * (0.05 + 1.1 * day * max(ndl, 0.0) + 0.25 * day);
  float lat = asin(clamp(vLocal.y, -1.0, 1.0));
  float w = 0.012;
  colour += vec3(1.0) * band(lat, 0.0, w) * 0.5;
  colour += vec3(1.0, 0.72, 0.35) * (band(lat, 0.40911, w) + band(lat, -0.40911, w)) * 0.8;
  colour += vec3(0.55, 0.85, 1.0) * (band(lat, 1.16168, w) + band(lat, -1.16168, w)) * 0.8;
  float sub = smoothstep(0.985, 0.999, ndl);
  colour += vec3(1.0, 0.85, 0.4) * sub * 1.4;
  gl_FragColor = vec4(colour, uOpacity);
}
`;

function buildSeasons(host, camera, options, api) {
  const group = new THREE.Group();
  group.name = "Seasons diagram";
  const hold = worldHold(host, group);
  hold();
  const realEarth = findSceneBody(host, "Earth");
  const earthAt = new THREE.Vector3();
  let R = au2s(1);
  if (realEarth) {
    realEarth.getWorldPosition(earthAt);
    if (earthAt.length() > 10) R = earthAt.length();
  }
  /* Round 44 (Prompts.md: "the size of Earth is shown almost the same as
   * the Sun ... make that view realistic"). The diagram Earth was 8.5% of
   * the orbit's radius, as big on screen as the drawn Sun. Now 3.2%: still
   * enlarged (a true-size Earth would be under a pixel here), and the label
   * says so, but clearly small beside the Sun. */
  const g = R * 0.032;
  /* The real orbit: an ellipse with the Sun at one focus, e = 0.0167,
   * perihelion at heliocentric longitude 102.94 degrees (early January).
   * Drawn true, it is indistinguishable from a circle -- which is the
   * point. */
  const ECC = 0.0167;
  /* Round 45 (Prompts.md: "the orbital path shown should be elliptically
   * elongated ... one side of the ellipse is close and one side is far").
   * Drawn true, the ellipse cannot be seen, so its shape is exaggerated
   * about 27 times (e 0.45: the Sun well off-centre, the near side close
   * and the far side far), the way textbooks draw it, and the label says
   * so. The true orbit stays drawn faintly beside it. Perihelion is still
   * where it really is -- early January, northern winter. */
  const ECC_SHOWN = 0.45;
  const PERI = 102.94;
  const ellipseAt = (e, Ldeg) => (R * (1 - e * e)) / (1 + e * Math.cos(((Ldeg - PERI) * Math.PI) / 180));
  const rAt = (Ldeg) => ellipseAt(ECC_SHOWN, Ldeg);
  const traceOrbit = (line, e) => {
    const positions = line.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 1) {
      const L = (i / (positions.count - 1)) * 360;
      const r = ellipseAt(e, L);
      positions.setXYZ(i, r * Math.cos((L * Math.PI) / 180), 0, r * Math.sin((L * Math.PI) / 180));
    }
    positions.needsUpdate = true;
  };
  const orbit = ring(1, 0xcfe0ff);
  traceOrbit(orbit, ECC_SHOWN);
  const trueOrbit = ring(1, 0x8fa6c8);
  traceOrbit(trueOrbit, ECC);
  group.add(trueOrbit);
  // The two ends of the long axis, joined through the Sun.
  const axisLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos((PERI * Math.PI) / 180), 0, Math.sin((PERI * Math.PI) / 180)).multiplyScalar(rAt(PERI)),
      new THREE.Vector3(Math.cos(((PERI + 180) * Math.PI) / 180), 0, Math.sin(((PERI + 180) * Math.PI) / 180)).multiplyScalar(rAt(PERI + 180)),
    ]),
    new THREE.LineDashedMaterial({ color: 0xffd27a, dashSize: 10, gapSize: 10, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }),
  );
  axisLine.computeLineDistances();
  axisLine.raycast = () => {};
  group.add(axisLine);
  const orbitLabel = label(["Earth's orbit · shape exaggerated about 27×", "the real one (faint ring) is almost a circle: 147.1 to 152.1 million km"], { colour: "#dfe9ff", height: 0.026 });
  orbitLabel.position.copy(new THREE.Vector3(Math.cos(((PERI + 180) * Math.PI) / 180), 0, Math.sin(((PERI + 180) * Math.PI) / 180)).multiplyScalar(rAt(PERI + 180) * 0.62));
  orbitLabel.center.set(0.5, 0.5);
  group.add(orbitLabel);
  const sizeLabel = label(["Earth drawn far larger than true size", "(about 1/109 of the Sun across)"], { colour: "#cfd8e8", height: 0.022 });
  group.add(sizeLabel);
  group.add(orbit);
  const map = realEarth?.material?.map ?? null;
  const globeMaterial = new THREE.ShaderMaterial({
    vertexShader: GLOBE_VERTEX,
    fragmentShader: GLOBE_FRAGMENT,
    uniforms: { uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uOpacity: { value: 0 } },
    transparent: true,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(g, 64, 32), globeMaterial);
  globe.raycast = () => {};
  globe.renderOrder = 25;
  const tilt = new THREE.Group();
  tilt.add(globe);
  group.add(tilt);
  // The axis: through the poles, with the north end longer.
  const axisGeometry = new THREE.BufferGeometry();
  axisGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, -g * 2.2, 0, 0, g * 2.8, 0], 3));
  const axis = new THREE.Line(axisGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  axis.raycast = () => {};
  tilt.add(axis);
  const north = label(["N"], { colour: "#ffffff", height: 0.022 });
  north.position.set(0, g * 3.0, 0);
  tilt.add(north);

  /* Heliocentric longitude L of Earth; solar longitude = L - 180. In scene
   * axes the orbit is (R cos L, 0, R sin L). At the June solstice (L = 270)
   * the north pole leans towards the Sun: the axis is (0, cos tilt, sin tilt). */
  const axisDir = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT)).normalize();
  tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisDir);
  const at = (Ldeg, scale = 1) => {
    const r = rAt(Ldeg) * scale;
    return new THREE.Vector3(r * Math.cos((Ldeg * Math.PI) / 180), 0, r * Math.sin((Ldeg * Math.PI) / 180));
  };
  const markers = [
    { L: 180, lines: ["March equinox · 20 March", "day and night about equal"] },
    { L: 270, lines: ["June solstice · 21 June", "north leans towards the Sun"] },
    { L: 0, lines: ["September equinox · 22–23 September", "day and night about equal"] },
    { L: 90, lines: ["December solstice · 21 December", "south leans towards the Sun"] },
    { L: 102.9, lines: ["Closest to the Sun · ~3 January", "147.1 million km — northern winter"], inner: true, from: 0.03 },
    { L: 282.9, lines: ["Farthest from the Sun · ~4 July", "152.1 million km — northern summer"], inner: true, from: 0.03 },
  ].map((m) => {
    const dot = glowSprite(m.inner ? 0xffd27a : 0xcfe0ff, 0.012, { attenuate: false });
    dot.position.copy(at(m.L));
    const tag = label(m.lines, { colour: m.inner ? "#ffe3b0" : "#e8f1ff", height: 0.026 });
    /* Outside the ellipse; the closest-point label below the solstice
     * label it sits near (round 45). */
    tag.position.copy(at(m.L, 1.14));
    if (m.inner) tag.center.set(0.5, -0.4);
    group.add(dot, tag);
    return { ...m, dot, tag };
  });
  const readout = label(["", ""], { colour: "#fff3d6", height: 0.03 });
  group.add(readout);
  const sunRay = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3)), new THREE.LineDashedMaterial({ color: 0xffd27a, dashSize: 8, gapSize: 8, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  sunRay.raycast = () => {};
  group.add(sunRay);

  const tell = stageTeller(api, SEASON_STAGES);
  let veiled = false;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const spinQ = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  let lastText = "";

  return {
    group,
    duration: SEASON_SECONDS,
    update(p) {
      hold();
      tell(p);
      const wantVeil = p < 0.97;
      if (wantVeil !== veiled) { veiled = wantVeil; api?.setVeil?.(wantVeil ? "system" : null); }
      const fade = smooth(p, 0, 0.05) * (1 - smooth(p, 0.94, 1));
      /* One year from the March equinox, slowing at each solstice and
       * equinox so they can be read: L = 180 + 360 (s - 0.6 sin(8 pi s) / 8 pi). */
      const s = clamp01((p - 0.04) / 0.84);
      const L = 180 + 360 * (s - (0.6 * Math.sin(8 * Math.PI * s)) / (8 * Math.PI));
      const position = at(L);
      tilt.position.copy(position);
      spinQ.setFromAxisAngle(Y, p * SEASON_SECONDS * 2.2);
      globe.quaternion.copy(spinQ);
      globeMaterial.uniforms.uOpacity.value = fade;
      axis.material.opacity = 0.85 * fade;
      north.material.opacity = fade;
      orbit.material.opacity = 0.5 * fade;
      trueOrbit.material.opacity = 0.16 * fade;
      axisLine.material.opacity = 0.35 * fade;
      sunRay.geometry.attributes.position.setXYZ(1, position.x, position.y, position.z);
      sunRay.geometry.attributes.position.needsUpdate = true;
      sunRay.computeLineDistances();
      sunRay.material.opacity = 0.35 * fade;

      markers.forEach((m) => {
        const shown = smooth(p, m.from ?? 0.03, (m.from ?? 0.03) + 0.05) * fade;
        m.dot.material.opacity = shown;
        m.tag.material.opacity = shown * 0.95;
      });
      // Round 45: the solstices sit next to the closest and farthest points.
      declutterLabels([...markers.map((m) => m.tag), orbitLabel], camera);

      // The sub-solar latitude and the date.
      const lambda = (((L - 180) % 360) + 360) % 360;
      const dec = (Math.asin(Math.sin(TILT) * Math.sin((lambda * Math.PI) / 180)) * 180) / Math.PI;
      const day = (79.5 + (lambda / 360) * 365.25) % 365.25;
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86400000);
      const season = Math.abs(dec) < 3 ? "equinox: day and night about equal" : dec > 0 ? "northern summer, southern winter" : "southern summer, northern winter";
      const text = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} · Sun overhead at ${Math.abs(dec).toFixed(1)}° ${dec >= 0 ? "N" : "S"}|${season}`;
      if (text !== lastText) { lastText = text; readout.userData.draw(text.split("|")); }
      readout.position.copy(position).add(new THREE.Vector3(0, -g * 4, 0));
      sizeLabel.position.copy(position).add(new THREE.Vector3(0, g * 4.2, 0));
      sizeLabel.center.set(0.5, 0);
      sizeLabel.material.opacity = 0.8 * fade * (1 - smooth(p, 0.16, 0.22));
      orbitLabel.material.opacity = 0.85 * fade * smooth(p, 0.06, 0.12);
      readout.center.set(0.5, 0.5);
      readout.material.opacity = fade * smooth(p, 0.04, 0.08);
    },
    dispose() {
      api?.setVeil?.(null);
      api?.setStage?.(null);
      disposeGroup(group);
    },
  };
}

/* ======================================================================
 * The definitions, in solarSystemEvents.js's format.
 * ====================================================================== */
export const PROCESS_EVENTS = [
  {
    id: "solar-system-formation",
    body: "Sun",
    place: "The early Solar System",
    title: "How the Solar System formed",
    kind: "recorded",
    family: "origins",
    when: "Began 4,567.3 million years ago; the planets were built within about 100 million years",
    detail: "From a collapsing cloud to a disc, the first solids, Jupiter's early core, the rocky planets and the giants' great reshuffle",
    frequency: "Once. Dated from the oldest grains in meteorites to within 160,000 years (Connelly et al. 2012)",
    cause: "Gravity pulled a cold cloud of gas and dust together; its spin flattened it into a disc round the young Sun, and in the disc dust stuck into pebbles, pebbles into planetesimals and planetesimals into planets.",
    note: "Telescopes such as ALMA see the same thing happening now round young stars: flat discs of dust with dark rings where planets are probably clearing their paths.",
    accuracy: "A diagram on the scene's compressed distance scale: grains, sizes and colours are chosen to be read, and the clock is not linear. The dates are the measured ones; how the giant planets moved is the leading model (Nesvorný 2018), not a certainty.",
    shotZoom: 48,
    shotPitch: 0.9,
    build: (host, camera, options, api) => buildFormation(host, camera, options, api),
  },
  {
    id: "solar-wind",
    body: "Sun",
    place: "The Sun · out to the heliopause",
    title: "The solar wind",
    kind: "ongoing",
    family: "solar",
    detail: "The Sun's stream of charged particles, fast from the poles and slow from the equator, wound into a spiral by the Sun's turning — out to where it stops",
    frequency: "Continuous. Over a million tonnes a second; gusts and storms come with the 11-year solar cycle",
    cause: "The corona is over a million degrees — too hot for the Sun's gravity to hold — so it expands into space as a supersonic wind until the pressure of the gas between the stars stops it.",
    note: "Voyager 1 left the bubble the wind blows in August 2012 and Voyager 2 in November 2018; both are still sending back measurements from interstellar space.",
    accuracy: "The solar wind itself is invisible; it is drawn as a glowing gas so its flow can be seen, the way NASA's visualisations show it. Distances are the scene's compressed ones and the clock speeds up as the wind goes out. The spiral is not drawn — it forms from the Sun's turning.",
    /* Starts close on the Sun; the event then moves the camera out
     * (api.setZoom, round 44). */
    shotZoom: 3.6,
    shotPitch: 1.05,
    build: (host, camera, options, api) => buildSolarWind(host, camera, options, api),
  },
  {
    id: "earth-magnetosphere",
    body: "Earth",
    place: "Earth · its magnetosphere",
    title: "A magnetic shield in a storm",
    kind: "recurring",
    family: "fields",
    detail: "A coronal mass ejection hits Earth's magnetosphere: the shield is squeezed, the field shakes and the aurorae flare",
    frequency: "Strong geomagnetic storms come several times a year near solar maximum; the shield itself never switches off",
    cause: "Earth's liquid-iron outer core makes a magnetic field that deflects the charged solar wind. When the Sun throws a dense, fast cloud of plasma at Earth, it pushes the field in and drives currents that light up the aurorae.",
    note: "Mercury, Jupiter, Saturn, Uranus, Neptune and even the moon Ganymede have magnetospheres too; Jupiter's is the largest structure in the Solar System after the heliosphere.",
    accuracy: "Drawn to true scale in Earth radii — so the Moon, really 60 Earth radii away, is off the picture and is hidden while this runs. Field lines and belts show the shape, not a measured snapshot.",
    facesSun: false,
    shotSwing: Math.PI * 0.5,
    shotZoom: 22,
    shotPitch: 0.32,
    build: (host, camera, options, api) => buildMagnetosphere(host, camera, options, api),
  },
  {
    id: "seasons",
    body: "Sun",
    place: "Earth · and every planet",
    title: "Why there are seasons",
    kind: "recurring",
    family: "orbit",
    detail: "The tilt, not the distance: Earth's axis keeps one direction as it goes round the Sun",
    frequency: "Every orbit: four seasons a year on Earth, about twice as long on Mars, 21 years each on Uranus",
    cause: "Earth's axis is tipped 23.4° and stays pointed the same way in space. For half the year the north leans towards the Sun and gets higher, longer, more direct sunlight; for the other half the south does.",
    note: "Earth is closest to the Sun in early January — during northern winter — which is the quickest proof that distance is not what makes the seasons.",
    accuracy: "A diagram: Earth is enlarged so it can be seen, and the orbit's ellipse is exaggerated about 27 times so its shape shows (the true orbit, drawn faintly, is almost a circle). The other planets are hidden while it runs. The tilt, the dates, the closest and farthest points and the sub-solar latitude are the real ones.",
    /* Steeper (round 44): from 0.62 rad the near-circle read as a long
     * ellipse, foreshortened by the low angle. */
    shotZoom: 9.5,
    shotPitch: 1.1,
    build: (host, camera, options, api) => buildSeasons(host, camera, options, api),
  },
];

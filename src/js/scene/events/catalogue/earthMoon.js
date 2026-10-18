import * as THREE from "three";
import { TAU, rng } from "./kit.js";
import { bodyRadius } from "./real.js";
import { TEXTURE_URLS } from "../../../config/textures.js";

/**
 * Round 83 (Prompts.md, the Earth and Moon events: "do it with the real
 * bodies of our solar system"): helpers for staging events on the site's own
 * Earth and Moon.
 *
 *   earthLayers   the real Earth's cloud deck, city lights, air and aurora,
 *                 hidden or faded for an event and put back after
 *   earthSkin     a second surface laid just over the real Earth: the
 *                 molten proto-Earth, or the map of Earth 66 million years
 *                 ago, cross-faded in, with an impact's glow and a dust veil
 *   moonRig       the real Moon placed where an event needs it (its distance,
 *                 its side of Earth), turned near side to Earth, put back
 *   moonShadow    Earth's umbra and penumbra falling on the real Moon, the
 *                 umbra lit copper
 *
 * Nothing here runs unless an event is staged; everything it adds is a child
 * of a real body, removed by the stage's dispose (ctx.attach).
 */

/* tools/paleo-earth/make-earth-66ma.py: the NASA Blue Marble map with the
 * continents turned back to roughly where they were 66 million years ago.
 * Served beside the site's own Earth map. */
export const EARTH_66MA_URL = String(TEXTURE_URLS.earth ?? "/textures/earth-bmng-july-4k.jpg").replace(/[^/]*$/, "earth-66ma-2k.jpg");

let paleoTexture = null;
function paleoMap() {
  if (!paleoTexture) {
    paleoTexture = new THREE.TextureLoader().load(EARTH_66MA_URL);
    paleoTexture.colorSpace = THREE.SRGBColorSpace;
    paleoTexture.anisotropy = 4;
  }
  return paleoTexture;
}

/* ------------------------------------------------------------ Earth's layers */

/**
 * The real Earth's own layers (earthVisuals.js): the cloud deck, the city
 * lights, the sunlit air and the aurora. `fade(name, a)` scales a layer's
 * opacity (hidden at 0); restore() puts every one back as it was.
 */
export function earthLayers(earth) {
  const find = (name) => earth?.getObjectByName?.(name) ?? null;
  const parts = {
    clouds: find("Earth NASA cloud system"),
    lights: find("Earth nightside city lights"),
    air: find("Earth sunlit atmospheric limb"),
    aurora: find("Earth polar aurora"),
  };
  const saved = new Map();
  const opacities = new Map();
  Object.values(parts).forEach((object) => {
    if (!object) return;
    saved.set(object, object.visible);
    object.traverse((child) => {
      const u = child.material?.uniforms;
      if (u?.uOpacity) opacities.set(child.material, u.uOpacity.value);
      else if (child.material && !u) opacities.set(child.material, child.material.opacity);
    });
  });
  return {
    ...parts,
    fade(name, a) {
      const object = parts[name];
      if (!object) return;
      object.visible = a > 0.002 && (saved.get(object) ?? true);
      object.traverse((child) => {
        const m = child.material;
        if (!m || !opacities.has(m)) return;
        if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = opacities.get(m) * a;
        else { m.opacity = opacities.get(m) * a; m.transparent = true; }
      });
    },
    restore() {
      saved.forEach((visible, object) => { object.visible = visible; });
      opacities.forEach((value, m) => {
        if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = value;
        else m.opacity = value;
      });
    },
  };
}

/* --------------------------------------------------------- Earth's other skin */

const SKIN_VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vN;
varying vec3 vCentre;
varying vec2 vUv;
void main() {
  vUv = uv;
  vObj = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vCentre = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const SKIN_FRAGMENT = /* glsl */ `
uniform float uMix;
uniform float uMode;
uniform float uHeat;
uniform float uTime;
uniform float uGain;
uniform sampler2D uMap;
uniform vec3 uHit;
uniform float uFire;
uniform float uReach;
uniform float uBurn;
uniform float uDark;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vCentre;
varying vec2 vUv;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                 mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                 mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; }
  return s;
}
void main() {
  vec3 n = normalize(vN);
  vec3 toSun = normalize(-vCentre);
  float lam = max(dot(n, toSun), 0.0);
  float day = smoothstep(-0.1, 0.25, dot(n, toSun));
  vec3 col;
  vec3 glow = vec3(0.0);
  if (uMode < 0.5) {
    /* The molten proto-Earth: dark crust broken by glowing cracks, golden
       swirls and pale ash, lava seas that spread as uHeat rises. */
    vec3 q = vObj * 2.6;
    float f = fbm(q + vec3(0.0, uTime * 0.004, 0.0));
    float g = fbm(q * 2.4 + vec3(f * 2.2, f * 1.3, -f));
    float crack = 1.0 - smoothstep(0.0, 0.035 + 0.05 * uHeat, abs(g - 0.5));
    vec3 crust = mix(vec3(0.06, 0.05, 0.05), vec3(0.3, 0.2, 0.11), smoothstep(0.38, 0.72, f));
    crust = mix(crust, vec3(0.62, 0.42, 0.16), smoothstep(0.56, 0.78, g) * 0.65);
    crust = mix(crust, vec3(0.7, 0.68, 0.64), smoothstep(0.66, 0.84, f) * 0.55);
    float pools = smoothstep(0.6 - 0.28 * uHeat, 0.74 - 0.28 * uHeat, fbm(vObj * 1.7 + 3.1));
    float lava = max(crack * (0.55 + 0.45 * uHeat), pools);
    float flick = 0.85 + 0.15 * sin(uTime * 1.7 + f * 23.0);
    vec3 lavaCol = mix(vec3(1.0, 0.28, 0.04), vec3(1.0, 0.72, 0.28), clamp(crack * 0.6 + pools * 0.2, 0.0, 1.0));
    /* The colours above are picked as screen (sRGB) values; light works
       in linear ones. */
    crust = pow(crust, vec3(2.2));
    lavaCol = pow(lavaCol, vec3(2.2));
    col = crust * (0.04 + 1.25 * lam * day);
    glow = lavaCol * lava * flick * (0.7 + 1.1 * uHeat);
  } else {
    col = texture2D(uMap, vUv).rgb * (0.02 + 1.05 * lam);
  }
  /* An impact: a fireball's glow round the site, and the fires that the
     falling ejecta set, spreading out to uReach (radians). */
  float ang = acos(clamp(dot(vObj, normalize(uHit)), -1.0, 1.0));
  glow += vec3(1.0, 0.55, 0.18) * uFire * exp(-ang * ang / 0.0016);
  float ring = smoothstep(uReach, uReach - 0.5, ang) * uBurn;
  float patchy = smoothstep(0.56, 0.78, fbm(vObj * 11.0 + 2.0));
  glow += vec3(1.0, 0.36, 0.06) * ring * patchy * (1.0 - 0.7 * day) * 0.5;
  /* The soot and dust veil: sunlight dimmed across the globe. */
  col = mix(col, vec3(0.045, 0.038, 0.032) * (0.15 + 0.85 * lam), uDark);
  glow *= 1.0 - 0.6 * uDark;
  gl_FragColor = vec4((col * uGain + glow), uMix);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * A second surface laid over the real Earth, turning with it: "proto" (the
 * molten young Earth) or "paleo" (Earth 66 million years ago). Set uMix to
 * cross-fade it in; uHeat, uFire, uBurn, uReach, uDark as the event needs.
 */
export function earthSkin(ctx, earth, kind = "proto") {
  const R = bodyRadius(earth);
  const material = new THREE.ShaderMaterial({
    vertexShader: SKIN_VERTEX,
    fragmentShader: SKIN_FRAGMENT,
    uniforms: {
      uMix: { value: 0 },
      uMode: { value: kind === "paleo" ? 1 : 0 },
      uHeat: { value: 0.3 },
      uTime: { value: 0 },
      /* Brightness against the real Earth's lit material (matched by eye on
       * the site, round 83). */
      uGain: { value: kind === "paleo" ? 1.35 : 1.2 },
      uMap: { value: kind === "paleo" ? paleoMap() : null },
      uHit: { value: new THREE.Vector3(1, 0, 0) },
      uFire: { value: 0 },
      uReach: { value: 0 },
      uBurn: { value: 0 },
      uDark: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.014, 160, 80), material);
  mesh.name = "Event: Earth's other skin";
  mesh.renderOrder = 4;
  mesh.raycast = () => {};
  ctx.attach(earth, mesh);
  mesh.userData.u = material.uniforms;
  return mesh;
}

/* ----------------------------------------------------------------- the Moon */

/**
 * The real Moon, moved for an event. The site hangs it from a pivot inside
 * Earth (moon.js), which the site turns very slowly while a body is in
 * focus; an event can put it at any world position (`place`), turned with
 * its near side -- selenographic longitude 0, the middle of the map -- to
 * Earth, or with any face to any direction (`face`). restore() puts it back
 * on its pivot exactly as it was.
 */
export function moonRig(ctx) {
  const moon = ctx.findBody("Moon");
  const earth = ctx.findBody("Earth");
  const pivot = moon?.parent ?? null;
  const system = pivot?.parent ?? null;
  const guide = system?.getObjectByName?.("Earth satellite orbit guide") ?? null;
  if (!moon || !pivot || !earth) return null;
  const home = moon.position.clone();
  const homeRotation = moon.rotation.clone();
  const earthW = new THREE.Vector3();
  const moonW = new THREE.Vector3();
  earth.getWorldPosition(earthW);
  moon.getWorldPosition(moonW);
  /* The site's Earth-Moon distance, world units (moon.js: 3.15 Earth radii). */
  const distance = moonW.distanceTo(earthW);
  const local = new THREE.Vector3();
  const qParent = new THREE.Quaternion();
  const qWorld = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const xAxis = new THREE.Vector3();
  const yAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const rig = {
    moon, pivot, system, guide, earth, distance,
    radius: bodyRadius(moon),
    /** Earth's world position now. */
    earthAt: (out = new THREE.Vector3()) => earth.getWorldPosition(out),
    /** Turns the Moon so its longitude-0 face points along `dir` (world),
     * north up, then by `spin` radians about its own axis. */
    face(dir, spin = 0) {
      xAxis.copy(dir).normalize();
      yAxis.copy(up).addScaledVector(xAxis, -up.dot(xAxis)).normalize();
      zAxis.crossVectors(xAxis, yAxis);
      basis.makeBasis(xAxis, yAxis, zAxis);
      qWorld.setFromRotationMatrix(basis);
      if (spin) qWorld.multiply(new THREE.Quaternion().setFromAxisAngle(up, spin));
      pivot.updateWorldMatrix(true, false);
      pivot.getWorldQuaternion(qParent);
      moon.quaternion.copy(qParent.invert().multiply(qWorld));
    },
    /** Puts the Moon at a world position; near side to Earth unless told. */
    place(world, { faceEarth = true, spin = 0 } = {}) {
      pivot.updateWorldMatrix(true, false);
      local.copy(world);
      pivot.worldToLocal(local);
      moon.position.copy(local);
      if (faceEarth) {
        earth.getWorldPosition(earthW);
        rig.face(earthW.clone().sub(world), spin);
      }
      moon.updateMatrixWorld(true);
    },
    restore() {
      moon.position.copy(home);
      moon.rotation.copy(homeRotation);
    },
  };
  return rig;
}

const SHADOW_VERTEX = /* glsl */ `
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const SHADOW_FRAGMENT = /* glsl */ `
uniform vec3 uEarth;
uniform vec3 uAxis;
uniform float uUmbra;
uniform float uPen;
uniform float uRed;
uniform float uGain;
uniform float uOpacity;
uniform sampler2D uMap;
varying vec3 vW;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vec3 rel = vW - uEarth;
  float along = dot(rel, uAxis);
  float d = length(rel - uAxis * along);
  float behind = step(0.0, along);
  float inU = (1.0 - smoothstep(uUmbra * 0.975, uUmbra * 1.025, d)) * behind;
  float inP = (1.0 - smoothstep(uUmbra, uPen, d)) * behind;
  vec3 base = texture2D(uMap, vUv).rgb;
  float lum = dot(base, vec3(0.3, 0.5, 0.2));
  /* Only the half facing Earth is lit by the light bent through its air. */
  float facing = max(dot(normalize(vN), normalize(uEarth - vW)), 0.0);
  float edge = clamp(d / max(uUmbra, 0.001), 0.0, 1.0);
  vec3 copper = vec3(0.9, 0.24, 0.07) * lum * mix(0.55, 1.6, edge * edge) * uGain * (0.15 + 0.85 * facing) * uRed;
  float a = clamp(inU + 0.55 * inP * (1.0 - inU), 0.0, 1.0);
  vec3 col = copper * inU / max(a, 0.001);
  gl_FragColor = vec4(col, a * uOpacity);
  #include <colorspace_fragment>
}
`;

/**
 * Earth's shadow on the real Moon: a shell just over it that darkens the
 * penumbra and replaces the umbra with the Moon's own map lit copper.
 * update(earthWorld, sunWorld) each frame; uUmbra and uPen are radii in
 * world units at the Moon; uRed how red the umbra glows (0 black).
 */
export function moonShadow(ctx, rig, { umbra, pen }) {
  const map = rig.moon.material?.map ?? null;
  const material = new THREE.ShaderMaterial({
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    uniforms: {
      uEarth: { value: new THREE.Vector3() },
      uAxis: { value: new THREE.Vector3(1, 0, 0) },
      uUmbra: { value: umbra },
      uPen: { value: pen },
      uRed: { value: 0 },
      uGain: { value: 1.25 },
      uOpacity: { value: 1 },
      uMap: { value: map },
    },
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(rig.radius * 1.014, 96, 48), material);
  mesh.name = "Event: Earth's shadow on the Moon";
  mesh.renderOrder = 5;
  mesh.raycast = () => {};
  ctx.attach(rig.moon, mesh);
  mesh.userData.u = material.uniforms;
  mesh.userData.update = (earthW, sunW) => {
    material.uniforms.uEarth.value.copy(earthW);
    material.uniforms.uAxis.value.copy(earthW).sub(sunW).normalize();
  };
  return mesh;
}

/* ------------------------------------------------------------- small pieces */

/** A ring that always faces the camera: Earth's limb lit red by sunsets,
 * seen from the Moon in an eclipse. Inner and outer radii in its parent's
 * units; turned to the camera with `face(camera)`. */
export function limbRing(ctx, inner, outer, { colour = "#ff5a2a", opacity = 0.9, parent = ctx.root } = {}) {
  const geometry = new THREE.RingGeometry(inner, outer, 128, 4);
  const position = geometry.attributes.position;
  const colours = new Float32Array(position.count * 3);
  const c = new THREE.Color(colour);
  for (let i = 0; i < position.count; i += 1) {
    const r = Math.hypot(position.getX(i), position.getY(i));
    const t = (r - inner) / (outer - inner);
    const k = Math.pow(1 - t, 2.2);
    colours.set([c.r * k, c.g * k + 0.12 * k * (1 - t), c.b * k], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false,
  }));
  mesh.renderOrder = 27;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = opacity;
  const q = new THREE.Quaternion();
  mesh.userData.face = (camera) => {
    mesh.parent?.getWorldQuaternion(q);
    mesh.quaternion.copy(q.invert().multiply(camera.quaternion));
  };
  parent.add(mesh);
  return mesh;
}

/** A hot, glowing ball of molten rock for a newborn moon, cooling as
 * `heat` falls from 1 to 0 (drawn with the kit's lit material). */
export function moltenBall(ctx, radius, { parent = ctx.root, seed = 4 } = {}) {
  const ball = ctx.rock(radius, { seed, lumps: 0.06, colour: "#8a8178", parent, emissive: "#000000" });
  const u = ball.material.uniforms;
  ball.userData.heat = (h) => {
    u.uEmissive.value.setRGB(0.9 * h, 0.28 * h * h, 0.04 * h * h * h);
  };
  return ball;
}

/** Points scattered over a unit disc-shaped band, for debris discs. */
export function bandSamples(count, inner, outer, seed = 1) {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const rad = inner + (outer - inner) * Math.pow(r(), 0.85);
    return { rad, a: r() * TAU, y: (r() - 0.5), k: r(), s: r() };
  });
}

/* -------------------------------------------------------------- Earth's spin */

/**
 * Spins the real Earth about its own axis for an event. The site turns its
 * planets by adding to rotation.y with the tilt in rotation.z (Euler XYZ),
 * which turns the tilted globe about the vertical: harmless at the site's
 * slow pace, but at the speed of a rewind the poles would visibly circle.
 * Here the orientation the event starts with is kept as q0 and the spin is
 * applied about the body's own pole: q = q0 x Ry(s). `turnToward` sets s so
 * a place faces a world direction (`amount` of the way). restore() puts the
 * site's own rotation back.
 */
export function spinner(body) {
  const q0 = body.quaternion.clone();
  const saved = body.rotation.clone();
  const qs = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const qInv = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();
  let s = 0;
  const apply = () => {
    qs.setFromAxisAngle(yAxis, s);
    body.quaternion.copy(q0).multiply(qs);
    body.updateMatrixWorld(true);
  };
  return {
    get angle() { return s; },
    set(angle) { s = angle; apply(); },
    add(delta) { s += delta; apply(); },
    hold() { apply(); },
    turnToward(lat, lon, worldDir, amount = 1) {
      const R = bodyRadius(body);
      const u = (lon + 180) / 360;
      const th = THREE.MathUtils.degToRad(90 - lat);
      const f = new THREE.Vector3(-R * Math.cos(TAU * u) * Math.sin(th), R * Math.cos(th), R * Math.sin(TAU * u) * Math.sin(th));
      body.parent?.getWorldQuaternion(qParent);
      qInv.copy(qParent).multiply(q0).invert();
      const d = worldDir.clone().applyQuaternion(qInv);
      const want = Math.atan2(d.x, d.z) - Math.atan2(f.x, f.z);
      let delta = want - s;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      s += delta * amount;
      apply();
    },
    restore() { body.rotation.copy(saved); },
  };
}

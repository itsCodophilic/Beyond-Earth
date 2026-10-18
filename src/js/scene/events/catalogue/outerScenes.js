import * as THREE from "three";
import { smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { bodyRadius, yawFor, cutter } from "./real.js";
import { toHud, worldRadius, pitchFor, holdShot, distanceFor, hudKit, pin, shotDirection, leanLeft } from "./bodyKit.js";
import { smallBodyAuToScene } from "../../smallBodies/smallBodies.js";

/**
 * Round 86 (Prompts.md, "Next Part": Arrokoth, Neptune's Great Dark Spot,
 * Uranus knocked over, 42 years of daylight, the fastest winds, Charon's red
 * cap, the star that brushes the Oort Cloud and Triton's doomed orbit --
 * "using the real space bodies"): the scenes of those eight events, played
 * on the site's own Uranus, Neptune, Triton, Pluto, Charon, Arrokoth and Sun.
 * outer.js keeps the events' words and points each at its scene here. The
 * round-79 dioramas are kept in docs/archive/outer-dioramas-round79/.
 *
 * Every event has duration 24, so the runner fits it to her line (between
 * 0.6 and 2.6 times that) and it ends when she does.
 *
 * Sizes and orbits are NASA's planetary fact sheets
 * (nssdc.gsfc.nasa.gov/planetary/factsheet) unless a comment says otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

/* Mean radii, km (NASA fact sheets). */
const R_NEPTUNE = 24622;
const R_EARTH = 6371;

/*
 * Spots painted on a shell just above a planet's clouds: up to four ovals,
 * each { dir (unit, the body's own frame), rx, ry (angular half-sizes,
 * radians, east-west and north-south), colour, alpha }. The shell turns
 * with the planet. Depth-tested against the planet itself, so the far half
 * never shows; drawn after the planet's haze so it is not washed out.
 */
function spotShell(ctx, body, radius, spots) {
  const n = 4;
  const uniforms = {
    uC: { value: Array.from({ length: n }, () => new THREE.Vector3(0, 0, 1)) },
    uE: { value: Array.from({ length: n }, () => new THREE.Vector3(1, 0, 0)) },
    uN: { value: Array.from({ length: n }, () => new THREE.Vector3(0, 1, 0)) },
    uSize: { value: Array.from({ length: n }, () => new THREE.Vector2(0.1, 0.1)) },
    uCol: { value: Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uC[4];
      uniform vec3 uE[4];
      uniform vec3 uN[4];
      uniform vec2 uSize[4];
      uniform vec4 uCol[4];
      varying vec3 vDir;
      void main() {
        vec3 colour = vec3(0.0);
        float alpha = 0.0;
        for (int i = 0; i < 4; i++) {
          if (uCol[i].a <= 0.0) continue;
          float x = atan(dot(vDir, uE[i]), dot(vDir, uC[i])) / uSize[i].x;
          float y = asin(clamp(dot(vDir, uN[i]), -1.0, 1.0)) / uSize[i].y;
          float r = length(vec2(x, y));
          float m = (1.0 - smoothstep(0.62, 1.0, r)) * step(0.0, dot(vDir, uC[i]));
          float a = m * uCol[i].a;
          colour = mix(colour, uCol[i].rgb, a / max(alpha + a, 0.0001));
          alpha = max(alpha, a);
        }
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material);
  mesh.renderOrder = 24;
  mesh.name = "Space event: spots on the clouds";
  ctx.attach(body, mesh);
  const set = (i, { dir, rx, ry, colour = "#0a1240", alpha = 0 }) => {
    const c = dir.clone().normalize();
    const up = Math.abs(c.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const e = new THREE.Vector3().crossVectors(up, c).normalize();
    const nn = new THREE.Vector3().crossVectors(c, e).normalize();
    uniforms.uC.value[i].copy(c);
    uniforms.uE.value[i].copy(e);
    uniforms.uN.value[i].copy(nn);
    uniforms.uSize.value[i].set(rx, ry);
    const col = new THREE.Color(colour);
    uniforms.uCol.value[i].set(col.r, col.g, col.b, alpha);
  };
  spots.forEach((s, i) => set(i, s));
  return {
    mesh,
    alpha(i, a) { uniforms.uCol.value[i].w = a; },
    set,
  };
}

/* Holds a planet's own orientation fixed in the world while an event
 * runs (the site turns it every frame); put() re-asserts it. */
function holdOrientation(body) {
  const rot0 = body.rotation.clone();
  const q0 = body.quaternion.clone();
  return {
    rot0,
    put(q = q0) { body.quaternion.copy(q); },
    restore() { body.rotation.copy(rot0); },
  };
}

/* ------------------------------------------------------------ Uranus */

/*
 * Uranus knocked on its side. The real Uranus, seen side on so its 97.8°
 * tilt is in the picture: its axis, the upright beside it, rolling round
 * the Sun; then rewound to an upright young planet with no rings, struck
 * off-centre by a world about twice Earth's mass, tipped over, and its
 * rings back round the new equator.
 */
function uranusTippedScene(ctx) {
  /* Obliquity 97.77° (NASA Uranus fact sheet); the site's own tilt is its
   * rotation.z, 1.71 rad, which is what is drawn. Rings 41,837 (ring 6) to
   * 51,149 km (epsilon): 1.65–2.02 radii (NASA Uranian rings fact sheet). */
  const uranus = ctx.host;
  const R = worldRadius(uranus);
  const U = uranus.getWorldPosition(new THREE.Vector3());
  const sunDir = U.clone().negate().normalize();
  const fov = uranus.userData?.focusFov ?? 30;
  const hold = holdOrientation(uranus);
  const parentQ = uranus.parent.getWorldQuaternion(new THREE.Quaternion());
  /* Its axis as the site has it right now (the parent's frame), and the
   * line it was tipped about: upright turned by TILT0 about K gives it. */
  const Y = new THREE.Vector3(0, 1, 0);
  const q0 = uranus.quaternion.clone();
  const a0 = Y.clone().applyQuaternion(q0).normalize();
  const TILT0 = Math.acos(THREE.MathUtils.clamp(a0.y, -1, 1));
  const K = new THREE.Vector3().crossVectors(Y, a0);
  if (K.lengthSq() < 1e-8) K.set(0, 0, 1);
  K.normalize();
  /* Looking along that line, from the Sun's side of it, leaning toward the
   * Sun so the face is lit: the tilt lies across the picture. */
  const zW = K.clone().applyQuaternion(parentQ);
  if (zW.dot(sunDir) < 0) zW.negate();
  const view = zW.clone().addScaledVector(sunDir, 0.55).normalize();
  const dist = distanceFor(R * 2.25, 0.62, fov);
  const shot = holdShot(ctx, "Uranus", uranus, { yaw: yawFor(view), pitch: pitchFor(view), distance: dist });

  const rings = uranus.getObjectByName("Uranus realistic 13-ring system");
  const ringsVisible0 = rings?.visible ?? true;
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  /* Uranus's orientation for a tilt theta about K and a spin phi about its
   * own axis, equal to the site's own at (TILT0, 0). */
  const S0 = new THREE.Quaternion().setFromAxisAngle(K, TILT0).invert().multiply(q0);
  const orient = (theta, phi) => {
    qa.setFromAxisAngle(K, theta);
    qb.setFromAxisAngle(Y, phi);
    uranus.quaternion.copy(qa).multiply(qb).multiply(S0);
  };

  /* Overlays in the stage's own frame (world axes, 1 = Uranus's radius),
   * turned to the tilt as it changes: the axis, a spin arrow round its
   * north end, the upright and the angle between them. */
  const tiltFrame = new THREE.Group();
  ctx.add(tiltFrame);
  const axis = ctx.line([[0, -1.65, 0], [0, 1.65, 0]], { colour: "#ffd27f", opacity: 1, additive: false, parent: tiltFrame });
  axis.renderOrder = 32;
  const spinArc = ctx.circle(0.4, { plane: "xz", from: 0.4, to: TAU - 0.5, colour: "#ffd27f", opacity: 0.9, parent: tiltFrame });
  spinArc.position.y = 1.4;
  const endA = TAU - 0.5;
  const tip = new THREE.Vector3(Math.cos(endA) * 0.4, 1.4, Math.sin(endA) * 0.4);
  const tangent = new THREE.Vector3(-Math.sin(endA), 0, Math.cos(endA));
  const spinHead = ctx.arrow(tip.clone().addScaledVector(tangent, -0.06), tip.clone().addScaledVector(tangent, 0.1), { head: 0.12, parent: tiltFrame });
  const upright = ctx.line([[0, -1.8, 0], [0, 1.8, 0]], { colour: "#9fb3c8", opacity: 0.6, dashed: true, dash: 0.08, gap: 0.06 });
  upright.quaternion.copy(parentQ);
  const arc = ctx.line([[0, 1.2, 0], [0, 1.2, 0]], { colour: "#ffd27f", opacity: 0.85 });
  arc.quaternion.copy(parentQ);
  /* A debris disc round the new equator, which becomes the rings. */
  const DISC = 900;
  const dr = rng(31);
  const disc = ctx.cloud(DISC, { size: 2.2, parent: tiltFrame });
  const discData = Array.from({ length: DISC }, () => ({ r: 1.2 + dr() * 1.1, a: dr() * TAU, h: (dr() - 0.5) * 0.06, w: 0.3 + dr() * 0.5 }));
  discData.forEach((_, i) => disc.tint(i, i % 3 ? "#d8c8b4" : "#cfe6ee"));

  /* The impactor: about two Earth masses of rock and ice, radius ~1.25
   * Earth's (Kegerreis et al. 2018 use 1–3 Earth masses): 0.31 Uranus
   * radii. It comes in from the upper left of the picture. */
  const cam = shotDirection(shot.yaw, shot.pitch);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), cam).normalize().negate();
  const upS = new THREE.Vector3().crossVectors(cam, right).normalize().negate();
  const impactor = ctx.ball(0.31, { colour: "#8d8478", rim: 0.25 });
  const hitDir = right.clone().multiplyScalar(-0.7).addScaledVector(upS, 0.62).addScaledVector(cam, 0.35).normalize();
  const contact = hitDir.clone();
  const impStart = hitDir.clone().multiplyScalar(1.31).addScaledVector(right, -5.5).addScaledVector(upS, 2.6);
  const impEnd = hitDir.clone().multiplyScalar(1.0 + 0.31 * 0.6);
  const flash = ctx.glow("#fff1d0", 0.6, { opacity: 1 });
  flash.position.copy(contact);
  const DEBRIS = 320;
  const debris = ctx.cloud(DEBRIS, { size: 2.6 });
  const debrisV = Array.from({ length: DEBRIS }, () => new THREE.Vector3(dr() - 0.5, dr() - 0.5, dr() - 0.5).normalize().multiplyScalar(0.7).add(hitDir).normalize().multiplyScalar(0.6 + dr() * 2.2));
  debrisV.forEach((_, i) => debris.tint(i, i % 3 ? "#ffd2a0" : "#cfe6ee"));

  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const angleLabel = H.label([""], { height: 0.05, colour: "#ffe2a8", declutter: false });
  const axisLabel = H.label(["Spin axis"], { height: 0.036, colour: "#ffe2a8", declutter: false });
  const status = H.label(["", ""], { at: [-0.62, -0.62, 0], height: 0.05, declutter: false });
  /* Inset, top left: the orbit from above, the axis keeping its direction. */
  const inset = new THREE.Group();
  inset.position.set(-0.98, 0.42, 0);
  hud.add(inset);
  const IK = hudKit(ctx, inset);
  const insetOrbit = new THREE.Group();
  insetOrbit.rotation.x = 0.55;
  inset.add(insetOrbit);
  IK.sun(0.03, { halo: 4, parent: insetOrbit });
  IK.circle(0.26, { plane: "xz", colour: "#9fd6dc", opacity: 0.55, parent: insetOrbit });
  const mini = new THREE.Group();
  insetOrbit.add(mini);
  IK.ball(0.024, { body: "Uranus", parent: mini });
  const axisDir = new THREE.Vector3(Math.sin(97.77 * DEG), Math.cos(97.77 * DEG), 0);
  IK.line([axisDir.clone().multiplyScalar(-0.06), axisDir.clone().multiplyScalar(0.06)], { colour: "#ffd27f", opacity: 1, additive: false, parent: mini });
  IK.label(["Its 84-year orbit, from above", "the axis keeps pointing one way"], { at: [0, -0.24, 0], height: 0.04, declutter: false });
  [angleLabel, axisLabel, status, flash, impactor].forEach((o) => ctx.fade(o, 0));
  ctx.fade(inset, 0);

  ctx.tell([
    { at: 0, label: "On its side", text: "The real Uranus. Its spin axis is tipped 97.8° from upright: it lies almost flat in the plane of its orbit." },
    { at: 0.2, label: "Rolling round", text: "The axis keeps pointing the same way in space, so over each 84-year orbit Uranus rolls around the Sun like a ball." },
    { at: 0.5, label: "Long ago", text: "The leading idea: the young Uranus spun upright, like the other giants — until something hit it." },
    { at: 0.66, label: "Knocked over", text: "A world several times Earth's mass strikes off-centre and tips it over. The debris settles round the new equator, where the rings and moons orbit today." },
  ]);
  const w = new THREE.Vector3();
  const qArc = new THREE.Quaternion();
  const arcPts = (theta) => Array.from({ length: 41 }, (_, i) => new THREE.Vector3(0, 1.25, 0).applyQuaternion(qArc.setFromAxisAngle(K, (theta * i) / 40)));
  let phi = 0;
  let lastT = ctx.t;
  return {
    duration: 24,
    update(p) {
      shot.keep();
      const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
      lastT = ctx.t;
      /* Tilt: today, rewound upright (0.5–0.57), knocked over (0.68–0.8)
       * with a small wobble that dies away. */
      let theta = TILT0;
      if (p >= 0.5 && p < 0.68) theta = lerp(TILT0, 0, easeInOut(span(p, 0.5, 0.57)));
      else if (p >= 0.68) {
        const k = span(p, 0.68, 0.84);
        theta = TILT0 * (1 - Math.pow(1 - k, 3)) + 0.12 * Math.sin(k * 9) * (1 - k) * (k > 0 ? 1 : 0);
      }
      /* Spin: steady, run backwards fast while rewinding. */
      const rewinding = p >= 0.5 && p < 0.57;
      phi += dt * (rewinding ? -6 : 0.7);
      orient(theta, phi);
      tiltFrame.quaternion.copy(parentQ).multiply(qa.setFromAxisAngle(K, theta));
      ctx.setLine(arc, arcPts(Math.max(0.01, theta)));
      ctx.fade(arc, theta > 0.05 ? smooth(p, 0.02, 0.08) : 0);
      ctx.fade(upright, smooth(p, 0.02, 0.08));
      ctx.fade(axis, smooth(p, 0.0, 0.05));
      ctx.fade(spinArc, smooth(p, 0.0, 0.05));
      ctx.fade(spinHead, smooth(p, 0.0, 0.05));
      /* The angle's number beside the arc. */
      w.set(0, 1.6, 0).applyQuaternion(qArc.setFromAxisAngle(K, theta / 2)).applyQuaternion(parentQ).multiplyScalar(R).add(uranus.getWorldPosition(new THREE.Vector3()));
      const ha = toHud(ctx, w);
      angleLabel.position.set(ha.x, ha.y, 0);
      angleLabel.userData.draw([`${(theta / DEG * (97.77 / (TILT0 / DEG))).toFixed(1)}°`]);
      ctx.fade(angleLabel, theta > 0.15 ? smooth(p, 0.04, 0.1) : 0);
      tiltFrame.localToWorld(w.set(0, 1.9, 0));
      pin(ctx, axisLabel, w, 0, 0.04);
      ctx.fade(axisLabel, smooth(p, 0.04, 0.1) * (1 - smooth(p, 0.46, 0.5)));
      /* Rings: gone while rewound; back from the debris disc. */
      if (rings) rings.visible = p < 0.52 || p > 0.88;
      const discOn = smooth(p, 0.74, 0.8) * (1 - smooth(p, 0.9, 0.97));
      for (let i = 0; i < DISC; i += 1) {
        const d = discData[i];
        const settle = span(p, 0.72, 0.92);
        const rr = lerp(d.r * 1.6, d.r, easeInOut(settle));
        const a = d.a + ctx.t * d.w * 0.4;
        disc.set(i, Math.cos(a) * rr, d.h * (1 + 4 * (1 - settle)), Math.sin(a) * rr);
        disc.alpha[i] = discOn * 0.75;
      }
      disc.commit();
      /* Inset orbit, 0.2–0.5. */
      const insetA = win(p, 0.18, 0.5, 0.04);
      ctx.fade(inset, insetA);
      const orbitPhase = TAU * span(p, 0.18, 0.5) + 0.3;
      mini.position.set(Math.cos(orbitPhase) * 0.26, 0, -Math.sin(orbitPhase) * 0.26);
      /* The impact. */
      const fly = span(p, 0.57, 0.68);
      impactor.position.lerpVectors(impStart, impEnd, fly * fly);
      ctx.fade(impactor, p > 0.565 && p < 0.685 ? 1 : 0);
      const bang = span(p, 0.68, 0.78);
      flash.scale.setScalar(0.6 + 3.2 * Math.sqrt(bang));
      ctx.fade(flash, p >= 0.68 ? 1 - bang : 0);
      const tau = span(p, 0.68, 0.9);
      for (let i = 0; i < DEBRIS; i += 1) {
        const v = debrisV[i];
        debris.set(i, contact.x + v.x * tau, contact.y + v.y * tau, contact.z + v.z * tau);
        debris.alpha[i] = p >= 0.68 ? 0.9 * (1 - tau) : 0;
      }
      debris.commit();
      status.userData.draw(p < 0.5 ? ["Today", "tilted 97.8° — on its side"]
        : p < 0.68 ? ["Long ago", "a young, upright Uranus — no rings yet"]
          : p < 0.86 ? ["Impact", "the planet tips over"]
            : ["Knocked over", "rings and moons form round the new equator"]);
      ctx.fade(status, smooth(p, 0.02, 0.08));
    },
    dispose() {
      hold.restore();
      if (rings) rings.visible = ringsVisible0;
    },
  };
}

/*
 * 42 years of daylight. One 84-year orbit of the real Uranus in the length
 * of her line, seen by a camera travelling with it on the Sun's side: the
 * south pole in sunlight (1986), the Sun over the equator (2007), the north
 * pole in sunlight (2028), the equator again (2049). The inset shows the
 * orbit from above, the axis keeping its direction in space.
 */
function uranusSeasonsScene(ctx) {
  /* Obliquity 97.77°, sidereal period 84.02 years (NASA). Equinox
   * 7 December 2007 (Sromovsky et al. 2009); the solstices a quarter-orbit
   * either side, ~1986.9 and ~2028.9 (the orbit's eccentricity, 0.046, is
   * left out of the timing). */
  const PERIOD = 84.02;
  const SOLSTICE_S = 1986.9;
  const uranus = ctx.host;
  const R = worldRadius(uranus);
  const fov = uranus.userData?.focusFov ?? 30;
  const pos0 = uranus.position.clone();
  const hold = holdOrientation(uranus);
  /* The axis as the site points it now (the parent's frame), held there
   * while the event runs; "north" is the map's north, the +y end. */
  const q0 = uranus.quaternion.clone();
  const axisP = new THREE.Vector3(0, 1, 0).applyQuaternion(q0).normalize();
  /* South pole to the Sun when Uranus sits along +axis from the Sun. */
  const lamS = Math.atan2(axisP.z, axisP.x);
  const lam0 = Math.atan2(pos0.z, pos0.x);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const startGap = wrap(lamS - lam0);
  const yearAt = (p) => SOLSTICE_S + PERIOD * span(p, 0.06, 0.94);
  const lamAt = (p) => {
    if (p < 0.06) return lam0 + startGap * easeInOut(span(p, 0, 0.06));
    if (p < 0.94) return lamS + (TAU * (yearAt(p) - SOLSTICE_S)) / PERIOD;
    return lamS + TAU - startGap * easeInOut(span(p, 0.94, 1));
  };
  const sunFrom = (pos) => pos.clone().negate().normalize();
  const up = new THREE.Vector3(0, 1, 0);
  /* The camera off to the side of the Sun line (about 70° round from it)
   * and a little above the orbit's plane, so the day and night halves both
   * show -- and which pole is in sunlight. */
  const viewFor = (s) => {
    const sideways = new THREE.Vector3().crossVectors(up, s).normalize();
    return s.clone().multiplyScalar(0.36).addScaledVector(sideways, 0.86).addScaledVector(up, 0.36).normalize();
  };
  const dist = distanceFor(R * 1.6, 0.42, fov);
  const v0 = viewFor(sunFrom(uranus.getWorldPosition(new THREE.Vector3())));
  const shot = holdShot(ctx, "Uranus", uranus, { yaw: yawFor(v0), pitch: pitchFor(v0), distance: dist });

  /* Pole markers and the axis, in the stage frame (1 = Uranus's radius). */
  const axisW = axisP.clone().applyQuaternion(uranus.parent.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const axisLine = ctx.line([axisW.clone().multiplyScalar(-1.5), axisW.clone().multiplyScalar(1.5)], { colour: "#ffd27f", opacity: 1, additive: false });
  axisLine.renderOrder = 32;
  const nDot = ctx.glow("#ff8a6b", 0.22, { opacity: 1 });
  nDot.position.copy(axisW).multiplyScalar(1.5);
  const sDot = ctx.glow("#7fc4ff", 0.22, { opacity: 1 });
  sDot.position.copy(axisW).multiplyScalar(-1.5);
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const nLabel = H.label(["North pole"], { height: 0.034, colour: "#ffb8a0", declutter: false });
  const sLabel = H.label(["South pole"], { height: 0.034, colour: "#9fd0ff", declutter: false });
  const sunArrow = H.line([[0, 0, 0], [0.01, 0, 0]], { colour: "#ffd27f", opacity: 0.9, additive: false });
  const sunLabel = H.label(["Sunlight"], { height: 0.034, colour: "#ffe2a8", declutter: false });
  const year = H.label([""], { at: [-0.62, 0.62, 0], height: 0.07, declutter: false });
  const status = H.label(["", ""], { at: [-1.0, -0.62, 0], height: 0.05, declutter: false });
  /* Inset, left: the orbit from above with the four turning points. */
  const inset = new THREE.Group();
  inset.position.set(-1.0, 0.08, 0);
  hud.add(inset);
  const IK = hudKit(ctx, inset);
  const RO = 0.24;
  IK.sun(0.025, { halo: 4 });
  IK.circle(RO, { plane: "xy", colour: "#9fd6dc", opacity: 0.55 });
  const miniDot = IK.glow("#bfe9ff", 0.06, { opacity: 1 });
  /* The inset is the orbit seen from the north: angle lam on screen as
   * (cos lam, sin lam) with x to the right -- turned so the 1986 point is
   * at the bottom. */
  const insetAt = (lam, k = 1) => {
    const a = lam - lamS - Math.PI / 2;
    return [Math.cos(a) * RO * k, Math.sin(a) * RO * k, 0];
  };
  const miniAxis = IK.line([[0, 0, 0], [0.01, 0, 0]], { colour: "#ffd27f", opacity: 1, additive: false });
  const marks = [
    [0, ["~1986", "south pole sunlit"]],
    [Math.PI / 2, ["2007", "equinox"]],
    [Math.PI, ["~2028", "north pole sunlit"]],
    [Math.PI * 1.5, ["~2049", "equinox"]],
  ].map(([da, words]) => {
    const at = insetAt(lamS + da, 1.62);
    return IK.label(words, { at, height: 0.034, declutter: false });
  });
  [nLabel, sLabel, sunArrow, sunLabel, year, status].forEach((o) => ctx.fade(o, 0));
  ctx.fade(inset, 0);

  ctx.tell([
    { at: 0, label: "On its side", text: "The real Uranus, tipped 97.8°, carried round its 84-year orbit. Its axis keeps pointing the same way in space." },
    { at: 0.08, label: "Southern summer", text: "Around 1986 the south pole points almost straight at the Sun — as Voyager 2 saw it. The north is in a night that lasts decades." },
    { at: 0.3, label: "Equinox, 2007", text: "The Sun crosses the equator: for a few years, all of Uranus gets day and night." },
    { at: 0.52, label: "Northern summer", text: "Around 2028 the north pole faces the Sun, and the south has its long night." },
    { at: 0.76, label: "42 and 42", text: "Each pole gets about 42 years of sunlight, then about 42 years of darkness." },
  ]);
  const qs = new THREE.Quaternion();
  const qOrbit = new THREE.Quaternion();
  const after = uranus.getWorldPosition(new THREE.Vector3());
  const s = sunFrom(after);
  const axisNow = new THREE.Vector3();
  const pts = [new THREE.Vector3(), new THREE.Vector3()];
  return {
    duration: 24,
    update(p) {
      /*
       * Round 86: Uranus stays where it is and the light comes round it, as
       * seen by a camera travelling with Uranus and keeping the Sun behind
       * it. Going round the orbit by d (longitude, seen from the north) is,
       * relative to the Sun, the same as turning Uranus's fixed axis by -d
       * about the orbit's pole -- so the axis is turned that way here. (The
       * first build moved the real Uranus along its orbit and carried the
       * camera; main.js only follows a body moved after the camera is aimed
       * one step late, and a long frame lost it.) The inset shows the orbit
       * as it really is, the axis fixed.
       */
      const d = lamAt(p) - lam0;
      /* A turn by +d about +y moves an angle atan2(z, x) by -d: it takes
       * Uranus-at-(lam0 + d) back to lam0, axis and all. */
      qOrbit.setFromAxisAngle(up, d);
      uranus.quaternion.copy(qOrbit).multiply(qs.setFromAxisAngle(axisP, ctx.t * 0.9)).multiply(q0);
      shot.keep();
      axisNow.copy(axisW).applyQuaternion(qOrbit);
      pts[0].copy(axisNow).multiplyScalar(-1.5);
      pts[1].copy(axisNow).multiplyScalar(1.5);
      ctx.setLine(axisLine, pts);
      nDot.position.copy(axisNow).multiplyScalar(1.5);
      sDot.position.copy(axisNow).multiplyScalar(-1.5);
      ctx.fade(axisLine, smooth(p, 0.0, 0.05));
      /* Labels. */
      const lit = axisNow.dot(s);
      const y = p < 0.06 ? SOLSTICE_S : p > 0.94 ? SOLSTICE_S + PERIOD : yearAt(p);
      year.userData.draw([`${Math.floor(y)}`]);
      ctx.fade(year, smooth(p, 0.02, 0.06));
      status.userData.draw(Math.abs(lit) < 0.25 ? ["Near equinox", "day and night all over the planet"]
        : lit > 0 ? ["North pole: daylight", "the south pole is in a 42-year night"]
          : ["South pole: daylight", "the north pole is in a 42-year night"]);
      ctx.fade(status, smooth(p, 0.04, 0.1));
      pin(ctx, nLabel, nDot.getWorldPosition(new THREE.Vector3()), 0, 0.06);
      pin(ctx, sLabel, sDot.getWorldPosition(new THREE.Vector3()), 0, 0.06);
      ctx.fade(nLabel, smooth(p, 0.02, 0.06));
      ctx.fade(sLabel, smooth(p, 0.02, 0.06));
      /* An arrow from the Sun's side, toward Uranus. */
      const hc = toHud(ctx, after);
      const hs = toHud(ctx, after.clone().addScaledVector(s, R * 4));
      const dir2 = hs.clone().sub(hc);
      if (dir2.lengthSq() > 1e-8) dir2.normalize();
      const a0 = hc.clone().addScaledVector(dir2, 0.62);
      const a1 = hc.clone().addScaledVector(dir2, 0.42);
      H.setLine(sunArrow, [a0, a1]);
      sunLabel.position.copy(hc.clone().addScaledVector(dir2, 0.72));
      ctx.fade(sunArrow, smooth(p, 0.04, 0.1) * (dir2.lengthSq() > 0 ? 1 : 0));
      ctx.fade(sunLabel, smooth(p, 0.04, 0.1));
      /* Inset. */
      ctx.fade(inset, smooth(p, 0.04, 0.1));
      const mp = insetAt(lamAt(p));
      miniDot.position.set(mp[0], mp[1], 0);
      const ax = insetAt(lamS, 0.07);
      const axr = new THREE.Vector3(ax[0], ax[1], 0);
      /* The axis seen from the north points along +axis's horizontal part,
       * the direction of lamS. */
      H.setLine(miniAxis, [[mp[0] - axr.x, mp[1] - axr.y, 0], [mp[0] + axr.x, mp[1] + axr.y, 0]]);
      marks.forEach((m, i) => {
        const near = Math.abs(wrap(lamAt(p) - (lamS + (i * Math.PI) / 2)));
        ctx.fade(m, 0.45 + 0.55 * (1 - smooth(near, 0.25, 0.9)));
      });
    },
    dispose() {
      hold.restore();
    },
  };
}

/* ------------------------------------------------------------ Neptune */

/* The camera's right and up, in the world, for a shot's yaw and pitch. */
function shotAxes(yaw, pitch) {
  const back = shotDirection(yaw, pitch);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right).normalize();
  return { back, right, up };
}
/* A direction in a body's own frame at latitude lat, turned `east`
 * radians east of the meridian that faces the camera. */
function facingDir(body, back, latDeg, east = 0) {
  const qi = body.getWorldQuaternion(new THREE.Quaternion()).invert();
  const c = back.clone().applyQuaternion(qi);
  const lon = Math.atan2(c.x, c.z) + east;
  const lat = latDeg * DEG;
  return new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
}

/*
 * Neptune's Great Dark Spot on the real Neptune: the storm Voyager 2 found
 * in 1989, at its measured size and latitude, with its bright companion
 * clouds; Earth beside it to the same scale; gone when Hubble looked in
 * 1994, and a new spot in the north.
 */
function neptuneDarkSpotScene(ctx) {
  /* GDS about 13,000 × 6,600 km at ~22° S (Smith et al. 1989; Sromovsky et
   * al. 1993); the northern spot of 1994 at ~32° N (Hammel et al. 1995),
   * its size drawn a little smaller. Earth 6,371 km, Neptune 24,622 km. */
  const neptune = ctx.host;
  const R = worldRadius(neptune);
  const RL = bodyRadius(neptune);
  const P = neptune.getWorldPosition(new THREE.Vector3());
  const sunDir = P.clone().negate().normalize();
  const fov = neptune.userData?.focusFov ?? 30;
  const hold = holdOrientation(neptune);
  const view = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3).normalize();
  const yaw = yawFor(view);
  const pitch = pitchFor(view) - 0.22;
  const SHARE = 0.36;
  const shot = holdShot(ctx, "Neptune", neptune, { yaw, pitch, distance: distanceFor(R, SHARE, fov) });
  const { back, right, up } = shotAxes(shot.yaw, shot.pitch);
  const LAT_G = -22;
  const rxG = 6500 / (R_NEPTUNE * Math.cos(LAT_G * DEG));
  const ryG = 3300 / R_NEPTUNE;
  const gds = facingDir(neptune, back, LAT_G, -0.12);
  const companion = facingDir(neptune, back, LAT_G - 7.5, -0.12 + rxG * 0.35);
  const north = facingDir(neptune, back, 32, 0.32);
  const spots = spotShell(ctx, neptune, RL * 1.032, [
    { dir: gds, rx: rxG, ry: ryG, colour: "#0b1446", alpha: 0 },
    { dir: companion, rx: rxG * 0.55, ry: ryG * 0.2, colour: "#eef6ff", alpha: 0 },
    { dir: north, rx: rxG * 0.72, ry: ryG * 0.72, colour: "#0d1850", alpha: 0 },
    { dir: north.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.05).add(new THREE.Vector3(0, 0.06, 0)), rx: rxG * 0.4, ry: ryG * 0.16, colour: "#eef6ff", alpha: 0 },
  ]);
  /* Earth, to the same scale, left of Neptune at the spot's height. */
  const q0 = neptune.quaternion.clone();
  const gdsWorld = gds.clone().applyQuaternion(neptune.getWorldQuaternion(new THREE.Quaternion()));
  const earth = ctx.ball(R_EARTH / R_NEPTUNE, { body: "Earth", rim: 0.4, rimColour: "#7fb8ff" });
  earth.position.copy(right).multiplyScalar(-1.55).addScaledVector(up, gdsWorld.dot(up));
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const spotLabel = H.label(["Great Dark Spot", "about 13,000 × 6,600 km"], { align: "right", height: 0.05, colour: "#cfe0ff", declutter: false });
  const lead = H.line([[0, 0, 0], [0.01, 0, 0]], { colour: "#bfd4ff", opacity: 0.8, additive: false });
  const earthLabel = H.label(["Earth", "to the same scale"], { height: 0.046, colour: "#9fd0ff", declutter: false });
  const northLabel = H.label(["A new dark spot", "in the north, 1994"], { align: "right", height: 0.05, colour: "#cfe0ff", declutter: false });
  const northLead = H.line([[0, 0, 0], [0.01, 0, 0]], { colour: "#bfd4ff", opacity: 0.8, additive: false });
  const year = H.label(["", ""], { at: [-0.7, 0.62, 0], height: 0.06, declutter: false });
  [spotLabel, lead, earthLabel, northLabel, northLead, year, earth].forEach((o) => ctx.fade(o, 0));

  ctx.tell([
    { at: 0, label: "August 1989", text: "Voyager 2 flies past the real Neptune and finds a dark storm in the south: the Great Dark Spot." },
    { at: 0.24, label: "As big as Earth", text: "About 13,000 km long and 6,600 km wide. Earth, beside it to the same scale, is about as wide." },
    { at: 0.5, label: "1994", text: "Hubble looks again. The Great Dark Spot is gone." },
    { at: 0.74, label: "Come and go", text: "Instead a new dark spot has formed in the north. Neptune's storms form and fade within a few years." },
  ]);
  const qTurn = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  const w = new THREE.Vector3();
  const leadTo = (label, line, dir, dx, dy) => {
    w.copy(dir).multiplyScalar(RL * 1.03).applyQuaternion(neptune.quaternion).add(neptune.position);
    neptune.parent.localToWorld(w);
    const h = toHud(ctx, w);
    label.position.set(h.x + dx, h.y + dy, 0);
    H.setLine(line, [[h.x + dx + 0.02, h.y + dy - 0.02, 0], [h.x, h.y, 0]]);
  };
  return {
    duration: 24,
    update(p) {
      shot.keep();
      /* Neptune held, turning only a little (its spin, slowed right down). */
      neptune.quaternion.copy(q0).multiply(qTurn.setFromAxisAngle(Y, lerp(-0.08, 0.12, p)));
      const spotA = smooth(p, 0.02, 0.08) * (1 - smooth(p, 0.52, 0.64));
      spots.alpha(0, 0.92 * spotA);
      spots.alpha(1, 0.8 * spotA);
      const nA = smooth(p, 0.74, 0.84);
      spots.alpha(2, 0.88 * nA);
      spots.alpha(3, 0.7 * nA);
      leadTo(spotLabel, lead, gds, -0.5, 0.3);
      ctx.fade(spotLabel, smooth(p, 0.06, 0.12) * (1 - smooth(p, 0.5, 0.56)));
      ctx.fade(lead, smooth(p, 0.06, 0.12) * (1 - smooth(p, 0.5, 0.56)));
      leadTo(northLabel, northLead, north, -0.5, 0.28);
      ctx.fade(northLabel, smooth(p, 0.78, 0.86));
      ctx.fade(northLead, smooth(p, 0.78, 0.86));
      const eA = smooth(p, 0.24, 0.3) * (1 - smooth(p, 0.5, 0.56));
      ctx.fade(earth, eA);
      earth.rotation.y = ctx.t * 0.2;
      earth.getWorldPosition(w);
      pin(ctx, earthLabel, w, 0, -0.16);
      ctx.fade(earthLabel, eA);
      const y = p < 0.5 ? 1989 : Math.round(lerp(1989, 1994, smooth(p, 0.5, 0.6)));
      year.userData.draw([`${y}`, y < 1994 ? "Voyager 2" : "Hubble Space Telescope"]);
      ctx.fade(year, smooth(p, 0.0, 0.05));
    },
    dispose() { hold.restore(); },
  };
}

/*
 * The fastest winds: the real Neptune, held still so only its clouds move
 * -- streaks racing west at the equator and east near the poles, at
 * speeds that follow Voyager 2's wind profile -- with the bars beside it.
 */
function neptuneWindsScene(ctx) {
  const neptune = ctx.host;
  const R = worldRadius(neptune);
  const RL = bodyRadius(neptune);
  const P = neptune.getWorldPosition(new THREE.Vector3());
  const sunDir = P.clone().negate().normalize();
  const fov = neptune.userData?.focusFov ?? 30;
  const hold = holdOrientation(neptune);
  const q0 = neptune.quaternion.clone();
  const view = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.32).normalize();
  const SHARE = 0.34;
  const shot = holdShot(ctx, "Neptune", neptune, { yaw: yawFor(view), pitch: pitchFor(view) + 0.1, distance: distanceFor(R, SHARE, fov) });
  const { back } = shotAxes(shot.yaw, shot.pitch);
  /* Wind profile, m/s, eastward positive, latitude in degrees: the Voyager
   * fit u = -398 + 0.188 φ² - 1.2e-5 φ⁴ (Sromovsky et al. 1993). */
  const wind = (lat) => -398 + 0.188 * lat * lat - 1.2e-5 * lat ** 4;
  const r = rng(41);
  const front = facingDir(neptune, back, 0, 0);
  const lon0 = Math.atan2(front.x, front.z);
  const lats = [-68, -58, -46, -34, -22, -10, 2, 14, 26, 38, 50, 62, 72];
  const TRAIL = 8;
  const clouds = [];
  lats.forEach((lat) => {
    for (let i = 0; i < 10; i += 1) clouds.push({ lat: lat + (r() - 0.5) * 6, lon: r() * TAU, len: 0.05 + r() * 0.08, a: 0.45 + r() * 0.5 });
  });
  const group = new THREE.Group();
  ctx.attach(neptune, group);
  const streaks = ctx.cloud(clouds.length * TRAIL, { size: 3, parent: group });
  for (let i = 0; i < clouds.length * TRAIL; i += 1) streaks.tint(i, "#eef6ff");
  /* Arrows on the face toward us: west along the equator, east at 60° N
   * and S. In Neptune's own frame. */
  const along = (lat, dLon, k = 1.06) => {
    const la = lat * DEG;
    const lo = lon0 + dLon;
    return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).multiplyScalar(RL * k);
  };
  const eq = ctx.arrow(along(0, 0.32), along(0, -0.32), { colour: "#ffd27f", head: RL * 0.14, parent: group });
  const nA = ctx.arrow(along(58, -0.38), along(58, 0.38), { colour: "#9fe0ff", head: RL * 0.12, parent: group });
  const sA = ctx.arrow(along(-58, -0.38), along(-58, 0.38), { colour: "#9fe0ff", head: RL * 0.12, parent: group });
  /* Bars, km/h: Neptune ~2,000 (NASA); sound in air at 20 °C 1,235
   * (343 m/s); Earth's record gust 408 (WMO, Barrow Island 1996). On the
   * hud, left of Neptune; the longest 0.9 wide. */
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const K = 0.9 / 2000;
  const X0 = -1.5;
  const bar = (kmh, y, colour, lines) => {
    const h = 0.03;
    const mesh = H.shape([[0, -h], [1, -h], [1, h], [0, h]], { colour, opacity: 0.92 });
    mesh.position.set(X0, y, 0);
    const label = H.label(lines, { at: [X0, y + 0.1, 0], align: "left", height: 0.05, declutter: false });
    return { mesh, label, kmh };
  };
  const bars = [
    bar(2000, 0.5, "#6f9bff", ["Neptune's winds", "about 2,000 km/h"]),
    bar(1235, 0.22, "#c9d3e0", ["Speed of sound in air", "1,235 km/h"]),
    bar(408, -0.06, "#ffd27f", ["Earth's strongest gust", "408 km/h"]),
  ];
  const sunLabel = H.label(["Sunlight here: about 1/900", "of what Earth gets"], { at: [-1.05, -0.38, 0], height: 0.05, colour: "#ffe2a8", declutter: false });
  const heatLabel = H.label(["Yet it gives off 2.6× the energy", "it absorbs from the Sun"], { at: [-1.05, -0.62, 0], height: 0.05, colour: "#ffc0a0", declutter: false });
  const windLabel = H.label(["west at the equator", "east near the poles"], { height: 0.044, colour: "#ffe2a8", declutter: false });
  [eq, nA, sA, sunLabel, heatLabel, windLabel].forEach((o) => ctx.fade(o, 0));
  bars.forEach((b) => { ctx.fade(b.mesh, 0); ctx.fade(b.label, 0); });

  ctx.tell([
    { at: 0, label: "Neptune", text: "The real Neptune, held still so only its clouds move: they race around it — west at the equator, east near the poles." },
    { at: 0.18, label: "2,000 km/h", text: "Its winds reach about 2,000 km/h: faster than sound in Earth's air, five times Earth's strongest gust." },
    { at: 0.5, label: "Little sunlight", text: "At 30 times Earth's distance from the Sun, Neptune gets only about 1/900 as much sunlight." },
    { at: 0.72, label: "A puzzle", text: "It radiates 2.6 times the energy it absorbs, heat left over from its birth. How that drives such winds is still debated." },
  ]);
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  return {
    duration: 24,
    update(p) {
      shot.keep();
      hold.put(q0);
      /* Clouds: angular speed ∝ wind / cos(latitude), slowed enormously. */
      const t = ctx.t;
      clouds.forEach((c, i) => {
        const om = wind(c.lat) / Math.max(0.25, Math.cos(c.lat * DEG));
        const drift = (om / 400) * 0.16 * t;
        for (let k = 0; k < TRAIL; k += 1) {
          const lon = c.lon + drift - Math.sign(om) * (k / TRAIL) * c.len * 2.4;
          v.set(Math.cos(c.lat * DEG) * Math.sin(lon), Math.sin(c.lat * DEG), Math.cos(c.lat * DEG) * Math.cos(lon)).multiplyScalar(RL * 1.035);
          const j = i * TRAIL + k;
          streaks.set(j, v.x, v.y, v.z);
          streaks.alpha[j] = c.a * (1 - k / TRAIL) * smooth(p, 0, 0.05);
        }
      });
      streaks.commit();
      const arrowsA = smooth(p, 0.06, 0.14);
      [eq, nA, sA].forEach((a) => ctx.fade(a, arrowsA));
      w.copy(along(0, 0, 1.06)).applyQuaternion(neptune.quaternion).add(neptune.position);
      neptune.parent.localToWorld(w);
      pin(ctx, windLabel, w, 0, -0.5);
      ctx.fade(windLabel, arrowsA * (1 - smooth(p, 0.46, 0.5)));
      bars.forEach((b, i) => {
        const grow = easeInOut(span(p, 0.18 + i * 0.06, 0.32 + i * 0.06));
        b.mesh.scale.x = Math.max(0.0001, b.kmh * K * grow);
        ctx.fade(b.mesh, grow > 0.001 ? 1 : 0);
        ctx.fade(b.label, smooth(grow, 0.3, 0.9));
      });
      ctx.fade(sunLabel, smooth(p, 0.5, 0.56));
      ctx.fade(heatLabel, smooth(p, 0.72, 0.78));
    },
    dispose() { hold.restore(); },
  };
}

/*
 * Triton's doomed orbit: the real Triton put on its real orbit round the
 * real Neptune -- 14.4 Neptune radii out, tilted 23° and going backwards
 * against Neptune's spin -- then captured from an eccentric orbit, then
 * sinking inward over billions of years to the Roche limit, where it is
 * torn apart into a ring.
 */
function tritonDoomScene(ctx) {
  /* Triton a = 354,759 km = 14.41 Neptune radii; inclination 157° to
   * Neptune's equator (retrograde, 23° off) (JPL). Roche limit for a fluid
   * Triton: 2.44 R_N (rho_N / rho_T)^(1/3), densities 1.638 and 2.061 g/cm³
   * (NASA) -> 2.26 Neptune radii. Tidal decay a(t)/a0 = (1 - t/T)^(2/13)
   * (da/dt ∝ a^(-11/2)); T ≈ 3.6 billion years to the Roche limit (Chyba
   * et al. 1989). */
  const A0 = 354759 / R_NEPTUNE;
  const ROCHE = 2.44 * Math.cbrt(1.638 / 2.061);
  const neptune = ctx.host;
  const R = worldRadius(neptune);
  const P = neptune.getWorldPosition(new THREE.Vector3());
  const sunDir = P.clone().negate().normalize();
  const fov = neptune.userData?.focusFov ?? 30;
  const triton = ctx.findBody("Triton");
  const tritonPos0 = triton?.position.clone();
  /* Neptune's axis and the orbit's frame (world). Prograde about N is
   * angle increasing with e2 = N x e1; Triton goes the other way. */
  const N = new THREE.Vector3(0, 1, 0).applyQuaternion(neptune.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const e1 = new THREE.Vector3().crossVectors(N, sunDir).normalize();
  const e2 = new THREE.Vector3().crossVectors(N, e1).normalize();
  const e2t = e2.clone().applyAxisAngle(e1, 23 * DEG);
  const nOrbit = new THREE.Vector3().crossVectors(e1, e2t).normalize();
  /* From above the orbit on the Sun's side, so Neptune is lit. */
  const view = nOrbit.clone().multiplyScalar(0.62).addScaledVector(sunDir, 0.78).normalize();
  const farD = distanceFor(R * A0 * 1.12, 0.86, fov);
  const nearD = distanceFor(R * ROCHE * 1.6, 0.86, fov);
  const shot = holdShot(ctx, "Neptune", neptune, { yaw: yawFor(view), pitch: pitchFor(view), distance: farD });
  /* Drawn in the stage's frame (1 = Neptune's radius): the orbit plane. */
  const plane = new THREE.Group();
  const basis = new THREE.Matrix4().makeBasis(e1, nOrbit, e2t);
  plane.quaternion.setFromRotationMatrix(basis);
  ctx.add(plane);
  const orbitLine = ctx.circle(A0, { plane: "xz", colour: "#d8c4bb", opacity: 0.6, segments: 256, parent: plane });
  const roche = ctx.circle(ROCHE, { plane: "xz", colour: "#ff8a6b", opacity: 0.85, dashed: true, dash: 0.12, gap: 0.09, parent: plane });
  const ghost = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.7, dashed: true, dash: 0.4, gap: 0.3, parent: plane });
  const spiral = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.8, parent: plane });
  /* Neptune's spin: an arc round its axis with the head going prograde. */
  const spinG = new THREE.Group();
  spinG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), N);
  ctx.add(spinG);
  const spinR = 1.7;
  const spinArc = ctx.circle(spinR, { plane: "xz", from: 0, to: TAU * 0.75, colour: "#9fe0ff", opacity: 0.95, parent: spinG });
  /* In spinG's frame, prograde about +y runs from +x toward -z (angle
   * a: (cos a, 0, -sin a)), the opposite of the kit circle's direction --
   * so the head sits at the arc's start and points backwards along it. */
  const sHead = new THREE.Vector3(spinR, 0, 0);
  const spinHead = ctx.arrow(sHead.clone().add(new THREE.Vector3(0, 0, 0.35)), sHead.clone().add(new THREE.Vector3(0, 0, -0.35)), { colour: "#9fe0ff", head: 0.4, parent: spinG });
  /* The breakup: a ring of pieces in the orbit plane. */
  const NR = 900;
  const rr = rng(61);
  const ring = ctx.cloud(NR, { size: 2.4, parent: plane });
  const ringData = Array.from({ length: NR }, () => ({ a: rr(), d: ROCHE * (0.82 + rr() * 0.5), y: (rr() - 0.5) * 0.03 }));
  ringData.forEach((_, i) => ring.tint(i, i % 4 ? "#e2d2c8" : "#ffffff"));
  const trail = ctx.cloud(40, { size: 3, parent: plane });
  for (let i = 0; i < 40; i += 1) trail.tint(i, "#ffd2b0");

  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const finder = H.circle(0.04, { plane: "xy", colour: "#ffd2b0", opacity: 1, additive: false });
  /* (A one-line label's height is the whole line; two-line labels share
   * theirs, hence the different sizes.) */
  const tLabel = H.label(["Triton", "orbiting the other way"], { height: 0.048, colour: "#ffd2b0", declutter: false });
  const spinLabel = H.label(["Neptune spins this way"], { height: 0.03, colour: "#bfefff", declutter: false });
  const capture = H.label(["Captured from the Kuiper Belt", "its orbit later made round by tides"], { at: [-1.0, 0.3, 0], height: 0.05, colour: "#ffe2a8", declutter: false });
  const rocheLabel = H.label(["Roche limit", "tides pull a moon apart inside it"], { align: "right", height: 0.044, colour: "#ffb8a0", declutter: false });
  const clock = H.label(["", ""], { at: [-0.75, 0.62, 0], height: 0.056, declutter: false });
  [finder, tLabel, spinLabel, capture, rocheLabel, clock].forEach((o) => ctx.fade(o, 0));
  [orbitLine, roche, ghost, spiral, spinArc, spinHead].forEach((o) => ctx.fade(o, 0));

  ctx.tell([
    { at: 0, label: "Backwards", text: "The real Neptune spins one way; the real Triton, its largest moon, orbits the other way — the only big moon in the Solar System to do so." },
    { at: 0.24, label: "Captured", text: "So it probably did not form here. It was most likely a Kuiper Belt world, captured long ago." },
    { at: 0.46, label: "Spiralling in", text: "Orbiting against the spin, Triton loses energy to Neptune's tides and sinks inward — slowly at first, then faster." },
    { at: 0.8, label: "Torn apart", text: "In about 3.6 billion years it crosses the Roche limit, and Neptune's tides pull it apart — perhaps into a ring." },
  ]);
  const end = 1 - Math.pow(ROCHE / A0, 6.5);
  const aOf = (u) => A0 * Math.pow(Math.max(1e-9, 1 - u * end), 2 / 13);
  /* Orbit angle: backwards, 1.6 turns while it circles, then on round the
   * spiral (a picture of its winding, not its true count). */
  const angleOf = (p) => (p < 0.46 ? -TAU * 1.6 * (p / 0.46) : -TAU * 1.6 - TAU * 7 * (span(p, 0.46, 0.82) ** 1.4));
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const atPlane = (a, rad) => local.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
  const past = [];
  return {
    duration: 24,
    update(p) {
      const close = easeInOut(span(p, 0.5, 0.8));
      shot.keep(lerp(farD, nearD, close));
      const u = span(p, 0.46, 0.82);
      const a = p < 0.46 ? A0 : aOf(u);
      const ang = angleOf(Math.min(p, 0.82));
      atPlane(ang, a);
      world.copy(local).applyQuaternion(plane.quaternion).multiplyScalar(ctx.unit).add(neptune.getWorldPosition(new THREE.Vector3()));
      const broken = p > 0.82;
      if (triton) {
        triton.parent.updateWorldMatrix(true, false);
        triton.position.copy(triton.parent.worldToLocal(world.clone()));
        triton.visible = !broken;
      }
      /* Its recent path, a short fading trail. */
      past.unshift(local.clone());
      if (past.length > 40) past.pop();
      past.forEach((v, i) => { trail.set(i, v.x, v.y, v.z); trail.alpha[i] = broken ? 0 : 0.8 * (1 - i / 40); });
      trail.commit();
      const h = toHud(ctx, world);
      finder.position.set(h.x, h.y, 0);
      tLabel.position.set(h.x, h.y + 0.09, 0);
      tLabel.userData.draw(p < 0.46 ? ["Triton", "orbiting the other way"] : ["Triton", ""]);
      ctx.fade(finder, broken ? 0 : smooth(p, 0.0, 0.04));
      ctx.fade(tLabel, broken ? 0 : smooth(p, 0.0, 0.04));
      /* Spin and direction. */
      ctx.fade(spinArc, win(p, 0.02, 0.46, 0.04));
      ctx.fade(spinHead, win(p, 0.02, 0.46, 0.04));
      pin(ctx, spinLabel, neptune.getWorldPosition(new THREE.Vector3()), 0, 0.2);
      ctx.fade(spinLabel, win(p, 0.04, 0.44, 0.04));
      ctx.fade(orbitLine, smooth(p, 0.0, 0.05) * (1 - 0.6 * smooth(p, 0.46, 0.6)));
      /* Capture: an eccentric orbit relaxing to the circle. */
      const capt = span(p, 0.24, 0.42);
      const e = 0.75 * (1 - easeInOut(capt));
      const aG = A0 * (1 + e * 0.6);
      ctx.setLine(ghost, Array.from({ length: 200 }, (_, i) => {
        const nu = (i / 199) * TAU;
        const rg = (aG * (1 - e * e)) / (1 + e * Math.cos(nu));
        return [rg * Math.cos(nu + 2.4), 0, rg * Math.sin(nu + 2.4)];
      }));
      ctx.fade(ghost, win(p, 0.24, 0.46, 0.03));
      ctx.fade(capture, win(p, 0.25, 0.46, 0.03));
      /* The spiral so far -- its last stretch only, so the wide early turns
       * do not sweep across the close view. */
      if (u > 0) {
        const pts = [];
        const u0 = Math.max(0, u - 0.3);
        for (let i = 0; i <= 260; i += 1) {
          const uu = lerp(u0, u, i / 260);
          const pp = lerp(0.46, 0.82, uu);
          const ai = angleOf(pp);
          const ri = aOf(uu);
          pts.push([Math.cos(ai) * ri, 0, Math.sin(ai) * ri]);
        }
        ctx.setLine(spiral, pts);
      }
      ctx.fade(spiral, smooth(p, 0.47, 0.5) * (1 - smooth(p, 0.9, 0.97)));
      ctx.fade(roche, smooth(p, 0.5, 0.56));
      /* Beside the Roche circle's leftmost point on the screen. */
      let hr = null;
      for (let k = 0; k < 16; k += 1) {
        const a = (k / 16) * TAU;
        const hk = toHud(ctx, plane.localToWorld(new THREE.Vector3(Math.cos(a) * ROCHE, 0, Math.sin(a) * ROCHE)));
        if (!hr || hk.x < hr.x) hr = hk;
      }
      rocheLabel.position.set(hr.x - 0.05, hr.y, 0);
      ctx.fade(rocheLabel, smooth(p, 0.52, 0.58) * (1 - smooth(p, 0.86, 0.9)));
      /* The breakup into a ring. */
      const spread = easeInOut(span(p, 0.82, 0.98));
      const startA = angleOf(0.82);
      for (let i = 0; i < NR; i += 1) {
        const d = ringData[i];
        const ai = startA - d.a * TAU * spread * 0.98 - ctx.t * 0.25;
        const rd = lerp(ROCHE, d.d, spread);
        ring.set(i, Math.cos(ai) * rd, d.y, Math.sin(ai) * rd);
        ring.alpha[i] = broken ? 0.8 : 0;
      }
      ring.commit();
      const gyr = 3.6 * u;
      clock.userData.draw(p < 0.46 ? ["Today", `Triton ${fmt(354759)} km out`]
        : [`+${gyr.toFixed(2)} billion years`, p < 0.82 ? `Triton ${fmt(a * R_NEPTUNE)} km out` : "torn apart by tides"]);
      ctx.fade(clock, smooth(p, 0.0, 0.05));
    },
    dispose() {
      if (triton) {
        triton.visible = true;
        if (tritonPos0) triton.position.copy(tritonPos0);
      }
    },
  };
}

/* ------------------------------------------------------------ Pluto and Charon */

/*
 * Charon's red cap: the real Charon, its north pole toward us, with the
 * real Pluto beyond it. Its map already shows the cap (Mordor Macula,
 * New Horizons 2015); the event shows how it is made -- methane leaking from
 * Pluto, caught on Charon's winter pole, frozen as frost in the century-long
 * night, and reddened when sunlight returns, fading into the real cap.
 */
function charonRedCapScene(ctx) {
  /* Charon radius 606 km; the red region reaches down to about 45° N on
   * the site's map (charon-albedo-v1.jpg): a cap 45° across from the pole.
   * Pole colder than about -250 °C in the polar night (Grundy et al. 2016). */
  const charon = ctx.host;
  const RL = bodyRadius(charon);
  const Rc = worldRadius(charon);
  const C = charon.getWorldPosition(new THREE.Vector3());
  const pluto = ctx.findBody("Pluto");
  const Pw = pluto ? pluto.getWorldPosition(new THREE.Vector3()) : C.clone().add(new THREE.Vector3(-1, 0.3, 0));
  const toPluto = Pw.clone().sub(C).normalize();
  const fov = charon.userData?.focusFov ?? 30;
  const hold = holdOrientation(charon);
  const q0 = charon.quaternion.clone();
  const Nc = new THREE.Vector3(0, 1, 0).applyQuaternion(charon.getWorldQuaternion(new THREE.Quaternion())).normalize();
  /* Above the north pole, on the far side from Pluto and a little to one
   * side, so Pluto shows beyond Charon. */
  const side = new THREE.Vector3().crossVectors(Nc, toPluto).normalize();
  const view = Nc.clone().multiplyScalar(0.62).addScaledVector(toPluto, -0.62).addScaledVector(side, 0.48).normalize();
  const shot = holdShot(ctx, "Charon", charon, { yaw: yawFor(view), pitch: pitchFor(view), distance: distanceFor(Rc, 0.3, fov) });

  /* The frost cap, on a shell just over the real surface. */
  const cap = spotShell(ctx, charon, RL * 1.012, [
    { dir: new THREE.Vector3(0, 1, 0), rx: 0.78, ry: 0.78, colour: "#e8f2ff", alpha: 0 },
  ]);
  const uvGlow = ctx.glow("#b48cff", 0.9, { opacity: 0.35 });
  uvGlow.position.copy(Nc).multiplyScalar(1.15);
  /* Pluto's escaping air, in the stage's frame (1 = Charon's radius). */
  const U = ctx.unit;
  const plutoAt = Pw.clone().sub(C).divideScalar(U);
  const plutoR = pluto ? worldRadius(pluto) / U : 2;
  const haze = ctx.glow("#9fc8ff", plutoR * 3.2, { opacity: 0.3 });
  haze.position.copy(plutoAt);
  const NG = 700;
  const gas = ctx.cloud(NG, { size: 2.4 });
  const gr = rng(83);
  const poleTop = Nc.clone().multiplyScalar(1.05);
  const flows = Array.from({ length: NG }, (_, i) => {
    const caught = i % 3 === 0;
    const d = new THREE.Vector3(gr() - 0.5, gr() - 0.5, gr() - 0.5).normalize();
    const start = plutoAt.clone().addScaledVector(d, plutoR * 1.05);
    const end = caught
      ? poleTop.clone().add(new THREE.Vector3((gr() - 0.5) * 0.7, 0, (gr() - 0.5) * 0.7)).normalize().multiplyScalar(1.04)
      : plutoAt.clone().addScaledVector(d, plutoR * (3 + gr() * 3));
    const ctrl = caught
      ? plutoAt.clone().lerp(poleTop, 0.5).addScaledVector(Nc, 1.6 + gr() * 0.8)
      : plutoAt.clone().addScaledVector(d, plutoR * 2);
    return { start, ctrl, end, phase: gr(), caught };
  });
  flows.forEach((f, i) => gas.tint(i, f.caught ? "#d6ecff" : "#9fc8ff"));

  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const plutoLabel = H.label(["Pluto", "its air leaks away"], { height: 0.046, colour: "#cfe0ff", declutter: false });
  const charonLabel = H.label(["Charon's north pole"], { height: 0.03, declutter: false });
  /* Top left, clear of Pluto (which shows large beyond Charon: it is
   * twice Charon's size). */
  const season = H.label(["", ""], { at: [-1.1, 0.62, 0], height: 0.052, declutter: false });
  const capLabel = H.label(["", ""], { at: [-1.1, 0.4, 0], height: 0.05, declutter: false });
  [plutoLabel, charonLabel, capLabel, season, uvGlow].forEach((o) => ctx.fade(o, 0));

  ctx.tell([
    { at: 0, label: "A red cap", text: "The real Charon, Pluto's largest moon, with Pluto beyond. Its north pole wears a red-brown cap, Mordor Macula." },
    { at: 0.2, label: "Pluto's escaping air", text: "Pluto's thin atmosphere leaks slowly into space, and Charon, close by, catches a little of the methane." },
    { at: 0.44, label: "Polar night", text: "Charon's poles spend over a century in darkness. Colder than −250 °C, the methane freezes onto the winter pole." },
    { at: 0.68, label: "Sunlight returns", text: "When the Sun comes back, the methane evaporates, and what is left is slowly turned reddish brown — the cap New Horizons saw in 2015." },
  ]);
  const frost = new THREE.Color("#e8f2ff");
  const red = new THREE.Color("#8a4a2c");
  const col = new THREE.Color();
  const tmp = new THREE.Vector3();
  const w = new THREE.Vector3();
  return {
    duration: 24,
    update(p) {
      shot.keep();
      hold.put(q0);
      /* Gas: flowing all the time, each puff on a loop. */
      const flowA = smooth(p, 0.18, 0.24) * (1 - 0.6 * smooth(p, 0.66, 0.74));
      flows.forEach((f, i) => {
        const s = (f.phase + ctx.t * 0.22) % 1;
        const a = 1 - s;
        tmp.set(
          a * a * f.start.x + 2 * a * s * f.ctrl.x + s * s * f.end.x,
          a * a * f.start.y + 2 * a * s * f.ctrl.y + s * s * f.end.y,
          a * a * f.start.z + 2 * a * s * f.ctrl.z + s * s * f.end.z,
        );
        gas.set(i, tmp.x, tmp.y, tmp.z);
        gas.alpha[i] = (f.caught ? 0.85 : 0.5) * Math.sin(Math.PI * s) * flowA;
      });
      gas.commit();
      ctx.fade(haze, 0.3 * smooth(p, 0.16, 0.24));
      /* Frost builds in the polar night; reddens in the sunlight and fades
       * into the real cap underneath. */
      const build = smooth(p, 0.42, 0.62);
      const redden = smooth(p, 0.7, 0.86);
      col.copy(frost).lerp(red, redden);
      cap.set(0, { dir: new THREE.Vector3(0, 1, 0), rx: 0.78, ry: 0.78, colour: `#${col.getHexString()}`, alpha: 0.8 * build * (1 - smooth(p, 0.84, 0.96)) });
      ctx.fade(uvGlow, win(p, 0.5, 0.72, 0.04) * (0.25 + 0.1 * Math.sin(ctx.t * 2.5)));
      if (pluto) {
        pluto.getWorldPosition(w);
        pin(ctx, plutoLabel, w, -0.3, 0.2);
      }
      ctx.fade(plutoLabel, smooth(p, 0.16, 0.22));
      pin(ctx, charonLabel, C.clone().addScaledVector(Nc, Rc * 1.1), 0, 0.08);
      ctx.fade(charonLabel, smooth(p, 0.0, 0.05));
      capLabel.userData.draw(p < 0.42 ? ["Mordor Macula", "the red-brown cap on Charon's north pole"]
        : p < 0.68 ? ["Frost on the winter pole", "methane caught from Pluto, frozen"]
          : p < 0.86 ? ["Reddening in the sunlight", "the heavier compounds stay behind"]
            : ["Season after season", "the cap grows darker"]);
      ctx.fade(capLabel, smooth(p, 0.04, 0.1));
      season.userData.draw(p < 0.44 ? ["Charon", "Pluto's largest moon"] : p < 0.68 ? ["Polar night", "over 100 years of darkness"] : ["Spring", "sunlight returns to the pole"]);
      ctx.fade(season, smooth(p, 0.02, 0.06));
    },
    dispose() { hold.restore(); },
  };
}

/* ------------------------------------------------------------ Arrokoth */

/*
 * Splits the site's own Arrokoth surface into its two lobes: the same
 * geometry, material, colours and size, cut at the neck. Each lobe keeps
 * its own vertices; the other lobe's vertices are pressed into a low dome
 * over the neck, so each lobe is a closed shape. `u` is the long axis (in
 * the mesh's frame, perpendicular to the short spin axis y).
 */
function splitLobes(surface) {
  const geo = surface.geometry;
  const pos = geo.attributes.position;
  const n = pos.count;
  const v = new THREE.Vector3();
  /* The long axis: the direction in x-z with the widest spread. */
  let best = 0;
  let bestSpan = -Infinity;
  for (let k = 0; k < 180; k += 1) {
    const a = (k / 180) * Math.PI;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i += 7) {
      const d = pos.getX(i) * ca + pos.getZ(i) * sa;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    if (hi - lo > bestSpan) { bestSpan = hi - lo; best = a; }
  }
  const u = new THREE.Vector3(Math.cos(best), 0, Math.sin(best));
  /* The neck: the narrowest cross-section in the middle half. */
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i += 1) {
    v.fromBufferAttribute(pos, i);
    const d = v.dot(u);
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  const BINS = 64;
  const widest = new Float32Array(BINS);
  for (let i = 0; i < n; i += 1) {
    v.fromBufferAttribute(pos, i);
    const d = v.dot(u);
    const rho = Math.sqrt(Math.max(0, v.lengthSq() - d * d));
    const b = Math.min(BINS - 1, Math.floor(((d - lo) / (hi - lo)) * BINS));
    widest[b] = Math.max(widest[b], rho);
  }
  let neckBin = Math.floor(BINS / 2);
  for (let b = Math.floor(BINS * 0.25); b < Math.floor(BINS * 0.75); b += 1) if (widest[b] < widest[neckBin]) neckBin = b;
  const neck = lo + ((neckBin + 0.5) / BINS) * (hi - lo);
  const neckR = widest[neckBin];
  /* Each side's widest cross-section, for pressing the other side down. */
  let maxA = 0;
  let maxB = 0;
  let sumA = 0;
  let sumB = 0;
  let cntA = 0;
  let cntB = 0;
  for (let i = 0; i < n; i += 1) {
    v.fromBufferAttribute(pos, i);
    const d = v.dot(u);
    const rho = Math.sqrt(Math.max(0, v.lengthSq() - d * d));
    if (d < neck) { maxA = Math.max(maxA, rho); sumA += d; cntA += 1; } else { maxB = Math.max(maxB, rho); sumB += d; cntB += 1; }
  }
  const make = (keepLow) => {
    const g = geo.clone();
    const p = g.attributes.position;
    const other = keepLow ? maxB : maxA;
    const dome = neckR * 0.45;
    for (let i = 0; i < p.count; i += 1) {
      v.fromBufferAttribute(p, i);
      const d = v.dot(u);
      const beyond = keepLow ? d > neck : d < neck;
      if (!beyond) continue;
      const perp = v.clone().addScaledVector(u, -d);
      const k = neckR / Math.max(other, 1e-6);
      perp.multiplyScalar(k);
      const rr = perp.length() / Math.max(neckR, 1e-6);
      const h = dome * Math.max(0, 1 - rr * rr);
      const dd = keepLow ? neck + h : neck - h;
      v.copy(perp).addScaledVector(u, dd);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  const sizeA = neck - lo;
  const sizeB = hi - neck;
  return {
    u,
    neck,
    geoA: make(true),
    geoB: make(false),
    /* Centroids along u (km in the mesh's units) and relative masses
     * (∝ size cubed: the lobes' densities are taken as equal). */
    cA: sumA / Math.max(1, cntA),
    cB: sumB / Math.max(1, cntB),
    mA: sizeA ** 3,
    mB: sizeB ** 3,
  };
}

/*
 * Arrokoth's gentle merger: the real Arrokoth, its spin run back fast to
 * 4.5 billion years ago, where it comes apart into its two lobes -- cut
 * from the site's own model, so the same colour, texture and size -- which
 * circle each other, draw together and touch at walking pace, becoming the
 * Arrokoth New Horizons saw.
 */
function arrokothMergerScene(ctx) {
  /* Lobes Wenu ~20.6 × 19.9 × 9.4 km and Weeyo ~15.4 × 13.8 × 9.8 km,
   * 36 km long in all (Spencer et al. 2020); contact at a few m/s or less
   * (McKinnon et al. 2020). The site's model is in km (its mesh scale is
   * the km-to-scene factor). */
  const ark = ctx.host;
  const surface = ark.getObjectByName("Arrokoth surface");
  const spin = ark.getObjectByName("Arrokoth spin");
  if (!surface || !spin) return { duration: 24, update() {} };
  const fov = ark.userData?.focusFov ?? 30;
  const A = ark.getWorldPosition(new THREE.Vector3());
  const sunDir = A.clone().negate().normalize();
  const kmToScene = surface.scale.x;
  const split = splitLobes(surface);
  const spinAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(spin.getWorldQuaternion(new THREE.Quaternion())).normalize();
  /* Looking down the spin axis from the Sun's side (as New Horizons saw
   * it, nearly pole-on), as far as the event camera tips (52°). */
  const sign = spinAxis.dot(sunDir) >= 0 ? 1 : -1;
  const view = spinAxis.clone().multiplyScalar(sign).addScaledVector(sunDir, 0.5).normalize();
  const START = 31; /* km centre to centre at the start: a layout */
  const reach = (START + 22) * 0.5 * kmToScene;
  const shot = holdShot(ctx, "Arrokoth", ark, { yaw: yawFor(view), pitch: pitchFor(view), distance: distanceFor(reach, 0.62, fov) });

  /* The pair, in the spin group's frame, scaled like the surface: an outer
   * group turning about y round the barycentre, the lobes inside. */
  const mat = surface.material.clone();
  const pair = new THREE.Group();
  pair.position.copy(surface.position);
  pair.quaternion.copy(surface.quaternion);
  pair.scale.copy(surface.scale);
  ctx.attach(spin, pair);
  const turn = new THREE.Group();
  pair.add(turn);
  const inner = new THREE.Group();
  turn.add(inner);
  const lobeA = new THREE.Mesh(split.geoA, mat);
  const lobeB = new THREE.Mesh(split.geoB, mat);
  lobeA.name = "Space event: Arrokoth's larger lobe (Wenu)";
  lobeB.name = "Space event: Arrokoth's smaller lobe (Weeyo)";
  inner.add(lobeA, lobeB);
  const fA = split.mB / (split.mA + split.mB);
  const fB = split.mA / (split.mA + split.mB);
  const bary = (split.mA * split.cA + split.mB * split.cB) / (split.mA + split.mB);
  turn.position.copy(split.u).multiplyScalar(bary);
  inner.position.copy(split.u).multiplyScalar(-bary);
  const contactSep = split.cB - split.cA;
  pair.visible = false;
  /* A puff of dust at the touch, at the neck. */
  const PUFF = 160;
  const puff = ctx.cloud(PUFF, { size: 2.4, parent: inner });
  const pr = rng(19);
  const puffV = Array.from({ length: PUFF }, () => new THREE.Vector3(pr() - 0.5, (pr() - 0.5) * 0.6, pr() - 0.5).normalize().multiplyScalar(2 + pr() * 6));
  puffV.forEach((_, i) => puff.tint(i, "#e8c0a8"));
  /* The small lobe's path round the barycentre. */
  const path = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.5, parent: pair });

  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const readout = H.label(["", ""], { at: [-0.7, 0.62, 0], height: 0.058, declutter: false });
  /* Bottom left, clear of the lobes circling in the middle. */
  const fact = H.label(["", ""], { at: [-1.12, -0.64, 0], height: 0.05, declutter: false });
  /* Wenu is the larger lobe, Weeyo the smaller. */
  const bigIsA = split.mA >= split.mB;
  const aLabel = H.label([bigIsA ? "Wenu" : "Weeyo"], { height: 0.044, colour: "#ffd9c0", declutter: false });
  const bLabel = H.label([bigIsA ? "Weeyo" : "Wenu"], { height: 0.044, colour: "#ffd9c0", declutter: false });
  [readout, fact, aLabel, bLabel].forEach((o) => ctx.fade(o, 0));

  ctx.tell([
    { at: 0, label: "A snowman", text: "The real Arrokoth, far beyond Pluto: two small worlds stuck together, 36 km long." },
    { at: 0.18, label: "Back in time", text: "Run time back 4.5 billion years, and it comes apart into its two lobes." },
    { at: 0.38, label: "Circling", text: "Two small icy worlds circle each other, and slowly draw together, each keeping the same face to the other." },
    { at: 0.7, label: "Walking pace", text: "They touch at a few metres per second or less — so gently that neither breaks." },
    { at: 0.82, label: "Arrokoth", text: "One 36 km body, unchanged since: the first building blocks of planets, preserved. New Horizons flew past on January 1, 2019." },
  ]);
  /* Separation (km, centroid to centroid) and the pair's angle. Back in
   * time (0.3–0.4) they come apart turning backwards; forward (0.4–0.72)
   * they circle 2.5 times and close to contact. */
  const sepAt = (p) => {
    if (p < 0.3) return contactSep;
    if (p < 0.4) return lerp(contactSep, START, easeInOut(span(p, 0.3, 0.4)));
    if (p < 0.72) return lerp(START, contactSep, Math.pow(span(p, 0.4, 0.72), 1.7));
    return contactSep;
  };
  const turnAt = (p) => {
    if (p < 0.3) return 0;
    if (p < 0.4) return -2.2 * easeInOut(span(p, 0.3, 0.4));
    if (p < 0.72) return -2.2 + TAU * 2.5 * Math.pow(span(p, 0.4, 0.72), 0.85);
    return -2.2 + TAU * 2.5;
  };
  const spin0 = spin.rotation.y;
  let spinAngle = 0;
  let lastT = ctx.t;
  const w = new THREE.Vector3();
  return {
    duration: 24,
    update(p) {
      shot.keep();
      const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
      lastT = ctx.t;
      /* The real body: its own slow turn, then run backwards fast. After the
       * merger the pair's angle carries on as the body's turn. */
      const rewind = smooth(p, 0.16, 0.3);
      spinAngle += dt * (0.25 - 9 * rewind * (p < 0.3 ? 1 : 0));
      const apart = p >= 0.3 && p < 0.8;
      spin.rotation.y = spin0 + spinAngle + (p >= 0.8 ? 0.25 * (p - 0.8) * 24 : 0);
      surface.visible = !apart;
      pair.visible = apart;
      const sep = sepAt(p);
      const extra = sep - contactSep;
      lobeA.position.copy(split.u).multiplyScalar(-fA * extra);
      lobeB.position.copy(split.u).multiplyScalar(fB * extra);
      turn.rotation.y = turnAt(p);
      /* Path of the small lobe so far (forward part). */
      if (p > 0.4) {
        const pts = [];
        for (let i = 0; i <= 160; i += 1) {
          const pp = lerp(0.4, Math.min(p, 0.72), i / 160);
          const a = turnAt(pp);
          const r = (split.cB - bary) + fB * (sepAt(pp) - contactSep);
          pts.push(new THREE.Vector3().copy(split.u).multiplyScalar(r).applyAxisAngle(new THREE.Vector3(0, 1, 0), a).add(turn.position).setY(0));
        }
        ctx.setLine(path, pts);
      }
      ctx.fade(path, smooth(p, 0.42, 0.46) * (1 - smooth(p, 0.72, 0.8)));
      /* The touch: a faint puff at the neck. */
      const touch = span(p, 0.72, 0.86);
      const neckAt = split.u.clone().multiplyScalar(split.neck);
      for (let i = 0; i < PUFF; i += 1) {
        const pv = puffV[i];
        puff.set(i, neckAt.x + pv.x * touch, neckAt.y + pv.y * touch, neckAt.z + pv.z * touch);
        puff.alpha[i] = p >= 0.72 && p < 0.8 ? 0.8 * (1 - touch) : 0;
      }
      puff.commit();
      /* Names on the lobes while they are apart. */
      const named = apart ? smooth(p, 0.36, 0.4) * (1 - smooth(p, 0.7, 0.74)) : 0;
      lobeA.localToWorld(w.copy(split.u).multiplyScalar(split.cA));
      pin(ctx, aLabel, w, 0, 0.12);
      lobeB.localToWorld(w.copy(split.u).multiplyScalar(split.cB));
      pin(ctx, bLabel, w, 0, 0.12);
      ctx.fade(aLabel, named);
      ctx.fade(bLabel, named);
      readout.userData.draw(p < 0.18 ? ["Arrokoth today", "36 km long, 6.6 billion km from the Sun"]
        : p < 0.4 ? ["Back in time", `${(4.5 * smooth(p, 0.18, 0.38)).toFixed(1)} billion years ago`]
          : p < 0.72 ? ["About 4.5 billion years ago", `${sep.toFixed(0)} km apart, centre to centre`]
            : p < 0.82 ? ["Contact", "at a few m/s or less — walking pace"]
              : ["Arrokoth", "unchanged for 4.5 billion years"]);
      ctx.fade(readout, smooth(p, 0.0, 0.05));
      fact.userData.draw(p < 0.4 ? ["Two lobes, Wenu and Weeyo", "joined at a narrow neck"]
        : p < 0.82 ? ["Each keeps one face to the other", "their flat sides line up"]
          : ["Seen by New Horizons", "January 1, 2019"]);
      ctx.fade(fact, smooth(p, 0.04, 0.1));
    },
    dispose() {
      surface.visible = true;
      spin.rotation.y = spin0;
    },
  };
}

/* ------------------------------------------------------------ Gliese 710 */

/*
 * A star brushes the Oort Cloud: the real Sun at the middle, the site's own
 * Oort Cloud round it and the planets' orbits small inside, seen from far
 * out; Gliese 710 crossing the cloud 10,000 AU from the Sun; comets near its
 * path nudged and falling in toward the Sun.
 */
function gliese710Scene(ctx) {
  /* Closest approach ~10,000 AU in ~1.29 Myr (de la Fuente Marcos & de la
   * Fuente Marcos 2018, Gaia DR2); speed ~14 km/s ≈ 2.95 AU/yr (1 AU/yr =
   * 4.74 km/s). Oort Cloud ~2,000–100,000 AU (NASA; estimates). Distances
   * here go through the site's own AU-to-scene curve (smallBodyAuToScene),
   * which squeezes the far distances, as the whole site does. */
  const CLOSEST = 10000;
  const AU_PER_YEAR = 14 / 4.74;
  const sun = ctx.host;
  const S = sun.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  /* The whole cloud in view: its outer edge, 100,000 AU, is 6,310 units
   * out on the site's scale (smallBodies.js), and the camera may go no
   * further than 11,500 units (main.js) -- so a wider lens for this event
   * (70°, put back after), from 10,500 units. */
  const fov0 = sun.userData.focusFov;
  sun.userData.focusFov = 70;
  const yaw = 0.6;
  const pitch = 0.5;
  const distance = 10500;
  const shot = holdShot(ctx, "Sun", sun, { yaw, pitch, distance });
  const { back, right, up } = shotAxes(yaw, pitch);
  /* The encounter's geometry in AU, world axes: closest point up and a
   * little toward us; the star moving right to left across the picture. */
  const nHat = up.clone().multiplyScalar(0.9).addScaledVector(back, 0.44).normalize();
  const vHat = right.clone().negate().addScaledVector(nHat, -right.clone().negate().dot(nHat)).normalize();
  const toScene = (au) => {
    const d = au.length();
    if (d < 1e-6) return new THREE.Vector3();
    return au.clone().multiplyScalar(smallBodyAuToScene(d) / d / U);
  };
  const C = nHat.clone().multiplyScalar(CLOSEST);
  const starAt = (s) => C.clone().addScaledVector(vHat, s);
  /* The star and its track (stage units: 1 = the Sun's radius). */
  const star = ctx.sun(220 / U, { colour: "#ff8a4a", hot: "#ffc28a", halo: 5, haloColour: "#ff9a5a", haloOpacity: 0.7 });
  const track = ctx.line(Array.from({ length: 121 }, (_, i) => toScene(starAt(lerp(-90000, 90000, i / 120)))), { colour: "#ffb27a", opacity: 0.5, dashed: true, dash: 200 / U, gap: 160 / U });
  const closest = ctx.line([[0, 0, 0], toScene(C)], { colour: "#ffe2a8", opacity: 0.85 });
  /* Comets near the path: kicked as the star goes by; most fall in. */
  const r = rng(71);
  const NC = 520;
  const comets = ctx.cloud(NC, { size: 3 });
  const cdata = [];
  for (let i = 0; i < NC; i += 1) {
    const s = (r() - 0.5) * 80000;
    const off = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(2000 + r() * 16000);
    const pos = starAt(s).add(off);
    if (pos.length() < 3000) pos.setLength(3000 + r() * 4000);
    cdata.push({ pos, s, fall: r() < 0.6, at: r(), bend: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.25) });
  }
  const hud = ctx.hudLayer();
  const H = hudKit(ctx, hud);
  const starLabel = H.label(["Gliese 710", "an orange dwarf, half the Sun's mass"], { height: 0.05, colour: "#ffd2b0", declutter: false });
  const closestLabel = H.label(["~10,000 AU", "10,000 times Earth's distance"], { height: 0.046, colour: "#ffe2a8", declutter: false });
  const sunLabel = H.label(["The Sun", "the planets' orbits, inside 30 AU"], { height: 0.046, declutter: false });
  const oortLabel = H.label(["The Oort Cloud", "icy bodies out to ~100,000 AU"], { at: [-0.95, 0.6, 0], height: 0.05, colour: "#cfe0ff", declutter: false });
  const clock = H.label(["", ""], { at: [-0.95, -0.6, 0], height: 0.056, declutter: false });
  [starLabel, closestLabel, sunLabel, oortLabel, clock, star, track, closest].forEach((o) => ctx.fade(o, 0));

  ctx.tell([
    { at: 0, label: "The Oort Cloud", text: "The real Sun, its planets small at the middle, and around them the vast Oort Cloud of icy bodies, out to perhaps 100,000 AU." },
    { at: 0.14, label: "1.29 million years on", text: "A small orange star, Gliese 710, is heading our way." },
    { at: 0.3, label: "Closest approach", text: "It passes about 10,000 AU from the Sun — through the Oort Cloud, far outside the planets." },
    { at: 0.6, label: "A comet shower", text: "Its gravity nudges comets near its path. Many fall toward the Sun, arriving over the next million years or so." },
  ]);
  const sAt = (p) => lerp(-90000, 90000, span(p, 0.14, 0.62));
  const tmp = new THREE.Vector3();
  return {
    duration: 24,
    update(p) {
      shot.keep();
      const sStar = sAt(p);
      const sp = toScene(starAt(sStar));
      star.position.copy(sp);
      const starOn = smooth(p, 0.14, 0.18) * (1 - smooth(p, 0.62, 0.68));
      ctx.fade(star, starOn);
      ctx.fade(track, smooth(p, 0.16, 0.22) * (1 - smooth(p, 0.7, 0.78)) * 0.9);
      const near = smooth(p, 0.3, 0.36) * (1 - smooth(p, 0.62, 0.68));
      ctx.fade(closest, near);
      const fallPhase = span(p, 0.56, 0.97);
      cdata.forEach((c, i) => {
        const passed = smooth(sStar - c.s, 0, 12000);
        tmp.copy(c.pos);
        let a = 0;
        if (passed > 0) a = 0.85 * passed;
        if (c.fall && fallPhase > 0) {
          const f = easeInOut(clamp01((fallPhase - c.at * 0.5) / 0.5));
          const k = 1 - 0.995 * f;
          tmp.multiplyScalar(k).addScaledVector(c.bend, c.pos.length() * Math.sin(Math.PI * f) * 0.6);
          if (f > 0.98) a *= (1 - f) / 0.02;
        }
        const v = toScene(tmp);
        comets.set(i, v.x, v.y, v.z);
        comets.tint(i, passed > 0.5 ? "#ffd7a8" : "#cfe3ff");
        comets.alpha[i] = a;
      });
      comets.commit();
      const hs = toHud(ctx, star.getWorldPosition(new THREE.Vector3()));
      starLabel.position.set(hs.x, hs.y + 0.1, 0);
      ctx.fade(starLabel, starOn);
      const hc = toHud(ctx, closest.localToWorld(toScene(C).multiplyScalar(0.5)));
      closestLabel.position.set(hc.x - 0.2, hc.y, 0);
      ctx.fade(closestLabel, near);
      const h0 = toHud(ctx, S);
      sunLabel.position.set(h0.x, h0.y - 0.12, 0);
      ctx.fade(sunLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.28, 0.32)));
      ctx.fade(oortLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.5, 0.56)));
      if (p < 0.14) {
        clock.userData.draw([`+${fmt(1.29e6 * smooth(p, 0.0, 0.13))} years`, "from now"]);
      } else if (p < 0.62) {
        const dt = sStar / AU_PER_YEAR;
        clock.userData.draw(["+1.29 million years", Math.abs(dt) < 1800 ? "closest approach" : `${dt < 0 ? "" : "+"}${fmt(Math.round(dt / 1000) * 1000)} years from closest`]);
      } else {
        clock.userData.draw([`+${fmt(Math.round((1e6 * fallPhase) / 10000) * 10000)} years`, "after the pass"]);
      }
      ctx.fade(clock, smooth(p, 0.0, 0.04));
    },
    dispose() { sun.userData.focusFov = fov0; },
  };
}

/* ------------------------------------------------------------ exports */

/* Each scene with the picture leaned left of the event card (bodyKit's
 * leanLeft), set before the scene reads any screen positions. */
function withLean(ctx, make, share = 0.18) {
  const lean = leanLeft(ctx, share);
  const scene = make(ctx);
  return {
    duration: scene.duration ?? 24,
    update(p, ...rest) {
      lean.apply();
      scene.update?.(p, ...rest);
    },
    dispose(...rest) {
      lean.release();
      scene.dispose?.(...rest);
    },
  };
}
export const uranusTipped = (ctx) => withLean(ctx, uranusTippedScene);
export const uranusSeasons = (ctx) => withLean(ctx, uranusSeasonsScene, 0.12);
export const neptuneDarkSpot = (ctx) => withLean(ctx, neptuneDarkSpotScene);
export const neptuneWinds = (ctx) => withLean(ctx, neptuneWindsScene, 0.1);
export const tritonDoom = (ctx) => withLean(ctx, tritonDoomScene);
export const charonRedCap = (ctx) => withLean(ctx, charonRedCapScene);
export const arrokothMerger = (ctx) => withLean(ctx, arrokothMergerScene);
export const gliese710 = (ctx) => withLean(ctx, gliese710Scene, 0.14);

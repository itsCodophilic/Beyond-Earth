import * as THREE from "three";
import { bodyRadius, yawFor } from "./real.js";
import { TAU } from "./kit.js";

/**
 * Round 84 (Prompts.md: the asteroid, Jupiter and Saturn events "using real
 * bodies of the solar system"): helpers for a catalogue event that plays on
 * a real body first and then, where a picture explains it better, on a
 * drawn diorama -- on black, or beside the real body. The same tools the
 * Mercury, Venus and Mars events use (inner.js), shared here.
 */

/* Where a world point is on the hud layer (hud units: 1 = half the
 * screen's height, x scaled by the aspect). */
export function toHud(ctx, world, out = new THREE.Vector3()) {
  out.copy(world).project(ctx.camera);
  return out.set(out.x * (ctx.camera.aspect || 1.6), out.y, 0);
}
/* An angle seen by the lens, in hud units. */
export const angleToHud = (ctx, angle) => Math.tan(angle) / Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov * 0.5));

/*
 * A body's radius in world units. A planet or moon is a mesh (its sphere's
 * radius times its scale); a small body is a group whose visualRadius is
 * already in world units.
 */
export function worldRadius(body) {
  if (body?.geometry) return bodyRadius(body) * body.getWorldScale(new THREE.Vector3()).x;
  return Number(body?.userData?.visualRadius) || 1;
}

/*
 * The camera pitch that looks along a world direction. main.js puts the
 * camera at (cos p sin y, 0.64 sin p, cos p cos y) x distance from the
 * focused body, and caps an event's pitch at 1.1.
 */
export function pitchFor(dir) {
  return THREE.MathUtils.clamp(Math.atan2(dir.y / 0.64, Math.hypot(dir.x, dir.z)), -1.1, 1.1);
}
export function offsetLength(pitch) {
  return Math.hypot(Math.cos(pitch), 0.64 * Math.sin(pitch));
}
/* The camera's offset direction for a yaw and pitch. */
export function shotDirection(yaw, pitch) {
  return new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), 0.64 * Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)).normalize();
}

/*
 * Holds the event's clock until the camera has really arrived: within 3%
 * of `dist` (if given), within `within` of the body (if given), and about
 * `tolerance` radians of the direction -- or `maxSeconds`.
 */
export function holdForShot(ctx, centre, yaw, pitch, dist, tolerance = 0.03, { within = null } = {}) {
  const want = shotDirection(yaw, pitch);
  const off = new THREE.Vector3();
  const at = typeof centre === "function" ? centre : () => centre;
  ctx.holdWhile(() => {
    off.copy(ctx.camera.position).sub(at());
    return (dist != null && Math.abs(off.length() - dist) > dist * 0.03)
      || (within != null && off.length() > within)
      || off.normalize().angleTo(want) > tolerance;
  }, globalThis.__flyMaxSeconds ?? 12);
}

/*
 * A shot on the focused body, held: refocus once, hold the clock until the
 * camera is there, and keep() re-asserts it every frame (main.js applies a
 * composition once an arrival settles that would otherwise move it).
 * `distance` is the camera's distance from the body, world units.
 */
export function holdShot(ctx, name, body, { yaw, pitch, distance }) {
  const p = THREE.MathUtils.clamp(pitch, -1.1, 1.1);
  const shotDistance = distance / offsetLength(p);
  ctx.refocus(name, { shotYaw: yaw, shotPitch: p, shotDistance });
  holdForShot(ctx, () => body.getWorldPosition(new THREE.Vector3()), yaw, p, distance, 0.03);
  return {
    yaw, pitch: p, distance,
    keep(d = distance, y = yaw, pp = p) {
      ctx.aim(y, pp);
      ctx.setZoomDistance(d / offsetLength(pp));
    },
  };
}
/* The distance at which a body of world radius r fills `share` of the
 * screen's half-height with lens `fovDeg`. */
export function distanceFor(r, share, fovDeg) {
  return r / Math.sin(Math.atan(share * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)));
}

/*
 * A copy of the kit whose drawing calls default to another parent -- the
 * hud layer of a body event -- so a round-79 diorama, written for a hud
 * event's root, can be played there. Reads through to the kit for
 * everything else (ctx.t stays live). Its captions are ignored (the event
 * has its own), and its light is its own (view space), applied with
 * hudLight while it shows.
 */
export function hudKit(ctx, parent) {
  const k = Object.create(ctx);
  const at = (fn, index) => (...args) => {
    args[index] = { parent, ...(args[index] ?? {}) };
    return fn(...args);
  };
  k.root = parent;
  k.add = (object, to = parent) => ctx.add(object, to);
  [["line", 1], ["circle", 1], ["orbit", 2], ["arrow", 2], ["glow", 2], ["label", 1], ["cloud", 1], ["disc", 1], ["shape", 1], ["ball", 1], ["sun", 1], ["rock", 1], ["ring", 2], ["starfield", 1]]
    .forEach(([name, index]) => { k[name] = at(ctx[name], index); });
  k.tell = () => {};
  k.light = new THREE.Vector3(-0.55, 0.45, 0.7).normalize();
  return k;
}
/* The light for a hud diorama: a direction in view space (x right, y up,
 * z toward the viewer), turned into the world each frame because a body
 * stage lights in world axes. */
export function hudLight(ctx, x, y, z) {
  ctx.lightFollowsSun = false;
  ctx.light.set(x, y, z).normalize().applyQuaternion(ctx.camera.quaternion);
}

/*
 * A round-79 diorama (a hud scene function) played inside a group on the
 * hud layer: placed at (x, y) and scaled by `scale`. update(q) runs it at
 * its own progress q; show(a) fades it.
 */
export function diorama(ctx, sceneFn, { x = 0, y = 0, scale = 1 } = {}) {
  const hud = ctx.hudLayer();
  const group = new THREE.Group();
  group.position.set(x, y, 0);
  group.scale.setScalar(scale);
  hud.add(group);
  const K = hudKit(ctx, group);
  const scene = sceneFn(K) ?? {};
  let shown = 0;
  return {
    group,
    kit: K,
    show(a) {
      shown = a;
      ctx.fade(group, a);
    },
    update(q) {
      if (shown <= 0.002) return;
      hudLight(ctx, K.light.x, K.light.y, K.light.z);
      scene.update?.(THREE.MathUtils.clamp(q, 0, 1), K);
    },
    dispose() { scene.dispose?.(K); },
  };
}

/* A hud label pinned beside a world point (hud offset dx, dy). */
export function pin(ctx, label, world, dx = 0, dy = 0.08) {
  const h = toHud(ctx, world);
  label.position.set(h.x + dx, h.y + dy, 0);
}

/*
 * A ring lying on any body round a direction in the body's own frame
 * (`dirLocal`), angular radius `reach`, turning with it, with a glowing
 * dot at its centre. Works for a planet's mesh and for a small body's
 * group alike: the radius is the body's own in its local units.
 */
export function ringOn(ctx, body, dirLocal, reach, colour = "#ffd27f", { inner = 0.82, lift = 1.02, radius = null } = {}) {
  const scale = body.getWorldScale(new THREE.Vector3()).x || 1;
  const R = radius ?? (body.geometry ? bodyRadius(body) : worldRadius(body) / scale);
  const n = dirLocal.clone().normalize();
  const group = new THREE.Group();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  group.position.copy(n).multiplyScalar(R * (Math.cos(reach) * lift + 0.004));
  ctx.attach(body, group);
  const r = R * Math.sin(reach);
  const ring = ctx.ring(r * inner, r, { colour, opacity: 0.95, parent: group });
  const dot = ctx.glow(colour, R * Math.max(0.04, Math.sin(reach) * 0.3), { opacity: 1, parent: group });
  ctx.fade(ring, 0);
  ctx.fade(dot, 0);
  return { group, ring, dot, centre: () => group.getWorldPosition(new THREE.Vector3()) };
}

/* Named objects anywhere in the scene. */
export function sceneObjects(ctx, names) {
  let top = ctx.host;
  while (top?.parent) top = top.parent;
  return names.map((n) => top?.getObjectByName?.(n)).filter(Boolean);
}

/* A unit direction at latitude/east longitude on a three.js-mapped sphere
 * (real.js surfacePoint's convention: longitude -180 at the map's left). */
export function dirAt(latDeg, lonDeg) {
  const u = (lonDeg + 180) / 360;
  const th = THREE.MathUtils.degToRad(90 - latDeg);
  return new THREE.Vector3(-Math.cos(TAU * u) * Math.sin(th), Math.cos(th), Math.sin(TAU * u) * Math.sin(th));
}

/*
 * Turns a body about its own y axis (rotation.y, the site's spin) so a
 * direction in its frame faces a world direction, `amount` of the way.
 * Allows for a tilt the site puts on the body (rotation.x/z on the same
 * object) by working in its parent's frame with its full rotation.
 */
export function turnToward(body, dirLocal, worldDir, amount = 1) {
  const parentQ = new THREE.Quaternion();
  body.parent?.getWorldQuaternion(parentQ);
  const d = worldDir.clone().applyQuaternion(parentQ.clone().invert());
  const e = body.rotation.clone();
  const f0 = dirLocal.clone().applyEuler(new THREE.Euler(e.x, 0, e.z, e.order));
  /* With Euler XYZ the spin about y sits between x and z; try the two
   * readings and keep the better one. */
  const tryYaw = (y) => dirLocal.clone().applyEuler(new THREE.Euler(e.x, y, e.z, e.order)).dot(d);
  let best = e.y;
  let bestScore = -Infinity;
  for (let i = 0; i < 72; i += 1) {
    const y = e.y + (i / 72) * TAU;
    const s = tryYaw(y);
    if (s > bestScore) { bestScore = s; best = y; }
  }
  /* refine */
  for (let step = TAU / 144; step > 1e-4; step /= 2) {
    const a = tryYaw(best - step);
    const b = tryYaw(best + step);
    if (a > bestScore) { bestScore = a; best -= step; } else if (b > bestScore) { bestScore = b; best += step; }
  }
  void f0;
  let delta = best - body.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  body.rotation.y += delta * amount;
}

export { yawFor };

/*
 * Round 86: the picture moved left, so the focused body sits in the clear
 * part of the screen rather than half under the event card. main.js always
 * centres the focused body, so this shifts the lens's view instead (a view
 * offset -- the same as panning a photograph): `share` of the half-width.
 * The hud layer is moved back by the same amount, so hud positions stay
 * screen positions and toHud() still lines up with them. Call apply()
 * every frame (it follows the window's size); release() on dispose.
 */
export function leanLeft(ctx, share = 0.18) {
  const cam = ctx.camera;
  return {
    apply(k = 1) {
      const W = globalThis.innerWidth || 1600;
      const Hh = globalThis.innerHeight || 900;
      const s = share * k;
      if (Math.abs(s) < 1e-4) {
        if (cam.view?.enabled) cam.clearViewOffset();
      } else {
        cam.setViewOffset(W, Hh, (s * W) / 2, 0, W, Hh);
      }
      const hud = ctx.hudLayer();
      hud.position.x = s * (cam.aspect || 1.6) * hud.scale.x;
    },
    release() {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    },
  };
}

import * as THREE from "three";
import { TAU } from "./kit.js";

/**
 * Round 82 (Prompts.md: "use the real bodies of our solar system for every
 * space event"): helpers for catalogue events staged on the site's own
 * Sun, planets and moons rather than on drawn copies.
 *
 * A body is what `ctx.findBody(name)` returns -- the planet's own mesh (or,
 * for the Sun, its photosphere). Its map is simple cylindrical with longitude
 * -180 at the left edge, wrapped by three's SphereGeometry, so a point at
 * (lat, lon) in the body's own frame is
 *   x = -cos(2 pi u) sin(theta), y = cos(theta), z = sin(2 pi u) sin(theta)
 * with u = (lon + 180) / 360 and theta the colatitude (kit.js, surfacePoint).
 */

/** The body's own radius, from its geometry (its local units). */
export function bodyRadius(body) {
  const g = body?.geometry;
  if (g && !g.boundingSphere) g.computeBoundingSphere?.();
  return g?.boundingSphere?.radius ?? body?.userData?.visualRadius ?? 1;
}

/** A point on a body at latitude/east longitude, in its own frame. */
export function surfacePoint(body, latDeg, lonDeg, lift = 1) {
  const r = bodyRadius(body) * lift;
  const u = (lonDeg + 180) / 360;
  const th = THREE.MathUtils.degToRad(90 - latDeg);
  return new THREE.Vector3(-r * Math.cos(TAU * u) * Math.sin(th), r * Math.cos(th), r * Math.sin(TAU * u) * Math.sin(th));
}

/** Latitude and east longitude (degrees) of a direction in a body's frame. */
export function latLonOf(dir) {
  const d = dir.clone().normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)));
  const u = Math.atan2(d.z, -d.x) / TAU;
  const lon = (((u + 1) % 1) * 360) - 180;
  return { lat, lon };
}

/** World position of a body. */
export function worldOf(body, out = new THREE.Vector3()) {
  return body.getWorldPosition(out);
}

/**
 * Turns a body about its own spin axis so a surface point faces a world
 * direction, `amount` of the way (the site spins planets by adding to
 * rotation.y, so it carries on from there afterwards). Allows for the tilt
 * the site puts on the mesh itself (rotation.z, applied before the spin).
 */
export function turnBodyToward(body, latDeg, lonDeg, worldDir, amount = 1) {
  const f = surfacePoint(body, latDeg, lonDeg).applyAxisAngle(new THREE.Vector3(0, 0, 1), body.rotation.z || 0);
  const parentQ = new THREE.Quaternion();
  body.parent?.getWorldQuaternion(parentQ);
  const d = worldDir.clone().applyQuaternion(parentQ.invert());
  const want = Math.atan2(d.x, d.z) - Math.atan2(f.x, f.z);
  let delta = want - body.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  body.rotation.y += delta * amount;
}

/** The camera azimuth (see main.js refocus, shotYaw) that puts the camera
 * on a world horizontal direction from a body. */
export function yawFor(dir) {
  return Math.atan2(dir.x, dir.z);
}

/**
 * The real Earth's aurora, driven as a storm: the oval's centre (as
 * |sin(latitude)|), its width, its brightness and how much of the red
 * high-altitude glow shows (earthVisuals.js, round 82). restore() puts the
 * quiet aurora back.
 */
export function earthAurora(earth) {
  const layer = earth?.getObjectByName?.("Earth polar aurora");
  const u = layer?.material?.uniforms;
  const quiet = u ? { centre: u.uBandCentre?.value ?? 0.922, width: u.uBandWidth?.value ?? 1, gain: u.uGain?.value ?? 1, red: u.uRed?.value ?? 0 } : null;
  return {
    ok: Boolean(u?.uBandCentre),
    /* edgeLat: where the oval's middle sits, degrees of latitude. */
    set({ lat = 67, width = 1, gain = 1, red = 0 } = {}) {
      if (!u?.uBandCentre) return;
      u.uBandCentre.value = Math.sin(THREE.MathUtils.degToRad(lat));
      u.uBandWidth.value = width;
      u.uGain.value = gain;
      u.uRed.value = red;
    },
    restore() {
      if (!u?.uBandCentre || !quiet) return;
      u.uBandCentre.value = quiet.centre;
      u.uBandWidth.value = quiet.width;
      u.uGain.value = quiet.gain;
      u.uRed.value = quiet.red;
    },
  };
}

/**
 * The real Sun's own sunspot groups: their directions in its frame (the
 * photosphere shader's uSpotDirections). Index 0 is the biggest group.
 */
export function sunSpots(sun) {
  const dirs = sun?.material?.uniforms?.uSpotDirections?.value ?? [];
  return dirs.map((d) => d.clone().normalize());
}

/**
 * A glowing shell on one side of a body (its day side, say): additive,
 * strongest where the surface faces `dir` (world), fading to nothing at
 * 90 degrees. For the ionosphere lit by a flare, a planet's glow.
 */
export function sideGlow(radius, colour = "#8fb8ff", { power = 1.5, opacity = 0.6 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uDir: { value: new THREE.Vector3(1, 0, 0) }, uColor: { value: new THREE.Color(colour) }, uOpacity: { value: opacity }, uPower: { value: power } },
    vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vView;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * position);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDir;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uPower;
      varying vec3 vWorldNormal;
      varying vec3 vView;
      void main() {
        vec3 n = normalize(vWorldNormal);
        float side = pow(max(dot(n, normalize(uDir)), 0.0), uPower);
        float rim = 0.45 + 0.55 * pow(1.0 - max(dot(n, normalize(vView)), 0.0), 1.5);
        gl_FragColor = vec4(uColor * side * rim, 1.0) * uOpacity;
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), material);
  mesh.renderOrder = 7;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = 1;
  return mesh;
}

/**
 * A screen-sized ring sprite to find a small real body by (a planet a pixel
 * across from far out). Scale it each frame with `sizeOnScreen` x 2/P.
 */
export function finderRing(colour = "#ffd27f") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.strokeStyle = colour;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 52, 0, TAU);
  g.stroke();
  const texture = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.renderOrder = 40;
  sprite.raycast = () => {};
  return sprite;
}

/**
 * Moves the camera on to another real body mid-event (ctx.refocus) and
 * holds the event's clock until it gets there -- within `near` of the
 * body's radii -- or `maxSeconds` pass. Cut to black around it.
 */
export function flyTo(ctx, name, shot = {}, { near = 10, maxSeconds = 6 } = {}) {
  const body = ctx.findBody(name);
  if (!body || !ctx.refocus(name, shot)) return false;
  const at = new THREE.Vector3();
  const limit = bodyRadius(body) * Math.max(near, (shot.shotZoom ?? 1) * 8);
  /* (__flyMaxSeconds: a slow test machine may set a longer wait) */
  ctx.holdWhile(() => ctx.camera.position.distanceTo(body.getWorldPosition(at)) > limit, globalThis.__flyMaxSeconds ?? maxSeconds);
  return true;
}

/* White, as the Sun really is above the air (owner, rounds 82-83: "make the
 * Sun white"). Drawing choice for the kit sun shader's two tones. */
export const WHITE_SUN = { colour: "#d9d0c4", hot: "#ffffff", haloColour: "#fff1dc" };

/*
 * A cut: black (the hud stage alone) while `on`, and back to the scene after
 * -- with `between` (a list of objects to keep hidden, or null) as the veil
 * the rest of the time.
 */
export function cutter(ctx, between = null) {
  let dark = null;
  return (on) => {
    if (on === dark) return;
    dark = on;
    ctx.setVeil(on ? { blackout: true, keep: [ctx.hudAnchor()] } : between);
  };
}

/* The camera azimuth (main.js refocus, shotYaw) that looks at a body with
 * world direction `dir` running left to right across the screen: the offset
 * (sin y, 0, cos y) has screen-right (cos y, 0, -sin y). */
export function yawWithRight(dir) {
  return Math.atan2(-dir.z, dir.x);
}

/* Unit vectors to the camera's right and up, world axes. */
export function cameraAxes(camera) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  return { right, up };
}

/* A place on the real Earth: a glowing dot and its name, turning with it. */
export function earthPlace(ctx, earth, lat, lon, words, colour = "#ff8a8a") {
  const group = new THREE.Group();
  group.position.copy(surfacePoint(earth, lat, lon, 1.012));
  ctx.attach(earth, group);
  const dot = ctx.glow(colour, bodyRadius(earth) * 0.12, { opacity: 0.95, parent: group });
  const label = ctx.label(words, { parent: group, at: surfacePoint(earth, lat, lon, 1).normalize().multiplyScalar(bodyRadius(earth) * 0.18), height: 0.026, align: "left", declutter: false });
  ctx.fade(dot, 0);
  ctx.fade(label, 0);
  return { group, dot, label, lat, lon };
}

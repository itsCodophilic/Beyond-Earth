import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { bodyRadius, surfacePoint as bodyPoint, yawFor, cutter, WHITE_SUN } from "./real.js";
import { setOrbitPosition, createOrbitLine } from "../../orbits.js";
import { setVenusRadar, isVenusRadarOn } from "../../venusRadarView.js";

/**
 * Section 4 of the catalogue: Mercury, Venus and Mars (round 79).
 *
 * Transits, a Sun that rises twice, winds that outrun a planet, a volcano
 * caught changing, and Mars from Earth (opposition, the backwards loop) and
 * from its own ground (blue sunsets, dust devils, spring geysers, polar
 * avalanches), ending with Phobos's slow fall.
 *
 * Round 84 (Prompts.md, "Next part: inner planets"): nine of the twelve now
 * play on the site's own Sun, Mercury, Venus, Earth, Mars and Phobos --
 * the transits seen with the real planet crossing the real Sun, the
 * oppositions and the loop with the real Earth and Mars moved to the
 * sky's own longitudes on their highlighted orbits, the Venus vent and the
 * Mars surface events found on the real globes first, and Phobos falling
 * round the real Mars. The super-rotating winds and the blue sunset stay as
 * they were (owner: "looks good"). The round-79 dioramas are kept in
 * docs/archive/inner-dioramas-round79/inner.js.
 *
 * Orbital positions for Earth and Mars are computed from J2000 mean
 * elements, so the dates on screen are the dates the sky gives; sizes and
 * distances are NASA's planetary fact sheets unless a comment says
 * otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/* Julian date of J2000.0 (IAU). */
const J2000 = 2451545.0;

/** Julian date to "Jan 16, 2025" (Meeus, Astronomical Algorithms, ch. 7). */
function calendar(jd) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = Math.floor(b - d - Math.floor(30.6001 * e) + f);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** Kepler's equation M = E - e sin E, by Newton's method. */
function eccentricAnomaly(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}
function trueAnomaly(M, e) {
  const E = eccentricAnomaly(M, e);
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

/*
 * J2000 mean elements and their rates per Julian century (Standish, JPL
 * "Approximate Positions of the Planets", table 1, valid 1800–2050):
 * mean longitude L, longitude of perihelion w, semi-major axis a (AU),
 * eccentricity e, inclination i, ascending node.
 */
const EARTH = { L: 100.46457166, rate: 35999.37244981, w: 102.93768193, a: 1.00000261, e: 0.01671123, i: 0, node: 0 };
const MARS = { L: -4.55343205, rate: 19140.30268499, w: -23.94362959, a: 1.52371034, e: 0.0933941, i: 1.84969142, node: 49.55953891 };

/** Heliocentric ecliptic position (AU) of a planet at Julian date jd. */
function heliocentric(el, jd, out = new THREE.Vector3()) {
  const T = (jd - J2000) / 36525;
  const M = (el.L + el.rate * T - el.w) * DEG;
  const E = eccentricAnomaly(M, el.e);
  const v = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const r = el.a * (1 - el.e * Math.cos(E));
  const u = v + (el.w - el.node) * DEG;
  const node = el.node * DEG;
  const inc = el.i * DEG;
  return out.set(
    r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc)),
    r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc)),
    r * Math.sin(u) * Math.sin(inc),
  );
}
/** Heliocentric ecliptic longitude (radians) of a planet at jd. */
const longitudeAt = (el, jd) => {
  const v = heliocentric(el, jd);
  return Math.atan2(v.y, v.x);
};

/** A flat panel (MeshBasicMaterial) facing the viewer. */
function panel(ctx, w, h, { colour = "#ffffff", map = null, opacity = 1, order = 19, segments = [1, 1], vertexColors = false, parent = ctx.root } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h, segments[0], segments[1]),
    new THREE.MeshBasicMaterial({ color: colour, map, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false, vertexColors }),
  );
  mesh.renderOrder = order;
  mesh.userData.baseOpacity = opacity;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

/** A canvas texture painted once. */
function paint(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A filled polygon from [[x, y], ...] drawn in front (ground silhouettes). */
function solid(ctx, points, { colour = "#000000", order = 29, z = 0, opacity = 1, depthTest = true, parent = ctx.root } = {}) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, depthWrite: false, depthTest, side: THREE.DoubleSide, toneMapped: false, fog: false,
  }));
  mesh.position.z = z;
  mesh.renderOrder = order;
  mesh.userData.baseOpacity = opacity;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

/**
 * Marks drawn on the face of a sphere (a transit dot, its path) sit at
 * z = 0 and skip the depth test, so they are painted over the sphere by
 * render order. Raising them toward the lens instead would magnify them
 * in perspective and slide them off the disc.
 */
function onTop(object, order = 28) {
  object.traverse((o) => {
    if (o.material) o.material.depthTest = false;
    o.renderOrder = order;
  });
  return object;
}

/** Hours and minutes from minutes past midnight: "15:20". */
const clockTime = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/* Mars mean radius 3,389.5 km (NASA fact sheet). */
const MARS_RADIUS = 3389.5;
/* Kilometres per AU (IAU 2012). */
const AU_KM = 149597870.7;

/* ---------------------------------------- the real bodies (round 84) */

/*
 * The camera pitch that looks down (or up) along a world direction. main.js
 * puts the camera at (cos p sin y, 0.64 sin p, cos p cos y) x distance from
 * the focused body (setSphericalCameraOffset; aimAtAurora runs it backwards
 * the same way), so the offset's length is that distance times
 * offsetLength(p).
 */
function pitchFor(dir) {
  return Math.atan2(dir.y / 0.64, Math.hypot(dir.x, dir.z));
}
function offsetLength(pitch) {
  return Math.hypot(Math.cos(pitch), 0.64 * Math.sin(pitch));
}

/*
 * The mean anomaly that puts a site planet at scene longitude lam (radians
 * from +x toward +z). setOrbitPosition (scene/orbits.js) puts true anomaly
 * nu at angle nu + orbitRotation; the scene's x and z are the ecliptic's x
 * and y (the mapping the interstellar visitors use, round 80), so lam is
 * the heliocentric ecliptic longitude.
 */
function meanForLongitude(data, lam) {
  const e = THREE.MathUtils.clamp(data.orbitEccentricity ?? 0, 0, 0.92);
  const nu = lam - (data.orbitRotation ?? 0);
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  return E - e * Math.sin(E);
}
/** A point on a site planet's own orbit, in its parent's frame. */
function orbitPointAt(planet, lam, out = new THREE.Vector3()) {
  const d = planet.userData;
  return setOrbitPosition(out, d.orbitRadius, d.orbitEccentricity ?? 0, meanForLongitude(d, lam), d.orbitInclination ?? 0, d.orbitRotation ?? 0);
}
/**
 * Moves a real planet to a heliocentric longitude on its own orbit. The
 * site carries on from there (main.js adds to meanAnomaly each frame), so
 * nothing jumps back when the event ends.
 */
function putAtLongitude(planet, lam) {
  planet.userData.meanAnomaly = meanForLongitude(planet.userData, lam);
  orbitPointAt(planet, lam, planet.position);
  planet.updateMatrixWorld(true);
}
/** Puts a real planet at a mean anomaly (radians from perihelion). */
function putAtMean(planet, M) {
  const d = planet.userData;
  d.meanAnomaly = M;
  setOrbitPosition(planet.position, d.orbitRadius, d.orbitEccentricity ?? 0, M, d.orbitInclination ?? 0, d.orbitRotation ?? 0);
  planet.updateMatrixWorld(true);
}
const longitudeOf = (planet) => Math.atan2(planet.position.z, planet.position.x);

/*
 * A planet's own orbit, highlighted: a second ribbon on exactly the path
 * the site's guide draws (the same createOrbitLine, same elements), wider
 * and brighter. main.js eases the site's guides every frame, so this does
 * not fight it; it is taken away with the event.
 */
function orbitRibbon(ctx, planet, colour, { width = 3.6, opacity = 0.95 } = {}) {
  const d = planet?.userData;
  /* Hung from the planet's own parent (the world, in the same frame as
   * the guides' root) rather than with the guides: main.js hides all the
   * guides while the Sun is being inspected. */
  const parent = planet?.parent;
  if (!parent || !d?.orbitRadius) return null;
  const ribbon = createOrbitLine(parent, d.orbitRadius, colour, opacity, d.orbitInclination ?? 0, d.orbitEccentricity ?? 0, d.orbitRotation ?? 0, 480, width);
  ribbon.name = "Space event: highlighted orbit";
  ribbon.renderOrder = -6;
  ribbon.raycast = () => {};
  ribbon.userData.setViewport?.(innerWidth, innerHeight);
  ctx.attach(parent, ribbon);
  return ribbon;
}

/* Where a world point is on the hud layer (hud units: 1 = half the
 * screen's height, x scaled by the aspect). */
function toHud(ctx, world, out = new THREE.Vector3()) {
  out.copy(world).project(ctx.camera);
  return out.set(out.x * (ctx.camera.aspect || 1.6), out.y, 0);
}
/* An angle seen by the lens, in hud units. */
const angleToHud = (ctx, angle) => Math.tan(angle) / Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov * 0.5));
/* A body's radius in world units. */
const worldRadius = (body) => bodyRadius(body) * body.getWorldScale(new THREE.Vector3()).x;

/*
 * A copy of the kit whose drawing calls default to another parent -- the
 * hud layer of a body event -- so the round-79 dioramas, written for a hud
 * event's root, can be played on black after the real-body part. Reads
 * through to the kit for everything else (ctx.t stays live).
 */
function hudKit(ctx, parent) {
  const k = Object.create(ctx);
  const at = (fn, index) => (...args) => {
    args[index] = { parent, ...(args[index] ?? {}) };
    return fn(...args);
  };
  k.root = parent;
  k.add = (object, to = parent) => ctx.add(object, to);
  [["line", 1], ["circle", 1], ["orbit", 2], ["arrow", 2], ["glow", 2], ["label", 1], ["cloud", 1], ["disc", 1], ["shape", 1], ["ball", 1], ["sun", 1], ["rock", 1], ["ring", 2], ["starfield", 1]]
    .forEach(([name, index]) => { k[name] = at(ctx[name], index); });
  return k;
}
/* The light for a body event's hud diorama: a direction in view space
 * (x right, y up, z toward the viewer), turned into the world each frame
 * because a body stage lights in world axes. */
function hudLight(ctx, x, y, z) {
  ctx.lightFollowsSun = false;
  ctx.light.set(x, y, z).normalize().applyQuaternion(ctx.camera.quaternion);
}

/*
 * A ring lying on a real body round a place (lat, east lon), angular
 * radius `reach` (radians), turning with the body, with a glowing dot at
 * its centre. Returns the group, the ring and the dot.
 */
function placeRing(ctx, body, lat, lon, reach, colour = "#ffd27f", inner = 0.9) {
  const R = bodyRadius(body);
  const n = bodyPoint(body, lat, lon).normalize();
  const group = new THREE.Group();
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  group.position.copy(n).multiplyScalar(R * (Math.cos(reach) + 0.012));
  ctx.attach(body, group);
  const r = R * Math.sin(reach);
  const ring = ctx.ring(r * inner, r, { colour, opacity: 0.95, parent: group });
  const dot = ctx.glow(colour, R * Math.max(0.05, Math.sin(reach) * 0.35), { opacity: 1, parent: group });
  ctx.fade(ring, 0);
  ctx.fade(dot, 0);
  return { group, ring, dot, centre: () => group.getWorldPosition(new THREE.Vector3()) };
}

/* A hud label pinned beside a world point (hud offset dx, dy). */
function pin(ctx, label, world, dx = 0, dy = 0.08) {
  const h = toHud(ctx, world);
  label.position.set(h.x + dx, h.y + dy, 0);
}

/*
 * A transit, seen on the real Sun with the real planet crossing it.
 *
 * The Sun is focused, and the camera put out beyond the planet on the line
 * from the Sun through it -- where Earth would be -- and lifted off the
 * planet's orbital plane just enough that the planet's path crosses the
 * disc at the transit's real distance from the centre (`miss`, in Sun
 * radii, + north). The camera's distance sets the planet's size on screen;
 * the real Sun's model is scaled (main.js setSunLook) so its disc keeps the
 * transit's true size ratio (`ratio`, Sun width / planet width) -- the site
 * draws the planets far closer to the Sun than they are, so without it the
 * Sun would look far too big. The planet then moves along its own orbit,
 * through `x` = -1 (outside contact) to +1, and the clock is read off where
 * it really is on the disc.
 */
function transitStage(ctx, name, { ratio, miss, enlarge = 1, sunHud = 0.32, brighten = [1.6, 1.55, 1.45] }) {
  const sunBody = ctx.host;
  const planet = ctx.findBody(name);
  if (!planet || !sunBody) return null;
  const data = planet.userData;
  const S = sunBody.getWorldPosition(new THREE.Vector3());
  const P0 = planet.getWorldPosition(new THREE.Vector3()).sub(S);
  const lam0 = Math.atan2(P0.z, P0.x);
  const rOrbit = Math.hypot(P0.x, P0.z);
  const scale0 = planet.scale.clone();
  if (enlarge !== 1) planet.scale.multiplyScalar(enlarge);
  const rP = worldRadius(planet);
  /* The lens the site uses with the Sun focused (main.js: focusFov, else
   * 34 degrees, the Sun's own). */
  const fov = THREE.MathUtils.degToRad(sunBody.userData?.focusFov ?? 34);
  const aSun = Math.atan(sunHud * Math.tan(fov / 2));
  const aPlanet = (aSun / ratio) * enlarge;
  const dc = rP / Math.tan(aPlanet);
  const theta = miss * aSun;
  /* Lifted so the line of sight passes theta below the planet. */
  const sinE = THREE.MathUtils.clamp((P0.y - theta * dc) / rOrbit, -0.8, 0.8);
  const cosE = Math.sqrt(1 - sinE * sinE);
  const w = new THREE.Vector3(cosE * Math.cos(lam0), sinE, cosE * Math.sin(lam0));
  const Dc = rOrbit + dc;
  const yaw = yawFor(w);
  const pitch = pitchFor(w);
  ctx.refocus("Sun", { shotYaw: yaw, shotPitch: pitch, shotDistance: Dc / offsetLength(pitch) });
  /* The Sun's model scaled so its disc is aSun across from Dc. */
  ctx.setSunLook({ scale: (Dc * Math.tan(aSun)) / bodyRadius(sunBody), tint: new THREE.Color(...brighten) });
  /* The clock waits for the camera to get there. */
  holdForShot(ctx, S, yaw, pitch, Dc, 0.012);

  /* Which way along the orbit is left to right on screen: the camera's
   * right is (cos yaw, 0, -sin yaw) (real.js yawWithRight). */
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const along = Math.sign(right.dot(new THREE.Vector3(-Math.sin(lam0), 0, Math.cos(lam0)))) || 1;
  const halfChord = Math.sqrt(Math.max(0, aSun * aSun - theta * theta)) + aPlanet;
  const lamAt = (x) => lam0 + (along * x * halfChord * dc) / rOrbit;

  /* Paths: arcs of the planet's own orbit, the far-north and far-south
   * ones lifted by `shift` Sun radii as seen from here. */
  const tracks = new THREE.Group();
  ctx.attach(planet.parent, tracks);
  const arc = (shift, colour, opacity) => {
    const pts = [];
    for (let i = 0; i <= 120; i += 1) {
      const q = orbitPointAt(planet, lamAt(lerp(-1.6, 1.6, i / 120)));
      q.y += shift * aSun * dc;
      pts.push(q);
    }
    const length = 3.2 * halfChord * dc;
    const line = ctx.line(pts, { colour, opacity, dashed: true, dash: length / 70, gap: length / 110, additive: false, parent: tracks });
    line.renderOrder = 30;
    ctx.fade(line, 0);
    return line;
  };

  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  return {
    planet, S, aSun, aPlanet, dc, theta, tracks, arc,
    /* Holds the shot every frame: a composition main.js applies once the
     * arrival has settled must not take the camera somewhere else. */
    keep() { ctx.aim(yaw, pitch); ctx.setZoomDistance(Dc / offsetLength(pitch)); },
    /* x: -1 outside contact before, +1 after (a little beyond the disc). */
    put(x) { putAtLongitude(planet, lamAt(x)); },
    /* Where the planet is on the disc, in Sun radii, and the Sun's centre
     * and radius on the hud. */
    measure() {
      const c = toHud(ctx, S, v1);
      const q = toHud(ctx, planet.getWorldPosition(v3), v2);
      const dist = ctx.camera.position.distanceTo(S);
      const sr = angleToHud(ctx, Math.asin(Math.min(0.99, worldRadius(sunBody) / dist)));
      return { cx: c.x, cy: c.y, px: q.x, py: q.y, sr, x: (q.x - c.x) / sr, y: (q.y - c.y) / sr, pr: angleToHud(ctx, Math.atan(rP / Math.max(1e-6, ctx.camera.position.distanceTo(planet.getWorldPosition(v3))))) };
    },
    restore() {
      planet.scale.copy(scale0);
      ctx.setSunLook(null);
    },
  };
}
/*
 * Holds the event's clock until the camera has really arrived at a shot
 * (main.js eases the yaw slowly, so the distance alone is not enough):
 * within 3% of the distance and about a quarter of a degree of the
 * direction, or `maxSeconds` (a slow test machine may set a longer wait).
 */
function holdForShot(ctx, centre, yaw, pitch, dist, tolerance = 0.004, { within = null } = {}) {
  const want = new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), 0.64 * Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)).normalize();
  const off = new THREE.Vector3();
  ctx.holdWhile(() => {
    off.copy(ctx.camera.position).sub(centre);
    /* `within`: when the exact distance is not known (a shot given as a
     * zoom), at least that close -- the camera may still be flying in
     * along the right direction. */
    return (dist != null && Math.abs(off.length() - dist) > dist * 0.03)
      || (within != null && off.length() > within)
      || off.normalize().angleTo(want) > tolerance;
  }, globalThis.__flyMaxSeconds ?? 12);
}

/* Named objects anywhere in the scene (the asteroid and Kuiper belts, to
 * keep a view of the Sun clear of their bands). */
function sceneObjects(ctx, names) {
  let top = ctx.host;
  while (top?.parent) top = top.parent;
  return names.map((n) => top?.getObjectByName?.(n)).filter(Boolean);
}

/* Fraction of the way from first to last contact, from the planet's place
 * on the disc (x, y in Sun radii) and its true radius k (Sun radii). */
function transitFraction(m, k) {
  const X = Math.sqrt(Math.max(1e-6, (1 + k) ** 2 - m.y * m.y));
  return (m.x + X) / (2 * X);
}

/*
 * The real Earth and Mars from high above the real Sun, both orbits
 * highlighted, the view turned so `lamView` (a heliocentric longitude) is
 * on the left of the screen, clear of the card. place(jd) moves both to
 * the real planets' longitudes on that date.
 */
function earthMarsStage(ctx, lamView) {
  const earth = ctx.findBody("Earth");
  const mars = ctx.findBody("Mars");
  const sunBody = ctx.host;
  if (!earth || !mars || !sunBody) return null;
  const S = sunBody.getWorldPosition(new THREE.Vector3());
  const U = ctx.unit;
  /* From about 52° up -- main.js caps the event pitch at 1.1 -- with
   * Mars's orbit filling the height (drawing choice). */
  const PITCH = 1.1;
  const fov = THREE.MathUtils.degToRad(sunBody.userData?.focusFov ?? 34);
  const reach = (mars.userData.orbitRadius ?? 420) * (1 + (mars.userData.orbitEccentricity ?? 0)) * 1.1;
  const dist = reach / Math.tan(fov / 2);
  /* The camera's right is (cos yaw, 0, -sin yaw): yaw = pi - lamView puts
   * that direction on the left. */
  ctx.refocus("Sun", { shotYaw: Math.PI - lamView, shotPitch: PITCH, shotDistance: dist / offsetLength(PITCH) });
  /* The Sun kept small at this distance (drawing choice). */
  ctx.setSunLook({ scale: 0.35 });
  holdForShot(ctx, S, Math.PI - lamView, PITCH, dist, 0.035);
  orbitRibbon(ctx, earth, "#6fb8ff");
  orbitRibbon(ctx, mars, "#ff8a4a");
  return {
    earth, mars, S, U,
    place(jd) {
      ctx.aim(Math.PI - lamView, PITCH);
      ctx.setZoomDistance(dist / offsetLength(PITCH));
      putAtLongitude(earth, longitudeAt(EARTH, jd));
      putAtLongitude(mars, longitudeAt(MARS, jd));
    },
  };
}

/*
 * A place on the real Mars, found: the planet turned about its axis so the
 * place faces the Sun (lit, and for a polar place tipped toward it), a ring
 * round it, and the camera brought round to look down on it. hold() keeps
 * it there against the site's own spin.
 */
function marsPlace(ctx, { lat, lon, reach, colour = "#ffd27f", zoom = 0.8 }) {
  const mars = ctx.host;
  const sunDir = ctx.sunDir.clone();
  ctx.turnHostToward(lat, lon, sunDir, 1);
  mars.updateMatrixWorld(true);
  const ring = placeRing(ctx, mars, lat, lon, reach, colour);
  const n = ring.centre().sub(mars.getWorldPosition(new THREE.Vector3())).normalize();
  const view = n.clone().addScaledVector(sunDir, 0.3).normalize();
  const pitch = THREE.MathUtils.clamp(pitchFor(view), -1.1, 1.1);
  ctx.refocus("Mars", { shotYaw: yawFor(view), shotPitch: pitch, shotZoom: zoom });
  holdForShot(ctx, mars.getWorldPosition(new THREE.Vector3()), yawFor(view), pitch, null, 0.03, { within: worldRadius(mars) * 12 * zoom });
  return {
    ring, sunDir,
    hold() {
      ctx.turnHostToward(lat, lon, sunDir, 1);
      ctx.aim(yawFor(view), pitch);
      ctx.setZoom(zoom);
    },
  };
}

export const INNER_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "transit-mercury",
    section: "inner",
    body: "Sun",
    title: "Transit of Mercury",
    place: "The Sun and Mercury",
    kind: "recurring",
    family: "alignment",
    when: "Last Nov 11, 2019 · next Nov 13, 2032",
    often: "about 13 a century",
    timeline: { last: "November 11, 2019", next: "November 13, 2032" },
    detail: "Mercury crosses the face of the Sun as a tiny black dot, taking a few hours from edge to edge",
    frequency: "About 13 or 14 times a century, always in early May or early November. After November 13, 2032 come November 7, 2039 and May 7, 2049.",
    cause: "Mercury passes between Earth and the Sun every 116 days, but its orbit is tilted 7° to Earth's, so it usually slips just above or below the Sun. It can only cross the disc when that happens near one of the two points where its orbit cuts through Earth's, and Earth lines up with those in May and November.",
    note: "The 2019 transit took about five and a half hours. Mercury is only about 1/194 of the Sun's width, too small to see without a telescope, and the Sun must only ever be watched through a proper solar filter.",
    accuracy: "The site's own Sun and Mercury, seen from where Earth would be: Mercury moves along its own orbit across the real Sun. The Sun is resized for this view so the two keep their 2019 proportions, and the path is the 2019 one's distance from the centre; Mercury itself is drawn four times its true size so it shows as more than a pixel. The diagram afterwards is to scale except for the planets' sizes.",
    art: { main: "sun", second: "mercury", fx: "transit" },
    scene(ctx) {
      /* Nov 11, 2019: Mercury 10.0″ across, the Sun 1,937″ (NASA/Espenak,
       * "Transits of Mercury"): 1/194 of the Sun's width. Least distance
       * from the Sun's centre 76″ of its 969″ radius, south (Espenak). */
      const T = transitStage(ctx, "Mercury", { ratio: 194, miss: -76 / 969, enlarge: 4, sunHud: 0.3 });
      if (!T) return { duration: 24, update() {} };
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const orbitRoot = T.planet.userData.orbitGuide?.parent ?? null;
      /* The orbit guides and the belts' bands would cross the Sun. */
      const veil = [orbitRoot, ...sceneObjects(ctx, ["Asteroid populations", "Kuiper Belt population"])].filter(Boolean);
      ctx.setVeil(veil);
      const path = T.arc(0, "#2a1600", 0.75);

      /* Finding it: a ring on the hud round where Mercury is. */
      const finder = H.circle(0.04, { plane: "xy", colour: "#8fd8ff", opacity: 0.95, additive: false });
      const name = H.label(["Mercury", "drawn 4× its size"], { height: 0.038, colour: "#bfe9ff", declutter: false });
      const leader = H.line([[0, 0, 0], [0, 0.01, 0]], { colour: "#8fd8ff", opacity: 0.8, additive: false });
      const clock = H.label(["", ""], { height: 0.049, declutter: false });
      const sunName = H.label(["The Sun", "through a safe solar filter"], { align: "right", height: 0.038, declutter: false });
      [finder, name, clock, sunName].forEach((o) => ctx.fade(o, 0));

      /* Afterwards, on black: why so rare -- from above, to scale (0.42
       * hud units per AU) except for the planets' sizes. */
      const inset = new THREE.Group();
      inset.position.set(-0.42, 0.06, 0);
      hud.add(inset);
      const IK = hudKit(ctx, inset);
      const AU = 0.42;
      IK.sun(0.03, { ...WHITE_SUN, halo: 3, haloOpacity: 0.5 });
      /* Mercury: a 0.387 AU, e 0.2056, perihelion longitude 77.46°; Earth
       * a 1 AU (Standish J2000). */
      IK.orbit(0.387 * AU, 0.2056, { plane: "xy", rotate: 77.46 * DEG, colour: "#c9c0b6", opacity: 0.85 });
      IK.circle(AU, { plane: "xy", colour: "#4f7fbf", opacity: 0.7 });
      /* Mercury's ascending node 48.33° (J2000): its orbit crosses Earth's
       * plane along this line. */
      const nodeAngle = 48.33 * DEG;
      IK.line([[-Math.cos(nodeAngle) * 0.5, -Math.sin(nodeAngle) * 0.5, 0], [Math.cos(nodeAngle) * 0.5, Math.sin(nodeAngle) * 0.5, 0]], { colour: "#ffd27f", opacity: 0.85, dashed: true, dash: 0.02, gap: 0.015 });
      IK.label(["where the two", "orbits cross"], { at: [Math.cos(nodeAngle) * 0.5 + 0.02, Math.sin(nodeAngle) * 0.5 + 0.06, 0], height: 0.035, colour: "#ffd27f", declutter: false });
      /* Earth on Nov 11 is at heliocentric longitude ~49° (the Sun appears
       * at 229°, JPL Horizons). */
      const earthAngle = 49 * DEG;
      const iEarth = IK.ball(0.03, { body: "Earth" });
      iEarth.position.set(Math.cos(earthAngle) * AU, Math.sin(earthAngle) * AU, 0);
      IK.label(["Earth, Nov 11"], { at: [iEarth.position.x + 0.05, iEarth.position.y + 0.05, 0], align: "left", height: 0.024, declutter: false });
      IK.line([[0, 0, 0], iEarth.position.clone()], { colour: "#ffffff", opacity: 0.4 });
      const iMercury = IK.ball(0.02, { body: "Mercury" });
      const mercuryAt = (angle) => {
        const nu = angle - 77.46 * DEG;
        const r = (0.387 * (1 - 0.2056 ** 2)) / (1 + 0.2056 * Math.cos(nu));
        return new THREE.Vector3(Math.cos(angle) * r * AU, Math.sin(angle) * r * AU, 0);
      };
      const insetTitle = IK.label(["Seen from above", "Mercury's orbit is tilted 7° to ours"], { at: [0, 0.6, 0], height: 0.046, declutter: false });
      const next = H.label(["Next: November 13, 2032", "then Nov 7, 2039 · May 7, 2049"], { at: [-0.42, -0.62, 0], height: 0.052, colour: "#ffe3a8", declutter: false });
      ctx.fade(inset, 0);
      ctx.fade(next, 0);

      ctx.tell([
        { at: 0, label: "November 11, 2019", text: "The real Sun, seen from where Earth is: Mercury is about to pass exactly in front of it." },
        { at: 0.08, label: "A tiny black dot", text: "First contact at 12:35 UT. Mercury is 1/194 of the Sun's width: only a filtered telescope shows it." },
        { at: 0.64, label: "Why so rare", text: "Mercury's orbit is tilted 7°. It crosses the disc only when it passes us near the line where the orbits cross — in May or November." },
        { at: 0.84, label: "Next time", text: "About thirteen a century. The next transit: November 13, 2032." },
      ]);

      /* Contacts I and IV, 12:35 and 18:04 UT (Espenak). */
      const IN = 12 * 60 + 35;
      const OUT = 18 * 60 + 4;
      const cut = cutter(ctx, veil);
      return {
        /* The runner fits it to her line (owner, round 84: the event ends
         * with the speech). */
        duration: 24,
        update(p) {
          /* The real Mercury along its orbit, 0.02-0.62. */
          const x = lerp(-1.25, 1.25, span(p, 0.02, 0.62));
          T.put(x);
          T.keep();
          const m = T.measure();
          const real = p < 0.63;
          finder.position.set(m.px, m.py, 0);
          finder.scale.setScalar(1 + 0.15 * Math.sin(ctx.t * 4));
          ctx.fade(finder, real ? smooth(p, 0.0, 0.03) : 0);
          /* The name above the Sun's limb (a pale label cannot be read on
           * the white disc), with a line down to the planet. */
          name.position.set(m.px, m.cy + m.sr + 0.1, 0);
          ctx.setLine(leader, [[m.px, m.cy + m.sr + 0.06, 0], [m.px, m.py + 0.045, 0]]);
          ctx.fade(name, real ? smooth(p, 0.01, 0.04) : 0);
          ctx.fade(leader, real ? smooth(p, 0.01, 0.04) * 0.8 : 0);
          ctx.fade(path, real ? smooth(p, 0.02, 0.06) : 0);
          sunName.position.set(m.cx - m.sr - 0.05, m.cy + m.sr * 0.75, 0);
          ctx.fade(sunName, real ? smooth(p, 0.0, 0.04) * (1 - smooth(p, 0.2, 0.25)) : 0);
          const f = transitFraction(m, 1 / 194);
          const minutes = lerp(IN, OUT, clamp01(f));
          const since = minutes - IN;
          clock.position.set(m.cx, m.cy - m.sr - 0.12, 0);
          clock.userData.draw([
            `Nov 11, 2019 · ${clockTime(f < 0 ? IN + f * (OUT - IN) : f > 1 ? OUT + (f - 1) * (OUT - IN) : minutes)} UT`,
            f < 0 ? "before first contact" : f > 1 ? "transit over: 5 h 29 min" : `${Math.floor(since / 60)} h ${String(Math.round(since % 60)).padStart(2, "0")} min on the disc`,
          ]);
          ctx.fade(clock, real ? smooth(p, 0.01, 0.04) : 0);

          /* On black: the view from above. */
          cut(p > 0.63);
          ctx.fade(inset, smooth(p, 0.64, 0.68));
          const a = earthAngle - 0.9 * (1 - easeInOut(span(p, 0.66, 0.8)));
          iMercury.position.copy(mercuryAt(a));
          ctx.fade(insetTitle, smooth(p, 0.66, 0.7));
          ctx.fade(next, smooth(p, 0.84, 0.88));
          iEarth.rotation.y = ctx.t * 0.3;
        },
        dispose() { T.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "transit-venus",
    section: "inner",
    body: "Sun",
    title: "Transit of Venus",
    place: "The Sun and Venus",
    kind: "recorded",
    family: "alignment",
    when: "June 5–6, 2012 · next Dec 10–11, 2117",
    often: "pairs, 8 years apart, over a century between",
    timeline: { last: "June 5–6, 2012", next: "December 10–11, 2117" },
    detail: "Venus crossed the Sun as a round black silhouette in 2012; the next crossing is in December 2117",
    frequency: "In pairs eight years apart, the pairs separated by 121.5 and 105.5 years in turn: 1631 and 1639, 1761 and 1769, 1874 and 1882, 2004 and 2012, then 2117 and 2125.",
    cause: "Venus's orbit is tilted 3.4° to Earth's, so at most passes between Earth and the Sun it misses the disc above or below. Only when a pass falls close to where the two orbits cross — in early June or early December — does it cross the Sun's face.",
    note: "In 1761 and 1769 expeditions, James Cook's among them, timed the transit from distant corners of the world. Venus's path shifts a little with the observer's position, and comparing the timings gave the first good measurement of the Sun's distance.",
    accuracy: "The site's own Sun and Venus, seen from where Earth would be: Venus moves along its own orbit across the real Sun. The Sun is resized for this view so the two keep their true 2012 proportions (Venus 1/32.6 of the Sun's width), and the path is 2012's distance from the centre. The side-on diagram is not to scale, and the northern and southern paths are drawn about five times farther apart than they really were.",
    art: { main: "sun", second: "venus", fx: "transit" },
    scene(ctx) {
      /* June 2012: Venus 58″ across, the Sun 1,891″ (NASA/Espenak,
       * "Transits of Venus"): 1/32.6 of its width -- to scale. Least
       * distance from centre 554″ of a 946″ radius, north (Espenak). */
      const T = transitStage(ctx, "Venus", { ratio: 32.6, miss: 554 / 946, sunHud: 0.3 });
      if (!T) return { duration: 24, update() {} };
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const orbitRoot = T.planet.userData.orbitGuide?.parent ?? null;
      /* The orbit guides and the belts' bands would cross the Sun. */
      const veil = [orbitRoot, ...sceneObjects(ctx, ["Asteroid populations", "Kuiper Belt population"])].filter(Boolean);
      ctx.setVeil(veil);
      /* Parallax: far-north and far-south observers' paths, 0.1 Sun radii
       * either side -- about 5x the real ~20″ (drawing choice, said in
       * accuracy). North observers see Venus lower on the disc. */
      const path = T.arc(0, "#2a1600", 0.7);
      const northPath = T.arc(-0.1, "#1f5fc0", 0.95);
      const southPath = T.arc(0.1, "#c01f45", 0.95);

      const finder = H.circle(0.045, { plane: "xy", colour: "#ffd27f", opacity: 0.95, additive: false });
      const name = H.label(["Venus", "to scale"], { height: 0.038, colour: "#ffe3a8", declutter: false });
      const leader = H.line([[0, 0, 0], [0, 0.01, 0]], { colour: "#ffd27f", opacity: 0.8, additive: false });
      const clock = H.label(["", ""], { height: 0.049, declutter: false });
      const northLabel = H.label(["seen from the far north"], { align: "right", height: 0.024, colour: "#9fc4ff", declutter: false });
      const southLabel = H.label(["seen from the far south"], { align: "right", height: 0.024, colour: "#ffa0b4", declutter: false });
      const northDot = H.disc(0.012, { colour: "#1f5fc0" });
      const southDot = H.disc(0.012, { colour: "#c01f45" });
      [finder, name, clock, northLabel, southLabel, northDot, southDot].forEach((o) => ctx.fade(o, 0));

      /* On black: why observers far apart see different paths. Earth, two
       * observers, Venus, and the Sun's face, side on (not to scale). */
      const side = new THREE.Group();
      hud.add(side);
      const SK = hudKit(ctx, side);
      const E0 = new THREE.Vector3(-1.0, 0.02, 0);
      const ER = 0.13;
      const earth = SK.ball(ER, { body: "Earth" });
      earth.position.copy(E0);
      const V0 = new THREE.Vector3(-0.45, 0.02, 0);
      const venusBall = SK.ball(0.028, { body: "Venus" });
      venusBall.position.copy(V0);
      /* The Sun's face, a plain white disc (drawing). */
      const SC = new THREE.Vector3(0.36, 0.02, -0.05);
      SK.glow("#fff1dc", 0.95, { opacity: 0.35 }).position.copy(SC);
      SK.disc(0.3, { colour: "#fff6e8" }).position.copy(SC);
      const nObs = E0.clone().add(new THREE.Vector3(0, ER, 0));
      const sObs = E0.clone().add(new THREE.Vector3(0, -ER, 0));
      const faceX = 0.1;
      const hit = (o) => o.clone().add(V0.clone().sub(o).multiplyScalar((faceX - o.x) / (V0.x - o.x)));
      const nHit = hit(nObs);
      const sHit = hit(sObs);
      const nSight = SK.line([nObs, nHit], { colour: "#7fb0ff", opacity: 1 });
      const sSight = SK.line([sObs, sHit], { colour: "#ff8aa0", opacity: 1 });
      SK.glow("#7fb0ff", 0.06, { opacity: 1 }).position.copy(nObs);
      SK.glow("#ff8aa0", 0.06, { opacity: 1 }).position.copy(sObs);
      const nMark = SK.disc(0.02, { colour: "#1f5fc0" });
      nMark.position.copy(nHit).setZ(0.02);
      const sMark = SK.disc(0.02, { colour: "#c01f45" });
      sMark.position.copy(sHit).setZ(0.02);
      SK.label(["far north"], { at: [nObs.x, nObs.y + 0.07, 0], height: 0.026, colour: "#9fc4ff", declutter: false });
      SK.label(["far south"], { at: [sObs.x, sObs.y - 0.08, 0], height: 0.026, colour: "#ffa0b4", declutter: false });
      SK.label(["Earth"], { at: [E0.x, E0.y - 0.27, 0], height: 0.028, declutter: false });
      SK.label(["Venus"], { at: [V0.x, V0.y + 0.08, 0], height: 0.028, colour: "#ffe3a8", declutter: false });
      SK.label(["the Sun"], { at: [0.1, 0.4, 0], height: 0.028, declutter: false });
      SK.label(["The northern observer sees Venus lower on the Sun,", "the southern one higher (much exaggerated here)"], { at: [-0.45, -0.42, 0], height: 0.041, colour: "#ffe3a8", declutter: false });
      SK.label(["Why the paths differ"], { at: [-0.5, 0.56, 0], height: 0.036, declutter: false });
      ctx.fade(side, 0);

      /* The pairs (Espenak, "Six Millennium Catalog of Venus Transits"),
       * along the bottom, clear of the card. */
      const PAIRS = [[1631, 1639], [1761, 1769], [1874, 1882], [2004, 2012], [2117, 2125]];
      const timeline = new THREE.Group();
      hud.add(timeline);
      const TK = hudKit(ctx, timeline);
      const x0 = -1.0;
      const x1 = 0.98;
      const yearX = (y) => lerp(x0, x1, (y - 1600) / (2150 - 1600));
      const ty = -0.78;
      panel(TK, 2.1, 0.3, { colour: "#000000", opacity: 0.55, order: 18 }).position.set(-0.01, ty, -0.02);
      TK.line([[x0, ty, 0], [x1, ty, 0]], { colour: "#9fb3c8", opacity: 0.7 });
      const pairLabels = PAIRS.map(([a, b], i) => {
        [a, b].forEach((y) => TK.line([[yearX(y), ty - 0.035, 0], [yearX(y), ty + 0.035, 0]], { colour: y === 2012 ? "#ffd27f" : y === 2117 ? "#8fd8ff" : "#e8f1ff", opacity: 0.95 }));
        return TK.label([`${a} · ${b}`], { at: [yearX((a + b) / 2), ty + (i % 2 ? -0.085 : 0.075), 0], height: 0.026, colour: i === 3 ? "#ffd27f" : i === 4 ? "#8fd8ff" : "#e8f1ff", declutter: false });
      });
      ctx.fade(timeline, 0);

      ctx.tell([
        { at: 0, label: "June 5–6, 2012", text: "The real Sun, seen from where Earth is. Venus, on its own orbit, is about to cross its face — a round black silhouette, to scale." },
        { at: 0.1, label: "Six hours forty", text: "First contact 22:09 UT on June 5; last contact 04:49 UT on June 6." },
        { at: 0.46, label: "Measuring the Solar System", text: "Observers far apart on Earth see Venus cross on slightly different paths. In 1761 and 1769 expeditions timed them to find the Sun's distance." },
        { at: 0.8, label: "Pairs, a century apart", text: "Transits come in pairs eight years apart, then over a century of none. Next: December 10–11, 2117." },
      ]);

      /* Contacts I and IV: 22:09 UT June 5 to 04:49 UT June 6 (Espenak). */
      const IN = 22 * 60 + 9;
      const OUT = IN + 6 * 60 + 40;
      const cut = cutter(ctx, veil);
      return {
        duration: 24,
        update(p) {
          /* First crossing 0.02-0.45; on black 0.47-0.68; then again with
           * the northern and southern paths 0.7-0.95. */
          const second = p >= 0.68;
          const x = second ? lerp(-1.1, 1.1, span(p, 0.7, 0.95)) : lerp(-1.25, 1.25, span(p, 0.02, 0.45));
          T.put(x);
          T.keep();
          const m = T.measure();
          const dark = p > 0.46 && p < 0.69;
          cut(dark);
          const real = !dark;
          finder.position.set(m.px, m.py, 0);
          finder.scale.setScalar(1 + 0.12 * Math.sin(ctx.t * 4));
          ctx.fade(finder, real ? smooth(p, 0.0, 0.03) * (second ? 0.5 : 1) : 0);
          name.position.set(m.px, m.cy + m.sr + 0.1, 0);
          ctx.setLine(leader, [[m.px, m.cy + m.sr + 0.06, 0], [m.px, m.py + 0.05, 0]]);
          ctx.fade(name, real && !second ? smooth(p, 0.01, 0.04) : 0);
          ctx.fade(leader, real && !second ? smooth(p, 0.01, 0.04) * 0.8 : 0);
          ctx.fade(path, real ? smooth(p, 0.02, 0.06) : 0);
          const f = transitFraction(m, 1 / 32.6);
          const minutes = lerp(IN, OUT, clamp01(f));
          const since = minutes - IN;
          const day = minutes >= 1440 ? "June 6" : "June 5";
          clock.position.set(m.cx, m.cy - m.sr - 0.12, 0);
          clock.userData.draw([
            `${day}, 2012 · ${clockTime(f < 0 ? IN + f * (OUT - IN) : f > 1 ? OUT + (f - 1) * (OUT - IN) : minutes)} UT`,
            f < 0 ? "before first contact" : f > 1 ? "transit over: 6 h 40 min" : `${Math.floor(since / 60)} h ${String(Math.round(since % 60)).padStart(2, "0")} min on the disc`,
          ]);
          ctx.fade(clock, real && !second ? smooth(p, 0.01, 0.04) : 0);

          /* The side-on diagram. */
          ctx.fade(side, dark ? smooth(p, 0.48, 0.51) : 0);
          ctx.fade(nSight, smooth(p, 0.52, 0.55));
          ctx.fade(sSight, smooth(p, 0.56, 0.59));
          ctx.fade(nMark, smooth(p, 0.53, 0.56));
          ctx.fade(sMark, smooth(p, 0.57, 0.6));
          earth.rotation.y = ctx.t * 0.2;

          /* The two paths on the real Sun, and where each observer sees
           * Venus as it crosses. */
          const both = second ? smooth(p, 0.69, 0.72) : 0;
          ctx.fade(northPath, both);
          ctx.fade(southPath, both);
          const shift = 0.1 * m.sr;
          northDot.position.set(m.px, m.py - shift, 0);
          southDot.position.set(m.px, m.py + shift, 0);
          const inside = (y) => Math.hypot(m.x, m.y + y) < 1;
          ctx.fade(northDot, both * (inside(-0.1) ? 1 : 0));
          ctx.fade(southDot, both * (inside(0.1) ? 1 : 0));
          const yN = m.cy + (T.theta / T.aSun - 0.1) * m.sr;
          const yS = m.cy + (T.theta / T.aSun + 0.1) * m.sr;
          const left = m.cx - Math.sqrt(Math.max(0, 1 - ((yN - m.cy) / m.sr) ** 2)) * m.sr - 0.04;
          northLabel.position.set(left, yN - 0.03, 0);
          southLabel.position.set(left, yS + 0.03, 0);
          ctx.fade(northLabel, both * (1 - smooth(p, 0.86, 0.9)));
          ctx.fade(southLabel, both * (1 - smooth(p, 0.86, 0.9)));

          ctx.fade(timeline, smooth(p, 0.8, 0.84));
          pairLabels.forEach((l, i) => ctx.fade(l, smooth(p, 0.8 + i * 0.025, 0.84 + i * 0.025)));
        },
        dispose() { T.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "mercury-double-sunrise",
    section: "inner",
    body: "Sun",
    title: "Mercury's double sunrise",
    place: "Mercury",
    kind: "recurring",
    family: "orbit",
    often: "every 2 Mercury years",
    detail: "On parts of Mercury the Sun rises, stops, sinks back below the horizon, then rises again for good",
    frequency: "Near every perihelion, at the two longitudes where the Sun is on the horizon then. A day on Mercury lasts two of its years (176 Earth days), so each of those places sees it once every 176 days.",
    cause: "Mercury spins three times for every two orbits: once in 58.6 days, against an 88-day year. Its orbit is very eccentric, and for about eight days around perihelion its orbital speed around the Sun outruns its spin. While that lasts, the Sun drifts backwards across the sky.",
    note: "Elsewhere on Mercury the same backwards drift makes the Sun stop and loop in the middle of the sky, or set twice. At perihelion the Sun looks more than three times as wide as it does from Earth.",
    accuracy: "The site's own Mercury going round the site's Sun on its own orbit, which has Mercury's real eccentricity, with a dot every two days; beside it, on the same clock, the sky seen from Mercury's equator, computed from its real spin, orbit and eccentricity for an observer 90° from the hot poles (the Sun's size and its heights there to one scale). The clock runs faster far from perihelion and slower near it.",
    art: { main: "mercury", second: "sun", fx: "loop" },
    scene(ctx) {
      /* Sidereal rotation 58.646 d, orbit 87.969 d, e 0.2056 (NASA). */
      const ROT = 58.646;
      const YEAR = 87.969;
      const E = 0.2056;
      /* The Sun's hour angle from the horizon, degrees, t days from
       * perihelion: spin minus orbital motion. The offset of -0.6° puts the
       * observer where the Sun half-rises, sinks and rises again (drawing
       * choice within the band of longitudes where it happens). */
      const height = (t) => (TAU * t / ROT - trueAnomaly(TAU * t / YEAR, E)) / DEG - 0.6;
      /* Orbital angular rate, degrees per day: n (1 + e cos v)² / (1 - e²)^1.5. */
      const orbitRate = (t) => {
        const v = trueAnomaly(TAU * t / YEAR, E);
        return (360 / YEAR) * ((1 + E * Math.cos(v)) ** 2) / ((1 - E * E) ** 1.5);
      };
      const spinRate = 360 / ROT;
      /* The Sun's angular radius from Mercury at perihelion: 0.2665° at 1 AU
       * (IAU solar radius) / 0.3075 AU = 0.87°. */
      const SUN_RADIUS_DEG = 0.2665 / 0.3075;

      const sunBody = ctx.host;
      const mercury = ctx.findBody("Mercury");
      if (!mercury) return { duration: 24, update() {} };
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const U = ctx.unit;
      const R0 = mercury.rotation.y;

      /*
       * Round 84 (Prompts.md: "show the animation side by side ... so that
       * everything is in sync"): one clock for both. On the right, the real
       * Mercury round the real Sun from high above, perihelion toward the
       * top of the screen; on the left, the sky from Mercury's equator on
       * the same day. The camera's horizontal offset is (sin yaw, cos yaw),
       * so the screen's "up" is the opposite way: yaw = atan2(-cos L,
       * -sin L) puts longitude L at the top.
       */
      const lamPeri = mercury.userData.orbitRotation ?? 0;
      const aphelion = (mercury.userData.orbitRadius ?? 147) * (1 + E);
      const PITCH = 1.1;
      const YAW = Math.atan2(-Math.cos(lamPeri), -Math.sin(lamPeri));
      const fovS = THREE.MathUtils.degToRad(sunBody.userData?.focusFov ?? 34);
      /* Aphelion about 0.42 of the half-height from the Sun (drawing choice). */
      const span0 = aphelion / (0.42 * Math.tan(fovS / 2));
      ctx.refocus("Sun", { shotYaw: YAW, shotPitch: PITCH, shotDistance: span0 / offsetLength(PITCH) });
      /* The site's Sun shrunk to a small disc so it does not hide the near
       * side of the orbit (main.js setSunLook). Drawing choice. */
      ctx.setSunLook({ scale: 0.3 });
      holdForShot(ctx, S, YAW, PITCH, span0, 0.035);
      const ribbon = orbitRibbon(ctx, mercury, "#e6d3b0");

      /* A dot every two days. */
      const dotAt = (t, out = new THREE.Vector3()) => {
        const d = mercury.userData;
        setOrbitPosition(out, d.orbitRadius, d.orbitEccentricity ?? 0, (t / YEAR) * TAU, d.orbitInclination ?? 0, d.orbitRotation ?? 0);
        return out.applyMatrix4(mercury.parent.matrixWorld).sub(S).divideScalar(U);
      };
      /* (soft glows, sized in the stage's units: a bright core a few
       * pixels across) */
      const dotSize = (0.05 * span0 * Math.tan(fovS / 2)) / U;
      const T0 = -40;
      const DOTS = 36;
      const dots = Array.from({ length: DOTS }, (_, i) => {
        const g = ctx.glow("#ffd27f", dotSize, { opacity: 1 });
        g.position.copy(dotAt(T0 + i * 2));
        ctx.fade(g, 0);
        return g;
      });

      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const finder = H.circle(0.03, { plane: "xy", colour: "#ffd27f", opacity: 0.95, additive: false });
      const name = H.label(["Mercury"], { height: 0.028, colour: "#ffe3a8", declutter: false });
      const periLabel = H.label(["Perihelion", "46 million km from the Sun"], { height: 0.036, declutter: false });
      const readout = H.label(["", "", ""], { at: [0.0, 0.62, 0], height: 0.05, declutter: false });
      [finder, name, periLabel, readout].forEach((o) => ctx.fade(o, 0));

      /* ---- left: the sky from Mercury's equator, on a dark panel */
      const PX = -0.78;
      panel(H, 0.68, 1.12, { colour: "#000000", opacity: 0.86, order: 16 }).position.set(PX, 0.0, -0.03);
      H.line([[PX - 0.34, -0.56, 0], [PX + 0.34, -0.56, 0], [PX + 0.34, 0.56, 0], [PX - 0.34, 0.56, 0], [PX - 0.34, -0.56, 0]], { colour: "#9fb3c8", opacity: 0.5, additive: false });
      const D = new THREE.Group();
      const DS = 0.48;
      D.scale.setScalar(DS);
      D.position.set(PX + 0.415 * DS, -0.02, 0);
      hud.add(D);
      const K = hudKit(ctx, D);
      const KS = 0.17;
      const horizon = -0.14;
      const sunX = -0.42;
      const sunDisc = K.sun(SUN_RADIUS_DEG * KS, { ...WHITE_SUN, halo: 1.7, haloOpacity: 0.35, granule: 16 });
      /* Mercury's cratered horizon, in front of the Sun. */
      const r = rng(5);
      const groundPts = [[-1.08, -0.9]];
      for (let i = 0; i <= 40; i += 1) {
        const x = lerp(-1.08, 0.25, i / 40);
        const bump = 0.012 * Math.sin(i * 1.7) + 0.02 * Math.exp(-(((x + 0.85) / 0.1) ** 2)) + 0.014 * Math.exp(-(((x - 0.05) / 0.12) ** 2)) + r() * 0.004;
        groundPts.push([x, horizon + bump]);
      }
      groundPts.push([0.25, -0.9]);
      solid(K, groundPts, { colour: "#2e2b28", depthTest: false });
      onTop(K.line(groundPts.slice(1, -1).map(([x, y]) => [x, y, 0]), { colour: "#8a8279", opacity: 0.7, additive: false }), 29);
      K.line([[sunX, horizon, -0.01], [sunX, horizon + 4.5 * KS, -0.01]], { colour: "#ffe3a8", opacity: 0.25, dashed: true, dash: 0.02, gap: 0.02 });
      const status = H.label(["", ""], { at: [PX, -0.38, 0.05], height: 0.044, declutter: false });
      H.label(["From Mercury's equator", "the same day"], { at: [PX, 0.47, 0], height: 0.04, colour: "#c8d6e6", declutter: false });

      /* The graph, along the bottom (clear of the card): the Sun's height
       * against days from perihelion. */
      const G0 = -10;
      const G1 = 11;
      const gx0 = -0.98;
      const gx1 = 0.95;
      const gy = -0.76;
      const gk = 0.045;
      const gX = (t) => lerp(gx0, gx1, (t - G0) / (G1 - G0));
      const gY = (h) => gy + h * gk;
      panel(H, gx1 - gx0 + 0.08, 0.3, { colour: "#000000", opacity: 0.6, order: 17 }).position.set((gx0 + gx1) / 2, gy + 0.01, -0.02);
      H.line([[gx0, gY(0), 0], [gx1, gY(0), 0]], { colour: "#9fb3c8", opacity: 0.55, dashed: true, dash: 0.015, gap: 0.012 });
      H.line([[gX(0), gY(-2.6), 0], [gX(0), gY(2.6), 0]], { colour: "#ffd27f", opacity: 0.45 });
      H.label(["perihelion"], { at: [gX(0) + 0.01, gY(-2.6) - 0.02, 0], align: "left", height: 0.022, colour: "#ffd27f", declutter: false });
      H.label(["Height of the Sun, days −10 to +11"], { at: [gx0, gY(2.6) + 0.025, 0], align: "left", height: 0.022, colour: "#c8d6e6", declutter: false });
      H.label(["horizon"], { at: [gx1, gY(0) + 0.025, 0], align: "right", height: 0.02, colour: "#9fb3c8", declutter: false });
      const curvePts = [];
      for (let i = 0; i <= 220; i += 1) {
        const t = lerp(G0, G1, i / 220);
        curvePts.push(new THREE.Vector3(gX(t), gY(height(t)), 0));
      }
      const curve = H.line(curvePts.slice(0, 2), { colour: "#ffe3a8", opacity: 0.95 });
      const gdot = H.glow("#fff3c4", 0.05, { opacity: 1 });

      ctx.tell([
        { at: 0, label: "Two views, one clock", text: "Right: the real Mercury round the real Sun, a dot every two days. Left: the sky from Mercury's equator, on the same day." },
        { at: 0.22, label: "Sunrise", text: "Mercury nears perihelion and speeds up. On its equator the Sun begins to rise." },
        { at: 0.39, label: "It stops, and sets", text: "Four days before perihelion the Sun halts, half risen, and sinks back below the horizon." },
        { at: 0.5, label: "The orbit outruns the spin", text: "Near perihelion Mercury goes round the Sun faster than it spins — the dots spread out — so the Sun runs backwards." },
        { at: 0.63, label: "Up for good", text: "Then the spin wins again and the Sun rises for good. It will not set for another 88 Earth days." },
      ]);

      /* The clock: quick on the way in, slow through days -10 to +11,
       * quick again after. */
      const dayAt = (p) => {
        const u = span(p, 0.03, 0.97);
        if (u < 0.2) return lerp(T0, G0, u / 0.2);
        if (u < 0.85) return lerp(G0, G1, (u - 0.2) / 0.65);
        return lerp(G1, 30, (u - 0.85) / 0.15);
      };
      const vis = (h) => h > -SUN_RADIUS_DEG;
      const w = new THREE.Vector3();
      const pt = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          ctx.aim(YAW, PITCH);
          ctx.setZoomDistance(span0 / offsetLength(PITCH));
          const t = dayAt(p);
          /* ---- the real Mercury */
          putAtMean(mercury, (t / YEAR) * TAU);
          mercury.rotation.y = R0 + (t / ROT) * TAU;
          const shown = Math.floor((t - T0) / 2 + 1e-6);
          dots.forEach((g, i) => ctx.fade(g, i <= shown && p > 0.02 ? 1 : 0));
          mercury.getWorldPosition(w);
          const h = toHud(ctx, w);
          finder.position.set(h.x, h.y, 0);
          name.position.set(h.x + 0.05, h.y + 0.05, 0);
          pin(ctx, periLabel, dotAt(0, pt).multiplyScalar(U).add(S), 0, 0.1);
          const on = smooth(p, 0.0, 0.03);
          [finder, name, periLabel, readout].forEach((o) => ctx.fade(o, on));
          if (ribbon) ctx.fade(ribbon, 1);
          const or = orbitRate(t);
          readout.userData.draw([
            `Day ${t >= 0 ? "+" : ""}${Math.round(t)} from perihelion`,
            `Round the Sun: ${or.toFixed(2)}° a day`,
            or > spinRate ? `Spin: ${spinRate.toFixed(2)}° a day — the orbit is faster!` : `Spin: ${spinRate.toFixed(2)}° a day`,
          ]);

          /* ---- the sky from the equator, the same day */
          const hh = height(t);
          sunDisc.position.set(sunX, horizon + Math.min(hh, 4.6) * KS, 0);
          sunDisc.visible = hh > -3 && hh < 4.6 + SUN_RADIUS_DEG;
          sunDisc.rotation.y = ctx.t * 0.05;
          const n = Math.max(2, Math.round(220 * clamp01((t - G0) / (G1 - G0))) + 1);
          H.setLine(curve, curvePts.slice(0, n));
          const tg = THREE.MathUtils.clamp(t, G0, G1);
          gdot.position.set(gX(tg), gY(height(tg)), 0.01);
          const dh = height(t + 0.05) - height(t - 0.05);
          let phase;
          if (!vis(hh)) phase = t < 0 ? "before sunrise" : "set again";
          else if (Math.abs(dh) < 0.004) phase = "Sun stands still";
          else if (dh > 0) phase = t < -4 ? "sunrise" : "rising for good";
          else phase = "sinking back";
          status.userData.draw([phase, `day ${t >= 0 ? "+" : ""}${t.toFixed(1)}`]);
        },
        dispose() { ctx.setSunLook(null); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "venus-superrotation",
    section: "inner",
    title: "Venus's super-rotating winds",
    place: "Venus",
    kind: "ongoing",
    family: "planetary",
    often: "always",
    detail: "The ground turns once in 243 days, but the cloud tops race all the way round in about four",
    frequency: "Continuous, and as far as anyone can tell permanent: every spacecraft since the 1960s has seen it.",
    cause: "Venus's surface turns slowly backwards, once in 243 days — 1.8 m/s at the equator. The atmosphere does not follow: around the cloud tops, about 70 km up, winds of roughly 100 m/s carry the clouds round the planet in about four days, sixty times faster than the ground. The Sun's heating drives tides and waves in the atmosphere that are thought to pump the upper layers faster, but the full balance is still being worked out.",
    note: "Near the ground the air barely moves, a metre or so per second — but the atmosphere there is 90 times as dense as Earth's, so even a gentle wind pushes hard.",
    accuracy: "The two rates are the real ones (243 days and about 4 days), so the clouds go round sixty times as fast as the ground. The cloud deck is drawn thicker than it is, and the wind in fact varies with latitude.",
    art: { main: "venus", fx: "storm" },
    scene(ctx) {
      /* Sidereal rotation 243.025 d retrograde (NASA); cloud tops about 4
       * days (ESA Venus Express; Sánchez-Lavega et al. 2008). */
      const ROT = 243.025;
      const CLOUD = 4;
      /* layout */
      const R = 0.4;
      const C = new THREE.Vector3(-0.22, 0.06, 0);
      const ground = ctx.ball(R, { body: "Venus surface", rim: 0.2, rimColour: "#ffcf8a" });
      ground.position.copy(C);
      const clouds = ctx.ball(R * 1.06, { body: "Venus", opacity: 0.999, rim: 0.5, rimColour: "#fff0c8" });
      clouds.position.copy(C);
      const flag = ctx.ball(0.016, { colour: "#ff5a5a", emissive: "#600000", parent: ground });
      flag.position.copy(ctx.onSphere(R * 1.005, 8, 0));
      const puff = ctx.ball(0.018, { colour: "#bfefff", emissive: "#2a6080", parent: clouds });
      puff.position.copy(ctx.onSphere(R * 1.065, 4, 0));
      /* The wind ring round the equator, tilted toward us. */
      const ringGroup = new THREE.Group();
      ringGroup.position.copy(C);
      ringGroup.rotation.x = 0.28;
      ctx.add(ringGroup);
      ctx.circle(R * 1.22, { colour: "#bfefff", opacity: 0.35, parent: ringGroup });
      const runners = Array.from({ length: 6 }, () => ctx.glow("#bfefff", 0.05, { opacity: 0.9, parent: ringGroup }));

      /* Lap counters. */
      const bx = 0.38;
      const bw = 0.66;
      const bars = [
        { y: 0.46, colour: "#bfefff", title: "Cloud tops, 70 km up" },
        { y: 0.2, colour: "#ff8a8a", title: "The ground" },
      ].map((b) => {
        ctx.line([[bx, b.y, 0], [bx + bw, b.y, 0]], { colour: "#3a4a5a", opacity: 0.8, additive: false });
        const line = ctx.line([[bx, b.y, 0], [bx + 0.001, b.y, 0]], { colour: b.colour, opacity: 1, additive: false });
        const label = ctx.label(["", ""], { at: [bx, b.y + 0.08, 0], align: "left", height: 0.036, colour: b.colour });
        return { ...b, line, label };
      });
      const days = ctx.label([""], { at: [C.x, C.y - R - 0.16, 0], height: 0.044 });
      const ratio = ctx.label(["60 times faster than the ground", "about 100 m/s against 1.8 m/s"], { at: [bx + bw / 2, -0.06, 0], height: 0.04, colour: "#ffe3a8" });

      ctx.tell([
        { at: 0, label: "The slow planet", text: "Venus's surface turns once every 243 days — backwards, at walking pace: 1.8 m/s at the equator." },
        { at: 0.22, label: "The racing clouds", text: "But the cloud tops, about 70 km up, circle the whole planet in about four days." },
        { at: 0.52, label: "Super-rotation", text: "Winds of about 100 m/s — 360 km/h — blowing the same way the planet turns, sixty times faster." },
        { at: 0.78, label: "Still a puzzle", text: "The Sun's heat drives tides and waves in the air that keep it spinning faster. Exactly how is still being worked out." },
      ]);
      return {
        duration: 20,
        update(p) {
          const d = 12 * span(p, 0.03, 0.95);
          /* Retrograde: both turn the "backwards" way (negative about y). */
          const groundTurns = d / ROT;
          const cloudLaps = d / CLOUD;
          ground.rotation.y = -groundTurns * TAU;
          clouds.rotation.y = -cloudLaps * TAU;
          const c = smooth(p, 0.2, 0.3);
          ctx.fade(clouds, 0.88 * c);
          ctx.fade(ringGroup, c);
          runners.forEach((g, i) => {
            const a = -cloudLaps * TAU + (i / runners.length) * TAU + Math.PI / 2;
            g.position.set(Math.cos(a) * R * 1.22, 0, Math.sin(a) * R * 1.22);
          });
          days.userData.draw([`Day ${d.toFixed(1)}`]);
          const lapsFrac = Math.min(1, cloudLaps / 3);
          ctx.setLine(bars[0].line, [[bx, bars[0].y, 0], [bx + Math.max(0.001, bw * lapsFrac), bars[0].y, 0]]);
          ctx.setLine(bars[1].line, [[bx, bars[1].y, 0], [bx + Math.max(0.001, bw * Math.min(1, groundTurns / 3)), bars[1].y, 0]]);
          bars[0].label.userData.draw([bars[0].title, `${cloudLaps.toFixed(2)} laps`]);
          bars[1].label.userData.draw([bars[1].title, `${groundTurns.toFixed(3)} turns`]);
          ctx.fade(bars[0].line, c);
          ctx.fade(bars[0].label, c);
          ctx.fade(ratio, smooth(p, 0.52, 0.58));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 5 */
  event({
    id: "venus-volcano",
    section: "inner",
    body: "Venus",
    title: "Venus is still volcanic",
    place: "Venus · Maat Mons",
    kind: "recorded",
    family: "geology",
    when: "Feb–Oct 1991 · found in 2023",
    often: "seen once, 1991",
    timeline: { last: "1991 (found 2023)", next: "VERITAS and EnVision, 2030s" },
    detail: "Two radar images taken eight months apart in 1991 show a volcanic vent on Maat Mons growing and filling with lava",
    frequency: "Seen once, in Magellan radar images from February and October 1991; spotted in 2023. Venus probably erupts often, but only a handful of spacecraft have ever mapped it.",
    cause: "Venus is nearly Earth's size and still hot inside, so it was expected to be volcanic — but no eruption had ever been seen. Robert Herrick and Scott Hensley compared old Magellan images by eye and found a vent on the north flank of Maat Mons whose opening grew from about 2.2 km² to about 4 km² in area, changed shape and filled almost to its rim, with what looks like fresh flows downhill.",
    note: "They checked that the change was not just the two images being taken from different angles. NASA's VERITAS and ESA's EnVision will map Venus again in the 2030s, and look for more.",
    accuracy: "The site's own Venus, its clouds taken away to show the site's radar map of the ground (the Magellan colours). The ring marks the Maat Mons region and the dot the vent's side of the summit, approximately. The two radar frames are drawings made to match the published description — the vent's area, shape and filling — on a true scale of kilometres, not the Magellan pixels themselves.",
    art: { main: "venus", fx: "glow" },
    shotZoom: 1.25,
    shotPitch: 0.12,
    scene(ctx) {
      const venus = ctx.host;
      const wasRadar = isVenusRadarOn(venus);
      /* Maat Mons summit 0.5°N 194.6°E (USGS Gazetteer of Planetary
       * Nomenclature). The site's Venus map is centred on longitude 0
       * (checked: Maxwell Montes, 65°N 3°E, is the bright highland at
       * u = 0.5), the convention real.js surfacePoint uses. */
      const MAAT = { lat: 0.5, lon: 194.6 - 360 };
      /* The vent is on the north flank near the summit (Herrick & Hensley
       * 2023, Science 379, 1205); placed ~1° north, approximately. */
      const VENT = { lat: 1.5, lon: 194.6 - 360 };
      /* Maat Mons is about 400 km across at its base (USGS); the ring is
       * drawn wider, 4°, so it reads at this distance (drawing choice). */
      /* Venus in the middle of the frame, not the event's usual
       * side-on composition (it put Maat Mons at the screen's edge). */
      const yaw0 = yawFor(ctx.camDir);
      ctx.refocus("Venus", { shotYaw: yaw0, shotPitch: 0.12, shotZoom: 1.25 });
      holdForShot(ctx, venus.getWorldPosition(new THREE.Vector3()), yaw0, 0.12, null, 0.03, { within: worldRadius(venus) * 12 });
      const region = placeRing(ctx, venus, MAAT.lat, MAAT.lon, 5 * DEG, "#00e5ff", 0.78);
      const vent = placeRing(ctx, venus, VENT.lat, VENT.lon, 1.2 * DEG, "#ff2a6a", 0.6);

      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const title = H.label(["", ""], { at: [-0.4, 0.6, 0], height: 0.049, declutter: false });
      const maatLabel = H.label(["Maat Mons", "8 km high · 0.5° N, 194.6° E"], { align: "right", height: 0.049, colour: "#ffe3a8", declutter: false });
      const ventLabel = H.label(["the vent", "on its north flank"], { align: "right", height: 0.043, colour: "#ffb08a", declutter: false });
      [title, maatLabel, ventLabel].forEach((o) => ctx.fade(o, 0));

      /* ---- on black: the two radar frames, 6 km wide, to one scale */
      const PX = 512;
      const KM = 6;
      const pxPerKm = PX / KM;
      /* Feb 1991: a round, steep-walled vent of about 2.2 km² -- radius
       * sqrt(2.2 / pi) = 0.84 km, 1.7 km across. Oct 1991: about 4 km²,
       * misshapen, filled almost to its rim (Herrick & Hensley 2023). */
      const FEB_R = Math.sqrt(2.2 / Math.PI) * pxPerKm;
      const cx = PX / 2;
      const cy = PX * 0.44;
      const octShape = (() => {
        const pts = [];
        for (let i = 0; i < 40; i += 1) {
          const a = (i / 40) * TAU;
          const rr = 1 + 0.16 * Math.sin(a * 3 + 0.6) + 0.1 * Math.sin(a * 5 + 1.3);
          pts.push([Math.cos(a) * rr * 1.12, Math.sin(a) * rr * 0.9]);
        }
        /* Scaled so its area is 4 km² exactly (shoelace). */
        let area = 0;
        pts.forEach(([x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; area += x * y2 - x2 * y; });
        const k = Math.sqrt((4 * pxPerKm * pxPerKm) / Math.abs(area / 2));
        return pts.map(([x, y]) => [cx + x * k, cy + y * k]);
      })();
      const frame = (stage) => paint(PX, PX, (g, w, h) => {
        const rr = rng(31);
        const img = g.createImageData(w, h);
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const k = (y * w + x) * 4;
            /* The volcano's flank, falling away downhill (down the frame),
             * with radar speckle. */
            const ridge = 16 * Math.sin(x * 0.025 + y * 0.01) + 9 * Math.sin(y * 0.055 - x * 0.015) - 22 * (y / h);
            const v = 128 + ridge + (rr() - 0.5) * 62;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = Math.max(0, Math.min(255, v));
            img.data[k + 3] = 255;
          }
        }
        g.putImageData(img, 0, 0);
        if (stage === 0) {
          g.fillStyle = "rgba(22,22,22,0.96)";
          g.beginPath(); g.arc(cx, cy, FEB_R, 0, TAU); g.fill();
          /* Radar from the left: the far (right) wall bright, the near
           * wall in shadow. */
          g.strokeStyle = "rgba(240,240,240,0.95)"; g.lineWidth = 9;
          g.beginPath(); g.arc(cx, cy, FEB_R, -Math.PI * 0.42, Math.PI * 0.42); g.stroke();
          g.strokeStyle = "rgba(40,40,40,0.95)";
          g.beginPath(); g.arc(cx, cy, FEB_R, Math.PI * 0.58, Math.PI * 1.42); g.stroke();
        } else {
          /* New flows downhill from the vent. */
          g.fillStyle = "rgba(205,205,205,0.6)";
          g.beginPath();
          g.moveTo(cx - 20, cy + 60);
          g.bezierCurveTo(cx - 60, cy + 140, cx - 36, cy + 200, cx - 8, cy + 250);
          g.bezierCurveTo(cx + 20, cy + 196, cx + 46, cy + 140, cx + 22, cy + 60);
          g.fill();
          g.beginPath();
          g.moveTo(cx + 50, cy + 44);
          g.bezierCurveTo(cx + 96, cy + 110, cx + 118, cy + 160, cx + 136, cy + 214);
          g.bezierCurveTo(cx + 100, cy + 176, cx + 70, cy + 120, cx + 24, cy + 60);
          g.fill();
          /* The vent, filled almost to its rim: smooth, grey. */
          g.fillStyle = "rgba(92,92,92,0.97)";
          g.beginPath();
          octShape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(230,230,230,0.85)"; g.lineWidth = 5;
          g.stroke();
        }
        /* Scale bar: 1 km, and north. */
        g.fillStyle = "rgba(0,0,0,0.65)";
        g.fillRect(14, h - 76, pxPerKm + 40, 66);
        g.fillStyle = "#ffffff";
        g.fillRect(30, h - 28, pxPerKm, 7);
        g.fillRect(30, h - 36, 4, 22);
        g.fillRect(30 + pxPerKm - 4, h - 36, 4, 22);
        g.font = "bold 34px sans-serif";
        g.textAlign = "center";
        g.fillText("1 km", 30 + pxPerKm / 2, h - 42);
        g.textAlign = "left";
        g.fillText("6 km wide", w - 190, 44);
      });
      const D = new THREE.Group();
      hud.add(D);
      const K = hudKit(ctx, D);
      const S = 0.5;
      const FY = 0.16;
      /* Side by side, left of the card; each frame's vent area under it,
       * big, with its width beneath. */
      const frames = [
        { x: -0.76, title: "February 1991", sub: "Magellan, first look", area: "2.2 km²", across: ["vent area", "about 1.7 km across"], colour: "#bfe9ff" },
        { x: -0.18, title: "October 1991", sub: "eight months later", area: "about 4 km²", across: ["vent area", "about 2.3 km across, filled to the rim"], colour: "#ffd27f" },
      ].map((f, i) => {
        const mesh = panel(K, S, S, { map: frame(i), order: 19 });
        mesh.position.set(f.x, FY, 0);
        K.line([[-S / 2, -S / 2, 0.001], [S / 2, -S / 2, 0.001], [S / 2, S / 2, 0.001], [-S / 2, S / 2, 0.001], [-S / 2, -S / 2, 0.001]], { colour: f.colour, opacity: 0.9, parent: mesh });
        const label = K.label([f.title, f.sub], { at: [f.x, FY + S / 2 + 0.08, 0], height: 0.032, declutter: false });
        const area = new THREE.Group();
        D.add(area);
        K.label([f.area], { at: [f.x, FY - S / 2 - 0.07, 0], height: 0.05, colour: f.colour, declutter: false, parent: area });
        K.label(f.across, { at: [f.x, FY - S / 2 - 0.19, 0], height: 0.046, colour: f.colour, declutter: false, parent: area });
        ctx.fade(mesh, 0);
        ctx.fade(label, 0);
        ctx.fade(area, 0);
        return { mesh, label, area };
      });
      /* February's outline laid over October's frame. */
      const ghost = K.circle((FEB_R / PX) * S, { plane: "xy", colour: "#8fd8ff", opacity: 1, dashed: true, dash: 0.012, gap: 0.009 });
      ghost.position.set(-0.18, FY + (0.5 - cy / PX) * S, 0.01);
      const ghostLabel = K.label(["dashed blue: February's opening"], { at: [-0.18, FY - S / 2 - 0.3, 0.02], height: 0.022, colour: "#8fd8ff", declutter: false });
      /* The two areas as squares, to the frames' scale: 2.2 and 4 km². */
      const perKm = S / KM;
      const sq = (km2, x, colour) => {
        const side = Math.sqrt(km2) * perKm;
        const m = K.shape([[0, 0], [side, 0], [side, side], [0, side]], { colour, opacity: 0.85 });
        m.position.set(x, -0.74, 0);
        return m;
      };
      const sqA = sq(2.2, -1.0, "#8fd8ff");
      const sqB = sq(4, -0.84, "#ffd27f");
      const sqLabel = K.label(["The opening nearly doubled: 2.2 → 4 km²", "(1 km² = a square 1 km on each side)"], { at: [-0.62, -0.62, 0], align: "left", height: 0.038, declutter: false });
      const found = K.label(["Found in 2023 by Herrick and Hensley: the first", "direct sign of a recent eruption on Venus"], { at: [-0.62, -0.79, 0], align: "left", height: 0.035, colour: "#ffe3a8", declutter: false });
      [ghost, ghostLabel, sqA, sqB, sqLabel, found].forEach((o) => ctx.fade(o, 0));

      ctx.tell([
        { at: 0, label: "Venus", text: "The real Venus, as the eye sees it: a ball of cloud. Nothing of the ground shows." },
        { at: 0.1, label: "Beneath the clouds", text: "Radar sees through. This is the Magellan map of the ground — and here is Maat Mons, Venus's tallest volcano, 8 km high." },
        { at: 0.42, label: "February 1991", text: "Magellan's first radar look at a vent on its north flank: a round, steep-walled hole of about 2.2 square kilometres." },
        { at: 0.58, label: "October 1991", text: "Eight months later the same vent is about 4 square kilometres, misshapen, and filled almost to its rim — fresh lava." },
        { at: 0.8, label: "Found in 2023", text: "Herrick and Hensley spotted it in the old images: the first direct sign of a recent eruption on Venus." },
      ]);

      const cut = cutter(ctx, null);
      return {
        duration: 24,
        update(p) {
          /* ---- the real Venus */
          const real = p < 0.4;
          if (real) ctx.turnHostToward(MAAT.lat, MAAT.lon, ctx.camDir, p > 0.12 ? 1 : 0.06);
          setVenusRadar(venus, p > 0.1 ? true : wasRadar);
          if (real) { ctx.aim(yaw0, 0.12); ctx.setZoom(p > 0.24 ? 0.78 : 1.25); }
          title.userData.draw(p < 0.1 ? ["Venus, as the eye sees it", "sulphuric-acid cloud"] : ["Beneath the clouds", "the Magellan radar map"]);
          ctx.fade(title, real ? smooth(p, 0.0, 0.03) : 0);
          ctx.fade(region.ring, real ? smooth(p, 0.15, 0.19) : 0);
          ctx.fade(region.dot, real ? smooth(p, 0.15, 0.19) * (1 - smooth(p, 0.26, 0.3)) : 0);
          const c = region.centre();
          pin(ctx, maatLabel, c, -0.16, 0.1);
          ctx.fade(maatLabel, real ? smooth(p, 0.17, 0.21) : 0);
          vent.dot.scale.setScalar(1 + 0.35 * Math.sin(ctx.t * 5));
          ctx.fade(vent.dot, real ? smooth(p, 0.28, 0.32) : 0);
          ctx.fade(vent.ring, real ? smooth(p, 0.28, 0.32) : 0);
          pin(ctx, ventLabel, vent.centre(), -0.12, -0.12);
          ctx.fade(ventLabel, real ? smooth(p, 0.3, 0.34) : 0);

          /* ---- on black: the two frames */
          cut(!real);
          ctx.fade(frames[0].mesh, smooth(p, 0.41, 0.45));
          ctx.fade(frames[0].label, smooth(p, 0.41, 0.45));
          ctx.fade(frames[0].area, smooth(p, 0.45, 0.49));
          ctx.fade(frames[1].mesh, smooth(p, 0.57, 0.61));
          ctx.fade(frames[1].label, smooth(p, 0.57, 0.61));
          ctx.fade(frames[1].area, smooth(p, 0.61, 0.65));
          const g = smooth(p, 0.68, 0.72);
          ctx.fade(ghost, g * (0.65 + 0.35 * Math.sin(ctx.t * 3) ** 2));
          ctx.fade(ghostLabel, g);
          ctx.fade(sqA, smooth(p, 0.72, 0.75));
          ctx.fade(sqB, smooth(p, 0.75, 0.78));
          ctx.fade(sqLabel, smooth(p, 0.75, 0.78));
          ctx.fade(found, smooth(p, 0.82, 0.86));
        },
        dispose() { setVenusRadar(venus, wasRadar); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "mars-opposition",
    section: "inner",
    body: "Sun",
    title: "Mars at opposition",
    place: "Earth and Mars",
    kind: "recurring",
    family: "alignment",
    when: "Last Jan 16, 2025 · next February 2027",
    often: "every 26 months",
    timeline: { last: "January 16, 2025", next: "February 2027" },
    detail: "Earth overtakes Mars on the inside track, and Mars sits opposite the Sun: up all night, and at its brightest",
    frequency: "Every 780 days on average — about two years and two months — because Earth gains one lap on Mars in that time. Close, bright oppositions come every 15 or 17 years, when the overtaking happens near Mars's perihelion.",
    cause: "Earth goes round the Sun in 365 days, Mars in 687. Every so often Earth catches up and passes it, and for a few weeks the Sun, Earth and Mars stand in a line. Mars is then opposite the Sun in our sky: it rises at sunset, is highest at midnight and is closer, larger and brighter than at any other time.",
    note: "In January 2025 Mars came within 96 million km, two days before opposition — closest approach and opposition differ slightly because Mars's orbit is an ellipse. Launch windows to Mars open a few months before each opposition.",
    accuracy: "The site's own Earth and Mars, moved round their own orbits to the directions the real planets had on each date (computed from their real orbits), so the line-up falls on the right day. The site draws the orbits closer together than they are, so the distance and the telescope view are computed from the real orbits, not measured on screen.",
    art: { main: "mars", second: "earth", fx: "lineup" },
    scene(ctx) {
      /* Dates: Aug 1, 2024 to Apr 15, 2025, then on to the 2027 opposition
       * (JD from Meeus). Opposition JD 2460691.6 = Jan 16, 2025, which these
       * elements reproduce. */
      const JD_A = 2460523.5;
      const JD_OPP = 2460691.5;
      const JD_B = 2460780.5;
      const JD_2027 = 2461456.0;
      const stage = earthMarsStage(ctx, longitudeAt(MARS, JD_OPP));
      if (!stage) return { duration: 24, update() {} };
      const { earth, mars, S, U } = stage;
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const link = ctx.line([[0, 0, 0], [1, 0, 0]], { colour: "#ffffff", opacity: 0.6 });
      const lineUp = ctx.line([[0, 0, 0], [1, 0, 0]], { colour: "#ffd27f", opacity: 1 });
      const earthRing = H.circle(0.03, { plane: "xy", colour: "#7fc4ff", opacity: 0.95, additive: false });
      const marsRing = H.circle(0.03, { plane: "xy", colour: "#ff8a4a", opacity: 0.95, additive: false });
      const earthName = H.label(["Earth"], { height: 0.028, colour: "#9fd0ff", declutter: false });
      const marsName = H.label(["Mars"], { align: "right", height: 0.028, colour: "#ffb08a", declutter: false });
      const sunName = H.label(["The Sun"], { height: 0.026, declutter: false });
      const distance = H.label([""], { height: 0.026, declutter: false });
      const dateLabel = H.label(["", ""], { at: [-0.45, 0.64, 0], height: 0.052, declutter: false });
      /* The telescope view: Mars's apparent diameter to one scale. */
      const tele = new THREE.Vector3(-0.92, -0.58, 0);
      H.circle(0.17, { plane: "xy", colour: "#9fb3c8", opacity: 0.5, additive: false }).position.copy(tele);
      H.disc(0.17, { colour: "#000000", opacity: 0.75 }).position.copy(tele).setZ(-0.01);
      const disc = H.ball(0.1, { body: "Mars" });
      disc.position.copy(tele);
      const teleLabel = H.label(["Mars in a telescope", ""], { at: [tele.x, tele.y - 0.24, 0], height: 0.038, declutter: false });
      [link, lineUp, earthRing, marsRing, earthName, marsName, sunName, distance, dateLabel, teleLabel].forEach((o) => ctx.fade(o, 0));

      ctx.tell([
        { at: 0, label: "Two orbits", text: "The real Earth and Mars on their own orbits. Earth, on the inside track, goes round in 365 days; Mars takes 687." },
        { at: 0.16, label: "Catching up", text: "Earth gains on Mars, and the gap between them shrinks." },
        { at: 0.4, label: "Opposition", text: "January 16, 2025: Sun, Earth and Mars in a line. Mars rises at sunset and shines all night, at its brightest." },
        { at: 0.66, label: "Every 26 months", text: "About 780 days later Earth laps it again. The next opposition is in February 2027." },
      ]);

      const dateAt = (p) => (p < 0.64
        ? lerp(JD_A, JD_B, span(p, 0.03, 0.62))
        : lerp(JD_B, JD_2027, easeInOut(span(p, 0.66, 0.92))));
      const e = new THREE.Vector3();
      const m = new THREE.Vector3();
      const ew = new THREE.Vector3();
      const mw = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          const jd = dateAt(p);
          stage.place(jd);
          earth.getWorldPosition(ew);
          mars.getWorldPosition(mw);
          heliocentric(EARTH, jd, e);
          heliocentric(MARS, jd, m);
          const on = smooth(p, 0.0, 0.03);
          const eL = ew.clone().sub(S).divideScalar(U);
          const mL = mw.clone().sub(S).divideScalar(U);
          ctx.setLine(link, [eL, mL]);
          /* Alignment: how close the heliocentric longitudes are. */
          let dl = Math.atan2(m.y, m.x) - Math.atan2(e.y, e.x);
          dl = Math.atan2(Math.sin(dl), Math.cos(dl));
          const aligned = 1 - smooth(Math.abs(dl), 0.03, 0.18);
          ctx.setLine(lineUp, [new THREE.Vector3(), mL.clone().multiplyScalar(1.12)]);
          ctx.fade(lineUp, aligned * on);
          ctx.fade(link, on * (1 - aligned * 0.5));
          const he = toHud(ctx, ew);
          const hm = toHud(ctx, mw);
          earthRing.position.set(he.x, he.y, 0);
          marsRing.position.set(hm.x, hm.y, 0);
          earthName.position.set(he.x + 0.0, he.y - 0.08, 0);
          marsName.position.set(hm.x - 0.05, hm.y, 0);
          pin(ctx, sunName, S, 0, -0.1);
          const d = m.clone().sub(e).length();
          distance.position.set((he.x + hm.x) / 2, (he.y + hm.y) / 2 + 0.08, 0);
          distance.userData.draw([`${Math.round((d * AU_KM) / 1e6)} million km`]);
          dateLabel.userData.draw([calendar(jd), aligned > 0.6 ? "opposition: Sun, Earth and Mars in a line" : p > 0.64 ? "Earth laps Mars again" : "Earth catching up"]);
          [earthRing, marsRing, earthName, marsName, sunName, distance, dateLabel, teleLabel].forEach((o) => ctx.fade(o, on));
          /* Apparent diameter: 206,265″ × 2R / distance. */
          const arcsec = (206265 * 2 * MARS_RADIUS) / (d * AU_KM);
          disc.scale.setScalar((arcsec * 0.0125) / 0.1);
          disc.rotation.y = ctx.t * 0.3;
          hudLight(ctx, 0, 0.1, 1);
          teleLabel.userData.draw(["Mars in a telescope", `${arcsec.toFixed(1)}″ across`]);
          void JD_OPP;
        },
        dispose() { ctx.setSunLook(null); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 7 */
  event({
    id: "mars-retrograde",
    section: "inner",
    body: "Sun",
    title: "Mars's backwards loop",
    place: "Earth and Mars · Gemini and Cancer",
    kind: "recurring",
    family: "orbit",
    when: "Last Dec 7, 2024 – Feb 24, 2025",
    often: "every 26 months",
    timeline: { last: "Dec 2024 – Feb 2025", next: "Jan – Apr 2027" },
    detail: "Seen from Earth, Mars stops, runs backwards across the stars for about ten weeks, then turns forward again",
    frequency: "Every time Earth overtakes Mars — every 780 days on average — centred on opposition and lasting 60 to 80 days.",
    cause: "Mars never reverses. Earth, on the faster inside track, overtakes it, and while it does the line of sight from Earth to Mars swings backwards across the distant stars — as a car you overtake seems to slide backwards against the hills. Mars's orbit is tilted 1.85° to Earth's, so the path is drawn out into a loop or a zigzag rather than a straight back-and-forth.",
    note: "Retrograde loops were the great puzzle of ancient astronomy: Ptolemy explained them with circles on circles. Copernicus's Sun-centred system explained them as simply as this.",
    accuracy: "The site's own Earth and Mars, moved round their own orbits to the directions the real planets had on each date. The site draws the orbits closer together than they are, so the sight lines on the orbits only show the idea; the strip of sky above is computed from the real orbits, to true angular scale in both directions, for the 2024–25 loop.",
    art: { main: "mars", second: "earth", fx: "loop" },
    scene(ctx) {
      /* Sept 13, 2024 to May 21, 2025, centred on opposition (JD 2460691.5
       * = Jan 16, 2025). */
      const JD_MID = 2460691.5;
      const JD_A = JD_MID - 125;
      const JD_B = JD_MID + 125;
      const stage = earthMarsStage(ctx, longitudeAt(MARS, JD_MID));
      if (!stage) return { duration: 24, update() {} };
      const { earth, mars, S, U } = stage;
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);

      /* The sky strip, along the top (clear of the card): ecliptic
       * longitude 140°…90° left to right (east is left on a sky map),
       * latitude to the same scale. */
      const LAM0 = 140;
      const LAM1 = 90;
      const sx0 = -1.0;
      const sx1 = 1.0;
      const sk = (sx1 - sx0) / (LAM0 - LAM1);
      const sy = 0.58;
      const BETA0 = 3.6;
      const skyX = (lam) => sx0 + (LAM0 - lam) * sk;
      const skyY = (beta) => sy + (beta - BETA0) * sk;
      panel(H, sx1 - sx0 + 0.06, 0.3, { colour: "#050d1a", opacity: 0.92, order: 15 }).position.set((sx0 + sx1) / 2, sy, -0.02);
      H.line([[sx0, skyY(0), 0], [sx1, skyY(0), 0]], { colour: "#ffd27f", opacity: 0.3, dashed: true, dash: 0.02, gap: 0.02 });
      const r = rng(17);
      const stars = H.cloud(120, { size: 2 });
      for (let i = 0; i < 120; i += 1) {
        stars.set(i, lerp(sx0, sx1, r()), lerp(sy - 0.13, sy + 0.13, r()), -0.01);
        stars.size[i] = 1 + r() * 2;
        stars.alpha[i] = 0.3 + r() * 0.5;
      }
      stars.commit();
      /* Pollux: ecliptic λ 113.2°, β +6.7°; the Beehive cluster (M44):
       * λ 127.3°, β +1.5° (J2000, from their RA/Dec). */
      H.glow("#ffd9a0", 0.06, { opacity: 1 }).position.set(skyX(113.2), skyY(6.7), 0);
      H.label(["Pollux"], { at: [skyX(113.2) + 0.03, skyY(6.7), 0], align: "left", height: 0.02, colour: "#c8d6e6", declutter: false });
      const hive = H.cloud(14, { size: 2.2 });
      for (let i = 0; i < 14; i += 1) hive.set(i, skyX(127.3) + (r() - 0.5) * 0.05, skyY(1.5) + (r() - 0.5) * 0.04, 0);
      hive.commit();
      H.label(["Beehive"], { at: [skyX(127.3), skyY(1.5) - 0.04, 0], height: 0.018, colour: "#c8d6e6", declutter: false });
      H.label(["Mars against the stars, from Earth · east ←"], { at: [sx0 + 0.02, sy + 0.11, 0], align: "left", height: 0.02, colour: "#9fb3c8", declutter: false });

      const geo = (jd) => {
        const g = heliocentric(MARS, jd).sub(heliocentric(EARTH, jd));
        let lam = Math.atan2(g.y, g.x) / DEG;
        if (lam < 0) lam += 360;
        return { lam, beta: Math.atan2(g.z, Math.hypot(g.x, g.y)) / DEG };
      };
      const N = 250;
      const track = [];
      for (let i = 0; i <= N; i += 1) {
        const s = geo(lerp(JD_A, JD_B, i / N));
        track.push(new THREE.Vector3(skyX(s.lam), skyY(s.beta), 0.01));
      }
      const trail = H.line(track.slice(0, 2), { colour: "#ff9a6a", opacity: 0.95 });
      const marsDot = H.glow("#ff7a4a", 0.07, { opacity: 1 });

      /* On the orbits: the line of sight from the real Earth through the
       * real Mars, out to the distant stars (a circle at 1.3 Mars-orbit
       * radii, drawn), and a ghost of it every 25 days. */
      const RSKY = (mars.userData.orbitRadius ?? 420) * 1.3;
      const skyRing = ctx.circle(RSKY / U, { colour: "#9fb3c8", opacity: 0.3, dashed: true, dash: 0.25, gap: 0.2 });
      void skyRing;
      const sightEnd = (a, b) => {
        /* Where the ray a -> b leaves the circle of radius RSKY (xz). */
        const d = b.clone().sub(a).setY(0).normalize();
        const ax = a.x - S.x;
        const az = a.z - S.z;
        const bq = ax * d.x + az * d.z;
        const t = -bq + Math.sqrt(Math.max(0, bq * bq - (ax * ax + az * az - RSKY * RSKY)));
        return new THREE.Vector3(a.x + d.x * t, a.y, a.z + d.z * t);
      };
      const local = (w) => w.clone().sub(S).divideScalar(U);
      const sight = ctx.line([[0, 0, 0], [1, 0, 0]], { colour: "#ffe3a8", opacity: 1 });
      const ghosts = [];
      const ew = new THREE.Vector3();
      const mw = new THREE.Vector3();
      for (let k = 0; k <= 10; k += 1) {
        const jd = JD_A + k * 25;
        stage.place(jd);
        earth.getWorldPosition(ew);
        mars.getWorldPosition(mw);
        const end = sightEnd(ew, mw);
        const line = ctx.line([local(ew), local(end)], { colour: "#ffe3a8", opacity: 0.22 });
        const tick = ctx.glow("#ff9a6a", 0.15, { opacity: 0.95 });
        tick.position.copy(local(end));
        const skyTick = H.glow("#ff9a6a", 0.03, { opacity: 0.9 });
        skyTick.position.copy(track[Math.round((k * 25 * N) / (JD_B - JD_A))]);
        ghosts.push({ jd, line, tick, skyTick });
      }
      const earthRing = H.circle(0.03, { plane: "xy", colour: "#7fc4ff", opacity: 0.95, additive: false });
      const marsRing = H.circle(0.03, { plane: "xy", colour: "#ff8a4a", opacity: 0.95, additive: false });
      const earthName = H.label(["Earth"], { height: 0.026, colour: "#9fd0ff", declutter: false });
      const marsName = H.label(["Mars"], { height: 0.026, colour: "#ffb08a", declutter: false });
      const starsName = H.label(["toward the distant stars"], { height: 0.022, colour: "#9fb3c8", declutter: false });
      const dateLabel = H.label(["", ""], { at: [-0.62, -0.66, 0], height: 0.052, declutter: false });

      ctx.tell([
        { at: 0, label: "Against the stars", text: "Autumn 2024: night by night, Mars creeps east (left) through Gemini toward Cancer. Below, the real Earth and Mars on their orbits." },
        { at: 0.3, label: "It stops", text: "December 7, 2024: Mars stands still near the Beehive cluster…" },
        { at: 0.42, label: "Backwards", text: "…and drifts west for about eleven weeks. Midway, on January 16, Earth overtakes it: watch the line of sight swing back." },
        { at: 0.66, label: "Forward again", text: "February 24, 2025: it stops again, then resumes its eastward way." },
        { at: 0.84, label: "An illusion", text: "Mars never turns back. Earth, on the faster inside track, passes it — like a car you overtake." },
      ]);
      return {
        duration: 24,
        update(p) {
          const u = span(p, 0.03, 0.96);
          const jd = lerp(JD_A, JD_B, u);
          stage.place(jd);
          earth.getWorldPosition(ew);
          mars.getWorldPosition(mw);
          const end = sightEnd(ew, mw);
          ctx.setLine(sight, [local(ew), local(end)]);
          const n = Math.max(2, Math.round(u * N) + 1);
          H.setLine(trail, track.slice(0, n));
          const s = geo(jd);
          marsDot.position.set(skyX(s.lam), skyY(s.beta), 0.02);
          ghosts.forEach((g) => {
            const on = jd >= g.jd ? 1 : 0;
            ctx.fade(g.line, on);
            ctx.fade(g.tick, on);
            ctx.fade(g.skyTick, on);
          });
          const he = toHud(ctx, ew);
          const hm = toHud(ctx, mw);
          earthRing.position.set(he.x, he.y, 0);
          marsRing.position.set(hm.x, hm.y, 0);
          earthName.position.set(he.x + 0.07, he.y - 0.03, 0);
          marsName.position.set(hm.x + 0.06, hm.y + 0.03, 0);
          pin(ctx, starsName, end, 0.0, -0.06);
          ctx.fade(starsName, 1 - smooth(p, 0.25, 0.3));
          const back = geo(jd + 0.5).lam < geo(jd - 0.5).lam;
          dateLabel.userData.draw([calendar(jd), back ? "moving west — backwards" : "moving east"]);
        },
        dispose() { ctx.setSunLook(null); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 8 */
  event({
    id: "mars-blue-sunset",
    section: "inner",
    title: "Blue sunset on Mars",
    place: "Mars · Gale crater",
    kind: "recurring",
    family: "surface",
    often: "every clear evening",
    detail: "On Mars the day sky is butterscotch, but the glow around the setting Sun is a cool, pale blue",
    frequency: "Every clear sunset (and sunrise); it is brightest when there is plenty of fine dust in the air.",
    cause: "Mars's sky colour comes from fine dust, grains about a micrometre across, not from the air itself. The dust absorbs blue light and scatters red light widely, so the daytime sky is reddish. But grains that size scatter blue light into a narrow cone straight ahead, so looking toward the Sun — most strongly at dusk, through the longest path of dust — a blue glow surrounds it.",
    note: "The Spirit rover photographed a blue sunset over Gusev crater on May 19, 2005, and Curiosity one over Gale crater on April 15, 2015. Seen from Mars, the Sun is about two-thirds the width it appears from Earth.",
    accuracy: "A diagram of a sunset, with colours chosen to match the rovers' photographs; the Sun's size and the timing are not to scale. The inset shows the scattering idea, not a calculation.",
    art: { main: "mars", second: "sun", fx: "glow" },
    scene(ctx) {
      /* layout */
      const W = 1.62;
      const H = 1.46;
      const PC = new THREE.Vector3(-0.25, 0.1, -0.01);
      const sky = panel(ctx, W, H, { segments: [32, 32], vertexColors: true, order: 16 });
      sky.position.copy(PC);
      const colours = new Float32Array(sky.geometry.attributes.position.count * 3);
      sky.geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
      const horizon = -0.3;
      /* Ground: the far rim of Gale crater, then the near plain. */
      const pts = [[PC.x - W / 2, PC.y - H / 2]];
      for (let i = 0; i <= 50; i += 1) {
        const x = lerp(PC.x - W / 2, PC.x + W / 2, i / 50);
        const y = horizon + 0.05 * Math.exp(-(((x + 0.75) / 0.25) ** 2)) + 0.035 * Math.exp(-(((x - 0.35) / 0.3) ** 2)) + 0.006 * Math.sin(i * 1.3);
        pts.push([x, y]);
      }
      pts.push([PC.x + W / 2, PC.y - H / 2]);
      solid(ctx, pts, { colour: "#1c1410", depthTest: false });
      const sun = ctx.sun(0.022, { colour: "#fff8ec", hot: "#ffffff", halo: 3, haloColour: "#fff2e0", haloOpacity: 0.7, granule: 8 });
      const blue = ctx.glow("#4f86e0", 0.5, { opacity: 0 });
      const place = ctx.label(["Gale crater, Mars", "after Curiosity · April 15, 2015"], { at: [PC.x - W / 2 + 0.04, PC.y + H / 2 - 0.08, 0], align: "left", height: 0.04 });
      void place;
      const time = ctx.label([""], { at: [PC.x, PC.y - H / 2 + 0.1, 0], height: 0.03 });

      /* Inset: one dust grain. */
      const g0 = new THREE.Vector3(0.84, 0.48, 0);
      const inset = new THREE.Group();
      inset.position.copy(g0);
      ctx.add(inset);
      ctx.disc(0.035, { colour: "#b97a4e", parent: inset }).renderOrder = 25;
      ctx.arrow([-0.24, 0, 0], [-0.05, 0, 0], { colour: "#ffffff", head: 0.03, parent: inset });
      const ray = (angle, len, colour) => ctx.arrow([Math.cos(angle) * 0.05, Math.sin(angle) * 0.05, 0], [Math.cos(angle) * len, Math.sin(angle) * len, 0], { colour, head: 0.025, parent: inset });
      [-0.12, 0, 0.12].forEach((a) => ray(a, 0.22, "#6fa0ff"));
      [0.9, 1.6, 2.3, -0.9, -1.6, -2.3, 3.14].forEach((a) => ray(a, 0.15, "#ff8a4a"));
      const insetLabel = ctx.label(["One dust grain", "blue: thrown forward · red: everywhere"], { at: [g0.x, g0.y - 0.24, 0], height: 0.036 });
      ctx.fade(inset, 0);
      ctx.fade(insetLabel, 0);

      const DAY_TOP = new THREE.Color("#a77a52");
      const DAY_LOW = new THREE.Color("#dcb68c");
      const DUSK_TOP = new THREE.Color("#120e0c");
      const DUSK_LOW = new THREE.Color("#3e3026");
      const BLUE = new THREE.Color("#6d95cf");
      const c = new THREE.Color();
      const top = new THREE.Color();
      const low = new THREE.Color();

      ctx.tell([
        { at: 0, label: "Mars by day", text: "Fine dust in the thin air scatters red light across the whole sky: a butterscotch afternoon." },
        { at: 0.3, label: "Dusk", text: "As the Sun sinks, its light crosses more and more dust. Grains a micrometre across throw blue light forward." },
        { at: 0.56, label: "Blue sunset", text: "So the glow hugging the setting Sun turns cool and pale blue. Curiosity photographed this on April 15, 2015." },
        { at: 0.82, label: "Afterglow", text: "The blue lingers after the Sun has gone, lit by dust high in the sky." },
      ]);
      return {
        duration: 20,
        update(p) {
          const fall = easeInOut(span(p, 0.02, 0.82));
          const sx = lerp(-0.02, -0.22, fall);
          const syy = lerp(0.52, horizon - 0.04, fall);
          sun.position.set(sx, syy, 0);
          ctx.fade(sun, 1 - smooth(p, 0.78, 0.83));
          const dusk = smooth(p, 0.25, 0.92);
          const glow = smooth(p, 0.3, 0.7) * (1 - 0.65 * smooth(p, 0.86, 1));
          blue.position.set(sx, Math.max(syy, horizon + 0.02), 0.01);
          blue.scale.setScalar(lerp(0.3, 0.75, glow));
          ctx.fade(blue, glow * 0.85);
          top.copy(DAY_TOP).lerp(DUSK_TOP, dusk);
          low.copy(DAY_LOW).lerp(DUSK_LOW, dusk);
          const pos = sky.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 1) {
            const x = pos.getX(i) + PC.x;
            const y = pos.getY(i) + PC.y;
            const h = clamp01((y - horizon) / (PC.y + H / 2 - horizon));
            c.copy(low).lerp(top, Math.pow(h, 0.7));
            const d2 = (x - sx) ** 2 + ((y - Math.max(syy, horizon)) * 1.4) ** 2;
            c.lerp(BLUE, glow * 0.85 * Math.exp(-d2 / 0.06));
            colours[i * 3] = c.r;
            colours[i * 3 + 1] = c.g;
            colours[i * 3 + 2] = c.b;
          }
          sky.geometry.attributes.color.needsUpdate = true;
          const ins = smooth(p, 0.3, 0.38);
          ctx.fade(inset, ins);
          ctx.fade(insetLabel, ins);
          time.userData.draw([p < 0.28 ? "Afternoon" : p < 0.8 ? "Sunset" : "After sunset"]);
        },
      };
    },
  }),


  /* ------------------------------------------------------------------ 9 */
  event({
    id: "mars-dust-devils",
    section: "inner",
    body: "Mars",
    title: "Martian dust devils",
    place: "Mars · the plains",
    kind: "recurring",
    family: "surface",
    often: "every spring and summer afternoon",
    detail: "Whirlwinds kilometres tall wander the Martian plains, scrubbing off bright dust and leaving dark scribbles behind",
    frequency: "Every day in the warm season in many regions, most often in the early afternoon. Spirit filmed hundreds in Gusev crater.",
    cause: "Sunlight heats the dark ground, and the ground heats a thin layer of air above it. That warm air rises in plumes; any slight swirl in the inflowing air is spun up as it is drawn in, like a skater pulling in their arms, until a whirling column stands on the plain. It lifts the thin layer of bright dust and leaves darker ground exposed.",
    note: "In 2012 the HiRISE camera caught one in Amazonis Planitia about 20 km tall and 70 m wide. Dust devils also cleaned the solar panels of the Spirit and Opportunity rovers, helping them last for years.",
    accuracy: "First the site's own Mars, turned to show Amazonis Planitia and Gusev crater (the rings mark the regions). Then a diagram of a plain: the devils' heights are compressed against the width of the ground, and the tracks are drawn wider than real ones (tens of metres).",
    art: { main: "mars", fx: "storm" },
    shotZoom: 1.1,
    scene(ctx) {
      /* Amazonis Planitia 24.8°N 196.0°E; Gusev crater 14.5°S 175.4°E
       * (USGS Gazetteer of Planetary Nomenclature). Rings drawn the
       * regions' rough size (drawing choice). */
      const place = marsPlace(ctx, { lat: 24.8, lon: 196.0 - 360, reach: 10 * DEG, zoom: 1.1 });
      const gusev = placeRing(ctx, ctx.host, -14.5, 175.4, 2.6 * DEG, "#8fd8ff");
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const amazonis = H.label(["Amazonis Planitia", "a 20 km-tall dust devil, seen 2012"], { align: "right", height: 0.041, colour: "#ffe3a8", declutter: false });
      const gusevLabel = H.label(["Gusev crater", "Spirit filmed hundreds"], { align: "left", height: 0.038, colour: "#bfe9ff", declutter: false });
      [amazonis, gusevLabel].forEach((o) => ctx.fade(o, 0));

      /* ---- on black: the plain */
      const D = new THREE.Group();
      hud.add(D);
      const K = hudKit(ctx, D);
      const G = new THREE.Group();
      G.position.set(-0.38, -0.22, 0);
      G.scale.setScalar(0.85);
      D.add(G);
      const GW = 1.5;
      const GD = 0.95;
      const plain = paint(512, 384, (g, w, h) => {
        const rr = rng(9);
        g.fillStyle = "#c8916a";
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i += 1) {
          const x = rr() * w;
          const y = rr() * h;
          const s = 1 + rr() * 6;
          g.fillStyle = rr() > 0.5 ? "rgba(230,180,140,0.25)" : "rgba(120,70,45,0.18)";
          g.fillRect(x, y, s, s);
        }
        for (let i = 0; i < 9; i += 1) {
          g.strokeStyle = "rgba(90,55,35,0.18)";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(rr() * w, rr() * h, 10 + rr() * 30, 0, TAU);
          g.stroke();
        }
      });
      const ground = panel(K, GW, GD, { map: plain, order: 17, parent: G });
      ground.rotation.x = -Math.PI / 2;
      /* Three devils on wandering paths (drawing choice). */
      const r = rng(21);
      const devils = [0, 1, 2].map((k) => {
        const start = [new THREE.Vector3(-0.62, 0, 0.12), new THREE.Vector3(-0.45, 0, -0.3), new THREE.Vector3(0.05, 0, 0.3)][k];
        const heading = [-0.15, 0.25, -0.5][k];
        const path = [];
        let pos = start.clone();
        let a = heading;
        for (let i = 0; i <= 120; i += 1) {
          path.push(pos.clone());
          a += Math.sin(i * 0.11 + k * 2) * 0.06;
          pos = pos.clone().add(new THREE.Vector3(Math.cos(a) * 0.0085, 0, Math.sin(a) * 0.006));
          pos.x = Math.max(-GW / 2 + 0.06, Math.min(GW / 2 - 0.06, pos.x));
          pos.z = Math.max(-GD / 2 + 0.06, Math.min(GD / 2 - 0.06, pos.z));
        }
        return { path, t0: [0.02, 0.18, 0.34][k], t1: [0.7, 0.82, 0.92][k], H: [0.7, 0.55, 0.6][k], w: [0.055, 0.045, 0.05][k] };
      });
      const TRACK = 121;
      const tracks = K.cloud(devils.length * TRACK, { additive: false, size: 7, parent: G });
      devils.forEach((d, k) => d.path.forEach((q, i) => {
        tracks.set(k * TRACK + i, q.x, 0.002, q.z);
        tracks.tint(k * TRACK + i, "#4a2c1e");
        tracks.alpha[k * TRACK + i] = 0;
      }));
      tracks.commit();
      const PER = 420;
      const dust = K.cloud(devils.length * PER, { additive: false, size: 4, parent: G });
      const seeds = Array.from({ length: devils.length * PER }, () => ({ h: Math.pow(r(), 0.8), a: r() * TAU, j: 0.6 + r() * 0.6, s: 2 + r() * 3 }));
      seeds.forEach((s, i) => { dust.tint(i, r() > 0.4 ? "#e0b48c" : "#b88460"); dust.size[i] = s.s; });
      const tall = K.label(["kilometres tall"], { height: 0.028, align: "left" });
      const trackLabel = K.label(["dark track", "bright dust swept away"], { height: 0.034, colour: "#ffe3a8" });
      ctx.fade(D, 0);

      ctx.tell([
        { at: 0, label: "The plains of Mars", text: "The real Mars, turned to Amazonis Planitia: one of the flat, dusty plains where the biggest dust devils have been seen." },
        { at: 0.32, label: "A Martian whirlwind", text: "Sun-warmed ground heats the air above it; the rising air starts to spin and lifts dust into a column — many kilometres tall." },
        { at: 0.6, label: "Dark scribbles", text: "They sweep up the thin layer of bright dust and uncover the darker ground below." },
        { at: 0.8, label: "From above", text: "Seen from orbit the tracks criss-cross the plains, until the next dust storm paints them over." },
      ]);

      const cut = cutter(ctx, null);
      return {
        duration: 24,
        update(p) {
          /* ---- the real Mars */
          const real = p < 0.3;
          if (real) place.hold();
          ctx.fade(place.ring.ring, real ? smooth(p, 0.04, 0.08) : 0);
          ctx.fade(place.ring.dot, real ? smooth(p, 0.04, 0.08) : 0);
          ctx.fade(gusev.ring, real ? smooth(p, 0.12, 0.16) : 0);
          pin(ctx, amazonis, place.ring.centre(), -0.12, 0.12);
          pin(ctx, gusevLabel, gusev.centre(), 0.08, -0.04);
          ctx.fade(amazonis, real ? smooth(p, 0.06, 0.1) : 0);
          ctx.fade(gusevLabel, real ? smooth(p, 0.13, 0.17) : 0);

          /* ---- on black: the diorama, its own clock q */
          cut(!real);
          ctx.fade(D, smooth(p, 0.31, 0.34));
          if (real) return;
          hudLight(ctx, -0.4, 0.8, 0.4);
          const q = span(p, 0.32, 1);
          G.rotation.x = lerp(0.38, 1.2, easeInOut(span(q, 0.72, 0.86)));
          devils.forEach((d, k) => {
            const u = span(q, d.t0, d.t1);
            const life = win(q, d.t0, d.t1, 0.05);
            const idx = Math.min(d.path.length - 1, Math.floor(u * (d.path.length - 1)));
            const c = d.path[idx];
            for (let i = 0; i < TRACK; i += 1) tracks.alpha[k * TRACK + i] = i <= idx && u > 0 ? 0.55 : 0;
            for (let i = 0; i < PER; i += 1) {
              const s = seeds[k * PER + i];
              const y = s.h * d.H;
              const rad = d.w * (0.35 + 1.6 * s.h * s.h) * s.j;
              const a = s.a + ctx.t * (5 - 3 * s.h) * (k % 2 ? -1 : 1);
              const sway = Math.sin(ctx.t * 0.7 + k) * 0.03 * s.h;
              dust.set(k * PER + i, c.x + Math.cos(a) * rad + sway, y, c.z + Math.sin(a) * rad);
              dust.alpha[k * PER + i] = life * (0.8 - 0.45 * s.h);
            }
            if (k === 0) {
              G.updateMatrix();
              tall.position.copy(new THREE.Vector3(c.x + 0.2, d.H * 0.85, c.z).applyMatrix4(G.matrix));
              ctx.fade(tall, win(q, 0.22, 0.6));
            }
          });
          tracks.commit();
          dust.commit();
          G.updateMatrix();
          const mid = devils[0].path[40];
          trackLabel.position.copy(new THREE.Vector3(mid.x, 0, mid.z + 0.14).applyMatrix4(G.matrix));
          ctx.fade(trackLabel, smooth(q, 0.48, 0.54));
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 10 */
  event({
    id: "mars-spiders",
    section: "inner",
    body: "Mars",
    title: "Spring geysers at Mars's south pole",
    place: "Mars · the south polar cap",
    kind: "recurring",
    family: "surface",
    often: "every southern spring",
    detail: "Sunlight through clear dry ice heats the ground beneath; trapped gas bursts out in dusty jets that carve spider-shaped channels",
    frequency: "Every southern spring on Mars — once per Martian year, 687 Earth days — in the sunlit months after the polar night.",
    cause: "In winter, carbon dioxide freezes out of the air into a slab of clear ice over the ground. In spring sunlight passes through the slab and warms the dark ground under it, so the ice turns to gas from the bottom. Gas builds up under the slab until it breaks through a weak spot and erupts, carrying dust that the wind lays down in dark fans. This is the Kieffer model, named for the scientist who proposed it in 2006 and 2007.",
    note: "Nothing on Earth works quite like this. The channels, nicknamed spiders, range from tens of metres to about a kilometre across, carved over many springs.",
    accuracy: "First the site's own Mars, its south pole tipped toward the Sun as in southern spring, with the ring on the spider terrain near 'Inca City'. Then a cross-section diagram — the ice slab drawn far thicker than its real thickness (up to around a metre), the jet's height not to scale — and a sketch of a typical spider from orbit, not a real one.",
    art: { main: "mars", fx: "jets" },
    shotZoom: 1.1,
    shotPitch: -0.6,
    scene(ctx) {
      /* Angustus Labyrinthus ("Inca City"), 81.4°S 296.1°E (USGS), in the
       * region where spiders are common (81–87° S). */
      const place = marsPlace(ctx, { lat: -81.4, lon: 296.1 - 360, reach: 6 * DEG, zoom: 1.2 });
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const where = H.label(["Spider terrain near 'Inca City'", "81° S, at the edge of the south polar cap"], { align: "right", height: 0.041, colour: "#ffe3a8", declutter: false });
      const pole = H.label(["South pole, tipped toward the Sun: spring"], { at: [-0.45, 0.62, 0], height: 0.028, declutter: false });
      [where, pole].forEach((o) => ctx.fade(o, 0));

      /* ---- on black, 1: the cross-section */
      const CS = new THREE.Group();
      hud.add(CS);
      const K = hudKit(ctx, CS);
      const X0 = -1.02;
      const X1 = 0.28;
      const iceTop = -0.02;
      const iceBot = -0.17;
      const vx = -0.42;
      const groundPts = [[X0, -0.62], [X0, iceBot]];
      for (let i = 0; i <= 40; i += 1) {
        const x = lerp(X0, X1, i / 40);
        groundPts.push([x, iceBot - 0.05 * Math.exp(-(((x - vx) / 0.05) ** 2))]);
      }
      groundPts.push([X1, iceBot], [X1, -0.62]);
      solid(K, groundPts, { colour: "#4a3326", order: 18 });
      solid(K, [[X0, iceBot], [vx - 0.012, iceBot], [vx - 0.012, iceTop], [X0, iceTop]], { colour: "#cfe6f5", order: 19, opacity: 0.4 });
      solid(K, [[vx + 0.012, iceBot], [X1, iceBot], [X1, iceTop], [vx + 0.012, iceTop]], { colour: "#cfe6f5", order: 19, opacity: 0.4 });
      K.line([[X0, iceTop, 0.01], [vx - 0.012, iceTop, 0.01]], { colour: "#e8f6ff", opacity: 0.9, additive: false });
      K.line([[vx + 0.012, iceTop, 0.01], [X1, iceTop, 0.01]], { colour: "#e8f6ff", opacity: 0.9, additive: false });
      K.label(["clear CO₂ ice"], { at: [-0.98, (iceTop + iceBot) / 2, 0.02], align: "left", height: 0.026, colour: "#e8f6ff" });
      K.label(["ground"], { at: [-0.85, -0.42, 0.02], align: "left", height: 0.026, colour: "#d8b8a0" });
      const rays = [-0.9, -0.66, -0.12, 0.12].map((x) => K.arrow([x - 0.28, 0.5, 0], [x, iceBot + 0.005, 0], { colour: "#ffe08a", head: 0.035 }));
      const sunLabel = K.label(["sunlight passes through"], { at: [-0.98, 0.56, 0], align: "left", height: 0.03, colour: "#ffe08a" });
      const r = rng(13);
      const GAS = 160;
      const gas = K.cloud(GAS, { size: 3 });
      const gasSeeds = Array.from({ length: GAS }, () => ({ x: lerp(X0 + 0.05, X1 - 0.05, r()), ph: r(), s: 2 + r() * 2 }));
      gasSeeds.forEach((s, i) => { gas.tint(i, "#ffffff"); gas.size[i] = s.s; });
      const JET = 520;
      const jet = K.cloud(JET, { additive: false, size: 3.5 });
      const jetSeeds = Array.from({ length: JET }, () => ({ ph: r(), sp: (r() - 0.5) * 0.06, dark: r() > 0.35, s: 2 + r() * 3 }));
      jetSeeds.forEach((s, i) => { jet.tint(i, s.dark ? "#2a1a12" : "#e8eef4"); jet.size[i] = s.s; });
      const FAN = 240;
      const fan = K.cloud(FAN, { additive: false, size: 4 });
      for (let i = 0; i < FAN; i += 1) {
        const d = Math.pow(r(), 0.7) * 0.42;
        fan.set(i, vx + 0.02 + d, iceTop + 0.006 + r() * 0.01, 0.02);
        fan.tint(i, "#2a1a12");
      }
      const jetLabel = K.label(["gas jet", "carries dark dust out"], { at: [vx + 0.08, 0.5, 0], align: "left", height: 0.034 });
      const fanLabel = K.label(["dark fan, laid by the wind →"], { at: [vx + 0.25, iceTop + 0.07, 0.02], height: 0.026, colour: "#ffe3a8" });
      ctx.fade(CS, 0);

      /* ---- on black, 2: the view from orbit, a spider */
      const SP = new THREE.Group();
      SP.position.set(-0.42, 0.04, 0);
      SP.scale.setScalar(1.45);
      hud.add(SP);
      const P = hudKit(ctx, SP);
      P.disc(0.3, { colour: "#b9b2a8", opacity: 0.95 });
      const branches = [];
      const grow = (from, angle, len, depth) => {
        const to = from.clone().add(new THREE.Vector3(Math.cos(angle) * len, Math.sin(angle) * len, 0));
        branches.push({ from, to, depth });
        if (depth < 3) for (let i = 0; i < 2; i += 1) grow(to, angle + (i ? 1 : -1) * (0.35 + r() * 0.3), len * (0.55 + r() * 0.15), depth + 1);
      };
      for (let k = 0; k < 7; k += 1) grow(new THREE.Vector3(0, 0, 0.01), (k / 7) * TAU + r() * 0.3, 0.1 + r() * 0.02, 0);
      const PER_BRANCH = 16;
      const channels = P.cloud(branches.length * PER_BRANCH, { additive: false, size: 4.5 });
      branches.forEach((b, j) => {
        for (let i = 0; i < PER_BRANCH; i += 1) {
          const q = b.from.clone().lerp(b.to, i / (PER_BRANCH - 1));
          channels.set(j * PER_BRANCH + i, q.x, q.y, 0.015);
          channels.tint(j * PER_BRANCH + i, "#3a2418");
          channels.size[j * PER_BRANCH + i] = (5.5 - b.depth * 1.2) * 1.4;
          channels.alpha[j * PER_BRANCH + i] = 0;
        }
      });
      channels.commit();
      const fans = P.cloud(7 * 30, { additive: false, size: 6 });
      for (let k = 0; k < 7; k += 1) {
        /* Fans spill from vents near the centre, downwind (to the right). */
        const tip = branches.filter((b) => b.depth === 0)[k].to.clone().multiplyScalar(0.35);
        for (let i = 0; i < 30; i += 1) {
          const d = r() * 0.07;
          fans.set(k * 30 + i, tip.x + d, tip.y + (r() - 0.5) * d * 0.5, 0.02);
          fans.tint(k * 30 + i, "#24160f");
          fans.alpha[k * 30 + i] = 0;
        }
      }
      fans.commit();
      const orbitLabel = H.label(["From orbit: a 'spider'", "tens of metres to 1 km across"], { at: [-0.42, -0.5, 0], height: 0.049, declutter: false });
      ctx.fade(SP, 0);
      ctx.fade(orbitLabel, 0);

      ctx.tell([
        { at: 0, label: "Spring at the south pole", text: "The real Mars, its south pole tipping toward the Sun. All winter a slab of clear carbon-dioxide ice has covered the ground here." },
        { at: 0.3, label: "Warmed from below", text: "Sunlight passes through the clear ice and heats the dark ground. The ice turns to gas from its base." },
        { at: 0.56, label: "Eruption", text: "The trapped gas breaks out through a weak spot, carrying dark dust that the wind lays down in fans." },
        { at: 0.72, label: "Spiders", text: "Spring after spring, the gas rushing to the vents carves branching channels: from orbit, giant spiders." },
      ]);

      const cut = cutter(ctx, null);
      return {
        duration: 24,
        update(p) {
          const real = p < 0.28;
          if (real) place.hold();
          ctx.fade(place.ring.ring, real ? smooth(p, 0.05, 0.09) : 0);
          ctx.fade(place.ring.dot, real ? smooth(p, 0.05, 0.09) : 0);
          pin(ctx, where, place.ring.centre(), -0.12, 0.12);
          ctx.fade(where, real ? smooth(p, 0.07, 0.11) : 0);
          ctx.fade(pole, real ? smooth(p, 0.0, 0.04) : 0);
          cut(!real);
          if (real) { ctx.fade(CS, 0); ctx.fade(SP, 0); return; }
          hudLight(ctx, 0.3, 0.6, 0.7);
          /* The cross-section: old clock 0-0.6 over p 0.3-0.7. */
          const c = span(p, 0.3, 0.7) * 0.6;
          ctx.fade(CS, smooth(p, 0.29, 0.32) * (1 - smooth(p, 0.69, 0.72)));
          const light = smooth(c, 0.02, 0.12);
          rays.forEach((a) => ctx.fade(a, light * (1 - 0.5 * smooth(c, 0.5, 0.6))));
          ctx.fade(sunLabel, light * (1 - smooth(c, 0.4, 0.46)));
          const build = smooth(c, 0.16, 0.3);
          const flow = smooth(c, 0.38, 0.46);
          gasSeeds.forEach((s, i) => {
            const toward = Math.sign(vx - s.x);
            const drift = flow * ((s.ph + ctx.t * 0.25) % 1);
            let x = s.x + toward * Math.min(Math.abs(vx - s.x), drift * 0.7);
            const near = Math.abs(x - vx) < 0.015;
            x = near ? vx : x;
            gas.set(i, x, iceBot + 0.012 + 0.008 * Math.sin(i), 0.02);
            gas.alpha[i] = build * 0.75 * (near ? 0 : 1);
          });
          gas.commit();
          const erupt = smooth(c, 0.4, 0.46);
          jetSeeds.forEach((s, i) => {
            const q = (s.ph + ctx.t * 0.6) % 1;
            jet.set(i, vx + s.sp * q + q * q * 0.22, iceTop + q * 0.5, 0.03);
            jet.alpha[i] = erupt * (1 - q) * 0.85;
          });
          jet.commit();
          const settle = smooth(c, 0.45, 0.6);
          for (let i = 0; i < FAN; i += 1) fan.alpha[i] = i < FAN * settle ? 0.65 : 0;
          fan.commit();
          ctx.fade(jetLabel, smooth(c, 0.44, 0.48));
          ctx.fade(fanLabel, smooth(c, 0.52, 0.56));
          /* The spider, p 0.72-1: grows branch level by level. */
          const s2 = span(p, 0.72, 1);
          ctx.fade(SP, smooth(p, 0.71, 0.74));
          ctx.fade(orbitLabel, smooth(p, 0.74, 0.77));
          branches.forEach((b, j) => {
            const g = span(s2, 0.05 + b.depth * 0.16, 0.22 + b.depth * 0.16);
            for (let i = 0; i < PER_BRANCH; i += 1) channels.alpha[j * PER_BRANCH + i] = g > 0 && i / (PER_BRANCH - 1) <= g ? 0.9 : 0;
          });
          channels.commit();
          const f = smooth(s2, 0.72, 0.9);
          for (let i = 0; i < fans.count; i += 1) fans.alpha[i] = f * 0.7;
          fans.commit();
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 11 */
  event({
    id: "mars-avalanches",
    section: "inner",
    body: "Mars",
    title: "Avalanches on the north polar cliffs",
    place: "Mars · the north polar cap",
    kind: "recurring",
    family: "surface",
    often: "every northern spring",
    detail: "Spring sunshine cracks frost and ice on cliffs hundreds of metres tall, and avalanches crash down in clouds of dust",
    frequency: "Every northern spring on Mars, once a Martian year (687 Earth days). HiRISE has photographed them in the act many times since 2008.",
    cause: "The north polar cap ends in steep cliffs of layered ice and dust, steeper than 60° and hundreds of metres tall. In spring the Sun warms them, carbon-dioxide frost turns to gas and the ice expands and cracks. Blocks of ice and dust break off the edge and fall, raising clouds of fine material at the bottom.",
    note: "The first were caught on February 19, 2008, when one HiRISE picture held four avalanches at once; the largest dust cloud was about 180 m across. Some of the falling blocks are as big as a house.",
    accuracy: "First the site's own Mars, its north pole tipped toward the Sun as in northern spring, with the ring on the scarp where the 2008 avalanches were seen. Then a side-on diagram: the cliff's height and slope roughly in proportion, the layers fewer and the blocks larger than in reality.",
    art: { main: "mars", fx: "dust" },
    shotZoom: 1.1,
    shotPitch: 0.6,
    scene(ctx) {
      /* HiRISE PSP_007338_2640, Feb 19, 2008: 83.8°N 235.5°E (NASA/JPL/
       * University of Arizona, PIA10236). */
      const place = marsPlace(ctx, { lat: 83.8, lon: 235.5 - 360, reach: 4 * DEG, zoom: 1.2 });
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const where = H.label(["The north polar scarps, 84° N", "four avalanches caught here, Feb 19, 2008"], { align: "right", height: 0.041, colour: "#ffe3a8", declutter: false });
      const pole = H.label(["North pole, tipped toward the Sun: spring"], { at: [-0.45, 0.62, 0], height: 0.028, declutter: false });
      [where, pole].forEach((o) => ctx.fade(o, 0));

      /* ---- on black: the cliff, side on (the round-79 diagram, moved
       * left of the card and drawn at 0.75 size) */
      const AV = new THREE.Group();
      AV.position.set(-0.32, 0.0, 0);
      AV.scale.setScalar(0.75);
      hud.add(AV);
      const K = hudKit(ctx, AV);
      const top = 0.38;
      const base = -0.42;
      /* Slope about 65° (steeper than 60°, HiRISE/NASA PIA10236). */
      const run = (top - base) / Math.tan(65 * DEG);
      const xTop = -0.25;
      const xBase = xTop + run;
      const L = -1.05;
      const Rx = 0.75;
      const scarpX = (y) => lerp(xBase, xTop, (y - base) / (top - base)) + 0.02 * Math.sin(y * 30);
      const layers = 11;
      for (let k = 0; k < layers; k += 1) {
        const y0 = lerp(base, top, k / layers);
        const y1 = lerp(base, top, (k + 1) / layers);
        const colour = k < 2 ? "#5d4a3d" : k % 2 ? "#d7d0c4" : "#a8927c";
        solid(K, [[L, y0], [scarpX(y0), y0], [scarpX(y1), y1], [L, y1]], { colour, order: 18, z: 0 });
      }
      solid(K, [[L, -0.75], [Rx, -0.75], [Rx, base], [L, base]], { colour: "#4a3a30", order: 18 });
      const frost = solid(K, [[L, top - 0.025], [scarpX(top - 0.025), top - 0.025], [xTop + 0.01, top], [xTop + 0.01, top + 0.012], [L, top + 0.012]], { colour: "#f4f8ff", order: 19 });
      K.label(["layered ice and dust"], { at: [-0.62, 0.05, 0.02], height: 0.034, colour: "#2a1e16" });
      const frostLabel = K.label(["spring frost"], { at: [-0.7, top + 0.07, 0.02], height: 0.032 });
      K.arrow([Rx - 0.08, base, 0], [Rx - 0.08, top, 0], { colour: "#9fd0ff", head: 0.03 });
      K.arrow([Rx - 0.08, top, 0], [Rx - 0.08, base, 0], { colour: "#9fd0ff", head: 0.03 });
      K.label(["about 500 m", "slopes over 60°"], { at: [Rx - 0.12, top + 0.1, 0], align: "right", height: 0.05, colour: "#bfe0ff" });
      const sun = K.sun(0.04, { ...WHITE_SUN, halo: 3, haloOpacity: 0.5 });
      sun.position.set(0.45, 0.72, -0.1);
      const crack = K.line([[xTop - 0.1, top, 0.02], [xTop - 0.08, top - 0.08, 0.02], [xTop - 0.11, top - 0.15, 0.02], [xTop - 0.06, top - 0.22, 0.02]], { colour: "#1a120c", opacity: 1, additive: false });
      const r = rng(41);
      const blocks = Array.from({ length: 7 }, (_, i) => {
        const size = 0.018 + r() * 0.03;
        const rock = K.rock(size, { seed: 50 + i, colour: i % 2 ? "#d8d2c6" : "#a8927c", lumps: 0.3 });
        return {
          rock, size,
          start: new THREE.Vector3(xTop - 0.03 - r() * 0.08, top - 0.02 - r() * 0.2, 0.05),
          t0: 0.42 + i * 0.025 + r() * 0.02,
          out: 0.15 + r() * 0.45,
          spin: new THREE.Vector3(r(), r(), r()),
        };
      });
      const DUST = 700;
      const dust = K.cloud(DUST, { additive: false, size: 6 });
      const dustSeeds = Array.from({ length: DUST }, () => ({ a: r() * Math.PI, d: Math.sqrt(r()), s: 4 + r() * 8, t0: 0.46 + r() * 0.1 }));
      dustSeeds.forEach((s, i) => { dust.tint(i, r() > 0.5 ? "#c9b8a5" : "#a89482"); dust.size[i] = s.s; });
      const cloudLabel = K.label(["dust cloud", "up to ~180 m across"], { at: [xBase + 0.22, base + 0.36, 0.05], height: 0.044, colour: "#ffe3a8" });
      ctx.fade(AV, 0);

      ctx.tell([
        { at: 0, label: "Spring in the north", text: "The real Mars, its north pole tipping toward the Sun. Here, at the edge of the polar cap, cliffs of layered ice and dust half a kilometre tall." },
        { at: 0.3, label: "Cracking", text: "The Sun warms the cliffs: frost turns to gas and the ice expands; cracks open along the edge." },
        { at: 0.52, label: "Avalanche", text: "Blocks of ice and dust break away and crash hundreds of metres down slopes steeper than 60°." },
        { at: 0.76, label: "Caught in the act", text: "On February 19, 2008, HiRISE caught four at once, their dust clouds up to about 180 m across." },
      ]);

      const cut = cutter(ctx, null);
      return {
        duration: 24,
        update(p) {
          const real = p < 0.28;
          if (real) place.hold();
          ctx.fade(place.ring.ring, real ? smooth(p, 0.05, 0.09) : 0);
          ctx.fade(place.ring.dot, real ? smooth(p, 0.05, 0.09) : 0);
          pin(ctx, where, place.ring.centre(), -0.1, -0.16);
          ctx.fade(where, real ? smooth(p, 0.07, 0.11) : 0);
          ctx.fade(pole, real ? smooth(p, 0.0, 0.04) : 0);
          cut(!real);
          ctx.fade(AV, real ? 0 : smooth(p, 0.29, 0.32));
          if (real) return;
          hudLight(ctx, 0.6, 0.5, 0.6);
          /* The diagram's own clock, as in round 79. */
          const q = span(p, 0.28, 1);
          ctx.fade(frost, 1 - smooth(q, 0.05, 0.4));
          ctx.fade(frostLabel, 1 - smooth(q, 0.3, 0.4));
          ctx.fade(crack, smooth(q, 0.22, 0.34));
          blocks.forEach((b) => {
            const u = span(q, b.t0, b.t0 + 0.2);
            const fallH = b.start.y - base - b.size;
            const fallU = Math.min(1, u / 0.6);
            const y = b.start.y - fallH * fallU * fallU;
            const x = b.start.x + (scarpX(Math.max(base, y)) - xTop + 0.02) * fallU + b.out * smooth(u, 0.6, 1);
            const bounce = u > 0.6 ? Math.sin(Math.PI * span(u, 0.6, 1)) * 0.04 : 0;
            b.rock.position.set(x, Math.max(base + b.size, y) + bounce, 0.05);
            b.rock.rotation.set(b.spin.x * u * 12, b.spin.y * u * 12, b.spin.z * u * 12);
            b.rock.visible = q > 0.2;
          });
          dustSeeds.forEach((s, i) => {
            const u = span(q, s.t0, s.t0 + 0.35);
            const rad = 0.05 + u * 0.32 * s.d;
            dust.set(i, xBase + 0.08 + Math.cos(s.a) * rad * 1.2, base + Math.sin(s.a) * rad * 0.9, 0.06);
            dust.alpha[i] = u > 0 ? (1 - u * 0.6) * 0.5 * (1 - smooth(q, 0.9, 1) * 0.5) : 0;
          });
          dust.commit();
          ctx.fade(cloudLabel, smooth(q, 0.62, 0.68));
          sun.rotation.y = ctx.t * 0.1;
        },
      };
    },
  }),

  /* ----------------------------------------------------------------- 12 */
  event({
    id: "phobos-fall",
    section: "inner",
    body: "Mars",
    title: "Phobos's slow fall",
    place: "Mars and Phobos",
    kind: "ongoing",
    family: "orbit",
    when: "Breakup in 30–50 million years",
    often: "1.8 m closer every century",
    timeline: { last: "falling now", next: "a ring, in 30–50 million years" },
    detail: "Mars's inner moon orbits faster than Mars spins, and the tides it raises are dragging it down, about 1.8 m a century",
    frequency: "Continuous: Phobos sinks about 1.8 metres closer to Mars every hundred years, and the fall speeds up as it gets nearer.",
    cause: "Phobos orbits 6,000 km above Mars, three times every Martian day — faster than Mars turns. The bulge it raises on Mars is carried round more slowly than Phobos moves, so it lags behind and pulls back on it, stealing orbital energy. Phobos sinks; in 30 to 50 million years tides will tear it apart and its pieces will spread into a ring.",
    note: "Deimos, the outer moon, orbits beyond the point where a moon keeps pace with Mars's spin, so it is drifting slowly outward instead. The long grooves on Phobos may already be stretch marks from Mars's tides.",
    accuracy: "The site's own Mars, Phobos and Deimos, with the moons put on their real orbits to scale with Mars (the site usually draws them closer in); the moons themselves are drawn far larger than they are. Time is sped up — Phobos's laps and Mars's turns at their true ratio — and the tidal bulge is exaggerated. The spiral and the breakup are a diagram: the point where Phobos breaks up and the ring's width are estimates.",
    art: { main: "mars", second: "rock", fx: "spiral" },
    shotPitch: 0.95,
    scene(ctx) {
      /* Phobos semi-major axis 9,376 km = 2.77 Mars radii; synchronous
       * orbit 20,428 km = 6.03 radii; Deimos 23,463 km = 6.92 radii
       * (NASA). Inward 1.8 cm/yr (Jacobson 2010). Breakup taken at ~1.6
       * Mars radii (an estimate; drawing choice). */
      const PHOBOS_A = 9376 / MARS_RADIUS;
      const SYNC = 20428 / MARS_RADIUS;
      const DEIMOS_A = 23463 / MARS_RADIUS;
      const BREAK = 1.6;
      /* Phobos's period 7.654 h, Mars's day 24.623 h, Deimos 30.312 h
       * (NASA). */
      const P_PHOBOS = 7.654;
      const P_MARS = 24.623;
      const P_DEIMOS = 30.312;

      const mars = ctx.host;
      const phobos = ctx.findBody("Phobos");
      const deimos = ctx.findBody("Deimos");
      const pivot = phobos?.parent;
      const plane = pivot?.parent;
      if (!phobos || !pivot || !plane) return { duration: 24, update() {} };
      const dPivot = deimos?.parent ?? null;
      /* Mars's radius in the moons' orbit-plane units. */
      const Rw = worldRadius(mars);
      const planeScale = plane.getWorldScale(new THREE.Vector3()).x || 1;
      const RM = Rw / planeScale;
      const dScale = dPivot?.parent?.getWorldScale(new THREE.Vector3()).x || planeScale;
      const R0 = mars.rotation.y;
      const A0 = pivot.rotation.y;
      const D0 = dPivot?.rotation.y ?? 0;

      /* The site's own satellite guides sit where it draws the moons (closer
       * in), so they are hidden while the moons are on their real orbits. */
      let system = phobos;
      while (system && !/major satellite system$/.test(system.name ?? "")) system = system.parent;
      const guides = system ? system.children.filter((c) => /orbit|Orbit/.test(c.name ?? "")) : [];
      ctx.setVeil(guides);

      /* Far enough out to hold Deimos's orbit (drawing choice). */
      const fovM = THREE.MathUtils.degToRad(mars.userData?.focusFov ?? 30);
      const span0 = (DEIMOS_A * 1.25 * Rw) / Math.tan(fovM / 2);
      const yaw0 = yawFor(ctx.camDir);
      ctx.refocus("Mars", { shotYaw: yaw0, shotPitch: 0.95, shotDistance: span0 / offsetLength(0.95) });
      holdForShot(ctx, mars.getWorldPosition(new THREE.Vector3()), yaw0, 0.95, span0, 0.03);

      /* Drawn in the moons' own orbit plane, so the lines lie where they go. */
      const deck = new THREE.Group();
      ctx.attach(plane, deck);
      const K = hudKit(ctx, deck);
      const circle = (radius, colour, opacity, dashed = false) => K.circle(radius * RM, { colour, opacity, dashed, dash: RM * 0.25, gap: RM * 0.18, additive: false });
      const syncRing = circle(SYNC, "#9fd0ff", 0.85, true);
      const phobosOrbit = circle(PHOBOS_A, "#ffd27f", 0.8);
      const deimosOrbit = circle(DEIMOS_A, "#c8c0b4", 0.5);
      /* The tidal bulge, lagging behind Phobos (exaggerated). */
      const bulge = new THREE.Mesh(new THREE.SphereGeometry(RM * 1.02, 48, 24), new THREE.MeshBasicMaterial({ color: "#ffc09a", transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false }));
      bulge.scale.set(1.25, 0.96, 0.96);
      bulge.userData.baseOpacity = 0.4;
      bulge.raycast = () => {};
      deck.add(bulge);
      const spiralLine = K.line([[0, 0, 0], [0, 0, 0.001]], { colour: "#ffd27f", opacity: 0.95 });
      const zone = K.ring(RM * 1.3, RM * BREAK, { colour: "#ff6a4a", opacity: 0.22, additive: true });
      /* A mark on Mars's equator, turning with it. */
      const mark = ctx.glow("#ff5a4a", 0.16, { opacity: 1 });
      ctx.onHost(mark);
      mark.position.copy(bodyPoint(mars, 0, 0, 1.02));
      mark.scale.setScalar(bodyRadius(mars));
      /* The ring: debris spread over 1.3–2.0 radii (drawing choice). */
      const RING = 900;
      const ring = K.cloud(RING, { size: 2.6 });
      const r = rng(7);
      const debris = Array.from({ length: RING }, () => ({ rad: lerp(1.3, 2.0, r()), off: (r() - 0.5), dr: (r() - 0.5) * 0.06 }));
      debris.forEach((_, i) => ring.tint(i, r() > 0.5 ? "#b8a898" : "#8a7d70"));
      [syncRing, phobosOrbit, deimosOrbit, bulge, spiralLine, zone, mark].forEach((o) => ctx.fade(o, 0));

      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const phobosLabel = H.label(["Phobos", ""], { height: 0.041, colour: "#ffe3a8", declutter: false });
      const deimosLabel = H.label(["Deimos", "drifting outward"], { height: 0.035, declutter: false });
      const phobosRing = H.circle(0.03, { plane: "xy", colour: "#ffd27f", opacity: 0.95, additive: false });
      ctx.fade(phobosRing, 0);
      const syncLabel = H.label(["Synchronous orbit", "a moon here keeps pace with Mars's spin"], { align: "right", height: 0.035, colour: "#bfe0ff", declutter: false });
      const clock = H.label(["", "", ""], { at: [-0.98, 0.62, 0], align: "left", height: 0.054, declutter: false });
      [phobosLabel, deimosLabel, syncLabel, clock].forEach((o) => ctx.fade(o, 0));

      /* Radius against time: tidal decay keeps a^6.5 falling linearly (a
       * standard result for tides raised on the planet), scaled so breakup
       * comes at about 40 million years (drawing choice within 30–50). */
      const radiusAt = (f) => Math.pow(Math.pow(PHOBOS_A, 6.5) - f * (Math.pow(PHOBOS_A, 6.5) - Math.pow(BREAK, 6.5)), 1 / 6.5);
      /* The spiral: many turns, a drawing choice. */
      const TURNS = 9;
      const spiralPts = [];
      const posAt = (a, th, out = new THREE.Vector3()) => out.set(Math.cos(th) * a * RM, 0, -Math.sin(th) * a * RM);
      for (let i = 0; i <= 400; i += 1) {
        const f = i / 400;
        spiralPts.push(posAt(radiusAt(f), f * TAU * TURNS));
      }

      ctx.tell([
        { at: 0, label: "A moon too close", text: "The real Mars and Phobos, put on its real orbit: 6,000 km above the ground, round three times a Martian day — faster than Mars itself turns." },
        { at: 0.36, label: "Tides pull it in", text: "The bulge Phobos raises on Mars lags behind it and tugs it back. It sinks about 1.8 m every century." },
        { at: 0.5, label: "Spiralling down", text: "Millions of years pass. The closer it gets, the faster it falls." },
        { at: 0.78, label: "Torn apart", text: "In 30 to 50 million years Mars's tides break it up, and its pieces spread into a ring around the planet." },
      ]);

      const w = new THREE.Vector3();
      const local = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          /* Closer in for the fall, which happens inside 3 Mars radii. */
          ctx.aim(yaw0, 0.95);
          ctx.setZoomDistance((span0 * (p > 0.49 ? 0.55 : 1)) / offsetLength(0.95));
          /* Hours: the sped-up clock while Phobos laps Mars, 0.04-0.48. */
          const hours = P_MARS * 1.4 * span(p, 0.04, 0.48);
          const f = easeInOut(span(p, 0.5, 0.78));
          const a = p < 0.5 ? PHOBOS_A : radiusAt(f);
          const th = p < 0.5 ? A0 + (hours / P_PHOBOS) * TAU : A0 + (P_MARS * 1.4 / P_PHOBOS) * TAU + f * TAU * TURNS;
          /* The real Phobos on its real orbit (the site writes its own,
           * closer one each frame before this runs). */
          pivot.rotation.y = th;
          phobos.position.x = a * RM;
          phobos.position.y = 0;
          const intact = p < 0.79;
          phobos.visible = intact;
          if (deimos && dPivot) {
            dPivot.rotation.y = D0 + (hours / P_DEIMOS) * TAU + (p > 0.5 ? f * 0.6 : 0);
            deimos.position.x = (DEIMOS_A * Rw) / dScale;
            deimos.visible = true;
          }
          mars.rotation.y = R0 + (hours / P_MARS) * TAU;
          ctx.fade(mark, smooth(p, 0.04, 0.08) * (1 - smooth(p, 0.48, 0.52)));
          ctx.fade(phobosOrbit, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.5, 0.56) * 0.6));
          ctx.fade(deimosOrbit, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.5, 0.56)));
          ctx.fade(syncRing, smooth(p, 0.18, 0.24) * (1 - smooth(p, 0.5, 0.56)));
          /* The bulge points behind Phobos (it trails, in the sense the
           * moon moves: pivot.rotation.y increasing). */
          bulge.rotation.y = th - 0.4;
          ctx.fade(bulge, smooth(p, 0.36, 0.42) * (1 - smooth(p, 0.78, 0.82)));
          const n = Math.max(2, Math.round(400 * f) + 1);
          K.setLine(spiralLine, spiralPts.slice(0, n));
          ctx.fade(spiralLine, smooth(p, 0.5, 0.53) * (1 - smooth(p, 0.9, 0.96)));
          ctx.fade(zone, smooth(p, 0.56, 0.64));
          /* Breakup, and the ring spreading. */
          const spread = smooth(p, 0.79, 0.97);
          debris.forEach((d, i) => {
            const ang = th + d.off * (0.3 + spread * TAU) + ctx.t * 0.25 / d.rad;
            const rad = lerp(BREAK, d.rad, spread) + d.dr * (1 - spread);
            posAt(rad, ang, local);
            ring.set(i, local.x, local.y, local.z);
            ring.alpha[i] = p > 0.785 ? 0.9 : 0;
          });
          ring.commit();

          /* Labels on the real moons. */
          phobos.getWorldPosition(w);
          pin(ctx, phobosLabel, w, 0, 0.08);
          const hp = toHud(ctx, w);
          phobosRing.position.set(hp.x, hp.y, 0);
          ctx.fade(phobosRing, intact ? smooth(p, 0.02, 0.05) : 0);
          const km = a * MARS_RADIUS - MARS_RADIUS;
          phobosLabel.userData.draw(["Phobos", `${fmt(Math.round(km / 100) * 100)} km up`]);
          ctx.fade(phobosLabel, intact ? smooth(p, 0.02, 0.05) : 0);
          if (deimos) {
            deimos.getWorldPosition(w);
            pin(ctx, deimosLabel, w, 0, -0.07);
          }
          ctx.fade(deimosLabel, deimos ? smooth(p, 0.04, 0.08) * (1 - smooth(p, 0.46, 0.5)) : 0);
          /* The synchronous ring's label at its leftmost point on screen. */
          let best = null;
          for (let k = 0; k < 16; k += 1) {
            const a2 = (k / 16) * TAU;
            const hq = toHud(ctx, plane.localToWorld(local.set(Math.cos(a2) * SYNC * RM, 0, Math.sin(a2) * SYNC * RM)));
            if (!best || hq.x < best.x) best = hq.clone();
          }
          syncLabel.position.set(best.x - 0.03, best.y + 0.04, 0);
          ctx.fade(syncLabel, smooth(p, 0.2, 0.26) * (1 - smooth(p, 0.46, 0.5)));
          const myr = p < 0.5 ? 0 : p < 0.79 ? 40 * f : lerp(40, 50, span(p, 0.79, 0.97));
          clock.userData.draw(p < 0.5
            ? [`${Math.floor(hours)} h, sped up`, `Phobos laps: ${(hours / P_PHOBOS).toFixed(1)}`, `Mars turns: ${(hours / P_MARS).toFixed(2)}`]
            : [`+${myr.toFixed(0)} million years`, p < 0.79 ? "falling faster and faster" : "torn apart: a ring around Mars", ""]);
          ctx.fade(clock, smooth(p, 0.03, 0.06));
        },
        dispose() { phobos.visible = true; },
      };
    },
  }),
];

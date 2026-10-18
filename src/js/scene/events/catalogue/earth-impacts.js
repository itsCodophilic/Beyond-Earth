import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { bodyRadius, surfacePoint as bodyPoint, yawFor, flyTo, cutter, yawWithRight, cameraAxes, earthPlace, finderRing } from "./real.js";
import { earthLayers, earthSkin, moonRig, spinner } from "./earthMoon.js";
import { smallBodyAuToScene } from "../../smallBodies/smallBodies.js";
import { setOrbitPosition } from "../../orbits.js";

/**
 * Section 3b of the catalogue: Earth's impacts, close calls, sky and fields
 * (round 79).
 *
 * Rocks that hit, burst over or skim past Earth, a second moon that stayed
 * for two months, the night the stars fell, and three slow things about the
 * planet itself: the wobble of its axis, the flipping of its magnetic field,
 * and the dust it sees glowing after sunset. Round 83 (Prompts.md: "do it
 * with the real bodies"): the impacts, the close pass, the mini-moon, the
 * Leonids, the wobble and the zodiacal light now play on the site's own
 * Earth, Moon and Sun, with painted ground views where the event is seen
 * from the ground; the 1972 fireball, the magnetic flip and STEVE stay
 * dioramas. The `accuracy` field says what is to scale.
 *
 * Earth's radius 6,371 km and GM 398,600 km³/s² are NASA's Earth fact sheet
 * (nssdc.gsfc.nasa.gov/planetary/factsheet) wherever they are used.
 */

const V = THREE.Vector3;
const D2R = Math.PI / 180;
/* NASA Earth fact sheet: mean radius, km; GM, km³/s². */
const EARTH_R = 6371;
const EARTH_GM = 398600;

const fmt = (n) => Math.round(n).toLocaleString("en-US");

/* ------------------------------------------------------------ local helpers */

/*
 * A point on a kit ball at latitude/longitude, in the ball's own axes. The
 * three.js sphere wraps an equirectangular map with longitude 0 on +x and
 * 90° E on -z (kit's ctx.onSphere uses a different convention, so it does not
 * line up with the map).
 */
function geo(r, lat, lon) {
  const a = lat * D2R;
  const b = lon * D2R;
  return new V(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b));
}
/* The rotation.y that turns longitude `lon` to face the viewer (+z). */
const faceLon = (lon) => -Math.PI / 2 - lon * D2R;

/* Two unit vectors at right angles to `c` (a unit vector). */
function tangents(c) {
  const up = Math.abs(c.y) < 0.9 ? new V(0, 1, 0) : new V(1, 0, 0);
  const e1 = new V().crossVectors(up, c).normalize();
  const e2 = new V().crossVectors(c, e1).normalize();
  return [e1, e2];
}

/* Many short line segments with per-vertex colour (meteors, trees, streaks). */
function streaks(ctx, n, { additive = true, opacity = 1, parent = ctx.root, order = 23 } = {}) {
  const pos = new Float32Array(n * 6);
  const col = new Float32Array(n * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.raycast = () => {};
  lines.renderOrder = order;
  lines.userData.baseOpacity = opacity;
  parent.add(lines);
  return {
    lines,
    set(i, ax, ay, az, bx, by, bz, ca, cb = ca, ka = 1, kb = ka) {
      pos[i * 6] = ax; pos[i * 6 + 1] = ay; pos[i * 6 + 2] = az;
      pos[i * 6 + 3] = bx; pos[i * 6 + 4] = by; pos[i * 6 + 5] = bz;
      col[i * 6] = ca.r * ka; col[i * 6 + 1] = ca.g * ka; col[i * 6 + 2] = ca.b * ka;
      col[i * 6 + 3] = cb.r * kb; col[i * 6 + 4] = cb.g * kb; col[i * 6 + 5] = cb.b * kb;
    },
    hide(i) { for (let k = 0; k < 6; k += 1) { pos[i * 6 + k] = 0; col[i * 6 + k] = 0; } },
    commit() {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
  };
}

/* A rectangle shaded from `bottom` colour to `top` colour (skies). */
function gradient(ctx, x0, x1, y0, y1, top, bottom, { opacity = 1, z = -0.08, parent = ctx.root, order = 17 } = {}) {
  const geometry = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 1, 12);
  const position = geometry.attributes.position;
  const colours = new Float32Array(position.count * 3);
  const ct = new THREE.Color(top);
  const cb = new THREE.Color(bottom);
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const t = clamp01(position.getY(i) / (y1 - y0) + 0.5);
    c.copy(cb).lerp(ct, Math.pow(t, 0.8));
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false,
  }));
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  mesh.renderOrder = order;
  mesh.raycast = () => {};
  mesh.userData.baseOpacity = opacity;
  parent.add(mesh);
  return mesh;
}

/* A dark skyline along the bottom of a sky view: hills and pointed trees. */
function skyline(ctx, x0, x1, base, { seed = 5, trees = true, colour = "#020407", parent = ctx.root } = {}) {
  const r = rng(seed);
  const pts = [[x0, -0.9]];
  const n = 90;
  for (let i = 0; i <= n; i += 1) {
    const x = lerp(x0, x1, i / n);
    const hill = base + 0.035 * Math.sin(x * 2.1 + seed) + 0.02 * Math.sin(x * 5.3);
    if (trees && r() < 0.55) {
      const h = 0.03 + r() * 0.07;
      pts.push([x - 0.006, hill], [x, hill + h], [x + 0.006, hill]);
    } else {
      pts.push([x, hill]);
    }
  }
  pts.push([x1, -0.9]);
  const mesh = ctx.shape(pts, { colour, opacity: 1, parent });
  mesh.position.z = 0.02;
  mesh.renderOrder = 27;
  return mesh;
}

/* A plain star cloud inside a rectangle (sky views), at z = 0. */
function skyStars(ctx, count, x0, x1, y0, y1, { seed = 9, parent = ctx.root } = {}) {
  const r = rng(seed);
  const stars = ctx.cloud(count, { parent });
  const base = [];
  for (let i = 0; i < count; i += 1) {
    stars.set(i, lerp(x0, x1, r()), lerp(y0, y1, Math.pow(r(), 0.8)), -0.02);
    stars.size[i] = 1.2 + Math.pow(r(), 3) * 3;
    base.push(0.25 + r() * 0.65);
    stars.alpha[i] = base[i];
    const warm = r();
    stars.tint(i, warm > 0.82 ? "#ffd9b0" : warm < 0.18 ? "#bcd4ff" : "#f2f4ff");
  }
  stars.commit();
  stars.base = base;
  return stars;
}

/* ------------------------------------------------ the view from the ground */

/*
 * Round 83 (Prompts.md: Tunguska "in an animated forest view in the
 * daylight ... how the million trees got affected", Chelyabinsk the same
 * "instead of forest we have to show city"). A small 3D landscape held in
 * front of the lens on the hud layer (so it plays after a cut to black):
 * the eye 0.45 units above flat ground, the horizon across the middle of
 * the screen, everything drawn in hud units (1 = half the screen's height
 * at the hud's distance). Distances are compressed, as in a painting: what
 * is to scale is said on each card.
 */
const EYE = 0.45;

function groundView(ctx, parent, { skyTop, skyLow, groundNear, groundFar, seed = 7, hills = "#5d7088", far = -34 }) {
  const group = new THREE.Group();
  parent.add(group);
  /* The sky: a tall gradient card far off. */
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 40, 1, 24), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false, transparent: true, depthWrite: false }));
  {
    const pos = sky.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color(skyTop);
    const low = new THREE.Color(skyLow);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const t = THREE.MathUtils.clamp((pos.getY(i) + 1.2) / 14, 0, 1);
      c.copy(low).lerp(top, Math.pow(t, 0.6));
      col.set([c.r, c.g, c.b], i * 3);
    }
    sky.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  sky.position.set(0, 6, far - 2);
  sky.renderOrder = 1;
  group.add(sky);
  /* A white veil over the sky for the flash. */
  const flashSky = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), new THREE.MeshBasicMaterial({ color: "#fff8e8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  flashSky.position.set(0, 6, far - 1.9);
  flashSky.renderOrder = 2;
  flashSky.userData.baseOpacity = 1;
  group.add(flashSky);
  /* Distant hills. */
  const r = rng(seed);
  const pts = [[-60, -EYE - 0.5]];
  for (let i = 0; i <= 120; i += 1) {
    const x = -60 + i;
    pts.push([x, -EYE + 0.9 + 0.7 * Math.sin(x * 0.11 + seed) + 0.4 * Math.sin(x * 0.37) + r() * 0.15]);
  }
  pts.push([60, -EYE - 0.5]);
  const hill = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))), new THREE.MeshBasicMaterial({ color: hills, toneMapped: false, fog: false, transparent: true, depthWrite: false }));
  hill.position.z = far;
  hill.renderOrder = 3;
  group.add(hill);
  /* The ground: a big plane, shaded from near to far, recoloured as the
   * blast sweeps it (colour attribute, per vertex). */
  const SEG = 72;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, -far + 6, SEG, SEG), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -EYE, (far + 6) / 2);
  ground.renderOrder = 4;
  group.add(ground);
  const gpos = ground.geometry.attributes.position;
  const gcol = new Float32Array(gpos.count * 3);
  ground.geometry.setAttribute("color", new THREE.BufferAttribute(gcol, 3));
  const nearC = new THREE.Color(groundNear);
  const farC = new THREE.Color(groundFar);
  const noise = Array.from({ length: gpos.count }, () => r());
  /* World (hud) x, z of each ground vertex. */
  const gx = new Float32Array(gpos.count);
  const gz = new Float32Array(gpos.count);
  for (let i = 0; i < gpos.count; i += 1) {
    gx[i] = gpos.getX(i);
    gz[i] = -gpos.getY(i) + ground.position.z;
  }
  const paint = (colourAt) => {
    const c = new THREE.Color();
    for (let i = 0; i < gpos.count; i += 1) {
      const t = THREE.MathUtils.clamp(-gz[i] / -far, 0, 1);
      c.copy(nearC).lerp(farC, Math.pow(t, 0.55)).multiplyScalar(0.9 + 0.2 * noise[i]);
      if (colourAt) colourAt(gx[i], gz[i], c, t);
      gcol.set([c.r, c.g, c.b], i * 3);
    }
    ground.geometry.attributes.color.needsUpdate = true;
  };
  paint(null);
  group.traverse((o) => { o.raycast = () => {}; });
  return { group, sky, flashSky, ground, paint };
}

/* Shading baked into a geometry's vertex colours: lit from `light`. */
function bakeShade(geometry, colour, light = new THREE.Vector3(-0.5, 0.7, 0.5).normalize(), ambient = 0.45) {
  geometry.computeVertexNormals();
  const n = geometry.attributes.normal;
  const col = new Float32Array(n.count * 3);
  const c = new THREE.Color(colour);
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i += 1) {
    v.fromBufferAttribute(n, i);
    const k = ambient + (1 - ambient) * Math.max(0, v.dot(light));
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geometry;
}

/*
 * A conifer forest on the ground: two instanced meshes (crowns, trunks)
 * sharing one matrix per tree, which falls about its foot, away from
 * `zero` (the point under the burst), when the blast reaches it.
 */
function forest(ctx, parent, { count = 2400, zero, seed = 1908, far = -30 }) {
  const crownG = bakeShade(new THREE.ConeGeometry(0.05, 0.17, 7).translate(0, 0.16, 0), "#ffffff");
  const trunkG = bakeShade(new THREE.CylinderGeometry(0.007, 0.01, 0.1, 5).translate(0, 0.05, 0), "#ffffff");
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }), count);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }), count);
  [crowns, trunks].forEach((m) => { m.frustumCulled = false; m.raycast = () => {}; m.renderOrder = 5; parent.add(m); });
  const r = rng(seed);
  const trees = [];
  const haze = new THREE.Color("#a9b9c9");
  for (let i = 0; i < count; i += 1) {
    /* More trees near the eye, spread wider far off. */
    const z = lerp(1.6, far + 2, Math.pow(r(), 0.75));
    const w = 1.2 + Math.abs(z) * 0.85;
    const x = (r() - 0.5) * 2 * w;
    const s = 0.75 + r() * 0.6;
    const dx = x - zero.x;
    const dz = z - zero.z;
    const d = Math.hypot(dx, dz);
    const depth = THREE.MathUtils.clamp(-z / -far, 0, 1);
    const crown = new THREE.Color().setHSL(0.3 + r() * 0.05, 0.45, 0.16 + r() * 0.08).lerp(haze, depth * 0.7);
    const bark = new THREE.Color("#5a4030").lerp(haze, depth * 0.7);
    crowns.setColorAt(i, crown);
    trunks.setColorAt(i, bark);
    trees.push({ x, z, s, d, axis: new THREE.Vector3(dz, 0, -dx).normalize(), lean: (r() - 0.5) * 0.25, crown, bark, yaw: r() * TAU });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const charred = new THREE.Color("#2a1f18");
  /* Thrown-down crowns, scorched by the flash and torn (drawing choice). */
  const dried = new THREE.Color("#5e5232");
  const set = (fallOf, stripOf) => {
    trees.forEach((t, i) => {
      const fall = fallOf(t);
      const strip = stripOf(t);
      qYaw.setFromAxisAngle(up, t.yaw);
      q.setFromAxisAngle(t.axis, (Math.PI / 2 - 0.08 + t.lean * 0.3) * fall).multiply(qYaw);
      pos.set(t.x, -EYE, t.z);
      scl.setScalar(t.s);
      m.compose(pos, q, scl);
      trunks.setMatrixAt(i, m);
      scl.set(t.s * (1 - 0.85 * strip), t.s * (1 - 0.5 * strip), t.s * (1 - 0.85 * strip));
      m.compose(pos, q, scl);
      crowns.setMatrixAt(i, m);
      if (strip > 0) crowns.setColorAt(i, t.crown.clone().lerp(charred, strip));
      else if (fall > 0) crowns.setColorAt(i, t.crown.clone().lerp(dried, 0.55 * fall));
    });
    crowns.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  };
  return { crowns, trunks, trees, set };
}

/* ------------------------------------------------------------------ events */

export const EARTH_IMPACT_EVENTS = [
  /* -------------------------------------------------------------- chicxulub */
  event({
    id: "chicxulub",
    section: "earth",
    body: "Earth",
    title: "Chicxulub: the dinosaur-ending impact",
    place: "Earth · the Yucatán coast, Mexico",
    kind: "recorded",
    family: "impact",
    when: "66 million years ago",
    often: "once, 66 million years ago",
    detail: "A rock about 10 km wide hit the Yucatán coast, left a crater about 180 km across, and darkened the whole sky for years",
    frequency: "An impact this size is thought to happen roughly once every hundred million years or so. Nothing this big is known to be on a collision course today.",
    cause: "An asteroid about 10 km wide struck a shallow sea over rocks rich in sulphur. The blast threw molten rock around the planet, set off fires, and lofted dust, soot and sulphur droplets high into the atmosphere, where they dimmed the Sun for years and plants could barely grow.",
    note: "The clue was a thin layer of clay rich in iridium, a metal rare on Earth's surface but common in asteroids, found worldwide by Luis and Walter Alvarez in 1980. The buried crater itself was confirmed in 1991. About three quarters of all species died out, including every dinosaur that could not fly.",
    accuracy: "Played on the site's own Earth, wound back to 66 million years ago: its map is replaced by NASA's Blue Marble with the continents turned back to roughly where published reconstructions put them then (a coarse approximation, good to several degrees), with shallow seas over low ground and no ice caps. The asteroid is hugely enlarged (at true scale it would be far smaller than a pixel). The fireball, the ejecta, the fires and the dark veil are illustrations of how they spread, not a model; the inset's crater and asteroid are to one scale. The clock is approximate.",
    art: { main: "earth", second: "rock", fx: "impact" },
    shotZoom: 1.7,
    shotPitch: 0.3,
    facesSun: true,
    shotSwing: 0.55,
    scene(ctx) {
      const earth = ctx.host;
      /* The camera on the sunlit side, swung -0.55 rad off the Sun's line
       * (set here, so it does not depend on where the camera came from). */
      ctx.refocus("Earth", { shotYaw: yawFor(ctx.sunDir.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.55)), shotZoom: 1.7, shotPitch: 0.3 });
      const U = ctx.unit;
      const R = bodyRadius(earth);
      /* Crater centre about 21.4° N, 89.5° W (Hildebrand et al. 1991). */
      const LAT = 21.4;
      const LON = -89.5;
      const layers = earthLayers(earth);
      const skin = earthSkin(ctx, earth, "paleo");
      const su = skin.userData.u;
      const spin = spinner(earth);
      const rig = moonRig(ctx);
      const site = bodyPoint(earth, LAT, LON, 1).normalize();
      su.uHit.value.copy(site);
      const [e1, e2] = tangents(site);

      /* The asteroid (enlarged) and its trail, in root units (Earth radii). */
      const rock = ctx.rock(0.035, { seed: 5, colour: "#6f655b", lumps: 0.3 });
      const heat = ctx.glow("#ffb27a", 0.35, { opacity: 0 });
      const trail = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd2a0", opacity: 0.9 });
      const rockLabel = ctx.label(["Asteroid, about 10 km wide", "(greatly enlarged)"], { height: 0.028, align: "left", declutter: false });
      const flash = ctx.glow("#fff4d6", 1, { opacity: 0 });
      const fire = ctx.glow("#ff7a2e", 0.6, { opacity: 0 });

      /* On the Earth itself: the crater mark and the shock ring. */
      const surface = new THREE.Group();
      ctx.attach(earth, surface);
      const ringPts = (ang) => {
        const pts = [];
        for (let k = 0; k <= 96; k += 1) {
          const a = (k / 96) * TAU;
          pts.push(site.clone().multiplyScalar(Math.cos(ang)).addScaledVector(e1, Math.sin(ang) * Math.cos(a)).addScaledVector(e2, Math.sin(ang) * Math.sin(a)).multiplyScalar(R * 1.012));
        }
        return pts;
      };
      /* Crater about 180 km across (Hildebrand et al. 1991): 90 km of 6,371. */
      const crater = ctx.line(ringPts(90 / EARTH_R), { colour: "#ffcf8a", opacity: 0.95, parent: surface, additive: false });
      const shock = ctx.line(ringPts(0.01), { colour: "#e8f4ff", opacity: 0.9, parent: surface });
      const craterLabel = ctx.label(["Chicxulub crater", "about 180 km across"], { parent: surface, at: site.clone().multiplyScalar(R * 1.08).addScaledVector(e1, R * 0.18), height: 0.024, align: "left", declutter: false });

      /* Ejecta: each grain flies out on a ballistic arc in its own direction
       * and lands somewhere between near the rim and a third of the way
       * round the world (illustration). In Earth's own frame. */
      const random = rng(66);
      const NE = 1800;
      const ejecta = ctx.cloud(NE, { size: 3, parent: surface });
      const grains = [];
      for (let i = 0; i < NE; i += 1) {
        const range = 0.03 + 1.55 * Math.pow(random(), 2.4);
        grains.push({ phi: random() * TAU, range, t0: random() * 0.03, life: 0.06 + 0.2 * Math.sqrt(range / 1.58), hgt: 0.05 + 0.4 * Math.sqrt(range / 1.58) });
        ejecta.tint(i, random() < 0.5 ? "#ffcf80" : "#ff9a5a");
        ejecta.alpha[i] = 0;
      }
      ejecta.commit();

      const hud = ctx.hudLayer();
      /* Inset: the crater and the asteroid to one scale. */
      const inset = new THREE.Group();
      inset.position.set(-0.86, 0.36, 0.05);
      hud.add(inset);
      ctx.disc(0.2, { colour: "#05070c", opacity: 0.8, parent: inset }).position.z = -0.01;
      const k = 0.14 / 90;
      ctx.disc(90 * k, { colour: "#5a3a22", opacity: 0.55, parent: inset });
      ctx.circle(90 * k, { plane: "xy", colour: "#ffcf8a", opacity: 0.95, parent: inset, additive: false });
      ctx.disc(5 * k, { colour: "#ffffff", opacity: 1, parent: inset }).position.z = 0.01;
      ctx.label(["Crater and asteroid", "to the same scale"], { parent: inset, at: [0, -0.25, 0], height: 0.022, declutter: false });
      const clock = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const toll = ctx.label(["About 3 in 4 species died out", "including every dinosaur that could not fly"], { parent: hud, at: [0, -0.6, 0], height: 0.03, declutter: false });
      ctx.fade(inset, 0);
      ctx.fade(toll, 0);

      ctx.tell([
        { at: 0, label: "Back in time", text: "Our Earth, wound back 66 million years. The continents slide back toward where they were: a narrower Atlantic, India an island, shallow seas over the land." },
        { at: 0.2, label: "The asteroid", text: "A rock about 10 km wide falls toward the shallow sea off what is now Mexico's Yucatán coast." },
        { at: 0.32, label: "Impact", text: "A flash, a fireball, and a shock wave racing out across the ground. A crater about 180 km across." },
        { at: 0.42, label: "Fire from the sky", text: "Molten rock thrown out of the crater falls back all round the world, glowing as it re-enters, and sets forests alight." },
        { at: 0.62, label: "The veil", text: "Dust, soot and sulphur spread through the whole atmosphere. Sunlight was dimmed for years, and about three quarters of all species died out." },
      ]);

      let lastT = ctx.t;
      let from = null;
      const hit = new THREE.Vector3();
      const E = new THREE.Vector3();
      const P = new THREE.Vector3();
      const dir = new THREE.Vector3();
      const qE = new THREE.Quaternion();
      return {
        duration: 26,
        update(p) {
          const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
          lastT = ctx.t;
          earth.getWorldPosition(E);
          /* Rewind, then the Yucatán turned toward us, on the lit side. */
          const rewind = win(p, 0.02, 0.15, 0.04);
          if (p < 0.16) spin.add(-dt * 12 * rewind * rewind);
          else {
            const { right } = cameraAxes(ctx.camera);
            /* Left of centre, clear of the event card, on the lit side. */
            const want = ctx.camDir.clone().multiplyScalar(0.78).addScaledVector(right, -0.42).addScaledVector(ctx.sunDir, 0.25).normalize();
            spin.turnToward(LAT, LON, want, p < 0.2 ? 0.06 : 0.12);
          }
          if (rig) rig.place(E.clone().addScaledVector(ctx.camDir, -rig.distance));
          su.uMix.value = smooth(p, 0.05, 0.14);
          layers.fade("lights", 1 - smooth(p, 0.03, 0.07));
          layers.fade("clouds", lerp(1, 0.4, smooth(p, 0.05, 0.14)) * (1 - 0.6 * smooth(p, 0.62, 0.8)));
          const years = p < 0.15 ? 66e6 * Math.pow(span(p, 0.02, 0.14), 2) : 66e6;

          /* The site, in root (world axes, Earth radii). */
          earth.getWorldQuaternion(qE);
          hit.copy(site).applyQuaternion(qE);
          /* In from the north-east, steeply (impact angle probably 45-60°,
           * Collins et al. 2020). Set once, as it starts. */
          if (!from && p > 0.19) {
            const north = new THREE.Vector3(0, 1, 0).applyQuaternion(qE);
            const east = north.clone().cross(hit).normalize();
            const n2 = hit.clone().cross(east).normalize();
            from = hit.clone().multiplyScalar(0.85).addScaledVector(east, 0.4).addScaledVector(n2, 0.35).normalize();
          }
          const u = span(p, 0.2, 0.32);
          if (from) {
            /* Along a straight line from ~5 Earth radii out to the surface. */
            const start = hit.clone().addScaledVector(from, 5);
            const end = hit.clone().multiplyScalar(1.0);
            P.lerpVectors(start, end, Math.pow(u, 1.5));
            rock.position.copy(P);
            rock.rotation.set(ctx.t * 0.7, ctx.t * 0.5, 0);
            rock.visible = p > 0.2 && p < 0.32;
            heat.position.copy(P);
            const inAir = smooth(P.length(), 1.12, 1.0);
            heat.scale.setScalar(0.12 + 0.5 * inAir);
            ctx.fade(heat, p > 0.2 && p < 0.32 ? 0.35 + 0.65 * inAir : 0);
            ctx.setLine(trail, [start.clone().lerp(P, Math.max(0, 1 - 0.35 / Math.max(0.35, u))), P]);
            ctx.fade(trail, p > 0.2 && p < 0.32 ? smooth(p, 0.21, 0.23) : 1 - smooth(p, 0.32, 0.36));
            rockLabel.position.copy(P).addScaledVector(from, 0.3).add(new THREE.Vector3(0, 0.2, 0));
            ctx.fade(rockLabel, smooth(p, 0.21, 0.23) * (1 - smooth(p, 0.28, 0.3)));
          }
          /* Flash, fireball, glow at the site. */
          const f = span(p, 0.32, 0.42);
          flash.position.copy(hit).multiplyScalar(1.03);
          flash.scale.setScalar(0.2 + 3.2 * Math.sqrt(f));
          ctx.fade(flash, p >= 0.32 ? (1 - f) * (1 - f) : 0);
          fire.position.copy(hit).multiplyScalar(1.05 + 0.25 * span(p, 0.32, 0.5));
          fire.scale.setScalar(0.3 + 1.1 * span(p, 0.32, 0.45));
          ctx.fade(fire, p >= 0.32 ? 0.9 * (1 - smooth(p, 0.38, 0.6)) : 0);
          su.uFire.value = p >= 0.32 ? 2.5 * (1 - smooth(p, 0.36, 0.7)) : 0;
          /* The shock wave across the ground. */
          const sw = span(p, 0.32, 0.46);
          ctx.setLine(shock, ringPts(Math.max(0.01, 0.9 * Math.sqrt(sw))));
          ctx.fade(shock, p > 0.32 ? 1 - sw : 0);
          ctx.fade(crater, smooth(p, 0.36, 0.42) * (1 - 0.6 * smooth(p, 0.7, 0.8)));
          ctx.fade(craterLabel, smooth(p, 0.38, 0.42) * (1 - smooth(p, 0.56, 0.6)));
          /* Ejecta. */
          const tE = span(p, 0.32, 0.62);
          for (let i = 0; i < NE; i += 1) {
            const g = grains[i];
            const t = (tE - g.t0) / g.life;
            if (t <= 0) { ejecta.alpha[i] = 0; continue; }
            const tt = Math.min(1, t);
            const s = g.range * tt;
            const h = R * g.hgt * Math.sin(Math.PI * tt);
            dir.copy(e1).multiplyScalar(Math.cos(g.phi)).addScaledVector(e2, Math.sin(g.phi));
            P.copy(site).multiplyScalar(Math.cos(s)).addScaledVector(dir, Math.sin(s)).multiplyScalar(R * 1.01 + h);
            ejecta.set(i, P.x, P.y, P.z);
            ejecta.alpha[i] = t < 1 ? 0.9 : 0.4 * (1 - smooth(p, 0.55, 0.7));
          }
          ejecta.commit();
          /* Fires spreading round the world, then the veil. */
          /* The ejecta take an hour or so to rain back all round the world;
           * the fires spread out from the site over that time. */
          su.uReach.value = Math.PI * 1.1 * easeInOut(span(p, 0.42, 0.64));
          su.uBurn.value = smooth(p, 0.42, 0.48) * (1 - 0.7 * smooth(p, 0.66, 0.85));
          su.uDark.value = 0.82 * smooth(p, 0.6, 0.86);
          layers.fade("air", 1 - 0.5 * smooth(p, 0.62, 0.86));

          ctx.fade(inset, win(p, 0.4, 0.74, 0.04));
          if (p < 0.2) {
            clock.userData.draw([p < 0.02 ? "Today" : `${Math.round(years / 1e6)} million years ago`, p < 0.15 ? "winding back time" : "the end of the age of dinosaurs"]);
          } else if (p < 0.32) {
            clock.userData.draw(["66 million years ago", "the asteroid is minutes away"]);
          } else {
            const secs = Math.pow(10, lerp(0, 8, span(p, 0.325, 0.95)));
            const t = secs < 60 ? `${Math.round(secs)} seconds` : secs < 3600 ? `${Math.round(secs / 60)} minutes`
              : secs < 86400 ? `${Math.round(secs / 3600)} hours` : secs < 86400 * 60 ? `${Math.round(secs / 86400)} days`
                : secs < 86400 * 365 ? `${Math.round(secs / (86400 * 30.4))} months` : `${(secs / (86400 * 365.25)).toFixed(1)} years`;
            const phase = p < 0.42 ? "flash, fireball and shock wave" : p < 0.62 ? "fire falls from the sky" : "the veil: years of dusk";
            clock.userData.draw([`About ${t} after impact`, phase]);
          }
          ctx.fade(toll, smooth(p, 0.82, 0.88));
        },
        dispose() { layers.restore(); spin.restore(); rig?.restore(); },
      };
    },
  }),

  /* --------------------------------------------------------------- tunguska */
  event({
    id: "tunguska",
    section: "earth",
    body: "Earth",
    title: "Tunguska",
    place: "Earth · Siberia, near the Podkamennaya Tunguska river",
    kind: "recorded",
    family: "impact",
    when: "June 30, 1908",
    often: "once, 1908",
    timeline: { last: "June 30, 1908, about 7:14 a.m. local time", next: "Airbursts this size are thought to come every few centuries" },
    detail: "A space rock exploded a few kilometres above the Siberian forest and flattened about 2,150 km² of trees, without leaving a crater",
    frequency: "The largest impact event in recorded history. Estimates of how often one this size happens range from about once a century to once in several centuries.",
    cause: "A rock tens of metres wide — most estimates say a stony asteroid about 50–60 m across — entered the atmosphere at many kilometres a second. The air in front of it heated and squeezed it until it broke apart and burst, about 5–10 km up. The blast wave, not the rock, did the damage.",
    note: "The flattened forest is shaped like a butterfly, about 70 km across the wings. Right below the burst the trees were left standing, stripped of their branches, because the blast hit them from straight above. Leonid Kulik's expedition reached the site in 1927 and found no crater.",
    accuracy: "First on the site's own Earth, the rock drawn far larger than real. Then a painted view from the forest floor: distances there are compressed (the burst was 5–10 km up and kilometres away), and each drawn tree stands for very many. The map at the end is to scale: an outline simplified from the surveyed butterfly, 70 km across and 55 km long, sized to 2,150 km². The burst's energy is estimated at about 3 to 15 megatons, and remains uncertain.",
    art: { main: "earth", second: "rock", fx: "burst" },
    shotZoom: 1.55,
    shotPitch: 0.62,
    facesSun: true,
    shotSwing: 0.6,
    scene(ctx) {
      const earth = ctx.host;
      /* The camera on the sunlit side, swung -0.6 rad off the Sun's line
       * (set here, so it does not depend on where the camera came from). */
      ctx.refocus("Earth", { shotYaw: yawFor(ctx.sunDir.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6)), shotZoom: 1.55, shotPitch: 0.62 });
      /* The epicentre, 60.886° N, 101.894° E (Longo et al. 2005). */
      const LAT = 60.886;
      const LON = 101.894;
      const spin = spinner(earth);
      const site = bodyPoint(earth, LAT, LON, 1).normalize();
      const place = earthPlace(ctx, earth, LAT, LON, ["Siberia", "Tunguska, 1908"]);
      const rock = ctx.glow("#fff1cc", 0.25, { opacity: 0 });
      const trail = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd9a8", opacity: 0.9 });
      const burstGlow = ctx.glow("#fff6dd", 0.6, { opacity: 0 });

      const hud = ctx.hudLayer();
      const clock = ctx.label(["June 30, 1908 · about 7:14 a.m.", "over the Siberian forest"], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label(["On the ground"], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      /* ---- act two: the forest, from the ground */
      const scene2 = new THREE.Group();
      hud.add(scene2);
      const view = groundView(ctx, scene2, { skyTop: "#3f78c8", skyLow: "#cfe2f2", groundNear: "#2f4a24", groundFar: "#6f8a6a", hills: "#6d8296", seed: 4 });
      const ZERO = new THREE.Vector3(0.9, -EYE, -15);
      const BURST = new THREE.Vector3(0.9, 2.4, -15);
      const trees = forest(ctx, scene2, { zero: ZERO, far: -30 });
      const fireball = ctx.glow("#fff3d6", 2, { opacity: 0, parent: scene2 });
      fireball.renderOrder = 30;
      const fireTrail = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#fff0d0", opacity: 0.95, parent: scene2 });
      const smoke = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#e8ecf0", opacity: 0.6, parent: scene2, additive: false });
      const blast = ctx.glow("#ffffff", 4, { opacity: 0, parent: scene2 });
      /* The blast front sweeping out across the ground, and dust it raises. */
      const front = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#fff3e0", opacity: 0.9, parent: scene2 });
      const ND = 900;
      const dust = ctx.cloud(ND, { parent: scene2, additive: false, size: 7 });
      const dr = rng(30);
      const dustA = Array.from({ length: ND }, () => ({ a: dr() * TAU, h: dr(), k: dr() }));
      dustA.forEach((_, i) => dust.tint(i, i % 3 ? "#9c8d78" : "#c9bba3"));
      const ENTRY = new THREE.Vector3(9, 6, -24);
      /* The ground where the trees lie flat: bare earth and fallen trunks. */
      const FLATTENED = new THREE.Color("#6b5a40");
      const band = ctx.shape([[-0.62, 0.55], [0.62, 0.55], [0.62, 0.73], [-0.62, 0.73]], { colour: "#000000", opacity: 0.45, parent: scene2 });
      band.position.z = 0.3;
      band.renderOrder = 35;
      const groundLabel = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const burstLabel = ctx.label(["Burst about 5–10 km up", "no impact, no crater"], { parent: scene2, at: BURST.clone().add(new THREE.Vector3(1.4, 0.6, 0)), height: 0.028, align: "left", declutter: false });
      const strippedLabel = ctx.label(["Right below: trees left", "standing, stripped bare"], { parent: scene2, at: ZERO.clone().add(new THREE.Vector3(-2.6, 1.0, 0)), height: 0.026, declutter: false });
      ctx.fade(scene2, 0);
      scene2.visible = false;

      /* ---- act three: the fallen forest from above (to scale) */
      const top = new THREE.Group();
      hud.add(top);
      /* Left of centre, clear of the event card. */
      const O = new THREE.Vector3(-0.36, -0.04, 0);
      const k = 0.0152; /* layout: units per km on the map */
      /* Butterfly outline, polar radius in km (drawing from the surveyed
       * pattern: 70 km across the wings, 55 km along the body; Wikipedia).
       * Then scaled so its area is exactly 2,150 km². */
      const raw = (a) => 25.65 - 3.75 * Math.cos(2 * a) - 2.5 * Math.cos(a) + 5.6 * Math.cos(4 * a) * 0.55;
      let area = 0;
      for (let i = 0; i < 720; i += 1) { const a = (i / 720) * TAU; area += 0.5 * raw(a) * raw(a) * (TAU / 720); }
      const scaleKm = Math.sqrt(2150 / area); /* flattened area about 2,150 km² */
      const edgeKm = (a) => raw(a) * scaleKm;
      const outlinePts = [];
      for (let i = 0; i <= 160; i += 1) {
        const a = (i / 160) * TAU;
        outlinePts.push(new THREE.Vector3(O.x + Math.cos(a) * edgeKm(a) * k, O.y + Math.sin(a) * edgeKm(a) * k, 0.01));
      }
      ctx.disc(0.86, { colour: "#06100a", opacity: 0.85, parent: top }).position.set(O.x, O.y, -0.02);
      const outline = ctx.line(outlinePts, { colour: "#ffd27f", opacity: 0.85, parent: top, dashed: true, dash: 0.025, gap: 0.015 });
      const random = rng(1908);
      const map = [];
      const step = 1.75; /* km between drawn trees (each stands for very many) */
      for (let gx = -48; gx <= 48; gx += step) {
        for (let gy = -48; gy <= 48; gy += step) {
          const x = gx + (random() - 0.5) * step * 0.9;
          const y = gy + (random() - 0.5) * step * 0.9;
          const d = Math.hypot(x, y);
          if (d > 47 || (d > 40 && random() < 0.5)) continue;
          const a = Math.atan2(y, x);
          map.push({ x, y, d, a, inside: d < edgeKm(a), core: d < 4, jitter: (random() - 0.5) * 0.35 });
        }
      }
      const NF = map.length;
      const standing = ctx.cloud(NF, { parent: top, additive: false, size: 3.2 });
      map.forEach((t, i) => { standing.set(i, O.x + t.x * k, O.y + t.y * k, 0); standing.tint(i, t.core ? "#b08a63" : "#3f9a55"); });
      standing.commit();
      const fallen = streaks(ctx, NF, { additive: false, parent: top });
      const fallColour = new THREE.Color("#c9a273");
      const insideCount = map.filter((t) => t.inside).length;
      const counter = ctx.label(["", ""], { at: [O.x, 0.7, 0], height: 0.034, parent: top, declutter: false });
      const wings = ctx.label(["70 km across"], { at: [O.x + 0.52, O.y + 0.5, 0], height: 0.026, parent: top, declutter: false });
      ctx.line([[-1.2, -0.72, 0], [-1.2 + 10 * k, -0.72, 0]], { colour: "#e8f1ff", opacity: 0.9, parent: top, additive: false });
      ctx.label(["10 km"], { at: [-1.2 + 5 * k, -0.67, 0], height: 0.022, parent: top, declutter: false });
      ctx.fade(top, 0);
      top.visible = false;

      ctx.tell([
        { at: 0, label: "June 30, 1908", text: "Early morning over Siberia. A rock tens of metres wide falls in from space." },
        { at: 0.24, label: "On the ground", text: "Over the taiga: a fireball brighter than the Sun streaks across the morning sky." },
        { at: 0.4, label: "Airburst", text: "It explodes in the air, about 5–10 km up, with the energy of several megatons." },
        { at: 0.5, label: "The blast", text: "The blast wave races outward and lays the trees flat, all pointing away from the burst. Right below it, trees are left standing, stripped bare." },
        { at: 0.74, label: "No crater", text: "From above: about 2,150 km² of forest — some 80 million trees, by a widely quoted estimate — and no crater at all." },
      ]);

      const cut = cutter(ctx);
      let from = null;
      const qE = new THREE.Quaternion();
      const hit = new THREE.Vector3();
      const P = new THREE.Vector3();
      return {
        duration: 26,
        update(p) {
          /* ---- act one: on the real Earth */
          const want = ctx.camDir.clone().addScaledVector(ctx.sunDir, 0.35).addScaledVector(cameraAxes(ctx.camera).right, -0.35).normalize();
          spin.turnToward(LAT, LON, want, p < 0.06 ? 0.05 : 0.12);
          earth.getWorldQuaternion(qE);
          hit.copy(site).applyQuaternion(qE);
          if (!from && p > 0.04) {
            const north = new THREE.Vector3(0, 1, 0).applyQuaternion(qE);
            const east = north.clone().cross(hit).normalize();
            /* From the east-south-east, fairly low (reconstructions differ;
             * drawing choice). */
            from = hit.clone().multiplyScalar(0.55).addScaledVector(east, 0.75).addScaledVector(north, -0.3).normalize();
          }
          if (from) {
            const u = span(p, 0.06, 0.2);
            const start = hit.clone().addScaledVector(from, 3.2);
            const end = hit.clone().multiplyScalar(1.012);
            P.lerpVectors(start, end, Math.pow(u, 1.4));
            rock.position.copy(P);
            rock.scale.setScalar(0.12 + 0.25 * smooth(P.length(), 1.15, 1.01));
            ctx.fade(rock, p > 0.06 && p < 0.205 ? 1 : 0);
            ctx.setLine(trail, [start.clone().lerp(P, Math.max(0, 1 - 0.4 / Math.max(0.4, u))), P]);
            ctx.fade(trail, p > 0.06 && p < 0.2 ? 1 : 1 - smooth(p, 0.2, 0.23));
            burstGlow.position.copy(end);
            burstGlow.scale.setScalar(0.3 + 1.4 * span(p, 0.2, 0.23));
            ctx.fade(burstGlow, win(p, 0.2, 0.235, 0.008));
          }
          ctx.fade(place.label, smooth(p, 0.02, 0.06));
          ctx.fade(place.dot, smooth(p, 0.02, 0.06) * (p < 0.2 ? 0.8 : 0));

          /* ---- the cut to the ground */
          const inForest = p > 0.235 && p < 0.7;
          const dark = (p > 0.225 && p < 0.25) || (p > 0.69 && p < 0.72);
          cut(dark || inForest || p > 0.7);
          cutWords.userData.draw([p < 0.5 ? "On the ground, in the taiga" : "From above"]);
          ctx.fade(cutWords, dark ? 1 : 0);
          ctx.fade(clock, p < 0.225 ? 1 : 0);

          scene2.visible = inForest && p > 0.245;
          if (scene2.visible) {
            ctx.fade(scene2, smooth(p, 0.245, 0.27) * (1 - smooth(p, 0.68, 0.69)));
            /* The fireball across the sky, then the burst. */
            const fu = span(p, 0.27, 0.4);
            const head = ENTRY.clone().lerp(BURST, Math.pow(fu, 1.2));
            fireball.position.copy(head);
            fireball.scale.setScalar(2.2 + 5 * fu);
            ctx.fade(fireball, p < 0.4 ? smooth(p, 0.27, 0.29) : 0);
            ctx.setLine(fireTrail, [ENTRY.clone().lerp(head, Math.max(0, 1 - 0.4 / Math.max(0.4, fu))), head]);
            ctx.fade(fireTrail, p < 0.4 ? smooth(p, 0.27, 0.29) : 1 - smooth(p, 0.4, 0.43));
            ctx.setLine(smoke, [ENTRY.clone().lerp(head, 0.05), p < 0.4 ? head : BURST]);
            ctx.fade(smoke, smooth(p, 0.3, 0.34) * (1 - smooth(p, 0.62, 0.68)));
            const f = span(p, 0.4, 0.47);
            blast.position.copy(BURST);
            blast.scale.setScalar(2 + 14 * Math.sqrt(f));
            ctx.fade(blast, p >= 0.4 ? (1 - f) : 0);
            ctx.fade(view.flashSky, p >= 0.4 ? 0.85 * (1 - span(p, 0.4, 0.46)) : 0);
            ctx.fade(burstLabel, smooth(p, 0.42, 0.45) * (1 - smooth(p, 0.62, 0.66)));
            /* The front: out from the point below the burst, along the
             * ground, past us (radius in hud units). */
            const reach = 22 * easeInOut(span(p, 0.42, 0.64));
            const ring = [];
            for (let i = 0; i <= 120; i += 1) {
              const a = (i / 120) * TAU;
              ring.push(new THREE.Vector3(ZERO.x + Math.cos(a) * reach, -EYE + 0.02, ZERO.z + Math.sin(a) * reach));
            }
            ctx.setLine(front, ring);
            ctx.fade(front, p > 0.42 && p < 0.64 ? 0.9 : 0);
            trees.set((t) => (t.d < 1.6 ? 0 : smooth(reach - t.d, 0, 1.2)), (t) => (t.d < 1.6 ? smooth(reach - t.d, 0, 0.6) : 0));
            for (let i = 0; i < ND; i += 1) {
              const d0 = dustA[i];
              const rr = Math.max(0, reach - d0.k * 1.5);
              dust.set(i, ZERO.x + Math.cos(d0.a) * rr, -EYE + d0.h * 0.25 * (1 + d0.k), ZERO.z + Math.sin(d0.a) * rr);
              dust.alpha[i] = p > 0.42 && p < 0.68 ? 0.35 * (1 - span(p, 0.6, 0.68)) : 0;
            }
            dust.commit();
            view.paint((x, z, c) => {
              const d = Math.hypot(x - ZERO.x, z - ZERO.z);
              if (d > 1.6 && d < reach) c.lerp(FLATTENED, 0.45);
            });
            ctx.fade(strippedLabel, smooth(p, 0.5, 0.53) * (1 - smooth(p, 0.64, 0.67)));
            groundLabel.userData.draw(p < 0.4 ? ["7:14 a.m. · the taiga", "a fireball crosses the sky"] : p < 0.47 ? ["The burst", "about 5–10 km up"] : ["The blast wave", "trees thrown down, pointing away"]);
          }
          ctx.fade(groundLabel, scene2.visible ? 1 : 0);

          /* ---- act three: the map */
          top.visible = p > 0.715;
          if (top.visible) {
            ctx.fade(top, smooth(p, 0.715, 0.74));
            const reachKm = 52 * easeInOut(span(p, 0.74, 0.92));
            let down = 0;
            map.forEach((t, i) => {
              const swept = t.inside && reachKm > t.d;
              if (swept) down += 1;
              if (swept && !t.core) {
                const fall = smooth(reachKm - t.d, 0, 2.5);
                const a = t.a + t.jitter;
                const len = 1.6 * k * fall;
                const bx = O.x + t.x * k;
                const by = O.y + t.y * k;
                fallen.set(i, bx, by, 0.005, bx + Math.cos(a) * len, by + Math.sin(a) * len, 0.005, fallColour);
                standing.alpha[i] = 1 - fall;
              } else {
                fallen.hide(i);
                standing.alpha[i] = t.core && swept ? 1 : 0.9;
              }
            });
            fallen.commit();
            standing.commit();
            ctx.fade(outline, smooth(p, 0.92, 0.95));
            ctx.fade(wings, smooth(p, 0.93, 0.96));
            const km2 = (2150 * down) / insideCount;
            counter.userData.draw([`Forest flattened: ${fmt(km2)} km²`, p > 0.93 ? "about 80 million trees (a rough, often-quoted estimate)" : "trees fall pointing away from the burst"]);
          }
        },
        dispose() { spin.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------ chelyabinsk */
  event({
    id: "chelyabinsk",
    section: "earth",
    body: "Earth",
    title: "Chelyabinsk",
    place: "Earth · Chelyabinsk, Russia",
    kind: "recorded",
    family: "impact",
    when: "February 15, 2013",
    often: "once, 2013",
    timeline: { last: "Feb 15, 2013, 9:20 a.m. local time", next: "Rocks this size are thought to hit once every few decades to a century" },
    detail: "An unseen rock about 18–20 m wide burst 30 km above Russia, brighter than the Sun, and its shock wave shattered windows across a city",
    frequency: "The largest known object to enter Earth's atmosphere since Tunguska in 1908. Bursts this size are thought to happen somewhere on Earth every few decades, most over oceans or empty land.",
    cause: "A stony asteroid of about 10,000 tonnes came in at about 19 km/s on a shallow path, about 18° to the ground. The air ahead of it squeezed and heated it until it crumbled and burst about 30 km up, releasing roughly 400–500 kilotons of energy — about thirty Hiroshima bombs.",
    note: "It came from the Sun's side of the sky, where telescopes cannot look, so no one saw it coming. About 1,500 people were hurt, almost all by flying glass, and more than 7,200 buildings were damaged. A 650 kg piece was later lifted from the bottom of Lake Chebarkul.",
    accuracy: "First on the site's own Earth, the rock drawn far larger than real. Then a painted view of a city on a winter morning: distances are compressed (the burst was about 30 km up and some 40 km from the city), and the buildings are generic, not Chelyabinsk's own. The shock wave's travel time, about two and a half minutes, is from the reports; it is sped up here.",
    art: { main: "earth", second: "rock", fx: "flash" },
    shotZoom: 1.55,
    shotPitch: 0.55,
    facesSun: true,
    shotSwing: 0.55,
    scene(ctx) {
      const earth = ctx.host;
      /* The camera on the sunlit side, swung -0.55 rad off the Sun's line
       * (set here, so it does not depend on where the camera came from). */
      ctx.refocus("Earth", { shotYaw: yawFor(ctx.sunDir.clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.55)), shotZoom: 1.55, shotPitch: 0.55 });
      /* Chelyabinsk, 55.15° N, 61.4° E. */
      const LAT = 55.15;
      const LON = 61.4;
      const spin = spinner(earth);
      const site = bodyPoint(earth, LAT, LON, 1).normalize();
      const place = earthPlace(ctx, earth, LAT, LON, ["Chelyabinsk, Russia", "February 15, 2013"]);
      const rock = ctx.glow("#fff1cc", 0.25, { opacity: 0 });
      const trail = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffe6c4", opacity: 0.9 });
      const burstGlow = ctx.glow("#ffffff", 0.6, { opacity: 0 });

      const hud = ctx.hudLayer();
      const clock = ctx.label(["Feb 15, 2013 · 9:20 a.m.", "over the southern Urals"], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label(["In the city"], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      /* ---- act two: the city on a winter morning */
      const city = new THREE.Group();
      hud.add(city);
      const view = groundView(ctx, city, { skyTop: "#5d8fc8", skyLow: "#e3ecf2", groundNear: "#d9dee2", groundFar: "#b8c4cc", hills: "#8e9eac", seed: 13 });
      const random = rng(2013);
      /* Blocks of flats: instanced boxes with a window texture. */
      const tex = (() => {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 128;
        const g = c.getContext("2d");
        const wr = rng(3);
        g.fillStyle = "#9aa3ab";
        g.fillRect(0, 0, 64, 128);
        for (let y = 6; y < 124; y += 12) {
          for (let x = 5; x < 60; x += 11) {
            g.fillStyle = wr() < 0.18 ? "#f2e2b0" : "#2c3a4a";
            g.fillRect(x, y, 7, 7);
          }
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const NB = 260;
      const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }), NB);
      blocks.frustumCulled = false;
      blocks.raycast = () => {};
      blocks.renderOrder = 5;
      city.add(blocks);
      const B = [];
      const haze = new THREE.Color("#c3d0da");
      for (let i = 0; i < NB; i += 1) {
        const z = lerp(0.2, -26, Math.pow(random(), 0.8));
        const w = 1.5 + Math.abs(z) * 0.8;
        const x = (random() - 0.5) * 2 * w;
        if (Math.abs(x) < 0.35 && z > -2) { B.push(null); continue; }
        const sx = 0.18 + random() * 0.35;
        const sy = 0.2 + Math.pow(random(), 2) * 0.9;
        const sz = 0.12 + random() * 0.2;
        const shade = 0.75 + random() * 0.3;
        const depth = THREE.MathUtils.clamp(-z / 26, 0, 1);
        const colour = new THREE.Color(shade, shade, shade * 1.02).lerp(haze, depth * 0.75);
        blocks.setColorAt(i, colour);
        B.push({ x, z, sx, sy, sz, colour, d: Math.hypot(x + 6, z + 30), yaw: (random() - 0.5) * 0.3 });
      }
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const yAxis = new THREE.Vector3(0, 1, 0);
      const setBlocks = (shake, broken) => {
        B.forEach((b, i) => {
          if (!b) { m4.makeScale(0, 0, 0); blocks.setMatrixAt(i, m4); return; }
          const j = shake(b);
          q.setFromAxisAngle(yAxis, b.yaw);
          m4.compose(new THREE.Vector3(b.x + j * Math.sin(ctx.t * 53 + i), -EYE, b.z + j * Math.cos(ctx.t * 47 + i)), q, new THREE.Vector3(b.sx, b.sy, b.sz));
          blocks.setMatrixAt(i, m4);
          const k = broken(b);
          if (k > 0) blocks.setColorAt(i, b.colour.clone().multiplyScalar(1 - 0.35 * k));
        });
        blocks.instanceMatrix.needsUpdate = true;
        if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
      };
      setBlocks(() => 0, () => 0);
      /* The fireball: in from the east (the right, facing north from the
       * city), low and shallow, bursting off to the west. */
      const ENTRY = new THREE.Vector3(30, 10, -30);
      const BURST = new THREE.Vector3(-6, 3.2, -30);
      const fireball = ctx.glow("#fff6e0", 3, { opacity: 0, parent: city });
      fireball.renderOrder = 30;
      const fireTrail = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#fff6e0", opacity: 1, parent: city });
      /* The smoke trail it left, which hung in the sky for hours. */
      const NS = 700;
      const smoke = ctx.cloud(NS, { parent: city, additive: false, size: 14 });
      const sr = rng(15);
      const smokeA = Array.from({ length: NS }, () => ({ t: sr(), w: (sr() - 0.5), v: sr() }));
      smokeA.forEach((_, i) => smoke.tint(i, i % 4 ? "#f2f2f0" : "#d8d4cc"));
      const blast = ctx.glow("#ffffff", 6, { opacity: 0, parent: city });
      /* Glass: thrown out of the windows when the shock arrives. */
      const NG = 1400;
      const glass = ctx.cloud(NG, { parent: city, size: 4.5 });
      const gr = rng(77);
      const shards = Array.from({ length: NG }, () => {
        const b = B[Math.floor(gr() * NB)] ?? B.find(Boolean);
        return { b, h: gr(), sx: (gr() - 0.5), vx: (gr() - 0.5) * 0.6, vz: 0.4 + gr() * 0.8, vy: gr() * 0.5 };
      });
      shards.forEach((_, i) => glass.tint(i, "#e6f6ff"));
      const front = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffffff", opacity: 0.7, parent: city });
      /* A dark band behind the caption, which sits on a bright sky. */
      const band = ctx.shape([[-0.62, 0.55], [0.62, 0.55], [0.62, 0.73], [-0.62, 0.73]], { colour: "#000000", opacity: 0.45, parent: city });
      band.position.z = 0.3;
      band.renderOrder = 35;
      const cityLabel = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const toll = ctx.label(["About 1,500 people hurt, mostly by flying glass", "over 7,200 buildings damaged"], { parent: hud, at: [0, -0.6, 0], height: 0.03, declutter: false });
      ctx.fade(toll, 0);
      ctx.fade(city, 0);
      city.visible = false;

      ctx.tell([
        { at: 0, label: "Feb 15, 2013 · 9:20 a.m.", text: "A rock about 18–20 m wide enters over the Urals at about 19 km/s, on a shallow path. It came from the Sun's side of the sky: no telescope had seen it." },
        { at: 0.26, label: "Over the city", text: "In Chelyabinsk, a fireball crosses the winter sky, brighter than the Sun, leaving a long trail of smoke." },
        { at: 0.42, label: "The burst", text: "About 30 km up it breaks apart, releasing roughly 400–500 kilotons: about thirty Hiroshima bombs." },
        { at: 0.52, label: "The shock wave", text: "The blast travels down through the air at roughly the speed of sound. Many people went to the windows to look." },
        { at: 0.64, label: "Glass", text: "About two and a half minutes after the flash it reaches the city, shattering windows across it." },
      ]);

      const cut = cutter(ctx);
      let from = null;
      const qE = new THREE.Quaternion();
      const hit = new THREE.Vector3();
      const P = new THREE.Vector3();
      /* Shock arrival: about 2 min 23 s to 2 min 57 s after the flash
       * (Wikipedia, "Chelyabinsk meteor"); drawn as 2 min 30 s. */
      const ARRIVE = 150;
      return {
        duration: 26,
        update(p) {
          const want = ctx.camDir.clone().addScaledVector(ctx.sunDir, 0.35).addScaledVector(cameraAxes(ctx.camera).right, -0.35).normalize();
          spin.turnToward(LAT, LON, want, p < 0.06 ? 0.05 : 0.12);
          earth.getWorldQuaternion(qE);
          hit.copy(site).applyQuaternion(qE);
          if (!from && p > 0.04) {
            const north = new THREE.Vector3(0, 1, 0).applyQuaternion(qE);
            const east = north.clone().cross(hit).normalize();
            /* A shallow path, about 18° to the ground (Popova et al. 2013). */
            from = hit.clone().multiplyScalar(Math.sin(18 * D2R)).addScaledVector(east, Math.cos(18 * D2R)).normalize();
          }
          if (from) {
            const u = span(p, 0.06, 0.2);
            const start = hit.clone().multiplyScalar(1.02).addScaledVector(from, 2.6);
            const end = hit.clone().multiplyScalar(1.006);
            P.lerpVectors(start, end, u);
            rock.position.copy(P);
            rock.scale.setScalar(0.1 + 0.25 * smooth(P.length(), 1.12, 1.01));
            ctx.fade(rock, p > 0.06 && p < 0.205 ? 1 : 0);
            ctx.setLine(trail, [start.clone().lerp(P, Math.max(0, 1 - 0.5 / Math.max(0.5, u))), P]);
            ctx.fade(trail, p > 0.06 && p < 0.2 ? 1 : 1 - smooth(p, 0.2, 0.23));
            burstGlow.position.copy(end);
            burstGlow.scale.setScalar(0.3 + 1.2 * span(p, 0.2, 0.23));
            ctx.fade(burstGlow, win(p, 0.2, 0.235, 0.008));
          }
          ctx.fade(place.label, smooth(p, 0.02, 0.06));
          ctx.fade(place.dot, smooth(p, 0.02, 0.06) * (p < 0.2 ? 0.8 : 0));

          const dark = p > 0.225 && p < 0.25;
          cut(p > 0.225);
          ctx.fade(cutWords, dark ? 1 : 0);
          ctx.fade(clock, p < 0.225 ? 1 : 0);

          city.visible = p > 0.245;
          if (!city.visible) return;
          ctx.fade(city, smooth(p, 0.245, 0.27));
          /* The fireball crosses, brightening, and bursts. */
          const fu = span(p, 0.27, 0.42);
          const head = ENTRY.clone().lerp(BURST, fu);
          fireball.position.copy(head);
          fireball.scale.setScalar(3 + 12 * fu * fu);
          ctx.fade(fireball, p < 0.42 ? smooth(p, 0.27, 0.29) : 0);
          ctx.setLine(fireTrail, [ENTRY.clone().lerp(head, Math.max(0, 1 - 0.25 / Math.max(0.25, fu))), head]);
          ctx.fade(fireTrail, p < 0.42 ? smooth(p, 0.27, 0.29) : 1 - smooth(p, 0.42, 0.45));
          for (let i = 0; i < NS; i += 1) {
            const s = smokeA[i];
            const along = Math.min(s.t, fu);
            const age = Math.max(0, fu - s.t) + span(p, 0.42, 1) * 1.5;
            const pt = ENTRY.clone().lerp(BURST, along);
            smoke.set(i, pt.x + s.w * 0.4 * age, pt.y + s.w * 0.6 * age - 0.15 * age, pt.z);
            smoke.size[i] = 10 + 16 * age * s.v;
            smoke.alpha[i] = s.t <= fu ? 0.32 * (1 - 0.4 * span(p, 0.6, 1)) : 0;
          }
          smoke.commit();
          const f = span(p, 0.42, 0.48);
          blast.position.copy(BURST);
          blast.scale.setScalar(4 + 22 * Math.sqrt(f));
          ctx.fade(blast, p >= 0.42 ? (1 - f) : 0);
          ctx.fade(view.flashSky, p >= 0.42 ? 0.95 * (1 - span(p, 0.42, 0.47)) : 0);
          /* Then the wait for the shock wave, and its arrival. */
          const secs = p < 0.42 ? 0 : ARRIVE * span(p, 0.44, 0.62);
          const arrive = span(p, 0.6, 0.68);
          const reach = lerp(0, 34, arrive);
          const ring = [];
          for (let i = 0; i <= 120; i += 1) {
            const a = (i / 120) * TAU;
            ring.push(new THREE.Vector3(BURST.x + Math.cos(a) * reach, -EYE + 0.03, BURST.z + Math.sin(a) * reach));
          }
          ctx.setLine(front, ring);
          ctx.fade(front, p > 0.6 && p < 0.68 ? 0.6 : 0);
          setBlocks((b) => 0.012 * smooth(reach - b.d, 0, 2) * (1 - smooth(reach - b.d, 4, 10)), (b) => smooth(reach - b.d, 0, 1.5));
          for (let i = 0; i < NG; i += 1) {
            const s = shards[i];
            const b = s.b;
            const tt = b ? Math.max(0, (reach - b.d) / 6) : 0;
            if (!b || tt <= 0) { glass.alpha[i] = 0; continue; }
            const x = b.x + s.sx * b.sx + s.vx * tt;
            const y = -EYE + s.h * b.sy + s.vy * tt - 1.2 * tt * tt;
            const z = b.z + b.sz * 0.6 + s.vz * tt;
            glass.set(i, x, Math.max(-EYE + 0.005, y), z);
            glass.alpha[i] = (1 - smooth(tt, 0.6, 1.2)) * (0.6 + 0.4 * Math.sin(ctx.t * 20 + i));
          }
          glass.commit();
          cityLabel.userData.draw(p < 0.42 ? ["9:20 a.m. · a winter morning", "a fireball brighter than the Sun"]
            : p < 0.6 ? ["The burst, about 30 km up", `then ${Math.floor(secs / 60)} min ${String(Math.floor(secs % 60)).padStart(2, "0")} s: the shock wave on its way`]
              : ["2 min 30 s after the flash", "the shock wave reaches the city"]);
          ctx.fade(toll, smooth(p, 0.72, 0.78));
        },
        dispose() { spin.restore(); tex.dispose(); },
      };
    },
  }),

  /* ------------------------------------------------- daylight-fireball-1972 */
  event({
    id: "daylight-fireball-1972",
    section: "earth",
    title: "The 1972 Great Daylight Fireball",
    place: "Earth's atmosphere · Utah to Alberta",
    kind: "recorded",
    family: "smallBody",
    when: "August 10, 1972",
    often: "once, 1972",
    timeline: { last: "Aug 10, 1972, about 2:30 p.m. over Utah", next: "Grazing fireballs are rare: only a handful have been well recorded" },
    detail: "A rock a few metres across skimmed through the upper atmosphere for about 100 seconds, no lower than about 57 km, and went back out to space",
    frequency: "Earth-grazing fireballs are rare; this is the best-documented one. Thousands of rocks this size hit the atmosphere over the centuries, but almost all come in steeply enough to stay.",
    cause: "The rock came in at about 15 km/s on a path that only just met the air. Its path barely bent: Earth's surface curved away beneath it faster than it could fall. The air slowed it by about 0.8 km/s and stripped some of its mass, but not enough to capture it.",
    note: "It was seen by many people in the afternoon sky, filmed by a tourist in Grand Teton National Park, and tracked by US military satellites. Its size is uncertain — about 3 to 14 m, depending on whether it was rock or ice — and it has not been seen since.",
    accuracy: "Distances along the ground to scale; heights stretched about four times, so the thin layer of air can be seen. With that stretch the path still looks straight, as it really was. Where it crossed each state is approximate.",
    art: { main: "earth", second: "rock", fx: "tail" },
    scene(ctx) {
      /* About 15 km/s for about 100 s: some 1,500 km of air (Wikipedia, "1972
       * Great Daylight Fireball"); closest about 57 km up. */
      const MIN_ALT = 57;
      const SPEED = 15;
      const DURATION = 100;
      /* layout: kh units per km along the ground, kv per km of height (×~4) */
      const kh = (ctx.halfWidth * 1.8) / 1650;
      const kv = 0.0052;
      const base = -0.38;
      /* Ground height under distance s (km) from the closest point: a circle of
       * Earth's radius, its drop s²/2R at true scale, stretched with the heights. */
      const groundY = (s) => base - kv * ((s * s) / (2 * EARTH_R));
      /* A straight path at MIN_ALT above the closest point stays at one
       * height in these axes; its altitude above the ground is MIN_ALT + s²/2R. */
      const pathY = base + kv * MIN_ALT;
      const pts = [];
      const air = [];
      for (let i = 0; i <= 80; i += 1) {
        const s = lerp(-900, 900, i / 80);
        pts.push([s * kh, groundY(s)]);
        air.push([s * kh, groundY(s) + kv * 100]);
      }
      ctx.shape([[-900 * kh, -0.86], ...pts, [900 * kh, -0.86]], { colour: "#1d3b2c", opacity: 0.95 });
      ctx.shape([...pts, ...air.slice().reverse()], { colour: "#3f86d8", opacity: 0.22 });
      ctx.line(air.map(([x, y]) => [x, y, 0]), { colour: "#9fd0ff", opacity: 0.55, dashed: true, dash: 0.02, gap: 0.015 });
      ctx.label(["100 km: where space is said to begin"], { at: [-0.62, groundY(-560) + kv * 100 + 0.05, 0], height: 0.026 });
      /* Places, from south to north (approximate positions along the track). */
      [["Utah", -620], ["Wyoming / Idaho", -260], ["Montana", 120], ["Alberta", 560]].forEach(([name, s]) => {
        ctx.line([[s * kh, groundY(s), 0], [s * kh, groundY(s) - 0.03, 0]], { colour: "#cfe0c8", opacity: 0.6 });
        ctx.label([name], { at: [s * kh, groundY(s) - 0.07, 0], height: 0.026 });
      });
      const closest = ctx.line([[0, groundY(0), 0], [0, pathY, 0]], { colour: "#ffd27f", opacity: 0.8, dashed: true, dash: 0.015, gap: 0.012 });
      const closestLabel = ctx.label(["Closest: about 57 km up"], { at: [0.03, (groundY(0) + pathY) / 2, 0], height: 0.028, align: "left" });
      const path = ctx.line([[-1, pathY, 0], [-1, pathY, 0]], { colour: "#ffe0a8", opacity: 0.9 });
      const ghost = ctx.line([[-950 * kh, pathY, 0], [950 * kh, pathY, 0]], { colour: "#ffe0a8", opacity: 0.18, dashed: true, dash: 0.02, gap: 0.02 });
      const head = ctx.glow("#fff3d6", 0.1, { opacity: 0 });
      const rock = ctx.rock(0.012, { seed: 72, colour: "#8a8278" });
      const readout = ctx.label(["", ""], { at: [0, 0.62, 0], height: 0.052 });
      const stretch = ctx.label(["Heights stretched ×4"], { at: [ctx.halfWidth * 0.62, -0.8, 0], height: 0.024, sub: "#7f93a8" });
      const away = ctx.label(["back into orbit round the Sun"], { at: [ctx.halfWidth * 0.55, pathY + 0.08, 0], height: 0.028 });
      void stretch;
      ctx.light.set(-0.3, 0.6, 0.7).normalize();

      ctx.tell([
        { at: 0, label: "Aug 10, 1972", text: "Mid-afternoon over Utah. A rock a few metres across meets the top of the atmosphere, heading north at about 15 km/s." },
        { at: 0.3, label: "Skimming", text: "It blazes across the daytime sky, seen and filmed from the ground, tracked by satellites — never lower than about 57 km." },
        { at: 0.55, label: "Like a skipping stone", text: "Its path is almost straight. It is the ground that curves away beneath it." },
        { at: 0.8, label: "Back to space", text: "After about 100 seconds it climbs out over Alberta, a little smaller and slower, still going round the Sun." },
      ]);

      return {
        duration: 20,
        update(p) {
          /* Distance along the path, km from the closest point. */
          const tSec = DURATION * span(p, 0.04, 0.8) - DURATION / 2;
          const s = SPEED * tSec + (p > 0.8 ? 600 * span(p, 0.8, 0.98) : 0);
          const x = s * kh;
          head.position.set(x, pathY, 0.01);
          rock.position.set(x, pathY, 0.02);
          rock.rotation.set(ctx.t, ctx.t * 0.7, 0);
          const alt = MIN_ALT + (s * s) / (2 * EARTH_R);
          const inAir = alt < 100;
          head.scale.setScalar(inAir ? 0.09 + 0.08 * (1 - (alt - MIN_ALT) / 43) : 0.04);
          ctx.fade(head, (inAir ? 1 : 0.35) * smooth(p, 0.01, 0.04));
          const tail = Math.max(-750, s - 380);
          ctx.setLine(path, [[tail * kh, pathY, 0.005], [x, pathY, 0.005]]);
          ctx.fade(path, smooth(p, 0.04, 0.08) * (p > 0.8 ? 1 - smooth(p, 0.8, 0.9) : 1));
          ctx.fade(ghost, smooth(p, 0.55, 0.62));
          ctx.fade(closest, smooth(p, 0.38, 0.44));
          ctx.fade(closestLabel, smooth(p, 0.38, 0.44));
          ctx.fade(away, smooth(p, 0.82, 0.88));
          const shown = Math.max(0, Math.min(DURATION, tSec + DURATION / 2));
          readout.userData.draw([
            p < 0.8 ? `T + ${Math.round(shown)} s · ${Math.round(alt)} km up` : `Out: about ${DURATION} s, about ${fmt(SPEED * DURATION)} km of air`,
            p < 0.8 ? (inAir ? "glowing in the upper atmosphere" : "above the atmosphere") : "it did not come back down",
          ]);
          ctx.fade(readout, smooth(p, 0, 0.03));
        },
      };
    },
  }),

  /* ----------------------------------------------------------- apophis-2029 */
  event({
    id: "apophis-2029",
    section: "earth",
    body: "Earth",
    title: "Apophis's close pass",
    place: "Earth · inside the geostationary distance",
    kind: "transient",
    family: "smallBody",
    when: "April 13, 2029",
    often: "predicted, Apr 13, 2029",
    timeline: { last: "Discovered in 2004", next: "Apr 13, 2029, about 21:46 UTC" },
    detail: "A 340 m asteroid will pass about 32,000 km above Earth's surface — closer than the geostationary distance — bright enough to see without a telescope",
    frequency: "A pass this close by an asteroid this large is thought to happen only about once in several thousand years.",
    cause: "Apophis's orbit around the Sun crosses Earth's. In 2029 the two arrive at the crossing within hours of each other. Earth's gravity will speed it up from about 6 km/s to about 7.4 km/s at closest approach and bend its path, changing its orbit.",
    note: "When it was found in 2004 it briefly had the highest impact risk ever rated. Radar and new observations have since ruled out any impact for at least the next hundred years. After 2029 its year will stretch from about 0.89 to 1.16 of ours. At magnitude about 3 it should be visible to the naked eye from Europe, Africa and western Asia.",
    accuracy: "Played round the site's own Earth. Earth, the ring of geostationary satellites and Apophis's path are to one true scale, the path computed as a hyperbola from its closest distance and speed, over about seven hours either side of closest approach. The site's Moon (drawn about 19 times closer than it really is, which would put it inside this ring) is hidden for this pass: the real Moon is ten times farther out. Apophis itself is marked, not drawn: at this scale it would be far smaller than a pixel. The path's direction in space is simplified.",
    art: { main: "earth", second: "rock", fx: "orbit" },
    shotZoom: 7,
    shotPitch: 0.42,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      /* Geostationary orbit radius 42,164 km (35,786 km altitude); closest
       * approach about 38,012 km from Earth's centre, 7.42 km/s, 13 April
       * 2029 21:46 UTC (JPL / Wikipedia, "99942 Apophis"). */
      const GEO = 42164;
      const RP = 38012;
      const VP = 7.42;
      const U = ctx.unit;
      const k = 1 / EARTH_R; /* root units (Earth radii) per km */
      const up = new THREE.Vector3(0, 1, 0);
      const E = earth.getWorldPosition(new THREE.Vector3());
      const S = (sunBody?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3());
      const anti = E.clone().sub(S).setY(0).normalize();
      const veil = rig ? [rig.system].filter(Boolean) : [];
      ctx.setVeil(veil);
      const side = new THREE.Vector3().crossVectors(up, anti).normalize();
      ctx.refocus("Earth", { shotYaw: yawFor(anti.clone().applyAxisAngle(up, 0.95)), shotPitch: 0.42, shotDistance: GEO * k * U * 4.4 });

      /* The geostationary ring, in Earth's equator plane (Earth's own tilt). */
      const ringHolder = new THREE.Group();
      ctx.attach(earth, ringHolder);
      const R = bodyRadius(earth);
      const geoR = GEO * k * R;
      const geoRing = ctx.circle(geoR, { plane: "xz", colour: "#7fd8ff", opacity: 0.55, parent: ringHolder });
      /* A handful of satellites on it, for scale. */
      const sats = ctx.cloud(36, { parent: ringHolder, size: 3 });
      for (let i = 0; i < 36; i += 1) {
        const a = (i / 36) * TAU + Math.sin(i * 7.3) * 0.05;
        sats.set(i, Math.cos(a) * geoR, 0, Math.sin(a) * geoR);
        sats.tint(i, "#cfeaff");
      }
      sats.commit();

      /* The hyperbola: v∞² = vp² − 2GM/rp; e = 1 + rp·v∞²/GM. */
      const vinf2 = VP * VP - (2 * EARTH_GM) / RP;
      const e = 1 + (RP * vinf2) / EARTH_GM;
      const pSemi = RP * (1 + e);
      const a = -EARTH_GM / vinf2;
      const n = Math.sqrt(EARTH_GM / -(a * a * a));
      const timeAt = (nu) => {
        const F = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
        return (e * Math.sinh(F) - F) / n;
      };
      const nuAt = (t) => {
        let lo = -Math.acos(-1 / e) + 1e-4;
        let hi = -lo;
        for (let i = 0; i < 60; i += 1) { const mid = (lo + hi) / 2; if (timeAt(mid) < t) lo = mid; else hi = mid; }
        return (lo + hi) / 2;
      };
      /* Its plane and orientation (simplified, drawing choice): closest
       * over Earth's night side, tilted 25° to the ecliptic, coming up from
       * the south. */
      const pe = anti.clone();
      const normal = up.clone().applyAxisAngle(pe, 25 * D2R);
      const qv = new THREE.Vector3().crossVectors(normal, pe).normalize();
      const place = (nu, out = new THREE.Vector3()) => {
        const r = pSemi / (1 + e * Math.cos(nu));
        return out.copy(pe).multiplyScalar(Math.cos(nu) * r * k).addScaledVector(qv, Math.sin(nu) * r * k);
      };
      const HOURS = 7;
      const SAMPLES = 300;
      const pts = [];
      for (let i = 0; i <= SAMPLES; i += 1) pts.push(place(nuAt(lerp(-HOURS, HOURS, i / SAMPLES) * 3600)));
      const ahead = ctx.line(pts, { colour: "#bcd2ec", opacity: 0.22 });
      const travelled = ctx.line(pts.slice(0, 2), { colour: "#ffd27f", opacity: 0.95 });
      const glow = ctx.glow("#fff3d6", 0.9, { opacity: 0.95 });
      const finder = finderRing("#ffd27f");
      ctx.add(finder);
      finder.scale.setScalar(0.055);
      const dateLabel = ctx.label(["Apophis", ""], { height: 0.026, align: "left", declutter: false });
      /* Closest approach: a mark and the gap to the surface. */
      const closest = place(0);
      const mark = ctx.glow("#ffffff", 0.6, { opacity: 0 });
      mark.position.copy(closest);
      const gap = ctx.line([closest.clone().normalize(), closest], { colour: "#ffffff", opacity: 0.7, dashed: true, dash: 0.25, gap: 0.2 });
      const gapLabel = ctx.label(["Closest: about 31,600 km up", "a tenth of the way to the Moon"], { at: closest.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, -0.9, 0)), height: 0.024, declutter: false });
      const geoLabel = ctx.label(["Geostationary satellites", "35,786 km up"], { at: side.clone().multiplyScalar(-GEO * k * 1.05).add(new THREE.Vector3(0, 1.0, 0)), height: 0.024, declutter: false });
      const straight = ctx.line([pts[0], pts[0].clone().add(pts[6].clone().sub(pts[0]).normalize().multiplyScalar(26))], { colour: "#ffd27f", opacity: 0.3, dashed: true, dash: 0.4, gap: 0.3 });
      const bend = 2 * Math.asin(1 / e) / D2R;
      const hud = ctx.hudLayer();
      const readout = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.032, declutter: false });
      const after = ctx.label([`Path bent by about ${Math.round(bend)}°`, "its year: 0.89 → 1.16 of ours"], { parent: hud, at: [0, -0.6, 0], height: 0.028, declutter: false });
      void geoRing;

      ctx.tell([
        { at: 0, label: "Friday 13 April 2029", text: "Asteroid Apophis, about 340 m across, closes in on Earth at about 6 km/s. Earth and the distances are to scale." },
        { at: 0.3, label: "Inside the ring", text: "The ring is where the geostationary satellites orbit, 35,786 km up. Apophis passes inside it." },
        { at: 0.5, label: "Closest", text: "About 21:46 UTC: 31,600 km from the surface, at 7.4 km/s — bright enough to see with the naked eye from Europe, Africa and western Asia." },
        { at: 0.74, label: "A new orbit", text: "Earth's pull bends its path and lengthens its year. And it will miss: no impact risk for at least a century." },
      ]);

      const pos = new THREE.Vector3();
      return {
        duration: 22,
        update(p) {
          const hours = lerp(-HOURS, HOURS, span(p, 0.03, 0.95));
          const t = hours * 3600;
          const nu = nuAt(t);
          place(nu, pos);
          const r = pSemi / (1 + e * Math.cos(nu));
          glow.position.copy(pos);
          finder.position.copy(pos);
          dateLabel.position.copy(pos).add(new THREE.Vector3(0, 0.7, 0));
          const shownN = Math.max(2, Math.round(SAMPLES * span(p, 0.03, 0.95)) + 1);
          ctx.setLine(travelled, pts.slice(0, shownN));
          void ahead;
          ctx.fade(mark, smooth(p, 0.48, 0.5));
          ctx.fade(gap, smooth(p, 0.48, 0.52) * (1 - smooth(p, 0.72, 0.78)));
          ctx.fade(gapLabel, smooth(p, 0.48, 0.52) * (1 - smooth(p, 0.72, 0.78)));
          ctx.fade(geoLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.46, 0.5)));
          ctx.fade(straight, smooth(p, 0.74, 0.8));
          ctx.fade(after, smooth(p, 0.76, 0.82));
          /* Clock: UTC, from closest approach at 21:46. */
          const mins = Math.round(21 * 60 + 46 + hours * 60);
          const day = mins >= 24 * 60 ? 14 : 13;
          const hh = String(Math.floor((((mins % 1440) + 1440) % 1440) / 60)).padStart(2, "0");
          const mm = String(((mins % 60) + 60) % 60).padStart(2, "0");
          const v = Math.sqrt(EARTH_GM * (2 / r - 1 / a));
          const alt = Math.round((r - EARTH_R) / 100) * 100;
          dateLabel.userData.draw(["Apophis", `Apr ${day} · ${hh}:${mm} UTC`]);
          readout.userData.draw([`Apr ${day}, 2029 · ${hh}:${mm} UTC (about)`, `${fmt(alt)} km above the surface · ${v.toFixed(1)} km/s`]);
          ctx.fade(readout, smooth(p, 0, 0.03));
        },
        dispose() {},
      };
    },
  }),

  /* --------------------------------------------------------- mini-moon-2024 */
  event({
    id: "mini-moon-2024",
    section: "earth",
    body: "Earth",
    title: "Earth's temporary mini-moon",
    place: "Earth · just beyond the Moon",
    kind: "recorded",
    family: "orbit",
    when: "September 29 – November 25, 2024",
    often: "once, autumn 2024",
    timeline: { last: "Sept 29 – Nov 25, 2024", next: "Expected back near Earth in 2055" },
    detail: "A 10 m asteroid, 2024 PT5, was loosely held by Earth's gravity for 57 days, then drifted back into orbit around the Sun",
    frequency: "Small asteroids are caught like this now and then, usually unseen. Known earlier ones: 2006 RH120, held for about a year in 2006–07, and 2020 CD3, held from 2018 to 2020.",
    cause: "2024 PT5 goes round the Sun on an orbit very like Earth's, so when the two meet it drifts past us slowly — about 1 km/s. From Sept 29 its speed relative to Earth was low enough that Earth's gravity briefly held it. But it never completed an orbit: it traced only part of a loose loop, then the Sun's pull took over.",
    note: "It was found by the ATLAS survey on Aug 7, 2024. Its spectrum matches rocks brought back from the Moon, so it may be a chip thrown off the Moon by an old impact.",
    accuracy: "Played round the site's own Earth and Moon, the Moon placed on its orbit by the date. The site draws the Moon about 19 times closer than it really is; the asteroid's loop and the distance where Earth's gravity stops dominating (about 1.5 million km, about 3.9 times the Moon's distance) are drawn to that same Moon orbit, so Earth and the Moon are far bigger than they should be against them. The loop is a sketch of its shape, not its plotted path; only the marked distances are real.",
    art: { main: "earth", second: "rock", fx: "loop" },
    shotZoom: 9,
    shotPitch: 1.0,
    scene(ctx) {
      const earth = ctx.host;
      const sunBody = ctx.findBody("Sun");
      const rig = moonRig(ctx);
      if (!rig || !sunBody) return { duration: 22, update() {} };
      const U = ctx.unit;
      /* Moon's mean distance 384,400 km (NASA); the site's Moon orbit,
       * root units (Earth radii), stands for it. */
      const MOON_KM = 384400;
      const DM = rig.distance / U;
      const kmTo = (km) => (km / MOON_KM) * DM;
      const HILL = 1.5e6;
      const up = new THREE.Vector3(0, 1, 0);
      const E = earth.getWorldPosition(new THREE.Vector3());
      const S = sunBody.getWorldPosition(new THREE.Vector3());
      const sunward = S.clone().sub(E).setY(0).normalize();
      /* The page's axes: x across the screen, y away from the viewer
       * (the camera looks down from the sunward side's left). */
      const xAxis = new THREE.Vector3().crossVectors(up, sunward).normalize();
      const yAxis = sunward.clone().negate();
      const veil = [rig.guide].filter(Boolean);
      ctx.setVeil(veil);
      /* Camera on the -y side (toward the Sun), looking down. */
      ctx.refocus("Earth", { shotYaw: yawFor(sunward), shotPitch: 1.0, shotDistance: kmTo(HILL) * U * 3.9 });

      /* The old diagram's control points, in units where the Hill sphere
       * (1.5 million km) is 0.56, carried onto the page round the real
       * Earth. Dates are real (Wikipedia, "2024 PT5"): found Aug 7; 567,000
       * km on Aug 8; held Sept 29 19:54 UTC to Nov 25 16:43 UTC; 1.8 million
       * km on Jan 9, 2025. */
      const k = kmTo(HILL) / 0.56;
      const page = (x, y) => xAxis.clone().multiplyScalar(x * k).addScaledVector(yAxis, y * k);
      const ctrl = [
        [1.05, -0.36], [0.55, -0.27], [0.0, -0.215], [-0.42, -0.34], [-0.66, -0.2],
        [-0.8, 0.12], [-0.64, 0.46], [-0.28, 0.6], [0.2, 0.62], [0.47, 0.47], [0.85, 0.48], [1.08, 0.56],
      ].map(([x, y]) => page(x, y));
      const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal");
      const N = 400;
      const pathPts = curve.getSpacedPoints(N);
      const DAY0 = Date.UTC(2024, 6, 25);
      const marks = [[0, Date.UTC(2024, 6, 25)], [2 / 11, Date.UTC(2024, 7, 8)], [4 / 11, Date.UTC(2024, 8, 29)], [7.6 / 11, Date.UTC(2024, 10, 25)], [9 / 11, Date.UTC(2025, 0, 9)], [1, Date.UTC(2025, 1, 10)]];
      const dateAt = (f) => {
        for (let i = 1; i < marks.length; i += 1) {
          if (f <= marks[i][0]) return lerp(marks[i - 1][1], marks[i][1], (f - marks[i - 1][0]) / (marks[i][0] - marks[i - 1][0]));
        }
        return marks[marks.length - 1][1];
      };
      const CAPTURE = [4 / 11, 7.6 / 11];
      const free = ctx.line(pathPts.slice(0, 2), { colour: "#c8ccd4", opacity: 0.8 });
      const held = ctx.line(pathPts.slice(0, 2), { colour: "#7dffb0", opacity: 0.95 });
      const after = ctx.line(pathPts.slice(0, 2), { colour: "#c8ccd4", opacity: 0.8 });
      const ghost = ctx.line(pathPts, { colour: "#c8ccd4", opacity: 0.15 });
      const moonOrbit = ctx.circle(DM, { plane: "xz", colour: "#cfd7e6", opacity: 0.5 });
      const hill = ctx.circle(kmTo(HILL), { plane: "xz", colour: "#7fd8ff", opacity: 0.45, dashed: true, dash: 0.6, gap: 0.5 });
      ctx.label(["Moon's orbit"], { at: yAxis.clone().multiplyScalar(-DM - 1.6), height: 0.022, declutter: false });
      ctx.label(["Where Earth's pull wins", "about 1.5 million km"], { at: page(0.42, -0.5), height: 0.026, declutter: false });
      const rockGlow = ctx.glow("#e8f1ff", 1.4, { opacity: 0.9 });
      const finder = finderRing("#7dffb0");
      ctx.add(finder);
      const tag = ctx.label(["2024 PT5", "about 10 m across (marked)"], { height: 0.024, align: "left", declutter: false });
      const near = curve.getPoint(2 / 11);
      const nearLabel = ctx.label(["Aug 8: 567,000 km"], { at: near.clone().addScaledVector(yAxis, -1.4), height: 0.022, declutter: false });
      const far = curve.getPoint(9 / 11);
      const farLabel = ctx.label(["Jan 9, 2025: 1.8 million km"], { at: far.clone().addScaledVector(yAxis, -1.4), height: 0.022, declutter: false });
      const earthLabel = ctx.label(["Earth"], { at: new THREE.Vector3(0, 0, 0).addScaledVector(yAxis, -2.4), height: 0.022, declutter: false });
      const moonLabel = ctx.label(["Moon"], { height: 0.022, declutter: false });
      const hud = ctx.hudLayer();
      const readout = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.032, declutter: false });
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
      void hill; void moonOrbit; void ghost; void earthLabel;

      ctx.tell([
        { at: 0, label: "August 2024", text: "A small asteroid, 2024 PT5, about 10 m across, drifts past Earth at only about 1 km/s." },
        { at: 0.3, label: "Caught", text: "From Sept 29 it is moving slowly enough that Earth's gravity holds it: a second moon, for 57 days." },
        { at: 0.58, label: "A loose loop", text: "It never goes all the way round — it traces part of a loose loop, far outside the Moon's orbit." },
        { at: 0.75, label: "Drifting away", text: "On Nov 25 it slips free, back into orbit around the Sun. It may be a chip of the Moon, and returns in 2055." },
      ]);

      const M = new THREE.Vector3();
      const scr = new THREE.Vector3();
      return {
        duration: 22,
        update(p) {
          E.copy(earth.getWorldPosition(E));
          const f = span(p, 0.03, 0.96);
          const idx = Math.max(1, Math.round(f * N));
          const c0 = Math.round(CAPTURE[0] * N);
          const c1 = Math.round(CAPTURE[1] * N);
          ctx.setLine(free, pathPts.slice(0, Math.max(2, Math.min(idx, c0) + 1)));
          if (idx > c0) ctx.setLine(held, pathPts.slice(c0, Math.min(idx, c1) + 1));
          held.visible = idx > c0 + 1;
          if (idx > c1) ctx.setLine(after, pathPts.slice(c1, idx + 1));
          after.visible = idx > c1 + 1;
          const pos = curve.getPointAt(Math.min(1, f));
          rockGlow.position.copy(pos);
          finder.position.copy(pos);
          scr.copy(pos).multiplyScalar(U).add(E);
          finder.scale.setScalar(0.06);
          tag.position.copy(pos).addScaledVector(xAxis, 1.2);
          const ms = dateAt(f);
          const d = new Date(ms);
          /* The real Moon on its 27.32-day orbit (NASA), placed by the date. */
          const ma = ((ms - DAY0) / 86400000 / 27.32) * TAU;
          M.copy(xAxis).multiplyScalar(Math.cos(ma)).addScaledVector(yAxis, Math.sin(ma)).multiplyScalar(rig.distance).add(E);
          rig.place(M);
          moonLabel.position.copy(M).sub(E).divideScalar(U).addScaledVector(yAxis, -1.3);
          const heldNow = f >= CAPTURE[0] && f <= CAPTURE[1];
          const dayN = Math.min(57, Math.max(1, Math.round((ms - Date.UTC(2024, 8, 29)) / 86400000) + 1));
          readout.userData.draw([
            `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`,
            heldNow ? `held by Earth's gravity · day ${dayN} of 57` : f < CAPTURE[0] ? "orbiting the Sun, passing Earth slowly" : "free again, orbiting the Sun",
          ]);
          ctx.fade(nearLabel, smooth(f, 0.17, 0.2));
          ctx.fade(farLabel, smooth(f, 0.8, 0.83));
        },
        dispose() { rig.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------ leonid-storm-1833 */
  event({
    id: "leonid-storm-1833",
    section: "earth",
    body: "Sun",
    title: "The Leonid meteor storm",
    place: "Earth's sky · eastern North America",
    kind: "recorded",
    family: "smallBody",
    when: "November 12–13, 1833",
    often: "once, 1833 · the shower every November",
    timeline: { last: "Storm: Nov 17, 1966, over western North America", next: "Every mid-November as an ordinary shower" },
    detail: "Tens of thousands of shooting stars an hour, all streaming from one point in Leo: the night the stars fell",
    frequency: "The Leonid shower returns every November. True storms come only in some years near the parent comet's 33-year returns, when Earth hits a dense, young dust trail: 1833, 1866 and 1966 were the great ones.",
    cause: "Comet Tempel–Tuttle sheds dust each time it passes the Sun, and the dust spreads out along the comet's orbit as a trail. Earth's orbit crosses that trail every mid-November. In 1833 Earth ploughed straight through a dense, young stretch of it. The comet goes round the Sun the opposite way to Earth, so the grains hit the air head-on at about 71 km/s and burn up 100 km or so overhead.",
    note: "Yale's Denison Olmsted noticed that every streak traced back to one point in Leo — the radiant — and argued the meteors came from space, not the air. Meteor science starts that night.",
    accuracy: "First the site's own Sun and Earth with the comet's real orbit (JPL elements), drawn on the site's compressed distances and turned about the Sun so that the crossing point falls where the site's Earth is now. The dust and the comet's tail are illustrations; grains are far too small to see. Then the real Earth with the stream drawn far denser and larger than real. Last a painted sky: Leo's stars are placed from their real positions; rates in 1833 were estimated by eye and vary from tens of thousands to more than a hundred thousand an hour.",
    art: { main: "comet", fx: "rain" },
    shotZoom: 11,
    shotPitch: 1.0,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      if (!earth) return { duration: 26, update() {} };
      const U = ctx.unit;
      const up = new THREE.Vector3(0, 1, 0);
      const sunW = sun.getWorldPosition(new THREE.Vector3());
      const E = earth.getWorldPosition(new THREE.Vector3());
      const toRoot = (w) => w.clone().sub(sunW).divideScalar(U);
      /* 55P/Tempel–Tuttle (JPL Small-Body Database): q 0.9764 AU, e 0.9055,
       * i 162.49°, node 235.27°, perihelion argument 172.50°. Earth meets
       * its stream at the descending node, heliocentric longitude 55.27°
       * (the Leonids' solar longitude, 235.27°, less 180°). */
      const q = 0.9764;
      const ecc = 0.9055;
      const inc = 162.49 * D2R;
      const argP = 172.5 * D2R;
      const earthLon = Math.atan2(E.z - sunW.z, E.x - sunW.x);
      const node = 235.27 * D2R + (earthLon - 55.27 * D2R);
      const pSemi = q * (1 + ecc);
      const at = (nu, out = new THREE.Vector3()) => {
        const rAu = pSemi / (1 + ecc * Math.cos(nu));
        const r = smallBodyAuToScene(rAu);
        const u = argP + nu;
        const x = r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc));
        const y = r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc));
        const z = r * Math.sin(u) * Math.sin(inc);
        /* ecliptic (x, y, z) -> the scene's (x, z, y), as every orbit here */
        return out.set(x, z, y).add(sunW);
      };
      const NU = 2.7;
      const orbitPts = [];
      for (let i = 0; i <= 360; i += 1) orbitPts.push(toRoot(at(lerp(-NU, NU, i / 360))));
      const orbit = ctx.line(orbitPts, { colour: "#bfe9ff", opacity: 0.5 });
      /* The comet: a head and a tail pointing away from the Sun. */
      const head = ctx.glow("#e8fbff", 30 / U, { opacity: 0 });
      const tail = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#bfe9ff", opacity: 0.8 });
      const cometLabel = ctx.label(["Comet Tempel–Tuttle", "every 33 years"], { height: 0.026, align: "left", declutter: false });
      /* Dust shed near the Sun, spreading along the orbit. */
      const ND = 2400;
      const dust = ctx.cloud(ND, { size: 2.4 });
      const r = rng(55);
      const grains = Array.from({ length: ND }, () => ({ nu: (r() - 0.5) * 2 * 0.9, spread: (r() - 0.5), lat: (r() - 0.5), k: r() }));
      grains.forEach((_, i) => dust.tint(i, i % 3 ? "#d8ecff" : "#fff0d0"));
      const trailLabel = ctx.label(["Its trail of dust", "spread along the orbit"], { height: 0.026, declutter: false });
      const finder = finderRing("#7fd0ff");
      ctx.add(finder);
      finder.scale.setScalar(0.05);
      const earthTag = ctx.label(["Earth", "crosses the trail every November"], { height: 0.026, align: "left", declutter: false });

      /* ---- act two, on Earth: the stream meeting the planet head-on.
       * Earth's velocity, from its own orbit. */
      const data = earth.userData;
      const M0 = data.meanAnomaly ?? data.angle ?? 0;
      const orbitAt = (Mx) => setOrbitPosition(new THREE.Vector3(), data.orbitRadius ?? 306, data.orbitEccentricity ?? 0, Mx, data.orbitInclination ?? 0, data.orbitRotation ?? 0);
      const vDir = orbitAt(M0 + 0.001).sub(orbitAt(M0)).normalize();
      const NM = 1400;
      const streak = streaks(ctx, NM);
      const sr = rng(1833);
      const side1 = new THREE.Vector3().crossVectors(up, vDir).normalize();
      const side2 = new THREE.Vector3().crossVectors(vDir, side1).normalize();
      const meteors = Array.from({ length: NM }, () => {
        const a = sr() * TAU;
        const b = Math.sqrt(sr()) * 1.35;
        return { off: side1.clone().multiplyScalar(Math.cos(a) * b).addScaledVector(side2, Math.sin(a) * b), t0: sr(), speed: 0.8 + sr() * 0.4 };
      });
      const white = new THREE.Color("#f2fbff");
      const green = new THREE.Color("#5dffb0");
      const spin = spinner(earth);

      const hud = ctx.hudLayer();
      const title = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label([""], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      /* ---- act three: the sky over North America that night */
      const skyG = new THREE.Group();
      hud.add(skyG);
      const W = ctx.halfWidth * 0.95;
      const H = 0.86;
      gradient(ctx, -W, W, -H, H, "#02040b", "#0e1a35", { parent: skyG });
      skyStars(ctx, 520, -W, W, -0.6, H, { seed: 1833, parent: skyG });
      skyline(ctx, -W, W, -0.66, { seed: 4, parent: skyG });
      /* Leo (J2000 RA°, Dec°; Hipparcos), drawn around the radiant. Leonid
       * radiant about RA 152°, Dec +22° (IMO). */
      const RAD = { ra: 152, dec: 22 };
      const sc = 0.03; /* layout: units per degree */
      const radiant = new THREE.Vector3(-0.18, 0.22, 0);
      const skyAt = (ra, dec) => new THREE.Vector3(radiant.x - (ra - RAD.ra) * Math.cos(RAD.dec * D2R) * sc, radiant.y + (dec - RAD.dec) * sc, 0);
      const LEO = {
        Regulus: [152.09, 11.97, 1.4], eta: [151.83, 16.76, 3.5], Algieba: [154.99, 19.84, 2.0], Adhafera: [154.17, 23.42, 3.4],
        mu: [148.19, 26.01, 3.9], eps: [146.46, 23.77, 3.0], Zosma: [168.53, 20.52, 2.6], Chertan: [168.56, 15.43, 3.3], Denebola: [177.26, 14.57, 2.1],
      };
      const leo = ctx.cloud(Object.keys(LEO).length, { size: 5, parent: skyG });
      Object.values(LEO).forEach(([ra, dec, mag], i) => {
        const v = skyAt(ra, dec);
        leo.set(i, v.x, v.y, 0.005);
        leo.size[i] = 3 + (4 - mag) * 2.2;
        leo.tint(i, "#eef3ff");
      });
      leo.commit();
      const join = (...names) => ctx.line(names.map((nm) => skyAt(LEO[nm][0], LEO[nm][1])), { colour: "#8fb0e0", opacity: 0.35, parent: skyG });
      const figure = [join("eps", "mu", "Adhafera", "Algieba", "eta", "Regulus"), join("Algieba", "Zosma", "Denebola", "Chertan", "Regulus"), join("Zosma", "Chertan")];
      const leoLabel = ctx.label(["Leo", "the Sickle holds the radiant"], { at: [skyAt(162, 27).x, skyAt(162, 27).y + 0.04, 0], height: 0.03, parent: skyG, declutter: false });
      const radiantMark = ctx.circle(0.035, { plane: "xy", colour: "#ffd27f", opacity: 0.8, parent: skyG });
      radiantMark.position.copy(radiant);
      const radiantLabel = ctx.label(["The radiant", "where Earth meets the stream head-on"], { at: [radiant.x + 0.42, radiant.y - 0.16, 0], height: 0.026, colour: "#ffd27f", parent: skyG, declutter: false });
      const M = 1800;
      const sky = streaks(ctx, M, { parent: skyG });
      const random = rng(55);
      const density = (x) => 0.06 + smooth(x, 0.1, 0.55) * (1 - 0.3 * smooth(x, 0.88, 1));
      const cdf = [];
      let acc = 0;
      for (let i = 0; i <= 500; i += 1) { acc += density(i / 500); cdf.push(acc); }
      const list = [];
      for (let j = 0; j < M; j += 1) {
        const target = ((j + random()) / M) * acc;
        let lo = 0;
        while (cdf[lo] < target) lo += 1;
        const d0 = 0.04 + 0.85 * Math.pow(random(), 0.8);
        list.push({ t0: (lo / 500), a: random() * TAU, d0, len: (0.05 + 0.2 * random()) * (0.3 + d0), life: 0.03 + 0.03 * random(), b: 0.45 + 0.55 * random() });
      }
      const black = new THREE.Color("#000000");
      const readout = ctx.label(["", ""], { parent: skyG, at: [-0.25, -0.76, 0], height: 0.03, declutter: false });
      ctx.fade(skyG, 0);
      skyG.visible = false;

      ctx.tell([
        { at: 0, label: "The comet", text: "Comet Tempel–Tuttle swings round the Sun every 33 years. Each time, the Sun's heat drives off dust." },
        { at: 0.14, label: "A trail of dust", text: "The dust spreads out along the comet's orbit, a river of grains, densest near where the comet has just been." },
        { at: 0.26, label: "The crossing", text: "Earth's orbit cuts through the comet's. Every mid-November Earth passes through the trail." },
        { at: 0.36, label: "Head-on", text: "The comet goes round the Sun the opposite way to Earth, so the grains hit the air head-on, at about 71 km/s, and burn up 100 km overhead: shooting stars." },
        { at: 0.64, label: "Nov 12–13, 1833", text: "That night Earth hit a dense young stretch of the trail. Over North America, tens of thousands of shooting stars an hour, all from one point in Leo." },
        { at: 0.84, label: "The radiant", text: "Denison Olmsted of Yale saw they all came from one point — the direction Earth was heading into the stream — and meteor science began." },
      ]);

      const cut = cutter(ctx);
      let stage = 0;
      let lastT = ctx.t;
      const P = new THREE.Vector3();
      const W0 = new THREE.Vector3();
      return {
        duration: 28,
        update(p) {
          const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
          lastT = ctx.t;
          earth.getWorldPosition(E);
          /* ---- act one: the comet, its dust, the crossing */
          const cnu = lerp(-2.3, 1.6, easeInOut(span(p, 0.0, 0.3)));
          at(cnu, W0);
          head.position.copy(toRoot(W0));
          const rAu = pSemi / (1 + ecc * Math.cos(cnu));
          const active = smooth(3.5 - rAu, 0, 1.5);
          ctx.fade(head, p < 0.34 ? smooth(p, 0.0, 0.03) * (0.5 + 0.5 * active) : 0);
          const away = W0.clone().sub(sunW).normalize();
          ctx.setLine(tail, [toRoot(W0), toRoot(W0.clone().addScaledVector(away, 60 * active + 5))]);
          ctx.fade(tail, p < 0.34 ? active : 0);
          cometLabel.position.copy(toRoot(W0)).add(new THREE.Vector3(0.4, 0.5, 0));
          ctx.fade(cometLabel, smooth(p, 0.01, 0.04) * (1 - smooth(p, 0.12, 0.15)));
          /* Dust: shed once the comet is near the Sun, then spreading. */
          const shed = smooth(p, 0.1, 0.3);
          for (let i = 0; i < ND; i += 1) {
            const g = grains[i];
            const nuG = lerp(cnu, g.nu, shed * (0.4 + 0.6 * g.k));
            at(nuG, P);
            const rr = P.clone().sub(sunW);
            P.addScaledVector(rr.normalize(), g.spread * 4).add(new THREE.Vector3(0, g.lat * 3, 0));
            const R0 = toRoot(P);
            dust.set(i, R0.x, R0.y, R0.z);
            dust.alpha[i] = p < 0.34 ? 0.55 * smooth(p, 0.08 + g.k * 0.06, 0.2 + g.k * 0.06) : 0;
          }
          dust.commit();
          trailLabel.position.copy(toRoot(at(-0.5)).add(new THREE.Vector3(0, 0.6, 0)));
          ctx.fade(trailLabel, smooth(p, 0.15, 0.19) * (1 - smooth(p, 0.26, 0.29)));
          finder.position.copy(toRoot(E));
          ctx.fade(finder, smooth(p, 0.25, 0.28) * (1 - smooth(p, 0.33, 0.34)));
          earthTag.position.copy(toRoot(E)).add(new THREE.Vector3(0.3, 0.3, 0));
          ctx.fade(earthTag, smooth(p, 0.26, 0.29) * (1 - smooth(p, 0.33, 0.34)));
          ctx.fade(orbit, p < 0.34 ? smooth(p, 0.0, 0.04) : 0);

          /* ---- act two: on to Earth */
          if (p > 0.33 && stage === 0) {
            stage = 1;
            /* Side-on to the stream (it runs left to right), turned a
             * little toward the hemisphere it strikes, the dawn side. */
            const side = vDir.clone().negate().cross(up).normalize();
            const view = side.multiplyScalar(Math.cos(0.6)).addScaledVector(vDir, Math.sin(0.6)).normalize();
            flyTo(ctx, "Earth", { shotYaw: yawFor(view), shotPitch: 0.22, shotDistance: 8.5 }, { near: 12, maxSeconds: 8 });
          }
          if (stage >= 1) spin.turnToward(38, -80, vDir, 0.1);
          const s2 = p > 0.36 && p < 0.62;
          for (let j = 0; j < NM; j += 1) {
            const m = meteors[j];
            if (!s2) { streak.hide(j); continue; }
            const tt = ((span(p, 0.36, 0.62) * 3 + m.t0) % 1) * m.speed;
            /* Along -vDir through the shower's cross-section, Earth radii. */
            const along = lerp(5, -3, tt);
            const pt = vDir.clone().multiplyScalar(along).add(m.off);
            const rr = pt.length();
            const burn = rr < 1.05 && pt.dot(vDir) > 0;
            const hitEarth = m.off.length() < 1.03;
            if (hitEarth && pt.dot(vDir) < Math.sqrt(Math.max(0, 1.02 * 1.02 - m.off.lengthSq()))) { streak.hide(j); continue; }
            const tailPt = pt.clone().addScaledVector(vDir, burn ? 0.22 : 0.08);
            const a0 = toRoot(E.clone().addScaledVector(pt, bodyRadius(earth)));
            const b0 = toRoot(E.clone().addScaledVector(tailPt, bodyRadius(earth)));
            streak.set(j, a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, burn ? white : green, burn ? green : black, burn ? 1 : 0.18, 0);
          }
          streak.commit();

          /* ---- act three: the night sky */
          const toSky = p > 0.62;
          cut(toSky);
          const darkWords = p > 0.62 && p < 0.65;
          cutWords.userData.draw(["Nov 12–13, 1833 · before dawn"]);
          ctx.fade(cutWords, darkWords ? 1 : 0);
          skyG.visible = p > 0.645;
          if (skyG.visible) {
            ctx.fade(skyG, smooth(p, 0.645, 0.67));
            const q3 = span(p, 0.65, 1);
            for (let j = 0; j < M; j += 1) {
              const m = list[j];
              const u = (q3 - m.t0) / m.life;
              if (u <= 0 || u >= 1) { sky.hide(j); continue; }
              const dx = Math.cos(m.a);
              const dy = Math.sin(m.a);
              const hd = m.d0 + m.len * u;
              const tl = Math.max(m.d0, hd - m.len * 0.7);
              const hx = radiant.x + dx * hd;
              const hy = radiant.y + dy * hd;
              if (hy < -0.62 || hy > H || Math.abs(hx) > W) { sky.hide(j); continue; }
              const fade = m.b * Math.sin(Math.PI * Math.min(1, u * 1.3));
              sky.set(j, hx, hy, 0.01, radiant.x + dx * tl, radiant.y + dy * tl, 0.01, white, j % 3 ? black : green, fade, j % 3 ? 0 : 0.25 * fade);
            }
            sky.commit();
            const showRad = smooth(p, 0.84, 0.88);
            ctx.fade(radiantMark, showRad * (0.7 + 0.3 * Math.sin(ctx.t * 3)));
            ctx.fade(radiantLabel, showRad);
            figure.forEach((f) => ctx.fade(f, 0.35 + 0.65 * showRad));
            ctx.fade(leoLabel, smooth(p, 0.66, 0.7));
            readout.userData.draw(["Night of Nov 12–13, 1833", q3 < 0.15 ? "a few shooting stars" : q3 < 0.35 ? "dozens a minute, and rising" : "tens of thousands an hour"]);
          }
          title.userData.draw(p < 0.34 ? ["The Sun, Earth and a comet", "seen from above the Solar System"] : ["Earth, November 1833", "the stream meets the dawn side head-on"]);
          ctx.fade(title, p < 0.62 && !(p > 0.33 && p < 0.37) ? 1 : 0);
          void dt;
        },
        dispose() { spin.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------------- precession */
  event({
    id: "precession",
    section: "earth",
    body: "Earth",
    title: "Earth's wobble: precession",
    place: "Earth · its axis and the northern sky",
    kind: "ongoing",
    family: "orbit",
    often: "one turn every 26,000 years",
    timeline: { last: "Thuban was the pole star around 2800 BC", next: "Vega near the pole around AD 14,000" },
    detail: "Earth's tilted axis slowly sweeps round a cone every 26,000 years, so the pole star changes: Polaris now, Vega in about 12,000 years",
    frequency: "Continuous: one full circle in about 25,800 years. The pole moves about 1° on the sky every 72 years.",
    cause: "Earth bulges at the equator. The Sun and Moon pull on that bulge, trying to straighten the tilted planet up; because Earth is spinning, it responds like a gyroscope or a top: instead of straightening, its axis slowly swings round.",
    note: "A pole star is simply whichever bright star happens to sit near the point the axis aims at: as Earth turns, it alone stays still while every other star circles round it, so it marks north. Sailors and travellers have steered by Polaris for centuries. The Greek astronomer Hipparchus noticed the slow drift around 130 BC, comparing star positions with older records.",
    accuracy: "Played on the site's own Earth, its axis set to the real 23.4° tilt and turned by hand (the site's usual spin is paused). The stars are placed in their real directions round the pole of Earth's orbit (Hipparcos positions converted to ecliptic coordinates), drawn on a sphere a few Earth radii out instead of at their real, vast distances. Their own slow motions are ignored, so dates are rounded. The night-sky view in the middle is a painted time-lapse; star positions there are real.",
    art: { main: "earth", fx: "wobble" },
    shotZoom: 9,
    shotPitch: 0.22,
    scene(ctx) {
      const earth = ctx.host;
      const U = ctx.unit;
      /* Axial tilt 23.44° (IAU); precession period about 25,772 years (IERS). */
      const TILT = 23.44 * D2R;
      const PERIOD = 25772;
      const up = new THREE.Vector3(0, 1, 0);
      const SKY = 5.5;
      /* Stars: [ecliptic longitude°, angle from the ecliptic pole°, magnitude],
       * from J2000 RA/Dec (Hipparcos) at obliquity 23.44°. */
      const STARS = {
        Polaris: [88.57, 23.9, 2.0], Vega: [285.32, 28.27, 0.0], Thuban: [157.46, 23.64, 3.7], Alderamin: [12.78, 21.09, 2.5],
        Deneb: [335.33, 30.09, 1.3], Errai: [60.09, 25.33, 3.2], Kochab: [133.32, 17.01, 2.1],
      };
      /* ecliptic (lon, colat) -> world: the ecliptic pole is up, and
       * longitude runs as every orbit here does (ecliptic y -> scene z). */
      const dirOf = (lon, colat) => new THREE.Vector3(Math.sin(colat * D2R) * Math.cos(lon * D2R), Math.cos(colat * D2R), Math.sin(colat * D2R) * Math.sin(lon * D2R));
      const poleLonAt = (year) => 90 - (360 * (year - 2000)) / PERIOD;
      const axisAt = (year) => dirOf(poleLonAt(year), 23.44);

      const saved = earth.rotation.clone();
      const qA = new THREE.Quaternion();
      const qS = new THREE.Quaternion();
      const qParent = new THREE.Quaternion();
      let spinAngle = 0;
      const orient = (axis) => {
        earth.parent?.getWorldQuaternion(qParent);
        qA.setFromUnitVectors(up, axis);
        qS.setFromAxisAngle(up, spinAngle);
        earth.quaternion.copy(qParent.invert()).multiply(qA).multiply(qS);
        earth.updateMatrixWorld(true);
      };
      orient(axisAt(2026));
      /* Side-on, the axis leaning to the left (clear of the event card). */
      const lean = axisAt(2026).setY(0).normalize();
      ctx.refocus("Earth", { shotYaw: yawWithRight(lean.clone().negate()), shotZoom: 9, shotPitch: 0.22 });
      const rig = moonRig(ctx);
      const veil = rig ? [rig.system].filter(Boolean) : [];
      ctx.setVeil(veil);

      /* The axis, through the poles and on out to the sky. */
      const axisLine = ctx.line([[0, -1.5, 0], [0, SKY, 0]], { colour: "#ffd27f", opacity: 0.95, additive: false });
      const axisTip = ctx.glow("#ffd27f", 0.5, { opacity: 0.9 });
      /* The cone the axis sweeps, and its path across the sky. */
      const coneR = SKY * Math.sin(TILT);
      const coneH = SKY * Math.cos(TILT);
      const path = ctx.circle(coneR, { plane: "xz", colour: "#ffd27f", opacity: 0.55, dashed: true, dash: 0.25, gap: 0.18 });
      path.position.y = coneH;
      const rays = [];
      for (let i = 0; i < 24; i += 1) {
        const a = (i / 24) * TAU;
        rays.push(ctx.line([[0, 0, 0], [Math.cos(a) * coneR, coneH, Math.sin(a) * coneR]], { colour: "#ffd27f", opacity: 0.1 }));
      }
      const pathLabel = ctx.label(["The axis's path", "one circle in 26,000 years"], { at: [coneR + 0.4, coneH + 0.6, 0], height: 0.024, align: "left", declutter: false });
      /* The stars, a few Earth radii out in their real directions. */
      const starCloud = ctx.cloud(Object.keys(STARS).length + 260, { size: 4 });
      const sr = rng(26);
      let si = 0;
      const named = {};
      Object.entries(STARS).forEach(([name, [lon, colat, mag]]) => {
        const v = dirOf(lon, colat).multiplyScalar(SKY);
        starCloud.set(si, v.x, v.y, v.z);
        starCloud.size[si] = 4 + (4 - mag) * 2.6;
        starCloud.tint(si, "#f4f6ff");
        named[name] = v;
        si += 1;
      });
      for (; si < starCloud.count; si += 1) {
        const v = dirOf(sr() * 360, Math.sqrt(sr()) * 45).multiplyScalar(SKY * (1 + sr() * 0.05));
        starCloud.set(si, v.x, v.y, v.z);
        starCloud.size[si] = 1.2 + sr() * 1.8;
        starCloud.alpha[si] = 0.25 + sr() * 0.45;
      }
      starCloud.commit();
      const labels = Object.fromEntries(["Polaris", "Vega", "Thuban", "Deneb", "Alderamin"].map((name) => [name, ctx.label([name], { at: named[name].clone().multiplyScalar(1.07).add(new THREE.Vector3(0, 0.35, 0)), height: 0.024, declutter: false })]));
      const poleRing = ctx.circle(0.45, { plane: "xy", colour: "#ffd27f", opacity: 0.95, additive: false });
      const polarisNote = ctx.label(["Polaris, the North Star", "the axis points at it"], { at: named.Polaris.clone().add(new THREE.Vector3(0, 1.2, 0)), height: 0.026, colour: "#ffd27f", declutter: false });

      const hud = ctx.hudLayer();
      const readout = ctx.label(["", ""], { parent: hud, at: [0, 0.64, 0], height: 0.034, declutter: false });
      const cutWords = ctx.label([""], { parent: hud, at: [0, 0, 0], height: 0.044, declutter: false });
      ctx.fade(cutWords, 0);

      /* ---- the night sky facing north, as a time-lapse */
      const night = new THREE.Group();
      hud.add(night);
      const W = ctx.halfWidth * 0.95;
      gradient(ctx, -W, W, -0.86, 0.86, "#02040b", "#0b1530", { parent: night });
      skyline(ctx, -W, W, -0.62, { seed: 26, parent: night });
      /* J2000 RA°, Dec° (Hipparcos): Polaris, the Plough (Big Dipper) and
       * Cassiopeia, the two shapes most people find north by. */
      const NIGHT = {
        Polaris: [37.95, 89.26, 2.0],
        Dubhe: [165.93, 61.75, 1.8], Merak: [165.46, 56.38, 2.4], Phecda: [178.46, 53.69, 2.4], Megrez: [183.86, 57.03, 3.3],
        Alioth: [193.51, 55.96, 1.8], Mizar: [200.98, 54.93, 2.2], Alkaid: [206.89, 49.31, 1.9],
        Caph: [2.29, 59.15, 2.3], Schedar: [10.13, 56.54, 2.2], GammaCas: [14.18, 60.72, 2.2], Ruchbah: [21.45, 60.24, 2.7], Segin: [28.6, 63.67, 3.4],
        Kochab: [222.68, 74.16, 2.1], Pherkad: [230.18, 71.83, 3.0],
      };
      const PC = new THREE.Vector3(-0.4, 0.04, 0);
      const ks = 0.019; /* layout: hud units per degree from the pole */
      const chart = (ra, dec, lst) => {
        const th = (90 + lst - ra) * D2R;
        const rr = (90 - dec) * ks;
        return new THREE.Vector3(PC.x + Math.cos(th) * rr, PC.y + Math.sin(th) * rr, 0);
      };
      const nightStars = ctx.cloud(Object.keys(NIGHT).length + 70, { parent: night, size: 4 });
      const extra = Array.from({ length: 70 }, () => [sr() * 360, 48 + Math.pow(sr(), 0.7) * 42, 3.5 + sr() * 1.5]);
      const allNight = [...Object.values(NIGHT), ...extra];
      allNight.forEach(([, , mag], i) => { nightStars.size[i] = Math.max(1.4, 3 + (4 - mag) * 2); nightStars.tint(i, "#eef3ff"); });
      const trails = allNight.map(() => ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#8fb0e0", opacity: 0.35, parent: night }));
      const dipper = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#8fb0e0", opacity: 0.6, parent: night });
      const cas = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#8fb0e0", opacity: 0.6, parent: night });
      const pointer = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.7, parent: night, additive: false });
      const nPolaris = ctx.label(["Polaris", "stays put: north is below it"], { parent: night, height: 0.026, colour: "#ffd27f", declutter: false });
      const nDipper = ctx.label(["The Plough (Big Dipper)", "its two end stars point to Polaris"], { parent: night, height: 0.024, declutter: false });
      const nCas = ctx.label(["Cassiopeia"], { parent: night, height: 0.024, declutter: false });
      const north = ctx.label(["North"], { parent: night, at: [PC.x, -0.76, 0.03], height: 0.024, declutter: false });
      void north;
      ctx.fade(night, 0);
      night.visible = false;

      ctx.tell([
        { at: 0, label: "Earth's axis", text: "Earth spins round an axis through its poles, tilted 23.4°. Today the north end points almost exactly at one star: Polaris, the North Star." },
        { at: 0.22, label: "The North Star", text: "So as Earth turns, the whole night sky wheels round Polaris, and Polaris alone stays put. Find it from the Plough's two end stars; below it is north." },
        { at: 0.44, label: "A spinning top", text: "But the axis is not fixed. The Sun and Moon tug on Earth's bulging middle, and like a top it slowly swings round a cone, once every 26,000 years." },
        { at: 0.6, label: "Thuban", text: "Back in time, when the first pyramids were built, around 2800 BC, it pointed near Thuban, a faint star in Draco." },
        { at: 0.76, label: "Vega", text: "Forward: in about 12,000 years it will point near Vega, one of the brightest stars, and Vega will be the pole star." },
      ]);

      const cut = cutter(ctx, veil);
      const yearAt = (p) => (p < 0.46 ? 2026
        : p < 0.6 ? lerp(2026, -2800, easeInOut(span(p, 0.46, 0.6)))
          : lerp(-2800, 13800, easeInOut(span(p, 0.62, 0.9))));
      const poleStar = (axis) => {
        let best = null;
        let bestA = 99;
        Object.entries(named).forEach(([name, v]) => {
          const a = v.clone().normalize().angleTo(axis) / D2R;
          if (a < bestA) { bestA = a; best = name; }
        });
        return bestA < 5 ? `${best} is the pole star` : "no bright star near the pole";
      };
      let lastT = ctx.t;
      let stage = 0;
      return {
        duration: 28,
        update(p) {
          const dt = Math.min(0.1, Math.max(0, ctx.t - lastT));
          lastT = ctx.t;
          const year = yearAt(p);
          const axis = axisAt(year);
          spinAngle += dt * 1.1;
          orient(axis);
          ctx.setLine(axisLine, [axis.clone().multiplyScalar(-1.6), axis.clone().multiplyScalar(SKY)]);
          axisTip.position.copy(axis).multiplyScalar(SKY);
          poleRing.position.copy(axis).multiplyScalar(SKY);
          poleRing.quaternion.copy(ctx.camera.quaternion);
          const inC = p > 0.44;
          ctx.fade(path, inC ? smooth(p, 0.46, 0.5) : 0);
          rays.forEach((r) => ctx.fade(r, inC ? smooth(p, 0.46, 0.5) : 0));
          ctx.fade(pathLabel, inC ? smooth(p, 0.47, 0.51) : 0);
          ctx.fade(polarisNote, smooth(p, 0.06, 0.1) * (1 - smooth(p, 0.18, 0.2)));
          Object.entries(labels).forEach(([name, l]) => ctx.fade(l, name === "Polaris" ? smooth(p, 0.02, 0.06) : smooth(p, 0.46, 0.5)));
          if (p > 0.45 && stage === 0) {
            stage = 1;
            /* From a little below, so the circle the axis traces on the sky
             * opens out instead of lying edge-on. */
            ctx.setZoom(8);
            ctx.aim(NaN, -0.6);
          }

          /* The night-sky time-lapse, between two cuts. */
          const inNight = p > 0.2 && p < 0.44;
          cut(inNight);
          const dark = (p > 0.2 && p < 0.225) || (p > 0.42 && p < 0.44);
          cutWords.userData.draw([p < 0.3 ? "That night sky, facing north" : "Back to Earth, and 26,000 years"]);
          ctx.fade(cutWords, dark ? 1 : 0);
          night.visible = p > 0.22 && p < 0.425;
          if (night.visible) {
            ctx.fade(night, smooth(p, 0.222, 0.24) * (1 - smooth(p, 0.41, 0.425)));
            /* Six hours of sky turning, then the trails it leaves. */
            const hours = 6 * easeInOut(span(p, 0.25, 0.4));
            const lst0 = 120;
            allNight.forEach(([ra, dec], i) => {
              const v = chart(ra, dec, lst0 + hours * 15);
              nightStars.set(i, v.x, v.y, 0.01);
              const pts = [];
              for (let h = 0; h <= hours + 1e-6; h += Math.max(0.05, hours / 40)) pts.push(chart(ra, dec, lst0 + h * 15));
              pts.push(v);
              if (pts.length < 2) pts.push(v.clone());
              ctx.setLine(trails[i], pts);
              const visible = v.y > -0.62 && Math.abs(v.x) < W;
              nightStars.alpha[i] = visible ? (i < 15 ? 1 : 0.6) : 0;
              ctx.fade(trails[i], visible ? 0.45 : 0);
            });
            nightStars.commit();
            const L = (lst) => ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "Alkaid"].map((nm) => chart(NIGHT[nm][0], NIGHT[nm][1], lst));
            const lst = lst0 + hours * 15;
            const dip = L(lst);
            ctx.setLine(dipper, [dip[0], dip[1], dip[2], dip[3], dip[0], dip[3], dip[4], dip[5], dip[6]]);
            ctx.setLine(cas, ["Caph", "Schedar", "GammaCas", "Ruchbah", "Segin"].map((nm) => chart(NIGHT[nm][0], NIGHT[nm][1], lst)));
            const pol = chart(NIGHT.Polaris[0], NIGHT.Polaris[1], lst);
            ctx.setLine(pointer, [dip[1], dip[0], dip[0].clone().lerp(pol, 0.94)]);
            nPolaris.position.copy(pol).add(new THREE.Vector3(-0.05, 0.07, 0));
            nPolaris.center.set(1, 0.5);
            nDipper.position.copy(dip[3]).add(new THREE.Vector3(0, 0.12, 0));
            nCas.position.copy(chart(NIGHT.GammaCas[0], NIGHT.GammaCas[1], lst)).add(new THREE.Vector3(0, 0.1, 0));
          }

          readout.userData.draw(p < 0.2 ? ["Today: AD 2026", "the axis points at Polaris"]
            : p < 0.44 ? ["A night's sky, sped up", "everything turns round Polaris"]
              : [year < 0 ? `${fmt(Math.round(-year / 100) * 100)} BC` : year < 10000 ? `AD ${Math.round(year)}` : `AD ${fmt(Math.round(year / 100) * 100)}`, poleStar(axis)]);
          ctx.fade(readout, dark ? 0 : 1);
        },
        dispose() { earth.rotation.copy(saved); rig?.restore(); },
      };
    },
  }),

  /* ------------------------------------------------------ magnetic-reversal */
  event({
    id: "magnetic-reversal",
    section: "earth",
    title: "Earth's magnetic poles flip",
    place: "Earth · its core and its field",
    kind: "recorded",
    family: "fields",
    when: "last about 780,000 years ago",
    often: "irregular · last ~780,000 years ago",
    timeline: { last: "The Brunhes–Matuyama reversal, about 780,000 years ago", next: "Unknown — reversals cannot be predicted" },
    detail: "Every so often Earth's magnetic field weakens, tangles and flips, and north and south swap; the last full flip was about 780,000 years ago",
    frequency: "Irregular. In the last few million years a reversal came every few hundred thousand years on average, but gaps vary hugely — once, about 120 to 83 million years ago, the field held steady for some 40 million years.",
    cause: "The field is made by the geodynamo: molten iron churning in the outer core as Earth cools and spins. The flow is turbulent, and every so often the main north–south (dipole) part of the field collapses; the field becomes weaker and messier, then rebuilds with the opposite polarity. A flip takes thousands of years.",
    note: "Lava records it. As it cools, iron minerals in it lock in the direction of the field of the time. Lava erupting at mid-ocean ridges spreads away on both sides, so the seafloor carries matching stripes of normal and reversed field — the clue that confirmed plate tectonics in the 1960s.",
    accuracy: "The field lines are a diagram of a dipole field; how it weakens and tangles in between is illustrated, not modelled. The compass needles point along that drawn field. The seafloor stripes are the real polarity record for the last 3.6 million years (Geologic Time Scale 2012), drawn at an even spreading rate.",
    art: { main: "earth", fx: "loop" },
    scene(ctx) {
      const R = 0.2;
      const globe = new THREE.Group();
      globe.rotation.x = 0.18;
      ctx.add(globe);
      /* Round 83 (Prompts.md: "make the colour and Earth's outer
       * transparent more visible"): the globe more solid, its rim brighter,
       * the core glowing through. */
      const earth = ctx.ball(R, { body: "Earth", rim: 1.1, rimColour: "#8fd8ff", parent: globe, opacity: 0.78, depthWrite: false });
      const halo = ctx.glow("#6fc4ff", R * 2.9, { opacity: 0.35, parent: globe });
      void halo;
      /* Outer core to 3,480 km of 6,371 km radius (PREM). */
      const core = ctx.ball(R * (3480 / EARTH_R), { colour: "#ff8a3c", emissive: "#7a2a00", parent: globe });
      core.renderOrder = 19;
      ctx.glow("#ffae5a", R * 1.6, { opacity: 0.5, parent: globe });
      ctx.light.set(-0.5, 0.4, 0.75).normalize();

      /* Field lines of a dipole: r = L sin²θ, drawn twice side by side so
       * they read as bolder strokes. */
      const Ls = [1.5, 2.0, 2.7];
      const AZ = 8;
      const lines = [];
      Ls.forEach((Lr, li) => {
        for (let j = 0; j < AZ; j += 1) {
          lines.push({
            L: Lr * R, az: (j / AZ) * TAU + li * 0.2, seed: li * 13 + j * 7,
            line: ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#59c2ff", opacity: 1, parent: globe }),
            line2: ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#59c2ff", opacity: 0.6, parent: globe }),
          });
        }
      });
      const normalC = new THREE.Color("#4fc3ff");
      const reversedC = new THREE.Color("#ff9a3c");
      const mixC = new THREE.Color();

      /* Compass needles round the globe (replacing the old tangle rings):
       * each points along the drawn field -- red end = the end a compass
       * calls north -- and swings round as the field flips. */
      const needle = (len, parent) => {
        const g = new THREE.Group();
        const half = (colour, s) => {
          const m = new THREE.Mesh(new THREE.ConeGeometry(len * 0.16, len * 0.5, 4), new THREE.MeshBasicMaterial({ color: colour, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
          m.position.y = s * len * 0.25;
          if (s < 0) m.rotation.z = Math.PI;
          m.renderOrder = 28;
          m.raycast = () => {};
          g.add(m);
        };
        half("#ff4a4a", 1);
        half("#f2f4f8", -1);
        const pin = new THREE.Mesh(new THREE.CircleGeometry(len * 0.06, 12), new THREE.MeshBasicMaterial({ color: "#20242c", toneMapped: false }));
        pin.position.z = 0.002;
        pin.renderOrder = 29;
        g.add(pin);
        parent.add(g);
        return g;
      };
      const NN = 14;
      const random = rng(780);
      const needles = Array.from({ length: NN }, (_, i) => {
        const a = (i / NN) * TAU + 0.1;
        const rr = R * (1.55 + 0.25 * (i % 2));
        const g = needle(R * 0.36, globe);
        g.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.02);
        return { g, a, rr, phase: random() * TAU, wild: random() };
      });
      /* A big compass beside the globe, with its card. */
      const big = new THREE.Group();
      ctx.add(big);
      ctx.disc(0.13, { colour: "#0b1220", opacity: 0.9, parent: big }).position.z = -0.01;
      ctx.circle(0.13, { plane: "xy", colour: "#9fb3c8", opacity: 0.8, parent: big, additive: false });
      const bigNeedle = needle(0.2, big);
      const cardN = ctx.label(["N"], { parent: big, at: [0, 0.17, 0], height: 0.026, declutter: false });
      const cardS = ctx.label(["S"], { parent: big, at: [0, -0.17, 0], height: 0.026, declutter: false });
      void cardN; void cardS;
      /* Which pole the field's north is at, on the globe. */
      const poleN = ctx.label(["N", "magnetic north"], { height: 0.03, colour: "#ff6a6a", declutter: false });
      const poleS = ctx.label(["S", "magnetic south"], { height: 0.03, colour: "#eef2f8", declutter: false });
      const readout = ctx.label(["", ""], { height: 0.034, declutter: false });

      /* Seafloor stripes: normal-polarity intervals of the last 3.6 million
       * years, Ma (GTS2012: Brunhes, Jaramillo, Olduvai, Gauss with Kaena and
       * Mammoth reversed). The rest is reversed. Round 83: raised clear of
       * the event card, its labels above it. */
      const NORMAL = [[0, 0.781], [0.988, 1.072], [1.778, 1.945], [2.581, 3.032], [3.116, 3.207], [3.33, 3.596]];
      const stripes = new THREE.Group();
      ctx.add(stripes);
      const ridge = 0.5;
      const perMy = 0.112; /* layout: units per million years each side */
      const y0 = -0.06;
      const y1 = 0.4;
      const rect = (xa, xb, colour, opacity) => ctx.shape([[xa, y0], [xb, y0], [xb, y1], [xa, y1]], { colour, opacity, parent: stripes });
      const bands = [];
      [-1, 1].forEach((side) => {
        bands.push({ age: 0, mesh: rect(ridge + side * 0, ridge + side * 3.6 * perMy, "#ff9a3c", 0.9) });
        NORMAL.forEach(([a0, a1]) => bands.push({ age: a0, mesh: rect(ridge + side * a0 * perMy, ridge + side * a1 * perMy, "#4fc3ff", 1) }));
      });
      bands.forEach((b, i) => { b.mesh.renderOrder = 19 + (i % (NORMAL.length + 1) === 0 ? 0 : 1); });
      const ridgeLine = ctx.line([[ridge, y0 - 0.03, 0.01], [ridge, y1 + 0.03, 0.01]], { colour: "#ffffff", opacity: 0.9, parent: stripes, additive: false });
      const bm = 0.781 * perMy;
      const bmTicks = [-1, 1].map((s) => ctx.line([[ridge + s * bm, y1, 0.01], [ridge + s * bm, y1 + 0.05, 0.01]], { colour: "#ffffff", opacity: 0.9, parent: stripes, additive: false }));
      const stripeTitle = ctx.label(["The record in the seafloor", "blue: field as today · orange: reversed"], { at: [ridge, y1 + 0.26, 0], height: 0.03, parent: stripes, declutter: false });
      const bmLabel = ctx.label(["the last flip: about 780,000 years ago"], { at: [ridge, y1 + 0.1, 0], height: 0.024, parent: stripes, declutter: false });
      const ridgeLabel = ctx.label(["ridge: new lava"], { at: [ridge, y0 - 0.06, 0], height: 0.022, parent: stripes, declutter: false });
      const oldLabel = ctx.label(["3.6 million years"], { at: [ridge - 3.6 * perMy, y0 - 0.06, 0], height: 0.022, parent: stripes, declutter: false });

      ctx.tell([
        { at: 0, label: "The geodynamo", text: "Molten iron churning in the core makes Earth's magnetic field: a north and a south, like a bar magnet. Every compass lines up with it." },
        { at: 0.16, label: "Weakening", text: "Every so often the main field fades, over thousands of years. The needles start to wander." },
        { at: 0.36, label: "Tangled", text: "For a while there is no clear north and south — just a weak, messy field, and compasses point every which way." },
        { at: 0.56, label: "Flipped", text: "Then it rebuilds the other way round. Every compass swings round: its north end now points south." },
        { at: 0.7, label: "The record", text: "Cooling lava locks in the field of its day. The last full flip was about 780,000 years ago." },
      ]);

      const P = new THREE.Vector3();
      const B = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      return {
        duration: 22,
        update(p) {
          const shift = smooth(p, 0.62, 0.72);
          globe.position.set(lerp(-0.1, -0.55, shift), lerp(0, 0.06, shift), 0);
          earth.rotation.y = ctx.t * 0.2;
          /* Dipole strength and sign (illustrative). */
          const weak = 1 - 0.88 * smooth(p, 0.14, 0.36);
          const regrow = 0.12 + 0.88 * smooth(p, 0.54, 0.7);
          const s = p < 0.45 ? weak : regrow;
          const sign = p < 0.47 ? 1 : -1;
          const tangle = win(p, 0.3, 0.6, 0.08);
          const colourMix = smooth(p, 0.42, 0.56);
          mixC.copy(normalC).lerp(reversedC, colourMix);
          lines.forEach((ln, idx) => {
            const pts = [];
            const pts2 = [];
            const Lr = ln.L * (0.55 + 0.45 * s);
            const th0 = Math.asin(Math.min(1, Math.sqrt(R / Lr)));
            for (let i = 0; i <= 56; i += 1) {
              const th = lerp(th0, Math.PI - th0, i / 56);
              const r = Lr * Math.sin(th) * Math.sin(th);
              const wob = tangle * R * 0.55;
              const n1 = Math.sin(th * 5 + ln.seed + p * 30 + ctx.t * 0.4);
              const n2 = Math.cos(th * 4 - ln.seed * 0.7 - p * 24 + ctx.t * 0.3);
              const rr = Math.max(R * 1.02, r + wob * n1 * Math.sin(th));
              P.set(rr * Math.sin(th) * Math.cos(ln.az) + wob * 0.5 * n2, rr * Math.cos(th) * sign + wob * 0.4 * n1 * n2, rr * Math.sin(th) * Math.sin(ln.az));
              pts.push(P.clone());
              pts2.push(P.clone().multiplyScalar(1.012));
            }
            ctx.setLine(ln.line, pts);
            ctx.setLine(ln.line2, pts2);
            ln.line.material.color.copy(mixC);
            ln.line2.material.color.copy(mixC);
            const a = (0.3 + 0.7 * s) * (idx % 2 ? 0.85 : 1);
            ctx.fade(ln.line, a);
            ctx.fade(ln.line2, a);
          });
          /* The needles: along the field, B = 3(m.r)r - m, with the dipole
           * m pointing to geographic south today (so a compass points
           * north); wandering as the field weakens and tangles. */
          const m = new THREE.Vector3(0, -sign * s, 0);
          needles.forEach((nd, i) => {
            tmp.set(Math.cos(nd.a), Math.sin(nd.a), 0);
            B.copy(tmp).multiplyScalar(3 * m.dot(tmp)).sub(m);
            let ang = Math.atan2(B.y, B.x) - Math.PI / 2;
            const wander = (1 - s) * 1.6 + tangle * 2.2;
            ang += wander * Math.sin(ctx.t * (1.3 + nd.wild) + nd.phase) * (0.5 + nd.wild);
            nd.g.rotation.z = ang;
          });
          /* The big compass, at a place on the equator. */
          const bang = (p < 0.42 ? 0 : p < 0.58 ? lerp(0, Math.PI, smooth(p, 0.42, 0.58)) : Math.PI) + (tangle * 1.4 + (1 - s) * 0.4) * Math.sin(ctx.t * 2.3);
          bigNeedle.rotation.z = bang;
          big.position.set(globe.position.x + 0.42, -0.42, 0);
          /* N and S: where a compass's north end points, at the top today,
           * at the bottom after the flip. */
          const topY = globe.position.y + R * 1.3 + 0.06;
          const botY = globe.position.y - R * 1.3 - 0.06;
          poleN.position.set(globe.position.x + 0.16, sign > 0 ? topY : botY, 0.3);
          poleS.position.set(globe.position.x + 0.16, sign > 0 ? botY : topY, 0.3);
          const poleA = (1 - smooth(tangle, 0.2, 0.6)) * smooth(p, 0.02, 0.06);
          ctx.fade(poleN, poleA);
          ctx.fade(poleS, poleA);
          const pct = Math.round(100 * s * (1 - 0.3 * tangle));
          readout.position.set(globe.position.x, 0.62, 0);
          readout.userData.draw([`Main field strength: about ${pct}%`, p < 0.42 ? "compasses point north" : p < 0.56 ? "compasses wander" : "compasses point south"]);
          ctx.fade(readout, smooth(p, 0, 0.03));
          /* Stripes, revealed outward from the ridge. */
          const show = smooth(p, 0.66, 0.72);
          stripes.visible = show > 0.002;
          const revealAge = 4 * smooth(p, 0.68, 0.86);
          bands.forEach((b) => ctx.fade(b.mesh, show * smooth(revealAge - b.age, 0, 0.3)));
          ctx.fade(stripeTitle, show);
          ctx.fade(bmLabel, smooth(p, 0.74, 0.78));
          ctx.fade(ridgeLabel, show);
          ctx.fade(oldLabel, smooth(p, 0.84, 0.88));
          ctx.fade(ridgeLine, show);
          bmTicks.forEach((t) => ctx.fade(t, smooth(p, 0.74, 0.78)));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ steve */
  event({
    id: "steve",
    section: "earth",
    title: "STEVE: the purple ribbon",
    place: "Earth's sky · Canada and other high latitudes",
    kind: "recurring",
    family: "fields",
    often: "now and then, during aurora displays",
    timeline: { last: "Named in 2016 by Alberta aurora watchers", next: "Any night with strong aurora, on the side nearer the equator" },
    detail: "A narrow mauve ribbon across the sky, on the equator side of the aurora, often with green 'picket fence' streaks: a river of very hot, fast gas, not an aurora",
    frequency: "Seen now and then during aurora displays, usually for 20 minutes to an hour. Amateur photographers in Canada brought it to scientists' attention around 2016.",
    cause: "An aurora glows where particles from space rain into the air. STEVE does not: it sits over a narrow stream of very hot gas in the upper atmosphere — about 3,000 °C and racing at about 6 km/s, against roughly 10 m/s outside it — and the hot gas itself glows. The green picket fence below it does come from particles raining in.",
    note: "Alberta aurora chasers called it Steve, after a joke in the film Over the Hedge. Scientists kept the name, as an acronym: Strong Thermal Emission Velocity Enhancement. A satellite (ESA's Swarm) flew through one in 2016 and measured the hot, fast stream.",
    accuracy: "A painted sky, not a photograph: shapes and colours follow photographs of STEVE. The view is looking toward the equator from beneath the aurora. Widths and speeds in the labels are measured values.",
    art: { main: "earth", fx: "aurora" },
    scene(ctx) {
      const W = ctx.halfWidth * 0.95;
      const H = 0.86;
      gradient(ctx, -W, W, -H, H, "#01040a", "#0b1526");
      skyStars(ctx, 380, -W, W, -0.55, H, { seed: 2016 });
      skyline(ctx, -W, W, -0.68, { seed: 11 });
      ctx.line([[-W, -H, 0], [W, -H, 0], [W, H, 0], [-W, H, 0], [-W, -H, 0]], { colour: "#3a4a66", opacity: 0.5 });

      /* Aurora curtains, overhead and behind (upper sky). */
      const NC = 360;
      const curtains = streaks(ctx, NC);
      const green = new THREE.Color("#3dff8a");
      const red = new THREE.Color("#ff3b6b");
      const random = rng(17);
      const cx = Array.from({ length: NC }, (_, i) => -W + (2 * W * (i + random())) / NC);
      const ch = Array.from({ length: NC }, () => 0.22 + random() * 0.24);
      const cb = Array.from({ length: NC }, () => 0.6 + random() * 0.4);
      const haze = ctx.cloud(500, { size: 22 });
      const hazeX = Array.from({ length: 500 }, () => -W + random() * 2 * W);
      const hazeY = Array.from({ length: 500 }, () => random());
      for (let i = 0; i < 500; i += 1) haze.tint(i, i % 4 ? "#2bd977" : "#a8306a");

      /* STEVE: a thin east–west arc, lower in this view (toward the equator). */
      const ribbonY = (x) => 0.0 + 0.11 * (1 - (x / (W * 1.05)) ** 2) - 0.04 * x;
      const NR = 2600;
      const ribbon = ctx.cloud(NR, { size: 4 });
      const rx = [];
      const ry = [];
      for (let i = 0; i < NR; i += 1) {
        const x = -W + random() * 2 * W;
        rx.push(x);
        ry.push((random() - 0.5) * 0.022);
        ribbon.tint(i, i % 5 ? "#c873ff" : "#f2c6ff");
      }
      const halo = ctx.cloud(700, { size: 16 });
      const hx = Array.from({ length: 700 }, () => -W + random() * 2 * W);
      for (let i = 0; i < 700; i += 1) halo.tint(i, "#8a3fd0");
      /* The picket fence: green streaks hanging below it. */
      const NP = 64;
      const fence = streaks(ctx, NP);
      const fx = Array.from({ length: NP }, (_, i) => -W * 0.85 + (1.7 * W * (i + 0.3 + random() * 0.4)) / NP);
      /* Flow: bright knots running west (to the right, facing south). */
      const knots = ctx.cloud(14, { size: 7 });
      for (let i = 0; i < 14; i += 1) knots.tint(i, "#ffe6ff");

      const auroraLabel = ctx.label(["Aurora", "particles raining in · oxygen green"], { at: [-W * 0.55, 0.74, 0], height: 0.042 });
      const steveLabel = ctx.label(["STEVE", "a narrow mauve ribbon"], { at: [-W * 0.45, ribbonY(-W * 0.45) + 0.11, 0], height: 0.044 });
      const fenceLabel = ctx.label(["Picket fence"], { at: [W * 0.32, ribbonY(W * 0.32) - 0.24, 0], height: 0.03 });
      const flowLabel = ctx.label(["→ hot gas flowing west", "about 3,000 °C · about 6 km/s · about 25 km wide"], { at: [W * 0.02, -0.38, 0], height: 0.042 });
      ctx.label(["East"], { at: [-W + 0.1, -0.78, 0.03], height: 0.024 });
      ctx.label(["West"], { at: [W - 0.1, -0.78, 0.03], height: 0.024 });

      ctx.tell([
        { at: 0, label: "Under the aurora", text: "Night in western Canada. Green curtains of aurora ripple overhead; we look toward the equator." },
        { at: 0.2, label: "STEVE", text: "A narrow purple ribbon appears on the equator side of the aurora, stretching east to west across the sky." },
        { at: 0.42, label: "Picket fence", text: "Green streaks hang beneath it like a picket fence." },
        { at: 0.62, label: "Not an aurora", text: "It glows from a river of very hot gas, about 3,000 °C, rushing westward at about 6 km/s." },
        { at: 0.84, label: "Steve", text: "Named by aurora watchers after a cartoon joke; scientists made it Strong Thermal Emission Velocity Enhancement." },
      ]);

      return {
        duration: 21,
        update(p) {
          const t = ctx.t;
          const auroraI = 0.65 + 0.35 * smooth(p, 0, 0.1) - 0.3 * smooth(p, 0.25, 0.5);
          for (let i = 0; i < NC; i += 1) {
            const x = cx[i];
            const base = 0.36 + 0.07 * Math.sin(x * 2.3 + 0.35 * Math.sin(t * 0.4)) + 0.04 * Math.sin(x * 5.1 - t * 0.25);
            const flick = 0.7 + 0.3 * Math.sin(t * 2.1 + i * 1.7);
            const k = cb[i] * flick * auroraI;
            curtains.set(i, x, base, -0.01, x + 0.01 * Math.sin(t * 0.5 + x), base + ch[i], -0.01, green, red, 0.55 * k, 0.05 * k);
          }
          curtains.commit();
          for (let i = 0; i < 500; i += 1) {
            const x = hazeX[i];
            const base = 0.36 + 0.07 * Math.sin(x * 2.3 + 0.35 * Math.sin(t * 0.4)) + 0.04 * Math.sin(x * 5.1 - t * 0.25);
            haze.set(i, x, base + hazeY[i] * (i % 4 ? 0.22 : 0.42), -0.012);
            haze.alpha[i] = (i % 4 ? 0.07 : 0.05) * auroraI;
          }
          haze.commit();
          /* STEVE fades in, holds, and dims near the end. */
          const s = smooth(p, 0.18, 0.3) * (1 - 0.45 * smooth(p, 0.9, 1));
          for (let i = 0; i < NR; i += 1) {
            ribbon.set(i, rx[i], ribbonY(rx[i]) + ry[i] * (1 + 0.3 * Math.sin(rx[i] * 9 + t * 0.6)), 0);
            ribbon.alpha[i] = 0.2 * s;
          }
          ribbon.commit();
          for (let i = 0; i < 700; i += 1) {
            halo.set(i, hx[i], ribbonY(hx[i]), -0.005);
            halo.alpha[i] = 0.05 * s;
          }
          halo.commit();
          const f = smooth(p, 0.4, 0.5) * (1 - 0.5 * smooth(p, 0.9, 1));
          for (let i = 0; i < NP; i += 1) {
            const x = fx[i];
            const top = ribbonY(x) - 0.04;
            const len = 0.09 + 0.06 * Math.sin(i * 2.7);
            const k = f * (0.55 + 0.45 * Math.sin(t * 1.3 + i * 2.2));
            fence.set(i, x, top, 0.005, x, top - len, 0.005, green, green, 0.15 * k, 0.9 * k);
          }
          fence.commit();
          const flow = smooth(p, 0.6, 0.66) * (1 - 0.5 * smooth(p, 0.9, 1));
          for (let i = 0; i < 14; i += 1) {
            const u = ((i / 14) + p * 2.2) % 1;
            const x = -W + 2 * W * u;
            knots.set(i, x, ribbonY(x), 0.01);
            knots.alpha[i] = flow * Math.sin(Math.PI * u);
          }
          knots.commit();
          ctx.fade(auroraLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, 0.4, 0.46)));
          ctx.fade(steveLabel, smooth(p, 0.24, 0.3));
          ctx.fade(fenceLabel, smooth(p, 0.46, 0.5));
          ctx.fade(flowLabel, smooth(p, 0.64, 0.7));
        },
      };
    },
  }),

  /* --------------------------------------------------------- zodiacal-light */
  event({
    id: "zodiacal-light",
    section: "earth",
    body: "Sun",
    startsDark: true,
    title: "Zodiacal light",
    place: "The inner Solar System · seen from Earth after sunset",
    kind: "ongoing",
    family: "smallBody",
    often: "every dark, clear night",
    detail: "A faint cone of light rising from the horizon along the planets' path after sunset or before dawn: sunlight scattered by dust between the planets",
    frequency: "Always there. From mid-northern latitudes it is easiest on moonless spring evenings in the west and autumn mornings in the east, when the planets' path stands steeply up from the horizon. In the tropics it can be seen all year.",
    cause: "The planets orbit inside a thin, flattened cloud of dust. Each grain is tiny — mostly a tenth of a millimetre or smaller — but there are so many that together they scatter enough sunlight to glow. The cloud is brightest close to the Sun, so the glow is widest near the horizon, where the Sun has just set.",
    note: "The dust does not last: it slowly spirals into the Sun, so it must be topped up. Models suggest most of it is shed by comets, especially those that orbit near Jupiter, with some from colliding asteroids. Opposite the Sun, a fainter patch called the gegenschein is the same dust, lit from behind us. In autumn it shows before dawn in the east, where it has been called the 'false dawn'.",
    accuracy: "First a painted sky: the cone's brightness and shape follow photographs, its angle is typical of a spring evening at mid-northern latitudes, and the constellations along the ecliptic are in their real order. Then the site's own Sun and Earth with the dust cloud drawn round them: its flattening and its fall-off away from the Sun are illustrative, and it is drawn far brighter than it is.",
    art: { main: "sun", fx: "dust" },
    shotZoom: 9,
    shotPitch: 0.42,
    scene(ctx) {
      const sun = ctx.host;
      const earth = ctx.findBody("Earth");
      const U = ctx.unit;
      const sunW = sun.getWorldPosition(new THREE.Vector3());
      const toRoot = (w) => w.clone().sub(sunW).divideScalar(U);
      /* Earth off to the left of the Sun (clear of the event card). */
      if (earth) {
        const toEarth = earth.getWorldPosition(new THREE.Vector3()).sub(sunW).setY(0).normalize();
        ctx.refocus("Sun", { shotYaw: yawWithRight(toEarth.negate()), shotZoom: 9, shotPitch: 0.42 });
      }

      const hud = ctx.hudLayer();
      const skyG = new THREE.Group();
      hud.add(skyG);
      const W = ctx.halfWidth * 0.95;
      const H = 0.86;
      gradient(ctx, -W, W, -H, H, "#010309", "#0a1328", { parent: skyG });
      const dusk = gradient(ctx, -W, W, -H, H, "#0a1a3d", "#e0793a", { order: 18, parent: skyG });
      const stars = skyStars(ctx, 520, -W, W, -0.55, H, { seed: 3, parent: skyG });
      skyline(ctx, -W, W, -0.62, { seed: 8, trees: false, parent: skyG });
      /* The Sun below the western horizon; the ecliptic leans up and to the
       * left at about 60° (spring evening at mid-northern latitudes,
       * drawing choice). */
      const foot = new THREE.Vector3(-0.12, -0.62, 0);
      const ang = 62 * D2R;
      const axis = new THREE.Vector3(-Math.cos(ang), Math.sin(ang), 0);
      const across = new THREE.Vector3(axis.y, -axis.x, 0);
      const afterglow = ctx.glow("#ff9a4a", 0.9, { opacity: 0.5, parent: skyG });
      afterglow.position.set(foot.x, foot.y - 0.05, -0.03);
      const N = 5200;
      const cone = ctx.cloud(N, { size: 14, parent: skyG });
      const random = rng(44);
      const grains = [];
      for (let i = 0; i < N; i += 1) {
        const h = Math.pow(random(), 1.4) * 1.45;
        const width = 0.26 * Math.exp(-h * 1.15) + 0.05;
        const off = (random() + random() + random() - 1.5) * width;
        const v = foot.clone().addScaledVector(axis, h).addScaledVector(across, off);
        cone.set(i, v.x, v.y, -0.006);
        grains.push(Math.exp(-h * 1.5) * Math.exp(-((off / width) ** 2) * 1.4));
        cone.tint(i, random() < 0.7 ? "#fff1d6" : "#ffe2b0");
        cone.alpha[i] = 0;
      }
      cone.commit();
      const ecliptic = ctx.line([foot, foot.clone().addScaledVector(axis, 1.62)], { colour: "#ffd27f", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.02, parent: skyG });
      /* Along the ecliptic, from the horizon up, on a spring evening: the
       * Sun has set in Pisces; then Aries, Taurus with the Pleiades, and
       * Gemini (their real order). */
      const zodiac = [["Aries", 0.42], ["Taurus · the Pleiades", 0.78], ["Gemini", 1.18]].map(([name, h]) => {
        const v = foot.clone().addScaledVector(axis, h).addScaledVector(across, -0.16);
        return ctx.label([name], { at: v, height: 0.022, colour: "#c9d6ea", align: "right", parent: skyG, declutter: false });
      });
      const pleiades = ctx.cloud(7, { size: 3.5, parent: skyG });
      for (let i = 0; i < 7; i += 1) {
        const v = foot.clone().addScaledVector(axis, 0.78 + (random() - 0.5) * 0.04).addScaledVector(across, 0.02 + (random() - 0.5) * 0.04);
        pleiades.set(i, v.x, v.y, 0.002);
        pleiades.tint(i, "#dfe9ff");
      }
      pleiades.commit();
      const eclTop = foot.clone().addScaledVector(axis, 1.3);
      const eclLabel = ctx.label(["The ecliptic", "the path of the Sun, Moon and planets"], { at: [eclTop.x + 0.12, eclTop.y + 0.12, 0], height: 0.026, align: "left", parent: skyG, declutter: false });
      const coneLabel = ctx.label(["Zodiacal light", "sunlight on dust: white, like the Sun's own"], { at: [foot.x - 0.62, foot.y + 0.14, 0], height: 0.026, align: "right", parent: skyG, declutter: false });
      const widest = ctx.label(["widest and brightest near the horizon,", "where the dust is nearer the Sun"], { at: [foot.x - 0.62, foot.y + 0.32, 0], height: 0.022, align: "right", parent: skyG, declutter: false });
      [["West", foot.x], ["South-west", foot.x + 0.75], ["North-west", foot.x - 0.75]].forEach(([w, x]) => ctx.label([w], { at: [x, -0.76, 0.03], height: 0.022, parent: skyG, declutter: false }));
      const readout = ctx.label(["", ""], { at: [-0.45, 0.72, 0], height: 0.03, parent: skyG, declutter: false });
      const tips = ctx.label(["Best: a moonless spring evening, far from city lights", "autumn: before dawn in the east (the 'false dawn')"], { at: [0, -0.86, 0.03], height: 0.022, parent: skyG, declutter: false });

      /* ---- act two: the dust round the real Sun */
      const disc = new THREE.Group();
      ctx.add(disc);
      const ND = 9000;
      const dust = ctx.cloud(ND, { size: 2.2, parent: disc });
      const dr = rng(71);
      const earthR = earth ? earth.getWorldPosition(new THREE.Vector3()).sub(sunW).length() : 306;
      for (let i = 0; i < ND; i += 1) {
        /* Denser toward the Sun (number density ~ 1/r), out to about Mars,
         * thin out of the plane (drawing choice for the shape). */
        const r = earthR * (0.15 + 1.45 * Math.pow(dr(), 1.25));
        const a = dr() * TAU;
        const thick = (dr() - 0.5) * r * 0.12;
        dust.set(i, (Math.cos(a) * r) / U, thick / U, (Math.sin(a) * r) / U);
        dust.alpha[i] = 0.5 * Math.min(1, (earthR * 0.35) / r);
        dust.tint(i, dr() < 0.7 ? "#fff1d6" : "#ffe2b0");
      }
      dust.commit();
      const finder = finderRing("#7fd0ff");
      ctx.add(finder);
      finder.scale.setScalar(0.05);
      const earthTag = ctx.label(["Earth", "after sunset, looking back along the dust toward the Sun"], { height: 0.024, align: "left", declutter: false });
      const sight = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.85, additive: false });
      const gegen = ctx.label(["Gegenschein", "the same dust, opposite the Sun"], { height: 0.022, declutter: false });
      ctx.fade(disc, 0);

      ctx.tell([
        { at: 0, label: "After sunset", text: "A spring evening, facing west. The Sun has gone down, and the twilight slowly fades." },
        { at: 0.18, label: "A cone of light", text: "Once the sky is fully dark, a faint cone rises from the western horizon, leaning along the ecliptic: through Aries, Taurus and the Pleiades, toward Gemini." },
        { at: 0.36, label: "What light", text: "It is not a glow of its own: it is sunlight, white like the Sun's own, scattered by dust. Widest near the horizon, it fades as it climbs, about as bright as the Milky Way." },
        { at: 0.56, label: "Dust between the planets", text: "The planets orbit inside a flattened cloud of dust, thickest near the Sun. After sunset we look along it, toward the hidden Sun." },
        { at: 0.8, label: "Comet crumbs", text: "Much of the dust is shed by comets, and some by colliding asteroids. Opposite the Sun, a fainter glow, the gegenschein, is the same dust lit from behind us." },
      ]);

      const cut = cutter(ctx);
      return {
        duration: 26,
        update(p) {
          const inSky = p < 0.55;
          cut(inSky);
          skyG.visible = p < 0.555;
          if (skyG.visible) {
            const q = span(p, 0, 0.55);
            ctx.fade(dusk, 1 - smooth(q, 0.04, 0.3));
            ctx.fade(afterglow, 0.55 * (1 - smooth(q, 0.05, 0.32)));
            const dark = smooth(q, 0.06, 0.3);
            for (let i = 0; i < stars.count; i += 1) stars.alpha[i] = stars.base[i] * dark;
            stars.commit();
            const z = smooth(q, 0.22, 0.46);
            for (let i = 0; i < N; i += 1) cone.alpha[i] = 0.075 * grains[i] * z;
            cone.commit();
            ctx.fade(ecliptic, smooth(q, 0.34, 0.4));
            ctx.fade(eclLabel, smooth(q, 0.36, 0.42));
            zodiac.forEach((l) => ctx.fade(l, smooth(q, 0.4, 0.46)));
            ctx.fade(coneLabel, smooth(q, 0.3, 0.36));
            ctx.fade(widest, smooth(q, 0.62, 0.68));
            ctx.fade(tips, smooth(q, 0.72, 0.78));
            const mins = Math.round(lerp(15, 135, span(q, 0, 0.5)));
            readout.userData.draw([`${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")} min after sunset`, q < 0.24 ? "twilight" : "the sky fully dark, no Moon"]);
            ctx.fade(skyG, 1 - smooth(p, 0.54, 0.555));
          }
          ctx.fade(disc, smooth(p, 0.56, 0.62));
          if (earth && p > 0.55) {
            const E = earth.getWorldPosition(new THREE.Vector3());
            const eR = toRoot(E);
            finder.position.copy(eR);
            ctx.fade(finder, smooth(p, 0.6, 0.64));
            earthTag.position.copy(eR).add(new THREE.Vector3(0.3, 0.4, 0));
            ctx.fade(earthTag, smooth(p, 0.62, 0.66));
            /* From Earth's evening side, looking along the dust toward the
             * Sun, a little off the Sun's direction. */
            const tangent = new THREE.Vector3(0, 1, 0).cross(eR.clone().normalize()).normalize();
            const target = eR.clone().multiplyScalar(0.25).addScaledVector(tangent, eR.length() * 0.25);
            ctx.setLine(sight, [eR, target]);
            ctx.fade(sight, smooth(p, 0.64, 0.68));
            gegen.position.copy(eR).multiplyScalar(1.45).add(new THREE.Vector3(0, 0.5, 0));
            ctx.fade(gegen, smooth(p, 0.82, 0.86));
          } else {
            ctx.fade(finder, 0);
            ctx.fade(earthTag, 0);
            ctx.fade(sight, 0);
            ctx.fade(gegen, 0);
          }
        },
      };
    },
  }),
];

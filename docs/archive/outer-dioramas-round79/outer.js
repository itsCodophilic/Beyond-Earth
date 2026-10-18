import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";

/**
 * Section 8 of the catalogue: Uranus, Neptune and beyond (round 79).
 *
 * Ten dioramas in front of the lens (body: null): the tipped ice giant and
 * its seasons, Neptune's storms, winds and interior, Triton's doomed orbit,
 * the Pluto–Charon pair, Arrokoth's gentle merger and the star that will
 * brush the Oort Cloud.
 *
 * Sizes and orbits are NASA's planetary fact sheets
 * (nssdc.gsfc.nasa.gov/planetary/factsheet) unless a comment says otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

/* Mean radii, km (NASA fact sheets; Pluto and Charon from New Horizons,
 * Nimmo et al. 2017). */
const R_URANUS = 25362;
const R_NEPTUNE = 24622;
const R_EARTH = 6371;
const R_PLUTO = 1188.3;
const R_CHARON = 606;
const R_TRITON = 1353.4;

/** Points of an arc in the xy plane, angle measured from +y toward +x. */
function arcFromUp(radius, a0, a1, n = 48) {
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const a = lerp(a0, a1, i / n);
    points.push(new THREE.Vector3(Math.sin(a) * radius, Math.cos(a) * radius, 0));
  }
  return points;
}

/*
 * A painted Neptune map: the kit has no Neptune texture (the scene draws it
 * with a shader), so this paints soft blue bands and white methane-ice
 * streaks on a canvas, optionally with a dark spot. `spot` is
 * { lat, u, rx, ry } in degrees / canvas fraction. A drawing, not a map.
 */
function neptuneMap({ spot = null, size = 1024, seed = 17 } = {}) {
  const W = size;
  const H = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const r = rng(seed);
  for (let y = 0; y < H; y += 1) {
    const lat = 90 - (y / H) * 180;
    const band = 0.5 + 0.5 * Math.sin(lat * 0.19 + 1.3) * Math.cos(lat * 0.061);
    const polar = THREE.MathUtils.smoothstep(Math.abs(lat), 50, 88);
    g.fillStyle = `hsl(${224 - polar * 8}, ${58 + band * 10}%, ${41 + band * 7 - polar * 7}%)`;
    g.fillRect(0, y, W, 1);
  }
  for (let i = 0; i < 34; i += 1) {
    const lat = (r() < 0.5 ? -1 : 1) * (12 + r() * 50);
    const y = ((90 - lat) / 180) * H;
    g.fillStyle = `rgba(225, 238, 255, ${0.07 + r() * 0.2})`;
    g.beginPath();
    g.ellipse(r() * W, y, (0.02 + r() * 0.07) * W, (0.003 + r() * 0.004) * H, 0, 0, TAU);
    g.fill();
  }
  if (spot) {
    const cx = spot.u * W;
    const cy = ((90 - spot.lat) / 180) * H;
    const rx = (spot.rx / 360) * W;
    const ry = (spot.ry / 180) * H;
    g.save();
    g.translate(cx, cy);
    g.scale(rx, ry);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, "rgba(10, 18, 62, 0.97)");
    grad.addColorStop(0.7, "rgba(18, 30, 88, 0.85)");
    grad.addColorStop(1, "rgba(30, 50, 120, 0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 1, 0, TAU);
    g.fill();
    g.restore();
    /* The bright companion clouds that rode the Great Dark Spot's edge. */
    g.fillStyle = "rgba(240, 248, 255, 0.85)";
    g.beginPath();
    g.ellipse(cx + rx * 0.35, cy + ry * 1.05, rx * 0.55, ry * 0.18, -0.08, 0, TAU);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export const OUTER_EVENTS = [
  /* ------------------------------------------------------------------ 78 */
  event({
    id: "uranus-tipped",
    section: "outer",
    title: "Uranus knocked on its side",
    place: "Uranus",
    kind: "ongoing",
    family: "planetary",
    often: "always — since the early Solar System",
    detail: "Uranus's axis is tipped over by 97.8°, so it rolls around the Sun on its side — most likely knocked over by a giant impact long ago",
    frequency: "The tilt is permanent: it has lasted since the Solar System was young and barely changes. Through every 84-year orbit, Uranus keeps rolling round the Sun the same way.",
    cause: "Uranus's spin axis is tipped 97.8° from upright, so it lies almost flat in the plane of its orbit. The leading explanation is a giant collision while the planet was young: simulations with a body one to three times Earth's mass (Kegerreis et al. 2018) can knock it over and leave a disc of debris around the new equator. Other ideas — several smaller hits, or a slow tilting by a lost moon — are still being studied.",
    note: "Its rings and its five large moons all circle the tipped equator, which is why the impact is thought to have happened early, before they formed. A tilt over 90° also means Uranus technically spins backwards, like Venus.",
    accuracy: "A diagram. Uranus and its rings are drawn to scale with each other and the tilt is the real 97.8°. The impactor is drawn at the size of a body twice Earth's mass; the impact and tipping are shown in seconds, and the inset orbit is not to scale.",
    art: { main: "uranus", fx: "impact" },
    scene(ctx) {
      /* Sun to the left, so the lit side faces it. */
      ctx.light.set(-1, 0.15, 0.45).normalize();
      /* Obliquity 97.77° (NASA Uranus fact sheet). */
      const TILT = 97.77;
      /* layout */
      const R = 0.3;
      const holder = new THREE.Group();
      holder.position.set(0.22, -0.04, 0);
      holder.rotation.set(0.22, 0.6, 0);
      ctx.add(holder);
      const tilt = new THREE.Group();
      holder.add(tilt);
      const uranus = ctx.ball(R, { body: "Uranus", rim: 0.4, rimColour: "#c8f6ff", parent: tilt });
      /* Rings 41,837 km (ring 6) to 51,149 km (ε) from the centre (NASA
       * Uranian rings fact sheet): 1.65–2.02 radii. ε is the brightest. */
      const rings = new THREE.Group();
      tilt.add(rings);
      [[1.65, 0.006, 0.35], [1.72, 0.006, 0.35], [1.8, 0.008, 0.4], [2.02, 0.03, 0.75]].forEach(([k, w, o]) => {
        ctx.ring(R * k, R * (k + w), { colour: "#c4d8e0", opacity: o, parent: rings });
      });
      const axis = ctx.line([[0, -R * 1.6, 0], [0, R * 1.6, 0]], { colour: "#ffd27f", opacity: 0.95, additive: false, parent: tilt });
      void axis;
      /* A spin arrow round the north end of the axis. */
      const spinArc = ctx.circle(R * 0.38, { plane: "xz", from: 0.4, to: TAU - 0.5, colour: "#ffd27f", opacity: 0.85, parent: tilt });
      spinArc.position.y = R * 1.3;
      const endA = TAU - 0.5;
      const tip = new THREE.Vector3(Math.cos(endA) * R * 0.38, R * 1.3, Math.sin(endA) * R * 0.38);
      const tangent = new THREE.Vector3(-Math.sin(endA), 0, Math.cos(endA));
      ctx.arrow(tip.clone().addScaledVector(tangent, -0.02), tip.clone().addScaledVector(tangent, 0.03), { head: 0.045, parent: tilt });
      const axisLabel = ctx.label(["Spin axis"], { at: [0, R * 1.85, 0], height: 0.024, parent: tilt, colour: "#ffe2a8" });
      /* The upright, for reference, and the plane of the orbit. */
      ctx.line([[0, -R * 1.75, 0], [0, R * 1.75, 0]], { colour: "#9fb3c8", opacity: 0.55, dashed: true, dash: 0.025, gap: 0.02, parent: holder });
      ctx.line([[-R * 2.3, 0, 0], [R * 2.3, 0, 0]], { colour: "#9fb3c8", opacity: 0.35, dashed: true, dash: 0.025, gap: 0.02, parent: holder });
      const angleArc = ctx.line(arcFromUp(R * 1.2, 0, TILT * DEG), { colour: "#ffd27f", opacity: 0.8, parent: holder });
      const angleLabel = ctx.label(["97.8°"], { height: 0.034, colour: "#ffe2a8", parent: holder });
      const status = ctx.label(["", ""], { at: [0.05, -0.76, 0], height: 0.03 });

      /* Inset: the orbit from above, the axis fixed in space. */
      const inset = new THREE.Group();
      inset.position.set(-0.72, 0.5, 0);
      ctx.add(inset);
      const insetOrbit = new THREE.Group();
      insetOrbit.rotation.x = 0.55;
      inset.add(insetOrbit);
      ctx.sun(0.032, { halo: 4, parent: insetOrbit });
      ctx.circle(0.27, { plane: "xz", colour: "#9fd6dc", opacity: 0.5, parent: insetOrbit });
      const mini = new THREE.Group();
      insetOrbit.add(mini);
      ctx.ball(0.024, { body: "Uranus", parent: mini });
      const axisDir = new THREE.Vector3(Math.sin(TILT * DEG), Math.cos(TILT * DEG), 0);
      ctx.line([axisDir.clone().multiplyScalar(-0.055), axisDir.clone().multiplyScalar(0.055)], { colour: "#ffd27f", opacity: 0.95, additive: false, parent: mini });
      const insetLabel = ctx.label(["Its 84-year orbit, from above", "the axis keeps pointing one way"], { at: [0, -0.22, 0], height: 0.022, parent: inset });

      /* The impactor: ~2 Earth masses of rock and ice, radius ~1.25 Earth's
       * (Kegerreis et al. 2018 use 1–3 Earth masses), ~0.31 Uranus radii. */
      const impactor = ctx.ball(R * 0.31, { colour: "#8d8478", parent: holder });
      const hitDir = new THREE.Vector3(-0.72, 0.62, 0.3).normalize();
      const contact = hitDir.clone().multiplyScalar(R);
      const impStart = new THREE.Vector3(-2.6, 1.9, 0.6);
      const impEnd = hitDir.clone().multiplyScalar(R + R * 0.31 * 0.7);
      const flash = ctx.glow("#fff1d0", 0.1, { opacity: 1, parent: holder });
      flash.position.copy(contact);
      const debrisN = 260;
      const debris = ctx.cloud(debrisN, { parent: holder, size: 2.4 });
      const dr = rng(31);
      const debrisV = Array.from({ length: debrisN }, () => {
        const v = new THREE.Vector3(dr() - 0.5, dr() - 0.5, dr() - 0.5).normalize().multiplyScalar(0.6).add(hitDir).normalize();
        return v.multiplyScalar(0.15 + dr() * 0.55);
      });
      debrisV.forEach((_, i) => debris.tint(i, i % 3 ? "#ffd2a0" : "#cfe6ee"));

      ctx.tell([
        { at: 0, label: "On its side", text: "Uranus's spin axis is tipped 97.8° from upright: it lies almost flat in the plane of its orbit." },
        { at: 0.2, label: "Rolling round", text: "The axis keeps pointing the same way in space, so over each 84-year orbit Uranus rolls around the Sun like a ball." },
        { at: 0.5, label: "Long ago", text: "The leading idea: the young Uranus spun upright, like the other giants — until something hit it." },
        { at: 0.66, label: "Knocked over", text: "A world perhaps twice Earth's mass strikes off-centre and tips it over. The debris settles round the new equator, where the rings and moons orbit today." },
      ]);
      const tmp = new THREE.Vector3();
      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          /* Tilt: today, rewound to upright, then knocked over. */
          let theta = TILT;
          if (p >= 0.5 && p < 0.68) theta = lerp(TILT, 0, easeInOut(span(p, 0.5, 0.57)));
          else if (p >= 0.68) theta = lerp(0, TILT, 1 - Math.pow(1 - span(p, 0.68, 0.8), 3));
          tilt.rotation.z = -theta * DEG;
          uranus.rotation.y = ctx.t * 0.8;
          ctx.setLine(angleArc, arcFromUp(R * 1.2, 0, Math.max(0.01, theta) * DEG));
          tmp.set(Math.sin(theta * DEG * 0.5) * R * 1.55, Math.cos(theta * DEG * 0.5) * R * 1.55, 0);
          angleLabel.position.copy(tmp);
          angleLabel.userData.draw([`${theta.toFixed(1)}°`]);
          ctx.fade(angleLabel, theta > 8 ? 1 : 0);
          ctx.fade(angleArc, theta > 2 ? 1 : 0);
          ctx.fade(axisLabel, smooth(p, 0.02, 0.08));
          /* Rings: gone while rewound, back from the debris. */
          ctx.fade(rings, 1 - smooth(p, 0.5, 0.55) + smooth(p, 0.84, 0.95));

          /* Inset orbit. */
          const insetA = win(p, 0.18, 0.5);
          ctx.fade(inset, insetA);
          const phi = TAU * span(p, 0.18, 0.5) + 0.3;
          mini.position.set(Math.cos(phi) * 0.27, 0, -Math.sin(phi) * 0.27);
          ctx.fade(insetLabel, insetA);

          /* The impact. */
          const fly = span(p, 0.57, 0.68);
          impactor.position.lerpVectors(impStart, impEnd, fly * fly);
          ctx.fade(impactor, p > 0.56 && p < 0.685 ? 1 : 0);
          const bang = span(p, 0.68, 0.76);
          flash.scale.setScalar(0.1 + 1.1 * Math.sqrt(bang));
          ctx.fade(flash, p >= 0.68 ? (1 - bang) : 0);
          const tau = span(p, 0.68, 0.9);
          for (let i = 0; i < debrisN; i += 1) {
            const v = debrisV[i];
            debris.set(i, contact.x + v.x * tau, contact.y + v.y * tau, contact.z + v.z * tau);
            debris.alpha[i] = p >= 0.68 ? 0.85 * (1 - tau) : 0;
          }
          debris.commit();

          status.userData.draw(p < 0.5 ? ["Today", "tilted 97.8° — on its side"]
            : p < 0.68 ? ["Long ago", "a young, upright Uranus"]
              : p < 0.84 ? ["Impact", "the planet tips over"]
                : ["Knocked over", "rings and moons form round the new equator"]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 79 */
  event({
    id: "uranus-seasons",
    section: "outer",
    title: "42 years of daylight",
    place: "Uranus",
    kind: "recurring",
    family: "planetary",
    often: "every 84 years",
    timeline: { last: "Equinox, December 2007", next: "Northern summer solstice, about 2028" },
    detail: "Lying on its side, Uranus points each pole at the Sun for decades: about 42 years of daylight, then 42 years of night",
    frequency: "One cycle per 84-year orbit. The south pole faced the Sun around 1986, the Sun crossed the equator in December 2007, and the north pole faces it around 2028.",
    cause: "Uranus's axis is tipped 97.8°, almost into the plane of its orbit, and it keeps pointing the same way in space. So for part of the orbit one pole points nearly at the Sun, and half an orbit later the other does. Near the poles, the Sun stays up — or stays down — for decades.",
    note: "Voyager 2 flew past in January 1986, when the south pole faced the Sun almost head-on. Around the 2007 equinox, telescopes saw the long-dark northern hemisphere wake up with bright new storms.",
    accuracy: "A diagram. Uranus is enlarged many times and its orbit is drawn as a circle (eccentricity 0.046); the dates of the solstices and equinoxes are rounded to the year.",
    art: { main: "uranus", second: "sun", fx: "orbit" },
    scene(ctx) {
      /* Obliquity 97.77°, sidereal orbit 84.02 years (NASA). Equinox
       * 7 Dec 2007 (Sromovsky et al. 2009); solstices about a quarter-orbit
       * either side (~1986, ~2028). */
      const TILT = 97.77 * DEG;
      const PERIOD = 84.02;
      const EQUINOX = 2007.93;
      /* layout */
      const RO = 0.78;
      const U = 0.085;
      const sys = new THREE.Group();
      sys.position.set(0, 0, 0);
      sys.rotation.x = 0.5;
      ctx.add(sys);
      ctx.sun(0.075, { halo: 3.4, parent: sys });
      ctx.circle(RO, { plane: "xz", colour: "#9fd6dc", opacity: 0.4, parent: sys });
      const planet = new THREE.Group();
      sys.add(planet);
      const axisGroup = new THREE.Group();
      axisGroup.rotation.z = -TILT;
      planet.add(axisGroup);
      const uranus = ctx.ball(U, { body: "Uranus", rim: 0.3, parent: axisGroup });
      ctx.line([[0, -U * 1.75, 0], [0, U * 1.75, 0]], { colour: "#ffd27f", opacity: 0.9, additive: false, parent: axisGroup });
      const pole = ctx.ball(U * 0.16, { colour: "#ff8a6b", emissive: "#3a0e05", parent: axisGroup });
      pole.position.y = U * 0.97;
      ctx.ring(U * 1.95, U * 2.05, { colour: "#cfe3ea", opacity: 0.55, parent: axisGroup });
      const poleLabel = ctx.label(["N"], { height: 0.022, colour: "#ffb8a0" });

      const at = (phi, k = 1, lift = 0) => new THREE.Vector3(Math.cos(phi) * RO * k, lift, -Math.sin(phi) * RO * k);
      const marks = [
        ctx.label(["~1986", "south pole to the Sun"], { at: at(0, 1, 0.16), height: 0.022, parent: sys }),
        ctx.label(["2007", "equinox"], { at: at(Math.PI / 2, 1.0, 0.2), height: 0.022, parent: sys }),
        ctx.label(["~2028", "north pole to the Sun"], { at: at(Math.PI, 1, 0.16), height: 0.022, parent: sys }),
        ctx.label(["~2049", "equinox"], { at: at(Math.PI * 1.5, 1.0, -0.24), height: 0.022, parent: sys }),
      ];
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((phi) => {
        const dot = ctx.glow("#bfe9ff", 0.05, { opacity: 0.8, parent: sys });
        dot.position.copy(at(phi));
      });
      const year = ctx.label([""], { at: [0, 0.74, 0], height: 0.045 });
      const status = ctx.label(["", ""], { at: [0, -0.74, 0], height: 0.03 });

      ctx.tell([
        { at: 0, label: "On its side", text: "Uranus, tipped 97.8°, on its 84-year orbit. Its axis keeps pointing the same way in space." },
        { at: 0.08, label: "Southern summer", text: "Around 1986 the south pole points almost straight at the Sun — as Voyager 2 saw it. The north is in a night that lasts decades." },
        { at: 0.3, label: "Equinox, 2007", text: "The Sun crosses the equator: for a few years, all of Uranus gets day and night." },
        { at: 0.52, label: "Northern summer", text: "Around 2028 the north pole faces the Sun, and the south has its long night." },
        { at: 0.8, label: "42 and 42", text: "Each pole gets about 42 years of sunlight, then about 42 years of darkness." },
      ]);
      const pos = new THREE.Vector3();
      const sunDir = new THREE.Vector3();
      const north = new THREE.Vector3(Math.sin(TILT), Math.cos(TILT), 0);
      const poleWorld = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          const y = 1986.9 + PERIOD * span(p, 0.05, 0.95);
          const phi = Math.PI / 2 + (TAU * (y - EQUINOX)) / PERIOD;
          pos.copy(at(phi));
          planet.position.copy(pos);
          uranus.rotation.y = ctx.t * 1.4;
          /* Light from the Sun, in hud (view) space. */
          sunDir.copy(pos).negate().normalize();
          const lit = north.dot(sunDir);
          sunDir.applyQuaternion(sys.quaternion);
          ctx.light.set(sunDir.x, sunDir.y, sunDir.z + 0.15).normalize();
          /* The north-pole tag follows the marker. */
          pole.getWorldPosition(poleWorld);
          poleLabel.position.copy(ctx.root.worldToLocal(poleWorld)).add(new THREE.Vector3(0, 0.05, 0.05));
          year.userData.draw([`${Math.floor(y)}`]);
          status.userData.draw(Math.abs(lit) < 0.2 ? ["Near equinox", "day and night over the whole planet"]
            : lit > 0 ? ["North pole: daylight", "the south pole is in a 42-year night"]
              : ["South pole: daylight", "the north pole is in a 42-year night"]);
          marks.forEach((m, i) => {
            const near = 1 - smooth(Math.abs(Math.atan2(Math.sin(phi - (i * Math.PI) / 2), Math.cos(phi - (i * Math.PI) / 2))), 0.25, 0.9);
            ctx.fade(m, 0.45 + 0.55 * near);
          });
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 80 */
  event({
    id: "neptune-dark-spot",
    section: "outer",
    title: "Neptune's Great Dark Spot",
    place: "Neptune",
    kind: "recorded",
    family: "planetary",
    when: "August 1989; gone by 1994",
    often: "seen 1989, gone by 1994",
    timeline: { last: "A new dark spot found by Hubble, 2018", next: "Expected any time — they come and go" },
    detail: "An Earth-sized storm found by Voyager 2 in 1989 had vanished when Hubble looked in 1994",
    frequency: "Dark spots form and fade within a few years. Since 1994 Hubble has seen several more come and go, including spots found in 2015 and 2018.",
    cause: "Like Jupiter's Great Red Spot, a dark spot is a high-pressure storm spinning between bands of wind. It looks dark because the storm changes the layers of haze inside it; bright white clouds of methane ice form along its edge, like clouds over a mountain. Neptune's spots drift and break up within a few years.",
    note: "Voyager 2 is still the only spacecraft to have visited Neptune, in August 1989. When Hubble looked in November 1994, the Great Dark Spot was gone — and a new one had formed in the north.",
    accuracy: "Neptune, the storm and Earth are drawn to one scale. Neptune's colours and bands are painted (there is no Neptune map here), and the planet's turning is slowed right down.",
    art: { main: "neptune", fx: "spot" },
    scene(ctx) {
      ctx.light.set(-0.55, 0.35, 0.78).normalize();
      /* GDS about 13,000 × 6,600 km at ~20°S (Smith et al. 1989, Voyager
       * 2): 32° of longitude at that latitude, 15° of latitude. The 1994
       * northern spot at ~30°N (Hammel et al. 1995); its size here is a
       * guess, drawn a little smaller. */
      const GDS = { lat: -20, u: 0.25, rx: 16, ry: 7.7 };
      const NORTH = { lat: 30, u: 0.29, rx: 12, ry: 5.5 };
      const maps = [neptuneMap(), neptuneMap({ spot: GDS }), neptuneMap({ spot: NORTH })];
      /* layout */
      const R = 0.52;
      const centre = new THREE.Vector3(-0.32, 0.0, 0);
      const plain = ctx.ball(R, { map: maps[0], rim: 0.45, rimColour: "#8fb4ff" });
      const spotted = ctx.ball(R * 1.003, { map: maps[1], rim: 0.45, rimColour: "#8fb4ff" });
      const north = ctx.ball(R * 1.0015, { map: maps[2], rim: 0.45, rimColour: "#8fb4ff" });
      [plain, spotted, north].forEach((b) => b.position.copy(centre));
      /* Earth to the same scale: 6,371 / 24,622 km. */
      const earth = ctx.ball(R * (R_EARTH / R_NEPTUNE), { body: "Earth", rim: 0.5, rimColour: "#7fb8ff" });
      earth.position.set(0.66, -0.1, 0);
      const earthLabel = ctx.label(["Earth", "same scale"], { at: [0.66, -0.34, 0], height: 0.026 });
      const spotLabel = ctx.label(["Great Dark Spot", "about 13,000 × 6,600 km"], { at: [0.55, 0.42, 0], height: 0.028 });
      const pointer = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#bfd4ff", opacity: 0.7 });
      const northLabel = ctx.label(["A new dark spot", "in the north, 1994"], { at: [0.5, 0.55, 0], height: 0.026 });
      const northPointer = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#bfd4ff", opacity: 0.7 });
      const year = ctx.label(["", ""], { at: [-0.32, 0.72, 0], height: 0.036 });

      ctx.tell([
        { at: 0, label: "August 1989", text: "Voyager 2 flies past Neptune and finds a dark storm in the south: the Great Dark Spot." },
        { at: 0.26, label: "As big as Earth", text: "About 13,000 km long and 6,600 km wide. Earth, drawn to the same scale, is about as wide." },
        { at: 0.5, label: "1994", text: "Hubble looks again. The Great Dark Spot is gone." },
        { at: 0.74, label: "Come and go", text: "Instead a new dark spot has formed in the north. Hubble has watched several more form and fade since." },
      ]);
      const spotPoint = (s, rot) => {
        const v = new THREE.Vector3(0, Math.sin(s.lat * DEG), Math.cos(s.lat * DEG)).multiplyScalar(R);
        /* Longitude offset from the facing meridian (u = 0.25). */
        v.applyAxisAngle(new THREE.Vector3(0, 1, 0), (s.u - 0.25) * TAU + rot);
        return v.add(centre);
      };
      return {
        duration: 20,
        update(p) {
          const rot = lerp(-0.5, 0.3, p);
          [plain, spotted, north].forEach((b) => { b.rotation.y = rot; });
          const gone = smooth(p, 0.54, 0.68);
          ctx.fade(spotted, 1 - gone);
          ctx.fade(north, smooth(p, 0.76, 0.88));
          ctx.fade(earth, smooth(p, 0.26, 0.34));
          ctx.fade(earthLabel, smooth(p, 0.28, 0.36));
          const sp = spotPoint(GDS, rot);
          ctx.setLine(pointer, [[0.45, 0.36, 0], sp]);
          const spotA = smooth(p, 0.04, 0.1) * (1 - smooth(p, 0.52, 0.6));
          ctx.fade(spotLabel, spotA);
          ctx.fade(pointer, spotA);
          const np = spotPoint(NORTH, rot);
          ctx.setLine(northPointer, [[0.36, 0.5, 0], np]);
          const nA = smooth(p, 0.8, 0.88);
          ctx.fade(northLabel, nA);
          ctx.fade(northPointer, nA);
          const y = Math.round(lerp(1989, 1994, smooth(p, 0.5, 0.62)));
          year.userData.draw([`${y}`, y < 1994 ? "Voyager 2" : "Hubble Space Telescope"]);
        },
        dispose() { maps.forEach((m) => m.dispose()); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 81 */
  event({
    id: "neptune-winds",
    section: "outer",
    title: "The fastest winds in the Solar System",
    place: "Neptune",
    kind: "ongoing",
    family: "planetary",
    often: "always",
    detail: "Neptune's winds reach about 2,000 km/h — faster than sound on Earth — on the planet that gets the least sunlight",
    frequency: "All the time. Voyager 2 measured them in 1989 by tracking clouds, and Hubble and big telescopes on the ground still follow them.",
    cause: "At the equator the winds blow westward, against the planet's spin; nearer the poles they blow east. Neptune gets only about 1/900 of the sunlight Earth does, but it gives off about 2.6 times as much energy as it absorbs, from heat left over from its formation. With no solid surface to cause friction, winds can build up, but just how they reach such speeds is still debated.",
    note: "Sound in Earth's air travels at about 1,235 km/h. The strongest gust ever measured on Earth, 408 km/h on Barrow Island in 1996, is about a fifth of Neptune's winds.",
    accuracy: "Neptune is painted (no map) and its clouds are drawn as streaks whose relative speeds follow Voyager 2's measured wind profile; the motion is slowed enormously. The bars are to scale with each other.",
    art: { main: "neptune", fx: "storm" },
    scene(ctx) {
      ctx.light.set(-0.45, 0.35, 0.82).normalize();
      /* layout */
      const R = 0.4;
      const centre = new THREE.Vector3(-0.6, 0.12, 0);
      const map = neptuneMap({ seed: 23 });
      const neptune = ctx.ball(R, { map, rim: 0.45, rimColour: "#8fb4ff" });
      neptune.position.copy(centre);
      /* Wind profile, m/s, eastward positive, latitude in degrees: the
       * Voyager fit u = -398 + 0.188 φ² - 1.2e-5 φ⁴ (Sromovsky et al. 1993). */
      const wind = (lat) => -398 + 0.188 * lat * lat - 1.2e-5 * lat ** 4;
      const r = rng(41);
      const lats = [-68, -58, -46, -34, -22, -10, 2, 14, 26, 38, 50, 62, 72];
      const TRAIL = 6;
      const clouds = [];
      lats.forEach((lat) => {
        for (let i = 0; i < 9; i += 1) clouds.push({ lat: lat + (r() - 0.5) * 6, lon: r() * TAU, len: 0.04 + r() * 0.08, a: 0.4 + r() * 0.5 });
      });
      const streaks = ctx.cloud(clouds.length * TRAIL, { size: 2.6 });
      for (let i = 0; i < clouds.length * TRAIL; i += 1) streaks.tint(i, "#eef6ff");
      /* Direction arrows: west at the equator, east near the poles. */
      const eq = ctx.arrow([centre.x + 0.2, centre.y, R + 0.03], [centre.x - 0.2, centre.y, R + 0.03], { colour: "#ffd27f", head: 0.05 });
      const yN = R * Math.sin(62 * DEG);
      const zN = R * Math.cos(62 * DEG) + 0.03;
      const nArrow = ctx.arrow([centre.x - 0.1, centre.y + yN, zN], [centre.x + 0.1, centre.y + yN, zN], { colour: "#9fe0ff", head: 0.045 });
      const sArrow = ctx.arrow([centre.x - 0.1, centre.y - yN, zN], [centre.x + 0.1, centre.y - yN, zN], { colour: "#9fe0ff", head: 0.045 });

      /* Bars, km/h: Neptune ~2,000 (NASA); sound in air at 20 °C 1,235
       * (343 m/s); Earth's record gust 408 (WMO, Barrow Island 1996). */
      const K = 0.47 / 1000;
      const X0 = 0.04;
      const bar = (kmh, y, colour, lines) => {
        const h = 0.022;
        const mesh = ctx.shape([[0, -h], [1, -h], [1, h], [0, h]], { colour, opacity: 0.9 });
        mesh.position.set(X0, y, 0);
        const label = ctx.label(lines, { at: [X0, y + 0.085, 0], align: "left", height: 0.024 });
        return { mesh, label, kmh };
      };
      const bars = [
        bar(2000, 0.42, "#6f9bff", ["Neptune's winds", "about 2,000 km/h"]),
        bar(1235, 0.16, "#c9d3e0", ["Speed of sound in air", "1,235 km/h"]),
        bar(408, -0.1, "#ffd27f", ["Earth's strongest gust", "408 km/h"]),
      ];
      const sunLabel = ctx.label(["Sunlight here: about 1/900", "of what Earth gets"], { at: [0.5, -0.42, 0], height: 0.026, colour: "#ffe2a8" });
      const heatLabel = ctx.label(["Yet it gives off 2.6× the energy", "it absorbs from the Sun"], { at: [0.5, -0.66, 0], height: 0.026, colour: "#ffc0a0" });
      const sunGlow = ctx.glow("#ffd27f", 0.12, { opacity: 0.5 });
      sunGlow.position.set(0.04, -0.42, 0);

      ctx.tell([
        { at: 0, label: "Neptune", text: "The farthest planet, and the windiest. Clouds race around it — west at the equator, east near the poles." },
        { at: 0.18, label: "2,000 km/h", text: "Its winds reach about 2,000 km/h: faster than sound in Earth's air, five times Earth's strongest gust." },
        { at: 0.5, label: "Little sunlight", text: "At 30 times Earth's distance from the Sun, Neptune gets only about 1/900 as much sunlight." },
        { at: 0.72, label: "A puzzle", text: "It radiates 2.6 times the energy it absorbs, heat left over from its birth. How that drives such winds is still debated." },
      ]);
      const v = new THREE.Vector3();
      return {
        duration: 16 /* round 79: fitted to her shorter line */,
        update(p) {
          neptune.rotation.y = 0.3 * p;
          /* Clouds: angular speed ∝ wind / cos(latitude). */
          clouds.forEach((c, i) => {
            const w = wind(c.lat) / Math.max(0.25, Math.cos(c.lat * DEG));
            const drift = (w / 400) * 2.4 * p;
            for (let k = 0; k < TRAIL; k += 1) {
              const lon = c.lon + drift - Math.sign(w) * (k / TRAIL) * c.len * 2.2;
              v.set(Math.cos(c.lat * DEG) * Math.sin(lon), Math.sin(c.lat * DEG), Math.cos(c.lat * DEG) * Math.cos(lon)).multiplyScalar(R * 1.012).add(centre);
              const j = i * TRAIL + k;
              streaks.set(j, v.x, v.y, v.z);
              streaks.alpha[j] = c.a * (1 - k / TRAIL) * smooth(p, 0, 0.05);
            }
          });
          streaks.commit();
          const arrowsA = smooth(p, 0.06, 0.14);
          [eq, nArrow, sArrow].forEach((a) => ctx.fade(a, arrowsA));
          bars.forEach((b, i) => {
            const grow = easeInOut(span(p, 0.18 + i * 0.06, 0.32 + i * 0.06));
            b.mesh.scale.x = Math.max(0.0001, b.kmh * K * grow);
            ctx.fade(b.mesh, grow > 0.001 ? 1 : 0);
            ctx.fade(b.label, smooth(grow, 0.3, 0.9));
          });
          ctx.fade(sunLabel, smooth(p, 0.5, 0.56));
          ctx.fade(sunGlow, smooth(p, 0.5, 0.56) * (0.25 + 0.1 * Math.sin(ctx.t * 2)));
          ctx.fade(heatLabel, smooth(p, 0.72, 0.78));
        },
        dispose() { map.dispose(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 82 */
  event({
    id: "diamond-rain",
    section: "outer",
    title: "Diamond rain",
    place: "Inside Uranus and Neptune",
    kind: "ongoing",
    family: "planetary",
    often: "theory — thought to be ongoing",
    detail: "Deep inside the ice giants, carbon from methane may be squeezed into diamonds that sink toward the core like hail",
    frequency: "If the theory is right, all the time, deep inside both Uranus and Neptune. Nobody can see it directly: it is inferred from models and laboratory experiments.",
    cause: "Below their thin hydrogen-and-helium skins, Uranus and Neptune are mostly a hot, dense fluid of water, ammonia and methane. Thousands of kilometres down, the pressure passes a million times Earth's air pressure. There, methane can break apart: the hydrogen is freed and the carbon bonds into diamond, which is denser than the fluid and sinks.",
    note: "In 2017, Kraus and colleagues shocked a plastic (polystyrene, carbon and hydrogen) with powerful lasers to about 150 GPa and about 5,000 K — conditions thought to exist roughly 10,000 km inside these planets — and saw nanometre-sized diamonds form in a split second.",
    accuracy: "A cut-away diagram. The layers are a typical model of an ice giant (their exact sizes are uncertain); molecules and diamonds are drawn hugely enlarged.",
    art: { main: "neptune", fx: "rain" },
    scene(ctx) {
      ctx.light.set(-0.5, 0.45, 0.75).normalize();
      /* layout */
      const R = 0.72;
      const C = new THREE.Vector3(-0.36, -0.02, 0);
      const map = neptuneMap({ seed: 29 });
      const ball = ctx.ball(R, { map, rim: 0.4, rimColour: "#8fb4ff" });
      ball.position.copy(C);
      /* Layers as a fraction of the radius (typical models; NASA: the
       * atmosphere is the outer 10–20%; the core about Earth-sized). */
      const section = new THREE.Group();
      section.position.copy(C);
      ctx.add(section);
      ctx.disc(R, { colour: "#4d78d8", opacity: 0.95, parent: section }).position.z = -0.03;
      ctx.disc(R * 0.85, { colour: "#1d3a8a", opacity: 1, parent: section }).position.z = -0.02;
      ctx.disc(R * 0.26, { colour: "#7c6a55", opacity: 1, parent: section }).position.z = -0.01;
      /* ~10,000 km below the cloud tops: r ≈ 1 − 10,000/24,622 ≈ 0.6 R. */
      const depthRing = ctx.circle(R * 0.6, { plane: "xy", colour: "#bfe0ff", opacity: 0.5, dashed: true, dash: 0.02, gap: 0.018, parent: section });
      const labels = [
        ctx.label(["Atmosphere", "hydrogen, helium, methane"], { at: [0, R * 0.92, 0.02], height: 0.022, parent: section }),
        ctx.label(["Hot, dense fluid", "water, ammonia, methane"], { at: [0, R * 0.74, 0.02], height: 0.022, parent: section }),
        ctx.label(["Rocky core"], { at: [0, 0, 0.02], height: 0.022, parent: section }),
      ];
      const depthLabel = ctx.label(["~10,000 km down", "over a million times", "Earth's air pressure"], { at: [0.62, 0.02, 0], height: 0.024, colour: "#d6ecff" });
      const depthPointer = ctx.line([[0.38, 0.02, 0], [C.x + R * 0.6, C.y + 0.0, 0.02]], { colour: "#bfe0ff", opacity: 0.6 });

      /* Methane molecules: one carbon, four hydrogens. */
      const r = rng(53);
      const M = 34;
      const SEEDS = 10;
      const seeds = Array.from({ length: SEEDS }, (_, i) => {
        const a = (i / SEEDS) * TAU + r() * 0.3;
        const d = R * (0.56 + r() * 0.12);
        return new THREE.Vector3(Math.cos(a) * d, Math.sin(a) * d, 0.03);
      });
      const molecules = Array.from({ length: M }, (_, i) => {
        const s = seeds[i % SEEDS];
        const a = r() * TAU;
        const d = 0.04 + r() * 0.07;
        return { home: new THREE.Vector3(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, 0.03), seed: s, spin: r() * TAU, away: new THREE.Vector3(r() - 0.5, r() - 0.5, 0).normalize() };
      });
      const atoms = ctx.cloud(M * 5, { additive: false, parent: section, size: 4 });
      molecules.forEach((_, i) => {
        atoms.tint(i * 5, "#151515");
        atoms.size[i * 5] = 6;
        for (let k = 1; k < 5; k += 1) atoms.tint(i * 5 + k, "#f4f9ff");
      });
      /* Diamonds: octahedra, lit, with a cold sparkle. */
      const diamonds = seeds.map((s, i) => {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), ctx.material({ colour: "#eaf6ff", emissive: "#1d3550", rim: 1.2, rimColour: "#ffffff" }));
        mesh.renderOrder = 23;
        section.add(mesh);
        const glint = ctx.glow("#dff2ff", 0.06, { opacity: 0.8, parent: section });
        /* Where it comes to rest on the core. */
        const rest = s.clone().setZ(0).normalize().multiplyScalar(R * 0.29).setZ(0.03);
        return { mesh, glint, seed: s, rest, delay: (i % 5) * 0.03 + r() * 0.02 };
      });
      /* Inset: a diamond made in the lab. */
      const lab = new THREE.Group();
      lab.position.set(0.72, 0.5, 0);
      ctx.add(lab);
      const bigDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), ctx.material({ colour: "#eaf6ff", emissive: "#1d3550", rim: 1.4, rimColour: "#ffffff" }));
      bigDiamond.renderOrder = 23;
      lab.add(bigDiamond);
      ctx.glow("#cfeaff", 0.35, { opacity: 0.35, parent: lab });
      const labLabel = ctx.label(["Made in the lab, 2017", "lasers shock plastic to ~150 GPa:", "nanodiamonds form"], { at: [0.66, -0.4, 0], height: 0.024, colour: "#e6f4ff" });
      ctx.fade(lab, 0);

      ctx.tell([
        { at: 0, label: "Inside an ice giant", text: "Under a thin skin of hydrogen and helium, Uranus and Neptune are mostly a hot, dense fluid of water, ammonia and methane." },
        { at: 0.2, label: "Crushing pressure", text: "About 10,000 km down, the pressure is over a million times Earth's air pressure, and thousands of degrees hot." },
        { at: 0.34, label: "Diamonds", text: "Methane breaks apart. The hydrogen is freed; the carbon atoms bond into diamond." },
        { at: 0.5, label: "Diamond rain", text: "Denser than the fluid around them, the diamonds sink slowly toward the core, like hail." },
        { at: 0.8, label: "Made on Earth", text: "In 2017, lasers squeezed plastic to the same pressure for a split second — and tiny diamonds formed." },
      ]);
      const tmp = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          ball.rotation.y = 0.2 * p;
          const cut = smooth(p, 0.06, 0.18);
          ctx.fade(ball, 1 - cut);
          ctx.fade(section, cut);
          labels.forEach((l) => ctx.fade(l, cut * (1 - 0.5 * smooth(p, 0.5, 0.56))));
          const deep = smooth(p, 0.2, 0.26);
          ctx.fade(depthLabel, deep * (1 - smooth(p, 0.78, 0.82)));
          ctx.fade(depthPointer, deep * (1 - smooth(p, 0.78, 0.82)));
          ctx.fade(depthRing, cut);

          /* Molecules jiggle, then split: H flies off, C gathers. */
          const split = span(p, 0.34, 0.46);
          const gather = easeInOut(span(p, 0.38, 0.5));
          molecules.forEach((m, i) => {
            const jig = 0.006 * Math.sin(ctx.t * 7 + i);
            tmp.copy(m.home).lerp(m.seed, gather);
            atoms.set(i * 5, tmp.x + jig, tmp.y, 0.03);
            atoms.alpha[i * 5] = smooth(p, 0.22, 0.28) * (1 - smooth(p, 0.47, 0.5));
            for (let k = 1; k < 5; k += 1) {
              const a = m.spin + (k * TAU) / 4 + ctx.t * 0.5;
              const off = 0.016 + split * 0.12;
              const hx = m.home.x + Math.cos(a) * off + m.away.x * split * 0.06;
              const hy = m.home.y + Math.sin(a) * off + m.away.y * split * 0.06;
              atoms.set(i * 5 + k, hx, hy, 0.03);
              atoms.alpha[i * 5 + k] = smooth(p, 0.22, 0.28) * (1 - split);
            }
          });
          atoms.commit();

          diamonds.forEach((d, i) => {
            const born = smooth(p, 0.46, 0.5);
            const fall = easeInOut(span(p, 0.52 + d.delay, 0.78 + d.delay));
            d.mesh.position.lerpVectors(d.seed, d.rest, fall);
            d.mesh.scale.setScalar(Math.max(0.001, born));
            d.mesh.rotation.set(ctx.t * 0.9 + i, ctx.t * 1.3 + i, 0);
            d.mesh.visible = born > 0.01;
            d.glint.position.copy(d.mesh.position);
            ctx.fade(d.glint, born * (0.3 + 0.5 * Math.max(0, Math.sin(ctx.t * 3 + i * 1.7))));
          });

          const labA = smooth(p, 0.8, 0.86);
          ctx.fade(lab, labA);
          ctx.fade(labLabel, labA);
          bigDiamond.rotation.set(0.4, ctx.t * 0.8, 0.2);
        },
        dispose() { map.dispose(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 83 */
  event({
    id: "triton-doom",
    section: "outer",
    title: "Triton's doomed orbit",
    place: "Neptune and Triton",
    kind: "ongoing",
    family: "orbit",
    when: "In about 3.6 billion years",
    often: "once — billions of years from now",
    timeline: { next: "Roche limit in about 3.6 billion years (estimate)" },
    detail: "Neptune's largest moon orbits backwards, is slowly spiralling inward, and will one day be torn apart",
    frequency: "Once. The fall is very slow at first and speeds up as Triton gets closer; the commonly quoted estimate for reaching the breaking point is about 3.6 billion years from now.",
    cause: "Triton orbits against Neptune's spin — the only big moon in the Solar System to do so — so it cannot have formed around Neptune and was probably captured from the Kuiper Belt, perhaps when a pair of bodies was split apart. Because it orbits backwards, the tides it raises on Neptune slow it down, and it sinks inward. Inside the Roche limit, Neptune's tides will pull it apart.",
    note: "Triton is a little larger than Pluto and, like Pluto, a Kuiper Belt world. Its broken pieces may spread into a ring around Neptune — or rain down onto the planet.",
    accuracy: "Neptune, Triton's orbit and the Roche limit are drawn to one scale; Triton itself is enlarged about five times. The orbit is shown tilted to its real 23° from Neptune's equator. The shape of the spiral follows tidal theory; its timing is an estimate (Chyba et al. 1989).",
    art: { main: "neptune", fx: "spiral" },
    scene(ctx) {
      ctx.light.set(-0.6, 0.4, 0.7).normalize();
      /* Triton semi-major axis 354,759 km (14.4 Neptune radii); inclination
       * 157° to Neptune's equator, i.e. retrograde, 23° off (JPL). Roche
       * limit for a fluid Triton: 2.44 R_N (ρ_N/ρ_T)^(1/3), densities 1.64
       * and 2.06 g/cm³ (NASA) → about 2.26 Neptune radii. */
      const A0 = 354759 / R_NEPTUNE;
      const ROCHE = 2.44 * Math.cbrt(1.638 / 2.061);
      /* layout */
      const RN = 0.058;
      const sys = new THREE.Group();
      sys.position.set(0, -0.02, 0);
      sys.rotation.x = 0.5;
      ctx.add(sys);
      const map = neptuneMap({ size: 256, seed: 31 });
      const neptune = ctx.ball(RN, { map, rim: 0.5, rimColour: "#8fb4ff", parent: sys });
      /* Neptune's spin: anticlockwise seen from its north. */
      const spinArc = ctx.circle(RN * 1.9, { plane: "xz", from: 0, to: TAU * 0.8, colour: "#9fe0ff", opacity: 0.85, parent: sys });
      void spinArc;
      const sEnd = TAU * 0.8;
      const sTip = new THREE.Vector3(Math.cos(sEnd) * RN * 1.9, 0, Math.sin(sEnd) * RN * 1.9);
      /* Anticlockwise from above in this frame: angle toward −z. Built so
       * the head points along decreasing z-angle, i.e. the opposite way to
       * Triton's. */
      ctx.arrow(sTip.clone().add(new THREE.Vector3(Math.sin(sEnd), 0, -Math.cos(sEnd)).multiplyScalar(-0.02)),
        sTip.clone().add(new THREE.Vector3(Math.sin(sEnd), 0, -Math.cos(sEnd)).multiplyScalar(0.03)), { colour: "#9fe0ff", head: 0.04, parent: sys });
      const spinLabel = ctx.label(["Neptune's spin"], { at: [0, RN * 4.2, 0], height: 0.022, colour: "#bfefff", parent: sys });
      /* Triton's orbit plane, tilted 23°. */
      const plane = new THREE.Group();
      plane.rotation.z = 23 * DEG;
      sys.add(plane);
      const orbitLine = ctx.circle(A0 * RN, { plane: "xz", colour: "#d8c4bb", opacity: 0.5, parent: plane });
      const roche = ctx.circle(ROCHE * RN, { plane: "xz", colour: "#ff8a6b", opacity: 0.7, dashed: true, dash: 0.02, gap: 0.015, parent: plane });
      const rocheLabel = ctx.label(["Roche limit"], { height: 0.022, colour: "#ffb8a0" });
      /* Triton: radius 1,353 km = 0.055 R_N, drawn ×5. */
      const triton = ctx.ball(RN * (R_TRITON / R_NEPTUNE) * 5, { colour: "#d8c4bb", rim: 0.4, parent: plane });
      const tritonLabel = ctx.label(["Triton"], { height: 0.026 });
      /* Capture: a long, eccentric ghost orbit that circularised. */
      const ghost = ctx.orbit(A0 * RN * 1.0, 0.0, { colour: "#ffd27f", opacity: 0.6, dashed: true, dash: 0.025, gap: 0.02, parent: plane });
      const spiral = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.75, parent: plane });
      const N = 700;
      const ring = ctx.cloud(N, { parent: plane, size: 2.2 });
      const rr = rng(61);
      const ringData = Array.from({ length: N }, () => ({ a: rr(), d: ROCHE * RN * (0.85 + rr() * 0.45), y: (rr() - 0.5) * 0.006 }));
      ringData.forEach((_, i) => ring.tint(i, i % 4 ? "#e2d2c8" : "#ffffff"));
      const clock = ctx.label(["", ""], { at: [0, 0.72, 0], height: 0.036 });
      const capture = ctx.label(["Captured from the Kuiper Belt", "its orbit later made circular by tides"], { at: [-0.45, -0.62, 0], height: 0.024, colour: "#ffe2a8" });

      ctx.tell([
        { at: 0, label: "Backwards", text: "Neptune spins one way; Triton, its largest moon, orbits the other way — the only big moon in the Solar System to do so." },
        { at: 0.22, label: "Captured", text: "So it probably did not form here. It was most likely a Kuiper Belt world, captured long ago." },
        { at: 0.45, label: "Spiralling in", text: "Orbiting against the spin, Triton loses energy to Neptune's tides and sinks inward — slowly at first, then faster." },
        { at: 0.8, label: "Torn apart", text: "In about 3.6 billion years it crosses the Roche limit, and Neptune's tides pull it apart — perhaps into a ring." },
      ]);
      /* a(t)/a0 = (1 − t/T)^(2/13): da/dt ∝ a^(−11/2) for tidal decay. */
      const end = 1 - Math.pow(ROCHE / A0, 6.5);
      const aOf = (u) => A0 * Math.pow(Math.max(1e-9, 1 - u * end), 2 / 13);
      const angleOf = (q) => -q * 9 * TAU;
      const tmp = new THREE.Vector3();
      const world = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          neptune.rotation.y = ctx.t * 0.6;
          const u = span(p, 0.45, 0.82);
          const a = aOf(u);
          /* Capture: an eccentric orbit relaxing to a circle. */
          const capt = span(p, 0.22, 0.42);
          const e = 0.75 * (1 - easeInOut(capt));
          const aG = A0 * (1 + e * 0.6);
          ctx.setLine(ghost, Array.from({ length: 160 }, (_, i) => {
            const nu = (i / 159) * TAU;
            const rg = (aG * RN * (1 - e * e)) / (1 + e * Math.cos(nu));
            return [rg * Math.cos(nu + 2.4), 0, rg * Math.sin(nu + 2.4)];
          }));
          ctx.fade(ghost, win(p, 0.22, 0.46));
          ctx.fade(capture, win(p, 0.24, 0.46));
          /* Triton's position: on the circle, then the spiral. */
          const q = p;
          const ang = angleOf(q);
          tmp.set(Math.cos(ang) * a * RN, 0, Math.sin(ang) * a * RN);
          triton.position.copy(tmp);
          triton.rotation.y = -ang;
          const broken = smooth(p, 0.82, 0.86);
          ctx.fade(triton, 1 - broken);
          triton.getWorldPosition(world);
          tritonLabel.position.copy(ctx.root.worldToLocal(world)).add(new THREE.Vector3(0, 0.07, 0));
          ctx.fade(tritonLabel, 1 - broken);
          ctx.fade(orbitLine, 1 - smooth(p, 0.45, 0.6) * 0.6);
          /* The spiral so far. */
          if (u > 0) {
            const pts = [];
            const steps = 220;
            for (let i = 0; i <= steps; i += 1) {
              const uu = (u * i) / steps;
              const pp = lerp(0.45, 0.82, uu);
              const ai = angleOf(pp);
              const ri = aOf(uu) * RN;
              pts.push([Math.cos(ai) * ri, 0, Math.sin(ai) * ri]);
            }
            ctx.setLine(spiral, pts);
          }
          ctx.fade(spiral, smooth(p, 0.46, 0.5) * (1 - smooth(p, 0.9, 0.97)));
          /* Roche limit. */
          ctx.fade(roche, smooth(p, 0.5, 0.58));
          tmp.set(-ROCHE * RN, 0, 0);
          rocheLabel.position.copy(tmp.applyMatrix4(plane.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(ctx.root.matrixWorld).invert())).add(new THREE.Vector3(-0.08, -0.06, 0));
          ctx.fade(rocheLabel, smooth(p, 0.5, 0.58));
          /* The breakup into a ring. */
          const spread = easeInOut(span(p, 0.82, 0.98));
          const startA = angleOf(0.82);
          for (let i = 0; i < N; i += 1) {
            const d = ringData[i];
            const ai = startA - d.a * TAU * spread * 0.98 - ctx.t * 0.15;
            const rd = lerp(ROCHE * RN, d.d, spread);
            ring.set(i, Math.cos(ai) * rd, d.y, Math.sin(ai) * rd);
            ring.alpha[i] = p > 0.82 ? 0.75 : 0;
          }
          ring.commit();
          /* The clock. */
          const gyr = 3.6 * u;
          clock.userData.draw(p < 0.45 ? ["Today", `Triton at ${fmt(354759)} km`]
            : [`+${gyr.toFixed(2)} billion years`, p < 0.82 ? `Triton at ${fmt(a * R_NEPTUNE)} km` : "torn apart by tides"]);
          ctx.fade(spinLabel, 1 - smooth(p, 0.4, 0.46));
        },
        dispose() { map.dispose(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 84 */
  event({
    id: "pluto-charon-dance",
    section: "outer",
    title: "Pluto and Charon: the double dance",
    place: "Pluto and Charon",
    kind: "ongoing",
    family: "orbit",
    often: "every 6.39 days",
    detail: "Pluto and Charon are locked face to face, both circling a point in empty space between them",
    frequency: "Continuous: Charon goes round once every 6.39 days, and both worlds turn once in exactly the same time.",
    cause: "Charon is half Pluto's width and an eighth of its mass — far bigger, compared with its planet, than any other large moon. Over time their tides on each other slowed both spins until each became locked to the other: they always show each other the same face. And because Charon is so heavy, the centre of mass they both orbit lies about 2,100 km from Pluto's centre — outside Pluto itself.",
    note: "Earth and the Moon also circle a shared point, but it lies 4,670 km from Earth's centre, inside Earth. Pluto's famous heart, Sputnik Planitia, sits almost exactly on the side facing away from Charon.",
    accuracy: "To one true scale: Pluto (2,377 km wide), Charon (1,212 km) and the 19,600 km between them, and the barycentre between. The motion is sped up hugely; the orbit is seen from slightly above.",
    art: { main: "pluto", second: "charon", fx: "dance" },
    scene(ctx) {
      ctx.light.set(-0.65, 0.45, 0.6).normalize();
      /* Separation 19,596 km (Brozović et al. 2015); masses 1.303e22 and
       * 1.586e21 kg (Stern et al. 2015), period 6.3872 d. */
      const SEP = 19596;
      const q = 1.586e21 / (1.303e22 + 1.586e21);
      const dPluto = SEP * q;
      const dCharon = SEP * (1 - q);
      /* layout: one scale for everything. */
      const k = 1.08 / SEP;
      const sys = new THREE.Group();
      sys.position.set(-0.06, 0.04, 0);
      sys.rotation.x = 0.42;
      ctx.add(sys);
      const pair = new THREE.Group();
      sys.add(pair);
      const pluto = ctx.ball(R_PLUTO * k, { body: "Pluto", rim: 0.25, parent: pair });
      pluto.position.x = -dPluto * k;
      /* The map's 180° meridian (the heart) is at u = 0.5, which faces +x;
       * turned half round so the heart faces away from Charon. */
      pluto.rotation.y = Math.PI;
      const charon = ctx.ball(R_CHARON * k, { body: "Charon", rim: 0.25, parent: pair });
      charon.position.x = dCharon * k;
      /* Faces: a marker on each, on the side facing the other. */
      const mP = ctx.glow("#ffd27f", 0.05, { opacity: 0.95, parent: pair });
      mP.position.set(-dPluto * k + R_PLUTO * k * 1.02, 0, 0);
      const mC = ctx.glow("#ffd27f", 0.04, { opacity: 0.95, parent: pair });
      mC.position.set(dCharon * k - R_CHARON * k * 1.04, 0, 0);
      const tether = ctx.line([[-dPluto * k + R_PLUTO * k, 0, 0], [dCharon * k - R_CHARON * k, 0, 0]], { colour: "#ffd27f", opacity: 0.4, dashed: true, dash: 0.02, gap: 0.02, parent: pair });
      /* Orbits round the barycentre. */
      const cOrbit = ctx.circle(dCharon * k, { plane: "xz", colour: "#b8b2ac", opacity: 0.35, parent: sys });
      void cOrbit;
      const pOrbit = ctx.circle(dPluto * k, { plane: "xz", colour: "#ffd27f", opacity: 0.9, parent: sys });
      const bary = ctx.glow("#ffffff", 0.05, { opacity: 1, parent: sys });
      const cross = new THREE.Group();
      sys.add(cross);
      ctx.line([[-0.025, 0, 0], [0.025, 0, 0]], { colour: "#ffffff", opacity: 0.9, parent: cross });
      ctx.line([[0, 0, -0.025], [0, 0, 0.025]], { colour: "#ffffff", opacity: 0.9, parent: cross });
      const baryLabel = ctx.label(["The point they both circle", `${fmt(Math.round(dPluto / 10) * 10)} km from Pluto's centre — outside Pluto`], { at: [0, -0.3, 0], height: 0.026, colour: "#ffe2a8" });
      const baryPointer = ctx.line([[0, -0.25, 0], [0, -0.03, 0]], { colour: "#ffe2a8", opacity: 0.6 });
      const plutoLabel = ctx.label(["Pluto", "2,377 km"], { height: 0.026 });
      const charonLabel = ctx.label(["Charon", "1,212 km"], { height: 0.026 });
      const clock = ctx.label(["", ""], { at: [-0.06, 0.66, 0], height: 0.034 });
      const scaleLabel = ctx.label(["All to one scale"], { at: [-0.06, -0.72, 0], height: 0.022, sub: "#7f93a8" });
      void scaleLabel;

      ctx.tell([
        { at: 0, label: "A double world", text: "Pluto and Charon to one scale. Charon is half Pluto's width: the biggest moon for its planet in the Solar System." },
        { at: 0.24, label: "Face to face", text: "Each always shows the other the same side: both spin once every 6.39 days, exactly as long as an orbit." },
        { at: 0.5, label: "A point in space", text: "They circle their centre of mass, 2,100 km from Pluto's centre — outside Pluto. So Pluto wobbles round an empty point." },
        { at: 0.78, label: "Compare Earth", text: "Earth and the Moon's shared point is 4,670 km from Earth's centre — still inside Earth." },
      ]);
      const w = new THREE.Vector3();
      const toRoot = (obj, out) => { obj.getWorldPosition(w); return out.copy(ctx.root.worldToLocal(w)); };
      return {
        duration: 21,
        update(p) {
          const turns = 2.4 * p;
          pair.rotation.y = turns * TAU + 0.5;
          const days = turns * 6.3872;
          clock.userData.draw([`Day ${days.toFixed(1)}`, `${(days / 6.3872).toFixed(2)} orbits — and ${(days / 6.3872).toFixed(2)} turns each`]);
          const faces = smooth(p, 0.24, 0.32);
          ctx.fade(mP, faces);
          ctx.fade(mC, faces);
          ctx.fade(tether, faces);
          const baryA = smooth(p, 0.5, 0.58);
          ctx.fade(pOrbit, 0.25 + 0.75 * baryA);
          ctx.fade(bary, 0.3 + 0.7 * baryA);
          ctx.fade(baryLabel, baryA);
          ctx.fade(baryPointer, baryA);
          bary.scale.setScalar(0.05 * (1 + 0.25 * Math.sin(ctx.t * 4) * baryA));
          toRoot(pluto, plutoLabel.position).add(new THREE.Vector3(0, 0.13, 0));
          toRoot(charon, charonLabel.position).add(new THREE.Vector3(0, 0.1, 0));
          ctx.fade(plutoLabel, 1 - smooth(p, 0.5, 0.56) * 0.6);
          ctx.fade(charonLabel, 1 - smooth(p, 0.5, 0.56) * 0.6);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 85 */
  event({
    id: "charon-red-cap",
    section: "outer",
    title: "Charon's red cap",
    place: "Pluto → Charon",
    kind: "recurring",
    family: "surface",
    often: "every polar winter",
    detail: "Gas escaping from Pluto freezes onto Charon's dark winter pole, and is slowly turned reddish brown",
    frequency: "Season after season: each of Charon's poles spends more than a century in darkness during Pluto's 248-year orbit, collecting frost, then comes back into sunlight.",
    cause: "Pluto's thin atmosphere slowly leaks into space, and Charon, close by, catches a little of the escaping methane. On the winter pole, colder than about −250 °C, it freezes. In the dark, faint ultraviolet light scattered from the sky breaks the frost into heavier hydrocarbons; when sunlight returns, the leftover methane evaporates and the heavier material stays, darkening further into reddish-brown tholins (Grundy et al. 2016).",
    note: "New Horizons photographed the cap, nicknamed Mordor Macula, during its flyby in July 2015. It is a rare case of one world painting another.",
    accuracy: "A diagram, not to scale: Pluto is drawn small and close to show where the gas comes from. Charon's colours are a simple painting, and the cap's size is approximate.",
    art: { main: "charon", second: "pluto", fx: "glow" },
    scene(ctx) {
      /* layout */
      const RC = 0.4;
      const charonHolder = new THREE.Group();
      charonHolder.position.set(0.28, -0.08, 0);
      charonHolder.rotation.x = 0.55;
      ctx.add(charonHolder);
      /* A simple mottled grey for Charon (no map): a drawing. */
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const g = canvas.getContext("2d");
      g.fillStyle = "#9a948e";
      g.fillRect(0, 0, 512, 256);
      const r = rng(77);
      for (let i = 0; i < 160; i += 1) {
        const shade = 120 + Math.floor(r() * 60);
        g.fillStyle = `rgba(${shade}, ${shade - 4}, ${shade - 8}, ${0.25 + r() * 0.3})`;
        g.beginPath();
        g.arc(r() * 512, 40 + r() * 216, 2 + r() * 12, 0, TAU);
        g.fill();
      }
      const charonMap = new THREE.CanvasTexture(canvas);
      charonMap.colorSpace = THREE.SRGBColorSpace;
      const charon = ctx.ball(RC, { map: charonMap, rim: 0.2, parent: charonHolder });
      /* The cap: two nested polar caps for a soft edge. */
      const capMaterial = (opacity) => ctx.material({ colour: "#e8f2ff", opacity, transparent: true, depthWrite: false });
      const caps = [[0.62, 0.45], [0.44, 0.85]].map(([theta, opacity]) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(RC * 1.004, 64, 16, 0, TAU, 0, theta), capMaterial(opacity));
        mesh.userData.baseOpacity = opacity;
        mesh.renderOrder = 21;
        charonHolder.add(mesh);
        return mesh;
      });
      const uvGlow = ctx.glow("#b48cff", 0.5, { opacity: 0.35, parent: charonHolder });
      uvGlow.position.set(0, RC * 1.05, 0);
      /* Pluto, drawn small and near. */
      const pluto = ctx.ball(0.15, { body: "Pluto", rim: 0.3 });
      pluto.position.set(-0.78, 0.5, -0.2);
      const haze = ctx.glow("#9fc8ff", 0.5, { opacity: 0.3 });
      haze.position.copy(pluto.position);
      /* Escaping gas: most streams away; some is caught at Charon's pole. */
      const N = 520;
      const gas = ctx.cloud(N, { size: 2.2 });
      const gr = rng(83);
      const poleTop = new THREE.Vector3(0, RC, 0).applyEuler(charonHolder.rotation).add(charonHolder.position);
      const flows = Array.from({ length: N }, (_, i) => {
        const caught = i % 4 === 0;
        const dir = new THREE.Vector3(gr() - 0.5, gr() - 0.5, gr() - 0.5).normalize();
        const end = caught
          ? poleTop.clone().add(new THREE.Vector3((gr() - 0.5) * 0.25, 0, (gr() - 0.5) * 0.2))
          : pluto.position.clone().addScaledVector(dir, 0.5 + gr() * 0.5);
        const ctrl = caught ? new THREE.Vector3(-0.2 + gr() * 0.2, 0.75 + gr() * 0.15, 0) : pluto.position.clone().addScaledVector(dir, 0.3);
        const start = pluto.position.clone().addScaledVector(dir, 0.16);
        return { start, ctrl, end, phase: gr(), caught };
      });
      flows.forEach((f, i) => gas.tint(i, f.caught ? "#d6ecff" : "#9fc8ff"));
      const plutoLabel = ctx.label(["Pluto", "its air leaks away"], { at: [-0.78, 0.28, 0], height: 0.026 });
      const charonLabel = ctx.label(["Charon"], { at: [0.28, -0.6, 0], height: 0.03 });
      const capLabel = ctx.label(["", ""], { at: [0.28, 0.5, 0], height: 0.028 });
      const season = ctx.label(["", ""], { at: [-0.62, -0.5, 0], height: 0.028 });

      ctx.tell([
        { at: 0, label: "Pluto's escaping air", text: "Pluto's thin atmosphere leaks slowly into space. Charon, close by, catches a little of the methane." },
        { at: 0.2, label: "Polar night", text: "Charon's poles spend over a century in darkness. Colder than −250 °C, the methane freezes onto the winter pole." },
        { at: 0.4, label: "Faint ultraviolet", text: "Even in the dark, faint ultraviolet light from the sky slowly breaks the frost into heavier compounds." },
        { at: 0.58, label: "Spring", text: "When sunlight returns, the methane evaporates. What is left is turned reddish brown by the light." },
        { at: 0.82, label: "Mordor Macula", text: "Season after season the cap darkens. New Horizons photographed it in 2015." },
      ]);
      const frost = new THREE.Color("#e8f2ff");
      const red = new THREE.Color("#7a3a22");
      const col = new THREE.Color();
      const winter = new THREE.Vector3(-0.35, -0.85, 0.45).normalize();
      const summer = new THREE.Vector3(-0.45, 0.7, 0.55).normalize();
      const tmp = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          charon.rotation.y = 0.4 * p;
          pluto.rotation.y = 0.6 * p;
          /* Sunlight: below the pole in winter, back over it in spring. */
          const spring = easeInOut(span(p, 0.56, 0.68));
          ctx.light.copy(winter).lerp(summer, spring).normalize();
          /* Gas: flowing all the time, pure in p (each puff loops). */
          const flowA = 1 - 0.6 * smooth(p, 0.6, 0.7);
          flows.forEach((f, i) => {
            const s = (f.phase + p * 3) % 1;
            const a = 1 - s;
            tmp.set(
              a * a * f.start.x + 2 * a * s * f.ctrl.x + s * s * f.end.x,
              a * a * f.start.y + 2 * a * s * f.ctrl.y + s * s * f.end.y,
              a * a * f.start.z + 2 * a * s * f.ctrl.z + s * s * f.end.z,
            );
            gas.set(i, tmp.x, tmp.y, tmp.z);
            gas.alpha[i] = (f.caught ? 0.8 : 0.45) * Math.sin(Math.PI * s) * flowA * smooth(p, 0, 0.05);
          });
          gas.commit();
          /* Frost builds in the polar night; reddens after spring. */
          const build = smooth(p, 0.16, 0.42);
          const redden = smooth(p, 0.6, 0.9);
          col.copy(frost).lerp(red, redden);
          caps.forEach((c) => {
            c.material.uniforms.uColor.value.copy(col);
            ctx.fade(c, build);
          });
          ctx.fade(uvGlow, win(p, 0.38, 0.6) * (0.7 + 0.3 * Math.sin(ctx.t * 2.5)));
          ctx.fade(plutoLabel, smooth(p, 0.02, 0.08));
          ctx.fade(charonLabel, smooth(p, 0.02, 0.08));
          capLabel.userData.draw(p < 0.58 ? ["Frost on the winter pole", "methane caught from Pluto"] : p < 0.8 ? ["Reddening in the sunlight", "heavier compounds left behind"] : ["Mordor Macula", "a red-brown cap of tholins"]);
          ctx.fade(capLabel, smooth(p, 0.2, 0.26));
          season.userData.draw(p < 0.56 ? ["Charon's north pole", "polar night: over 100 years"] : ["Charon's north pole", "spring: sunlight returns"]);
          ctx.fade(season, smooth(p, 0.18, 0.24));
        },
        dispose() { charonMap.dispose(); },
      };
    },
  }),

  /* ------------------------------------------------------------------ 86 */
  event({
    id: "arrokoth-merger",
    section: "outer",
    title: "Arrokoth's gentle merger",
    place: "Kuiper Belt · 6.6 billion km from the Sun",
    kind: "recorded",
    family: "smallBody",
    when: "About 4.5 billion years ago; seen by New Horizons on Jan 1, 2019",
    often: "once, at the dawn of the Solar System",
    timeline: { last: "New Horizons flyby, January 1, 2019" },
    detail: "Two small worlds circled each other, drew together and touched at walking pace, fusing into a 36 km snowman",
    frequency: "Once, about 4.5 billion years ago. Arrokoth has hardly changed since, which makes it one of the most pristine objects ever visited.",
    cause: "Arrokoth's two lobes probably formed together, as a pair orbiting each other, in the cloud of pebbles that built the first planetesimals. Over time the pair lost orbital energy and spiralled together, until they touched at a few metres per second or less — about walking pace (McKinnon et al. 2020). So gently that there are no signs of cracks or crushing at the join.",
    note: "New Horizons flew past on January 1, 2019, 6.6 billion km from the Sun — the most distant world ever explored up close. The lobes' flattened shapes and aligned axes are the clues that they once orbited each other.",
    accuracy: "The lobes' sizes are to scale (about 21 × 20 × 9 km and 15 × 14 × 10 km; Spencer et al. 2020); their shapes are simplified. The speed of the spiral is a diagram: in reality it took a very long time.",
    art: { main: "rock", fx: "dance" },
    scene(ctx) {
      ctx.light.set(-0.6, 0.5, 0.65).normalize();
      /* Lobes: Wenu 20.6 × 19.9 × 9.4 km, Weeyo 15.4 × 13.8 × 9.8 km
       * (Spencer et al. 2020); total length 36 km. */
      const k = 1.08 / 36;
      const big = { a: 10.3, b: 9.95, c: 4.7 };
      const small = { a: 7.7, b: 6.9, c: 4.9 };
      const vBig = big.a * big.b * big.c;
      const vSmall = small.a * small.b * small.c;
      const fBig = vSmall / (vBig + vSmall);
      const fSmall = vBig / (vBig + vSmall);
      /* layout */
      const holder = new THREE.Group();
      holder.position.set(-0.08, 0.04, 0);
      ctx.add(holder);
      const pivot = new THREE.Group();
      holder.add(pivot);
      const wenu = ctx.rock(big.a * k, { seed: 5, lumps: 0.14, stretch: [1, big.b / big.a, big.c / big.a], colour: "#a3593d", parent: pivot });
      const weeyo = ctx.rock(small.a * k, { seed: 9, lumps: 0.16, stretch: [1, small.b / small.a, small.c / small.a], colour: "#9a5236", parent: pivot });
      const wenuLabel = ctx.label(["Wenu"], { height: 0.026 });
      const weeyoLabel = ctx.label(["Weeyo"], { height: 0.026 });
      /* The touch: a faint puff of dust. */
      const P = 140;
      const puff = ctx.cloud(P, { parent: pivot, size: 2 });
      const pr = rng(19);
      const puffV = Array.from({ length: P }, () => new THREE.Vector3(pr() - 0.5, pr() - 0.5, (pr() - 0.5) * 0.6).normalize().multiplyScalar(0.05 + pr() * 0.12));
      puffV.forEach((_, i) => puff.tint(i, "#e8c0a8"));
      const path = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffd27f", opacity: 0.35, parent: holder });
      const readout = ctx.label(["", ""], { at: [-0.08, 0.7, 0], height: 0.034 });
      const fact = ctx.label(["", ""], { at: [-0.08, -0.66, 0], height: 0.026 });

      ctx.tell([
        { at: 0, label: "A pair", text: "About 4.5 billion years ago, far beyond Neptune: two small icy worlds circle each other." },
        { at: 0.2, label: "Drawing together", text: "Slowly they lose orbital energy and spiral closer, each keeping the same face to the other." },
        { at: 0.46, label: "Walking pace", text: "They touch at a few metres per second or less — so gently that neither breaks." },
        { at: 0.64, label: "Arrokoth", text: "Two lobes fused into one 36 km body. New Horizons flew past on January 1, 2019: the first building blocks of planets, preserved." },
      ]);
      const CONTACT = 17.6; /* km centre to centre (10.3 + 7.7, less a slight overlap at the neck) */
      const START = 31; /* km, layout */
      const sepOf = (q) => lerp(START, CONTACT, Math.pow(span(q, 0.02, 0.48), 1.6));
      const angOf = (q) => (0.48 - Math.min(q, 0.48)) * 11;
      const w = new THREE.Vector3();
      return {
        duration: 21,
        update(p) {
          const sep = sepOf(p);
          const ang = angOf(p);
          pivot.rotation.z = ang;
          wenu.position.set(-fBig * sep * k, 0, 0);
          weeyo.position.set(fSmall * sep * k, 0, 0);
          /* The trail of the small lobe so far. */
          const pts = [];
          for (let i = 0; i <= 120; i += 1) {
            const qq = Math.min(p, 0.48) * (i / 120);
            const s = sepOf(qq);
            const a = angOf(qq);
            pts.push([Math.cos(a) * fSmall * s * k, Math.sin(a) * fSmall * s * k, -0.05]);
          }
          ctx.setLine(path, pts);
          ctx.fade(path, smooth(p, 0.04, 0.1) * (1 - smooth(p, 0.5, 0.6)));
          /* After contact: turn the body to show how flat it is. */
          const show = smooth(p, 0.6, 0.68);
          holder.rotation.y = show * 0.95 * Math.sin((p - 0.6) * 5.5);
          holder.rotation.x = show * 0.25;
          const touch = span(p, 0.48, 0.66);
          const cp = new THREE.Vector3((-fBig * sep + big.a) * k, 0, 0);
          for (let i = 0; i < P; i += 1) {
            const v = puffV[i];
            puff.set(i, cp.x + v.x * touch, cp.y + v.y * touch, cp.z + v.z * touch);
            puff.alpha[i] = p >= 0.48 ? 0.7 * (1 - touch) : 0;
          }
          puff.commit();
          wenu.getWorldPosition(w);
          wenuLabel.position.copy(ctx.root.worldToLocal(w)).add(new THREE.Vector3(0, 0.38, 0));
          weeyo.getWorldPosition(w);
          weeyoLabel.position.copy(ctx.root.worldToLocal(w)).add(new THREE.Vector3(0, 0.3, 0));
          const named = 1 - smooth(p, 0.62, 0.68);
          ctx.fade(wenuLabel, named);
          ctx.fade(weeyoLabel, named);
          readout.userData.draw(p < 0.48
            ? ["About 4.5 billion years ago", `${sep.toFixed(1)} km apart, centre to centre`]
            : p < 0.64 ? ["Contact", "at a few m/s or less — walking pace"]
              : ["Arrokoth today", "36 km long, 6.6 billion km from the Sun"]);
          fact.userData.draw(p < 0.64 ? ["Each keeps one face to the other", "their flat sides line up"] : ["Seen by New Horizons", "January 1, 2019"]);
          ctx.fade(fact, smooth(p, 0.2, 0.26));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 87 */
  event({
    id: "gliese-710",
    section: "outer",
    title: "A star brushes the Oort Cloud",
    place: "The Oort Cloud",
    kind: "transient",
    family: "stellar",
    when: "In about 1.29 million years",
    often: "once, in about 1.3 million years",
    timeline: { next: "About 1.29 million years from now (Gaia)" },
    detail: "In about 1.3 million years the star Gliese 710 will pass about 10,000 AU from the Sun, through the Oort Cloud",
    frequency: "Once. It is the closest star encounter known in the Solar System's next few million years.",
    cause: "Gliese 710, an orange dwarf with a little over half the Sun's mass, now about 62 light-years away, is heading almost straight toward us at about 14 km/s. Measurements from the Gaia spacecraft put its closest approach at about 10,000 AU — ten thousand times Earth's distance from the Sun — well inside the Oort Cloud, the vast shell of icy bodies around the Solar System.",
    note: "Its gravity will nudge the orbits of comets near its path. Some will be sent falling toward the Sun — a shower of new long-period comets arriving over the following million years or so. The planets are far too close to the Sun to be affected.",
    accuracy: "Distances to one scale (the planets' region, 30 AU across, is far too small to see). The Oort Cloud's edges — about 2,000 to 100,000 AU — are estimates, and so is the exact closest distance: analyses of Gaia data give roughly 10,000–14,000 AU.",
    art: { main: "star", fx: "stream" },
    scene(ctx) {
      /* Oort Cloud ~2,000–100,000 AU (NASA; estimates). Closest approach
       * ~10,000 AU in ~1.29 Myr (de la Fuente Marcos & de la Fuente Marcos
       * 2018, Gaia DR2); speed ~14 km/s ≈ 2.95 AU/yr (1 AU/yr = 4.74 km/s). */
      const OUTER = 100000;
      const INNER = 2000;
      const CLOSEST = 10000;
      const AU_PER_YEAR = 14 / 4.74;
      const N = 1500;
      const r = rng(71);
      const nHat = new THREE.Vector3(-0.32, 0.95, 0).normalize();
      const vHat = new THREE.Vector3(nHat.y, -nHat.x, 0);
      const C = nHat.clone().multiplyScalar(CLOSEST);
      const pts = Array.from({ length: N }, () => {
        const dir = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
        while (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) dir.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
        dir.normalize();
        const d = INNER + (OUTER - INNER) * Math.pow(r(), 1.4);
        const pos = dir.multiplyScalar(d);
        const s = pos.clone().sub(C).dot(vHat);
        const Q = C.clone().addScaledVector(vHat, s);
        const miss = pos.distanceTo(Q);
        const near = clamp01(1 - miss / 22000);
        const kick = Q.clone().sub(pos).normalize().multiplyScalar(2500 * near);
        return { pos, s, near, kick, falls: near > 0.15 && r() < 0.65, fallAt: r(), size: 1.4 + r() * 1.4, a: 0.3 + r() * 0.4 };
      });
      const cloud = ctx.cloud(N, { size: 2 });
      pts.forEach((q, i) => { cloud.tint(i, "#cfe3ff"); cloud.size[i] = q.size; });
      /* The Sun, and the star. */
      const sun = ctx.sun(0.022, { halo: 5 });
      const sunLabel = ctx.label(["Sun", "planets inside 30 AU — too small to see"], { at: [0, -0.1, 0], height: 0.022 });
      const star = ctx.sun(0.03, { colour: "#ff8a4a", hot: "#ffc28a", halo: 6, haloColour: "#ff9a5a", haloOpacity: 0.7 });
      const starLabel = ctx.label(["Gliese 710"], { height: 0.028, colour: "#ffd2b0" });
      const track = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffb27a", opacity: 0.4, dashed: true, dash: 0.03, gap: 0.025 });
      const closest = ctx.line([[0, 0, 0], [0, 0, 0]], { colour: "#ffe2a8", opacity: 0.8 });
      const closestLabel = ctx.label(["~10,000 AU"], { height: 0.026, colour: "#ffe2a8" });
      const oortLabel = ctx.label(["The Oort Cloud", "icy bodies out to ~100,000 AU"], { at: [-0.6, 0.72, 0], height: 0.026 });
      const clock = ctx.label(["", ""], { at: [0.45, 0.74, 0], height: 0.032 });

      ctx.tell([
        { at: 0, label: "The Oort Cloud", text: "Far beyond the planets, a vast shell of icy bodies surrounds the Sun, out to perhaps 100,000 AU." },
        { at: 0.14, label: "1.29 million years on", text: "A small orange star, Gliese 710, is heading our way." },
        { at: 0.3, label: "Closest approach", text: "It passes about 10,000 AU from the Sun — through the Oort Cloud, but far outside the planets." },
        { at: 0.64, label: "A comet shower", text: "Its gravity nudges comets near its path. Some fall toward the Sun, arriving over the next million years or so." },
      ]);
      const toHud = (v, kk, out) => out.set(v.x * kk, v.y * kk, v.z * kk * 0.25);
      const tmp = new THREE.Vector3();
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const edge = (x, y) => (1 - smooth(Math.abs(x), 1.0, 1.1)) * (1 - smooth(Math.abs(y), 0.75, 0.84));
      return {
        duration: 21,
        update(p) {
          const zoom = lerp(1, 3.6, easeInOut(span(p, 0.14, 0.3)));
          const kk = (0.8 / OUTER) * zoom;
          /* The star's distance along its track, AU (0 = closest). */
          const sStar = lerp(-60000, 60000, span(p, 0.18, 0.64));
          const starPos = C.clone().addScaledVector(vHat, sStar);
          const passed = (s) => smooth(sStar - s, 0, 8000);
          const fallPhase = span(p, 0.62, 0.97);
          pts.forEach((q, i) => {
            tmp.copy(q.pos).addScaledVector(q.kick, passed(q.s));
            let alpha = q.a;
            if (q.falls) {
              const f = easeInOut(clamp01((fallPhase - q.fallAt * 0.6) / 0.4));
              tmp.multiplyScalar(1 - 0.97 * f);
              if (f > 0) alpha = 0.95;
            }
            toHud(tmp, kk, a);
            const hot = q.near * passed(q.s);
            cloud.tint(i, hot > 0.05 ? "#ffd7a8" : "#cfe3ff");
            cloud.set(i, a.x, a.y, a.z);
            cloud.alpha[i] = alpha * edge(a.x, a.y) * (q.near > 0.05 ? 0.6 + 0.4 * hot : 1);
          });
          cloud.commit();
          toHud(starPos, kk, a);
          star.position.copy(a);
          const starOn = smooth(p, 0.18, 0.22) * edge(a.x, a.y);
          ctx.fade(star, starOn);
          starLabel.position.copy(a).add(new THREE.Vector3(0, 0.08, 0));
          ctx.fade(starLabel, starOn);
          /* Track, clipped to the hud. */
          toHud(C.clone().addScaledVector(vHat, -60000), kk, a);
          toHud(C.clone().addScaledVector(vHat, 60000), kk, b);
          const lim = (v) => { const s = Math.min(1, 1.05 / Math.max(1e-6, Math.abs(v.x)), 0.8 / Math.max(1e-6, Math.abs(v.y))); return v.multiplyScalar(s); };
          const mid = toHud(C, kk, new THREE.Vector3());
          ctx.setLine(track, [lim(a.sub(mid)).add(mid), lim(b.sub(mid)).add(mid)]);
          ctx.fade(track, smooth(p, 0.2, 0.26));
          ctx.setLine(closest, [[0, 0, 0], mid]);
          const near = smooth(p, 0.32, 0.38);
          ctx.fade(closest, near);
          closestLabel.position.copy(mid).multiplyScalar(0.5).add(new THREE.Vector3(-0.17, 0, 0));
          ctx.fade(closestLabel, near);
          ctx.fade(oortLabel, 1 - smooth(p, 0.14, 0.2));
          ctx.fade(sunLabel, 1 - smooth(p, 0.3, 0.36));
          sun.rotation.y = ctx.t * 0.2;
          /* Clock. */
          if (p < 0.18) {
            const yrs = 1.29e6 * smooth(p, 0.0, 0.17);
            clock.userData.draw([`+${fmt(yrs)} years`, "from now"]);
          } else if (p < 0.64) {
            const dt = sStar / AU_PER_YEAR;
            clock.userData.draw(["+1.29 million years", Math.abs(dt) < 1500 ? "closest approach" : `${dt < 0 ? "" : "+"}${fmt(Math.round(dt / 1000) * 1000)} years from closest`]);
          } else {
            const after = 1e6 * fallPhase;
            clock.userData.draw([`+${fmt(Math.round(after / 10000) * 10000)} years`, "after the pass"]);
          }
        },
      };
    },
  }),
];

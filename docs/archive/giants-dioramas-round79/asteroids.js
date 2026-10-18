import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";

/**
 * Section 5 of the catalogue: asteroids (round 79).
 *
 * Small bodies caught changing: two asteroids smashing together, one spun
 * apart by sunlight, the giant blow that scooped out Vesta's south pole,
 * salt on Ceres, a rock that bakes itself into the Geminids, and Bennu
 * throwing pebbles. Every event is a hud diorama (body: null); the rocks are
 * ctx.rock shapes, drawn far larger than their surroundings where the text
 * says so.
 */

const DEG = Math.PI / 180;

/** Kepler's equation M = E - e sin E, by Newton's method (start at pi for high e). */
function eccentricAnomaly(M, e) {
  let m = M % TAU;
  if (m > Math.PI) m -= TAU;
  if (m < -Math.PI) m += TAU;
  let E = e > 0.8 ? Math.PI : m;
  for (let i = 0; i < 40; i += 1) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  return E;
}
/** True anomaly and radius (in units of a) for mean anomaly M. */
function orbitAt(M, e) {
  const E = eccentricAnomaly(M, e);
  const v = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  return { v, r: 1 - e * Math.cos(E) };
}

/** A filled polygon from [[x, y], ...] in the hud plane. */
function solid(ctx, points, { colour = "#000000", order = 19, z = 0, opacity = 1, parent = ctx.root } = {}) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
  }));
  mesh.position.z = z;
  mesh.renderOrder = order;
  mesh.userData.baseOpacity = opacity;
  mesh.raycast = () => {};
  parent.add(mesh);
  return mesh;
}

/**
 * ctx.rock's icosphere has a vertex per face corner, so it shades in flat
 * facets. Welding the shared corners gives smooth normals.
 */
function weld(mesh) {
  const pos = mesh.geometry.attributes.position;
  const seen = new Map();
  const verts = [];
  const index = [];
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    let k = seen.get(key);
    if (k === undefined) {
      k = verts.length / 3;
      seen.set(key, k);
      verts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    index.push(k);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  return mesh;
}
const rockOf = (ctx, radius, options) => weld(ctx.rock(radius, options));

/** A vertical bar from y0 to y0 + h at x, as a thick filled rectangle. */
function bar(ctx, x, y0, h, w, colour) {
  return solid(ctx, [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, y0 + h], [x - w / 2, y0 + h]], { colour, order: 19 });
}

export const ASTEROID_EVENTS = [
  /* ------------------------------------------------------------------ 1 */
  event({
    id: "asteroid-collision",
    section: "asteroids",
    title: "Asteroids colliding",
    place: "The main belt · P/2010 A2",
    kind: "recorded",
    family: "impact",
    when: "Impact early 2009 · found Jan 6, 2010",
    often: "seen once, 2010",
    timeline: { last: "early 2009 (found January 2010)", next: "unpredictable" },
    detail: "What looked like a comet in the asteroid belt was the wreckage of two asteroids that had smashed together a year before",
    frequency: "Collisions in the belt happen all the time on long timescales, but catching the debris of a fresh one is rare: P/2010 A2 was the first clear case. A few more have been found since.",
    cause: "The LINEAR survey found a fuzzy object with a long dusty tail on January 6, 2010. Hubble showed an X-shaped tangle of dust at its head and a body about 120 m wide just outside it — no gas, no comet. The best fit is a smash in early 2009: a rock a few metres across hitting at about 5 km/s, throwing out debris that sunlight then swept into a tail.",
    note: "Sunlight pushes hardest on the finest dust, so the tail sorted itself by grain size: the smallest grains drifted farthest. Measuring how far they had gone dated the collision to about a year before discovery.",
    accuracy: "A diagram. The impactor and the debris are drawn far larger than real, and the X and the tail are shaped after Hubble's images, not calculated.",
    art: { main: "rock", fx: "impact" },
    scene(ctx) {
      /* layout */
      const T = new THREE.Vector3(-0.45, 0.12, 0);
      /* Main body ~120 m across (Jewitt et al. 2010, Hubble). */
      const target = rockOf(ctx, 0.11, { seed: 4, colour: "#8c8378", lumps: 0.28, stretch: [1.2, 0.9, 1] });
      target.position.copy(T);
      /* Impactor a few metres across (Snodgrass et al. 2010): drawn far too big. */
      const impactor = rockOf(ctx, 0.022, { seed: 9, colour: "#9a9084", lumps: 0.3 });
      const hit = T.clone().add(new THREE.Vector3(0.09, -0.07, 0.05));
      const from = new THREE.Vector3(0.75, -0.62, 0.1);
      ctx.light.set(-0.9, 0.3, 0.4).normalize();
      ctx.arrow([-0.8, 0.66, 0], [-1.02, 0.66, 0], { colour: "#ffd27f", head: 0.04 });
      ctx.label(["to the Sun"], { at: [-0.78, 0.66, 0], align: "left", height: 0.026, colour: "#ffd27f" });
      const flash = ctx.glow("#fff3d0", 0.5, { opacity: 0 });
      flash.position.copy(hit);
      const trail = ctx.line([from, hit], { colour: "#9fd0ff", opacity: 0.4, dashed: true, dash: 0.02, gap: 0.02 });

      /* Debris: four arms of an X, plus a diffuse cloud; each grain's push
       * from sunlight (beta) sets how fast it drifts down-Sun. */
      const N = 1600;
      const debris = ctx.cloud(N, { size: 2.6 });
      const r = rng(77);
      const ARMS = [35, 145, 215, 325].map((a) => a * DEG);
      const grains = Array.from({ length: N }, (_, i) => {
        const inArm = i < N * 0.65;
        const a = inArm ? ARMS[i % 4] + (r() - 0.5) * 0.09 : r() * TAU;
        const speed = inArm ? 0.08 + Math.pow(r(), 0.6) * 0.42 : 0.06 + r() * 0.16;
        /* Arm rubble is coarse (little push); the diffuse dust is fine. */
        const beta = inArm ? r() * 0.12 : 0.25 + r() * 0.75;
        return { dir: new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8, (r() - 0.5) * 0.3), speed, beta };
      });
      grains.forEach((g, i) => { debris.tint(i, g.beta > 0.2 ? "#d8ccb8" : "#f2e6d0"); debris.size[i] = g.beta > 0.2 ? 2 : 3.2; });
      const bodyLabel = ctx.label(["Asteroid", "about 120 m wide"], { at: [T.x - 0.02, T.y + 0.2, 0], height: 0.036 });
      const impLabel = ctx.label(["Impactor", "a few metres"], { height: 0.032 });
      const xLabel = ctx.label(["X-shaped debris"], { at: [T.x - 0.32, T.y - 0.3, 0], height: 0.03, colour: "#ffe3a8" });
      const tailLabel = ctx.label(["dust tail, swept by sunlight →"], { at: [0.35, 0.02, 0], height: 0.03, colour: "#ffe3a8" });
      const clock = ctx.label(["", ""], { at: [-0.2, -0.66, 0], height: 0.044 });
      const MONTHS = ["Feb 2009", "Mar 2009", "Apr 2009", "May 2009", "June 2009", "July 2009", "Aug 2009", "Sept 2009", "Oct 2009", "Nov 2009", "Dec 2009", "Jan 2010"];

      ctx.tell([
        { at: 0, label: "Two rocks, one orbit", text: "Early 2009, in the asteroid belt: a rock a few metres across closes on one about 120 m wide." },
        { at: 0.24, label: "Impact", text: "They meet at about 5 km/s — 18,000 km/h — and the small one is destroyed." },
        { at: 0.42, label: "An X of debris", text: "Rubble and dust spray out in crossing streaks, and sunlight starts to push the finest grains away." },
        { at: 0.72, label: "January 2010", text: "Eleven months on, a survey finds a 'comet' with an X-shaped head. It was wreckage, not ice." },
      ]);
      const IMPACT = 0.26;
      return {
        duration: 20,
        update(p) {
          const a = easeInOut(span(p, 0.03, IMPACT));
          impactor.position.lerpVectors(from, hit, a);
          impactor.rotation.set(p * 9, p * 7, 0);
          impactor.visible = p < IMPACT;
          impLabel.position.set(impactor.position.x + 0.05, impactor.position.y - 0.07, 0);
          ctx.fade(impLabel, smooth(p, 0.02, 0.06) * (1 - smooth(p, IMPACT - 0.03, IMPACT)));
          ctx.fade(trail, 0.8 * smooth(p, 0.02, 0.06) * (1 - smooth(p, IMPACT, IMPACT + 0.04)));
          ctx.fade(bodyLabel, 1 - smooth(p, 0.4, 0.46));
          const f = smooth(p, IMPACT, IMPACT + 0.01) * (1 - smooth(p, IMPACT + 0.01, IMPACT + 0.08));
          ctx.fade(flash, f);
          flash.scale.setScalar(0.2 + 0.6 * f);
          target.rotation.set(0.2, ctx.t * 0.15 + (p > IMPACT ? 0.6 : 0), 0.1);
          /* Debris: out along its direction, decelerating; then drifting
           * down-Sun (+x) by beta × time². */
          const tau = span(p, IMPACT, 1);
          const out = 1 - Math.pow(1 - Math.min(1, tau * 2.2), 2);
          grains.forEach((g, i) => {
            const push = g.beta * 1.6 * tau * tau;
            debris.set(i, hit.x + g.dir.x * g.speed * out + push, hit.y + g.dir.y * g.speed * out - push * 0.12, hit.z + g.dir.z * g.speed * out);
            debris.alpha[i] = p > IMPACT ? (g.beta > 0.2 ? 0.5 : 0.95) * (1 - 0.4 * g.beta * tau) : 0;
          });
          debris.commit();
          ctx.fade(xLabel, win(p, 0.42, 0.98));
          ctx.fade(tailLabel, smooth(p, 0.58, 0.64));
          const months = Math.min(11, Math.floor(11 * span(p, IMPACT, 0.74)));
          clock.userData.draw(p < IMPACT
            ? ["Early 2009", "closing at about 5 km/s"]
            : p < 0.74 ? [MONTHS[months], `${months} month${months === 1 ? "" : "s"} after the impact`]
              : ["January 6, 2010", "found as 'comet' P/2010 A2"]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 2 */
  event({
    id: "asteroid-spin-apart",
    section: "asteroids",
    title: "An asteroid spun apart by sunlight",
    place: "The main belt · P/2013 R3",
    kind: "recorded",
    family: "smallBody",
    when: "Seen breaking up Oct 2013 – Jan 2014",
    often: "seen once, 2013",
    timeline: { last: "2013–14, P/2013 R3", next: "unpredictable" },
    detail: "Sunlight's gentle push spun a small asteroid faster and faster over millions of years, until it flew apart into ten pieces",
    frequency: "Rare to catch: P/2013 R3 was the first asteroid seen in the act of falling apart. Over the age of the Solar System, though, spinning up and splitting is thought to happen to most small asteroids.",
    cause: "An asteroid warmed by the Sun gives off heat again as infrared light, mostly from its warm afternoon side. Each photon carries a tiny kick, and on an uneven body the kicks add up to a twist — the YORP effect. Over millions of years it can spin a small rubble pile up to a turn every two hours or so, faster than its weak gravity can hold it together.",
    note: "Hubble watched P/2013 R3 between October 2013 and January 2014: ten pieces, the largest a few hundred metres across, drifting apart at about 1.5 km/h — walking pace. The total was about 200,000 tonnes of rock.",
    accuracy: "A diagram: the spin-up that takes millions of years is squeezed into seconds, the starting spin is illustrative, and the heat arrows are a picture of the push, not to scale.",
    art: { main: "rock", fx: "split" },
    scene(ctx) {
      /* layout */
      const C = new THREE.Vector3(-0.15, 0.05, 0);
      const holder = new THREE.Group();
      holder.position.copy(C);
      holder.rotation.x = 0.35;
      ctx.add(holder);
      const spinner = new THREE.Group();
      holder.add(spinner);
      ctx.light.set(-0.95, 0.25, 0.3).normalize();
      /* Ten pieces (Jewitt et al. 2014), packed into one elongated rubble pile. */
      const r = rng(31);
      const pieces = Array.from({ length: 10 }, (_, i) => {
        const size = i < 4 ? 0.055 + r() * 0.02 : 0.03 + r() * 0.02;
        const a = (i / 10) * TAU + r() * 0.4;
        const home = new THREE.Vector3(Math.cos(a) * (0.08 + r() * 0.08) * 1.4, (r() - 0.5) * 0.12, Math.sin(a) * (0.06 + r() * 0.06));
        const rock = rockOf(ctx, size, { seed: 100 + i, colour: i % 3 ? "#8c8378" : "#7d756b", lumps: 0.3, parent: spinner });
        rock.position.copy(home);
        return { rock, home, size, kick: new THREE.Vector3((r() - 0.5) * 0.4, (r() - 0.5) * 0.25, (r() - 0.5) * 0.4), tumble: new THREE.Vector3(r(), r(), r()) };
      });
      /* Heat: infrared arrows off the warm afternoon side. */
      ctx.arrow([-1.05, -0.3, 0], [-0.72, -0.16, 0], { colour: "#ffe08a", head: 0.04 });
      const sunLabel = ctx.label(["sunlight"], { at: [-1.04, -0.37, 0], align: "left", height: 0.026, colour: "#ffe08a" });
      void sunLabel;
      const heat = [0.5, 0, -0.5].map((a) => ctx.arrow([C.x + Math.cos(a) * 0.2, C.y + Math.sin(a) * 0.15, 0.1], [C.x + Math.cos(a) * 0.38, C.y + Math.sin(a) * 0.27, 0.1], { colour: "#ff6a4a", head: 0.035 }));
      const heatLabel = ctx.label(["heat given off", "a tiny twist"], { at: [C.x + 0.36, C.y + 0.33, 0], height: 0.034, colour: "#ff9a7a" });
      const spinLabel = ctx.label(["", ""], { at: [C.x, -0.58, 0], height: 0.046 });
      const hubble = ctx.label(["P/2013 R3", "Hubble: ten pieces, ~1.5 km/h apart"], { at: [0.55, 0.55, 0], height: 0.04, colour: "#ffe3a8" });
      const DUST = 600;
      const dust = ctx.cloud(DUST, { size: 2 });
      const dustSeeds = Array.from({ length: DUST }, () => ({ k: Math.floor(r() * 10), off: new THREE.Vector3((r() - 0.5) * 0.08, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08), drift: r() }));
      dustSeeds.forEach((_, i) => dust.tint(i, "#d8c8b0"));

      /* Spin rate in rad per unit progress: slow, then up to the breakup.
       * Period labels: an illustrative 6 h to the ~2.2 h rubble-pile limit
       * (Pravec & Harris 2000). */
      const W0 = 6;
      const W1 = 70;
      const BREAK = 0.56;
      const omega = (q) => lerp(W0, W1, smooth(q, 0.12, BREAK));
      const angleAt = (p) => {
        let a = 0;
        const steps = 160;
        const end = Math.min(p, BREAK);
        for (let i = 0; i < steps; i += 1) a += omega((end * (i + 0.5)) / steps) * (end / steps);
        return a;
      };
      const aBreak = angleAt(BREAK);

      ctx.tell([
        { at: 0, label: "A rubble pile", text: "A small asteroid, loosely held together by its own weak gravity, turns in the sunlight." },
        { at: 0.14, label: "Sunlight's push", text: "Warmed by day, it gives the heat off again unevenly. Each photon is a tiny kick; together they twist it." },
        { at: 0.36, label: "Faster and faster", text: "Over millions of years the spin builds, toward a turn every two hours." },
        { at: 0.56, label: "It flies apart", text: "Too fast to hold together. In 2013 Hubble watched P/2013 R3 drift apart in ten pieces." },
      ]);
      const v = new THREE.Vector3();
      return {
        duration: 20,
        update(p) {
          const ang = angleAt(p);
          spinner.rotation.y = ang;
          const hf = smooth(p, 0.12, 0.2) * (1 - smooth(p, BREAK - 0.02, BREAK + 0.02));
          heat.forEach((a) => ctx.fade(a, hf * (0.6 + 0.4 * Math.sin(ctx.t * 5))));
          ctx.fade(heatLabel, hf);
          const period = lerp(6, 2.2, smooth(p, 0.12, BREAK));
          const myr = lerp(0, 5, smooth(p, 0.12, BREAK));
          spinLabel.userData.draw(p < BREAK
            ? [`One turn every ${period.toFixed(1)} h`, p < 0.12 ? "now" : `+${myr.toFixed(1)} million years (illustrative)`]
            : ["Broken apart", "ten pieces, drifting away"]);
          /* After the break: each piece leaves along its spin velocity plus a kick. */
          const t = Math.max(0, p - BREAK);
          pieces.forEach((pc) => {
            if (p <= BREAK) {
              pc.rock.position.copy(pc.home);
              pc.rock.rotation.set(0, 0, 0);
              return;
            }
            /* In the spinner's frame frozen at the break angle: tangential
             * velocity omega × r, rotated back into place. */
            const tang = new THREE.Vector3(-pc.home.z, 0, pc.home.x).multiplyScalar(-W1 * 0.025);
            v.copy(pc.home).addScaledVector(tang, t * 1.2).addScaledVector(pc.kick, t * 1.4).addScaledVector(pc.home, t * 5);
            pc.rock.position.copy(v);
            pc.rock.rotation.set(pc.tumble.x * t * 20, pc.tumble.y * t * 20, pc.tumble.z * t * 20);
          });
          if (p > BREAK) spinner.rotation.y = aBreak + (p - BREAK) * 3;
          spinner.updateMatrixWorld();
          const dd = smooth(p, BREAK, BREAK + 0.1);
          dustSeeds.forEach((s, i) => {
            const pc = pieces[s.k];
            v.copy(pc.rock.position).add(s.off).applyMatrix4(spinner.matrix).applyMatrix4(holder.matrix);
            dust.set(i, v.x + s.drift * t * 1.4, v.y - s.drift * t * 0.1, v.z);
            dust.alpha[i] = dd * 0.5 * (1 - s.drift * 0.5);
          });
          dust.commit();
          ctx.fade(hubble, smooth(p, 0.62, 0.68));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 3 */
  event({
    id: "vesta-rheasilvia",
    section: "asteroids",
    title: "The Rheasilvia impact on Vesta",
    place: "Vesta · the south pole",
    kind: "recorded",
    family: "impact",
    when: "About 1 billion years ago",
    often: "once, ~1 billion years ago",
    timeline: { last: "about 1 billion years ago", next: "pieces still landing on Earth" },
    detail: "A blow so big it scooped out a crater 505 km wide — almost Vesta's own width — with a central peak about 22 km high",
    frequency: "Once. Collisions that large are among the biggest the asteroid belt has seen since the Solar System's early days.",
    cause: "About a billion years ago something tens of kilometres across hit Vesta's south pole. The crater it left, Rheasilvia, is 505 km wide — 90% of Vesta's diameter — and the floor rebounded into a central mountain about 22 km high, two and a half times Everest. It overlies an older basin, Veneneia, and blasted about 1% of Vesta into space.",
    note: "Some of that debris became the 'Vestoids', small asteroids on Vesta-like orbits, and some still falls to Earth as HED meteorites (howardites, eucrites and diogenites) — about one meteorite fall in twenty. Dawn mapped the crater from orbit in 2011–12.",
    accuracy: "Vesta's shape is a smoothed version of its real proportions; the crater's width is to scale, its depth and peak are drawn two and a half times as tall, and the impactor and ejecta are a diagram. The Everest bars are to scale with each other.",
    art: { main: "rock", fx: "impact" },
    scene(ctx) {
      /* Vesta 572.6 × 557.2 × 446.4 km (Russell et al. 2012); mean radius
       * ~262.7 km. Rheasilvia 505 km wide, peak ~22 km above the floor,
       * floor ~19 km below the rim (Schenk et al. 2012); relief ×2.5
       * (drawing choice). */
      const RV = 262.7;
      const SHAPE = [572.6 / 2 / RV, 446.4 / 2 / RV, 557.2 / 2 / RV];
      const THETA_C = (505 / 2) / RV;
      const RELIEF = 2.5;
      const DEPTH = (19 / RV) * RELIEF;
      const PEAK = (22 / RV) * RELIEF;
      /* layout */
      const R = 0.34;
      const C = new THREE.Vector3(-0.3, 0.12, 0);
      const tilt = new THREE.Group();
      tilt.position.copy(C);
      tilt.rotation.x = -0.55;
      tilt.rotation.z = 0.2;
      ctx.add(tilt);
      const geometry = new THREE.SphereGeometry(1, 192, 96);
      const pos = geometry.attributes.position;
      const dirs = [];
      const v = new THREE.Vector3();
      const r = rng(19);
      const bumps = Array.from({ length: 10 }, () => ({ d: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), a: (r() - 0.5) * 0.05, w: 6 + r() * 10 }));
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).normalize();
        let k = 1;
        bumps.forEach((b) => { k += b.a * Math.exp(-b.w * (1 - v.dot(b.d))); });
        dirs.push({ d: v.clone(), k, theta: Math.acos(Math.max(-1, Math.min(1, -v.y))) });
      }
      const mesh = new THREE.Mesh(geometry, ctx.material({ colour: "#a39c90", night: 0.08, rim: 0.2, rimColour: "#e8dcc8" }));
      mesh.renderOrder = 20;
      tilt.add(mesh);
      const crater = (th) => {
        let h = 0;
        if (th < THETA_C) h -= DEPTH * (1 - (th / THETA_C) ** 2);
        h += PEAK * Math.exp(-((th / 0.3) ** 2));
        h += 0.02 * Math.exp(-(((th - THETA_C) / 0.08) ** 2));
        return h;
      };
      let shown = -1;
      const shape = (c) => {
        if (Math.abs(c - shown) < 1e-4) return;
        shown = c;
        dirs.forEach((q, i) => {
          const rr = R * (q.k + c * crater(q.theta));
          pos.setXYZ(i, q.d.x * rr * SHAPE[0], q.d.y * rr * SHAPE[1], q.d.z * rr * SHAPE[2]);
        });
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
      };
      shape(0);
      /* The rim, dashed, on the surface. */
      const rimPts = [];
      for (let i = 0; i <= 96; i += 1) {
        const a = (i / 96) * TAU;
        const d = new THREE.Vector3(Math.sin(THETA_C) * Math.cos(a), -Math.cos(THETA_C), Math.sin(THETA_C) * Math.sin(a));
        rimPts.push(new THREE.Vector3(d.x * R * SHAPE[0] * 1.03, d.y * R * SHAPE[1] * 1.03, d.z * R * SHAPE[2] * 1.03));
      }
      const rimLine = ctx.line(rimPts, { colour: "#ffd27f", opacity: 0.9, dashed: true, dash: 0.02, gap: 0.015, parent: tilt, additive: false });
      const pole = new THREE.Vector3(0, -R * SHAPE[1], 0);
      tilt.updateMatrixWorld();
      const poleWorld = pole.clone().applyMatrix4(tilt.matrix);
      const impactor = rockOf(ctx, 0.035, { seed: 61, colour: "#7d756b" });
      const from = poleWorld.clone().add(new THREE.Vector3(0.9, -0.55, 0.4));
      const flash = ctx.glow("#fff3d0", 0.6, { opacity: 0 });
      flash.position.copy(poleWorld);
      /* A low light from the left, so the basin's relief shows. */
      ctx.light.set(-0.85, 0.15, 0.5).normalize();
      /* Ejecta: a cone around the pole, a stream heading off as Vestoids. */
      const N = 900;
      const ejecta = ctx.cloud(N, { size: 2.6 });
      const out = poleWorld.clone().sub(C).normalize();
      const grains = Array.from({ length: N }, (_, i) => {
        const stream = i < N * 0.25;
        const d = stream
          ? new THREE.Vector3(0.85, 0.35, 0.1).normalize().add(new THREE.Vector3((r() - 0.5) * 0.15, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15))
          : out.clone().add(new THREE.Vector3((r() - 0.5) * 1.5, (r() - 0.5) * 1.5, (r() - 0.5) * 1.0)).normalize();
        return { d, s: stream ? 0.6 + r() * 0.7 : 0.15 + r() * 0.4, stream };
      });
      grains.forEach((g, i) => ejecta.tint(i, g.stream ? "#d8ccb8" : "#c9b89f"));
      const vestaLabel = ctx.label(["Vesta", "about 525 km wide"], { at: [C.x - 0.05, C.y + 0.44, 0], height: 0.036 });
      const craterLabel = ctx.label(["Rheasilvia", "505 km across"], { at: [C.x - 0.36, C.y - 0.32, 0], height: 0.036, colour: "#ffe3a8" });
      const clock = ctx.label([""], { at: [C.x, -0.6, 0], height: 0.034 });

      /* Everest 8.849 km (2020 survey) vs the peak ~22 km: to scale with
       * each other. */
      const k = 0.022;
      const by = -0.1;
      const peakBar = bar(ctx, 0.8, by, 22 * k, 0.09, "#c9b89f");
      const everBar = bar(ctx, 0.6, by, 8.849 * k, 0.09, "#d9dde3");
      const axis = ctx.line([[0.48, by, 0], [0.92, by, 0]], { colour: "#9fb3c8", opacity: 0.6 });
      const peakLabel = ctx.label(["Central peak", "about 22 km"], { at: [0.8, by + 22 * k + 0.07, 0], height: 0.034 });
      const everLabel = ctx.label(["Everest", "8.8 km"], { at: [0.6, by + 8.849 * k + 0.07, 0], height: 0.034 });
      const peakGroup = [peakBar, everBar, peakLabel, everLabel, axis];
      /* Earth and the HED meteorites. */
      const earth = ctx.ball(0.05, { body: "Earth", rim: 0.4 });
      earth.position.set(0.78, -0.42, 0);
      const hedLabel = ctx.label(["HED meteorites", "pieces of Vesta, still falling"], { at: [0.62, -0.56, 0], height: 0.034, colour: "#ffe3a8" });
      const FALL = 24;
      const falls = ctx.cloud(FALL, { size: 3 });
      const fallSeeds = Array.from({ length: FALL }, () => ({ ph: r(), off: (r() - 0.5) * 0.1 }));
      fallSeeds.forEach((_, i) => falls.tint(i, "#ffd9a0"));

      ctx.tell([
        { at: 0, label: "Vesta", text: "The second-largest body in the asteroid belt, about 525 km wide. Something is coming for its south pole." },
        { at: 0.24, label: "Impact", text: "About a billion years ago: a blow that scoops out a crater 505 km wide — almost as wide as Vesta." },
        { at: 0.48, label: "A central mountain", text: "The floor rebounds into a peak about 22 km high: two and a half Everests." },
        { at: 0.72, label: "Still landing", text: "Debris thrown off Vesta still falls on Earth: the HED meteorites, about one fall in twenty." },
      ]);
      const IMPACT = 0.26;
      return {
        duration: 20,
        update(p) {
          mesh.rotation.y = ctx.t * 0.06;
          rimLine.rotation.y = mesh.rotation.y;
          const a = easeInOut(span(p, 0.04, IMPACT));
          impactor.position.lerpVectors(from, poleWorld, a);
          impactor.visible = p < IMPACT;
          impactor.rotation.set(p * 8, p * 5, 0);
          const f = smooth(p, IMPACT, IMPACT + 0.01) * (1 - smooth(p, IMPACT + 0.02, IMPACT + 0.12));
          ctx.fade(flash, f);
          flash.scale.setScalar(0.3 + 0.9 * f);
          shape(easeInOut(span(p, IMPACT, IMPACT + 0.16)));
          ctx.fade(rimLine, smooth(p, 0.42, 0.48));
          ctx.fade(craterLabel, smooth(p, 0.42, 0.48));
          ctx.fade(vestaLabel, 1 - smooth(p, 0.5, 0.56) * 0.6);
          const tau = span(p, IMPACT, IMPACT + 0.45);
          grains.forEach((g, i) => {
            const d = g.s * (g.stream ? tau * 1.5 : 1 - (1 - tau) ** 2);
            ejecta.set(i, poleWorld.x + g.d.x * d, poleWorld.y + g.d.y * d, poleWorld.z + g.d.z * d);
            ejecta.alpha[i] = p > IMPACT ? 0.8 * (1 - tau) : 0;
          });
          ejecta.commit();
          const pk = smooth(p, 0.48, 0.54);
          peakGroup.forEach((o) => ctx.fade(o, pk));
          peakBar.scale.y = Math.max(0.001, smooth(p, 0.48, 0.56));
          const hed = smooth(p, 0.72, 0.78);
          ctx.fade(earth, hed);
          ctx.fade(hedLabel, hed);
          earth.rotation.y = ctx.t * 0.4;
          fallSeeds.forEach((s, i) => {
            const q = (s.ph + ctx.t * 0.25) % 1;
            falls.set(i, lerp(C.x + 0.3, earth.position.x, q) + s.off * (1 - q), lerp(C.y - 0.15, earth.position.y + 0.04, q) + s.off * (1 - q), 0.05);
            falls.alpha[i] = hed * Math.sin(Math.PI * q) * 0.9;
          });
          falls.commit();
          clock.userData.draw([p < 0.72 ? "About 1 billion years ago" : "Today"]);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 4 */
  event({
    id: "ceres-bright-spots",
    section: "asteroids",
    title: "Ceres's bright spots",
    place: "Ceres · Occator crater",
    kind: "ongoing",
    family: "geology",
    often: "seen since 2015",
    detail: "The bright spots in Ceres's dark crater Occator are salt, left where salty water seeped up and boiled away into space",
    frequency: "Ongoing on geological timescales: some of the salt in Occator is thought to be only a few million years old, and brine may still be down there.",
    cause: "Ceres, 940 km wide and the largest body in the belt, has a deep layer of salty water, or brine, beneath its crust. Under Occator crater it seeps up through fractures. In the airless cold at the surface the water boils and sublimes away into space, and the dissolved salt stays behind as a bright crust. Dawn's spectra showed it is mostly sodium carbonate.",
    note: "The Dawn spacecraft saw the spots shining out from a hundred thousand kilometres away as it approached in early 2015. The brightest, Cerealia Facula, sits in a pit with a dome at the crater's centre.",
    accuracy: "Ceres's globe is a plain grey sphere with the spots marked; the cross-section is a diagram with the crater's depth drawn three times too deep. The brine's depth of about 40 km is to scale with the crater's 92 km width.",
    art: { main: "rock", fx: "spot" },
    scene(ctx) {
      /* layout */
      const RC = 0.25;
      const C = new THREE.Vector3(0.55, 0.47, 0);
      /* Ceres: 939.4 km mean diameter (Park et al. 2016). */
      const ceres = ctx.ball(RC, { colour: "#77736e", rim: 0.25, rimColour: "#cfd8e6", night: 0.06 });
      ceres.position.copy(C);
      ctx.light.set(-0.5, 0.45, 0.75).normalize();
      /* Occator: 19.8°N (Gazetteer); placed on the visible face. */
      const spots = [[20, 0, 0.016], [21.5, 4, 0.008], [18.5, 5, 0.006]].map(([lat, lon, s]) => {
        const m = ctx.ball(s, { colour: "#ffffff", emissive: "#d8e8ff", parent: ceres });
        m.position.copy(ctx.onSphere(RC * 0.995, lat, lon));
        return m;
      });
      void spots;
      const crater = new THREE.Group();
      crater.position.copy(ctx.onSphere(RC * 1.003, 20, 2));
      crater.lookAt(crater.position.clone().multiplyScalar(2));
      ceres.add(crater);
      ctx.circle(0.05, { plane: "xy", colour: "#3a3632", opacity: 0.9, parent: crater, additive: false });
      const shine = ctx.glow("#e8f2ff", 0.12, { opacity: 0.9 });
      const ceresLabel = ctx.label(["Ceres", "940 km wide"], { at: [C.x, C.y - RC - 0.1, 0], height: 0.036 });
      void ceresLabel;

      /* The cross-section. Horizontal scale: 92 km = 0.8 units. */
      const X0 = -1.08;
      const X1 = 0.24;
      const XC = -0.42;
      const W = 0.4;
      const SURF = 0.08;
      const KM = 0.8 / 92;
      const floorY = (x) => {
        const u = (x - XC) / W;
        if (Math.abs(u) > 1.15) return SURF;
        const bowl = Math.abs(u) < 1 ? -0.1 * (1 - u ** 4) : 0;
        const rim = 0.02 * Math.exp(-(((Math.abs(u) - 1) / 0.12) ** 2));
        const pit = -0.02 * Math.exp(-((u / 0.08) ** 2));
        return SURF + bowl + rim + pit;
      };
      const crustPts = [[X0, -0.62]];
      for (let i = 0; i <= 120; i += 1) {
        const x = lerp(X0, X1, i / 120);
        crustPts.push([x, floorY(x)]);
      }
      crustPts.push([X1, -0.62]);
      const section = new THREE.Group();
      ctx.add(section);
      solid(ctx, crustPts, { colour: "#4e4a46", parent: section, order: 18 });
      /* Brine about 40 km down (Raymond et al. 2020), to horizontal scale. */
      const brineY = floorY(XC) - 40 * KM;
      const brine = [];
      for (let i = 0; i <= 40; i += 1) {
        const a = (i / 40) * TAU;
        brine.push([XC + Math.cos(a) * 0.36, brineY + Math.sin(a) * 0.06]);
      }
      solid(ctx, brine, { colour: "#2f6fb3", opacity: 0.85, parent: section, order: 19 });
      const crackPts = [[XC, brineY + 0.04], [XC + 0.02, brineY + 0.12], [XC - 0.015, brineY + 0.2], [XC + 0.01, brineY + 0.28], [XC, floorY(XC)]];
      const crack2 = [[XC - 0.15, brineY + 0.05], [XC - 0.12, brineY + 0.15], [XC - 0.16, brineY + 0.25], [XC - 0.13, floorY(XC - 0.13)]];
      ctx.line(crackPts.map(([x, y]) => [x, y, 0.01]), { colour: "#1a1816", opacity: 1, additive: false, parent: section });
      ctx.line(crack2.map(([x, y]) => [x, y, 0.01]), { colour: "#1a1816", opacity: 1, additive: false, parent: section });
      const r = rng(23);
      const UP = 140;
      const up = ctx.cloud(UP, { size: 3.5, parent: section });
      const upSeeds = Array.from({ length: UP }, () => ({ path: r() > 0.35 ? crackPts : crack2, ph: r() }));
      upSeeds.forEach((_, i) => up.tint(i, "#7fc0ff"));
      const VAP = 260;
      const vapour = ctx.cloud(VAP, { size: 3, parent: section });
      const vapSeeds = Array.from({ length: VAP }, () => ({ x: (r() - 0.5) * 0.12, ph: r(), drift: (r() - 0.5) * 0.25, at: r() > 0.3 ? XC : XC - 0.13 }));
      vapSeeds.forEach((_, i) => vapour.tint(i, "#eaf4ff"));
      /* The salt: a central dome (Cerealia) and a thinner patch (Vinalia). */
      const salt = new THREE.Group();
      section.add(salt);
      const dome = [];
      for (let i = 0; i <= 24; i += 1) {
        const u = i / 24;
        dome.push([XC - 0.06 + u * 0.12, floorY(XC) + 0.035 * Math.sin(Math.PI * u)]);
      }
      solid(ctx, dome, { colour: "#f4f8ff", parent: salt, order: 20, z: 0.01 });
      solid(ctx, [[XC - 0.2, floorY(XC - 0.2) - 0.002], [XC - 0.09, floorY(XC - 0.09) - 0.002], [XC - 0.09, floorY(XC - 0.09) + 0.01], [XC - 0.2, floorY(XC - 0.2) + 0.01]], { colour: "#e8f0fa", parent: salt, order: 20, z: 0.01 });
      const saltGlow = ctx.glow("#e8f2ff", 0.25, { opacity: 0.8, parent: salt });
      saltGlow.position.set(XC, floorY(XC) + 0.02, 0.02);
      const titleLabel = ctx.label(["Occator crater, cut open", "92 km wide · depth drawn ×3"], { at: [XC - 0.1, 0.62, 0], height: 0.04, parent: section });
      const brineLabel = ctx.label(["salty water", "about 40 km down"], { at: [XC, brineY - 0.12, 0.02], height: 0.036, colour: "#bfe0ff", parent: section });
      const vapLabel = ctx.label(["water boils off", "into space"], { at: [XC + 0.38, SURF + 0.22, 0.02], height: 0.036, parent: section });
      const saltLabel = ctx.label(["salt left behind", "sodium carbonate"], { at: [XC + 0.45, floorY(XC) + 0.02, 0.02], height: 0.036, colour: "#ffe3a8", parent: section });
      const lead = ctx.line([[C.x - 0.1, C.y + 0.1, 0.3], [XC + 0.4, SURF + 0.06, 0]], { colour: "#e8f2ff", opacity: 0.4, dashed: true, dash: 0.02, gap: 0.015 });

      ctx.tell([
        { at: 0, label: "Ceres", text: "The largest body in the asteroid belt, and dark as asphalt — except for spots in one crater, Occator." },
        { at: 0.22, label: "Inside Occator", text: "Far below lies salty water. It seeps up through cracks under the crater floor." },
        { at: 0.46, label: "Boiled away", text: "At the airless, frozen surface the water boils and escapes into space…" },
        { at: 0.68, label: "Salt", text: "…and the salt stays behind, gleaming: mostly sodium carbonate, Dawn found." },
      ]);
      return {
        duration: 20,
        update(p) {
          ceres.rotation.y = lerp(0.9, -0.05, easeInOut(span(p, 0, 0.2))) + ctx.t * 0.01;
          ceres.updateMatrixWorld();
          const sp = ctx.onSphere(RC * 1.01, 20, 2).applyMatrix4(ceres.matrix);
          shine.position.copy(sp);
          shine.scale.setScalar(0.08 + 0.03 * Math.sin(ctx.t * 3) ** 2);
          ctx.fade(shine, smooth(p, 0.08, 0.18));
          const s = smooth(p, 0.18, 0.26);
          ctx.fade(section, s);
          ctx.fade(lead, s * 0.8);
          const rise = smooth(p, 0.24, 0.32);
          upSeeds.forEach((u, i) => {
            const q = (u.ph + ctx.t * 0.18) % 1;
            const seg = q * (u.path.length - 1);
            const k = Math.min(u.path.length - 2, Math.floor(seg));
            const f = seg - k;
            up.set(i, lerp(u.path[k][0], u.path[k + 1][0], f), lerp(u.path[k][1], u.path[k + 1][1], f), 0.02);
            up.alpha[i] = rise * s * 0.9;
          });
          up.commit();
          const boil = smooth(p, 0.46, 0.52) * s;
          vapSeeds.forEach((v, i) => {
            const q = (v.ph + ctx.t * 0.3) % 1;
            vapour.set(i, v.at + v.x * 0.3 + v.drift * q, floorY(v.at) + 0.01 + q * 0.42, 0.02);
            vapour.alpha[i] = boil * (1 - q) * 0.7;
          });
          vapour.commit();
          ctx.fade(vapLabel, boil);
          const sl = smooth(p, 0.56, 0.72) * s;
          ctx.fade(salt, sl);
          salt.scale.y = Math.max(0.01, sl);
          salt.position.y = floorY(XC) * (1 - Math.max(0.01, sl));
          ctx.fade(saltLabel, smooth(p, 0.68, 0.74) * s);
          ctx.fade(brineLabel, smooth(p, 0.24, 0.3) * s);
          ctx.fade(titleLabel, s);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 5 */
  event({
    id: "phaethon",
    section: "asteroids",
    title: "Phaethon: a rock that sheds the Geminids",
    place: "3200 Phaethon · inside Mercury's orbit",
    kind: "recurring",
    family: "smallBody",
    when: "Perihelion every 1.43 years · Geminids every Dec 13–14",
    often: "every 1.4 years; the shower every December",
    timeline: { last: "the Geminids, December 2025", next: "the Geminids, December 13–14, 2026" },
    detail: "An asteroid that dives to 0.14 AU from the Sun, baked to over 700 °C, and leaves behind the dust of December's Geminid meteors",
    frequency: "Phaethon reaches perihelion every 1.43 years (523 days). Earth crosses its dust stream every year around December 13–14, when the Geminids peak at over a hundred meteors an hour under dark skies.",
    cause: "Phaethon's long, thin orbit takes it to 0.14 AU from the Sun — less than half Mercury's distance — then out past Mars. At perihelion its surface bakes to over 700 °C; the heat cracks the rock and sheds dust, and the Sun's light may lift fine grains off it. Over thousands of years the dust has spread all along the orbit, and Earth's path cuts through that stream in December.",
    note: "Most meteor showers come from comets. The Geminids are one of the few known to come from an asteroid, which is why Phaethon is called a 'rock comet'. Japan's DESTINY+ mission is planned to fly past it.",
    accuracy: "The orbits of Mercury, Earth and Phaethon are to scale but drawn flat: Phaethon's is really tilted 22°, so its stream meets Earth's orbit only at the December crossing (the other apparent crossing passes far above). Phaethon and the dust are enlarged; the timing between Phaethon's pass and Earth's arrival is a diagram.",
    art: { main: "rock", second: "sun", fx: "stream" },
    scene(ctx) {
      /* Phaethon: a 1.271 AU, e 0.890 (q 0.140 AU), period 523.6 d,
       * longitude of perihelion ~227° (Ω 265.2° + ω 322.2°) (JPL SBDB). */
      const A = 1.271;
      const E = 0.89;
      const PERIOD = 523.6;
      const VARPI = 227 * DEG;
      /* layout */
      const AU = 0.36;
      const S = new THREE.Vector3(-0.38, -0.14, 0);
      const sun = ctx.sun(0.035, { halo: 3.5, haloOpacity: 0.6 });
      sun.position.copy(S);
      const at = (M) => {
        const o = orbitAt(M, E);
        const ang = o.v + VARPI;
        return new THREE.Vector3(S.x + Math.cos(ang) * o.r * A * AU, S.y + Math.sin(ang) * o.r * A * AU, 0);
      };
      ctx.orbit(A * AU, E, { plane: "xy", rotate: VARPI, colour: "#ff9a6a", opacity: 0.4 }).position.copy(S);
      /* Mercury 0.387 AU, e 0.2056, perihelion 77.5° (Standish J2000). */
      ctx.orbit(0.387 * AU, 0.2056, { plane: "xy", rotate: 77.46 * DEG, colour: "#c9c0b6", opacity: 0.5 }).position.copy(S);
      ctx.circle(AU, { plane: "xy", colour: "#4f7fbf", opacity: 0.6 }).position.copy(S);
      /* The stream crosses Earth's orbit at longitude ~81° (where r = 1 on
       * this ellipse), Earth's place on December 14 (the Sun at ~262°). */
      const CROSS = 81 * DEG;
      const phaethon = rockOf(ctx, 0.022, { seed: 32, colour: "#5a5550", lumps: 0.25 });
      const heat = ctx.glow("#ff7a3a", 0.12, { opacity: 0 });
      const earth = ctx.ball(0.03, { body: "Earth", rim: 0.4 });
      const crossMark = ctx.circle(0.05, { plane: "xy", colour: "#8fd8ff", opacity: 0.8 });
      crossMark.position.set(S.x + Math.cos(CROSS) * AU, S.y + Math.sin(CROSS) * AU, 0);
      ctx.light.set(0, 0.2, 1).normalize();
      /* The dust stream: grains spread along the whole orbit. */
      const r = rng(55);
      const N = 1400;
      const dust = ctx.cloud(N, { size: 2.2 });
      const grains = Array.from({ length: N }, (_, i) => ({ M: r() * TAU, j: 1 + (r() - 0.5) * 0.06, fresh: i < 300, dM: r() }));
      grains.forEach((g, i) => dust.tint(i, g.fresh ? "#ffd2a0" : "#c9a68a"));
      const distLabel = ctx.label(["", ""], { height: 0.034 });
      const earthLabel = ctx.label(["Earth"], { height: 0.024, colour: "#9fd0ff" });
      ctx.label(["Mercury's orbit"], { at: [S.x + 0.02, S.y - 0.18, 0], height: 0.02, colour: "#c9c0b6" });
      /* The sky on December 14: Geminids from a radiant near Castor. */
      const SKY = new THREE.Vector3(0.74, 0.3, 0);
      const skyDisc = ctx.disc(0.27, { colour: "#050b18", opacity: 0.9 });
      skyDisc.position.copy(SKY);
      const skyRing = ctx.circle(0.27, { plane: "xy", colour: "#9fb3c8", opacity: 0.5 });
      skyRing.position.copy(SKY);
      const radiant = SKY.clone().add(new THREE.Vector3(-0.05, 0.08, 0.01));
      const METEORS = 36;
      const meteors = Array.from({ length: METEORS }, () => ({
        line: ctx.line([radiant, radiant.clone().add(new THREE.Vector3(0.001, 0, 0))], { colour: "#fff3d0", opacity: 1 }),
        a: r() * TAU, d0: 0.03 + r() * 0.08, len: 0.06 + r() * 0.08, t0: lerp(0.84, 0.95, r()),
      }));
      const skyLabel = ctx.label(["December 14: the Geminids", "over 100 meteors an hour"], { at: [SKY.x, SKY.y - 0.36, 0], height: 0.036, colour: "#ffe3a8" });
      const skyGroup = [skyRing, skyLabel, skyDisc];

      /* Days: one common clock. Phaethon at perihelion on day 100; Earth
       * reaches the crossing on day 280. Slowed through perihelion. */
      const n = TAU / PERIOD;
      const dayAt = (p) => (p < 0.28 ? lerp(0, 95, span(p, 0.02, 0.28))
        : p < 0.5 ? lerp(95, 106, span(p, 0.28, 0.5))
          : lerp(106, 285, span(p, 0.5, 0.92)));
      /* Earth: 0.9856° a day (365.256-day year). */
      const earthAngle = (d) => CROSS - (0.9856 * DEG) * (280 - d);

      ctx.tell([
        { at: 0, label: "A rock on a comet's orbit", text: "Phaethon swings in from beyond Mars on a long, thin orbit, toward the Sun." },
        { at: 0.28, label: "Baked", text: "At 0.14 AU — closer than Mercury ever comes — its surface reaches over 700 °C. The rock cracks and sheds dust." },
        { at: 0.52, label: "A river of dust", text: "Over thousands of years the dust has spread all the way round its orbit." },
        { at: 0.82, label: "The Geminids", text: "Every December Earth ploughs through the stream, and the dust burns up as the Geminid meteor shower." },
      ]);
      return {
        duration: 20,
        update(p) {
          const d = dayAt(p);
          const M = n * (d - 100);
          const ph = at(M);
          phaethon.position.copy(ph);
          phaethon.rotation.set(p * 6, p * 9, 0);
          const rau = ph.distanceTo(S) / AU;
          const hot = clamp01((0.5 - rau) / 0.36);
          phaethon.material.uniforms.uEmissive.value.setRGB(hot * 0.9, hot * 0.3, hot * 0.05);
          heat.position.copy(ph);
          ctx.fade(heat, hot);
          heat.scale.setScalar(0.06 + 0.1 * hot);
          distLabel.position.set(ph.x + (hot > 0.3 ? -0.12 : 0.1), ph.y + (hot > 0.3 ? -0.1 : 0.06), 0);
          distLabel.userData.draw(["Phaethon", hot > 0.85 ? `${rau.toFixed(2)} AU · over 700 °C` : `${rau.toFixed(2)} AU from the Sun`]);
          const ea = earthAngle(d);
          earth.position.set(S.x + Math.cos(ea) * AU, S.y + Math.sin(ea) * AU, 0);
          earth.rotation.y = ctx.t * 0.5;
          earthLabel.position.set(earth.position.x - 0.08, earth.position.y + 0.05, 0);
          const old = 0.35 + 0.4 * smooth(p, 0.5, 0.62);
          grains.forEach((g, i) => {
            let pt;
            if (g.fresh) {
              /* Shed near perihelion, then spreading along the orbit. */
              const age = Math.max(0, d - 98);
              pt = at(M - (g.dM - 0.3) * age * 0.004 - g.dM * 0.05);
              dust.alpha[i] = d > 98 ? 0.8 : 0;
            } else {
              pt = at(g.M + n * d);
              dust.alpha[i] = old * 0.6;
            }
            dust.set(i, S.x + (pt.x - S.x) * g.j, S.y + (pt.y - S.y) * g.j, 0);
          });
          dust.commit();
          crossMark.scale.setScalar(1 + 0.2 * Math.sin(ctx.t * 4));
          ctx.fade(crossMark, smooth(p, 0.62, 0.7));
          const sky = smooth(p, 0.8, 0.86);
          skyGroup.forEach((o) => ctx.fade(o, sky));
          meteors.forEach((m) => {
            const u = span(p, m.t0, m.t0 + 0.025);
            const dir = new THREE.Vector3(Math.cos(m.a), Math.sin(m.a), 0);
            const head = radiant.clone().addScaledVector(dir, m.d0 + m.len * u);
            const tail = radiant.clone().addScaledVector(dir, m.d0 + m.len * Math.max(0, u - 0.5));
            ctx.setLine(m.line, [tail, head]);
            ctx.fade(m.line, u > 0 && u < 1 ? sky * (1 - u * 0.5) : 0);
          });
          sun.rotation.y = ctx.t * 0.1;
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 6 */
  event({
    id: "bennu-particles",
    section: "asteroids",
    title: "Bennu throwing pebbles into space",
    place: "Asteroid Bennu",
    kind: "recorded",
    family: "smallBody",
    when: "First seen January 6, 2019",
    often: "every few days, seen in 2019",
    timeline: { last: "2019 (OSIRIS-REx)", next: "ongoing" },
    detail: "Arriving at the asteroid Bennu, the OSIRIS-REx spacecraft found it flinging small stones off its surface every few days",
    frequency: "Small ejections every few days through 2019, with bigger bursts every couple of weeks, many of them in Bennu's late afternoon. It probably goes on all the time.",
    cause: "The first ejection was spotted on January 6, 2019. Pebbles, mostly up to about 10 cm across, leave the surface at up to a few metres a second. Bennu's gravity is so weak — its escape speed is about 20 cm/s — that the fastest leave for good, some go into orbit for days, and others arc back down. The likeliest causes are rocks cracking as they heat and cool every 4.3-hour day, and tiny meteoroids hitting the surface.",
    note: "Bennu is about 490 m wide and shaped like a spinning top. OSIRIS-REx collected a sample from its surface in 2020 and brought it to Earth in September 2023.",
    accuracy: "A diagram: Bennu's spinning-top shape is approximate, the pebbles are drawn far larger than real, and the three paths are typical kinds, not tracked particles.",
    art: { main: "rock", fx: "jets" },
    scene(ctx) {
      /* Bennu: mean diameter ~490 m, rotation 4.296 h (Lauretta et al.
       * 2019). */
      const R = 0.3;
      const C = new THREE.Vector3(-0.12, 0.0, 0);
      const holder = new THREE.Group();
      holder.position.copy(C);
      holder.rotation.x = 0.12;
      ctx.add(holder);
      const bennu = rockOf(ctx, R, { seed: 2, lumps: 0.1, colour: "#6a645e", detail: 5, parent: holder });
      /* Spinning-top: pinch toward the poles, keep the equatorial ridge. */
      const pos = bennu.geometry.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i);
        const len = v.length();
        const lat = Math.asin(v.y / len);
        const k = 1 - 0.3 * Math.abs(Math.sin(lat));
        v.multiplyScalar(k);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      bennu.geometry.computeVertexNormals();
      /* Boulders. */
      const r = rng(8);
      for (let i = 0; i < 26; i += 1) {
        const lat = (r() - 0.5) * 140;
        const lon = r() * 360;
        const b = rockOf(ctx, 0.008 + r() * 0.014, { seed: 200 + i, colour: "#7a736c", lumps: 0.35, parent: bennu });
        const k = 1 - 0.3 * Math.abs(Math.sin(lat * DEG));
        b.position.copy(ctx.onSphere(R * k * 0.97, lat, lon));
      }
      ctx.light.set(-0.85, 0.3, 0.45).normalize();

      /* Three kinds of path, in hud space around Bennu (diagram). */
      const site = (lat, lon) => {
        const k = 1 - 0.3 * Math.abs(Math.sin(lat * DEG));
        return ctx.onSphere(R * k, lat, lon).applyEuler(holder.rotation).add(C);
      };
      const paths = [];
      { /* Escapes: out and away, bending slightly. */
        const s = site(30, -40);
        const d = s.clone().sub(C).normalize();
        const pts = [];
        for (let i = 0; i <= 80; i += 1) {
          const t = i / 80;
          pts.push(s.clone().addScaledVector(d, t * 0.55).add(new THREE.Vector3(0.1 * t * t, 0.22 * t * t, 0)));
        }
        paths.push({ pts, t0: 0.1, t1: 0.42, colour: "#ffd27f", label: ["escapes", "faster than ~20 cm/s"], dx: 0.04, dy: 0.07 });
      }
      { /* Orbits: up into a tilted loop around Bennu. */
        const pts = [];
        const R2 = 0.52;
        const a0 = 2.5;
        for (let i = 0; i <= 160; i += 1) {
          const t = i / 160;
          const a = a0 - t * TAU * 1.35;
          const rad = lerp(R * 0.95, R2, smooth(t, 0, 0.18));
          const p = new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad);
          p.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.55).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.25);
          pts.push(p.add(C));
        }
        paths.push({ pts, t0: 0.3, t1: 0.74, colour: "#8fd8ff", label: ["goes into orbit", "for hours or days"], dx: -0.05, dy: -0.08 });
      }
      { /* Falls back: a hop across the surface. */
        const pts = [];
        for (let i = 0; i <= 80; i += 1) {
          const t = i / 80;
          const lon = lerp(40, 85, t);
          const lat = lerp(10, -20, t);
          const k = 1 - 0.3 * Math.abs(Math.sin(lat * DEG));
          const h = 1 + 0.55 * Math.sin(Math.PI * t);
          pts.push(ctx.onSphere(R * k * h, lat, lon).applyEuler(holder.rotation).add(C));
        }
        paths.push({ pts, t0: 0.5, t1: 0.78, colour: "#ff9a7a", label: ["falls back down", "lands elsewhere"], dx: 0.04, dy: 0.08 });
      }
      const movers = paths.map((pa) => {
        const trail = ctx.line(pa.pts.slice(0, 2), { colour: pa.colour, opacity: 0.85 });
        const dot = ctx.glow(pa.colour, 0.045, { opacity: 1 });
        const puff = ctx.glow("#fff3d0", 0.12, { opacity: 0 });
        puff.position.copy(pa.pts[0]);
        const label = ctx.label(pa.label, { height: 0.034, colour: pa.colour, align: pa.dx < 0 ? "right" : "left" });
        return { ...pa, trail, dot, puff, label };
      });
      /* Many small ones, unlabelled. */
      const SMALL = 40;
      const small = ctx.cloud(SMALL, { size: 2.6 });
      const smallSeeds = Array.from({ length: SMALL }, () => ({ lat: (r() - 0.5) * 100, lon: -90 + r() * 180, t0: lerp(0.05, 0.85, r()), h: 0.1 + r() * 0.25, drift: (r() - 0.5) * 30 }));
      smallSeeds.forEach((_, i) => small.tint(i, "#e8dcc8"));
      const clock = ctx.label(["", ""], { at: [0.55, 0.6, 0], height: 0.044 });
      const facts = ctx.label(["Bennu · about 490 m wide", "pebbles up to ~10 cm, up to ~3 m/s"], { at: [C.x - 0.2, -0.6, 0], height: 0.036 });
      void facts;

      ctx.tell([
        { at: 0, label: "Bennu", text: "A rubble-pile asteroid about 490 m wide, shaped like a spinning top, turning once every 4.3 hours." },
        { at: 0.1, label: "January 6, 2019", text: "OSIRIS-REx sees something no one expected: pebbles popping off the surface." },
        { at: 0.3, label: "Some go into orbit", text: "Bennu's gravity is so weak that a pebble at the right speed circles it for hours or days." },
        { at: 0.5, label: "Some fall back", text: "Others arc up and come down elsewhere. Heat cracking the rocks, or tiny meteoroid hits, may launch them." },
      ]);
      return {
        duration: 20,
        update(p) {
          bennu.rotation.y = p * TAU * 0.6;
          movers.forEach((m) => {
            const u = span(p, m.t0, m.t1);
            const live = p > m.t0;
            const n = Math.max(2, Math.round(u * (m.pts.length - 1)) + 1);
            ctx.setLine(m.trail, m.pts.slice(Math.max(0, n - 40), n));
            const head = m.pts[n - 1];
            m.dot.position.copy(head);
            const end = m.colour === "#ff9a7a" && u >= 1 ? 0 : 1;
            ctx.fade(m.dot, live ? end * (1 - smooth(p, m.t1 + 0.04, m.t1 + 0.1)) : 0);
            ctx.fade(m.trail, live ? 0.85 * (1 - smooth(p, m.t1 + 0.06, m.t1 + 0.16)) : 0);
            const fl = smooth(p, m.t0, m.t0 + 0.01) * (1 - smooth(p, m.t0 + 0.01, m.t0 + 0.05));
            ctx.fade(m.puff, fl);
            m.label.position.set(head.x + m.dx, head.y + m.dy, 0.1);
            ctx.fade(m.label, win(p, m.t0 + 0.02, Math.min(0.99, m.t1 + 0.12)));
          });
          smallSeeds.forEach((s, i) => {
            const u = span(p, s.t0, s.t0 + 0.12);
            const k = 1 - 0.3 * Math.abs(Math.sin(s.lat * DEG));
            const h = 1 + s.h * Math.sin(Math.PI * u);
            const q = ctx.onSphere(R * k * h, s.lat, s.lon + s.drift * u).applyEuler(holder.rotation).add(C);
            small.set(i, q.x, q.y, q.z);
            small.alpha[i] = u > 0 && u < 1 && q.z > C.z - 0.05 ? 0.8 : 0;
          });
          small.commit();
          clock.userData.draw(p < 0.1 ? ["December 2018", "OSIRIS-REx arrives"] : ["January 6, 2019", "the first ejection seen"]);
        },
      };
    },
  }),
];

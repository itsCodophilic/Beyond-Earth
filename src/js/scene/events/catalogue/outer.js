import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { uranusTipped, uranusSeasons, neptuneDarkSpot, neptuneWinds, tritonDoom, charonRedCap, arrokothMerger, gliese710 } from "./outerScenes.js";

/**
 * Section 8 of the catalogue: Uranus, Neptune and beyond (round 79).
 *
 * Ten events: the tipped ice giant and its seasons, Neptune's storms, winds
 * and interior, Triton's doomed orbit, the Pluto–Charon pair, Charon's red
 * cap, Arrokoth's gentle merger and the star that will brush the Oort Cloud.
 * Round 86: eight of them now play on the site's real bodies -- their
 * scenes are in outerScenes.js; the diamond rain and the Pluto–Charon
 * dance (the owner: "looks good") stay as round-79 dioramas. The old
 * dioramas are kept in docs/archive/outer-dioramas-round79/outer.js.
 *
 * Sizes and orbits are NASA's planetary fact sheets
 * (nssdc.gsfc.nasa.gov/planetary/factsheet) unless a comment says otherwise.
 */

const DEG = Math.PI / 180;
const fmt = (n) => Math.round(n).toLocaleString("en-US");

/* Mean radii, km (NASA fact sheets; Pluto and Charon from New Horizons,
 * Nimmo et al. 2017). */
const R_NEPTUNE = 24622;
const R_PLUTO = 1188.3;
const R_CHARON = 606;

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
    accuracy: "The site's own Uranus, its rings and its real tilt (97.8°), seen side on. The impactor is drawn at the size of a body about twice Earth's mass; the rewind, impact and tipping are shown in seconds, and the inset orbit is not to scale.",
    art: { main: "uranus", fx: "impact" },
    body: "Uranus",
    /* Round 86: on the real Uranus (outerScenes.js). */
    scene: uranusTipped,
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
    accuracy: "The site's own Uranus, seen as if from a camera travelling with it on the Sun's side: Uranus stays put and the sunlight comes round it exactly as it does over one real orbit, with its axis where the site points it. The inset shows the orbit from above. The 84 years pass in the length of her line; the solstice and equinox years are rounded, and the orbit's slight stretch (eccentricity 0.046) is left out of the timing.",
    art: { main: "uranus", second: "sun", fx: "orbit" },
    body: "Uranus",
    /* Round 86: on the real Uranus (outerScenes.js). */
    scene: uranusSeasons,
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
    accuracy: "The site's own Neptune. The Great Dark Spot and its bright companion clouds are drawn on it at their measured size and latitude (about 13,000 × 6,600 km at 22° S), and Earth beside it to the same scale; the 1994 northern spot's size is a guess. The site's Neptune map has some small dark ovals of its own. Neptune's turning is slowed right down.",
    art: { main: "neptune", fx: "spot" },
    body: "Neptune",
    /* Round 86: on the real Neptune (outerScenes.js). */
    scene: neptuneDarkSpot,
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
    accuracy: "The site's own Neptune, held still so that only the clouds move. The cloud streaks follow Voyager 2's measured wind profile in their relative speeds, slowed enormously; the bars are to scale with each other.",
    art: { main: "neptune", fx: "storm" },
    body: "Neptune",
    /* Round 86: on the real Neptune (outerScenes.js). */
    scene: neptuneWinds,
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
    accuracy: "The site's own Neptune and Triton, with Triton moved out to its real distance (14.4 Neptune radii) on an orbit tilted 23° and going backwards. The Roche limit is to the same scale. The spiral's shape follows tidal theory; its timing is an estimate (Chyba et al. 1989), and the number of turns is a picture.",
    art: { main: "neptune", fx: "spiral" },
    body: "Neptune",
    /* Round 86: on the real Neptune (outerScenes.js). */
    scene: tritonDoom,
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
    accuracy: "The site's own Charon and Pluto. The red cap is on Charon's own map, from New Horizons; the frost that builds and reddens over it, and the gas flowing from Pluto, are pictures of the process. Pluto and Charon are much closer together here than in reality.",
    art: { main: "charon", second: "pluto", fx: "glow" },
    body: "Charon",
    /* Round 86: on the real Charon (outerScenes.js). */
    scene: charonRedCap,
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
    accuracy: "The site's own Arrokoth, and its two lobes cut from that same model, so their colour, texture and size match. The spin run backwards, the parting and the spiral are shown in seconds; in reality the spiral took a very long time.",
    art: { main: "rock", fx: "dance" },
    body: "Arrokoth",
    /* Round 86: on the real Arrokoth (outerScenes.js). */
    scene: arrokothMerger,
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
    accuracy: "The site's own Sun, planets' orbits and Oort Cloud, seen from far out. All distances go through the site's own squeezed distance scale, so the 10,000 AU pass is to that scale, not a linear one. The exact closest distance is an estimate: analyses of Gaia data give roughly 10,000–14,000 AU.",
    art: { main: "star", fx: "stream" },
    body: "Sun",
    /* Round 86: on the real Sun (outerScenes.js). */
    scene: gliese710,
  }),
];

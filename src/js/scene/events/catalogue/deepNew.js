import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, easeInOut, rng } from "./kit.js";
import { voyage, curveThrough, orbitView, deepAsset } from "./deepVoyage.js";
import { star, realStar, inFrame, imageNebula, particleJet, dysonRings, wormholeMouth, wormholeTunnel, farSkySphere, burst, accretion, blackHole, lensSky, neutronStar, flash, cloudOf, shock, galaxy, planet, ringSystem, swarm, cosmicWeb, wormhole, funnel, gauss, V } from "./deepObjects.js";
import { titleAt, lightChart, out } from "./deepScenes.js";

/**
 * Round 88 (Prompts.md: "add more real space events ... wormhole, biggest
 * black hole detected, white hole, biggest star detected, Dyson sphere,
 * Boötes Void, pulsar, Earth-like planets like Kepler-186f, a heart in
 * space, Stephenson 2-18, types of galaxies, J1407b with its huge rings,
 * the Horsehead Nebula, the exile planet PSO J318.5−22 ... and more"):
 * new deep-sky voyages, each to a real object where one exists (and, for a
 * wormhole and a white hole, which no one has found, said so). Positions
 * are J2000 from SIMBAD unless a comment says otherwise.
 */

const H = (h, m = 0, s = 0) => h + m / 60 + s / 3600;
const D = (d, m = 0, s = 0) => (Object.is(d, -0) || d < 0 ? -1 : 1) * (Math.abs(d) + m / 60 + s / 3600);
const seen = (peak, colour, label, title, { size = 0.03, rise = 6 } = {}) => (q) => ({
  glow: Math.min(1, q * rise) * peak * (0.9 + 0.1 * Math.sin(q * 50)), size, colour, label, title,
});

/* A scene of its own: build(ctx, U, H, site, tag) returns { update(q, a, t) }
 * and the camera; titles and an optional chart come from cfg. */
function own(cfg, make) {
  return (U, ctx, Hk, site, tag) => {
    const g = new THREE.Group();
    site.add(g);
    const ch = lightChart(ctx, Hk, cfg.chart);
    const s = make({ ctx, U, H: Hk, g, tag, site });
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        s.update(q, a, ctx.t, dt);
        if (ch) ch.show(span(q, cfg.chart.from ?? 0.1, cfg.chart.to ?? 0.9), a * win(q, (cfg.chart.from ?? 0.1) - 0.03, cfg.chart.until ?? 1.02, 0.03));
      },
    };
  };
}

/* ------------------------------------------------------------ wormhole */

export const WORMHOLE = event({
  id: "wormhole",
  section: "deep",
  title: "A wormhole: a shortcut through space?",
  place: "Nowhere yet found",
  kind: "theory",
  family: "deepSky",
  when: "Predicted 1935 (Einstein and Rosen); none ever found",
  often: "never seen",
  timeline: { last: "never seen — a solution of Einstein's equations" },
  detail: "Einstein's equations allow a tunnel joining two far-apart places in space — but no one has ever found one, and keeping one open would need matter that may not exist",
  frequency: "None found. Astronomers have looked for the way a wormhole would bend light, so far without success",
  cause: "General relativity says mass curves space. In 1935 Einstein and Nathan Rosen found that the mathematics allows a 'bridge' joining two separate regions. In 1988 Kip Thorne and Michael Morris worked out what a wormhole a person could travel through would need: a throat held open by 'exotic' matter with negative energy, which ordinary matter does not have.",
  note: "An Einstein–Rosen bridge pinches shut faster than light could cross it. Tiny amounts of negative energy do appear in quantum physics (the Casimir effect), but nowhere near enough. The wormhole in the film Interstellar was designed with Kip Thorne's help.",
  accuracy: "A picture of an idea, not of a real object. The funnel is the standard 'embedding diagram' of curved space (Flamm's paraboloid); the mouth showing another sky is drawn as such a wormhole might look.",
  art: { main: "blackhole", fx: "ripple" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    target: { name: "A wormhole", short: "A wormhole", lyText: "nowhere yet found", where: "" },
    map: false,
    look: { ra: 6, dec: 12 },
    /* Round 93 (Prompts.md: "don't show leaving the Solar System and
     * coming back -- we can't go, it is a theory"): no journey; the whole
     * event is the idea, drawn. Timed to her line (49 s): curved space,
     * the bridge (from 20%), the mouth (44%), through it (58%, round 94:
     * longer), the far end (80%). */
    noTrip: true,
    phases: { out: 0, map: 0, at: 0, back: 1, end: 1 },
    stars: false,
    tells: [
      { at: 0, label: "A shortcut?", text: "Could there be tunnels through space, joining places light-years apart? Mass curves space: drawn as a sheet, a heavy object makes a funnel." },
      { at: 0.2, label: "A bridge", text: "Einstein's equations allow two funnels joined at the throat: a wormhole (Einstein and Rosen, 1935)." },
      { at: 0.44, label: "The mouth", text: "From outside, its mouth would be a sphere showing the sky of the far end, with our own sky bent round its rim." },
      { at: 0.58, label: "Through it", text: "To keep it open you would need 'exotic' matter with negative energy — which may not exist." },
      { at: 0.85, label: "Never found", text: "A beautiful solution of the equations. Whether nature uses it, no one knows." },
    ],
    build: own({
      titles: [
        [0, ["Curved space", "a funnel round a mass"]],
        [0.2, ["Two funnels, joined", "an Einstein–Rosen bridge"]],
        [0.44, ["The mouth", "the far end's sky inside, ours bent round the rim"]],
        [0.58, ["Through the throat", ""]],
        [0.8, ["The far end", "another sky — and our own, inside the mouth behind us"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      const fun = funnel(ctx, g, { rs: 2, R: 20, both: true, rings: 16, spokes: 32, opacity: 0.5 });
      const half = funnel(ctx, g, { rs: 2, R: 20, both: false, rings: 16, spokes: 32, opacity: 0.5, colour: "#ffd27f" });
      /* Our sky all round, and the far end's, for after the crossing. */
      const ours = lensSky(ctx, g);
      const theirs = farSkySphere(ctx, g);
      theirs.show(0);
      const mouth = wormholeMouth(ctx, g, 3);
      const tunnel = wormholeTunnel(ctx, g, 40);
      const tFun = tag(["Space, curved by a mass", "drawn as a sheet"], { height: 0.034, colour: "#9fc8ff" });
      const tThroat = tag(["The throat", "held open by 'exotic' matter?"], { height: 0.034, colour: "#ffd27f" });
      const tMouth = tag(["The mouth", "not black: a window on the far end"], { height: 0.034, colour: "#cfe2ff" });
      const ahead = V();
      let yawIn = 0;
      return {
        update(q, a) {
          const sheet = 1 - smooth(q, 0.42, 0.48);
          ctx.fade(half, a * sheet * (1 - smooth(q, 0.18, 0.24)));
          ctx.fade(fun, a * sheet * smooth(q, 0.18, 0.24));
          /* Round 94: the crossing made longer (about a fifth of the visit,
           * some 10 seconds). */
          const k = span(q, 0.58, 0.8);
          const crossed = q >= 0.8;
          /* The mouth: from 0.44, hidden while inside the throat. */
          const m = smooth(q, 0.42, 0.48) * (1 - smooth(q, 0.59, 0.61)) + (crossed ? smooth(q, 0.82, 0.88) : 0);
          mouth.material.uniforms.uOpacity.value = a * m;
          mouth.material.uniforms.uSwap.value = crossed ? 1 : 0;
          mouth.visible = a * m > 0.002;
          /* The skies: ours until the middle of the crossing, then theirs. */
          ours.show(a * 0.45 * (1 - smooth(k, 0.45, 0.6)) * smooth(q, 0.3, 0.44));
          theirs.show(a * smooth(k, 0.55, 0.9));
          /* The camera. */
          let eyeDist;
          let yaw;
          let pitch;
          if (q < 0.44) { eyeDist = lerp(60, 46, q / 0.44); yaw = 0.4 + q * 0.4; pitch = lerp(0.45, 0.3, q / 0.44); }
          else if (q < 0.58) { eyeDist = lerp(28, 6, easeInOut(span(q, 0.44, 0.58))); yaw = 0.4 + q * 0.4; pitch = lerp(0.3, 0.08, span(q, 0.44, 0.58)); yawIn = yaw; }
          else if (!crossed) { eyeDist = lerp(6, 0.4, easeInOut(k)); yaw = yawIn; pitch = 0.08; }
          else { eyeDist = lerp(3.6, 14, easeInOut(span(q, 0.8, 0.95))); yaw = yawIn + Math.PI + (q - 0.8) * 0.5; pitch = 0.1; }
          orbitView(U, V(), Math.max(0.4, eyeDist), yaw, pitch);
          /* Inside the throat: a few seconds of the sky wound round us. */
          ahead.set(-Math.sin(yawIn) * Math.cos(0.08), -Math.sin(0.08), -Math.cos(yawIn) * Math.cos(0.08));
          tunnel.set(k, ahead, U.eye, a * (q >= 0.56 && !crossed ? smooth(q, 0.56, 0.59) * (1 - smooth(q, 0.785, 0.8)) : 0));
          tFun.userData.at(V(14, 0, 0), 0, 0.05, a * win(q, 0.04, 0.2, 0.03));
          tThroat.userData.at(V(0, 0, 0), 0.06, 0.02, a * win(q, 0.24, 0.42, 0.03));
          tMouth.userData.at(V(0, 3.3, 0), 0, 0.06, a * win(q, 0.48, 0.56, 0.03));
        },
      };
    }),
  }),
});

/* ------------------------------------------------------------ TON 618 */

export const TON618 = event({
  id: "biggest-black-hole",
  section: "deep",
  title: "The biggest black holes: TON 618",
  place: "TON 618 · Canes Venatici · light from 10.8 billion years ago",
  kind: "ongoing",
  family: "deepSky",
  when: "Found as a quasar in 1970; weighed in 2004",
  often: "shining now",
  timeline: { last: "its light set out 10.8 billion years ago" },
  detail: "A quasar powered by a black hole of about 40 billion Suns — its edge would swallow our whole Solar System many times over",
  frequency: "A one-off: one of the heaviest black holes known",
  cause: "At the heart of most big galaxies is a supermassive black hole. In the young universe, some fed on so much gas that the gas, heated as it swirled in, outshone their whole galaxies: quasars. The heaviest weigh tens of billions of Suns.",
  note: "TON 618's black hole is estimated at about 40 billion Suns (Ge et al. 2019; older estimates up to 66 billion). Its event horizon would be about 800 times the Earth–Sun distance in radius — 25 times wider than Neptune's orbit. Phoenix A, in a galaxy cluster, may be heavier still (perhaps 100 billion Suns), but that figure is less certain.",
  accuracy: "Its place in the sky is real; 10.8 billion light-years is the time its light has travelled. The black hole is ray-traced (no spin). The Solar System drawn against it is to scale with the horizon.",
  art: { main: "blackhole", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* TON 618: RA 12h 28m 24.9s, Dec +31° 28′ 38″; z = 2.219. */
    stars: false,
    target: { name: "TON 618", short: "TON 618", ra: H(12, 28, 24.9), dec: D(31, 28, 38), ly: 10.8e9, lyText: "10.8 billion light-years (light travel)", lightTime: "10.8 billion years", where: "in Canes Venatici" },
    extragalactic: true,
    tells: [
      { at: 0, label: "A faint blue dot", text: "In Canes Venatici is a dot of light that is really a quasar, seen as it was 10.8 billion years ago." },
      { at: 0.07, label: "Across the universe", text: "We travel to it." },
      { at: 0.27, label: "A quasar", text: "Gas swirling into a giant black hole, hot enough to outshine a whole galaxy." },
      { at: 0.5, label: "About 40 billion Suns", text: "One of the heaviest black holes known." },
      { at: 0.65, label: "Our Solar System beside it", text: "Its event horizon is about 800 times the Earth–Sun distance: Neptune's orbit is a speck beside it." },
      { at: 0.86, label: "Looking back", text: "Its light set out before the Sun and Earth existed." },
    ],
    build: own({
      titles: [
        [0, ["TON 618", "a quasar"]],
        [0.35, ["The black hole", "about 40 billion Suns"]],
        [0.6, ["To scale", "our Solar System beside its horizon"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      /* Units: rs = 10 = about 800 AU (40 billion Suns × 2.95 km). */
      lensSky(ctx, g);
      const bh = blackHole(ctx, g, 10, { bound: 20, rin: 3, rout: 14, disc: 1.1, sky: 1, hot: "#ffd27a" });
      /* The quasar's jets as gas, not lines (round 90): puffs flowing out
       * along the spin axis, widening, fading with distance. */
      const NJ = 1600;
      const jr = rng(618);
      const jetP = Array.from({ length: NJ }, () => ({ s: jr() < 0.5 ? 1 : -1, u: jr(), w: gauss(jr), v: gauss(jr), ph: jr() * TAU }));
      const jetCloud = ctx.cloud(NJ, { parent: g, size: 10 });
      jetP.forEach((p, i) => { jetCloud.size[i] = 6 + 10 * jr(); jetCloud.tint(i, jr() < 0.7 ? "#bcd8ff" : "#ffffff"); });
      const jets = [{ set(t, a) {
        for (let i = 0; i < NJ; i += 1) {
          const p = jetP[i];
          const u = (p.u + t * 0.05) % 1;
          const y = 15 + u * 585;
          const wid = 2 + y * 0.04;
          jetCloud.set(i, p.w * wid + Math.sin(u * 9 + p.ph) * wid * 0.2, p.s * y, p.v * wid);
          jetCloud.alpha[i] = 0.22 * (1 - u) * (0.6 + 0.4 * Math.sin(u * 40 + p.ph));
        }
        jetCloud.commit();
        jetCloud.opacity = a;
        jetCloud.points.visible = a > 0.002;
      } }];
      const AU = 10 / 800;
      /* Neptune's orbit (30 AU), Voyager 1 (about 170 AU in 2026). */
      const nep = ctx.circle(30 * AU, { colour: "#9fd0ff", opacity: 1, parent: g, additive: false });
      const voy = ctx.circle(170 * AU, { colour: "#ffd27f", opacity: 0.8, parent: g, additive: false });
      [nep, voy].forEach((o) => { o.material.depthTest = false; o.renderOrder = 30; o.position.set(-28, 0, 0); });
      const tHole = tag(["The event horizon", "about 800 AU in radius"], { height: 0.036, colour: "#cfe2ff" });
      const tNep = tag(["Neptune's orbit", "our whole planetary system"], { height: 0.03, colour: "#9fd0ff" });
      const tVoy = tag(["Voyager 1's distance", "170 AU"], { height: 0.03, colour: "#ffd27f" });
      return {
        update(q, a, t) {
          const scaleK = smooth(q, 0.6, 0.66);
          bh.uniforms.uDisc.value = lerp(1.2, 0.3, scaleK);
          jets.forEach((j) => j.set(t, a * (1 - scaleK)));
          [nep, voy].forEach((o) => ctx.fade(o, a * scaleK));
          const dist = q < 0.6 ? lerp(700, 300, smooth(q, 0, 0.5)) : lerp(300, 90, smooth(q, 0.6, 0.8));
          const look = V(-14 * scaleK, 0, 0);
          orbitView(U, look, dist, 0.3 + q * 0.4, lerp(0.22, 1.15, scaleK));
          tHole.userData.at(V(0, 11, 0), 0, 0.06, a * smooth(q, 0.38, 0.44));
          tNep.userData.at(V(-28, 0, 0), 0.08, 0.04, a * smooth(q, 0.68, 0.72));
          tVoy.userData.at(V(-28 - 170 * AU, 0, 0), -0.04, -0.06, a * smooth(q, 0.72, 0.76));
        },
      };
    }),
    end: seen(0.3, "#cfe0ff", ["TON 618", "a faint dot — magnitude 15.9"], ["In our sky", "light from 10.8 billion years ago"], { size: 0.014 }),
  }),
});

/* ------------------------------------------------------------ white hole */

export const WHITE_HOLE = event({
  id: "white-hole",
  section: "deep",
  title: "A white hole: a black hole in reverse?",
  place: "None known · GRB 060614 was once suggested",
  kind: "theory",
  family: "deepSky",
  when: "An idea of the 1960s; GRB 060614 (2006) was suggested as one in 2012",
  often: "never seen",
  timeline: { last: "never confirmed" },
  detail: "Run a black hole backwards and you get a white hole: nothing can get in, and everything comes out. The mathematics allows it; nature may not",
  frequency: "None found. In 2012 Alon Retter and Shlomo Heller suggested the odd gamma-ray burst GRB 060614 might have been one",
  cause: "Einstein's equations work the same forwards and backwards in time. A black hole is a region nothing can leave; its time-reverse is a region nothing can enter, which only throws matter and light out. But a white hole would be unstable, and nothing we know of would make one.",
  note: "GRB 060614, seen on 14 June 2006 in a galaxy about 1.6 billion light-years away, lasted 102 seconds — a 'long' burst — yet no supernova followed, which long bursts usually have. Retter & Heller (2012) proposed it as a white hole; most astronomers think it was something else, perhaps a neutron-star merger.",
  accuracy: "A picture of an idea. GRB 060614's place and distance are real; the white hole drawn there is not a claim that one was there.",
  art: { main: "blackhole", fx: "burst" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* GRB 060614: RA 21h 23m 32.1s, Dec −53° 01′ 36″; z = 0.125. */
    target: { name: "GRB 060614", short: "GRB 060614", ra: H(21, 23, 32.1), dec: D(-53, 1, 36), ly: 1.6e9, lyText: "about 1.6 billion light-years", where: "in Indus" },
    extragalactic: true,
    tells: [
      { at: 0, label: "Time, reversed", text: "A black hole lets nothing out. Run the film backwards: a white hole lets nothing in." },
      { at: 0.07, label: "1.6 billion light-years", text: "We go to a strange gamma-ray burst some suggested might be one." },
      { at: 0.27, label: "Nothing can enter", text: "Gas falling toward a white hole would never reach it — it only pours matter and light out." },
      { at: 0.55, label: "A burst with no supernova", text: "GRB 060614 lasted 102 seconds and left no supernova behind — which puzzled astronomers." },
      { at: 0.86, label: "Looking back", text: "Most think it was something else. No white hole has ever been confirmed." },
    ],
    build: own({
      titles: [
        [0, ["A white hole (an idea)", "everything out, nothing in"]],
        [0.5, ["GRB 060614", "102 seconds of gamma rays"]],
      ],
      chart: {
        title: "GRB 060614 at Swift, 14 June 2006 (shape)",
        ticks: [[0, "0"], [0.05, "5 s"], [1, "102 s"]],
        yTicks: [[0.95, "spike"]],
        fn: curveThrough([[0, 0], [0.01, 0.95], [0.05, 0.15], [0.3, 0.35], [0.6, 0.25], [1, 0.02]]),
        colour: "#ffffff",
        from: 0.5,
        to: 0.85,
      },
    }, ({ ctx, U, g, tag }) => {
      const core = wormhole(ctx, g, 3, { white: 1 });
      const halo = flash(ctx, g, "#ffffff");
      /* Matter pouring out all the time; matter falling in turned back. */
      const N = 2000;
      const outflow = cloudOf(ctx, g, N, (r) => ({ p: V(), c: r() < 0.6 ? "#ffffff" : "#cfe2ff", a: 0.7, s: 1 }), { size: 2.2, seed: 41 });
      const dirs = Array.from({ length: N }, (_, i) => { const r = rng(i + 1); return V(gauss(r), gauss(r), gauss(r)).normalize(); });
      const phase = Array.from({ length: N }, (_, i) => (i * 0.618) % 1);
      const infall = cloudOf(ctx, g, 300, () => ({ p: V(), c: "#ffb07a", a: 0.8, s: 1.6 }), { size: 2.6, seed: 42 });
      const inDirs = Array.from({ length: 300 }, (_, i) => { const r = rng(i + 7); return V(gauss(r), gauss(r) * 0.3, gauss(r)).normalize(); });
      const blast = shock(ctx, g, "#ffffff", { power: 2, seed: 2 });
      const tCore = tag(["A white hole", "nothing can get in"], { height: 0.036, colour: "#ffffff" });
      const tIn = tag(["Gas falling toward it", "turned back before it arrives"], { height: 0.032, colour: "#ffb07a" });
      return {
        update(q, a, t) {
          for (let i = 0; i < N; i += 1) {
            const u = (phase[i] + t * 0.15) % 1;
            const r = 3 + u * 60;
            outflow.cloud.set(i, dirs[i].x * r, dirs[i].y * r, dirs[i].z * r);
          }
          outflow.cloud.commit();
          outflow.show(a * 0.9);
          for (let i = 0; i < 300; i += 1) {
            const u = (phase[i] + t * 0.2) % 1;
            /* In, slowing, then pushed back out: never reaching the core. */
            const r = 40 - 30 * Math.sin(Math.PI * u);
            infall.cloud.set(i, inDirs[i].x * r, inDirs[i].y * r, inDirs[i].z * r);
          }
          infall.cloud.commit();
          infall.show(a * win(q, 0.15, 0.5, 0.05));
          core.material.uniforms.uOpacity.value = a;
          halo.set(16, a * 0.7);
          const b = span(q, 0.5, 0.65);
          blast.set(70 * out(b), a * (q > 0.5 ? 0.45 * (1 - b) : 0));
          orbitView(U, V(), lerp(70, 55, q) + 40 * smooth(q, 0.5, 0.6), 0.3 + q * 0.6, 0.3);
          tCore.userData.at(V(0, 4, 0), 0, 0.06, a * smooth(q, 0.04, 0.08));
          tIn.userData.at(inDirs[0].clone().multiplyScalar(28), 0.04, 0.05, a * win(q, 0.18, 0.48, 0.03));
        },
      };
    }),
    end: seen(0.2, "#ffffff", ["GRB 060614", "a flash of gamma rays, June 2006"], ["In our sky", "102 seconds, and no supernova"], { size: 0.014 }),
  }),
});

/* ------------------------------------------------------------ Stephenson 2-18 */

export const BIGGEST_STAR = event({
  id: "biggest-star",
  section: "deep",
  title: "The biggest stars: Stephenson 2-18",
  place: "Stephenson 2-18 · Scutum · about 19,000 light-years",
  kind: "ongoing",
  family: "stellar",
  when: "Its size estimated in 2010–2012",
  often: "shining now",
  timeline: { last: "shining now" },
  detail: "A red supergiant perhaps 2,150 times the Sun's width — put where the Sun is, it would reach out past Saturn",
  frequency: "A one-off: among the largest stars known",
  cause: "Very massive stars near the end of their lives swell into red supergiants: their cores shrink and heat up while their outer layers balloon out, thin and cool. The biggest are thousands of times the Sun's width — but so tenuous that on average they are thinner than the air around you.",
  note: "Stephenson 2-18's radius was estimated at about 2,150 Suns (Davies et al. 2007; Wikipedia's figure) — about 10 AU, past Saturn's orbit (9.5 AU). It would not hold the whole Solar System: Uranus (19 AU) and Neptune (30 AU) are farther out. Its size is uncertain and may be smaller. Other giants: UY Scuti (about 900 Suns) and WOH G64, the first star photographed close-up in another galaxy (VLTI, 2024).",
  accuracy: "Its place and distance are real (about 5.8 kpc). The Solar System's orbits drawn round it are to the same scale as the star.",
  art: { main: "redgiant", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Stephenson 2-18: RA 18h 39m 02.4s, Dec −06° 01′ 43″; ~5.8 kpc. */
    target: { name: "Stephenson 2-18", short: "Stephenson 2-18", ra: H(18, 39, 2.4), dec: D(-6, 1, 43), ly: 19000, lyText: "about 19,000 light-years", where: "in Scutum" },
    tells: [
      { at: 0, label: "The biggest star?", text: "In a cluster in Scutum is a star that may be the largest we know." },
      { at: 0.07, label: "19,000 light-years", text: "We travel to it." },
      { at: 0.27, label: "A red supergiant", text: "Stephenson 2-18: perhaps 2,150 times as wide as the Sun." },
      { at: 0.55, label: "Our Solar System inside it", text: "Put where the Sun is, its surface would reach past Saturn's orbit." },
      { at: 0.7, label: "Not quite everything", text: "Uranus and Neptune would still be outside — and its size is uncertain." },
      { at: 0.86, label: "Looking back", text: "In our sky it is hidden by dust: invisible to the eye." },
    ],
    build: own({
      titles: [
        [0, ["Stephenson 2-18", "a red supergiant"]],
        [0.45, ["The Solar System, to scale", "Mercury to Saturn — inside it"]],
        [0.68, ["Uranus and Neptune", "still outside"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      const R = 20;
      const st = star(ctx, g, R, { colour: "#ff4a1a", hot: "#ff9050", halo: 1.8, granule: 3 });
      /* 1 AU = R / 10 (2,150 Suns × 0.00465 AU). */
      const AU = R / 10;
      const orbitsList = [["Mercury", 0.39], ["Venus", 0.72], ["Earth", 1], ["Mars", 1.52], ["Jupiter", 5.2], ["Saturn", 9.54], ["Uranus", 19.2], ["Neptune", 30.1]];
      /* Round 93 (Prompts.md: the words overlapped): smaller names, each
       * at its own angle round its orbit, the four inner ones (crowded
       * once the view pulls back) giving way to one label. */
      const angs = [2.7, 1.25, 0.15, 4.3, 0.85, 3.7, 2.2, 5.3];
      const orbits = orbitsList.map(([name, a], i) => {
        const ring = ctx.circle(a * AU, { colour: a > 10 ? "#9fd0ff" : "#ffe2a8", opacity: 0.9, parent: g, additive: false });
        ring.material.depthTest = false;
        ring.renderOrder = 30;
        return { name, a, ring, label: tag([name], { height: 0.022, colour: a > 10 ? "#9fd0ff" : "#ffe2a8" }), ang: angs[i] };
      });
      const tInner = tag(["Mercury to Mars"], { height: 0.022, colour: "#ffe2a8" });
      const sun = ctx.glow("#fff4e0", AU * 0.6, { opacity: 1, parent: g });
      sun.material.depthTest = false;
      const tStar = tag(["Stephenson 2-18", "about 2,150 times the Sun's width"], { height: 0.036, colour: "#ffb08a" });
      const tSun = tag(["The Sun, to scale", "a dot"], { height: 0.022, colour: "#fff4e0" });
      return {
        update(q, a) {
          const k = smooth(q, 0.45, 0.55);
          orbits.forEach((o) => {
            const inside = o.a < 10;
            const show = inside ? k : smooth(q, 0.66, 0.72);
            ctx.fade(o.ring, a * show);
            o.label.userData.at(V(Math.cos(o.ang) * o.a * AU, 0, -Math.sin(o.ang) * o.a * AU), 0, 0.025, a * show * (o.a < 2 ? 0 : 1));
          });
          ctx.fade(sun, a * k);
          st.material.uniforms.uOpacity.value = a * lerp(1, 0.55, k);
          st.material.depthWrite = false;
          const dist = q < 0.45 ? lerp(R * 5, R * 3.4, smooth(q, 0, 0.4)) : lerp(R * 3.6, 30 * AU * 3.1, smooth(q, 0.62, 0.72));
          orbitView(U, V(), dist, 0.4 + q * 0.3, lerp(0.2, 1.05, k));
          /* Beside the star, not above it (it ran into the title). */
          tStar.userData.at(V(0, 0, 0), -0.62, 0.42, a * smooth(q, 0.03, 0.07) * (1 - k));
          tSun.userData.at(V(0, 0, 0), 0.07, -0.07, a * k * (1 - smooth(q, 0.6, 0.66)));
          tInner.userData.at(V(0, 0, 0), 0.06, 0.04, a * k);
        },
      };
    }),
    end: seen(0, "#ff8a5a", ["Stephenson 2-18", "hidden behind dust"], ["In our sky", "toward Scutum"]),
  }),
});

/* ------------------------------------------------------------ Dyson sphere */

export const DYSON = event({
  id: "dyson-sphere",
  section: "deep",
  title: "A Dyson sphere? Tabby's star",
  place: "KIC 8462852 · Cygnus · about 1,470 light-years",
  kind: "recorded",
  family: "stellar",
  when: "Dips found 2015 (Boyajian et al.); explained 2018",
  often: "dims now and then",
  timeline: { last: "2017–2018 dips, watched worldwide" },
  detail: "A star whose light dropped by up to 22% for no obvious reason — for a while, people wondered about alien megastructures. It turned out to be dust",
  frequency: "The star dims irregularly; the biggest dips seen by Kepler were 15% (2011) and 22% (2013)",
  cause: "In 1960 Freeman Dyson suggested an advanced civilisation might surround its star with collectors to catch its energy — a 'Dyson sphere', really a swarm — and that we could look for the dimming and the waste heat. Tabby's star dimmed strangely, but the dips were deeper in blue light than red, which a solid swarm would not do and fine dust would.",
  note: "Citizen scientists of Planet Hunters spotted the dips in Kepler data; Tabetha Boyajian led the 2015 paper. In 2018 Boyajian et al. showed the dimming depends on colour: dust. In 2024 Project Hephaistos found seven other stars with too much infrared; follow-up suggested background galaxies. No Dyson sphere has been found.",
  accuracy: "Its place and distance are real. The swarm is what Dyson imagined, drawn; the dust is drawn as uneven clouds. The dips in the chart are the Kepler ones, simplified.",
  art: { main: "star", fx: "dust" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* KIC 8462852: RA 20h 06m 15.5s, Dec +44° 27′ 25″; 451 pc ≈ 1,470 ly. */
    target: { name: "Tabby's star (KIC 8462852)", short: "Tabby's star", ra: H(20, 6, 15.5), dec: D(44, 27, 25), ly: 1470, where: "in Cygnus" },
    tells: [
      { at: 0, label: "A strange star", text: "Kepler watched a star in Cygnus dim by up to 22%, irregularly — like nothing else." },
      { at: 0.07, label: "1,470 light-years", text: "We travel to Tabby's star." },
      { at: 0.27, label: "Dyson's idea", text: "In 1960 Freeman Dyson imagined a civilisation wrapping its star in a swarm of collectors." },
      { at: 0.48, label: "Would it look like this?", text: "A swarm would block starlight — but the same at every colour." },
      { at: 0.6, label: "The answer: dust", text: "The dips were deeper in blue light than red — the mark of fine dust, not machines." },
      { at: 0.86, label: "Looking back", text: "No Dyson sphere has been found. But astronomers still look." },
    ],
    build: own({
      titles: [
        [0, ["Tabby's star", "an F star a little bigger than the Sun"]],
        [0.2, ["A Dyson swarm (imagined)", "collectors round a star"]],
        [0.55, ["What it really is", "uneven clouds of dust"]],
      ],
      /* Kepler light curve, simplified (Boyajian et al. 2016): flat, a
       * 15% dip on day 793 (2011), a series ending in a 22% dip on day
       * 1519 (2013). */
      chart: {
        title: "Kepler: the star's light, 2009–2013",
        ticks: [[0, "2009"], [0.5, "2011"], [1, "2013"]],
        yTicks: [[0.92, "100%"], [0.1, "78%"]],
        fn: (u) => 0.92 - 0.55 * Math.exp(-Math.pow((u - 0.5) / 0.006, 2)) - 0.2 * Math.exp(-Math.pow((u - 0.92) / 0.008, 2)) - 0.82 * Math.exp(-Math.pow((u - 0.96) / 0.006, 2)) - 0.3 * Math.exp(-Math.pow((u - 0.985) / 0.005, 2)),
        samples: 600,
        colour: "#ffe2a8",
        from: 0.05,
        to: 0.45,
      },
    }, ({ ctx, U, g, tag }) => {
      const st = star(ctx, g, 2, { colour: "#fff0c8", hot: "#ffffff", halo: 3, granule: 16 });
      /* Round 93: bands of collectors, as in the owner's picture. */
      const sw = dysonRings(ctx, g, 6);
      const dust = cloudOf(ctx, g, 3500, (r) => {
        const clump = Math.floor(r() * 5);
        const ang = clump * 1.25 + gauss(r) * 0.25;
        const rr = 8 + clump + gauss(r) * 0.8;
        return { p: V(Math.cos(ang) * rr, gauss(r) * 0.6, -Math.sin(ang) * rr), c: "#2a2018", a: 0.45, s: 1 + r() };
      }, { size: 9, seed: 51, additive: false });
      const tStar = tag(["Tabby's star", "KIC 8462852"], { height: 0.036, colour: "#fff0c8" });
      const tSwarm = tag(["Dyson's swarm", "imagined, 1960"], { height: 0.034, colour: "#c9d6e8" });
      const tDust = tag(["Dust", "dims blue light more than red"], { height: 0.034, colour: "#d8c8b8" });
      return {
        update(q, a, t) {
          const build = smooth(q, 0.2, 0.45);
          const gone = smooth(q, 0.52, 0.58);
          sw.update(t, build, a * (1 - gone));
          dust.cloud.points.rotation.y = t * 0.05;
          dust.show(a * smooth(q, 0.55, 0.62));
          orbitView(U, V(), lerp(lerp(44, 26, smooth(q, 0.15, 0.35)), 38, smooth(q, 0.5, 0.6)), 0.3 + q * 0.5, 0.35);
          tStar.userData.at(V(0, 2.4, 0), 0, 0.05, a * smooth(q, 0.02, 0.06) * (1 - build));
          tSwarm.userData.at(V(0, 0, 0), -0.62, -0.1, a * win(q, 0.3, 0.55, 0.03));
          tDust.userData.at(V(9, 0, 0), 0.04, 0.05, a * smooth(q, 0.62, 0.66));
        },
      };
    }),
    end: seen(0.4, "#fff0c8", ["Tabby's star", "magnitude 11.7 — a telescope star"], ["In our sky", "in Cygnus, the Swan"], { size: 0.016 }),
  }),
});

/* ------------------------------------------------------------ Boötes Void */

export const BOOTES = event({
  id: "bootes-void",
  section: "deep",
  title: "The Boötes Void: the great nothing",
  place: "Boötes · about 700 million light-years",
  kind: "ongoing",
  family: "deepSky",
  when: "Found 1981 (Kirshner et al.)",
  often: "always there",
  timeline: { last: "found 1981" },
  detail: "A bubble in space about 330 million light-years across with only about 60 galaxies in it, where there would normally be thousands",
  frequency: "Voids are everywhere in the universe's web of galaxies; this is one of the biggest known",
  cause: "Galaxies are not scattered evenly. Gravity has pulled matter, over 13.8 billion years, into a web of walls and filaments around huge empty bubbles: voids. Tiny unevenness in the early universe grew into this pattern.",
  note: "Robert Kirshner and colleagues found it in 1981 while mapping galaxies' distances. If the Milky Way were in its middle, we would not have known other galaxies existed until the 1960s, said the astronomer Greg Aldering. About 60 galaxies have since been found in it (Kirshner et al. 1987; Tikhonov & Karachentsev).",
  accuracy: "Its direction and distance are real; the web of galaxies round it is drawn as a picture of the large-scale structure, not a map of the real one.",
  art: { main: "galaxy", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* The Boötes Void: centre about RA 14h 50m, Dec +46°; about 700 Mly. */
    target: { name: "The Boötes Void", short: "Boötes Void", ra: H(14, 50), dec: 46, ly: 7e8, lyText: "about 700 million light-years", where: "in Boötes" },
    extragalactic: true,
    tells: [
      { at: 0, label: "Toward Boötes", text: "Past the stars of Boötes, the herdsman, lies an enormous emptiness." },
      { at: 0.07, label: "700 million light-years", text: "We travel out among the galaxies." },
      { at: 0.27, label: "The cosmic web", text: "Galaxies gather into walls and filaments round great empty bubbles." },
      { at: 0.5, label: "The void", text: "This one is about 330 million light-years across — with only about 60 galaxies inside." },
      { at: 0.86, label: "Looking back", text: "Had we lived inside it, we might not have known other galaxies existed until the 1960s." },
    ],
    build: own({
      titles: [
        [0, ["The cosmic web", "each dot a galaxy"]],
        [0.4, ["The Boötes Void", "330 million light-years across"]],
        [0.65, ["Inside", "about 60 galaxies, far apart"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      const web = cosmicWeb(ctx, g, 420, { voidR: 165, inside: 60, count: 24000, seed: 31, size: 1.6 });
      const ring = ctx.circle(165, { plane: "xy", colour: "#ffd27f", opacity: 0.6, parent: g, additive: false, dashed: true, dash: 8, gap: 6 });
      const tVoid = tag(["The Boötes Void", "330 million light-years across"], { height: 0.038, colour: "#ffd27f" });
      const tIn = tag(["About 60 galaxies", "where there would be thousands"], { height: 0.034, colour: "#ffe2a8" });
      return {
        update(q, a, t) {
          web.show(a);
          ring.lookAt(U.eye);
          ctx.fade(ring, a * win(q, 0.4, 0.62, 0.03));
          const dist = q < 0.62 ? lerp(1500, 900, smooth(q, 0, 0.6)) : lerp(900, 60, easeInOut(span(q, 0.62, 0.95)));
          orbitView(U, V(), dist, 0.3 + q * 0.6, 0.25);
          tVoid.userData.at(V(0, 170, 0), 0, 0.05, a * win(q, 0.42, 0.62, 0.03));
          tIn.userData.at(V(0, 0, 0), 0, 0.12, a * smooth(q, 0.7, 0.76));
        },
      };
    }),
    end: seen(0, "#ffd27f", ["The Boötes Void", "an emptiness you cannot see"], ["In our sky", "beyond the stars of Boötes"]),
  }),
});

/* ------------------------------------------------------------ pulsar */

export const PULSAR = event({
  id: "pulsar",
  section: "deep",
  title: "A pulsar: the first, PSR B1919+21",
  place: "PSR B1919+21 · Vulpecula · about 2,300 light-years",
  kind: "ongoing",
  family: "stellar",
  when: "Found 28 November 1967 by Jocelyn Bell Burnell",
  often: "every 1.337 seconds",
  timeline: { last: "pulsing now" },
  detail: "A spinning neutron star sweeps two radio beams round like a lighthouse; every 1.337 seconds one of them crosses Earth",
  frequency: "Over 3,000 pulsars are known; the fastest spin more than 700 times a second",
  cause: "When a massive star's core collapses it leaves a neutron star about 20 km across, spinning fast and strongly magnetic. Beams of radio waves pour out above its magnetic poles. If the magnetic axis is tilted from the spin axis, the beams sweep round, and if one crosses Earth we see a pulse each turn.",
  note: "Jocelyn Bell Burnell, a graduate student at Cambridge, noticed 'a bit of scruff' on her chart recorder in 1967: pulses exactly 1.337 seconds apart. It was jokingly labelled LGM-1, for 'little green men'. Her supervisor Antony Hewish shared the 1974 Nobel Prize for the discovery; she did not. In 2018 she won the Breakthrough Prize and gave the $3 million to help students into physics.",
  accuracy: "Its place and distance are real. The neutron star, its field and beams are drawn; its spin is slowed to show the beams (really once every 1.337 s).",
  art: { main: "neutronstar", fx: "pulse" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* PSR B1919+21: RA 19h 21m 44.8s, Dec +21° 53′ 02″; ~700 pc. */
    target: { name: "PSR B1919+21", short: "PSR B1919+21", ra: H(19, 21, 44.8), dec: D(21, 53, 2), ly: 2300, lyText: "about 2,300 light-years", where: "in Vulpecula" },
    tells: [
      { at: 0, label: "28 November 1967", text: "Jocelyn Bell Burnell sees pulses on her chart: one every 1.337 seconds, as steady as a clock." },
      { at: 0.07, label: "2,300 light-years", text: "We travel to their source." },
      { at: 0.27, label: "A neutron star", text: "The collapsed core of a dead star: 20 km across, heavier than the Sun." },
      { at: 0.42, label: "A cosmic lighthouse", text: "Radio beams pour from its magnetic poles; as it spins, they sweep round." },
      { at: 0.6, label: "Pulse", text: "Each time a beam crosses Earth, a radio telescope hears a pulse." },
      { at: 0.86, label: "Looking back", text: "Over 3,000 pulsars are now known — some spinning 700 times a second." },
    ],
    build: own({
      titles: [
        [0, ["PSR B1919+21", "a neutron star"]],
        [0.25, ["The lighthouse", "beams from the magnetic poles"]],
        [0.5, ["Every 1.337 seconds", "a beam sweeps across Earth"]],
      ],
      chart: {
        title: "Radio pulses at Earth (one every 1.337 s)",
        ticks: [[0, "0 s"], [0.5, "5 s"], [1, "10 s"]],
        yTicks: [[0.9, "pulse"]],
        fn: (u) => 0.1 + 0.8 * Math.exp(-Math.pow((((u * 10) % 1.337) - 0.2) / 0.03, 2)),
        samples: 700,
        colour: "#9fd0ff",
        from: 0.45,
        to: 0.95,
      },
    }, ({ ctx, U, g, tag }) => {
      const ns = neutronStar(ctx, g, 1, { tilt: 0.75, beamLen: 40, field: true, reach: [2.5, 4, 7] });
      /* Round 93 (Prompts.md: "the conical shape over the star, top and
       * bottom -- make it realistic, like gas emission"): no cones. Out of
       * each magnetic pole streams plasma along the open field lines, the
       * radio light coming from it (Goldreich & Julian 1969): glowing gas
       * in a widening beam, sweeping round with the star. And the star a
       * real neutron-star surface. */
      ns.beams.forEach((b) => { b.cone.visible = false; b.core.visible = false; ctx.fade(b.cone, 0); ctx.fade(b.core, 0); });
      ns.ball.visible = false;
      ctx.fade(ns.ball, 0);
      const surf = realStar(ctx, ns.spin, 1, "ns", { crack: 0.5 });
      const plasma = particleJet(ctx, ns.mag, 40, { count: 2600, width: 0.13, colour: "#9fd0ff", core: "#e8f4ff", seed: 61, size: 10, speed: 0.9 });
      const earthDir = V(-1, 0.25, 0.25).normalize();
      const toEarth = ctx.line([earthDir.clone().multiplyScalar(3), earthDir.clone().multiplyScalar(60)], { colour: "#9fd0ff", opacity: 0.6, dashed: true, dash: 1, gap: 0.6, parent: g, additive: false });
      const ping = flash(ctx, g, "#cfe8ff");
      const tNs = tag(["Neutron star", "20 km across, 1.4 Suns"], { height: 0.034, colour: "#cfe2ff" });
      const tBeam = tag(["Radio beam", "from a magnetic pole"], { height: 0.034, colour: "#9fd0ff" });
      const tEarth = tag(["To Earth"], { height: 0.032, colour: "#9fd0ff" });
      const tPulse = tag(["Pulse!"], { height: 0.04, colour: "#ffffff" });
      return {
        update(q, a, t) {
          ns.update(t, 0.25);
          surf.material.uniforms.uOpacity.value = a;
          surf.visible = a > 0.002;
          if (surf.userData.halo) ctx.fade(surf.userData.halo, a);
          plasma.set(t, a * smooth(q, 0.2, 0.28), 1);
          const axis = ns.axis();
          const hit = Math.max(0, axis.dot(earthDir), -axis.dot(earthDir));
          const pulse = smooth(hit, 0.93, 0.99);
          ping.sprite.position.copy(earthDir.clone().multiplyScalar(40));
          ping.set(6, a * pulse * smooth(q, 0.45, 0.5));
          ctx.fade(toEarth, a * smooth(q, 0.45, 0.5));
          orbitView(U, V(), lerp(70, 60, q), 0.6 + q * 0.3, 0.3);
          tNs.userData.at(V(0, -1.5, 0), 0, -0.05, a * smooth(q, 0.03, 0.07));
          tBeam.userData.at(axis.clone().multiplyScalar(25), 0.04, 0.04, a * win(q, 0.25, 0.48, 0.03));
          tEarth.userData.at(earthDir.clone().multiplyScalar(50), 0, -0.05, a * smooth(q, 0.45, 0.5));
          tPulse.userData.at(earthDir.clone().multiplyScalar(40), 0, 0.08, a * pulse * smooth(q, 0.5, 0.55));
        },
      };
    }),
    end: seen(0, "#9fd0ff", ["PSR B1919+21", "heard by radio telescopes, not seen"], ["In our sky", "a pulse every 1.337 seconds"]),
  }),
});

/* ------------------------------------------------------------ Kepler-186f */

export const KEPLER186F = event({
  id: "kepler-186f",
  section: "deep",
  title: "An Earth-sized world: Kepler-186f",
  place: "Kepler-186 · Cygnus · about 580 light-years",
  kind: "ongoing",
  family: "planetary",
  when: "Announced 17 April 2014 (Quintana et al., Science)",
  often: "a year of 130 days",
  timeline: { last: "announced April 2014" },
  detail: "The first planet found that is about Earth's size and in its star's 'habitable zone', where water could be liquid",
  frequency: "Thousands of exoplanets are known; a few dozen are rocky and in their star's habitable zone",
  cause: "NASA's Kepler telescope watched 150,000 stars for the tiny dip in light when a planet crosses its star. Kepler-186 has five: the outermost, f, is 1.17 times Earth's width and goes round every 130 days, at the cool edge of the zone where a planet like Earth could keep liquid water.",
  note: "Kepler-186 is a red dwarf, about half the Sun's mass, so its habitable zone is close in; f gets about a third of the sunlight Earth does. Whether it has air or water is not known. Other Earth-sized worlds in their stars' habitable zones: TRAPPIST-1 e, f and g (2017), Proxima b (2016), and TOI-700 d (2020).",
  accuracy: "The system's layout is real (orbit sizes, from Quintana et al. 2014); the planets are enlarged. What 186f looks like is unknown: the oceans and clouds here are a guess.",
  art: { main: "earth", second: "star", fx: "orbit" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Kepler-186: RA 19h 54m 36.7s, Dec +43° 57′ 18″; Gaia: 178 pc =
     * 580 ly. */
    target: { name: "Kepler-186", short: "Kepler-186", ra: H(19, 54, 36.7), dec: D(43, 57, 18), ly: 580, where: "in Cygnus" },
    tells: [
      { at: 0, label: "April 2014", text: "Kepler finds a planet the size of Earth, at the right distance from its star for liquid water." },
      { at: 0.07, label: "580 light-years", text: "We travel to Kepler-186." },
      { at: 0.27, label: "Five planets", text: "A red dwarf with five planets — four close in and hot, and one farther out: f." },
      { at: 0.45, label: "The habitable zone", text: "The band where a planet like Earth could keep liquid water. Kepler-186f is in it." },
      { at: 0.62, label: "Kepler-186f", text: "1.17 times Earth's width; a year of 130 days; a third of Earth's sunlight." },
      { at: 0.86, label: "Looking back", text: "Whether it has air, or water, or life, no one knows yet." },
    ],
    build: own({
      titles: [
        [0, ["Kepler-186", "a red dwarf and five planets"]],
        [0.3, ["The habitable zone", "where water could be liquid"]],
        [0.5, ["Kepler-186f", "Earth-sized — what it is like, unknown"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      const st = star(ctx, g, 1.2, { colour: "#ff8a4a", hot: "#ffc08a", halo: 3, granule: 12 });
      /* Orbits (AU, Quintana et al. 2014): b 0.0378, c 0.0574, d 0.0861,
       * e 0.1216, f 0.432; drawn at 40 units per AU, the inner four
       * spread out (×2.2) so they can be seen. */
      const S = 40;
      const pl = [["b", 0.0378 * 2.2, 3.89], ["c", 0.0574 * 2.2, 7.27], ["d", 0.0861 * 2.2, 13.3], ["e", 0.1216 * 2.2, 22.4], ["f", 0.432, 129.9]].map(([n, a, P], i) => {
        const ring = ctx.circle(a * S, { colour: n === "f" ? "#9fffc8" : "#9fb3c8", opacity: n === "f" ? 0.8 : 0.35, parent: g });
        const ball = planet(ctx, g, n === "f" ? 0.9 : 0.5, n === "f" ? { a: "#2a5a9a", b: "#3a7ab8", c: "#e8f0f8", bands: 2, rim: "#9fd0ff", rimK: 0.9, seed: 4.1 } : { a: "#8a5a3a", b: "#c08a5a", c: "#6a4a3a", bands: 3, rim: "#ffb08a", rimK: 0.3, seed: 1 + i });
        return { n, a, P, ring, ball, ph: i * 1.3 };
      });
      /* The habitable zone, 0.22–0.40 AU here, a green band (after
       * Quintana et al.'s figure; f sits at its cool outer edge). */
      const hz = ctx.ring(0.22 * S, 0.44 * S, { colour: "#4aff9a", opacity: 0.12, parent: g, additive: true });
      const tF = tag(["Kepler-186f", "1.17 × Earth · year 130 days"], { height: 0.036, colour: "#9fffc8" });
      const tHz = tag(["Habitable zone", "liquid water possible"], { height: 0.034, colour: "#4aff9a" });
      const tGuess = tag(["What it looks like is a guess"], { height: 0.03, colour: "#9fb3c8" });
      const fPos = V();
      return {
        update(q, a, t) {
          pl.forEach((p) => {
            const ang = p.ph + (t * 4) / p.P;
            p.ball.position.set(Math.cos(ang) * p.a * S, 0, -Math.sin(ang) * p.a * S);
            p.ball.userData.setLight(V());
            p.ball.rotation.y = t * 0.2;
            if (p.n === "f") fPos.copy(p.ball.position);
          });
          ctx.fade(hz, a * smooth(q, 0.3, 0.38));
          const close = smooth(q, 0.5, 0.6);
          const look = fPos.clone().multiplyScalar(close);
          orbitView(U, look, lerp(lerp(52, 40, q / 0.5), 4.2, close), 0.4 + q * 0.4, lerp(0.75, 0.2, close));
          tF.userData.at(fPos.clone().add(V(0, 1.3, 0)), 0, 0.05, a * smooth(q, 0.15, 0.2));
          tHz.userData.at(V(0, 0, -0.33 * S), 0, 0.04, a * win(q, 0.32, 0.5, 0.03));
          tGuess.userData.at(fPos.clone().add(V(0, -1.2, 0)), 0, -0.05, a * smooth(q, 0.6, 0.66));
        },
      };
    }),
    end: seen(0, "#ff8a4a", ["Kepler-186", "magnitude 15 — far too faint to see"], ["In our sky", "in Cygnus"]),
  }),
});

/* ------------------------------------------------------------ Heart Nebula */

export const HEART = event({
  id: "heart-nebula",
  section: "deep",
  title: "A heart in space: the Heart Nebula",
  place: "IC 1805 · Cassiopeia · about 7,500 light-years",
  kind: "ongoing",
  family: "deepSky",
  when: "Catalogued 1890s (IC 1805)",
  often: "glowing now",
  timeline: { last: "glowing now" },
  detail: "A cloud of glowing hydrogen about 200 light-years across, shaped — from where we stand — like a heart",
  frequency: "Shining for a few million years, while the hot stars at its centre last",
  cause: "At its heart is a young cluster, Melotte 15, with stars dozens of times the Sun's mass. Their ultraviolet light strips electrons from the hydrogen around them; when the electrons are recaptured, the gas glows red (the hydrogen-alpha line). Their winds carve out the cavity and sculpt the walls.",
  note: "The heart shape is a matter of where we stand: from another direction it would look quite different, as the 3D view shows. Its neighbour, the Soul Nebula (IC 1848), makes a pair often called 'Heart and Soul'.",
  accuracy: "Its place and distance are real; the cloud is drawn in 3D as a shell round the cluster that looks like a heart only from Earth's side.",
  art: { main: "nebula", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* IC 1805: RA 02h 33m 22s, Dec +61° 26′ 36″; ~2.3 kpc ≈ 7,500 ly. */
    target: { name: "The Heart Nebula (IC 1805)", short: "Heart Nebula", ra: H(2, 33, 22), dec: D(61, 26, 36), ly: 7500, where: "in Cassiopeia" },
    tells: [
      { at: 0, label: "A heart in Cassiopeia", text: "Long-exposure photographs show a glowing heart beside Cassiopeia." },
      { at: 0.07, label: "7,500 light-years", text: "We travel to it." },
      { at: 0.27, label: "Glowing hydrogen", text: "A cloud of hydrogen 200 light-years across, lit up red by hot young stars at its centre." },
      { at: 0.5, label: "Only from here", text: "Fly round it, and the heart disappears: its shape depends on where you stand." },
      { at: 0.86, label: "Looking back", text: "Too faint for the eye, it is a favourite of photographers." },
    ],
    build: own({
      titles: [
        [0, ["The Heart Nebula", "as seen from Earth's side"]],
        [0.35, ["The cluster at its heart", "Melotte 15: stars of up to 50 Suns"]],
        [0.5, ["From the side", "no heart at all"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      /* A heart outline (the classic curve) in the x–y plane, the side
       * facing +z (toward the camera at the start). The cloud is a shell
       * round the cluster whose rim, seen from +z, traces that curve. */
      const heart = (t) => V(16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t), 0);
      const cloud = cloudOf(ctx, g, 14000, (r) => {
        const t = r() * TAU;
        const p = heart(t).multiplyScalar(3.2);
        const rimPart = r() < 0.6;
        const inward = rimPart ? 0.78 + 0.22 * r() : Math.sqrt(r()) * 0.8;
        p.multiplyScalar(inward);
        /* Lumpy, and deep: a shell round the cluster, not a flat cut-out. */
        const lump = 0.5 + 0.5 * Math.sin(t * 7 + r() * 0.5) * Math.sin(t * 3.3);
        p.z = gauss(r) * (rimPart ? 30 : 22);
        p.x += gauss(r) * 5; p.y += gauss(r) * 5;
        const c = r() < 0.85 ? (r() < 0.5 ? "#ff3a5a" : "#ff6a6a") : "#ffb0a0";
        return { p, c, a: (rimPart ? 0.16 + 0.3 * r() : 0.05 + 0.12 * r()) * (0.5 + 0.7 * lump), s: rimPart ? 1.3 : 2.2 };
      }, { size: 3.4, seed: 61 });
      const lanes = cloudOf(ctx, g, 1500, (r) => {
        const t = r() * TAU;
        const p = heart(t).multiplyScalar(3.2 * (0.9 + 0.12 * r()));
        p.z = 6 + gauss(r) * 4;
        return { p, c: "#120608", a: 0.6 * r(), s: 2 };
      }, { size: 4, seed: 62, additive: false });
      const cluster = cloudOf(ctx, g, 60, (r) => ({ p: V(gauss(r) * 4, 6 + gauss(r) * 4, gauss(r) * 4), c: "#cfe2ff", a: 1, s: 1.5 + r() * 2 }), { size: 3, seed: 63 });
      const glowC = ctx.glow("#cfe2ff", 16, { opacity: 0.5, parent: g });
      glowC.position.set(0, 6, 0);
      const tCl = tag(["Melotte 15", "young, hot, blue stars"], { height: 0.034, colour: "#cfe2ff" });
      const tNeb = tag(["Glowing hydrogen", "about 200 light-years across"], { height: 0.036, colour: "#ff8a9a" });
      return {
        update(q, a) {
          cloud.show(a);
          lanes.show(a * 0.8);
          cluster.show(a);
          ctx.fade(glowC, a);
          /* Face-on (the heart), then round to the side. */
          const side = smooth(q, 0.5, 0.75);
          orbitView(U, V(0, 0, 0), lerp(190, 140, smooth(q, 0.25, 0.45)), lerp(0, 1.5, side), lerp(0.02, 0.2, side));
          tCl.userData.at(V(0, 6, 0), 0.05, 0.05, a * win(q, 0.3, 0.5, 0.03));
          tNeb.userData.at(V(0, 50, 0), 0, 0.05, a * win(q, 0.05, 0.3, 0.03));
        },
      };
    }),
    end: seen(0, "#ff6a7a", ["The Heart Nebula", "too faint for the eye"], ["In our sky", "beside Cassiopeia"]),
  }),
});

/* ------------------------------------------------------------ galaxy types */

export const GALAXY_TYPES = event({
  id: "galaxy-types",
  section: "deep",
  title: "The kinds of galaxies",
  place: "From the Large Magellanic Cloud to the Virgo Cluster",
  kind: "ongoing",
  family: "galactic",
  when: "Sorted by Edwin Hubble, 1926",
  often: "two trillion galaxies, roughly",
  timeline: { last: "Hubble's classes, 1926" },
  detail: "Spirals, barred spirals, ellipticals, lenticulars and irregulars — Edwin Hubble's 'tuning fork' of the shapes of galaxies",
  frequency: "The observable universe may hold about two trillion galaxies (Conselice et al. 2016)",
  cause: "A galaxy's shape tells its history. Spirals are discs of stars, gas and dust, still forming stars in their arms. Ellipticals are balls of old stars, often the result of galaxies merging. Lenticulars are discs that have used up their gas. Irregulars have been pulled out of shape, often by a neighbour.",
  note: "In 1926 Edwin Hubble sorted galaxies into ellipticals (E0–E7), spirals (Sa–Sc) and barred spirals (SBa–SBc), with lenticulars (S0) where the two branches meet — his 'tuning fork'. Examples here: M87 (elliptical), the Sombrero, M104 (spiral/lenticular), the Whirlpool, M51 (spiral), NGC 1300 (barred spiral) and the Large Magellanic Cloud (irregular).",
  accuracy: "The galaxies are drawn in 3D to the type of each named example, not to their real sizes or distances from each other.",
  art: { main: "galaxy", second: "galaxy", fx: "spiral" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* M87, the giant elliptical at the Virgo Cluster's heart: RA 12h 30m
     * 49.4s, Dec +12° 23′ 28″; 16.4 Mpc ≈ 54 Mly. */
    target: { name: "The Virgo Cluster (M87)", short: "Virgo Cluster", ra: H(12, 30, 49.4), dec: D(12, 23, 28), ly: 54e6, lyText: "54 million light-years", where: "in Virgo" },
    extragalactic: true,
    tells: [
      { at: 0, label: "Island universes", text: "Every faint smudge among the stars may be a galaxy of billions of stars." },
      { at: 0.07, label: "Out of the Milky Way", text: "We travel out among the galaxies." },
      { at: 0.27, label: "Spirals", text: "Discs of stars and gas with arms where new stars form — like the Whirlpool, M51." },
      { at: 0.4, label: "Barred spirals", text: "A bar of stars across the middle — like NGC 1300, and our own Milky Way." },
      { at: 0.53, label: "Ellipticals", text: "Smooth balls of old stars, often made by mergers — like M87." },
      { at: 0.66, label: "Lenticulars and irregulars", text: "Discs that have run out of gas; and shapeless galaxies, like the Large Magellanic Cloud." },
      { at: 0.86, label: "Looking back", text: "Edwin Hubble sorted them this way in 1926. There may be two trillion galaxies." },
    ],
    build: own({
      titles: [
        [0, ["Spiral", "the Whirlpool, M51"]],
        [0.11, ["Barred spiral", "NGC 1300 — and the Milky Way"]],
        [0.33, ["Elliptical", "M87"]],
        [0.55, ["Lenticular", "a disc with no arms"]],
        [0.77, ["Irregular", "the Large Magellanic Cloud"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      const kinds = [
        ["spiral", "Spiral (Sc)", "M51, the Whirlpool", { arms: 2, pitchDeg: 18 }, [0.6, 0, 0.3]],
        ["barred", "Barred spiral (SBb)", "NGC 1300", { arms: 2, pitchDeg: 12 }, [0.9, 0.4, 0]],
        ["elliptical", "Elliptical (E1)", "M87", { axes: [1, 0.9, 0.85], count: 7000 }, [0, 0, 0]],
        ["lenticular", "Lenticular (S0)", "a disc, no arms", { count: 5000 }, [1.25, 0.3, 0.2]],
        ["irregular", "Irregular", "the Large Magellanic Cloud", { count: 4000 }, [0.4, 0.8, 0]],
      ];
      const spacing = 140;
      const gals = kinds.map(([type, name, ex, opts, tilt], i) => {
        const holder = new THREE.Group();
        g.add(holder);
        holder.position.set(i * spacing, 0, 0);
        holder.rotation.set(tilt[0], tilt[1], tilt[2]);
        const gx = galaxy(ctx, holder, type, 50, { count: 6000, seed: 7 + i * 3, size: 2, ...opts });
        const label = tag([name, ex], { height: 0.038, colour: "#ffe2b0" });
        return { holder, gx, label, x: i * spacing };
      });
      return {
        update(q, a, t) {
          const pos = clamp01(q / 0.88) * 4;
          const x = pos * spacing;
          gals.forEach((gl, i) => {
            gl.holder.rotation.y += 0.002;
            gl.gx.show(a * clamp01(1.4 - Math.abs(pos - i)));
            gl.label.userData.at(V(gl.x, -58, 0), 0, -0.06, a * clamp01(1 - Math.abs(pos - i) * 1.6));
          });
          orbitView(U, V(x, 0, 0), 175, 0.25 + 0.2 * Math.sin(q * 6), 0.3);
        },
      };
    }),
    end: seen(0.3, "#ffe2b0", ["The Virgo Cluster", "about 1,300 galaxies, 54 million light-years away"], ["In our sky", "faint smudges in Virgo"], { size: 0.03 }),
  }),
});

/* ------------------------------------------------------------ J1407b */

export const J1407B = event({
  id: "j1407b-rings",
  section: "deep",
  title: "J1407b: the planet with giant rings",
  place: "J1407 (V1400 Centauri) · Centaurus · about 450 light-years",
  kind: "recorded",
  family: "planetary",
  when: "The eclipse of April–June 2007, found in 2012",
  often: "once seen",
  timeline: { last: "April–June 2007" },
  detail: "For 56 days in 2007 a young star was blacked out in a flickering pattern by something passing in front: a ring system about 180 million km across — 640 times Saturn's",
  frequency: "Seen once. Its orbit, if it has one round J1407, would take decades",
  cause: "Eric Mamajek and colleagues found a long, complex eclipse in the records of the SuperWASP survey: the star dimmed by up to 95%, flickering in and out over weeks. The best explanation is a giant ring system round an unseen body — a large planet or small brown dwarf — passing in front of the star. A gap in the rings may have been cleared by a moon.",
  note: "Kenworthy & Mamajek (2015) fitted 37 rings out to about 90 million km (0.6 AU) in radius; put round Saturn, they would look larger than the full Moon in our sky. In 2024 ALMA spotted a possible candidate for the ringed object — drifting free, not orbiting the star (Kenworthy et al.). Its rings may be a disc where moons are forming.",
  accuracy: "Its place and distance are real (about 138 pc). The rings follow the 2015 fit in outline; the body inside and its rings are drawn, not to scale with the star's distance.",
  art: { main: "saturn", second: "star", fx: "eclipse" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* J1407 = V1400 Cen: RA 14h 07m 47.9s, Dec −39° 45′ 42.7″; 138 pc. */
    target: { name: "J1407 (V1400 Centauri)", short: "J1407", ra: H(14, 7, 47.9), dec: D(-39, 45, 43), ly: 450, lyText: "about 450 light-years", where: "in Centaurus" },
    tells: [
      { at: 0, label: "2007", text: "A young star in Centaurus flickers and nearly vanishes, again and again, for 56 days." },
      { at: 0.07, label: "450 light-years", text: "We travel to it." },
      { at: 0.27, label: "Giant rings", text: "Something passed in front of it: a ring system 180 million km across, round a hidden body." },
      { at: 0.5, label: "640 times Saturn's", text: "Saturn's rings, beside them, would be a speck." },
      { at: 0.62, label: "The eclipse", text: "As the rings crossed the star, each ring and gap dimmed it differently: the flicker in the light." },
      { at: 0.86, label: "Looking back", text: "Put round Saturn, rings like these would look bigger than the full Moon from Earth." },
    ],
    build: own({
      titles: [
        [0, ["J1407b", "a giant ring system"]],
        [0.45, ["Saturn's rings, to scale", "a speck"]],
        [0.6, ["Crossing the star", "the 2007 eclipse"]],
      ],
      /* SuperWASP/ASAS light curve, simplified (Mamajek et al. 2012):
       * 56 days of deep, rapid dips. */
      chart: {
        title: "J1407's light, April–June 2007",
        ticks: [[0, "Apr"], [0.5, "May"], [1, "Jun"]],
        yTicks: [[0.92, "100%"], [0.1, "5%"]],
        fn: (u) => (u < 0.08 || u > 0.92 ? 0.92 : 0.92 - (0.25 + 0.55 * Math.abs(Math.sin(u * 37)) * Math.abs(Math.sin(u * 11))) * Math.sin(Math.PI * (u - 0.08) / 0.84)),
        samples: 500,
        colour: "#ffe2a8",
        from: 0.6,
        to: 0.84,
      },
    }, ({ ctx, U, g, tag }) => {
      /* Units: ring outer radius 30 = 90 million km.
       * Round 91 (the owner's two pictures of J1407b -- artists' views
       * after Kenworthy & Mamajek 2015): a pale, cream-coloured giant
       * planet with faint bands, inside a great many sharp-edged rings of
       * grey-beige ice and dust, bright and dark by turns, with a wide gap
       * part-way out (perhaps cleared by a moon). */
      const bodyP = planet(ctx, g, 1.2, { a: "#efe4cc", b: "#d4c4a4", c: "#fbf5e6", bands: 7, rim: "#dfe8ff", rimK: 0.25, glowK: 0, seed: 3.3 });
      const rr = rng(7);
      /* 37 rings (Kenworthy & Mamajek 2015), each with its own width,
       * density and shade; dark gaps between. */
      const bands = [];
      let edge = 0;
      while (bands.length < 37) {
        const w = 0.012 + 0.03 * rr();
        const gapW = rr() < 0.35 ? 0.002 + 0.01 * rr() : 0.001;
        bands.push({ from: edge, to: edge + w, op: 0.35 + 0.6 * rr(), shade: rr() });
        edge += w + gapW;
      }
      const fit = 1 / edge;
      const cLight = new THREE.Color("#ece2cf");
      const cMid = new THREE.Color("#b8aa92");
      const cDark = new THREE.Color("#7a6e60");
      const cc = new THREE.Color();
      const rings = ringSystem(ctx, g, 3, 30, (u) => {
        if (u > 0.6 && u < 0.66) return [0, 0, 0, 0, 1];
        const b = bands.find((x) => u >= x.from * fit && u < x.to * fit);
        if (!b) return [0.05, 0.5, 0.45, 0.4, 1];
        cc.copy(cMid).lerp(b.shade > 0.5 ? cLight : cDark, Math.abs(b.shade - 0.5) * 2);
        const fine = 0.85 + 0.15 * Math.sin(u * 1400) * Math.sin(u * 377);
        return [b.op * fine, cc.r, cc.g, cc.b, 1];
      }, { opacity: 0.92 });
      const tilt = new THREE.Group();
      g.add(tilt);
      tilt.add(rings);
      tilt.add(bodyP);
      /* Tilted about 70° to the line of sight at the eclipse, as fitted
       * (Kenworthy & Mamajek 2015: inclination ~70°). */
      tilt.rotation.set(0.35, 0, 0.6);
      const tiltQ = new THREE.Quaternion();
      /* Saturn's rings to scale: outer edge of the A ring 137,000 km =
       * 0.046 units. */
      const sat = ctx.circle(0.046 * 6, { colour: "#ffe2a8", opacity: 1, parent: g, additive: false });
      sat.material.depthTest = false;
      sat.renderOrder = 30;
      sat.position.set(34, 0, 0);
      /* The star, far behind. */
      const st = star(ctx, g, 2.5, { colour: "#ffd2a0", hot: "#ffffff", halo: 3, granule: 14 });
      st.position.set(0, 0, -200);
      const tPlanet = tag(["J1407b", "a giant planet or brown dwarf, hidden"], { height: 0.034, colour: "#ffe2c0" });
      const tRings = tag(["The rings", "37 of them, 180 million km across"], { height: 0.036, colour: "#ffe2c0" });
      const tGap = tag(["A gap", "cleared by a moon?"], { height: 0.032, colour: "#ffe2c0" });
      const tSat = tag(["Saturn's rings", "to the same scale"], { height: 0.03, colour: "#ffe2a8" });
      return {
        update(q, a, t) {
          /* Light from the star, in the planet's own frame. */
          tiltQ.setFromEuler(tilt.rotation).invert();
          bodyP.userData.setLight(V(0, 0, -200).sub(tilt.position).applyQuaternion(tiltQ));
          bodyP.rotation.y = t * 0.1;
          ctx.fade(sat, a * win(q, 0.45, 0.62, 0.03));
          /* Eclipse: we look from the far side toward the star with the
           * rings sliding across it. */
          const ecl = smooth(q, 0.58, 0.66);
          const slide = lerp(-45, 45, span(q, 0.6, 0.86));
          g.position.set(0, 0, 0);
          tilt.position.set(ecl * slide, 0, 0);
          /* Round 91 ("zoomed in, zoomed out to that planet"): close on the
           * planet and its inner rings first, then out to the whole
           * system, in again a little for Saturn's, then the eclipse. */
          const close = 1 - smooth(q, 0.1, 0.3);
          const far = lerp(110, 75, smooth(q, 0.3, 0.42)) * lerp(1, 0.5, smooth(q, 0.45, 0.5));
          const dist = lerp(far, 7.5, close);
          if (ecl < 0.5) orbitView(U, V(), dist, 0.5 + q * 0.4 + 0.6 * close, lerp(0.45, 0.3, close));
          else U.view(V(0, 2, 120), V(0, 0, -200));
          tPlanet.userData.at(V(0, 1.5, 0), 0, 0.06, a * win(q, 0.02, 0.12, 0.02));
          tRings.userData.at(V(0, 26, 0), 0, 0.05, a * win(q, 0.24, 0.42, 0.03));
          tGap.userData.at(V(19, 0, 0), 0.04, 0.04, a * win(q, 0.26, 0.42, 0.03));
          tSat.userData.at(V(34, 0, 0), 0, 0.05, a * win(q, 0.47, 0.62, 0.03));
        },
      };
    }),
    end: seen(0.3, "#ffe2a8", ["J1407", "magnitude 12.3 — a telescope star"], ["In our sky", "in Centaurus"], { size: 0.016 }),
  }),
});

/* ------------------------------------------------------------ Horsehead */

export const HORSEHEAD = event({
  id: "horsehead-nebula",
  section: "deep",
  title: "The Horsehead Nebula",
  place: "Barnard 33 · Orion · about 1,375 light-years",
  kind: "ongoing",
  family: "deepSky",
  when: "Discovered 1888 by Williamina Fleming",
  often: "there now — slowly eroding",
  timeline: { last: "found 1888" },
  detail: "A dark cloud of dust shaped like a horse's head, standing out against glowing hydrogen behind it",
  frequency: "It will last perhaps 5 million years more before the starlight wears it away",
  cause: "The Horsehead is a pillar of cold gas and dust at the edge of a huge cloud in Orion. Behind it, gas (IC 434) glows red, lit by the hot star Sigma Orionis. The dust in the Horsehead blocks that light, so we see its silhouette. Ultraviolet light from Sigma Orionis is slowly eroding it.",
  note: "Williamina Fleming, working at Harvard College Observatory, found it in 1888 on a photographic plate. It is about 3.5 light-years tall. Its sharpest portrait is the Euclid space telescope's (ESA, 2023).",
  accuracy: "Its place and distance are real. The nebula is drawn in 3D after Euclid's view (ESA, 2023): its own colours, given depth by what each part is -- the glowing gas behind, the dust in front. The depths are a reasoned guess, not a measurement.",
  art: { main: "nebula", fx: "dust" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Barnard 33: RA 05h 40m 59s, Dec −02° 27′ 30″; ~422 pc ≈ 1,375 ly. */
    target: { name: "The Horsehead Nebula (Barnard 33)", short: "The Horsehead", ra: H(5, 40, 59), dec: D(-2, 27, 30), ly: 1375, where: "in Orion" },
    tells: [
      { at: 0, label: "Below Orion's Belt", text: "Just below Orion's Belt, near the star Alnitak, is the Horsehead." },
      { at: 0.07, label: "1,375 light-years", text: "We travel to it." },
      { at: 0.27, label: "Glowing gas", text: "A wall of hydrogen glows red, lit by the hot star Sigma Orionis." },
      { at: 0.4, label: "A dark cloud in front", text: "Cold dust blocks that glow — and from here, it looks like a horse's head." },
      { at: 0.7, label: "Seen by Euclid", text: "This is the Euclid space telescope's view of it (2023), built in depth." },
      { at: 0.86, label: "Looking back", text: "Too faint for the eye, it was found on a photograph by Williamina Fleming in 1888." },
    ],
    build: own({
      titles: [
        [0, ["The Horsehead Nebula", "Barnard 33, a pillar of dark dust"]],
        [0.3, ["In 3D", "the dust in front, the glowing gas behind"]],
        [0.7, ["The Horsehead today", "as the Euclid telescope saw it, built in depth"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      /*
       * Round 90 (Prompts.md: "replicate the image's design ... experience
       * it, not look at a picture"): the nebula rebuilt in 3D from the
       * Euclid photograph you supplied (ESA, 2023). Every patch of it is a
       * glowing point with its own colour, set at a depth by what it is:
       * the bluish glowing gas of IC 434 farthest, the dust nearer, the
       * darkest dust (the horse's head and the cloud below) nearest. As
       * the camera moves the layers slide past each other.
       */
      const neb = imageNebula(ctx, g, deepAsset("horsehead-nebula.jpg"), 200, { mode: "layers", additive: false, step: 4, depth: 0.3, keep: 9, sizeK: 2.4, gain: 1.0, seed: 74, backfill: "#5a3a78", gas: 1 });
      /* Where things are in the picture (by eye from the photograph):
       * the head about 37% across and 44% of the way down. */
      const head = V(-25, 11, 9);
      const tHead = tag(["The Horsehead", "cold dust, 3.5 light-years tall"], { height: 0.036, colour: "#ffe2d0" });
      const tWall = tag(["IC 434", "glowing hydrogen, behind"], { height: 0.034, colour: "#cfc4ff" });
      const tDust = tag(["Dust in front", "lit by the stars of Orion"], { height: 0.034, colour: "#ffc8a0" });
      return {
        update(q, a, t) {
          neb.show(a, 1);
          /* Face-on and far, closer, then round one side and the other so
           * the layers move apart, then face-on again. */
          const swing = 0.26 * Math.sin(span(q, 0.25, 0.75) * Math.PI * 2) * win(q, 0.25, 0.8, 0.06);
          const dist = lerp(lerp(140, 96, smooth(q, 0, 0.3)), 120, smooth(q, 0.75, 0.9));
          orbitView(U, V(0, 4, 0), dist, swing, 0.04 + 0.08 * Math.abs(swing));
          tHead.userData.at(head, 0.06, 0.06, a * win(q, 0.08, 0.68, 0.04));
          tWall.userData.at(V(-53, 38, -30), 0, 0.04, a * win(q, 0.12, 0.68, 0.04));
          tDust.userData.at(V(-35, -35, 15), 0, -0.04, a * win(q, 0.3, 0.68, 0.04));
        },
      };
    }),
    end: seen(0, "#ff8aa0", ["The Horsehead Nebula", "just below Orion's Belt — too faint for the eye"], ["In our sky", "beside Alnitak"]),
  }),
});

/* ------------------------------------------------------------ PSO J318.5−22 */

export const ROGUE = event({
  id: "rogue-planet",
  section: "deep",
  title: "A planet with no star: PSO J318.5−22",
  place: "PSO J318.5−22 · Capricornus · about 80 light-years",
  kind: "ongoing",
  family: "planetary",
  when: "Found 2013 by the Pan-STARRS 1 telescope",
  often: "drifting now",
  timeline: { last: "found October 2013" },
  detail: "A young gas giant, about 8 times Jupiter's mass, drifting through space on its own — no star to circle",
  frequency: "There may be billions of such free-floating planets in the Milky Way; dozens have been found",
  cause: "A planet can end up alone in two ways: it can form on its own, from a small collapsing cloud of gas, like a failed star; or it can be born round a star and flung out by a close pass with another planet. Which happened to PSO J318.5−22 is not known.",
  note: "It is only about 23 million years old — a member of the Beta Pictoris moving group of young stars — so it still glows dull red with the heat of its forming. It was NOT ejected from our Solar System: it is about 80 light-years away, and our planets are all accounted for. Michael Liu and colleagues announced it in 2013 (Liu et al., ApJ Letters); its mass was later put at about 8 Jupiters (Allers et al. 2016).",
  accuracy: "Its place and distance are real (22 pc). The young planetary system that flings a planet out is a picture of one way such planets form, not a history of this one.",
  art: { main: "jupiter", fx: "glow" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* PSO J318.5338−22.8603: RA 21h 14m 08.0s, Dec −22° 51′ 36″; 22 pc
     * ≈ 72–80 ly (Liu et al. 2013 gave 24.6 pc ≈ 80 ly). */
    target: { name: "PSO J318.5−22", short: "PSO J318.5−22", ra: H(21, 14, 8), dec: D(-22, 51, 36), ly: 80, lyText: "about 80 light-years", where: "in Capricornus" },
    tells: [
      { at: 0, label: "2013", text: "The Pan-STARRS telescope finds something faint and red that is not a star: a planet, alone." },
      { at: 0.07, label: "80 light-years", text: "We travel to it." },
      { at: 0.27, label: "How a planet ends up alone", text: "One way: in a young planetary system, a close pass between planets can fling one out." },
      { at: 0.5, label: "PSO J318.5−22", text: "About 8 times Jupiter's mass, 23 million years young, still glowing from its birth." },
      { at: 0.7, label: "Not from our Solar System", text: "It was born far from here — around another star, or alone like a failed star." },
      { at: 0.86, label: "Looking back", text: "There may be billions of planets drifting between the stars." },
    ],
    build: own({
      titles: [
        [0, ["A young planetary system", "one way to lose a planet"]],
        [0.25, ["Flung out", "a close pass between giants"]],
        [0.45, ["PSO J318.5−22", "a lone young giant"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      /* Part 1: a young star with two giants; the outer is kicked out. */
      const sys = new THREE.Group();
      g.add(sys);
      const st = star(ctx, sys, 1.5, { colour: "#fff0c8", hot: "#ffffff", halo: 3, granule: 16 });
      const pA = planet(ctx, sys, 0.6, { a: "#c09a7a", b: "#8a6a5a", c: "#e8d2b0", bands: 14, seed: 1.1 });
      const pB = planet(ctx, sys, 0.7, { a: "#b06a4a", b: "#7a3a2a", c: "#e09a6a", bands: 12, glow: "#ff4a1a", glowK: 0.35, seed: 2.7 });
      const path = ctx.line([V(), V()], { colour: "#ff8a5a", opacity: 0.6, parent: sys });
      const trail = [];
      /* Part 2: the lone planet, close up, glowing dull red, on its own. */
      const lone = planet(ctx, g, 4, { a: "#5a2a1a", b: "#8a3a1a", c: "#c85a2a", bands: 16, glow: "#ff3a0a", glowK: 0.55, night: 0.2, lit: 0, rim: "#ff6a3a", rimK: 0.4, seed: 2.7 });
      lone.position.set(0, 0, 0);
      const tSys = tag(["A young star and its giant planets", "a picture, not this planet's history"], { height: 0.034, colour: "#ffe2b0" });
      const tKick = tag(["Flung out", "by a close pass"], { height: 0.034, colour: "#ff8a5a" });
      const tLone = tag(["PSO J318.5−22", "~8 Jupiters, 23 million years old", "no star"], { height: 0.052, colour: "#ff9a6a" });
      const tNot = tag(["Born far from here — not from our Solar System"], { height: 0.034, colour: "#ffe2a8" });
      return {
        update(q, a, t) {
          const p1 = 1 - smooth(q, 0.42, 0.48);
          sys.visible = p1 > 0.002;
          ctx.fade(sys, a * p1);
          lone.visible = p1 < 0.998;
          lone.material.uniforms.uOpacity.value = a * (1 - p1);
          /* The two planets: A on a steady orbit, B kicked at q = 0.22. */
          const tt = q * 40;
          pA.position.set(Math.cos(tt * 0.9) * 8, 0, -Math.sin(tt * 0.9) * 8);
          pA.userData.setLight(V());
          const kick = smooth(q, 0.2, 0.24);
          const ang = tt * 0.6;
          const rB = lerp(12, 12 + (q - 0.22) * 300, kick * (q > 0.22 ? 1 : 0));
          pB.position.set(Math.cos(ang) * rB, 0, -Math.sin(ang * (1 - 0.3 * kick)) * rB);
          pB.userData.setLight(V());
          if (q > 0.2 && q < 0.45) {
            trail.push(pB.position.clone());
            if (trail.length > 200) trail.shift();
            if (trail.length > 1) ctx.setLine(path, trail);
          }
          lone.rotation.y = t * 0.15;
          if (p1 > 0.5) orbitView(U, V(), lerp(40, 60, smooth(q, 0.2, 0.4)), 0.4 + q * 0.5, 0.6);
          else orbitView(U, V(), lerp(26, 16, smooth(q, 0.48, 0.7)), 0.6 + q * 0.6, 0.15);
          tSys.userData.at(V(0, 2, 0), 0, 0.08, a * p1 * win(q, 0.03, 0.2, 0.03));
          tKick.userData.at(pB.position, 0.04, 0.05, a * p1 * win(q, 0.24, 0.42, 0.03));
          /* Beside the planet (round 93: above it, it ran into the title). */
          tLone.userData.at(V(0, 0, 0), -0.84, 0.12, a * (1 - p1) * smooth(q, 0.5, 0.55));
          tNot.userData.at(V(0, -4.6, 0), 0, -0.06, a * smooth(q, 0.66, 0.72));
        },
      };
    }),
    end: seen(0, "#ff6a3a", ["PSO J318.5−22", "invisible to the eye — it glows in infrared"], ["In our sky", "in Capricornus"]),
  }),
});

/* ------------------------------------------------------------ Eta Carinae */

export const ETA_CARINAE = event({
  id: "eta-carinae",
  section: "deep",
  title: "Eta Carinae's Great Eruption",
  place: "Eta Carinae · Carina · about 7,500 light-years",
  kind: "recorded",
  family: "stellar",
  when: "1837–1856, brightest in March 1843",
  often: "once — and it may explode one day",
  timeline: { last: "1843" },
  detail: "A star of about 100 Suns blew off ten Suns' worth of gas in the 1840s and became the second-brightest star in the sky — and survived",
  frequency: "A 'supernova impostor': outbursts like this are rare; Eta Carinae may one day explode for real",
  cause: "Eta Carinae is a pair of huge stars; the bigger is about 100 Suns, close to the most a star can be. In the 1840s it threw off about 10 Suns of gas in an eruption we still do not fully understand — perhaps triggered by the two stars, perhaps by the star's own instability. The gas formed the twin lobes of the Homunculus Nebula.",
  note: "In March 1843 it was second only to Sirius. Then dust from the eruption hid it and it faded below naked-eye view until it recovered in the 1940s. Light echoes from the eruption, still arriving off distant dust, were caught in 2012 (Rest et al., Nature).",
  accuracy: "Its place and distance are real. The two stars and the Homunculus are drawn, not to scale (the lobes are about a light-year across).",
  art: { main: "star", fx: "burst" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* Eta Car: RA 10h 45m 03.6s, Dec −59° 41′ 04″; 2.3 kpc ≈ 7,500 ly. */
    target: { name: "Eta Carinae", short: "Eta Carinae", ra: H(10, 45, 3.6), dec: D(-59, 41, 4), ly: 7500, where: "in Carina" },
    tells: [
      { at: 0, label: "March 1843", text: "A star in Carina flares until it is second only to Sirius in the whole sky." },
      { at: 0.07, label: "7,500 light-years", text: "We travel to Eta Carinae." },
      { at: 0.27, label: "Two giants", text: "A pair of huge stars; the bigger about 100 Suns, near the limit of how heavy a star can be." },
      { at: 0.42, label: "The Great Eruption", text: "It throws off 10 Suns' worth of gas — and survives: a 'supernova impostor'." },
      { at: 0.62, label: "The Homunculus", text: "The gas formed two great lobes, still flying apart at 650 km/s." },
      { at: 0.86, label: "Looking back", text: "One day it may explode for real — as one of the brightest supernovae ever seen from Earth." },
    ],
    build: own({
      titles: [
        [0, ["Eta Carinae", "about 100 Suns, with a companion"]],
        [0.25, ["The Great Eruption", "1837–1856"]],
        [0.55, ["The Homunculus Nebula", "two lobes of gas and dust"]],
        [0.7, ["Eta Carinae today", "the Homunculus inside older, hotter gas"]],
      ],
      chart: {
        title: "Eta Carinae's brightness, 1820–1960",
        ticks: [[0, "1820"], [0.16, "1843"], [1, "1960"]],
        yTicks: [[0.92, "like Sirius"], [0.2, "too faint"]],
        fn: curveThrough([[0, 0.5], [0.12, 0.6], [0.16, 0.92], [0.24, 0.8], [0.3, 0.4], [0.5, 0.15], [0.86, 0.2], [1, 0.35]]),
        colour: "#ffd2a8",
        from: 0.2,
        to: 0.75,
      },
    }, ({ ctx, U, g, tag, site }) => {
      /* Round 91 (the owner's picture of Eta Carinae -- Chandra X-rays in
       * purple, Hubble's Homunculus in white): the two stars; the Great
       * Eruption; the Homunculus growing -- two lobes of gas and dust,
       * mottled, joined at the star, with a thin skirt between (Smith
       * 2006: each lobe about half a light-year, the axis tilted about 40°
       * to us); then, round it, the older ejecta and the X-ray-hot shell,
       * rebuilt in 3D from the picture. */
      const big = realStar(ctx, g, 2, "bsg");
      const small = realStar(ctx, g, 0.8, "bsg");
      const face = new THREE.Group();
      g.add(face);
      const lobeG = new THREE.Group();
      lobeG.rotation.set(0.45, 0, -0.78);
      face.add(lobeG);
      const LR = 8.5;
      const lr = rng(81);
      const clumps = [1, -1].map((sg) => Array.from({ length: 70 }, () => V(gauss(lr), gauss(lr), gauss(lr)).normalize()));
      const lobes = cloudOf(ctx, lobeG, 9000, (r) => {
        if (r() < 0.09) {
          /* The skirt: a thin, ragged disc at the waist, warmer. */
          const ang = r() * TAU;
          const rr = 3 + r() * 11;
          return { p: V(Math.cos(ang) * rr, gauss(r) * 0.4, Math.sin(ang) * rr), c: r() < 0.5 ? "#ff9a6a" : "#ffc89a", a: 0.25 + 0.2 * r(), s: 1 };
        }
        const sg = r() < 0.5 ? 1 : -1;
        const cl = clumps[sg > 0 ? 0 : 1];
        const d = cl[Math.floor(r() * cl.length)].clone().add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.22)).normalize();
        const p = V(0, sg * LR, 0).addScaledVector(d, LR * (0.92 + 0.12 * r()));
        if (p.y * sg < 0.3) p.y = sg * 0.3;
        const k = r();
        return { p, c: k < 0.45 ? "#fff6ec" : k < 0.7 ? "#e6e0ff" : k < 0.88 ? "#d2e2ff" : "#d8b8a0", a: 0.3 + 0.5 * r(), s: 0.8 + 0.8 * r() };
      }, { size: 3.4, seed: 82 });
      /* Soft light filling the lobes. */
      const glowGas = cloudOf(ctx, lobeG, 1400, (r) => {
        const sg = r() < 0.5 ? 1 : -1;
        const d = V(gauss(r), gauss(r), gauss(r)).normalize();
        return { p: V(0, sg * LR, 0).addScaledVector(d, LR * Math.sqrt(r()) * 0.95), c: r() < 0.6 ? "#e8eeff" : "#cfc4ff", a: 0.07, s: 1 };
      }, { size: 18, seed: 83 });
      /* Round it: the older ejecta and the X-ray shell, from the picture
       * (the middle, where the lobes are drawn above, left out). */
      const neb = imageNebula(ctx, face, deepAsset("eta-carinae.jpg"), 150, { mode: "shell", step: 2, threshold: 0.07, floor: 0.05, depth: 0.45, keep: 1.4, gain: 0.45, inner: 0.8, sizeK: 2.4, hole: 0.2, seed: 85 });
      neb.show(0);
      const fl = flash(ctx, g, "#ffffff");
      const tBig = tag(["Eta Carinae A", "about 100 Suns"], { height: 0.034, colour: "#cfe2ff" });
      const tLobes = tag(["The Homunculus", "10 Suns of gas, thrown off in the 1840s"], { height: 0.034, colour: "#ffd2a8" });
      const tShell = tag(["Older gas round it", "X-ray hot (Chandra)"], { height: 0.032, colour: "#d8b8ff" });
      const fadeStar = (m, al) => { m.material.uniforms.uOpacity.value = al; m.visible = al > 0.002; if (m.userData.halo) ctx.fade(m.userData.halo, al); };
      const Q_IMG = 0.7;
      return {
        update(q, a, t) {
          const ang = t * 0.4;
          big.position.set(Math.cos(ang) * 1.2, 0, Math.sin(ang) * 1.2);
          small.position.set(-Math.cos(ang) * 3, 0, -Math.sin(ang) * 3);
          big.rotation.y = t * 0.1;
          const er = win(q, 0.25, 0.45, 0.04);
          fadeStar(big, a);
          fadeStar(small, a);
          big.material.uniforms.uFlicker.value = 0.6 * er;
          fl.set(lerp(6, 30, er), a * er);
          const grow = smooth(q, 0.28, 0.6);
          lobes.set(lerp(0.05, 1, grow), a * smooth(q, 0.28, 0.34));
          glowGas.set(lerp(0.05, 1, grow), a * smooth(q, 0.3, 0.4));
          const imgK = smooth(q, Q_IMG, Q_IMG + 0.08);
          neb.show(a * imgK, lerp(0.9, 1, imgK));
          /* The camera: close on the pair, back as the lobes grow, back
           * again for the whole picture -- turning, then holding where the
           * picture faces it and swinging either side of that. */
          const yawStop = 0.3 + Q_IMG * 0.7;
          face.rotation.y = yawStop;
          const yaw = q < Q_IMG ? 0.3 + q * 0.7 : yawStop + 0.3 * Math.sin((q - Q_IMG) * 5) * imgK;
          const dist = lerp(lerp(lerp(26, 20, smooth(q, 0, 0.2)), 62, smooth(q, 0.3, 0.6)), 150, smooth(q, Q_IMG, Q_IMG + 0.1));
          orbitView(U, V(), dist, yaw, lerp(0.2, 0.08, imgK));
          tBig.userData.at(big.position.clone().add(V(0, 2.4, 0)), 0, 0.05, a * win(q, 0.03, 0.26, 0.03));
          /* Beside the top of the upper lobe, not at the top of the view
           * (round 91: it overlapped the title there and flickered). */
          tLobes.userData.at(inFrame(lobeG, site, V(LR * 1.2, LR * 2.2, 0)), 0.34, 0.04, a * win(q, 0.58, Q_IMG + 0.1, 0.03));
          tShell.userData.at(inFrame(face, site, V(-52, -22, 0)), 0, -0.04, a * smooth(q, Q_IMG + 0.1, Q_IMG + 0.15));
        },
      };
    }),
    end: seen(0.7, "#ffe2c8", ["Eta Carinae", "magnitude 4–5 today; −1 in March 1843"], ["In our sky", "in Carina, southern sky"], { size: 0.03 }),
  }),
});

/* ------------------------------------------------------------ Pillars */

export const PILLARS = event({
  id: "pillars-of-creation",
  section: "deep",
  title: "The Pillars of Creation",
  place: "Eagle Nebula (M16) · Serpens · about 6,500 light-years",
  kind: "ongoing",
  family: "deepSky",
  when: "Made famous by Hubble, 1 April 1995",
  often: "there now — slowly eroding",
  timeline: { last: "Hubble 1995, Webb 2022" },
  detail: "Towers of cold gas and dust light-years tall, inside which new stars are being born — and which the light of nearby stars is wearing away",
  frequency: "They will be worn away over a few hundred thousand years",
  cause: "The Eagle Nebula is a cloud where stars are forming. Its hot young stars blast the cloud with ultraviolet light, boiling away the gas. Denser knots shield the gas behind them, leaving tall pillars pointing at the stars — and inside those knots, new stars are still forming.",
  note: "Hubble's 1995 picture made them famous; Webb photographed them again in 2022, its infrared seeing through the dust to newborn stars inside. The tallest pillar is about 4 light-years long.",
  accuracy: "Its place and distance are real (about 2 kpc). The pillars are drawn in 3D after the photographs, not to a measured shape.",
  art: { main: "nebula", fx: "dust" },
  body: "Earth",
  scene: (ctx) => voyage(ctx, {
    /* The Pillars, M16: RA 18h 18m 51s, Dec −13° 50′; ~2 kpc. */
    target: { name: "The Pillars of Creation (M16)", short: "The Pillars", ra: H(18, 18, 51), dec: D(-13, 50, 0), ly: 6500, lyText: "about 6,500 light-years", where: "in Serpens" },
    tells: [
      { at: 0, label: "The Eagle Nebula", text: "In Serpens is a cloud where stars are being born: the Eagle Nebula." },
      { at: 0.07, label: "6,500 light-years", text: "We travel to it." },
      { at: 0.27, label: "Towers of dust", text: "Pillars of cold gas and dust, the tallest about 4 light-years long." },
      { at: 0.5, label: "Eroded by starlight", text: "Hot young stars nearby boil the cloud away; the pillars are what is left behind denser knots." },
      { at: 0.66, label: "New stars inside", text: "Inside the knots at their tips, new stars are forming." },
      { at: 0.86, label: "Looking back", text: "Hubble made them famous in 1995; Webb saw inside them in 2022." },
    ],
    build: own({
      titles: [
        [0, ["The Pillars of Creation", "in the Eagle Nebula"]],
        [0.45, ["Shaped by starlight", "hot young stars, above"]],
        [0.62, ["Star nurseries", "new stars in the tips"]],
      ],
    }, ({ ctx, U, g, tag }) => {
      /* Round 93 (the owner's picture: Webb's 2022 view, NASA/ESA/CSA):
       * the Pillars rebuilt from it as gas -- the blue glow of the nebula
       * at the back, the orange-brown pillars in front of it, their dark
       * dense cores nearest, soft (imageNebula's gas look). The picture
       * is 100 units wide (about 5 light-years; the tallest pillar about
       * 4). Positions in it, by eye: the tallest pillar's tip at (-22, 4),
       * the middle one's at (21, 55), the finger on the right at (36, 28),
       * the low left tip at (-25, -41) -- the last two with the red glow of
       * newborn stars. */
      const neb = imageNebula(ctx, g, deepAsset("pillars-of-creation.jpg"), 100, { mode: "layers", additive: false, step: 3, depth: 0.32, keep: 9, sizeK: 2.4, gain: 1.0, seed: 95, backfill: "#2a3a7a", gas: 1 });
      const tipsAt = [V(36, 28, 8), V(-25, -41, 9)];
      const tips = tipsAt.map((p) => { const st = star(ctx, g, 0.6, { colour: "#ffb08a", hot: "#ffffff", halo: 5, granule: 10 }); st.position.copy(p); return st; });
      const tP = tag(["The tallest pillar", "about 4 light-years"], { height: 0.034, colour: "#ffd2b0" });
      const tStars = tag(["Newborn stars", "in the dense tips"], { height: 0.032, colour: "#ffe2c8" });
      return {
        update(q, a) {
          neb.show(a, 1);
          tips.forEach((s) => ctx.fade(s, a * smooth(q, 0.62, 0.7)));
          /* Up the pillars from their feet to their tips, swinging a little
           * either side so the layers move apart. */
          const y = lerp(-35, 30, easeInOut(smooth(q, 0.05, 0.6))) - 10 * smooth(q, 0.75, 0.95);
          const yaw = 0.28 * Math.sin(q * Math.PI * 2);
          orbitView(U, V(0, y, 0), lerp(lerp(130, 92, smooth(q, 0, 0.3)), 150, smooth(q, 0.75, 0.95)), yaw, 0.04);
          tP.userData.at(V(-30, -12, 6), -0.05, 0, a * win(q, 0.3, 0.6, 0.03));
          tStars.userData.at(tipsAt[0], 0.06, 0.04, a * smooth(q, 0.66, 0.72));
        },
      };
    }),
    end: seen(0, "#ffd2a8", ["The Eagle Nebula", "a faint smudge in binoculars"], ["In our sky", "in Serpens, near Sagittarius"]),
  }),
});

export const NEW_DEEP_EVENTS = [WORMHOLE, TON618, WHITE_HOLE, BIGGEST_STAR, DYSON, BOOTES, PULSAR, KEPLER186F, HEART, GALAXY_TYPES, J1407B, HORSEHEAD, ROGUE, ETA_CARINAE, PILLARS];

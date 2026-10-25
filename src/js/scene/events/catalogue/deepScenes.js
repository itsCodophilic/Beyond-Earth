import * as THREE from "three";
import { smooth, win, span, lerp, clamp01, TAU, easeInOut, rng } from "./kit.js";
import { star, realStar, onion, pulsarWind, imageNebula, particleJet, burst, accretion, stream, blackHole, lensSky, neutronStar, remnant, flash, cloudOf, shock, gauss, V, inFrame } from "./deepObjects.js";
import { deepAsset, chart, orbitView, screenFlash } from "./deepVoyage.js";

/**
 * Round 88: the scenes the deep-sky voyages arrive at that several events
 * share -- a star exploding (a supernova of either kind, a hypernova), a
 * white dwarf feeding on a companion until it erupts (the novae), and two
 * stars or dead stars spiralling together (kilonova, black-hole merger,
 * luminous red nova). Each returns a `build` for voyage(). Everything is
 * drawn round the universe's origin; sizes are drawing units, not to scale
 * with each other, and each event's `accuracy` line says so.
 */

const out = (x) => 1 - (1 - x) * (1 - x);
const L0 = (cfg) => cfg.labels ?? {};
const titleAt = (titles, q) => {
  let tt = titles?.[0]?.[1] ?? ["", ""];
  (titles ?? []).forEach(([at, words]) => { if (q >= at) tt = words; });
  return tt;
};

/* A light curve on the hud, bottom left, above the event's own picture. */
const lightChart = (ctx, H, c) => (c ? chart(ctx, H, { x: -1.0, y: -0.6, w: 0.62, h: 0.28, ...c }) : null);

/* ------------------------------------------------------------ supernova */

/*
 * A star that explodes. cfg:
 *   kind      "core" (a massive star's core collapses), "ia" (a white
 *             dwarf fed by a companion reaches 1.4 Suns and detonates),
 *             "hyper" (a collapse that makes a black hole and two jets)
 *   star      { r, kind } the star before: kind "rsg", "ysg", "bsg" or
 *             "wr" (deepObjects.js realStar -- each its own colour and
 *             surface, round 90)
 *   leftover  "pulsar", "neutron", "blackhole" or null (Ia: nothing left)
 *   remR      the remnant's radius (drawing units); remnant { ... } options
 *   photo     the nebula as photographed, rebuilt in 3D from the picture at
 *             the end (round 90: no flat pictures; round 91: no caption
 *             saying so): { file, width, mode, ... imageNebula options }
 *   rings     true: SN 1987A's three rings, the inner one lit by the debris
 *   titles    [[q, [title, line]], ...] -- the titles through the visit
 *   labels    { star, leftover, remnant, companion, rings }
 *   q         { collapse, blast, remnant, ns, photo } -- when each begins
 *   chart     a light curve: { title, ticks, yTicks, fn, from, to }
 *
 * Round 90 (Prompts.md): before it goes, the star flickers and its inside
 * is opened -- the onion of shells round an iron core -- as the core falls
 * in; the blast lights the whole screen, blue-white then orange; then the
 * camera goes in close to what is left: a neutron star spinning inside its
 * own wind of gas (no drawn lines).
 */
export function supernovaScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const Q = { collapse: 0.14, blast: 0.22, remnant: 0.42, ns: 0.5, nsEnd: 0.68, photo: 0.72, ...(cfg.q ?? {}) };
    const S = cfg.star?.r ?? 2;
    const remR = cfg.remR ?? 60;
    const g = new THREE.Group();
    site.add(g);
    let prog = null;
    let inside = null;
    let wd = null;
    let comp = null;
    let disc = null;
    let flow = null;
    const A = S * 5;
    if (cfg.kind === "ia") {
      wd = star(ctx, g, S * 0.22, { colour: "#e4ecff", hot: "#ffffff", halo: 5, haloColour: "#bcd0ff", haloOpacity: 0.7 });
      comp = realStar(ctx, g, S * 1.25, cfg.companionKind ?? "sun");
      comp.position.set(A, 0, 0);
      disc = accretion(ctx, g, S * 0.3, S * 1.3, { count: 1600, hot: "#e8f0ff", cool: "#ff9a5a", size: 2.2 });
      flow = stream(ctx, g, { count: 360, colour: "#ffc08a", discR: S * 1.3 });
    } else {
      prog = realStar(ctx, g, S, cfg.star?.kind ?? "rsg");
      prog.material.depthWrite = false;
      inside = onion(ctx, g, S * 0.985, { stripped: cfg.star?.kind === "wr" });
      inside.show(0);
    }
    const fl = flash(ctx, g, cfg.flashColour ?? "#ffffff");
    const fl2 = flash(ctx, g, cfg.flashColour2 ?? "#bcd8ff");
    const blaze = screenFlash(ctx, H);
    const shell = burst(ctx, g, { count: 4000, colours: cfg.burstColours ?? ["#ffffff", "#ffe2b8", "#ff9a5a", "#a8c8ff"], seed: cfg.seed ?? 5, size: 3.2, thick: 0.3 });
    /* The blast wave itself, and the neutrinos' shell ahead of it. */
    const wave = shock(ctx, g, cfg.waveColour ?? "#ffb880", { power: 3.5, seed: 3 });
    const nuWave = shock(ctx, g, "#8fe8ff", { power: 5, seed: 7 });
    const L = cfg.labels ?? {};
    const tCore = tag(L.core ?? ["Inside: hydrogen, helium, carbon,", "oxygen, silicon — and an iron core"], { height: 0.034, colour: "#e8e8ff" });
    const rem = remnant(ctx, g, remR, { seed: (cfg.seed ?? 5) + 7, ...(cfg.remnant ?? {}) });
    rem.show(0);
    /* Neutrinos: a faint shell racing out at the moment of collapse, ahead
     * of the light (they leave the core at once; the light waits for the
     * shock to reach the star's surface). */
    const nu = burst(ctx, g, { count: 900, colours: ["#9fe8ff", "#d8f6ff"], seed: 41, size: 1.6, thick: 0.05, lobes: 1 });
    let pw = null;
    let bh = null;
    if (cfg.leftover === "pulsar" || cfg.leftover === "neutron") {
      pw = pulsarWind(ctx, g, S * 0.05, { torusR: remR * 0.1, jetLen: remR * 0.15, spin: cfg.leftover === "pulsar" ? 1.4 : 0.5, quiet: cfg.leftover !== "pulsar" });
      pw.update(0, 0);
    }
    if (cfg.leftover === "blackhole") {
      bh = blackHole(ctx, g, S * 0.18, { bound: 22, rin: 3, rout: 10, disc: 1 });
      bh.uniforms.uOpacity.value = 0;
      bh.mesh.visible = false;
    }
    /* Jets (a hypernova): along the star's axis, ahead of the shell. */
    /* Jets (a hypernova): gas shot out along the star's axis at nearly
     * the speed of light, drilling out ahead of the shell (round 91:
     * flowing gas, not a cone). */
    const jets = cfg.kind === "hyper" ? particleJet(ctx, g, remR * 1.6, { count: 3200, width: 0.06, colour: "#cfe2ff", core: "#ffffff", seed: 44, size: 9, speed: 0.5 }) : null;
    /* SN 1987A's rings: an inner ring round the waist (struck by the
     * debris from about 2001, lighting up as a string of hot spots) and two
     * fainter outer rings above and below -- an hourglass of gas the star
     * shed about 20,000 years before it exploded. */
    let rings = null;
    if (cfg.rings) {
      const rIn = remR * 0.42;
      const innerR = cloudOf(ctx, g, 900, (r) => {
        const a2 = r() * TAU;
        return { p: V(Math.cos(a2) * rIn * (1 + gauss(r) * 0.03), gauss(r) * rIn * 0.03, Math.sin(a2) * rIn * (1 + gauss(r) * 0.03)), c: "#ffb08a", a: 0.5, s: 1 };
      }, { size: 2.2, seed: 61 });
      const outerRing = (y, seed) => cloudOf(ctx, g, 700, (r) => {
        const a2 = r() * TAU;
        const rr = rIn * 2.05;
        return { p: V(Math.cos(a2) * rr * 0.82 + rIn * 0.25 * Math.sign(y), y + gauss(r) * rIn * 0.04, Math.sin(a2) * rr), c: "#ff7a6a", a: 0.35, s: 1 };
      }, { size: 1.9, seed });
      const spots = cloudOf(ctx, g, 28, (r, i) => {
        const a2 = (i / 28) * TAU + r() * 0.1;
        return { p: V(Math.cos(a2) * rIn, 0, Math.sin(a2) * rIn), c: "#fff4d8", a: 1, s: 3.4 };
      }, { size: 3.6, seed: 62 });
      rings = { inner: innerR, up: outerRing(rIn * 1.3, 63), down: outerRing(-rIn * 1.3, 64), spots };
      [rings.inner, rings.up, rings.down, rings.spots].forEach((c) => c.show(0));
    }
    /* The ending: the photograph, rebuilt in 3D (round 90). */
    const neb = cfg.photo ? imageNebula(ctx, g, deepAsset(cfg.photo.file), cfg.photo.width ?? remR * 2.4, cfg.photo) : null;
    if (neb) neb.show(0);
    /* Labels. */
    const tStar = tag(L.star ?? ["The star"], { height: 0.038, colour: "#ffd9b0" });
    const tLeft = tag(L.leftover ?? [""], { height: 0.036, colour: "#cfe2ff" });
    const tRem = tag(L.remnant ?? [""], { height: 0.038, colour: "#ffc8a8" });
    const tComp = tag(L.companion ?? ["Its companion"], { height: 0.034, colour: "#ffe2b0" });
    const tNu = tag(["Neutrinos, first"], { height: 0.034, colour: "#9fe8ff" });
    const tRing = tag(L.rings ?? [""], { height: 0.034, colour: "#ffd2b0" });
    const ch = lightChart(ctx, H, cfg.chart);
    let mass = null;
    if (cfg.kind === "ia") {
      mass = H.label(["1.30 Suns"], { at: [-1.02, 0.52, 0], height: 0.05, align: "left", colour: "#cfe2ff", declutter: false });
      ctx.fade(mass, 0);
    }
    const centre = V();
    const viewAxis = V();
    const hasNs = Boolean(pw);
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const t = ctx.t;
        /* The camera: close on the star (turned so the opened wedge faces
         * us as the core falls), back with the blast, round the remnant,
         * in close to the neutron star, then out round the nebula. */
        const near = cfg.kind === "ia" ? A * 2.4 : S * 6;
        const farD = remR * 2.6;
        const blastK = out(span(q, Q.blast, Q.remnant));
        let dist = q < Q.blast ? lerp(near * 2.2, near, easeInOut(span(q, 0, Q.collapse))) : Math.max(lerp(near, farD, easeInOut(span(q, Q.blast, Q.remnant + 0.06))), remR * 2.5 * blastK);
        const nsK = hasNs ? win(q, Q.ns, Q.nsEnd + 0.04, 0.05) : 0;
        /* In close: the torus about a third of the view across. */
        dist = lerp(dist, remR * 0.1 * 3.2, easeInOut(nsK));
        /* A black hole left (round 91: "slowly zoom into the black hole"):
         * once the debris has spread, the camera closes on it slowly, to
         * just outside its traced sphere (22 times its radius). */
        const bhK = bh ? easeInOut(span(q, Q.remnant - 0.05, Math.min(1, Q.remnant + 0.2))) : 0;
        dist = lerp(dist, S * 0.18 * 22 * 1.45, bhK);
        const photoK = neb ? easeInOut(span(q, Q.photo, Q.photo + 0.06)) : 0;
        dist = lerp(dist, (cfg.photo?.width ?? remR * 2.4) * 1.3, photoK);
        const yaw0 = cfg.yaw ?? 0.65;
        let yaw = yaw0 + q * 0.9;
        /* While the star is open, turned so the cut's two faces are seen
         * at an angle (the wedge is the quarter x > 0, z > 0). */
        const openK = prog ? easeInOut(win(q, Q.collapse - 0.07, Q.blast, 0.04)) : 0;
        yaw = lerp(yaw, Math.PI / 4 + 0.55, openK);
        /* The nebula faces the camera as it was when the ending began; the
         * camera then swings either side of it (the 3D shows). */
        const yawPhoto = yaw0 + Q.photo * 0.9;
        if (neb) neb.group.rotation.y = yawPhoto - g.rotation.y;
        yaw = lerp(yaw, yawPhoto + Math.sin((q - Q.photo) * 6) * 0.35, photoK);
        const pitch = lerp(lerp(lerp(cfg.pitch ?? 0.22, 0.42, openK), 0.62, nsK), 0.12, photoK);
        orbitView(U, centre, dist, yaw, pitch);
        if (pw) {
          /* The wind's axis leaned on screen (about the line of sight). */
          viewAxis.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
          pw.group.quaternion.setFromAxisAngle(viewAxis, 0.5);
        }
        /* The star before: flickering in its last years, then opened. */
        if (prog) {
          const ck = span(q, Q.collapse, Q.blast);
          const gone = 1 - smooth(q, Q.blast, Q.blast + 0.025);
          const shudder = q >= Q.collapse && q < Q.blast ? 1 - 0.05 * Math.sin(t * 40) * ck - 0.08 * ck : 1;
          prog.scale.setScalar(Math.max(1e-3, shudder));
          prog.material.uniforms.uOpacity.value = a * gone;
          prog.material.uniforms.uFlicker.value = 0.18 * Math.sin(t * 2.3) * Math.sin(t * 0.7) * win(q, 0.03, Q.collapse, 0.03);
          const open = q >= Q.collapse - 0.06 && q < Q.blast + 0.01;
          prog.material.uniforms.uCut.value = open ? 1 : 0;
          prog.visible = a * gone > 0.002;
          if (prog.userData.halo) ctx.fade(prog.userData.halo, a * gone);
          prog.userData.dust?.set(lerp(1, 6, blastK), a * (1 - smooth(q, Q.blast, Q.blast + 0.06)));
          prog.userData.wind?.set(S * 1.9 * (1 + 0.04 * Math.sin(t * 3)), a * 0.2 * gone);
          inside.show(open ? a : 0, lerp(1, 0.25, ck * ck), ck);
          tCore.userData.at(V(0, S * 1.1, 0), 0, 0.07, a * win(q, Q.collapse - 0.05, Q.blast - 0.01, 0.015));
          tStar.userData.at(V(0, S * 1.25, 0), 0, 0.06, a * (1 - smooth(q, Q.collapse - 0.08, Q.collapse - 0.05)) * smooth(q, 0.02, 0.06));
        }
        if (cfg.kind === "ia") {
          /* Gas spills from the companion onto the white dwarf; its mass
           * creeps up toward 1.4 Suns -- the most a white dwarf can hold up
           * (Chandrasekhar 1931) -- and it detonates. Nothing is left. */
          const before = 1 - smooth(q, Q.blast, Q.blast + 0.02);
          g.rotation.y = t * 0.15;
          disc.update(t, 1, a * before);
          flow.update(t, comp.position, a * before);
          ctx.fade(wd, a * before);
          const m = 1.3 + 0.1 * smooth(q, 0.04, Q.blast - 0.01);
          mass.userData.draw([`${m.toFixed(2)} Suns`, m >= 1.395 ? "the limit: it explodes" : "the white dwarf, growing"]);
          ctx.fade(mass, a * win(q, 0.03, Q.blast + 0.08, 0.02));
          comp.material.uniforms.uOpacity.value = a * (1 - 0.6 * smooth(q, Q.blast, Q.remnant));
          comp.position.set(A + remR * 0.25 * out(span(q, Q.blast, Q.remnant)), 0, 0);
          tStar.userData.at(V(0, S * 0.6, 0), 0, 0.06, a * before * smooth(q, 0.02, 0.06));
          tComp.userData.at(inFrame(comp, site, V(0, 1.5, 0)), 0, 0.06, a * smooth(q, 0.02, 0.06) * (1 - smooth(q, Q.remnant, Q.remnant + 0.04)));
        }
        /* Neutrinos at the collapse (not for Ia). */
        const nuK = span(q, Q.collapse + 0.02, Q.blast + 0.08);
        if (cfg.kind !== "ia") {
          nu.set(farD * 1.4 * nuK, a * (nuK > 0 && nuK < 1 ? 0.8 * (1 - nuK) : 0));
          nuWave.set(farD * 1.4 * nuK, a * (nuK > 0 && nuK < 1 ? 0.5 * (1 - nuK) : 0));
          tNu.userData.at(V(0, farD * 1.4 * nuK * 0.98, 0), 0, 0.05, a * win(q, Q.collapse + 0.03, Q.blast + 0.06, 0.015));
        }
        /* The blast: the whole view lit, blue-white then orange as it
         * cools; a flash; the debris flying out. */
        const fk = span(q, Q.blast, Q.blast + 0.1);
        const glare = q >= Q.blast ? Math.pow(1 - span(q, Q.blast, Q.blast + 0.07), 1.6) : 0;
        blaze.set(a * glare * 0.95, fk);
        fl.set(lerp(S * 3, remR * 2.2, out(fk)), a * (q >= Q.blast ? Math.pow(1 - fk, 1.5) : 0));
        fl2.set(lerp(S * 6, remR * 3.2, out(fk)), a * (q >= Q.blast ? 0.5 * Math.pow(1 - fk, 2) : 0));
        const shellA = q >= Q.blast ? 1 - smooth(q, Q.remnant - 0.08, Q.remnant + 0.06) : 0;
        shell.set(remR * blastK, a * shellA);
        wave.set(remR * 1.05 * blastK, a * (q >= Q.blast ? 0.45 * (1 - smooth(q, Q.blast + 0.06, Q.remnant)) : 0));
        /* The remnant, still growing slowly. */
        const remA = smooth(q, Q.remnant - 0.12, Q.remnant + 0.02) * (1 - photoK) * (1 - 0.85 * nsK) * (1 - 0.75 * bhK);
        rem.set(lerp(0.85, 1.05, span(q, Q.remnant - 0.12, 1)), a * remA);
        tRem.userData.at(V(0, remR * 1.05, 0), 0, 0.06, a * remA * smooth(q, Q.remnant, Q.remnant + 0.04) * (1 - nsK));
        if (jets) jets.set(t, a * 0.9 * win(q, Q.blast - 0.01, Q.remnant + 0.25, 0.03), out(span(q, Q.blast - 0.01, Q.blast + 0.12)));
        /* What is left. */
        const left = smooth(q, Q.blast + 0.04, Q.blast + 0.12) * (1 - photoK * 0.85);
        if (pw) {
          /* Faint while the debris flies; full as the camera goes in. */
          pw.update(t, a * left * (0.35 + 0.65 * Math.max(nsK, photoK)));
          tLeft.userData.at(V(0, -S * 0.05, 0), 0.06, -0.1, a * nsK);
        }
        if (bh) {
          bh.uniforms.uOpacity.value = a * left;
          bh.mesh.visible = a * left > 0.002;
          tLeft.userData.at(V(0, 0, 0), 0.2, -0.17, a * left * smooth(q, Q.blast + 0.12, Q.blast + 0.16) * (1 - photoK));
        }
        /* SN 1987A's rings: there before, lit by the flash, then struck. */
        if (rings) {
          const ringA = a * (1 - photoK) * smooth(q, Q.blast, Q.blast + 0.05);
          rings.inner.show(ringA * 0.9);
          rings.up.show(ringA * 0.6);
          rings.down.show(ringA * 0.6);
          rings.spots.show(ringA * smooth(q, Q.remnant + 0.04, Q.remnant + 0.16));
          tRing.userData.at(V(remR * 0.42, 0, 0), 0.04, 0.05, ringA * smooth(q, Q.remnant + 0.06, Q.remnant + 0.12) * (1 - nsK));
        }
        if (neb) {
          neb.show(a * photoK, lerp(0.92, 1.0, span(q, Q.photo, 1)));
        }
        if (ch) {
          const from = cfg.chart.from ?? Q.blast - 0.02;
          /* Where the chart has to sit beside the card (a short window), it
           * steps aside while the camera is in close on what is left. */
          ch.show(span(q, from, cfg.chart.to ?? Q.photo), a * win(q, from - 0.03, cfg.chart.until ?? (neb ? Q.photo + 0.04 : 1.01), 0.02) * (ch.side === "left" ? 1 - nsK : 1));
        }
      },
    };
  };
}

/* ------------------------------------------------------------ nova shell */

/*
 * Round 90 (Prompts.md: a nova seen close up "shifts from a blistering
 * blue-white to deep red ... directional, peanut- or olive-shaped ... a
 * rippled shell with bright knots and filaments"): the gas a nova throws
 * off, as interferometry and spectropolarimetry show it -- a prolate,
 * bipolar shell, pinched at the waist (in the orbit's plane) and drawn out
 * along the poles (e.g. RS Oph 2006, Bode et al. 2006; V339 Del 2013,
 * Schaefer et al. 2014), bright knots on it, its colour cooling from
 * blue-white to the deep red of hydrogen as it spreads.
 * set(R, alpha, k): front at R along the poles; k 0..1 its age.
 */
function novaShell(ctx, parent, { count = 3000, seed = 81 } = {}) {
  const r = rng(seed);
  const cloud = ctx.cloud(count, { parent, size: 3 });
  /* Soft glowing gas under the knots (large faint points). */
  const NG = Math.floor(count * 0.3);
  const gas = ctx.cloud(NG, { parent, size: 16 });
  const knots = Array.from({ length: 30 }, () => V(gauss(r), gauss(r), gauss(r)).normalize());
  const parts = Array.from({ length: count }, () => {
    let d = V(gauss(r), gauss(r), gauss(r)).normalize();
    if (r() < 0.6) d = knots[Math.floor(r() * knots.length)].clone().add(V(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.09)).normalize();
    /* Peanut: radius along a direction grows toward the poles (y). */
    const c = Math.abs(d.y);
    const shape = 0.5 + 0.5 * Math.pow(c, 0.7) + 0.1 * Math.sin(8 * Math.atan2(d.z, d.x));
    return { d, k: shape * (0.85 + 0.2 * r()), a: 0.35 + 0.6 * r(), s: 0.7 + r() * 0.9, ripple: r() * TAU };
  });
  parts.forEach((p, i) => { cloud.size[i] = 3 * p.s; if (i < NG) gas.size[i] = 12 + 10 * p.s; });
  const hot = new THREE.Color("#e8f0ff");
  const warm = new THREE.Color("#ffd2b0");
  const red = new THREE.Color("#ff3a4a");
  const green = new THREE.Color("#7affc0");
  const c = new THREE.Color();
  return {
    cloud,
    set(R, alpha, k) {
      cloud.opacity = alpha;
      gas.opacity = alpha;
      cloud.points.visible = gas.points.visible = alpha > 0.002;
      if (!cloud.points.visible) return;
      if (k < 0.35) c.copy(hot).lerp(warm, k / 0.35);
      else c.copy(warm).lerp(red, Math.min(1, (k - 0.35) / 0.4));
      for (let i = 0; i < count; i += 1) {
        const p = parts[i];
        const rr = R * p.k * (1 + 0.04 * Math.sin(p.ripple + k * 12));
        cloud.set(i, p.d.x * rr, p.d.y * rr, p.d.z * rr);
        cloud.alpha[i] = p.a;
        /* A few knots glow green late on (forbidden oxygen lines). */
        cloud.tint(i, i % 11 === 0 && k > 0.5 ? c.clone().lerp(green, 0.5) : c);
        if (i < NG) {
          gas.set(i, p.d.x * rr, p.d.y * rr, p.d.z * rr);
          gas.alpha[i] = 0.07 * p.a;
          gas.tint(i, c);
        }
      }
      cloud.commit();
      gas.commit();
    },
  };
}

/* ------------------------------------------------------------ novae */

/*
 * A white dwarf and its companion. cfg:
 *   donor     { r, at, colour, hot } the companion (radius, distance)
 *   wind      true: the companion loses gas as a wind (a red giant in a
 *             symbiotic pair) rather than through a stream
 *   magnetic  true: the white dwarf's field channels the gas onto its
 *             poles (a micronova), no disc
 *   eruptions [q, ...] when it goes off; `years` [[q, words]] a counter
 *   shell     { R, colours } the gas thrown off
 *   micro     true: a burst at one pole only, small and brief
 *   slow      true: the eruption stays bright a long time (symbiotic)
 *   chart     a light curve on the hud
 */
export function novaScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const D = cfg.donor ?? { r: 1.4, at: 5, colour: "#ff7a4a", hot: "#ffb88a" };
    const g = new THREE.Group();
    site.add(g);
    const orbit = new THREE.Group();
    g.add(orbit);
    const wdR = cfg.wdR ?? 0.16;
    const wd = star(ctx, orbit, wdR, { colour: "#e4ecff", hot: "#ffffff", halo: 6, haloColour: "#bcd0ff", haloOpacity: 0.75, granule: 6 });
    /* The companion's surface (round 90): a red dwarf's fine granulation,
     * or a red giant's few huge cells. */
    const donor = realStar(ctx, orbit, D.r, D.kind ?? (D.r > 2 ? "rsg" : "rd"), { dust: Boolean(cfg.wind) });
    donor.position.set(D.at, 0, 0);
    const discR = cfg.discR ?? Math.min(D.at * 0.3, 2.4);
    const disc = cfg.magnetic ? null : accretion(ctx, orbit, wdR * 1.6, discR, { count: 2200, hot: "#eef4ff", cool: "#ff9a5a", size: 2.2, thick: 0.05 });
    const flow = cfg.wind ? null : stream(ctx, orbit, { count: 520, colour: D.streamColour ?? "#ffb08a", discR: cfg.magnetic ? wdR * 4 : discR, size: 2 });
    /* A red giant's wind: gas drifting out in every direction, some caught
     * by the white dwarf. */
    const wind = cfg.wind ? cloudOf(ctx, orbit, 2200, (r) => {
      const d = V(gauss(r), gauss(r), gauss(r)).normalize();
      return { p: d.multiplyScalar(D.r * (1.05 + 3 * r())).add(V(D.at, 0, 0)), c: "#ff9a7a", a: 0.12 + 0.2 * r(), s: 1.4 };
    }, { size: 2.2, seed: 71 }) : null;
    /* A magnetic white dwarf (micronova): field lines, and the gas
     * funnelled down them onto the poles. */
    let field = null;
    let funnelPts = null;
    let pole = null;
    if (cfg.magnetic) {
      field = new THREE.Group();
      orbit.add(field);
      field.rotation.z = 0.35;
      [3, 5, 8].forEach((Lr, li) => {
        for (let k = 0; k < 8; k += 1) {
          const az = (k / 8) * TAU + li * 0.4;
          const pts = [];
          const th0 = Math.asin(Math.sqrt(Math.min(1, 1.02 / Lr)));
          for (let i = 0; i <= 50; i += 1) {
            const th = th0 + ((Math.PI - 2 * th0) * i) / 50;
            const rr = wdR * Lr * 1.6 * Math.sin(th) ** 2;
            pts.push(V(rr * Math.sin(th) * Math.cos(az), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(az)));
          }
          ctx.line(pts, { colour: "#8fb8ff", opacity: 0.32, parent: field });
        }
      });
      funnelPts = cloudOf(ctx, field, 600, () => ({ p: V(), c: "#ffd2a8", a: 0.7, s: 1 }), { size: 2, seed: 72 });
      funnelPts.ph = Array.from({ length: 600 }, (_, i) => ((i * 0.618) % 1));
      pole = flash(ctx, field, "#fff6e0");
    }
    const fl = flash(ctx, orbit, "#ffffff");
    const fl2 = flash(ctx, orbit, cfg.flashColour ?? "#ffd2c0");
    const SR = cfg.shell?.R ?? D.at * 3;
    /* The blown-off layer as a glowing bubble (hydrogen red, with the
     * green of oxygen in its later light). */
    const bubble = cfg.micro ? null : shock(ctx, orbit, cfg.shell?.bubble ?? "#ff7a9a", { power: 4, seed: 5 });
    const erupt = cfg.eruptions ?? [0.4];
    const shells = erupt.map((_, i) => (cfg.micro
      ? burst(ctx, field, { count: 600, colours: ["#fff2d8", "#ffd2a8", "#ffffff"], seed: 81 + i, size: 2.4, thick: 0.18, lobes: 1 })
      : novaShell(ctx, orbit, { count: 3000, seed: 81 + i })));
    const blaze = screenFlash(ctx, H);
    const ch = lightChart(ctx, H, cfg.chart);
    const L = cfg.labels ?? {};
    const tWd = tag(L.wd ?? ["White dwarf", "about the size of Earth"], { height: 0.036, colour: "#cfe2ff" });
    const tDonor = tag(L.donor ?? ["Its companion"], { height: 0.036, colour: "#ffc8a8" });
    const tShell = tag(L.shell ?? ["Gas thrown off", "at thousands of km/s"], { height: 0.036, colour: "#ffb0c0" });
    const tPole = tag(L.pole ?? ["A burst at the pole", "a few hours long"], { height: 0.036, colour: "#fff2d8" });
    /* The year counter, bottom left (round 91: under the title it ran
     * into the labels of the stars). */
    const year = cfg.years ? H.label([""], { at: [-1.02, -0.58, 0], height: 0.058, align: "left", colour: "#ffe2a8", declutter: false }) : null;
    if (year) ctx.fade(year, 0);
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const t = ctx.t;
        /* Since the last eruption, and how bright it is now. */
        let since = 99;
        let which = -1;
        erupt.forEach((e, i) => { if (q >= e) { since = q - e; which = i; } });
        const lastLen = cfg.slow ? 0.45 : cfg.micro ? 0.08 : 0.16;
        const erupting = since < lastLen ? 1 - since / lastLen : 0;
        const bright = since < 99 ? (cfg.slow ? win(since, 0, 0.5, 0.06) : Math.exp(-since / (cfg.micro ? 0.02 : 0.035))) : 0;
        /* The camera: round the pair; back a little while a shell flies. */
        const base = cfg.view ?? D.at * 2.6;
        const wide = cfg.micro ? base : Math.max(base, SR * 1.9);
        const pull = cfg.micro ? 0 : smooth(since, 0, 0.08) * (since < 99 ? 1 - smooth(since, lastLen + 0.12, lastLen + 0.25) : 0);
        const zoomIn = cfg.micro ? smooth(q, 0.12, 0.3) : 0;
        const dist = lerp(lerp(base * 1.5, base, smooth(q, 0, 0.12)), wide, pull) * lerp(1, 0.32, zoomIn);
        const look = V(D.at * 0.25 * (1 - zoomIn), 0, 0);
        orbitView(U, look, dist, (cfg.yaw ?? 0.6) + q * 0.7, cfg.pitch ?? 0.32);
        orbit.rotation.y = t * 0.12;
        /* Feeding. */
        const feeding = 1 - 0.85 * erupting;
        disc?.update(t, 1, a * feeding * (1 - 0.7 * bright));
        flow?.update(t, donor.position, a * feeding);
        wind?.show(a * 0.9);
        if (cfg.magnetic) {
          /* Gas sliding down the field lines onto both poles. Round 91
           * (Prompts.md: the field "sucking stuff from a different
           * direction"): it is caught where the stream from the red dwarf
           * arrives -- on the side facing it, at the stream's end (4 white-
           * dwarf radii out) -- and only there, so the gas runs from the
           * stream, round the field lines, onto the poles. */
          const Lr = 2.5;
          const thEnd = Math.asin(Math.sqrt(1 / Lr));
          for (let i = 0; i < 600; i += 1) {
            const u = (funnelPts.ph[i] + t * 0.3) % 1;
            const az = ((i % 5) - 2) * 0.09 - field.rotation.y;
            const s = i % 2 ? 1 : -1;
            const th = lerp(Math.PI / 2, thEnd, u);
            const rr = wdR * Lr * 1.6 * Math.sin(th) ** 2;
            funnelPts.cloud.set(i, rr * Math.sin(th) * Math.cos(az), s * rr * Math.cos(th), rr * Math.sin(th) * Math.sin(az));
          }
          funnelPts.cloud.commit();
          funnelPts.show(a * 0.85);
          pole.sprite.position.set(0, wdR * 1.05, 0);
          pole.set(wdR * lerp(1.5, 10, bright), a * bright);
          tPole.userData.at(inFrame(field, site, V(0, wdR * 1.6, 0)), 0.04, 0.06, a * bright * 1.5);
        }
        /* The eruption: from this close the whole view floods with light,
         * blue-white, then warmer as it fades (not for a micronova). */
        const glare = cfg.micro || since >= 99 ? 0 : (cfg.slow ? 0.18 * win(since, 0, 0.3, 0.05) : Math.exp(-since / 0.03));
        blaze.set(a * glare * 0.9, clamp01(since / (cfg.slow ? 0.3 : 0.08)));
        fl.set(lerp(wdR * 8, SR * 1.4, out(clamp01(since / 0.06))), a * (cfg.micro ? 0 : bright));
        fl2.set(SR * lerp(0.5, 2.2, out(clamp01(since / 0.2))), a * (cfg.micro ? 0 : (cfg.slow ? 0.25 : 0.5) * bright));
        if (bubble) {
          const e = which >= 0 ? erupt[which] : 2;
          const kb = span(q, e, e + (cfg.slow ? 0.6 : 0.3));
          bubble.set(SR * 0.98 * out(kb), a * (q >= e ? (cfg.slow ? 0.1 : 0.14) * (1 - smooth(kb, 0.45, 1)) : 0));
          /* Drawn out along the poles, like the gas: an olive, the waist
           * about 0.6 of the length (the shell's own proportions). */
          bubble.mesh.scale.x *= 0.62;
          bubble.mesh.scale.z *= 0.62;
          bubble.mesh.material.uniforms.uColor.value.set("#dfe9ff").lerp(new THREE.Color("#ff4a5a"), smooth(kb, 0.1, 0.6));
        }
        shells.forEach((s, i) => {
          const e = erupt[i];
          const k = q >= e ? span(q, e, e + (cfg.slow ? 0.6 : cfg.micro ? 0.1 : 0.3)) : 0;
          const R = (cfg.micro ? wdR * 10 : SR) * out(k);
          const fade = q >= e ? (1 - smooth(k, 0.55, 1)) * (i === which ? 1 : 0.6) : 0;
          if (cfg.micro) { s.cloud.points.position.set(0, wdR, 0); s.set(R, a * fade); } else s.set(R, a * fade, k);
        });
        ctx.fade(wd, a);
        donor.material.uniforms.uOpacity.value = a;
        donor.visible = a > 0.002;
        if (donor.userData.halo) ctx.fade(donor.userData.halo, a);
        donor.userData.dust?.show(a);
        field?.children.forEach((o) => { if (o.isLine) ctx.fade(o, a); });
        wd.scale.setScalar(1 + 2.5 * bright * (cfg.micro ? 0.2 : 1));
        tWd.userData.at(inFrame(wd, site), 0.04, -0.08, a * smooth(q, 0.02, 0.06) * (1 - bright));
        tDonor.userData.at(inFrame(donor, site).add(V(0, D.r * 1.2, 0)), 0, 0.05, a * smooth(q, 0.03, 0.07) * (cfg.micro ? 1 - zoomIn : 1));
        const sh = which >= 0 ? span(q, erupt[which], erupt[which] + 0.3) : 0;
        /* Beside the shell's waist (at its pole it ran off the top). */
        tShell.userData.at(V(SR * 0.55 * out(sh), 0, 0), 0.05, 0.02, cfg.micro ? 0 : a * win(sh, 0.15, 0.7, 0.08));
        if (year) {
          year.userData.draw(titleAt(cfg.years, q));
          ctx.fade(year, a * smooth(q, 0.04, 0.08));
        }
        if (ch) ch.show(span(q, cfg.chart.from ?? 0.05, cfg.chart.to ?? 0.95), a * smooth(q, (cfg.chart.from ?? 0.05) - 0.03, cfg.chart.from ?? 0.05));
      },
    };
  };
}

/* ------------------------------------------------------------ mergers */

/*
 * Two bodies spiralling together and merging. cfg.kind:
 *   "neutron"  two neutron stars: the merger flash, a jet (a short
 *              gamma-ray burst), and the kilonova -- debris glowing blue,
 *              then red as heavy elements form in it
 *   "bh"       two black holes (ray-traced), merging into one; the ripples
 *              in space spreading out
 *   "stars"    two ordinary stars (a luminous red nova): the merged star
 *              swells into a cool red giant and lights up its old dust
 * q: { merge }, `chart`, `titles`, `labels`, `echo` (light-echo radius).
 */
export function mergerScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const Q = { merge: 0.42, ...(cfg.q ?? {}) };
    const g = new THREE.Group();
    site.add(g);
    const a0 = cfg.sep ?? 8;
    const kind = cfg.kind;
    let A = null;
    let B = null;
    let holes = null;
    let nsA = null;
    let nsB = null;
    if (kind === "neutron") {
      /* Round 91 (the owner's GW170817 picture): each neutron star a ball
       * of cracked, blue-hot crust with white-hot seams. */
      A = new THREE.Group();
      B = new THREE.Group();
      g.add(A, B);
      nsA = realStar(ctx, A, 0.35, "ns");
      nsB = realStar(ctx, B, 0.32, "ns");
    } else if (kind === "bh") {
      /* Both holes in one traced sphere, bending the same sky. */
      lensSky(ctx, g);
      holes = blackHole(ctx, g, cfg.rsA ?? 0.72, { bound: (a0 * 1.9) / (cfg.rsA ?? 0.72), disc: 0, sky: 1 });
    } else {
      A = star(ctx, g, cfg.rA ?? 1.2, { colour: "#ffd9a8", hot: "#fff4e0", halo: 2.4 });
      B = star(ctx, g, cfg.rB ?? 0.7, { colour: "#ffb08a", hot: "#ffe2c8", halo: 2.4 });
    }
    const groupA = kind === "bh" ? new THREE.Object3D() : A;
    const groupB = kind === "bh" ? new THREE.Object3D() : B;
    const fadeStar = (m, al) => {
      m.material.uniforms.uOpacity.value = al;
      m.visible = al > 0.002;
      if (m.userData.halo) ctx.fade(m.userData.halo, al);
    };
    /* After a neutron-star merger: for a moment one hot, spinning,
     * too-heavy neutron star, then (probably) a black hole with a torus of
     * left-over debris round it (Shibata 2019). */
    const hmns = kind === "neutron" ? realStar(ctx, g, 0.5, "ns") : null;
    if (hmns) fadeStar(hmns, 0);
    const torus = kind === "neutron" ? accretion(ctx, g, 0.55, a0 * 0.45, { count: 2600, hot: "#fff2d8", cool: "#ff6a3a", size: 2.4, thick: 0.1 }) : null;
    const fl = flash(ctx, g, kind === "stars" ? "#ffd2b0" : "#ffffff");
    const blaze = kind === "bh" ? null : screenFlash(ctx, H);
    const fl2 = flash(ctx, g, kind === "neutron" ? "#9fc8ff" : "#ffb08a");
    /* Debris: a kilonova's fast blue (polar) and slower red (equatorial)
     * parts; a red nova's cool outflow. */
    const blue = kind === "neutron" ? burst(ctx, g, { count: 1400, colours: ["#bcd8ff", "#e8f0ff", "#9fc8ff"], seed: 91, size: 2.2, lobes: 2 }) : null;
    const red = kind !== "bh" ? burst(ctx, g, { count: 2000, colours: kind === "neutron" ? ["#ff7a4a", "#ffb07a", "#ffd27f"] : ["#ff5a3a", "#ff8a5a", "#c84a3a"], seed: 92, size: 2.4, flat: kind === "neutron" ? 0.6 : 0.3 }) : null;
    /* The jet (GW170817's short gamma-ray burst): gas at nearly the speed
     * of light along the spin axis, a few degrees wide (round 91: gas, not
     * a cone). */
    const jet = kind === "neutron" ? particleJet(ctx, g, a0 * 5, { count: 1400, width: 0.045, colour: "#d8e6ff", core: "#ffffff", seed: 77, size: 13, speed: 0.7 }) : null;
    /* Ripples in space (gravitational waves): rings spreading in the
     * orbit's plane, closer together as the orbit speeds up. */
    const waves = kind !== "stars" ? Array.from({ length: 10 }, () => ctx.circle(1, { plane: "xz", colour: "#9fc8ff", opacity: 0.5, parent: g })) : [];
    /* The merged star swelling into a red giant (red nova). */
    /* Round 91: a real red supergiant's surface (few huge cells). */
    const giant = kind === "stars" ? realStar(ctx, g, 1, "rsg", { dust: false }) : null;
    if (giant) fadeStar(giant, 0);
    /* The dust round V838 Mon, rebuilt in 3D from the owner's Hubble
     * picture (round 91): lit by the flash as it reaches each part. */
    const echoNeb = cfg.echoPhoto ? imageNebula(ctx, g, deepAsset(cfg.echoPhoto.file), cfg.echoPhoto.width, cfg.echoPhoto) : null;
    if (echoNeb) echoNeb.show(0);
    const echo = cfg.echo && !echoNeb ? cloudOf(ctx, g, 5000, (r) => {
      const d = V(gauss(r), gauss(r), gauss(r)).normalize();
      const shellR = [cfg.echo * 0.45, cfg.echo * 0.7, cfg.echo][Math.floor(r() * 3)];
      return { p: d.multiplyScalar(shellR * (0.92 + 0.16 * r())), c: r() < 0.5 ? "#ffd2a8" : "#bcd0ff", a: 0.25 + 0.4 * r(), s: 1.2 };
    }, { size: 2.2, seed: 93 }) : null;
    const echoD = echo ? Array.from({ length: 5000 }, (_, i) => Math.hypot(echo.base[i * 3], echo.base[i * 3 + 1], echo.base[i * 3 + 2])) : null;
    if (echo) echo.show(0);
    const ch = lightChart(ctx, H, cfg.chart);
    const L = cfg.labels ?? {};
    const tA = tag(L.a ?? [""], { height: 0.034, colour: "#cfe2ff" });
    const tB = tag(L.b ?? [""], { height: 0.034, colour: "#cfe2ff" });
    const tAfter = tag(L.after ?? [""], { height: 0.038, colour: "#ffd2b0" });
    const tDebris = tag(L.debris ?? [""], { height: 0.036, colour: "#ffc8a8" });
    const tWaves = tag(L.waves ?? ["Ripples in space itself"], { height: 0.034, colour: "#9fc8ff" });
    const tEcho = tag(L.echo ?? [""], { height: 0.034, colour: "#ffd2a8" });
    let phase = 0;
    let lastT = null;
    const centre = V();
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const t = ctx.t;
        if (lastT == null) lastT = t;
        const dts = Math.max(0, Math.min(0.1, t - lastT));
        lastT = t;
        /* The orbit shrinking: separation ~ (time left)^(1/4) for an
         * inspiral driven by gravitational waves (Peters 1964); the angular
         * speed by Kepler's third law, ~ separation^-1.5. */
        const left = clamp01(1 - q / Q.merge);
        const sep = q < Q.merge ? Math.max(0.02, a0 * Math.pow(left, 0.25)) : 0;
        const w = Math.min(14, 0.6 * Math.pow(a0 / Math.max(sep, a0 * 0.18), 1.5));
        phase += dts * w;
        const fA = cfg.massRatio ?? 0.45;
        if (q < Q.merge) {
          groupA.position.set(Math.cos(phase) * sep * fA, 0, Math.sin(phase) * sep * fA);
          groupB.position.set(-Math.cos(phase) * sep * (1 - fA), 0, -Math.sin(phase) * sep * (1 - fA));
        }
        const merged = q >= Q.merge;
        const mk = span(q, Q.merge, Q.merge + 0.12);
        if (kind === "neutron") {
          nsA.rotation.y = t * 3;
          nsB.rotation.y = -t * 2.4;
          fadeStar(nsA, a * (merged ? 0 : 1));
          fadeStar(nsB, a * (merged ? 0 : 1));
          /* In the last moments each is pulled long toward the other. */
          const pull = 1 + 0.55 * Math.pow(1 - clamp01(left / 0.07), 2);
          A.rotation.y = -phase;
          B.rotation.y = -phase;
          A.scale.set(pull, 1 / Math.sqrt(pull), 1 / Math.sqrt(pull));
          B.scale.copy(A.scale);
          /* The merged star: hot, swollen, collapsing within a moment. */
          const hk = merged ? Math.exp(-(q - Q.merge) / 0.03) : 0;
          hmns.scale.setScalar(1 + 0.3 * hk);
          hmns.rotation.y = t * 8;
          fadeStar(hmns, a * hk);
          torus.update(t, 1, a * (merged ? smooth(q, Q.merge + 0.01, Q.merge + 0.06) * (1 - 0.5 * smooth(q, 0.8, 1)) : 0));
        } else if (kind === "bh") {
          holes.uniforms.uOpacity.value = a;
          holes.mesh.visible = a > 0.002;
          if (!merged) holes.setHoles(groupA.position, cfg.rsA ?? 0.72, groupB.position, cfg.rsB ?? 0.58);
          else {
            /* Ringing down: the new hole wobbles for an instant. */
            const ring = 1 + 0.06 * Math.exp(-(q - Q.merge) / 0.02) * Math.sin((q - Q.merge) * 900);
            holes.setHoles(V(), (cfg.rsC ?? 1.24) * ring, null, 0);
          }
        } else {
          ctx.fade(A, a * (merged ? 0 : 1));
          ctx.fade(B, a * (merged ? 0 : 1));
          const swell = smooth(q, Q.merge, Q.merge + 0.3);
          giant.scale.setScalar(Math.max(1e-3, lerp(1.4, cfg.giantR ?? 9, swell)));
          giant.rotation.y = t * 0.05;
          fadeStar(giant, a * (merged ? 1 : 0));
        }
        /* The camera. */
        let dist = merged ? lerp(a0 * 2.6, cfg.afterView ?? a0 * 5, easeInOut(span(q, Q.merge, Q.merge + 0.3))) : lerp(a0 * 3.6, a0 * 2.6, easeInOut(span(q, 0, Q.merge)));
        if (kind === "neutron") {
          /* Round 91 (the owner's picture of the crash): in close with the
           * shrinking orbit, so the two crusts fill the view as they touch;
           * out again with the blast. */
          const follow = Math.max(sep * 3.2, 2.6);
          dist = merged ? lerp(2.6, cfg.afterView ?? a0 * 5, easeInOut(span(q, Q.merge, Q.merge + 0.3))) : Math.min(dist, lerp(dist, follow, smooth(q, Q.merge * 0.5, Q.merge * 0.9)));
        }
        orbitView(U, centre, dist, (cfg.yaw ?? 0.3) + q * 0.6, cfg.pitch ?? 0.42);
        /* The flash. */
        const fk = merged ? Math.exp(-(q - Q.merge) / (kind === "bh" ? 0.02 : 0.05)) : 0;
        /* Two black holes merging give off no light (only gravitational
         * waves, drawn as the rings): no flash for them. */
        const lit = kind === "bh" ? 0 : 1;
        fl.set(lerp(a0 * 0.8, a0 * 3, out(mk)), a * fk * lit);
        blaze?.set(a * fk * 0.9, clamp01((q - Q.merge) / 0.12));
        fl2.set(a0 * 4, a * fk * 0.4 * lit);
        /* Debris. */
        const dk = out(span(q, Q.merge, 1));
        blue?.set(a0 * 3.2 * dk, a * (merged ? 1 - smooth(q, Q.merge + 0.2, Q.merge + 0.4) : 0));
        red?.set(a0 * (kind === "stars" ? 1.6 : 2.2) * dk + (kind === "stars" ? 1.5 : 0), a * (merged ? smooth(q, Q.merge + 0.02, Q.merge + 0.12) * (kind === "stars" ? 0.5 : 1) : 0));
        if (jet) jet.set(t, a * 0.9 * win(q, Q.merge, Q.merge + 0.22, 0.02), out(span(q, Q.merge + 0.005, Q.merge + 0.08)));
        /* Gravitational waves. */
        waves.forEach((ring, i) => {
          const period = 1 / Math.max(0.3, w * 0.25);
          const age = (t / period + i / waves.length) % 1;
          const rr = merged ? a0 * 6 * ((t * 0.6 + i / waves.length) % 1) : sep * 0.6 + age * a0 * 5;
          ring.scale.setScalar(Math.max(1e-3, rr));
          /* Round 91: none drawn once two black holes have merged (the
           * owner: "remove those gravitational lines"). */
          const strength = merged ? (kind === "bh" ? 0 : Math.exp(-(q - Q.merge) / 0.06)) : 0.3 + 0.7 * (1 - left);
          ctx.fade(ring, a * strength * (1 - (merged ? 0 : age)) * 0.45);
        });
        /* A light echo (V838 Mon): the flash lighting up shells of old dust
         * one after another as it reaches them. */
        if (echoNeb) {
          const reach = cfg.echoPhoto.width * 0.55 * span(q, Q.merge, 1);
          echoNeb.reveal(reach, cfg.echoPhoto.width * 0.12);
          echoNeb.show(a * (merged ? 1 : 0));
          tEcho.userData.at(V(-reach * 0.7, -reach * 0.45, 0), 0, -0.04, a * win(q, Q.merge + 0.3, 0.95, 0.04));
        }
        if (echo) {
          const reach = cfg.echo * 1.1 * span(q, Q.merge, 1);
          for (let i = 0; i < 5000; i += 1) echo.cloud.alpha[i] = echo.alpha0[i] * (merged ? Math.exp(-Math.abs(echoD[i] - reach) / (cfg.echo * 0.08)) : 0);
          echo.cloud.commit();
          echo.show(a * (merged ? 1 : 0));
          tEcho.userData.at(V(reach * 0.7, reach * 0.7, 0), 0.03, 0.04, a * win(q, Q.merge + 0.15, 0.95, 0.04));
        }
        /* Labels. */
        const lab = (q < Q.merge - 0.03 ? 1 : 0) * a * smooth(q, 0.02, 0.06);
        const off = L.below ? -0.16 : 0.07;
        tA.userData.at(groupA.position, 0, L.below ? off : 0.07, lab);
        tB.userData.at(groupB.position, 0, L.below ? off : -0.07, lab);
        /* (Round 91: it gives way to the echo's label, which overlapped it.) */
        tAfter.userData.at(V(0, kind === "stars" ? (cfg.giantR ?? 9) * 1.15 : a0 * 0.25, 0), 0, 0.06, a * smooth(q, Q.merge + 0.14, Q.merge + 0.2) * (cfg.echo ? 1 - smooth(q, Q.merge + 0.26, Q.merge + 0.3) : 1));
        tDebris.userData.at(V(a0 * 2.2 * dk, 0, 0), 0.04, 0.05, a * win(q, Q.merge + 0.08, 0.92, 0.04) * (L.debris ? 1 : 0));
        tWaves.userData.at(V(0, -a0 * 0.15, a0 * 1.9), 0, -0.06, kind === "stars" ? 0 : a * win(q, 0.12, Q.merge + 0.08, 0.04));
        if (ch) ch.show(span(q, cfg.chart.from ?? 0.05, cfg.chart.to ?? 0.95), a * smooth(q, (cfg.chart.from ?? 0.05) - 0.03, cfg.chart.from ?? 0.05));
      },
    };
  };
}

export { titleAt, lightChart, out };

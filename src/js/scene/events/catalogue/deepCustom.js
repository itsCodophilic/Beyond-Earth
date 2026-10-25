import * as THREE from "three";
import { smooth, win, span, lerp, clamp01, TAU, easeInOut, rng } from "./kit.js";
import { star, realStar, burst, accretion, blackHole, lensSky, neutronStar, flash, cloudOf, shock, galaxy, planet, gauss, V, inFrame } from "./deepObjects.js";
import { chart, orbitView, curveThrough, picture, deepAsset } from "./deepVoyage.js";
import { titleAt, lightChart, out } from "./deepScenes.js";

/**
 * Round 88: the scenes of the redesigned deep-sky events that are their
 * own -- a magnetar's starquake (and a fast radio burst), Proxima's flare
 * on its planet, Betelgeuse dimming behind its dust, a star torn apart by
 * a black hole, the black hole at the Milky Way's heart, and two galaxies
 * merging. Each returns a voyage `build`. Sizes are drawing units; each
 * event's `accuracy` line says what is to scale.
 */

/* ------------------------------------------------------------ magnetar */

/*
 * A magnetar: a neutron star with a twisted magnetic field. The crust
 * strains, cracks (a starquake), the field snaps to a new shape and lets
 * out a fireball; a hot cloud trapped in the field then pulses as the
 * star turns (SGR 1806-20 turns every 7.56 s). cfg.frb: instead of a giant
 * flare, a millisecond radio burst flies out (SGR 1935+2154, 2020).
 */
export function magnetarScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const Q = { quake: 0.3, flare: 0.4, ...(cfg.q ?? {}) };
    const g = new THREE.Group();
    site.add(g);
    const r = 1;
    const ns = neutronStar(ctx, g, r, { tilt: 0.3, beamLen: 0.1, field: true, reach: [2.5, 4, 6, 9], lines: 10, colour: "#d8e6ff" });
    ns.beams.forEach((b) => { b.cone.visible = false; b.core.visible = false; ctx.fade(b.cone, 0); ctx.fade(b.core, 0); });
    /* Round 91 (the owner's magnetar picture, an artist's view built on
     * the physics): a blue-white surface, fine-grained, under arcs of its
     * field; at the starquake the crust's seams glow (no drawn lines), and
     * the flare bursts out of one spot. */
    ns.ball.visible = false;
    ctx.fade(ns.ball, 0);
    const surface = realStar(ctx, ns.spin, r, "magnetar");
    const spotAt = V(-0.45, 0.8, 0.4).normalize().multiplyScalar(r * 1.02);
    const spot = ctx.glow("#ffffff", r * 1.4, { opacity: 1, parent: ns.spin });
    spot.position.copy(spotAt);
    ctx.fade(spot, 0);
    const fl = flash(ctx, g, "#ffffff");
    const fire = shock(ctx, g, "#cfe2ff", { power: 1.6, seed: 4 });
    const ball = flash(ctx, g, "#bcd8ff");
    const radio = shock(ctx, g, "#ff9ad0", { power: 6, seed: 9 });
    /* Which way Earth is: a dashed line out of the picture. */
    /* Round 91: toward the open left of the screen -- to the right its
     * label sat behind the event card. */
    const earthDir = V(-0.9, 0.3, -0.3).normalize();
    const toEarth = ctx.line([earthDir.clone().multiplyScalar(r * 2), earthDir.clone().multiplyScalar(r * 40)], { colour: "#9fd0ff", opacity: 0.6, dashed: true, dash: 0.6, gap: 0.4, parent: g, additive: false });
    ctx.fade(toEarth, 0);
    const tEarth = tag(["To Earth"], { height: 0.032, colour: "#9fd0ff" });
    const tStar = tag(cfg.labels?.star ?? ["Magnetar", "20 km across"], { height: 0.036, colour: "#cfe2ff" });
    const tField = tag(cfg.labels?.field ?? ["Its magnetic field", "a thousand trillion times Earth's"], { height: 0.034, colour: "#8fb8ff" });
    const tQuake = tag(cfg.labels?.quake ?? ["A starquake", "the crust cracks"], { height: 0.036, colour: "#fff2c8" });
    const tFlare = tag(cfg.labels?.flare ?? ["The flare", ""], { height: 0.038, colour: "#ffffff" });
    const ch = lightChart(ctx, H, cfg.chart);
    const centre = V();
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const t = ctx.t;
        ns.update(t, cfg.spin ?? 0.13);
        const quake = win(q, Q.quake, Q.flare + 0.04, 0.02);
        const shake = quake * 0.04 * Math.sin(t * 60);
        ns.spin.position.set(shake, -shake * 0.6, shake * 0.3);
        surface.material.uniforms.uOpacity.value = a;
        surface.visible = a > 0.002;
        if (surface.userData.halo) ctx.fade(surface.userData.halo, a);
        surface.material.uniforms.uCrack.value = quake * (0.8 + 0.2 * Math.sin(t * 25));
        surface.material.uniforms.uFlicker.value = 0.25 * quake * Math.sin(t * 40);
        /* The field: twisted, then snapping into a new shape. */
        const snap = smooth(q, Q.flare, Q.flare + 0.03);
        ns.fieldGroup.rotation.y = 0.6 * (1 - snap) * Math.sin(q * 30) * quake + (1 - snap) * 0.25;
        ns.fieldGroup.scale.setScalar(1 + 0.12 * quake * (1 - snap));
        ctx.fade(ns.fieldGroup, a * (1 - 0.6 * win(q, Q.flare, Q.flare + 0.12, 0.02)));
        /* The flare. */
        const since = q - Q.flare;
        const spike = since >= 0 ? Math.exp(-since / (cfg.frb ? 0.01 : 0.025)) : 0;
        fl.set(lerp(r * 4, r * 60, out(clamp01(since / 0.05))), a * spike * (cfg.frb ? 0.5 : 1));
        ctx.fade(spot, a * (since >= -0.02 ? Math.exp(-Math.max(0, since) / 0.08) * smooth(since, -0.02, 0) : 0));
        if (!cfg.frb) {
          fire.set(r * 40 * out(clamp01(since / 0.15)), a * (since >= 0 ? 0.8 * (1 - smooth(since, 0.05, 0.2)) : 0));
          /* The trapped fireball, pulsing as the star turns (shape of the
           * 2004 tail: 7.56-second pulses, fading over minutes). */
          const tail = since > 0.02 ? Math.exp(-since / 0.35) : 0;
          const pulse = 0.5 + 0.5 * Math.cos(ns.angle);
          ball.sprite.position.copy(V(0, r * 2.2, 0).applyAxisAngle(V(0, 1, 0), ns.angle));
          ball.set(r * (3 + 2 * pulse), a * tail * (0.4 + 0.6 * pulse));
        } else {
          radio.set(r * 60 * clamp01(since / 0.25), a * (since >= 0 ? 0.8 * (1 - smooth(since, 0.15, 0.3)) : 0));
        }
        /* The camera: close, then back to see the flare. */
        const dist = lerp(lerp(14, 9, smooth(q, 0, 0.25)), cfg.frb ? 60 : 40, smooth(q, Q.flare, Q.flare + 0.12));
        orbitView(U, centre, dist, (cfg.yaw ?? 0.2) + q * 0.6, 0.25);
        ctx.fade(toEarth, a * smooth(q, Q.flare + 0.05, Q.flare + 0.1));
        tEarth.userData.at(earthDir.clone().multiplyScalar(r * 13), 0, 0.05, a * smooth(q, Q.flare + 0.05, Q.flare + 0.1));
        tStar.userData.at(V(0, -r * 1.3, 0), 0, -0.05, a * smooth(q, 0.02, 0.06) * (1 - spike));
        tField.userData.at(V(r * 4.2, r * 2.5, 0), 0.04, 0.04, a * win(q, 0.06, Q.quake, 0.03));
        tQuake.userData.at(V(-r * 1.2, r * 0.8, 0), -0.04, 0.06, a * win(q, Q.quake + 0.01, Q.flare, 0.02));
        tFlare.userData.at(V(0, r * 6, 0), 0, 0.06, a * win(q, Q.flare + 0.02, Q.flare + 0.3, 0.03));
        if (ch) ch.show(span(q, cfg.chart.from ?? Q.flare - 0.05, cfg.chart.to ?? 0.9), a * smooth(q, (cfg.chart.from ?? Q.flare - 0.05) - 0.03, cfg.chart.from ?? Q.flare - 0.05));
      },
    };
  };
}

/* ------------------------------------------------------------ Proxima */

/*
 * Proxima Centauri, a red dwarf a seventh the Sun's width, with its planet
 * Proxima b; the Sun drawn beside it to the same scale. A magnetic loop
 * snaps, the star flares, a blast of particles crosses to the planet and
 * strips gas from its air.
 */
export function proximaScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const Q = { flare: 0.38, ...(cfg.q ?? {}) };
    const g = new THREE.Group();
    site.add(g);
    const R = 1.4;
    const st = star(ctx, g, R, { colour: "#ff5a2a", hot: "#ff9a5a", halo: 2.4, granule: 14 });
    /* The Sun to the same scale: Proxima is 0.154 Sun radii (Ribas et al.
     * 2017), so the Sun is 6.5 times wider. Drawn as an outline. */
    const sunR = R / 0.154;
    const sunGhost = ctx.circle(sunR, { plane: "xy", colour: "#ffe9a8", opacity: 0.5, parent: g, additive: false });
    sunGhost.position.set(-sunR - R * 3, 0, 0);
    ctx.fade(sunGhost, 0);
    /* Proxima b, drawn at 12 star radii (really 68: 0.0485 AU, Anglada-
     * Escudé et al. 2016) and enlarged. */
    const orbitR = R * 12;
    const orbit = ctx.circle(orbitR, { colour: "#9fb3c8", opacity: 0.3, parent: g });
    const pb = planet(ctx, g, R * 0.5, { a: "#8a6a5a", b: "#b0907a", c: "#6a5a50", bands: 4, rim: "#9fc8ff", rimK: 0.8, seed: 2.2 });
    /* Its air, being stripped. */
    const strip = cloudOf(ctx, g, 500, () => ({ p: V(), c: "#9fd0ff", a: 0.6, s: 1 }), { size: 2, seed: 5 });
    strip.ph = Array.from({ length: 500 }, (_, i) => (i * 0.618) % 1);
    /* The flare: a loop, a flash, a blast of particles toward the planet. */
    const loopPts = [];
    for (let i = 0; i <= 40; i += 1) {
      const th = (i / 40) * Math.PI;
      loopPts.push(V(Math.cos(th) * 0.35 * R, Math.sin(th) * 0.55 * R, 0));
    }
    const loopG = new THREE.Group();
    g.add(loopG);
    const loop = ctx.line(loopPts, { colour: "#fff2c8", opacity: 1, parent: loopG });
    const fl = flash(ctx, g, "#fff2e8");
    const blast = burst(ctx, g, { count: 1600, colours: ["#ffd2a8", "#ffffff", "#ff9a7a"], seed: 12, size: 2.6, aim: V(1, 0, 0), focus: 0.86, thick: 0.7 });
    const tStar = tag(["Proxima Centauri", "a red dwarf, a seventh the Sun's width"], { height: 0.036, colour: "#ffb08a" });
    const tSun = tag(["Our Sun, to the same scale"], { height: 0.034, colour: "#ffe9a8" });
    const tPlanet = tag(["Proxima b", "at least 1.07 Earths · year: 11.2 days"], { height: 0.034, colour: "#cfe2ff" });
    const tFlare = tag(["The superflare", "68 times brighter in minutes"], { height: 0.038, colour: "#ffffff" });
    const tStrip = tag(["Air stripped away", ""], { height: 0.032, colour: "#9fd0ff" });
    const ch = lightChart(ctx, H, cfg.chart);
    const centre = V();
    const pPos = V();
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const t = ctx.t;
        /* The planet round the star (11.2 days, drawn as seconds). */
        const ang = 2.2 + t * 0.12;
        pPos.set(Math.cos(ang) * orbitR, 0, -Math.sin(ang) * orbitR);
        pb.position.copy(pPos);
        pb.userData.setLight(V(0, 0, 0));
        /* Where the flare goes off: the side facing the planet. */
        const facing = pPos.clone().normalize();
        loopG.position.copy(facing.clone().multiplyScalar(R * 0.98));
        loopG.quaternion.setFromUnitVectors(V(0, 1, 0), facing);
        const since = q - Q.flare;
        const fk = since >= 0 ? Math.exp(-since / 0.05) : 0;
        ctx.fade(loop, a * win(q, Q.flare - 0.1, Q.flare + 0.02, 0.02));
        loopG.scale.setScalar(1 + 2 * smooth(q, Q.flare - 0.02, Q.flare));
        fl.sprite.position.copy(facing.clone().multiplyScalar(R * 1.1));
        fl.set(lerp(R * 3, R * 16, out(clamp01(since / 0.04))), a * fk);
        st.scale.setScalar(1 + 0.04 * fk);
        /* 68 times brighter: the star itself goes white-hot for a moment. */
        st.material.uniforms.uColor.value.set("#ff5a2a").lerp(new THREE.Color("#fff4ec"), fk);
        /* The blast, aimed along `facing`, reaching the planet. */
        const bk = clamp01(since / 0.16);
        blast.cloud.points.quaternion.setFromUnitVectors(V(1, 0, 0), facing);
        blast.set(orbitR * 1.2 * bk, a * (since >= 0 ? 1 - smooth(bk, 0.85, 1) : 0));
        /* The planet's air streaming off once the blast arrives. */
        const hit = smooth(since, 0.12, 0.16) * (1 - smooth(since, 0.4, 0.55));
        for (let i = 0; i < 500; i += 1) {
          const u = (strip.ph[i] + t * 0.4) % 1;
          const sp = gauss(() => ((i * 0.37 + u * 7.3) % 1));
          strip.cloud.set(i, pPos.x + facing.x * u * R * 4 + sp * u * R * 0.8, pPos.y + sp * 0.3 * u * R, pPos.z + facing.z * u * R * 4 - sp * u * R * 0.5);
        }
        strip.cloud.commit();
        strip.show(a * hit);
        /* The camera: Proxima and its planet, then the Sun beside it. */
        const sunK = smooth(q, 0.82, 0.9);
        ctx.fade(sunGhost, a * sunK);
        sunGhost.lookAt(U.eye);
        const look = V(-sunR * 0.9 * sunK, 0, 0);
        const dist = lerp(lerp(orbitR * 2.6, orbitR * 1.9, smooth(q, 0, 0.2)), sunR * 4.4, sunK);
        orbitView(U, look, dist, (cfg.yaw ?? 0.5) + q * 0.4, lerp(0.38, 0.1, sunK));
        tStar.userData.at(V(0, R * 1.3, 0), 0, 0.06, a * smooth(q, 0.02, 0.06) * (1 - fk));
        tPlanet.userData.at(pPos.clone().add(V(0, R * 0.6, 0)), 0, 0.05, a * smooth(q, 0.06, 0.1) * (1 - sunK));
        tFlare.userData.at(facing.clone().multiplyScalar(R * 3).add(V(0, R * 1.5, 0)), 0, 0.05, a * win(q, Q.flare, Q.flare + 0.18, 0.02));
        tStrip.userData.at(pPos.clone().add(facing.clone().multiplyScalar(R * 2)), 0.04, -0.05, a * hit);
        tSun.userData.at(V(-sunR - R * 3, sunR * 1.05, 0), 0, 0.05, a * sunK);
        if (ch) ch.show(span(q, cfg.chart.from ?? Q.flare - 0.06, cfg.chart.to ?? Q.flare + 0.3), a * win(q, (cfg.chart.from ?? Q.flare - 0.06) - 0.03, 0.84, 0.03));
      },
    };
  };
}

/* ------------------------------------------------------------ Betelgeuse */

/*
 * Betelgeuse: a red supergiant whose boiling surface threw off a bubble of
 * gas from its southern half in 2019; the gas cooled into dust and hid
 * part of the star from us. Then: how big it is, with the inner Solar
 * System drawn round it to scale.
 */
export function betelgeuseScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const g = new THREE.Group();
    site.add(g);
    const R = 6;
    /* Its surface: a few giant convection cells (Montargès et al.).
     * Round 91 (the owner's Betelgeuse picture, ESO's view of its
     * extended atmosphere and plume, Kervella et al. 2009): a boiling
     * orange surface inside a vast, glowing red-orange envelope of gas
     * several times its radius, with a plume of gas curling out of it. */
    const st = realStar(ctx, g, R, "rsg", { dust: false, cells: 1.7, hot: "#ffd08a", mid: "#ff7a2a", cool: "#6a1a06" });
    const envelope = cloudOf(ctx, g, 2600, (r) => {
      const d = V(gauss(r), gauss(r), gauss(r)).normalize();
      const k = Math.pow(r(), 1.8);
      return { p: d.multiplyScalar(R * (1.05 + 2.6 * k)), c: k < 0.3 ? "#ff8a3a" : k < 0.7 ? "#e8521e" : "#a8300e", a: 0.05 + 0.07 * (1 - k), s: 0.7 + r() };
    }, { size: 30, seed: 31 });
    /* The plume: gas carried out along a curl, as in the picture. */
    const plume = cloudOf(ctx, g, 1800, (r) => {
      const u = r();
      const ang = 0.6 + u * 2.6;
      const rad = R * (1.0 + 2.4 * u);
      const w = R * (0.15 + 0.45 * u);
      return { p: V(Math.cos(ang) * rad + gauss(r) * w, Math.sin(ang) * rad * 0.55 + gauss(r) * w, -R * 0.4 + gauss(r) * w), c: r() < 0.6 ? "#ff9a4a" : "#ffc07a", a: 0.06 + 0.1 * (1 - u), s: 0.6 + r() };
    }, { size: 22, seed: 32 });

    /* The bubble of gas, from the southern half toward us (+z is toward
     * the camera at the start), then dust: drawn as a dark veil. */
    const gas = cloudOf(ctx, g, 1600, (r) => {
      const d = V(gauss(r) * 0.6, -0.55 + gauss(r) * 0.3, 1).normalize();
      return { p: d.multiplyScalar(R * (1.05 + 0.5 * r())), c: "#ffb08a", a: 0.25 + 0.4 * r(), s: 1.4 };
    }, { size: 6, seed: 8 });
    const dust = cloudOf(ctx, g, 2600, (r) => {
      const d = V(gauss(r) * 0.55, -0.5 + gauss(r) * 0.28, 1).normalize();
      return { p: d.multiplyScalar(R * (1.25 + 0.6 * r())), c: "#0a0605", a: 0.35, s: 1 + r() };
    }, { size: 22, seed: 9, additive: false });
    /* The inner Solar System to the same scale: Betelgeuse's radius is
     * about 764 Suns = 3.55 AU (Joyce et al. 2020), so 1 AU = R / 3.55.
     * Orbits: Mercury 0.39, Venus 0.72, Earth 1, Mars 1.52, Jupiter 5.2. */
    const AU = R / 3.55;
    const orbits = [["Mercury", 0.39], ["Venus", 0.72], ["Earth", 1], ["Mars", 1.52], ["Jupiter", 5.2]].map(([name, a]) => {
      const ring = ctx.circle(a * AU, { colour: name === "Jupiter" ? "#ffd27f" : "#9fd0ff", opacity: 0.8, parent: g, additive: false });
      ring.renderOrder = 30;
      ring.material.depthTest = false;
      return { name, a, ring, label: tag([name], { height: 0.03, colour: name === "Jupiter" ? "#ffd27f" : "#9fd0ff" }) };
    });
    const sun = ctx.glow("#fff4e0", AU * 0.25, { opacity: 1, parent: g });
    sun.material.depthTest = false;
    const tStar = tag(["Betelgeuse", "a red supergiant, about 15–20 Suns"], { height: 0.036, colour: "#ffb08a" });
    const tGas = tag(["A bubble of gas thrown off", "2019"], { height: 0.034, colour: "#ffd2b0" });
    const tDust = tag(["…cooling into dust", "hiding the southern half"], { height: 0.034, colour: "#d8c8b8" });
    const tScale = tag(["If it stood where the Sun is", "it would reach past Mars, toward Jupiter"], { height: 0.04, colour: "#ffe2a8" });
    const ch = lightChart(ctx, H, cfg.chart);
    const centre = V();
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const t = ctx.t;
        st.material.uniforms.uOpacity.value = a;
        st.visible = a > 0.002;
        if (st.userData.halo) ctx.fade(st.userData.halo, a);
        st.rotation.y = t * 0.02;
        st.material.uniforms.uFlicker.value = 0.06 * Math.sin(t * 0.9);
        const scaleA = 1 - smooth(q, 0.66, 0.74);
        envelope.set(1 + 0.03 * Math.sin(t * 0.5), a * scaleA);
        envelope.cloud.points.rotation.y = t * 0.01;
        plume.set(1, a * scaleA);
        const gasK = smooth(q, 0.14, 0.3);
        const dustK = smooth(q, 0.3, 0.45) * (1 - smooth(q, 0.62, 0.7));
        gas.set(lerp(0.9, 1.25, gasK), a * gasK * (1 - smooth(q, 0.35, 0.5)));
        dust.set(lerp(0.95, 1.15, smooth(q, 0.3, 0.6)), a * dustK);
        /* The camera: from the direction of Earth (the dust between), then
         * up and away for the scale. */
        const scaleK = smooth(q, 0.66, 0.76);
        const dist = lerp(lerp(R * 5.2, R * 4.4, smooth(q, 0, 0.2)), 5.2 * AU * 3.4, scaleK);
        orbitView(U, centre, dist, lerp(0.15, 0.6, scaleK) + q * 0.15, lerp(0.05, 0.85, scaleK));
        const oa = a * scaleK;
        orbits.forEach((o, i) => {
          ctx.fade(o.ring, oa);
          o.label.userData.at(V(o.a * AU * Math.cos(0.6 + i * 0.5), 0, -o.a * AU * Math.sin(0.6 + i * 0.5)), 0, 0.03, oa * (o.a > 1.2 ? 1 : smooth(q, 0.8, 0.86)));
        });
        ctx.fade(sun, oa);
        /* Beside the star (round 91: above it, it ran into the title). */
        tStar.userData.at(V(R * 1.5, R * 0.95, 0), 0.12, 0, a * win(q, 0.02, 0.16, 0.03) * (1 - scaleK));
        tGas.userData.at(V(0, -R * 0.75, R * 1.1), 0.05, -0.04, a * win(q, 0.16, 0.34, 0.03));
        tDust.userData.at(V(0, -R * 0.75, R * 1.2), 0.05, -0.04, a * win(q, 0.34, 0.64, 0.03));
        tScale.userData.at(V(0, R * 1.2, 0), 0, 0.12, a * smooth(q, 0.8, 0.86));
        if (ch) ch.show(span(q, cfg.chart.from ?? 0.1, cfg.chart.to ?? 0.62), a * win(q, (cfg.chart.from ?? 0.1) - 0.03, 0.68, 0.03));
      },
    };
  };
}

/* ------------------------------------------------------------ tidal disruption */

/*
 * A star on a near-parabolic orbit passes inside a black hole's tidal
 * radius: stretched into a stream; about half the gas escapes, half falls
 * back and forms a hot disc, which flares.
 */
export function tdeScene(cfg) {
  /*
   * Round 93 (Prompts.md: "when the star approaches the black hole it
   * gets torn, and some revolves round the black hole and some is thrown
   * away -- show it that way, realistic"): the debris is now followed
   * under the hole's gravity. The star comes in on a parabola (Rees 1988);
   * at pericentre its pieces keep the star's speed but differ in energy by
   * up to the tidal spread, about G M R* / rp^2 -- half bound, half not.
   * The unbound half flies off for good along hyperbolas; the bound half
   * goes out on long ellipses and falls back, the most bound first (the
   * fall-back rate dropping as t^-5/3, Phinney 1989), the returning stream
   * crossing itself and circularising into a ring and a hot disc that
   * flares. Units: G M = 1; pericentre 8.1 (9 rs). The traced sphere of the
   * hole is kept inside the pericentre (round 93: the star used to pass
   * into it and vanish, then reappear).
   */
  return (U, ctx, H, site, tag) => {
    const g = new THREE.Group();
    site.add(g);
    const rs = 0.9;
    lensSky(ctx, g);
    const bh = blackHole(ctx, g, rs, { bound: 7, rin: 3, rout: 6.5, disc: 0, sky: 1 });
    const S = 1.1;
    const st = realStar(ctx, g, S, "sun");
    const N = 3000;
    const rp = rs * 9;
    const GM = 1;
    /* The approach: r = 2 rp / (1 + cos f). */
    const orbitAt = (f) => {
      const r = (2 * rp) / (1 + Math.cos(f));
      return V(Math.cos(f) * r, 0, Math.sin(f) * r);
    };
    const Q_P = 0.31;
    /* Simulation time per unit of q after pericentre: the most bound gas
     * (a = 14.4) comes back after about 0.19 of the visit. */
    const TAU_Q = 1800;
    const EPS_MAX = GM / (2 * 14.4);
    const rr = rng(21);
    const P = new Float32Array(N * 3);
    const Vv = new Float32Array(N * 3);
    const info = Array.from({ length: N }, () => {
      const sx = rr() * 2 - 1;
      return { s: sx, eps: -sx * EPS_MAX, back: false, hot: 0, side: gauss(rr) * 0.25, up: gauss(rr) * 0.12 };
    });
    const pieces = ctx.cloud(N, { parent: g, size: 2.4 });
    /* The same gas, soft: every third piece as a big faint glow, so the
     * stream and the ring read as gas, not beads on a wire. */
    const NG = Math.floor(N / 3);
    const soft = ctx.cloud(NG, { parent: g, size: 16 });
    const cCool = new THREE.Color("#ffd2a8");
    const cHot = new THREE.Color("#dfe9ff");
    const cTmp = new THREE.Color();
    let simT = -1;
    const reset = () => {
      const vp = Math.sqrt((2 * GM) / rp);
      info.forEach((o, i) => {
        /* Pieces along the stretched star (radial at pericentre), a little
         * spread across it. */
        const x = rp + o.s * S * 1.6;
        const v = Math.sqrt(Math.max(1e-6, 2 * (o.eps + GM / x)));
        P[i * 3] = x; P[i * 3 + 1] = o.up; P[i * 3 + 2] = o.side;
        Vv[i * 3] = 0; Vv[i * 3 + 1] = 0; Vv[i * 3 + 2] = v * (vp > 0 ? 1 : 1);
        o.back = false;
        o.hot = 0;
      });
      simT = 0;
    };
    const step = (dt) => {
      for (let i = 0; i < N; i += 1) {
        const o = info[i];
        let x = P[i * 3]; let y = P[i * 3 + 1]; let z = P[i * 3 + 2];
        let vx = Vv[i * 3]; let vy = Vv[i * 3 + 1]; let vz = Vv[i * 3 + 2];
        let r = Math.hypot(x, y, z);
        if (r > 900) continue;
        /* Smaller steps close in. */
        const sub = r < rp * 2.5 ? 6 : r < rp * 6 ? 2 : 1;
        const h = dt / sub;
        for (let k = 0; k < sub; k += 1) {
          r = Math.max(rs * 2, Math.hypot(x, y, z));
          const ac = -GM / (r * r * r);
          vx += ac * x * h; vy += ac * y * h; vz += ac * z * h;
          /* Back near the hole after going round: the stream crosses itself,
           * shocks and settles toward a circle (radial motion damped), and
           * slowly spirals in. */
          if (o.eps < 0 && simT > 60) {
            const rv = (x * vx + y * vy + z * vz) / r;
            if (r < rp * 2.6 && (o.back || rv < 0)) {
              o.back = true;
              const damp = Math.min(1, 0.02 * h);
              vx -= (rv * x / r) * damp; vy -= (rv * y / r) * damp * 3; vz -= (rv * z / r) * damp;
              /* The shocked gas puffs up a little (turbulence). */
              vx += (Math.random() - 0.5) * 0.004 * h; vy += (Math.random() - 0.5) * 0.002 * h; vz += (Math.random() - 0.5) * 0.004 * h;
              vx *= 1 - 0.0008 * h; vz *= 1 - 0.0008 * h;
              o.hot = Math.min(1, o.hot + 0.01 * h);
            }
          }
          x += vx * h; y += vy * h; z += vz * h;
        }
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
        Vv[i * 3] = vx; Vv[i * 3 + 1] = vy; Vv[i * 3 + 2] = vz;
      }
      simT += dt;
    };
    const fl = flash(ctx, g, "#e8f0ff");
    const tStar = tag(["A star like the Sun"], { height: 0.034, colour: "#ffe2b0" });
    const tHole = tag(cfg.labels?.hole ?? ["Black hole", "about a million Suns"], { height: 0.036, colour: "#cfe2ff" });
    const tStream = tag(["Stretched into a stream", "'spaghettified'"], { height: 0.036, colour: "#ffd2a8" });
    const tAway = tag(["Half flies off", "never to return"], { height: 0.034, colour: "#ffd2a8" });
    const tBack = tag(["Half falls back", "circling, into a hot disc"], { height: 0.034, colour: "#e8f0ff" });
    const ch = lightChart(ctx, H, cfg.chart);
    const centre = V();
    const away = V();
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        /* Before pericentre: the star on its parabola, stretched more and
         * more toward the hole as it nears. */
        const f = lerp(-2.4, 0, easeInOut(span(q, 0, Q_P)));
        const sp = orbitAt(f);
        const near = smooth(q, Q_P - 0.12, Q_P);
        st.position.copy(sp);
        st.lookAt(V(0, 0, 0));
        st.scale.set(1 - 0.35 * near, 1 - 0.35 * near, 1 + 1.8 * near);
        const starA = a * (q < Q_P ? 1 : 1 - smooth(q, Q_P, Q_P + 0.03));
        st.material.uniforms.uOpacity.value = starA;
        st.visible = starA > 0.002;
        if (st.userData.halo) ctx.fade(st.userData.halo, starA);
        st.rotation.z = ctx.t * 0.1;
        /* After: the debris, followed under gravity (restarted if the
         * visit is run back). */
        const want = (q - Q_P) * TAU_Q;
        if (q < Q_P) simT = -1;
        else {
          if (simT < 0 || want < simT - 1) reset();
          let left = Math.min(want - simT, 120);
          while (left > 0.01) { const d = Math.min(3, left); step(d); left -= d; }
        }
        const debrisA = a * smooth(q, Q_P - 0.005, Q_P + 0.02);
        if (debrisA > 0.002 && simT >= 0) {
          let n = 0;
          away.set(0, 0, 0);
          for (let i = 0; i < N; i += 1) {
            const o = info[i];
            pieces.set(i, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
            cTmp.copy(cCool).lerp(cHot, o.hot);
            pieces.tint(i, cTmp);
            const r = Math.hypot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
            pieces.alpha[i] = (0.55 + 0.45 * o.hot) * (1 - smooth(r, 300, 700));
            pieces.size[i] = 2.4 * (1 + 0.8 * o.hot);
            if (o.eps > 0 && i % 7 === 0) { away.x += P[i * 3]; away.y += P[i * 3 + 1]; away.z += P[i * 3 + 2]; n += 1; }
          }
          if (n) away.divideScalar(n);
          pieces.commit();
          for (let j = 0; j < NG; j += 1) {
            const i = j * 3;
            soft.set(j, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
            cTmp.copy(cCool).lerp(cHot, info[i].hot);
            soft.tint(j, cTmp);
            const r = Math.hypot(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
            soft.alpha[j] = (0.05 + 0.07 * info[i].hot) * (1 - smooth(r, 300, 700));
            soft.size[j] = 14 + 10 * info[i].hot;
          }
          soft.commit();
        }
        pieces.opacity = debrisA;
        pieces.points.visible = debrisA > 0.002 && simT >= 0;
        soft.opacity = debrisA;
        soft.points.visible = pieces.points.visible;
        /* The flare as the gas falls back and heats up. */
        const glow = smooth(q, 0.52, 0.66) * (1 - 0.6 * smooth(q, 0.82, 1));
        fl.set(rs * 13, a * glow * 0.4);
        bh.uniforms.uDisc.value = glow;
        bh.uniforms.uOpacity.value = a;
        /* The camera: from above, out a little as the debris spreads. */
        orbitView(U, centre, lerp(lerp(rs * 90, rs * 62, smooth(q, 0, 0.3)), rs * 110, smooth(q, 0.4, 0.7)), 0.4 + q * 0.3, 1.0);
        tStar.userData.at(sp.clone().add(V(0, S * 1.8, 0)), 0, 0.05, a * (1 - near) * smooth(q, 0.02, 0.06));
        tHole.userData.at(V(0, -rs * 3, 0), 0, -0.07, a * smooth(q, 0.04, 0.08) * (1 - smooth(q, 0.4, 0.45)));
        tStream.userData.at(V(rp * 1.6, 0, rp * 1.2), 0.05, 0.05, a * win(q, Q_P + 0.03, 0.5, 0.03));
        tAway.userData.at(away.clone(), 0.04, 0.05, a * win(q, 0.5, 0.95, 0.03));
        tBack.userData.at(V(-rp * 2.2, 0, -rp * 0.6), 0, -0.06, a * win(q, 0.6, 0.97, 0.03));
        if (ch) ch.show(span(q, cfg.chart.from ?? 0.5, cfg.chart.to ?? 0.98), a * smooth(q, (cfg.chart.from ?? 0.5) - 0.03, cfg.chart.from ?? 0.5));
      },
    };
  };
}

/* ------------------------------------------------------------ Sgr A* */

/*
 * The heart of the Milky Way: the S-stars whipping round an unseen mass
 * (S2's orbit to shape: e = 0.886, 16 years, GRAVITY 2018), and then the
 * black hole itself, ray-traced, seen nearly face-on as the Event Horizon
 * Telescope saw it in 2022, with a hot spot circling and flaring.
 */
export function sgrAScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const g = new THREE.Group();
    site.add(g);
    /* Part 1 (S-stars): units where S2's orbit has a = 40. */
    const sg = new THREE.Group();
    g.add(sg);
    const sStars = [
      { name: "S2", a: 40, e: 0.886, inc: 0.3, w: 1.2, P: 16, ph: 0.05 },
      { name: "", a: 55, e: 0.6, inc: 1.2, w: 0.4, P: 30, ph: 0.4 },
      { name: "", a: 32, e: 0.75, inc: 2.2, w: 2.6, P: 12, ph: 0.7 },
      { name: "", a: 70, e: 0.4, inc: 0.8, w: 4.1, P: 45, ph: 0.2 },
      { name: "", a: 48, e: 0.9, inc: 2.6, w: 5.0, P: 25, ph: 0.55 },
    ].map((s) => {
      const pts = [];
      for (let i = 0; i <= 200; i += 1) {
        const f = (i / 200) * TAU;
        const r = (s.a * (1 - s.e * s.e)) / (1 + s.e * Math.cos(f));
        pts.push(V(Math.cos(f + s.w) * r, 0, Math.sin(f + s.w) * r).applyAxisAngle(V(1, 0, 0), s.inc));
      }
      const line = ctx.line(pts, { colour: s.name ? "#ffd27f" : "#9fb3c8", opacity: s.name ? 0.7 : 0.35, parent: sg });
      const dot = star(ctx, sg, 1.1, { colour: "#cfe2ff", hot: "#ffffff", halo: 3, granule: 10 });
      return { ...s, line, dot };
    });
    const centreGlow = ctx.glow("#ffb07a", 6, { opacity: 0.8, parent: sg });
    /* Part 2: the black hole (units: rs = 1). */
    const bg = new THREE.Group();
    g.add(bg);
    const sky = lensSky(ctx, bg);
    const bh = blackHole(ctx, bg, 1, { bound: 26, rin: 2.6, rout: 9, disc: 0.7, sky: 1 });
    const spot = flash(ctx, bg, "#fff2d8");
    const tS2 = tag(["S2", "round in 16 years, 7,650 km/s at its closest"], { height: 0.034, colour: "#ffd27f" });
    const tMass = tag(["Something unseen", "4.3 million Suns, smaller than our Solar System"], { height: 0.036, colour: "#ffd2b0" });
    const tHole = tag(["Sagittarius A*", "its shadow, as the EHT saw it in 2022"], { height: 0.038, colour: "#ffe2b0" });
    const tSpot = tag(["A hot spot flares", "circling in about 45 minutes"], { height: 0.034, colour: "#fff2d8" });
    const ch = lightChart(ctx, H, cfg.chart);
    const centre = V();
    const kepler = (M, e) => { let E = M; for (let i = 0; i < 12; i += 1) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const part2 = smooth(q, 0.45, 0.52);
        const part1A = a * (1 - part2);
        ctx.fade(sg, part1A);
        sg.visible = part1A > 0.002;
        /* The S-stars by Kepler's equation; 30 years shown. */
        const years = q * 60;
        sStars.forEach((s) => {
          const M = TAU * (s.ph + years / s.P);
          const E = kepler(M % TAU, s.e);
          const f = 2 * Math.atan2(Math.sqrt(1 + s.e) * Math.sin(E / 2), Math.sqrt(1 - s.e) * Math.cos(E / 2));
          const r = s.a * (1 - s.e * Math.cos(E));
          s.dot.position.set(Math.cos(f + s.w) * r, 0, Math.sin(f + s.w) * r).applyAxisAngle(V(1, 0, 0), s.inc);
        });
        bg.visible = part2 > 0.002;
        sky.show(part2);
        bh.uniforms.uOpacity.value = a * part2;
        bh.mesh.visible = bg.visible;
        /* The hot spot, circling at about 8 rs, flaring now and then. */
        const ang = ctx.t * 1.6;
        spot.sprite.position.set(Math.cos(ang) * 7, 0.2, -Math.sin(ang) * 7);
        const flare = Math.max(win(q, 0.62, 0.7, 0.02), win(q, 0.8, 0.86, 0.02));
        spot.set(lerp(1.5, 5, flare), a * part2 * (0.35 + 0.65 * flare));
        bh.uniforms.uDisc.value = 0.6 + 0.6 * flare;
        /* The camera: the S-stars from afar, then the hole from nearly
         * face-on (the EHT view: we look at it from about 30° off its
         * axis, GRAVITY 2018). */
        if (part2 < 0.5) orbitView(U, centre, lerp(260, 200, q / 0.45), 0.3 + q * 0.6, 0.55);
        else orbitView(U, centre, lerp(60, 34, smooth(q, 0.5, 0.75)), 0.4 + q * 0.3, lerp(0.9, 1.1, q));
        tS2.userData.at(sStars[0].dot.position, 0, 0.05, part1A * smooth(q, 0.04, 0.08));
        tMass.userData.at(V(0, -6, 0), 0, -0.07, part1A * smooth(q, 0.15, 0.22));
        tHole.userData.at(V(0, 0, -12), 0, -0.08, a * smooth(q, 0.55, 0.6));
        tSpot.userData.at(spot.sprite.position, 0.05, 0.05, a * part2 * flare);
        if (ch) ch.show(span(q, cfg.chart.from ?? 0.55, cfg.chart.to ?? 0.95), a * smooth(q, (cfg.chart.from ?? 0.55) - 0.03, cfg.chart.from ?? 0.55));
        ctx.fade(centreGlow, part1A);
      },
    };
  };
}

/* ------------------------------------------------------------ galaxies merge */

/*
 * Two spiral galaxies falling together: test stars round two point masses
 * (a restricted N-body run, Toomre & Toomre 1972 style), computed once at
 * the start into snapshots and played back. Units: 1 = 10,000 light-years.
 */
export function galaxyMergerScene(cfg) {
  return (U, ctx, H, site, tag) => {
    const g = new THREE.Group();
    site.add(g);
    const N = 2400;
    const r = rng(17);
    const masses = [{ m: 1, p: V(-9, 0, -2), v: V(0.06, 0, 0.12) }, { m: 1.2, p: V(9, 1.5, 2), v: V(-0.06, -0.01, -0.12) }];
    const stars = [];
    [[0, 1, 0, 0.35, 5], [1, 1, 1.1, -0.5, 6.5]].forEach(([which, , tiltX, tiltZ, R]) => {
      const c = masses[which];
      for (let i = 0; i < N; i += 1) {
        const arm = Math.floor(r() * 2);
        const rr = R * (0.15 + 0.85 * Math.pow(r(), 0.8));
        const th = arm * Math.PI + Math.log(rr / (R * 0.15)) / Math.tan(16 * Math.PI / 180) + gauss(r) * 0.25;
        const pos = V(Math.cos(th) * rr, gauss(r) * 0.1, Math.sin(th) * rr).applyAxisAngle(V(1, 0, 0), tiltX).applyAxisAngle(V(0, 0, 1), tiltZ);
        const vmag = Math.sqrt((c.m * 1) / Math.max(rr, 0.5)) * 0.5;
        const tang = V(-Math.sin(th), 0, Math.cos(th)).applyAxisAngle(V(1, 0, 0), tiltX).applyAxisAngle(V(0, 0, 1), tiltZ).multiplyScalar(vmag);
        stars.push({ p: pos.add(c.p), v: tang.add(c.v), which, rr });
      }
    });
    /* Integrate (leapfrog, softened point masses), 160 snapshots. */
    const SNAP = 160;
    const STEPS = 6;
    const dtI = 0.5;
    const snaps = [];
    const M = masses.map((m) => ({ m: m.m, p: m.p.clone(), v: m.v.clone() }));
    /* Plain numbers in the inner loop: 4,800 stars x 960 steps. */
    const acc = (p, out2) => {
      let ax = 0; let ay = 0; let az = 0;
      for (let j = 0; j < M.length; j += 1) {
        const dx = M[j].p.x - p.x; const dy = M[j].p.y - p.y; const dz = M[j].p.z - p.z;
        const r2 = dx * dx + dy * dy + dz * dz + 0.6;
        const k = (M[j].m * 0.25) / (r2 * Math.sqrt(r2));
        ax += dx * k; ay += dy * k; az += dz * k;
      }
      return out2.set(ax, ay, az);
    };
    const tmpA = V();
    for (let s = 0; s < SNAP; s += 1) {
      const frame = new Float32Array(stars.length * 3);
      stars.forEach((st, i) => { frame[i * 3] = st.p.x; frame[i * 3 + 1] = st.p.y; frame[i * 3 + 2] = st.p.z; });
      snaps.push({ frame, cores: M.map((m) => m.p.clone()) });
      for (let k = 0; k < STEPS; k += 1) {
        /* The two galaxies pull each other (with a little drag standing in
         * for dynamical friction, so they merge). */
        const d = M[1].p.clone().sub(M[0].p);
        const r2 = d.lengthSq() + 1.2;
        const f = d.multiplyScalar(0.25 / (r2 * Math.sqrt(r2)));
        M[0].v.addScaledVector(f, M[1].m * dtI);
        M[1].v.addScaledVector(f, -M[0].m * dtI);
        M.forEach((m) => { m.v.multiplyScalar(0.995); m.p.addScaledVector(m.v, dtI); });
        stars.forEach((st) => {
          acc(st.p, tmpA);
          st.v.addScaledVector(tmpA, dtI);
          st.p.addScaledVector(st.v, dtI);
        });
      }
    }
    const cloud = ctx.cloud(stars.length, { parent: g, size: 2 });
    stars.forEach((st, i) => {
      cloud.tint(i, st.which ? (st.rr < 1.5 ? "#ffe2b0" : "#cfe0ff") : (st.rr < 1.2 ? "#ffd9a0" : "#b8ccff"));
      cloud.alpha[i] = 0.35 + 0.5 * r();
    });
    const cores = M.map((m, i) => ctx.glow(i ? "#ffe8c8" : "#ffd9a8", i ? 3.2 : 2.6, { opacity: 0.8, parent: g }));
    const tMW = tag(["The Milky Way"], { height: 0.036, colour: "#ffd9a8" });
    const tM31 = tag(["Andromeda", "coming at 110 km/s"], { height: 0.036, colour: "#ffe8c8" });
    const tNew = tag(["'Milkomeda'", "one big elliptical galaxy"], { height: 0.038, colour: "#ffe2b0" });
    const ch = lightChart(ctx, H, cfg.chart);
    const centre = V();
    return {
      title: (q) => titleAt(cfg.titles, q),
      update(q, p, dt, a) {
        const k = clamp01(q) * (SNAP - 1);
        const i0 = Math.floor(k);
        const i1 = Math.min(SNAP - 1, i0 + 1);
        const f = k - i0;
        const A0 = snaps[i0].frame;
        const A1 = snaps[i1].frame;
        for (let i = 0; i < stars.length; i += 1) cloud.set(i, lerp(A0[i * 3], A1[i * 3], f), lerp(A0[i * 3 + 1], A1[i * 3 + 1], f), lerp(A0[i * 3 + 2], A1[i * 3 + 2], f));
        cloud.commit();
        cloud.opacity = a;
        cloud.points.visible = a > 0.002;
        cores.forEach((c, j) => { c.position.copy(snaps[i0].cores[j]).lerp(snaps[i1].cores[j], f); ctx.fade(c, a); });
        centre.copy(cores[0].position).lerp(cores[1].position, 0.5);
        orbitView(U, centre, lerp(55, 42, q), 0.3 + q * 0.8, 0.7);
        tMW.userData.at(cores[0].position, 0, -0.07, a * (1 - smooth(q, 0.55, 0.65)));
        tM31.userData.at(cores[1].position, 0, 0.07, a * (1 - smooth(q, 0.55, 0.65)));
        tNew.userData.at(centre, 0, 0.12, a * smooth(q, 0.8, 0.88));
        if (ch) ch.show(span(q, 0.02, 0.98), a * smooth(q, 0, 0.03));
      },
    };
  };
}

export { picture, deepAsset, chart, curveThrough, galaxy, inFrame };

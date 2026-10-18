import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";

/**
 * Section 6 of the catalogue: Jupiter and its moons (round 79).
 *
 * Seven dioramas in front of the lens (body: null): the shrinking Great Red
 * Spot, the 2010 belt fade, Io's flux tube, the Laplace resonance, moon
 * shadows, Europa's tides and Jovian lightning.
 *
 * Sizes, distances and periods are NASA's planetary and satellite fact
 * sheets (nssdc.gsfc.nasa.gov/planetary/factsheet, ssd.jpl.nasa.gov
 * /sats/elem) unless a comment says otherwise.
 */

/* Jupiter's equatorial radius, km (NASA fact sheet). */
const JUPITER_R_KM = 71492;
/* Earth's equatorial diameter, km (NASA), for "how many Earths". */
const EARTH_D_KM = 12756;
/* Where the Great Red Spot sits in the bundled Cassini map
 * (jupiter-cassini-map.jpg): measured from the map, u ≈ 0.368 and about
 * 21° S. The real spot drifts in longitude; 21–22° S is its latitude. */
const GRS_LAT = -21;
const GRS_MAP_LON = TAU * (0.368 - 0.25); /* three.js sphere: u = 0.25 faces +z */

const fmt = (n) => Math.round(n).toLocaleString("en-US");
const D2R = Math.PI / 180;

/** A point on a sphere of radius r at latitude/longitude in degrees (+z at lon 0). */
function sph(r, latDeg, lonDeg) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  return new THREE.Vector3(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
}

/**
 * An oval drawn on a sphere: wKm east–west by hKm north–south, centred at
 * (lat, lon), on a body of radius bodyKm drawn at radius r. Closed loop.
 */
function surfaceOval(r, bodyKm, latDeg, lonDeg, wKm, hKm, n = 96) {
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const t = (i / n) * TAU;
    const lat = latDeg + ((hKm / 2) * Math.sin(t) / bodyKm) / D2R;
    const lon = lonDeg + ((wKm / 2) * Math.cos(t) / (bodyKm * Math.cos(lat * D2R))) / D2R;
    points.push(sph(r, lat, lon));
  }
  return points;
}

/** A triangle-fan fill through a closed loop of points around `centre`. */
function fanGeometry(centre, loop) {
  const positions = [centre.x, centre.y, centre.z];
  loop.forEach((p) => positions.push(p.x, p.y, p.z));
  const index = [];
  for (let i = 1; i < loop.length; i += 1) index.push(0, i, i + 1 > loop.length - 1 ? 1 : i + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}
function fanMesh(ctx, centre, loop, { colour = "#ffffff", opacity = 1, parent, additive = false } = {}) {
  const mesh = new THREE.Mesh(fanGeometry(centre, loop), new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, fog: false,
  }));
  mesh.raycast = () => {};
  mesh.renderOrder = 21;
  mesh.userData.baseOpacity = opacity;
  (parent ?? ctx.root).add(mesh);
  return mesh;
}
function refan(mesh, centre, loop) {
  mesh.geometry.dispose();
  mesh.geometry = fanGeometry(centre, loop);
}

/** A dipole field line r = L sin²θ in the meridian at azimuth az (radians), y = magnetic axis. */
function dipoleLine(radius, L, az, n = 90) {
  const theta0 = Math.asin(Math.sqrt(1 / L));
  const points = [];
  for (let i = 0; i <= n; i += 1) {
    const th = lerp(theta0, Math.PI - theta0, i / n);
    const r = L * radius * Math.sin(th) ** 2;
    points.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), -r * Math.sin(th) * Math.sin(az)));
  }
  return points;
}

/** Point a fraction s (0–1) along a polyline. */
function along(points, s) {
  const f = clamp01(s) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  return points[i].clone().lerp(points[i + 1], f - i);
}

export const JUPITER_EVENTS = [
  /* ------------------------------------------------------------------ 63 */
  event({
    id: "jupiter-grs-shrinking",
    section: "giants",
    title: "The shrinking Great Red Spot",
    place: "Jupiter · the Great Red Spot",
    kind: "ongoing",
    family: "planetary",
    often: "watched since 1831",
    detail: "Once about 40,000 km long, the Great Red Spot is now about 16,000 km — and it has turned from a long oval into a rounder one",
    frequency: "Continuous. Seen without a break since 1831, measured from drawings since the 1880s, and by spacecraft and Hubble since 1979. On average it has lost about 170 km of length a year — faster in some decades than in others.",
    cause: "Nobody knows exactly why it is shrinking. The storm is an anticyclone wedged between two opposing jet streams, which keep it spinning, and it swallows smaller storms that drift into it. If it loses energy faster than it is fed, it slowly winds down. Its east–west length has fallen far faster than its north–south height, so it has become rounder.",
    note: "In the 1880s it was about 40,000 km long; Voyager measured about 23,000 km in 1979; Juno and Hubble about 16,350 km in 2017. Whether it will vanish, settle at a smaller size, or grow again, no one can yet say.",
    accuracy: "Jupiter and the outlines to one scale, with the measured lengths. The heights of the ovals are illustrative, chosen to show the reported change from a long oval to a rounder one. Between measurements the size is interpolated. The close-up of the vortex is a diagram.",
    art: { main: "jupiter", fx: "spot" },
    scene(ctx) {
      ctx.light.set(-0.42, 0.32, 0.85).normalize();
      /* layout */
      const R = 0.66;
      const holder = new THREE.Group();
      holder.position.set(-0.3, 0.0, 0);
      holder.rotation.x = -0.3;
      ctx.add(holder);
      const jupiter = ctx.ball(R, { body: "Jupiter", parent: holder, rim: 0.25, rimColour: "#ffdcae" });
      jupiter.rotation.y = -GRS_MAP_LON;

      /* Lengths, km: ~40,000 in the 1880s (Simon et al. 2018, AJ 155:151,
       * from historical drawings); ~23,000 in 1979 (Voyager); 16,350 in 2017
       * (Juno/Hubble, NASA). Heights: drawing choice (illustrative). */
      const EPOCHS = [
        { year: 1880, label: "1880s", km: 40000, hkm: 14000, colour: "#ffd27f", who: "from drawings" },
        { year: 1979, label: "1979", km: 23000, hkm: 13000, colour: "#ff9f6a", who: "Voyager" },
        { year: 2017, label: "2017", km: 16350, hkm: 12000, colour: "#ff6f6f", who: "Juno and Hubble" },
      ];
      const r = R * 1.004;
      /* Each outline drawn three times, a few hundred km apart, so it
       * reads as a line rather than a hair. */
      const traced = EPOCHS.map((e) => {
        const group = new THREE.Group();
        holder.add(group);
        [-250, 0, 250].forEach((dk) => ctx.line(surfaceOval(r * 1.001, JUPITER_R_KM, GRS_LAT, 0, e.km + dk, e.hkm + dk), { colour: e.colour, opacity: 0.95, parent: group, additive: false }));
        ctx.fade(group, 0);
        return group;
      });
      const centre = sph(r, GRS_LAT, 0);
      const fill = fanMesh(ctx, centre, surfaceOval(r, JUPITER_R_KM, GRS_LAT, 0, 40000, 14000), { colour: "#b8432c", opacity: 0.55, parent: holder });
      const edge = ctx.line(surfaceOval(r * 1.002, JUPITER_R_KM, GRS_LAT, 0, 40000, 14000), { colour: "#fff0e0", opacity: 0.9, parent: holder, additive: false });

      /* Legend, right of the planet. */
      const legend = EPOCHS.map((e, i) => {
        const label = ctx.label([`${e.label} · about ${fmt(e.km)} km`, e.who], { at: [0.46, -0.3 - i * 0.13, 0], height: 0.024, align: "left", colour: e.colour });
        ctx.fade(label, 0);
        return label;
      });
      const counter = ctx.label(["", ""], { at: [0.74, 0.04, 0], height: 0.036 });

      /* The close-up of the vortex: an inset at the upper right. */
      const insetC = new THREE.Vector3(0.76, 0.52, 0);
      const insetR = 0.2;
      const insetBack = ctx.disc(insetR, { colour: "#2a140c", opacity: 0.9 });
      insetBack.position.copy(insetC);
      const insetRim = ctx.circle(insetR, { plane: "xy", colour: "#ffb08a", opacity: 0.5 });
      insetRim.position.copy(insetC);
      const insetTitle = ctx.label(["Inside the storm", "turning anticlockwise · winds over 400 km/h"], { at: [insetC.x, insetC.y - insetR - 0.07, 0], height: 0.022 });
      const N = 1400;
      const swirl = ctx.cloud(N, { size: 3 });
      swirl.points.position.z = 0.01;
      const rr = rng(63);
      const swirlData = Array.from({ length: N }, () => ({ a: rr() * TAU, d: Math.sqrt(rr()) * 0.98, k: rr() }));
      swirlData.forEach((s, i) => swirl.tint(i, s.k > 0.7 ? "#ffe3c8" : s.k > 0.35 ? "#e98a5c" : "#b8432c"));
      const insetOval = ctx.circle(0.5, { plane: "xy", colour: "#fff0e0", opacity: 0.6, additive: false });
      /* The spot's centre in root space, for the pointer to the inset. */
      const spotRoot = sph(R, GRS_LAT, 0).applyEuler(holder.rotation).add(holder.position);
      const pointer = ctx.line([spotRoot, insetC.clone().add(new THREE.Vector3(-insetR * 0.8, -insetR * 0.55, 0))], { colour: "#ffb08a", opacity: 0.35, dashed: true });

      ctx.tell([
        { at: 0, label: "Nearly 200 years", text: "Jupiter's Great Red Spot, a storm in the southern clouds, watched without a break since 1831." },
        { at: 0.12, label: "1880s", text: "About 40,000 km long — three Earths end to end — and a long, stretched oval." },
        { at: 0.45, label: "1979", text: "Voyager flies past: about 23,000 km. Still shrinking." },
        { at: 0.72, label: "Today", text: "2017, Juno and Hubble: 16,350 km, and much rounder. No one knows if it will one day vanish." },
      ]);

      return {
        duration: 20,
        update(p) {
          jupiter.rotation.y = -GRS_MAP_LON;
          /* The clock: 1880 → 1979 over 0.12–0.45, 1979 → 2017 over 0.45–0.72. */
          let km;
          let hkm;
          let year;
          if (p < 0.45) {
            const u = easeInOut(span(p, 0.14, 0.45));
            year = lerp(1880, 1979, u); km = lerp(40000, 23000, u); hkm = lerp(14000, 13000, u);
          } else {
            const u = easeInOut(span(p, 0.47, 0.72));
            year = lerp(1979, 2017, u); km = lerp(23000, 16350, u); hkm = lerp(13000, 12000, u);
          }
          const loop = surfaceOval(r, JUPITER_R_KM, GRS_LAT, 0, km, hkm);
          refan(fill, centre, loop);
          ctx.setLine(edge, surfaceOval(r * 1.002, JUPITER_R_KM, GRS_LAT, 0, km, hkm));
          ctx.fade(fill, smooth(p, 0.0, 0.05));
          ctx.fade(edge, smooth(p, 0.0, 0.05));
          EPOCHS.forEach((e, i) => {
            const reached = smooth(year, e.year - 0.5, e.year) * smooth(p, 0.1, 0.15);
            ctx.fade(traced[i], reached * 0.9);
            ctx.fade(legend[i], reached);
          });
          const shownYear = p < 0.14 ? "1880s" : `${Math.round(year)}`;
          counter.userData.draw([shownYear, `${fmt(km)} km long · ${(km / EARTH_D_KM).toFixed(1)} Earths`]);
          ctx.fade(counter, smooth(p, 0.02, 0.08));

          /* Inset: the vortex, with the oval's own proportions. */
          const aspect = hkm / km;
          const w = insetR * 0.95;
          const h = Math.max(insetR * 0.32, w * aspect);
          const insetShow = smooth(p, 0.04, 0.12);
          for (let i = 0; i < N; i += 1) {
            const s = swirlData[i];
            /* Fast at the collar, slow in the calm centre: anticlockwise. */
            const a = s.a + ctx.t * (0.25 + 1.1 * s.d * s.d);
            swirl.set(i, insetC.x + Math.cos(a) * s.d * w, insetC.y + Math.sin(a) * s.d * h, 0.01);
            swirl.alpha[i] = 0.75;
          }
          swirl.commit();
          swirl.opacity = insetShow;
          insetOval.position.copy(insetC);
          insetOval.scale.set(w * 2, h * 2, 1);
          [insetBack, insetRim, insetTitle, insetOval, pointer].forEach((o) => ctx.fade(o, insetShow));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 64 */
  event({
    id: "jupiter-belt-fade",
    section: "giants",
    title: "A cloud belt vanishes",
    place: "Jupiter · the South Equatorial Belt",
    kind: "recorded",
    family: "planetary",
    when: "2010",
    often: "now and then — years or decades apart",
    timeline: { last: "Faded 2009–10, revived from November 2010", next: "Unpredictable" },
    detail: "In 2010 one of Jupiter's two great dark belts disappeared behind bright clouds — and months later a dark outbreak brought it back",
    frequency: "Irregular. The South Equatorial Belt has faded and revived many times since records began in the late 1800s, sometimes years apart, sometimes decades. The last full cycle began in 2009.",
    cause: "The belt was not gone, only hidden: a layer of bright, high ammonia-ice clouds formed over the dark material. A revival starts with a bright plume — a storm punching up from below — and dark outbreaks spread around the planet as the high clouds are cleared.",
    note: "When Jupiter came out from behind the Sun in spring 2010, the belt had vanished. The revival began in November 2010 with a single bright spot, and by early 2011 the dark belt was back. While the belt is pale, the Great Red Spot, which sits in a bay on its southern edge, often looks redder.",
    accuracy: "Jupiter is drawn from the Cassini map; the bright cover and the dark outbreak are painted over the belt to show the sequence, not from images of 2010. Months are approximate.",
    art: { main: "jupiter", fx: "storm" },
    scene(ctx) {
      ctx.light.set(-0.4, 0.3, 0.87).normalize();
      /* layout */
      const R = 0.62;
      const holder = new THREE.Group();
      holder.position.set(-0.25, 0.02, 0);
      holder.rotation.x = -0.12;
      ctx.add(holder);
      const jupiter = ctx.ball(R, { body: "Jupiter", parent: holder, rim: 0.25, rimColour: "#ffdcae" });
      /* The SEB in the bundled map runs about 7–19.5° S (measured). The pale
       * cover is cut into 5° segments of longitude, so the revival can clear
       * it outward from the outbreak. three's sphere: phi = lon + 90°. */
      const OUTBREAK_LON = 30; /* drawing choice: a map longitude that faces the viewer mid-event */
      const SEG = 72;
      const segments = [];
      for (let k = 0; k < SEG; k += 1) {
        const lon = -180 + (k + 0.5) * (360 / SEG);
        const group = new THREE.Group();
        jupiter.add(group);
        [[-8.5, -18, 0.92], [-7, -8.5, 0.45], [-18, -19.6, 0.45]].forEach(([a, b, o]) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(R * 1.003, 3, 4, (lon - 180 / SEG + 90) * D2R, (360 / SEG) * D2R, (90 - Math.max(a, b)) * D2R, Math.abs(a - b) * D2R),
            ctx.material({ colour: "#efe4cf", opacity: o, transparent: true, depthWrite: false, night: 0.04 }),
          );
          mesh.raycast = () => {};
          mesh.renderOrder = 21;
          mesh.userData.baseOpacity = o;
          group.add(mesh);
        });
        ctx.fade(group, 0);
        segments.push({ group, d: Math.abs((((lon - OUTBREAK_LON) % 360) + 540) % 360 - 180) });
      }

      /* The outbreak front: dark streaks and pale plumes at the two edges of
       * the cleared stretch, moving east and west. */
      const N = 900;
      const plumes = ctx.cloud(N, { additive: false, parent: jupiter, size: 5 });
      const pr = rng(64);
      const plumeData = Array.from({ length: N }, () => ({
        lat: lerp(-8.5, -18, pr()), side: pr() < 0.5 ? -1 : 1, back: pr() ** 1.6 * 28, k: pr(), sz: 3 + pr() * 5,
      }));
      plumeData.forEach((d, i) => {
        plumes.tint(i, d.k > 0.8 ? "#fff6e6" : d.k > 0.35 ? "#3e2618" : "#5e3c28");
        plumes.size[i] = d.sz;
      });
      const head = ctx.glow("#ffffff", 0.07, { opacity: 0, parent: jupiter });

      const beltLabel = ctx.label(["South Equatorial Belt"], { at: [0.62, -0.08, 0], height: 0.026, align: "left" });
      const beltPointer = ctx.line([[0.6, -0.08, 0], [0.33, -0.1, 0]], { colour: "#e8f1ff", opacity: 0.45, additive: false });
      const date = ctx.label(["", ""], { at: [0.78, 0.42, 0], height: 0.036 });
      const status = ctx.label([""], { at: [0.78, 0.26, 0], height: 0.024, colour: "#9fb3c8" });

      ctx.tell([
        { at: 0, label: "Two dark belts", text: "Jupiter's two great dark belts straddle the equator. Watch the southern one." },
        { at: 0.16, label: "2010: gone", text: "Through 2009 it paled. When Jupiter came out from behind the Sun in 2010, it had vanished under bright, high clouds." },
        { at: 0.5, label: "November 2010", text: "A bright storm erupts in the white band, and dark outbreaks spread out from it." },
        { at: 0.8, label: "Back again", text: "By early 2011 the belt had returned. It has faded and come back like this many times." },
      ]);

      return {
        duration: 20,
        update(p) {
          /* A slow turn so the outbreak site comes round to face us. */
          jupiter.rotation.y = -GRS_MAP_LON + lerp(-0.8, 0.6, p); /* prograde turn */
          /* Pale cover: grows 0.06–0.3; from 0.5 the outbreak clears it
           * outward from one longitude, all the way round by 0.9. */
          const cover = smooth(p, 0.06, 0.3);
          const spread = 185 * span(p, 0.5, 0.94) ** 1.3;
          segments.forEach((seg) => ctx.fade(seg.group, cover * smooth(seg.d - spread, -3, 6)));
          const live = smooth(p, 0.49, 0.53) * (1 - smooth(p, 0.88, 0.95));
          for (let i = 0; i < N; i += 1) {
            const d = plumeData[i];
            /* Streaks lean with the shear: latitude shifts the longitude. */
            const lon = OUTBREAK_LON + d.side * (spread - d.back) + (d.lat + 13) * 1.2 + Math.sin(d.k * 40 + p * 6);
            const v = sph(R * 1.006, d.lat, lon);
            plumes.set(i, v.x, v.y, v.z);
            plumes.alpha[i] = live * (spread > d.back ? 1 : 0) * (d.k > 0.8 ? 0.6 : 0.8) * (1 - d.back / 34);
          }
          plumes.commit();
          const hp = sph(R * 1.01, -13, OUTBREAK_LON);
          head.position.copy(hp);
          head.material.opacity = 0.9 * win(p, 0.49, 0.72, 0.05) * (0.8 + 0.2 * Math.sin(ctx.t * 6));
          const label = p < 0.16 ? ["2009", "the belt pales"]
            : p < 0.5 ? ["May 2010", "the belt is gone"]
              : p < 0.8 ? ["Nov 2010", "dark outbreak"]
                : ["Early 2011", "the belt is back"];
          date.userData.draw(label);
          ctx.fade(date, smooth(p, 0.02, 0.06));
          status.userData.draw([`Belt hidden: ${Math.round(cover * (1 - Math.min(1, spread / 180)) * 100)}%`]);
          ctx.fade(status, smooth(p, 0.06, 0.1));
          ctx.fade(beltLabel, smooth(p, 0.0, 0.05));
          ctx.fade(beltPointer, smooth(p, 0.0, 0.05));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 65 */
  event({
    id: "io-flux-tube",
    section: "giants",
    title: "Io's electric current",
    place: "Jupiter and Io",
    kind: "ongoing",
    family: "fields",
    often: "always on",
    detail: "Io moving through Jupiter's magnetic field drives a current of millions of amps down to Jupiter, where it lights its own spot in the aurora",
    frequency: "Continuous. Io's footprint shows in every ultraviolet and infrared image of Jupiter's aurora, following Io round as it orbits every 42.5 hours.",
    cause: "Jupiter's magnetic field turns with the planet every 9.9 hours, far faster than Io orbits, so the field sweeps past Io at about 57 km/s. Io and the gas around it conduct electricity, so the moon works like a generator: a current flows along the field lines between Io and Jupiter's upper atmosphere — the flux tube. Galileo-era estimates put it at millions of amps.",
    note: "Where the current lands, near Jupiter's poles, it makes a bright spot in the aurora with a long glowing tail behind it: Io's footprint. Europa and Ganymede leave fainter footprints too.",
    accuracy: "Jupiter and Io's orbit to scale (Io at 5.9 Jupiter radii); Io is enlarged. The field is drawn as a simple dipole along the spin axis — the real one is tilted about 10° and lumpier. The aurora close-up is a diagram.",
    art: { main: "jupiter", second: "io", fx: "beam" },
    scene(ctx) {
      ctx.light.set(-0.5, 0.35, 0.8).normalize();
      /* Io's orbit 421,800 km / 71,492 km = 5.90 Jupiter radii (JPL). */
      const L = 421800 / JUPITER_R_KM;
      /* layout */
      const RJ = 0.13;
      const sys = new THREE.Group();
      sys.position.set(-0.12, -0.04, 0);
      sys.rotation.x = 0.3;
      ctx.add(sys);
      const jupiter = ctx.ball(RJ, { body: "Jupiter", parent: sys, rim: 0.3, rimColour: "#ffdcae" });
      ctx.circle(RJ * L, { plane: "xz", parent: sys, colour: "#e8d36a", opacity: 0.28 });
      /* The field: faint dipole lines at a few shells and azimuths. */
      const field = new THREE.Group();
      sys.add(field);
      [3, L].forEach((shell) => {
        for (let k = 0; k < 4; k += 1) ctx.line(dipoleLine(RJ, shell, (k / 4) * TAU + 0.5), { colour: "#7fb8ff", opacity: shell === L ? 0.2 : 0.12, parent: field });
      });
      /* Io's plasma torus, corotating with the field. */
      const T = 900;
      const torus = ctx.cloud(T, { parent: sys, size: 2.8 });
      const tr = rng(65);
      const torusData = Array.from({ length: T }, () => ({ a: tr() * TAU, dr: (tr() - 0.5) * 0.9, dy: (tr() - 0.5) * 0.5 }));
      torusData.forEach((_, i) => torus.tint(i, i % 4 ? "#ff8fa0" : "#ffd0a8"));
      const io = ctx.ball(0.03, { body: "Io", parent: sys, colour: "#e8d36a" });
      /* The flux tube through Io, the current pulses on it, the footprints. */
      const tube = ctx.line(dipoleLine(RJ, L, 0), { colour: "#ffe9a8", opacity: 0.95, parent: sys });
      const P = 28;
      const pulses = ctx.cloud(P, { parent: sys, size: 7 });
      for (let i = 0; i < P; i += 1) pulses.tint(i, "#fff6c8");
      const footN = ctx.glow("#bfe6ff", 0.07, { opacity: 0, parent: sys });
      const footS = ctx.glow("#bfe6ff", 0.07, { opacity: 0, parent: sys });
      /* The main auroral ovals near each pole (~74° latitude; diagram). */
      const ovalN = ctx.circle(RJ * Math.cos(74 * D2R), { plane: "xz", parent: sys, colour: "#9fd8ff", opacity: 0.6 });
      ovalN.position.y = RJ * Math.sin(74 * D2R);
      const ovalS = ctx.circle(RJ * Math.cos(74 * D2R), { plane: "xz", parent: sys, colour: "#9fd8ff", opacity: 0.6 });
      ovalS.position.y = -RJ * Math.sin(74 * D2R);
      /* Footprint latitude where the L = 5.9 line meets the planet:
       * cos²λ = 1/L → about 66° (dipole). */
      const footLat = Math.acos(Math.sqrt(1 / L));
      const tail = ctx.line([new THREE.Vector3(), new THREE.Vector3(0, 0, 0.001)], { colour: "#bfe6ff", opacity: 0.8, parent: sys });

      /* Close-up of the northern aurora, upper right. */
      const insetC = new THREE.Vector3(0.78, 0.58, 0);
      const insetR = 0.2;
      const insetBack = ctx.disc(insetR, { colour: "#050a14", opacity: 0.88 });
      insetBack.position.copy(insetC);
      const insetRim = ctx.circle(insetR, { plane: "xy", colour: "#7fb8ff", opacity: 0.45 });
      insetRim.position.copy(insetC);
      const mainOval = ctx.circle(insetR * 0.52, { plane: "xy", colour: "#9fd8ff", opacity: 0.85 });
      mainOval.position.copy(insetC);
      mainOval.scale.set(1, 0.85, 1);
      const insetFoot = ctx.glow("#e6f6ff", 0.06, { opacity: 0 });
      const insetTail = ctx.line([insetC, insetC], { colour: "#bfe6ff", opacity: 0.85 });
      const insetLabel = ctx.label(["Io's footprint", "in Jupiter's northern aurora"], { at: [insetC.x, insetC.y - insetR - 0.07, 0], height: 0.022 });

      const ioLabel = ctx.label(["Io"], { height: 0.026 });
      const tubeLabel = ctx.label(["The flux tube", "millions of amps"], { height: 0.026, colour: "#ffe9a8" });
      const torusLabel = ctx.label(["Plasma torus", "sweeping past at ~57 km/s"], { at: [0.5, -0.36, 0], height: 0.022, colour: "#ffb0bc" });

      ctx.tell([
        { at: 0, label: "Wired together", text: "Io circles inside Jupiter's magnetic field, which spins with the planet every 9.9 hours — far faster than Io's 42-hour orbit." },
        { at: 0.24, label: "A generator", text: "The field sweeps past Io at about 57 km/s. Io conducts, so it works like a dynamo: a current of millions of amps flows along the field lines." },
        { at: 0.55, label: "Io's footprint", text: "Where the current reaches Jupiter, near the poles, it lights a bright spot in the aurora — with a glowing tail behind it." },
        { at: 0.82, label: "Following Io", text: "The spot follows Io round the planet, orbit after orbit." },
      ]);

      const scratch = new THREE.Vector3();
      return {
        duration: 20,
        update(p) {
          jupiter.rotation.y = ctx.t * 0.25;
          /* Io: prograde, 150° → 215° over the event (drawing choice). */
          const phi = lerp(150, 215, p) * D2R;
          io.position.set(RJ * L * Math.cos(phi), 0, -RJ * L * Math.sin(phi));
          io.rotation.y = ctx.t * 0.2;
          /* Corotation: 42.46 h / 9.925 h ≈ 4.28 times Io's angular speed. */
          const spin = phi * 4.28;
          for (let i = 0; i < T; i += 1) {
            const d = torusData[i];
            const a = d.a + spin;
            const rad = RJ * (L + d.dr);
            torus.set(i, rad * Math.cos(a), d.dy * RJ, -rad * Math.sin(a));
            torus.alpha[i] = 0.55;
          }
          torus.commit();
          torus.opacity = 0.9;
          const line = dipoleLine(RJ, L, phi);
          ctx.setLine(tube, line);
          const current = smooth(p, 0.24, 0.32);
          ctx.fade(tube, 0.25 + 0.75 * current);
          for (let i = 0; i < P; i += 1) {
            const half = i % 2;
            const f = (ctx.t * 0.35 + (Math.floor(i / 2) / (P / 2))) % 1;
            const s = half ? 0.5 - f * 0.5 : 0.5 + f * 0.5;
            const v = along(line, s);
            pulses.set(i, v.x, v.y, v.z);
            pulses.alpha[i] = current * (0.4 + 0.6 * Math.sin(f * Math.PI));
          }
          pulses.commit();
          /* Footprints at the two ends of the line. */
          const glowOn = smooth(p, 0.52, 0.6);
          footN.position.copy(line[0]);
          footS.position.copy(line[line.length - 1]);
          footN.material.opacity = 0.95 * glowOn;
          footS.material.opacity = 0.95 * glowOn;
          /* Tail: trailing behind the footprint, 40° of longitude. */
          const tailPts = [];
          for (let k = 0; k <= 24; k += 1) {
            const az = phi - (k / 24) * 40 * D2R * smooth(p, 0.55, 0.75);
            const rr2 = RJ * 1.01;
            tailPts.push(new THREE.Vector3(rr2 * Math.cos(footLat) * Math.cos(az), rr2 * Math.sin(footLat), -rr2 * Math.cos(footLat) * Math.sin(az)));
          }
          ctx.setLine(tail, tailPts);
          ctx.fade(tail, glowOn);
          ctx.fade(ovalN, 0.3 + 0.5 * glowOn);
          ctx.fade(ovalS, 0.3 + 0.5 * glowOn);

          /* Inset: the pole seen from above; the footprint sits outside the
           * main oval and turns with Io. */
          const insetOn = smooth(p, 0.55, 0.62);
          [insetBack, insetRim, mainOval, insetLabel].forEach((o) => ctx.fade(o, insetOn));
          const ia = phi + Math.PI / 2;
          const fr = insetR * 0.72;
          insetFoot.position.set(insetC.x + Math.cos(ia) * fr, insetC.y + Math.sin(ia) * fr * 0.85, 0.02);
          insetFoot.material.opacity = insetOn;
          const itp = [];
          for (let k = 0; k <= 20; k += 1) {
            const a2 = ia - (k / 20) * 0.9 * smooth(p, 0.6, 0.8);
            itp.push(new THREE.Vector3(insetC.x + Math.cos(a2) * fr, insetC.y + Math.sin(a2) * fr * 0.85, 0.015));
          }
          ctx.setLine(insetTail, itp);
          ctx.fade(insetTail, insetOn);

          /* Labels, placed in root space. */
          scratch.copy(io.position).applyEuler(sys.rotation).add(sys.position);
          ioLabel.position.set(scratch.x, scratch.y + 0.07, scratch.z);
          ctx.fade(ioLabel, smooth(p, 0, 0.05));
          scratch.copy(along(line, 0.3)).applyEuler(sys.rotation).add(sys.position);
          tubeLabel.position.set(scratch.x - 0.06, scratch.y + 0.12, scratch.z);
          ctx.fade(tubeLabel, current);
          ctx.fade(torusLabel, smooth(p, 0.1, 0.16) * (1 - smooth(p, 0.55, 0.6)));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 66 */
  event({
    id: "laplace-resonance",
    section: "giants",
    title: "The 1:2:4 dance",
    place: "Io, Europa and Ganymede",
    kind: "ongoing",
    family: "orbit",
    often: "every 7.15 days",
    detail: "For every orbit Ganymede makes, Europa makes two and Io four — and the three can never line up on the same side of Jupiter",
    frequency: "Continuous. The pattern repeats every 7.15 days, one orbit of Ganymede.",
    cause: "Io (1.77 days), Europa (3.55 days) and Ganymede (7.15 days) are locked in a Laplace resonance. Each time two of them pass, they tug each other at the same points of their orbits, and the repeated tugs add up. That keeps their orbits slightly stretched instead of letting them settle into circles — and a stretched orbit means changing tides, which heat Io's volcanoes and Europa's ocean.",
    note: "The resonance has a rule: Io's longitude minus three times Europa's plus twice Ganymede's always equals 180°. So when Europa and Ganymede pass each other, Io is on the far side of Jupiter, and when Io and Europa pass, Ganymede is a quarter of a turn away. All three can never be lined up together.",
    accuracy: "Orbit sizes and periods to scale (JPL); the orbits are drawn as circles. Jupiter is enlarged twice and the moons far more, so they can be seen.",
    art: { main: "jupiter", second: "io", fx: "dance" },
    scene(ctx) {
      ctx.light.set(-0.3, 0.4, 0.86).normalize();
      /* Semi-major axes, km, and sidereal periods, days (JPL satellite mean
       * elements). */
      const MOONS = [
        { name: "Io", a: 421800, P: 1.769138, colour: "#e8d36a", size: 0.032, lam0: 180 },
        { name: "Europa", a: 671100, P: 3.551181, colour: "#d6c7ad", size: 0.028, lam0: 0 },
        { name: "Ganymede", a: 1070400, P: 7.154553, colour: "#a59a8c", size: 0.04, lam0: 0 },
      ];
      /* λI − 3λE + 2λG = 180° at the start: Europa and Ganymede together,
       * Io opposite (Laplace relation). */
      /* layout */
      const centre = new THREE.Vector3(-0.28, -0.01, 0);
      const k = 0.7 / 1070400;
      const jupiter = ctx.ball(JUPITER_R_KM * k * 2, { body: "Jupiter", rim: 0.3 });
      jupiter.position.copy(centre);
      const moons = MOONS.map((m) => {
        const orbit = ctx.circle(m.a * k, { plane: "xy", colour: m.colour, opacity: 0.28 });
        orbit.position.copy(centre);
        const ball = ctx.ball(m.size, { body: m.name, colour: m.colour, rim: 0.3 });
        const trail = ctx.line([centre, centre], { colour: m.colour, opacity: 0.65 });
        const tag = ctx.label([m.name], { height: 0.022, colour: m.colour });
        const glow = ctx.glow(m.name === "Io" ? "#ff9a3c" : "#9fd8ff", 0.16, { opacity: 0 });
        return { ...m, orbit, ball, trail, tag, glow };
      });
      const lineIE = ctx.line([centre, centre], { colour: "#ffe9a8", opacity: 0.85 });
      const lineEG = ctx.line([centre, centre], { colour: "#bfe6ff", opacity: 0.85 });
      const lineOdd = ctx.line([centre, centre], { colour: "#ff9f6a", opacity: 0.8, dashed: true, dash: 0.03, gap: 0.02 });
      const clock = ctx.label(["", ""], { at: [0.68, 0.48, 0], height: 0.036 });
      const laps = MOONS.map((m, i) => ctx.label([""], { at: [0.5, 0.22 - i * 0.1, 0], height: 0.028, align: "left", colour: m.colour }));
      const passing = ctx.label([""], { at: [-0.28, -0.84, 0], height: 0.026 });

      ctx.tell([
        { at: 0, label: "Three moons", text: "Io, Europa and Ganymede circling Jupiter, seen from above, orbits to scale." },
        { at: 0.12, label: "Four, two, one", text: "Io takes 1.77 days, Europa 3.55, Ganymede 7.15. In one Ganymede orbit, Europa goes round twice and Io four times." },
        { at: 0.5, label: "Never all three", text: "When Europa and Ganymede pass, Io is always on the far side. When Io and Europa pass, Ganymede is a quarter-turn away." },
        { at: 0.78, label: "Tugs that heat", text: "The repeated tugs keep the orbits stretched — and the changing tides heat Io's volcanoes and Europa's ocean." },
      ]);

      const at = (deg, r) => new THREE.Vector3(centre.x + Math.cos(deg * D2R) * r, centre.y + Math.sin(deg * D2R) * r, 0);
      const wrap = (d) => ((d % 360) + 540) % 360 - 180;
      return {
        duration: 22,
        update(p) {
          jupiter.rotation.y = ctx.t * 0.4;
          /* Two Ganymede orbits, 14.31 days, over 0.06–0.94. */
          const days = 2 * 7.154553 * span(p, 0.06, 0.94);
          const lam = moons.map((m) => m.lam0 + (360 * days) / m.P + 90);
          moons.forEach((m, i) => {
            const r = m.a * k;
            m.ball.position.copy(at(lam[i], r));
            m.ball.rotation.y = ctx.t * 0.3;
            m.tag.position.copy(m.ball.position).add(new THREE.Vector3(0, m.size + 0.035, 0.01));
            /* A trail of the last 50° of orbit. */
            const pts = [];
            for (let j = 0; j <= 20; j += 1) pts.push(at(lam[i] - (j / 20) * 50 * smooth(p, 0.05, 0.1), r));
            ctx.setLine(m.trail, pts);
            const heat = smooth(p, 0.78, 0.86) * (m.name === "Ganymede" ? 0 : m.name === "Io" ? 1 : 0.7);
            m.glow.position.copy(m.ball.position);
            m.glow.material.opacity = heat * (0.75 + 0.25 * Math.sin(ctx.t * 4 + i));
            laps[i].userData.draw([`${m.name} · ${(days / m.P).toFixed(2)} orbits`]);
            ctx.fade(laps[i], smooth(p, 0.1, 0.16));
          });
          /* Conjunctions: lit for a few degrees either side. */
          const dIE = Math.abs(wrap(lam[0] - lam[1]));
          const dEG = Math.abs(wrap(lam[1] - lam[2]));
          const aIE = smooth(p, 0.04, 0.08) * (1 - smooth(dIE, 4, 14));
          const aEG = (1 - smooth(dEG, 4, 14));
          const outer = 0.82;
          ctx.setLine(lineIE, [centre, at(lam[1], outer)]);
          ctx.setLine(lineEG, [centre, at(lam[2], outer)]);
          ctx.fade(lineIE, aIE);
          ctx.fade(lineEG, aEG);
          let oddA = 0;
          if (aEG > 0.01) { ctx.setLine(lineOdd, [centre, at(lam[0], outer)]); oddA = aEG; }
          else if (aIE > 0.01) { ctx.setLine(lineOdd, [centre, at(lam[2], outer)]); oddA = aIE; }
          ctx.fade(lineOdd, oddA);
          passing.userData.draw([aEG > 0.05 ? "Europa and Ganymede pass — Io is on the far side"
            : aIE > 0.05 ? "Io and Europa pass — Ganymede is 90° away" : ""]);
          ctx.fade(passing, Math.max(aEG, aIE));
          clock.userData.draw([`Day ${days.toFixed(1)}`, `${(days / 7.154553).toFixed(2)} Ganymede orbits`]);
          ctx.fade(clock, smooth(p, 0.04, 0.08));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 67 */
  event({
    id: "jupiter-shadow-transit",
    section: "giants",
    title: "Moon shadows on Jupiter",
    place: "Jupiter",
    kind: "recurring",
    family: "alignment",
    often: "Io's shadow every 42 hours",
    timeline: { last: "Three shadows at once: January 2015", next: "Io's shadow crosses every 1.77 days" },
    detail: "When a big moon passes between Jupiter and the Sun, its shadow crosses the clouds as a small black dot — a total eclipse for anything beneath it",
    frequency: "Io's shadow crosses Jupiter on every orbit, every 1.77 days; Europa's and Ganymede's on most of theirs. Callisto's misses for years at a time, when the geometry tilts it past the planet. Double shadow transits happen several times a year; triples are rare.",
    cause: "Jupiter's moons orbit almost exactly in the plane of its equator, and Jupiter is tilted only about 3°, so the inner moons pass between Jupiter and the Sun on nearly every orbit. Their shadows fall on the cloud tops as sharp dark dots.",
    note: "Seen from under Io's shadow, Io looks about six times wider than the Sun, so the eclipse is total. On January 23–24, 2015, Hubble caught Io, Europa and Callisto casting shadows at the same time.",
    accuracy: "A diagram: the moons and their shadows are enlarged twice, and their paths are spread across the disc so each can be followed — real shadows cross close to Jupiter's equator. The eclipse close-up has the true ratio of Io's and the Sun's sizes as seen from Jupiter.",
    art: { main: "jupiter", fx: "shadow" },
    scene(ctx) {
      /* The Sun behind the viewer, a little to the left. */
      ctx.light.set(-0.45, 0.1, 0.89).normalize();
      /* layout */
      const R = 0.56;
      const jc = new THREE.Vector3(-0.3, 0.0, 0);
      const jupiter = ctx.ball(R, { body: "Jupiter", rim: 0.2, rimColour: "#ffdcae" });
      jupiter.position.copy(jc);
      /* Diameters, km (NASA): Io 3,643, Europa 3,122, Callisto 4,821;
       * Jupiter 142,984. Enlarged ×2 (drawing choice). */
      const s = (2 * R / 142984) * 2;
      const MOONS = [
        /* off: where the shadow falls relative to the moon, as seen (Sun to
         * the left; farther moons cast farther: drawing choice). */
        { name: "Io", d: 3643, colour: "#e8d36a", y: 0.1, z: 0.62, t0: 0.02, t1: 0.52, off: 0.1 },
        { name: "Europa", d: 3122, colour: "#d6c7ad", y: -0.22, z: 0.66, t0: 0.5, t1: 1.08, off: 0.14 },
        { name: "Callisto", d: 4821, colour: "#7d7268", y: 0.3, z: 0.7, t0: 0.5, t1: 1.22, off: 0.24 },
        { name: "Io", d: 3643, colour: "#e8d36a", y: 0.0, z: 0.62, t0: 0.6, t1: 1.0, off: 0.1 },
      ];
      const items = MOONS.map((m) => {
        const r = (m.d / 2) * s;
        const ball = ctx.ball(r, { body: m.name, colour: m.colour, segments: 32 });
        const umbra = ctx.disc(r * 0.95, { colour: "#000000", opacity: 0.93 });
        const pen = ctx.disc(r * 1.35, { colour: "#000000", opacity: 0.3 });
        umbra.renderOrder = 23;
        pen.renderOrder = 22;
        const tag = ctx.label([m.name], { height: 0.022, colour: m.colour });
        return { ...m, r, ball, umbra, pen, tag };
      });
      const shadowLabel = ctx.label(["Io's shadow"], { height: 0.024 });

      /* Close-up: the view from the cloud tops under the shadow. Io from
       * there: 3,643 km at ~350,000 km = 0.60°; the Sun from 5.2 AU = 0.10°
       * (0.533° / 5.2). Ratio ≈ 5.8. */
      const insetC = new THREE.Vector3(0.76, 0.5, 0);
      const insetR = 0.22;
      const sky = ctx.disc(insetR, { colour: "#2a3c58", opacity: 0.92 });
      sky.position.copy(insetC);
      const rim = ctx.circle(insetR, { plane: "xy", colour: "#9fb3c8", opacity: 0.4 });
      rim.position.copy(insetC);
      const sunR = 0.024;
      const sunDisc = ctx.disc(sunR, { colour: "#fff3c4" });
      sunDisc.position.set(insetC.x, insetC.y, 0.01);
      const sunGlow = ctx.glow("#ffd27f", 0.16, { opacity: 0.8 });
      sunGlow.position.set(insetC.x, insetC.y, 0.012);
      const ioDisc = ctx.disc(sunR * 5.8, { colour: "#15110a" });
      ioDisc.renderOrder = 27;
      const insetLabel = ctx.label(["From the cloud tops", "Io is about 6× wider than the Sun"], { at: [insetC.x, insetC.y - insetR - 0.07, 0], height: 0.022 });
      const triple = ctx.label(["Three shadows at once", "Io, Europa and Callisto · January 2015"], { at: [0.62, -0.5, 0], height: 0.026 });

      ctx.tell([
        { at: 0, label: "A moon crossing", text: "Io passes between Jupiter and the Sun. Its shadow falls on the clouds as a small, perfectly black dot." },
        { at: 0.3, label: "Total eclipse", text: "Under that dot the Sun is completely hidden: from Jupiter, Io looks about six times wider than the Sun." },
        { at: 0.58, label: "Two, then three", text: "Sometimes two, or even three, shadows cross at once." },
        { at: 0.8, label: "January 2015", text: "Hubble caught Io, Europa and Callisto casting shadows on Jupiter together." },
      ]);

      const dir = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      const zAxis = new THREE.Vector3(0, 0, 1);
      return {
        duration: 20,
        update(p) {
          jupiter.rotation.y = lerp(0, 0.6, p);
          /* Moons sit in front of the planet, nearer the lens; place them so
           * they appear on the intended path (perspective-corrected). */
          const D = 1 / Math.tan(THREE.MathUtils.degToRad((ctx.camera.fov || 56) / 2));
          const width = typeof innerWidth === "number" ? innerWidth : 1280;
          const axisX = Math.min(0.32, 360 / width) * (ctx.camera.aspect || 1.6);
          const axisY = -0.04;
          let firstShadow = null;
          items.forEach((m, i) => {
            const u = span(p, m.t0, m.t1);
            const active = p > m.t0 && p < m.t1;
            const xs = lerp(jc.x - 0.8, jc.x + 0.8, u);
            const k = (D - m.z) / D;
            const x = axisX + (xs - axisX) * k;
            const y = axisY + (jc.y + m.y - axisY) * k;
            m.ball.position.set(x, y, m.z);
            m.ball.scale.setScalar(k);
            m.ball.rotation.y = ctx.t * 0.3;
            const vis = active ? smooth(u, 0, 0.06) * (1 - smooth(u, 0.94, 1)) : 0;
            ctx.fade(m.ball, vis);
            m.tag.position.set(x, y + (m.r + 0.04) * k, m.z);
            ctx.fade(m.tag, vis * (i === 3 && p < 0.7 ? 0 : 1));
            /* Shadow: where the line of sight to the shadow's apparent place
             * meets the globe (so moon and shadow read correctly on screen). */
            const cam = new THREE.Vector3(axisX, axisY, D);
            dir.set(xs + m.off, jc.y + m.y - 0.02, 0).sub(cam).normalize();
            const o = tmp.copy(cam).sub(jc);
            const b = o.dot(dir);
            const c = o.lengthSq() - R * R;
            const disc = b * b - c;
            let shown = 0;
            if (active && disc > 0) {
              const t = -b - Math.sqrt(disc);
              if (t > 0) {
                const hit = o.clone().addScaledVector(dir, t);
                const n = hit.clone().normalize();
                const edge = smooth(n.z, 0.05, 0.25);
                shown = edge * vis;
                [m.umbra, m.pen].forEach((d) => {
                  d.position.copy(hit).addScaledVector(n, 0.003).add(jc);
                  d.quaternion.setFromUnitVectors(zAxis, n);
                });
                if (i === 0) firstShadow = m.umbra.position.clone();
              }
            }
            ctx.fade(m.umbra, shown);
            ctx.fade(m.pen, shown);
          });
          if (firstShadow) shadowLabel.position.set(firstShadow.x + 0.02, firstShadow.y - 0.09, 0.6);
          ctx.fade(shadowLabel, firstShadow ? win(p, 0.12, 0.42) : 0);

          /* Close-up eclipse: Io slides over the Sun, 0.3–0.56. */
          const inset = win(p, 0.28, 0.58, 0.04);
          const slide = span(p, 0.31, 0.55);
          ioDisc.position.set(insetC.x + lerp(-0.34, 0.34, slide), insetC.y + 0.01, 0.02);
          const cover = 1 - smooth(Math.abs(ioDisc.position.x - insetC.x), sunR * 5.8 - sunR, sunR * 5.8 + sunR);
          sky.material.color.set("#2a3c58").lerp(new THREE.Color("#04060c"), cover);
          sunGlow.material.opacity = 0.8 * (1 - cover) * inset;
          [sky, rim, sunDisc, insetLabel].forEach((o) => ctx.fade(o, inset));
          ctx.fade(ioDisc, inset * (1 - smooth(Math.abs(ioDisc.position.x - insetC.x), 0.12, 0.3)));
          ctx.fade(triple, smooth(p, 0.78, 0.84));
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 68 */
  event({
    id: "europa-tides",
    section: "giants",
    title: "Europa's tides heat a hidden ocean",
    place: "Europa",
    kind: "ongoing",
    family: "geology",
    often: "every 3.55 days",
    detail: "Jupiter squeezes and stretches Europa on every orbit, and the flexing keeps a salty ocean liquid under the ice",
    frequency: "Continuous: the squeeze rises and falls once every orbit, 3.55 days.",
    cause: "Europa's orbit is slightly stretched — the Laplace resonance with Io and Ganymede keeps it that way — so its distance from Jupiter changes. Jupiter's pull raises a tidal bulge in Europa that grows near Jupiter and relaxes farther out. That constant flexing, like bending a paperclip back and forth, turns into heat inside, enough to keep the ocean from freezing.",
    note: "NASA's estimates: an ice shell perhaps 15–25 km thick over an ocean 60–150 km deep — perhaps twice as much water as all Earth's oceans. Water, rock beneath it and a source of energy make it one of the best places to look for life beyond Earth.",
    accuracy: "A diagram. The orbit's stretch (eccentricity 0.009) is exaggerated many times, and so is the flexing — the real surface rises and falls by tens of metres. The layers are thickened so they can be seen; their order is right.",
    art: { main: "europa", second: "jupiter", fx: "tides" },
    scene(ctx) {
      ctx.light.set(-0.5, 0.4, 0.77).normalize();
      /* layout */
      /* The orbit inset, upper left. */
      const oc = new THREE.Vector3(-0.72, 0.5, 0);
      const jup = ctx.ball(0.07, { body: "Jupiter" });
      jup.position.copy(oc);
      const A = 0.22;
      const E = 0.3; /* drawn eccentricity; real 0.009 (JPL) */
      const orbit = ctx.orbit(A, E, { plane: "xy", colour: "#cbbba3", opacity: 0.4 });
      orbit.position.copy(oc);
      const dot = ctx.ball(0.022, { body: "Europa", colour: "#d8c9b0" });
      const orbitLabel = ctx.label(["Europa's orbit", "stretch exaggerated"], { at: [oc.x, oc.y - 0.24, 0], height: 0.022 });

      /* The big Europa: a globe, then cut open. `flex` stays square to the
       * screen (the tide stretches it toward Jupiter, to the left); `turn`
       * swings the cut face toward us. */
      const ec = new THREE.Vector3(0.36, -0.06, 0);
      const ER = 0.46;
      const flex = new THREE.Group();
      flex.position.copy(ec);
      ctx.add(flex);
      const turn = new THREE.Group();
      turn.rotation.set(0.15, 0.9, 0);
      flex.add(turn);
      const ICE = "#d8cbb4";
      const globe = ctx.ball(ER, { colour: ICE, parent: turn, rim: 0.3, rimColour: "#cfe6ff" });
      const half = new THREE.Mesh(new THREE.SphereGeometry(ER, 64, 32, Math.PI / 2, Math.PI), ctx.material({ colour: ICE, rim: 0.3, rimColour: "#cfe6ff" }));
      half.raycast = () => {};
      half.renderOrder = 20;
      turn.add(half);
      /* Lineae: reddish cracks as great-circle arcs, on the globe and, where
       * they fall on the kept half, on the cut-away too. */
      const cr = rng(68);
      for (let i = 0; i < 16; i += 1) {
        const axis = new THREE.Vector3(cr() - 0.5, cr() - 0.5, cr() - 0.5).normalize();
        const start = new THREE.Vector3(cr() - 0.5, cr() - 0.5, cr() - 0.5).normalize().projectOnPlane(axis).normalize();
        const len = 0.6 + cr() * 1.4;
        const pts = [];
        for (let j = 0; j <= 40; j += 1) pts.push(start.clone().applyAxisAngle(axis, (j / 40) * len).multiplyScalar(ER * 1.003));
        ctx.line(pts, { colour: "#9a5a3a", opacity: 0.6, parent: globe, additive: false });
        const kept = pts.filter((v) => v.x > 0.005);
        if (kept.length > 1) ctx.line(kept, { colour: "#9a5a3a", opacity: 0.6, parent: half, additive: false });
      }
      /* The cut face: layers as discs in the plane x = 0, smallest nearest
       * us. Radius fractions (thickened, drawing choice): ice to 1.0, ocean
       * to 0.92, rock to 0.8, iron core to 0.38. */
      const cut = new THREE.Group();
      turn.add(cut);
      const LAYERS = [
        { f: 1.0, colour: "#eef4fa" },
        { f: 0.92, colour: "#1f5fa8" },
        { f: 0.8, colour: "#7a5c44" },
        { f: 0.38, colour: "#9a8f86" },
      ];
      LAYERS.forEach((l, i) => {
        const d = ctx.disc(ER * l.f, { colour: l.colour, parent: cut });
        d.rotation.y = Math.PI / 2;
        d.position.x = -0.002 * (i + 1);
      });
      const heat = ctx.glow("#ff8a3c", ER * 1.4, { opacity: 0, parent: cut });
      heat.position.x = -0.02;
      const oceanGlow = ctx.glow("#4fb0ff", ER * 2.4, { opacity: 0, parent: cut });
      oceanGlow.position.x = -0.03;
      /* Undeformed outline, for reference while it flexes. */
      const ghost = ctx.circle(ER, { plane: "xy", colour: "#9fd0ff", opacity: 0.45, dashed: true, dash: 0.02, gap: 0.015 });
      ghost.position.copy(ec).setZ(0.3);

      /* Labels on the left, with leaders to the cut face. */
      const LBL = [
        { lines: ["Ice shell", "perhaps 15–25 km"], f: 0.97, beta: 0.95, y: 0.36, colour: "#e8f1ff" },
        { lines: ["Salty ocean", "60–150 km deep"], f: 0.86, beta: 0.6, y: 0.2, colour: "#bfe6ff" },
        { lines: ["Rock"], f: 0.6, beta: 0.15, y: 0.02, colour: "#f0d8c0" },
      ];
      const labelX = ec.x - ER - 0.1;
      const leaders = LBL.map((l) => {
        const label = ctx.label(l.lines, { at: [labelX, ec.y + l.y, 0.1], height: 0.022, align: "right", colour: l.colour });
        const line = ctx.line([[0, 0, 0], [0, 0, 0.001]], { colour: l.colour, opacity: 0.6, additive: false });
        return { ...l, label, line };
      });
      const arrow = ctx.arrow([ec.x - 0.3, ec.y - ER - 0.1, 0], [ec.x - 0.62, ec.y - ER - 0.1, 0], { colour: "#ffd27f", opacity: 0.8 });
      const toJ = ctx.label(["to Jupiter"], { at: [ec.x - 0.46, ec.y - ER - 0.16, 0], height: 0.022, colour: "#ffd27f" });
      const gauge = ctx.label(["", ""], { at: [oc.x, oc.y - 0.42, 0], height: 0.03 });

      ctx.tell([
        { at: 0, label: "An ice world", text: "Europa, a little smaller than our Moon, wrapped in ice and criss-crossed by cracks." },
        { at: 0.18, label: "The hidden ocean", text: "Under the ice lies a salty ocean — perhaps twice as much water as all of Earth's oceans." },
        { at: 0.4, label: "Squeeze and stretch", text: "Its orbit is slightly stretched. Near Jupiter the tide pulls it longer; farther out it relaxes — every 3.55 days." },
        { at: 0.78, label: "Kept warm", text: "The flexing heats the inside and keeps the ocean liquid: one of the best places to look for life." },
      ]);

      /* Kepler: mean anomaly → true anomaly and radius. */
      const keplerAt = (M) => {
        let Ea = M;
        for (let i = 0; i < 8; i += 1) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea));
        const nu = 2 * Math.atan2(Math.sqrt(1 + E) * Math.sin(Ea / 2), Math.sqrt(1 - E) * Math.cos(Ea / 2));
        return { nu, r: A * (1 - E * Math.cos(Ea)) };
      };
      const toRoot = (v) => v.applyEuler(turn.rotation).multiply(flex.scale).add(flex.position);
      return {
        duration: 20,
        update(p) {
          jup.rotation.y = ctx.t * 0.4;
          /* Three orbits over 0.3–0.98; before that, a slow start. */
          const orbits = 3 * span(p, 0.3, 0.98) + 0.15 * smooth(p, 0.0, 0.3);
          const { nu, r } = keplerAt(orbits * TAU + Math.PI);
          dot.position.set(oc.x + Math.cos(nu) * r, oc.y + Math.sin(nu) * r, 0);
          /* Tidal stretch ∝ (a/r)³ (tidal force); the drawn amplitude is a
           * drawing choice. */
          const tide = (A / r) ** 3;
          const tideMin = (1 / (1 + E)) ** 3;
          const tideMax = (1 / (1 - E)) ** 3;
          const level = (tide - tideMin) / (tideMax - tideMin);
          const flexOn = smooth(p, 0.38, 0.46);
          const stretch = 1 + flexOn * (0.02 + 0.1 * level);
          flex.scale.set(stretch, 1 / Math.sqrt(stretch), 1);
          globe.rotation.y = ctx.t * 0.04;
          /* Globe → cut-away, 0.18–0.26. */
          const open = smooth(p, 0.18, 0.26);
          ctx.fade(globe, 1 - open);
          ctx.fade(half, open > 0.01 ? 1 : 0);
          ctx.fade(cut, open);
          heat.material.opacity = flexOn * (0.15 + 0.55 * level);
          oceanGlow.material.opacity = 0.3 * smooth(p, 0.78, 0.86);
          leaders.forEach((l) => {
            /* A point on the cut face, up and to the left (−z is screen-left). */
            const a = toRoot(new THREE.Vector3(-0.01, ER * l.f * Math.sin(l.beta), -ER * l.f * Math.cos(l.beta)));
            ctx.setLine(l.line, [[labelX + 0.02, ec.y + l.y, 0.1], a]);
            ctx.fade(l.line, open);
            ctx.fade(l.label, open);
          });
          ctx.fade(ghost, flexOn);
          ctx.fade(arrow, smooth(p, 0.38, 0.44));
          ctx.fade(toJ, smooth(p, 0.38, 0.44));
          ctx.fade(orbitLabel, smooth(p, 0.38, 0.44));
          gauge.userData.draw([level > 0.55 ? "Close to Jupiter" : level < 0.25 ? "Far from Jupiter" : "Swinging round", level > 0.55 ? "stretched hardest" : level < 0.25 ? "relaxing" : ""]);
          ctx.fade(gauge, flexOn);
        },
      };
    },
  }),

  /* ------------------------------------------------------------------ 69 */
  event({
    id: "jupiter-lightning",
    section: "giants",
    title: "Lightning and sprites on Jupiter",
    place: "Jupiter",
    kind: "recurring",
    family: "planetary",
    often: "constantly, in its storms",
    detail: "Lightning flashes deep in Jupiter's water clouds, most often near the poles — and Juno may have seen red sprites high above",
    frequency: "Constant somewhere on the planet. Juno recorded thousands of flashes in its first years, most of them at high latitudes and more in the north.",
    cause: "As on Earth, lightning comes from storms: rising water droplets and ice collide and separate electric charge until it discharges. On Jupiter the storms grow deep in the water clouds, far below the visible cloud tops. Near the equator a warm, stable layer may keep storms from forming, which is why the flashes crowd towards the poles — the opposite of Earth.",
    note: "Juno heard Jupiter's lightning in radio in 2018, and in 2020 its ultraviolet camera caught brief flashes high in the atmosphere that look like sprites or elves — the same kind of upper-air lightning seen over thunderstorms on Earth. They are still called possible.",
    accuracy: "A diagram. Flashes are scattered with more near the poles and in the north, as Juno found, but not from a real map; the atmosphere column is not to scale.",
    art: { main: "jupiter", fx: "flash" },
    scene(ctx) {
      /* The Sun to the right: the left of the disc is night,
       * where flashes show. */
      ctx.light.set(1, 0.2, 0).normalize();
      /* layout */
      const R = 0.5;
      const holder = new THREE.Group();
      holder.position.set(-0.48, 0.02, 0);
      holder.rotation.x = 0.45; /* north pole tipped toward us */
      ctx.add(holder);
      const jupiter = ctx.ball(R, { body: "Jupiter", parent: holder, night: 0.025, rim: 0 });
      /* Flashes: fixed times and places. Latitude weighted toward the poles,
       * and north more than south (Juno, Brown et al. 2018: drawing choice). */
      const fr = rng(69);
      const F = 80;
      const flashes = Array.from({ length: F }, () => {
        const north = fr() < 0.65;
        const lat = (north ? 1 : -1) * (fr() < 0.8 ? lerp(45, 80, fr()) : lerp(10, 45, fr()));
        return { lat, lon: lerp(-150, -10, fr()), t: fr(), size: 0.06 + fr() * 0.08, sprite: null };
      });
      flashes.forEach((f) => {
        f.sprite = ctx.glow(fr() > 0.5 ? "#e6efff" : "#bfd8ff", f.size, { opacity: 0, parent: holder });
        f.sprite.position.copy(sph(R * 1.01, f.lat, f.lon));
      });
      const polarN = ctx.circle(R * Math.cos(55 * D2R), { plane: "xz", parent: holder, colour: "#bfd8ff", opacity: 0.55, dashed: true, dash: 0.02, gap: 0.015 });
      polarN.position.y = R * Math.sin(55 * D2R);
      const polarLabel = ctx.label(["Most flashes", "near the poles"], { at: [-0.48, 0.7, 0], height: 0.024, colour: "#bfd8ff" });

      /* The atmosphere column, right: water clouds below, the ammonia cloud
       * deck above, a storm tower punching up, a sprite high over it. Not
       * to scale. */
      const cx = 0.66;
      const w = 0.34;
      const top = 0.62;
      const bottom = -0.74;
      const box = (y0, y1, colour, opacity) => ctx.shape([[cx - w, y0], [cx + w, y0], [cx + w, y1], [cx - w, y1]], { colour, opacity });
      box(bottom, top, "#03050b", 0.9);
      box(-0.02, top, "#08101e", 0.9);
      box(-0.12, -0.02, "#d9c7a4", 0.75);
      box(-0.4, -0.12, "#3a2e26", 0.8);
      box(bottom, -0.4, "#4f6680", 0.8);
      /* The storm tower: overlapping puffs rising through the deck. */
      const tower = [[0, -0.52, 0.14], [-0.05, -0.38, 0.12], [0.04, -0.26, 0.11], [0, -0.13, 0.1], [-0.03, -0.02, 0.085], [0.03, 0.04, 0.07]];
      tower.forEach(([dx, y, r]) => {
        const d = ctx.disc(r * 0.85, { colour: "#c9d3de", opacity: 0.5 });
        d.position.set(cx + dx, y, 0.004);
      });
      ctx.label(["Ammonia cloud tops", "what we see from outside"], { at: [cx + w - 0.02, -0.07, 0.02], height: 0.018, align: "right", colour: "#2a1e10", sub: "#3a2a18" });
      const waterLabel = ctx.label(["Water clouds", "lightning forms here"], { at: [cx - w + 0.02, -0.66, 0.02], height: 0.02, align: "left", colour: "#e8f1ff" });
      /* Bolts inside the tower's base. */
      const br = rng(690);
      const bolts = Array.from({ length: 3 }, (_, i) => {
        const x0 = cx - 0.07 + i * 0.07;
        const pts = [];
        let x = x0;
        for (let j = 0; j <= 7; j += 1) { pts.push([x, -0.3 - j * 0.04, 0.02]); x += (br() - 0.5) * 0.05; }
        const line = ctx.line(pts, { colour: "#ffffff", opacity: 1, additive: false });
        const g = ctx.glow("#cfe0ff", 0.2, { opacity: 0 });
        g.position.set(x0, -0.44, 0.03);
        return { line, g, t: i * 2.1 + br() };
      });
      /* The sprite: a red column with tendrils, high above the tower. */
      const sprite = new THREE.Group();
      ctx.add(sprite);
      ctx.line([[cx, 0.5, 0.01], [cx, 0.28, 0.01]], { colour: "#ff4a5a", opacity: 0.9, parent: sprite });
      for (let k = -3; k <= 3; k += 1) {
        ctx.line([[cx, 0.3, 0.01], [cx + k * 0.022, 0.21, 0.01], [cx + k * 0.03, 0.14, 0.01]], { colour: "#ff6a7a", opacity: 0.75, parent: sprite });
        ctx.line([[cx, 0.48, 0.01], [cx + k * 0.02, 0.55, 0.01]], { colour: "#ff8a6a", opacity: 0.65, parent: sprite });
      }
      const spriteGlow = ctx.glow("#ff3a5a", 0.34, { opacity: 0.75, parent: sprite });
      spriteGlow.position.set(cx, 0.36, 0.015);
      const spriteLabel = ctx.label(["Sprite (possible)", "Juno · 2020"], { at: [cx + 0.07, 0.42, 0.02], height: 0.02, colour: "#ff9aa8", align: "left" });
      ctx.fade(sprite, 0);

      ctx.tell([
        { at: 0, label: "Deep storms", text: "Lightning on Jupiter flashes in giant thunderstorms deep in the water clouds, far below the cloud tops we see." },
        { at: 0.3, label: "Near the poles", text: "Juno found the flashes are most common at high latitudes — the opposite of Earth, where they crowd the tropics." },
        { at: 0.62, label: "Sprites", text: "High above the storms, Juno caught brief flashes that look like sprites: red upper-air lightning, like those over storms on Earth." },
      ]);

      return {
        duration: 20,
        update(p) {
          jupiter.rotation.y = 0.8;
          /* Each flash: a short blink at its own time, in four rounds. */
          flashes.forEach((f, i) => {
            let a = 0;
            for (let round = 0; round < 4; round += 1) {
              const tc = (f.t + round) / 4;
              a = Math.max(a, Math.exp(-(((p - tc) / 0.01) ** 2)));
            }
            const flicker = 0.7 + 0.3 * Math.sin(ctx.t * 40 + i);
            f.sprite.material.opacity = Math.min(1, a * flicker * 1.3);
          });
          ctx.fade(polarN, win(p, 0.3, 0.64));
          ctx.fade(polarLabel, win(p, 0.3, 0.64));
          bolts.forEach((b, i) => {
            /* Decorative flicker (real seconds). */
            const on = Math.sin(ctx.t * 2.3 + b.t * 3 + i * 1.7) > 0.55 ? 1 : 0;
            ctx.fade(b.line, on);
            b.g.material.opacity = 0.85 * on;
          });
          ctx.fade(waterLabel, smooth(p, 0.02, 0.06));
          /* Sprites: from 0.62, pulsing. */
          ctx.fade(sprite, smooth(p, 0.62, 0.66) * (0.55 + 0.45 * Math.max(0, Math.sin(ctx.t * 2.6))));
          ctx.fade(spriteLabel, smooth(p, 0.62, 0.66));
        },
      };
    },
  }),
];

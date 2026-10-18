import * as THREE from "three";
import { event, smooth, win, span, lerp, clamp01, TAU, rng, easeInOut } from "./kit.js";
import { bodyRadius, yawFor } from "./real.js";
import { toHud, worldRadius, holdShot, distanceFor, hudKit, pin, shotDirection, dirAt } from "./bodyKit.js";

const DEG = Math.PI / 180;

/**
 * Section 6 of the catalogue: Jupiter and its moons (round 79).
 *
 * Six events: the 2010 belt fade, Io's flux tube, the Laplace resonance,
 * moon shadows, Europa's tides and Jovian lightning. Round 84 (Prompts.md):
 * the belt fade, the flux tube, the resonance and the lightning now play on
 * the real Jupiter, Io, Europa and Ganymede; the shrinking Great Red Spot
 * was removed as a duplicate of "A storm wider than Earth". The round-79
 * dioramas are in docs/archive/giants-dioramas-round79/jupiter.js.
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
  /* Round 84 (Prompts.md: "The shrinking Great Red Spot -> There was one
   * similar event right? ... if there is another similar event then remove
   * it"): removed -- "A storm wider than Earth" (scale.js) tells the same
   * story (three Earths in the 1880s, 1.3 today) on the real Jupiter. The
   * round-79 version is in docs/archive/giants-dioramas-round79/jupiter.js. */
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
    accuracy: "The site's own Jupiter, its Cassini map. The bright cover and the dark outbreak are painted on a shell just over it to show the sequence, not from images of 2010; the belt's edges are measured from the map, and the months are approximate.",
    art: { main: "jupiter", fx: "storm" },
    body: "Jupiter",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "A cloud belt vanishes -> show this using our
       * real jupiter"): a shell laid just over the real Jupiter paints the
       * bright high clouds over its South Equatorial Belt, then clears them
       * outward from a single bright outbreak, as in 2010–11.
       */
      const jupiter = ctx.host;
      const R = worldRadius(jupiter);
      const J = jupiter.getWorldPosition(new THREE.Vector3());
      const sunDir = J.clone().negate().normalize();
      const fov = jupiter.userData?.focusFov ?? 30;
      /* From the Sun's side, a little round, a little south so the belt
       * (7–19.5° S in the bundled map, measured) faces us. */
      const view = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3).normalize();
      const shot = holdShot(ctx, "Jupiter", jupiter, { yaw: yawFor(view), pitch: -0.12, distance: distanceFor(R, 0.4, fov) });
      /* The outbreak's longitude: whatever faces the camera when the event
       * starts, so the revival starts in view. */
      const q = new THREE.Quaternion();
      jupiter.getWorldQuaternion(q);
      const toCam = shotDirection(shot.yaw, shot.pitch);
      const camLocal = toCam.clone().applyQuaternion(q.clone().invert());
      const outLon = Math.atan2(camLocal.z, camLocal.x);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uCover: { value: 0 }, uClear: { value: 0 }, uOutLon: { value: outLon }, uDark: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 },
          uLatLo: { value: THREE.MathUtils.degToRad(-19.5) }, uLatHi: { value: THREE.MathUtils.degToRad(-7) }, uEdges: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vLocal;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          void main() {
            vLocal = normalize(position);
            vWorldNormal = normalize(mat3(modelMatrix) * position);
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorldPos = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uCover;
          uniform float uClear;
          uniform float uOutLon;
          uniform float uDark;
          uniform float uTime;
          uniform float uOpacity;
          uniform float uLatLo;
          uniform float uLatHi;
          uniform float uEdges;
          varying vec3 vLocal;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPos;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          void main() {
            float lat = asin(clamp(vLocal.y, -1.0, 1.0));
            float lon = atan(vLocal.z, vLocal.x);
            float band = smoothstep(uLatLo - 0.02, uLatLo + 0.03, lat) * (1.0 - smoothstep(uLatHi - 0.03, uLatHi + 0.02, lat));
            float d = abs(atan(sin(lon - uOutLon), cos(lon - uOutLon)));
            float cleared = 1.0 - smoothstep(uClear * 3.2 - 0.25, uClear * 3.2, d);
            float wisp = 0.85 + 0.15 * sin(lon * 23.0 + lat * 40.0) * sin(lon * 7.0 - lat * 13.0);
            float cover = band * uCover * (1.0 - cleared) * wisp;
            /* the dark outbreak: streaks near the clearing front */
            float front = band * uDark * exp(-pow((d - uClear * 3.2 + 0.1) * 6.0, 2.0)) * (0.6 + 0.4 * sin(lon * 60.0 + lat * 30.0));
            /* Drawn over Jupiter's own haze layers (no depth test), so only
             * the half facing the camera is kept. */
            vec3 toCam = normalize(cameraPosition - vWorldPos);
            if (dot(normalize(vWorldNormal), toCam) < 0.02) discard;
            /* The belt's two edges, as thin bright lines. */
            float edge = (exp(-pow((lat - uLatLo) / 0.006, 2.0)) + exp(-pow((lat - uLatHi) / 0.006, 2.0))) * uEdges;
            vec3 sunDir = normalize(-vWorldPos);
            float lit = 0.25 + 0.75 * max(dot(normalize(vWorldNormal), sunDir), 0.0);
            vec3 pale = vec3(0.93, 0.88, 0.78) * lit;
            vec3 dark = vec3(0.30, 0.20, 0.13) * lit;
            float a = max(cover, front * 0.9);
            vec3 col = mix(pale, dark, front / max(a, 0.001) * step(0.001, front));
            col = mix(col, vec3(1.0, 0.82, 0.5), min(1.0, edge));
            a = max(a, min(1.0, edge) * 0.95);
            gl_FragColor = vec4(col, a * uOpacity);
            #include <colorspace_fragment>
          }
        `,
        transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(bodyRadius(jupiter) * 1.004, 192, 96), material);
      shell.renderOrder = 34;
      shell.raycast = () => {};
      ctx.attach(jupiter, shell);
      /* The belt's edges, as lines of latitude. */
      const latLine = (deg) => {
        const pts = [];
        const rr = bodyRadius(jupiter) * 1.008;
        for (let i = 0; i <= 160; i += 1) {
          const a = (i / 160) * TAU;
          pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(deg * DEG) * rr, Math.sin(deg * DEG) * rr, Math.sin(a) * Math.cos(deg * DEG) * rr));
        }
        const l = ctx.line(pts, { colour: "#ffd27f", opacity: 0.8, dashed: true, dash: rr * 0.04, gap: rr * 0.03 });
        ctx.attach(jupiter, l);
        ctx.fade(l, 0);
        return l;
      };
      const edges = [];
      void latLine;
      const plume = ctx.glow("#ffffff", bodyRadius(jupiter) * 0.12, { opacity: 1 });
      ctx.attach(jupiter, plume);
      plume.material.depthTest = false;
      plume.renderOrder = 35;
      plume.position.copy(new THREE.Vector3(Math.cos(outLon) * Math.cos(-13 * DEG), Math.sin(-13 * DEG), Math.sin(outLon) * Math.cos(-13 * DEG)).multiplyScalar(bodyRadius(jupiter) * 1.01));
      ctx.fade(plume, 0);
      const spin0 = jupiter.rotation.y;

      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const beltLabel = H.label(["South Equatorial Belt", "one of Jupiter's two great dark belts"], { align: "right", height: 0.044, colour: "#ffe3a8", declutter: false });
      const plumeLabel = H.label(["a bright plume", "a storm punching up from below"], { align: "left", height: 0.044, declutter: false });
      const clock = H.label(["", ""], { at: [-0.5, 0.62, 0], height: 0.046, declutter: false });
      [beltLabel, plumeLabel, clock].forEach((o) => ctx.fade(o, 0));
      ctx.tell([
        { at: 0, label: "Two dark belts", text: "The real Jupiter: two great dark belts girdle it. The southern one is the South Equatorial Belt." },
        { at: 0.14, label: "Gone", text: "2010: astronomers found it simply gone — hidden under a layer of bright, high ammonia-ice clouds." },
        { at: 0.44, label: "An outbreak", text: "Months later, in November 2010, a bright plume broke through, and dark outbreaks spread round the planet." },
        { at: 0.78, label: "Back again", text: "By early 2011 the belt was back. It has faded and returned like this many times." },
      ]);
      const MONTHS = ["mid-2009", "late 2009", "spring 2010", "summer 2010", "autumn 2010", "November 2010", "December 2010", "January 2011", "early 2011"];
      return {
        duration: 24,
        update(p) {
          shot.keep();
          /* Held so the outbreak stays in view. */
          jupiter.rotation.y = spin0;
          material.uniforms.uTime.value = ctx.t;
          material.uniforms.uCover.value = smooth(p, 0.12, 0.34);
          material.uniforms.uClear.value = easeInOut(span(p, 0.48, 0.92));
          material.uniforms.uDark.value = smooth(p, 0.46, 0.52) * (1 - smooth(p, 0.9, 0.97));
          material.uniforms.uEdges.value = smooth(p, 0.04, 0.08) * (1 - smooth(p, 0.3, 0.36) * 0.6);
          void edges;
          ctx.fade(plume, smooth(p, 0.42, 0.45) * (1 - smooth(p, 0.62, 0.7)));
          plume.scale.setScalar(bodyRadius(jupiter) * (0.12 + 0.03 * Math.sin(ctx.t * 4)));
          pin(ctx, beltLabel, J.clone().add(new THREE.Vector3(0, -R * 0.28, 0)).addScaledVector(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), shotDirection(shot.yaw, shot.pitch)).normalize(), -R * 1.05), -0.03, 0);
          ctx.fade(beltLabel, smooth(p, 0.05, 0.09) * (1 - smooth(p, 0.4, 0.44)));
          pin(ctx, plumeLabel, plume.getWorldPosition(new THREE.Vector3()), 0.08, -0.1);
          ctx.fade(plumeLabel, smooth(p, 0.44, 0.48) * (1 - smooth(p, 0.7, 0.74)));
          const m = Math.min(MONTHS.length - 1, Math.floor(span(p, 0.06, 0.94) * MONTHS.length));
          clock.userData.draw([MONTHS[m], p < 0.42 ? (p < 0.14 ? "the belt is there" : "the belt is fading away") : p < 0.9 ? "the belt is coming back" : "the belt is back"]);
          ctx.fade(clock, smooth(p, 0.04, 0.08));
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
    accuracy: "The site's own Jupiter and Io, with Io put on its real orbit, 5.9 Jupiter radii out (the site usually draws it closer in); Io is drawn far larger than real, and its motion is sped up. The field is drawn as a simple dipole along the spin axis -- the real one is tilted about 10° and lumpier -- and the current's pulses are a picture.",
    art: { main: "jupiter", second: "io", fx: "beam" },
    body: "Jupiter",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "Io's electric current -> using real space
       * bodies"): the real Jupiter and the real Io, Io put on its real orbit
       * (5.9 Jupiter radii; the site draws it closer in), the flux tube's
       * field lines between them, the current pulsing along them, and Io's
       * footprint in the aurora near each pole.
       */
      /* Io's orbit 421,800 km / 71,492 km = 5.90 Jupiter radii; period
       * 1.769 d; Jupiter turns in 9.925 h (JPL, NASA). A dipole line of
       * shell L reaches the planet at colatitude asin(1/sqrt(L)) = 24.3°,
       * i.e. 65.7° N and S (field taken along the spin axis -- the real one
       * is tilted about 10°). */
      const jupiter = ctx.host;
      const io = ctx.findBody("Io");
      const pivot = io?.parent;
      const plane = pivot?.parent;
      if (!io || !pivot || !plane) return { duration: 24, update() {} };
      const L = 421800 / JUPITER_R_KM;
      const R = worldRadius(jupiter);
      const J = jupiter.getWorldPosition(new THREE.Vector3());
      const planeScale = plane.getWorldScale(new THREE.Vector3()).x || 1;
      const RJ = R / planeScale;
      const A0p = pivot.rotation.y;
      void A0p;
      const sunDir = J.clone().negate().normalize();
      const fov = jupiter.userData?.focusFov ?? 30;
      const view = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.1).normalize();
      const shot = holdShot(ctx, "Jupiter", jupiter, { yaw: yawFor(view), pitch: 0.25, distance: distanceFor(R * L * 1.1, 0.8, fov) });
      /* Io starts on the left of the screen (the card covers the right):
       * the camera's right is (cos yaw, 0, -sin yaw); Io's pivot angle th
       * puts it at (cos th, 0, -sin th) in its plane. */
      const leftW = new THREE.Vector3(-Math.cos(shot.yaw), 0, Math.sin(shot.yaw));
      const leftP = leftW.applyQuaternion(plane.getWorldQuaternion(new THREE.Quaternion()).invert());
      const A0 = Math.atan2(-leftP.z, leftP.x) - 0.25;
      /* Drawn in Io's own orbit plane, so the lines go where Io goes. */
      const deck = new THREE.Group();
      ctx.attach(plane, deck);
      const K = hudKit(ctx, deck);
      const ioOrbit = K.circle(L * RJ, { colour: "#e8d36a", opacity: 0.6, additive: false });
      ctx.fade(ioOrbit, 0);
      /* Field lines through Io: its own (bright) and two neighbours. */
      const tube = new THREE.Group();
      deck.add(tube);
      const linePts = (Lv) => dipoleLine(RJ, Lv, 0, 120).map((v) => new THREE.Vector3(v.x, v.y, v.z));
      const main = K.line(linePts(L), { colour: "#9fe8ff", opacity: 1, parent: tube });
      const side1 = K.line(linePts(L * 0.97), { colour: "#9fe8ff", opacity: 0.4, parent: tube });
      const side2 = K.line(linePts(L * 1.03), { colour: "#9fe8ff", opacity: 0.4, parent: tube });
      const mainPts = linePts(L);
      /* The current: pulses running from Io to both poles. */
      const PULSES = 10;
      const pulses = Array.from({ length: PULSES }, () => K.glow("#bff4ff", RJ * 0.35, { opacity: 1, parent: tube }));
      /* The footprints and their trailing tails, near each pole. */
      const footLat = Math.asin(Math.sqrt(1 - 1 / L));
      const foot = (sgn) => {
        const g = K.glow("#c8a0ff", RJ * 0.55, { opacity: 1, parent: tube });
        g.position.set(Math.cos(footLat) * RJ * 1.01, sgn * Math.sin(footLat) * RJ * 1.01, 0);
        const tail = [];
        for (let i = 0; i <= 40; i += 1) {
          const a = (i / 40) * 1.2;
          tail.push(new THREE.Vector3(Math.cos(a) * Math.cos(footLat) * RJ * 1.01, sgn * Math.sin(footLat) * RJ * 1.01, Math.sin(a) * Math.cos(footLat) * RJ * 1.01));
        }
        const t = K.line(tail, { colour: "#c8a0ff", opacity: 0.8, parent: tube });
        return [g, t];
      };
      const feet = [...foot(1), ...foot(-1)];
      [tube].forEach((o) => ctx.fade(o, 0));

      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const ioLabel = H.label(["Io", "the generator"], { height: 0.044, colour: "#f2e38a", declutter: false });
      const tubeLabel = H.label(["the flux tube", "a current of millions of amps"], { align: "left", height: 0.044, colour: "#9fe8ff", declutter: false });
      const footLabel = H.label(["Io's footprint", "a glowing spot in the aurora"], { align: "right", height: 0.044, colour: "#d8b8ff", declutter: false });
      [ioLabel, tubeLabel, footLabel].forEach((o) => ctx.fade(o, 0));
      ctx.tell([
        { at: 0, label: "Wired together", text: "The real Jupiter and its moon Io, on Io's real orbit, six Jupiter radii out." },
        { at: 0.18, label: "A generator", text: "Jupiter's magnetic field sweeps past Io. Io conducts, and works like a giant generator." },
        { at: 0.38, label: "Millions of amps", text: "A current of millions of amps runs along the field lines between Io and Jupiter: the flux tube." },
        { at: 0.62, label: "Io's footprint", text: "Where the current reaches Jupiter, near each pole, it makes a glowing spot in the aurora: Io's own footprint." },
      ]);
      const w = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          /* Close in on the north pole for the footprint, from 0.62. */
          const close = smooth(p, 0.6, 0.7);
          shot.keep(lerp(shot.distance, distanceFor(R, 0.42, fov), close), shot.yaw, lerp(0.25, 1.05, close));
          /* Io round its real orbit, sped up: a third of a turn. */
          const th = A0 + span(p, 0.02, 1) * TAU * 0.1;
          pivot.rotation.y = th;
          io.position.x = L * RJ;
          io.position.y = 0;
          io.visible = true;
          tube.rotation.y = th;
          ctx.fade(ioOrbit, smooth(p, 0.02, 0.06) * 0.6);
          ctx.fade(tube, smooth(p, 0.18, 0.24));
          const cur = smooth(p, 0.38, 0.42);
          pulses.forEach((g, i) => {
            const s = (i / PULSES + ctx.t * 0.35) % 1;
            /* Half the pulses go to the north foot, half to the south. */
            const toNorth = i % 2 === 0;
            const f = toNorth ? 0.5 - s * 0.5 : 0.5 + s * 0.5;
            g.position.copy(along(mainPts, f));
            ctx.fade(g, cur * (1 - s * 0.3));
          });
          ctx.fade(main, 1);
          void side1; void side2;
          feet.forEach((o) => ctx.fade(o, smooth(p, 0.56, 0.62)));
          io.getWorldPosition(w);
          pin(ctx, ioLabel, w, 0, 0.1);
          ctx.fade(ioLabel, smooth(p, 0.02, 0.06) * (1 - close));
          pin(ctx, tubeLabel, plane.localToWorld(along(mainPts, 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), th)), 0.06, 0.02);
          ctx.fade(tubeLabel, smooth(p, 0.38, 0.42) * (1 - close));
          pin(ctx, footLabel, feet[0].getWorldPosition(new THREE.Vector3()), -0.08, 0.06);
          ctx.fade(footLabel, smooth(p, 0.64, 0.7));
        },
        dispose() { io.visible = true; },
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
    accuracy: "The site's own Io, Europa and Ganymede on the site's own orbits (closer in than real, in the right order), moved at their real periods and in a real resonant phase, sped up. The moons are drawn far larger than real.",
    art: { main: "jupiter", second: "io", fx: "dance" },
    body: "Jupiter",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "highlight their orbital path and show them
       * rotating"): the real Io, Europa and Ganymede on their own orbits
       * round the real Jupiter, highlighted, moved at their real periods
       * (sped up) and in their real resonant phase, with a line flashing
       * whenever two of them line up on the same side.
       */
      /* Sidereal periods, days (JPL): Io 1.769138, Europa 3.551181,
       * Ganymede 7.154553. The Laplace relation: lambda_Io - 3 lambda_Eu +
       * 2 lambda_Ga = 180°. */
      const jupiter = ctx.host;
      const R = worldRadius(jupiter);
      const MOONS = [
        { name: "Io", P: 1.769138, colour: "#e8d36a" },
        { name: "Europa", P: 3.551181, colour: "#d6c7ad" },
        { name: "Ganymede", P: 7.154553, colour: "#b9b2a6" },
      ].map((m) => ({ ...m, mesh: ctx.findBody(m.name) })).filter((m) => m.mesh?.parent?.parent);
      if (MOONS.length < 3) return { duration: 24, update() {} };
      const J = jupiter.getWorldPosition(new THREE.Vector3());
      const fov = jupiter.userData?.focusFov ?? 30;
      const outer = Math.max(...MOONS.map((m) => m.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(J)));
      const sunDir = J.clone().negate().normalize();
      const shot = holdShot(ctx, "Jupiter", jupiter, { yaw: yawFor(sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5)), pitch: 1.0, distance: distanceFor(outer * 1.15, 0.82, fov) });
      /* Phases: Ganymede and Europa start together, Io opposite -- one of
       * the configurations the resonance allows. */
      const lam0 = { Io: Math.PI, Europa: 0, Ganymede: 0 };
      MOONS.forEach((m) => {
        m.pivot = m.mesh.parent;
        m.plane = m.pivot.parent;
        m.a = m.mesh.position.x;
        m.base = m.pivot.rotation.y;
        const deck = new THREE.Group();
        ctx.attach(m.plane, deck);
        m.ring = ctx.circle(m.a, { colour: m.colour, opacity: 0.95, parent: deck, additive: false });
        m.ring.renderOrder = 30;
        ctx.fade(m.ring, 0);
      });
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const pairs = [[0, 1], [1, 2], [0, 2]];
      const conj = pairs.map(() => H.line([[0, 0, 0], [0.01, 0, 0]], { colour: "#ff8ad8", opacity: 1 }));
      const names = MOONS.map((m) => H.label([m.name], { height: 0.03, colour: m.colour, declutter: false }));
      const counter = H.label(["", "", ""], { at: [-0.98, 0.6, 0], align: "left", height: 0.06, declutter: false });
      const rule = H.label(["All three never line up on one side"], { at: [-0.45, -0.66, 0], height: 0.036, colour: "#ffe3a8", declutter: false });
      [...conj, ...names, counter, rule].forEach((o) => ctx.fade(o, 0));
      ctx.tell([
        { at: 0, label: "Three moons in step", text: "The real Io, Europa and Ganymede on their orbits round Jupiter, at their real periods, sped up." },
        { at: 0.18, label: "4 : 2 : 1", text: "For every orbit Ganymede makes, Europa makes two, and Io makes four." },
        { at: 0.46, label: "Regular tugs", text: "They meet at the same places again and again; the tugs keep their orbits stretched, which heats Io's volcanoes and Europa's ocean." },
        { at: 0.74, label: "Never all three", text: "And all three can never line up on the same side of Jupiter." },
      ]);
      /* Days of simulated time: 2.4 orbits of Ganymede. */
      const DAYS = 7.154553 * 2.4;
      const w = new THREE.Vector3();
      const hpos = MOONS.map(() => new THREE.Vector3());
      return {
        duration: 24,
        update(p) {
          shot.keep();
          const days = DAYS * span(p, 0.03, 0.98);
          MOONS.forEach((m, i) => {
            const lam = lam0[m.name] + (days / m.P) * TAU;
            m.pivot.rotation.y = m.base + lam;
            m.mesh.position.x = m.a;
            m.mesh.visible = true;
            ctx.fade(m.ring, smooth(p, 0.0, 0.05) * 0.95);
            m.mesh.getWorldPosition(w);
            hpos[i].copy(toHud(ctx, w));
            names[i].position.set(hpos[i].x, hpos[i].y + 0.06, 0);
            ctx.fade(names[i], smooth(p, 0.02, 0.06));
            m.lam = lam;
          });
          const hj = toHud(ctx, J);
          pairs.forEach(([a, b], k) => {
            let d = MOONS[a].lam - MOONS[b].lam;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            const on = 1 - smooth(Math.abs(d), 0.04, 0.16);
            const far = hpos[a].distanceTo(hj) > hpos[b].distanceTo(hj) ? hpos[a] : hpos[b];
            H.setLine(conj[k], [hj, far]);
            ctx.fade(conj[k], on * smooth(p, 0.4, 0.46));
          });
          const laps = MOONS.map((m) => days / m.P);
          counter.userData.draw([`Io ${laps[0].toFixed(1)} laps`, `Europa ${laps[1].toFixed(1)}`, `Ganymede ${laps[2].toFixed(1)}`]);
          ctx.fade(counter, smooth(p, 0.16, 0.2));
          ctx.fade(rule, smooth(p, 0.74, 0.78));
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
    accuracy: "The site's own Jupiter. Flashes are scattered with more near the poles and in the north, as Juno found, but not from a real map; their brightness, size and rate are a picture, and the sprites are drawn as red glows just above the clouds.",
    art: { main: "jupiter", fx: "flash" },
    body: "Jupiter",
    scene(ctx) {
      /*
       * Round 84 (Prompts.md: "show it using our real body of jupiter ...
       * the sparkling more real when viewed from space"): flashes on the
       * real Jupiter's night side, most near the poles and more in the north
       * (as Juno found), and brief red sprites just above the clouds.
       */
      const jupiter = ctx.host;
      const R = worldRadius(jupiter);
      const RL = bodyRadius(jupiter);
      const J = jupiter.getWorldPosition(new THREE.Vector3());
      const sunDir = J.clone().negate().normalize();
      const fov = jupiter.userData?.focusFov ?? 30;
      /* Mostly night, a thin lit crescent, the north tipped toward us. The
       * crescent is on the right (under the card) and the night side, where
       * the flashes are, on the left (round 85: it was the other way). */
      const view = sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -2.3).normalize();
      const shot = holdShot(ctx, "Jupiter", jupiter, { yaw: yawFor(view), pitch: 0.45, distance: distanceFor(R, 0.44, fov) });
      const q = new THREE.Quaternion();
      const r = rng(31);
      /* Flash sites in Jupiter's frame: latitudes weighted to the poles,
       * two-thirds northern (Juno, Brown et al. 2018). */
      const sites = Array.from({ length: 180 }, () => {
        const north = r() < 0.66;
        const lat = (north ? 1 : -1) * (35 + Math.pow(r(), 0.6) * 45);
        const lon = (r() - 0.5) * 360;
        return { lat, lon, t0: r(), rate: 0.6 + r() * 1.4, size: 0.5 + r() * 0.8, sprite: r() < 0.12 };
      });
      const flashes = sites.map((s) => {
        const g = ctx.glow(s.sprite ? "#ff4a6a" : "#cfe8ff", RL * (s.sprite ? 0.1 : 0.075) * s.size, { opacity: 1 });
        ctx.attach(jupiter, g);
        /* Over Jupiter's haze layers: no depth test, and only the half
         * facing the camera is lit (below). */
        g.material.depthTest = false;
        g.renderOrder = 35;
        g.position.copy(dirAt(s.lat, s.lon).multiplyScalar(RL * (s.sprite ? 1.035 : 1.004)));
        ctx.fade(g, 0);
        return { ...s, g, dir: dirAt(s.lat, s.lon) };
      });
      const hud = ctx.hudLayer();
      const H = hudKit(ctx, hud);
      const title = H.label(["Jupiter's night side", "lightning deep in the water clouds"], { at: [-0.5, 0.6, 0], height: 0.046, declutter: false });
      const poles = H.label(["most flashes near the poles", "and more in the north (Juno)"], { at: [-0.5, -0.56, 0], height: 0.044, colour: "#cfe8ff", declutter: false });
      const sprites = H.label(["red sprites", "brief flashes high above the storms"], { at: [-0.5, -0.72, 0], height: 0.044, colour: "#ff8aa0", declutter: false });
      const count = H.label([""], { at: [0.0, 0.48, 0], height: 0.03, declutter: false });
      [title, poles, sprites, count].forEach((o) => ctx.fade(o, 0));
      ctx.tell([
        { at: 0, label: "Lightning", text: "The real Jupiter's night side: lightning flashing deep down in its water clouds, in giant thunderstorms." },
        { at: 0.36, label: "Near the poles", text: "The Juno spacecraft found the flashes most common near the poles — the opposite of Earth." },
        { at: 0.66, label: "Sprites", text: "High above the storms there are also brief red flashes called sprites, like the upper-air lightning over storms on Earth." },
      ]);
      let seen = 0;
      const lastOn = new Map();
      const w = new THREE.Vector3();
      return {
        duration: 24,
        update(p) {
          shot.keep();
          jupiter.getWorldQuaternion(q);
          const showSprites = smooth(p, 0.64, 0.7);
          flashes.forEach((f) => {
            /* A flash: a sharp rise and a quick fall, every 1/rate seconds,
             * only on the night side. */
            const ph = (ctx.t * f.rate + f.t0 * 7) % 2.4;
            const pulse = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
            const wdir = f.dir.clone().applyQuaternion(q);
            const night = wdir.dot(sunDir) < -0.05 && wdir.dot(ctx.camDir) > 0.08 ? 1 : 0;
            const want = f.sprite ? showSprites : smooth(p, 0.04, 0.1);
            const a = pulse * night * want;
            ctx.fade(f.g, a);
            const on = a > 0.5;
            if (on && !lastOn.get(f)) seen += 1;
            lastOn.set(f, on);
          });
          void w;
          ctx.fade(title, smooth(p, 0.02, 0.06));
          ctx.fade(poles, smooth(p, 0.36, 0.42));
          ctx.fade(sprites, showSprites);
          count.userData.draw([`${seen} flashes so far`]);
          ctx.fade(count, smooth(p, 0.1, 0.14));
        },
      };
    },

  }),
];

import * as THREE from "three";
import { INTERSTELLAR_VISITORS } from "../smallBodies/interstellarCatalogue.js";
import { smallBodyAuToScene } from "../smallBodies/smallBodies.js";

/**
 * The three interstellar visitors, as recorded space events.
 *
 * Round 5 (Prompts.md): for a while 1I/ʻOumuamua, 2I/Borisov and 3I/ATLAS
 * were drawn as bodies in the scene, looping their passes on a pink path with
 * arrows and a "today" marker. The owner's verdict: confusing, and wrong in
 * kind -- they are not here, so they are not furniture. Something that
 * happened once, on a date, belongs with the space events: each pass is now a
 * replay you choose to watch, with its dates, and the scene itself no longer
 * claims they are present.
 *
 * What is drawn, for each:
 *
 * - **The real path.** The hyperbola from the JPL SBDB elements in
 *   `interstellarCatalogue.js`, solved by the hyperbolic Kepler equation,
 *   oriented by the real node, inclination and argument of perihelion, and
 *   placed on the scene's distance scale the way every small-body orbit is
 *   (`sceneConic` in smallBodies.js): perihelion and the window's edge go
 *   through `smallBodyAuToScene`, and the path between them is the one conic
 *   with the Sun at its focus through both. Faint ahead of the visitor,
 *   brighter behind it -- the path it has actually travelled.
 * - **The visitor, on the real clock.** Time runs uniformly from entry to
 *   exit, so it crawls in from the dark, whips round the Sun and leaves --
 *   which is what a hyperbolic pass is. 1I is a bare point (it never showed
 *   gas or dust); 2I and 3I grow a coma and a tail pointing away from the Sun
 *   inside the distances at which they were seen active.
 * - **The date,** beside it, and the moments that mattered marked where the
 *   visitor was when they happened.
 *
 * What is not: the planets are where the scene has them now, not where they
 * were on those dates (the scene's planets run on authored clocks), and the
 * distances are the scene's compressed ones. Both are said on the card.
 *
 * Built in world axes: the group's matrix is set to the inverse of the Sun's
 * world matrix every frame, so the Sun's own scale and spin do not reach it.
 */

const DEG = Math.PI / 180;
const DAY_MS = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const jdToDate = (jd) => new Date((jd - 2440587.5) * DAY_MS);
const dateToJd = (y, m, d) => Date.UTC(y, m - 1, d) / DAY_MS + 2440587.5;
const formatDay = (jd) => {
  const d = jdToDate(jd);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

function hyperbolicAnomaly(M, e) {
  let H = Math.asinh(M / e);
  for (let i = 0; i < 30; i += 1) {
    const f = e * Math.sinh(H) - H - M;
    H -= f / (e * Math.cosh(H) - 1);
    if (Math.abs(f) < 1e-12) break;
  }
  return H;
}

/** A label that keeps its size on screen whatever the distance. */
function textSprite(lines, { colour = "#e8f1ff", sub = "#9fb3c8", height = 0.05 } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 30;
  sprite.center.set(0, 0.5);
  const draw = (text) => {
    const rows = Array.isArray(text) ? text : [text];
    const font = 30;
    ctx.font = `600 ${font}px ui-sans-serif, system-ui, sans-serif`;
    const width = Math.ceil(Math.max(...rows.map((r) => ctx.measureText(r).width)) + 16);
    canvas.width = width;
    canvas.height = rows.length * (font + 8) + 8;
    ctx.font = `600 ${font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "top";
    rows.forEach((row, i) => {
      ctx.fillStyle = i === 0 ? colour : sub;
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 6;
      ctx.fillText(row, 8, 6 + i * (font + 8));
    });
    texture.needsUpdate = true;
    sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  };
  draw(lines);
  sprite.userData.draw = draw;
  return sprite;
}

let glowTexture = null;
function glow() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

/*
 * The passes. `windowAU` is how far out the path is drawn and the replay
 * starts and ends: enough for what matters on each pass (Earth's distance
 * for 1I, Jupiter's for 3I). `activeAU` is where the coma is drawn from --
 * the record's own onset (4.6 AU for 2I, 4.5 for 3I); 1I never showed any.
 * Milestone dates are from the cards, which give their sources.
 */
const PASSES = [
  {
    id: "oumuamua-passage",
    name: "1I/ʻOumuamua",
    title: "ʻOumuamua passes through",
    windowAU: 2.6,
    activeAU: 0,
    colour: 0xd9b8a4,
    milestones: [
      { jd: null, label: "Closest to the Sun", sub: "0.26 AU, inside Mercury's orbit" },
      { jd: dateToJd(2017, 10, 14), label: "Closest to Earth", sub: "0.16 AU — 24 million km" },
      { jd: dateToJd(2017, 10, 19), label: "Found by Pan-STARRS1", sub: "already on its way out" },
    ],
    today: "Today it is 54.6 AU away, heading for Pegasus",
    shotZoom: 18,
    when: "Closest to the Sun 9 September 2017 · closest to Earth 14 October 2017 (0.16 AU) · found 19 October 2017",
    detail: "The first object ever seen from another star — a replay of its 2017 pass, on its real path",
    frequency: "Once: it came in from the direction of Vega and is not coming back. Its discovery implied there are always around one such object inside Earth's orbit (Do, Tucker & Tonry 2018), but almost all are too faint to find; three have been seen, in 2017, 2019 and 2025",
    cause: "It formed around another star and was thrown out of its home system. It arrived at 26 km/s relative to the Sun — far too fast to be captured — so its path is a hyperbola (e = 1.20): it falls in once, swings round the Sun and leaves for ever.",
    note: "Only ever a point of light, its brightness swinging tenfold as it tumbled. It sped up slightly on the way out with no visible gas or dust (Micheli et al. 2018). Today, 27 September 2026, it is 54.6 AU from the Sun.",
  },
  {
    id: "borisov-passage",
    name: "2I/Borisov",
    title: "2I/Borisov passes through",
    windowAU: 4.5,
    activeAU: 4.6,
    colour: 0xd4d0c8,
    milestones: [
      { jd: dateToJd(2019, 8, 30), label: "Found by Gennadiy Borisov", sub: "with a telescope he built himself" },
      { jd: null, label: "Closest to the Sun", sub: "2.01 AU, beyond Mars" },
      { jd: dateToJd(2019, 12, 28), label: "Closest to Earth", sub: "1.94 AU" },
    ],
    today: "Today it is 48.5 AU away, leaving",
    shotZoom: 26,
    when: "Found 30 August 2019 · closest to the Sun 8 December 2019 (2.01 AU) · closest to Earth 28 December 2019 (1.94 AU)",
    detail: "The first comet from another star — a replay of its 2019–2020 pass, on its real path",
    frequency: "Once. The second interstellar object found, two years after the first",
    cause: "A comet that formed around another star, crossing the Solar System at 32 km/s before the Sun's pull — too fast to be captured, so its path is open (e = 3.36). Like a comet of our own it grew a coma and tail as the Sun warmed it.",
    note: "Its gas held more carbon monoxide than water, far beyond any Solar System comet — a sample of another star's ice. Today, 27 September 2026, it is 48.5 AU from the Sun.",
  },
  {
    id: "atlas-3i-passage",
    name: "3I/ATLAS",
    title: "3I/ATLAS passes through",
    windowAU: 6.2,
    activeAU: 4.5,
    colour: 0xe0cdb8,
    milestones: [
      { jd: dateToJd(2025, 7, 1), label: "Found by ATLAS", sub: "the survey telescope in Chile" },
      { jd: dateToJd(2025, 10, 3), label: "Passed Mars", sub: "29 million km" },
      { jd: null, label: "Closest to the Sun", sub: "1.36 AU" },
      { jd: dateToJd(2026, 3, 16), label: "Passed Jupiter", sub: "0.36 AU" },
    ],
    today: "Today it is 11.7 AU away, leaving",
    shotZoom: 29,
    when: "Found 1 July 2025 · passed Mars 3 October 2025 · closest to the Sun 29 October 2025 (1.36 AU) · passed Jupiter March 2026",
    detail: "The fastest visitor ever recorded — a replay of its 2025–2026 pass, on its real path",
    frequency: "Once. The third interstellar object found, and the first seen up close by spacecraft at another planet",
    cause: "A comet from another star moving at 58 km/s before the Sun's pull — a path so open (e = 6.14) it barely bends. It came from the direction of the Galaxy's centre, retrograde and almost in the plane of the planets.",
    note: "JWST found its coma dominated by carbon dioxide; the orbiters at Mars and the Perseverance rover photographed it in October 2025. Today, 27 September 2026, it is 11.7 AU from the Sun, and passes Neptune's distance in March 2028.",
  },
];

function passBuilder(pass) {
  const record = INTERSTELLAR_VISITORS.find((r) => r.name === pass.name);
  const o = record.orbit;
  const a = Math.abs(o.aAU);
  const e = o.e;
  const n = o.meanMotionDegPerDay * DEG;
  const tpJd = o.epochJD - o.meanAnomalyDeg / o.meanMotionDegPerDay;
  const node = o.nodeDeg * DEG;
  const inc = o.iDeg * DEG;
  const argPeri = o.argPeriDeg * DEG;
  const Hwin = Math.acosh((pass.windowAU / a + 1) / e);
  const Mwin = e * Math.sinh(Hwin) - Hwin;
  const halfSpanDays = Mwin / n;
  const nuWin = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(Hwin / 2));
  /* The drawn conic: through the drawn perihelion and the drawn window edge
   * at its real true anomaly (smallBodies.js, `sceneConic`). */
  const qScene = smallBodyAuToScene(a * (e - 1));
  const endScene = smallBodyAuToScene(pass.windowAU);
  const sceneE = (endScene - qScene) / (qScene - endScene * Math.cos(nuWin));
  const sceneP = qScene * (1 + sceneE);

  const place = (days, out) => {
    const H = hyperbolicAnomaly(n * days, e);
    const nu = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
    const r = sceneP / (1 + sceneE * Math.cos(nu));
    const u = argPeri + nu;
    const x = r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc));
    const y = r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc));
    const z = r * Math.sin(u) * Math.sin(inc);
    out.set(x, z, y);
    return a * (e * Math.cosh(H) - 1);
  };

  return function build(target) {
    const group = new THREE.Group();
    group.name = `${pass.name} passage`;
    group.matrixAutoUpdate = false;
    const holdWorld = () => {
      target.updateWorldMatrix(true, false);
      group.matrix.copy(target.matrixWorld).invert();
      group.matrixWorldNeedsUpdate = true;
    };
    holdWorld();

    // The path: faint whole, bright where it has been.
    const SAMPLES = 600;
    const points = [];
    const p = new THREE.Vector3();
    for (let i = 0; i <= SAMPLES; i += 1) {
      place(-halfSpanDays + (2 * halfSpanDays * i) / SAMPLES, p);
      points.push(p.x, p.y, p.z);
    }
    const pathGeometry = new THREE.BufferGeometry();
    pathGeometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const ahead = new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 0xbcd2ec, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const travelled = new THREE.Line(pathGeometry.clone(), new THREE.LineBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    [ahead, travelled].forEach((line) => { line.frustumCulled = false; line.renderOrder = 25; group.add(line); });

    // The visitor.
    const visitor = new THREE.Group();
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: pass.colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, toneMapped: false }));
    core.scale.setScalar(0.022);
    core.renderOrder = 28;
    visitor.add(core);
    const coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xcfe0d8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, toneMapped: false }));
    coma.scale.setScalar(0.06);
    coma.renderOrder = 27;
    visitor.add(coma);
    const tailGeometry = new THREE.BufferGeometry();
    tailGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    tailGeometry.setAttribute("color", new THREE.Float32BufferAttribute([0.85, 0.9, 1, 0, 0, 0], 3));
    const tail = new THREE.Line(tailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    tail.frustumCulled = false;
    tail.renderOrder = 26;
    group.add(tail);
    group.add(visitor);

    const dateLabel = textSprite([pass.name, ""], { height: 0.034 });
    group.add(dateLabel);

    // Milestones: a ring where it happened and a label, shown when reached.
    const milestones = pass.milestones.map((m, index) => {
      const jd = m.jd ?? tpJd;
      const days = jd - tpJd;
      const at = new THREE.Vector3();
      place(days, at);
      const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, toneMapped: false }));
      mark.scale.setScalar(0.014);
      mark.position.copy(at);
      mark.renderOrder = 28;
      const label = textSprite([m.label, `${formatDay(jd)} · ${m.sub}`], { height: 0.028, colour: "#fff3d6" });
      label.position.copy(at);
      /* Alternately above and below the point: 1I was found five days after
       * its closest approach to Earth, and the two labels sat on top of
       * each other. */
      label.center.set(-0.05, index % 2 ? 1.25 : -0.25);
      label.material.opacity = 0;
      group.add(mark, label);
      return { days, mark, label };
    });

    const farewell = textSprite(["Gone — it will not come back", pass.today], { height: 0.032, colour: "#ffe2c4" });
    farewell.material.opacity = 0;
    group.add(farewell);

    const sun = new THREE.Vector3();
    const toSun = new THREE.Vector3();
    let lastDay = null;

    return {
      group,
      duration: 26,
      update(progress) {
        holdWorld();
        /* A second to draw the path, the pass itself, a few seconds of
         * farewell. Time is uniform inside the pass: the real pace. */
        const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.06);
        ahead.material.opacity = 0.22 * fadeIn;
        const s = THREE.MathUtils.clamp((progress - 0.04) / 0.82, 0, 1);
        const days = -halfSpanDays + 2 * halfSpanDays * s;
        const rAU = place(days, visitor.position);
        travelled.geometry.setDrawRange(0, Math.max(2, Math.round(s * SAMPLES) + 1));
        travelled.material.opacity = 0.7 * fadeIn;
        const out = THREE.MathUtils.smoothstep(progress, 0.86, 0.97);
        core.material.opacity = fadeIn * (1 - out * 0.6);

        // Coma and tail, only while active, away from the Sun.
        const active = pass.activeAU > 0 ? THREE.MathUtils.clamp((pass.activeAU - rAU) / (pass.activeAU * 0.5), 0, 1) : 0;
        coma.material.opacity = 0.55 * active * fadeIn;
        toSun.copy(sun).sub(visitor.position).normalize();
        const tailLength = visitor.position.length() * 0.18 * active;
        const tp = tail.geometry.attributes.position;
        tp.setXYZ(0, visitor.position.x, visitor.position.y, visitor.position.z);
        tp.setXYZ(1, visitor.position.x - toSun.x * tailLength, visitor.position.y - toSun.y * tailLength, visitor.position.z - toSun.z * tailLength);
        tp.needsUpdate = true;
        tail.material.opacity = 0.8 * active * fadeIn;

        // The date beside it.
        const jd = tpJd + days;
        const day = formatDay(jd);
        if (day !== lastDay) {
          lastDay = day;
          dateLabel.userData.draw([pass.name, `${day} · ${rAU.toFixed(2)} AU from the Sun`]);
        }
        dateLabel.position.copy(visitor.position);
        dateLabel.material.opacity = fadeIn * (1 - out);

        milestones.forEach((m) => {
          const shown = THREE.MathUtils.smoothstep(days - m.days, 0, halfSpanDays * 0.06);
          m.mark.material.opacity = shown * 0.9;
          m.label.material.opacity = shown * (1 - out * 0.5);
        });

        farewell.position.copy(visitor.position);
        farewell.material.opacity = out;
      },
      dispose() {
        group.traverse((object) => {
          object.geometry?.dispose?.();
          if (object.material) {
            object.material.map && object.material.map !== glowTexture && object.material.map.dispose();
            object.material.dispose();
          }
        });
      },
    };
  };
}

/* The event definitions, in solarSystemEvents.js's format. */
export const INTERSTELLAR_EVENTS = PASSES.map((pass) => ({
  id: pass.id,
  body: "Sun",
  place: "Inner Solar System",
  title: pass.title,
  kind: "recorded",
  family: "smallBody",
  when: pass.when,
  detail: pass.detail,
  frequency: pass.frequency,
  cause: pass.cause,
  note: pass.note,
  accuracy: "The path is the real one, from JPL's orbital elements, drawn on the scene's compressed distance scale and replayed at its real pace. The planets are where the scene has them now, not where they were on those dates.",
  /* Back from the Sun and above the planets' plane, so the whole pass is in
   * frame: zoom in multiples of the Sun's own framing (see
   * SUNGRAZER_SHOT_ZOOM in solarSystemEvents.js). */
  shotZoom: pass.shotZoom,
  shotPitch: 1.0,
  build: passBuilder(pass),
}));

import * as THREE from "three";
import { textSprite, glow, declutterLabels } from "./events/interstellarPassages.js";

/**
 * Galactocentric View (round 45, Prompts.md "Major breaking feature": the
 * Sun, the planets and everything else are not standing still -- they
 * travel round the Milky Way. The owner chose the name, all three scales
 * and a toggle in the top bar).
 *
 * The rest of the site is heliocentric: the Sun is the fixed point. This
 * view changes the frame of reference, in three steps:
 *
 *   1  The Solar System in motion -- in the scene itself. The Sun flies
 *      forward and the planets, still circling it, trace corkscrews.
 *   2  Round the Milky Way -- a separate scene: the galaxy's disc, its
 *      centre, and the Sun's 26,000-light-year orbit, one lap per
 *      galactic year, bobbing through the disc.
 *   (3, the Local Group, was removed in round 47 at the owner's request.)
 *
 * ## The numbers (each with its source)
 *
 *   Sun's speed round the Galaxy  about 230 km/s, ~830,000 km/h (NASA);
 *                                 measurements run 230-250 km/s
 *   distance from the centre      8.2 kpc, ~26,700 light-years (GRAVITY
 *                                 Collaboration 2019: 8.178 kpc)
 *   galactic year                 about 230 million years (225-250)
 *   Earth's speed round the Sun   29.8 km/s -- the Sun moves ~7.7 times
 *                                 faster through the Galaxy
 *   tilt                          the planets' plane is tipped ~60 degrees
 *                                 to the galactic plane; the Sun heads for
 *                                 Cygnus (galactic longitude 90 degrees),
 *                                 which is ecliptic longitude 347.3,
 *                                 latitude +59.6 (computed from the
 *                                 standard galactic-to-equatorial rotation,
 *                                 obliquity 23.44)
 *   vertical motion               an oscillation of ~66 Myr and ~80 pc
 *                                 amplitude; the Sun is ~20 pc above the
 *                                 plane now, moving up (Frisch 1998,
 *                                 arXiv:astro-ph/9804008; Bennett & Bovy
 *                                 2019 for the height)
 *   Andromeda                     2.5 million light-years (765 kpc),
 *                                 closing at ~110 km/s; about a 50% chance
 *                                 of merging within 10 billion years
 *                                 (Sawala et al. 2025, Nature Astronomy)
 *   Local Group vs the CMB        ~620 km/s towards galactic l 276,
 *                                 b 30 -- Hydra-Centaurus (the CMB dipole)
 *
 * ## What is not to scale (and is said so on screen)
 *
 *   step 1  the forward speed is shown about 20 times slower than real,
 *           so a whole turn of each corkscrew fits on screen (really each
 *           of Earth's turns is stretched over ~48 Earth-orbit radii)
 *   step 2  the up-and-down motion is drawn 10 times taller
 *   step 3  the galaxies are drawn 4 times larger than their separation
 *
 * ## Cost
 *
 * Off: nothing. Step 1: nine trail lines updated each frame. Steps 2 and 3:
 * their own small scene, drawn instead of the Solar System (which is not
 * drawn meanwhile).
 */

const DEG = Math.PI / 180;

/* The Sun's direction of travel in the scene's ecliptic axes (scene x =
 * ecliptic x, scene y = ecliptic north, scene z = ecliptic y -- the mapping
 * interstellarPassages.js uses). */
const APEX_LON = 347.3 * DEG;
const APEX_LAT = 59.6 * DEG;
export const GALACTIC_DIRECTION = new THREE.Vector3(
  Math.cos(APEX_LAT) * Math.cos(APEX_LON),
  Math.sin(APEX_LAT),
  Math.cos(APEX_LAT) * Math.sin(APEX_LON),
).normalize();

/* Sun 230 km/s / Earth 29.8 km/s = 7.7, shown ~20x slower (0.4): at the
 * real ratio each of Earth's turns is stretched over ~48 orbit radii and a
 * whole turn never fits on screen (measured round 45: the trails left the
 * frame within a quarter of a turn). */
const SPEED_RATIO_REAL = 230 / 29.8;
const SPEED_SHOWN = 0.4;

const PLANET_COLOURS = {
  Mercury: 0xc9bfb3, Venus: 0xf2dfb0, Earth: 0x7fb6ff, Mars: 0xff8a5c,
  Jupiter: 0xf0c890, Saturn: 0xf3e0a8, Uranus: 0x9feaf2, Neptune: 0x7f9cff,
};


/* ------------------------------------------------------------------ paint */

/** A face-on spiral galaxy painted into a canvas: bulge, bar, arms, dust. */
function paintGalaxy({ size = 1024, arms = 4, bar = 0.22, hue = "milky", seed = 7 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  // Diffuse disc.
  const disc = ctx.createRadialGradient(c, c, 0, c, c, c);
  disc.addColorStop(0, "rgba(255,230,190,0.55)");
  disc.addColorStop(0.25, "rgba(200,190,200,0.18)");
  disc.addColorStop(0.7, "rgba(120,140,200,0.06)");
  disc.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = disc;
  ctx.fillRect(0, 0, size, size);
  // Arms: logarithmic spirals, pitch ~12 degrees, blotted with star clouds.
  const pitch = Math.tan(12 * DEG);
  for (let a = 0; a < arms; a += 1) {
    const phase = (a / arms) * Math.PI * 2;
    for (let k = 0; k < 2600; k += 1) {
      const t = rnd() * 3.2;
      const r = c * 0.16 * Math.exp(pitch * t * 2.1);
      if (r > c * 0.97) continue;
      const th = phase + t * 2.1 + (rnd() - 0.5) * 0.35;
      const x = c + r * Math.cos(th);
      const y = c + r * Math.sin(th);
      const blob = 2 + rnd() * 9 * (r / c);
      const blue = hue === "milky" ? `rgba(${170 + rnd() * 60},${190 + rnd() * 50},255,` : `rgba(${200 + rnd() * 40},${200 + rnd() * 40},255,`;
      const g = ctx.createRadialGradient(x, y, 0, x, y, blob);
      g.addColorStop(0, `${blue}${0.16 + rnd() * 0.14})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, blob, 0, Math.PI * 2);
      ctx.fill();
      if (rnd() < 0.05) {
        ctx.fillStyle = `rgba(255,${120 + rnd() * 60},${170 + rnd() * 50},0.55)`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
  }
  // Bar and bulge.
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(0.45);
  ctx.scale(1, 0.38);
  const barG = ctx.createRadialGradient(0, 0, 0, 0, 0, c * bar);
  barG.addColorStop(0, "rgba(255,225,170,0.9)");
  barG.addColorStop(1, "rgba(255,200,140,0)");
  ctx.fillStyle = barG;
  ctx.beginPath();
  ctx.arc(0, 0, c * bar, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const bulge = ctx.createRadialGradient(c, c, 0, c, c, c * 0.12);
  bulge.addColorStop(0, "rgba(255,245,220,1)");
  bulge.addColorStop(1, "rgba(255,210,150,0)");
  ctx.fillStyle = bulge;
  ctx.fillRect(0, 0, size, size);
  // Dust lanes along the inner edge of the arms.
  ctx.globalCompositeOperation = "source-over";
  for (let a = 0; a < arms; a += 1) {
    const phase = (a / arms) * Math.PI * 2 - 0.18;
    for (let k = 0; k < 500; k += 1) {
      const t = rnd() * 3;
      const r = c * 0.18 * Math.exp(pitch * t * 2.1);
      if (r > c * 0.85) continue;
      const th = phase + t * 2.1;
      ctx.fillStyle = `rgba(10,6,4,${0.08 + rnd() * 0.1})`;
      ctx.beginPath();
      ctx.arc(c + r * Math.cos(th), c + r * Math.sin(th), 1 + rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function galaxyDisc(texture, radius) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function spriteGlow(colour, size, attenuate = true) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: colour, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: attenuate, toneMapped: false, fog: false }));
  sprite.scale.setScalar(size);
  return sprite;
}

/* `height` is per line, so one- and two-line labels read at one size. */
function labelSprite(lines, colour = "#fff1dc", height = 0.024) {
  const sprite = textSprite(lines, { colour, height: height * lines.length });
  sprite.center.set(-0.04, 0.5);
  return sprite;
}

/* ------------------------------------------------------- step 2: galaxy */

const R_SUN = 8.2; // kpc
const GALACTIC_YEAR_SECONDS = 30; // one lap on screen
const GALACTIC_YEAR_MYR = 230;

function buildGalaxyScene(texture) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010207);
  const disc = galaxyDisc(texture, 16);
  scene.add(disc);

  // Stars that turn with a flat rotation curve: angular speed ~ 1/r.
  const COUNT = 22000;
  const base = new Float32Array(COUNT * 3); // r, theta0, y
  const colour = new Float32Array(COUNT * 3);
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pitch = Math.tan(12 * DEG);
  for (let i = 0; i < COUNT; i += 1) {
    let r;
    let th;
    if (rnd() < 0.18) {
      r = Math.abs((rnd() + rnd() + rnd() - 1.5) * 2.4) + 0.05;
      th = rnd() * Math.PI * 2;
    } else {
      const arm = Math.floor(rnd() * 4);
      const t = rnd() * 3.2;
      r = 16 * 0.16 * Math.exp(pitch * t * 2.1) * (1 + (rnd() - 0.5) * 0.25);
      th = (arm / 4) * Math.PI * 2 + t * 2.1 + (rnd() - 0.5) * 0.5;
    }
    const y = (rnd() + rnd() - 1) * 0.3 * Math.exp(-r / 9);
    base.set([r, th, y], i * 3);
    const warm = r < 3 ? 1 : 0.25;
    colour.set([0.75 + 0.25 * warm, 0.8 + 0.1 * warm, 1 - 0.25 * warm], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute("aBase", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colour, 3));
  const stars = new THREE.Points(geometry, new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aBase;
      attribute vec3 aColor;
      uniform float uAngle;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        float th = aBase.y - uAngle * (8.2 / max(aBase.x, 0.6));
        vec3 p = vec3(aBase.x * cos(th), aBase.z, aBase.x * sin(th));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 1.6 * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, length(c)) * 0.75);
      }
    `,
    uniforms: { uAngle: { value: 0 }, uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stars.frustumCulled = false;
  scene.add(stars);

  // The centre.
  const centre = spriteGlow(0xffe2b0, 2.4);
  scene.add(centre);
  const centreLabel = labelSprite(["Galactic Centre · Sagittarius A*", "a black hole of 4 million Suns"], "#ffe2b0");
  centreLabel.position.set(0.6, 0.6, 0);
  scene.add(centreLabel);

  // The Sun's orbit and the Sun.
  const orbitPoints = [];
  for (let i = 0; i <= 256; i += 1) {
    const a = (i / 256) * Math.PI * 2;
    orbitPoints.push(new THREE.Vector3(R_SUN * Math.cos(a), 0, R_SUN * Math.sin(a)));
  }
  const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), new THREE.LineDashedMaterial({ color: 0xffd27a, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  orbit.computeLineDistances();
  scene.add(orbit);
  const sun = spriteGlow(0xfff0b0, 0.9);
  scene.add(sun);
  const sunCore = spriteGlow(0xffffff, 0.014, false);
  scene.add(sunCore);
  const sunLabel = labelSprite(["The Sun · about 230 km/s", ""], "#fff3c4");
  scene.add(sunLabel);
  const orbitLabel = labelSprite(["The Sun's orbit · 26,000 light-years from the centre"], "#ffe0a8");
  orbitLabel.position.set(R_SUN * 0.78, 0, R_SUN * 0.78);
  scene.add(orbitLabel);
  // The path it has just taken, rising and falling.
  const TRAIL = 400;
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  trail.frustumCulled = false;
  scene.add(trail);

  const sunAt = (myr) => {
    /* Clockwise seen from the north galactic pole (+y): the angle falls. */
    const angle = Math.PI * 0.5 - (myr / GALACTIC_YEAR_MYR) * Math.PI * 2;
    /* Vertical: 80 pc amplitude, 66 Myr period, now 20 pc up and rising;
     * drawn 10x taller (0.08 kpc x 10). */
    const phase0 = Math.asin(20 / 80);
    const y = 0.8 * Math.sin(phase0 + (myr / 66) * Math.PI * 2);
    return new THREE.Vector3(R_SUN * Math.cos(angle), y, R_SUN * Math.sin(angle));
  };

  return {
    scene,
    update(seconds) {
      const myr = (seconds / GALACTIC_YEAR_SECONDS) * GALACTIC_YEAR_MYR;
      stars.material.uniforms.uAngle.value = (myr / GALACTIC_YEAR_MYR) * Math.PI * 2;
      const at = sunAt(myr);
      sun.position.copy(at);
      sunCore.position.copy(at);
      sunLabel.position.copy(at);
      const laps = myr / GALACTIC_YEAR_MYR;
      const text = `+${Math.round(myr)} million years · ${laps.toFixed(2)} galactic years`;
      if (sunLabel.userData.text !== text) { sunLabel.userData.text = text; sunLabel.userData.draw(["The Sun · about 230 km/s", text]); }
      const positions = trail.geometry.attributes.position;
      for (let i = 0; i < TRAIL; i += 1) {
        const p = sunAt(myr - (i / TRAIL) * 80);
        positions.setXYZ(i, p.x, p.y, p.z);
      }
      positions.needsUpdate = true;
    },
    focus: () => sun.position,
    labels: [sunLabel, centreLabel, orbitLabel],
  };
}

/* Round 47 (Prompts.md: "remove the Galaxy moves towards Andromeda
 * section"): the third step, the Local Group, is gone. */

/* ------------------------------------------------------------ the view */

/*
 * Round 46 (Prompts.md):
 *   - "nothing can be clicked in space" while the view is on: a full-screen
 *     layer takes every pointer in all three steps (step 1 hands drags and
 *     the wheel to the Solar System's camera, so it can still be turned and
 *     zoomed), and the other top-bar controls are disabled (CSS).
 *   - "the modal size should be decreased": a compact panel, the detail
 *     folded away behind "More".
 *   - "adding tails does not make things move ... show the whole thing is
 *     really moving": step 1 now streams the stars past (two layers, the
 *     nearer faster), runs a live distance counter at the real speed, and
 *     keeps the corkscrew trails.
 */
const SCALE_COPY = [
  {
    key: 1,
    tab: "1 · The Sun is moving",
    title: "The Sun is moving",
    text: "The Sun travels round our galaxy at about 230 km/s and takes every planet with it. Here it moves upwards: the stars slide past, and each planet follows it in a spiral.",
    more: "The spirals' forward speed is shown about 20× slower so whole turns fit on screen. The planets' plane is tipped about 60° to the direction of travel, which points towards the constellation Cygnus.",
  },
  {
    key: 2,
    tab: "2 · Round the galaxy",
    title: "One lap takes 230 million years",
    text: "That lap is a galactic year. Earth is about 20 laps old; one lap ago, the first dinosaurs were appearing.",
    more: "The Sun is about 26,000 light-years from the centre. It also bobs up and down through the disc, crossing it every 30 to 35 million years (drawn 10× taller); it is about 65 light-years above it now, rising. Drag to turn, scroll to zoom.",
  },
];

const KMS_SUN = 230;

export function createGalactocentricView({
  getPlanets, getSun, getCamera = () => null, getSky = () => null,
  onScaleChange = () => {}, onExit = () => {},
  onRotate = () => {}, onZoom = () => {},
}) {
  let active = false;
  let scale = 1;
  let seconds = 0;
  let realStart = 0;
  let galaxy = null;
  let textures = null;

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.01, 400);
  const orbitState = { yaw: 0.6, pitch: 0.75, distance: 24, target: new THREE.Vector3() };
  const placeCamera = () => {
    const { yaw, pitch, distance, target } = orbitState;
    camera.position.set(
      target.x + distance * Math.cos(pitch) * Math.sin(yaw),
      target.y + distance * Math.sin(pitch),
      target.z + distance * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
  };

  /* ---------------------------------------------- step 1, in the scene */

  const trailRoot = new THREE.Group();
  trailRoot.name = "Galactocentric trails";
  trailRoot.visible = false;
  const TRAIL_POINTS = 1400;
  const CAPTURE_SECONDS = 1 / 45;
  let trails = [];
  let lastEarth = null;
  let earthSpeed = 0;
  let captureClock = 0;
  const tmp = new THREE.Vector3();
  const labels = {};

  /*
   * Round 47 (Prompts.md: "it looks like rain falling instead of the Sun
   * moving ... just show the Sun is also moving ... move the space
   * background in a repeated loop, background going down and the Sun going
   * up"). Two things replace the streaks:
   *   - the Sun's tail: a chain of glows flowing back from the Sun along
   *     its path, so the Sun reads as the thing moving;
   *   - the background: the scene's own sky is set aside while this step
   *     runs and a star sphere centred on the camera turns about the
   *     camera's right-hand axis, so the whole sky slides downwards in an
   *     endless loop.
   */
  const TAIL = 46;
  const TAIL_SPACING = 34;
  const tail = Array.from({ length: TAIL }, (_, i) => {
    const sprite = spriteGlow(0xffd9a0, 1);
    sprite.raycast = () => {};
    sprite.renderOrder = 28;
    trailRoot.add(sprite);
    return { sprite, i };
  });
  let tailPhase = 0;

  const SKY_STARS = 5200;
  const skyPositions = new Float32Array(SKY_STARS * 3);
  const skyColours = new Float32Array(SKY_STARS * 3);
  {
    let r = 97;
    const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let i = 0; i < SKY_STARS; i += 1) {
      const u = rnd() * 2 - 1;
      const t = rnd() * Math.PI * 2;
      const q = Math.sqrt(1 - u * u);
      skyPositions.set([q * Math.cos(t), u, q * Math.sin(t)], i * 3);
      const b = 0.25 + 0.75 * rnd() ** 3;
      const warm = rnd();
      skyColours.set([b * (0.85 + 0.15 * warm), b * 0.92, b * (1 - 0.15 * warm)], i * 3);
    }
  }
  const skyGeometry = new THREE.BufferGeometry();
  skyGeometry.setAttribute("position", new THREE.BufferAttribute(skyPositions, 3));
  skyGeometry.setAttribute("color", new THREE.BufferAttribute(skyColours, 3));
  const skySphere = new THREE.Points(skyGeometry, new THREE.PointsMaterial({
    size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, fog: false,
  }));
  skySphere.frustumCulled = false;
  skySphere.renderOrder = -20;
  skySphere.raycast = () => {};
  trailRoot.add(skySphere);
  const right = new THREE.Vector3();
  const skyTurn = new THREE.Quaternion();
  const SKY_RATE = 0.045; // radians a second: one full loop every ~2.3 minutes
  let skyHidden = null;

  function updateMotion(dt) {
    const cam = getCamera?.();
    const sunBody = getSun?.();
    if (cam) {
      // The sky slides down: turn the sphere about the camera's right axis.
      cam.updateMatrixWorld();
      right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      skyTurn.setFromAxisAngle(right, -SKY_RATE * dt);
      skySphere.quaternion.premultiply(skyTurn);
      skySphere.position.copy(cam.position);
      skySphere.scale.setScalar(Math.max(1000, (cam.far ?? 20000) * 0.5));
    }
    if (sunBody) {
      sunBody.getWorldPosition(tmp);
      tailPhase = (tailPhase + dt * 120) % TAIL_SPACING;
      tail.forEach(({ sprite, i }) => {
        const d = 40 + i * TAIL_SPACING + tailPhase;
        sprite.position.copy(tmp).addScaledVector(GALACTIC_DIRECTION, -d);
        const k = 1 - d / (40 + TAIL * TAIL_SPACING);
        sprite.scale.setScalar(30 + 150 * k);
        sprite.material.opacity = 0.5 * k * k;
      });
    }
  }

  function setSkyAside(aside) {
    const sky = getSky?.();
    if (!sky) return;
    if (aside && skyHidden === null) { skyHidden = sky.visible; sky.visible = false; }
    if (!aside && skyHidden !== null) { sky.visible = skyHidden; skyHidden = null; }
  }

  function buildTrails() {
    trails.forEach((t) => { t.line.geometry.dispose(); t.line.material.dispose(); trailRoot.remove(t.line); });
    Object.values(labels).forEach((l) => trailRoot.remove(l));
    trails = [];
    const bodies = [{ name: "Sun", object: getSun?.(), colour: 0xfff0b0 }]
      .concat((getPlanets?.() ?? []).filter((p) => PLANET_COLOURS[p.userData?.name ?? p.name]).map((p) => ({ name: p.userData?.name ?? p.name, object: p, colour: PLANET_COLOURS[p.userData?.name ?? p.name] })));
    bodies.forEach((b) => {
      if (!b.object) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, 0);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
      line.frustumCulled = false;
      line.raycast = () => {};
      line.renderOrder = 30;
      trailRoot.add(line);
      trails.push({ ...b, line, history: [], tint: new THREE.Color(b.colour) });
    });
    labels.sun = labelSprite(["The Sun · 230 km/s round the Milky Way"], "#fff3c4");
    labels.earth = labelSprite(["Earth · 30 km/s round the Sun"], "#cfe2ff");
    labels.dir = labelSprite(["Heading this way · towards Cygnus"], "#ffe0a8");
    Object.values(labels).forEach((l) => { l.raycast = () => {}; trailRoot.add(l); });
    lastEarth = null;
    earthSpeed = 0;
  }

  function updateTrails(dt) {
    if (!trails.length || dt <= 0) return;
    const earth = trails.find((t) => t.name === "Earth");
    if (earth?.object) {
      earth.object.getWorldPosition(tmp);
      if (lastEarth) {
        const v = tmp.distanceTo(lastEarth) / dt;
        if (Number.isFinite(v) && v < 1e5) earthSpeed += (v - earthSpeed) * Math.min(1, dt * 2);
      }
      lastEarth = (lastEarth ?? new THREE.Vector3()).copy(tmp);
    }
    const drift = GALACTIC_DIRECTION.clone().multiplyScalar(-earthSpeed * SPEED_SHOWN * dt);
    captureClock += dt;
    const capture = captureClock >= CAPTURE_SECONDS;
    if (capture) captureClock = 0;
    trails.forEach((t) => {
      t.history.forEach((p) => p.add(drift));
      if (capture) {
        t.object.getWorldPosition(tmp);
        t.history.unshift(tmp.clone());
        if (t.history.length > TRAIL_POINTS) t.history.pop();
      }
      const positions = t.line.geometry.attributes.position;
      const colours = t.line.geometry.attributes.color;
      const n = t.history.length;
      t.object.getWorldPosition(tmp);
      for (let i = 0; i < n; i += 1) {
        const p = i === 0 ? tmp : t.history[i];
        positions.setXYZ(i, p.x, p.y, p.z);
        const fade = (1 - i / TRAIL_POINTS) ** 1.3 * (t.name === "Sun" ? 0.7 : 1);
        colours.setXYZ(i, t.tint.r * fade, t.tint.g * fade, t.tint.b * fade);
      }
      positions.needsUpdate = true;
      colours.needsUpdate = true;
      t.line.geometry.setDrawRange(0, n);
    });
    const sun = trails.find((t) => t.name === "Sun");
    if (sun?.object) {
      sun.object.getWorldPosition(tmp);
      labels.sun.position.copy(tmp);
      labels.dir.position.copy(tmp).addScaledVector(GALACTIC_DIRECTION, 420);
    }
    if (earth?.object) labels.earth.position.copy(earth.object.getWorldPosition(tmp));
    declutterLabels([labels.sun, labels.earth, labels.dir], getCamera());
  }

  /* ----------------------------------------------------------- chrome */

  const chrome = document.createElement("aside");
  chrome.className = "galacto-chrome";
  chrome.hidden = true;
  chrome.setAttribute("aria-label", "Galactocentric view");
  chrome.innerHTML = `
    <div class="galacto-chrome__head">
      <span class="galacto-chrome__eyebrow">Galactocentric view</span>
      <button class="galacto-chrome__close" type="button" aria-label="Back to the Solar System">×</button>
    </div>
    <div class="galacto-chrome__tabs" role="tablist">
      ${SCALE_COPY.map((s) => `<button class="galacto-chrome__tab" type="button" role="tab" data-scale="${s.key}">${s.tab}</button>`).join("")}
    </div>
    <h3 class="galacto-chrome__title"></h3>
    <p class="galacto-chrome__text"></p>
    <p class="galacto-chrome__odo" aria-live="off"></p>
    <details class="galacto-chrome__more"><summary>More</summary><p></p></details>
  `;
  document.body.append(chrome);
  const odo = chrome.querySelector(".galacto-chrome__odo");
  const stage = document.createElement("div");
  stage.className = "galacto-stage";
  stage.hidden = true;
  document.body.append(stage);

  chrome.addEventListener("click", (e) => {
    e.stopPropagation();
    const tab = e.target.closest("[data-scale]");
    if (tab) setScale(Number(tab.dataset.scale));
    if (e.target.closest(".galacto-chrome__close")) exit();
  });
  ["pointerdown", "pointermove", "pointerup", "wheel"].forEach((type) => {
    chrome.addEventListener(type, (e) => e.stopPropagation(), { passive: type === "wheel" });
  });
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); drag = { x: e.clientX, y: e.clientY }; stage.setPointerCapture?.(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    e.stopPropagation();
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    if (scale === 1) { onRotate(dx, dy); return; }
    orbitState.yaw -= dx * 0.005;
    orbitState.pitch = THREE.MathUtils.clamp(orbitState.pitch + dy * 0.004, -1.35, 1.45);
  });
  ["pointerup", "pointercancel"].forEach((type) => stage.addEventListener(type, (e) => { e.stopPropagation(); drag = null; }));
  ["click", "dblclick", "contextmenu"].forEach((type) => stage.addEventListener(type, (e) => { e.stopPropagation(); e.preventDefault(); }));
  stage.addEventListener("wheel", (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (scale === 1) { onZoom(e.deltaY); return; }
    const [lo, hi] = [3, 60];
    orbitState.distance = THREE.MathUtils.clamp(orbitState.distance * Math.exp(e.deltaY * 0.0012), lo, hi);
  }, { passive: false });
  addEventListener("keydown", (e) => {
    if (!active || e.key !== "Escape") return;
    e.stopImmediatePropagation();
    exit();
  }, { capture: true });

  function renderChrome() {
    const info = SCALE_COPY[scale - 1];
    chrome.querySelector(".galacto-chrome__title").textContent = info.title;
    chrome.querySelector(".galacto-chrome__text").textContent = info.text;
    chrome.querySelector(".galacto-chrome__more p").textContent = info.more;
    chrome.querySelectorAll("[data-scale]").forEach((b) => b.setAttribute("aria-selected", String(Number(b.dataset.scale) === scale)));
  }

  let odoShown = "";
  function updateOdometer() {
    const elapsed = (performance.now() - realStart) / 1000;
    const km = elapsed * KMS_SUN;
    const text = `Since you switched this on, the Sun and everything with it has travelled ${Math.round(km).toLocaleString("en-US")} km round the Milky Way.`;
    if (text !== odoShown) { odoShown = text; odo.textContent = text; }
  }

  function ensureScenes() {
    if (textures) return;
    textures = { milky: paintGalaxy({ seed: 7 }) };
    galaxy = buildGalaxyScene(textures.milky);
  }

  function setScale(next) {
    scale = THREE.MathUtils.clamp(next, 1, 2);
    stage.hidden = !active;
    trailRoot.visible = active && scale === 1;
    setSkyAside(active && scale === 1);
    document.body.classList.toggle("is-galacto-far", active && scale !== 1);
    if (scale === 2) Object.assign(orbitState, { yaw: 0.9, pitch: 0.62, distance: 26, target: new THREE.Vector3() });
    if (scale !== 1) ensureScenes();
    seconds = 0;
    renderChrome();
    onScaleChange(scale);
  }

  function enter() {
    if (active) return;
    active = true;
    realStart = performance.now();
    chrome.hidden = false;
    document.body.classList.add("is-galactocentric");
    buildTrails();
    setScale(1);
  }

  function exit() {
    if (!active) return;
    active = false;
    chrome.hidden = true;
    stage.hidden = true;
    document.body.classList.remove("is-galactocentric", "is-galacto-far");
    trails.forEach((t) => { t.history.length = 0; t.line.geometry.setDrawRange(0, 0); });
    trailRoot.visible = false;
    setSkyAside(false);
    onExit();
  }

  return {
    trailRoot,
    get active() { return active; },
    get scale() { return scale; },
    /* Step 1 runs the Solar System quickly so the corkscrews form. */
    get motionBoost() { return active && scale === 1 ? 10 : 0; },
    enter,
    exit,
    toggle() { if (active) exit(); else enter(); return active; },
    setScale,
    update(dt) {
      if (!active) return;
      seconds += dt;
      updateOdometer();
      if (scale === 1) {
        updateMotion(dt);
        updateTrails(dt);
      } else {
        galaxy?.update(seconds);
      }
    },
    /** Draws step 2; returns false for step 1 (the scene draws). */
    render(renderer) {
      if (!active || scale === 1) return false;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      placeCamera();
      const shown = galaxy;
      shown.scene.updateMatrixWorld();
      declutterLabels(shown.labels, camera);
      renderer.render(shown.scene, camera);
      return true;
    },
  };
}

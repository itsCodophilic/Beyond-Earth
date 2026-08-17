import * as THREE from "three";

/**
 * The opening journey: the Big Bang, the multiverse, our universe, the
 * galaxies, the Milky Way, and finally the arm we live in.
 *
 * A self-contained scene with its own camera, rendered by the shared renderer
 * in place of the solar system while it plays. Nothing here touches the main
 * scene, and dispose() releases every buffer, texture and DOM node it created,
 * so the steady-state cost once the intro is over is exactly zero.
 *
 * The camera never moves. The universe moves past it. That is not laziness --
 * it keeps every position in one frame of reference, so a phase can be
 * retimed, reordered or cut without a camera path needing to be re-solved.
 *
 * Acts:
 *   detonation  the burst -- core, rays, shockwaves, rock thrown outward
 *   multiverse  bubble universes drifting in the false vacuum
 *   approach    one bubble swells until the camera passes inside it: ours
 *   galaxies    the fall through resolved galaxies and star dust
 *   milkyWay    one barred spiral resolves ahead and is approached
 *   orionArm    the dive into the disc, toward one ordinary star
 *   arrive      deceleration and fade for the cut to the solar system
 *
 * The astronomy is real where it can be seen. The Milky Way is a four-armed
 * barred spiral about 100,000 light-years across; the Sun sits roughly 26,000
 * light-years out on the inner rim of the Orion Arm, a 3,500-light-year-wide
 * structure between the Carina-Sagittarius and Perseus arms. Colour follows
 * astrophotography rather than the usual all-blue space art: the core is
 * yellow-red, the arms blue-white, and the knots of star formation pink.
 */

/**
 * Phase durations in milliseconds. Tune freely -- this is the only place
 * timing lives, and the total is derived, so nothing else needs changing.
 * Current total is a little over 40 seconds.
 */
export const INTRO_TIMING = {
  detonation: 3000,
  multiverse: 8500,
  approach: 4200,
  galaxies: 8500,
  milkyWay: 8500,
  orionArm: 5500,
  sunApproach: 5000,
  // Short on purpose: this is a flare and a cut, not a scene.
  arrive: 1500,
};

const PHASE_ORDER = [
  "detonation", "multiverse", "approach", "galaxies",
  "milkyWay", "orionArm", "sunApproach", "arrive",
];

const FIELD_DEPTH = 2600;
const FIELD_RADIUS = 640;
const TAU = Math.PI * 2;

/**
 * The captions.
 *
 * Short, plain, and factual. Anything longer than this cannot be read while
 * the frame is moving, and anything vaguer than this is decoration.
 */
const CAPTIONS = {
  detonation: {
    title: "The Big Bang",
    body: "Not an explosion in space. Space itself, expanding — from smaller than an atom to larger than a galaxy, in under a second.",
  },
  multiverse: {
    title: "The Multiverse",
    body: "That expansion may never have stopped. Where it did, a bubble cooled into a universe — each one filled with its own stars, its own galaxies, its own physics.",
  },
  approach: {
    title: "Our Universe",
    body: "This is the bubble we cooled into. 13.8 billion years old, 93 billion light-years across, and still growing.",
  },
  galaxies: {
    title: "Two Trillion Galaxies",
    body: "Every mote of light here is an island of a hundred billion stars.",
  },
  milkyWay: {
    title: "The Milky Way",
    body: "A barred spiral 100,000 light-years across. Ours.",
  },
  orionArm: {
    title: "The Orion Arm",
    body: "26,000 light-years from the centre, on the inner rim of a minor arm, between Perseus and Carina-Sagittarius.",
  },
  sunApproach: {
    title: "Our Star",
    body: "A G-type main-sequence star, 4.6 billion years old. Everything you are about to see is held by it.",
  },
  arrive: null,
};

function phaseTotal() {
  return PHASE_ORDER.reduce((sum, key) => sum + INTRO_TIMING[key], 0);
}

/* ------------------------------------------------------------- textures */

function createGlowTexture(core = "rgba(255,255,255,1)", mid = "rgba(255,206,150,0.5)", stop = 0.34) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, core);
  gradient.addColorStop(stop, mid);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The spike flare.
 *
 * This is what separates an explosion from a light being switched on. A pure
 * radial gradient can only ever brighten; rays give the burst a direction and
 * a shape, and it is the thing every photograph of a detonation actually
 * shows. Spikes are drawn at uneven angles and uneven lengths on purpose --
 * evenly spaced ones read as a lens artefact rather than as light escaping.
 */
function createRayTexture(spikes = 22) {
  const size = 512;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.translate(half, half);
  context.globalCompositeOperation = "lighter";

  // Deterministic jitter so the flare is identical on every run.
  let seed = 0x2545f491;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < spikes; i += 1) {
    const angle = (i / spikes) * TAU + (random() - 0.5) * 0.34;
    const length = half * (0.34 + Math.pow(random(), 1.6) * 0.66);
    const width = 1.2 + random() * 5.5;
    const gradient = context.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0.95)");
    gradient.addColorStop(0.18, "rgba(226,240,255,0.55)");
    gradient.addColorStop(1, "rgba(150,190,255,0)");
    context.save();
    context.rotate(angle);
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(0, -width);
    context.lineTo(length, 0);
    context.lineTo(0, width);
    context.closePath();
    context.fill();
    context.restore();
  }

  // The core the spikes leave from.
  const core = context.createRadialGradient(0, 0, 0, 0, 0, half * 0.3);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.4, "rgba(198,226,255,0.8)");
  core.addColorStop(1, "rgba(120,170,255,0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, half * 0.3, 0, TAU);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A cloud, not a ball.
 *
 * One radial gradient always looks like a radial gradient -- a perfectly round
 * smudge that the eye reads as a sprite. Stacking several offset, unequal
 * gradients additively gives an irregular edge and an off-centre core, which
 * is the difference between "glow" and "nebula". Built once at three
 * variants and shared by every cloud in the field.
 */
function createCloudTexture(variant = 0) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.globalCompositeOperation = "lighter";

  // Deterministic, so a given variant is identical on every run.
  let seed = (0x1f123bb5 + variant * 0x9e3779b9) >>> 0;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const lobes = 7 + Math.floor(random() * 4);
  for (let i = 0; i < lobes; i += 1) {
    const radius = size * (0.12 + random() * 0.26);
    // Kept inside a disc so the lobes never clip the edge of the canvas,
    // which would show as a straight line across the cloud.
    const angle = random() * Math.PI * 2;
    const offset = random() * (size * 0.5 - radius);
    const x = size / 2 + Math.cos(angle) * offset;
    const y = size / 2 + Math.sin(angle) * offset;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${(0.16 + random() * 0.2).toFixed(3)})`);
    gradient.addColorStop(0.5, "rgba(255,255,255,0.06)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The galaxy disc, painted rather than sampled.
 *
 * Point clouds cannot make a galaxy look like a galaxy. A real spiral is
 * mostly *diffuse* -- unresolved starlight and dust, smooth over degrees --
 * with resolved stars only as a sparkle on top. Rendering it purely as points
 * gives a sparse, grainy pinwheel: every photograph of the Milky Way is broad
 * luminous bands, a warm bar, and dark dust lanes carving through them.
 *
 * So the diffuse component is painted once into a canvas and mapped onto a
 * plane in the disc, and the point stars stay as the sparkle over it. Three
 * details do most of the work:
 *
 *   - the dust lanes are *carved*, using destination-out, rather than drawn
 *     dark. The scene composites additively, so black paint is invisible;
 *     removing light is the only way to make a lane read as dust in front of
 *     the disc, which is what it physically is.
 *   - each arm is painted twice, a broad cool base and a narrow bright ridge,
 *     because a single stroke reads as a ribbon rather than as a crowd.
 *   - the HII knots go on last and only along the ridges, which is where star
 *     formation actually happens: the leading edge of the density wave.
 */
function createGalaxyDiscTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const half = size / 2;
  context.translate(half, half);

  let seed = 0x7f4a7c15;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  /*
   * The disc must finish well inside the canvas.
   *
   * The halo painted below reaches 1.16 R, so at R = 0.9 of the half-width it
   * ran off the edge of the bitmap -- and a gradient clipped by a canvas edge
   * shows as a straight line across the sky. Backing R off leaves room for the
   * halo to fade out on its own; the plane is sized to compensate, so the disc
   * still lands at radius 1 in the group's local units.
   */
  const R = half * 0.76;
  const ARMS = 4;
  const SPIN = 4.6;
  const BAR = 0.42;

  const blob = (x, y, radius, colour, alpha) => {
    if (alpha <= 0.001 || radius <= 0.2) return;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${colour},${alpha.toFixed(4)})`);
    gradient.addColorStop(0.55, `rgba(${colour},${(alpha * 0.42).toFixed(4)})`);
    gradient.addColorStop(1, `rgba(${colour},0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  };

  /** One spiral pass: `paint` is called with x, y and the fraction along it. */
  function alongArms(steps, from, to, jitter, offset, paint) {
    for (let arm = 0; arm < ARMS; arm += 1) {
      const base = (arm / ARMS) * TAU + offset;
      for (let i = 0; i <= steps; i += 1) {
        const t = from + (to - from) * (i / steps);
        const angle = base + t * SPIN + (random() - 0.5) * jitter;
        const r = t * R;
        paint(Math.cos(angle) * r, Math.sin(angle) * r, t, arm);
      }
    }
  }

  context.globalCompositeOperation = "lighter";

  // ---- the outer halo, so the disc does not stop on a hard edge
  const halo = context.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.16);
  halo.addColorStop(0, "rgba(146,166,200,0.13)");
  halo.addColorStop(0.55, "rgba(112,136,180,0.085)");
  halo.addColorStop(1, "rgba(46,64,104,0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(0, 0, R * 1.16, 0, TAU);
  context.fill();

  // ---- the smooth disc the arms sit in
  const disc = context.createRadialGradient(0, 0, 0, 0, 0, R);
  disc.addColorStop(0, "rgba(228,206,172,0.30)");
  disc.addColorStop(0.16, "rgba(196,190,186,0.21)");
  disc.addColorStop(0.55, "rgba(158,176,206,0.15)");
  disc.addColorStop(1, "rgba(96,120,166,0)");
  context.fillStyle = disc;
  context.beginPath();
  context.arc(0, 0, R, 0, TAU);
  context.fill();

  // ---- arms: broad cool base
  alongArms(210, 0.10, 1.0, 0.16, 0, (x, y, t) => {
    const width = R * (0.055 + t * 0.115);
    const fade = Math.pow(Math.sin(Math.min(1, (t - 0.1) / 0.9) * Math.PI), 0.45);
    blob(x, y, width, "170,190,222", 0.07 * fade);
  });

  // ---- arms: narrow bright ridge
  alongArms(230, 0.13, 0.97, 0.05, 0.06, (x, y, t) => {
    const width = R * (0.020 + t * 0.045);
    const fade = Math.pow(Math.sin(Math.min(1, (t - 0.13) / 0.84) * Math.PI), 0.5);
    blob(x, y, width, "216,230,250", 0.068 * fade);
  });

  /*
   * Flocculent spurs.
   *
   * Four clean arms is a diagram, not a galaxy. Real spirals -- ours very much
   * included -- are feathery: short branches peel off the main arms at a
   * shallow angle and fade out between them, and it is that broken, fibrous
   * quality that makes the reference read as a photograph rather than as a
   * pinwheel. Each spur is a short spiral of its own, launched from a random
   * point on an arm.
   */
  for (let i = 0; i < 46; i += 1) {
    const arm = Math.floor(random() * ARMS) / ARMS;
    const launch = 0.24 + random() * 0.62;
    const lean = (random() - 0.5) * 0.9;
    const reach = 0.09 + random() * 0.2;
    const steps = 26;
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps;
      const t = launch + reach * u;
      if (t > 1.02) break;
      const angle = arm * TAU + t * SPIN + 0.06 + lean * u * 0.7;
      const r = t * R;
      const width = R * (0.012 + t * 0.03) * (1 - u * 0.55);
      blob(Math.cos(angle) * r, Math.sin(angle) * r, width,
        "196,214,244", 0.05 * Math.sin(u * Math.PI) ** 0.5);
    }
  }

  // ---- the bar and the bulge
  context.save();
  context.rotate(BAR);
  context.scale(1, 0.34);
  const bar = context.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
  bar.addColorStop(0, "rgba(255,238,198,0.62)");
  bar.addColorStop(0.4, "rgba(255,214,150,0.34)");
  bar.addColorStop(1, "rgba(226,168,104,0)");
  context.fillStyle = bar;
  context.beginPath();
  context.arc(0, 0, R * 0.34, 0, TAU);
  context.fill();
  context.restore();

  const bulge = context.createRadialGradient(0, 0, 0, 0, 0, R * 0.16);
  bulge.addColorStop(0, "rgba(255,246,220,0.85)");
  bulge.addColorStop(0.42, "rgba(255,216,156,0.4)");
  bulge.addColorStop(1, "rgba(238,178,110,0)");
  context.fillStyle = bulge;
  context.beginPath();
  context.arc(0, 0, R * 0.16, 0, TAU);
  context.fill();

  // ---- dust lanes, carved out of everything above
  context.globalCompositeOperation = "destination-out";
  // Along the inner edge of each arm, where the density wave piles dust up.
  alongArms(180, 0.16, 0.94, 0.05, -0.24, (x, y, t) => {
    const width = R * (0.014 + t * 0.042);
    const fade = Math.pow(Math.sin(Math.min(1, (t - 0.16) / 0.78) * Math.PI), 0.6);
    blob(x, y, width, "0,0,0", 0.66 * fade);
  });
  // The pair of lanes that wrap the bar -- the most recognisable feature of
  // the reference, and the thing that makes the core read as three-dimensional.
  for (let side = 0; side < 2; side += 1) {
    const flip = side === 0 ? 1 : -1;
    for (let i = 0; i <= 90; i += 1) {
      const t = i / 90;
      const angle = BAR + flip * (0.55 + t * 2.5);
      const r = R * (0.10 + t * 0.28);
      blob(
        Math.cos(angle) * r, Math.sin(angle) * r,
        R * (0.022 + t * 0.03), "0,0,0",
        0.62 * Math.sin(t * Math.PI) ** 0.5,
      );
    }
  }

  /*
   * Dust filaments crossing the disc.
   *
   * The reference is threaded with fine dark lanes that cut across the arms at
   * an angle rather than following them. They are what break the disc up into
   * something layered and irregular; without them the carved lanes alone read
   * as four tidy grooves.
   */
  for (let i = 0; i < 34; i += 1) {
    const arm = Math.floor(random() * ARMS) / ARMS;
    const launch = 0.22 + random() * 0.6;
    const lean = (random() - 0.5) * 1.3;
    const reach = 0.07 + random() * 0.17;
    const steps = 22;
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps;
      const t = launch + reach * u;
      if (t > 1.0) break;
      const angle = arm * TAU + t * SPIN - 0.16 + lean * u * 0.8;
      const r = t * R;
      blob(Math.cos(angle) * r, Math.sin(angle) * r,
        R * (0.008 + t * 0.017), "0,0,0", 0.4 * Math.sin(u * Math.PI) ** 0.6);
    }
  }

  // ---- star-forming regions, on the ridges only
  context.globalCompositeOperation = "lighter";
  alongArms(120, 0.18, 0.95, 0.035, 0.06, (x, y, t) => {
    if (random() > 0.42) return;
    const size = R * (0.006 + random() * 0.014);
    const hot = random() < 0.4;
    blob(x, y, size, hot ? "255,150,196" : "255,110,150", 0.42 + random() * 0.34);
  });

  // ---- a scatter of resolved foreground stars over the whole disc
  for (let i = 0; i < 420; i += 1) {
    const angle = random() * TAU;
    const r = Math.pow(random(), 0.5) * R * 1.05;
    blob(Math.cos(angle) * r, Math.sin(angle) * r, R * (0.002 + random() * 0.005),
      "255,255,255", 0.3 + random() * 0.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/* -------------------------------------------------------------- palettes */

/**
 * Galaxy palette.
 *
 * Real galaxies are mostly yellow-white with blue arms, but a field made only
 * of those reads as monochrome. This leans deliberately artistic: the warm and
 * blue-white populations still dominate, with teal, rose and violet drawn from
 * reflection nebulosity and hydrogen-alpha emission for variety.
 */
const GALAXY_COLOURS = [
  [1.00, 0.74, 0.38], // warm elliptical
  [1.00, 0.54, 0.20], // amber
  [0.58, 0.78, 1.00], // blue-white spiral
  [0.34, 0.58, 1.00], // cooler blue
  [0.26, 0.94, 0.86], // teal reflection
  [1.00, 0.38, 0.64], // rose emission
  [0.58, 0.38, 1.00], // violet
  [0.94, 0.92, 0.86], // near-white
];

/** Core / arm pairs for the resolved spirals the camera passes close to. */
const SPIRAL_PAIRS = [
  [[1.00, 0.78, 0.34], [0.46, 0.70, 1.00]],
  [[1.00, 0.62, 0.24], [1.00, 0.40, 0.66]],
  [[1.00, 0.88, 0.58], [0.28, 0.92, 0.90]],
  [[1.00, 0.70, 0.30], [0.66, 0.44, 1.00]],
  [[0.96, 0.84, 0.52], [0.40, 0.62, 1.00]],
];

/** Bubble universes: iridescent shells, strongly varied in hue. */
const UNIVERSE_PAIRS = [
  [[0.52, 0.36, 0.96], [0.24, 0.82, 0.92]],
  [[0.20, 0.68, 0.86], [0.66, 0.94, 0.78]],
  [[0.94, 0.46, 0.40], [0.98, 0.82, 0.42]],
  [[0.32, 0.74, 0.52], [0.84, 0.92, 0.44]],
  [[0.84, 0.36, 0.70], [0.44, 0.44, 0.98]],
  [[0.28, 0.42, 0.92], [0.86, 0.62, 0.98]],
];

/**
 * Cosmic dust.
 *
 * Interstellar clouds are lit three different ways and each has its own
 * colour, which is why real deep-sky photographs are not monochrome:
 *   emission     hydrogen ionised by hot stars, glowing red and magenta
 *   reflection   cold dust scattering starlight, which favours blue
 *   forbidden    doubly-ionised oxygen, the teal-green of the Orion core
 * The gold and indigo at the end are the warm inner-galaxy haze and the deep
 * cold of the voids between.
 */
const COSMIC_DUST_COLOURS = [
  [1.00, 0.34, 0.58], // hydrogen-alpha emission
  [1.00, 0.28, 0.26], // deep emission red
  [0.32, 0.56, 1.00], // reflection blue
  [0.26, 0.86, 0.90], // doubly-ionised oxygen
  [0.58, 0.36, 1.00], // violet
  [1.00, 0.70, 0.32], // warm haze
  [0.22, 0.28, 0.72], // cold indigo
];

/* ---------------------------------------------------------- star shader */

/**
 * Per-star twinkle.
 *
 * A `PointsMaterial` can only fade the whole field at once, so every star
 * brightened and dimmed in lockstep -- which reads as the exposure changing,
 * not as stars. Giving each point its own phase and rate costs two floats and
 * makes the field shimmer.
 *
 * The pulse is raised to a power rather than left as a sine: a plain sine
 * spends as long bright as it does dim and ticks like a metronome, while the
 * curve below holds each star dim and lets it flare briefly. Size is pushed
 * along with brightness, because a real star appears to grow when it scintillates
 * -- the airy disc is fixed, but the bloom around it is not.
 */
const DUST_VERTEX = /* glsl */`
  attribute vec3 aColour;
  attribute float aPhase;
  attribute float aRate;
  attribute float aScale;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  varying vec3 vColour;
  varying float vTwinkle;
  void main() {
    vColour = aColour;
    float pulse = sin(uTime * aRate + aPhase) * 0.5 + 0.5;
    vTwinkle = 0.3 + pow(pulse, 2.2) * 0.7;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * aScale * (0.72 + vTwinkle * 0.55) * (uScale / -viewPosition.z);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const DUST_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec3 vColour;
  varying float vTwinkle;
  void main() {
    vec4 texel = texture2D(uMap, gl_PointCoord);
    float alpha = texel.a * uOpacity * vTwinkle;
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(vColour * (0.7 + vTwinkle * 0.6), alpha);
  }
`;

/* --------------------------------------------------------- bubble shader */

const BUBBLE_VERTEX = /* glsl */`
  varying vec3 vNormalView;
  varying vec3 vPositionView;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vPositionView = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/**
 * A soap bubble, not a ball of light.
 *
 * The shell is almost invisible face-on and bright at the rim, which is what
 * makes a thin film read as a film: you see the surface where you are looking
 * along it, not where you are looking through it. The banding is a cheap
 * stand-in for thin-film interference -- the same physics that puts colour in
 * a real soap bubble -- and it is what stops these looking like glowing
 * spheres, which is what they were before.
 */
const BUBBLE_FRAGMENT = /* glsl */`
  uniform vec3 uColourA;
  uniform vec3 uColourB;
  uniform float uOpacity;
  uniform float uPhase;
  varying vec3 vNormalView;
  varying vec3 vPositionView;
  void main() {
    vec3 normal = normalize(vNormalView);
    vec3 view = normalize(-vPositionView);
    float facing = abs(dot(normal, view));
    float rim = pow(1.0 - facing, 2.6);
    float band = sin(facing * 16.0 - uPhase) * 0.5 + 0.5;
    vec3 colour = mix(uColourA, uColourB, band);
    float alpha = (rim * 0.9 + 0.05) * uOpacity;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(colour * (0.3 + rim * 1.7), alpha);
  }
`;

/* ----------------------------------------------------------------- build */

/**
 * @param {object} [options]
 * @param {number} [options.pixelRatio] the renderer's pixel ratio.
 *
 * This matters more than it looks. `gl_PointSize` is in DEVICE pixels, so on a
 * 2x display every point drawn with `sizeAttenuation: false` comes out at half
 * the intended size -- which is why the bubble universes read as empty outlines
 * on a Retina screen and as full of stars everywhere else. Every fixed point
 * size below is multiplied through this.
 */
export function createCosmicIntro({ pixelRatio } = {}) {
  const dpr = Math.max(1, pixelRatio ?? window.devicePixelRatio ?? 1);
  /** Converts a size in CSS pixels to the device pixels gl_PointSize wants. */
  const px = (cssPixels) => cssPixels * dpr;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000104);
  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.5, 40000);

  let seed = 0x9e3779b9;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Box-Muller, for distributions that should cluster rather than spread flat.
  const gaussian = () => {
    const u = Math.max(1e-6, random());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * random());
  };

  const disposables = [];
  const track = (resource) => { disposables.push(resource); return resource; };

  /* ------------------------------------------------------------ captions */

  const caption = document.createElement("div");
  caption.className = "cosmic-caption";
  caption.innerHTML = `
    <p class="cosmic-caption__title"></p>
    <p class="cosmic-caption__body"></p>
  `;
  const captionTitle = caption.querySelector(".cosmic-caption__title");
  const captionBody = caption.querySelector(".cosmic-caption__body");
  document.body.append(caption);

  let captionKey = null;
  function showCaption(key) {
    if (key === captionKey) return;
    captionKey = key;
    const entry = CAPTIONS[key];
    if (!entry) {
      caption.classList.remove("is-live");
      return;
    }
    // Retire, then re-cue, so consecutive captions cross-fade rather than
    // swapping their text mid-opacity.
    caption.classList.remove("is-live");
    captionTitle.textContent = entry.title;
    captionBody.textContent = entry.body;
    // Force a reflow so the animation restarts for the new text.
    void caption.offsetWidth;
    caption.classList.add("is-live");
  }

  /* --------------------------------------------------------- the detonation */

  const blast = new THREE.Group();
  scene.add(blast);

  // Rock is shaded, not emissive -- it has to be lit by the blast to read as
  // matter rather than as more light. This is the only lighting in the scene;
  // everything else is additive and ignores it.
  const blastLight = new THREE.PointLight(0xdce8ff, 0, 4200, 1.4);
  blastLight.position.set(0, 0, -18);
  scene.add(blastLight);
  const fillLight = new THREE.AmbientLight(0x36486e, 1.7);
  scene.add(fillLight);

  const coreMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(186,222,255,0.72)", 0.26)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  coreMaterial.depthTest = false;
  const core = new THREE.Sprite(coreMaterial);
  core.renderOrder = 6;
  core.position.set(0, 0, -18);
  core.scale.setScalar(3);
  blast.add(core);

  // Two flares, counter-rotating. One alone reads as a static graphic.
  const rayTexture = track(createRayTexture(22));
  const rays = [0, 1].map((index) => {
    const material = track(new THREE.SpriteMaterial({
      map: rayTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: new THREE.Color(index === 0 ? 0xffffff : 0x9ec6ff),
    }));
    material.depthTest = false;
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 5;
    sprite.position.set(0, 0, -19);
    sprite.scale.setScalar(3);
    sprite.material.rotation = index * 0.7;
    blast.add(sprite);
    return sprite;
  });

  // Expanding shockwave rings, staggered so the front looks like it is being
  // driven rather than drawn once.
  const ringGeometry = track(new THREE.RingGeometry(0.86, 1, 128));
  const shockwaves = [0, 1, 2].map((index) => {
    const material = track(new THREE.MeshBasicMaterial({
      color: new THREE.Color(index === 1 ? 0xbcd8ff : 0xffffff),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }));
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.renderOrder = 4;
    mesh.position.set(0, 0, -20);
    mesh.scale.setScalar(1);
    blast.add(mesh);
    return { mesh, material, delay: index * 0.17 };
  });

  // The nebulous cloud the reference images show around the core: cold blue
  // haze, not a second flash.
  const hazeTexture = track(createGlowTexture("rgba(196,224,255,0.55)", "rgba(90,140,230,0.22)", 0.4));
  const haze = [];
  for (let i = 0; i < 7; i += 1) {
    const material = track(new THREE.SpriteMaterial({
      map: hazeTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    }));
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 3;
    const angle = random() * TAU;
    // Pushed out to a ring rather than sat on the core, so the cloud frames
    // the light instead of drowning it.
    const radius = 18 + random() * 46;
    sprite.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.8, -26 - random() * 44);
    sprite.userData.base = 26 + random() * 54;
    sprite.userData.drift = 0.9 + random() * 1.5;
    sprite.scale.setScalar(sprite.userData.base);
    blast.add(sprite);
    haze.push(sprite);
  }

  // Rocky debris. One instanced draw call for the whole ejecta field.
  const DEBRIS_COUNT = 520;
  const debrisGeometry = track(new THREE.IcosahedronGeometry(1, 0));
  // Rough the faces up so each fragment catches the light unevenly.
  {
    const position = debrisGeometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const jitter = 0.72 + random() * 0.56;
      position.setXYZ(i, position.getX(i) * jitter, position.getY(i) * jitter, position.getZ(i) * jitter);
    }
    debrisGeometry.computeVertexNormals();
  }
  const debrisMaterial = track(new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x120c08,
    flatShading: true,
  }));
  const debris = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, DEBRIS_COUNT);
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  debris.frustumCulled = false;
  blast.add(debris);

  const debrisState = [];
  for (let i = 0; i < DEBRIS_COUNT; i += 1) {
    // Uniform on the sphere, then biased forward so a good share of it comes
    // past the camera instead of all of it receding.
    const theta = random() * TAU;
    const z = random() * 2 - 1;
    const planar = Math.sqrt(Math.max(0, 1 - z * z));
    const direction = new THREE.Vector3(planar * Math.cos(theta), planar * Math.sin(theta), z * 0.75 + 0.28);
    direction.normalize();
    debrisState.push({
      direction,
      speed: 20 + Math.pow(random(), 1.7) * 235,
      scale: 0.07 + Math.pow(random(), 3.1) * 0.82,
      spinAxis: new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      spinRate: (random() - 0.5) * 5.5,
      phase: random() * TAU,
    });
    const tint = 0.5 + random() * 0.5;
    debris.setColorAt(i, new THREE.Color(tint * 0.56, tint * 0.47, tint * 0.38));
  }
  if (debris.instanceColor) debris.instanceColor.needsUpdate = true;

  const debrisMatrix = new THREE.Matrix4();
  const debrisQuaternion = new THREE.Quaternion();
  const debrisPosition = new THREE.Vector3();
  const debrisScale = new THREE.Vector3();

  function layOutDebris(travel, spin, scaleFactor) {
    for (let i = 0; i < DEBRIS_COUNT; i += 1) {
      const state = debrisState[i];
      const distance = state.speed * travel;
      debrisPosition.copy(state.direction).multiplyScalar(distance);
      debrisPosition.z -= 18;
      debrisQuaternion.setFromAxisAngle(state.spinAxis, state.phase + state.spinRate * spin);
      debrisScale.setScalar(state.scale * scaleFactor);
      debrisMatrix.compose(debrisPosition, debrisQuaternion, debrisScale);
      debris.setMatrixAt(i, debrisMatrix);
    }
    debris.instanceMatrix.needsUpdate = true;
  }
  layOutDebris(0, 0, 0.001);

  /* ------------------------------------------------------------ star dust */

  const DUST_COUNT = 5600;
  const dustOrigin = new Float32Array(DUST_COUNT * 3);
  const dustTarget = new Float32Array(DUST_COUNT * 3);
  const dustColours = new Float32Array(DUST_COUNT * 3);

  for (let i = 0; i < DUST_COUNT; i += 1) {
    const i3 = i * 3;
    const angle = random() * TAU;
    const radius = Math.pow(random(), 0.55) * FIELD_RADIUS;
    dustTarget[i3] = Math.cos(angle) * radius;
    dustTarget[i3 + 1] = Math.sin(angle) * radius * 0.84;
    dustTarget[i3 + 2] = -random() * FIELD_DEPTH;
    dustOrigin[i3] = (random() - 0.5) * 0.6;
    dustOrigin[i3 + 1] = (random() - 0.5) * 0.6;
    dustOrigin[i3 + 2] = -18 + (random() - 0.5) * 0.6;

    /*
     * White and bright, with only a whisper of tint.
     *
     * A physically honest field is mostly warm -- but at one pixel across,
     * warm reads as dirty yellow dust rather than as stars, which is exactly
     * how this looked. Real deep-sky photographs are the same: the stars come
     * out white because they are overexposed, and the colour lives in the
     * few brightest ones. So: white by default, a blue-white majority in the
     * tail, and a small warm minority for the ones that are genuinely red.
     */
    const roll = random();
    const c = roll < 0.56 ? [1.00, 1.00, 1.00]
      : roll < 0.78 ? [0.88, 0.94, 1.00]
        : roll < 0.90 ? [0.70, 0.84, 1.00]
          : roll < 0.97 ? [1.00, 0.98, 0.96]
            : [1.00, 0.82, 0.62];
    dustColours[i3] = c[0];
    dustColours[i3 + 1] = c[1];
    dustColours[i3 + 2] = c[2];
  }

  // Twinkle parameters, one pair per star. Rates are spread wide on purpose:
  // a narrow band makes the whole field beat together at a single frequency.
  const dustPhase = new Float32Array(DUST_COUNT);
  const dustRate = new Float32Array(DUST_COUNT);
  const dustScale = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i += 1) {
    dustPhase[i] = random() * TAU;
    dustRate[i] = 0.35 + random() * 2.4;
    // A few stars are much bigger than the rest, which is what stops a point
    // field reading as noise.
    dustScale[i] = 0.55 + Math.pow(random(), 2.6) * 1.5;
  }

  const dustGeometry = track(new THREE.BufferGeometry());
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustOrigin.slice(), 3));
  dustGeometry.setAttribute("aColour", new THREE.BufferAttribute(dustColours, 3));
  dustGeometry.setAttribute("aPhase", new THREE.BufferAttribute(dustPhase, 1));
  dustGeometry.setAttribute("aRate", new THREE.BufferAttribute(dustRate, 1));
  dustGeometry.setAttribute("aScale", new THREE.BufferAttribute(dustScale, 1));
  const dustMaterial = track(new THREE.ShaderMaterial({
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    uniforms: {
      // Tight white core: a wide soft falloff reads as dust, a hard one reads
      // as a star. The old map's warm mid-stop was half of why this field
      // looked yellow even where the vertex colours were not.
      uMap: { value: track(createGlowTexture("rgba(255,255,255,1)", "rgba(214,232,255,0.34)", 0.16)) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 3.4 },
      // Reproduces three.js's own size-attenuation scale, which is half the
      // drawing buffer height. Kept as a uniform so resize() can correct it.
      uScale: { value: window.innerHeight * dpr * 0.5 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.frustumCulled = false;
  scene.add(dust);

  /* -------------------------------------------------------- bubble universes */

  /*
   * A bubble universe is not a hollow shell.
   *
   * The first version was a rim shader and nothing else, so each one read as a
   * coloured outline around a hole -- which is the opposite of the idea. A
   * universe is the fullest thing there is. Each bubble is now three objects:
   *
   *   shell  thousands of stars hugged to the sphere's surface. Because the
   *          near and far halves both draw and the blending is additive, the
   *          limb comes out denser than the middle all by itself -- the same
   *          reason the edge of a soap bubble looks like a bright ring.
   *   knots  a scatter of brighter, larger points: the clusters and nearby
   *          galaxies you would actually pick out inside one.
   *   rim    the iridescent film, kept but pulled right down, so the colour
   *          now edges the universe instead of standing in for it.
   *
   * Geometry is shared across four variants and reused by every bubble; only
   * the materials are per-bubble, because those are cheap and the opacities
   * are animated independently.
   */
  const BUBBLE_SHELL_COUNT = 8200;
  const BUBBLE_KNOT_COUNT = 90;
  const BUBBLE_GALAXY_COUNT = 34;
  const BUBBLE_VARIANTS = 4;

  /*
   * Star colour inside a universe.
   *
   * Overwhelmingly white and blue-white, with a small warm tail. That is both
   * what the reference looks like and roughly what a deep field looks like:
   * unresolved galaxies integrate to something close to white, and the eye
   * reads any strong tint here as a filter rather than as distance.
   */
  function bubbleStarColour() {
    const roll = random();
    return roll < 0.60 ? [1.00, 1.00, 1.00]
      : roll < 0.80 ? [0.80, 0.89, 1.00]
        : roll < 0.91 ? [0.62, 0.80, 1.00]
          : roll < 0.97 ? [0.94, 0.94, 1.00]
            : [1.00, 0.78, 0.58];
  }

  function buildBubbleShell(count) {
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      // Uniform on the sphere: sampling z flat is the only way to avoid
      // bunching the points at the poles.
      const theta = random() * TAU;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      // Hugged to the surface. A solid ball reads as fog; a shell reads as a
      // world with an edge to it.
      const r = 1 - Math.pow(random(), 2.4) * 0.28;
      positions[i3] = planar * Math.cos(theta) * r;
      positions[i3 + 1] = planar * Math.sin(theta) * r;
      positions[i3 + 2] = z * r;
      const c = bubbleStarColour();
      colours[i3] = c[0];
      colours[i3 + 1] = c[1];
      colours[i3 + 2] = c[2];
    }
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  }

  function buildBubbleKnots(count) {
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const theta = random() * TAU;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const r = 0.55 + random() * 0.42;
      positions[i3] = planar * Math.cos(theta) * r;
      positions[i3 + 1] = planar * Math.sin(theta) * r;
      positions[i3 + 2] = z * r;
      const c = random() < 0.78 ? [1.0, 1.0, 1.0] : [0.72, 0.86, 1.0];
      colours[i3] = c[0];
      colours[i3 + 1] = c[1];
      colours[i3 + 2] = c[2];
    }
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  }

  /**
   * The small galaxies inside a universe.
   *
   * Points, not sprites: eleven bubbles with a dozen sprite galaxies each
   * would be a hundred extra draw calls for objects a few pixels wide. At this
   * size a soft coloured smudge is indistinguishable from a rendered galaxy
   * anyway -- which is precisely what a real distant galaxy is on a
   * photograph. Colours come from the same mixed palette as the resolved
   * galaxies later in the sequence, so the two acts agree with each other.
   */
  function buildBubbleGalaxies(count) {
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const theta = random() * TAU;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const r = 0.45 + random() * 0.5;
      positions[i3] = planar * Math.cos(theta) * r;
      positions[i3 + 1] = planar * Math.sin(theta) * r;
      positions[i3 + 2] = z * r;
      const c = GALAXY_COLOURS[Math.floor(random() * GALAXY_COLOURS.length)];
      colours[i3] = c[0];
      colours[i3 + 1] = c[1];
      colours[i3 + 2] = c[2];
    }
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  }

  const bubbleGalaxyTexture = track(createGlowTexture(
    "rgba(255,255,255,0.9)", "rgba(255,255,255,0.42)", 0.24,
  ));
  const bubbleStarTexture = track(createGlowTexture(
    "rgba(255,255,255,1)", "rgba(186,216,255,0.34)", 0.16,
  ));
  const bubbleRimGeometry = track(new THREE.SphereGeometry(1, 40, 28));
  const shellGeometries = [];
  const knotGeometries = [];
  const galaxyGeometries = [];
  for (let i = 0; i < BUBBLE_VARIANTS; i += 1) {
    shellGeometries.push(buildBubbleShell(BUBBLE_SHELL_COUNT));
    knotGeometries.push(buildBubbleKnots(BUBBLE_KNOT_COUNT));
    galaxyGeometries.push(buildBubbleGalaxies(BUBBLE_GALAXY_COUNT));
  }
  // Ours is entered rather than passed, so it ends up filling the frame. At
  // the shared density it would thin out to a scatter exactly when the viewer
  // is closest to it, so it gets a shell of its own.
  const oursShellGeometry = buildBubbleShell(24000);
  const oursKnotGeometry = buildBubbleKnots(260);
  const oursGalaxyGeometry = buildBubbleGalaxies(90);

  const BUBBLE_COUNT = 9;
  // Depth at which a bubble has finished its pass and goes back to its slot.
  const BUBBLE_RETIRE_DEPTH = 620;

  /**
   * Builds one bubble: shell, knots and film, in a group that can be scaled
   * and positioned as a unit.
   */
  function createBubble(variant, palette, dense) {
    const [a, b] = palette;
    const group = new THREE.Group();

    const shellMaterial = track(new THREE.PointsMaterial({
      size: px(dense ? 1.5 : 1.35),
      map: bubbleStarTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      // Point size ignores object scale, and these groups are scaled by
      // hundreds; pixel sizes are the only ones that stay predictable.
      sizeAttenuation: false,
      opacity: 0,
    }));
    const shell = new THREE.Points(
      dense ? oursShellGeometry : shellGeometries[variant], shellMaterial,
    );
    group.add(shell);

    const knotMaterial = track(new THREE.PointsMaterial({
      size: px(dense ? 4.4 : 3.6),
      map: bubbleStarTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      opacity: 0,
    }));
    const knots = new THREE.Points(
      dense ? oursKnotGeometry : knotGeometries[variant], knotMaterial,
    );
    group.add(knots);

    const galaxyMaterial = track(new THREE.PointsMaterial({
      size: px(dense ? 11 : 8.5),
      map: bubbleGalaxyTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
      opacity: 0,
    }));
    group.add(new THREE.Points(
      dense ? oursGalaxyGeometry : galaxyGeometries[variant], galaxyMaterial,
    ));

    const rimMaterial = track(new THREE.ShaderMaterial({
      vertexShader: BUBBLE_VERTEX,
      fragmentShader: BUBBLE_FRAGMENT,
      uniforms: {
        uColourA: { value: new THREE.Color(a[0], a[1], a[2]) },
        uColourB: { value: new THREE.Color(b[0], b[1], b[2]) },
        uOpacity: { value: 0 },
        uPhase: { value: random() * TAU },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }));
    group.add(new THREE.Mesh(bubbleRimGeometry, rimMaterial));

    scene.add(group);
    return { group, shell, knots, shellMaterial, knotMaterial, galaxyMaterial, rimMaterial };
  }

  /*
   * Density control for the bubble the camera enters.
   *
   * Ours carries 24,000 stars so that it still reads as a sky once it fills
   * the frame -- but while it is a fifty-pixel dot in the distance those same
   * stars pile up at three per pixel and blend, additively, into a flat white
   * disc. Trimming the draw range keeps the *surface density* roughly constant
   * instead of the star count: few while it is far, all of them by the time it
   * is around us. Same buffer either way, so this costs nothing to change.
   */
  function setBubbleDetail(bubble, fraction) {
    const shellCount = bubble.shell.geometry.attributes.position.count;
    const knotCount = bubble.knots.geometry.attributes.position.count;
    const f = Math.max(0.02, Math.min(1, fraction));
    bubble.shell.geometry.setDrawRange(0, Math.ceil(shellCount * f));
    bubble.knots.geometry.setDrawRange(0, Math.ceil(knotCount * f));
  }

  /** Sets a whole bubble's visibility. The film stays well under the stars. */
  /**
   * How visible a drifting bubble should be at a given depth.
   *
   * Bubbles recycle: once one is past the camera it is moved a whole period
   * back so the field never runs out. That teleport is instant, and because
   * each bubble's radius scales with its placement depth it reappears at its
   * FULL apparent size -- so a universe simply materialised at the edge of
   * frame partway through the shot.
   *
   * Fading by depth fixes both ends of the loop at once: they dissolve in from
   * the far end and dissolve out as they sweep past, so the recycle is never
   * an event. Both bands sit where a bubble is already swinging off the edge
   * of the frame, so almost none of the dissolve is on screen either.
   *
   * Note this deliberately does not apply to ours -- it sits far beyond the
   * loop and never recycles, because it is the destination rather than scenery.
   */
  function bubbleJourneyFade(bubble) {
    const depth = -bubble.group.position.z;
    const span = bubble.startDepth - BUBBLE_RETIRE_DEPTH;
    const travelled = (bubble.startDepth - depth) / Math.max(1, span);
    const arriving = travelled / 0.16;
    const leaving = (1 - travelled) / 0.18;
    return Math.max(0, Math.min(1, arriving, leaving));
  }

  /**
   * Advances one bubble along its pass, returning it to its slot at the end.
   *
   * Returns true while it still has somewhere to go.
   */
  function driftBubble(bubble, step) {
    bubble.group.position.z += step;
    if (-bubble.group.position.z <= BUBBLE_RETIRE_DEPTH) {
      bubble.group.position.copy(bubble.slot);
    }
  }

  function setBubbleOpacity(bubble, value) {
    const v = Math.max(0, value);
    bubble.shellMaterial.opacity = v;
    bubble.knotMaterial.opacity = v;
    bubble.galaxyMaterial.opacity = v * 0.85;
    bubble.rimMaterial.uniforms.uOpacity.value = v * 0.34;
  }

  const bubbles = [];
  // Placed slots, kept so each new bubble can be tested against them.
  const bubbleSlots = [];

  /**
   * Rejection test for a candidate bubble.
   *
   * Bubbles that intersect look like foam, which is what the field looked like
   * before this. The separation is checked on the *wrapped* z difference: every
   * bubble drifts at the same speed and recycles by the same amount, so the
   * field is a periodic lattice. Proving it collision-free once here proves it
   * for the whole phase -- there is no later frame where two can drift into
   * one another.
   */
  function bubbleFits(x, y, z, radius) {
    const length = Math.hypot(x, y, z);
    const alpha = radius / -z;
    for (let i = 0; i < bubbleSlots.length; i += 1) {
      const slot = bubbleSlots[i];

      /*
       * Angular separation first, because that is what "overlapping" means
       * here. Bubbles only ever translate along z, so each one owns a fixed
       * ray out from the camera; two on nearby rays draw on top of one another
       * no matter how far apart they are in space, which is exactly what the
       * 3D-only test let through. Comparing the angle between their rays
       * against the sum of their angular radii keeps them apart on screen.
       */
      const cosine = (x * slot.x + y * slot.y + z * slot.z) / (length * slot.length);
      const between = Math.acos(Math.min(1, Math.max(-1, cosine)));
      if (between < (alpha + slot.alpha) * 1.35) return false;

      // And a true 3D test as well.
      const dx = x - slot.x;
      const dy = y - slot.y;
      const dz = z - slot.z;
      const needed = (radius + slot.radius) * 1.5;
      if (dx * dx + dy * dy + dz * dz < needed * needed) return false;
    }
    return true;
  }

  // Ours first, and on the axis: it is the destination, so nothing else may be
  // allowed to sit in front of it.
  /*
   * Ours is not in the collision set, and does not need to be.
   *
   * Every other bubble is placed at least half its own depth off the axis
   * while ours sits on it at a tenth of its depth in radius, so there is a
   * clear cone down the middle of the shot that nothing else can enter --
   * whatever their z. Including it in the rejection test would only have
   * forced the others further out, which is the opposite of what is wanted:
   * a destination with nothing near it reads as remote rather than as the one
   * you are heading for.
   */
  const OURS_START_Z = -6200;
  const ours = createBubble(0, UNIVERSE_PAIRS[0], true);
  ours.group.position.set(0, 0, OURS_START_Z);
  ours.group.scale.setScalar(620);
  bubbles.push(ours);

  // The angular half-size ours occupies down the middle of the shot. Every
  // other bubble has to clear it with room to spare.
  const OURS_ALPHA = 620 / -OURS_START_Z;

  for (let i = 1; i < BUBBLE_COUNT; i += 1) {
    const bubble = createBubble(i % BUBBLE_VARIANTS, UNIVERSE_PAIRS[i % UNIVERSE_PAIRS.length], false);
    let slot = null;
    for (let attempt = 0; attempt < 90 && !slot; attempt += 1) {
      const z = -2000 - (i - 1) * 620 - random() * 280;
      const depth = -z;
      /*
       * Size and offset both scale with depth, so every bubble subtends a
       * similar angle however far away it is. Without that the near ones
       * swallow the frame and the far ones vanish, and the field stops
       * reading as a population of comparable things.
       *
       * The offsets are deliberately modest -- half a depth rather than a
       * whole one. Pushed further out the neighbours sat at forty degrees off
       * axis, which put them at the very edge of frame and made our own
       * universe look stranded in the middle of an empty shot.
       */
      const angle = i * 2.39996 + (random() - 0.5) * 0.9;
      // A wide band of off-axis angles, not a narrow ring. Packed into a thin
      // annulus there is simply not enough sky to separate them in.
      const radial = depth * (0.48 + random() * 0.78);
      const radius = depth * (0.13 + random() * 0.10);
      const x = Math.cos(angle) * radial;
      const y = Math.sin(angle) * radial * 0.82;
      // Stay out of the corridor ours occupies down the axis.
      const fromAxis = Math.atan2(Math.hypot(x, y), depth);
      if (fromAxis < radius / depth + OURS_ALPHA * 1.8) continue;
      if (bubbleFits(x, y, z, radius)) slot = { x, y, z, radius };
    }
    // If 90 tries could not find room, that bubble simply is not placed --
    // an unplaceable one would have to overlap something to exist.
    if (!slot) { bubble.group.visible = false; continue; }
    bubble.group.position.set(slot.x, slot.y, slot.z);
    bubble.group.scale.set(slot.radius, slot.radius * (0.9 + random() * 0.2), slot.radius);
    slot.length = Math.hypot(slot.x, slot.y, slot.z);
    slot.alpha = slot.radius / -slot.z;
    bubbleSlots.push(slot);
    /*
     * Each bubble remembers where it started and goes back there.
     *
     * The previous recycle subtracted one fixed period from z, which moved a
     * bubble that had been placed close to the camera out to the far end --
     * where its unchanged sideways offset put it a few degrees off axis and
     * therefore right on top of the universe the shot is heading for. Because
     * every slot here is proved clear of its neighbours and of that corridor,
     * returning a bubble to its own slot is the one recycle that cannot
     * reintroduce a collision.
     */
    bubble.slot = new THREE.Vector3(slot.x, slot.y, slot.z);
    bubble.startDepth = -slot.z;
    bubbles.push(bubble);
  }

  /* --------------------------------------------------------------- galaxies */

  const galaxyGroup = new THREE.Group();
  galaxyGroup.visible = false;
  scene.add(galaxyGroup);

  // Distant, unresolved: sprites are the right tool, and cost one draw each.
  // Neutral, not warm: this texture is multiplied by each galaxy's colour, and
  // a warm map dragged every hue back toward the same cream. Narrow core, wide
  // coloured falloff, so the tint is the thing you see rather than a white dot.
  const galaxyTexture = track(createGlowTexture("rgba(255,255,255,0.92)", "rgba(255,255,255,0.5)", 0.2));
  const galaxySprites = [];
  for (let i = 0; i < 78; i += 1) {
    const rgb = GALAXY_COLOURS[Math.floor(random() * GALAXY_COLOURS.length)];
    const material = track(new THREE.SpriteMaterial({
      map: galaxyTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    }));
    const sprite = new THREE.Sprite(material);
    const angle = random() * TAU;
    const radius = 55 + Math.pow(random(), 0.7) * FIELD_RADIUS;
    sprite.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.8,
      -120 - random() * (FIELD_DEPTH - 120),
    );
    const scale = 14 + Math.pow(random(), 2.3) * 78;
    sprite.scale.set(scale, scale * (0.4 + random() * 0.52), 1);
    sprite.material.rotation = random() * Math.PI;
    galaxyGroup.add(sprite);
    galaxySprites.push(sprite);
  }

  /*
   * Cosmic dust between the galaxies.
   *
   * Intergalactic space is not actually full of nebulae -- these belong to the
   * galaxies they sit near. They are here because a travelling shot through
   * pure black with points in it has no sense of volume: without something
   * that occludes, diffuses and passes at a different rate, the camera reads
   * as still and the field as a flat backdrop. Kept faint, large and slow, so
   * they register as depth rather than as objects.
   */
  const cloudTextures = [0, 1, 2].map((variant) => track(createCloudTexture(variant)));
  const nebulae = [];
  for (let i = 0; i < 30; i += 1) {
    const rgb = COSMIC_DUST_COLOURS[Math.floor(random() * COSMIC_DUST_COLOURS.length)];
    const material = track(new THREE.SpriteMaterial({
      map: cloudTextures[i % cloudTextures.length],
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    }));
    const sprite = new THREE.Sprite(material);
    const angle = random() * TAU;
    const radius = 40 + Math.pow(random(), 0.6) * FIELD_RADIUS * 1.15;
    sprite.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.8,
      -140 - random() * (FIELD_DEPTH - 140),
    );
    const scale = 190 + Math.pow(random(), 1.7) * 620;
    sprite.scale.set(scale, scale * (0.5 + random() * 0.62), 1);
    sprite.material.rotation = random() * Math.PI;
    // Each cloud breathes at its own rate, so the field never pulses as one.
    sprite.userData.drift = 0.3 + random() * 0.55;
    sprite.userData.phase = random() * TAU;
    sprite.userData.spin = (random() - 0.5) * 0.05;
    sprite.userData.weight = 0.09 + random() * 0.13;
    galaxyGroup.add(sprite);
    nebulae.push(sprite);
  }

  /**
   * Near galaxies, built star by star.
   *
   * A sprite is a smudge; at close range the viewer should be able to see that
   * a galaxy is made of individual stars, because that is the fact the whole
   * sequence is building toward. Each is a Points cloud with real arms, a
   * denser core, and a thinner disc further out.
   */
  function buildSpiral(coreColour, armColour, count) {
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const arms = 2 + Math.floor(random() * 3);
    const spin = 3.4 + random() * 2.6;
    const spread = 0.16 + random() * 0.16;
    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      const t = Math.pow(random(), 0.72);
      const arm = Math.floor(random() * arms) / arms;
      const angle = arm * TAU + t * spin + gaussian() * spread;
      const radius = t + gaussian() * 0.02;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = gaussian() * 0.035 * (1.25 - t);
      positions[i3 + 2] = Math.sin(angle) * radius;
      const mix = Math.min(1, Math.pow(t, 0.6));
      for (let c = 0; c < 3; c += 1) {
        colours[i3 + c] = coreColour[c] + (armColour[c] - coreColour[c]) * mix;
      }
    }
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  }

  const spiralMaterial = track(new THREE.PointsMaterial({
    size: 2.1,
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,255,255,0.45)")),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 0,
  }));

  const spirals = [];
  for (let i = 0; i < 9; i += 1) {
    const [coreColour, armColour] = SPIRAL_PAIRS[i % SPIRAL_PAIRS.length];
    const points = new THREE.Points(buildSpiral(coreColour, armColour, 4200), spiralMaterial);
    const angle = random() * TAU;
    const radius = 70 + random() * 380;
    points.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.7,
      -260 - random() * (FIELD_DEPTH - 260),
    );
    points.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    points.scale.setScalar(70 + random() * 150);
    points.frustumCulled = false;
    galaxyGroup.add(points);
    spirals.push(points);
  }

  /* -------------------------------------------------------------- Milky Way */

  /**
   * Our galaxy, to the extent it can be honestly drawn.
   *
   * Distances are in units of the disc radius, so 1.0 is 50,000 light-years.
   * The bar runs across the inner 0.3; the four major arms are logarithmic
   * with a shallow pitch; the Sun sits at 0.52 -- 26,000 light-years -- in the
   * gap between two of them, which is where the Orion Arm actually is.
   */
  const MILKY_WAY_ARMS = 4;
  const MILKY_WAY_SPIN = 4.6;
  const BAR_ANGLE = 0.42;
  const SUN_RADIUS = 0.52;
  const SUN_ANGLE = 0.55 * TAU + SUN_RADIUS * MILKY_WAY_SPIN + 0.42;

  const milkyWay = new THREE.Group();
  milkyWay.visible = false;
  scene.add(milkyWay);

  /*
   * The diffuse disc: one plane, one painted texture, drawn under the stars.
   *
   * The plane is built in XY and laid into the XZ plane to match the star
   * geometry, which puts the disc's thickness on Y. Rendered first and with
   * depth writing off so the point stars always composite over it.
   */
  const discTexture = track(createGalaxyDiscTexture(1024));
  const discGeometry = track(new THREE.PlaneGeometry(2.62, 2.62));

  /*
   * Three sheets, not one.
   *
   * A single painted plane is a painting: tilt the camera and you can see it
   * is a sheet, which is exactly what made the galaxy read as flat. Stacking
   * copies above and below the mid-plane -- offset, slightly rotated, slightly
   * scaled -- gives the disc real thickness. Face-on they superimpose into one
   * image; the moment the shot rolls over, they separate and slide against one
   * another, and the disc becomes a slab of light with things inside it.
   *
   * The offsets match the vertical scatter of the star cloud, so the painted
   * component and the resolved component occupy the same volume. The rotations
   * matter as much as the offsets: identical copies would stack exactly and
   * just look brighter.
   */
  const DISC_LAYERS = [
    { y: -0.022, spin: -0.07, scale: 1.03, weight: 0.3 },
    { y: 0.0, spin: 0.0, scale: 1.0, weight: 0.42 },
    { y: 0.022, spin: 0.07, scale: 0.97, weight: 0.3 },
  ];
  const discLayers = DISC_LAYERS.map((layer) => {
    const material = track(new THREE.MeshBasicMaterial({
      map: discTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }));
    const mesh = new THREE.Mesh(discGeometry, material);
    mesh.rotation.set(-Math.PI / 2, 0, layer.spin);
    mesh.position.y = layer.y;
    mesh.scale.setScalar(layer.scale);
    mesh.renderOrder = -1;
    milkyWay.add(mesh);
    return { material, weight: layer.weight };
  });

  function setDiscOpacity(level) {
    const value = Math.max(0, level);
    for (let i = 0; i < discLayers.length; i += 1) {
      discLayers[i].material.opacity = value * discLayers[i].weight;
    }
  }

  /*
   * The bulge, as a ball.
   *
   * A sprite always faces the camera, which is the whole point of using one
   * here: however far the shot rolls toward the disc plane, the core stays
   * round and keeps sticking up out of it. That single cue does more for the
   * three-dimensionality of the galaxy than anything else -- a real bulge is a
   * sphere of old stars several thousand light-years thick, and if it flattens
   * with the disc the eye immediately reads the whole thing as a decal.
   */
  const bulgeMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,244,214,0.9)", "rgba(255,206,138,0.34)", 0.26)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const mwBulge = new THREE.Sprite(bulgeMaterial);
  mwBulge.scale.setScalar(0.33);
  mwBulge.renderOrder = -1;
  milkyWay.add(mwBulge);

  // A companion, well off the plane. The reference has one, and an object
  // clearly outside the disc is another thing the eye can read depth from.
  const satelliteMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,255,255,0.8)", "rgba(214,228,255,0.34)", 0.24)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const mwSatellite = new THREE.Sprite(satelliteMaterial);
  mwSatellite.position.set(-0.72, 0.46, -0.58);
  mwSatellite.scale.set(0.15, 0.1, 1);
  milkyWay.add(mwSatellite);

  const MW_DISC = 46000;
  const mwPositions = new Float32Array(MW_DISC * 3);
  const mwColours = new Float32Array(MW_DISC * 3);
  for (let i = 0; i < MW_DISC; i += 1) {
    const i3 = i * 3;
    const roll = random();
    if (roll < 0.13) {
      // Bulge: a fat, warm, roughly spherical concentration.
      const r = Math.abs(gaussian()) * 0.075;
      const theta = random() * TAU;
      const phi = Math.acos(2 * random() - 1);
      mwPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
      mwPositions[i3 + 1] = r * Math.cos(phi) * 0.8;
      mwPositions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      mwColours[i3] = 1.0; mwColours[i3 + 1] = 0.76; mwColours[i3 + 2] = 0.44;
    } else if (roll < 0.28) {
      // The bar: elongated, and offset from the arms' handedness.
      const along = (random() * 2 - 1) * 0.31;
      const across = gaussian() * 0.045;
      mwPositions[i3] = along * Math.cos(BAR_ANGLE) - across * Math.sin(BAR_ANGLE);
      mwPositions[i3 + 1] = gaussian() * 0.014;
      mwPositions[i3 + 2] = along * Math.sin(BAR_ANGLE) + across * Math.cos(BAR_ANGLE);
      mwColours[i3] = 1.0; mwColours[i3 + 1] = 0.82; mwColours[i3 + 2] = 0.55;
    } else {
      // The disc and its arms.
      const t = 0.14 + Math.pow(random(), 0.62) * 0.86;
      const arm = Math.floor(random() * MILKY_WAY_ARMS) / MILKY_WAY_ARMS;
      // Arms are over-densities, not walls -- a broad scatter keeps the disc
      // continuous between them, which is what a real galaxy looks like.
      const angle = arm * TAU + t * MILKY_WAY_SPIN + gaussian() * (0.19 + t * 0.1);
      const radius = t + gaussian() * 0.018;
      mwPositions[i3] = Math.cos(angle) * radius;
      /*
       * Thickness, and a warp.
       *
       * The disc is scattered vertically, and beyond about half a radius the
       * whole plane bends -- the Milky Way's outer disc really is warped, bent
       * up on one side and down on the other by the pull of the Magellanic
       * Clouds. It is worth having for its own sake and it is also the single
       * cheapest way to stop a spiral looking like a flat cut-out: once the
       * edges leave the plane there is no plane left to read.
       */
      const warp = Math.sin(angle - 0.6) * Math.pow(Math.max(0, t - 0.45), 2) * 0.34;
      mwPositions[i3 + 1] = gaussian() * 0.028 * (1.25 - t * 0.6) + warp;
      mwPositions[i3 + 2] = Math.sin(angle) * radius;
      // Warm inside, blue-white outward, with scatter so it is not a ramp.
      const mix = Math.min(1, Math.pow(t, 0.75)) * (0.7 + random() * 0.5);
      mwColours[i3] = 1.0 - mix * 0.46;
      mwColours[i3 + 1] = 0.84 - mix * 0.1;
      mwColours[i3 + 2] = 0.46 + mix * 0.54;
    }
  }
  const mwGeometry = track(new THREE.BufferGeometry());
  mwGeometry.setAttribute("position", new THREE.BufferAttribute(mwPositions, 3));
  mwGeometry.setAttribute("color", new THREE.BufferAttribute(mwColours, 3));
  /*
   * Point size is in pixels here, not world units.
   *
   * With size attenuation on, three.js derives the point size from view depth
   * alone and ignores the object's scale -- and this group is scaled by a
   * factor of thousands. Every star came out at about a fifth of a pixel, so
   * the galaxy rendered as a faint smudge with a bright bulge and nothing
   * else. Fixed pixel sizes also happen to be the honest choice: a star is a
   * point source, and its apparent size on a photograph is set by brightness,
   * not by distance.
   */
  const mwMaterial = track(new THREE.PointsMaterial({
    size: px(1.25),
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,236,214,0.4)")),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    opacity: 0,
  }));
  const mwStars = new THREE.Points(mwGeometry, mwMaterial);
  mwStars.frustumCulled = false;
  milkyWay.add(mwStars);

  // Star-forming regions: the pink knots strung along the arms in every real
  // photograph of a spiral. Drawn separately so they can be bigger and hotter.
  const MW_KNOTS = 900;
  const knotPositions = new Float32Array(MW_KNOTS * 3);
  const knotColours = new Float32Array(MW_KNOTS * 3);
  for (let i = 0; i < MW_KNOTS; i += 1) {
    const i3 = i * 3;
    const t = 0.22 + Math.pow(random(), 0.7) * 0.76;
    const arm = Math.floor(random() * MILKY_WAY_ARMS) / MILKY_WAY_ARMS;
    const angle = arm * TAU + t * MILKY_WAY_SPIN + gaussian() * 0.07;
    knotPositions[i3] = Math.cos(angle) * t;
    // Star formation happens in the thin gas layer, so the knots stay much
    // closer to the mid-plane than the stars do -- but they follow the warp.
    knotPositions[i3 + 1] = gaussian() * 0.012
      + Math.sin(angle - 0.6) * Math.pow(Math.max(0, t - 0.45), 2) * 0.34;
    knotPositions[i3 + 2] = Math.sin(angle) * t;
    const hot = random() < 0.42;
    knotColours[i3] = 1.0;
    knotColours[i3 + 1] = hot ? 0.52 : 0.68;
    knotColours[i3 + 2] = hot ? 0.72 : 0.92;
  }
  const knotGeometry = track(new THREE.BufferGeometry());
  knotGeometry.setAttribute("position", new THREE.BufferAttribute(knotPositions, 3));
  knotGeometry.setAttribute("color", new THREE.BufferAttribute(knotColours, 3));
  const knotMaterial = track(new THREE.PointsMaterial({
    size: px(3.6),
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,150,205,0.45)")),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    opacity: 0,
  }));
  const mwKnots = new THREE.Points(knotGeometry, knotMaterial);
  mwKnots.frustumCulled = false;
  milkyWay.add(mwKnots);

  // Globular clusters in the halo -- the oldest things in the galaxy, and the
  // reason it does not read as a flat disc floating in nothing.
  const MW_HALO = 320;
  const haloPositions = new Float32Array(MW_HALO * 3);
  for (let i = 0; i < MW_HALO; i += 1) {
    const i3 = i * 3;
    const r = 0.3 + Math.pow(random(), 0.5) * 1.15;
    const theta = random() * TAU;
    const phi = Math.acos(2 * random() - 1);
    haloPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
    haloPositions[i3 + 1] = r * Math.cos(phi);
    haloPositions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const haloGeometry = track(new THREE.BufferGeometry());
  haloGeometry.setAttribute("position", new THREE.BufferAttribute(haloPositions, 3));
  const haloMaterial = track(new THREE.PointsMaterial({
    size: px(2.8),
    map: track(createGlowTexture("rgba(255,250,238,1)", "rgba(255,222,176,0.4)")),
    color: new THREE.Color(1.0, 0.9, 0.72),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    opacity: 0,
  }));
  const mwHalo = new THREE.Points(haloGeometry, haloMaterial);
  mwHalo.frustumCulled = false;
  milkyWay.add(mwHalo);

  // The Sun's position, and a mark on it. This is the thing the whole
  // sequence has been travelling toward.
  const sunLocal = new THREE.Vector3(
    Math.cos(SUN_ANGLE) * SUN_RADIUS, 0, Math.sin(SUN_ANGLE) * SUN_RADIUS,
  );
  /*
   * The Sun is white.
   *
   * It is a G2V star at 5,778 K, and its spectrum integrates to white -- it
   * only looks yellow from the ground, because the atmosphere scatters the
   * blue out of it. Painting it yellow here also broke the match cut: the
   * intro handed over a yellow star to a solar system that renders a white
   * one. The warmth is kept to the faintest edge of the corona, which is
   * where a little chromatic bloom is honest.
   */
  const sunMarkMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(232,240,255,0.55)", 0.22)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const sunMark = new THREE.Sprite(sunMarkMaterial);
  sunMark.position.copy(sunLocal);
  sunMark.scale.setScalar(0.02);
  milkyWay.add(sunMark);

  const sunWorld = new THREE.Vector3();

  /*
   * The Sun, once it is close enough to be a star rather than a mark.
   *
   * Kept outside the galaxy group on purpose. Inside it, its size would be
   * hostage to a scale that runs into the tens of thousands, and it would have
   * to be un-scaled every frame to stay sane. Out here it is simply an object
   * at a fixed distance in front of the camera that grows -- and because both
   * it and the mark sit dead centre, the hand-off between them is invisible.
   */
  const sunStar = new THREE.Group();
  sunStar.position.set(0, 0, -140);
  sunStar.visible = false;
  scene.add(sunStar);

  const sunCoreMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(240,246,255,0.75)", 0.2)),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const sunCore = new THREE.Sprite(sunCoreMaterial);
  sunCore.renderOrder = 8;
  sunStar.add(sunCore);

  const sunCoronaMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,253,250,0.85)", "rgba(226,232,248,0.3)", 0.28)),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const sunCorona = new THREE.Sprite(sunCoronaMaterial);
  sunCorona.renderOrder = 7;
  sunStar.add(sunCorona);

  // The same flare the detonation uses, tinted warm. A star this close without
  // one reads as a bare disc rather than as something too bright to look at.
  const sunFlareMaterial = track(new THREE.SpriteMaterial({
    map: rayTexture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
    color: new THREE.Color(1.0, 0.99, 0.96),
  }));
  const sunFlare = new THREE.Sprite(sunFlareMaterial);
  sunFlare.renderOrder = 6;
  sunStar.add(sunFlare);

  /**
   * Frames the galaxy.
   *
   * `sunBias` slides what the shot is pointed at: 0 centres the galactic
   * centre, 1 centres the Sun. Every phase that shows the galaxy goes through
   * here, which is the point -- the previous version framed the approach on
   * the galaxy's origin and then the dive on the Sun's position, two entirely
   * different translations, so the cut between them jumped. Running both from
   * one function with a parameter that eases between them turns that jump into
   * a pan.
   */
  function frameMilkyWay(rotX, rotY, rotZ, scale, range, sunBias) {
    milkyWay.rotation.set(rotX, rotY, rotZ);
    milkyWay.scale.setScalar(scale);
    // Solve for the offset from a zeroed position: leaving last frame's
    // translation in place makes the Sun's world position include it, and
    // subtracting it again throws the destination twice as far out.
    milkyWay.position.set(0, 0, 0);
    milkyWay.updateMatrixWorld(true);
    sunWorld.copy(sunLocal).applyMatrix4(milkyWay.matrixWorld);
    milkyWay.position.set(
      -sunWorld.x * sunBias,
      -sunWorld.y * sunBias,
      -sunWorld.z * sunBias - range,
    );
    holdSunMarkSize(range);
  }

  /**
   * Holds the mark at a constant angular size.
   *
   * It is a child of a group whose scale runs from 1,500 to 24,000, so a fixed
   * local scale means it grows by a factor of sixteen while the camera closes
   * on it -- ending as a screen-filling grey wash rather than as a star. Sizing
   * it from its own distance keeps it a point of light throughout, which is
   * what it is: one ordinary star among a hundred billion.
   */
  const SUN_MARK_ANGULAR_SIZE = 0.026;
  function holdSunMarkSize(distance) {
    const groupScale = Math.max(1e-6, milkyWay.scale.x);
    sunMark.scale.setScalar((distance * SUN_MARK_ANGULAR_SIZE) / groupScale);
  }

  /* ----------------------------------------------------------------- run */

  let elapsed = 0;
  let primeFrames = 2;
  // Captured on the first approach frame, so the rush inward starts from
  // wherever the drift actually left our bubble rather than from a constant.
  let approachStartZ = null;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const lerp = THREE.MathUtils.lerp;

  function driftField(step) {
    const attribute = dustGeometry.attributes.position;
    for (let i = 0; i < DUST_COUNT; i += 1) {
      const zi = i * 3 + 2;
      attribute.array[zi] += step;
      if (attribute.array[zi] > 40) attribute.array[zi] -= FIELD_DEPTH;
    }
    attribute.needsUpdate = true;
    galaxySprites.forEach((sprite) => {
      sprite.position.z += step * 0.6;
      if (sprite.position.z > 60) sprite.position.z -= FIELD_DEPTH;
    });
    spirals.forEach((points) => {
      points.position.z += step * 0.5;
      points.rotation.y += step * 0.00012;
      if (points.position.z > 140) points.position.z -= FIELD_DEPTH;
    });
    // Clouds are nearer than the galaxies behind them and pass faster, which
    // is the parallax that makes the shot read as movement through a volume
    // rather than movement of a backdrop.
    nebulae.forEach((sprite) => {
      sprite.position.z += step * (0.8 + sprite.userData.drift);
      sprite.material.rotation += step * sprite.userData.spin * 0.0004;
      if (sprite.position.z > 220) sprite.position.z -= FIELD_DEPTH;
    });
  }

  /**
   * Fades the cloud field, each cloud breathing on its own cycle.
   *
   * The `level` is the overall strength; the sine is per-cloud, so parts of
   * the field brighten while others dim and it never looks like one object
   * being faded.
   */
  function setNebulaLevel(level, time) {
    for (let i = 0; i < nebulae.length; i += 1) {
      const sprite = nebulae[i];
      const breath = 0.72 + Math.sin(time * 0.22 + sprite.userData.phase) * 0.28;
      sprite.material.opacity = Math.max(0, level) * sprite.userData.weight * breath;
    }
  }

  /** Returns overall progress 0..1; 1 means finished. */
  function update(deltaSeconds) {
    /*
     * First two frames: show the heavy objects once, at nothing, so their
     * buffers and textures are uploaded to the GPU during the burst -- when
     * the frame is dominated by the flash anyway -- rather than at the moment
     * they are supposed to appear, which is where the hitch would be seen.
     */
    if (primeFrames > 0) {
      primeFrames -= 1;
      galaxyGroup.visible = true;
      milkyWay.visible = true;
      milkyWay.scale.setScalar(0.0001);
      milkyWay.position.set(0, 0, -30000);
      if (primeFrames === 0) {
        galaxyGroup.visible = false;
        milkyWay.visible = false;
      }
    }

    elapsed += deltaSeconds * 1000;
    dustMaterial.uniforms.uTime.value += deltaSeconds;
    const seconds = elapsed / 1000;
    const total = phaseTotal();
    const T = INTRO_TIMING;
    bubbles.forEach((bubble) => { bubble.rimMaterial.uniforms.uPhase.value += deltaSeconds * 0.55; });

    let mark = T.detonation;
    if (elapsed <= mark) {
      showCaption("detonation");
      const t = clamp01(elapsed / T.detonation);
      const out = easeOutCubic(t);

      // Dust is the primordial matter, thrown from the same point.
      const attribute = dustGeometry.attributes.position;
      for (let i = 0; i < DUST_COUNT; i += 1) {
        const i3 = i * 3;
        attribute.array[i3] = dustOrigin[i3] + (dustTarget[i3] - dustOrigin[i3]) * out;
        attribute.array[i3 + 1] = dustOrigin[i3 + 1] + (dustTarget[i3 + 1] - dustOrigin[i3 + 1]) * out;
        attribute.array[i3 + 2] = dustOrigin[i3 + 2] + (dustTarget[i3 + 2] - dustOrigin[i3 + 2]) * out;
      }
      attribute.needsUpdate = true;
      dustMaterial.uniforms.uOpacity.value = Math.min(1, t * 2.4);

      /*
       * The light curve.
       *
       * A detonation is over in a fraction of a second and then keeps
       * glowing; holding the frame white for a third of the phase, which is
       * what a linear fade did, reads as a lamp being switched on. The
       * exponential is the shape an actual flash has: effectively gone by
       * t = 0.4, with a long dim tail after it.
       *
       * These draw with depthTest off and on top, so they wash across the
       * ejecta. Behind it, the rock was silhouetted against the flash instead
       * of being lit by it.
       */
      const flash = Math.exp(-t * 7.5);
      coreMaterial.opacity = Math.min(1, flash * 1.6);
      core.scale.setScalar(4 + easeOutCubic(Math.min(1, t * 3.4)) * 42);

      // Rays: fastest to appear, first to go, counter-rotating as they spread.
      rays.forEach((sprite, index) => {
        const local = clamp01((t - index * 0.04) * 2.6);
        sprite.material.opacity = Math.exp(-t * (index === 0 ? 5.2 : 4.0)) * (index === 0 ? 1 : 0.62);
        sprite.scale.setScalar(6 + easeOutCubic(local) * (index === 0 ? 150 : 240));
        sprite.material.rotation += deltaSeconds * (index === 0 ? 0.22 : -0.15);
      });

      // Shockwaves: three fronts, staggered, each thinning as it expands.
      shockwaves.forEach(({ mesh, material, delay }) => {
        const local = clamp01((t - delay) / Math.max(0.05, 1 - delay));
        const radius = easeOutCubic(local) * 190;
        mesh.scale.setScalar(Math.max(0.001, radius));
        material.opacity = local <= 0 ? 0 : Math.pow(1 - local, 2.4) * 0.7;
      });

      // Rock, thrown outward and tumbling. It keeps travelling after the light
      // has gone, which is what sells the burst as an event with mass in it.
      layOutDebris(t * 1.15, t * 2.4, Math.min(1, t * 5));
      blastLight.intensity = Math.pow(1 - t, 1.2) * 3400;
      blastLight.distance = 400 + t * 3200;

      // Cold haze blooming behind the light.
      /*
       * Growth is written from t, not compounded per frame.
       *
       * Multiplying the scale every frame is a geometric series -- it looked
       * right for half a second and then filled the entire frame with white
       * haze, which is what buried the burst on the first pass. Solving from
       * elapsed time bounds it, and makes it frame-rate independent as well.
       */
      haze.forEach((sprite) => {
        sprite.material.opacity = Math.sin(clamp01(t * 1.15) * Math.PI) * 0.3;
        sprite.scale.setScalar(sprite.userData.base * (1 + t * sprite.userData.drift));
      });

      bubbles.forEach((bubble) => setBubbleOpacity(bubble, 0));
      setBubbleDetail(ours, 0.1);
      return elapsed / total;
    }

    // Everything from the blast decays over the first stretch of the drift.
    const sinceBlast = (elapsed - T.detonation) / 1400;
    if (sinceBlast < 1) {
      const fade = 1 - sinceBlast;
      coreMaterial.opacity = 0;
      rays.forEach((sprite) => { sprite.material.opacity = 0; });
      shockwaves.forEach(({ material }) => { material.opacity = 0; });
      haze.forEach((sprite) => { sprite.material.opacity *= fade; });
      blastLight.intensity = Math.pow(fade, 2) * 900;
      layOutDebris(1.15 + (1 - fade) * 1.9, 2.4 + (1 - fade) * 2, fade);
    } else if (blast.visible) {
      blast.visible = false;
      blastLight.intensity = 0;
    }

    mark += T.multiverse;
    if (elapsed <= mark) {
      showCaption("multiverse");
      // Drifting among vast, dim shells. Galaxies are not yet resolvable.
      const local = (elapsed - T.detonation) / T.multiverse;
      driftField(lerp(70, 150, local) * deltaSeconds);
      const rising = Math.min(1, local * 3);
      // Ours closes slowly and never recycles: it is the destination, and the
      // approach that follows has to start from wherever it has got to.
      ours.group.position.z += 90 * deltaSeconds;
      ours.group.rotation.y += deltaSeconds * 0.05;
      setBubbleOpacity(ours, 0.8 * rising);
      setBubbleDetail(ours, 0.1);
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        // Fast enough that several actually sweep past the camera during the
        // phase, rather than the whole field merely swelling in place.
        driftBubble(bubble, lerp(190, 470, local) * deltaSeconds);
        bubble.group.rotation.y += deltaSeconds * 0.05;
        /*
         * Retired before the phase is over, not after.
         *
         * The dive that follows goes inside one universe, and a neighbour
         * still lingering at the edge of frame while that happens reads as a
         * second universe appearing out of nowhere -- which is exactly what it
         * looked like. Clearing them in the last fifth of the drift means the
         * approach begins on a frame that already holds nothing but ours.
         */
        const retiring = clamp01((1 - local) / 0.2);
        setBubbleOpacity(bubble, 0.85 * rising * retiring * bubbleJourneyFade(bubble));
      });
      dust.rotation.z += deltaSeconds * 0.014;
      return elapsed / total;
    }

    mark += T.approach;
    if (elapsed <= mark) {
      showCaption("approach");
      // One bubble swells until the camera passes through its wall.
      const local = (elapsed - T.detonation - T.multiverse) / T.approach;
      const eased = easeInOutSine(local);
      driftField(lerp(150, 340, eased) * deltaSeconds);
      if (approachStartZ === null) approachStartZ = ours.group.position.z;
      ours.group.position.z = lerp(approachStartZ, 360, eased);
      const swell = lerp(620, 4600, eased);
      ours.group.scale.setScalar(swell);
      ours.group.rotation.y += deltaSeconds * 0.06;
      // Stars come in as fast as the surface they sit on grows, so the
      // density on screen stays put while the bubble goes from a dot to a sky.
      setBubbleDetail(ours, lerp(0.1, 1, easeInCubic(local)));
      setBubbleOpacity(ours, lerp(0.8, 0.95, eased));
      /*
       * Clear the field before the dive, not during it.
       *
       * Once ours has been chosen the others are scenery, and a bubble still
       * lingering while the camera is going inside another one reads as a
       * second universe turning up out of nowhere. They are gone inside the
       * first fifth of the phase, and they no longer recycle -- nothing may
       * arrive from the far end once the destination is set.
       */
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        setBubbleOpacity(bubble, 0);
      });
      // Galaxies resolve out of the haze as we cross the wall.
      galaxyGroup.visible = true;
      const reveal = clamp01((eased - 0.4) * 1.7);
      galaxySprites.forEach((sprite) => { sprite.material.opacity = reveal * 0.85; });
      spiralMaterial.opacity = reveal * 0.9;
      setNebulaLevel(reveal, seconds);
      dust.rotation.z += deltaSeconds * 0.02;
      return elapsed / total;
    }

    mark += T.galaxies;
    if (elapsed <= mark) {
      showCaption("galaxies");
      const local = 1 - (mark - elapsed) / T.galaxies;
      setBubbleOpacity(ours, Math.max(0, 0.95 * (1 - local * 2.6)));
      bubbles.forEach((bubble, index) => { if (index > 0) setBubbleOpacity(bubble, 0); });
      driftField(lerp(360, 640, easeInOutSine(Math.min(1, local * 1.3))) * deltaSeconds);
      galaxySprites.forEach((sprite) => {
        sprite.material.opacity = 0.62 + Math.sin((local + sprite.position.x) * 2.2) * 0.22;
      });
      spiralMaterial.opacity = 0.95;
      spirals.forEach((points) => { points.rotation.y += deltaSeconds * 0.04; });
      setNebulaLevel(Math.min(1, local * 2.5), seconds);
      dust.rotation.z += deltaSeconds * 0.04;

      // Our galaxy resolves out of the field in the last third, so the next
      // act begins with it already present rather than cutting to it.
      const rise = clamp01((local - 0.62) / 0.38);
      if (rise > 0) {
        milkyWay.visible = true;
        frameMilkyWay(-1.16, 0.4, 0.22, 1500, lerp(9000, 5600, rise), 0);
        setDiscOpacity(rise * 0.72);
        bulgeMaterial.opacity = rise * 0.5;
        satelliteMaterial.opacity = rise * 0.35;
        mwMaterial.opacity = rise * 0.2;
        knotMaterial.opacity = rise * 0.14;
        haloMaterial.opacity = rise * 0.2;
      }
      return elapsed / total;
    }

    mark += T.milkyWay;
    if (elapsed <= mark) {
      showCaption("milkyWay");
      const local = 1 - (mark - elapsed) / T.milkyWay;
      const eased = easeInOutSine(local);
      // Everything else falls away: from here there is only one galaxy.
      const recede = clamp01(1 - local * 1.8);
      galaxySprites.forEach((sprite) => { sprite.material.opacity = recede * 0.7; });
      spiralMaterial.opacity = recede * 0.9;
      setNebulaLevel(recede, seconds);
      driftField(lerp(640, 200, easeOutCubic(local)) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(1, 0.5, eased);

      milkyWay.visible = true;
      /*
       * The pan.
       *
       * The first half holds the galaxy centred and simply closes on it. The
       * second half slides the aim off the core and onto the Sun, so by the
       * time the dive begins the camera is already pointed where it is going.
       * That ramp is the whole fix for the jump: the dive now starts from the
       * exact framing this phase ends on.
       */
      const aim = easeInOutSine(clamp01((local - 0.42) / 0.58));
      frameMilkyWay(
        lerp(-1.16, -0.94, eased),
        lerp(0.4, 0.16, eased),
        lerp(0.22, 0.08, eased),
        lerp(1500, 1780, eased),
        lerp(5600, 3150, eased),
        aim,
      );
      setDiscOpacity(lerp(0.72, 1.25, clamp01(local * 2)));
      bulgeMaterial.opacity = lerp(0.5, 1.0, clamp01(local * 2));
      satelliteMaterial.opacity = lerp(0.35, 0.6, clamp01(local * 2));
      mwMaterial.opacity = lerp(0.2, 0.42, clamp01(local * 2));
      knotMaterial.opacity = lerp(0.14, 0.46, clamp01(local * 2));
      haloMaterial.opacity = lerp(0.2, 0.42, clamp01(local * 2));
      sunMarkMaterial.opacity = clamp01((local - 0.45) / 0.55) * 0.9;
      return elapsed / total;
    }

    mark += T.orionArm;
    if (elapsed <= mark) {
      showCaption("orionArm");
      const local = 1 - (mark - elapsed) / T.orionArm;
      const eased = easeInCubic(clamp01(local));
      galaxySprites.forEach((sprite) => { sprite.material.opacity = 0; });
      spiralMaterial.opacity = 0;
      setNebulaLevel(0, seconds);
      // Local stars streaming past, the only cue that the camera is moving
      // once the galaxy fills the frame.
      driftField(lerp(200, 1500, eased) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(0.5, 0.9, eased);

      /*
       * The dive. Continues exactly where the pan left off -- same rotation,
       * same scale, same aim -- and drives the range in from 2,600 units to
       * 90, which is what carries the camera down into the disc.
       */
      frameMilkyWay(
        lerp(-0.94, -0.32, eased),
        lerp(0.16, -0.22, eased),
        lerp(0.08, 0.02, eased),
        lerp(1780, 15000, eased),
        lerp(3150, 90, eased),
        1,
      );

      // The painted disc is a flat plane; edge-on it is worth nothing, and
      // from inside the disc there is no face-on view to have. It retires and
      // the stars carry the shot.
      setDiscOpacity(lerp(1.25, 0, clamp01(local * 1.7)));
      bulgeMaterial.opacity = lerp(1.0, 0, clamp01(local * 1.4));
      satelliteMaterial.opacity = lerp(0.6, 0, clamp01(local * 1.2));
      mwMaterial.size = px(lerp(1.25, 3.4, eased));
      mwMaterial.opacity = lerp(0.42, 1, clamp01(local * 1.6));
      knotMaterial.opacity = lerp(0.46, 0.24, eased);
      haloMaterial.opacity = lerp(0.42, 0, eased);
      sunMarkMaterial.opacity = 0.9;
      return elapsed / total;
    }

    mark += T.sunApproach;
    if (elapsed <= mark) {
      showCaption("sunApproach");
      const local = 1 - (mark - elapsed) / T.sunApproach;
      const eased = easeInOutSine(local);

      /*
       * The last leg: one star, growing.
       *
       * The mark inside the galaxy hands over to a real star in the first
       * quarter. Both are dead centre and both are a warm glow, so there is no
       * frame on which the swap can be seen -- and from here the object can be
       * grown freely without dragging a galaxy scaled by fifteen thousand
       * along with it.
       */
      milkyWay.visible = true;
      frameMilkyWay(
        lerp(-0.32, -0.24, eased),
        lerp(-0.22, -0.3, eased),
        0.02,
        lerp(15000, 19000, eased),
        90,
        1,
      );
      const settle = clamp01((local - 0.05) / 0.35);
      sunMarkMaterial.opacity = 0.9 * (1 - settle);
      // The band of the galaxy dims behind it as the star takes the frame.
      mwMaterial.opacity = lerp(1, 0.42, eased);
      knotMaterial.opacity = lerp(0.24, 0.1, eased);

      driftField(lerp(1500, 240, easeOutCubic(local)) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(0.9, 0.55, eased);

      sunStar.visible = true;
      const grow = easeInCubic(local);
      const breath = 1 + Math.sin(seconds * 2.1) * 0.018;
      sunCore.scale.setScalar(lerp(1.4, 30, grow) * breath);
      sunCorona.scale.setScalar(lerp(3.4, 96, grow) * breath);
      sunFlare.scale.setScalar(lerp(6, 190, grow));
      sunFlareMaterial.rotation += deltaSeconds * 0.05;
      sunCoreMaterial.opacity = settle;
      sunCoronaMaterial.opacity = settle * 0.72;
      sunFlareMaterial.opacity = settle * lerp(0.2, 0.62, grow);
      return elapsed / total;
    }

    /*
     * Arrival: a match cut on the Sun.
     *
     * Everything except the star fades, and the star itself eases back to
     * roughly the size it has in the view that follows. The solar system opens
     * on the Sun centred and bright, so cutting on the same shape in the same
     * place makes the two scenes read as one continuous move rather than as a
     * transition.
     */
    showCaption("arrive");
    const local = clamp01(1 - (total - elapsed) / T.arrive);
    // Everything that is not the star is gone by a third of the way in, so the
    // bloom happens against nothing.
    const fade = Math.max(0, 1 - local * 3);
    driftField(lerp(240, 0, easeOutCubic(local)) * deltaSeconds);
    dustMaterial.uniforms.uOpacity.value = fade * 0.55;
    setDiscOpacity(0);
    bulgeMaterial.opacity = 0;
    satelliteMaterial.opacity = 0;
    mwMaterial.opacity = fade * 0.42;
    knotMaterial.opacity = fade * 0.1;
    haloMaterial.opacity = 0;
    sunMarkMaterial.opacity = 0;
    setNebulaLevel(0, seconds);
    frameMilkyWay(-0.24, -0.3, 0.02, 19000, 90, 1);

    /*
     * The flare.
     *
     * This was a match cut -- the star eased *down* to the size the Sun has in
     * the view that follows, so the two frames were nearly the same image. It
     * was defensible and it was wrong: it left the sequence ending on a small
     * star held on black, a lull exactly where the payoff belongs, and it read
     * as "a shiny star, and then, later, the solar system".
     *
     * So the last beat is the star going up instead. It blooms until it fills
     * the frame, the overlay carries that white across the scene change, and
     * when the light clears the system is simply already there -- with no
     * object to look at in between.
     *
     * Cubed, so almost all of the growth lands in the final third: the star
     * holds, then goes. A linear bloom reads as a zoom, not as a flare.
     */
    sunStar.visible = true;
    const flare = easeInCubic(local);
    sunCore.scale.setScalar(lerp(30, 520, flare));
    sunCorona.scale.setScalar(lerp(96, 1250, flare));
    sunFlare.scale.setScalar(lerp(190, 900, flare));
    sunCoreMaterial.opacity = 1;
    sunCoronaMaterial.opacity = lerp(0.72, 1, flare);
    sunFlareMaterial.opacity = lerp(0.62, 0.9, clamp01(local * 2)) * (1 - flare * 0.5);
    dust.rotation.z += deltaSeconds * 0.04 * fade;
    return Math.min(1, elapsed / total);
  }

  function resize(width, height) {
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    // Point size is solved against the drawing buffer, so it has to follow it.
    dustMaterial.uniforms.uScale.value = Math.max(1, height) * dpr * 0.5;
  }

  function dispose() {
    caption.remove();
    // Collect first, then detach. Removing objects during traverse() corrupts
    // the children array mid-walk and throws -- which, because this runs inside
    // the render loop, previously killed the loop and left a black screen.
    const objects = [];
    scene.traverse((object) => { if (object !== scene) objects.push(object); });
    objects.forEach((object) => object.removeFromParent?.());
    disposables.forEach((resource) => resource.dispose?.());
    disposables.length = 0;
    scene.clear();
  }

  return { scene, camera, update, resize, dispose, get durationMs() { return phaseTotal(); } };
}

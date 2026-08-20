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
 *   detonation  the burst -- a fireball of plasma, its core, and its rays
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
  detonation: 12000,
  multiverse: 11000,
  approach: 6400,
  galaxies: 12000,
  milkyWay: 11000,
  orionArm: 6800,
  sunApproach: 6600,
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
/**
 * The captions.
 *
 * Short, plain, factual -- and now several per act rather than one.
 *
 * A single paragraph held for eight seconds is read in two and then sits
 * there; the viewer finishes it and waits. A sequence of one-line thoughts,
 * cross-faded, gives the act a pulse: you finish a line, the shot moves, and
 * the next thought arrives. Every line has to survive being read once, at a
 * glance, while the frame is moving -- so nothing here is longer than it needs
 * to be, and nothing is decorative.
 *
 * The number of lines is set by how long the act runs, not by how much there
 * is to say. Roughly three seconds a line is the floor for comfortable
 * reading.
 */
const CAPTIONS = {
  detonation: {
    title: "The Big Bang",
    lines: [
      "Not an explosion in space. Space itself, expanding.",
      "Smaller than an atom to larger than a galaxy, in less than a second.",
      "Then a fog of plasma, too hot for atoms, for 380,000 years.",
    ],
  },
  multiverse: {
    title: "The Multiverse",
    lines: [
      "That expansion may never have stopped.",
      "Where it did, a bubble cooled — and became a universe.",
      "Each one with its own stars, its own galaxies, perhaps its own physics.",
    ],
  },
  approach: {
    title: "Our Universe",
    lines: [
      "This is the bubble we cooled into.",
      "13.8 billion years old, 93 billion light-years across — and still growing.",
    ],
  },
  galaxies: {
    title: "Two Trillion Galaxies",
    lines: [
      "Every mote of light here is an island of a hundred billion stars.",
      "Spirals, starbursts, collisions — no two of them alike.",
      "The dust between them is older than any of the stars in it.",
    ],
  },
  milkyWay: {
    title: "The Milky Way",
    lines: [
      "A barred spiral, a hundred thousand light-years across.",
      "Four great arms, wound around a bar of ancient stars.",
      "Ours.",
    ],
  },
  orionArm: {
    title: "The Orion Arm",
    lines: [
      "26,000 light-years from the centre, on the inner rim of a minor arm.",
      "Between Perseus and Carina–Sagittarius. Nowhere special.",
    ],
  },
  sunApproach: {
    title: "Our Star",
    lines: [
      "A G-type main-sequence star, 4.6 billion years old.",
      "It holds 99.86% of the mass here. Everything else is the rest.",
    ],
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
 * A distant galaxy.
 *
 * A radial gradient is a ball, and a sky full of balls is a sky full of
 * bokeh -- which is exactly what the far field looked like once these were
 * allowed anywhere near the camera. A galaxy too far away to resolve is still
 * not round: it is an ellipse with a bright nucleus, usually with a hint of a
 * disc round it, and often seen at an angle. Painted once, tinted per sprite,
 * and squashed and rotated on placement.
 */
function createDistantGalaxyTexture() {
  const size = 128;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.translate(half, half);
  context.globalCompositeOperation = "lighter";

  const ellipse = (rx, ry, alpha, inner) => {
    context.save();
    context.scale(1, ry / rx);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, rx);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(inner, `rgba(255,255,255,${(alpha * 0.34).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, rx, 0, TAU);
    context.fill();
    context.restore();
  };

  ellipse(half * 0.92, half * 0.40, 0.16, 0.42);   // the disc
  ellipse(half * 0.46, half * 0.24, 0.30, 0.40);   // the inner disc
  ellipse(half * 0.14, half * 0.11, 0.95, 0.45);   // the nucleus

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A diffraction spike.
 *
 * In every deep exposure the brightest stars wear a cross. It is not a
 * property of the star -- it is the telescope's secondary-mirror vanes
 * diffracting the light -- but that is exactly why it belongs here: the cross
 * is the visual signature of "this was photographed", and a field of plain
 * round dots reads as a particle system no matter how many dots it has. Four
 * long spikes with a fainter pair between them, which is roughly what Hubble's
 * optics produce.
 */
function createSpikeTexture() {
  const size = 256;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.translate(half, half);
  context.globalCompositeOperation = "lighter";

  const spike = (angle, length, width, alpha) => {
    const gradient = context.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.12, `rgba(255,255,255,${(alpha * 0.5).toFixed(3)})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
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
  };

  for (let i = 0; i < 4; i += 1) spike(i * (Math.PI / 2), half * 0.94, 2.6, 0.85);
  for (let i = 0; i < 4; i += 1) {
    spike(Math.PI / 4 + i * (Math.PI / 2), half * 0.42, 1.6, 0.3);
  }
  const core = context.createRadialGradient(0, 0, 0, 0, 0, half * 0.22);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.42, "rgba(255,255,255,0.72)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, half * 0.22, 0, TAU);
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

  /*
   * Round lobes sum to a round cloud.
   *
   * Nine circles inside a disc is still, at a distance, a disc -- and a sky
   * full of them reads as lens bokeh, which is precisely what the travelling
   * shot looked like once these were allowed anywhere near the camera. Real
   * nebulosity is anisotropic at every scale: it has a long axis, it frays,
   * and it is threaded with filaments finer than its body. So each lobe is now
   * an ellipse with its own aspect and angle, and a set of thin drawn
   * filaments goes over the top -- the smallest structure in the cloud, which
   * is what stops the eye resolving it as one soft shape.
   */
  const lobes = 9 + Math.floor(random() * 5);
  for (let i = 0; i < lobes; i += 1) {
    const radius = size * (0.11 + random() * 0.28);
    // Kept inside a disc so the lobes never clip the edge of the canvas,
    // which would show as a straight line across the cloud.
    const angle = random() * Math.PI * 2;
    const offset = random() * (size * 0.5 - radius);
    const x = size / 2 + Math.cos(angle) * offset;
    const y = size / 2 + Math.sin(angle) * offset;
    const aspect = 0.28 + random() * 0.6;
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.scale(1, aspect);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${(0.15 + random() * 0.2).toFixed(3)})`);
    gradient.addColorStop(0.5, "rgba(255,255,255,0.055)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // Filaments: a few dozen short, thin, curved strokes.
  context.lineCap = "round";
  for (let i = 0; i < 34; i += 1) {
    const a = random() * Math.PI * 2;
    const off = random() * size * 0.34;
    const x = size / 2 + Math.cos(a) * off;
    const y = size / 2 + Math.sin(a) * off;
    const dir = random() * Math.PI * 2;
    const len = size * (0.08 + random() * 0.26);
    const bend = (random() - 0.5) * len * 0.8;
    context.strokeStyle = `rgba(255,255,255,${(0.04 + random() * 0.07).toFixed(3)})`;
    context.lineWidth = 1 + random() * 4;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(
      x + Math.cos(dir) * len * 0.5 - Math.sin(dir) * bend,
      y + Math.sin(dir) * len * 0.5 + Math.cos(dir) * bend,
      x + Math.cos(dir) * len,
      y + Math.sin(dir) * len,
    );
    context.stroke();
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
/*
 * How defined each arm is, along its own length.
 *
 * Four arms of equal weight running unbroken from the bar to the rim is a
 * pinwheel. In the reference no two arms are alike and not one of them is
 * even: one is heavy and traceable the whole way round, one is crisp until
 * about half a radius and then dissolves, one is bright near the bar, breaks
 * up completely across the middle of the disc and re-forms further out, and
 * one is never more than a faint over-density anywhere. All four are at their
 * most concrete around the middle of the disc -- close in, the bulge swamps
 * them; out at the rim they run out of gas.
 *
 * `armStrength` returns 0..1 and is the single control for all of that.
 * Everything that follows an arm multiplies by it -- painted arm alpha, the
 * dust lanes, the HII knots, the nebulae, and the important one: the
 * probability that a disc star joins the arm at all rather than staying in
 * the smooth disc between them. The painted texture and the point cloud both
 * call it, so the two components agree about which arm is which.
 */
const ARM_SHAPE = [
  // base level, then lobes of [centre, width, weight] along t: 0 at the bar, 1 at the rim
  { base: 0.20, lobes: [[0.42, 0.30, 0.80], [0.86, 0.30, 0.62]] }, // carries to the rim
  { base: 0.08, lobes: [[0.38, 0.26, 0.92]] },                     // dissolves past mid-disc
  { base: 0.05, lobes: [[0.28, 0.13, 0.86], [0.80, 0.20, 0.72]] }, // breaks in the middle
  { base: 0.09, lobes: [[0.55, 0.34, 0.30]] },                     // faint the whole way
];

function armStrength(arm, t) {
  const shape = ARM_SHAPE[((arm % ARM_SHAPE.length) + ARM_SHAPE.length) % ARM_SHAPE.length];
  let s = shape.base;
  for (let i = 0; i < shape.lobes.length; i += 1) {
    const lobe = shape.lobes[i];
    const d = (t - lobe[0]) / lobe[1];
    s += lobe[2] * Math.exp(-d * d);
  }
  // Definition peaks mid-disc for every arm, whatever its own profile says.
  const mid = Math.exp(-(((t - 0.54) / 0.44) ** 2) * 0.85);
  s *= 0.34 + 0.66 * mid;
  return s < 0 ? 0 : s > 1 ? 1 : s;
}

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
  /*
   * How far an arm wraps, in radians, from the bar to the rim.
   *
   * At 4.6 an arm turns only three quarters of the way round the galaxy, so
   * successive windings never meet and the disc reads as four wide open
   * ribbons with dark voids between them. Both references wrap about one and a
   * half turns, which is what closes the gaps: the arms overlap in radius, and
   * the eye sees a continuous textured disc rather than a pinwheel.
   *
   * The point cloud uses the same figure, so the painted arms and the resolved
   * stars stay registered.
   */
  const SPIN = 9.5;
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

  /*
   * ---- the dust the galaxy sits in
   *
   * The disc does not end. In the reference it is wrapped in a cold, faintly
   * lit haze that reaches most of a radius past the last arm -- the galaxy's
   * own dust, scattering the light of a hundred billion stars back at the
   * camera. Without it the galaxy is a decal on a black card, which is most
   * of what made the old version read as a drawing. Painted first, so
   * everything else lands on top of it, and broken up with irregular patches
   * so the outline is never a circle.
   */
  /*
   * And it is not blue.
   *
   * Interstellar dust is lit by whatever is nearest: hot young stars make it
   * glow pink, the general starlight of the disc scatters violet out of it,
   * and the thick cold parts simply redden everything behind them to brown.
   * A uniformly blue envelope is the one colour it is never all of -- that is
   * reflection nebulosity alone, and it is only part of the mix.
   */
  const envelope = context.createRadialGradient(0, 0, R * 0.42, 0, 0, R * 1.26);
  envelope.addColorStop(0, "rgba(112,84,116,0.115)");
  envelope.addColorStop(0.4, "rgba(94,72,104,0.085)");
  envelope.addColorStop(0.72, "rgba(66,54,80,0.045)");
  envelope.addColorStop(1, "rgba(34,30,52,0)");
  context.fillStyle = envelope;
  context.beginPath();
  context.arc(0, 0, R * 1.26, 0, TAU);
  context.fill();
  for (let i = 0; i < 30; i += 1) {
    const angle = random() * TAU;
    const r = R * (0.82 + Math.pow(random(), 0.8) * 0.4);
    blob(Math.cos(angle) * r, Math.sin(angle) * r,
      R * (0.11 + random() * 0.2),
      (() => {
        const tone = random();
        return tone < 0.34 ? "132,78,118"        // pink-violet
          : tone < 0.62 ? "118,86,72"            // warm brown
            : tone < 0.85 ? "88,74,124"          // dusty purple
              : "64,84,126";                     // the blue that was all of it
      })(),
      0.028 + random() * 0.03);
  }

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
  disc.addColorStop(0, "rgba(232,212,180,0.34)");
  disc.addColorStop(0.16, "rgba(206,198,192,0.27)");
  disc.addColorStop(0.34, "rgba(178,188,208,0.23)");
  disc.addColorStop(0.55, "rgba(158,176,206,0.21)");
  disc.addColorStop(0.8, "rgba(134,152,190,0.14)");
  disc.addColorStop(1, "rgba(96,120,166,0)");
  context.fillStyle = disc;
  context.beginPath();
  context.arc(0, 0, R, 0, TAU);
  context.fill();

  /*
   * ---- arms: broad cool base
   *
   * The alpha is the arm's own profile, not a constant. Where `armStrength`
   * has fallen away the pass still lays a trace of light down -- a real disc
   * is never empty between the arms -- but there is no ridge to see, so the
   * arm simply stops being an arm for that stretch and the eye reads a break.
   */
  alongArms(210, 0.10, 1.0, 0.16, 0, (x, y, t, arm) => {
    const width = R * (0.055 + t * 0.115) * (0.7 + 0.5 * armStrength(arm, t));
    const fade = Math.pow(Math.sin(Math.min(1, (t - 0.1) / 0.9) * Math.PI), 0.45);
    blob(x, y, width, "170,190,222", 0.07 * fade * (0.30 + 1.05 * armStrength(arm, t)));
  });

  // ---- arms: narrow bright ridge, which is the part that vanishes entirely
  alongArms(230, 0.13, 0.97, 0.05, 0.06, (x, y, t, arm) => {
    const width = R * (0.020 + t * 0.045);
    const fade = Math.pow(Math.sin(Math.min(1, (t - 0.13) / 0.84) * Math.PI), 0.5);
    blob(x, y, width, "216,230,250", 0.056 * fade * (0.10 + 1.30 * armStrength(arm, t)));
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
  for (let i = 0; i < 52; i += 1) {
    const armIndex = Math.floor(random() * ARMS);
    const launch = 0.24 + random() * 0.62;
    // A spur only exists where its parent arm does.
    if (random() > armStrength(armIndex, launch)) continue;
    const lean = (random() - 0.5) * 0.9;
    const reach = 0.09 + random() * 0.2;
    const steps = 26;
    for (let k = 0; k <= steps; k += 1) {
      const u = k / steps;
      const t = launch + reach * u;
      if (t > 1.02) break;
      const angle = (armIndex / ARMS) * TAU + t * SPIN + 0.06 + lean * u * 0.7;
      const r = t * R;
      const width = R * (0.012 + t * 0.03) * (1 - u * 0.55);
      blob(Math.cos(angle) * r, Math.sin(angle) * r, width,
        "196,214,244", 0.05 * Math.sin(u * Math.PI) ** 0.5);
    }
  }

  /*
   * The core: a glow, not a shape.
   *
   * This was a circle scaled to a third of its height and filled with a
   * gradient -- which gives a hard elliptical edge where the gradient's last
   * stop meets the clip, and at the centre of a galaxy that edge reads as a
   * box. The reference has no edge anywhere near the middle: it is a bright
   * cream sphere whose light simply runs out, with the bar visible only as a
   * slight elongation inside it.
   *
   * So the bar is now a chain of soft blobs laid along its axis whose radius
   * tapers to nothing at the ends -- a lens, with no boundary to see -- and
   * the bulge on top of it is four concentric passes, brightest and whitest at
   * the very centre. Overlapping soft-edged circles cannot produce a straight
   * line, which is the entire point.
   */
  /*
   * The bar is a structure, not a thickening of the bulge.
   *
   * In the reference it is unmistakable: a clean tan lens of old stars running
   * straight out of the nucleus, about three times as long as the bright core
   * is wide, and its two ends are exactly where the spiral arms begin. That
   * straightness is the point -- everything else in a galaxy is scattered or
   * curved, so a single linear feature through the middle reads instantly, and
   * it is what tells the eye the arms are being fed from somewhere rather than
   * just wound round a blob.
   *
   * So: narrower than before, longer, and browner. Painted as a chain of soft
   * blobs whose radius closes to nothing at both ends, which gives the lens
   * its shape without ever drawing an edge, plus a tighter, brighter spine
   * down the middle of it.
   */
  const BAR_LENGTH = 0.32;
  const barBlobs = 70;
  for (let i = 0; i <= barBlobs; i += 1) {
    const u = (i / barBlobs) * 2 - 1;               // -1 .. 1 along the bar
    const taper = Math.sqrt(Math.max(0, 1 - u * u)); // zero at both ends
    if (taper <= 0.02) continue;
    const along = u * R * BAR_LENGTH;
    const x = Math.cos(BAR) * along;
    const y = Math.sin(BAR) * along;
    /*
     * Wide and faint, not narrow and bright.
     *
     * Close up, the reference has no bar as such -- only a soft cream
     * elongation of the nucleus, dissolving into the dust before it reaches
     * anything you could call an end. Every version of this that read as a
     * distinct object was too narrow and too bright; the structure is real,
     * but at this scale it is a bias in a glow, not a shape. Broad radii and
     * a low alpha give the same elongation with nothing for the eye to catch.
     */
    const girth = Math.pow(taper, 0.5);
    blob(x, y, R * (0.055 + 0.135 * girth), "214,178,138", 0.019 * taper ** 0.85);
    blob(x, y, R * (0.026 + 0.062 * girth), "240,214,178", 0.017 * taper ** 0.75);
  }

  // The bulge itself: broad warm halo first, then progressively smaller and
  // whiter passes, so the centre saturates to cream-white the way it does in
  // a long exposure.
  /*
   * Deliberately short of saturation.
   *
   * Everything in this scene composites additively, so the painted core, the
   * bulge sprites and twenty thousand bulge stars all sum in the same pixels.
   * Push any of them too hard and the middle clips flat at white -- and the
   * boundary of a clipped region is an iso-brightness contour, which where
   * several elongated components overlap has *corners*. That is where the
   * angular, machined-looking core came from: not a shape anywhere in the
   * geometry, but the edge of a blown-out highlight.
   *
   * Each layer now leaves headroom, so the sum rolls off smoothly and the
   * falloff of a sphere survives all the way to the middle.
   */
  /*
   * And it is small.
   *
   * The bulge was painted out to 0.46 R, which on a disc that reaches 1.0 is
   * nearly a quarter of the whole galaxy -- so the middle read as an enormous
   * lamp with a spiral drawn round it. In the reference the bright core is
   * under a tenth of the diameter: a small, intense sphere that the bar and
   * the arm roots run out of. Halved, and the outer stops thinned, so the glow
   * still reaches the inner arms without a dark ring but stops dominating.
   */
  const bulgeStops = [
    [0.235, "255,216,168", 0.055], // outer halo -- still bridges to the arms
    [0.155, "255,226,188", 0.09],
    [0.098, "255,226,176", 0.14],
    [0.060, "255,242,210", 0.20],
    [0.032, "255,251,236", 0.27],
    [0.015, "255,255,250", 0.36],
  ];
  for (const [radius, colour, alpha] of bulgeStops) {
    blob(0, 0, R * radius, colour, alpha);
  }

  // ---- dust lanes, carved out of everything above
  context.globalCompositeOperation = "destination-out";
  // Along the inner edge of each arm, where the density wave piles dust up.
  alongArms(180, 0.24, 0.94, 0.05, -0.24, (x, y, t, arm) => {
    const width = R * (0.014 + t * 0.042);
    const fade = Math.pow(Math.sin(Math.min(1, (t - 0.24) / 0.7) * Math.PI), 0.6);
    // No arm, no density wave, no lane.
    blob(x, y, width, "0,0,0", 0.66 * fade * (0.22 + 0.9 * armStrength(arm, t)));
  });
  // The pair of lanes that wrap the bar -- the most recognisable feature of
  // the reference, and the thing that makes the core read as three-dimensional.
  /*
   * The lanes that wrap the bar start outside the bulge, not through it.
   *
   * Carving from a tenth of the radius put a dark notch straight across the
   * middle of the core, and a bright shape with a bite out of it stops looking
   * like a sphere and starts looking like a machined part -- which is what
   * made the centre read as angular. They now begin where the bulge glow has
   * already fallen away, and fade in rather than starting at full strength.
   */
  for (let side = 0; side < 2; side += 1) {
    const flip = side === 0 ? 1 : -1;
    const cosB = Math.cos(BAR);
    const sinB = Math.sin(BAR);
    for (let i = 0; i <= 130; i += 1) {
      const u = (i / 130) * 2 - 1;                    // -1 .. 1 along the bar
      const taper = Math.sqrt(Math.max(0, 1 - u * u));
      if (taper <= 0.03) continue;
      const along = u * R * (BAR_LENGTH + 0.04);
      /*
       * Flanking the bar, not bisecting it.
       *
       * At an offset of four hundredths of a radius the lane ran straight
       * down the middle of the lens and carved it into two bright slivers
       * with a black gash between them -- the bar stopped being a body of
       * stars and became a blade. It now sits well off the axis, narrow and
       * faint, and only bows in toward the bar at the ends where it really
       * does hand the dust over to the arm.
       */
      const off = flip * R * (0.098 - 0.030 * (1 - taper));
      // Held back near the middle: carving through the nucleus is what made
      // the core look machined the last time, and one bite is enough to undo
      // a sphere.
      const guard = 0.1 + 0.9 * Math.min(1, Math.max(0, Math.abs(u) - 0.12) / 0.35);
      blob(
        cosB * along - sinB * off, sinB * along + cosB * off,
        R * (0.008 + 0.017 * taper), "0,0,0",
        0.26 * Math.pow(taper, 0.45) * guard,
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

  /*
   * ---- warm dust, everywhere
   *
   * Close up the inner disc of the reference is not blue-white with lanes cut
   * in it. It is mottled brown: warm, blotchy patches of dust lying over the
   * arms at every scale, densest around the core and thinning outward, with
   * the cooler starlight showing through the gaps between them. Four tidy
   * carved lanes cannot produce that -- they give grooves, and what is wanted
   * is texture. Two passes do it: warm blobs that tint the disc brown where
   * they land, and a second, smaller set of carved ones so the dust has a
   * shadowed side and the whole field breaks up.
   */
  /*
   * Painted with `multiply`, which is the only operation here that can make
   * something browner rather than merely brighter.
   *
   * Additive brown was the obvious thing to try and it is wrong: dust does
   * not emit, it absorbs, and absorbing more blue than red is exactly what
   * makes it look brown. Adding warm light to the inner disc only pushed an
   * already bright region further toward white, which is the opposite of the
   * reference. Multiplying by a warm colour takes the blue out and darkens at
   * the same time, so the patches sit *in* the disc instead of on top of it.
   */
  context.globalCompositeOperation = "multiply";
  for (let i = 0; i < 230; i += 1) {
    const angle = random() * TAU;
    const rr = 0.08 + Math.pow(random(), 0.85) * 0.76;
    const r = rr * R;
    const tone = random();
    const colour = tone < 0.40 ? "206,158,110"
      : tone < 0.74 ? "184,142,104"
        : "222,182,140";
    blob(Math.cos(angle) * r, Math.sin(angle) * r,
      R * (0.030 + Math.pow(random(), 1.8) * 0.15),
      colour,
      0.5 * Math.max(0.16, 1.2 - rr * 1.05) * (0.45 + random() * 0.9));
  }
  // A little warm light back on the lit edges, so the dust is not only a stain.
  context.globalCompositeOperation = "lighter";
  for (let i = 0; i < 90; i += 1) {
    const angle = random() * TAU;
    const rr = 0.12 + Math.pow(random(), 0.9) * 0.6;
    const r = rr * R;
    blob(Math.cos(angle) * r, Math.sin(angle) * r,
      R * (0.02 + Math.pow(random(), 2) * 0.07),
      "196,150,104",
      0.05 * (0.4 + random()));
  }

  // ---- star-forming regions, on the ridges only
  context.globalCompositeOperation = "lighter";
  alongArms(120, 0.18, 0.95, 0.035, 0.06, (x, y, t, arm) => {
    // Star formation happens where the density wave is, so the knots trace
    // the arm profile more sharply than anything else on the disc.
    if (random() > 0.08 + 0.7 * armStrength(arm, t)) return;
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

/**
 * The objects the camera passes close to.
 *
 * Nine real ones, taken from the reference plate. The point of naming them is
 * not trivia -- it is that "galaxy" is not one shape. A field built from nine
 * copies of the same spiral with different hues is a wallpaper; the reason a
 * real plate of deep-sky images is arresting is that a barred spiral, an
 * edge-on starburst, a colliding pair and a young cluster look nothing alike,
 * and the eye reads that variety as a survey of everything out there rather
 * than as one asset repeated.
 *
 * `core` tints the old stars, `veil` the gas and young stars, `glow` the
 * nebulosity sprites hung around each one.
 */
const DEEP_FIELD_OBJECTS = [
  /*
   * Weighted toward the kinds you can *read*.
   *
   * The first pass had one of each of seven kinds, which is a good survey and
   * a bad shot: two thirds of what went past was cluster, nebula and merger --
   * beautiful, but shapeless at a glance. The thing a viewer wants to catch
   * sight of on a flight through intergalactic space is a spiral, so more than
   * half of these are now discs with arms you can trace, and the amorphous
   * kinds are the seasoning rather than the meal.
   */
  // Grand-design spirals: two arms, wide open, unmistakable even in passing.
  { kind: "grandDesign", core: [1.00, 0.90, 0.66], veil: [0.62, 0.80, 1.00], glow: [0.50, 0.62, 1.00] },
  { kind: "grandDesign", core: [1.00, 0.86, 0.58], veil: [1.00, 0.46, 0.70], glow: [0.86, 0.44, 0.92] },
  { kind: "grandDesign", core: [0.98, 0.94, 0.84], veil: [0.44, 0.86, 0.94], glow: [0.34, 0.74, 0.96] },
  // Barred spirals with pink star-forming knots strung along the arms.
  { kind: "barred", core: [1.00, 0.88, 0.62], veil: [1.00, 0.48, 0.64], glow: [0.72, 0.50, 1.00] },
  { kind: "barred", core: [1.00, 0.84, 0.54], veil: [0.70, 0.74, 1.00], glow: [0.46, 0.56, 1.00] },
  // A ringed spiral: a bright circle of star formation round the nucleus.
  { kind: "ringed", core: [0.98, 0.94, 0.86], veil: [1.00, 0.60, 0.26], glow: [0.60, 0.72, 1.00] },
  { kind: "ringed", core: [1.00, 0.90, 0.72], veil: [0.72, 0.44, 1.00], glow: [0.62, 0.38, 1.00] },
  // Flocculent and dusty, many short orange arms round a white nucleus.
  { kind: "flocculent", core: [0.98, 0.94, 0.86], veil: [1.00, 0.60, 0.26], glow: [0.58, 0.72, 1.00] },
  { kind: "flocculent", core: [1.00, 0.92, 0.78], veil: [0.86, 0.52, 1.00], glow: [0.66, 0.44, 1.00] },
  // Edge-on, dust-laned, with a warm core burning through it.
  { kind: "edgeOn", core: [1.00, 0.86, 0.60], veil: [0.74, 0.62, 1.00], glow: [0.46, 0.40, 0.94] },
  { kind: "edgeOn", core: [1.00, 0.90, 0.70], veil: [0.60, 0.78, 1.00], glow: [0.40, 0.58, 1.00] },
  // A starburst: a thin disc with plumes blown perpendicular out of it.
  { kind: "starburst", core: [1.00, 0.82, 0.56], veil: [0.44, 0.38, 1.00], glow: [0.34, 0.30, 1.00] },
  // A collision, two nuclei and a bridge of new stars between them.
  { kind: "merger", core: [1.00, 0.96, 0.88], veil: [1.00, 0.38, 0.86], glow: [0.92, 0.42, 0.90] },
  // A young cluster: hot blue stars inside the cloud that made them.
  { kind: "cluster", core: [0.76, 0.88, 1.00], veil: [0.72, 0.36, 1.00], glow: [0.58, 0.30, 1.00] },
  // An emission nebula: almost no resolved stars, all filament and glow.
  { kind: "nebula", core: [1.00, 0.86, 0.90], veil: [1.00, 0.44, 0.72], glow: [0.94, 0.40, 0.78] },
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
  /*
   * The body line is faded by hand, not by CSS.
   *
   * A keyframe animation would have to be restarted by removing a class,
   * forcing a reflow and re-adding it, once per line -- and it would freeze
   * outright in a backgrounded tab, which is where this is usually being
   * looked at during development. Driving it from the frame delta costs two
   * floats, restarts cleanly, and behaves identically in the preview harness
   * where time is stepped rather than elapsed.
   *
   * Out, swap, in -- never a cut. The old line has to be gone before the new
   * one arrives or the eye tries to read both.
   */
  let captionLine = -1;
  let captionPending = null;
  let captionFade = 0;
  let captionShown = -1;

  function showCaption(key, local = 1, deltaSeconds = 0) {
    const entry = CAPTIONS[key];
    if (!entry) {
      caption.classList.remove("is-live");
      captionKey = key;
      return;
    }
    if (key !== captionKey) {
      captionKey = key;
      captionLine = -1;
      captionPending = null;
      captionFade = 0;
      captionTitle.textContent = entry.title;
      // Retire, then re-cue, so consecutive acts cross-fade rather than
      // swapping their title mid-opacity.
      caption.classList.remove("is-live");
      void caption.offsetWidth;
      caption.classList.add("is-live");
    }

    const lines = entry.lines;
    // The last line is held to the end of the act rather than cycling out.
    const index = Math.min(lines.length - 1, Math.max(0, Math.floor(local * lines.length)));
    if (index !== captionLine && captionPending === null) {
      if (captionLine === -1) {
        captionLine = index;
        captionBody.textContent = lines[index];
      } else {
        captionPending = index;
      }
    }

    if (captionPending !== null) {
      captionFade -= deltaSeconds * 2.8;
      if (captionFade <= 0) {
        captionFade = 0;
        captionLine = captionPending;
        captionPending = null;
        captionBody.textContent = lines[captionLine];
      }
    } else {
      captionFade = Math.min(1, captionFade + deltaSeconds * 1.7);
    }

    /*
     * Written only when it has actually moved.
     *
     * Setting an inline style is a style invalidation, and the caption is a
     * large fixed-position element with several text shadows on it -- so doing
     * it unconditionally means a recalculate and a repaint on every frame of
     * the sequence, for the ninety-odd per cent of frames where the value has
     * not changed at all. That is where the periodic hitch through the galaxy
     * came back from. Quantised to a hundredth and skipped when it matches.
     */
    const eased = captionFade * captionFade * (3 - 2 * captionFade);
    const step = Math.round(eased * 100) / 100;
    if (step !== captionShown) {
      captionShown = step;
      captionBody.style.opacity = step === 1 ? "" : step.toFixed(2);
      captionBody.style.transform = step === 1
        ? ""
        : `translateY(${((1 - step) * -7).toFixed(2)}px)`;
    }
  }

  /* --------------------------------------------------------- the detonation */

  const blast = new THREE.Group();
  scene.add(blast);

  /*
   * No lights at all in this scene any more.
   *
   * They existed for one reason: a field of shaded rock fragments thrown out
   * of the blast, which needed something to light it. There was no rock in the
   * Big Bang -- no atoms for a hundred thousand years, let alone minerals --
   * and it looked exactly as wrong as it was: flat-shaded shards tumbling
   * across an additive flash read as paper, not as matter. The fireball is a
   * plasma fog now, which is both what it was and what it looks like, and
   * plasma is emissive. Everything in the scene composites additively and
   * ignores lighting entirely.
   */

  const coreMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,214,146,0.78)", 0.26)),
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
      color: new THREE.Color(index === 0 ? 0xffffff : 0xffb257),
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

  /*
   * No shockwave rings.
   *
   * There were three, staggered, expanding -- a perfectly circular annulus of
   * constant width, which is the single most computer-generated shape it is
   * possible to draw. It got away with it while the blast was eighteen units
   * from the lens and everything was blown out anyway; the moment the burst
   * was moved back far enough to be seen as an object, it became a clean white
   * hoop laid over the fireball. The fog has a front of its own, and that
   * front is granular and uneven, which is what a shock actually looks like.
   */

  /*
   * The smoke around the fireball.
   *
   * Warm, not cold. The old haze was blue -- a reasonable guess for deep space
   * and completely wrong for this moment: the early universe was an opaque
   * plasma glowing at thousands of degrees, and every rendering of it looks
   * like a furnace, not like a nebula. Amber through to ember, and there are
   * more of them, because in the reference the fog is the frame.
   */
  const hazeTexture = track(createGlowTexture("rgba(255,220,158,0.5)", "rgba(226,102,32,0.26)", 0.42));
  const haze = [];
  for (let i = 0; i < 13; i += 1) {
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

  /*
   * The fireball, as plasma.
   *
   * The reference is a wall of incandescent fog: countless grains, brightest
   * where the light is coming from, cooling from white through amber to a deep
   * ember at the front, with a defined rim and long spokes of light escaping
   * through the gaps. What it very much is not is objects. There were no
   * objects -- for the first few hundred thousand years the universe was too
   * hot for an atom to hold together, never mind a rock.
   *
   * So: a very large number of very small additive points, thrown from one
   * place, coloured by where they sit in the fog.
   *
   * Two details do most of the work. The radius is sampled as a low power of a
   * uniform, which piles the grains toward the outside and gives the fireball
   * an edge rather than a soft falloff -- that rim is the single most
   * recognisable thing in the reference. And every grain carries its own
   * brightness jitter, so the fog is granular at the pixel level instead of
   * smooth; smooth is what makes a particle system look like a gradient.
   */
  const PLASMA_COUNT = 38000;
  const plasmaVelocity = new Float32Array(PLASMA_COUNT * 3);
  const plasmaColours = new Float32Array(PLASMA_COUNT * 3);
  for (let i = 0; i < PLASMA_COUNT; i += 1) {
    const i3 = i * 3;
    // Uniform on the sphere, then biased forward so a good share of the fog
    // comes past the camera instead of all of it receding.
    const theta = random() * TAU;
    const z = random() * 2 - 1;
    const planar = Math.sqrt(Math.max(0, 1 - z * z));
    const dx = planar * Math.cos(theta);
    const dy = planar * Math.sin(theta);
    const dz = z * 0.86 + 0.08;
    const length = Math.hypot(dx, dy, dz) || 1;

    const shell = Math.pow(random(), 0.34);
    const speed = 24 + shell * 238 * (0.72 + random() * 0.56);
    plasmaVelocity[i3] = (dx / length) * speed;
    plasmaVelocity[i3 + 1] = (dy / length) * speed;
    plasmaVelocity[i3 + 2] = (dz / length) * speed;

    // White-hot at the middle, amber through the body, ember at the front.
    let cr;
    let cg;
    let cb;
    if (shell < 0.5) {
      const u = shell / 0.5;
      cr = 1.0;
      cg = 0.96 - 0.42 * u;
      cb = 0.82 - 0.68 * u;
    } else {
      const u = (shell - 0.5) / 0.5;
      cr = 1.0 - 0.34 * u;
      cg = 0.54 - 0.36 * u;
      cb = 0.14 - 0.10 * u;
    }
    const flicker = 0.5 + Math.pow(random(), 1.6) * 0.85;
    plasmaColours[i3] = Math.min(1, cr * flicker);
    plasmaColours[i3 + 1] = Math.min(1, cg * flicker);
    plasmaColours[i3 + 2] = Math.min(1, cb * flicker);
  }

  const plasmaGeometry = track(new THREE.BufferGeometry());
  plasmaGeometry.setAttribute(
    "position", new THREE.BufferAttribute(new Float32Array(PLASMA_COUNT * 3), 3),
  );
  plasmaGeometry.setAttribute("color", new THREE.BufferAttribute(plasmaColours, 3));
  /*
   * Fixed pixel size, not attenuated.
   *
   * With attenuation on, a grain that ends up near the camera is drawn tens of
   * pixels across -- and since the fog expands past the camera, that is most of
   * them by the end. The first attempt filled the frame with gold blobs the
   * size of coins: glitter, not fog. A grain of plasma has no size worth
   * resolving at any of these distances; what varies is how many of them land
   * in a pixel, which is exactly what makes the reference granular.
   */
  const plasmaMaterial = track(new THREE.PointsMaterial({
    size: px(2.0),
    map: track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,186,96,0.4)", 0.3)),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    opacity: 0,
  }));
  const plasma = new THREE.Points(plasmaGeometry, plasmaMaterial);
  plasma.frustumCulled = false;
  plasma.renderOrder = 2;
  blast.add(plasma);

  function layOutPlasma(travel, level) {
    const value = level > 0 ? level : 0;
    plasmaMaterial.opacity = value;
    plasma.visible = value > 0.002;
    if (!plasma.visible) return;
    const array = plasmaGeometry.attributes.position.array;
    for (let i = 0; i < PLASMA_COUNT; i += 1) {
      const i3 = i * 3;
      array[i3] = plasmaVelocity[i3] * travel;
      array[i3 + 1] = plasmaVelocity[i3 + 1] * travel;
      array[i3 + 2] = plasmaVelocity[i3 + 2] * travel - 18;
    }
    plasmaGeometry.attributes.position.needsUpdate = true;
  }
  layOutPlasma(0.001, 0);

  /* ------------------------------------------------------------ star dust */

  /*
   * Dense enough to be a photograph.
   *
   * The reference is a Hubble field toward the galactic bulge and there is
   * barely any black in it -- stars overlap stars, and the darkness is what
   * shows *between* them rather than what they sit on. At 5,600 this field
   * was a scattering of dots with a lot of empty space, which reads as a
   * screensaver. The cost of tripling it is one float write per point per
   * frame in `driftField`, which is nothing next to what it buys.
   */
  const DUST_COUNT = 26000;
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
    const c = roll < 0.34 ? [1.00, 1.00, 1.00]        // overexposed white
      : roll < 0.55 ? [0.86, 0.93, 1.00]              // blue-white
        : roll < 0.66 ? [0.62, 0.78, 1.00]            // hot blue
          : roll < 0.82 ? [1.00, 0.95, 0.84]          // yellow-white
            : roll < 0.93 ? [1.00, 0.74, 0.44]        // orange giant
              : [1.00, 0.48, 0.30];                   // red giant
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

  /*
   * The brightest few, with spikes.
   *
   * Drawn as a separate cloud rather than as part of the field, because they
   * need a different map and a size that grows as they pass -- these are the
   * stars close enough to the camera to register as objects, and a bright
   * star that does not swell as you fly past it is a texture, not a star.
   */
  const SPIKE_COUNT = 150;
  const spikePositions = new Float32Array(SPIKE_COUNT * 3);
  const spikeColours = new Float32Array(SPIKE_COUNT * 3);
  for (let i = 0; i < SPIKE_COUNT; i += 1) {
    const i3 = i * 3;
    const angle = random() * TAU;
    const radius = Math.pow(random(), 0.5) * FIELD_RADIUS;
    spikePositions[i3] = Math.cos(angle) * radius;
    spikePositions[i3 + 1] = Math.sin(angle) * radius * 0.84;
    // Kept in the near half of the field: at the far end the cross collapses
    // to a couple of pixels and there is no point having drawn it.
    spikePositions[i3 + 2] = -60 - random() * 1500;
    // The colour is the whole reason these are worth drawing: in the
    // reference the spiked stars are the ones that are visibly orange, red or
    // blue, while everything fainter has burnt out to white.
    const roll = random();
    const c = roll < 0.26 ? [1.00, 0.62, 0.30]
      : roll < 0.44 ? [1.00, 0.40, 0.24]
        : roll < 0.66 ? [0.56, 0.74, 1.00]
          : roll < 0.84 ? [1.00, 0.94, 0.82]
            : [1.00, 1.00, 1.00];
    spikeColours[i3] = c[0];
    spikeColours[i3 + 1] = c[1];
    spikeColours[i3 + 2] = c[2];
  }
  const spikeGeometry = track(new THREE.BufferGeometry());
  spikeGeometry.setAttribute("position", new THREE.BufferAttribute(spikePositions, 3));
  spikeGeometry.setAttribute("color", new THREE.BufferAttribute(spikeColours, 3));
  const spikeMaterial = track(new THREE.PointsMaterial({
    size: 55,
    map: track(createSpikeTexture()),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 0,
  }));
  const spikeStars = new THREE.Points(spikeGeometry, spikeMaterial);
  spikeStars.frustumCulled = false;
  scene.add(spikeStars);

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

  function setBubbleOpacity(bubble, value, gain = 1) {
    const v = Math.max(0, value);
    bubble.shellMaterial.opacity = v;
    bubble.knotMaterial.opacity = Math.min(1, v * gain);
    bubble.galaxyMaterial.opacity = Math.min(1, v * 0.85 * gain);
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
  const galaxyTexture = track(createDistantGalaxyTexture());
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
    /*
     * Held back beyond 380 units. These are the *unresolved* galaxies -- the
     * ones the caption is counting -- and their whole job is to be specks. Let
     * one drift up to the camera and it becomes a fifty-pixel smudge with no
     * internal structure, which reads as a lens artefact rather than as an
     * island of a hundred billion stars. The fifteen built star by star are
     * the ones allowed to come close.
     */
    sprite.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.8,
      -380 - random() * (FIELD_DEPTH - 380),
    );
    const scale = 12 + Math.pow(random(), 2.3) * 54;
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
  for (let i = 0; i < 22; i += 1) {
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
    /*
     * Held well back, and much wider than before.
     *
     * A cloud allowed up to the camera fills a third of the frame with one
     * soft blob and the shot stops being a flight through anything -- it
     * becomes a lens flare. Pushed out past 560 units and made half again as
     * large, the same sprites read as sheets of nebulosity the galaxies are
     * seen *through*, which is what they are for.
     */
    sprite.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.8,
      -560 - random() * (FIELD_DEPTH - 560),
    );
    const scale = 340 + Math.pow(random(), 1.6) * 900;
    sprite.scale.set(scale, scale * (0.3 + random() * 0.42), 1);
    sprite.material.rotation = random() * Math.PI;
    // Each cloud breathes at its own rate, so the field never pulses as one.
    sprite.userData.drift = 0.3 + random() * 0.55;
    sprite.userData.phase = random() * TAU;
    sprite.userData.spin = (random() - 0.5) * 0.05;
    sprite.userData.weight = 0.05 + random() * 0.075;
    galaxyGroup.add(sprite);
    nebulae.push(sprite);
  }

  /*
   * The dust you actually fly through.
   *
   * Everything else in this field is held at a distance for a good reason --
   * a galaxy or a nebula allowed up to the camera loses its structure and
   * becomes a smear. This layer exists precisely to be flown through, and it
   * has no structure to lose: no stars, no cores, no arms, just very large,
   * very faint sheets of colour that wash across the frame as they pass.
   *
   * That is what sells travel. Objects going by tell you things are out there;
   * something enveloping the camera and clearing again tells you that you are
   * moving through a medium rather than past a backdrop. Kept between three
   * and eight hundredths opacity -- individually almost invisible, which is
   * the point: what registers is the tint of the frame changing, not a cloud.
   */
  /*
   * Eighteen, not thirty-four.
   *
   * These are the only sprites in the scene allowed to fill the frame, and
   * additive blending has no early-out -- every one of them costs a full-screen
   * pass of the fragment shader whether it contributes 0.06 of colour or
   * nothing at all. At thirty-four the layer alone was hundreds of millions of
   * fragments a frame and the preview stopped responding. Half as many, rather
   * smaller, and each a little brighter reads the same and costs a third.
   */
  const DRIFT_DUST = 18;
  const DRIFT_DUST_COLOURS = [
    [1.00, 0.36, 0.62], // magenta
    [0.62, 0.36, 1.00], // violet
    [0.28, 0.62, 1.00], // blue
    [0.26, 0.88, 0.86], // teal
    [1.00, 0.62, 0.30], // amber
    [0.94, 0.44, 0.34], // ember red
    [0.52, 0.44, 0.86], // dusty indigo
  ];
  const driftDust = [];
  for (let i = 0; i < DRIFT_DUST; i += 1) {
    const rgb = DRIFT_DUST_COLOURS[i % DRIFT_DUST_COLOURS.length];
    const material = track(new THREE.SpriteMaterial({
      map: cloudTextures[i % cloudTextures.length],
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    }));
    const sprite = new THREE.Sprite(material);
    const angle = random() * TAU;
    const radius = Math.pow(random(), 1.2) * FIELD_RADIUS * 0.75;
    sprite.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.7,
      -random() * FIELD_DEPTH,
    );
    const scale = 380 + Math.pow(random(), 1.4) * 820;
    sprite.scale.set(scale, scale * (0.34 + random() * 0.62), 1);
    sprite.material.rotation = random() * Math.PI;
    // Nearest layer in the field, so it passes fastest -- the parallax cue
    // that puts it in front of everything else.
    sprite.userData.drift = 1.25 + random() * 0.5;
    sprite.userData.spin = (random() - 0.5) * 0.06;
    sprite.userData.phase = random() * TAU;
    sprite.userData.weight = 0.075 + random() * 0.105;
    sprite.renderOrder = -4;
    galaxyGroup.add(sprite);
    driftDust.push(sprite);
  }

  /**
   * Near galaxies, built star by star.
   *
   * A sprite is a smudge; at close range the viewer should be able to see that
   * a galaxy is made of individual stars, because that is the fact the whole
   * sequence is building toward.
   *
   * What each one is made of depends on what it *is*. The reference plate is
   * nine objects and no two of them share a silhouette -- a barred spiral, an
   * edge-on disc cut by its own dust, a starburst blowing plumes out of its
   * poles, a flocculent dusty disc, two young clusters, a collision, two
   * emission nebulae. Nine tinted copies of one spiral would be a wallpaper;
   * this is a survey.
   */
  const lerpNumber = (a, b, t) => a + (b - a) * t;

  function buildDeepFieldGeometry(spec, count) {
    const positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const core = spec.core;
    const veil = spec.veil;
    let n = 0;
    const put = (x, y, z, c, gain) => {
      const i3 = n * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      colours[i3] = c[0] * gain;
      colours[i3 + 1] = c[1] * gain;
      colours[i3 + 2] = c[2] * gain;
      n += 1;
    };
    const blend = (a, b, t) => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    // A ball of stars, used by four of the seven kinds.
    const spheroid = (cx, cy, cz, radius, flatten, concentration, colour, gain) => {
      const r = Math.pow(random(), concentration) * radius;
      const theta = random() * TAU;
      const phi = Math.acos(2 * random() - 1);
      const planar = Math.sin(phi);
      put(cx + r * planar * Math.cos(theta),
        cy + r * Math.cos(phi) * flatten,
        cz + r * planar * Math.sin(theta), colour, gain);
    };

    const kind = spec.kind;

    if (kind === "grandDesign" || kind === "ringed") {
      /*
       * The two shapes that survive being glanced at.
       *
       * A grand design is two arms, wide open, sweeping most of the way round
       * -- the S you can trace in a single frame at any angle. A ringed spiral
       * puts a bright circle of star formation round the nucleus and winds the
       * arms off it. Both are much tighter than the flocculent kinds: the
       * scatter that makes a galaxy look real up close is the same scatter
       * that makes it unreadable in passing, so these keep their stars near
       * the path on purpose.
       */
      const ringed = kind === "ringed";
      const arms = 2;
      const spin = ringed ? 6.4 + random() * 1.6 : 4.2 + random() * 1.2;
      const ringAt = 0.34 + random() * 0.1;
      while (n < count) {
        const roll = random();
        if (roll < 0.14) {
          spheroid(0, 0, 0, 0.15, 0.62, 2.0, core, 1);
        } else if (ringed && roll < 0.44) {
          // The ring itself: narrow in radius, complete in angle.
          const a = random() * TAU;
          const r = ringAt + gaussian() * 0.035;
          put(Math.cos(a) * r, gaussian() * 0.02, Math.sin(a) * r,
            blend(core, veil, 0.75), 1.05);
        } else {
          const t = (ringed ? ringAt + 0.04 : 0.12)
            + Math.pow(random(), 1.05) * (ringed ? 0.94 - ringAt : 0.88);
          const arm = Math.floor(random() * arms) / arms;
          const angle = arm * TAU + t * spin
            + gaussian() * (random() < 0.18 ? 0.42 : 0.13) * (1 + t * 0.3);
          const radius = t + gaussian() * 0.022;
          const dim = 1 - 0.4 * Math.min(1, Math.max(0, t - 0.45) / 0.55);
          put(Math.cos(angle) * radius,
            gaussian() * 0.026 * (1.2 - t * 0.5),
            Math.sin(angle) * radius,
            blend(core, veil, Math.min(1, Math.pow(t, 0.55))), dim);
        }
      }
    } else if (kind === "barred" || kind === "flocculent") {
      const barred = kind === "barred";
      const arms = barred ? 2 : 5 + Math.floor(random() * 3);
      const spin = barred ? 5.2 + random() * 1.8 : 8.0 + random() * 3.0;
      const spread = barred ? 0.15 : 0.26;
      while (n < count) {
        const roll = random();
        if (roll < 0.15) {
          spheroid(0, 0, 0, 0.17, 0.6, 1.9, core, 1);
        } else if (barred && roll < 0.23) {
          const u = random() * 2 - 1;
          const taper = Math.pow(Math.sqrt(Math.max(0, 1 - u * u)), 0.6);
          put(u * 0.34, gaussian() * 0.022 * taper, gaussian() * 0.05 * taper, core, 0.72);
        } else {
          const t = 0.12 + Math.pow(random(), 1.15) * 0.88;
          const arm = Math.floor(random() * arms) / arms;
          const angle = arm * TAU + t * spin
            + gaussian() * (random() < 0.2 ? spread * 2.6 : spread) * (1 + t * 0.35);
          const radius = t + gaussian() * 0.03;
          // Faded outward, the same way the Milky Way is, so the disc has no
          // hard boundary for the eye to find.
          const dim = 1 - 0.45 * Math.min(1, Math.max(0, t - 0.4) / 0.6);
          put(Math.cos(angle) * radius,
            gaussian() * 0.032 * (1.2 - t * 0.5),
            Math.sin(angle) * radius,
            blend(core, veil, Math.min(1, Math.pow(t, 0.6))), dim);
        }
      }
    } else if (kind === "edgeOn" || kind === "starburst") {
      /*
       * Built in the XZ plane and left there: the camera looks down -z, so a
       * disc containing the view axis is already edge-on and needs no lucky
       * rotation to read that way.
       *
       * The dust lane is a *gap*. Everything composites additively, so nothing
       * in this scene can cast a shadow -- the only way to draw a dark band
       * across a bright disc is to put no stars there, which is also what is
       * physically happening: the near side of the disc is opaque.
       */
      const plume = kind === "starburst";
      const lane = 0.022;
      while (n < count) {
        const roll = random();
        if (roll < 0.14) {
          spheroid(0, 0, 0, 0.15, 0.72, 2.0, core, 1);
        } else if (plume && roll < 0.34) {
          // Bipolar outflow: two cones of ionised gas out of the poles.
          const up = random() < 0.5 ? 1 : -1;
          const h = 0.08 + Math.pow(random(), 0.8) * 0.85;
          const flare = 0.06 + h * 0.42;
          const a = random() * TAU;
          const rr = Math.pow(random(), 0.6) * flare;
          put(Math.cos(a) * rr, up * h, Math.sin(a) * rr, veil,
            0.85 * (1 - h * 0.6));
        } else {
          const t = 0.08 + Math.pow(random(), 0.85) * 0.92;
          const a = random() * TAU;
          const y = gaussian() * 0.05 * (1.1 - t * 0.5);
          // The near-side dust lane: no stars inside it past the bulge.
          if (t > 0.16 && Math.abs(y) < lane) continue;
          const dim = 1 - 0.5 * Math.min(1, Math.max(0, t - 0.3) / 0.7);
          put(Math.cos(a) * t, y, Math.sin(a) * t,
            blend(core, veil, Math.min(1, Math.pow(t, 0.7))), dim);
        }
      }
    } else if (kind === "cluster") {
      /*
       * A cluster is not a small galaxy. It has no disc, no arms and no
       * gradient to speak of -- just a steep concentration of hot stars and a
       * scatter of escapees, and the nebulosity around it is doing most of the
       * visual work. Sampled with a much steeper power than a bulge, which is
       * what makes the middle read as unresolvable rather than merely dense.
       */
      while (n < count) {
        if (random() < 0.72) {
          spheroid(0, 0, 0, 0.42, 0.9, 2.6, core, 0.9 + random() * 0.3);
        } else {
          spheroid(0, 0, 0, 1.0, 0.85, 0.9,
            blend(core, veil, random() * 0.7), 0.4 + random() * 0.35);
        }
      }
    } else if (kind === "merger") {
      /*
       * Two nuclei, a bridge of new stars between them, and tidal tails
       * thrown off in opposite directions -- the shape is the whole story, and
       * it is a shape no single-galaxy generator can produce.
       */
      const sep = 0.30;
      while (n < count) {
        const roll = random();
        if (roll < 0.26) {
          spheroid(-sep, 0, 0, 0.20, 0.8, 2.1, core, 1);
        } else if (roll < 0.48) {
          spheroid(sep * 0.9, 0.06, 0.05, 0.17, 0.8, 2.1, core, 0.92);
        } else if (roll < 0.70) {
          // The bridge: shocked gas between them, where the new stars are.
          const u = random();
          put(lerpNumber(-sep, sep * 0.9, u) + gaussian() * 0.06,
            gaussian() * 0.05 + u * 0.06,
            gaussian() * 0.07, veil, 0.75 + random() * 0.4);
        } else {
          // Tails: an arc that leaves the pair and keeps going.
          const side = random() < 0.5 ? 1 : -1;
          const u = Math.pow(random(), 0.7);
          const a = side * (0.5 + u * 2.3);
          const r = 0.35 + u * 0.95;
          put(Math.cos(a) * r * side, gaussian() * 0.05 + side * u * 0.18,
            Math.sin(a) * r,
            blend(core, veil, u), 0.5 * (1 - u * 0.55));
        }
      }
    } else {
      /*
       * A nebula, where almost nothing is resolved.
       *
       * A handful of hot stars in the middle -- the ones that lit it -- and
       * the rest is a thin haze of points standing in for unresolved
       * background. The sprites hung on this object are doing the real work,
       * which is correct: this is gas, and gas is not made of dots.
       */
      while (n < count) {
        if (random() < 0.2) {
          spheroid(0, 0, 0, 0.30, 0.9, 1.4, core, 0.9 + random() * 0.4);
        } else {
          spheroid(0, 0, 0, 1.0, 0.85, 0.7,
            blend(core, veil, 0.4 + random() * 0.6), 0.22 + random() * 0.3);
        }
      }
    }

    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  }

  /*
   * One material per galaxy, not one for all of them.
   *
   * They have to fade individually. A galaxy is allowed to come all the way to
   * the camera now -- that near miss is the best thing in the phase -- but the
   * last fifty units of it are a featureless wall of points with no silhouette,
   * and cutting it dead at that moment is worse than never letting it close.
   * Each one dims out over its final stretch instead, so it passes rather than
   * vanishes. A shared material could only fade the whole population at once,
   * which is what forced the old distance limit.
   */
  const deepStarTexture = track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,255,255,0.45)"));
  const makeDeepStarMaterial = () => track(new THREE.PointsMaterial({
    size: 2.7,
    map: deepStarTexture,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    opacity: 0,
  }));

  /* How much nebulosity each kind carries, and how far it spreads. */
  const DEEP_VEIL = {
    grandDesign: { count: 4, size: 1.25, weight: 0.13 },
    ringed: { count: 4, size: 1.25, weight: 0.14 },
    barred: { count: 4, size: 1.25, weight: 0.14 },
    flocculent: { count: 4, size: 1.25, weight: 0.13 },
    edgeOn: { count: 3, size: 1.4, weight: 0.16 },
    starburst: { count: 5, size: 1.5, weight: 0.19 },
    cluster: { count: 6, size: 1.4, weight: 0.20 },
    merger: { count: 5, size: 1.4, weight: 0.18 },
    nebula: { count: 8, size: 1.7, weight: 0.24 },
  };

  const spirals = [];
  const deepSprites = [];
  let deepStarLevel = 0;

  /*
   * A galaxy's visibility across its whole run.
   *
   * Two ends, and both of them used to be a cut. It was recycled to the back
   * of the slab at full strength, so a galaxy did not arrive out of the dark
   * -- it simply existed, mid-frame, where a moment before there had been
   * nothing. That is the pop.
   *
   * It now rises out of the dark over the first 560 units of its run, holds
   * through the approach while it grows, and dissolves over the last 300 as it
   * sweeps past -- usually to one side, since most of them are placed well off
   * the flight path. Nothing is ever seen to start or to stop.
   */
  /*
   * Shallower, because the field is slower.
   *
   * Distances here are only meaningful as times. At 640 units a second a
   * 2,200-unit slab was three and a half seconds of approach; at 175 it would
   * be twelve, which is longer than the phase. Everything below is scaled to
   * keep the *timing* of an approach the same now that the speed has changed:
   * a galaxy still rises over about two seconds, holds while it grows, and
   * dissolves over about two as it goes by.
   */
  const DEEP_SLAB_FAR = -1500;
  const DEEP_SLAB_NEAR = 150;
  /*
   * Smoothed at both ends, and the near one is long.
   *
   * A linear dissolve over 300 units is three quarters of a second, and three
   * quarters of a second is exactly short enough to register as *something
   * happening* -- a galaxy filling a quarter of the frame visibly losing its
   * light. It read as a bulb being turned down rather than as an object going
   * past. Six hundred units of smootherstep, beginning while it is still well
   * ahead, is slow enough that the dimming is never the thing you notice; what
   * you notice is that it got very close and then it was behind you.
   */
  const smootherstep = (t) => {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
  function deepNearFade(z) {
    const arriving = smootherstep((z - DEEP_SLAB_FAR) / 300);
    const leaving = 1 - smootherstep((z + 380) / 380);
    return arriving * leaving;
  }

  function applyDeepStarLevel() {
    for (let i = 0; i < spirals.length; i += 1) {
      const group = spirals[i];
      group.userData.nearFade = deepNearFade(group.position.z);
      applyFade(group.userData.points, deepStarLevel * group.userData.nearFade);
    }
  }

  function setDeepStarLevel(level) {
    deepStarLevel = Math.max(0, level);
    applyDeepStarLevel();
  }
  for (let i = 0; i < DEEP_FIELD_OBJECTS.length; i += 1) {
    const spec = DEEP_FIELD_OBJECTS[i];
    const group = new THREE.Group();
    const material = makeDeepStarMaterial();
    const points = new THREE.Points(buildDeepFieldGeometry(spec, 7200), material);
    points.frustumCulled = false;
    group.userData.material = material;
    group.userData.points = points;
    group.userData.nearFade = 1;
    group.add(points);

    // The gas. Hung as children so it travels, tilts and spins with the stars.
    const veilSpec = DEEP_VEIL[spec.kind];
    for (let k = 0; k < veilSpec.count; k += 1) {
      const rgb = random() < 0.55 ? spec.glow : spec.veil;
      const material = track(new THREE.SpriteMaterial({
        map: cloudTextures[k % cloudTextures.length],
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
      }));
      const sprite = new THREE.Sprite(material);
      const a = random() * TAU;
      const rr = Math.pow(random(), 1.4) * 0.7;
      sprite.position.set(Math.cos(a) * rr, gaussian() * 0.12, Math.sin(a) * rr);
      const size = veilSpec.size * (0.45 + Math.pow(random(), 1.5) * 0.9);
      sprite.scale.set(size, size * (0.55 + random() * 0.6), 1);
      sprite.material.rotation = random() * Math.PI;
      sprite.renderOrder = -1;
      sprite.userData.weight = veilSpec.weight * (0.5 + random() * 0.7);
      sprite.userData.phase = random() * TAU;
      sprite.userData.owner = group;
      group.add(sprite);
      deepSprites.push(sprite);
    }

    /*
     * Placed near the axis and biased toward the camera.
     *
     * Scattered evenly through a 2,600-deep field, most of these were a long
     * way off to one side and half a mile back, which is to say invisible: the
     * shot went past dust and the galaxies were specks. Pulling them in
     * toward the flight path and weighting the depth toward the near end means
     * several are always close enough to resolve, which is the entire point of
     * building them star by star.
     */
    const angle = random() * TAU;
    /*
     * Most of them well off the flight path. A galaxy dead ahead is one you
     * fly into; a galaxy 300 units to the side is one that swells, fills the
     * corner of the frame and sweeps by -- which is the shot worth having, and
     * the one that makes the speed legible.
     */
    const radius = 90 + Math.pow(random(), 0.9) * 430;
    /*
     * Spread over a 1,500-deep slab rather than the whole 2,600, and recycled
     * within it. Fifteen objects scattered through the full field put roughly
     * one in resolving range at a time, which is why the shot read as dust
     * with the occasional smudge; compressing the loop keeps three or four of
     * them close enough to see structure in at any moment.
     */
    group.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.7,
      DEEP_SLAB_FAR + random() * (DEEP_SLAB_NEAR - DEEP_SLAB_FAR),
    );
    /*
     * Orientation is part of the identity, not a random roll. An edge-on
     * starburst rotated face-on is just a fuzzy blob; a disc built in XZ is
     * already edge-on to a camera looking down -z, so the discs that are
     * meant to be seen flat are the ones that need turning.
     */
    if (spec.kind === "edgeOn" || spec.kind === "starburst") {
      group.rotation.set(gaussian() * 0.2, random() * Math.PI, (random() - 0.5) * 1.6);
    } else if (spec.kind === "barred" || spec.kind === "flocculent") {
      group.rotation.set(
        (random() < 0.5 ? 1 : -1) * (Math.PI / 2) + gaussian() * 0.4,
        random() * Math.PI,
        random() * Math.PI,
      );
    } else {
      group.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    }
    group.scale.setScalar(95 + Math.pow(random(), 0.8) * 185);
    galaxyGroup.add(group);
    spirals.push(group);
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
  const MILKY_WAY_SPIN = 9.5;  // must match SPIN in createGalaxyDiscTexture
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
    return { mesh, material, weight: layer.weight };
  });

  /*
   * Fading is not the same as not drawing.
   *
   * An additive sprite at opacity zero contributes nothing and costs exactly
   * as much as one at full strength: the quad is still rasterised and every
   * fragment under it is still shaded. With four hundred-odd sprites in the
   * galaxy alone -- several of them scaled with a group that reaches fifteen
   * thousand, so each covers the screen many times over -- that is a very
   * large bill for something invisible. Anything below a quarter of a percent
   * is taken out of the draw entirely.
   */
  const applyFade = (object, opacity) => {
    const value = opacity > 0 ? opacity : 0;
    object.material.opacity = value;
    object.visible = value > 0.0025;
  };

  function setDiscOpacity(level) {
    const value = Math.max(0, level);
    for (let i = 0; i < discLayers.length; i += 1) {
      applyFade(discLayers[i].mesh, value * discLayers[i].weight);
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
    // Tight white centre, long warm falloff: a sphere seen through a long
    // exposure, which is what a galactic bulge is.
    map: track(createGlowTexture("rgba(255,255,250,1)", "rgba(255,230,190,0.42)", 0.14)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const mwBulge = new THREE.Sprite(bulgeMaterial);
  mwBulge.scale.setScalar(0.20);
  mwBulge.renderOrder = -1;
  milkyWay.add(mwBulge);

  /*
   * A second, much wider bulge layer.
   *
   * One sprite gives a disc of light; two at different radii give a body. The
   * wide one supplies the soft outer envelope the eye reads as the far side of
   * a sphere falling away, and it also fills the gap between the core and the
   * inner arms so the middle of the galaxy is continuous rather than a bright
   * patch sitting in a dark hole.
   *
   * Both are sprites, so they stay circular however far the disc is tilted --
   * which is the whole reason the core stops looking like a flat lozenge.
   */
  const bulgeHaloMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,240,212,0.75)", "rgba(255,206,150,0.26)", 0.3)),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const mwBulgeHalo = new THREE.Sprite(bulgeHaloMaterial);
  mwBulgeHalo.scale.setScalar(0.60);
  mwBulgeHalo.renderOrder = -2;
  milkyWay.add(mwBulgeHalo);

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

  /*
   * Fewer stars than the disc can hold, on purpose.
   *
   * Past a certain density a point cloud stops reading as a galaxy and starts
   * reading as glitter: every pixel resolves, nothing is diffuse, and the eye
   * is given no unresolved light to interpret as distance. A real photograph
   * of a spiral is mostly *not* stars -- it is dust and unresolved starlight,
   * with resolved stars only as a sparkle on top of it, and that ratio is
   * what the outer disc lives or dies by.
   */
  const MW_DISC = 44000;
  const mwPositions = new Float32Array(MW_DISC * 3);
  const mwColours = new Float32Array(MW_DISC * 3);
  for (let i = 0; i < MW_DISC; i += 1) {
    const i3 = i * 3;
    const roll = random();
    if (roll < 0.115) {
      /*
       * The bulge: a real ball of stars.
       *
       * Sampled on the sphere with the radius raised to a power, which piles
       * the stars into the middle the way a galactic bulge actually is -- the
       * density climbs steeply toward the nucleus rather than filling a shell
       * evenly. That concentration is what makes the centre read as a glowing
       * sphere from any angle instead of as a patch of the disc, and it is the
       * thing the old version was missing: it had a thin, evenly-spread bulge
       * and a hard-edged bar, so the middle looked flat and boxy.
       *
       * Flattened slightly on the vertical axis, as a real bulge is.
       */
      const r = Math.pow(random(), 1.9) * 0.105;
      const theta = random() * TAU;
      const phi = Math.acos(2 * random() - 1);
      const planar = Math.sin(phi);
      mwPositions[i3] = r * planar * Math.cos(theta);
      mwPositions[i3 + 1] = r * Math.cos(phi) * 0.62;
      mwPositions[i3 + 2] = r * planar * Math.sin(theta);
      // Whiter at the nucleus, warmer at the edge of the bulge.
      const heat = 1 - Math.min(1, r / 0.105);
      mwColours[i3] = 1.0;
      mwColours[i3 + 1] = 0.78 + heat * 0.2;
      mwColours[i3 + 2] = 0.46 + heat * 0.46;
    } else if (roll < 0.158) {
      /*
       * The bar, as a lens rather than a box.
       *
       * The old distribution was uniform along the bar's length with a
       * constant cross-section, which gives flat ends and straight sides --
       * literally a rectangle of stars, and exactly the "square" at the centre
       * of the galaxy. Scaling the cross-section by sqrt(1 - u^2) closes it to
       * a point at both ends, and biasing `u` toward the middle thins the
       * extremities out so there is no edge to catch.
       */
      const u = (random() * 2 - 1);
      const along = Math.sign(u) * Math.pow(Math.abs(u), 1.1) * 0.32;
      const taper = Math.pow(Math.sqrt(Math.max(0, 1 - (along / 0.32) ** 2)), 0.55);
      // Tight across, so the bar reads as a straight line of stars rather
      // than as an oval smear continuous with the bulge. The near-uniform
      // spacing along it is deliberate too: a bar is the one place in a
      // galaxy where the stars are not scattered.
      const across = gaussian() * 0.082 * taper;
      mwPositions[i3] = along * Math.cos(BAR_ANGLE) - across * Math.sin(BAR_ANGLE);
      mwPositions[i3 + 1] = gaussian() * 0.017 * taper;
      mwPositions[i3 + 2] = along * Math.sin(BAR_ANGLE) + across * Math.cos(BAR_ANGLE);
      // Tan, not cream: the bar is old stars seen through the dust it carries.
      /*
       * And dim.
       *
       * At full brightness seven thousand stars in a volume this small summed
       * straight past white and the bar clipped into a flat tan slab with a
       * hard edge -- a blade again, by a different route. Held to about six
       * tenths it stays below saturation, so what shows is the falloff of the
       * lens instead of the outline of a clipped region. It is also the truth
       * of the thing: a bar is old red stars seen through the dust it carries,
       * and it is never brighter than the nucleus it runs out of.
       */
      const warm = 0.40 + random() * 0.13;
      mwColours[i3] = 1.0 * warm;
      mwColours[i3 + 1] = 0.82 * warm;
      mwColours[i3 + 2] = 0.60 * warm;
    } else {
      // The disc and its arms.
      /*
       * Concentrated inward. The old exponent gave a surface density that
       * barely fell with radius, so the rim was as granular as the middle;
       * this one drops it steeply, which is what leaves room for the dust to
       * be the thing you see out there.
       */
      const t = 0.14 + Math.pow(random(), 1.3) * 0.86;
      const armIndex = Math.floor(random() * MILKY_WAY_ARMS);
      const strength = armStrength(armIndex, t);
      /*
       * Whether a star belongs to its arm at all is a coin weighted by how
       * defined that arm is at this radius. Where the arm is strong most
       * stars land on it; where it has dissolved they spread evenly round the
       * disc and there is simply no arm at that radius to see. Nothing is
       * ever drawn -- the spiral is what is left over once enough stars have
       * been placed this way, which is also how it works in a real galaxy.
       */
      let angle;
      if (random() < 0.22 + 0.68 * strength) {
        /*
         * And even on the arm, a star is not on the path.
         *
         * A tight scatter lays the stars in a ribbon and the arm becomes a
         * drawn stroke -- which is exactly what made the old disc look like a
         * diagram. Two gaussians, a narrow one for most stars and a wide one
         * for a quarter of them, give an arm the tails it really has: a dense
         * spine, a broad shoulder, and stragglers well out into the gap. The
         * eye still assembles the spiral; it just cannot find its edge.
         */
        const spread = (random() < 0.26 ? 0.55 : 0.17) * (1 + t * 0.4);
        angle = armIndex * (TAU / MILKY_WAY_ARMS) + t * MILKY_WAY_SPIN
          + gaussian() * spread;
      } else {
        angle = random() * TAU;
      }
      const radius = t + gaussian() * 0.032;
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
      /*
       * And they fade out into it rather than stopping.
       *
       * Stars of one brightness all the way to the rim give the disc a hard
       * outer boundary, however soft the painted haze behind them is. Rolling
       * the outer half down to about half brightness hands the edge of the
       * galaxy over to the dust, which is where the reference hands it over
       * too -- you cannot say where the disc ends in that photograph, and you
       * should not be able to say it here.
       */
      const dim = 1 - 0.52 * Math.min(1, Math.max(0, t - 0.36) / 0.64);
      mwColours[i3] = (1.0 - mix * 0.46) * dim;
      mwColours[i3 + 1] = (0.84 - mix * 0.1) * dim;
      mwColours[i3 + 2] = (0.46 + mix * 0.54) * dim;
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
  const MW_KNOTS = 620;
  const knotPositions = new Float32Array(MW_KNOTS * 3);
  const knotColours = new Float32Array(MW_KNOTS * 3);
  for (let i = 0; i < MW_KNOTS; i += 1) {
    const i3 = i * 3;
    /*
     * Rejection-sampled against the arm profile, so the knots cluster where
     * the arms are actually defined and thin out across the breaks. They are
     * the brightest thing on the disc, so if they ignored the profile they
     * would draw four complete arms on their own and undo all of it.
     */
    let t = 0.5;
    let armIndex = 0;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      t = 0.22 + Math.pow(random(), 1.15) * 0.76;
      armIndex = Math.floor(random() * MILKY_WAY_ARMS);
      if (random() < armStrength(armIndex, t)) break;
    }
    const angle = armIndex * (TAU / MILKY_WAY_ARMS) + t * MILKY_WAY_SPIN
      + gaussian() * 0.12;
    knotPositions[i3] = Math.cos(angle) * t;
    // Star formation happens in the thin gas layer, so the knots stay much
    // closer to the mid-plane than the stars do -- but they follow the warp.
    knotPositions[i3 + 1] = gaussian() * 0.012
      + Math.sin(angle - 0.6) * Math.pow(Math.max(0, t - 0.45), 2) * 0.34;
    knotPositions[i3 + 2] = Math.sin(angle) * t;
    const hot = random() < 0.42;
    // Dimmed outward with the stars, so the rim goes over to dust together.
    const dim = 1 - 0.45 * Math.min(1, Math.max(0, t - 0.36) / 0.64);
    knotColours[i3] = 1.0 * dim;
    knotColours[i3 + 1] = (hot ? 0.52 : 0.68) * dim;
    knotColours[i3 + 2] = (hot ? 0.72 : 0.92) * dim;
  }
  const knotGeometry = track(new THREE.BufferGeometry());
  knotGeometry.setAttribute("position", new THREE.BufferAttribute(knotPositions, 3));
  knotGeometry.setAttribute("color", new THREE.BufferAttribute(knotColours, 3));
  const knotMaterial = track(new THREE.PointsMaterial({
    size: px(2.9),
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

  /*
   * The dust the galaxy sits in.
   *
   * The painted texture carries a haze out past the last arm, but a painted
   * haze is on the same sheet as everything else -- it cannot pass the camera
   * at its own rate, so it reads as a vignette rather than as material. These
   * are the same dust as volume: a flattened shell of large, very dim, cold
   * clouds starting inside the rim and reaching almost a radius beyond it,
   * thickest in the plane and thinning upward.
   *
   * Additive, so this can only add light. That is the right physics anyway:
   * what is visible out here is reflection nebulosity, dust throwing the
   * light of a hundred billion stars back at the camera. Kept very faint
   * individually -- the effect is meant to be noticed only when it is missing.
   */
  /*
   * Many, large and very faint rather than few and visible: at sixty-six
   * clouds each one could be picked out as a separate smudge beside the
   * galaxy, which is worse than no dust at all. Overlapping this heavily,
   * none of them has an edge and what is left is a field.
   */
  const MW_ENVELOPE = 170;
  const envelopeTexture = track(createCloudTexture(0));
  const mwEnvelope = [];
  for (let i = 0; i < MW_ENVELOPE; i += 1) {
    const angle = random() * TAU;
    const r = 0.66 + Math.pow(random(), 0.8) * 0.92;
    const material = track(new THREE.SpriteMaterial({
      map: envelopeTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: (() => {
        const roll = random();
        return roll < 0.30 ? new THREE.Color(0.62, 0.34, 0.56)   // pink-violet
          : roll < 0.56 ? new THREE.Color(0.56, 0.40, 0.30)      // warm brown
            : roll < 0.80 ? new THREE.Color(0.42, 0.34, 0.62)    // dusty purple
              : new THREE.Color(0.30, 0.40, 0.66);               // cold blue
      })(),
    }));
    const sprite = new THREE.Sprite(material);
    sprite.position.set(
      Math.cos(angle) * r,
      gaussian() * 0.14 * (0.35 + r * 0.55),
      Math.sin(angle) * r,
    );
    const size = 0.62 + Math.pow(random(), 1.5) * 1.5;
    sprite.scale.set(size, size * (0.5 + random() * 0.5), 1);
    sprite.material.rotation = random() * Math.PI;
    sprite.renderOrder = -3;
    // Thinner further out, so the envelope runs out rather than stopping.
    sprite.userData.weight = (0.032 + random() * 0.052)
      * Math.max(0.22, 1.45 - r * 0.6);
    milkyWay.add(sprite);
    mwEnvelope.push(sprite);
  }

  /*
   * Nebulae inside the disc.
   *
   * The painted sheets and the star cloud both sit at essentially one depth,
   * so from any single frame the galaxy could still be a picture of a galaxy.
   * These are objects at real positions within the disc, on the arms, riding
   * the same warp -- so the moment the shot rolls or drops toward the plane
   * they slide against the painted arms behind them at their own rate. That
   * parallax is the thing the eye actually uses to decide something is a
   * volume rather than an image, and no amount of shading substitutes for it.
   *
   * Sprites rather than points, because sprites scale with the group: they
   * grow as the galaxy is approached, which points with fixed pixel sizes
   * would not.
   */
  const MW_CLOUDS = 135;
  const cloudTexture = track(createCloudTexture(1));
  const mwClouds = [];
  for (let i = 0; i < MW_CLOUDS; i += 1) {
    let t = 0.5;
    let armIndex = 0;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      t = 0.24 + Math.pow(random(), 0.7) * 0.72;
      armIndex = Math.floor(random() * MILKY_WAY_ARMS);
      if (random() < armStrength(armIndex, t)) break;
    }
    const angle = armIndex * (TAU / MILKY_WAY_ARMS) + t * MILKY_WAY_SPIN
      + gaussian() * 0.16;
    const warp = Math.sin(angle - 0.6) * Math.pow(Math.max(0, t - 0.45), 2) * 0.34;

    // Emission pink dominates on the arms; reflection blue and a little warm
    // dust fill in between, which is the palette of every arm in the reference.
    const roll = random();
    const rgb = roll < 0.46 ? [1.0, 0.42, 0.66]
      : roll < 0.78 ? [0.46, 0.66, 1.0]
        : roll < 0.92 ? [0.7, 0.5, 1.0]
          : [1.0, 0.74, 0.44];
    const material = track(new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    }));
    const sprite = new THREE.Sprite(material);
    sprite.position.set(
      Math.cos(angle) * t,
      gaussian() * 0.012 + warp,
      Math.sin(angle) * t,
    );
    const size = 0.05 + Math.pow(random(), 1.9) * 0.115;
    sprite.scale.set(size, size * (0.6 + random() * 0.55), 1);
    sprite.material.rotation = random() * Math.PI;
    sprite.userData.weight = 0.34 + random() * 0.62;
    milkyWay.add(sprite);
    mwClouds.push(sprite);
  }

  /*
   * Warm dust over the inner disc.
   *
   * The painted mottling is behind sixty thousand blue-white points, and in
   * the inner disc -- which is exactly where the reference is brownest -- the
   * points win. These sit in the same volume as the stars instead of under
   * them, so the brown lands on top of the bright inner arms rather than
   * beneath them. They are also the closest thing in the scene to the camera
   * during the dive, so they carry most of the parallax on the way down.
   */
  const MW_WARM_DUST = 110;
  const warmDustTexture = track(createCloudTexture(2));
  for (let i = 0; i < MW_WARM_DUST; i += 1) {
    const angle = random() * TAU;
    const rr = 0.10 + Math.pow(random(), 0.85) * 0.55;
    const tone = random();
    const rgb = tone < 0.42 ? [0.72, 0.50, 0.32]
      : tone < 0.76 ? [0.62, 0.45, 0.31]
        : [0.80, 0.60, 0.40];
    const material = track(new THREE.SpriteMaterial({
      map: warmDustTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
    }));
    const sprite = new THREE.Sprite(material);
    sprite.position.set(
      Math.cos(angle) * rr,
      gaussian() * 0.014,
      Math.sin(angle) * rr,
    );
    const size = 0.05 + Math.pow(random(), 1.7) * 0.16;
    sprite.scale.set(size, size * (0.55 + random() * 0.6), 1);
    sprite.material.rotation = random() * Math.PI;
    // Thickest around the core, thinning outward, as in the reference.
    sprite.userData.weight = (0.055 + random() * 0.075)
      * Math.max(0.2, 1.15 - rr * 1.0);
    milkyWay.add(sprite);
    mwClouds.push(sprite);
  }

  /*
   * Fades the in-disc nebulae and the surrounding dust with the galaxy.
   *
   * The envelope takes its own level. It is the halo *outside* the galaxy, and
   * once the camera is diving into the disc it is behind the shot and cannot
   * be looked at -- but it is scaled with the group, so at the bottom of the
   * dive each of its hundred and seventy sprites is tens of thousands of units
   * across and covers the frame several times. Keeping it lit through the dive
   * costs more than everything else in the phase put together.
   */
  function setMilkyWayCloudLevel(level, envelopeLevel = level) {
    const lit = Math.max(0, level);
    const halo = Math.max(0, envelopeLevel);
    for (let i = 0; i < mwClouds.length; i += 1) {
      applyFade(mwClouds[i], lit * mwClouds[i].userData.weight);
    }
    for (let i = 0; i < mwEnvelope.length; i += 1) {
      applyFade(mwEnvelope[i], halo * mwEnvelope[i].userData.weight);
    }
  }

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
    // The spiked stars are nearer, so they pass faster -- which is the whole
    // reason to draw them separately.
    const spikeAttribute = spikeGeometry.attributes.position;
    for (let i = 0; i < SPIKE_COUNT; i += 1) {
      const zi = i * 3 + 2;
      spikeAttribute.array[zi] += step * 1.25;
      if (spikeAttribute.array[zi] > 40) spikeAttribute.array[zi] -= FIELD_DEPTH;
    }
    spikeAttribute.needsUpdate = true;
    galaxySprites.forEach((sprite) => {
      sprite.position.z += step * 0.6;
      if (sprite.position.z > -380) sprite.position.z -= FIELD_DEPTH - 380;
    });
    spirals.forEach((points) => {
      points.position.z += step * 0.78;
      points.rotation.y += step * 0.00012;
      // Recycled behind the camera, not in front of it, so nothing is ever
      // seen to leave. By the time z is positive the object has already faded
      // out and is off the back of the shot.
      if (points.position.z > DEEP_SLAB_NEAR) {
        points.position.z -= (DEEP_SLAB_NEAR - DEEP_SLAB_FAR);
      }
    });
    applyDeepStarLevel();
    // Clouds are nearer than the galaxies behind them and pass faster, which
    // is the parallax that makes the shot read as movement through a volume
    // rather than movement of a backdrop.
    driftDust.forEach((sprite) => {
      sprite.position.z += step * sprite.userData.drift;
      sprite.material.rotation += step * sprite.userData.spin * 0.0005;
      // Recycled behind the camera: this layer is meant to be passed through,
      // so it has to leave the way it would if it were real.
      if (sprite.position.z > 260) sprite.position.z -= FIELD_DEPTH + 260;
    });
    nebulae.forEach((sprite) => {
      sprite.position.z += step * (0.8 + sprite.userData.drift);
      sprite.material.rotation += step * sprite.userData.spin * 0.0004;
      if (sprite.position.z > -420) sprite.position.z -= FIELD_DEPTH - 420;
    });
  }

  /**
   * Fades the cloud field, each cloud breathing on its own cycle.
   *
   * The `level` is the overall strength; the sine is per-cloud, so parts of
   * the field brighten while others dim and it never looks like one object
   * being faded.
   */
  /*
   * Both ends of a recycled object's run.
   *
   * Fading it out before the near cutoff stops the recycle reading as the
   * object blinking out -- but the object then reappears at the far edge at
   * full strength, which is the same cut played backwards and is exactly what
   * made galaxies seem to pop into existence mid-flight. Everything that loops
   * through this field now rises at the far edge and dissolves at the near
   * one, so a recycle is never a visible event.
   */
  const FIELD_FAR_EDGE = -FIELD_DEPTH;
  function edgeFade(z, nearCutoff, nearSpan, farSpan) {
    const leaving = z > nearCutoff ? 0 : Math.min(1, (nearCutoff - z) / nearSpan);
    const arriving = Math.min(1, Math.max(0, (z - FIELD_FAR_EDGE) / farSpan));
    return leaving * arriving;
  }

  function setNebulaLevel(level, time) {
    const lit = Math.max(0, level);
    for (let i = 0; i < nebulae.length; i += 1) {
      const sprite = nebulae[i];
      const breath = 0.72 + Math.sin(time * 0.22 + sprite.userData.phase) * 0.28;
      applyFade(sprite, lit * sprite.userData.weight * breath
        * edgeFade(sprite.position.z, -420, 340, 520));
    }
    for (let i = 0; i < driftDust.length; i += 1) {
      const sprite = driftDust[i];
      const breath = 0.7 + Math.sin(time * 0.17 + sprite.userData.phase) * 0.3;
      /*
       * Faded at both ends of its own run, and thinned as it envelops the
       * camera. A sheet a thousand units across sitting at z = -200 is the
       * whole frame; at full weight that is a colour cast, not a cloud.
       */
      const z = sprite.position.z;
      const arriving = Math.min(1, Math.max(0, (z + FIELD_DEPTH) / 420));
      const enveloping = z > -520 ? Math.max(0.18, 1 - (z + 520) / 700) : 1;
      applyFade(sprite, lit * sprite.userData.weight * breath * arriving * enveloping);
    }
    for (let i = 0; i < deepSprites.length; i += 1) {
      const sprite = deepSprites[i];
      const breath = 0.8 + Math.sin(time * 0.3 + sprite.userData.phase) * 0.2;
      applyFade(sprite, lit * sprite.userData.weight * breath
        * sprite.userData.owner.userData.nearFade);
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
      /*
       * The flash and the act are two different clocks.
       *
       * This is the one place where pacing the animation and pacing the text
       * genuinely conflict. A detonation is over in a moment -- stretch it and
       * it stops being a detonation -- but three lines of caption need twelve
       * seconds to be read. Tying them together meant either a burst in slow
       * motion or text nobody could finish, and both were tried.
       *
       * So the burst runs on a fixed five-second clock and the act runs for
       * twelve. What fills the remaining seven is exactly what filled them in
       * reality: the fog. The universe stayed an opaque plasma for a very long
       * time after the beginning, and the shot now sits inside it, drifting
       * and cooling, while the text is read.
       */
      const BURST_MS = 5000;
      const spread = elapsed / BURST_MS;
      const t = clamp01(spread);
      const act = clamp01(elapsed / T.detonation);
      showCaption("detonation", act, deltaSeconds);
      const out = easeOutCubic(t);

      // Dust is the primordial matter, thrown from the same point.
      if (t < 1) {
        const attribute = dustGeometry.attributes.position;
        for (let i = 0; i < DUST_COUNT; i += 1) {
          const i3 = i * 3;
          attribute.array[i3] = dustOrigin[i3] + (dustTarget[i3] - dustOrigin[i3]) * out;
          attribute.array[i3 + 1] = dustOrigin[i3 + 1] + (dustTarget[i3 + 1] - dustOrigin[i3 + 1]) * out;
          attribute.array[i3 + 2] = dustOrigin[i3 + 2] + (dustTarget[i3 + 2] - dustOrigin[i3 + 2]) * out;
        }
        attribute.needsUpdate = true;
      } else {
        /*
         * Once it has arrived, it drifts.
         *
         * The interpolation writes the same target every frame after t = 1, so
         * anything else that moved the field would be undone; handing over to
         * the drift here is what stops the last seven seconds of the act from
         * being a still photograph with text on it.
         */
        driftField(lerp(0, 62, clamp01((spread - 1) / 0.55)) * deltaSeconds);
      }
      dustMaterial.uniforms.uOpacity.value = Math.min(1, t * 2.4);
      spikeMaterial.opacity = Math.min(1, t * 2.4) * 0.9;

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
      /*
       * The camera starts outside it.
       *
       * The burst used to detonate eighteen units in front of the lens, which
       * meant there was never a fireball to look at -- the first frame was
       * already inside it. The reference is a *ball*: a bright rim, a dark
       * churning edge, spokes of light coming out through the gaps. You cannot
       * see any of that from inside.
       *
       * So the whole blast starts two hundred units back and is driven at the
       * camera, arriving past it by the end of the act. You watch it form,
       * then it takes the frame. Everything drawn at a fixed screen size --
       * core and rays -- is scaled by the distance so its apparent
       * size is unchanged as the group closes; only the fog, which has a real
       * radius, grows the way it should.
       */
      const blastZ = lerp(-215, 12, easeInCubic(t));
      blast.position.z = blastZ;
      const blastDistance = Math.max(7, 18 - blastZ);
      const closing = blastDistance / 18;

      const flash = Math.exp(-t * 7.5);
      /*
       * The core is a highlight, not the subject.
       *
       * Once the fog is doing the work, a full-strength flare on top of it
       * simply erases the middle of the fireball -- and with it the rim, the
       * churn and the caption. Held well below saturation so the plasma's own
       * white-hot centre shows through it.
       */
      coreMaterial.opacity = Math.min(0.8, flash * 1.05);
      core.scale.setScalar((4 + easeOutCubic(Math.min(1, t * 3.4)) * 22) * closing);

      // Rays: fastest to appear, first to go, counter-rotating as they spread.
      rays.forEach((sprite, index) => {
        const local = clamp01((t - index * 0.04) * 2.6);
        sprite.material.opacity = Math.exp(-t * (index === 0 ? 5.2 : 4.0)) * (index === 0 ? 0.7 : 0.44);
        sprite.scale.setScalar((6 + easeOutCubic(local) * (index === 0 ? 150 : 240)) * closing);
        sprite.material.rotation += deltaSeconds * (index === 0 ? 0.22 : -0.15);
      });

      /*
       * The fog, thrown outward. It keeps travelling long after the flash has
       * gone, which is what sells the burst as an event with something in it
       * rather than as a light being switched on and off.
       *
       * Its brightness is a cooling curve, not the flash curve: the plasma is
       * its own light source, so it dims as it expands and thins rather than
       * disappearing with the flare.
       */
      layOutPlasma(
        Math.min(2.5, spread * 0.92),
        Math.min(1, spread * 6) * Math.pow(Math.max(0, 1 - act * 0.96), 1.4) * 0.72,
      );

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
        // The haze breathes across the whole act, not just the flash.
        sprite.material.opacity = Math.sin(clamp01(act * 1.04) * Math.PI) * 0.32;
        sprite.scale.setScalar(
          sprite.userData.base * (1 + Math.min(1.8, spread) * sprite.userData.drift) * closing,
        );
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
      haze.forEach((sprite) => { sprite.material.opacity *= fade; });
      layOutPlasma(2.5 + (1 - fade) * 0.5, Math.pow(fade, 1.6) * 0.05);
    } else if (blast.visible) {
      blast.visible = false;
      layOutPlasma(2.65, 0);
    }

    mark += T.multiverse;
    if (elapsed <= mark) {
      showCaption("multiverse", (elapsed - T.detonation) / T.multiverse, deltaSeconds);
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
      showCaption("approach", 1 - (mark - elapsed) / T.approach, deltaSeconds);
      // One bubble swells until the camera passes through its wall.
      const local = (elapsed - T.detonation - T.multiverse) / T.approach;
      const eased = easeInOutSine(local);
      driftField(lerp(150, 300, eased) * deltaSeconds);
      if (approachStartZ === null) approachStartZ = ours.group.position.z;
      ours.group.position.z = lerp(approachStartZ, 360, eased);
      const swell = lerp(620, 4600, eased);
      ours.group.scale.setScalar(swell);
      ours.group.rotation.y += deltaSeconds * 0.06;
      // Stars come in as fast as the surface they sit on grows, so the
      // density on screen stays put while the bubble goes from a dot to a sky.
      setBubbleDetail(ours, lerp(0.1, 1, easeInCubic(local)));
      /*
       * And ours is lit brighter than the ones it drifted past.
       *
       * At the same brightness as its neighbours it stayed a dim shell right
       * up to the moment the camera went through it -- which is the wrong
       * emphasis entirely. This is the one the whole journey is about, and it
       * is the one act where a universe is close enough to see anything inside
       * of. The gain lifts the stars and the galaxies within it without
       * touching the shell, so the surface stays a membrane rather than
       * becoming a lamp.
       */
      setBubbleOpacity(ours, lerp(0.85, 1, eased), lerp(1.1, 1.9, eased));
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
      galaxySprites.forEach((sprite) => {
        applyFade(sprite, reveal * 0.8 * edgeFade(sprite.position.z, -380, 300, 420));
      });
      setDeepStarLevel(reveal * 0.95);
      setNebulaLevel(reveal, seconds);
      dust.rotation.z += deltaSeconds * 0.02;
      return elapsed / total;
    }

    mark += T.galaxies;
    if (elapsed <= mark) {
      showCaption("galaxies", 1 - (mark - elapsed) / T.galaxies, deltaSeconds);
      const local = 1 - (mark - elapsed) / T.galaxies;
      setBubbleOpacity(ours, Math.max(0, 0.95 * (1 - local * 2.6)));
      bubbles.forEach((bubble, index) => { if (index > 0) setBubbleOpacity(bubble, 0); });
      /*
       * A cruise, not a sprint.
       *
       * This ran at 360 to 640 units a second while the multiverse before it
       * travelled at 70 to 150 -- four times faster through the part of the
       * journey that has the most to look at, so galaxies that took real work
       * to build went past before the eye could settle on one. It now decays
       * out of the approach's exit speed to 175, which is the top of the
       * multiverse's own band, so the two acts read as one continuous move at
       * one pace.
       */
      driftField(lerp(300, 175, easeOutCubic(Math.min(1, local * 1.5))) * deltaSeconds);
      galaxySprites.forEach((sprite) => {
        /*
         * The shimmer has to start from nothing.
         *
         * This used to be a flat 0.62 plus a sine, while the phase before it
         * held these at 0.85 -- so at the seam the entire distant population
         * stepped down by up to a third, in one frame, and read as the lights
         * being dimmed. The base now matches what the neighbouring phases
         * hold, and the sine is scaled in over the first quarter second so the
         * shimmer begins rather than snaps on.
         */
        // Scaled in at the start of the phase and out again at the end, so
        // both seams hand over at exactly the 0.8 the neighbours hold. A
        // shimmer that is still at amplitude when the phase changes is a step,
        // and a step across seventy-eight sprites at once reads as the lights
        // being dimmed.
        const shimmer = Math.min(1, local * 4) * Math.min(1, (1 - local) * 4);
        applyFade(sprite, (0.8 + Math.sin((local + sprite.position.x) * 2.2)
          * 0.12 * shimmer)
          * edgeFade(sprite.position.z, -380, 300, 420));
      });
      setDeepStarLevel(0.95);
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
        setMilkyWayCloudLevel(rise * 0.5);
        bulgeMaterial.opacity = rise * 0.5;
        bulgeHaloMaterial.opacity = rise * 0.28;
        satelliteMaterial.opacity = rise * 0.35;
        mwMaterial.opacity = rise * 0.2;
        knotMaterial.opacity = rise * 0.14;
        haloMaterial.opacity = rise * 0.2;
      }
      return elapsed / total;
    }

    mark += T.milkyWay;
    if (elapsed <= mark) {
      showCaption("milkyWay", 1 - (mark - elapsed) / T.milkyWay, deltaSeconds);
      const local = 1 - (mark - elapsed) / T.milkyWay;
      const eased = easeInOutSine(local);
      // Everything else falls away: from here there is only one galaxy.
      const recede = clamp01(1 - local * 1.8);
      galaxySprites.forEach((sprite) => {
        applyFade(sprite, recede * 0.8 * edgeFade(sprite.position.z, -380, 300, 420));
      });
      setDeepStarLevel(recede * 0.95);
      setNebulaLevel(recede, seconds);
      driftField(lerp(175, 120, easeOutCubic(local)) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(1, 0.5, eased);
      spikeMaterial.opacity = lerp(0.9, 0.45, eased);

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
      setMilkyWayCloudLevel(lerp(0.5, 0.9, clamp01(local * 2)));
      bulgeMaterial.opacity = lerp(0.5, 1.0, clamp01(local * 2));
      bulgeHaloMaterial.opacity = lerp(0.28, 0.5, clamp01(local * 2));
      satelliteMaterial.opacity = lerp(0.35, 0.6, clamp01(local * 2));
      mwMaterial.opacity = lerp(0.2, 0.34, clamp01(local * 2));
      knotMaterial.opacity = lerp(0.14, 0.46, clamp01(local * 2));
      haloMaterial.opacity = lerp(0.2, 0.42, clamp01(local * 2));
      sunMarkMaterial.opacity = clamp01((local - 0.45) / 0.55) * 0.9;
      return elapsed / total;
    }

    mark += T.orionArm;
    if (elapsed <= mark) {
      showCaption("orionArm", 1 - (mark - elapsed) / T.orionArm, deltaSeconds);
      const local = 1 - (mark - elapsed) / T.orionArm;
      const eased = easeInCubic(clamp01(local));
      galaxySprites.forEach((sprite) => { applyFade(sprite, 0); });
      setDeepStarLevel(0);
      setNebulaLevel(0, seconds);
      // Local stars streaming past, the only cue that the camera is moving
      // once the galaxy fills the frame.
      driftField(lerp(120, 1500, eased) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(0.5, 0.9, eased);
      spikeMaterial.opacity = lerp(0.45, 0.8, eased);

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
      setMilkyWayCloudLevel(
        lerp(0.9, 0, clamp01(local * 1.5)),
        lerp(0.9, 0, clamp01(local * 4)),
      );
      bulgeMaterial.opacity = lerp(1.0, 0, clamp01(local * 1.4));
      bulgeHaloMaterial.opacity = lerp(0.5, 0, clamp01(local * 1.4));
      satelliteMaterial.opacity = lerp(0.6, 0, clamp01(local * 1.2));
      mwMaterial.size = px(lerp(1.25, 3.4, eased));
      mwMaterial.opacity = lerp(0.34, 1, clamp01(local * 1.6));
      knotMaterial.opacity = lerp(0.46, 0.24, eased);
      haloMaterial.opacity = lerp(0.42, 0, eased);
      sunMarkMaterial.opacity = 0.9;
      return elapsed / total;
    }

    mark += T.sunApproach;
    if (elapsed <= mark) {
      showCaption("sunApproach", 1 - (mark - elapsed) / T.sunApproach, deltaSeconds);
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
      spikeMaterial.opacity = lerp(0.8, 0.5, eased);

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
    showCaption("arrive", 1, deltaSeconds);
    const local = clamp01(1 - (total - elapsed) / T.arrive);
    // Everything that is not the star is gone by a third of the way in, so the
    // bloom happens against nothing.
    const fade = Math.max(0, 1 - local * 3);
    driftField(lerp(240, 0, easeOutCubic(local)) * deltaSeconds);
    dustMaterial.uniforms.uOpacity.value = fade * 0.55;
    spikeMaterial.opacity = fade * 0.5;
    setDiscOpacity(0);
    setMilkyWayCloudLevel(0);
    bulgeMaterial.opacity = 0;
    bulgeHaloMaterial.opacity = 0;
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
     * Raised to the fifth, not cubed.
     *
     * Cubed put the frame at full white for something like six hundred
     * milliseconds -- and a frame that has stopped changing is a frame that
     * has stopped, whatever is causing it. That white hold was most of the
     * "pause" in the hand-over; the rest of it was the veil that follows.
     * A fifth power keeps the star a star for longer and blows it out in the
     * last two hundred milliseconds, so the white is a flash rather than a
     * held card.
     */
    sunStar.visible = true;
    const flare = local * local * local * local * local;
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

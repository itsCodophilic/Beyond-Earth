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
 *   inflation   the beginning -- space stretching, then cooling into fire
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
 *
 * **Every duration is its caption line count times SECONDS_PER_LINE.**
 *
 * That is not a coincidence to be preserved by hand, it is the rule. The acts
 * used to be timed by what looked right for the animation, which left the text
 * running anywhere from 3.0 to 4.3 seconds a line -- and a reader who has just
 * settled into one act's pace and is then given a third less time in the next
 * one does not experience that as variety, they experience it as not being
 * able to keep up. The burst was the worst of them and was reported as exactly
 * that. One rate everywhere means the reader learns the cadence once.
 *
 * Adding or cutting a caption line therefore *changes the act's duration*.
 * That is the correct direction of causation: these are captions with a shot
 * behind them, not a shot with captions laid over it.
 */
const SECONDS_PER_LINE = 4.0;

export const INTRO_TIMING = {
  inflation: 12000,     // 3 lines
  condense: 8000,       // 2
  multiverse: 8000,     // 2
  approach: 12000,      // 3
  cosmicWeb: 12000,     // 3
  galaxies: 12000,      // 3
  milkyWay: 12000,      // 3
  orionArm: 12000,      // 3
  sunApproach: 8000,    // 2
  // Short on purpose: this is a flare and a cut, not a scene.
  arrive: 1500,
};

const PHASE_ORDER = [
  "inflation", "condense", "multiverse", "approach", "cosmicWeb", "galaxies",
  "milkyWay", "orionArm", "sunApproach", "arrive",
];

/*
 * One speed for the whole journey.
 *
 * Every act used to set its own, and ramp within it -- 70 to 150 through the
 * multiverse, 150 to 300 across the crossing, 300 to 470 through the web, 300
 * back to 175 among the galaxies. Each was reasonable on its own and the set
 * of them was not: the shot lurched at every boundary, and a change of pace
 * that nothing in the scene motivates reads as a fault rather than as a move.
 *
 * It is now a cruise. Acts vary it only where the physics does -- the burst
 * expands, the dive into the disc accelerates -- and everything between here
 * and the Milky Way travels at one steady rate.
 */
const CRUISE = 150;

/*
 * Geometric interpolation: the shape of constant travel.
 *
 * Closing on something at a steady speed does not make it grow linearly, it
 * makes it grow by a constant *factor* per second -- so a linear lerp of a
 * camera range reads as decelerating, and an eased one reads as stopping.
 * Every approach in the sequence is written this way now, which is also what
 * makes their rates comparable: d(ln size)/dt is one number per act, and
 * matching those numbers is what "the same speed everywhere" actually means
 * across eleven orders of magnitude of scale.
 */
const geometric = (from, to, u) => from * Math.pow(to / from, u);

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
  /*
   * Four lines, and each one lands on the beat it describes. The third is the
   * one the act exists for: it arrives while the frame is a uniform field
   * redshifting with no middle to it, which is the only moment in the whole
   * sequence where "no centre" can be *seen* rather than asserted.
   */
  inflation: {
    title: "The Big Bang",
    lines: [
      "Not an explosion. There was nowhere for it to explode into.",
      "Space itself stretched — by a factor of 10²⁶, in 10⁻³² of a second.",
      "Everything recedes from everything. No centre to it, and no edge.",
    ],
  },
  /*
   * The act that was missing.
   *
   * The bubbles used to grow during the last beat of the burst, which meant
   * they simply started existing while the fog cleared -- the plasma expanded,
   * and then, unrelatedly, universes were there. The cause was never shown, so
   * the eye read it as a fade-in with nothing behind it.
   *
   * Eternal inflation is the honest account and it is also the better shot:
   * inflation does not stop everywhere at once, it stops in patches, and each
   * patch that stops cools and closes off. So the fog is given somewhere to
   * go -- it gathers, and what it gathers into is the field of universes the
   * next act drifts through.
   */
  condense: {
    title: "Where It Stopped",
    lines: [
      "The stretching did not stop everywhere. It stopped in patches.",
      "Each patch that stopped cooled, settled, and closed off.",
    ],
  },
  multiverse: {
    title: "The Multiverse",
    lines: [
      "Everywhere else, it is still going — and still making more of them.",
      "Each one with its own stars, its own galaxies, perhaps its own physics.",
    ],
  },
  approach: {
    title: "Our Universe",
    lines: [
      "One of them is ours.",
      "This is the bubble we cooled into.",
      "13.8 billion years old, 93 billion light-years across — and still growing.",
    ],
  },
  cosmicWeb: {
    title: "The Cosmic Web",
    lines: [
      "Matter never spread out evenly. It fell into threads.",
      "Nothing here is a galaxy. Every knot is a cluster of thousands of them.",
      "And between the threads, voids — the emptiest places that exist.",
    ],
  },
  galaxies: {
    title: "Laniakea",
    lines: [
      "We have dropped into one crossing of the web.",
      "A hundred thousand galaxies, all falling toward the same place.",
      "Spirals, starbursts, collisions — no two of them alike.",
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
  /*
   * Three lines, and the act is a third longer for it -- which is the point.
   * This is the steepest change of scale in the sequence by a wide margin, and
   * at two lines it had to be taken at nearly three times the rate of the act
   * before it. The extra line buys the time to slow the dive down.
   */
  orionArm: {
    title: "The Orion Arm",
    lines: [
      "26,000 light-years from the centre, on the inner rim of a minor arm.",
      "The disc is a thousand light-years thick. We are dropping into it.",
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

/*
 * The reading rate, enforced.
 *
 * Durations and caption line counts drift apart the moment either is edited on
 * its own, and the symptom -- one act reading a third faster than its
 * neighbours -- is much easier to feel than to spot. One line at start-up, and
 * it names the act and the duration it should have had.
 */
PHASE_ORDER.forEach((key) => {
  const lines = CAPTIONS[key]?.lines?.length ?? 0;
  if (!lines) return;
  const expected = Math.round(lines * SECONDS_PER_LINE * 1000);
  if (INTRO_TIMING[key] === expected) return;
  console.warn(
    `[BeyondEarth] ${key}: ${INTRO_TIMING[key]}ms for ${lines} caption lines`
    + ` — ${expected}ms is ${SECONDS_PER_LINE}s a line`,
  );
});

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
 * What separates a star from a light being switched on. A pure radial
 * gradient can only ever brighten; spikes give a source a shape, and they are
 * what any real lens does with something far too bright for it. Drawn at
 * uneven angles and uneven lengths on purpose -- evenly spaced ones read as a
 * rendering artefact rather than as light overwhelming an aperture.
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
  for (let i = 0; i < 260; i += 1) {
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
/*
 * A universe, painted.
 *
 * The bubbles were a shell of points, which gave two problems at once. They
 * were see-through, so one in front of another showed the one behind and the
 * field read as soap film rather than as the fullest objects that exist. And
 * they were all the same: one star distribution, one palette rule, so the only
 * thing telling them apart was a tint on the rim.
 *
 * They are painted discs now -- one texture each, drawn once at setup, every
 * one a different kind of universe. Some are all nebula; some are a fine even
 * speckle; some are threaded with filaments; some burn; some are almost empty
 * with one bright core. That is the point of a multiverse: not many copies of
 * this one, but many that are *not* this one, with their own contents and
 * possibly their own physics.
 *
 * Painted into a circle with nothing outside it, so the material can use
 * alphaTest and render in the opaque pass -- which is the only way one bubble
 * occludes another (see the note on the transparent pass in createBubble).
 */
const UNIVERSE_KINDS = [
  "nebula", "speckle", "filament", "ember", "veil", "swarm", "core", "ring", "shards", "clouded",
];

function createUniverseTexture(kind, palette, seed) {
  const size = 256;
  const half = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  // Deterministic per texture: the same universe every run.
  let state = (seed * 9301 + 49297) % 233280;
  const rnd = () => { state = (state * 9301 + 49297) % 233280; return state / 233280; };

  const [a, b] = palette;
  const rgb = (c, alpha) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`;
  const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];

  context.save();
  context.beginPath();
  context.arc(half, half, half - 2, 0, TAU);
  context.clip();

  // The ground it is all drawn on: nearly black, faintly of its own colour.
  context.fillStyle = rgb(mix(a, [0, 0, 0], 0.92), 1);
  context.fillRect(0, 0, size, size);

  const blob = (x, y, r, colour, alpha) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, rgb(colour, alpha));
    gradient.addColorStop(0.45, rgb(colour, alpha * 0.42));
    gradient.addColorStop(1, rgb(colour, 0));
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  };

  context.globalCompositeOperation = "lighter";

  if (kind === "nebula") {
    for (let i = 0; i < 14; i += 1) {
      blob(rnd() * size, rnd() * size, 40 + rnd() * 120, mix(a, b, rnd()), 0.30 + rnd() * 0.3);
    }
    for (let i = 0; i < 60; i += 1) {
      context.strokeStyle = rgb(mix(a, b, rnd()), 0.12 + rnd() * 0.16);
      context.lineWidth = 1 + rnd() * 3;
      context.beginPath();
      const x = rnd() * size;
      const y = rnd() * size;
      context.moveTo(x, y);
      context.quadraticCurveTo(x + (rnd() - 0.5) * 150, y + (rnd() - 0.5) * 150,
        x + (rnd() - 0.5) * 220, y + (rnd() - 0.5) * 220);
      context.stroke();
    }
  } else if (kind === "speckle") {
    for (let i = 0; i < 2400; i += 1) {
      const c = mix(a, b, rnd());
      context.fillStyle = rgb(c, 0.25 + rnd() * 0.6);
      const r = 0.6 + rnd() * 1.8;
      context.fillRect(rnd() * size, rnd() * size, r, r);
    }
    blob(half, half, half, mix(a, b, 0.5), 0.1);
  } else if (kind === "filament") {
    for (let i = 0; i < 90; i += 1) {
      const c = mix(a, b, rnd());
      context.strokeStyle = rgb(c, 0.2 + rnd() * 0.5);
      context.lineWidth = 0.6 + rnd() * 1.6;
      context.beginPath();
      /*
       * Curves, not segments. A polyline of four straight hops reads as
       * wireframe -- which is exactly what it looked like -- and nothing in a
       * universe is made of straight lines meeting at corners.
       */
      let x = rnd() * size;
      let y = rnd() * size;
      context.moveTo(x, y);
      for (let k = 0; k < 3; k += 1) {
        const cx = x + (rnd() - 0.5) * 110;
        const cy = y + (rnd() - 0.5) * 110;
        x += (rnd() - 0.5) * 150;
        y += (rnd() - 0.5) * 150;
        context.quadraticCurveTo(cx, cy, x, y);
      }
      context.stroke();
    }
    for (let i = 0; i < 22; i += 1) blob(rnd() * size, rnd() * size, 12 + rnd() * 34, b, 0.4);
  } else if (kind === "ember") {
    for (let i = 0; i < 26; i += 1) {
      blob(rnd() * size, rnd() * size, 30 + rnd() * 90, mix(a, b, rnd() * 0.6), 0.4 + rnd() * 0.4);
    }
    /*
     * The dark lanes between the cells: the only place anything subtracts.
     * Kept faint and round-capped -- at half alpha with square ends they cut
     * hard black gashes through the disc that read as tears in the image
     * rather than as anything inside a universe.
     */
    context.globalCompositeOperation = "destination-out";
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let i = 0; i < 34; i += 1) {
      context.strokeStyle = "rgba(0,0,0,0.16)";
      context.lineWidth = 3 + rnd() * 9;
      context.beginPath();
      const x = rnd() * size;
      const y = rnd() * size;
      context.moveTo(x, y);
      context.quadraticCurveTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 120,
        x + (rnd() - 0.5) * 190, y + (rnd() - 0.5) * 190);
      context.stroke();
    }
    context.globalCompositeOperation = "lighter";
  } else if (kind === "veil") {
    blob(half + (rnd() - 0.5) * 90, half + (rnd() - 0.5) * 90, half * 1.1, mix(a, b, 0.4), 0.34);
    for (let i = 0; i < 4; i += 1) blob(rnd() * size, rnd() * size, 30 + rnd() * 60, b, 0.3);
  } else if (kind === "core") {
    // Nearly empty, with one thing burning in the middle of it.
    blob(half, half, half * 0.95, mix(a, b, 0.3), 0.12);
    blob(half + (rnd() - 0.5) * 40, half + (rnd() - 0.5) * 40, 20 + rnd() * 40, [1, 1, 1], 0.85);
    blob(half, half, 70 + rnd() * 50, b, 0.32);
  } else if (kind === "ring") {
    // A bright annulus: everything gathered on one shell and the middle dark.
    const ring = context.createRadialGradient(half, half, half * 0.34, half, half, half * 0.92);
    ring.addColorStop(0, rgb(a, 0));
    ring.addColorStop(0.55, rgb(mix(a, b, 0.5), 0.34));
    ring.addColorStop(0.86, rgb(b, 0.8));
    ring.addColorStop(1, rgb(b, 0.05));
    context.fillStyle = ring;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 16; i += 1) blob(rnd() * size, rnd() * size, 14 + rnd() * 34, a, 0.28);
  } else if (kind === "shards") {
    // Broken up: many small hard-edged patches rather than any continuum.
    for (let i = 0; i < 190; i += 1) {
      context.fillStyle = rgb(mix(a, b, rnd()), 0.16 + rnd() * 0.42);
      context.save();
      context.translate(rnd() * size, rnd() * size);
      context.rotate(rnd() * TAU);
      const w = 3 + rnd() * 22;
      context.fillRect(-w / 2, -w / 8, w, Math.max(1, w / 4));
      context.restore();
    }
  } else if (kind === "clouded") {
    // Thick and smooth, almost overcast: very little structure resolves.
    for (let i = 0; i < 7; i += 1) {
      blob(half + (rnd() - 0.5) * 150, half + (rnd() - 0.5) * 150,
        90 + rnd() * 130, mix(a, b, rnd()), 0.26 + rnd() * 0.2);
    }
  } else {
    // swarm: a very dense fine grain, almost monochrome.
    for (let i = 0; i < 4600; i += 1) {
      const bright = 0.35 + rnd() * 0.65;
      context.fillStyle = `rgba(255,255,255,${(0.12 + rnd() * 0.4).toFixed(3)})`;
      context.fillRect(rnd() * size, rnd() * size, bright, bright);
    }
    blob(half, half, half * 0.9, mix(a, b, rnd()), 0.12);
  }

  // Stars, in every one of them.
  for (let i = 0; i < 260; i += 1) {
    const alpha = 0.25 + Math.pow(rnd(), 2) * 0.75;
    context.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    const r = 0.5 + Math.pow(rnd(), 3) * 2.2;
    context.beginPath();
    context.arc(rnd() * size, rnd() * size, r, 0, TAU);
    context.fill();
  }

  /*
   * The limb.
   *
   * A flat disc of texture is a coin. Real ones in the reference all carry a
   * bright ring hard against the edge -- the film seen edge-on, where the line
   * of sight passes through most of it -- and that single detail is what makes
   * a circle read as a sphere.
   */
  const limb = context.createRadialGradient(half, half, half * 0.62, half, half, half);
  limb.addColorStop(0, rgb(b, 0));
  limb.addColorStop(0.82, rgb(b, 0.14));
  limb.addColorStop(0.95, rgb(b, 0.5));
  limb.addColorStop(1, rgb(mix(b, [1, 1, 1], 0.4), 0.75));
  context.fillStyle = limb;
  context.fillRect(0, 0, size, size);
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const UNIVERSE_PAIRS = [
  [[0.52, 0.36, 0.96], [0.24, 0.82, 0.92]],
  [[0.20, 0.68, 0.86], [0.66, 0.94, 0.78]],
  [[0.94, 0.46, 0.40], [0.98, 0.82, 0.42]],
  [[0.32, 0.74, 0.52], [0.84, 0.92, 0.44]],
  [[0.84, 0.36, 0.70], [0.44, 0.44, 0.98]],
  [[0.28, 0.42, 0.92], [0.86, 0.62, 0.98]],
  [[1.00, 0.62, 0.16], [1.00, 0.90, 0.44]],
  [[0.96, 0.24, 0.52], [1.00, 0.62, 0.86]],
  [[0.16, 0.86, 0.72], [0.62, 1.00, 0.90]],
  [[0.70, 0.72, 0.78], [0.94, 0.96, 1.00]],
  [[0.58, 0.22, 0.90], [0.30, 0.60, 1.00]],
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
/*
 * The expanding universe, as a vertex shader.
 *
 * Every grain holds a fixed *comoving* coordinate -- a direction and a log
 * radius -- and its proper position is that coordinate scaled by a(t). One
 * multiply, and Hubble's law falls out of it: differentiate x = chi * a and
 * you get dx/dt = (a'/a) * x = H * x. A grain twice as far recedes twice as
 * fast, because the fabric between it and everything else is stretching, not
 * because it is travelling. Nothing here is thrown.
 *
 * Radius is carried as a logarithm and wrapped, because expansion is a
 * *translation* in log space: ln r = ln r0 + ln a. Wrapping a translation
 * gives a distribution that is exactly stationary, so the field stays evenly
 * filled forever, at every rate of expansion, with no edge and no rim and
 * nothing to recycle on the CPU. A grain leaving the far end reappears at the
 * near end on its own ray, and the fade window at each end means it is never
 * seen to do it.
 *
 * `uK` is the wavenumber of the primordial fluctuation field. It *falls* over
 * the act, so a fine quantum speckle coarsens into patches degrees across --
 * which is not a decoration, it is the single most consequential thing that
 * happened here. Those patches are the seeds every galaxy grew from, and they
 * are still on the sky as the anisotropies of the microwave background.
 */
const EXPANSION_VERTEX = /* glsl */`
  attribute vec3 aDir;
  attribute float aLog;
  attribute float aJitter;
  uniform float uLogA;
  uniform float uSpan;
  uniform float uNear;
  uniform float uOriginZ;
  uniform float uSize;
  uniform float uTemp;
  uniform float uCold;
  uniform float uRipple;
  uniform float uK;
  uniform float uGain;
  varying float vFade;
  varying vec3 vColour;

  float fluctuation(vec3 d, float k) {
    float a = sin(d.x * k * 3.1 + 1.7) * sin(d.y * k * 2.3 - 0.4) * sin(d.z * k * 2.9 + 2.2);
    float b = sin(d.x * k * 7.3 - 2.1) * sin(d.y * k * 6.1 + 0.9) * sin(d.z * k * 5.7 - 1.3);
    return a + b * 0.5;
  }

  void main() {
    float l = mod(aLog + uLogA, uSpan);
    float r = exp(uNear + l);
    vec3 p = aDir * r + vec3(0.0, 0.0, uOriginZ);

    float u = l / uSpan;
    vFade = smoothstep(0.0, 0.10, u) * (1.0 - smoothstep(0.70, 1.0, u));

    // The whole field redshifts together. This is the signature of expansion
    // seen from inside it -- and the observation Hubble's law was read off.
    vec3 hot  = vec3(1.000, 0.955, 0.885);
    vec3 warm = vec3(1.000, 0.706, 0.310);
    vec3 cool = vec3(0.850, 0.244, 0.110);
    /*
     * Every grain sits at its own point on the curve, spread around the mean.
     * A fire is never one colour; a field that is drives straight past plasma
     * and lands on television static, which is what the first pass looked
     * like -- correct in brightness, monochrome, and completely inert.
     */
    float t = clamp(uTemp + (aJitter - 0.42) * 0.62, 0.0, 1.0);
    vec3 c = t < 0.5 ? mix(hot, warm, t * 2.0) : mix(warm, cool, (t - 0.5) * 2.0);
    // Inflation leaves the universe cold, empty and dark. It is not a fire
    // yet; the fire is what the vacuum decays into when the stretching stops.
    c = mix(c, vec3(0.517, 0.596, 0.905), uCold);

    float ripple = 1.0 + fluctuation(aDir, uK) * uRipple;
    // uGain is allowed above one. Additive blending clips the excess to white,
    // which is the only honest way to draw something too bright to look at --
    // and reheating is exactly that: the whole of space catching fire at once.
    vColour = c * (0.52 + aJitter * 0.78) * max(0.0, ripple) * uGain;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    float depth = max(1.0, -viewPosition.z);
    /*
     * A gentle depth cue, deliberately clamped hard at both ends. Full
     * attenuation makes the near grains coin-sized and drives the far ones
     * below a pixel, which turns a fog into a tunnel with a vanishing point in
     * the middle of it -- and a vanishing point reads as a centre.
     */
    gl_PointSize = uSize * (0.55 + aJitter * 0.9) * clamp(150.0 / depth, 1.15, 2.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const EXPANSION_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying float vFade;
  varying vec3 vColour;
  void main() {
    vec4 texel = texture2D(uMap, gl_PointCoord);
    float alpha = texel.a * uOpacity * vFade;
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(vColour, alpha);
  }
`;

/*
 * The cosmic web's own shader.
 *
 * It cannot use the dust one. That derives point size from view depth with no
 * floor, which is right for a field a few hundred units deep and useless for a
 * structure that runs to twelve thousand: every thread past the first couple of
 * knots comes out under a pixel and the whole web renders as an empty sky. The
 * only change that matters is the clamp -- attenuation still gives the near
 * filaments their weight, but nothing is ever allowed to vanish.
 *
 * No twinkle either. The dust twinkles because it is stars; a filament is gas
 * and dark matter, and it does not do anything.
 */
const WEB_VERTEX = /* glsl */`
  attribute vec3 aColour;
  attribute float aScale;
  uniform float uSize;
  uniform float uAtten;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uBall;
  uniform vec3 uBallCentre;
  uniform float uBallRadius;
  varying vec3 vColour;
  varying float vBall;
  void main() {
    vColour = aColour;
    /*
     * Rounded off at the edges while it is nested inside a universe.
     *
     * The web is built as a slab -- wide, shallow, rectangular -- which is
     * invisible from inside it and unmistakable from outside: scaled down to
     * sit within a bubble it read as a bright rectangle floating in the middle
     * of the shot. Nothing in the universe has corners. This dissolves the
     * corners into a sphere when it is being seen from outside, and does
     * nothing at all once the camera is within it.
     */
    float reach = length(position - uBallCentre) / uBallRadius;
    vBall = mix(1.0, 1.0 - smoothstep(0.55, 1.0, reach), uBall);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float depth = max(1.0, -viewPosition.z);
    gl_PointSize = clamp(uSize * aScale * (uAtten / depth), uMinPx, uMaxPx);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const WEB_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec3 vColour;
  varying float vBall;
  void main() {
    vec4 texel = texture2D(uMap, gl_PointCoord);
    float alpha = texel.a * uOpacity * vBall;
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(vColour, alpha);
  }
`;

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

  /*
   * Build stopwatch, on ?introBuild=1 only.
   *
   * The click cannot yield while this function runs, so every millisecond in
   * here is a millisecond the viewer spends looking at a cover. Knowing which
   * section owns them is the difference between trimming the right thing and
   * guessing.
   */
  const buildLog = new URLSearchParams(location.search).get("introBuild") === "1"
    ? (window.__introBuild = [])
    : null;
  let buildAt = buildLog ? performance.now() : 0;
  const buildMark = (name) => {
    if (!buildLog) return;
    const now = performance.now();
    buildLog.push(name + " " + Math.round(now - buildAt) + "ms");
    buildAt = now;
  };

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

  buildMark("before the beginning");
  /* ---------------------------------------------------------- the beginning */

  /*
   * The Big Bang was not an explosion, and this used to be drawn as one.
   *
   * There was a bright core, two flares, a ring of haze and 38,000 grains
   * thrown outward from one place with fixed velocities. Every one of those
   * is a claim about the physics and every one of them is false. An explosion
   * has a centre, a front, and somewhere to expand *into*; the early universe
   * had none of the three. What happened was metric expansion -- space itself
   * stretching, everywhere at once -- and that is not the same event told
   * differently. It looks different, so it has to be drawn differently.
   *
   * What went, and why:
   *
   *   the core     a bright middle is a centre, and there is no centre
   *   the rays     spokes radiate *from* somewhere
   *   the haze     a ring at a fixed radius is a shock front
   *   velocities   things travelling through space, which is the wrong verb
   *
   * What is left is a field at fixed comoving coordinates, scaled by a(t) in
   * the vertex shader. See EXPANSION_VERTEX above for the arithmetic.
   */

  const blast = new THREE.Group();
  scene.add(blast);

  /*
   * The observer is offset from the origin of the scaling, and which way round
   * matters more than it looks.
   *
   * First, why offset at all. Under exact Hubble flow centred on the observer,
   * *nothing moves on screen*: scaling a point by a leaves x/z unchanged, and
   * x/z is its screen position. A literal implementation renders a field that
   * recedes without ever appearing to -- which is a true statement about a
   * comoving observer and a dead one about a shot. Real observers are not
   * exactly comoving anyway; our own galaxy runs at some six hundred
   * kilometres a second with respect to the microwave background. The offset
   * is that peculiar velocity, and it is what makes the flow visible.
   *
   * Second, the sign. The first attempt put the origin *behind* the lens, and
   * the field converged: work the projection through and the screen angle of a
   * grain falls from ninety degrees toward its asymptote as its radius grows,
   * so everything drifted inward and the shot read as flying backwards. The
   * origin has to be in front. Then the angle rises to the asymptote instead
   * and the field opens outward, which is what expansion looks like from a
   * point that is not the centre of it.
   *
   * Third, the near radius is larger than the offset, deliberately. If grains
   * could exist closer to the origin than the camera is, they would all stream
   * out of one bright spot in the middle of the frame -- a radiant, which is a
   * centre, which is the whole thing this act exists to deny. Starting the
   * shell outside the offset means the nearest grains are already spread
   * across the frame and past its edges, and there is nowhere for the eye to
   * find a middle.
   */
  const EXPANSION_COUNT = 88000;
  const EXPANSION_ORIGIN_Z = -30;
  const EXPANSION_NEAR = 34;
  const EXPANSION_SPAN = 3.0;      // ln(far / near): about 20x in radius

  const expansionDir = new Float32Array(EXPANSION_COUNT * 3);
  const expansionLog = new Float32Array(EXPANSION_COUNT);
  const expansionJitter = new Float32Array(EXPANSION_COUNT);
  for (let i = 0; i < EXPANSION_COUNT; i += 1) {
    const i3 = i * 3;
    /*
     * Directions cover the forward hemisphere and a good way round the sides,
     * not the whole sphere. The field is isotropic -- that is not negotiable,
     * homogeneity and isotropy are the assumption the whole model rests on --
     * but the half of it behind the lens is never rasterised, so drawing it
     * costs a vertex each and buys nothing. A culling decision, not a claim
     * about the universe.
     */
    const theta = random() * TAU;
    // Forward, and a good way past the sides. Not the whole sphere: the field
    // is isotropic -- homogeneity and isotropy are the assumption the entire
    // model rests on -- but the part of it behind the lens is never
    // rasterised, so drawing it costs a vertex each and buys nothing.
    const z = -(random() * 1.2 - 0.2);
    const planar = Math.sqrt(Math.max(0, 1 - z * z));
    expansionDir[i3] = planar * Math.cos(theta);
    expansionDir[i3 + 1] = planar * Math.sin(theta);
    expansionDir[i3 + 2] = z;
    /*
     * Uniform in *log* radius, which is what makes the wrap seamless: the
     * expansion translates this value, and a uniform distribution is the only
     * one a translation leaves alone. Sampling radius uniformly -- the obvious
     * thing -- gives a field that visibly thins between one wrap and the next.
     */
    expansionLog[i] = random() * EXPANSION_SPAN;
    expansionJitter[i] = Math.pow(random(), 1.5);
  }

  const expansionGeometry = track(new THREE.BufferGeometry());
  expansionGeometry.setAttribute(
    "position", new THREE.BufferAttribute(new Float32Array(EXPANSION_COUNT * 3), 3),
  );
  expansionGeometry.setAttribute("aDir", new THREE.BufferAttribute(expansionDir, 3));
  expansionGeometry.setAttribute("aLog", new THREE.BufferAttribute(expansionLog, 1));
  expansionGeometry.setAttribute("aJitter", new THREE.BufferAttribute(expansionJitter, 1));

  const expansionMaterial = track(new THREE.ShaderMaterial({
    vertexShader: EXPANSION_VERTEX,
    fragmentShader: EXPANSION_FRAGMENT,
    uniforms: {
      /*
       * A grain of fog, not a grain of light.
       *
       * The old map had a hard white core at a third of the radius, which
       * draws a *dot* -- and forty thousand dots is a star field, however
       * warm they are. Fog is made of soft blobs that overlap: no core to
       * speak of, a long shallow falloff, and low enough alpha that a single
       * one is nearly invisible and it takes a dozen stacked to make a
       * highlight. That is also, literally, what an optically thick medium
       * is -- brightness is depth through it, not any one grain in it.
       */
      uMap: { value: track(createGlowTexture("rgba(255,255,255,0.62)", "rgba(255,226,186,0.3)", 0.52)) },
      uOpacity: { value: 0 },
      uLogA: { value: 0 },
      uSpan: { value: EXPANSION_SPAN },
      uNear: { value: Math.log(EXPANSION_NEAR) },
      uOriginZ: { value: EXPANSION_ORIGIN_Z },
      uSize: { value: px(4.4) },
      uGain: { value: 1 },
      uTemp: { value: 0 },
      uCold: { value: 0 },
      uRipple: { value: 0 },
      uK: { value: 24 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  const expansion = new THREE.Points(expansionGeometry, expansionMaterial);
  expansion.frustumCulled = false;
  expansion.renderOrder = 2;
  blast.add(expansion);

  /*
   * The veil: one flat quad, no texture, no gradient.
   *
   * It covers two moments. At t = 0 there is no separation between any two
   * points, so there is no structure to draw -- the frame is uniformly
   * saturated, and that is what hands over from the gate's blowout without a
   * seam. And at the end of inflation the vacuum decays into a hot plasma
   * everywhere at once, which is a flash with no source in it.
   *
   * A Sprite with no map rasterises as a flat colour, which is exactly the
   * point: a radial glow has a middle, and a middle is a centre. That was the
   * old core sprite's whole problem.
   */
  const veilMaterial = track(new THREE.SpriteMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  veilMaterial.depthTest = false;
  const veil = new THREE.Sprite(veilMaterial);
  veil.renderOrder = 7;
  veil.position.set(0, 0, -4);
  veil.scale.setScalar(260);
  veil.visible = false;
  blast.add(veil);

  const setVeil = (level) => {
    const value = level > 0 ? level : 0;
    veilMaterial.opacity = value;
    veil.visible = value > 0.002;
  };

  const setExpansion = (level) => {
    const value = level > 0 ? level : 0;
    expansionMaterial.uniforms.uOpacity.value = value;
    expansion.visible = value > 0.002;
  };
  setExpansion(0);

  /*
   * a(t), in closed form, as a logarithm.
   *
   * Two eras, and the difference between them is the point of the act.
   * Inflation is exponential -- ln a linear in t, a constant Hubble parameter,
   * the frame torn through faster than the eye can follow. What follows is the
   * radiation era, a ~ sqrt(t), which in log terms is a crawl. Watching the
   * one become the other is watching the universe stop inflating.
   *
   * Written from elapsed time rather than accumulated per frame: bounded,
   * frame-rate independent, and seekable, which is what makes the preview
   * harness honest.
   */
  const INFLATE_MS = 2200;
  /*
   * INFLATE_LOG is a *reading rate*, not the real number.
   *
   * Inflation grew the universe by something like 10^26, which is 60 in these
   * units, and 60 renders as static: each grain would cross its whole visible
   * range in a tenth of a second, and a point sprite cannot streak, so the
   * frame becomes noise rather than motion. At 7.5 a grain takes about half a
   * second to cross, which is the fastest the eye can still follow something
   * rather than merely notice that it flickered. The caption carries the real
   * figure; the picture has to carry the sensation.
   */
  const INFLATE_LOG = 7.5;
  const SLOW_LOG = 1.25;
  function logScaleFactor(ms) {
    if (ms <= INFLATE_MS) {
      // Eased from rest: the first frames are a point, not a field already at
      // speed. Smootherstep, so the ramp has no corner at either end.
      const u = ms / INFLATE_MS;
      return INFLATE_LOG * u * u * u * (u * (u * 6 - 15) + 10);
    }
    return INFLATE_LOG + SLOW_LOG * Math.log(1 + (ms - INFLATE_MS) / 2400);
  }

  buildMark("before star dust");
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
  const dustTarget = new Float32Array(DUST_COUNT * 3);
  const dustColours = new Float32Array(DUST_COUNT * 3);

  for (let i = 0; i < DUST_COUNT; i += 1) {
    const i3 = i * 3;
    const angle = random() * TAU;
    const radius = Math.pow(random(), 0.55) * FIELD_RADIUS;
    dustTarget[i3] = Math.cos(angle) * radius;
    dustTarget[i3 + 1] = Math.sin(angle) * radius * 0.84;
    dustTarget[i3 + 2] = -random() * FIELD_DEPTH;

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
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustTarget.slice(), 3));
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

  buildMark("before bubble universes");
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
      /*
       * A thin skin, and the reason is occlusion.
       *
       * The stars used to fill the outer third, which meant an opaque core
       * could only ever be small enough to hide about a fifth of the disc --
       * and a universe you can see another universe *through* is not a dense
       * thing, it is a soap bubble. Concentrated into a skin, the core can sit
       * just inside it and block nine tenths of the area, so a nearer bubble
       * genuinely hides a further one and only the very limb stays
       * translucent, which is what the edge of anything ought to do.
       */
      const r = 0.955 + random() * 0.045;
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
      const r = 0.952 + random() * 0.048;
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
      const r = 0.948 + random() * 0.05;
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

  /*
   * Twenty, not nine.
   *
   * The act is eleven seconds of travelling and the drift carries the field
   * some three and a half thousand units through it, so at nine bubbles spaced
   * six hundred apart only the first few ever passed the camera and the rest
   * merely swelled in the distance. Packed tighter and carried faster, most of
   * the population now sweeps by.
   */
  const BUBBLE_COUNT = 58;
  /*
   * The first forty-four are the field the journey passes *through*. The rest
   * are placed beyond our own universe, and they are there for one reason:
   * ours was the last thing in the shot. Everything else drifted past it and
   * left nothing behind, so the approach ended on a single object against an
   * empty void -- which reads as the edge of the set rather than as one bubble
   * among uncountably many. A multiverse has no last one.
   */
  const BUBBLE_NEAR_COUNT = 44;
  // Depth at which a bubble has finished its pass and goes back to its slot.
  const BUBBLE_RETIRE_DEPTH = 620;

  /**
   * Builds one bubble: shell, knots and film, in a group that can be scaled
   * and positioned as a unit.
   */
  /*
   * The opaque interior.
   *
   * It has to be in the *opaque* pass, not merely a transparent mesh that
   * writes depth. Transparent objects are sorted back to front, so a far
   * bubble's stars would already have been drawn by the time a near bubble's
   * core got its chance to reject them; only something drawn in the opaque
   * pass, before any of them, occludes reliably.
   *
   * Which is why it cannot fade. When a bubble dissolves on its way past the
   * camera the core shrinks instead, so the far hemisphere is revealed from
   * the limb inward as the near one dims, and the two changes cancel.
   */
  /*
   * One painted universe per variant, and enough variants that no two
   * neighbours in the field are ever the same kind.
   */
  /*
   * One texture per bubble, not one per variant.
   *
   * Twelve textures across forty-four universes meant every third or fourth
   * was a duplicate, and a repeated universe is worse than a dull one: the eye
   * finds the pair immediately and the whole field stops being a population of
   * distinct things. Each is its own kind, its own palette and its own seed,
   * so no two are alike. They are 256px rather than 384 to pay for it.
   */
  const BUBBLE_VARIANT_COUNT = BUBBLE_COUNT;
  const universeTextures = [];
  for (let i = 0; i < BUBBLE_VARIANT_COUNT; i += 1) {
    universeTextures.push(track(createUniverseTexture(
      UNIVERSE_KINDS[(i * 7) % UNIVERSE_KINDS.length],
      UNIVERSE_PAIRS[(i * 5 + 1) % UNIVERSE_PAIRS.length],
      i * 7919 + 13,
    )));
  }
  const bubbleHaloTexture = track(createGlowTexture("rgba(255,255,255,0)", "rgba(255,255,255,0.30)", 0.79));

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
    // Only ours keeps a star population of its own; the rest are painted, and
    // a point cloud on top of a painted disc is two universes in one place.
    if (dense) group.add(shell);

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
    if (dense) group.add(knots);

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
    if (dense) {
      group.add(new THREE.Points(
        dense ? oursGalaxyGeometry : galaxyGeometries[variant], galaxyMaterial,
      ));
    }

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
    if (dense) group.add(new THREE.Mesh(bubbleRimGeometry, rimMaterial));

    /*
     * Every bubble but ours. Ours is the one the journey goes inside, and the
     * one whose contents -- the cosmic web forming within it -- have to be
     * visible from outside long before we get there.
     */
    let body = null;
    let halo = null;
    if (!dense) {
      /*
       * `alphaTest` rather than `transparent`, and that is the whole trick.
       *
       * A transparent sprite is sorted with the transparent pass, back to
       * front, so a far bubble's stars are already drawn by the time a near
       * bubble gets its turn and nothing is ever occluded. With alphaTest and
       * transparent off, the sprite renders in the *opaque* pass -- before any
       * of them, writing depth -- and everything behind it is rejected. The
       * cost is a hard edge, which is why the texture carries its own bright
       * limb and a soft halo is added over the top.
       */
      const bodyMaterial = track(new THREE.SpriteMaterial({
        map: universeTextures[variant],
        transparent: false,
        alphaTest: 0.45,
        depthWrite: true,
        depthTest: true,
      }));
      body = new THREE.Sprite(bodyMaterial);
      body.scale.setScalar(2);
      body.material.rotation = random() * TAU;
      body.renderOrder = -1;
      group.add(body);

      const haloMaterial = track(new THREE.SpriteMaterial({
        map: bubbleHaloTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0,
        color: new THREE.Color(b[0], b[1], b[2]),
      }));
      halo = new THREE.Sprite(haloMaterial);
      halo.scale.setScalar(2.5);
      halo.renderOrder = 1;
      group.add(halo);
    }

    scene.add(group);
    return {
      group, shell, knots, body, halo, palette,
      shellMaterial, knotMaterial, galaxyMaterial, rimMaterial,
      haloMaterial: halo ? halo.material : null,
    };
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
    if (!bubble.shell.parent) return;
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
  /*
   * The arrival ramp is for re-entries only.
   *
   * It exists so that a bubble returned to its slot does not snap on at full
   * strength in the middle of the shot. Applied to the *first* pass as well --
   * which is what it did -- it means every universe in the field fades up out
   * of nothing a moment after the act starts, and the whole population reads
   * as popping into existence rather than as having been there all along.
   * They are lit before the act begins now, during the recombination beat, so
   * on the first pass there is nothing to ramp.
   */
  /*
   * Nothing arrives; things only leave.
   *
   * The fade is now one-sided. A bubble is at full strength from the moment
   * the act opens and dissolves over the last stretch before it reaches the
   * camera, so it goes past rather than through -- which is the only edit the
   * shot needs, because a universe passing the lens and a universe appearing
   * in front of it are very different events and only one of them is wanted.
   */
  /*
   * Nothing arrives, and nothing leaves either.
   *
   * This used to dissolve a bubble over the last stretch before the camera.
   * Combined with a body that cannot fade -- and therefore shrank instead --
   * it read as universes deflating as they came closer. They are placed off
   * the axis and their offset is fixed, so as depth falls the angle off axis
   * only grows: they carry themselves out of the frame, and nothing has to
   * remove them.
   */
  /*
   * ...except at the very end of a pass, and that turned out to be fixable.
   *
   * The reason nothing was allowed to leave is that a painted universe draws
   * in the *opaque* pass -- alphaTest, depthWrite -- which is what lets one
   * hide another, and an opaque material has no opacity to turn down. So the
   * only retire available was `visible = false`, which is a blink.
   *
   * It has one: fade the alphaTest cutoff with the opacity and the silhouette
   * survives the whole dissolve, because the map is a hard-edged disc and the
   * test is measured against the same value it is scaling. A bubble on its way
   * out drops into the transparent pass while it goes -- it stops occluding at
   * exactly the point where it is too faint to occlude anything anyway.
   *
   * With that, a bubble can be dissolved over its own last stretch, on its own
   * radius, rather than having to be carried off the edge of the frame. One
   * that comes down the middle now goes past instead of through.
   */
  function bubbleJourneyFade(bubble) {
    const depth = -bubble.group.position.z;
    const radius = Math.max(1, bubble.group.scale.x);
    return clamp01((depth - radius * 0.65) / (radius * 1.7));
  }

  /*
   * And a universe behind ours goes out as ours grows over it.
   *
   * The field now runs deeper than the destination, which is the whole point
   * -- ours stopped being the last thing in the shot. But ours is a membrane
   * of points rather than a painted disc, so it does not occlude, and a
   * distant universe would otherwise shine straight through the one we are
   * flying into. Fading by angle does what the depth buffer cannot: as ours
   * swells, whatever its disc has grown over dissolves behind it.
   */
  function occludedByOurs(bubble, reach) {
    const depth = -bubble.group.position.z;
    if (depth <= -ours.group.position.z) return 1;
    const off = Math.hypot(bubble.group.position.x, bubble.group.position.y);
    const angle = Math.atan2(off, Math.max(1, depth));
    const alpha = Math.atan(Math.min(8, reach));
    return clamp01((angle - alpha * 0.92) / Math.max(0.06, alpha * 0.55));
  }

  /**
   * Advances one bubble along its pass, returning it to its slot at the end.
   *
   * Returns true while it still has somewhere to go.
   */
  /*
   * They travel, and they never come back.
   *
   * Recycling was the whole reason universes appeared out of nowhere: a bubble
   * that reached the camera was returned to its slot at the far end and had to
   * fade in there, which from inside the shot is something arriving in empty
   * space. With the field deep enough to last the act there is nothing to
   * recycle -- every bubble the viewer ever sees is on screen from the first
   * frame of the act, and the only thing that happens to any of them is that
   * they get closer and then pass.
   */
  function driftBubble(bubble, step) {
    bubble.group.position.z += step;
  }

  /*
   * Universes condensing out of the fog.
   *
   * They used only to fade up, which is a thing appearing rather than a thing
   * forming. Growing them out of nothing over the same beat that the plasma
   * clears makes the reveal causal: the grains of the expanding field thin
   * out, and what is left standing in their place are the bubbles. Called
   * only during that beat -- afterwards they hold their size for life, because
   * a universe that changes size while you travel toward it is the wrong
   * thing entirely.
   */
  function setBubbleGrowth(bubble, growth) {
    const g = Math.max(0.001, Math.min(1, growth));
    if (bubble.body) {
      bubble.body.scale.setScalar(2 * g);
      bubble.halo.scale.setScalar(2.5 * g);
    } else {
      bubble.group.scale.setScalar(bubble.baseScale * g);
    }
  }

  function setBubbleOpacity(bubble, value, gain = 1) {
    const v = Math.max(0, value);
    bubble.shellMaterial.opacity = v;
    bubble.knotMaterial.opacity = Math.min(1, v * gain);
    bubble.galaxyMaterial.opacity = Math.min(1, v * 0.85 * gain);
    // Softer than it was: with an opaque interior only the near half of the
    // film draws, so what used to read as an iridescent edge became a flat
    // wash of colour across the whole disc.
    bubble.rimMaterial.uniforms.uOpacity.value = v * 0.15;
    if (bubble.body) {
      /*
       * Never resized, and only ever faded as a whole field.
       *
       * The previous version shrank each bubble as it approached, to retire it
       * without breaking the opaque pass -- and a universe that gets smaller
       * the closer you come to it is the most conspicuous wrong thing in the
       * shot. They keep their size for their whole life now and are simply
       * travelled past: every one is placed off the axis, and its offset is
       * fixed while its depth falls, so it moves *away* from the middle of the
       * frame as it nears and leaves at the edge without ever being retired.
       */
      const lit = Math.min(1, v / 0.85);
      /*
       * Opaque while it is a universe; transparent while it is leaving.
       *
       * At full strength it stays in the opaque pass, which is what makes the
       * field read as solid: a near bubble hides a far one. Below that it
       * moves to the transparent pass and the alphaTest cutoff comes down with
       * the opacity, so the disc keeps its hard edge all the way to nothing
       * instead of being clipped away the moment the fill drops under the
       * fixed cutoff. Nothing here needs a recompile: `transparent` only picks
       * the render list, and the cutoff is a uniform.
       */
      const bodyMaterial = bubble.body.material;
      const solid = lit > 0.995;
      bodyMaterial.transparent = !solid;
      bodyMaterial.depthWrite = solid;
      bodyMaterial.opacity = lit;
      bodyMaterial.alphaTest = Math.max(0.02, 0.45 * lit);
      bubble.body.visible = lit > 0.012;
      bubble.halo.visible = lit > 0.012;
      bubble.haloMaterial.opacity = lit * 0.42;
    }
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
      /*
       * ...but only against bubbles at a comparable distance.
       *
       * Applied to every pair regardless of depth -- which is what it did --
       * this caps the whole population at whatever will pack onto the sky
       * without touching, about two dozen, and forbids ever putting one behind
       * another. The field then empties as the journey travels through it,
       * which is why bubbles had to be recycled, which is why they appeared
       * out of nothing. Two universes at very different depths overlapping on
       * screen reads perfectly well -- distant things are behind near things.
       */
      const nearer = Math.min(-z, -slot.z);
      const further = Math.max(-z, -slot.z);
      if (nearer / further > 0.58 && between < (alpha + slot.alpha) * 1.2) return false;

      // And a true 3D test as well.
      const dx = x - slot.x;
      const dy = y - slot.y;
      const dz = z - slot.z;
      const needed = (radius + slot.radius) * 1.15;
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
  ours.baseScale = 620;
  ours.group.position.set(0, 0, OURS_START_Z);
  ours.group.scale.setScalar(620);
  bubbles.push(ours);

  // The angular half-size ours occupies down the middle of the shot. Every
  // other bubble has to clear it with room to spare.
  const OURS_ALPHA = 620 / -OURS_START_Z;

  for (let i = 1; i < BUBBLE_COUNT; i += 1) {
    const bubble = createBubble(i, UNIVERSE_PAIRS[i % UNIVERSE_PAIRS.length], false);
    let slot = null;
    for (let attempt = 0; attempt < 90 && !slot; attempt += 1) {
      const deep = i >= BUBBLE_NEAR_COUNT;
      const z = deep
        ? OURS_START_Z - 700 - (i - BUBBLE_NEAR_COUNT) * 360 - random() * 300
        : -1050 - Math.floor((i - 1) / 4) * 780 - random() * 260;
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
      /*
       * The far set is held in a narrower cone and drawn smaller. Out at nine
       * or ten thousand the frustum is enormous, and the near set's angular
       * band -- which runs out past fifty degrees off axis -- puts most of a
       * population that far back outside the frame entirely, which is why the
       * bubbles already placed behind ours were never actually seen. These sit
       * between about eighteen and thirty-five degrees: clear of the corridor
       * ours occupies, and inside the shot for the whole approach.
       */
      const radial = deep
        ? depth * (0.32 + random() * 0.38)
        : depth * (0.48 + random() * 0.78);
      const radius = deep
        ? depth * (0.075 + random() * 0.055)
        : depth * (0.13 + random() * 0.10);
      const x = Math.cos(angle) * radial;
      const y = Math.sin(angle) * radial * 0.82;
      // Stay out of the corridor ours occupies down the axis.
      const fromAxis = Math.atan2(Math.hypot(x, y), depth);
      if (fromAxis < radius / depth + OURS_ALPHA * 1.25) continue;
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

  /* --------------------------------------------------- the fog gathering */

  /*
   * How a universe gets made, drawn as the thing that makes it.
   *
   * The bubbles used to grow during the last beat of the burst and that was
   * all: the plasma cleared, and separately, universes were present. Nothing
   * connected the two, so the field read as having been faded in -- which is
   * exactly what the viewer said it looked like.
   *
   * What is missing from that account is the *cause*, and eternal inflation
   * supplies one that is both true and photogenic. Inflation does not switch
   * off everywhere at once; it stops in patches, and each patch that stops
   * cools and closes off into a universe while the stretching carries on
   * around it. So the fog is given somewhere to go. Every bubble is seeded
   * with a cloud of grains drawn from the same plasma, at the same colour,
   * and over the act each cloud falls inward onto the sphere it is going to
   * become -- warm and diffuse at the start, the universe's own colours by
   * the time it arrives, gone by the time the painted body is solid.
   *
   * One geometry and one draw call for the whole field. Each grain carries
   * where it starts, where it ends, when it goes and what colour it becomes,
   * and the vertex shader does the rest; nothing here touches the CPU per
   * frame beyond a single uniform.
   */
  const CONDENSE_PER_BUBBLE = 420;
  const condenseCount = bubbles.length * CONDENSE_PER_BUBBLE;
  const condenseStart = new Float32Array(condenseCount * 3);
  const condenseEnd = new Float32Array(condenseCount * 3);
  const condenseTiming = new Float32Array(condenseCount * 2);
  const condenseTint = new Float32Array(condenseCount * 3);
  const condenseSeed = new Float32Array(condenseCount);

  const onSphere = (out, index) => {
    const theta = random() * TAU;
    const z = random() * 2 - 1;
    const planar = Math.sqrt(Math.max(0, 1 - z * z));
    out[index] = planar * Math.cos(theta);
    out[index + 1] = planar * Math.sin(theta);
    out[index + 2] = z;
  };
  const scratch = new Float32Array(3);

  bubbles.forEach((bubble, index) => {
    const centre = bubble.group.position;
    const radius = bubble.group.scale.x;
    const palette = bubble.palette || UNIVERSE_PAIRS[0];
    for (let k = 0; k < CONDENSE_PER_BUBBLE; k += 1) {
      const i = index * CONDENSE_PER_BUBBLE + k;
      const i3 = i * 3;
      /*
       * Out of a cloud several times the bubble's own size, because that is
       * the shape of the thing: a patch of fog far larger than what it ends
       * up as, falling together. A shell of grains already at the final
       * radius would only be the bubble's own limb, brightened.
       */
      onSphere(scratch, 0);
      const reach = radius * (2.4 + random() * 4.2);
      condenseStart[i3] = centre.x + scratch[0] * reach;
      condenseStart[i3 + 1] = centre.y + scratch[1] * reach;
      condenseStart[i3 + 2] = centre.z + scratch[2] * reach;

      onSphere(scratch, 0);
      const settle = radius * (0.88 + random() * 0.14);
      condenseEnd[i3] = centre.x + scratch[0] * settle;
      condenseEnd[i3 + 1] = centre.y + scratch[1] * settle;
      condenseEnd[i3 + 2] = centre.z + scratch[2] * settle;

      // Staggered per grain and per bubble, so the field does not arrive on
      // one frame -- but every grain is home before the act ends.
      condenseTiming[i * 2] = ((index % 6) * 0.045 + random() * 0.26) * 0.9;
      condenseTiming[i * 2 + 1] = 0.5 + random() * 0.16;

      // Written out: `lerp` is declared further down the file and this runs
      // while the module body is still executing. See the traps list.
      const mix = random();
      condenseTint[i3] = palette[0][0] + (palette[1][0] - palette[0][0]) * mix;
      condenseTint[i3 + 1] = palette[0][1] + (palette[1][1] - palette[0][1]) * mix;
      condenseTint[i3 + 2] = palette[0][2] + (palette[1][2] - palette[0][2]) * mix;
      condenseSeed[i] = random();
    }
  });

  const condenseGeometry = track(new THREE.BufferGeometry());
  condenseGeometry.setAttribute("position", new THREE.BufferAttribute(condenseStart, 3));
  condenseGeometry.setAttribute("aStart", new THREE.BufferAttribute(condenseStart, 3));
  condenseGeometry.setAttribute("aEnd", new THREE.BufferAttribute(condenseEnd, 3));
  condenseGeometry.setAttribute("aTiming", new THREE.BufferAttribute(condenseTiming, 2));
  condenseGeometry.setAttribute("aTint", new THREE.BufferAttribute(condenseTint, 3));
  condenseGeometry.setAttribute("aSeed", new THREE.BufferAttribute(condenseSeed, 1));

  const condenseMaterial = track(new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      attribute vec3 aStart;
      attribute vec3 aEnd;
      attribute vec2 aTiming;
      attribute vec3 aTint;
      attribute float aSeed;
      uniform float uT;
      uniform float uSize;
      varying float vFade;
      varying vec3 vColour;
      void main() {
        float t = clamp((uT - aTiming.x) / aTiming.y, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        vec3 p = mix(aStart, aEnd, e);
        // Plasma on the way in, the universe's own light once it is there.
        vColour = mix(vec3(1.0, 0.76, 0.44), aTint, e);
        // Never seen to appear and never seen to leave: it fades up out of
        // the fog it belongs to and out again under the body it becomes.
        vFade = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.70, 1.0, t));
        vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
        /*
         * Flat in screen space, deliberately.
         *
         * The usual 1/depth attenuation is wrong for this field: these clouds
         * are placed at depths from one thousand to eleven, and every bubble's
         * radius scales with its own depth so that they all subtend a similar
         * angle. Attenuating by distance therefore shrinks the far clouds
         * relative to the bubbles they belong to -- and at eleven thousand it
         * put every grain under a pixel, which is why the first pass at this
         * looked like nothing was happening at all.
         */
        gl_PointSize = clamp(uSize * (0.6 + aSeed * 1.1), 2.0, 13.0);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying float vFade;
      varying vec3 vColour;
      void main() {
        vec4 texel = texture2D(uMap, gl_PointCoord);
        float alpha = texel.a * uOpacity * vFade;
        if (alpha <= 0.004) discard;
        gl_FragColor = vec4(vColour, alpha);
      }
    `,
    uniforms: {
      uMap: { value: track(createGlowTexture("rgba(255,255,255,0.9)", "rgba(255,214,164,0.34)", 0.42)) },
      uOpacity: { value: 0 },
      uT: { value: 0 },
      uSize: { value: px(4.4) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }));
  const condensate = new THREE.Points(condenseGeometry, condenseMaterial);
  condensate.frustumCulled = false;
  condensate.visible = false;
  scene.add(condensate);

  function setCondense(t, level = 1) {
    const value = clamp01(level);
    condenseMaterial.uniforms.uT.value = t;
    condenseMaterial.uniforms.uOpacity.value = value;
    condensate.visible = value > 0.003 && t < 1.02;
  }

  /*
   * One approach, spread across two acts.
   *
   * It used to be two separate moves. Ours crawled forward at a fraction of
   * the drift for eleven seconds -- close enough to standing still that the
   * destination did not appear to be getting any nearer -- and then the
   * approach took over and covered the remaining five thousand units in eight,
   * while simultaneously swelling the bubble sevenfold. Both rates jumped at
   * the seam, one of them by a factor of seven, and what that looks like from
   * inside the shot is being yanked toward the thing you were drifting past.
   *
   * So there is no seam. Distance falls linearly across the whole nineteen and
   * a half seconds -- one closing rate, never changing -- and the radius grows
   * *exponentially* over the same span, which is the only growth law that
   * looks like constant travel: a constant relative rate. Angular size then
   * rises smoothly from about six degrees to filling the sky, with no moment
   * anywhere in it where the shot changes gear.
   *
   * The radius is a cheat and remains one. A universe cannot be flown into at
   * two hundred units a second; the scale compression has to go somewhere, and
   * putting all of it in a smooth exponential is what keeps it invisible.
   */
  const OURS_FULL_SCALE = 4600;
  const OURS_ARRIVAL_Z = 360;
  const OURS_GROWTH = Math.log(OURS_FULL_SCALE / 620);

  // Written out rather than reaching for lerp: this file's helpers are
  // declared further down, and OURS_CROSSING below is solved at build time.
  const oursDistanceAt = (t) => -OURS_START_Z + (-OURS_ARRIVAL_Z - -OURS_START_Z) * t;

  function placeOurs(u) {
    const t = clamp01(u);
    const distance = oursDistanceAt(t);
    const scale = 620 * Math.exp(OURS_GROWTH * t);
    ours.group.position.z = -distance;
    ours.baseScale = scale;
    ours.group.scale.setScalar(scale);
    // Angular radius as a fraction of the distance: 1 is the wall.
    return scale / distance;
  }

  /*
   * Where the camera crosses the wall, solved rather than guessed.
   *
   * The old act faded the interior up over a fixed slice of its own local
   * time, which was only ever right for the numbers it was tuned against.
   * Radius and distance are both known functions of u, so the crossing is
   * simply where they meet, and every fade that belongs to being *inside* can
   * be keyed off it and stay correct if either curve is ever changed.
   */
  const OURS_CROSSING = (() => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 48; i += 1) {
      const mid = (lo + hi) / 2;
      if (620 * Math.exp(OURS_GROWTH * mid) < oursDistanceAt(mid)) lo = mid; else hi = mid;
    }
    return lo;
  })();

  buildMark("before galaxies");
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

  buildMark("before cosmic web");
  /* ------------------------------------------------------------ cosmic web */

  /*
   * What you actually meet on the way into a universe.
   *
   * Galaxies are not scattered through space at random. They sit on a
   * structure -- the largest one there is -- of long filaments of gas and dark
   * matter enclosing enormous, almost perfectly empty voids, with clusters of
   * galaxies at the points where filaments meet. Surveys that plot hundreds of
   * thousands of galaxies all come back with the same picture: threads, knots,
   * and holes. It is the shape the primordial fluctuations grew into, so it is
   * also the direct descendant of the mottling drawn in the first act.
   *
   * Drawing it as scattered galaxies, which is what this did, throws away the
   * one fact about large-scale structure that anybody knows.
   *
   * Built as a graph, not as noise:
   *
   *   nodes       rejection-sampled with a minimum separation, which is what
   *               opens the voids -- uniform sampling has no holes in it
   *   filaments   each node joined to its nearest few neighbours within reach,
   *               deduplicated, then drawn as a curved chain of points that is
   *               thinnest in the middle and flares where it meets a node
   *   knots       a denser, warmer spheroid at each node, brightest where the
   *               most filaments converge, because that is what a cluster is
   */
  const webGroup = new THREE.Group();
  webGroup.visible = false;
  scene.add(webGroup);

  /*
   * The scale is the whole difficulty.
   *
   * Built small and near -- which it was first -- the camera is inside a knot
   * within a second or two, and what reaches the screen is a few enormous
   * blobs joined by bright bands. The structure is only structure if enough of
   * it fits in the frame at once, so the web is an order of magnitude larger
   * than every other population here and starts well ahead of the lens. It is
   * also stepped at a little over half the field's rate, because it is much
   * further away and moving it at the same speed flattens the parallax that
   * tells the eye how big it is.
   */
  /*
   * Wide and shallow, not deep.
   *
   * A deep box cannot fill the frame. The frustum widens with distance -- at
   * eight thousand units it is fifteen thousand across -- so a web nineteen
   * hundred wide occupies a quarter of the screen at its far end and reads as
   * a blob of structure floating in empty space, which is the exact opposite
   * of the claim. Flattening the volume into a slab that is wider than the
   * frustum at every depth it actually occupies means the web reaches the
   * edges of the frame, on every side, the whole way through -- and it takes
   * *fewer* nodes to do it, because they are at distances where each one
   * subtends something.
   */
  const WEB_NODES = 3000;
  const WEB_SPAN_XY = 3200;
  /*
   * The near edge is *behind* the lens, deliberately.
   *
   * There is no outside to the cosmic web -- it is not a thing sitting in
   * space ahead of us, it is the arrangement of everything, in every
   * direction, all the way out. Starting it in front of the camera made it a
   * wall being approached; starting it behind means the journey is already
   * inside it before the act begins, and filaments pass on both sides and
   * overhead rather than only receding ahead.
   */
  const WEB_NEAR_Z = 1600;
  const WEB_FAR_Z = -6200;
  const WEB_MIN_GAP = 230;      // the void scale
  const WEB_LINK_REACH = 690;
  const WEB_LINKS_PER_NODE = 3;
  /*
   * The web's share of the cruise, chosen so the seam out of the web act has
   * nothing to step over.
   *
   * The web act marches from Laniakea's opening depth to the lens over its own
   * duration, which works out at very close to two hundred units a second, and
   * the act after it damps toward CRUISE * WEB_DRIFT. At 0.55 that target was
   * eighty-two, so the shot halved its pace at the moment the galaxies
   * resolved -- one of the two places the journey still changed gear. Set from
   * the arithmetic instead of by eye.
   */
  const WEB_DRIFT = 1.32;

  const webNodePositions = [];
  /*
   * Rejection sampling with a floor on separation, on a grid.
   *
   * The floor is what opens the voids -- uniform sampling has no holes in it --
   * but comparing every candidate against every node already placed is
   * quadratic, and at four hundred nodes with a high occupancy that is tens of
   * millions of distance checks during construction. Bucketing by the
   * separation itself means only the twenty-seven neighbouring cells can ever
   * contain a conflict, which makes each candidate constant time.
   *
   * The attempt cap is still there. Near the end the last few nodes can take
   * thousands of tries each, and a loop that runs until the box is full has no
   * bound at all if the box cannot be filled.
   */
  {
    const cells = new Map();
    const key = (a, b, c) => `${a}|${b}|${c}`;
    const gapSq = WEB_MIN_GAP * WEB_MIN_GAP;
    let attempts = 0;
    while (webNodePositions.length < WEB_NODES && attempts < WEB_NODES * 140) {
      attempts += 1;
      const x = (random() * 2 - 1) * WEB_SPAN_XY;
      const y = (random() * 2 - 1) * WEB_SPAN_XY * 0.78;
      const z = WEB_NEAR_Z + random() * (WEB_FAR_Z - WEB_NEAR_Z);
      const cx = Math.floor(x / WEB_MIN_GAP);
      const cy = Math.floor(y / WEB_MIN_GAP);
      const cz = Math.floor(z / WEB_MIN_GAP);
      let ok = true;
      for (let dx = -1; dx <= 1 && ok; dx += 1) {
        for (let dy = -1; dy <= 1 && ok; dy += 1) {
          for (let dz = -1; dz <= 1 && ok; dz += 1) {
            const bucket = cells.get(key(cx + dx, cy + dy, cz + dz));
            if (!bucket) continue;
            for (let i = 0; i < bucket.length; i += 1) {
              const n = bucket[i];
              const ex = n.x - x;
              const ey = n.y - y;
              const ez = n.z - z;
              if (ex * ex + ey * ey + ez * ez < gapSq) { ok = false; break; }
            }
          }
        }
      }
      if (!ok) continue;
      const node = { x, y, z, degree: 0 };
      webNodePositions.push(node);
      const id = key(cx, cy, cz);
      const bucket = cells.get(id);
      if (bucket) bucket.push(node); else cells.set(id, [node]);
    }
  }

  const webLinks = [];
  {
    const seen = new Set();
    for (let i = 0; i < webNodePositions.length; i += 1) {
      const a = webNodePositions[i];
      const near = [];
      for (let j = 0; j < webNodePositions.length; j += 1) {
        if (j === i) continue;
        const b = webNodePositions[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        if (d < WEB_LINK_REACH) near.push({ j, d });
      }
      near.sort((p1, p2) => p1.d - p2.d);
      for (let k = 0; k < Math.min(WEB_LINKS_PER_NODE, near.length); k += 1) {
        const j = near[k].j;
        const key = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        webLinks.push({ a: i, b: j, length: near[k].d });
        webNodePositions[i].degree += 1;
        webNodePositions[j].degree += 1;
      }
    }
  }

  /*
   * Two populations, because they are two different things.
   *
   * The threads are cold and faint -- most of what is in them is dark and the
   * gas between is thin and unlit. The knots are warm and bright, because they
   * are galaxies. Drawing both at one colour and one size collapses the
   * structure into a cloud, and the whole point of the web is that it has
   * places in it where things gather.
   */
  /*
   * And it is not one colour.
   *
   * The threads ran a narrow band of blues, which is a fair guess at gas in
   * the dark and a waste of the only act where the structure is the whole
   * frame. Filaments are lit by whatever is in them -- shocked gas, the
   * outskirts of clusters, quasars behind them -- and a survey plot of the
   * real thing is full of colour. Six hues through the threads and six through
   * the knots, with a small fraction of grains drawn much brighter and larger,
   * so the web sparkles rather than glowing evenly.
   */
  const WEB_THREAD_COLOURS = [
    [0.46, 0.58, 0.96],   // cold blue
    [0.38, 0.76, 0.94],   // cyan
    [0.66, 0.52, 0.98],   // violet
    [0.90, 0.56, 0.88],   // magenta
    [0.50, 0.88, 0.82],   // teal
    [0.84, 0.74, 1.00],   // pale lilac
  ];
  const WEB_KNOT_COLOURS = [
    [1.00, 0.74, 0.36],   // gold
    [1.00, 0.54, 0.28],   // amber
    [1.00, 0.88, 0.66],   // warm white
    [0.70, 0.90, 1.00],   // ice
    [1.00, 0.60, 0.72],   // rose
    [0.76, 1.00, 0.88],   // green-white
  ];

  function buildWebPopulation(fill) {
    const positions = [];
    const colours = [];
    const scales = [];
    const phases = [];
    const rates = [];
    fill((x, y, z, rgb, scale) => {
      positions.push(x, y, z);
      colours.push(rgb[0], rgb[1], rgb[2]);
      scales.push(scale);
      phases.push(random() * TAU);
      rates.push(0.3 + random() * 0.9);
    });
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("aColour", new THREE.BufferAttribute(new Float32Array(colours), 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(new Float32Array(scales), 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(phases), 1));
    geometry.setAttribute("aRate", new THREE.BufferAttribute(new Float32Array(rates), 1));
    return geometry;
  }

  const webThreadGeometry = buildWebPopulation((put) => {
    for (let i = 0; i < webLinks.length; i += 1) {
      const link = webLinks[i];
      const a = webNodePositions[link.a];
      const b = webNodePositions[link.b];
      /*
       * A curved thread, not a line segment.
       *
       * Straight lines between points is a wireframe, and a wireframe of the
       * universe is a diagram of it. One quadratic control point offset
       * perpendicular to the run is enough to make each filament sag its own
       * way, which is what stops the graph reading as a graph.
       */
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const mz = (a.z + b.z) / 2;
      const bow = link.length * 0.16;
      const cx = mx + gaussian() * bow;
      const cy = my + gaussian() * bow;
      const cz = mz + gaussian() * bow;
      const count = Math.min(220, Math.round(link.length * 0.26));
      for (let k = 0; k < count; k += 1) {
        const t = random();
        const u = 1 - t;
        const px = u * u * a.x + 2 * u * t * cx + t * t * b.x;
        const py = u * u * a.y + 2 * u * t * cy + t * t * b.y;
        const pz = u * u * a.z + 2 * u * t * cz + t * t * b.z;
        // Thinnest at mid-span, flaring into whatever it is joining.
        const waist = 1 - 4 * t * (1 - t);
        const spread = 8 + waist * waist * 44;
        const rgb = WEB_THREAD_COLOURS[(i + k) % WEB_THREAD_COLOURS.length];
        /*
         * Faint on purpose -- most of what is in a filament is dark, and the
         * gas between knots is thin and barely lit -- except for a few in a
         * hundred, which are drawn at full strength and several times the
         * size. Those are what make the thread read as something granular
         * catching the light rather than as a drawn line.
         */
        const sparkle = random() < 0.06;
        const dim = sparkle ? 1.05 : 0.42 + random() * 0.5;
        put(
          px + gaussian() * spread,
          py + gaussian() * spread,
          pz + gaussian() * spread,
          [rgb[0] * dim, rgb[1] * dim, rgb[2] * dim],
          sparkle ? 1.7 + random() * 1.5 : 0.42 + Math.pow(random(), 2.4) * 0.72,
        );
      }
    }
  });

  const webKnotGeometry = buildWebPopulation((put) => {
    for (let i = 0; i < webNodePositions.length; i += 1) {
      const node = webNodePositions[i];
      // The more filaments meet here, the bigger the cluster sitting on it.
      const weight = Math.min(1, node.degree / 5);
      const radius = 18 + weight * 34;
      /*
       * Fewer points in the knots than in the threads, which is the opposite
       * of the first attempt and the thing that made it read. Weight it the
       * other way and the web becomes a scattering of bright balls with some
       * haze between them -- the knots win the eye, and the network, which is
       * the whole subject, is what gets lost.
       */
      const count = Math.round(16 + weight * 34);
      for (let k = 0; k < count; k += 1) {
        const theta = random() * TAU;
        const zc = random() * 2 - 1;
        const planar = Math.sqrt(Math.max(0, 1 - zc * zc));
        const r = Math.pow(random(), 0.55) * radius;
        const rgb = WEB_KNOT_COLOURS[(i + k) % WEB_KNOT_COLOURS.length];
        const centre = 1 - r / radius;
        const dim = 0.4 + centre * 0.75 + random() * 0.25;
        put(
          node.x + planar * Math.cos(theta) * r,
          node.y + planar * Math.sin(theta) * r * 0.9,
          node.z + zc * r,
          [Math.min(1, rgb[0] * dim), Math.min(1, rgb[1] * dim), Math.min(1, rgb[2] * dim)],
          0.8 + Math.pow(random(), 1.6) * 1.9,
        );
      }
    }
  });

  // Collected so the ball-fade uniform can be driven across all of them at
  // once. Declared here, above the factory that fills it: `const` is not
  // hoisted, and the factory runs during setup.
  const webMaterials = [];

  function makeWebMaterial(map, size, minPx, maxPx) {
    const material = track(new THREE.ShaderMaterial({
      vertexShader: WEB_VERTEX,
      fragmentShader: WEB_FRAGMENT,
      uniforms: {
        uMap: { value: map },
        uOpacity: { value: 0 },
        uSize: { value: px(size) },
        // Unity at this distance; nearer filaments swell, further ones shrink
        // until the clamp catches them.
        uAtten: { value: 2600 },
        uMinPx: { value: px(minPx) },
        uMaxPx: { value: px(maxPx) },
        uBall: { value: 0 },
        uBallCentre: { value: new THREE.Vector3(0, 0, -1100) },
        uBallRadius: { value: 3600 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }));
    webMaterials.push(material);
    return material;
  }

  const webThreadMaterial = makeWebMaterial(
    track(createGlowTexture("rgba(255,255,255,1)", "rgba(186,198,255,0.32)", 0.22)), 2.7, 1.3, 3.6,
  );
  const webKnotMaterial = makeWebMaterial(
    track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,206,142,0.5)", 0.28)), 2.2, 1.0, 3.2,
  );

  const webThreads = new THREE.Points(webThreadGeometry, webThreadMaterial);
  webThreads.frustumCulled = false;
  webThreads.renderOrder = 1;
  webGroup.add(webThreads);

  const webKnots = new THREE.Points(webKnotGeometry, webKnotMaterial);
  webKnots.frustumCulled = false;
  webKnots.renderOrder = 2;
  webGroup.add(webKnots);

  /*
   * And nothing resolvable on it.
   *
   * There were 22 galaxy sprites sitting on the busiest nodes, and they were a
   * category error. The web is the view from far enough out that a *cluster*
   * is a point -- a knot here is a thousand galaxies, not one -- so a
   * recognisable spiral disc drawn on a filament is like drawing a house on a
   * map of a continent. Galaxies belong to the act after this one, which is
   * what dropping into a single crossing is for.
   */

  /*
   * Laniakea.
   *
   * One crossing in the web, picked out and lit far brighter than the rest,
   * because the journey has to arrive somewhere and an arrival needs a
   * destination you could see coming. It is chosen rather than placed: the
   * busiest node -- the one the most filaments run into, which is what a rich
   * cluster physically is -- among those close enough to the axis that
   * steering onto it is a drift rather than a swerve, and at a depth the act's
   * own travel will actually reach.
   */
  const laniakea = (() => {
    let best = null;
    for (let i = 0; i < webNodePositions.length; i += 1) {
      const node = webNodePositions[i];
      if (Math.abs(node.x) > 950 || Math.abs(node.y) > 700) continue;
      if (node.z > -3600 || node.z < -4600) continue;
      if (!best || node.degree > best.degree) best = node;
    }
    // Never null in practice, but the act must not depend on the sampler
    // having put a node in that window.
    return best ?? { x: 0, y: 0, z: -4100, degree: 4 };
  })();

  const laniakeaGeometry = buildWebPopulation((put) => {
    /*
     * Wide and grainy rather than tight and bright.
     *
     * The first version piled four thousand large points into a hundred and
     * fifty units with the brightness climbing toward the middle, and additive
     * blending did the rest: a featureless white disc that read as a star. A
     * cluster is a *concentration*, not a source -- it has to stay granular
     * all the way in, which means spreading it out, holding every grain well
     * below saturation, and letting the density alone make the middle bright.
     */
    const RADIUS = 260;
    for (let i = 0; i < 3600; i += 1) {
      const theta = random() * TAU;
      const zc = random() * 2 - 1;
      const planar = Math.sqrt(Math.max(0, 1 - zc * zc));
      const r = Math.pow(random(), 1.15) * RADIUS;
      const centre = 1 - r / RADIUS;
      const rgb = WEB_KNOT_COLOURS[i % WEB_KNOT_COLOURS.length];
      const dim = 0.34 + centre * 0.34 + random() * 0.26;
      put(
        laniakea.x + planar * Math.cos(theta) * r,
        laniakea.y + planar * Math.sin(theta) * r * 0.92,
        laniakea.z + zc * r * 0.9,
        [rgb[0] * dim, rgb[1] * dim, rgb[2] * dim],
        0.6 + Math.pow(random(), 1.7) * 1.5,
      );
    }
  });

  const laniakeaMaterial = makeWebMaterial(
    track(createGlowTexture("rgba(255,255,255,1)", "rgba(255,226,178,0.5)", 0.3)), 2.3, 1.2, 4.2,
  );
  const laniakeaKnot = new THREE.Points(laniakeaGeometry, laniakeaMaterial);
  laniakeaKnot.frustumCulled = false;
  laniakeaKnot.renderOrder = 3;
  webGroup.add(laniakeaKnot);

  // The haze it sits in, so it reads as lit rather than as more points.
  const laniakeaGlowMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,244,222,0.55)", "rgba(255,196,120,0.22)", 0.34)),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  }));
  const laniakeaGlow = new THREE.Sprite(laniakeaGlowMaterial);
  laniakeaGlow.position.set(laniakea.x, laniakea.y, laniakea.z);
  laniakeaGlow.scale.setScalar(760);
  laniakeaGlow.renderOrder = 2;
  webGroup.add(laniakeaGlow);

  function setLaniakeaLevel(level, bloom = 0) {
    const value = level > 0 ? (level > 1 ? 1 : level) : 0;
    const lit = bloom > 0 ? (bloom > 1 ? 1 : bloom) : 0;
    /*
     * It has to be gone before it reaches the lens.
     *
     * The haze is a single sprite, and a sprite is culled by its centre: the
     * frame its origin crosses z = 0 the whole thing disappears at once. With
     * the bloom at full strength that is the brightest object in the shot
     * blinking out in one frame -- a measured drop of forty levels out of two
     * hundred and fifty-five, which is a flash, not a transition. The point
     * cloud around it does not have the problem, because points are culled one
     * at a time and thousands of them spread over hundreds of units dissolve
     * gradually all by themselves.
     */
    const worldZ = laniakea.z + webGroup.position.z;
    const clear = clamp01((-worldZ - 70) / 430);
    laniakeaMaterial.uniforms.uOpacity.value = value * (0.8 + lit * 0.2);
    laniakeaKnot.visible = value > 0.003;
    applyFade(laniakeaGlow, value * (0.26 + lit * 0.5) * clear);
  }

  /*
   * The web starts out *inside* our universe, and grows into being all of it.
   *
   * This is the same object throughout. Seen from the multiverse it is scaled
   * down to a tangle a few hundred units across, sitting inside the bubble the
   * journey is heading for -- so a viewer can see, from outside and from a
   * long way off, that this universe has structure in it. As the bubble swells
   * through the approach the web is scaled with it, one to one, until at the
   * moment the camera crosses the membrane the web is at full size around it
   * and the nesting is simply switched off. Nothing appears; the thing that
   * was a speck inside a distant bubble is now the sky.
   *
   * The fit is anchored so that at the end of the approach the scale is
   * exactly 1 -- ours swells to a known radius, so the divisor is that radius
   * and the hand-over needs no blend at all.
   */
  const WEB_NEST_FULL_RADIUS = 4600;
  const WEB_NEST_ANCHOR_Z = -1100;
  function setWebBall(value) {
    for (let i = 0; i < webMaterials.length; i += 1) {
      webMaterials[i].uniforms.uBall.value = value;
    }
  }
  function nestWebInside(bubble) {
    const scale = bubble.group.scale.x / WEB_NEST_FULL_RADIUS;
    webGroup.scale.setScalar(scale);
    webGroup.position.set(
      bubble.group.position.x,
      bubble.group.position.y,
      bubble.group.position.z - WEB_NEST_ANCHOR_Z * scale,
    );
    // Round it off while it is a thing being looked at, and stop once the
    // camera is close enough that its edges are off the frame anyway.
    setWebBall(1 - clamp01((scale - 0.4) / 0.55));
    return scale;
  }

  /*
   * How bright the nested web is allowed to be.
   *
   * Additive blending accumulates, and squeezing six hundred thousand points
   * into a disc a couple of hundred pixels across means every pixel collects
   * hundreds of them -- so at any ordinary opacity the whole thing saturates
   * to a flat white lozenge however faint each grain is. Scaling the level
   * with the square of the nesting keeps the *accumulated* brightness roughly
   * constant instead of the per-grain one, which is the quantity that
   * actually reaches the screen.
   */
  function nestedWebLevel(scale) {
    return Math.min(1, Math.max(0.012, scale * scale * 1.15));
  }

  function setWebLevel(level, time) {
    const value = level > 0 ? (level > 1 ? 1 : level) : 0;
    webGroup.visible = value > 0.003;
    if (!webGroup.visible) return;
    /*
     * The threads carry the act; the knots only mark where they meet.
     *
     * Weighted the other way -- which is where this started, and again after
     * the knots were made warm -- the frame is a field of bright blobs and the
     * network between them is invisible. A cluster is small and a filament is
     * a hundred million light-years long, so the picture that reads is mostly
     * thread.
     */
    webThreadMaterial.uniforms.uOpacity.value = value * 0.95;
    webKnotMaterial.uniforms.uOpacity.value = value * 0.42;
  }

  buildMark("before Milky Way");
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

  /*
   * The spike flare, and the only place left that uses one.
   *
   * It used to be shared with the burst, where two counter-rotating copies
   * stood in for light escaping the fireball -- and where, once the burst
   * became an expansion rather than an explosion, spokes radiating from a
   * point were exactly the wrong claim. A star is the honest home for it: a
   * source this bright genuinely does throw spikes across a lens, and without
   * them the Sun reads as a bare disc rather than as something too bright to
   * look at.
   */
  const rayTexture = track(createRayTexture(22));
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

  buildMark("before run");
  /* ----------------------------------------------------------------- run */

  let elapsed = 0;
  let primeFrames = 2;
  // Whatever the burst left standing, captured on the first frame of the act
  // that disposes of it -- so the two are continuous however either is tuned.
  let condenseHandover = null;
  let webDriftZ = 0;
  let webApproachStart = null;
  let lastWebZ = 0;
  let webEntrySpeed = 0;
  let webSpeed = 0;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  /*
   * A unit Hermite, and its slope.
   *
   * Every leg of the journey is one of these. An ease that starts or ends at
   * zero slope brings the shot to a stop, and a stop between two moving legs
   * is a pause however smooth the curve is either side of it -- which is what
   * kept happening at the act boundaries. Specifying the endpoint velocities
   * instead means each leg can be handed the speed the one before it finished
   * at, and hand on the speed the one after it needs.
   */
  const hermite01 = (u, m0, m1) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) + (u3 - u2) * m1;
  };
  const hermiteRate01 = (u, m0, m1) => {
    const u2 = u * u;
    return (3 * u2 - 4 * u + 1) * m0 + (-6 * u2 + 6 * u) + (3 * u2 - 2 * u) * m1;
  };
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

    let mark = T.inflation;
    if (elapsed <= mark) {
      /*
       * Five beats, and not one of them is an explosion.
       *
       *   0.00 - 0.34  the singularity   nothing is separated from anything
       *                                  else, so there is no structure yet
       *   0.34 - 2.20  inflation         exponential stretching, which empties
       *                                  the universe and supercools it
       *   2.20 - 3.10  reheating         the vacuum energy decays into a hot
       *                                  plasma -- everywhere, at once
       *   3.10 - 9.30  metric expansion  the crawl: deceleration, and the
       *                                  redshift Hubble's law was read off
       *   9.30 - 12.0  recombination     the fog clears and the sky appears
       *
       * The animation and the text share one clock here, which the fireball
       * version could not do -- a detonation is over in a moment and had to be
       * run on a second, faster clock. Expansion has never stopped, so there
       * is nothing to hurry: the act can take the twelve seconds the captions
       * need and still be telling the truth the whole way through.
       */
      const act = clamp01(elapsed / T.inflation);
      showCaption("inflation", act, deltaSeconds);

      const uniforms = expansionMaterial.uniforms;
      uniforms.uLogA.value = logScaleFactor(elapsed);

      const inflating = clamp01(elapsed / INFLATE_MS);
      const reheat = clamp01((elapsed - INFLATE_MS) / 900);
      const cooling = clamp01((elapsed - 3100) / 6200);
      const clearing = clamp01((elapsed - 9300) / 2700);

      /*
       * A third of a second of flat white, and nothing else.
       *
       * At t = 0 the separation between any two points is zero, so there is no
       * structure to draw and no vantage point to draw it from. A saturated
       * frame is the honest picture of that, and it is also what the gate's
       * blowout hands over, so the join cannot be seen.
       *
       * Reheating used to be drawn here too, as a second flash of the same
       * quad. It read as a sheet of flat grey laid over the shot, because that
       * is what a partial white wash over black is. The fire belongs in the
       * field, where it is granular -- see uGain below.
       */
      setVeil(1 - clamp01(elapsed / 340));

      /*
       * Inflation *empties* the universe -- that is not a footnote, it is why
       * there had to be a reheating at all. The field thins toward nothing and
       * turns cold and blue while it stretches, and only then catches fire.
       */
      const emptied = lerp(1, 0.10, easeInCubic(inflating));
      const lit = reheat * reheat * (3 - 2 * reheat);
      /*
       * Not cleared to nothing here any more.
       *
       * The act used to end on an empty frame and the bubbles were faded up
       * over the top of it. Slightly under half the fog is left standing at
       * the end of the beat instead, and the act that follows is what
       * disposes of it -- by gathering it into the universes. Nothing that
       * appears later is allowed to appear out of an empty frame.
       */
      setExpansion(lerp(emptied, 1, lit) * lerp(1, 0.72, cooling) * (1 - clearing * 0.34));
      // The cold burns off fast once the vacuum starts decaying; it does not
      // fade out politely over the whole of reheating.
      uniforms.uCold.value = inflating * Math.pow(1 - reheat, 2.0);
      uniforms.uTemp.value = cooling;
      /*
       * Grains swell twice: once at the peak of the stretching, and once when
       * the plasma lights, because an opaque fog is made of grains that
       * *overlap*. Points that do not touch each other read as a star field
       * however many of them there are, which is what the first pass at this
       * looked like -- and a star field is the one thing the universe
       * demonstrably was not for its first 380,000 years.
       */
      uniforms.uSize.value = px(
        4.4 + Math.sin(inflating * Math.PI) * 2.0 + Math.sin(lit * Math.PI) * 2.2 + lit * 1.6,
      );
      /*
       * The fire. Pushed hard past one for a moment so the additive pass
       * clips: the universe does not brighten at reheating, it becomes
       * something you could not have looked at, everywhere, with no source in
       * it anywhere. Then it settles back and starts losing energy to the
       * stretching, which is all a redshift is.
       */
      uniforms.uGain.value = 1 + Math.sin(lit * Math.PI) * 1.9 - cooling * 0.3;

      /*
       * The fluctuations.
       *
       * Amplitude rises as the plasma cools, because they are only visible as
       * temperature differences and there is no temperature to differ until
       * reheating. Wavenumber *falls*, which is inflation's real legacy: a
       * quantum speckle stretched until its patches are degrees across, and
       * every one of them a galaxy later. This is the same pattern that is
       * still on the sky as the anisotropies of the microwave background.
       */
      uniforms.uRipple.value = lit * (0.34 + cooling * 0.34);
      uniforms.uK.value = lerp(26, 3.4, easeOutCubic(cooling));

      /*
       * The sky is not thrown out. It is *revealed*.
       *
       * The old act interpolated all 26,000 stars from a single point out to
       * their positions, which is the explosion again wearing a different
       * coat. Matter was already everywhere -- it had nowhere else to be. What
       * changed at recombination is that the fog stopped being opaque, and the
       * light that had been scattering since the beginning went free. That
       * light is still arriving; it is the oldest thing anyone has ever seen.
       */
      /*
       * What the clearing fog reveals is the *bubbles*, not a star field.
       *
       * Two things were wrong with revealing the sky here. It contradicted the
       * act that follows, which is set outside our universe where there is no
       * sky to see -- so the stars came up at recombination and went straight
       * back out a second later, which is the flash of dust and spiked stars
       * that was visible right after the burst. And it wasted the reveal: the
       * fog going transparent is the one moment in the sequence that can carry
       * a change of scale, and pulling back to find our universe is one bubble
       * among many is a far better thing to find than more of the same.
       *
       * They are brought all the way up here, so the multiverse act opens on a
       * field that is already lit and already in place. Nothing arrives.
       */
      dustMaterial.uniforms.uOpacity.value = 0;
      spikeMaterial.opacity = 0;

      /*
       * And nothing is grown here. The universes belong to the next act,
       * where there is something for them to be made *out of*.
       */
      setWebLevel(0, seconds);
      setLaniakeaLevel(0);
      setBubbleDetail(ours, 0.1);
      bubbles.forEach((bubble) => {
        setBubbleGrowth(bubble, 0.02);
        setBubbleOpacity(bubble, 0);
      });
      setCondense(0, 0);
      return elapsed / total;
    }

    mark += T.condense;
    if (elapsed <= mark) {
      /*
       * The fog gathers, and what it gathers into is the multiverse.
       *
       * This is the act that was missing. Everything in it is one motion seen
       * from two sides: the plasma left over from the burst goes out, and the
       * clouds seeded from it fall inward onto the spheres they become. The
       * painted bodies come up underneath as the grains land, so at no point
       * is anything introduced -- the universes are assembled on screen out
       * of the only material the shot has.
       */
      const local = clamp01((elapsed - T.inflation) / T.condense);
      showCaption("condense", local, deltaSeconds);
      setVeil(0);
      expansionMaterial.uniforms.uLogA.value = logScaleFactor(elapsed);
      // Continuous by construction: whatever the burst left is what goes out.
      if (condenseHandover === null) {
        condenseHandover = expansionMaterial.uniforms.uOpacity.value;
      }
      setExpansion(condenseHandover * (1 - smootherstep(clamp01(local / 0.78))));
      // Full strength throughout: each grain carries its own fade in and out,
      // and dimming the whole field on top of that only hides the motion.
      setCondense(local, 1);

      dustMaterial.uniforms.uOpacity.value = 0;
      spikeMaterial.opacity = 0;

      /*
       * The bodies follow the grains, a little behind them. Started at the
       * same instant they would look like two things happening at once; a
       * fifth of the act later they look like the consequence.
       */
      const formed = clamp01((local - 0.2) / 0.64);
      const solid = formed * formed * (3 - 2 * formed);
      setBubbleGrowth(ours, Math.max(0.02, solid));
      setBubbleOpacity(ours, 0.8 * solid);
      setBubbleDetail(ours, 0.1);
      setWebLevel(nestedWebLevel(nestWebInside(ours)) * solid, seconds);
      setLaniakeaLevel(0);
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        const own = clamp01((solid - (index % 6) * 0.035) / 0.83);
        setBubbleGrowth(bubble, Math.max(0.02, own));
        setBubbleOpacity(bubble, 0.85 * own);
      });
      return elapsed / total;
    }

    // Everything from the beginning is gone by here: the fog was spent on the
    // universes, and the grains that carried it went out under them.
    if (blast.visible) {
      blast.visible = false;
      setExpansion(0);
      setVeil(0);
    }
    setCondense(1, 0);

    mark += T.multiverse;
    if (elapsed <= mark) {
      showCaption("multiverse", (elapsed - T.inflation - T.condense) / T.multiverse, deltaSeconds);
      // Drifting among vast, dim shells. Galaxies are not yet resolvable.
      /*
       * A void, and it was already a void before this act began.
       *
       * There is no star field out here -- this is outside our universe, in
       * the false vacuum the bubbles are nucleating in, and there is no matter
       * in it to shine. Nothing is faded on or off at the seam: the sky was
       * never lit and the bubbles came up during the recombination beat, so
       * the act opens on exactly the frame the one before it ended on.
       *
       * `driftField` is not called at all. Every population it moves is at
       * zero opacity for the next four acts.
       */
      dustMaterial.uniforms.uOpacity.value = 0;
      spikeMaterial.opacity = 0;
      /*
       * Ours is not scenery and never recycles: it is the destination, and it
       * is closing the entire time. The same curve carries straight on through
       * the act that follows -- see placeOurs -- so nothing about the way it
       * moves changes at the seam.
       */
      const oursJourney = (elapsed - T.inflation - T.condense) / (T.multiverse + T.approach);
      const oursReach = placeOurs(oursJourney);
      ours.group.rotation.y += deltaSeconds * 0.05;
      setBubbleOpacity(ours, lerp(0.8, 1, oursJourney), lerp(1, 1.9, oursJourney));
      setBubbleDetail(ours, lerp(0.1, 1, easeInCubic(oursJourney)));
      // Structure inside the universe we are heading for, seen from outside it.
      setWebLevel(nestedWebLevel(nestWebInside(ours)), seconds);
      setLaniakeaLevel(0);
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        // Fast enough that several actually sweep past the camera during the
        // phase, rather than the whole field merely swelling in place.
        setBubbleGrowth(bubble, 1);
        driftBubble(bubble, CRUISE * deltaSeconds);
        bubble.group.rotation.y += deltaSeconds * 0.05;
        /*
         * Nothing is retired on a clock any more.
         *
         * They used to be cleared over the last fifth of the drift, so that
         * the approach opened on a frame holding nothing but ours -- which is
         * how ours came to be the last object in the shot. Each one now leaves
         * for a reason of its own instead: because it has reached the lens, or
         * because ours has grown over it. Both are things the viewer can see
         * the cause of, and both carry on into the act that follows without
         * anything happening at the seam.
         */
        setBubbleOpacity(
          bubble,
          0.85 * bubbleJourneyFade(bubble) * occludedByOurs(bubble, oursReach),
        );
      });
      return elapsed / total;
    }

    mark += T.approach;
    if (elapsed <= mark) {
      showCaption("approach", 1 - (mark - elapsed) / T.approach, deltaSeconds);
      // One bubble swells until the camera passes through its wall.
      /*
       * There is no easing curve here at all any more.
       *
       * Every one that was tried had the same failing in a different place: a
       * slope that did not match what the act before it handed over, or one
       * that fell to zero before the act after it picked up. The approach is
       * not a move of its own -- it is the second half of one that started
       * eleven seconds earlier -- so it is driven by that move's parameter and
       * there is nothing left to ease.
       */
      // The same parameter the multiverse was running on, carried straight on.
      const oursJourney = (elapsed - T.inflation - T.condense) / (T.multiverse + T.approach);
      const step = CRUISE * deltaSeconds;
      driftField(step);
      /*
       * The web travels with the field, but on its own line.
       *
       * `driftField` moves each population at its own rate -- the spiked stars
       * faster, the distant sprites slower -- which is what gives the field
       * parallax. The web has to move at exactly one rate or its filaments
       * would shear apart, so it is stepped here instead.
       */
      /*
       * The web stays nested for the whole crossing.
       *
       * It used to be placed in the world and faded up from a tenth of the way
       * in, which put filaments across the frame while the bubble's own shell
       * was still in front of them -- so the structure appeared to be outside
       * the universe, stretching past its wall, which is the opposite of what
       * it is. Now it is simply carried by the bubble: ours swells from a
       * speck to a sky over this act, and the web scaled to it does exactly
       * the same thing. There is no moment where anything is introduced.
       *
       * Only the brightness changes, and it changes with the crossing -- what
       * was a faint tangle inside a distant object resolves as the camera
       * arrives among it.
       */
      /*
       * Placed first, then the web nested onto it. The other way round -- which
       * is how it was -- carries the web on the previous frame's position and
       * scale, so the structure inside the bubble trails its own wall by one
       * frame for the whole crossing.
       */
      const oursReach = placeOurs(oursJourney);
      const nested = nestWebInside(ours);
      /*
       * Keyed off the geometry, not off a slice of the act's local time: this
       * is the moment radius overtakes distance, which is the moment the
       * camera is actually inside.
       */
      const inside = smootherstep((oursJourney - OURS_CROSSING) / (1 - OURS_CROSSING));
      setWebLevel(lerp(nestedWebLevel(nested), 1, inside), seconds);
      setLaniakeaLevel(0);
      ours.group.rotation.y += deltaSeconds * 0.06;
      // Stars come in as fast as the surface they sit on grows, so the
      // density on screen stays put while the bubble goes from a dot to a sky.
      setBubbleDetail(ours, lerp(0.1, 1, easeInCubic(oursJourney)));
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
      setBubbleOpacity(ours, lerp(0.8, 1, oursJourney) * (1 - inside), lerp(1, 1.9, oursJourney));
      webSpeed = (webGroup.position.z - lastWebZ) / Math.max(1e-4, deltaSeconds);
      lastWebZ = webGroup.position.z;
      /*
       * The field keeps travelling right through the dive.
       *
       * It used to be switched off on the first frame of this act, and that
       * single line is most of what made the approach read as a lurch: the
       * moment the neighbours went, the only thing left moving on screen was
       * ours, looming. Everything the eye had been reading speed from was gone,
       * so the shot appeared to accelerate without anything actually changing
       * pace. They stay, at the same drift as every other act, and they leave
       * one at a time for reasons of their own -- reaching the lens, or being
       * covered by the universe we are entering -- until the wall crossing
       * takes what is left of the outside with it.
       */
      /*
       * ...and the outside is gone by the crossing, not after it.
       *
       * Retiring the field over the whole act meant neighbours were still half
       * in frame while the camera was already among our own filaments, which
       * is the most obvious wrong thing a shot can contain: we are inside one
       * universe, and there is another one hanging over the edge of it. The
       * dissolve now finishes exactly where being *inside* begins.
       */
      const outside = 1 - smootherstep(
        clamp01((oursJourney - (OURS_CROSSING - 0.24)) / 0.24),
      );
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        driftBubble(bubble, step);
        bubble.group.rotation.y += deltaSeconds * 0.05;
        setBubbleOpacity(
          bubble,
          0.85 * bubbleJourneyFade(bubble) * occludedByOurs(bubble, oursReach) * outside,
        );
      });
      /*
       * Still no sky.
       *
       * It went out at the top of the multiverse and stays out through the
       * whole of the web. Nothing between here and the descent into Laniakea
       * is at a scale where a star is a thing you could see -- at these
       * distances a cluster of a thousand galaxies is a point of light.
       */
      dustMaterial.uniforms.uOpacity.value = 0;
      spikeMaterial.opacity = 0;
      galaxyGroup.visible = false;
      setDeepStarLevel(0);
      setNebulaLevel(0, seconds);
      dust.rotation.z += deltaSeconds * 0.02;
      return elapsed / total;
    }

    /* ------------------------------------------------------- the cosmic web */

    mark += T.cosmicWeb;
    if (elapsed <= mark) {
      const local = 1 - (mark - elapsed) / T.cosmicWeb;
      showCaption("cosmicWeb", local, deltaSeconds);
      /*
       * Eleven seconds inside the structure, and nothing else on screen at all.
       *
       * Not even the star field. The web is the largest thing there is and it
       * is made of very faint threads; anything brighter in the frame simply
       * takes the eye, and every attempt at showing it alongside stars or
       * galaxies ended with the web invisible. It is also the honest picture:
       * at this scale a knot is a cluster of a thousand galaxies, so there is
       * nothing in view that could be resolved into a star.
       *
       * `driftField` is not called here for the same reason -- with every
       * other population at zero opacity there is nothing for it to move, and
       * skipping it saves some eighty thousand float writes a frame.
       */
      setWebLevel(1, seconds);
      /*
       * Steering onto Laniakea, and closing on it.
       *
       * The camera does not move -- it never does outside the detonation -- so
       * the whole web is slid instead: sideways until the chosen crossing sits
       * on the axis, and forward until it fills the frame. Same manoeuvre in a
       * different frame of reference, and every other position in the scene
       * stays where it was.
       *
       * The forward part is a *solved trajectory*, not an accumulated drift.
       * The first version accumulated a drift and then added however much
       * extra was needed to park the crossing at a fixed distance -- which
       * meant that once it had got there the web stopped dead and sat still
       * for the rest of the act. That was a visible pause, and it was
       * structural: any scheme that targets a position and reaches it early
       * has to stop.
       *
       * So the crossing's depth is interpolated directly from wherever it
       * happened to be when the act opened to where it needs to end, on
       * `local^1.8` -- an ease-in whose slope at the end is 1.8, not zero. It
       * arrives *at speed*, and the act after it picks that speed up and eases
       * it down, so nothing anywhere on the join is standing still.
       */
      /*
       * A Hermite, because both ends of the trajectory have a speed to match.
       *
       * `local^1.8` had the right finish -- a slope of 1.8 rather than zero, so
       * the arrival hands a live velocity to the act after it -- but its slope
       * at the *start* is zero, so the web came to a dead stop the instant this
       * act opened and had to get going again. That was the pause on entering.
       *
       * A cubic Hermite is the curve that takes an endpoint velocity at each
       * end, which is what lets one leg be handed the speed the last one
       * finished at. Nothing anywhere on either seam changes speed abruptly.
       */
      if (webApproachStart === null) {
        /*
         * Picked up from wherever the nesting actually left it, rather than
         * from a placement of its own. The scale is 1 by construction at this
         * point and the position is whatever carrying it inside the bubble
         * produced, so the act simply continues from there and there is
         * nothing to reconcile.
         */
        webGroup.scale.setScalar(1);
        webDriftZ = webGroup.position.z;
        webApproachStart = laniakea.z + webDriftZ;
        webEntrySpeed = webSpeed;
      }
      const LANIAKEA_ARRIVAL_Z = -260;
      const spanSeconds = T.cosmicWeb / 1000;
      const travel = LANIAKEA_ARRIVAL_Z - webApproachStart;
      /*
       * A cruise, not a run-up.
       *
       * `m1` used to be 1.8, which meant the act spent its first half barely
       * moving and its last half rushing -- and a slow first half next to a
       * decelerating approach is indistinguishable from a stall. Held near one
       * at both ends the whole leg travels at close to a constant rate: the
       * web goes by steadily, the crossing grows steadily, and the arrival
       * settles onto it rather than charging it.
       */
      /*
       * Held close to one at both ends, so the leg is as near a constant rate
       * as a curve with matched endpoints can be. m0 is whatever the crossing
       * was closing at, clamped so an unusual entry cannot make the first
       * half crawl or the second half sprint.
       */
      const m0 = Math.min(1.25, Math.max(0.75, (webEntrySpeed * spanSeconds) / travel));
      const m1 = 1.0;
      const march = hermite01(local, m0, m1);
      const marchRate = hermiteRate01(local, m0, m1);
      webDriftZ = webApproachStart + travel * march - laniakea.z;
      webSpeed = (travel * marchRate) / spanSeconds;
      // Steering starts early and finishes late, so the crossing drifts onto
      // the axis over most of the act instead of being swung onto it at the end.
      const focus = smootherstep(local * 0.96);
      webGroup.position.z = webDriftZ;
      webGroup.position.x = -laniakea.x * focus;
      webGroup.position.y = -laniakea.y * focus;
      // It lights early, so the destination is something seen coming rather
      // than something the shot turns out to have been pointed at. The bloom
      // at the end is the arrival itself: the crossing fills the frame and the
      // galaxies inside it come up through the light.
      setLaniakeaLevel(clamp01((local - 0.08) / 0.3), smootherstep((local - 0.76) / 0.24));

      // Everything else stays down. The bubble we came through is behind us.
      setBubbleOpacity(ours, Math.max(0, 0.9 * (1 - local * 3)));
      bubbles.forEach((bubble, index) => { if (index > 0) setBubbleOpacity(bubble, 0); });
      galaxyGroup.visible = false;
      dustMaterial.uniforms.uOpacity.value = 0;
      spikeMaterial.opacity = 0;
      setDeepStarLevel(0);
      setNebulaLevel(0, seconds);
      return elapsed / total;
    }

    mark += T.galaxies;
    if (elapsed <= mark) {
      showCaption("galaxies", 1 - (mark - elapsed) / T.galaxies, deltaSeconds);
      const local = 1 - (mark - elapsed) / T.galaxies;
      setBubbleOpacity(ours, 0);
      /*
       * Dropping inside one knot of the web.
       *
       * The web goes out over the first two seconds and does not come back --
       * it is the view from outside a cluster, and this act is the view from
       * within one. Everything that was switched off crossing into the
       * universe comes back on the same beat, which is what makes the two read
       * as one move: a scale change out, and a scale change back in.
       */
      const descent = clamp01(local / 0.17);
      setWebLevel(1 - descent, seconds);
      setLaniakeaLevel(1 - descent, 1 - descent);
      dustMaterial.uniforms.uOpacity.value = descent;
      spikeMaterial.opacity = descent * 0.9;
      galaxyGroup.visible = true;
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
      const step = CRUISE * deltaSeconds;
      driftField(step);
      /*
       * The web carries its own speed across the seam and is damped down to
       * the field's, rather than being handed the field's speed on frame one.
       * Exact exponential damping, so the rate is the same at any frame rate.
       */
      const webTarget = (step / Math.max(1e-4, deltaSeconds)) * WEB_DRIFT;
      webSpeed += (webTarget - webSpeed) * (1 - Math.exp(-4.5 * deltaSeconds));
      webDriftZ += webSpeed * deltaSeconds;
      webGroup.position.z = webDriftZ;
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
        applyFade(sprite, descent * (0.8 + Math.sin((local + sprite.position.x) * 2.2)
          * 0.12 * shimmer)
          * edgeFade(sprite.position.z, -380, 300, 420));
      });
      setDeepStarLevel(descent * 0.95);
      spirals.forEach((points) => { points.rotation.y += deltaSeconds * 0.04; });
      setNebulaLevel(descent, seconds);
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
      /*
       * One rate, and it is the same rate the rest of the journey runs at.
       *
       * The galaxy leg used to be the least uniform stretch in the sequence.
       * This act closed on the galaxy at 0.07 e-folds a second and the dive
       * that follows ran at 0.84 -- twelve times faster, from a standing
       * start, which is both the pause at the seam and the reason the galaxies
       * felt as though they were being travelled through faster than the
       * universe was. The two are now rebalanced against each other and both
       * are geometric, so the growth rate is constant *within* each act as
       * well as comparable between them: about 0.22 here against 0.23 for the
       * approach through the multiverse.
       */
      const eased = local;
      // Everything else falls away: from here there is only one galaxy.
      const recede = clamp01(1 - local * 1.8);
      galaxySprites.forEach((sprite) => {
        applyFade(sprite, recede * 0.8 * edgeFade(sprite.position.z, -380, 300, 420));
      });
      setDeepStarLevel(recede * 0.95);
      setNebulaLevel(recede, seconds);
      driftField(CRUISE * deltaSeconds);
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
        // Scale and range are both geometric: a linear range lerp reads as
        // decelerating, because apparent size goes as its reciprocal.
        geometric(1500, 3200, eased),
        geometric(5600, 1600, eased),
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
      /*
       * This was `easeInCubic`, and that single call was the pause.
       *
       * A cubic ease-in has zero slope at u = 0, so the dive began at a dead
       * stop -- the act before it had been closing steadily, and the first
       * second of this one moved almost nothing at all. It then made the time
       * back by accelerating to twelve times the cruise, which is why the
       * descent read as a lurch after a hang.
       *
       * What replaces it is a Hermite in *log* space whose starting slope is
       * the rate the pan before it was closing at -- about 0.17 e-folds a
       * second -- peaking near half an e-fold through the middle and easing
       * back to 0.28 by the last frame, which is the rate the act after it
       * picks the star up at. So the dive begins at exactly the speed the shot
       * was already travelling, accelerates into it -- which is what a dive is
       * -- and hands its speed on rather than dropping it. The old one stopped
       * and then bolted.
       */
      const eased = hermite01(clamp01(local), 0.46, 0.75);
      galaxySprites.forEach((sprite) => { applyFade(sprite, 0); });
      setDeepStarLevel(0);
      setNebulaLevel(0, seconds);
      // Local stars streaming past, the only cue that the camera is moving
      // once the galaxy fills the frame.
      /*
       * The dive used to accelerate to twelve times the cruise here, which was
       * the largest speed change anywhere in the sequence and read as the shot
       * being skipped forward. The descent into the disc is now the same rate
       * as everything else; what makes it feel like a dive is the camera
       * rolling onto the disc plane, not the throttle.
       */
      driftField(CRUISE * deltaSeconds);
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
        geometric(3200, 15000, eased),
        geometric(1600, 90, eased),
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
      /*
       * Picks up the dive's exit rate and eases off it.
       *
       * In log space, so the number that has to match across the seam is the
       * *relative* growth rate. The dive is set to ease down to 0.28 e-folds a
       * second by its last frame and this act starts the star growing at
       * exactly that, building slightly into the flare. Rate across the join:
       * 0.28 either side.
       *
       * The dive's peak is unchanged -- it still runs at 0.44 through its
       * middle, which is what makes it a dive. All that moved is where it
       * spends that: it used to be still accelerating when the act ended and
       * then handed over to a star growing five times slower than the object
       * that had been filling the frame a frame earlier. That is the fraction
       * of a pause; it was never a dropped frame.
       */
      const eased = hermite01(clamp01(local), 0.72, 1.1);

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
        geometric(15000, 19000, eased),
        90,
        1,
      );
      /*
       * No dead zone at the front of this.
       *
       * The star used to start fading in a twentieth of the way into the act
       * -- four hundred milliseconds during which the only thing on screen
       * still changing was a galaxy whose framing had just stopped. Four
       * hundred milliseconds is exactly the size of the pause that was
       * reported. It comes up from the first frame now, so the object that
       * carries the act's speed is present from the instant the act owns it.
       */
      const settle = clamp01(local / 0.3);
      sunMarkMaterial.opacity = 0.9 * (1 - settle);
      // The band of the galaxy dims behind it as the star takes the frame.
      mwMaterial.opacity = lerp(1, 0.42, eased);
      knotMaterial.opacity = lerp(0.24, 0.1, eased);

      driftField(CRUISE * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(0.9, 0.55, eased);
      spikeMaterial.opacity = lerp(0.8, 0.5, eased);

      sunStar.visible = true;
      /*
       * Geometric here too, and for the same reason as everywhere else: the
       * cubic ease-in held the star at its opening size for the first second
       * and a half of the act and then rushed it, which after a dive that had
       * just been fixed for exactly that fault was the last place it survived.
       */
      const grow = eased;
      const breath = 1 + Math.sin(seconds * 2.1) * 0.018;
      sunCore.scale.setScalar(geometric(1.4, 30, grow) * breath);
      sunCorona.scale.setScalar(geometric(3.4, 96, grow) * breath);
      sunFlare.scale.setScalar(geometric(6, 190, grow));
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
    /*
     * The only deceleration in the journey, and the only one that is earned:
     * the shot is coming to rest on the star it has been travelling toward.
     */
    driftField(lerp(CRUISE, 0, easeOutCubic(local)) * deltaSeconds);
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

  /*
   * Detach at once; free in slices.
   *
   * Detaching is what actually ends the sequence and it costs nothing -- a few
   * hundred parent pointers. Freeing is the expensive half: this scene holds
   * upwards of a million and a half points across a dozen large buffers, and
   * releasing them in one pass means the driver frees tens of megabytes of
   * vertex data synchronously. That lands in the same frame as the cut to the
   * solar system, which is exactly where a stall is least affordable, and it
   * is the reason the arrival pause came back after the web was added: the
   * cost of this function scales with everything put into the opening.
   *
   * So the queue is drained a few milliseconds at a time. Nothing else is
   * waiting on it -- the objects are already out of the scene graph and the
   * memory is unreachable either way; the only question is which frames pay.
   */
  function dispose() {
    caption.remove();
    // Collect first, then detach. Removing objects during traverse() corrupts
    // the children array mid-walk and throws -- which, because this runs inside
    // the render loop, previously killed the loop and left a black screen.
    const objects = [];
    scene.traverse((object) => { if (object !== scene) objects.push(object); });
    objects.forEach((object) => object.removeFromParent?.());
    scene.clear();

    const queue = disposables.slice();
    disposables.length = 0;
    const SLICE_MS = 3;
    const drain = () => {
      const started = performance.now();
      while (queue.length > 0 && performance.now() - started < SLICE_MS) {
        queue.pop()?.dispose?.();
      }
      if (queue.length > 0) schedule();
    };
    const schedule = () => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(drain, { timeout: 240 });
      } else {
        setTimeout(drain, 32);
      }
    };
    schedule();
  }

  return { scene, camera, update, resize, dispose, get durationMs() { return phaseTotal(); } };
}

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
  arrive: 2400,
};

const PHASE_ORDER = [
  "detonation", "multiverse", "approach", "galaxies", "milkyWay", "orionArm", "arrive",
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
    body: "26,000 light-years from the centre, on the inner rim of a minor arm — one ordinary star.",
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

  const BUBBLE_COUNT = 11;
  // The z period the drifting bubbles recycle on.
  const BUBBLE_LOOP = 7600;

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
    return { group, shellMaterial, knotMaterial, galaxyMaterial, rimMaterial };
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
  const BUBBLE_FADE_IN_DEPTH = 6300;
  const BUBBLE_FADE_OUT_DEPTH = 1300;
  function bubbleDepthFade(z) {
    const depth = -z;
    const arriving = (BUBBLE_LOOP - depth) / (BUBBLE_LOOP - BUBBLE_FADE_IN_DEPTH);
    const leaving = (depth - 500) / (BUBBLE_FADE_OUT_DEPTH - 500);
    return Math.max(0, Math.min(1, arriving, leaving));
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
    for (let i = 0; i < bubbleSlots.length; i += 1) {
      const slot = bubbleSlots[i];
      const dx = x - slot.x;
      const dy = y - slot.y;
      let dz = z - slot.z;
      dz -= BUBBLE_LOOP * Math.round(dz / BUBBLE_LOOP);
      const needed = (radius + slot.radius) * 1.7;
      if (dx * dx + dy * dy + dz * dz < needed * needed) return false;
    }
    return true;
  }

  // Ours first, and on the axis: it is the destination, so nothing else may be
  // allowed to sit in front of it.
  const OURS_START_Z = -9000;
  const ours = createBubble(0, UNIVERSE_PAIRS[0], true);
  ours.group.position.set(0, 0, OURS_START_Z);
  ours.group.scale.setScalar(780);
  bubbles.push(ours);
  bubbleSlots.push({ x: 0, y: 0, z: OURS_START_Z, radius: 780 });

  for (let i = 1; i < BUBBLE_COUNT; i += 1) {
    const bubble = createBubble(i % BUBBLE_VARIANTS, UNIVERSE_PAIRS[i % UNIVERSE_PAIRS.length], false);
    let slot = null;
    for (let attempt = 0; attempt < 90 && !slot; attempt += 1) {
      const z = -1150 - (i - 1) * 560 - random() * 320;
      const depth = -z;
      /*
       * Size and offset both scale with depth, so every bubble subtends a
       * similar angle however far away it is. Without that the near ones
       * swallow the frame and the far ones vanish, and the field stops
       * reading as a population of comparable things.
       */
      const angle = i * 2.39996 + (random() - 0.5) * 0.7;
      const radial = depth * (0.80 + random() * 0.50);
      const radius = depth * (0.17 + random() * 0.12);
      const x = Math.cos(angle) * radial;
      const y = Math.sin(angle) * radial * 0.78;
      if (bubbleFits(x, y, z, radius)) slot = { x, y, z, radius };
    }
    // If 90 tries could not find room, that bubble simply is not placed --
    // an unplaceable one would have to overlap something to exist.
    if (!slot) { bubble.group.visible = false; continue; }
    bubble.group.position.set(slot.x, slot.y, slot.z);
    bubble.group.scale.set(slot.radius, slot.radius * (0.9 + random() * 0.2), slot.radius);
    bubbleSlots.push(slot);
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
      mwPositions[i3 + 1] = gaussian() * 0.02 * (1.2 - t * 0.7);
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
    size: px(1.6),
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
    knotPositions[i3 + 1] = gaussian() * 0.012;
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
  const sunMarkMaterial = track(new THREE.SpriteMaterial({
    map: track(createGlowTexture("rgba(255,255,246,1)", "rgba(255,206,140,0.55)", 0.22)),
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
      setBubbleOpacity(ours, 0.95 * rising);
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        // Fast enough that several actually sweep past the camera during the
        // phase, rather than the whole field merely swelling in place. The
        // recycle distance is the same period the placement was proved
        // collision-free against, so the spacing survives the wrap.
        bubble.group.position.z += lerp(190, 470, local) * deltaSeconds;
        if (bubble.group.position.z > 500) bubble.group.position.z -= BUBBLE_LOOP;
        bubble.group.rotation.y += deltaSeconds * 0.05;
        setBubbleOpacity(bubble, 0.85 * rising * bubbleDepthFade(bubble.group.position.z));
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
      const swell = lerp(780, 4600, eased);
      ours.group.scale.setScalar(swell);
      ours.group.rotation.y += deltaSeconds * 0.06;
      setBubbleOpacity(ours, 0.95);
      /*
       * Clear the field before the dive, not during it.
       *
       * Once ours has been chosen the others are scenery, and a bubble still
       * lingering while the camera is going inside another one reads as a
       * second universe turning up out of nowhere. They are gone inside the
       * first fifth of the phase, and they no longer recycle -- nothing may
       * arrive from the far end once the destination is set.
       */
      const clearing = Math.max(0, 1 - eased * 4);
      bubbles.forEach((bubble, index) => {
        if (index === 0) return;
        bubble.group.position.z += 260 * deltaSeconds;
        setBubbleOpacity(bubble, 0.85 * clearing * bubbleDepthFade(bubble.group.position.z));
      });
      // Galaxies resolve out of the haze as we cross the wall.
      galaxyGroup.visible = true;
      const reveal = clamp01((eased - 0.4) * 1.7);
      galaxySprites.forEach((sprite) => { sprite.material.opacity = reveal * 0.85; });
      spiralMaterial.opacity = reveal * 0.9;
      dust.rotation.z += deltaSeconds * 0.02;
      return elapsed / total;
    }

    mark += T.galaxies;
    if (elapsed <= mark) {
      showCaption("galaxies");
      const local = (elapsed - T.detonation - T.multiverse - T.approach) / T.galaxies;
      setBubbleOpacity(ours, Math.max(0, 0.95 * (1 - local * 2.6)));
      bubbles.forEach((bubble, index) => { if (index > 0) setBubbleOpacity(bubble, 0); });
      driftField(lerp(360, 640, easeInOutSine(Math.min(1, local * 1.3))) * deltaSeconds);
      galaxySprites.forEach((sprite) => {
        sprite.material.opacity = 0.62 + Math.sin((local + sprite.position.x) * 2.2) * 0.22;
      });
      spiralMaterial.opacity = 0.95;
      spirals.forEach((points) => { points.rotation.y += deltaSeconds * 0.04; });
      dust.rotation.z += deltaSeconds * 0.04;

      // Our galaxy resolves out of the field in the last third, so the next
      // act begins with it already present rather than cutting to it.
      const rise = clamp01((local - 0.62) / 0.38);
      if (rise > 0) {
        milkyWay.visible = true;
        milkyWay.position.set(0, 90, lerp(-9000, -5600, rise));
        milkyWay.rotation.set(-1.16, 0.4, 0.22);
        milkyWay.scale.setScalar(1500);
        mwMaterial.opacity = rise * 0.5;
        knotMaterial.opacity = rise * 0.4;
        haloMaterial.opacity = rise * 0.28;
      }
      return elapsed / total;
    }

    mark += T.milkyWay;
    if (elapsed <= mark) {
      showCaption("milkyWay");
      const local = (elapsed - T.detonation - T.multiverse - T.approach - T.galaxies) / T.milkyWay;
      const eased = easeInOutSine(local);
      // Everything else falls away: from here there is only one galaxy.
      const recede = clamp01(1 - local * 1.8);
      galaxySprites.forEach((sprite) => { sprite.material.opacity = recede * 0.7; });
      spiralMaterial.opacity = recede * 0.9;
      driftField(lerp(640, 200, easeOutCubic(local)) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(1, 0.5, eased);

      milkyWay.visible = true;
      // Toward it, and rolling from three-quarters toward the disc plane.
      milkyWay.position.set(0, lerp(90, 30, eased), lerp(-5600, -2700, eased));
      // Rolling from three-quarters down toward the disc plane: the shot drops
      // to the galaxy's own level rather than staying above it.
      milkyWay.rotation.set(lerp(-1.16, -0.94, eased), lerp(0.4, 0.16, eased), lerp(0.22, 0.08, eased));
      milkyWay.scale.setScalar(lerp(1500, 1900, eased));
      mwMaterial.opacity = lerp(0.5, 1, clamp01(local * 2));
      knotMaterial.opacity = lerp(0.4, 0.95, clamp01(local * 2));
      haloMaterial.opacity = lerp(0.28, 0.6, clamp01(local * 2));
      sunMarkMaterial.opacity = clamp01((local - 0.55) / 0.45) * 0.85;
      holdSunMarkSize(-milkyWay.position.z);
      return elapsed / total;
    }

    mark += T.orionArm;
    if (elapsed <= mark) {
      showCaption("orionArm");
      const local = (elapsed - total + T.arrive + T.orionArm) / T.orionArm;
      const eased = easeInCubic(clamp01(local));
      galaxySprites.forEach((sprite) => { sprite.material.opacity = 0; });
      spiralMaterial.opacity = 0;
      // Local stars streaming past, the only cue that the camera is moving
      // once the galaxy fills the frame.
      driftField(lerp(200, 1500, eased) * deltaSeconds);
      dustMaterial.uniforms.uOpacity.value = lerp(0.5, 0.9, eased);

      /*
       * The dive.
       *
       * Rather than solving a camera path, the galaxy is scaled up hard and
       * then translated so that the Sun's own position lands on the camera.
       * That keeps the destination exact at every scale: whatever the disc is
       * doing, the star we are heading for is always dead centre.
       */
      milkyWay.rotation.set(lerp(-0.94, -0.3, eased), lerp(0.16, -0.22, eased), lerp(0.08, 0.02, eased));
      milkyWay.scale.setScalar(lerp(1900, 15000, eased));
      milkyWay.position.set(0, 0, 0);
      milkyWay.updateMatrixWorld(true);
      sunWorld.copy(sunLocal).applyMatrix4(milkyWay.matrixWorld);
      const range = lerp(2700, 70, eased);
      milkyWay.position.set(-sunWorld.x, -sunWorld.y, -sunWorld.z - range);
      holdSunMarkSize(range);

      mwMaterial.size = px(lerp(1.6, 3.4, eased));
      knotMaterial.opacity = lerp(0.95, 0.3, eased);
      haloMaterial.opacity = lerp(0.6, 0, eased);
      sunMarkMaterial.opacity = 0.85 + Math.sin(elapsed * 0.004) * 0.15;
      return elapsed / total;
    }

    // Deceleration and fade for the cut.
    showCaption("arrive");
    const local = clamp01((elapsed - total + T.arrive) / T.arrive);
    const fade = 1 - easeInOutSine(local);
    driftField(lerp(1500, 0, easeOutCubic(local)) * deltaSeconds);
    dustMaterial.uniforms.uOpacity.value = fade * 0.9;
    mwMaterial.opacity = fade;
    knotMaterial.opacity = fade * 0.3;
    sunMarkMaterial.opacity = fade;
    milkyWay.scale.setScalar(lerp(15000, 24000, easeOutCubic(local)));
    // Zero the offset before solving for it. Leaving last frame's translation
    // in place meant the Sun's world position already included it, so
    // subtracting it again threw the destination twice as far out -- the mark
    // we are supposed to be arriving at simply left the frame.
    milkyWay.position.set(0, 0, 0);
    milkyWay.updateMatrixWorld(true);
    sunWorld.copy(sunLocal).applyMatrix4(milkyWay.matrixWorld);
    milkyWay.position.set(-sunWorld.x, -sunWorld.y, -sunWorld.z - 70);
    holdSunMarkSize(70);
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

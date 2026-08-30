import * as THREE from "three";
import {
  GALACTIC,
  SKY_GALAXIES,
  SKY_NEBULAE,
  SKY_STARS,
  celestialToVector,
  colourFromBV,
} from "./skyCatalogue.js";

/**
 * The sky the Solar System is standing in.
 *
 * The backdrop was removed once, and the reason it was removed is worth
 * keeping in view: the version that existed was a scatter of white dots on
 * black, and a scatter of white dots is worse than nothing -- it reads as a
 * screensaver and it flattens the planets in front of it. Empty black was the
 * better of those two options.
 *
 * It is not the only two options. What a camera on Mars actually returns, and
 * what the reference images show, is a sky with *structure*: the Milky Way as
 * a banded, dust-lane-riven band rather than a uniform smear; stars in real
 * colours, from blue-white down through the deep orange of Betelgeuse and
 * Antares; hydrogen-alpha red where stars are being made; and Andromeda, three
 * degrees across, six times the width of the full Moon, sitting up in the
 * northern sky as a tilted ellipse with a bright core.
 *
 * **The band is not painted.** The first attempt at this laid an
 * equirectangular canvas over a sphere and drew the Milky Way onto it as
 * gradients, and it looked exactly like what it was: flat tan smears hanging
 * in front of the stars. It was reported as such within a minute of being
 * seen. There is no version of that idea that works, because the thing being
 * drawn is not a cloud -- it is a hundred billion stars too far away to
 * separate, and the only honest way to draw an unresolved star field is with
 * an enormous number of very small stars.
 *
 * So there is no dome and no sky texture at all. There are points, sampled
 * from the real distribution: a thin disc population, a thick disc, and a
 * halo, with the dust lanes *removing* stars rather than dimming pixels --
 * which is also what dust does. That is cheaper as well as truer. One draw
 * call, no megabyte texture upload, and no 1024x512 canvas painted on the
 * main thread at load.
 *
 * Four layers, in the order they are drawn:
 *
 *   1  field    the galaxy, as up to ninety thousand points: thin disc, thick
 *               disc and halo, brightest toward Sagittarius, cut through by
 *               the Great Rift
 *   2  named    the 88 stars brighter than magnitude 2.5, at their real J2000
 *               positions, in their real colours; the brightest get spikes
 *   3  deepSky  nebulae, clusters and galaxies at their real positions, sized
 *               by their real angular diameters and drawn at their real
 *               surface brightness, which is low
 *   4  motes    a near-field dust layer that does *not* follow the camera, so
 *               it parallaxes against everything above and gives the sky depth
 *
 * Layers 1-3 are parented to a group that is moved to the camera every frame.
 * At these distances that is not a cheat, it is the correct physics: nothing
 * in this list is closer than four light years and no amount of travelling
 * inside one planetary system moves any of it. It also means every vertex sits
 * at exactly the shell radius from the lens, so the far plane can never clip
 * the sky however far out the journey goes.
 */

const DEG = Math.PI / 180;

/* ------------------------------------------------------- the galactic frame */

/**
 * Deterministic value noise, used for the dust lanes.
 *
 * The Great Rift is not a smooth feature: it is a ragged wall of cold
 * molecular cloud thousands of light years long, and it does not dim the band
 * so much as *remove* it -- the stars behind it are simply not delivered. So
 * this is used to reject stars rather than to darken pixels, which is both
 * what actually happens and one fewer thing to draw.
 */
function makeNoise(seed) {
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453123;
    return n - Math.floor(n);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return (a + (b - a) * xf) + ((c - a) + (a - b - c + d) * xf) * yf;
  };
  return (x, y) => (
    value(x, y) * 0.56
    + value(x * 2.13, y * 2.13) * 0.28
    + value(x * 4.31, y * 4.31) * 0.16
  );
}

/**
 * An orthonormal frame on the galactic plane.
 *
 * `along` points at the galactic centre, `across` completes the plane, and the
 * pole is the third axis. With it, a galactic longitude and latitude can be
 * turned straight into a scene direction -- which means stars can be *sampled*
 * from the real distribution rather than sampled uniformly and thrown away,
 * and the Milky Way lands on its real great circle for free.
 */
function galacticFrame() {
  const pole = celestialToVector(GALACTIC.poleRa, GALACTIC.poleDec, new THREE.Vector3());
  const centre = celestialToVector(GALACTIC.centreRa, GALACTIC.centreDec, new THREE.Vector3());
  const along = centre.clone().addScaledVector(pole, -centre.dot(pole)).normalize();
  const across = new THREE.Vector3().crossVectors(pole, along).normalize();
  return { pole, along, across };
}

/* ------------------------------------------------------------------- textures */

/** A star: a hard core with a wide soft halo, which is what a lens gives. */
function makeStarTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  // A hard core and a short skirt. A gentle falloff looks better on a single
  // large star and is fatal to a field of small ones: at two pixels across,
  // everything outside the middle third is simply never sampled.
  gradient.addColorStop(0.00, "rgba(255,255,255,1)");
  gradient.addColorStop(0.26, "rgba(255,255,255,0.96)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.46)");
  gradient.addColorStop(0.66, "rgba(255,255,255,0.10)");
  gradient.addColorStop(1.00, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Diffraction spikes.
 *
 * Strictly an artefact of the four vanes holding a telescope's secondary
 * mirror, and strictly not something an eye sees. It is kept because it is the
 * one visual convention that reads unambiguously as "this is a bright star and
 * not a nearby object", and the alternative -- scaling the halo until the
 * brightness is legible -- turns Sirius into a blob.
 */
function makeSpikeTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const glow = context.createRadialGradient(64, 64, 0, 64, 64, 26);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.35, "rgba(255,255,255,0.24)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  context.save();
  context.translate(64, 64);
  context.globalCompositeOperation = "lighter";
  for (let i = 0; i < 2; i += 1) {
    const long = i === 0 ? 60 : 34;
    const across = i === 0 ? 1.4 : 1.0;
    [0, Math.PI / 2].forEach((angle) => {
      context.save();
      context.rotate(angle + (i === 1 ? Math.PI / 4 : 0));
      const spike = context.createLinearGradient(-long, 0, long, 0);
      spike.addColorStop(0.00, "rgba(255,255,255,0)");
      spike.addColorStop(0.34, "rgba(255,255,255,0.10)");
      spike.addColorStop(0.50, "rgba(255,255,255,0.72)");
      spike.addColorStop(0.66, "rgba(255,255,255,0.10)");
      spike.addColorStop(1.00, "rgba(255,255,255,0)");
      context.fillStyle = spike;
      context.fillRect(-long, -across, long * 2, across * 2);
      context.restore();
    });
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** One deep-sky object, painted to suit what kind of thing it is. */
function makeDeepSkyTexture(entry, random) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const colour = new THREE.Color(entry.colour);
  const rgb = (alpha) => `rgba(${Math.round(colour.r * 255)},${Math.round(colour.g * 255)},${Math.round(colour.b * 255)},${alpha})`;
  context.globalCompositeOperation = "lighter";

  const cloud = (cx, cy, radius, alpha) => {
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, rgb(alpha));
    gradient.addColorStop(0.45, rgb(alpha * 0.42));
    gradient.addColorStop(1, rgb(0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  };

  const dots = (count, spread, alpha, tight) => {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const r = Math.pow(random(), tight) * spread;
      const x = 64 + Math.cos(angle) * r;
      const y = 64 + Math.sin(angle) * r;
      const s = 0.7 + random() * 1.5;
      const g = context.createRadialGradient(x, y, 0, x, y, s * 2.4);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.4, rgb(alpha * 0.5));
      g.addColorStop(1, rgb(0));
      context.fillStyle = g;
      context.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
    }
  };

  switch (entry.kind) {
    case "planetary":
      // A shell, not a ball: a planetary nebula is a star's outer atmosphere
      // seen edge-on all the way round, so the limb is where the light is.
      for (let i = 0; i < 3; i += 1) {
        const ring = context.createRadialGradient(64, 64, 12 + i, 64, 64, 34 + i * 3);
        ring.addColorStop(0, rgb(0.05));
        ring.addColorStop(0.55, rgb(0.34));
        ring.addColorStop(0.78, rgb(0.20));
        ring.addColorStop(1, rgb(0));
        context.fillStyle = ring;
        context.fillRect(0, 0, size, size);
      }
      cloud(64, 64, 20, 0.16);
      break;
    case "supernova-remnant":
      for (let i = 0; i < 5; i += 1) {
        context.save();
        context.strokeStyle = rgb(0.16);
        context.lineWidth = 2.2 + random() * 3;
        context.beginPath();
        const start = random() * Math.PI * 2;
        context.arc(64, 64, 26 + random() * 24, start, start + 0.9 + random() * 1.5);
        context.stroke();
        context.restore();
      }
      break;
    case "globular-cluster":
      cloud(64, 64, 34, 0.24);
      dots(220, 30, 0.72, 2.4);
      break;
    case "open-cluster":
      cloud(64, 64, 40, 0.10);
      dots(70, 44, 0.85, 0.85);
      break;
    case "reflection":
      cloud(58, 60, 46, 0.30);
      cloud(76, 74, 34, 0.20);
      break;
    default:
      // Emission: lumpy, brightest around the young stars that light it, with
      // a dust lane or two cut through it.
      cloud(64, 64, 52, 0.26);
      for (let i = 0; i < 7; i += 1) {
        cloud(
          64 + (random() - 0.5) * 46,
          64 + (random() - 0.5) * 46,
          14 + random() * 22,
          0.14 + random() * 0.16,
        );
      }
      dots(26, 40, 0.6, 1.1);
      context.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 3; i += 1) {
        const x = 64 + (random() - 0.5) * 60;
        const y = 64 + (random() - 0.5) * 60;
        const g = context.createRadialGradient(x, y, 0, x, y, 10 + random() * 16);
        g.addColorStop(0, "rgba(0,0,0,0.5)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = g;
        context.fillRect(0, 0, size, size);
      }
      break;
  }

  // Everything fades to nothing at the edge of its quad, or the quad is a
  // visible square -- which is the single most common way a sprite betrays
  // itself against a dark sky.
  context.globalCompositeOperation = "destination-in";
  const mask = context.createRadialGradient(64, 64, 20, 64, 64, 63);
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(0.72, "rgba(0,0,0,0.85)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = mask;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A galaxy: an inclined disc, a bright nucleus, and a hint of arms. */
function makeGalaxyTexture(entry, random) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const colour = new THREE.Color(entry.colour);
  const rgb = (alpha, tint = 1) => `rgba(${Math.round(Math.min(255, colour.r * 255 * tint))},${Math.round(Math.min(255, colour.g * 255 * tint))},${Math.round(Math.min(255, colour.b * 255 * tint))},${alpha})`;
  context.globalCompositeOperation = "lighter";

  const flatten = Math.max(0.16, entry.sizeMinor / entry.sizeMajor);
  context.save();
  context.translate(128, 128);
  context.scale(1, flatten);

  // The disc.
  const disc = context.createRadialGradient(0, 0, 0, 0, 0, 118);
  disc.addColorStop(0.00, rgb(0.85));
  disc.addColorStop(0.10, rgb(0.52));
  disc.addColorStop(0.34, rgb(0.20));
  disc.addColorStop(0.66, rgb(0.07));
  disc.addColorStop(1.00, rgb(0));
  context.fillStyle = disc;
  context.beginPath();
  context.arc(0, 0, 120, 0, Math.PI * 2);
  context.fill();

  // Arms, as a handful of soft logarithmic strokes rather than a spiral drawn
  // to a formula -- at three degrees across nobody resolves the pattern, but
  // the asymmetry stops it reading as a lens flare.
  for (let arm = 0; arm < 4; arm += 1) {
    context.beginPath();
    const phase = arm * (Math.PI / 2) + random() * 0.6;
    for (let t = 0.18; t < 1; t += 0.02) {
      const angle = phase + t * 4.2;
      const r = 16 + t * 104;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (t < 0.2) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = rgb(0.10, 1.06);
    context.lineWidth = 7 + random() * 8;
    context.lineCap = "round";
    context.stroke();

    /*
     * Star-forming knots along the arm.
     *
     * A spiral arm is not a smooth ribbon of light -- it is a queue of HII
     * regions, and in every photograph of a face-on galaxy the arms are visibly
     * beaded rather than drawn. A few brighter dots per arm is the whole
     * difference between a painted spiral and one that looks photographed.
     */
    for (let knot = 0; knot < 5; knot += 1) {
      const t = 0.25 + random() * 0.7;
      const angle = phase + t * 4.2;
      const r = 16 + t * 104;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      const glow = context.createRadialGradient(x, y, 0, x, y, 5 + random() * 7);
      glow.addColorStop(0, rgb(0.30, 1.25));
      glow.addColorStop(1, rgb(0));
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, 12, 0, Math.PI * 2);
      context.fill();
    }
  }

  /*
   * The superwind, for the galaxies that have one.
   *
   * A starburst forms stars so fast that the supernovae overlap: the shocks
   * merge into one hot outflow that punches straight out of both faces of the
   * disc and drags ionised hydrogen with it for thousands of light-years. It
   * glows in H-alpha, which is why every photograph of M82 shows the same
   * thing -- a pale edge-on disc with red filaments streaming perpendicular to
   * it. Perpendicular is the point: the wind escapes the short way out, so it
   * runs across the disc rather than along it.
   */
  const starburst = entry.starburst ?? 0;
  if (starburst > 0) {
    // Undo the disc flattening so the wind is measured in real proportions,
    // then draw along y, which is across the disc.
    context.restore();
    context.save();
    context.translate(128, 128);
    for (let side = -1; side <= 1; side += 2) {
      for (let filament = 0; filament < 9; filament += 1) {
        const spread = (random() - 0.5) * 62;
        const reach = (72 + random() * 52) * starburst;
        context.beginPath();
        context.moveTo(spread * 0.28, side * 10);
        // Filaments splay as they climb: the wind is a cone, not a column.
        context.quadraticCurveTo(
          spread * 0.7, side * reach * 0.55,
          spread, side * reach,
        );
        const wind = context.createLinearGradient(0, side * 10, 0, side * reach);
        wind.addColorStop(0.00, "rgba(255,120,96,0.30)");
        wind.addColorStop(0.35, "rgba(238,74,66,0.20)");
        wind.addColorStop(1.00, "rgba(180,40,50,0)");
        context.strokeStyle = wind;
        context.lineWidth = 3 + random() * 6;
        context.lineCap = "round";
        context.stroke();
      }
    }
    context.restore();
    context.save();
    context.translate(128, 128);
    context.scale(1, flatten);
  }

  // The dust lane, which is what makes an inclined disc read as inclined.
  context.globalCompositeOperation = "destination-out";
  const lane = context.createLinearGradient(0, -22, 0, 22);
  lane.addColorStop(0, "rgba(0,0,0,0)");
  lane.addColorStop(0.5, "rgba(0,0,0,0.42)");
  lane.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = lane;
  context.fillRect(-120, -22, 240, 44);
  context.restore();

  // The core last, and unflattened: a bulge is a sphere.
  context.globalCompositeOperation = "lighter";
  const core = context.createRadialGradient(128, 128, 0, 128, 128, 34);
  core.addColorStop(0.00, `rgba(255,255,255,${0.95 * entry.core})`);
  core.addColorStop(0.22, rgb(0.62 * entry.core, 1.1));
  core.addColorStop(0.60, rgb(0.16 * entry.core));
  core.addColorStop(1.00, rgb(0));
  context.fillStyle = core;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* -------------------------------------------------------------------- shaders */

const STAR_VERTEX = /* glsl */`
  attribute float aSize;
  attribute vec3 aColour;
  attribute float aPhase;
  uniform float uPixel;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uAtten;
  uniform vec2 uShell;
  varying vec3 vColour;
  varying float vGain;
  void main() {
    vColour = aColour;
    /*
     * Scintillation, at a fraction of the amplitude it would have through an
     * atmosphere -- there is no atmosphere out here and stars do not twinkle
     * in vacuum. It is a *rendering* fix, not a physical one: fixed-size
     * points on a moving camera crawl and shimmer against the pixel grid, and
     * a slow per-star brightness wobble hides the aliasing that causes.
     */
    vGain = 1.0 + sin(uTime * 0.7 + aPhase) * uTwinkle;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float depth = max(1.0, length(viewPosition.xyz));
    /*
     * uShell fades a population out at a given distance from the lens. The sky
     * layers set it past the shell radius and never use it; the near-field
     * motes set it inside their own box, so that the whole field can be
     * translated by whole box widths to follow the camera and the wrap always
     * happens where there is nothing left to see.
     */
    float shell = 1.0 - smoothstep(uShell.x, uShell.y, depth);
    vGain *= shell;
    // uAtten of zero means "fixed on the sky"; anything else is a near-field
    // population whose grains have to get bigger as they come past.
    float scale = uAtten > 0.0 ? clamp(uAtten / depth, 0.25, 3.2) : 1.0;
    gl_PointSize = aSize * uPixel * scale;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const STAR_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec3 vColour;
  varying float vGain;
  void main() {
    float mask = texture2D(uMap, gl_PointCoord).a;
    float alpha = mask * uOpacity * vGain;
    if (alpha <= 0.003) discard;
    gl_FragColor = vec4(vColour, alpha);
  }
`;

/* ----------------------------------------------------------------------- build */

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Builds the whole backdrop.
 *
 * `radius` is the shell the sky is painted on. It has no physical meaning --
 * everything here is between four light years and two and a half million away
 * and the ratios between those are not representable -- so it is chosen to sit
 * comfortably outside Pluto's orbit and comfortably inside the far plane.
 */
export function createDeepSky({
  radius = 3000,
  fieldCount = 26000,
  moteCount = 2600,
  moteSpan = 320,
  pixelRatio = 1,
}) {
  const random = makeRandom(0x5eed1);
  const group = new THREE.Group();
  group.name = "Deep sky";
  const disposables = [];
  const track = (item) => { disposables.push(item); return item; };

  const starTexture = track(makeStarTexture());
  const spikeTexture = track(makeSpikeTexture());

  /* 1 -- the galaxy, sampled */

  const { pole, along, across } = galacticFrame();
  const rift = makeNoise(11.7);
  const arms = makeNoise(53.1);

  const fieldPositions = new Float32Array(fieldCount * 3);
  const fieldColours = new Float32Array(fieldCount * 3);
  const fieldSizes = new Float32Array(fieldCount);
  const fieldPhases = new Float32Array(fieldCount);
  const scratch = new THREE.Vector3();
  const tint = new THREE.Color();

  /*
   * Three populations, because the galaxy has three.
   *
   * The thin disc is where the young bright stars are and it is only a few
   * hundred light years thick, which is why the band is a *band*. The thick
   * disc is older and puffier. The halo is a nearly spherical scatter of very
   * old stars that fills the rest of the sky and is the reason a real sky is
   * never empty away from the Milky Way. Mixing them in these proportions is
   * what makes the band emerge with soft edges instead of a hard stripe.
   */
  const POPULATIONS = [
    { share: 0.60, sigma: 3.4, sizeBias: 0.30, dim: 0.78, bulge: 1.00 },
    { share: 0.26, sigma: 11.0, sizeBias: 0.40, dim: 0.90, bulge: 0.55 },
    { share: 0.14, sigma: 46.0, sizeBias: 0.52, dim: 1.00, bulge: 0.18 },
  ];

  let placed = 0;
  let guard = 0;
  while (placed < fieldCount && guard < fieldCount * 12) {
    guard += 1;
    // Pick a population, then a galactic latitude from its own scale height.
    const roll = random();
    let acc = 0;
    let pop = POPULATIONS[POPULATIONS.length - 1];
    for (let i = 0; i < POPULATIONS.length; i += 1) {
      acc += POPULATIONS[i].share;
      if (roll <= acc) { pop = POPULATIONS[i]; break; }
    }
    // Box-Muller, so latitude really is Gaussian about the plane.
    const u1 = Math.max(1e-6, random());
    const u2 = random();
    const b = Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2) * pop.sigma;
    if (b < -90 || b > 90) continue;

    /*
     * Longitude is not uniform. Looking toward Sagittarius is looking down the
     * length of the disc and through the bar, so there are far more stars in
     * that direction; looking the other way is looking out of the galaxy.
     * Sampled by rejection because the profile is only a few lines and the
     * acceptance rate is high.
     */
    const l = random() * 360 - 180;
    const fromCentre = Math.abs(l);
    const towardCentre = 0.26 + 0.74 * Math.exp(-0.5 * Math.pow(fromCentre / 52, 2));
    const armGain = 0.55 + 0.9 * Math.pow(arms(l * 0.055, b * 0.10), 1.6);
    if (random() > (0.28 + 0.72 * towardCentre * pop.bulge + 0.18) * armGain) continue;

    /*
     * The Great Rift, as an absence. Dust sits in the plane and slightly below
     * it from here, so the lane is offset about a degree rather than centred,
     * and it is ragged. Stars behind it are simply not placed.
     */
    if (Math.abs(b) < 14) {
      const laneNoise = rift(l * 0.048, b * 0.16);
      const laneCentre = -0.9 + (laneNoise - 0.5) * 6.0;
      const laneWidth = 1.5 + laneNoise * 2.6;
      const lane = Math.exp(-0.5 * Math.pow((b - laneCentre) / laneWidth, 2));
      if (random() < lane * 0.80 * towardCentre) continue;
    }

    const bRad = b * DEG;
    const lRad = l * DEG;
    const cosB = Math.cos(bRad);
    scratch.copy(along).multiplyScalar(cosB * Math.cos(lRad))
      .addScaledVector(across, cosB * Math.sin(lRad))
      .addScaledVector(pole, Math.sin(bRad));

    const i3 = placed * 3;
    fieldPositions[i3] = scratch.x * radius;
    fieldPositions[i3 + 1] = scratch.y * radius;
    fieldPositions[i3 + 2] = scratch.z * radius;

    /*
     * A magnitude distribution, not a uniform one. Counts rise steeply toward
     * the faint end -- roughly four times as many stars per magnitude -- so a
     * field with evenly distributed brightness has far too many conspicuous
     * stars and reads as glitter rather than as a galaxy.
     */
    const faint = Math.pow(random(), pop.sizeBias);
    /*
     * The floor matters more than the ceiling. A point under about a device
     * pixel and a half samples only the soft skirt of the star texture and
     * effectively disappears, so a field built with a floor near zero draws
     * eighty thousand stars and shows three hundred -- which is precisely what
     * the first pass did.
     */
    fieldSizes[placed] = 1.35 + (1 - faint) * 3.1;
    // Reddened toward the plane: that light has come through the dust.
    /*
     * Reddening, but not much of it. Interstellar dust does redden the plane,
     * and overdoing it turns the whole band gold -- which is wrong twice over:
     * the integrated light of a galaxy is close to white, and a uniformly warm
     * band is the exact look the painted version was thrown out for.
     */
    const reddening = Math.exp(-0.5 * Math.pow(b / 13, 2)) * 0.26 * towardCentre;
    colourFromBV(-0.30 + Math.pow(random(), 0.80) * 1.85 + reddening, tint);
    const brightness = (0.46 + (1 - faint) * 0.74) * pop.dim;
    fieldColours[i3] = tint.r * brightness;
    fieldColours[i3 + 1] = tint.g * brightness;
    fieldColours[i3 + 2] = tint.b * brightness;
    fieldPhases[placed] = random() * Math.PI * 2;
    placed += 1;
  }

  const fieldGeometry = track(new THREE.BufferGeometry());
  fieldGeometry.setAttribute("position", new THREE.BufferAttribute(fieldPositions.subarray(0, placed * 3), 3));
  fieldGeometry.setAttribute("aColour", new THREE.BufferAttribute(fieldColours.subarray(0, placed * 3), 3));
  fieldGeometry.setAttribute("aSize", new THREE.BufferAttribute(fieldSizes.subarray(0, placed), 1));
  fieldGeometry.setAttribute("aPhase", new THREE.BufferAttribute(fieldPhases.subarray(0, placed), 1));

  /*
   * Depth testing ON, and this is the one setting in the file that must not be
   * turned back off.
   *
   * The reasoning that got it wrong is seductive: the sky is infinitely far
   * away, it can never be in front of anything, so testing it against the
   * depth buffer is wasted work -- turn the test off and give it a very
   * negative renderOrder so it draws first instead. Both halves of that are
   * false.
   *
   * **renderOrder does not order across passes.** three.js draws every opaque
   * object first and every transparent object second, and sorts by renderOrder
   * only *within* each list. These layers are additive and therefore
   * transparent, so a renderOrder of -60 puts them first among the transparent
   * objects -- which is still after every planet, moon and asteroid in the
   * scene. With the depth test off they then painted straight over all of it,
   * and every solid body in the Solar System went see-through with stars
   * inside it.
   *
   * With the test on, the shell sits at three thousand units and loses to
   * anything nearer that wrote depth, which is every solid body. It keeps
   * depthWrite: false, so it still never occludes anything itself. The far
   * plane is not a risk either: the group rides with the camera, so every
   * vertex is at exactly the shell radius from the lens and cannot fall
   * outside the frustum however far out the journey goes.
   */
  const makeStarMaterial = (map, twinkle, atten = 0, shell = [1e9, 1e9 + 1]) => track(new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: {
      uMap: { value: map },
      uOpacity: { value: 0 },
      uPixel: { value: pixelRatio },
      uTime: { value: 0 },
      uTwinkle: { value: twinkle },
      uAtten: { value: atten },
      uShell: { value: new THREE.Vector2(shell[0], shell[1]) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  }));

  const fieldMaterial = makeStarMaterial(starTexture, 0.06);
  const field = new THREE.Points(fieldGeometry, fieldMaterial);
  field.name = "Background star field";
  field.frustumCulled = false;
  field.renderOrder = -56;
  group.add(field);

  /* 3 -- the named stars */
  const namedPositions = new Float32Array(SKY_STARS.length * 3);
  const namedColours = new Float32Array(SKY_STARS.length * 3);
  const namedSizes = new Float32Array(SKY_STARS.length);
  const namedPhases = new Float32Array(SKY_STARS.length);
  const spikes = [];
  const spikeMaterials = [];

  SKY_STARS.forEach((star, index) => {
    celestialToVector(star.ra, star.dec, scratch);
    const i3 = index * 3;
    namedPositions[i3] = scratch.x * radius;
    namedPositions[i3 + 1] = scratch.y * radius;
    namedPositions[i3 + 2] = scratch.z * radius;
    colourFromBV(star.bv, tint);
    namedColours[i3] = tint.r;
    namedColours[i3 + 1] = tint.g;
    namedColours[i3 + 2] = tint.b;
    // Apparent brightness is logarithmic, so size follows the magnitude
    // directly: two and a half magnitudes is a factor of ten in flux.
    const flux = Math.pow(2.512, 1.9 - star.mag);
    namedSizes[index] = 2.6 + Math.min(9.5, Math.pow(flux, 0.42) * 2.3);
    namedPhases[index] = random() * Math.PI * 2;

    if (star.mag > 1.3) return;
    const material = track(new THREE.SpriteMaterial({
      map: spikeTexture,
      color: tint.clone(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    }));
    const sprite = new THREE.Sprite(material);
    sprite.name = `${star.name} flare`;
    sprite.position.set(namedPositions[i3], namedPositions[i3 + 1], namedPositions[i3 + 2]);
    sprite.scale.setScalar(radius * (0.020 + Math.pow(flux, 0.30) * 0.0075));
    sprite.renderOrder = -54;
    sprite.userData.level = Math.min(1, 0.32 + Math.pow(flux, 0.34) * 0.16);
    spikes.push(sprite);
    spikeMaterials.push(material);
    group.add(sprite);
  });

  const namedGeometry = track(new THREE.BufferGeometry());
  namedGeometry.setAttribute("position", new THREE.BufferAttribute(namedPositions, 3));
  namedGeometry.setAttribute("aColour", new THREE.BufferAttribute(namedColours, 3));
  namedGeometry.setAttribute("aSize", new THREE.BufferAttribute(namedSizes, 1));
  namedGeometry.setAttribute("aPhase", new THREE.BufferAttribute(namedPhases, 1));
  const namedMaterial = makeStarMaterial(starTexture, 0.10);
  const named = new THREE.Points(namedGeometry, namedMaterial);
  named.name = "Named stars";
  named.frustumCulled = false;
  named.renderOrder = -55;
  group.add(named);

  /* 4 -- nebulae, clusters and galaxies */
  const deepSkyMaterials = [];
  const deepSkyLevels = [];
  const addSprite = (entry, texture, angularWidth, angularHeight, rotation, level) => {
    const material = track(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      rotation,
      toneMapped: true,
    }));
    const sprite = new THREE.Sprite(material);
    sprite.name = `${entry.name}${entry.catalog ? ` (${entry.catalog})` : ""}`;
    celestialToVector(entry.ra, entry.dec, scratch).multiplyScalar(radius);
    sprite.position.copy(scratch);
    // The painted disc occupies roughly the middle half of its quad, so the
    // quad has to be wider than the object for the object to end up the size
    // its catalogue says it is.
    sprite.scale.set(
      radius * angularWidth * DEG * 1.45,
      radius * angularHeight * DEG * 1.45,
      1,
    );
    sprite.renderOrder = -58;
    sprite.userData.level = level;
    deepSkyMaterials.push(material);
    deepSkyLevels.push(level);
    group.add(sprite);
    return sprite;
  };

  /*
   * Surface brightness, not brightness.
   *
   * A catalogue magnitude is integrated over the whole object, so the Rosette
   * at magnitude 9 spread over 1.3 degrees and the Ring Nebula at magnitude 9
   * spread over four arcminutes are nothing like each other to look at. Drawn
   * at one opacity they came out as a row of identical orange blobs, and the
   * big diffuse ones were by far the worst of it -- five degrees of saturated
   * colour reads as a lens flare, not as a nebula.
   *
   * So level falls with angular area. Everything ends up close to the surface
   * brightness it actually has, which is: faint. These are objects that need a
   * dark sky and twenty minutes of dark adaptation.
   */
  /*
   * Lifted by a fifth over the first pass. The surface-brightness falloff is
   * the right *shape* -- it is what stopped every nebula reading as an
   * identical orange blob -- but tuned purely for honesty it left the sky
   * emptier than the reference the viewer had in mind. This is one multiplier
   * on the whole set, so the relationship between objects is untouched.
   */
  const SKY_RICHNESS = 1.22;
  const surfaceLevel = (size, base) => (base * SKY_RICHNESS)
    / (1 + Math.pow(Math.max(0.1, size), 1.35) * 0.9);

  const NEBULA_BASE = {
    emission: 0.95,
    reflection: 0.62,
    planetary: 0.90,
    "supernova-remnant": 0.66,
    "open-cluster": 0.62,
    "globular-cluster": 0.95,
  };

  SKY_NEBULAE.forEach((entry) => {
    // Dark nebulae are already there: the star sampler declines to place
    // stars behind them, which is what a dark nebula is. Adding light for one
    // here would be exactly backwards.
    if (entry.kind === "dark") return;
    addSprite(
      entry,
      track(makeDeepSkyTexture(entry, random)),
      entry.size,
      entry.size,
      random() * Math.PI * 2,
      surfaceLevel(entry.size, NEBULA_BASE[entry.kind] ?? 0.4),
    );
  });

  SKY_GALAXIES.forEach((entry) => {
    /*
     * Andromeda is the exception the viewer asked for by name, and it is a
     * fair one: it is genuinely the brightest thing on this list and its core
     * is genuinely a naked-eye object. It gets its surface brightness lifted
     * so that it reads as a tilted disc with a bright middle rather than as
     * another faint smudge -- which is also how every photograph of it looks,
     * because a photograph integrates and an eye does not.
     */
    const emphasis = entry.catalog === "M31" ? 2.4 : (1 + (entry.starburst ?? 0) * 0.55);
    addSprite(
      entry,
      track(makeGalaxyTexture(entry, random)),
      entry.sizeMajor,
      entry.sizeMajor,
      entry.angle * DEG,
      surfaceLevel(entry.sizeMajor, 0.56) * emphasis,
    );
  });

  /*
   * 5 -- the near field.
   *
   * The one layer that is *not* on the shell and does not follow the camera.
   * Everything above is infinitely far away and therefore completely static
   * however the shot moves, which is correct and also lifeless -- a sky that
   * never shifts against the foreground reads as a painted backdrop, because
   * that is what it is. These motes sit within a few hundred units of the lens
   * and slide past it, and that parallax is the entire reason the backdrop
   * reads as space rather than as wallpaper.
   *
   * Physically they are the interplanetary dust that also produces the
   * zodiacal light: real, present, and the reason the reference photographs
   * have glints in the foreground.
   */
  const motePositions = new Float32Array(moteCount * 3);
  const moteColours = new Float32Array(moteCount * 3);
  const moteSizes = new Float32Array(moteCount);
  const motePhases = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i += 1) {
    const i3 = i * 3;
    motePositions[i3] = (random() - 0.5) * moteSpan * 2;
    motePositions[i3 + 1] = (random() - 0.5) * moteSpan * 2;
    motePositions[i3 + 2] = (random() - 0.5) * moteSpan * 2;
    const warm = 0.72 + random() * 0.28;
    moteColours[i3] = warm;
    moteColours[i3 + 1] = warm * (0.88 + random() * 0.12);
    moteColours[i3 + 2] = warm * (0.78 + random() * 0.22);
    moteSizes[i] = 0.7 + Math.pow(random(), 2.2) * 2.6;
    motePhases[i] = random() * Math.PI * 2;
  }
  const moteGeometry = track(new THREE.BufferGeometry());
  moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute("aColour", new THREE.BufferAttribute(moteColours, 3));
  moteGeometry.setAttribute("aSize", new THREE.BufferAttribute(moteSizes, 1));
  moteGeometry.setAttribute("aPhase", new THREE.BufferAttribute(motePhases, 1));
  const moteMaterial = makeStarMaterial(
    starTexture,
    0.22,
    moteSpan * 0.42,
    [moteSpan * 0.62, moteSpan * 0.98],
  );
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  motes.name = "Interplanetary dust motes";
  motes.frustumCulled = false;
  motes.renderOrder = -50;

  const skyRoot = new THREE.Group();
  skyRoot.name = "Deep sky root";
  skyRoot.add(group, motes);

  return {
    object: skyRoot,

    /**
     * Levels come from the journey, and the reason they do is that the sky is
     * not equally visible from everywhere in the Solar System. Close to the
     * Sun the sky is washed out; from the Kuiper Belt the Sun is a bright star
     * and the sky is everything else. So the backdrop comes up as the journey
     * goes out -- which is both true and the more useful of the two, because
     * it keeps the inner system readable.
     */
    update({ time = 0, journeyProgress = 0, contrast = 1, camera = null }) {
      const reach = Math.min(1, Math.max(0, journeyProgress));
      const level = (0.42 + 0.58 * Math.pow(reach, 0.7)) * contrast;

      fieldMaterial.uniforms.uOpacity.value = level;
      fieldMaterial.uniforms.uTime.value = time;
      namedMaterial.uniforms.uOpacity.value = level;
      namedMaterial.uniforms.uTime.value = time;
      moteMaterial.uniforms.uOpacity.value = level * 0.62;
      moteMaterial.uniforms.uTime.value = time;

      for (let i = 0; i < spikes.length; i += 1) {
        spikeMaterials[i].opacity = level * spikes[i].userData.level;
      }
      for (let i = 0; i < deepSkyMaterials.length; i += 1) {
        deepSkyMaterials[i].opacity = level * deepSkyLevels[i];
      }

      if (!camera) return;
      // The shell rides with the lens; nothing on it is reachable.
      group.position.copy(camera.position);
      /*
       * The motes wrap around the camera on a torus the size of their own
       * box. Recycling them on the CPU would mean touching two and a half
       * thousand positions a frame and re-uploading the buffer; moving the
       * whole field by whole box-widths costs three subtractions and puts the
       * camera back in the middle of it, which is the same thing seen from
       * the other side.
       */
      const span = moteSpan * 2;
      motes.position.set(
        Math.round(camera.position.x / span) * span,
        Math.round(camera.position.y / span) * span,
        Math.round(camera.position.z / span) * span,
      );
    },

    resize(nextPixelRatio) {
      const value = Math.max(0.5, Number(nextPixelRatio) || 1);
      fieldMaterial.uniforms.uPixel.value = value;
      namedMaterial.uniforms.uPixel.value = value;
      moteMaterial.uniforms.uPixel.value = value;
    },

    dispose() {
      skyRoot.removeFromParent();
      disposables.forEach((item) => item.dispose?.());
      disposables.length = 0;
    },
  };
}

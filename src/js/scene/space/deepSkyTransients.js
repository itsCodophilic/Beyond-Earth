import * as THREE from "three";
import { GALACTIC, celestialToVector } from "./skyCatalogue.js";

/**
 * The sky that is *doing something*.
 *
 * Everything in deepSky.js is, by construction, permanent. Stars at their
 * J2000 positions, nebulae at their catalogue sizes, the Milky Way on its real
 * great circle -- all of it correct, all of it frozen. A real sky is not
 * frozen. Point a survey telescope anywhere for a year and something in the
 * frame will brighten by ten magnitudes and then take months to go away again.
 *
 * Two things live here, and neither of them is in the catalogue.
 *
 * ## 1. Heterogeneous dust
 *
 * The reference the viewer had in mind is the one every wide-field astrophoto
 * shows and no star catalogue contains: the sky is not black between the
 * stars, it is *dirty*. Galactic cirrus, reflection nebulosity, hydrogen
 * emission, and the dark absorbing lanes in front of all of it, in a mixture
 * of colours rather than one tint.
 *
 * The colours are not invented. From Clark's true-colour analysis of what a
 * calibrated sensor actually records:
 *
 *   - dust in transmission is **orange to brownish-red**, because absorption
 *     goes as roughly 1/lambda^1.5 and the blue end is eaten first -- the same
 *     reason wildfire smoke is orange
 *   - reflection nebulae are **blue**, Rayleigh scattering off grains smaller
 *     than the wavelength, exactly the mechanism that makes Earth's daytime
 *     sky blue
 *   - hydrogen emission is **pink to magenta** where dust is present (H-alpha
 *     red surviving while H-beta and H-gamma are absorbed) and drifts toward
 *     blue-violet where it is not
 *   - doubly-ionised oxygen is **teal to cyan** at 501 nm, the colour that
 *     dominates planetary nebulae
 *
 * So the clouds here are drawn from those four families, weighted, and placed
 * in every direction -- concentrated toward the galactic plane, where the dust
 * actually is, but never absent from the poles, because the IRAS cirrus is a
 * genuinely all-sky feature. Their surface brightness is very low. That is not
 * timidity: this material is far below the naked-eye threshold and the failure
 * mode of drawing it brightly is the one this project has already made once,
 * where painted smears hung in front of the stars and read as smears.
 *
 * ## 2. Transients
 *
 * A star explodes, and its light does not flash and vanish. It climbs for
 * days to weeks, sits near peak, and then fades for months to years down a
 * radioactive tail. Three real families are modelled, with real timescales:
 *
 *   | family    | rise      | shape after peak                  | visible for |
 *   |-----------|-----------|-----------------------------------|-------------|
 *   | Type Ia   | ~19 days  | steep decline onto a Co-56 tail   | ~450 days   |
 *   | Type II-P | ~10 days  | ~100-day *plateau*, drop, tail    | ~480 days   |
 *   | nova      | 1-2 days  | steep, no plateau                 | ~40 days    |
 *
 * The plateau is the interesting one and the reason II-P is worth modelling
 * separately: the light curve stays flat for about a hundred days while the
 * hydrogen recombination front eats inward through the expanding envelope, and
 * then falls off a cliff onto the same cobalt tail every core-collapse
 * supernova has.
 *
 * Rates are real too, and they are wildly different, which is why novae
 * dominate what you see here: the Milky Way makes about **46 +/- 13 classical
 * novae a year** and about **two supernovae a century**. Supernovae are not
 * rare on this sky only because this sky is not just the Milky Way -- every
 * one of the galaxies out there is running its own one-or-two-per-century, and
 * there are a great many galaxies, so the extragalactic ones are scattered
 * isotropically while the novae hug the plane and the bulge.
 *
 * ## Time
 *
 * Compressed, and it has to be: nobody is going to sit through a hundred-day
 * plateau. `DAYS_PER_SECOND` is the entire conversion and everything else is
 * expressed in days, so the physics stays legible and the pacing is one
 * number. At twelve days a second a Type Ia rises in a second and a half and
 * is gone in about forty seconds, which is long enough to read as *fading*
 * rather than blinking -- which was the whole point.
 */

const DEG = Math.PI / 180;

/** Scene seconds to days of supernova evolution. One knob for all pacing. */
export const DAYS_PER_SECOND = 12;

/*
 * Real occurrence rates, and the mix that comes out of them.
 *
 * Not the literal ratio -- 46 novae a year against 0.02 galactic supernovae is
 * 2300:1, and a sky where a supernova appears once every forty minutes of
 * viewing would be honest and unwatchable. The extragalactic population is
 * what makes any supernova rate defensible at all: the weights below put
 * novae in the majority, as they should be, without hiding the events that
 * are actually worth watching fade.
 */
const TRANSIENT_FAMILIES = [
  {
    id: "nova",
    label: "Classical nova",
    weight: 0.54,
    /* Milky Way rate: 46 +/- 13 per year (Palomar Gattini-IR, 2021). */
    riseDays: 1.6,
    plateauDays: 0,
    fallDays: 16,
    tailDays: 30,
    tailLevel: 0.14,
    peak: 0.62,
    /* Novae are galactic: disc and bulge, not isotropic. */
    planeBias: 0.86,
    colour: [1.0, 0.86, 0.66],
    lateColour: [1.0, 0.62, 0.36],
  },
  {
    id: "ia",
    label: "Type Ia supernova",
    weight: 0.19,
    /* ~19 days from first light to B-band maximum. */
    riseDays: 19,
    plateauDays: 0,
    fallDays: 34,
    tailDays: 400,
    tailLevel: 0.11,
    peak: 1.0,
    /* Thermonuclear detonations happen in every galaxy: isotropic. */
    planeBias: 0.12,
    colour: [0.86, 0.90, 1.0],
    lateColour: [1.0, 0.78, 0.58],
  },
  {
    id: "iip",
    label: "Type II-P supernova",
    weight: 0.27,
    riseDays: 10,
    /* The hydrogen recombination plateau: about a hundred days, flat. */
    plateauDays: 100,
    fallDays: 26,
    tailDays: 360,
    tailLevel: 0.16,
    peak: 0.84,
    /* Core collapse follows star formation, which follows the disc. */
    planeBias: 0.44,
    colour: [1.0, 0.83, 0.62],
    lateColour: [1.0, 0.54, 0.32],
  },
];

/*
 * The four colour families of diffuse sky material, with the physics that
 * gives each one its hue. Weights are roughly how much of the sky each covers.
 */
/**
 * The colour of interstellar material, as a three-stop ramp per family.
 *
 * The colours are not invented. From Clark's true-colour analysis of what a
 * calibrated sensor actually records, and from the JWST Carina image the
 * viewer supplied as the reference:
 *
 *   - dust in transmission is **orange to brownish-red**, because absorption
 *     goes as roughly 1/lambda^1.5 and the blue end is eaten first -- the same
 *     reason wildfire smoke is orange. It is the dominant colour in the
 *     reference by a wide margin.
 *   - where hot young stars have blown a cavity, the dust wall is lit from one
 *     side and the rim goes **pale tan and cream**, far brighter than the body
 *     of the cloud. That rim lighting is most of what makes the reference read
 *     as three-dimensional rather than as a stain.
 *   - the cavity itself is **deep blue**, scattered starlight plus the sheer
 *     number of hot stars in it.
 *   - hydrogen emission is **pink to magenta** where dust is present, and
 *     doubly-ionised oxygen is **teal** at 501 nm -- both visible in the
 *     reference as wisps at the boundary.
 *
 * Each family is `deep` (the shadowed body of the cloud), `mid` (its bulk) and
 * `rim` (the lit edge). Ramping between the three by *density* is what
 * produces the lit-wall look: the thin outskirts glow and the thick middle
 * goes dark, which is the opposite of what a plain radial gradient does and
 * the reason the first version read as blobs.
 */
/*
 * The three cool families are deliberately brighter than the warm dust, and
 * that is the physics rather than a preference.
 *
 * Dust in transmission is *dark* by construction: it is material seen by the
 * light it failed to absorb, so its brightness is capped by whatever is behind
 * it. Emission is the opposite -- ionised hydrogen and doubly-ionised oxygen
 * are radiating at their own narrow lines, and a reflection cavity is
 * scattering the direct light of hot young stars. Those three genuinely
 * outshine the dust around them, and drawing them all at one level made them
 * look like tinted dust rather than like light sources.
 */
const CLOUD_FAMILIES = [
  {
    id: "dust",
    label: "Dust in transmission",
    /*
     * Over half the sky, and that is the reference's balance rather than a
     * guess. The Carina image is warm dust almost everywhere, with the blue
     * cavity and the coloured wisps reading as accents against it. A first
     * pass with the four families closer to even gave the sky a loud magenta
     * quarter that pulled the eye off the Solar System, which is the wrong way
     * round for a backdrop.
     */
    weight: 0.58,
    deep: [0.22, 0.10, 0.07],
    mid: [0.68, 0.34, 0.18],
    rim: [0.99, 0.80, 0.60],
    level: [0.26, 0.46],
  },
  {
    id: "cavity",
    label: "Illuminated cavity",
    weight: 0.15,
    deep: [0.06, 0.14, 0.32],
    mid: [0.26, 0.52, 0.96],
    rim: [0.82, 0.94, 1.00],
    level: [0.34, 0.56],
  },
  {
    id: "halpha",
    label: "Hydrogen emission",
    weight: 0.16,
    deep: [0.28, 0.08, 0.16],
    /*
     * Brighter than the dust, not more saturated.
     *
     * These were pulled back once because a fully saturated magenta made a
     * loud quarter of the sky. The answer to "not shiny enough" is not to put
     * that saturation back -- it is to raise the *luminosity* while keeping the
     * hue restrained, which is also what the reference shows: emission regions
     * are the brightest thing in the frame without being the most colourful.
     */
    mid: [0.82, 0.32, 0.44],
    rim: [1.00, 0.82, 0.80],
    level: [0.34, 0.54],
  },
  {
    id: "oiii",
    label: "Doubly-ionised oxygen",
    weight: 0.11,
    deep: [0.06, 0.22, 0.23],
    mid: [0.32, 0.82, 0.78],
    rim: [0.86, 1.00, 0.98],
    level: [0.36, 0.58],
  },
];

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pickWeighted(families, random) {
  let total = 0;
  for (let i = 0; i < families.length; i += 1) total += families[i].weight;
  let roll = random() * total;
  for (let i = 0; i < families.length; i += 1) {
    roll -= families[i].weight;
    if (roll <= 0) return families[i];
  }
  return families[families.length - 1];
}

function galacticFrame() {
  const pole = celestialToVector(GALACTIC.poleRa, GALACTIC.poleDec, new THREE.Vector3());
  const centre = celestialToVector(GALACTIC.centreRa, GALACTIC.centreDec, new THREE.Vector3());
  const along = centre.clone().addScaledVector(pole, -centre.dot(pole)).normalize();
  const across = new THREE.Vector3().crossVectors(pole, along).normalize();
  return { pole, along, across };
}

/**
 * A direction on the unit sphere, optionally pulled toward the galactic plane.
 *
 * `bias` of zero is genuinely isotropic -- every direction equally likely,
 * which is what extragalactic supernovae are. `bias` of one concentrates
 * hard into the disc, which is what novae are. Everything in this file that
 * places something in the sky comes through here, which is how "in all
 * directions" is guaranteed rather than hoped for: even at bias 0.9 the
 * Gaussian in latitude has full support, so nothing is ever excluded from the
 * poles, it is only rarer there.
 */
function skyDirection(frame, bias, random, out) {
  if (random() > bias) {
    // Uniform on the sphere. cos(latitude) must be uniform, not latitude, or
    // everything piles up at the poles.
    const z = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return out.set(r * Math.cos(theta), r * Math.sin(theta), z).normalize();
  }
  const u1 = Math.max(1e-6, random());
  const u2 = random();
  // Box-Muller: latitude Gaussian about the plane, scale height in degrees.
  const sigma = 7 + (1 - bias) * 30;
  const b = Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2) * sigma;
  const latitude = THREE.MathUtils.clamp(b, -89, 89) * DEG;
  // Longitude leans toward the galactic centre, where the bulge is.
  const centreward = Math.pow(random(), 1.9) * (random() < 0.5 ? -1 : 1);
  const longitude = centreward * Math.PI;
  const cosB = Math.cos(latitude);
  return out.copy(frame.along).multiplyScalar(cosB * Math.cos(longitude))
    .addScaledVector(frame.across, cosB * Math.sin(longitude))
    .addScaledVector(frame.pole, Math.sin(latitude))
    .normalize();
}

/* ------------------------------------------------------------------ textures */

/* ------------------------------------------------------- nebula texturing */

/**
 * Seeded 2D value noise with a smooth interpolant.
 *
 * A permutation table rather than a hash-of-sin, because this is called about
 * a hundred and fifty thousand times per texture and `Math.sin` is the most
 * expensive thing that could possibly be in that loop.
 */
function makeValueNoise(seed) {
  const size = 256;
  const mask = size - 1;
  const table = new Float32Array(size * size);
  let state = (seed >>> 0) || 1;
  for (let i = 0; i < table.length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    table[i] = state / 4294967296;
  }
  const at = (x, y) => table[((y & mask) << 8) + (x & mask)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    // Quintic smoothstep: continuous second derivative, so no visible creases
    // along the lattice lines -- which cubic smoothstep does show once the
    // result is pushed through a domain warp.
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return (a + (b - a) * u) + ((c - a) + (a - b - c + d) * u) * v;
  };
}

/**
 * A cloud of interstellar material.
 *
 * ## Why this is not made of circles any more
 *
 * The first version drew each cloud as forty-six overlapping radial gradients
 * with a few dark ones subtracted. That is a reasonable way to get a ragged
 * outline and a completely wrong way to get *nebulosity*, and it was reported
 * as looking ugly and unreal, which it did. The problem is that overlapping
 * discs have structure at exactly one scale -- the disc radius -- and real
 * interstellar dust has structure at every scale at once, because it is
 * turbulent. Blur a photograph of the Carina Nebula as much as you like and
 * there is still detail in it; blur a pile of circles and you get one blob.
 *
 * ## What it is made of instead
 *
 * Fractal noise, put through a **domain warp**. Three octave-stacks are
 * evaluated: the first two produce a vector field, and the third is sampled at
 * coordinates displaced by that field. Distorting the sampling grid by a
 * field that is itself fractal is what produces the drawn-out wisps, curls and
 * cliff edges that read as gas rather than as texture -- it is the difference
 * between static and smoke, and it costs one extra noise stack.
 *
 * ## Why the thin parts are the bright parts
 *
 * Colour ramps from `deep` through `mid` to `rim` by density, and the ramp is
 * arranged so the *outskirts* take the bright rim colour while the thick core
 * goes dark. That is the lighting in the reference image: a wall of dust with
 * hot stars on one side of it, so the illuminated edge is pale and cream and
 * the body of the cloud behind it is opaque brown. A radial gradient does the
 * exact opposite -- brightest in the middle, fading out -- which is what makes
 * it read as a smudge rather than as a solid object with light falling on it.
 */
function makeNebulaTexture(family, random) {
  /*
   * 192 square. These are stretched across tens of degrees of sky at low
   * opacity, so resolution buys little visually, and the cost here is real:
   * every pixel runs three fBm stacks, so this is roughly half a million noise
   * evaluations per texture on the main thread at load.
   */
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const data = image.data;

  const noise = makeValueNoise(Math.floor(random() * 0xffffff));

  /*
   * Weighted toward the low octaves, hard.
   *
   * The first attempt used a textbook 1/2-per-octave stack, and the result was
   * accurate fractal noise that looked like *static* -- fine speckle with no
   * shape. Real nebulosity is the other way round: enormous smooth masses with
   * detail only where something is happening to them. Halving the high-octave
   * weights puts the energy into the two lowest bands, which is what gives it
   * flowing structure to hang the detail off.
   */
  const fbm = (x, y) => (
    noise(x, y) * 0.60
    + noise(x * 2.03, y * 2.03) * 0.26
    + noise(x * 4.07, y * 4.07) * 0.09
    + noise(x * 8.11, y * 8.11) * 0.05
  );

  // A different patch of noise space per cloud, so no two are the same shape.
  const offsetX = random() * 90;
  const offsetY = random() * 90;
  const scale = 1.5 + random() * 1.1;
  const warp = 3.4 + random() * 2.6;

  const lerp = (a, b, t) => a + (b - a) * t;

  /*
   * Two passes, and the second one is where the picture comes from.
   *
   * Pass one fills a density field. Pass two lights it, by taking the
   * difference between each pixel's density and the density a few pixels away
   * in a fixed direction -- a directional derivative, which is high on a face
   * turned toward the light and negative on one turned away.
   *
   * That is what the reference image is: not a stain, but a *wall* of dust
   * with hot young stars on one side of it, so the edges facing them are pale
   * cream and the far sides fall into shadow. Colouring by density alone
   * cannot produce that at all -- density says how much material there is, not
   * which way it faces -- which is why the first version read as a smudge no
   * matter how good the noise underneath it was.
   *
   * The derivative is free: the density field is already in memory, so this is
   * two array reads per pixel and no extra noise evaluations.
   */
  const density = new Float32Array(size * size);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const u = px / size;
      const v = py / size;
      const x = offsetX + u * scale * 4;
      const y = offsetY + v * scale * 4;

      // Domain warp: a fractal displacement of the sampling coordinates. This
      // is what turns noise into smoke -- the curls and drawn-out filaments
      // come from distorting the grid by a field that is itself fractal.
      const q1 = fbm(x, y);
      const q2 = fbm(x + 5.2, y + 1.3);
      const r1 = fbm(x + warp * q1, y + warp * q2);
      const r2 = fbm(x + warp * q1 + 1.7, y + warp * q2 + 9.2);
      let d = fbm(x + warp * r1, y + warp * r2);

      // Contrast: raw fBm sits in a narrow band around the middle and reads as
      // fog. Pushing the low end down opens genuine holes for the filaments to
      // be filaments against.
      d = Math.pow(Math.max(0, (d - 0.34) / 0.58), 1.25);

      /*
       * An irregular edge, not a circle.
       *
       * A plain radial falloff gives every cloud the same round silhouette,
       * and ninety round silhouettes read as ninety blobs however good the
       * inside of each one is. Modulating the falloff radius by a low
       * frequency of the same noise field makes the outline wander, so the
       * boundary between one cloud and the next disappears.
       */
      const dx = u - 0.5;
      const dy = v - 0.5;
      const wobble = 0.78 + noise(x * 0.42 + 31.7, y * 0.42 + 12.4) * 0.62;
      const radial = Math.min(1, (Math.sqrt(dx * dx + dy * dy) * 2.05) / wobble);
      d *= 1 - radial * radial * (3 - 2 * radial);

      density[py * size + px] = d;
    }
  }

  /*
   * The light is taken from a blurred copy of the density, not the raw field.
   *
   * Lighting the raw field was the first attempt and it produced something
   * unmistakable and wrong: every small ripple in the noise got its own bright
   * rim, and the result looked like brain coral -- a mat of tangled worms
   * rather than a cloud. The mistake is that a derivative amplifies whatever
   * is smallest, so a fractal field lit directly is lit almost entirely by its
   * highest octave.
   *
   * Blurring first fixes it at the root. The colour still carries every octave
   * of detail, but the *shape the light falls on* is only the large-scale
   * form, which is what happens physically too: a star illuminates the face of
   * a cloud, not each cubic parsec of turbulence inside it.
   *
   * Separable box blur, two passes, radius five. Two arrays and about eight
   * array reads per pixel; nothing here is worth optimising further.
   */
  const BLUR = 5;
  const blurred = new Float32Array(size * size);
  {
    const scratch = new Float32Array(size * size);
    for (let py = 0; py < size; py += 1) {
      for (let px = 0; px < size; px += 1) {
        let sum = 0;
        let count = 0;
        for (let k = -BLUR; k <= BLUR; k += 1) {
          const sx = px + k;
          if (sx < 0 || sx >= size) continue;
          sum += density[py * size + sx];
          count += 1;
        }
        scratch[py * size + px] = sum / count;
      }
    }
    for (let py = 0; py < size; py += 1) {
      for (let px = 0; px < size; px += 1) {
        let sum = 0;
        let count = 0;
        for (let k = -BLUR; k <= BLUR; k += 1) {
          const sy = py + k;
          if (sy < 0 || sy >= size) continue;
          sum += scratch[sy * size + px];
          count += 1;
        }
        blurred[py * size + px] = sum / count;
      }
    }
  }

  // One light direction per cloud, so a whole complex is not lit from the same
  // side -- which would look like a lighting rig rather than like stars.
  const lightAngle = random() * Math.PI * 2;
  const lx = Math.round(Math.cos(lightAngle) * 7);
  const ly = Math.round(Math.sin(lightAngle) * 7);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const index = py * size + px;
      const d = density[index];

      const sx = Math.min(size - 1, Math.max(0, px + lx));
      const sy = Math.min(size - 1, Math.max(0, py + ly));
      // Positive where the large-scale form rises toward the light: a lit face.
      const slope = blurred[index] - blurred[sy * size + sx];

      // Body colour: thin material takes the mid tone, thick goes into shadow.
      const t = Math.min(1, d * 1.9);
      let r = lerp(family.deep[0], family.mid[0], Math.min(1, t * 1.6));
      let g = lerp(family.deep[1], family.mid[1], Math.min(1, t * 1.6));
      let b = lerp(family.deep[2], family.mid[2], Math.min(1, t * 1.6));
      // Self-shadowing: the far side of a thick clump darkens.
      const shade = Math.max(0, -slope) * 5.0;
      r *= 1 - Math.min(0.55, shade);
      g *= 1 - Math.min(0.55, shade);
      b *= 1 - Math.min(0.55, shade);
      /*
       * The lit face. Gain of 2.6 rather than the 7.5 of the first attempt --
       * that number was set to make the rims obvious and it made them the only
       * thing present. It is also gated on there being material here: a
       * highlight on empty sky is a highlight on nothing.
       */
      const lit = Math.min(1, Math.max(0, slope) * 2.6) * Math.min(1, d * 2.2);
      r = lerp(r, family.rim[0], lit);
      g = lerp(g, family.rim[1], lit);
      b = lerp(b, family.rim[2], lit);

      const out = index * 4;
      data[out] = Math.round(Math.min(1, r) * 255);
      data[out + 1] = Math.round(Math.min(1, g) * 255);
      data[out + 2] = Math.round(Math.min(1, b) * 255);
      // The body carries the alpha; the lit face only nudges it, so the cloud
      // reads as a mass with light on it rather than as a set of bright edges
      // with nothing in between.
      data[out + 3] = Math.round(
        Math.min(1, Math.pow(d, 0.72) + lit * 0.16) * 255,
      );
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A hot core with a long skirt: what an unresolved point source looks like. */
function makeFlareTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const centre = size / 2;
  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre);
  gradient.addColorStop(0.00, "rgba(255,255,255,1)");
  gradient.addColorStop(0.06, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.44)");
  gradient.addColorStop(0.36, "rgba(255,255,255,0.13)");
  gradient.addColorStop(0.66, "rgba(255,255,255,0.035)");
  gradient.addColorStop(1.00, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const TRANSIENT_VERTEX = /* glsl */`
  attribute float aSize;
  attribute vec3 aColour;
  uniform float uPixel;
  varying vec3 vColour;
  void main() {
    vColour = aColour;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixel;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const TRANSIENT_FRAGMENT = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying vec3 vColour;
  void main() {
    float mask = texture2D(uMap, gl_PointCoord).a;
    float alpha = mask * uOpacity;
    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(vColour, alpha);
  }
`;

/* -------------------------------------------------------------- light curves */

/**
 * Brightness of one transient, as a fraction of its own peak, at `days` after
 * first light.
 *
 * The shape is the physics, in four segments:
 *
 *   1  **rise** -- shock breakout and expanding photosphere. Not linear;
 *      early-time flux goes roughly as t^2 while the fireball expands, which
 *      is why the curve is slow to leave zero and then accelerates.
 *   2  **plateau** -- Type II-P only. The envelope is expanding and cooling at
 *      exactly the rate that keeps the recombination front's luminosity flat.
 *      Hydrogen is what makes this possible, which is why Ia, having none,
 *      does not have one.
 *   3  **fall** -- the plateau collapses, or for Ia the photosphere thins out.
 *   4  **tail** -- Co-56 to Fe-56, 77.2-day half-life. A straight line in
 *      magnitude, an exponential in flux, and the same slope for every
 *      core-collapse supernova ever measured. This is the part that takes a
 *      year to go away and the reason the viewer is right that the light
 *      does not just vanish.
 */
function lightCurve(family, days) {
  if (days <= 0) return 0;
  const { riseDays, plateauDays, fallDays, tailDays, tailLevel } = family;

  if (days < riseDays) {
    const t = days / riseDays;
    return t * t * (3 - 2 * t);
  }
  const afterPeak = days - riseDays;
  if (plateauDays > 0 && afterPeak < plateauDays) {
    // Not perfectly flat: real plateaus sag a few tenths of a magnitude.
    return 1 - 0.14 * (afterPeak / plateauDays);
  }
  const fallStart = afterPeak - plateauDays;
  const plateauEnd = plateauDays > 0 ? 0.86 : 1;
  if (fallStart < fallDays) {
    const t = fallStart / fallDays;
    return plateauEnd + (tailLevel - plateauEnd) * (t * t * (3 - 2 * t));
  }
  // Cobalt-56 decay: 77.2-day half-life, so e-folding every 111.4 days.
  const intoTail = fallStart - fallDays;
  return tailLevel * Math.exp(-intoTail / 111.4) * (1 - intoTail / tailDays);
}

/* ------------------------------------------------------------------- factory */

export function createDeepSkyTransients({
  radius = 3000,
  cloudCount = 30,
  slots = 14,
  pixelRatio = 1,
  seed = 0x517e3,
} = {}) {
  const random = makeRandom(seed || 0x517e3);
  const frame = galacticFrame();
  const disposables = [];
  const track = (item) => { disposables.push(item); return item; };

  const group = new THREE.Group();
  group.name = "Deep sky transients";

  /* ---- the dust ---- */

  /*
   * A texture per family per variant, not one per cloud and not one per
   * family.
   *
   * One per family made every cloud of a colour literally identical, which at
   * these sizes is visible as repetition once they overlap. One per cloud
   * would be ninety domain-warped fBm canvases -- about sixty million noise
   * evaluations on the main thread at load, which is several seconds of frozen
   * page. Three variants each is twelve textures, roughly eight million
   * evaluations, and with random rotation, mirroring and scale on top there is
   * no visible repeat.
   */
  const VARIANTS_PER_FAMILY = 3;
  const cloudTextures = new Map();
  CLOUD_FAMILIES.forEach((family) => {
    const variants = [];
    for (let v = 0; v < VARIANTS_PER_FAMILY; v += 1) {
      variants.push(track(makeNebulaTexture(family, random)));
    }
    cloudTextures.set(family.id, variants);
  });

  /*
   * Families are dealt out, not drawn.
   *
   * Sampling each cloud's family independently from the weights does not work
   * at this sample size: a 14% family is missed entirely often enough to
   * matter, and the first seed tried produced zero of one colour -- so the sky
   * lost a whole hue to chance, which fails a brief that asked for a mixture.
   * This is set dressing, not a statistical simulation, so it allocates each
   * family its share directly, hands the rounding remainder to whoever was
   * rounded down hardest, and shuffles the bag.
   */
  const cloudPlan = [];
  {
    const totalWeight = CLOUD_FAMILIES.reduce((sum, item) => sum + item.weight, 0);
    const shares = CLOUD_FAMILIES.map((family) => ({
      family,
      exact: (family.weight / totalWeight) * cloudCount,
    }));
    shares.forEach((share) => {
      share.count = cloudCount >= CLOUD_FAMILIES.length
        ? Math.max(1, Math.floor(share.exact))
        : Math.floor(share.exact);
    });
    let assigned = shares.reduce((sum, share) => sum + share.count, 0);
    shares
      .slice()
      .sort((a, b) => (b.exact - b.count) - (a.exact - a.count))
      .forEach((share) => {
        if (assigned >= cloudCount) return;
        const room = Math.min(cloudCount - assigned, Math.ceil(share.exact) - share.count);
        share.count += Math.max(0, room);
        assigned += Math.max(0, room);
      });
    shares.forEach((share) => {
      for (let n = 0; n < share.count; n += 1) cloudPlan.push(share.family);
    });
    while (cloudPlan.length < cloudCount) cloudPlan.push(CLOUD_FAMILIES[0]);
    for (let i = cloudPlan.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [cloudPlan[i], cloudPlan[j]] = [cloudPlan[j], cloudPlan[i]];
    }
  }

  /*
   * Placement: chains, not scatter.
   *
   * This is the second half of why the first version read as blobs. Every
   * cloud was placed independently, so what the sky showed was thirty-odd
   * separate smudges with black between them -- and the note back was exactly
   * that: it looks scattered, and real dust is continuous.
   *
   * Real dust *is* continuous, and it is continuous in a particular way: it
   * lies in filaments and sheets, thousands of light years long, because it is
   * shaped by turbulence and by the shells that supernovae blow through it.
   * Nowhere in the sky is there an isolated cloud with nothing around it.
   *
   * So the clouds are laid down in **chains**. A handful of seed directions
   * are chosen across the whole sphere, and from each, a chain walks a
   * wandering path in small steps, dropping an overlapping cloud at each one.
   * Consecutive clouds are close enough that their textures merge, so a chain
   * reads as one continuous ribbon of material rather than as a row of
   * separate objects -- and because the chains are long and start everywhere,
   * the whole sky is connected without any of it being uniform.
   *
   * The step is deliberately smaller than the cloud size. That overlap is what
   * does the work: two fractal textures at forty per cent overlap produce a
   * third structure across the join that belongs to neither of them.
   */
  const CHAIN_COUNT = Math.max(3, Math.round(cloudCount / 9));
  const cloudSprites = [];
  const direction = new THREE.Vector3();
  const chainStep = new THREE.Vector3();
  const chainSide = new THREE.Vector3();

  let placed = 0;
  for (let chain = 0; chain < CHAIN_COUNT && placed < cloudCount; chain += 1) {
    /*
     * Chain heads are spread over the whole sphere with a mild pull toward the
     * galactic plane, where the dust actually is. Mild, not strong: the IRAS
     * cirrus is a genuinely all-sky feature and the brief asked for every
     * direction, so the poles must never be bare.
     */
    skyDirection(frame, 0.45, random, direction);
    // A direction to walk in: any tangent at the head will do.
    const helper = Math.abs(direction.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    chainStep.crossVectors(direction, helper).normalize();
    chainSide.crossVectors(direction, chainStep).normalize();

    const linksWanted = Math.ceil(cloudCount / CHAIN_COUNT);
    // The chain's own character: how big its clouds are and how far it walks.
    const chainSpan = 15 + random() * 26;
    const chainFamily = null;

    for (let link = 0; link < linksWanted && placed < cloudCount; link += 1) {
      const family = chainFamily ?? cloudPlan[placed];
      const level = family.level[0] + random() * (family.level[1] - family.level[0]);
      // Clouds taper toward the ends of a chain, so it fades out rather than
      // stopping. A hard-ended ribbon is as obvious as an isolated blob.
      const taper = Math.sin(((link + 0.5) / linksWanted) * Math.PI);
      const span = chainSpan * (0.55 + taper * 0.75);

      const variants = cloudTextures.get(family.id);
      const material = track(new THREE.SpriteMaterial({
        map: variants[Math.floor(random() * variants.length)],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        rotation: random() * Math.PI * 2,
        toneMapped: true,
        color: new THREE.Color(
          0.88 + random() * 0.24,
          0.88 + random() * 0.24,
          0.88 + random() * 0.24,
        ),
      }));
      const sprite = new THREE.Sprite(material);
      sprite.name = `${family.label} cloud`;
      sprite.position.copy(direction).multiplyScalar(radius);
      const aspect = 0.62 + random() * 0.8;
      sprite.scale.set(radius * span * DEG, radius * span * DEG * aspect, 1);
      // Behind everything in deepSky.js, so the stars sit in front of the dust
      // rather than the dust washing over them.
      sprite.renderOrder = -59;
      sprite.userData.level = level * (0.55 + taper * 0.7);
      sprite.userData.family = family.id;
      cloudSprites.push(sprite);
      group.add(sprite);
      placed += 1;

      /*
       * Walk on, by well under one cloud width so the next one overlaps this
       * one heavily, and turn a little. The turn is what stops a chain being a
       * straight line, which nothing in the interstellar medium is.
       */
      const advance = THREE.MathUtils.degToRad(span * (0.34 + random() * 0.22));
      const turn = (random() - 0.5) * 1.1;
      chainStep.addScaledVector(chainSide, turn * 0.5).normalize();
      direction.addScaledVector(chainStep, advance).normalize();
      // Keep the walking direction perpendicular to where we now are, or the
      // chain slows to a halt as the step vector drifts out of the tangent
      // plane and its component along the surface shrinks toward nothing.
      chainStep.addScaledVector(direction, -chainStep.dot(direction)).normalize();
      chainSide.crossVectors(direction, chainStep).normalize();
    }
  }

  /* ---- the transients ---- */

  const flareTexture = track(makeFlareTexture());
  const positions = new Float32Array(slots * 3);
  const colours = new Float32Array(slots * 3);
  const sizes = new Float32Array(slots);
  const geometry = track(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColour", new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  const positionAttribute = geometry.getAttribute("position");
  const colourAttribute = geometry.getAttribute("aColour");
  const sizeAttribute = geometry.getAttribute("aSize");

  const flareMaterial = track(new THREE.ShaderMaterial({
    vertexShader: TRANSIENT_VERTEX,
    fragmentShader: TRANSIENT_FRAGMENT,
    uniforms: {
      uMap: { value: flareTexture },
      uOpacity: { value: 0 },
      uPixel: { value: pixelRatio },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  }));
  const flares = new THREE.Points(geometry, flareMaterial);
  flares.name = "Transient sources";
  flares.frustumCulled = false;
  flares.renderOrder = -53;
  group.add(flares);

  /*
   * Slots, not spawns. Every transient that can ever exist is allocated here
   * once; igniting one rewrites three floats in a buffer that is already on
   * the GPU. There is no allocation, no object churn and no geometry rebuild
   * anywhere in the update path, which is what lets this run for an hour.
   */
  const active = new Array(slots).fill(null).map(() => ({
    family: null,
    days: 0,
    lifetimeDays: 0,
    scale: 1,
    live: false,
  }));

  let nextIgnition = 1.2 + random() * 2.5;
  let elapsed = 0;
  let liveCount = 0;
  /*
   * How brightly the dust is lit, over and above its resting level.
   *
   * Driven from outside, by the supernova events. A star going off inside a
   * nebula does not just add a bright point -- it *illuminates the cloud it is
   * in*, which is why light echoes are a thing and why every supernova remnant
   * photograph is mostly lit gas rather than mostly star. So when one of those
   * events runs, it pushes this up and the whole dust field comes on with it.
   */
  let highlight = 0;

  const ignite = (index) => {
    const slot = active[index];
    const family = pickWeighted(TRANSIENT_FAMILIES, random);
    skyDirection(frame, family.planeBias, random, direction);
    const i3 = index * 3;
    positions[i3] = direction.x * radius;
    positions[i3 + 1] = direction.y * radius;
    positions[i3 + 2] = direction.z * radius;
    slot.family = family;
    slot.days = 0;
    /*
     * Distance modulus, in effect. These are at wildly different distances and
     * the whole point the viewer made is that they should read as *very far
     * away* -- little bursts, not fireworks. So each gets a random dimming
     * factor with a long faint tail, and only occasionally is one bright.
     */
    slot.scale = 0.55 + Math.pow(random(), 1.8) * 1.15;
    slot.lifetimeDays = family.riseDays + family.plateauDays + family.fallDays + family.tailDays;
    slot.live = true;
    liveCount += 1;
    positionAttribute.needsUpdate = true;
    return slot;
  };

  const tint = new THREE.Color();
  const lateTint = new THREE.Color();

  return {
    object: group,

    /** Scene seconds to days, exposed so the UI can quote real timescales. */
    daysPerSecond: DAYS_PER_SECOND,

    /**
     * Lights the dust up, 0 to 1. Used by the supernova events so the sky
     * around the explosion brightens rather than the explosion sitting on top
     * of an unchanged background.
     */
    setHighlight(value) {
      highlight = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    },

    /** A direction on the shell, for staging something against the sky. */
    shellRadius: radius,

    /** What is burning right now, for diagnostics and for the dashboard. */
    list() {
      return active
        .filter((slot) => slot.live)
        .map((slot) => ({
          id: slot.family.id,
          label: slot.family.label,
          days: Math.round(slot.days),
          level: Number(lightCurve(slot.family, slot.days).toFixed(3)),
        }));
    },

    /** Forces one now, so the dashboard's "show me" button has something to do. */
    trigger(familyId = null) {
      const index = active.findIndex((slot) => !slot.live);
      if (index < 0) return null;
      if (!familyId) return ignite(index);
      const family = TRANSIENT_FAMILIES.find((item) => item.id === familyId);
      if (!family) return ignite(index);
      const slot = ignite(index);
      slot.family = family;
      slot.scale = 0.75 + random() * 0.4;
      slot.lifetimeDays = family.riseDays + family.plateauDays + family.fallDays + family.tailDays;
      return slot;
    },

    update({ deltaTime = 0, journeyProgress = 0, contrast = 1, camera = null, reducedMotion = false }) {
      const reach = THREE.MathUtils.clamp(journeyProgress, 0, 1);
      // Same visibility ramp as the rest of the sky: washed out near the Sun,
      // full strength once the journey is out past the giants.
      const level = (0.42 + 0.58 * Math.pow(reach, 0.7)) * contrast;

      const lit = level * (1 + highlight * 1.9);
      for (let i = 0; i < cloudSprites.length; i += 1) {
        cloudSprites[i].material.opacity = Math.min(
          0.95,
          lit * cloudSprites[i].userData.level,
        );
      }

      const step = reducedMotion ? deltaTime * 0.35 : deltaTime;
      elapsed += step;

      if (liveCount < slots) {
        nextIgnition -= step;
        if (nextIgnition <= 0) {
          const index = active.findIndex((slot) => !slot.live);
          if (index >= 0) ignite(index);
          /*
           * Interval, not schedule. Novae are a Poisson process and a fixed
           * cadence would read as a metronome, so the wait is drawn fresh each
           * time from a wide range.
           *
           * The rate is set by the population it produces rather than picked.
           * In equilibrium the number burning at once is the ignition rate
           * times the mean visible lifetime, and those lifetimes are very
           * uneven: a nova is gone in under four seconds while a Type II-P
           * runs for forty, so the weighted mean is about sixteen. The first
           * pass waited five to eighteen seconds between ignitions and
           * measured a peak of *two* live transients with long empty
           * stretches -- a sky that is technically alive and reads as static.
           * One every two to seven seconds gives three to five at a time,
           * which is enough that something is always happening somewhere
           * without the sky turning into fireworks.
           */
          nextIgnition = 2 + random() * 5;
        }
      }

      let dirty = false;
      for (let i = 0; i < slots; i += 1) {
        const slot = active[i];
        if (!slot.live) continue;
        slot.days += step * DAYS_PER_SECOND;
        const shape = lightCurve(slot.family, slot.days);
        /*
         * The retirement test only applies *after* the peak, and leaving that
         * out is a bug that kills the whole layer silently.
         *
         * A light curve is faint at both ends. On its first frame a Type II-P
         * is 0.19 days old against a ten-day rise, so its brightness is about
         * 0.001 -- under any threshold meant to catch the far end of the tail.
         * The unguarded test therefore extinguished every transient on the
         * frame it was born, and the symptom was not an error but an empty
         * sky: measured over six seconds and 349 update calls, zero live
         * transients, with ignition working correctly every time.
         */
        const pastPeak = slot.days > slot.family.riseDays;
        if ((pastPeak && shape <= 0.004) || slot.days > slot.lifetimeDays) {
          slot.live = false;
          liveCount -= 1;
          sizes[i] = 0;
          colours[i * 3] = 0;
          colours[i * 3 + 1] = 0;
          colours[i * 3 + 2] = 0;
          dirty = true;
          continue;
        }
        const brightness = shape * slot.family.peak * slot.scale;
        /*
         * Reddening with age, which is real: the ejecta cool as they expand,
         * so a supernova that peaks blue-white ends up distinctly red months
         * later. The mix follows how far down the curve it is rather than the
         * clock, so a plateau holds its colour and the tail is where the shift
         * happens.
         */
        const age = 1 - THREE.MathUtils.clamp(shape, 0, 1);
        tint.setRGB(slot.family.colour[0], slot.family.colour[1], slot.family.colour[2]);
        lateTint.setRGB(slot.family.lateColour[0], slot.family.lateColour[1], slot.family.lateColour[2]);
        tint.lerp(lateTint, Math.pow(age, 1.4));
        const i3 = i * 3;
        colours[i3] = tint.r * brightness;
        colours[i3 + 1] = tint.g * brightness;
        colours[i3 + 2] = tint.b * brightness;
        /*
         * Size grows with brightness as well as colour doing the work, because
         * that is what a real point source does on a real sensor: it is not
         * physically bigger, its skirt simply clears the noise floor further
         * out. Capped low so these stay *distant bursts*.
         */
        sizes[i] = 4.0 + Math.pow(brightness, 0.5) * 30.0;
        dirty = true;
      }

      if (dirty) {
        colourAttribute.needsUpdate = true;
        sizeAttribute.needsUpdate = true;
      }
      flareMaterial.uniforms.uOpacity.value = level;

      if (camera) group.position.copy(camera.position);
    },

    resize(nextPixelRatio) {
      flareMaterial.uniforms.uPixel.value = Math.max(0.5, Number(nextPixelRatio) || 1);
    },

    dispose() {
      group.removeFromParent();
      disposables.forEach((item) => item.dispose?.());
      disposables.length = 0;
    },
  };
}

export { TRANSIENT_FAMILIES, CLOUD_FAMILIES };

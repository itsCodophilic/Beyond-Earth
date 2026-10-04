/**
 * Surfaces for the Rank 4 batch B binaries, generated on the sphere.
 *
 * Used by `binary-surface-lab.html` (in a worker, live, with sliders) and,
 * once a design is chosen there, by the build that writes the scene's maps --
 * so what is approved in the lab is byte-for-byte what ships. No DOM, no
 * Three.js: typed arrays in, typed arrays out.
 *
 * ## What the second and third passes got wrong
 *
 * They were drawings of terrain rather than terrain: crater rims as thin
 * bright outlines, boulders as stained glass, contrast turned up until every
 * feature read as a line. Put beside a real map -- Callisto's or Mimas's from
 * Voyager, Cassini and Galileo, or the spacecraft-derived Bennu, Ryugu and
 * Mathilde maps already in this project -- the difference is plain:
 *
 *  1. A real surface is *low contrast in albedo*. Mathilde (albedo 0.047) is
 *     "uniform in brightness and colour", craters included; Arrokoth's
 *     brightest and darkest patches differ by about a factor of two. The
 *     craters are seen because of *light and shadow*, not because they are
 *     painted a different colour.
 *  2. So the relief belongs in a normal map that the scene's Sun lights --
 *     rims catch the light on the sunward side and floors fall into shadow,
 *     and the whole picture moves as the body turns. The albedo map carries
 *     only what really differs in brightness: fresh ejecta, ice exposures,
 *     boulders, frost.
 *  3. Craters follow measured morphology rather than a stamp: simple bowls
 *     about a fifth as deep as they are wide, a raised rim about 4 % of the
 *     diameter, an ejecta blanket falling off as the inverse cube of distance
 *     out to about three radii; flat floors and central peaks once they are
 *     large; a power-law size distribution; and every stage of degradation
 *     from fresh and sharp to a soft dimple, overlapping.
 *
 * ## The terrains, and what each is modelled on
 *
 *  saturated   Callisto: craters to saturation, dark old ground, bright
 *              haloes round the young ones.
 *  rubble      Bennu and Ryugu: a boulder-strewn rubble pile, few craters,
 *              high-frequency brightness from boulders of every size.
 *  mounds      Arrokoth: smooth, lightly cratered, built of rounded mounds a
 *              few kilometres across, with bright patches and a bright collar
 *              at the neck of a two-lobed body (New Horizons, 2019).
 *  giants      Mathilde: a handful of craters nearly as wide as the body,
 *              with angular, spalled rims, on very uniform ground.
 *  grooved     Lutetia and Phobos: families of parallel grooves and pit
 *              chains, regolith-softened craters, brighter landslides.
 *  snowball    a dirty snowball: dark red regolith, small fresh craters that
 *              expose paler ice, long fractures.
 *
 * Added for Ranks 7-10 (comets, interstellar objects, Trojans, near-Earth
 * oddities), with the features those surfaces need:
 *
 *  pits        flat-floored, steep-walled depressions: Wild 2's (0.25-2.5 km
 *              across, 50-500 m deep, Kirk et al. 2005) and Tempel 1's pitted
 *              terrain (pits to ~1 km, Thomas et al. 2013).
 *  smooth      smooth flow deposits lying in the lows, bounded by scarps and
 *              burying what was under them: Tempel 1 (a third of its
 *              surface), Hartley 2's waist, Borrelly's central plains.
 *  spots       Borrelly's dark spots, two to three times darker than the
 *              ground around them (Soderblom et al. 2002).
 *
 * Every number with a source is noted where it is used. Everything else is a
 * judgement made in the lab, by eye, against those references.
 */

/* ---------------------------------------------------------------- random */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(i, j, k, seed) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647) + Math.imul(seed, 144665)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/* ---------------------------------------------------------------- noise */

const GRAD = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

/** Improved Perlin noise with a seeded permutation, about -1..1. */
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (g, x, y, z) => g[0] * x + g[1] * y + g[2] * z;
  return function noise(x, y, z) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255;
    const yi = Y & 255;
    const zi = Z & 255;
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = perm[xi] + yi;
    const AA = perm[A] + zi;
    const AB = perm[A + 1] + zi;
    const B = perm[xi + 1] + yi;
    const BA = perm[B] + zi;
    const BB = perm[B + 1] + zi;
    const g = (h) => GRAD[h % 12];
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
      lerp(
        lerp(dot(g(perm[AA]), x, y, z), dot(g(perm[BA]), x - 1, y, z), u),
        lerp(dot(g(perm[AB]), x, y - 1, z), dot(g(perm[BB]), x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(dot(g(perm[AA + 1]), x, y, z - 1), dot(g(perm[BA + 1]), x - 1, y, z - 1), u),
        lerp(dot(g(perm[AB + 1]), x, y - 1, z - 1), dot(g(perm[BB + 1]), x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  };
}

function fbm(noise, x, y, z, octaves, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * noise(x * f + o * 17.3, y * f - o * 9.1, z * f + o * 4.7);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/* Worley (cellular) noise in 3D: nearest and second-nearest feature
 * distances, and the nearest cell's id as a 0..1 hash. */
const _cell = { f1: 0, f2: 0, id: 0 };
function worley(x, y, z, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let i = -1; i <= 1; i += 1) {
    for (let j = -1; j <= 1; j += 1) {
      for (let k = -1; k <= 1; k += 1) {
        const cx = xi + i;
        const cy = yi + j;
        const cz = zi + k;
        const px = cx + hash3(cx, cy, cz, seed);
        const py = cy + hash3(cx, cy, cz, seed + 1);
        const pz = cz + hash3(cx, cy, cz, seed + 2);
        const dx = px - x;
        const dy = py - y;
        const dz = pz - z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = hash3(cx, cy, cz, seed + 3);
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
  }
  _cell.f1 = f1;
  _cell.f2 = f2;
  _cell.id = id;
  return _cell;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------------------------------------------------------------- colour */

export function hexToRgb(hex) {
  const v = parseInt(String(hex).replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/* ---------------------------------------------------------------- the grid */

/*
 * The scene's UV layout, from THREE.SphereGeometry, which every small body is
 * built on: column u runs from direction (-1, 0, 0) through (0, 0, 1), row 0
 * is the north pole (+y). Texture row 0 at the top, as a loaded image is.
 */
function grid(width, height) {
  const count = width * height;
  const dir = new Float32Array(count * 3);
  const lat = new Float32Array(height);
  for (let r = 0; r < height; r += 1) {
    const phi = Math.PI / 2 - ((r + 0.5) / height) * Math.PI;
    lat[r] = phi;
    const cl = Math.cos(phi);
    const sl = Math.sin(phi);
    for (let c = 0; c < width; c += 1) {
      const u = (c + 0.5) / width;
      const i = (r * width + c) * 3;
      dir[i] = -Math.cos(2 * Math.PI * u) * cl;
      dir[i + 1] = sl;
      dir[i + 2] = Math.sin(2 * Math.PI * u) * cl;
    }
  }
  return { dir, lat, count };
}

function randomDir(rand) {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(a), z, s * Math.sin(a)];
}

/* Rows and columns within `reach` radians of a direction: craters and
 * mounds touch only their own neighbourhood of the map. */
function windowFor(c, reach, width, height) {
  const phi = Math.asin(Math.max(-1, Math.min(1, c[1])));
  const lon = Math.atan2(c[2], -c[0]); // matches u: u = lon / 2pi (wrapped)
  const r0 = Math.max(0, Math.floor(((Math.PI / 2 - (phi + reach)) / Math.PI) * height) - 1);
  const r1 = Math.min(height - 1, Math.ceil(((Math.PI / 2 - (phi - reach)) / Math.PI) * height) + 1);
  const maxLat = Math.min(Math.PI / 2, Math.abs(phi) + reach);
  if (maxLat > 1.45) return { r0, r1, c0: 0, span: width, full: true };
  const dLon = reach / Math.cos(maxLat);
  const uc = ((lon / (2 * Math.PI)) % 1 + 1) % 1;
  const span = Math.min(width, Math.ceil((dLon / Math.PI) * width) + 3);
  const c0 = Math.floor(uc * width - span / 2);
  return { r0, r1, c0, span, full: span >= width };
}

/* ---------------------------------------------------------------- terrain parts */

function sizes(rand, count, rmin, rmax, slope) {
  // Cumulative power law N(>R) ~ R^-slope between rmin and rmax.
  const out = [];
  const k = 1 - (rmin / rmax) ** slope;
  for (let i = 0; i < count; i += 1) out.push(rmin * (1 - rand() * k) ** (-1 / slope));
  return out;
}

function stampCraters(ctx, list) {
  const { width, height, dir, H, bright, ice, floor, noise } = ctx;
  for (const cr of list) {
    const { c, R, g, fresh, spall, rays } = cr;
    const reach = R * 3;
    const win = windowFor(c, reach, width, height);
    const cosReach = Math.cos(reach);
    // depth/diameter 0.2 for simple craters; giant ones on small bodies are
    // shallower bowls (Mathilde's Karoo and Ishikari, about 0.15).
    const depth = (spall ? 0.3 : 0.4) * R * g;
    const rimH = 0.08 * R * g ** 1.3; // rim about 4 % of the diameter
    const rimW = (spall ? 0.4 : 0.2) + 0.28 * (1 - g);
    // Flat floors and central peaks need gravity to slump a crater: on a
    // body this small only the moderately large ones get them, and a spalled
    // giant stays a bowl.
    const complex = R > 0.14 && !spall;
    const peak = R > 0.2 && !spall;
    // A local frame for ray azimuths.
    const t1 = [c[2], 0, -c[0]];
    const tl = Math.hypot(t1[0], t1[2]) || 1;
    t1[0] /= tl; t1[2] /= tl;
    const t2 = [c[1] * t1[2] - c[2] * t1[1], c[2] * t1[0] - c[0] * t1[2], c[0] * t1[1] - c[1] * t1[0]];
    const spokes = rays ? cr.spokes : null;
    for (let r = win.r0; r <= win.r1; r += 1) {
      for (let s = 0; s < win.span; s += 1) {
        const col = ((win.c0 + s) % width + width) % width;
        const p = r * width + col;
        const i = p * 3;
        const dx = dir[i];
        const dy = dir[i + 1];
        const dz = dir[i + 2];
        const cosd = dx * c[0] + dy * c[1] + dz * c[2];
        if (cosd < cosReach) continue;
        let t = Math.acos(Math.min(1, cosd)) / R;
        // Angular, spalled outlines: the rim line wanders, the bowl does not.
        const tRim = spall ? t * (1 + spall * noise(dx * 4 + c[0] * 50, dy * 4, dz * 4)) : t;
        let h = 0;
        if (t < 1) {
          // A giant is a broad cosine bowl: a parabola that wide puts all of
          // its slope in a cliff at the edge, which read as a cut-out disc.
          h = spall ? -depth * 0.5 * (1 + Math.cos(Math.PI * t)) : depth * (t * t - 1);
          if (complex) h = Math.max(h, -depth * 0.72);
          if (peak) h += depth * 0.3 * Math.exp(-((t / 0.14) ** 2));
        }
        h += rimH * Math.exp(-(((tRim - 1) / rimW) ** 2));
        if (t > 1) h += rimH * 0.55 * Math.min(1, (1 / t) ** 3) * smoothstep(3, 2.2, t);
        H[p] += h;
        if (t < 0.7) floor[p] = Math.max(floor[p], (1 - t / 0.7) * Math.min(1, R / 0.05));
        if (fresh) {
          // Fresh ejecta is brighter and, on a tholin-red body, less red:
          // it is material from below the irradiated skin.
          const halo = t < 1 ? 0.55 : Math.exp(-(t - 1) * 1.4) * smoothstep(3, 2, t);
          let ray = 0;
          if (spokes && t > 1) {
            const qx = dx - c[0] * cosd;
            const qy = dy - c[1] * cosd;
            const qz = dz - c[2] * cosd;
            const az = Math.atan2(qx * t2[0] + qy * t2[1] + qz * t2[2], qx * t1[0] + qy * t1[1] + qz * t1[2]);
            for (let k = 0; k < spokes.length; k += 1) {
              let da = az - spokes[k][0];
              da = Math.atan2(Math.sin(da), Math.cos(da));
              ray = Math.max(ray, Math.exp(-((da / spokes[k][1]) ** 2)) * Math.max(0, 1 - (t - 1) / (rays * 2.5)));
            }
          }
          bright[p] = Math.max(bright[p], (halo * 0.8 + ray * 0.6) * fresh);
          ice[p] = Math.max(ice[p], (halo * 0.7 + ray * 0.5) * fresh);
        }
      }
    }
  }
}

function craterList(rand, P, extraSeed) {
  const list = [];
  if (!P || !P.count) return list;
  const radii = sizes(rand, Math.round(P.count), P.rmin, P.rmax, P.slope ?? 2);
  radii.forEach((R) => {
    const g = P.wearMin + (1 - P.wearMin) * rand() ** (P.wearBias ?? 1);
    const isFresh = rand() < (P.fresh ?? 0) && g > 0.7;
    const cr = {
      c: randomDir(rand), R, g,
      fresh: isFresh ? 0.6 + 0.4 * rand() : 0,
      spall: P.spall ?? 0,
      rays: isFresh && rand() < (P.rays ?? 0) ? 1 : 0,
    };
    if (cr.rays) {
      const n = 6 + Math.floor(rand() * 7);
      cr.spokes = Array.from({ length: n }, () => [rand() * Math.PI * 2 - Math.PI, 0.03 + rand() * 0.07]);
    }
    list.push(cr);
  });
  // Old first, fresh last: a young crater's halo lies over older ground.
  list.sort((a, b) => a.g - b.g);
  void extraSeed;
  return list;
}

/* ---------------------------------------------------------------- generate */

export const DEFAULT_RECIPE = Object.freeze({
  broad: 0.18, broadFreq: 2.2, fine: 0.07, grain: 0.05,
  redVar: 0.18, bake: 0.3, normal: 1.0,
  craters: null, giants: null,
  rubble: null, mounds: null, patches: null,
  grooves: null, fractures: null,
  frost: 0, flecks: 0, collar: 0,
  pits: null, smooth: null, spots: null,
});

/**
 * @param {object} spec
 * @param {number} spec.width, spec.height
 * @param {number} spec.seed
 * @param {{dark:string, mid:string, light:string, ice?:string}} spec.palette  sRGB hex
 * @param {object} spec.recipe   see DEFAULT_RECIPE and the terrains above
 * @param {object} [spec.tweaks] multipliers from the lab's sliders
 * @returns {{albedo:Uint8ClampedArray, normal:Uint8ClampedArray, meanLinear:number}}
 */
export function generateSurface(spec) {
  const width = spec.width;
  const height = spec.height;
  const R0 = { ...DEFAULT_RECIPE, ...spec.recipe };
  const T = {
    craters: 1, craterSize: 1, fresh: 1, boulders: 1, contrast: 1,
    redness: 1, relief: 1, hue: 0, bright: 1, ...(spec.tweaks ?? {}),
  };
  const seed = spec.seed | 0;
  const rand = mulberry32(seed * 7919 + 13);
  const noise = makeNoise(seed);
  const noise2 = makeNoise(seed + 101);
  const { dir, lat, count } = grid(width, height);

  const H = new Float32Array(count);
  const tone = new Float32Array(count);
  const bright = new Float32Array(count);
  const ice = new Float32Array(count);
  const floor = new Float32Array(count);
  const ctx = { width, height, dir, H, bright, ice, floor, noise };

  // Ground: broad brightness mottling and fine grain, low contrast.
  for (let p = 0; p < count; p += 1) {
    const i = p * 3;
    const x = dir[i]; const y = dir[i + 1]; const z = dir[i + 2];
    const b = fbm(noise, x * R0.broadFreq, y * R0.broadFreq, z * R0.broadFreq, 5);
    const f = fbm(noise2, x * 18, y * 18, z * 18, 3);
    const gr = noise2(x * 90, y * 90, z * 90);
    tone[p] = b * R0.broad * T.contrast + f * R0.fine * T.contrast + gr * R0.grain;
    H[p] = fbm(noise, x * 3.2 + 5, y * 3.2, z * 3.2, 4) * 0.006 + f * 0.0025;
  }

  // Mounds (Arrokoth's larger lobe is built of them).
  if (R0.mounds) {
    const M = R0.mounds;
    for (let m = 0; m < M.count; m += 1) {
      const c = randomDir(rand);
      const R = M.rmin + (M.rmax - M.rmin) * rand();
      const shade = (rand() - 0.5) * (M.toneVar ?? 0.1);
      const win = windowFor(c, R * 1.2, width, height);
      for (let r = win.r0; r <= win.r1; r += 1) {
        for (let s = 0; s < win.span; s += 1) {
          const col = ((win.c0 + s) % width + width) % width;
          const p = r * width + col;
          const i = p * 3;
          const cosd = dir[i] * c[0] + dir[i + 1] * c[1] + dir[i + 2] * c[2];
          const t = Math.acos(Math.min(1, cosd)) / R;
          if (t >= 1.2) continue;
          const bump = t < 1 ? (1 - t * t) ** 2 : 0;
          H[p] += M.amp * R * bump;
          tone[p] += shade * bump - (M.edgeDark ?? 0) * Math.exp(-(((t - 1) / 0.07) ** 2));
        }
      }
    }
  }

  // Boulders, several sizes (Bennu, Ryugu).
  if (R0.rubble) {
    for (const level of R0.rubble.levels) {
      const f = level.freq * Math.sqrt(T.boulders);
      const s0 = seed * 31 + Math.round(level.freq);
      for (let p = 0; p < count; p += 1) {
        const i = p * 3;
        const cell = worley(dir[i] * f, dir[i + 1] * f, dir[i + 2] * f, s0);
        const size = 0.22 + 0.6 * cell.id ** 1.6;
        const keep = cell.id < (level.cover ?? 0.8);
        if (!keep) continue;
        const d = cell.f1 / size;
        const dome = d < 1 ? Math.sqrt(1 - d * d) : 0;
        H[p] += (level.amp / f) * dome * size;
        tone[p] += dome * (cell.id - 0.5) * (level.toneVar ?? 0.2) - (d >= 1 ? (level.gapDark ?? 0.05) : 0);
      }
    }
  }

  // Craters: the long list, then any giants.
  const cp = R0.craters && {
    ...R0.craters,
    count: R0.craters.count * T.craters,
    rmin: R0.craters.rmin * T.craterSize,
    rmax: R0.craters.rmax * T.craterSize,
    fresh: (R0.craters.fresh ?? 0) * T.fresh,
  };
  stampCraters(ctx, craterList(rand, cp));
  if (R0.giants) stampCraters(ctx, craterList(rand, { ...R0.giants, rmin: R0.giants.rmin * T.craterSize, rmax: R0.giants.rmax * T.craterSize }));

  // Pits: flat floors, steep walls, almost no rim (Wild 2, Tempel 1).
  if (R0.pits) {
    const P = R0.pits;
    const radii = sizes(rand, Math.round(P.count * T.craters), P.rmin * T.craterSize, P.rmax * T.craterSize, P.slope ?? 1.6);
    for (const R of radii) {
      const c = randomDir(rand);
      const depth = (P.depth ?? 0.3) * R * (0.6 + 0.4 * rand());
      const wall = P.wall ?? 0.22;
      const win = windowFor(c, R * 1.3, width, height);
      for (let r = win.r0; r <= win.r1; r += 1) {
        for (let s2 = 0; s2 < win.span; s2 += 1) {
          const col = ((win.c0 + s2) % width + width) % width;
          const p = r * width + col;
          const i = p * 3;
          const cosd = dir[i] * c[0] + dir[i + 1] * c[1] + dir[i + 2] * c[2];
          // A ragged outline: pits grow by collapse, not by impact.
          const t = (Math.acos(Math.min(1, cosd)) / R) * (1 + 0.18 * noise2(dir[i] * 9 + c[0] * 40, dir[i + 1] * 9, dir[i + 2] * 9));
          if (t >= 1.3) continue;
          const inside = 1 - smoothstep(1 - wall, 1, t);
          H[p] -= depth * inside;
          H[p] += depth * 0.06 * Math.exp(-(((t - 1.02) / 0.1) ** 2));
          tone[p] -= (P.dark ?? 0.02) * inside;
          if (inside > 0.5) floor[p] = Math.max(floor[p], inside);
        }
      }
    }
  }

  // Dark spots (Borrelly).
  if (R0.spots) {
    const S = R0.spots;
    for (let k = 0; k < S.count; k += 1) {
      const c = randomDir(rand);
      const R = S.rmin + (S.rmax - S.rmin) * rand();
      const win = windowFor(c, R * 1.6, width, height);
      for (let r = win.r0; r <= win.r1; r += 1) {
        for (let s2 = 0; s2 < win.span; s2 += 1) {
          const col = ((win.c0 + s2) % width + width) % width;
          const p = r * width + col;
          const i = p * 3;
          const cosd = dir[i] * c[0] + dir[i + 1] * c[1] + dir[i + 2] * c[2];
          const t = Math.acos(Math.min(1, cosd)) / R;
          if (t >= 1.6) continue;
          tone[p] -= S.dark * (1 - smoothstep(0.6, 1.4, t));
        }
      }
    }
  }

  // Grooves (Lutetia's lineaments, Phobos's pit chains).
  if (R0.grooves) {
    const G = R0.grooves;
    for (let fam = 0; fam < G.families; fam += 1) {
      const axis = randomDir(rand);
      for (let k = 0; k < G.perFamily; k += 1) {
        const cosA = Math.cos(0.5 + rand() * 2.1);
        const az0 = rand() * Math.PI * 2;
        const azSpan = 0.6 + rand() * 1.4;
        const w = G.width * (0.7 + rand() * 0.6);
        const depth = G.depth * (0.6 + rand() * 0.6);
        const t1 = [axis[2], 0, -axis[0]];
        const tl = Math.hypot(t1[0], t1[2]) || 1;
        t1[0] /= tl; t1[2] /= tl;
        const t2 = [axis[1] * t1[2] - axis[2] * t1[1], axis[2] * t1[0] - axis[0] * t1[2], axis[0] * t1[1] - axis[1] * t1[0]];
        for (let p = 0; p < count; p += 1) {
          const i = p * 3;
          const d = dir[i] * axis[0] + dir[i + 1] * axis[1] + dir[i + 2] * axis[2];
          const off = Math.abs(d - cosA);
          if (off > w * 3) continue;
          const az = Math.atan2(dir[i] * t2[0] + dir[i + 1] * t2[1] + dir[i + 2] * t2[2], dir[i] * t1[0] + dir[i + 1] * t1[1] + dir[i + 2] * t1[2]);
          let da = Math.atan2(Math.sin(az - az0), Math.cos(az - az0));
          const along = smoothstep(azSpan / 2, azSpan / 2 - 0.2, Math.abs(da));
          if (along <= 0) continue;
          const pits = G.pits ? (0.45 + 0.55 * Math.cos(da * G.pits) ** 2) : 1;
          const prof = Math.exp(-((off / w) ** 2)) * along * pits;
          H[p] -= depth * prof;
          tone[p] -= (G.dark ?? 0.03) * prof;
        }
      }
    }
  }

  // Fractures: long thin cracks on great circles.
  if (R0.fractures) {
    const F = R0.fractures;
    for (let k = 0; k < F.count; k += 1) {
      let centre = randomDir(rand);
      if (F.aroundNeck) {
        // The plane x = 0 of the mesh: where two lobes meet.
        centre = [0.12 * (rand() - 0.5), rand() * 1.4 - 0.7, rand() < 0.5 ? 1 : -1];
        const l = Math.hypot(...centre);
        centre = centre.map((v) => v / l);
      }
      const n = randomDir(rand);
      const nx = centre[1] * n[2] - centre[2] * n[1];
      const ny = centre[2] * n[0] - centre[0] * n[2];
      const nz = centre[0] * n[1] - centre[1] * n[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      const L = F.length * (0.5 + rand() * 0.5);
      const w = F.width * (0.6 + rand() * 0.8);
      for (let p = 0; p < count; p += 1) {
        const i = p * 3;
        const cosd = dir[i] * centre[0] + dir[i + 1] * centre[1] + dir[i + 2] * centre[2];
        if (cosd < Math.cos(L)) continue;
        const wob = noise2(dir[i] * 14, dir[i + 1] * 14, dir[i + 2] * 14) * w * 1.5;
        const off = Math.abs((dir[i] * nx + dir[i + 1] * ny + dir[i + 2] * nz) / nl + wob);
        if (off > w * 3) continue;
        const along = smoothstep(L, L * 0.7, Math.acos(Math.min(1, cosd)));
        const prof = Math.exp(-((off / w) ** 2)) * along;
        H[p] -= F.depth * prof;
        tone[p] -= (F.dark ?? 0.05) * prof;
      }
    }
  }

  // Smooth deposits: they fill the lows and bury what was there, and end at
  // a scarp. Last of the relief, so they cover craters and pits alike.
  if (R0.smooth) {
    const S = R0.smooth;
    const f = S.freq ?? 1.5;
    for (let p = 0; p < count; p += 1) {
      const i = p * 3;
      const n = fbm(noise2, dir[i] * f + 31, dir[i + 1] * f, dir[i + 2] * f, 4);
      const m = smoothstep(S.threshold ?? 0.15, (S.threshold ?? 0.15) + (S.edge ?? 0.04), n);
      if (m <= 0) continue;
      H[p] = H[p] * (1 - (S.flatten ?? 0.85) * m) - (S.scarp ?? 0.004) * m;
      tone[p] = tone[p] * (1 - 0.6 * m) + (S.bright ?? 0.05) * m;
      bright[p] *= 1 - m;
      ice[p] *= 1 - m;
    }
  }

  // Bright patches (Arrokoth), ice flecks, the collar at a neck.
  for (let p = 0; p < count; p += 1) {
    const i = p * 3;
    const x = dir[i]; const y = dir[i + 1]; const z = dir[i + 2];
    if (R0.patches) {
      const n = fbm(noise2, x * R0.patches.freq, y * R0.patches.freq, z * R0.patches.freq, 4);
      tone[p] += R0.patches.bright * smoothstep(R0.patches.threshold, R0.patches.threshold + 0.18, n);
    }
    if (R0.flecks) {
      const cell = worley(x * 60, y * 60, z * 60, seed + 77);
      if (cell.id < 0.18) {
        const fl = smoothstep(0.32, 0.1, cell.f1) * R0.flecks;
        ice[p] = Math.max(ice[p], fl);
        bright[p] = Math.max(bright[p], fl * 0.6);
      }
    }
    if (R0.collar && spec.lobed) {
      const band = Math.exp(-((x / 0.16) ** 2));
      bright[p] = Math.max(bright[p], band * R0.collar);
    }
  }

  // Relief: scaled, then shading baked lightly into the albedo so the body
  // still reads where the Sun is behind the viewer.
  const relief = T.relief;
  for (let p = 0; p < count; p += 1) H[p] *= relief;
  const cav = cavity(H, width, height);

  // The lowest 6 % of the ground, for frost.
  let lowGround = -Infinity;
  if (R0.frost) {
    const sample = [];
    for (let p = 0; p < count; p += 97) sample.push(H[p]);
    sample.sort((a, b) => a - b);
    lowGround = sample[Math.floor(sample.length * 0.06)];
  }

  // Colour.
  const pal = spec.palette;
  const hueShift = T.hue;
  const dark = hexToRgb(pal.dark).map(toLinear);
  const mid = hexToRgb(pal.mid).map(toLinear);
  const light = hexToRgb(pal.light).map(toLinear);
  const iceC = hexToRgb(pal.ice ?? "#cfc3bd").map(toLinear);
  const frostC = hexToRgb(pal.frost ?? "#e6e3e6").map(toLinear);
  const albedo = new Uint8ClampedArray(count * 4);
  let lumSum = 0;
  for (let p = 0; p < count; p += 1) {
    const i = p * 3;
    const x = dir[i]; const y = dir[i + 1]; const z = dir[i + 2];
    let t = 0.5 + tone[p] + bright[p] * 0.28 + cav[p] * R0.bake;
    t = Math.min(1.25, Math.max(-0.1, t));
    const rgb = [0, 0, 0];
    for (let k = 0; k < 3; k += 1) {
      rgb[k] = t < 0.5
        ? dark[k] + (mid[k] - dark[k]) * Math.max(0, t * 2)
        : mid[k] + (light[k] - mid[k]) * (t * 2 - 1);
    }
    // Redness varies a little across the surface.
    const rv = fbm(noise, x * 1.6 + 11, y * 1.6, z * 1.6, 3) * R0.redVar * 2;
    const sat = Math.max(0, (1 + rv) * T.redness);
    const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    for (let k = 0; k < 3; k += 1) rgb[k] = lum + (rgb[k] - lum) * sat;
    if (hueShift) {
      // Towards orange (+) or towards crimson (-).
      rgb[1] *= 1 + hueShift * 0.35;
      rgb[2] *= 1 - hueShift * 0.2;
    }
    const im = Math.min(1, ice[p]);
    if (im > 0) {
      for (let k = 0; k < 3; k += 1) rgb[k] = rgb[k] * (1 - im * 0.7) + iceC[k] * lum * 2.2 * im * 0.7;
    }
    if (R0.frost && (floor[p] > 0 || H[p] < lowGround)) {
      // In crater floors, and in the lowest ground between mounds: the
      // coldest places, where frost would last.
      const patch = smoothstep(0.05, 0.3, noise2(x * 9, y * 9, z * 9) + 0.1);
      const low = H[p] < lowGround ? smoothstep(lowGround, lowGround - 0.004, H[p]) * 0.7 : 0;
      const fm = Math.min(1, Math.max(floor[p] * 1.4, low)) * R0.frost * patch;
      for (let k = 0; k < 3; k += 1) rgb[k] = rgb[k] * (1 - fm) + frostC[k] * fm * 0.55;
    }
    for (let k = 0; k < 3; k += 1) rgb[k] *= T.bright;
    const o = p * 4;
    albedo[o] = Math.round(toSrgb(Math.min(1, Math.max(0, rgb[0]))) * 255);
    albedo[o + 1] = Math.round(toSrgb(Math.min(1, Math.max(0, rgb[1]))) * 255);
    albedo[o + 2] = Math.round(toSrgb(Math.min(1, Math.max(0, rgb[2]))) * 255);
    albedo[o + 3] = 255;
    const back = [albedo[o], albedo[o + 1], albedo[o + 2]].map((v) => toLinear(v / 255));
    lumSum += 0.2126 * back[0] + 0.7152 * back[1] + 0.0722 * back[2];
    void lat;
  }

  const normal = normalMap(H, width, height, lat, R0.normal);
  return { albedo, normal, meanLinear: lumSum / count };
}

/* Non-directional relief shading, at two scales. Longitude wraps. */
function cavity(H, width, height) {
  const out = new Float32Array(width * height);
  for (const [sigma, weight] of [[1, 0.6], [3, 0.4]]) {
    const b = blur(H, width, height, sigma);
    let sq = 0;
    const lap = new Float32Array(width * height);
    for (let r = 0; r < height; r += 1) {
      const up = Math.max(0, r - 1);
      const dn = Math.min(height - 1, r + 1);
      for (let c = 0; c < width; c += 1) {
        const p = r * width + c;
        const l = b[r * width + ((c - 1 + width) % width)];
        const rr = b[r * width + ((c + 1) % width)];
        const v = l + rr + b[up * width + c] + b[dn * width + c] - 4 * b[p];
        lap[p] = v;
        sq += v * v;
      }
    }
    const sd = Math.sqrt(sq / (width * height)) || 1;
    for (let p = 0; p < out.length; p += 1) out[p] += weight * Math.max(-1, Math.min(1, -lap[p] / (2.5 * sd))) * 0.12;
  }
  return out;
}

function blur(src, width, height, sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 2));
  const kernel = [];
  let sum = 0;
  for (let k = -radius; k <= radius; k += 1) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel.push(w);
    sum += w;
  }
  for (let k = 0; k < kernel.length; k += 1) kernel[k] /= sum;
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      let v = 0;
      for (let k = -radius; k <= radius; k += 1) v += src[r * width + ((c + k + width) % width)] * kernel[k + radius];
      tmp[r * width + c] = v;
    }
  }
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      let v = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const rr = Math.min(height - 1, Math.max(0, r + k));
        v += tmp[rr * width + c] * kernel[k + radius];
      }
      out[r * width + c] = v;
    }
  }
  return out;
}

/*
 * Tangent-space normals for Three.js: x along +u (the direction the map's
 * columns increase), y along +v (north, since row 0 is the top of a loaded
 * image), z out of the surface. Slopes are in body radii per radian, so a
 * strength of 1 is the relief at its true scale.
 */
function normalMap(H, width, height, lat, strength) {
  const out = new Uint8ClampedArray(width * height * 4);
  const dLon = (2 * Math.PI) / width;
  const dLat = Math.PI / height;
  for (let r = 0; r < height; r += 1) {
    const cl = Math.max(0.08, Math.cos(lat[r]));
    const up = Math.max(0, r - 1);
    const dn = Math.min(height - 1, r + 1);
    for (let c = 0; c < width; c += 1) {
      const p = r * width + c;
      const gx = (H[r * width + ((c + 1) % width)] - H[r * width + ((c - 1 + width) % width)]) / (2 * dLon * cl);
      const gy = (H[up * width + c] - H[dn * width + c]) / ((dn - up) * dLat);
      let nx = -gx * strength;
      let ny = -gy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const o = p * 4;
      out[o] = Math.round((nx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

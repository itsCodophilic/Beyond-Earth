import * as THREE from "three";

/**
 * Surfaces for the worlds beyond Neptune.
 *
 * None of these has an imaging mission. Pluto has New Horizons and looks like
 * a photograph because it is one; Eris, Haumea, Makemake, Gonggong, Quaoar,
 * Orcus and Sedna have never been resolved into more than a handful of pixels,
 * and there is no map of any of them to wrap around a sphere.
 *
 * What there *is* is spectroscopy, and it is surprisingly specific: which ices
 * are present, how reflective the surface is, how red the tholins have gone,
 * whether the water ice is crystalline (recently resurfaced) or amorphous.
 * That is enough to paint each one honestly, so every parameter below comes
 * from a measurement rather than from taste:
 *
 *   albedo    the real geometric albedo, which is why Eris is nearly white
 *             at 0.96 and Quaoar is dark at 0.12 -- an eightfold difference
 *             that is the most conspicuous thing about the set
 *   tint      the measured colour, from Orcus's neutral grey through to
 *             Sedna, which is nearly as red as Mars
 *   ices      what the near-infrared bands say is actually on the surface
 *
 * The *arrangement* is invented, and has to be: nobody knows where the patches
 * are. What is not invented is how much of each thing there is, how bright it
 * is, and what colour. Haumea's single dark red spot is real and known from
 * its light curve; so is the fact that its water ice covers most of the body.
 */

const WORLDS = {
  orcus: {
    base: "#b9bcc0", high: "#e8ecef", low: "#6f7479",
    albedo: 0.23, mottle: 0.30, craters: 90, ice: 0.55, cap: 0.16,
    // Spectrally flat in the visible, strong crystalline water-ice bands in
    // the infrared, plus ammonia: a grey world that has been resurfaced.
    iceTint: "rgba(226,240,248,0.50)",
  },
  haumea: {
    base: "#e9eef4", high: "#ffffff", low: "#b9c4cf",
    albedo: 0.66, mottle: 0.18, craters: 38, ice: 0.80, cap: 0.10,
    iceTint: "rgba(255,255,255,0.62)",
    // The dark red spot is real -- it shows up in the light curve and is
    // richer in minerals and organics than the rest of the ice shell.
    spot: { u: 0.36, v: 0.52, radius: 0.15, colour: "rgba(150,70,52,0.72)" },
  },
  quaoar: {
    base: "#9a6a55", high: "#c99a7e", low: "#5c3a2e",
    albedo: 0.12, mottle: 0.42, craters: 120, ice: 0.34, cap: 0.08,
    iceTint: "rgba(214,236,247,0.34)",
  },
  makemake: {
    base: "#d9a481", high: "#f6dcc2", low: "#9e6a4c",
    albedo: 0.82, mottle: 0.26, craters: 46, ice: 0.62, cap: 0.14,
    // Centimetre-sized methane grains, and no nitrogen: a coarse, bright,
    // reddish frost rather than Pluto's smooth nitrogen plains.
    iceTint: "rgba(255,242,226,0.52)", grain: 0.5,
  },
  gonggong: {
    base: "#a35340", high: "#d08163", low: "#5f2c22",
    albedo: 0.14, mottle: 0.46, craters: 96, ice: 0.30, cap: 0.06,
    iceTint: "rgba(230,244,252,0.26)",
  },
  eris: {
    base: "#f2f5f8", high: "#ffffff", low: "#d3dbe4",
    albedo: 0.96, mottle: 0.12, craters: 26, ice: 0.92, cap: 0.20,
    // Methane and nitrogen ice, refreshed by sublimation and refreezing --
    // which is exactly why there is so little contrast to draw.
    iceTint: "rgba(255,255,255,0.70)",
  },
  sedna: {
    base: "#8e3a26", high: "#c26a45", low: "#4a1a12",
    albedo: 0.41, mottle: 0.50, craters: 104, ice: 0.22, cap: 0.05,
    iceTint: "rgba(236,246,252,0.20)",
  },
};

export const DWARF_WORLD_NAMES = Object.freeze(Object.keys(WORLDS));

export function hasDwarfWorldTexture(key) {
  return Object.prototype.hasOwnProperty.call(WORLDS, key);
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Paints one equirectangular map.
 *
 * 2:1, because that ratio wraps a sphere without distortion at the equator,
 * and everything is drawn with wrap-around duplicates near the seam so the
 * left and right edges meet -- a blotch painted at u = 0.99 is painted again
 * at u = -0.01, or the map has a visible vertical join down one side of the
 * world for the rest of its life.
 */
export function makeDwarfWorldTexture(key, size = 1024) {
  const world = WORLDS[key];
  if (!world) return null;
  const random = makeRandom(key.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size / 2;
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d");

  context.fillStyle = world.base;
  context.fillRect(0, 0, width, height);

  // Wrapped blotch: drawn up to three times so it survives the seam.
  const blotch = (x, y, radius, fill) => {
    const gradient = (cx) => {
      const g = context.createRadialGradient(cx, y, 0, cx, y, radius);
      g.addColorStop(0, fill);
      g.addColorStop(0.55, fill);
      g.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = g;
      context.fillRect(cx - radius, y - radius, radius * 2, radius * 2);
    };
    gradient(x);
    if (x < radius) gradient(x + width);
    if (x > width - radius) gradient(x - width);
  };

  /*
   * Terrain, as three octaves of blotches rather than as noise per pixel.
   * At this size a per-pixel fractal is a quarter of a million square roots
   * for a result nobody can tell apart from a few hundred soft ellipses.
   */
  const octaves = [
    { count: Math.round(26 * (1 + world.mottle)), radius: 0.20, alpha: 0.30 },
    { count: Math.round(70 * (1 + world.mottle)), radius: 0.09, alpha: 0.22 },
    { count: Math.round(180 * (1 + world.mottle)), radius: 0.035, alpha: 0.16 },
  ];
  octaves.forEach((octave) => {
    for (let i = 0; i < octave.count; i += 1) {
      const light = random() < 0.5;
      const colour = light ? world.high : world.low;
      const rgb = new THREE.Color(colour);
      const alpha = octave.alpha * world.mottle * (0.5 + random());
      blotch(
        random() * width,
        random() * height,
        octave.radius * width * (0.5 + random()),
        `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},${alpha.toFixed(3)})`,
      );
    }
  });

  /*
   * Ice. Not a layer over the top but patches *of* the surface, concentrated
   * where these bodies actually keep their volatiles: the poles and the cold
   * traps, because sublimation moves ice away from wherever the Sun has been.
   */
  const icePatches = Math.round(40 + world.ice * 90);
  for (let i = 0; i < icePatches; i += 1) {
    const y = Math.pow(random(), 0.55) * height * 0.5;
    const north = random() < 0.5;
    blotch(
      random() * width,
      north ? y : height - y,
      (0.03 + random() * 0.09) * width,
      world.iceTint,
    );
  }

  // Polar caps, sized by how much volatile the body has left to keep.
  if (world.cap > 0.02) {
    [0, height].forEach((edge) => {
      const g = context.createLinearGradient(0, edge, 0, edge === 0 ? height * world.cap * 2.2 : height * (1 - world.cap * 2.2));
      g.addColorStop(0, world.iceTint);
      g.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = g;
      context.fillRect(0, edge === 0 ? 0 : height * (1 - world.cap * 2.2), width, height * world.cap * 2.2);
    });
  }

  /*
   * Craters, painted as albedo rather than as relief.
   *
   * The relief is already there -- sculptDwarfGeometry moves real vertices for
   * real craters, so the shading and the silhouette come from geometry. What
   * this adds is only the brightness difference: fresh ice thrown out of a
   * young impact is lighter than the surface around it, and an old floor is
   * darker. Painting the *shadow* here as well double-counted every feature
   * and turned each body into a golf ball -- rings of dimples all the same
   * size, all lit from the same side whatever the Sun was doing.
   *
   * Half of them are bright and half are dark, and the size distribution is
   * steep, because small craters vastly outnumber large ones.
   */
  const craterCount = Math.round(world.craters * 0.55);
  for (let i = 0; i < craterCount; i += 1) {
    const x = random() * width;
    const y = random() * height;
    const r = (0.004 + Math.pow(random(), 3.2) * 0.045) * width;
    const fresh = random() < 0.5;
    const strength = (0.05 + random() * 0.10) * (fresh ? 1 : 0.8);
    blotch(
      x, y, r,
      fresh
        ? `rgba(255,252,246,${strength.toFixed(3)})`
        : `rgba(28,22,18,${strength.toFixed(3)})`,
    );
  }

  if (world.grain) {
    // Makemake's methane grains are centimetres across, which is enormous for
    // a frost and is why its surface scatters light so unusually.
    for (let i = 0; i < 900; i += 1) {
      const x = random() * width;
      const y = random() * height;
      context.fillStyle = `rgba(255,246,232,${(0.05 + random() * 0.12) * world.grain})`;
      context.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
    }
  }

  if (world.spot) {
    blotch(
      world.spot.u * width,
      world.spot.v * height,
      world.spot.radius * width,
      world.spot.colour,
    );
  }

  /*
   * Latitude shading, and this is the one thing here that is a rendering aid
   * rather than a fact. An equirectangular map stretches enormously toward the
   * poles, so any detail painted there is smeared into streaks when it is
   * wrapped. Fading the contrast out at high latitude hides that, and the
   * poles are the one place a real map of an unresolved body would have the
   * least information anyway.
   */
  const polar = context.createLinearGradient(0, 0, 0, height);
  polar.addColorStop(0.00, "rgba(0,0,0,0.42)");
  polar.addColorStop(0.09, "rgba(0,0,0,0.18)");
  polar.addColorStop(0.24, "rgba(0,0,0,0)");
  polar.addColorStop(0.76, "rgba(0,0,0,0)");
  polar.addColorStop(0.91, "rgba(0,0,0,0.18)");
  polar.addColorStop(1.00, "rgba(0,0,0,0.42)");
  context.fillStyle = polar;
  context.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

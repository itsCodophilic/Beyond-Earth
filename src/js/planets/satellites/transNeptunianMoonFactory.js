import * as THREE from "three";

/**
 * Surfaces for the moons of the worlds beyond Neptune.
 *
 * None of these has been photographed. What is known is each one's size, how
 * much light it reflects, and roughly what colour that light is -- so those
 * three numbers drive everything here, and the arrangement is sculpted rather
 * than painted: real vertices move, so the silhouette is irregular and the
 * terrain shades itself instead of carrying a baked shadow that would point the
 * wrong way as the body orbits.
 *
 * `TRANS_NEPTUNIAN_SURFACE_ASSETS` is the slot for real maps. Where a moon has
 * an entry it is used instead of the painted vertex colours, exactly as the
 * Plutonian factory does; where it has none, the sculpt stands on its own.
 */

const PUBLIC_ASSET_ROOT = `${import.meta.env.BASE_URL}assets`;

const TRANS_NEPTUNIAN_SURFACE_ASSETS = Object.freeze({
  /*
   * Unwrapped from reference images by tools/dwarf-textures, the same pipeline
   * the dwarf planets themselves use: the reference disc is projected back off
   * the sphere it was taken of, the illumination baked into it is divided out
   * so the renderer is not lighting it twice, and the half that was facing away
   * is grown from the half that was not.
   *
   * Hi'iaka and Namaka come out of a single comparison illustration where they
   * are 66 and 39 pixels across, so their maps are soft by origin -- the
   * projection cannot invent detail that was never photographed. What it does
   * carry is what the reference actually establishes: bright fractured ice on
   * both, and the irregular outline of a collisional fragment.
   */
  Vanth: { albedo: `${PUBLIC_ASSET_ROOT}/textures/dwarf/moons/vanth-equirectangular.jpg` },
  Xiangliu: { albedo: `${PUBLIC_ASSET_ROOT}/textures/dwarf/moons/xiangliu-equirectangular.jpg` },
  "Hi'iaka": { albedo: `${PUBLIC_ASSET_ROOT}/textures/dwarf/moons/hiiaka-equirectangular.jpg` },
  Namaka: { albedo: `${PUBLIC_ASSET_ROOT}/textures/dwarf/moons/namaka-equirectangular.jpg` },
  Dysnomia: { albedo: `${PUBLIC_ASSET_ROOT}/textures/dwarf/moons/dysnomia-equirectangular.jpg` },
  /*
   * Weywot and MK 2 have no entry on purpose: they read well from the sculpt
   * alone, and no reference for either exists that is not simply invented.
   *
   * A note on Dysnomia, which does have one. Nobody has resolved it -- it is a
   * point of light whose brightness and period were measured over many nights
   * -- so the reference is an artist's impression, and it shows a considerably
   * brighter moon than the photometry does: the real Dysnomia reflects about
   * five per cent of the light reaching it, beside a parent that reflects
   * ninety-six. The map is used as supplied because it is the intended look;
   * the measured albedo is kept in the catalogue and still drives the
   * material's response, and the moon's card states it.
   */
});

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

function loadSurfaceTexture(label, url, { color = false } = {}) {
  if (textureCache.has(url)) return textureCache.get(url);
  const texture = textureLoader.load(url);
  texture.name = `${label} ${color ? "albedo" : "surface data"} map`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  textureCache.set(url, texture);
  return texture;
}

function hash3(x, y, z, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.17) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function valueNoise3(vector, frequency, seed) {
  const x = vector.x * frequency;
  const y = vector.y * frequency;
  const z = vector.z * frequency;
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const xf = x - xi; const yf = y - yi; const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const corner = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  const lerp = (a, b, t) => a + (b - a) * t;
  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), u);
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), u);
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), u);
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

function fbm3(vector, frequency, octaves, seed) {
  let total = 0; let amplitude = 1; let normal = 0; let scale = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise3(vector, scale, seed + octave * 17.3) * amplitude;
    normal += amplitude;
    amplitude *= 0.5;
    scale *= 2.03;
  }
  return total / Math.max(0.0001, normal);
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function directionFromSeed(seed, index) {
  const a = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  const b = Math.sin(seed * 39.3468 + index * 11.135) * 24634.6345;
  const u = (a - Math.floor(a)) * 2 - 1;
  const theta = (b - Math.floor(b)) * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return new THREE.Vector3(r * Math.cos(theta), u, r * Math.sin(theta));
}

function craterSample(direction, center, angularRadius, depth) {
  const distance = direction.angleTo(center);
  const normalized = distance / angularRadius;
  if (normalized > 1.25) return { height: 0, floor: 0, rim: 0 };
  const bowl = -depth * Math.pow(Math.max(0, 1 - normalized * normalized), 1.65);
  const rim = depth * 0.42 * Math.exp(-Math.pow((normalized - 0.96) / 0.11, 2));
  return {
    height: bowl + rim,
    floor: 1 - smoothstep(0.18, 0.88, normalized),
    rim: Math.exp(-Math.pow((normalized - 0.96) / 0.14, 2)),
  };
}

/**
 * Builds the palette from the moon's own numbers rather than from a table.
 *
 * A body's colour is authored once, as its measured tint; the light and dark
 * ends are that same colour opened up and closed down. Doing it arithmetically
 * rather than by hand keeps the eight-fold albedo spread across this set
 * honest: MK 2 at 0.04 and Hi'iaka at 0.66 cannot end up looking like two
 * shades of the same grey.
 */
function paletteFor(profile) {
  const base = new THREE.Color(profile.color ?? 0x8a8580);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  const light = new THREE.Color().setHSL(hsl.h, hsl.s * 0.82, Math.min(0.97, hsl.l * 1.42 + 0.05));
  const dark = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.15), Math.max(0.02, hsl.l * 0.55));
  // Fresh ice exposed by an impact on a bright body; dark residue on a dark one.
  const accent = (profile.albedo ?? 0.1) > 0.3
    ? new THREE.Color().setHSL(hsl.h, hsl.s * 0.4, Math.min(0.99, hsl.l * 1.7 + 0.12))
    : new THREE.Color().setHSL((hsl.h + 0.04) % 1, Math.min(1, hsl.s * 1.5 + 0.08), Math.max(0.02, hsl.l * 0.72));
  return { base, light, dark, accent };
}

function createBaseGeometry(profile, quality) {
  const large = (profile.diameterKm ?? 0) > 380;
  const segments = large
    ? (quality === "low" ? [72, 44] : quality === "medium" ? [112, 70] : [160, 100])
    : (quality === "low" ? [44, 28] : quality === "medium" ? [72, 44] : [112, 70]);
  return new THREE.SphereGeometry(1, segments[0], segments[1]);
}

function createGeometry(profile, quality) {
  const geometry = createBaseGeometry(profile, quality);
  const positions = geometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const { base, light, dark, accent } = paletteFor(profile);
  const colour = new THREE.Color();
  const seed = profile.seed ?? 0.5;

  /*
   * Bigger bodies are rounder and smoother, and that is physics rather than
   * taste: past a few hundred kilometres self-gravity wins and relief collapses
   * towards a sphere. Vanth and Dysnomia are in that regime; Xiangliu is not.
   */
  const large = (profile.diameterKm ?? 0) > 380;
  const relief = large ? 0.012 : 0.036;
  const craterCount = large ? 16 : 8;
  const craterCenters = Array.from(
    { length: craterCount },
    (_, index) => directionFromSeed(seed + 0.37, index),
  );

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm3(direction, large ? 2.0 : 1.6, 4, seed);
    const medium = fbm3(direction, large ? 7.0 : 5.2, 4, seed + 29.4);
    const fine = fbm3(direction, 19.0, 3, seed + 83.7);

    let radius = 1
      + broad * relief
      + medium * relief * 0.6
      + fine * relief * 0.26;
    let craterFloor = 0;
    let craterRim = 0;

    craterCenters.forEach((center, craterIndex) => {
      const angularRadius = (large ? 0.075 : 0.115)
        + ((craterIndex * 0.137 + seed) % 1) * (large ? 0.1 : 0.125);
      const depth = (large ? 0.009 : 0.023)
        + ((craterIndex * 0.193 + seed) % 1) * (large ? 0.015 : 0.032);
      const sample = craterSample(direction, center, angularRadius, depth);
      radius += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rim);
    });

    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    /*
     * Colour carries no shadow. Every dark patch here is a change of material,
     * never a painted-in shade: a baked highlight would keep pointing the same
     * way while the moon turned, which is the single most obvious way a small
     * body reads as a decal instead of a place.
     */
    colour.copy(base);
    colour.lerp(light, smoothstep(-0.15, 0.55, broad) * 0.5);
    colour.lerp(dark, smoothstep(0.1, 0.75, -medium) * 0.42);
    // Crater floors darken; fresh rims expose whatever is underneath.
    colour.lerp(dark, craterFloor * 0.5);
    colour.lerp(accent, craterRim * 0.42);
    colour.lerp(light, Math.max(0, fine) * 0.12);
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds one moon of a trans-Neptunian world.
 *
 * The material's response is scaled by the real geometric albedo, which is the
 * single most distinguishing measurement anyone has of these bodies. At forty
 * astronomical units the Sun delivers a two-thousandth of what it delivers at
 * Earth, so the small emissive term is the long exposure every real image of
 * them is -- and it too is scaled by albedo, so the relative brightness across
 * the set stays true even though the absolute level cannot be.
 */
export function createTransNeptunianMoonSurface(profile, quality = "high") {
  const geometry = createGeometry(profile, quality);
  const assets = TRANS_NEPTUNIAN_SURFACE_ASSETS[profile.name];
  const albedo = THREE.MathUtils.clamp(profile.albedo ?? 0.1, 0.02, 0.98);
  const map = assets?.albedo ? loadSurfaceTexture(profile.name, assets.albedo, { color: true }) : null;

  const material = new THREE.MeshStandardMaterial({
    map,
    // Vertex colours carry the sculpt when there is no photograph to use.
    vertexColors: !map,
    color: map ? 0xffffff : 0xffffff,
    roughness: 0.99 - albedo * 0.16,
    metalness: 0,
    bumpMap: assets?.height ? loadSurfaceTexture(profile.name, assets.height) : null,
    bumpScale: assets?.height ? 0.01 : 0,
    /*
     * The exposure is tinted, not white.
     *
     * `emissive` with no `emissiveMap` adds the same flat colour to every
     * fragment, so white emissive lifts the whole body uniformly: it
     * desaturates the surface towards grey and, worse, flattens the shading,
     * because the added term does not vary with the light. On a moon this far
     * out that added term is most of what reaches the eye, so Vanth's dark
     * red-brown came out as a featureless pale disc.
     *
     * Where there is a photograph, the map modulates it and white is correct.
     * Where there is not, the body's own measured colour is the right thing to
     * add -- it is the long exposure of *this* surface, not of a grey one.
     */
    emissive: map ? 0xffffff : new THREE.Color(profile.color ?? 0x8a8580),
    emissiveMap: map,
    /*
     * Albedo sets the exposure only where there is no map.
     *
     * The emissive term stands in for the long exposure every real image of
     * these bodies is, and scaling it by measured albedo is what keeps a
     * painted moon honest against its neighbours. A supplied map is different:
     * it *already* encodes how bright the surface looks, so multiplying it by a
     * low albedo darkens the same fact twice. Dysnomia is the case that shows
     * it -- at 0.05 it came out the dimmest thing in the system and its
     * reference was barely legible, having already been rendered dark once.
     *
     * So mapped moons get one flat exposure and let the map speak, and the
     * measured albedo goes on doing its work through `roughness` and through
     * the catalogue entry the moon's card reads from.
     */
    emissiveIntensity: map ? 0.17 : 0.14 + albedo * 0.30,
    envMapIntensity: 0.05,
  });

  const moon = new THREE.Mesh(geometry, material);
  moon.name = profile.name;
  // The catalogue's axis ratios are applied by the satellite system on top of
  // this; the sculpt itself stays spherical so the two do not fight.
  moon.userData.geometryIncludesShape = false;
  return moon;
}

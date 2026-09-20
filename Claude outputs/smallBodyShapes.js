import * as THREE from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";

/**
 * Sculpting a body whose shape is the whole point.
 *
 * Every other rock in this scene is a sphere pushed around by noise, and for
 * an anonymous belt fragment that is honest -- nobody knows what it looks
 * like. It is wrong for these thirteen. Arrokoth is two lobes touching over a
 * 600 m contact; 67P is a head stacked on a body; Eros is a 34 km peanut with
 * a 10 km bite out of the waist; Bennu, Ryugu and Didymos are spinning tops
 * with equatorial ridges their own rotation threw up. Those silhouettes are
 * measured facts and they belong in geometry, not in a texture.
 *
 * ## How the silhouette is built
 *
 * A sphere mesh can represent any surface that is *star-shaped* about its
 * centre -- one radius per direction. All thirteen of these are, from a
 * sensible origin, including the contact binaries, so the whole family can be
 * built by computing one support radius per vertex direction and moving the
 * vertex out to it. No CSG, no self-intersection, no stitching.
 *
 * For each direction the support radius is the largest distance at which the
 * ray leaves any of the body's lobes, which for an ellipsoid is one quadratic.
 * Several lobes are combined with a **soft maximum** rather than a hard one,
 * and that is what produces the neck: where two lobes are comparably far away
 * the soft maximum bulges slightly past both of them, which is exactly what
 * material piled into a contact crease looks like. The sharpness of the soft
 * maximum is the per-body `neck` number -- high for Arrokoth's pinched waist,
 * low for Eros's broad one.
 *
 * Then, in order: negative lobes (Eros's Himeros saddle), planar facets
 * (Lutetia and Gaspra, which are angular rather than lumpy), the equatorial
 * ridge, two octaves of noise, crater bowls with raised rims, and positive
 * boulders. Craters and boulders are fractions of the *local* radius, so a
 * crater on a thin end is not deeper than the end is thick.
 *
 * ## Why this file also writes the colour
 *
 * Because the shading terms are a by-product of the sculpting and throwing
 * them away would mean computing them twice. A crater bowl already knows it
 * is a bowl; the rim already knows it is a rim; a boulder knows it is a
 * boulder. Those feed the vertex colour directly, alongside the body's
 * albedo-derived base value. There is no texture on any of these bodies and
 * therefore no chance of the displacement-map accident that has bitten this
 * project before: the generic rocky material in `planetFactory.js` uses a
 * body's surface map as a displacement map, and feeding it a photograph
 * covers the world in spikes. Nothing here carries a map at all.
 */

const _noise = new ImprovedNoise();
const _dir = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/** Stable pseudo-random value from any numeric seed. */
function hash(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function unitVector(seed) {
  const z = hash(seed) * 2 - 1;
  const angle = hash(seed + 1.37) * Math.PI * 2;
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(radial * Math.cos(angle), z, radial * Math.sin(angle));
}

/** Fractal Brownian motion on the unit sphere. Four octaves is plenty here. */
function fbm(x, y, z, seed, octaves = 4) {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let total = 0;
  const ox = (seed * 0.754877666) % 91;
  const oy = (seed * 0.569840291) % 83;
  const oz = (seed * 0.438289121) % 71;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * _noise.noise(
      x * frequency + ox,
      y * frequency + oy,
      z * frequency + oz,
    );
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return sum / total;
}

/**
 * How far a ray from the origin travels before it leaves one ellipsoid.
 *
 * Solving |(t·d − c)/r| = 1 for the larger root. Returns 0 when the ray misses
 * the lobe entirely, which lets the soft maximum below ignore it.
 */
function lobeSupport(direction, lobe) {
  const ux = direction.x / lobe.r[0];
  const uy = direction.y / lobe.r[1];
  const uz = direction.z / lobe.r[2];
  const vx = lobe.c[0] / lobe.r[0];
  const vy = lobe.c[1] / lobe.r[1];
  const vz = lobe.c[2] / lobe.r[2];
  const uu = ux * ux + uy * uy + uz * uz;
  const uv = ux * vx + uy * vy + uz * vz;
  const vv = vx * vx + vy * vy + vz * vz;
  const discriminant = uv * uv - uu * (vv - 1);
  if (discriminant <= 0 || uu <= 0) return 0;
  return (uv + Math.sqrt(discriminant)) / uu;
}

/**
 * Soft maximum over the lobes: log-sum-exp, with the peak factored out.
 *
 * It has to be this and not an exponentially weighted mean, and the difference
 * is the whole silhouette. A weighted mean is always *below* the largest term,
 * so at the waist -- where two lobes contribute comparably -- it drops far
 * below both of them and pinches the body into an hourglass. Measured on the
 * first version: Eros's waist came out 30% of its end thickness where NEAR
 * measured about 65%, and every contact binary in the set had a visible wasp
 * neck that is not in any of the photographs.
 *
 * Log-sum-exp is always *at or above* the maximum: it equals it wherever one
 * lobe dominates, and exceeds it by exactly log(2)/k where two are equal. That
 * excess is the fillet -- material piled into the contact crease, which is
 * what a real contact binary has. So `neck` in the catalogue sets the fillet
 * size directly: the waist gains 0.693 × halfLength / neck kilometres, which
 * is a number you can check against a photograph.
 */
function softMaxSupport(direction, lobes, sharpness) {
  if (lobes.length === 1) return lobeSupport(direction, lobes[0]);
  let peak = 0;
  for (let i = 0; i < lobes.length; i += 1) {
    const value = lobeSupport(direction, lobes[i]);
    if (value > peak) peak = value;
  }
  if (peak <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < lobes.length; i += 1) {
    const value = lobeSupport(direction, lobes[i]);
    if (value <= 0) continue;
    sum += Math.exp(sharpness * (value - peak));
  }
  return sum > 0 ? peak + Math.log(sum) / sharpness : peak;
}

/**
 * A negative lobe: a sphere carved out of the body.
 *
 * Eros's Himeros is the reason this exists. It is a 10 km concavity across the
 * waist, deep enough that Eros is genuinely non-convex, and without it Eros is
 * just a lumpy peanut instead of the saddle-backed thing everyone recognises.
 * The cut is smoothed so the rim is a shoulder rather than a knife edge.
 */
function applyDent(direction, radius, dent) {
  // Closest approach of the ray to the dent centre.
  const cx = dent.c[0];
  const cy = dent.c[1];
  const cz = dent.c[2];
  const along = direction.x * cx + direction.y * cy + direction.z * cz;
  if (along <= 0) return radius;
  const px = direction.x * along - cx;
  const py = direction.y * along - cy;
  const pz = direction.z * along - cz;
  const missDistance = Math.sqrt(px * px + py * py + pz * pz);
  if (missDistance >= dent.r) return radius;
  // Where the ray enters the dent sphere: everything beyond that is removed.
  const half = Math.sqrt(dent.r * dent.r - missDistance * missDistance);
  const entry = along - half;
  if (entry >= radius) return radius;
  const softness = dent.softness ?? 1;
  // Smooth minimum, so the cut blends into the surface instead of shearing it.
  const k = Math.max(1e-4, softness);
  const h = THREE.MathUtils.clamp(0.5 + 0.5 * (radius - entry) / k, 0, 1);
  return THREE.MathUtils.lerp(radius, entry, h) - k * h * (1 - h);
}

/**
 * A planar shave, for the bodies whose silhouette is made of flat faces.
 *
 * Lutetia and Gaspra both read as fragments: large flat facets meeting at
 * edges, not a lumpy potato. `d` is the plane's distance from the centre as a
 * fraction of the support radius in that direction, so one number works on
 * both a 12 km body and a 98 km one.
 */
function applyFacet(direction, radius, facet) {
  const alignment = direction.x * facet.n[0] + direction.y * facet.n[1] + direction.z * facet.n[2];
  if (alignment <= 0.001) return radius;
  const planeDistance = (facet.d * radius) / alignment;
  if (planeDistance >= radius) return radius;
  const k = Math.max(1e-4, (facet.softness ?? 0.2) * radius);
  const h = THREE.MathUtils.clamp(0.5 + 0.5 * (radius - planeDistance) / k, 0, 1);
  return THREE.MathUtils.lerp(radius, planeDistance, h) - k * h * (1 - h);
}

function buildCraterField(shape) {
  const craters = [];
  const count = shape.craterCount ?? 0;
  const minimum = shape.craterMin ?? 0.03;
  const maximum = shape.craterMax ?? 0.14;
  const depth = shape.craterDepth ?? 0.025;
  for (let i = 0; i < count; i += 1) {
    const seed = shape.seed * 7 + i * 131;
    craters.push({
      direction: unitVector(seed),
      /* Real crater populations are steeply weighted to the small end. Drawn
       * uniformly they read as concentric ripples rather than impacts -- the
       * same mistake the dwarf-world sculptor records having made. */
      radius: minimum + Math.pow(hash(seed + 0.31), 2.1) * (maximum - minimum),
      depth: depth * (0.55 + hash(seed + 0.57) * 0.9),
      rim: (shape.craterRim ?? depth * 0.34) * (0.6 + hash(seed + 0.73) * 0.8),
    });
  }
  (shape.bigCraters ?? []).forEach((crater, index) => {
    craters.push({
      direction: new THREE.Vector3(...crater.dir).normalize(),
      radius: crater.radius,
      depth: crater.depth,
      rim: crater.rim ?? crater.depth * 0.2,
      named: true,
      index,
    });
  });
  return craters;
}

function buildBoulderField(shape) {
  const boulders = [];
  const count = shape.boulders ?? 0;
  const size = shape.boulderSize ?? 0.05;
  for (let i = 0; i < count; i += 1) {
    const seed = shape.seed * 13 + i * 277 + 4.1;
    boulders.push({
      direction: unitVector(seed),
      radius: size * (0.45 + hash(seed + 0.19) * 0.95),
      height: size * (0.22 + hash(seed + 0.41) * 0.42),
    });
  }
  (shape.bigBoulders ?? []).forEach((boulder) => {
    boulders.push({
      direction: new THREE.Vector3(...boulder.dir).normalize(),
      radius: boulder.radius,
      height: boulder.height,
    });
  });
  return boulders;
}

/**
 * Averages the normals of the vertices a sphere duplicates.
 *
 * `SphereGeometry` is indexed but not welded in two places: the whole top and
 * bottom rows are `widthSegments + 1` separate vertices all sitting exactly on
 * the pole, and the first and last column of every row are two vertices at the
 * same point with different texture coordinates. `computeVertexNormals` treats
 * each copy as its own vertex, so each pole copy takes its normal from the one
 * or two sliver triangles it happens to belong to.
 *
 * On an undisplaced sphere nobody notices. On a body pushed around by noise
 * and craters it produces a starburst at the pole -- a fan of radial creases,
 * clearly visible on every one of these bodies when it is viewed down its
 * short axis, which is exactly the view a spinning top is usually seen from.
 * There was a matching hairline seam down one meridian.
 *
 * Averaging the copies' normals and writing the average back to all of them
 * fixes both. It costs one pass over two rows and two columns, the positions
 * are already identical so nothing moves, and it is far cheaper than welding
 * the whole mesh with BufferGeometryUtils.
 */
function weldSphereNormals(geometry, widthSegments, heightSegments) {
  const normals = geometry.attributes.normal;
  const stride = widthSegments + 1;

  const averageRow = (row) => {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i <= widthSegments; i += 1) {
      const index = row * stride + i;
      x += normals.getX(index);
      y += normals.getY(index);
      z += normals.getZ(index);
    }
    const length = Math.hypot(x, y, z) || 1;
    for (let i = 0; i <= widthSegments; i += 1) {
      normals.setXYZ(row * stride + i, x / length, y / length, z / length);
    }
  };
  averageRow(0);
  averageRow(heightSegments);

  for (let row = 1; row < heightSegments; row += 1) {
    const first = row * stride;
    const last = first + widthSegments;
    const x = normals.getX(first) + normals.getX(last);
    const y = normals.getY(first) + normals.getY(last);
    const z = normals.getZ(first) + normals.getZ(last);
    const length = Math.hypot(x, y, z) || 1;
    normals.setXYZ(first, x / length, y / length, z / length);
    normals.setXYZ(last, x / length, y / length, z / length);
  }

  normals.needsUpdate = true;
}

/**
 * Builds one small body: geometry in kilometres, with its colour baked in.
 *
 * `baseValue` is the linear reflectance derived from the measured geometric
 * albedo and `chroma` is a unit-luminance hue triple; multiplied together they
 * are the body's honest base colour in linear light, which is what a vertex
 * colour attribute wants. Nothing here is converted from sRGB, because nothing
 * here came from a photograph.
 */
export function createSmallBodyGeometry(shape, {
  widthSegments = 88,
  heightSegments = 58,
  chroma = [1, 1, 1],
  baseValue = 0.15,
} = {}) {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  const ridge = shape.ridge ?? 0;

  /*
   * Pre-compensating the ellipsoid for its own ridge.
   *
   * The tri-axial extents in the catalogue are bounding boxes measured on real
   * bodies that already carry their equatorial ridge. Sizing the ellipsoid to
   * those extents and then adding a ridge on top counts it twice: the first
   * pass came out with Bennu 6% too wide at the equator, Ryugu 8% and Didymos
   * 8%, all of them in the one direction the published number is most precise
   * about. Shrinking the equatorial semi-axes by exactly the gain the ridge
   * will add, and the polar one by the dip it will subtract, puts the finished
   * crest back on the measured extent.
   */
  const lobes = ridge > 0
    ? shape.lobes.map((lobe) => ({
      c: lobe.c,
      r: [
        lobe.r[0] / (1 + ridge),
        lobe.r[1] / (1 - 0.22 * ridge),
        lobe.r[2] / (1 + ridge),
      ],
    }))
    : shape.lobes;
  let halfLength = 0;
  for (let i = 0; i < lobes.length; i += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      halfLength = Math.max(halfLength, Math.abs(lobes[i].c[axis]) + lobes[i].r[axis]);
    }
  }
  const sharpness = (shape.neck ?? 4) / Math.max(1e-6, halfLength);

  const craters = buildCraterField(shape);
  const boulders = buildBoulderField(shape);
  const dents = shape.dents ?? [];
  const facets = shape.facets ?? [];
  const patches = shape.patches ?? [];
  const collar = shape.collar ?? null;
  const relief = shape.relief ?? 0.03;
  const grain = shape.grain ?? 0.015;
  const seed = shape.seed ?? 1;

  for (let index = 0; index < positions.count; index += 1) {
    _dir.fromBufferAttribute(positions, index).normalize();

    let radius = softMaxSupport(_dir, lobes, sharpness);
    if (radius <= 0) radius = halfLength * 0.2;

    for (let i = 0; i < dents.length; i += 1) radius = applyDent(_dir, radius, dents[i]);
    for (let i = 0; i < facets.length; i += 1) radius = applyFacet(_dir, radius, facets[i]);

    /*
     * The equatorial ridge on a spinning top. Bennu, Ryugu and Didymos all
     * have one and all three have it for the same reason: they turn fast
     * enough that loose material creeps downslope toward the equator, where
     * the effective gravity is weakest, and stops there. The high exponent
     * keeps it a ridge rather than a general fattening.
     */
    if (ridge > 0) {
      const equatorial = 1 - Math.abs(_dir.y);
      radius *= 1 + ridge * Math.pow(equatorial, 4.2) - ridge * 0.22 * Math.pow(Math.abs(_dir.y), 3);
    }

    /* Two octave sets: the broad one gives the body its lumps, the fine one
     * gives grazing light something to catch at close range. */
    const broad = fbm(_dir.x * 2.6, _dir.y * 2.6, _dir.z * 2.6, seed, 4) ;
    const fine = fbm(_dir.x * 11.5, _dir.y * 11.5, _dir.z * 11.5, seed + 37, 3);
    radius *= 1 + broad * relief + fine * grain;

    let craterShade = 0;
    let rimLight = 0;
    for (let i = 0; i < craters.length; i += 1) {
      const crater = craters[i];
      const cosine = _dir.x * crater.direction.x
        + _dir.y * crater.direction.y
        + _dir.z * crater.direction.z;
      if (cosine < Math.cos(crater.radius * 1.2)) continue;
      const angle = Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
      const bowl = 1 - THREE.MathUtils.smoothstep(angle, crater.radius * 0.05, crater.radius);
      const rim = THREE.MathUtils.smoothstep(angle, crater.radius * 0.7, crater.radius * 0.88)
        * (1 - THREE.MathUtils.smoothstep(angle, crater.radius * 0.88, crater.radius * 1.15));
      radius *= 1 - bowl * crater.depth + rim * crater.rim;
      if (bowl > craterShade) craterShade = bowl;
      if (rim > rimLight) rimLight = rim;
    }

    let boulderMask = 0;
    for (let i = 0; i < boulders.length; i += 1) {
      const boulder = boulders[i];
      const cosine = _dir.x * boulder.direction.x
        + _dir.y * boulder.direction.y
        + _dir.z * boulder.direction.z;
      if (cosine < Math.cos(boulder.radius * 1.3)) continue;
      const angle = Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
      const cap = 1 - THREE.MathUtils.smoothstep(angle, boulder.radius * 0.25, boulder.radius);
      radius *= 1 + cap * boulder.height;
      if (cap > boulderMask) boulderMask = cap;
    }

    /*
     * Mathilde is the reason for this clamp. Five overlapping bowls, each a
     * fifth of the local radius deep, will happily drive a vertex through the
     * origin and turn the surface inside out. Nothing else in the set gets
     * anywhere near it.
     */
    radius = Math.max(radius, halfLength * 0.22);

    const px = _dir.x * radius;
    const py = _dir.y * radius;
    const pz = _dir.z * radius;
    positions.setXYZ(index, px, py, pz);

    /* ---- colour ---------------------------------------------------- */
    /*
     * One base value from the measured albedo, modulated by what the geometry
     * already knows. Crater floors sit in their own shadow and read darker;
     * rims catch light and read brighter; boulders on a carbonaceous body are
     * consistently a little brighter than the fines around them, which is one
     * of the first things OSIRIS-REx reported about Bennu.
     */
    const mottle = fbm(_dir.x * 4.3, _dir.y * 4.3, _dir.z * 4.3, seed + 611, 3);
    let gain = 1 + mottle * 0.30 - craterShade * 0.22 + rimLight * 0.16 + boulderMask * 0.14;

    if (collar) {
      /* Arrokoth's neck collar, 67P's Hapi, Itokawa's Muses Sea: all three are
       * brighter than the ground either side of them, and all three sit in the
       * waist. A Gaussian on the long axis is the cheapest honest way to say
       * that. */
      const halfWidth = Math.max(1e-6, collar.widthKm * 0.5);
      const offset = (px - collar.centreKm) / halfWidth;
      const weight = Math.exp(-offset * offset);
      gain *= 1 + (collar.gain - 1) * weight;
    }

    for (let i = 0; i < patches.length; i += 1) {
      const patch = patches[i];
      const cosine = _dir.x * patch.dir[0] + _dir.y * patch.dir[1] + _dir.z * patch.dir[2];
      const angle = Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
      if (angle > patch.radius * 1.4) continue;
      const weight = 1 - THREE.MathUtils.smoothstep(angle, patch.radius * 0.35, patch.radius * 1.4);
      gain *= 1 + (patch.gain - 1) * weight;
    }

    const value = Math.max(0.0015, baseValue * gain);
    colors[index * 3] = value * chroma[0];
    colors[index * 3 + 1] = value * chroma[1];
    colors[index * 3 + 2] = value * chroma[2];
  }

  positions.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  weldSphereNormals(geometry, widthSegments, heightSegments);
  geometry.normalizeNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * The largest half-extent of a sculpted geometry, in its own units.
 *
 * Used for two things: converting kilometres to scene units, and sizing the
 * pointer proxy and the focus distance so an elongated body like Eros is
 * entirely reachable rather than reachable near its middle.
 */
export function maxHalfExtent(geometry) {
  const box = geometry.boundingBox;
  if (!box) return 1;
  _tmp.set(
    Math.max(Math.abs(box.min.x), Math.abs(box.max.x)),
    Math.max(Math.abs(box.min.y), Math.abs(box.max.y)),
    Math.max(Math.abs(box.min.z), Math.abs(box.max.z)),
  );
  return Math.max(_tmp.x, _tmp.y, _tmp.z);
}

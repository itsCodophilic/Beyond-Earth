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

/**
 * Fractal Brownian motion on the unit sphere.
 *
 * `basisOctaves` is the octave count the amplitude is normalised against, and
 * it exists so that dropping an octave the mesh cannot carry actually removes
 * that octave's energy. Normalising by the octaves *used* would hand its
 * share to the survivors instead, which makes the surface louder at the
 * frequencies that were already the loudest -- the opposite of the intent.
 * Callers that keep every octave can leave it alone.
 */
function fbm(x, y, z, seed, octaves = 4, basisOctaves = octaves) {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  const ox = (seed * 0.754877666) % 91;
  const oy = (seed * 0.569840291) % 83;
  const oz = (seed * 0.438289121) % 71;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * _noise.noise(
      x * frequency + ox,
      y * frequency + oy,
      z * frequency + oz,
    );
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  // Closed form of 0.5 + 0.25 + ... over `basisOctaves` terms.
  const total = 1 - Math.pow(0.5, Math.max(1, basisOctaves));
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

/*
 * A continuous body, for the shapes that came out as dumbbells.
 *
 * Reported: Donaldjohanson looked like "a dumbbell, a ribbon", and Toutatis
 * like a dhol drum -- two lobes joined by a thin wrapped band. The cause is
 * the radial construction above: a ray from the centre that passes between
 * two lobes misses both, gets the fallback radius, and the vertices round
 * the waist are stretched across the crease into a band. Kleopatra and Manwë
 * showed it as a straight collar, Itokawa and Arrokoth as a pinched seam.
 *
 * `shape.blend: "smooth"` builds those bodies another way: as one surface,
 * the smooth minimum of the lobes' (approximate) distance fields, so the
 * lobes merge through a fillet of width `fillet` (in the shape's own units;
 * default a quarter of the smallest lobe's mean radius) the way two blobs of
 * clay pressed together do. Each vertex's radius is found by marching in
 * from outside along its ray to the first crossing and bisecting, so a
 * concave waist is followed rather than skipped. Selam -- the shape the
 * owner pointed to as right -- is the model: one continuous body that is
 * plainly two lobes.
 */
function ellipsoidDistance(px, py, pz, lobe) {
  const qx = (px - lobe.c[0]) / lobe.r[0];
  const qy = (py - lobe.c[1]) / lobe.r[1];
  const qz = (pz - lobe.c[2]) / lobe.r[2];
  const k0 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const rx = qx / lobe.r[0];
  const ry = qy / lobe.r[1];
  const rz = qz / lobe.r[2];
  const k1 = Math.sqrt(rx * rx + ry * ry + rz * rz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(...lobe.r);
}

function smoothUnionDistance(px, py, pz, lobes, k) {
  let d = ellipsoidDistance(px, py, pz, lobes[0]);
  for (let i = 1; i < lobes.length; i += 1) {
    const e = ellipsoidDistance(px, py, pz, lobes[i]);
    const h = Math.max(k - Math.abs(d - e), 0) / k;
    d = Math.min(d, e) - h * h * k * 0.25;
  }
  return d;
}

function smoothRadius(direction, lobes, k, outer) {
  const steps = 64;
  let previous = outer;
  let previousD = smoothUnionDistance(direction.x * outer, direction.y * outer, direction.z * outer, lobes, k);
  for (let i = steps - 1; i >= 0; i -= 1) {
    const t = (outer * i) / steps;
    const d = smoothUnionDistance(direction.x * t, direction.y * t, direction.z * t, lobes, k);
    if (d <= 0 && previousD > 0) {
      let lo = t;
      let hi = previous;
      /* 12 halvings of a 1/64 step leave the crossing within 1/262,144 of
       * the march span -- far below a vertex's spacing at any mesh detail
       * in this scene (96 segments), so more would only cost build time. */
      for (let j = 0; j < 12; j += 1) {
        const mid = (lo + hi) * 0.5;
        if (smoothUnionDistance(direction.x * mid, direction.y * mid, direction.z * mid, lobes, k) <= 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) * 0.5;
    }
    previous = t;
    previousD = d;
  }
  return 0;
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

/*
 * The smallest crater a 96 x 64 sphere can actually show.
 *
 * One quad spans 360/96 = 3.75 degrees of longitude, which is 0.065 radians.
 * A crater narrower than that lands between vertices: the sculptor pulls one
 * vertex in, `computeVertexNormals` averages the dent away against its
 * neighbours, and the colour term never fires because no vertex is inside the
 * bowl. It costs the same to compute and draws nothing.
 *
 * That is what the first pass did, and it is why Eros rendered as a smooth
 * cream-coloured blob with 44 craters on it. The size distribution was
 * weighted to the small end with an exponent of 2.1 -- correct for a real
 * crater population, where the small ones vastly outnumber the large -- so
 * most of the 44 came out near the authored minimum of 0.030 radians, which
 * is under half a quad. Measured: the body's whole silhouette spanned 184 to
 * 198 out of 255, a nine-per-cent range, with no crater visible anywhere on
 * it at any zoom.
 *
 * So the population is truncated at what the mesh can resolve rather than
 * being drawn and thrown away. A crater floor is two quads across at this
 * limit, which is the minimum that survives normal averaging. The truncation
 * is a statement about the renderer and not about the body, and the count in
 * the catalogue should be read as "craters this mesh can show", not as a
 * crater count -- the real ones run down to centimetres.
 */
/*
 * How many vertices one cycle of surface detail needs before it shades.
 *
 * Two is the Nyquist limit: below it the octave is not even representable.
 * Two is also useless here, because what a viewer sees is not the
 * displacement but its *slope*, and a sine sampled twice per cycle has a
 * slope that reverses at every vertex. The angle between adjacent shading
 * normals goes as amplitude x frequency squared, so the top octave of a band
 * dominates the faceting even though it is the quietest.
 *
 * Eight samples per cycle is where that turn falls under about five degrees
 * for the loudest band in this catalogue. Measured over the set, mean angle
 * between adjacent shading normals on a 96 x 64 mesh:
 *
 *            before   after
 *   Itokawa   7.56     6.46
 *   67P       7.37     6.60
 *   Apophis   7.02     5.98
 *   Eros      4.08     3.85
 *
 * Re-measure with scripts/normal-roughness.mjs, which also prints the worst
 * single pair and the fraction of pairs over 25 degrees.
 */
const SAMPLES_PER_CYCLE = 8;

/* The octave counts the two noise bands were authored with. They are the
 * normalisation basis, not the count actually evaluated -- see `fbm`. */
const BROAD_OCTAVES = 4;
const FINE_OCTAVES = 3;

const RESOLVABLE_CRATER_RADIANS = 0.055;

/*
 * Depth from the crater's own width, which is how craters work.
 *
 * A fresh simple crater is about a fifth as deep as it is wide, so depth is
 * roughly 0.4 of the angular radius; an old degraded one is much shallower.
 * The first pass used one absolute depth for every crater on a body, which
 * inverted the relationship: the small craters came out at a 41-degree wall
 * slope the mesh could not draw, and the large ones at 10 degrees, which the
 * mesh could draw and which is too shallow to catch a shadow.
 *
 * `craterDepth` in the catalogue keeps its meaning for a crater of the
 * reference width below -- a little under half of 0.4, so the field reads as
 * a mixture of fresh and degraded rather than all fresh.
 */
const CRATER_REFERENCE_RADIANS = 0.09;

function buildCraterField(shape) {
  const craters = [];
  const count = shape.craterCount ?? 0;
  const minimum = Math.max(RESOLVABLE_CRATER_RADIANS, shape.craterMin ?? 0.03);
  const maximum = Math.max(minimum * 1.6, shape.craterMax ?? 0.14);
  const depth = shape.craterDepth ?? 0.025;
  for (let i = 0; i < count; i += 1) {
    const seed = shape.seed * 7 + i * 131;
    /* Real crater populations are steeply weighted to the small end. Drawn
     * uniformly they read as concentric ripples rather than impacts -- the
     * same mistake the dwarf-world sculptor records having made. The exponent
     * is gentler than the 2.1 it started at because the band has already been
     * truncated at the bottom: keeping 2.1 over a truncated range piles most
     * of the field onto the floor value and every crater comes out the same
     * size, which reads as a regular dimpled pattern. */
    const radius = minimum + Math.pow(hash(seed + 0.31), 1.55) * (maximum - minimum);
    const wear = 0.55 + hash(seed + 0.57) * 0.9;
    craters.push({
      direction: unitVector(seed),
      radius,
      depth: depth * (radius / CRATER_REFERENCE_RADIANS) * wear,
      rim: (shape.craterRim ?? depth * 0.34)
        * (radius / CRATER_REFERENCE_RADIANS)
        * (0.6 + hash(seed + 0.73) * 0.8),
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

/*
 * The same truncation the crater field gets, and for a worse reason.
 *
 * A crater narrower than one quad lands between vertices and is averaged away
 * -- wasted work, but nothing is drawn. A *boulder* narrower than one quad is
 * not harmless: it pushes a single vertex outward with no neighbour to share
 * the slope with, so the mesh grows a one-vertex spike whose normal points
 * somewhere no real surface points. There is one such normal per sub-quad
 * boulder, and as the body turns each of them sweeps through the light on its
 * own. That is not roughness, it is sparkle, and it is why the two bodies with
 * the finest authored boulder fields were the two that would not sit still.
 *
 * Measured on a 96 x 64 mesh, before this: the mean angle between adjacent
 * shading normals was 7.56 degrees on Itokawa and 7.02 on Apophis, against
 * 4.1 to 5.8 for every body that was reported as steady. Itokawa draws 34
 * boulders at `boulderSize` 0.090 and Apophis 16 at 0.055; one quad is 0.0654
 * radians, so most of Apophis's field and half of Itokawa's was below the
 * floor.
 *
 * So a boulder the mesh cannot carry is not drawn. The detail is not lost --
 * the surface map carries that band at 1024 pixels around, which is twenty
 * times the resolution the geometry has. The floor is the quad width, which
 * makes the cap two vertices across: the minimum that survives normal
 * averaging, exactly as `RESOLVABLE_CRATER_RADIANS` argues for bowls.
 */
function resolvableBoulderRadians(widthSegments) {
  return (2 * Math.PI) / Math.max(8, widthSegments);
}

function buildBoulderField(shape, minimumRadius = 0) {
  const boulders = [];
  const count = shape.boulders ?? 0;
  const size = shape.boulderSize ?? 0.05;
  for (let i = 0; i < count; i += 1) {
    const seed = shape.seed * 13 + i * 277 + 4.1;
    const radius = size * (0.45 + hash(seed + 0.19) * 0.95);
    if (radius < minimumRadius) continue;
    boulders.push({
      direction: unitVector(seed),
      radius,
      height: size * (0.22 + hash(seed + 0.41) * 0.42),
    });
  }
  /* An authored boulder is a named feature someone measured, so it is drawn
   * whatever the mesh makes of it -- but its cap is widened to the floor so
   * it is a bump rather than a spike. */
  (shape.bigBoulders ?? []).forEach((boulder) => {
    boulders.push({
      direction: new THREE.Vector3(...boulder.dir).normalize(),
      radius: Math.max(minimumRadius, boulder.radius),
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
 * Moves the sculpted body so the origin is its centre of volume.
 *
 * The lobes are authored as an offset ellipsoid each, positioned so the
 * *bounding box* matches the published tri-axial dimensions -- which is the
 * right way to author them and the wrong place to put the origin. Itokawa's
 * big lobe is three times the volume of its small one, so the finished body's
 * centre of volume sits 15.7% of its own half-length away from the origin it
 * was being spun about. A rigid body does not do that: it rotates about its
 * centre of mass. Drawn the other way, the whole rock swings around a point
 * outside itself once per rotation -- a wobble the size of a sixth of the
 * body, which at the distance a focused small body is framed from is several
 * per cent of the screen.
 *
 * Measured over the set, with the offset as a percentage of the body's own
 * maximum radius: Itokawa 15.7, Ida 9.1, Arrokoth 7.6, Eros 6.2, 67P 5.1,
 * Apophis 4.5, and under 2 for every single-lobe body (they are symmetric
 * about their own centre already, so this pass costs them nothing and moves
 * them nowhere).
 *
 * The centroid is the exact one -- the signed-tetrahedron integral over the
 * closed mesh, not the average of the vertices, which a sphere's crowded poles
 * would bias toward the axis. It runs once per body at build time.
 */
function recentreOnVolume(geometry) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  if (!index) return;
  let volume = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  const a = _dir;
  const b = _tmp;
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(positions, index.getX(i));
    b.fromBufferAttribute(positions, index.getX(i + 1));
    c.fromBufferAttribute(positions, index.getX(i + 2));
    // Six times the signed volume of the tetrahedron (origin, a, b, c).
    const six = a.dot(cross.crossVectors(b, c));
    volume += six;
    // The tetrahedron's own centroid is the mean of its four corners, and the
    // origin contributes nothing to the sum.
    cx += six * (a.x + b.x + c.x);
    cy += six * (a.y + b.y + c.y);
    cz += six * (a.z + b.z + c.z);
  }
  if (!(Math.abs(volume) > 1e-12)) return;
  // The 1/6 and the 1/4 cancel out of the ratio; only the 1/4 survives.
  const scale = 1 / (4 * volume);
  geometry.translate(-cx * scale, -cy * scale, -cz * scale);
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
  const smooth = shape.blend === "smooth" && lobes.length > 1;
  const fillet = shape.fillet ?? 0.25 * Math.min(...lobes.map((l) => (l.r[0] + l.r[1] + l.r[2]) / 3));

  /*
   * How much detail this mesh can actually shade.
   *
   * A displacement of n cycles around the body needs more than 2n vertices to
   * be represented at all, and about 4n before its normals settle down enough
   * to shade smoothly rather than facet. Below that the octave is not detail,
   * it is noise: each vertex gets a displacement uncorrelated with its
   * neighbours, every face catches the light on its own, and the whole surface
   * sparkles as the body turns.
   *
   * The fine noise band ran at 11.5 cycles with three octaves at a 2.07 ratio
   * -- 11.5, 23.8 and 49.3 cycles -- against a 96-segment sphere whose Nyquist
   * limit is 48 and whose shadeable limit is 24. The top octave was pure
   * aliasing on every body in the set, and it was loudest where `grain` is
   * loudest: 0.034 on Apophis and 0.030 on Itokawa, against a median of 0.016.
   *
   * So the octave count is derived from the mesh instead of being authored:
   * add octaves while they stay inside what the mesh can shade, and stop. At
   * 96 x 64 the broad band keeps all four of its octaves and the fine band
   * keeps two; a 40 x 28 moon keeps two and one. `fbm` normalises by its own
   * amplitude sum, so dropping an octave changes the roughness of the surface
   * and not its height.
   */
  const shadeableCycles = Math.min(widthSegments, heightSegments * 2) / SAMPLES_PER_CYCLE;
  const octavesWithin = (base) => {
    let octaves = 1;
    while (base * Math.pow(2.07, octaves) <= shadeableCycles) octaves += 1;
    return octaves;
  };
  const broadFrequency = Math.min(2.6, shadeableCycles);
  const fineFrequency = Math.min(11.5, shadeableCycles);
  const broadOctaves = octavesWithin(broadFrequency);
  const fineOctaves = octavesWithin(fineFrequency);

  const craters = buildCraterField(shape);
  const boulders = buildBoulderField(shape, resolvableBoulderRadians(widthSegments));
  const dents = shape.dents ?? [];
  const facets = shape.facets ?? [];
  const patches = shape.patches ?? [];
  const collar = shape.collar ?? null;
  const relief = shape.relief ?? 0.03;
  const grain = shape.grain ?? 0.015;
  const seed = shape.seed ?? 1;

  for (let index = 0; index < positions.count; index += 1) {
    _dir.fromBufferAttribute(positions, index).normalize();

    let radius = smooth
      ? smoothRadius(_dir, lobes, fillet, halfLength * 1.6)
      : softMaxSupport(_dir, lobes, sharpness);
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
     * gives grazing light something to catch at close range. Both are cut off
     * at what this mesh can shade -- see `shadeableCycles` above. */
    const broad = fbm(
      _dir.x * broadFrequency, _dir.y * broadFrequency, _dir.z * broadFrequency,
      seed, broadOctaves, BROAD_OCTAVES,
    );
    const fine = fbm(
      _dir.x * fineFrequency, _dir.y * fineFrequency, _dir.z * fineFrequency,
      seed + 37, fineOctaves, FINE_OCTAVES,
    );
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
      // A negative depth is a rise, not a bowl (Máni's 25 km peak), and must
      // not be shaded like a crater floor.
      if (crater.depth > 0 && bowl > craterShade) craterShade = bowl;
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

  recentreOnVolume(geometry);

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

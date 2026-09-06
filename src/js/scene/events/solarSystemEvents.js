import * as THREE from "three";

/**
 * Things that actually happen out there, staged on a timer.
 *
 * The Solar System reads as furniture in most renderings: the planets go round
 * and nothing ever *occurs*. It is not a fair picture. Jupiter is struck by
 * something big enough to see from Earth a few times a year; Io is erupting
 * somewhere on its surface at every moment; Enceladus has been venting its own
 * ocean into Saturn's E ring for as long as anyone has looked; Earth ploughs
 * through the same debris streams on the same dates every year; and the Sun
 * throws a billion tonnes of its atmosphere into space several times a day.
 *
 * Every event here is one of those, built from what was actually observed --
 * the sizes, the durations, the colours and the rates are in the notes on each
 * one. Nothing is invented for effect; the only liberty is timing, because a
 * viewer will not wait eight months for the Perseids.
 */

/**
 * Nothing here runs on a timer any more.
 *
 * The roster used to rotate: one event every three and a half minutes, chosen
 * at random from whatever was on screen. That was the wrong shape twice over.
 * A viewer who stayed ten minutes saw three of fifteen events, in an order
 * they did not choose, usually on a body they were not looking at -- and the
 * ones they did see arrived unannounced, so the interesting part (what it is,
 * why it happens) had already started before they knew to look.
 *
 * So events are now staged only on request, and the request carries the whole
 * sequence with it: travel to the body, wait, watch it happen once. There is
 * no interval and no autoplay, because there is no rotation left to configure.
 */

/** How long after arriving at a body before its event begins. */
export const EVENT_ARRIVAL_DELAY_SECONDS = 5;

const scratchVector = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchProjection = new THREE.Vector3();

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * The direction the camera lies in, expressed in the body's own local frame.
 *
 * Every event here is parented to the body it happens on, so it can pick where
 * on that body to happen. Left to chance, half of them happen on the far side
 * and the viewer sees nothing at all -- which for a one-second impact flash
 * means the event may as well not have fired. Nothing about *what* happens is
 * changed by this; only which face of the world it is staged on, which is the
 * same licence any photograph of these events was taken under.
 */
function localCameraDirection(target, camera, out) {
  if (!camera) return out.set(0, 0, 1);
  out.copy(camera.position);
  target.worldToLocal(out);
  if (out.lengthSq() < 1e-8) return out.set(0, 0, 1);
  return out.normalize();
}

/**
 * Which way the Sun is, in the target's own space.
 *
 * Needed because anything drawn *on* a planet has to agree with that planet
 * about where its day is, and the scene cannot be asked. The Sun is a point
 * light at the origin with physical falloff, but every planet's surface is a
 * shader that fakes its own illumination so that Neptune is not a black disc
 * -- so a normally-lit material laid on the surface is lit by the real inverse
 * square law while the surface beside it is not. On Jupiter that discrepancy
 * is small enough to miss. At Saturn, half again as far out and receiving less
 * than half the light, the same patch reads as a hole instead of a stain.
 *
 * Shading against this vector instead sidesteps the whole disagreement: the
 * mark is bright where the planet's day is and dark where its night is, on any
 * body, at any distance, whatever its shader is doing.
 */
function localSunDirection(target, out) {
  // The Sun sits at the world origin, so the direction to it from anywhere is
  // simply the negated world position.
  target.getWorldPosition(out);
  if (out.lengthSq() < 1e-8) return out.set(0, 0, 1);
  out.negate().normalize();
  target.getWorldQuaternion(scratchQuaternion);
  return out.applyQuaternion(scratchQuaternion.invert());
}

/*
 * Reading the planet's own surface map, to find out what is underneath a point.
 *
 * Used to aim a meteorite at land. Guessing a point and hoping is no good --
 * seven tenths of the sphere is ocean, so left to chance most strikes land in
 * water, where the whole event is a flash and then nothing. The map the planet
 * is already textured with knows exactly where the continents are, so it may
 * as well be asked.
 *
 * The UV convention has to match the one the geometry was built with. Three's
 * SphereGeometry runs its longitude from +X through +Z, and its texture origin
 * is the bottom-left while a canvas counts rows from the top, so the row is
 * flipped on the way in. Getting either of those backwards puts the strikes in
 * the sea off the wrong continent, which looks like nothing at all going wrong.
 *
 * Any failure here -- no map, a texture from another origin that taints the
 * canvas, a browser that refuses the read -- returns null and the caller falls
 * back to a point chosen without the check.
 */
let surfaceSampler = null;

function sampleSurfaceColour(target, direction, out) {
  const image = target?.material?.map?.image;
  if (!image || !image.width || !image.height) return null;
  try {
    if (!surfaceSampler) {
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      surfaceSampler = canvas.getContext("2d", { willReadFrequently: true });
      if (!surfaceSampler) return null;
    }
    const u = ((Math.atan2(direction.z, -direction.x) / (Math.PI * 2)) + 1) % 1;
    const v = 1 - Math.acos(THREE.MathUtils.clamp(direction.y, -1, 1)) / Math.PI;
    const x = THREE.MathUtils.clamp(Math.floor(u * image.width) - 4, 0, image.width - 8);
    const y = THREE.MathUtils.clamp(Math.floor((1 - v) * image.height) - 4, 0, image.height - 8);

    surfaceSampler.clearRect(0, 0, 8, 8);
    surfaceSampler.drawImage(image, x, y, 8, 8, 0, 0, 8, 8);
    const data = surfaceSampler.getImageData(0, 0, 8, 8).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      red += data[pixel];
      green += data[pixel + 1];
      blue += data[pixel + 2];
    }
    const pixels = data.length / 4;
    return out.setRGB(red / pixels / 255, green / pixels / 255, blue / pixels / 255);
  } catch (error) {
    // A cross-origin texture taints the canvas and the read throws.
    return null;
  }
}

const landProbe = new THREE.Color();
const landDirection = new THREE.Vector3();

/**
 * A point on the target that is land, in sunlight, in view, and on the face
 * the stream can actually reach.
 *
 * All four matter: land, so there is something for the strike to mark; lit and
 * in view, so the mark can be seen at all; and reachable, because a body on a
 * fixed heading cannot strike the far side of the world from it, and bending
 * one so it can is what made the strikes arrive from a different direction to
 * the rest of the shower.
 *
 * The four together used to be satisfiable only by luck, which is why the
 * reach test was dropped once. It holds now because the caller no longer picks
 * the stream direction at random -- see the note where it is chosen.
 */
function pickLandPoint(target, facing, sunward, stream, taken = []) {
  let fallback = null;
  let fallbackScore = -Infinity;
  for (let attempt = 0; attempt < 220; attempt += 1) {
    // Uniform on the sphere: an even spread in cos(latitude) rather than in
    // latitude, so candidates do not bunch at the poles.
    const height = Math.random() * 2 - 1;
    const around = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(Math.max(0, 1 - height * height));
    landDirection.set(ring * Math.cos(around), height, ring * Math.sin(around));

    const seen = landDirection.dot(facing);
    const lit = landDirection.dot(sunward);
    const reachable = landDirection.dot(stream);
    // Anything at all behind the world, or behind the stream, is no use.
    if (seen < 0.12 || reachable < 0.12) continue;
    /*
     * Not on top of a strike already placed. The lit, visible, land-bearing
     * part of a world can be a small target -- on Earth it is often one
     * continent -- and without this the whole swarm piles into the same few
     * hundred kilometres and reads as one event rather than several.
     */
    let crowded = false;
    for (let other = 0; other < taken.length; other += 1) {
      if (landDirection.dot(taken[other]) > 0.972) { crowded = true; break; }
    }
    if (crowded) continue;

    const colour = sampleSurfaceColour(target, landDirection, landProbe);
    // No map to consult: take the first geometrically valid point.
    if (!colour) return landDirection.clone();

    const landness = colour.r - colour.b;
    /*
     * Every candidate is scored, and the best one is kept whatever happens, so
     * this can only fail to find a site if the world is not on screen at all.
     *
     * The strict test below is what we want -- land, well lit, well in view --
     * but the three conditions together are sometimes satisfied by nothing.
     * Focus Earth from over its night side and there may be no sunlit
     * continent anywhere in the visible half. Returning nothing in that case
     * meant the event quietly produced no strikes, which is a worse answer
     * than a strike somewhere less than ideal: this is a shower over a whole
     * planet, and something arriving is the point of it.
     */
    const score = landness * 1.4 + Math.min(lit, 0.6)
      + Math.min(seen, 0.6) * 0.5 + Math.min(reachable, 0.6) * 0.5;
    if (!fallback || score > fallbackScore) {
      fallback = landDirection.clone();
      fallbackScore = score;
    }

    if (seen < 0.3 || lit < 0.2 || reachable < 0.3) continue;

    /*
     * Ocean is the one thing on a world map that is decisively blue. Land is
     * green, brown or tan -- red at least matching blue -- and ice is bright in
     * all three. Testing for "not ocean" rather than for any particular kind of
     * ground keeps this working on any body whose map has water on it.
     */
    const bright = (colour.r + colour.g + colour.b) / 3;
    if (colour.r >= colour.b * 0.95 || bright > 0.72) return landDirection.clone();
  }
  return fallback;
}

/**
 * A point on the hemisphere facing the camera, scattered but never behind.
 *
 * `spread` is how far off the sub-camera point it may wander, in radians.
 */
function facingPoint(facing, spread, out) {
  // Any vector not parallel to `facing` gives a usable pair of tangents.
  const helper = Math.abs(facing.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const tangentA = new THREE.Vector3().crossVectors(facing, helper).normalize();
  const tangentB = new THREE.Vector3().crossVectors(facing, tangentA).normalize();
  const angle = Math.random() * spread;
  const around = Math.random() * Math.PI * 2;
  return out.copy(facing).multiplyScalar(Math.cos(angle))
    .addScaledVector(tangentA, Math.sin(angle) * Math.cos(around))
    .addScaledVector(tangentB, Math.sin(angle) * Math.sin(around))
    .normalize();
}

/**
 * A point close to the visible limb, on the hemisphere facing the camera.
 *
 * `facingPoint` scatters anywhere between the sub-camera point and its spread,
 * which is right for something that should appear *somewhere* on the disc and
 * wrong for anything with height. A plume standing up out of the middle of the
 * disc is seen end-on -- the cone reads as a filled circle, which is precisely
 * how the Io eruption was landing -- and only against the black at the edge
 * does it read as a plume at all. So this stays in a narrow band near 90
 * degrees, where the silhouette is.
 */
/*
 * A patch that lies on a sphere, elliptical, ragged at the edge, and able to
 * be dragged downwind.
 *
 * The shock ring above draws a front; this draws an area, and the two things
 * an impact leaves behind are both areas. One is the light thrown across the
 * cloud decks in the instant of entry. The other is the stain: pulverised
 * asteroid mixed with the planet's own ripped-up gas, falling back out of the
 * plume and then smeared eastward by the jet streams until its edges blend
 * into the neighbouring bands. Neither is a circle for long, so the patch is
 * an ellipse that can be stretched along the wind and slid downstream of the
 * entry point, and its rim is perturbed per-segment so it never closes into a
 * drawn shape.
 *
 * The two uses need different materials, and the difference is the whole of
 * how the stain matches the planet.
 *
 * The glare is light, so it is unlit and additive: it can only brighten, which
 * is all light can do.
 *
 * The stain is *matter*, so it is lit. Multiply blending was tried for it
 * first, on the reasoning that multiplying darkens whatever colour is already
 * underneath and so matches the band for free -- and it came out as flat white
 * blobs in this renderer, which is a good reminder that a blend mode is a
 * promise the pipeline has to keep. Lighting it is the better answer anyway.
 * A standard material takes the same sunlight the cloud tops take, so a dark
 * warm patch is dim where the clouds are dim, black where the planet has
 * turned into night, and bright enough to read where the sun is on it -- which
 * is what "matches the region" actually means. Its softness comes from
 * per-vertex alpha, so the middle is opaque dust and the rim is nothing.
 */
const SURFACE_CAP_RINGS = 9;
const SURFACE_CAP_SEGMENTS = 44;

function createSurfaceCap(radius, normal, kind) {
  // East is the direction the winds run: the body spins about its own +Y, so
  // eastward at any point is the way the surface is already travelling.
  const spinAxis = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(spinAxis, normal);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(normal, east).normalize();

  const columns = SURFACE_CAP_SEGMENTS + 1;
  const vertexCount = (SURFACE_CAP_RINGS + 1) * columns;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  // Four components: the rim is carried in alpha for the stain and in the
  // colour itself for the additive glare, and one attribute layout serves both.
  const colors = new Float32Array(vertexCount * 4);

  const indices = [];
  for (let ring = 0; ring < SURFACE_CAP_RINGS; ring += 1) {
    for (let segment = 0; segment < SURFACE_CAP_SEGMENTS; segment += 1) {
      const here = ring * columns + segment;
      const next = (ring + 1) * columns + segment;
      indices.push(here, next, here + 1, here + 1, next, next + 1);
    }
  }

  /*
   * A ragged rim, fixed once. Turbulence does not repaint itself every frame
   * and neither should this: the same perturbation carried through the life of
   * the patch is what makes it read as one cloud being stretched rather than
   * as noise. Neighbouring segments are averaged so the outline undulates
   * instead of buzzing.
   */
  const rough = new Float32Array(columns);
  for (let segment = 0; segment < columns; segment += 1) {
    rough[segment] = 0.68 + Math.random() * 0.64;
  }
  rough[SURFACE_CAP_SEGMENTS] = rough[0];
  for (let pass = 0; pass < 2; pass += 1) {
    const previous = rough.slice();
    for (let segment = 0; segment < SURFACE_CAP_SEGMENTS; segment += 1) {
      const before = previous[(segment - 1 + SURFACE_CAP_SEGMENTS) % SURFACE_CAP_SEGMENTS];
      const after = previous[(segment + 1) % SURFACE_CAP_SEGMENTS];
      rough[segment] = (before + previous[segment] * 2 + after) * 0.25;
    }
    rough[SURFACE_CAP_SEGMENTS] = rough[0];
  }

  /*
   * The trigonometry round the rim, taken once.
   *
   * These are fixed by the mesh layout -- they do not depend on how big the
   * patch currently is -- yet the straightforward loop recomputed a sine and a
   * cosine for all four hundred and fifty vertices on every frame, and a
   * planetary impact runs ten of these patches at once. Held in a table they
   * cost nothing and the per-frame loop is left with arithmetic only.
   */
  const capCos = new Float32Array(columns);
  const capSin = new Float32Array(columns);
  for (let segment = 0; segment < columns; segment += 1) {
    const around = (segment / SURFACE_CAP_SEGMENTS) * Math.PI * 2;
    capCos[segment] = Math.cos(around);
    capSin[segment] = Math.sin(around);
  }
  // The ellipse radius depends on the segment and on this frame's half-widths,
  // but not on the ring -- so it is worked out once per ring loop, not nine
  // times over.
  const capEllipse = new Float32Array(columns);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.setIndex(indices);

  const lit = kind === "stain";
  const material = lit
    ? new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
    })
    : new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      // Front faces only. Double-siding draws the half of the patch that has
      // wrapped over the limb as well, and additive blending then sums the two
      // along the join -- a bright seam that slides about as the viewer turns.
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

  hugSurface(material);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  // Above the opaque planet in the transparent queue, and under the fireball.
  mesh.renderOrder = lit ? 1 : 2;

  const centre = new THREE.Vector3();
  const alongAxis = new THREE.Vector3();

  return {
    mesh,
    material,
    /*
     * `along` and across are the half-widths of the ellipse in radians at
     * the centre of the body -- along the wind and across it. `drift` slides
     * the whole patch that many radians downwind. `level` is how much of the
     * effect is present at the middle, and it falls to none at the rim.
     */
    set(along, across, drift, colour, level, falloff = 1.6, sun = null, view = null) {
      if (level <= 0.002 || along <= 0) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;

      // Slide the patch downwind by rotating its centre about the north axis,
      // carrying the east vector round with it so the ellipse stays square to
      // the wind wherever it has got to.
      centre.copy(normal).multiplyScalar(Math.cos(drift))
        .addScaledVector(east, Math.sin(drift));
      alongAxis.copy(east).multiplyScalar(Math.cos(drift))
        .addScaledVector(normal, -Math.sin(drift));

      const attribute = geometry.getAttribute("position");
      const facing = geometry.getAttribute("normal");
      const tint = geometry.getAttribute("color");
      const shell = radius * 1.0025;

      // Unpacked once. Reading .x off a vector object inside a four-hundred
      // iteration loop is not free, and there are ten of these loops running
      // during an impact.
      const cx = centre.x; const cy = centre.y; const cz = centre.z;
      const ax = alongAxis.x; const ay = alongAxis.y; const az = alongAxis.z;
      const nx = north.x; const ny = north.y; const nz = north.z;
      const viewX = view ? view.x : 0;
      const viewY = view ? view.y : 0;
      const viewZ = view ? view.z : 0;
      const sunX = sun ? sun.x : 0;
      const sunY = sun ? sun.y : 0;
      const sunZ = sun ? sun.z : 0;
      const colourR = colour.r; const colourG = colour.g; const colourB = colour.b;

      for (let segment = 0; segment <= SURFACE_CAP_SEGMENTS; segment += 1) {
        // Polar form of the ellipse. Constant down a column, so it belongs
        // here rather than nine rings deep.
        const wide = across * capCos[segment];
        const tall = along * capSin[segment];
        capEllipse[segment] = (along * across)
          / Math.sqrt(wide * wide + tall * tall + 1e-9);
      }

      for (let ring = 0; ring <= SURFACE_CAP_RINGS; ring += 1) {
        const step = ring / SURFACE_CAP_RINGS;
        const strength = level * Math.pow(1 - step, falloff);
        const base = ring * columns;
        for (let segment = 0; segment <= SURFACE_CAP_SEGMENTS; segment += 1) {
          const cosAround = capCos[segment];
          const sinAround = capSin[segment];
          // Roughened at the rim and left clean at the middle, so the centre
          // of the stain stays put.
          const ragged = 1 + (rough[segment] - 1) * step;
          const angle = capEllipse[segment] * step * ragged;
          const cosAngle = Math.cos(angle);
          const sinAngle = Math.sin(angle);
          const alongTerm = sinAngle * cosAround;
          const northTerm = sinAngle * sinAround;

          const px = cx * cosAngle + ax * alongTerm + nx * northTerm;
          const py = cy * cosAngle + ay * alongTerm + ny * northTerm;
          const pz = cz * cosAngle + az * alongTerm + nz * northTerm;

          const slot = base + segment;
          const at3 = slot * 3;
          normals[at3] = px; normals[at3 + 1] = py; normals[at3 + 2] = pz;
          positions[at3] = px * shell;
          positions[at3 + 1] = py * shell;
          positions[at3 + 2] = pz * shell;

          /*
           * Fade out towards the horizon, and this is not decoration.
           *
           * A patch lying on a sphere runs out of sphere at the limb, and the
           * planet's depth buffer is what decides exactly where. Two curved
           * surfaces a quarter of a percent apart, one of them a coarse
           * polygon fan, disagree about that boundary from pixel to pixel --
           * so the edge crawls and shimmers as the viewer orbits, which is
           * what this event kept being reported for. Dissolving the patch
           * before it reaches the horizon leaves no boundary to argue about.
           * It is also what the light does anyway: a mark seen at a grazing
           * angle is foreshortened into nothing.
           */
          const horizon = view
            ? smoothstep(0.04, 0.34, px * viewX + py * viewY + pz * viewZ)
            : 1;

          const at4 = slot * 4;
          if (lit) {
            /*
             * Day and night worked out here rather than left to the renderer,
             * for the reason given on `localSunDirection`. A little ambient so
             * the unlit half is dark rather than absent -- the night side of a
             * gas giant is not actually black, and a scar that vanished at the
             * terminator would draw the eye to the seam.
             */
            const day = sun
              ? Math.max(0, px * sunX + py * sunY + pz * sunZ)
              : 1;
            const shade = 0.09 + 0.91 * day;
            colors[at4] = colourR * shade;
            colors[at4 + 1] = colourG * shade;
            colors[at4 + 2] = colourB * shade;
            colors[at4 + 3] = strength * horizon;
          } else {
            const mix = strength * horizon;
            colors[at4] = colourR * mix;
            colors[at4 + 1] = colourG * mix;
            colors[at4 + 2] = colourB * mix;
            colors[at4 + 3] = 1;
          }
        }
      }

      attribute.needsUpdate = true;
      facing.needsUpdate = true;
      tint.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

function limbPoint(facing, out) {
  const helper = Math.abs(facing.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const tangentA = new THREE.Vector3().crossVectors(facing, helper).normalize();
  const tangentB = new THREE.Vector3().crossVectors(facing, tangentA).normalize();
  const angle = THREE.MathUtils.degToRad(74 + Math.random() * 12);
  const around = Math.random() * Math.PI * 2;
  return out.copy(facing).multiplyScalar(Math.cos(angle))
    .addScaledVector(tangentA, Math.sin(angle) * Math.cos(around))
    .addScaledVector(tangentB, Math.sin(angle) * Math.sin(around))
    .normalize();
}

/** A soft round sprite texture, shared by every glow this module draws. */
let sharedGlowTexture = null;
function getGlowTexture() {
  if (sharedGlowTexture) return sharedGlowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.72)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.16)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sharedGlowTexture = new THREE.CanvasTexture(canvas);
  sharedGlowTexture.name = "Event glow";
  return sharedGlowTexture;
}

let sharedSoftTexture = null;
/*
 * The same idea with the hot middle taken out, for particles that are meant to
 * add up into a volume rather than to be seen one at a time.
 *
 * The glow texture above is a point of light: nearly all its brightness is in
 * the middle fifth of it, which is right for a spark and wrong for a cloud.
 * Hundreds of those at low opacity render as hundreds of tiny bright pips with
 * invisible haloes between them -- the plume came out as glitter -- and turned
 * up bright enough for the haloes to show, the pips clip and it becomes a
 * solid white slab instead. There is no setting between the two, because the
 * problem is the texture and not the brightness. A broad, flat falloff has no
 * pip to give away and overlaps its neighbours all the way in, so the sum of
 * many of them is smooth at any strength.
 */
function getSoftTexture() {
  if (sharedSoftTexture) return sharedSoftTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.36, "rgba(255,255,255,0.34)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.11)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sharedSoftTexture = new THREE.CanvasTexture(canvas);
  sharedSoftTexture.name = "Event haze";
  return sharedSoftTexture;
}

/*
 * The body's radius **in the space the event is being built in**.
 *
 * This is the single most consequential line in the file, and it was wrong.
 *
 * The scene builds its bodies two different ways. Planets carry their real
 * radius in the geometry and sit at scale 1, so `visualRadius` is a local
 * measurement and everything worked. Moons are unit spheres *scaled* to size --
 * Io's mesh is a radius-1 sphere at scale 0.4187 -- and an event added as a
 * child of that mesh inherits the scale. Sizing it by `visualRadius` therefore
 * placed everything at `visualRadius squared`: Io's vent, meant to sit on the
 * surface at 0.419, was drawn at 0.175, which is a long way *inside* the moon.
 *
 * That is why the Io plume was invisible, and it was silently doing the same to
 * the Enceladus jets and the Triton geysers. Dividing by the inherited scale
 * gives 7.4 for Jupiter, unchanged, and 1.0 for Io, correct.
 *
 * The body's *own* scale, though, and emphatically not its world scale.
 *
 * They are the same number for every body but one. The Sun is not drawn at a
 * fixed size: `updateSunApparentScale` rescales the whole solar group every
 * frame so the star keeps its true angular size from wherever the viewer is,
 * and pulling back from a focused Sun deliberately takes it down to 18% of the
 * model. That factor is in the world scale and has nothing to do with how the
 * body was built.
 *
 * Dividing by it baked whatever the star happened to be doing at the instant
 * the event was constructed into the event's size, permanently. Start a coronal
 * mass ejection and zoom out while it counts down, and it is built at, say,
 * 0.78: every distance in it comes out 1/0.78 too large, the shell that should
 * span 6.2 solar radii spans 7.9, and the eruption's foot -- which the shader
 * places at a fixed *fraction* of that shell -- ends up a third of a radius
 * above the photosphere, with clear sky underneath it. Measured: built at 1.0
 * the emission reaches the limb; built at 0.78 the innermost light is at 1.38
 * radii and there is nothing below it; built at 0.3 the eruption is twenty
 * radii out and not visible at all.
 *
 * The own scale is the one that describes construction, so it is the one that
 * converts to the host's local units. Anything the scene does to an ancestor
 * afterwards then moves the event and the body together, which is the whole
 * point of it being a child.
 */
function localRadius(target) {
  const radius = Number(target?.userData?.visualRadius) || 1;
  if (!target) return radius;
  const scale = Math.max(1e-6, Math.abs(target.scale.x));
  return radius / scale;
}

/**
 * A glow that sits on a world without being cut by it.
 *
 * Every billboard in these events is a camera-facing quad, and every one of
 * them is placed on or just above a sphere. Those two facts do not get on: the
 * quad faces the viewer, the surface under it curves away, and wherever the
 * two intersect the planet's depth buffer slices the quad along a straight
 * line. The result is a hard-edged wedge that swings around as the viewer
 * orbits -- and it is worst exactly where an impact is most likely to be
 * interesting, near the limb, where the surface is nearly edge-on and half the
 * quad is behind it. On a bright banded planet it hides in the clouds; on
 * Saturn's dark, low-contrast disc it is the most obvious thing on screen.
 *
 * Lifting the sprite clear of the surface does not fix it, because the size
 * needed to clear a grazing surface is large enough that the glow visibly
 * floats when seen face-on. So depth testing is switched off instead, and the
 * one thing that buys -- a flash on the far side of the world shining through
 * it -- is handled honestly by the caller, which fades each one out as its
 * site turns past the limb.
 */
function makeSurfaceGlow(colour, opacity = 1) {
  const sprite = makeGlow(colour, opacity);
  sprite.material.depthTest = false;
  sprite.renderOrder = 4;
  return sprite;
}

function makeGlow(colour, opacity = 1) {
  const material = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: colour,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  return new THREE.Sprite(material);
}

/* ------------------------------------------------------------------ events */

/**
 * A planet pulls in a swarm of rocks, and they come from everywhere.
 *
 * Amateur astronomers have caught Jupiter impacts repeatedly -- 2010 twice,
 * then 2012, 2016, 2017, 2019, 2021, 2022 -- and the pattern is always the
 * same: a rock or comet fragment of order five to twenty metres arrives at
 * close to sixty kilometres a second, and the entire encounter is over in
 * about one to two seconds. There is no crater and no debris. The object never
 * reaches a surface, because Jupiter has not got one; it detonates in the
 * upper atmosphere as a bolide, and what is seen from Earth is that flash.
 *
 * **Why several, and from different sides.** The first version staged one
 * rock, and one rock is a misleading picture of what a gas giant does. Jupiter
 * has three hundred and eighteen Earth masses of gravity sitting at the inner
 * edge of the asteroid belt, and everything that comes near it is bent toward
 * it -- from every direction at once, because the objects it accretes are on
 * every kind of orbit: main-belt strays kicked out by the 3:1 Kirkwood
 * resonance, Jupiter-family comets, Trojans knocked off their libration
 * points, and Centaurs falling in from beyond Saturn. Estimates from the
 * observed flash rate put objects this size hitting Jupiter tens of times a
 * year. A swarm arriving on unrelated trajectories is the honest picture; a
 * single rock on a single line is not.
 *
 * So this builds three to five of them, each with its own entry point on the
 * facing hemisphere, its own approach direction, its own size, and its own
 * arrival time -- staggered, so they land as a sequence rather than a volley.
 * They are genuinely independent: the direction each one comes in from is
 * sampled around the full circle of approach azimuths, not jittered off a
 * shared line.
 *
 * The builder is generic in its target, because the physics is. Saturn accretes
 * the same way for the same reason, and the only thing that changes is which
 * planet the flash is on.
 */
function createImpactSwarm(target, camera) {
  const group = new THREE.Group();
  group.name = "Impact swarm event";
  const radius = localRadius(target);
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * A basis on the plane perpendicular to the camera direction. Approach
   * azimuths are measured in this plane, which is what makes "from different
   * directions" mean something on screen rather than only in world space --
   * spreading the arrivals around a circle the viewer is looking down would
   * put them all on top of each other.
   */
  const helper = Math.abs(facing.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const screenRight = new THREE.Vector3().crossVectors(facing, helper).normalize();
  const screenUp = new THREE.Vector3().crossVectors(facing, screenRight).normalize();

  /*
   * Where on the world to stage the strikes: somewhere the viewer can see AND
   * the Sun can reach.
   *
   * Staging them on the hemisphere facing the camera is not enough, and Saturn
   * is what proved it. Focusing Jupiter puts the camera at a phase angle of
   * about +0.9 -- almost straight down the sunbeam, so the visible face is the
   * lit one and everything an impact leaves shows up on it. Focusing Saturn
   * puts the camera at -0.58, well round onto the night side. The same code
   * then staged every strike on a face in darkness: the fireball and the plume
   * still read, because they make their own light, but the dust scar had
   * nothing to be seen against and the event looked like a different, poorer
   * one.
   *
   * The bisector of the two directions is the fix and it needs no special
   * cases. When camera and Sun agree it is the camera direction, so nothing
   * about Jupiter changes. When they disagree it splits the difference, which
   * is the crescent near the terminator -- the same place a photographer would
   * choose, and the place where a low relief like a dust deposit shows best
   * anyway. Only where the camera is directly behind the world does it have
   * nothing to work with, and then it falls back to the visible face.
   */
  const sunward = localSunDirection(target, new THREE.Vector3());
  const staging = new THREE.Vector3().addVectors(facing, sunward);
  if (staging.lengthSq() < 0.04) staging.copy(facing); else staging.normalize();

  // The screen axes, re-squared against the staging direction, so arrivals
  // still spread left-right and up-down as the viewer sees it.
  const stageRight = screenRight.clone()
    .addScaledVector(staging, -screenRight.dot(staging));
  if (stageRight.lengthSq() < 1e-6) stageRight.copy(screenUp);
  stageRight.normalize();
  const stageUp = screenUp.clone()
    .addScaledVector(staging, -screenUp.dot(staging))
    .addScaledVector(stageRight, -screenUp.dot(stageRight))
    .normalize();

  /*
   * What an impact on a gas giant actually does, in the order it does it.
   *
   * This was built twice before and both attempts drew the wrong thing. The
   * first put a white billboard on the planet, which read as a lamp stuck to
   * the surface. The second drew clean expanding rings, and rings are the one
   * shape this event does not make: a stone dropped in a pond spreads a wave
   * across a surface, but a body arriving at sixty kilometres a second goes
   * *down* into an atmosphere and the explosion comes back *up*.
   *
   * The sequence the 1994 and 2009 impacts actually showed is three things:
   *
   *   1. A fireball. The fragment does not burn, it vaporises -- a blinding
   *      white pinprick high in the stratosphere, throwing light across the
   *      cloud decks around it for a second or so.
   *   2. A plume, and it is a mushroom, not a ripple. The blast drives
   *      superheated gas and pulverised rock up and out of the atmosphere on
   *      a narrow stem that fans into a cap at the top, and then the whole
   *      thing falls back.
   *   3. The stain it leaves. What comes down is asteroid dust mixed with the
   *      planet's own dredged-up sulphur and ammonia compounds, and it settles
   *      as a dark warm blanket over the site -- and then Jupiter's jet
   *      streams get hold of it, stretch it east, and shear its edges into the
   *      neighbouring bands. This is the part that lasts, and it is the part
   *      every photograph of these events is actually of.
   *
   * The real ripples are there too, but they are thermal gravity waves in the
   * stratosphere: infrared cameras see them as faint concentric warmth, and
   * the eye sees nothing. They are drawn here at about the strength that
   * deserves -- present, barely.
   */
  const count = 3 + Math.floor(Math.random() * 3);
  // Azimuths are handed out one per equal sector with a jitter inside it, so
  // the swarm cannot cluster on one side by accident -- which random sampling
  // of five directions does about a third of the time.
  const sector = (Math.PI * 2) / count;
  const azimuthOffset = Math.random() * Math.PI * 2;

  /*
   * Grains of ejecta per plume. The stem and the cap are the same population;
   * the cap is simply where the arcs run out of upward speed. Ninety of them
   * was the first guess and it read as a sprinkle of white dots -- a mushroom
   * only appears once there are enough arcs for their envelope to be the thing
   * you see rather than the individual grains, and the grains have to be drawn
   * large enough that their glows overlap into one body of gas.
   *
   * Worth saying what this can and cannot show: the mushroom is only a
   * mushroom from the side. Most of these strikes land somewhere on the disc
   * facing the viewer, and a column seen end-on is a disc however it is drawn.
   * What has to read from every angle is that a large volume of lit gas has
   * been thrown out of the atmosphere and is falling back -- the silhouette is
   * a bonus for the ones that happen to land near the limb.
   */
  const PLUME_GRAINS = 520;

  const impactors = [];
  for (let index = 0; index < count; index += 1) {
    const azimuth = azimuthOffset + sector * index + (Math.random() - 0.5) * sector * 0.65;
    // Sizes follow the real size distribution: small ones are far commoner,
    // so a power skews the draw toward the faint end and the occasional
    // bigger one lands with visibly more energy.
    const mass = Math.pow(Math.random(), 1.9);
    const scale = 0.55 + mass * 1.15;

    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 0.020 * scale, 1),
      new THREE.MeshStandardMaterial({ color: 0x6b5a4c, roughness: 1, metalness: 0 }),
    );
    group.add(rock);

    // Entry heating: the object is already glowing long before it arrives.
    const bolide = makeSurfaceGlow(0xffd8a0, 0);
    group.add(bolide);

    /*
     * The fireball, in two temperatures. The core is the vaporising fragment
     * itself, briefly near white; around it is the heated gas, which is amber.
     * Drawing only the core is what made an earlier pass look like a lamp
     * switching on rather than something detonating.
     */
    const core = makeSurfaceGlow(0xfff6e2, 0);
    group.add(core);
    const bloom = makeSurfaceGlow(0xff9330, 0);
    group.add(bloom);

    /*
     * Where it comes in, and from how far.
     *
     * Both numbers are set by what the frame can hold rather than by the
     * physics, and the physics does not mind. When a viewer is inspecting
     * Jupiter the visible half-height is about one planetary radius: an
     * approach starting nine radii out is off screen for its whole length, and
     * all that arrives is a flash with no cause. So each run-in starts just
     * outside the frame edge, on its own azimuth.
     */
    /*
     * How far round from the middle of the lit face this one lands.
     *
     * The shot now stands sunward of the planet, so the staging direction and
     * the day side are the same place and most of the swarm arrives where the
     * light is -- which is what makes the scar and the plume's shadow readable
     * at all. But a swarm that only ever hits the middle of the disc reads as
     * aimed. Every third one is sent out to the terminator instead, where it
     * detonates against the darkened limb: no scar to see there, just the
     * fireball and the plume rising into sunlight above a surface still in
     * night. Both of Jupiter's watched impact seasons produced exactly that
     * shot, and it is the more dramatic of the two.
     */
    const atTerminator = index % 3 === 2;
    const offAxis = THREE.MathUtils.degToRad(
      atTerminator ? 72 + Math.random() * 18 : 18 + Math.random() * 34,
    );
    const entry = new THREE.Vector3()
      .copy(staging).multiplyScalar(Math.cos(offAxis))
      .addScaledVector(stageRight, Math.sin(offAxis) * Math.cos(azimuth))
      .addScaledVector(stageUp, Math.sin(offAxis) * Math.sin(azimuth))
      .normalize()
      .multiplyScalar(radius * 1.01);

    // Out along the entry normal, then thrown around its own azimuth so each
    // path visibly bends in from its own side of the frame.
    const start = entry.clone().normalize().multiplyScalar(radius * (2.1 + Math.random() * 0.7));
    start.addScaledVector(screenRight, Math.cos(azimuth) * radius * (1.3 + Math.random() * 0.8));
    start.addScaledVector(screenUp, Math.sin(azimuth) * radius * (1.3 + Math.random() * 0.8));

    /*
     * The surface normal at the entry point, kept in the target's own space.
     *
     * Everything the strike draws is placed along this: the fireball, the
     * light it throws, the plume, the stain, and the axis the thermal waves
     * spread about. It is worth storing rather than deriving each time,
     * because an earlier pass turned the shock with `lookAt(0, 0, 0)` and that
     * is wrong in a way that is easy to miss: `lookAt` takes a *world*
     * position, so it asked every ring to face the world origin -- the Sun,
     * five au away -- instead of the centre of the planet it was lying on.
     */
    const normal = entry.clone().normalize();

    /*
     * The light the fireball throws across the cloud decks around it. Additive,
     * so its neutral is black and it can only brighten -- which is all light
     * can do.
     */
    const glare = createSurfaceCap(radius, normal, "light");
    group.add(glare.mesh);

    /*
     * The stain, and it is multiplied rather than painted. See the note on
     * `createSurfaceCap`: multiplying is what makes it come out as a darker
     * version of whichever band it happens to have landed on, instead of a
     * colour chosen in advance that only matches one part of the planet.
     */
    const stain = createSurfaceCap(radius, normal, "stain");
    group.add(stain.mesh);

    /*
     * The plume. A basis on the surface at the entry point, so the ejecta can
     * be thrown out along real directions rather than random ones.
     */
    const plumeHelper = Math.abs(normal.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const plumeA = new THREE.Vector3().crossVectors(normal, plumeHelper).normalize();
    const plumeB = new THREE.Vector3().crossVectors(normal, plumeA).normalize();

    const plumePositions = new Float32Array(PLUME_GRAINS * 3);
    const plumeColors = new Float32Array(PLUME_GRAINS * 3);
    const plumeGeometry = new THREE.BufferGeometry();
    plumeGeometry.setAttribute("position", new THREE.BufferAttribute(plumePositions, 3));
    plumeGeometry.setAttribute("color", new THREE.BufferAttribute(plumeColors, 3));
    const plumeMaterial = new THREE.PointsMaterial({
      map: getSoftTexture(),
      vertexColors: true,
      size: radius * 0.045 * scale,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const plume = new THREE.Points(plumeGeometry, plumeMaterial);
    plume.frustumCulled = false;
    group.add(plume);

    const grains = [];
    for (let grain = 0; grain < PLUME_GRAINS; grain += 1) {
      const around = Math.random() * Math.PI * 2;
      grains.push({
        tangential: new THREE.Vector3()
          .addScaledVector(plumeA, Math.cos(around))
          .addScaledVector(plumeB, Math.sin(around)),
        // Skewed toward the fast end: the stem is what most of the material is
        // in, and only the fastest of it gets high enough to make the cap.
        speed: 0.45 + Math.pow(Math.random(), 0.6) * 0.75,
        fan: 0.25 + Math.random() * 0.85,
        /*
         * How far off the axis this grain sits for the whole of its flight.
         *
         * Without it the column has no width at all: every grain leaves along
         * the same surface normal and differs only in how high it has got, so
         * the stem draws as a single line of overlapping sprites -- a hard
         * white bar with rounded ends, which is what the first version of this
         * put on the planet. The square root spreads the grains evenly over
         * the *area* of the vent rather than over its radius, so the column is
         * filled instead of hollow.
         */
        stem: Math.sqrt(Math.random()),
        lead: Math.random() * 0.22,
        glow: 0.5 + Math.random() * 0.45,
      });
    }

    impactors.push({
      rock, bolide, core, bloom, glare, stain,
      plume, plumeGeometry, plumeMaterial, grains,
      entry, start, scale, normal,
      /*
       * Staggered arrivals across the middle of the event, so the swarm reads
       * as a sequence of separate strikes. Spread over a window rather than
       * evenly spaced, because these objects are not related to each other and
       * arriving on a beat would say that they were.
       */
      arriveAt: 0.30 + (index / count) * 0.34 + Math.random() * 0.08,
      // Each one gets its own bend, so no two paths are parallel.
      bend: (0.28 + Math.random() * 0.34) * (Math.random() < 0.5 ? -1 : 1),
      spin: 0.06 + Math.random() * 0.10,
      // Which way the local jet stream runs. Jupiter's alternate band by band,
      // so neighbouring strikes can smear opposite ways -- which is exactly
      // what makes the planet look like it has weather.
      shear: (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.6),
    });
  }

  const ejecta = new THREE.Vector3();
  const sunLocal = new THREE.Vector3();
  const cameraLocal = new THREE.Vector3();
  const plumeHot = new THREE.Color(0xffd9a2);
  const plumeCold = new THREE.Color(0x6b4326);
  const glareColour = new THREE.Color(0xffc07a);
  /*
   * Charcoal-brown, and warm rather than grey. What settles is asteroid dust
   * mixed with the sulphur and ammonia compounds the blast dredged up out of
   * the deeper atmosphere, and every photograph of the 1994 and 2009 scars
   * shows the same thing: not black, not neutral, but a dark tan sitting a few
   * shades under the belt it landed in.
   */
  const stainColour = new THREE.Color(0x4e321f);
  const darkness = new THREE.Color();

  return {
    group,
    duration: 15,
    update(progress) {
      localSunDirection(target, sunLocal);
      // Recomputed every frame rather than reused from build time, because the
      // world turns underneath these and a site drifts round the limb while
      // the event is still running.
      localCameraDirection(target, camera, cameraLocal);

      for (let index = 0; index < impactors.length; index += 1) {
        const item = impactors[index];
        const { arriveAt } = item;
        const since = progress - arriveAt;

        /*
         * How much of this strike the viewer can see. The billboards below do
         * not depth-test -- see `makeSurfaceGlow` -- so nothing stops them
         * shining straight through the planet, and this is what does instead.
         * It goes to nothing just past the limb, which is both where the world
         * would have hidden the flash anyway and where a light source lying
         * flat to the line of sight has stopped contributing much.
         */
        const inView = smoothstep(-0.06, 0.16, item.normal.dot(cameraLocal));

        // Each impactor runs its own clock: it falls for the whole span up to
        // its own arrival, then flashes and fades on its own schedule.
        const approach = THREE.MathUtils.clamp(progress / arriveAt, 0, 1);
        // Gravity does not pull linearly. The last tenth of the fall is most
        // of the speed, so the eased curve is what makes it read as being
        // *pulled* rather than flown in.
        const fall = Math.pow(approach, 2.6);
        item.rock.position.lerpVectors(item.start, item.entry, fall);
        const arc = Math.sin(approach * Math.PI) * radius * item.bend;
        item.rock.position.addScaledVector(screenRight, arc * 0.7);
        item.rock.position.addScaledVector(screenUp, arc);
        item.rock.rotation.x += item.spin;
        item.rock.rotation.y += item.spin * 1.4;
        item.rock.visible = progress < arriveAt;

        /*
         * Entry heating: it begins in the last stretch of the fall, where the
         * atmosphere is, and it ends when the body does.
         *
         * That second half was missing and it is the whole of a bug worth
         * writing down. `smoothstep` saturates at one and stays there, so
         * every bolide glow stayed at full brightness for the rest of the
         * event -- parked at the entry point, which is barely a hundredth of a
         * radius above the cloud tops. A camera-facing sprite that size is
         * mostly *below* the surface it is sitting on, so the planet's own
         * depth buffer cut it into a hard-edged wedge that swung about as the
         * viewer orbited. Four of them per swarm, bright orange, on a dark
         * planet: reported, entirely reasonably, as heavy distortion around
         * the impact. There is no glowing body after the arrival because there
         * is no body, so it goes out.
         */
        const heating = since < 0
          ? smoothstep(arriveAt * 0.68, arriveAt, progress)
          : Math.max(0, 1 - since / 0.03);
        item.bolide.position.copy(item.rock.position);
        item.bolide.material.opacity = heating * 0.9 * inView;
        item.bolide.visible = heating * inView > 0.01;
        item.bolide.scale.setScalar(radius * (0.008 + heating * 0.030) * item.scale);

        /*
         * PHASE 1 -- the fireball.
         *
         * Very short and very bright. A metre-scale body arriving at sixty
         * kilometres a second deposits its whole kinetic energy in under a
         * second, and the recordings show a spike, not a burn: it is at full
         * brightness in one frame and gone within twenty. Everything else in
         * this event is a consequence of that instant.
         */
        const flare = since < 0 ? 0 : Math.max(0, 1 - since / 0.05);
        const coreSize = radius * (0.006 + flare * 0.048 * item.scale);
        item.core.scale.setScalar(coreSize);
        item.core.position.copy(item.normal).multiplyScalar(radius + coreSize * 0.5);
        item.core.material.opacity = Math.pow(flare, 0.4) * inView;

        // The heated gas around it: broader, cooler, and it outlives the core.
        const bloomFade = since < 0 ? 0 : Math.max(0, 1 - since / 0.14);
        const bloomSize = radius * (0.014 + bloomFade * 0.11 * item.scale);
        item.bloom.scale.setScalar(bloomSize);
        item.bloom.position.copy(item.normal).multiplyScalar(radius + bloomSize * 0.5);
        item.bloom.material.opacity = Math.pow(bloomFade, 1.4) * 0.8 * inView;

        // ...and the light it throws over the cloud decks around it. Wide,
        // soft, and gone with the fireball that cast it.
        const glareLevel = Math.pow(bloomFade, 1.8) * 0.5;
        item.glare.set(
          THREE.MathUtils.degToRad(13 * item.scale),
          THREE.MathUtils.degToRad(11 * item.scale),
          0,
          glareColour, glareLevel, 2.1, null, cameraLocal,
        );

        /*
         * PHASE 2 -- the plume.
         *
         * Ballistic, because above the cloud tops there is nothing to hold the
         * ejecta up: everything thrown out of the blast is on an arc, and the
         * mushroom is what the envelope of those arcs looks like. The stem
         * comes from launching almost straight up; the cap comes from the fan
         * being held back until each grain is near the top of its climb, so
         * material spreads sideways only where it has run out of lift. That
         * delay is the whole difference between a mushroom and an umbrella.
         */
        const plumeAge = since < 0 ? -1 : since / 0.30;
        if (plumeAge < 0 || plumeAge > 1) {
          item.plume.visible = false;
        } else {
          item.plume.visible = true;
          const apex = radius * 0.17 * item.scale;
          const position = item.plumeGeometry.getAttribute("position");
          const tint = item.plumeGeometry.getAttribute("color");

          for (let grain = 0; grain < item.grains.length; grain += 1) {
            const spec = item.grains[grain];
            // Grains do not all leave at once: the blast keeps venting for a
            // moment, so each has its own head start.
            const flight = THREE.MathUtils.clamp((plumeAge - spec.lead) / (1 - spec.lead), 0, 1);
            const climb = 4 * flight * (1 - flight);
            const height = apex * spec.speed * climb;
            const fan = THREE.MathUtils.degToRad(2.4 * item.scale) * spec.stem
              + THREE.MathUtils.degToRad(13 * item.scale) * spec.fan
                * smoothstep(0.26, 0.98, flight);

            ejecta.copy(item.normal).multiplyScalar(Math.cos(fan))
              .addScaledVector(spec.tangential, Math.sin(fan))
              .multiplyScalar(radius + height);
            position.setXYZ(grain, ejecta.x, ejecta.y, ejecta.z);

            /*
             * Superheated on the way up and cold dust on the way down, which
             * is both what happens and what tells the eye which half of the
             * arc it is looking at. The falling material is dim on purpose --
             * it is about to become the stain, and it should hand over rather
             * than compete.
             */
            const cooling = smoothstep(0.45, 0.95, flight);
            darkness.copy(plumeHot).lerp(plumeCold, cooling);
            const level = spec.glow * Math.sin(Math.min(1, flight * 1.05) * Math.PI) ** 0.7;
            tint.setXYZ(grain, darkness.r * level, darkness.g * level, darkness.b * level);
          }

          position.needsUpdate = true;
          tint.needsUpdate = true;
          /*
           * Faint per grain, because there are hundreds of them and additive
           * blending adds. At the brightness a ninety-grain plume needed, five
           * hundred overlapping glows clip to solid white and the plume comes
           * out as a hard-edged capsule -- a bar of light, not a cloud. The
           * total is what should be bright; each grain is a fraction of it.
           */
          item.plumeMaterial.opacity = (1 - Math.pow(plumeAge, 3)) * 0.62;
        }

        /*
         * PHASE 3 -- the stain, and the winds getting hold of it.
         *
         * It appears as the plume starts to fall, grows while the material is
         * still coming down, and from then on is the planet's to do with as it
         * likes: stretched along the jet stream far faster than it spreads
         * across it, and carried downstream of the point it fell on. By the
         * end of the event it is a smear lying in the band rather than a mark
         * on top of one, which is how every real one of these has ended up.
         */
        const settling = smoothstep(0.06, 0.34, since);
        const spreading = smoothstep(0.06, 1.15, since);
        if (settling > 0.001) {
          const stretch = THREE.MathUtils.degToRad(3.0 + spreading * 11 * item.scale);
          const width = THREE.MathUtils.degToRad(2.4 + spreading * 2.6 * item.scale);
          const carried = THREE.MathUtils.degToRad(spreading * 6) * item.shear;
          /*
           * Darkest as it lands and slowly thinning after, because the same
           * quantity of dust spread over a growing area has to get fainter.
           * That is also why it never quite goes: the smear is still there
           * when the event ends, exactly as Jupiter's were for months.
           */
          const depth = settling * (1 - spreading * 0.18);
          // A gentle falloff, so the middle is a solid deposit and only the
          // outermost tenth of it feathers away. A steep one spreads the same
          // dust so thin that the scar reads as a smudge on the lens rather
          // than as something lying on the planet.
          item.stain.set(stretch, width, carried, stainColour, depth, 0.85, sunLocal, cameraLocal);
        } else {
          item.stain.set(0, 0, 0, stainColour, 0);
        }

      }
    },
    dispose() {
      impactors.forEach((item) => {
        item.rock.geometry.dispose();
        item.rock.material.dispose();
        item.bolide.material.dispose();
        item.core.material.dispose();
        item.bloom.material.dispose();
        item.glare.dispose();
        item.stain.dispose();
        item.plumeGeometry.dispose();
        item.plumeMaterial.dispose();
      });
      impactors.length = 0;
    },
  };
}

/**
 * Io throws a plume three hundred kilometres up.
 *
 * Io is the most volcanically active body in the Solar System -- around four
 * hundred active volcanoes, and enough sulphur and sulphur dioxide leaving the
 * surface to resurface the whole moon every few thousand years. The large
 * plumes at Pele and Tvashtar reach 300 to 500 km, high enough to be a visible
 * umbrella against the disc rather than anything subtle. Loki Patera, the
 * brightest, brightens on a roughly five-hundred-day cycle.
 *
 * The colour is the giveaway and it is real: these deposits are yellow, white
 * and red because they are sulphur allotropes, not rock dust.
 */
/*
 * The volcanoes of Io, which are not one thing.
 *
 * Io has more than four hundred active vents and they are not variations on a
 * theme -- they are different machines, and a photograph shows it. What sets
 * them apart is what is driving each one and how deep it comes from:
 *
 *   Prometheus and its kind, on the equatorial plains, are shallow. A lava
 *   flow creeps over ground frosted with sulphur dioxide, the frost flashes to
 *   vapour underneath it, and what rises is almost pure SO2 -- a faint,
 *   translucent blue-white halo a hundred kilometres high that comes straight
 *   back down as snow. The ground around them is bright yellow and, where the
 *   fresh frost lands, pure white. These are the common ones.
 *
 *   Pele is not shallow. It is a lava lake venting from deep in the mantle,
 *   and what it throws out is raw short-chain sulphur -- S3 and S4 -- from
 *   hundreds of kilometres down. The plume is darker, blue-grey with an amber
 *   core where the hot gas is still glowing, and it stands 300 kilometres tall
 *   over a caldera ringed by a deposit the colour of dried blood, a thousand
 *   kilometres across. There is one of these in view, not five.
 *
 *   The high-latitude vents are old. Their deposits have sat under Jupiter's
 *   radiation belts long enough to be broken down, and what is left is the
 *   pastel mustards and olive greens of altered sulphur, under a duller
 *   grey-white plume.
 *
 *   And Tvashtar is a different chemistry altogether: molten silicate rock at
 *   1,600 K tearing through the crust in a curtain of fire. It glows
 *   orange-red at its base -- that is the lava itself, visible from orbit --
 *   and lays down pitch-black basaltic streaks that nothing else on Io makes.
 *
 * So the field below places one of each in the right place for its kind, and
 * the plains get several of the small frosted ones. Drawing five copies of the
 * same vent was the thing this replaces, and it made Io look like a texture
 * rather than a world.
 */
const IO_VENT_KINDS = {
  sulphurDioxide: {
    name: "Prometheus-type SO2 plume",
    grains: 110,
    // A hundred kilometres on an 1,821 km moon.
    apex: 0.062,
    span: 11,
    tilt: [8, 40],
    // Faint and translucent: the whole point of these is that you can see the
    // ground through them.
    base: 0xbcd8f2,
    top: 0xe8f4ff,
    brightness: 0.52,
    hotspot: 0xffd9a0,
    hotspotSize: 0.028,
    deposit: 0xf0cf4e,
    depositSpan: 7.5,
    inner: 0xf7f4ea,
    innerSpan: 3.0,
  },
  deepSulphur: {
    name: "Pele-type deep sulphur vent",
    grains: 380,
    // 300-400 km, the tallest thing Io does.
    apex: 0.26,
    span: 24,
    tilt: [6, 48],
    base: 0xffab45,
    top: 0x7f8ea4,
    brightness: 1.0,
    hotspot: 0xff7a2a,
    hotspotSize: 0.055,
    // The blood-red ring, and the dark caldera floor inside it.
    deposit: 0x8f1d20,
    depositSpan: 17,
    inner: 0x2a1714,
    innerSpan: 6.5,
  },
  irradiatedPolar: {
    name: "high-latitude altered deposit",
    grains: 80,
    apex: 0.05,
    span: 9,
    tilt: [10, 38],
    base: 0xb6bcbe,
    top: 0xd2d6d4,
    brightness: 0.44,
    hotspot: 0xd8c8a4,
    hotspotSize: 0.022,
    deposit: 0xb59f5c,
    depositSpan: 8.5,
    inner: 0x8d9463,
    innerSpan: 4.0,
  },
  silicate: {
    name: "Tvashtar-type silicate fissure",
    grains: 260,
    apex: 0.19,
    span: 18,
    tilt: [5, 34],
    base: 0xff5a1e,
    top: 0x99a2ad,
    brightness: 0.86,
    hotspot: 0xffdc6a,
    hotspotSize: 0.048,
    deposit: 0x141110,
    depositSpan: 11,
    inner: 0x0a0908,
    innerSpan: 4.5,
  },
};

/*
 * Where each one sits, in the moon's own latitude and in longitude measured
 * from whichever meridian the camera happens to be over. Longitude near zero
 * is the middle of the disc; near ninety it is the limb, which is where a
 * plume stands up against black sky instead of being seen end-on as a ring.
 *
 * The big one is put on the limb deliberately. It is the only one tall enough
 * to be worth that place, and everything else is arranged not to compete with
 * it.
 */
const IO_VENT_FIELD = [
  { kind: "deepSulphur", latitude: -19, longitude: 79 },
  { kind: "silicate", latitude: 60, longitude: -66 },
  { kind: "sulphurDioxide", latitude: -2, longitude: -34 },
  { kind: "sulphurDioxide", latitude: 14, longitude: 22 },
  { kind: "sulphurDioxide", latitude: -26, longitude: 41 },
  { kind: "irradiatedPolar", latitude: 74, longitude: 14 },
  { kind: "irradiatedPolar", latitude: -71, longitude: -20 },
];

function createIoPlume(target, camera) {
  const group = new THREE.Group();
  group.name = "Io eruption event";
  const radius = localRadius(target);

  const facing = localCameraDirection(target, camera, new THREE.Vector3());
  // The meridian the camera is over, so the field below can be laid out in
  // longitudes relative to it and still land where it was meant to.
  const centreLongitude = Math.atan2(facing.z, facing.x);

  /*
   * Every vent's spray shares one buffer, so the whole field is one draw call
   * however many vents there are. This is the same trade the meteor shower
   * makes and for the same reason: seven separate Points objects would cost
   * seven state changes a frame to draw the same number of particles.
   */
  const vents = [];
  let totalGrains = 0;
  for (let index = 0; index < IO_VENT_FIELD.length; index += 1) {
    totalGrains += IO_VENT_KINDS[IO_VENT_FIELD[index].kind].grains;
  }

  const positions = new Float32Array(totalGrains * 3);
  const colors = new Float32Array(totalGrains * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: getGlowTexture(),
    vertexColors: true,
    size: radius * 0.030,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spray = new THREE.Points(geometry, material);
  spray.frustumCulled = false;
  group.add(spray);

  const grains = [];
  const baseTone = new THREE.Color();
  const topTone = new THREE.Color();

  let cursor = 0;
  for (let index = 0; index < IO_VENT_FIELD.length; index += 1) {
    const site = IO_VENT_FIELD[index];
    const kind = IO_VENT_KINDS[site.kind];

    const latitude = THREE.MathUtils.degToRad(site.latitude);
    const longitude = centreLongitude
      + THREE.MathUtils.degToRad(site.longitude + (Math.random() - 0.5) * 9);
    const ventDirection = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude),
    ).normalize();

    // A basis on the surface at the vent, so launches tilt off the vertical in
    // a real direction rather than a random one.
    const tangentHelper = Math.abs(ventDirection.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const tangentA = new THREE.Vector3().crossVectors(ventDirection, tangentHelper).normalize();
    const tangentB = new THREE.Vector3().crossVectors(ventDirection, tangentA).normalize();

    baseTone.setHex(kind.base);
    topTone.setHex(kind.top);

    const first = cursor;
    for (let n = 0; n < kind.grains; n += 1) {
      const tilt = THREE.MathUtils.degToRad(
        kind.tilt[0] + Math.pow(Math.random(), 0.7) * (kind.tilt[1] - kind.tilt[0]),
      );
      const around = Math.random() * Math.PI * 2;
      grains.push({
        tangential: new THREE.Vector3()
          .addScaledVector(tangentA, Math.cos(around))
          .addScaledVector(tangentB, Math.sin(around)),
        climb: Math.cos(tilt),
        reach: Math.sin(tilt),
        speed: 0.72 + Math.random() * 0.38,
        phase: Math.random(),
        rate: 0.55 + Math.random() * 0.5,
        glow: (0.25 + Math.pow(Math.random(), 1.8) * 0.95) * kind.brightness,
      });
      cursor += 1;
    }

    // The vent floor itself: the hot caldera, small and bright.
    const hotspot = makeGlow(kind.hotspot, 0);
    group.add(hotspot);

    /*
     * What it has laid down around itself, which on Io is the more permanent
     * half of the picture -- plumes come and go over months, deposits last for
     * years. Two caps: the outer ring colour and, over the middle of it, the
     * darker floor. Layering them is what turns a filled patch into a ring,
     * which is the shape Pele actually leaves.
     */
    const deposit = createSurfaceCap(radius, ventDirection, "stain");
    group.add(deposit.mesh);
    const inner = createSurfaceCap(radius, ventDirection, "stain");
    group.add(inner.mesh);
    inner.mesh.renderOrder = 2;

    vents.push({
      kind,
      ventDirection,
      hotspot,
      deposit,
      inner,
      depositColour: new THREE.Color(kind.deposit),
      innerColour: new THREE.Color(kind.inner),
      first,
      count: kind.grains,
      apex: radius * kind.apex,
      span: THREE.MathUtils.degToRad(kind.span),
      baseR: baseTone.r, baseG: baseTone.g, baseB: baseTone.b,
      topR: topTone.r, topG: topTone.g, topB: topTone.b,
      // Each vent runs on its own clock, so the field is not one synchronised
      // pulse. The big ones are steady; the small SO2 ones puff.
      beat: site.kind === "sulphurDioxide" ? 0.55 + Math.random() * 0.7 : 0,
      beatPhase: Math.random() * Math.PI * 2,
    });
  }

  const grain = new THREE.Vector3();
  const sunLocal = new THREE.Vector3();
  const viewLocal = new THREE.Vector3();

  return {
    group,
    duration: 16,
    update(progress) {
      const rise = smoothstep(0, 0.28, progress);
      const settle = 1 - smoothstep(0.62, 1, progress);
      const strength = rise * settle;

      localSunDirection(target, sunLocal);
      localCameraDirection(target, camera, viewLocal);

      const attribute = geometry.getAttribute("position");
      const tint = geometry.getAttribute("color");

      for (let v = 0; v < vents.length; v += 1) {
        const vent = vents[v];
        const {
          ventDirection, apex, span, first, count,
          baseR, baseG, baseB, topR, topG, topB,
        } = vent;
        /*
         * The little ones breathe. Prometheus-type plumes are driven by a lava
         * flow front creeping over frost, and they visibly wax and wane over
         * hours as it reaches new ground; the deep vents just run.
         */
        const pulse = vent.beat
          ? 0.55 + 0.45 * Math.sin(progress * vent.beat * 12 + vent.beatPhase)
          : 1;
        const local = strength * pulse;

        for (let n = 0; n < count; n += 1) {
          const item = grains[first + n];
          const flight = (item.phase + progress * item.rate * 2.4) % 1;
          const height = apex * item.speed * item.climb * 4 * flight * (1 - flight);
          const swept = span * item.speed * item.reach * flight * rise;
          grain.copy(ventDirection).multiplyScalar(Math.cos(swept))
            .addScaledVector(item.tangential, Math.sin(swept))
            .multiplyScalar(radius + height * rise);
          attribute.setXYZ(first + n, grain.x, grain.y, grain.z);

          const lift = Math.min(1, height / apex);
          const fade = Math.sin(Math.min(1, flight * 1.12) * Math.PI) ** 0.6;
          const level = item.glow * fade * local;
          // Hot at the vent, cold at the top of the arc, in this vent's own
          // two colours rather than in one shared orange.
          tint.setXYZ(
            first + n,
            level * (baseR + (topR - baseR) * lift),
            level * (baseG + (topG - baseG) * lift),
            level * (baseB + (topB - baseB) * lift),
          );
        }

        const hotspotSize = radius * vent.kind.hotspotSize * (0.6 + local * 0.7);
        vent.hotspot.scale.setScalar(hotspotSize);
        vent.hotspot.position.copy(ventDirection)
          .multiplyScalar(radius + hotspotSize * 0.35);
        vent.hotspot.material.opacity = local * 0.9;

        /*
         * The deposits fade up early and stay: they are what the eruption
         * leaves, so they must not go out with the plume.
         */
        const laid = smoothstep(0.04, 0.4, progress);
        const outer = THREE.MathUtils.degToRad(vent.kind.depositSpan);
        const core = THREE.MathUtils.degToRad(vent.kind.innerSpan);
        vent.deposit.set(
          outer, outer * 0.86, 0, vent.depositColour, laid * 0.85, 2.1, sunLocal, viewLocal,
        );
        vent.inner.set(
          core, core * 0.9, 0, vent.innerColour, laid * 0.9, 2.6, sunLocal, viewLocal,
        );
      }

      attribute.needsUpdate = true;
      tint.needsUpdate = true;
      material.opacity = strength * 0.85;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      vents.forEach((vent) => {
        vent.hotspot.material.dispose();
        vent.deposit.mesh.geometry.dispose();
        vent.deposit.material.dispose();
        vent.inner.mesh.geometry.dispose();
        vent.inner.material.dispose();
      });
    },
  };
}


/**
 * Enceladus vents its ocean into Saturn's E ring.
 *
 * More than a hundred discrete jets erupt from four warm fractures across the
 * south pole -- the "tiger stripes" -- and Cassini flew through them and tasted
 * salt, silica and organic molecules, which is how a 500 km moon came to be one
 * of the better places to look for life. The material does not fall back: most
 * of it escapes, and it *is* Saturn's E ring, which is why that ring is there
 * at all and why it is centred on this moon's orbit.
 *
 * So the jets here all leave from the south pole, they fan, and they do not
 * come back down.
 */
function createEnceladusPlumes(target) {
  const group = new THREE.Group();
  group.name = "Enceladus plume event";
  const radius = localRadius(target);

  /*
   * Built from ice grains leaving four fissures, not from lines leaving a
   * point.
   *
   * Lines were the first version and they were wrong in the most basic way:
   * what leaves this moon is water. A line has a start, an end and no body,
   * and nine of them radiating from the south pole read as a diagram of the
   * event rather than the event. What Cassini's backlit images actually show
   * is a broad luminous curtain -- brightest where it leaves the ground,
   * thinning outward until it is indistinguishable from the E ring it is
   * feeding -- with individual jets resolving inside it only where the
   * material happens to be densest.
   *
   * So: grains, launched along the four tiger stripes rather than from a
   * single point, and most of them never coming back. Enceladus escapes at
   * about 239 m/s and much of this material leaves faster than that, which is
   * why the E ring exists and why it is centred on this moon's orbit. The
   * minority that leaves slower arcs over and falls as snow, and that returning
   * fraction is what makes the curtain dense near the surface.
   */
  /*
   * Enough grains, drawn faintly and large enough to overlap, that the curtain
   * is smooth. Fewer and brighter reads as glitter -- individually countable
   * sparks hanging in space -- which is the same failure the impact plume had
   * and has the same cause: a cloud is what you get when no single particle in
   * it can be picked out.
   */
  const GRAINS = 3600;
  const STRIPES = 4;
  // Cassini measured the plume out to several moon radii before it merges into
  // the ring; the dense, obviously-jet part is nearer one.
  const REACH = radius * 2.3;

  const positions = new Float32Array(GRAINS * 3);
  const colors = new Float32Array(GRAINS * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: getSoftTexture(),
    vertexColors: true,
    size: radius * 0.068,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spray = new THREE.Points(geometry, material);
  spray.frustumCulled = false;
  group.add(spray);

  /*
   * The four stripes. They are roughly parallel fractures about 130 km long
   * and 35 km apart across the south polar terrain, so on a 252 km moon they
   * are laid out here as four lines offset either side of the pole, each
   * running a good way round it.
   */
  const pole = new THREE.Vector3(0, -1, 0);
  const stripeAcross = new THREE.Vector3(1, 0, 0);
  const stripeAlong = new THREE.Vector3(0, 0, 1);

  /*
   * Every grain's fixed properties, side by side in flat arrays.
   *
   * Thirty-six hundred grains are rewritten on every frame of this event, and
   * the version that held them as objects and moved them with chained vector
   * methods spent far more time chasing pointers than doing the three
   * multiplies and three adds each one actually needs. The layout below is the
   * same numbers in the order the loop reads them.
   *
   * `siteX/Y/Z` already carry the moon's radius, because the vent never moves;
   * `launchX/Y/Z` is the unit direction the grain leaves along. `fall` is the
   * pull-back coefficient, zero for anything above escape velocity, which is
   * how the branch inside the loop was removed as well.
   */
  const siteX = new Float32Array(GRAINS);
  const siteY = new Float32Array(GRAINS);
  const siteZ = new Float32Array(GRAINS);
  const launchX = new Float32Array(GRAINS);
  const launchY = new Float32Array(GRAINS);
  const launchZ = new Float32Array(GRAINS);
  const grainSpeed = new Float32Array(GRAINS);
  const grainFall = new Float32Array(GRAINS);
  const grainPhase = new Float32Array(GRAINS);
  const grainRate = new Float32Array(GRAINS);
  const grainGlow = new Float32Array(GRAINS);

  for (let index = 0; index < GRAINS; index += 1) {
    const stripe = index % STRIPES;
    // Where along this fissure the grain leaves, and which fissure it is.
    const offset = THREE.MathUtils.degToRad((stripe - (STRIPES - 1) / 2) * 7.5);
    const along = THREE.MathUtils.degToRad((Math.random() * 2 - 1) * 21);

    const site = pole.clone()
      .addScaledVector(stripeAcross, Math.tan(offset))
      .addScaledVector(stripeAlong, Math.tan(along))
      .normalize();

    /*
     * The jets do not leave straight up. They lean, and they fan -- which is
     * what turns four cracks into one continuous curtain a few hundred
     * kilometres up.
     */
    const fanHelper = Math.abs(site.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const fanA = new THREE.Vector3().crossVectors(site, fanHelper).normalize();
    const fanB = new THREE.Vector3().crossVectors(site, fanA).normalize();
    const around = Math.random() * Math.PI * 2;
    /*
     * The fan is wider along the fissure than across it, because a crack vents
     * along its length. An even cone in every direction gives a ball of spray;
     * this gives a curtain, which is what the fractures actually produce and
     * what the backlit images show.
     */
    const tiltAlong = THREE.MathUtils.degToRad(Math.pow(Math.random(), 0.75) * 30);
    const tiltAcross = THREE.MathUtils.degToRad(Math.pow(Math.random(), 0.75) * 11);
    const launch = site.clone()
      .addScaledVector(fanA, Math.tan(tiltAcross) * Math.cos(around))
      .addScaledVector(fanB, Math.tan(tiltAlong) * Math.sin(around))
      .normalize();

    /*
     * Speed decides the grain's whole story. Above escape it leaves and never
     * returns; below it, it arcs over and comes down as snow. Cassini's
     * measurements put a large majority above -- so the plume thins outward
     * rather than closing into a dome.
     */
    const speed = 0.35 + Math.pow(Math.random(), 1.5) * 0.9;

    siteX[index] = site.x * radius;
    siteY[index] = site.y * radius;
    siteZ[index] = site.z * radius;
    launchX[index] = launch.x;
    launchY[index] = launch.y;
    launchZ[index] = launch.z;
    grainSpeed[index] = speed;
    // Below escape it arcs over and snows back down; above it, it is gone.
    grainFall[index] = speed < 0.52 ? REACH * speed * 1.35 : 0;
    grainPhase[index] = Math.random();
    grainRate[index] = 0.32 + Math.random() * 0.4;
    grainGlow[index] = 0.45 + Math.random() * 0.6;
  }

  // The glow where the whole south polar terrain is venting at once.
  const base = makeGlow(0xdff1ff, 0);
  group.add(base);

  const iceNear = new THREE.Color(0xf2fbff);
  const iceFar = new THREE.Color(0x6fa8d8);

  return {
    group,
    duration: 18,
    update(progress) {
      const on = smoothstep(0, 0.2, progress) * (1 - smoothstep(0.7, 1, progress));
      /*
       * The jets are measurably stronger at apoapsis, when Saturn's tides pull
       * the fractures open, so the whole curtain breathes rather than holding
       * one brightness.
       */
      const tide = 0.72 + 0.28 * Math.sin(progress * 4.1);

      const attribute = geometry.getAttribute("position");
      const tint = geometry.getAttribute("color");

      // The two ends of the colour ramp, unpacked so the inner loop does not
      // touch a Color object at all.
      const nearR = iceNear.r; const nearG = iceNear.g; const nearB = iceNear.b;
      const farR = iceFar.r; const farG = iceFar.g; const farB = iceFar.b;
      const reachRate = REACH * tide;

      for (let index = 0; index < GRAINS; index += 1) {
        // Each grain runs its own flight and relaunches, so the vent is
        // continuous rather than a single puff.
        const flight = (grainPhase[index] + progress * grainRate[index] * 2.6) % 1;
        const speed = grainSpeed[index];
        const travel = reachRate * speed * flight;
        // The slow ones feel the moon pulling them back; the fast ones do not.
        const risen = Math.max(0, travel - grainFall[index] * flight * flight);

        const at = index * 3;
        positions[at] = siteX[index] + launchX[index] * risen;
        positions[at + 1] = siteY[index] + launchY[index] * risen;
        positions[at + 2] = siteZ[index] + launchZ[index] * risen;

        /*
         * Ice grains shine by scattering sunlight, and there are fewer and
         * fewer of them the further out you look, so the curtain has to fade
         * with distance rather than end. The colour cools as it goes: the
         * densest part near the vents is near-white, and what is left further
         * out is the faint blue of the E ring.
         */
        const reachFraction = Math.min(1, travel / REACH);
        const level = grainGlow[index] * on * Math.pow(1 - flight, 1.9)
          * smoothstep(0, 0.05, flight);
        colors[at] = (nearR + (farR - nearR) * reachFraction) * level;
        colors[at + 1] = (nearG + (farG - nearG) * reachFraction) * level;
        colors[at + 2] = (nearB + (farB - nearB) * reachFraction) * level;
      }

      attribute.needsUpdate = true;
      tint.needsUpdate = true;
      material.opacity = on * 0.21;

      base.position.copy(pole).multiplyScalar(radius * 0.96);
      base.scale.setScalar(radius * (0.35 + on * 0.3) * tide);
      base.material.opacity = on * 0.35;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      base.material.dispose();
    },
  };
}

/**
 * Earth runs into a debris stream.
 *
 * The showers are the most reliably recurring events in the Solar System: Earth
 * crosses the same trails on the same dates every year, because the trails are
 * in fixed orbits and so is Earth. The Perseids in August are dust shed by
 * comet Swift-Tuttle; the Geminids in December are unusual in coming from an
 * asteroid, 3200 Phaethon, rather than a comet. At peak, a shower delivers of
 * order a hundred visible meteors an hour, and the particles are mostly the
 * size of a grain of sand.
 *
 * They all appear to radiate from one point, which is pure perspective -- the
 * particles are travelling on parallel paths, and the radiant is the vanishing
 * point. That is what is drawn here.
 */
/*
 * What colour a meteor is, and why.
 *
 * The colour is a thermometer. A meteoroid does not burn like a coal; it
 * ablates, and the light comes from two things -- metal atoms boiled off the
 * grain, and the air itself, shocked and ionised in front of it. Which of
 * those dominates is set almost entirely by how fast it arrived.
 *
 * A slow one, twenty kilometres a second, never gets the air hot enough to
 * matter. What glows is sodium and iron coming off the rock, and those are the
 * yellows, oranges and reds that make up most of what anyone ever sees.
 *
 * A fast one -- seventy kilometres a second, a Leonid arriving head-on into
 * Earth's own orbital motion -- shocks the air hard enough to ionise nitrogen
 * and oxygen, and those emit in the blue and violet. Magnesium boiling off at
 * that speed adds the brilliant blue-green flash the brightest ones show.
 *
 * And a trail is not one colour along its length, because the head and the
 * wake are not the same thing. The head is the shock front, hottest and most
 * ionised; the wake behind it is recombining air, cooling as it goes, and in
 * the fast ones that recombination is the green of atomic oxygen giving way to
 * the red of nitrogen further back. So each kind carries a head colour and a
 * tail colour and the trail runs between them.
 *
 * The weights are the sky's own: warm and slow is the common case by a long
 * way, and the blue-violet ones are the rarity worth waiting for.
 */
const METEOR_KINDS = [
  {
    name: "slow sodium",
    weight: 0.40,
    speed: [0.42, 0.72],
    head: 0xfff1c4,
    tail: 0xff7a1e,
  },
  {
    name: "iron, ordinary",
    weight: 0.24,
    speed: [0.60, 0.95],
    head: 0xfff6e2,
    tail: 0xff4d2a,
  },
  {
    // The one that changes colour down its own length: oxygen green at the
    // head, nitrogen red where the air behind it is recombining.
    name: "oxygen green to nitrogen red",
    weight: 0.16,
    speed: [1.05, 1.55],
    head: 0x9dffae,
    tail: 0xff6f96,
  },
  {
    name: "magnesium blue-green",
    weight: 0.12,
    speed: [1.25, 1.85],
    head: 0x74ffdc,
    tail: 0x38d8ff,
  },
  {
    name: "ionised air, very fast",
    weight: 0.08,
    speed: [1.60, 2.30],
    head: 0xc9d4ff,
    tail: 0x7b5cff,
  },
];

const METEOR_KIND_TOTAL = METEOR_KINDS.reduce((sum, kind) => sum + kind.weight, 0);

function pickMeteorKind(random = Math.random) {
  let ticket = random() * METEOR_KIND_TOTAL;
  for (let index = 0; index < METEOR_KINDS.length; index += 1) {
    ticket -= METEOR_KINDS[index].weight;
    if (ticket <= 0) return METEOR_KINDS[index];
  }
  return METEOR_KINDS[0];
}

function createMeteorShower(target, camera) {
  const group = new THREE.Group();
  group.name = "Meteor shower event";
  const radius = localRadius(target);

  /*
   * Drawn for the place the viewer is actually standing.
   *
   * The first version was a field of thin bright lines, which is exactly right
   * for the only view anyone has ever had of a shower: from underneath, at
   * night, where a meteor *is* a line because it is a hundred kilometres up and
   * gone in half a second. From out here that view is wrong twice over -- these
   * are solid objects, and you are level with them rather than beneath them.
   *
   * The version after that went too far the other way. Soft particles, a wide
   * spreading wake and a bulbous head gave every meteor a tadpole shape, and a
   * shower of tadpoles is not what this is. A meteor is violent: a grain of
   * sand arriving at fifty kilometres a second, brighter than any planet for a
   * fraction of a second, and the shape of it is a blade -- hard, straight, and
   * hottest right at the leading point. So the wake here is short, dead
   * straight, tightly cored, and falls away steeply behind the head.
   */
  const COUNT = 30;
  // Puffs per wake. Short and closely spaced, so their bright cores overlap
  // into one continuous hard line rather than a string of beads.
  const PUFFS = 64;
  const WAKE = radius * 0.10;

  const facing = localCameraDirection(target, camera, new THREE.Vector3());
  const sunward = localSunDirection(target, new THREE.Vector3());

  /*
   * One shared direction. The stream arrives on parallel paths -- that is what
   * makes it a stream, and the radiant a ground observer sees is the vanishing
   * point of exactly this.
   *
   * It is not drawn from a hat, though, and the reason is worth stating.
   * A body travelling on a fixed heading can only strike the face of the world
   * that heading points at. Pick the direction at random and that face is
   * often nowhere near the part of the planet being looked at, or the part in
   * daylight -- and then either there is nowhere for a strike to land where
   * anyone could see it, or the strike has to be bent off the stream to reach
   * one, which is worse: the ones that hit visibly arrive on a different
   * heading from the ones that miss, and the shower stops looking like a
   * shower.
   *
   * So the heading is drawn to be usable: swung about seventy degrees off the
   * line between the viewer and the daylit face, which is far enough that the
   * trails cross the frame instead of receding down the sightline -- at fifty
   * degrees they head away from the camera and most of the shower is behind it
   * -- and near enough that the face the stream can reach still overlaps the
   * face anyone can see. Every meteor here travels on it, the ones that pass
   * and the ones that arrive alike.
   */
  const radiantAxis = new THREE.Vector3().addVectors(facing, sunward);
  if (radiantAxis.lengthSq() < 0.04) radiantAxis.copy(facing); else radiantAxis.normalize();
  const swingHelper = Math.abs(radiantAxis.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const swingA = new THREE.Vector3().crossVectors(radiantAxis, swingHelper).normalize();
  const swingB = new THREE.Vector3().crossVectors(radiantAxis, swingA).normalize();
  const swing = Math.random() * Math.PI * 2;
  const stream = radiantAxis.clone().multiplyScalar(0.36)
    .addScaledVector(swingA, Math.cos(swing) * 0.93)
    .addScaledVector(swingB, Math.sin(swing) * 0.93)
    .normalize();

  /*
   * The body itself, and it is almost nothing.
   *
   * A Perseid is a grain of sand. Drawn at any size the eye can pick out, and
   * lit from within so it can be seen at all, it renders as a flat orange
   * lozenge leading a faint tail -- which is the tadpole this event kept
   * turning into. What a meteor actually shows you is the column of air it has
   * set alight, so the rock is kept to a dark speck and every bit of the
   * brightness goes into the trail.
   */
  const rockGeometry = new THREE.IcosahedronGeometry(radius * 0.0045, 1);

  /*
   * The wake is a cloud of points sharing one buffer -- every meteor's and
   * every striker's, so the whole shower is one draw call.
   *
   * These use the hard glow texture rather than the soft one. That is the
   * opposite of the choice made for the impact plume on Jupiter and for the
   * same reason: a plume is a volume and wants particles with no core, while
   * a meteor trail is a line and wants nothing but core. Dense small sprites
   * with a tight centre lay down a bright hard filament; the soft ones smear
   * it into the tadpole this used to be.
   */
  const TRAILS = COUNT;
  const wakePositions = new Float32Array(TRAILS * PUFFS * 3);
  const wakeColors = new Float32Array(TRAILS * PUFFS * 3);
  const wakeGeometry = new THREE.BufferGeometry();
  wakeGeometry.setAttribute("position", new THREE.BufferAttribute(wakePositions, 3));
  wakeGeometry.setAttribute("color", new THREE.BufferAttribute(wakeColors, 3));
  const wakeMaterial = new THREE.PointsMaterial({
    map: getGlowTexture(),
    vertexColors: true,
    size: radius * 0.026,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wake = new THREE.Points(wakeGeometry, wakeMaterial);
  wake.frustumCulled = false;
  group.add(wake);

  // A basis across the stream, for the little lateral scatter the trail keeps.
  const acrossHelper = Math.abs(stream.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const acrossA = new THREE.Vector3().crossVectors(stream, acrossHelper).normalize();
  const acrossB = new THREE.Vector3().crossVectors(stream, acrossA).normalize();

  /*
   * The wake, held as numbers rather than as objects.
   *
   * Thirty trails of sixty-four puffs is nineteen hundred and twenty of these
   * rebuilt from scratch every frame, and the version that walked an array of
   * little `{drift, lift, glow}` objects and chained vector methods spent most
   * of its time on property lookups and allocation rather than on arithmetic.
   * Three flat arrays and inline scalar maths do exactly the same sum.
   */
  const makeHair = () => {
    const hair = new Float32Array(PUFFS * 3);
    for (let step = 0; step < PUFFS; step += 1) {
      hair[step * 3] = (Math.random() - 0.5) * radius * 0.0022;
      hair[step * 3 + 1] = (Math.random() - 0.5) * radius * 0.0022;
      hair[step * 3 + 2] = 0.85 + Math.random() * 0.35;
    }
    return hair;
  };

  /*
   * How far along the trail each puff sits, and how bright that leaves it.
   * Both are fixed by the puff's index, so neither belongs inside a loop that
   * runs sixty times a second.
   */
  const wakeAlong = new Float32Array(PUFFS);
  const wakeFalloff = new Float32Array(PUFFS);
  for (let step = 0; step < PUFFS; step += 1) {
    const along = step / (PUFFS - 1);
    wakeAlong[step] = along;
    wakeFalloff[step] = Math.pow(1 - along, 2.4);
  }

  const meteors = [];
  const kindHead = new THREE.Color();
  const kindTail = new THREE.Color();
  for (let index = 0; index < COUNT; index += 1) {
    const scale = 0.55 + Math.pow(Math.random(), 2.2) * 1.5;
    const kind = pickMeteorKind();
    kindHead.setHex(kind.head);
    kindTail.setHex(kind.tail);

    const rock = new THREE.Mesh(
      rockGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x584a3e, roughness: 1, metalness: 0,
        emissive: kind.head, emissiveIntensity: 0,
      }),
    );
    rock.scale.setScalar(scale);
    group.add(rock);

    const head = makeGlow(kind.head, 0);
    group.add(head);

    meteors.push({
      rock, head, scale, kind,
      // Held as six scalars rather than as two Colors, because the trail loop
      // that reads them runs sixty-four times per meteor per frame.
      headR: kindHead.r, headG: kindHead.g, headB: kindHead.b,
      tailR: kindTail.r, tailG: kindTail.g, tailB: kindTail.b,
      // Spread across the volume the stream passes through, so they arrive
      // scattered rather than as a sheet.
      offset: new THREE.Vector3(
        (Math.random() - 0.5) * radius * 3.4,
        (Math.random() - 0.5) * radius * 3.4,
        (Math.random() - 0.5) * radius * 3.4,
      ),
      phase: Math.random(),
      /*
       * The kind sets the speed, not the other way round -- a meteor is blue
       * BECAUSE it is fast. Across the table this runs from 0.42 to 2.3, a
       * spread of five and a half to one, where the old single range was 2.3
       * to one and every meteor in the shower moved at much the same rate.
       */
      speed: kind.speed[0] + Math.random() * (kind.speed[1] - kind.speed[0]),
      spin: 0.05 + Math.random() * 0.12,
      /*
       * A fixed hair of lateral scatter, and deliberately not one that grows
       * along the trail. The growing version was what made these bend: the
       * far end of every wake wandered several times further off the axis than
       * the near end, so each trail curved away like a tail being flicked.
       * Real ablation trails are straight -- nothing is pushing them sideways
       * -- and a constant tiny offset gives the filament texture without
       * bending it.
       */
      hair: makeHair(),
    });
  }

  /*
   * And the ones that arrive.
   *
   * Most of a shower burns out eighty kilometres up and nothing reaches the
   * ground -- that is the honest default, and it is what the thirty above are
   * doing. But a stream is a size distribution, and the top of it does get
   * through. So a few of these are aimed at the surface, and each one is aimed
   * at *land*, by reading the planet's own daytime map and rejecting any
   * candidate point that comes back ocean-coloured. An ocean strike is the
   * commoner outcome by two to one and it is also nothing to look at: a flash
   * and then water. The interesting one is the one that hits something.
   */
  const STRIKES = 3;
  const strikes = [];
  const placed = [];
  for (let index = 0; index < STRIKES; index += 1) {
    const normal = pickLandPoint(target, facing, sunward, stream, placed);
    if (!normal) break;
    placed.push(normal);

    const scale = 0.8 + Math.random() * 0.9;

    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 0.016 * scale, 1),
      new THREE.MeshStandardMaterial({
        color: 0x584a3e, roughness: 1, metalness: 0,
        emissive: 0xff8a34, emissiveIntensity: 0,
      }),
    );
    group.add(rock);

    const bolide = makeSurfaceGlow(0xfff2d8, 0);
    group.add(bolide);
    // The airburst: white at the moment of arrival, and very short.
    const flash = makeSurfaceGlow(0xffffff, 0);
    group.add(flash);
    const fireball = makeSurfaceGlow(0xff8a2e, 0);
    group.add(fireball);

    // The light it throws over the ground around it.
    const glare = createSurfaceCap(radius, normal, "light");
    group.add(glare.mesh);
    // And what it leaves: scorched ground, thrown dust, and a dark mark.
    const scar = createSurfaceCap(radius, normal, "stain");
    group.add(scar.mesh);

    const DEBRIS = 240;
    const debrisPositions = new Float32Array(DEBRIS * 3);
    const debrisColors = new Float32Array(DEBRIS * 3);
    const debrisGeometry = new THREE.BufferGeometry();
    debrisGeometry.setAttribute("position", new THREE.BufferAttribute(debrisPositions, 3));
    debrisGeometry.setAttribute("color", new THREE.BufferAttribute(debrisColors, 3));
    const debrisMaterial = new THREE.PointsMaterial({
      map: getSoftTexture(),
      vertexColors: true,
      size: radius * 0.012 * scale,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const debris = new THREE.Points(debrisGeometry, debrisMaterial);
    debris.frustumCulled = false;
    group.add(debris);

    // A basis on the ground at the impact point, for throwing the ejecta out.
    const groundHelper = Math.abs(normal.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
    const groundA = new THREE.Vector3().crossVectors(normal, groundHelper).normalize();
    const groundB = new THREE.Vector3().crossVectors(normal, groundA).normalize();

    const grains = [];
    for (let grain = 0; grain < DEBRIS; grain += 1) {
      const around = Math.random() * Math.PI * 2;
      grains.push({
        tangential: new THREE.Vector3()
          .addScaledVector(groundA, Math.cos(around))
          .addScaledVector(groundB, Math.sin(around)),
        // Ejecta from a ground strike leaves low and fast, unlike the vertical
        // column an airburst in a deep atmosphere drives. This is a curtain,
        // not a mushroom, so the launches are shallow.
        tilt: THREE.MathUtils.degToRad(28 + Math.random() * 46),
        speed: 0.4 + Math.pow(Math.random(), 0.7) * 0.85,
        lead: Math.random() * 0.3,
        glow: 0.45 + Math.random() * 0.55,
      });
    }

    strikes.push({
      normal, rock, bolide, flash, fireball, glare, scar,
      debris, debrisGeometry, debrisMaterial, grains, scale,
      arriveAt: 0.24 + (index / STRIKES) * 0.34 + Math.random() * 0.06,
      spin: 0.05 + Math.random() * 0.1,
    });
  }

  const head = new THREE.Vector3();
  const ejecta = new THREE.Vector3();
  const sunLocal = new THREE.Vector3();
  const cameraLocal = new THREE.Vector3();
  const debrisTone = new THREE.Color();
  const glareColour = new THREE.Color(0xffd0a0);
  // Scorched ground and thrown dust: darker and greyer than a gas giant's
  // stain, because what is pulverised here is rock rather than cloud.
  const scarColour = new THREE.Color(0x3a2c20);
  const dustHot = new THREE.Color(0xffc98a);
  const dustCold = new THREE.Color(0x6d5c4c);

  return {
    group,
    duration: 17,
    update(progress) {
      localSunDirection(target, sunLocal);
      localCameraDirection(target, camera, cameraLocal);
      const on = smoothstep(0, 0.14, progress) * (1 - smoothstep(0.76, 1, progress));
      const wakePosition = wakeGeometry.getAttribute("position");
      const wakeColor = wakeGeometry.getAttribute("color");
      // Unpacked once for the nineteen hundred writes below.
      const streamX = stream.x; const streamY = stream.y; const streamZ = stream.z;
      const acrossAX = acrossA.x; const acrossAY = acrossA.y; const acrossAZ = acrossA.z;
      const acrossBX = acrossB.x; const acrossBY = acrossB.y; const acrossBZ = acrossB.z;

      for (let index = 0; index < COUNT; index += 1) {
        const item = meteors[index];
        // Each grain runs its own life and restarts, so the stream keeps
        // producing them rather than showing one synchronised volley.
        const life = (item.phase + progress * item.speed * 3.2) % 1;
        const travel = radius * 5.5;

        head.copy(stream).multiplyScalar(travel * (0.55 - life)).add(item.offset);
        item.rock.position.copy(head);
        item.rock.rotation.x += item.spin;
        item.rock.rotation.y += item.spin * 0.7;

        /*
         * Brightening is a function of the *life*, not of distance to the
         * planet: these are burning because they have run into something, and
         * they run into it partway along. It rises fast and lets go slowly,
         * which is the shape of an ablation curve.
         */
        const burn = Math.sin(Math.min(1, life * 1.15) * Math.PI);
        const glow = Math.pow(burn, 0.55) * on;

        item.rock.material.emissiveIntensity = glow * 0.04;
        item.rock.visible = glow > 0.02;

        // The leading point: small, white, and the hardest thing in the frame.
        item.head.position.copy(head);
        item.head.scale.setScalar(radius * (0.003 + burn * 0.008) * item.scale);
        item.head.material.opacity = glow * 0.95;
        item.head.visible = item.rock.visible;

        /*
         * The wake, laid straight back along the path, and longer the faster
         * the meteor is. A seventy-kilometre-a-second Leonid draws a far
         * longer streak than a twenty-kilometre-a-second Taurid does, and the
         * two used to be drawn the same length.
         */
        const length = WAKE * (0.45 + burn * 0.95) * item.scale
          * (0.62 + item.speed * 0.55);
        const { hair, headR, headG, headB, tailR, tailG, tailB } = item;
        const base = index * PUFFS * 3;
        for (let step = 0; step < PUFFS; step += 1) {
          const along = wakeAlong[step];
          const reach = along * length;
          const drift = hair[step * 3];
          const lift = hair[step * 3 + 1];
          const at = base + step * 3;
          wakePositions[at] = head.x + streamX * reach + acrossAX * drift + acrossBX * lift;
          wakePositions[at + 1] = head.y + streamY * reach + acrossAY * drift + acrossBY * lift;
          wakePositions[at + 2] = head.z + streamZ * reach + acrossAZ * drift + acrossBZ * lift;

          /*
           * A steep falloff, which is what makes it a blade. The head carries
           * nearly all the light and the trail is gone within a fifth of its
           * length; a gentle falloff spreads the same brightness evenly and
           * turns the streak into a smear.
           */
          /*
           * Head colour at the front, tail colour at the back, and the
           * crossover pushed towards the head so most of the visible length
           * carries the trail colour rather than the shock colour. This is
           * where a green head over a red wake comes from, and where a violet
           * head bleeds back into blue.
           */
          const level = glow * hair[step * 3 + 2] * wakeFalloff[step];
          const mix = along * along * 0.55 + along * 0.45;
          wakeColors[at] = level * (headR + (tailR - headR) * mix);
          wakeColors[at + 1] = level * (headG + (tailG - headG) * mix);
          wakeColors[at + 2] = level * (headB + (tailB - headB) * mix);
        }
      }

      wakePosition.needsUpdate = true;
      wakeColor.needsUpdate = true;
      wakeMaterial.opacity = on;

      /*
       * The ones that reach the ground.
       */
      for (let index = 0; index < strikes.length; index += 1) {
        const item = strikes[index];
        const { arriveAt } = item;
        const since = progress - arriveAt;
        // See `makeSurfaceGlow`: these do not depth-test, so the limb has to be
        // honoured here instead of by the depth buffer.
        const inView = smoothstep(-0.06, 0.16, item.normal.dot(cameraLocal));

        // Coming in along the stream, ending exactly on its own patch of land.
        const approach = THREE.MathUtils.clamp(progress / arriveAt, 0, 1);
        const fall = Math.pow(approach, 2.4);
        const height = radius * 3.2 * (1 - fall);
        ejecta.copy(item.normal).multiplyScalar(radius)
          .addScaledVector(stream, height);
        item.rock.position.copy(ejecta);
        item.rock.rotation.x += item.spin;
        item.rock.rotation.y += item.spin * 1.3;
        item.rock.visible = since < 0;

        const heating = smoothstep(0.55, 1, approach) * (since < 0 ? 1 : 0);
        item.rock.material.emissiveIntensity = heating * 2.2;
        item.bolide.position.copy(ejecta);
        item.bolide.scale.setScalar(radius * (0.005 + heating * 0.026) * item.scale);
        item.bolide.material.opacity = heating * 0.85 * inView;

        // The airburst and the fireball behind it.
        const white = since < 0 ? 0 : Math.max(0, 1 - since / 0.035);
        const flashSize = radius * (0.004 + white * 0.05 * item.scale);
        item.flash.scale.setScalar(flashSize);
        item.flash.position.copy(item.normal).multiplyScalar(radius + flashSize * 0.5);
        item.flash.material.opacity = Math.pow(white, 0.4) * inView;

        const burning = since < 0 ? 0 : Math.max(0, 1 - since / 0.13);
        const fireSize = radius * (0.008 + burning * 0.085 * item.scale);
        item.fireball.scale.setScalar(fireSize);
        item.fireball.position.copy(item.normal).multiplyScalar(radius + fireSize * 0.45);
        item.fireball.material.opacity = Math.pow(burning, 1.5) * 0.8 * inView;

        item.glare.set(
          THREE.MathUtils.degToRad(7 * item.scale),
          THREE.MathUtils.degToRad(6.4 * item.scale),
          0,
          glareColour, Math.pow(burning, 2) * 0.55, 2.2, null, cameraLocal,
        );

        /*
         * The ejecta curtain. A ground impact throws its debris out low and
         * wide rather than straight up, and the arcs are ballistic because
         * everything above the ground here is on one.
         */
        const debrisAge = since < 0 ? -1 : since / 0.34;
        if (debrisAge < 0 || debrisAge > 1) {
          item.debris.visible = false;
        } else {
          item.debris.visible = true;
          const apex = radius * 0.030 * item.scale;
          const reach = THREE.MathUtils.degToRad(5.5 * item.scale);
          const position = item.debrisGeometry.getAttribute("position");
          const tint = item.debrisGeometry.getAttribute("color");

          for (let grain = 0; grain < item.grains.length; grain += 1) {
            const spec = item.grains[grain];
            const flight = THREE.MathUtils.clamp((debrisAge - spec.lead) / (1 - spec.lead), 0, 1);
            const climb = Math.cos(spec.tilt) * spec.speed * 4 * flight * (1 - flight);
            const swept = reach * Math.sin(spec.tilt) * spec.speed * flight;

            ejecta.copy(item.normal).multiplyScalar(Math.cos(swept))
              .addScaledVector(spec.tangential, Math.sin(swept))
              .multiplyScalar(radius + apex * climb);
            position.setXYZ(grain, ejecta.x, ejecta.y, ejecta.z);

            // Glowing where it leaves, cold rock dust by the time it lands.
            debrisTone.copy(dustHot).lerp(dustCold, smoothstep(0.15, 0.7, flight));
            const level = spec.glow * Math.sin(Math.min(1, flight * 1.05) * Math.PI) ** 0.6;
            tint.setXYZ(grain, debrisTone.r * level, debrisTone.g * level, debrisTone.b * level);
          }
          position.needsUpdate = true;
          tint.needsUpdate = true;
          item.debrisMaterial.opacity = (1 - Math.pow(debrisAge, 2.2)) * 0.75;
        }

        // The mark on the ground, which is the part that stays.
        const settling = smoothstep(0.02, 0.2, since);
        if (settling > 0.002) {
          const spreading = smoothstep(0.02, 0.9, since);
          const width = THREE.MathUtils.degToRad(1.6 + spreading * 2.6 * item.scale);
          item.scar.set(
            width * 1.3, width, 0, scarColour,
            settling * (0.82 - spreading * 0.18), 1.7, sunLocal, cameraLocal,
          );
        } else {
          item.scar.set(0, 0, 0, scarColour, 0);
        }
      }
    },
    dispose() {
      rockGeometry.dispose();
      wakeGeometry.dispose();
      wakeMaterial.dispose();
      meteors.forEach((item) => {
        item.rock.material.dispose();
        item.head.material.dispose();
      });
      strikes.forEach((item) => {
        item.rock.geometry.dispose();
        item.rock.material.dispose();
        item.bolide.material.dispose();
        item.flash.material.dispose();
        item.fireball.material.dispose();
        item.glare.dispose();
        item.scar.dispose();
        item.debrisGeometry.dispose();
        item.debrisMaterial.dispose();
      });
      meteors.length = 0;
      strikes.length = 0;
    },
  };
}

/**
 * The Sun throws part of itself away.
 *
 * A coronal mass ejection lifts of order a billion tonnes of plasma out of the
 * corona at up to three thousand kilometres a second. At solar maximum they
 * happen several times a day; at minimum, about one every five days. The
 * fastest reach Earth in under a day, and it is these, not the light of a
 * flare, that drive the big geomagnetic storms and the aurorae.
 *
 * Drawn as an expanding bright shell off one limb, which is how they look in a
 * coronagraph -- lopsided, directional, and gone within the hour.
 */
/*
 * The noise the rest of this scene is built from, so the ejection is made of
 * the same stuff as the gas around it. Value noise, four octaves, identical in
 * form to the Sun's own surface shader -- if this used a different generator
 * the eruption would read as a foreign object pasted over the star.
 */
const VOLUME_NOISE = /* glsl */`
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
  }

  /*
   * Three octaves, not four.
   *
   * This is called once per accepted sample along every ray, so its cost is
   * multiplied by the step count and then by every pixel the shell covers --
   * it is, by a wide margin, the most expensive arithmetic in the scene. The
   * fourth octave contributes an eighth of the amplitude at a scale finer than
   * one screen pixel at any sane viewing distance, so it costs a quarter of
   * the whole shader to render detail nobody can resolve. The remaining three
   * are renormalised so the field keeps the same range and the eruption does
   * not simply get dimmer.
   */
  float fbm3D(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 3; i++) {
      value += amplitude * noise3D(p);
      p = p * 2.03 + vec3(6.4, 9.1, 3.7);
      amplitude *= 0.5;
    }
    return value * 1.143;
  }
`;

function createSolarEjection(target, camera) {
  const group = new THREE.Group();
  group.name = "Coronal mass ejection event";
  const radius = localRadius(target);

  /*
   * Drawn as a volume, not as particles.
   *
   * Every earlier version of this was a point cloud, and no number of points
   * ever fixed the real problem: a coronal mass ejection is not made of
   * separate things. It is a continuous fluid -- a billion tonnes of ionised
   * gas -- and the eye knows the difference immediately. Forty thousand
   * sprites still read as forty thousand sprites, because each one has an
   * edge, and a fluid has none anywhere.
   *
   * So this marches a ray through a density field instead. Nothing is placed;
   * a function says how much plasma is at each point in space, and the
   * fragment shader adds up what it sees through. That is the same technique
   * the background gas and the Sun's own surface are built with, which is why
   * this now belongs to them rather than sitting on top.
   *
   * The field carries the structure every white-light coronagraph image shows:
   * a bright leading arc of coronal plasma swept up ahead of the ejection; a
   * dark cavity behind it -- the magnetic flux rope, emptier than the corona it
   * displaced, so it reads as a hole rather than a glow; and a bright knotty
   * core inside that, the filament of cool dense prominence material that was
   * sitting in the rope before it erupted, and which therefore leaves the
   * surface after the front does.
   *
   * Brightness follows density, so compressed parts are white-hot and thin
   * parts fall away cool and faint. That is not a stylistic choice: what is
   * being seen is Thomson scattering, sunlight bounced off free electrons, so
   * more electrons is literally more light -- and it is the Sun's own light,
   * which is why it is white.
   */
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Several of them at once, and they let go of the surface as they go.
   *
   * The Sun does not erupt once and then wait. At solar maximum it throws
   * several a day, and a coronagraph frame routinely catches one big event
   * with two or three lesser ones somewhere else on the limb. So this runs a
   * handful of sites: one that dominates, one that is worth looking at, and a
   * few small ones that only just register.
   *
   * And each one detaches. A CME starts rooted -- the flux rope is anchored at
   * both footpoints and material is still being fed up the legs -- and then
   * the neck pinches off and the bubble goes on alone, exactly the way a
   * bubble leaves the bottom of a pan of boiling water: it swells in place, it
   * necks, it separates, it rises away. Modelling the trailing edge as
   * something that sits on the photosphere for a while and then lifts is the
   * whole of that behaviour, and it is also what the real thing does.
   */
  const SITES = 5;
  const REACH = 5.6;
  const bound = radius * (REACH + 0.6);
  const sunFraction = radius / bound;

  const axes = [];
  const shapes = [];
  const profiles = [];
  const sites = [];

  for (let index = 0; index < SITES; index += 1) {
    // The first site is the event; the rest are the weather around it.
    const heavy = index === 0;
    const moderate = index === 1;
    const strength = heavy ? 1 : moderate ? 0.42 : 0.1 + Math.random() * 0.1;
    const reach = heavy
      ? REACH
      : moderate ? 2.4 + Math.random() * 0.8 : 1.1 + Math.random() * 0.9;

    sites.push({
      axis: limbPoint(facing, new THREE.Vector3()),
      strength,
      reach,
      // Staggered, so they pop one after another rather than together.
      startAt: heavy ? 0.02 : 0.1 + index * 0.13 + Math.random() * 0.08,
      span: heavy ? 0.95 : 0.42 + Math.random() * 0.22,
      // Narrow lobes for the small ones: a little event is a jet, not a dome.
      tightness: heavy ? 3 : moderate ? 5 : 9,
      /*
       * When the neck pinches and how fast the base then climbs. The big one
       * stays rooted longest, because it is being fed for longer.
       */
      /*
       * The heavy one stays rooted well past halfway now. Letting go at 0.46
       * put the separation at about the moment the cloud cleared the star's
       * glow, so the first clearly visible thing was already detached -- the
       * eruption read as something that arrived rather than something that
       * left.
       */
      detachAt: heavy ? 0.56 : 0.3 + Math.random() * 0.12,
      liftRate: heavy ? 0.5 : 0.75 + Math.random() * 0.4,
    });

    axes.push(sites[index].axis.clone());
    shapes.push(new THREE.Vector4(sunFraction, sunFraction, 0, 0));
    // w: the smallest axis alignment at which this lobe still registers. See
    // the cone test in the shader -- it exists to skip a pow(), not to shape.
    profiles.push(new THREE.Vector4(
      sites[index].tightness,
      0,
      index * 7.3,
      Math.pow(0.0015, 1 / sites[index].tightness),
    ));
  }

  const uniforms = {
    uGain: { value: 0 },
    uTime: { value: 0 },
    uSunFraction: { value: sunFraction },
    uAxis: { value: axes },
    // x = leading edge, y = trailing edge, z = strength, w = core level
    uShape: { value: shapes },
    // x = lobe tightness, y = how attached to the surface, z = noise seed,
    // w = the axis alignment below which this lobe contributes nothing
    uProfile: { value: profiles },
    /*
     * White, and white all the way down.
     *
     * A coronagraph does not see a CME glowing. It sees ordinary photospheric
     * sunlight -- every colour of it -- Thomson-scattered off free electrons in
     * the ejected plasma, and scattering off free electrons has no colour
     * preference at all. So the thing is the colour of the Sun's own light, and
     * every white-light image of one from Skylab to LASCO shows exactly that:
     * white where it is dense, grey where it is thin, and nothing else. The
     * blue this used to fade to at low density was the one part of the picture
     * with no observation behind it.
     */
    uHot: { value: new THREE.Color(0xffffff) },
    uCool: { value: new THREE.Color(0xd3d7dd) },
    /*
     * The camera in the volume's own coordinates, worked out once a frame on
     * the processor rather than per fragment.
     *
     * The obvious way to write this is inverse(modelMatrix) * cameraPosition
     * inside the shader, and it is wrong twice: inverse() exists only in the
     * newer shading language, so it would fail outright on a WebGL 1 context,
     * and it inverts a matrix once per pixel to compute a value that is the
     * same for every pixel in the frame.
     */
    uCameraObject: { value: new THREE.Vector3() },
    /*
     * How far out anything is, right now, in the shell's own units.
     *
     * The shell is built once at the eruption's final size, so for most of the
     * event the great majority of the pixels it covers are empty space that
     * the ray marcher walks through sample by sample and finds nothing in.
     * Carrying the current front radius lets a ray test itself against the
     * live extent and give up before it starts -- and lets the ones that do
     * march spend all their samples inside the part that has material in it,
     * rather than spreading them over a volume six times too big.
     */
    uMaxHead: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    /*
     * Depth testing is off and the star is handled by hand instead.
     *
     * The mesh is a back-facing shell, so its fragments lie *behind* the Sun
     * and the depth buffer would throw the whole eruption away. Ending each
     * ray on the star's surface is both the fix and the physically right
     * thing: the photosphere is opaque, so nothing behind it contributes.
     */
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
    vertexShader: /* glsl */`
      varying vec3 vObjectPosition;

      void main() {
        vObjectPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      #define SITES ${SITES}

      varying vec3 vObjectPosition;

      uniform float uGain;
      uniform float uTime;
      uniform float uSunFraction;
      uniform vec3 uAxis[SITES];
      uniform vec4 uShape[SITES];
      uniform vec4 uProfile[SITES];
      uniform vec3 uHot;
      uniform vec3 uCool;
      uniform vec3 uCameraObject;
      uniform float uMaxHead;

      ${VOLUME_NOISE}

      /*
       * How much plasma is at this point, summed over every eruption running.
       *
       * The per-site work is inlined into the loop rather than sitting in a
       * function that takes the site number. That looks like a style choice
       * and is not: in the older shading language, indexing a uniform array is
       * only guaranteed to compile when the index is a loop counter, and
       * handing that counter to a function loses the guarantee. Written this
       * way it compiles everywhere, including on a WebGL 1 fallback context.
       */
      float sampleDensity(vec3 p) {
        float r = length(p);
        if (r < uSunFraction) return 0.0;
        vec3 d = p / max(r, 1e-5);

        float total = 0.0;

        for (int i = 0; i < SITES; i++) {
          vec4 shape = uShape[i];
          vec4 profile = uProfile[i];
          float head = shape.x;
          float tail = shape.y;
          float strength = shape.z;

          if (strength > 0.0 && head > tail) {
            float toward = max(0.0, dot(d, uAxis[i]));

            /*
             * The cone this lobe can possibly reach, tested before the power
             * is taken rather than after.
             *
             * A tightness of nine means the lobe has faded to nothing within
             * about sixty degrees of its axis, so for most directions the
             * pow() below was computed only to be thrown away -- five of them,
             * at every sample, on every ray. The cutoff is the alignment at
             * which the lobe falls under the old threshold, worked out once on
             * the processor when the site is built.
             */
            if (toward > profile.w) {
              /*
               * A narrow foot that opens as it rises.
               *
               * The lobe used to be one width at every height, which meant the
               * eruption left the star across the same forty-odd degrees of
               * limb that it ended up spanning five radii out -- a dome
               * sitting on the surface rather than something coming out of a
               * place on it. A real ejection leaves through one active region,
               * a small patch, and only opens into a fan once it is clear of
               * the field that held it.
               *
               * Tightening by a fixed amount rather than by a multiple keeps
               * every site's foot the same size: the big one and the small
               * ones all start as a spot and each opens to its own width.
               *
               * The cone cutoff in profile.w is computed for the widest this
               * lobe ever gets, so a tighter one here can only fall inside it
               * -- the test stays correct.
               */
              float height = clamp(
                (r - uSunFraction) / max(1e-4, head - uSunFraction), 0.0, 1.0);
              float rooted = (1.0 - height) * (1.0 - height);
              /*
               * A cone that opens as it climbs, anchored on a small patch.
               *
               * Every photograph of one of these shows the same geometry: the
               * legs converge on an active region a fraction of the Sun's
               * width across, and the thing they carry is half a hemisphere
               * wide by the time it clears the occulter. Raising the exponent
               * near the surface and dropping it at the head is what draws
               * that -- 22 at the footpoint is a lobe a few degrees across; 3
               * at the front is a cone seventy degrees wide.
               */
              float lobe = pow(toward, profile.x + 22.0 * rooted);
              /*
               * Where the point sits between the trailing and leading edges of
               * this bubble. Once the trailing edge lifts off the photosphere
               * the whole band travels as one detached thing, and that is the
               * separation.
               */
              float x = (r - tail) / max(1e-4, head - tail);

              if (x > -0.3 && x < 1.2) {
                /*
                 * The bands are Gaussians, squared by multiplication rather
                 * than with pow(). Raising a negative number to a power is
                 * undefined in this shading language, and every one of these
                 * offsets is negative on the inner side of its band -- so on a
                 * strict driver the front, the cavity and the core would each
                 * come out as garbage across half their width.
                 */
                // The swept-up front, compressed and bright.
                float atFront = (x - 0.92) / 0.075;
                float front = exp(-atFront * atFront) * 2.1;
                // The body of the ejection, thinning as it expands.
                float body = smoothstep(-0.15, 0.3, x)
                  * (1.0 - smoothstep(0.8, 1.15, x)) * 0.6;
                // The cavity: emptier than what it displaced, so it reads as a
                // hole rather than a glow.
                float atCavity = (x - 0.58) / 0.19;
                float cavity = 1.0 - 0.78 * exp(-atCavity * atCavity);
                // The prominence, rising later and only up the middle.
                float atCore = (x - 0.28) / 0.105;
                float core = exp(-atCore * atCore) * shape.w
                  * smoothstep(0.55, 0.9, toward);

                total += (body * cavity + front + core) * lobe * strength;
              }

              /*
               * The stem: the part that stays on the star.
               *
               * This used to be one term inside the bubble's band, and that is
               * why the eruption looked like it began out in space. The band is
               * measured from the trailing edge, so the moment that edge lifted
               * off the photosphere every radius below it fell outside the band
               * and the whole low corona was skipped -- the cloud kept its
               * light and the star kept nothing, leaving a bright thing with a
               * gap under it and no visible origin.
               *
               * A real ejection does detach, but it does not leave the surface
               * empty. The legs go on feeding while the rope is anchored, and
               * after it lets go the flare arcade underneath stays lit for
               * hours. So this is its own structure now, living in the low
               * corona whatever the bubble above it is doing, bright while the
               * eruption is rooted and fading to a residue afterwards.
               *
               * Its brightness is carried entirely in profile.y rather than
               * being multiplied by the site's strength, because strength falls
               * away as the cloud expands and the footpoint does not.
               *
               * The 1.5 was picked by measuring, not by eye. Rendering the same
               * five moments at a range of values and reading the peak
               * brightness the eruption adds at each height: 2.2 blew a sixth
               * of the disc to flat white, and 0.8 left the foot dimmer than
               * the cloud above it. At 1.5 the limb reads 234 against the old
               * build's 73 early on, and 77 against 30 once the bubble has
               * detached, with nothing clipped anywhere.
               */
              if (profile.y > 0.001) {
                float stemTop = uSunFraction * 2.4;
                if (r < stemTop) {
                  float down = (r - uSunFraction) / (stemTop - uSunFraction);
                  total += profile.y * 1.5 / (1.0 + 9.0 * down * down) * lobe;
                }
              }
            }
          }
        }

        if (total <= 0.0) return 0.0;

        /*
         * Turbulence, sampled once for the point rather than once per site.
         *
         * It is what makes this look like gas rather than like a formula, and
         * doing it per site would multiply the most expensive thing in the
         * shader by five for no visible gain -- the sites barely overlap, so
         * one field of noise serves all of them. Sampled in the direction the
         * material left in, so filaments stretch radially the way a real
         * outflow's do, and drifting slowly so the whole thing lives.
         */
        /*
         * Threads, not clouds.
         *
         * The structure inside a CME runs radially -- it is plasma strung
         * along magnetic field lines that all point away from the Sun, and the
         * coronagraph images are full of fine bright filaments running from
         * the legs to the front. Sampling the noise on the *direction* alone
         * gives exactly that, because a field that varies across the sphere
         * and not along the radius is a set of rays. The old sampling added a
         * strong radial term (r * 3.0) which broke the rays into blobs and
         * made the ejection look like smoke.
         */
        vec3 q = d * 11.0;
        q.z += uTime * 0.04;
        /*
         * Two octaves here rather than the shared three, and it is worth two
         * milliseconds a frame.
         *
         * This is the most expensive shader in the project by a wide margin --
         * the camera sits inside the volume, so every pixel on the screen walks
         * fourteen samples and each sample asks for noise. Measured at the
         * event's own framing it cost 8.0 ms a frame; the third octave lands at
         * a frequency of forty-five across the sphere, which is finer than a
         * screen pixel at any distance the Sun is ever framed from, so it was
         * paying full price for detail that could not be resolved.
         */
        vec3 base = q + vec3(0.0, 0.0, r * 0.9);
        float turbulence = (noise3D(base) * 0.5
          + noise3D(base * 2.03 + vec3(6.4, 9.1, 3.7)) * 0.25) * 1.333;

        return max(0.0, total * (0.35 + 1.3 * turbulence));
      }

      void main() {
        vec3 origin = uCameraObject;
        vec3 exitPoint = vObjectPosition;
        vec3 direction = exitPoint - origin;
        float span = length(direction);
        if (span < 1e-5) discard;
        direction /= span;

        /*
         * March from wherever the ray enters the shell to wherever it leaves
         * -- or to the surface of the star, whichever comes first. The star is
         * opaque, so anything behind it is not seen.
         */
        float b = dot(origin, direction);
        /*
         * Against the live extent rather than against the shell. Early on, and
         * for the four smaller sites throughout, that sphere is a fraction of
         * the shell's radius, so most rays miss it outright and cost one
         * quadratic instead of fourteen volume samples.
         */
        float far = uMaxHead;
        float c = dot(origin, origin) - far * far;
        float disc = b * b - c;
        if (disc < 0.0) discard;
        float root = sqrt(disc);
        float tNear = max(0.0, -b - root);
        float tEnd = min(span, -b + root);

        // Stop at the photosphere if the ray runs into it.
        float sunC = dot(origin, origin) - uSunFraction * uSunFraction;
        float sunDisc = b * b - sunC;
        if (sunDisc > 0.0) {
          float sunNear = -b - sqrt(sunDisc);
          if (sunNear > tNear) tEnd = min(tEnd, sunNear);
        }
        if (tEnd <= tNear) discard;

        const int STEPS = 14;
        float stepSize = (tEnd - tNear) / float(STEPS);
        /*
         * A per-pixel offset on the first step. Samples this far apart would
         * otherwise lay down visible shells -- the banding you get whenever
         * every ray samples at the same depths -- and dithering the start
         * turns that into noise the eye ignores. It is also what pays for the
         * step count coming down: with the interval now clipped to the part of
         * the volume that has anything in it, fourteen jittered samples cover
         * the cloud about as finely as twenty-six spread over the whole shell.
         */
        float jitter = hash31(vec3(gl_FragCoord.xy, uTime * 60.0));
        float t = tNear + stepSize * jitter;

        vec3 glow = vec3(0.0);
        for (int i = 0; i < STEPS; i++) {
          float density = sampleDensity(origin + direction * t);
          if (density > 0.0002) {
            /*
             * Hotter where it is denser. Compression heats plasma and there is
             * simply more of it to scatter, so the swept-up front and the core
             * come out white while the thin outer flow falls away cool -- which
             * is the range of "hotness" a coronagraph actually records.
             */
            vec3 tone = mix(uCool, uHot, clamp(density * 1.5, 0.0, 1.0));
            glow += tone * density * stepSize;
          }
          t += stepSize;
        }

        glow *= uGain;
        float strength = max(glow.r, max(glow.g, glow.b));
        if (strength < 0.002) discard;
        gl_FragColor = vec4(glow, 1.0);
      }
    `,
  });

  const volume = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), material);
  volume.scale.setScalar(bound);
  volume.frustumCulled = false;
  volume.renderOrder = 3;

  const cameraObject = new THREE.Vector3();

  /*
   * Where the camera is, worked out at the moment this mesh is drawn.
   *
   * For a raymarched volume the viewpoint is not a detail of the shading -- it
   * is the geometry. Every ray starts here, so if this uniform describes a
   * different camera from the one the frame is being rendered with, the whole
   * eruption is reconstructed around a viewpoint that is not there: it detaches
   * from the star and floats, with an empty gap where the low corona should be.
   *
   * It used to be written in `update()`, once per animation step, which is a
   * frame-ordering promise the renderer never made. Anything that draws the
   * scene without an animation step first -- a second pass, a resize, a frame
   * where the star's own scale settles after the events have run -- draws the
   * eruption from wherever the camera was last time the clock ticked. Zooming
   * while a CME is running is the case that shows it, because that is when the
   * viewpoint moves fastest.
   *
   * `onBeforeRender` is called by the renderer immediately before this object
   * is submitted, after every world matrix in the scene has been brought up to
   * date, and it is handed the camera actually being rendered with. There is no
   * ordering left to get wrong.
   */
  volume.onBeforeRender = (renderer, scene, renderCamera) => {
    const eye = renderCamera ?? camera;
    if (!eye) return;
    eye.getWorldPosition(cameraObject);
    volume.worldToLocal(cameraObject);
    uniforms.uCameraObject.value.copy(cameraObject);
  };

  group.add(volume);

  /*
   * The flare that goes with the main event. The bright kernel at the
   * footpoint is not the ejection -- it is the reconnection underneath that
   * let go of it -- and it is over long before the cloud has gone anywhere.
   */
  const kernel = makeSurfaceGlow(0xffffff, 0);
  group.add(kernel);

  const kernelView = new THREE.Vector3();

  return {
    group,
    duration: 18,
    update(progress) {
      const fade = 1 - smoothstep(0.78, 1, progress);

      // The viewpoint is not set here; see `volume.onBeforeRender`.
      let maxHead = 0;

      for (let index = 0; index < SITES; index += 1) {
        const site = sites[index];
        const age = (progress - site.startAt) / site.span;
        const shape = shapes[index];
        const profile = profiles[index];

        if (age <= 0 || age > 1.25) {
          shape.z = 0;
          profile.y = 0;
          continue;
        }

        /*
         * Self-similar expansion, starting slow: an ejection accelerates out
         * of the corona rather than appearing at speed.
         */
        const climbed = Math.pow(Math.min(age, 1), 1.5) * site.reach;
        shape.x = sunFraction * (1 + climbed);

        /*
         * The trailing edge, and this is the separation. It sits on the
         * photosphere while the rope is still anchored, then lifts once the
         * neck pinches -- so what was a dome growing out of the surface
         * becomes a bubble travelling on its own with a gap beneath it.
         */
        const detached = Math.max(0, age - site.detachAt);
        shape.y = sunFraction * (1 + detached * detached * site.liftRate * site.reach * 2.2);
        shape.y = Math.min(shape.y, shape.x * 0.92);

        /*
         * Density falls as the volume grows, and brightness follows it -- which
         * is why coronagraphs have to be processed hard to see one far out.
         */
        const spent = 1 - smoothstep(0.72, 1.2, age);
        shape.z = site.strength * spent / (1 + climbed * 0.45);
        // The prominence leaves after the front does and climbs inside it.
        shape.w = smoothstep(0.1, 0.4, age) * 1.4 * (index === 0 ? 1 : 0.5);

        /*
         * The stem. Full while the rope is anchored, then a quarter of that
         * once the neck pinches -- the arcade left behind rather than nothing
         * -- and out with the rest of the event at the end.
         */
        const anchored = 1 - smoothstep(site.detachAt - 0.08, site.detachAt + 0.16, age);
        const alive = 1 - smoothstep(0.8, 1.08, age);
        profile.y = site.strength * alive * (0.26 + 0.74 * anchored);

        if (shape.z > 0 && shape.x > maxHead) maxHead = shape.x;
      }

      uniforms.uTime.value = progress * 18;
      uniforms.uGain.value = fade * 2.6;
      /*
       * A little past the furthest front, because the swept-up shell has
       * width, and never past the shell itself.
       */
      uniforms.uMaxHead.value = Math.min(1, maxHead * 1.06);
      /*
       * Nothing to march through before the first site opens or after the last
       * one fades, and a full-screen shell that resolves to nothing is still a
       * full-screen shell. Skipping the draw outright is free.
       */
      volume.visible = maxHead > sunFraction * 1.001 && uniforms.uGain.value > 0.001;

      // The flare kernel: a hard white spike at the footpoint, gone quickly.
      const flare = Math.max(0, 1 - Math.max(0, progress - sites[0].startAt) / 0.16);
      const kernelSize = radius * (0.03 + flare * 0.16);
      kernel.scale.setScalar(kernelSize);
      kernel.position.copy(sites[0].axis).multiplyScalar(radius * 1.01);
      /*
       * Faded by which way the footpoint is facing, because it cannot be hidden
       * any other way.
       *
       * `makeSurfaceGlow` turns depth testing off -- see the note there, on
       * camera-facing quads being sliced by the sphere they sit on -- and the
       * contract that comes with that is the caller honouring the limb itself.
       * This one never did. Sites are placed close to the limb by design, so
       * roughly half the time the flare's footpoint is on the far side of the
       * star and its bright kernel was still drawn straight over the disc.
       */
      localCameraDirection(target, camera, kernelView);
      const facing = smoothstep(-0.05, 0.22, sites[0].axis.dot(kernelView));
      kernel.material.opacity = Math.pow(flare, 0.6) * 0.9 * facing;
    },
    dispose() {
      volume.onBeforeRender = () => {};
      volume.geometry.dispose();
      material.dispose();
      kernel.material.dispose();
      sites.length = 0;
    },
  };
}

/**
 * Mars disappears under its own dust.
 *
 * On average once every three Mars years -- about five and a half Earth years
 * -- a regional dust storm fails to die and instead grows until it wraps the
 * entire planet. The 2018 one ended Opportunity's mission. They start in the
 * southern hemisphere's summer, and the reason is orbital: Mars has a
 * noticeably eccentric orbit, so southern summer is also perihelion, the
 * planet is significantly hotter, and there is enough radiative forcing to
 * lift dust faster than it settles. Once airborne the dust absorbs sunlight,
 * heats the air around it, and drives the winds that lift more of it.
 *
 * The winds themselves are unimpressive by Earth standards -- around 60 mph --
 * and in an atmosphere one percent as dense as ours they could not knock a
 * person over. What they can do is keep a very great deal of extremely fine
 * dust in suspension for weeks to months.
 *
 * Staged as an ochre veil closing over the disc and then slowly clearing,
 * because that is exactly what the telescope images show: surface features
 * fading out over days until nothing is left but a featureless butterscotch
 * ball.
 */

/**
 * Keeps a surface shader's sun and view directions honest.
 *
 * Both are per-frame facts about where the camera and the star are relative to
 * a body, and both decide *shape*: the sun direction places the terminator, the
 * view direction places the limb fade. Written once per animation step -- which
 * is what every one of these did -- they belong to whatever camera the clock
 * last ticked on, and nothing promises that is the camera the frame is drawn
 * with. Turning a planet is exactly when the two disagree most, and a
 * terminator or a horizon standing in the wrong place is a hard boundary lying
 * across a curved surface: an arc that sweeps as the viewer turns.
 *
 * The coronal mass ejection had the same class of bug and the same fix; see
 * `volume.onBeforeRender` in `createSolarEjection`. `onBeforeRender` is called
 * by the renderer immediately before the object is submitted, after every world
 * matrix in the scene is up to date, and is handed the camera actually being
 * rendered with.
 */
/*
 * Depth bias for anything drawn lying ON a planet.
 *
 * A storm shell, a dust veil, an impact stain: each is a thin skin a fraction
 * of a per cent above an opaque sphere, and each has to win the depth test
 * against it at every pixel. Whether it does is a question of how finely the
 * depth buffer can still tell two surfaces apart out where the planet is, and
 * that resolution falls off as the square of the distance from the lens while
 * the gap between skin and surface stays the same size. The camera's near
 * plane sits on its floor of 0.02 against a far plane of 15,000, so by the
 * time a viewer has pulled back to the distance these events are actually
 * framed at, the two are no longer reliably separable.
 *
 * What that looks like is the bug that was reported: irregular, hard-edged
 * dark shapes flickering across the bright part of the storm, following the
 * triangle edges of whichever mesh happens to win each patch. Measured on the
 * Great White Spot across twenty-four viewpoints, with the storm at full
 * strength: no rejected pixels at two and a half planetary radii out, 1,448 at
 * the distance the event frames itself, and 27,484 at eight radii.
 *
 * Polygon offset is the right instrument because it is specified in units of
 * the depth buffer's own resolution at that depth, so it scales with the
 * problem instead of having to be guessed at in world units -- a fixed nudge
 * outwards large enough to help at forty radii would have the shell visibly
 * floating at two. Measured with these values the same sweep leaves 2 pixels
 * at eight radii, 1 at twenty and 3 at forty.
 */
function hugSurface(material) {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -8;
  material.polygonOffsetUnits = -16;
  return material;
}

function trackSurfaceLighting(mesh, target, camera) {
  const sun = new THREE.Vector3();
  const view = new THREE.Vector3();
  const spin = new THREE.Quaternion();
  const { uSun, uView } = mesh.material.uniforms;
  mesh.onBeforeRender = (renderer, scene, renderCamera) => {
    /*
     * Resolved in the SHELL's frame, not the planet's, and that distinction is
     * the whole bug this replaced.
     *
     * These shells are atmospheres, and an atmosphere turns -- the Mars veil
     * adds to its own rotation.y on every update, because dust is carried by a
     * wind that outruns the ground. The shader reads `vDirection`, which is a
     * position in the shell's own space, and compares it against uSun. Filling
     * uSun from the planet's frame therefore compared a direction in one frame
     * against a direction in another, and the error was exactly however far the
     * shell had turned: measured across a single storm it grew from 5 degrees
     * to 80. Half a minute in, the veil's terminator was most of a quadrant
     * away from the planet's, so the dust was lit where the ground was dark and
     * dark where it was lit -- a sandstorm plainly visible on the night side.
     *
     * The shell's own world rotation is what the shader is speaking in, so that
     * is what these are converted into. For a shell that does not turn it is
     * the same answer as before.
     */
    mesh.getWorldPosition(sun);
    // The Sun is at the world origin, so the way to it is the way back to the
    // origin.
    if (sun.lengthSq() < 1e-8) sun.set(0, 0, 1);
    else sun.negate().normalize();
    mesh.getWorldQuaternion(spin);
    spin.invert();
    uSun.value.copy(sun.applyQuaternion(spin));

    const eye = renderCamera ?? camera;
    if (!eye) return;
    eye.getWorldPosition(view);
    mesh.worldToLocal(view);
    if (view.lengthSq() < 1e-8) view.set(0, 0, 1);
    else view.normalize();
    uView.value.copy(view);
  };
}

function createMarsDustStorm(target, camera) {
  const group = new THREE.Group();
  group.name = "Mars global dust storm";
  const radius = localRadius(target);

  /*
   * A shell just above the surface rather than a sprite in front of it. The
   * storm is *atmospheric*, so it has to wrap the limb and follow the
   * terminator; a flat billboard would sit in front of the night side too and
   * light up a hemisphere the Sun is not on.
   */
  /*
   * Dust of uneven thickness, not a coat of paint.
   *
   * The first version of this was a single flat shell at nine-tenths opacity,
   * and what it produced was a featureless ochre ball -- which is a fair
   * description of a *fully* enveloped Mars and a poor picture of one, because
   * the planet stops being a planet. It also is not what the storm does. Global
   * dust storms are global in reach and nowhere near uniform in depth: optical
   * depth during 2018 ran from about 2 over some regions to well past 8 over
   * others, and through the thinner windows the dark albedo features -- Syrtis
   * Major, Solis Lacus -- stay faintly readable the whole way through.
   *
   * So the shell carries a drifting field of optical depth instead of a
   * constant, and it is capped well short of opaque. The surface shows through
   * everywhere a little and through the thin patches clearly, which is both the
   * more honest picture and the one where Mars is still recognisably Mars.
   */
  const veilUniforms = {
    uGain: { value: 0 },
    uTime: { value: 0 },
    uSun: { value: new THREE.Vector3(0, 0, 1) },
    uView: { value: new THREE.Vector3(0, 0, 1) },
    /*
     * Warmer than they were. A global storm photographed from orbit is a
     * yellow-orange to reddish-brown veil, and the previous pair sat close
     * enough to unsaturated cream that the planet under the storm read as
     * overcast rather than as dust. uDust is the ordinary depth of it and
     * uPale the thickest knots, which do go paler -- deep dust scatters
     * towards white -- but from an orange, not from a grey.
     *
     * Chosen by measurement rather than by eye, over the sunlit disc at the
     * height of the storm: warmth (R-B)/(R+G+B) comes out at 0.198 against
     * bare Mars's own 0.164, where the old pair measured 0.104 -- so the planet
     * under the storm now reads as more orange than Mars, which is the right
     * direction, instead of less. It still gets brighter rather than darker:
     * mean +9.6 luminance across the lit disc, and the 5.6 per cent of it that
     * does darken is the optically thickest knots, by about 12 levels.
     */
    uDust: { value: new THREE.Color(0xff9a2e) },
    uPale: { value: new THREE.Color(0xffc26a) },
  };

  const veil = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: veilUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      toneMapped: true,
      vertexShader: /* glsl */`
        varying vec3 vDirection;

        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vDirection;

        uniform float uGain;
        uniform float uTime;
        uniform vec3 uSun;
        uniform vec3 uView;
        uniform vec3 uDust;
        uniform vec3 uPale;

        ${VOLUME_NOISE}

        void main() {
          vec3 d = normalize(vDirection);

          /*
           * Two separate things the Sun does to dust, and the first version
           * conflated them.
           *
           * coverage is whether there is any dust in front of this part of
           * the planet to be seen at all, and lit is how brightly what is
           * there is being lit. The old shader had only the first: the veil's
           * colour was a fixed bright ochre and just its opacity fell away past
           * the terminator. So on the night side it laid a *bright* wash over
           * ground that had gone dark, and near the terminator a half-opaque
           * bright patch over a half-dark surface -- which is exactly the
           * blotching that was reported, and it moved as the noise drifted.
           *
           * Dust is lit, not luminous. Fading the colour is what the ground
           * under it is doing, so the dust has to do it too.
           *
           * Coverage is tested first, and that ordering is the whole
           * performance story of this shader. Unlike a storm confined to a
           * band there is no cheap geometric test to throw fragments out on --
           * every one of them would otherwise pay for the noise below. Half of
           * what the shell covers is night; one dot product is what it costs to
           * find that out. Coverage is already zero where the test cuts, so the
           * boundary cannot be seen.
           */
          float sunDot = dot(d, uSun);
          /*
           * One ramp, and it has to be one ramp.
           *
           * The previous pass used two: coverage, which reached full at the
           * terminator, and brightness, which only reached full well onto the
           * day side. Between them lay a wide band where the veil was at its
           * full opacity with its colour multiplied by almost nothing -- so it
           * painted near-black over the twilight at eighty-seven per cent, and
           * the drifting cells came out as dark smudges crossing into the night
           * side. That is the same bug as the first version wearing the other
           * face: then the dust was bright where the ground was dark, now it
           * was dark where the ground was not.
           *
           * What both attempts missed is that opacity and brightness are not
           * independent here. Alpha blending means an unlit shell does not
           * merely fail to add light, it *removes* what is behind it. So the
           * dust has to stop covering at exactly the rate it stops being lit;
           * anything else leaves a shroud. Sharing the ramp guarantees it.
           */
          /*
           * Squared, and starting at the terminator rather than before it.
           *
           * The shared ramp fixed the shroud but was still far too generous
           * about what counts as lit: at the terminator itself it left the veil
           * at a third of full strength, so there was plainly a sandstorm on
           * ground that has no sunlight on it. Dust is only visible because
           * sunlight is scattering off it, and the light arriving falls with
           * the cosine of the angle -- squaring the ramp is the cheap way to
           * make the last stretch before the terminator go dim in a hurry
           * rather than linger.
           *
           * At five degrees past the terminator the veil is now under half a
           * per cent of full; at ten, nine per cent; and full strength only
           * once the Sun is properly up. Which is the honest answer to "in the
           * dark, could you see anything?".
           */
          float lit = smoothstep(-0.02, 0.45, sunDot);
          lit *= lit;
          if (lit < 0.004) discard;

          /*
           * Optical depth: broad cells drifting with the wind with a finer
           * field over the top. Two octaves by hand rather than the shared
           * four-octave walk, because this runs on every pixel of the planet
           * and the octaves past the second are finer than the dust looks at
           * any distance anyone views Mars from. Sampled in three dimensions on
           * the direction itself, so there is no seam at the date line and no
           * pinching at the poles -- the two things that give a flat noise
           * texture wrapped on a sphere away.
           */
          vec3 drift = vec3(uTime * 0.05, 0.0, uTime * 0.02);
          float broad = noise3D(d * 2.6 + drift) * 0.66
            + noise3D(d * 6.3 - drift * 0.7) * 0.34;
          float fine = 0.5;
          /*
           * Stretched across its useful range before it is used.
           *
           * Summed octaves of noise pile up around the middle: measured, the
           * raw field spent nine tenths of the disc inside a span of three
           * tenths, so every part of the planet was hidden by very nearly the
           * same amount and the veil came out as a flat wash with a slight
           * texture. Pulling the middle of that distribution out to the full
           * zero-to-one range is what turns it into weather -- thick knots and
           * thin windows, which is what an optical depth map of a real storm
           * looks like.
           */
          float cell = smoothstep(0.30, 0.76, broad);
          float depth = 0.26 + 1.30 * cell + 0.28 * fine;

          /*
           * Thicker towards the limb, because a line of sight that grazes the
           * planet travels much further through the same atmosphere than one
           * looking straight down. It is why the limb of a dusty Mars goes
           * solid while the middle of the disc is still translucent.
           */
          float toward = dot(d, uView);
          float slant = 1.0 + 0.85 * (1.0 - smoothstep(0.0, 0.75, toward));

          float alpha = clamp(depth * slant * uGain, 0.0, 0.87) * lit;

          /*
           * Thicker dust scatters paler, which is what makes the deepest part
           * of a storm look like cloud rather than like ground -- and both ends
           * of that ramp are brighter than the terrain they cover, because a
           * planet under a global storm gets *lighter*, not darker. The first
           * pass used a tone darker than the dust-brightened surface around it,
           * so the thickest cells read as dirty smudges lying on Mars rather
           * than as the storm itself.
           */
          vec3 tone = mix(uDust, uPale, clamp((depth - 0.55) * 0.9, 0.0, 1.0));
          /*
           * The colour keeps a floor while the coverage does not. Dust in
           * twilight is dim but not black, and by the time this matters the
           * alpha above has already taken the shell most of the way out.
           */
          gl_FragColor = vec4(tone * (0.06 + 0.94 * lit), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  veil.scale.setScalar(radius * 1.022);
  hugSurface(veil.material);
  trackSurfaceLighting(veil, target, camera);
  group.add(veil);

  /*
   * A second, thinner shell a little higher: the high-altitude haze that
   * outlives the storm itself and gives the limb its soft edge.
   *
   * It used to be a plain unlit colour added at a flat opacity, which meant it
   * laid the same warm band right around the planet -- including the quarter of
   * the limb that is in night. Additive blending cannot darken anything, so it
   * never showed up as a shroud; it showed up as a dust glow hanging over
   * ground with no sunlight on it, which is the same complaint in a quieter
   * voice. It gets the veil's lit ramp for the same reason the veil does.
   */
  const hazeUniforms = {
    uGain: { value: 0 },
    uSun: { value: new THREE.Vector3(0, 0, 1) },
    uView: { value: new THREE.Vector3(0, 0, 1) },
    uTint: { value: new THREE.Color(0xe2a05a) },
  };

  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 22),
    new THREE.ShaderMaterial({
      uniforms: hazeUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: true,
      vertexShader: /* glsl */`
        varying vec3 vDirection;

        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vDirection;

        uniform float uGain;
        uniform vec3 uSun;
        uniform vec3 uView;
        uniform vec3 uTint;

        void main() {
          vec3 d = normalize(vDirection);
          // The same squared ramp the veil below uses, so the two go out
          // together rather than leaving the haze behind on the night side.
          float lit = smoothstep(-0.02, 0.45, dot(d, uSun));
          lit *= lit;
          if (lit < 0.004) discard;
          // Brightest where the line of sight runs along the shell rather than
          // through it, which is what makes it read as a limb.
          float grazing = 1.0 - abs(dot(d, uView));
          float alpha = uGain * lit * (0.25 + 0.75 * grazing * grazing);
          gl_FragColor = vec4(uTint * lit, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  haze.scale.setScalar(radius * 1.055);
  trackSurfaceLighting(haze, target, camera);
  group.add(haze);

  return {
    group,
    duration: 22,
    update(progress) {
      // Weeks to grow, months to clear: the rise is far steeper than the fall,
      // which is the shape of the real optical-depth curves.
      const grow = smoothstep(0.02, 0.34, progress);
      const clear = 1 - smoothstep(0.55, 1, progress);
      const strength = grow * clear;

      // The sun and view directions are not set here; see trackSurfaceLighting.
      /*
       * The ceiling that keeps Mars visible on the day side, where the ramp
       * above has already taken the veil out of the twilight.
       *
       * Measured over the lit disc at the height of the storm: about 0.28
       * opaque in the thin windows, 0.87 in the thickest knots, and a shade
       * under a half in the middle. So the surface is putting up the majority
       * of the light across roughly half the disc, a little of it everywhere,
       * and nowhere is the planet completely gone. The old flat shell was 0.92
       * from limb to limb.
       */
      veilUniforms.uGain.value = strength * 0.68;
      veilUniforms.uTime.value = progress * 22;

      hazeUniforms.uGain.value = strength * 0.34;
      // The dust is in the atmosphere and the atmosphere is turning.
      veil.rotation.y += 0.0016;
      haze.rotation.y -= 0.0011;
    },
    dispose() {
      veil.geometry.dispose(); veil.material.dispose();
      haze.geometry.dispose(); haze.material.dispose();
    },
  };
}

/**
 * Saturn's Great White Spot.
 *
 * Once per Saturnian year -- once every thirty Earth years -- Saturn stops
 * being bland. A storm erupts in the northern hemisphere, spreads along its
 * own latitude at a few hundred kilometres an hour, and within months has
 * wrapped the entire planet in a bright band tens of thousands of kilometres
 * long. The 2010 outbreak that Cassini watched was the largest ever recorded:
 * it ran for months, and it changed the temperature and composition of
 * Saturn's atmosphere for more than three years afterwards.
 *
 * The mechanism is a slow charge and a fast discharge. Water vapour is heavy
 * enough that it sits far below the visible cloud deck and cannot convect
 * through the lighter dry air above it -- so heat accumulates underneath for
 * decades until the layer finally overturns, all at once, in the most violent
 * lightning storm in the Solar System.
 *
 * Staged as a bright head appearing at northern mid-latitude and drawing
 * itself out into a band that wraps the planet.
 */
function createSaturnWhiteSpot(target, camera) {
  const group = new THREE.Group();
  group.name = "Saturn Great White Spot";
  const radius = localRadius(target);

  /*
   * Drawn into the cloud deck, not hung above it.
   *
   * The first version was a torus ring with a glow blob running round the front
   * of it, and the trouble with a torus is that it is a tube: a smooth,
   * even-width, perfectly circular tube, which is the one shape a convective
   * storm never has. Set against Saturn's banding it read as a hoop of neon
   * laid over a planet rather than as weather happening in it.
   *
   * The Cassini photographs are the argument. The storm is a compact turbulent
   * head at northern mid-latitude with a tail streaming away behind it along
   * its own latitude; the tail is mottled, lumpy and uneven, wider than the
   * head and ragged at both edges where the wind shear tears at it; and all of
   * it is *cloud* -- near-white where it is thickest, cream and blue-grey in
   * the hollows, sitting in Saturn's butterscotch and letting the banding
   * either side of it stay visible.
   *
   * So this is a shell just above the cloud tops, under Saturn's own
   * atmosphere layer, carrying the storm as a field: a head, a tail behind it,
   * a latitude envelope, and turbulence through all of it. Alpha blended
   * rather than added, because clouds cover what is under them; they do not
   * glow through it.
   */
  const SPOT_LATITUDE = THREE.MathUtils.degToRad(37);

  const uniforms = {
    uGain: { value: 0 },
    uTime: { value: 0 },
    // Where the head is, and how far the tail reaches back from it. Both in
    // radians of longitude, both growing across the event.
    uHeadLongitude: { value: 0 },
    uTail: { value: 0 },
    uLatitude: { value: Math.sin(SPOT_LATITUDE) },
    uSun: { value: new THREE.Vector3(0, 0, 1) },
    uView: { value: new THREE.Vector3(0, 0, 1) },
    // The cloud's colour, in three: lit tops, shaded hollows, and the warm
    // tan where it thins back towards Saturn's own banding.
    /*
     * Read off the Cassini natural-colour frames rather than the false-colour
     * mosaic, because the false-colour one is the famous picture and it is
     * green. What the storm actually is: a head of near-white cloud, cool
     * blue-grey in its hollows where the tops are lower, and -- immediately
     * behind the head, where the storm has torn the haze open -- the rust and
     * salmon of Saturn's own deeper cloud deck showing through. That rust is
     * the detail that makes the photographs read as weather rather than as
     * paint, and it was missing.
     */
    uBright: { value: new THREE.Color(0xfefdf8) },
    uShade: { value: new THREE.Color(0xb9c6d4) },
    uWarm: { value: new THREE.Color(0xc7a878) },
    uRust: { value: new THREE.Color(0xb2704a) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: true,
    vertexShader: /* glsl */`
      varying vec3 vDirection;

      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDirection;

      uniform float uGain;
      uniform float uTime;
      uniform float uHeadLongitude;
      uniform float uTail;
      uniform float uLatitude;
      uniform vec3 uSun;
      uniform vec3 uView;
      uniform vec3 uBright;
      uniform vec3 uShade;
      uniform vec3 uWarm;
      uniform vec3 uRust;

      ${VOLUME_NOISE}

      const float TAU = 6.28318530718;
      const float PI = 3.14159265359;

      void main() {
        vec3 d = normalize(vDirection);

        /*
         * How far behind the head this point lies, measured along the storm's
         * own latitude and wrapped into one full turn. Everything the storm is
         * shaped like is a function of this one number and of how far the point
         * sits from the band's centre line.
         */
        float longitude = atan(d.z, d.x);
        /*
         * Two ways of measuring the same angle, and the storm needs both.
         *
         * behind wraps into a full turn, which is what the tail wants -- it
         * has to be able to reach most of the way round the planet. across is
         * the signed version of the same difference, and it exists because the
         * wrapped one has a cliff in it: at the head's own longitude it jumps
         * from zero to a full turn, so everything keyed to it changed abruptly
         * along that one meridian. That is the straight diagonal line the storm
         * appeared to start from -- not a shape, a discontinuity, drawn where
         * the coordinate wrapped.
         */
        float behind = mod(uHeadLongitude - longitude, TAU);
        float across = behind > PI ? behind - TAU : behind;

        /*
         * How long ago this material left the head, which is what decides how
         * far the shear has had time to spread it.
         *
         * Everything past the end of the tail is ahead of the head, where there
         * is no material at all, and counts as brand new. That is not cosmetic:
         * keyed to the raw wrapped angle, the band came out 1.17 times its width
         * on one side of the head's meridian and 0.62 on the other, with the
         * step falling straight through the middle of the head. Together with
         * the tail switching on across that same line, it is what drew the hard
         * diagonal the storm appeared to start from. Where this does still step
         * -- at the very end of the tail -- the tail has already faded to
         * nothing, so there is nothing left there to show it.
         */
        float age = behind * (1.0 - step(uTail, behind));

        /*
         * The tail is broader than the head, because the zonal wind shear that
         * drags it out sideways also spreads it in latitude as it goes.
         */
        float widen = 0.62 + 0.55 * smoothstep(0.0, 2.2, age);
        float offLatitude = (d.y - uLatitude) / (0.105 * widen);
        /*
         * A band that ends, rather than a Gaussian that merely gets small.
         *
         * Left as a bare exponential this never reaches zero, and the
         * turbulence below multiplies it by as much as 1.65 -- so the faint
         * outer wing came back up above the threshold and the storm measured
         * from ten degrees of latitude to eighty, a smear over most of the
         * hemisphere. Cassini's storm sat between about twenty-five and
         * forty-five. Subtracting a floor and renormalising gives it a real
         * outer edge at roughly that width, and the mottling then makes that
         * edge ragged instead of making it enormous.
         */
        float band = max(0.0, exp(-offLatitude * offLatitude) - 0.06) / 0.94;

        /*
         * The head: the spot the event is named after, and a shape of its own
         * rather than a bright stretch of the band.
         *
         * It used to be one Gaussian in longitude multiplied by the band's
         * latitude envelope, and that arithmetic could only ever produce a
         * smear: twenty-seven degrees long by five tall, six to one, lying
         * along the tail instead of leading it. What the photographs show at
         * the front is a knot -- round, bulging past the width of the trail it
         * is laying down, and the brightest thing on the planet.
         *
         * So it gets its own two-dimensional envelope, and it is measured in
         * angle on the sphere rather than in the coordinates. Those are not the
         * same thing: a degree of longitude is a shorter arc than a degree of
         * latitude everywhere except the equator, by the cosine of the latitude
         * -- which at thirty-seven degrees is a fifth. A spot built without that
         * factor comes out visibly squashed, and the correction is the
         * difference between a circle and an egg.
         *
         * cos(latitude) comes free from the latitude uniform, which is already
         * its sine.
         */
        float cosLat = sqrt(max(1e-4, 1.0 - uLatitude * uLatitude));
        float spotLat = (d.y - uLatitude) / cosLat;
        float spotLon = across * cosLat;
        /*
         * A lumpy outline, not a circle.
         *
         * Every photograph of the head shows the same thing: a knot of
         * convective cells piled against each other, so its edge is scalloped
         * -- cauliflower, in the word every observer reaches for. A round
         * gaussian cannot be that however it is shaded, because the shading
         * sits inside a circular boundary and the boundary is what the eye
         * reads. So the head's radius itself varies with the angle round it.
         */
        float headAngle = atan(spotLat, spotLon);
        float lobes = 0.78 + 0.40 * noise3D(vec3(
          cos(headAngle) * 2.3, sin(headAngle) * 2.3, uHeadLongitude * 0.5
        ));
        float headRadius = 0.150 * lobes;
        float spot = (spotLat * spotLat + spotLon * spotLon) / (headRadius * headRadius);
        // A dense core inside a softer surround: a convective knot, not a dot.
        float head = exp(-spot) + 0.35 * exp(-spot * 3.0);

        /*
         * Faded out before the mesh runs out.
         *
         * The head is added to the band rather than multiplied by it, which is
         * what lets it bulge -- and it also means nothing else is holding it
         * inside the strip of sphere this shader is drawn on. A Gaussian is
         * still worth about one per cent of itself two and a bit widths out,
         * the turbulence can double that, and at the edge of the geometry it
         * stops dead: two faint hard rings at fixed latitudes, circling the
         * planet, sweeping as the viewer turns. Closing it off well inside the
         * mesh leaves the storm ending where the storm ends rather than where
         * the triangles do.
         */
        float offMiddle = abs(d.y - uLatitude);
        head *= 1.0 - smoothstep(0.22, 0.32, offMiddle);

        /*
         * The tail: everything the head has already laid down, thinning with
         * distance behind it and ending where the storm has not reached yet.
         *
         * It fades in at both ends, and both are expressed in the wrapped angle
         * so that neither can straddle the wrap.
         *
         * tailIn stops it appearing all at once along the head's meridian: the
         * wrapped angle says "behind" for everything right up to the head's own
         * longitude, so without it the trailing material switched on across a
         * line one pixel wide, and the head's blob was not wide enough to hide
         * that out where the band is thin. Ramping in over half a radian gives
         * the storm a rounded leading edge with the tail growing out from under
         * it, which is what the photographs show and what a plume shedding
         * material downwind actually looks like.
         *
         * tailOut fades the far end over most of the tail's length rather than
         * cutting near it, so the oldest material thins out until it is
         * indistinguishable from the banding instead of stopping at a line.
         */
        float tailIn = smoothstep(0.0, 0.55, behind);
        float tailOut = 1.0 - smoothstep(uTail * 0.38, uTail, behind);
        /*
         * A floor under the trail, so it stays a stream rather than breaking
         * into patches. The old decay took it to under half its strength within
         * a couple of radians and the turbulence then punched the rest into
         * islands; a real storm's wake thins but stays joined to itself.
         */
        float tail = tailIn * tailOut * (0.46 + 0.54 * exp(-behind * 0.30));

        /*
         * Continuous where it leaves the head, broken into separate patches
         * further back -- which is what the natural-colour frames show and what
         * a single continuous band did not. The storm is one body of cloud at
         * the source and a train of detached wisps a quarter of the way round
         * the planet, because the shear that stretches it also tears it. The
         * break-up ramps in with distance, so the join is never abrupt.
         */
        float clumpField = noise3D(vec3(behind * 2.4, uLatitude * 9.0, 3.7));
        float breakUp = smoothstep(0.5, 3.4, behind);
        tail *= mix(1.0, 0.18 + 0.82 * smoothstep(0.26, 0.68, clumpField), breakUp);

        /*
         * The head is added to the band rather than multiplied by it, which is
         * what lets it bulge outside the trail. Roughly half again the tail's
         * density at its centre, so it stays the brightest thing on the planet
         * and saturates to solid white in its core while the turbulence still
         * breaks up its edges.
         */
        float shape = head * 1.0 + band * tail * 0.9;

        /*
         * Lit cloud, so it has a day side and a terminator like everything else
         * on the planet, and dissolved before the limb rather than drawn up to
         * it.
         *
         * The day side is computed here rather than left to the renderer, for
         * the reason given on localSunDirection -- Saturn fakes its own
         * illumination and a lit material would disagree with it. The limb fade
         * is the one the impact scars needed: two curved surfaces this close
         * disagree about where the horizon is from pixel to pixel, and fading
         * out before reaching it leaves no boundary to argue about. It is also
         * what a cloud seen edge-on does anyway.
         */
        float day = smoothstep(-0.04, 0.36, dot(d, uSun));
        float horizon = smoothstep(0.05, 0.30, dot(d, uView));
        float visible = shape * day * horizon;

        /*
         * The one test worth making, and it is made before the turbulence
         * rather than after: outside the head and its tail, or round the far
         * side, there is no storm and no reason to sample two fields of noise.
         * The band geometry has already spared the rest of the planet.
         */
        if (visible < 0.004) discard;

        /*
         * Turbulence, and the reason it is sampled on a direction that has
         * been squashed in y and turned slowly about the axis: squashing
         * stretches the cells along the latitude the way shear stretches real
         * ones, and turning advects them without ever crossing a seam. A flat
         * noise wrapped on a sphere would show its join straight down the
         * middle of the tail.
         */
        // Slower than it was. Cassini's own movie of this storm is measured in
        // months per frame; anything that visibly boils reads as smoke.
        float spin = uTime * 0.021;
        float cs = cos(spin);
        float sn = sin(spin);
        vec3 turned = vec3(d.x * cs - d.z * sn, d.y * 3.2, d.x * sn + d.z * cs);
        float churn = fbm3D(turned * 5.5);
        float lumps = noise3D(turned * 15.0 + vec3(0.0, spin * 2.0, 0.0));

        /*
         * Mottled, never flat. The multiplier runs from well under one to well
         * over it, so the same storm has holes you can see Saturn through and
         * knots that are solid cloud.
         */
        float density = shape * (0.45 + 1.15 * churn) * (0.76 + 0.44 * lumps);
        density = clamp(density, 0.0, 1.0);

        /*
         * Three colours, not two.
         *
         * White where the cloud is thickest, blue-grey in the hollows between
         * the knots, and warm tan where it thins out towards Saturn -- which is
         * what the Cassini frames show, and the reason the storm reads as
         * weather sitting in the banding rather than as a white shape laid over
         * it. A two-colour ramp made a monochrome cloud; the third one is what
         * ties it to the planet underneath.
         *
         * The warm end is driven by the same field that drives the density, so
         * tan appears exactly where the cloud is thin enough for Saturn's own
         * colour to belong, and the finer field breaks it up so the boundary is
         * mottled rather than a contour line.
         */
        /*
         * Stretched across the turbulence's real range first, for the same
         * reason the Mars veil's optical depth is. Summed octaves of noise sit
         * between about 0.36 and 0.64, never near the ends -- so a ramp written
         * across nought to one spends its whole life in the top third. Measured
         * before this line went in: 98 per cent of the storm came out neutral
         * white, nought per cent blue, two per cent warm. All three colours
         * were in the shader and only one of them could ever be reached.
         */
        /*
         * Driven by the finer field, not by the one that sets the thickness.
         *
         * Tying colour to density looked reasonable and put every tint in the
         * wrong place: the thin parts are the faint parts, so all the blue and
         * all the tan landed exactly where there was too little cloud to show
         * them, and the storm still read as white with some dim edges. Colour
         * and thickness are separate things in the photographs -- there are
         * warm lanes cutting through the bright knots and cool shadow inside
         * them -- so they are separate fields here.
         */
        /*
         * How much of what is here is the head rather than the trail. The spot
         * is the thing the event is named for, so it gets more of everything:
         * whiter where it is thick, and a stronger swing into blue and tan
         * through its lumps, so it reads as a churning knot with depth in it
         * instead of a bright disc.
         */
        float headness = clamp(head / max(1e-4, shape), 0.0, 1.0);

        float lift = smoothstep(0.30 - headness * 0.06, 0.70 + headness * 0.06, lumps);
        vec3 cloud = mix(uShade, uBright, lift);

        /*
         * Warm where the cloud is thin, and driven by the thickness field
         * rather than the shading one -- two different conditions, or the two
         * tints land on the same pixels and cancel. That is what happened when
         * both came off the same number: every blue pixel was also being made
         * tan, the two averaged back to neutral, and the storm measured nought
         * per cent blue with all three colours present in the shader.
         *
         * Thin cloud is where Saturn's own banding is closest to showing
         * through, so tan belongs there; the shadowed hollows between the knots
         * can be thick and blue at the same time, and now are.
         */
        float thin = 1.0 - smoothstep(0.38, 0.62, churn);
        vec3 tone = mix(cloud, uWarm, thin * (0.50 + headness * 0.22));

        /*
         * The torn wake. Just behind the head the storm has punched through
         * the overlying haze, and what shows in the gaps is the rust-coloured
         * deck below -- the salmon patches sitting immediately behind the white
         * knot in every natural-colour frame Cassini took of it. It fades with
         * distance, because further back the haze has closed over again.
         */
        float freshWake = smoothstep(3.0, 0.45, behind) * (1.0 - headness);
        tone = mix(tone, uRust, freshWake * thin * 0.52);

        // and the core of the spot burns out towards white on top of all that.
        tone = mix(tone, uBright, headness * smoothstep(0.42, 0.95, density) * 0.70);

        gl_FragColor = vec4(tone, density * uGain * day * horizon);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  /*
   * A band of sphere, not a whole one.
   *
   * This is the fix for the storm being unbearably slow to the point of not
   * being able to turn the planet, and it is a geometry problem rather than a
   * shader one. A full shell rasterises every pixel of Saturn and then throws
   * five sixths of them away inside the fragment shader -- and discard is the
   * one instruction that makes a tile-based GPU, which is what a Mac has, give
   * up hidden-surface removal for the entire draw. So the cost was the whole
   * disc, twice over, to draw a stripe.
   *
   * A sphere segment covering only eighteen to sixty-two degrees of latitude
   * generates fragments for the stripe and nowhere else. Same picture, no
   * discard needed for the shape, and the rasteriser never touches the rest of
   * the planet.
   *
   * The width segments match Saturn's own 192 so the two surfaces curve
   * together. That matters: at 1.006 radii the shell's polygonal sag was
   * 0.0025 of a radius against an offset of 0.006, and two curved surfaces that
   * close, disagreeing about where they are from pixel to pixel, is exactly the
   * crawling distortion the impact scars had. At 1.012 radii with this
   * tessellation the sag is 0.0001 -- a hundred times the margin -- and it
   * still sits under Saturn's atmosphere shell at 1.018, so the planet's haze
   * passes over the storm the way it passes over the bands.
   */
  /*
   * Wide enough that the head's own fade finishes inside it. The head reaches
   * about one and eight tenths of its width before it is closed off, and that
   * has to land on triangles or the closing-off is what shows instead.
   */
  const BAND_TOP = THREE.MathUtils.degToRad(68);
  const BAND_BOTTOM = THREE.MathUtils.degToRad(12);
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(
      1, 192, 40,
      0, Math.PI * 2,
      Math.PI / 2 - BAND_TOP,
      BAND_TOP - BAND_BOTTOM,
    ),
    material,
  );
  clouds.scale.setScalar(radius * 1.012);
  hugSurface(clouds.material);
  clouds.renderOrder = 1;
  trackSurfaceLighting(clouds, target, camera);
  group.add(clouds);

  const sunLocal = new THREE.Vector3();
  const viewLocal = new THREE.Vector3();

  /*
   * Where on the planet the storm breaks out.
   *
   * Not an arbitrary longitude. A storm that erupts on the far side, or on the
   * night side, is a storm nobody watching the event ever sees -- and both were
   * a coin toss, because the head started at longitude zero in Saturn's own
   * frame, which is wherever the planet happens to have turned to.
   *
   * The bisector of the way the camera is and the way the Sun is puts it on the
   * part of the planet that is both facing the viewer and lit, which is the
   * same rule the impacts use. The head then starts a little upwind of that so
   * it drifts across the visible face rather than away from it, and the tail it
   * lays down runs back across the middle of the disc.
   */
  const stormOrigin = new THREE.Vector3();
  localSunDirection(target, sunLocal);
  localCameraDirection(target, camera, viewLocal);
  stormOrigin.copy(sunLocal).add(viewLocal);
  if (stormOrigin.lengthSq() < 1e-6) stormOrigin.copy(viewLocal);
  const originLongitude = Math.atan2(stormOrigin.z, stormOrigin.x);

  return {
    group,
    duration: 24,
    update(progress) {
      const onset = smoothstep(0, 0.12, progress);
      const fade = 1 - smoothstep(0.82, 1, progress);

      // The sun and view directions are not set here; see trackSurfaceLighting.
      /*
       * Slowly. The real storm takes months to get round the planet, and the
       * previous version crossed it several times in twenty seconds, which is
       * most of why it read as a spinning hoop rather than as weather. The head
       * covers about a hundred and fifty degrees across the whole event -- a
       * drift you can see if you watch it and not one that draws the eye away
       * from what it is doing. It starts most of a radian upwind of the middle
       * of the visible face and crosses it as the event runs.
       */
      uniforms.uHeadLongitude.value = originLongitude - 0.9 + progress * 2.6;
      /*
       * The tail outruns the head, because it is not only what the head left
       * behind: the shear goes on pulling the trailing end further back long
       * after the head has passed. By the end it is most of the way round.
       */
      uniforms.uTail.value = 0.35 + smoothstep(0.02, 0.9, progress) * 4.9;
      uniforms.uTime.value = progress * 24;
      uniforms.uGain.value = onset * fade * 0.94;
    },
    dispose() {
      clouds.geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * A comet dives into the Sun and does not come out.
 *
 * SOHO has discovered more than four thousand comets, which makes a solar
 * observatory the most prolific comet discoverer in history by an enormous
 * margin -- and about eighty-five per cent of them belong to one family. The
 * Kreutz sungrazers are all fragments of a single giant comet that broke up
 * on a previous pass, probably around the twelfth century, and they are still
 * arriving one at a time on the same orbit. SOHO finds one on average every
 * three days.
 *
 * Almost none survive. They pass within a couple of solar radii of the
 * photosphere, where the nucleus -- typically only tens of metres of ice --
 * is destroyed by heat and tidal stress within minutes. The tail keeps going
 * for a little while after the nucleus has gone, which is the eeriest part:
 * for a few frames there is a comet tail with nothing at the front of it.
 *
 * Staged as an inbound streak that brightens hard on approach, sheds its tail
 * and then ends.
 */
/*
 * How far back the sungrazer shot stands.
 *
 * ---- THE DIAL ----
 * RAISE this number to move the camera AWAY from the Sun -- more of the comet's
 * orbit in frame, smaller Sun. LOWER it to move IN -- bigger Sun, less orbit.
 *
 * It is a multiple of the Sun's own authored framing, which is 1 and fills the
 * screen with photosphere. Measured at the Sun's real numbers, the conversion
 * is almost exactly:
 *
 *     visible radius, in solar radii  =  this number / 1.66
 *
 * so 1.7 shows one solar radius around the Sun, 5 shows three, 6.6 shows four,
 * and 12 shows the whole spiral from where the comets enter. Anything past 12
 * only makes the Sun smaller without showing more, because the comets start at
 * START_RADIUS = 7.2 solar radii and there is nothing outside that.
 *
 * 4 is set here because the part worth watching is the last two turns and the
 * plunge: the early ones are wide, slow and far out, and framing for them
 * leaves the Sun too small to see a comet burn against. Measured at 4 the
 * camera sits 726 units out and holds 2.4 solar radii, with the Sun about a
 * fifth of the frame height.
 */
const SUNGRAZER_SHOT_ZOOM = 3;

function createSungrazerComet(target, camera) {
  const group = new THREE.Group();
  group.name = "Sungrazing comet event";
  const radius = localRadius(target);

  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Two or three of them, and they spiral rather than fly past.
   *
   * The Kreutz group are all fragments of one giant comet that came apart
   * centuries ago, and they are still arriving one behind another on the same
   * orbit -- SOHO catches one every three days or so, and sometimes several in
   * a day. Showing a single object crossing once was true to a single comet
   * and false to the family.
   *
   * The inward spiral is a compression of something real rather than an
   * invention. These are on enormously eccentric orbits, and what is drawn
   * here as successive tightening passes is the last part of that: each turn
   * brings the comet deeper into the corona than the one before, and the last
   * one does not come back out. Nothing survives the ending -- see below.
   */
  const COMETS = 2 + Math.floor(Math.random() * 2);

  /*
   * What colour a comet is, and why it changes on the way in.
   *
   * Out in the dark a comet glows in the colours of what is coming off it:
   * diatomic carbon fluorescing green, and dust and ions scattering blue-white.
   * A sungrazer does not keep either. Inside a few solar radii the coma is no
   * longer a cold gas being gently fluoresced -- it is metal and silicate
   * vapour boiling off a nucleus in a million-degree corona, and what that
   * radiates is the sodium-and-iron yellow-orange the SOHO images show at
   * perihelion.
   *
   * So each fragment of the family carries its own far colour -- the first
   * green, the next blue-white, and so on -- and all of them are carried to the
   * same yellow-orange as they close on the surface. The tail does it too, one
   * step behind the nucleus, because the dust was shed before the heat caught
   * up with it.
   */
  const FAR_COLOURS = [
    new THREE.Color(0x74ffb4), // C2 fluorescence: the classic comet green
    new THREE.Color(0xcfe6ff), // dust and ion tail: blue-white
    new THREE.Color(0x9fffd0),
    new THREE.Color(0xe8f4ff),
  ];
  const PERIHELION_COLOUR = new THREE.Color(0xffab3d);
  /*
   * Where the shift happens, in solar radii from centre. Above this the comet
   * keeps its own colour; by the time it reaches the surface it has none of it
   * left.
   */
  const COLOUR_SHIFT_FROM = 3.6;

  // A shared plane for the family, tilted so the spiral is seen open rather
  // than edge-on. They are fragments of one body, so they share an orbit.
  const planeHelper = Math.abs(facing.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const planeA = new THREE.Vector3().crossVectors(facing, planeHelper).normalize();
  const planeB = new THREE.Vector3().crossVectors(facing, planeA).normalize();
  // Tip the plane towards the viewer a little, so the near half of each turn
  // passes in front of the Sun and the far half behind it.
  const tilt = THREE.MathUtils.degToRad(24 + Math.random() * 22);
  const orbitX = planeA.clone();
  const orbitY = planeB.clone().multiplyScalar(Math.cos(tilt))
    .addScaledVector(facing, Math.sin(tilt)).normalize();

  const START_RADIUS = 7.2;
  /*
   * How close they get, and it is close. "Sungrazing" is not a figure of
   * speech: the Kreutz group pass within a fraction of a solar radius of the
   * photosphere, through corona at a million degrees, and that is why so few
   * of them come out again.
   */
  const DEATH_RADIUS = 1.08;
  /*
   * Where the nucleus starts losing the argument. Above this it is a comet
   * getting brighter; below it, it is sublimating faster than it can survive,
   * and what the eye should see is the solid thing thinning out into the dust
   * it is turning into rather than a light being switched off.
   */
  const DISSOLVE_FROM = 2.5;

  const comets = [];
  for (let index = 0; index < COMETS; index += 1) {
    /*
     * Each one is a size, and the size is the whole story.
     *
     * Below a few hundred metres a nucleus is simply gone -- SOHO has watched
     * it happen four thousand times. Surviving perihelion takes a solid core
     * two or three kilometres across, and even that is not enough on its own:
     * the Sun's tides pull hard enough to tear a nucleus apart whatever it is
     * made of, which is how Comet ISON ended in 2013. It arrived intact, came
     * apart at perihelion, and what came out the other side was dust.
     *
     * So a big one turns up about one time in five, and even the big one
     * breaks. The only difference is whether any piece is still there at the
     * end.
     */
    const big = Math.random() < 0.2;
    const turns = 1.7 + Math.random() * 1.1;
    const enters = index * (0.06 + Math.random() * 0.05);
    // Each dies as it crosses into the corona, at its own moment.
    const diesAt = 0.62 + index * 0.09 + Math.random() * 0.06;

    // The pieces it comes apart into, strung along the orbit rather than
    // scattered: fragments keep the same path and only drift along it.
    const farColour = FAR_COLOURS[index % FAR_COLOURS.length];

    const PIECES = big ? 5 : 3;
    const pieces = [];
    for (let piece = 0; piece < PIECES; piece += 1) {
      const glow = makeGlow(farColour.getHex(), 0);
      group.add(glow);
      pieces.push({
        glow,
        lag: piece === 0 ? 0 : 0.008 + piece * (0.009 + Math.random() * 0.008),
        bulk: piece === 0 ? 1 : 0.3 + Math.random() * 0.4,
        // The break-up happens on the way in, where the tidal stress peaks.
        bornAt: piece === 0 ? 0 : diesAt - 0.14,
        goneAt: big && piece === 0 ? 2 : diesAt + Math.random() * 0.07,
      });
    }

    const DUST = 1100;
    const dustPositions = new Float32Array(DUST * 3);
    const dustColors = new Float32Array(DUST * 3);
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
    const dustMaterial = new THREE.PointsMaterial({
      map: getGlowTexture(),
      vertexColors: true,
      size: radius * 0.022,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    group.add(dust);

    const grains = [];
    for (let grain = 0; grain < DUST; grain += 1) {
      /*
       * Release times weighted hard towards the end. Sublimation climbs far
       * faster than the illumination does, so most of what one of these ever
       * sheds it sheds in its last hours.
       */
      const bias = Math.pow(Math.random(), 0.3);
      grains.push({
        releaseAt: enters + bias * (diesAt - enters + 0.05),
        // Radiation pressure moves small grains hard and heavy ones barely at
        // all, and that spread is why a dust tail is broad and curved.
        push: 0.35 + Math.pow(Math.random(), 1.7) * 2.2,
        spread: (Math.random() - 0.5) * 0.55,
        glow: 0.3 + Math.random() * 0.7,
      });
    }

    comets.push({
      pieces, dust, dustGeometry, dustMaterial, grains, farColour,
      enters, diesAt, big, turns,
      phase: Math.random() * Math.PI * 2,
      // Which way round, and how fast the spiral tightens.
      sense: Math.random() < 0.5 ? 1 : -1,
    });
  }

  const path = new THREE.Vector3();
  const grainPoint = new THREE.Vector3();
  const away = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  const orbitNormal = new THREE.Vector3().crossVectors(orbitX, orbitY).normalize();
  const dustWarm = new THREE.Color(0xffd9a8);
  const shade = new THREE.Color();
  const nucleusTint = new THREE.Color();
  const comaTint = new THREE.Color();

  /*
   * Where a comet is at a given moment, and every part of it asks this same
   * question -- the nucleus, each fragment, and every grain of dust it ever
   * shed -- so they cannot disagree about the orbit.
   *
   * The radius closes on the Sun as the fourth power of how far through its
   * life the comet is, which keeps the early turns wide and slow and makes the
   * last one plunge. The angle runs faster as the radius shrinks, because a
   * body closer to the Sun genuinely is moving faster: Kepler's second law
   * says the sweep rate goes as the inverse square of the distance, and using
   * that here is cheaper than integrating the real thing and looks the same.
   */
  const positionAt = (comet, moment, out) => {
    const life = THREE.MathUtils.clamp(
      (moment - comet.enters) / Math.max(0.001, comet.diesAt - comet.enters), 0, 1.4,
    );
    const reach = DEATH_RADIUS + (START_RADIUS - DEATH_RADIUS) * Math.pow(1 - Math.min(life, 1), 2.1);
    // Angle accumulated so far, sped up as the orbit tightens.
    const swept = comet.phase + comet.sense * comet.turns * Math.PI * 2
      * (1 - Math.pow(1 - Math.min(life, 1), 2.6));
    return out.set(0, 0, 0)
      .addScaledVector(orbitX, Math.cos(swept) * reach * radius)
      .addScaledVector(orbitY, Math.sin(swept) * reach * radius);
  };

  return {
    group,
    duration: 18,
    update(progress) {
      const fade = 1 - smoothstep(0.9, 1, progress);

      for (let index = 0; index < comets.length; index += 1) {
        const comet = comets[index];

        // --- the nucleus, and then the pieces of it ----------------------
        let anyLeft = false;
        for (let pieceIndex = 0; pieceIndex < comet.pieces.length; pieceIndex += 1) {
          const piece = comet.pieces[pieceIndex];
          const alive = progress >= Math.max(comet.enters, piece.bornAt)
            && progress <= piece.goneAt;
          if (!alive) { piece.glow.visible = false; continue; }
          piece.glow.visible = true;
          anyLeft = true;

          positionAt(comet, progress - piece.lag, path);
          const reach = Math.max(radius * DEATH_RADIUS, path.length());
          /*
           * Brightness climbs as the inverse square of solar distance and then
           * some, because the surface is not merely lit -- it is boiling, and
           * the rate of that climbs faster than the light does.
           */
          const glare = Math.min(1, Math.pow(radius * 4.2 / reach, 2.1));
          const wasting = piece.goneAt > 1
            ? 1
            : 1 - smoothstep(piece.goneAt - 0.08, piece.goneAt, progress);
          const arriving = smoothstep(comet.enters, comet.enters + 0.05, progress);

          /*
           * Dissolving, and keyed to distance rather than to the clock.
           *
           * This is the part that makes it read as a comet being destroyed
           * instead of a sprite being turned off: as it closes on the Sun the
           * nucleus thins away, so what is left leading the tail is dust and
           * then nothing. Tying it to distance rather than to a moment means
           * every piece dies where the physics says it should -- deeper in,
           * later, and each at its own point on the spiral.
           */
          const height = reach / radius;
          const dissolving = smoothstep(DEATH_RADIUS, DISSOLVE_FROM, height);
          // What is left of the solid shrinks as it goes, as well as dimming.
          const solid = Math.pow(dissolving, 0.65);

          piece.glow.position.copy(path);
          piece.glow.scale.setScalar(
            radius * (0.03 + glare * 0.115) * piece.bulk * (0.35 + solid * 0.65),
          );
          piece.glow.material.opacity = glare * wasting * arriving * fade * solid;
          // Its own colour out in the dark; the corona's on the way in.
          const scorch = 1 - smoothstep(DEATH_RADIUS, COLOUR_SHIFT_FROM, height);
          nucleusTint.copy(comet.farColour).lerp(PERIHELION_COLOUR, scorch);
          piece.glow.material.color.copy(nucleusTint);
        }

        // --- the dust it has shed ----------------------------------------
        const position = comet.dustGeometry.getAttribute("position");
        const tint = comet.dustGeometry.getAttribute("color");
        for (let grain = 0; grain < comet.grains.length; grain += 1) {
          const item = comet.grains[grain];
          const age = progress - item.releaseAt;
          if (age < 0) { tint.setXYZ(grain, 0, 0, 0); continue; }

          positionAt(comet, item.releaseAt, path);
          away.copy(path).normalize();
          // Across the tail, inside the orbit plane: this is what fans it out.
          sideways.crossVectors(away, orbitNormal).normalize();

          /*
           * Radiation pressure is a constant push straight away from the Sun,
           * so distance travelled goes as the square of the time since
           * release. That single rule gives the whole tail: it points
           * anti-sunward rather than backwards along the track, it sweeps
           * round as the comet does, it curves because the older dust was shed
           * somewhere else on the spiral, and it goes on shining after the
           * nucleus has gone.
           */
          const drift = item.push * age * age * radius * 3.2;
          grainPoint.copy(path)
            .addScaledVector(away, drift)
            .addScaledVector(sideways, drift * item.spread);
          position.setXYZ(grain, grainPoint.x, grainPoint.y, grainPoint.z);

          const spent = Math.max(0, 1 - age / 0.3);
          const level = item.glow * Math.pow(spent, 1.6) * fade;
          /*
           * The grain remembers where it was shed. Dust released far out keeps
           * the comet's own colour and merely warms as it ages; dust shed near
           * perihelion was already glowing in the corona's colours when it
           * left.
           */
          const shedDepth = 1 - smoothstep(
            DEATH_RADIUS, COLOUR_SHIFT_FROM, path.length() / radius,
          );
          comaTint.copy(comet.farColour).lerp(PERIHELION_COLOUR, shedDepth);
          shade.copy(comaTint).lerp(dustWarm, Math.min(1, age * 2.6) * (1 - shedDepth));
          tint.setXYZ(grain, shade.r * level, shade.g * level, shade.b * level);
        }
        position.needsUpdate = true;
        tint.needsUpdate = true;
        // Nothing solid left and the tail still shining: the ordinary ending.
        comet.dustMaterial.opacity = anyLeft ? 0.55 : 0.55 * fade;
      }
    },
    dispose() {
      comets.forEach((comet) => {
        comet.pieces.forEach((piece) => piece.glow.material.dispose());
        comet.dustGeometry.dispose();
        comet.dustMaterial.dispose();
      });
      comets.length = 0;
    },
  };
}

/**
 * Something hits the Moon and you can see it from Earth.
 *
 * The Moon has no atmosphere, so a meteoroid that would burn up harmlessly
 * over Earth arrives at the lunar surface at its full speed -- tens of
 * kilometres a second -- and converts all of it to heat in an instant. The
 * result is a flash bright enough to record with a modest telescope from
 * Earth, on the night side, against black.
 *
 * The numbers come from NELIOTA, which watched the Moon for 283 hours between
 * 2017 and 2023 and validated 192 of them -- about **0.68 flashes per hour of
 * observation**. Over three-quarters of the impactors weighed between 1 and
 * 200 grams and were 0.5 to 3 cm across: gravel. Most flashes lasted under
 * 66 milliseconds, and 85% of the peaks were between 2,000 and 4,500 K, which
 * is why they photograph orange rather than white.
 *
 * The flash here is slowed enormously -- 66 ms is four frames -- but nothing
 * else is changed: it is a point on the unlit hemisphere, it is orange, and
 * it leaves nothing behind.
 */
function createLunarImpactFlash(target, camera) {
  const group = new THREE.Group();
  group.name = "Lunar impact flash event";
  const radius = localRadius(target);
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Three of them, because at 0.68 an hour with a 66-millisecond flash the odds
   * of ever catching one are what make this event worth staging at all, and
   * because the point is that the Moon is being sandblasted continuously
   * rather than struck once.
   */
  const flashes = [];
  for (let index = 0; index < 3; index += 1) {
    const site = facingPoint(facing, THREE.MathUtils.degToRad(66), new THREE.Vector3())
      .multiplyScalar(radius * 1.004);
    // 2,000-4,500 K: the cool end is orange, the hot end nearly white.
    const heat = Math.random();
    const flash = makeGlow(new THREE.Color().setRGB(1, 0.52 + heat * 0.34, 0.22 + heat * 0.42), 0);
    flash.position.copy(site);
    group.add(flash);
    flashes.push({
      flash,
      at: 0.14 + index * 0.28 + Math.random() * 0.08,
      // Under 66 ms in reality; the bigger impactors ring for longer.
      width: 0.05 + Math.random() * 0.05,
      size: 0.06 + Math.pow(Math.random(), 2) * 0.10,
    });
  }

  return {
    group,
    duration: 12,
    update(progress) {
      for (let index = 0; index < flashes.length; index += 1) {
        const item = flashes[index];
        const since = progress - item.at;
        // Instantaneous on, exponential off: the light curve of a hot spot
        // radiating into vacuum with nothing to sustain it.
        const level = since < 0 ? 0 : Math.exp(-since / item.width);
        item.flash.material.opacity = level;
        item.flash.scale.setScalar(radius * item.size * (0.5 + level * 1.4));
      }
    },
    dispose() { flashes.forEach((item) => item.flash.material.dispose()); },
  };
}

/**
 * Triton's nitrogen geysers.
 *
 * Voyager 2 passed Neptune in 1989 and found the biggest surprise of the whole
 * flyby on its largest moon: dark plumes rising nearly eight kilometres off
 * the surface and then bending over and streaming 150 kilometres downwind, on
 * the coldest surface ever measured -- 38 K, thirty-eight degrees above
 * absolute zero.
 *
 * The mechanism is a solid-state greenhouse. Triton's south polar cap is
 * transparent nitrogen ice; sunlight passes through it and warms the darker
 * material a metre or two underneath. The nitrogen there sublimates, pressure
 * builds under the ice cap, and eventually it breaks through and vents --
 * carrying dark dust up with it, which is why the plumes are visible at all.
 * They can run for a year at a time.
 *
 * The horizontal streak is the signature and it is worth drawing: the plume
 * goes up until it reaches Triton's thin atmosphere's shear level, and then
 * the wind takes it sideways for a hundred and fifty kilometres.
 */
function createTritonGeysers(target, camera) {
  const group = new THREE.Group();
  group.name = "Triton geyser event";
  const radius = localRadius(target);
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  const columns = [];
  // A shared downwind direction: they all feel the same wind, so the streaks
  // must be parallel. Independently-oriented plumes would look like a bug.
  const wind = new THREE.Vector3();

  for (let index = 0; index < 4; index += 1) {
    const vent = facingPoint(facing, THREE.MathUtils.degToRad(52), new THREE.Vector3());
    if (index === 0) {
      // Any tangent at the first vent will do; the rest inherit it.
      const helper = Math.abs(vent.y) > 0.9
        ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      wind.crossVectors(vent, helper).normalize();
    }
    // 8 km up against a 1,353 km radius is 0.6% -- far too small to see, so
    // the column is exaggerated to about a twentieth of the moon. Everything
    // about its *shape* is kept: short vertical, long horizontal.
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.010, radius * 0.020, radius * 0.13, 8, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x8fa6c4, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    group.add(column);

    // The downwind streak: 150 km against 8 km up, so nearly twenty times as
    // long as the column is tall. That ratio is the whole point.
    const streak = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.006, radius * 0.022, radius * 0.34, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x6e7f99, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    group.add(streak);

    columns.push({ vent, column, streak, phase: index * 0.17 });
  }

  const tip = new THREE.Vector3();

  return {
    group,
    duration: 18,
    update(progress) {
      for (let index = 0; index < columns.length; index += 1) {
        const item = columns[index];
        const local = THREE.MathUtils.clamp(progress - item.phase, 0, 1);
        const rise = smoothstep(0, 0.30, local);
        const fade = 1 - smoothstep(0.66, 1, progress);
        const strength = rise * fade;

        item.column.position.copy(item.vent).multiplyScalar(radius * (1 + 0.065 * rise));
        item.column.lookAt(scratchVector.copy(item.vent).multiplyScalar(-radius));
        item.column.rotateX(Math.PI * 0.5);
        item.column.scale.set(1, rise, 1);
        item.column.material.opacity = strength * 0.55;

        // The streak begins where the column tops out and runs downwind.
        tip.copy(item.vent).multiplyScalar(radius * (1 + 0.13 * rise));
        item.streak.position.copy(tip).addScaledVector(wind, radius * 0.17 * rise);
        item.streak.lookAt(scratchVector.copy(tip).addScaledVector(wind, -radius));
        item.streak.rotateX(Math.PI * 0.5);
        item.streak.scale.set(1, rise, 1);
        item.streak.material.opacity = strength * 0.34;
      }
    },
    dispose() {
      columns.forEach((item) => {
        item.column.geometry.dispose(); item.column.material.dispose();
        item.streak.geometry.dispose(); item.streak.material.dispose();
      });
    },
  };
}

/**
 * Spokes appear across Saturn's B ring.
 *
 * Voyager found them in 1980, Cassini watched them for years, and Hubble is
 * tracking them now -- radial smears reaching across the B ring, thousands of
 * kilometres long, that form in minutes and are gone in a few hours. They are
 * radial, which is the strange part: everything in a ring orbits at its own
 * speed, so a radial feature should shear itself into a spiral almost
 * immediately, and these do not.
 *
 * The explanation is electrostatic. Dust-sized icy grains pick up charge and
 * levitate above the ring plane, where they are no longer on Keplerian orbits
 * but partly controlled by Saturn's magnetic field, which rotates rigidly with
 * the planet. That is what lets a radial feature hold together.
 *
 * They are seasonal. Spokes appear around Saturn's equinoxes, when the Sun is
 * nearly in the ring plane -- so twice per 29.4-year orbit, roughly every
 * fifteen Earth years, in a season that lasts a few years. Saturn's northern
 * autumnal equinox falls on 6 May 2025, so this is spoke season now.
 */
/*
 * The spokes on Saturn's B ring.
 *
 * These are the strangest thing the rings do, and the first version drew them
 * as bright bars laid across the ring, which is wrong in three separate ways.
 *
 * They are not gaps and they are not a different substance. The ring under a
 * spoke is entirely intact: what a spoke is made of is the very finest end of
 * the ring's own material -- ice grains a micron across, statically charged and
 * levitated a few metres clear of the ring plane. Everything about how they
 * look follows from that one fact.
 *
 * Because the grains are the size of the wavelength of light, they scatter it
 * forwards rather than back. So a spoke has no colour of its own and no fixed
 * brightness either: seen with the Sun behind the observer it hides the bright
 * ring behind a veil of dust that is throwing its light the other way, and it
 * reads as a dark, dirty smudge. Seen looking back towards the Sun the same
 * dust lights up and the same spoke is a glowing white streak. Voyager
 * photographed both on the same pass, which is how the mechanism was worked
 * out. That flip is the single most characteristic thing about them and the
 * old version could not do it at all.
 *
 * They are radial because the electrostatic force that lifts the dust acts
 * along Saturn's magnetic field, and the field corotates with the planet in
 * 10.6 hours while B-ring particles orbit in about 8. A patch of levitated
 * dust therefore holds a radial line for a while instead of being sheared into
 * an arc immediately -- and then it does shear, and the spoke dies, two or
 * three ring rotations after it formed.
 *
 * And they are only on the B ring, between about 1.53 and 1.95 Saturn radii,
 * concentrated where the orbital period matches the field's rotation. Nowhere
 * else on the rings does this happen.
 */
const SPOKE_INNER = 1.53;
const SPOKE_OUTER = 1.95;

/*
 * How far back the spoke shot stands, as a multiple of Saturn's own framing.
 *
 * RAISE it to stand further off -- more ring in frame, smaller planet; LOWER it
 * to come in. Saturn's authored shot is composed for the planet and holds a
 * little over one radius of margin, which crops the A ring; the rings reach
 * 2.58 radii, so this has to roughly double it.
 */
const SPOKE_SHOT_ZOOM = 2.4;

function createRingSpokes(target) {
  const group = new THREE.Group();
  group.name = "Saturn ring spoke event";
  const radius = localRadius(target);

  const spokes = [];
  /*
   * How many, and where they sit.
   *
   * Spread evenly round the whole circumference, one to a sector, with a small
   * jitter inside each so the ring does not read as a cog. Grouping them into
   * two crowded families was tried and is wrong for this: at the distance the
   * event is watched from, half the ring is on the far side of the planet at
   * any moment, so a family lands either entirely in view or entirely out of
   * it, and a spoke season that shows nothing at all half the time is not the
   * thing to draw. Evenly spaced, every viewpoint gets its share.
   */
  const SLOTS = 20;
  const SECTOR = (Math.PI * 2) / SLOTS;
  const spokeHere = new THREE.Vector3();
  const spokeSun = new THREE.Vector3();
  const spokeEye = new THREE.Vector3();

  for (let index = 0; index < SLOTS; index += 1) {
    /*
     * Each one covers most of the B ring radially but only a sliver of it in
     * longitude -- Voyager's are roughly as wide as the Earth, which on this
     * ring is about a fifth of a Saturn radius, or seven degrees of arc.
     */
    /*
     * And spread across the B ring radially as well as round it.
     *
     * Every spoke reaching from the inner edge to the outer one left the ring
     * looking striped rather than spoked, and it is not what the frames show
     * either: individual spokes cover different parts of the B ring's width,
     * some running its full depth and others only the outer half. Each one
     * here takes a random band of between three-fifths and all of it.
     */
    const span = SPOKE_OUTER - SPOKE_INNER;
    const depth = span * (0.60 + Math.random() * 0.40);
    const inner = SPOKE_INNER + Math.random() * (span - depth);
    const outer = inner + depth;
    const halfWidth = THREE.MathUtils.degToRad(2.6 + Math.random() * 3.4);

    const geometry = new THREE.RingGeometry(
      radius * inner, radius * outer, 1, 24, -halfWidth, halfWidth * 2,
    );
    // Built in the XY plane; laid into the ring plane once, here, so the mesh
    // is left free to turn about Y as the field carries it round.
    geometry.rotateX(-Math.PI / 2);

    const uniforms = {
      uGain: { value: 0 },
      uTime: { value: 0 },
      uInner: { value: radius * inner },
      uOuter: { value: radius * outer },
      uHalfWidth: { value: halfWidth },
      // +1 when the Sun is behind the viewer, -1 when the viewer is looking
      // back into it. The whole appearance hangs off this one number.
      uPhase: { value: 1 },
      uSeed: { value: Math.random() * 40 },
      /*
       * Two tones, and both of them faintly red.
       *
       * A spoke in backscatter is not a black hole in the ring; every
       * description of one reaches for the same phrase -- a faint grey smudge,
       * a dirty fingerprint -- so the dark tone is a grey dark enough to read
       * against bright ice and nowhere near black. In forward scatter the same
       * dust blazes and the tone is white.
       *
       * The red is the part that is not obvious from the pictures. Multi-colour
       * spectroscopy of the spoke material shows the grains are subtly redder
       * than the ring they sit on -- the same reddening seen in the ring's own
       * non-icy contaminant, concentrated in the finest particles. It is
       * slight, and it should be. Measured at the event's own framing, the
       * pixels a spoke covers come out at a warmth of 0.108 against the ring's
       * own 0.082 underneath them: enough to read as "not blue", nowhere near
       * enough to read as red. In forward scatter the bright tone measures
       * 0.045 against the ring's 0.065 -- slightly cooler than the ring, which
       * is what "bright white" means when the ring itself is butterscotch.
       *
       * The dark tone's value was picked the same way. It has to be a grey --
       * a spoke seen in backscatter is a dirty fingerprint on bright ice, not a
       * hole -- but too light a grey and there is nothing to see. Swept against
       * the ring behind it, 0x332c26 darkened by a mean of 11 luminance levels
       * and vanished; 0x1d1813 darkened by 43 and read as damage. This one
       * lands at 31 in backscatter, against 43 of brightening seen from the
       * other side.
       */
      uDark: { value: new THREE.Color(0x272119) },
      uBright: { value: new THREE.Color(0xfff3e8) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
      /*
       * Ordinary alpha blending, deliberately, where everything else in this
       * scene has been moved off it. Alpha is the only blend that can go both
       * ways, and going both ways is the entire point: a dark source darkens
       * what is behind it and a bright one brightens it, which is exactly the
       * pair of behaviours a spoke has to be able to show. The dark tone is
       * kept near black so that where a spoke crosses empty space between ring
       * particles it adds nothing visible.
       */
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */`
        varying vec3 vLocal;

        void main() {
          vLocal = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vLocal;

        uniform float uGain;
        uniform float uTime;
        uniform float uInner;
        uniform float uOuter;
        uniform float uHalfWidth;
        uniform float uPhase;
        uniform float uSeed;
        uniform vec3 uDark;
        uniform vec3 uBright;

        ${VOLUME_NOISE}

        void main() {
          float r = length(vLocal.xz);
          float span = max(1e-4, uOuter - uInner);
          float along = (r - uInner) / span;

          /*
           * Soft at every edge. A spoke has no boundary -- it is a patch of
           * dust thinning out into the ring it sits on -- and the first thing
           * that gives a drawn one away is a straight edge anywhere on it.
           */
          float radialBody = smoothstep(0.0, 0.16, along)
            * (1.0 - smoothstep(0.68, 1.0, along));

          float angle = atan(-vLocal.z, vLocal.x);
          float across = clamp(abs(angle) / uHalfWidth, 0.0, 1.0);
          /*
           * Cubed rather than squared, so the sides of a spoke are a long
           * gradient rather than a shoulder. Nothing about a spoke is a hard
           * edge: they are dust thinning out into the ring, and the moment one
           * has a definite boundary it stops reading as a smudge on the ring
           * and starts reading as a gap in it -- which is precisely the thing
           * every description of them takes pains to say they are not.
           */
          float acrossBody = pow(1.0 - across * across, 1.6);

          /*
           * Grain along the length. Spoke photographs are never uniform: the
           * dust comes up in patches and the spoke is a chain of them, denser
           * at the middle of its radial run and ragged at the ends.
           */
          // Named anything but the word sample, which is reserved in GLSL ES
          // and silently costs the whole shader.
          vec3 field = vec3(along * 5.5, uSeed, angle * 9.0 + uTime * 0.12);
          vec3 fine = vec3(along * 17.0, uSeed * 3.1, angle * 26.0);
          float grain = (0.44 + 0.62 * noise3D(field)) * (0.72 + 0.44 * noise3D(fine));

          float body = radialBody * acrossBody * grain;
          if (body < 0.01) discard;

          /*
           * Micron dust throws light forwards. With the Sun behind the viewer
           * almost nothing comes back and the spoke is a shadow on the ring;
           * looking towards the Sun the same grains blaze.
           */
          float back = clamp(uPhase, 0.0, 1.0);
          float forward = clamp(-uPhase, 0.0, 1.0);
          vec3 tone = mix(uDark, uBright, forward * forward);
          /*
           * Strong enough to read, short of looking like damage.
           *
           * There are two failure modes either side of this number. Too high
           * and a spoke stops being a veil of dust over intact ring and starts
           * looking like a sector cut out of it, which is the one thing every
           * description of them takes pains to say they are not. Too low and it
           * is invisible at the distance the event is actually watched from,
           * which is where the previous setting landed: measured against the
           * ring behind them it managed 15 luminance levels of darkening in
           * backscatter and 27 of brightening in forward scatter, and that was
           * not enough to see. These coefficients are a shade under twice that
           * on both sides, which keeps the ring's own grain legible through a
           * spoke while making it unmistakably there.
           */
          float alpha = body * uGain * (0.50 + 0.94 * back + 0.98 * forward);

          gl_FragColor = vec4(tone, clamp(alpha, 0.0, 0.74));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    // Over the ring particles, under nothing else.
    mesh.renderOrder = 4;
    /*
     * The scattering angle is resolved at draw time, from whichever camera is
     * actually drawing. Working it out in the animation step instead was the
     * same mistake the surface shells made: the value is a property of the
     * view, so it has to be read where the view is known.
     */
    mesh.onBeforeRender = (renderer, scene, renderCamera) => {
      mesh.getWorldPosition(spokeHere);
      spokeSun.copy(spokeHere).negate();
      if (spokeSun.lengthSq() < 1e-8) spokeSun.set(0, 0, 1); else spokeSun.normalize();
      if (!renderCamera) return;
      renderCamera.getWorldPosition(spokeEye).sub(spokeHere);
      if (spokeEye.lengthSq() < 1e-8) return;
      uniforms.uPhase.value = spokeSun.dot(spokeEye.normalize());
    };
    group.add(mesh);

    spokes.push({
      mesh,
      uniforms,
      // One per sector, jittered by up to a third of a sector either way --
      // enough to break the regularity, not enough to leave a gap.
      angle: index * SECTOR + (Math.random() - 0.5) * SECTOR * 0.66,
      /*
       * Minutes to form, two or three ring rotations to shear away. Each slot
       * runs its life twice across the event with a different phase, so the
       * field is never the same twice and spokes are seen both appearing and
       * dying rather than all fading together.
       */
      at: Math.random() * 0.42,
      width: 0.30 + Math.random() * 0.22,
      encore: 0.52 + Math.random() * 0.30,
    });
  }

  return {
    group,
    duration: 20,
    update(progress) {
      for (let index = 0; index < spokes.length; index += 1) {
        const item = spokes[index];
        const first = progress - item.at;
        const second = progress - item.encore;
        const life = (moment) => (moment < 0
          ? 0
          : smoothstep(0, 0.05, moment) * (1 - smoothstep(item.width * 0.45, item.width, moment)));
        const level = Math.max(life(first), life(second));

        /*
         * Carried round by the magnetic field rather than by the orbit. The
         * field turns in 10.6 hours and the ring under it in about 8, so a
         * spoke drifts slowly backwards through the material it is made of --
         * the observation that forced the electrostatic explanation in the
         * first place.
         */
        item.mesh.rotation.y = item.angle + progress * 0.55;
        item.uniforms.uGain.value = level;
        item.uniforms.uTime.value = progress * 20;
        item.mesh.visible = level > 0.004;
      }
    },
    dispose() {
      spokes.forEach((item) => {
        item.mesh.geometry.dispose();
        item.mesh.material.dispose();
      });
    },
  };
}

/**
 * The Moon's shadow crosses the Earth.
 *
 * There are between two and five solar eclipses a year, and the reason there
 * are not two every month is that the Moon's orbit is tilted about five
 * degrees to Earth's -- so at most new moons the shadow misses, passing above
 * or below. Only when a new moon happens near a node does the shadow land.
 *
 * When it does, the umbra is tiny: at most about 270 km wide, and it crosses
 * the surface at over 1,700 km/h, which is why totality at any one place lasts
 * only a few minutes and why the same spot waits an average of 375 years for
 * the next one. The much larger penumbra around it is the partial eclipse, and
 * covers a good fraction of a hemisphere.
 *
 * This is the one event in the roster with no light of its own -- it is a
 * shadow, so it is drawn by taking light away.
 */
function createSolarEclipse(target, camera) {
  const group = new THREE.Group();
  group.name = "Solar eclipse event";
  const radius = localRadius(target);
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Normal blending with a dark colour, not additive: this subtracts. Every
   * other event in this file adds light, and using additive here would make
   * the shadow glow, which took one look to notice and is worth a line of
   * comment so it is never "tidied" into consistency with the others.
   */
  const penumbra = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.46, 40),
    new THREE.MeshBasicMaterial({
      color: 0x0a0d16, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(penumbra);

  const umbra = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.075, 26),
    new THREE.MeshBasicMaterial({
      color: 0x04060c, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(umbra);

  // The track: shadows sweep roughly west to east across the facing
  // hemisphere, entering at one limb and leaving at the other.
  const entry = facingPoint(facing, THREE.MathUtils.degToRad(74), new THREE.Vector3());
  const exit = facingPoint(facing, THREE.MathUtils.degToRad(74), new THREE.Vector3());
  const track = new THREE.Vector3();

  return {
    group,
    duration: 16,
    update(progress) {
      const run = smoothstep(0.06, 0.94, progress);
      // Great-circle interpolation, so the shadow stays on the surface rather
      // than cutting through the planet as a straight lerp would.
      track.copy(entry).lerp(exit, run).normalize();
      const arrival = smoothstep(0, 0.12, progress) * (1 - smoothstep(0.88, 1, progress));

      penumbra.position.copy(track).multiplyScalar(radius * 1.006);
      penumbra.lookAt(scratchVector.copy(track).multiplyScalar(radius * 4));
      penumbra.material.opacity = arrival * 0.55;

      umbra.position.copy(track).multiplyScalar(radius * 1.010);
      umbra.lookAt(scratchVector.copy(track).multiplyScalar(radius * 4));
      umbra.material.opacity = arrival * 0.92;
    },
    dispose() {
      penumbra.geometry.dispose(); penumbra.material.dispose();
      umbra.geometry.dispose(); umbra.material.dispose();
    },
  };
}

/**
 * Mercury grows a tail.
 *
 * Mercury has no atmosphere to speak of, but it does have an exosphere -- a
 * cloud of atoms so thin they never collide with each other -- and the solar
 * wind and a steady rain of micrometeorites knock fresh sodium off the surface
 * to keep replenishing it. Sodium is very good at absorbing sunlight at 589 nm,
 * which means radiation pressure pushes hard on it, and the result is a tail
 * of sodium atoms streaming anti-sunward for around **24 million kilometres**.
 * Mercury is, functionally, a rocky comet.
 *
 * The brightness is not constant round the orbit and the reason is elegant:
 * the tail peaks about **16 days either side of perihelion**, because
 * Mercury's orbital velocity Doppler-shifts the sodium absorption line off the
 * dark bottom of the solar spectrum's own sodium line and into the bright
 * continuum beside it, so the atoms suddenly have far more light to absorb and
 * far more push to feel. An 88-day orbit means this happens several times a
 * year.
 *
 * It is nearly invisible to the eye -- you need a filter tuned to 589 nm -- so
 * this is drawn at the intensity a sodium filter records rather than what an
 * unaided observer would see, which is nothing at all.
 */
function createMercurySodiumTail(target, camera) {
  const group = new THREE.Group();
  group.name = "Mercury sodium tail event";
  const radius = localRadius(target);

  /*
   * Anti-sunward, and worked out from the actual geometry rather than assumed.
   * The Sun is at the origin of the scene, so the direction away from it is
   * simply the body's own world position -- converted into the body's local
   * frame, because everything here is parented to the body.
   */
  const antiSunward = new THREE.Vector3();
  target.getWorldPosition(antiSunward);
  if (antiSunward.lengthSq() < 1e-8) antiSunward.set(1, 0, 0);
  antiSunward.normalize();
  // Into the body's frame, ignoring translation: this is a direction.
  const away = antiSunward.clone().applyQuaternion(
    target.getWorldQuaternion(new THREE.Quaternion()).invert(),
  ).normalize();

  /*
   * A long shallow cone. The real tail is 24 million km against Mercury's
   * 2,440 km radius -- a ratio of ten thousand to one, which at this scale
   * would run clean out of the Solar System. Compressed hard; what is kept is
   * that it is very long relative to the planet, very narrow at the root, and
   * opens slowly.
   */
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.5, radius * 14, 20, 1, true),
    new THREE.MeshBasicMaterial({
      // Sodium D lines: 589 nm, the colour of a street lamp.
      color: 0xffc65c,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(tail);

  // The exosphere itself, hugging the planet: this is where the tail is fed.
  const halo = makeGlow(0xffd98a, 0);
  group.add(halo);

  return {
    group,
    duration: 20,
    update(progress) {
      /*
       * The 16-days-either-side-of-perihelion double peak, in one pass: the
       * tail brightens, dips slightly through perihelion itself, brightens
       * again, then fades. That dip is the real behaviour and it is the whole
       * reason the timing is interesting.
       */
      const envelope = Math.sin(Math.min(1, progress / 0.92) * Math.PI);
      const doublePeak = 1 - 0.34 * Math.exp(-Math.pow((progress - 0.46) / 0.10, 2));
      const strength = Math.pow(envelope, 0.7) * doublePeak;

      // The cone's own axis is +Y, so it is aimed by looking down the tail.
      tail.position.copy(away).multiplyScalar(radius * 7.4);
      tail.lookAt(scratchVector.copy(away).multiplyScalar(-radius));
      tail.rotateX(Math.PI * 0.5);
      tail.scale.set(1, 0.6 + strength * 0.55, 1);
      tail.material.opacity = strength * 0.24;

      halo.position.set(0, 0, 0);
      halo.scale.setScalar(radius * (2.0 + strength * 1.0));
      halo.material.opacity = strength * 0.42;
    },
    dispose() {
      tail.geometry.dispose(); tail.material.dispose(); halo.material.dispose();
    },
  };
}

/**
 * Uranus stops being featureless.
 *
 * Voyager 2 flew past in 1986 and photographed a pale blue-green ball with
 * almost nothing on it, and that picture stuck. It was a bad time to visit: the
 * south pole was pointed at the Sun, and Uranus is tipped 98 degrees, so one
 * hemisphere had been in continuous daylight for decades and the atmosphere
 * had nothing to drive it.
 *
 * Since the 2007 equinox, when sunlight returned to both hemispheres, it has
 * been a different planet. In August 2014 Keck picked out **eight large storms
 * in one night** in the northern hemisphere, and the brightest was caught by
 * amateurs with backyard telescopes -- on a planet 2.9 billion kilometres away
 * that had been considered featureless. The bright spots are condensations of
 * methane ice, and at least one appears to be the top of a tall vortex
 * anchored deep in the atmosphere, in the way Jupiter's Great Red Spot is.
 *
 * Uranus takes 84 years to go round, so a season lasts 21. The activity that
 * started after 2007 is a seasonal thing, not a one-off.
 */
function createUranusStorms(target, camera) {
  const group = new THREE.Group();
  group.name = "Uranus storm event";
  const radius = localRadius(target);
  const facing = localCameraDirection(target, camera, new THREE.Vector3());

  /*
   * Eight, because that is how many were counted on the night this is of.
   * Northern hemisphere, at mid-latitudes, which is where they were.
   */
  const spots = [];
  for (let index = 0; index < 8; index += 1) {
    const site = facingPoint(facing, THREE.MathUtils.degToRad(64), new THREE.Vector3());
    const spot = makeGlow(0xf2fbff, 0);
    spot.position.copy(site).multiplyScalar(radius * 1.008);
    group.add(spot);
    spots.push({
      spot,
      // Methane-ice cloud tops brighten and dissipate on their own schedules.
      at: Math.random() * 0.42,
      life: 0.30 + Math.random() * 0.34,
      size: 0.10 + Math.pow(Math.random(), 1.6) * 0.20,
    });
  }

  return {
    group,
    duration: 19,
    update(progress) {
      for (let index = 0; index < spots.length; index += 1) {
        const item = spots[index];
        const since = progress - item.at;
        const level = since < 0
          ? 0
          : smoothstep(0, 0.16, since / item.life) * (1 - smoothstep(0.55, 1, since / item.life));
        item.spot.scale.setScalar(radius * item.size * (0.6 + level * 0.8));
        item.spot.material.opacity = level * 0.80;
      }
      // The whole system turns with the planet: Uranus's day is 17.2 hours.
      group.rotation.y += 0.0022;
    },
    dispose() { spots.forEach((item) => item.spot.material.dispose()); },
  };
}

/* ------------------------------------------------------ events in the sky */

/*
 * The two events below do not happen on a body.
 *
 * Everything else in this file is staged on a planet or a moon: the builder is
 * handed a target, works in that target's local frame, and is parented to it.
 * A supernova has no such target -- it happens thousands of light-years away,
 * against the sky, and the whole point of watching one from here is that it is
 * *out there* rather than on anything.
 *
 * So these are given a sky anchor instead: a group that rides with the camera
 * at the deep-sky shell radius, exactly like the star field does. They receive
 * the same (target, camera) signature as every other builder, and use the
 * target only for its scale.
 */

/**
 * A star explodes, and the dust around it lights up.
 *
 * The Milky Way makes about **two supernovae a century**, and the last one
 * anybody on Earth saw with the naked eye was probably Flamsteed's in 1680 --
 * so a person is unlikely to get one in a lifetime, and the Solar System has
 * seen maybe twenty since it formed. What makes them worth staging anyway is
 * the second half of what happens, which is usually left out: the star is the
 * flash, but the *nebula it was sitting in* is what you actually see for the
 * next several months, because the light has to travel out through the gas
 * before it can reach you.
 *
 * The light curve is a real Type II-P: a fast rise over about ten days, then a
 * **hundred-day plateau** while the hydrogen recombination front eats inward
 * through the expanding envelope at exactly the rate that keeps the luminosity
 * flat, then a collapse onto the cobalt-56 decay tail that takes a year or
 * more to fade. Compressed here, but the shape is the measured one -- and the
 * shape is the thing the viewer asked for: it does not flash and vanish.
 */
function createSupernova(target, camera, context = {}) {
  const group = new THREE.Group();
  group.name = "Supernova event";
  const scale = context.skyRadius ?? 3000;

  /*
   * Placed in front of the camera rather than anywhere on the sky.
   *
   * Staging it at a random point on the shell means it is behind the viewer
   * half the time, and a supernova nobody was facing is a highlight on an
   * empty frame. It is put a little off centre so it does not sit exactly
   * under the crosshair, which reads as a UI element rather than as a star.
   */
  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  const helper = Math.abs(ahead.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(ahead, helper).normalize();
  const up = new THREE.Vector3().crossVectors(ahead, right).normalize();
  const offAxis = THREE.MathUtils.degToRad(9 + Math.random() * 11);
  const around = Math.random() * Math.PI * 2;
  const site = ahead.clone()
    .addScaledVector(right, Math.tan(offAxis) * Math.cos(around))
    .addScaledVector(up, Math.tan(offAxis) * Math.sin(around))
    .normalize()
    .multiplyScalar(scale * 0.94);

  // The star itself: a point that gets very bright and stays bright.
  const star = makeGlow(0xdbe6ff, 0);
  star.position.copy(site);
  group.add(star);

  // The halo: the light of the star reaching us through the gas around it.
  const halo = makeGlow(0xffd9a8, 0);
  halo.position.copy(site);
  group.add(halo);

  /*
   * The expanding shell.
   *
   * Real ejecta leave at around 10,000 km/s, which sounds enormous and is
   * still slow enough that a remnant takes centuries to become a visible ring
   * -- Cassiopeia A is 340 years old and ten light-years across. What is drawn
   * here is the light echo rather than the material: a bright front expanding
   * outward through the surrounding dust at the speed of light, which is what
   * is actually visible in the months after.
   */
  const echo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffc98a,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  echo.position.copy(site);
  group.add(echo);

  const tint = new THREE.Color();
  const hot = new THREE.Color(0.82, 0.88, 1.0);
  const cool = new THREE.Color(1.0, 0.52, 0.28);

  return {
    group,
    duration: 26,
    sky: true,
    update(progress, api) {
      // Type II-P, in days, at about 26 days per second of screen time.
      const days = progress * 680;
      let shape;
      if (days < 10) {
        const t = days / 10;
        shape = t * t * (3 - 2 * t);
      } else if (days < 110) {
        // The plateau. Not perfectly flat: real ones sag a few tenths.
        shape = 1 - 0.14 * ((days - 110 + 100) / 100);
      } else if (days < 136) {
        const t = (days - 110) / 26;
        shape = 0.86 + (0.16 - 0.86) * (t * t * (3 - 2 * t));
      } else {
        // Cobalt-56: 77.2-day half-life, so an e-folding every 111.4 days.
        shape = 0.16 * Math.exp(-(days - 136) / 111.4);
      }
      shape = Math.max(0, shape);

      // Ejecta cool as they expand, so it peaks blue-white and ends red.
      tint.copy(hot).lerp(cool, Math.pow(1 - Math.min(1, shape), 1.5));
      star.material.color.copy(tint);
      star.material.opacity = Math.min(1, shape * 1.4);
      star.scale.setScalar(scale * (0.004 + Math.pow(shape, 0.55) * 0.020));

      halo.material.color.copy(tint);
      halo.material.opacity = shape * 0.5;
      halo.scale.setScalar(scale * (0.02 + Math.pow(shape, 0.4) * 0.085));

      // The echo keeps expanding even as the star fades, because the light
      // that left at peak is still on its way out through the cloud.
      const spread = Math.pow(progress, 0.62);
      echo.scale.setScalar(scale * (0.01 + spread * 0.30));
      echo.material.opacity = shape * (1 - spread) * 0.18;

      // And the sky itself comes on. This is the part that makes it read as an
      // explosion inside something rather than a dot in front of it.
      api?.setSkyHighlight?.(Math.min(1, shape * 1.15));
    },
    dispose(api) {
      api?.setSkyHighlight?.(0);
      star.material.dispose();
      halo.material.dispose();
      echo.geometry.dispose();
      echo.material.dispose();
    },
  };
}

/**
 * Two neutron stars merge, and the universe makes gold.
 *
 * On 17 August 2017 the gravitational-wave detectors and the gamma-ray
 * satellites saw the same event within two seconds of each other, and within
 * eleven hours seventy observatories had found it in visible light in a galaxy
 * 130 million light-years away. It is the most consequential single
 * observation in modern astronomy, and it settled a long-standing question:
 * where the heavy elements come from.
 *
 * The answer is here. Neutron-star mergers throw off a few per cent of a solar
 * mass of neutron-rich debris, and that debris runs the r-process -- rapid
 * neutron capture -- building elements past iron in about a second. GW170817
 * is estimated to have produced **several Earth-masses of gold and platinum**.
 * Most of the gold in the world was made this way.
 *
 * The light curve is nothing like a supernova's and that is the giveaway that
 * identified it: a **kilonova** rises in hours, not weeks, and fades in days
 * rather than months -- and it goes from blue to deep red extremely fast as
 * the freshly-made heavy elements make the ejecta opaque.
 */
function createKilonova(target, camera, context = {}) {
  const group = new THREE.Group();
  group.name = "Kilonova event";
  const scale = context.skyRadius ?? 3000;

  const ahead = new THREE.Vector3();
  camera.getWorldDirection(ahead);
  const helper = Math.abs(ahead.y) > 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(ahead, helper).normalize();
  const up = new THREE.Vector3().crossVectors(ahead, right).normalize();
  const offAxis = THREE.MathUtils.degToRad(7 + Math.random() * 10);
  const around = Math.random() * Math.PI * 2;
  const site = ahead.clone()
    .addScaledVector(right, Math.tan(offAxis) * Math.cos(around))
    .addScaledVector(up, Math.tan(offAxis) * Math.sin(around))
    .normalize()
    .multiplyScalar(scale * 0.94);

  const core = makeGlow(0xeaf2ff, 0);
  core.position.copy(site);
  group.add(core);

  const ejecta = makeGlow(0xff7a3c, 0);
  ejecta.position.copy(site);
  group.add(ejecta);

  /*
   * The jet. GW170817's gamma-ray burst was seen off-axis, which is why it was
   * faint in gamma rays and why the geometry mattered so much: a merger throws
   * a narrow relativistic jet along its rotation axis, and whether you see a
   * short gamma-ray burst depends entirely on whether you are in it.
   */
  const jet = new THREE.Mesh(
    new THREE.ConeGeometry(scale * 0.012, scale * 0.16, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xa8d4ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  const jetAxis = up.clone().addScaledVector(right, 0.4).normalize();
  group.add(jet);

  const tint = new THREE.Color();
  const blue = new THREE.Color(0.86, 0.93, 1.0);
  const red = new THREE.Color(1.0, 0.34, 0.16);

  return {
    group,
    duration: 20,
    sky: true,
    update(progress, api) {
      // Hours to rise, days to fade -- a hundredth of a supernova's timescale.
      const rise = smoothstep(0, 0.055, progress);
      const fall = Math.exp(-Math.max(0, progress - 0.055) / 0.22);
      const shape = rise * fall;

      /*
       * Blue to red, and fast. The r-process builds lanthanides within
       * seconds, and lanthanides are enormously opaque in the blue -- so the
       * ejecta go from blue-white to deep infrared-red in about a day. That
       * colour change is what identified GW170817's counterpart as a kilonova
       * rather than anything else.
       */
      tint.copy(blue).lerp(red, Math.min(1, progress * 4.2));
      core.material.color.copy(tint);
      core.material.opacity = Math.min(1, shape * 1.5);
      core.scale.setScalar(scale * (0.004 + Math.pow(shape, 0.5) * 0.016));

      ejecta.material.opacity = shape * 0.55;
      ejecta.scale.setScalar(scale * (0.014 + Math.pow(progress, 0.5) * 0.075));

      // The jet is brief and early: it is the gamma-ray burst.
      const jetLevel = Math.max(0, 1 - progress / 0.16) * rise;
      jet.position.copy(site).addScaledVector(jetAxis, scale * 0.085 * jetLevel);
      jet.lookAt(scratchVector.copy(site).addScaledVector(jetAxis, -scale));
      jet.rotateX(Math.PI * 0.5);
      jet.scale.set(1, 0.4 + jetLevel, 1);
      jet.material.opacity = jetLevel * 0.5;

      api?.setSkyHighlight?.(Math.min(1, shape * 0.95));
    },
    dispose(api) {
      api?.setSkyHighlight?.(0);
      core.material.dispose();
      ejecta.material.dispose();
      jet.geometry.dispose();
      jet.material.dispose();
    },
  };
}

/* ------------------------------------------------------------- the roster */

/*
 * Every entry carries the four things the dashboard needs to explain it, and
 * they are separate fields rather than one blob of prose because the panel
 * lays them out differently:
 *
 *   detail     what you are about to watch happen
 *   frequency  how often it really happens, with the measurement it comes from
 *   cause      why it happens -- the mechanism, in one or two sentences
 *   note       the fact worth carrying away
 *
 * `frequency` is the field that most repays being exact. "Often" tells a
 * reader nothing; "roughly 0.68 flashes per hour of observation, from 192
 * validated detections over 283 hours" tells them both the rate and how
 * confident to be about it.
 */
const EVENTS = [
  {
    id: "jupiter-impact",
    body: "Jupiter",
    title: "Impact swarm",
    detail: "Several metre-scale asteroids fall in from different directions and detonate in Jupiter's upper atmosphere",
    frequency: "Objects this size strike Jupiter tens of times a year; Earth-based amateurs catch one or two of the flashes",
    cause: "318 Earth masses of gravity sitting at the inner edge of the asteroid belt. Jupiter bends in main-belt strays kicked out by the 3:1 Kirkwood resonance, Jupiter-family comets, and Centaurs falling from beyond Saturn — so the arrivals come from every direction at once.",
    note: "There is no crater. A metre-scale body deposits its energy high in the atmosphere and leaves nothing behind — the flash is the whole event.",
    facesSun: true,
    build: createImpactSwarm,
  },
  {
    id: "saturn-impact",
    body: "Saturn",
    title: "Impact swarm",
    detail: "Saturn accretes its own share of the same debris, arriving on unrelated trajectories",
    frequency: "Perhaps a fifth of Jupiter's rate — Saturn is further out and less massive, so its gravitational reach is smaller",
    cause: "The same accretion Jupiter does, and for the same reason. Saturn sweeps up Centaurs on their way in from the Kuiper Belt; several are on orbits that cross its own.",
    note: "Cassini found ring ripples that date a debris impact on the rings to 1983 — nobody was watching at the time.",
    facesSun: true,
    build: createImpactSwarm,
  },
  {
    id: "io-eruption",
    body: "Io",
    title: "Volcanic plume",
    detail: "Sulphur thrown 300 km above the most volcanic world in the Solar System",
    frequency: "Continuous. Io has around 400 active volcanoes and something is erupting at every moment; Loki Patera brightens on a roughly 500-day cycle",
    cause: "Tidal heating. Io is locked in a 4:2:1 resonance with Europa and Ganymede that keeps its orbit eccentric, so Jupiter's tides knead it constantly — enough to melt its interior.",
    note: "Enough material leaves the surface to resurface the entire moon every few thousand years. The yellows and reds are sulphur allotropes, not rock.",
    build: createIoPlume,
  },
  {
    id: "enceladus-plumes",
    body: "Enceladus",
    title: "Ocean venting to space",
    detail: "Over a hundred jets of salty water ice leaving the south pole",
    frequency: "Continuous, and modulated by the orbit — the jets are measurably stronger at apoapsis, when tidal stress pulls the fractures open",
    cause: "A global subsurface ocean under an ice shell, kept liquid by tidal flexing from Saturn, venting through four fractures across the south pole that Cassini named the tiger stripes.",
    note: "Cassini flew through the plume and tasted it: salt, silica, and organic molecules. This escaping material is what Saturn's E ring is made of.",
    build: createEnceladusPlumes,
  },
  {
    id: "meteor-shower",
    body: "Earth",
    title: "Meteor shower",
    detail: "Earth crosses a comet's debris trail, as it does on the same dates each year",
    frequency: "About a dozen major showers a year on fixed dates — the Perseids peak 12–13 August, the Geminids 13–14 December",
    cause: "Earth's orbit intersects streams of debris shed by comets on earlier passes. The dates are fixed because the streams are: the crossing point is a place in Earth's orbit, so it comes round once a year.",
    note: "The Perseids come from comet Swift–Tuttle; the Geminids from asteroid 3200 Phaethon, which is probably a burnt-out comet.",
    /*
     * Watched over the day side, and the shower is built for it.
     *
     * The stream's heading is chosen relative to the line between the viewer
     * and the daylit face, and the few that reach the ground are aimed at land
     * by reading the planet's own daytime map. Both of those assume the lit
     * face is the one on screen; framed over the night side the trails still
     * burn but they burn over a black planet, and the strikes land where
     * nothing can be seen of what they hit.
     */
    facesSun: true,
    build: createMeteorShower,
  },
  {
    id: "solar-cme",
    body: "Sun",
    title: "Coronal mass ejection",
    detail: "A billion tonnes of plasma leaving the corona at up to 3,000 km/s",
    frequency: "Several a day at solar maximum, about one every five days at minimum — an eleven-year cycle",
    cause: "Magnetic reconnection. The Sun's field gets wound up by differential rotation until a loop snaps and reconnects, releasing the stored energy and flinging the plasma it was containing.",
    note: "The fastest reach Earth in under a day. It is these, not the light of a flare, that drive the big geomagnetic storms and the aurorae.",
    build: createSolarEjection,
  },
  {
    id: "sungrazer",
    body: "Sun",
    title: "Sungrazing comet",
    detail: "A comet dives to within a couple of solar radii and does not come out",
    frequency: "SOHO finds a Kreutz sungrazer on average every three days, and has discovered over 4,000 comets in total — about 85% of them from that one family",
    cause: "The Kreutz group are all fragments of a single giant comet that broke up on an earlier pass, probably in the twelfth century. They are still arriving one at a time on the same orbit.",
    note: "Almost none survive. Below a few hundred metres a nucleus vaporises outright, and even a kilometre-scale one is usually pulled apart by the Sun's tides — Comet ISON arrived intact in 2013 and came out as dust. What is left shining afterwards is the tail, which routinely outlives the thing that made it.",
    /*
     * The camera stands back for this one; the Sun's own framing is composed
     * for the Sun, and this event is not about the Sun. The dial and what its
     * numbers mean are documented on SUNGRAZER_SHOT_ZOOM above.
     */
    shotZoom: SUNGRAZER_SHOT_ZOOM,
    build: createSungrazerComet,
  },
  {
    id: "mars-dust-storm",
    body: "Mars",
    title: "Global dust storm",
    detail: "A regional storm fails to die and instead wraps the entire planet",
    frequency: "Once every three Mars years on average — about 5½ Earth years",
    cause: "Mars's orbit is eccentric, so southern summer coincides with perihelion. The planet gets hot enough for the radiative forcing to lift dust faster than it settles; the airborne dust then absorbs sunlight, heats the air, and drives the winds that lift more.",
    note: "The winds top out around 60 mph, and in an atmosphere 1% as dense as ours they could not knock you over. The 2018 storm ended Opportunity's mission all the same.",
    /*
     * Watched from the day side. Dust is only dust when there is sunlight on
     * it; see `composeSolarEventShot`.
     */
    facesSun: true,
    build: createMarsDustStorm,
  },
  {
    id: "saturn-white-spot",
    body: "Saturn",
    title: "Great White Spot",
    detail: "A storm erupts and spreads along its latitude until it wraps the planet",
    frequency: "Roughly once per Saturnian year — once every 30 Earth years. The last was 2010",
    cause: "Water vapour is heavy enough to sit far below the visible cloud deck and cannot convect through the lighter dry air above it. Heat accumulates underneath for decades until the layer finally overturns all at once.",
    note: "The 2010 outbreak Cassini watched was the largest ever recorded — it ran for months and altered Saturn's atmospheric temperature and composition for over three years.",
    // The storm places itself on the lit, viewer-facing part of the planet,
    // and framing the day side is what makes that reachable.
    facesSun: true,
    /*
     * And looked down on, rather than seen edge-on.
     *
     * The storm sits at 37 degrees north. From the default shot -- twelve
     * degrees above the equator -- that latitude is up near the limb, so the
     * head is foreshortened into a sliver and the tail disappears over the
     * curve within a few tens of degrees of longitude. Raising the camera to
     * the storm's own latitude puts the band across the middle of the disc,
     * which is the view every Cassini frame of it was taken from and the only
     * one where the head and the length of the tail are both readable.
     */
    shotPitch: THREE.MathUtils.degToRad(37),
    build: createSaturnWhiteSpot,
  },
  {
    id: "ring-spokes",
    body: "Saturn",
    title: "Ring spokes",
    detail: "Radial smears thousands of kilometres long form across the B ring and shear away",
    frequency: "Seasonal — around Saturn's equinoxes, so twice per 29.4-year orbit, roughly every 15 years. Northern autumn equinox fell on 6 May 2025, so this is spoke season",
    cause: "Dust-sized icy grains pick up electrical charge and levitate above the ring plane, where Saturn's rigidly rotating magnetic field controls them instead of Kepler's laws.",
    note: "That is why they can be radial at all. Anything on a normal orbit would shear into a spiral within minutes, because the inner edge of the ring laps the outer edge.",
    /*
     * Looked down on, from far enough back to hold the whole ring system.
     *
     * This is the one event whose subject is the ring rather than the planet.
     * Seen from near the ring plane the spokes are edge-on -- radial features
     * foreshortened into the line of the ring, which is exactly the geometry
     * that hides them -- and the body's own framing crops the outer rings off
     * the sides. So the camera climbs to sixty degrees, where the ring is a
     * disc rather than a line, and stands back until the whole of it fits.
     */
    facesSun: true,
    shotPitch: THREE.MathUtils.degToRad(60),
    shotZoom: SPOKE_SHOT_ZOOM,
    build: createRingSpokes,
  },
  {
    id: "lunar-impact-flash",
    body: "Moon",
    title: "Lunar impact flash",
    detail: "Gravel-sized meteoroids hit the unlit hemisphere at full speed and flash",
    frequency: "About 0.68 validated flashes per hour of observation — NELIOTA recorded 192 in 283 hours between 2017 and 2023",
    cause: "No atmosphere. A meteoroid that would burn up harmlessly over Earth reaches the lunar surface at tens of kilometres a second and converts all of that energy to heat instantly.",
    note: "Over three-quarters of the impactors weigh between 1 and 200 grams and are 0.5–3 cm across. Most flashes last under 66 milliseconds and peak between 2,000 and 4,500 K.",
    build: createLunarImpactFlash,
  },
  {
    id: "solar-eclipse",
    body: "Earth",
    title: "Solar eclipse",
    detail: "The Moon's shadow lands on Earth and races across it",
    frequency: "Between two and five solar eclipses a year; any given place on Earth waits an average of 375 years for a total one",
    cause: "The Moon's orbit is tilted about 5° to Earth's, so at most new moons the shadow passes above or below. Only a new moon near an orbital node puts the shadow on the surface.",
    note: "The umbra is at most about 270 km wide and crosses the surface at over 1,700 km/h, which is why totality anywhere lasts only minutes.",
    build: createSolarEclipse,
  },
  {
    id: "supernova",
    body: null,
    title: "Supernova",
    detail: "A massive star collapses and detonates, lighting up the dust around it for months",
    frequency: "About two per century in the Milky Way. The last one seen from Earth with the naked eye was probably in 1680",
    cause: "A star above about eight solar masses runs out of fuel, its iron core collapses to a neutron star in under a second, and the infalling envelope rebounds off it.",
    note: "The light does not flash and vanish. This is a Type II-P: a ten-day rise, a hundred-day plateau while hydrogen recombines through the expanding envelope, then a cobalt-56 tail that takes over a year to fade.",
    build: createSupernova,
  },
  {
    id: "kilonova",
    body: null,
    title: "Kilonova",
    detail: "Two neutron stars merge and throw off debris that builds gold and platinum in seconds",
    frequency: "Rare enough that one has been caught once — GW170817, on 17 August 2017, in a galaxy 130 million light-years away",
    cause: "Two neutron stars spiral together and merge, flinging out a few per cent of a solar mass of neutron-rich debris that runs rapid neutron capture and builds elements past iron.",
    note: "This is where the heavy elements come from. GW170817 is estimated to have made several Earth-masses of gold and platinum — most of the gold on Earth was made this way.",
    build: createKilonova,
  },
  {
    id: "mercury-sodium-tail",
    body: "Mercury",
    title: "Sodium tail",
    detail: "Mercury streams a comet-like tail of sodium roughly 24 million km anti-sunward",
    frequency: "Every orbit — 88 days — peaking about 16 days either side of perihelion",
    cause: "Solar wind and micrometeorites knock sodium off the surface into Mercury's exosphere, and radiation pressure at the 589 nm sodium line pushes it away from the Sun.",
    note: "The double peak is a Doppler effect: Mercury's orbital speed shifts the sodium line off the dark bottom of the Sun's own sodium line and into the bright continuum, so the atoms suddenly have far more light to absorb.",
    build: createMercurySodiumTail,
  },
  {
    id: "uranus-storms",
    body: "Uranus",
    title: "Bright storm outbreak",
    detail: "Methane-ice cloud tops erupt across the northern hemisphere",
    frequency: "Seasonal. Activity has been climbing since the 2007 equinox; Keck counted eight large storms in a single night in August 2014",
    cause: "Uranus is tipped 98°, so for decades one pole faces the Sun and the atmosphere has nothing to drive it. Sunlight returning to both hemispheres after equinox restarts the weather.",
    note: "The 2014 outbreak was bright enough for amateurs with backyard telescopes to catch — on the planet Voyager 2 photographed in 1986 as a featureless ball.",
    build: createUranusStorms,
  },
  {
    id: "triton-geysers",
    body: "Triton",
    title: "Nitrogen geysers",
    detail: "Dark plumes rise 8 km and then bend over and stream 150 km downwind",
    frequency: "Individual vents can run for about a year; Voyager 2 caught at least two erupting during its 1989 flyby",
    cause: "A solid-state greenhouse. Sunlight passes through transparent nitrogen ice and warms darker material a metre or two below; the nitrogen there sublimates, pressure builds under the cap, and it vents — carrying dark dust with it.",
    note: "This happens on the coldest surface ever measured: 38 K, thirty-eight degrees above absolute zero.",
    build: createTritonGeysers,
  },
];

/**
 * Runs the roster.
 *
 * Every event is staged by name, once, on request. What remains here is the
 * mechanics of that: build the instance, attach it to its body, drive it to
 * completion, take it apart, and tell anyone listening what is happening.
 *
 * `viewCount` is kept per event and is the only state that outlives an
 * event -- it is what lets the dashboard say whether something has been
 * watched before, is running now, or has not been seen yet.
 */
export function createSolarSystemEvents({
  camera,
  findBody,
  announce,
  /**
   * Where an event with no body is staged.
   *
   * A group that rides with the camera at the deep-sky shell radius -- the
   * same trick `deepSky.js` uses, and correct rather than a cheat, since
   * nothing on that shell is closer than four light-years and no amount of
   * travelling inside one planetary system moves any of it.
   */
  skyAnchor = null,
  /**
   * The shell radius, as a function rather than a value.
   *
   * The space environment that owns this number is constructed after the event
   * system is, so reading it at call time throws. Called on demand instead.
   */
  getSkyRadius = () => 3000,
  /** Lets a sky event brighten the dust while it burns. */
  setSkyHighlight = null,
} = {}) {
  let active = null;
  let paused = false;
  let lastPlayedId = null;
  const listeners = new Set();
  const viewCounts = new Map(EVENTS.map((event) => [event.id, 0]));
  const skyApi = { setSkyHighlight: (value) => setSkyHighlight?.(value) };

  function isOnScreen(body) {
    if (!body) return false;
    body.getWorldPosition(scratchProjection);
    scratchProjection.project(camera);
    return scratchProjection.z > -1 && scratchProjection.z < 1
      && Math.abs(scratchProjection.x) < 0.95 && Math.abs(scratchProjection.y) < 0.95;
  }

  function snapshot() {
    return {
      activeId: active?.definition.id ?? null,
      /*
       * The last event played, which outlives the event.
       *
       * `activeId` clears the moment something finishes, and the dashboard
       * only listens while it is open -- so without this, opening the list
       * after watching something shows nothing marked and no way to tell
       * which one it was.
       */
      lastPlayedId,
      activeProgress: active
        ? THREE.MathUtils.clamp(active.elapsed / active.duration, 0, 1)
        : 0,
      paused,
      viewCounts: Object.fromEntries(viewCounts),
    };
  }

  /** One shape for every state change, so the dashboard has a single seam. */
  function emit() {
    const state = snapshot();
    listeners.forEach((listener) => listener(state));
    return state;
  }

  function stop() {
    if (!active) return;
    active.group.parent?.remove(active.group);
    active.dispose?.(skyApi);
    /*
     * Belt and braces on the highlight. `dispose` clears it, but an event that
     * is torn down mid-flight -- replaced by another, or disposed with the
     * whole system -- must never leave the sky stuck bright, and a stuck
     * highlight is not obviously a bug when you see it. It is one line.
     */
    setSkyHighlight?.(0);
    active = null;
    emit();
  }

  return {
    setPaused(value) { paused = Boolean(value); },

    update(deltaSeconds) {
      if (paused || !active) return;
      active.elapsed += deltaSeconds;
      const progress = active.elapsed / active.duration;
      if (progress >= 1) stop();
      else { active.update(progress, skyApi); emit(); }
    },

    /**
     * Stages one event now, by id. Runs once and takes itself apart -- there is
     * no looping, because the thing being depicted does not loop either.
     */
    play(id) {
      const definition = EVENTS.find((event) => event.id === id);
      if (!definition) return false;
      // An event with no body happens against the sky, not on anything.
      const host = definition.body === null ? skyAnchor : findBody(definition.body);
      if (!host) return false;
      stop();
      const instance = definition.build(
        definition.body === null ? host : host,
        camera,
        { skyRadius: getSkyRadius() },
      );
      host.add(instance.group);
      active = { ...instance, definition, elapsed: 0 };
      viewCounts.set(definition.id, (viewCounts.get(definition.id) ?? 0) + 1);
      lastPlayedId = definition.id;
      announce?.({
        id: definition.id,
        // Sky events have no world to name, so they say where they are.
        body: definition.body ?? "Deep space",
        title: definition.title,
        detail: definition.detail,
        note: definition.note,
        // A sky event is staged in front of the lens by construction.
        visible: definition.body === null ? true : isOnScreen(host),
      });
      emit();
      return true;
    },

    /** Diagnostic alias, kept because the debug console documents it. */
    trigger(id) { return this.play(id); },

    /** Ends whatever is running, without starting anything. */
    stop,

    /** Whether a given event's body exists in the scene right now. */
    isAvailable(id) {
      const definition = EVENTS.find((event) => event.id === id);
      if (!definition) return false;
      if (definition.body === null) return Boolean(skyAnchor);
      return Boolean(findBody(definition.body));
    },

    /**
     * Which events can be staged right now.
     *
     * Moons are hydrated lazily as the journey reaches their parent, so
     * Enceladus and Triton genuinely do not exist while the camera is at
     * Earth. That is correct -- building Neptune's satellite system for a
     * viewer looking at Mars would be a real cost for nothing -- but it means
     * the roster is not uniformly available, and a button that fails on press
     * is worse than one that says why beforehand.
     */
    getAvailability: () => {
      const map = {};
      EVENTS.forEach((event) => {
        map[event.id] = event.body === null
          ? Boolean(skyAnchor)
          : Boolean(findBody(event.body));
      });
      return map;
    },

    /** Everything the dashboard needs to render itself. */
    list: () => EVENTS.map((event) => ({
      id: event.id,
      body: event.body ?? "Deep space",
      /** True when the event is staged against the sky rather than on a world. */
      isSky: event.body === null,
      title: event.title,
      detail: event.detail,
      frequency: event.frequency,
      cause: event.cause,
      note: event.note,
      /**
       * True when this event has to be watched from the body's day side.
       * Read by the staging in main.js when it composes the shot.
       */
      facesSun: event.facesSun === true,
      shotZoom: Number(event.shotZoom) || 1,
      /**
       * The camera elevation this event wants, in radians, or null for the
       * composed default. Read by the staging in main.js alongside facesSun.
       */
      shotPitch: Number.isFinite(event.shotPitch) ? event.shotPitch : null,
    })),

    getState: snapshot,

    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },

    dispose() { stop(); listeners.clear(); },
  };
}

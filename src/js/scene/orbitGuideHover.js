import * as THREE from "three";

/**
 * Draw the guide finely; raycast it coarsely.
 *
 * These two jobs want opposite things and they were being served by one
 * vertex count, which meant neither was right.
 *
 * **Drawing** wants a lot of vertices, because the line is looked at across
 * five orders of magnitude of scale. From outside Neptune a small body's
 * orbit is forty pixels wide; having arrived at the rock you are two tenths
 * of a scene unit from an object whose radius is twenty-seven *thousandths*
 * of one, and the guide fills the frame. A polyline cuts the corner by
 * roughly `chord² / 8ρ`, and at 256 segments that came to a third of Bennu's
 * radius, four and a half times 67P's -- so the reported symptom, the line
 * running past the rock instead of through it, was not an error in the orbit
 * at all. The curve was right; the *drawing* of it was straight where it
 * should have bent. Eight times the samples reduces that by sixty-four.
 *
 * **Raycasting** wants few, because every segment is a `distanceSqToSegment`
 * on every pointer frame, and the grab radius it is being compared against is
 * several whole scene units wide -- four hundred times the error that matters
 * to the eye. Testing 2,048 segments to resolve a 7-pixel grab is pure waste.
 *
 * So the drawn geometry carries every vertex and the pick path keeps every
 * `stride`-th one, as its own never-rendered `Line`. `raycast` delegates and
 * rewrites the hit back to the visible object, so callers still receive the
 * guide they registered, with its `userData` and a `point` for the locator.
 * (The same trick the planets' ribbons use, for the opposite reason: theirs
 * have no raycastable geometry at all.)
 */
export function attachDecimatedPickPath(line, stride = 8, { closed = true } = {}) {
  const pos = line.geometry?.getAttribute("position");
  if (!pos || stride < 2) return line;

  const points = [];
  for (let i = 0; i < pos.count; i += stride) {
    points.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
  }
  // Closed explicitly: `Line`'s raycast tests i -> i+1 and never wraps, so
  // without this the segment back to the start is drawn and unhittable.
  // An open path (an interstellar visitor's) must not be closed -- that
  // made an invisible, hoverable chord from its outbound end straight back
  // to its inbound end across the whole system -- but it does need its own
  // last vertex, which the stride can step over.
  if (closed && points.length > 1) points.push(points[0].clone());
  const last = pos.count - 1;
  if (!closed && last % stride !== 0) points.push(new THREE.Vector3(pos.getX(last), pos.getY(last), pos.getZ(last)));

  const hitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial(),
  );
  hitLine.matrixAutoUpdate = false;

  line.raycast = (raycaster, intersects) => {
    hitLine.matrixWorld.copy(line.matrixWorld);
    const found = [];
    THREE.Line.prototype.raycast.call(hitLine, raycaster, found);
    for (let i = 0; i < found.length; i += 1) {
      found[i].object = line;
      intersects.push(found[i]);
    }
  };
  line.userData.pickPath = hitLine;
  return line;
}

/**
 * Lets a non-planet orbit guide be hovered and clicked exactly like a planet's.
 *
 * ## Why this exists
 *
 * The planets' guides have had a pointer story from the beginning: run the
 * cursor along one and a card names the world it belongs to, then a click
 * flies you there. The fifteen small bodies and the five named belt rocks got
 * their guides much later, and they got only the line -- which is half the
 * feature, and the half that matters least. The lines were asked for because
 * "asteroid collections is so crazy it is hard to figure out where are these";
 * a line you cannot interrogate answers "something orbits here", not "that is
 * Bennu, and here is how to get to it".
 *
 * ## How
 *
 * Not by writing a second hover system. `main.js` already has one, and it is
 * not a small one -- a pixel-sized grab radius that rescales with camera
 * distance, nearest-to-cursor arbitration between crossing paths, a pulsing
 * locator on the body, the fade-everything-else pass, press/release tracking
 * so a drag is not a click. Duplicating any of that would mean two behaviours
 * that drift apart.
 *
 * So these guides are *adopted into* the existing registry instead. Each line
 * is given the `userData` that registry expects -- `isPlanetOrbit`, `planet`,
 * `planetName`, `baseColor`, `baseOpacity` -- and pushed into `orbitTargets`.
 * Everything above then applies to them with no further code, including the
 * parts nobody would remember to reimplement.
 *
 * The one thing they do not inherit is the ribbon: a planet's guide is a
 * screen-space triangle strip that widens to four pixels under the cursor,
 * and these are ordinary GL lines, which cannot be widened at all. They get
 * the colour shift and the opacity jump instead, against a field where every
 * other guide has just dropped to a sixth of its brightness -- which turns
 * out to read clearly, because the contrast is doing the work rather than the
 * width.
 *
 * `hover` carries the wording, because "12 satellites available" is the wrong
 * second line for a four-kilometre rock.
 */

/**
 * @param {THREE.Object3D} guides   group whose children are the guide lines
 * @param {Array} orbitTargets      main.js's pointer registry, appended to
 * @param {string} eyebrow          kicker line on the hover card
 * @param {Function} [resolveBody]  name -> Object3D, when the line does not
 *                                  already carry `userData.body`
 * @returns {number} how many lines were adopted
 */
export function registerOrbitGuideHover({
  guides,
  orbitTargets,
  eyebrow = "Route discovered",
  resolveBody = null,
} = {}) {
  if (!guides?.children || !Array.isArray(orbitTargets)) return 0;

  let adopted = 0;
  guides.children.forEach((line) => {
    if (!line?.isLine || !line.material) return;

    const name = String(line.userData?.bodyName ?? "").trim();
    if (!name) return;

    /*
     * The body itself, not its name. The click handler flies to an Object3D,
     * and resolving a name at click time would mean a scene traverse inside a
     * pointer event. The small bodies hand theirs over directly; the belt's
     * five are looked up once, here, because their guides are built from
     * copied orbital elements and never saw the meshes.
     */
    const body = line.userData?.body ?? resolveBody?.(name) ?? null;
    if (!body) return;

    line.userData.isPlanetOrbit = true;
    line.userData.planet = body;
    line.userData.planetName = name;
    /*
     * Without these two the per-frame pass reads the *current* colour as the
     * base and lerps it toward the hover tint, which then becomes the new
     * base on the following frame: the guide would creep permanently cyan
     * after one hover and never come back.
     */
    line.userData.baseColor = line.material.color.getHex();
    line.userData.baseOpacity = Number(line.material.opacity ?? 0.22);
    line.userData.hover = {
      eyebrow,
      /* A line may name itself: a binary's one guide carries every body on
       * it ("Lempo, Hiisi & Paha orbit"), set by smallBodies.js. */
      title: line.userData?.hoverTitle ?? `${name} orbit`,
      action: line.userData?.hoverAction ?? `Click this orbit to travel directly to ${name}`,
      secondary: line.userData?.hoverSecondary ?? null,
    };

    orbitTargets.push(line);
    adopted += 1;
  });

  return adopted;
}

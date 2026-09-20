import * as THREE from "three";
import { SOLAR_ORBIT_SCALE } from "../config/celestialScale.js";
import { attachDecimatedPickPath } from "./orbitGuideHover.js";

/**
 * Orbit guides for the five named rocks in the main belt.
 *
 * Ceres, Vesta, Pallas, Hygiea and Psyche are the only individually modelled
 * bodies in a field of a hundred and twenty thousand, and until now there was
 * no way to tell which of the specks was which, or where to look for one.
 * Reported plainly: "asteroid collections is so crazy it is hard to figure out
 * where are these". The generic C, S and M rocks stay unlined -- a hundred and
 * twenty thousand ellipses is not a scene, it is a fog -- but anything with a
 * name gets a path, which is the same rule the planets and the fifteen small
 * bodies follow.
 *
 * ## Why the numbers are duplicated here
 *
 * These five are built inside `asteroidBelt.js`, and that file is frozen at
 * the user's request -- it cannot be edited, only read. Their orbital elements
 * are not exposed on the meshes either: the belt computes each position from a
 * private `orbit` object every frame and puts only the result on the object.
 *
 * So the elements below, the seeded node, and `positionFromOrbit` are all
 * **copies** of what `asteroidBelt.js` does internally, reproduced exactly so
 * the line passes through the body rather than near it. That is a real
 * duplication and it has a real cost: **if the major bodies' orbits change in
 * `asteroidBelt.js`, these five lines silently stop matching them.** There was
 * no way to avoid it without editing the frozen file, and the guide is
 * read-only derived data rather than behaviour, which is what makes the trade
 * acceptable. The moment that file is open again, this should read the belt's
 * own orbit objects instead.
 */

/* Verbatim from asteroidBelt.js. A different hash gives a different plane. */
function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

/* Also verbatim: parameterised by true anomaly, not mean, so sampling it
 * uniformly traces the ellipse with even angular spacing about the focus. */
function positionFromOrbit(target, orbit, angle) {
  const distance = orbit.semiMajor * (1 - orbit.eccentricity * orbit.eccentricity)
    / (1 + orbit.eccentricity * Math.cos(angle));

  const orbitalX = Math.cos(angle) * distance;
  const orbitalZ = Math.sin(angle) * distance;
  const cosNode = Math.cos(orbit.node);
  const sinNode = Math.sin(orbit.node);
  const cosInclination = Math.cos(orbit.inclination);
  const sinInclination = Math.sin(orbit.inclination);

  return target.set(
    orbitalX * cosNode - orbitalZ * cosInclination * sinNode,
    orbitalZ * sinInclination,
    orbitalX * sinNode + orbitalZ * cosInclination * cosNode,
  );
}

/* Index order matters: the node is seeded from the position in this list, so
 * these must stay in the same order as MAJOR_BODIES in asteroidBelt.js. */
/*
 * `summary` is the line the hover card shows under the name. Diameters are
 * mean diameters: Ceres and Vesta from Dawn's shape models (Russell et al.
 * 2012, 2016), Pallas and Hygiea from VLT/SPHERE (Marsset et al. 2020,
 * Vernazza et al. 2020), Psyche from Shepard et al. 2021 -- which revised it
 * down from the 226 km that is still quoted in most places.
 */
const MAJOR_ORBITS = Object.freeze([
  {
    name: "Ceres", radius: 47.8, eccentricity: 0.075, inclination: 0.18, colour: 0xd8b98a,
    summary: "Dwarf planet · 939 km across · the largest body in the belt",
  },
  {
    name: "Vesta", radius: 45.7, eccentricity: 0.089, inclination: 0.12, colour: 0xd8b98a,
    summary: "Second-largest in the belt · 525 km across · basaltic crust",
  },
  {
    name: "Pallas", radius: 48.4, eccentricity: 0.23, inclination: 0.52, colour: 0xd8b98a,
    summary: "Third-largest in the belt · 513 km across · orbit tilted 35°",
  },
  {
    name: "Hygiea", radius: 50.9, eccentricity: 0.12, inclination: 0.07, colour: 0xd8b98a,
    summary: "Fourth-largest in the belt · 434 km across · carbonaceous",
  },
  {
    name: "Psyche", radius: 46.9, eccentricity: 0.14, inclination: 0.05, colour: 0xc9c0ad,
    summary: "222 km across · metal-rich · target of NASA's Psyche mission",
  },
]);

/*
 * Dense for the same reason the small bodies' guides are: the line has to
 * pass through the rock when you are standing next to it, and a polyline's
 * corner-cutting error is judged against the rock's radius rather than the
 * orbit's. These five are ten to twenty times larger than the small bodies,
 * so they need a quarter of the samples -- at 1,024 the worst deviation is
 * about half a per cent of Psyche's drawn radius.
 *
 * The pointer pays for a quarter of them, via `attachDecimatedPickPath`.
 */
const SEGMENTS = 1024;
const PICK_STRIDE = 4;

/**
 * Builds the five lines. Pass the group the bodies themselves live in, so any
 * transform on the belt applies to the guides identically -- `asteroidBelt
 * .mainBelt` is that group, and `asteroidBelt.system` is an acceptable second
 * choice because both currently sit at the origin unrotated.
 */
export function createBeltMajorOrbitGuides(parent) {
  if (!parent) return null;

  const guides = new THREE.Group();
  guides.name = "Named belt orbit guides";

  const point = new THREE.Vector3();
  MAJOR_ORBITS.forEach((body, index) => {
    const orbit = {
      semiMajor: body.radius * SOLAR_ORBIT_SCALE,
      eccentricity: body.eccentricity,
      inclination: body.inclination,
      node: seededRandom(index + 301) * Math.PI * 2,
    };

    /*
     * Closed explicitly with a repeated first vertex, and a `Line` rather
     * than a `LineLoop`, so that every segment is raycastable -- `Line`'s
     * raycast, which `LineLoop` inherits as-is, never tests the implicit
     * wrap-around segment. See the same note in `smallBodies.js`.
     */
    const vertexCount = SEGMENTS + 1;
    const vertices = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i += 1) {
      positionFromOrbit(point, orbit, ((i % SEGMENTS) / SEGMENTS) * Math.PI * 2);
      vertices[i * 3] = point.x;
      vertices[i * 3 + 1] = point.y;
      vertices[i * 3 + 2] = point.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: body.colour,
      transparent: true,
      // Slightly stronger than the small bodies' 0.22: there are five of these
      // rather than thirteen, they all lie in roughly the same band, and they
      // have to be picked out against the brightest part of the belt.
      opacity: 0.26,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    }));
    line.name = `${body.name} orbit`;
    line.userData.bodyName = body.name;
    line.userData.hoverSecondary = body.summary;
    line.frustumCulled = false;
    line.renderOrder = -12;
    attachDecimatedPickPath(line, PICK_STRIDE);
    guides.add(line);
  });

  parent.add(guides);
  return guides;
}

/**
 * The five named rocks, for anything that needs to *name* them rather than
 * draw them.
 *
 * The dossier's roster is the caller: it lists every rock a viewer can travel
 * to, and these five are invisible to every other module because they live
 * inside the frozen belt. Exporting the table that is already here beats a
 * third copy of the same five names somewhere in `ui/`.
 */
export const BELT_MAJOR_ROCKS = Object.freeze(
  MAJOR_ORBITS.map(({ name, summary }) => Object.freeze({ name, summary })),
);

import * as THREE from "three";
import { auToSceneRadius } from "../config/celestialScale.js";
import { markPointerProxy } from "./pointerProxies.js";

/**
 * Where the Sun's influence ends -- twice, in two different senses.
 *
 * Past the Kuiper Belt there are two outer boundaries and they are not the
 * same boundary, which is the single most-confused thing about the outer
 * Solar System:
 *
 *   the heliopause    where the solar *wind* stops, about 120 AU out. It is
 *                     the edge of a bubble of plasma, and two spacecraft have
 *                     physically crossed it.
 *   the Oort Cloud    where the Sun's *gravity* finally lets go, out to about
 *                     100,000 AU -- eight hundred times further. Nobody has
 *                     ever seen it.
 *
 * Calling the heliopause "the edge of the Solar System" is the mistake
 * `docs/not-covered.md` warns about, and drawing both of these together is
 * the clearest possible way to not make it: one is a bright thin shell close
 * in, the other is a vast faint one around everything.
 *
 * ## On drawing two things nobody can see
 *
 * The termination shock and the heliopause are **imaginary boundaries**, in
 * the exact sense that the equator is imaginary: precisely located, genuinely
 * crossable, consequential -- and with nothing whatsoever there to look at.
 * They emit no light. They are not dust, not cloud, not a surface and not a
 * wall. An astronaut holding station at either one would see an ordinary
 * starfield and would have no way of telling which side of it they were on --
 * Voyager knew it had crossed because a plasma instrument counted a fortyfold
 * density jump, not because anything appeared out of a window.
 *
 * What defines them is **where a measurement changes**, not where something
 * sits. That is the idea the cards have to carry, and "diagram" did not carry
 * it: a diagram sounds like a simplification of a real object, and there is no
 * real object here to simplify.
 *
 * They are drawn anyway, because a boundary you cannot point at is a boundary
 * nobody learns -- the same reason an atlas prints the equator. Both shells
 * are given a high limb exponent so they read as thin surfaces rather than as
 * volumes of something.
 *
 * ## On drawing something nobody has observed
 *
 * The Oort Cloud has never been detected at any wavelength. It is inferred,
 * and the inference is strong: long-period comets arrive from every direction
 * on orbits that, traced backwards, all reach out to the same enormous range
 * of distances. We see the pieces that fall out of the cloud. We have never
 * seen the cloud.
 *
 * So it is drawn as a *shell of probability* rather than a field of rocks --
 * a soft limb-brightened glow with a sparse, deliberately unresolved
 * scattering inside it, and every card about it says the word inferred. A
 * belt of crisp individual objects out there would be a lie, and an
 * attractive one.
 *
 * ## Shape
 *
 * The heliosphere is not a sphere. The Sun moves through the interstellar
 * medium, so the bubble is compressed on the leading side and drawn out into
 * a long heliotail behind -- the shape in every NASA diagram of it. That is
 * done here with a scaled, offset sphere rather than real fluid dynamics,
 * which is honest enough for a boundary whose exact shape is still argued
 * about: IBEX data has been read as a rounded bubble *and* as a croissant.
 *
 * The Oort Cloud genuinely is spherical, and that is its defining visual
 * difference from everything else in the scene. Every other population here
 * is a disc. This one surrounds the Solar System in all directions, because
 * whatever placed it there did not care about the ecliptic.
 */

const DEG = Math.PI / 180;

/* The Sun's apex -- the direction it travels through the local medium. The
 * bubble is squashed toward it and trails away from it. */
const APEX = new THREE.Vector3(0, 0, -1).normalize();

const SHELLS = Object.freeze([
  {
    id: "termination-shock",
    name: "The termination shock",
    au: 85,
    colour: 0x9fae6a,
    /*
     * A high rim exponent on purpose. These two are *surfaces* -- a change in
     * the speed and direction of invisible plasma -- and a low exponent makes
     * a shell read as a volume of something, which is exactly the wrong idea
     * about a boundary that contains no material of its own. The Oort shells
     * below use the opposite setting for the opposite reason.
     */
    opacity: 0.060,
    rim: 3.6,
    /*
     * The ecliptic marker gets its own colour, brighter than the shell's.
     *
     * The shell is a wash seen through tens of degrees of sky and wants to sit
     * just above black; the marker is a line two pixels wide at the distances
     * these live at, and a line that faint is not a line. Reported as "the
     * orbital design ... make it little bit visible, i am not talking about
     * the spherical but the path color" -- so the path is lifted and the wash
     * is left alone. The two heliosphere paths are warm and the two Oort paths
     * are cold, which is also the distinction the cards make.
     */
    marker: 0xd8ec86,
    markerOpacity: 0.62,
    flank: 0.96,
    nose: 0.88,
    tail: 1.34,
  },
  {
    id: "heliopause",
    name: "The heliopause",
    au: 120,
    colour: 0xd8925a,
    opacity: 0.095,
    rim: 4.2,
    marker: 0xffb877,
    markerOpacity: 0.68,
    flank: 0.96,
    nose: 0.88,
    tail: 1.42,
  },
  {
    id: "oort-inner",
    name: "The inner Oort Cloud",
    au: 2_000,
    colour: 0x8d9aa8,
    opacity: 0.030,
    /*
     * A low exponent on purpose. The heliosphere shells are surfaces and want
     * a tight bright rim; the Oort Cloud is tens of thousands of AU thick and
     * wants a broad wash, because that is what an unresolved shell looks like
     * rather than a bubble with a wall.
     */
    rim: 1.25,
    marker: 0xaecbf0,
    markerOpacity: 0.50,
  },
  {
    id: "oort-outer",
    name: "The outer Oort Cloud",
    au: 100_000,
    colour: 0x7f8b9c,
    // Lifted with the re-cut distance curve: the same wash spread over a shell
    // that is now 6,311 units across instead of 3,465 reads fainter per pixel.
    opacity: 0.034,
    rim: 1.05,
    marker: 0x9dbbe4,
    markerOpacity: 0.46,
  },
]);

/*
 * The heliosphere's shape, and the rule that stops it escaping the Oort Cloud.
 *
 * The first version gave each heliosphere shell a single `elongation` number
 * and offset the sphere by a fraction of it. That produced a heliopause whose
 * tail reached 4,674 scene units while the outer Oort Cloud sat at 3,465 --
 * so the boundary the cards call "not the edge of the Solar System" was
 * drawn as the furthest thing in the Solar System. Reported, correctly, as
 * "it seems that heliopause is the farthest boundary".
 *
 * The failure was not the number. It was that **nothing in the code related
 * the tail to what it had to stay inside of.** Re-cutting the distance curve
 * fixes today's collision; only a constraint stops the next one.
 *
 * So the tail is no longer a free parameter. Each shell declares where it
 * *wants* its nose and tail, as multiples of its own radius, and the shapes
 * are then resolved from the outside in: every elongated shell is clipped to
 * sit inside whatever encloses it, with a margin. The heliopause can never
 * pass the inner Oort Cloud and the termination shock can never pass the
 * heliopause, whatever anyone later does to the anchors in `celestialScale`.
 *
 * `nose` is below 1 because the bubble is genuinely compressed on the leading
 * side; `tail` is above 1 and is an *exaggeration*. Placed by the scene's own
 * log compression, a heliotail of even a thousand AU would come out at about
 * 1.04x the nose radius -- true, and invisible. The shape is drawn at the
 * scale where it can be seen at all, and the cards say the shape is argued
 * about.
 */
const TAIL_CLEARANCE = 0.92;

function computeShellShapes() {
  const shapes = new Map();
  let tailLimit = Infinity;

  for (let index = SHELLS.length - 1; index >= 0; index -= 1) {
    const spec = SHELLS[index];
    const radius = auToSceneRadius(spec.au);

    if (!(spec.tail > 1)) {
      // A true sphere -- it sets the ceiling for everything nested inside it.
      tailLimit = radius * TAIL_CLEARANCE;
      continue;
    }

    const nose = radius * spec.nose;
    const tail = Math.min(radius * spec.tail, tailLimit);
    shapes.set(spec.id, {
      radius,
      flank: radius * (spec.flank ?? 0.96),
      // The ellipsoid that has `nose` in front and `tail` behind: half their
      // sum is its semi-axis, half their difference is how far it is offset.
      semiZ: (tail + nose) * 0.5,
      centreZ: (tail - nose) * 0.5,
      nose,
      tail,
    });
    tailLimit = tail * TAIL_CLEARANCE;
  }

  return shapes;
}

const SHELL_SHAPES = computeShellShapes();

/*
 * Mote counts went up with the shell. The cloud now spans 3,723 to 6,311
 * scene units rather than 2,965 to 3,465 -- roughly five times the volume --
 * and the same number of points spread through it is a thinner scattering than
 * it was. These are one `Points` draw call between them, so the extra costs a
 * few thousand vertices and no state changes at all.
 */
const QUALITY = Object.freeze({
  low: { motes: 3_400, segments: 40 },
  medium: { motes: 5_600, segments: 56 },
  high: { motes: 8_400, segments: 64 },
});

const SHELL_VERTEX = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SHELL_FRAGMENT = /* glsl */`
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uRim;
  uniform float uHilite;
  varying vec3 vWorld;

  void main() {
    /*
     * Limb brightening, which is what actually makes this read as a shell
     * rather than a ball. A line of sight that grazes a thin shell passes
     * through far more of it than one that hits it square on, so the edge is
     * bright and the middle is nearly nothing. It is the same reason a soap
     * bubble has a visible rim, and it works whether the camera is inside the
     * shell or outside it.
     *
     * The sphere is scaled into an ellipsoid, so this is not the true surface
     * normal -- close enough for a glow, and far cheaper than carrying one.
     */
    vec3 outward = normalize(vWorld);
    vec3 lineOfSight = normalize(vWorld - cameraPosition);
    float grazing = 1.0 - abs(dot(outward, lineOfSight));

    float alpha = uOpacity * pow(grazing, uRim) * (1.0 + uHilite * 2.8);
    if (alpha < 0.0016) discard;
    gl_FragColor = vec4(uColour * (1.0 + uHilite * 0.7), alpha);
  }
`;

const MOTE_VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  uniform float uProjScale;
  uniform float uHilite;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha * (1.0 + uHilite * 2.2);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uProjScale / max(-mvPosition.z, 0.0001);
    gl_PointSize = clamp(px, 0.9, 2.2) * uPixelRatio;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const MOTE_FRAGMENT = /* glsl */`
  uniform vec3 uColour;
  varying float vAlpha;
  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    if (dot(offset, offset) > 0.25) discard;
    if (vAlpha < 0.004) discard;
    gl_FragColor = vec4(uColour, vAlpha);
  }
`;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createShell(spec, segments) {
  const radius = auToSceneRadius(spec.au);
  const geometry = new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColour: { value: new THREE.Color(spec.colour) },
      uOpacity: { value: spec.opacity },
      uRim: { value: spec.rim },
      uHilite: { value: 0 },
    },
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    /*
     * Depth test ON. The deep-sky shell learned this the hard way and says so
     * at length in its own source: renderOrder does not order across passes,
     * so a transparent object with the test off paints over every solid body
     * in the scene. With it on, planets occlude these correctly, and the sky
     * cannot occlude them because the sky writes no depth.
     */
    depthTest: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${spec.name} shell`;
  mesh.renderOrder = -40;
  mesh.frustumCulled = false;

  // Squashed toward the apex, drawn out behind it. See the note at the top.
  applyShellShape(mesh, spec.id);
  return mesh;
}

/**
 * The Oort Cloud's contents, and the one thing that must be right about them:
 * they are **isotropic**. Every other population in this scene is a disc,
 * because everything else formed in one. Whatever put material out here --
 * the giant planets throwing it outward, then passing stars and the Galaxy's
 * own tide stirring it -- destroyed any memory of a plane. Drawn flat it
 * would be the wrong object entirely.
 */
function createOortMotes(count) {
  const random = seededRandom(0x4f4f5254);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);

  const inner = auToSceneRadius(2_000);
  const outer = auToSceneRadius(100_000);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;

    // A uniform direction on the sphere. Sampling the angles directly would
    // pile everything at the poles.
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const s = Math.sqrt(Math.max(0, 1 - u * u));

    // Weighted outward: the outer cloud holds far more than the inner one.
    const radius = inner + Math.pow(random(), 0.55) * (outer - inner);

    positions[i3] = s * Math.cos(theta) * radius;
    positions[i3 + 1] = u * radius;
    positions[i3 + 2] = s * Math.sin(theta) * radius;

    sizes[i] = 1.15 + Math.pow(random(), 2.2) * 2.9;
    alphas[i] = 0.11 + Math.pow(random(), 1.4) * 0.35;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColour: { value: new THREE.Color(0xccd9ea) },
      uPixelRatio: { value: 1 },
      uProjScale: { value: 900 },
      uHilite: { value: 0 },
    },
    vertexShader: MOTE_VERTEX,
    fragmentShader: MOTE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "Oort Cloud inferred population";
  points.renderOrder = -39;
  points.frustumCulled = false;
  return points;
}

/* --------------------------------------------------------------- regions */

const REGIONS = Object.freeze([
  {
    id: "termination-shock",
    name: "The termination shock",
    au: 85,
    type: "Heliosphere boundary · an imaginary line, like the equator",
    detail: "Where the solar wind slows below its own sound speed — an imaginary boundary, nothing to see",
    span: "Roughly 75 – 90 AU · it moves with solar activity",
    period: "Solar wind drops from ~400 km/s to ~130 km/s",
    population: "Nothing. An imaginary boundary — a change in invisible plasma, not a thing",
    labels: { size: "What you would see", diameter: "Distance", orbital: "What changes there" },
    subtitle: "The solar wind hits the brakes",
    lede: "The solar wind leaves the Sun at up to four hundred kilometres a second and holds that speed for eighty astronomical units without meeting anything. Then it runs into the gas between the stars, and over the space of a few AU it drops below the speed at which pressure waves can travel through it. It does not stop here. It piles up — and none of it can be seen.",
    sections: [
      ["An imaginary boundary, in the way the equator is", "Before anything else: the termination shock emits no light. It is not dust, not cloud, not a wall, not a membrane, not a glowing front. An astronaut floating at 85 AU would see exactly the same starfield as one at 84 AU — no line, no shimmer, no boundary of any kind. An imaginary boundary is not a vague one. The equator is imaginary: nothing is painted on the ocean, no line is visible from a ship or from orbit, and yet it sits at a precisely known place, it can be crossed, and crossing it changes measurable things. This is the same kind of object. The termination shock is defined by where a measurement changes — where the solar wind drops below its own sound speed — and not by anything being there to see. What changes here is the speed of a plasma so thin that a cubic centimetre of it holds a handful of atoms, far emptier than any vacuum ever made in a laboratory. The shell drawn on screen is a marker for that place, not a picture of a thing."],
      ["What happens", "A shock front, in the same sense as a sonic boom: the flow crosses its own sound speed and cannot warn the material ahead that it is coming. The wind slows abruptly, compresses, and heats to around a million kelvin. Everything beyond this point is solar wind that has already been stopped."],
      ["How we know", "Two spacecraft flew through it and reported back — through instruments, not cameras. Voyager 1 crossed in December 2004 at 94 AU; Voyager 2 crossed in August 2007 at 84 AU. Ten astronomical units apart, which is itself the finding, because it means the boundary is neither a sphere nor fixed."],
      ["Why the shape", "The Sun is travelling through the interstellar medium, so the bubble is squashed on the leading side and drawn out into a long tail behind. The shape here is that idea rather than a solved flow, and it is deliberately exaggerated: at this scene's compression a true heliotail would barely register as a bulge. IBEX data has been read as a rounded bubble and also as a croissant, and the argument is not over."],
    ],
    members: [],
  },
  {
    id: "heliopause",
    name: "The heliopause",
    au: 120,
    type: "Heliosphere boundary · an imaginary line, like the equator",
    detail: "The edge of the Sun's bubble — an imaginary boundary, and not the edge of the Solar System",
    span: "About 120 AU · 18 billion km",
    period: "Voyager 1 in 2012 · Voyager 2 in 2018",
    population: "Nothing. An imaginary boundary — two thin gases in balance, nothing to see",
    labels: { size: "What you would see", diameter: "Distance", orbital: "Crossed by" },
    subtitle: "Where the Sun's wind finally gives way",
    lede: "Here the outward pressure of the solar wind and the inward pressure of the interstellar medium balance, and the wind goes no further. On this side, the particles came from the Sun. On the far side, they came from other stars. It is the only boundary in the Solar System that anything built by humans has physically crossed — and the crossing was registered by an instrument, because there was nothing to see.",
    sections: [
      ["An imaginary boundary, in the way the equator is", "Neither this boundary nor the termination shock inside it is visible to the eye, at any distance, from any angle. There is no glowing line, no wall of fire, no soap-bubble surface. An astronaut holding station right at the heliopause would see an unremarkable starfield and could not tell which side of it they were on. An imaginary boundary is not a vague one. The equator is imaginary: nothing is painted on the ocean, no line is visible from a ship or from orbit, and yet it sits at a precisely known place, it can be crossed, and crossing it changes measurable things. This is the same kind of object. The heliopause is defined by where a measurement changes — where the Sun's wind stops pushing and the gas between the stars starts — and not by anything being there to see. What meets here are two gases far too thin to see, pushing against each other. The shell drawn on screen is a marker for that place — the same choice every NASA illustration of the heliosphere makes, and for the same reason an atlas prints the equator."],
      ["What crossing it looked like", "Voyager 1 crossed on 25 August 2012 at 121.6 AU, and the evidence was a sudden fortyfold jump in plasma density — the thin hot gas of the heliosphere giving way to the cold dense gas between the stars, measured through the oscillation of the plasma itself. Voyager 2 followed on 5 November 2018 at 119 AU, with a working plasma instrument, and confirmed it directly. Nothing appeared in either spacecraft's field of view, because there was nothing there to appear."],
      ["It is not the edge of the Solar System", "This is the most common thing said wrongly about the outer Solar System. The heliopause is the edge of the solar *wind*. The Sun's *gravity* reaches vastly further — out through the Oort Cloud, which begins around 2,000 AU and may extend to 100,000. On that measure the heliopause is barely one part in eight hundred of the way out."],
      ["What is beyond it", "Interstellar space, and then nothing else belonging to the Sun until the Oort Cloud. Voyager 1 is the most distant human object ever built and is still, gravitationally, deep inside the Solar System. It will take roughly three hundred centuries to reach the Oort Cloud's inner edge."],
      ["The one part of it that has been mapped", "IBEX found a narrow band of energetic neutral atoms arcing across the sky — the IBEX ribbon — which traces how this boundary meets the interstellar magnetic field. That is a map made of particles arriving at a detector, not of light arriving at an eye. Nobody has ever photographed the heliopause, and nobody could."],
    ],
    members: [],
  },
  {
    id: "oort-inner",
    name: "The inner Oort Cloud",
    au: 2000,
    type: "Inferred population",
    detail: "The Hills cloud · denser, flatter, and still only inferred",
    span: "Roughly 2,000 – 20,000 AU",
    period: "Tens of thousands of years for one orbit",
    population: "Inferred — never directly observed at any wavelength",
    labels: { size: "Status" },
    subtitle: "A doughnut inside the shell",
    lede: "The inner Oort Cloud, or Hills cloud, is thought to be denser than the outer one and still somewhat flattened — it has not been stirred for quite as long. It is the reservoir that refills the outer cloud as passing stars strip objects away, which is the reason the outer cloud still exists after four and a half billion years.",
    sections: [
      ["Why it has to be there", "The outer cloud is loosely bound enough that encounters with passing stars should have emptied it long ago. Something has been topping it up. A denser inner reservoir, proposed by Jack Hills in 1981, does that — and it also explains why long-period comets keep arriving at the rate they do rather than tailing off."],
      ["Sedna may be a member", "Sedna's closest approach to the Sun is 76 AU, far beyond anything Neptune can reach, and its orbit takes about 11,400 years. No process operating in the Solar System today can produce that. It is often described as the first inner Oort Cloud object found — which would make it the only piece of this region anyone has ever actually seen."],
      ["What is drawn", "A soft shell rather than objects, for the same reason as the outer cloud: nothing here has been observed. The scattering of motes inside it is deliberately kept below the size at which anything reads as a body."],
    ],
    members: [
      {
        body: "Sedna",
        order: "Dwarf planet candidate",
        character: "Possibly the first inner Oort Cloud object ever found",
        range: "Perihelion 76 AU · aphelion about 937 AU",
        note: "Too far out for Neptune to have placed it and too close in for the outer cloud to explain. A passing star, a lost planet, or capture from another star in the Sun's birth cluster are all still on the table.",
        motion: "About 11,400 years for one orbit · near its closest approach now",
      },
    ],
  },
  {
    id: "oort-outer",
    name: "The outer Oort Cloud",
    au: 100000,
    type: "Inferred population",
    detail: "A spherical shell at the limit of the Sun's gravity",
    span: "Roughly 20,000 – 100,000 AU · up to 1.6 light-years",
    period: "Millions of years for one orbit",
    population: "Perhaps a trillion objects larger than 1 km — an estimate, not a count",
    subtitle: "Never seen, and known anyway",
    lede: "The outermost thing that belongs to the Sun. A spherical shell of icy bodies reaching perhaps a quarter of the way to the nearest star, so loosely held that a star passing light-years away can shake comets loose from it. No telescope has ever detected it, and its existence is not seriously in doubt.",
    sections: [
      ["How something invisible is known", "Long-period comets arrive from every direction in the sky rather than along the ecliptic, and when their orbits are traced backwards they all reach out to the same enormous range of distances before turning around. Comet Hale-Bopp is the famous example — visible to the naked eye for eighteen months across 1996 and 1997, on an orbit that carries it out past 350 AU. We see the pieces that fall out of the cloud. We have never seen the cloud."],
      ["Why it is a sphere", "Every other population in this scene is a disc, because everything else formed in one. This material was thrown outward by the giant planets and has since been stirred for billions of years by passing stars and by the gravity of the Galaxy itself. Whatever memory it had of a plane is long gone. That is why it surrounds the Solar System in every direction, and it is the single most distinctive thing about it."],
      ["Where the Sun stops", "At about 100,000 AU — some 1.6 light-years — the Sun's gravitational grip becomes weaker than the Galaxy's. That, and not the heliopause, is the outer edge of the Solar System in any meaningful sense. Alpha Centauri is 4.37 light-years away, so the two stars' clouds may very nearly touch."],
    ],
    members: [],
  },
]);

/*
 * Something to point at, and something to point *at it with*.
 *
 * The first attempt gave each boundary two large invisible spheres sitting on
 * its shell. It resolved correctly in every automated check and was useless in
 * practice, and the reason is worth keeping: **the thing you can see was not
 * the thing you could hover.** The shells glow across the whole sky; the
 * pickable parts were eight unmarked spheres in arbitrary directions, and
 * nobody is going to find those by moving a mouse.
 *
 * The obvious fix -- make the shell itself pickable -- is worse. A sphere
 * enclosing the entire scene intercepts every ray that misses everything
 * else, so every click on empty sky would open a heliosphere card and the
 * explore-empty-space gesture would be gone.
 *
 * So each boundary gets what the Kuiper zones already have and what the
 * planets' orbit guides already have: **a visible ring where it crosses the
 * ecliptic, and a wide invisible band around that ring to hover.** The ring
 * is the affordance -- it says "there is a boundary here, at this distance" --
 * and the band is the target. The shell still carries the true shape; the
 * ring is only where that shape cuts the plane everything else orbits in.
 *
 * The heliosphere rings inherit the shell's squash and offset, so they cut
 * the real cross-section rather than a circle that would quietly deny the
 * heliotail.
 */

/**
 * Puts an object on its shell's cross-section -- the shell mesh itself, the
 * ecliptic ring, or the invisible band that is hovered.
 *
 * The rings are rotated a quarter turn about X to lie in the ecliptic, and
 * three.js composes a local matrix as translate * rotate * scale -- so the
 * scale happens in the ring's own space, *before* the rotation. Local Y
 * becomes world Z. A shell that squashes world X and stretches world Z
 * therefore needs `(flank, semiZ, 1)` on a ring and `(flank, flank, semiZ)`
 * on the sphere: the pair reads wrong and is right, which is why they are
 * both written here rather than at the two call sites.
 *
 * APEX points along -Z, so the tail is +Z and the offset is positive.
 */
function applyShellShape(object, id, { flat = false } = {}) {
  const shape = SHELL_SHAPES.get(id);
  if (!shape) return;
  const { radius, flank, semiZ, centreZ } = shape;
  if (flat) object.scale.set(flank / radius, semiZ / radius, 1);
  else object.scale.set(flank / radius, flank / radius, semiZ / radius);
  object.position.copy(APEX).multiplyScalar(-centreZ);
}

function createBoundaryRing(spec, radius) {
  /*
   * Width is a fraction of the radius rather than a constant, so a ring keeps
   * the same apparent thickness wherever it sits -- and the fraction was
   * raised because at the distance these are viewed from, 0.004 of the radius
   * came out at about one and a half pixels. A one-pixel additive line over a
   * starfield is indistinguishable from nothing.
   */
  const width = Math.max(8, radius * 0.0062);
  const geometry = new THREE.RingGeometry(radius - width, radius + width, 240, 1);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(spec.marker ?? spec.colour),
    transparent: true,
    opacity: spec.markerOpacity ?? (spec.id.startsWith("oort") ? 0.2 : 0.34),
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  /*
   * Final round (the owner's "amber band near 43 AU"): the width above is
   * sized for the system view, five to eleven thousand units out, where it
   * comes to two to eight pixels. Focused on a Kuiper Belt world the camera
   * can sit under a hundred units from the termination-shock marker, and the
   * same 31-unit band then spans a quarter of the screen. So each fragment
   * works out how wide the band is on screen where it is being drawn, and
   * fades it out between 10 and 28 pixels: a line stays a line, and close up
   * -- where the shell itself already says where the boundary is -- it steps
   * aside. From the system view nothing changes.
   */
  const markerUniforms = {
    uMarkerHalfWidth: { value: width },
    uMarkerProjScale: { value: 400 },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, markerUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMarkerWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vMarkerWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMarkerWorld;\nuniform float uMarkerHalfWidth;\nuniform float uMarkerProjScale;")
      .replace("#include <clipping_planes_fragment>", [
        "#include <clipping_planes_fragment>",
        "  float markerPixels = 2.0 * uMarkerHalfWidth * uMarkerProjScale / max(distance(vMarkerWorld, cameraPosition), 1e-3);",
        "  diffuseColor.a *= 1.0 - smoothstep(10.0, 28.0, markerPixels);",
      ].join("\n"));
  };
  material.customProgramCacheKey = () => "outer-boundary-marker";
  const ring = new THREE.Mesh(geometry, material);
  ring.userData.markerUniforms = markerUniforms;
  ring.name = `${spec.name} ecliptic marker`;
  ring.rotation.x = Math.PI * 0.5;
  ring.renderOrder = -38;
  ring.frustumCulled = false;
  applyShellShape(ring, spec.id, { flat: true });
  return ring;
}

function createRegionMarkers({ group, hoverTargets }) {
  const markers = [];
  const rings = [];

  REGIONS.forEach((region, index) => {
    const spec = SHELLS.find((entry) => entry.id === region.id);
    const radius = auToSceneRadius(region.au);

    const ring = createBoundaryRing(spec ?? { id: region.id, name: region.name, colour: 0x9aa7b8 }, radius);
    ring.userData.boundaryId = region.id;
    group.add(ring);
    rings.push(ring);

    /*
     * The band. Wide enough to find without hunting, and stopped short of the
     * next boundary out so the four never overlap -- the termination shock and
     * the heliopause are only forty-three scene units apart, which is the
     * tightest pair and the one that sets the width.
     */
    const previous = index > 0 ? auToSceneRadius(REGIONS[index - 1].au) : radius * 0.94;
    const next = index < REGIONS.length - 1 ? auToSceneRadius(REGIONS[index + 1].au) : radius * 1.10;
    const inner = Math.max(radius - (radius - previous) * 0.45, radius * 0.965);
    const outer = Math.min(radius + (next - radius) * 0.45, radius * 1.05);

    const band = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 200, 1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    band.name = `${region.name} region field`;
    band.rotation.x = Math.PI * 0.5;
    band.renderOrder = -90;
    markPointerProxy(band);
    applyShellShape(band, region.id, { flat: true });

    band.userData = {
      name: region.name,
      detail: region.detail,
      isRegion: true,
      isOuterBoundary: true,
      regionId: region.id,
      visualRadius: (outer - inner) * 0.5,
      focusVisualRadius: radius,
      setHovered(active) {
        group.userData.hiliteTarget = active ? 1 : 0;
        if (active) group.userData.hiliteId = region.id;
      },
      info: {
        type: region.type,
        description: region.lede,
        diameter: region.span,
        orbitalSpeed: region.period,
        sizeComparison: region.population,
      },
      region: {
        systemName: region.id.startsWith("oort") ? "The Oort Cloud" : "The heliosphere",
        subtitle: region.subtitle,
        lede: region.lede,
        span: region.span,
        period: region.period,
        population: region.population,
        labels: region.labels,
        sections: region.sections,
        members: region.members,
      },
      ringData: {
        systemName: region.id.startsWith("oort") ? "The Oort Cloud" : "The heliosphere",
        order: `${index + 1} of ${REGIONS.length} boundaries, from the Sun outward`,
        character: region.type,
        description: region.lede,
        radialRange: region.span,
        motion: region.period,
      },
    };
    group.add(band);
    markers.push(band);
    hoverTargets?.push(band);
  });

  group.userData.boundaryRings = rings;
  return markers;
}

export function createOuterBoundaries({
  world,
  hoverTargets = null,
  quality = "medium",
  pixelRatio = 1,
} = {}) {
  const profile = QUALITY[quality] ?? QUALITY.medium;
  const group = new THREE.Group();
  group.name = "Outer boundaries";

  const shells = SHELLS.map((spec) => {
    const mesh = createShell(spec, profile.segments);
    mesh.userData.shellId = spec.id;
    group.add(mesh);
    return mesh;
  });

  const motes = createOortMotes(profile.motes);
  motes.material.uniforms.uPixelRatio.value = Math.min(Number(pixelRatio) || 1, 2);
  group.add(motes);

  group.userData.shells = shells;
  group.userData.motes = motes;
  group.userData.regionMarkers = createRegionMarkers({ group, hoverTargets });
  group.userData.hilite = 0;
  group.userData.hiliteTarget = 0;
  group.userData.hiliteId = null;
  group.userData.physicalModel = {
    terminationShockAu: 85,
    heliopauseAu: 120,
    oortInnerAu: [2000, 20000],
    oortOuterAu: [20000, 100000],
    observed: ["termination-shock", "heliopause"],
    inferred: ["oort-inner", "oort-outer"],
  };

  world.add(group);
  return group;
}

export function updateOuterBoundaries(system, motionScale = 1, camera = null) {
  if (!system) return;

  if (camera) {
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const projScale = camera.projectionMatrix.elements[5] * height * 0.5;
    const uniforms = system.userData.motes?.material?.uniforms;
    if (uniforms?.uProjScale) uniforms.uProjScale.value = projScale;
    system.userData.boundaryRings?.forEach((ring) => {
      const markerUniforms = ring.userData.markerUniforms;
      if (markerUniforms) markerUniforms.uMarkerProjScale.value = projScale;
    });
  }

  const target = system.userData.hiliteTarget ?? 0;
  const current = system.userData.hilite ?? 0;
  const eased = THREE.MathUtils.lerp(current, target, target > current ? 0.18 : 0.09);
  system.userData.hilite = Math.abs(eased - target) < 0.002 ? target : eased;

  /*
   * Only the hovered shell lights. Highlighting by radius, the way the Kuiper
   * Belt does, would be wrong here -- these are four separate objects rather
   * than bands of one population, and the entire point of drawing them
   * together is that the heliopause and the Oort Cloud are different things.
   */
  const activeId = system.userData.hiliteId;
  const hilite = system.userData.hilite;
  system.userData.shells?.forEach((shell) => {
    const uniforms = shell.material?.uniforms;
    if (!uniforms?.uHilite) return;
    uniforms.uHilite.value = shell.userData.shellId === activeId ? hilite : 0;
  });
  system.userData.boundaryRings?.forEach((ring) => {
    const base = ring.userData.baseOpacity ?? (ring.userData.baseOpacity = ring.material.opacity);
    const active = ring.userData.boundaryId === activeId;
    ring.material.opacity = active ? base * (1 + hilite * 2.2) : base;
  });

  const moteUniforms = system.userData.motes?.material?.uniforms;
  if (moteUniforms?.uHilite) {
    moteUniforms.uHilite.value = String(activeId ?? "").startsWith("oort") ? hilite : 0;
  }

  // The cloud turns, very slowly, and in no particular plane -- it has none.
  if (system.userData.motes) {
    system.userData.motes.rotation.y += 0.0000024 * motionScale;
  }
}

export function applyOuterBoundaryQuality(system, pixelRatio = 1) {
  const uniforms = system?.userData?.motes?.material?.uniforms;
  if (uniforms?.uPixelRatio) uniforms.uPixelRatio.value = Math.min(Number(pixelRatio) || 1, 2);
}

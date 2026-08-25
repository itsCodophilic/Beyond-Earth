/**
 * Shared heliocentric orbit helpers.
 *
 * The guide line and the moving planet must use the same eccentric-anomaly,
 * inclination, and apsidal-rotation transform. Keeping the maths here prevents
 * visual gaps between a planet and its displayed path.
 */
import * as THREE from "three";

export function solveOrbitEccentricAnomaly(meanAnomaly, eccentricity) {
  if (eccentricity <= 0.0001) return meanAnomaly;
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const denominator = Math.max(0.000001, 1 - eccentricity * Math.cos(eccentricAnomaly));
    const delta = (
      eccentricAnomaly
      - eccentricity * Math.sin(eccentricAnomaly)
      - meanAnomaly
    ) / denominator;
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 0.00001) break;
  }
  return eccentricAnomaly;
}

/** Writes the exact scene-space position for one point on a planetary orbit. */
export function setOrbitPosition(
  target,
  semiMajorAxis,
  eccentricity = 0,
  meanAnomaly = 0,
  inclination = 0,
  rotation = 0,
) {
  const e = THREE.MathUtils.clamp(eccentricity ?? 0, 0, 0.92);
  const eccentricAnomaly = solveOrbitEccentricAnomaly(meanAnomaly, e);
  const semiMinorAxis = semiMajorAxis * Math.sqrt(Math.max(0.0001, 1 - e * e));

  const orbitalX = semiMajorAxis * (Math.cos(eccentricAnomaly) - e);
  const orbitalZ = semiMinorAxis * Math.sin(eccentricAnomaly);
  const inclinedZ = orbitalZ * Math.cos(inclination ?? 0);
  const inclinedY = orbitalZ * Math.sin(inclination ?? 0);
  const cosRotation = Math.cos(rotation ?? 0);
  const sinRotation = Math.sin(rotation ?? 0);

  target.set(
    orbitalX * cosRotation - inclinedZ * sinRotation,
    inclinedY,
    orbitalX * sinRotation + inclinedZ * cosRotation,
  );
  return target;
}

/*
 * Orbit guides, as screen-space ribbons rather than as lines.
 *
 * `THREE.Line` cannot be made thicker. `linewidth` on LineBasicMaterial is
 * silently ignored by every WebGL implementation -- the spec allows it and no
 * desktop driver honours anything but 1.0 -- so every orbit in the scene was a
 * single hardware pixel, which on a Retina display is *half* a CSS pixel. Zoom
 * out far enough for the whole system to fit and each path falls below the
 * sampling grid: it stops being a faint line and starts being a dotted,
 * crawling, aliased mess, and beyond that it disappears entirely.
 *
 * The fix is to stop drawing lines. Each orbit is built as a triangle strip --
 * two vertices per point, offset to either side of the path -- and the offset
 * is applied *after* projection, in clip space, so the ribbon is a constant
 * number of pixels wide however far away it is. That is the whole trick: an
 * orbit two thousand units across and an orbit ten units across are both drawn
 * one and a half pixels wide, and neither can vanish.
 *
 * Two other things fall out of it for free:
 *
 *   - **Antialiasing.** A ribbon has an interior, so the fragment shader knows
 *     how far across the width it is and can feather both edges. A one-pixel
 *     GL line has no interior and no way to be smoothed.
 *   - **Depth.** The near half of an orbit can be drawn brighter than the far
 *     half, which is most of what makes an ellipse read as a ring lying in
 *     space rather than as a circle drawn on the screen.
 */

const ORBIT_VERTEX = /* glsl */`
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aPhase;
  uniform float uWidth;
  uniform vec2 uViewport;
  varying float vSide;
  varying float vDepth;
  varying float vPhase;
  varying vec2 vScreen;

  void main() {
    vSide = aSide;
    vPhase = aPhase;

    vec4 current = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 next = projectionMatrix * modelViewMatrix * vec4(aNext, 1.0);

    // Normalised device coordinates, corrected for aspect so the ribbon is as
    // wide vertically as it is horizontally.
    vec2 currentScreen = (current.xy / max(0.0001, current.w)) * uViewport;
    vec2 nextScreen = (next.xy / max(0.0001, next.w)) * uViewport;
    vec2 along = nextScreen - currentScreen;
    // A degenerate segment (both points projecting to the same pixel) would
    // give a zero-length normal and collapse the ribbon; fall back to a fixed
    // direction rather than emitting NaNs.
    vec2 direction = length(along) > 0.00001 ? normalize(along) : vec2(1.0, 0.0);
    vec2 normal = vec2(-direction.y, direction.x);

    // The offset is applied in clip space and scaled by w, which is what makes
    // it independent of distance: multiplying by w exactly cancels the
    // perspective divide that follows.
    vec2 offset = normal * aSide * uWidth / uViewport;
    current.xy += offset * current.w;

    vDepth = current.w;
    // Where this fragment lands on screen, in normalised device coordinates.
    // The fragment shader needs it to know whether it is sitting inside the
    // Sun's glare.
    vScreen = current.xy / max(0.0001, current.w);
    gl_Position = current;
  }
`;

const ORBIT_FRAGMENT = /* glsl */`
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uNear;
  uniform float uFar;
  uniform vec3 uSunScreen;
  uniform float uSunGlare;
  uniform float uAspect;
  varying float vSide;
  varying float vDepth;
  varying float vPhase;
  varying vec2 vScreen;

  void main() {
    // Feather both edges of the ribbon. A hard-edged two-pixel quad aliases
    // just as badly as the line it replaced.
    float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));

    /*
     * The near half of the orbit is brighter than the far half. It is a real
     * depth cue and it costs one smoothstep: without it an inclined ellipse
     * reads as a flat ring drawn over the scene, and with it the eye picks up
     * immediately which side is in front.
     */
    float depth = 1.0 - smoothstep(uNear, uFar, vDepth);
    float alpha = uOpacity * edge * (0.45 + 0.55 * depth);

    /*
     * Glare hides what is behind it.
     *
     * The Sun's photosphere is opaque and occludes these guides properly, but
     * seen from the outer system it is a handful of pixels across sitting in
     * the middle of a two-hundred-pixel additive flare. Both the flare and the
     * guides are transparent, so neither hides the other, and a ribbon drawn
     * straight across the brightest object in the scene reads unmistakably as
     * "you can see through the Sun".
     *
     * Fading the guide out inside the glare is what actually happens when you
     * look at a star: the glare washes out everything fainter near it, in
     * front or behind. The z component of uSunScreen is zero when the Sun is
     * off screen or behind the camera, which switches the whole term off.
     */
    vec2 toSun = (vScreen - uSunScreen.xy) * vec2(uAspect, 1.0);
    float glare = 1.0 - smoothstep(0.30, 1.0, length(toSun) / max(0.0001, uSunGlare));
    alpha *= 1.0 - glare * uSunScreen.z;

    if (alpha <= 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
  }
`;

/**
 * Creates an orbital guide inside the scene's dedicated orbit layer.
 *
 * The returned object is a Mesh rather than a Line, and it carries the same
 * `userData` the rest of the application expects -- `isPlanetOrbit`,
 * `baseColor`, `baseOpacity` and the orbital elements -- so hover, highlight
 * and click-to-focus all continue to work against it unchanged. Because it now
 * has real width, raycasting against it is also considerably more forgiving
 * than it was against a zero-width line with a distance threshold.
 */
export function createOrbitLine(
  orbitRoot,
  radius,
  color = 0xffffff,
  opacity = 0.18,
  tilt = 0,
  eccentricity = 0,
  rotation = 0,
  segmentCount = 240,
  width = 1.6,
) {
  const segments = Math.max(120, Math.floor(segmentCount));
  const path = Array.from({ length: segments + 1 }, (_, index) => setOrbitPosition(
    new THREE.Vector3(),
    radius,
    eccentricity,
    (index / segments) * Math.PI * 2,
    tilt,
    rotation,
  ));

  /*
   * Two vertices per path point, and each one also carries its *neighbour* so
   * the shader can work out which way is along the path. The last point wraps
   * to the first, because an orbit is closed and a ribbon with a seam in it is
   * a visible notch.
   */
  const count = path.length;
  const positions = new Float32Array(count * 2 * 3);
  const nexts = new Float32Array(count * 2 * 3);
  const sides = new Float32Array(count * 2);
  const phases = new Float32Array(count * 2);
  const indices = [];

  for (let i = 0; i < count; i += 1) {
    const point = path[i];
    const next = path[(i + 1) % count];
    for (let s = 0; s < 2; s += 1) {
      const v = i * 2 + s;
      positions[v * 3] = point.x;
      positions[v * 3 + 1] = point.y;
      positions[v * 3 + 2] = point.z;
      nexts[v * 3] = next.x;
      nexts[v * 3 + 1] = next.y;
      nexts[v * 3 + 2] = next.z;
      sides[v] = s === 0 ? 1 : -1;
      phases[v] = i / count;
    }
    if (i < count - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aNext", new THREE.BufferAttribute(nexts, 3));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(sides, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    vertexShader: ORBIT_VERTEX,
    fragmentShader: ORBIT_FRAGMENT,
    uniforms: {
      uColour: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uWidth: { value: width },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uNear: { value: radius * 0.5 },
      uFar: { value: radius * 2.6 },
      // Filled in every frame by setOrbitSolarGlare. z carries "is the Sun
      // actually on screen", so an unset uniform simply does nothing.
      uSunScreen: { value: new THREE.Vector3(0, 0, 0) },
      uSunGlare: { value: 0.05 },
      uAspect: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  });

  const orbit = new THREE.Mesh(geometry, material);
  orbit.name = "Planet orbit guide";
  orbit.frustumCulled = false;
  orbit.renderOrder = -8;

  /*
   * The guide is invisible to a raycaster, and that is not a bug in the
   * raycaster.
   *
   * The ribbon has width only on the GPU: both vertices of every pair sit at
   * exactly the same world position, and the shader pushes them apart *after*
   * projection. That is the whole reason it stays a constant number of pixels
   * wide at any distance -- and it means the geometry the CPU sees is a strip
   * of zero-area triangles. Nothing can ever hit it. Hover and click-to-focus
   * both went dead the moment the guides stopped being lines.
   *
   * So the path is kept a second time as a real `THREE.Line`, never rendered,
   * used only for hit testing. `raycaster.params.Line.threshold` then works
   * exactly as it did before -- which matters, because main.js sizes that
   * threshold from the camera distance to give a constant pixel-sized grab
   * area, and that logic should not have to know the guide changed.
   *
   * `orbit.raycast` delegates to it and rewrites the hit to point back at the
   * ribbon, so every caller still receives the object it has always received,
   * with its userData and its `point` for the hover locator.
   */
  const hitGeometry = new THREE.BufferGeometry().setFromPoints(path);
  const hitLine = new THREE.Line(hitGeometry, new THREE.LineBasicMaterial());
  hitLine.matrixAutoUpdate = false;
  orbit.raycast = (raycaster, intersects) => {
    hitLine.matrixWorld.copy(orbit.matrixWorld);
    const found = [];
    THREE.Line.prototype.raycast.call(hitLine, raycaster, found);
    for (let i = 0; i < found.length; i += 1) {
      found[i].object = orbit;
      intersects.push(found[i]);
    }
  };
  /*
   * `material.color` and `material.opacity` are read and written directly by
   * the highlight code in main.js, which predates this and should not have to
   * know that the guide is now a shader. Both are defined as accessors onto
   * the uniforms, so every existing `orbit.material.opacity = x` and
   * `orbit.material.color.copy(...)` keeps working.
   */
  Object.defineProperty(material, "color", {
    get() { return material.uniforms.uColour.value; },
    set(value) { material.uniforms.uColour.value.copy(value); },
  });
  Object.defineProperty(material, "opacity", {
    get() { return material.uniforms.uOpacity.value; },
    set(value) { material.uniforms.uOpacity.value = value; },
  });

  orbit.userData = {
    isPlanetOrbit: true,
    /*
     * Hovering widens the ribbon as well as brightening it.
     *
     * Opacity alone is a weak signal on a line one and a half pixels wide --
     * there is barely anything there to brighten. Going to four pixels is
     * unmistakable, and because the width is applied in screen space it is
     * exactly as unmistakable on an orbit that fills the frame as on one that
     * is a small ellipse near the Sun.
     */
    setHoverGlow(amount) {
      const t = Math.max(0, Math.min(1, amount));
      material.uniforms.uWidth.value = width + t * 2.6;
    },
    baseColor: color,
    baseOpacity: opacity,
    orbitRadius: radius,
    orbitInclination: tilt,
    orbitEccentricity: eccentricity,
    orbitRotation: rotation,
    setViewport(width2, height2) {
      material.uniforms.uViewport.value.set(width2 * 0.5, height2 * 0.5);
    },
    setSolarGlare(screenX, screenY, glareRadius, strength, aspect) {
      material.uniforms.uSunScreen.value.set(screenX, screenY, strength);
      material.uniforms.uSunGlare.value = glareRadius;
      material.uniforms.uAspect.value = aspect;
    },
  };
  orbitRoot.add(orbit);
  // The hit line is never added to the scene: it exists only to be raycast
  // against, and adding it would put an untextured white line over every
  // orbit in the system.
  orbit.userData.hitLine = hitLine;
  return orbit;
}

/**
 * Tells every guide how large the drawing buffer is.
 *
 * The ribbon width is specified in pixels, so the shader needs the viewport to
 * convert it into clip space. Called once at build and on every resize; there
 * is no per-frame cost.
 */
export function setOrbitViewport(orbitRoot, width, height) {
  orbitRoot.traverse((object) => {
    object.userData?.setViewport?.(width, height);
  });
}

/**
 * Tells every guide where the Sun is on screen and how far its glare reaches.
 *
 * `screenX`/`screenY` are normalised device coordinates, `radius` is the glare
 * radius in the same units measured vertically, and `strength` is 0 when the
 * Sun is behind the camera or off screen entirely.
 */
export function setOrbitSolarGlare(orbitRoot, screenX, screenY, radius, strength, aspect) {
  orbitRoot.traverse((object) => {
    object.userData?.setSolarGlare?.(screenX, screenY, radius, strength, aspect);
  });
}

/**
 * Main application entry point.
 *
 * Think of this file as the director of the experience. Helper modules know how
 * to build individual things; main.js decides when to build them, how they are
 * related in the scene graph, and what changes on every animation frame.
 *
 * Three.js rendering pipeline used here:
 *   Scene (all objects) + Camera (viewpoint) → WebGLRenderer → <canvas>
 */


// The `THREE` namespace provides Scene, Mesh, Geometry, Material, Vector, etc.
import * as THREE from 'three';
// Importing brand.js runs its DOM event setup; it does not export a value.
import './brand.js';
import { PLANET_CONFIGS } from './planets/index.js';
import { makeNoiseTexture } from './graphics/proceduralTextures.js';
import { makeSunSurfaceMaterial } from './graphics/materials.js';
import { loadUniverseTextures } from './graphics/loadTextures.js';
import { makeBeltDust, makeParticles } from './scene/particles.js';
import { createAsteroidBelt } from './scene/asteroidBelt.js';
import { addAtmosphere, createPlanet } from './scene/planetFactory.js';

// An async immediately-invoked function lets us await texture loading while
// keeping all application variables private to this module.
(async () => {

  // Cache frequently used HTML elements once instead of querying every frame.
  const canvas = document.querySelector("#universe");
  const loader = document.querySelector("#loader");
  const progressBar = document.querySelector("#progress-bar");
  const scaleLabel = document.querySelector("#scale-label");
  const bodyLabel = document.querySelector("#body-label");
  const bodyDetail = document.querySelector("#body-detail");

  // Scene is the root container of the 3D scene graph. Anything not attached to
  // the scene (directly or through a Group) cannot be rendered.
  const scene = new THREE.Scene();
  // Exponential fog gradually blends distant fragments into near-black, adding depth.
  scene.fog = new THREE.FogExp2(0x01040a, 0.0018);

  // PerspectiveCamera arguments: vertical FOV, aspect ratio, near plane, far plane.
  // Objects outside near/far are clipped and never sent through the full pipeline.
  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 5000);
  // The renderer owns the WebGL context and draws into the existing HTML canvas.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  // Cap pixel ratio at 2; very dense displays would otherwise become unnecessarily expensive.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  // Clock supplies elapsed seconds for time-based shader animation.
  const clock = new THREE.Clock();
  // Raycaster projects an invisible ray from the camera through the mouse position.
  const raycaster = new THREE.Raycaster();
  // Pointer stores normalized device coordinates: x/y values from -1 to +1.
  const pointer = new THREE.Vector2(-10, -10);

  // Groups are transformable containers. Separating orbit lines lets us fade all
  // of them together without searching through unrelated world objects.
  const world = new THREE.Group();
  const orbitRoot = new THREE.Group();
  const planets = [];
  const hoverTargets = [];
  scene.add(world, orbitRoot);

  // Input handlers update target/raw state. The animation loop eases current
  // values toward those targets, avoiding jumps when input events arrive.
  let scrollProgress = 0;
  let smoothProgress = 0;
  let targetYaw = -0.55;
  let targetPitch = 0.22;
  let yaw = targetYaw;
  let pitch = targetPitch;
  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };
  let pointerDownPosition = { x: 0, y: 0 };
  let dragDistance = 0;
  // focusedBody is null during free flight or references the clicked Mesh.
  let focusedBody = null;
  let hasCameraFocusPoint = false;
  const cameraFocusPoint = new THREE.Vector3();

  // AmbientLight illuminates every surface equally so shadowed sides are not pure black.
  scene.add(new THREE.AmbientLight(0x8da1c6, 0.34));

  // PointLight radiates from one location, matching the Sun's role in the system.
  const sunLight = new THREE.PointLight(0xffe6aa, 5200, 1450, 1.5);
  scene.add(sunLight);

  // A cool DirectionalLight adds readable edge detail from a consistent direction.
  const fillLight = new THREE.DirectionalLight(0x8bdcff, 0.75);
  fillLight.position.set(-50, 40, 90);
  scene.add(fillLight);

  // Asset loading is isolated so scene setup only consumes a ready texture dictionary.
  const textures = await loadUniverseTextures();

  // `??` chooses the generated fallback only when the downloaded value is null/undefined.
  const sunSurfaceTexture = textures.sun ?? makeNoiseTexture("sun");
  // A Mesh combines a geometry (shape) with a material (how pixels should look).
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(9.2, 128, 128),
    makeSunSurfaceMaterial(sunSurfaceTexture),
  );
  sun.name = "Sun";
  sun.userData = { name: "Sun", detail: "G-type star | 99.86% of solar system mass", focusScale: 1.2 };
  world.add(sun);
  // Only objects in hoverTargets participate in raycasting, keeping checks focused.
  hoverTargets.push(sun);

  // Config-driven construction means adding a normal planet only requires a new data file.
  PLANET_CONFIGS.forEach((config) => {
    createPlanet({ config, textures, world, orbitRoot, planets, hoverTargets });
  });
  // Keep named references only for bodies that receive extra meshes or special behavior.
  const earth = planets.find((planet) => planet.name === "Earth");
  const venus = planets.find((planet) => planet.name === "Venus");
  const jupiter = planets.find((planet) => planet.name === "Jupiter");
  const saturn = planets.find((planet) => planet.name === "Saturn");
  const uranus = planets.find((planet) => planet.name === "Uranus");
  const neptune = planets.find((planet) => planet.name === "Neptune");

  // Atmospheres are slightly larger transparent spheres parented to their planets.
  addAtmosphere(venus, 1.24, 0xffd99a, 0.16);
  addAtmosphere(jupiter, 6.38, 0xffd4a2, 0.08);
  addAtmosphere(saturn, 5.32, 0xf8dfb0, 0.08);
  addAtmosphere(uranus, 2.86, 0x9ff7ff, 0.12);
  addAtmosphere(neptune, 2.76, 0x5d8dff, 0.13);

  if (saturn) {
    // RingGeometry is a flat disc with a hole. DoubleSide keeps both faces visible.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.45, 9.4, 180),
      new THREE.MeshBasicMaterial({
        map: textures.saturnRing ?? null,
        color: 0xe6d0a2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    // Rotate the default upright ring into Saturn's equatorial plane.
    ring.rotation.x = Math.PI / 2.05;
    ring.rotation.z = 0.24;
    saturn.add(ring);
  }

  // Earth is layered like an onion: solid globe, cloud shell, atmospheric glow,
  // and optional light shell. Small radius differences avoid z-fighting.
  const earthClouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.285, 96, 96),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      // alphaMap controls which cloud pixels are opaque or transparent.
      alphaMap: textures.earthClouds ?? null,
      transparent: true,
      opacity: textures.earthClouds ? 0.44 : 0,
      depthWrite: false,
      roughness: 1,
    }),
  );
  earth.add(earthClouds);

  const earthAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.305, 96, 96),
    new THREE.MeshBasicMaterial({ color: 0x5bdcff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
  );
  earth.add(earthAtmosphere);

  if (textures.earthLights) {
    // Additive blending makes bright city pixels glow over the globe underneath.
    const earthLights = new THREE.Mesh(
      new THREE.SphereGeometry(1.265, 96, 96),
      new THREE.MeshBasicMaterial({
        color: 0xffd37a,
        map: textures.earthLights,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    earth.add(earthLights);
  }

  // The Moon is attached to a pivot at Earth's center. Rotating the pivot makes
  // the child Moon orbit without recalculating its x/z position every frame.
  const moonPivot = new THREE.Group();
  earth.add(moonPivot);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 96, 96),
    new THREE.MeshStandardMaterial({
      map: textures.moon ?? makeNoiseTexture("moon"),
      roughness: 0.96,
      bumpMap: textures.moon ?? null,
      bumpScale: 0.04,
    }),
  );
  moon.name = "Moon";
  moon.position.set(3.05, 0.08, 0);
  moon.userData = { name: "Moon", detail: "Earth's moon | cratered companion", focusScale: 3.3 };
  moonPivot.add(moon);
  hoverTargets.push(moon);

  // This line mirrors the Moon's pivot path and is parented to moving Earth.
  const moonOrbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, i) => {
        const angle = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * 3.05, 0.08, Math.sin(angle) * 3.05);
      }),
    ),
    new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.28 }),
  );
  earth.add(moonOrbit);

  // Large point clouds are efficient because each field is rendered as one object.
  const stars = makeParticles(scene, {
    count: 6800,
    radius: 1800,
    position: new THREE.Vector3(0, 0, 0),
    colors: ["#ffffff", "#95dcff", "#ffd38c", "#ff9ec2"],
    size: 1.55,
    opacity: 0.95,
  });

  const milkyWay = makeParticles(scene, {
    count: 11500,
    radius: 320,
    position: new THREE.Vector3(0, -18, 0),
    colors: ["#ffffff", "#7de7ff", "#ffd37a", "#ff7da8"],
    size: 1.15,
    spiral: true,
    opacity: 0,
  });
  milkyWay.rotation.x = 0.28;

  // Asteroid meshes provide nearby shape; dust points cheaply supply density.
  const asteroidGroup = createAsteroidBelt(world);
  const asteroidDust = makeBeltDust(world);

  /*
    updateScrollProgress
    - Updates normalized scroll progress and refreshes the HUD progress bar.
  */
  function updateScrollProgress() {
    // maxScroll is the number of vertical pixels the document can actually travel.
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    // Dividing current scroll by maximum produces a reusable 0–1 progress value.
    scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
    if (progressBar && progressBar.style) progressBar.style.width = `${scrollProgress * 100}%`;
  }

  function getCameraDistance(progress) {
    // smoothstep-like easing: slow at both ends, faster through the middle.
    const eased = progress * progress * (3 - 2 * progress);
    // lerp(a, b, t) returns a at t=0, b at t=1, and blends between them.
    return THREE.MathUtils.lerp(4.8, 620, eased);
  }

  /*
    getFocusPoint
    - Chooses the camera target based on the selected body or nearby Earth when zoomed in.
    - Keeps the camera on the Sun at long range when no body is focused.
  */
  function getFocusPoint(distance) {
    // getWorldPosition is important for nested bodies such as the Moon because
    // their local `.position` is relative to a moving parent.
    if (focusedBody) return focusedBody.getWorldPosition(new THREE.Vector3());
    if (distance < 18) return earth.getWorldPosition(new THREE.Vector3());
    return new THREE.Vector3(0, 0, 0);
  }

  /*
    updateScaleLabel
    - Writes a descriptive label to the HUD based on the current camera distance.
    - Helps the user understand the scroll-driven scale transition.
  */
  function updateScaleLabel(distance) {
    if (distance < 16) scaleLabel.textContent = "Earth orbit";
    else if (distance < 92) scaleLabel.textContent = "Inner solar system";
    else if (distance < 240) scaleLabel.textContent = "Outer planets";
    else scaleLabel.textContent = "Milky Way scale";
  }

  /*
    updateHoveredBody
    - Raycasts from the mouse pointer into the scene and updates HUD text.
    - Adds a hover CSS state for subtle cursor feedback.
  */
  function updateHoveredBody() {
    const named = getBodyAtPointer();
    // Optional chaining avoids errors when the ray hits no named body.
    bodyLabel.textContent = named?.userData?.name ?? "Free drift";
    bodyDetail.textContent = named?.userData?.detail ?? "Eight-planet solar system";
    document.body.classList.toggle("is-hovering-body", Boolean(named));
  }

  /*
    updatePointerFromEvent
    - Converts browser pointer coordinates into normalized device coordinates.
    - These coordinates are used for raycasting and interactive hover detection.
  */
  function updatePointerFromEvent(event) {
    // Browser coordinates start at top-left in pixels. WebGL normalized device
    // coordinates start at the center, range -1..1, and have positive Y upward.
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / innerHeight) * 2 + 1;
  }

  /*
    findInteractiveObject
    - Walks up the scene graph to identify the top-most interactive body.
    - Ensures raycast hits on child mesh parts still resolve to the parent planet object.
  */
  function findInteractiveObject(object) {
    // Raycasting may hit a child such as an atmosphere or ring. Walking through
    // `.parent` finds the first ancestor carrying our identifying metadata.
    while (object) {
      if (object.userData?.name) return object;
      object = object.parent;
    }
    return null;
  }

  /*
    getBodyAtPointer
    - Uses the raycaster to determine which body is under the cursor.
    - Supports nested mesh structures by resolving to the interactive parent.
  */
  function getBodyAtPointer() {
    // `true` recursively checks descendants. Results are nearest-first, so [0]
    // is the visible surface closest to the camera along the ray.
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hoverTargets, true)[0];
    return hit ? findInteractiveObject(hit.object) : null;
  }

  /*
    focusBody
    - Toggles selection of a body and scrolls the page toward a camera distance that frames it.
    - Clicking the same body twice clears focus and returns to free drift.
  */
  function focusBody(body) {
    if (!body) {
      focusedBody = null;
      return;
    }
    // Selecting the same body again toggles focus off.
    focusedBody = focusedBody === body ? null : body;
    if (!focusedBody) return;
    bodyLabel.textContent = body.userData.name;
    bodyDetail.textContent = body.userData.detail ?? "Selected body";
    // Convert the body's distance from the Sun into an approximate scroll point.
    const radius = body.userData.orbitRadius ?? body.getWorldPosition(new THREE.Vector3()).length();
    const idealProgress = THREE.MathUtils.clamp(radius / 230, 0.035, 0.72);
    window.scrollTo({ top: idealProgress * (document.documentElement.scrollHeight - innerHeight), behavior: "smooth" });
  }

  /*
    setup input handlers
    - Wires scroll, pointer, drag, and keyboard events to the camera control state.
    - Keeps the scene interactive while preserving pointer selection and drag motion.
  */
  // `passive` promises that the handler will not cancel scrolling, helping browsers
  // keep scrolling responsive while JavaScript updates its normalized value.
  addEventListener("scroll", updateScrollProgress, { passive: true });
  addEventListener("pointermove", (event) => {
    updatePointerFromEvent(event);
    if (isDragging) {
      // Track the largest movement so pointerup can distinguish a drag from a click.
      dragDistance = Math.max(
        dragDistance,
        Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y),
      );
      // Horizontal deltas orbit around Y (yaw); vertical deltas control pitch.
      targetYaw -= (event.clientX - lastPointer.x) * 0.006;
      targetPitch -= (event.clientY - lastPointer.y) * 0.004;
      targetPitch = THREE.MathUtils.clamp(targetPitch, -1.1, 1.1);
    } else {
      // Even without dragging, a tiny pointer parallax keeps the scene feeling alive.
      targetYaw += pointer.x * 0.0005;
      targetPitch += pointer.y * 0.00025;
    }
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  addEventListener("pointerdown", (event) => {
    updatePointerFromEvent(event);
    isDragging = true;
    dragDistance = 0;
    pointerDownPosition = { x: event.clientX, y: event.clientY };
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  addEventListener("pointerup", (event) => {
    updatePointerFromEvent(event);
    isDragging = false;
    // HUD clicks belong to HTML controls and must not select objects behind them.
    if (event.target.closest?.(".hud")) return;
    if (dragDistance > 12) return;
    const body = getBodyAtPointer();
    if (body) focusBody(body);
    else focusBody(null);
  });

  addEventListener("pointercancel", () => {
    // Browsers can cancel input when a gesture leaves the window or becomes a system gesture.
    isDragging = false;
  });

  addEventListener("keydown", (event) => {
    // Keyboard controls modify the same targets as dragging, so smoothing still applies.
    if (event.key === "Escape") focusedBody = null;
    if (event.key === "ArrowLeft") targetYaw += 0.18;
    if (event.key === "ArrowRight") targetYaw -= 0.18;
    if (event.key === "ArrowUp") targetPitch = THREE.MathUtils.clamp(targetPitch + 0.12, -1.1, 1.1);
    if (event.key === "ArrowDown") targetPitch = THREE.MathUtils.clamp(targetPitch - 0.12, -1.1, 1.1);
  });

  addEventListener("resize", () => {
    // Both the camera projection and drawing buffer must match the new viewport.
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /*
    animate
    - Main render loop that updates the camera, rotates bodies, animates particles, and renders the scene.
  */
  function animate() {
    const elapsed = clock.getElapsedTime();
    // Easing with lerp each frame creates inertia. Larger factors catch up faster.
    smoothProgress = THREE.MathUtils.lerp(smoothProgress, scrollProgress, 0.065);
    yaw = THREE.MathUtils.lerp(yaw, targetYaw, 0.075);
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, 0.075);

    // ----- Update planet revolution and self-rotation -----
    planets.forEach((planet) => {
      const data = planet.userData;
      data.angle += data.orbitSpeed * 0.0024;
      // cos/sin convert an orbit angle into x/z coordinates around the Sun.
      planet.position.set(
        Math.cos(data.angle) * data.orbitRadius,
        Math.sin(data.angle * 0.7) * Math.sin(data.tilt) * 1.8,
        Math.sin(data.angle) * data.orbitRadius,
      );
      planet.rotation.y += data.spinSpeed;
    });

    // ----- Calculate the camera's spherical orbit around its focus point -----
    const distance = getCameraDistance(smoothProgress);
    const targetFocusPoint = getFocusPoint(distance);
    if (!hasCameraFocusPoint) {
      // Initialize once with copy; otherwise the first frame would ease from (0,0,0).
      cameraFocusPoint.copy(targetFocusPoint);
      hasCameraFocusPoint = true;
    }
    // Smooth target movement is especially important because planets keep orbiting.
    cameraFocusPoint.lerp(targetFocusPoint, focusedBody ? 0.055 : 0.075);
    const focusScale = focusedBody?.userData?.focusScale ?? 1;
    const cameraDistance = focusedBody ? Math.max(4.5, Math.min(distance, 30 / focusScale)) : distance;
    // Yaw, pitch, and distance are spherical coordinates converted into x/y/z.
    const x = Math.cos(pitch) * Math.sin(yaw) * cameraDistance;
    const y = Math.sin(pitch) * cameraDistance * 0.64;
    const z = Math.cos(pitch) * Math.cos(yaw) * cameraDistance;
    camera.position.set(cameraFocusPoint.x + x, cameraFocusPoint.y + y, cameraFocusPoint.z + z);
    // lookAt rotates the camera so its forward direction points at the target.
    camera.lookAt(cameraFocusPoint);
    camera.fov = THREE.MathUtils.lerp(camera.fov, THREE.MathUtils.lerp(42, 68, smoothProgress), 0.04);
    camera.updateProjectionMatrix();

    // ----- Animate special meshes and scene effects -----
    earthClouds.rotation.y += 0.0032;
    earthAtmosphere.rotation.y -= 0.0014;
    moonPivot.rotation.y += 0.011;
    moon.rotation.y += 0.006;
    moonOrbit.rotation.y = Math.sin(elapsed * 0.2) * 0.04;
    sun.rotation.y += 0.0025;
    // Updating uTime sends the current time into GLSL for procedural movement.
    if (sun.material.uniforms) sun.material.uniforms.uTime.value = elapsed;
    asteroidGroup.rotation.y += 0.001;
    asteroidGroup.children.forEach((asteroid) => {
      // Each asteroid's unique spin vector was stored during construction.
      asteroid.rotation.x += asteroid.userData.spin.x;
      asteroid.rotation.y += asteroid.userData.spin.y;
      asteroid.rotation.z += asteroid.userData.spin.z;
    });
    asteroidDust.rotation.y -= 0.0007;
    stars.rotation.y += 0.00008;
    milkyWay.rotation.y += 0.00045;
    stars.material.uniforms.uTime.value = elapsed;
    asteroidDust.material.uniforms.uTime.value = elapsed;
    milkyWay.material.uniforms.uTime.value = elapsed * 0.72;
    // Fade the galaxy in only during the latter part of the scroll journey.
    milkyWay.material.uniforms.uOpacity.value = THREE.MathUtils.clamp((smoothProgress - 0.54) / 0.34, 0, 1) * 0.9;
    orbitRoot.children.forEach((orbit) => {
      orbit.material.opacity = THREE.MathUtils.clamp((smoothProgress - 0.035) / 0.18, 0.04, 0.22);
    });

    // ----- Sync HTML, draw the frame, then schedule the next frame -----
    updateScaleLabel(distance);
    updateHoveredBody();
    renderer.render(scene, camera);
    // requestAnimationFrame runs before the browser's next repaint (usually ~60 FPS).
    requestAnimationFrame(animate);
  }

  // Seed state and begin the self-scheduling render loop.
  updateScrollProgress();
  animate();

  // Keep the loader visible briefly after setup so the opening transition feels intentional.
  setTimeout(() => {
    loader.classList.add("is-hidden");
  }, 1350);
})();



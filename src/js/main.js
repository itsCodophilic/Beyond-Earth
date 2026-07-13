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
import { loadUniverseTextures } from './graphics/loadTextures.js';
import { createMoonSystem } from './planets/earth/satellites/moon.js';
import { PLANET_CONFIGS } from './planets/index.js';
import {
  createAsteroidBelt,
  resolveAsteroidInstanceHit,
  setAsteroidInspectionDetail,
  updateAsteroidBelt,
} from './scene/asteroidBelt.js';
import { createPlanet, updatePlanetVisuals } from './scene/planetFactory.js';
import { SpaceEnvironment } from './scene/space/spaceEnvironment.js';
import { createSun, updateSun } from './stars/sun/sun.js';

// An async immediately-invoked function lets us await texture loading while
// keeping all application variables private to this module.
(async () => {

  // Cache frequently used HTML elements once instead of querying every frame.
  const canvas = document.querySelector("#universe");
  const loader = document.querySelector("#loader");
  const progressBar = document.querySelector("#progress-bar");
  const bodyCard = document.querySelector("#body-card");
  const bodyConnector = document.querySelector("#body-connector");
  const cardType = document.querySelector("#card-type");
  const cardMode = document.querySelector("#card-mode");
  const cardName = document.querySelector("#card-name");
  const cardDiameter = document.querySelector("#card-diameter");
  const cardSpeed = document.querySelector("#card-speed");
  const cardDistance = document.querySelector("#card-distance");
  const cardDescription = document.querySelector("#card-description");
  const cardHint = document.querySelector("#card-hint");
  const cardClose = document.querySelector("#card-close");

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
  let displayedBody = null;
  let dismissedBody = null;
  // Instanced asteroid raycasts are intentionally throttled. Testing thousands
  // of boulders roughly 12 times per second feels immediate to the pointer while
  // leaving the render loop enough time for smooth WebGL animation.
  let cachedHoveredBody = null;
  let lastAsteroidRaycastTime = -Infinity;
  let hasCameraFocusPoint = false;
  let simulationTime = 0;
  let elapsedTime = 0;
  let isPageVisible = !document.hidden;
  const cameraFocusPoint = new THREE.Vector3();
  const targetFocusPoint = new THREE.Vector3();

  // AmbientLight illuminates every surface equally so shadowed sides are not pure black.
  scene.add(new THREE.AmbientLight(0x8da1c6, 0.16));

  // A cool DirectionalLight adds readable edge detail from a consistent direction.
  const fillLight = new THREE.DirectionalLight(0x8bdcff, 0.32);
  fillLight.position.set(-50, 40, 90);
  scene.add(fillLight);

  // Asset loading is isolated so scene setup only consumes a ready texture dictionary.
  const textures = await loadUniverseTextures();

  // The star module owns the Sun's surface, atmosphere, corona, flares, and light.
  const sun = createSun({ world, hoverTargets, texture: textures.sun });

  // Every planet is built through one realistic factory. Earth receives its extra
  // cloud, atmosphere, night-light, and Moon layers below as before.
  PLANET_CONFIGS.forEach((config) => {
    createPlanet({
      config,
      textures,
      world,
      orbitRoot,
      planets,
      hoverTargets,
    });
  });

  const earth = planets.find((planet) => planet.name === "Earth");

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

  // Earth owns its satellite builder; main.js only keeps references needed for animation.
  const { moon, moonPivot } = createMoonSystem({ earth, textures, hoverTargets });

  // Space is a distant celestial sphere rather than a nearby cloud of coloured
  // particles. The environment owns steady stars, the tilted Milky Way, cloudy
  // galactic light, and its dark interstellar dust lanes.
  const spaceEnvironment = new SpaceEnvironment({ scene, camera, renderer });
  await spaceEnvironment.init();

  // Asteroid meshes provide nearby shape; dust points cheaply supply density.
  const asteroidBelt = createAsteroidBelt({ world, hoverTargets });
  const jupiter = planets.find((planet) => planet.name === "Jupiter");

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
  function getFocusPoint(distance, target) {
    // getWorldPosition is important for nested bodies such as the Moon because
    // their local `.position` is relative to a moving parent.
    if (focusedBody) return focusedBody.getWorldPosition(target);
    if (distance < 18) return earth.getWorldPosition(target);
    return target.set(0, 0, 0);
  }

  /** Writes a body's structured metadata into the right-side inspection panel. */
  function updateBodyCard(body) {
    const isVisible = Boolean(body);
    bodyCard.classList.toggle("is-visible", isVisible);
    bodyCard.setAttribute("aria-hidden", String(!isVisible));
    if (!body) {
      displayedBody = null;
      bodyConnector.classList.remove("is-visible");
      return;
    }

    // DOM text only needs rewriting when the inspected object changes.
    if (displayedBody !== body) {
      const info = body.userData.info ?? {};
      cardType.textContent = info.type ?? "Celestial body";
      cardName.textContent = body.userData.name ?? body.name;
      cardDiameter.textContent = info.diameter ?? "Not available";
      cardSpeed.textContent = info.orbitalSpeed ?? "Not available";
      cardDistance.textContent = info.distanceFromEarth ?? "Not available";
      cardDescription.textContent = info.description ?? body.userData.detail ?? "No description available.";
      displayedBody = body;
    }
    const isFocused = focusedBody === body;
    cardMode.textContent = isFocused ? "Slow motion · Focused" : "Hover preview";
    cardHint.textContent = isFocused
      ? "Slow motion active · Drag to inspect · Click empty space to exit"
      : "Click to focus · Focus activates slow motion · Then drag to inspect";
  }

  /** Projects a 3D world position into 2D pixels and points the line at the body. */
  function updateBodyConnector(body) {
    if (!body || innerWidth <= 760) {
      bodyConnector.classList.remove("is-visible");
      return;
    }

    const projected = body.getWorldPosition(new THREE.Vector3()).project(camera);
    const bodyX = (projected.x * 0.5 + 0.5) * innerWidth;
    const bodyY = (-projected.y * 0.5 + 0.5) * innerHeight;
    const isOnScreen = projected.z > -1 && projected.z < 1
      && bodyX >= 0 && bodyX <= innerWidth && bodyY >= 0 && bodyY <= innerHeight;
    if (!isOnScreen) {
      bodyConnector.classList.remove("is-visible");
      return;
    }

    const cardRect = bodyCard.getBoundingClientRect();
    const cardX = cardRect.left;
    const cardY = THREE.MathUtils.clamp(bodyY, cardRect.top + 26, cardRect.bottom - 26);
    const deltaX = cardX - bodyX;
    const deltaY = cardY - bodyY;
    bodyConnector.style.left = `${bodyX}px`;
    bodyConnector.style.top = `${bodyY}px`;
    bodyConnector.style.width = `${Math.hypot(deltaX, deltaY)}px`;
    bodyConnector.style.transform = `rotate(${Math.atan2(deltaY, deltaX)}rad)`;
    bodyConnector.classList.add("is-visible");
  }

  /** Hover previews a body; a clicked/focused body always takes priority. */
  function updateInspectionInterface() {
    const hoveredBody = getBodyAtPointer();
    // Moving away from a dismissed body resets dismissal, allowing a later hover.
    if (dismissedBody && hoveredBody !== dismissedBody) dismissedBody = null;
    const candidateBody = focusedBody ?? hoveredBody;
    const inspectedBody = candidateBody === dismissedBody ? null : candidateBody;
    document.body.classList.toggle("is-hovering-body", Boolean(hoveredBody));
    updateBodyCard(inspectedBody);
    updateBodyConnector(inspectedBody);
  }

  // Closing a card dismisses the current body until the pointer leaves it. If the
  // body was focused, this also restores normal simulation speed and free flight.
  cardClose.addEventListener("click", () => {
    dismissedBody = displayedBody;
    focusBody(null);
    updateBodyCard(null);
  });

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
  function findInteractiveObject(hit) {
    // An InstancedMesh represents thousands of rocks inside one JavaScript
    // object. Its raycast hit includes an instanceId, which the belt module
    // converts into a stable inspection/focus target for that exact rock.
    const instanceTarget = resolveAsteroidInstanceHit(hit);
    if (instanceTarget) return instanceTarget;

    let object = hit?.object;
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
  function getBodyAtPointer(forceRaycast = false) {
    const now = performance.now();
    if (!forceRaycast && now - lastAsteroidRaycastTime < 80) {
      return cachedHoveredBody;
    }
    lastAsteroidRaycastTime = now;

    // `true` recursively checks descendants. A satellite can visually overlap its
    // much larger parent, so satellite hits receive priority over the first planet hit.
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hoverTargets, true);
    const bodies = hits.map((hit) => findInteractiveObject(hit)).filter(Boolean);
    cachedHoveredBody = bodies.find((body) => body.userData?.info?.type === "Natural satellite")
      ?? bodies[0]
      ?? null;
    return cachedHoveredBody;
  }

  /*
    focusBody
    - Toggles selection of a body and scrolls the page toward a camera distance that frames it.
    - Clicking the same body twice clears focus and returns to free drift.
  */
  function focusBody(body) {
    // Restore a previous instanced rock before changing focus. Its inexpensive
    // belt representation replaces the temporary high-resolution close-up.
    if (focusedBody) setAsteroidInspectionDetail(focusedBody, false);

    // Selecting the same body again—or clicking empty space—toggles focus off.
    focusedBody = body && focusedBody !== body ? body : null;
    if (!focusedBody) return;

    // Only instanced asteroids react here; planets, satellites, and individually
    // modeled major asteroids continue using their normal meshes.
    setAsteroidInspectionDetail(focusedBody, true);
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
    } else if (!spaceEnvironment.reducedMotion) {
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
    if (event.target.closest?.(".hud, .body-card")) return;
    if (dragDistance > 12) return;
    // A click always performs a fresh raycast, even if the hover cache was just
    // updated, so the selected instance exactly matches the pointer-up position.
    const body = getBodyAtPointer(true);
    if (body) focusBody(body);
    else focusBody(null);
  });

  addEventListener("pointercancel", () => {
    // Browsers can cancel input when a gesture leaves the window or becomes a system gesture.
    isDragging = false;
  });

  addEventListener("keydown", (event) => {
    // Keyboard controls modify the same targets as dragging, so smoothing still applies.
    if (event.key === "Escape") focusBody(null);
    if (event.key === "ArrowLeft") targetYaw += 0.18;
    if (event.key === "ArrowRight") targetYaw -= 0.18;
    if (event.key === "ArrowUp") targetPitch = THREE.MathUtils.clamp(targetPitch + 0.12, -1.1, 1.1);
    if (event.key === "ArrowDown") targetPitch = THREE.MathUtils.clamp(targetPitch - 0.12, -1.1, 1.1);
  });

  addEventListener("resize", () => {
    // Both the camera projection and drawing buffer must match the new viewport.
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    spaceEnvironment.resize(innerWidth, innerHeight, devicePixelRatio);
  });

  // Hidden tabs should not spend CPU time advancing an invisible WebGL scene.
  // Browsers already throttle animation frames, but this also skips every
  // simulation, raycast-interface, and shader-uniform update explicitly.
  addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;
    spaceEnvironment.setPaused(!isPageVisible);
    if (isPageVisible) clock.getDelta();
  });

  // Release GPU-owned space resources when the page is actually discarded.
  addEventListener("pagehide", (event) => {
    // A page kept in the back-forward cache will resume with its WebGL context;
    // only a true discard should release the environment resources.
    if (!event.persisted) spaceEnvironment.dispose();
  });

  /*
    animate
    - Main render loop that updates the camera, rotates bodies, animates particles, and renders the scene.
  */
  function animate() {
    const deltaTime = Math.min(clock.getDelta(), 0.05);
    if (!isPageVisible) {
      requestAnimationFrame(animate);
      return;
    }
    elapsedTime += deltaTime;
    // Focus mode slows physical scene motion without slowing camera input/easing.
    const motionScale = focusedBody ? 0.12 : 1;
    simulationTime += deltaTime * motionScale;
    // Easing with lerp each frame creates inertia. Larger factors catch up faster.
    smoothProgress = THREE.MathUtils.lerp(smoothProgress, scrollProgress, 0.065);
    yaw = THREE.MathUtils.lerp(yaw, targetYaw, 0.075);
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, 0.075);

    // ----- Update planet revolution and self-rotation -----
    planets.forEach((planet) => {
      const data = planet.userData;
      data.angle += data.orbitSpeed * 0.0024 * motionScale;
      // cos/sin convert an orbit angle into x/z coordinates around the Sun.
      planet.position.set(
        Math.cos(data.angle) * data.orbitRadius,
        Math.sin(data.angle * 0.7) * Math.sin(data.tilt) * 1.8,
        Math.sin(data.angle) * data.orbitRadius,
      );
      planet.rotation.y += data.spinSpeed * motionScale;
      updatePlanetVisuals(planet, simulationTime, motionScale);
    });

    // ----- Calculate the camera's spherical orbit around its focus point -----
    const distance = getCameraDistance(smoothProgress);
    getFocusPoint(distance, targetFocusPoint);
    if (!hasCameraFocusPoint) {
      // Initialize once with copy; otherwise the first frame would ease from (0,0,0).
      cameraFocusPoint.copy(targetFocusPoint);
      hasCameraFocusPoint = true;
    }
    // Asteroids can be tens of scene units away and visually tiny. Their metadata
    // supplies a stronger focus easing so the camera reaches them promptly.
    const focusEase = focusedBody?.userData?.focusEase
      ?? (focusedBody ? 0.055 : 0.075);
    cameraFocusPoint.lerp(targetFocusPoint, focusEase);

    const focusScale = focusedBody?.userData?.focusScale ?? 1;
    const minimumFocusDistance = focusedBody?.userData?.minFocusDistance ?? 4.5;
    const explicitFocusDistance = focusedBody?.userData?.focusDistance;
    const cameraDistance = focusedBody
      ? explicitFocusDistance
        ?? Math.max(minimumFocusDistance, Math.min(distance, 30 / focusScale))
      : distance;
    // Yaw, pitch, and distance are spherical coordinates converted into x/y/z.
    const x = Math.cos(pitch) * Math.sin(yaw) * cameraDistance;
    const y = Math.sin(pitch) * cameraDistance * 0.64;
    const z = Math.cos(pitch) * Math.cos(yaw) * cameraDistance;
    camera.position.set(cameraFocusPoint.x + x, cameraFocusPoint.y + y, cameraFocusPoint.z + z);
    // lookAt rotates the camera so its forward direction points at the target.
    camera.lookAt(cameraFocusPoint);
    // Focus mode owns the lens as well as camera distance. A narrower FOV creates
    // a cinematic inspection shot instead of retaining the wide scroll lens.
    const targetFov = focusedBody
      ? focusedBody.userData.focusFov ?? 30
      : THREE.MathUtils.lerp(42, 68, smoothProgress);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, focusedBody ? 0.08 : 0.04);
    camera.updateProjectionMatrix();

    // ----- Animate special meshes and scene effects -----
    earthClouds.rotation.y += 0.0032;
    earthAtmosphere.rotation.y -= 0.0014;
    moonPivot.rotation.y += 0.011 * motionScale;
    // A small oscillation suggests lunar libration while the pivot maintains tidal lock.
    moon.rotation.y = Math.sin(simulationTime * 0.35) * 0.04;
    updateSun(sun, simulationTime, motionScale);
    updateAsteroidBelt(asteroidBelt, motionScale, jupiter);
    // One journey value coordinates exposure, stellar layers, galaxies, local
    // dust, and zodiacal light for scroll, reverse travel, and body focus alike.
    spaceEnvironment.setJourneyProgress(smoothProgress);
    spaceEnvironment.update(deltaTime, elapsedTime);
    orbitRoot.children.forEach((orbit) => {
      orbit.material.opacity = THREE.MathUtils.clamp((smoothProgress - 0.035) / 0.18, 0.04, 0.22);
    });

    // ----- Sync HTML, draw the frame, then schedule the next frame -----
    // Matrix updates make the latest camera transform available to 3D→2D projection.
    camera.updateMatrixWorld();
    updateInspectionInterface();
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

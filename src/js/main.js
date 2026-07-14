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
import { createMajorSatelliteSystems, updateMajorSatelliteSystems } from './planets/satellites/satelliteSystem.js';
import { PLANET_CONFIGS } from './planets/index.js';
import {
  createAsteroidBelt,
  findNearestAsteroidInstanceAtPointer,
  resolveAsteroidInstanceHit,
  setAsteroidInspectionDetail,
  updateAsteroidBelt,
} from './scene/asteroidBelt.js';
import { createPlanet, updatePlanetVisuals } from './scene/planetFactory.js';
import {
  createEarthDistanceTracker,
  formatEarthDistance,
  formatEarthDistanceRange,
  interpolateCameraDistanceFromEarth,
} from './scene/distanceFromEarth.js';
import { SpaceEnvironment } from './scene/space/spaceEnvironment.js';
import { JOURNEY_MAP } from './scene/space/spaceEnvironmentConfig.js';
import { createSun, updateSun } from './stars/sun/sun.js';

// An async immediately-invoked function lets us await texture loading while
// keeping all application variables private to this module.
(async () => {

  // Cache frequently used HTML elements once instead of querying every frame.
  const canvas = document.querySelector("#universe");
  const loader = document.querySelector("#loader");
  const progressBar = document.querySelector("#progress-bar");
  const progressShell = progressBar?.closest(".progress") ?? progressBar?.parentElement ?? null;
  let distanceValueLabel = null;
  let distanceSecondaryLabel = null;
  let distanceRegionLabel = null;
  let distanceModeLabel = null;
  let distanceRangeLabel = null;
  let distanceUnitPopover = null;
  let distanceUnitEyebrow = null;
  let distanceUnitTitle = null;
  let distanceUnitDescription = null;
  let distanceUnitEquivalent = null;
  let distanceMeasurementInfoButton = null;
  let activeDistanceInfo = null;
  let currentDistanceMeasurementInfo = null;
  let currentDistanceUnits = new Set();
  let distancePopoverOwnsJourneyLock = false;
  let distancePopoverTouchY = null;

  // The former horizontal progress line is converted into a compact travel
  // instrument. The existing HTML can stay unchanged because the readout is
  // built inside its current `.progress` container at runtime.
  if (progressShell) {
    progressShell.classList.add("distance-readout");
    progressShell.setAttribute("role", "region");
    progressShell.setAttribute("aria-label", "Distance from Earth");
    progressShell.innerHTML = `
      <button class="distance-readout__info" id="distance-measurement-info" type="button" aria-label="How this distance is measured" title="How is this distance measured?">
        <span aria-hidden="true">i</span>
      </button>
      <div class="distance-readout__header">
        <span>You are at</span>
        <em id="distance-travel-mode">Camera position</em>
      </div>
      <strong class="distance-readout__value" id="distance-travel-value">18,100 km from Earth</strong>
      <div class="distance-readout__footer">
        <span id="distance-travel-region">Earth orbital vicinity</span>
        <span id="distance-travel-secondary">11,247 mi</span>
      </div>
      <div class="distance-readout__range" id="distance-travel-range" hidden></div>
      <div class="distance-unit-popover" id="distance-unit-popover" role="dialog" aria-modal="false" aria-live="polite" aria-labelledby="distance-unit-title" hidden>
        <button class="distance-unit-popover__close" type="button" aria-label="Close distance information">×</button>
        <span class="distance-unit-popover__eyebrow" id="distance-unit-eyebrow">Distance information</span>
        <strong id="distance-unit-title"></strong>
        <p id="distance-unit-description"></p>
        <small id="distance-unit-equivalent"></small>
      </div>
    `;
    distanceValueLabel = progressShell.querySelector("#distance-travel-value");
    distanceSecondaryLabel = progressShell.querySelector("#distance-travel-secondary");
    distanceRegionLabel = progressShell.querySelector("#distance-travel-region");
    distanceModeLabel = progressShell.querySelector("#distance-travel-mode");
    distanceRangeLabel = progressShell.querySelector("#distance-travel-range");
    distanceUnitPopover = progressShell.querySelector("#distance-unit-popover");
    distanceUnitEyebrow = progressShell.querySelector("#distance-unit-eyebrow");
    distanceUnitTitle = progressShell.querySelector("#distance-unit-title");
    distanceUnitDescription = progressShell.querySelector("#distance-unit-description");
    distanceUnitEquivalent = progressShell.querySelector("#distance-unit-equivalent");
    distanceMeasurementInfoButton = progressShell.querySelector("#distance-measurement-info");
  }

  const DISTANCE_UNIT_EXPLANATIONS = Object.freeze({
    au: {
      eyebrow: "Space distance unit",
      title: "Astronomical unit (AU)",
      description: "AU is a distance unit used mainly inside the Solar System. It gives large planetary distances a shorter, easier-to-read number.",
      equivalent: "1 AU = exactly 149,597,870.7 km — approximately the average distance from Earth to the Sun.",
    },
    lightYear: {
      eyebrow: "Space distance unit",
      title: "Light-year (ly)",
      description: "A light-year is a unit of distance, not time. It is the distance light travels through a vacuum during one Julian year.",
      equivalent: "1 light-year ≈ 9.46 trillion km, or about 63,241 AU.",
    },
  });

  function distanceUnitKey(unitText) {
    if (unitText === "AU") return "au";
    if (unitText === "light-year" || unitText === "light-years") return "lightYear";
    return null;
  }

  function collectDistanceUnitKeys(...textValues) {
    const keys = new Set();
    const pattern = /(light-years?|AU)/g;
    textValues.forEach((textValue) => {
      const text = String(textValue ?? "");
      let match = pattern.exec(text);
      while (match) {
        const key = distanceUnitKey(match[0]);
        if (key) keys.add(key);
        match = pattern.exec(text);
      }
      pattern.lastIndex = 0;
    });
    return keys;
  }

  /**
   * Replaces AU/light-year words with stable, accessible hyperlink-style buttons.
   * `skipFirstUnit` keeps the definition's left-hand unit plain while allowing
   * later comparison units on the right-hand side to remain interactive.
   */
  function setDistanceText(element, textValue, { skipFirstUnit = false } = {}) {
    if (!element) return;
    const text = String(textValue ?? "");
    const renderKey = `${skipFirstUnit ? "skip-first" : "all"}|${text}`;
    if (element.dataset.distanceRenderKey === renderKey) return;

    const pattern = /(light-years?|AU)/g;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let unitMatchIndex = 0;
    let match = pattern.exec(text);

    while (match) {
      if (match.index > cursor) fragment.append(document.createTextNode(text.slice(cursor, match.index)));
      const unitKey = distanceUnitKey(match[0]);
      const shouldRenderPlainText = skipFirstUnit && unitMatchIndex === 0;

      if (unitKey && !shouldRenderPlainText) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "distance-unit-link";
        button.dataset.distanceUnit = unitKey;
        button.setAttribute("aria-label", `Open an explanation of ${match[0]}`);
        button.title = `Learn what ${match[0]} means`;
        button.append(document.createTextNode(match[0]));
        const icon = document.createElement("span");
        icon.className = "distance-unit-link__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "i";
        button.append(icon);
        fragment.append(button);
      } else {
        fragment.append(document.createTextNode(match[0]));
      }

      unitMatchIndex += 1;
      cursor = pattern.lastIndex;
      match = pattern.exec(text);
    }

    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    element.replaceChildren(fragment);
    element.dataset.distanceRenderKey = renderKey;
  }

  function renderDistancePopover(info) {
    if (!info || !distanceUnitPopover) return;
    const fingerprint = [
      info.eyebrow ?? "Distance information",
      info.title ?? "Distance information",
      info.description ?? "",
      info.equivalent ?? "",
    ].join("|");
    const isNewContent = distanceUnitPopover.dataset.infoFingerprint !== fingerprint;

    if (isNewContent) {
      distanceUnitPopover.dataset.infoFingerprint = fingerprint;
      distanceUnitEyebrow.textContent = info.eyebrow ?? "Distance information";
      distanceUnitTitle.textContent = info.title ?? "Distance information";
      distanceUnitDescription.textContent = info.description ?? "";
      setDistanceText(distanceUnitEquivalent, info.equivalent ?? "", { skipFirstUnit: true });
      distanceUnitPopover.scrollTop = 0;
    }

    distanceUnitPopover.hidden = false;
    requestAnimationFrame(() => distanceUnitPopover.classList.add("is-visible"));
  }

  function ensureDistancePopoverJourneyLock() {
    if (!isJourneyScrollLocked) {
      lockJourneyScroll();
      distancePopoverOwnsJourneyLock = true;
    }
  }

  function closeDistanceInfoPopover({ releaseJourneyLock = true } = {}) {
    if (!distanceUnitPopover) return;
    distanceUnitPopover.hidden = true;
    distanceUnitPopover.classList.remove("is-visible");
    activeDistanceInfo = null;
    distancePopoverTouchY = null;

    if (releaseJourneyLock && distancePopoverOwnsJourneyLock && !focusedBody) {
      distancePopoverOwnsJourneyLock = false;
      unlockJourneyScroll();
    } else if (!releaseJourneyLock) {
      distancePopoverOwnsJourneyLock = false;
    }
  }

  function showDistanceUnitPopover(unitKey) {
    const info = DISTANCE_UNIT_EXPLANATIONS[unitKey];
    if (!info || !distanceUnitPopover) return;
    ensureDistancePopoverJourneyLock();
    activeDistanceInfo = { type: "unit", key: unitKey };
    renderDistancePopover(info);
  }

  function showDistanceMeasurementPopover() {
    if (!currentDistanceMeasurementInfo || !distanceUnitPopover) return;
    ensureDistancePopoverJourneyLock();
    activeDistanceInfo = { type: "measurement" };
    renderDistancePopover(currentDistanceMeasurementInfo);
  }

  function refreshOpenDistancePopover() {
    if (!activeDistanceInfo || !distanceUnitPopover || distanceUnitPopover.hidden) return;
    if (activeDistanceInfo.type === "measurement") {
      renderDistancePopover(currentDistanceMeasurementInfo);
      return;
    }
    if (activeDistanceInfo.type === "unit" && !currentDistanceUnits.has(activeDistanceInfo.key)) {
      closeDistanceInfoPopover();
    }
  }

  function updateDistanceMeasurementContext({ units, measurementInfo, fingerprint }) {
    currentDistanceUnits = units;
    currentDistanceMeasurementInfo = measurementInfo;

    if (distanceMeasurementInfoButton) {
      distanceMeasurementInfoButton.setAttribute("aria-label", `${measurementInfo.title}. Open measurement details.`);
      distanceMeasurementInfoButton.title = "How is this distance measured?";
      if (distanceMeasurementInfoButton.dataset.measurementFingerprint !== fingerprint) {
        distanceMeasurementInfoButton.dataset.measurementFingerprint = fingerprint;
        distanceMeasurementInfoButton.classList.remove("is-updated");
        void distanceMeasurementInfoButton.offsetWidth;
        distanceMeasurementInfoButton.classList.add("is-updated");
      }
    }

    refreshOpenDistancePopover();
  }

  function activateDistanceReadoutControl(event) {
    const unitButton = event.target.closest?.("[data-distance-unit]");
    const measurementButton = event.target.closest?.("#distance-measurement-info");
    const closeButton = event.target.closest?.(".distance-unit-popover__close");
    if (!unitButton && !measurementButton && !closeButton) return false;

    event.preventDefault();
    event.stopPropagation();
    if (unitButton) showDistanceUnitPopover(unitButton.dataset.distanceUnit);
    else if (measurementButton) showDistanceMeasurementPopover();
    else closeDistanceInfoPopover();
    return true;
  }

  // Pointer-down activation remains reliable even while the numeric camera
  // value is easing and its text is being refreshed. Keyboard activation still
  // arrives through a normal click event with detail === 0.
  progressShell?.addEventListener("pointerdown", activateDistanceReadoutControl);
  progressShell?.addEventListener("click", (event) => {
    if (event.detail === 0) activateDistanceReadoutControl(event);
  });

  // Keep modal scrolling inside the information box. It must never move the
  // scroll-driven camera journey underneath it.
  distanceUnitPopover?.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    distanceUnitPopover.scrollTop += event.deltaY;
  }, { passive: false });

  distanceUnitPopover?.addEventListener("touchstart", (event) => {
    distancePopoverTouchY = event.touches[0]?.clientY ?? null;
    event.stopPropagation();
  }, { passive: true });

  distanceUnitPopover?.addEventListener("touchmove", (event) => {
    if (distancePopoverTouchY == null) return;
    const nextY = event.touches[0]?.clientY ?? distancePopoverTouchY;
    const deltaY = distancePopoverTouchY - nextY;
    distancePopoverTouchY = nextY;
    event.preventDefault();
    event.stopPropagation();
    distanceUnitPopover.scrollTop += deltaY;
  }, { passive: false });

  distanceUnitPopover?.addEventListener("touchend", () => {
    distancePopoverTouchY = null;
  }, { passive: true });


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

  // The original HTML has three fact rows. Add one reusable Earth-relative size
  // row in JavaScript so existing markup does not need to be replaced.
  const cardFacts = bodyCard?.querySelector(".body-card__facts");
  let cardScaleComparison = document.querySelector("#card-scale-comparison");
  if (cardFacts && !cardScaleComparison) {
    const scaleRow = document.createElement("div");
    scaleRow.className = "body-card__scale-row";
    const label = document.createElement("dt");
    label.textContent = "Size vs Earth";
    cardScaleComparison = document.createElement("dd");
    cardScaleComparison.id = "card-scale-comparison";
    scaleRow.append(label, cardScaleComparison);
    cardFacts.append(scaleRow);
  }

  // Scene is the root container of the 3D scene graph. Anything not attached to
  // the scene (directly or through a Group) cannot be rendered.
  const scene = new THREE.Scene();
  // Vacuum remains black. Distant celestial structure is added by explicit sky
  // layers rather than by scene-wide coloured fog.
  scene.background = new THREE.Color(0x000106);
  scene.fog = new THREE.FogExp2(0x000106, 0.00115);

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
  // Focus mode freezes the page journey and restores this snapshot when the
  // user closes the celestial inspection card.
  let isJourneyScrollLocked = false;
  let journeyScrollSnapshot = null;
  let focusZoomTarget = 1;
  let focusZoomCurrent = 1;
  let focusPinchDistance = null;
  // Raycasting is performed only for an intentional click/tap. The previous
  // continuous hover preview was removed so moving the pointer across the scene
  // no longer opens cards or repeatedly tests the asteroid belt.
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
  const earthRadius = earth.userData.visualRadius ?? 1.25;

  // Earth is layered like an onion: solid globe, cloud shell, atmospheric glow,
  // and optional light shell. Small radius differences avoid z-fighting.
  const earthClouds = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.028, 96, 96),
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
    new THREE.SphereGeometry(earthRadius * 1.044, 96, 96),
    new THREE.MeshBasicMaterial({ color: 0x5bdcff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
  );
  earth.add(earthAtmosphere);

  if (textures.earthLights) {
    // Additive blending makes bright city pixels glow over the globe underneath.
    const earthLights = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius * 1.012, 96, 96),
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

  // Mars and the giant planets share one reusable major-satellite builder. The
  // moon meshes keep scientific diameter ordering while using a readable,
  // compressed scale for this cinematic experience.
  const majorSatelliteSystems = createMajorSatelliteSystems({
    world,
    planets,
    hoverTargets,
  });

  // Space is a distant celestial sphere rather than a nearby cloud of coloured
  // particles. The environment owns steady stars, the tilted Milky Way, cloudy
  // galactic light, and its dark interstellar dust lanes.
  const spaceEnvironment = new SpaceEnvironment({ scene, camera, renderer });
  await spaceEnvironment.init();

  // Asteroid meshes provide nearby shape; dust points cheaply supply density.
  const asteroidBelt = createAsteroidBelt({ world, hoverTargets });
  const jupiter = planets.find((planet) => planet.name === "Jupiter");

  const earthDistanceTracker = createEarthDistanceTracker({ earth });
  let previousDistanceProgress = smoothProgress;

  function createFocusedMeasurementInfo(focusedDistance, formatted, rangeText) {
    const currentValue = `${formatted.primary} from Earth`;
    const rangeSummary = rangeText
      ? ` Estimated nearest-to-farthest Earth distance across the possible orbital arrangements: ${rangeText}.`
      : "";

    if (focusedDistance.basis === "reference") {
      return {
        eyebrow: "How this distance is measured",
        title: "Earth is the reference point",
        description: "All distances in this instrument are measured from Earth. Because Earth is the origin of the measurement, focusing Earth always reads 0 km.",
        equivalent: `Current display: ${currentValue}.`,
      };
    }

    if (focusedDistance.basis === "average") {
      return {
        eyebrow: "How this distance is measured",
        title: `Average reference distance for ${focusedDistance.bodyName}`,
        description: `This value uses the accepted average separation from Earth rather than a live, date-specific position.${rangeSummary}`,
        equivalent: `Current display: ${currentValue}.`,
      };
    }

    if (focusedDistance.basis === "jpl-elements") {
      return {
        eyebrow: "How this distance is measured",
        title: "Simulated planetary separation",
        description: "The current number uses the planet’s published orbital scale together with the orbital direction currently shown in this Three.js simulation. It is realistic for the scene, but it is not today’s live ephemeris position.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    if (focusedDistance.basis === "jpl-small-body") {
      return {
        eyebrow: "How this distance is measured",
        title: "Verified small-body orbital scale",
        description: "The asteroid’s published orbital elements set its physical scale. Its current Earth separation follows the angular position shown in the simulation, not a live date-specific ephemeris.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    if (focusedDistance.basis === "satellite-parent-orbit") {
      return {
        eyebrow: "How this distance is measured",
        title: `${focusedDistance.bodyName} follows its planet’s Earth distance`,
        description: "The moon’s local orbit around its parent is tiny compared with the planet’s distance from Earth. The readout therefore uses the parent planet’s verified heliocentric orbital scale together with the direction shown in the simulation.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    if (focusedDistance.basis === "explicit" || focusedDistance.basis === "asteroid-estimate") {
      return {
        eyebrow: "How this distance is measured",
        title: "Generated asteroid-orbit distance",
        description: "This asteroid uses the orbit generated for it inside the experience. Its Earth separation is calculated from that simulated orbit, so the value is internally consistent but not a live astronomical observation.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    return {
      eyebrow: "How this distance is measured",
      title: "Scene-scaled Earth distance",
      description: "This object does not yet have complete orbital metadata, so its distance is estimated from its Three.js scene position relative to Earth.",
      equivalent: `Current display: ${currentValue}.`,
    };
  }

  function createCameraMeasurementInfo(travel, formatted) {
    return {
      eyebrow: "How this distance is measured",
      title: "Scroll-driven camera distance from Earth",
      description: "Earth is treated as the 0 km reference. As you scroll outward or inward, the camera journey is mapped onto a progressively larger scientific distance scale for the experience. This describes the viewer’s perspective, not a live spacecraft location.",
      equivalent: `Current display: ${formatted.primary} from Earth · Region: ${travel.region}.`,
    };
  }

  /** Keeps the travel instrument synchronized with either the camera or focus. */
  function updateDistanceReadout(progress) {
    if (!distanceValueLabel || !distanceSecondaryLabel || !distanceRegionLabel) return;

    if (focusedBody) {
      const focusedDistance = earthDistanceTracker.getBodyDistanceFromEarth(focusedBody);
      const formatted = formatEarthDistance(focusedDistance.kilometres);
      const range = formatEarthDistanceRange(focusedDistance.approximateRange);
      const rangeSentence = range
        ? `Estimated nearest–farthest distance from Earth as both bodies orbit: ${range}`
        : "";

      setDistanceText(distanceValueLabel, `${formatted.primary} from Earth`);
      setDistanceText(distanceSecondaryLabel, formatted.secondary);
      distanceRegionLabel.textContent = focusedDistance.region;
      if (distanceRangeLabel) {
        distanceRangeLabel.hidden = !range;
        if (range) setDistanceText(distanceRangeLabel, rangeSentence);
      }
      if (distanceModeLabel) distanceModeLabel.textContent = `Focused: ${focusedDistance.bodyName}`;

      updateDistanceMeasurementContext({
        units: collectDistanceUnitKeys(formatted.primary, formatted.secondary, rangeSentence),
        measurementInfo: createFocusedMeasurementInfo(focusedDistance, formatted, range),
        fingerprint: `focus:${focusedDistance.bodyName}:${focusedDistance.basis}:${formatted.primaryUnit}`,
      });
      return;
    }

    const travel = interpolateCameraDistanceFromEarth(progress);
    const formatted = formatEarthDistance(travel.kilometres);
    const progressDelta = progress - previousDistanceProgress;
    setDistanceText(distanceValueLabel, `${formatted.primary} from Earth`);
    setDistanceText(distanceSecondaryLabel, formatted.secondary);
    distanceRegionLabel.textContent = travel.region;
    if (distanceRangeLabel) distanceRangeLabel.hidden = true;

    if (distanceModeLabel) {
      if (progressDelta > 0.00008) distanceModeLabel.textContent = "Moving outward";
      else if (progressDelta < -0.00008) distanceModeLabel.textContent = "Returning inward";
      else distanceModeLabel.textContent = "Camera position";
    }

    updateDistanceMeasurementContext({
      units: collectDistanceUnitKeys(formatted.primary, formatted.secondary),
      measurementInfo: createCameraMeasurementInfo(travel, formatted),
      fingerprint: `camera:${travel.region}:${formatted.primaryUnit}`,
    });
    previousDistanceProgress = progress;
  }


  /*
    updateScrollProgress
    - Updates normalized journey progress. The distance readout follows the
      smoothed camera progress inside the animation loop.
  */
  function updateScrollProgress() {
    if (isJourneyScrollLocked) return;
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
  }

  function getCameraDistance(progress) {
    // smoothstep-like easing: slow at both ends, faster through the middle.
    const eased = progress * progress * (3 - 2 * progress);
    // lerp(a, b, t) returns a at t=0, b at t=1, and blends between them.
    return THREE.MathUtils.lerp(4.8, 980, eased);
  }

  /** Uses the focused body's physical region when inspection overrides scroll. */
  function getEnvironmentJourneyProgress() {
    if (!focusedBody) return smoothProgress;

    const bodyName = String(focusedBody.userData?.name ?? focusedBody.name ?? "").toLowerCase();
    const bodyType = String(focusedBody.userData?.info?.type ?? "").toLowerCase();
    const parentPlanet = String(focusedBody.userData?.parentPlanet ?? "").toLowerCase();

    if (parentPlanet && JOURNEY_MAP[parentPlanet] != null) return JOURNEY_MAP[parentPlanet];
    if (bodyName.includes("sun")) return JOURNEY_MAP.sun;
    if (bodyName.includes("mercury")) return JOURNEY_MAP.mercury;
    if (bodyName.includes("venus")) return JOURNEY_MAP.venus;
    if (bodyName.includes("earth")) return JOURNEY_MAP.earth;
    if (bodyName.includes("moon")) return JOURNEY_MAP.moon;
    if (bodyName.includes("mars")) return JOURNEY_MAP.mars;
    if (bodyName.includes("jupiter")) return JOURNEY_MAP.jupiter;
    if (bodyName.includes("saturn")) return JOURNEY_MAP.saturn;
    if (bodyName.includes("uranus")) return JOURNEY_MAP.uranus;
    if (bodyName.includes("neptune")) return JOURNEY_MAP.neptune;
    if (bodyType.includes("asteroid") || bodyName.includes("asteroid") || bodyName.includes("family")) {
      return JOURNEY_MAP.asteroidBelt;
    }

    return smoothProgress;
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
      cardDescription.textContent = info.description ?? body.userData.detail ?? "No description available.";
      displayedBody = body;
    }

    const earthDistance = earthDistanceTracker.getBodyDistanceFromEarth(body);
    const formattedEarthDistance = formatEarthDistance(earthDistance.kilometres);
    cardDistance.textContent = `${formattedEarthDistance.primary} from Earth`;
    if (cardScaleComparison) {
      cardScaleComparison.textContent = body.userData?.info?.sizeComparison
        ?? body.userData?.sizeComparison
        ?? "Scale comparison unavailable";
    }
    cardMode.textContent = "Slow motion · Focused";
    cardHint.textContent = "Journey paused · Drag to orbit · Scroll or pinch to zoom · Close to return";
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

  /** Keeps the inspection panel synchronized with the currently clicked body. */
  function updateInspectionInterface() {
    document.body.classList.remove("is-hovering-body");
    updateBodyCard(focusedBody);
    updateBodyConnector(focusedBody);
  }

  // Closing the card restores normal simulation speed and free flight.
  cardClose.addEventListener("click", () => {
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
    - Performs a raycast only when the user intentionally clicks or taps.
    - Supports nested mesh structures by resolving to the interactive parent.
  */
  function getBodyAtPointer() {
    // `true` recursively checks descendants. A satellite can visually overlap its
    // much larger parent, so satellite hits receive priority over the first planet hit.
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hoverTargets, true);
    const bodies = hits.map((hit) => findInteractiveObject(hit)).filter(Boolean);
    const directBody = bodies.find((body) => body.userData?.info?.type === "Natural satellite")
      ?? bodies[0]
      ?? null;
    if (directBody) return directBody;

    // Tiny instanced rocks may occupy less than a physical pointer pixel. A
    // click-only screen-space fallback keeps them selectable without running
    // expensive belt scans continuously during pointer movement.
    return findNearestAsteroidInstanceAtPointer({
      meshes: asteroidBelt.instancedBoulders,
      pointer,
      camera,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      pixelRadius: innerWidth <= 760 ? 34 : 24,
    });
  }

  /** Freezes the scroll journey without moving the user's current viewpoint. */
  function lockJourneyScroll() {
    if (isJourneyScrollLocked) return;

    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    journeyScrollSnapshot = {
      scrollY: window.scrollY,
      scrollProgress,
      smoothProgress,
      yaw,
      pitch,
      targetYaw,
      targetPitch,
      cameraFov: camera.fov,
      cameraFocusPoint: cameraFocusPoint.clone(),
      htmlOverflow: document.documentElement.style.overflow,
      htmlScrollBehavior: document.documentElement.style.scrollBehavior,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyLeft: document.body.style.left,
      bodyRight: document.body.style.right,
      bodyWidth: document.body.style.width,
      bodyOverflow: document.body.style.overflow,
      bodyPaddingRight: document.body.style.paddingRight,
    };

    isJourneyScrollLocked = true;
    // Stop any remaining easing immediately. The original values are retained in
    // the snapshot and restored when the information/focus state is closed.
    scrollProgress = smoothProgress;
    previousDistanceProgress = smoothProgress;
    document.documentElement.classList.add("is-celestial-focus");
    document.body.classList.add("is-celestial-focus");
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.position = "fixed";
    document.body.style.top = `-${journeyScrollSnapshot.scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  /** Restores the exact scroll/camera journey position from before inspection. */
  function unlockJourneyScroll() {
    if (!isJourneyScrollLocked || !journeyScrollSnapshot) return;
    const snapshot = journeyScrollSnapshot;

    document.documentElement.classList.remove("is-celestial-focus");
    document.body.classList.remove("is-celestial-focus");
    document.documentElement.style.overflow = snapshot.htmlOverflow;
    document.documentElement.style.scrollBehavior = snapshot.htmlScrollBehavior;
    document.body.style.position = snapshot.bodyPosition;
    document.body.style.top = snapshot.bodyTop;
    document.body.style.left = snapshot.bodyLeft;
    document.body.style.right = snapshot.bodyRight;
    document.body.style.width = snapshot.bodyWidth;
    document.body.style.overflow = snapshot.bodyOverflow;
    document.body.style.paddingRight = snapshot.bodyPaddingRight;

    scrollProgress = snapshot.scrollProgress;
    smoothProgress = snapshot.smoothProgress;
    yaw = snapshot.yaw;
    pitch = snapshot.pitch;
    targetYaw = snapshot.targetYaw;
    targetPitch = snapshot.targetPitch;
    camera.fov = snapshot.cameraFov;
    camera.updateProjectionMatrix();
    cameraFocusPoint.copy(snapshot.cameraFocusPoint);
    hasCameraFocusPoint = true;
    previousDistanceProgress = snapshot.smoothProgress;
    isJourneyScrollLocked = false;
    journeyScrollSnapshot = null;
    window.scrollTo({ top: snapshot.scrollY, left: 0, behavior: "auto" });
    updateDistanceReadout(smoothProgress);
  }

  /*
    focusBody
    - Focuses the clicked object without changing the page's journey position.
    - The vertical scroll journey is locked until focus is closed.
    - Clicking the same body twice or clicking empty space restores the exact
      scroll/camera distance that the user was viewing before inspection.
  */
  function focusBody(body) {
    const nextBody = body && focusedBody !== body ? body : null;

    // Measurement/unit explanations belong to the previous readout state and
    // should not remain open while focus is changed or dismissed.
    if (distanceUnitPopover && !distanceUnitPopover.hidden) {
      closeDistanceInfoPopover({ releaseJourneyLock: false });
    }

    // Restore a previous instanced rock before changing focus. Its inexpensive
    // belt representation replaces the temporary high-resolution close-up.
    if (focusedBody) setAsteroidInspectionDetail(focusedBody, false);

    if (!nextBody) {
      focusedBody = null;
      focusZoomTarget = 1;
      focusZoomCurrent = 1;
      focusPinchDistance = null;
      unlockJourneyScroll();
      return;
    }

    if (!isJourneyScrollLocked) lockJourneyScroll();
    focusedBody = nextBody;
    focusZoomTarget = 1;
    focusZoomCurrent = 1;
    focusPinchDistance = null;

    // Only instanced asteroids react here; planets, satellites, and individually
    // modeled major asteroids continue using their normal meshes.
    setAsteroidInspectionDetail(focusedBody, true);
    updateDistanceReadout(smoothProgress);
  }

  /*
    setup input handlers
    - Wires scroll, pointer, drag, and keyboard events to the camera control state.
    - Keeps the scene interactive while preserving pointer selection and drag motion.
  */
  // `passive` promises that the handler will not cancel scrolling, helping browsers
  // keep scrolling responsive while JavaScript updates its normalized value.
  addEventListener("scroll", updateScrollProgress, { passive: true });
  function adjustFocusedZoom(delta) {
    if (!focusedBody || (distanceUnitPopover && !distanceUnitPopover.hidden)) return;
    focusZoomTarget = THREE.MathUtils.clamp(
      focusZoomTarget * Math.exp(delta * 0.00125),
      0.58,
      2.45,
    );
  }

  const preventFocusedJourneyScroll = (event) => {
    // Cards and the distance explanation retain their own internal scrolling.
    if (event.target.closest?.(".body-card, .progress")) return;
    if (!isJourneyScrollLocked) return;

    event.preventDefault();
    if (focusedBody && event.type === "wheel") adjustFocusedZoom(event.deltaY);
  };
  addEventListener("wheel", preventFocusedJourneyScroll, { passive: false });

  addEventListener("touchstart", (event) => {
    if (!focusedBody || event.target.closest?.(".body-card, .progress")) return;
    if (event.touches.length === 2) {
      focusPinchDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
    }
  }, { passive: true });

  addEventListener("touchmove", (event) => {
    if (!isJourneyScrollLocked || event.target.closest?.(".body-card, .progress")) return;
    event.preventDefault();
    if (!focusedBody || event.touches.length !== 2 || focusPinchDistance == null) return;

    const nextDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    );
    if (nextDistance > 0) {
      focusZoomTarget = THREE.MathUtils.clamp(
        focusZoomTarget * (focusPinchDistance / nextDistance),
        0.58,
        2.45,
      );
      focusPinchDistance = nextDistance;
    }
  }, { passive: false });

  addEventListener("touchend", (event) => {
    if (event.touches.length < 2) focusPinchDistance = null;
  }, { passive: true });
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
    if (event.target.closest?.(".progress")) return;
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
    if (event.target.closest?.(".hud, .body-card, .progress")) return;
    if (dragDistance > 12) return;
    // Details are opened only after this intentional click/tap raycast.
    const body = getBodyAtPointer();
    if (body) focusBody(body);
    else focusBody(null);
  });

  addEventListener("pointercancel", () => {
    // Browsers can cancel input when a gesture leaves the window or becomes a system gesture.
    isDragging = false;
  });

  addEventListener("keydown", (event) => {
    const journeyKeys = [
      " ", "PageUp", "PageDown", "Home", "End",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    ];
    const isDistancePopoverOpen = Boolean(distanceUnitPopover && !distanceUnitPopover.hidden);

    if (isDistancePopoverOpen && journeyKeys.includes(event.key)) {
      event.preventDefault();
      return;
    }

    // Keyboard controls modify the same targets as dragging, so smoothing still applies.
    if (isJourneyScrollLocked && journeyKeys.includes(event.key)) {
      event.preventDefault();
    }

    if (event.key === "Escape") {
      if (isDistancePopoverOpen) {
        closeDistanceInfoPopover();
        return;
      }
      focusBody(null);
      updateBodyCard(null);
    }
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
    updateDistanceReadout(smoothProgress);
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
    updateMajorSatelliteSystems(majorSatelliteSystems, motionScale);

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
    focusZoomCurrent = THREE.MathUtils.lerp(
      focusZoomCurrent,
      focusedBody ? focusZoomTarget : 1,
      focusedBody ? 0.12 : 0.18,
    );

    let cameraDistance = distance;
    if (focusedBody) {
      const baseFocusDistance = explicitFocusDistance
        ?? Math.max(minimumFocusDistance, Math.min(distance, 30 / focusScale));
      const focusVisualRadius = focusedBody.userData?.focusVisualRadius
        ?? focusedBody.userData?.visualRadius
        ?? 1;
      const safeMinimum = Math.max(
        baseFocusDistance * 0.58,
        focusVisualRadius * (focusedBody.userData?.info?.type === "Star" ? 1.72 : 1.38),
      );
      const surroundingsMaximum = Math.max(
        baseFocusDistance * 2.45,
        focusVisualRadius * 7.5,
      );
      cameraDistance = THREE.MathUtils.clamp(
        baseFocusDistance * focusZoomCurrent,
        safeMinimum,
        surroundingsMaximum,
      );
    }
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
      : THREE.MathUtils.lerp(42, 72, smoothProgress);
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
    spaceEnvironment.setJourneyProgress(getEnvironmentJourneyProgress());
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

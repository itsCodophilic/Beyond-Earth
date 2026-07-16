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
import { HELIOCENTRIC_ORBIT_AU, PLANET_SCALE_PROFILES } from './config/celestialScale.js';
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
  ASTRONOMICAL_UNIT_KM,
  createEarthDistanceTracker,
  formatEarthDistance,
  formatEarthDistanceRange,
  interpolateCameraDistanceFromEarth,
} from './scene/distanceFromEarth.js';
import { SpaceEnvironment } from './scene/space/spaceEnvironment.js';
import { JOURNEY_MAP } from './scene/space/spaceEnvironmentConfig.js';
import { createSun, updateSun } from './stars/sun/sun.js';
import { createDistanceCinematicPanel } from './ui/distanceCinematicPanel.js';

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
  let distanceMeasurementSummaryLabel = null;
  let distanceCinematicPanel = null;
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
      <button class="distance-readout__method" id="distance-measurement-info" type="button" aria-label="Open how this distance is measured">
        <span class="distance-readout__method-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8.25"></circle>
            <path d="M7.2 13.3c2.1-3.9 7.1-6.2 10.5-4.1M8.1 8.4l-.9 4.9 4.8.7"></path>
            <circle cx="17.4" cy="8.8" r="1.15"></circle>
          </svg>
        </span>
        <span class="distance-readout__method-copy">
          <span>How is this distance measured?</span>
          <small id="distance-measurement-summary">Scroll-mapped camera scale</small>
        </span>
        <span class="distance-readout__method-arrow" aria-hidden="true">›</span>
      </button>
    `;
    distanceValueLabel = progressShell.querySelector("#distance-travel-value");
    distanceSecondaryLabel = progressShell.querySelector("#distance-travel-secondary");
    distanceRegionLabel = progressShell.querySelector("#distance-travel-region");
    distanceModeLabel = progressShell.querySelector("#distance-travel-mode");
    distanceRangeLabel = progressShell.querySelector("#distance-travel-range");
    distanceMeasurementInfoButton = progressShell.querySelector("#distance-measurement-info");
    distanceMeasurementSummaryLabel = progressShell.querySelector("#distance-measurement-summary");

    // Explanations are mounted outside `.progress`. Keeping them in a separate
    // overlay prevents the readout from becoming a card containing another card
    // and gives the connector/card reveal sequence room to play cinematically.
    distanceCinematicPanel = createDistanceCinematicPanel({ readoutElement: progressShell });
    if (distanceCinematicPanel) {
      const cinematicElements = distanceCinematicPanel.elements;
      distanceUnitPopover = cinematicElements.panel;
      distanceUnitEyebrow = cinematicElements.eyebrow;
      distanceUnitTitle = cinematicElements.title;
      distanceUnitDescription = cinematicElements.description;
      distanceUnitEquivalent = cinematicElements.equivalent;
    }
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
    distanceCinematicPanel?.position();
  }

  function ensureDistancePopoverJourneyLock() {
    if (!isJourneyScrollLocked) {
      lockJourneyScroll();
      distancePopoverOwnsJourneyLock = true;
    }
  }

  function closeDistanceInfoPopover({
    releaseJourneyLock = true,
    resumeJourneyImmediately = false,
    onComplete,
  } = {}) {
    if (!distanceCinematicPanel) {
      onComplete?.();
      return;
    }

    // Clear the logical state immediately. The visual card may continue its
    // cinematic exit, but per-frame distance updates must not keep requesting
    // another close and restarting the connector retraction timer.
    activeDistanceInfo = null;
    distancePopoverTouchY = null;

    // Movement-intent dismissals release the frozen page synchronously. The
    // wheel, drag, key, or scene click that caused the dismissal can therefore
    // affect the camera immediately while the visual card keeps retracting.
    if (resumeJourneyImmediately
      && releaseJourneyLock
      && distancePopoverOwnsJourneyLock
      && !focusedBody) {
      distancePopoverOwnsJourneyLock = false;
      unlockJourneyScroll();
    }

    // The controller removes the card first and retracts its connector second.
    // Explicit close buttons retain the slower reading-mode release; movement
    // dismissals may already have restored input through the block above.
    distanceCinematicPanel.close({
      onComplete: () => {
        if (releaseJourneyLock && distancePopoverOwnsJourneyLock && !focusedBody) {
          distancePopoverOwnsJourneyLock = false;
          unlockJourneyScroll();
        } else if (!releaseJourneyLock || focusedBody) {
          distancePopoverOwnsJourneyLock = false;
        }
        onComplete?.();
      },
    });
  }

  /**
   * Opens one external explanation. Switching between unit and measurement
   * layouts completes the old card/line exit before drawing the new connector.
   */
  function presentDistanceInfo({ info, activeInfo, layout, anchor }) {
    if (!info || !distanceCinematicPanel || !anchor) return;
    ensureDistancePopoverJourneyLock();

    // A unit link inside the open card changes its content without connecting
    // the card back to itself; it keeps the original readout anchor instead.
    const resolvedAnchor = distanceUnitPopover?.contains(anchor)
      ? distanceCinematicPanel.getAnchor()
      : anchor;
    if (!resolvedAnchor) return;

    const reveal = () => {
      activeDistanceInfo = activeInfo;
      renderDistancePopover(info);
      distanceCinematicPanel.open({ layout, anchor: resolvedAnchor });
    };

    if (distanceCinematicPanel.isOpen() && distanceCinematicPanel.getLayout() !== layout) {
      distanceCinematicPanel.close({ onComplete: reveal });
      return;
    }
    reveal();
  }

  function showDistanceUnitPopover(unitKey, anchor) {
    const info = DISTANCE_UNIT_EXPLANATIONS[unitKey];
    presentDistanceInfo({
      info,
      activeInfo: { type: "unit", key: unitKey },
      layout: "unit",
      anchor,
    });
  }

  function showDistanceMeasurementPopover(anchor) {
    presentDistanceInfo({
      info: currentDistanceMeasurementInfo,
      activeInfo: { type: "measurement" },
      layout: "measurement",
      anchor,
    });
  }

  function refreshOpenDistancePopover() {
    if (!activeDistanceInfo || !distanceCinematicPanel?.isOpen()) return;
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
      const summary = measurementInfo.summary ?? measurementInfo.title;
      distanceMeasurementInfoButton.setAttribute("aria-label", `How this distance is measured: ${summary}. Open details.`);
      distanceMeasurementInfoButton.title = `Measurement method: ${summary}`;
      if (distanceMeasurementSummaryLabel) distanceMeasurementSummaryLabel.textContent = summary;
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
    if (unitButton) showDistanceUnitPopover(unitButton.dataset.distanceUnit, unitButton);
    else if (measurementButton) showDistanceMeasurementPopover(measurementButton);
    else closeDistanceInfoPopover();
    return true;
  }

  // Pointer-down activation remains reliable even while the numeric camera
  // value is easing and its text is being refreshed. Keyboard activation still
  // arrives through a normal click event with detail === 0.
  function bindDistanceReadoutControls(element) {
    element?.addEventListener("pointerdown", activateDistanceReadoutControl);
    element?.addEventListener("click", (event) => {
      if (event.detail === 0) activateDistanceReadoutControl(event);
      // Pointer activation was already handled on pointerdown. Swallow its
      // later click so an external card can never click through to WebGL.
      else event.stopPropagation();
    });
  }

  bindDistanceReadoutControls(progressShell);
  bindDistanceReadoutControls(distanceUnitPopover);

  // Any new interaction outside the distance instrument ends reading mode.
  // Camera input resumes immediately and runs in parallel with the cinematic
  // card/connector exit, so the triggering gesture is never discarded.
  function dismissDistanceInfoForJourneyIntent(event) {
    if (!activeDistanceInfo || !distanceCinematicPanel?.isOpen()) return;
    if (event.target.closest?.(".progress, .distance-cinematic-layer")) return;
    // These two controls run their own coordinated exit sequence.
    if (event.target.closest?.("#earth-return-button, #space-exit-control")) return;

    // A wheel event that starts against a position-fixed page may be discarded
    // even if the lock is removed during capture. Prevent that ambiguous native
    // default and apply its exact distance after restoring the scroll journey.
    // Focused-body wheels are excluded because their later handler controls the
    // optical zoom rather than document scroll.
    const resumesPageJourney = event.type === "wheel"
      && distancePopoverOwnsJourneyLock
      && !focusedBody;
    const journeyScrollY = journeyScrollSnapshot?.scrollY ?? window.scrollY;
    if (resumesPageJourney) event.preventDefault();

    closeDistanceInfoPopover({ resumeJourneyImmediately: true });

    if (resumesPageJourney) {
      const deltaScale = event.deltaMode === 1
        ? 32
        : event.deltaMode === 2
          ? innerHeight
          : 1;
      const targetScrollY = journeyScrollY + event.deltaY * deltaScale;
      // Restoring `position: fixed` changes document layout. Apply the original
      // position plus this wheel delta on the next paint, after that layout has
      // settled, instead of relying on a relative scroll from a transient 0px.
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, left: 0, behavior: "auto" });
        updateScrollProgress();
      });
    }
  }

  addEventListener("pointerdown", dismissDistanceInfoForJourneyIntent, { capture: true });
  addEventListener("wheel", dismissDistanceInfoForJourneyIntent, { capture: true, passive: false });
  addEventListener("click", (event) => {
    // Keyboard-activated buttons dispatch click without a preceding pointerdown.
    if (event.detail === 0) dismissDistanceInfoForJourneyIntent(event);
  }, { capture: true });

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

  // Focus remains active while this panel is hidden. A small restore control
  // stays at the right edge so the user can inspect the scene unobstructed and
  // bring the information back without leaving the celestial body.
  let cardCollapse = document.querySelector("#card-collapse");
  if (bodyCard && !cardCollapse) {
    cardCollapse = document.createElement("button");
    cardCollapse.id = "card-collapse";
    cardCollapse.className = "body-card__collapse";
    cardCollapse.type = "button";
    cardCollapse.setAttribute("aria-label", "Hide celestial information");
    cardCollapse.title = "Hide celestial information";
    cardCollapse.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7.5h16M4 12h10M4 16.5h7"/>
        <path d="m17 14 3 3-3 3"/>
      </svg>
    `;
    bodyCard.append(cardCollapse);
  }

  let cardRestore = document.querySelector("#body-card-restore");
  if (!cardRestore) {
    cardRestore = document.createElement("button");
    cardRestore.id = "body-card-restore";
    cardRestore.className = "body-card-restore";
    cardRestore.type = "button";
    cardRestore.setAttribute("aria-label", "Show celestial information");
    cardRestore.title = "Show celestial information";
    cardRestore.innerHTML = `<span aria-hidden="true">i</span>`;
    document.body.append(cardRestore);
  }
  let isBodyCardCollapsed = false;

  function setBodyCardCollapsed(collapsed) {
    isBodyCardCollapsed = Boolean(collapsed && focusedBody);
    bodyCard?.classList.toggle("is-collapsed", isBodyCardCollapsed);
    cardRestore?.classList.toggle("is-visible", isBodyCardCollapsed);
    cardRestore?.setAttribute("aria-hidden", String(!isBodyCardCollapsed));
    if (isBodyCardCollapsed) bodyConnector?.classList.remove("is-visible");
  }

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

  // Replace the original generic sentence with three explicit actions. The Esc
  // key is a real button as well as a keyboard shortcut, so either interaction
  // runs the same exit logic.
  let spaceExploreHint = document.querySelector(".ship-controls");
  const spaceGuidanceMarkup = `
    <span class="ship-controls__step ship-controls__step--space">
      <span class="ship-controls__index" aria-hidden="true">01</span>
      <span class="ship-controls__copy">
        <strong>Click empty space</strong>
        <small>Travel into that region</small>
      </span>
    </span>
    <span class="ship-controls__step ship-controls__step--body">
      <span class="ship-controls__index" aria-hidden="true">02</span>
      <span class="ship-controls__copy">
        <strong>Click a celestial body</strong>
        <small>Inspect its information</small>
      </span>
    </span>
    <button
      class="ship-controls__escape"
      id="space-exit-control"
      type="button"
      aria-label="Exit the current space view"
      aria-keyshortcuts="Escape"
      title="Exit the current view (Escape)"
    >
      <kbd>Esc</kbd>
      <span class="ship-controls__copy">
        <strong>Exit current view</strong>
        <small>Click here or press the key</small>
      </span>
    </button>
  `;
  if (spaceExploreHint) {
    spaceExploreHint.innerHTML = spaceGuidanceMarkup;
    spaceExploreHint.setAttribute("aria-label", "Universe navigation instructions");
  } else {
    spaceExploreHint = document.createElement("div");
    spaceExploreHint.className = "ship-controls";
    spaceExploreHint.setAttribute("aria-label", "Universe navigation instructions");
    spaceExploreHint.innerHTML = spaceGuidanceMarkup;
    document.querySelector(".hud")?.append(spaceExploreHint);
  }
  const spaceExitControl = spaceExploreHint?.querySelector("#space-exit-control");
  spaceExitControl?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    exitCurrentView();
    spaceExitControl.blur();
  });

  // Hover does not open the full information card. It reveals a compact,
  // magnetic locator for every celestial body and slows orbital motion long
  // enough for small planets, moons and asteroids to be selected reliably.
  let asteroidHoverTooltip = document.querySelector("#asteroid-hover-tooltip");
  if (!asteroidHoverTooltip) {
    asteroidHoverTooltip = document.createElement("div");
    asteroidHoverTooltip.id = "asteroid-hover-tooltip";
    asteroidHoverTooltip.className = "asteroid-hover-tooltip";
    asteroidHoverTooltip.setAttribute("aria-hidden", "true");
    asteroidHoverTooltip.innerHTML = `
      <strong id="asteroid-hover-name">Celestial body</strong>
      <span id="celestial-hover-action">Hover lock · Click to inspect</span>
    `;
    document.body.append(asteroidHoverTooltip);
  }
  const asteroidHoverName = asteroidHoverTooltip.querySelector("#asteroid-hover-name");
  const celestialHoverAction = asteroidHoverTooltip.querySelector("#celestial-hover-action");

  // A persistent rocket button resets focus, regional exploration, camera angle,
  // page distance and scroll position, then returns to the opening Earth view.
  let earthReturnButton = document.querySelector("#earth-return-button");
  if (!earthReturnButton) {
    earthReturnButton = document.createElement("button");
    earthReturnButton.id = "earth-return-button";
    earthReturnButton.className = "earth-return-button";
    earthReturnButton.type = "button";
    earthReturnButton.setAttribute("aria-label", "Travel back to Earth");
    earthReturnButton.title = "Travel back to Earth";
    earthReturnButton.innerHTML = `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path class="earth-return-button__body" d="M29.8 7.2c5.1 1.2 9.8 5.9 11 11-2.1 7.7-7.1 14.3-14.8 19.1l-7.6-7.6C23.2 22 29.8 17 37.5 14.9"/>
        <path class="earth-return-button__window" d="M31.8 15.8a4.6 4.6 0 1 1-6.5 6.5 4.6 4.6 0 0 1 6.5-6.5Z"/>
        <path class="earth-return-button__fin" d="m19.2 27.6-7.7 1.2-4.3 4.3 9.1 1.1m4.1-13.8 1.2-7.7 4.3-4.3 1.1 9.1"/>
        <path class="earth-return-button__flame" d="M14.5 34.1c-4.2 1.1-6.5 3.4-7.4 7.3 3.9-.8 6.2-3.1 7.4-7.3Z"/>
      </svg>
      <span>Travel back to Earth</span>
    `;
    document.body.append(earthReturnButton);
  }
  // The rocket remains outside the frame while the loader is visible. It is
  // enabled only after its single overshoot-and-settle entrance has started.
  earthReturnButton.classList.add("is-awaiting-entrance");
  earthReturnButton.disabled = true;

  // Scene is the root container of the 3D scene graph. Anything not attached to
  // the scene (directly or through a Group) cannot be rendered.
  const scene = new THREE.Scene();
  // Vacuum remains black. Distant celestial structure is added by explicit sky
  // layers rather than by scene-wide coloured fog.
  scene.background = new THREE.Color(0x000106);
  scene.fog = new THREE.FogExp2(0x000106, 0.00020);

  // PerspectiveCamera arguments: vertical FOV, aspect ratio, near plane, far plane.
  // Objects outside near/far are clipped and never sent through the full pipeline.
  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 7500);
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

  function createAsteroidLocatorTexture() {
    const locatorCanvas = document.createElement("canvas");
    locatorCanvas.width = 128;
    locatorCanvas.height = 128;
    const context = locatorCanvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 18, 64, 64, 58);
    gradient.addColorStop(0, "rgba(154, 255, 207, 0)");
    gradient.addColorStop(0.58, "rgba(154, 255, 207, 0.08)");
    gradient.addColorStop(0.76, "rgba(122, 255, 190, 0.92)");
    gradient.addColorStop(0.82, "rgba(122, 255, 190, 0.18)");
    gradient.addColorStop(1, "rgba(122, 255, 190, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    context.strokeStyle = "rgba(211, 255, 231, 0.96)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(64, 64, 35, 0, Math.PI * 2);
    context.stroke();
    [[64, 10, 64, 27], [64, 101, 64, 118], [10, 64, 27, 64], [101, 64, 118, 64]].forEach((line) => {
      context.beginPath();
      context.moveTo(line[0], line[1]);
      context.lineTo(line[2], line[3]);
      context.stroke();
    });
    const texture = new THREE.CanvasTexture(locatorCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const celestialLocatorTexture = createAsteroidLocatorTexture();
  const asteroidHoverLocator = new THREE.Sprite(new THREE.SpriteMaterial({
    map: celestialLocatorTexture,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  asteroidHoverLocator.name = "Celestial hover locator";
  asteroidHoverLocator.visible = false;
  asteroidHoverLocator.renderOrder = 36;
  scene.add(asteroidHoverLocator);

  // A brief confirmation ring appears whenever focus moves to a new celestial
  // body. It confirms the selection without permanently covering the surface.
  const focusedBodyLocator = new THREE.Sprite(new THREE.SpriteMaterial({
    map: celestialLocatorTexture,
    color: 0xa2ffd0,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  focusedBodyLocator.name = "Focused celestial confirmation locator";
  focusedBodyLocator.visible = false;
  focusedBodyLocator.renderOrder = 37;
  scene.add(focusedBodyLocator);

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
  let freeOpticalZoomTarget = 1;
  let freeOpticalZoomCurrent = 1;
  const freeExploreOffsetTarget = new THREE.Vector3();
  const freeExploreOffsetCurrent = new THREE.Vector3();
  const explorePlane = new THREE.Plane();
  const explorePlaneNormal = new THREE.Vector3();
  const exploreIntersection = new THREE.Vector3();
  const exploreDelta = new THREE.Vector3();
  let hasExploredFreeSpace = false;
  let hoveredCelestialBody = null;
  let celestialHoverTimer = null;
  let focusSelectionPulseStartedAt = -Infinity;
  const celestialHoverAnchor = new THREE.Vector2(-9999, -9999);
  let lastPointerType = "mouse";
  // Hover uses a visibility-aware magnetic lock. Once even a tiny rendered part
  // reaches the cursor, orbital movement slows and the selected target remains
  // stable long enough for an intentional click.
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
        summary: "Earth reference point",
        description: "All distances in this instrument are measured from Earth. Because Earth is the origin of the measurement, focusing Earth always reads 0 km.",
        equivalent: `Current display: ${currentValue}.`,
      };
    }

    if (focusedDistance.basis === "average") {
      return {
        eyebrow: "How this distance is measured",
        title: `Average reference distance for ${focusedDistance.bodyName}`,
        summary: "Accepted average separation",
        description: `This value uses the accepted average separation from Earth rather than a live, date-specific position.${rangeSummary}`,
        equivalent: `Current display: ${currentValue}.`,
      };
    }

    if (focusedDistance.basis === "jpl-elements") {
      return {
        eyebrow: "How this distance is measured",
        title: "Simulated planetary separation",
        summary: "Published orbit + scene position",
        description: "The current number uses the planet’s published orbital scale together with the orbital direction currently shown in this Three.js simulation. It is realistic for the scene, but it is not today’s live ephemeris position.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    if (focusedDistance.basis === "jpl-small-body") {
      return {
        eyebrow: "How this distance is measured",
        title: "Verified small-body orbital scale",
        summary: "Verified orbit + scene position",
        description: "The asteroid’s published orbital elements set its physical scale. Its current Earth separation follows the angular position shown in the simulation, not a live date-specific ephemeris.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    if (focusedDistance.basis === "satellite-parent-orbit") {
      return {
        eyebrow: "How this distance is measured",
        title: `${focusedDistance.bodyName} follows its planet’s Earth distance`,
        summary: "Parent planet orbital distance",
        description: "The moon’s local orbit around its parent is tiny compared with the planet’s distance from Earth. The readout therefore uses the parent planet’s verified heliocentric orbital scale together with the direction shown in the simulation.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    if (focusedDistance.basis === "explicit" || focusedDistance.basis === "asteroid-estimate") {
      return {
        eyebrow: "How this distance is measured",
        title: "Generated asteroid-orbit distance",
        summary: "Generated orbit geometry",
        description: "This asteroid uses the orbit generated for it inside the experience. Its Earth separation is calculated from that simulated orbit, so the value is internally consistent but not a live astronomical observation.",
        equivalent: `Current display: ${currentValue}.${rangeSummary}`,
      };
    }

    return {
      eyebrow: "How this distance is measured",
      title: "Scene-scaled Earth distance",
      summary: "Three.js scene position",
      description: "This object does not yet have complete orbital metadata, so its distance is estimated from its Three.js scene position relative to Earth.",
      equivalent: `Current display: ${currentValue}.`,
    };
  }

  function createCameraMeasurementInfo(travel, formatted) {
    return {
      eyebrow: "How this distance is measured",
      title: "Scroll-driven camera distance from Earth",
      summary: "Scroll-mapped camera scale",
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
    return THREE.MathUtils.lerp(4.8, 2550, eased);
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

  function solveEccentricAnomaly(meanAnomaly, eccentricity) {
    if (eccentricity <= 0.0001) return meanAnomaly;
    let eccentricAnomaly = meanAnomaly;
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
        / Math.max(0.000001, 1 - eccentricity * Math.cos(eccentricAnomaly));
      eccentricAnomaly -= delta;
      if (Math.abs(delta) < 0.00001) break;
    }
    return eccentricAnomaly;
  }

  function updatePlanetOrbitPosition(planet) {
    const data = planet.userData;
    const semiMajorAxis = data.orbitRadius;
    const eccentricity = THREE.MathUtils.clamp(data.orbitEccentricity ?? 0, 0, 0.92);
    const orbitRotation = data.orbitRotation ?? 0;
    const orbitInclination = data.orbitInclination ?? 0;
    const meanAnomaly = data.meanAnomaly ?? data.angle ?? 0;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
    const semiMinorAxis = semiMajorAxis * Math.sqrt(Math.max(0.0001, 1 - eccentricity * eccentricity));

    const orbitalX = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);
    const orbitalZ = semiMinorAxis * Math.sin(eccentricAnomaly);

    const inclinedZ = orbitalZ * Math.cos(orbitInclination);
    const inclinedY = orbitalZ * Math.sin(orbitInclination);

    const cosRotation = Math.cos(orbitRotation);
    const sinRotation = Math.sin(orbitRotation);

    planet.position.set(
      orbitalX * cosRotation - inclinedZ * sinRotation,
      inclinedY,
      orbitalX * sinRotation + inclinedZ * cosRotation,
    );

    const trueAnomaly = 2 * Math.atan2(
      Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly * 0.5),
      Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly * 0.5),
    );
    data.angle = trueAnomaly + orbitRotation;
  }

  const SUN_RADIUS_KM = PLANET_SCALE_PROFILES.Sun.diameterKm * 0.5;
  const SUN_BASE_VISUAL_RADIUS = PLANET_SCALE_PROFILES.Sun.visualRadius;
  let currentSunAngularRadius = 0;

  function findOrbitalParentPlanet(body) {
    if (!body) return null;

    const parentPlanetName = String(body.userData?.parentPlanet ?? "").trim().toLowerCase();
    if (parentPlanetName) {
      const configuredParent = planets.find((planet) => planet.name.toLowerCase() === parentPlanetName);
      if (configuredParent) return configuredParent;
    }

    // Earth’s Moon is nested under an orbital pivot. Walking ancestors makes the
    // Sun perspective robust even when a satellite does not carry explicit data.
    let ancestor = body.parent;
    while (ancestor) {
      if (String(ancestor.userData?.info?.type ?? "").toLowerCase() === "planet") return ancestor;
      ancestor = ancestor.parent;
    }
    return null;
  }

  function getBodyHeliocentricAU(body) {
    if (!body) return null;

    const parentPlanet = findOrbitalParentPlanet(body);
    const orbitalBody = parentPlanet ?? body;
    const orbitalBodyName = String(orbitalBody.userData?.name ?? orbitalBody.name ?? "");

    const explicitAU = Number(orbitalBody.userData?.heliocentricAU ?? body.userData?.heliocentricAU);
    let semiMajorAU = Number.isFinite(explicitAU) && explicitAU > 0 ? explicitAU : null;

    if (!semiMajorAU && HELIOCENTRIC_ORBIT_AU[orbitalBodyName]) {
      semiMajorAU = HELIOCENTRIC_ORBIT_AU[orbitalBodyName];
    }

    if (!semiMajorAU) {
      const bodyLabel = orbitalBodyName.toLowerCase();
      const planetEntry = Object.entries(HELIOCENTRIC_ORBIT_AU)
        .find(([planetName]) => bodyLabel.includes(planetName.toLowerCase()));
      semiMajorAU = planetEntry?.[1] ?? null;
    }

    if (!semiMajorAU) return null;

    // Planet and satellite views now use the exact same parent heliocentric
    // position. A moon therefore sees the same solar disk as its planet.
    const sceneSemiMajor = Number(orbitalBody.userData?.orbitRadius);
    if (Number.isFinite(sceneSemiMajor) && sceneSemiMajor > 0) {
      const currentSceneRadius = orbitalBody.getWorldPosition(new THREE.Vector3()).length();
      return semiMajorAU * currentSceneRadius / sceneSemiMajor;
    }

    return semiMajorAU;
  }

  function updateSunApparentScale() {
    let targetScale = 1;
    let focusedHeliocentricAU = null;
    const focusedName = String(focusedBody?.userData?.name ?? focusedBody?.name ?? '').toLowerCase();

    if (focusedBody && !focusedName.includes('sun')) {
      focusedHeliocentricAU = getBodyHeliocentricAU(focusedBody);
      if (focusedHeliocentricAU) {
        // Reproduce the real apparent solar angle from the selected body.
        const realDistanceKm = focusedHeliocentricAU * ASTRONOMICAL_UNIT_KM;
        const angularRadius = Math.atan(SUN_RADIUS_KM / realDistanceKm);
        const cameraToSun = Math.max(1, camera.position.distanceTo(sun.system.position));
        const apparentRadius = Math.tan(angularRadius) * cameraToSun;
        targetScale = THREE.MathUtils.clamp(apparentRadius / SUN_BASE_VISUAL_RADIUS, 0.006, 0.24);
      }
    }

    const currentScale = sun.system.scale.x;
    const nextScale = THREE.MathUtils.lerp(currentScale, targetScale, focusedBody ? 0.095 : 0.065);
    sun.system.scale.setScalar(nextScale);

    const cameraToSun = Math.max(1, camera.position.distanceTo(sun.system.position));
    const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const apparentWorldRadius = SUN_BASE_VISUAL_RADIUS * nextScale;
    currentSunAngularRadius = Math.asin(THREE.MathUtils.clamp(apparentWorldRadius / cameraToSun, 0, 0.999));
    spaceEnvironment.setSunAngularRadius(currentSunAngularRadius);
    const projectedRadiusPixels = (apparentWorldRadius / cameraToSun)
      / Math.max(0.0001, Math.tan(halfFov))
      * innerHeight * 0.5;

    // When the physical disk becomes only a few pixels wide, blend it into a
    // brilliant point-star flare. The flare still depth-tests, so a planet can
    // naturally eclipse it instead of the light appearing through solid rock.
    const apparentPointBlend = 1 - THREE.MathUtils.smoothstep(projectedRadiusPixels, 5, 42);
    const journeyStarBlend = THREE.MathUtils.smoothstep(smoothProgress, 0.38, 0.96);
    const distantBodyBlend = focusedHeliocentricAU
      ? THREE.MathUtils.smoothstep(focusedHeliocentricAU, 1.0, 30.0)
      : 0;
    const starBlend = focusedName.includes('sun')
      ? 0
      : THREE.MathUtils.clamp(Math.max(apparentPointBlend, journeyStarBlend * 0.92, distantBodyBlend), 0, 1);

    const worldUnitsPerPixel = 2 * cameraToSun * Math.tan(halfFov) / Math.max(1, innerHeight);
    const deepJourneyGlow = THREE.MathUtils.smoothstep(smoothProgress, 0.46, 1.0);
    const remoteBodyGlow = focusedHeliocentricAU
      ? THREE.MathUtils.smoothstep(focusedHeliocentricAU, 3.0, 30.0)
      : 0;
    const distanceGlow = Math.max(deepJourneyGlow, remoteBodyGlow);

    // The physical disk becomes smaller with distance, while diffraction,
    // corona and sensor-like glare make the unresolved point appear more radiant.
    const haloPixelSize = THREE.MathUtils.lerp(24, 164, starBlend)
      + distanceGlow * 76;
    const targetGlowWorldSize = Math.max(
      apparentWorldRadius * THREE.MathUtils.lerp(2.1, 5.8, starBlend),
      haloPixelSize * worldUnitsPerPixel,
    );
    const localGlowSize = targetGlowWorldSize / Math.max(nextScale, 0.0001);
    sun.glow.scale.set(localGlowSize, localGlowSize, 1);
    sun.glow.material.opacity = THREE.MathUtils.clamp(
      (THREE.MathUtils.lerp(0.03, 0.54, starBlend) + distanceGlow * 0.20)
        * (1 + Math.sin(elapsedTime * 1.7) * (0.06 + distanceGlow * 0.07)),
      0,
      0.82,
    );

    if (sun.distantStar) {
      const starPixelSize = THREE.MathUtils.lerp(16, 108, starBlend)
        + distanceGlow * 52;
      const starWorldSize = starPixelSize * worldUnitsPerPixel;
      const localStarSize = starWorldSize / Math.max(nextScale, 0.0001);
      sun.distantStar.visible = starBlend > 0.015;
      sun.distantStar.scale.set(localStarSize, localStarSize, 1);
      sun.distantStar.material.opacity = THREE.MathUtils.clamp(
        starBlend * (0.82 + distanceGlow * 0.32 + Math.sin(elapsedTime * 2.25) * (0.08 + distanceGlow * 0.07)),
        0,
        1,
      );
      sun.distantStar.material.rotation = elapsedTime * (0.035 + distanceGlow * 0.018);
    }
  }

  /** Writes a body's structured metadata into the right-side inspection panel. */
  function updateBodyCard(body) {
    const isVisible = Boolean(body);
    bodyCard.classList.toggle("is-visible", isVisible);
    bodyCard.setAttribute("aria-hidden", String(!isVisible));
    if (!body) {
      displayedBody = null;
      setBodyCardCollapsed(false);
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
    if (!body || isBodyCardCollapsed || innerWidth <= 760) {
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
  cardCollapse?.addEventListener("click", () => setBodyCardCollapsed(true));
  cardRestore?.addEventListener("click", () => setBodyCardCollapsed(false));

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

  function updateFocusedSelectionVisual() {
    const age = elapsedTime - focusSelectionPulseStartedAt;
    if (!focusedBody || age < 0 || age > 1.85) {
      focusedBodyLocator.visible = false;
      focusedBodyLocator.material.opacity = 0;
      return;
    }

    const worldPosition = focusedBody.getWorldPosition(new THREE.Vector3());
    const projected = worldPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) {
      focusedBodyLocator.visible = false;
      return;
    }

    focusedBodyLocator.visible = true;
    focusedBodyLocator.position.copy(worldPosition);
    const cameraDistance = Math.max(0.001, camera.position.distanceTo(worldPosition));
    const worldUnitsPerPixel = 2 * cameraDistance
      * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      / Math.max(1, innerHeight);
    const bodyRadiusPixels = projectedBodyRadiusPixels(focusedBody);
    const baseMarkerPixels = THREE.MathUtils.clamp(bodyRadiusPixels * 2.25 + 30, 34, 104);
    const pulse = 1 + Math.sin(age * 9.5) * 0.10;
    const markerSize = worldUnitsPerPixel * baseMarkerPixels * pulse;
    focusedBodyLocator.scale.set(markerSize, markerSize, 1);

    const fadeOut = 1 - THREE.MathUtils.smoothstep(age, 1.05, 1.85);
    focusedBodyLocator.material.opacity = (0.58 + Math.sin(age * 9.5) * 0.18) * fadeOut;
  }

  /*
    getBodyAtPointer
    - Performs a raycast only when the user intentionally clicks or taps.
    - Supports nested mesh structures by resolving to the interactive parent.
  */
  function getInteractiveType(body) {
    return String(body?.userData?.info?.type ?? "").toLowerCase();
  }

  function isMajorCelestialBody(body) {
    const type = getInteractiveType(body);
    return type === "star" || type === "planet" || type === "natural satellite";
  }

  function isAsteroidBody(body) {
    const type = getInteractiveType(body);
    const name = String(body?.userData?.name ?? body?.name ?? "").toLowerCase();
    return Boolean(
      body?.userData?.isAsteroid
      || body?.userData?.isInstancedAsteroid
      || type.includes("asteroid")
      || name.includes("asteroid")
      || name.includes("family")
    );
  }

  function projectedBodyRadiusPixels(body) {
    if (!body) return 0;
    const worldPosition = body.getWorldPosition(new THREE.Vector3());
    const cameraDistance = Math.max(0.0001, camera.position.distanceTo(worldPosition));
    const visualRadius = Number(
      body.userData?.focusVisualRadius
      ?? body.userData?.visualRadius
      ?? body.userData?.instanceRecord?.visualRadius
      ?? 0,
    );
    if (!Number.isFinite(visualRadius) || visualRadius <= 0) return 0;

    const focalPixels = innerHeight * 0.5
      / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
    return visualRadius / cameraDistance * focalPixels;
  }

  function findNearestMajorBodyAtPointer({
    minimumVisibleRadiusPixels = 0.85,
    extraHitPixels = innerWidth <= 760 ? 9 : 6,
    maximumHitRadiusPixels = 30,
    excludedBody = null,
  } = {}) {
    const candidates = [];
    const seen = new Set();

    hoverTargets.forEach((target) => {
      let body = target;
      while (body && !body.userData?.name) body = body.parent;
      if (!body || body === excludedBody || seen.has(body) || !isMajorCelestialBody(body)) return;
      seen.add(body);
      candidates.push(body);
    });

    let nearest = null;
    let nearestScore = Infinity;
    const projected = new THREE.Vector3();

    candidates.forEach((body) => {
      const worldPosition = body.getWorldPosition(new THREE.Vector3());
      projected.copy(worldPosition).project(camera);
      if (projected.z < -1 || projected.z > 1) return;

      const radiusPixels = projectedBodyRadiusPixels(body);
      // A sub-pixel body is intentionally treated as a region to explore first,
      // rather than becoming an invisible click target.
      if (radiusPixels < minimumVisibleRadiusPixels) return;

      const dx = (projected.x - pointer.x) * innerWidth * 0.5;
      const dy = (projected.y - pointer.y) * innerHeight * 0.5;
      const distancePixels = Math.hypot(dx, dy);
      // Large, clearly visible bodies need almost no invisible cushion. Tiny
      // planets still receive a modest assist, but nearby Earth no longer owns
      // the empty region between its globe and the Moon.
      const adaptiveExtraPixels = radiusPixels >= 12
        ? Math.min(1.25, extraHitPixels)
        : radiusPixels >= 4
          ? Math.min(3.0, extraHitPixels)
          : extraHitPixels;
      const clickRadius = Math.min(
        radiusPixels + adaptiveExtraPixels,
        Math.max(maximumHitRadiusPixels, radiusPixels + 2.25),
      );
      if (distancePixels > clickRadius) return;

      const type = getInteractiveType(body);
      const typeBias = type === "natural satellite" ? -2 : type === "planet" ? -1 : 0;
      // Prefer the body whose visible disk most clearly contains the cursor.
      // This avoids selecting Earth when the pointer is actually in the gap
      // between Earth and the Moon.
      const coverage = Math.max(0.001, radiusPixels - distancePixels);
      const score = distancePixels / Math.max(1, clickRadius)
        - Math.min(0.35, coverage / Math.max(1, radiusPixels) * 0.25)
        + typeBias * 0.03;
      if (score < nearestScore) {
        nearest = body;
        nearestScore = score;
      }
    });

    return nearest;
  }

  function isPointerInsideVisibleBodyDisk(body, extraPixels = 0) {
    if (!body) return false;
    const projected = body.getWorldPosition(new THREE.Vector3()).project(camera);
    if (projected.z < -1 || projected.z > 1) return false;
    const dx = (projected.x - pointer.x) * innerWidth * 0.5;
    const dy = (projected.y - pointer.y) * innerHeight * 0.5;
    const radiusPixels = projectedBodyRadiusPixels(body);
    return radiusPixels > 0.15 && Math.hypot(dx, dy) <= radiusPixels + extraPixels;
  }

  function isPointerStillOnHoveredBody(body) {
    if (!body) return false;
    const worldPosition = body.getWorldPosition(new THREE.Vector3());
    const projected = worldPosition.project(camera);
    if (projected.z < -1 || projected.z > 1) return false;

    const dx = (projected.x - pointer.x) * innerWidth * 0.5;
    const dy = (projected.y - pointer.y) * innerHeight * 0.5;
    const distancePixels = Math.hypot(dx, dy);
    const radiusPixels = projectedBodyRadiusPixels(body);

    if (isAsteroidBody(body)) {
      // Asteroids keep a slightly magnetic lock because they move quickly and
      // may be only a few pixels wide. The lock is still local to the locator.
      return distancePixels <= THREE.MathUtils.clamp(radiusPixels + 8, 8, 18);
    }

    // For visible planets, stars and moons, follow the rendered silhouette.
    // Only sub-pixel bodies receive a larger discovery cushion.
    const assistPixels = radiusPixels >= 12 ? 1.5 : radiusPixels >= 4 ? 3.0 : 7;
    return distancePixels <= radiusPixels + assistPixels;
  }

  function clearCelestialHover() {
    hoveredCelestialBody = null;
    asteroidHoverLocator.visible = false;
    asteroidHoverLocator.material.opacity = 0;
    asteroidHoverTooltip.classList.remove("is-visible");
    asteroidHoverTooltip.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-hovering-asteroid", "is-hovering-celestial");
  }

  function setCelestialHover(body) {
    if (!body || body === focusedBody) {
      clearCelestialHover();
      return;
    }

    hoveredCelestialBody = body;
    const bodyType = body.userData?.info?.type ?? (isAsteroidBody(body) ? "Asteroid" : "Celestial body");
    asteroidHoverName.textContent = body.userData?.name ?? body.name ?? bodyType;
    if (celestialHoverAction) {
      celestialHoverAction.textContent = focusedBody
        ? `${bodyType} · Click to switch focus`
        : `${bodyType} · Slow motion · Click to inspect`;
    }
    asteroidHoverTooltip.classList.add("is-visible");
    asteroidHoverTooltip.setAttribute("aria-hidden", "false");
    asteroidHoverLocator.visible = true;
    celestialHoverAnchor.set(
      (pointer.x * 0.5 + 0.5) * innerWidth,
      (-pointer.y * 0.5 + 0.5) * innerHeight,
    );
    document.body.classList.toggle("is-hovering-asteroid", isAsteroidBody(body));
    document.body.classList.add("is-hovering-celestial");
  }

  function findCelestialForHover() {
    if (isDragging || lastPointerType === "touch"
      || (distanceUnitPopover && !distanceUnitPopover.hidden)) {
      clearCelestialHover();
      return;
    }

    // While inspecting a body, its own visible surface should not reveal a
    // target hidden behind it. Nearby visible bodies can still be discovered
    // and selected without closing focus first.
    if (focusedBody && isPointerInsideVisibleBodyDisk(focusedBody, 1.5)) {
      clearCelestialHover();
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hoverTargets, true);
    const hitBodies = hits
      .map((hit) => findInteractiveObject(hit))
      .filter((body) => Boolean(body && body !== focusedBody));

    const nearbyMajor = findNearestMajorBodyAtPointer({
      minimumVisibleRadiusPixels: 0.14,
      extraHitPixels: innerWidth <= 760 ? 12 : 7,
      maximumHitRadiusPixels: innerWidth <= 760 ? 30 : 23,
      excludedBody: focusedBody,
    });
    if (nearbyMajor) {
      setCelestialHover(nearbyMajor);
      return;
    }

    const directAsteroid = hitBodies.find((body) => (
      isAsteroidBody(body) && projectedBodyRadiusPixels(body) >= 0.22
    ));
    if (directAsteroid) {
      setCelestialHover(directAsteroid);
      return;
    }

    const nearbyInstance = findNearestAsteroidInstanceAtPointer({
      meshes: asteroidBelt.instancedBoulders,
      pointer,
      camera,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      minimumVisibleRadiusPixels: 0.22,
      maximumPixelRadius: innerWidth <= 760 ? 13 : 10,
    });
    setCelestialHover(nearbyInstance);
  }

  function scheduleCelestialHover() {
    if (celestialHoverTimer) clearTimeout(celestialHoverTimer);
    celestialHoverTimer = setTimeout(() => {
      celestialHoverTimer = null;
      findCelestialForHover();
    }, 18);
  }

  function updateCelestialHoverVisual() {
    if (!hoveredCelestialBody || !asteroidHoverLocator.visible) return;

    const worldPosition = hoveredCelestialBody.getWorldPosition(new THREE.Vector3());
    const projected = worldPosition.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) {
      clearCelestialHover();
      return;
    }

    asteroidHoverLocator.position.copy(worldPosition);
    const cameraDistance = Math.max(0.001, camera.position.distanceTo(worldPosition));
    const worldUnitsPerPixel = 2 * cameraDistance
      * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      / Math.max(1, innerHeight);
    const bodyRadiusPixels = projectedBodyRadiusPixels(hoveredCelestialBody);
    const baseMarkerPixels = THREE.MathUtils.clamp(bodyRadiusPixels * 2.5 + 24, 27, 58);
    const pulse = 1 + Math.sin(elapsedTime * 3.6) * 0.065;
    const markerSize = worldUnitsPerPixel * baseMarkerPixels * pulse;
    asteroidHoverLocator.scale.set(markerSize, markerSize, 1);
    asteroidHoverLocator.material.opacity = 0.84 + Math.sin(elapsedTime * 3.6) * 0.10;

    const screenX = (projected.x * 0.5 + 0.5) * innerWidth;
    const screenY = (-projected.y * 0.5 + 0.5) * innerHeight;
    asteroidHoverTooltip.style.left = `${THREE.MathUtils.clamp(screenX + 18, 12, innerWidth - 232)}px`;
    asteroidHoverTooltip.style.top = `${THREE.MathUtils.clamp(screenY - 46, 12, innerHeight - 78)}px`;
  }

  /*
    getBodyAtPointer
    - Major bodies always win over asteroid clutter.
    - Invisible/sub-pixel rocks never steal an empty-space exploration click.
    - Asteroids become selectable only once their rendered size is genuinely visible.
  */
  function getBodyAtPointer() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hoverTargets, true);
    const bodies = hits.map((hit) => findInteractiveObject(hit)).filter(Boolean);

    // When a small asteroid crosses the same line of sight as a planet, the
    // user's likely target is the clearly recognisable major body behind it.
    // Major bodies are selected from their visible projected disk instead of
    // broad hidden proxy geometry. This prevents Earth, the Moon, or the Sun
    // from owning nearby empty space simply because a large interaction sphere
    // happened to intersect the ray.

    // Give visible planets, moons and the Sun a small screen-space click cushion.
    // This is intentionally disabled while they are sub-pixel dots; clicking then
    // moves the camera toward the region instead of opening an unseen object.
    const nearbyMajorBody = findNearestMajorBodyAtPointer();
    if (nearbyMajorBody) return nearbyMajorBody;

    // Once the green locator is visible, the click is unambiguous even if a
    // revolving body travels a few pixels between hover detection and pointerup.
    if (hoveredCelestialBody
      && asteroidHoverLocator.visible
      && isPointerStillOnHoveredBody(hoveredCelestialBody)) {
      return hoveredCelestialBody;
    }

    // Individually modelled asteroids still use exact geometry, but must be large
    // enough on screen for the user to actually see what they are selecting.
    const visibleDirectAsteroid = bodies.find((body) => (
      isAsteroidBody(body) && projectedBodyRadiusPixels(body) >= (innerWidth <= 760 ? 1.1 : 0.65)
    ));
    if (visibleDirectAsteroid) return visibleDirectAsteroid;

    // Instanced belt rocks use a strict visibility-aware fallback. The helper
    // rejects sub-pixel objects and uses a tight hit radius based on rendered size.
    return findNearestAsteroidInstanceAtPointer({
      meshes: asteroidBelt.instancedBoulders,
      pointer,
      camera,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      minimumVisibleRadiusPixels: innerWidth <= 760 ? 0.95 : 0.60,
      maximumPixelRadius: innerWidth <= 760 ? 15 : 10,
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
    - Clicking the same body twice or clicking empty space while focused restores
      the exact scroll/camera distance that the user was viewing before inspection.
  */
  function focusBody(body) {
    const nextBody = body && focusedBody !== body ? body : null;
    clearCelestialHover();
    setBodyCardCollapsed(false);

    // Measurement/unit explanations belong to the previous readout state and
    // should not remain open while focus is changed or dismissed.
    if (activeDistanceInfo && distanceUnitPopover && !distanceUnitPopover.hidden) {
      closeDistanceInfoPopover({ releaseJourneyLock: false });
    }

    // Restore a previous instanced rock before changing focus. Its inexpensive
    // belt representation replaces the temporary high-resolution close-up.
    if (focusedBody) setAsteroidInspectionDetail(focusedBody, false);

    if (!nextBody) {
      focusedBody = null;
      focusedBodyLocator.visible = false;
      focusedBodyLocator.material.opacity = 0;
      focusZoomTarget = 1;
      focusZoomCurrent = 1;
      focusPinchDistance = null;
      unlockJourneyScroll();
      return;
    }

    if (!isJourneyScrollLocked) lockJourneyScroll();
    focusedBody = nextBody;
    focusSelectionPulseStartedAt = elapsedTime;
    focusedBodyLocator.visible = true;
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

  function resetFreeExploration({ immediate = false } = {}) {
    freeOpticalZoomTarget = 1;
    freeExploreOffsetTarget.set(0, 0, 0);
    hasExploredFreeSpace = false;
    spaceExploreHint?.classList.remove("is-hidden");

    if (immediate) {
      freeOpticalZoomCurrent = 1;
      freeExploreOffsetCurrent.set(0, 0, 0);
    }
  }

  let isEarthReturnQueued = false;

  /** Performs the camera reset only after any open distance shot has ended. */
  function completeTravelBackToEarth() {
    clearCelestialHover();
    if (celestialHoverTimer) {
      clearTimeout(celestialHoverTimer);
      celestialHoverTimer = null;
    }

    if (focusedBody) setAsteroidInspectionDetail(focusedBody, false);
    focusedBody = null;
    focusedBodyLocator.visible = false;
    focusedBodyLocator.material.opacity = 0;
    displayedBody = null;
    setBodyCardCollapsed(false);
    focusZoomTarget = 1;
    focusZoomCurrent = 1;
    focusPinchDistance = null;

    if (isJourneyScrollLocked) unlockJourneyScroll();
    resetFreeExploration({ immediate: true });

    scrollProgress = 0;
    smoothProgress = 0;
    previousDistanceProgress = 0;
    targetYaw = -0.55;
    targetPitch = 0.22;
    yaw = targetYaw;
    pitch = targetPitch;
    camera.fov = 56;
    camera.updateProjectionMatrix();
    earth.getWorldPosition(cameraFocusPoint);
    targetFocusPoint.copy(cameraFocusPoint);
    hasCameraFocusPoint = true;
    updateBodyCard(null);
    updateDistanceReadout(0);

    document.documentElement.style.scrollBehavior = "smooth";
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    setTimeout(() => {
      document.documentElement.style.scrollBehavior = "";
    }, 650);

    earthReturnButton.classList.remove("is-returning");
    void earthReturnButton.offsetWidth;
    earthReturnButton.classList.add("is-returning");
    setTimeout(() => earthReturnButton.classList.remove("is-returning"), 850);
  }

  function travelBackToEarth() {
    if (isEarthReturnQueued) return;

    // Keep the current camera perfectly still while the explanation card
    // shrinks away and its luminous route retracts. Starting the Earth reset
    // only after that sequence completes prevents the line from visibly
    // lingering over an already-arrived Earth scene.
    if (distanceCinematicPanel?.isOpen()) {
      isEarthReturnQueued = true;
      earthReturnButton.disabled = true;
      closeDistanceInfoPopover({
        releaseJourneyLock: false,
        onComplete: () => {
          isEarthReturnQueued = false;
          earthReturnButton.disabled = false;
          completeTravelBackToEarth();
        },
      });
      return;
    }

    completeTravelBackToEarth();
  }

  earthReturnButton.addEventListener("click", travelBackToEarth);

  function exploreSpaceAtPointer() {
    if (focusedBody || (distanceUnitPopover && !distanceUnitPopover.hidden)) return;

    raycaster.setFromCamera(pointer, camera);
    camera.getWorldDirection(explorePlaneNormal).normalize();
    explorePlane.setFromNormalAndCoplanarPoint(explorePlaneNormal, cameraFocusPoint);

    if (!raycaster.ray.intersectPlane(explorePlane, exploreIntersection)) return;

    const currentDistance = Math.max(1, camera.position.distanceTo(cameraFocusPoint));
    const maximumStep = Math.max(4, currentDistance * 0.44);
    const maximumTotalOffset = Math.max(8, currentDistance * 0.72);

    exploreDelta
      .copy(exploreIntersection)
      .sub(cameraFocusPoint)
      .clampLength(0, maximumStep);

    freeExploreOffsetTarget
      .add(exploreDelta.multiplyScalar(0.92))
      .clampLength(0, maximumTotalOffset);

    // Each empty-space click moves closer to the selected region. Repeated
    // clicks progressively magnify it until a safe optical limit is reached.
    freeOpticalZoomTarget = THREE.MathUtils.clamp(
      freeOpticalZoomTarget * 0.68,
      0.28,
      1,
    );

    hasExploredFreeSpace = true;
    spaceExploreHint?.classList.add("is-hidden");
  }

  const preventFocusedJourneyScroll = (event) => {
    // Cards and the distance explanation retain their own internal scrolling.
    if (event.target.closest?.(".body-card, .body-card-restore, .progress, .distance-cinematic-layer")) return;
    if (!isJourneyScrollLocked) return;

    event.preventDefault();
    if (focusedBody && event.type === "wheel") adjustFocusedZoom(event.deltaY);
  };
  addEventListener("wheel", preventFocusedJourneyScroll, { passive: false });

  addEventListener("touchstart", (event) => {
    if (event.target.closest?.(".body-card, .body-card-restore, .progress, .distance-cinematic-layer")) return;
    if (!focusedBody || event.touches.length !== 2) return;
    focusPinchDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    );
  }, { passive: true });

  addEventListener("touchmove", (event) => {
    if (event.target.closest?.(".body-card, .body-card-restore, .progress, .distance-cinematic-layer")) return;
    if (!focusedBody || event.touches.length !== 2 || focusPinchDistance == null) return;
    event.preventDefault();

    const nextDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY,
    );
    if (nextDistance <= 0) return;

    focusZoomTarget = THREE.MathUtils.clamp(
      focusZoomTarget * (focusPinchDistance / nextDistance),
      0.58,
      2.45,
    );
    focusPinchDistance = nextDistance;
  }, { passive: false });

  addEventListener("touchend", (event) => {
    if (event.touches.length < 2) focusPinchDistance = null;
  }, { passive: true });

  addEventListener("pointermove", (event) => {
    updatePointerFromEvent(event);
    lastPointerType = event.pointerType || "mouse";
    if (hoveredCelestialBody && !isPointerStillOnHoveredBody(hoveredCelestialBody)) {
      clearCelestialHover();
    }
    if (event.target.closest?.(".hud, .body-card, .body-card-restore, .progress, .distance-cinematic-layer, .earth-return-button")) {
      clearCelestialHover();
      lastPointer = { x: event.clientX, y: event.clientY };
      return;
    }
    if (isDragging) {
      clearCelestialHover();
      // Track the largest movement so pointerup can distinguish a drag from a click.
      dragDistance = Math.max(
        dragDistance,
        Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y),
      );
      // Horizontal deltas orbit around Y (yaw); vertical deltas control pitch.
      targetYaw -= (event.clientX - lastPointer.x) * 0.006;
      targetPitch -= (event.clientY - lastPointer.y) * 0.004;
      targetPitch = THREE.MathUtils.clamp(targetPitch, -1.1, 1.1);
    } else if (!spaceEnvironment.reducedMotion && !hoveredCelestialBody) {
      // Even without dragging, a tiny pointer parallax keeps the scene feeling alive.
      // It pauses while a hover target is magnetically locked so the camera does
      // not pull a tiny body away from the cursor.
      targetYaw += pointer.x * 0.0005;
      targetPitch += pointer.y * 0.00025;
    }
    lastPointer = { x: event.clientX, y: event.clientY };
    if (!isDragging && lastPointerType !== "touch" && !hoveredCelestialBody) {
      scheduleCelestialHover();
    }
  });

  addEventListener("pointerleave", clearCelestialHover);

  addEventListener("pointerdown", (event) => {
    if (event.target.closest?.(".body-card-restore, .progress, .distance-cinematic-layer, .earth-return-button")) return;
    // A panel closed by its own close button remains modal until it retires. A
    // journey-intent dismissal has already unlocked input and may continue.
    if (distanceCinematicPanel?.isOpen() && isJourneyScrollLocked) return;
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
    if (event.target.closest?.(".hud, .body-card, .body-card-restore, .progress, .distance-cinematic-layer, .earth-return-button")) return;
    if (distanceCinematicPanel?.isOpen() && isJourneyScrollLocked) return;
    if (dragDistance > 12) return;
    // Details are opened only after this intentional click/tap raycast.
    const body = getBodyAtPointer();
    if (body) {
      focusBody(body);
      return;
    }

    if (focusedBody) {
      focusBody(null);
      return;
    }

    exploreSpaceAtPointer();
  });

  addEventListener("pointercancel", () => {
    // Browsers can cancel input when a gesture leaves the window or becomes a system gesture.
    isDragging = false;
    clearCelestialHover();
  });

  /** Exits whichever temporary view currently owns the experience. */
  function exitCurrentView() {
    const isDistancePopoverOpen = Boolean(distanceUnitPopover && !distanceUnitPopover.hidden);
    if (isDistancePopoverOpen) {
      closeDistanceInfoPopover();
      return;
    }
    if (focusedBody) {
      focusBody(null);
      updateBodyCard(null);
      return;
    }
    if (hasExploredFreeSpace || freeOpticalZoomTarget !== 1 || freeExploreOffsetTarget.lengthSq() > 0.0001) {
      resetFreeExploration();
    }
  }

  addEventListener("keydown", (event) => {
    const journeyKeys = [
      " ", "PageUp", "PageDown", "Home", "End",
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
    ];
    const isDistancePopoverOpen = Boolean(distanceUnitPopover && !distanceUnitPopover.hidden);

    if (isDistancePopoverOpen && journeyKeys.includes(event.key)) {
      closeDistanceInfoPopover({ resumeJourneyImmediately: true });
    }

    // Keyboard controls modify the same targets as dragging, so smoothing still applies.
    if (isJourneyScrollLocked && journeyKeys.includes(event.key)) {
      event.preventDefault();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      exitCurrentView();
      return;
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
    if (!event.persisted) {
      spaceEnvironment.dispose();
      distanceCinematicPanel?.dispose();
    }
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
    const motionScale = hoveredCelestialBody ? 0.018 : focusedBody ? 0.12 : 1;
    simulationTime += deltaTime * motionScale;
    // Easing with lerp each frame creates inertia. Larger factors catch up faster.
    smoothProgress = THREE.MathUtils.lerp(smoothProgress, scrollProgress, 0.065);
    updateDistanceReadout(smoothProgress);
    yaw = THREE.MathUtils.lerp(yaw, targetYaw, 0.075);
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, 0.075);

    // ----- Update planet revolution and self-rotation -----
    planets.forEach((planet) => {
      const data = planet.userData;
      data.meanAnomaly = (data.meanAnomaly ?? data.angle ?? 0) + data.orbitSpeed * 0.0022 * motionScale;
      updatePlanetOrbitPosition(planet);
      planet.rotation.y += data.spinSpeed * motionScale;
      updatePlanetVisuals(planet, simulationTime, motionScale);
    });
    updateMajorSatelliteSystems(majorSatelliteSystems, motionScale);

    // ----- Calculate the camera's spherical orbit around its focus point -----
    const distance = getCameraDistance(smoothProgress);
    freeExploreOffsetCurrent.lerp(
      freeExploreOffsetTarget,
      focusedBody ? 0.055 : 0.09,
    );
    getFocusPoint(distance, targetFocusPoint);
    if (!focusedBody) targetFocusPoint.add(freeExploreOffsetCurrent);
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
    freeOpticalZoomCurrent = THREE.MathUtils.lerp(
      freeOpticalZoomCurrent,
      focusedBody ? 1 : freeOpticalZoomTarget,
      0.13,
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
    // Focus mode moves the camera. Empty-space clicks use optical zoom plus a
    // lateral exploration target while preserving the scroll journey readout.
    const journeyFov = THREE.MathUtils.lerp(42, 72, smoothProgress);
    const targetFov = focusedBody
      ? focusedBody.userData.focusFov ?? 30
      : THREE.MathUtils.clamp(journeyFov * freeOpticalZoomCurrent, 16, 94);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, focusedBody ? 0.08 : 0.09);
    camera.updateProjectionMatrix();

    // ----- Animate special meshes and scene effects -----
    earthClouds.rotation.y += 0.0032;
    earthAtmosphere.rotation.y -= 0.0014;
    moonPivot.rotation.y += 0.011 * motionScale;
    // A small oscillation suggests lunar libration while the pivot maintains tidal lock.
    moon.rotation.y = Math.sin(simulationTime * 0.35) * 0.04;
    updateSun(sun, simulationTime, motionScale);
    updateSunApparentScale();
    updateCelestialHoverVisual();
    updateFocusedSelectionVisual();
    updateAsteroidBelt(asteroidBelt, motionScale, jupiter, camera, currentSunAngularRadius);
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
    // Let the loader nearly complete its fade before the persistent navigation
    // rocket flies in, overshoots its resting point, and bounces into place.
    setTimeout(() => {
      earthReturnButton.disabled = false;
      earthReturnButton.classList.remove("is-awaiting-entrance");
      earthReturnButton.classList.add("is-entering");
      setTimeout(() => earthReturnButton.classList.remove("is-entering"), 1500);
    }, 620);
  }, 1350);
})();

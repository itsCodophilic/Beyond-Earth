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
import {
  createMajorSatelliteSystems,
  findNearestJovianSatelliteAtPointer,
  getJovianSatelliteEncounterIntensity,
  updateMajorSatelliteSystems,
  updateMajorSatelliteVisibility,
} from './planets/satellites/satelliteSystem.js';
import { PLANET_CONFIGS } from './planets/index.js';
import {
  ASTEROID_INSPECTION_LAYER,
  createAsteroidBelt,
  findNearestAsteroidInstanceAtPointer,
  resolveAsteroidInstanceHit,
  setAsteroidBeltQuality,
  setAsteroidFocusAppearance,
  setAsteroidInspectionDetail,
  updateAsteroidBelt,
  updateAsteroidSpinClock,
  updateJupiterTrojanFrame,
} from './scene/asteroidBelt.js';
import { createPlanet, updatePlanetVisuals } from './scene/planetFactory.js';
import {
  ASTRONOMICAL_UNIT_KM,
  createEarthDistanceTracker,
  formatEarthDistance,
  formatEarthDistanceRange,
  getEarthDistanceRegion,
  interpolateCameraDistanceFromEarth,
} from './scene/distanceFromEarth.js';
import { SpaceEnvironment } from './scene/space/spaceEnvironment.js';
import { JOURNEY_MAP } from './scene/space/spaceEnvironmentConfig.js';
import { createSun, setSunPerformanceProfile, updateSun } from './stars/sun/sun.js';
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
      unlockJourneyScroll({ preserveLiveCamera: true });
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

  // Empty-space travel receives its own cinematic confirmation. The element is
  // reused for every click so repeated dives never leave abandoned DOM nodes.
  let spaceDivePulse = document.querySelector("#space-dive-pulse");
  if (!spaceDivePulse) {
    spaceDivePulse = document.createElement("div");
    spaceDivePulse.id = "space-dive-pulse";
    spaceDivePulse.className = "space-dive-pulse";
    spaceDivePulse.setAttribute("aria-hidden", "true");
    spaceDivePulse.innerHTML = `
      <span class="space-dive-pulse__ring"></span>
      <span class="space-dive-pulse__reticle"></span>
      <span class="space-dive-pulse__point"></span>
    `;
    document.body.append(spaceDivePulse);
  }
  let spaceDivePulseTimer = null;

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
  // Keep normal scene layer 0 and also allow the isolated asteroid inspection
  // light/object layer to participate in rendering.
  camera.layers.enable(ASTEROID_INSPECTION_LAYER);
  // The renderer owns the WebGL context and draws into the existing HTML canvas.
  // Rendering now stays on one deterministic cinematic profile: High geometry,
  // High environment detail, and a stable high-resolution drawing buffer.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  const creationQuality = "high";
  const CINEMATIC_MAX_PIXEL_RATIO = 2;
  const CINEMATIC_TARGET_FPS = 60;
  const CINEMATIC_FRAME_INTERVAL_MS = 1000 / CINEMATIC_TARGET_FPS;
  const CINEMATIC_HOVER_DELAY_MS = 18;
  let cinematicPixelRatio = 1;
  let lastCinematicFrameTime = 0;

  function resizeCinematicRenderer() {
    cinematicPixelRatio = THREE.MathUtils.clamp(
      Number(window.devicePixelRatio) || 1,
      1,
      CINEMATIC_MAX_PIXEL_RATIO,
    );
    renderer.setPixelRatio(cinematicPixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
    return cinematicPixelRatio;
  }

  resizeCinematicRenderer();
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
    // The locator is an interaction affordance, not a physical object. Keeping
    // depth testing disabled prevents nearby rocks in the dense belt from
    // hiding the green ring after an asteroid has already been acquired.
    depthTest: false,
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
  let pointerDownCelestialBody = null;
  let dragDistance = 0;
  // focusedBody is null during free flight or references the clicked Mesh.
  let focusedBody = null;
  // Focus navigation behaves like a real view stack. Every body-to-body jump
  // stores the complete previous inspection state. Example:
  // Jupiter -> Io -> Europa -> Jupiter
  // Escape then restores Europa, followed by Io, followed by the original
  // Jupiter inspection, and only then returns to free-flight.
  const focusNavigationHistory = [];
  const MAX_FOCUS_NAVIGATION_HISTORY = 48;
  const focusHistoryWorldPosition = new THREE.Vector3();
  let displayedBody = null;
  // Focus mode freezes the page journey and restores this snapshot when the
  // user closes the celestial inspection card.
  let isJourneyScrollLocked = false;
  let journeyScrollSnapshot = null;
  // Closing a focused body temporarily enters a deterministic restoration state.
  // During these few frames, native scroll events are ignored and the pre-focus
  // camera/progress values are held exactly. This prevents the broad camera from
  // rendering once from Jupiter's close inspection position before the document
  // scroll restoration has settled.
  let focusExitTransition = null;
  let suppressJourneyScrollSync = false;

  // The first few scroll frames deliberately introduce the experience from
  // Earth's neighbourhood. Once the viewer has left that opening shot, inward
  // travel must continue toward the Sun instead of silently snapping back to
  // Earth. The explicit "Travel back to Earth" action rearms this opening view.
  const EARTH_OPENING_RELEASE_DISTANCE = 18;
  let hasLeftOpeningEarthView = false;

  // Reaching the outermost Solar-System view performs a bounded soft reset.
  // It clears every temporary inspection/input/render state without reloading
  // the document or moving the camera. Hysteresis ensures it runs only once per
  // outward journey and rearms after the viewer travels inward or focuses again.
  const BROAD_VIEW_RESET_ENTER_PROGRESS = 0.9985;
  const BROAD_VIEW_RESET_REARM_PROGRESS = 0.965;
  const BROAD_VIEW_RESET_STABLE_SECONDS = 0.72;
  let broadViewResetArmed = true;
  let broadViewResetStableSeconds = 0;
  let broadViewResetCount = 0;

  let focusZoomTarget = 1;
  let focusZoomCurrent = 1;
  let focusPinchDistance = null;
  // Empty-space exploration moves the complete camera rig through the 3D
  // scene. Separate camera/focus offsets let a clicked region become centred
  // while the viewer physically advances toward it; distance is never inferred
  // from an optical zoom or from a fixed amount added per click.
  const freeExploreCameraOffsetTarget = new THREE.Vector3();
  const freeExploreCameraOffsetCurrent = new THREE.Vector3();
  const freeExploreFocusOffsetTarget = new THREE.Vector3();
  const freeExploreFocusOffsetCurrent = new THREE.Vector3();
  const exploreRayDirection = new THREE.Vector3();
  const exploreBaseFocus = new THREE.Vector3();
  const exploreBaseCamera = new THREE.Vector3();
  const exploreDesiredCamera = new THREE.Vector3();
  const exploreDesiredFocus = new THREE.Vector3();
  const sphericalCameraOffset = new THREE.Vector3();
  const cameraDistanceEarthPosition = new THREE.Vector3();
  // Reused projection vectors prevent short-lived garbage-collection spikes in
  // the animation loop and pointer hover path.
  const heliocentricWorldPosition = new THREE.Vector3();
  const solarWorldPosition = new THREE.Vector3();
  const connectorProjectedPosition = new THREE.Vector3();
  const focusedLocatorWorldPosition = new THREE.Vector3();
  const focusedLocatorProjectedPosition = new THREE.Vector3();
  const radiusWorldPosition = new THREE.Vector3();
  const pointerProjectedPosition = new THREE.Vector3();
  const pointerWorldPosition = new THREE.Vector3();
  const hoverWorldPosition = new THREE.Vector3();
  const hoverProjectedPosition = new THREE.Vector3();
  let hasExploredFreeSpace = false;
  let freeExploreDistanceReference = null;
  let freeExploreDistanceResetTimer = null;
  let spaceDiveModeUntil = 0;
  let hoveredCelestialBody = null;
  let celestialHoverTimer = null;
  let celestialHoverFramePending = false;
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
  let isAboutExperienceOpen = false;
  const cameraFocusPoint = new THREE.Vector3();
  const targetFocusPoint = new THREE.Vector3();

  // AmbientLight illuminates every surface equally so shadowed sides are not pure black.
  scene.add(new THREE.AmbientLight(0x8da1c6, 0.16));

  // A cool DirectionalLight adds readable edge detail from a consistent direction.
  const fillLight = new THREE.DirectionalLight(0x8bdcff, 0.32);
  fillLight.position.set(-50, 40, 90);
  scene.add(fillLight);

  // A neutral fill reveals C/S/M composition while inspecting an asteroid.
  // It is restricted to the dedicated asteroid-inspection layer, so the many
  // surrounding belt rocks do not brighten and darken as the camera moves. An
  // ambient fill is intentionally used here: the Sun still supplies shape and
  // shadows, while the stable fill removes rapid facet-to-facet light flicker.
  const asteroidInspectionLight = new THREE.AmbientLight(0xe8f1ff, 0.46);
  asteroidInspectionLight.layers.set(ASTEROID_INSPECTION_LAYER);
  asteroidInspectionLight.visible = false;
  scene.add(asteroidInspectionLight);

  // Asset loading is isolated so scene setup only consumes a ready texture dictionary.
  const preferredAnisotropy = creationQuality === "high"
    ? 8
    : creationQuality === "medium"
      ? 4
      : 2;
  const textures = await loadUniverseTextures({
    anisotropy: Math.min(renderer.capabilities.getMaxAnisotropy(), preferredAnisotropy),
  });

  // The star module owns the Sun's surface, atmosphere, corona, flares, and light.
  const sun = createSun({
    world,
    hoverTargets,
    texture: textures.sun,
    quality: creationQuality,
  });

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
      quality: creationQuality,
    });
  });

  const earth = planets.find((planet) => planet.name === "Earth");
  const earthRadius = earth.userData.visualRadius ?? 1.25;

  // Earth is layered like an onion: solid globe, cloud shell, atmospheric glow,
  // and optional light shell. Small radius differences avoid z-fighting.
  const earthLayerSegments = creationQuality === "low"
    ? 64
    : creationQuality === "medium"
      ? 80
      : 96;
  const earthClouds = new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.028, earthLayerSegments, earthLayerSegments),
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
    new THREE.SphereGeometry(earthRadius * 1.044, earthLayerSegments, earthLayerSegments),
    new THREE.MeshBasicMaterial({ color: 0x5bdcff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
  );
  earth.add(earthAtmosphere);

  if (textures.earthLights) {
    // Additive blending makes bright city pixels glow over the globe underneath.
    const earthLights = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius * 1.012, earthLayerSegments, earthLayerSegments),
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
  const { moon, moonPivot } = createMoonSystem({
    earth,
    textures,
    hoverTargets,
    quality: creationQuality,
  });

  // Mars and the giant planets share one reusable major-satellite builder. The
  // moon meshes keep scientific diameter ordering while using a readable,
  // compressed scale for this cinematic experience.
  const majorSatelliteSystems = createMajorSatelliteSystems({
    world,
    planets,
    hoverTargets,
    quality: creationQuality,
  });

  // Space is a distant celestial sphere rather than a nearby cloud of coloured
  // particles. The environment owns steady stars, the tilted Milky Way, cloudy
  // galactic light, and its dark interstellar dust lanes.
  const spaceEnvironment = new SpaceEnvironment({
    scene,
    camera,
    renderer,
    quality: creationQuality,
    pixelRatio: cinematicPixelRatio,
  });
  await spaceEnvironment.init();

  // The DOM-based project transmission announces its state so this WebGL
  // director can truly freeze the universe behind the blurred information card.
  addEventListener("beyond-earth:about-state", (event) => {
    isAboutExperienceOpen = Boolean(event.detail?.open);
    spaceEnvironment.setPaused(!isPageVisible || isAboutExperienceOpen);
    if (isAboutExperienceOpen) {
      isDragging = false;
      clearCelestialHover();
      if (activeDistanceInfo && distanceUnitPopover && !distanceUnitPopover.hidden) {
        closeDistanceInfoPopover({ resumeJourneyImmediately: true });
      }
    } else {
      // Ignore time spent reading so orbital bodies cannot jump on resume.
      clock.getDelta();
    }
  });

  // Asteroid meshes provide nearby shape; dust points cheaply supply density.
  const asteroidBelt = createAsteroidBelt({
    world,
    hoverTargets,
    quality: creationQuality,
  });
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
    if (travel.basis === "camera-position") {
      return {
        eyebrow: "How this distance is measured",
        title: "Camera position relative to Earth",
        summary: "Camera-to-Earth scene position",
        description: "The current scroll scale calibrates the Three.js scene to a readable scientific distance. After a region is selected, the value follows the camera’s resulting 3D position relative to Earth instead of adding or subtracting a fixed amount for each click.",
        equivalent: `Current display: ${formatted.primary} from Earth · Region: ${travel.region}.`,
      };
    }

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

    const scrollTravel = interpolateCameraDistanceFromEarth(progress);
    let travel = scrollTravel;
    if (freeExploreDistanceReference) {
      earth.getWorldPosition(cameraDistanceEarthPosition);
      const cameraSceneDistance = camera.position.distanceTo(cameraDistanceEarthPosition);
      const cameraKilometres = cameraSceneDistance
        * freeExploreDistanceReference.kilometresPerSceneUnit;
      travel = {
        ...scrollTravel,
        kilometres: cameraKilometres,
        region: `Selected region · ${getEarthDistanceRegion(cameraKilometres)}`,
        basis: "camera-position",
      };
    }
    const formatted = formatEarthDistance(travel.kilometres);
    const progressDelta = progress - previousDistanceProgress;
    setDistanceText(distanceValueLabel, `${formatted.primary} from Earth`);
    setDistanceText(distanceSecondaryLabel, formatted.secondary);
    distanceRegionLabel.textContent = travel.region;
    if (distanceRangeLabel) distanceRangeLabel.hidden = true;

    if (distanceModeLabel) {
      if (elapsedTime < spaceDiveModeUntil) {
        distanceModeLabel.textContent = "Diving into region";
      }
      else if (progressDelta > 0.00008) distanceModeLabel.textContent = "Moving outward";
      else if (progressDelta < -0.00008) distanceModeLabel.textContent = "Returning inward";
      else distanceModeLabel.textContent = "Camera position";
    }

    updateDistanceMeasurementContext({
      units: collectDistanceUnitKeys(formatted.primary, formatted.secondary),
      measurementInfo: createCameraMeasurementInfo(travel, formatted),
      fingerprint: `camera:${travel.basis ?? "scroll"}:${travel.region}:${formatted.primaryUnit}`,
    });
    previousDistanceProgress = progress;
  }


  /*
    updateScrollProgress
    - Updates normalized journey progress. The distance readout follows the
      smoothed camera progress inside the animation loop.
  */
  function updateScrollProgress() {
    if (isJourneyScrollLocked || suppressJourneyScrollSync || focusExitTransition) return;
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
  }

  function getCameraDistance(progress) {
    // smoothstep-like easing: slow at both ends, faster through the middle.
    const eased = progress * progress * (3 - 2 * progress);
    // lerp(a, b, t) returns a at t=0, b at t=1, and blends between them.
    return THREE.MathUtils.lerp(4.8, 2550, eased);
  }

  /** Converts the current yaw/pitch into the camera offset used by the journey. */
  function setSphericalCameraOffset(target, distance) {
    target.set(
      Math.cos(pitch) * Math.sin(yaw) * distance,
      Math.sin(pitch) * distance * 0.64,
      Math.cos(pitch) * Math.cos(yaw) * distance,
    );
    return target;
  }

  /** Uses the focused body's physical region when inspection overrides scroll. */
  function getEnvironmentJourneyProgress() {
    if (!focusedBody) return smoothProgress;

    const bodyName = String(focusedBody.userData?.name ?? focusedBody.name ?? "").toLowerCase();
    const bodyType = String(focusedBody.userData?.info?.type ?? "").toLowerCase();
    const parentPlanet = String(focusedBody.userData?.parentPlanet ?? "").toLowerCase();
    let regionalProgress = smoothProgress;

    if (parentPlanet && JOURNEY_MAP[parentPlanet] != null) regionalProgress = JOURNEY_MAP[parentPlanet];
    else if (bodyName.includes("sun")) regionalProgress = JOURNEY_MAP.sun;
    else if (bodyName.includes("mercury")) regionalProgress = JOURNEY_MAP.mercury;
    else if (bodyName.includes("venus")) regionalProgress = JOURNEY_MAP.venus;
    else if (bodyName.includes("earth")) regionalProgress = JOURNEY_MAP.earth;
    else if (bodyName.includes("moon")) regionalProgress = JOURNEY_MAP.moon;
    else if (bodyName.includes("mars")) regionalProgress = JOURNEY_MAP.mars;
    else if (bodyName.includes("jupiter")) regionalProgress = JOURNEY_MAP.jupiter;
    else if (bodyName.includes("saturn")) regionalProgress = JOURNEY_MAP.saturn;
    else if (bodyName.includes("uranus")) regionalProgress = JOURNEY_MAP.uranus;
    else if (bodyName.includes("neptune")) regionalProgress = JOURNEY_MAP.neptune;
    else if (bodyName.includes("pluto")) regionalProgress = JOURNEY_MAP.pluto;
    else if (
      bodyType.includes("asteroid")
      || bodyName.includes("asteroid")
      || bodyName.includes("family")
    ) {
      regionalProgress = JOURNEY_MAP.asteroidBelt;
    }

    const focusedDistance = getFocusedBaseDistance(focusedBody) * focusZoomCurrent;
    const wideBlend = THREE.MathUtils.smoothstep(
      focusedDistance / MAX_CINEMATIC_CAMERA_DISTANCE,
      0.22,
      0.82,
    );
    return THREE.MathUtils.lerp(regionalProgress, 1, wideBlend);
  }

  /*
    getFocusPoint
    - Introduces the journey beside Earth, then keeps free flight centred on the Sun.
    - The opening Earth target is a one-way hand-off until the explicit return action.
  */
  function getFocusPoint(distance, target) {
    // getWorldPosition is important for nested bodies such as the Moon because
    // their local `.position` is relative to a moving parent.
    if (focusedBody) return focusedBody.getWorldPosition(target);

    if (!hasLeftOpeningEarthView && distance >= EARTH_OPENING_RELEASE_DISTANCE) {
      hasLeftOpeningEarthView = true;
    }
    if (!hasLeftOpeningEarthView) return earth.getWorldPosition(target);

    // Read the Sun's actual world transform instead of assuming it will always
    // remain at (0, 0, 0). This keeps the camera rule correct if the scene root
    // is repositioned later.
    return sun.system.getWorldPosition(target);
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
  const MAX_CINEMATIC_CAMERA_DISTANCE = 2550;
  let currentSunAngularRadius = 0;
  let currentSunProjectedRadiusPixels = Infinity;
  let snapSunApparentScaleOnNextFrame = true;

  // Apply the single cinematic profile once. No runtime tier, DPR, or update
  // cadence changes are allowed after initialisation.
  spaceEnvironment.setQuality("high");
  spaceEnvironment.resize(innerWidth, innerHeight, cinematicPixelRatio);
  setAsteroidBeltQuality(asteroidBelt, "high", cinematicPixelRatio);
  setSunPerformanceProfile(sun, "high", {
    projectedRadiusPixels: currentSunProjectedRadiusPixels,
    focused: false,
  });

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
      orbitalBody.getWorldPosition(heliocentricWorldPosition);
      sun.system.getWorldPosition(solarWorldPosition);
      const currentSceneRadius = heliocentricWorldPosition.distanceTo(solarWorldPosition);
      return semiMajorAU * currentSceneRadius / sceneSemiMajor;
    }

    return semiMajorAU;
  }

  const SUN_OBSERVER_DISTANCE_ANCHORS = Object.freeze([
    { sceneRadius: PLANET_SCALE_PROFILES.Mercury.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Mercury },
    { sceneRadius: PLANET_SCALE_PROFILES.Venus.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Venus },
    { sceneRadius: PLANET_SCALE_PROFILES.Earth.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Earth },
    { sceneRadius: PLANET_SCALE_PROFILES.Mars.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Mars },
    { sceneRadius: PLANET_SCALE_PROFILES.Jupiter.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Jupiter },
    { sceneRadius: PLANET_SCALE_PROFILES.Saturn.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Saturn },
    { sceneRadius: PLANET_SCALE_PROFILES.Uranus.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Uranus },
    { sceneRadius: PLANET_SCALE_PROFILES.Neptune.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Neptune },
    { sceneRadius: PLANET_SCALE_PROFILES.Pluto.orbitRadius, au: HELIOCENTRIC_ORBIT_AU.Pluto },
  ]);

  function frameAdjustedEase(baseFactor, deltaSeconds) {
    const clampedFactor = THREE.MathUtils.clamp(baseFactor, 0, 1);
    return 1 - Math.pow(1 - clampedFactor, Math.max(0, deltaSeconds) * 60);
  }

  /**
   * Converts the cinematic scene radius into an observer distance in AU.
   *
   * The scene compresses the real Solar System, so a simple linear conversion
   * would make the Sun jump in size between regions. Piecewise interpolation
   * through the authored orbit radii preserves the correct order and gives a
   * gentle, continuous increase in apparent solar size while travelling inward.
   * Distances beyond Pluto intentionally remain at Pluto's 39.482 AU view so
   * Pluto and the maximum zoom-out boundary show the same tiny solar star.
   */
  function getFreeFlightObserverAU() {
    sun.system.getWorldPosition(solarWorldPosition);
    const sceneRadius = camera.position.distanceTo(solarWorldPosition);
    const first = SUN_OBSERVER_DISTANCE_ANCHORS[0];
    const last = SUN_OBSERVER_DISTANCE_ANCHORS[SUN_OBSERVER_DISTANCE_ANCHORS.length - 1];

    if (sceneRadius <= first.sceneRadius) {
      const inwardRatio = THREE.MathUtils.clamp(sceneRadius / first.sceneRadius, 0.16, 1);
      return Math.max(0.062, first.au * inwardRatio);
    }

    for (let index = 1; index < SUN_OBSERVER_DISTANCE_ANCHORS.length; index += 1) {
      const lower = SUN_OBSERVER_DISTANCE_ANCHORS[index - 1];
      const upper = SUN_OBSERVER_DISTANCE_ANCHORS[index];
      if (sceneRadius <= upper.sceneRadius) {
        const ratio = THREE.MathUtils.clamp(
          (sceneRadius - lower.sceneRadius) / Math.max(0.0001, upper.sceneRadius - lower.sceneRadius),
          0,
          1,
        );
        // Logarithmic interpolation better matches the gradual angular-size
        // change across the very wide AU range than a straight numeric lerp.
        return Math.exp(THREE.MathUtils.lerp(Math.log(lower.au), Math.log(upper.au), ratio));
      }
    }

    return last.au;
  }

  function getCurrentObserverHeliocentricAU() {
    if (focusedBody) {
      const focusedName = String(focusedBody.userData?.name ?? focusedBody.name ?? '').toLowerCase();
      if (focusedName.includes('sun')) return null;
      return getBodyHeliocentricAU(focusedBody) ?? getFreeFlightObserverAU();
    }
    return getFreeFlightObserverAU();
  }

  function updateSunApparentScale(deltaSeconds = 1 / 60) {
    const focusedName = String(focusedBody?.userData?.name ?? focusedBody?.name ?? '').toLowerCase();
    const isSunFocused = focusedName.includes('sun');
    // Escape keeps the selected object alive while the camera glides back to its
    // saved journey pose. The Sun should nevertheless begin shrinking during
    // that glide instead of remaining at inspection size until the last frame.
    const isActiveSunInspection = isSunFocused && !focusExitTransition;
    const observerAU = isSunFocused && focusExitTransition
      ? getFreeFlightObserverAU()
      : getCurrentObserverHeliocentricAU();
    sun.system.getWorldPosition(solarWorldPosition);
    const cameraToSun = Math.max(1, camera.position.distanceTo(solarWorldPosition));
    const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);

    let targetScale = 1;
    if (!isActiveSunInspection && Number.isFinite(observerAU) && observerAU > 0) {
      const realDistanceKm = observerAU * ASTRONOMICAL_UNIT_KM;
      const angularRadius = Math.atan(SUN_RADIUS_KM / realDistanceKm);
      // Resize the world-space model so its projected disk keeps the real solar
      // angle from the selected planet. This also remains valid when the viewer
      // pulls far back while keeping that planet selected; the Sun never falls
      // back into an invisible sub-pixel point at the wide-focus boundary.
      const apparentRadius = Math.tan(angularRadius) * cameraToSun;
      targetScale = THREE.MathUtils.clamp(
        apparentRadius / SUN_BASE_VISUAL_RADIUS,
        0.0011,
        1,
      );
    }

    const currentScale = sun.system.scale.x;
    const scaleEase = isActiveSunInspection ? 0.22 : focusExitTransition ? 0.16 : 0.085;
    const nextScale = snapSunApparentScaleOnNextFrame
      ? targetScale
      : THREE.MathUtils.lerp(
        currentScale,
        targetScale,
        frameAdjustedEase(scaleEase, deltaSeconds),
      );
    snapSunApparentScaleOnNextFrame = false;
    sun.system.scale.setScalar(nextScale);

    const apparentWorldRadius = SUN_BASE_VISUAL_RADIUS * nextScale;
    currentSunAngularRadius = Math.asin(
      THREE.MathUtils.clamp(apparentWorldRadius / cameraToSun, 0, 0.999),
    );
    spaceEnvironment.setSunAngularRadius(currentSunAngularRadius);

    const projectedRadiusPixels = (apparentWorldRadius / cameraToSun)
      / Math.max(0.0001, Math.tan(halfFov))
      * innerHeight * 0.5;
    currentSunProjectedRadiusPixels = projectedRadiusPixels;

    const worldUnitsPerPixel = 2 * cameraToSun * Math.tan(halfFov) / Math.max(1, innerHeight);
    const focusCameraDistance = camera.position.distanceTo(cameraFocusPoint);
    const freeFlightZoomRatio = smoothProgress;
    const focusedZoomRatio = focusedBody
      ? focusCameraDistance / MAX_CINEMATIC_CAMERA_DISTANCE
      : 0;
    const activeZoomRatio = focusedBody ? focusedZoomRatio : freeFlightZoomRatio;
    const maximumZoomBlend = isActiveSunInspection
      ? 0
      : THREE.MathUtils.smoothstep(
        activeZoomRatio,
        0.91,
        0.995,
      );

    const isPlanetaryInspection = Boolean(focusedBody && !isSunFocused);

    // The ordinary white solar halo remains present from every viewpoint.
    // Planet inspection now receives a brighter photographic bloom so sunlight
    // still feels powerful from that world's sky. This sprite is not part of
    // hoverTargets, so the larger radiance never enlarges the Sun's hit area.
    const steadyGlowPixels = isPlanetaryInspection ? 88 : 56;
    const maximumGlowPixels = THREE.MathUtils.lerp(steadyGlowPixels, 148, maximumZoomBlend);
    const targetGlowWorldSize = Math.max(
      apparentWorldRadius * 2.56,
      maximumGlowPixels * worldUnitsPerPixel,
    );
    const localGlowSize = targetGlowWorldSize / Math.max(nextScale, 0.0001);
    const glowPulse = 1 + Math.sin(elapsedTime * 0.72) * 0.018;
    sun.glow.visible = true;
    sun.glow.scale.set(localGlowSize * glowPulse, localGlowSize * glowPulse, 1);
    sun.glow.material.opacity = THREE.MathUtils.clamp(
      0.13
        + (isPlanetaryInspection ? 0.105 : 0)
        + maximumZoomBlend * 0.24
        + Math.sin(elapsedTime * 0.91) * 0.008,
      0.105,
      0.5,
    );
    sun.glow.material.depthTest = true;
    sun.glow.renderOrder = 0;

    // The diffraction sprite adds emitted radiance around the physical disk; it
    // never replaces or enlarges the clickable photosphere. An unresolved Sun
    // receives the full effect, while planetary inspection keeps a restrained
    // version visible even when the disk itself is several pixels wide.
    const unresolvedStarBlend = 1
      - THREE.MathUtils.smoothstep(projectedRadiusPixels, 0.75, 3.2);
    const planetaryRadianceBlend = isPlanetaryInspection
      ? THREE.MathUtils.lerp(
        0.72,
        0.96,
        1 - THREE.MathUtils.smoothstep(projectedRadiusPixels, 3, 28),
      )
      : 0;
    const radianceBlend = isActiveSunInspection
      ? 0
      : Math.max(unresolvedStarBlend, planetaryRadianceBlend);
    if (sun.distantStar) {
      const twinkle = Math.sin(elapsedTime * 3.2) * 0.055
        + Math.sin(elapsedTime * 7.1 + 1.4) * 0.032;
      const maximumTwinkle = Math.sin(elapsedTime * 4.6) * 0.12
        + Math.sin(elapsedTime * 9.7 + 0.8) * 0.065;
      const starPulse = 1
        + twinkle * (isPlanetaryInspection ? 0.38 : 0.22)
        + maximumTwinkle * maximumZoomBlend * 0.36;
      // A focused planet sees an 88–118 px starburst. Larger apparent solar
      // disks use the smaller end of that range, while distant planets receive
      // longer rays so the unresolved Sun still reads as the system's star.
      const planetaryStarPixels = THREE.MathUtils.lerp(
        118,
        88,
        THREE.MathUtils.smoothstep(projectedRadiusPixels, 2, 30),
      );
      const starPixelSize = Math.max(
        THREE.MathUtils.lerp(30, 92, maximumZoomBlend),
        isPlanetaryInspection ? planetaryStarPixels : 0,
      ) * starPulse;
      const starWorldSize = starPixelSize * worldUnitsPerPixel;
      const localStarSize = starWorldSize / Math.max(nextScale, 0.0001);

      sun.distantStar.visible = radianceBlend > 0.012;
      sun.distantStar.scale.set(localStarSize, localStarSize, 1);
      sun.distantStar.material.opacity = THREE.MathUtils.clamp(
        radianceBlend * (
          0.8
          + (isPlanetaryInspection ? 0.16 : 0)
          + maximumZoomBlend * 0.18
          + twinkle * 0.38
          + maximumTwinkle * maximumZoomBlend
        ),
        0,
        1,
      );
      // Fixed diffraction orientation prevents the distant Sun from appearing
      // to revolve around a focused planet. Brightness and size create twinkle.
      sun.distantStar.material.rotation = 0;
      sun.distantStar.material.depthTest = true;
      sun.distantStar.renderOrder = 8;
    }

    setSunPerformanceProfile(sun, "high", {
      projectedRadiusPixels,
      focused: isSunFocused,
    });
  }

  /**
   * Restores the authored broad Solar-System transforms deterministically.
   *
   * The Sun is temporarily reduced while inspecting distant planets and moons
   * to reproduce its smaller apparent angular size. That temporary scale must
   * never survive after focus closes. Keeping this reset independent from the
   * runtime quality controller prevents a delayed task or quality transition
   * from leaving a shrunken Sun beside a normal-sized gas giant.
   */
  function restoreBroadSolarSystemScale() {
    // Planet inspection may temporarily modify visual transforms, but the Sun
    // now derives its apparent size continuously from the observer's AU. Do not
    // force it to the authored close-up scale when leaving focus.
    snapSunApparentScaleOnNextFrame = true;

    planets.forEach((planet) => {
      planet.scale.setScalar(1);
      delete planet.userData.solarOverlapScale;
      planet.updateMatrixWorld(true);
    });
  }

  /**
   * Clears all temporary runtime state at the fully zoomed-out boundary while
   * preserving the exact visible camera pose and ongoing orbital simulation.
   * This is intentionally a soft reload: GPU state, adaptive sampling, focus,
   * hover, scroll locks and UI transients are rebuilt, but assets are not fetched
   * again and the user never sees a loader, flash or camera jump.
   */
  function performSeamlessBroadViewReset() {
    if (!broadViewResetArmed || focusedBody || focusExitTransition) return false;

    const preservedCameraPosition = camera.position.clone();
    const preservedCameraQuaternion = camera.quaternion.clone();
    const preservedCameraFocus = cameraFocusPoint.clone();
    const preservedFov = camera.fov;
    const maximumScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);

    // Remove every inspection state and any partially completed transition.
    if (focusedBody) {
      setAsteroidFocusAppearance(focusedBody, false);
      setAsteroidInspectionDetail(focusedBody, false);
    }
    focusedBody = null;
    displayedBody = null;
    focusNavigationHistory.length = 0;
    focusExitTransition = null;
    suppressJourneyScrollSync = false;
    focusZoomTarget = 1;
    focusZoomCurrent = 1;
    focusPinchDistance = null;
    focusedBodyLocator.visible = false;
    focusedBodyLocator.material.opacity = 0;
    asteroidInspectionLight.visible = false;

    clearCelestialHover();
    if (celestialHoverTimer) {
      clearTimeout(celestialHoverTimer);
      celestialHoverTimer = null;
    }
    celestialHoverFramePending = false;
    pointerDownCelestialBody = null;
    dragDistance = 0;
    isDragging = false;
    targetYaw = yaw;
    targetPitch = pitch;

    setBodyCardCollapsed(false);
    updateBodyCard(null);
    activeDistanceInfo = null;
    distancePopoverTouchY = null;
    distancePopoverOwnsJourneyLock = false;
    distanceCinematicPanel?.close();

    // Remove any stale fixed-page state left by an interrupted focus transition.
    const staleSnapshot = journeyScrollSnapshot;
    document.documentElement.classList.remove("is-celestial-focus", "is-focus-exit-restoring");
    document.body.classList.remove(
      "is-celestial-focus",
      "is-hovering-asteroid",
      "is-hovering-celestial",
    );
    if (staleSnapshot) {
      document.documentElement.style.overflow = staleSnapshot.htmlOverflow;
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.position = staleSnapshot.bodyPosition;
      document.body.style.top = staleSnapshot.bodyTop;
      document.body.style.left = staleSnapshot.bodyLeft;
      document.body.style.right = staleSnapshot.bodyRight;
      document.body.style.width = staleSnapshot.bodyWidth;
      document.body.style.overflow = staleSnapshot.bodyOverflow;
      document.body.style.paddingRight = staleSnapshot.bodyPaddingRight;
    }
    isJourneyScrollLocked = false;
    journeyScrollSnapshot = null;

    // Canonicalise the journey boundary. The camera is then rebased as offsets
    // from that canonical pose so its current pixels remain exactly unchanged.
    scrollProgress = 1;
    smoothProgress = 1;
    previousDistanceProgress = 1;
    forceJourneyScrollPosition(maximumScroll);

    const broadDistance = getCameraDistance(1);
    getFocusPoint(broadDistance, exploreBaseFocus);
    setSphericalCameraOffset(sphericalCameraOffset, broadDistance);
    exploreBaseCamera.copy(exploreBaseFocus).add(sphericalCameraOffset);
    freeExploreCameraOffsetCurrent.copy(preservedCameraPosition).sub(exploreBaseCamera);
    freeExploreCameraOffsetTarget.copy(freeExploreCameraOffsetCurrent);
    freeExploreFocusOffsetCurrent.copy(preservedCameraFocus).sub(exploreBaseFocus);
    freeExploreFocusOffsetTarget.copy(freeExploreFocusOffsetCurrent);
    hasExploredFreeSpace = freeExploreCameraOffsetCurrent.lengthSq() > 0.0001
      || freeExploreFocusOffsetCurrent.lengthSq() > 0.0001;
    freeExploreDistanceReference = null;
    if (freeExploreDistanceResetTimer) {
      clearTimeout(freeExploreDistanceResetTimer);
      freeExploreDistanceResetTimer = null;
    }

    camera.position.copy(preservedCameraPosition);
    camera.quaternion.copy(preservedCameraQuaternion);
    cameraFocusPoint.copy(preservedCameraFocus);
    targetFocusPoint.copy(preservedCameraFocus);
    hasCameraFocusPoint = true;
    camera.fov = preservedFov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    // Restore authored broad-view transforms and flush cached WebGL state.
    restoreBroadSolarSystemScale();
    updateMajorSatelliteVisibility({
      systems: majorSatelliteSystems,
      camera,
      viewportHeight: innerHeight,
      focusedBody: null,
      hoveredBody: null,
    });

    const pixelRatio = resizeCinematicRenderer();
    spaceEnvironment.setQuality("high");
    spaceEnvironment.resize(innerWidth, innerHeight, pixelRatio);
    spaceEnvironment.setJourneyProgress(1);
    setAsteroidBeltQuality(asteroidBelt, "high", pixelRatio);

    renderer.setRenderTarget(null);
    renderer.renderLists?.dispose?.();
    renderer.info.reset();
    renderer.resetState?.();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    // Restore the authored scroll-behaviour only after the position is pinned.
    requestAnimationFrame(() => {
      forceJourneyScrollPosition(maximumScroll);
      document.documentElement.style.scrollBehavior = staleSnapshot?.htmlScrollBehavior ?? "";
    });

    broadViewResetArmed = false;
    broadViewResetStableSeconds = 0;
    broadViewResetCount += 1;
    updateDistanceReadout(1);
    return true;
  }

  /** Runs the soft reset once after the outer view has remained stable. */
  function updateSeamlessBroadViewReset(deltaSeconds) {
    const travelledInward = scrollProgress < BROAD_VIEW_RESET_REARM_PROGRESS
      || smoothProgress < BROAD_VIEW_RESET_REARM_PROGRESS;
    if (focusedBody || focusExitTransition || travelledInward) {
      broadViewResetArmed = true;
      broadViewResetStableSeconds = 0;
      return;
    }

    const isAtOuterBoundary = scrollProgress >= BROAD_VIEW_RESET_ENTER_PROGRESS
      && smoothProgress >= BROAD_VIEW_RESET_ENTER_PROGRESS;
    const interactionIsIdle = !isDragging
      && !hoveredCelestialBody
      && !isJourneyScrollLocked
      && !suppressJourneyScrollSync;

    if (!broadViewResetArmed || !isAtOuterBoundary || !interactionIsIdle) {
      broadViewResetStableSeconds = 0;
      return;
    }

    broadViewResetStableSeconds += Math.max(0, deltaSeconds);
    if (broadViewResetStableSeconds >= BROAD_VIEW_RESET_STABLE_SECONDS) {
      performSeamlessBroadViewReset();
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
    cardHint.textContent = "Journey paused · Drag to orbit · Pull back to the outer boundary · Click another body or space to leave";
  }

  /** Projects a 3D world position into 2D pixels and points the line at the body. */
  function updateBodyConnector(body) {
    if (!body || isBodyCardCollapsed || innerWidth <= 760) {
      bodyConnector.classList.remove("is-visible");
      return;
    }

    const projected = body.getWorldPosition(connectorProjectedPosition).project(camera);
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
    // Satellite pointer proxies are deliberately kept outside irregular moon
    // meshes so they remain spherical. Resolve the invisible proxy directly to
    // the visible satellite before walking the normal scene hierarchy.
    if (object?.userData?.interactionOwner) {
      return object.userData.interactionOwner;
    }
    // Raycasting may hit a child such as an atmosphere or ring. Walking through
    // `.parent` finds the first ancestor carrying our identifying metadata.
    while (object) {
      if (object.userData?.interactionOwner) return object.userData.interactionOwner;
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

    const worldPosition = focusedBody.getWorldPosition(focusedLocatorWorldPosition);
    const projected = focusedLocatorProjectedPosition.copy(worldPosition).project(camera);
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
    return type === "star" || type === "planet" || type === "dwarf planet" || type === "natural satellite";
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

  function getAsteroidEncounterIntensity() {
    return THREE.MathUtils.clamp(Number(asteroidBelt?.encounterIntensity ?? 0), 0, 1);
  }

  function getJovianEncounterIntensity() {
    return getJovianSatelliteEncounterIntensity({
      systems: majorSatelliteSystems,
      camera,
      viewportHeight: innerHeight,
      focusedBody,
    });
  }

  function projectedBodyRadiusPixels(body) {
    if (!body) return 0;
    const worldPosition = body.getWorldPosition(radiusWorldPosition);
    const cameraDistance = Math.max(0.0001, camera.position.distanceTo(worldPosition));

    // The Sun changes scale with observer distance. Its current projected disk
    // is already calculated by the solar renderer, so use that exact radius for
    // hover and click testing instead of its large authored close-up radius.
    if (getInteractiveType(body) === "star"
      && Number.isFinite(currentSunProjectedRadiusPixels)) {
      return Math.max(0, currentSunProjectedRadiusPixels);
    }

    const visualRadius = Number(
      body.userData?.visualRadius
      ?? body.userData?.focusVisualRadius
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
    const projected = pointerProjectedPosition;

    candidates.forEach((body) => {
      const worldPosition = body.getWorldPosition(pointerWorldPosition);
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
      const typeBias = type === "natural satellite" ? -2 : (type === "planet" || type === "dwarf planet") ? -1 : 0;
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
    const projected = body.getWorldPosition(pointerProjectedPosition).project(camera);
    if (projected.z < -1 || projected.z > 1) return false;
    const dx = (projected.x - pointer.x) * innerWidth * 0.5;
    const dy = (projected.y - pointer.y) * innerHeight * 0.5;
    const radiusPixels = projectedBodyRadiusPixels(body);
    return radiusPixels > 0.15 && Math.hypot(dx, dy) <= radiusPixels + extraPixels;
  }

  function isPointerStillOnHoveredBody(body) {
    if (!body) return false;
    const worldPosition = body.getWorldPosition(pointerWorldPosition);
    const projected = pointerProjectedPosition.copy(worldPosition).project(camera);
    if (projected.z < -1 || projected.z > 1) return false;

    const dx = (projected.x - pointer.x) * innerWidth * 0.5;
    const dy = (projected.y - pointer.y) * innerHeight * 0.5;
    const distancePixels = Math.hypot(dx, dy);
    const radiusPixels = projectedBodyRadiusPixels(body);

    if (isAsteroidBody(body)) {
      // Keep the selected rock stable, but do not let a large invisible cushion
      // trap the cursor on an older neighbour in a dense belt region.
      const encounterAssist = THREE.MathUtils.lerp(5.5, 11.5, getAsteroidEncounterIntensity());
      return distancePixels <= THREE.MathUtils.clamp(
        radiusPixels + encounterAssist,
        7,
        20,
      );
    }

    // Jupiter's dense catalogue needs a tighter release radius than the other
    // satellite systems. A 14-pixel sticky region on 115 neighbouring moons
    // would make the green locator jump between overlapping invisible targets.
    if (body.userData?.isJovianSatellite) {
      const tier = body.userData?.interactionTier ?? "background";
      const satelliteAssist = tier === "direct"
        ? (radiusPixels >= 10 ? 4 : radiusPixels >= 3 ? 7 : 9)
        : tier === "notable"
          ? (radiusPixels >= 4 ? 5 : 7)
          : (radiusPixels >= 2 ? 3.5 : 5.5);
      const maximumReleaseRadius = tier === "direct" ? 18 : tier === "notable" ? 13 : 9.5;
      return distancePixels <= Math.min(
        radiusPixels + satelliteAssist,
        maximumReleaseRadius,
      );
    }

    // Other non-lunar major satellites remain deliberately easy to hold after
    // acquisition because their systems contain only a small number of moons.
    if (body.userData?.isSatellite && body.userData?.name !== "Moon") {
      const satelliteAssist = radiusPixels >= 12 ? 5 : radiusPixels >= 4 ? 9 : 14;
      return distancePixels <= radiusPixels + satelliteAssist;
    }

    // For planets, stars and Earth's Moon, stay close to the visible silhouette.
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
    // Reading a distance explanation no longer disables discovery in the 3D
    // scene. Moving outside the card can still reveal the green target and its
    // hover label, preparing the exact body the user may click next.
    if (isDragging || lastPointerType === "touch") {
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

    // Jupiter's full 115-moon system uses a dedicated visibility-aware search.
    // Only the eight resolved regular moons own direct pointer proxies; notable
    // and distant irregular moons become selectable progressively as the camera
    // enters Jupiter's local system. This avoids 115 overlapping hidden spheres.
    const nearbyJovianSatellite = findNearestJovianSatelliteAtPointer({
      systems: majorSatelliteSystems,
      pointer,
      camera,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      focusedBody,
    });
    if (nearbyJovianSatellite) {
      setCelestialHover(nearbyJovianSatellite);
      return;
    }

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

    const encounterIntensity = getAsteroidEncounterIntensity();
    const nearbyInstance = findNearestAsteroidInstanceAtPointer({
      meshes: asteroidBelt.instancedBoulders,
      pointer,
      camera,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      minimumVisibleRadiusPixels: THREE.MathUtils.lerp(0.20, 0.08, encounterIntensity),
      maximumPixelRadius: THREE.MathUtils.lerp(
        innerWidth <= 760 ? 15 : 11,
        innerWidth <= 760 ? 28 : 23,
        encounterIntensity,
      ),
      extraHitPixels: THREE.MathUtils.lerp(
        innerWidth <= 760 ? 5.5 : 4.0,
        innerWidth <= 760 ? 12.0 : 9.0,
        encounterIntensity,
      ),
      radiusMultiplier: THREE.MathUtils.lerp(1.42, 1.78, encounterIntensity),
      visibleRadiusPreference: THREE.MathUtils.lerp(0.10, 0.18, encounterIntensity),
    });
    setCelestialHover(nearbyInstance);
  }

  function scheduleCelestialHover() {
    if (celestialHoverTimer) {
      clearTimeout(celestialHoverTimer);
      celestialHoverTimer = null;
    }

    // Inside dense small-body regions (the asteroid belt or Jupiter's complete
    // moon system), the pointer may cross several tiny objects within a few
    // milliseconds. Coalesce those events into one scan on the next frame rather
    // than repeatedly restarting a timeout.
    if (getAsteroidEncounterIntensity() >= 0.12 || getJovianEncounterIntensity() >= 0.10) {
      if (celestialHoverFramePending) return;
      celestialHoverFramePending = true;
      requestAnimationFrame(() => {
        celestialHoverFramePending = false;
        if (!isDragging && lastPointerType !== "touch" && !hoveredCelestialBody) {
          findCelestialForHover();
        }
      });
      return;
    }

    celestialHoverTimer = setTimeout(() => {
      celestialHoverTimer = null;
      findCelestialForHover();
    }, CINEMATIC_HOVER_DELAY_MS);
  }

  function updateCelestialHoverVisual() {
    if (!hoveredCelestialBody || !asteroidHoverLocator.visible) return;

    // Bodies continue moving and the Sun can shrink even while the pointer is
    // stationary. Release a stale selection as soon as its live silhouette no
    // longer contains the cursor instead of waiting for another pointer event.
    if (!isPointerStillOnHoveredBody(hoveredCelestialBody)) {
      clearCelestialHover();
      if (lastPointerType !== "touch" && !isDragging) scheduleCelestialHover();
      return;
    }

    const worldPosition = hoveredCelestialBody.getWorldPosition(hoverWorldPosition);
    const projected = hoverProjectedPosition.copy(worldPosition).project(camera);
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
    const asteroidMarkerBoost = isAsteroidBody(hoveredCelestialBody)
      ? THREE.MathUtils.lerp(4, 11, getAsteroidEncounterIntensity())
      : 0;
    const baseMarkerPixels = THREE.MathUtils.clamp(
      bodyRadiusPixels * 2.5 + 24 + asteroidMarkerBoost,
      isAsteroidBody(hoveredCelestialBody) ? 34 : 27,
      isAsteroidBody(hoveredCelestialBody) ? 70 : 58,
    );
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

    // Use the same dense-system selector for pointerup that hover uses. This
    // preserves the selected Jovian moon even if it advances slightly between
    // pointermove and click, without letting an unseen irregular moon steal input.
    const nearbyJovianSatellite = findNearestJovianSatelliteAtPointer({
      systems: majorSatelliteSystems,
      pointer,
      camera,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      focusedBody,
    });
    if (nearbyJovianSatellite) return nearbyJovianSatellite;

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
    const encounterIntensity = getAsteroidEncounterIntensity();
    const visibleDirectAsteroid = bodies.find((body) => (
      isAsteroidBody(body)
      && projectedBodyRadiusPixels(body) >= THREE.MathUtils.lerp(
        innerWidth <= 760 ? 1.1 : 0.65,
        innerWidth <= 760 ? 0.72 : 0.42,
        encounterIntensity,
      )
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
      minimumVisibleRadiusPixels: THREE.MathUtils.lerp(
        innerWidth <= 760 ? 0.90 : 0.54,
        innerWidth <= 760 ? 0.48 : 0.26,
        encounterIntensity,
      ),
      maximumPixelRadius: THREE.MathUtils.lerp(
        innerWidth <= 760 ? 17 : 12,
        innerWidth <= 760 ? 28 : 22,
        encounterIntensity,
      ),
      extraHitPixels: THREE.MathUtils.lerp(
        innerWidth <= 760 ? 6.0 : 4.5,
        innerWidth <= 760 ? 12.0 : 8.5,
        encounterIntensity,
      ),
      radiusMultiplier: THREE.MathUtils.lerp(1.45, 1.72, encounterIntensity),
      visibleRadiusPreference: THREE.MathUtils.lerp(0.10, 0.16, encounterIntensity),
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
      cameraPosition: camera.position.clone(),
      cameraQuaternion: camera.quaternion.clone(),
      cameraFocusPoint: cameraFocusPoint.clone(),
      hasCameraFocusPoint,
      freeExploreCameraOffsetTarget: freeExploreCameraOffsetTarget.clone(),
      freeExploreCameraOffsetCurrent: freeExploreCameraOffsetCurrent.clone(),
      freeExploreFocusOffsetTarget: freeExploreFocusOffsetTarget.clone(),
      freeExploreFocusOffsetCurrent: freeExploreFocusOffsetCurrent.clone(),
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

  /** Writes a document position without allowing CSS smooth scrolling to animate it. */
  function forceJourneyScrollPosition(scrollYPosition) {
    const target = Math.max(0, Number(scrollYPosition) || 0);
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;
    window.scrollTo(0, target);
  }

  /** Restores every camera-rig value captured immediately before focus began. */
  function restoreJourneyCameraSnapshot(snapshot, { preserveLiveCamera = false } = {}) {
    scrollProgress = snapshot.scrollProgress;
    smoothProgress = snapshot.smoothProgress;
    previousDistanceProgress = snapshot.smoothProgress;

    freeExploreCameraOffsetTarget.copy(snapshot.freeExploreCameraOffsetTarget);
    freeExploreCameraOffsetCurrent.copy(snapshot.freeExploreCameraOffsetCurrent);
    freeExploreFocusOffsetTarget.copy(snapshot.freeExploreFocusOffsetTarget);
    freeExploreFocusOffsetCurrent.copy(snapshot.freeExploreFocusOffsetCurrent);

    if (preserveLiveCamera) return;

    yaw = snapshot.yaw;
    pitch = snapshot.pitch;
    targetYaw = snapshot.targetYaw;
    targetPitch = snapshot.targetPitch;
    camera.position.copy(snapshot.cameraPosition);
    camera.quaternion.copy(snapshot.cameraQuaternion);
    camera.fov = snapshot.cameraFov;
    camera.updateProjectionMatrix();
    cameraFocusPoint.copy(snapshot.cameraFocusPoint);
    hasCameraFocusPoint = snapshot.hasCameraFocusPoint ?? true;
    camera.updateMatrixWorld(true);
  }

  /**
   * Begins a two-stage focus exit. The inspected body remains the active focus
   * while the camera returns to the exact pre-focus pose. Only after the camera
   * has arrived do we release the fixed document and clear focusedBody.
   *
   * This ordering is important: clearing focusedBody first lets the broad-view
   * camera and solar rendering run for one or more frames from the close Jupiter
   * inspection position, which is the source of the giant dark-disc artefact.
   */
  function beginFocusExitTransition(snapshot, body) {
    if (!snapshot || !body || focusExitTransition) return;

    focusExitTransition = {
      phase: "camera",
      snapshot,
      body,
      elapsed: 0,
      duration: 0.72,
      releaseElapsed: 0,
      stableFrames: 0,
      targetScrollY: snapshot.scrollY,
      startCameraPosition: camera.position.clone(),
      startCameraQuaternion: camera.quaternion.clone(),
      startCameraFocusPoint: cameraFocusPoint.clone(),
      startFov: camera.fov,
    };

    suppressJourneyScrollSync = true;
    document.documentElement.classList.add("is-focus-exit-restoring");
    document.documentElement.style.scrollBehavior = "auto";
  }

  /** Smoothstep used by the explicit camera return. */
  function focusExitEase(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  /**
   * Advances focus-exit state before the ordinary camera calculation.
   * Returns true while the exit owns the camera and scroll journey.
   */
  function advanceFocusExitTransition(deltaTime) {
    if (!focusExitTransition) return false;

    const transition = focusExitTransition;
    const { snapshot } = transition;
    suppressJourneyScrollSync = true;
    document.documentElement.style.scrollBehavior = "auto";

    // Hold all broad-journey inputs at their pre-focus values. This prevents
    // scroll events, pointer inertia, or free-space rig springs from fighting
    // the explicit camera return.
    scrollProgress = snapshot.scrollProgress;
    smoothProgress = snapshot.smoothProgress;
    previousDistanceProgress = snapshot.smoothProgress;
    yaw = snapshot.yaw;
    pitch = snapshot.pitch;
    targetYaw = snapshot.targetYaw;
    targetPitch = snapshot.targetPitch;
    freeExploreCameraOffsetTarget.copy(snapshot.freeExploreCameraOffsetTarget);
    freeExploreCameraOffsetCurrent.copy(snapshot.freeExploreCameraOffsetCurrent);
    freeExploreFocusOffsetTarget.copy(snapshot.freeExploreFocusOffsetTarget);
    freeExploreFocusOffsetCurrent.copy(snapshot.freeExploreFocusOffsetCurrent);

    if (transition.phase === "camera") {
      transition.elapsed += deltaTime;
    } else {
      transition.releaseElapsed += deltaTime;
      if (Math.abs(window.scrollY - transition.targetScrollY) > 0.5) {
        forceJourneyScrollPosition(transition.targetScrollY);
        transition.stableFrames = 0;
      } else {
        transition.stableFrames += 1;
      }
    }

    return true;
  }

  /**
   * Overrides the final camera pose after ordinary focus/journey calculations.
   * This guarantees there is never a rendered frame with broad-view state and
   * Jupiter's close inspection camera mixed together.
   */
  function applyFocusExitCameraOverride() {
    if (!focusExitTransition) return;

    const transition = focusExitTransition;
    const { snapshot } = transition;

    if (transition.phase === "camera") {
      const progress = focusExitEase(transition.elapsed / transition.duration);
      camera.position.lerpVectors(
        transition.startCameraPosition,
        snapshot.cameraPosition,
        progress,
      );
      camera.quaternion.slerpQuaternions(
        transition.startCameraQuaternion,
        snapshot.cameraQuaternion,
        progress,
      );
      cameraFocusPoint.lerpVectors(
        transition.startCameraFocusPoint,
        snapshot.cameraFocusPoint,
        progress,
      );
      camera.fov = THREE.MathUtils.lerp(transition.startFov, snapshot.cameraFov, progress);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      if (progress >= 1) {
        // Camera is now safely back at the broad pose. Clear focus only now.
        if (focusedBody) {
          setAsteroidFocusAppearance(focusedBody, false);
          setAsteroidInspectionDetail(focusedBody, false);
        }
        focusedBody = null;
        displayedBody = null;
        focusedBodyLocator.visible = false;
        focusedBodyLocator.material.opacity = 0;
        focusZoomTarget = 1;
        focusZoomCurrent = 1;
        focusPinchDistance = null;
        focusNavigationHistory.length = 0;
        restoreJourneyCameraSnapshot(snapshot);
        restoreBroadSolarSystemScale();
        updateBodyCard(null);

        // Release position:fixed under a hard `scroll-behavior:auto` guard.
        document.documentElement.classList.remove("is-celestial-focus");
        document.body.classList.remove("is-celestial-focus");
        document.documentElement.style.overflow = snapshot.htmlOverflow;
        document.body.style.position = snapshot.bodyPosition;
        document.body.style.top = snapshot.bodyTop;
        document.body.style.left = snapshot.bodyLeft;
        document.body.style.right = snapshot.bodyRight;
        document.body.style.width = snapshot.bodyWidth;
        document.body.style.overflow = snapshot.bodyOverflow;
        document.body.style.paddingRight = snapshot.bodyPaddingRight;
        forceJourneyScrollPosition(snapshot.scrollY);

        isJourneyScrollLocked = false;
        journeyScrollSnapshot = null;
        transition.phase = "release";
        transition.releaseElapsed = 0;
        transition.stableFrames = 0;
      }
      return;
    }

    // During fixed-body release, pin the exact broad camera pose. Chrome can
    // otherwise emit transient scroll positions for a few frames.
    restoreJourneyCameraSnapshot(snapshot);
    forceJourneyScrollPosition(transition.targetScrollY);

    const releaseSettled = transition.releaseElapsed >= 0.35
      && transition.stableFrames >= 8;
    const releaseSafetyLimit = transition.releaseElapsed >= 1.25;
    if (releaseSettled || releaseSafetyLimit) {
      forceJourneyScrollPosition(transition.targetScrollY);
      document.documentElement.style.scrollBehavior = snapshot.htmlScrollBehavior;
      document.documentElement.classList.remove("is-focus-exit-restoring");
      suppressJourneyScrollSync = false;
      focusExitTransition = null;
      updateScrollProgress();
    }
  }

  /** Restores the exact scroll/camera journey position from before inspection. */
  function unlockJourneyScroll({ preserveLiveCamera = false, stabilizeFocusExit = false } = {}) {
    if (!isJourneyScrollLocked || !journeyScrollSnapshot) return;
    const snapshot = journeyScrollSnapshot;

    // Suppress scroll-derived journey changes before releasing the fixed body.
    // The computed CSS may request smooth scrolling, so keep an explicit inline
    // `auto` value until the document has settled at the snapshot position.
    suppressJourneyScrollSync = true;
    document.documentElement.style.scrollBehavior = "auto";
    document.documentElement.classList.remove("is-celestial-focus");
    document.body.classList.remove("is-celestial-focus");
    document.documentElement.style.overflow = snapshot.htmlOverflow;
    document.body.style.position = snapshot.bodyPosition;
    document.body.style.top = snapshot.bodyTop;
    document.body.style.left = snapshot.bodyLeft;
    document.body.style.right = snapshot.bodyRight;
    document.body.style.width = snapshot.bodyWidth;
    document.body.style.overflow = snapshot.bodyOverflow;
    document.body.style.paddingRight = snapshot.bodyPaddingRight;

    restoreJourneyCameraSnapshot(snapshot, { preserveLiveCamera });
    forceJourneyScrollPosition(snapshot.scrollY);

    isJourneyScrollLocked = false;
    journeyScrollSnapshot = null;

    // Generic lock users restore immediately. Celestial focus exits no longer
    // use this path; they keep the body focused until the explicit camera return
    // has completed, then release the document from applyFocusExitCameraOverride.
    requestAnimationFrame(() => {
      forceJourneyScrollPosition(snapshot.scrollY);
      requestAnimationFrame(() => {
        forceJourneyScrollPosition(snapshot.scrollY);
        document.documentElement.style.scrollBehavior = snapshot.htmlScrollBehavior;
        suppressJourneyScrollSync = false;
        updateScrollProgress();
      });
    });

    updateDistanceReadout(smoothProgress);
  }

  function releaseWideFocusToFreeFlight() {
    if (!focusedBody) return false;

    const liveCameraPosition = camera.position.clone();
    const liveCameraFocus = cameraFocusPoint.clone();
    const liveFov = camera.fov;
    const snapshot = journeyScrollSnapshot;

    setAsteroidFocusAppearance(focusedBody, false);
    setAsteroidInspectionDetail(focusedBody, false);
    focusedBody = null;
    displayedBody = null;
    focusNavigationHistory.length = 0;
    focusExitTransition = null;
    focusedBodyLocator.visible = false;
    focusedBodyLocator.material.opacity = 0;
    focusZoomTarget = 1;
    focusZoomCurrent = 1;
    focusPinchDistance = null;
    setBodyCardCollapsed(false);
    updateBodyCard(null);
    restoreBroadSolarSystemScale();

    if (snapshot) {
      suppressJourneyScrollSync = true;
      document.documentElement.style.scrollBehavior = "auto";
      document.documentElement.classList.remove(
        "is-celestial-focus",
        "is-focus-exit-restoring",
      );
      document.body.classList.remove("is-celestial-focus");
      document.documentElement.style.overflow = snapshot.htmlOverflow;
      document.body.style.position = snapshot.bodyPosition;
      document.body.style.top = snapshot.bodyTop;
      document.body.style.left = snapshot.bodyLeft;
      document.body.style.right = snapshot.bodyRight;
      document.body.style.width = snapshot.bodyWidth;
      document.body.style.overflow = snapshot.bodyOverflow;
      document.body.style.paddingRight = snapshot.bodyPaddingRight;
    }

    isJourneyScrollLocked = false;
    journeyScrollSnapshot = null;
    scrollProgress = 1;
    smoothProgress = 1;
    previousDistanceProgress = 1;

    const maximumScroll = Math.max(
      0,
      document.documentElement.scrollHeight - innerHeight,
    );
    forceJourneyScrollPosition(maximumScroll);

    const outerDistance = getCameraDistance(1);
    getFocusPoint(outerDistance, exploreBaseFocus);
    setSphericalCameraOffset(sphericalCameraOffset, outerDistance);
    exploreBaseCamera.copy(exploreBaseFocus).add(sphericalCameraOffset);

    freeExploreCameraOffsetCurrent.copy(liveCameraPosition).sub(exploreBaseCamera);
    freeExploreCameraOffsetTarget.copy(freeExploreCameraOffsetCurrent);
    freeExploreFocusOffsetCurrent.copy(liveCameraFocus).sub(exploreBaseFocus);
    freeExploreFocusOffsetTarget.copy(freeExploreFocusOffsetCurrent);

    camera.position.copy(liveCameraPosition);
    cameraFocusPoint.copy(liveCameraFocus);
    targetFocusPoint.copy(liveCameraFocus);
    camera.fov = liveFov;
    camera.updateProjectionMatrix();
    camera.lookAt(cameraFocusPoint);
    camera.updateMatrixWorld(true);
    hasCameraFocusPoint = true;
    hasExploredFreeSpace = true;
    spaceExploreHint?.classList.add("is-hidden");

    requestAnimationFrame(() => {
      forceJourneyScrollPosition(maximumScroll);
      requestAnimationFrame(() => {
        forceJourneyScrollPosition(maximumScroll);
        document.documentElement.style.scrollBehavior = snapshot?.htmlScrollBehavior ?? "";
        suppressJourneyScrollSync = false;
        updateScrollProgress();
      });
    });

    updateDistanceReadout(1);
    return true;
  }

  /** Captures a focused body's complete inspection state for Back/Escape. */
  function captureFocusedNavigationState(body) {
    if (!body) return null;

    body.getWorldPosition(focusHistoryWorldPosition);
    return {
      body,
      yaw,
      pitch,
      targetYaw,
      targetPitch,
      focusZoomTarget,
      focusZoomCurrent,
      cameraFov: camera.fov,
      cameraOffset: camera.position.clone().sub(focusHistoryWorldPosition),
      focusOffset: cameraFocusPoint.clone().sub(focusHistoryWorldPosition),
      isBodyCardCollapsed,
      focusSelectionPulseStartedAt,
    };
  }

  /** Adds the current focused state without allowing unbounded history growth. */
  function pushFocusedNavigationState(body) {
    const state = captureFocusedNavigationState(body);
    if (!state) return;
    focusNavigationHistory.push(state);
    if (focusNavigationHistory.length > MAX_FOCUS_NAVIGATION_HISTORY) {
      focusNavigationHistory.shift();
    }
  }

  /** Restores the previous body and camera relationship without unlocking scroll. */
  function restorePreviousFocusedNavigationState() {
    let state = focusNavigationHistory.pop();
    while (state?.body && !state.body.parent && focusNavigationHistory.length > 0) {
      state = focusNavigationHistory.pop();
    }
    if (!state?.body || !state.body.parent) return false;

    focusExitTransition = null;
    suppressJourneyScrollSync = false;

    if (focusedBody) {
      setAsteroidFocusAppearance(focusedBody, false);
      setAsteroidInspectionDetail(focusedBody, false);
    }

    focusedBody = state.body;
    focusedBody.getWorldPosition(focusHistoryWorldPosition);

    yaw = state.yaw;
    pitch = state.pitch;
    targetYaw = state.targetYaw;
    targetPitch = state.targetPitch;
    focusZoomTarget = state.focusZoomTarget;
    focusZoomCurrent = state.focusZoomCurrent;
    focusPinchDistance = null;

    camera.position.copy(focusHistoryWorldPosition).add(state.cameraOffset);
    cameraFocusPoint.copy(focusHistoryWorldPosition).add(state.focusOffset);
    targetFocusPoint.copy(cameraFocusPoint);
    hasCameraFocusPoint = true;
    camera.fov = state.cameraFov;
    camera.lookAt(cameraFocusPoint);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    setBodyCardCollapsed(Boolean(state.isBodyCardCollapsed));
    focusedBodyLocator.visible = true;
    focusSelectionPulseStartedAt = Number.isFinite(state.focusSelectionPulseStartedAt)
      ? state.focusSelectionPulseStartedAt
      : elapsedTime;
    // The DOM currently contains the body we are leaving, not the body stored
    // in this history entry. Clear the render cache so updateBodyCard rewrites
    // every fact instead of incorrectly preserving the newer body's details.
    displayedBody = null;
    setAsteroidInspectionDetail(focusedBody, true);
    setAsteroidFocusAppearance(focusedBody, true);
    updateDistanceReadout(smoothProgress);
    updateBodyCard(focusedBody);
    return true;
  }

  /**
   * Returns to the previous inspection state. Only when no earlier focused body
   * remains do we begin the guarded camera transition back to free-flight.
   *
   * Keeping this as a stack prevents a moon -> planet -> Escape action from
   * accidentally dropping straight into the broad Solar-System camera.
   */
  function navigateBackFromFocusedBody() {
    if (focusExitTransition || !focusedBody) return false;

    if (focusNavigationHistory.length > 0) {
      return restorePreviousFocusedNavigationState();
    }

    if (!journeyScrollSnapshot) {
      // Defensive fallback for any focus entered outside the ordinary journey
      // lock path. Restore visual state without allowing a stale focused body.
      setAsteroidFocusAppearance(focusedBody, false);
      setAsteroidInspectionDetail(focusedBody, false);
      focusedBody = null;
      displayedBody = null;
      focusedBodyLocator.visible = false;
      focusedBodyLocator.material.opacity = 0;
      focusZoomTarget = 1;
      focusZoomCurrent = 1;
      focusPinchDistance = null;
      restoreBroadSolarSystemScale();
      updateBodyCard(null);
      return true;
    }

    // Do not clear focusedBody here. The explicit transition keeps the current
    // body active until the pre-focus camera pose has been reached, preventing
    // Jupiter's close inspection scale from leaking into the broad view.
    beginFocusExitTransition(journeyScrollSnapshot, focusedBody);
    return true;
  }

  /*
    focusBody
    - Focuses a clicked object without changing the page journey position.
    - Every body-to-body jump stores the complete previous inspection state.
    - Selecting the already focused body is a no-op; it never exits focus.
    - Escape/clicking empty space performs one Back step.
    - Free-flight is restored only after the focus stack becomes empty.
  */
  function focusBody(body) {
    if (focusExitTransition) return;
    clearCelestialHover();

    if (activeDistanceInfo && distanceUnitPopover && !distanceUnitPopover.hidden) {
      closeDistanceInfoPopover({ releaseJourneyLock: false });
    }

    if (!body) {
      navigateBackFromFocusedBody();
      return;
    }

    // Clicking the current body should keep its exact view. Treating it as null
    // previously made repeated clicks unexpectedly leave the inspection stack.
    if (body === focusedBody) return;

    setBodyCardCollapsed(false);
    if (!isJourneyScrollLocked) {
      focusNavigationHistory.length = 0;
      lockJourneyScroll();
    }

    if (focusedBody) {
      if (isFocusedWideView()) {
        // At the outer boundary, selecting another object starts a fresh
        // inspection rather than keeping the previous body trapped in history.
        focusNavigationHistory.length = 0;
      } else {
        pushFocusedNavigationState(focusedBody);
      }
      setAsteroidFocusAppearance(focusedBody, false);
      setAsteroidInspectionDetail(focusedBody, false);
    }

    focusedBody = body;
    focusSelectionPulseStartedAt = elapsedTime;
    focusedBodyLocator.visible = true;
    focusZoomTarget = 1;
    focusZoomCurrent = 1;
    focusPinchDistance = null;

    setAsteroidInspectionDetail(focusedBody, true);
    setAsteroidFocusAppearance(focusedBody, true);
    updateDistanceReadout(smoothProgress);
    updateBodyCard(focusedBody);
  }

  /*
    setup input handlers
    - Wires scroll, pointer, drag, and keyboard events to the camera control state.
    - Keeps the scene interactive while preserving pointer selection and drag motion.
  */
  // `passive` promises that the handler will not cancel scrolling, helping browsers
  // keep scrolling responsive while JavaScript updates its normalized value.
  addEventListener("scroll", () => {
    updateScrollProgress();
  }, { passive: true });
  function getFocusedBaseDistance(body = focusedBody) {
    if (!body) return 1;
    const focusScale = body.userData?.focusScale ?? 1;
    const minimumFocusDistance = body.userData?.minFocusDistance ?? 4.5;
    const explicitFocusDistance = body.userData?.focusDistance;
    return explicitFocusDistance
      ?? Math.max(
        minimumFocusDistance,
        Math.min(getCameraDistance(smoothProgress), 30 / focusScale),
      );
  }

  function getFocusedMaximumZoom(body = focusedBody) {
    const baseDistance = Math.max(0.001, getFocusedBaseDistance(body));
    return Math.max(2.45, MAX_CINEMATIC_CAMERA_DISTANCE / baseDistance);
  }

  function isFocusedWideView() {
    if (!focusedBody) return false;
    const focusedDistance = getFocusedBaseDistance(focusedBody) * focusZoomCurrent;
    return focusedDistance >= MAX_CINEMATIC_CAMERA_DISTANCE * 0.72;
  }

  function adjustFocusedZoom(delta) {
    // Focused inspection can now pull all the way back to the authored outer
    // Solar-System boundary. The body remains selected until the viewer clicks
    // another body/region or presses Escape.
    if (!focusedBody) return;
    const zoomSensitivity = delta > 0 && focusZoomTarget > 2.45
      ? 0.0021
      : 0.00125;
    focusZoomTarget = THREE.MathUtils.clamp(
      focusZoomTarget * Math.exp(delta * zoomSensitivity),
      0.58,
      getFocusedMaximumZoom(),
    );
  }

  function resetFreeExploration({ immediate = false } = {}) {
    freeExploreCameraOffsetTarget.set(0, 0, 0);
    freeExploreFocusOffsetTarget.set(0, 0, 0);
    hasExploredFreeSpace = false;
    spaceDiveModeUntil = 0;
    spaceDivePulse?.classList.remove("is-active");
    if (spaceDivePulseTimer) {
      clearTimeout(spaceDivePulseTimer);
      spaceDivePulseTimer = null;
    }
    spaceExploreHint?.classList.remove("is-hidden");

    if (immediate) {
      freeExploreCameraOffsetCurrent.set(0, 0, 0);
      freeExploreFocusOffsetCurrent.set(0, 0, 0);
      freeExploreDistanceReference = null;
      if (freeExploreDistanceResetTimer) {
        clearTimeout(freeExploreDistanceResetTimer);
        freeExploreDistanceResetTimer = null;
      }
    } else if (freeExploreDistanceReference) {
      // Keep calculating from the physically returning camera while the full
      // rig eases home. Only then hand the readout back to the scroll mapping.
      if (freeExploreDistanceResetTimer) clearTimeout(freeExploreDistanceResetTimer);
      freeExploreDistanceResetTimer = setTimeout(() => {
        freeExploreDistanceReference = null;
        freeExploreDistanceResetTimer = null;
        updateDistanceReadout(smoothProgress);
      }, 1250);
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

    if (focusedBody) {
      setAsteroidFocusAppearance(focusedBody, false);
      setAsteroidInspectionDetail(focusedBody, false);
    }
    focusedBody = null;
    focusNavigationHistory.length = 0;
    focusExitTransition = null;
    document.documentElement.classList.remove("is-focus-exit-restoring");
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
    hasLeftOpeningEarthView = false;
    previousDistanceProgress = 0;
    targetYaw = -0.55;
    targetPitch = 0.22;
    yaw = targetYaw;
    pitch = targetPitch;
    camera.fov = earth.userData?.focusFov ?? 34;
    camera.updateProjectionMatrix();
    earth.getWorldPosition(cameraFocusPoint);
    targetFocusPoint.copy(cameraFocusPoint);
    hasCameraFocusPoint = true;

    // Put the document at the real journey origin before focus locks scrolling.
    // The camera itself provides the cinematic transition, while the stored
    // focus snapshot now correctly restores to the top of the experience.
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.style.scrollBehavior = "";

    // “Travel back to Earth” now lands in the exact same inspection state as
    // clicking Earth: identical target, framing distance, FOV, readout, and
    // apparent solar angle. This prevents the unfocused full-size Sun from
    // appearing unnaturally close beside Earth during the return.
    focusBody(earth);
    updateBodyCard(earth);
    snapSunApparentScaleOnNextFrame = true;

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

  /** Plays one precise HUD confirmation at the raycast-approved space point. */
  function showSpaceDivePulse() {
    if (!spaceDivePulse) return;
    const screenX = (pointer.x * 0.5 + 0.5) * innerWidth;
    const screenY = (-pointer.y * 0.5 + 0.5) * innerHeight;

    spaceDivePulse.style.left = `${THREE.MathUtils.clamp(screenX, 54, innerWidth - 54)}px`;
    spaceDivePulse.style.top = `${THREE.MathUtils.clamp(screenY, 54, innerHeight - 54)}px`;
    spaceDivePulse.classList.remove("is-active");
    // Reading layout restarts all child animations for rapid consecutive clicks.
    void spaceDivePulse.offsetWidth;
    spaceDivePulse.classList.add("is-active");

    if (spaceDivePulseTimer) clearTimeout(spaceDivePulseTimer);
    spaceDivePulseTimer = setTimeout(() => {
      spaceDivePulse?.classList.remove("is-active");
      spaceDivePulseTimer = null;
    }, 1180);
  }

  function exploreSpaceAtPointer() {
    // The pointer-down capture already retires any distance explanation, so an
    // empty-space click can move toward its region during the same transition.
    if (focusedBody) return;

    raycaster.setFromCamera(pointer, camera);
    exploreRayDirection.copy(raycaster.ray.direction).normalize();

    // Any empty screen point defines a valid forward ray through the 3D world.
    // The pulse confirms the exact region whose ray now becomes the view centre.
    showSpaceDivePulse();

    // Establish one local scene-to-kilometre calibration when regional travel
    // starts. From this point onward the readout uses only the camera's actual
    // 3D separation from Earth; clicks do not add an arbitrary distance value.
    if (!freeExploreDistanceReference) {
      const scrollTravel = interpolateCameraDistanceFromEarth(smoothProgress);
      earth.getWorldPosition(cameraDistanceEarthPosition);
      const cameraSceneDistance = Math.max(
        0.0001,
        camera.position.distanceTo(cameraDistanceEarthPosition),
      );
      freeExploreDistanceReference = {
        kilometresPerSceneUnit: scrollTravel.kilometres / cameraSceneDistance,
      };
    }
    if (freeExploreDistanceResetTimer) {
      clearTimeout(freeExploreDistanceResetTimer);
      freeExploreDistanceResetTimer = null;
    }

    const journeyDistance = getCameraDistance(smoothProgress);
    const currentViewDistance = Math.max(1, camera.position.distanceTo(cameraFocusPoint));
    const travelStep = THREE.MathUtils.clamp(currentViewDistance * 0.58, 3.5, 360);

    // Build the unmodified scroll-journey pose for this frame. Regional targets
    // are stored as offsets from that pose, so scrolling, focus transitions, and
    // a later reset still have one reliable home position.
    getFocusPoint(journeyDistance, exploreBaseFocus);
    setSphericalCameraOffset(sphericalCameraOffset, journeyDistance);
    exploreBaseCamera.copy(exploreBaseFocus).add(sphericalCameraOffset);

    // Advance the camera itself along the clicked ray, then place the look-at
    // point one current view-distance ahead. The selected region therefore
    // becomes centred and closer because the complete camera rig travelled to
    // it—not because the FOV pretended to zoom.
    exploreDesiredCamera
      .copy(camera.position)
      .addScaledVector(exploreRayDirection, travelStep);
    exploreDesiredFocus
      .copy(exploreDesiredCamera)
      .addScaledVector(exploreRayDirection, currentViewDistance);

    freeExploreCameraOffsetTarget.copy(exploreDesiredCamera).sub(exploreBaseCamera);
    freeExploreFocusOffsetTarget.copy(exploreDesiredFocus).sub(exploreBaseFocus);

    // Keep repeated dives within the useful solar-system scene while preserving
    // the exact relationship between the camera and its look-at point.
    const maximumRigOffset = THREE.MathUtils.clamp(journeyDistance * 2.4, 12, 1250);
    const largestOffset = Math.max(
      freeExploreCameraOffsetTarget.length(),
      freeExploreFocusOffsetTarget.length(),
    );
    if (largestOffset > maximumRigOffset) {
      const scale = maximumRigOffset / largestOffset;
      freeExploreCameraOffsetTarget.multiplyScalar(scale);
      freeExploreFocusOffsetTarget.multiplyScalar(scale);
    }

    spaceDiveModeUntil = elapsedTime + 1.5;
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
      getFocusedMaximumZoom(),
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
    if (event.target.closest?.(".about-experience, .hud, .body-card, .body-card-restore, .progress, .distance-cinematic-layer, .earth-return-button")) {
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
    } else if (!spaceEnvironment.reducedMotion
      && !hoveredCelestialBody
      && getAsteroidEncounterIntensity() < 0.18
      && getJovianEncounterIntensity() < 0.12
      && !distanceCinematicPanel?.isOpen()) {
      // Even without dragging, a tiny pointer parallax keeps the wider scene
      // alive. It is disabled in the asteroid belt and Jupiter's moon region
      // because moving the camera under the pointer makes tiny bodies appear to
      // repel the cursor before hover acquisition completes.
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
    if (event.target.closest?.(".about-experience, .body-card-restore, .progress, .distance-cinematic-layer, .earth-return-button")) return;
    updatePointerFromEvent(event);
    isDragging = true;
    dragDistance = 0;
    pointerDownPosition = { x: event.clientX, y: event.clientY };
    lastPointer = { x: event.clientX, y: event.clientY };
    // Capture the exact candidate at press time. Dense belt rocks can still move
    // slightly before pointerup, so this prevents the click target from swapping
    // to a neighbour or disappearing during a deliberate press.
    pointerDownCelestialBody = hoveredCelestialBody
      && asteroidHoverLocator.visible
      && isPointerStillOnHoveredBody(hoveredCelestialBody)
        ? hoveredCelestialBody
        : getBodyAtPointer();
  });

  addEventListener("pointerup", (event) => {
    updatePointerFromEvent(event);
    isDragging = false;
    // HUD clicks belong to HTML controls and must not select objects behind them.
    if (event.target.closest?.(".about-experience, .hud, .body-card, .body-card-restore, .progress, .distance-cinematic-layer, .earth-return-button")) {
      pointerDownCelestialBody = null;
      return;
    }
    if (dragDistance > 12) {
      pointerDownCelestialBody = null;
      return;
    }
    // Prefer the press-time target in dense populations. Fall back to a fresh
    // visibility-aware scan only when the press began on empty space.
    const body = pointerDownCelestialBody ?? getBodyAtPointer();
    pointerDownCelestialBody = null;
    if (body) {
      focusBody(body);
      return;
    }

    if (focusedBody) {
      if (isFocusedWideView()) {
        // A click into empty space from the maximum focused zoom exits the
        // previous inspection and continues into the selected region in the
        // same gesture, with no intermediate camera jump.
        releaseWideFocusToFreeFlight();
        exploreSpaceAtPointer();
      } else {
        focusBody(null);
      }
      return;
    }

    exploreSpaceAtPointer();
  });

  addEventListener("pointercancel", () => {
    // Browsers can cancel input when a gesture leaves the window or becomes a system gesture.
    isDragging = false;
    pointerDownCelestialBody = null;
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
      return;
    }
    if (hasExploredFreeSpace
      || freeExploreCameraOffsetTarget.lengthSq() > 0.0001
      || freeExploreFocusOffsetTarget.lengthSq() > 0.0001
      || freeExploreCameraOffsetCurrent.lengthSq() > 0.0001
      || freeExploreFocusOffsetCurrent.lengthSq() > 0.0001) {
      resetFreeExploration();
    }
  }

  addEventListener("keydown", (event) => {
    // The modal's capture-phase keyboard handler owns Escape and focus while
    // its project transmission is visible.
    if (isAboutExperienceOpen) return;

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
    const pixelRatio = resizeCinematicRenderer();
    spaceEnvironment.resize(innerWidth, innerHeight, pixelRatio);
    setAsteroidBeltQuality(asteroidBelt, "high", pixelRatio);
    distanceCinematicPanel?.position();
  });

  // Hidden tabs should not spend CPU time advancing an invisible WebGL scene.
  // Browsers already throttle animation frames, but this also skips every
  // simulation, raycast-interface, and shader-uniform update explicitly.
  addEventListener("visibilitychange", () => {
    isPageVisible = !document.hidden;
    spaceEnvironment.setPaused(!isPageVisible || isAboutExperienceOpen);
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
  function animate(frameTime = performance.now()) {
    // Keep a deterministic 60 FPS cinematic cadence even on 120/144 Hz panels.
    // This preserves high-resolution rendering without allowing refresh-rate
    // differences to multiply GPU load or simulation speed.
    if (lastCinematicFrameTime > 0
      && frameTime - lastCinematicFrameTime < CINEMATIC_FRAME_INTERVAL_MS - 0.5) {
      requestAnimationFrame(animate);
      return;
    }
    lastCinematicFrameTime = frameTime;
    const deltaTime = Math.min(clock.getDelta(), 0.05);
    if (!isPageVisible || isAboutExperienceOpen) {
      requestAnimationFrame(animate);
      return;
    }
    elapsedTime += deltaTime;
    const isRestoringFocusExit = advanceFocusExitTransition(deltaTime);
    // Focus mode and its short deterministic exit hold slow physical scene motion
    // without slowing input during ordinary exploration.
    const motionScale = focusExitTransition
      ? 0.02
      : hoveredCelestialBody
        ? 0.018
        : focusedBody
          ? 0.026
          : 1;
    const frameMotionScale = motionScale * deltaTime * 60;
    simulationTime += deltaTime * motionScale;

    if (!isRestoringFocusExit) {
      // Easing with lerp each frame creates inertia. Larger factors catch up faster.
      smoothProgress = THREE.MathUtils.lerp(
        smoothProgress,
        scrollProgress,
        frameAdjustedEase(0.065, deltaTime),
      );
      const cameraInputEase = frameAdjustedEase(0.075, deltaTime);
      yaw = THREE.MathUtils.lerp(yaw, targetYaw, cameraInputEase);
      pitch = THREE.MathUtils.lerp(pitch, targetPitch, cameraInputEase);
    }

    updateDistanceReadout(smoothProgress);

    // ----- Update planet revolution and self-rotation -----
    const planetVisualDelta = deltaTime;
    planets.forEach((planet) => {
      const data = planet.userData;
      data.meanAnomaly = (data.meanAnomaly ?? data.angle ?? 0)
        + data.orbitSpeed * 0.0022 * frameMotionScale;
      updatePlanetOrbitPosition(planet);
      planet.rotation.y += data.spinSpeed * frameMotionScale;
      if (planetVisualDelta > 0) {
        updatePlanetVisuals(
          planet,
          simulationTime,
          motionScale * planetVisualDelta * 60,
        );
      }
    });
    // Major satellite transforms are inexpensive (only a few dozen objects)
    // and must remain synchronized with their parent planets every frame.
    // Throttling this update caused visible stepping and cursor/target flicker.
    updateMajorSatelliteSystems(
      majorSatelliteSystems,
      motionScale * deltaTime * 60,
      { hoveredBody: hoveredCelestialBody, focusedBody },
    );

    // ----- Calculate the camera's spherical orbit around its focus point -----
    const distance = getCameraDistance(smoothProgress);
    const exploreRigEase = frameAdjustedEase(focusedBody ? 0.055 : 0.09, deltaTime);
    freeExploreCameraOffsetCurrent.lerp(freeExploreCameraOffsetTarget, exploreRigEase);
    freeExploreFocusOffsetCurrent.lerp(freeExploreFocusOffsetTarget, exploreRigEase);

    getFocusPoint(distance, targetFocusPoint);
    exploreBaseFocus.copy(targetFocusPoint);
    if (!focusedBody) targetFocusPoint.add(freeExploreFocusOffsetCurrent);
    if (!hasCameraFocusPoint) {
      // Initialize once with copy; otherwise the first frame would ease from (0,0,0).
      cameraFocusPoint.copy(targetFocusPoint);
      hasCameraFocusPoint = true;
    }
    // Asteroids can be tens of scene units away and visually tiny. Their metadata
    // supplies a stronger focus easing so the camera reaches them promptly.
    // Regional travel already eases both rig offsets together, so copying the
    // matching look-at target keeps the camera and perspective physically joined
    // throughout the dive and its return animation.
    const isRegionalRigActive = !focusedBody && Boolean(freeExploreDistanceReference);
    if (isRegionalRigActive) {
      cameraFocusPoint.copy(targetFocusPoint);
    } else {
      const focusEase = focusedBody?.userData?.focusEase
        ?? (focusedBody ? 0.055 : 0.075);
      cameraFocusPoint.lerp(
        targetFocusPoint,
        frameAdjustedEase(focusEase, deltaTime),
      );
    }

    const focusScale = focusedBody?.userData?.focusScale ?? 1;
    const minimumFocusDistance = focusedBody?.userData?.minFocusDistance ?? 4.5;
    const explicitFocusDistance = focusedBody?.userData?.focusDistance;
    focusZoomCurrent = THREE.MathUtils.lerp(
      focusZoomCurrent,
      focusedBody ? focusZoomTarget : 1,
      frameAdjustedEase(focusedBody ? 0.12 : 0.18, deltaTime),
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
      cameraDistance = THREE.MathUtils.clamp(
        baseFocusDistance * focusZoomCurrent,
        safeMinimum,
        MAX_CINEMATIC_CAMERA_DISTANCE,
      );
    }

    setSphericalCameraOffset(sphericalCameraOffset, cameraDistance);
    if (focusedBody) {
      camera.position.copy(cameraFocusPoint).add(sphericalCameraOffset);
    } else {
      // The scroll pose remains the stable home pose. The two eased offsets move
      // both halves of the rig into the selected 3D region and keep it centred.
      camera.position
        .copy(exploreBaseFocus)
        .add(sphericalCameraOffset)
        .add(freeExploreCameraOffsetCurrent);
    }
    // lookAt rotates the camera so its forward direction points at the target.
    camera.lookAt(cameraFocusPoint);

    // The 115-moon Jovian catalogue is rendered progressively. Invisible
    // sub-pixel moons no longer keep the GPU busy after returning to the broad
    // Solar-System view, avoiding unnecessary broad-view GPU work.
    updateMajorSatelliteVisibility({
      systems: majorSatelliteSystems,
      camera,
      viewportHeight: innerHeight,
      focusedBody,
      hoveredBody: hoveredCelestialBody,
    });

    const isAsteroidFocused = Boolean(
      focusedBody
      && (
        focusedBody.userData?.isAsteroid
        || focusedBody.userData?.isInstancedAsteroid
        || String(focusedBody.userData?.info?.type ?? "").toLowerCase().includes("asteroid")
      )
    );
    asteroidInspectionLight.visible = isAsteroidFocused;

    // Focused bodies use their authored framing. Empty-space exploration no
    // longer fakes travel with FOV zoom; physical camera movement does the work.
    const journeyFov = THREE.MathUtils.lerp(42, 72, smoothProgress);
    const targetFov = focusedBody
      ? focusedBody.userData.focusFov ?? 30
      : THREE.MathUtils.clamp(journeyFov, 16, 94);
    camera.fov = THREE.MathUtils.lerp(
      camera.fov,
      targetFov,
      frameAdjustedEase(focusedBody ? 0.08 : 0.09, deltaTime),
    );
    camera.updateProjectionMatrix();

    // Focus exit owns the final camera pose. Applying the override after every
    // ordinary camera calculation prevents any mixed close-focus/broad-view
    // frame from reaching the renderer.
    applyFocusExitCameraOverride();
    updateSeamlessBroadViewReset(deltaTime);

    // ----- Animate special meshes and scene effects -----
    const frameScale = deltaTime * 60;
    earthClouds.rotation.y += 0.0032 * frameScale;
    earthAtmosphere.rotation.y -= 0.0014 * frameScale;
    moonPivot.rotation.y += 0.011 * frameMotionScale;
    // A small oscillation suggests lunar libration while the pivot maintains tidal lock.
    moon.rotation.y = Math.sin(simulationTime * 0.35) * 0.04;

    updateSun(sun, simulationTime, motionScale * deltaTime * 60);
    updateSunApparentScale(deltaTime);
    // Numerical safety only. The normal Sun scale is intentionally dynamic and
    // follows observer distance even while no celestial body is focused.
    if (!Number.isFinite(sun.system.scale.x) || sun.system.scale.x <= 0) {
      sun.system.scale.setScalar(1);
      snapSunApparentScaleOnNextFrame = true;
    }

    updateCelestialHoverVisual();
    updateFocusedSelectionVisual();

    // Asteroid self-rotation is cheap and does not change object positions, so
    // keep its GPU clock smooth even when the heavier belt-orbit update is
    // throttled on lower-performance devices.
    updateAsteroidSpinClock(asteroidBelt, deltaTime, {
      focusedBody,
      hoveredBody: hoveredCelestialBody,
    });
    // Jupiter moves every frame, so its Trojan clouds must follow on the same
    // clock. Keeping this tiny 84-object pass outside the throttled main-belt
    // update removes stepping/flicker while keeping the main belt smooth.
    updateJupiterTrojanFrame(asteroidBelt, jupiter);

    updateAsteroidBelt(
      asteroidBelt,
      motionScale * deltaTime * 60,
      camera,
      currentSunAngularRadius,
      {
        focusedBody,
        hoveredBody: hoveredCelestialBody,
      },
    );
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

  // Seed state and begin the deterministic requestAnimationFrame render loop.
  updateScrollProgress();
  requestAnimationFrame(animate);

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

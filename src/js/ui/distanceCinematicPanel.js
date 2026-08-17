/**
 * Creates the external information card used by the distance readout.
 *
 * The readout itself stays compact. Explanations live in a fixed overlay so a
 * connector can grow first, followed by the card, without changing the size of
 * the parent readout or moving the Three.js canvas underneath it.
 */
export function createDistanceCinematicPanel({ readoutElement }) {
  if (!readoutElement) return null;

  const layer = document.createElement("div");
  layer.className = "distance-cinematic-layer";
  layer.setAttribute("aria-live", "polite");
  layer.innerHTML = `
    <svg
      class="distance-cinematic-connector"
      aria-hidden="true"
      preserveAspectRatio="none"
      hidden
    >
      <path class="distance-cinematic-connector__trail"></path>
      <path class="distance-cinematic-connector__beam"></path>
      <circle class="distance-cinematic-connector__origin" r="4"></circle>
      <circle class="distance-cinematic-connector__destination" r="4"></circle>
    </svg>
    <aside
      class="distance-unit-popover distance-cinematic-panel"
      id="distance-unit-popover"
      role="dialog"
      aria-modal="false"
      aria-hidden="true"
      aria-labelledby="distance-unit-title"
      hidden
    >
      <button class="distance-unit-popover__close" type="button" aria-label="Close distance information">×</button>
      <span class="distance-unit-popover__eyebrow" id="distance-unit-eyebrow">Distance information</span>
      <strong id="distance-unit-title"></strong>
      <p id="distance-unit-description"></p>
      <small id="distance-unit-equivalent"></small>
    </aside>
  `;
  document.body.append(layer);

  const panel = layer.querySelector("#distance-unit-popover");
  const connector = layer.querySelector(".distance-cinematic-connector");
  // Start with no route at all, so nothing can be drawn before one is solved.
  connector?.style.setProperty("--connector-length", "0px");
  let lastRouteLength = 0;
  const connectorTrail = connector.querySelector(".distance-cinematic-connector__trail");
  const connectorBeam = connector.querySelector(".distance-cinematic-connector__beam");
  const connectorOrigin = connector.querySelector(".distance-cinematic-connector__origin");
  const connectorDestination = connector.querySelector(".distance-cinematic-connector__destination");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timers = new Set();
  let sequence = 0;
  let activeAnchor = null;
  let activeLayout = null;

  const elements = {
    layer,
    panel,
    connector,
    closeButton: panel.querySelector(".distance-unit-popover__close"),
    eyebrow: panel.querySelector("#distance-unit-eyebrow"),
    title: panel.querySelector("#distance-unit-title"),
    description: panel.querySelector("#distance-unit-description"),
    equivalent: panel.querySelector("#distance-unit-equivalent"),
  };

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function clearTimers() {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
  }

  function schedule(callback, delay) {
    if (delay <= 0) {
      callback();
      return null;
    }
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  /**
   * Writes a multi-segment SVG route in viewport coordinates. SVG stroke-dash
   * animation makes the light visibly travel through every corner in order.
   */
  /*
   * Snap a coordinate to a half-pixel.
   *
   * A one-pixel stroke is centred on its path, so at a whole coordinate it
   * straddles two rows of pixels and is drawn as two half-intensity lines.
   * That is what makes a hairline shimmer over a canvas that repaints every
   * frame: the antialiasing is resolved slightly differently from frame to
   * frame and the line appears to blink. Centring it on a half-pixel puts the
   * whole stroke inside one row, where it is crisp and stable.
   */
  function crisp(value) {
    return Math.round(value) + 0.5;
  }

  function setConnectorPath({ points, variant, connection }) {
    const pathData = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${crisp(point.x)} ${crisp(point.y)}`)
      .join(" ");
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    connector.dataset.variant = variant;
    connector.dataset.connection = connection;
    connector.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    connectorTrail.setAttribute("d", pathData);
    connectorBeam.setAttribute("d", pathData);

    /*
     * Publish the route's real length, and animate the dash from that.
     *
     * The draw-on used `pathLength="1"` with `stroke-dasharray: 1`, which is
     * the usual trick -- but the computed dash resolves to `1px`, an absolute
     * length, and Chrome does not rescale an absolute dash through pathLength.
     * The result was a stroke that stopped roughly halfway along the route and
     * never reached the card: the gap.
     *
     * Measuring the path and handing the number to CSS removes the ambiguity
     * entirely. The dash is now exactly as long as the line it has to cover,
     * whatever shape the route takes.
     */
    /*
     * Only republish the length when it has actually changed.
     *
     * `position()` re-solves the route on every resize and on every scroll the
     * readout takes, and each rewrite of --connector-length restarts the dash
     * pattern from scratch. Even when the new length differs by a fraction of
     * a pixel the stroke is re-rasterised, which is what makes an otherwise
     * static hairline blink. A half-pixel threshold keeps the dash stable
     * through the churn while still tracking a genuine reflow.
     */
    const routeLength = connectorBeam.getTotalLength();
    if (Math.abs(routeLength - lastRouteLength) > 0.5) {
      lastRouteLength = routeLength;
      connector.style.setProperty("--connector-length", `${routeLength.toFixed(2)}px`);
    }
    connectorOrigin.setAttribute("cx", crisp(firstPoint.x));
    connectorOrigin.setAttribute("cy", crisp(firstPoint.y));
    connectorDestination.setAttribute("cx", crisp(lastPoint.x));
    connectorDestination.setAttribute("cy", crisp(lastPoint.y));
  }

  /** Places the card and connector around their live DOM anchor. */
  function position() {
    if (panel.hidden || !activeAnchor?.isConnected) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const viewportPadding = 12;
    const readoutRect = readoutElement.getBoundingClientRect();
    const anchorRect = activeAnchor.getBoundingClientRect();
    const anchorCentreX = anchorRect.left + anchorRect.width / 2;
    const anchorCentreY = anchorRect.top + anchorRect.height / 2;

    panel.dataset.layout = activeLayout;
    panel.style.width = "";
    panel.style.left = "0px";
    panel.style.top = "0px";

    if (activeLayout === "measurement") {
      // On desktop the method card sits beside the readout, joined by a true
      // horizontal beam. Narrow screens fall back above the readout so neither
      // card becomes too small to read.
      const horizontalGap = 96;
      const sideLeft = readoutRect.right + horizontalGap;
      const availableSideWidth = viewportWidth - sideLeft - viewportPadding;

      if (availableSideWidth >= 250) {
        const panelWidth = Math.min(480, availableSideWidth);
        panel.style.width = `${panelWidth}px`;
        const panelHeight = panel.offsetHeight;
        const panelTop = clamp(
          anchorCentreY - panelHeight * 0.48,
          viewportPadding,
          viewportHeight - panelHeight - viewportPadding,
        );
        panel.style.left = `${sideLeft}px`;
        panel.style.top = `${panelTop}px`;
        panel.dataset.connection = "horizontal";
        const panelPortY = panelTop + panelHeight * 0.58;
        const elbowX = anchorRect.right + (sideLeft - anchorRect.right) * 0.50;
        setConnectorPath({
          points: [
            { x: anchorRect.right, y: anchorCentreY },
            { x: elbowX, y: anchorCentreY },
            { x: elbowX, y: panelPortY },
            { x: sideLeft, y: panelPortY },
          ],
          variant: "measurement",
          connection: "horizontal",
        });
        return;
      }
    }

    // Unit explanations—and the responsive measurement fallback—rise above
    // the readout. The vertical line grows upward from the clicked control.
    const panelWidth = Math.min(activeLayout === "unit" ? 560 : 520, viewportWidth - viewportPadding * 2);
    panel.style.width = `${panelWidth}px`;
    const panelHeight = panel.offsetHeight;
    const desiredLeft = activeLayout === "unit"
      ? anchorCentreX - panelWidth * 0.34
      : readoutRect.left;
    const panelLeft = clamp(desiredLeft, viewportPadding, viewportWidth - panelWidth - viewportPadding);
    const verticalGap = activeLayout === "unit" ? 104 : 88;
    const panelTop = clamp(
      readoutRect.top - panelHeight - verticalGap,
      viewportPadding,
      viewportHeight - panelHeight - viewportPadding,
    );
    const panelBottom = panelTop + panelHeight;

    panel.style.left = `${panelLeft}px`;
    panel.style.top = `${panelTop}px`;
    panel.dataset.connection = "vertical";
    const panelPortX = clamp(
      panelLeft + panelWidth * (activeLayout === "unit" ? 0.55 : 0.48),
      panelLeft + 28,
      panelLeft + panelWidth - 28,
    );
    const routeHeight = Math.max(24, anchorRect.top - panelBottom);
    const firstBendY = anchorRect.top - routeHeight * 0.34;
    const secondBendY = panelBottom + routeHeight * 0.34;
    setConnectorPath({
      points: [
        { x: anchorCentreX, y: anchorRect.top },
        { x: anchorCentreX, y: firstBendY },
        { x: panelPortX, y: secondBendY },
        { x: panelPortX, y: panelBottom },
      ],
      variant: activeLayout,
      connection: "vertical",
    });
  }

  function getTimings() {
    if (reducedMotionQuery.matches) {
      return { lineDraw: 0, panelExit: 0, lineRetract: 0 };
    }
    return { lineDraw: 680, panelExit: 360, lineRetract: 560 };
  }

  /** Draws the connector first, then reveals the external card. */
  function open({ layout, anchor }) {
    if (!anchor) return;
    const nextSequence = ++sequence;
    clearTimers();
    activeAnchor = anchor;
    activeLayout = layout;

    panel.hidden = false;
    // SVG elements do not reflect the JavaScript `hidden` property as
    // consistently as HTML elements, so manage the actual attribute. This
    // guarantees a connector retired by another control can be shown again.
    connector.removeAttribute("hidden");
    panel.setAttribute("aria-hidden", "false");
    panel.classList.remove("is-visible", "is-closing");
    connector.classList.remove("is-visible", "is-retiring");
    position();

    // Two frames guarantee that the browser paints the undrawn SVG path before
    // its dash offset begins travelling through the bends.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (nextSequence !== sequence) return;
      connector.classList.add("is-visible");
      schedule(() => {
        if (nextSequence !== sequence) return;
        panel.classList.add("is-visible");
      }, getTimings().lineDraw);
    }));
  }

  /** Hides the card first and retracts the connector only after it has gone. */
  function close({ onComplete } = {}) {
    const nextSequence = ++sequence;
    clearTimers();

    if (panel.hidden) {
      onComplete?.();
      return;
    }

    const timings = getTimings();
    panel.classList.remove("is-visible");
    panel.classList.add("is-closing");
    panel.setAttribute("aria-hidden", "true");

    schedule(() => {
      if (nextSequence !== sequence) return;
      connector.classList.add("is-retiring");
      connector.classList.remove("is-visible");
    }, timings.panelExit);

    schedule(() => {
      if (nextSequence !== sequence) return;
      panel.hidden = true;
      // Restore the real SVG attribute once the final retract animation ends;
      // CSS then removes the connector from painting and hit testing entirely.
      connector.setAttribute("hidden", "");
      panel.classList.remove("is-closing");
      connector.classList.remove("is-retiring");
      activeAnchor = null;
      activeLayout = null;
      onComplete?.();
    }, timings.panelExit + timings.lineRetract);
  }

  function isOpen() {
    return !panel.hidden;
  }

  function getLayout() {
    return activeLayout;
  }

  function getAnchor() {
    return activeAnchor;
  }

  /*
   * Seal the card off from the scene behind it.
   *
   * The application listens for clicks on `window` to travel into whatever
   * region was clicked. A click on this card -- the close button above all --
   * bubbled all the way up and was read as a click on empty space, so
   * dismissing the explanation also flew the camera somewhere. Stopping the
   * pointer events at the panel leaves its own controls working and takes the
   * card out of the scene's input path entirely.
   */
  ["pointerdown", "pointerup", "click", "dblclick", "contextmenu"].forEach((type) => {
    panel.addEventListener(type, (event) => event.stopPropagation());
  });

  function handleViewportChange() {
    if (!panel.hidden) position();
  }

  window.addEventListener("resize", handleViewportChange);

  return {
    elements,
    open,
    close,
    position,
    isOpen,
    getLayout,
    getAnchor,
    dispose() {
      ++sequence;
      clearTimers();
      window.removeEventListener("resize", handleViewportChange);
      layer.remove();
    },
  };
}

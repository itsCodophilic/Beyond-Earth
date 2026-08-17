/**
 * Creates the cinematic project-information sequence opened by the brand.
 *
 * Reveal order:
 *   1. Freeze and blur the universe.
 *   2. Keep the Beyond Earth emblem visibly anchored in place.
 *   3. Draw a bent luminous route from that emblem.
 *   4. Materialize the central project card.
 *
 * Closing reverses that order. A custom event lets main.js pause its Three.js
 * simulation without coupling this DOM component to renderer internals.
 */
export function createAboutExperiencePanel({ trigger }) {
  if (!trigger) return null;

  let layer = document.querySelector("#about-experience-panel");
  if (!layer) {
    layer = document.createElement("section");
    layer.id = "about-experience-panel";
    layer.className = "about-experience";
    layer.hidden = true;
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("aria-labelledby", "about-experience-title");
    layer.innerHTML = `
      <div class="about-experience__backdrop" data-about-dismiss></div>
      <div class="brand about-experience__brand-anchor" aria-hidden="true">
        ${trigger.innerHTML}
      </div>
      <svg class="about-experience__connector" aria-hidden="true" preserveAspectRatio="none">
        <path></path>
        <circle class="about-experience__connector-origin" r="3.5"></circle>
      </svg>
      <span class="about-experience__connector-port" aria-hidden="true"></span>
      <article class="about-experience__card">
        <button class="about-experience__close" type="button" aria-label="Close Beyond Earth information">×</button>

        <div class="about-experience__eyebrow">
          <span>Beyond Earth</span>
          <span>An interactive universe, built to scale</span>
        </div>

        <!--
          The two lines are the whole argument for the project, so they are the
          largest type in the product. The turn between them is what the second
          line is for, which is why it takes the accent colour.
        -->
        <h2 id="about-experience-title">
          <span class="about-experience__cosmic-word" data-cosmic>Almost none of us will ever leave the ground.</span>
          <span class="about-experience__cosmic-word about-experience__cosmic-word--accent" data-cosmic>Any one of us can leave the planet.</span>
        </h2>

        <p class="about-experience__intro about-experience__cosmic-copy" data-cosmic>
          Beyond Earth is a place to go, not a page to read. The orbits are solved from real ephemerides, the worlds are the sizes and distances they genuinely are, and the belt between Mars and Jupiter holds the rocks it actually holds. Start at the world you know. Then keep going.
        </p>

        <p class="about-experience__vision about-experience__cosmic-copy" data-cosmic>
          Drift out past Mars into the debris of a planet that never formed. Watch Saturn's rings resolve from a band of light into a hundred thousand kilometres of ice. Fall beyond Neptune into the dark, where the Sun is only the brightest star. Stay as long as you like — nothing out here is in a hurry.
        </p>

        <footer class="about-experience__author">
          <span>Created with curiosity by <strong>Harsh Pandya</strong></span>
          <span aria-hidden="true">·</span>
          <a href="mailto:harshpandya0111@gmail.com">harshpandya0111@gmail.com</a>
        </footer>
      </article>
    `;
    document.body.append(layer);
  }

  const card = layer.querySelector(".about-experience__card");
  const brandAnchor = layer.querySelector(".about-experience__brand-anchor");
  const closeButton = layer.querySelector(".about-experience__close");
  const connector = layer.querySelector(".about-experience__connector");
  // Start with no route at all, so nothing can be drawn before one is solved.
  connector?.style.setProperty("--connector-length", "0px");
  const connectorPath = connector?.querySelector("path");
  const originDot = connector?.querySelector(".about-experience__connector-origin");
  const connectorPort = layer.querySelector(".about-experience__connector-port");
  const cosmicTargets = card
    ? Array.from(card.querySelectorAll("[data-cosmic]"))
    : [];

  let open = false;
  let lockedScrollY = 0;
  let closeTimer = null;
  let focusTimer = null;
  let routeTimer = null;
  let cardTimer = null;
  let cosmicFrame = null;
  let pendingCosmicPointer = null;
  let activeCosmicTarget = null;
  let lastCharacterRippleAt = -Infinity;
  let lastCharacterRippleX = -Infinity;
  let lastCharacterRippleY = -Infinity;
  let previouslyFocused = null;

  /**
   * Splits readable copy into word-safe character spans. Words still wrap like
   * normal prose, while individual glyphs can react to the cursor independently.
   * The original sentence remains available to assistive technology.
   */
  function prepareCosmicCharacters(element) {
    const originalText = element.textContent.replace(/\s+/g, " ").trim();
    element.setAttribute("aria-label", originalText);
    element.textContent = "";

    originalText.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        element.append(document.createTextNode(" "));
        return;
      }

      const word = document.createElement("span");
      word.className = "about-experience__cosmic-token";
      word.setAttribute("aria-hidden", "true");
      Array.from(part).forEach((character) => {
        const glyph = document.createElement("span");
        glyph.className = "about-experience__cosmic-character";
        glyph.textContent = character;
        word.append(glyph);
      });
      element.append(word);
    });
  }

  cosmicTargets.forEach(prepareCosmicCharacters);

  function clearSequenceTimers() {
    if (routeTimer) clearTimeout(routeTimer);
    if (cardTimer) clearTimeout(cardTimer);
    routeTimer = null;
    cardTimer = null;
  }

  function resetCosmicCharacters(target = activeCosmicTarget) {
    target?.querySelectorAll(".about-experience__cosmic-character").forEach((glyph) => {
      glyph.classList.remove("is-reacting");
      glyph.classList.remove("is-rippling");
      glyph.style.removeProperty("--cosmic-character-x");
      glyph.style.removeProperty("--cosmic-character-y");
      glyph.style.removeProperty("--cosmic-character-turn");
      glyph.style.removeProperty("--cosmic-character-scale");
      glyph.style.removeProperty("--cosmic-ripple-lift");
      glyph.style.removeProperty("--cosmic-ripple-settle");
      glyph.style.removeProperty("--cosmic-ripple-delay");
    });
  }

  /**
   * Characters closest to the pointer lift, rotate, and brighten without ever
   * changing the original wording or disturbing the sentence layout.
   */
  function animateCosmicCharacters({ target, clientX, clientY, now }) {
    const targetChanged = activeCosmicTarget !== target;
    if (activeCosmicTarget && targetChanged) {
      resetCosmicCharacters(activeCosmicTarget);
    }
    activeCosmicTarget = target;

    const pointerTravel = Math.hypot(
      clientX - lastCharacterRippleX,
      clientY - lastCharacterRippleY,
    );
    const shouldPassRipple = targetChanged
      || pointerTravel > 20
      || now - lastCharacterRippleAt > 420;
    const rippleCharacters = [];

    target.querySelectorAll(".about-experience__cosmic-character").forEach((glyph) => {
      const rect = glyph.getBoundingClientRect();
      const deltaX = clientX - (rect.left + rect.width / 2);
      const deltaY = clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(deltaX, deltaY);
      // Keep the response local to the letter under the cursor and its closest
      // neighbours instead of illuminating an entire word at once.
      const influence = Math.max(0, 1 - distance / 46);
      const rippleInfluence = Math.max(0, 1 - distance / 78);

      if (shouldPassRipple && rippleInfluence > 0) {
        const rippleLift = 0.45 + rippleInfluence * 1.55;
        glyph.style.setProperty("--cosmic-ripple-lift", `${rippleLift}px`);
        glyph.style.setProperty("--cosmic-ripple-settle", `${rippleLift * 0.28}px`);
        glyph.style.setProperty("--cosmic-ripple-delay", `${Math.round(distance * 2.15)}ms`);
        rippleCharacters.push(glyph);
      }

      if (influence <= 0) {
        glyph.classList.remove("is-reacting");
        glyph.style.removeProperty("--cosmic-character-x");
        glyph.style.removeProperty("--cosmic-character-y");
        glyph.style.removeProperty("--cosmic-character-turn");
        glyph.style.removeProperty("--cosmic-character-scale");
        return;
      }

      glyph.style.setProperty("--cosmic-character-x", `${deltaX * influence * 0.045}px`);
      glyph.style.setProperty("--cosmic-character-y", `${deltaY * influence * 0.06 - influence * 3}px`);
      glyph.style.setProperty("--cosmic-character-turn", `${deltaX * influence * 0.09}deg`);
      glyph.style.setProperty("--cosmic-character-scale", String(1 + influence * 0.16));
      glyph.classList.toggle("is-reacting", influence > 0.08);
    });

    if (shouldPassRipple && rippleCharacters.length) {
      target.querySelectorAll(".about-experience__cosmic-character.is-rippling")
        .forEach((glyph) => glyph.classList.remove("is-rippling"));
      // One layout read restarts the wave as a group, preserving the staggered
      // delay that makes it feel like motion passing through nearby letters.
      target.getBoundingClientRect();
      rippleCharacters.forEach((glyph) => glyph.classList.add("is-rippling"));
      lastCharacterRippleAt = now;
      lastCharacterRippleX = clientX;
      lastCharacterRippleY = clientY;
    }
  }

  /**
   * Positions a routed line from the emblem into a dedicated port on the card.
   *
   * The connector is rendered one layer behind the card. Its last point lands
   * at the port centre on the card border, so the card masks every fraction of
   * the line after the border. This gives a real connection without either the
   * old V-shaped intrusion or the detached floating endpoint.
   */
  function positionConnector() {
    if (!connector || !connectorPath || !card || !connectorPort || layer.hidden) return;

    const triggerRect = trigger.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Read both the card and its port in the final resting transform. During the
    // opening sequence the card initially uses a scaled/tilted transform, which
    // would otherwise shift the route after it has already been drawn.
    card.classList.add("is-connector-measuring");
    const finalCardRect = card.getBoundingClientRect();
    card.classList.remove("is-connector-measuring");

    const startX = Number((triggerRect.right - 13).toFixed(2));
    const startY = Number((triggerRect.bottom - 4).toFixed(2));
    const edgeInset = Math.min(72, Math.max(48, finalCardRect.width * 0.085));
    const minimumPortX = finalCardRect.left + edgeInset;
    const maximumPortX = finalCardRect.right - edgeInset;
    // Keep the destination comfortably to the right of the emblem origin when
    // space allows. On narrower screens the old fixed offset could put the port
    // behind the start point and make the route double back on itself.
    const preferredPortX = Math.max(minimumPortX, startX + 80);
    const endX = Number(Math.min(preferredPortX, maximumPortX).toFixed(2));
    const endY = Number(finalCardRect.top.toFixed(2));

    // Keep all waypoints outside the card. Only the final endpoint reaches the
    // border port; because the SVG sits behind the card, no line can be visible
    // inside the glass panel even with the connector's glow/filter applied.
    const horizontalX = Math.min(startX + 30, endX - 58);
    const minimumApproachX = horizontalX + Math.min(24, (endX - horizontalX) * 0.35);
    const approachX = Math.min(
      endX - 24,
      Math.max(minimumApproachX, finalCardRect.left - 14),
    );
    const verticalDelta = endY - startY;
    const approachY = verticalDelta >= 0
      ? Math.min(endY - 10, startY + Math.max(8, verticalDelta * 0.48))
      : Math.max(endY + 10, startY + Math.min(-8, verticalDelta * 0.48));

    if (brandAnchor) {
      brandAnchor.style.left = `${triggerRect.left}px`;
      brandAnchor.style.top = `${triggerRect.top}px`;
      brandAnchor.style.width = `${triggerRect.width}px`;
      brandAnchor.style.height = `${triggerRect.height}px`;
    }

    // The port is a sibling of the scrollable card so it cannot be clipped by
    // the card's overflow:auto. It sits exactly over the top border and covers
    // the path endpoint, producing one intentional joint rather than an overlap.
    connectorPort.style.left = `${endX}px`;
    connectorPort.style.top = `${endY}px`;

    connector.setAttribute("viewBox", `0 0 ${width} ${height}`);
    connectorPath.setAttribute(
      "d",
      [
        `M ${startX} ${startY}`,
        `L ${horizontalX.toFixed(2)} ${startY}`,
        `L ${approachX.toFixed(2)} ${approachY.toFixed(2)}`,
        `L ${endX} ${endY}`,
      ].join(" "),
    );
    // Same fix as the distance connector: an absolute dash cannot be rescaled
    // through pathLength, so the line has to be told how long it actually is.
    connector.style.setProperty(
      "--connector-length",
      `${connectorPath.getTotalLength().toFixed(2)}px`,
    );
    originDot?.setAttribute("cx", String(startX));
    originDot?.setAttribute("cy", String(startY));
  }

  function dispatchState(isOpen) {
    window.dispatchEvent(new CustomEvent("beyond-earth:about-state", {
      detail: { open: isOpen },
    }));
  }

  function lockBackground() {
    lockedScrollY = window.scrollY;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.classList.add("is-about-experience-open");
  }

  function unlockBackground() {
    document.body.classList.remove("is-about-experience-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    window.scrollTo({ top: lockedScrollY, left: 0, behavior: "auto" });
  }

  function show() {
    if (open) return;
    open = true;
    previouslyFocused = document.activeElement;
    if (closeTimer) clearTimeout(closeTimer);
    if (focusTimer) clearTimeout(focusTimer);
    clearSequenceTimers();

    lockBackground();
    layer.hidden = false;
    layer.setAttribute("aria-hidden", "false");
    layer.classList.remove(
      "is-closing",
      "is-open",
      "is-brand-ready",
      "is-route-drawing",
      "is-card-visible",
    );
    trigger.setAttribute("aria-expanded", "true");

    // Place the emblem first. The route waits long enough for that origin to be
    // visually understood, and only then introduces the information card. This
    // first state is synchronous so pausing the WebGL director cannot postpone
    // the emblem until a later animation frame.
    positionConnector();
    layer.getBoundingClientRect();
    layer.classList.add("is-open", "is-brand-ready");
    dispatchState(true);
    routeTimer = setTimeout(() => layer.classList.add("is-route-drawing"), 420);
    cardTimer = setTimeout(() => layer.classList.add("is-card-visible"), 1180);

    focusTimer = setTimeout(() => closeButton?.focus(), 1460);
  }

  function hide() {
    if (!open) return;
    open = false;
    if (focusTimer) clearTimeout(focusTimer);
    clearSequenceTimers();
    resetCosmicCharacters();
    activeCosmicTarget = null;
    pendingCosmicPointer = null;
    if (cosmicFrame) cancelAnimationFrame(cosmicFrame);
    cosmicFrame = null;
    layer.classList.add("is-closing");
    layer.classList.remove("is-open", "is-card-visible");
    layer.setAttribute("aria-hidden", "true");
    trigger.setAttribute("aria-expanded", "false");

    closeTimer = setTimeout(() => {
      layer.hidden = true;
      layer.classList.remove("is-closing", "is-brand-ready", "is-route-drawing");
      unlockBackground();
      dispatchState(false);
      previouslyFocused?.focus?.();
      closeTimer = null;
    }, 820);
  }

  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    show();
  });

  closeButton?.addEventListener("click", hide);
  layer.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-about-dismiss]")) hide();
  });

  // The cursor gently disturbs nearby characters only while it crosses
  // readable content; the original wording always remains intact.
  card?.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const target = event.target.closest?.("[data-cosmic]");
    const cardX = event.clientX - rect.left + card.scrollLeft;
    const cardY = event.clientY - rect.top + card.scrollTop;
    card.style.setProperty("--cosmic-x", `${cardX}px`);
    card.style.setProperty("--cosmic-y", `${cardY}px`);
    card.classList.toggle("is-cosmic-hover", Boolean(target));

    if (!target) {
      resetCosmicCharacters();
      activeCosmicTarget = null;
      return;
    }

    pendingCosmicPointer = {
      target,
      clientX: event.clientX,
      clientY: event.clientY,
      now: performance.now(),
    };
    if (!cosmicFrame) {
      cosmicFrame = requestAnimationFrame(() => {
        cosmicFrame = null;
        if (pendingCosmicPointer) animateCosmicCharacters(pendingCosmicPointer);
      });
    }
  });
  card?.addEventListener("pointerleave", () => {
    card.classList.remove("is-cosmic-hover");
    resetCosmicCharacters();
    activeCosmicTarget = null;
    pendingCosmicPointer = null;
  });

  // Some browsers can skip pointerleave when the cursor crosses a transformed
  // card edge quickly. The full-screen layer provides a reliable second guard.
  layer.addEventListener("pointermove", (event) => {
    if (event.target.closest?.(".about-experience__card")) return;
    card?.classList.remove("is-cosmic-hover");
    resetCosmicCharacters();
    activeCosmicTarget = null;
    pendingCosmicPointer = null;
  });

  window.addEventListener("resize", positionConnector, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      hide();
      return;
    }

    // Keep keyboard focus inside the modal while the universe is frozen.
    if (event.key === "Tab") {
      const focusable = Array.from(layer.querySelectorAll("button, a[href]"))
        .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, true);

  return { show, hide, isOpen: () => open };
}

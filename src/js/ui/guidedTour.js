/**
 * The first-run walkthrough.
 *
 * ## Why this replaced a permanent strip
 *
 * The controls used to be explained by a bar that sat in the header forever:
 * "Click empty space · Click a celestial body · Esc Exit current view". It had
 * the failing every persistent hint has -- it is read once, by which point it
 * has taught you everything it is ever going to, and then it occupies a
 * quarter of the header for the rest of the session next to the thing it is
 * describing.
 *
 * ## Why the scene dims behind it
 *
 * The first version did not dim, on the reasoning that a card which darkens
 * the Solar System to explain the Solar System teaches nothing. That reasoning
 * was wrong for the steps that matter most. These are *instructions to do
 * something* -- scroll, drag, click a rock -- and against a live scene full of
 * moving planets there is nothing telling the eye which of the two things on
 * screen it is meant to attend to. Darkening and blurring the scene answers
 * that: the instruction is the only sharp thing in the frame.
 *
 * The blur is on the canvas rather than an overlay colour, so the scene stays
 * *recognisable* -- you can see it is the Solar System back there, softened,
 * which is what makes the dimming read as "attend here for a moment" rather
 * than "the experience has stopped".
 *
 * ## Steps that ask you to do the thing
 *
 * Where a step teaches a gesture, it watches for that gesture and confirms it:
 * scroll to zoom, drag to rotate. The confirmation is the whole point -- being
 * told that scrolling zooms is worth much less than scrolling once and seeing
 * it acknowledged. It never *requires* the gesture; the Next button is always
 * live, because a tour that will not advance until you perform correctly is a
 * hostage situation rather than an explanation.
 *
 * ## Remembering the answer
 *
 * Finishing or skipping is stored, so it never runs twice. `localStorage`
 * throws outright in some privacy modes rather than returning null, so every
 * access is wrapped -- an unreadable store means the tour simply runs again,
 * which is the harmless direction to fail in.
 */

/*
 * ## Why it runs every time
 *
 * It used to record that it had finished, so it never ran twice. That is the
 * usual choice and it was the wrong one here: the record lives in
 * `localStorage`, which belongs to the browser rather than to the project, so
 * a single session spent testing the walkthrough silently turned it off for
 * the owner of the site with nothing on screen to say why. The failure is not
 * really "the flag got set" -- it is that a piece of the experience could be
 * switched off by something outside the experience, invisibly and
 * irreversibly. It now runs on every load. Skip is one click and takes half a
 * second; a wrong "never again" costs a great deal more than that.
 */

/**
 * How much of the scene a step covers.
 *
 *   full  -- dark wash, canvas blurred. For the steps that are instructions
 *            about the controls: there is nothing on screen worth attending to
 *            except the card.
 *   soft  -- light wash, gentle blur, the step's subject lifted above it. For
 *            pointing at something that is already on screen.
 *   clear -- nothing at all. For the steps where the scene *is* the exercise:
 *            you cannot ask somebody to pick a small world out of the dark and
 *            then dim the dark.
 */
/**
 * The steps, in the order someone actually learns this interface.
 *
 * Movement first, because nothing else is usable until you can move: zoom,
 * then travel, then turn. Only then what to click, and last what is here to
 * find. Every `gesture` names a real input the scene already listens for; the
 * tour listens alongside rather than intercepting, so practising the gesture
 * during the step really does move the camera.
 */
const STEPS = [
  {
    id: "zoom",
    title: "Scroll to zoom in and out",
    body: "The wheel is the throttle. Roll it forward and the camera falls in toward the Sun; roll it back and the whole system opens out past Neptune and the Kuiper worlds.",
    hint: "Try it now — scroll either way.",
    gesture: "wheel",
    veil: "full",
    clicks: "none",
    done: "That is the entire journey, under one finger.",
  },
  {
    id: "tilt",
    title: "Tilt up and over the plane",
    body: "Drag upward or downward — or use the ↑ and ↓ keys — and the camera rises above the orbits or drops beneath them. The planets all travel in one flat disc, and this is how you get to see it as a disc.",
    hint: "Try it — drag up and down, or press ↑ and ↓.",
    gesture: "tilt",
    veil: "full",
    clicks: "none",
    done: "From above, the orbits stop overlapping and read as rings.",
  },
  {
    id: "rotate",
    title: "Turn all the way around",
    body: "Drag left or right — or use ← and → — to swing the camera around the system. It works at any moment, including while a world is focused and while an event is playing, so you can always bring the lit side or the night side into view.",
    hint: "Try it — drag sideways, or press ← and →.",
    gesture: "rotate",
    veil: "full",
    clicks: "none",
    done: "Nothing is ever stuck facing away from you.",
  },
  {
    id: "space",
    title: "Click empty space to travel there",
    body: "Clicking where there is nothing flies you out into that region, and scrolling closes the rest of the distance. It is how you get inside the asteroid belt instead of looking at it from outside.",
    hint: "Pick a dark patch, click it, then scroll in.",
    gesture: "space-click",
    // Only empty space answers a click here. The three steps before this one
    // answer nothing at all. See the note where main.js handles it.
    clicks: "space",
    veil: "full",
    done: "You are on your way. Scroll to arrive.",
  },
  {
    id: "planet",
    title: "Go to Earth, and click on it",
    body: "You have been brought within sight of it rather than onto it, because arriving is the part worth doing yourself. Scroll to close the distance — then click it. Scrolling brings you near; the click is what takes you there.",
    hint: "Scroll in, then click Earth.",
    gesture: "body-click",
    action: "approach-earth",
    // Only Earth answers. The belt, the orbit lines and every other world stop
    // taking a click, so "click Earth" cannot resolve to anything else.
    clicks: "only",
    only: ["Earth"],
    // The scene is the exercise from here on: no wash, no blur. Asking somebody
    // to find a small blue disc and then dimming the frame it is in would be a
    // strange thing to do.
    veil: "clear",
    done: "That is how you reach every world in the system.",
  },
  {
    id: "read",
    title: "Open and close the info card",
    body: "Arriving opens a card with what is actually known about the world: real diameter, real orbital speed, its real distance from Earth at this moment. Open it for the full dossier — atmosphere, rotation, gravity, what we learned and from which mission — then close it again to get the view back.",
    hint: "Open the card, then close it.",
    gesture: "details",
    done: "Every world in the system carries one of those.",
    // Soft rather than full: the thing being pointed at is on screen and is the
    // point, so it is lifted out of a light blur instead of shouted over a dark
    // one.
    veil: "soft",
    anchor: ".celestial-selection-card, #body-card, .planet-details.is-open, .planet-details",
  },
  {
    id: "moons",
    title: "Look for the moon, and click on it",
    body: "A world arrives with its satellites, and Earth brought one. Click it the same way you clicked Earth. Jupiter brings all 95 of its moons, Saturn's rings resolve into orbiting ice, and the small worlds past Neptune bring theirs — every one of them selectable in its own right, with its own real distance from Earth.",
    // The Moon really can be behind Earth or off the side of the frame when
    // this step opens -- measured once at 2,287px on a 1,470px viewport. Saying
    // so turns "I cannot see it" into the drag they were taught two steps ago.
    hint: "Look just off Earth — turn if you cannot see it — then click.",
    gesture: "body-click",
    clicks: "only",
    only: ["Moon"],
    veil: "clear",
    done: "Every moon in the system works exactly like that.",
  },
  {
    id: "escape",
    title: "Escape steps back one view",
    body: "You went to Earth, then to its moon. Escape — or this control — undoes that one move at a time: press it once and you are back at Earth, press it again and you are back in open space. It is a step backwards along the way you came, not a reset.",
    hint: "Click the control up there, or press Esc.",
    gesture: "escape",
    clicks: "none",
    unlocks: "exit",
    veil: "soft",
    anchor: "#space-exit-control",
    done: "Back one view. Press it again to keep going back.",
  },
  {
    id: "events",
    title: "Things out here that really happen",
    body: "Impacts, eruptions, dust storms, a sungrazing comet, a supernova lighting the sky. Open this to read what each one is, how often it occurs and why. Watching one takes you to the world it happens on, so that waits until the tour is done — the button will be there when you are.",
    hint: "Click it and have a look.",
    gesture: "click",
    target: "#space-events-trigger",
    clicks: "none",
    unlocks: "events",
    veil: "soft",
    anchor: "#space-events-trigger",
    done: "Seventeen of them, each on the world it belongs to.",
  },
  {
    id: "spacemode",
    title: "Space mode takes the interface away",
    body: "Everything drawn over the scene is there because the scene alone does not say what you are looking at: which ellipse belongs to which planet, what that speck is, how far away it is. All of it is also, sometimes, in the way. This switch removes the lot — orbit lines, cards, labels, readouts — and leaves the worlds. The same switch brings it back.",
    hint: "Click the switch and watch the orbit lines go.",
    gesture: "click",
    target: "#space-mode-toggle",
    clicks: "none",
    unlocks: "spacemode",
    veil: "soft",
    anchor: "#space-mode-toggle",
    done: "Two ways of looking at the same scene.",
  },
  {
    id: "systemreturn",
    title: "One press back to the whole system",
    body: "You are at Earth again. Escape would walk you back the way you came, one view at a time — this does it in a single move, from wherever you are, however deep you went. It is how you start a new journey without retracing the last one.",
    hint: "Click it and watch the system open out.",
    gesture: "click",
    target: "#system-return-button",
    clicks: "none",
    action: "focus-earth",
    unlocks: "systemreturn",
    veil: "soft",
    anchor: "#system-return-button",
    done: "The whole Solar System, from one press.",
  },
  {
    id: "distance",
    title: "Every distance here is measured, Click the unit",
    body: "The figure in the corner is not decoration. It is the real separation between the camera and Earth, in whatever unit fits the scale — kilometres near a world, astronomical units across the system, light-years beyond it. The unit and the method are both clickable: they say what the unit means and how the number was arrived at.",
    hint: "Click the unit, or \u201chow is this distance measured\u201d.",
    gesture: "click",
    target: "[data-distance-unit], #distance-measurement-info",
    clicks: "none",
    // Forced to the side. The card's natural placement is above this anchor,
    // which is exactly where the popover it is asking the viewer to open
    // appears -- the explanation would have opened underneath the card telling
    // them to open it.
    place: "side",
    unlocks: "distance",
    veil: "soft",
    anchor: ".progress.distance-readout",
    done: "Nothing in this experience is a made-up number.",
  },
  {
    id: "beyondearth",
    title: "Beyond Earth",
    body: "That is the whole of it. The orbits are solved from real ephemerides, the worlds are the sizes and distances they genuinely are, and the belt between Mars and Jupiter holds the rocks it actually holds. The wordmark up there opens what this is and who made it — and it is where you will find this walkthrough again, any time you want it.",
    hint: "It lives up there, whenever you want it.",
    // The closing step points at the one part of the interface it has not
    // explained, which is also the way back to itself.
    anchor: ".brand",
    veil: "soft",
    clicks: "none",
    // The one step with a third button. It is the last thing on screen before
    // the interface is handed over, which is the moment somebody decides they
    // would rather have seen that again.
    replay: true,
  },
];

export function createGuidedTour({ force = false } = {}) {
  // `force` is kept for the replay control, which calls this directly. There is
  // no stored answer to override any more -- see the note at the top of the
  // file -- so the parameter is now only about intent.
  void force;
  let started = false;
  let api = null;
  return {
    start() {
      if (started) return api;
      started = true;
      api = beginGuidedTour();
      return api;
    },
    get isOpen() { return Boolean(api?.isOpen); },
    finish() { api?.finish(); },
  };
}

/*
 * The tour that is currently on screen, if any.
 *
 * There are three ways in -- the first run, the card's own replay control, and
 * the "Replay the guided tour" button in the About panel -- and until now only
 * the first two knew about each other. The third is reachable *from the last
 * step*, which points at the wordmark that opens that panel, so the obvious
 * path through the interface was: read step 13, click the wordmark it is
 * pointing at, press replay, and end up with step 13 and step 1 on screen at
 * the same time. Reported with a screenshot of exactly that.
 *
 * Rather than teach each entry point to check, starting a tour retires
 * whatever is already running. There can only be one.
 */
let activeTour = null;

function beginGuidedTour() {
  activeTour?.finish();
  // Not left to the closing fade: the replacement is built in this same tick
  // and the two would overlap for the length of it.
  document.querySelectorAll(".tour").forEach((stale) => stale.remove());

  const layer = document.createElement("div");
  layer.className = "tour";
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-label", "Getting around Beyond Earth");
  layer.innerHTML = `
    <div class="tour__veil" aria-hidden="true"></div>
    <div class="tour__spotlight" aria-hidden="true"></div>
    <article class="tour__card" role="document">
      <div class="tour__rail" aria-hidden="true"></div>
      <span class="tour__progress"></span>
      <h2 class="tour__title"></h2>
      <p class="tour__body"></p>
      <p class="tour__hint" hidden></p>
      <div class="tour__actions">
        <button class="tour__skip" type="button">Skip tour</button>
        <button class="tour__replay" type="button" hidden>Replay the tour</button>
        <button class="tour__next" type="button"></button>
      </div>
    </article>
  `;
  document.body.append(layer);

  const veil = layer.querySelector(".tour__veil");
  const spotlight = layer.querySelector(".tour__spotlight");
  const card = layer.querySelector(".tour__card");
  const rail = layer.querySelector(".tour__rail");
  const progress = layer.querySelector(".tour__progress");
  const title = layer.querySelector(".tour__title");
  const body = layer.querySelector(".tour__body");
  const hint = layer.querySelector(".tour__hint");
  const skipButton = layer.querySelector(".tour__skip");
  const nextButton = layer.querySelector(".tour__next");
  const replayButton = layer.querySelector(".tour__replay");

  rail.innerHTML = STEPS.map(() => '<span class="tour__pip"></span>').join("");
  const pips = [...rail.querySelectorAll(".tour__pip")];

  let index = 0;
  let finished = false;
  let satisfied = false;
  let dragOrigin = null;

  /*
   * The gesture watchers.
   *
   * Registered once on window in the *bubble* phase and never cancelling
   * anything, so the scene receives every one of these events normally and the
   * practice gesture really does move the camera. The tour is an observer
   * here, not an interceptor.
   */
  /*
   * Completing a step carries you to the next one.
   *
   * Pressing Next after doing the thing the card asked for is a second, emptier
   * gesture -- the viewer has already told the tour they are ready. So a
   * satisfied step advances on its own, after long enough to read the line
   * confirming what just happened. Next stays, for anyone who would rather
   * press it and for the steps that ask for nothing.
   *
   * Never on the last step: finishing the tour is a decision, not something
   * that should happen while somebody is still reading.
   */
  const AUTO_ADVANCE_MS = 2300;
  let autoAdvanceTimer = null;

  function cancelAutoAdvance() {
    if (!autoAdvanceTimer) return;
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = null;
  }

  function markSatisfied() {
    if (satisfied || finished) return;
    const step = STEPS[index];
    if (!step.gesture) return;
    satisfied = true;
    if (index < STEPS.length - 1) {
      cancelAutoAdvance();
      autoAdvanceTimer = setTimeout(() => {
        autoAdvanceTimer = null;
        if (!finished && STEPS[index] === step) advance();
      }, AUTO_ADVANCE_MS);
    }
    layer.classList.add("is-satisfied");
    // The veil lifts as the reward. Performing the gesture is the moment the
    // step is *about*, and the scene coming back into focus says so without a
    // word of copy.
    document.body.classList.add("is-tour-satisfied");
    if (step.done) {
      hint.textContent = step.done;
      hint.hidden = false;
    }
  }

  const onWheel = () => { if (STEPS[index]?.gesture === "wheel") markSatisfied(); };
  const onPointerDown = (event) => {
    if (event.target.closest?.(".tour__card")) return;
    dragOrigin = { x: event.clientX, y: event.clientY };
    const gesture = STEPS[index]?.gesture;
    // A click on the scene satisfies both click steps; which one it was is
    // decided by what the application ends up focusing, checked on pointerup.
    // A step that names the world it wants is satisfied by reaching that world
    // (see `onTargetReached`), not by any press on the scene.
    if (gesture === "space-click" || (gesture === "body-click" && !STEPS[index]?.only)) {
      layer.dataset.pending = "1";
    }
  };
  /*
   * Tilting and turning are the same input distinguished only by direction, so
   * the axis that has travelled furthest decides which one the viewer meant.
   * The threshold is deliberately generous: nobody drags in a straight line,
   * and a step that refuses to acknowledge a slightly diagonal drag reads as
   * broken rather than as strict.
   */
  const onPointerMove = (event) => {
    if (!dragOrigin) return;
    const gesture = STEPS[index]?.gesture;
    if (gesture !== "tilt" && gesture !== "rotate") return;
    const dx = event.clientX - dragOrigin.x;
    const dy = event.clientY - dragOrigin.y;
    if (Math.hypot(dx, dy) < 26) return;
    if (gesture === "tilt" && Math.abs(dy) >= Math.abs(dx) * 0.7) markSatisfied();
    if (gesture === "rotate" && Math.abs(dx) >= Math.abs(dy) * 0.7) markSatisfied();
  };
  const onPointerUp = () => {
    if (layer.dataset.pending === "1") {
      layer.dataset.pending = "";
      markSatisfied();
    }
    dragOrigin = null;
  };
  /*
   * The later steps are each about one control, so each is satisfied by that
   * control being used.
   *
   * A step names a selector rather than the tour learning what a mode switch
   * or a return button is; the capture phase is used so the control's own
   * handler stopping propagation cannot hide the press from us, and nothing is
   * cancelled, so the control does exactly what the card says it will.
   */
  const onControlClick = (event) => {
    const step = STEPS[index];
    if (step?.gesture !== "click" || !step.target) return;
    if (event.target.closest?.(step.target)) markSatisfied();
  };

  /*
   * Escape is the one gesture with two spellings, and the key is the one being
   * taught -- so on that step the tour must not swallow it (see the keydown
   * handler below, which otherwise closes the tour).
   */
  const onEscapeGesture = (event) => {
    if (STEPS[index]?.gesture !== "escape") return;
    if (event.type === "keydown" && event.key !== "Escape") return;
    if (event.type === "pointerdown" && !event.target.closest?.("#space-exit-control")) return;
    markSatisfied();
  };

  /*
   * The dossier step is satisfied by the panel actually opening.
   *
   * It is the one step whose gesture is not an input but a result -- there are
   * several ways to open the card and the tour should not care which was used
   * -- so it listens for the panel's own state event rather than watching for
   * a click on a particular control.
   */
  const onTargetReached = (event) => {
    const step = STEPS[index];
    if (!step?.only) return;
    if (step.only.includes(event.detail?.name)) markSatisfied();
  };

  const onDetailsState = (event) => {
    if (STEPS[index]?.gesture !== "details") return;
    if (event.detail?.open) markSatisfied();
  };

  // The arrow keys drive the same two camera targets as dragging, and the copy
  // offers them as the alternative, so they have to count as the gesture too.
  const onArrowKey = (event) => {
    const gesture = STEPS[index]?.gesture;
    if (gesture === "tilt" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      markSatisfied();
    }
    if (gesture === "rotate" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      markSatisfied();
    }
  };

  addEventListener("wheel", onWheel, { passive: true });
  addEventListener("pointerdown", onPointerDown, { passive: true });
  addEventListener("pointermove", onPointerMove, { passive: true });
  addEventListener("pointerup", onPointerUp, { passive: true });
  addEventListener("keydown", onArrowKey, { passive: true });
  addEventListener("beyond-earth:planet-details-state", onDetailsState);
  addEventListener("beyond-earth:tour-target-reached", onTargetReached);
  addEventListener("pointerdown", onControlClick, { capture: true, passive: true });
  // Also on `click`, so keyboard activation of the same control counts.
  addEventListener("click", onControlClick, { capture: true, passive: true });
  addEventListener("pointerdown", onEscapeGesture, { capture: true, passive: true });
  addEventListener("keydown", onEscapeGesture, { capture: true, passive: true });

  let subject = null;

  /*
   * The first anchor that is actually on screen, not the first one written.
   *
   * `querySelector` with a comma list returns the earliest match in *document*
   * order, which has nothing to do with the order the selectors were listed
   * in. The "read about it" step names three surfaces because which of them is
   * up depends on what the viewer clicked and whether they have opened the
   * full dossier, and it wants whichever is currently visible.
   */
  function resolveAnchor(selector) {
    if (!selector) return null;
    for (const part of selector.split(",")) {
      const candidate = document.querySelector(part.trim());
      if (!candidate) continue;
      const rect = candidate.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (candidate.getAttribute("aria-hidden") === "true") continue;
      const style = getComputedStyle(candidate);
      if (style.display === "none" || style.visibility === "hidden") continue;
      /*
       * Opacity is the last test and not the only one, because these panels
       * fade in: for the few hundred milliseconds of that transition a card
       * that is unambiguously being shown still computes to nearly zero. The
       * classes the application sets to *mean* "shown" are the reliable
       * signal; opacity only has to catch the ones that carry no such class.
       */
      if (candidate.classList.contains("is-visible")
        || candidate.classList.contains("is-open")) {
        return candidate;
      }
      if (Number(style.opacity) < 0.05) continue;
      return candidate;
    }
    return null;
  }

  function place(step) {
    const anchor = resolveAnchor(step.anchor);
    // Only one thing is ever the subject, and it is lifted above the veil
    // rather than the rest of the interface being dimmed around it.
    if (subject && subject !== anchor) subject.classList.remove("is-tour-subject");
    subject = anchor;
    if (anchor) anchor.classList.add("is-tour-subject");

    const cardWidth = Math.min(460, innerWidth - 24);
    card.style.width = `${cardWidth}px`;

    /*
     * The card's real height, measured, rather than a number written down.
     *
     * The old code assumed 230px both for deciding whether the card fitted
     * below its anchor and for placing it above one. The card is now half as
     * tall again and its copy varies by step, so the constant was wrong in
     * both directions -- and being wrong here means a card that hangs off the
     * bottom of the screen or sits on top of the thing it is pointing at.
     */
    const cardHeight = Math.max(160, card.getBoundingClientRect().height);

    const rect = anchor ? anchor.getBoundingClientRect() : null;

    if (!rect || rect.width === 0) {
      spotlight.style.opacity = "0";
      card.style.top = "auto";
      if (step.veil === "clear") {
        /*
         * A step with the veil off is a step about something in the scene, and
         * the scene's subject is in the middle of the frame. Measured on the
         * first build of "there is Earth, go to it": the centred card covered
         * Earth exactly. So these dock to the right-hand side, clear of the
         * centre and clear of the distance panel in the opposite corner.
         */
        card.style.left = "auto";
        card.style.right = "clamp(16px, 3vw, 44px)";
        card.style.bottom = "clamp(88px, 13vh, 150px)";
        card.style.transform = "none";
        return;
      }
      /*
       * Otherwise centred, and high enough to clear the distance panel in the
       * bottom-left -- which on the very first card would otherwise be covered
       * by the tour explaining where you are.
       */
      card.style.right = "auto";
      card.style.left = "50%";
      card.style.bottom = "clamp(150px, 22vh, 260px)";
      card.style.transform = "translateX(-50%)";
      return;
    }
    card.style.right = "auto";

    const pad = 10;
    spotlight.style.opacity = "1";
    spotlight.style.left = `${rect.left - pad}px`;
    spotlight.style.top = `${rect.top - pad}px`;
    spotlight.style.width = `${rect.width + pad * 2}px`;
    spotlight.style.height = `${rect.height + pad * 2}px`;

    /*
     * Below, then above, then beside.
     *
     * Two positions were not enough. The dossier panel sits in the right half
     * of a short viewport, and there the card fitted neither under it (16px
     * short) nor over it without landing on the header -- measured at y=22,
     * covering the three controls. So there is a third option: alongside, on
     * whichever side has the room, which is always available because the panel
     * never spans the width of the screen.
     *
     * `headroom` is the header's own band. Nothing may be placed into it: the
     * controls there are the ones a viewer needs while the tour is running.
     */
    const headroom = 74;
    const gap = 16;
    card.style.transform = "none";
    card.style.bottom = "auto";

    const fitsBelow = rect.bottom + gap + cardHeight <= innerHeight - 12;
    const fitsAbove = rect.top - gap - cardHeight >= headroom;

    /*
     * A step can insist on being beside its anchor.
     *
     * The distance step is the reason: its natural placement is above the
     * readout, which is exactly where the popover it is asking the viewer to
     * open appears -- so the explanation opened underneath the card telling
     * them to open it.
     */
    if ((fitsBelow || fitsAbove) && step.place !== "side") {
      card.style.top = fitsBelow
        ? `${rect.bottom + gap}px`
        : `${rect.top - gap - cardHeight}px`;
      card.style.left = `${Math.min(
        Math.max(12, rect.left + rect.width / 2 - cardWidth / 2),
        innerWidth - cardWidth - 12,
      )}px`;
      return;
    }

    const roomLeft = rect.left - gap;
    const roomRight = innerWidth - rect.right - gap;
    const onLeft = roomLeft >= roomRight;
    card.style.left = `${clampToViewport(
      onLeft ? rect.left - gap - cardWidth : rect.right + gap,
      12,
      Math.max(12, innerWidth - cardWidth - 12),
    )}px`;
    card.style.top = `${clampToViewport(
      rect.top + rect.height / 2 - cardHeight / 2,
      headroom,
      Math.max(headroom, innerHeight - cardHeight - 12),
    )}px`;
  }

  function clampToViewport(value, low, high) {
    return Math.min(Math.max(value, low), high);
  }

  function render() {
    const step = STEPS[index];
    satisfied = false;
    layer.classList.remove("is-satisfied");
    document.body.classList.remove("is-tour-satisfied");
    layer.dataset.step = step.id;
    // How much of the scene this step covers. Read by the stylesheet off
    // <body>, because the canvas being blurred is not inside this layer.
    document.body.dataset.tourVeil = step.veil ?? "full";
    layer.dataset.veil = step.veil ?? "full";

    /*
     * Some steps need the application to do something first.
     *
     * "Go to a world" is unusable from the arrival distance -- Earth is a
     * fraction of a pixel there -- so the step asks to be brought within sight
     * of it. Announced as an intention rather than called directly: this
     * component knows about cards and buttons, and should not learn about
     * cameras. Fired on every step, action or not, so that moving on from a
     * step is itself the signal to stop doing whatever it asked for.
     */
    window.dispatchEvent(new CustomEvent("beyond-earth:tour-action", {
      detail: {
        action: step.action ?? null,
        step: step.id,
        veil: step.veil ?? "full",
        clicks: step.clicks ?? "all",
        only: step.only ?? null,
        unlocks: step.unlocks ?? null,
      },
    }));
    progress.textContent = `Step ${index + 1} of ${STEPS.length}`;
    title.textContent = step.title;
    body.textContent = step.body;
    if (step.hint) {
      hint.textContent = step.hint;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
    nextButton.textContent = index === STEPS.length - 1 ? "Start exploring" : "Next";
    replayButton.hidden = !step.replay;
    pips.forEach((pip, i) => {
      pip.classList.toggle("is-done", i < index);
      pip.classList.toggle("is-current", i === index);
    });
    place(step);

    /*
     * Placed again once the anchor has settled.
     *
     * Two of these steps point at surfaces that animate in -- the selection
     * card slides and fades as a body is focused -- so the rectangle measured
     * on the frame the step renders is not the rectangle it ends up at.
     * Measured: the card was positioned against an anchor 120px lower than its
     * resting place and ended up over the header instead of under the panel it
     * was describing. Re-placing on the next frame and again after the
     * transition costs nothing and removes the whole class of problem.
     */
    const placedStep = step;
    requestAnimationFrame(() => {
      if (!finished && STEPS[index] === placedStep) place(placedStep);
    });
    setTimeout(() => {
      if (!finished && STEPS[index] === placedStep) place(placedStep);
    }, 460);
  }

  function finish() {
    if (finished) return;
    finished = true;
    cancelAutoAdvance();
    activeTour = null;
    removeEventListener("wheel", onWheel);
    removeEventListener("pointerdown", onPointerDown);
    removeEventListener("pointermove", onPointerMove);
    removeEventListener("pointerup", onPointerUp);
    removeEventListener("keydown", onArrowKey);
    removeEventListener("beyond-earth:planet-details-state", onDetailsState);
    removeEventListener("beyond-earth:tour-target-reached", onTargetReached);
    removeEventListener("pointerdown", onControlClick, { capture: true });
    removeEventListener("click", onControlClick, { capture: true });
    removeEventListener("pointerdown", onEscapeGesture, { capture: true });
    removeEventListener("keydown", onEscapeGesture, { capture: true });
    subject?.classList.remove("is-tour-subject");
    subject = null;
    layer.classList.remove("is-open");
    document.body.classList.remove("is-tour-open", "is-tour-satisfied");
    delete document.body.dataset.tourVeil;
    setTimeout(() => layer.remove(), 460);
    window.dispatchEvent(new CustomEvent("beyond-earth:tour-state", {
      detail: { open: false },
    }));
  }

  function advance() {
    cancelAutoAdvance();
    if (index >= STEPS.length - 1) { finish(); return; }
    index += 1;
    render();
  }

  nextButton.addEventListener("click", (event) => {
    event.stopPropagation();
    cancelAutoAdvance();
    advance();
  });
  skipButton.addEventListener("click", (event) => {
    event.stopPropagation();
    cancelAutoAdvance();
    finish();
  });
  replayButton.addEventListener("click", (event) => {
    event.stopPropagation();
    cancelAutoAdvance();
    finish();
    /*
     * Long enough for the exit to land.
     *
     * Finishing sends the viewer back to the whole system, and that is a camera
     * transition with cards fading out behind it. At 900ms the replacement tour
     * opened over the tail of it and the viewer saw the Earth and Moon cards
     * sitting behind step one. The scene is also reset when a tour opens, which
     * is the real fix; this only stops the two animations overlapping.
     */
    setTimeout(() => beginGuidedTour(), 1700);
  });
  card.addEventListener("pointerdown", (event) => event.stopPropagation());
  card.addEventListener("click", (event) => event.stopPropagation());
  // The veil is a backdrop, not a shield: a click on it dismisses nothing and
  // passes through, so a step that says "click empty space" can be obeyed.
  veil.style.pointerEvents = "none";

  addEventListener("keydown", (event) => {
    if (finished) return;
    if (event.key !== "Escape") return;
    /*
     * Except on the step that is teaching Escape.
     *
     * Closing the tour on Escape is a reasonable default and completely wrong
     * for one step: the whole of "Escape steps back one view" is the viewer
     * pressing Escape and watching the scene answer. Swallowing it there would
     * have made the lesson impossible to follow.
     */
    if (STEPS[index]?.gesture === "escape") return;
    event.stopPropagation();
    finish();
  }, { capture: true });

  addEventListener("resize", () => { if (!finished) place(STEPS[index]); });

  render();
  requestAnimationFrame(() => {
    layer.classList.add("is-open");
    document.body.classList.add("is-tour-open");
    nextButton.focus({ preventScroll: true });
  });
  window.dispatchEvent(new CustomEvent("beyond-earth:tour-state", {
    detail: { open: true },
  }));

  activeTour = {
    finish,
    get isOpen() { return !finished; },
  };
  return activeTour;
}

/** Lets anything -- a menu item, the console -- run the tour again. */
export function replayGuidedTour() {
  return beginGuidedTour();
}

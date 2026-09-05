/**
 * The catalogue of things that happen, and the way to go and watch one.
 *
 * The event system worked and nobody could find it. Fifteen events firing on a
 * timer means a viewer who stays ten minutes sees three of them, in an order
 * they did not choose, on a body they were probably not looking at. That is a
 * discoverability problem, not a content problem, and the fix is a list.
 *
 * ## What pressing an event does
 *
 * It is not a play button, it is a *journey*. Pressing one closes the panel,
 * flies the camera to the body the event happens on, and then waits five
 * seconds before anything starts -- because arriving somewhere and immediately
 * being shown something means missing the beginning of it. The wait is
 * announced and counted down, so the pause reads as anticipation rather than
 * as nothing happening. Then the event runs **once** and stops, and a replay
 * control appears for anyone who wants to see it again.
 *
 * The alternative -- staging it where the camera already is -- was what the
 * first version did, and it produces events on planets that are off screen or
 * a pixel wide. Going there first is the difference between watching something
 * and being told it happened.
 *
 * ## The controls that are not here
 *
 * There was an autoplay toggle and an interval slider. Both are gone, with the
 * rotation they configured. A dashboard whose entire purpose is "choose what
 * to watch" does not also need a setting for "choose randomly for me, at this
 * cadence" -- it is a second, worse way of using the same list, and it means
 * events keep interrupting a viewer who is in the middle of reading about a
 * different one.
 */

const CLOSE_KEY = "Escape";

/** Escapes a value for use in a plain-text DOM comparison, not for HTML. */
function normalise(value) {
  return String(value ?? "").toLowerCase();
}

/**
 * @param {object} options
 * @param {object} options.events   the object returned by createSolarSystemEvents
 * @param {HTMLElement} [options.trigger]  an existing button to wire
 * @param {(id: string) => boolean} options.onView  travels to the body and
 *   stages the event; returns false when it cannot
 */
export function createSpaceEventsDashboard({ events, trigger = null, onView = null }) {
  if (!events) return null;

  const roster = events.list();

  let panel = document.querySelector("#space-events-dashboard");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "space-events-dashboard";
    panel.className = "events-dashboard";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "events-dashboard-title");
    document.body.append(panel);
  }

  /*
   * Built as one string and parsed once. Fifteen rows of seven fields each is
   * about a hundred and thirty element creations; doing that with createElement
   * and append is a hundred and thirty layout-invalidating mutations while a 3D
   * scene wants the main thread. One innerHTML parse is a single insertion. The
   * content is entirely ours -- no user input reaches this -- so there is
   * nothing to escape.
   */
  const rows = roster.map((event) => `
    <li class="events-dashboard__event" data-event-id="${event.id}"
        data-search="${normalise(`${event.body} ${event.title} ${event.detail} ${event.frequency} ${event.cause} ${event.note}`)}">
      <div class="events-dashboard__event-head">
        <span class="events-dashboard__event-body">${event.body}</span>
        <h3 class="events-dashboard__event-title">${event.title}</h3>
        <span class="events-dashboard__count" data-count-for="${event.id}"></span>
      </div>
      <p class="events-dashboard__event-detail">${event.detail}</p>
      <dl class="events-dashboard__facts">
        <div>
          <dt>How often</dt>
          <dd>${event.frequency}</dd>
        </div>
        <div>
          <dt>Why it happens</dt>
          <dd>${event.cause}</dd>
        </div>
      </dl>
      <p class="events-dashboard__event-note">${event.note}</p>
      <button class="events-dashboard__play" type="button" data-play="${event.id}">
        <span class="events-dashboard__play-icon" aria-hidden="true"></span>
        <span data-play-label>View this space event</span>
      </button>
    </li>
  `).join("");

  panel.innerHTML = `
    <div class="events-dashboard__backdrop" data-events-dismiss></div>
    <article class="events-dashboard__sheet">
      <header class="events-dashboard__header">
        <div>
          <span class="events-dashboard__eyebrow">The Solar System is not furniture</span>
          <h2 id="events-dashboard-title">Space events</h2>
        </div>
        <button class="events-dashboard__close" type="button" aria-label="Close space events">×</button>
      </header>

      <p class="events-dashboard__intro">
        Every one of these is real, and the rates are measured rather than
        invented. Pick one and you will be taken to the world it happens on to
        watch it.
      </p>

      <div class="events-dashboard__search">
        <label class="events-dashboard__search-label" for="events-dashboard-filter">Find an event</label>
        <input
          type="search"
          id="events-dashboard-filter"
          class="events-dashboard__search-input"
          placeholder="Search by world, event or cause…"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="events-dashboard__tally" id="events-dashboard-tally"></span>
      </div>

      <ol class="events-dashboard__list">${rows}</ol>

      <p class="events-dashboard__empty" hidden>Nothing matches that. Try a world's name, or a word like <em>storm</em>, <em>impact</em> or <em>ice</em>.</p>

      <p class="events-dashboard__footnote">
        Timings are compressed — nobody is going to wait five and a half years
        for a Martian dust storm — but the sizes, colours, durations and rates
        are the observed ones.
      </p>
    </article>
  `;

  const sheet = panel.querySelector(".events-dashboard__sheet");
  const closeButton = panel.querySelector(".events-dashboard__close");
  const list = panel.querySelector(".events-dashboard__list");
  const filterInput = panel.querySelector("#events-dashboard-filter");
  const tally = panel.querySelector("#events-dashboard-tally");
  const emptyNote = panel.querySelector(".events-dashboard__empty");

  const rowFor = new Map(
    roster.map((event) => [event.id, list.querySelector(`[data-event-id="${event.id}"]`)]),
  );

  let open = false;
  let unsubscribe = null;
  let query = "";
  let lastActiveId = null;
  /*
   * The event most recently played, which outlives the event itself.
   *
   * `activeId` is only set while something is running, so on its own it marks
   * a row for a few seconds and then lets go -- and by the time anyone opens
   * this list to see what they just watched, nothing is marked at all. Holding
   * the last one keeps the answer to "which was that?" on screen.
   */
  let selectedId = null;

  /* --------------------------------------------------------------- rendering */

  /**
   * The count, in the three tenses the viewer asked for.
   *
   * Not watched yet, running right now, or watched N times before -- which is
   * past, present and future for every row at a glance, and is the only piece
   * of state that survives an event ending.
   */
  function renderCounts(state) {
    selectedId = state.lastPlayedId ?? state.activeId ?? selectedId;
    roster.forEach((event) => {
      const row = rowFor.get(event.id);
      if (!row) return;
      const chip = row.querySelector(`[data-count-for="${event.id}"]`);
      const seen = state.viewCounts?.[event.id] ?? 0;
      const running = state.activeId === event.id;
      if (chip) {
        chip.textContent = running
          ? "Happening now"
          : seen === 0
            ? "Not seen yet"
            : `Seen ${seen}×`;
        chip.dataset.state = running ? "live" : seen === 0 ? "unseen" : "seen";
      }
      if (state.activeId !== lastActiveId) row.classList.toggle("is-running", running);
      row.classList.toggle("is-selected", event.id === selectedId);
      if (event.id === selectedId) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    lastActiveId = state.activeId;
  }

  function applyFilter() {
    const needle = normalise(query).trim();
    let shown = 0;
    roster.forEach((event) => {
      const row = rowFor.get(event.id);
      if (!row) return;
      const hit = !needle || row.dataset.search.includes(needle);
      row.hidden = !hit;
      if (hit) shown += 1;
    });
    emptyNote.hidden = shown > 0;
    tally.textContent = needle
      ? `${shown} of ${roster.length} events`
      : `${roster.length} events`;
  }

  /**
   * Marks the rows whose bodies are not in the scene yet.
   *
   * The row is not hidden and the button is not disabled: the event is real and
   * worth reading about, and a disabled control tells you nothing about how to
   * enable it. It says where to go instead.
   */
  function markAvailability() {
    const available = events.getAvailability?.() ?? {};
    roster.forEach((event) => {
      const row = rowFor.get(event.id);
      if (!row) return;
      const ready = available[event.id] !== false;
      row.classList.toggle("is-unavailable", !ready);
      const label = row.querySelector("[data-play-label]");
      if (label) {
        label.textContent = ready
          ? "View this space event"
          : `Travel out to ${event.body} first`;
      }
    });
  }

  function render(state) {
    renderCounts(state);
  }

  /* ------------------------------------------------------------------- open */

  function setOpen(next) {
    if (open === next) return;
    open = next;
    panel.hidden = !open;
    panel.classList.toggle("is-open", open);
    trigger?.setAttribute("aria-expanded", String(open));

    if (open) {
      // Subscribing only while visible is the point of subscribing at all: a
      // closed panel that keeps re-rendering is pure cost, and this one renders
      // while a 3D scene wants the main thread.
      unsubscribe = events.subscribe(render);
      // Availability is read on open rather than watched, because the only
      // thing that changes it is travelling, and travelling closes the panel.
      markAvailability();
      applyFilter();
      /*
       * Put the last event played where the viewer can see it. A list of
       * seventeen rows opens at the top, and the one they just watched is
       * usually not near it.
       */
      const marked = selectedId ? rowFor.get(selectedId) : null;
      if (marked && !marked.hidden) {
        requestAnimationFrame(() => {
          marked.scrollIntoView({ block: "center", behavior: "auto" });
        });
      }
      // Deferred a frame: focusing inside a node that was hidden on the
      // previous frame is a no-op in some browsers.
      requestAnimationFrame(() => closeButton?.focus({ preventScroll: true }));
    } else {
      unsubscribe?.();
      unsubscribe = null;
      lastActiveId = null;
    }

    /*
     * Announced, so main.js can suppress scene picking exactly as it does for
     * the about panel. Without this a click on the backdrop also reaches the
     * raycaster and selects whatever planet is behind the dialog.
     */
    window.dispatchEvent(new CustomEvent("beyond-earth:events-dashboard-state", {
      detail: { open },
    }));
  }

  /* -------------------------------------------------------------- listeners */

  trigger?.addEventListener("click", () => setOpen(!open));
  closeButton.addEventListener("click", () => setOpen(false));
  panel.querySelector("[data-events-dismiss]")?.addEventListener("click", () => setOpen(false));

  // Clicks inside the sheet are the dialog's own business and must not reach
  // the canvas underneath.
  sheet.addEventListener("pointerdown", (pointerEvent) => pointerEvent.stopPropagation());
  sheet.addEventListener("click", (clickEvent) => clickEvent.stopPropagation());

  /*
   * The sheet owns its own wheel.
   *
   * `.events-dashboard` is in main.js's JOURNEY_UI_SELECTOR, which stops the
   * journey handlers cancelling the gesture -- but that only gets the panel as
   * far as scrolling natively. Stopping propagation here as well means a wheel
   * that reaches the end of the list does not then continue into the page
   * behind it, which is how a scroll gesture ends up moving the camera at the
   * exact moment the reader hits the bottom of the panel.
   */
  sheet.addEventListener("wheel", (wheelEvent) => {
    wheelEvent.stopPropagation();
  }, { passive: true });

  addEventListener("keydown", (keyEvent) => {
    if (open && keyEvent.key === CLOSE_KEY) {
      keyEvent.stopPropagation();
      setOpen(false);
    }
  });

  filterInput.addEventListener("input", () => {
    query = filterInput.value;
    applyFilter();
  });

  list.addEventListener("click", (clickEvent) => {
    const button = clickEvent.target.closest("[data-play]");
    if (!button) return;
    const id = button.dataset.play;
    if (!events.isAvailable?.(id)) {
      // Could have changed since the panel opened; relabel everything at once
      // so the panel corrects itself rather than showing one stale button.
      markAvailability();
      return;
    }
    // Closed first, so the flight to the body is not watched through a panel.
    setOpen(false);
    const staged = onView ? onView(id) : events.play(id);
    if (!staged) {
      setOpen(true);
      markAvailability();
    }
  });

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    get isOpen() { return open; },
    dispose() {
      unsubscribe?.();
      panel.remove();
    },
  };
}

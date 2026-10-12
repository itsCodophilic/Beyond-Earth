import { POPULATION_TOPICS } from "./explainers/populations.js";
import { MECHANISM_TOPICS } from "./explainers/mechanisms.js";
import { BELT_TOPICS } from "./explainers/belt.js";
import { NEAR_EARTH_TOPICS } from "./explainers/nearEarth.js";

/**
 * The board's explanations for things that are not one body.
 *
 * Final round (the owner: "do all buddy everything at once"). Jupiter's
 * company (jupiterCompanyView.js) was the first of these: a moving diagram
 * on the left, a few steps with small still pictures on the right, and a
 * list of places to fly to. This is that shell, generalised, for:
 *
 *   populations   the Centaurs, every planet's Trojans, Neptune's company
 *   near-Earth    the four near-Earth families, one each (round 38)
 *   mechanisms    tidal locking and the 1:2:4 resonance -- shown moving
 *                 rather than stated
 *   belt          the Kirkwood gaps and the asteroid families
 *
 * (Round 38: the spacecraft were removed; the fields, the formation and
 * the seasons moved to the planned space events -- docs/archive/
 * space-events-coming-soon/.)
 *
 * Each topic (explainers/*.js) supplies its words, its steps and a `draw`
 * for the canvas; this file builds the same `cmoons` / `cjup` board the
 * Jupiter view uses, runs the animation while it is open, and stops it when
 * it closes. Buttons marked `data-scene-action` close the board and ask the
 * scene to show something (celestialBoard.js passes them on); `data-travel`
 * rows fly there, as everywhere else on the board.
 *
 * Cost while open: one rAF drawing a canvas (the population topics move
 * up to ~1,100 dots by Kepler's equation); the universe is paused while the
 * board is open, as for the other views.
 */

export const EXPLAINER_TOPICS = Object.freeze({
  ...POPULATION_TOPICS,
  ...MECHANISM_TOPICS,
  /* Round 37: the belt's gaps and families. */
  ...BELT_TOPICS,
  /* Round 38: the four near-Earth families, one view each. */
  ...NEAR_EARTH_TOPICS,
});

export function hasExplainer(key) {
  return Boolean(EXPLAINER_TOPICS[key]);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function buildExplainerView(key, { closeButton }) {
  const topic = EXPLAINER_TOPICS[key];
  const reduceMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const state = { mode: topic.initialMode ?? topic.modes?.[0]?.key ?? null, t: 0, last: 0, data: topic.setup?.() ?? null };

  const board = el("section", `cmoons cjup cexp cexp--${key}`);
  board.setAttribute("role", "dialog");
  board.setAttribute("aria-label", topic.aria ?? topic.title);
  const head = el("header", "cmoons__head");
  const back = el("button", "cmoons__back");
  back.type = "button";
  back.dataset.moonBack = "1";
  back.innerHTML = "<span aria-hidden=\"true\">←</span> All celestial bodies";
  head.append(back);
  const title = el("div", "cmoons__title");
  title.append(el("span", "cboard__eyebrow", topic.eyebrow));
  title.append(el("h2", "cboard__h", topic.title));
  title.append(el("p", "cboard__count", topic.count));
  head.append(title);
  const shut = closeButton("Back to all bodies");
  shut.dataset.moonBack = "1";
  head.append(shut);
  board.append(head);

  const stage = el("div", "cmoons__stage");
  const sky = el("div", "cmoons__sky cjup__sky");
  let modes = null;
  let modeButtons = [];
  if (topic.modes?.length) {
    modes = el("div", "cjup__modes");
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", topic.modesLabel ?? "View");
    modeButtons = topic.modes.map((m) => {
      const button = el("button", "cjup__mode");
      button.type = "button";
      button.dataset.expMode = m.key;
      button.append(el("span", "cjup__mode-label", m.label), el("span", "cjup__mode-sub", m.sub ?? ""));
      modes.append(button);
      return button;
    });
    sky.append(modes);
  }
  const canvas = el("canvas", "cjup__canvas");
  canvas.setAttribute("role", "img");
  const canvasWrap = el("div", "cjup__canvas-wrap");
  canvasWrap.append(canvas);
  sky.append(canvasWrap);
  /*
   * Round 38, second pass (Prompts.md, the Trojans: "just like moons are
   * clickable from dashboard on their diagrams, make like that"). A topic
   * whose `draw` leaves `data.hits` -- [{ name, label, x, y }] in canvas
   * pixels, refreshed every frame -- gets a pointer: the nearest dot within
   * 12 px is named in a small tip and highlighted (`data.hover`, which the
   * draw reads), and a click flies there. The click goes through the
   * board's own `[data-travel]` handling, by putting the name on the
   * canvas while it is hovered, so it travels exactly as a row does.
   */
  if (topic.pickable) {
    const tip = el("span", "cexp__pick-tip");
    tip.hidden = true;
    canvasWrap.append(tip);
    const clear = () => {
      if (state.data) state.data.hover = null;
      delete canvas.dataset.travel;
      canvas.style.cursor = "";
      tip.hidden = true;
    };
    canvas.addEventListener("pointermove", (event) => {
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      let best = null;
      let bestD = 12 * 12;
      for (const hit of state.data?.hits ?? []) {
        const d = (hit.x - x) ** 2 + (hit.y - y) ** 2;
        if (d < bestD) { bestD = d; best = hit; }
      }
      if (!best) { clear(); if (reduceMotion) draw(); return; }
      state.data.hover = best.name;
      canvas.dataset.travel = best.name;
      canvas.style.cursor = "pointer";
      tip.textContent = `${best.label ?? best.name} · click to fly there`;
      tip.style.left = `${Math.round(best.x)}px`;
      tip.style.top = `${Math.round(best.y)}px`;
      tip.hidden = false;
      if (reduceMotion) draw();
    });
    canvas.addEventListener("pointerleave", () => { clear(); if (reduceMotion) draw(); });
  }
  const legend = el("div", "cjup__legend");
  const renderLegend = () => {
    legend.replaceChildren();
    const items = typeof topic.legend === "function" ? topic.legend(state.mode, state.data) : topic.legend ?? [];
    items.forEach((item) => {
      const key2 = el("span", "cjup__key");
      const swatch = el("i", `cjup__swatch${item.line ? " is-path" : ""}`);
      swatch.style.background = item.colour;
      key2.append(swatch, document.createTextNode(item.text));
      legend.append(key2);
    });
  };
  const caption = el("p", "cmoons__note cjup__caption");
  sky.append(legend, caption);
  /*
   * Round 38: what a population is made of, as chips. Hovering (or
   * focusing, or tapping) one shows its line underneath; the first is
   * shown to begin with, so the line is never empty.
   */
  if (topic.composition?.length) {
    const box = el("div", "cexp__comp");
    box.append(el("span", "cexp__comp-title", topic.compositionTitle ?? "What they are made of"));
    const chips = el("div", "cexp__comp-chips");
    const line = el("p", "cexp__comp-line");
    line.setAttribute("aria-live", "polite");
    const show = (item, button) => {
      chips.querySelectorAll(".cexp__chip").forEach((b) => b.classList.toggle("is-on", b === button));
      line.replaceChildren(el("strong", null, `${item.label} · ${item.level}. `), document.createTextNode(item.text));
    };
    topic.composition.forEach((item, index) => {
      const chip = el("button", "cexp__chip");
      chip.type = "button";
      chip.append(el("span", "cexp__chip-label", item.label), el("span", "cexp__chip-level", item.level));
      chip.addEventListener("mouseenter", () => show(item, chip));
      chip.addEventListener("focus", () => show(item, chip));
      chip.addEventListener("click", () => show(item, chip));
      chips.append(chip);
      if (index === 0) queueMicrotask(() => show(item, chip));
    });
    box.append(chips, line);
    sky.append(box);
  }
  if (topic.actions?.length) {
    const actions = el("div", "cexp__actions");
    topic.actions.forEach((action) => {
      const button = el("button", "cexp__action", action.label);
      button.type = "button";
      button.dataset.sceneAction = JSON.stringify(action.detail);
      if (action.title) button.title = action.title;
      actions.append(button);
    });
    sky.append(actions);
  }

  const side = el("aside", "cmoons__side cjup__side");
  side.append(el("h3", "cmoons__side-title", topic.stepsTitle ?? "In a few steps"));
  const more = el("div", "csys__more");
  side.append(more);
  /* Round 38: a misconception, set apart above the steps. */
  if (topic.note) {
    const note = el("section", "cexp__myth");
    note.append(el("h4", "cexp__myth-title", topic.note.title), el("p", "cexp__myth-text", topic.note.text));
    more.append(note);
  }
  topic.steps.forEach((step, index) => {
    const card = el("section", "cjup__step");
    const art = el("div", "cjup__step-art");
    art.innerHTML = step.svg ?? "";
    const words = el("div", "cjup__step-words");
    words.append(el("h4", "cjup__step-title", `${index + 1} · ${step.title}`));
    words.append(el("p", "cjup__step-text", step.text));
    if (step.svg) card.append(art);
    card.append(words);
    more.append(card);
  });
  /*
   * Round 39 (the owner: "when we click on Earth, Venus ... I see all list
   * names; can't we only show what we clicked?"). A member with a `mode`
   * is listed only while that mode is chosen; the title can follow the
   * mode too (`membersTitle` as a function).
   */
  let membersHeading = null;
  const memberRows = [];
  if (topic.members?.length) {
    membersHeading = el("h3", "cmoons__side-title csys__list-title", typeof topic.membersTitle === "function" ? "" : (topic.membersTitle ?? "Fly to one"));
    more.append(membersHeading);
    const list = el("ol", "csys__list");
    topic.members.forEach((member) => {
      const row = el("button", "csys__row");
      row.type = "button";
      if (member.travel !== false) row.dataset.travel = member.name;
      if (member.sceneAction) row.dataset.sceneAction = JSON.stringify(member.sceneAction);
      const dot = el("span", "csys__row-dot");
      dot.style.setProperty("--swatch", member.swatch ?? "#9ff0dc");
      const text = el("span", "csys__row-text");
      text.append(el("span", "csys__row-name", member.where ? `${member.label ?? member.name} · ${member.where}` : (member.label ?? member.name)));
      text.append(el("span", "csys__row-meta", member.note));
      row.append(dot, text);
      const item = el("li");
      item.append(row);
      list.append(item);
      memberRows.push({ item, mode: member.mode ?? null });
    });
    more.append(list);
  }

  /*
   * Round 39 (the owner: "can't you add their names in the dashboard ...
   * let the user directly go and fly towards the rocks?"). A long list --
   * every rock of a near-Earth family, up to 20,000 -- searchable, shown a
   * page at a time, largest first. `items()` may be empty while the list is
   * still loading; the view asks again every second until it is not.
   */
  let searchTimer = 0;
  let tableView = null;
  if (topic.searchList) {
    const spec = topic.searchList;
    const box = el("section", "cexp__search");
    box.append(el("h3", "cmoons__side-title csys__list-title", spec.title));
    /*
     * Round 39, third pass (the owner: "instead of Show more ... a
     * different screen ... tabular format of all the names ... with a
     * searchable option"). The side keeps a short list -- the largest 40,
     * or the first 40 matches of a search -- and one button opens every
     * one of them in a full table (ui/nearEarthTable.js).
     */
    const tableButton = el("button", "cexp__action cexp__search-table", "See all in a table");
    tableButton.type = "button";
    const input = el("input", "cexp__search-input");
    input.type = "search";
    input.placeholder = spec.placeholder ?? "Search by name";
    input.setAttribute("aria-label", spec.placeholder ?? "Search by name");
    const status = el("p", "cmoons__note cexp__search-status");
    const list = el("ol", "csys__list");
    box.append(tableButton, input, status, list);
    more.append(box);
    const page = spec.pageSize ?? 40;
    const rowFor = (item) => {
      const row = el("button", "csys__row");
      row.type = "button";
      row.dataset.travel = item.travel;
      const dot = el("span", "csys__row-dot");
      dot.style.setProperty("--swatch", item.swatch ?? "#9ff0dc");
      const text = el("span", "csys__row-text");
      text.append(el("span", "csys__row-name", item.label), el("span", "csys__row-meta", item.note ?? ""));
      row.append(dot, text);
      const li = el("li");
      li.append(row);
      return li;
    };
    const render = () => {
      const all = spec.items();
      if (!all.length) {
        status.textContent = "Loading the list…";
        list.replaceChildren();
        tableButton.textContent = "See all in a table";
        if (!searchTimer) searchTimer = setInterval(() => { if (spec.items().length) { clearInterval(searchTimer); searchTimer = 0; render(); } }, 1000);
        return;
      }
      tableButton.textContent = `See all ${all.length.toLocaleString("en-US")} in a table`;
      const q = input.value.trim().toLowerCase();
      const matches = q ? all.filter((item) => item.label.toLowerCase().includes(q)) : all;
      status.textContent = q
        ? `${matches.length.toLocaleString("en-US")} of ${all.length.toLocaleString("en-US")} match${matches.length > page ? ` — the first ${page} here, all of them in the table` : ""}`
        : `The ${page} largest of ${all.length.toLocaleString("en-US")} — the rest in the table`;
      list.replaceChildren(...matches.slice(0, page).map(rowFor));
    };
    input.addEventListener("input", render);
    tableButton.addEventListener("click", (event) => {
      event.stopPropagation();
      tableView?.close();
      tableView = spec.openTable?.(board) ?? null;
    });
    render();
  }
  if (topic.source) more.append(el("p", "cmoons__note cjup__source", topic.source));
  stage.append(sky, side);
  board.append(stage);

  let size = 400;
  let ratio = 1;
  const ctx = canvas.getContext("2d");

  function draw() {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, size, size);
    try {
      topic.draw(ctx, size, state.t, state.mode, state.data);
    } catch (error) {
      // A drawing error must never take the board down with it.
      console.warn("[BeyondEarth] explainer draw failed", key, error);
    }
  }

  function setMode(mode) {
    state.mode = mode;
    memberRows.forEach(({ item, mode: only }) => { item.hidden = Boolean(only) && only !== mode; });
    if (membersHeading && typeof topic.membersTitle === "function") membersHeading.textContent = topic.membersTitle(mode);
    modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.expMode === mode)));
    caption.textContent = typeof topic.caption === "function" ? topic.caption(mode, state.data) : topic.caption ?? "";
    canvas.setAttribute("aria-label", caption.textContent);
    renderLegend();
    if (reduceMotion) draw();
  }

  let frameId = 0;
  function tick(now) {
    const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0;
    state.last = now;
    state.t += dt / (topic.lapSeconds ?? 12);
    draw();
    frameId = requestAnimationFrame(tick);
  }

  function fit() {
    /* Round 38 (the owner: "the button at the bottom gets hidden"): the
     * canvas gets whatever height is left after *everything else* in the
     * column -- modes, legend, caption, the composition chips and the
     * action buttons -- plus the column's 10 px gaps and padding. The old
     * sum left out the chips and the buttons, so the canvas took their
     * room and pushed "Show ... in the scene" below the bottom edge. If a
     * window is too short even at the 240 px minimum, the column scrolls
     * (binary-system.css, `.cexp .cmoons__sky`). */
    let others = 0;
    let count = 0;
    for (const child of sky.children) {
      if (child === canvasWrap) continue;
      others += child.offsetHeight;
      count += 1;
    }
    const room = sky.clientHeight - others - count * 10 - 34;
    size = Math.max(240, Math.floor(Math.min(sky.clientWidth - 16, room)));
    ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    draw();
  }
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
  observer?.observe(sky);

  modes?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exp-mode]");
    if (button) setMode(button.dataset.expMode);
  });
  setMode(state.mode);
  if (!reduceMotion) frameId = requestAnimationFrame(tick);

  return {
    board,
    filterBox: null,
    back,
    fit,
    render() { draw(); },
    clearSelection() { return false; },
    destroy() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      observer?.disconnect();
      clearInterval(searchTimer);
      tableView?.close();
      /* Round 38: a topic holding a resource (the rock portraits' WebGL
       * renderer) lets it go. */
      try { topic.teardown?.(state.data); } catch (error) { console.warn("[BeyondEarth] explainer teardown failed", key, error); }
    },
  };
}

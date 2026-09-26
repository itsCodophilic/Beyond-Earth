import {
  BODY_KINDS,
  buildCelestialBoard,
  lightTime,
} from "./celestialBoardData.js";

/**
 * The celestial board: every body the scene can fly to, laid out by where it
 * is.
 *
 * It replaced the "Where to next" section that used to sit at the bottom of
 * every asteroid dossier -- forty cards of prose under the facts of whatever
 * you were reading about, reported as "very very clumsy". A list of
 * destinations is not a fact about the body on screen, and it was the only
 * way to reach half the scene. The board is the answer to "what is out there
 * and where", asked once, from anywhere.
 *
 * ## How it reads
 *
 * Left to right is outward from the Sun, one column per region -- the inner
 * planets, the asteroid belt, the giants and the Centaurs between them, the
 * three parts of the Kuiper Belt, the detached worlds and the Oort Cloud.
 * Each column says how far it is and how long sunlight takes to get there.
 * Inside a column the bodies are in order of distance, each with a dot sized
 * on a log scale by its diameter (Dimorphos to the Sun is seven orders of
 * magnitude; a linear dot could not hold both), and moons open in a drawer on
 * the side rather than inline, because Saturn alone has 285 of them.
 *
 * It is a map, not a picture: nothing on it is drawn to scale, and it does not
 * try to look like the scene behind it.
 *
 * ## How it opens
 *
 * As light leaving the Sun would find the Solar System. The Sun flares at the
 * left edge, a light-front runs out along the ecliptic, and each region
 * unfolds above and below that line as the front reaches it, while the clock
 * in the header counts the light-travel time -- eight minutes to Earth, four
 * hours to Neptune, a week and a half to the inner edge of the Oort Cloud.
 * It closes by folding back into the ecliptic.
 *
 * ## Cost
 *
 * The DOM is built once, on first open: 68 bodies, and a moon list only when
 * a drawer asks for it. Every animation is transform, opacity or clip-path.
 * While it is open the universe is paused -- it announces itself on
 * `beyond-earth:board-state`, which `main.js` folds into the same freeze the
 * dossier uses -- so the renderer is idle behind it.
 */

const OPEN_MS = 1500;
/* The clock stops at the Oort Cloud's inner edge, 2,000 AU. */
const CLOCK_END_AU = 2000;

const FILTERS = Object.freeze([
  { key: "all", label: "Everything" },
  { key: "planet", label: "Planets" },
  { key: "dwarf", label: "Dwarf worlds" },
  { key: "asteroid", label: "Asteroids" },
  { key: "icy", label: "Centaurs & comets" },
  { key: "moons", label: "Have moons" },
  { key: "rings", label: "Have rings" },
]);

function matchesFilter(body, filter) {
  switch (filter) {
    case "planet": return body.kind === "planet";
    case "dwarf": return body.kind === "dwarf" || body.kind === "tno";
    case "asteroid": return body.kind === "asteroid" || body.kind === "nea";
    case "icy": return body.kind === "centaur" || body.kind === "comet";
    case "moons": return body.moons.length > 0;
    case "rings": return body.rings;
    default: return true;
  }
}

/* log10 of diameter -> px. 0.15 km (Dimorphos) to 1.39 million (the Sun). */
function dotSize(diameterKm) {
  const d = Math.max(0.1, Number(diameterKm) || 1);
  return Math.round(Math.min(30, Math.max(4, 5 + 3.4 * Math.log10(d))));
}

function formatAU(a) {
  if (a === 0) return "centre";
  if (a < 10) return `${a.toFixed(2)} AU`;
  if (a < 1000) return `${a.toFixed(1)} AU`;
  return `${Math.round(a).toLocaleString("en-GB")} AU`;
}

function formatKm(d) {
  if (!Number.isFinite(d) || d <= 0) return null;
  if (d < 1) return `${Math.round(d * 1000)} m`;
  if (d < 10) return `${d.toFixed(1)} km`;
  return `${Math.round(d).toLocaleString("en-GB")} km`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function normalise(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ǃǁʼ'’]/g, "")
    .toLowerCase();
}

/**
 * @param {object} options
 * @param {HTMLElement} [options.trigger]  the HUD button that opens it
 */
export function createCelestialBoard({ trigger = null } = {}) {
  const data = buildCelestialBoard();
  const bodiesByName = new Map(data.bodies.map((b) => [b.name, b]));

  let root = null;
  let track = null;
  let searchInput = null;
  let results = null;
  let drawer = null;
  let clock = null;
  let ruler = null;
  const chips = [];
  let filter = "all";
  let open = false;
  let closingTimer = null;
  let clockFrame = null;

  function announce(state) {
    window.dispatchEvent(new CustomEvent("beyond-earth:board-state", { detail: { open: state } }));
    trigger?.setAttribute("aria-expanded", String(state));
  }

  function travel(name) {
    close({ restoreFocus: false });
    window.dispatchEvent(new CustomEvent("beyond-earth:travel-to-body", { detail: { name } }));
  }

  // ------------------------------------------------------------ building

  function buildChip(body, index) {
    const item = el("li", "cboard__item");
    item.style.setProperty("--j", String(Math.min(index, 14)));
    const button = el("button", "cboard__body");
    button.type = "button";
    button.dataset.travel = body.name;
    button.dataset.kind = body.kind;
    button.setAttribute("aria-label", `Fly to ${body.name}`);

    const dot = el("span", "cboard__dot");
    dot.style.setProperty("--size", `${dotSize(body.diameterKm)}px`);
    dot.style.setProperty("--swatch", body.swatch);
    if (body.rings) dot.classList.add("has-rings");
    button.append(dot);

    const text = el("span", "cboard__text");
    text.append(el("span", "cboard__name", body.name));
    const meta = [formatAU(body.aAU), formatKm(body.diameterKm)].filter(Boolean).join(" · ");
    text.append(el("span", "cboard__meta", meta));
    text.append(el("span", "cboard__kind", BODY_KINDS[body.kind] ?? ""));
    button.append(text);
    item.append(button);

    /* Under the name rather than beside it, so "Jupiter" is never cut to
     * "Jupi..." by its own badges. */
    if (body.moons.length || body.rings) {
      const extras = el("div", "cboard__extras");
      if (body.moons.length) {
        const pill = el("button", "cboard__moons",
          body.moons.length === 1 ? "1 moon" : `${body.moons.length} moons`);
        pill.type = "button";
        pill.dataset.moonsOf = body.name;
        pill.setAttribute("aria-label", `Show the moons of ${body.name}`);
        extras.append(pill);
      }
      if (body.rings) extras.append(el("span", "cboard__ring-badge", "rings"));
      item.append(extras);
    }

    chips.push({ body, item, search: normalise(`${body.name} ${BODY_KINDS[body.kind]} ${body.detail} ${body.moons.map((m) => m.name).join(" ")}`) });
    return item;
  }

  function build() {
    root = el("section", "cboard");
    root.id = "celestial-board";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "All celestial bodies");

    root.append(el("div", "cboard__veil"));
    const sun = el("div", "cboard__flare");
    sun.setAttribute("aria-hidden", "true");
    root.append(sun);

    // Header
    const head = el("header", "cboard__head");
    const title = el("div", "cboard__title");
    title.append(el("span", "cboard__eyebrow", "Arranged outward from the Sun"));
    title.append(el("h2", "cboard__h", "All celestial bodies"));
    const count = el("p", "cboard__count");
    count.append(document.createTextNode(`${data.bodyCount} bodies · ${data.moonCount} moons · sunlight has travelled `));
    clock = el("b", "cboard__clock", "0 s");
    count.append(clock);
    title.append(count);
    head.append(title);

    const tools = el("div", "cboard__tools");
    const label = el("label", "cboard__search");
    label.append(el("span", "cboard__search-label", "Find"));
    searchInput = el("input");
    searchInput.type = "search";
    searchInput.placeholder = "A world, a moon, a region…";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.setAttribute("aria-label", "Search every body and moon");
    label.append(searchInput);
    tools.append(label);

    const filters = el("div", "cboard__filters");
    filters.setAttribute("role", "group");
    filters.setAttribute("aria-label", "Show");
    FILTERS.forEach(({ key, label: text }) => {
      const chip = el("button", "cboard__filter", text);
      chip.type = "button";
      chip.dataset.filter = key;
      chip.setAttribute("aria-pressed", String(key === filter));
      filters.append(chip);
    });
    tools.append(filters);
    head.append(tools);

    const closeButton = el("button", "cboard__close");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close the board");
    closeButton.innerHTML = "<span aria-hidden=\"true\">×</span><small>Esc</small>";
    head.append(closeButton);

    results = el("ol", "cboard__results");
    results.hidden = true;
    head.append(results);
    root.append(head);

    // The track
    track = el("div", "cboard__track");
    track.tabIndex = 0;
    track.setAttribute("aria-label", "Regions of the Solar System, outward from the Sun");

    data.regions.forEach((region, index) => {
      const column = el("section", "cboard__region");
      column.dataset.region = region.key;
      column.style.setProperty("--i", String(index));
      const header = el("header", "cboard__region-head");
      header.append(el("span", "cboard__region-index", String(index + 1).padStart(2, "0")));
      header.append(el("h3", "cboard__region-title", region.title));
      const range = region.key === "sun"
        ? "The centre"
        : `${formatAU(region.from)} – ${formatAU(region.to)}`;
      header.append(el("p", "cboard__region-range", range));
      header.append(el("p", "cboard__region-light", region.key === "sun"
        ? "Light leaves here"
        : `Sunlight takes ${lightTime(region.from)} – ${lightTime(region.to)}`));
      header.append(el("p", "cboard__region-blurb", region.blurb));
      column.append(header);

      const list = el("ol", "cboard__bodies");
      const members = data.bodies.filter((b) => b.region === region.key);
      members.forEach((body, j) => list.append(buildChip(body, j)));
      if (!members.length) {
        list.append(el("li", "cboard__empty",
          "Nothing here has ever been seen. The comets that fall inward from it are how we know it is there."));
      }
      column.append(list);
      track.append(column);
    });
    root.append(track);
    // The ecliptic sits behind the track, in the same grid cell, so it stays
    // put while the regions scroll across it.
    const ecliptic = el("div", "cboard__ecliptic");
    ecliptic.setAttribute("aria-hidden", "true");
    root.append(ecliptic);

    // The ruler: every region at its real width in log distance.
    ruler = el("nav", "cboard__ruler");
    ruler.setAttribute("aria-label", "Jump to a region");
    data.regions.forEach((region) => {
      const span = Math.log10(Math.max(region.to, 0.31)) - Math.log10(Math.max(region.from, 0.3));
      const seg = el("button", "cboard__ruler-seg");
      seg.type = "button";
      seg.dataset.jump = region.key;
      seg.style.flexGrow = String(Math.max(0.35, span));
      seg.append(el("span", "cboard__ruler-label", region.title));
      const n = data.bodies.filter((b) => b.region === region.key).length;
      seg.append(el("span", "cboard__ruler-count", n ? String(n) : "–"));
      ruler.append(seg);
    });
    root.append(ruler);

    // The moon drawer
    drawer = el("aside", "cboard__drawer");
    drawer.hidden = true;
    drawer.setAttribute("aria-label", "Moons");
    root.append(drawer);

    wire(closeButton, filters);
    document.body.append(root);
  }

  // ------------------------------------------------------------ behaviour

  function applyFilter() {
    const q = normalise(searchInput.value).trim();
    const terms = q.split(/\s+/).filter(Boolean);
    chips.forEach(({ body, item, search }) => {
      const hit = matchesFilter(body, filter)
        && terms.every((t) => search.includes(t) || normalise(body.region).includes(t));
      item.classList.toggle("is-dim", !hit);
    });
    root.querySelectorAll("[data-filter]").forEach((node) => {
      node.setAttribute("aria-pressed", String(node.dataset.filter === filter));
    });
    writeResults(terms);
  }

  function writeResults(terms) {
    results.textContent = "";
    if (!terms.length) {
      results.hidden = true;
      return;
    }
    const found = [];
    data.bodies.forEach((body) => {
      const hay = normalise(body.name);
      if (terms.every((t) => hay.includes(t))) found.push({ name: body.name, note: `${BODY_KINDS[body.kind]} · ${formatAU(body.aAU)}`, swatch: body.swatch });
      body.moons.forEach((moon) => {
        const mh = normalise(moon.name);
        if (terms.every((t) => mh.includes(t))) found.push({ name: moon.name, note: `Moon of ${body.name}`, swatch: body.swatch });
      });
    });
    found.slice(0, 12).forEach((hit) => {
      const li = el("li");
      const button = el("button", "cboard__result");
      button.type = "button";
      button.dataset.travel = hit.name;
      const dot = el("span", "cboard__dot");
      dot.style.setProperty("--size", "8px");
      dot.style.setProperty("--swatch", hit.swatch);
      button.append(dot, el("span", "cboard__result-name", hit.name), el("span", "cboard__result-note", hit.note));
      li.append(button);
      results.append(li);
    });
    if (!found.length) results.append(el("li", "cboard__result-none", "Nothing by that name."));
    else if (found.length > 12) results.append(el("li", "cboard__result-none", `and ${found.length - 12} more — keep typing`));
    results.hidden = false;
  }

  function openDrawer(name) {
    const body = bodiesByName.get(name);
    if (!body) return;
    drawer.textContent = "";
    const head = el("header", "cboard__drawer-head");
    head.append(el("span", "cboard__eyebrow", `${body.moons.length} ${body.moons.length === 1 ? "moon" : "moons"}`));
    head.append(el("h3", "cboard__drawer-title", `Moons of ${body.name}`));
    const shut = el("button", "cboard__drawer-close", "×");
    shut.type = "button";
    shut.setAttribute("aria-label", "Close the moon list");
    shut.dataset.drawerClose = "1";
    head.append(shut);
    drawer.append(head);

    let filterBox = null;
    if (body.moons.length > 12) {
      filterBox = el("input", "cboard__drawer-search");
      filterBox.type = "search";
      filterBox.placeholder = `Filter ${body.moons.length} moons…`;
      filterBox.setAttribute("aria-label", `Filter the moons of ${body.name}`);
      drawer.append(filterBox);
    }
    const list = el("ol", "cboard__drawer-list");
    const sorted = [...body.moons].sort((a, b) => (b.diameterKm ?? 0) - (a.diameterKm ?? 0));
    sorted.forEach((moon, i) => {
      const li = el("li");
      li.style.setProperty("--j", String(Math.min(i, 20)));
      const button = el("button", "cboard__moon");
      button.type = "button";
      button.dataset.travel = moon.name;
      const dot = el("span", "cboard__dot");
      dot.style.setProperty("--size", `${Math.max(4, dotSize(moon.diameterKm) - 2)}px`);
      dot.style.setProperty("--swatch", "#c9c2b8");
      button.append(dot, el("span", "cboard__moon-name", moon.name));
      const size = formatKm(moon.diameterKm);
      if (size) button.append(el("span", "cboard__moon-size", size));
      li.dataset.search = normalise(moon.name);
      li.append(button);
      list.append(li);
    });
    drawer.append(list);
    filterBox?.addEventListener("input", () => {
      const q = normalise(filterBox.value).trim();
      list.querySelectorAll("li").forEach((li) => {
        li.hidden = Boolean(q) && !li.dataset.search.includes(q);
      });
    });
    drawer.hidden = false;
    // A forced layout rather than a frame: the slide must start from the
    // closed position, and a rAF never fires in a background tab.
    void drawer.offsetWidth;
    drawer.classList.add("is-open");
    (filterBox ?? list.querySelector("button"))?.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawer || drawer.hidden) return false;
    drawer.classList.remove("is-open");
    setTimeout(() => { if (!drawer.classList.contains("is-open")) drawer.hidden = true; }, 260);
    return true;
  }

  function jumpTo(key) {
    const column = track.querySelector(`[data-region="${key}"]`);
    if (!column) return;
    track.scrollTo({ left: column.offsetLeft - 24, behavior: "smooth" });
  }

  function updateRuler() {
    const mid = track.scrollLeft + track.clientWidth * 0.35;
    let current = null;
    track.querySelectorAll(".cboard__region").forEach((column) => {
      if (column.offsetLeft <= mid) current = column.dataset.region;
    });
    ruler.querySelectorAll("[data-jump]").forEach((seg) => {
      seg.classList.toggle("is-current", seg.dataset.jump === current);
    });
  }

  function wire(closeButton, filters) {
    // The board sits over the canvas. Nothing that happens on it may reach
    // the window listeners that pick bodies and steer the camera.
    ["pointerdown", "pointerup", "click", "dblclick", "contextmenu"].forEach((type) => {
      root.addEventListener(type, (event) => event.stopPropagation());
    });

    root.addEventListener("click", (event) => {
      const travelTo = event.target.closest("[data-travel]");
      if (travelTo) {
        travel(travelTo.dataset.travel);
        return;
      }
      const moonsOf = event.target.closest("[data-moons-of]");
      if (moonsOf) {
        openDrawer(moonsOf.dataset.moonsOf);
        return;
      }
      if (event.target.closest("[data-drawer-close]")) {
        closeDrawer();
        return;
      }
      const jump = event.target.closest("[data-jump]");
      if (jump) jumpTo(jump.dataset.jump);
    });
    closeButton.addEventListener("click", () => close());
    filters.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-filter]");
      if (!chip) return;
      filter = chip.dataset.filter;
      applyFilter();
    });
    searchInput.addEventListener("input", applyFilter);

    /*
     * Keys stay on the board. The scene listens on window for Space, the
     * arrows and Shift+P; a space typed into the search box must not scroll
     * the journey. Escape unwinds one layer at a time: the search text, then
     * the moon drawer, then the board.
     */
    root.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        if (document.activeElement === searchInput && searchInput.value) {
          searchInput.value = "";
          applyFilter();
          return;
        }
        if (closeDrawer()) return;
        close();
        return;
      }
      if (event.key === "Enter" && document.activeElement === searchInput) {
        const first = results.querySelector("[data-travel]");
        if (first) travel(first.dataset.travel);
      }
    });

    /*
     * A vertical wheel moves along the Solar System, unless the column under
     * the pointer still has room to scroll in that direction -- the belt has
     * twenty-one bodies and must be able to scroll its own list.
     */
    track.addEventListener("wheel", (event) => {
      event.stopPropagation();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const list = event.target.closest(".cboard__bodies");
      if (list) {
        const canDown = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
        const canUp = list.scrollTop > 0;
        if ((event.deltaY > 0 && canDown) || (event.deltaY < 0 && canUp)) return;
      }
      event.preventDefault();
      track.scrollLeft += event.deltaY;
    }, { passive: false });
    root.addEventListener("wheel", (event) => event.stopPropagation(), { passive: true });
    track.addEventListener("scroll", updateRuler, { passive: true });

    // Drag the track itself to pan.
    let drag = null;
    track.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, input")) return;
      drag = { x: event.clientX, left: track.scrollLeft, id: event.pointerId };
      track.setPointerCapture(event.pointerId);
      track.classList.add("is-dragging");
    });
    track.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      track.scrollLeft = drag.left - (event.clientX - drag.x);
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      track.classList.remove("is-dragging");
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
  }

  function runClock() {
    cancelAnimationFrame(clockFrame);
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / OPEN_MS);
      // The front runs in log distance, so the clock does too.
      const au = 10 ** (Math.log10(0.05) + (Math.log10(CLOCK_END_AU) - Math.log10(0.05)) * t);
      clock.textContent = t >= 1 ? `${lightTime(CLOCK_END_AU)} to the Oort Cloud` : lightTime(au);
      if (t < 1 && open) clockFrame = requestAnimationFrame(step);
    };
    clockFrame = requestAnimationFrame(step);
  }

  // ------------------------------------------------------------ open / close

  function show() {
    if (!root) build();
    if (open) return;
    clearTimeout(closingTimer);
    open = true;
    root.hidden = false;
    root.classList.remove("is-closing", "is-open");
    // Restart the opening sequence from the first frame.
    void root.offsetWidth;
    root.classList.add("is-opening");
    track.scrollLeft = 0;
    updateRuler();
    runClock();
    setTimeout(() => {
      if (!open) return;
      root.classList.remove("is-opening");
      root.classList.add("is-open");
    }, OPEN_MS + 700);
    announce(true);
    requestAnimationFrame(() => searchInput.focus({ preventScroll: true }));
  }

  function close({ restoreFocus = true } = {}) {
    if (!root || !open) return;
    open = false;
    cancelAnimationFrame(clockFrame);
    closeDrawer();
    root.classList.remove("is-opening", "is-open");
    root.classList.add("is-closing");
    announce(false);
    closingTimer = setTimeout(() => {
      root.hidden = true;
      root.classList.remove("is-closing");
    }, 380);
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) close(); else show();
  });

  return Object.freeze({
    show,
    close,
    isOpen: () => open,
    data,
  });
}

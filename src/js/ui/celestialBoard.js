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
 * you were reading about, reported as "very very clumsy". The board is the
 * answer to "what is out there and where", asked once, from anywhere.
 *
 * ## How it reads
 *
 * Left to right is outward from the Sun, one column per region -- the inner
 * planets, the asteroid belt, the giants and the Centaurs between them, the
 * three parts of the Kuiper Belt, the detached worlds and the Oort Cloud.
 * Each column is lit a little less than the one before it, the way sunlight
 * thins with distance, and says how far it is and how long sunlight takes to
 * get there. Its name sits at its foot as well as its head, so the tab along
 * the bottom always lines up with the column above it and scrolls with it.
 *
 * Inside a column the bodies are in order of distance, each with a dot sized
 * on a log scale by its diameter -- Dimorphos to the Sun is seven orders of
 * magnitude, and a linear dot could not hold both.
 *
 * ## Search and filters are one thing at a time
 *
 * Typing locks the filters; choosing a filter locks the search, until
 * "Everything" is chosen again. Two ways of narrowing the same list at once
 * produce a result nobody can predict, so the board only ever answers one
 * question. Whatever does not match is switched off, not merely faded -- it
 * cannot be clicked -- and a search that matches nothing switches everything
 * off until it is cleared.
 *
 * ## Moons get a board of their own
 *
 * Pressing a planet's moon count opens a second board over the first: the
 * planet at the centre and its moons on the orbits they keep, one ring per
 * family -- Galilean, Himalia, Norse irregulars and the rest, the way the
 * catalogues and the people who study them group them. Each ring carries its
 * family's name; the rings turn, prograde families one way and retrograde
 * families the other, and hold still the moment the pointer is over them.
 * Picking a moon or a family reads it out at the side: size, distance from
 * the planet, how long its year is, which way it goes round.
 *
 * The rings are in order outward, not to scale. Saturn's families run from
 * 134 thousand to 26 million km, a factor of two hundred, and its three
 * innermost families sit within 80 thousand km of one another -- to scale,
 * they would be one line.
 *
 * ## How it opens
 *
 * As light leaving the Sun would find the Solar System. A white Sun flares at
 * the left edge, a light-front runs out along the ecliptic, and each region
 * unfolds above and below that line as the front reaches it, while the clock
 * in the header counts the light-travel time. It closes by folding back into
 * the ecliptic.
 *
 * ## Cost
 *
 * Built once, on first open; a moon board only when asked for. Every
 * animation is transform, opacity or clip-path, and the universe is paused
 * while the board is open (`beyond-earth:board-state`).
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
  { key: "moons", label: "Planets having moons" },
  { key: "rings", label: "Have rings" },
]);

/*
 * Sunlight thinning outward, one step per column: the white of the Sun's own
 * column falling away to nearly nothing at the Oort Cloud. Alpha of a
 * blue-white wash, stepped by eye so each region reads as its own band while
 * the whole still reads as one fade.
 */
const REGION_LIGHT = [0.15, 0.115, 0.09, 0.07, 0.052, 0.038, 0.026, 0.016, 0.007];

function matchesFilter(body, filter) {
  switch (filter) {
    case "planet": return body.kind === "planet";
    case "dwarf": return body.kind === "dwarf" || body.kind === "tno";
    case "asteroid": return body.kind === "asteroid" || body.kind === "nea";
    case "icy": return body.kind === "centaur" || body.kind === "comet";
    // Planets and the dwarf worlds, as the label says. The asteroids that
    // have moons -- Ida, Didymos, Sylvia and the rest -- are under Asteroids.
    case "moons": return body.moons.length > 0 && ["planet", "dwarf", "tno"].includes(body.kind);
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
  if (d >= 1e6) return `${(d / 1e6).toFixed(d >= 1e7 ? 0 : 1)} million km`;
  return `${Math.round(d).toLocaleString("en-GB")} km`;
}

function formatPeriod(days) {
  if (!Number.isFinite(days) || days <= 0) return null;
  if (days < 1) return `${(days * 24).toFixed(1)} h`;
  if (days < 365) return `${days < 10 ? days.toFixed(2) : Math.round(days)} days`;
  return `${(days / 365.25).toFixed(1)} years`;
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
    .replace(/[ǃǁǂʼ'’]/g, "")
    .toLowerCase();
}

/* A name as the words it is made of: "S/2004 S 7" -> s, 2004, s, 7. */
function words(value) {
  return normalise(value).split(/[^a-z0-9]+/).filter(Boolean);
}

/*
 * Every term has to begin a word of the name.
 *
 * The search used to look for the text anywhere in a body's name, its kind
 * and its one-line description, and "Earth" lit half the inner Solar System:
 * Apophis and Bennu are *near-Earth* asteroids, and Jupiter's line says how
 * many Earths it weighs. It now answers the question the box asks -- which
 * body is called this -- and a moon's name still finds its planet, so "Titan"
 * lights Saturn.
 */
function nameMatches(nameWords, terms) {
  return terms.every((t) => nameWords.some((w) => w.startsWith(t)));
}

/**
 * @param {object} options
 * @param {HTMLElement} [options.trigger]  the HUD button that opens it
 * @param {(name: string) => ({image: CanvasImageSource, flipY: boolean} | null)} [options.surfaceFor]
 *   the surface map the scene already has loaded for a body, if any -- the
 *   moon board's globe is drawn from it
 */
export function createCelestialBoard({ trigger = null, surfaceFor = null } = {}) {
  const data = buildCelestialBoard();
  const bodiesByName = new Map(data.bodies.map((b) => [b.name, b]));

  let root = null;
  let track = null;
  let searchInput = null;
  let results = null;
  let clock = null;
  let filtersBar = null;
  let emptyNote = null;
  let moonBoard = null;
  const chips = [];
  const columns = [];
  let filter = "all";
  let open = false;
  let closingTimer = null;
  let clockFrame = null;

  function announce(state) {
    window.dispatchEvent(new CustomEvent("beyond-earth:board-state", { detail: { open: state } }));
    trigger?.setAttribute("aria-expanded", String(state));
    // Lets the tour's card sit above the board on the step that opens it.
    document.body.classList.toggle("is-board-open", state);
  }

  let toast = null;
  let toastTimer = null;
  function say(text) {
    if (!toast) {
      toast = el("p", "cboard__toast");
      toast.setAttribute("role", "status");
      root.append(toast);
    }
    toast.textContent = text;
    toast.classList.remove("is-showing");
    void toast.offsetWidth;
    toast.classList.add("is-showing");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast?.classList.remove("is-showing"), 2600);
  }

  /*
   * Flying somewhere waits until the tour is over, as watching a space event
   * does. The tour shows the board to say what is on it; a click that flew
   * the viewer to Sedna would leave the walkthrough explaining a view they
   * are no longer in. Reading, searching and the moon boards all still work.
   */
  function travel(name) {
    if (document.body.classList.contains("is-tour-open")) {
      say(`Flying to ${name} waits until the tour is done — the board will be here when you are.`);
      return;
    }
    close({ restoreFocus: false });
    window.dispatchEvent(new CustomEvent("beyond-earth:travel-to-body", { detail: { name } }));
  }

  function closeButton(label) {
    // A drawn cross in a ring, and the key that does the same thing beside
    // it -- not a glyph from whatever font happens to be loaded.
    const button = el("button", "cboard__close");
    button.type = "button";
    button.setAttribute("aria-label", label);
    const ring = el("span", "cboard__close-ring");
    ring.setAttribute("aria-hidden", "true");
    ring.append(el("span", "cboard__close-x"));
    button.append(ring, el("kbd", "cboard__close-key", "esc"));
    return button;
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
    let pill = null;
    if (body.moons.length || body.rings) {
      const extras = el("div", "cboard__extras");
      if (body.moons.length) {
        pill = el("button", "cboard__moons",
          body.moons.length === 1 ? "1 moon" : `${body.moons.length} moons`);
        pill.type = "button";
        pill.dataset.moonsOf = body.name;
        pill.setAttribute("aria-label", `Open the moons of ${body.name}`);
        extras.append(pill);
      }
      if (body.rings) extras.append(el("span", "cboard__ring-badge", "rings"));
      item.append(extras);
    }

    chips.push({
      body,
      item,
      buttons: [button, pill].filter(Boolean),
      words: words(body.name),
      moonWords: body.moons.map((m) => words(m.name)),
    });
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
    searchInput.placeholder = "A world or a moon…";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.setAttribute("aria-label", "Search every body and moon");
    label.append(searchInput);
    tools.append(label);

    filtersBar = el("div", "cboard__filters");
    filtersBar.setAttribute("role", "group");
    filtersBar.setAttribute("aria-label", "Show");
    FILTERS.forEach(({ key, label: text }) => {
      const chip = el("button", "cboard__filter", text);
      chip.type = "button";
      chip.dataset.filter = key;
      chip.setAttribute("aria-pressed", String(key === filter));
      filtersBar.append(chip);
    });
    tools.append(filtersBar);
    head.append(tools);

    const shut = closeButton("Close the board");
    shut.dataset.closeBoard = "1";
    head.append(shut);

    results = el("ol", "cboard__results");
    results.hidden = true;
    head.append(results);
    root.append(head);

    // The ecliptic sits behind the track, in the same grid cell, so it stays
    // put while the regions scroll across it.
    const ecliptic = el("div", "cboard__ecliptic");
    ecliptic.setAttribute("aria-hidden", "true");
    root.append(ecliptic);

    // The track
    track = el("div", "cboard__track");
    track.tabIndex = 0;
    track.setAttribute("aria-label", "Regions of the Solar System, outward from the Sun");

    data.regions.forEach((region, index) => {
      const column = el("section", "cboard__region");
      column.dataset.region = region.key;
      column.style.setProperty("--i", String(index));
      column.style.setProperty("--light-a", String(REGION_LIGHT[index] ?? 0.006));
      column.style.setProperty("--light-b", String(REGION_LIGHT[index + 1] ?? 0.003));

      if (region.key === "sun") {
        // The Sun lives in its own column and scrolls away with it.
        const flare = el("div", "cboard__flare");
        flare.setAttribute("aria-hidden", "true");
        column.append(flare);
      }

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

      // The column's own foot: the tab that used to live in a separate ruler
      // and never quite lined up with it.
      const foot = el("button", "cboard__foot");
      foot.type = "button";
      foot.dataset.jump = region.key;
      foot.append(el("span", "cboard__foot-name", region.title));
      foot.append(el("span", "cboard__foot-count", members.length ? String(members.length) : "–"));
      column.append(foot);

      track.append(column);
      columns.push({ key: region.key, column, members });
    });

    root.append(track);
    emptyNote = el("p", "cboard__nothing");
    emptyNote.hidden = true;
    emptyNote.setAttribute("role", "status");
    root.append(emptyNote);

    wire();
    document.body.append(root);
  }

  // ------------------------------------------------------------ filtering

  function setLocks() {
    const searching = Boolean(searchInput.value.trim());
    filtersBar.classList.toggle("is-locked", searching);
    filtersBar.querySelectorAll("[data-filter]").forEach((node) => {
      node.disabled = searching;
      node.setAttribute("aria-pressed", String(node.dataset.filter === filter));
    });
    const filtering = filter !== "all";
    searchInput.disabled = filtering;
    searchInput.closest(".cboard__search").classList.toggle("is-locked", filtering);
    searchInput.placeholder = filtering
      ? "Choose Everything to search"
      : "A world or a moon…";
  }

  function apply() {
    const terms = words(searchInput.value);
    let lit = 0;
    const litRegions = new Set();
    chips.forEach(({ body, item, buttons, words: own, moonWords }) => {
      const on = terms.length
        ? nameMatches(own, terms) || moonWords.some((mw) => nameMatches(mw, terms))
        : matchesFilter(body, filter);
      item.classList.toggle("is-off", !on);
      buttons.forEach((b) => { b.disabled = !on; });
      if (on) {
        lit += 1;
        litRegions.add(body.region);
      }
    });
    const narrowing = terms.length > 0 || filter !== "all";
    columns.forEach(({ key, column }) => {
      column.classList.toggle("is-quiet", narrowing && !litRegions.has(key));
    });
    if (terms.length && !lit) {
      emptyNote.textContent = `Nothing called “${searchInput.value.trim()}”. Clear the search to bring everything back.`;
      emptyNote.hidden = false;
    } else {
      emptyNote.hidden = true;
    }
    setLocks();
    writeResults(terms);
    // Bring the first match into view.
    if (narrowing && lit) {
      const first = chips.find(({ item }) => !item.classList.contains("is-off"));
      const column = first?.item.closest(".cboard__region");
      if (column) {
        const left = column.offsetLeft - 24;
        if (left < track.scrollLeft || left > track.scrollLeft + track.clientWidth - 200) {
          track.scrollTo({ left, behavior: "smooth" });
        }
      }
    }
  }

  function writeResults(terms) {
    results.textContent = "";
    if (!terms.length) {
      results.hidden = true;
      return;
    }
    const found = [];
    data.bodies.forEach((body) => {
      if (nameMatches(words(body.name), terms)) {
        found.push({ name: body.name, note: `${BODY_KINDS[body.kind]} · ${formatAU(body.aAU)}`, swatch: body.swatch });
      }
      body.moons.forEach((moon) => {
        if (nameMatches(words(moon.name), terms)) {
          found.push({ name: moon.name, note: `Moon of ${body.name}`, swatch: "#c9c2b8" });
        }
      });
    });
    if (!found.length) {
      results.hidden = true;
      return;
    }
    found.slice(0, 10).forEach((hit) => {
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
    if (found.length > 10) results.append(el("li", "cboard__result-none", `and ${found.length - 10} more — keep typing`));
    results.hidden = false;
  }

  // ------------------------------------------------------------ the moon board

  /*
   * Where each family's ring sits, as a fraction of the map's half-width.
   *
   * Even steps outward from 0.33 -- clear of the globe at 0.2 -- to at most
   * 0.95, so the outermost ring and its name stay inside the map. A single
   * family gets one ring at 0.62 rather than one hugging the planet.
   */
  function ringRadii(count) {
    if (count === 1) return [0.62];
    const spacing = Math.min(0.25, 0.62 / (count - 1));
    return Array.from({ length: count }, (_, i) => 0.33 + spacing * i);
  }

  /* log10 of diameter -> px, smaller than the main board's: 3 px for the
   * kilometre-sized irregulars, 12 for Ganymede and Titan. */
  function moonDot(diameterKm) {
    const d = Math.max(0.1, Number(diameterKm) || 1);
    return Math.round(Math.min(16, Math.max(3, 2 + 2.6 * Math.log10(d))));
  }

  /*
   * How fast a ring turns, in degrees a second.
   *
   * Kepler's third law in miniature: the period grows as radius^1.5, so the
   * innermost ring goes round in 70 s and the outermost of nine in about
   * 340 s. Slow enough to read a name as it passes; fast enough to see that
   * the inner moons outrun the outer ones.
   */
  function ringSpeed(radius) {
    return 360 / (70 * (radius / 0.33) ** 1.5);
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  let moonBoardSerial = 0;

  /*
   * One colour per family, so a family reads as one thing on the map, on its
   * ring and in the list at once. Chosen by eye: hues spread round the wheel
   * so neighbouring rings never share one, all at the same lightness so none
   * of them shouts, and none of them amber -- amber is what the board uses
   * for "this is the one you picked".
   */
  const FAMILY_HUES = [200, 150, 275, 330, 95, 15, 240, 175, 55, 300, 120, 225];
  const familyColour = (gi) => `hsl(${FAMILY_HUES[gi % FAMILY_HUES.length]} 48% 72%)`;

  /* Earth's Moon, 3,474.8 km across (IAU mean radius 1,737.4 km). */
  const OUR_MOON_KM = 3474.8;

  /* Seen from above their north poles, these two spin the other way. */
  const RETROGRADE_SPIN = new Set(["Uranus", "Pluto", "Venus"]);

  function compareWithOurMoon(diameterKm) {
    if (!Number.isFinite(diameterKm) || diameterKm <= 0) return null;
    const ratio = diameterKm / OUR_MOON_KM;
    if (ratio >= 0.095) return `${ratio.toFixed(2)} × our Moon`;
    const percent = ratio * 100;
    return `${percent < 0.1 ? percent.toFixed(3) : percent.toFixed(1)}% of our Moon`;
  }

  function buildMoonBoard(body) {
    moonBoardSerial += 1;
    const serial = moonBoardSerial;
    const board = el("section", "cmoons");
    board.setAttribute("role", "dialog");
    board.setAttribute("aria-label", `Moons of ${body.name}`);

    const moons = [...body.moons].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    const families = new Map();
    moons.forEach((moon) => {
      const key = moon.family || "Moons";
      if (!families.has(key)) families.set(key, []);
      families.get(key).push(moon);
    });
    const groups = [...families.entries()]
      .map(([name, list]) => ({ name, list, from: list[0]?.distanceKm ?? 0 }))
      .sort((a, b) => a.from - b.from);
    const radii = ringRadii(groups.length);
    groups.forEach((group, gi) => {
      group.radius = radii[gi];
      group.colour = familyColour(gi);
      const backwards = group.list.filter((m) => m.retrograde).length;
      group.backwards = backwards;
      // A family goes round the way most of its members do.
      group.retrograde = backwards > group.list.length / 2;
      const a = group.list[0]?.distanceKm;
      const b = group.list[group.list.length - 1]?.distanceKm;
      group.near = a;
      group.far = b;
      group.range = a && b && a !== b
        ? `${formatKm(a)} – ${formatKm(b)}`
        : (a ? formatKm(a) : "Distance not published");
    });
    const nearest = moons.find((m) => m.distanceKm)?.distanceKm;
    const farthest = [...moons].reverse().find((m) => m.distanceKm)?.distanceKm;
    const retro = moons.filter((m) => m.retrograde).length;

    // ---------------------------------------------------------- header
    const head = el("header", "cmoons__head");
    const back = el("button", "cmoons__back");
    back.type = "button";
    back.dataset.moonBack = "1";
    back.innerHTML = "<span aria-hidden=\"true\">←</span> All celestial bodies";
    head.append(back);

    const title = el("div", "cmoons__title");
    title.append(el("span", "cboard__eyebrow", "Every moon on the orbit it keeps"));
    title.append(el("h2", "cboard__h", `Moons of ${body.name}`));
    const summary = [
      `${moons.length} ${moons.length === 1 ? "moon" : "moons"}`,
      groups.length > 1 ? `${groups.length} families` : null,
      nearest && farthest && nearest !== farthest ? `${formatKm(nearest)} to ${formatKm(farthest)} out` : (nearest ? `${formatKm(nearest)} out` : null),
      retro ? `${retro} going round backwards` : null,
    ].filter(Boolean).join(" · ");
    title.append(el("p", "cboard__count", summary));
    head.append(title);

    let filterBox = null;
    if (moons.length > 8) {
      const label = el("label", "cboard__search");
      label.append(el("span", "cboard__search-label", "Find"));
      filterBox = el("input");
      filterBox.type = "search";
      filterBox.placeholder = `Any of ${moons.length} moons…`;
      filterBox.autocomplete = "off";
      filterBox.spellcheck = false;
      filterBox.setAttribute("aria-label", `Find a moon of ${body.name}`);
      label.append(filterBox);
      head.append(label);
    } else {
      head.append(el("span"));
    }
    const shut = closeButton("Back to all bodies");
    shut.dataset.moonBack = "1";
    head.append(shut);
    board.append(head);

    // ---------------------------------------------------------- the map
    const stage = el("div", "cmoons__stage");
    const sky = el("div", "cmoons__sky");
    const map = el("div", "cmoons__map");
    map.style.setProperty("--g", groups.length === 1 ? "0.24" : "0.2");

    // The gap between neighbouring rings, in the SVG's 1000-unit box.
    const labelGap = groups.length > 1 ? (radii[1] - radii[0]) * 500 : 50;
    const orbits = svg("svg", { class: "cmoons__orbits", viewBox: "-500 -500 1000 1000", "aria-hidden": "true" });
    const orbitGroups = groups.map((group, gi) => {
      const r = group.radius * 500;
      const g = svg("g", { class: "cmoons__orbit" });
      g.style.setProperty("--i", String(gi));
      g.style.setProperty("--fam", group.colour);
      g.append(svg("circle", { class: `cmoons__orbit-line${group.retrograde ? " is-retro" : ""}`, r, cx: 0, cy: 0 }));
      g.append(svg("circle", { class: "cmoons__orbit-hit", r, cx: 0, cy: 0, "data-fam": gi }));
      /*
       * The ring's name runs in the gap just outside it, centred -- over the
       * top for the first ring, under the bottom for the second, and so on,
       * so nine names do not stack into one column, and the moons going round
       * on the line never cross the letters. Both arcs run left to right, so
       * the names read the right way up top and bottom.
       */
      const id = `cmoons-arc-${serial}-${gi}`;
      const t = r + labelGap / 2;
      const over = gi % 2 === 0;
      g.append(svg("path", { id, d: `M ${-t} 0 A ${t} ${t} 0 0 ${over ? 1 : 0} ${t} 0`, fill: "none", stroke: "none" }));
      const text = svg("text", { class: "cmoons__orbit-name" });
      const path = svg("textPath", { href: `#${id}`, startOffset: "50%", "text-anchor": "middle" });
      path.textContent = group.name.toUpperCase();
      text.append(path);
      g.append(text);
      orbits.append(g);
      return g;
    });
    map.append(orbits);

    /*
     * The planet, with its own surface where the scene has one loaded.
     *
     * The map is borrowed from the body's material -- already downloaded and
     * decoded for the 3D scene -- and drawn twice side by side into a canvas
     * that slides under a round window, so the globe turns without a frame of
     * script: the slide is a CSS transform. Rings, where it has them, are two
     * halves: the far half behind the globe, the near half in front.
     */
    const surface = surfaceFor?.(body.name) ?? null;
    const ringBack = body.rings ? el("span", "cmoons__planet-ring is-back") : null;
    const ringFront = body.rings ? el("span", "cmoons__planet-ring is-front") : null;
    const planet = el("button", "cmoons__planet");
    planet.type = "button";
    planet.dataset.planet = "1";
    planet.setAttribute("aria-label", `${body.name} -- show the planet`);
    planet.style.setProperty("--swatch", body.swatch);
    let surfaceCanvas = null;
    if (surface?.image) {
      surfaceCanvas = el("canvas", "cmoons__surface");
      if (RETROGRADE_SPIN.has(body.name)) surfaceCanvas.classList.add("is-retro");
      planet.classList.add("has-surface");
      planet.append(surfaceCanvas);
    }
    planet.append(el("span", "cmoons__shade"));
    if (body.name === "Saturn") [ringBack, ringFront].forEach((node) => node?.classList.add("is-bright"));
    if (ringBack) map.append(ringBack);
    map.append(planet);
    if (ringFront) map.append(ringFront);
    const planetName = el("span", "cmoons__planet-name", body.name);
    planetName.setAttribute("aria-hidden", "true");
    map.append(planetName);

    function paintSurface(diameter) {
      if (!surfaceCanvas) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const h = Math.max(32, Math.round(diameter * dpr));
      const w = h * 4; // two full 2:1 maps side by side
      if (surfaceCanvas.width === w && surfaceCanvas.height === h) return;
      surfaceCanvas.width = w;
      surfaceCanvas.height = h;
      const ctx = surfaceCanvas.getContext("2d");
      try {
        for (let copy = 0; copy < 2; copy += 1) {
          ctx.save();
          if (surface.flipY) {
            ctx.translate(0, h);
            ctx.scale(1, -1);
          }
          ctx.drawImage(surface.image, copy * (w / 2), 0, w / 2, h);
          ctx.restore();
        }
      } catch {
        // An image the canvas cannot read: fall back to the plain globe.
        surfaceCanvas.remove();
        surfaceCanvas = null;
        planet.classList.remove("has-surface");
      }
    }

    // ---------------------------------------------------------- the side
    const side = el("aside", "cmoons__side");
    const card = el("div", "cmoons__card");
    card.setAttribute("aria-live", "polite");
    side.append(card);
    side.append(el("h3", "cmoons__side-title", groups.length === 1 ? "Its orbit" : "Families, innermost first"));
    const famList = el("ol", "cmoons__families");
    side.append(famList);

    const entries = [];
    const rings = [];
    const famItems = [];
    groups.forEach((group, gi) => {
      const ring = el("div", "cmoons__ring");
      ring.style.setProperty("--i", String(gi));
      ring.style.setProperty("--fam", group.colour);
      // Start each ring somewhere different, so the first moons of nine
      // families do not line up along one spoke.
      const offset = (gi * 47) % 360;

      const li = el("li", "cmoons__fam");
      li.style.setProperty("--fam", group.colour);
      const famButton = el("button", "cmoons__fam-btn");
      famButton.type = "button";
      famButton.dataset.fam = String(gi);
      famButton.setAttribute("aria-expanded", "false");
      const mark = el("span", `cmoons__fam-mark${group.retrograde ? " is-retro" : ""}`);
      mark.setAttribute("aria-hidden", "true");
      famButton.append(mark);
      const famText = el("span", "cmoons__fam-text");
      famText.append(el("span", "cmoons__fam-name", group.name));
      const count = `${group.list.length} ${group.list.length === 1 ? "moon" : "moons"}`;
      const backwards = group.backwards
        ? ` · ${group.backwards === group.list.length ? "all" : group.backwards} ↺`
        : "";
      famText.append(el("span", "cmoons__fam-meta", `${group.range} · ${count}${backwards}`));
      famButton.append(famText);
      li.append(famButton);
      const names = el("ol", "cmoons__names");
      names.hidden = true;
      li.append(names);
      famList.append(li);

      group.list.forEach((moon, j) => {
        const index = entries.length;
        const angle = offset + (360 * j) / group.list.length;
        const size = moonDot(moon.diameterKm);
        const button = el("button", "cmoons__moon");
        button.type = "button";
        button.tabIndex = -1; // the list at the side is the keyboard's way in
        button.dataset.pick = String(index);
        button.setAttribute("aria-label", `${moon.name}, ${group.name}`);
        button.style.setProperty("--a", `${angle.toFixed(2)}deg`);
        button.style.setProperty("--r", String(group.radius));
        button.style.setProperty("--size", `${size}px`);
        const upright = el("span", "cmoons__upright");
        upright.append(el("span", "cmoons__dot"), el("span", "cmoons__label", moon.name));
        button.append(upright);
        ring.append(button);

        const nameButton = el("button", "cmoons__name");
        nameButton.type = "button";
        nameButton.dataset.pick = String(index);
        nameButton.dataset.list = "1";
        nameButton.append(el("span", "cmoons__name-text", moon.name));
        nameButton.append(el("span", "cmoons__name-meta", [
          moon.distanceKm ? formatKm(moon.distanceKm) : null,
          formatKm(moon.diameterKm),
          moon.retrograde ? "↺" : null,
        ].filter(Boolean).join(" · ")));
        const nameItem = el("li");
        nameItem.append(nameButton);
        names.append(nameItem);

        entries.push({
          moon,
          gi,
          button,
          upright,
          nameButton,
          labelled: false,
          words: words(moon.name),
          // The big ones are always named: Galilean, Titan, Triton, the Moon.
          notable: (moon.diameterKm ?? 0) >= 400 || moons.length <= 5,
        });
      });
      map.append(ring);
      rings.push({
        node: ring,
        angle: 0,
        speed: ringSpeed(group.radius) * (group.retrograde ? 1 : -1),
        labelled: new Set(),
      });
      famItems.push({ li, button: famButton, names });
    });

    const note = el("p", "cmoons__note", "Rings in order outward, not to scale · dots sized by diameter · dashed rings go round backwards");
    sky.append(map, note);
    stage.append(sky, side);
    board.append(stage);

    // ---------------------------------------------------------- the ruler
    /*
     * Every moon's distance on one log axis, a tick each, in its family's
     * colour: where the families actually sit, which the rings cannot show.
     * Saturn's irregulars are a hundred times farther out than its ring
     * moons; the ticks bunch the way the moons do.
     */
    const RULER_W = 300;
    const logNear = nearest ? Math.log10(nearest) : 0;
    const logFar = farthest ? Math.log10(farthest) : 1;
    const span = Math.max(1e-6, logFar - logNear);
    const xOf = (km) => (nearest === farthest || !km)
      ? RULER_W / 2
      : 8 + (RULER_W - 16) * ((Math.log10(km) - logNear) / span);
    const tickMarkup = entries
      .filter(({ moon }) => moon.distanceKm)
      .map(({ moon, gi }) => `<line x1="${xOf(moon.distanceKm).toFixed(1)}" x2="${xOf(moon.distanceKm).toFixed(1)}" y1="12" y2="24" stroke="${groups[gi].colour}" />`)
      .join("");

    function ruler(focus) {
      const node = svg("svg", { class: "cmoons__ruler", viewBox: `0 0 ${RULER_W} 42`, "aria-hidden": "true" });
      let band = "";
      let marker = "";
      if (focus?.group && focus.group.near && focus.group.far) {
        const x1 = xOf(focus.group.near);
        const x2 = xOf(focus.group.far);
        band = `<rect x="${(Math.min(x1, x2) - 3).toFixed(1)}" y="9" width="${(Math.abs(x2 - x1) + 6).toFixed(1)}" height="18" rx="3" fill="${focus.group.colour}" opacity="0.16" />`;
      }
      if (focus?.moon?.distanceKm) {
        const x = xOf(focus.moon.distanceKm).toFixed(1);
        marker = `<line class="cmoons__ruler-mark" x1="${x}" x2="${x}" y1="5" y2="31" /><circle class="cmoons__ruler-mark" cx="${x}" cy="5" r="2.6" />`;
      }
      node.innerHTML = `<line class="cmoons__ruler-axis" x1="8" x2="${RULER_W - 8}" y1="18" y2="18" />${band}<g class="cmoons__ruler-ticks">${tickMarkup}</g>${marker}`
        + (nearest ? `<text class="cmoons__ruler-end" x="8" y="40">${formatKm(nearest)}</text>` : "")
        + (farthest && farthest !== nearest ? `<text class="cmoons__ruler-end" x="${RULER_W - 8}" y="40" text-anchor="end">${formatKm(farthest)}</text>` : "");
      return node;
    }

    // ---------------------------------------------------------- the readout
    function facts(rows) {
      const list = el("dl", "cmoons__facts");
      rows.filter(([, value]) => value).forEach(([term, value]) => {
        const cell = el("div");
        cell.append(el("dt", null, term), el("dd", null, value));
        list.append(cell);
      });
      return list;
    }

    function flyButton(name) {
      const fly = el("button", "cmoons__fly", `Fly to ${name} →`);
      fly.type = "button";
      fly.dataset.travel = name;
      return fly;
    }

    let shownKey = null;
    function writeCard(index, missing = null) {
      const key = missing != null ? `missing:${missing}` : String(index);
      if (key === shownKey) return;
      shownKey = key;
      card.textContent = "";
      if (missing != null) {
        card.append(el("span", "cboard__eyebrow", "Nothing found"));
        card.append(el("h3", "cmoons__card-name", "No such moon"));
        card.append(el("p", "cmoons__card-hint", `No moon of ${body.name} is called “${missing}”. Clear the search to see them all again.`));
        return;
      }
      const entry = entries[index];
      if (!entry) {
        card.style.removeProperty("--fam");
        card.append(el("span", "cboard__eyebrow", BODY_KINDS[body.kind] ?? "World"));
        card.append(el("h3", "cmoons__card-name", body.name));
        card.append(el("p", "cmoons__card-sub", [
          formatKm(body.diameterKm) && `${formatKm(body.diameterKm)} across`,
          retro ? `${retro} of ${moons.length} retrograde` : "all prograde",
        ].filter(Boolean).join(" · ")));
        card.append(facts([
          ["Moons", String(moons.length)],
          ["Families", String(groups.length)],
          ["Nearest", nearest ? formatKm(nearest) : null],
          ["Farthest", farthest && farthest !== nearest ? formatKm(farthest) : null],
        ]));
        card.append(el("p", "cmoons__ruler-title", "Every moon by distance · log scale"));
        card.append(ruler(null));
        const actions = el("div", "cmoons__actions");
        actions.append(flyButton(body.name), el("span", "cmoons__card-hint", "Double-click any moon to fly there"));
        card.append(actions);
        return;
      }
      const { moon, gi } = entry;
      const group = groups[gi];
      card.style.setProperty("--fam", group.colour);
      const eyebrow = el("span", "cboard__eyebrow cmoons__card-family");
      eyebrow.append(el("i", "cmoons__card-swatch"), document.createTextNode(`${String(gi + 1).padStart(2, "0")} · ${group.name}`));
      card.append(eyebrow);
      card.append(el("h3", "cmoons__card-name", moon.name));
      card.append(el("p", "cmoons__card-sub", [
        `Moon of ${body.name}`,
        moon.retrograde ? "↺ retrograde" : "prograde",
      ].join(" · ")));
      card.append(facts([
        [`From ${body.name}`, moon.distanceKm ? formatKm(moon.distanceKm) : "Not published"],
        ["Across", formatKm(moon.diameterKm)],
        ["One orbit", formatPeriod(moon.periodDays)],
        ["Size", body.name === "Earth" ? null : compareWithOurMoon(moon.diameterKm)],
      ]));
      card.append(el("p", "cmoons__ruler-title", `Where it sits among ${moons.length === 1 ? "them" : `all ${moons.length}`} · log scale`));
      card.append(ruler({ moon, group }));
      const actions = el("div", "cmoons__actions");
      actions.append(flyButton(moon.name));
      card.append(actions);
    }

    // ---------------------------------------------------------- state
    /*
     * `hover` is a moon under the pointer on the map; it reads out on the
     * card. `hot` is a moon under the pointer in the list; it only lights its
     * dot on the map.
     *
     * The list used to read out on the card too, and that was the flicker in
     * the recording: the card changed height between a planet and a moon,
     * the list under it moved, the pointer was over a different name, the
     * card changed again -- a loop, run on every pointer event, each pass
     * rewriting all 115 or 285 moons. The card is now one fixed height and
     * the list never writes to it; hover changes touch only the moons that
     * changed.
     */
    const state = { pick: null, fam: null, hover: null, hot: null, ringHot: null, missing: null, pointerIn: false };
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function wantsLabel(entry, index) {
      if (index === state.pick || index === state.hover || index === state.hot) return true;
      if (entry.button.classList.contains("is-off")) return false;
      if (state.fam === entry.gi) return groups[entry.gi].list.length <= 24;
      return state.fam == null && entry.notable;
    }

    function refreshLabel(index) {
      const entry = entries[index];
      if (!entry) return;
      const on = wantsLabel(entry, index);
      entry.button.classList.toggle("is-hot", index === state.hot || index === state.hover);
      if (on === entry.labelled) return;
      entry.labelled = on;
      entry.button.classList.toggle("is-labelled", on);
      const ring = rings[entry.gi];
      if (on) {
        ring.labelled.add(entry.upright);
        entry.upright.style.transform = `rotate(${-ring.angle}deg)`;
      } else {
        ring.labelled.delete(entry.upright);
        entry.upright.style.transform = "";
      }
    }

    function render() {
      map.classList.toggle("has-fam", state.fam != null);
      orbitGroups.forEach((g, gi) => g.classList.toggle("is-sel", gi === state.fam));
      rings.forEach((ring, gi) => ring.node.classList.toggle("is-sel", gi === state.fam));
      famItems.forEach(({ li, button, names }, gi) => {
        const on = gi === state.fam;
        li.classList.toggle("is-sel", on);
        button.setAttribute("aria-expanded", String(on));
        names.hidden = !on;
      });
      entries.forEach((entry, index) => {
        entry.button.classList.toggle("is-picked", index === state.pick);
        entry.nameButton.classList.toggle("is-picked", index === state.pick);
        refreshLabel(index);
      });
      writeCard(state.hover ?? state.pick, state.hover == null ? state.missing : null);
      spin();
    }

    let hoverTimer = 0;
    function setHover(index) {
      clearTimeout(hoverTimer);
      if (index === state.hover) return;
      const before = state.hover;
      state.hover = index;
      refreshLabel(before);
      refreshLabel(index);
      writeCard(state.hover ?? state.pick, state.hover == null ? state.missing : null);
    }

    function setHot(index) {
      if (index === state.hot) return;
      const before = state.hot;
      state.hot = index;
      refreshLabel(before);
      refreshLabel(index);
      spin();
    }

    function setRingHot(gi) {
      if (gi === state.ringHot) return;
      state.ringHot = gi;
      orbitGroups.forEach((g, i) => g.classList.toggle("is-hot", i === gi));
      famItems.forEach(({ li }, i) => li.classList.toggle("is-hot", i === gi));
    }

    // The rings turn while nothing is being looked at, and hold still for
    // anything that is: a pointer over the map, a pick, a family, a search.
    let frame = 0;
    let last = 0;
    function held() {
      return reduceMotion || state.pointerIn || state.pick != null || state.fam != null
        || state.hot != null || Boolean(filterBox?.value.trim()) || !board.isConnected;
    }
    function step(now) {
      frame = 0;
      if (held()) return;
      const dt = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      rings.forEach((ring) => {
        ring.angle = (ring.angle + ring.speed * dt) % 360;
        ring.node.style.transform = `rotate(${ring.angle}deg)`;
        ring.labelled.forEach((node) => { node.style.transform = `rotate(${-ring.angle}deg)`; });
      });
      frame = requestAnimationFrame(step);
    }
    function spin() {
      if (held()) {
        cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(step);
      }
    }

    function pick(index) {
      state.pick = index;
      state.fam = index == null ? null : entries[index].gi;
      state.hover = null;
      render();
      if (index != null) entries[index].nameButton.scrollIntoView({ block: "nearest" });
    }

    function toggleFamily(gi) {
      state.fam = state.fam === gi ? null : gi;
      if (state.pick != null && entries[state.pick].gi !== state.fam) state.pick = null;
      render();
      if (state.fam != null) famItems[gi].li.scrollIntoView({ block: "nearest" });
    }

    board.addEventListener("click", (event) => {
      const picked = event.target.closest("[data-pick]");
      if (picked && !picked.disabled) {
        pick(Number(picked.dataset.pick));
        return;
      }
      const fam = event.target.closest("[data-fam]");
      if (fam) {
        toggleFamily(Number(fam.dataset.fam));
        return;
      }
      if (event.target.closest("[data-planet]")) pick(null);
    });

    board.addEventListener("dblclick", (event) => {
      const picked = event.target.closest(".cmoons__moon, .cmoons__name");
      if (picked && !picked.disabled) travel(entries[Number(picked.dataset.pick)].moon.name);
      else if (event.target.closest("[data-planet]")) travel(body.name);
    });

    const pickIndex = (node) => (node && !node.disabled ? Number(node.dataset.pick) : null);
    board.addEventListener("pointerover", (event) => {
      const dot = event.target.closest?.(".cmoons__moon");
      const name = event.target.closest?.(".cmoons__name");
      const fam = event.target.closest?.("[data-fam]");
      if (dot) setHover(pickIndex(dot));
      setHot(name ? pickIndex(name) : null);
      setRingHot(fam ? Number(fam.dataset.fam) : null);
    });
    board.addEventListener("pointerout", (event) => {
      const to = event.relatedTarget;
      if (event.target.closest?.(".cmoons__moon") && !to?.closest?.(".cmoons__moon")) {
        // A beat before the card goes back, so crossing the gap between two
        // neighbouring dots does not flash the planet in between.
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => setHover(null), 140);
      }
      if (!to?.closest?.(".cmoons__name")) setHot(null);
      if (!to?.closest?.("[data-fam]")) setRingHot(null);
    });
    // The keyboard reads out from the list, as the pointer does from the map.
    board.addEventListener("focusin", (event) => {
      const name = event.target.closest?.(".cmoons__name");
      setHot(name ? pickIndex(name) : null);
    });
    sky.addEventListener("pointerenter", () => { state.pointerIn = true; spin(); });
    sky.addEventListener("pointerleave", () => { state.pointerIn = false; spin(); });

    filterBox?.addEventListener("input", () => {
      const terms = words(filterBox.value);
      let first = null;
      const litFamilies = new Set();
      entries.forEach((entry, index) => {
        const on = !terms.length || nameMatches(entry.words, terms);
        entry.button.classList.toggle("is-off", !on);
        entry.button.disabled = !on;
        entry.nameButton.closest("li").classList.toggle("is-off", !on);
        entry.nameButton.disabled = !on;
        if (on) {
          litFamilies.add(entry.gi);
          if (first == null) first = index;
        }
      });
      famItems.forEach(({ li }, gi) => li.classList.toggle("is-off", terms.length > 0 && !litFamilies.has(gi)));
      state.hover = null;
      state.hot = null;
      if (!terms.length) {
        state.missing = null;
        state.pick = null;
        state.fam = null;
      } else if (first == null) {
        state.missing = filterBox.value.trim();
        state.pick = null;
        state.fam = null;
      } else {
        state.missing = null;
        state.pick = first;
        state.fam = entries[first].gi;
      }
      render();
    });

    // ---------------------------------------------------------- size
    function fit() {
      const size = Math.max(220, Math.floor(Math.min(sky.clientWidth, sky.clientHeight - 30) - 16));
      map.style.width = `${size}px`;
      map.style.height = `${size}px`;
      map.style.setProperty("--half", `${size / 2}px`);
      /*
       * Ring names at 10 px on screen, or smaller when the rings are closer
       * together than that can sit between -- nine rings on a phone are 13 px
       * apart. The SVG is drawn in a 1000-unit box, so a unit is size/1000 px.
       */
      const gapPx = (labelGap * size) / 1000;
      const namePx = Math.min(10, Math.max(7.5, gapPx * 0.6));
      orbits.style.fontSize = `${(namePx * 1000) / size}px`;
      paintSurface(size * Number(map.style.getPropertyValue("--g")));
    }
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    observer?.observe(sky);

    function clearSelection() {
      if (state.pick == null && state.fam == null) return false;
      state.pick = null;
      state.fam = null;
      render();
      return true;
    }

    function destroy() {
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(hoverTimer);
      observer?.disconnect();
    }

    return { board, filterBox, back, fit, render, clearSelection, destroy };
  }

  function openMoons(name) {
    const body = bodiesByName.get(name);
    if (!body || !body.moons.length) return;
    closeMoons(true);
    const built = buildMoonBoard(body);
    moonBoard = built;
    root.append(built.board);
    built.fit();
    built.render();
    void built.board.offsetWidth;
    built.board.classList.add("is-opening");
    setTimeout(() => built.board.classList.remove("is-opening"), 1600);
    (built.filterBox ?? built.back).focus({ preventScroll: true });
  }

  function closeMoons(immediate = false) {
    if (!moonBoard) return false;
    const { board, destroy } = moonBoard;
    moonBoard = null;
    destroy();
    if (immediate) {
      board.remove();
      return true;
    }
    board.classList.remove("is-opening");
    board.classList.add("is-closing");
    setTimeout(() => board.remove(), 320);
    return true;
  }

  // ------------------------------------------------------------ wiring

  function jumpTo(key) {
    const column = track.querySelector(`[data-region="${key}"]`);
    if (!column) return;
    track.scrollTo({ left: column.offsetLeft - 24, behavior: "smooth" });
  }

  function wire() {
    // The board sits over the canvas. Nothing that happens on it may reach
    // the window listeners that pick bodies and steer the camera.
    ["pointerdown", "pointerup", "click", "dblclick", "contextmenu"].forEach((type) => {
      root.addEventListener(type, (event) => event.stopPropagation());
    });

    root.addEventListener("click", (event) => {
      const travelTo = event.target.closest("[data-travel]");
      if (travelTo && !travelTo.disabled) {
        travel(travelTo.dataset.travel);
        return;
      }
      const moonsOf = event.target.closest("[data-moons-of]");
      if (moonsOf && !moonsOf.disabled) {
        openMoons(moonsOf.dataset.moonsOf);
        return;
      }
      if (event.target.closest("[data-moon-back]")) {
        closeMoons();
        return;
      }
      if (event.target.closest("[data-close-board]")) {
        close();
        return;
      }
      const jump = event.target.closest("[data-jump]");
      if (jump) {
        jumpTo(jump.dataset.jump);
        return;
      }
      const chip = event.target.closest("[data-filter]");
      if (chip && !chip.disabled) {
        filter = chip.dataset.filter;
        apply();
      }
    });
    searchInput.addEventListener("input", apply);

    /*
     * Keys stay on the board. The scene listens on window for Space, the
     * arrows and Shift+P; a space typed into the search box must not scroll
     * the journey. Escape unwinds one layer at a time: the search text, then
     * the moon or family picked on the moon board, then the moon board, then
     * the board.
     */
    root.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        const active = document.activeElement;
        if (active?.tagName === "INPUT" && active.value) {
          active.value = "";
          active.dispatchEvent(new Event("input"));
          return;
        }
        if (moonBoard?.clearSelection()) return;
        if (closeMoons()) return;
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
    root.addEventListener("wheel", (event) => {
      event.stopPropagation();
      const lane = event.target.closest(".cboard__track");
      if (!lane || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const list = event.target.closest(".cboard__bodies");
      if (list) {
        const canDown = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
        const canUp = list.scrollTop > 0;
        if ((event.deltaY > 0 && canDown) || (event.deltaY < 0 && canUp)) return;
      }
      event.preventDefault();
      lane.scrollLeft += event.deltaY;
    }, { passive: false });

    // Drag a track to pan.
    let drag = null;
    root.addEventListener("pointerdown", (event) => {
      const lane = event.target.closest(".cboard__track");
      if (!lane || event.button !== 0 || event.target.closest("button, input")) return;
      drag = { lane, x: event.clientX, left: lane.scrollLeft, id: event.pointerId };
      lane.setPointerCapture(event.pointerId);
      lane.classList.add("is-dragging");
    });
    root.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.lane.scrollLeft = drag.left - (event.clientX - drag.x);
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.lane.classList.remove("is-dragging");
      drag = null;
    };
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
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
    // Every visit opens on the whole Solar System, with Everything selected.
    searchInput.value = "";
    filter = "all";
    apply();
    void root.offsetWidth;
    root.classList.add("is-opening");
    track.scrollLeft = 0;
    runClock();
    setTimeout(() => {
      if (!open) return;
      root.classList.remove("is-opening");
      root.classList.add("is-open");
    }, OPEN_MS + 700);
    announce(true);
    setTimeout(() => searchInput.focus({ preventScroll: true }), 60);
  }

  function close({ restoreFocus = true } = {}) {
    if (!root || !open) return;
    open = false;
    cancelAnimationFrame(clockFrame);
    closeMoons(true);
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
    openMoons,
    isOpen: () => open,
    data,
  });
}

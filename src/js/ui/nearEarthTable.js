import { getNearEarthList, describeMoid } from "../scene/smallBodies/nearEarthSwarm.js";

/**
 * Every stamped near-Earth asteroid in one table.
 *
 * Round 39, third pass (the owner: "instead of show more ... a different
 * screen where we would have tabular format of all the names ... with a
 * searchable option"). Opened from a family's board page; covers that page
 * until "Back" (or Escape, which the board already handles by closing).
 *
 *   - only the family it was opened from (the owner: "don't show all
 *     button, only show whatever we are seeing" -- the All and other-family
 *     chips are gone), with a search box (name or JPL designation);
 *   - columns that sort when their heading is clicked;
 *   - a click on a row flies there: each row carries `data-travel`, which
 *     the board's own click handling turns into a journey, as for any row.
 *
 * ~38,000 rows: only the rows in view are in the page (fixed 40 px rows,
 * a spacer for the rest), redrawn as it scrolls -- a few dozen elements
 * whatever the count.
 */

const FAMILIES = [
  { key: "atira", label: "Atiras", colour: "#ffbf86" },
  { key: "aten", label: "Atens", colour: "#ffe08a" },
  { key: "apollo", label: "Apollos", colour: "#9ff0b8" },
  { key: "amor", label: "Amors", colour: "#8ad6ff" },
];
const COLOUR = Object.fromEntries(FAMILIES.map((f) => [f.key, f.colour]));
const SINGLE = { atira: "Atira", aten: "Aten", apollo: "Apollo", amor: "Amor" };
const ROW = 40;

const size = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);
/* Shared with the rock's card (nearEarthSwarm.js). */
const closest = (moid) => describeMoid(moid);

const COLUMNS = [
  { key: "name", label: "Name", sort: (a, b) => a.name.localeCompare(b.name, "en", { numeric: true }), cell: (r) => r.name },
  { key: "size", label: "Size", sort: (a, b) => b.sizeKm - a.sizeKm, cell: (r) => `${size(r.sizeKm)}${r.measured ? "" : " *"}` },
  { key: "type", label: "Type", sort: (a, b) => (a.type ?? "~").localeCompare(b.type ?? "~"), cell: (r) => (r.type ? `${r.type}-type` : "—") },
  { key: "moid", label: "Path comes within", title: "How close its orbit comes to Earth's orbit (JPL MOID)", sort: (a, b) => (a.moid ?? 99) - (b.moid ?? 99), cell: (r) => closest(r.moid) },
  { key: "range", label: "From the Sun", sort: (a, b) => a.q - b.q, cell: (r) => `${r.q.toFixed(2)}–${r.Q.toFixed(2)} AU` },
  { key: "years", label: "Year", title: "One trip round the Sun", sort: (a, b) => a.years - b.years, cell: (r) => (r.years < 1 ? `${Math.round(r.years * 365.25)} days` : `${r.years.toFixed(2)} yr`) },
  { key: "rot", label: "Day", title: "Rotation period, where measured", sort: (a, b) => (a.rotH ?? 1e9) - (b.rotH ?? 1e9), cell: (r) => (r.rotH ? `${r.rotH} h` : "—") },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Opens the table over `host` (the family's board page). `family` is the
 * family it lists (atira, aten, apollo or amor). Returns { close }.
 */
export function openNearEarthTable(host, { family = "aten", backLabel = "Back" } = {}) {
  const shown = FAMILIES.find((f) => f.key === family) ?? FAMILIES[1];
  const sheet = el("section", "neotab");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", `Every ${SINGLE[shown.key]}, as a table`);

  const head = el("header", "neotab__head");
  const back = el("button", "cmoons__back neotab__back");
  back.type = "button";
  back.innerHTML = `<span aria-hidden="true">←</span> ${backLabel}`;
  const titles = el("div", "neotab__titles");
  const title = el("h2", "cboard__h neotab__title", `Every ${SINGLE[shown.key]}`);
  const count = el("p", "cboard__count neotab__count");
  titles.append(title, count);
  head.append(back, titles);

  const controls = el("div", "neotab__controls");
  const search = el("input", "cexp__search-input neotab__search");
  search.type = "search";
  search.placeholder = "Search by name or designation";
  search.setAttribute("aria-label", `Search the ${shown.label}`);
  controls.append(search);

  const table = el("div", "neotab__table");
  const header = el("div", "neotab__row neotab__row--head");
  const headerCells = COLUMNS.map((col) => {
    const cell = el("button", "neotab__cell neotab__sort", col.label);
    cell.type = "button";
    cell.dataset.sort = col.key;
    if (col.title) cell.title = col.title;
    header.append(cell);
    return cell;
  });
  const viewport = el("div", "neotab__viewport");
  const spacer = el("div", "neotab__spacer");
  const rows = el("div", "neotab__rows");
  spacer.append(rows);
  viewport.append(spacer);
  table.append(header, viewport);
  const foot = el("p", "cmoons__note neotab__foot",
    "* Size from its brightness at an albedo assumed for its type — not measured. Data: NASA/JPL Small-Body Database, 10 October 2026. Click a row to fly to that rock.");

  sheet.append(head, controls, table, foot);
  host.append(sheet);

  const state = { family: shown.key, query: "", sort: "size", flip: false, list: [], loadTimer: 0 };

  function compute() {
    const all = getNearEarthList(state.family);
    if (!all.length) {
      state.list = [];
      count.textContent = "Loading the list…";
      if (!state.loadTimer) {
        state.loadTimer = setInterval(() => {
          if (getNearEarthList(state.family).length) {
            clearInterval(state.loadTimer);
            state.loadTimer = 0;
            compute();
          }
        }, 1000);
      }
      paint();
      return;
    }
    const q = state.query.trim().toLowerCase();
    let list = q ? all.filter((r) => r.name.toLowerCase().includes(q) || r.pdes.toLowerCase().includes(q)) : all.slice();
    const col = COLUMNS.find((c) => c.key === state.sort);
    if (col && state.sort !== "size") list = list.sort(col.sort);
    /* A second click on the same heading turns the order round. */
    if (state.flip) list.reverse();
    /* Rows with nothing on record ("—") stay at the bottom either way. */
    if (col && state.sort !== "name") {
      const blank = (r) => (state.sort === "moid" && r.moid === null) || (state.sort === "rot" && !r.rotH) || (state.sort === "type" && !r.type);
      list = list.filter((r) => !blank(r)).concat(list.filter(blank));
    }
    state.list = list;
    const label = shown.label;
    count.textContent = q
      ? `${list.length.toLocaleString("en-US")} of ${all.length.toLocaleString("en-US")} ${label} match “${state.query.trim()}”`
      : `${all.length.toLocaleString("en-US")} ${label} · sorted by ${col?.label.toLowerCase() ?? "size"}${state.flip ? ", reversed" : ""}`;
    /* Size starts largest-first, the rest smallest/A-first. */
    const natural = state.sort === "size" ? "descending" : "ascending";
    const flipped = natural === "descending" ? "ascending" : "descending";
    headerCells.forEach((cell) => cell.setAttribute("aria-sort", cell.dataset.sort === state.sort ? (state.flip ? flipped : natural) : "none"));
    spacer.style.height = `${list.length * ROW}px`;
    viewport.scrollTop = 0;
    paint();
  }

  /* Only the rows in view (plus a few either side) are in the page. */
  function paint() {
    const first = Math.max(0, Math.floor(viewport.scrollTop / ROW) - 6);
    const last = Math.min(state.list.length, Math.ceil((viewport.scrollTop + viewport.clientHeight) / ROW) + 6);
    rows.style.transform = `translateY(${first * ROW}px)`;
    rows.replaceChildren(...state.list.slice(first, last).map((r) => {
      const row = el("button", "neotab__row");
      row.type = "button";
      row.dataset.travel = r.key;
      row.style.setProperty("--fam", COLOUR[r.family] ?? "#9ff0dc");
      COLUMNS.forEach((col) => row.append(el("span", `neotab__cell neotab__cell--${col.key}`, col.cell(r))));
      return row;
    }));
  }

  let frame = 0;
  viewport.addEventListener("scroll", () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; paint(); });
  });
  search.addEventListener("input", () => { state.query = search.value; compute(); });
  header.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-sort]");
    if (!cell) return;
    event.stopPropagation();
    state.flip = state.sort === cell.dataset.sort ? !state.flip : false;
    state.sort = cell.dataset.sort;
    compute();
  });
  /* Keys typed here are for the search box, not the board's shortcuts. */
  search.addEventListener("keydown", (event) => { if (event.key !== "Escape") event.stopPropagation(); });

  function close() {
    clearInterval(state.loadTimer);
    cancelAnimationFrame(frame);
    sheet.remove();
  }
  back.addEventListener("click", (event) => { event.stopPropagation(); close(); });

  compute();
  requestAnimationFrame(() => { paint(); search.focus({ preventScroll: true }); });
  return { close };
}

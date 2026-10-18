import { searchTerms, matches } from "./searchMatch.js";
import { drawEventVignette, FAMILY_COLOURS } from "./eventVignettes.js";

/**
 * Space events, as a carousel (round 43).
 *
 * The owner looked at three live concepts (prototypes/space-events-concepts.html:
 * an orrery map, a mission-control console and a cosmic carousel) and chose
 * the carousel: one event at a time, large, with an animated preview of what
 * it is, and a curved ring of every other event underneath to turn through.
 * The four that used to be listed as "coming soon" are built now
 * (scene/events/systemProcesses.js), so every card in the ring can be
 * watched.
 *
 * ## What pressing "Go watch it" does
 *
 * Unchanged from the list it replaces: the panel closes, the camera flies to
 * the body the event happens on, a five-second countdown names what is
 * coming, and the event plays once (main.js, presentSolarEvent). An event
 * whose body is not built yet (a moon, before the camera has been to its
 * planet) offers to fly to the planet first instead of failing.
 *
 * ## Order
 *
 * Round 80 (Prompts.md: "first will be how the Solar System got formed, and
 * reorder the events from how it was in the past to the future; all size
 * events at the end"): the ring runs through time. Dated events from the
 * Solar System's birth to the latest; then the things happening now (by
 * chip); then what is to come; then the size-and-scale events. Search and
 * the chips narrow the ring and keep that order.
 *
 * ## Cost
 *
 * Only while open: the large preview and the cards within four places of
 * the front are redrawn each frame (2D canvas); the rest are not drawn.
 */

const CLOSE_KEY = "Escape";

/* The ring's order: a journey from the beginning and outwards. Ids missing
 * here go at the end in roster order. */
const ORDER = [
  "solar-system-formation", "solar-wind", "solar-cme", "sungrazer",
  "mercury-sodium-tail", "meteor-shower", "solar-eclipse", "seasons",
  "earth-magnetosphere", "lunar-impact-flash", "mars-dust-storm",
  "jupiter-impact", "io-eruption", "saturn-impact", "saturn-white-spot",
  "ring-spokes", "enceladus-plumes", "uranus-storms", "triton-geysers",
  "oumuamua-passage", "borisov-passage", "atlas-3i-passage",
  "supernova", "kilonova",
];

/*
 * Round 79: the chips above the ring (the catalogue took the panel from 24
 * events to 134). Each event says which it belongs to (`section`).
 */
/*
 * Round 80: when each dated event happened or will happen, as a year (CE;
 * negative = before year 0, so -4.5673e9 is 4.567 billion years ago). Dates
 * are the cards' own (`when`, `frequency`); ones not listed are happening
 * now -- ongoing or recurring -- and sit between the past and the future.
 */
const PRESENT = 2026;
const YEAR = {
  /* the past */
  "solar-system-formation": -4.5673e9, /* CAI ages, Connelly et al. 2012 */
  "arrokoth-merger": -4.566e9, /* within the first few million years */
  "theia-impact": -4.5e9,
  "vesta-rheasilvia": -1e9,
  chicxulub: -6.6e7,
  "magnetic-reversal": -7.8e5,
  "crab-supernova": 1054.5,
  "leonid-storm-1833": 1833.87,
  "sun-carrington": 1859.67,
  tunguska: 1908.5,
  "daylight-fireball-1972": 1972.61,
  "sn-1987a": 1987.15,
  "neptune-dark-spot": 1989.6,
  "venus-volcano": 1991.5,
  "comet-breakup": 1995.7,
  "hale-bopp": 1997.25,
  "magnetar-flare": 2004.99,
  "encke-tail": 2007.3,
  "holmes-outburst": 2007.81,
  "asteroid-collision": 2009.2,
  "jupiter-belt-fade": 2010.3,
  "transit-venus": 2012.43,
  chelyabinsk: 2013.12,
  "asteroid-spin-apart": 2013.8,
  gw150914: 2015.7,
  "proxima-superflare": 2016.21,
  kilonova: 2017.63, /* GW170817 */
  "oumuamua-passage": 2017.8,
  "bennu-particles": 2019.02,
  "borisov-passage": 2019.67,
  "betelgeuse-dimming": 2019.95,
  neowise: 2020.5,
  "great-conjunction": 2020.97,
  "grb-boat": 2022.77,
  "sun-gannon-storm": 2024.36,
  "mini-moon-2024": 2024.75,
  "tsuchinshan-atlas": 2024.78,
  "atlas-3i-passage": 2025.8,
  /* expected any time: first after the present */
  "t-crb-nova": PRESENT + 0.5,
  /* the future */
  "eclipse-2027": 2027.59,
  "apophis-2029": 2029.28,
  "halley-2061": 2061.57,
  "gliese-710": PRESENT + 1.29e6,
  "phobos-fall": PRESENT + 4e7,
  "triton-doom": PRESENT + 3.6e9,
  "sun-red-giant": PRESENT + 5e9,
  "milky-way-andromeda": PRESENT + 1e10,
};

const SECTIONS = [
  { key: "scale", label: "Size & scale" },
  { key: "sun", label: "The Sun" },
  { key: "earth", label: "Earth & Moon" },
  { key: "inner", label: "Mercury · Venus · Mars" },
  { key: "asteroids", label: "Asteroids" },
  { key: "giants", label: "Jupiter & Saturn" },
  { key: "outer", label: "Ice giants & beyond" },
  { key: "comets", label: "Comets & visitors" },
  { key: "alignments", label: "Alignments" },
  { key: "deep", label: "Deep sky" },
];

/* Short "how often" words for the tag; the full sentence is in the card. */
const OFTEN = {
  "solar-system-formation": "Once, 4.6 billion years ago",
  "solar-wind": "All the time",
  "solar-cme": "Several a day at maximum",
  sungrazer: "One every ~3 days",
  "mercury-sodium-tail": "Every 88-day orbit",
  "meteor-shower": "~12 major showers a year",
  "solar-eclipse": "2–5 a year",
  seasons: "Every orbit",
  "earth-magnetosphere": "Several storms a year at maximum",
  "lunar-impact-flash": "~0.7 an hour watched",
  "mars-dust-storm": "Every ~5½ years",
  "jupiter-impact": "Tens a year",
  "io-eruption": "Always erupting",
  "saturn-impact": "A fifth of Jupiter's rate",
  "saturn-white-spot": "Every ~30 years",
  "ring-spokes": "Each equinox, ~15 years",
  "enceladus-plumes": "Continuous",
  "uranus-storms": "Seasonal",
  "triton-geysers": "Vents run ~a year",
  "oumuamua-passage": "Once, 2017",
  "borisov-passage": "Once, 2019",
  "atlas-3i-passage": "Once, 2025",
  supernova: "~2 per century",
  kilonova: "Seen once, 2017",
};

/*
 * Round 43 (the owner: "add date timings details as well like when it
 * occurred and if it is possible it may be reoccur"). When each last
 * happened and when it can next be expected, as of October 2026. Sources:
 *   eclipses       NASA, science.nasa.gov/eclipses/future-eclipses
 *   storms         SpaceWeatherLive 2025 top-50 (12 Nov 2025, Kp 9-);
 *                  NOAA SWPC (10-11 May 2024, G5); NASA/NOAA solar
 *                  maximum announcement, 15 October 2024
 *   Mercury        perihelia 6 Feb, 5 May, 1 Aug 2027 (derekscope.co.uk);
 *                  the late-2026 dates are those less 87.97-day orbits
 *   equinox        23 September 2026, 00:05 UTC (timedate.org)
 *   Jupiter flash  28 August 2023, Tadao Ohsugi (Japan)
 *   Saturn flash   5 July 2025, Mario Rana -- not confirmed (DeTeCt,
 *                  10 July 2025; EarthSky)
 *   Uranus         northern summer solstice April 2030 (nakedeyeplanets)
 *   the rest       as cited on each event's card
 * These go out of date: "next" is the next one after October 2026.
 */
const TIMELINE = {
  "solar-system-formation": {
    last: "4,567.3 million years ago — dated from the oldest grains in meteorites",
    next: "Never again here. It is happening now round young stars: ALMA's 2014 picture of HL Tauri's disc was the first sharp view",
  },
  "solar-wind": {
    last: "Right now. The Sun has never stopped blowing it",
    next: "Continuous. The 11-year cycle peaked around October 2024 and is now declining",
  },
  "solar-cme": {
    last: "11 November 2025: a fast CME that drove a severe storm at Earth. 8–10 May 2024: the burst behind the strongest storm in 20 years",
    next: "Any day — several a day near solar maximum, still frequent as the cycle declines",
  },
  sungrazer: {
    last: "SOHO catches one every few days. Famous: Comet ISON broke up on 28 November 2013; Comet Lovejoy survived on 16 December 2011",
    next: "Within days — the next Kreutz sungrazer in SOHO's cameras",
  },
  "mercury-sodium-tail": {
    last: "Around Mercury's perihelion of 14 August 2026",
    next: "Around 10 November 2026, then 6 February 2027 — each perihelion",
  },
  "meteor-shower": {
    last: "The Perseids, peaking 12–13 August 2026",
    next: "Orionids about 21–22 October 2026 · Leonids about 17 November · Geminids 13–14 December",
  },
  "solar-eclipse": {
    last: "12 August 2026: total, over Greenland, Iceland and northern Spain",
    next: "6 February 2027: annular (South America, Africa) · 2 August 2027: total, Spain to Egypt — over 6 minutes at best",
  },
  seasons: {
    last: "September equinox: 23 September 2026",
    next: "December solstice: 21 December 2026 · Earth closest to the Sun: early January 2027",
  },
  "earth-magnetosphere": {
    last: "11–12 November 2025: a severe storm (Kp 9−) with aurorae far south. 10–11 May 2024: the strongest (G5) since 2003",
    next: "Not forecastable beyond a few days; big storms often come in the years after solar maximum",
  },
  "lunar-impact-flash": {
    last: "Every clear night someone watches. The brightest on record: 11 September 2013, a rock of about 400 kg (Madiedo et al.)",
    next: "Tonight, on the Moon's unlit side",
  },
  "mars-dust-storm": {
    last: "30 May – autumn 2018: the storm that silenced the Opportunity rover (last heard 10 June 2018)",
    next: "Cannot be predicted. Dust-storm season returns every Mars year, in the southern spring and summer",
  },
  "jupiter-impact": {
    last: "28 August 2023: a flash filmed by Tadao Ohsugi in Japan — one of four impacts caught in 2023",
    next: "Tens hit every year; amateurs' cameras catch one every year or so",
  },
  "saturn-impact": {
    last: "None confirmed yet. A possible flash filmed on 5 July 2025 (Mario Rana) was not confirmed by other observers",
    next: "Unknown — the first confirmed Saturn impact flash is still waiting to be caught",
  },
  "saturn-white-spot": {
    last: "December 2010 – August 2011, watched by Cassini. Before that: 1876, 1903, 1933, 1960, 1990",
    next: "Not predictable; on the old pattern, sometime in the 2030s or 2040s",
  },
  "ring-spokes": {
    last: "Now: Saturn's equinox fell on 6 May 2025, and this is spoke season",
    next: "The next equinox, around 2039",
  },
  "enceladus-plumes": {
    last: "Continuous since Cassini found the jets in 2005. JWST saw a plume about 9,600 km long in 2022",
    next: "Ongoing — stronger each time Enceladus is farthest from Saturn, every 33 hours",
  },
  "uranus-storms": {
    last: "August 2014: eight large storms in one night (Keck)",
    next: "Uranus reaches northern summer solstice in April 2030; activity is expected to stay high as it nears",
  },
  "triton-geysers": {
    last: "25 August 1989: Voyager 2, the only spacecraft ever to visit",
    next: "Unknown — no mission has been back since",
  },
  "oumuamua-passage": {
    last: "Closest to the Sun 9 September 2017 · found 19 October 2017",
    next: "Never — it is leaving for good. The Vera C. Rubin Observatory is expected to find new visitors",
  },
  "borisov-passage": {
    last: "Found 30 August 2019 · closest to the Sun 8 December 2019",
    next: "Never — it is leaving for good. More visitors like it are expected to be found",
  },
  "atlas-3i-passage": {
    last: "Found 1 July 2025 · closest to the Sun 29 October 2025 · passed Jupiter March 2026",
    next: "Never — it passes Neptune's distance in March 2028 on its way out",
  },
  supernova: {
    last: "In our galaxy, seen by eye: 1604 (Kepler's star). Nearest since: SN 1987A, 23 February 1987, in the Large Magellanic Cloud",
    next: "Unpredictable — about two a century in the Milky Way, most hidden behind dust",
  },
  kilonova: {
    last: "17 August 2017 (GW170817), 130 million light-years away",
    next: "Whenever gravitational-wave detectors catch another neutron-star merger close enough to see",
  },
};

/* A moon is built when the camera first reaches its planet. */
const PARENT = { Moon: "Earth", Io: "Jupiter", Enceladus: "Saturn", Triton: "Neptune" };

/* 150 px cards with 20 px between them, round the ring's circumference. */
const CARD_PITCH = 170;

function normalise(value) {
  return String(value ?? "").toLowerCase();
}

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w: rect.width, h: rect.height, dpr };
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

  const unordered = events.list();
  const ordered = [
    ...ORDER.map((id) => unordered.find((e) => e.id === id)).filter(Boolean),
    ...unordered.filter((e) => !ORDER.includes(e.id)),
  ];
  /* Round 80: through time -- past, now (grouped by chip, in the journey's
   * order), future, then size and scale (see YEAR). */
  const sectionRank = (e) => {
    const i = SECTIONS.findIndex((sec) => sec.key === e.section);
    return i < 0 ? SECTIONS.length : i;
  };
  const era = (e) => {
    if (e.section === "scale") return 3;
    const year = YEAR[e.id];
    if (year === undefined) return 1;
    return year < PRESENT ? 0 : 2;
  };
  const roster = ordered
    .map((e, i) => ({ e, i }))
    .sort((a, b) => era(a.e) - era(b.e)
      || (YEAR[a.e.id] ?? 0) - (YEAR[b.e.id] ?? 0)
      || sectionRank(a.e) - sectionRank(b.e)
      || a.i - b.i)
    .map(({ e }) => e);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colourOf = (event) => FAMILY_COLOURS[event.family] ?? "#ffc482";

  let panel = document.querySelector("#space-events-dashboard");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "space-events-dashboard";
    document.body.append(panel);
  }
  panel.className = "events-dashboard events-dashboard--carousel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-labelledby", "events-dashboard-title");

  /* Built as one string and parsed once: the content is entirely ours. */
  panel.innerHTML = `
    <div class="events-dashboard__backdrop" data-events-dismiss></div>
    <article class="sec">
      <header class="sec__head">
        <div class="sec__heading">
          <span class="sec__eyebrow">${roster.length} real things that happen · from the beginning to the far future</span>
          <h2 id="events-dashboard-title">Space events</h2>
        </div>
        <div class="sec__search">
          <label class="sec__search-label" for="events-dashboard-filter">Find an event</label>
          <input type="search" id="events-dashboard-filter" class="sec__search-input"
            placeholder="A world, or a word like storm…" autocomplete="off" spellcheck="false" />
        </div>
        <button class="sec__close" type="button" aria-label="Close space events">×</button>
      </header>
      <div class="sec__chips" role="group" aria-label="Show events about">
        <button class="sec__chip is-on" type="button" data-section="" aria-pressed="true">Everything <span>${roster.length}</span></button>
        ${SECTIONS.map((sec) => {
          const n = roster.filter((e) => e.section === sec.key).length;
          return n ? `<button class="sec__chip" type="button" data-section="${sec.key}" aria-pressed="false">${sec.label} <span>${n}</span></button>` : "";
        }).join("")}
      </div>

      <div class="sec__hero">
        <div class="sec__stage"><canvas class="sec__preview" aria-hidden="true"></canvas></div>
        <div class="sec__text" aria-live="polite"></div>
      </div>

      <div class="sec__track" tabindex="0" aria-label="Every space event. Use the arrow keys to turn the ring.">
        <div class="sec__ring"></div>
      </div>
      <div class="sec__controls">
        <button class="sec__turn" type="button" data-turn="-1" aria-label="Previous event">‹</button>
        <span class="sec__count" aria-live="off"></span>
        <button class="sec__turn" type="button" data-turn="1" aria-label="Next event">›</button>
      </div>
      <p class="sec__empty" hidden>Nothing matches that. Try a world's name, or a word like <em>storm</em>, <em>impact</em> or <em>ice</em>.</p>
      <p class="sec__foot">Timings are compressed — nobody waits five and a half years for a Martian dust storm — but the sizes, colours, durations and rates are the observed ones.</p>
    </article>
  `;

  const sheet = panel.querySelector(".sec");
  const closeButton = panel.querySelector(".sec__close");
  const filterInput = panel.querySelector("#events-dashboard-filter");
  const ringEl = panel.querySelector(".sec__ring");
  const track = panel.querySelector(".sec__track");
  const textEl = panel.querySelector(".sec__text");
  const countEl = panel.querySelector(".sec__count");
  const emptyEl = panel.querySelector(".sec__empty");
  const preview = panel.querySelector(".sec__preview");
  const previewCtx = preview.getContext("2d");

  let open = false;
  let unsubscribe = null;
  let shown = roster.slice();
  let index = 0;
  let turn = 0;
  let cards = [];
  let state = { activeId: null, lastPlayedId: null, viewCounts: {} };
  let availability = {};
  let frame = 0;
  let autoTurn = !reduced;
  let lastTurnAt = 0;

  /* ------------------------------------------------------------ the ring */

  function buildRing() {
    ringEl.innerHTML = shown.map((event, i) => `
      <button class="sec__card" type="button" data-i="${i}" style="--c:${colourOf(event)}" aria-label="${event.title}, ${event.place}">
        <canvas aria-hidden="true"></canvas>
        <strong>${event.title}</strong>
        <span>${event.place}</span>
      </button>`).join("");
    cards = [...ringEl.children].map((node) => ({ node, canvas: node.querySelector("canvas") }));
    cards.forEach((card) => { card.ctx = card.canvas.getContext("2d"); });
    layout();
  }

  const radius = () => Math.max(260, Math.round((shown.length * CARD_PITCH) / (2 * Math.PI)));
  const step = () => 360 / Math.max(1, shown.length);
  const distance = (i) => {
    const n = shown.length;
    const d = Math.abs(i - index) % n;
    return Math.min(d, n - d);
  };

  function layout() {
    const r = radius();
    cards.forEach((card, i) => {
      card.node.style.transform = `rotateY(${i * step()}deg) translateZ(${r}px)`;
    });
    turnTo(index, { instant: true });
  }

  function turnTo(next, { instant = false } = {}) {
    if (!shown.length) return;
    const n = shown.length;
    /* Round 44 (Prompts.md: "when I am at 24 and press next the number
     * shows 1 but the carousel turns backwards to 1 -- it should not break
     * the flowing loop"). The ring's angle comes from `turn`, which only
     * ever moves by the shortest way round and is never wrapped, so 24 -> 1
     * is one step forward, not twenty-three back. */
    if (instant) {
      turn = ((next % n) + n) % n;
    } else {
      let delta = (((next - index) % n) + n) % n;
      if (delta > n / 2) delta -= n;
      turn += delta;
    }
    index = ((turn % n) + n) % n;
    ringEl.classList.toggle("is-instant", instant);
    ringEl.style.transform = `translateZ(${-radius()}px) rotateY(${-turn * step()}deg)`;
    cards.forEach((card, i) => {
      const d = distance(i);
      card.node.classList.toggle("is-front", i === index);
      card.node.style.opacity = d > 4 ? "0" : String(1 - d * 0.17);
      card.node.tabIndex = d > 2 ? -1 : 0;
      card.node.setAttribute("aria-current", i === index ? "true" : "false");
    });
    countEl.textContent = `${String(index + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
    renderText();
  }

  /* --------------------------------------------------------- the front */

  function seenWords(event) {
    if (state.activeId === event.id) return { text: "Happening now", tone: "live" };
    const seen = state.viewCounts?.[event.id] ?? 0;
    return seen ? { text: `Seen ${seen}×`, tone: "seen" } : { text: "Not seen yet", tone: "unseen" };
  }

  function renderText() {
    const event = shown[index];
    if (!event) { textEl.innerHTML = ""; return; }
    const ready = availability[event.id] !== false;
    const parent = PARENT[event.body];
    const seen = seenWords(event);
    textEl.style.setProperty("--c", colourOf(event));
    textEl.innerHTML = `
      <div class="sec__swap">
        <span class="sec__place">${event.place}</span>
        <h3 class="sec__title">${event.title}</h3>
        <div class="sec__tags">
          <span class="sec__tag" style="--c:${colourOf(event)}">${event.familyLabel}</span>
          <span class="sec__tag sec__tag--quiet" title="${event.kindBlurb ?? ""}">${event.kindLabel} · ${OFTEN[event.id] ?? event.often ?? event.kindShort}</span>
          <span class="sec__seen" data-tone="${seen.tone}">${seen.text}</span>
        </div>
        <p class="sec__detail">${event.detail}.</p>
        ${(TIMELINE[event.id] ?? event.timeline) ? `<dl class="sec__timeline">
          ${(TIMELINE[event.id] ?? event.timeline).last ? `<div><dt>Last happened</dt><dd>${(TIMELINE[event.id] ?? event.timeline).last}</dd></div>` : ""}
          ${(TIMELINE[event.id] ?? event.timeline).next ? `<div><dt>Next</dt><dd>${(TIMELINE[event.id] ?? event.timeline).next}</dd></div>` : ""}
        </dl>` : event.when ? `<p class="sec__when"><span>When</span>${event.when}</p>` : ""}
        <details class="sec__more">
          <summary>Why it happens · how often</summary>
          <p>${event.cause}</p>
          <p>${event.frequency}.</p>
          ${event.accuracy ? `<p class="sec__accuracy">${event.accuracy}</p>` : ""}
        </details>
        <div class="sec__actions">
          ${ready
            ? `<button class="sec__go" type="button" data-play="${event.id}"><span aria-hidden="true"></span>Go watch it</button>`
            : `<button class="sec__go sec__go--travel" type="button" data-travel="${parent ?? event.body}"><span aria-hidden="true"></span>Fly to ${parent ?? event.body} first</button>
               <small class="sec__hint">${event.body} is built when the camera first reaches ${parent ?? "it"}; then it can be watched.</small>`}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------ drawing */

  function draw(now) {
    if (!open) return;
    frame = requestAnimationFrame(draw);
    const t = reduced ? 2.4 : now / 1000;
    const event = shown[index];
    if (event) {
      const { w, h, dpr } = fitCanvas(preview);
      previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try { drawEventVignette(previewCtx, w, h, t, event); } catch { /* a sketch failing must not stop the panel */ }
    }
    cards.forEach((card, i) => {
      if (distance(i) > 4) return;
      const { w, h, dpr } = fitCanvas(card.canvas);
      card.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try { drawEventVignette(card.ctx, w, h, t + i * 0.7, shown[i]); } catch { /* as above */ }
    });
    /* Turns on its own every 7 s until the viewer touches it. */
    if (autoTurn && now - lastTurnAt > 7000 && !sheet.matches(":hover") && !sheet.contains(document.activeElement)) {
      lastTurnAt = now;
      if (shown.length > 1) turnTo(index + 1);
    }
  }

  /* ------------------------------------------------------------ filter */

  /* Everything a card shows (renderText), as one string to search. */
  function searchText(e) {
    const timeline = TIMELINE[e.id] ?? e.timeline;
    return [e.place, e.body, e.title, e.familyLabel, e.kindLabel, e.kindShort, e.kindBlurb,
      OFTEN[e.id], e.often, e.detail, timeline?.last, timeline?.next, e.when, e.cause, e.frequency,
      e.accuracy, e.note].filter(Boolean).join(" ");
  }
  let searchFrom = null;
  let chosenSection = "";

  function applyFilter() {
    // Round 76: every word typed, anywhere, any case (ui/searchMatch.js).
    const terms = searchTerms(filterInput.value);
    const current = shown[index]?.id;
    /* Round 79: the chosen chip narrows first, then the search. */
    const pool = chosenSection ? roster.filter((e) => e.section === chosenSection) : roster;
    /*
     * Round 78 (the owner: "the events search still does not bring it up --
     * is it because of the tile I am on?"). Two things were wrong:
     * - It searched only part of what a card shows. A word in "how often",
     *   the last/next dates, the kind's description or the accuracy note
     *   was on screen but not searched ("mag" missed the Supernova, "storm"
     *   the solar wind). It now searches everything the card shows.
     * - It kept the tile you were on at the front whenever that tile also
     *   matched, so the match you were after could be round the back of the
     *   ring. Now a search always brings its best match to the front: those
     *   with the words in the title or place first, then the rest. Clearing
     *   the search returns to the tile you were on.
     */
    if (terms.length) {
      const hits = pool.filter((e) => matches(searchText(e), terms));
      const inName = hits.filter((e) => matches(`${e.title} ${e.place} ${e.body}`, terms));
      shown = [...inName, ...hits.filter((e) => !inName.includes(e))];
      if (!searchFrom) searchFrom = current;
      index = 0;
    } else {
      shown = pool.slice();
      const back = shown.findIndex((e) => e.id === (searchFrom ?? current));
      index = back >= 0 ? back : 0;
      searchFrom = null;
    }
    emptyEl.hidden = shown.length > 0;
    track.hidden = shown.length === 0;
    buildRing();
  }

  /* -------------------------------------------------------------- state */

  function onState(next) {
    state = next;
    renderText();
  }

  function setOpen(next) {
    if (open === next) return;
    open = next;
    panel.hidden = !open;
    panel.classList.toggle("is-open", open);
    trigger?.setAttribute("aria-expanded", String(open));
    if (open) {
      availability = events.getAvailability?.() ?? {};
      unsubscribe = events.subscribe(onState);
      /* Open on the event last watched, if any. */
      const last = state.lastPlayedId ?? state.activeId;
      const at = last ? shown.findIndex((e) => e.id === last) : -1;
      if (at >= 0) index = at;
      autoTurn = !reduced && !last;
      lastTurnAt = performance.now();
      turnTo(index, { instant: true });
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
      requestAnimationFrame(() => closeButton?.focus({ preventScroll: true }));
    } else {
      cancelAnimationFrame(frame);
      unsubscribe?.();
      unsubscribe = null;
    }
    /* Announced, so main.js suppresses scene picking while the panel is up. */
    window.dispatchEvent(new CustomEvent("beyond-earth:events-dashboard-state", { detail: { open } }));
  }

  /* ---------------------------------------------------------- listeners */

  const stopAuto = () => { autoTurn = false; };

  trigger?.addEventListener("click", () => setOpen(!open));
  closeButton.addEventListener("click", () => setOpen(false));
  panel.querySelector("[data-events-dismiss]")?.addEventListener("click", () => setOpen(false));
  sheet.addEventListener("pointerdown", (e) => e.stopPropagation());
  sheet.addEventListener("click", (e) => e.stopPropagation());
  /* The sheet owns its wheel: a scroll inside it must never reach the camera. */
  sheet.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

  panel.querySelectorAll("[data-turn]").forEach((button) => {
    button.addEventListener("click", () => { stopAuto(); turnTo(index + Number(button.dataset.turn)); });
  });

  ringEl.addEventListener("click", (e) => {
    const card = e.target.closest(".sec__card");
    if (!card) return;
    stopAuto();
    const i = Number(card.dataset.i);
    if (i === index) {
      const event = shown[i];
      if (availability[event.id] !== false) play(event.id);
    } else turnTo(i);
  });

  /* Swipe or drag across the ring to turn it. */
  let dragX = null;
  track.addEventListener("pointerdown", (e) => { dragX = e.clientX; });
  track.addEventListener("pointerup", (e) => {
    if (dragX !== null && Math.abs(e.clientX - dragX) > 40) { stopAuto(); turnTo(index + (e.clientX < dragX ? 1 : -1)); }
    dragX = null;
  });

  textEl.addEventListener("click", (e) => {
    const go = e.target.closest("[data-play]");
    if (go) { play(go.dataset.play); return; }
    const travel = e.target.closest("[data-travel]");
    if (travel) {
      setOpen(false);
      window.dispatchEvent(new CustomEvent("beyond-earth:travel-to-body", { detail: { name: travel.dataset.travel } }));
    }
  });
  textEl.addEventListener("toggle", stopAuto, true);

  sheet.addEventListener("keydown", (e) => {
    if (e.target === filterInput) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stopAuto(); turnTo(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); stopAuto(); turnTo(index - 1); }
  });

  addEventListener("keydown", (keyEvent) => {
    if (open && keyEvent.key === CLOSE_KEY) {
      keyEvent.stopPropagation();
      setOpen(false);
    }
  });

  filterInput.addEventListener("input", () => { stopAuto(); applyFilter(); });
  panel.querySelector(".sec__chips")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-section]");
    if (!chip) return;
    stopAuto();
    chosenSection = chip.dataset.section;
    panel.querySelectorAll(".sec__chip").forEach((c) => {
      const on = c === chip;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", String(on));
    });
    // A new group opens on its first event.
    searchFrom = null;
    const first = (chosenSection ? roster.filter((ev) => ev.section === chosenSection) : roster)[0];
    index = 0;
    applyFilter();
    if (first && !searchTerms(filterInput.value).length) turnTo(0, { instant: true });
  });

  function play(id) {
    if (!events.isAvailable?.(id)) {
      availability = events.getAvailability?.() ?? {};
      renderText();
      return;
    }
    /* Closed first, so the flight to the body is not watched through a panel. */
    setOpen(false);
    const staged = onView ? onView(id) : events.play(id);
    if (!staged) setOpen(true);
  }

  addEventListener("resize", () => { if (open) layout(); });

  buildRing();

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    get isOpen() { return open; },
    dispose() {
      cancelAnimationFrame(frame);
      unsubscribe?.();
      panel.remove();
    },
  };
}

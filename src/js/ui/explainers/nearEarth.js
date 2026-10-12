import {
  ATIRA_ELEMENTS,
  ATEN_ELEMENTS,
  APOLLO_ELEMENTS,
  AMOR_ELEMENTS,
} from "../../scene/smallBodies/populationCatalogue.js";
import { NEAR_EARTH_FAMILY_ROCKS } from "../../scene/smallBodies/nearEarthFamilies.js";
import { NEAR_EARTH_ODDITIES } from "../../scene/smallBodies/neoCatalogue.js";
import { SMALL_BODIES } from "../../scene/smallBodies/smallBodyCatalogue.js";
import { createRockPortraits } from "./rockPortraits.js";
import { getNearEarthList } from "../../scene/smallBodies/nearEarthSwarm.js";
import { openNearEarthTable } from "../nearEarthTable.js";
import {
  TAU, NOW_JD, PLANETS, planetAt, prepareRow, rowAt, placeOnOrbit,
  drawSun, ring, dot, tag,
  SVG_HEAD, svgSun, svgRing, svgText, svgEllipse,
} from "./common.js";

/**
 * The four near-Earth families, one view each.
 *
 * Round 38 (Prompts.md). The first version was one view of ~890 moving
 * dots, which the owner read as "sparkling things which sparkle, which
 * aren't". Now each family has its own view:
 *
 *   1 · In space    a few of its real members, rendered as the scene draws
 *                   them (rockPortraits.js) -- hard light, black sky
 *   2 · Its orbits  every big member's orbit from above, the drawn rocks
 *                   bright and moving, Earth's orbit marked
 *
 * with what they are made of (hover a chip), the misconception the owner
 * asked to be explained -- that they are not a belt -- and a list of the
 * rocks to fly to. "Show their paths in space" lights the family's orbits
 * in the scene (familyOrbits.js).
 *
 * Counts: JPL SBDB query API, classes IEO / ATE / APO / AMO, 10 October
 * 2026 (round 38 query). Orbits: populationCatalogue.js (H < 17.75 for the
 * three crowded families, every Atira).
 */

const point = { x: 0, y: 0, r: 0 };
const ALL_ROCKS = [...SMALL_BODIES, ...NEAR_EARTH_ODDITIES, ...NEAR_EARTH_FAMILY_ROCKS];
const rock = (name) => ALL_ROCKS.find((r) => r.name === name);

/* The misconception, shared by all four (Prompts.md: "explain the
 * misconception that it's not a belt"). */
const NOT_A_BELT = {
  title: "Not a belt",
  text: "Near-Earth asteroids are not a ring or a belt round the Sun, and a family is not a group that travels together. Each rock is on its own tilted, stretched orbit, and the nearest neighbours are usually millions of kilometres apart. A family is only a label for the shape of an orbit — where it is closest to and farthest from the Sun compared with Earth's. They are escapees from the main belt, nudged out through the Kirkwood gaps by Jupiter; most last around ten million years before they hit the Sun or a planet or are thrown out, and a rock's family can change after a close pass by a planet.",
};

/* Sources shared by the composition chips. */
const SAMPLES = "Samples: Itokawa (Hayabusa, Nakamura et al. 2011), Ryugu (Hayabusa2, Yokoyama et al. 2023), Bennu (OSIRIS-REx, Lauretta et al. 2024; Glavin et al. 2025).";

/* Small SVG pictures for the steps. */
/* `a` (px) and `e` of an example orbit, Sun at the focus; Earth's orbit
 * is the 26 px circle. */
const svgOrbitRule = (a, e, colour) => `${SVG_HEAD}${svgSun(60, 60, 4)}${svgRing(26, "rgba(79,134,198,0.9)")}${svgText(60, 30, "Earth", "#8fb6e6", 7)}${svgEllipse(a, e, 20, colour)}</svg>`;

function familyTopic({
  key,
  family,
  title,
  eyebrow,
  count,
  rows,
  colour,
  frameAU,
  portraits,
  orbitNames,
  composition,
  steps,
  members,
  lapDays,
  rule,
  source,
}) {
  return {
    key,
    aria: title,
    eyebrow,
    title,
    count,
    lapSeconds: 1,
    modes: [
      { key: "space", label: "1 · In space", sub: "How they look" },
      { key: "orbits", label: "2 · Their orbits", sub: "Every big one, from above" },
    ],
    note: NOT_A_BELT,
    composition,
    compositionTitle: "What they are made of · hover one",
    setup() {
      const drawn = orbitNames.map((name) => rock(name)).filter(Boolean).map((r) => ({
        name: r.name,
        p: prepareRow([r.orbit.aAU, r.orbit.e, r.orbit.iDeg, r.orbit.nodeDeg, r.orbit.argPeriDeg, r.orbit.meanAnomalyDeg, 0, r.orbit.epochJD]),
      }));
      return {
        rows: rows.map(prepareRow),
        drawn,
        portraits: createRockPortraits(portraits.map((name) => rock(name)).filter(Boolean)),
        orbitLayer: null,
        layerSize: 0,
        stars: Array.from({ length: 70 }, (_, i) => ({ x: fract(Math.sin(i * 12.9898) * 43758.5453), y: fract(Math.sin(i * 78.233) * 12543.123), b: 0.15 + 0.5 * fract(Math.sin(i * 3.7) * 9137.1) })),
      };
    },
    teardown(data) {
      data?.portraits?.dispose();
    },
    legend(mode) {
      return mode === "space"
        ? [{ colour: "#fff4e6", text: "Sunlight from the left — the only light" }, { colour: "#5a5f68", text: "Night side: no air, so no glow" }]
        : [
          { colour, text: `${title.replace("The ", "")}: every one over ~1 km`, line: true },
          { colour: "#ffffff", text: "The rocks drawn in the scene" },
          { colour: "#4f86c6", text: "Earth's orbit", line: true },
        ];
    },
    caption(mode) {
      return mode === "space"
        ? `${portraits.length} of them, rendered exactly as the scene draws them, turning — shown together, not to scale: sizes are on a squeezed curve. ${rule}`
        : `Every ${family} brighter than H 17.75 — roughly a kilometre or more — on its real orbit from the JPL database, seen from above. The drawn rocks move at their real relative speeds, sped up.`;
    },
    draw(ctx, w, t, mode, data) {
      if (mode === "space") drawSpace(ctx, w, t, data);
      else drawOrbits(ctx, w, t, data, { colour, frameAU, lapDays, family });
    },
    steps,
    membersTitle: "The ones drawn in detail",
    members,
    /* Round 39 (the owner: "add their names in the dashboard ... let the
     * user directly go and fly towards the rocks"): every other member of
     * the family, from JPL's list, searchable, largest first. */
    searchList: {
      title: `Every ${family} — fly to any of them`,
      placeholder: `Search the ${family}s by name or code, e.g. "${({ Atira: "2019 AQ3", Aten: "Khufu", Apollo: "Hermes", Amor: "Alinda" })[family] ?? "2024"}"`,
      pageSize: 40,
      /* Round 39: every one, in a table over this page. */
      openTable: (host) => openNearEarthTable(host, { family: family.toLowerCase(), backLabel: `Back to the ${family}s` }),
      items: () => {
        const key = family.toLowerCase();
        return getNearEarthList(key).map((rock) => ({
          travel: rock.key,
          label: rock.name,
          note: `${rock.sizeKm < 1 ? `${Math.round(rock.sizeKm * 1000)} m` : `${rock.sizeKm < 10 ? rock.sizeKm.toFixed(1) : Math.round(rock.sizeKm)} km`}${rock.measured ? "" : " (from its brightness)"}${rock.type ? ` · ${rock.type}-type` : ""}`,
          swatch: colour,
        }));
      },
    },
    actions: [{ label: `Show the ${family}s in space — paths and the 20 largest, named`, detail: { nearEarthFamily: key.replace("nea-", "") } }],
    source,
  };
}

function fract(v) { return v - Math.floor(v); }

/* ------------------------------------------------------------ in space */

function drawSpace(ctx, w, t, data) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, w);
  /* Faint, unmoving stars: far away, and a camera exposed for sunlit rock
   * barely records them. */
  data.stars.forEach((s) => {
    ctx.fillStyle = `rgba(220, 228, 240, ${s.b * 0.5})`;
    ctx.fillRect(s.x * w, s.y * w, 1, 1);
  });
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  /* `t` counts laps of 1 s (lapSeconds 1): seconds. */
  const ok = data.portraits.draw(ctx, w, t, ratio);
  if (!ok) {
    tag(ctx, "This browser could not draw the rocks (no WebGL).", w / 2, w / 2, { colour: "rgba(230,236,246,0.8)" });
    return;
  }
  data.portraits.labels(w).forEach(({ record, x, y }) => {
    tag(ctx, record.name, x, Math.min(w - 22, y), { colour: "rgba(236, 240, 248, 0.92)", font: "600 11px ui-sans-serif, system-ui, sans-serif" });
    const type = shortType(record);
    const size = record.diameterKm >= 1 ? `${record.diameterKm < 10 ? record.diameterKm.toFixed(1) : Math.round(record.diameterKm)} km` : `${Math.round(record.diameterKm * 1000)} m`;
    tag(ctx, type ? `${type} · ${size}` : size, x, Math.min(w - 8, y + 13), { colour: "rgba(190, 200, 214, 0.75)", font: "500 9.5px ui-sans-serif, system-ui, sans-serif" });
  });
}

/* Types for drawn rocks whose classification line does not say it:
 * Toutatis is S (SBDB spec_T; Sk in Bus-DeMeo). */
const TYPE_NOTE = { Toutatis: "S" };

function shortType(record) {
  if (TYPE_NOTE[record.name]) return `${TYPE_NOTE[record.name]}-type`;
  const text = `${record.spectralType ?? ""} ${record.classification ?? ""}`;
  const m = /\b(Sq|Sr|Xe|Xc|Q|S|C|B|M|E|D|X)\b(?:\s*\(|-type|\s*·|\s|$)/.exec(record.spectralType ?? "")
    ?? /\b([A-Z][a-z]?)(?:\([IVX]+\))?-type/.exec(text);
  /* No type on record: the label gives the size alone. */
  return m ? `${m[1]}-type` : "";
}

/* ------------------------------------------------------------- orbits */

function drawOrbits(ctx, w, t, data, { colour, frameAU, lapDays, family }) {
  const cx = w / 2;
  const cy = w / 2;
  const scale = (w * 0.46) / frameAU;
  const toXY = (x, y) => [cx + x * scale, cy - y * scale];
  /* The family's orbits change only with the canvas size: drawn once to
   * an offscreen layer. */
  if (!data.orbitLayer || data.layerSize !== w) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const layer = document.createElement("canvas");
    layer.width = Math.round(w * ratio);
    layer.height = Math.round(w * ratio);
    const lc = layer.getContext("2d");
    lc.setTransform(ratio, 0, 0, ratio, 0, 0);
    lc.strokeStyle = hexA(colour, data.rows.length > 200 ? 0.12 : 0.32);
    lc.lineWidth = 1;
    data.rows.forEach((p) => {
      lc.beginPath();
      for (let k = 0; k <= 72; k += 1) {
        const E = (k / 72) * TAU;
        /* Through the eccentric anomaly: even spacing along the ellipse. */
        const M = E - p.e * Math.sin(E);
        placeOnOrbit(p.node, p.arg, p.inc, p.e, p.a, M, point);
        const [x, y] = toXY(point.x, point.y);
        if (k === 0) lc.moveTo(x, y); else lc.lineTo(x, y);
      }
      lc.stroke();
    });
    data.orbitLayer = layer;
    data.layerSize = w;
  }
  ctx.drawImage(data.orbitLayer, 0, 0, w, w);
  /* The inner planets' orbits, Earth's in its own blue and thicker. */
  ["Mercury", "Venus", "Earth", "Mars", ...(frameAU > 4 ? ["Jupiter"] : [])].forEach((name) => {
    const r = PLANETS[name].a * scale;
    if (r > w * 0.62) return;
    ring(ctx, cx, cy, r, name === "Earth" ? "rgba(79,134,198,0.95)" : "rgba(200,215,235,0.22)", null, name === "Earth" ? 1.6 : 1);
  });
  drawSun(ctx, cx, cy, 6);
  const jd = NOW_JD + t * (lapDays / 12);
  ["Venus", "Earth", "Mars"].forEach((name) => {
    planetAt(name, jd, point);
    const [x, y] = toXY(point.x, point.y);
    dot(ctx, x, y, name === "Earth" ? 4 : 3, PLANETS[name].colour);
    tag(ctx, name, x, y - 11, { colour: "rgba(230,236,246,0.8)" });
  });
  /* The drawn rocks: their own orbit brighter, a white dot, a name. */
  data.drawn.forEach(({ name, p }) => {
    ctx.strokeStyle = hexA(colour, 0.85);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let k = 0; k <= 96; k += 1) {
      const E = (k / 96) * TAU;
      placeOnOrbit(p.node, p.arg, p.inc, p.e, p.a, E - p.e * Math.sin(E), point);
      const [x, y] = toXY(point.x, point.y);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    rowAt(p, jd, point);
    const [x, y] = toXY(point.x, point.y);
    dot(ctx, x, y, 3.2, "#ffffff");
    tag(ctx, name, x, y - 10, { colour: "rgba(255,255,255,0.92)" });
  });
  tag(ctx, `${data.rows.length} ${family}s over ~1 km · 0-${frameAU} AU, to scale`, w / 2, w - 10, { colour: "rgba(200,212,228,0.7)" });
}

function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* A member row, with its type and fact. */
const member = (name, note, swatch) => ({ name, note, swatch });

/* ------------------------------------------------------------- Atiras */

const atira = familyTopic({
  key: "nea-atira",
  family: "Atira",
  title: "The Atiras",
  eyebrow: "Near-Earth family · wholly inside Earth's orbit",
  count: "38 known (JPL Small-Body Database, 10 October 2026) · rare, because they are only ever seen in twilight · all in the scene: 3 detailed, the rest as rocks you meet near their orbits",
  rows: ATIRA_ELEMENTS,
  colour: "#ffbf86",
  frameAU: 1.25,
  lapDays: 365,
  portraits: ["Atira", "ʼAylóʼchaxnim", "2021 PH27"],
  orbitNames: ["Atira", "ʼAylóʼchaxnim", "2021 PH27"],
  rule: "Atiras never come out as far as Earth: their farthest point is inside 0.983 AU, Earth's closest.",
  composition: [
    { label: "Rock", level: "probably", text: "Almost none has been measured: an Atira is only ever seen low in a twilight sky, close to the Sun, where spectra are hard to take. They come from the same main belt as the others, so most are probably stony." },
    { label: "Metals", level: "unknown", text: "Not measured for any of the three drawn here." },
    { label: "Water & clays", level: "baked out", text: "2021 PH27 reaches about 500 °C at its closest to the Sun. Clay minerals lose the water locked in them well below that, so a rock on that orbit is baked dry at the surface." },
    { label: "Organics", level: "unlikely", text: "Organic compounds at the surface are broken down by that heat and by unfiltered sunlight." },
    { label: "Volatile gases", level: "none", text: "No ice or frozen gas can survive this close to the Sun." },
  ],
  steps: [
    { title: "Inside our orbit", text: "Atiras go round the Sun entirely inside Earth's orbit. The first known, Atira itself, was found in 2003.", svg: svgOrbitRule(17, 0.32, "#ffbf86") },
    { title: "Hidden in the glare", text: "From Earth they are always near the Sun in the sky, so they can only be searched for in twilight. That — not rarity in space — is why so few are known.", svg: `${SVG_HEAD}${svgSun(60, 74, 9)}<rect x="0" y="80" width="120" height="40" fill="#1a1d28"/>${svgText(60, 36, "only at dusk or dawn", "#ffbf86", 8)}</svg>` },
    { title: "Baked", text: "Close to the Sun, a surface is scorched and darkened by heat and by the solar wind. 2021 PH27 reaches about 500 °C.", svg: `${SVG_HEAD}${svgSun(30, 60, 12)}<circle cx="86" cy="60" r="13" fill="#5b4a3e"/><circle cx="82" cy="57" r="13" fill="#8a6a50" opacity="0.6"/></svg>` },
  ],
  members: [
    member("Atira", "The namesake — a binary: a 4.9 km rock with a 0.8 km moon", "#ffbf86"),
    member("ʼAylóʼchaxnim", "The first found wholly inside Venus's orbit (2020)", "#ffbf86"),
    member("2021 PH27", "The smallest orbit of any known asteroid: 113 days, closer than Mercury", "#ffbf86"),
  ],
  source: "Orbits: JPL SBDB, every known Atira, 8 October 2026; count 10 October 2026. Atira's moon: Deleon et al. 2024. 2021 PH27: Sheppard et al. 2022.",
});

/* -------------------------------------------------------------- Atens */

const aten = familyTopic({
  key: "nea-aten",
  family: "Aten",
  title: "The Atens",
  eyebrow: "Near-Earth family · crosses Earth's orbit from inside",
  count: "3,472 known (JPL Small-Body Database, 10 October 2026) · about 30 of them over ~1 km · all in the scene: 6 detailed, the rest as rocks you meet near their orbits",
  rows: ATEN_ELEMENTS,
  colour: "#ffe08a",
  frameAU: 1.7,
  lapDays: 365,
  portraits: ["Apophis", "Aten", "Ra-Shalom", "Hathor", "Moshup"],
  orbitNames: ["Aten", "Ra-Shalom", "Hathor", "Apophis", "Cruithne", "Moshup"],
  rule: "Atens go round the Sun in less than a year and reach out past Earth's orbit (farther than 0.983 AU).",
  composition: [
    { label: "Rock", level: "plenty", text: "Most are stony: olivine and pyroxene, the minerals of ordinary-chondrite meteorites. Apophis, Aten and Hathor are S or Sq types." },
    { label: "Metals", level: "some", text: "Stony types carry grains of iron-nickel metal through the rock, a few to about twenty per cent — as the Itokawa samples did." },
    { label: "Water & clays", level: "in the dark ones", text: "Dark C-types such as Ra-Shalom are carbon-bearing; whether its clays still hold water has not been measured." },
    { label: "Organics", level: "in the dark ones", text: "Carbon-rich types carry organic compounds, as the Bennu samples show. None has been measured on an Aten." },
    { label: "Volatile gases", level: "none known", text: "No Aten has shown any gas." },
  ],
  steps: [
    { title: "A year shorter than ours", text: "Atens' orbits are smaller than Earth's — they go round in less than a year — but stretched enough to cross out past it. Aten itself was found in 1976.", svg: svgOrbitRule(22, 0.4, "#ffe08a") },
    { title: "Small and quick", text: "Most known Atens are small — a few hundred metres — and many spin fast. Hathor turns in 3.4 hours.", svg: `${SVG_HEAD}<circle cx="60" cy="60" r="16" fill="#8f8a80"/><path d="M38 34 A32 32 0 0 1 90 40" fill="none" stroke="#ffe08a" stroke-width="2"/></svg>` },
    { title: "Earth's neighbours", text: "Apophis, which passes Earth on 13 April 2029, and Cruithne, Earth's horseshoe companion, are both Atens.", svg: `${SVG_HEAD}${svgSun()}${svgRing(36, "rgba(79,134,198,0.9)")}<circle cx="96" cy="60" r="4" fill="#4f86c6"/><circle cx="90" cy="48" r="2.5" fill="#ffe08a"/></svg>` },
  ],
  members: [
    member("Apophis", "Passes 32,000 km above Earth on 13 April 2029", "#ffe08a"),
    member("Aten", "The namesake (1976): the first asteroid known with a year shorter than ours", "#ffe08a"),
    member("Cruithne", "Earth's horseshoe companion", "#ffe08a"),
    member("Moshup", "A spinning top with a moon", "#ffe08a"),
    member("Ra-Shalom", "Dark, carbon-rich, 2.3 km", "#ffe08a"),
    member("Hathor", "300 m, fast and stony", "#ffe08a"),
  ],
  source: `Orbits: JPL SBDB, every Aten with H < 17.75, 8 October 2026; count 10 October 2026. ${SAMPLES}`,
});

/* ------------------------------------------------------------ Apollos */

const apollo = familyTopic({
  key: "nea-apollo",
  family: "Apollo",
  title: "The Apollos",
  eyebrow: "Near-Earth family · crosses Earth's orbit from outside",
  count: "24,249 known (JPL Small-Body Database, 10 October 2026) — the largest family · 427 over ~1 km · in the scene: 16 detailed, 20,000 more as rocks you meet near their orbits",
  rows: APOLLO_ELEMENTS,
  colour: "#9ff0b8",
  frameAU: 3.2,
  lapDays: 600,
  portraits: ["Bennu", "Itokawa", "Apollo", "Castalia", "Nereus", "Toutatis"],
  orbitNames: ["Apollo", "Icarus", "Bennu", "Itokawa", "Phaethon", "Toro"],
  rule: "Apollos have orbits bigger than Earth's and dip inside it (closest point within 1.017 AU). Shapes vary — potatoes, spinning tops, two lobes stuck together — and about one in six is a binary.",
  composition: [
    { label: "Rock", level: "plenty", text: "Most are stony S and Q types: olivine and pyroxene. Grains brought back from Itokawa matched LL ordinary-chondrite meteorites exactly." },
    { label: "Metals", level: "some", text: "Iron-nickel grains run through the stony ones; the bright E-types, Nereus and Eger, are made of enstatite, almost free of iron." },
    { label: "Water & clays", level: "in the dark ones", text: "Bennu and Ryugu are mostly clay minerals with water locked inside them — not ice. Even stony Itokawa's dust holds traces of water, made by the solar wind." },
    { label: "Organics", level: "in the dark ones", text: "Bennu's samples carry 14 of the 20 amino acids life uses and all five nucleobases of DNA and RNA, plus salts left by evaporated brine." },
    { label: "Volatile gases", level: "trace", text: "Phaethon, parent of the Geminid meteors, lets off sodium gas at its closest to the Sun, where its surface passes 700 °C." },
  ],
  steps: [
    { title: "Bigger orbit, dips inside ours", text: "Apollos' orbits are larger than Earth's, but stretched so that their closest point to the Sun is inside Earth's orbit. Apollo itself was found in 1932.", svg: svgOrbitRule(34, 0.55, "#9ff0b8") },
    { title: "Every shape", text: "Radar and spacecraft have shown potatoes (Itokawa), spinning tops with a ridge (Bennu, Ryugu), and two lobes resting together (Castalia, Toutatis).", svg: `${SVG_HEAD}<ellipse cx="30" cy="60" rx="18" ry="11" fill="#8a8a82"/><path d="M60 50 L75 60 L60 70 L45 60 Z" fill="#555"/><circle cx="92" cy="58" r="8" fill="#7c7a76"/><circle cx="104" cy="62" r="7" fill="#7c7a76"/></svg>` },
    { title: "One in six has a moon", text: "About one in six near-Earth asteroids over 200 m is a binary — usually a fast top that has flung off rubble from its equator. Didymos, Apollo and 1989 JA are three.", svg: `${SVG_HEAD}<circle cx="54" cy="60" r="16" fill="#8a8a82"/><ellipse cx="54" cy="60" rx="40" ry="12" fill="none" stroke="#9ff0b8" stroke-dasharray="3 3"/><circle cx="94" cy="60" r="4" fill="#8a8a82"/></svg>` },
  ],
  members: [
    member("Bennu", "C-type rubble pile; samples returned 2023", "#9ff0b8"),
    member("Ryugu", "C-type spinning top; samples returned 2020", "#9ff0b8"),
    member("Itokawa", "S-type, two lobes; the first rock sampled", "#9ff0b8"),
    member("Apollo", "The namesake (1932) — with a moon", "#9ff0b8"),
    member("Didymos", "With Dimorphos, which DART struck in 2022", "#9ff0b8"),
    member("1989 JA", "A fast top with a moon (radar, 2022)", "#9ff0b8"),
    member("Castalia", "The first asteroid imaged by radar: two lobes", "#9ff0b8"),
    member("Toutatis", "Tumbling, two-lobed", "#9ff0b8"),
    member("Phaethon", "Parent of the Geminids; lets off sodium", "#9ff0b8"),
    member("Icarus", "Closer to the Sun than Mercury", "#9ff0b8"),
    member("Nereus", "Bright enstatite, 330 m", "#9ff0b8"),
    member("Eger", "Bright enstatite; where aubrite meteorites come from", "#9ff0b8"),
    member("Toro", "In step with Earth and Venus", "#9ff0b8"),
    member("Daedalus", "Stony, 3.7 km", "#9ff0b8"),
    member("Geographos", "Extremely elongated", "#9ff0b8"),
    member("Kamoʻoalewa", "Earth's quasi-satellite; Tianwen-2's target", "#9ff0b8"),
  ],
  source: `Orbits: JPL SBDB, every Apollo with H < 17.75, 8 October 2026; count 10 October 2026. Binaries: Margot et al. 2002, Pravec et al. 2006. ${SAMPLES} Phaethon's sodium: Zhang et al. 2023.`,
});

/* -------------------------------------------------------------- Amors */

const amor = familyTopic({
  key: "nea-amor",
  family: "Amor",
  title: "The Amors",
  eyebrow: "Near-Earth family · come near Earth's orbit, never cross it",
  count: "14,889 known (JPL Small-Body Database, 10 October 2026) · 396 over ~1 km · all in the scene: 7 detailed, the rest as rocks you meet near their orbits",
  rows: AMOR_ELEMENTS,
  colour: "#8ad6ff",
  frameAU: 4.4,
  lapDays: 900,
  portraits: ["Ganymed", "Eros", "Don Quixote", "Florence", "1986 DA"],
  orbitNames: ["Eros", "Ganymed", "Don Quixote", "Florence", "1986 DA"],
  rule: "Amors come inside Mars's orbit and close to Earth's (closest point 1.017-1.3 AU) but never cross it. The largest near-Earth asteroids are Amors, and their surfaces are crater-scarred.",
  composition: [
    { label: "Rock", level: "plenty", text: "Most are stony S types. NEAR, which orbited Eros for a year, measured its rock as ordinary chondrite from the X-rays and gamma rays it gave off." },
    { label: "Metals", level: "in some, a lot", text: "1986 DA is about 85% iron-nickel — a piece of the metal core of a body that melted early in the Solar System's history." },
    { label: "Water & clays", level: "in the dark ones", text: "Dark C-types such as Betulia are carbon-bearing; Don Quixote, a dark D-type, probably holds ice under its crust." },
    { label: "Organics", level: "in the dark ones", text: "D-types like Don Quixote are among the reddest, darkest surfaces known, coloured by organic compounds." },
    { label: "Volatile gases", level: "one, a lot", text: "In 2009 the Spitzer Space Telescope saw a coma of carbon dioxide round Don Quixote: it is a sleeping comet." },
  ],
  steps: [
    { title: "Near, never crossing", text: "An Amor's closest point to the Sun is just outside Earth's orbit — between 1.017 and 1.3 AU — so it can come near us but never cross our path. Many cross Mars's.", svg: svgOrbitRule(40, 0.3, "#8ad6ff") },
    { title: "The big ones", text: "The largest near-Earth asteroids are Amors: Ganymed (38 km), Eros (17 km) and Don Quixote (19 km). Old surfaces, crater on crater.", svg: `${SVG_HEAD}<ellipse cx="60" cy="60" rx="38" ry="26" fill="#7d776c"/><circle cx="48" cy="54" r="8" fill="#5f5a52"/><circle cx="74" cy="66" r="5" fill="#5f5a52"/><circle cx="66" cy="48" r="3" fill="#5f5a52"/></svg>` },
    { title: "Metal and comets too", text: "Among them: 1986 DA, a mountain of iron-nickel, and Don Quixote, a comet nucleus in an asteroid's orbit.", svg: `${SVG_HEAD}<circle cx="38" cy="60" r="14" fill="#9a9a9e"/><circle cx="84" cy="60" r="12" fill="#2a2420"/><path d="M96 60 L118 54 L118 66 Z" fill="rgba(160,200,255,0.4)"/></svg>` },
  ],
  members: [
    member("Ganymed", "The largest near-Earth asteroid: 38 km", "#8ad6ff"),
    member("Eros", "17 km; NEAR orbited and landed on it", "#8ad6ff"),
    member("Don Quixote", "A sleeping comet: a CO₂ coma seen in 2009", "#8ad6ff"),
    member("Florence", "A triple: two moons (2017)", "#8ad6ff"),
    member("1986 DA", "About 85% iron-nickel", "#8ad6ff"),
    member("Ivar", "Long, with a waist", "#8ad6ff"),
    member("Betulia", "Dark, carbon-rich, tilted 52°", "#8ad6ff"),
  ],
  source: "Orbits: JPL SBDB, every Amor with H < 17.75, 8 October 2026; count 10 October 2026. Eros: Trombka et al. 2000. 1986 DA: Sanchez et al. 2021. Don Quixote: Mommert et al. 2014.",
});

export const NEAR_EARTH_TOPICS = Object.freeze({
  "nea-atira": atira,
  "nea-aten": aten,
  "nea-apollo": apollo,
  "nea-amor": amor,
});

import { SMALL_BODIES } from "../scene/smallBodies/smallBodyCatalogue.js";
import { MAIN_BELT_WORLDS } from "../scene/smallBodies/mainBeltCatalogue.js";
import { CENTAURS } from "../scene/smallBodies/centaurCatalogue.js";
import { TRANS_NEPTUNIAN_WORLDS } from "../scene/smallBodies/tnoCatalogue.js";
import { KUIPER_BINARIES } from "../scene/smallBodies/binaryCatalogue.js";
import { COMETS } from "../scene/smallBodies/cometCatalogue.js";
import { JUPITER_TROJANS } from "../scene/smallBodies/trojanCatalogue.js";
import { NEAR_EARTH_ODDITIES } from "../scene/smallBodies/neoCatalogue.js";
import { PLANET_CONFIGS, TRANS_NEPTUNIAN_NAMES } from "../planets/index.js";
import { TRANS_NEPTUNIAN_MOON_COUNTS } from "../planets/satellites/transNeptunianMoonCatalog.js";
import { BELT_MAJOR_ROCKS } from "../scene/beltMajorOrbitGuides.js";
import { hasIcyRingSystem } from "../planets/icyRings.js";

/**
 * Every rock you can actually go to, listed inside an asteroid's dossier.
 *
 * ## Third version: sorted, badged, searchable, and complete
 *
 * The first version named one example per spectral class. The second listed
 * every named rock, but as one flat run of about forty cards, and it had two
 * gaps. Both were reported:
 *
 *   - "people don't know which has rings or which has moons, they don't know
 *     what Centaurs are" -- the group was printed on each card in small
 *     capitals, so there was no heading to explain it, and nothing on a card
 *     said it had a moon or a ring.
 *   - "when I jump to a different asteroid I feel something gets missed" --
 *     and it did. The rock you were reading about was removed from its own
 *     list, and so were Ceres, Vesta and Psyche, which appeared only as class
 *     examples at the top. Jump from Ida to Eros and Ida vanished; jump to
 *     Ceres and the whole C-type row lost its button. None of the moons were
 *     listed at all, which is why Dactyl was unreachable from Dimorphos.
 *
 * So the roster is now one object that every asteroid dossier receives in
 * full, built once from the catalogues:
 *
 *   - **groups with headings and a one-line explanation** of the term --
 *     what a Centaur is, what "near-Earth" means;
 *   - **every body in every dossier**, the current one included and marked
 *     "You are here" rather than removed, so the list is the same list
 *     wherever you open it;
 *   - **moons directly under their parent**, each a button, so every moon
 *     in the scene is one press away;
 *   - **badges** for rings, moons and activity, and **filters** on the same
 *     three, because "which ones have moons" is a question, not a scroll;
 *   - a **search string** per row, which the panel's search box matches.
 *
 * ## Where the entries come from
 *
 * Nothing is copied: the five belt majors from `BELT_MAJOR_ROCKS` (they are
 * built inside the frozen `asteroidBelt.js`, and the orbit-guide table is
 * the one place outside it that names them); every other body and every moon
 * from `SMALL_BODIES`, `MAIN_BELT_WORLDS` and `CENTAURS`; rings from the
 * ring table itself via `hasIcyRingSystem`. Only the one-line prose and the
 * group explanations are written here.
 */

const SPECTRAL_CLASSES = Object.freeze([
  {
    code: "C",
    title: "C-type · carbonaceous",
    representative: "Ceres",
    // Shares: the standard taxonomic split of the known population, as the
    // previous version of this roster quoted it.
    share: "About 75% of known asteroids",
    note: "Darker than fresh asphalt -- they reflect three to nine per cent of the light that hits them -- and rich in carbon, clays and water-bearing minerals. They dominate the outer belt, and they are the closest thing left to the material the Solar System condensed out of.",
    motion: "Example: Ceres, the largest of them and a dwarf planet in its own right",
  },
  {
    code: "S",
    title: "S-type · silicaceous",
    representative: "Vesta",
    share: "About 17% of known asteroids",
    note: "Stony, made of iron- and magnesium-bearing silicates with metal mixed through, and markedly brighter than the C-types at ten to twenty-two per cent reflectance. They cluster in the inner belt, where the young Sun cooked the volatiles out of them.",
    motion: "Example: Vesta, a differentiated protoplanet with a basaltic crust",
  },
  {
    code: "M",
    title: "M-type · metallic",
    representative: "Psyche",
    share: "Under 10% of known asteroids",
    note: "Mostly nickel-iron, and the leading explanation is that they are the exposed cores of bodies whose rocky mantles were blasted away in collisions. Radar reflects off them far more strongly than off anything stony, which is how they are told apart from a distance.",
    motion: "Example: Psyche, which NASA's Psyche mission reaches in 2029",
  },
]);

/* One line each, for the rocks whose own catalogues hold measurements rather
 * than prose. Keyed by the exact name the scene travels to. */
const CHARACTER_LINES = Object.freeze({
  Ida: "The first asteroid found to have a moon of its own: Galileo photographed Dactyl beside it in 1993, and nobody had expected a body this small to hold one.",
  Mathilde: "Enormous craters for its size -- one of them is as wide as the asteroid's own radius -- which it survived because it is barely held together. Half of it is empty space.",
  Lutetia: "The largest asteroid visited before Dawn, and stubbornly hard to classify: it reflects like metal and cratered like stone. Rosetta passed it on the way to a comet.",
  Gaspra: "The first asteroid ever seen close up, by Galileo in 1991. Its sharp, unsoftened facets say it is a collision fragment rather than a body that formed this way.",
  Eros: "The first asteroid orbited and the first landed on. NEAR Shoemaker spent a year around it in 2000 and then set down on it, which it had not been built to do.",
  Itokawa: "Not a rock but a rubble pile -- two lumps of loose gravel resting against each other under their own faint gravity. Hayabusa brought grains of it home in 2010.",
  Bennu: "Chosen for sample return because it is dark, carbon-rich and close. OSIRIS-REx found the surface so loosely packed that its sampling arm sank straight into it.",
  Ryugu: "A spinning top of carbonaceous rubble. Hayabusa2 returned 5.4 grams of it in 2020, and the amino acids found in those grains are the point of the whole mission.",
  Didymos: "A binary: a fast-spinning primary with the small moon Dimorphos around it, which DART deliberately hit in 2022 and measurably slowed. The first time anyone moved a world.",
  Apophis: "Briefly the most alarming object in the sky. It is now known to miss -- but on 13 April 2029 it passes inside the geostationary satellites, closer than some of our own hardware.",
  "67P/Churyumov–Gerasimenko": "Two lobes welded at a neck, orbited for two years by Rosetta and landed on by Philae. The best-mapped comet nucleus there is.",
  "1P/Halley": "The comet everyone means by the word. Giotto flew through its coma in 1986 and found a nucleus darker than coal -- the least reflective object measured in the Solar System.",
  Arrokoth: "The most distant object ever visited, a billion kilometres past Pluto. Two flattened lobes touching gently, unaltered since the Solar System formed.",
  Chariklo: "The first object that is not a planet ever found to have rings, and still the clearest case. Two of them, 14 km apart, found in 2013 when a star winked twice on the way in and twice on the way out.",
  Chiron: "Carries an asteroid number and a comet designation both, and appears to be growing rings while we watch — the material around it is not the same from one occultation to the next.",
  Pholus: "The reddest object anyone has measured. Billions of years of cosmic rays on organic ice, never resurfaced, never warmed.",
  Echeclus: "Outbursts hard enough to throw a piece of itself away — one fragment outgassed brighter than the nucleus it left. Its occultation looked for rings and found none.",
  // Rank 4, batch A. One line each; the dossier has the rest.
  "Máni": "A crater 322 km wide and 45 km deep on a world 796 km across, caught on its limb by sixty-one occultation chords in 2020.",
  Chiminigagua: "The ninth-brightest world past Neptune, on a scattered orbit tilted 33 degrees, with a moon found by Hubble in 2018.",
  Achlys: "A plutino spun into a flattened, stretched shape by a 6.8-hour day — and a dip in its outline that may be a chasm.",
  Aya: "768 km across and no moon at all — a useful control case for how the others got theirs.",
  Uni: "Less dense than water at 692 km across, which the usual story of how big worlds form cannot explain.",
  "Gǃkúnǁʼhòmdímà": "Occultation-measured, weighed by its moon, and the hardest name in the Solar System to say correctly.",
  Huya: "A plutino whose moon is more than half its width — very nearly a double world.",
  Goibniu: "Dark, and spinning once every 5.9 hours on one of the roundest orbits out here.",
  Ritona: "Carbon dioxide ice seen by JWST, on the most nearly circular orbit of the fourteen.",
  Xewioso: "The darkest of the set, reflecting under four per cent of its light. Almost nothing else is known.",
  Rumina: "Grey rather than red, covered in fresh water ice, on an orbit reaching out to 149 AU.",
  DeeDee: "Formally 2014 UZ224. Still unnamed, and its orbit reaches 181 AU — the scattered disc's true size.",
  Chaos: "Found in 1998, and possibly two bodies resting against each other, seen from the pole.",
  "Leleākūhonua": "The third Sedna-like world ever found: it never comes closer than 65 AU and swings out to about 2,000.",
  // DART, 26 September 2022: the orbit shortened by about 33 minutes
  // (Thomas et al. 2023, Nature 616, 448).
  Dimorphos: "The moon DART flew into on 26 September 2022. The impact shortened its orbit around Didymos by about 33 minutes -- the first measured change to a natural body's motion made by people.",
  Dactyl: "The first moon ever found around an asteroid, in Galileo images from its 1993 pass of Ida. About a kilometre and a half across.",
});

/*
 * The groups, in the order a viewer travelling outward meets them, each with
 * the one sentence that explains its name. Ranges:
 *   - main belt 2.1-3.3 AU: between the 4:1 and 2:1 Kirkwood gaps with
 *     Jupiter, the conventional inner and outer edges;
 *   - near-Earth: perihelion under 1.3 AU, the CNEOS definition;
 *   - Centaur lifetimes of a few million years: Horner, Evans & Bailey
 *     2004, MNRAS 354, 798;
 *   - Ceres's share of the belt's mass: 9.38e20 kg of about 2.39e21 kg
 *     (Park et al. 2016; Pitjeva & Pitjev 2018), roughly two-fifths.
 */
const GROUP_DEFS = Object.freeze([
  {
    key: "classes",
    title: "Three kinds of rock",
    blurb: "Asteroids are sorted by what their surfaces reflect. The letter is the class; each card flies you to the clearest example of it.",
  },
  {
    key: "giants",
    title: "Giants of the main belt",
    blurb: "The five largest bodies between Mars and Jupiter. Ceres alone holds roughly two-fifths of the whole belt's mass.",
  },
  {
    key: "belt",
    title: "Main belt · modelled one by one",
    blurb: "Between Mars and Jupiter, 2.1 to 3.3 AU from the Sun. These have measured shapes; the rest of the belt you see is a statistical population.",
  },
  {
    key: "trojan",
    title: "Jupiter's Trojans & Hildas",
    blurb: "Sharing Jupiter's orbit 60° ahead of it and behind (more than 11,000 known), or locked to it three orbits for two. Lucy is visiting the Trojans from 2027.",
  },
  {
    key: "nearEarth",
    title: "Near-Earth asteroids",
    blurb: "Orbits that come within 1.3 AU of the Sun, so they cross or skirt Earth's path. The closest to reach -- and the ones spacecraft have brought samples home from.",
  },
  {
    key: "centaur",
    title: "Centaurs",
    blurb: "Icy bodies orbiting between Jupiter and Neptune, half asteroid and half comet, on paths that stay stable for only a few million years. Two of these four have rings.",
  },
  {
    key: "tno",
    title: "Kuiper Belt and beyond",
    blurb: "Past Neptune, from 30 AU out to the inner Oort Cloud: ice worlds hundreds of kilometres across. Outside the Pluto system and Arrokoth, not one of them has ever been seen as more than a point of light.",
  },
  {
    key: "other",
    title: "Comets",
    blurb: "Not asteroids -- ice more than rock, and the ones that grow a tail when they come in close. With them, the three objects known to have come from other stars.",
  },
]);

export const ASTEROID_ROSTER_FILTERS = Object.freeze([
  { key: "all", label: "All" },
  { key: "moons", label: "Have moons" },
  { key: "rings", label: "Have rings" },
  { key: "moon", label: "Are moons" },
  { key: "active", label: "Active" },
]);

const CENTAUR = /centaur/i;
const NEAR_EARTH = /near-earth/i;
const BEYOND_NEPTUNE = /trans-neptunian|sednoid|kuiper/i;
const NOT_AN_ASTEROID = /comet|interstellar/i;
const JUPITER_COMPANY = /jupiter trojan|hilda/i;
const ACTIVE = /comet|coma|outburst/i;

/*
 * Centaurs are tested before the comet rule, and that ordering is the whole
 * point of having a group for them. Chiron and Echeclus both carry comet
 * designations -- 95P and 174P -- so the comet rule would file them under
 * "not an asteroid" and split the four apart.
 */
function groupFor(record) {
  const text = `${record?.classification ?? ""} ${record?.info?.population ?? ""}`;
  if (CENTAUR.test(text)) return "centaur";
  // Comets before the Kuiper rule: 67P's card says where it came from, and
  // "Kuiper Belt" in its population line would otherwise file a comet
  // nucleus at 1.2 AU among the worlds past Neptune.
  if (NOT_AN_ASTEROID.test(text)) return "other";
  if (BEYOND_NEPTUNE.test(text)) return "tno";
  if (JUPITER_COMPANY.test(text)) return "trojan";
  if (NEAR_EARTH.test(text)) return "nearEarth";
  return "belt";
}

function sizeText(diameterKm) {
  const d = Number(diameterKm);
  if (!Number.isFinite(d) || d <= 0) return null;
  if (d < 1) return `${Math.round(d * 1000)} m across`;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} km across`;
}

function distanceText(km) {
  const d = Number(km);
  if (!Number.isFinite(d) || d <= 0) return null;
  if (d < 10) return `${d.toFixed(2)} km`;
  return `${Math.round(d).toLocaleString("en-GB")} km`;
}

/* The same two spellings the scene builder accepts, sorted outward. */
function satellitesOf(record) {
  const list = Array.isArray(record?.moons)
    ? record.moons.filter(Boolean)
    : (record?.moon ? [record.moon] : []);
  return [...list].sort((a, b) => (a.separationKm ?? 0) - (b.separationKm ?? 0));
}

function searchText(...parts) {
  return parts.flat().filter(Boolean).join(" ").toLowerCase();
}

function rowFor(record, groupKey) {
  const moons = satellitesOf(record);
  const rings = hasIcyRingSystem(record.name);
  const text = `${record.classification ?? ""} ${record.info?.population ?? ""}`;
  const active = Boolean(record.coma) || (groupKey === "other" && ACTIVE.test(text));
  const badges = [];
  const tags = [];
  if (rings) { badges.push({ key: "rings", text: "Rings" }); tags.push("rings"); }
  if (moons.length) {
    badges.push({ key: "moons", text: moons.length === 1 ? "1 moon" : `${moons.length} moons` });
    tags.push("moons");
  }
  if (active) { badges.push({ key: "active", text: record.coma ? "Active · coma" : "Comet" }); tags.push("active"); }

  const row = {
    body: record.name,
    order: record.designation ?? null,
    character: record.classification ?? record.info?.population ?? null,
    note: CHARACTER_LINES[record.name] ?? null,
    motion: [sizeText(record.diameterKm), record.detail?.split("|")?.[1]?.trim()]
      .filter(Boolean).join(" · ") || null,
    badges,
    tags,
    isMoon: false,
    parent: null,
    size: Number(record.diameterKm) || 0,
  };
  row.search = searchText(row.body, row.order, row.character, row.note,
    badges.map((b) => b.text), moons.map((m) => m.name));

  const moonRows = moons.map((moon) => {
    const moonRow = {
      body: moon.name,
      order: moon.designation ?? null,
      character: moon.classification ?? "Natural satellite",
      note: CHARACTER_LINES[moon.name] ?? null,
      motion: [
        sizeText(moon.diameterKm),
        moon.separationKm ? `orbits ${record.name} at ${distanceText(moon.separationKm)}` : null,
      ].filter(Boolean).join(" · ") || null,
      badges: [{ key: "moon", text: `Moon of ${record.name}` }],
      tags: ["moon"],
      isMoon: true,
      parent: record.name,
      size: Number(moon.diameterKm) || 0,
    };
    moonRow.search = searchText(moonRow.body, moonRow.order, moonRow.character,
      moonRow.note, "moon satellite", record.name);
    return moonRow;
  });

  return [row, ...moonRows];
}

function buildGroups() {
  const buckets = Object.fromEntries(GROUP_DEFS.map((g) => [g.key, []]));

  buckets.classes = SPECTRAL_CLASSES.map((entry) => ({
    body: entry.representative,
    order: `${entry.code} · ${entry.share}`,
    character: entry.title,
    note: entry.note,
    motion: entry.motion,
    badges: [],
    tags: [],
    isMoon: false,
    parent: null,
    classCode: entry.code,
    search: searchText(entry.code, entry.title, entry.representative, entry.note, "class type"),
  }));

  buckets.giants = BELT_MAJOR_ROCKS.map(({ name, summary }) => {
    const cls = SPECTRAL_CLASSES.find((entry) => entry.representative === name);
    const badges = cls ? [{ key: "class", text: `${cls.code}-type example` }] : [];
    return {
      body: name,
      order: null,
      character: summary,
      note: null,
      motion: null,
      badges,
      tags: [],
      isMoon: false,
      parent: null,
      search: searchText(name, summary, badges.map((b) => b.text), "main belt giant"),
    };
  });

  /* Largest first within each group, with each parent's moons kept
   * directly beneath it rather than sorted in among the others. */
  const families = { belt: [], trojan: [], nearEarth: [], centaur: [], tno: [], other: [] };
  [
    ...SMALL_BODIES, ...MAIN_BELT_WORLDS, ...CENTAURS, ...TRANS_NEPTUNIAN_WORLDS, ...KUIPER_BINARIES,
    ...COMETS, ...JUPITER_TROJANS, ...NEAR_EARTH_ODDITIES,
  ].forEach((record) => {
    families[groupFor(record)].push(rowFor(record, groupFor(record)));
  });
  /*
   * And the twelve worlds the planet builder draws out there -- Pluto,
   * Eris, Haumea and the rest. They are not in any small-body catalogue, but
   * a list of what is past Neptune without Pluto in it is not a list of what
   * is past Neptune. Their moons are drawn by the satellite system and are
   * reached from their parent, so they are counted rather than listed; Pluto
   * has its own catalogue, and its five are stated here.
   */
  const configs = new Map(PLANET_CONFIGS.map((config) => [config.name, config]));
  TRANS_NEPTUNIAN_NAMES.forEach((name) => {
    const config = configs.get(name);
    if (!config) return;
    const moonCount = name === "Pluto" ? 5 : (TRANS_NEPTUNIAN_MOON_COUNTS[name] ?? 0);
    const rings = hasIcyRingSystem(name);
    const badges = [];
    const tags = [];
    if (rings) { badges.push({ key: "rings", text: "Rings" }); tags.push("rings"); }
    if (moonCount) {
      badges.push({ key: "moons", text: moonCount === 1 ? "1 moon" : `${moonCount} moons` });
      tags.push("moons");
    }
    const type = config.info?.type ?? "Dwarf planet";
    const character = String(config.detail ?? "").split("|")[1]?.trim() || null;
    const diameter = Number(config.physicalDiameterKm);
    const row = {
      body: name,
      order: type,
      character,
      note: null,
      motion: sizeText(diameter),
      badges,
      tags,
      isMoon: false,
      parent: null,
      size: Number.isFinite(diameter) ? diameter : 0,
    };
    row.search = searchText(name, type, character, badges.map((b) => b.text), "dwarf planet");
    families.tno.push([row]);
  });
  Object.entries(families).forEach(([key, list]) => {
    list.sort((a, b) => b[0].size - a[0].size);
    buckets[key] = list.flat();
  });

  return GROUP_DEFS.map((def) => ({ ...def, rows: buckets[def.key] }));
}

let cachedGroups = null;

/**
 * The whole roster, the same for every asteroid dossier, with the body being
 * read about marked in place rather than removed.
 *
 * @param {string} ownName   the rock whose dossier this is
 * @param {string|null} ownClass  its spectral class, if it has one
 */
export function buildAsteroidRoster(ownName = "", ownClass = null) {
  if (!cachedGroups) cachedGroups = buildGroups();
  const name = String(ownName ?? "").trim();
  let bodies = 0;
  let moons = 0;
  let ringed = 0;

  const groups = cachedGroups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => {
      if (group.key !== "classes") {
        if (row.isMoon) moons += 1; else bodies += 1;
        if (row.tags.includes("rings")) ringed += 1;
      }
      const current = row.body === name && group.key !== "classes";
      const classHere = group.key === "classes" && row.classCode === ownClass;
      return {
        ...row,
        current,
        range: current
          ? "You are here"
          : (classHere ? "This one's class" : null),
      };
    }),
  }));

  return Object.freeze({
    kind: "asteroid-roster",
    current: name,
    groups,
    filters: ASTEROID_ROSTER_FILTERS,
    summary: `${bodies} bodies · ${moons} moons · ${ringed} with rings`,
  });
}

/* Two plain words, because it is a question the viewer is already asking
 * with the card open, not a catalogue title. */
export const ASTEROID_ROSTER_LABEL = "Where to next";

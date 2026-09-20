import { SMALL_BODIES } from "../scene/smallBodies/smallBodyCatalogue.js";
import { MAIN_BELT_WORLDS } from "../scene/smallBodies/mainBeltCatalogue.js";
import { BELT_MAJOR_ROCKS } from "../scene/beltMajorOrbitGuides.js";

/**
 * Every rock you can actually go to, listed inside an asteroid's dossier.
 *
 * ## Why this replaced a list of three
 *
 * The first version of this roster named one representative per spectral
 * class -- Ceres, Vesta, Psyche -- which answered "what kinds of asteroid are
 * there" and nothing else. Reported plainly: "in the asteroid description I
 * can only see Ceres Hygenie and Vesta, if and if there are others Ryugu, M
 * class S Class C Class Lutetia etc.. they aren't there".
 *
 * That is the right complaint, because the dossier is the only place in the
 * interface where one rock can hand you another. There are something like a
 * hundred and twenty thousand asteroids drawn in this scene and twenty of
 * them are real, individually modelled objects with published shape models;
 * the other hundred and nineteen thousand-odd are a statistical population.
 * A viewer standing on a nameless C-type has no way to discover that Ryugu
 * exists, let alone reach it. Now every named one is a button.
 *
 * ## Where the entries come from
 *
 * Three sources, none of them a fourth copy of the data:
 *
 *   - the **spectral classes**, which are a property of the population
 *     rather than of any object, so they are written here;
 *   - the **five belt majors**, from `BELT_MAJOR_ROCKS` -- they are built
 *     inside the frozen `asteroidBelt.js` and are invisible to every other
 *     module, so the orbit-guide table that already names them is the source;
 *   - the **thirteen small bodies** and the **eleven large main-belt
 *     worlds**, read live from `SMALL_BODIES` and `MAIN_BELT_WORLDS`,
 *     which is where their classifications and diameters are maintained.
 *
 * Only the one-line characterisations are written here, because nothing else
 * holds prose at this length.
 *
 * ## The last group is not asteroids
 *
 * Two comet nuclei and a Kuiper Belt object are on the list. They are not
 * asteroids and the group they sit in says so. They are here because the
 * question this roster answers is "what else is out here that I can reach",
 * and answering it with a taxonomy that excludes the three most interesting
 * destinations would be pedantry at the viewer's expense.
 */

const SPECTRAL_CLASSES = Object.freeze([
  {
    code: "C",
    title: "C-type · carbonaceous",
    representative: "Ceres",
    share: "About 75% of known asteroids",
    note: "Darker than fresh asphalt -- they reflect three to nine per cent of the light that hits them -- and rich in carbon, clays and water-bearing minerals. They dominate the outer belt, and they are the closest thing left to the material the Solar System condensed out of.",
    motion: "Representative: Ceres, the largest of them and a dwarf planet in its own right",
  },
  {
    code: "S",
    title: "S-type · silicaceous",
    representative: "Vesta",
    share: "About 17% of known asteroids",
    note: "Stony, made of iron- and magnesium-bearing silicates with metal mixed through, and markedly brighter than the C-types at ten to twenty-two per cent reflectance. They cluster in the inner belt, where the young Sun cooked the volatiles out of them.",
    motion: "Representative: Vesta, a differentiated protoplanet with a basaltic crust",
  },
  {
    code: "M",
    title: "M-type · metallic",
    representative: "Psyche",
    share: "Under 10% of known asteroids",
    note: "Mostly nickel-iron, and the leading explanation is that they are the exposed cores of bodies whose rocky mantles were blasted away in collisions. Radar reflects off them far more strongly than off anything stony, which is how they are told apart from a distance.",
    motion: "Representative: Psyche, which NASA's Psyche mission reaches in 2029",
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
});

const GROUPS = Object.freeze({
  belt: "Main belt · individually modelled",
  nearEarth: "Near-Earth · reachable from here",
  other: "Not an asteroid, but you can go there",
});

const NEAR_EARTH = /near-earth/i;
const NOT_AN_ASTEROID = /comet|kuiper/i;

function groupFor(record) {
  const text = `${record?.classification ?? ""} ${record?.info?.population ?? ""}`;
  if (NOT_AN_ASTEROID.test(text)) return GROUPS.other;
  if (NEAR_EARTH.test(text)) return GROUPS.nearEarth;
  return GROUPS.belt;
}

function sizeText(diameterKm) {
  const d = Number(diameterKm);
  if (!Number.isFinite(d) || d <= 0) return null;
  if (d < 1) return `${Math.round(d * 1000)} m across`;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} km across`;
}

/* Belt first, then the near-Earth objects, then the three that are neither.
 * Within a group, largest first -- the order a viewer would guess. */
const GROUP_ORDER = [GROUPS.belt, GROUPS.nearEarth, GROUPS.other];

function buildNamedRocks() {
  const rows = [];

  BELT_MAJOR_ROCKS.forEach(({ name, summary }) => {
    rows.push({
      group: GROUPS.belt,
      name,
      character: summary,
      note: null,
      motion: null,
      size: Number.POSITIVE_INFINITY,
    });
  });

  [...SMALL_BODIES, ...MAIN_BELT_WORLDS].forEach((record) => {
    rows.push({
      group: groupFor(record),
      name: record.name,
      character: record.classification ?? record.info?.population ?? null,
      note: CHARACTER_LINES[record.name] ?? null,
      motion: [sizeText(record.diameterKm), record.detail?.split("|")?.[1]?.trim()]
        .filter(Boolean)
        .join(" · ") || null,
      size: Number(record.diameterKm) || 0,
    });
  });

  return rows.sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    return g !== 0 ? g : b.size - a.size;
  });
}

let cachedRows = null;

/**
 * @param {string} ownName   the rock whose dossier this is, marked in place
 * @param {string|null} ownClass  its spectral class, if it has one
 */
export function buildAsteroidRoster(ownName = "", ownClass = null) {
  if (!cachedRows) cachedRows = buildNamedRocks();
  const name = String(ownName ?? "").trim();

  const classRows = SPECTRAL_CLASSES.map((entry) => ({
    body: entry.representative,
    order: entry.code === ownClass ? `${entry.share} · this one` : entry.share,
    character: entry.title,
    range: entry.representative === name ? "You are here" : null,
    note: entry.note,
    motion: entry.motion,
  }));

  const representatives = new Set(SPECTRAL_CLASSES.map((entry) => entry.representative));
  const namedRows = cachedRows
    // The rock being read about is already on screen and named at the top of
    // the card; offering a button back to it is a dead end.
    .filter((row) => row.name !== name)
    // And the three class representatives are listed once, above, with a
    // reason. Ceres appearing again four rows later under its diameter is
    // the padding this roster was rebuilt to remove.
    .filter((row) => !representatives.has(row.name))
    .map((row) => ({
      body: row.name,
      order: row.group,
      character: row.character,
      range: null,
      note: row.note,
      motion: row.motion,
    }));

  return [...classRows, ...namedRows];
}

export const ASTEROID_ROSTER_LABEL = "The three kinds of rock — and every named one you can travel to";

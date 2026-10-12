/**
 * Every other planet's Trojans, as real bodies.
 *
 * Round 38 (Prompts.md: "every planet's Trojans -- draw each as a real,
 * textured, clickable body ... light them up as groups"). Round 37 drew
 * these twenty-two as points in their planets' co-orbital frames
 * (populationClouds.js); they are now bodies like Hektor and Cruithne,
 * each with its own card, flown to from the board. (They were also lit
 * together as camps; the owner asked for that to go -- second pass -- in
 * favour of every one being listed and clickable on the board's diagram.)
 *
 * Which bodies: `PLANET_TROJANS` in populationCatalogue.js, with its
 * sources -- Venus's one, Earth's two, the seventeen stable Mars Trojans
 * and Uranus's two -- and, from the second pass, Neptune's 42
 * (`NEPTUNE_TROJANS`), none of which has a measured size: theirs are from H
 * at an assumed 5% albedo, like Uranus's.
 *
 * ## What is measured
 *
 * Elements: JPL SBDB query of 8 October 2026 (populationCatalogue.js, four
 * decimals), at JD 2461200.5. Each body rides its planet's co-orbital frame
 * (`coOrbital: { planet, ratio: 1 }`), so it stays at its real angle from
 * the *drawn* planet, as Hektor does from Jupiter.
 *
 * Sizes: only Eureka, 2010 TK7 and 2020 XL5 have measured sizes. Every
 * other size is from the body's absolute magnitude H at an assumed albedo,
 * D = 1329 km / sqrt(p) x 10^(-H/5), and its card says so: p = 0.18 for
 * Mars's L5 Trojans (Eureka's measured albedo -- most of them are thought
 * to be its fragments), 0.20 for the other inner-planet ones, 0.05 for
 * Uranus's and Neptune's (dark outer-system bodies).
 *
 * Rotation: measured for Eureka (2.69 h) and 1999 UJ7 (~50 h); every other
 * one is drawn turning once every 6 hours, and its card says it is not
 * measured. Shapes are chosen, as for every unresolved body in the scene.
 */
import {
  brFromBV,
  chromaFromBR,
  CLASS_CHROMA,
  ellipsoid,
  orbitOf,
  withSpeedNow,
} from "./catalogueHelpers.js";
import { PLANET_TROJANS, NEPTUNE_TROJANS } from "./populationCatalogue.js";

const SOURCE = "JPL SBDB query, 8 October 2026 (populationCatalogue.js), epoch JD 2461200.5";
const sizeFromH = (H, p) => (1329 / Math.sqrt(p)) * 10 ** (-H / 5);
/* Olivine-rich, like Eureka (Polishook et al. 2017): a slightly red,
 * yellowish rock -- B-R 1.30, chosen within A/Sr colours. */
const OLIVINE_CHROMA = chromaFromBR(1.3);
/* Uranus's: dark and red like Centaurs of the red group -- B-R 1.5,
 * chosen; no colour measured. */
const OUTER_CHROMA = chromaFromBR(1.5);

const PLANET_ORBIT_DAYS = { Venus: 224.7, Earth: 365.25, Mars: 687.0, Uranus: 30_687, Neptune: 60_190 };
const OUTER_YEARS = { Uranus: "84 years", Neptune: "165 years" };

/*
 * Round 38, second pass (Prompts.md: "all the listed trojans names should
 * be there ... all those unknowns should be listed down, designed and can
 * be moved"): Neptune's 42 Trojans join as bodies too. Numbered ones are
 * named by their provisional designations where they have no name (JPL
 * SBDB `fullname`, 10 October 2026); Otrera and Clete are the two named.
 */
const NEPTUNE_NAMES = {
  385571: ["Otrera", "(385571) Otrera (2004 UP10)"],
  385695: ["Clete", "(385695) Clete (2005 TO74)"],
  527604: ["2007 VL305", "(527604) 2007 VL305"],
  530664: ["2011 SO277", "(530664) 2011 SO277"],
  530930: ["2011 WG157", "(530930) 2011 WG157"],
  612243: ["2001 QR322", "(612243) 2001 QR322"],
  613490: ["2006 RJ103", "(613490) 2006 RJ103"],
  666739: ["2010 TS191", "(666739) 2010 TS191"],
  780605: ["2012 UD185", "(780605) 2012 UD185"],
};
const NEPTUNE_ROWS = NEPTUNE_TROJANS.map((t) => {
  const [short, designation] = NEPTUNE_NAMES[t.name] ?? [t.name, t.name];
  return { planet: "Neptune", name: designation, short, key: t.name, camp: t.camp, fromPlanetDeg: t.fromNeptuneDeg, el: t.el };
});
const NEPTUNE_FACTS = {
  "2001 QR322": "The first Neptune Trojan ever found, by the Deep Ecliptic Survey in 2001 — proof that Neptune, like Jupiter, keeps bodies at its 60° points.",
  Otrera: "One of only two named Neptune Trojans, called after an Amazon queen — the naming theme for Neptune's Trojans, as Greek and Trojan heroes are for Jupiter's.",
  Clete: "One of only two named Neptune Trojans, called after an Amazon who attended Penthesilea.",
  "2008 LC18": "The first Neptune Trojan found at L5, 60° behind Neptune (Sheppard & Trujillo 2010). The L5 side is in front of the crowded centre of the Milky Way, which is why so few are known there.",
  "2004 KV18": "A loosely held Trojan: today about 100° behind Neptune, far out on its swing, and only a temporary member of the L5 camp (Horner & Lykawka 2012).",
  "2012 UW177": "The most steeply tilted known Neptune Trojan, 54° to the planets' plane.",
  "2013 KY18": "The brightest, and so probably the largest, known Neptune Trojan at L5 — perhaps 260 km across at a 5% albedo.",
};
const CAMP_WORDS = { L4: "60° ahead of", L5: "60° behind" };

/*
 * Per-body facts, where there are any. `D` and `p` measured where cited;
 * otherwise derived from H. `texture` names the shared map
 * (smallBodies.js SMALL_BODY_TEXTURES).
 */
const FACTS = {
  "2013 ND15": {
    short: "2013 ND15",
    p: 0.2,
    chroma: CLASS_CHROMA.S_TYPE,
    texture: "venus-trojan",
    lede: "Venus's only known Trojan, found by Pan-STARRS in July 2013: a rock perhaps 40-100 m across on a stretched orbit (e = 0.61) that swings from inside Mercury's distance out past Earth's, while keeping, on average, 60° ahead of Venus. It is only a temporary Trojan: integrations show it will not stay (de la Fuente Marcos & de la Fuente Marcos 2014).",
  },
  "(614689) 2020 XL5": {
    short: "2020 XL5",
    D: 1.18,
    p: 0.06,
    chroma: CLASS_CHROMA.NEUTRAL,
    texture: "earth-trojan",
    measured: "1.18 ± 0.08 km at albedo 0.06, a C-type (Santana-Ros et al. 2022, Nature Communications 13, 447)",
    lede: "Earth's second known Trojan, found in December 2020 by Pan-STARRS and confirmed in 2022: about 1.2 km across and dark — probably a carbon-rich C-type. It leads Earth by 60° on average but wanders far from the point, and will leave in about 4,000 years (Santana-Ros et al. 2022).",
  },
  "(706765) 2010 TK7": {
    short: "2010 TK7",
    D: 0.379,
    p: 0.059,
    chroma: CLASS_CHROMA.NEUTRAL,
    texture: "earth-trojan",
    measured: "0.379 km at albedo 0.059 (NEOWISE, SBDB)",
    lede: "The first Earth Trojan ever found, by NASA's WISE telescope in 2010 (Connors et al. 2011, Nature 475, 481): a dark rock about 380 m across, 60° ahead of Earth on average. Seen from Earth, it traces a long tadpole-shaped loop around that point over the centuries.",
  },
  "(121514) 1999 UJ7": {
    short: "1999 UJ7",
    p: 0.2,
    chroma: CLASS_CHROMA.NEUTRAL,
    texture: "mars-l4",
    rot: 50,
    rotNote: "About 50 h — a slow rotator",
    lede: "Mars's only long-known Trojan at L4, 60° ahead of Mars, alone on that side for over twenty years until 2023 FW14 joined it. It turns slowly, about once every two days. It does not belong to the Eureka family at L5.",
  },
  "2023 FW14": {
    short: "2023 FW14",
    p: 0.2,
    chroma: CLASS_CHROMA.NEUTRAL,
    texture: "mars-l4",
    lede: "The second Mars Trojan found at L4, in 2023 — about 1999 UJ7's companion on that side of Mars, though far smaller. Its colours resemble 1999 UJ7's (de la Fuente Marcos et al. 2024).",
  },
  Eureka: {
    short: "Eureka",
    D: 1.878,
    p: 0.182,
    chroma: OLIVINE_CHROMA,
    texture: "eureka",
    rot: 2.6902,
    rotNote: "2.69 h (LCDB)",
    measured: "1.878 km, albedo 0.182 (NEOWISE, SBDB)",
    lede: "The first Mars Trojan ever found (1990) and the largest, about 1.9 km, 60° behind Mars. Its spectrum is dominated by olivine — rare among asteroids, common in Mars's mantle — and most of the Trojans around it share both its spectrum and its orbit: a family of fragments, perhaps once a single body knocked off Mars itself (Polishook et al. 2017).",
  },
  "(101429) 1998 VF31": {
    short: "1998 VF31",
    p: 0.2,
    chroma: CLASS_CHROMA.S_TYPE,
    texture: "mars-l5",
    lede: "The second Mars Trojan found (1998), at L5 with Eureka but not one of its family: its orbit is tilted far more (31°) and its spectrum differs from Eureka's (Rivkin et al. 2003).",
  },
  "(311999) 2007 NS2": {
    short: "2007 NS2",
    p: 0.18,
    chroma: OLIVINE_CHROMA,
    texture: "mars-l5",
    lede: "One of the Eureka family at L5, and one of the two whose spectra were measured: olivine-rich, like Eureka (Polishook et al. 2017).",
  },
  "(385250) 2001 DH47": {
    short: "2001 DH47",
    p: 0.18,
    chroma: OLIVINE_CHROMA,
    texture: "mars-l5",
    lede: "One of the Eureka family at L5, and one of the two whose spectra were measured: olivine-rich, like Eureka (Polishook et al. 2017).",
  },
};
const EUREKA_FRAGMENT = "One of the Eureka family, 60° behind Mars: a small rock on almost exactly Eureka's orbit, thought to be a fragment of it — perhaps broken off by sunlight spinning it up (the YORP effect, Ćuk et al. 2015).";

function trojanRecord(row, index) {
  const facts = FACTS[row.name] ?? {};
  const [aAU, e, iDeg, nodeDeg, argPeriDeg, meanAnomalyDeg, H] = row.el;
  const name = facts.short ?? row.short ?? row.name.replace(/^\(\d+\)\s*/, "");
  const outer = row.planet === "Uranus" || row.planet === "Neptune";
  const p = facts.p ?? (outer ? 0.05 : row.planet === "Mars" && row.camp === "L5" ? 0.18 : 0.2);
  const D = facts.D ?? sizeFromH(H, p);
  const derived = !facts.D;
  const rotationHours = facts.rot ?? 6;
  const seed = 7700 + index * 37;
  /* Shapes, chosen: kilometre and smaller rocks elongated, the two
   * 60-100 km Uranus Trojans rounder. */
  const stretch = outer ? [1.12, 1.0, 0.9] : [1.35 + 0.1 * (index % 3), 1.0, 0.8 + 0.05 * (index % 2)];
  const lobes = ellipsoid(D * stretch[0], D * stretch[1], D * stretch[2]);
  const shape = outer
    ? { lobes, neck: 1, relief: 0.035, grain: 0.012, craterCount: 120, craterMin: 0.02, craterMax: 0.18, craterDepth: 0.03, boulders: 0, seed }
    : { lobes, neck: 1, relief: 0.045, grain: 0.02, craterCount: 30, craterMin: 0.04, craterMax: 0.2, craterDepth: 0.028, boulders: 24, boulderSize: 0.045, seed };
  const sizeText = derived
    ? `≈${D < 1 ? `${Math.round(D * 1000)} m` : `${D.toFixed(D < 10 ? 1 : 0)} km`} — from H ${H} at an assumed albedo of ${p}; not measured`
    : facts.measured;
  const where = `${CAMP_WORDS[row.camp]} ${row.planet}`;
  const campName = `${row.planet}'s ${row.camp} Trojans`;
  return {
    id: `trojan-${row.planet.toLowerCase()}-${name.replace(/\W+/g, "").toLowerCase()}`,
    name,
    meshDetail: row.planet === "Neptune" ? 0.4 : outer ? 0.5 : name === "Eureka" ? 0.6 : 0.42,
    designation: row.name,
    classification: `${row.planet} Trojan · ${row.camp}, ${where}`,
    detail: `${where} | ${campName}`,
    diameterKm: D,
    diameterLabel: sizeText,
    albedo: p,
    chroma: facts.chroma ?? (outer ? OUTER_CHROMA : row.planet === "Mars" && row.camp === "L5" ? OLIVINE_CHROMA : CLASS_CHROMA.NEUTRAL),
    rotationHours,
    rotationState: "principal-axis",
    metalness: 0,
    orbit: orbitOf(SOURCE, { epochJD: 2461200.5, aAU, e, iDeg, nodeDeg, argPeriDeg, meanAnomalyDeg, meanMotionDegPerDay: 0.9856076686 / aAU ** 1.5 }),
    coOrbital: { planet: row.planet, ratio: 1 },
    /* Round 38, second pass: skip drawing while under half a pixel. */
    cullTiny: true,
    /* Which camp (the board lists them by it). */
    trojanCamp: `${row.planet.toLowerCase()}${row.camp}`,
    textureFile: facts.texture ?? (row.planet === "Neptune" ? "neptune-trojan" : outer ? "uranus-trojan" : row.planet === "Mars" ? "mars-l5" : "earth-trojan"),
    shape,
    surfaceEvidence: derived
      ? "A point of light. Size from its brightness at an assumed albedo; shape and surface generated"
      : "A point of light; size from thermal infrared. Shape and surface generated",
    info: {
      population: `${row.planet} Trojans · ${row.camp} — sharing ${row.planet}'s orbit, ${where} (today ${Math.abs(row.fromPlanetDeg).toFixed(0)}° ${row.fromPlanetDeg >= 0 ? "ahead" : "behind"})`,
      diameter: sizeText,
      rotationPeriod: facts.rotNote ?? "Not measured — drawn turning once every 6 hours",
      gravity: "Not measured",
      surfaceEvidence: derived ? "Never resolved; surface generated" : "Never resolved; size from thermal infrared, surface generated",
      roughness: "unknown",
      description: facts.lede
        ?? NEPTUNE_FACTS[name]
        ?? (row.planet === "Mars" && row.camp === "L5" ? EUREKA_FRAGMENT
          : row.planet === "Neptune" ? `One of Neptune's Trojans, ${where}: an icy, dark body about 30 AU from the Sun, keeping Neptune's 165-year pace while it drifts slowly round the point. Everything known about it is its orbit and its brightness; its size is an estimate from that brightness.`
            : `A Trojan of ${row.planet}, ${where}.`),
      speedNote: `Goes round the Sun once every ${OUTER_YEARS[row.planet] ?? `${Math.round(PLANET_ORBIT_DAYS[row.planet])} days`} — ${row.planet}'s own year — while drifting slowly about the point ${where}.`,
    },
  };
}

const ALL_ROWS = [...PLANET_TROJANS, ...NEPTUNE_ROWS];
export const PLANET_TROJAN_BODIES = Object.freeze(ALL_ROWS.map(trojanRecord).map(withSpeedNow));

/* The drawn body's name for each catalogue row, keyed by the row's own
 * `name` in populationCatalogue.js -- the board's diagrams draw the rows
 * and fly to the bodies. */
export const TROJAN_BODY_NAME = Object.freeze(Object.fromEntries(
  ALL_ROWS.map((row, i) => [row.key ?? row.name, PLANET_TROJAN_BODIES[i].name]),
));

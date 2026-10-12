import { CENTAUR_ELEMENTS } from "./populationCatalogue.js";

/**
 * The Centaurs as rocks you meet, in their real colours.
 *
 * Round 40 (the owner: "in practice these icy bodies are not sparkling blue
 * ... we have to think about giving them a real texture colour"). The 1,036
 * Centaurs of `CENTAUR_ELEMENTS` are drawn by the near-Earth asteroids'
 * stamp machinery (nearEarthSwarm.js): a real cratered rock that grows in as
 * the camera nears it, on its real orbit, with a card. From afar the dots
 * stay (populationClouds.js), now in the same colours; a dot hands over to
 * its rock as the rock becomes big enough to see.
 *
 * ## Colour: grey or red
 *
 * Centaurs come in two colours with little between them -- the colour
 * bimodality, unexplained (Tegler & Romanishin 1998, 2003; Peixinho et al.
 * 2003, 2012; Tegler et al. 2016, AJ 152, 210; review: Peixinho et al. 2020,
 * arXiv:1905.08892). Measured B-R runs from ~1.0 (the Sun's colour, Chiron)
 * to ~2.0 (Pholus, the reddest body known); the groups sit near B-R 1.2 and
 * 1.8, with the gap near 1.6 (centaurCatalogue.js). Tegler et al. 2016 found
 * red Centaurs on smaller orbital inclinations than grey ones (99.3%
 * confidence).
 *
 * Almost none of these 1,036 has a measured colour, so each is given one:
 * red with a chance that falls with inclination -- 55% below 10 deg, 35% to
 * 25 deg, 15% above (chosen to follow the reported trend, not measured for
 * any one body) -- at B-R 1.80 (red) or 1.20 (grey), +/-0.08 so no two match.
 * Converted to a reflectance triple exactly as centaurCatalogue.js does for
 * the measured ones: k = 10^(0.4 (B-R - 1.005)) is the R/B ratio against
 * sunlight (Sun B-R 1.005, Holmberg, Flynn & Portinari 2006), R and B are
 * k^(+/-0.5), V at 55% of the way between, normalised to a mean of 1.
 *
 * ## Albedo, and so size
 *
 * Dark: red Centaurs average ~8-12% and grey ones ~5-6% (Bauer et al. 2013;
 * Duffard et al. 2014, both via Peixinho et al. 2020). Drawn at 0.10 and
 * 0.055, and sized from H at that albedo: D = 1329 / sqrt(p) x 10^(-H/5) km.
 *
 * ## Names
 *
 * `CENTAUR_ELEMENTS` carries orbits and H, not names. Until the JPL list
 * with names is supplied (public/assets/data/centaurs.json, same columns as
 * near-earth-asteroids.json plus `BR`), each card says which catalogue row
 * it is.
 */

const SUN_BR = 1.005;
const GREY_BR = 1.2;
const RED_BR = 1.8;
const GREY_ALBEDO = 0.055;
const RED_ALBEDO = 0.1;

/** The reflectance triple for a B-R colour (centaurCatalogue.js's rule). */
export function chromaFromBR(BR) {
  const k = 10 ** (0.4 * (BR - SUN_BR));
  const r = Math.sqrt(k);
  const b = 1 / Math.sqrt(k);
  const v = b + (r - b) * 0.55;
  const mean = (r + v + b) / 3;
  return [r / mean, v / mean, b / mean];
}

/* Chance of the red group by inclination (degrees); see above. */
const redChance = (iDeg) => (iDeg < 10 ? 0.55 : iDeg < 25 ? 0.35 : 0.15);

/* Rubble pile, potato, two lobes, cratered lump: no spinning tops (a
 * near-Earth YORP shape) and no metal. */
const SHAPES = [0, 1, 3, 4];

/* nearEarthSwarm.js's per-row hash, the same formula, so the dots
 * (populationClouds.js) and the rocks agree on every Centaur's colour. */
const hash = (i, k = 1) => {
  const x = Math.sin((i + 1) * 12.9898 * k + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Row i's colour group, B-R, reflectance triple and albedo. `measuredBR`
 * and `measuredAlbedo` win where a catalogue has them.
 */
export function centaurLook(i, iDeg, measuredBR = null, measuredAlbedo = null) {
  const hasBR = measuredBR > 0;
  const red = hasBR ? measuredBR >= 1.6 : hash(i, 23) < redChance(iDeg);
  const BR = hasBR ? measuredBR : (red ? RED_BR : GREY_BR) + (hash(i, 29) - 0.5) * 0.16;
  /* A group colour, not a measured one: its saturation pushed 1.6x, the
   * rule mainBeltCatalogue.js uses for class-typical colours (taken
   * literally they render as near-identical greys under the scene's tone
   * mapping -- measured: the literal red read olive-khaki on screen). A
   * measured colour is converted literally, as centaurCatalogue.js does. */
  const literal = chromaFromBR(BR);
  const chroma = hasBR ? literal : literal.map((v) => 1 + (v - 1) * 1.6);
  return {
    red,
    BR,
    chroma,
    albedo: measuredAlbedo > 0 ? measuredAlbedo : red ? RED_ALBEDO : GREY_ALBEDO,
  };
}

/** Size from brightness: D = 1329 / sqrt(p) x 10^(-H/5) km. */
export const centaurDiameterKm = (H, albedo) => (1329 / Math.sqrt(albedo)) * 10 ** (-(H >= 0 ? H : 12) / 5);

const RANGE_WORDS = "between Jupiter and Neptune, crossing the giants' orbits";

export const CENTAUR_PROFILE = Object.freeze({
  key: "cen",
  keyPrefix: "cen:",
  groupName: "Centaur swarm",
  stampName: "Centaur rock stamp",
  targetName: "Centaur",
  /* No H on record (a handful of short arcs): drawn at H 12, ~40 km dark. */
  missingH: 12,

  fallbackTable() {
    const rows = CENTAUR_ELEMENTS;
    const col = (k) => rows.map((r) => r[k]);
    return {
      name: rows.map((_, i) => `Centaur ${i + 1}`),
      pdes: rows.map((_, i) => String(i + 1)),
      a: col(0), e: col(1), i: col(2), om: col(3), w: col(4), ma: col(5),
      H: rows.map((r) => (r[6] >= 0 ? r[6] : -1)),
      epoch: rows.map((r) => r[7] ?? 2461200.5),
    };
  },

  classify(i, table) {
    const look = centaurLook(i, table.i[i], table.BR?.[i], table.alb?.[i]);
    return {
      group: look.red ? 1 : 0,
      shape: SHAPES[Math.floor(hash(i, 5) * SHAPES.length)],
      chroma: look.chroma,
      albedo: look.albedo,
      /* Where none is measured: a chosen 5-13 h. */
      rotation: 5 + hash(i, 11) * 8,
      BR: look.BR,
    };
  },

  /* The path in hand: warm grey or brick red, lifted to read on black. */
  orbitRGB(row, GROUP) {
    return GROUP[row] ? [1, 0.62, 0.45] : [0.82, 0.84, 0.86];
  },

  describe(i, { meta, group, albedo, diameterKm, rows, currentAU }) {
    const name = String(meta.name[i]).trim();
    const named = !/^Centaur \d+$/.test(name);
    const a = meta.a[i];
    const e = meta.e[i];
    const D = diameterKm;
    const size = D < 1 ? `${Math.round(D * 1000)} m` : `${D < 10 ? D.toFixed(1) : Math.round(D)} km`;
    const measuredD = meta.D?.[i] > 0;
    const measuredBR = meta.BR?.[i] > 0;
    const colourWord = group ? "red" : "grey";
    const rot = meta.rot?.[i];
    return {
      name,
      record: {
        id: `cen-${i}`,
        name,
        designation: named ? name : `${name} (JPL SBDB class CEN; name not loaded)`,
        classification: `Centaur · ${colourWord}`,
        detail: `Centaur · ${RANGE_WORDS} | JPL Small-Body Database`,
        diameterKm: D,
        albedo,
        shape: { seed: i },
        surfaceEvidence: "A point of light: its orbit and brightness are what is known. Drawn as a stamped rock in its colour group",
        info: {
          population: `Centaurs — ${RANGE_WORDS}, ${(a * (1 - e)).toFixed(1)}–${(a * (1 + e)).toFixed(1)} AU`,
          diameter: measuredD
            ? `${size} (JPL Small-Body Database)`
            : meta.H[i] >= 0
              ? `≈${size} — from its brightness (H ${meta.H[i]}) at albedo ${albedo}, typical of ${colourWord} Centaurs; not measured`
              : "Not known — no brightness on record",
          rotationPeriod: rot > 0 ? `${rot} h (JPL SBDB / LCDB)` : "Not measured — drawn turning at a chosen rate",
          gravity: "Not measured",
          surfaceEvidence: measuredBR
            ? `Measured colour B−R ${meta.BR[i]} — the ${colourWord} group`
            : `Colour not measured — drawn ${colourWord}, one of the two Centaur colour groups (red more likely on low-inclination orbits, Tegler et al. 2016)`,
          roughness: "unknown",
          orbitalSpeed: `One orbit every ${Math.round(a ** 1.5)} years`,
          description: `One of ${rows.toLocaleString("en-US")} Centaurs in the scene: icy bodies from the Kuiper Belt now on short-lived orbits among the giant planets, between Jupiter's and Neptune's. Centaurs come in two colours with almost nothing between — neutral grey or deep red — and nobody knows why. This one is drawn ${colourWord}. It has never been seen as more than a point of light, so its shape is a stand-in; its orbit and brightness are real.`,
        },
      },
      elements: {
        aAU: a,
        e,
        hyperbolic: false,
        get currentAU() { return currentAU(); },
      },
      family: null,
    };
  },
});

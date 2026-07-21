import * as THREE from "three";

const OFFICIAL_BASE_NAMES = Object.freeze([
  "Mimas", "Enceladus", "Tethys", "Dione", "Rhea", "Titan", "Hyperion", "Iapetus",
  "Phoebe", "Janus", "Epimetheus", "Helene", "Telesto", "Calypso", "Atlas", "Prometheus",
  "Pandora", "Pan", "Ymir", "Paaliaq", "Tarvos", "Ijiraq", "Suttungr", "Kiviuq",
  "Mundilfari", "Albiorix", "Skathi", "Erriapus", "Siarnaq", "Thrymr", "Narvi", "Methone",
  "Pallene", "Polydeuces", "Daphnis", "Aegir", "Bebhionn", "Bergelmir", "Bestla", "Farbauti",
  "Fenrir", "Fornjot", "Hati", "Hyrrokkin", "Kari", "Loge", "Skoll", "Surtur", "Anthe",
  "Jarnsaxa", "Greip", "Tarqeq", "Aegaeon", "Gridr", "Angrboda", "Skrymir", "Gerd",
  "S/2004 S26", "Eggther", "S/2004 S29", "Beli", "Gunnlod", "Thiazzi", "S/2004 S34",
  "Alvaldi", "Geirrod",
]);

const ADDITIONAL_2004 = Object.freeze([
  7, 12, 13, 17, 21, 24, 28, 31, 36, 37, 39,
  ...Array.from({ length: 22 }, (_, index) => index + 40),
].map((number) => `S/2004 S${number}`));

function rangeDesignations(year, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => `S/${year} S${start + index}`);
}

const PROVISIONAL_NAMES = Object.freeze([
  ...ADDITIONAL_2004,
  ...rangeDesignations(2005, 4, 7),
  "S/2006 S1", "S/2006 S3", ...rangeDesignations(2006, 9, 29),
  "S/2007 S2", "S/2007 S3", ...rangeDesignations(2007, 5, 11),
  "S/2009 S1",
  ...rangeDesignations(2019, 1, 44),
  ...rangeDesignations(2020, 1, 44),
  ...rangeDesignations(2023, 1, 50),
]);

export const SATURN_OFFICIAL_MOON_NAMES = Object.freeze([
  ...OFFICIAL_BASE_NAMES,
  ...PROVISIONAL_NAMES,
]);

const RESOLVED = Object.freeze({
  Pan: { diameterKm: 28.2, aKm: 133584, periodDays: 0.57505, shape: [1.35, 0.82, 1.06], appearance: "ring-ridge", family: "Ring moon" },
  Daphnis: { diameterKm: 7.6, aKm: 136505, periodDays: 0.59408, shape: [1.18, 0.88, 0.82], appearance: "ring-ice", family: "Ring moon" },
  Atlas: { diameterKm: 30.2, aKm: 137670, periodDays: 0.60169, shape: [1.42, 0.78, 1.05], appearance: "ring-ridge", family: "Ring moon" },
  Prometheus: { diameterKm: 86.2, aKm: 139380, periodDays: 0.61299, shape: [1.38, 0.78, 0.72], appearance: "ring-ice", family: "Ring shepherd moon" },
  Pandora: { diameterKm: 81.4, aKm: 141720, periodDays: 0.62850, shape: [1.34, 0.80, 0.74], appearance: "ring-ice", family: "Ring shepherd moon" },
  Epimetheus: { diameterKm: 116.2, aKm: 151410, periodDays: 0.69433, shape: [1.20, 0.93, 0.87], appearance: "ice-rock", family: "Co-orbital moon" },
  Janus: { diameterKm: 178.0, aKm: 151460, periodDays: 0.69466, shape: [1.22, 0.92, 0.88], appearance: "ice-rock", family: "Co-orbital moon" },
  Aegaeon: { diameterKm: 0.66, aKm: 167500, periodDays: 0.80812, shape: [1.25, 0.84, 0.76], appearance: "ring-ice", family: "Ring moon" },
  Mimas: { diameterKm: 396.4, aKm: 185539, periodDays: 0.94242, appearance: "mimas", family: "Major regular moon" },
  Methone: { diameterKm: 3.2, aKm: 194230, periodDays: 1.00957, shape: [1.08, 1.0, 0.96], appearance: "smooth-ice", family: "Ring moon" },
  Anthe: { diameterKm: 1.8, aKm: 197700, periodDays: 1.03650, shape: [1.12, 0.94, 0.90], appearance: "smooth-ice", family: "Ring moon" },
  Pallene: { diameterKm: 4.4, aKm: 212280, periodDays: 1.15375, shape: [1.10, 0.96, 0.92], appearance: "smooth-ice", family: "Ring moon" },
  Enceladus: { diameterKm: 504.2, aKm: 238037, periodDays: 1.37022, appearance: "enceladus", family: "Major regular moon" },
  Tethys: { diameterKm: 1062.2, aKm: 294672, periodDays: 1.88780, appearance: "tethys", family: "Major regular moon" },
  Telesto: { diameterKm: 24.8, aKm: 294672, periodDays: 1.88780, shape: [1.18, 0.90, 0.84], appearance: "ice-rock", family: "Trojan moon" },
  Calypso: { diameterKm: 21.4, aKm: 294672, periodDays: 1.88780, shape: [1.20, 0.88, 0.82], appearance: "ice-rock", family: "Trojan moon" },
  Dione: { diameterKm: 1122.8, aKm: 377415, periodDays: 2.73692, appearance: "dione", family: "Major regular moon" },
  Helene: { diameterKm: 35.2, aKm: 377415, periodDays: 2.73692, shape: [1.22, 0.88, 0.80], appearance: "ice-rock", family: "Trojan moon" },
  Polydeuces: { diameterKm: 2.6, aKm: 377415, periodDays: 2.73692, shape: [1.18, 0.86, 0.80], appearance: "ice-rock", family: "Trojan moon" },
  Rhea: { diameterKm: 1527.6, aKm: 527068, periodDays: 4.51821, appearance: "rhea", family: "Major regular moon" },
  Titan: { diameterKm: 5149.5, aKm: 1221870, periodDays: 15.94542, appearance: "titan", atmosphere: 0xd39a4f, family: "Major regular moon" },
  Hyperion: { diameterKm: 270.0, aKm: 1481100, periodDays: 21.27661, shape: [1.35, 1.02, 0.82], appearance: "hyperion", family: "Major irregular moon" },
  Iapetus: { diameterKm: 1469.0, aKm: 3560820, periodDays: 79.3215, appearance: "iapetus", family: "Major regular moon" },
  Phoebe: { diameterKm: 213.0, aKm: 12952000, periodDays: 550.31, shape: [1.16, 1.02, 0.92], appearance: "phoebe", family: "Norse irregular moon", retrograde: true },
});

const DIRECT_NAMES = new Set(Object.keys(RESOLVED));
const INUIT_NAMES = new Set(["Kiviuq", "Ijiraq", "Paaliaq", "Siarnaq", "Tarqeq"]);
const GALLIC_NAMES = new Set(["Albiorix", "Bebhionn", "Erriapus", "Tarvos"]);

function stableSeed(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function compressedOrbitScale(aKm) {
  return 1.30 + 1.82 * Math.pow(Math.max(1, aKm / 185539), 0.34);
}

function familyFor(name, seed) {
  if (INUIT_NAMES.has(name)) return "Inuit irregular moon";
  if (GALLIC_NAMES.has(name)) return "Gallic irregular moon";
  if (DIRECT_NAMES.has(name)) return RESOLVED[name].family;
  if (seed < 0.12) return "Inuit irregular moon";
  if (seed < 0.22) return "Gallic irregular moon";
  return "Norse irregular moon";
}

function familyColour(family) {
  if (family.startsWith("Inuit")) return 0x75655a;
  if (family.startsWith("Gallic")) return 0x8b6d5d;
  if (family.startsWith("Norse")) return 0x5d5753;
  if (family.includes("Ring")) return 0xc8c4ba;
  return 0xaaa69d;
}

function createBackgroundProfile(name, index) {
  const seed = stableSeed(name);
  const family = familyFor(name, seed);
  const retrograde = family.startsWith("Norse");
  const aKm = 7_500_000 + Math.pow(seed, 0.72) * 18_800_000 + (index % 17) * 29_000;
  const periodDays = 200 + Math.pow(aKm / 7_500_000, 1.5) * 330;
  const diameterKm = 0.25 + Math.pow(stableSeed(`${name}:size`), 2.15) * 7.8;
  const inclinationDeg = retrograde
    ? 145 + stableSeed(`${name}:inc`) * 30
    : 32 + stableSeed(`${name}:inc`) * 18;

  return Object.freeze({
    name,
    catalogueName: name,
    family,
    appearance: family.startsWith("Inuit") ? "inuit" : family.startsWith("Gallic") ? "gallic" : "norse",
    color: familyColour(family),
    diameterKm,
    diameterEstimated: true,
    orbitScale: compressedOrbitScale(aKm),
    semiMajorAxisKm: aKm,
    eccentricity: 0.10 + stableSeed(`${name}:ecc`) * 0.42,
    inclination: THREE.MathUtils.degToRad(inclinationDeg),
    inclinationDeg,
    node: stableSeed(`${name}:node`) * Math.PI * 2,
    meanAnomaly: stableSeed(`${name}:phase`) * Math.PI * 2,
    periodDays,
    retrograde,
    speed: (retrograde ? -1 : 1) * THREE.MathUtils.clamp(0.013 / Math.sqrt(periodDays / 100), 0.00045, 0.0032),
    seed,
    shape: [1.08 + seed * 0.42, 0.76 + seed * 0.20, 0.70 + stableSeed(`${name}:z`) * 0.24],
    visualRadius: 0.017 + Math.pow(diameterKm / 8.05, 0.5) * 0.018,
    tidallyLocked: false,
    showOrbitGuide: false,
    instanced: true,
    interactionTier: "background",
    orbitalSpeed: "Slow irregular orbit around Saturn",
    orbitSummary: `Compressed visual reconstruction of Saturn's ${family.toLowerCase()} population.`,
    description: `${name} is a tiny unresolved Saturnian satellite represented as a family-based irregular body. Its exact surface is unknown.`,
    dataNote: "Officially confirmed satellite; visible shape and colour are a conservative family reconstruction.",
  });
}

function createResolvedProfile(name) {
  const data = RESOLVED[name];
  const seed = stableSeed(name);
  const retrograde = Boolean(data.retrograde);
  const orbitScale = compressedOrbitScale(data.aKm);
  return Object.freeze({
    name,
    catalogueName: name,
    family: data.family,
    appearance: data.appearance,
    color: name === "Titan" ? 0xc98d42 : name === "Iapetus" ? 0x8a8074 : name === "Phoebe" ? 0x514e4a : 0xb8b5ae,
    diameterKm: data.diameterKm,
    diameterEstimated: false,
    orbitScale,
    semiMajorAxisKm: data.aKm,
    eccentricity: name === "Hyperion" ? 0.104 : name === "Phoebe" ? 0.163 : 0.006,
    inclination: THREE.MathUtils.degToRad(name === "Phoebe" ? 175.2 : name === "Iapetus" ? 15.5 : 0.6),
    inclinationDeg: name === "Phoebe" ? 175.2 : name === "Iapetus" ? 15.5 : 0.6,
    node: seed * Math.PI * 2,
    meanAnomaly: stableSeed(`${name}:phase`) * Math.PI * 2,
    periodDays: data.periodDays,
    retrograde,
    speed: (retrograde ? -1 : 1) * THREE.MathUtils.clamp(0.020 / Math.sqrt(data.periodDays), 0.0005, 0.015),
    seed,
    shape: data.shape ?? [1, 1, 1],
    visualRadius: THREE.MathUtils.clamp(0.06 + 0.58 * Math.pow(data.diameterKm / 5149.5, 0.68), 0.055, 0.64),
    tidallyLocked: !["Hyperion", "Phoebe"].includes(name),
    showOrbitGuide: ["Mimas", "Enceladus", "Tethys", "Dione", "Rhea", "Titan", "Hyperion", "Iapetus", "Phoebe"].includes(name),
    instanced: false,
    interactionTier: "direct",
    atmosphere: data.atmosphere,
    initialRotation: name === "Titan"
      ? [0.04, -0.72, -0.02]
      : name === "Mimas"
        ? [-0.14, 0.94, -0.02]
        : name === "Iapetus"
          ? [0.02, -1.34, -0.01]
          : name === "Enceladus"
            ? [0.10, -0.22, 0.03]
            : name === "Tethys"
              ? [-0.05, 0.52, 0.02]
              : name === "Dione"
                ? [0.02, -1.05, -0.01]
                : name === "Rhea"
                  ? [-0.04, 0.36, 0.01]
                  : undefined,
    surfaceEvidence: name === "Titan"
      ? "Cassini/VIMS-inspired false-colour surface reconstruction"
      : name === "Mimas"
        ? "NASA Cassini global map PIA17214"
        : name === "Iapetus"
          ? "NASA Cassini global hemispheres PIA11690"
          : name === "Enceladus"
            ? "NASA Cassini global map PIA14937 and south-polar plume observations"
            : name === "Tethys"
              ? "NASA Cassini global map PIA14931"
              : name === "Dione"
                ? "NASA Cassini global maps PIA12814 and PIA18434"
                : name === "Rhea"
                  ? "NASA Cassini global map PIA14928"
                  : undefined,
    surfaceStructure: name === "Titan"
      ? "Broad icy-organic terrain units beneath dense nitrogen-methane haze"
      : name === "Mimas"
        ? "Heavily cratered water-ice crust with the giant Herschel basin, raised walls, and central peak"
        : name === "Iapetus"
          ? "Dark Cassini Regio, bright icy terrain, large basins, and a broken equatorial mountain ridge"
          : name === "Enceladus"
            ? "Reflective water-ice crust, sparse craters, tectonic grooves, four south-polar tiger stripes, and water-ice jets"
            : name === "Tethys"
              ? "Cratered ice with the giant relaxed Odysseus basin and the long Ithaca Chasma canyon system"
              : name === "Dione"
                ? "Cratered ice with braided bright cliffs and tectonic fractures across the trailing hemisphere"
                : name === "Rhea"
                  ? "Ancient densely cratered ice with large overlapping basins and restrained fractures"
                  : undefined,
    surfaceRoughness: name === "Titan"
      ? 0.86
      : name === "Mimas"
        ? 0.94
        : name === "Iapetus"
          ? 0.91
          : name === "Enceladus"
            ? 0.76
            : name === "Tethys"
              ? 0.92
              : name === "Dione"
                ? 0.88
                : name === "Rhea"
                  ? 0.94
                  : undefined,
    orbitalSpeed: `${((Math.PI * 2 * data.aKm) / (data.periodDays * 86400)).toFixed(2)} km/s around Saturn`,
    orbitSummary: `Mean orbit approximately ${(data.aKm / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })} thousand km from Saturn; period ${data.periodDays.toFixed(data.periodDays < 10 ? 3 : 1)} days.`,
    description: name === "Titan"
      ? "Saturn's largest moon, wrapped in a dense nitrogen atmosphere with methane lakes, rain, dunes, and a subsurface ocean."
      : name === "Enceladus"
        ? "A highly reflective ocean moon with active south-polar tiger stripes that vent water-rich plumes into space."
        : name === "Tethys"
          ? "A bright icy moon marked by the enormous Odysseus impact basin and the planet-scale Ithaca Chasma canyon system."
          : name === "Dione"
            ? "A cratered icy moon whose trailing hemisphere is crossed by bright braided cliffs and fractures."
            : name === "Rhea"
              ? "Saturn's second-largest moon, an old crater-saturated ice world with large overlapping basins."
              : name === "Iapetus"
          ? "A striking two-tone moon with a dark leading hemisphere and a prominent equatorial ridge."
          : name === "Hyperion"
            ? "A porous, chaotic tumbler with a sponge-like cratered surface."
            : name === "Mimas"
              ? "A small icy moon dominated by the enormous Herschel impact crater."
              : `${name} is one of Saturn's resolved regular or ring-associated satellites.`,
    dataNote: name === "Titan"
      ? "Surface colours use a Cassini/VIMS-style false-colour reconstruction so terrain remains visible beneath a separately rendered atmospheric haze."
      : name === "Mimas"
        ? "Surface detail uses NASA's Cassini global map; Herschel relief is rebuilt in geometry from NASA's stated crater, wall, and central-peak structure."
        : name === "Iapetus"
          ? "The albedo map follows the supplied Cassini leading/trailing hemispheres; geometry preserves the dark-bright dichotomy, large basins, polar flattening, and equatorial ridge."
          : name === "Enceladus"
            ? "The surface uses NASA's Cassini global map; geometry rebuilds the south-polar tiger stripes, while animated particles represent sunlight-scattering water-ice jets without adding a light source."
            : name === "Tethys"
              ? "The surface uses NASA's Cassini map; Odysseus and the long, approximately concentric Ithaca Chasma system are rebuilt in geometry."
              : name === "Dione"
                ? "The surface uses NASA Cassini global mosaics; the bright wispy terrain is reconstructed as braided chasmata with raised icy walls."
                : name === "Rhea"
                  ? "The surface uses NASA's Cassini global map with deterministic crater, basin, and restrained fracture relief."
                  : "Resolved or constrained by spacecraft observations and established orbital measurements.",
  });
}

export const SATURN_MOON_PROFILES = Object.freeze(
  SATURN_OFFICIAL_MOON_NAMES.map((name, index) => (
    DIRECT_NAMES.has(name) ? createResolvedProfile(name) : createBackgroundProfile(name, index)
  )),
);

export const SATURN_MOON_COUNT = SATURN_MOON_PROFILES.length;

if (SATURN_MOON_COUNT !== 274) {
  throw new Error(`Saturn catalogue integrity error: expected 274 moons, got ${SATURN_MOON_COUNT}.`);
}

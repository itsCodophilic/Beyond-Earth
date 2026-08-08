import * as THREE from "three";

const RAW = Object.freeze([
  ["Naiad", 803, 48227, 0.0003, 4.7, 41.4, 89.7, 0.294396, 66, [1.24, 0.91, 0.80], "naiad"],
  ["Thalassa", 804, 50074, 0.0002, 0.2, 130.6, 165.7, 0.311485, 82, [1.20, 0.93, 0.84], "thalassa"],
  ["Despina", 805, 52526, 0.0002, 0.1, 0, 125.1, 0.334655, 150, [1.22, 0.95, 0.87], "despina"],
  ["Galatea", 806, 61953, 0.0001, 0.1, 0, 32.0, 0.428745, 176, [1.16, 0.94, 0.88], "inner-dark"],
  ["Larissa", 807, 73548, 0.0014, 0.2, 0, 210.0, 0.554654, 194, [1.22, 0.94, 0.86], "inner-dark"],
  ["Hippocamp", 814, 105283, 0.0005, 0.1, 0, 285.0, 0.9362, 34, [1.16, 0.92, 0.84], "inner-dark"],
  ["Proteus", 808, 117647, 0.0005, 0.1, 0, 18.0, 1.122315, 420, [1.13, 1.0, 0.91], "proteus"],
  ["Triton", 801, 354759, 0.0000, 157.3, 178.1, 63.0, 5.876994, 2706.8, [1, 1, 1], "triton"],
  ["Nereid", 802, 5513400, 0.7507, 7.2, 320.3, 12.0, 360.14, 340, [1.12, 0.92, 0.86], "nereid"],
  ["Halimede", 809, 16590500, 0.521, 119.6, 198.5, 135.8, 1879, 62, [1.18, 0.86, 0.78], "outer-dark"],
  ["Sao", 811, 22239900, 0.296, 50.2, 41.8, 178.5, 2919, 44, [1.16, 0.88, 0.80], "outer-dark"],
  ["S/2002 N5", 85051, 23414700, 0.433, 46.3, 258.3, 303.2, 3151, 23, [1.20, 0.84, 0.76], "outer-dark"],
  ["Laomedeia", 812, 23499900, 0.419, 36.9, 57.6, 248.1, 3168, 42, [1.17, 0.88, 0.80], "outer-dark"],
  ["Psamathe", 810, 47646600, 0.413, 127.8, 302.9, 183.2, 9149, 40, [1.18, 0.86, 0.78], "outer-dark"],
  ["Neso", 813, 49897800, 0.455, 128.4, 55.4, 13.8, 9805, 60, [1.22, 0.84, 0.76], "outer-dark"],
  ["S/2021 N1", 85052, 50700200, 0.503, 135.2, 258.9, 237.1, 10043, 14, [1.22, 0.82, 0.74], "outer-dark"],
]);

function stableSeed(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function compressedOrbitScale(aKm) {
  return 1.10 + 1.70 * Math.pow(Math.max(1, aKm / 48227), 0.28);
}

// Reveal-all mode needs a little more visual breathing room around Neptune.
// The true inner-moon distances are extremely tightly packed; after the full
// Neptunian system is compressed to fit the atlas, Naiad/Thalassa/Despina can
// otherwise sit almost on Neptune's visible limb. These are presentation-only
// orbit scales used exclusively by the cinematic atlas. Normal inspection and
// all scientific distance metadata continue to use `orbitScale` / aKm.
const NEPTUNE_ATLAS_INNER_ORBIT_SCALES = Object.freeze({
  Naiad: 3.46,
  Thalassa: 3.86,
  Despina: 4.26,
  Galatea: 4.75,
  Larissa: 5.24,
  Hippocamp: 5.85,
  Proteus: 6.28,
  Triton: 7.05,
});

export const NEPTUNE_MOON_PROFILES = Object.freeze(RAW.map((row) => {
  const [name, code, aKm, eccentricity, inclinationDeg, nodeDeg, meanAnomalyDeg, periodDays, diameterKm, shape, appearance] = row;
  const retrograde = inclinationDeg > 90;
  const seed = stableSeed(name);
  const direct = true;
  return Object.freeze({
    name,
    catalogueName: name,
    jplCode: code,
    family: name === "Triton" ? "Captured major moon" : aKm < 1_000_000 ? "Inner regular moon" : "Outer irregular moon",
    appearance,
    color: name === "Triton" ? 0xc9b4ae : name === "Nereid" ? 0x777c82 : 0x545a60,
    diameterKm,
    diameterEstimated: ["S/2002 N5", "S/2021 N1"].includes(name),
    orbitScale: compressedOrbitScale(aKm),
    atlasOrbitScale: NEPTUNE_ATLAS_INNER_ORBIT_SCALES[name] ?? compressedOrbitScale(aKm),
    semiMajorAxisKm: aKm,
    eccentricity,
    inclination: THREE.MathUtils.degToRad(inclinationDeg),
    inclinationDeg,
    node: THREE.MathUtils.degToRad(nodeDeg),
    meanAnomaly: THREE.MathUtils.degToRad(meanAnomalyDeg),
    periodDays,
    retrograde,
    speed: (retrograde ? -1 : 1) * THREE.MathUtils.clamp(0.018 / Math.sqrt(periodDays), 0.00045, 0.018),
    seed,
    shape,
    visualRadius: THREE.MathUtils.clamp(0.05 + 0.52 * Math.pow(diameterKm / 2706.8, 0.64), 0.05, 0.57),
    tidallyLocked: aKm < 1_000_000,
    showOrbitGuide: ["Naiad", "Proteus", "Triton", "Nereid", "Halimede", "Sao", "Psamathe", "Neso"].includes(name),
    instanced: !direct,
    interactionTier: diameterKm >= 34 ? "direct" : "notable",
    orbitalSpeed: `${((Math.PI * 2 * aKm) / (periodDays * 86400)).toFixed(2)} km/s around Neptune`,
    orbitSummary: `Mean orbit ${(aKm / 1_000_000).toFixed(aKm < 1_000_000 ? 3 : 2)} million km from Neptune; period ${periodDays < 10 ? periodDays.toFixed(3) : periodDays.toFixed(0)} days; ${retrograde ? "retrograde" : "prograde"}.`,
    description: name === "Triton"
      ? "Neptune's largest moon, a captured retrograde world with nitrogen frost, cantaloupe terrain, and active geysers."
      : name === "Proteus"
        ? "A dark, irregular and heavily cratered inner moon near the size limit for a non-spherical body."
        : name === "Nereid"
          ? "A distant moon travelling on one of the most eccentric satellite orbits in the Solar System."
          : name === "Naiad"
            ? "Neptune's innermost known moon, recreated from the supplied real-image reference as a bright elongated icy body with subtle craters and a darker trailing side."
            : name === "Thalassa"
              ? "A small inner moon of Neptune, implemented from the supplied reference style as a pale rounded icy body with softly cratered terrain and gentle brightness variation."
              : name === "Despina"
                ? "An inner Neptunian moon rendered from the supplied reference style as a pale elongated body with a slightly rougher and more cratered surface than Thalassa."
                : `${name} is one of Neptune's ${aKm < 1_000_000 ? "dark inner" : "distant irregular"} satellites.`,
    dataNote: ["S/2002 N5", "S/2021 N1"].includes(name)
      ? "Orbit is measured; displayed size and surface are conservative estimates."
      : "Orbit and established physical scale are represented with cinematic compression.",
  });
}));

export const NEPTUNE_MOON_COUNT = NEPTUNE_MOON_PROFILES.length;

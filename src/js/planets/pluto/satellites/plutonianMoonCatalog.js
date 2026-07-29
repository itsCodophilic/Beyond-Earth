import * as THREE from "three";

const RAW = Object.freeze([
  ["Charon", 901, 19600, 0.000, 0.0, 0.0, 304.1, 6.387222, 1212, [1.0, 1.0, 1.0], "charon"],
  ["Styx", 905, 43200, 0.025, 0.0, 0.0, 358.1, 20.16, 10, [1.44, 0.82, 0.72], "small-bright"],
  ["Nix", 902, 49300, 0.015, 0.0, 0.0, 338.2, 24.85, 39, [1.34, 0.90, 0.82], "nix"],
  ["Kerberos", 904, 58300, 0.010, 0.4, 314.3, 276.1, 32.17, 12, [1.46, 0.80, 0.70], "kerberos"],
  ["Hydra", 903, 65200, 0.009, 0.3, 114.3, 335.0, 38.20, 41, [1.38, 0.88, 0.80], "hydra"],
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
  return 2.25 + 3.15 * Math.pow(aKm / 65_200, 0.82);
}

function visualRadius(diameterKm, name) {
  if (name === "Charon") return 0.46;
  return THREE.MathUtils.clamp(0.050 + 0.105 * Math.pow(diameterKm / 45, 0.58), 0.052, 0.155);
}

function orbitalSpeedKmS(aKm, periodDays) {
  return (Math.PI * 2 * aKm) / (periodDays * 86_400);
}

const DESCRIPTIONS = Object.freeze({
  Charon: "Pluto's giant companion, about half Pluto's diameter, with grey water-ice terrain and a dark reddish polar cap known as Mordor Macula.",
  Styx: "The innermost small moon of the Pluto system, an elongated bright body tumbling chaotically around the Pluto-Charon binary.",
  Nix: "A bright elongated moon with water ice, a large reddish impact crater, and a chaotic non-synchronous rotation.",
  Kerberos: "A tiny double-lobed moon darker than the other small Pluto satellites, rotating chaotically in the binary system.",
  Hydra: "The outermost known Pluto moon, a bright irregular water-ice body with a rapidly changing chaotic spin.",
});

export const PLUTO_MOON_PROFILES = Object.freeze(RAW.map((row) => {
  const [name, jplCode, semiMajorAxisKm, eccentricity, inclinationDeg, nodeDeg, meanAnomalyDeg, periodDays, diameterKm, shape, appearance] = row;
  const seed = stableSeed(name);
  return Object.freeze({
    name,
    catalogueName: name,
    jplCode,
    family: name === "Charon" ? "Binary companion" : "Small circumbinary moon",
    appearance,
    color: name === "Charon" ? 0x9b9996 : name === "Kerberos" ? 0x686260 : 0xb8b5ad,
    diameterKm,
    diameterEstimated: name !== "Charon",
    orbitScale: compressedOrbitScale(semiMajorAxisKm),
    semiMajorAxisKm,
    eccentricity,
    inclination: THREE.MathUtils.degToRad(inclinationDeg),
    inclinationDeg,
    node: THREE.MathUtils.degToRad(nodeDeg),
    meanAnomaly: THREE.MathUtils.degToRad(meanAnomalyDeg),
    periodDays,
    retrograde: false,
    speed: THREE.MathUtils.clamp(0.020 / Math.sqrt(periodDays), 0.0016, 0.012),
    seed,
    shape,
    visualRadius: visualRadius(diameterKm, name),
    tidallyLocked: name === "Charon",
    showOrbitGuide: true,
    instanced: false,
    interactionTier: "direct",
    orbitalSpeed: `${orbitalSpeedKmS(semiMajorAxisKm, periodDays).toFixed(3)} km/s around the Pluto system`,
    orbitSummary: `Mean barycentric orbit ${(semiMajorAxisKm / 1000).toFixed(1)} thousand km; period ${periodDays.toFixed(3)} days.`,
    description: DESCRIPTIONS[name],
    dataNote: name === "Charon"
      ? "Orbit and physical scale follow the post-New Horizons Pluto-system solution."
      : "Orbit is measured; shape and surface use New Horizons-constrained proportions and conservative procedural detail.",
  });
}));

export const PLUTO_MOON_COUNT = PLUTO_MOON_PROFILES.length;

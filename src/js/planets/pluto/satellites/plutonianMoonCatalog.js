import * as THREE from "three";
import { PLANET_SCALE_PROFILES } from "../../../config/celestialScale.js";

/**
 * Pluto satellite catalogue.
 *
 * Orbital elements use the current JPL PLU060 mean-element solution. The
 * rendering keeps the measured orbital ordering/eccentricities but compresses
 * the physical gaps into a compact cinematic portrait so all five moons can
 * be discovered around Pluto without a separate reveal-all atlas.
 *
 * Surface/size guidance follows NASA New Horizons observations:
 * - Charon is roughly half Pluto's diameter and is mutually tidally locked.
 * - Styx, Nix, Kerberos and Hydra are small, elongated, bright icy bodies that
 *   rotate much faster than synchronous.
 */
const PLUTO_DIAMETER_KM = PLANET_SCALE_PROFILES.Pluto.diameterKm;
const PLUTO_VISUAL_RADIUS = PLANET_SCALE_PROFILES.Pluto.visualRadius;

const RAW = Object.freeze([
  {
    name: "Charon",
    jplCode: 901,
    semiMajorAxisKm: 19_600,
    eccentricity: 0.000,
    inclinationDeg: 0.0,
    nodeDeg: 0.0,
    meanAnomalyDeg: 304.1,
    periodDays: 6.387222,
    diameterKm: 1_214,
    diameterLabel: "≈ 1,214 km",
    shape: [1, 1, 1],
    colour: 0x918983,
    appearance: "charon",
    tidallyLocked: true,
  },
  {
    name: "Styx",
    jplCode: 905,
    semiMajorAxisKm: 43_200,
    eccentricity: 0.025,
    inclinationDeg: 0.0,
    nodeDeg: 0.0,
    meanAnomalyDeg: 358.1,
    periodDays: 20.16,
    // New Horizons resolves an approximately ten-kilometre equivalent body.
    diameterKm: 10.0,
    diameterLabel: "≈ 10 km equivalent diameter · highly elongated",
    shape: [1.58, 0.86, 0.72],
    colour: 0xbfc0b9,
    appearance: "styx",
    tidallyLocked: false,
    visualScaleBoost: 20.0,
  },
  {
    name: "Nix",
    jplCode: 902,
    semiMajorAxisKm: 49_300,
    eccentricity: 0.015,
    inclinationDeg: 0.0,
    nodeDeg: 0.0,
    meanAnomalyDeg: 338.2,
    periodDays: 24.85,
    diameterKm: 40.0,
    diameterLabel: "≈ 40 km equivalent diameter · elongated",
    shape: [1.30, 0.88, 0.80],
    colour: 0xcec9bf,
    appearance: "nix",
    tidallyLocked: false,
    visualScaleBoost: 10.0,
  },
  {
    name: "Kerberos",
    jplCode: 904,
    semiMajorAxisKm: 58_300,
    eccentricity: 0.010,
    inclinationDeg: 0.4,
    nodeDeg: 314.3,
    meanAnomalyDeg: 276.1,
    periodDays: 32.17,
    diameterKm: 10.0,
    diameterLabel: "≈ 10 km equivalent diameter · strongly elongated",
    shape: [1.72, 0.82, 0.70],
    colour: 0xb9b8ad,
    appearance: "kerberos",
    tidallyLocked: false,
    visualScaleBoost: 20.0,
  },
  {
    name: "Hydra",
    jplCode: 903,
    semiMajorAxisKm: 65_200,
    eccentricity: 0.009,
    inclinationDeg: 0.3,
    nodeDeg: 114.3,
    meanAnomalyDeg: 335.0,
    periodDays: 38.20,
    diameterKm: 40.0,
    diameterLabel: "≈ 40 km equivalent diameter · elongated",
    shape: [1.36, 0.94, 0.78],
    colour: 0xc7cbc7,
    appearance: "hydra",
    tidallyLocked: false,
    visualScaleBoost: 10.0,
  },
]);

function stableSeed(name) {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function compressedOrbitScale(semiMajorAxisKm) {
  // Pluto's moon system is intentionally expanded for interaction readability.
  // Scientific semimajor axes remain preserved in metadata, while the scene
  // uses fixed, well-separated tracks so enlarged moon silhouettes never
  // crowd one another or Pluto during the normal focus view.
  const displayTracks = [
    [19_600, 2.05], // Charon
    [43_200, 3.00], // Styx
    [49_300, 3.95], // Nix
    [58_300, 4.95], // Kerberos
    [65_200, 6.00], // Hydra
  ];
  const exact = displayTracks.find(([axis]) => axis === semiMajorAxisKm);
  if (exact) return exact[1];

  // Defensive interpolation for any future catalogue addition.
  for (let index = 1; index < displayTracks.length; index += 1) {
    const [previousAxis, previousScale] = displayTracks[index - 1];
    const [nextAxis, nextScale] = displayTracks[index];
    if (semiMajorAxisKm <= nextAxis) {
      const t = THREE.MathUtils.clamp(
        (semiMajorAxisKm - previousAxis) / Math.max(1, nextAxis - previousAxis),
        0,
        1,
      );
      return THREE.MathUtils.lerp(previousScale, nextScale, t);
    }
  }
  return displayTracks[displayTracks.length - 1][1];
}

function orbitalSpeedKmS(semiMajorAxisKm, periodDays) {
  return (Math.PI * 2 * semiMajorAxisKm) / (periodDays * 86_400);
}

function descriptionFor(name) {
  const descriptions = {
    Charon: "Pluto's dominant companion: a large ice-rock moon with a dark reddish north polar region, enormous equatorial fracture-and-canyon systems, cratered northern terrain, and smoother southern plains.",
    Styx: "The innermost of Pluto's four small circumbinary moons, a tiny elongated high-albedo icy body observed by New Horizons and known to rotate much faster than synchronous.",
    Nix: "A bright elongated icy moon with an irregular jelly-bean-like outline, old impact terrain, and a distinctive reddish region associated with a large impact feature in enhanced-color New Horizons imagery.",
    Kerberos: "A tiny elongated, likely double-lobed icy moon between Nix and Hydra. New Horizons showed that it is far brighter than pre-flyby expectations and rotates non-synchronously.",
    Hydra: "The outermost known moon of Pluto, an elongated bright icy body with an irregular blocky outline, ancient craters, and regional albedo differences resolved by New Horizons.",
  };
  return descriptions[name];
}

function structureFor(name) {
  const structures = {
    Charon: "Near-spherical ice-rock globe with cratered uplands, broad tectonic chasmata and fractures near the equator, smoother southern plains, and a dark red-brown north polar cap",
    Styx: "Tiny strongly elongated irregular icy body with subdued facets, shallow impacts, and a battered low-gravity silhouette",
    Nix: "Elongated jelly-bean-like icy body with ancient cratered terrain, granular high-albedo regolith, and one reddish impact-related region",
    Kerberos: "Strongly elongated, waist-pinched double-lobed icy body with a compact contact-binary-like silhouette and subdued impact wear",
    Hydra: "Elongated blocky icy body with broad irregular shoulders, at least two major impact depressions, bright regolith, and darker regional terrain",
  };
  return structures[name];
}

function evidenceFor(name) {
  if (name === "Charon") {
    return "New Horizons spacecraft-resolved global/hemispheric imaging";
  }
  if (name === "Nix" || name === "Hydra") {
    return "New Horizons resolved shape and surface imaging";
  }
  return "New Horizons low-resolution resolved shape constraints";
}

export const PLUTO_MOON_PROFILES = Object.freeze(RAW.map((record) => {
  const seed = stableSeed(record.name);
  const physicalRatioRadius = PLUTO_VISUAL_RADIUS * (record.diameterKm / PLUTO_DIAMETER_KM);
  const visualScaleBoost = record.visualScaleBoost ?? 1;
  const visualRadius = physicalRatioRadius * visualScaleBoost;
  const orbitScale = compressedOrbitScale(record.semiMajorAxisKm);
  const periodText = record.periodDays < 10
    ? `${record.periodDays.toFixed(6)} days`
    : `${record.periodDays.toFixed(2)} days`;

  const tumbleMultiplier = {
    Styx: 5.5,
    Nix: 7.5,
    Kerberos: 5.5,
    Hydra: 10.5,
  }[record.name] ?? 1;
  const orbitalAnimationSpeed = THREE.MathUtils.clamp(
    0.026 / Math.sqrt(record.periodDays),
    0.0028,
    0.011,
  );

  return Object.freeze({
    ...record,
    family: record.name === "Charon"
      ? "Major Plutonian moon"
      : "Small Plutonian moon",
    surfaceEvidence: evidenceFor(record.name),
    surfaceStructure: structureFor(record.name),
    surfaceRoughness: record.name === "Charon" ? 0.965 : 0.985,
    albedo: record.name === "Charon" ? 0.38 : 0.65,
    color: record.colour,
    diameterEstimated: record.name !== "Charon",
    orbitScale,
    inclination: THREE.MathUtils.degToRad(record.inclinationDeg),
    node: THREE.MathUtils.degToRad(record.nodeDeg),
    meanAnomaly: THREE.MathUtils.degToRad(record.meanAnomalyDeg),
    retrograde: false,
    speed: orbitalAnimationSpeed,
    seed,
    visualRadius,
    showOrbitGuide: true,
    instanced: false,
    interactionTier: "direct",
    chaoticTumble: !record.tidallyLocked,
    tumbleRate: !record.tidallyLocked
      ? [
        orbitalAnimationSpeed * tumbleMultiplier * (0.34 + seed * 0.08),
        orbitalAnimationSpeed * tumbleMultiplier,
        orbitalAnimationSpeed * tumbleMultiplier * (0.22 + seed * 0.06),
      ]
      : null,
    initialRotation: record.name === "Charon"
      ? [0.04, -0.18, -0.02]
      : [seed * 0.8 - 0.4, seed * 1.4, seed * 0.6 - 0.3],
    orbitalSpeed: `${orbitalSpeedKmS(record.semiMajorAxisKm, record.periodDays).toFixed(3)} km/s around the Pluto-Charon system`,
    orbitSummary: `JPL mean semimajor axis ${record.semiMajorAxisKm.toLocaleString("en-US")} km; sidereal period ${periodText}; eccentricity ${record.eccentricity.toFixed(3)}. The scene expands orbital spacing for readability and collision-free interaction.`,
    description: descriptionFor(record.name),
    dataNote: record.name === "Charon"
      ? "Its rendered diameter is kept at the measured Charon-to-Pluto ratio (about one-half), while the current shared satellite architecture displays the orbit around Pluto rather than physically displacing Pluto around the system barycenter."
      : `Scientific diameter metadata preserves the measured Pluto-relative size. The visible mesh is intentionally enlarged ${visualScaleBoost.toFixed(0)}× for cinematic readability because the real moon is only tens of kilometres wide; orbital spacing is also expanded to prevent visual crowding.`,
  });
}));

export const PLUTO_MOON_COUNT = PLUTO_MOON_PROFILES.length;

import * as THREE from "three";

/**
 * Uranus satellite catalogue.
 *
 * Orbital values follow JPL mean elements where available. The compact scene
 * distances preserve ordering, inclination, eccentricity, and prograde/
 * retrograde direction without attempting to act as a live ephemeris.
 *
 * The current system contains 29 moons: the 28 previously established bodies,
 * the outer designation S/2023 U1, and the inner JWST discovery S/2025 U1.
 */
const RAW = Object.freeze([
  // Major classical moons.
  ["Miranda", 705, 129846, 0.001, 4.4, 100.9, 73.0, 1.413479, 471.6, [1.02, 1.0, 0.98], "miranda", "major"],
  ["Ariel", 701, 190929, 0.001, 0.0, 0.0, 193.5, 2.520379, 1157.8, [1.0, 1.0, 1.0], "ariel", "major"],
  ["Umbriel", 702, 265986, 0.004, 0.1, 174.8, 253.0, 4.144177, 1169.4, [1.0, 1.0, 1.0], "umbriel", "major"],
  ["Titania", 703, 436298, 0.002, 0.1, 29.5, 68.1, 8.705869, 1577.8, [1.0, 1.0, 1.0], "titania", "major"],
  ["Oberon", 704, 583511, 0.002, 0.1, 76.8, 143.6, 13.463237, 1522.8, [1.0, 1.0, 1.0], "oberon", "major"],

  // Inner regular moons and ring shepherds.
  ["Cordelia", 706, 49755, 0.000, 0.2, 1.1, 287.4, 0.3347, 40, [1.22, 0.92, 0.82], "inner-dark", "inner"],
  ["Ophelia", 707, 53765, 0.011, 0.2, 151.6, 213.4, 0.3764, 43, [1.20, 0.93, 0.84], "inner-dark", "inner"],
  ["S/2025 U1", 75052, 57844, 0.039, 4.0, 70.8, 275.6, 0.4201, 10, [1.26, 0.86, 0.78], "inner-dark", "inner"],
  ["Bianca", 708, 59170, 0.006, 2.3, 272.5, 109.1, 0.4347, 51, [1.20, 0.94, 0.84], "inner-dark", "inner"],
  ["Cressida", 709, 61770, 0.004, 1.8, 308.2, 0.5, 0.4639, 80, [1.18, 0.96, 0.88], "inner-dark", "inner"],
  ["Desdemona", 710, 62663, 0.007, 3.1, 283.9, 230.0, 0.4736, 64, [1.19, 0.94, 0.85], "inner-dark", "inner"],
  ["Juliet", 711, 64362, 0.006, 3.0, 141.0, 319.8, 0.4931, 94, [1.16, 0.96, 0.89], "inner-dark", "inner"],
  ["Portia", 712, 66101, 0.004, 2.7, 146.7, 310.1, 0.5132, 135, [1.14, 0.97, 0.91], "inner-dark", "inner"],
  ["Rosalind", 713, 69930, 0.003, 1.7, 330.0, 287.7, 0.5583, 72, [1.18, 0.94, 0.86], "inner-dark", "inner"],
  ["Cupid", 727, 74396, 0.007, 2.0, 31.1, 3.3, 0.6125, 18, [1.24, 0.88, 0.80], "inner-dark", "inner"],
  ["Belinda", 714, 75258, 0.002, 1.4, 96.2, 226.4, 0.6236, 90, [1.17, 0.95, 0.88], "inner-dark", "inner"],
  ["Perdita", 725, 76418, 0.005, 1.6, 270.4, 168.0, 0.6382, 30, [1.22, 0.90, 0.81], "inner-dark", "inner"],
  ["Puck", 715, 86007, 0.009, 1.1, 111.2, 264.1, 0.7618, 162, [1.12, 1.00, 0.91], "puck", "inner"],
  ["Mab", 726, 97737, 0.006, 1.8, 307.8, 250.8, 0.9229, 24, [1.24, 0.88, 0.78], "inner-dark", "inner"],

  // Distant irregular moons.
  ["Francisco", 722, 4275700, 0.144, 146.8, 101.9, 288.4, 267, 22, [1.28, 0.84, 0.76], "outer-neutral", "outer"],
  ["Caliban", 716, 7167000, 0.200, 141.4, 174.9, 241.2, 580, 72, [1.22, 0.88, 0.78], "caliban", "outer"],
  ["S/2023 U1", 75051, 7976600, 0.250, 143.9, 260.2, 101.8, 681, 8, [1.30, 0.82, 0.72], "outer-neutral", "outer"],
  ["Stephano", 720, 7951400, 0.235, 143.6, 193.3, 164.4, 677, 32, [1.26, 0.84, 0.76], "outer-neutral", "outer"],
  ["Trinculo", 721, 8502600, 0.220, 167.1, 196.5, 55.6, 749, 18, [1.30, 0.80, 0.72], "outer-neutral", "outer"],
  ["Sycorax", 717, 12193200, 0.520, 157.0, 267.1, 332.1, 1286, 150, [1.18, 0.90, 0.82], "sycorax", "outer"],
  ["Margaret", 723, 14425000, 0.642, 60.5, 0.9, 115.9, 1655, 20, [1.28, 0.82, 0.74], "outer-reddish", "outer"],
  ["Prospero", 718, 16221000, 0.441, 149.4, 324.5, 197.6, 1974, 50, [1.24, 0.86, 0.76], "outer-neutral", "outer"],
  ["Setebos", 719, 17519800, 0.579, 153.9, 244.7, 148.0, 2215, 47, [1.25, 0.84, 0.75], "outer-reddish", "outer"],
  ["Ferdinand", 724, 20421400, 0.395, 169.2, 223.9, 172.3, 2788, 20, [1.30, 0.80, 0.71], "outer-neutral", "outer"],
]);

const DIRECT_SURFACE_NAMES = new Set([
  "Miranda",
  "Ariel",
  "Umbriel",
  "Titania",
  "Oberon",
  "Cordelia",
  "Ophelia",
  "Puck",
  "Caliban",
  "Sycorax",
]);

const ORBIT_GUIDES = new Set([
  "Miranda",
  "Ariel",
  "Umbriel",
  "Titania",
  "Oberon",
  "Cordelia",
  "Ophelia",
  "Puck",
  "Caliban",
  "Sycorax",
  "S/2023 U1",
  "S/2025 U1",
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
  // Uranus's regular moons and narrow rings occupy the same compact region, so
  // compressing them independently makes moons appear inside the planet or
  // intersect the rings. Use the measured semimajor axis in Uranus equatorial
  // radii throughout the regular system. The distant captured moons begin a
  // separate cinematic compression only beyond that region; atlas mode applies
  // one final uniform scale and therefore preserves every moon's ordering.
  const uranusEquatorialRadiusKm = 25_559;
  if (semiMajorAxisKm <= 100_000) {
    return semiMajorAxisKm / uranusEquatorialRadiusKm;
  }

  // Beyond Mab, the real system quickly expands to hundreds of Uranus radii.
  // Continue monotonically from the true near-ring scale while compressing
  // that large empty space enough for one cinematic atlas view.
  const innerSystemEdge = 100_000 / uranusEquatorialRadiusKm;
  if (semiMajorAxisKm < 700_000) {
    const regularProgress = THREE.MathUtils.clamp(
      (semiMajorAxisKm - 100_000) / (583_511 - 100_000),
      0,
      1,
    );
    return innerSystemEdge + (6.0 - innerSystemEdge) * Math.pow(regularProgress, 0.72);
  }
  const outerProgress = THREE.MathUtils.clamp(
    (semiMajorAxisKm - 700_000) / (20_421_400 - 700_000),
    0,
    1,
  );
  return 6.15 + 2.60 * Math.pow(outerProgress, 0.34);
}

function visualRadiusFor(diameterKm, tier, name) {
  if (tier === "major") {
    return THREE.MathUtils.clamp(0.17 + 0.47 * Math.pow(diameterKm / 1577.8, 0.72), 0.18, 0.64);
  }
  // Cordelia passes only about 272 km inside the Lambda ring. Its ordinary
  // small-moon visibility exaggeration was wider than that real clearance and
  // made the moon cut through the ring. Keep the shepherd compact enough to
  // clear Lambda even at its widest modeled axis; close focus still fills the
  // screen through camera framing and its separate hit target remains usable.
  if (name === "Cordelia") return 0.0045;
  if (name === "Ophelia") return 0.022;
  if (diameterKm >= 120) return 0.105;
  return THREE.MathUtils.clamp(0.028 + 0.070 * Math.pow(diameterKm / 150, 0.52), 0.028, 0.095);
}

function orbitalSpeedKmS(semiMajorAxisKm, periodDays) {
  return (Math.PI * 2 * semiMajorAxisKm) / (periodDays * 86_400);
}

function describeMoon(name, tier) {
  const special = {
    Miranda: "A patchwork icy moon with gigantic fault scarps, coronae, and some of the most extreme known terrain in the Uranian system.",
    Ariel: "A bright ice-rock world crossed by long graben, canyons, and relatively young resurfaced plains.",
    Umbriel: "The darkest major Uranian moon, preserving an old cratered surface and the bright-ringed feature Wunda.",
    Titania: "Uranus's largest moon, fractured by broad valleys and fault systems across an ice-rock crust.",
    Oberon: "A dark, ancient outer major moon marked by large craters, reddish material, and bright impact ejecta.",
    Cordelia: "A tiny inner shepherd moon orbiting just inside Uranus's epsilon ring, helping keep the narrow ring edge sharply confined.",
    Ophelia: "A small inner shepherd moon orbiting just outside Uranus's epsilon ring and working with Cordelia to confine its particles.",
    Puck: "A dark inner moon with an irregular, heavily cratered surface observed by Voyager 2.",
    Caliban: "A small reddish retrograde irregular moon, likely a captured outer Solar System body.",
    Sycorax: "The largest known irregular moon of Uranus, dark and mildly red on a distant retrograde orbit.",
    "S/2025 U1": "A tiny inner moon discovered in 2025 with JWST, orbiting among Uranus's tightly packed ring moons.",
    "S/2023 U1": "A faint distant irregular moon discovered in deep surveys and travelling on a retrograde orbit.",
  };
  if (special[name]) return special[name];
  return tier === "inner"
    ? `${name} is one of Uranus's compact inner moons, closely linked to the planet's narrow ring system.`
    : `${name} is a distant irregular Uranian moon, probably a captured small body whose exact surface remains unresolved.`;
}

export const URANUS_MOON_PROFILES = Object.freeze(RAW.map((row) => {
  const [
    name,
    jplCode,
    semiMajorAxisKm,
    eccentricity,
    inclinationDeg,
    nodeDeg,
    meanAnomalyDeg,
    periodDays,
    diameterKm,
    shape,
    appearance,
    tier,
  ] = row;
  const retrograde = inclinationDeg > 90;
  const seed = stableSeed(name);
  const direct = DIRECT_SURFACE_NAMES.has(name);
  const referenceMapped = ["Miranda", "Ariel", "Umbriel", "Titania", "Oberon"].includes(name);
  const referenceCount = ["Miranda", "Ariel", "Umbriel"].includes(name) ? "One" : "Two";

  return Object.freeze({
    name,
    catalogueName: name,
    jplCode,
    family: tier === "major"
      ? "Major Uranian moon"
      : tier === "inner"
        ? "Inner regular moon"
        : "Outer irregular moon",
    appearance,
    surfaceEvidence: name === "Miranda"
      ? "One user-supplied observation converted into seamless global tectonic terrain without disk stretching"
      : name === "Umbriel"
      ? "One user-supplied observation converted into seamless global terrain without disk or limb stretching"
      : name === "Cordelia"
        ? "Unresolved conservative reconstruction; supplied small-body image used only as artistic shape and regolith guidance"
      : name === "Ophelia"
        ? "Unresolved conservative reconstruction; unrelated supplied Io image excluded from the Uranian surface"
      : referenceMapped
        ? `${referenceCount} user-supplied surface reference${referenceCount === "Two" ? "s" : ""} converted into a continuous global texture`
      : direct
        ? "Resolved-body-informed procedural reconstruction"
        : "Unresolved conservative reconstruction",
    surfaceStructure: name === "Miranda"
      ? "Pale ice-rock patchwork of polygonal coronae, chevron ridges, parallel grooves, deep troughs, gigantic fault scarps, resurfaced plains, and older cratered terrain"
      : name === "Ariel"
      ? "Bright ice-rock crust with long graben, intersecting canyon systems, cratered plains, scarps, and resurfaced terrain"
      : name === "Umbriel"
        ? "Very dark ancient ice-rock crust with densely overlapping impact craters, muted relief, bright-ringed Wunda, and broad ray-like ejecta markings"
      : name === "Cordelia"
        ? "Elongated, subtly bilobed low-gravity ice-rock body with dark granular regolith, shallow impact pits, microcraters, and restrained fractured patches"
      : name === "Ophelia"
        ? "Compact asymmetric dark ice-rock body with a rounded potato-like silhouette, shallow impact pits, fine grooves, rubbly patches, and sparse pale icy flecks"
      : name === "Titania"
        ? "Brown-grey ice-rock crust with dense impact terrain, bright ejecta marks, broad chasmata, graben, and fault scarps"
        : name === "Oberon"
          ? "Ancient grey-mauve ice-rock crust dominated by overlapping craters, bright icy ejecta, dark crater floors, subdued scarps, and a prominent limb mountain"
        : null,
    surfaceRoughness: name === "Miranda"
      ? 0.95
      : name === "Ariel"
      ? 0.96
      : name === "Umbriel"
        ? 0.975
      : name === "Cordelia" || name === "Ophelia"
        ? 0.985
      : name === "Titania"
        ? 0.94
        : name === "Oberon"
          ? 0.97
          : null,
    albedo: name === "Miranda"
      ? 0.32
      : name === "Ariel"
      ? 0.39
      : name === "Umbriel"
        ? 0.19
      : name === "Cordelia"
        ? 0.08
      : name === "Ophelia"
        ? 0.07
      : name === "Titania"
        ? 0.27
        : name === "Oberon"
          ? 0.23
          : null,
    color: tier === "major"
      ? 0x929a9b
      : appearance === "outer-reddish" || appearance === "caliban" || appearance === "sycorax"
        ? 0x6b5750
        : tier === "inner"
          ? 0x5c6669
          : 0x5d6164,
    diameterKm,
    diameterEstimated: !["Miranda", "Ariel", "Umbriel", "Titania", "Oberon", "Puck"].includes(name),
    orbitScale: compressedOrbitScale(semiMajorAxisKm),
    semiMajorAxisKm,
    eccentricity,
    inclination: THREE.MathUtils.degToRad(inclinationDeg),
    inclinationDeg,
    node: THREE.MathUtils.degToRad(nodeDeg),
    meanAnomaly: THREE.MathUtils.degToRad(meanAnomalyDeg),
    periodDays,
    retrograde,
    speed: (retrograde ? -1 : 1) * THREE.MathUtils.clamp(0.020 / Math.sqrt(periodDays), 0.00045, 0.020),
    seed,
    shape,
    initialRotation: name === "Miranda"
      ? [0.03, -0.16, 0.01]
      : name === "Ariel"
      ? [0.04, -0.18, -0.03]
      : name === "Umbriel"
        ? [0.02, -0.10, 0.015]
      : name === "Cordelia"
        ? [0.14, -0.34, 0.08]
      : name === "Ophelia"
        ? [-0.10, 0.28, -0.06]
      : name === "Titania"
        ? [0.03, -0.24, -0.02]
        : name === "Oberon"
          ? [-0.02, 0.30, 0.04]
        : undefined,
    visualRadius: visualRadiusFor(diameterKm, tier, name),
    tidallyLocked: tier !== "outer",
    showOrbitGuide: ORBIT_GUIDES.has(name),
    instanced: !direct,
    interactionTier: tier === "major" ? "direct" : direct ? "notable" : "background",
    orbitalSpeed: `${orbitalSpeedKmS(semiMajorAxisKm, periodDays).toFixed(2)} km/s around Uranus`,
    orbitSummary: `Mean orbit ${(semiMajorAxisKm / 1_000_000).toFixed(semiMajorAxisKm < 1_000_000 ? 3 : 2)} million km from Uranus; period ${periodDays < 20 ? periodDays.toFixed(3) : periodDays.toFixed(0)} days; ${retrograde ? "retrograde" : "prograde"}.`,
    description: describeMoon(name, tier),
    dataNote: name === "Miranda"
      ? "The supplied Miranda disk contributes its pale icy-grey palette and distinctive corona, ridge, scarp, trough, and crater character after circular projection and baked lighting are removed. One seamless 2:1 albedo map and matching multi-scale height and roughness maps create a continuous lighting-responsive surface without UV pinching, radial smearing, or an exposed fallback layer."
      : name === "Ariel"
      ? "The supplied Ariel image is wrapped as a seamless global albedo map and paired with derived height and roughness maps for real lighting-responsive 3D relief. The unseen hemisphere is reconstructed from the same terrain evidence rather than left blank or mirrored as a hard seam."
      : name === "Umbriel"
        ? "The supplied Umbriel disk contributes its observed crater detail and neutral-grey palette after photographed sky, limb shading, and disk projection are removed. A single seamless global albedo, height, and roughness surface then combines that evidence with latitude-aware impact terrain, avoiding the sliding cap, oversized ring craters, UV pinching, and radial smearing of earlier versions."
      : name === "Cordelia"
        ? "Cordelia has not been resolved well enough for a factual global surface map. This explicitly labeled reconstruction uses its measured small-moon identity and epsilon-ring shepherd role, a watertight elongated 3D form, and non-specific dark icy-rock regolith. The supplied small-body image guides only the general battered silhouette and surface character—not claimed geography."
      : name === "Ophelia"
        ? "Ophelia has not been resolved well enough for a factual global surface map. This explicitly labeled reconstruction uses a compact irregular 3D form and non-specific low-albedo icy-rock regolith. The supplied pink volcanic image depicts Jupiter's moon Io, so it is deliberately excluded rather than presented as Ophelia evidence."
      : name === "Titania"
        ? "Both supplied Titania images guide a complete 2:1 global albedo map. Its longitude edges and poles are blended continuously, while separate height and roughness maps plus physically sculpted craters and fault valleys make the moon respond naturally to sunlight without gaps or black-background leakage."
      : name === "Oberon"
        ? "Both supplied Oberon images guide a complete 2:1 global albedo map. Continuous longitude and pole-safe processing removes the photographed black background, while separate height and roughness maps plus dense physical crater relief create an old, sunlight-responsive impact world without gaps or texture pinching."
      : direct
        ? "Resolved or notable body rendered with an individual procedural surface."
        : "Orbit is represented from measured mean elements; unresolved surface and size are conservative estimates.",
  });
}));

export const URANUS_MOON_COUNT = URANUS_MOON_PROFILES.length;

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
  "S/2025 U1",
  "Bianca",
  "Cressida",
  "Desdemona",
  "Juliet",
  "Portia",
  "Rosalind",
  "Cupid",
  "Belinda",
  "Perdita",
  "Mab",
  "Puck",
  "Francisco",
  "Caliban",
  "S/2023 U1",
  "Stephano",
  "Trinculo",
  "Sycorax",
  "Margaret",
  "Prospero",
  "Setebos",
  "Ferdinand",
]);

const ORBIT_GUIDES = new Set([
  "Miranda",
  "Ariel",
  "Umbriel",
  "Titania",
  "Oberon",
  "Cordelia",
  "Ophelia",
  "Bianca",
  "Cressida",
  "Desdemona",
  "Juliet",
  "Portia",
  "Rosalind",
  "Cupid",
  "Belinda",
  "Perdita",
  "Mab",
  "Puck",
  "Francisco",
  "Caliban",
  "Stephano",
  "Trinculo",
  "Sycorax",
  "Margaret",
  "Prospero",
  "Setebos",
  "Ferdinand",
  "S/2023 U1",
  "S/2025 U1",
]);

const MINOR_REFERENCE_NAMES = new Set([
  "S/2025 U1",
  "Bianca",
  "Cressida",
  "Desdemona",
  "Juliet",
  "Portia",
  "Rosalind",
  "Cupid",
  "Belinda",
  "Perdita",
  "Puck",
  "Mab",
  "Francisco",
  "Caliban",
  "Sycorax",
  "S/2023 U1",
  "Stephano",
  "Trinculo",
  "Margaret",
  "Prospero",
  "Setebos",
  "Ferdinand",
]);

const MINOR_REFERENCE_STRUCTURES = Object.freeze({
  Bianca: "Broadly rounded grey-green inner moon with a softly asymmetric shoulder, worn facet, subdued mottling, shallow impacts, and fine carbon-rich ice-rock regolith",
  Cressida: "Compact pale-grey low-gravity ice-rock body with a subtly asymmetric potato-like silhouette, granular regolith, shallow craters, and a worn opposing facet",
  Desdemona: "Nearly spherical dark grey ice-rock body with densely overlapping small craters, subdued grooves, fine corrugation, and mature impact-weathered regolith",
  Juliet: "Strongly elongated and tapered tan-grey ice-rock body with an uneven leading end, battered ridges, shallow craters, and a distinctly asteroid-like silhouette",
  Portia: "Compact pale-grey inner moon with a softly angular potato-like outline, granular regolith, shallow impact pits, and one battered asymmetric shoulder",
  Rosalind: "Rounded charcoal-grey body whose single watertight surface carries broad boulder-like masses, granular regolith, shallow impact pits, and worn connecting ridges",
  Cupid: "Tiny dark contact-binary-like body with two unequal lobes, a pinched waist, fine craters, and a continuous low-albedo ice-rock skin",
  Belinda: "Compact nearly spherical grey inner moon with dense fine grooves, small impact craters, subdued streaking, and a mature weathered ice-rock surface",
  Perdita: "Dark elongated pear-like inner moon with a tapered end, broad worn depression, subdued grooves, and densely weathered low-albedo regolith",
  Puck: "Near-round charcoal-grey inner moon with densely overlapping physical craters, eroded basin rims, granular ejecta, battered facets, and ancient impact-saturated regolith",
  Mab: "Small irregular pale-grey moon with densely fractured ice-rock regolith, one dominant deep impact bowl, rough ridges, numerous pits, and asymmetric battered relief",
  Francisco: "Cold grey distant irregular moon with two connected unequal masses, a broad waist, dense corrugation, shallow impacts, and a single sealed ice-rock surface",
  "S/2023 U1": "Tiny cool blue-grey captured moon with an elongated lozenge-like outline, subdued mottling, sparse pale flecks, and extremely fine impact wear",
  Caliban: "Softly spherical low-albedo captured moon with dusty salmon, muted pink-orange, and mauve-grey mottling, understated craters, and a mature weathered surface",
  Stephano: "Charcoal-grey irregular moon with a broad peanut-like silhouette, unequal shoulders, dense grooves, and an old cratered captured-body surface",
  Trinculo: "Unusually round reference-guided reconstruction with muted warm ochre-grey mottling, shallow old craters, and fine dusty regolith",
  Sycorax: "Elongated ochre-brown captured moon with gently tapered ends, muted olive mineral patches, shallow impact basins, corrugated weathering, and dark stains",
  Margaret: "Very dark compact rubble-rich irregular moon with a rounded diamond-like outline, coarse grains, shallow depressions, and subdued ridges",
  Prospero: "Pale blocky irregular moon with a rounded wedge-like silhouette, granular frost-dusted rock, shallow craters, and darker worn facets",
  Setebos: "Nearly spherical muted mauve-grey irregular moon with densely overlapping impacts, ancient reddish regolith, and low-contrast cratered terrain",
  Ferdinand: "Cold grey irregular moon with a rounded main mass, one asymmetric protruding shoulder, granular impact wear, and a darker fractured region",
});

const MINOR_REFERENCE_NOTES = Object.freeze({
  Bianca: "Bianca has no resolved factual global surface map. The supplied grey-green concept guides only palette and softly rounded character; a seamless material and separately sculpted watertight surface remove its star field and baked illumination.",
  Cressida: "Cressida has not been resolved into a factual global surface map. The supplied image guides its compact pale-grey character; the website uses a seamless low-albedo material and a separately sculpted asymmetric watertight mesh, so every crater and limb shadow responds to the real scene light rather than painted illumination.",
  Desdemona: "Desdemona remains unresolved as a globe. The supplied round cratered concept guides only its dark grey-green regolith character. Dense fine impacts and restrained grooves are reconstructed across a seamless material and near-spherical 3D surface without claiming observed geography.",
  Juliet: "Juliet has no resolved global map. The supplied elongated concept guides the warm-grey palette and asteroid-like silhouette; its tapered leading end, battered ridges, and impact relief are built into one closed mesh, while photographed background, lighting, and stock marks are excluded.",
  Portia: "Portia is not resolved into a factual global map. The supplied pale compact concept guides only this reconstruction's palette and battered small-body character; one watertight asymmetric mesh and seamless maps keep the photographed black background and lighting out of the model.",
  Rosalind: "Rosalind is unresolved at global scale. The supplied concept guides its charcoal regolith and raised-mass character. Those broad bulges are sculpted into one sealed surface instead of overlapping pieces, preventing gaps or moving cracks during rotation.",
  Cupid: "Hubble discovered Cupid as an extremely faint point source, not a resolved body. The supplied contact-binary concept therefore guides only this model's two-lobed identity. The pinched waist and unequal lobes form one watertight mesh beneath a conservative seamless dark regolith reconstruction.",
  Belinda: "Belinda has not been imaged as a resolved global globe. The supplied round concept guides its dense fine-crater and groove character; a near-spherical watertight mesh and seamless low-albedo maps provide lighting-responsive depth without presenting invented markings as observations.",
  Perdita: "Perdita remains unresolved as a globe. Its supplied pear-like concept guides only silhouette and regolith character; the tapered body, broad depression, craters, and lighting-responsive relief are rebuilt as one continuous conservative surface.",
  Puck: "Voyager 2 resolved Puck only at limited detail, not as a complete color globe. The supplied cratered concept guides this reconstruction's dense impact character; several large basins and smaller craters are cut into one closed surface beneath seamless neutral-grey maps.",
  Mab: "Mab is observed as a tiny dark source rather than a resolved global globe. Its supplied cratered concept guides only the irregular outline and dominant-basin identity; the bowl, rim, and smaller impacts are rebuilt as watertight geometry beneath a seamless pale ice-rock material.",
  Francisco: "Francisco has not been resolved into global terrain. The supplied lobed concept guides its connected double-mass silhouette and cold-grey surface character, reproduced as a single watertight mesh so no overlapping parts expose moving cracks.",
  "S/2023 U1": "S/2023 U1 was discovered as a faint moving point source rather than a resolved disk. The supplied concept is treated as artistic guidance only; the tiny elongated body and seamless cool dark regolith do not claim observed geography.",
  Caliban: "Caliban remains unresolved at global scale. The supplied pink-orange disk guides only its softly spherical outline and muted salmon-mauve palette; seamless maps remove the photographed sky, blur, and baked lighting while restrained relief preserves a calm planetary limb.",
  Stephano: "Stephano is unresolved at global scale. The supplied lobed image guides its broad peanut-like outline and grooved charcoal character, reconstructed in one sealed skin with no copied star field or baked lighting.",
  Trinculo: "Trinculo's supplied round warm-toned concept is not spacecraft surface evidence. It guides this conservative model's unusual roundness and muted ochre-grey palette while seamless maps and real crater relief respond to scene lighting.",
  Sycorax: "Sycorax has no resolved factual global map. The supplied elongated concept guides its ochre-brown palette, tapered silhouette, and weathered captured-body character; its circular source-image swirl and stars are deliberately excluded from the seamless reconstruction.",
  Margaret: "Margaret is an unresolved distant irregular moon. The supplied dark rubble-body concept guides only its compact faceted silhouette and coarse regolith character; exact markings are not presented as observations.",
  Prospero: "Prospero lacks a resolved global surface map. The supplied pale blocky concept guides its rounded wedge silhouette and frost-dusted battered character after all text, background, and photographed illumination are excluded.",
  Setebos: "Setebos is unresolved as a globe. The supplied round cratered concept guides its muted mauve-grey palette and impact density, rendered through seamless material maps and a nearly spherical watertight surface without claiming factual crater locations.",
  Ferdinand: "Ferdinand remains unresolved at global scale. Its supplied irregular concept guides the rounded main mass, asymmetric shoulder, and cold-grey regolith; one continuous mesh prevents gaps while preserving real terminator lighting.",
});

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
    Bianca: "A compact inner Uranian moon whose very dark carbon-rich ice-rock surface remains unresolved beyond its size and orbit.",
    Cressida: "A small dark inner moon orbiting within Uranus's densely packed ring-moon region, reconstructed here as a compact battered ice-rock body.",
    Desdemona: "A tightly orbiting inner moon in Uranus's crowded Portia group, represented as a dark, old, finely cratered ice-rock world.",
    Juliet: "An inner Portia-group moon reconstructed with a distinctly elongated, tapered silhouette and impact-worn low-albedo regolith.",
    Portia: "The largest member of its tightly packed inner-moon group, represented as a compact battered ice-rock body near Uranus's rings.",
    Rosalind: "A small inner moon between Portia and Cupid, modeled as a connected irregular ice-rock body with broad worn surface masses.",
    Cupid: "One of the smallest known inner Uranian moons, discovered by Hubble and moving through an exceptionally crowded, dynamically unstable region.",
    Belinda: "A compact inner Uranian moon whose orbit lies extremely close to Cupid's, within the densely packed Portia-group system.",
    Perdita: "A tiny inner moon recovered in Voyager 2 imagery, moving through the dynamically crowded region between Belinda and Puck.",
    Mab: "A tiny dark moon embedded in Uranus's dusty mu ring, likely replenishing that ring when impacts eject surface material.",
    Puck: "A dark inner moon with an irregular, heavily cratered surface observed by Voyager 2.",
    Francisco: "The innermost of Uranus's known distant irregular moons, travelling backward on an inclined captured-body orbit.",
    Caliban: "A small reddish retrograde irregular moon, likely a captured outer Solar System body.",
    Stephano: "A small retrograde irregular moon belonging to the distant Caliban orbital grouping.",
    Trinculo: "A tiny distant retrograde irregular moon following a highly inclined captured-body orbit.",
    Sycorax: "The largest known irregular moon of Uranus, dark and mildly red on a distant retrograde orbit.",
    Margaret: "Uranus's unusual prograde irregular moon, moving on an extremely eccentric and inclined distant orbit.",
    Prospero: "A distant retrograde irregular moon, likely a fragment of an older captured parent body.",
    Setebos: "A distant reddish retrograde irregular moon moving through the outer Uranian satellite system.",
    Ferdinand: "The outermost known Uranian moon in this catalogue, following a distant eccentric retrograde orbit.",
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
      : MINOR_REFERENCE_NAMES.has(name)
        ? "Unresolved reference-guided reconstruction; supplied image contributes artistic palette and terrain character only"
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
      : MINOR_REFERENCE_STRUCTURES[name]
        ? MINOR_REFERENCE_STRUCTURES[name]
      : name === "S/2025 U1"
        ? "Conservative charcoal ice-rock reconstruction with a near-round low-gravity silhouette, shallow impact terrain, muted grooves, and no claimed observed geography"
      : name === "Bianca"
        ? "Dark carbon-rich ice-rock reconstruction with a softly elongated asymmetric outline, battered regolith, shallow craters, and a restrained cool grey-green cast"
      : name === "Mab"
        ? "Tiny dark ice-rock reconstruction with an irregular rounded outline, densely battered regolith, a broad impact depression, and brighter local ejecta"
      : name === "Caliban"
        ? "Low-albedo reddish captured-body reconstruction with an irregular elongated silhouette, ancient cratered regolith, subdued facets, and asymmetric impact wear"
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
      : ["Cressida", "Juliet"].includes(name)
        ? 0.984
      : name === "Desdemona"
        ? 0.988
      : name === "Rosalind"
        ? 0.989
      : name === "Cupid"
        ? 0.991
      : name === "Belinda"
        ? 0.987
      : name === "Portia"
        ? 0.986
      : name === "Perdita"
        ? 0.989
      : name === "Puck"
        ? 0.989
      : name === "Francisco"
        ? 0.988
      : name === "S/2023 U1"
        ? 0.992
      : name === "Stephano"
        ? 0.989
      : name === "Trinculo"
        ? 0.985
      : name === "Sycorax"
        ? 0.990
      : name === "Margaret"
        ? 0.993
      : name === "Prospero"
        ? 0.989
      : name === "Setebos"
        ? 0.988
      : name === "Ferdinand"
        ? 0.990
      : name === "S/2025 U1"
        ? 0.985
      : name === "Bianca"
        ? 0.986
      : name === "Mab"
        ? 0.990
      : name === "Caliban"
        ? 0.987
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
      : name === "S/2025 U1"
        ? null
      : name === "Bianca"
        ? null
      : name === "Mab"
        ? null
      : name === "Caliban"
        ? 0.04
      : MINOR_REFERENCE_STRUCTURES[name]
        ? null
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
      : name === "S/2025 U1"
        ? "S/2025 U1 was discovered by JWST as a faint point source, not a resolved disk. The supplied cratered image therefore guides only this watertight model's charcoal palette and impact-worn character. Its seamless global material and conservative near-round silhouette are explicitly reconstructed, with no markings presented as observed geography."
      : name === "Bianca"
        ? "Voyager 2 established Bianca's presence and orbit but did not provide a factual global surface map; NASA notes that even its size and albedo have not been measured directly. The supplied image guides a muted cool grey-green palette and softly asymmetric outline, while a seamless albedo, height, and roughness set creates physically lit dark carbon-rich regolith without importing the pictured star field."
      : name === "Mab"
        ? "Mab is observed as a tiny dark source within Uranus's mu ring rather than as a resolved globe. The supplied concept guides the cratered silhouette and broad depression, rebuilt as real watertight geometry and seamless material relief. The photographed text, logo, black sky, and exact invented markings are excluded."
      : name === "Caliban"
        ? "Caliban is a distant retrograde irregular moon whose approximately 72 km diameter is inferred from brightness using an assumed very low albedo. The supplied reddish disk guides its softly spherical outline and salmon-mauve mottling only; the seamless conservative reconstruction removes photographed blur and lighting and does not claim resolved terrain."
      : MINOR_REFERENCE_NOTES[name]
        ? MINOR_REFERENCE_NOTES[name]
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

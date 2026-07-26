import * as THREE from "three";

const OFFICIAL_BASE_NAMES = Object.freeze([
  "Mimas", "Enceladus", "Tethys", "Dione", "Rhea", "Titan", "Hyperion", "Iapetus",
  "Phoebe", "Janus", "Epimetheus", "Helene", "Telesto", "Calypso", "Atlas", "Prometheus",
  "Pandora", "Pan", "Ymir", "Paaliaq", "Tarvos", "Ijiraq", "Suttungr", "Kiviuq",
  "Mundilfari", "Albiorix", "Skathi", "Erriapus", "Siarnaq", "Thrymr", "Narvi", "Methone",
  "Pallene", "Polydeuces", "Daphnis", "Aegir", "Bebhionn", "Bergelmir", "Bestla", "Farbauti",
  "Fenrir", "Fornjot", "Hati", "Hyrrokkin", "Kari", "Loge", "Skoll", "Surtur", "Anthe",
  "Jarnsaxa", "Greip", "Tarqeq", "Aegaeon", "Gridr", "Angrboda", "Skrymir", "Gerd",
  "S/2004 S26", "Eggther", "S/2004 S29", "Beli", "S/2004 S27", "Gunnlod", "Thiazzi",
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
  // The IAU Minor Planet Center announced eleven additional Saturnian moons
  // on 26 March 2026: four 2020 discoveries and seven 2023 discoveries.
  ...rangeDesignations(2020, 1, 48),
  ...rangeDesignations(2023, 1, 57),
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
  Ymir: { diameterKm: 18.0, aKm: 23100000, periodDays: 1316.0, shape: [1, 1, 1], appearance: "ymir", family: "Norse irregular moon", retrograde: true },
  Paaliaq: { diameterKm: 22.0, aKm: 15200000, periodDays: 687.0, shape: [1, 1, 1], appearance: "paaliaq", family: "Inuit irregular moon" },
});

const RESOLVED_MINOR_SURFACE_EVIDENCE = Object.freeze({
  Pan: "Cassini close-flyby imagery and NASA ring-moon morphology",
  Daphnis: "Cassini close-flyby imagery and NASA ring-moon montage",
  Atlas: "Cassini close-flyby imagery and NASA Atlas overview",
  Prometheus: "NASA Prometheus overview and Cassini 2015 close-flyby imagery",
  Pandora: "NASA Pandora overview and Cassini close-up imagery",
  Janus: "Cassini Janus close imagery and the user-supplied reference frame",
  Epimetheus: "Cassini Epimetheus close imagery and the user-supplied reference frame",
  Aegaeon: "Limited Cassini resolved silhouette and ring-arc observations",
  Methone: "Cassini Methone imagery and the user-supplied smooth-ellipsoid reference",
  Anthe: "Conservative reconstruction from the user-supplied Anthe image and small ring-moon morphology",
  Pallene: "Cassini small-satellite photomontage and limited resolved imagery",
  Telesto: "Cassini Telesto imagery and the user-supplied reference frame",
  Calypso: "Cassini Calypso imagery and the user-supplied reference frame",
  Helene: "Cassini Helene close imagery and the user-supplied reference frame",
  Polydeuces: "Conservative reconstruction from the user-supplied Polydeuces image",
  Hyperion: "Cassini Hyperion close imagery and the user-supplied reference frame",
  Phoebe: "Cassini Phoebe flyby imagery and the user-supplied reference frame",
  Ymir: "User-supplied silhouette and surface reference, combined with NASA physical and orbital constraints",
  Paaliaq: "User-supplied rendered surface reference, combined with published orbital and size constraints",
});

const RESOLVED_MINOR_SURFACE_STRUCTURE = Object.freeze({
  Pan: "Irregular icy core wrapped by a broad equatorial skirt of accreted ring material",
  Daphnis: "Small irregular ring moon with a restrained equatorial ridge and dusty icy coating",
  Atlas: "Pointed flying-saucer body with a thick, smooth equatorial ridge of ring debris",
  Prometheus: "Sweet-potato-shaped porous ice body with pockmarked terrain and several large craters",
  Pandora: "Potato-shaped moon coated in fine icy dust, with softened craters, grooves, and low ridges",
  Janus: "Blocky, battered co-orbital moon with a broad prominent basin, many smaller craters, and rough icy highlands",
  Epimetheus: "Lumpy dirty-ice body with a large steep-walled crater, a battered left edge, and densely cratered broken terrain",
  Aegaeon: "Tiny elongated ring-arc moon represented conservatively from its Cassini silhouette",
  Methone: "Very smooth, pale egg-shaped moon with an almost pristine surface and a muted darker cap region",
  Anthe: "Tiny rugged irregular moon with a dark coarse surface, angular facets, and a couple of shallow basins",
  Pallene: "Small smooth icy ellipsoid with subtle albedo mottling and subdued impact relief",
  Telesto: "Very bright smooth teardrop-like Trojan moon with a swollen right lobe and a ragged broken left margin",
  Calypso: "Long flattened Trojan moon with a smooth bright upper face, blunt ends, and a darker scuffed lower-right underside",
  Helene: "Bright rounded moon with dramatic fan-like flow streaks across the right half and a smaller lower lobe",
  Polydeuces: "Small upright potato-shaped Trojan moon with subdued basins, a rough pebbled surface, and a broader left shoulder",
  Hyperion: "Tall sponge-like moon covered in dense pitting, with large deep-walled basins and a gnawed-away right edge",
  Phoebe: "Dark captured irregular moon with two giant shadowed craters near the crown, many smaller pits, and a brighter sunlit right flank",
  Ymir: "Asymmetric contact-binary-like rocky body with a high rounded left crown, a saddle-shaped upper neck, a smaller right lobe, and a heavily broken lower surface",
  Paaliaq: "Compact elongated rocky body with a broad rounded left shoulder, a subdued broken crown, a gently tapered right end, and a rounded underside",
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

/**
 * These distant moons are too small for present-day spacecraft imagery to
 * provide global shape or texture maps. User-supplied visual references promote
 * them from the efficient instanced atlas into individual 3D meshes. Orbital
 * placement still comes from the existing catalogue path; only presentation,
 * interaction, and estimated sizes are specialized here.
 */
const REFERENCE_IRREGULAR_PROFILES = Object.freeze({
  Tarvos: Object.freeze({
    diameterKm: 15,
    color: 0xaeb8ca,
    shape: [1, 1, 1],
    visualRadius: 0.071,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.05, -0.32, -0.04],
    surfaceRoughness: 0.95,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Rounded wedge-shaped rock with a broad pale face, broken dark crown, shallow pits, and scattered impact craters",
    description: "Tarvos is a distant prograde member of Saturn's Gallic group. This interactive body follows the supplied pale, cratered, broken-crown reference while remaining an explicitly artistic reconstruction.",
    dataNote: "Tarvos has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Ijiraq: Object.freeze({
    diameterKm: 12,
    color: 0xaab6d0,
    shape: [1, 1, 1],
    visualRadius: 0.068,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.26, -0.10],
    surfaceRoughness: 0.94,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Flattened elongated potato-shaped body with a cold blue-gray regolith, worn bowls, granular plains, and cratered margins",
    description: "Ijiraq is a small prograde member of Saturn's Inuit group. Its flattened blue-gray, pitted form is rebuilt from the supplied visual direction for close interactive inspection.",
    dataNote: "Ijiraq has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Suttungr: Object.freeze({
    diameterKm: 7,
    color: 0xb9aa91,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.18, -0.02],
    surfaceRoughness: 0.96,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Compact oblate dome with a rounded ivory crown, flatter underside, dark regolith stains, fine pitting, and worn craters",
    description: "Suttungr is a tiny retrograde member of Saturn's Norse group. The reconstruction emphasizes the supplied compact cap-like silhouette and pale, ancient cratered regolith.",
    dataNote: "Suttungr has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Kiviuq: Object.freeze({
    diameterKm: 16,
    color: 0xa8aaa0,
    shape: [1, 1, 1],
    visualRadius: 0.072,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.06, -0.04, -0.06],
    surfaceRoughness: 0.95,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Offset pear-and-heart-shaped mass with an upper notch, uneven lobes, pale gray-green stone, scars, grooves, and small craters",
    description: "Kiviuq is a prograde irregular moon in Saturn's Inuit group. Its asymmetric pear-like volume and scarred gray-green terrain are reconstructed from the supplied reference.",
    dataNote: "Kiviuq has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Mundilfari: Object.freeze({
    diameterKm: 7,
    color: 0x656565,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.22, 0.03],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Tall graphite-gray rubble body with two unequal crown shoulders, a shallow saddle, dense fluted wrinkles, pits, and worn craters",
    description: "Mundilfari is a small retrograde moon in Saturn's Norse group. Its upright twin-shouldered silhouette and densely wrinkled dark regolith follow the supplied visual reference.",
    dataNote: "Mundilfari has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Albiorix: Object.freeze({
    diameterKm: 32,
    color: 0xc4a88f,
    shape: [1, 1, 1],
    visualRadius: 0.080,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.05, -0.02, -0.08],
    surfaceRoughness: 0.93,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Warm beige asymmetric contact-like body with a massive rounded lower lobe, a pinched saddle, raised upper-right lobe, and cratered regolith",
    description: "Albiorix is the largest named member of Saturn's Gallic group. The interactive reconstruction uses the supplied warm, two-lobed reference to create a distinctly asymmetric 3D body.",
    dataNote: "Albiorix has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Skathi: Object.freeze({
    diameterKm: 8,
    color: 0xc2b59f,
    shape: [1, 1, 1],
    visualRadius: 0.065,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.12, -0.05],
    surfaceRoughness: 0.96,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Pale irregular egg-and-wedge body with a battered crown, dusty plains, small pits, and worn impact craters",
    description: "Skathi is a small retrograde member of Saturn's Norse group. Its pale broken-crown silhouette and cratered dusty regolith follow the supplied visual reference.",
    dataNote: "Skathi has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Erriapus: Object.freeze({
    diameterKm: 10,
    color: 0xb2aa95,
    shape: [1, 1, 1],
    visualRadius: 0.067,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.10, -0.08],
    surfaceRoughness: 0.95,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Sloped compact boulder with a pale rounded crown, broad smoother face, broken charcoal flank, pits, and shallow basins",
    description: "Erriapus is a distant prograde moon in Saturn's Gallic group. Its pale sloped boulder form and contrasting fractured highlands are reconstructed from the supplied image.",
    dataNote: "Erriapus has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Siarnaq: Object.freeze({
    diameterKm: 40,
    color: 0xb9b2c2,
    shape: [1, 1, 1],
    visualRadius: 0.084,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.18, -0.02],
    surfaceRoughness: 0.94,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Large nearly round lavender-gray irregular moon with a subtly flattened pole, dark cratered highlands, overlapping basins, and dense pitting",
    description: "Siarnaq is one of Saturn's larger Inuit-group irregular moons. The reconstruction emphasizes the supplied cool lavender-gray surface and densely cratered, nearly spherical body.",
    dataNote: "Siarnaq has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Thrymr: Object.freeze({
    diameterKm: 7,
    color: 0xb9bcae,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.20, -0.03],
    surfaceRoughness: 0.94,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Compact pale gray-green rounded body with restrained facets, fine pits, worn small craters, and one broad ringed basin",
    description: "Thrymr is a tiny retrograde member of Saturn's Norse group. Its compact pale form and subtle circular basin marking follow the supplied reference.",
    dataNote: "Thrymr has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Narvi: Object.freeze({
    diameterKm: 7,
    color: 0xa7abb2,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.06, -0.04],
    surfaceRoughness: 0.97,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Blocky silver-gray boulder with a broken left scarp, rounded right shoulder, deep front-facing basin, fractured ridges, and many pits",
    description: "Narvi is a small retrograde moon in Saturn's Norse group. Its blocky battered volume and prominent dark basin are rebuilt from the supplied visual direction.",
    dataNote: "Narvi has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Aegir: Object.freeze({
    diameterKm: 6,
    color: 0x82766e,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.05, -0.04, -0.10],
    surfaceRoughness: 0.99,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Tall jagged rubble shard with a narrower base, broken crown, sharp scarps, deep cavities, coarse beige-gray rock, and dense pitting",
    description: "Aegir is a tiny retrograde moon in Saturn's Norse group. Its steep jagged outline and deeply eroded rubble surface follow the supplied reference.",
    dataNote: "Aegir has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Bebhionn: Object.freeze({
    diameterKm: 6,
    color: 0xb8b6b2,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.08, -0.02],
    surfaceRoughness: 0.93,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Squat light-gray rounded block with a broad oval face, flattened underside, shallow crown groove, subdued marbling, and sparse pits",
    description: "Bebhionn is a small prograde member of Saturn's Gallic group. Its low rounded boulder form and restrained gray marbling are reconstructed from the supplied reference.",
    dataNote: "Bebhionn has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Bergelmir: Object.freeze({
    diameterKm: 6,
    color: 0xc3c5c7,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.05, -0.08],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Bright eroded wedge-like body with an irregular bitten flank, dense overlapping crater bowls, deep dark floors, and shattered scarps",
    description: "Bergelmir is a tiny retrograde moon in Saturn's Norse group. The reconstruction follows the supplied bright, intensely cratered and eroded silhouette while remaining a closed 3D body.",
    dataNote: "Bergelmir has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Bestla: Object.freeze({
    diameterKm: 7,
    color: 0x3e4246,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.14, -0.04],
    surfaceRoughness: 0.99,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Dark upright porous rubble body with an uneven crown, immense cavern-like impact bowls, pale eroded rims, and dense pitting",
    description: "Bestla is a tiny retrograde moon in Saturn's Norse group. Its dark porous, skull-like rubble form is rebuilt with deep but fully closed impact cavities for safe inspection from every angle.",
    dataNote: "Bestla has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Farbauti: Object.freeze({
    diameterKm: 5,
    color: 0x4b4d50,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.12, -0.05],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Charcoal double-lobed pebble with a restrained waist, uneven shoulders, dusty ripples, and subdued impact pits",
    description: "Farbauti is a small retrograde member of Saturn's Norse group. The reconstruction follows the supplied almost-black, two-lobed rock while preserving faint terrain detail in sunlight.",
    dataNote: "Farbauti has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Fenrir: Object.freeze({
    diameterKm: 4,
    color: 0xa7a9ac,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.08, -0.02],
    surfaceRoughness: 0.95,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Near-spherical high-contrast cratered body with bright highlands, dark basins, worn rims, and dense overlapping impacts",
    description: "Fenrir is a very small retrograde Norse-group moon. Its reference-directed globe combines bright scarred highlands with broad dark basins and dense geometric crater relief.",
    dataNote: "Fenrir has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Fornjot: Object.freeze({
    diameterKm: 6,
    color: 0x737579,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.16, -0.04],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Tall graphite block with a broad rounded face, raised upper shoulder, subtle waist, fine wrinkles, and worn pits",
    description: "Fornjot is a distant retrograde member of Saturn's Norse group. Its tall, shoulder-raised boulder silhouette and densely wrinkled graphite regolith follow the supplied reference.",
    dataNote: "Fornjot has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Hati: Object.freeze({
    diameterKm: 6,
    color: 0x808286,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.10, -0.06],
    surfaceRoughness: 0.97,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Flattened cool-gray slab with a clipped crown, thick rounded lower mass, dense fine ripples, and shallow crater scars",
    description: "Hati is a small retrograde moon in Saturn's Norse group. The reconstruction emphasizes the supplied flattened slab-like body and fine, evenly weathered gray terrain.",
    dataNote: "Hati has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Hyrrokkin: Object.freeze({
    diameterKm: 8,
    color: 0x7f5148,
    shape: [1, 1, 1],
    visualRadius: 0.065,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.06, -0.02],
    surfaceRoughness: 0.97,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Rust-red battered globe with two dominant deep basins, broken scarps, overlapping bowls, and iron-dark crater floors",
    description: "Hyrrokkin is a retrograde Norse-group moon. Its unusual rusty reference appearance is recreated across a heavily cratered closed globe with two dominant geometric basins.",
    dataNote: "Hyrrokkin has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Kari: Object.freeze({
    diameterKm: 7,
    color: 0xc3c4c1,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.10, -0.04],
    surfaceRoughness: 0.90,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Pale softly rounded pebble with a broad smooth crown, gently flattened base, faint mottling, and sparse shallow pits",
    description: "Kari is a small retrograde Norse-group moon. Its supplied pale, gently rounded appearance is translated into a softly weathered 3D pebble rather than a sharply faceted rock.",
    dataNote: "Kari has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Loge: Object.freeze({
    diameterKm: 6,
    color: 0xb8b8b4,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.12, -0.04],
    surfaceRoughness: 0.96,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Pale asymmetric oval body with a slightly pinched lobe, two major bowl-shaped basins, worn ejecta, and many smaller pits",
    description: "Loge is a tiny retrograde moon in Saturn's Norse group. The reconstruction follows the supplied pale asymmetric form and its pair of prominent basin-like depressions.",
    dataNote: "Loge has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Skoll: Object.freeze({
    diameterKm: 6,
    color: 0x303237,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.12, -0.04],
    surfaceRoughness: 0.99,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Near-black twin-shouldered block with a deep central furrow, fluted regolith, worn ridges, pits, and shallow impact bowls",
    description: "Skoll is a tiny retrograde Norse-group moon. Its very dark, cleft twin-shouldered form follows the supplied reference while retaining readable relief under Saturn-system sunlight.",
    dataNote: "Skoll has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Surtur: Object.freeze({
    diameterKm: 6,
    color: 0x53585a,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.18, -0.05],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Dark leaning boulder with an asymmetric crown, broad worn panels, wrinkled terrain, pale scuffs, and shallow pits",
    description: "Surtur is a small retrograde member of Saturn's Norse group. The reconstruction follows the supplied graphite-gray leaning boulder and its worn, subtly cratered surface.",
    dataNote: "Surtur has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Jarnsaxa: Object.freeze({
    diameterKm: 6,
    color: 0xc9bda4,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.08, -0.02],
    surfaceRoughness: 0.94,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Warm ivory rounded globe with a subtly polygonal outline, dusty plains, fine fractures, dark battered highlands, and many small craters",
    description: "Jarnsaxa is a tiny retrograde Norse-group moon. Its pale rounded form and dense small-scale impact terrain are rebuilt from the supplied visual reference.",
    dataNote: "Jarnsaxa has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Greip: Object.freeze({
    diameterKm: 6,
    color: 0x67696b,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.10, -0.06],
    surfaceRoughness: 0.99,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Dark granular diamond-shaped rubble body with a broad side basin, coarse regolith, pebble-like relief, scarps, and dense pitting",
    description: "Greip is a small retrograde moon in Saturn's Norse group. Its compact rhomboid rubble form and coarse granular surface follow the supplied reference.",
    dataNote: "Greip has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Tarqeq: Object.freeze({
    diameterKm: 7,
    color: 0xa56f4d,
    shape: [1, 1, 1],
    visualRadius: 0.064,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.01, -0.02, 0],
    surfaceRoughness: 0.94,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Warm ochre upright stone with paired brow ridges and closed-eye grooves, a central nose-like ridge, cheek bulges, and a shallow mouth-like basin",
    description: "Tarqeq is a prograde member of Saturn's Inuit group. Geological ridges and basins recreate the striking face-like pattern seen in the supplied image without depicting a literal human sculpture.",
    dataNote: "Tarqeq has not been globally resolved at this detail. The face-like arrangement, colour, terrain, and silhouette are reference-directed artistic choices rather than measured topography.",
  }),
  Gridr: Object.freeze({
    diameterKm: 4,
    color: 0x9f5d43,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.10, -0.04],
    surfaceRoughness: 0.97,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Iron-red elongated contact-like rock with a small blunt head, broad rear mass, dusty scarps, overlapping bowls, and dense shallow craters",
    description: "Gridr is a tiny retrograde Norse-group moon. Its rust-toned, stretched contact-rock silhouette and cratered plains follow the supplied visual reference.",
    dataNote: "Gridr has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Angrboda: Object.freeze({
    diameterKm: 4,
    color: 0x93a17b,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.12, -0.05],
    surfaceRoughness: 0.95,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Gray-green mineral wedge with a tapered snout, raised shoulder, mottled dusty regolith, shallow bowls, and battered ridges",
    description: "Angrboda is a tiny retrograde Norse-group satellite. Its tapered gray-green mineral-rock body is reconstructed from the supplied reference.",
    dataNote: "Angrboda has not been globally resolved at this detail. Its green tint represents artistic mineral coloration, not vegetation or measured global colour.",
  }),
  Skrymir: Object.freeze({
    diameterKm: 4,
    color: 0x4e535b,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.18, -0.04],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Dark angular upright column with an asymmetric waist, clipped planes, blue-gray dust, shallow scars, and sparse pits",
    description: "Skrymir is a tiny retrograde member of Saturn's Norse group. Its charcoal upright block and worn planar terrain follow the supplied image.",
    dataNote: "Skrymir has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Gerd: Object.freeze({
    diameterKm: 4,
    color: 0xadb1b7,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.08, -0.02],
    surfaceRoughness: 0.92,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Silver-gray heart-like boulder with twin upper lobes, a soft central notch, cloudy mottling, and restrained shallow pitting",
    description: "Gerd is a tiny retrograde Norse-group moon. Its softly rounded twin-lobed silver form follows the supplied visual direction.",
    dataNote: "Gerd has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  "S/2004 S26": Object.freeze({
    diameterKm: 4,
    color: 0x79736a,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.06, -0.02],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Near-round ancient body with a heavily scarred crater field, broad trench-like scarp belt, pitted highlands, and dark compacted floors",
    description: "S/2004 S26 is a provisional Saturnian moon. Its densely battered globe and sweeping scarred belt are rebuilt from the supplied visual reference.",
    dataNote: "S/2004 S26 has not been globally resolved at this detail. The displayed terrain and exact shape are reference-directed rather than measured topography.",
  }),
  Eggther: Object.freeze({
    diameterKm: 4,
    color: 0xc9c9c5,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.10, -0.04],
    surfaceRoughness: 0.96,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Pale closed bowl-like body with a scalloped crown, broken-looking but sealed scarps, deep impact bowls, bright rims, and dense small pits",
    description: "Eggther is a tiny retrograde moon in Saturn's Norse group. Its unusual bowl-like battered silhouette is reconstructed as a fully closed volume from the supplied image.",
    dataNote: "Eggther has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  "S/2004 S29": Object.freeze({
    diameterKm: 4,
    color: 0xb9b9b5,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.10, -0.05],
    surfaceRoughness: 0.97,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Pale irregular basin shard with a blunt end, one dominant shadowed bowl, a battered crown, scattered crater rims, and compact gray regolith",
    description: "S/2004 S29 is a provisional Saturnian moon. Its irregular pale body and dominant end basin follow the supplied reference while remaining a sealed 3D object.",
    dataNote: "S/2004 S29 has not been globally resolved at this detail. The displayed terrain and exact shape are reference-directed rather than measured topography.",
  }),
  Beli: Object.freeze({
    diameterKm: 4,
    color: 0x4c4037,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.12, -0.04],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Dark brown double-lobed body with a broad waist groove, worn fluted terrain, uneven shoulders, dust patches, and shallow pits",
    description: "Beli is a tiny retrograde Norse-group moon. Its dark pinched double-lobed body follows the supplied visual reference.",
    dataNote: "Beli has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  "S/2004 S27": Object.freeze({
    diameterKm: 3,
    color: 0xe1e1dc,
    shape: [1, 1, 1],
    visualRadius: 0.061,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.04, -0.02],
    surfaceRoughness: 0.88,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Very pale smooth oblate dome with powdery ice regolith, a gently flattened underside, subtle mottling, and sparse shallow pits",
    description: "S/2004 S27 is a provisional Saturnian satellite. Its restrained pearl-white, softly rounded body follows the supplied reference.",
    dataNote: "S/2004 S27 has not been globally resolved at this detail. The displayed terrain and exact shape are reference-directed rather than measured topography.",
  }),
  Gunnlod: Object.freeze({
    diameterKm: 4,
    color: 0xd8d8d5,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.06, -0.03],
    surfaceRoughness: 0.96,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Bright rounded block with a deeply cut but sealed lower scarp, densely pitted ice-rock, dark crater floors, and chipped pale rims",
    description: "Gunnlod is a tiny retrograde Norse-group moon. Its brilliant battered block and intensely cratered surface follow the supplied visual reference.",
    dataNote: "Gunnlod has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Thiazzi: Object.freeze({
    diameterKm: 4,
    color: 0x50545a,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.16, -0.05],
    surfaceRoughness: 0.98,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Dark triangular shard with clipped planes, a high angular crown, graphite regolith, silvery abrasion, and sparse shallow pits",
    description: "Thiazzi is a tiny retrograde Norse-group moon. Its charcoal wedge silhouette and broad worn planes are reconstructed from the supplied image.",
    dataNote: "Thiazzi has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  "S/2004 S17": Object.freeze({
    diameterKm: 4,
    color: 0xaaa8a5,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.02, -0.06, -0.02],
    surfaceRoughness: 0.92,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Quiet near-spherical gray moon with soft dusty mottling, sparse medium craters, numerous tiny pits, and gently worn plains",
    description: "S/2004 S17 is a provisional Saturnian satellite. Its restrained gray cratered globe follows the supplied visual reference.",
    dataNote: "S/2004 S17 has not been globally resolved at this detail. The displayed terrain and exact shape are reference-directed rather than measured topography.",
  }),
  Alvaldi: Object.freeze({
    diameterKm: 5,
    color: 0xa59e69,
    shape: [1, 1, 1],
    visualRadius: 0.063,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.04, -0.12, -0.04],
    surfaceRoughness: 0.95,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Muted olive block with two raised crown shoulders, a soft notch, dusty mineral mottling, worn ridges, and scattered shallow pits",
    description: "Alvaldi is a tiny retrograde Norse-group moon. Its olive-tinted crown-block form follows the supplied reference as mineral coloration rather than vegetation.",
    dataNote: "Alvaldi has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
  Geirrod: Object.freeze({
    diameterKm: 4,
    color: 0xcab7a0,
    shape: [1, 1, 1],
    visualRadius: 0.062,
    instanced: false,
    interactionTier: "direct",
    initialRotation: [0.03, -0.08, -0.03],
    surfaceRoughness: 0.97,
    surfaceEvidence: "User-supplied visual reference; unresolved moon reconstructed as an artistic 3D interpretation",
    surfaceStructure: "Pale battered wedge with dense impact pitting, three prominent deep bowls, near-black floors, bright rims, scarps, and rusty stains",
    description: "Geirrod is a tiny retrograde moon in Saturn's Norse group. Its pale high-contrast cratered wedge is rebuilt from the supplied visual reference.",
    dataNote: "Geirrod has not been globally resolved at this detail. The displayed colour, terrain, and silhouette are reference-directed rather than measured topography.",
  }),
});

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
  const referenceProfile = REFERENCE_IRREGULAR_PROFILES[name];

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
    // Four closed low-poly rock families make the unresolved catalogue look
    // volumetric without replacing the efficient InstancedMesh renderer.
    denseVariant: Math.floor(stableSeed(`${name}:dense-shape`) * 4),
    visualRadius: 0.017 + Math.pow(diameterKm / 8.05, 0.5) * 0.018,
    tidallyLocked: false,
    showOrbitGuide: false,
    instanced: true,
    interactionTier: "background",
    orbitalSpeed: "Slow irregular orbit around Saturn",
    orbitSummary: `Compressed visual reconstruction of Saturn's ${family.toLowerCase()} population.`,
    description: `${name} is a tiny unresolved Saturnian satellite represented as a family-based irregular body. Its exact surface is unknown.`,
    dataNote: "Officially confirmed satellite; visible shape and colour are a conservative family reconstruction.",
    ...(referenceProfile ?? {}),
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
    color: name === "Titan" ? 0xc98d42 : name === "Iapetus" ? 0x8a8074 : name === "Phoebe" ? 0x514e4a : name === "Ymir" ? 0x8f887e : name === "Paaliaq" ? 0x86766e : 0xb8b5ae,
    diameterKm: data.diameterKm,
    diameterEstimated: ["Ymir", "Paaliaq"].includes(name),
    orbitScale,
    semiMajorAxisKm: data.aKm,
    eccentricity: name === "Hyperion" ? 0.104 : name === "Phoebe" ? 0.163 : name === "Ymir" ? 0.30 : name === "Paaliaq" ? 0.36 : 0.006,
    inclination: THREE.MathUtils.degToRad(name === "Phoebe" ? 175.2 : name === "Ymir" ? 172.0 : name === "Paaliaq" ? 46.0 : name === "Iapetus" ? 15.5 : 0.6),
    inclinationDeg: name === "Phoebe" ? 175.2 : name === "Ymir" ? 172.0 : name === "Paaliaq" ? 46.0 : name === "Iapetus" ? 15.5 : 0.6,
    node: seed * Math.PI * 2,
    meanAnomaly: stableSeed(`${name}:phase`) * Math.PI * 2,
    periodDays: data.periodDays,
    retrograde,
    speed: (retrograde ? -1 : 1) * THREE.MathUtils.clamp(0.020 / Math.sqrt(data.periodDays), 0.0005, 0.015),
    seed,
    shape: data.shape ?? [1, 1, 1],
    visualRadius: THREE.MathUtils.clamp(0.06 + 0.58 * Math.pow(data.diameterKm / 5149.5, 0.68), 0.055, 0.64),
    tidallyLocked: !["Hyperion", "Phoebe", "Ymir", "Paaliaq"].includes(name),
    showOrbitGuide: ["Mimas", "Enceladus", "Tethys", "Dione", "Rhea", "Titan", "Hyperion", "Iapetus", "Phoebe", "Ymir", "Paaliaq"].includes(name),
    instanced: false,
    interactionTier: "direct",
    atmosphere: data.atmosphere,
    initialRotation: name === "Pan"
      ? [-0.10, 0.02, -0.015]
      : name === "Atlas"
        ? [0.14, 0.10, -0.06]
        : name === "Daphnis"
          ? [0.20, -0.18, -0.34]
          : name === "Prometheus"
            ? [0.12, -0.16, -0.66]
            : name === "Pandora"
              ? [0.16, 0.05, -0.10]
              : name === "Janus"
                ? [0.06, -0.22, -0.04]
                : name === "Epimetheus"
                  ? [0.04, -0.14, -0.02]
                  : name === "Methone"
                    ? [0.02, 0.08, 0.00]
                    : name === "Anthe"
                      ? [0.10, -0.18, -0.04]
                      : name === "Telesto"
                        ? [0.00, -0.02, 0.00]
                        : name === "Calypso"
                          ? [0.02, -0.12, -0.02]
                          : name === "Helene"
                            ? [0.00, 0.02, -0.02]
                            : name === "Polydeuces"
                              ? [0.04, -0.08, 0.00]
                              : name === "Hyperion"
                                ? [0.00, -0.16, -0.03]
                                : name === "Phoebe"
                                  ? [0.02, -0.22, -0.02]
                                  : name === "Ymir"
                                    ? [0.03, -0.08, -0.025]
                                    : name === "Paaliaq"
                                      ? [0.05, -0.14, -0.02]
                                      : name === "Titan"
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
                  : RESOLVED_MINOR_SURFACE_EVIDENCE[name],
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
                  : RESOLVED_MINOR_SURFACE_STRUCTURE[name],
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
                  : name === "Ymir"
                    ? 0.93
                    : name === "Paaliaq"
                      ? 0.91
                      : undefined,
    orbitalSpeed: `${((Math.PI * 2 * data.aKm) / (data.periodDays * 86400)).toFixed(2)} km/s around Saturn`,
    orbitSummary: name === "Ymir"
      ? "Mean orbit approximately 23.1 million km from Saturn; period about 1,316 Earth days."
      : name === "Paaliaq"
        ? "Mean orbit approximately 15.2 million km from Saturn; period about 687 Earth days."
        : `Mean orbit approximately ${(data.aKm / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })} thousand km from Saturn; period ${data.periodDays.toFixed(data.periodDays < 10 ? 3 : 1)} days.`,
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
              : name === "Methone"
                ? "An exceptionally smooth, pale ring moon whose egg-like shape appears softly polished by fine icy material in Saturn's arc environment."
              : name === "Ymir"
                ? "A small dark captured moon in Saturn's distant Norse group, travelling on an eccentric retrograde orbit."
                : name === "Paaliaq"
                  ? "A small reddish-gray irregular moon in Saturn's Inuit group, travelling on a distant eccentric prograde orbit."
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
                  : name === "Methone"
                    ? "Cassini constrains Methone's unusually smooth ellipsoidal shape. The supplied pale reference guides a neutral seamless ice wrap while sunlight, not baked photographic shadow, forms its day and night sides."
                  : name === "Ymir"
                    ? "The supplied reference image drives the silhouette loft and a cleaned seamless colour, height, and roughness wrap. It is a reference-directed reconstruction rather than a claim that Ymir has been globally imaged at this resolution."
                    : name === "Paaliaq"
                      ? "The supplied reference image drives the surface palette and a cleaned seamless colour, height, and roughness wrap. The body is sculpted as a compact 3D asteroid rather than extruded from the image silhouette; it remains a reference-directed reconstruction rather than a claim that Paaliaq has been globally imaged at this resolution."
                      : "Resolved or constrained by spacecraft observations and established orbital measurements.",
  });
}

export const SATURN_MOON_PROFILES = Object.freeze(
  SATURN_OFFICIAL_MOON_NAMES.map((name, index) => (
    DIRECT_NAMES.has(name) ? createResolvedProfile(name) : createBackgroundProfile(name, index)
  )),
);

export const SATURN_MOON_COUNT = SATURN_MOON_PROFILES.length;

if (SATURN_MOON_COUNT !== 285) {
  throw new Error(`Saturn catalogue integrity error: expected 285 moons, got ${SATURN_MOON_COUNT}.`);
}

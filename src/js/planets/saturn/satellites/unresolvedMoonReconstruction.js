/**
 * Visual reconstruction rules for Saturn's provisionally designated moons.
 *
 * These bodies have orbital detections but no resolved global surface images.
 * The texture names below therefore point to existing artistic albedo maps in
 * this project, not photographs of the provisional moon receiving the map.
 * A stable name hash makes the assignment repeatable across page loads.
 */

export const SATURN_UNRESOLVED_TEXTURE_POOL = Object.freeze([
  "Ymir",
  "Paaliaq",
  "Tarvos",
  "Ijiraq",
  "Suttungr",
  "Kiviuq",
  "Mundilfari",
  "Albiorix",
  "Skathi",
  "Erriapus",
  "Siarnaq",
  "Thrymr",
  "Narvi",
  "Aegir",
  "Bebhionn",
  "Bergelmir",
  "Bestla",
  "Farbauti",
  "Fenrir",
  "Fornjot",
  "Hati",
  "Hyrrokkin",
  "Kari",
  "Loge",
  "Skoll",
  "Surtur",
  "Jarnsaxa",
  "Greip",
  "Gridr",
  "Angrboda",
  "Skrymir",
  "Gerd",
  "Eggther",
  "Beli",
  "Gunnlod",
  "Thiazzi",
  "Alvaldi",
  "Geirrod",
]);

/**
 * Twelve closed silhouette families provide more variety than the four orbital
 * InstancedMesh previews. They are applied only to the inspected moon, so the
 * additional geometry does not reduce Saturn-atlas performance.
 */
export const SATURN_UNRESOLVED_SHAPE_FAMILIES = Object.freeze([
  Object.freeze({
    key: "battered-pebble",
    structure: "A rounded battered fragment with shallow basins, worn rims, and granular impact regolith.",
  }),
  Object.freeze({
    key: "contact-binary",
    structure: "An unequal double-lobed rubble pile with a compressed waist and weathered contact region.",
  }),
  Object.freeze({
    key: "flattened-slab",
    structure: "A thick flattened slab with chipped margins, subdued ridges, and scattered impact bowls.",
  }),
  Object.freeze({
    key: "tapered-shard",
    structure: "A tapered angular shard with one narrow end, broken shoulders, and ancient crater relief.",
  }),
  Object.freeze({
    key: "pear-fragment",
    structure: "A pear-shaped fragment with a broad lower mass, offset crown, and uneven cratered terrain.",
  }),
  Object.freeze({
    key: "three-lobed-rubble",
    structure: "A compact three-lobed rubble body with shallow necks and impact-softened protrusions.",
  }),
  Object.freeze({
    key: "ridge-block",
    structure: "A block-like moon with a raised longitudinal ridge, clipped faces, and granular scarps.",
  }),
  Object.freeze({
    key: "cratered-ovoid",
    structure: "An elongated ovoid with overlapping crater fields and a gently asymmetric silhouette.",
  }),
  Object.freeze({
    key: "impact-wedge",
    structure: "A broad wedge-shaped fragment with a battered leading face and several deep impact basins.",
  }),
  Object.freeze({
    key: "oblate-rubble",
    structure: "A softly flattened rubble pile with broad equatorial shoulders and restrained crater relief.",
  }),
  Object.freeze({
    key: "weathered-column",
    structure: "A tall irregular column with an offset crown, worn vertical scarps, and small crater chains.",
  }),
  Object.freeze({
    key: "asymmetric-lobe",
    structure: "A dominant rounded lobe with a smaller offset shoulder and a heavily weathered transition.",
  }),
]);

function stableUnit(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Returns one reproducible visual recipe for an unresolved provisional moon.
 *
 * The recipe is intentionally labelled as reconstruction metadata. Nothing in
 * it claims that the selected source texture or generated relief was observed
 * on the named moon.
 */
export function getSaturnUnresolvedReconstruction(name) {
  const textureIndex = Math.min(
    SATURN_UNRESOLVED_TEXTURE_POOL.length - 1,
    Math.floor(stableUnit(`${name}:texture-source`) * SATURN_UNRESOLVED_TEXTURE_POOL.length),
  );
  const shapeIndex = Math.min(
    SATURN_UNRESOLVED_SHAPE_FAMILIES.length - 1,
    Math.floor(stableUnit(`${name}:inspection-shape`) * SATURN_UNRESOLVED_SHAPE_FAMILIES.length),
  );
  const shapeFamily = SATURN_UNRESOLVED_SHAPE_FAMILIES[shapeIndex];

  return Object.freeze({
    textureSource: SATURN_UNRESOLVED_TEXTURE_POOL[textureIndex],
    shapeIndex,
    shapeKey: shapeFamily.key,
    structure: shapeFamily.structure,
    craterCount: 7 + Math.floor(stableUnit(`${name}:crater-count`) * 12),
    roughness: 0.90 + stableUnit(`${name}:roughness`) * 0.085,
    evidenceLabel: "Unresolved telescopic point source · scientifically guided visual reconstruction",
    resolutionStatus: "No resolved real surface image or spacecraft footage is currently available",
  });
}

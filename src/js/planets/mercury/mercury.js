/**
 * Plain data used by planetFactory.js to build Mercury.
 * Keeping data separate from mesh-building code makes values easy to tune while
 * debugging. Distances are artistic scene units rather than astronomical scale.
 */
export const mercury = {
  name: "Mercury", texture: "mercury", radius: 0.54, orbitRadius: 14,
  orbitSpeed: 0.72, spinSpeed: 0.003, axialTilt: 0.001, angle: 0.8,
  bump: 0.028, orbitColor: 0x9d9386,
  detail: "Smallest planet | 0.38x Earth width",
  info: {
    type: "Planet", diameter: "4,879 km", orbitalSpeed: "47.36 km/s",
    distanceFromEarth: "≈ 77 million km at closest approach",
    description: "A cratered iron world racing around the Sun, where sunrise to sunset lasts longer than its year.",
  },
};

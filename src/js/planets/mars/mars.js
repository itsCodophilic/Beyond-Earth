/**
 * Plain data used by planetFactory.js to build Mars.
 * `bump` controls how strongly the color texture perturbs lighting, creating the
 * impression of rocky height without adding expensive geometry.
 */
export const mars = {
  name: "Mars", texture: "mars", radius: 0.72, orbitRadius: 40,
  orbitSpeed: 0.25, spinSpeed: 0.01, axialTilt: 0.44, angle: 5.3,
  bump: 0.065, orbitColor: 0xd06a37,
  detail: "Red planet | about half Earth width", focusScale: 2.1, minFocusDistance: 1.4, focusDistance: 1.85, focusEase: 0.11,
  info: {
    type: "Planet", diameter: "6,779 km", orbitalSpeed: "24.07 km/s",
    distanceFromEarth: "≈ 54.6 million km at closest approach",
    description: "A cold desert of rust-red dunes, immense volcanoes, ancient river valleys, and two tiny moons.",
  },
};

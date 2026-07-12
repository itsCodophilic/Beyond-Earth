/**
 * Plain data used by planetFactory.js to build Jupiter.
 * Its radius and camera focusScale are deliberately tuned for visual storytelling,
 * so they should not be interpreted as a scientifically exact scale model.
 */
export const jupiter = {
  name: "Jupiter", texture: "jupiter", radius: 6.25, orbitRadius: 75,
  orbitSpeed: 0.12, spinSpeed: 0.021, axialTilt: 0.05, angle: 1.35,
  bump: 0.012, orbitColor: 0xe2bc8a,
  detail: "Largest planet | about 11x Earth width", focusScale: 0.75,
  info: {
    type: "Planet", diameter: "139,820 km", orbitalSpeed: "13.07 km/s",
    distanceFromEarth: "≈ 588 million km at closest approach",
    description: "A colossal striped world of hydrogen, powerful auroras, and storms large enough to swallow Earth.",
  },
};

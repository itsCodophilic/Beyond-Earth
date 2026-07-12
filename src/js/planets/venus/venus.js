/**
 * Plain data used by planetFactory.js to build Venus.
 * A negative spinSpeed produces retrograde rotation—the surface turns in the
 * opposite direction from most planets—without needing special animation code.
 */
export const venus = {
  name: "Venus", texture: "venus", radius: 1.18, orbitRadius: 21,
  orbitSpeed: 0.46, spinSpeed: -0.0015, axialTilt: 3.1, angle: 2.2,
  bump: 0.01, orbitColor: 0xe0b36a,
  detail: "Earth-size world | retrograde spin", focusScale: 1.55, minFocusDistance: 6.7, focusDistance: 7.2, focusEase: 0.09, focusFov: 36,
  info: {
    type: "Planet", diameter: "12,104 km", orbitalSpeed: "35.02 km/s",
    distanceFromEarth: "≈ 38 million km at closest approach",
    description: "A luminous cloud-covered world with volcanic plains, crushing pressure, and a day longer than its year.",
  },
};

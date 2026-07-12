/**
 * Plain data used by planetFactory.js to build Neptune.
 * It has the largest orbitRadius in the current registry, making it the outer
 * boundary of the rendered planetary system before the camera reaches galaxy scale.
 */
export const neptune = {
  name: "Neptune", texture: "neptune", radius: 2.65, orbitRadius: 178,
  orbitSpeed: 0.043, spinSpeed: 0.012, axialTilt: 0.49, angle: 0.05,
  bump: 0.005, orbitColor: 0x5f83ff,
  detail: "Most distant planet | about 30 AU", focusScale: 1,
  info: {
    type: "Planet", diameter: "49,244 km", orbitalSpeed: "5.43 km/s",
    distanceFromEarth: "≈ 4.3 billion km at closest approach",
    description: "A deep-blue ice giant where supersonic winds race through bright methane clouds at the edge of the planetary system.",
  },
};

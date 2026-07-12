/**
 * Base Saturn configuration used by planetFactory.js.
 * The planet remains a normal sphere here. Its flat RingGeometry is attached as
 * a child in main.js, so moving Saturn automatically moves its rings as well.
 */
export const saturn = {
  name: "Saturn", texture: "saturn", radius: 5.2, orbitRadius: 108,
  orbitSpeed: 0.08, spinSpeed: 0.017, axialTilt: 0.47, angle: 3.1,
  bump: 0.01, orbitColor: 0xd9bd84,
  detail: "Ringed giant | about 9x Earth width", focusScale: 0.82,
};

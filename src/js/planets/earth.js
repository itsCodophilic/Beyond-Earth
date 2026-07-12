/**
 * Base Earth configuration used by planetFactory.js.
 * This creates only the solid globe. Clouds, atmosphere, night lights, and the
 * Moon are separate meshes in main.js so every layer can animate independently.
 */
export const earth = {
  name: "Earth", texture: "earth", normalTexture: "earthNormal", radius: 1.25,
  orbitRadius: 29, orbitSpeed: 0.34, spinSpeed: 0.012, axialTilt: 0.41,
  angle: 4.35, normalScale: 0.55, orbitColor: 0x7de7ff,
  detail: "Home planet | 12,756 km diameter", focusScale: 1.75,
};

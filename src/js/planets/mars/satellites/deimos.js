import { createMartianMoonSurface } from "./martianMoonFactory.js";

/**
 * Deimos is smaller and less angular than Phobos. NASA observations describe a
 * thick dusty regolith that partly fills its craters, so its relief is softer,
 * its crater rims are lower, and it intentionally has no Phobos-like grooves.
 */
export const DEIMOS_PROFILE = Object.freeze({
  name: "Deimos",
  diameterKm: 12.4,
  dimensions: "15 × 12 × 11 km",
  orbitScale: 2.75,
  // Deimos orbits 23,463 km out, just outside the synchronous radius, so it drifts slowly westward across the Martian sky over more than two days.
  semiMajorAxisKm: 23_463,
  speed: 0.008,
  inclination: 0.04,
  shape: [1.22, 0.98, 0.89],
  tidallyLocked: true,
  initialRotation: [-0.12, 0.64, 0.10],
  orbitalSpeed: "1.35 km/s around Mars",
  description: "Mars's smaller outer moon: a dark, irregular body whose deep blanket of loose regolith softens and partly fills its ancient impact craters.",
  surface: {
    seed: 11.08,
    // Deimos remains extremely dark, but mature regolith is given a slightly
    // redder slope than the fresher material exposed at young crater rims.
    baseColour: 0x9a826c,
    dustColour: 0xc1aa8c,
    darkColour: 0x534238,
    freshColour: 0xd8d1bd,
    freshMaterialStrength: 0.50,
    roughness: 0.95,
    broadRelief: 0.056,
    rockRelief: 0.020,
    fineRelief: 0.0075,
    minimumRadius: 0.72,
    craters: [
      { center: [-0.62, 0.42, 0.66], radius: 0.22, depth: 0.080, rim: 0.020, darkness: 0.55 },
      { center: [0.55, -0.62, 0.56], radius: 0.18, depth: 0.058, rim: 0.014, darkness: 0.48 },
      { center: [0.68, 0.58, -0.45], radius: 0.13, depth: 0.038, rim: 0.009, darkness: 0.42 },
      { center: [-0.40, -0.78, -0.48], radius: 0.12, depth: 0.034, rim: 0.008, darkness: 0.38 },
      { center: [0.08, 0.86, 0.50], radius: 0.10, depth: 0.027, rim: 0.006, darkness: 0.34 },
      { center: [-0.14, 0.10, -0.98], radius: 0.092, depth: 0.024, rim: 0.006, darkness: 0.33 },
      { center: [0.82, 0.18, 0.52], radius: 0.084, depth: 0.021, rim: 0.005, darkness: 0.31 },
    ],
    grooves: [],
  },
});

/** Creates Deimos's dedicated, regolith-softened 3D mesh. */
export function createDeimosSurface(quality) {
  return createMartianMoonSurface(DEIMOS_PROFILE, quality);
}

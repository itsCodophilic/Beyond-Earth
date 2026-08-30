import { createMartianMoonSurface } from "./martianMoonFactory.js";

/**
 * Phobos surface recipe, based on its observed 27 × 22 × 18 km triaxial shape.
 * The large first crater represents Stickney; the remaining bowls, grooves,
 * rubble, and dark dust are generated as genuine vertex relief.
 */
export const PHOBOS_PROFILE = Object.freeze({
  name: "Phobos",
  diameterKm: 22.2,
  dimensions: "27 × 22 × 18 km",
  orbitScale: 1.75,
  // Phobos orbits 9,376 km from Mars's centre -- closer to its planet than any other moon in the Solar System, and inside the synchronous radius, so it rises in the west.
  semiMajorAxisKm: 9_376,
  speed: 0.024,
  inclination: 0.02,
  shape: [1.23, 1.0, 0.82],
  tidallyLocked: true,
  initialRotation: [0.10, -0.48, -0.08],
  orbitalSpeed: "2.14 km/s around Mars",
  description: "Mars's larger inner moon: a dark, dust-covered world dominated by the giant Stickney crater, battered impact terrain, and long grooved troughs.",
  surface: {
    seed: 18.77,
    // Both Martian moons reflect only a small fraction of incoming sunlight.
    // These intentionally subdued sRGB colours preserve that very low-albedo,
    // carbon-rich appearance instead of turning Phobos into a tan space rock.
    baseColour: 0x765548,
    dustColour: 0xa07764,
    darkColour: 0x2a1b18,
    freshColour: 0x8fa6b0,
    freshMaterialStrength: 0.70,
    roughness: 0.98,
    broadRelief: 0.080,
    rockRelief: 0.036,
    fineRelief: 0.013,
    minimumRadius: 0.62,
    craters: [
      // Stickney is nearly half as wide as Phobos and therefore dominates the
      // visible silhouette instead of appearing as a small painted circle.
      { center: [-0.88, 0.12, 0.46], radius: 0.43, depth: 0.26, rim: 0.080, peak: 0.012, darkness: 0.86 },
      { center: [0.44, 0.72, 0.54], radius: 0.18, depth: 0.082, rim: 0.025, darkness: 0.64 },
      { center: [0.78, -0.42, 0.34], radius: 0.15, depth: 0.066, rim: 0.020, darkness: 0.58 },
      { center: [0.18, -0.83, -0.49], radius: 0.13, depth: 0.052, rim: 0.016, darkness: 0.50 },
      { center: [-0.28, 0.68, -0.68], radius: 0.11, depth: 0.047, rim: 0.014, darkness: 0.48 },
      { center: [0.84, 0.20, -0.50], radius: 0.095, depth: 0.038, rim: 0.012, darkness: 0.46 },
      { center: [-0.50, -0.64, 0.58], radius: 0.085, depth: 0.034, rim: 0.010, darkness: 0.42 },
      { center: [0.30, 0.22, 0.92], radius: 0.072, depth: 0.028, rim: 0.010, darkness: 0.40 },
      { center: [-0.14, 0.28, -0.94], radius: 0.062, depth: 0.026, rim: 0.009, darkness: 0.38 },
    ],
    grooves: [
      { planeNormal: [0.18, 0.97, 0.15], regionDirection: [0.30, -0.10, 0.95], width: 0.030, depth: 0.018, seed: 7 },
      { planeNormal: [0.30, 0.94, 0.18], regionDirection: [0.35, -0.06, 0.94], width: 0.026, depth: 0.015, seed: 12 },
      { planeNormal: [0.43, 0.88, 0.20], regionDirection: [0.42, 0.02, 0.91], width: 0.024, depth: 0.014, seed: 19 },
      { planeNormal: [-0.04, 0.98, 0.20], regionDirection: [0.18, 0.06, 0.98], width: 0.021, depth: 0.013, seed: 27 },
      { planeNormal: [-0.22, 0.95, 0.23], regionDirection: [0.12, -0.02, 0.99], width: 0.020, depth: 0.012, seed: 33 },
      { planeNormal: [0.55, 0.80, 0.24], regionDirection: [0.46, 0.10, 0.88], width: 0.019, depth: 0.011, seed: 42 },
      { planeNormal: [-0.34, 0.91, 0.23], regionDirection: [-0.02, 0.12, 0.99], width: 0.018, depth: 0.010, seed: 51 },
    ],
  },
});

/** Creates Phobos's dedicated terrain-first mesh. */
export function createPhobosSurface(quality) {
  return createMartianMoonSurface(PHOBOS_PROFILE, quality);
}

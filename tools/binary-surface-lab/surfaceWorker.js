/*
 * Generates one body's maps off the main thread, so the lab's bodies keep
 * turning while a design is being built. See surfaceGenerator.js.
 */
import { generateSurface } from "./surfaceGenerator.js";

self.onmessage = (event) => {
  const { id, spec } = event.data;
  try {
    const started = performance.now();
    const out = generateSurface(spec);
    self.postMessage(
      { id, albedo: out.albedo, normal: out.normal, meanLinear: out.meanLinear, ms: performance.now() - started },
      [out.albedo.buffer, out.normal.buffer],
    );
  } catch (error) {
    self.postMessage({ id, error: String(error?.stack ?? error) });
  }
};

/**
 * Planet registry.
 *
 * Each planet owns its data in a separate file. This index combines them in
 * solar-system order so main.js can create every mesh with one loop. A planet
 * configuration uses these common fields:
 * - radius/orbitRadius: artistic scene units, not real kilometres
 * - orbitSpeed/spinSpeed: movement added on every animation frame
 * - axialTilt: rotation of the planet's north/south axis, in radians
 * - angle: starting location around the Sun, in radians
 * - focusScale: adjusts how closely the camera frames the body
 */
import { mercury } from "./mercury/mercury.js";
import { venus } from "./venus/venus.js";
import { earth } from "./earth/earth.js";
import { mars } from "./mars/mars.js";
import { jupiter } from "./jupiter/jupiter.js";
import { saturn } from "./saturn/saturn.js";
import { uranus } from "./uranus/uranus.js";
import { neptune } from "./neptune/neptune.js";

// Export one canonical order for rendering, navigation, and future storytelling.
export const PLANET_CONFIGS = [mercury, venus, earth, mars, jupiter, saturn, uranus, neptune];

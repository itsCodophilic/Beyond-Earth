/**
 * The space events catalogue (round 79): 110 events added to the first 24,
 * in eleven sections. Each section module exports its events in
 * solarSystemEvents.js's format, built with catalogue/kit.js; the narrator's
 * words for each are in stories.js.
 */
import { SCALE_EVENTS } from "./scale.js";
import { SUN_EVENTS } from "./sun.js";
import { EARTH_SKY_EVENTS } from "./earth-sky.js";
import { EARTH_IMPACT_EVENTS } from "./earth-impacts.js";
import { INNER_EVENTS } from "./inner.js";
import { ASTEROID_EVENTS } from "./asteroids.js";
import { JUPITER_EVENTS } from "./jupiter.js";
import { SATURN_EVENTS } from "./saturn.js";
import { OUTER_EVENTS } from "./outer.js";
import { COMET_EVENTS } from "./comets.js";
import { ALIGNMENT_EVENTS } from "./alignments.js";
import { DEEP_EVENTS } from "./deep.js";

export const CATALOGUE_EVENTS = [
  ...SCALE_EVENTS,
  ...SUN_EVENTS,
  ...EARTH_SKY_EVENTS,
  ...EARTH_IMPACT_EVENTS,
  ...INNER_EVENTS,
  ...ASTEROID_EVENTS,
  ...JUPITER_EVENTS,
  ...SATURN_EVENTS,
  ...OUTER_EVENTS,
  ...COMET_EVENTS,
  ...ALIGNMENT_EVENTS,
  ...DEEP_EVENTS,
];

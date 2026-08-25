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
import { pluto } from "./pluto/pluto.js";
import { orcus } from "./orcus/orcus.js";
import { haumea } from "./haumea/haumea.js";
import { quaoar } from "./quaoar/quaoar.js";
import { makemake } from "./makemake/makemake.js";
import { gonggong } from "./gonggong/gonggong.js";
import { eris } from "./eris/eris.js";
import { sedna } from "./sedna/sedna.js";

/*
 * The Solar System does not stop at Pluto, and for a long time this list did.
 *
 * Everything after Pluto here is a trans-Neptunian world. Three of them --
 * Eris, Haumea and Makemake -- carry the IAU's dwarf planet label alongside
 * Pluto and Ceres; the other four do not, and the difference is administrative
 * rather than physical. Orcus and Quaoar and Gonggong are the same kind of
 * object, some of them larger than bodies that have the label, waiting on a
 * formal decision nobody is in a hurry to make. Sedna is stranger still: its
 * closest approach to the Sun is more than twice Neptune's distance, so it has
 * never been inside the planets' gravitational reach at all.
 *
 * Ceres is deliberately not in this list. It is a dwarf planet, but it is also
 * the largest object in the asteroid belt and it is already built there, with
 * its real orbit and its real shape -- see asteroidBelt.js. Adding a second
 * copy here would put two Ceres in the same Solar System.
 */
export const PLANET_CONFIGS = [
  mercury, venus, earth, mars, jupiter, saturn, uranus, neptune,
  pluto, orcus, haumea, quaoar, makemake, gonggong, eris, sedna,
];

/** The worlds beyond Neptune, for anything that wants to treat them as a set. */
export const TRANS_NEPTUNIAN_NAMES = Object.freeze([
  "Pluto", "Orcus", "Haumea", "Quaoar", "Makemake", "Gonggong", "Eris", "Sedna",
]);

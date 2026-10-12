/**
 * Writes docs/bodies-to-test.md: every named body in the scene -- the Sun,
 * planets, dwarf worlds, every small body and every moon -- grouped by the
 * board's regions, as tick-boxes, with the totals at the top.
 *
 *   node scripts/list-bodies.mjs
 *
 * Round 39 (Prompts.md: "list all the bodies, with name ... everything
 * planets moons dwarfs asteroid etc ... at header display total count").
 * Built from the board's own data (ui/celestialBoardData.js), so it lists
 * exactly what All bodies lists.
 */
import fs from "node:fs";
import { buildCelestialBoard, BODY_KINDS } from "../src/js/ui/celestialBoardData.js";

const board = buildCelestialBoard();
const moonsTotal = board.bodies.reduce((sum, body) => sum + (body.moons?.length ?? 0), 0);
const total = board.bodies.length + moonsTotal;
let swarmRows = 0;
try {
  swarmRows = JSON.parse(fs.readFileSync("public/assets/data/near-earth-asteroids.json", "utf8")).count;
} catch { /* not built */ }

const lines = [];
lines.push("# Bodies to test — every named body in the scene");
lines.push("");
lines.push(`**Total: ${total.toLocaleString("en-US")} named bodies** — ${board.bodies.length} bodies (the Sun, planets, dwarf worlds, asteroids, comets, Trojans, Centaurs and the rest) and ${moonsTotal} moons.`);
if (swarmRows) lines.push(`Plus **${swarmRows.toLocaleString("en-US")} near-Earth asteroids** drawn as stamped rocks; they appear only when you fly near them, so they are not listed one by one.`);
lines.push("");
lines.push("Generated from the board's own list (`node scripts/list-bodies.mjs`), so it matches **All bodies** exactly.");
lines.push("");
lines.push("How to test one: open **All bodies**, type its name in **Find**, and click it. The camera flies there and its card opens. Check that:");
lines.push("- it has a surface, not a plain ball;");
lines.push("- its card has real numbers;");
lines.push("- it turns;");
lines.push("- any moon goes round it.");
lines.push("");
lines.push("For moons, open the planet's **N moons** button.");
for (const region of board.regions) {
  const bodies = board.bodies.filter((body) => body.region === region.key);
  if (!bodies.length) continue;
  const moons = bodies.reduce((sum, body) => sum + (body.moons?.length ?? 0), 0);
  lines.push("");
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  lines.push(`## ${region.name ?? region.title ?? region.key} — ${plural(bodies.length, "body").replace("bodys", "bodies")}${moons ? `, ${plural(moons, "moon")}` : ""}`);
  lines.push("");
  for (const body of bodies) {
    const kind = BODY_KINDS[body.kind] ?? body.kind;
    lines.push(`- [ ] **${body.name}** · ${kind}${body.moons?.length ? ` · ${body.moons.length} moon${body.moons.length > 1 ? "s" : ""}` : ""}`);
    if (body.moons?.length) {
      lines.push(`  - ${body.moons.map((moon) => `[ ] ${moon.name}`).join(" · ")}`);
    }
  }
}
lines.push("");
fs.writeFileSync("docs/bodies-to-test.md", lines.join("\n"));
console.log(`${board.bodies.length} bodies + ${moonsTotal} moons = ${total}; swarm ${swarmRows}`);

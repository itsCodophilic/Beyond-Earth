/* Diagnostic only: how violently the shading normal turns from one vertex to
 * the next. A surface whose normal swings by tens of degrees between adjacent
 * vertices cannot be shaded smoothly -- each facet catches the light on its
 * own, and the body sparkles as it turns. Not part of the build. */
import * as THREE from "three";
import { createSmallBodyGeometry } from "../src/js/scene/smallBodies/smallBodyShapes.js";
import { SMALL_BODIES } from "../src/js/scene/smallBodies/smallBodyCatalogue.js";

const W = 96, H = 64;
const QUAD = (2 * Math.PI) / W;               // radians of arc per quad
const rows = [];
for (const rec of SMALL_BODIES) {
  const g = createSmallBodyGeometry(rec.shape, { widthSegments: W, heightSegments: H });
  const N = g.attributes.normal, stride = W + 1;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  let sum = 0, count = 0, big = 0, worst = 0;
  for (let row = 1; row < H; row += 1) {
    for (let col = 0; col < W; col += 1) {
      a.fromBufferAttribute(N, row * stride + col);
      b.fromBufferAttribute(N, row * stride + col + 1);
      const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) * 180 / Math.PI;
      sum += ang; count += 1; if (ang > 25) big += 1; if (ang > worst) worst = ang;
    }
  }
  g.dispose();
  const s = rec.shape;
  const bSize = s.boulderSize ?? 0;
  rows.push({
    name: rec.name,
    mean: sum / count,
    overPct: (100 * big) / count,
    worst,
    relief: s.relief ?? 0.03,
    grain: s.grain ?? 0.015,
    // smallest boulder this body draws, in quads
    minBoulderQuads: bSize ? (bSize * 0.45) / QUAD : 0,
    boulders: s.boulders ?? 0,
  });
}
rows.sort((x, y) => y.mean - x.mean);
console.log("quad = " + (QUAD).toFixed(4) + " rad (" + (QUAD * 180 / Math.PI).toFixed(2) + " deg)");
console.log("name                      meanAdjNormal  >25deg%  worst  relief  grain  minBoulder(quads) n");
for (const r of rows) {
  console.log(
    r.name.padEnd(26)
    + r.mean.toFixed(2).padStart(9) + "deg"
    + r.overPct.toFixed(1).padStart(9)
    + r.worst.toFixed(0).padStart(7)
    + r.relief.toFixed(3).padStart(8)
    + r.grain.toFixed(3).padStart(7)
    + r.minBoulderQuads.toFixed(2).padStart(13)
    + String(r.boulders).padStart(5),
  );
}

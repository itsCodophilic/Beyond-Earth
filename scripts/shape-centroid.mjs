/* Diagnostic only: measures how far each sculpted mesh's centre of volume sits
 * from the origin it is spun about. Not part of the build. */
import * as THREE from "three";
import { createSmallBodyGeometry } from "../src/js/scene/smallBodies/smallBodyShapes.js";
import { SMALL_BODIES } from "../src/js/scene/smallBodies/smallBodyCatalogue.js";
import { MAIN_BELT_WORLDS } from "../src/js/scene/smallBodies/mainBeltCatalogue.js";

function measure(shape) {
  const g = createSmallBodyGeometry(shape, { widthSegments: 96, heightSegments: 64 });
  const p = g.attributes.position;
  const idx = g.index;
  // Signed-tetrahedron volume integral about the origin.
  let vol = 0, cx = 0, cy = 0, cz = 0, maxR = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i));
    b.fromBufferAttribute(p, idx.getX(i + 1));
    c.fromBufferAttribute(p, idx.getX(i + 2));
    const v = a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
    vol += v;
    cx += v * (a.x + b.x + c.x) / 4;
    cy += v * (a.y + b.y + c.y) / 4;
    cz += v * (a.z + b.z + c.z) / 4;
  }
  for (let i = 0; i < p.count; i += 1) {
    maxR = Math.max(maxR, Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
  }
  g.dispose();
  return { off: Math.hypot(cx / vol, cy / vol, cz / vol), c: [cx / vol, cy / vol, cz / vol], maxR };
}

const rows = [];
for (const rec of [...SMALL_BODIES, ...MAIN_BELT_WORLDS]) {
  const list = [[rec.name, rec.shape, rec.diameterKm]];
  if (rec.moon) list.push([rec.moon.name, rec.moon.shape, rec.moon.diameterKm]);
  for (const m of rec.moons ?? []) list.push([m.name, m.shape, m.diameterKm]);
  for (const [name, shape, km] of list) {
    if (!shape) continue;
    const { off, c, maxR } = measure(shape);
    rows.push({ name, km, lobes: shape.lobes.length, neck: shape.neck ?? null, pct: (off / maxR) * 100, c });
  }
}
rows.sort((x, y) => y.pct - x.pct);
for (const r of rows) {
  console.log(
    r.pct.toFixed(2).padStart(6) + "%  " + r.name.padEnd(22)
    + " lobes=" + r.lobes + " neck=" + String(r.neck).padEnd(4)
    + " d=" + String(r.km).padEnd(8)
    + " c=[" + r.c.map((v) => v.toFixed(4)).join(", ") + "]",
  );
}

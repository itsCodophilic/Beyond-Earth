/**
 * The small-body build gate.
 *
 * `scene/smallBodies/` carries no textures and touches no shared registry, so
 * the only things that can silently rot in it are the three this checks:
 *
 *   1. **Build cost.** Fifteen shapes are sculpted vertex by vertex at load.
 *      The build yields between bodies so the loader keeps animating, but a
 *      careless change to the crater or boulder loops is quadratic in a hurry.
 *      Headline numbers on the machine this was written on: 120-300 ms for
 *      the whole set, 116,124 triangles across 15 meshes.
 *   2. **Draw calls.** One mesh per body plus one pointer proxy per body; the
 *      proxies sit on the pointer-proxy layer and are not drawn, so the count
 *      below only sees fifteen. If it ever reads thirty, a proxy has lost its
 *      layer and is being rasterised -- which is the exact regression
 *      `scene/pointerProxies.js` exists to record.
 *   3. **Card completeness.** Every body has to answer the five rows the
 *      dossier panel renders. A missing `surfaceEvidence` is the one that
 *      matters: it is the row that says who measured the thing.
 *
 * It renders nothing and needs no GL context, so it runs in plain node:
 *
 *     node --experimental-vm-modules scripts/check-small-bodies.mjs
 */
import * as THREE from "three";
import { createSmallBodies, updateSmallBodies } from "../src/js/scene/smallBodies/smallBodies.js";
const t0 = Date.now();
const world = new THREE.Group(); const hoverTargets = [];
const sb = await createSmallBodies({ world, hoverTargets, quality: "medium" });
console.log("build(medium)", Date.now() - t0, "ms");
const t1 = Date.now();
const sb2 = await createSmallBodies({ world: new THREE.Group(), hoverTargets: [], quality: "high" });
console.log("build(high)  ", Date.now() - t1, "ms");
let drawn = 0, tris = 0;
sb.system.traverse(o => { if (o.isMesh && o.layers.mask === 1) { drawn++; tris += (o.geometry.index ? o.geometry.index.count : 0) / 3; } });
console.log("drawn meshes", drawn, "triangles", Math.round(tris));
const t2 = Date.now(); for (let i = 0; i < 3600; i++) updateSmallBodies(sb, 1, 1/60);
console.log("3600 frames", Date.now() - t2, "ms");
// per-body extents + cards
sb.bodies.forEach(b => {
  const u = b.group.userData;
  const bad = [];
  if (!u.info.diameter) bad.push("no diameter");
  if (!u.info.description) bad.push("no description");
  if (!u.info.surfaceEvidence) bad.push("no surfaceEvidence");
  if (!u.info.rotationPeriod) bad.push("no rotationPeriod");
  if (!u.info.orbitalSpeed) bad.push("no orbitalSpeed");
  if (!Number.isFinite(u.heliocentricAU)) bad.push("bad AU");
  if (!Number.isFinite(u.visualRadius) || u.visualRadius <= 0) bad.push("bad radius");
  if (bad.length) console.log("ISSUE", u.name, bad.join("; "));
  if (b.moon) {
    const m = b.moon.group.userData;
    const mb = [];
    ["diameter","description","surfaceEvidence","rotationPeriod","orbitalSpeed"].forEach(k => { if (!m.info[k]) mb.push("no " + k); });
    if (mb.length) console.log("ISSUE", m.name, mb.join("; "));
  }
});
console.log("card field check complete");

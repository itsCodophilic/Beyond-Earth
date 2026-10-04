/**
 * Keeps a displaced sphere closed.
 *
 * Reported (Prompts.md, round 4): some moons -- Proteus was the example --
 * had gaps in their surfaces, with the stars showing through. Found by
 * welding every mesh in the scene by position and counting edges that only
 * one triangle uses: seven moons were open, Larissa, Hippocamp and Proteus
 * at Neptune and Mimas, Enceladus, Rhea and Iapetus at Saturn, all along the
 * same two places.
 *
 * `SphereGeometry` stores the texture seam as two copies of every vertex on
 * it (u = 0 and u = 1), and each pole as a whole row of copies. The copies sit
 * at the same point, but not at exactly the same *numbers*: the u = 1 column
 * is at sin(2 pi) = -2.4e-16 where u = 0 is at 0, and the south pole at
 * sin(pi) = 1.2e-16. Any relief that floors or hashes the direction -- these
 * builders' cell noise does, `Math.floor(direction.x * frequency)` -- puts a
 * value of -2.4e-16 in cell -1 and 0 in cell 0, so the two copies get
 * different heights, move apart, and the triangles between them no longer
 * meet. The gap runs the whole length of the seam, pole to pole, and fans
 * out round the south pole.
 *
 * The fix does not depend on how the relief is made: before deforming,
 * record which vertices start at the same point (`captureSeamGroups`); after,
 * move every group to its average position and give it one averaged normal
 * (`sealSeamGroups`). The surface is closed by construction, and the seam
 * cannot show as a lighting crease either. Cost: one pass over the vertices
 * at build time; nothing per frame.
 */
import * as THREE from "three";

/** Indices that share a position now, before any displacement. */
export function captureSeamGroups(geometry, tolerance = 1e-6) {
  const position = geometry.getAttribute("position");
  const buckets = new Map();
  const inv = 1 / tolerance;
  for (let i = 0; i < position.count; i += 1) {
    const key = `${Math.round(position.getX(i) * inv)},${Math.round(position.getY(i) * inv)},${Math.round(position.getZ(i) * inv)}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  const groups = [];
  buckets.forEach((list) => { if (list.length > 1) groups.push(list); });
  return groups;
}

/**
 * Moves each group to one point and, if `normals` is true, recomputes the
 * vertex normals and gives each group one shared normal.
 */
export function sealSeamGroups(geometry, groups, { normals = true } = {}) {
  const position = geometry.getAttribute("position");
  const sum = new THREE.Vector3();
  for (const group of groups) {
    sum.set(0, 0, 0);
    for (const i of group) sum.x += position.getX(i), sum.y += position.getY(i), sum.z += position.getZ(i);
    sum.multiplyScalar(1 / group.length);
    for (const i of group) position.setXYZ(i, sum.x, sum.y, sum.z);
  }
  position.needsUpdate = true;
  if (!normals) return;
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal");
  for (const group of groups) {
    sum.set(0, 0, 0);
    for (const i of group) sum.x += normal.getX(i), sum.y += normal.getY(i), sum.z += normal.getZ(i);
    if (sum.lengthSq() < 1e-12) continue;
    sum.normalize();
    for (const i of group) normal.setXYZ(i, sum.x, sum.y, sum.z);
  }
  normal.needsUpdate = true;
}

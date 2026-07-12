/**
 * Orbit-line helper.
 * An orbit is visualized as a Line built from many points around a circle. The
 * line is only a guide; actual planet positions are calculated in main.js.
 */
import * as THREE from "three";

/** Creates a circular orbital guide inside the scene's dedicated orbit layer. */
export function createOrbitLine(orbitRoot, radius, color = 0xffffff, opacity = 0.18, tilt = 0) {
  // 241 includes the final point at 2π, which closes the circle back at its start.
  const points = Array.from({ length: 241 }, (_, index) => {
    const angle = (index / 240) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });

  // BufferGeometry stores GPU-friendly point data. LineBasicMaterial draws a
  // one-pixel path through those points without requiring scene lighting.
  const orbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  // Tilting the complete line is cheaper and simpler than tilting each point.
  orbit.rotation.x = tilt;
  orbitRoot.add(orbit);
  return orbit;
}

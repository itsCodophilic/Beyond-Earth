/**
 * Orbit-line helper.
 * An orbit is visualized as a Line built from many points around an ellipse.
 * The line is only a guide; actual planet positions are calculated in main.js.
 */
import * as THREE from "three";

/** Creates an orbital guide inside the scene's dedicated orbit layer. */
export function createOrbitLine(orbitRoot, radius, color = 0xffffff, opacity = 0.18, tilt = 0, eccentricity = 0, rotation = 0) {
  const e = THREE.MathUtils.clamp(eccentricity ?? 0, 0, 0.92);
  const semiMajorAxis = radius;
  const semiMinorAxis = semiMajorAxis * Math.sqrt(1 - e * e);
  const cosRotation = Math.cos(rotation ?? 0);
  const sinRotation = Math.sin(rotation ?? 0);

  const points = Array.from({ length: 241 }, (_, index) => {
    const meanAngle = (index / 240) * Math.PI * 2;
    const x = semiMajorAxis * Math.cos(meanAngle) - semiMajorAxis * e;
    const z = semiMinorAxis * Math.sin(meanAngle);
    return new THREE.Vector3(
      x * cosRotation - z * sinRotation,
      0,
      x * sinRotation + z * cosRotation,
    );
  });

  const orbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  orbit.rotation.x = tilt;
  orbitRoot.add(orbit);
  return orbit;
}

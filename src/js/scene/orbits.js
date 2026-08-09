/**
 * Shared heliocentric orbit helpers.
 *
 * The guide line and the moving planet must use the same eccentric-anomaly,
 * inclination, and apsidal-rotation transform. Keeping the maths here prevents
 * visual gaps between a planet and its displayed path.
 */
import * as THREE from "three";

export function solveOrbitEccentricAnomaly(meanAnomaly, eccentricity) {
  if (eccentricity <= 0.0001) return meanAnomaly;
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const denominator = Math.max(0.000001, 1 - eccentricity * Math.cos(eccentricAnomaly));
    const delta = (
      eccentricAnomaly
      - eccentricity * Math.sin(eccentricAnomaly)
      - meanAnomaly
    ) / denominator;
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 0.00001) break;
  }
  return eccentricAnomaly;
}

/** Writes the exact scene-space position for one point on a planetary orbit. */
export function setOrbitPosition(
  target,
  semiMajorAxis,
  eccentricity = 0,
  meanAnomaly = 0,
  inclination = 0,
  rotation = 0,
) {
  const e = THREE.MathUtils.clamp(eccentricity ?? 0, 0, 0.92);
  const eccentricAnomaly = solveOrbitEccentricAnomaly(meanAnomaly, e);
  const semiMinorAxis = semiMajorAxis * Math.sqrt(Math.max(0.0001, 1 - e * e));

  const orbitalX = semiMajorAxis * (Math.cos(eccentricAnomaly) - e);
  const orbitalZ = semiMinorAxis * Math.sin(eccentricAnomaly);
  const inclinedZ = orbitalZ * Math.cos(inclination ?? 0);
  const inclinedY = orbitalZ * Math.sin(inclination ?? 0);
  const cosRotation = Math.cos(rotation ?? 0);
  const sinRotation = Math.sin(rotation ?? 0);

  target.set(
    orbitalX * cosRotation - inclinedZ * sinRotation,
    inclinedY,
    orbitalX * sinRotation + inclinedZ * cosRotation,
  );
  return target;
}

/** Creates an orbital guide inside the scene's dedicated orbit layer. */
export function createOrbitLine(
  orbitRoot,
  radius,
  color = 0xffffff,
  opacity = 0.18,
  tilt = 0,
  eccentricity = 0,
  rotation = 0,
  segmentCount = 240,
) {
  // Compact distant bodies can need a denser guide than the default. Keep the
  // normal 240-segment budget for every other planet so orbit-hover raycasting
  // stays lightweight, while allowing Pluto to opt into a more precise path.
  const segments = Math.max(120, Math.floor(segmentCount));
  const points = Array.from({ length: segments + 1 }, (_, index) => setOrbitPosition(
    new THREE.Vector3(),
    radius,
    eccentricity,
    (index / segments) * Math.PI * 2,
    tilt,
    rotation,
  ));

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const orbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    material,
  );
  orbit.name = "Planet orbit guide";
  orbit.frustumCulled = false;
  orbit.userData = {
    isPlanetOrbit: true,
    baseColor: color,
    baseOpacity: opacity,
    orbitRadius: radius,
    orbitInclination: tilt,
    orbitEccentricity: eccentricity,
    orbitRotation: rotation,
  };
  orbitRoot.add(orbit);
  return orbit;
}

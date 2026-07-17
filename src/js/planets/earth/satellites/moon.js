/**
 * Earth's Moon: mesh, crater details, and orbital hierarchy.
 *
 * Hierarchy:
 *   Earth
 *    └─ moonSystem (tilts the orbital plane)
 *        ├─ moonOrbit (stationary visual guide)
 *        └─ moonPivot (rotates to create revolution)
 *            └─ Moon mesh (moves because it is offset from the pivot)
 *
 * Keeping the satellite inside Earth's folder makes ownership explicit and gives
 * future planets the same place for their own moons.
 */
import * as THREE from "three";
import { makeNoiseTexture } from "../../../graphics/proceduralTextures.js";
import { EARTH_VISUAL_RADIUS, getMoonVisualRadius, getSizeComparisonText } from "../../../config/celestialScale.js";

const MOON_DIAMETER_KM = 3_474.8;
const MOON_RADIUS = getMoonVisualRadius(MOON_DIAMETER_KM);
const ORBIT_RADIUS = EARTH_VISUAL_RADIUS * 3.15;

/** Fixed crater positions keep the Moon visually stable between page reloads. */
const CRATERS = [
  { latitude: 18, longitude: -28, radius: 0.055 },
  { latitude: -12, longitude: 12, radius: 0.038 },
  { latitude: 42, longitude: 36, radius: 0.03 },
  { latitude: -34, longitude: -48, radius: 0.045 },
  { latitude: 8, longitude: 58, radius: 0.026 },
  { latitude: 52, longitude: -62, radius: 0.022 },
  { latitude: -48, longitude: 24, radius: 0.028 },
  { latitude: 27, longitude: 82, radius: 0.02 },
];

/** Converts latitude/longitude into a unit direction on a sphere. */
function sphericalDirection(latitude, longitude) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Adds subtle recessed discs and raised rims above the displacement-mapped terrain.
 * These are intentionally small; the texture remains responsible for fine craters.
 */
function addCraterDetails(moon, quality = "high") {
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x393836,
    roughness: 1,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x918d84,
    roughness: 1,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const forward = new THREE.Vector3(0, 0, 1);

  const circleSegments = quality === "low" ? 16 : quality === "medium" ? 22 : 28;
  const torusSegments = quality === "low" ? 20 : quality === "medium" ? 26 : 32;

  CRATERS.forEach(({ latitude, longitude, radius }) => {
    const direction = sphericalDirection(latitude, longitude);
    const orientation = new THREE.Quaternion().setFromUnitVectors(forward, direction);

    // A dark disc suggests the crater floor. It sits almost flush with the sphere.
    const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.72, circleSegments), floorMaterial);
    floor.position.copy(direction).multiplyScalar(MOON_RADIUS * 1.004);
    floor.quaternion.copy(orientation);
    moon.add(floor);

    // A very thin torus catches light along the raised crater rim.
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.74, 0.006, 8, torusSegments), rimMaterial);
    rim.position.copy(direction).multiplyScalar(MOON_RADIUS * 1.009);
    rim.quaternion.copy(orientation);
    moon.add(rim);
  });
}

/** Creates the complete Earth–Moon satellite system and attaches it to Earth. */
export function createMoonSystem({ earth, textures, hoverTargets, quality = "high" }) {
  const moonTexture = textures.moon ?? makeNoiseTexture("moon");

  // More segments are required because displacementMap physically moves vertices.
  const moonSegments = quality === "low" ? 96 : quality === "medium" ? 128 : 160;
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS, moonSegments, moonSegments),
    new THREE.MeshStandardMaterial({
      map: moonTexture,
      roughness: 1,
      metalness: 0,
      bumpMap: moonTexture,
      bumpScale: 0.055,
      displacementMap: moonTexture,
      displacementScale: 0.018,
      displacementBias: -0.009,
    }),
  );
  moon.name = "Moon";
  moon.position.set(ORBIT_RADIUS, 0, 0);
  moon.userData = {
    name: "Moon",
    detail: "Earth's natural satellite | cratered highlands and dark maria",
    parentPlanet: "Earth",
    heliocentricAU: 1.0,
    orbitalEccentricity: 0.0167,
    focusScale: 3.3,
    focusDistance: Math.max(1.25, MOON_RADIUS * 4.2),
    minFocusDistance: Math.max(1.05, MOON_RADIUS * 3.5),
    focusEase: 0.10,
    focusFov: 34,
    visualRadius: MOON_RADIUS,
    physicalDiameterKm: MOON_DIAMETER_KM,
    diameterEarths: MOON_DIAMETER_KM / 12_756,
    volumeEarths: Math.pow(MOON_DIAMETER_KM / 12_756, 3),
    sizeComparison: getSizeComparisonText({ diameterKm: MOON_DIAMETER_KM, name: "Moon" }),
    info: {
      type: "Natural satellite",
      diameter: "3,474.8 km",
      orbitalSpeed: "1.022 km/s around Earth",
      distanceFromEarth: "≈ 384,400 km average",
      sizeComparison: getSizeComparisonText({ diameterKm: MOON_DIAMETER_KM, name: "Moon" }),
      description: "A silent companion shaped by ancient impacts, with bright highlands, dark volcanic maria, and no air to soften its horizon.",
    },
  };
  addCraterDetails(moon, quality);

  // The real Moon is tiny on screen, so its exact geometry can be difficult to
  // click. This invisible sphere enlarges only the raycast target—not the visual.
  const moonHitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(MOON_RADIUS * 1.8, 24, 24),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  moonHitTarget.name = "Moon interaction target";
  moon.add(moonHitTarget);

  // The pivot remains at Earth's center; rotating it moves the offset Moon in a circle.
  const moonPivot = new THREE.Group();
  moonPivot.name = "Moon orbit pivot";
  moonPivot.add(moon);

  const orbitPoints = Array.from({ length: 181 }, (_, index) => {
    const angle = (index / 180) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS);
  });
  const moonOrbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(orbitPoints),
    new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.22 }),
  );

  // The real lunar orbit is tilted about 5.14° relative to Earth's orbital plane.
  const moonSystem = new THREE.Group();
  moonSystem.name = "Earth satellite system";
  moonSystem.rotation.z = THREE.MathUtils.degToRad(5.14);
  moonSystem.add(moonOrbit, moonPivot);
  earth.add(moonSystem);

  hoverTargets.push(moon);
  return { moon, moonPivot, moonOrbit, moonSystem };
}

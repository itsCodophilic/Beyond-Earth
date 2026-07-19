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

/** Creates the complete Earth–Moon satellite system and attaches it to Earth. */
export function createMoonSystem({ earth, textures, hoverTargets, quality = "high" }) {
  const moonTexture = textures.moon ?? makeNoiseTexture("moon");
  const moonTopography = textures.moonDisplacement ?? moonTexture;

  // LOLA topography now moves the sphere vertices directly. Crater bowls,
  // terraced walls, rims, maria boundaries and large impact basins therefore
  // react to light as true geometry instead of floating circular decals.
  const moonSegments = quality === "low" ? 128 : quality === "medium" ? 176 : 240;
  const moonGeometry = new THREE.SphereGeometry(MOON_RADIUS, moonSegments, moonSegments);
  const moon = new THREE.Mesh(
    moonGeometry,
    new THREE.MeshStandardMaterial({
      map: moonTexture,
      color: 0xffffff,
      roughness: 1,
      metalness: 0,
      bumpMap: moonTopography,
      bumpScale: 0.032,
      displacementMap: moonTopography,
      // The real lunar relief is subtle at globe scale, so it is modestly
      // exaggerated for cinematic readability while preserving its shape.
      displacementScale: MOON_RADIUS * 0.050,
      displacementBias: -MOON_RADIUS * 0.025,
      envMapIntensity: 0.025,
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

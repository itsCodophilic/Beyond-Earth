/**
 * Shared planet construction.
 * Planet files contain only readable data; this factory translates that data
 * into Three.js Geometry + Material + Mesh objects and registers each result.
 */
import * as THREE from "three";
import { makeNoiseTexture } from "../graphics/proceduralTextures.js";
import { createOrbitLine } from "./orbits.js";

/** Converts a planet configuration object into a physically lit Three.js material. */
function createPlanetMaterial(config, textures) {
  // MeshStandardMaterial responds to the scene's lights. `map` supplies color,
  // while bump/normal maps alter how light appears to hit small surface details.
  return new THREE.MeshStandardMaterial({
    map: textures[config.texture] ?? makeNoiseTexture(config.texture),
    roughness: config.roughness ?? 0.84,
    metalness: config.metalness ?? 0,
    bumpMap: config.bump ? textures[config.texture] : null,
    bumpScale: config.bump ?? 0,
    normalMap: config.normalTexture ? textures[config.normalTexture] : null,
    normalScale: new THREE.Vector2(config.normalScale ?? 0.55, config.normalScale ?? 0.55),
    emissive: new THREE.Color(config.emissiveColor ?? 0x000000),
    emissiveIntensity: config.emissiveIntensity ?? 0,
    envMapIntensity: 0.18,
  });
}

/** Builds one planet, records its animation metadata, and registers it for interaction. */
export function createPlanet({ config, textures, world, orbitRoot, planets, hoverTargets }) {
  // A Mesh is the combination of shape (SphereGeometry) and appearance (Material).
  // Higher segment counts make round silhouettes but also increase GPU cost.
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(config.radius, 112, 112),
    createPlanetMaterial(config, textures),
  );

  mesh.name = config.name;
  // Animation and UI metadata travel with the mesh through Three.js userData.
  mesh.userData = {
    name: config.name,
    orbitRadius: config.orbitRadius,
    orbitSpeed: config.orbitSpeed,
    spinSpeed: config.spinSpeed,
    angle: config.angle,
    tilt: config.tilt ?? 0,
    focusScale: config.focusScale ?? 1,
    detail: config.detail,
  };
  mesh.rotation.z = config.axialTilt ?? 0;

  // The same mesh is intentionally stored in three places for different jobs:
  // scene rendering, per-frame planet animation, and pointer raycasting.
  world.add(mesh);
  planets.push(mesh);
  hoverTargets.push(mesh);

  if (config.orbitRadius > 0) {
    createOrbitLine(orbitRoot, config.orbitRadius, config.orbitColor, config.orbitOpacity ?? 0.18, config.tilt ?? 0);
  }
  return mesh;
}

/** Wraps a planet in a transparent additive shell that suggests an atmosphere. */
export function addAtmosphere(planet, radius, color, opacity) {
  // The shell is slightly larger than the solid planet. Rendering BackSide means
  // we mainly see the glow at the silhouette rather than a flat colored overlay.
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 96),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      // Additive blending adds light values, producing a luminous edge.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  planet.add(shell);
  return shell;
}

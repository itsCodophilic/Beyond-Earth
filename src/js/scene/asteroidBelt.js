/**
 * Visible asteroid-belt builder.
 * This module creates individual rock meshes. The cheaper dust-like particles
 * surrounding them are created separately in particles.js.
 */
import * as THREE from "three";
import { makeRockTexture } from "../graphics/proceduralTextures.js";

/** Creates the visible rocky bodies of the asteroid belt. */
export function createAsteroidBelt(world) {
  // All rocks share one parent so the entire belt can rotate with one transform.
  const asteroidGroup = new THREE.Group();
  const rockTexture = makeRockTexture();
  // Reuse a small material and geometry pool. Sharing GPU resources is much
  // cheaper than constructing a unique material for each of the 260 rocks.
  const asteroidMaterials = [
    new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.055, color: 0x8a7866, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.075, color: 0x5f554b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.045, color: 0xa5927c, roughness: 0.96 }),
  ];
  const asteroidGeometries = [
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.DodecahedronGeometry(1, 1),
    new THREE.TetrahedronGeometry(1, 1),
  ];
  for (let i = 0; i < 260; i += 1) {
    // Math.pow biases most rocks toward small sizes while retaining a few large ones.
    const rockSize = 0.055 + Math.pow(Math.random(), 2.6) * 0.42;
    const asteroid = new THREE.Mesh(
      asteroidGeometries[Math.floor(Math.random() * asteroidGeometries.length)],
      asteroidMaterials[Math.floor(Math.random() * asteroidMaterials.length)],
    );
    // Polar coordinates (radius + angle) distribute rocks around a ring.
    const radius = 43 + Math.random() * 9;
    const angle = Math.random() * Math.PI * 2;
    asteroid.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 2.4, Math.sin(angle) * radius);
    asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    asteroid.scale.set(
      rockSize * (0.65 + Math.random() * 1.5),
      rockSize * (0.45 + Math.random() * 1.1),
      rockSize * (0.75 + Math.random() * 1.7),
    );
    // userData is a safe place for app-specific values Three.js does not define.
    asteroid.userData.spin = new THREE.Vector3(
      0.001 + Math.random() * 0.006,
      0.001 + Math.random() * 0.007,
      0.001 + Math.random() * 0.004,
    );
    asteroidGroup.add(asteroid);
  }
  world.add(asteroidGroup);
    return asteroidGroup;
}

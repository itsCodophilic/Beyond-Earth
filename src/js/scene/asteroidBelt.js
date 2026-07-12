/**
 * Realistic asteroid-belt builder.
 *
 * The belt combines:
 * - irregular low-poly rock bodies
 * - physically indented crater regions
 * - rough procedural rock textures
 * - a wide size distribution with only a few large bodies
 * - denser small debris spread across several orbital lanes
 */
import * as THREE from "three";
import { makeRockTexture } from "../graphics/proceduralTextures.js";

/** Deterministic pseudo-random number from an integer seed. */
function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Creates one reusable irregular asteroid geometry.
 *
 * Vertices are stretched, roughened, and pushed inward around several crater
 * directions. Recomputing normals afterwards makes the dents react to light.
 */
function createCrateredRockGeometry(seed, detail = 3) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.attributes.position;

  const stretch = new THREE.Vector3(
    0.78 + seededRandom(seed + 1) * 0.55,
    0.68 + seededRandom(seed + 2) * 0.52,
    0.80 + seededRandom(seed + 3) * 0.62,
  );

  const craterCount = 3 + Math.floor(seededRandom(seed + 4) * 5);
  const craters = [];

  for (let index = 0; index < craterCount; index += 1) {
    const y = seededRandom(seed * 17 + index * 7) * 2 - 1;
    const angle = seededRandom(seed * 23 + index * 11) * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));

    craters.push({
      direction: new THREE.Vector3(
        Math.cos(angle) * radial,
        y,
        Math.sin(angle) * radial,
      ).normalize(),
      radius: 0.12 + seededRandom(seed * 31 + index * 13) * 0.24,
      depth: 0.035 + seededRandom(seed * 41 + index * 19) * 0.105,
      rim: 0.018 + seededRandom(seed * 47 + index * 29) * 0.045,
    });
  }

  const vertex = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);
    direction.copy(vertex).normalize();

    const roughA = Math.sin(direction.x * 17.3 + seed) * 0.035;
    const roughB = Math.sin(direction.y * 31.7 - seed * 0.7) * 0.022;
    const roughC = Math.sin(direction.z * 43.1 + seed * 1.3) * 0.016;
    let radialScale = 1 + roughA + roughB + roughC;

    for (const crater of craters) {
      const angularDistance = Math.acos(
        THREE.MathUtils.clamp(direction.dot(crater.direction), -1, 1),
      );

      const inside = 1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.18,
        crater.radius,
      );

      const rimBand = THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.72,
        crater.radius * 0.94,
      ) * (1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.94,
        crater.radius * 1.18,
      ));

      radialScale -= inside * crater.depth;
      radialScale += rimBand * crater.rim;
    }

    vertex.multiplyScalar(radialScale).multiply(stretch);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Creates the visible rocky bodies of the asteroid belt. */
export function createAsteroidBelt(world) {
  const asteroidGroup = new THREE.Group();
  asteroidGroup.name = "Main asteroid belt";

  const rockTexture = makeRockTexture();
  rockTexture.repeat.set(1.8, 1.8);

  const asteroidMaterials = [
    new THREE.MeshStandardMaterial({
      map: rockTexture,
      bumpMap: rockTexture,
      bumpScale: 0.095,
      color: 0x74675b,
      roughness: 1,
      metalness: 0.015,
    }),
    new THREE.MeshStandardMaterial({
      map: rockTexture,
      bumpMap: rockTexture,
      bumpScale: 0.12,
      color: 0x4d4741,
      roughness: 0.99,
      metalness: 0.025,
    }),
    new THREE.MeshStandardMaterial({
      map: rockTexture,
      bumpMap: rockTexture,
      bumpScale: 0.082,
      color: 0x988878,
      roughness: 0.97,
      metalness: 0.01,
    }),
    new THREE.MeshStandardMaterial({
      map: rockTexture,
      bumpMap: rockTexture,
      bumpScale: 0.105,
      color: 0x625b53,
      roughness: 1,
      metalness: 0.02,
    }),
  ];

  // A pool keeps the belt GPU-friendly while still providing varied silhouettes.
  const geometryPool = Array.from({ length: 14 }, (_, index) =>
    createCrateredRockGeometry(index + 11, index % 3 === 0 ? 4 : 3));

  const asteroidCount = 520;

  for (let index = 0; index < asteroidCount; index += 1) {
    const randomA = Math.random();
    const randomB = Math.random();

    // Most bodies are tiny. A small number become visibly large foreground rocks.
    let rockSize = 0.025 + Math.pow(randomA, 4.2) * 0.34;
    if (index < 14) rockSize = 0.36 + Math.random() * 0.44;
    else if (index < 52) rockSize = 0.15 + Math.random() * 0.24;

    const asteroid = new THREE.Mesh(
      geometryPool[Math.floor(Math.random() * geometryPool.length)],
      asteroidMaterials[Math.floor(Math.random() * asteroidMaterials.length)],
    );

    // Several overlapping orbital lanes avoid the appearance of one perfect wire ring.
    const lane = index % 5;
    const baseRadius = 43.2 + lane * 1.75;
    const radius = baseRadius + (Math.random() - 0.5) * 2.8;
    const angle = Math.random() * Math.PI * 2;
    const verticalSpread = (Math.random() - 0.5) * (0.9 + lane * 0.28);

    asteroid.position.set(
      Math.cos(angle) * radius,
      verticalSpread + Math.sin(angle * 3.0 + lane) * 0.16,
      Math.sin(angle) * radius,
    );

    asteroid.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );

    asteroid.scale.set(
      rockSize * (0.72 + randomB * 0.80),
      rockSize * (0.54 + Math.random() * 0.75),
      rockSize * (0.70 + Math.random() * 1.02),
    );

    asteroid.userData.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 0.0055,
      (Math.random() - 0.5) * 0.0065,
      (Math.random() - 0.5) * 0.0048,
    );

    asteroidGroup.add(asteroid);
  }

  world.add(asteroidGroup);
  return asteroidGroup;
}

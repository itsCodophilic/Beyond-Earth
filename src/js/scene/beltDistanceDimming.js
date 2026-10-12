import * as THREE from "three";

/**
 * The main asteroid belt, dimmer from afar.
 *
 * Round 40 (the owner: "what about the main asteroid belt? From far away the
 * whole thing is visible -- ideally a little dimmer"). From any distance at
 * which the whole belt fits on screen, no asteroid in it could be seen: Ceres,
 * the largest, is about magnitude 7 even from Earth. The belt's
 * "million-object pebble population" (asteroidBelt.js `createDistantDebris`)
 * draws every pebble at least 1.1 px wide at opacity 0.84, so from far out it
 * reads as a solid bright ring.
 *
 * asteroidBelt.js is frozen (standing rule: never written). It sets the
 * pebbles' `uOpacity` once, at 0.84, and never again, so this scales that
 * uniform from outside, each frame, by how large the belt is on screen:
 *
 *   belt 1,200 px across or more (you are at it or near it)  0.84, unchanged
 *   belt 300 px across or less (the whole system in view)    35% of that
 *   in between, eased.
 *
 * 300 and 1,200 px and the 35% floor are chosen by eye: "a little dimmer",
 * not gone, so the belt still says where it is. The solid rocks, the
 * instanced boulders and every interaction are untouched.
 */
const FULL_PX = 1200;
const DIM_PX = 300;
const FLOOR = 0.35;
const _centre = new THREE.Vector3();

export function dimBeltWithDistance(asteroidBelt, camera, viewportHeight = 800) {
  const debris = asteroidBelt?.distantDebris;
  const uniform = debris?.material?.uniforms?.uOpacity;
  if (!uniform || !camera) return;
  if (!asteroidBelt.distanceDimming) {
    if (!debris.geometry.boundingSphere) debris.geometry.computeBoundingSphere();
    asteroidBelt.distanceDimming = {
      base: uniform.value,
      /* The pebbles' own extent: they are spread over the belt's annulus. */
      radius: debris.geometry.boundingSphere.radius,
    };
  }
  const state = asteroidBelt.distanceDimming;
  debris.getWorldPosition(_centre);
  const radius = state.radius * debris.matrixWorld.getMaxScaleOnAxis();
  const distance = Math.max(1e-3, camera.position.distanceTo(_centre));
  const focalPixels = camera.projectionMatrix.elements[5] * viewportHeight * 0.5;
  const beltPixels = (radius / distance) * focalPixels * 2;
  const t = THREE.MathUtils.smoothstep(beltPixels, DIM_PX, FULL_PX);
  uniform.value = state.base * (FLOOR + (1 - FLOOR) * t);
}

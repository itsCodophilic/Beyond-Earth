/**
 * GPU particle systems for stars, galaxy arms, and asteroid dust.
 * THREE.Points can draw thousands of particles in one draw call, which is much
 * faster than creating thousands of independent sphere meshes.
 */
import * as THREE from "three";
import { makeTwinkleMaterial } from "../graphics/materials.js";

/*
  makeParticles
  - Builds a point cloud for stars, background dust, or a spiral Milky Way.
  - Each particle receives color, phase, speed, and scale attributes for per-star animation.
*/
export function makeParticles(scene, { count, radius, position, colors, size, spiral = false, opacity = 0.86 }) {
  // BufferGeometry stores raw typed arrays that can be uploaded directly to the GPU.
  const geometry = new THREE.BufferGeometry();
  // Positions/colors need x,y,z (three numbers) per particle. The other custom
  // attributes need one number per particle and are read by the vertex shader.
  const positions = new Float32Array(count * 3);
  const colorValues = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const palette = colors.map((color) => new THREE.Color(color));
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    if (spiral) {
      // Four repeating arms plus controlled randomness create a galaxy silhouette.
      const arm = i % 4;
      const distance = Math.pow(Math.random(), 0.58) * radius;
      const angle = distance * 0.11 + arm * Math.PI * 0.5 + (Math.random() - 0.5) * 0.55;
      positions[i3] = Math.cos(angle) * distance;
      positions[i3 + 1] = (Math.random() - 0.5) * (1.8 + distance * 0.025);
      positions[i3 + 2] = Math.sin(angle) * distance;
    } else {
      // Spherical coordinates distribute ordinary stars throughout 3D space.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = Math.pow(Math.random(), 0.72) * radius;
      positions[i3] = Math.sin(phi) * Math.cos(theta) * distance;
      positions[i3 + 1] = Math.cos(phi) * distance * 0.7;
      positions[i3 + 2] = Math.sin(phi) * Math.sin(theta) * distance;
    }
    // Each star receives independent appearance/animation values. Phase prevents
    // every star from twinkling at exactly the same moment.
    const color = palette[Math.floor(Math.random() * palette.length)];
    colorValues[i3] = color.r;
    colorValues[i3 + 1] = color.g;
    colorValues[i3 + 2] = color.b;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.8 + Math.random() * 3.8;
    scales[i] = 0.45 + Math.random() * 1.35;
  }
  // Attribute names beginning with `a` match declarations in materials.js.
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colorValues, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  // One Points object submits the entire populated BufferGeometry to WebGL.
  const points = new THREE.Points(geometry, makeTwinkleMaterial(size, opacity));
  points.position.copy(position);
  scene.add(points);
  return points;
}

/*
  makeBeltDust
  - Generates the asteroid belt dust field as a point cloud around the inner solar system.
*/
export function makeBeltDust(world) {
  const count = 1800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colorValues = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const palette = [new THREE.Color("#b6a08b"), new THREE.Color("#706257"), new THREE.Color("#d6c1a6")];
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    // Radius 44–52 places dust between Mars and Jupiter in this artistic model.
    const radius = 44 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = (Math.random() - 0.5) * 2.4;
    positions[i3 + 2] = Math.sin(angle) * radius;
    const color = palette[Math.floor(Math.random() * palette.length)];
    colorValues[i3] = color.r;
    colorValues[i3 + 1] = color.g;
    colorValues[i3 + 2] = color.b;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.25 + Math.random() * 1.2;
    scales[i] = 0.25 + Math.random() * 0.8;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colorValues, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  const dust = new THREE.Points(geometry, makeTwinkleMaterial(0.72, 0.34));
  world.add(dust);
  return dust;
}

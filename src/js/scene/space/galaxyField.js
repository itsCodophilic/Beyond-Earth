import * as THREE from "three";
import { galaxyFragmentShader, galaxyVertexShader } from "../../shaders/space/galaxyShaders.js";
import { createSeededRandom } from "./seededRandom.js";

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const direction = new THREE.Vector3();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const rollQuaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const color = new THREE.Color();

const FEATURED_GALAXIES = [
  { direction: [0.66, 0.38, -0.65], width: 86, type: 0, aspect: 0.44, brightness: 1.22, color: [0.72, 0.78, 0.94], roll: 0.28 },
  { direction: [-0.58, 0.68, -0.45], width: 74, type: 1, aspect: 0.18, brightness: 1.08, color: [0.86, 0.71, 0.55], roll: -0.64 },
  { direction: [-0.76, -0.34, 0.55], width: 68, type: 0, aspect: 0.54, brightness: 1.00, color: [0.68, 0.74, 0.89], roll: 1.16 },
  { direction: [0.31, -0.81, 0.49], width: 62, type: 2, aspect: 0.74, brightness: 0.92, color: [0.84, 0.71, 0.60], roll: 0.77 },
  { direction: [0.82, -0.18, 0.54], width: 56, type: 3, aspect: 0.66, brightness: 0.88, color: [0.66, 0.73, 0.87], roll: -1.05 },
  { direction: [-0.10, 0.88, 0.45], width: 52, type: 1, aspect: 0.20, brightness: 0.86, color: [0.82, 0.70, 0.56], roll: 0.32 },
  { direction: [0.14, -0.58, -0.80], width: 48, type: 2, aspect: 0.78, brightness: 0.82, color: [0.78, 0.70, 0.64], roll: -0.92 },
  { direction: [-0.91, 0.09, -0.40], width: 56, type: 0, aspect: 0.48, brightness: 0.86, color: [0.66, 0.74, 0.92], roll: 0.56 },
  { direction: [0.09, 0.15, 0.98], width: 60, type: 0, aspect: 0.50, brightness: 0.90, color: [0.73, 0.79, 0.95], roll: -0.48 },
  { direction: [-0.24, -0.94, -0.23], width: 50, type: 1, aspect: 0.18, brightness: 0.80, color: [0.88, 0.73, 0.57], roll: 1.06 },
  { direction: [0.95, 0.21, -0.22], width: 46, type: 2, aspect: 0.72, brightness: 0.78, color: [0.80, 0.72, 0.66], roll: 0.18 },
  { direction: [-0.34, 0.22, 0.91], width: 58, type: 0, aspect: 0.46, brightness: 0.84, color: [0.70, 0.77, 0.93], roll: -1.18 },
];

/**
 * Builds distant spiral, edge-on, elliptical, and irregular galaxies. A few
 * deliberately placed featured systems remain discoverable at every zoom
 * level; many smaller galaxies provide depth without filling black space.
 */
export function createGalaxyField({ count, radius }) {
  const random = createSeededRandom(0xb1643ac9);
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const data = new Float32Array(count * 4);
  geometry.setAttribute("aGalaxyData", new THREE.InstancedBufferAttribute(data, 4));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uVisibility: { value: 0 },
      uExposure: { value: 1 },
      uJourneyProgress: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
      uSunAngularRadius: { value: 0 },
    },
    vertexShader: galaxyVertexShader,
    fragmentShader: galaxyFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const galaxies = new THREE.InstancedMesh(geometry, material, count);
  galaxies.name = "Layered visible distant galaxy field";
  galaxies.frustumCulled = false;
  galaxies.renderOrder = -25;

  for (let index = 0; index < count; index += 1) {
    const featured = FEATURED_GALAXIES[index] ?? null;

    if (featured) {
      direction.fromArray(featured.direction).normalize();
    } else {
      const longitude = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const latitudeRadius = Math.sqrt(Math.max(0, 1 - y * y));
      direction.set(Math.cos(longitude) * latitudeRadius, y, Math.sin(longitude) * latitudeRadius);
    }

    position.copy(direction).multiplyScalar(radius + (random() - 0.5) * 90);
    quaternion.setFromUnitVectors(PLANE_NORMAL, direction.clone().negate());
    const roll = featured?.roll ?? random() * Math.PI * 2;
    rollQuaternion.setFromAxisAngle(direction, roll);
    quaternion.multiply(rollQuaternion);

    const type = featured?.type ?? Math.floor(random() * 4);
    const width = featured?.width ?? (10.0 + Math.pow(random(), 1.55) * 26.0);
    const aspect = featured?.aspect ?? (type === 1 ? 0.14 + random() * 0.14 : 0.40 + random() * 0.42);
    scale.set(width, width * aspect, 1);
    matrix.compose(position, quaternion, scale);
    galaxies.setMatrixAt(index, matrix);

    if (featured) color.fromArray(featured.color);
    else {
      const temperature = random();
      if (temperature < 0.48) color.setRGB(0.55, 0.62, 0.77);
      else if (temperature < 0.82) color.setRGB(0.78, 0.65, 0.51);
      else color.setRGB(0.67, 0.56, 0.72);
    }
    galaxies.setColorAt(index, color);

    const offset = index * 4;
    data[offset] = featured?.brightness ?? (0.24 + Math.pow(random(), 1.5) * 0.38);
    data[offset + 1] = type;
    data[offset + 2] = random();
    data[offset + 3] = aspect;
  }

  galaxies.instanceMatrix.needsUpdate = true;
  if (galaxies.instanceColor) galaxies.instanceColor.needsUpdate = true;
  geometry.attributes.aGalaxyData.needsUpdate = true;

  const capacity = count;

  return {
    object: galaxies,
    capacity,
    setCount(nextCount) {
      galaxies.count = Math.max(0, Math.min(capacity, Math.floor(nextCount)));
    },
    update({ visibility, exposure, journeyProgress = 0, sunDirection, sunAngularRadius = 0 }) {
      material.uniforms.uVisibility.value = visibility;
      material.uniforms.uExposure.value = exposure;
      material.uniforms.uJourneyProgress.value = journeyProgress;
      if (sunDirection) material.uniforms.uSunDirection.value.copy(sunDirection);
      material.uniforms.uSunAngularRadius.value = sunAngularRadius;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

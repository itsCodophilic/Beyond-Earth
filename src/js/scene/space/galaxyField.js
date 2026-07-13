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
  { direction: [0.66, 0.38, -0.65], width: 72, type: 0, aspect: 0.44, brightness: 1.16, color: [0.72, 0.78, 0.94], roll: 0.28 },
  { direction: [-0.58, 0.68, -0.45], width: 64, type: 1, aspect: 0.18, brightness: 1.00, color: [0.86, 0.71, 0.55], roll: -0.64 },
  { direction: [-0.76, -0.34, 0.55], width: 58, type: 0, aspect: 0.54, brightness: 0.94, color: [0.68, 0.74, 0.89], roll: 1.16 },
  { direction: [0.31, -0.81, 0.49], width: 52, type: 2, aspect: 0.74, brightness: 0.86, color: [0.84, 0.71, 0.60], roll: 0.77 },
  { direction: [0.82, -0.18, 0.54], width: 48, type: 3, aspect: 0.66, brightness: 0.82, color: [0.66, 0.73, 0.87], roll: -1.05 },
  { direction: [-0.10, 0.88, 0.45], width: 44, type: 1, aspect: 0.20, brightness: 0.80, color: [0.82, 0.70, 0.56], roll: 0.32 },
  { direction: [0.14, -0.58, -0.80], width: 40, type: 2, aspect: 0.78, brightness: 0.74, color: [0.78, 0.70, 0.64], roll: -0.92 },
  { direction: [-0.91, 0.09, -0.40], width: 46, type: 0, aspect: 0.48, brightness: 0.78, color: [0.66, 0.74, 0.92], roll: 0.56 },
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
    const width = featured?.width ?? (8.0 + Math.pow(random(), 1.6) * 22.0);
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
    data[offset] = featured?.brightness ?? (0.20 + Math.pow(random(), 1.6) * 0.34);
    data[offset + 1] = type;
    data[offset + 2] = random();
    data[offset + 3] = aspect;
  }

  galaxies.instanceMatrix.needsUpdate = true;
  if (galaxies.instanceColor) galaxies.instanceColor.needsUpdate = true;
  geometry.attributes.aGalaxyData.needsUpdate = true;

  return {
    object: galaxies,
    update({ visibility, exposure, journeyProgress = 0 }) {
      material.uniforms.uVisibility.value = visibility;
      material.uniforms.uExposure.value = exposure;
      material.uniforms.uJourneyProgress.value = journeyProgress;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

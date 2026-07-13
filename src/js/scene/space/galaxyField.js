import * as THREE from "three";
import { galaxyFragmentShader, galaxyVertexShader } from "../../shaders/space/galaxyShaders.js";
import { createSeededRandom } from "./seededRandom.js";

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const direction = new THREE.Vector3();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const color = new THREE.Color();

/**
 * Builds varied, tiny galaxy cards in one draw call. They exist throughout the
 * journey; the environment controller changes only perceptual visibility.
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
    },
    vertexShader: galaxyVertexShader,
    fragmentShader: galaxyFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: true,
  });

  const galaxies = new THREE.InstancedMesh(geometry, material, count);
  galaxies.name = "Faint distant galaxy field";
  galaxies.frustumCulled = false;
  galaxies.renderOrder = -27;

  for (let index = 0; index < count; index += 1) {
    const longitude = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const latitudeRadius = Math.sqrt(Math.max(0, 1 - y * y));
    direction.set(Math.cos(longitude) * latitudeRadius, y, Math.sin(longitude) * latitudeRadius);
    position.copy(direction).multiplyScalar(radius + (random() - 0.5) * 80);
    quaternion.setFromUnitVectors(PLANE_NORMAL, direction.clone().negate());
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(direction, random() * Math.PI * 2));

    const width = 3.2 + Math.pow(random(), 2.2) * 9.5;
    const type = Math.floor(random() * 3);
    const aspect = type === 1 ? 0.18 + random() * 0.18 : 0.45 + random() * 0.36;
    scale.set(width, width * aspect, 1);
    matrix.compose(position, quaternion, scale);
    galaxies.setMatrixAt(index, matrix);

    const temperature = random();
    if (temperature < 0.55) color.setRGB(0.56, 0.61, 0.69);
    else if (temperature < 0.88) color.setRGB(0.74, 0.61, 0.49);
    else color.setRGB(0.62, 0.52, 0.66);
    galaxies.setColorAt(index, color);

    const offset = index * 4;
    // Galaxies remain subtle smudges, but their baseline now survives inner-
    // system exposure instead of becoming mathematically invisible.
    data[offset] = 0.075 + Math.pow(random(), 2.4) * 0.17;
    data[offset + 1] = type;
    data[offset + 2] = random();
    data[offset + 3] = aspect;
  }

  galaxies.instanceMatrix.needsUpdate = true;
  if (galaxies.instanceColor) galaxies.instanceColor.needsUpdate = true;
  geometry.attributes.aGalaxyData.needsUpdate = true;

  return {
    object: galaxies,
    update({ visibility, exposure }) {
      material.uniforms.uVisibility.value = visibility;
      material.uniforms.uExposure.value = exposure;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

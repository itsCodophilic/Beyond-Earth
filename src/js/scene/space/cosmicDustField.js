import * as THREE from "three";
import { dustFragmentShader, dustVertexShader } from "../../shaders/space/dustShaders.js";
import { createSeededRandom, gaussian } from "./seededRandom.js";

/** Sparse interplanetary grains visible only at favourable Sun/view angles. */
export function createCosmicDustField({ count, maximumRadius, pixelRatio }) {
  const random = createSeededRandom(0xd057a11e);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const radialDistance = 12 + Math.sqrt(random()) * (maximumRadius - 12);
    const angle = random() * Math.PI * 2;
    positions[offset] = Math.cos(angle) * radialDistance;
    positions[offset + 1] = THREE.MathUtils.clamp(gaussian(random) * 7.5, -24, 24);
    positions[offset + 2] = Math.sin(angle) * radialDistance;
    sizes[index] = 0.70 + Math.pow(random(), 3.5) * 1.6;
    phases[index] = random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uVisibility: { value: 0 },
      uReducedMotion: { value: 0 },
      uSunPosition: { value: new THREE.Vector3() },
    },
    vertexShader: dustVertexShader,
    fragmentShader: dustFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Angle-dependent interplanetary dust";
  points.frustumCulled = false;
  points.renderOrder = -12;

  return {
    object: points,
    update({ time, visibility, sunPosition, reducedMotion }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uVisibility.value = visibility;
      material.uniforms.uSunPosition.value.copy(sunPosition);
      material.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
      if (!reducedMotion) points.rotation.y = time * 0.00045;
    },
    resize(pixelRatioValue) {
      material.uniforms.uPixelRatio.value = pixelRatioValue;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}


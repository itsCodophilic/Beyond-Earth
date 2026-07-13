import * as THREE from "three";
import { heroStarFragmentShader, heroStarVertexShader } from "../../shaders/space/starShaders.js";
import { createSeededRandom } from "./seededRandom.js";
import { getStellarColor } from "./starField.js";

/** Creates the tiny population of bright stars with camera-optics diffraction. */
export function createHeroStarField({ count, radius, pixelRatio }) {
  const random = createSeededRandom(0xf18a77c3);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightnesses = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const longitude = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const latitudeRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const offset = index * 3;
    positions[offset] = Math.cos(longitude) * latitudeRadius * radius;
    positions[offset + 1] = y * radius;
    positions[offset + 2] = Math.sin(longitude) * latitudeRadius * radius;
    getStellarColor(random, 0.82 + random() * 0.18, color);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 7.5 + random() * 7;
    brightnesses[index] = 0.55 + random() * 0.38;
    phases[index] = random() * Math.PI * 2;
    speeds[index] = 0.018 + random() * 0.036;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightnesses, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uVisibility: { value: 0 },
      uExposure: { value: 1 },
      uSolarSuppression: { value: 1 },
      uReducedMotion: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: heroStarVertexShader,
    fragmentShader: heroStarFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Rare optical hero stars";
  points.frustumCulled = false;
  points.renderOrder = -26;

  return {
    object: points,
    update({ time, visibility, exposure, solarSuppression, sunDirection, reducedMotion }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uVisibility.value = reducedMotion ? visibility * 0.35 : visibility;
      material.uniforms.uExposure.value = exposure;
      material.uniforms.uSolarSuppression.value = solarSuppression;
      material.uniforms.uSunDirection.value.copy(sunDirection);
      material.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
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


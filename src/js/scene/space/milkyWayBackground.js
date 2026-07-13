import * as THREE from "three";
import { milkyWayFragmentShader, milkyWayVertexShader } from "../../shaders/space/milkyWayShaders.js";
import { createSeededRandom, gaussian } from "./seededRandom.js";
import { createStarMaterial, getStellarColor } from "./starField.js";

function createGalacticStarGeometry(count, radius) {
  const random = createSeededRandom(0x9a4e21c7);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightnesses = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const halos = new Float32Array(count);
  const color = new THREE.Color();
  const warmCore = new THREE.Color(1, 0.78, 0.56);
  let accepted = 0;

  while (accepted < count) {
    const centreBiased = random() < 0.46;
    const longitude = centreBiased
      ? THREE.MathUtils.clamp(gaussian(random) * 0.82, -Math.PI, Math.PI)
      : random() * Math.PI * 2 - Math.PI;
    const latitude = gaussian(random) * (centreBiased ? 0.105 : 0.145);
    if (Math.abs(latitude) > 0.46) continue;

    const lane = Math.sin(longitude * 3.1 + 0.7) * 0.023;
    if (Math.abs(latitude - lane) < 0.025 && random() < 0.78) continue;

    const cosLatitude = Math.cos(latitude);
    const pointRadius = radius - 8 + random() * 16;
    const offset = accepted * 3;
    positions[offset] = Math.cos(longitude) * cosLatitude * pointRadius;
    positions[offset + 1] = Math.sin(latitude) * pointRadius;
    positions[offset + 2] = Math.sin(longitude) * cosLatitude * pointRadius;

    const coreStrength = Math.exp(-Math.pow(Math.abs(longitude) / 0.90, 1.6));
    const brightTail = Math.pow(random(), 5.2);
    getStellarColor(random, 0.24 + brightTail * 0.52 + coreStrength * 0.18, color);
    color.lerp(warmCore, coreStrength * 0.24);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    // Most stars remain sub-pixel points, but a brighter tail resolves against
    // the diffuse clouds like a real long-exposure Milky Way photograph.
    sizes[accepted] = 1.24 + brightTail * 3.45 + coreStrength * random() * 0.46;
    brightnesses[accepted] = 0.40 + brightTail * 0.58 + coreStrength * 0.15;
    phases[accepted] = random() * Math.PI * 2;
    speeds[accepted] = 0.028 + random() * 0.055;
    halos[accepted] = 0.08 + brightTail * 0.16;
    accepted += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightnesses, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aHalo", new THREE.BufferAttribute(halos, 1));
  return geometry;
}

/** Continuous great-circle Milky Way plus the resolved stellar population. */
export function createMilkyWayBackground({ count, radius, pixelRatio, rotation }) {
  const group = new THREE.Group();
  group.name = "Tilted Milky Way plane";
  group.rotation.set(...rotation);

  const glowGeometry = new THREE.SphereGeometry(radius, 96, 64);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uVisibility: { value: 0 },
      uContrast: { value: 1 },
      uSolarSuppression: { value: 1 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: milkyWayVertexShader,
    fragmentShader: milkyWayFragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    // The galactic veil is already authored in display-friendly values. Keeping
    // it outside the bright planetary exposure curve prevents it disappearing.
    toneMapped: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.name = "Diffuse Milky Way with dark dust lanes";
  glow.frustumCulled = false;
  glow.renderOrder = -30;

  const starGeometry = createGalacticStarGeometry(count, radius - 20);
  const starMaterial = createStarMaterial({ pixelRatio, maxPointSize: 4.5 });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = "Resolved Milky Way stars";
  stars.frustumCulled = false;
  stars.renderOrder = -28;
  group.add(glow, stars);

  return {
    object: group,
    update({ time, visibility, contrast, exposure, solarSuppression, sunDirection, reducedMotion }) {
      glowMaterial.uniforms.uVisibility.value = visibility;
      glowMaterial.uniforms.uContrast.value = contrast;
      glowMaterial.uniforms.uSolarSuppression.value = solarSuppression;
      glowMaterial.uniforms.uSunDirection.value.copy(sunDirection);
      starMaterial.uniforms.uTime.value = time;
      starMaterial.uniforms.uVisibility.value = Math.min(1, visibility * 1.14);
      starMaterial.uniforms.uExposure.value = exposure;
      starMaterial.uniforms.uSolarSuppression.value = solarSuppression;
      starMaterial.uniforms.uSunDirection.value.copy(sunDirection);
      starMaterial.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
    },
    resize(pixelRatioValue) {
      starMaterial.uniforms.uPixelRatio.value = pixelRatioValue;
    },
    dispose() {
      glowGeometry.dispose();
      glowMaterial.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
    },
  };
}

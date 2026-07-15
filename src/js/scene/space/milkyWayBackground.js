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
  const warmCore = new THREE.Color(1, 0.80, 0.62);
  let accepted = 0;

  while (accepted < count) {
    const centreBiased = random() < 0.34;
    const longitude = centreBiased
      ? THREE.MathUtils.clamp(gaussian(random) * 0.72, -Math.PI, Math.PI)
      : random() * Math.PI * 2 - Math.PI;

    const bandCentre =
      Math.sin(longitude * 0.72 + 0.8) * 0.042 +
      Math.sin(longitude * 2.35 - 1.1) * 0.014;
    const latitude = bandCentre + gaussian(random) * (centreBiased ? 0.070 : 0.105);
    if (Math.abs(latitude - bandCentre) > 0.33) continue;

    // Several broad longitude patches prevent the band from looking like an
    // even sprayed line. Large black intervals remain between dense regions.
    const patchDensity = THREE.MathUtils.clamp(
      0.46
        + Math.sin(longitude * 2.7 + 0.8) * 0.18
        + Math.sin(longitude * 6.3 - 1.6) * 0.13
        + (centreBiased ? 0.22 : 0),
      0.12,
      1,
    );
    if (random() > patchDensity) continue;

    const cosLatitude = Math.cos(latitude);
    const pointRadius = radius - 10 + random() * 20;
    const offset = accepted * 3;
    positions[offset] = Math.cos(longitude) * cosLatitude * pointRadius;
    positions[offset + 1] = Math.sin(latitude) * pointRadius;
    positions[offset + 2] = Math.sin(longitude) * cosLatitude * pointRadius;

    const coreStrength = Math.exp(-Math.pow(Math.abs(longitude) / 0.82, 1.7));
    const brightTail = Math.pow(random(), 7.2);
    getStellarColor(random, 0.18 + brightTail * 0.58 + coreStrength * 0.12, color);
    color.lerp(warmCore, coreStrength * 0.16);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;

    sizes[accepted] = 0.96 + brightTail * 3.05 + coreStrength * random() * 0.42;
    brightnesses[accepted] = 0.32 + brightTail * 0.74 + coreStrength * 0.14;
    phases[accepted] = random() * Math.PI * 2;
    speeds[accepted] = 0.020 + random() * 0.045;
    halos[accepted] = 0.055 + brightTail * 0.17;
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

/** Narrow, patchy great-circle Milky Way plus its resolved stellar population. */
export function createMilkyWayBackground({ count, radius, pixelRatio, rotation }) {
  const group = new THREE.Group();
  group.name = "Distant diagonal Milky Way";
  group.rotation.set(...rotation);

  const glowGeometry = new THREE.SphereGeometry(radius, 112, 72);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uVisibility: { value: 0 },
      uContrast: { value: 1 },
      uSolarSuppression: { value: 1 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
      uSunAngularRadius: { value: 0 },
    },
    vertexShader: milkyWayVertexShader,
    fragmentShader: milkyWayFragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.name = "Restrained diffuse galactic band";
  glow.frustumCulled = false;
  glow.renderOrder = -30;

  const starGeometry = createGalacticStarGeometry(count, radius - 22);
  const starMaterial = createStarMaterial({ pixelRatio, maxPointSize: 4.5 });
  const stars = new THREE.Points(starGeometry, starMaterial);
  stars.name = "Patchy resolved Milky Way stars";
  stars.frustumCulled = false;
  stars.renderOrder = -28;
  group.add(glow, stars);

  return {
    object: group,
    update({ time, visibility, contrast, exposure, solarSuppression, sunDirection, sunAngularRadius = 0, reducedMotion }) {
      glowMaterial.uniforms.uVisibility.value = visibility;
      glowMaterial.uniforms.uContrast.value = contrast;
      glowMaterial.uniforms.uSolarSuppression.value = solarSuppression;
      glowMaterial.uniforms.uSunDirection.value.copy(sunDirection);
      glowMaterial.uniforms.uSunAngularRadius.value = sunAngularRadius;

      starMaterial.uniforms.uTime.value = time;
      starMaterial.uniforms.uVisibility.value = Math.min(1.48, visibility * 1.16);
      starMaterial.uniforms.uExposure.value = exposure;
      starMaterial.uniforms.uSolarSuppression.value = solarSuppression;
      starMaterial.uniforms.uSunDirection.value.copy(sunDirection);
      starMaterial.uniforms.uSunAngularRadius.value = sunAngularRadius;
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

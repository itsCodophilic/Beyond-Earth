import * as THREE from "three";
import { starFragmentShader, starVertexShader } from "../../shaders/space/starShaders.js";
import { createSeededRandom, gaussian } from "./seededRandom.js";

const FAINT_STAR_COLOR = new THREE.Color(0.84, 0.85, 0.87);
const STAR_PALETTE = [
  { threshold: 0.67, color: new THREE.Color(0.95, 0.97, 1.0) },
  { threshold: 0.83, color: new THREE.Color(1.0, 0.92, 0.76) },
  { threshold: 0.93, color: new THREE.Color(0.80, 0.87, 1.0) },
  { threshold: 0.987, color: new THREE.Color(1.0, 0.75, 0.52) },
  { threshold: 1, color: new THREE.Color(0.72, 0.80, 1.0) },
];

/** Writes a restrained stellar-temperature color into a reusable target. */
export function getStellarColor(random, brightness, target) {
  const roll = random();
  const paletteColor = STAR_PALETTE.find((entry) => roll <= entry.threshold).color;
  target.copy(paletteColor).lerp(FAINT_STAR_COLOR, 1 - brightness);
  return target;
}

export function createStarMaterial({ pixelRatio, maxPointSize = 4.8 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uMaxPointSize: { value: maxPointSize },
      uVisibility: { value: 0 },
      uExposure: { value: 1 },
      uSolarSuppression: { value: 1 },
      uReducedMotion: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function makeStarGeometry({ count, minimumRadius, maximumRadius, seed, midDistance = false }) {
  const random = createSeededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightnesses = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const halos = new Float32Array(count);
  const color = new THREE.Color();
  const voidDirection = new THREE.Vector3(-0.24, 0.68, 0.69).normalize();
  const clusterDirectionA = new THREE.Vector3(0.63, 0.28, -0.72).normalize();
  const clusterDirectionB = new THREE.Vector3(-0.48, -0.32, -0.82).normalize();
  const direction = new THREE.Vector3();
  let accepted = 0;

  while (accepted < count) {
    const inLooseBand = !midDistance && random() < 0.13;
    const longitude = random() * Math.PI * 2;
    const latitude = inLooseBand
      ? THREE.MathUtils.clamp(gaussian(random) * 0.34, -0.82, 0.82)
      : Math.asin(random() * 2 - 1);
    const cosLatitude = Math.cos(latitude);
    direction.set(
      Math.cos(longitude) * cosLatitude,
      Math.sin(latitude),
      Math.sin(longitude) * cosLatitude,
    );

    if (direction.dot(voidDirection) > 0.90 && random() < 0.78) continue;

    // Two loose stellar associations create subtle density changes without
    // turning the background into a repeating wallpaper.
    const clusterBoost = Math.max(
      0,
      Math.pow(Math.max(direction.dot(clusterDirectionA), 0), 12),
      Math.pow(Math.max(direction.dot(clusterDirectionB), 0), 15),
    );
    if (!midDistance && random() > 0.84 + clusterBoost * 0.16) continue;

    const radius = THREE.MathUtils.lerp(minimumRadius, maximumRadius, random());
    const offset = accepted * 3;
    positions[offset] = direction.x * radius;
    positions[offset + 1] = direction.y * radius;
    positions[offset + 2] = direction.z * radius;

    const brightTail = Math.pow(random(), midDistance ? 6.0 : 7.8);
    const perceptualBrightness = 0.30 + brightTail * 0.82 + clusterBoost * 0.08;
    getStellarColor(random, 0.22 + brightTail * 0.68, color);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[accepted] = (midDistance ? 1.18 : 0.92) + brightTail * (midDistance ? 3.20 : 2.75);
    brightnesses[accepted] = perceptualBrightness;
    phases[accepted] = random() * Math.PI * 2;
    speeds[accepted] = 0.024 + random() * 0.052;
    halos[accepted] = 0.050 + brightTail * 0.18;
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
  geometry.computeBoundingSphere();
  return geometry;
}

/** Creates either the fixed deep sky or the gently parallaxing nearer layer. */
export function createStarField({
  count,
  minimumRadius,
  maximumRadius,
  seed,
  pixelRatio,
  name,
  midDistance = false,
}) {
  const geometry = makeStarGeometry({ count, minimumRadius, maximumRadius, seed, midDistance });
  const material = createStarMaterial({ pixelRatio, maxPointSize: midDistance ? 4.6 : 4.8 });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;
  points.renderOrder = midDistance ? -24 : -29;

  return {
    object: points,
    material,
    update({ time, visibility, exposure, solarSuppression, sunDirection, reducedMotion }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uVisibility.value = visibility;
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

import * as THREE from "three";
import { dustFragmentShader, dustVertexShader } from "../../shaders/space/dustShaders.js";
import { createSeededRandom, gaussian } from "./seededRandom.js";
import { PLANET_SCALE_PROFILES } from "../../config/celestialScale.js";

const SUN_VISUAL_RADIUS = PLANET_SCALE_PROFILES.Sun.visualRadius;
const SUN_DUST_CLEARANCE_RADIUS = SUN_VISUAL_RADIUS * 1.06;

/**
 * Stylized interplanetary and near-interstellar dust.
 *
 * The field intentionally mixes three populations:
 * 1) an ecliptic-biased zodiacal population near the planetary plane,
 * 2) a diffuse isotropic haze so the universe never feels empty above/below,
 * 3) broad clustered dust pockets that read as small and large dusty regions
 *    when the camera is pulled very far back.
 */
export function createCosmicDustField({ count, maximumRadius, pixelRatio }) {
  const random = createSeededRandom(0xd057a11e);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  const clusterCount = 14;
  const clusters = Array.from({ length: clusterCount }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const elevation = THREE.MathUtils.lerp(-0.92, 0.92, random());
    const radialDistance = THREE.MathUtils.lerp(110, maximumRadius * 0.94, Math.pow(random(), 0.72));
    const direction = new THREE.Vector3(
      Math.cos(angle) * Math.sqrt(Math.max(0, 1 - elevation * elevation)),
      elevation,
      Math.sin(angle) * Math.sqrt(Math.max(0, 1 - elevation * elevation)),
    ).normalize();
    const spread = THREE.MathUtils.lerp(16, 62, Math.pow(random(), 0.9));
    return {
      center: direction.multiplyScalar(radialDistance),
      spreadX: spread * THREE.MathUtils.lerp(0.8, 1.8, random()),
      spreadY: spread * THREE.MathUtils.lerp(0.7, 1.45, random()),
      spreadZ: spread * THREE.MathUtils.lerp(0.8, 1.8, random()),
      sizeBias: index < 4 ? 1.24 : 1.0,
    };
  });

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const population = random();

    if (population < 0.38) {
      // Classical zodiacal/ecliptic dust with moderate thickness.
      const radialDistance = 22 + Math.sqrt(random()) * (maximumRadius * 0.74 - 22);
      const angle = random() * Math.PI * 2;
      positions[offset] = Math.cos(angle) * radialDistance;
      positions[offset + 1] = THREE.MathUtils.clamp(gaussian(random) * 22, -88, 88);
      positions[offset + 2] = Math.sin(angle) * radialDistance;
      sizes[index] = 0.42 + Math.pow(random(), 3.2) * 0.90;
    } else if (population < 0.68) {
      // Diffuse 3D background grains so dust exists in all directions.
      const radius = THREE.MathUtils.lerp(70, maximumRadius, Math.pow(random(), 0.82));
      const theta = random() * Math.PI * 2;
      const y = THREE.MathUtils.lerp(-1, 1, random());
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      positions[offset] = Math.cos(theta) * radial * radius;
      positions[offset + 1] = y * radius * THREE.MathUtils.lerp(0.70, 1.0, random());
      positions[offset + 2] = Math.sin(theta) * radial * radius;
      sizes[index] = 0.40 + Math.pow(random(), 3.8) * 0.82;
    } else {
      // Broad cloud pockets: some small, some large, scattered in all directions.
      const cluster = clusters[Math.floor(random() * clusters.length)];
      positions[offset] = cluster.center.x + gaussian(random) * cluster.spreadX;
      positions[offset + 1] = cluster.center.y + gaussian(random) * cluster.spreadY;
      positions[offset + 2] = cluster.center.z + gaussian(random) * cluster.spreadZ;
      sizes[index] = (0.46 + Math.pow(random(), 2.6) * 1.16) * cluster.sizeBias;
    }

    // The cinematic Sun is intentionally much larger than the original dust
    // field's inner radius. Keep physical dust grains outside a generous solar
    // clearance volume so they cannot occupy the photosphere or corona.
    const distanceFromSun = Math.hypot(
      positions[offset],
      positions[offset + 1],
      positions[offset + 2],
    );
    if (distanceFromSun < SUN_DUST_CLEARANCE_RADIUS) {
      const safeDistance = Math.max(distanceFromSun, 0.0001);
      const outwardDistance = SUN_DUST_CLEARANCE_RADIUS + random() * SUN_VISUAL_RADIUS * 0.72;
      positions[offset] = positions[offset] / safeDistance * outwardDistance;
      positions[offset + 1] = positions[offset + 1] / safeDistance * outwardDistance;
      positions[offset + 2] = positions[offset + 2] / safeDistance * outwardDistance;
    }

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
      uSunRadius: { value: SUN_VISUAL_RADIUS },
      uSunAngularRadius: { value: 0 },
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
  points.name = "Clustered cosmic dust and interplanetary haze";
  points.frustumCulled = false;
  points.renderOrder = -120;

  return {
    object: points,
    update({ time, visibility, sunPosition, sunAngularRadius = 0, reducedMotion }) {
      material.uniforms.uTime.value = time;
      material.uniforms.uVisibility.value = visibility;
      material.uniforms.uSunPosition.value.copy(sunPosition);
      material.uniforms.uSunAngularRadius.value = sunAngularRadius;
      material.uniforms.uReducedMotion.value = reducedMotion ? 1 : 0;
      if (!reducedMotion) points.rotation.y = time * 0.00014;
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

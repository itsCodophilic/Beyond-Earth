/**
 * Distant space environment for the solar-system experience.
 *
 * This module treats stars and the Milky Way as a celestial backdrop rather
 * than nearby coloured particles. All stars sit on distant spherical shells,
 * so moving hundreds of scene units through the solar system does not make the
 * constellations rush past the camera. The Milky Way follows a tilted great
 * circle with a continuous cloudy glow and genuine dark gaps in its star field.
 */
import * as THREE from "three";

const STAR_SHELL_RADIUS = 1700;
const GALACTIC_SHELL_RADIUS = 1600;

/** Deterministic random numbers keep the sky identical between page loads. */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller transform used for natural centre-heavy latitude distributions. */
function gaussian(random) {
  const first = Math.max(1e-7, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(Math.PI * 2 * second);
}

/**
 * Stars are mostly perceived as white. Only a restrained minority receive a
 * visible warm or cool tint based on stellar temperature classes.
 */
function chooseStellarColor(random, brightness) {
  const roll = random();
  const color = new THREE.Color();

  if (roll < 0.68) color.setRGB(0.94, 0.96, 1.0); // white / blue-white
  else if (roll < 0.82) color.setRGB(1.0, 0.91, 0.73); // yellow-white
  else if (roll < 0.92) color.setRGB(0.77, 0.86, 1.0); // subtle cool star
  else if (roll < 0.985) color.setRGB(1.0, 0.72, 0.48); // orange star
  else color.setRGB(0.64, 0.76, 1.0); // rare hot blue star

  // Faint stars lose visible colour and approach neutral grey-white.
  color.lerp(new THREE.Color(0.82, 0.84, 0.86), 1 - brightness);
  return color;
}

/** Creates sharp stellar points without atmospheric twinkling. */
function createStarMaterial(opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aMagnitude;
      varying vec3 vColor;
      varying float vBrightness;
      uniform float uPixelRatio;

      void main() {
        vColor = aColor;
        vBrightness = clamp(aMagnitude / 4.8, 0.18, 1.0);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(
          aMagnitude * uPixelRatio * (920.0 / max(1.0, -viewPosition.z)),
          0.55,
          4.6
        );
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vBrightness;
      uniform float uOpacity;

      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCentre = length(point);
        float core = 1.0 - smoothstep(0.08, 0.25, distanceFromCentre);
        float halo = (1.0 - smoothstep(0.12, 0.50, distanceFromCentre)) * 0.24;
        float alpha = (core + halo) * uOpacity * (0.46 + vBrightness * 0.54);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(vColor * (0.76 + vBrightness * 0.50), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
}

/** Builds the all-sky background stars on one distant spherical shell. */
function createBackgroundStars() {
  const random = createRandom(0x51a7f13d);
  const count = 18500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const longitude = random() * Math.PI * 2;
    const cosineLatitude = random() * 2 - 1;
    const latitudeRadius = Math.sqrt(Math.max(0, 1 - cosineLatitude * cosineLatitude));
    const radius = STAR_SHELL_RADIUS + (random() - 0.5) * 55;

    positions[offset] = Math.cos(longitude) * latitudeRadius * radius;
    positions[offset + 1] = cosineLatitude * radius;
    positions[offset + 2] = Math.sin(longitude) * latitudeRadius * radius;

    // Most stars are extremely faint; a very small tail becomes recognizably bright.
    const brightness = Math.pow(random(), 6.8);
    const magnitude = 0.72 + brightness * 4.05;
    const color = chooseStellarColor(random, 0.30 + brightness * 0.70);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    magnitudes[index] = magnitude;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aMagnitude", new THREE.BufferAttribute(magnitudes, 1));
  geometry.computeBoundingSphere();

  const stars = new THREE.Points(geometry, createStarMaterial(0.82));
  stars.name = "Distant stellar sphere";
  stars.frustumCulled = false;
  stars.renderOrder = -20;
  return stars;
}

/**
 * Continuous procedural Milky Way glow. The absence of a bitmap avoids a seam
 * around the sphere, while layered 3D noise creates cloudy stellar structure.
 */
function createMilkyWayGlow() {
  const geometry = new THREE.SphereGeometry(GALACTIC_SHELL_RADIUS, 96, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDirection;
      uniform float uOpacity;

      float hash(vec3 point) {
        point = fract(point * 0.3183099 + 0.1);
        point *= 17.0;
        return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
      }

      float noise3(vec3 point) {
        vec3 cell = floor(point);
        vec3 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(mix(hash(cell), hash(cell + vec3(1,0,0)), local.x),
              mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), local.x), local.y),
          mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), local.x),
              mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), local.x), local.y),
          local.z
        );
      }

      float fbm(vec3 point) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 5; octave++) {
          value += noise3(point) * amplitude;
          point = point * 2.03 + vec3(7.1, 3.7, 5.9);
          amplitude *= 0.48;
        }
        return value;
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float longitude = atan(direction.z, direction.x);
        float warpedLatitude = latitude
          + sin(longitude * 2.0) * 0.026
          + sin(longitude * 5.0 + 0.8) * 0.012;

        // The broad glow is intentionally wider than the sharp star band. From
        // inside the Milky Way, its unresolved light occupies a large portion
        // of a dark sky rather than appearing as a thin painted stripe.
        float broadBand = exp(-pow(abs(warpedLatitude) / 0.285, 1.48));
        float brightCore = exp(-pow(abs(longitude) / 0.82, 1.65));
        float clouds = fbm(direction * 7.0 + vec3(3.2, 8.4, 1.7));
        float fineClouds = fbm(direction * 19.0 + vec3(11.0, 2.0, 6.0));

        // An irregular absence of light through the centre forms the galactic dust lane.
        float lanePosition = sin(longitude * 3.1 + clouds * 2.4) * 0.022;
        float darkLane = exp(-pow(abs(warpedLatitude - lanePosition) / 0.040, 1.35));
        float mottledLane = darkLane * (0.48 + fineClouds * 0.48);

        float density = broadBand * (0.24 + clouds * 0.54 + fineClouds * 0.20);
        density *= 0.68 + brightCore * 0.76;
        density *= 1.0 - mottledLane * 0.80;

        vec3 coolOuter = vec3(0.30, 0.37, 0.46);
        vec3 warmCore = vec3(0.78, 0.62, 0.48);
        vec3 color = mix(coolOuter, warmCore, brightCore * 0.72 + clouds * 0.16);
        // This is still low-opacity integrated starlight, but it must survive
        // the scene's cinematic tone mapping and remain legible behind planets.
        float alpha = density * uOpacity * 0.52;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color * (0.58 + density * 0.72), alpha);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });

  const glow = new THREE.Mesh(geometry, material);
  glow.name = "Diffuse Milky Way and dust lanes";
  glow.frustumCulled = false;
  glow.renderOrder = -19;
  return glow;
}

/** Creates the dense stellar population following the Milky Way great circle. */
function createGalacticStars() {
  const random = createRandom(0x9a4e21c7);
  const count = 36000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  let accepted = 0;

  while (accepted < count) {
    // Some longitudes are concentrated toward the galactic centre; the rest
    // preserve a continuous band around the entire sky.
    const centreBiased = random() < 0.46;
    const longitude = centreBiased
      ? THREE.MathUtils.clamp(gaussian(random) * 0.82, -Math.PI, Math.PI)
      : random() * Math.PI * 2 - Math.PI;
    const latitude = gaussian(random) * (centreBiased ? 0.105 : 0.145);
    if (Math.abs(latitude) > 0.46) continue;

    // Reject stars through a warped central lane, leaving authentic dark rifts.
    const lane = Math.sin(longitude * 3.1 + 0.7) * 0.023;
    const laneDistance = Math.abs(latitude - lane);
    if (laneDistance < 0.025 && random() < 0.78) continue;

    const cosLatitude = Math.cos(latitude);
    const radius = GALACTIC_SHELL_RADIUS - 8 + random() * 16;
    const offset = accepted * 3;
    positions[offset] = Math.cos(longitude) * cosLatitude * radius;
    positions[offset + 1] = Math.sin(latitude) * radius;
    positions[offset + 2] = Math.sin(longitude) * cosLatitude * radius;

    const coreStrength = Math.exp(-Math.pow(Math.abs(longitude) / 0.90, 1.6));
    const brightness = Math.pow(random(), 5.2);
    const magnitude = 0.55 + brightness * 2.25 + coreStrength * random() * 0.42;
    const color = chooseStellarColor(random, 0.24 + brightness * 0.52 + coreStrength * 0.18);
    // Galactic-centre stars lean gently warm without becoming red particle noise.
    color.lerp(new THREE.Color(1.0, 0.78, 0.56), coreStrength * 0.24);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    magnitudes[accepted] = magnitude;
    accepted += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aMagnitude", new THREE.BufferAttribute(magnitudes, 1));
  geometry.computeBoundingSphere();

  const stars = new THREE.Points(geometry, createStarMaterial(0));
  stars.name = "Milky Way resolved stars";
  stars.frustumCulled = false;
  stars.renderOrder = -18;
  return stars;
}

/** Creates and attaches the full space backdrop. */
export function createSpaceEnvironment(scene) {
  const root = new THREE.Group();
  root.name = "Solar-system space environment";

  const backgroundStars = createBackgroundStars();
  const milkyWayGlow = createMilkyWayGlow();
  const galacticStars = createGalacticStars();

  // The galactic plane is tilted relative to the solar system's ecliptic plane.
  const galacticPlane = new THREE.Group();
  galacticPlane.name = "Tilted galactic plane";
  // This orientation keeps the great circle in the camera's principal journey
  // view while still visibly tilting it away from the solar-system ecliptic.
  galacticPlane.rotation.set(-0.17, 0, 0.18);
  galacticPlane.add(milkyWayGlow, galacticStars);

  root.add(backgroundStars, galacticPlane);
  scene.add(root);

  return {
    root,
    backgroundStars,
    milkyWayGlow,
    galacticStars,
  };
}

/**
 * Reveals deeper galactic structure as the journey expands beyond the planets.
 * The sky remains fixed—space itself does not rotate around the solar system.
 */
export function updateSpaceEnvironment(environment, progress) {
  if (!environment) return;
  const reveal = THREE.MathUtils.smoothstep(progress, 0.10, 0.72);
  environment.milkyWayGlow.material.uniforms.uOpacity.value = 0.16 + reveal * 0.84;
  environment.galacticStars.material.uniforms.uOpacity.value = 0.14 + reveal * 0.80;
  environment.backgroundStars.material.uniforms.uOpacity.value = 0.76 + reveal * 0.10;
}

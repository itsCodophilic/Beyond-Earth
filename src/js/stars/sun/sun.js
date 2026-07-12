/**
 * Layered Sun builder.
 *
 * A believable star cannot be represented by one textured sphere. This module
 * combines several inexpensive layers, each responsible for a different effect:
 * - photosphere: animated turbulent surface
 * - chromosphere: thin orange rim immediately above the surface
 * - corona shells: broad moving plasma visible around the silhouette
 * - glow sprite: soft bloom extending into surrounding space
 * - spicules: a thin, uneven fringe of flame attached to the limb
 * - plasma jets: a few localized eruptions that rise and dissolve outward
 */
import * as THREE from "three";
import { makeSunSurfaceMaterial } from "../../graphics/materials.js";
import { makeGlowTexture, makeNoiseTexture } from "../../graphics/proceduralTextures.js";

const SUN_RADIUS = 9.2;

/** Creates a Fresnel-based shell that is strongest around the Sun's outer edge. */
function createAtmosphereMaterial({ color, intensity, speed, power }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uSpeed: { value: speed },
      uPower: { value: power },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uSpeed;
      uniform float uPower;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec3 vWorldPosition;

      void main() {
        // Fresnel becomes bright where the surface normal turns away from camera.
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), uPower);
        float waves = sin(vWorldPosition.y * 1.4 + uTime * uSpeed)
          * sin(vWorldPosition.x * 0.8 - uTime * uSpeed * 0.7);
        float plasma = 0.78 + waves * 0.22;
        float alpha = fresnel * uIntensity * plasma;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(uColor * (1.0 + fresnel * 0.75), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
}

/** Converts latitude/longitude into an outward unit direction on the Sun. */
function sphericalDirection(latitude, longitude) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

/** Builds many tiny radial flames that form the reference image's uneven limb. */
function createSpicules() {
  const group = new THREE.Group();
  const geometry = new THREE.ConeGeometry(0.032, 0.46, 4, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const up = new THREE.Vector3(0, 1, 0);
  const count = 720;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const palette = [new THREE.Color(0xff5412), new THREE.Color(0xff8f22), new THREE.Color(0xffc94c)];

  for (let index = 0; index < count; index += 1) {
    // Fibonacci distribution covers the sphere evenly without random clumps.
    const y = 1 - (index / (count - 1)) * 2;
    const ringRadius = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const direction = new THREE.Vector3(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius);
    const height = 0.16 + ((index * 37) % 31) / 31 * 0.72;
    position.copy(direction).multiplyScalar(SUN_RADIUS + height * 0.43);
    quaternion.setFromUnitVectors(up, direction);
    scale.set(0.5 + (index % 4) * 0.11, height / 0.46, 0.5 + (index % 3) * 0.13);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, palette[index % palette.length]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.userData.phase = 0.7;
  group.add(mesh);
  return group;
}

/** Creates one localized eruption that streams outward and fades into the corona. */
function createPlasmaJet({ latitude, longitude, height, bend, phase }, fireTexture) {
  const direction = sphericalDirection(latitude, longitude);
  const tangent = new THREE.Vector3(-direction.z, 0.3, direction.x).normalize();
  const group = new THREE.Group();
  const colors = [0xff5a12, 0xff8b22, 0xffbd43, 0xffe990, 0xffffff];

  const particles = Array.from({ length: 26 }, (_, index) => {
    const particle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fireTexture,
      color: colors[index % colors.length],
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    particle.userData.offset = index / 26;
    particle.userData.phase = phase + index * 1.17;
    group.add(particle);
    return particle;
  });

  // A bright compact footpoint resembles the white-hot active regions in the reference.
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: fireTexture,
    color: 0xfff3c4,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  core.position.copy(direction).multiplyScalar(SUN_RADIUS * 1.008);
  core.scale.set(0.72, 0.72, 1);
  group.add(core);
  group.userData = { direction, tangent, height, bend, phase, particles, core };
  return group;
}

/** Creates a sparse magnetic arch from irregular flowing plasma fragments. */
function createCoronalLoop({ angle, width, height, tilt, phase }, fireTexture) {
  const startAngle = angle - width * 0.5;
  const endAngle = angle + width * 0.5;
  const pointOnSurface = (value, radius = SUN_RADIUS * 1.01) => new THREE.Vector3(
    Math.cos(value) * radius,
    0,
    Math.sin(value) * radius,
  );
  const start = pointOnSurface(startAngle);
  const end = pointOnSurface(endAngle);
  const middle = (startAngle + endAngle) * 0.5;
  const controlA = pointOnSurface(middle - width * 0.18, SUN_RADIUS + height);
  const controlB = pointOnSurface(middle + width * 0.18, SUN_RADIUS + height);
  controlA.y = height * 0.22;
  controlB.y = height * 0.22;
  const curve = new THREE.CubicBezierCurve3(start, controlA, controlB, end);
  const group = new THREE.Group();
  group.rotation.x = tilt;
  const colors = [0xff5412, 0xff8c22, 0xffc34b, 0xffffc0];

  const particles = Array.from({ length: 46 }, (_, index) => {
    const particle = new THREE.Sprite(new THREE.SpriteMaterial({
      map: fireTexture,
      color: colors[index % colors.length],
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    particle.userData.offset = index / 46;
    particle.userData.phase = phase + index * 0.93;
    group.add(particle);
    return particle;
  });
  group.userData = { curve, particles, phase };
  return group;
}

/** Constructs the complete Sun, registers its clickable surface, and adds its light. */
export function createSun({ world, hoverTargets, texture }) {
  const system = new THREE.Group();
  system.name = "Sun system";

  const surfaceTexture = texture ?? makeNoiseTexture("sun");
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS, 160, 160),
    makeSunSurfaceMaterial(surfaceTexture),
  );
  surface.name = "Sun";
  surface.userData = {
    name: "Sun",
    detail: "G-type star | 99.86% of solar system mass",
    focusScale: 1.2,
    // Prevent the generic focus camera from travelling inside this very large mesh.
    minFocusDistance: 28,
    info: {
      type: "Star",
      diameter: "1,392,700 km",
      orbitalSpeed: "System reference body",
      distanceFromEarth: "≈ 149.6 million km",
      description: "A living ocean of plasma whose magnetic storms, radiant light, and immense gravity sustain every world in this planetary system.",
    },
  };
  system.add(surface);

  // The thin chromosphere hugs the photosphere and creates a sharp hot rim.
  const chromosphere = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.015, 128, 128),
    createAtmosphereMaterial({ color: 0xff6a1a, intensity: 0.7, speed: 1.9, power: 2.4 }),
  );
  system.add(chromosphere);

  // Keep the corona tight to the limb; the reference has no large detached halo.
  const innerCorona = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.032, 112, 112),
    createAtmosphereMaterial({ color: 0xffa12f, intensity: 0.22, speed: 1.15, power: 3.4 }),
  );
  const outerCorona = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.052, 96, 96),
    createAtmosphereMaterial({ color: 0xffd05c, intensity: 0.07, speed: -0.72, power: 4.8 }),
  );
  system.add(innerCorona, outerCorona);

  // A camera-facing sprite provides the very soft glow that geometry alone cannot.
  const glowTexture = makeGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xff6a1a,
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  glow.scale.set(20, 20, 1);
  system.add(glow);

  const spicules = createSpicules();
  system.add(spicules);

  // Sparse eruptions replace the previous large, clean magnetic loops.
  const jetData = [
    { latitude: -24, longitude: 18, height: 2.8, bend: 0.75, phase: 0.4 },
    { latitude: 32, longitude: -48, height: 1.55, bend: -0.42, phase: 1.9 },
    { latitude: 8, longitude: 72, height: 2.1, bend: 0.5, phase: 3.2 },
    { latitude: -46, longitude: -82, height: 1.35, bend: -0.34, phase: 4.5 },
    { latitude: 51, longitude: 126, height: 1.7, bend: 0.38, phase: 5.6 },
  ];
  const plasmaJets = jetData.map((config) => createPlasmaJet(config, glowTexture));
  system.add(...plasmaJets);

  // A small number of irregular arches matches the references without surrounding
  // the star in decorative rings.
  const coronalLoops = [
    { angle: 2.75, width: 0.34, height: 2.5, tilt: 0.42, phase: 1.2 },
    { angle: 5.35, width: 0.24, height: 1.55, tilt: -0.58, phase: 4.1 },
  ].map((config) => createCoronalLoop(config, glowTexture));
  system.add(...coronalLoops);

  // The Sun's point light belongs to the same scene-graph group as the star.
  const light = new THREE.PointLight(0xffdda0, 5600, 1600, 1.45);
  system.add(light);

  world.add(system);
  hoverTargets.push(surface);
  return { system, surface, chromosphere, innerCorona, outerCorona, glow, spicules, plasmaJets, coronalLoops, light };
}

/** Advances every animated solar layer. motionScale supports inspection slow motion. */
export function updateSun(sun, time, motionScale) {
  sun.surface.rotation.y += 0.0024 * motionScale;
  sun.chromosphere.rotation.y -= 0.0013 * motionScale;
  sun.innerCorona.rotation.y += 0.0008 * motionScale;
  sun.outerCorona.rotation.y -= 0.00045 * motionScale;

  sun.surface.material.uniforms.uTime.value = time;
  sun.chromosphere.material.uniforms.uTime.value = time;
  sun.innerCorona.material.uniforms.uTime.value = time;
  sun.outerCorona.material.uniforms.uTime.value = time;

  const pulse = 1 + Math.sin(time * 0.7) * 0.025;
  sun.glow.scale.set(20 * pulse, 20 * pulse, 1);
  sun.glow.material.opacity = 0.028 + Math.sin(time * 0.9) * 0.007;

  // Hundreds of instanced 3D threads rotate and breathe as one dense fiery layer.
  sun.spicules.rotation.y += 0.0007 * motionScale;
  sun.spicules.rotation.x = Math.sin(time * 0.13) * 0.008;
  const spiculePulse = 1 + Math.sin(time * 6.4) * 0.018;
  sun.spicules.scale.setScalar(spiculePulse);
  sun.spicules.children[0].material.opacity = 0.27 + Math.sin(time * 7.1) * 0.055;

  sun.plasmaJets.forEach((jet) => {
    const { direction, tangent, height, bend, phase, particles, core } = jet.userData;
    core.material.opacity = 0.48 + Math.sin(time * 4.5 + phase) * 0.22;
    const coreSize = 0.62 + Math.sin(time * 5.3 + phase) * 0.12;
    core.scale.set(coreSize, coreSize, 1);

    particles.forEach((particle) => {
      // Plasma repeatedly launches outward, bends, fragments, and disappears.
      const t = (time * 0.12 + particle.userData.offset + phase * 0.05) % 1;
      const radialDistance = SUN_RADIUS * 1.01 + t * height;
      const lateralOffset = Math.sin(Math.PI * t) * bend;
      particle.position.copy(direction).multiplyScalar(radialDistance)
        .addScaledVector(tangent, lateralOffset);

      const life = Math.sin(Math.PI * t) * (1 - t * 0.55);
      const flicker = 0.72 + Math.sin(time * 10 + particle.userData.phase) * 0.28;
      const size = (0.09 + life * 0.32) * flicker;
      particle.scale.set(size, size * (1.15 + t * 0.5), 1);
      particle.material.opacity = life * (0.42 + flicker * 0.38);
    });
  });

  sun.coronalLoops.forEach((loop) => {
    const { curve, particles, phase } = loop.userData;
    particles.forEach((particle) => {
      // Fragments circulate along the arch. Uneven size and opacity prevent a tube look.
      const t = (particle.userData.offset + time * 0.035) % 1;
      const point = curve.getPoint(t);
      const turbulence = Math.sin(time * 6.2 + particle.userData.phase) * 0.055;
      point.y += turbulence;
      particle.position.copy(point);
      const envelope = Math.sin(Math.PI * t);
      const flicker = 0.62 + Math.sin(time * 9.4 + particle.userData.phase) * 0.38;
      const size = (0.075 + envelope * 0.19) * (0.8 + flicker * 0.35);
      particle.scale.set(size, size * 1.28, 1);
      particle.material.opacity = envelope * (0.18 + flicker * 0.42);
    });
  });
}

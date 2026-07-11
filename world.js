import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";
import { makeGlowTexture, makeNoiseTexture, makeRockTexture, makeTwinkleMaterial } from "./utils.js";

function createOrbitLine(orbitRoot, radius, color = 0xffffff, opacity = 0.18, tilt = 0) {
  const points = Array.from({ length: 241 }, (_, i) => {
    const angle = (i / 240) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  });
  const orbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  orbit.rotation.x = tilt;
  orbitRoot.add(orbit);
}

function makeSunCoronaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      void main() {
        vec2 uv = vUv - 0.5;
        float dist = length(uv) * 1.8;
        float glow = smoothstep(0.94, 0.24, dist);
        float pulse = 0.22 + 0.28 * sin(uTime * 3.8 - dist * 12.0);
        float corona = glow * pulse * uIntensity * 0.76;
        float rim = smoothstep(0.58, 0.52, length(uv)) * 0.18;
        vec3 color = vec3(1.0, 0.68, 0.18) * (0.88 + corona * 1.1 + rim * 0.8);
        float alpha = clamp(glow * 0.54 + rim * 0.22, 0.0, 0.82);
        gl_FragColor = vec4(color, alpha);
        if (gl_FragColor.a < 0.01) discard;
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makeSunSurfaceMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture },
      uGlow: { value: 1.25 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uMap;
      uniform float uGlow;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.52;
          p += vec2(1.7, 9.2);
        }
        return value;
      }

      void main() {
        vec2 uv = vUv * 1.6 + vec2(uTime * 0.02, -uTime * 0.01);
        vec3 baseColor = texture2D(uMap, uv * 0.84).rgb;
        float pattern = fbm(uv * 6.4);
        float molten = fbm(uv * 18.0 + vec2(uTime * 0.16, uTime * 0.12));
        float glowMask = smoothstep(0.08, 0.62, pattern);
        float hotSpot = smoothstep(0.42, 0.62, molten) * 0.9;
        float rim = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
        float pulse = 0.4 + 0.6 * sin(uTime * 3.8 + length(vPosition) * 2.6);

        vec3 yellow = vec3(1.0, 0.82, 0.26);
        vec3 orange = vec3(1.0, 0.58, 0.11);
        vec3 red = vec3(1.0, 0.33, 0.07);
        vec3 ember = mix(orange, red, clamp((molten - 0.45) * 2.4, 0.0, 1.0));
        vec3 surfaceColor = mix(yellow, ember, glowMask * 0.9 + pulse * 0.18);
        surfaceColor = mix(surfaceColor, baseColor * 1.1, 0.32);
        surfaceColor += vec3(1.0, 0.68, 0.24) * hotSpot * 0.72;
        surfaceColor += vec3(1.0, 0.96, 0.78) * pow(max(0.0, hotSpot - 0.2), 3.2) * 0.9;

        float corona = pow(1.0 - length(vUv - 0.5) * 2.0, 2.0);
        float colorShift = smoothstep(0.16, 0.38, corona);
        vec3 halo = mix(vec3(1.0, 0.7, 0.2), vec3(1.0, 0.32, 0.08), colorShift) * 0.12;
        vec3 finalColor = surfaceColor + halo * uGlow * 0.72 + rim * vec3(1.0, 0.48, 0.18) * 0.24;
        finalColor = mix(finalColor, vec3(1.0, 0.45, 0.05) * 1.15, smoothstep(0.82, 0.98, pattern));
        finalColor = mix(finalColor, vec3(1.0, 0.48, 0.14) * 0.92, hotSpot * 0.7);

        float alpha = clamp(corona * 0.72 + glowMask * 0.2 + hotSpot * 0.22, 0.84, 1.0);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: false,
    depthWrite: true,
  });
}

function makePlanetMaterial(config, textures) {
  return new THREE.MeshStandardMaterial({
    map: textures[config.texture] ?? makeNoiseTexture(config.texture),
    roughness: config.roughness ?? 0.84,
    metalness: config.metalness ?? 0.0,
    bumpMap: config.bump ? textures[config.texture] : null,
    bumpScale: config.bump ?? 0,
    normalMap: config.normalTexture ? textures[config.normalTexture] : null,
    normalScale: new THREE.Vector2(config.normalScale ?? 0.55, config.normalScale ?? 0.55),
    emissive: new THREE.Color(config.emissiveColor ?? 0x000000),
    emissiveIntensity: config.emissiveIntensity ?? 0.0,
    envMapIntensity: 0.18,
  });
}

function makePlanet(config, world, hoverTargets, textures, orbitRoot) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(config.radius, 112, 112),
    makePlanetMaterial(config, textures),
  );
  mesh.name = config.name;
  mesh.userData = {
    name: config.name,
    orbitRadius: config.orbitRadius,
    orbitSpeed: config.orbitSpeed,
    spinSpeed: config.spinSpeed,
    angle: config.angle,
    tilt: config.tilt ?? 0,
    focusScale: config.focusScale ?? 1,
    detail: config.detail,
  };
  mesh.rotation.z = config.axialTilt ?? 0;
  world.add(mesh);
  hoverTargets.push(mesh);
  if (config.orbitRadius > 0) createOrbitLine(orbitRoot, config.orbitRadius, config.orbitColor, config.orbitOpacity ?? 0.18, config.tilt ?? 0);
  return mesh;
}

export function createSun({ scene, world, hoverTargets, textures }) {
  const sunSurfaceTexture = textures.sun ?? makeNoiseTexture("sun");
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(9.2, 128, 128),
    makeSunSurfaceMaterial(sunSurfaceTexture),
  );
  sun.name = "Sun";
  sun.userData = { name: "Sun", detail: "G-type star | 99.86% of solar system mass", focusScale: 1.2 };
  world.add(sun);
  hoverTargets.push(sun);

  const sunFlare = new THREE.Mesh(
    new THREE.SphereGeometry(11.8, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uIntensity;
        void main() {
          vec2 uv = vUv - 0.5;
          float dist = length(uv) * 2.1;
          float flame = smoothstep(0.96, 0.2, dist) * (0.5 + 0.5 * sin(dist * 18.0 - uTime * 3.2));
          float streak = smoothstep(0.58, 0.28, abs(uv.x + sin(uTime * 1.9) * 0.14)) * 0.28;
          float wave = smoothstep(0.74, 0.42, abs(uv.y + cos(uTime * 2.4) * 0.16)) * 0.22;
          float alpha = clamp((flame + streak * 0.9 + wave * 0.8) * uIntensity, 0.0, 0.78);
          vec3 color = vec3(1.0, 0.75, 0.26) * flame + vec3(1.0, 0.4, 0.08) * streak * 0.85;
          gl_FragColor = vec4(color, alpha);
          if (gl_FragColor.a < 0.02) discard;
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sunFlare.renderOrder = 1;
  sunFlare.material.depthWrite = false;
  sun.add(sunFlare);

  const sunCorona = new THREE.Mesh(
    new THREE.SphereGeometry(10.6, 96, 96),
    makeSunCoronaMaterial(),
  );
  sunCorona.renderOrder = 0;
  sunCorona.material.depthWrite = false;
  sun.add(sunCorona);

  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xffb14e,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sunHalo.scale.setScalar(34);
  sun.add(sunHalo);

  return { sun, sunCorona, sunFlare, sunHalo };
}

export function createPlanets({ world, hoverTargets, textures, orbitRoot }) {
  const planetConfigs = [
    { name: "Mercury", texture: "mercury", radius: 0.54, orbitRadius: 14, orbitSpeed: 0.72, spinSpeed: 0.003, axialTilt: 0.001, angle: 0.8, bump: 0.028, orbitColor: 0x9d9386, detail: "Smallest planet | 0.38x Earth width" },
    { name: "Venus", texture: "venus", radius: 1.18, orbitRadius: 21, orbitSpeed: 0.46, spinSpeed: -0.0015, axialTilt: 3.1, angle: 2.2, bump: 0.01, orbitColor: 0xe0b36a, detail: "Earth-size world | retrograde spin" },
    { name: "Earth", texture: "earth", normalTexture: "earthNormal", radius: 1.25, orbitRadius: 29, orbitSpeed: 0.34, spinSpeed: 0.012, axialTilt: 0.41, angle: 4.35, normalScale: 0.55, orbitColor: 0x7de7ff, detail: "Home planet | 12,756 km diameter", focusScale: 1.75 },
    { name: "Mars", texture: "mars", radius: 0.72, orbitRadius: 40, orbitSpeed: 0.25, spinSpeed: 0.01, axialTilt: 0.44, angle: 5.3, bump: 0.065, orbitColor: 0xd06a37, detail: "Red planet | about half Earth width", focusScale: 1.55 },
    { name: "Jupiter", texture: "jupiter", radius: 6.25, orbitRadius: 75, orbitSpeed: 0.12, spinSpeed: 0.021, axialTilt: 0.05, angle: 1.35, bump: 0.012, orbitColor: 0xe2bc8a, detail: "Largest planet | about 11x Earth width", focusScale: 0.75 },
    { name: "Saturn", texture: "saturn", radius: 5.2, orbitRadius: 108, orbitSpeed: 0.08, spinSpeed: 0.017, axialTilt: 0.47, angle: 3.1, bump: 0.01, orbitColor: 0xd9bd84, detail: "Ringed giant | about 9x Earth width", focusScale: 0.82 },
    { name: "Uranus", texture: "uranus", radius: 2.75, orbitRadius: 145, orbitSpeed: 0.055, spinSpeed: 0.011, axialTilt: 1.71, angle: 4.8, bump: 0.005, orbitColor: 0x9ee9f2, detail: "Ice giant | sideways axial tilt", focusScale: 1 },
    { name: "Neptune", texture: "neptune", radius: 2.65, orbitRadius: 178, orbitSpeed: 0.043, spinSpeed: 0.012, axialTilt: 0.49, angle: 0.05, bump: 0.005, orbitColor: 0x5f83ff, detail: "Most distant planet | about 30 AU", focusScale: 1 },
  ];

  const planets = planetConfigs.map((config) => makePlanet(config, world, hoverTargets, textures, orbitRoot));
  const planetMap = Object.fromEntries(planets.map((planet) => [planet.name, planet]));

  const venus = planetMap.Venus;
  const earth = planetMap.Earth;
  const jupiter = planetMap.Jupiter;
  const saturn = planetMap.Saturn;
  const uranus = planetMap.Uranus;
  const neptune = planetMap.Neptune;

  function addAtmosphere(planet, radius, color, opacity) {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 96, 96),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    planet.add(shell);
    return shell;
  }

  addAtmosphere(venus, 1.24, 0xffd99a, 0.16);
  addAtmosphere(jupiter, 6.38, 0xffd4a2, 0.08);
  addAtmosphere(saturn, 5.32, 0xf8dfb0, 0.08);
  addAtmosphere(uranus, 2.86, 0x9ff7ff, 0.12);
  addAtmosphere(neptune, 2.76, 0x5d8dff, 0.13);

  if (saturn) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(6.45, 9.4, 180),
      new THREE.MeshBasicMaterial({
        map: textures.saturnRing ?? null,
        color: 0xe6d0a2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      }),
    );
    ring.rotation.x = Math.PI / 2.05;
    ring.rotation.z = 0.24;
    saturn.add(ring);
  }

  const earthClouds = new THREE.Mesh(
    new THREE.SphereGeometry(1.285, 96, 96),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      alphaMap: textures.earthClouds ?? null,
      transparent: true,
      opacity: textures.earthClouds ? 0.44 : 0,
      depthWrite: false,
      roughness: 1,
    }),
  );
  earth.add(earthClouds);

  const earthAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.305, 96, 96),
    new THREE.MeshBasicMaterial({ color: 0x5bdcff, transparent: true, opacity: 0.18, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
  );
  earth.add(earthAtmosphere);

  if (textures.earthLights) {
    const earthLights = new THREE.Mesh(
      new THREE.SphereGeometry(1.265, 96, 96),
      new THREE.MeshBasicMaterial({
        color: 0xffd37a,
        map: textures.earthLights,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    earth.add(earthLights);
  }

  const moonPivot = new THREE.Group();
  earth.add(moonPivot);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 96, 96),
    new THREE.MeshStandardMaterial({
      map: textures.moon ?? makeNoiseTexture("moon"),
      roughness: 0.96,
      bumpMap: textures.moon ?? null,
      bumpScale: 0.04,
    }),
  );
  moon.name = "Moon";
  moon.position.set(3.05, 0.08, 0);
  moon.userData = { name: "Moon", detail: "Earth's moon | cratered companion", focusScale: 3.3 };
  moonPivot.add(moon);
  hoverTargets.push(moon);

  const moonOrbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, i) => {
        const angle = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * 3.05, 0.08, Math.sin(angle) * 3.05);
      }),
    ),
    new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.28 }),
  );
  earth.add(moonOrbit);

  return {
    planets,
    earth,
    venus,
    jupiter,
    saturn,
    uranus,
    neptune,
    moon,
    moonPivot,
    moonOrbit,
    earthClouds,
    earthAtmosphere,
  };
}

function makeParticles({ count, radius, position, colors, size, spiral = false, opacity = 0.86 }) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colorValues = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const palette = colors.map((color) => new THREE.Color(color));
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    if (spiral) {
      const arm = i % 4;
      const distance = Math.pow(Math.random(), 0.58) * radius;
      const angle = distance * 0.11 + arm * Math.PI * 0.5 + (Math.random() - 0.5) * 0.55;
      positions[i3] = Math.cos(angle) * distance;
      positions[i3 + 1] = (Math.random() - 0.5) * (1.8 + distance * 0.025);
      positions[i3 + 2] = Math.sin(angle) * distance;
    } else {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const distance = Math.pow(Math.random(), 0.72) * radius;
      positions[i3] = Math.sin(phi) * Math.cos(theta) * distance;
      positions[i3 + 1] = Math.cos(phi) * distance * 0.7;
      positions[i3 + 2] = Math.sin(phi) * Math.sin(theta) * distance;
    }
    const color = palette[Math.floor(Math.random() * palette.length)];
    colorValues[i3] = color.r;
    colorValues[i3 + 1] = color.g;
    colorValues[i3 + 2] = color.b;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.8 + Math.random() * 3.8;
    scales[i] = 0.45 + Math.random() * 1.35;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorValues, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  const points = new THREE.Points(geometry, makeTwinkleMaterial(size, opacity));
  points.position.copy(position);
  return points;
}

export function createParticles({ scene, world }) {
  const stars = makeParticles({
    count: 6800,
    radius: 1800,
    position: new THREE.Vector3(0, 0, 0),
    colors: ["#ffffff", "#95dcff", "#ffd38c", "#ff9ec2"],
    size: 1.55,
    opacity: 0.95,
  });
  scene.add(stars);

  const milkyWay = makeParticles({
    count: 11500,
    radius: 320,
    position: new THREE.Vector3(0, -18, 0),
    colors: ["#ffffff", "#7de7ff", "#ffd37a", "#ff7da8"],
    size: 1.15,
    spiral: true,
    opacity: 0,
  });
  milkyWay.rotation.x = 0.28;
  scene.add(milkyWay);

  const asteroidGroup = new THREE.Group();
  const rockTexture = makeRockTexture();
  const asteroidMaterials = [
    new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.055, color: 0x8a7866, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.075, color: 0x5f554b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: rockTexture, bumpMap: rockTexture, bumpScale: 0.045, color: 0xa5927c, roughness: 0.96 }),
  ];
  const asteroidGeometries = [
    new THREE.IcosahedronGeometry(1, 2),
    new THREE.DodecahedronGeometry(1, 1),
    new THREE.TetrahedronGeometry(1, 1),
  ];
  for (let i = 0; i < 260; i += 1) {
    const rockSize = 0.055 + Math.pow(Math.random(), 2.6) * 0.42;
    const asteroid = new THREE.Mesh(
      asteroidGeometries[Math.floor(Math.random() * asteroidGeometries.length)],
      asteroidMaterials[Math.floor(Math.random() * asteroidMaterials.length)],
    );
    const radius = 43 + Math.random() * 9;
    const angle = Math.random() * Math.PI * 2;
    asteroid.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 2.4, Math.sin(angle) * radius);
    asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    asteroid.scale.set(
      rockSize * (0.65 + Math.random() * 1.5),
      rockSize * (0.45 + Math.random() * 1.1),
      rockSize * (0.75 + Math.random() * 1.7),
    );
    asteroid.userData.spin = new THREE.Vector3(
      0.001 + Math.random() * 0.006,
      0.001 + Math.random() * 0.007,
      0.001 + Math.random() * 0.004,
    );
    asteroidGroup.add(asteroid);
  }
  world.add(asteroidGroup);

  const asteroidDust = new THREE.Points(
    new THREE.BufferGeometry(),
    makeTwinkleMaterial(0.72, 0.34),
  );
  // asteroidDust is created in controls.js so it can be animated directly there
  const dust = createBeltDust(asteroidDust, world);

  return { stars, milkyWay, asteroidGroup, asteroidDust: dust };
}

function createBeltDust(dustMaterial, world) {
  const count = 1800;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colorValues = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const palette = [new THREE.Color("#b6a08b"), new THREE.Color("#706257"), new THREE.Color("#d6c1a6")];
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radius = 44 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = (Math.random() - 0.5) * 2.4;
    positions[i3 + 2] = Math.sin(angle) * radius;
    const color = palette[Math.floor(Math.random() * palette.length)];
    colorValues[i3] = color.r;
    colorValues[i3 + 1] = color.g;
    colorValues[i3 + 2] = color.b;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.25 + Math.random() * 1.2;
    scales[i] = 0.25 + Math.random() * 0.8;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colorValues, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  const dust = new THREE.Points(geometry, dustMaterial);
  world.add(dust);
  return dust;
}

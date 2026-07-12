/*
  main.js
  - Entry point for the Universe Drift experience.
  - Initializes the Three.js scene, loads textures, creates the solar system, and drives scroll-based camera motion.
*/


(async () => {

  const THREE = await import("https://unpkg.com/three@0.161.0/build/three.module.js");

  const canvas = document.querySelector("#universe");
  const loader = document.querySelector("#loader");
  const progressBar = document.querySelector("#progress-bar");
  const scaleLabel = document.querySelector("#scale-label");
  const bodyLabel = document.querySelector("#body-label");
  const bodyDetail = document.querySelector("#body-detail");

  // The three.js scene, camera, renderer, and control state are initialized here.
  // The scene contains fog for depth and two root groups: one for planetary world objects,
  // and another for orbit lines so they can have independent opacity animation.
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x01040a, 0.0018);

  // Set up the camera and renderer for the WebGL canvas.
  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");

  // Groups separate objects into world content and orbit overlays.
  const world = new THREE.Group();
  const orbitRoot = new THREE.Group();
  const planets = [];
  const hoverTargets = [];
  scene.add(world, orbitRoot);

  // Scroll and drag state for camera control.
  // Uses both raw scroll progress and smoothed values for camera motion.
  let scrollProgress = 0;
  let smoothProgress = 0;
  let targetYaw = -0.55;
  let targetPitch = 0.22;
  let yaw = targetYaw;
  let pitch = targetPitch;
  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };
  let pointerDownPosition = { x: 0, y: 0 };
  let dragDistance = 0;
  let focusedBody = null;
  let hasCameraFocusPoint = false;
  const cameraFocusPoint = new THREE.Vector3();

  // Remote texture URLs used for planetary materials and special surface maps.
  // The loader will fetch these assets and fall back to procedural textures when necessary.
  const textureUrls = {
    sun: "https://threejs.org/examples/textures/lava/cloud.png",
    mercury: "https://threejs.org/examples/textures/planets/mercury.jpg",
    venus: "https://threejs.org/examples/textures/planets/venus.jpg",
    earth: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    earthNormal: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
    earthClouds: "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
    earthLights: "https://threejs.org/examples/textures/planets/earth_lights_2048.png",
    moon: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
    mars: "https://threejs.org/examples/textures/planets/mars_1k_color.jpg",
    jupiter: "https://threejs.org/examples/textures/planets/jupiter2_1024.jpg",
    saturn: "https://threejs.org/examples/textures/planets/saturn.jpg",
    saturnRing: "https://threejs.org/examples/textures/planets/saturnringcolor.jpg",
    uranus: "https://threejs.org/examples/textures/planets/uranus.jpg",
    neptune: "https://threejs.org/examples/textures/planets/neptune.jpg",
  };

  // Lighting that illuminates the solar system and adds atmospheric shading.
  scene.add(new THREE.AmbientLight(0x8da1c6, 0.34));

  const sunLight = new THREE.PointLight(0xffe6aa, 5200, 1450, 1.5);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x8bdcff, 0.75);
  fillLight.position.set(-50, 40, 90);
  scene.add(fillLight);

  /*
    makeNoiseTexture
    - Procedurally generates a planet-like canvas texture for bodies without external imagery.
  */
  function makeNoiseTexture(kind, size = 1024) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = size;
    textureCanvas.height = size / 2;
    const ctx = textureCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, size, size / 2);
    const palettes = {
      mercury: ["#82776c", "#c0b4a0", "#4a4642"],
      venus: ["#9b6b3c", "#e2b36c", "#5f422e"],
      earth: ["#053f92", "#1784ca", "#041d50"],
      moon: ["#d8d3c8", "#7a7770", "#353331"],
      mars: ["#8c321e", "#d06a37", "#4d1d17"],
      jupiter: ["#6d442a", "#d8b58b", "#f1dfc8"],
      saturn: ["#a98758", "#e8d09a", "#6b5030"],
      uranus: ["#78d6df", "#c0f4f6", "#4f93a6"],
      neptune: ["#183f9a", "#4a7dff", "#091f56"],
      sun: ["#ff7a18", "#ffd166", "#b32013"],
    };
    const palette = palettes[kind] ?? palettes.earth;
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.48, palette[1]);
    gradient.addColorStop(1, palette[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size / 2);

    for (let i = 0; i < 120; i += 1) {
      ctx.beginPath();
      const y = Math.random() * size * 0.5;
      const bandHeight = kind === "jupiter" || kind === "saturn" ? 8 + Math.random() * 28 : 3 + Math.random() * 24;
      ctx.ellipse(Math.random() * size, y, 36 + Math.random() * 150, bandHeight, Math.random() * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.18})`;
      ctx.fill();
    }

    if (kind === "moon" || kind === "mercury") {
      for (let i = 0; i < 150; i += 1) {
        ctx.beginPath();
        ctx.arc(Math.random() * size, Math.random() * size * 0.5, 4 + Math.random() * 25, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20,20,20,${0.08 + Math.random() * 0.2})`;
        ctx.fill();
      }
    }

    if (kind === "jupiter") {
      for (let y = 0; y < size / 2; y += 16) {
        ctx.fillStyle = y % 48 === 0 ? "rgba(95,50,28,0.34)" : "rgba(255,238,205,0.14)";
        ctx.fillRect(0, y + Math.sin(y * 0.08) * 5, size, 8 + Math.sin(y * 0.03) * 4);
      }
      ctx.beginPath();
      ctx.ellipse(size * 0.66, size * 0.29, 78, 32, -0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(166,71,42,0.78)";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(size * 0.66, size * 0.29, 45, 18, -0.12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(228,142,91,0.48)";
      ctx.fill();
    }

    if (kind === "saturn") {
      for (let y = 0; y < size / 2; y += 13) {
        ctx.fillStyle = y % 39 === 0 ? "rgba(106,78,45,0.2)" : "rgba(255,232,181,0.12)";
        ctx.fillRect(0, y, size, 6);
      }
    }

    if (kind === "venus") {
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = "#fff0c9";
      for (let i = 0; i < 46; i += 1) {
        ctx.beginPath();
        const y = Math.random() * size * 0.5;
        ctx.moveTo(0, y);
        for (let x = 0; x < size; x += 28) {
          ctx.lineTo(x, y + Math.sin(x * 0.018 + i) * 18);
        }
        ctx.lineWidth = 5 + Math.random() * 12;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (kind === "mars") {
      ctx.fillStyle = "rgba(255,235,210,0.75)";
      ctx.fillRect(0, 0, size, 24);
      ctx.fillRect(0, size / 2 - 26, size, 26);
    }

    if (kind === "neptune") {
      ctx.beginPath();
      ctx.ellipse(size * 0.58, size * 0.27, 58, 25, -0.25, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(9,22,70,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(220,245,255,0.45)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(size * 0.1, size * 0.2);
      ctx.bezierCurveTo(size * 0.32, size * 0.16, size * 0.52, size * 0.24, size * 0.9, size * 0.18);
      ctx.stroke();
    }

    if (kind === "uranus") {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#e7ffff";
      for (let y = 18; y < size / 2; y += 42) ctx.fillRect(0, y, size, 5);
      ctx.globalAlpha = 1;
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  /*
    makeRockTexture
    - Builds a rugged rock canvas texture used for asteroids and small debris.
  */
  function makeRockTexture() {
    const size = 256;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = size;
    textureCanvas.height = size;
    const ctx = textureCanvas.getContext("2d");
    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, "#4a4036");
    base.addColorStop(0.5, "#8b7a67");
    base.addColorStop(1, "#27231f");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1200; i += 1) {
      const shade = 40 + Math.random() * 130;
      ctx.fillStyle = `rgba(${shade},${shade * 0.9},${shade * 0.76},${0.05 + Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 4, 1 + Math.random() * 4);
    }
    for (let i = 0; i < 34; i += 1) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 5 + Math.random() * 22, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(20,18,15,${0.08 + Math.random() * 0.18})`;
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  /*
    makeGlowTexture
    - Creates a soft radial glow texture for sprites and halo effects.
  */
  function makeGlowTexture() {
    const size = 128;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const ctx = sprite.getContext("2d");
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.22, "rgba(255,255,255,0.88)");
    gradient.addColorStop(0.52, "rgba(134,213,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(sprite);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /*
    makeTwinkleMaterial
    - Returns a custom shader material for stars, dust, and particle effects.
    - Simulates size modulation, twinkle, and halo glow per point.
  */
  /*
    makeTwinkleMaterial
    - Builds a shader material for star and dust point clouds.
    - Each particle is sized and brightened by per-vertex attributes and time-varying twinkle.
  */
  function makeTwinkleMaterial(size, opacity = 0.86) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uOpacity: { value: opacity },
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aPhase;
        attribute float aSpeed;
        attribute float aScale;
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;
        uniform float uSize;
        void main() {
          vColor = aColor;
          vTwinkle = 0.58 + 0.42 * sin(uTime * aSpeed + aPhase);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * aScale * (0.74 + vTwinkle * 0.65) * (300.0 / max(80.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uOpacity;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          float core = smoothstep(0.24, 0.0, dist);
          float halo = smoothstep(0.5, 0.0, dist) * 0.34;
          float alpha = (core + halo) * uOpacity * (0.55 + vTwinkle * 0.55);
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vColor * (0.75 + vTwinkle * 0.72), alpha);
        }
      `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  /*
    loadTexture
    - Loads a remote texture and falls back to a procedural noise texture on failure.
    - Prepares texture color space, anisotropy, and wrapping behavior.
  */
  /*
    loadTexture
    - Loads a remote texture or falls back to a procedural texture if the load fails.
    - Configures color space, anisotropy, and wrapping for consistent rendering.
  */
  function loadTexture(url, fallbackKind, options = {}) {
    return new Promise((resolve) => {
      textureLoader.load(
        url,
        (texture) => {
          if (options.color !== false) texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          resolve(texture);
        },
        undefined,
        () => resolve(options.optional ? null : makeNoiseTexture(fallbackKind)),
      );
    });
  }

  const textures = {};
  await Promise.all(
    Object.entries(textureUrls).map(async ([name, url]) => {
      const optional = ["earthLights", "earthClouds", "earthNormal", "saturnRing"].includes(name);
      textures[name] = await loadTexture(url, name, { optional, color: name !== "earthNormal" });
    }),
  );

  /*
    createOrbitLine
    - Creates a smooth circular orbit visual for a planet.
    - Adds the line to the orbit secondary group for separate opacity control.
  */
  /*
    createOrbitLine
    - Builds a low-opacity circular line showing a planet's orbit.
    - The orbit line is kept separate so its opacity can fade in with scroll.
  */
  function createOrbitLine(radius, color = 0xffffff, opacity = 0.18, tilt = 0) {
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
    return orbit;
  }

  /*
    makePlanetMaterial
    - Builds each planet's surface material using loaded textures and config values.
    - Supports bump maps, normals, emissive highlights, and roughness settings.
  */
  /*
    makePlanetMaterial
    - Builds a standard mesh material for each planet surface.
    - Uses texture maps, bump maps, and normals to create varied planetary detail.
  */
  function makePlanetMaterial(config) {
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

  /*
    makePlanet
    - Creates a planet mesh, assigns orbit/focus metadata, and adds it to world scene groups.
  */
  /*
    makePlanet
    - Creates a planet mesh with orbit data, spin data, and interaction metadata.
    - Adds it to the world group and registers it for pointer hover detection.
  */
  function makePlanet(config) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(config.radius, 112, 112),
      makePlanetMaterial(config),
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
    planets.push(mesh);
    hoverTargets.push(mesh);
    if (config.orbitRadius > 0) createOrbitLine(config.orbitRadius, config.orbitColor, config.orbitOpacity ?? 0.18, config.tilt ?? 0);
    return mesh;
  }

  /*
    makeSunCoronaMaterial
    - Builds the glowing, animated corona shader material around the Sun.
  */
  /*
    makeSunCoronaMaterial
    - Creates the animated outer corona shader for the Sun.
    - Uses soft glow and pulsation to make the stellar atmosphere feel alive.
  */
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

  /*
    makeSunSurfaceMaterial
    - Creates the animated star surface shader using noise and lighting variation.
  */
  function makeSunSurfaceMaterial(texture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: texture },
        uGlow: { value: 1.25 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = mvPosition.xyz;
          vUv = uv;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform sampler2D uMap;
        uniform float uGlow;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
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

        vec2 hash2(vec2 p) {
          return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453123);
        }

        float cellular(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float minDist = 1.0;
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 neighbor = vec2(float(x), float(y));
              vec2 point = hash2(i + neighbor) + neighbor;
              minDist = min(minDist, length(f - point));
            }
          }
          return minDist;
        }

        void main() {
          vec2 uv = vUv * 2.2 + vec2(uTime * 0.08, -uTime * 0.05);
          vec3 baseColor = texture2D(uMap, uv * 0.78).rgb;
          vec2 noisePos = vNormal.xy * 2.4 + vec2(uTime * 0.12, -uTime * 0.07);

          float pattern = fbm(noisePos * 3.8);
          float molten = fbm(noisePos * 8.2 + vec2(uTime * 0.18, uTime * 0.14));
          float detail = fbm(noisePos * 16.4 + vec2(-uTime * 0.22, uTime * 0.19));
          float cells = cellular(vUv * 15.0 + vec2(uTime * 0.06, -uTime * 0.09));

          float granule = mix(pattern, molten, 0.52);
          float plasma = mix(granule, 1.0 - cells * 1.28, 0.38);
          float energy = clamp(plasma + detail * 0.17, 0.0, 1.0);

          vec3 darkRed = vec3(0.15, 0.01, 0.0);
          vec3 fieryOrange = vec3(0.85, 0.25, 0.0);
          vec3 goldOrange = vec3(1.0, 0.55, 0.0);
          vec3 flareWhite = vec3(1.0, 0.95, 0.8);

          vec3 finalSurface = mix(darkRed, fieryOrange, smoothstep(0.0, 0.4, energy));
          finalSurface = mix(finalSurface, goldOrange, smoothstep(0.4, 0.75, energy));
          finalSurface = mix(finalSurface, flareWhite, smoothstep(0.75, 0.98, energy));

          float edgeFactor = 1.0 - max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.0);
          float rimGlow = pow(edgeFactor, 3.5);
          finalSurface = mix(finalSurface, vec3(0.4, 0.02, 0.0), rimGlow * 0.92);

          float heat = smoothstep(0.18, 0.72, detail * 0.82 + granule * 0.18);
          finalSurface += vec3(0.3, 0.11, 0.02) * rimGlow * uGlow * 0.42;
          finalSurface *= 0.82 + 0.24 * heat;

          vec3 surfaceColor = clamp(finalSurface + baseColor * 0.16, 0.0, 1.0);
          gl_FragColor = vec4(surfaceColor, 1.0);
        }
      `,
      transparent: false,
      depthWrite: true,
    });
  }

  const sunSurfaceTexture = textures.sun ?? makeNoiseTexture("sun");
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(9.2, 128, 128),
    makeSunSurfaceMaterial(sunSurfaceTexture),
  );
  sun.name = "Sun";
  sun.userData = { name: "Sun", detail: "G-type star | 99.86% of solar system mass", focusScale: 1.2 };
  world.add(sun);
  hoverTargets.push(sun);

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

  planetConfigs.forEach(makePlanet);
  const earth = planets.find((planet) => planet.name === "Earth");
  const venus = planets.find((planet) => planet.name === "Venus");
  const jupiter = planets.find((planet) => planet.name === "Jupiter");
  const saturn = planets.find((planet) => planet.name === "Saturn");
  const uranus = planets.find((planet) => planet.name === "Uranus");
  const neptune = planets.find((planet) => planet.name === "Neptune");

  /*
    addAtmosphere
    - Creates a transparent glow shell around a planet to simulate an atmosphere.
    - Uses a back-side material and additive blending so the layer softly wraps the body.
  */
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

  /*
    makeParticles
    - Builds a point cloud for stars, background dust, or a spiral Milky Way.
    - Each particle receives color, phase, speed, and scale attributes for per-star animation.
  */
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
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colorValues, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    const points = new THREE.Points(geometry, makeTwinkleMaterial(size, opacity));
    points.position.copy(position);
    scene.add(points);
    return points;
  }

  /*
    makeBeltDust
    - Generates the asteroid belt dust field as a point cloud around the inner solar system.
  */
  function makeBeltDust() {
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
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colorValues, 3));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    const dust = new THREE.Points(geometry, makeTwinkleMaterial(0.72, 0.34));
    world.add(dust);
    return dust;
  }

  const stars = makeParticles({
    count: 6800,
    radius: 1800,
    position: new THREE.Vector3(0, 0, 0),
    colors: ["#ffffff", "#95dcff", "#ffd38c", "#ff9ec2"],
    size: 1.55,
    opacity: 0.95,
  });

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
  const asteroidDust = makeBeltDust();

  /*
    updateScrollProgress
    - Updates normalized scroll progress and refreshes the HUD progress bar.
  */
  function updateScrollProgress() {
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
    if (progressBar && progressBar.style) progressBar.style.width = `${scrollProgress * 100}%`;
  }

  function getCameraDistance(progress) {
    const eased = progress * progress * (3 - 2 * progress);
    return THREE.MathUtils.lerp(4.8, 620, eased);
  }

  /*
    getFocusPoint
    - Chooses the camera target based on the selected body or nearby Earth when zoomed in.
    - Keeps the camera on the Sun at long range when no body is focused.
  */
  function getFocusPoint(distance) {
    if (focusedBody) return focusedBody.getWorldPosition(new THREE.Vector3());
    if (distance < 18) return earth.getWorldPosition(new THREE.Vector3());
    return new THREE.Vector3(0, 0, 0);
  }

  /*
    updateScaleLabel
    - Writes a descriptive label to the HUD based on the current camera distance.
    - Helps the user understand the scroll-driven scale transition.
  */
  function updateScaleLabel(distance) {
    if (distance < 16) scaleLabel.textContent = "Earth orbit";
    else if (distance < 92) scaleLabel.textContent = "Inner solar system";
    else if (distance < 240) scaleLabel.textContent = "Outer planets";
    else scaleLabel.textContent = "Milky Way scale";
  }

  /*
    updateHoveredBody
    - Raycasts from the mouse pointer into the scene and updates HUD text.
    - Adds a hover CSS state for subtle cursor feedback.
  */
  function updateHoveredBody() {
    const named = getBodyAtPointer();
    bodyLabel.textContent = named?.userData?.name ?? "Free drift";
    bodyDetail.textContent = named?.userData?.detail ?? "Eight-planet solar system";
    document.body.classList.toggle("is-hovering-body", Boolean(named));
  }

  /*
    updatePointerFromEvent
    - Converts browser pointer coordinates into normalized device coordinates.
    - These coordinates are used for raycasting and interactive hover detection.
  */
  function updatePointerFromEvent(event) {
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / innerHeight) * 2 + 1;
  }

  /*
    findInteractiveObject
    - Walks up the scene graph to identify the top-most interactive body.
    - Ensures raycast hits on child mesh parts still resolve to the parent planet object.
  */
  function findInteractiveObject(object) {
    while (object) {
      if (object.userData?.name) return object;
      object = object.parent;
    }
    return null;
  }

  /*
    getBodyAtPointer
    - Uses the raycaster to determine which body is under the cursor.
    - Supports nested mesh structures by resolving to the interactive parent.
  */
  function getBodyAtPointer() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hoverTargets, true)[0];
    return hit ? findInteractiveObject(hit.object) : null;
  }

  /*
    focusBody
    - Toggles selection of a body and scrolls the page toward a camera distance that frames it.
    - Clicking the same body twice clears focus and returns to free drift.
  */
  function focusBody(body) {
    if (!body) {
      focusedBody = null;
      return;
    }
    focusedBody = focusedBody === body ? null : body;
    if (!focusedBody) return;
    bodyLabel.textContent = body.userData.name;
    bodyDetail.textContent = body.userData.detail ?? "Selected body";
    const radius = body.userData.orbitRadius ?? body.getWorldPosition(new THREE.Vector3()).length();
    const idealProgress = THREE.MathUtils.clamp(radius / 230, 0.035, 0.72);
    window.scrollTo({ top: idealProgress * (document.documentElement.scrollHeight - innerHeight), behavior: "smooth" });
  }

  /*
    setup input handlers
    - Wires scroll, pointer, drag, and keyboard events to the camera control state.
    - Keeps the scene interactive while preserving pointer selection and drag motion.
  */
  addEventListener("scroll", updateScrollProgress, { passive: true });
  addEventListener("pointermove", (event) => {
    updatePointerFromEvent(event);
    if (isDragging) {
      dragDistance = Math.max(
        dragDistance,
        Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y),
      );
      targetYaw -= (event.clientX - lastPointer.x) * 0.006;
      targetPitch -= (event.clientY - lastPointer.y) * 0.004;
      targetPitch = THREE.MathUtils.clamp(targetPitch, -1.1, 1.1);
    } else {
      targetYaw += pointer.x * 0.0005;
      targetPitch += pointer.y * 0.00025;
    }
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  addEventListener("pointerdown", (event) => {
    updatePointerFromEvent(event);
    isDragging = true;
    dragDistance = 0;
    pointerDownPosition = { x: event.clientX, y: event.clientY };
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  addEventListener("pointerup", (event) => {
    updatePointerFromEvent(event);
    isDragging = false;
    if (event.target.closest?.(".hud")) return;
    if (dragDistance > 12) return;
    const body = getBodyAtPointer();
    if (body) focusBody(body);
    else focusBody(null);
  });

  addEventListener("pointercancel", () => {
    isDragging = false;
  });

  addEventListener("keydown", (event) => {
    if (event.key === "Escape") focusedBody = null;
    if (event.key === "ArrowLeft") targetYaw += 0.18;
    if (event.key === "ArrowRight") targetYaw -= 0.18;
    if (event.key === "ArrowUp") targetPitch = THREE.MathUtils.clamp(targetPitch + 0.12, -1.1, 1.1);
    if (event.key === "ArrowDown") targetPitch = THREE.MathUtils.clamp(targetPitch - 0.12, -1.1, 1.1);
  });

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /*
    animate
    - Main render loop that updates the camera, rotates bodies, animates particles, and renders the scene.
  */
  function animate() {
    const elapsed = clock.getElapsedTime();
    smoothProgress = THREE.MathUtils.lerp(smoothProgress, scrollProgress, 0.065);
    yaw = THREE.MathUtils.lerp(yaw, targetYaw, 0.075);
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, 0.075);

    planets.forEach((planet) => {
      const data = planet.userData;
      data.angle += data.orbitSpeed * 0.0024;
      planet.position.set(
        Math.cos(data.angle) * data.orbitRadius,
        Math.sin(data.angle * 0.7) * Math.sin(data.tilt) * 1.8,
        Math.sin(data.angle) * data.orbitRadius,
      );
      planet.rotation.y += data.spinSpeed;
    });

    const distance = getCameraDistance(smoothProgress);
    const targetFocusPoint = getFocusPoint(distance);
    if (!hasCameraFocusPoint) {
      cameraFocusPoint.copy(targetFocusPoint);
      hasCameraFocusPoint = true;
    }
    cameraFocusPoint.lerp(targetFocusPoint, focusedBody ? 0.055 : 0.075);
    const focusScale = focusedBody?.userData?.focusScale ?? 1;
    const cameraDistance = focusedBody ? Math.max(4.5, Math.min(distance, 30 / focusScale)) : distance;
    const x = Math.cos(pitch) * Math.sin(yaw) * cameraDistance;
    const y = Math.sin(pitch) * cameraDistance * 0.64;
    const z = Math.cos(pitch) * Math.cos(yaw) * cameraDistance;
    camera.position.set(cameraFocusPoint.x + x, cameraFocusPoint.y + y, cameraFocusPoint.z + z);
    camera.lookAt(cameraFocusPoint);
    camera.fov = THREE.MathUtils.lerp(camera.fov, THREE.MathUtils.lerp(42, 68, smoothProgress), 0.04);
    camera.updateProjectionMatrix();

    earthClouds.rotation.y += 0.0032;
    earthAtmosphere.rotation.y -= 0.0014;
    moonPivot.rotation.y += 0.011;
    moon.rotation.y += 0.006;
    moonOrbit.rotation.y = Math.sin(elapsed * 0.2) * 0.04;
    sun.rotation.y += 0.0025;
    if (sun.material.uniforms) sun.material.uniforms.uTime.value = elapsed;
    asteroidGroup.rotation.y += 0.001;
    asteroidGroup.children.forEach((asteroid) => {
      asteroid.rotation.x += asteroid.userData.spin.x;
      asteroid.rotation.y += asteroid.userData.spin.y;
      asteroid.rotation.z += asteroid.userData.spin.z;
    });
    asteroidDust.rotation.y -= 0.0007;
    stars.rotation.y += 0.00008;
    milkyWay.rotation.y += 0.00045;
    stars.material.uniforms.uTime.value = elapsed;
    asteroidDust.material.uniforms.uTime.value = elapsed;
    milkyWay.material.uniforms.uTime.value = elapsed * 0.72;
    milkyWay.material.uniforms.uOpacity.value = THREE.MathUtils.clamp((smoothProgress - 0.54) / 0.34, 0, 1) * 0.9;
    orbitRoot.children.forEach((orbit) => {
      orbit.material.opacity = THREE.MathUtils.clamp((smoothProgress - 0.035) / 0.18, 0.04, 0.22);
    });

    updateScaleLabel(distance);
    updateHoveredBody();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  updateScrollProgress();
  animate();

  setTimeout(() => {
    loader.classList.add("is-hidden");
  }, 1350);
})();

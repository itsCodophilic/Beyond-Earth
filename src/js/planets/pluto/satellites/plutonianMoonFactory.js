import * as THREE from "three";

function hash3(x, y, z, seed) {
  const value = Math.sin(
    x * 127.1
    + y * 311.7
    + z * 74.7
    + seed * 53.17,
  ) * 43758.5453123;
  return (value - Math.floor(value)) * 2 - 1;
}

function smoothNoise3(x, y, z, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const sample = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz, seed);
  const x00 = THREE.MathUtils.lerp(sample(0, 0, 0), sample(1, 0, 0), ux);
  const x10 = THREE.MathUtils.lerp(sample(0, 1, 0), sample(1, 1, 0), ux);
  const x01 = THREE.MathUtils.lerp(sample(0, 0, 1), sample(1, 0, 1), ux);
  const x11 = THREE.MathUtils.lerp(sample(0, 1, 1), sample(1, 1, 1), ux);
  const y0 = THREE.MathUtils.lerp(x00, x10, uy);
  const y1 = THREE.MathUtils.lerp(x01, x11, uy);
  return THREE.MathUtils.lerp(y0, y1, uz);
}

function fbm3(direction, frequency, octaves, seed) {
  let amplitude = 0.5;
  let value = 0;
  let normalization = 0;
  let scale = frequency;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += smoothNoise3(
      direction.x * scale,
      direction.y * scale,
      direction.z * scale,
      seed + octave * 17.13,
    ) * amplitude;
    normalization += amplitude;
    amplitude *= 0.52;
    scale *= 2.03;
  }
  return normalization > 0 ? value / normalization : 0;
}

function smoothstep(edge0, edge1, value) {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function directionFromSeed(seed, index) {
  const theta = (seed * 97.31 + index * 2.3999632297) % (Math.PI * 2);
  const y = THREE.MathUtils.clamp(
    Math.sin(seed * 31.7 + index * 1.61803398875) * 0.82,
    -0.82,
    0.82,
  );
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize();
}

function craterSample(direction, center, angularRadius, depth, rimStrength = 0.25) {
  const distance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  const normalized = distance / angularRadius;
  if (normalized > 1.25) return { height: 0, floor: 0, rim: 0 };
  const bowl = -depth * Math.pow(Math.max(0, 1 - normalized * normalized), 1.65);
  const rim = depth * rimStrength * Math.exp(-Math.pow((normalized - 0.96) / 0.11, 2));
  return {
    height: bowl + rim,
    floor: 1 - smoothstep(0.18, 0.88, normalized),
    rim: Math.exp(-Math.pow((normalized - 0.96) / 0.14, 2)),
  };
}

function geometryDetail(profile, quality) {
  if (profile.name === "Charon") {
    if (quality === "low") return 4;
    if (quality === "medium") return 5;
    return 5;
  }
  if (quality === "low") return 3;
  if (quality === "medium") return 4;
  return 4;
}

function basePalette(name) {
  const palettes = {
    Charon: {
      base: 0x8c8782,
      light: 0xb1aca5,
      dark: 0x5b5552,
      accent: 0x6b3833,
    },
    Styx: {
      base: 0xbcbdb8,
      light: 0xe0e0d8,
      dark: 0x858780,
      accent: 0x9d9f98,
    },
    Nix: {
      base: 0xc9c5bc,
      light: 0xe5e1d7,
      dark: 0x8c8983,
      accent: 0x9a5b4c,
    },
    Kerberos: {
      base: 0xb5b4aa,
      light: 0xd7d6cb,
      dark: 0x7f8078,
      accent: 0x99988e,
    },
    Hydra: {
      base: 0xc4c7c3,
      light: 0xe2e4df,
      dark: 0x858b88,
      accent: 0x747b79,
    },
  };
  return palettes[name] ?? palettes.Styx;
}

function createGeometry(profile, quality) {
  const geometry = new THREE.IcosahedronGeometry(1, geometryDetail(profile, quality));
  const positions = geometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const palette = basePalette(profile.name);
  const base = new THREE.Color(palette.base);
  const light = new THREE.Color(palette.light);
  const dark = new THREE.Color(palette.dark);
  const accent = new THREE.Color(palette.accent);
  const colour = new THREE.Color();
  const craterCount = profile.name === "Charon" ? 18 : profile.name === "Nix" || profile.name === "Hydra" ? 10 : 6;
  const craterCenters = Array.from({ length: craterCount }, (_, index) => directionFromSeed(profile.seed + 0.37, index));
  const redSpotCenter = new THREE.Vector3(0.58, 0.18, 0.79).normalize();
  const hydraDarkCenter = new THREE.Vector3(-0.52, 0.55, 0.65).normalize();

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const broad = fbm3(direction, profile.name === "Charon" ? 2.1 : 1.55, 4, profile.seed);
    const medium = fbm3(direction, profile.name === "Charon" ? 7.5 : 5.4, 4, profile.seed + 29.4);
    const fine = fbm3(direction, 20.0, 3, profile.seed + 83.7);
    let radius = 1;
    let craterFloor = 0;
    let craterRim = 0;

    const reliefStrength = profile.name === "Charon" ? 0.010 : 0.030;
    radius += broad * reliefStrength;
    radius += medium * (profile.name === "Charon" ? 0.006 : 0.018);
    radius += fine * (profile.name === "Charon" ? 0.0025 : 0.008);

    craterCenters.forEach((center, craterIndex) => {
      const sizeBase = profile.name === "Charon" ? 0.08 : 0.12;
      const angularRadius = sizeBase + ((craterIndex * 0.137 + profile.seed) % 1) * (profile.name === "Charon" ? 0.11 : 0.13);
      const depth = (profile.name === "Charon" ? 0.010 : 0.025)
        + ((craterIndex * 0.193 + profile.seed) % 1) * (profile.name === "Charon" ? 0.017 : 0.035);
      const sample = craterSample(direction, center, angularRadius, depth);
      radius += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor);
      craterRim = Math.max(craterRim, sample.rim);
    });

    if (profile.name === "Charon") {
      // New Horizons revealed a moon-spanning tectonic belt near the equator.
      const equatorial = 1 - smoothstep(0.025, 0.19, Math.abs(direction.y));
      const canyonModulation = 0.45 + 0.55 * Math.abs(Math.sin(Math.atan2(direction.z, direction.x) * 4.0 + direction.y * 7.0));
      radius -= equatorial * canyonModulation * 0.010;
    } else if (profile.name === "Kerberos") {
      // A continuous radial pinch gives a single watertight double-lobed body.
      const waist = Math.exp(-Math.pow(direction.x / 0.28, 2));
      const positiveLobe = Math.max(0, direction.x);
      const negativeLobe = Math.max(0, -direction.x);
      radius *= 1 - waist * 0.10 + positiveLobe * 0.035 + negativeLobe * 0.020;
    } else if (profile.name === "Styx") {
      radius *= 1 + Math.max(0, direction.x) * 0.025 - Math.max(0, -direction.x) * 0.018;
    } else if (profile.name === "Hydra") {
      radius *= 1 + Math.max(0, direction.z) * 0.020 - Math.max(0, -direction.x) * 0.014;
    }

    radius = Math.max(profile.name === "Charon" ? 0.95 : 0.84, radius);
    positions.setXYZ(index, direction.x * radius, direction.y * radius, direction.z * radius);

    const surfaceNoise = THREE.MathUtils.clamp(medium * 0.5 + fine * 0.22 + 0.5, 0, 1);
    colour.copy(base)
      .lerp(light, surfaceNoise * (profile.name === "Charon" ? 0.28 : 0.42))
      .lerp(dark, THREE.MathUtils.clamp(craterFloor * 0.48, 0, 0.58));

    if (profile.name === "Charon") {
      const polarWeight = smoothstep(0.42, 0.84, direction.y)
        * (0.82 + 0.18 * Math.sin(Math.atan2(direction.z, direction.x) * 2.0 + 0.7));
      colour.lerp(accent, THREE.MathUtils.clamp(polarWeight * 0.78, 0, 0.80));
      const canyonTone = (1 - smoothstep(0.035, 0.20, Math.abs(direction.y))) * 0.14;
      colour.lerp(dark, canyonTone);
    } else if (profile.name === "Nix") {
      const spotDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(redSpotCenter), -1, 1));
      const spot = 1 - smoothstep(0.20, 0.42, spotDistance);
      colour.lerp(accent, spot * 0.64);
    } else if (profile.name === "Hydra") {
      const darkDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(hydraDarkCenter), -1, 1));
      const darkPatch = 1 - smoothstep(0.22, 0.50, darkDistance);
      colour.lerp(accent, darkPatch * 0.32);
    }

    colour.lerp(light, THREE.MathUtils.clamp(craterRim * 0.10, 0, 0.10));
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createPlutonianMoonSurface(profile, quality = "high") {
  const geometry = createGeometry(profile, quality);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: profile.name === "Charon" ? 0.965 : 0.985,
    metalness: 0,
    envMapIntensity: profile.name === "Charon" ? 0.030 : 0.020,
    dithering: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${profile.name} New Horizons-informed surface`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.plutonianSurfaceModel = "new-horizons-informed-individual-3d";
  return mesh;
}

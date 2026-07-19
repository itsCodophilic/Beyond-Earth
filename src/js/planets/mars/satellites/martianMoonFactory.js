import * as THREE from "three";

/**
 * Creates deterministic terrain without relying on a flat colour/displacement
 * image. Every value is calculated from the vertex's position in 3D space, so
 * craters remain real depressions and the silhouette stays irregular from every
 * camera angle.
 */
function hash3(x, y, z, seed) {
  const value = Math.sin(
    x * 127.1
    + y * 311.7
    + z * 74.7
    + seed * 19.19,
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
      seed + octave * 17.31,
    ) * amplitude;
    normalization += amplitude;
    amplitude *= 0.52;
    scale *= 2.03;
  }

  return normalization > 0 ? value / normalization : 0;
}

function hash2(x, y, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 53.47) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise2(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const sample = (dx, dy) => hash2(ix + dx, iy + dy, seed);
  const x0 = THREE.MathUtils.lerp(sample(0, 0), sample(1, 0), ux);
  const x1 = THREE.MathUtils.lerp(sample(0, 1), sample(1, 1), ux);
  return THREE.MathUtils.lerp(x0, x1, uy);
}

function fbm2(x, y, seed, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += smoothNoise2(x * frequency, y * frequency, seed + octave * 11.71) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return normalization > 0 ? value / normalization : 0;
}

function smoothstep(edge0, edge1, value) {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function directionFromArray(value) {
  return new THREE.Vector3(value[0], value[1], value[2]).normalize();
}

function sampleCrater(direction, crater) {
  const center = crater._center;
  const angularDistance = Math.acos(THREE.MathUtils.clamp(direction.dot(center), -1, 1));
  const normalizedDistance = angularDistance / crater.radius;
  if (normalizedDistance > 1.32) {
    return { height: 0, floor: 0, rim: 0 };
  }

  const floorMask = 1 - smoothstep(0.10, 0.88, normalizedDistance);
  const bowl = -crater.depth * Math.pow(Math.max(0, 1 - normalizedDistance * normalizedDistance), 1.45);
  const rim = crater.rim
    * Math.exp(-Math.pow((normalizedDistance - 0.96) / 0.12, 2));
  const centralPeak = (crater.peak ?? 0)
    * Math.exp(-Math.pow(normalizedDistance / 0.18, 2));

  return {
    height: bowl + rim + centralPeak,
    floor: floorMask,
    rim: Math.exp(-Math.pow((normalizedDistance - 0.96) / 0.14, 2)),
  };
}

function sampleGroove(direction, groove) {
  const alongSurface = Math.abs(direction.dot(groove._planeNormal));
  const widthMask = 1 - smoothstep(groove.width * 0.35, groove.width, alongSurface);
  const regionMask = smoothstep(-0.28, 0.18, direction.dot(groove._regionDirection));
  const brokenEdge = 0.62 + 0.38 * smoothNoise3(
    direction.x * 31,
    direction.y * 31,
    direction.z * 31,
    groove.seed,
  );
  return -groove.depth * widthMask * regionMask * brokenEdge;
}

function prepareProfile(profile) {
  return {
    ...profile,
    craters: profile.craters.map((crater) => ({
      ...crater,
      _center: directionFromArray(crater.center),
    })),
    grooves: (profile.grooves ?? []).map((groove) => ({
      ...groove,
      _planeNormal: directionFromArray(groove.planeNormal),
      _regionDirection: directionFromArray(groove.regionDirection),
    })),
  };
}

function geometryDetailForQuality(quality) {
  if (quality === "low") return 10;
  if (quality === "medium") return 18;
  return 30;
}

function createSurfaceDetailTextures(profile) {
  const cacheKey = `${profile.seed}-${profile.baseColour}-${profile.dustColour}-${profile.darkColour}`;
  if (!createSurfaceDetailTextures.cache.has(cacheKey)) {
    const width = 384;
    const height = 192;
    const albedoData = new Uint8Array(width * height * 4);
    const roughnessData = new Uint8Array(width * height * 4);
    const aoData = new Uint8Array(width * height * 4);
    const craterSpots = Array.from({ length: 48 }, (_, index) => ({
      x: hash2(index * 3.1, 4.7, profile.seed + 1.2),
      y: hash2(index * 1.7, 8.3, profile.seed + 9.6),
      radius: 0.018 + hash2(index * 2.9, 6.1, profile.seed + 12.5) * 0.055,
      depth: 0.2 + hash2(index * 5.2, 3.8, profile.seed + 17.3) * 0.65,
    }));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = x / width;
        const ny = y / height;
        const broad = fbm2(nx * 5.5, ny * 5.5, profile.seed, 4);
        const fine = fbm2(nx * 18.0, ny * 18.0, profile.seed + 31.5, 4);
        const grains = fbm2(nx * 42.0, ny * 42.0, profile.seed + 78.4, 3);
        let craterField = 0;
        for (const spot of craterSpots) {
          const dx = nx - spot.x;
          const dy = ny - spot.y;
          const dist = Math.sqrt(dx * dx + dy * dy) / spot.radius;
          if (dist < 1.0) {
            craterField = Math.max(craterField, (1.0 - dist) * spot.depth);
          }
        }
        const brightness = THREE.MathUtils.clamp(0.76 + broad * 0.16 + fine * 0.08 + grains * 0.04 - craterField * 0.14, 0, 1);
        const roughness = THREE.MathUtils.clamp(0.70 + fine * 0.22 + craterField * 0.12, 0, 1);
        const occlusion = THREE.MathUtils.clamp(0.62 + broad * 0.12 - craterField * 0.40, 0, 1);
        const bump = THREE.MathUtils.clamp(0.42 + fine * 0.28 + grains * 0.18 - craterField * 0.15, 0, 1);
        const idx = (y * width + x) * 4;
        const a = Math.round(brightness * 255);
        const r = Math.round(roughness * 255);
        const o = Math.round(occlusion * 255);
        const b = Math.round(bump * 255);
        albedoData[idx] = a;
        albedoData[idx + 1] = a;
        albedoData[idx + 2] = a;
        albedoData[idx + 3] = 255;
        roughnessData[idx] = r;
        roughnessData[idx + 1] = r;
        roughnessData[idx + 2] = r;
        roughnessData[idx + 3] = 255;
        aoData[idx] = o;
        aoData[idx + 1] = o;
        aoData[idx + 2] = o;
        aoData[idx + 3] = b;
      }
    }
    const albedo = new THREE.DataTexture(albedoData, width, height, THREE.RGBAFormat);
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.RepeatWrapping;
    albedo.needsUpdate = true;

    const roughness = new THREE.DataTexture(roughnessData, width, height, THREE.RGBAFormat);
    roughness.wrapS = THREE.RepeatWrapping;
    roughness.wrapT = THREE.RepeatWrapping;
    roughness.needsUpdate = true;

    const bump = new THREE.DataTexture(aoData, width, height, THREE.RGBAFormat);
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.RepeatWrapping;
    bump.needsUpdate = true;

    createSurfaceDetailTextures.cache.set(cacheKey, { albedo, roughness, bump });
  }
  return createSurfaceDetailTextures.cache.get(cacheKey);
}
createSurfaceDetailTextures.cache = new Map();

function createSculptedGeometry(rawProfile, quality) {
  const profile = prepareProfile(rawProfile);
  const geometry = new THREE.IcosahedronGeometry(1, geometryDetailForQuality(quality));
  const positions = geometry.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const direction = new THREE.Vector3();
  const colour = new THREE.Color();
  const baseColour = new THREE.Color(profile.baseColour);
  const dustColour = new THREE.Color(profile.dustColour);
  const darkColour = new THREE.Color(profile.darkColour);
  const freshColour = new THREE.Color(profile.freshColour ?? profile.dustColour);

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();

    const broadTerrain = fbm3(direction, 1.75, 4, profile.seed) * profile.broadRelief;
    const rockyTerrain = fbm3(direction, 6.5, 4, profile.seed + 41) * profile.rockRelief;
    const fineTerrain = fbm3(direction, 21, 3, profile.seed + 89) * profile.fineRelief;

    let craterHeight = 0;
    let craterFloor = 0;
    let craterRim = 0;
    profile.craters.forEach((crater) => {
      const sample = sampleCrater(direction, crater);
      craterHeight += sample.height;
      craterFloor = Math.max(craterFloor, sample.floor * (crater.darkness ?? 0.45));
      craterRim = Math.max(craterRim, sample.rim);
    });

    let grooveHeight = 0;
    profile.grooves.forEach((groove) => {
      grooveHeight += sampleGroove(direction, groove);
    });

    const radialHeight = Math.max(
      profile.minimumRadius,
      1 + broadTerrain + rockyTerrain + fineTerrain + craterHeight + grooveHeight,
    );
    positions.setXYZ(
      index,
      direction.x * radialHeight,
      direction.y * radialHeight,
      direction.z * radialHeight,
    );

    const colourNoise = fbm3(direction, 8.5, 3, profile.seed + 137) * 0.5 + 0.5;
    const grain = fbm3(direction, 28.0, 2, profile.seed + 233) * 0.5 + 0.5;
    const highGround = THREE.MathUtils.clamp((radialHeight - 0.93) * 3.2, 0, 1);
    colour.copy(baseColour)
      .lerp(dustColour, colourNoise * 0.44 + highGround * 0.18 + grain * 0.12)
      .lerp(darkColour, THREE.MathUtils.clamp(craterFloor * 0.66, 0, 0.76))
      .lerp(
        freshColour,
        THREE.MathUtils.clamp(
          craterRim * (profile.freshMaterialStrength ?? 0.28),
          0,
          profile.freshMaterialStrength ?? 0.28,
        ),
      );
    colour.offsetHSL(0, -0.02 + grain * 0.02, craterRim * 0.065 - Math.max(0, -grooveHeight) * 0.85);
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  if (geometry.getAttribute("uv") && !geometry.getAttribute("uv2")) {
    geometry.setAttribute("uv2", geometry.getAttribute("uv").clone());
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export function createMartianMoonSurface(profile, quality = "high") {
  const geometry = createSculptedGeometry(profile.surface, quality);
  const detailTextures = createSurfaceDetailTextures(profile.surface);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTextures.albedo,
    roughness: Math.min(1, (profile.surface.roughness ?? 0.96) * 0.98),
    roughnessMap: detailTextures.roughness,
    metalness: 0,
    aoMap: detailTextures.bump,
    aoMapIntensity: 0.46,
    bumpMap: detailTextures.bump,
    bumpScale: 0.043,
    envMapIntensity: 0.03,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

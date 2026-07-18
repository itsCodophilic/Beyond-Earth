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

function smoothstep(edge0, edge1, value) {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function directionFromArray(value) {
  return new THREE.Vector3(value[0], value[1], value[2]).normalize();
}

/**
 * Returns the signed height contributed by one impact crater.
 *
 * - The broad negative bowl physically pushes vertices into the moon.
 * - A narrow positive ring forms an eroded crater rim.
 * - Large craters can receive a small central rebound mound.
 *
 * The returned zones are also used to colour the crater floor and rim, keeping
 * the material variation aligned with the real geometry rather than painting a
 * circular decal on top of it.
 */
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

/**
 * Phobos carries long troughs and chains of aligned pits. A groove is modelled
 * as a shallow great-circle trench, then limited to the part of the moon where
 * it should be visible so it does not become an artificial band around the
 * entire body.
 */
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
  // PolyhedronGeometry's detail value grows the triangle grid gradually rather
  // than exponentially. These values keep even low quality clearly rounded,
  // while high quality gives crater bowls and narrow grooves enough vertices
  // to survive a close cinematic focus shot without visible polygon panels.
  if (quality === "low") return 8;
  if (quality === "medium") return 14;
  return 22;
}

/**
 * Builds one unit-sized Martian moon. satelliteSystem.js applies the cinematic
 * display size afterwards, which means the sculpting code stays reusable and
 * all existing focus/click calculations continue to work.
 */
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

    // Broad low-frequency noise creates the lumpy overall body. Finer noise
    // adds broken regolith and chips that catch light in close inspection.
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

    // Colour follows height and geology in object space. This produces varied
    // mineral dust with no UV seams, repeating bands, or flat crater stickers.
    const colourNoise = fbm3(direction, 8.5, 3, profile.seed + 137) * 0.5 + 0.5;
    const highGround = THREE.MathUtils.clamp((radialHeight - 0.93) * 3.2, 0, 1);
    colour.copy(baseColour)
      .lerp(dustColour, colourNoise * 0.48 + highGround * 0.20)
      .lerp(darkColour, THREE.MathUtils.clamp(craterFloor * 0.62, 0, 0.72))
      // NASA enhanced-colour observations show fresher crater rims and exposed
      // high ground as brighter and less red than mature space-weathered dust.
      .lerp(
        freshColour,
        THREE.MathUtils.clamp(
          craterRim * (profile.freshMaterialStrength ?? 0.28),
          0,
          profile.freshMaterialStrength ?? 0.28,
        ),
      );
    colour.offsetHSL(0, 0, craterRim * 0.055 - Math.max(0, -grooveHeight) * 0.9);
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * Creates the visible rock mesh only. Orbit placement, hit targets, focus data,
 * and slow-motion remain owned by the shared satellite system.
 */
export function createMartianMoonSurface(profile, quality = "high") {
  const geometry = createSculptedGeometry(profile.surface, quality);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: profile.surface.roughness ?? 1,
    metalness: 0,
    envMapIntensity: 0.015,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

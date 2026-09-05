/**
 * Scientific, interactive main asteroid-belt builder.
 *
 * Visual goals:
 * - a sparse three-dimensional belt between Mars and Jupiter
 * - Kirkwood resonance gaps rather than one solid ring
 * - composition-specific C, S, and M class surfaces
 * - smooth, genuinely three-dimensional silhouettes
 * - crater bowls, raised rims, grooves, boulders, and rubble-pile forms
 * - every visible 3D rock is clickable; only sub-pixel debris is unresolved
 * - collision families and Jupiter Trojan swarms
 *
 * The resolved objects are not direct scans of real asteroids. They are
 * procedural models informed by spacecraft imagery of bodies such as Bennu,
 * Ryugu, Vesta, and metallic-asteroid mission concepts. This keeps the project
 * self-contained while avoiding a repeated low-poly "game rock" appearance.
 */
import * as THREE from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { SOLAR_ORBIT_SCALE, getAsteroidVisualRadius, getSizeComparisonText, parseDiameterKm } from "../config/celestialScale.js";
import { markPointerProxy } from "./pointerProxies.js";

const BELT_INNER_RADIUS = 44 * SOLAR_ORBIT_SCALE;
const BELT_OUTER_RADIUS = 52 * SOLAR_ORBIT_SCALE;
const JUPITER_ORBIT_RADIUS = 75 * SOLAR_ORBIT_SCALE;

// Neutral inspection lighting is isolated to this layer. Focused asteroid meshes
// keep layer 0 for normal rendering and temporarily enable this extra layer,
// preventing the inspection fill from illuminating the entire dense belt.
export const ASTEROID_INSPECTION_LAYER = 7;

// Rendering one mesh for every real asteroid would overwhelm both the CPU and
// the browser's memory. These two layers preserve the *visual population* of
// the million-plus-object belt while keeping the number of draw calls tiny:
// instanced rocks are genuine 3D geometry, and point-sized pebbles fill the
// far distance where individual geometry would occupy less than one pixel.
const INSTANCED_BOULDER_COUNTS = { C: 9000, S: 4000, M: 1500 };
const UNRESOLVED_PEBBLE_COUNT = 120000;

const ASTEROID_QUALITY_PRESETS = Object.freeze({
  high: Object.freeze({ instanceDensity: 1, debrisDensity: 1 }),
  medium: Object.freeze({ instanceDensity: 0.72, debrisDensity: 0.65 }),
  low: Object.freeze({ instanceDensity: 0.44, debrisDensity: 0.34 }),
});

// The belt is physically sparse, but in a browser a real-scale pebble can become
// too dark and too small to read. Encounter mode preserves the same population
// and positions while increasing only local visual legibility near the belt.
const ASTEROID_ENCOUNTER = Object.freeze({
  verticalHalfThickness: 125,
  fullStrengthDistance: 28,
  fadeDistance: 210,
  maximumVisualScale: 1.72,
  maximumEmissiveBoost: 0.20,
  maximumEnvironmentBoost: 0.10,
  minimumMotionMultiplier: 0.25,
});

// Physical asteroid spin periods range from minutes to many days. Rendering
// those values in literal real time would make almost every asteroid appear
// motionless during a website visit, so the project preserves the *relative*
// speed ordering while compressing periods into a readable cinematic range.
// Orbital motion remains separately slowed near the belt for click stability;
// self-rotation does not move an asteroid's centre, so it can stay visible.
const ASTEROID_ROTATION = Object.freeze({
  referencePhysicalHours: 6,
  referenceVisualSeconds: 18,
  minimumVisualSeconds: 4.8,
  maximumVisualSeconds: 52,
  fastRotatorChance: 0.0035,
  slowRotatorChance: 0.15,
  tumbleChance: 0.16,
  encounterRateMultiplier: 0.88,
  hoveredRateMultiplier: 0.78,
  focusedRateMultiplier: 0.68,
});

const COMPOSITIONS = {
  S: {
    label: "S-type (silicate)",
    description: "A stony inner-belt asteroid rich in silicate minerals, magnesium, and nickel-iron.",
    baseColors: ["#5b5650", "#8b7765", "#38332d"],
    roughness: 0.88,
    metalness: 0.03,
    bumpScale: 0.14,
    density: "Silicate and nickel-iron",
    archetypes: ["elongated", "fractured", "irregular"],
  },
  M: {
    label: "M-type (metallic)",
    description: "A dense metal-rich asteroid containing substantial iron and nickel with rocky inclusions.",
    baseColors: ["#4b4d4b", "#7d766e", "#2b2d2d"],
    roughness: 0.62,
    metalness: 0.28,
    bumpScale: 0.11,
    density: "Iron-nickel metal mixed with silicate rock",
    archetypes: ["rounded", "elongated", "fractured"],
  },
  C: {
    label: "C-type (carbonaceous)",
    description: "A dark primitive asteroid rich in carbon compounds, hydrated minerals, and possible water-bearing material.",
    baseColors: ["#1b1e1d", "#3b3832", "#0b0d0d"],
    roughness: 0.95,
    metalness: 0.005,
    bumpScale: 0.16,
    density: "Carbon-rich hydrated rock",
    archetypes: ["rubble", "top", "irregular"],
  },
};

// Colours remain deliberately muted. Real asteroid surfaces are mostly dark
// charcoal, weathered grey, and subdued iron/silicate browns—not saturated tan.
const COMPOSITION_PALETTES = Object.fromEntries(
  Object.entries(COMPOSITIONS).map(([key, value]) => [
    key,
    value.baseColors.map((hex) => new THREE.Color(hex)),
  ]),
);

// The Sun is intentionally extremely bright in this cinematic scene. These
// neutral multipliers keep asteroid albedo within realistic dark-stone ranges
// instead of letting direct solar illumination bleach every rock to white.


// Built-in StandardMaterial multiplies material colour, vertex colour, and
// InstancedMesh colour together. Keep the base material neutral so the
// composition-specific vertex and instance colours are not multiplied into
// the same muddy brown. Emissive colours are intentionally very subtle: they
// preserve class separation at distance without making asteroids self-lit.
const COMPOSITION_EMISSIVE = Object.freeze({
  C: 0x070a08,
  S: 0x100906,
  M: 0x0b0d0e,
});

const COMPOSITION_ENCOUNTER_EMISSIVE = Object.freeze({
  C: new THREE.Color(0x465149),
  S: new THREE.Color(0x886651),
  M: new THREE.Color(0x747c7c),
});

// Focused asteroids are viewed extremely close to the camera while the Sun's
// warm point light remains physically present in the scene. Without a neutral
// inspection correction, that warm light overwhelms the subtle C/S/M albedo
// differences and makes every body appear yellow-brown. These values preserve
// normal PBR shading while restoring each composition's intended identity.
const FOCUSED_COMPOSITION_APPEARANCE = Object.freeze({
  C: Object.freeze({
    neutralAlbedo: new THREE.Color(0x7a857e),
    emissive: new THREE.Color(0x26312c),
    emissiveIntensity: 0.44,
    albedoMix: 0.30,
    roughnessFloor: 0.92,
    metalnessCeiling: 0.015,
    environmentIntensity: 0.018,
  }),
  S: Object.freeze({
    neutralAlbedo: new THREE.Color(0x8c735f),
    emissive: new THREE.Color(0x36271f),
    emissiveIntensity: 0.30,
    albedoMix: 0.22,
    roughnessFloor: 0.86,
    metalnessCeiling: 0.035,
    environmentIntensity: 0.025,
  }),
  M: Object.freeze({
    neutralAlbedo: new THREE.Color(0x81898a),
    emissive: new THREE.Color(0x303a3c),
    emissiveIntensity: 0.42,
    albedoMix: 0.34,
    roughnessFloor: 0.70,
    metalnessCeiling: 0.20,
    environmentIntensity: 0.075,
  }),
});

const MAJOR_BODIES = [
  {
    name: "Ceres",
    composition: "C",
    diameter: "939 km",
    radius: 47.8 * SOLAR_ORBIT_SCALE,
    heliocentricAU: 2.7675,
    angle: 0.58,
    size: 0.92,
    eccentricity: 0.075,
    inclination: 0.18,
    orbitalSpeed: 0.00052,
    rotationPeriodHours: 9.074,
    archetype: "rounded",
    roundness: 0.82,
    description: "The largest body in the main belt and a dwarf planet, with a comparatively rounded shape and bright salt-bearing deposits.",
  },
  {
    name: "Vesta",
    composition: "S",
    diameter: "525 km",
    radius: 45.7 * SOLAR_ORBIT_SCALE,
    heliocentricAU: 2.3613,
    angle: 2.3,
    size: 0.67,
    eccentricity: 0.089,
    inclination: 0.12,
    orbitalSpeed: 0.00063,
    rotationPeriodHours: 5.342,
    archetype: "basin",
    roundness: 0.38,
    description: "A differentiated rocky protoplanet with a basaltic crust and an enormous south-polar impact basin.",
  },
  {
    name: "Pallas",
    composition: "C",
    diameter: "512 km",
    radius: 48.4 * SOLAR_ORBIT_SCALE,
    heliocentricAU: 2.7700,
    angle: 4.12,
    size: 0.61,
    eccentricity: 0.23,
    inclination: 0.52,
    orbitalSpeed: 0.00049,
    rotationPeriodHours: 7.813,
    archetype: "irregular",
    roundness: 0.28,
    description: "A large, heavily cratered body following one of the most inclined orbits among the major main-belt asteroids.",
  },
  {
    name: "Hygiea",
    composition: "C",
    diameter: "434 km",
    radius: 50.9 * SOLAR_ORBIT_SCALE,
    heliocentricAU: 3.1415,
    angle: 5.18,
    size: 0.54,
    eccentricity: 0.12,
    inclination: 0.07,
    orbitalSpeed: 0.00043,
    rotationPeriodHours: 13.83,
    archetype: "rounded",
    roundness: 0.72,
    description: "A very dark carbonaceous body and the largest member of the Hygiea collision family.",
  },
  {
    name: "Psyche",
    composition: "M",
    diameter: "≈ 280 × 232 km",
    radius: 46.9 * SOLAR_ORBIT_SCALE,
    heliocentricAU: 2.9225,
    angle: 3.28,
    size: 0.43,
    eccentricity: 0.14,
    inclination: 0.05,
    orbitalSpeed: 0.00058,
    rotationPeriodHours: 4.196,
    archetype: "irregular",
    roundness: 0.22,
    description: "A large metal-rich asteroid whose exposed mixture of metal and silicate rock may preserve material from an early planetesimal.",
  },
];

const _position = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _axisA = new THREE.Vector3();
const _axisB = new THREE.Vector3();
const _instanceMatrix = new THREE.Matrix4();
const _instanceQuaternion = new THREE.Quaternion();
const _instanceScale = new THREE.Vector3();
const _hoverProjectedPosition = new THREE.Vector3();
const _hoverCameraPosition = new THREE.Vector3();
const _spinQuaternion = new THREE.Quaternion();
const _tumbleQuaternion = new THREE.Quaternion();
const _combinedSpinQuaternion = new THREE.Quaternion();
const _spinAxis = new THREE.Vector3();
const _tumbleAxis = new THREE.Vector3();
const _perlinNoise = new ImprovedNoise();
const _surfaceColor = new THREE.Color();
const _rustMineralColor = new THREE.Color(0x6d4938);
const _silicateOliveColor = new THREE.Color(0x6b6656);
const _hydratedMineralColor = new THREE.Color(0x536057);
const _carbonDustColor = new THREE.Color(0x2d2b27);
const _metalMineralColor = new THREE.Color(0x8a8379);
const _metalOxideColor = new THREE.Color(0x6f5746);
const _instanceTintColor = new THREE.Color();
const _focusedInstanceTintColor = new THREE.Color();
const SURFACE_FRAGMENT_GEOMETRY_CACHE = new Map();

/** Stable pseudo-random value from any numeric seed. */
function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function smoothNoise3(x, y, z, seed) {
  // Perlin noise changes smoothly in every direction without producing the
  // parallel sine-wave bands that made the previous surface look synthetic.
  const offsetX = (seed * 0.754877666) % 97;
  const offsetY = (seed * 0.569840291) % 89;
  const offsetZ = (seed * 0.438289121) % 83;
  return _perlinNoise.noise(
    x + offsetX,
    y + offsetY,
    z + offsetZ,
  ) * 0.5 + 0.5;
}

function fractalNoise(direction, seed) {
  let amplitude = 0.55;
  let frequency = 2.3;
  let total = 0;
  let weight = 0;

  for (let octave = 0; octave < 5; octave += 1) {
    total += smoothNoise3(
      direction.x * frequency,
      direction.y * frequency,
      direction.z * frequency,
      seed + octave * 11.3,
    ) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.08;
  }

  return total / weight;
}

/**
 * Produces stone colour directly from a point on the 3D surface.
 * Because the lookup uses XYZ direction rather than UV pixels, it has no seams,
 * circular decals, texture stretching, or repeating horizontal bands.
 */
function writeSurfaceColor(target, composition, direction, seed, craterShade = 0, rimLight = 0) {
  const palette = COMPOSITION_PALETTES[composition];
  const broad = fractalNoise(direction, seed + 211);
  const mineral = fractalNoise(
    _normal.copy(direction).multiplyScalar(3.7),
    seed + 337,
  );
  const grain = smoothNoise3(
    direction.x * 31,
    direction.y * 31,
    direction.z * 31,
    seed + 491,
  );

  target.copy(palette[0]);
  target.lerp(palette[1], THREE.MathUtils.smoothstep(broad, 0.24, 0.80) * 0.74);
  target.lerp(palette[2], THREE.MathUtils.smoothstep(mineral, 0.44, 0.84) * 0.58);

  if (composition === "C") {
    if (mineral > 0.56) {
      target.lerp(_hydratedMineralColor, (mineral - 0.56) * 0.34);
    }
    if (grain > 0.70) {
      target.lerp(_carbonDustColor, (grain - 0.70) * 0.40);
    }
  } else if (composition === "S") {
    if (grain > 0.66) {
      target.lerp(_rustMineralColor, (grain - 0.66) * 0.68);
    }
    if (broad < 0.36) {
      target.lerp(_silicateOliveColor, (0.36 - broad) * 0.36);
    }
  } else if (composition === "M") {
    if (mineral > 0.54) {
      target.lerp(_metalMineralColor, (mineral - 0.54) * 0.50);
    }
    if (grain > 0.70) {
      target.lerp(_metalOxideColor, (grain - 0.70) * 0.42);
    }
  }

  const compositionBrightness = composition === "C"
    ? 0.88
    : composition === "M"
      ? 0.98
      : 1;
  const brightness = (
    0.66 + broad * 0.36 + (grain - 0.5) * 0.12
    - craterShade * 0.34 + rimLight * 0.14
  ) * compositionBrightness;
  target.multiplyScalar(THREE.MathUtils.clamp(brightness, 0.30, 1.12));
  return target;
}

/** Maps the project's artistic belt radius back to an approximate AU value. */
function radiusToAU(radius) {
  return THREE.MathUtils.mapLinear(
    radius,
    BELT_INNER_RADIUS,
    BELT_OUTER_RADIUS,
    2.2,
    3.2,
  );
}

/** Returns true when a radius falls inside one of the visual Kirkwood gaps. */
function isInsideKirkwoodGap(radius) {
  const gaps = [
    { centre: 46.35 * SOLAR_ORBIT_SCALE, halfWidth: 0.24 * SOLAR_ORBIT_SCALE },
    { centre: 48.72 * SOLAR_ORBIT_SCALE, halfWidth: 0.18 * SOLAR_ORBIT_SCALE },
    { centre: 50.05 * SOLAR_ORBIT_SCALE, halfWidth: 0.16 * SOLAR_ORBIT_SCALE },
    { centre: 50.92 * SOLAR_ORBIT_SCALE, halfWidth: 0.20 * SOLAR_ORBIT_SCALE },
  ];
  return gaps.some((gap) => Math.abs(radius - gap.centre) < gap.halfWidth);
}

/** Selects composition from distance, with small overlap between zones. */
function compositionForRadius(radius, seed) {
  const au = radiusToAU(radius);
  const random = seededRandom(seed);

  // Preserve the observed radial trend—warmer S-types are more common in the
  // inner belt and dark C-types dominate farther out—without turning the belt
  // into three monochrome rings. Every zone retains a mixed population.
  if (au < 2.55) {
    if (random < 0.45) return "C";
    if (random < 0.90) return "S";
    return "M";
  }
  if (au < 2.85) {
    if (random < 0.65) return "C";
    if (random < 0.90) return "S";
    return "M";
  }
  if (random < 0.82) return "C";
  if (random < 0.94) return "S";
  return "M";
}

function makeAsteroidInstanceTint(composition, seed) {
  const brightness = 0.90 + seededRandom(seed + 1) * 0.10;
  const variation = seededRandom(seed + 2);

  if (composition === "C") {
    // Carbonaceous bodies: charcoal/ashen grey with occasional hydrated,
    // slightly green-neutral mineral tones.
    _instanceTintColor.setRGB(
      brightness * (0.72 + variation * 0.08),
      brightness * (0.79 + variation * 0.08),
      brightness * (0.75 + variation * 0.07),
    );
  } else if (composition === "S") {
    // Silicate bodies: warmer stony grey, muted iron-red and olive-brown.
    _instanceTintColor.setRGB(
      brightness,
      brightness * (0.72 + variation * 0.10),
      brightness * (0.58 + variation * 0.10),
    );
  } else {
    // Metallic bodies are dull rather than chrome. Alternate between cool
    // nickel-grey and oxidised iron-grey so the population is not uniform.
    const oxidised = variation > 0.58;
    _instanceTintColor.setRGB(
      brightness * (oxidised ? 0.92 : 0.78),
      brightness * (oxidised ? 0.72 : 0.84),
      brightness * (oxidised ? 0.62 : 0.88),
    );
  }

  return _instanceTintColor.clone();
}

/** Creates smooth material variants for the three composition classes. */
function createCompositionMaterials() {
  return Object.fromEntries(
    Object.entries(COMPOSITIONS).map(([key, composition]) => {
      const variants = Array.from({ length: 4 }, () =>
        new THREE.MeshStandardMaterial({
          // Vertex colours already contain the physical composition palette.
          // White prevents a second material tint from collapsing C/S/M into
          // one brown colour under strong solar lighting.
          color: 0xffffff,
          vertexColors: true,
          roughness: composition.roughness,
          metalness: composition.metalness,
          envMapIntensity: key === "M" ? 0.18 : 0.045,
          emissive: COMPOSITION_EMISSIVE[key],
          emissiveIntensity: 0.10,
          flatShading: false,
          userData: {
            asteroidComposition: key,
            asteroidEncounterEmissiveColor: COMPOSITION_ENCOUNTER_EMISSIVE[key].clone(),
          },
        }),
      );
      return [key, variants];
    }),
  );
}

/**
 * Adds GPU-side local scale and independent per-instance spin.
 *
 * Thousands of instance matrices remain static. The vertex shader rotates each
 * rock around its own axis using compact per-instance attributes, avoiding a
 * CPU loop and GPU buffer upload for every boulder on every frame.
 */
function installInstancedAsteroidVisualMotion(material) {
  if (!material || material.userData?.asteroidVisibilityScaleUniform) return;

  const scaleUniform = { value: 1 };
  const spinTimeUniform = { value: 0 };
  material.userData.asteroidVisibilityScaleUniform = scaleUniform;
  material.userData.asteroidSpinTimeUniform = spinTimeUniform;
  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.(shader, renderer);
    shader.uniforms.uAsteroidVisualScale = scaleUniform;
    shader.uniforms.uAsteroidSpinTime = spinTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uAsteroidVisualScale;
        uniform float uAsteroidSpinTime;
        attribute vec3 aSpinAxis;
        attribute vec3 aTumbleAxis;
        attribute float aSpinRate;
        attribute float aTumbleRate;
        attribute float aSpinPhase;

        vec3 rotateAsteroidVector(vec3 value, vec3 axis, float angle) {
          // Axes are normalized once on the CPU; avoid a square root for every
          // vertex of every asteroid on every frame.
          vec3 safeAxis = axis;
          float cosine = cos(angle);
          float sine = sin(angle);
          return value * cosine
            + cross(safeAxis, value) * sine
            + safeAxis * dot(safeAxis, value) * (1.0 - cosine);
        }

        vec3 applyAsteroidSpin(vec3 value) {
          float spinAngle = aSpinPhase + uAsteroidSpinTime * aSpinRate;
          vec3 rotated = rotateAsteroidVector(value, aSpinAxis, spinAngle);
          if (abs(aTumbleRate) > 0.000001) {
            float tumbleAngle = aSpinPhase * 0.618
              + uAsteroidSpinTime * aTumbleRate;
            rotated = rotateAsteroidVector(rotated, aTumbleAxis, tumbleAngle);
          }
          return rotated;
        }`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `vec3 objectNormal = applyAsteroidSpin(vec3(normal));
        #ifdef USE_TANGENT
          vec3 objectTangent = applyAsteroidSpin(vec3(tangent.xyz));
        #endif`,
      )
      .replace(
        "#include <begin_vertex>",
        "vec3 transformed = applyAsteroidSpin(vec3(position)) * uAsteroidVisualScale;",
      );
  };
  material.customProgramCacheKey = () => "beyond-earth-instanced-asteroid-motion-v2";
}

/** Creates a close-up stone material with no image-based surface shortcuts. */
function createStoneMaterial(compositionKey) {
  const composition = COMPOSITIONS[compositionKey];
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: composition.roughness,
    metalness: composition.metalness,
    envMapIntensity: compositionKey === "M" ? 0.18 : 0.045,
    emissive: COMPOSITION_EMISSIVE[compositionKey],
    emissiveIntensity: 0.10,
    flatShading: false,
    dithering: true,
    userData: {
      asteroidComposition: compositionKey,
      asteroidEncounterEmissiveColor: COMPOSITION_ENCOUNTER_EMISSIVE[compositionKey].clone(),
    },
  });
}

function randomUnitVector(seed) {
  const y = seededRandom(seed + 1) * 2 - 1;
  const angle = seededRandom(seed + 2) * Math.PI * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    y,
    Math.sin(angle) * radius,
  ).normalize();
}

function randomPerpendicularUnitVector(axis, seed) {
  const candidate = randomUnitVector(seed);
  candidate.addScaledVector(axis, -candidate.dot(axis));
  if (candidate.lengthSq() < 1e-6) {
    candidate.set(Math.abs(axis.x) < 0.8 ? 1 : 0, Math.abs(axis.x) < 0.8 ? 0 : 1, 0);
    candidate.addScaledVector(axis, -candidate.dot(axis));
  }
  return candidate.normalize();
}

function logarithmicRange(minimum, maximum, value) {
  return Math.exp(THREE.MathUtils.lerp(
    Math.log(Math.max(1e-6, minimum)),
    Math.log(Math.max(minimum + 1e-6, maximum)),
    THREE.MathUtils.clamp(value, 0, 1),
  ));
}

/** Converts a physical period to a visible but still relatively ordered period. */
function physicalPeriodToVisualSeconds(periodHours) {
  const safeHours = Math.max(1.88 / 60, Number(periodHours) || ASTEROID_ROTATION.referencePhysicalHours);
  const visualSeconds = ASTEROID_ROTATION.referenceVisualSeconds
    * Math.sqrt(safeHours / ASTEROID_ROTATION.referencePhysicalHours);
  return THREE.MathUtils.clamp(
    visualSeconds,
    ASTEROID_ROTATION.minimumVisualSeconds,
    ASTEROID_ROTATION.maximumVisualSeconds,
  );
}

function formatRotationPeriod(periodHours) {
  const safeHours = Math.max(0, Number(periodHours) || 0);
  if (safeHours < 1) {
    return `${Math.max(1, safeHours * 60).toFixed(safeHours < 0.1 ? 2 : 1)} minutes`;
  }
  if (safeHours < 48) return `${safeHours.toFixed(safeHours < 10 ? 2 : 1)} hours`;
  return `${(safeHours / 24).toFixed(1)} days`;
}

/**
 * Builds a deterministic, physics-inspired spin profile.
 *
 * Most generated objects stay above the approximately 2.2-hour rubble-pile
 * barrier. A very small tail represents cohesive super-fast rotators, while a
 * second tail represents slow rotators. Irregular/rubble bodies are more likely
 * to receive non-principal-axis tumbling.
 */
function createAsteroidSpinProfile({
  seed,
  diameterKm = null,
  archetype = "irregular",
  rotationPeriodHours = null,
  rotationState = null,
}) {
  const physicalDiameter = Math.max(0, Number(diameterKm) || 0);
  const sample = seededRandom(seed + 1701);
  const fastChance = ASTEROID_ROTATION.fastRotatorChance
    * (physicalDiameter > 0 && physicalDiameter < 2 ? 1.7 : 1);

  let periodHours = Number(rotationPeriodHours);
  let populationClass = "measured/assigned";

  if (!Number.isFinite(periodHours) || periodHours <= 0) {
    if (sample < fastChance) {
      // 1.88 minutes is the current record for a >500 m asteroid; 2.18 hours
      // keeps this synthetic tail just below the main-belt spin barrier.
      periodHours = logarithmicRange(
        1.88 / 60,
        2.18,
        seededRandom(seed + 1702),
      );
      populationClass = "rare super-fast rotator";
    } else if (sample > 1 - ASTEROID_ROTATION.slowRotatorChance) {
      periodHours = logarithmicRange(24, 144, seededRandom(seed + 1703));
      populationClass = "slow rotator";
    } else {
      periodHours = logarithmicRange(2.25, 24, seededRandom(seed + 1704));
      populationClass = "main rotation population";
    }
  }

  const spinAxis = randomUnitVector(seed + 1711);
  const tumbleAxis = randomPerpendicularUnitVector(spinAxis, seed + 1721);
  const archetypeText = String(archetype).toLowerCase();
  const shapeTumbleBonus = archetypeText.includes("rubble")
    || archetypeText.includes("irregular")
    || archetypeText.includes("fractured")
    ? 0.08
    : 0;
  const slowTumbleBonus = periodHours >= 24 ? 0.07 : 0;
  const veryFastPenalty = periodHours < 2.2 ? -0.11 : 0;
  const tumbleProbability = THREE.MathUtils.clamp(
    ASTEROID_ROTATION.tumbleChance + shapeTumbleBonus + slowTumbleBonus + veryFastPenalty,
    0.025,
    0.38,
  );
  const isTumbling = rotationState === "tumbling"
    || (rotationState !== "principal-axis" && seededRandom(seed + 1731) < tumbleProbability);

  const visualPeriodSeconds = physicalPeriodToVisualSeconds(periodHours);
  const direction = seededRandom(seed + 1741) < 0.5 ? -1 : 1;
  const radiansPerSecond = direction * Math.PI * 2 / visualPeriodSeconds;
  const tumbleDirection = seededRandom(seed + 1742) < 0.5 ? -1 : 1;
  const tumbleRadiansPerSecond = isTumbling
    ? tumbleDirection * Math.abs(radiansPerSecond)
      * (0.11 + seededRandom(seed + 1743) * 0.19)
    : 0;
  const stateLabel = isTumbling
    ? "Non-principal-axis tumbling"
    : "Principal-axis rotation";

  return {
    axis: spinAxis.toArray(),
    tumbleAxis: tumbleAxis.toArray(),
    radiansPerSecond,
    tumbleRadiansPerSecond,
    phase: seededRandom(seed + 1751) * Math.PI * 2,
    physicalPeriodHours: periodHours,
    visualPeriodSeconds,
    isTumbling,
    stateLabel,
    populationClass,
  };
}

function composeAsteroidSpinQuaternion(target, profile, elapsedSeconds) {
  if (!profile) return target.identity();
  _spinAxis.fromArray(profile.axis ?? [0, 1, 0]).normalize();
  _tumbleAxis.fromArray(profile.tumbleAxis ?? [1, 0, 0]).normalize();
  _spinQuaternion.setFromAxisAngle(
    _spinAxis,
    Number(profile.phase ?? 0) + Number(profile.radiansPerSecond ?? 0) * elapsedSeconds,
  );
  if (Math.abs(Number(profile.tumbleRadiansPerSecond ?? 0)) > 1e-8) {
    _tumbleQuaternion.setFromAxisAngle(
      _tumbleAxis,
      Number(profile.phase ?? 0) * 0.618
        + Number(profile.tumbleRadiansPerSecond) * elapsedSeconds,
    );
    return target.copy(_tumbleQuaternion).multiply(_spinQuaternion);
  }
  return target.copy(_spinQuaternion);
}

/**
 * Builds a high-resolution asteroid geometry with composition-aware form.
 * Shared vertices and smooth normals remove the faceted low-poly appearance.
 */
function createAsteroidGeometry({
  seed,
  composition,
  archetype,
  detail = 4,
  roundness = 0.12,
  majorBasin = false,
}) {
  // SphereGeometry is indexed and carries smooth shared normals, like the Moon.
  // Its high subdivision count gives the procedural crater and fracture pass
  // enough vertices to sculpt the surface directly in genuine 3D.
  // detail 5 = hero bodies (Vesta/Ceres), 4 = the standard resolved rock,
  // 2 = the distant stand-in used by the level-of-detail swap. A detail-4 rock
  // is ~9,600 triangles; detail 2 is ~768, which is indistinguishable once the
  // body covers only a handful of pixels.
  const widthSegments = detail >= 5 ? 144 : detail >= 4 ? 80 : detail >= 3 ? 48 : 24;
  const heightSegments = detail >= 5 ? 104 : detail >= 4 ? 60 : detail >= 3 ? 32 : 16;
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.attributes.position;
  const surfaceColors = new Float32Array(positions.count * 3);

  const stretch = new THREE.Vector3(1, 1, 1);
  if (archetype === "elongated") {
    stretch.set(1.35, 0.72, 0.82);
  } else if (archetype === "fractured") {
    stretch.set(1.13, 0.75, 1.02);
  } else if (archetype === "top") {
    stretch.set(1.03, 1.16, 1.03);
  } else if (archetype === "rubble") {
    stretch.set(1.12, 0.92, 1.07);
  } else if (archetype === "basin") {
    stretch.set(1.05, 0.90, 1.02);
  } else if (archetype === "rounded") {
    stretch.set(1.02, 0.98, 1.00);
  } else {
    stretch.set(
      0.86 + seededRandom(seed + 1) * 0.34,
      0.76 + seededRandom(seed + 2) * 0.35,
      0.84 + seededRandom(seed + 3) * 0.36,
    );
  }
  stretch.lerp(new THREE.Vector3(1, 1, 1), roundness);

  const craterCount = majorBasin
    ? 34
    : detail >= 5
      ? 32 + Math.floor(seededRandom(seed + 4) * 19)
      : 10 + Math.floor(seededRandom(seed + 4) * 13);

  const craters = Array.from({ length: craterCount }, (_, index) => ({
    direction: randomUnitVector(seed * 17 + index * 41),
    radius: 0.055 + Math.pow(seededRandom(seed * 31 + index * 13), 1.65) * 0.24,
    depth: 0.026 + seededRandom(seed * 43 + index * 19) * 0.105,
    rim: 0.010 + seededRandom(seed * 59 + index * 23) * 0.040,
  }));

  if (majorBasin) {
    craters.push({
      direction: new THREE.Vector3(0.18, -0.94, 0.27).normalize(),
      radius: 0.52,
      depth: 0.20,
      rim: 0.078,
    });
  }

  const fractureNormals = Array.from({ length: 2 }, (_, index) =>
    randomUnitVector(seed * 71 + index * 37),
  );

  for (let index = 0; index < positions.count; index += 1) {
    _position.fromBufferAttribute(positions, index);
    _direction.copy(_position).normalize();

    const low = fractalNoise(_direction, seed + 10) - 0.5;
    const medium = fractalNoise(_direction.clone().multiplyScalar(2.8), seed + 40) - 0.5;
    const fine = smoothNoise3(
      _direction.x * 29,
      _direction.y * 29,
      _direction.z * 29,
      seed + 80,
    ) - 0.5;

    let radialScale = 1 + low * 0.18 + medium * 0.075 + fine * 0.025;
    let craterShade = 0;
    let rimLight = 0;

    if (archetype === "top") {
      const equator = 1 - Math.abs(_direction.y);
      radialScale += Math.pow(equator, 4.5) * 0.16;
      radialScale -= Math.pow(Math.abs(_direction.y), 3.0) * 0.055;
    }

    if (archetype === "rubble") {
      radialScale += Math.max(0, medium) * 0.085;
    }

    for (const crater of craters) {
      const angularDistance = Math.acos(
        THREE.MathUtils.clamp(_direction.dot(crater.direction), -1, 1),
      );

      const bowl = 1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.06,
        crater.radius,
      );

      const rim = THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.68,
        crater.radius * 0.88,
      ) * (1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.88,
        crater.radius * 1.13,
      ));

      radialScale -= bowl * crater.depth;
      radialScale += rim * crater.rim;
      craterShade = Math.max(craterShade, bowl);
      rimLight = Math.max(rimLight, rim);
    }

    fractureNormals.forEach((fractureNormal, fractureIndex) => {
      const distance = Math.abs(_direction.dot(fractureNormal));
      const groove = 1 - THREE.MathUtils.smoothstep(distance, 0.0, 0.022 + fractureIndex * 0.008);
      radialScale -= groove * (0.010 + fractureIndex * 0.005);
    });

    _position.multiplyScalar(radialScale).multiply(stretch);
    positions.setXYZ(index, _position.x, _position.y, _position.z);
    writeSurfaceColor(
      _surfaceColor,
      composition,
      _direction,
      seed,
      craterShade,
      rimLight,
    );
    surfaceColors[index * 3] = _surfaceColor.r;
    surfaceColors[index * 3 + 1] = _surfaceColor.g;
    surfaceColors[index * 3 + 2] = _surfaceColor.b;
  }

  positions.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(surfaceColors, 3));
  geometry.computeVertexNormals();
  geometry.normalizeNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  geometry.userData.craters = craters.map((crater) => ({
    direction: crater.direction.clone(),
    radius: crater.radius,
    depth: crater.depth,
  }));
  return geometry;
}

function solveAsteroidEccentricAnomaly(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly)
      / Math.max(0.000001, 1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 0.00001) break;
  }
  return eccentricAnomaly;
}

function asteroidTrueAnomalyFromMean(meanAnomaly, eccentricity) {
  if (eccentricity <= 0.0001) return meanAnomaly;
  const eccentricAnomaly = solveAsteroidEccentricAnomaly(meanAnomaly, eccentricity);
  return 2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(eccentricAnomaly * 0.5),
    Math.sqrt(1 - eccentricity) * Math.cos(eccentricAnomaly * 0.5),
  );
}

/** Computes a position on a mildly eccentric and inclined orbit. */
function positionFromOrbit(target, orbit, angle) {
  const semiMajor = orbit.semiMajor;
  const eccentricity = orbit.eccentricity;
  const distance = semiMajor * (1 - eccentricity * eccentricity)
    / (1 + eccentricity * Math.cos(angle));

  const orbitalX = Math.cos(angle) * distance;
  const orbitalZ = Math.sin(angle) * distance;
  const cosNode = Math.cos(orbit.node);
  const sinNode = Math.sin(orbit.node);
  const cosInclination = Math.cos(orbit.inclination);
  const sinInclination = Math.sin(orbit.inclination);

  target.set(
    orbitalX * cosNode - orbitalZ * cosInclination * sinNode,
    orbitalZ * sinInclination,
    orbitalX * sinNode + orbitalZ * cosInclination * cosNode,
  );
  return target;
}

/** Adds card metadata used by the existing celestial inspection UI. */
function attachAsteroidMetadata(object, {
  name,
  composition,
  diameter,
  semiMajor,
  orbitalSpeed,
  rotationPeriodHours = null,
  rotationState = "Principal-axis rotation",
  description,
  family = "Background population",
  population = "Main belt",
  archetype = "Irregular body",
  visualRadius = 0.1,
  heliocentricAU = null,
  orbitalEccentricity = 0.10,
}) {
  const compositionData = COMPOSITIONS[composition];
  const physicalDiameterKm = parseDiameterKm(diameter);
  const safeRotationPeriodHours = Number(rotationPeriodHours);
  const rotationPeriodText = Number.isFinite(safeRotationPeriodHours)
    && safeRotationPeriodHours > 0
      ? formatRotationPeriod(safeRotationPeriodHours)
      : "Unknown";
  const sizeComparison = physicalDiameterKm
    ? getSizeComparisonText({ diameterKm: physicalDiameterKm, name })
    : "Scale comparison unavailable";
  const explicitAU = Number(heliocentricAU);
  const au = Number.isFinite(explicitAU) && explicitAU > 0
    ? explicitAU
    : population === "Trojan cloud"
      ? 5.2
      : radiusToAU(THREE.MathUtils.clamp(
        semiMajor,
        BELT_INNER_RADIUS,
        BELT_OUTER_RADIUS,
      ));

  object.name = name;
  object.userData = {
    name,
    detail: `${compositionData.label} | ${family}`,
    focusScale: 7.5,
    /*
     * Small asteroids need a much tighter camera than planets. This explicit
     * distance is consumed by main.js and is independent of orbital distance.
     *
     * Pulled back from 4.35 radii to 6.4, and the reason is reachability
     * rather than composition. At 4.35 radii, with a 30-degree field, a rock's
     * silhouette covers about 87% of the frame's half-height -- measured on
     * Vesta as a 363-pixel disc on an 835-pixel viewport, with only *four* of
     * the 164 belt instances on screen falling outside it. Every other rock was
     * behind the one being inspected, correctly unpickable, and the belt became
     * impossible to move around in: the reported symptom was focusing one
     * asteroid and finding no other would take a hover.
     *
     * At 6.4 radii the rock still dominates the frame -- it is what the viewer
     * asked to look at -- but there is a real margin of sky around it, and the
     * neighbours in that margin are visible and selectable. `minFocusDistance`
     * keeps the old close approach available by zooming in.
     */
    focusDistance: Math.max(0.24, visualRadius * 6.4),
    minFocusDistance: Math.max(0.20, visualRadius * 3.4),
    focusEase: 0.14,
    isAsteroid: true,
    composition,
    visualRadius,
    physicalDiameterKm,
    rotationPeriodHours: Number.isFinite(safeRotationPeriodHours)
      ? safeRotationPeriodHours
      : null,
    rotationState,
    diameterEarths: physicalDiameterKm ? physicalDiameterKm / 12_756 : null,
    volumeEarths: physicalDiameterKm ? Math.pow(physicalDiameterKm / 12_756, 3) : null,
    sizeComparison,
    orbitRadius: semiMajor,
    // Physical heliocentric scale used by the Earth-distance readout. The belt
    // renderer itself keeps its compressed artistic scene radius.
    heliocentricAU: au,
    orbitalEccentricity: THREE.MathUtils.clamp(Number(orbitalEccentricity) || 0, 0, 0.99),
    distanceBasis: population === "Trojan cloud"
      ? "simulated-trojan-orbit"
      : "simulated-small-body-orbit",
    info: {
      type: population === "Trojan cloud" ? "Jupiter Trojan asteroid" : "Asteroid",
      diameter,
      orbitalSpeed,
      rotationPeriod: rotationPeriodText,
      distanceFromEarth: population === "Trojan cloud"
        ? "Near Jupiter's orbit; distance from Earth continuously varies"
        : `≈ ${au.toFixed(2)} AU from the Sun; distance from Earth continuously varies`,
      sizeComparison,
      description: `${description} Composition: ${compositionData.density}. Shape: ${archetype}. Orbital group: ${family}. Rotation: ${rotationPeriodText}, ${rotationState.toLowerCase()}.`,
    },
  };
}

/**
 * Converts a raycast hit on an InstancedMesh into a stable Object3D target.
 *
 * Instanced rocks are not separate JavaScript objects—the GPU draws thousands
 * of them from one mesh. The inspection UI, however, needs a real object with a
 * position and metadata. We therefore create a lightweight target only when a
 * particular instance is first hovered. It is cached afterward, so hovering
 * and clicking the same rock always resolves to the same selectable object.
 */
export function resolveAsteroidInstanceHit(hit) {
  const mesh = hit?.object;
  const instanceId = hit?.instanceId;
  if (!mesh?.userData?.isInteractiveAsteroidField || !Number.isInteger(instanceId)) {
    return null;
  }

  const cachedTarget = mesh.userData.inspectionTargets.get(instanceId);
  if (cachedTarget) {
    const baseVisualRadius = Number(cachedTarget.userData.baseVisualRadius ?? 0);
    const visibilityScale = Number(mesh.userData.visualScaleFactor ?? 1);
    if (baseVisualRadius > 0) cachedTarget.userData.visualRadius = baseVisualRadius * visibilityScale;
    return cachedTarget;
  }

  const record = mesh.userData.instanceRecords[instanceId];
  if (!record) return null;

  // The instance matrix is local to the InstancedMesh. Making the inspection
  // target its child means it automatically follows the belt band's rotation.
  mesh.getMatrixAt(instanceId, _instanceMatrix);
  _instanceMatrix.decompose(_position, _instanceQuaternion, _instanceScale);

  const target = new THREE.Object3D();
  target.position.copy(_position);
  target.quaternion.copy(_instanceQuaternion);
  target.name = record.name;

  attachAsteroidMetadata(target, record);
  target.userData.instanceId = instanceId;
  target.userData.isInstancedAsteroid = true;
  target.userData.sourceMesh = mesh;
  target.userData.instanceRecord = record;
  target.userData.instanceScale = _instanceScale.clone();
  target.userData.originalInstanceMatrix = _instanceMatrix.clone();
  target.userData.baseVisualRadius = Number(record.visualRadius ?? target.userData.visualRadius ?? 0);
  target.userData.visualRadius = target.userData.baseVisualRadius
    * Number(mesh.userData.visualScaleFactor ?? 1);

  mesh.add(target);
  mesh.userData.inspectionTargets.set(instanceId, target);
  return target;
}

/**
 * Finds the nearest visible instanced asteroid in screen space when the exact
 * mesh ray misses a tiny rock. The same visibility-aware helper is used by
 * hover and click acquisition, with a larger assist only inside the dense belt.
 */
export function findNearestAsteroidInstanceAtPointer({
  meshes,
  pointer,
  camera,
  viewportWidth,
  viewportHeight,
  minimumVisibleRadiusPixels = 2,
  maximumPixelRadius = 11,
  extraHitPixels = 2.5,
  radiusMultiplier = 1.35,
  visibleRadiusPreference = 0.12,
  /**
   * Ignore instances further from the lens than this.
   *
   * Used when a body is focused and the pointer is over its disk: rocks behind
   * it are genuinely hidden and must not be acquired through it, while rocks in
   * front of it are in plain sight and must be.
   */
  maximumCameraDistance = Infinity,
}) {
  if (!Array.isArray(meshes) || !camera || !pointer) return null;

  let nearestHit = null;
  let nearestScore = Infinity;
  const projected = _hoverProjectedPosition;
  const cameraPosition = _hoverCameraPosition;
  camera.getWorldPosition(cameraPosition);
  const focalPixels = viewportHeight * 0.5
    / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));

  camera.updateMatrixWorld();
  meshes.forEach((mesh) => {
    if (!mesh?.visible || !mesh.userData?.isInteractiveAsteroidField) return;
    mesh.updateWorldMatrix(true, false);
    const records = mesh.userData.instanceRecords ?? [];
    const activeInstanceCount = Math.min(
      records.length,
      mesh.userData.activeInstanceCount ?? mesh.count ?? records.length,
    );

    for (let instanceId = 0; instanceId < activeInstanceCount; instanceId += 1) {
      const record = records[instanceId];
      if (!record) continue;
      mesh.getMatrixAt(instanceId, _instanceMatrix);
      _position.setFromMatrixPosition(_instanceMatrix).applyMatrix4(mesh.matrixWorld);
      projected.copy(_position).project(camera);
      if (projected.z < -1 || projected.z > 1) continue;
      // Discard clearly off-screen instances before doing the more expensive
      // projected-size and distance calculations.
      if (projected.x < -1.08 || projected.x > 1.08
        || projected.y < -1.08 || projected.y > 1.08) continue;

      const cameraDistance = Math.max(0.0001, cameraPosition.distanceTo(_position));
      if (cameraDistance > maximumCameraDistance) continue;
      const visibilityScale = Number(mesh.userData.visualScaleFactor ?? 1);
      const projectedRadiusPixels = Number(record.visualRadius ?? 0)
        * visibilityScale / cameraDistance * focalPixels;
      // Do not let a rock the user cannot actually see capture an empty-space click.
      if (!Number.isFinite(projectedRadiusPixels) || projectedRadiusPixels < minimumVisibleRadiusPixels) continue;

      const dx = (projected.x - pointer.x) * viewportWidth * 0.5;
      const dy = (projected.y - pointer.y) * viewportHeight * 0.5;
      const clickRadius = THREE.MathUtils.clamp(
        projectedRadiusPixels * radiusMultiplier + extraHitPixels,
        minimumVisibleRadiusPixels + extraHitPixels,
        maximumPixelRadius,
      );
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > clickRadius * clickRadius) continue;

      // Normalising by the assisted radius makes a small readable asteroid under
      // the pointer beat a farther neighbour. A slight visible-size preference
      // prevents a nearly invisible dot from stealing the target from a clearer
      // rock occupying almost the same screen position.
      const normalizedDistance = Math.sqrt(distanceSquared) / Math.max(1, clickRadius);
      const visibilityBonus = Math.min(
        visibleRadiusPreference,
        projectedRadiusPixels / Math.max(1, maximumPixelRadius) * visibleRadiusPreference,
      );
      const score = normalizedDistance - visibilityBonus;
      if (score >= nearestScore) continue;

      nearestScore = score;
      nearestHit = { object: mesh, instanceId };
    }
  });

  return nearestHit ? resolveAsteroidInstanceHit(nearestHit) : null;
}

function getAsteroidCompositionKey(target) {
  const direct = String(target?.userData?.composition ?? "").toUpperCase();
  if (FOCUSED_COMPOSITION_APPEARANCE[direct]) return direct;

  const instanceComposition = String(
    target?.userData?.instanceRecord?.composition ?? "",
  ).toUpperCase();
  if (FOCUSED_COMPOSITION_APPEARANCE[instanceComposition]) {
    return instanceComposition;
  }

  const detail = String(target?.userData?.detail ?? "").toUpperCase();
  if (detail.includes("C-TYPE")) return "C";
  if (detail.includes("S-TYPE")) return "S";
  if (detail.includes("M-TYPE")) return "M";
  return null;
}

function applyFocusedAsteroidMaterialAppearance(material, compositionKey) {
  if (!material?.isMeshStandardMaterial) return material;
  const appearance = FOCUSED_COMPOSITION_APPEARANCE[compositionKey];
  if (!appearance) return material;

  material.color.lerp(appearance.neutralAlbedo, appearance.albedoMix);
  material.emissive.copy(appearance.emissive);
  material.emissiveIntensity = appearance.emissiveIntensity;
  material.roughness = Math.max(material.roughness, appearance.roughnessFloor);
  material.metalness = Math.min(material.metalness, appearance.metalnessCeiling);
  material.envMapIntensity = appearance.environmentIntensity;
  material.dithering = true;
  material.needsUpdate = true;
  material.userData.asteroidFocusCalibrated = true;
  return material;
}

/**
 * Applies a temporary composition-neutral inspection material to any asteroid.
 * Resolved asteroid materials are shared by many bodies, so focused meshes use
 * private clones and restore their original materials when inspection closes.
 */
export function setAsteroidFocusAppearance(target, active) {
  if (!isAsteroidInteractionBody(target)) return;
  const compositionKey = getAsteroidCompositionKey(target);
  if (!compositionKey) return;

  target.traverse?.((object) => {
    if (!object?.isMesh || object.material?.isMeshBasicMaterial) return;

    if (active) {
      // Layer isolation is independent of the material clone. This makes the
      // neutral focus fill affect only the selected asteroid, not thousands of
      // surrounding rocks whose changing facets previously appeared to flicker.
      if (!Number.isInteger(object.userData.asteroidOriginalFocusLayerMask)) {
        object.userData.asteroidOriginalFocusLayerMask = object.layers.mask;
      }
      object.layers.enable(ASTEROID_INSPECTION_LAYER);

      if (object.userData.asteroidOriginalFocusMaterial) return;
      const originalMaterial = object.material;
      const focusedMaterial = Array.isArray(originalMaterial)
        ? originalMaterial.map((material) => applyFocusedAsteroidMaterialAppearance(
          material.clone(),
          compositionKey,
        ))
        : applyFocusedAsteroidMaterialAppearance(
          originalMaterial.clone(),
          compositionKey,
        );
      object.userData.asteroidOriginalFocusMaterial = originalMaterial;
      object.material = focusedMaterial;
      return;
    }

    const originalLayerMask = object.userData.asteroidOriginalFocusLayerMask;
    if (Number.isInteger(originalLayerMask)) {
      object.layers.mask = originalLayerMask;
      delete object.userData.asteroidOriginalFocusLayerMask;
    }

    const originalMaterial = object.userData.asteroidOriginalFocusMaterial;
    if (!originalMaterial) return;
    const focusedMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    object.material = originalMaterial;
    delete object.userData.asteroidOriginalFocusMaterial;
    focusedMaterials.forEach((material) => material?.dispose?.());
  });
}

/**
 * Swaps one selected GPU instance for a high-resolution inspection model.
 * Distant belt rocks stay inexpensive, but the clicked body gains thousands of
 * sculptable vertices, physical crater bowls, fractures, and surface boulders.
 */
export function setAsteroidInspectionDetail(target, active) {
  if (!target?.userData?.isInstancedAsteroid) return;

  const mesh = target.userData.sourceMesh;
  const instanceId = target.userData.instanceId;
  const record = target.userData.instanceRecord;
  if (!mesh || !record || !Number.isInteger(instanceId)) return;

  if (active && !target.userData.focusDetail) {
    const archetype = record.composition === "C"
      ? "rubble"
      : record.composition === "M"
        ? "fractured"
        : record.variant === 0
          ? "elongated"
          : "irregular";
    const geometry = createAsteroidGeometry({
      seed: record.geometrySeed + 7001,
      composition: record.composition,
      archetype,
      detail: 5,
      roundness: 0.025,
      majorBasin: false,
    });
    const material = createStoneMaterial(record.composition);
    let instanceTint = null;
    if (Array.isArray(record.instanceTint)) {
      instanceTint = _focusedInstanceTintColor.fromArray(record.instanceTint);
    } else if (mesh.instanceColor) {
      // Backward-safe fallback for a cached/older record without stored tint.
      mesh.getColorAt(instanceId, _focusedInstanceTintColor);
      instanceTint = _focusedInstanceTintColor;
    }
    if (instanceTint) {
      // InstancedMesh colour is multiplied with the low-detail geometry in the
      // belt. Apply the same tint to the replacement material so a selected
      // silver-grey, charcoal, or reddish rock keeps its identity in focus.
      material.color.copy(instanceTint);
    }
    const detailGroup = new THREE.Group();
    const core = new THREE.Mesh(geometry, material);
    core.name = `${record.name} high-detail surface`;
    detailGroup.add(core);
    addSurfaceBoulders({
      group: detailGroup,
      material,
      seed: record.geometrySeed + 9103,
      count: record.composition === "C" ? 18 : 12,
      composition: record.composition,
      baseTint: instanceTint,
    });
    detailGroup.scale.copy(target.userData.instanceScale).multiplyScalar(
      Number(mesh.userData.visualScaleFactor ?? 1),
    );
    composeAsteroidSpinQuaternion(
      detailGroup.quaternion,
      record.spinProfile,
      Number(mesh.material?.userData?.asteroidSpinTimeUniform?.value ?? 0),
    );
    detailGroup.visible = false;
    target.add(detailGroup);
    target.userData.focusDetail = detailGroup;
  }

  const detailGroup = target.userData.focusDetail;
  if (detailGroup) {
    if (active) {
      composeAsteroidSpinQuaternion(
        detailGroup.quaternion,
        record.spinProfile,
        Number(mesh.material?.userData?.asteroidSpinTimeUniform?.value ?? 0),
      );
    }
    detailGroup.visible = active;
  }

  // Collapse only the selected low-detail instance so it cannot intersect the
  // high-detail replacement. Its exact matrix is restored on focus exit.
  if (active) {
    target.userData.originalInstanceMatrix.decompose(
      _position,
      _instanceQuaternion,
      _instanceScale,
    );
    _instanceScale.multiplyScalar(0.00001);
    _instanceMatrix.compose(_position, _instanceQuaternion, _instanceScale);
    mesh.setMatrixAt(instanceId, _instanceMatrix);
  } else {
    mesh.setMatrixAt(instanceId, target.userData.originalInstanceMatrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}


function getSurfaceFragmentGeometry(composition, variant) {
  const cacheKey = `${composition}-${variant}`;
  const cached = SURFACE_FRAGMENT_GEOMETRY_CACHE.get(cacheKey);
  if (cached) return cached;

  const seed = composition.charCodeAt(0) * 97 + variant * 131;
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const position = geometry.attributes.position;

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    _position.fromBufferAttribute(position, vertexIndex);
    _direction.copy(_position).normalize();
    const coarse = fractalNoise(_direction, seed + 71);
    const fine = smoothNoise3(
      _direction.x * 5.2,
      _direction.y * 5.2,
      _direction.z * 5.2,
      seed + 109,
    );
    let radialScale = 0.76 + coarse * 0.22 + (fine - 0.5) * 0.12;

    if (_position.y < -0.18) {
      const baseCompression = THREE.MathUtils.clamp((-0.18 - _position.y) / 0.77, 0, 1);
      radialScale *= 1 - baseCompression * 0.18;
      _position.y *= 0.54;
    }

    _position.multiplyScalar(radialScale);
    _position.x *= 0.84 + seededRandom(seed + 7) * 0.32;
    _position.y *= 0.80 + seededRandom(seed + 11) * 0.24;
    _position.z *= 0.82 + seededRandom(seed + 13) * 0.30;
    position.setXYZ(vertexIndex, _position.x, _position.y, _position.z);
  }

  geometry.computeVertexNormals();
  SURFACE_FRAGMENT_GEOMETRY_CACHE.set(cacheKey, geometry);
  return geometry;
}

function addSurfaceBoulders({
  group,
  material,
  seed,
  count,
  composition,
  baseTint = null,
}) {
  const boulderMaterial = material.clone();
  boulderMaterial.vertexColors = false;
  boulderMaterial.color.copy(COMPOSITION_PALETTES[composition][0]);
  if (baseTint?.isColor) boulderMaterial.color.multiply(baseTint);
  boulderMaterial.needsUpdate = true;

  for (let index = 0; index < count; index += 1) {
    const direction = randomUnitVector(seed * 13 + index * 37);
    const geometry = getSurfaceFragmentGeometry(composition, index % 4);
    const boulder = new THREE.Mesh(geometry, boulderMaterial.clone());
    const size = 0.028 + seededRandom(seed * 19 + index * 31) * 0.058;
    boulder.position.copy(direction).multiplyScalar(0.84 + size * 0.34);
    boulder.scale.set(
      size * (0.74 + seededRandom(seed + index * 7) * 0.62),
      size * (0.52 + seededRandom(seed + index * 11) * 0.52),
      size * (0.72 + seededRandom(seed + index * 17) * 0.64),
    );
    boulder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    boulder.rotateOnAxis(new THREE.Vector3(0, 1, 0), seededRandom(seed + index * 23) * Math.PI * 2);
    boulder.rotateOnAxis(new THREE.Vector3(1, 0, 0), (seededRandom(seed + index * 29) - 0.5) * 0.55);
    boulder.castShadow = false;
    boulder.receiveShadow = false;
    boulder.userData.isSurfaceDetail = true;

    const tint = makeAsteroidInstanceTint(composition, seed * 31 + index * 41);
    boulder.material.color.multiply(tint);
    if (composition === "M") {
      boulder.material.metalness = Math.min(0.48, boulderMaterial.metalness + 0.06);
      boulder.material.roughness = Math.max(0.44, boulderMaterial.roughness - 0.06);
    }

    group.add(boulder);
  }
}

/** Creates one clickable resolved body and stores its orbital state. */
function createAsteroidObject({
  index,
  composition,
  size,
  orbit,
  materials,
  geometryPool,
  name,
  diameter,
  description,
  family,
  population = "Main belt",
  archetype,
  surfaceBoulders = 0,
  heliocentricAU = null,
  rotationPeriodHours = null,
  rotationState = null,
}) {
  const compositionData = COMPOSITIONS[composition];
  const chosenArchetype = archetype
    ?? compositionData.archetypes[index % compositionData.archetypes.length];
  const materialSet = materials[composition];
  const material = materialSet[index % materialSet.length];
  const geometrySet = geometryPool[composition][chosenArchetype]
    ?? geometryPool[composition].irregular;
  const geometry = geometrySet[index % geometrySet.length];

  const group = new THREE.Group();
  const core = new THREE.Mesh(geometry, material);
  core.name = `${name} surface`;
  group.add(core);

  // Level-of-detail pair. The swap is driven by projected pixel size in
  // updateAsteroidBelt(); both geometries stay resident because the stand-in is
  // only ~768 triangles and re-generating one mid-flight would stutter.
  const lowSet = geometryPool.__lowDetail?.[composition]?.[chosenArchetype]
    ?? geometryPool.__lowDetail?.[composition]?.irregular;
  core.userData.lodHigh = geometry;
  core.userData.lodLow = lowSet ? lowSet[index % lowSet.length] : null;

  // A transparent local-space proxy makes small resolved rocks easier to tap
  // without changing their rendered size. Metadata is still resolved from the
  // parent asteroid group.
  const interactionTarget = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 14, 10),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
    }),
  );
  interactionTarget.name = `${name} interaction target`;
  markPointerProxy(interactionTarget);
  group.add(interactionTarget);

  const physicalDiameterKm = parseDiameterKm(diameter);
  const ratioAwareSize = physicalDiameterKm
    ? getAsteroidVisualRadius(physicalDiameterKm, { minimum: 0.034, maximum: 0.92 })
    : size;
  group.scale.setScalar(ratioAwareSize);
  group.scale.multiply(new THREE.Vector3(
    0.88 + seededRandom(index * 3 + 1) * 0.26,
    0.86 + seededRandom(index * 3 + 2) * 0.24,
    0.88 + seededRandom(index * 3 + 3) * 0.27,
  ));

  group.rotation.set(
    seededRandom(index + 61) * Math.PI,
    seededRandom(index + 62) * Math.PI,
    seededRandom(index + 63) * Math.PI,
  );

  // Craters are cut directly into `createAsteroidGeometry`. Avoid adding flat
  // CircleGeometry/TorusGeometry decals here: those overlays were the main
  // reason nearby asteroids looked painted instead of physically excavated.

  if (surfaceBoulders > 0) {
    addSurfaceBoulders({
      group,
      material,
      seed: index + 500,
      count: surfaceBoulders,
      composition,
    });
  }

  positionFromOrbit(group.position, orbit, orbit.angle);

  const spinProfile = createAsteroidSpinProfile({
    seed: index,
    diameterKm: physicalDiameterKm,
    archetype: chosenArchetype,
    rotationPeriodHours,
    rotationState,
  });

  attachAsteroidMetadata(group, {
    name,
    composition,
    diameter,
    semiMajor: orbit.semiMajor,
    orbitalSpeed: `${(14 + seededRandom(index + 90) * 7).toFixed(1)} km/s`,
    rotationPeriodHours: spinProfile.physicalPeriodHours,
    rotationState: spinProfile.stateLabel,
    description,
    family,
    population,
    archetype: chosenArchetype,
    visualRadius: Math.max(group.scale.x, group.scale.y, group.scale.z),
    heliocentricAU,
    orbitalEccentricity: orbit.eccentricity,
  });

  group.userData.orbit = orbit;
  group.userData.spinProfile = spinProfile;
  group.userData.baseQuaternion = group.quaternion.clone();
  group.userData.core = core;
  group.userData.archetype = chosenArchetype;
  return group;
}

/**
 * Creates one shared low-poly rock shape for thousands of GPU instances.
 * The vertices are pushed into an uneven silhouette and several crater bowls
 * are physically carved into it. Because every vertex really moves in 3D,
 * light produces proper ridges and shadows instead of a flat crater picture.
 */
function createInstancedRockGeometry(seed, composition, variant) {
  // Detail level 2 supplies enough vertices for real pits and broken ridges,
  // while remaining light enough to reuse across thousands of instances.
  const geometry = new THREE.IcosahedronGeometry(1, 2);
  const positions = geometry.attributes.position;
  const surfaceColors = new Float32Array(positions.count * 3);
  const stretch = composition === "M"
    ? new THREE.Vector3(1.18, 0.82, 0.94)
    : composition === "C"
      ? new THREE.Vector3(1.08, 0.91, 1.02)
      : new THREE.Vector3(1.28, 0.76, 0.91);

  // Two geometry variants per composition avoid an obviously repeated rock
  // silhouette while still requiring only six draw calls for the whole field.
  if (variant === 1) {
    stretch.set(stretch.z * 0.96, stretch.x * 0.91, stretch.y * 1.08);
  }

  const craters = Array.from({ length: 9 }, (_, index) => ({
    direction: randomUnitVector(seed + index * 37),
    radius: 0.08 + seededRandom(seed + index * 53) * 0.20,
    depth: 0.025 + seededRandom(seed + index * 71) * 0.075,
  }));

  for (let index = 0; index < positions.count; index += 1) {
    _position.fromBufferAttribute(positions, index);
    _direction.copy(_position).normalize();

    const broadNoise = fractalNoise(_direction, seed) - 0.5;
    const sharpNoise = smoothNoise3(
      _direction.x * 13,
      _direction.y * 13,
      _direction.z * 13,
      seed + 91,
    ) - 0.5;
    let radialScale = 1 + broadNoise * 0.25 + sharpNoise * 0.075;
    let craterShade = 0;

    craters.forEach((crater) => {
      const angularDistance = Math.acos(
        THREE.MathUtils.clamp(_direction.dot(crater.direction), -1, 1),
      );
      const bowl = 1 - THREE.MathUtils.smoothstep(
        angularDistance,
        crater.radius * 0.08,
        crater.radius,
      );
      radialScale -= bowl * crater.depth;
      craterShade = Math.max(craterShade, bowl);
    });

    _position.multiplyScalar(radialScale).multiply(stretch);
    positions.setXYZ(index, _position.x, _position.y, _position.z);
    writeSurfaceColor(_surfaceColor, composition, _direction, seed, craterShade, 0);
    surfaceColors[index * 3] = _surfaceColor.r;
    surfaceColors[index * 3 + 1] = _surfaceColor.g;
    surfaceColors[index * 3 + 2] = _surfaceColor.b;
  }

  positions.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(surfaceColors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Places thousands of real 3D boulders into the belt with InstancedMesh.
 * An instance has its own position, rotation, scale, and colour, but shares the
 * same geometry/material on the GPU. This is what makes a dense volumetric belt
 * possible without creating fifteen thousand JavaScript Mesh objects.
 */
function createInstancedBoulderField(materials, density = 1) {
  const field = new THREE.Group();
  const meshes = [];
  field.name = "3D asteroid boulder field";

  Object.entries(INSTANCED_BOULDER_COUNTS).forEach(([composition, totalCount], compositionIndex) => {
    for (let variant = 0; variant < 2; variant += 1) {
      const scaledTotal = Math.max(1, Math.round(totalCount * density));
      const count = variant === 0 ? Math.ceil(scaledTotal / 2) : Math.floor(scaledTotal / 2);
      const geometry = createInstancedRockGeometry(
        8100 + compositionIndex * 307 + variant * 97,
        composition,
        variant,
      );
      const material = materials[composition][variant].clone();
      installInstancedAsteroidVisualMotion(material);
      // Geometry and vertex colour now carry the detail; no UV colour/bump map
      // is allowed to paint ripples or repeated circular marks onto the stone.
      material.envMapIntensity = composition === "M" ? 0.12 : 0.025;
      material.dithering = true;
      material.needsUpdate = true;
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      const dummy = new THREE.Object3D();
      const instanceRecords = new Array(count);
      const spinAxes = new Float32Array(count * 3);
      const tumbleAxes = new Float32Array(count * 3);
      const spinRates = new Float32Array(count);
      const tumbleRates = new Float32Array(count);
      const spinPhases = new Float32Array(count);

      let accepted = 0;
      let attempt = 0;
      while (accepted < count && attempt < count * 30) {
        const seed = 12000 + compositionIndex * 50000 + variant * 17000 + attempt * 13;
        attempt += 1;

        let radius = BELT_INNER_RADIUS
          + seededRandom(seed + 1) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
        let angle = seededRandom(seed + 2) * Math.PI * 2;
        let family = "Background main-belt population";

        // About one in ten rocks belongs to a visible collision-family stream.
        // These overlapping streams make the belt a region with structure, not
        // a perfectly uniform decorative ring.
        if (accepted % 10 === 0 && composition !== "M") {
          const useOuterFamily = seededRandom(seed + 3) > 0.48;
          if (composition === "C") {
            radius = 50.2 * SOLAR_ORBIT_SCALE + (seededRandom(seed + 4) - 0.5) * 0.8 * SOLAR_ORBIT_SCALE;
            angle = 3.7 + (seededRandom(seed + 5) - 0.5) * 1.05;
            family = "Eos collision-family stream";
          } else if (useOuterFamily) {
            radius = 49.5 * SOLAR_ORBIT_SCALE + (seededRandom(seed + 4) - 0.5) * 0.7 * SOLAR_ORBIT_SCALE;
            angle = 5.15 + (seededRandom(seed + 5) - 0.5) * 0.95;
            family = "Koronis collision-family stream";
          } else {
            radius = 44.9 * SOLAR_ORBIT_SCALE + (seededRandom(seed + 4) - 0.5) * 0.7 * SOLAR_ORBIT_SCALE;
            angle = 1.1 + (seededRandom(seed + 5) - 0.5) * 0.95;
            family = "Flora collision-family stream";
          }
        }

        if (isInsideKirkwoodGap(radius)) continue;
        if (compositionForRadius(radius, seed + 6) !== composition) continue;

        const orbit = {
          semiMajor: radius,
          eccentricity: seededRandom(seed + 7) * 0.13,
          inclination: (seededRandom(seed + 8) - 0.5) * 0.22,
          node: seededRandom(seed + 9) * Math.PI * 2,
        };
        positionFromOrbit(dummy.position, orbit, angle);
        dummy.rotation.set(
          seededRandom(seed + 10) * Math.PI,
          seededRandom(seed + 11) * Math.PI,
          seededRandom(seed + 12) * Math.PI,
        );

        // The steep power curve makes almost every object a pebble/small rock,
        // while leaving a rare tail of large, clearly readable boulders.
        const sizeBias = Math.pow(seededRandom(seed + 13), 5.2);
        const estimatedDiameter = Math.max(1, Math.round(1 + sizeBias * 95));
        const size = getAsteroidVisualRadius(estimatedDiameter, { minimum: 0.028, maximum: 0.24 });
        dummy.scale.set(
          size * (0.68 + seededRandom(seed + 14) * 0.72),
          size * (0.62 + seededRandom(seed + 15) * 0.70),
          size * (0.70 + seededRandom(seed + 16) * 0.68),
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(accepted, dummy.matrix);

        // Instance colour is a neutral exposure variation. Composition colour
        // already comes from the geometry's non-repeating 3D vertex colours.
        const color = makeAsteroidInstanceTint(composition, seed + 18);
        mesh.setColorAt(accepted, color);

        const visualRadius = Math.max(dummy.scale.x, dummy.scale.y, dummy.scale.z);
        const archetype = composition === "C"
          ? "Rubble-pile body"
          : composition === "M"
            ? "Fractured metal-rich body"
            : variant === 0
              ? "Elongated stony body"
              : "Angular silicate body";
        const spinProfile = createAsteroidSpinProfile({
          seed,
          diameterKm: estimatedDiameter,
          archetype,
        });
        const spinAttributeIndex = accepted * 3;
        spinAxes.set(spinProfile.axis, spinAttributeIndex);
        tumbleAxes.set(spinProfile.tumbleAxis, spinAttributeIndex);
        spinRates[accepted] = spinProfile.radiansPerSecond;
        tumbleRates[accepted] = spinProfile.tumbleRadiansPerSecond;
        spinPhases[accepted] = spinProfile.phase;
        instanceRecords[accepted] = {
          name: `${composition}-class asteroid ${String(compositionIndex + 1)}-${String(variant + 1)}-${String(accepted + 1).padStart(4, "0")}`,
          composition,
          diameter: `≈ ${estimatedDiameter} km`,
          semiMajor: radius,
          orbitalEccentricity: orbit.eccentricity,
          orbitalSpeed: `${(14.2 + seededRandom(seed + 19) * 6.8).toFixed(1)} km/s`,
          description: COMPOSITIONS[composition].description,
          family,
          population: "Main belt",
          archetype,
          visualRadius,
          geometrySeed: seed,
          variant,
          rotationPeriodHours: spinProfile.physicalPeriodHours,
          rotationState: spinProfile.stateLabel,
          spinProfile,
          // Preserve the exact per-instance tint when this GPU instance is
          // replaced by its high-detail inspection model.
          instanceTint: color.toArray(),
        };
        accepted += 1;
      }

      geometry.setAttribute(
        "aSpinAxis",
        new THREE.InstancedBufferAttribute(spinAxes, 3),
      );
      geometry.setAttribute(
        "aTumbleAxis",
        new THREE.InstancedBufferAttribute(tumbleAxes, 3),
      );
      geometry.setAttribute(
        "aSpinRate",
        new THREE.InstancedBufferAttribute(spinRates, 1),
      );
      geometry.setAttribute(
        "aTumbleRate",
        new THREE.InstancedBufferAttribute(tumbleRates, 1),
      );
      geometry.setAttribute(
        "aSpinPhase",
        new THREE.InstancedBufferAttribute(spinPhases, 1),
      );

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.name = `${composition}-class instanced boulders ${variant + 1}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.userData.rotationSpeed = 0.000055 + compositionIndex * 0.000012 + variant * 0.000009;
      mesh.userData.capacity = count;
      mesh.userData.activeInstanceCount = count;
      mesh.userData.visualScaleFactor = 1;
      mesh.userData.isInteractiveAsteroidField = true;
      mesh.userData.instanceRecords = instanceRecords;
      mesh.userData.inspectionTargets = new Map();
      field.add(mesh);
      meshes.push(mesh);
    }
  });

  return { field, meshes };
}

/**
 * Generates the unresolved population: tiny bodies that are physically below
 * a pixel at this scale. It is intentionally a point layer, while every object
 * large enough to inspect is represented by actual 3D geometry above.
 */
function createDistantDebris(count = UNRESOLVED_PEBBLE_COUNT) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colorPalette = {
    C: [
      new THREE.Color(0x59625c),
      new THREE.Color(0x343a37),
      new THREE.Color(0x6a6258),
    ],
    S: [
      new THREE.Color(0x9a735b),
      new THREE.Color(0x78675a),
      new THREE.Color(0x806b4f),
    ],
    M: [
      new THREE.Color(0x899191),
      new THREE.Color(0x716e69),
      new THREE.Color(0x8b705f),
    ],
  };

  let accepted = 0;
  let attempt = 0;
  while (accepted < count) {
    const seed = 500000 + attempt * 19;
    attempt += 1;
    const radius = BELT_INNER_RADIUS
      + seededRandom(seed + 1) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
    if (isInsideKirkwoodGap(radius)) continue;

    const angle = seededRandom(seed + 2) * Math.PI * 2;
    const orbit = {
      semiMajor: radius,
      eccentricity: seededRandom(seed + 3) * 0.12,
      // Adding several random values creates a centre-heavy distribution, so
      // the belt has a thin core plus a sparse halo above and below its plane.
      inclination: (
        seededRandom(seed + 4)
        + seededRandom(seed + 5)
        + seededRandom(seed + 6)
        - 1.5
      ) * 0.12,
      node: seededRandom(seed + 7) * Math.PI * 2,
    };
    positionFromOrbit(_position, orbit, angle);
    const positionIndex = accepted * 3;
    positions[positionIndex] = _position.x;
    positions[positionIndex + 1] = _position.y;
    positions[positionIndex + 2] = _position.z;

    const composition = compositionForRadius(radius, seed + 8);
    const palette = colorPalette[composition] ?? colorPalette.S;
    const color = palette[Math.floor(seededRandom(seed + 8) * palette.length)];
    const brightness = composition === "C"
      ? 0.68 + seededRandom(seed + 9) * 0.28
      : composition === "M"
        ? 0.78 + seededRandom(seed + 9) * 0.26
        : 0.74 + seededRandom(seed + 9) * 0.28;
    colors[positionIndex] = color.r * brightness;
    colors[positionIndex + 1] = color.g * brightness;
    colors[positionIndex + 2] = color.b * brightness;
    sizes[accepted] = 0.34 + Math.pow(seededRandom(seed + 10), 3.4) * 0.92;
    accepted += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      // Pebbles establish belt density but should not veil the solid rocks.
      uOpacity: { value: 0.84 },
      uEncounterStrength: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
      uSunAngularRadius: { value: 0 },
    },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      varying float vSolarClearance;
      uniform float uPixelRatio;
      uniform float uEncounterStrength;
      uniform vec3 uSunDirection;
      uniform float uSunAngularRadius;

      void main() {
        vColor = color;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * worldPosition;
        vec3 grainDirection = normalize(worldPosition.xyz - cameraPosition);
        float sunAlignment = clamp(dot(grainDirection, normalize(uSunDirection)), -1.0, 1.0);
        float angularSeparation = acos(sunAlignment);
        float diskFeather = clamp(uSunAngularRadius * 0.035, 0.00008, 0.0012);
        vSolarClearance = smoothstep(
          max(0.0, uSunAngularRadius - diskFeather),
          uSunAngularRadius + diskFeather,
          angularSeparation
        );
        gl_Position = projectionMatrix * viewPosition;
        float encounterScale = mix(1.0, 1.62, uEncounterStrength);
        float maximumPointSize = mix(4.75, 7.25, uEncounterStrength);
        gl_PointSize = clamp(
          aSize * uPixelRatio * encounterScale * (255.0 / max(1.0, -viewPosition.z)),
          1.10,
          maximumPointSize
        );
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSolarClearance;
      uniform float uOpacity;
      uniform float uEncounterStrength;

      void main() {
        float distanceFromCentre = length(gl_PointCoord - vec2(0.5));
        float edge = 1.0 - smoothstep(0.40, 0.5, distanceFromCentre);
        if (edge < 0.02) discard;
        vec3 visibleColor = vColor * mix(1.0, 1.52, uEncounterStrength);
        float visibleOpacity = mix(uOpacity, min(1.0, uOpacity + 0.12), uEncounterStrength);
        gl_FragColor = vec4(visibleColor, edge * visibleOpacity * vSolarClearance);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "Virtual million-object pebble population";
  points.userData.capacity = count;
  points.frustumCulled = false;
  points.renderOrder = -6;
  return points;
}

/** Creates family members concentrated around one parent collision orbit. */
function createFamily({
  name,
  composition,
  centreRadius,
  centreAngle,
  inclination,
  count,
  seedOffset,
  container,
  rocks,
  materials,
  geometryPool,
}) {
  for (let member = 0; member < count; member += 1) {
    const index = seedOffset + member;
    const radius = centreRadius + (seededRandom(index + 4) - 0.5) * 0.55;
    const orbit = {
      semiMajor: radius,
      eccentricity: 0.025 + seededRandom(index + 5) * 0.055,
      inclination: inclination + (seededRandom(index + 6) - 0.5) * 0.045,
      node: seededRandom(index + 7) * Math.PI * 2,
      angle: centreAngle + (seededRandom(index + 8) - 0.5) * 0.62,
      speed: 0.00025 + seededRandom(index + 9) * 0.00022,
    };
    const size = 0.055 + Math.pow(seededRandom(index + 10), 2.8) * 0.18;
    const rock = createAsteroidObject({
      index,
      composition,
      size,
      orbit,
      materials,
      geometryPool,
      name: `${name} family member ${String(member + 1).padStart(2, "0")}`,
      diameter: `${Math.round(4 + size * 105)} km`,
      description: `A fragment produced by the ancient collision that formed the ${name} family.`,
      family: `${name} family`,
      surfaceBoulders: size > 0.14 ? 3 : 0,
    });
    container.add(rock);
    rocks.push(rock);
  }
}

/** Creates the leading or trailing Jupiter Trojan cloud. */
function createTrojanCloud({
  label,
  offset,
  seedOffset,
  count,
  container,
  rocks,
  materials,
  geometryPool,
}) {
  for (let member = 0; member < count; member += 1) {
    const index = seedOffset + member;
    const orbit = {
      semiMajor: JUPITER_ORBIT_RADIUS + (seededRandom(index + 2) - 0.5) * 4.2,
      eccentricity: 0.01 + seededRandom(index + 3) * 0.08,
      inclination: (seededRandom(index + 4) - 0.5) * 0.22,
      node: seededRandom(index + 5) * Math.PI * 2,
      angle: offset + (seededRandom(index + 6) - 0.5) * 0.56,
      speed: 0,
      trojanOffset: offset,
      trojanSpread: (seededRandom(index + 6) - 0.5) * 0.56,
    };
    const size = 0.045 + Math.pow(seededRandom(index + 8), 3) * 0.14;
    const rock = createAsteroidObject({
      index,
      composition: "C",
      size,
      orbit,
      materials,
      geometryPool,
      name: `${label} Trojan ${String(member + 1).padStart(2, "0")}`,
      diameter: `${Math.round(3 + size * 90)} km`,
      description: `A dark primitive body librating around Jupiter's ${label} Trojan region, roughly 60° from the planet.`,
      family: `${label} Trojan swarm`,
      population: "Trojan cloud",
      archetype: member % 3 === 0 ? "top" : "rubble",
      surfaceBoulders: size > 0.12 ? 4 : 0,
    });
    container.add(rock);
    rocks.push(rock);
  }
}



/**
 * Lazily-built pool of procedural rock geometries.
 *
 * Eagerly building every variant cost 3,649 ms -- 47% of total startup -- for
 * 3 compositions x 5 archetypes x 4 variants x 2 detail levels = 120 sculpted
 * meshes, each an 80x60 or 24x16 sphere displaced vertex by vertex.
 *
 * Most of that is never needed. Ordinary rocks only ever request the three
 * archetypes their composition actually declares; "irregular", "rounded" and
 * "basin" are added to every composition defensively and are frequently unused.
 * Each slot is therefore a memoised accessor: the first read sculpts its four
 * variants, later reads are free, and untouched combinations are never built.
 *
 * The setter matters too -- the MAJOR_BODIES pass overwrites individual slots
 * with bespoke hero geometry, and that must keep working unchanged.
 */
function buildGeometryVariants(composition, archetype, detail) {
  return Array.from({ length: 4 }, (_, index) => createAsteroidGeometry({
    seed: composition.charCodeAt(0) * 100 + archetype.length * 17 + index * 29,
    composition,
    archetype,
    detail,
    roundness: archetype === "rounded" ? 0.62 : 0.08,
    majorBasin: false,
  }));
}

function defineLazyGeometrySlot(target, composition, archetype, detail, stats) {
  let cached = null;
  Object.defineProperty(target, archetype, {
    configurable: true,
    enumerable: true,
    get() {
      if (!cached) {
        cached = buildGeometryVariants(composition, archetype, detail);
        stats.built += 1;
      }
      return cached;
    },
    set(value) { cached = value; },
  });
}

function createGeometryPool() {
  const pool = {};
  const lowPool = {};
  const stats = { built: 0, slots: 0 };

  Object.entries(COMPOSITIONS).forEach(([composition, config]) => {
    pool[composition] = {};
    lowPool[composition] = {};
    const archetypes = new Set([...config.archetypes, "irregular", "rounded", "basin"]);
    archetypes.forEach((archetype) => {
      defineLazyGeometrySlot(pool[composition], composition, archetype, 4, stats);
      defineLazyGeometrySlot(lowPool[composition], composition, archetype, 2, stats);
      stats.slots += 2;
    });
  });

  Object.defineProperty(pool, "__lowDetail", { value: lowPool, enumerable: false });
  Object.defineProperty(pool, "__stats", { value: stats, enumerable: false });
  return pool;
}

function collectAsteroidVisibilityMaterials(root) {
  const materials = new Set();
  root?.traverse?.((object) => {
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    objectMaterials.forEach((material) => {
      if (!material?.isMeshStandardMaterial) return;
      if (!Number.isFinite(material.userData.baseAsteroidEmissiveIntensity)) {
        material.userData.baseAsteroidEmissiveIntensity = Number(material.emissiveIntensity ?? 0);
      }
      if (!material.userData.baseAsteroidEmissiveColor && material.emissive) {
        material.userData.baseAsteroidEmissiveColor = material.emissive.clone();
        if (!material.userData.asteroidEncounterEmissiveColor) {
          const composition = material.userData.asteroidComposition;
          material.userData.asteroidEncounterEmissiveColor = (
            COMPOSITION_ENCOUNTER_EMISSIVE[composition]
            ?? new THREE.Color(0x6d675f)
          ).clone();
        }
      }
      if (!Number.isFinite(material.userData.baseAsteroidEnvironmentIntensity)) {
        material.userData.baseAsteroidEnvironmentIntensity = Number(material.envMapIntensity ?? 0);
      }
      materials.add(material);
    });
  });
  return [...materials];
}

/** Creates the complete interactive asteroid system. */
export async function createAsteroidBelt({
  world,
  hoverTargets = [],
  quality = "high",
  // When supplied, the belt is built co-operatively: this is awaited between
  // expensive steps so the render loop keeps running. Omit it to build in one
  // synchronous pass, which preserves the original behaviour for any caller
  // that needs the belt to exist immediately.
  yieldToBrowser = null,
} = {}) {
  const initialQuality = ASTEROID_QUALITY_PRESETS[quality]
    ? quality
    : "medium";
  const qualityPreset = ASTEROID_QUALITY_PRESETS[initialQuality];
  const system = new THREE.Group();
  system.name = "Asteroid populations";

  const mainBelt = new THREE.Group();
  mainBelt.name = "Main asteroid belt";
  const trojans = new THREE.Group();
  trojans.name = "Jupiter Trojan clouds";
  system.add(mainBelt, trojans);

  performance.mark("BE:belt.materials-start");
  const materials = createCompositionMaterials();
  performance.mark("BE:belt.materials-end");
  const geometryPool = createGeometryPool();
  performance.mark("BE:belt.geometryPool-end");
  const rocks = [];

  MAJOR_BODIES.forEach((body, index) => {
    const orbit = {
      semiMajor: body.radius,
      eccentricity: body.eccentricity,
      inclination: body.inclination,
      node: seededRandom(index + 301) * Math.PI * 2,
      angle: body.angle,
      speed: body.orbitalSpeed,
    };

    const customGeometry = createAsteroidGeometry({
      seed: 900 + index,
      composition: body.composition,
      archetype: body.archetype,
      detail: 5,
      roundness: body.roundness,
      majorBasin: body.name === "Vesta",
    });

    geometryPool[body.composition][body.archetype] = [customGeometry];

    const rock = createAsteroidObject({
      index: 700 + index,
      composition: body.composition,
      size: body.size,
      orbit,
      materials,
      geometryPool,
      name: body.name,
      diameter: body.diameter,
      description: body.description,
      family: `${body.name} major body`,
      archetype: body.archetype,
      surfaceBoulders: body.name === "Ceres" ? 6 : body.name === "Vesta" ? 9 : 7,
      heliocentricAU: body.heliocentricAU,
      rotationPeriodHours: body.rotationPeriodHours,
      rotationState: "principal-axis",
    });
    mainBelt.add(rock);
    rocks.push(rock);
  });

  let accepted = 0;
  let attempts = 0;
  const backgroundCount = 250;

  while (accepted < backgroundCount && attempts < backgroundCount * 20) {
    const index = 1000 + attempts;
    attempts += 1;
    const semiMajor = BELT_INNER_RADIUS
      + seededRandom(index + 1) * (BELT_OUTER_RADIUS - BELT_INNER_RADIUS);
    if (isInsideKirkwoodGap(semiMajor)) continue;

    const composition = compositionForRadius(semiMajor, index + 2);
    const orbit = {
      semiMajor,
      eccentricity: 0.015 + seededRandom(index + 3) * 0.18,
      inclination: (seededRandom(index + 4) - 0.5) * 0.30,
      node: seededRandom(index + 5) * Math.PI * 2,
      angle: seededRandom(index + 6) * Math.PI * 2,
      speed: 0.00020 + seededRandom(index + 7) * 0.00042,
    };

    const size = 0.035 + Math.pow(seededRandom(index + 8), 4.6) * 0.34;
    const archetypes = COMPOSITIONS[composition].archetypes;
    const archetype = archetypes[Math.floor(seededRandom(index + 11) * archetypes.length)];
    const rock = createAsteroidObject({
      index,
      composition,
      size,
      orbit,
      materials,
      geometryPool,
      name: `${COMPOSITIONS[composition].label.split(" ")[0]} asteroid ${String(accepted + 1).padStart(3, "0")}`,
      diameter: `${Math.max(2, Math.round(size * 120))} km`,
      description: COMPOSITIONS[composition].description,
      family: "Background population",
      archetype,
      surfaceBoulders: size > 0.16 ? 4 + Math.floor(seededRandom(index + 12) * 4) : 0,
    });
    mainBelt.add(rock);
    rocks.push(rock);
    accepted += 1;
  }

  performance.mark("BE:belt.majorBodies-end");
  if (yieldToBrowser) await yieldToBrowser();
  createFamily({
    name: "Flora",
    composition: "S",
    centreRadius: 44.9 * SOLAR_ORBIT_SCALE,
    centreAngle: 1.1,
    inclination: 0.08,
    count: 24,
    seedOffset: 2200,
    container: mainBelt,
    rocks,
    materials,
    geometryPool,
  });

  createFamily({
    name: "Eos",
    composition: "C",
    centreRadius: 50.2 * SOLAR_ORBIT_SCALE,
    centreAngle: 3.7,
    inclination: 0.18,
    count: 22,
    seedOffset: 2400,
    container: mainBelt,
    rocks,
    materials,
    geometryPool,
  });

  createFamily({
    name: "Koronis",
    composition: "S",
    centreRadius: 49.5 * SOLAR_ORBIT_SCALE,
    centreAngle: 5.15,
    inclination: 0.05,
    count: 20,
    seedOffset: 2600,
    container: mainBelt,
    rocks,
    materials,
    geometryPool,
  });

  createTrojanCloud({
    label: "L4 leading",
    offset: Math.PI / 3,
    seedOffset: 3000,
    count: 42,
    container: trojans,
    rocks,
    materials,
    geometryPool,
  });

  createTrojanCloud({
    label: "L5 trailing",
    offset: -Math.PI / 3,
    seedOffset: 3400,
    count: 42,
    container: trojans,
    rocks,
    materials,
    geometryPool,
  });

  // The belt is rendered as a depth hierarchy. Resolved bodies remain fully
  // interactive; instanced boulders supply nearby 3D mass; points represent
  // only the enormous population that is too small to resolve at this scale.
  performance.mark("BE:belt.familiesAndTrojans-end");
  if (yieldToBrowser) await yieldToBrowser();
  const { field: instancedBoulderField, meshes: instancedBoulders } =
    createInstancedBoulderField(materials, qualityPreset.instanceDensity);
  performance.mark("BE:belt.boulders-end");
  if (yieldToBrowser) await yieldToBrowser();
  const distantDebris = createDistantDebris(
    Math.max(1, Math.round(UNRESOLVED_PEBBLE_COUNT * qualityPreset.debrisDensity)),
  );
  performance.mark("BE:belt.debris-end");
  mainBelt.add(instancedBoulderField, distantDebris);

  world.add(system);
  // Resolved bodies and every visible 3D instance can now be inspected. The
  // unresolved point field is intentionally excluded because each point is a
  // sub-pixel population marker rather than a resolvable physical rock.
  // Individually modelled rocks remain normal raycast targets. GPU-instanced
  // boulders are intentionally excluded from the broad raycast because a tiny,
  // visually unresolved instance can otherwise intercept clicks meant for a
  // planet or empty space. They remain selectable through the visibility-aware
  // screen-space helper above once they are actually large enough to see.
  hoverTargets.push(...rocks);
  const visibilityMaterials = collectAsteroidVisibilityMaterials(system);
  const trojanRocks = rocks.filter((rock) => (
    rock.userData?.info?.type === "Jupiter Trojan asteroid"
  ));

  return {
    system,
    mainBelt,
    trojans,
    rocks,
    trojanRocks,
    instancedBoulderField,
    instancedBoulders,
    distantDebris,
    visibilityMaterials,
    capacityQualityName: initialQuality,
    encounterIntensity: 0,
    targetEncounterIntensity: 0,
    spinElapsedSeconds: 0,
  };
}

/** Adjusts only sub-pixel/instanced population density; resolved bodies remain. */
export function setAsteroidBeltQuality(asteroidBelt, qualityName, pixelRatio = window.devicePixelRatio) {
  if (!asteroidBelt) return;
  const preset = ASTEROID_QUALITY_PRESETS[qualityName] ?? ASTEROID_QUALITY_PRESETS.medium;
  const capacityPreset = ASTEROID_QUALITY_PRESETS[asteroidBelt.capacityQualityName]
    ?? ASTEROID_QUALITY_PRESETS.medium;
  const instanceRatio = Math.min(1, preset.instanceDensity / capacityPreset.instanceDensity);
  const debrisRatio = Math.min(1, preset.debrisDensity / capacityPreset.debrisDensity);
  asteroidBelt.instancedBoulders?.forEach((mesh) => {
    const capacity = mesh.userData.capacity ?? mesh.count;
    const activeCount = Math.max(1, Math.min(capacity, Math.round(capacity * instanceRatio)));
    mesh.count = activeCount;
    mesh.userData.activeInstanceCount = activeCount;
  });

  const debris = asteroidBelt.distantDebris;
  if (debris?.geometry) {
    const capacity = debris.userData.capacity
      ?? debris.geometry.getAttribute("position")?.count
      ?? 0;
    const activeCount = Math.max(1, Math.min(capacity, Math.round(capacity * debrisRatio)));
    debris.geometry.setDrawRange(0, activeCount);
  }
  if (debris?.material?.uniforms?.uPixelRatio) {
    debris.material.uniforms.uPixelRatio.value = Math.min(Math.max(0.5, pixelRatio), 2);
  }
}

function isAsteroidInteractionBody(body) {
  if (!body) return false;
  const type = String(body.userData?.info?.type ?? "").toLowerCase();
  const name = String(body.userData?.name ?? body.name ?? "").toLowerCase();
  return Boolean(
    body.userData?.isAsteroid
    || body.userData?.isInstancedAsteroid
    || type.includes("asteroid")
    || name.includes("asteroid")
    || name.includes("family")
  );
}

function getCameraAsteroidBeltProximity(camera) {
  if (!camera) return 0;
  const radialDistance = Math.hypot(camera.position.x, camera.position.z);
  const radialGap = radialDistance < BELT_INNER_RADIUS
    ? BELT_INNER_RADIUS - radialDistance
    : radialDistance > BELT_OUTER_RADIUS
      ? radialDistance - BELT_OUTER_RADIUS
      : 0;
  const verticalGap = Math.max(
    0,
    Math.abs(camera.position.y) - ASTEROID_ENCOUNTER.verticalHalfThickness,
  );
  const distanceToBeltVolume = Math.hypot(radialGap, verticalGap);
  return 1 - THREE.MathUtils.smoothstep(
    distanceToBeltVolume,
    ASTEROID_ENCOUNTER.fullStrengthDistance,
    ASTEROID_ENCOUNTER.fadeDistance,
  );
}

function applyAsteroidEncounterVisibility(asteroidBelt, intensity) {
  const safeIntensity = THREE.MathUtils.clamp(intensity, 0, 1);
  const visualScale = THREE.MathUtils.lerp(
    1,
    ASTEROID_ENCOUNTER.maximumVisualScale,
    safeIntensity,
  );

  asteroidBelt.instancedBoulders?.forEach((mesh) => {
    mesh.userData.visualScaleFactor = visualScale;
    const scaleUniform = mesh.material?.userData?.asteroidVisibilityScaleUniform;
    if (scaleUniform) scaleUniform.value = visualScale;
    mesh.userData.inspectionTargets?.forEach((target) => {
      const baseVisualRadius = Number(target.userData.baseVisualRadius ?? 0);
      if (baseVisualRadius > 0) target.userData.visualRadius = baseVisualRadius * visualScale;
      if (target.userData.focusDetail && target.userData.instanceScale) {
        target.userData.focusDetail.scale
          .copy(target.userData.instanceScale)
          .multiplyScalar(visualScale);
      }
    });
  });

  const debrisUniforms = asteroidBelt.distantDebris?.material?.uniforms;
  if (debrisUniforms?.uEncounterStrength) debrisUniforms.uEncounterStrength.value = safeIntensity;

  asteroidBelt.visibilityMaterials?.forEach((material) => {
    const baseEmissive = Number(material.userData.baseAsteroidEmissiveIntensity ?? 0);
    const baseEnvironment = Number(material.userData.baseAsteroidEnvironmentIntensity ?? 0);
    const baseEmissiveColor = material.userData.baseAsteroidEmissiveColor;
    const encounterEmissiveColor = material.userData.asteroidEncounterEmissiveColor;
    if (material.emissive && baseEmissiveColor && encounterEmissiveColor) {
      material.emissive
        .copy(baseEmissiveColor)
        .lerp(encounterEmissiveColor, safeIntensity * 0.56);
    }
    material.emissiveIntensity = baseEmissive
      + ASTEROID_ENCOUNTER.maximumEmissiveBoost * safeIntensity;
    material.envMapIntensity = baseEnvironment
      + ASTEROID_ENCOUNTER.maximumEnvironmentBoost * safeIntensity;
  });
}

/**
 * Advances only the asteroid self-rotation clock.
 *
 * This lightweight function is called every rendered frame so GPU-instanced
 * rocks rotate smoothly even when orbital calculations are throttled by the
 * render loop. Hover/focus slows spin only slightly; unlike orbiting,
 * spinning around the object's own centre cannot make it escape the cursor.
 */
export function updateAsteroidSpinClock(
  asteroidBelt,
  deltaSeconds = 1 / 60,
  interactionState = {},
) {
  if (!asteroidBelt) return;

  const safeDelta = THREE.MathUtils.clamp(Number(deltaSeconds) || 0, 0, 0.05);
  const focusedAsteroid = isAsteroidInteractionBody(interactionState.focusedBody);
  const hoveredAsteroid = !focusedAsteroid
    && isAsteroidInteractionBody(interactionState.hoveredBody);
  const interactionMultiplier = focusedAsteroid
    ? ASTEROID_ROTATION.focusedRateMultiplier
    : hoveredAsteroid
      ? ASTEROID_ROTATION.hoveredRateMultiplier
      : 1;
  const encounterMultiplier = THREE.MathUtils.lerp(
    1,
    ASTEROID_ROTATION.encounterRateMultiplier,
    THREE.MathUtils.clamp(Number(asteroidBelt.encounterIntensity ?? 0), 0, 1),
  );

  asteroidBelt.spinElapsedSeconds = Number(asteroidBelt.spinElapsedSeconds ?? 0)
    + safeDelta * interactionMultiplier * encounterMultiplier;
  const spinTime = asteroidBelt.spinElapsedSeconds;

  // Keep the asteroid currently under inspection perfectly smooth even when
  // the rest of the resolved population is updating at a lower quality-tier
  // frequency. Instanced inspection details are handled below.
  const priorityResolvedBodies = new Set([
    interactionState.focusedBody,
    interactionState.hoveredBody,
  ]);
  priorityResolvedBodies.forEach((body) => {
    if (!body?.userData?.isAsteroid || body.userData.isInstancedAsteroid) return;
    composeAsteroidSpinQuaternion(
      _combinedSpinQuaternion,
      body.userData.spinProfile,
      spinTime,
    );
    body.quaternion
      .copy(body.userData.baseQuaternion ?? _instanceQuaternion.identity())
      .multiply(_combinedSpinQuaternion);
  });

  asteroidBelt.instancedBoulders?.forEach((mesh) => {
    const spinUniform = mesh.material?.userData?.asteroidSpinTimeUniform;
    if (spinUniform) spinUniform.value = spinTime;

    // Only cached, currently visible inspection models need a CPU quaternion.
    // The many normal boulders continue rotating entirely in the vertex shader.
    mesh.userData.inspectionTargets?.forEach((target) => {
      const detailGroup = target.userData.focusDetail;
      if (!detailGroup?.visible) return;
      composeAsteroidSpinQuaternion(
        detailGroup.quaternion,
        target.userData.instanceRecord?.spinProfile,
        spinTime,
      );
    });
  });
}

/**
 * Keeps Jupiter Trojan asteroids visually continuous between throttled belt updates.
 *
 * Runtime quality tiers may update the full asteroid system at 20-30 Hz. The
 * Trojan clouds are locked to Jupiter, which itself moves every rendered frame;
 * updating these small nearby rocks only on the slower belt clock can make their
 * positions and lighting jump, which reads as flicker. This lightweight pass
 * updates only the 84 Trojan bodies every frame, preserving the broader
 * render loop throttling for the dense main belt.
 */
export function updateJupiterTrojanFrame(asteroidBelt, jupiter = null) {
  if (!asteroidBelt?.trojanRocks?.length || !jupiter) return;

  const jupiterAngle = Number(jupiter.userData?.angle ?? 0);
  const spinTime = Number(asteroidBelt.spinElapsedSeconds ?? 0);

  asteroidBelt.trojanRocks.forEach((rock) => {
    const orbit = rock.userData?.orbit;
    if (!orbit || orbit.trojanOffset === undefined) return;

    orbit.angle = jupiterAngle + orbit.trojanOffset + orbit.trojanSpread;
    positionFromOrbit(rock.position, orbit, orbit.angle);
    composeAsteroidSpinQuaternion(
      _combinedSpinQuaternion,
      rock.userData.spinProfile,
      spinTime,
    );
    rock.quaternion
      .copy(rock.userData.baseQuaternion ?? _instanceQuaternion.identity())
      .multiply(_combinedSpinQuaternion);
  });
}

/** Advances asteroid orbits and synchronizes resolved-body spin orientation. */
// Level-of-detail thresholds, in rendered pixels of body radius.
//
// Measured before this existed: 1,239 individually modelled rocks were drawn at
// ~9,600 triangles each regardless of distance, contributing 7.8M of the
// scene's 13.2M triangles while the belt occupied a thin ellipse on screen.
// Each rock also carried an invisible interaction proxy costing a further draw
// call, so culling the whole group below the floor removes both.
//
// Both thresholds are hysteretic: a rock sitting exactly on a boundary would
// otherwise flip state every frame as it orbits, and each flip can cost a
// geometry re-bind. Separate enter/leave values give it somewhere to settle.
const ASTEROID_LOD = {
  hideBelowPixels: 1.05,
  showAbovePixels: 1.45,

  /*
   * The same two thresholds while the viewer is inside the belt.
   *
   * The cull floor above was written for the wide solar-system shot, where the
   * belt is a thin ellipse and a sub-pixel rock is genuinely not worth a draw
   * call. Inside the belt it was the reason "not all nearby asteroids are
   * selectable": focused on Vesta, the *entire* remaining population projects
   * between 0.8 and 1.6 pixels -- so the 1.05/1.45 dead band swallowed it.
   * Measured at that moment: 9 of 323 belt bodies visible, and the nine were
   * not the nine nearest. Neighbours at 58, 60 and 67 units were culled while
   * one at 100 was drawn, because which side of the dead band a rock is left on
   * is a matter of the history of its own hysteresis, not of distance. An
   * invisible object is skipped by the raycaster, so every one of those was
   * unhoverable, and the sky around the focused rock was simply empty.
   *
   * In an encounter almost nothing is culled: if it lands on screen it can be
   * pointed at.
   */
  encounterHideBelowPixels: 0.14,
  encounterShowAbovePixels: 0.22,

  /*
   * ...and a floor on how small a neighbour may be *drawn* while inspecting.
   *
   * Visible is not the same as findable. A rock rendered 1.2 pixels across is
   * a dark speck against a starfield -- selectable in principle, invisible in
   * practice. During an encounter anything under this size is drawn at this
   * size, which is the same bargain `ASTEROID_ENCOUNTER.maximumVisualScale`
   * already strikes for the instanced boulders, expressed in screen space so
   * that it does the same job at every distance. The boost is capped, faded in
   * with the encounter, and self-cancelling: as the camera closes on a rock its
   * true size passes the floor and the scale returns to 1 before arrival.
   */
  encounterMinimumPixels: 3.4,
  encounterMaximumBoost: 6,

  standInBelowPixels: 4.5,
  fullSculptAbovePixels: 6.5,
  // Uploading a geometry the GPU has not seen before stalls the frame. Spread
  // first-time swaps across frames instead of letting hundreds land at once.
  maximumSwapsPerFrame: 12,
};

const _lodWorldPosition = new THREE.Vector3();

/**
 * Applies the encounter presence boost to one rock.
 *
 * `visualRadius` moves with the scale because it is what the screen-space
 * asteroid picker measures a hit against, and what main.js uses for the
 * focused body's occlusion depth -- a rock drawn larger has to be pickable
 * larger, or the boost would make it look reachable without making it so.
 * `baseVisualRadius` keeps the honest figure for the focus distance.
 */
function applyAsteroidPresenceScale(rock, presence) {
  const current = Number(rock.userData.presenceScale ?? 1);
  if (Math.abs(current - presence) < 0.002) return;
  rock.userData.presenceScale = presence;

  const base = rock.userData.basePresenceScale
    ?? (rock.userData.basePresenceScale = rock.scale.clone());
  rock.scale.copy(base).multiplyScalar(presence);

  const baseRadius = Number(rock.userData.baseVisualRadius ?? 0);
  if (baseRadius > 0) rock.userData.visualRadius = baseRadius * presence;
}

/**
 * Chooses a detail level for one resolved rock from its projected size.
 * Returns true when the body should be drawn at all.
 */
function applyAsteroidLevelOfDetail(rock, camera, focalPixels, budget, encounter = 0) {
  const core = rock.userData.core;
  if (!core || !core.userData.lodLow) return true;

  _lodWorldPosition.setFromMatrixPosition(rock.matrixWorld);
  const distance = camera.position.distanceTo(_lodWorldPosition);
  // The rock's *own* size, never the boosted one: measuring the boosted radius
  // would feed the boost back into itself and the scale would run away.
  const radius = Number(rock.userData.baseVisualRadius
    ?? (rock.userData.baseVisualRadius = Number(rock.userData.visualRadius ?? 0.1)));
  const pixels = (radius / Math.max(distance, 1e-4)) * focalPixels;

  const strength = THREE.MathUtils.clamp(Number(encounter) || 0, 0, 1);
  const hideBelow = THREE.MathUtils.lerp(
    ASTEROID_LOD.hideBelowPixels,
    ASTEROID_LOD.encounterHideBelowPixels,
    strength,
  );
  const showAbove = THREE.MathUtils.lerp(
    ASTEROID_LOD.showAbovePixels,
    ASTEROID_LOD.encounterShowAbovePixels,
    strength,
  );

  // Visibility, with a dead band between the two thresholds.
  if (rock.visible) {
    if (pixels < hideBelow) {
      rock.visible = false;
      applyAsteroidPresenceScale(rock, 1);
      return false;
    }
  } else if (pixels > showAbove) {
    rock.visible = true;
  } else {
    applyAsteroidPresenceScale(rock, 1);
    return false;
  }

  let presence = 1;
  if (strength > 0 && pixels > 0 && pixels < ASTEROID_LOD.encounterMinimumPixels) {
    const wantedScale = Math.min(
      ASTEROID_LOD.encounterMaximumBoost,
      ASTEROID_LOD.encounterMinimumPixels / pixels,
    );
    presence = THREE.MathUtils.lerp(1, wantedScale, strength);
  }
  applyAsteroidPresenceScale(rock, presence);

  // Geometry is chosen from what is actually drawn, so a boosted speck does not
  // ask for a sculpt it does not need.
  const drawnPixels = pixels * presence;
  const usingStandIn = core.geometry === core.userData.lodLow;
  let wanted = core.geometry;
  if (usingStandIn && drawnPixels > ASTEROID_LOD.fullSculptAbovePixels) {
    wanted = core.userData.lodHigh;
  } else if (!usingStandIn && drawnPixels < ASTEROID_LOD.standInBelowPixels) {
    wanted = core.userData.lodLow;
  }

  if (wanted !== core.geometry && budget.remaining > 0) {
    core.geometry = wanted;
    budget.remaining -= 1;
  }
  return true;
}

/**
 * Settles every rock on its correct detail level in one pass.
 *
 * Rocks are constructed holding their full-detail geometry, so without this the
 * first 34 frames are spent swapping all 405 of them down to their stand-ins at
 * the 12-per-frame budget -- each first-time swap risking an upload stall, and
 * the whole belt visibly popping while it settles. Called once before the first
 * frame, where the cost is hidden behind the loader.
 */
export function primeAsteroidLevelOfDetail(asteroidBelt, camera) {
  if (!asteroidBelt?.rocks || !camera) return 0;
  const focalPixels = (window.innerHeight * 0.5)
    / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  // Unbudgeted on purpose: this runs once, off-screen.
  const budget = { remaining: Number.MAX_SAFE_INTEGER };
  let settled = 0;
  asteroidBelt.rocks.forEach((rock) => {
    if (!rock?.userData?.orbit) return;
    applyAsteroidLevelOfDetail(rock, camera, focalPixels, budget);
    settled += 1;
  });
  return settled;
}

export function updateAsteroidBelt(
  asteroidBelt,
  motionScale = 1,
  camera = null,
  sunAngularRadius = 0,
  interactionState = {},
) {
  if (!asteroidBelt) return;

  const interactionStrength = isAsteroidInteractionBody(interactionState.focusedBody)
    ? 1
    : isAsteroidInteractionBody(interactionState.hoveredBody)
      ? 0.96
      : 0;
  asteroidBelt.targetEncounterIntensity = Math.max(
    interactionStrength,
    getCameraAsteroidBeltProximity(camera),
  );
  asteroidBelt.encounterIntensity = THREE.MathUtils.lerp(
    Number(asteroidBelt.encounterIntensity ?? 0),
    asteroidBelt.targetEncounterIntensity,
    0.16,
  );
  applyAsteroidEncounterVisibility(asteroidBelt, asteroidBelt.encounterIntensity);

  const debrisUniforms = asteroidBelt.distantDebris?.material?.uniforms;
  if (camera && debrisUniforms?.uSunDirection) {
    debrisUniforms.uSunDirection.value.copy(camera.position).multiplyScalar(-1);
    if (debrisUniforms.uSunDirection.value.lengthSq() < 1e-8) {
      debrisUniforms.uSunDirection.value.set(0, 0, -1);
    } else {
      debrisUniforms.uSunDirection.value.normalize();
    }
    debrisUniforms.uSunAngularRadius.value = Math.max(0, sunAngularRadius);
  }

  // Once the camera is inside the belt, the population intentionally enters a
  // readable observation speed. This removes the feeling that tiny rocks slide
  // away from the cursor while preserving motion in the wider solar-system view.
  const beltMotionScale = motionScale * THREE.MathUtils.lerp(
    1,
    ASTEROID_ENCOUNTER.minimumMotionMultiplier,
    asteroidBelt.encounterIntensity,
  );
  const spinTime = Number(asteroidBelt.spinElapsedSeconds ?? 0);

  // Vertical focal length in pixels: how many pixels one world unit spans at
  // one unit of distance. Computed once per frame rather than per rock.
  const focalPixels = camera
    ? (window.innerHeight * 0.5)
      / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    : 0;

  // The very first pass runs unbudgeted. Every rock is constructed holding its
  // full-detail geometry, so at 12 swaps per frame the belt spent its first ~34
  // frames swapping all 405 of them down and visibly popping while it settled.
  // Doing it in one go costs a single expensive frame, which is still behind the
  // loader, and the budget then applies to ordinary movement from there on.
  const lodBudget = {
    remaining: asteroidBelt.lodPrimed
      ? ASTEROID_LOD.maximumSwapsPerFrame
      : Number.MAX_SAFE_INTEGER,
  };
  asteroidBelt.lodPrimed = true;

  asteroidBelt.rocks.forEach((rock) => {
    const orbit = rock.userData.orbit;
    if (!orbit) return;

    // Detail selection runs for every rock including Trojans, which return
    // early below because their motion is driven from updateJupiterTrojanFrame.
    if (camera) {
      applyAsteroidLevelOfDetail(
        rock,
        camera,
        focalPixels,
        lodBudget,
        asteroidBelt.encounterIntensity,
      );
    }

    // Trojan positions and spin are synchronized every rendered frame by
    // updateJupiterTrojanFrame(), avoiding 20-30 Hz stepping near Jupiter.
    if (orbit.trojanOffset !== undefined) return;

    orbit.meanAnomaly = (orbit.meanAnomaly ?? orbit.angle ?? 0) + orbit.speed * beltMotionScale;
    orbit.angle = asteroidTrueAnomalyFromMean(orbit.meanAnomaly, orbit.eccentricity ?? 0);

    positionFromOrbit(rock.position, orbit, orbit.angle);
    composeAsteroidSpinQuaternion(
      _combinedSpinQuaternion,
      rock.userData.spinProfile,
      spinTime,
    );
    rock.quaternion
      .copy(rock.userData.baseQuaternion ?? _instanceQuaternion.identity())
      .multiply(_combinedSpinQuaternion);
  });

  // Each instanced population band advances at a slightly different rate. The
  // small difference prevents the belt from behaving like one rigid vinyl ring.
  asteroidBelt.instancedBoulders?.forEach((mesh) => {
    mesh.rotation.y += mesh.userData.rotationSpeed * beltMotionScale;
  });
  asteroidBelt.distantDebris.rotation.y += 0.000045 * beltMotionScale;
}

import * as THREE from "three";
import {
  makeGlowTexture,
  makeNoiseTexture,
} from "../../graphics/proceduralTextures.js";
import { getMoonVisualRadius, getSizeComparisonText } from "../../config/celestialScale.js";
import {
  PHOBOS_PROFILE,
  createPhobosSurface,
} from "../mars/satellites/phobos.js";
import {
  DEIMOS_PROFILE,
  createDeimosSurface,
} from "../mars/satellites/deimos.js";
import {
  JUPITER_IAU_RECOGNIZED_COUNT,
  JUPITER_MOON_COUNT,
  JUPITER_MOON_PROFILES,
} from "../jupiter/satellites/jovianMoonCatalog.js";
import {
  createJovianMoonSurface,
  JOVIAN_MOON_INSPECTION_LAYER,
  setJovianMoonInspectionDetail,
} from "../jupiter/satellites/jovianMoonFactory.js";

export { JOVIAN_MOON_INSPECTION_LAYER };
import { SATURN_MOON_COUNT, SATURN_MOON_PROFILES } from "../saturn/satellites/saturnianMoonCatalog.js";
import { createSaturnianMoonSurface } from "../saturn/satellites/saturnianMoonFactory.js";
import { NEPTUNE_MOON_COUNT, NEPTUNE_MOON_PROFILES } from "../neptune/satellites/neptunianMoonCatalog.js";
import { createNeptunianMoonSurface } from "../neptune/satellites/neptunianMoonFactory.js";
import { URANUS_MOON_COUNT, URANUS_MOON_PROFILES } from "../uranus/satellites/uranianMoonCatalog.js";
import { createUranianMoonSurface } from "../uranus/satellites/uranianMoonFactory.js";
import { PLUTO_MOON_COUNT, PLUTO_MOON_PROFILES } from "../pluto/satellites/plutonianMoonCatalog.js";
import { createPlutonianMoonSurface } from "../pluto/satellites/plutonianMoonFactory.js";
import { createTransNeptunianMoonSurface } from "./transNeptunianMoonFactory.js";
import {
  TRANS_NEPTUNIAN_MOON_PARENTS,
  TRANS_NEPTUNIAN_MOON_SYSTEMS,
} from "./transNeptunianMoonCatalog.js";

const MOON_SYSTEMS = Object.freeze({
  Mars: [
    PHOBOS_PROFILE,
    DEIMOS_PROFILE,
  ],
  Jupiter: JUPITER_MOON_PROFILES,
  Saturn: SATURN_MOON_PROFILES,
  Uranus: URANUS_MOON_PROFILES,
  Neptune: NEPTUNE_MOON_PROFILES,
  Pluto: PLUTO_MOON_PROFILES,
  // Eris, Haumea, Orcus, Quaoar, Makemake and Gonggong. Sedna is absent
  // because it genuinely has no moon, not because one has been left out.
  ...TRANS_NEPTUNIAN_MOON_SYSTEMS,
});

const PARENT_ORBITAL_SCALE = Object.freeze({
  Mars: { heliocentricAU: 1.5237, eccentricity: 0.0934 },
  Jupiter: { heliocentricAU: 5.2029, eccentricity: 0.0484 },
  Saturn: { heliocentricAU: 9.5367, eccentricity: 0.0539 },
  Uranus: { heliocentricAU: 19.1892, eccentricity: 0.0473 },
  Neptune: { heliocentricAU: 30.0699, eccentricity: 0.0086 },
  Pluto: { heliocentricAU: 39.482, eccentricity: 0.2488 },
  Orcus: { heliocentricAU: 39.377, eccentricity: 0.2201 },
  Haumea: { heliocentricAU: 43.060, eccentricity: 0.1915 },
  Quaoar: { heliocentricAU: 43.156, eccentricity: 0.0350 },
  Makemake: { heliocentricAU: 45.571, eccentricity: 0.1612 },
  Gonggong: { heliocentricAU: 66.867, eccentricity: 0.4999 },
  Eris: { heliocentricAU: 67.934, eccentricity: 0.4360 },
});

const orbitPoint = new THREE.Vector3();
const orbitTiltAxis = new THREE.Vector3(0, 0, 1);
const parentWorldPosition = new THREE.Vector3();
const moonWorldPosition = new THREE.Vector3();
const projectedParentPosition = new THREE.Vector3();
const projectedMoonPosition = new THREE.Vector3();
const sharedSatelliteResources = new Map();
let sharedSatelliteGlintTexture = null;

/**
 * Returns one soft point texture shared by every distant Uranian moon marker.
 *
 * The marker is not a replacement moon and never appears during close
 * inspection. It is a tiny screen-space suggestion of reflected sunlight used
 * only while the real mesh would otherwise occupy less than a useful pixel.
 */
function getSharedSatelliteGlintTexture() {
  if (!sharedSatelliteGlintTexture) {
    sharedSatelliteGlintTexture = makeGlowTexture();
    sharedSatelliteGlintTexture.name = "Distant satellite sunlight glint";
  }
  return sharedSatelliteGlintTexture;
}

function createUranianDistantVisibilityMaterial() {
  const material = new THREE.SpriteMaterial({
    map: getSharedSatelliteGlintTexture(),
    color: 0xd9ffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });
  material.name = "Uranian distant moon reflected-light glint";
  return material;
}

/**
 * Planet letters used inside IAU provisional natural-satellite designations.
 *
 * Example: "S/2019 J 1"
 * - S = natural satellite
 * - 2019 = year of the observations that led to the discovery
 * - J = Jupiter
 * - 1 = the sequence number in that planet/year designation series
 */
const SATELLITE_DESIGNATION_PLANETS = Object.freeze({
  M: "Mars",
  J: "Jupiter",
  S: "Saturn",
  U: "Uranus",
  N: "Neptune",
  P: "Pluto",
});

/**
 * Turns a compact provisional moon name into an explanation suitable for the
 * celestial-body information card. Named moons return null because their
 * familiar proper name does not need this extra decoding paragraph.
 */
function getSatelliteDesignationExplanation(name) {
  const match = String(name ?? "")
    .trim()
    .match(/^S\/(\d{4})\s*([MJSUNP])\s*(\d+)$/i);

  if (!match) return null;

  const [, observationYear, rawPlanetCode, sequenceNumber] = match;
  const planetCode = rawPlanetCode.toUpperCase();
  const planetName = SATELLITE_DESIGNATION_PLANETS[planetCode];

  return [
    `Designation explained: “S” means natural satellite.`,
    `“${observationYear}” is the year of the discovery observations, not necessarily the year the very first image was taken.`,
    `“${planetCode}” identifies ${planetName},`,
    `and “${sequenceNumber}” is its sequence number in ${planetName}'s ${observationYear} provisional-satellite designation series.`,
    `This scientific code is used while the moon has no approved proper name.`,
  ].join(" ");
}

/**
 * Staged construction calls the factory once per planetary system. Reuse the
 * same generic moon texture/geometry that the previous all-at-once build used,
 * so staging does not multiply GPU memory.
 */
function getSharedSatelliteResources(quality) {
  if (sharedSatelliteResources.has(quality)) {
    return sharedSatelliteResources.get(quality);
  }

  const textureSize = quality === "low" ? 384 : quality === "medium" ? 512 : 768;
  const sphereSegments = quality === "low"
    ? [32, 24]
    : quality === "medium"
      ? [44, 32]
      : [56, 40];
  const resources = {
    texture: makeNoiseTexture("moon", textureSize),
    geometry: new THREE.SphereGeometry(1, sphereSegments[0], sphereSegments[1]),
  };
  sharedSatelliteResources.set(quality, resources);
  return resources;
}

function isJovianProfile(profile, parentName) {
  return parentName === "Jupiter" && Boolean(profile.family);
}

function getJovianInteractionTier(profile) {
  if (profile.family === "Galilean moon" || profile.family === "Inner regular moon") {
    return "direct";
  }
  return profile.showOrbitGuide ? "notable" : "background";
}

function shouldCreateDirectPointerProxy(profile, parentName) {
  if (profile.instanced) return false;
  if (!isJovianProfile(profile, parentName)) return true;
  return getJovianInteractionTier(profile) === "direct";
}

function orbitRadiusAtAngle(semiMajorRadius, eccentricity, angle) {
  const safeEccentricity = THREE.MathUtils.clamp(Number(eccentricity) || 0, 0, 0.86);
  if (safeEccentricity <= 0.0001) return semiMajorRadius;
  return semiMajorRadius * (1 - safeEccentricity * safeEccentricity)
    / Math.max(0.08, 1 + safeEccentricity * Math.cos(angle));
}

function getVisualOrbitEccentricity(profile) {
  return Number.isFinite(Number(profile?.visualEccentricity))
    ? Number(profile.visualEccentricity)
    : Number(profile?.eccentricity ?? 0);
}

function createOrbitLines(
  moons,
  parentRadius,
  quality = "high",
  {
    includeEveryOrbit = false,
    name = "Major satellite orbit guides",
    color = 0x9bc6d9,
    opacity = 0.10,
    useAtlasOrbitScale = false,
  } = {},
) {
  const positions = [];
  // Complete giant-planet atlases can contain hundreds of paths. A lower
  // segment budget keeps them smooth at atlas scale while retaining one draw
  // call and avoiding hundreds of individual LineLoop objects.
  const segments = includeEveryOrbit
    ? (quality === "low" ? 40 : quality === "medium" ? 52 : 64)
    : (quality === "low" ? 64 : quality === "medium" ? 96 : 128);

  moons.forEach((moon) => {
    if (!includeEveryOrbit && moon.showOrbitGuide === false) return;

    const orbitScale = useAtlasOrbitScale
      ? Number(moon.atlasOrbitScale ?? moon.orbitScale)
      : Number(moon.orbitScale);
    const semiMajorRadius = parentRadius * orbitScale;
    const inclination = moon.inclination ?? 0;
    const node = moon.node ?? 0;

    for (let index = 0; index < segments; index += 1) {
      const a = index / segments * Math.PI * 2;
      const b = (index + 1) / segments * Math.PI * 2;
      const radiusA = orbitRadiusAtAngle(semiMajorRadius, getVisualOrbitEccentricity(moon), a);
      const radiusB = orbitRadiusAtAngle(semiMajorRadius, getVisualOrbitEccentricity(moon), b);

      orbitPoint.set(Math.cos(a) * radiusA, 0, -Math.sin(a) * radiusA);
      orbitPoint.applyAxisAngle(orbitTiltAxis, inclination);
      orbitPoint.applyAxisAngle(THREE.Object3D.DEFAULT_UP, node);
      positions.push(orbitPoint.x, orbitPoint.y, orbitPoint.z);

      orbitPoint.set(Math.cos(b) * radiusB, 0, -Math.sin(b) * radiusB);
      orbitPoint.applyAxisAngle(orbitTiltAxis, inclination);
      orbitPoint.applyAxisAngle(THREE.Object3D.DEFAULT_UP, node);
      positions.push(orbitPoint.x, orbitPoint.y, orbitPoint.z);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = name;
  return lines;
}

function createMoonMaterial(profile, sharedTexture) {
  return new THREE.MeshStandardMaterial({
    map: sharedTexture,
    bumpMap: sharedTexture,
    bumpScale: 0.018,
    color: profile.color ?? profile.colour ?? 0x888888,
    roughness: 0.98,
    metalness: 0,
    envMapIntensity: 0.04,
  });
}

function createSatelliteMesh(
  profile,
  parentName,
  parentRadius,
  sharedGeometry,
  sharedTexture,
  quality,
) {
  const visualRadius = profile.visualRadius ?? getMoonVisualRadius(profile.diameterKm, {
    minimum: profile.diameterKm < 50 ? 0.045 : 0.055,
    maximum: 0.68,
  });

  let moon;
  if (profile.name === "Phobos") {
    moon = createPhobosSurface(quality);
  } else if (profile.name === "Deimos") {
    moon = createDeimosSurface(quality);
  } else if (parentName === "Jupiter") {
    moon = createJovianMoonSurface(profile, quality);
  } else if (parentName === "Saturn") {
    moon = createSaturnianMoonSurface(profile, quality);
  } else if (parentName === "Neptune") {
    moon = createNeptunianMoonSurface(profile, quality);
  } else if (parentName === "Uranus") {
    moon = createUranianMoonSurface(profile, quality);
  } else if (parentName === "Pluto") {
    moon = createPlutonianMoonSurface(profile, quality);
  } else if (TRANS_NEPTUNIAN_MOON_PARENTS.includes(parentName)) {
    moon = createTransNeptunianMoonSurface(profile, quality);
  } else {
    moon = new THREE.Mesh(sharedGeometry, createMoonMaterial(profile, sharedTexture));
  }

  moon.name = profile.name;
  // Some spacecraft-reference factories sculpt the complete silhouette directly
  // into geometry. Re-applying profile.shape here would stretch those moons a
  // second time and destroy the intended Pan/Atlas/Daphnis/shepherd outlines.
  const shape = moon.userData?.geometryIncludesShape
    ? [1, 1, 1]
    : (profile.shape ?? [1, 1, 1]);
  moon.scale.set(
    visualRadius * shape[0],
    visualRadius * shape[1],
    visualRadius * shape[2],
  );
  const semiMajorVisualRadius = parentRadius * profile.orbitScale;
  moon.position.x = orbitRadiusAtAngle(
    semiMajorVisualRadius,
    getVisualOrbitEccentricity(profile),
    profile.meanAnomaly ?? 0,
  );
  if (profile.initialRotation) moon.rotation.set(...profile.initialRotation);

  const orbitalScale = PARENT_ORBITAL_SCALE[parentName];
  const sizeComparison = getSizeComparisonText({ diameterKm: profile.diameterKm, name: profile.name });
  const jovian = isJovianProfile(profile, parentName);
  const interactionTier = jovian ? getJovianInteractionTier(profile) : "direct";
  const diameterPrefix = profile.diameterEstimated ? "≈ " : "";
  const designationExplanation = getSatelliteDesignationExplanation(profile.name);
  const scientificDescription = [
    profile.description,
    profile.surfaceStructure ? `Surface structure: ${profile.surfaceStructure}` : null,
    profile.orbitSummary,
    designationExplanation,
    profile.dataNote,
  ]
    .filter(Boolean)
    .join(" ");
  const jovianIrregular = jovian
    && profile.family !== "Galilean moon"
    && profile.family !== "Inner regular moon";
  const renderedVisualRadius = Math.max(...moon.scale.toArray());
  const plutonian = parentName === "Pluto";
  const focusDistance = plutonian
    ? (profile.name === "Charon"
      ? Math.max(0.52, renderedVisualRadius * 5.2)
      // Pluto's four small moons are intentionally visibility-boosted, but the
      // camera must not hug those enlarged irregular silhouettes too tightly.
      // A more generous inspection distance keeps the body, HTML selection
      // card anchor, and near clipping plane stable while switching moons.
      : Math.max(0.62, renderedVisualRadius * 10.5))
    : jovianIrregular
      ? Math.max(0.44, visualRadius * 6.4)
      : Math.max(0.90, visualRadius * (jovian ? 5.2 : 4.6));
  const minFocusDistance = plutonian
    ? (profile.name === "Charon"
      ? Math.max(renderedVisualRadius * 6.2, focusDistance * 0.70)
      : Math.max(0.48, renderedVisualRadius * 7.8, focusDistance * 0.76))
    : jovianIrregular
      ? Math.max(0.32, visualRadius * 4.8)
      : Math.max(0.72, visualRadius * (jovian ? 4.15 : 3.7));

  // Preserve the specialised surface state created by the planet-specific
  // factory. v4 replaced moon.userData wholesale here, which would erase any
  // lazy-detail resources and made later inspection upgrades impossible.
  moon.userData = {
    ...moon.userData,
    name: profile.name,
    detail: jovian
      ? `${profile.family} | ${profile.surfaceEvidence ?? "evidence-tiered 3D"} | Jupiter satellite ${profile.jplCode}`
      : plutonian
        ? `${profile.family} | ${profile.name === "Charon" ? "Pluto-relative size preserved" : "visibility-boosted small-moon scale"} | New Horizons-informed 3D`
        : `${parentName} satellite | Earth-relative size preserved`,
    parentPlanet: parentName,
    isSatellite: true,
    isJovianSatellite: jovian,
    satelliteFamily: profile.family ?? null,
    surfaceEvidence: profile.surfaceEvidence ?? null,
    surfaceStructure: profile.surfaceStructure ?? null,
    surfaceRoughness: profile.surfaceRoughness ?? null,
    estimatedAlbedo: profile.albedo ?? null,
    interactionTier,
    heliocentricAU: orbitalScale.heliocentricAU,
    orbitalEccentricity: orbitalScale.eccentricity,
    satelliteOrbitalEccentricity: profile.eccentricity ?? 0,
    distanceBasis: "satellite-parent-orbit",
    tidallyLocked: Boolean(profile.tidallyLocked),
    surfaceModel: parentName === "Mars"
      ? "terrain-first-3d"
      : jovian
        ? (profile.surfaceEvidence === "spacecraft-resolved"
          ? "jovian-spacecraft-informed-3d"
          : "jovian-evidence-tiered-individual-3d")
        : parentName === "Saturn"
          ? "saturnian-individual-3d"
          : parentName === "Neptune"
            ? "neptunian-individual-3d"
            : parentName === "Uranus"
              ? "uranian-individual-3d"
              : parentName === "Pluto"
                ? "plutonian-new-horizons-informed-3d"
                : "shared-satellite-sphere",
    visualRadius: renderedVisualRadius,
    physicalDiameterKm: profile.diameterKm,
    diameterEarths: profile.diameterKm / 12_756,
    volumeEarths: Math.pow(profile.diameterKm / 12_756, 3),
    sizeComparison,
    focusDistance,
    minFocusDistance,
    focusEase: plutonian
      ? (profile.name === "Charon" ? 0.12 : 0.18)
      : jovianIrregular ? 0.10 : 0.11,
    focusFov: plutonian ? 30 : jovianIrregular ? 30 : parentName === "Mars" ? 36 : 34,
    info: {
      type: "Natural satellite",
      diameter: profile.diameterLabel
        ?? (profile.dimensions
          ? `${profile.dimensions} · ${diameterPrefix}${profile.diameterKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} km mean`
          : `${diameterPrefix}${profile.diameterKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} km`),
      orbitalSpeed: profile.orbitalSpeed,
      distanceFromEarth: `Varies with ${parentName}'s orbit`,
      sizeComparison,
      surfaceEvidence: profile.surfaceEvidence ?? "Not specified",
      roughness: Number.isFinite(profile.surfaceRoughness)
        ? profile.surfaceRoughness.toFixed(2)
        : "Model-derived",
      description: scientificDescription || profile.description,
    },
  };

  if (profile.atmosphere && !moon.userData.hasCustomAtmosphere) {
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 24),
      new THREE.MeshBasicMaterial({
        color: profile.atmosphere,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    atmosphere.scale.copy(moon.scale).multiplyScalar(1.05);
    moon.add(atmosphere);
  }

  let hitTarget = null;
  if (shouldCreateDirectPointerProxy(profile, parentName)) {
    hitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthWrite: false,
      }),
    );
    hitTarget.name = `${profile.name} interaction target`;
    const minimumHitRadius = parentName === "Pluto"
      ? (profile.name === "Charon" ? 0.012 : 0.040)
      : jovian ? 0.10 : 0.14;
    const hitRadius = Math.max(
      renderedVisualRadius * (parentName === "Pluto" ? 1.55 : jovian ? 1.55 : 1.9),
      minimumHitRadius,
    );
    hitTarget.scale.setScalar(hitRadius);
    hitTarget.position.copy(moon.position);
    hitTarget.userData.interactionOwner = moon;
    moon.userData.interactionTarget = hitTarget;
  }

  return {
    moon,
    hitTarget,
    semiMajorVisualRadius,
    profile,
  };
}


const denseMoonDummy = new THREE.Object3D();
const denseMoonColour = new THREE.Color();

/**
 * Creates a render-free focus anchor for one moon stored inside an InstancedMesh.
 *
 * The InstancedMesh remains responsible for drawing hundreds of tiny rocks in
 * one GPU call. This Object3D only carries scientific metadata and a live world
 * position so hover, click, camera focus, Back/Escape, and information cards can
 * address that exact catalogue entry.
 */
function createDenseSatelliteInteractionTarget(profile, parentName) {
  const target = new THREE.Object3D();
  const visualRadius = Number(profile.visualRadius ?? 0.02);
  const orbitalScale = PARENT_ORBITAL_SCALE[parentName];
  const diameterKm = Number(profile.diameterKm ?? 0);
  const sizeComparison = getSizeComparisonText({
    diameterKm,
    name: profile.name,
  });
  const diameterPrefix = profile.diameterEstimated ? "≈ " : "";
  const designationExplanation = getSatelliteDesignationExplanation(profile.name);
  const scientificDescription = [
    profile.description,
    profile.surfaceStructure ? `Surface structure: ${profile.surfaceStructure}` : null,
    profile.orbitSummary,
    designationExplanation,
    profile.dataNote,
  ]
    .filter(Boolean)
    .join(" ");

  target.name = profile.name;
  target.userData = {
    name: profile.name,
    detail: `${parentName} satellite · unresolved visual reconstruction`,
    parentPlanet: parentName,
    isSatellite: true,
    isDenseSatellite: true,
    satelliteFamily: profile.family ?? null,
    interactionTier: "background",
    surfaceEvidence: profile.surfaceEvidence
      ?? "Unresolved telescopic point source · scientifically guided visual reconstruction",
    surfaceResolutionStatus: profile.surfaceResolutionStatus
      ?? "No resolved real surface image is currently available",
    surfaceStructure: profile.surfaceStructure ?? null,
    surfaceRoughness: profile.surfaceRoughness ?? 1,
    estimatedAlbedo: profile.albedo ?? null,
    heliocentricAU: orbitalScale?.heliocentricAU,
    orbitalEccentricity: orbitalScale?.eccentricity,
    satelliteOrbitalEccentricity: profile.eccentricity ?? 0,
    distanceBasis: "satellite-parent-orbit",
    visualRadius,
    baseVisualRadius: visualRadius,
    physicalDiameterKm: diameterKm,
    diameterEarths: diameterKm / 12_756,
    volumeEarths: Math.pow(diameterKm / 12_756, 3),
    sizeComparison,
    focusDistance: Math.max(0.44, visualRadius * 6.5),
    minFocusDistance: Math.max(0.32, visualRadius * 4.8),
    focusEase: 0.10,
    focusFov: 30,
    info: {
      // Keep the evidence tier visible on the compact focus card instead of
      // making visitors open the full dossier to discover that this is not
      // resolved spacecraft imagery.
      type: "Unresolved satellite reconstruction",
      diameter: `${diameterPrefix}${diameterKm.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })} km`,
      orbitalSpeed: profile.orbitalSpeed,
      distanceFromEarth: `Varies with ${parentName}'s orbit`,
      sizeComparison,
      surfaceEvidence: profile.surfaceEvidence
        ?? "Unresolved telescopic point source · scientifically guided visual reconstruction",
      roughness: Number.isFinite(profile.surfaceRoughness)
        ? Number(profile.surfaceRoughness).toFixed(2)
        : "Family reconstruction",
      description: scientificDescription || `${profile.name} is a satellite of ${parentName}.`,
    },
  };
  return target;
}

function denseGeometrySeed(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/**
 * Makes one sealed low-cost rock geometry for an unresolved-moon family.
 *
 * Hundreds of provisional moons still share InstancedMesh draw calls, but no
 * longer share one perfect icosahedron. Four deterministic variants provide
 * rounded crater rubble, contact-like lobes, flattened slabs, and tapered
 * shards. Per-moon scale and rotation below add another layer of variation.
 */
function createDenseSatelliteGeometry(key, quality) {
  // High quality uses one extra shared subdivision. This costs only four
  // reusable geometries for Saturn, while preventing unresolved moons from
  // looking faceted when a viewer opens one from the moon atlas.
  const detail = quality === "low" ? 1 : quality === "medium" ? 2 : 3;
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute("position");
  const point = new THREE.Vector3();
  const variant = Number(String(key).split(":").at(-1)) || 0;
  const seed = denseGeometrySeed(key);

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).normalize();
    const longitude = Math.atan2(point.z, point.x);
    const broad = Math.sin(point.x * (3.1 + seed) + point.y * 2.7 + point.z * 4.3);
    const medium = Math.sin(longitude * (5 + variant) + point.y * 9.0 + seed * 8.0);
    let radius = 1 + broad * 0.055 + medium * 0.022;
    let x = point.x;
    let y = point.y;
    let z = point.z;

    if (variant === 0) {
      // A round but battered pebble, useful for the quietest provisional bodies.
      const shallowBasin = Math.max(0, 1 - Math.hypot(point.x - 0.26, point.y + 0.10) / 0.42);
      radius -= shallowBasin * shallowBasin * 0.070;
    } else if (variant === 1) {
      // Unequal lobes and a pinched waist produce a compact contact-binary cue.
      const leftLobe = Math.max(0, -point.x) * Math.max(0, 1 - Math.abs(point.y) * 0.55);
      const rightLobe = Math.max(0, point.x) * Math.max(0, 1 - Math.abs(point.y) * 0.65);
      const waist = Math.exp(-Math.pow(point.x / 0.24, 2)) * (1 - Math.abs(point.y) * 0.30);
      radius *= 1 + leftLobe * 0.075 + rightLobe * 0.115 - waist * 0.060;
    } else if (variant === 2) {
      // A flattened rubble slab with a chipped crown and real side thickness.
      y *= 0.80;
      z *= 0.90;
      radius *= 1 - Math.max(0, point.y) * Math.max(0, -medium) * 0.055;
    } else {
      // A tapered angular shard; radial deformation keeps every triangle sealed.
      const taper = Math.max(0, point.x) * 0.13;
      const blockiness = Math.pow(
        Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)),
        0.62,
      );
      radius *= 0.955 + blockiness * 0.070;
      y *= 1 - taper;
      z *= 1 - taper * 0.72;
    }

    positions.setXYZ(index, x * radius, y * radius, z * radius);
  }

  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createDenseSatelliteFields(profiles, parentRadius, parentName, quality) {
  const grouped = new Map();
  profiles.forEach((profile) => {
    const appearance = profile.appearance ?? profile.family ?? "background";
    // Saturn's unresolved catalogue receives four volumetric families. Other
    // planet systems keep their existing single-family batching.
    const variant = parentName === "Saturn" ? (profile.denseVariant ?? 0) : 0;
    const key = `${appearance}:${variant}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(profile);
  });

  return [...grouped.entries()].map(([key, records]) => {
    const geometry = createDenseSatelliteGeometry(key, quality);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0,
      // Keep tiny unresolved bodies responsive to real directional sunlight at
      // system scale. Slightly stronger image-based response restores readable
      // day-side colour while emissive remains zero and the night side stays dark.
      envMapIntensity: 0.055,
      emissive: 0x000000,
      emissiveIntensity: 0,
      dithering: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    mesh.name = `${parentName} ${key} background satellites`;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const targetsGroup = new THREE.Group();
    targetsGroup.name = `${parentName} ${key} satellite interaction anchors`;

    const fieldRecords = records.map((profile, index) => {
      denseMoonColour.set(profile.color ?? profile.colour ?? 0x666666);
      const tint = 0.96 + ((profile.seed ?? index * 0.137) % 1) * 0.20;
      denseMoonColour.multiplyScalar(tint);
      mesh.setColorAt(index, denseMoonColour);
      const target = createDenseSatelliteInteractionTarget(profile, parentName);
      targetsGroup.add(target);
      return {
        profile,
        target,
        angle: profile.meanAnomaly ?? ((index / Math.max(1, records.length)) * Math.PI * 2),
        semiMajorVisualRadius: parentRadius * profile.orbitScale,
        // A stable presentation lane separates enlarged catalogue previews in
        // atlas mode. It does not alter the moon's scientific orbit metadata.
        presentationLane: Math.floor(denseGeometrySeed(profile.name) * 13) - 6,
      };
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    return {
      key,
      mesh,
      targetsGroup,
      records: fieldRecords,
      parentName,
      parentRadius,
      quality,
    };
  });
}

/**
 * Hydrates one high-detail reconstruction only when its catalogue anchor is
 * focused. Orbit view stays instanced; inspection receives real terrain,
 * sunlight-responsive material, and a reused artistic albedo from the existing
 * Saturn texture library.
 */
function ensureDenseSatelliteInspectionMesh(field, record) {
  if (field.parentName !== "Saturn" || !record.target) return null;
  if (record.inspectionMesh) return record.inspectionMesh;

  const inspectionMesh = createSaturnianMoonSurface(
    record.profile,
    field.quality ?? "high",
  );
  const visualRadius = Number(record.profile.visualRadius ?? 0.02);
  inspectionMesh.scale.setScalar(visualRadius);
  inspectionMesh.rotation.set(
    (record.profile.seed ?? 0) * 0.7,
    record.angle * (record.profile.retrograde ? -0.37 : 0.37),
    (record.profile.seed ?? 0) * 0.4,
  );
  inspectionMesh.visible = false;
  inspectionMesh.raycast = () => {};
  inspectionMesh.userData.ignoreInteraction = true;
  record.target.add(inspectionMesh);
  record.target.userData.inspectionSurface = inspectionMesh;
  record.target.userData.surfaceModel = "saturnian-lazy-scientific-reconstruction";
  record.target.userData.reconstructionTextureSource =
    record.profile.reconstructionTextureSource ?? null;
  record.inspectionMesh = inspectionMesh;
  return inspectionMesh;
}

function updateDenseSatelliteField(
  field,
  motionScale = 0,
  orbitPresentationScale = 1,
  visualBoost = 1,
  hoveredBody = null,
  focusedBody = null,
) {
  if (!field.mesh.visible && motionScale !== 0) return;
  field.records.forEach((record, index) => {
    const { profile, semiMajorVisualRadius } = record;
    const isHeld = record.target === hoveredBody || record.target === focusedBody;
    if (!isHeld) record.angle += (profile.speed ?? 0) * motionScale;
    const radius = orbitRadiusAtAngle(semiMajorVisualRadius, getVisualOrbitEccentricity(profile), record.angle);
    orbitPoint.set(Math.cos(record.angle) * radius, 0, -Math.sin(record.angle) * radius);
    orbitPoint.applyAxisAngle(orbitTiltAxis, profile.inclination ?? 0);
    orbitPoint.applyAxisAngle(THREE.Object3D.DEFAULT_UP, profile.node ?? 0);

    // Complete-system overview keeps the scientific ordering and orbital
    // inclination, but compresses the enormous irregular-moon distances into a
    // readable cinematic map. The ordinary close view always eases back to 1.
    denseMoonDummy.position.copy(orbitPoint).multiplyScalar(orbitPresentationScale);
    // Atlas mode enlarges the complete distant catalog so every moon can be
    // discovered. Once one moon is selected, restore that inspected instance
    // to its normal authored radius immediately; otherwise the camera arrives
    // before the overview boost has eased away and the rock fills the screen.
    const bodyVisualBoost = record.target === focusedBody ? 1 : visualBoost;
    const overviewMix = THREE.MathUtils.smoothstep(visualBoost, 1.08, 2.2);
    if (overviewMix > 0 && record.presentationLane) {
      denseMoonDummy.position.y += (
        record.presentationLane
        * Number(field.parentRadius ?? 1)
        * 0.025
        * overviewMix
      );
    }
    const isFocused = record.target === focusedBody;
    const inspectionMesh = isFocused
      ? ensureDenseSatelliteInspectionMesh(field, record)
      : record.inspectionMesh;
    if (inspectionMesh) inspectionMesh.visible = isFocused;
    if (record.target) {
      record.target.position.copy(denseMoonDummy.position);
      record.target.userData.visualRadius = Number(
        record.target.userData.baseVisualRadius ?? profile.visualRadius ?? 0.02,
      ) * bodyVisualBoost;
    }
    denseMoonDummy.rotation.set(
      (profile.seed ?? 0) * 0.7,
      record.angle * (profile.retrograde ? -0.37 : 0.37),
      (profile.seed ?? 0) * 0.4,
    );
    const shape = profile.shape ?? [1, 1, 1];
    // Most recently discovered Saturnian moons are only a fraction of a pixel
    // at system scale. A restrained overview-only boost keeps every catalogue
    // entry visible without replacing the efficient instanced representation.
    const radiusScale = (profile.visualRadius ?? 0.02) * bodyVisualBoost;
    if (isFocused && inspectionMesh) {
      // The textured child now owns the selected moon's pixels. Collapse only
      // this instance to prevent the preview and inspection meshes overlapping.
      denseMoonDummy.scale.setScalar(0.000001);
    } else {
      denseMoonDummy.scale.set(
        radiusScale * shape[0],
        radiusScale * shape[1],
        radiusScale * shape[2],
      );
    }
    denseMoonDummy.updateMatrix();
    field.mesh.setMatrixAt(index, denseMoonDummy.matrix);
  });
  field.mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Builds the requested moon systems without modifying any parent planet mesh.
 *
 * `parentNames` lets the application construct distant systems between frames.
 * Their geometry and scientific presentation stay identical; only the moment
 * at which each off-screen system is prepared changes.
 */
export function createMajorSatelliteSystems({
  world,
  planets,
  hoverTargets,
  quality = "high",
  parentNames = null,
  deferDirectBodies = false,
}) {
  const {
    texture: sharedTexture,
    geometry: sharedGeometry,
  } = getSharedSatelliteResources(quality);
  const systems = [];
  const requestedParents = parentNames ? new Set(parentNames) : null;

  Object.entries(MOON_SYSTEMS).forEach(([parentName, moonProfiles], systemIndex) => {
    if (requestedParents && !requestedParents.has(parentName)) return;
    const parent = planets.find((planet) => planet.name === parentName);
    if (!parent) return;

    const parentRadius = parent.userData.visualRadius ?? 1;
    // The catalogue ordinal is independent of label priority or current screen
    // position. A moon therefore keeps the same number throughout the journey.
    const catalogueOrdinalByName = new Map(
      moonProfiles.map((profile, index) => [profile.name, index + 1]),
    );
    const root = new THREE.Group();
    root.name = `${parentName} major satellite system`;
    root.position.copy(parent.position);
    root.rotation.z = parent.rotation.z;
    root.userData = {
      parentName,
      satelliteCount: moonProfiles.length,
      catalogueCount: parentName === "Jupiter"
        ? JUPITER_MOON_COUNT
        : parentName === "Saturn"
          ? SATURN_MOON_COUNT
          : parentName === "Neptune"
            ? NEPTUNE_MOON_COUNT
            : parentName === "Uranus"
              ? URANUS_MOON_COUNT
              : parentName === "Pluto"
                ? PLUTO_MOON_COUNT
                : moonProfiles.length,
      officiallyRecognizedCount: parentName === "Jupiter"
        ? JUPITER_IAU_RECOGNIZED_COUNT
        : moonProfiles.length,
    };
    // Uranus's 24 small moons become sub-pixel objects in the complete system
    // portrait. One shared material lets their restrained location glints fade
    // together without changing any moon surface, sunlight, or close-up model.
    const distantMoonGlintMaterial = parentName === "Uranus"
      ? createUranianDistantVisibilityMaterial()
      : null;
    root.add(createOrbitLines(
      moonProfiles,
      parentRadius,
      quality,
      parentName === "Uranus"
        ? {
          color: 0x6f8894,
          opacity: 0.038,
        }
        : {},
    ));
    let atlasOrbitGuides = null;
    let atlasOrbitHighlight = null;
    let atlasOrbitHighlightInnerHalo = null;
    let atlasOrbitHighlightOuterHalo = null;
    if (["Jupiter", "Saturn", "Uranus", "Neptune"].includes(parentName)) {
      atlasOrbitGuides = createOrbitLines(
        moonProfiles,
        parentRadius,
        quality,
        {
          includeEveryOrbit: true,
          name: "Complete satellite atlas orbit guides",
          color: parentName === "Saturn"
            ? 0x9dbfff
            : parentName === "Uranus"
              ? 0x67899a
              : parentName === "Neptune"
                ? 0x65baff
                : 0x91e9ff,
          opacity: parentName === "Saturn"
            ? 0.055
            : parentName === "Uranus"
              ? 0.028
              : parentName === "Neptune"
                ? 0.060
                : 0.065,
          // Neptune's innermost moons receive presentation-only spacing in the
          // reveal-all atlas so their orbits clear the planet's visible limb.
          useAtlasOrbitScale: parentName === "Neptune",
        },
      );
      atlasOrbitGuides.visible = false;
      atlasOrbitGuides.renderOrder = 1;
      root.add(atlasOrbitGuides);

      // One reusable neon path follows whichever directory entry is hovered.
      // Reusing a single LineLoop avoids adding 285 extra draw calls.
      atlasOrbitHighlight = new THREE.LineLoop(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: parentName === "Saturn"
            ? 0xb9d6ff
            : parentName === "Uranus"
              ? 0xb5ffff
              : parentName === "Neptune"
                ? 0xa8e5ff
                : 0x8ff8ff,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      atlasOrbitHighlight.name = "Hovered satellite atlas orbit";
      atlasOrbitHighlight.visible = false;
      atlasOrbitHighlight.renderOrder = 7;
      root.add(atlasOrbitHighlight);

      // Neptune's first three moons occupy extremely tightly packed inner
      // orbits. Once the complete system is compressed into atlas mode, those
      // paths can land only a pixel or two apart and the normal one-pixel hover
      // line visually disappears into its neighbouring guides. Two very faint
      // concentric halo paths are reserved for those three inner moons only.
      // They preserve the true centreline while making the selected orbit read
      // with the same immediate glow as the Jovian/Saturnian/Uranian atlases.
      if (parentName === "Neptune") {
        const createInnerOrbitHalo = (name, scaleMultiplier, opacity) => {
          const halo = new THREE.LineLoop(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
              color: 0x67d8ff,
              transparent: true,
              opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              depthTest: true,
              toneMapped: false,
            }),
          );
          halo.name = name;
          halo.visible = false;
          halo.renderOrder = 6;
          halo.userData.presentationScaleMultiplier = scaleMultiplier;
          root.add(halo);
          return halo;
        };

        atlasOrbitHighlightInnerHalo = createInnerOrbitHalo(
          "Hovered Neptune inner satellite orbit inner halo",
          0.988,
          0.28,
        );
        atlasOrbitHighlightOuterHalo = createInnerOrbitHalo(
          "Hovered Neptune inner satellite orbit outer halo",
          1.012,
          0.34,
        );
      }
    }

    let maximumOrbitRadius = 0;
    const directProfiles = moonProfiles.filter((profile) => !profile.instanced);
    const denseProfiles = moonProfiles.filter((profile) => profile.instanced);
    const moons = [];

    // Orbit radius is metadata, so it can be complete before expensive surface
    // geometry is hydrated. Camera encounter logic therefore remains stable
    // throughout progressive construction.
    directProfiles.forEach((profile) => {
      const semiMajorVisualRadius = parentRadius * profile.orbitScale;
      maximumOrbitRadius = Math.max(
        maximumOrbitRadius,
        semiMajorVisualRadius * (1 + Math.min(0.86, profile.eccentricity ?? 0)),
      );
    });

    const buildDirectSatellite = (profile, index) => {
      const orbitNode = new THREE.Group();
      orbitNode.rotation.y = profile.node ?? 0;

      const orbitPlane = new THREE.Group();
      orbitPlane.rotation.z = profile.inclination ?? 0;

      const pivot = new THREE.Group();
      pivot.rotation.y = profile.meanAnomaly
        ?? ((index / Math.max(1, directProfiles.length)) * Math.PI * 2 + systemIndex * 0.73);

      const satellite = createSatelliteMesh(
        profile,
        parentName,
        parentRadius,
        sharedGeometry,
        sharedTexture,
        quality,
      );
      const { moon, hitTarget, semiMajorVisualRadius } = satellite;
      moon.userData.catalogueOrdinal = catalogueOrdinalByName.get(profile.name);
      moon.userData.catalogueTotal = moonProfiles.length;
      if (deferDirectBodies) {
        // A progressively hydrated body starts hidden. The screen-space
        // visibility pass enables it only when its parent system is legible,
        // preventing an off-screen texture upload from stalling the opening.
        moon.visible = false;
        if (hitTarget) hitTarget.visible = false;
      }

      pivot.add(moon);
      if (hitTarget) pivot.add(hitTarget);
      let distantVisibilityGlint = null;
      if (
        distantMoonGlintMaterial
        && Number(moon.userData?.visualRadius ?? 0) <= 0.115
      ) {
        distantVisibilityGlint = new THREE.Sprite(distantMoonGlintMaterial);
        distantVisibilityGlint.name = `${profile.name} distant sunlight glint`;
        // sizeAttenuation=false makes this a stable ~3–4 px cue rather than a
        // second enlarged moon. The soft outer pixels disappear into space.
        distantVisibilityGlint.scale.set(0.0105, 0.0105, 1);
        distantVisibilityGlint.position.copy(moon.position);
        distantVisibilityGlint.visible = false;
        distantVisibilityGlint.renderOrder = 3;
        distantVisibilityGlint.raycast = () => {};
        distantVisibilityGlint.userData.ignoreInteraction = true;
        pivot.add(distantVisibilityGlint);
      }
      orbitPlane.add(pivot);
      orbitNode.add(orbitPlane);
      root.add(orbitNode);

      // Jupiter's 115-moon catalogue deliberately avoids 115 broad raycast
      // proxies. Eight resolved regular moons use direct geometry/proxies; the
      // remaining moons use a visibility-aware screen-space selector below.
      if (!isJovianProfile(profile, parentName) || getJovianInteractionTier(profile) === "direct") {
        hoverTargets.push(moon);
        if (hitTarget) hoverTargets.push(hitTarget);
      }

      const hydratedSatellite = {
        ...satellite,
        orbitNode,
        orbitPlane,
        pivot,
        speed: profile.speed,
        // These authored values let overview mode enlarge tiny moons without
        // permanently mutating their close-inspection scale.
        baseMoonScale: moon.scale.clone(),
        baseHitTargetScale: hitTarget?.scale.clone() ?? null,
        baseVisualRadius: Number(moon.userData?.visualRadius ?? 0),
        distantVisibilityGlint,
      };
      moons.push(hydratedSatellite);
      return hydratedSatellite;
    };

    const pendingDirectSatellites = deferDirectBodies
      ? directProfiles.map((profile, index) => ({ profile, index }))
      : [];
    if (!deferDirectBodies) {
      directProfiles.forEach(buildDirectSatellite);
    }

    const denseFields = createDenseSatelliteFields(denseProfiles, parentRadius, parentName, quality);
    denseFields.forEach((field) => {
      field.records.forEach((record) => {
        const { profile, semiMajorVisualRadius } = record;
        if (record.target) {
          record.target.userData.catalogueOrdinal = catalogueOrdinalByName.get(profile.name);
          record.target.userData.catalogueTotal = moonProfiles.length;
        }
        maximumOrbitRadius = Math.max(
          maximumOrbitRadius,
          semiMajorVisualRadius * (1 + Math.min(0.86, profile.eccentricity ?? 0)),
        );
      });
      updateDenseSatelliteField(field, 0);
      root.add(field.mesh);
      root.add(field.targetsGroup);
    });

    world.add(root);
    const system = {
      parent,
      parentName,
      root,
      moons,
      denseFields,
      maximumOrbitRadius,
      quality,
      pendingDirectSatellites,
      atlasOrbitGuides,
      atlasOrbitHighlight,
      atlasOrbitHighlightInnerHalo,
      atlasOrbitHighlightOuterHalo,
      distantMoonGlintMaterial,
      // Presentation-only values animate between the natural close-up layout
      // and the complete catalogue map. They never alter orbital metadata.
      orbitPresentationScale: 1,
      satelliteVisualBoost: 1,
      /**
       * Builds at most one resolved moon. Keeping the closure here avoids
       * duplicating the scientifically-authored factory selection in main.js.
       */
      hydrateNextSatellite() {
        const pending = pendingDirectSatellites.shift();
        if (!pending) return null;
        return buildDirectSatellite(pending.profile, pending.index);
      },
    };
    systems.push(system);
  });

  return systems;
}

/** Hydrates one resolved moon and reports whether that system has work left. */
export function hydrateNextMajorSatellite(system) {
  if (!system?.hydrateNextSatellite) return null;
  const satellite = system.hydrateNextSatellite();
  if (!satellite) return null;
  return {
    system,
    satellite,
    remaining: system.pendingDirectSatellites?.length ?? 0,
  };
}

/**
 * Returns how strongly the camera is currently inside Jupiter's compressed
 * satellite region. main.js uses this to disable pointer parallax and perform
 * hover acquisition on the next animation frame, matching the asteroid-belt
 * stability strategy without globally slowing the scene.
 */
export function getJovianSatelliteEncounterIntensity({
  systems,
  camera,
  viewportHeight,
  focusedBody = null,
}) {
  const system = systems.find((candidate) => candidate.parentName === "Jupiter");
  if (!system || !camera) return 0;

  system.parent.getWorldPosition(parentWorldPosition);
  const cameraDistance = Math.max(0.0001, camera.position.distanceTo(parentWorldPosition));
  const focalPixels = Math.max(1, viewportHeight) * 0.5
    / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  const systemRadiusPixels = system.maximumOrbitRadius / cameraDistance * focalPixels;
  const focusedInJupiterSystem = focusedBody === system.parent
    || focusedBody?.userData?.parentPlanet === "Jupiter";
  if (focusedInJupiterSystem) return 1;
  return THREE.MathUtils.smoothstep(systemRadiusPixels, 14, 110);
}

/**
 * Finds a visible Jovian moon without adding all 115 bodies to the global
 * raycaster. This keeps Jupiter's dense system discoverable but prevents broad
 * invisible hit spheres from fighting over the green focus marker.
 */
export function findNearestJovianSatelliteAtPointer({
  systems,
  pointer,
  camera,
  viewportWidth,
  viewportHeight,
  focusedBody = null,
}) {
  const system = systems.find((candidate) => candidate.parentName === "Jupiter");
  if (!system || !pointer || !camera) return null;

  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const focalPixels = height * 0.5
    / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));

  system.parent.getWorldPosition(parentWorldPosition);
  const parentCameraDistance = Math.max(0.0001, camera.position.distanceTo(parentWorldPosition));
  const parentVisualRadius = Number(system.parent.userData?.visualRadius ?? 1);
  const parentRadiusPixels = parentVisualRadius / parentCameraDistance * focalPixels;
  const systemRadiusPixels = system.maximumOrbitRadius / parentCameraDistance * focalPixels;
  const focusedInJupiterSystem = focusedBody === system.parent
    || focusedBody?.userData?.parentPlanet === "Jupiter";

  // At broad Solar-System scale the irregular moons are intentionally treated
  // as a region rather than 107 invisible click targets. They progressively
  // become discoverable as Jupiter and its satellite system become legible.
  const encounterActive = focusedInJupiterSystem
    || parentRadiusPixels >= 1.35
    || systemRadiusPixels >= 22;
  if (!encounterActive) return null;

  const deepEncounter = focusedInJupiterSystem
    || parentCameraDistance <= system.maximumOrbitRadius * 3.1
    || systemRadiusPixels >= 92;

  projectedParentPosition.copy(parentWorldPosition).project(camera);
  const pointerX = pointer.x;
  const pointerY = pointer.y;
  let nearest = null;
  let nearestScore = Infinity;

  system.moons.forEach(({ moon, profile }) => {
    if (moon === focusedBody) return;

    const tier = moon.userData?.interactionTier ?? "background";
    if (tier === "background" && !deepEncounter) return;

    moon.getWorldPosition(moonWorldPosition);
    projectedMoonPosition.copy(moonWorldPosition).project(camera);
    if (projectedMoonPosition.z < -1 || projectedMoonPosition.z > 1) return;

    const moonCameraDistance = Math.max(0.0001, camera.position.distanceTo(moonWorldPosition));
    const visualRadius = Number(moon.userData?.visualRadius ?? 0);
    const radiusPixels = visualRadius / moonCameraDistance * focalPixels;
    const minimumVisibleRadius = tier === "direct" ? 0.10 : tier === "notable" ? 0.16 : 0.24;
    if (radiusPixels < minimumVisibleRadius) return;

    const dx = (projectedMoonPosition.x - pointerX) * width * 0.5;
    const dy = (projectedMoonPosition.y - pointerY) * height * 0.5;
    const distancePixels = Math.hypot(dx, dy);

    // Ignore moons hidden behind Jupiter's opaque disk.
    const parentDx = (projectedMoonPosition.x - projectedParentPosition.x) * width * 0.5;
    const parentDy = (projectedMoonPosition.y - projectedParentPosition.y) * height * 0.5;
    const projectedParentSeparation = Math.hypot(parentDx, parentDy);
    if (moonCameraDistance > parentCameraDistance
      && projectedParentSeparation < Math.max(0, parentRadiusPixels - radiusPixels * 0.35)) {
      return;
    }

    const extraPixels = tier === "direct"
      ? (radiusPixels >= 5 ? 3.0 : 7.5)
      : tier === "notable"
        ? (radiusPixels >= 3 ? 3.5 : 6.0)
        : (radiusPixels >= 2 ? 2.5 : 4.25);
    const maximumRadius = tier === "direct" ? 20 : tier === "notable" ? 14 : 9.5;
    const hitRadius = Math.min(maximumRadius, Math.max(radiusPixels + extraPixels, 3.5));
    if (distancePixels > hitRadius) return;

    const tierBias = tier === "direct" ? -0.22 : tier === "notable" ? -0.08 : 0;
    const visibilityBias = -Math.min(0.20, radiusPixels * 0.025);
    const depthBias = THREE.MathUtils.clamp(
      (moonCameraDistance - parentCameraDistance) / Math.max(1, system.maximumOrbitRadius),
      -0.08,
      0.12,
    );
    const orbitGuideBias = profile.showOrbitGuide ? -0.025 : 0;
    const score = distancePixels / Math.max(1, hitRadius)
      + tierBias
      + visibilityBias
      + depthBias
      + orbitGuideBias;

    if (score < nearestScore) {
      nearest = moon;
      nearestScore = score;
    }
  });

  return nearest;
}

/**
 * Resolves one moon drawn inside a dense InstancedMesh.
 *
 * The major planet silhouette is still tested first in main.js. This helper is
 * intentionally screen-space based so hundreds of invisible raycast spheres do
 * not overlap Saturn or compete with one another.
 */
export function findNearestDenseSatelliteAtPointer({
  systems,
  pointer,
  camera,
  viewportWidth,
  viewportHeight,
  focusedBody = null,
  overviewParentName = null,
}) {
  if (!pointer || !camera) return null;
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const focalPixels = height * 0.5
    / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  let nearest = null;
  let nearestScore = Infinity;

  systems.forEach((system) => {
    if (!(system.denseFields?.length > 0)) return;

    system.parent.getWorldPosition(parentWorldPosition);
    const parentCameraDistance = Math.max(
      0.0001,
      camera.position.distanceTo(parentWorldPosition),
    );
    const parentVisualRadius = Number(system.parent.userData?.visualRadius ?? 1);
    const parentRadiusPixels = parentVisualRadius / parentCameraDistance * focalPixels;
    const systemRadiusPixels = system.maximumOrbitRadius
      * Number(system.orbitPresentationScale ?? 1)
      / parentCameraDistance
      * focalPixels;
    const focusedInSystem = focusedBody === system.parent
      || focusedBody?.userData?.parentPlanet === system.parentName;
    const overviewActive = overviewParentName === system.parentName;

    if (!focusedInSystem && !overviewActive && systemRadiusPixels < 28) return;

    projectedParentPosition.copy(parentWorldPosition).project(camera);

    system.denseFields.forEach((field) => {
      if (!field.mesh.visible) return;
      field.records.forEach(({ target, profile }) => {
        if (!target?.parent || target === focusedBody) return;

        target.getWorldPosition(moonWorldPosition);
        projectedMoonPosition.copy(moonWorldPosition).project(camera);
        if (projectedMoonPosition.z < -1 || projectedMoonPosition.z > 1) return;

        const moonCameraDistance = Math.max(
          0.0001,
          camera.position.distanceTo(moonWorldPosition),
        );
        const visualRadius = Number(target.userData?.visualRadius ?? 0.02);
        const radiusPixels = visualRadius / moonCameraDistance * focalPixels;
        if (radiusPixels < (focusedInSystem || overviewActive ? 0.12 : 0.24)) return;

        const dx = (projectedMoonPosition.x - pointer.x) * width * 0.5;
        const dy = (projectedMoonPosition.y - pointer.y) * height * 0.5;
        const distancePixels = Math.hypot(dx, dy);

        // An outer moon behind Saturn must not steal a click from the visibly
        // opaque planet disk.
        const parentDx = (projectedMoonPosition.x - projectedParentPosition.x) * width * 0.5;
        const parentDy = (projectedMoonPosition.y - projectedParentPosition.y) * height * 0.5;
        const parentSeparation = Math.hypot(parentDx, parentDy);
        if (moonCameraDistance > parentCameraDistance
          && parentSeparation < Math.max(0, parentRadiusPixels - radiusPixels * 0.35)) {
          return;
        }

        const hitRadius = Math.min(
          11,
          Math.max(4.25, radiusPixels + (overviewActive ? 4.4 : 3.4)),
        );
        if (distancePixels > hitRadius) return;

        const depthBias = THREE.MathUtils.clamp(
          (moonCameraDistance - parentCameraDistance)
            / Math.max(1, system.maximumOrbitRadius),
          -0.06,
          0.10,
        );
        const sizeBias = -Math.min(0.16, radiusPixels * 0.035);
        const guideBias = profile.showOrbitGuide ? -0.03 : 0;
        const score = distancePixels / hitRadius + depthBias + sizeBias + guideBias;
        if (score < nearestScore) {
          nearest = target;
          nearestScore = score;
        }
      });
    });
  });

  return nearest;
}

/**
 * Applies a screen-space visibility budget to Jupiter's dense 115-moon system.
 * At broad Solar-System scale the unresolved moons are sub-pixel points, so
 * drawing every sculpted mesh wastes GPU work and can force a runtime-quality
 * downgrade. The full catalogue progressively appears as the camera enters the
 * Jovian region, while hovered/focused moons always remain visible.
 */
export function updateMajorSatelliteVisibility({
  systems,
  camera,
  viewportHeight,
  focusedBody = null,
  hoveredBody = null,
  overviewParentName = null,
}) {
  if (!camera) return;
  const focalPixels = Math.max(1, viewportHeight) * 0.5
    / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));

  systems.forEach((system) => {
    system.parent.getWorldPosition(parentWorldPosition);
    const parentDistance = Math.max(0.0001, camera.position.distanceTo(parentWorldPosition));
    const parentRadius = Number(system.parent.userData?.visualRadius ?? 1);
    const parentRadiusPixels = parentRadius / parentDistance * focalPixels;
    const systemRadiusPixels = system.maximumOrbitRadius / parentDistance * focalPixels;
    const focusedInSystem = focusedBody === system.parent
      || focusedBody?.userData?.parentPlanet === system.parentName;
    const overviewActive = overviewParentName === system.parentName;

    // Tiny Uranian moons are physically present but become smaller than one
    // pixel in the broad portrait. Fade in a neutral reflected-light glint only
    // across that middle-distance window. It fades at close range, disappears
    // in the explicit atlas (where real meshes are enlarged), and never appears
    // while an individual moon is being inspected.
    let distantMoonGlintOpacity = 0;
    if (system.parentName === "Uranus" && system.distantMoonGlintMaterial) {
      const focusedOnUranianMoon = focusedBody?.userData?.parentPlanet === "Uranus";
      const systemReadable = THREE.MathUtils.smoothstep(systemRadiusPixels, 18, 52);
      const planetReadable = THREE.MathUtils.smoothstep(parentRadiusPixels, 0.65, 3.4);
      const closeRangeFade = 1 - THREE.MathUtils.smoothstep(parentRadiusPixels, 86, 150);
      distantMoonGlintOpacity = (!overviewActive && !focusedOnUranianMoon)
        ? 0.82 * systemReadable * planetReadable * closeRangeFade
        : 0;
      system.distantMoonGlintMaterial.opacity = distantMoonGlintOpacity;
    }

    const orbitGuides = system.root.children.find(
      (child) => child.name === "Major satellite orbit guides",
    );
    if (orbitGuides) {
      orbitGuides.visible = !overviewActive && (focusedInSystem || systemRadiusPixels >= 12);
    }
    if (system.atlasOrbitGuides) {
      system.atlasOrbitGuides.visible = overviewActive && focusedBody === system.parent;
    }
    if (system.atlasOrbitHighlight && !overviewActive) {
      system.atlasOrbitHighlight.visible = false;
    }
    if (!overviewActive) {
      if (system.atlasOrbitHighlightInnerHalo) system.atlasOrbitHighlightInnerHalo.visible = false;
      if (system.atlasOrbitHighlightOuterHalo) system.atlasOrbitHighlightOuterHalo.visible = false;
    }

    (system.denseFields ?? []).forEach((field) => {
      const focusedDenseMoon = focusedBody?.userData?.isDenseSatellite
        && focusedBody?.userData?.parentPlanet === system.parentName;
      field.mesh.visible = overviewActive
        || focusedDenseMoon
        || (!focusedInSystem
          && systemRadiusPixels >= (system.parentName === "Saturn" ? 34 : 72));
    });

    system.moons.forEach(({ moon, hitTarget, distantVisibilityGlint }) => {
      const held = moon === focusedBody || moon === hoveredBody;
      if (system.parentName !== "Jupiter") {
        moon.getWorldPosition(moonWorldPosition);
        const moonDistance = Math.max(0.0001, camera.position.distanceTo(moonWorldPosition));
        const visualRadius = Number(moon.userData?.visualRadius ?? 0);
        const radiusPixels = visualRadius / moonDistance * focalPixels;
        const visible = held
          || focusedInSystem
          || parentRadiusPixels >= 0.48
          || radiusPixels >= 0.11;
        if (moon.visible !== visible) moon.visible = visible;
        if (hitTarget && hitTarget.visible !== visible) hitTarget.visible = visible;
        if (distantVisibilityGlint) {
          distantVisibilityGlint.visible = visible
            && !held
            && distantMoonGlintOpacity > 0.018;
        }
        return;
      }

      const focusedOnParent = focusedBody === system.parent;
      const focusedOnSatellite = focusedBody?.userData?.parentPlanet === system.parentName;
      const tier = moon.userData?.interactionTier ?? "background";
      let visible = held;

      if (!visible) {
        if (focusedOnSatellite) {
          // Once one moon is being inspected, the selected high-detail surface
          // owns the frame. Keeping 114 unrelated bodies fully visible was the
          // main source of the second lag spike after clicking a satellite.
          visible = tier === "direct";
        } else if (overviewActive) {
          // Jupiter inspection still reveals the complete catalogue, but every
          // moon is now a lightweight preview mesh rather than a maximum-detail
          // sculpt. This preserves the populated-system effect without the v4
          // million-triangle cost.
          visible = true;
        } else if (focusedOnParent) {
          // The ordinary Jupiter portrait is reserved for the eight resolved
          // regular moons. Irregular populations belong to the complete atlas;
          // otherwise they appear detached at the edges of a close planet shot.
          visible = tier === "direct";
        } else {
          moon.getWorldPosition(moonWorldPosition);
          const moonDistance = Math.max(0.0001, camera.position.distanceTo(moonWorldPosition));
          const visualRadius = Number(moon.userData?.visualRadius ?? 0);
          const radiusPixels = visualRadius / moonDistance * focalPixels;

          if (tier === "direct") {
            visible = parentRadiusPixels >= 0.55 || radiusPixels >= 0.16;
          } else if (tier === "notable") {
            visible = systemRadiusPixels >= 18 && radiusPixels >= 0.055;
          } else {
            visible = systemRadiusPixels >= 72 && radiusPixels >= 0.055;
          }
        }
      }

      if (moon.visible !== visible) moon.visible = visible;
      if (hitTarget && hitTarget.visible !== visible) hitTarget.visible = visible;
    });
  });
}

/**
 * Draws one bright orbital path for the moon currently hovered in the atlas
 * directory. The complete catalogue remains a single quiet LineSegments mesh;
 * this reusable LineLoop is rebuilt only when the hovered directory entry
 * changes, so highlighting an orbit does not add hundreds of draw calls.
 */
export function setSatelliteAtlasOrbitHighlight(systems, body = null) {
  systems.forEach((system) => {
    if (system.atlasOrbitHighlight) system.atlasOrbitHighlight.visible = false;
    if (system.atlasOrbitHighlightInnerHalo) system.atlasOrbitHighlightInnerHalo.visible = false;
    if (system.atlasOrbitHighlightOuterHalo) system.atlasOrbitHighlightOuterHalo.visible = false;

    // Restore Neptune's quiet atlas guides after the pointer leaves a moon.
    // The stored value is captured from the authored atlas material, so this
    // does not change Jupiter, Saturn, Uranus, or Neptune's normal view.
    if (system.atlasOrbitGuides?.material
      && Number.isFinite(system.atlasOrbitGuides.userData?.hoverBaseOpacity)) {
      system.atlasOrbitGuides.material.opacity = system.atlasOrbitGuides.userData.hoverBaseOpacity;
    }
  });
  if (!body) return;

  const parentName = body.userData?.parentPlanet;
  const system = systems.find((candidate) => candidate.parentName === parentName);
  if (!system?.atlasOrbitHighlight) return;

  const directEntry = system.moons.find(({ moon }) => moon === body);
  let profile = directEntry?.profile ?? null;
  if (!profile) {
    for (const field of system.denseFields ?? []) {
      const record = field.records.find(({ target }) => target === body);
      if (record) {
        profile = record.profile;
        break;
      }
    }
  }
  if (!profile) return;

  const parentRadius = Number(system.parent.userData?.visualRadius ?? 1);
  const semiMajorRadius = parentRadius * Number(
    system.parentName === "Neptune"
      ? (profile.atlasOrbitScale ?? profile.orbitScale ?? 1)
      : (profile.orbitScale ?? 1),
  );
  const inclination = Number(profile.inclination ?? 0);
  const node = Number(profile.node ?? 0);
  const segments = system.quality === "low" ? 96 : system.quality === "medium" ? 128 : 160;
  const positions = new Float32Array(segments * 3);

  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    const radius = orbitRadiusAtAngle(semiMajorRadius, getVisualOrbitEccentricity(profile), angle);
    orbitPoint.set(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius);
    orbitPoint.applyAxisAngle(orbitTiltAxis, inclination);
    orbitPoint.applyAxisAngle(THREE.Object3D.DEFAULT_UP, node);
    positions[index * 3] = orbitPoint.x;
    positions[index * 3 + 1] = orbitPoint.y;
    positions[index * 3 + 2] = orbitPoint.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  system.atlasOrbitHighlight.geometry.dispose();
  system.atlasOrbitHighlight.geometry = geometry;
  system.atlasOrbitHighlight.scale.setScalar(system.orbitPresentationScale);
  system.atlasOrbitHighlight.visible = true;

  const isNeptuneInnerPackedOrbit = system.parentName === "Neptune"
    && ["Naiad", "Thalassa", "Despina"].includes(profile.name);

  if (system.parentName === "Neptune" && system.atlasOrbitGuides?.material) {
    if (!Number.isFinite(system.atlasOrbitGuides.userData?.hoverBaseOpacity)) {
      system.atlasOrbitGuides.userData.hoverBaseOpacity = Number(
        system.atlasOrbitGuides.material.opacity ?? 0.060,
      );
    }
    // The first three orbit radii differ by only a few percent. Temporarily
    // quiet the complete catalogue while one of them is hovered, otherwise the
    // selected cyan centreline is visually swallowed by its two neighbours.
    system.atlasOrbitGuides.material.opacity = isNeptuneInnerPackedOrbit ? 0.014 : 0.038;
    system.atlasOrbitHighlight.material.opacity = isNeptuneInnerPackedOrbit ? 1.0 : 0.94;
  }

  if (isNeptuneInnerPackedOrbit) {
    [
      system.atlasOrbitHighlightInnerHalo,
      system.atlasOrbitHighlightOuterHalo,
    ].forEach((halo) => {
      if (!halo) return;
      const haloGeometry = geometry.clone();
      halo.geometry.dispose();
      halo.geometry = haloGeometry;
      halo.scale.setScalar(
        system.orbitPresentationScale
        * Number(halo.userData?.presentationScaleMultiplier ?? 1),
      );
      halo.visible = true;
    });
  }
}

export function updateMajorSatelliteSystems(
  systems,
  motionScale = 1,
  {
    hoveredBody = null,
    focusedBody = null,
    overviewParentName = null,
  } = {},
) {
  systems.forEach((system) => {
    system.root.position.copy(system.parent.position);
    const overviewActive = overviewParentName === system.parentName;
    const parentRadius = Number(system.parent.userData?.visualRadius ?? 1);
    // Uranus's innermost moons shepherd its narrow rings, so atlas mode must
    // never apply a second uniform shrink that pulls those measured orbits
    // back through the ring plane. Widen only the atlas camera framing to fit
    // the most eccentric distant moon while leaving every Uranian orbit at its
    // catalogue-derived display radius.
    const overviewRadiusMultiplier = system.parentName === "Saturn"
      ? 7.20
      : system.parentName === "Uranus"
        ? Math.max(
          9.30,
          (Number(system.maximumOrbitRadius ?? 0) / Math.max(0.001, parentRadius)) * 1.04,
        )
        : 6.80;
    const overviewMaximumRadius = parentRadius * overviewRadiusMultiplier;
    const targetOrbitScale = overviewActive
      ? Math.min(1, overviewMaximumRadius / Math.max(0.001, system.maximumOrbitRadius))
      : 1;
    const targetVisualBoost = overviewActive
      ? (system.parentName === "Saturn" ? 6.2 : 5.4)
      : 1;

    // A slow ease makes the population unfold as one coherent orbital atlas
    // instead of snapping hundreds of bodies to new positions in one frame.
    system.orbitPresentationScale = THREE.MathUtils.lerp(
      Number(system.orbitPresentationScale ?? 1),
      targetOrbitScale,
      0.075,
    );
    system.satelliteVisualBoost = THREE.MathUtils.lerp(
      Number(system.satelliteVisualBoost ?? 1),
      targetVisualBoost,
      0.09,
    );

    const orbitGuides = system.root.children.find(
      (child) => child.name === "Major satellite orbit guides",
    );
    if (orbitGuides) orbitGuides.scale.setScalar(system.orbitPresentationScale);
    if (system.atlasOrbitGuides) {
      system.atlasOrbitGuides.scale.setScalar(system.orbitPresentationScale);
    }
    if (system.atlasOrbitHighlight) {
      system.atlasOrbitHighlight.scale.setScalar(system.orbitPresentationScale);
    }
    [system.atlasOrbitHighlightInnerHalo, system.atlasOrbitHighlightOuterHalo].forEach((halo) => {
      if (!halo) return;
      halo.scale.setScalar(
        system.orbitPresentationScale
        * Number(halo.userData?.presentationScaleMultiplier ?? 1),
      );
    });

    (system.denseFields ?? []).forEach((field) => updateDenseSatelliteField(
      field,
      motionScale,
      system.orbitPresentationScale,
      system.satelliteVisualBoost,
      hoveredBody,
      focusedBody,
    ));

    system.moons.forEach(({
      moon,
      hitTarget,
      pivot,
      speed,
      profile,
      semiMajorVisualRadius,
      baseMoonScale,
      baseHitTargetScale,
      baseVisualRadius,
      distantVisibilityGlint,
    }, index) => {
      const isFocused = moon === focusedBody;
      const isHeld = moon === hoveredBody || isFocused;

      if (system.parentName === "Jupiter") {
        // Only the selected moon owns the dense geometry, procedural bump map,
        // and inspection-light layer. The other 114 remain cheap previews.
        setJovianMoonInspectionDetail(moon, isFocused);
      }

      if (!isHeld) {
        pivot.rotation.y += speed * motionScale;
        if (!moon.userData.tidallyLocked) {
          const spinDirection = profile.retrograde ? -1 : 1;
          if (profile.chaoticTumble && Array.isArray(profile.tumbleRate)) {
            moon.rotation.x += profile.tumbleRate[0] * motionScale;
            moon.rotation.y += spinDirection * profile.tumbleRate[1] * motionScale;
            moon.rotation.z += profile.tumbleRate[2] * motionScale;
          } else {
            moon.rotation.y += spinDirection * (0.0025 + index * 0.000013) * motionScale;
          }
        }
      }

      // Resolved moons keep their authored proportions. Only the tiny notable
      // and background populations receive a visibility lift in the overview.
      const interactionTier = moon.userData?.interactionTier ?? "direct";
      const tierBoost = interactionTier === "background"
        ? system.satelliteVisualBoost
        : interactionTier === "notable"
          ? THREE.MathUtils.lerp(1, system.satelliteVisualBoost, 0.52)
          : 1;
      if (baseMoonScale) moon.scale.copy(baseMoonScale).multiplyScalar(tierBoost);
      if (Number.isFinite(baseVisualRadius)) {
        moon.userData.visualRadius = baseVisualRadius * tierBoost;
      }
      if (hitTarget && baseHitTargetScale) {
        hitTarget.scale.copy(baseHitTargetScale).multiplyScalar(tierBoost);
      }

      // Hidden sub-pixel moons still advance their analytical orbit angle, but
      // do not rewrite object matrices until they are needed again.
      if (moon.visible || isHeld) {
        const presentationSemiMajorVisualRadius = overviewActive && system.parentName === "Neptune"
          ? parentRadius * Number(profile.atlasOrbitScale ?? profile.orbitScale ?? 1)
          : semiMajorVisualRadius;
        moon.position.x = orbitRadiusAtAngle(
          presentationSemiMajorVisualRadius,
          getVisualOrbitEccentricity(profile),
          pivot.rotation.y,
        ) * system.orbitPresentationScale;
        // Full-catalogue mode deliberately enlarges sub-pixel moons. Give each
        // one a stable vertical presentation lane so those enlarged previews
        // cannot occupy the same 3D volume and appear to collide.
        const presentationLane = Math.floor(denseGeometrySeed(profile.name) * 13) - 6;
        const targetPresentationY = overviewActive
          ? presentationLane * parentRadius * 0.025
          : 0;
        moon.position.y = THREE.MathUtils.lerp(
          moon.position.y,
          targetPresentationY,
          overviewActive ? 0.20 : 0.26,
        );
        if (hitTarget) hitTarget.position.copy(moon.position);
        if (distantVisibilityGlint) distantVisibilityGlint.position.copy(moon.position);
      }
    });
  });
}

import * as THREE from "three";
import { makeNoiseTexture } from "../../graphics/proceduralTextures.js";
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
  JUPITER_MOON_COUNT,
  JUPITER_MOON_PROFILES,
} from "../jupiter/satellites/jovianMoonCatalog.js";
import { createJovianMoonSurface } from "../jupiter/satellites/jovianMoonFactory.js";

const MOON_SYSTEMS = Object.freeze({
  Mars: [
    PHOBOS_PROFILE,
    DEIMOS_PROFILE,
  ],
  Jupiter: JUPITER_MOON_PROFILES,
  Saturn: [
    { name: "Mimas", diameterKm: 396.4, orbitScale: 2.48, speed: 0.014, inclination: 0.02, color: 0xb8b3a9, orbitalSpeed: "14.28 km/s around Saturn", description: "A small icy moon dominated by the enormous Herschel impact crater." },
    { name: "Enceladus", diameterKm: 504.2, orbitScale: 2.78, speed: 0.012, inclination: 0.025, color: 0xe2e7e8, orbitalSpeed: "12.64 km/s around Saturn", description: "A bright icy moon venting water-rich plumes from a subsurface ocean." },
    { name: "Tethys", diameterKm: 1_062.2, orbitScale: 3.16, speed: 0.0096, inclination: 0.03, color: 0xc8c7c1, orbitalSpeed: "11.35 km/s around Saturn", description: "An ice-rich moon crossed by the immense Ithaca Chasma canyon system." },
    { name: "Dione", diameterKm: 1_122.8, orbitScale: 3.55, speed: 0.0078, inclination: 0.035, color: 0xaaa9a3, orbitalSpeed: "10.03 km/s around Saturn", description: "A cratered icy moon with bright tectonic cliffs and signs of a deep ocean." },
    { name: "Rhea", diameterKm: 1_527.6, orbitScale: 4.05, speed: 0.0060, inclination: 0.04, color: 0xb7b6b0, orbitalSpeed: "8.48 km/s around Saturn", description: "Saturn's second-largest moon, an old icy surface marked by craters and wispy fractures." },
    { name: "Titan", diameterKm: 5_149.5, orbitScale: 5.05, speed: 0.0038, inclination: 0.05, color: 0xc98d42, atmosphere: 0xd7a44e, orbitalSpeed: "5.57 km/s around Saturn", description: "A giant moon wrapped in nitrogen haze, with methane lakes, rain, dunes, and a hidden ocean." },
    { name: "Iapetus", diameterKm: 1_469.0, orbitScale: 6.35, speed: 0.0024, inclination: 0.16, color: 0x756d63, orbitalSpeed: "3.26 km/s around Saturn", description: "A distant two-toned moon with a bright hemisphere, dark coating, and dramatic equatorial ridge." },
  ],
  Uranus: [
    { name: "Miranda", diameterKm: 471.6, orbitScale: 2.35, speed: 0.011, inclination: 0.07, color: 0xa9afae, orbitalSpeed: "6.68 km/s around Uranus", description: "A small icy moon whose patchwork surface contains giant cliffs and jumbled coronae." },
    { name: "Ariel", diameterKm: 1_157.8, orbitScale: 2.85, speed: 0.0084, inclination: 0.05, color: 0xc1c8c6, orbitalSpeed: "5.51 km/s around Uranus", description: "A bright Uranian moon carved by long valleys and relatively young icy terrain." },
    { name: "Umbriel", diameterKm: 1_169.4, orbitScale: 3.32, speed: 0.0067, inclination: 0.04, color: 0x555b5d, orbitalSpeed: "4.67 km/s around Uranus", description: "A dark, heavily cratered moon with one conspicuously bright ring-shaped feature." },
    { name: "Titania", diameterKm: 1_577.8, orbitScale: 3.95, speed: 0.0048, inclination: 0.045, color: 0x949b9c, orbitalSpeed: "3.64 km/s around Uranus", description: "The largest Uranian moon, fractured by faults and canyons across an icy-rocky surface." },
    { name: "Oberon", diameterKm: 1_522.8, orbitScale: 4.60, speed: 0.0039, inclination: 0.055, color: 0x7d7872, orbitalSpeed: "3.15 km/s around Uranus", description: "An outer moon marked by old craters, dark floors, and bright ejecta rays." },
  ],
  Neptune: [
    { name: "Proteus", diameterKm: 420, orbitScale: 2.25, speed: 0.010, inclination: 0.04, color: 0x64666b, shape: [1.12, 0.93, 0.89], orbitalSpeed: "7.62 km/s around Neptune", description: "A dark, irregular inner moon, among the largest bodies not rounded by its own gravity." },
    { name: "Triton", diameterKm: 2_706.8, orbitScale: 3.05, speed: -0.0052, inclination: 0.30, color: 0xb9aaa4, orbitalSpeed: "4.39 km/s retrograde around Neptune", description: "A captured dwarf-planet-like moon with nitrogen frost, geysers, and a retrograde orbit." },
    { name: "Nereid", diameterKm: 340, orbitScale: 4.65, speed: 0.0016, inclination: 0.12, color: 0x777b80, shape: [1.12, 0.90, 0.86], orbitalSpeed: "≈ 1.1 km/s around Neptune", description: "A distant irregular moon travelling on one of the most eccentric satellite orbits known." },
  ],
});

const PARENT_ORBITAL_SCALE = Object.freeze({
  Mars: { heliocentricAU: 1.5237, eccentricity: 0.0934 },
  Jupiter: { heliocentricAU: 5.2029, eccentricity: 0.0484 },
  Saturn: { heliocentricAU: 9.5367, eccentricity: 0.0539 },
  Uranus: { heliocentricAU: 19.1892, eccentricity: 0.0473 },
  Neptune: { heliocentricAU: 30.0699, eccentricity: 0.0086 },
});

const orbitPoint = new THREE.Vector3();
const orbitTiltAxis = new THREE.Vector3(0, 0, 1);
const parentWorldPosition = new THREE.Vector3();
const moonWorldPosition = new THREE.Vector3();
const projectedParentPosition = new THREE.Vector3();
const projectedMoonPosition = new THREE.Vector3();

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
  if (!isJovianProfile(profile, parentName)) return true;
  return getJovianInteractionTier(profile) === "direct";
}

function orbitRadiusAtAngle(semiMajorRadius, eccentricity, angle) {
  const safeEccentricity = THREE.MathUtils.clamp(Number(eccentricity) || 0, 0, 0.86);
  if (safeEccentricity <= 0.0001) return semiMajorRadius;
  return semiMajorRadius * (1 - safeEccentricity * safeEccentricity)
    / Math.max(0.08, 1 + safeEccentricity * Math.cos(angle));
}

function createOrbitLines(moons, parentRadius, quality = "high") {
  const positions = [];
  const segments = quality === "low" ? 64 : quality === "medium" ? 96 : 128;

  moons.forEach((moon) => {
    if (moon.showOrbitGuide === false) return;

    const semiMajorRadius = parentRadius * moon.orbitScale;
    const inclination = moon.inclination ?? 0;
    const node = moon.node ?? 0;

    for (let index = 0; index < segments; index += 1) {
      const a = index / segments * Math.PI * 2;
      const b = (index + 1) / segments * Math.PI * 2;
      const radiusA = orbitRadiusAtAngle(semiMajorRadius, moon.eccentricity, a);
      const radiusB = orbitRadiusAtAngle(semiMajorRadius, moon.eccentricity, b);

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
    color: 0x9bc6d9,
    transparent: true,
    opacity: 0.10,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = "Major satellite orbit guides";
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
  } else {
    moon = new THREE.Mesh(sharedGeometry, createMoonMaterial(profile, sharedTexture));
  }

  moon.name = profile.name;
  const shape = profile.shape ?? [1, 1, 1];
  moon.scale.set(
    visualRadius * shape[0],
    visualRadius * shape[1],
    visualRadius * shape[2],
  );
  const semiMajorVisualRadius = parentRadius * profile.orbitScale;
  moon.position.x = orbitRadiusAtAngle(
    semiMajorVisualRadius,
    profile.eccentricity,
    profile.meanAnomaly ?? 0,
  );
  if (profile.initialRotation) moon.rotation.set(...profile.initialRotation);

  const orbitalScale = PARENT_ORBITAL_SCALE[parentName];
  const sizeComparison = getSizeComparisonText({ diameterKm: profile.diameterKm, name: profile.name });
  const jovian = isJovianProfile(profile, parentName);
  const interactionTier = jovian ? getJovianInteractionTier(profile) : "direct";
  const diameterPrefix = profile.diameterEstimated ? "≈ " : "";
  const scientificDescription = [profile.description, profile.orbitSummary, profile.dataNote]
    .filter(Boolean)
    .join(" ");

  moon.userData = {
    name: profile.name,
    detail: jovian
      ? `${profile.family} | Jupiter satellite ${profile.jplCode}`
      : `${parentName} satellite | Earth-relative size preserved`,
    parentPlanet: parentName,
    isSatellite: true,
    isJovianSatellite: jovian,
    satelliteFamily: profile.family ?? null,
    interactionTier,
    heliocentricAU: orbitalScale.heliocentricAU,
    orbitalEccentricity: orbitalScale.eccentricity,
    satelliteOrbitalEccentricity: profile.eccentricity ?? 0,
    distanceBasis: "satellite-parent-orbit",
    tidallyLocked: Boolean(profile.tidallyLocked),
    surfaceModel: parentName === "Mars"
      ? "terrain-first-3d"
      : jovian
        ? "jovian-individual-3d"
        : "shared-satellite-sphere",
    visualRadius: Math.max(...moon.scale.toArray()),
    physicalDiameterKm: profile.diameterKm,
    diameterEarths: profile.diameterKm / 12_756,
    volumeEarths: Math.pow(profile.diameterKm / 12_756, 3),
    sizeComparison,
    focusDistance: Math.max(0.90, visualRadius * (jovian ? 5.2 : 4.6)),
    minFocusDistance: Math.max(0.72, visualRadius * (jovian ? 4.15 : 3.7)),
    focusEase: 0.11,
    focusFov: parentName === "Mars" ? 36 : 34,
    info: {
      type: "Natural satellite",
      diameter: profile.dimensions
        ? `${profile.dimensions} · ${diameterPrefix}${profile.diameterKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} km mean`
        : `${diameterPrefix}${profile.diameterKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} km`,
      orbitalSpeed: profile.orbitalSpeed,
      distanceFromEarth: `Varies with ${parentName}'s orbit`,
      sizeComparison,
      description: scientificDescription || profile.description,
    },
  };

  if (profile.atmosphere) {
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
    const hitRadius = Math.max(visualRadius * (jovian ? 1.55 : 1.9), jovian ? 0.10 : 0.14);
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

/** Builds every configured moon without modifying any parent planet mesh. */
export function createMajorSatelliteSystems({ world, planets, hoverTargets, quality = "high" }) {
  const textureSize = quality === "low" ? 384 : quality === "medium" ? 512 : 768;
  const sphereSegments = quality === "low" ? [32, 24] : quality === "medium" ? [44, 32] : [56, 40];
  const sharedTexture = makeNoiseTexture("moon", textureSize);
  const sharedGeometry = new THREE.SphereGeometry(1, sphereSegments[0], sphereSegments[1]);
  const systems = [];

  Object.entries(MOON_SYSTEMS).forEach(([parentName, moonProfiles], systemIndex) => {
    const parent = planets.find((planet) => planet.name === parentName);
    if (!parent) return;

    const parentRadius = parent.userData.visualRadius ?? 1;
    const root = new THREE.Group();
    root.name = `${parentName} major satellite system`;
    root.position.copy(parent.position);
    root.rotation.z = parent.rotation.z;
    root.userData = {
      parentName,
      satelliteCount: moonProfiles.length,
      catalogueCount: parentName === "Jupiter" ? JUPITER_MOON_COUNT : moonProfiles.length,
    };
    root.add(createOrbitLines(moonProfiles, parentRadius, quality));

    let maximumOrbitRadius = 0;
    const moons = moonProfiles.map((profile, index) => {
      const orbitNode = new THREE.Group();
      orbitNode.rotation.y = profile.node ?? 0;

      const orbitPlane = new THREE.Group();
      orbitPlane.rotation.z = profile.inclination ?? 0;

      const pivot = new THREE.Group();
      pivot.rotation.y = profile.meanAnomaly
        ?? ((index / moonProfiles.length) * Math.PI * 2 + systemIndex * 0.73);

      const satellite = createSatelliteMesh(
        profile,
        parentName,
        parentRadius,
        sharedGeometry,
        sharedTexture,
        quality,
      );
      const { moon, hitTarget, semiMajorVisualRadius } = satellite;
      maximumOrbitRadius = Math.max(
        maximumOrbitRadius,
        semiMajorVisualRadius * (1 + Math.min(0.86, profile.eccentricity ?? 0)),
      );

      pivot.add(moon);
      if (hitTarget) pivot.add(hitTarget);
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

      return {
        ...satellite,
        orbitNode,
        orbitPlane,
        pivot,
        speed: profile.speed,
      };
    });

    world.add(root);
    systems.push({
      parent,
      parentName,
      root,
      moons,
      maximumOrbitRadius,
    });
  });

  return systems;
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
}) {
  if (!camera) return;
  const focalPixels = Math.max(1, viewportHeight) * 0.5
    / Math.max(0.0001, Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));

  systems.forEach((system) => {
    if (system.parentName !== "Jupiter") return;

    system.parent.getWorldPosition(parentWorldPosition);
    const parentDistance = Math.max(0.0001, camera.position.distanceTo(parentWorldPosition));
    const parentRadius = Number(system.parent.userData?.visualRadius ?? 1);
    const parentRadiusPixels = parentRadius / parentDistance * focalPixels;
    const systemRadiusPixels = system.maximumOrbitRadius / parentDistance * focalPixels;
    const focusedInSystem = focusedBody === system.parent
      || focusedBody?.userData?.parentPlanet === "Jupiter";

    const orbitGuides = system.root.children.find(
      (child) => child.name === "Major satellite orbit guides",
    );
    if (orbitGuides) orbitGuides.visible = focusedInSystem || systemRadiusPixels >= 12;

    system.moons.forEach(({ moon, hitTarget }) => {
      const held = moon === focusedBody || moon === hoveredBody;
      let visible = held;

      if (!visible) {
        moon.getWorldPosition(moonWorldPosition);
        const moonDistance = Math.max(0.0001, camera.position.distanceTo(moonWorldPosition));
        const visualRadius = Number(moon.userData?.visualRadius ?? 0);
        const radiusPixels = visualRadius / moonDistance * focalPixels;
        const tier = moon.userData?.interactionTier ?? "background";

        if (tier === "direct") {
          visible = focusedInSystem
            || parentRadiusPixels >= 0.55
            || radiusPixels >= 0.16;
        } else if (tier === "notable") {
          visible = focusedInSystem
            || (systemRadiusPixels >= 18 && radiusPixels >= 0.055);
        } else {
          visible = focusedInSystem
            ? radiusPixels >= 0.018
            : systemRadiusPixels >= 72 && radiusPixels >= 0.055;
        }
      }

      if (moon.visible !== visible) moon.visible = visible;
      if (hitTarget && hitTarget.visible !== visible) hitTarget.visible = visible;
    });
  });
}

export function updateMajorSatelliteSystems(
  systems,
  motionScale = 1,
  { hoveredBody = null, focusedBody = null } = {},
) {
  systems.forEach((system) => {
    system.root.position.copy(system.parent.position);
    system.root.updateMatrixWorld(true);

    system.moons.forEach(({
      moon,
      hitTarget,
      pivot,
      speed,
      profile,
      semiMajorVisualRadius,
    }, index) => {
      const isHeld = moon === hoveredBody || moon === focusedBody;
      if (!isHeld) {
        pivot.rotation.y += speed * motionScale;
        if (!moon.userData.tidallyLocked) {
          const spinDirection = profile.retrograde ? -1 : 1;
          moon.rotation.y += spinDirection * (0.0025 + index * 0.000013) * motionScale;
        }
      }

      moon.position.x = orbitRadiusAtAngle(
        semiMajorVisualRadius,
        profile.eccentricity,
        pivot.rotation.y,
      );
      if (hitTarget) hitTarget.position.copy(moon.position);
    });
  });
}

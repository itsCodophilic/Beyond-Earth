import * as THREE from "three";
import { makeNoiseTexture } from "../../graphics/proceduralTextures.js";
import { getMoonVisualRadius, getSizeComparisonText } from "../../config/celestialScale.js";

const MOON_SYSTEMS = Object.freeze({
  Mars: [
    { name: "Phobos", diameterKm: 22.2, orbitScale: 1.75, speed: 0.024, inclination: 0.02, color: 0x81766c, shape: [1.25, 0.86, 0.78], orbitalSpeed: "2.14 km/s around Mars", description: "The larger, deeply cratered inner moon of Mars, slowly spiralling toward the planet." },
    { name: "Deimos", diameterKm: 12.4, orbitScale: 2.75, speed: 0.008, inclination: 0.04, color: 0x9a9082, shape: [1.16, 0.90, 0.84], orbitalSpeed: "1.35 km/s around Mars", description: "Mars's small outer moon, a dark irregular body with a smoother blanket of impact debris." },
  ],
  Jupiter: [
    { name: "Io", diameterKm: 3_643.2, orbitScale: 1.78, speed: 0.0125, inclination: 0.01, color: 0xd9b15a, orbitalSpeed: "17.33 km/s around Jupiter", description: "A volcanic world reshaped by intense tidal heating, sulphur plains, and towering eruptions." },
    { name: "Europa", diameterKm: 3_121.6, orbitScale: 2.20, speed: 0.0095, inclination: 0.02, color: 0xc8b895, orbitalSpeed: "13.74 km/s around Jupiter", description: "An ice-covered ocean world traced by reddish fractures and possible water-plume activity." },
    { name: "Ganymede", diameterKm: 5_268.2, orbitScale: 2.82, speed: 0.0064, inclination: 0.03, color: 0x858078, orbitalSpeed: "10.88 km/s around Jupiter", description: "The largest moon in the Solar System, bigger than Mercury and possessing its own magnetic field." },
    { name: "Callisto", diameterKm: 4_820.6, orbitScale: 3.70, speed: 0.0042, inclination: 0.04, color: 0x5d5751, orbitalSpeed: "8.20 km/s around Jupiter", description: "An ancient, dark, heavily cratered world preserving a record of early Solar System impacts." },
  ],
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

function createOrbitLines(moons, parentRadius) {
  const positions = [];
  const segments = 128;
  moons.forEach((moon) => {
    const orbitRadius = parentRadius * moon.orbitScale;
    const cosTilt = Math.cos(moon.inclination ?? 0);
    const sinTilt = Math.sin(moon.inclination ?? 0);
    for (let index = 0; index < segments; index += 1) {
      const a = index / segments * Math.PI * 2;
      const b = (index + 1) / segments * Math.PI * 2;
      const ax = Math.cos(a) * orbitRadius;
      const az = Math.sin(a) * orbitRadius;
      const bx = Math.cos(b) * orbitRadius;
      const bz = Math.sin(b) * orbitRadius;
      positions.push(ax, -az * sinTilt, az * cosTilt, bx, -bz * sinTilt, bz * cosTilt);
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
    color: profile.color,
    roughness: 0.98,
    metalness: 0,
    envMapIntensity: 0.04,
  });
}

function createSatelliteMesh(profile, parentName, parentRadius, sharedGeometry, sharedTexture) {
  const visualRadius = getMoonVisualRadius(profile.diameterKm, {
    minimum: profile.diameterKm < 50 ? 0.045 : 0.055,
    maximum: 0.68,
  });
  const material = createMoonMaterial(profile, sharedTexture);
  const moon = new THREE.Mesh(sharedGeometry, material);
  moon.name = profile.name;
  const shape = profile.shape ?? [1, 1, 1];
  moon.scale.set(
    visualRadius * shape[0],
    visualRadius * shape[1],
    visualRadius * shape[2],
  );
  moon.position.x = parentRadius * profile.orbitScale;

  const orbitalScale = PARENT_ORBITAL_SCALE[parentName];
  const sizeComparison = getSizeComparisonText({ diameterKm: profile.diameterKm, name: profile.name });
  moon.userData = {
    name: profile.name,
    detail: `${parentName} satellite | Earth-relative size preserved`,
    parentPlanet: parentName,
    isSatellite: true,
    heliocentricAU: orbitalScale.heliocentricAU,
    orbitalEccentricity: orbitalScale.eccentricity,
    distanceBasis: "satellite-parent-orbit",
    visualRadius: Math.max(...moon.scale.toArray()),
    physicalDiameterKm: profile.diameterKm,
    diameterEarths: profile.diameterKm / 12_756,
    volumeEarths: Math.pow(profile.diameterKm / 12_756, 3),
    sizeComparison,
    focusDistance: Math.max(0.90, visualRadius * 4.6),
    minFocusDistance: Math.max(0.72, visualRadius * 3.7),
    focusEase: 0.11,
    focusFov: 36,
    info: {
      type: "Natural satellite",
      diameter: `${profile.diameterKm.toLocaleString("en-US", { maximumFractionDigits: 1 })} km`,
      orbitalSpeed: profile.orbitalSpeed,
      distanceFromEarth: `Varies with ${parentName}'s orbit`,
      sizeComparison,
      description: profile.description,
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

  const hitTarget = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }),
  );
  hitTarget.name = `${profile.name} interaction target`;
  const hitRadius = Math.max(visualRadius * 1.75, 0.12);
  hitTarget.scale.setScalar(hitRadius);
  moon.add(hitTarget);
  return moon;
}

/** Builds the major moon systems without changing the existing planet meshes. */
export function createMajorSatelliteSystems({ world, planets, hoverTargets }) {
  const sharedTexture = makeNoiseTexture("moon", 768);
  const sharedGeometry = new THREE.SphereGeometry(1, 56, 40);
  const systems = [];

  Object.entries(MOON_SYSTEMS).forEach(([parentName, moonProfiles], systemIndex) => {
    const parent = planets.find((planet) => planet.name === parentName);
    if (!parent) return;

    const root = new THREE.Group();
    root.name = `${parentName} major satellite system`;
    root.position.copy(parent.position);
    // Inherit the planet's axial tilt without inheriting its rapid self-spin.
    root.rotation.z = parent.rotation.z;
    root.add(createOrbitLines(moonProfiles, parent.userData.visualRadius ?? 1));

    const moons = moonProfiles.map((profile, index) => {
      const orbitPlane = new THREE.Group();
      orbitPlane.rotation.z = profile.inclination ?? 0;
      const pivot = new THREE.Group();
      pivot.rotation.y = (index / moonProfiles.length) * Math.PI * 2 + systemIndex * 0.73;
      const moon = createSatelliteMesh(
        profile,
        parentName,
        parent.userData.visualRadius ?? 1,
        sharedGeometry,
        sharedTexture,
      );
      pivot.add(moon);
      orbitPlane.add(pivot);
      root.add(orbitPlane);
      hoverTargets.push(moon);
      return { moon, pivot, speed: profile.speed };
    });

    world.add(root);
    systems.push({ parent, root, moons });
  });

  return systems;
}

export function updateMajorSatelliteSystems(systems, motionScale = 1) {
  systems.forEach((system) => {
    system.root.position.copy(system.parent.position);
    system.moons.forEach(({ moon, pivot, speed }, index) => {
      pivot.rotation.y += speed * motionScale;
      moon.rotation.y += (0.0025 + index * 0.00013) * motionScale;
    });
  });
}

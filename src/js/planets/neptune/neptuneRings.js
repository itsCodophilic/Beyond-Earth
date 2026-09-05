import * as THREE from "three";
import { markPointerProxy } from "../../scene/pointerProxies.js";

// Scratch vectors reused by the per-frame update below. Allocating a fresh
// Vector3 on every animation frame produced steady garbage-collector pressure,
// which surfaces as periodic frame-time spikes rather than a lower average FPS.
const neptuneRingWorldPosition = new THREE.Vector3();

// Ring particle level of detail -- same rule proven on Uranus, where reducing
// the drawn particle count (rather than shrinking the sprites) recovered the
// fill-rate cost without changing how the rings read.
//
// Applied by traversal rather than through the bands/dustLayers/arcLayers
// arrays, so it cannot be broken by a layer that happens to be absent.
const NEPTUNE_RING_LOD = {
  fullDetailPixels: 380,
  minimumDetailPixels: 50,
  minimumFraction: 0.16,
  hideBelowPixels: 2.4,
  showAbovePixels: 3.2,
};

function applyNeptuneRingDetail(system, projectedRadiusPixels) {
  const wasHidden = system.userData.ringDetailHidden === true;
  const hidden = wasHidden
    ? projectedRadiusPixels < NEPTUNE_RING_LOD.showAbovePixels
    : projectedRadiusPixels < NEPTUNE_RING_LOD.hideBelowPixels;
  if (hidden !== wasHidden) {
    system.userData.ringDetailHidden = hidden;
    system.traverse((object) => { if (object?.isPoints) object.visible = !hidden; });
  }
  if (hidden) return;

  const span = NEPTUNE_RING_LOD.fullDetailPixels - NEPTUNE_RING_LOD.minimumDetailPixels;
  const raw = (projectedRadiusPixels - NEPTUNE_RING_LOD.minimumDetailPixels) / Math.max(span, 1);
  const fraction = THREE.MathUtils.clamp(raw, NEPTUNE_RING_LOD.minimumFraction, 1);

  system.traverse((object) => {
    if (!object?.isPoints) return;
    const geometry = object.geometry;
    if (!geometry?.attributes?.position) return;
    const total = geometry.userData.fullDrawCount
      ?? (geometry.userData.fullDrawCount = geometry.attributes.position.count);
    if (!total) return;
    const count = fraction >= 1 ? total : Math.max(1, Math.ceil(total * fraction));
    if (geometry.drawRange.count !== count) geometry.setDrawRange(0, count);
  });
}

const TAU = Math.PI * 2;
const NEPTUNE_EQUATORIAL_RADIUS_KM = 24_764;

// NASA Science lists five principal rings. Physical widths are preserved where
// they are published; the render widths below are intentionally widened only
// enough for a faint dusty ring to remain legible at screen scale.
const RING_REGIONS = Object.freeze([
  {
    name: "Galle Ring",
    centerKm: 41_900,
    physicalWidthKm: 15,
    visualHalfWidthRadii: 0.010,
    opacity: 0.090,
    particleShare: 0.15,
    color: 0x625f5b,
    character: "Faint innermost dusty ring",
    description: "Galle is Neptune's innermost principal ring: a very faint, narrow band of dark dust orbiting well above the visible cloud tops.",
  },
  {
    name: "Le Verrier Ring",
    centerKm: 53_200,
    physicalWidthKm: 15,
    visualHalfWidthRadii: 0.011,
    opacity: 0.115,
    particleShare: 0.21,
    color: 0x76736e,
    character: "Narrow dark ring",
    description: "Le Verrier is a narrow principal ring. Its low reflectivity is consistent with Neptune's ring material being dominated by fine, dark dust rather than bright water-ice blocks like Saturn's main rings.",
  },
  {
    name: "Lassell Ring",
    centerKm: 55_400,
    physicalWidthKm: null,
    visualHalfWidthRadii: 0.045,
    opacity: 0.072,
    particleShare: 0.18,
    color: 0x55575a,
    character: "Broad diffuse dust sheet",
    description: "Lassell is a broad, diffuse component of Neptune's ring system. Up close it reads as a sparse veil of extremely dark fine particles rather than a solid reflective band.",
  },
  {
    name: "Arago Ring",
    centerKm: 57_600,
    physicalWidthKm: null,
    visualHalfWidthRadii: 0.012,
    opacity: 0.135,
    particleShare: 0.14,
    color: 0x686966,
    character: "Faint outer ringlet",
    description: "Arago is a faint ring feature outside the Lassell region. Its dust is extremely difficult to see in ordinary visible-light views and becomes clearer under favorable geometry.",
  },
  {
    name: "Adams Ring",
    centerKm: 62_930,
    physicalWidthKm: 50,
    visualHalfWidthRadii: 0.013,
    opacity: 0.082,
    particleShare: 0.32,
    color: 0x85847f,
    character: "Outermost ring with persistent arcs",
    description: "Adams is Neptune's outermost principal ring. It contains the famous persistent dust concentrations called Liberté, Egalité, Fraternité, and Courage, whose confinement is linked to the nearby moon Galatea.",
  },
]);

const ARC_REGIONS = Object.freeze([
  { name: "Liberté Arc", start: 0.17, length: 0.080, intensity: 1.00 },
  { name: "Egalité Arc", start: 0.275, length: 0.062, intensity: 0.88 },
  { name: "Fraternité Arc", start: 0.365, length: 0.104, intensity: 1.12 },
  { name: "Courage Arc", start: 0.505, length: 0.055, intensity: 0.82 },
]);

const QUALITY_PROFILES = Object.freeze({
  low: { particles: 5_600, arcParticles: 1_000 },
  medium: { particles: 8_800, arcParticles: 1_650 },
  high: { particles: 13_400, arcParticles: 2_400 },
});

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function formatKm(value) {
  return `${Math.round(value).toLocaleString("en-US")} km`;
}

function createDustBandMaterial({ innerRadius, outerRadius, color, opacity }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uColor: { value: new THREE.Color(color) },
      uBaseOpacity: { value: opacity },
      uHover: { value: 0 },
      uInspection: { value: 0 },
    },
    vertexShader: `
      varying vec2 vLocalPosition;
      void main() {
        vLocalPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      uniform vec3 uColor;
      uniform float uBaseOpacity;
      uniform float uHover;
      uniform float uInspection;
      varying vec2 vLocalPosition;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        float radius = length(vLocalPosition);
        float radial = clamp((radius - uInnerRadius) / max(0.0001, uOuterRadius - uInnerRadius), 0.0, 1.0);
        float angle = atan(vLocalPosition.y, vLocalPosition.x) / 6.28318530718 + 0.5;
        float edge = smoothstep(0.0, 0.15, radial) * (1.0 - smoothstep(0.85, 1.0, radial));

        // Several frequencies create dust lanes and incomplete dark patches,
        // avoiding the appearance of a single translucent solid disc.
        float coarse = hash21(vec2(floor(angle * 560.0), floor(radial * 24.0)));
        float fine = hash21(vec2(floor(angle * 1700.0), floor(radial * 78.0) + 19.0));
        float lane = 0.66 + 0.34 * sin(radial * 74.0 + angle * 9.0);
        float dust = mix(0.23, 1.0, coarse * 0.58 + fine * 0.42) * lane;

        // Keep Neptune's rings faint but continuously readable at every camera
        // distance. Close inspection reveals more dust without making the ring
        // sheet disappear completely.
        float distanceVisibility = mix(1.18, 0.72, uInspection);
        float baseAlpha = uBaseOpacity * edge * (0.52 + dust * 0.48) * distanceVisibility;

        // Hover must produce an unmistakable full-ring highlight rather than
        // only brightening the few dust grains directly under the pointer.
        // On hover the full ring should become very easy to read, not just slightly brighter.
        float hoverAlpha = max(uBaseOpacity * 5.0, 0.36) * edge * (0.88 + dust * 0.12);
        float alpha = mix(baseAlpha, hoverAlpha, uHover);
        vec3 hoverColour = vec3(0.78, 0.86, 0.92);
        vec3 colour = mix(uColor, hoverColour, uHover * 0.72);
        gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.72));
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: true,
  });
}

function createRingBand(radius, region) {
  const centerRadius = radius * (region.centerKm / NEPTUNE_EQUATORIAL_RADIUS_KM);
  const halfWidth = radius * region.visualHalfWidthRadii;
  const innerRadius = centerRadius - halfWidth;
  const outerRadius = centerRadius + halfWidth;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 512, 1);
  const material = createDustBandMaterial({
    innerRadius,
    outerRadius,
    color: region.color,
    opacity: region.opacity,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${region.name} faint dust band`;
  mesh.rotation.x = Math.PI * 0.5;
  mesh.renderOrder = 2;
  return mesh;
}

function createDustPoints({ radius, particleCount, ringIndex, region }) {
  const random = seededRandom(0x4e455054 + ringIndex * 131);
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const base = new THREE.Color(region.color);
  const light = new THREE.Color(0x9a9a94);

  const centerRadius = radius * (region.centerKm / NEPTUNE_EQUATORIAL_RADIUS_KM);
  const halfWidth = radius * Math.max(region.visualHalfWidthRadii * 0.92, 0.006);
  const verticalThickness = radius * (ringIndex === 2 ? 0.0019 : 0.00115);

  for (let i = 0; i < particleCount; i += 1) {
    const i3 = i * 3;
    const angle = random() * TAU;
    // Bias toward ring centre while retaining a dusty tail across the width.
    const radialOffset = (random() + random() + random() - 1.5) / 1.5 * halfWidth;
    const particleRadius = centerRadius + radialOffset;
    positions[i3] = Math.cos(angle) * particleRadius;
    positions[i3 + 1] = (random() - 0.5) * verticalThickness;
    positions[i3 + 2] = Math.sin(angle) * particleRadius;

    const shade = 0.24 + random() * 0.52;
    const c = base.clone().lerp(light, shade * 0.38).multiplyScalar(0.58 + shade * 0.52);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: radius * 0.0058,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    alphaTest: 0.015,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = `${region.name} microscopic dust particles`;
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.userData.baseOpacity = ringIndex === 4 ? 0.17 : ringIndex === 2 ? 0.13 : 0.16;
  return points;
}

function createAdamsArcs({ radius, particleCount }) {
  const adams = RING_REGIONS[RING_REGIONS.length - 1];
  const centerRadius = radius * (adams.centerKm / NEPTUNE_EQUATORIAL_RADIUS_KM);
  const halfWidth = radius * 0.0105;
  const random = seededRandom(0x41444353);
  const totalIntensity = ARC_REGIONS.reduce((sum, arc) => sum + arc.intensity, 0);
  const objects = [];

  ARC_REGIONS.forEach((arc, arcIndex) => {
    const count = Math.max(80, Math.round(particleCount * arc.intensity / totalIntensity));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const dark = new THREE.Color(0x66645f);
    const bright = new THREE.Color(0x8f928f);

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;
      // arcs are defined as fractions of one revolution for visual placement;
      // their exact longitudinal location evolves with time in the real system.
      const t = THREE.MathUtils.clamp((random() + random()) * 0.5, 0, 1);
      const angle = (arc.start + t * arc.length) * TAU;
      const r = centerRadius + (random() - 0.5) * halfWidth * 2;
      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = (random() - 0.5) * radius * 0.0016;
      positions[i3 + 2] = Math.sin(angle) * r;
      const c = dark.clone().lerp(bright, 0.16 + random() * 0.40);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: radius * 0.0060,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      alphaTest: 0.01,
    });
    const points = new THREE.Points(geometry, material);
    points.name = `${arc.name} dust clump`;
    points.frustumCulled = false;
    points.renderOrder = 4;
    // The real Adams arcs are denser than the rest of the ring, but from a
    // planetary view they should not turn one side into a bright crescent.
    // Keep them subtle until the camera is close or the Adams ring is hovered.
    points.userData.baseOpacity = 0.13 * (0.92 + arc.intensity * 0.08);
    points.userData.arcIndex = arcIndex;
    objects.push(points);
  });

  return objects;
}

function createInteractionTarget({ group, planet, radius, region, regionIndex }) {
  const centerRadius = radius * (region.centerKm / NEPTUNE_EQUATORIAL_RADIUS_KM);
  const minimumHalfWidth = radius * 0.025;
  const halfWidth = Math.max(radius * region.visualHalfWidthRadii * 1.65, minimumHalfWidth);
  const target = new THREE.Mesh(
    new THREE.RingGeometry(centerRadius - halfWidth, centerRadius + halfWidth, 320, 1),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  target.name = `${region.name} interaction field`;
  markPointerProxy(target);
  target.rotation.x = Math.PI * 0.5;
  target.renderOrder = -100;
  target.userData = {
    name: region.name,
    isPlanetRing: true,
    isNeptuneRing: true,
    ringIndex: regionIndex,
    parentPlanetObject: planet,
    info: {
      type: "Neptune ring group",
      description: region.description,
    },
    ringData: {
      systemName: "Neptune ring system",
      order: `${regionIndex + 1} of ${RING_REGIONS.length} principal rings from Neptune outward`,
      character: region.character,
      radialRange: region.physicalWidthKm
        ? `≈ ${formatKm(region.centerKm)} from Neptune's centre · ≈ ${formatKm(region.physicalWidthKm)} radial width`
        : `≈ ${formatKm(region.centerKm)} from Neptune's centre · diffuse/faint width`,
      description: region.description,
      motion: region.name === "Adams Ring"
        ? "Dark microscopic dust · outer ring hosts four persistent arcs stabilized by Galatea"
        : "Dark microscopic dust and radiation-processed carbon-rich material · independently orbiting particles",
    },
    setHovered(active) {
      group.userData.setHoveredRegion?.(active ? regionIndex : -1);
    },
  };
  group.add(target);
  return target;
}

function createArcInteractionTarget({ group, planet, radius, arc, arcIndex }) {
  const adams = RING_REGIONS[RING_REGIONS.length - 1];
  const centerRadius = radius * (adams.centerKm / NEPTUNE_EQUATORIAL_RADIUS_KM);
  const halfWidth = radius * 0.030;
  const target = new THREE.Mesh(
    new THREE.RingGeometry(
      centerRadius - halfWidth,
      centerRadius + halfWidth,
      96,
      1,
      arc.start * TAU,
      arc.length * TAU,
    ),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
    }),
  );
  target.name = `${arc.name} interaction field`;
  markPointerProxy(target);
  target.rotation.x = Math.PI * 0.5;
  target.renderOrder = -101;
  target.userData = {
    name: arc.name,
    isPlanetRing: true,
    isNeptuneRing: true,
    isNeptuneRingArc: true,
    ringIndex: RING_REGIONS.length - 1,
    arcIndex,
    parentPlanetObject: planet,
    info: {
      type: "Neptune ring arc",
      description: `${arc.name} is one of the prominent dust concentrations embedded in the Adams ring.`,
    },
    ringData: {
      systemName: "Neptune ring system · Adams ring arcs",
      order: `${arcIndex + 1} of ${ARC_REGIONS.length} prominent Adams-ring arcs`,
      character: "Persistent dust concentration",
      radialRange: `≈ ${formatKm(62_900)} from Neptune's centre`,
      description: `${arc.name} is a localized concentration of dust within the Adams ring. Neptune's arcs remain clumped instead of spreading uniformly; the gravitational influence of the nearby moon Galatea helps confine them.`,
      motion: "Dense clump within the Adams ring · confined by orbital resonances associated with Galatea",
    },
    setHovered(active) {
      group.userData.setHoveredRegion?.(active ? RING_REGIONS.length - 1 : -1, active ? arcIndex : -1);
    },
  };
  group.add(target);
  return target;
}

export function createNeptuneRingSystem({
  planet,
  radius,
  quality = "high",
  hoverTargets = [],
}) {
  const profile = QUALITY_PROFILES[quality] ?? QUALITY_PROFILES.high;
  const group = new THREE.Group();
  group.name = "Neptune five-ring dusty system with Adams arcs";

  const bands = [];
  const dustLayers = [];
  const interactionTargets = [];

  let remainingParticles = profile.particles;
  RING_REGIONS.forEach((region, regionIndex) => {
    const band = createRingBand(radius, region);
    group.add(band);
    bands.push(band);

    const count = regionIndex === RING_REGIONS.length - 1
      ? remainingParticles
      : Math.max(180, Math.round(profile.particles * region.particleShare));
    remainingParticles -= count;
    const dust = createDustPoints({ radius, particleCount: count, ringIndex: regionIndex, region });
    group.add(dust);
    dustLayers.push(dust);

    const target = createInteractionTarget({ group, planet, radius, region, regionIndex });
    interactionTargets.push(target);
  });

  const arcs = createAdamsArcs({ radius, particleCount: profile.arcParticles });
  arcs.forEach((arc) => group.add(arc));

  ARC_REGIONS.forEach((arc, arcIndex) => {
    const target = createArcInteractionTarget({ group, planet, radius, arc, arcIndex });
    interactionTargets.push(target);
  });

  group.userData.bands = bands;
  group.userData.dustLayers = dustLayers;
  group.userData.arcLayers = arcs;
  group.userData.interactionTargets = interactionTargets;
  group.userData.hoveredRegionIndex = -1;
  group.userData.hoveredArcIndex = -1;
  group.userData.targetHoveredRegionIndex = -1;
  group.userData.targetHoveredArcIndex = -1;
  group.userData.hoverStrength = 0;
  group.userData.inspection = 0;
  group.userData.setHoveredRegion = (regionIndex, arcIndex = -1) => {
    group.userData.targetHoveredRegionIndex = Number.isInteger(regionIndex) ? regionIndex : -1;
    group.userData.targetHoveredArcIndex = Number.isInteger(arcIndex) ? arcIndex : -1;
    if (regionIndex >= 0) {
      group.userData.hoveredRegionIndex = regionIndex;
      group.userData.hoveredArcIndex = arcIndex;
    }
  };
  group.userData.physicalModel = {
    neptuneEquatorialRadiusKm: NEPTUNE_EQUATORIAL_RADIUS_KM,
    principalRings: RING_REGIONS.map(({ name, centerKm, physicalWidthKm }) => ({
      name,
      centerKm,
      physicalWidthKm,
    })),
    prominentAdamsArcs: ARC_REGIONS.map(({ name }) => name),
  };

  hoverTargets.push(...interactionTargets);
  planet.add(group);
  return group;
}

export function updateNeptuneRingSystem(system, time, camera, motionScale = 1) {
  if (!system) return;

  const targetIndex = system.userData.targetHoveredRegionIndex ?? -1;
  const targetArcIndex = system.userData.targetHoveredArcIndex ?? -1;
  const hoverTarget = targetIndex >= 0 ? 1 : 0;
  system.userData.hoverStrength = THREE.MathUtils.lerp(
    system.userData.hoverStrength ?? 0,
    hoverTarget,
    hoverTarget > 0 ? 0.18 : 0.10,
  );
  if (targetIndex < 0 && system.userData.hoverStrength < 0.01) {
    system.userData.hoverStrength = 0;
    system.userData.hoveredRegionIndex = -1;
    system.userData.hoveredArcIndex = -1;
  }

  let inspection = system.userData.inspection ?? 0;
  if (camera && system.parent) {
    const worldPosition = neptuneRingWorldPosition;
    system.parent.getWorldPosition(worldPosition);
    const planetRadius = Number(system.parent.userData?.visualRadius ?? 1);
    const cameraDistance = camera.position.distanceTo(worldPosition);
    const normalizedDistance = cameraDistance / Math.max(planetRadius, 0.001);

    const focalPixels = (window.innerHeight * 0.5)
      / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    applyNeptuneRingDetail(
      system,
      ((planetRadius * 2.5) / Math.max(cameraDistance, 1e-4)) * focalPixels,
    );
    const targetInspection = 1 - THREE.MathUtils.smoothstep(normalizedDistance, 6.5, 22.0);
    inspection = THREE.MathUtils.lerp(inspection, targetInspection, 0.08);
    system.userData.inspection = inspection;
  }

  const activeIndex = system.userData.hoveredRegionIndex ?? -1;
  const hoverStrength = system.userData.hoverStrength ?? 0;

  system.userData.bands?.forEach((band, index) => {
    const isActive = activeIndex === index;
    if (band.material?.uniforms?.uHover) {
      band.material.uniforms.uHover.value = isActive ? hoverStrength : 0;
    }
    if (band.material?.uniforms?.uInspection) {
      band.material.uniforms.uInspection.value = inspection;
    }
  });

  system.userData.dustLayers?.forEach((dust, index) => {
    const base = dust.userData.baseOpacity ?? 0.12;
    const isActive = activeIndex === index;
    // Dust is intentionally subdued from far away and becomes much more
    // apparent close to Neptune, where individual dark grains should dominate.
    dust.material.opacity = THREE.MathUtils.clamp(
      base * (0.46 + inspection * 1.10) * (isActive ? 1 + hoverStrength * 3.80 : 1),
      0.025,
      0.95,
    );
    dust.rotation.y += (0.000015 + index * 0.000003) * motionScale;
  });

  system.userData.arcLayers?.forEach((arc, index) => {
    const base = arc.userData.baseOpacity ?? 0.28;
    const adamsHovered = activeIndex === RING_REGIONS.length - 1;
    const arcHovered = adamsHovered && (targetArcIndex < 0 || targetArcIndex === index);
    // Keep Adams visually uniform from far away: the arc clumps become a
    // secondary detail only as the camera approaches. Hover can reveal them,
    // but never strongly enough to overpower the continuous Adams band.
    const proximityReveal = 0.18 + inspection * 0.82;
    arc.material.opacity = THREE.MathUtils.clamp(
      base * proximityReveal * (arcHovered ? 1 + hoverStrength * 1.35 : 1),
      0.012,
      0.42,
    );
    arc.rotation.y += (0.000028 + index * 0.000002) * motionScale;
  });
}

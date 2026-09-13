import * as THREE from "three";
import { markPointerProxy } from "../../scene/pointerProxies.js";
import { ringProximityFade, applyRingProximityVisibility } from "../ringProximity.js";

/**
 * Jupiter's rings, which it does have.
 *
 * Every other giant in this scene had a real ring module and Jupiter had
 * three anonymous bands built inline in `planetFactory.js` -- unnamed,
 * unclickable, absent from the dossier's ring roster, and stopping at 1.66
 * planet radii when the real system reaches 3.2. That was the one place the
 * scene quietly disagreed with NASA about what is out there.
 *
 * The rings were found by Voyager 1 in 1979 and mapped by Galileo and New
 * Horizons. There are four components and they are nothing like Saturn's.
 * Saturn's rings are bright water ice in lumps from grains to houses;
 * Jupiter's are dust -- microscopic, dark, and continuously resupplied by
 * micrometeoroid impacts knocking material off four small inner moons. They
 * are so faint that they are best seen backlit, with the Sun behind Jupiter,
 * because forward-scattering dust lights up at high phase angles.
 *
 * The other difference worth drawing is thickness. Saturn's rings are a
 * sheet -- tens of metres thick across two hundred thousand kilometres. Two
 * of Jupiter's are torus-shaped: the halo is twelve and a half thousand
 * kilometres deep, and the Thebe gossamer ring nearly nine thousand. So the
 * dust here is given real vertical extent rather than being scattered in a
 * plane, which is the whole visual character of the system.
 */

const jupiterRingWorldPosition = new THREE.Vector3();

/*
 * Particle level of detail, the same rule proven on Uranus and Neptune:
 * reduce the drawn count rather than shrinking the sprites, which recovers
 * the fill-rate cost without changing how the rings read.
 */
const JUPITER_RING_LOD = {
  fullDetailPixels: 380,
  minimumDetailPixels: 50,
  minimumFraction: 0.16,
  hideBelowPixels: 2.4,
  showAbovePixels: 3.2,
};

function applyJupiterRingDetail(system, projectedRadiusPixels) {
  const wasHidden = system.userData.ringDetailHidden === true;
  const hidden = wasHidden
    ? projectedRadiusPixels < JUPITER_RING_LOD.showAbovePixels
    : projectedRadiusPixels < JUPITER_RING_LOD.hideBelowPixels;
  if (hidden !== wasHidden) {
    system.userData.ringDetailHidden = hidden;
    system.traverse((object) => { if (object?.isPoints) object.visible = !hidden; });
  }
  if (hidden) return;

  const span = JUPITER_RING_LOD.fullDetailPixels - JUPITER_RING_LOD.minimumDetailPixels;
  const raw = (projectedRadiusPixels - JUPITER_RING_LOD.minimumDetailPixels) / Math.max(span, 1);
  const fraction = THREE.MathUtils.clamp(raw, JUPITER_RING_LOD.minimumFraction, 1);

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
const JUPITER_EQUATORIAL_RADIUS_KM = 71_492;

/*
 * The four components, with their real inner and outer edges in kilometres
 * from Jupiter's centre and their real vertical thickness.
 *
 * `opacity` and `dustOpacity` are render values, not measurements. The true
 * optical depth of these rings is of order a millionth -- drawn honestly they
 * would be nothing at all -- so what is preserved is the *ordering*: the main
 * ring is the one you can see, the halo is a dim glow inside it, and the two
 * gossamer rings are fainter still and fade outward. Thickness, radii and
 * sources are the real numbers.
 */
/*
 * The four components, and a word about the opacities.
 *
 * The first pass used the rings' real reflectivity, which is somewhere
 * between a hundredth and a thousandth of Saturn's -- and produced exactly
 * what the physics predicts: nothing on screen, at any distance, in any
 * mode. That is faithful and useless. Every real image of these rings was
 * taken in *forward-scattered* light, with the spacecraft looking back
 * through them towards the Sun, because that is the only geometry in which
 * dust this fine is bright. Voyager 1 found the main ring in a single
 * deliberately over-exposed frame; Galileo and New Horizons did the same.
 *
 * So the numbers below depict the forward-scattering case, which is how
 * anyone has ever actually seen this system, and the dust draws additively
 * for the same reason. The *relative* brightness is kept honest: the main
 * ring is far and away the brightest, the halo is next, and the two gossamer
 * rings are the faintest things here, in that order, as they are in the data.
 */
const RING_REGIONS = Object.freeze([
  {
    name: "Halo Ring",
    innerKm: 92_000,
    outerKm: 122_500,
    thicknessKm: 12_500,
    opacity: 0.16,
    dustOpacity: 0.30,
    particleShare: 0.30,
    color: 0xa89383,
    character: "Thick inner torus of magnetically lofted dust",
    description: "The innermost and thickest component: a faint torus of fine dust extending 12,500 km above and below the ring plane. Grains drifting inward from the main ring pick up electrical charge and are pushed out of the plane by Jupiter's magnetic field, which is why this one is a doughnut rather than a disc.",
    motion: "Charged micron dust · lofted out of the ring plane by Jupiter's magnetosphere",
    source: "Inward-migrating dust from the main ring",
  },
  {
    name: "Main Ring",
    innerKm: 122_500,
    outerKm: 129_000,
    thicknessKm: 100,
    opacity: 0.42,
    dustOpacity: 0.55,
    particleShare: 0.34,
    color: 0xdcc3aa,
    character: "Narrow, flat, the one component that is readily imaged",
    description: "Narrow and remarkably thin — about 6,500 km wide and under 100 km deep. It is fed by dust blasted off Adrastea and Metis, whose orbits bracket its outer edge, and it is the brightest of the four. Voyager 1 found it in 1979 in a single deliberately over-exposed frame.",
    motion: "Dust from micrometeoroid impacts on Adrastea and Metis · thin and sharply bounded",
    source: "Adrastea and Metis",
  },
  {
    name: "Amalthea Gossamer Ring",
    innerKm: 129_000,
    outerKm: 182_000,
    thicknessKm: 2_300,
    opacity: 0.11,
    dustOpacity: 0.22,
    particleShare: 0.20,
    color: 0xbca591,
    character: "Broad faint sheet reaching Amalthea's orbit",
    description: "A very faint, very broad sheet of dust reaching out to the orbit of Amalthea, which supplies it. Its vertical extent matches Amalthea's orbital inclination — the dust inherits the moon's tilt, so the ring is as thick as that moon's path is wide.",
    motion: "Impact ejecta from Amalthea · thickness set by that moon's orbital inclination",
    source: "Amalthea",
  },
  {
    name: "Thebe Gossamer Ring",
    innerKm: 129_000,
    outerKm: 226_000,
    thicknessKm: 8_800,
    opacity: 0.080,
    dustOpacity: 0.17,
    particleShare: 0.16,
    color: 0xb09a89,
    character: "Faintest and thickest, with a tail beyond Thebe's orbit",
    description: "The faintest of the four and the furthest out, fed by Thebe. It is nearly 8,800 km thick for the same reason the Amalthea ring is 2,300 — Thebe's orbit is more steeply inclined. A fainter extension continues beyond Thebe itself, dust that has drifted outward and not yet been lost.",
    motion: "Impact ejecta from Thebe · a faint extension continues past the moon's own orbit",
    source: "Thebe",
  },
]);

const QUALITY_PROFILES = Object.freeze({
  low: { particles: 6_200 },
  medium: { particles: 9_800 },
  high: { particles: 15_000 },
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
  return `${Math.round(value).toLocaleString("en-GB")} km`;
}

function toRadii(km, radius) {
  return radius * (km / JUPITER_EQUATORIAL_RADIUS_KM);
}

/**
 * The flat sheet of each component.
 *
 * Dust rather than ice, so the shader below is the Neptune one's sibling: no
 * bright specular ice, a lot of angular unevenness, and a hover state that
 * lights the whole ring rather than the grains under the pointer.
 */
function createDustBandMaterial({ innerRadius, outerRadius, color, opacity }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uColor: { value: new THREE.Color(color) },
      uBaseOpacity: { value: opacity },
      uHover: { value: 0 },
      uInspection: { value: 0 },
      uFarFade: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec2 vLocalPosition;
      void main() {
        vLocalPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      uniform vec3 uColor;
      uniform float uBaseOpacity;
      uniform float uHover;
      uniform float uInspection;
      uniform float uFarFade;
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

        // Soft at both edges. The gossamer rings in particular have no edge
        // at all on the outside -- they simply run out of dust.
        float edge = smoothstep(0.0, 0.12, radial) * (1.0 - smoothstep(0.72, 1.0, radial));

        float coarse = hash21(vec2(floor(angle * 480.0), floor(radial * 20.0)));
        float fine = hash21(vec2(floor(angle * 1500.0), floor(radial * 64.0) + 11.0));
        float dust = mix(0.30, 1.0, coarse * 0.55 + fine * 0.45);

        // Slightly stronger close up, where the ring is resolved, rather
        // than the other way round. Folding a whole ring into a few pixels
        // already concentrates its alpha; boosting it as well is what made
        // these outshine their own planet from the system view.
        float distanceVisibility = mix(0.88, 1.10, uInspection);
        float baseAlpha = uBaseOpacity * edge * (0.54 + dust * 0.46) * distanceVisibility;

        float hoverAlpha = max(uBaseOpacity * 3.2, 0.42) * edge * (0.88 + dust * 0.12);
        float alpha = mix(baseAlpha, hoverAlpha, uHover) * uFarFade;
        vec3 hoverColour = vec3(0.98, 0.92, 0.82);
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
  const innerRadius = toRadii(region.innerKm, radius);
  const outerRadius = toRadii(region.outerKm, radius);
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

/**
 * The dust itself, and this is where Jupiter's rings stop looking like
 * Saturn's.
 *
 * Each component gets its real vertical thickness, so the halo is a fat
 * torus, the main ring is a wafer, and the two gossamer rings are slabs of
 * decreasing density. A flat sheet cannot say any of that, and thickness is
 * the single most distinctive thing about this system.
 */
function createDustPoints({ radius, particleCount, ringIndex, region }) {
  const random = seededRandom(0x4a555049 + ringIndex * 137);
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const base = new THREE.Color(region.color);
  const light = new THREE.Color(0xbdae9f);

  const innerRadius = toRadii(region.innerKm, radius);
  const outerRadius = toRadii(region.outerKm, radius);
  const halfThickness = toRadii(region.thicknessKm * 0.5, radius);

  for (let i = 0; i < particleCount; i += 1) {
    const i3 = i * 3;
    const angle = random() * TAU;

    /*
     * Where across the ring. The gossamer rings thin out steadily towards
     * their outer edge rather than ending, so their dust is weighted inward;
     * the main ring and halo are close to uniform across their width.
     */
    const across = region.name.includes("Gossamer")
      ? Math.pow(random(), 1.8)
      : random();
    const particleRadius = innerRadius + across * (outerRadius - innerRadius);

    /*
     * And how far out of the plane. Three samples summed gives a bell rather
     * than a slab, which is what a population of inclined orbits produces --
     * most of the dust near the plane, the tails reaching the full thickness.
     */
    const height = (random() + random() + random() - 1.5) / 1.5 * halfThickness;

    positions[i3] = Math.cos(angle) * particleRadius;
    positions[i3 + 1] = height;
    positions[i3 + 2] = Math.sin(angle) * particleRadius;

    const shade = 0.22 + random() * 0.55;
    const c = base.clone().lerp(light, shade * 0.40).multiplyScalar(0.56 + shade * 0.54);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: radius * 0.0105,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: region.dustOpacity,
    depthWrite: false,
    alphaTest: 0.010,
    /*
     * Additive, unlike Neptune's. Neptune's rings are dark material read
     * against a bright blue disc, where subtracting light is right. Jupiter's
     * are read against black sky in forward-scattered light, where dust adds
     * light and nothing else makes it visible at all -- see the note on
     * RING_REGIONS.
     */
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = `${region.name} microscopic dust`;
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.userData.baseOpacity = region.dustOpacity;
  return points;
}

function createInteractionTarget({ group, planet, radius, region, regionIndex }) {
  const innerRadius = toRadii(region.innerKm, radius);
  const outerRadius = toRadii(region.outerKm, radius);
  // The two gossamer rings overlap the same inner edge, so their pick fields
  // are trimmed to the part of each that is not under the other.
  const pickInner = regionIndex === 3 ? toRadii(182_000, radius) : innerRadius;
  const target = new THREE.Mesh(
    new THREE.RingGeometry(
      Math.max(pickInner, radius * 0.05),
      Math.max(outerRadius, pickInner + radius * 0.03),
      320,
      1,
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
  target.name = `${region.name} interaction field`;
  markPointerProxy(target);
  target.rotation.x = Math.PI * 0.5;
  target.renderOrder = -100;
  target.userData = {
    name: region.name,
    isPlanetRing: true,
    isJupiterRing: true,
    ringIndex: regionIndex,
    parentPlanetObject: planet,
    info: {
      type: "Jupiter ring component",
      description: region.description,
    },
    ringData: {
      systemName: "Jupiter ring system",
      order: `${regionIndex + 1} of ${RING_REGIONS.length} components from Jupiter outward`,
      character: region.character,
      radialRange: `${formatKm(region.innerKm)} to ${formatKm(region.outerKm)} from Jupiter's centre · ≈ ${formatKm(region.thicknessKm)} thick`,
      description: region.description,
      motion: region.motion,
    },
    setHovered(active) {
      group.userData.setHoveredRegion?.(active ? regionIndex : -1);
    },
  };
  group.add(target);
  return target;
}

export function createJupiterRingSystem({
  planet,
  radius,
  quality = "high",
  hoverTargets = [],
}) {
  const profile = QUALITY_PROFILES[quality] ?? QUALITY_PROFILES.high;
  const group = new THREE.Group();
  group.name = "Jupiter four-component dust ring system";

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
      : Math.max(220, Math.round(profile.particles * region.particleShare));
    remainingParticles -= count;
    const dust = createDustPoints({ radius, particleCount: count, ringIndex: regionIndex, region });
    group.add(dust);
    dustLayers.push(dust);

    interactionTargets.push(
      createInteractionTarget({ group, planet, radius, region, regionIndex }),
    );
  });

  group.userData.bands = bands;
  group.userData.dustLayers = dustLayers;
  group.userData.interactionTargets = interactionTargets;
  group.userData.hoveredRegionIndex = -1;
  group.userData.targetHoveredRegionIndex = -1;
  group.userData.hoverStrength = 0;
  group.userData.inspection = 0;
  group.userData.setHoveredRegion = (regionIndex) => {
    group.userData.targetHoveredRegionIndex = Number.isInteger(regionIndex) ? regionIndex : -1;
    if (regionIndex >= 0) group.userData.hoveredRegionIndex = regionIndex;
  };
  group.userData.physicalModel = {
    jupiterEquatorialRadiusKm: JUPITER_EQUATORIAL_RADIUS_KM,
    components: RING_REGIONS.map(({ name, innerKm, outerKm, thicknessKm, source }) => ({
      name,
      innerKm,
      outerKm,
      thicknessKm,
      source,
    })),
  };

  hoverTargets.push(...interactionTargets);
  planet.add(group);
  return group;
}

export function updateJupiterRingSystem(system, time, camera, motionScale = 1) {
  if (!system) return;

  const targetIndex = system.userData.targetHoveredRegionIndex ?? -1;
  const hoverTarget = targetIndex >= 0 ? 1 : 0;
  system.userData.hoverStrength = THREE.MathUtils.lerp(
    system.userData.hoverStrength ?? 0,
    hoverTarget,
    hoverTarget > 0 ? 0.18 : 0.10,
  );
  if (targetIndex < 0 && system.userData.hoverStrength < 0.01) {
    system.userData.hoverStrength = 0;
    system.userData.hoveredRegionIndex = -1;
  }

  let inspection = system.userData.inspection ?? 0;
  if (camera && system.parent) {
    const worldPosition = jupiterRingWorldPosition;
    system.parent.getWorldPosition(worldPosition);
    const planetRadius = Number(system.parent.userData?.visualRadius ?? 1);
    const cameraDistance = camera.position.distanceTo(worldPosition);
    const normalizedDistance = cameraDistance / Math.max(planetRadius, 0.001);

    const focalPixels = (window.innerHeight * 0.5)
      / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    applyJupiterRingDetail(
      system,
      ((planetRadius * 3.2) / Math.max(cameraDistance, 1e-4)) * focalPixels,
    );
    const targetInspection = 1 - THREE.MathUtils.smoothstep(normalizedDistance, 6.5, 22.0);
    inspection = THREE.MathUtils.lerp(inspection, targetInspection, 0.08);
    system.userData.inspection = inspection;

    // Jupiter's rings belong to Jupiter, not to the system view. See
    // ringProximity.js for the two numbers and why they are those numbers.
    system.userData.farFade = ringProximityFade(normalizedDistance);
  }
  const farFade = system.userData.farFade ?? 1;
  if (!applyRingProximityVisibility(system, farFade)) return;

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
    if (band.material?.uniforms?.uFarFade) {
      band.material.uniforms.uFarFade.value = farFade;
    }
  });

  system.userData.dustLayers?.forEach((dust, index) => {
    if (!dust) return;
    // Inner material orbits fastest: the halo and main ring circle Jupiter in
    // about seven hours, the gossamer rings take considerably longer.
    dust.rotation.y += (0.000042 - index * 0.0000075) * motionScale;
    if (!dust.material) return;
    const base = dust.userData.baseOpacity ?? 0.08;
    const isActive = activeIndex === index;
    dust.material.opacity = (isActive
      ? THREE.MathUtils.lerp(base, Math.min(0.82, base * 2.4), hoverStrength)
      : base * (0.82 + inspection * 0.28)) * farFade;
  });
}

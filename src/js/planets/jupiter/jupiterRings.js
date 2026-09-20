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

/**
 * The brightness dial. Change these three numbers and nothing else.
 *
 * Everything in this file is multiplied by one of them, so a value of 1 is
 * whatever the tuned baseline is, 2 is twice as bright, 0.5 is half. They are
 * separate because the three zones do not have to move together -- the main
 * ring is the one you are meant to see and the gossamer rings are meant to be
 * on the edge of visible, and that ratio is worth keeping while the overall
 * level changes.
 *
 * Live, with the dev server running and without a reload:
 *
 *     window.__jupiterRings.setBrightness({ main: 1.6 })
 *     window.__jupiterRings.getBrightness()
 *
 * Or edit the numbers here and let hot reload rebuild the system.
 */
export const JUPITER_RING_BRIGHTNESS = {
  halo: 1,
  main: 1,
  gossamer: 1,
};

/* Every built material records which zone it belongs to and what its tuned
 * baseline was, so the dial can be turned at any time without rebuilding. */
const brightnessSubscribers = new Set();

function zoneFactor(zone) {
  const value = Number(JUPITER_RING_BRIGHTNESS[zone]);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}

export function setJupiterRingBrightness(next = {}) {
  for (const zone of ["halo", "main", "gossamer"]) {
    if (next[zone] !== undefined) JUPITER_RING_BRIGHTNESS[zone] = Number(next[zone]);
  }
  brightnessSubscribers.forEach((apply) => apply());
  return { ...JUPITER_RING_BRIGHTNESS };
}

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
 * anyone has ever actually seen this system, and everything draws additively
 * for the same reason. The *relative* brightness is kept honest: the main
 * ring is far and away the brightest, the halo is next, and the two gossamer
 * rings are the faintest things here, in that order, as they are in the data.
 *
 * ## The second pass, and why these numbers came down so far
 *
 * The first pass over-corrected. Depicting forward-scattered light is right;
 * depicting it at an opacity that let the rings compete with Jupiter was not.
 * Reported as "it is very much visible", and the reference point is Saturn:
 * if Saturn's rings sit near eighty per cent, Jupiter's main ring belongs
 * between five and fifteen, and the two gossamer rings between one and three.
 * Then a second correction, in the other direction: "can we make it little
 * glow ... slightly visible". The light moved off the flat sheet and onto the
 * grains. `opacity` -- the continuous disc behind the dust -- came down to
 * between 0.6% and 4.8%, because a sheet bright enough to see is a *coloured
 * disc*, and Jupiter does not have one of those. `dustOpacity` went up
 * instead, so what you see is thousands of lit specks with a faint wash
 * behind them rather than a wash with specks on it. Everything is additive,
 * so over the shadowed side of the planet the rings vanish entirely and only
 * glow where they catch light at the limb -- which is exactly the behaviour
 * every real image of them shows.
 *
 * ## The third pass: everything except the main ring
 *
 * "Jupiter except main rings, other rings needs to be little bit more glow
 * and visible because it is not visible their particles or whatever it is."
 * Correct, and the reason is *area* rather than opacity. The main ring is
 * 6,500 km wide; the Thebe gossamer is 97,000 km wide and 8,800 km thick.
 * Spreading a sixth of the grain budget over a volume some three thousand
 * times larger, at the same grain size, puts the specks so far apart that
 * there is nothing to see between them -- the ring stops being dust and
 * becomes a few isolated points.
 *
 * Three things changed, none of them the main ring:
 *
 *   - `dustOpacity` on the halo and the two gossamer rings rose to between a
 *     half and two thirds of the main ring's, from a fifth and a sixth. The
 *     published ordering survives -- main is still brightest, halo next, the
 *     gossamers faintest -- but the gaps between them are compressed, which
 *     is the same bargain the whole file already makes with forward-scattered
 *     light.
 *   - `particleShare` was rebalanced by *volume* rather than evenly. The main
 *     ring keeps a fifth of the grains for a thin narrow band and is still
 *     the densest thing here by a wide margin; the two gossamer rings now
 *     take more than half between them because they have to fill a volume
 *     that large.
 *   - `grainScale` is new: a per-region multiplier on the sprite size. A
 *     grain in the Thebe ring is 1.65x one in the main ring, so a speck seen
 *     from outside Amalthea's orbit is still a speck rather than nothing.
 *     Below 1 px a sprite is not drawn small, it is drawn *absent*.
 *
 * The total grain budget went up with them -- 40,000 at high quality against
 * 28,000 -- because these are four `Points` draw calls whatever the count.
 *
 * ## Edges, per component
 *
 * `innerSoft` and `outerSoft` are the fraction of the band's width each edge
 * takes to fade, and they are not the same on both sides or across the four:
 *
 *   halo        soft everywhere -- it is a diffuse torus with no edge at all
 *   main ring   soft inside near Metis, **crisp** outside at Adrastea, whose
 *               orbit is what cuts it off
 *   gossamer    a definite inner edge and no outer one; they run out of dust
 *               rather than stopping
 */
const RING_REGIONS = Object.freeze([
  {
    name: "Halo Ring",
    zone: "halo",
    innerKm: 92_000,
    outerKm: 122_500,
    thicknessKm: 12_500,
    opacity: 0.082,
    dustOpacity: 0.54,
    particleShare: 0.24,
    grainScale: 1.25,
    innerSoft: 0.34,
    outerSoft: 0.30,
    color: 0xa59d95,
    character: "Thick inner torus of magnetically lofted dust",
    description: "The innermost and thickest component: a faint torus of fine dust extending 12,500 km above and below the ring plane. Grains drifting inward from the main ring pick up electrical charge and are pushed out of the plane by Jupiter's magnetic field, which is why this one is a doughnut rather than a disc.",
    motion: "Charged micron dust · lofted out of the ring plane by Jupiter's magnetosphere",
    source: "Inward-migrating dust from the main ring",
  },
  {
    name: "Main Ring",
    zone: "main",
    innerKm: 122_500,
    outerKm: 129_000,
    thicknessKm: 100,
    opacity: 0.105,
    dustOpacity: 0.64,
    particleShare: 0.22,
    grainScale: 1,
    innerSoft: 0.16,
    outerSoft: 0.035,
    color: 0xe5dec9,
    character: "Narrow, flat, the one component that is readily imaged",
    description: "Narrow and remarkably thin — about 6,500 km wide and under 100 km deep. It is fed by dust blasted off Adrastea and Metis, whose orbits bracket its outer edge, and it is the brightest of the four. Voyager 1 found it in 1979 in a single deliberately over-exposed frame.",
    motion: "Dust from micrometeoroid impacts on Adrastea and Metis · thin and sharply bounded",
    source: "Adrastea and Metis",
  },
  {
    name: "Amalthea Gossamer Ring",
    zone: "gossamer",
    innerKm: 129_000,
    outerKm: 182_000,
    thicknessKm: 2_300,
    opacity: 0.056,
    dustOpacity: 0.44,
    particleShare: 0.29,
    grainScale: 1.55,
    innerSoft: 0.07,
    outerSoft: 0.80,
    color: 0xa59d95,
    character: "Broad faint sheet reaching Amalthea's orbit",
    description: "A very faint, very broad sheet of dust reaching out to the orbit of Amalthea, which supplies it. Its vertical extent matches Amalthea's orbital inclination — the dust inherits the moon's tilt, so the ring is as thick as that moon's path is wide.",
    motion: "Impact ejecta from Amalthea · thickness set by that moon's orbital inclination",
    source: "Amalthea",
  },
  {
    name: "Thebe Gossamer Ring",
    zone: "gossamer",
    innerKm: 129_000,
    outerKm: 226_000,
    thicknessKm: 8_800,
    opacity: 0.043,
    dustOpacity: 0.35,
    particleShare: 0.25,
    grainScale: 1.65,
    innerSoft: 0.07,
    outerSoft: 0.88,
    color: 0x9a9289,
    character: "Faintest and thickest, with a tail beyond Thebe's orbit",
    description: "The faintest of the four and the furthest out, fed by Thebe. It is nearly 8,800 km thick for the same reason the Amalthea ring is 2,300 — Thebe's orbit is more steeply inclined. A fainter extension continues beyond Thebe itself, dust that has drifted outward and not yet been lost.",
    motion: "Impact ejecta from Thebe · a faint extension continues past the moon's own orbit",
    source: "Thebe",
  },
]);

/*
 * Counts rose with the shrinking grain. These are four `Points` draw calls
 * between them and nothing else changes per frame, so the extra vertices are
 * close to free -- and they are what stops a ring of one-pixel specks looking
 * like static instead of dust.
 */
const QUALITY_PROFILES = Object.freeze({
  low: { particles: 16_000 },
  medium: { particles: 26_000 },
  high: { particles: 40_000 },
});

/**
 * One soft round grain, drawn once and shared by all four components.
 *
 * This is the fix for the most-reported thing about these rings. A
 * PointsMaterial with no map renders every point as a **hard-edged square**
 * -- WebGL's point primitive is a quad and nothing was shaping it -- so at
 * any distance where the grains resolved, the rings became a field of little
 * squares. Reported as "composed of square like pixel like figure but in
 * reality it is not like that".
 *
 * A radial alpha gradient turns each quad into a soft dot, and fifteen
 * thousand soft dots overlapping additively are a sheet of smoke rather than
 * a mosaic. It costs one 64x64 texture for the whole system.
 *
 * The falloff is squared rather than linear on purpose: linear leaves a
 * visible disc with a definite rim, and a rim is the thing being removed.
 */
let sharedDustGrainTexture = null;

function getDustGrainTexture() {
  if (sharedDustGrainTexture) return sharedDustGrainTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    size * 0.5, size * 0.5, 0,
    size * 0.5, size * 0.5, size * 0.5,
  );
  /*
   * A bright core with a soft skirt, which is what makes a speck read as
   * *glowing* rather than as a small flat dot. A plain linear or squared
   * falloff spreads the alpha evenly and the grain looks like a smudge; a
   * higher exponent concentrates it in the middle and leaves a faint halo,
   * and additive blending turns that halo into the glow between grains.
   */
  for (let step = 0; step <= 10; step += 1) {
    const t = step / 10;
    const falloff = Math.pow(1 - t, 2.6);
    gradient.addColorStop(t, "rgba(255, 255, 255, " + falloff.toFixed(4) + ")");
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  sharedDustGrainTexture = new THREE.CanvasTexture(canvas);
  sharedDustGrainTexture.colorSpace = THREE.SRGBColorSpace;
  sharedDustGrainTexture.needsUpdate = true;
  return sharedDustGrainTexture;
}

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
function createDustBandMaterial({ innerRadius, outerRadius, color, opacity, innerSoft, outerSoft }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
      uColor: { value: new THREE.Color(color) },
      uBaseOpacity: { value: opacity },
      uInnerSoft: { value: innerSoft ?? 0.12 },
      uOuterSoft: { value: outerSoft ?? 0.28 },
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
      uniform float uInnerSoft;
      uniform float uOuterSoft;
      uniform float uHover;
      uniform float uInspection;
      uniform float uFarFade;
      varying vec2 vLocalPosition;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      /*
       * Smoke, not cells.
       *
       * The first version hashed floor(angle * 480.0) against floor(radial *
       * 20.0) -- a hash of two *quantised* coordinates, which is a grid of
       * independent random cells with hard boundaries between them. Close up
       * that is a checkerboard, and it was reported as the rings looking like
       * they were "composed of square like pixel like figure". Interpolating
       * the same lattice with a smoothstep turns the identical noise into a
       * continuous field, which is what a sheet of dust actually looks like.
       */
      float valueNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        float radius = length(vLocalPosition);
        float radial = clamp((radius - uInnerRadius) / max(0.0001, uOuterRadius - uInnerRadius), 0.0, 1.0);
        float angle = atan(vLocalPosition.y, vLocalPosition.x) / 6.28318530718 + 0.5;

        /*
         * Each edge fades over its own fraction of the band's width, because
         * the four components do not end the same way: the main ring is cut
         * off cleanly on the outside by Adrastea's orbit, the gossamer rings
         * have no outer edge at all, and the halo has none anywhere.
         */
        float edge = smoothstep(0.0, uInnerSoft, radial)
          * (1.0 - smoothstep(1.0 - uOuterSoft, 1.0, radial));

        /*
         * Angular seam note: the angle wraps from 1 back to 0 at the same
         * place every frame, so the noise is sampled on a circle of
         * circumference 26 rather than on the angle directly -- an integer
         * period means the lattice meets itself cleanly and there is no
         * visible join.
         *
         * And no backticks anywhere inside this literal. A backtick in a
         * comment here ends the template string the shader is written in, and
         * the whole module stops parsing -- which is exactly how the first
         * version of this comment broke the build.
         */
        float broad = valueNoise(vec2(angle * 26.0, radial * 3.0));
        float fine = valueNoise(vec2(angle * 104.0, radial * 9.0) + 11.0);
        float dust = broad * 0.68 + fine * 0.32;

        // Slightly stronger close up, where the ring is resolved, rather
        // than the other way round. Folding a whole ring into a few pixels
        // already concentrates its alpha; boosting it as well is what made
        // these outshine their own planet from the system view.
        float distanceVisibility = mix(0.88, 1.10, uInspection);
        // A narrow band of variation. Wide swings read as banding; this is a
        // smooth sheet with the density drifting gently across it.
        float baseAlpha = uBaseOpacity * edge * mix(0.74, 1.18, dust) * distanceVisibility;

        float hoverAlpha = max(uBaseOpacity * 4.5, 0.30) * edge * (0.90 + dust * 0.10);
        float alpha = mix(baseAlpha, hoverAlpha, uHover) * uFarFade;
        vec3 hoverColour = vec3(0.90, 0.94, 1.0);
        vec3 colour = mix(uColor, hoverColour, uHover * 0.65);
        gl_FragColor = vec4(colour, clamp(alpha, 0.0, 0.42));
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    /*
     * Additive, like the dust. Normal blending leaves a grey film lying over
     * the shadowed side of the planet, which is the one place these rings are
     * certain to be invisible: they are lit dust and there is no light there.
     * Additive makes the dark side subtract nothing and the lit limb glow,
     * which is what the photographs show.
     */
    blending: THREE.AdditiveBlending,
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
    innerSoft: region.innerSoft,
    outerSoft: region.outerSoft,
  });
  const applySheetBrightness = () => {
    material.uniforms.uBaseOpacity.value = region.opacity * zoneFactor(region.zone);
  };
  applySheetBrightness();
  brightnessSubscribers.add(applySheetBrightness);
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
  // The backlit glow from the palette: the colour these grains take when they
  // are catching the Sun from behind, which is the only time anyone sees them.
  const light = new THREE.Color(0xe5dec9);

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
    /*
     * Small pieces, and a lot of them.
     *
     * Widening the grain was the wrong correction. A soft sprite at 0.017 of
     * Jupiter's radius is a *visible circle* -- the squares became discs, and
     * a field of discs is no more like dust than a field of squares was.
     * Reported as "there should not be a dust of circular".
     *
     * Dust is resolved by making each piece too small to have a shape at all:
     * at 0.0045 a grain is one to three pixels even from close in, so what
     * the eye gets is a speck of light with no outline, and the ring is the
     * accumulation of thousands of them rather than a pattern of any single
     * one. The count goes up to keep the sheet continuous and the per-grain
     * brightness goes up to keep it lit -- a grain covering a fourteenth of
     * the area needs to be brighter to add the same light.
     */
    size: radius * 0.0045 * (Number(region.grainScale) || 1),
    sizeAttenuation: true,
    map: getDustGrainTexture(),
    vertexColors: true,
    transparent: true,
    opacity: region.dustOpacity,
    depthWrite: false,
    /*
     * No alphaTest. It was cutting the soft grain back into a hard-edged
     * disc -- the same rim the gradient exists to remove -- and with
     * depthWrite off and additive blending there is nothing for it to fix.
     */
    alphaTest: 0,
    /*
     * Additive, unlike Neptune's. Neptune's rings are dark material read
     * against a bright blue disc, where subtracting light is right. Jupiter's
     * are read against black sky in forward-scattered light, where dust adds
     * light and nothing else makes it visible at all -- see the note on
     * RING_REGIONS.
     */
    blending: THREE.AdditiveBlending,
  });

  const applyDustBrightness = () => {
    material.opacity = region.dustOpacity * zoneFactor(region.zone);
  };
  applyDustBrightness();
  brightnessSubscribers.add(applyDustBrightness);

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
  /*
   * The dial, reachable from the console without a reload. Self-contained
   * here rather than wired through main.js, because it is a tuning aid for
   * one ring system and nothing else in the scene needs to know about it.
   */
  if (typeof window !== "undefined") {
    window.__jupiterRings = {
      setBrightness: setJupiterRingBrightness,
      getBrightness: () => ({ ...JUPITER_RING_BRIGHTNESS }),
    };
  }

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

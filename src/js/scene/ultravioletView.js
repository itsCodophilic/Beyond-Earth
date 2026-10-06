import * as THREE from "three";
import { setAuroraSpectrum } from "../graphics/planetAurora.js";

/**
 * The ultraviolet view (final rounds, the owner).
 *
 * By default the aurorae of Mars, Jupiter, Saturn and Uranus are drawn as an
 * eye would see them -- barely there (graphics/planetAurora.js). Their bright
 * shapes exist only to ultraviolet cameras. This view is that camera: opened
 * from a planet's info card (which the board's "Aurora · UV mode" opens), it shows the
 * planet and its aurora the way Hubble, MAVEN, Juno, Cassini and Hope
 * recorded them.
 *
 * Ultraviolet has no colour. Every published ultraviolet image is false
 * colour: two or three ultraviolet filters are each given a visible colour,
 * so what looks pink or blue is really "brighter in this band than that
 * one". This view copies those published images, planet by planet (the
 * owner's reference images, identified in UV_LOOK below), rather than
 * tinting everything one colour -- which the first version did, and which is
 * not what any of them look like:
 *
 *   - the planet is redrawn in its own false colour, built from its own map:
 *     a palette, the features the ultraviolet picks out (the Great Red Spot
 *     going dark, polar haze, ozone, ice), and the haze at the limb;
 *   - the aurorae switch to full ultraviolet brightness, in the colour the
 *     published images give them;
 *   - the sky goes black. In ultraviolet only hot stars are bright; the
 *     glowing gas clouds, the zodiacal light, the dust and the cool red and
 *     orange stars of the visible sky drop out.
 *
 * main.js holds the view: the camera turns to face the aurora, the viewer
 * can turn it (drag, arrow keys) and nothing else -- no clicking, hovering,
 * zooming or travelling. Escape and "Back to visible light" leave.
 *
 * Cost: one extra 128 x 64 sphere with a one-texture shader. The planet's
 * own surface stops drawing meanwhile, and the sky layers that go are simply
 * not drawn, so the frame is lighter than normal.
 */

const rgb = (r, g, b) => new THREE.Vector3(r, g, b);

/*
 * How each planet looks to an ultraviolet camera, in false colour. Colours are
 * picked off the published images (sRGB, 0-1); they are render values, not
 * measurements.
 *
 *   radii      camera distance, in planet radii, that frames the whole disc
 *              and its aurora beside the card
 *   mode       "lum": the palette follows the map's brightness (belts and
 *              zones); "lat": it follows latitude (broad zones), with the
 *              map's detail laid over it
 *   range      map brightness mapped to the two ends of the palette ("lum")
 *   ramp       six colours, dark/equator to bright/pole
 *   detail     how much of the map's light and dark survives ("lat")
 *   spot       a feature found by colour and place (the Great Red Spot)
 *   pole       a polar region in its own colour (haze, ozone, a bright cap);
 *              hemisphere 1 north, -1 south, 0 both; start is sin(latitude)
 *   cap        bright ice: map brighter than `lum` above sin(latitude) `lat`
 *   haze       white cloud and dust, as broken noise
 *   limb       the thin atmosphere lit at the edge of the disc
 *   hide       the planet's own layers that do not belong in the view
 */
const UV_LOOK = Object.freeze({
  Mars: {
    // MAVEN IUVS, July 2016 and 2022-23 (NASA, "MAVEN Mission Gives
    // Unprecedented Ultraviolet View of Mars"; the owner's mars/1-4): rock
    // dark, olive to tan; clouds, dust, haze and the CO2 cap white; ozone
    // magenta over the winter pole; a bright limb.
    radii: 5.2,
    mode: "lum",
    range: [0.22, 0.56],
    ramp: [rgb(0.17, 0.17, 0.10), rgb(0.29, 0.29, 0.16), rgb(0.42, 0.41, 0.24), rgb(0.55, 0.52, 0.33), rgb(0.68, 0.64, 0.45), rgb(0.82, 0.80, 0.66)],
    detail: 0,
    spot: null,
    pole: { color: rgb(0.86, 0.30, 0.84), start: 0.8, hemisphere: -1, strength: 0.88, wave: 0.12 },
    cap: { color: rgb(0.96, 0.97, 1.0), lum: 0.78, lat: 0.78 },
    haze: { color: rgb(0.86, 0.91, 0.98), strength: 0.42 },
    limb: { color: rgb(0.84, 0.90, 1.0), strength: 0.95 },
    line: "After MAVEN's ultraviolet images: rock in dark olive and tan, clouds and the ice cap white, ozone magenta over the south pole. The aurora glows on the night side, over crust that is still magnetised.",
  },
  Jupiter: {
    // Hubble WFC3, released 7 November 2023 (ESA/Hubble "Jupiter in
    // ultraviolet": blue F225W, green F275W, red F343N; the owner's
    // jupiter/1-3): bands in blue, lavender and pink; the Great Red Spot dark
    // blue, because high haze over it absorbs ultraviolet; red-brown, wavy
    // haze over both poles.
    radii: 5.6,
    mode: "lum",
    range: [0.5, 0.86],
    ramp: [rgb(0.28, 0.52, 0.92), rgb(0.42, 0.74, 0.96), rgb(0.62, 0.63, 0.95), rgb(0.80, 0.66, 0.92), rgb(0.94, 0.78, 0.90), rgb(0.96, 0.93, 0.97)],
    detail: 0,
    // Found in jupiter-2k.jpg: reddest point in the southern tropics,
    // latitude -20 deg, longitude 135 deg (u 0.375, v 0.388).
    spot: { uv: [0.375, 0.388], size: [0.045, 0.04], red: 0.26, color: rgb(0.08, 0.10, 0.48) },
    pole: { color: rgb(0.56, 0.32, 0.29), start: 0.72, hemisphere: 0, strength: 0.9, wave: 0.3 },
    cap: null,
    haze: null,
    limb: { color: rgb(0.86, 0.82, 1.0), strength: 0.14 },
    line: "After Hubble's 2023 ultraviolet image: bands in blue and pink, the Great Red Spot dark blue because high haze over it soaks up ultraviolet, red-brown haze over the poles. The aurora rings the pole.",
  },
  Saturn: {
    // Hubble WFPC2, E. Karkoschka, released 9 September 2003 ("The Slant on
    // Saturn's Rings (Ultraviolet)"; the owner's saturn/1-3): pastel bands
    // -- aqua, yellow, pink, lavender, blue -- and a green pole. The rings
    // stay golden in that image, so they are left as they are.
    radii: 6.0,
    mode: "lat",
    range: [0.58, 0.94],
    ramp: [rgb(0.55, 0.88, 0.90), rgb(0.82, 0.90, 0.62), rgb(0.94, 0.74, 0.86), rgb(0.70, 0.65, 0.97), rgb(0.54, 0.70, 0.96), rgb(0.52, 0.82, 0.54)],
    detail: 0.9,
    spot: null,
    pole: null,
    cap: null,
    haze: null,
    limb: { color: rgb(0.80, 0.86, 1.0), strength: 0.1 },
    line: "After Hubble's 2003 ultraviolet image: pastel bands, a green pole, rings in peach and cream with a dark blue C ring. The aurora is the bright ring round the pole, as Hubble and Cassini recorded it.",
  },
  Uranus: {
    // After Hubble's most recent ultraviolet aurora images (STIS, visible
    // and ultraviolet, 8, 10 and 24 October 2022; ESA/Hubble heic2503,
    // released 2025): a strong blue disc, a white region over the north
    // pole -- the photochemical haze cap that has been thickening towards
    // the 2028 northern solstice (ESA/Hubble heic2303) -- fuzzy blue-purple
    // aurora, and a faint ring. So: blue, with a slightly darker collar
    // round the cap and a pale, winter-dark south; the north pole white.
    // (The previous round drew it far-ultraviolet dark; the owner found it
    // "completely blue", and the published image is the better guide.)
    // The aurora sits in two bands near the magnetic poles, far from the
    // spin poles (JWST, January 2025; Tiranti et al. 2026, GRL), because
    // the field is tipped 59 deg (Voyager 2; Ness et al. 1986, Science 233,
    // 85). Its visible-light haze shell is switched off meanwhile.
    radii: 5.2,
    mode: "lat",
    range: [0.63, 0.86],
    ramp: [rgb(0.20, 0.38, 0.80), rgb(0.24, 0.43, 0.84), rgb(0.21, 0.40, 0.81), rgb(0.16, 0.32, 0.72), rgb(0.18, 0.35, 0.76), rgb(0.19, 0.36, 0.77)],
    detail: 0.35,
    spot: null,
    pole: { color: rgb(0.90, 0.94, 1.0), start: 0.8, hemisphere: 1, strength: 0.95, wave: 0.08 },
    cap: null,
    haze: null,
    limb: { color: rgb(0.70, 0.80, 1.0), strength: 0.45 },
    hide: ["Uranus methane haze shell", "Uranus atmosphere"],
    line: "After Hubble's 2022 ultraviolet aurora images: a blue disc, the white haze cap over the north pole, a faint grey ring, and the aurora as blue-purple glows in two bands near the magnetic poles — far from the spin poles, because the field is tipped 59°.",
  },
});

export const ULTRAVIOLET_PLANETS = Object.freeze(Object.keys(UV_LOOK));

/*
 * Stars that stay bright in ultraviolet: the hot ones. Spectral types from the
 * Yale Bright Star Catalogue. The cool ones -- K and M giants and the
 * Sun-like G stars -- give out little ultraviolet, so their flares go.
 */
const COOL_STAR_FLARES = /^(Arcturus|Capella|Rigil Kentaurus|Betelgeuse|Aldebaran|Antares|Pollux) flare$/;

function findSurfaceTexture(planet) {
  const material = [].concat(planet.material ?? [])[0];
  const candidates = [material?.map, material?.uniforms?.uMap?.value, material?.uniforms?.map?.value];
  return candidates.find((texture) => texture?.isTexture) ?? null;
}

function createUltravioletSkin(planet, look) {
  if (!planet.geometry) return null;
  if (!planet.geometry.boundingSphere) planet.geometry.computeBoundingSphere();
  const radius = planet.geometry.boundingSphere?.radius ?? 1;
  const texture = findSurfaceTexture(planet);
  const spot = look.spot;
  const pole = look.pole;
  const cap = look.cap;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uHasMap: { value: texture ? 1 : 0 },
      // A map flagged sRGB is decoded to linear when sampled; the ranges
      // above were read from the files, so the shader re-encodes it.
      uMapSrgb: { value: texture?.colorSpace === THREE.SRGBColorSpace ? 1 : 0 },
      uMode: { value: look.mode === "lat" ? 1 : 0 },
      uRange: { value: new THREE.Vector2(look.range[0], look.range[1]) },
      uRamp: { value: look.ramp },
      uDetail: { value: look.detail },
      uSpotOn: { value: spot ? 1 : 0 },
      uSpotUv: { value: new THREE.Vector2(...(spot?.uv ?? [0, 0])) },
      uSpotSize: { value: new THREE.Vector2(...(spot?.size ?? [1, 1])) },
      uSpotRed: { value: spot?.red ?? 1 },
      uSpotColor: { value: spot?.color ?? rgb(0, 0, 0) },
      uPoleOn: { value: pole ? pole.strength : 0 },
      uPoleColor: { value: pole?.color ?? rgb(0, 0, 0) },
      uPoleStart: { value: pole?.start ?? 2 },
      uPoleHemi: { value: pole?.hemisphere ?? 0 },
      uPoleWave: { value: pole?.wave ?? 0 },
      uCapOn: { value: cap ? 1 : 0 },
      uCapColor: { value: cap?.color ?? rgb(1, 1, 1) },
      uCapLum: { value: cap?.lum ?? 2 },
      uCapLat: { value: cap?.lat ?? 2 },
      uHazeColor: { value: look.haze?.color ?? rgb(1, 1, 1) },
      uHaze: { value: look.haze?.strength ?? 0 },
      uLimbColor: { value: look.limb.color },
      uLimb: { value: look.limb.strength },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vLocal = position;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uHasMap;
      uniform float uMapSrgb;
      uniform float uMode;
      uniform vec2 uRange;
      uniform vec3 uRamp[6];
      uniform float uDetail;
      uniform float uSpotOn;
      uniform vec2 uSpotUv;
      uniform vec2 uSpotSize;
      uniform float uSpotRed;
      uniform vec3 uSpotColor;
      uniform float uPoleOn;
      uniform vec3 uPoleColor;
      uniform float uPoleStart;
      uniform float uPoleHemi;
      uniform float uPoleWave;
      uniform float uCapOn;
      uniform vec3 uCapColor;
      uniform float uCapLum;
      uniform float uCapLat;
      uniform vec3 uHazeColor;
      uniform float uHaze;
      uniform vec3 uLimbColor;
      uniform float uLimb;
      varying vec2 vUv;
      varying vec3 vLocal;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      float hash3(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash3(i);
        float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
        return mix(
          mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
          mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
          f.z
        );
      }
      float fbm3(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += noise3(p) * a;
          p = p * 2.03 + vec3(17.1, 9.2, 4.7);
          a *= 0.5;
        }
        return v;
      }
      vec3 ramp(float t) {
        float s = clamp(t, 0.0, 1.0) * 5.0;
        vec3 c = uRamp[0];
        for (int i = 0; i < 5; i++) {
          c = mix(c, uRamp[i + 1], clamp(s - float(i), 0.0, 1.0));
        }
        return c;
      }

      void main() {
        vec3 dir = normalize(vLocal);
        float lat = dir.y;
        float absLat = abs(lat);
        float lon = atan(dir.z, dir.x);
        vec3 mapColor = vec3(0.5);
        if (uHasMap > 0.5) mapColor = texture2D(uMap, vUv).rgb;
        if (uMapSrgb > 0.5) mapColor = pow(max(mapColor, vec3(0.0)), vec3(1.0 / 2.2));
        float lum = dot(mapColor, vec3(0.2126, 0.7152, 0.0722));
        float lumT = clamp((lum - uRange.x) / max(uRange.y - uRange.x, 0.001), 0.0, 1.0);

        // Palette: by brightness (belts and zones) or by latitude.
        float latT = asin(clamp(absLat, 0.0, 1.0)) / 1.5707963 + (lumT - 0.5) * 0.08;
        vec3 color = ramp(mix(lumT, latT, uMode));
        color *= 1.0 + (lumT - 0.5) * uDetail * uMode;

        // A spot found by its colour and place.
        vec2 spotD = (vUv - uSpotUv) / uSpotSize;
        float spot = (1.0 - smoothstep(0.55, 1.0, length(spotD)))
          * smoothstep(uSpotRed, uSpotRed + 0.08, mapColor.r - mapColor.b);
        color = mix(color, uSpotColor, spot * uSpotOn);

        // A polar region with a wavy edge.
        float hemi = uPoleHemi == 0.0 ? 1.0 : step(0.0, lat * uPoleHemi);
        float edge = uPoleStart
          + (lumT - 0.5) * uPoleWave * 0.2
          + sin(lon * 7.0 + absLat * 9.0) * uPoleWave * 0.06;
        color = mix(color, uPoleColor * (0.82 + lumT * 0.36), smoothstep(edge, edge + 0.09, absLat) * hemi * uPoleOn);

        // Ice.
        float ice = smoothstep(uCapLum, uCapLum + 0.08, lum) * smoothstep(uCapLat, uCapLat + 0.05, absLat);
        color = mix(color, uCapColor, ice * uCapOn);

        // Cloud and dust, broken.
        float cloud = smoothstep(0.56, 0.8, fbm3(dir * 5.5 + vec3(3.1, 0.0, 1.7)));
        color = mix(color, uHazeColor, cloud * uHaze);

        vec3 n = normalize(vWorldNormal);
        vec3 sunDir = normalize(-vWorldPos);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float ndl = dot(n, sunDir);
        float day = smoothstep(-0.06, 0.22, ndl);
        float shade = 0.03 + 0.97 * day * (0.6 + 0.4 * max(ndl, 0.0));
        float limb = pow(1.0 - max(dot(n, viewDir), 0.0), 2.6);
        vec3 haze = uLimbColor * uLimb * limb * smoothstep(-0.2, 0.3, ndl);
        gl_FragColor = vec4(clamp(color * shade + haze, 0.0, 1.0), 1.0);
      }
    `,
  });
  /* Four parts in a thousand above the surface, below every aurora shell
   * (1.02 radii and up). The surface underneath is switched off while the
   * skin is on (see enter), so the two never fight in the depth buffer. */
  const skin = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.004, 128, 64), material);
  skin.name = `${planet.name} ultraviolet skin`;
  skin.renderOrder = 1;
  skin.raycast = () => {};
  planet.add(skin);
  return skin;
}

/*
 * Rings in the ultraviolet view (second and third final rounds, the owner:
 * "Saturn Rings are not design in UV mode", then "Uranus rings does have UV
 * mode colors? ... perform more R&D on Jupiter ring"). The scene's rings are
 * moving particles in their visible colours; for the view they are swapped
 * for one banded disc per planet, coloured from what is known of each ring
 * at short wavelengths. Band edges in km are the ones the ring files use.
 * The planet's shadow falls across the disc and the unlit face is dimmer.
 *
 *   Saturn   copied from Hubble's 2003 ultraviolet image (Karkoschka, the
 *            owner's saturn/1-3): C ring dark blue-grey, B ring cream to
 *            peach-orange, the Cassini Division and Encke Gap nearly empty,
 *            A ring cream.
 *   Jupiter  no ultraviolet image of the rings has been published that I
 *            could find, so this follows their spectra: the main ring is red
 *            in visible and near-infrared light (Galileo, Keck), so it is
 *            dimmer still at short wavelengths and drawn a dim warm grey; the
 *            halo is neutral to blue -- finer dust -- so it holds up and is
 *            drawn a faint blue-white; the gossamer rings are barely there.
 *   Uranus   the narrow rings are among the darkest things in the Solar
 *            System (albedo about 2 %) and grey, so they are faint grey lines,
 *            the epsilon ring strongest -- Hubble's 2022 ultraviolet aurora
 *            images show "a faint ring" (ESA/Hubble heic2503). The outer
 *            dusty rings have colours of their own (de Pater et al. 2006,
 *            Science 312, 92): the mu ring is blue, from fine dust shed by the
 *            moon Mab, so it is drawn faint blue; the nu ring is red, so it
 *            is fainter still and warm.
 */
const km = (value) => value;
const RING_LOOKS = Object.freeze({
  Saturn: {
    group: "Saturn particle-resolved seven-group ring system",
    planetKm: 60_268,
    edgeKm: 250,
    ringlets: 1,
    bands: [
      [km(74_658), km(92_000), rgb(0.30, 0.38, 0.62), 0.42],
      [km(92_000), km(99_000), rgb(0.93, 0.84, 0.60), 0.82],
      [km(99_000), km(117_580), rgb(0.97, 0.74, 0.47), 0.94],
      [km(117_580), km(122_170), rgb(0.24, 0.26, 0.40), 0.12],
      [km(122_170), km(133_423), rgb(0.88, 0.82, 0.68), 0.78],
      [km(133_745), km(136_775), rgb(0.88, 0.82, 0.68), 0.74],
    ],
  },
  Jupiter: {
    group: "Jupiter four-component dust ring system",
    planetKm: 71_492,
    edgeKm: 900,
    ringlets: 0,
    bands: [
      [km(92_000), km(122_500), rgb(0.62, 0.70, 0.92), 0.12],
      [km(122_500), km(129_000), rgb(0.66, 0.58, 0.50), 0.42],
      [km(129_000), km(182_000), rgb(0.56, 0.52, 0.50), 0.06],
      [km(182_000), km(200_000), rgb(0.56, 0.52, 0.50), 0.035],
    ],
  },
  Uranus: {
    group: "Uranus realistic 13-ring system",
    planetKm: 25_559,
    edgeKm: 70,
    ringlets: 0,
    // Narrow rings: centre +/- (width x 1.5), widened like the scene's own
    // rings so they are not lost below a pixel.
    bands: [
      [km(26_840), km(41_350), rgb(0.50, 0.54, 0.62), 0.10],
      ...[[41_837, 170], [42_234, 170], [42_570, 175], [44_718, 230], [45_661, 250], [47_176, 310], [47_627, 210], [48_300, 270], [50_023, 150]]
        .map(([centre, width]) => [centre - width * 1.5, centre + width * 1.5, rgb(0.62, 0.64, 0.70), 0.42]),
      [km(51_149 - 620), km(51_149 + 620), rgb(0.70, 0.72, 0.78), 0.62],
      [km(65_400), km(69_900), rgb(0.62, 0.50, 0.44), 0.07],
      [km(86_000), km(103_000), rgb(0.48, 0.64, 0.98), 0.14],
    ],
  },
});
const MAX_RING_BANDS = 16;

function createUltravioletRings(planet, radius) {
  const look = RING_LOOKS[planet.name];
  if (!look) return null;
  let group = null;
  planet.traverse((object) => {
    if (!group && object.name === look.group) group = object;
  });
  if (!group) return null;
  const unitPerKm = radius / look.planetKm;
  const bands = look.bands.slice(0, MAX_RING_BANDS);
  const pad = (list, fill) => list.concat(Array.from({ length: MAX_RING_BANDS - list.length }, () => fill));
  const centre = new THREE.Vector3();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uKmPerUnit: { value: 1 / unitPerKm },
      uPlanetCentre: { value: centre },
      uPlanetRadius: { value: radius },
      uCount: { value: bands.length },
      uEdgeKm: { value: look.edgeKm },
      uRinglets: { value: look.ringlets },
      uBandInner: { value: pad(bands.map((b) => b[0]), 0) },
      uBandOuter: { value: pad(bands.map((b) => b[1]), 0) },
      uBandColor: { value: pad(bands.map((b) => b[2]), rgb(0, 0, 0)) },
      uBandAlpha: { value: pad(bands.map((b) => b[3]), 0) },
    },
    vertexShader: /* glsl */ `
      varying float vKm;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      uniform float uKmPerUnit;
      void main() {
        vKm = length(position.xy) * uKmPerUnit;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uPlanetCentre;
      uniform float uPlanetRadius;
      uniform int uCount;
      uniform float uEdgeKm;
      uniform float uRinglets;
      uniform float uBandInner[16];
      uniform float uBandOuter[16];
      uniform vec3 uBandColor[16];
      uniform float uBandAlpha[16];
      varying float vKm;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        float k = vKm;
        vec3 color = vec3(0.0);
        float alpha = 0.0;
        for (int i = 0; i < 16; i++) {
          if (i >= uCount) break;
          float inside = smoothstep(uBandInner[i] - uEdgeKm, uBandInner[i] + uEdgeKm, k)
            * (1.0 - smoothstep(uBandOuter[i] - uEdgeKm, uBandOuter[i] + uEdgeKm, k));
          color += uBandColor[i] * inside * uBandAlpha[i];
          alpha += uBandAlpha[i] * inside;
        }
        if (alpha < 0.004) discard;
        color /= max(alpha, 0.0001);
        color *= mix(1.0, 0.92 + 0.08 * sin(k * 0.0011) * sin(k * 0.0043 + 1.3), uRinglets);
        // Sunlight: the planet's shadow, and the unlit face.
        vec3 toSun = normalize(-vWorldPos);
        vec3 toCentre = uPlanetCentre - vWorldPos;
        float t = dot(toCentre, toSun);
        float miss = length(toCentre - toSun * t);
        float shadow = t > 0.0 ? smoothstep(uPlanetRadius * 0.97, uPlanetRadius * 1.03, miss) : 1.0;
        vec3 toCamera = normalize(cameraPosition - vWorldPos);
        float sameFace = sign(dot(vWorldNormal, toSun)) * sign(dot(vWorldNormal, toCamera));
        float light = (sameFace > 0.0 ? 1.0 : 0.55) * mix(0.12, 1.0, shadow);
        gl_FragColor = vec4(color * light, clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const inner = Math.min(...bands.map((b) => b[0])) - look.edgeKm * 2;
  const outer = Math.max(...bands.map((b) => b[1])) + look.edgeKm * 2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner * unitPerKm, outer * unitPerKm, 256, 24),
    material,
  );
  ring.name = `${planet.name} ultraviolet rings`;
  ring.rotation.x = Math.PI * 0.5;
  ring.renderOrder = 2;
  ring.raycast = () => {};
  ring.onBeforeRender = () => { planet.getWorldPosition(centre); };
  // The group's own visibility still follows the camera's distance
  // (ringProximity.js); only its particles and bands are swapped out.
  const hidden = [];
  group.children.forEach((object) => {
    if (object.visible) {
      object.visible = false;
      hidden.push(object);
    }
  });
  group.add(ring);
  return {
    dispose() {
      ring.parent?.remove(ring);
      ring.geometry.dispose();
      material.dispose();
      hidden.forEach((object) => { object.visible = true; });
    },
  };
}

/**
 * Where to put the camera to see the aurora: a world-space unit vector from
 * the planet's centre. It looks down on the auroral region from about 45
 * degrees, from the lit side but with the terminator in view, so both the
 * planet's false colour and the night side, where aurora shows best, are on
 * screen. Mars's is turned further into the night, because its aurora is a
 * night-side glow.
 */
const _centre = new THREE.Vector3();
const _local = new THREE.Vector3();
const _planetPos = new THREE.Vector3();
export function auroraViewDirection(planet) {
  if (!planet) return null;
  planet.updateMatrixWorld(true);
  const shells = [];
  planet.traverse((object) => { if (object.userData?.auroraCentre) shells.push(object); });
  if (!shells.length) return null;
  const north = shells.filter((shell) => shell.userData.auroraCentre.sinLatitude > 0);
  const chosen = north.length ? north : shells;
  _centre.set(0, 0, 0);
  chosen.forEach((shell) => {
    const { sinLatitude, longitude, wholeRing, spiral = 0 } = shell.userData.auroraCentre;
    const pole = Math.sign(sinLatitude) || 1;
    if (wholeRing) {
      _local.set(0, pole, 0);
    } else {
      const r = Math.sqrt(Math.max(0, 1 - sinLatitude * sinLatitude));
      _local.set(Math.cos(longitude) * r * (1 - spiral), sinLatitude * (1 - spiral) + pole * spiral, Math.sin(longitude) * r * (1 - spiral)).normalize();
    }
    _centre.add(_local.transformDirection(shell.matrixWorld));
  });
  if (_centre.lengthSq() < 1e-8) return null;
  const aurora = _centre.normalize().clone();
  const sun = planet.getWorldPosition(_planetPos).negate().normalize();
  const towardSun = sun.clone().addScaledVector(aurora, -aurora.dot(sun));
  if (towardSun.lengthSq() < 1e-8) towardSun.set(1, 0, 0).addScaledVector(aurora, -aurora.x);
  towardSun.normalize();
  const terminator = new THREE.Vector3().crossVectors(aurora, sun);
  if (terminator.lengthSq() < 1e-8) terminator.crossVectors(aurora, new THREE.Vector3(0, 1, 0));
  terminator.normalize();
  const mars = planet.name === "Mars";
  return aurora.multiplyScalar(0.72)
    .addScaledVector(terminator, mars ? 0.6 : 0.5)
    .addScaledVector(towardSun, mars ? -0.12 : 0.42)
    .normalize();
}

/** Camera distance, in planet radii, for the ultraviolet view. */
export function ultravioletFramingRadii(planet) {
  return UV_LOOK[planet?.name]?.radii ?? 4.5;
}

export function createUltravioletView({ planets = [], getSky = () => null, onExitRequest = null } = {}) {
  const chrome = document.createElement("section");
  chrome.className = "uv-view";
  chrome.setAttribute("role", "dialog");
  chrome.setAttribute("aria-live", "polite");
  chrome.hidden = true;
  const eyebrow = document.createElement("p");
  eyebrow.className = "uv-view__eyebrow";
  eyebrow.textContent = "Ultraviolet view · Aurora";
  const title = document.createElement("h2");
  title.className = "uv-view__title";
  const why = document.createElement("p");
  why.className = "uv-view__why";
  why.textContent = "Switched to ultraviolet to show the aurora. It shines mainly in ultraviolet, which human eyes cannot see — this is how ultraviolet cameras record it, in false colour.";
  const line = document.createElement("p");
  line.className = "uv-view__text";
  const foot = document.createElement("div");
  foot.className = "uv-view__foot";
  const hint = document.createElement("span");
  hint.className = "uv-view__hint";
  hint.textContent = "Drag or use the arrow keys to turn";
  const exit = document.createElement("button");
  exit.type = "button";
  exit.className = "uv-view__exit";
  exit.innerHTML = '<span>Back to visible light</span><kbd>Esc</kbd>';
  exit.addEventListener("click", () => onExitRequest?.());
  foot.append(hint, exit);
  chrome.append(eyebrow, title, why, line, foot);
  /* Its presses are its own. Without this the press on "Back to visible
   * light" went on to the scene's window handlers, which read it as a click
   * on whatever lay behind: the planet's card opened, or a click into empty
   * space left the planet for the previous one (the owner's "lands me on
   * Moshup"). Same fix as the comet chip (round 8). */
  ["pointerdown", "pointerup", "click", "dblclick", "wheel"].forEach((type) => {
    chrome.addEventListener(type, (event) => event.stopPropagation());
  });
  document.body.append(chrome);

  let skin = null;
  let active = null;
  /* The planet's own surface stops drawing while the skin is on. Four parts
   * in a thousand is too little for the depth buffer at this scene's range:
   * first tests showed the surface breaking through the skin in patches.
   * colorWrite and depthWrite are render state, so nothing recompiles. */
  let hiddenSurface = [];
  let hiddenSky = [];
  let hiddenParts = [];
  let uvRings = null;

  function hideSky() {
    const sky = getSky();
    if (!sky) return;
    sky.traverse((object) => {
      if (object === sky || !object.visible) return;
      const name = object.name ?? "";
      const goes = name === "Deep sky transients"
        || name === "Subtle zodiacal light"
        || name === "Interplanetary dust motes"
        || COOL_STAR_FLARES.test(name)
        // Nebulae, clusters and galaxies: the sprites that are not star flares.
        || (object.isSprite && object.parent?.name === "Deep sky" && !/ flare$/.test(name));
      if (!goes) return;
      object.visible = false;
      hiddenSky.push(object);
    });
  }

  function enter(planet) {
    const look = UV_LOOK[planet?.name];
    if (!look) return false;
    if (active) exit_();
    active = planet;
    skin = createUltravioletSkin(planet, look);
    if (skin) {
      hiddenSurface = [].concat(planet.material ?? []).map((material) => {
        const saved = { material, colorWrite: material.colorWrite, depthWrite: material.depthWrite };
        material.colorWrite = false;
        material.depthWrite = false;
        return saved;
      });
    }
    if (!planet.geometry.boundingSphere) planet.geometry.computeBoundingSphere();
    uvRings = createUltravioletRings(planet, planet.geometry.boundingSphere?.radius ?? 1);
    (look.hide ?? []).forEach((name) => {
      const object = planet.getObjectByName(name);
      if (object?.visible) {
        object.visible = false;
        hiddenParts.push(object);
      }
    });
    planets.forEach((body) => setAuroraSpectrum(body, true));
    hideSky();
    title.textContent = planet.name;
    line.textContent = look.line;
    chrome.setAttribute("aria-label", `Ultraviolet view of ${planet.name}`);
    chrome.hidden = false;
    exit.focus({ preventScroll: true });
    return true;
  }

  function exit_() {
    if (!active) return;
    if (skin) {
      skin.parent?.remove(skin);
      skin.geometry.dispose();
      skin.material.dispose();
      skin = null;
    }
    hiddenSurface.forEach(({ material, colorWrite, depthWrite }) => {
      material.colorWrite = colorWrite;
      material.depthWrite = depthWrite;
    });
    hiddenSurface = [];
    hiddenSky.forEach((object) => { object.visible = true; });
    hiddenSky = [];
    uvRings?.dispose();
    uvRings = null;
    hiddenParts.forEach((object) => { object.visible = true; });
    hiddenParts = [];
    planets.forEach((body) => setAuroraSpectrum(body, false));
    active = null;
    chrome.hidden = true;
  }

  return {
    enter,
    exit: exit_,
    get active() { return active; },
    chrome,
  };
}

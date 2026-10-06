import * as THREE from "three";

/*
 * What an eye would see, as against what an ultraviolet camera sees (final
 * round, the owner).
 *
 * Every aurora in this file was drawn from spacecraft images, and for four of
 * the five planets those images are not visible light. Jupiter's, Saturn's and
 * Uranus's aurorae are brightest in the ultraviolet (Hubble STIS/ACS, Juno UVS,
 * Cassini UVIS) and infrared (H3+ -- Juno JIRAM, Cassini VIMS, Keck, JWST);
 * Mars's in the far ultraviolet (MAVEN IUVS, Emirates Mars Mission EMUS).
 * What a person would actually see is a small fraction of that:
 *
 *   Mars     a faint diffuse green glow, oxygen 557.7 nm -- the first visible
 *            Martian aurora, photographed by Perseverance after a solar storm
 *            in March 2024, about as faint as a weak aurora on Earth
 *   Jupiter  a dim glow at the poles, caught in visible light only on the night
 *            side (Galileo 1997, NASA PIA00605 / PIA01097). Its colour was
 *            not measured; the gas is hydrogen, the same as Saturn's, so it is
 *            drawn in the same pink-red-to-violet as Saturn's measured one
 *   Saturn   a faint pink-to-purple glow -- Cassini's camera saw it at visible
 *            wavelengths (Dyudina et al. 2016, Icarus 263, 32): pink a few
 *            hundred km above the horizon, purple at 1,000-1,500 km
 *   Uranus   never detected in visible light; hydrogen would glow the same way,
 *            so it is drawn as the faintest of all, pale pink-white
 *
 * Earth's aurora is visible light, so Earth has no entry and is unchanged.
 *
 * `level` is a render value, not a measurement: the owner asked for these to
 * be "very very dim ... barely there", and at 4-6% of the ultraviolet view's
 * strength they are a hint on the night side and invisible on the day side,
 * which is the honest reading. `uSpectrum` switches between the two at run
 * time: 0 is the eye, 1 is the ultraviolet view (scene/ultravioletView.js).
 *
 * `uvA` / `uvB` are the aurora's colours in the ultraviolet view. Ultraviolet
 * has no colour, so these copy how the published ultraviolet images show
 * each one: Jupiter's and Saturn's in blue-violet to white (the Hubble STIS
 * composites -- ESA/Hubble 2016 for Jupiter, heic1815 for Saturn), Uranus's
 * as fuzzy blue-purple glows (ESA/Hubble heic2503, the October 2022
 * images; the 2012 release showed white spots), Mars's in pale blue-white over
 * the night side (no single convention exists for Mars; this matches the
 * blue-to-white brightness scales MAVEN IUVS and EMM EMUS are usually shown
 * in). Brightness and shape are what the instruments measured; the hue is a
 * choice. `uvGain` brightens each in that view only (the owner asked for
 * Jupiter's and Mars's to be stronger; Uranus's spots are small, and Hubble
 * needed a solar storm to catch them). `uvDayLift` stops the sunlit side
 * hiding them there: in the far ultraviolet, where aurora cameras work, a
 * planet reflects little sunlight, so Hubble sees Jupiter's and Saturn's
 * aurorae on the day side too. Mars keeps most of its dimming, because its
 * discrete aurora is a night-side glow.
 */
const EYE_AURORA = Object.freeze({
  Mars: { level: 0.06, colorA: 0x7dffa0, colorB: 0x5be08a, uvA: 0x8fa8ff, uvB: 0xeef0ff, uvGain: 2.4, uvDayLift: 0.35 },
  Jupiter: { level: 0.05, colorA: 0xff4566, colorB: 0x9a6bff, uvA: 0x5f6bff, uvB: 0xe4dcff, uvGain: 2.0, uvDayLift: 0.8 },
  Saturn: { level: 0.05, colorA: 0xff6a96, colorB: 0xa36cff, uvA: 0x6a72ff, uvB: 0xe8e0ff, uvGain: 1.3, uvDayLift: 0.7 },
  Uranus: { level: 0.035, colorA: 0xffc4d2, colorB: 0xffe6ee, uvA: 0x9a6bff, uvB: 0xcfd8ff, uvGain: 3.0, uvDayLift: 0.9 },
});

function jsonColourHex(value) {
  const color = new THREE.Color(value);
  return `vec3(${color.r.toFixed(4)}, ${color.g.toFixed(4)}, ${color.b.toFixed(4)})`;
}

function buildShaderMaterial(config) {
  const {
    primaryColor,
    secondaryColor,
    tertiaryColor,
    latitudeCenter,
    latitudeWidth,
    mirroredStrength,
    longitudeCenter,
    longitudeWidth,
    secondaryLongitudeCenter,
    secondaryLongitudeWidth,
    secondaryLongitudeStrength,
    globalDiffuseStrength,
    intensity,
    faceOnVisibility,
    daysideVisibility,
    arcFrequency,
    spikeFrequency,
    displacementStrength,
    shellAlpha,
    animationSpeed,
    redFringeStrength,
    spiralStrength,
    spiralTurns,
    spiralInnerRadius,
    spiralRadiusSpan,
    spiralArmWidth,
    spiralPhase,
    spiralDirection,
    spiralTwistNoise,
    spiralHemisphere,
  } = config;

  const primary = jsonColourHex(primaryColor);
  const secondary = jsonColourHex(secondaryColor);
  const tertiary = jsonColourHex(tertiaryColor);
  const center = Number(latitudeCenter).toFixed(4);
  const width = Number(latitudeWidth).toFixed(4);
  const mirrored = Number(mirroredStrength).toFixed(4);
  const lonCenter = Number(longitudeCenter).toFixed(4);
  const lonWidth = Number(longitudeWidth).toFixed(4);
  const secondaryLonCenter = Number(secondaryLongitudeCenter).toFixed(4);
  const secondaryLonWidth = Number(secondaryLongitudeWidth).toFixed(4);
  const secondaryLonStrength = Number(secondaryLongitudeStrength).toFixed(4);
  const diffuseStrength = Number(globalDiffuseStrength).toFixed(4);
  const brightness = Number(intensity).toFixed(4);
  const viewFloor = Number(faceOnVisibility).toFixed(4);
  const dayFloor = Number(daysideVisibility).toFixed(4);
  const arcFreq = Number(arcFrequency).toFixed(4);
  const spikeFreq = Number(spikeFrequency).toFixed(4);
  const displacement = Number(displacementStrength).toFixed(4);
  const alphaMax = Number(shellAlpha).toFixed(4);
  const speed = Number(animationSpeed).toFixed(4);
  const fringe = Number(redFringeStrength).toFixed(4);
  const spiralMix = Number(spiralStrength).toFixed(4);
  const turns = Math.max(Number(spiralTurns), 0.1).toFixed(4);
  const innerRadius = Math.max(Number(spiralInnerRadius), 0).toFixed(4);
  const radiusSpan = Math.max(Number(spiralRadiusSpan), 0).toFixed(4);
  const armWidth = Math.max(Number(spiralArmWidth), 0.001).toFixed(4);
  const phase = Number(spiralPhase).toFixed(4);
  const direction = Number(spiralDirection) < 0 ? "-1.0000" : "1.0000";
  const twistNoise = Math.max(Number(spiralTwistNoise), 0).toFixed(4);
  const hemisphere = Number(spiralHemisphere) < 0 ? "-1.0000" : "1.0000";

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAuroraStrength: { value: 1 },
      // 1 = as the spacecraft images show it (the default, and Earth always);
      // 0 = as an eye would see it. See EYE_AURORA.
      uSpectrum: { value: 1 },
      uEyeLevel: { value: 1 },
      uEyeColorA: { value: new THREE.Color(0xffffff) },
      uEyeColorB: { value: new THREE.Color(0xffffff) },
      uUvOverride: { value: 0 },
      uUvColorA: { value: new THREE.Color(0xffffff) },
      uUvColorB: { value: new THREE.Color(0xffffff) },
      uUvGain: { value: 1 },
      uUvDayLift: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uAuroraStrength;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying float vBandMask;
      varying float vSpikeField;
      varying float vLongitudeMask;
      varying float vSpiralProgress;

      const float TAU = 6.28318530718;

      float angleDistance(float a, float b) {
        float delta = abs(a - b);
        return min(delta, TAU - delta);
      }

      float ovalBandMask(float latitude) {
        float primaryBand = exp(-pow((latitude - ${center}) / ${width}, 2.0));
        float mirroredBand = exp(-pow((latitude + ${center}) / (${width} * 1.15), 2.0)) * ${mirrored};
        return clamp(primaryBand + mirroredBand, 0.0, 1.0);
      }

      float spiralProgress(float latitude, float longitude) {
        float hemisphereDirection = latitude >= 0.0 ? 1.0 : -1.0;
        float directedLongitude = longitude * ${direction} * hemisphereDirection + ${phase};
        return fract(directedLongitude / TAU + 1.0);
      }

      float spiralBandMask(float latitude, float longitude, float progress) {
        float poleRadius = acos(clamp(abs(latitude), 0.0, 1.0));
        float animatedRipple = sin(
          longitude * 5.0
          + latitude * 11.0
          + uTime * (${speed} * 0.18)
        ) * (${armWidth} * ${twistNoise});

        float firstProgress = progress;
        float firstTarget = ${innerRadius}
          + ${radiusSpan} * (firstProgress / ${turns})
          + animatedRipple;
        float firstWidth = ${armWidth}
          * (0.86 + 0.14 * sin(longitude * 7.0 + uTime * (${speed} * 0.22)));
        float firstArm = exp(-pow((poleRadius - firstTarget) / firstWidth, 2.0));
        float firstStartFade = smoothstep(0.015, 0.090, firstProgress);
        float firstEndFade = 1.0 - smoothstep(${turns} - 0.080, ${turns}, firstProgress);
        firstArm *= firstStartFade * firstEndFade;

        // A second branch continues the same line beyond one revolution. This
        // is what turns the former closed oval into an open 1–2 turn spiral.
        float secondProgress = progress + 1.0;
        float secondTarget = ${innerRadius}
          + ${radiusSpan} * (secondProgress / ${turns})
          + animatedRipple;
        float secondArm = exp(-pow((poleRadius - secondTarget) / (firstWidth * 1.05), 2.0));
        float secondEndFade = 1.0 - smoothstep(${turns} - 0.080, ${turns}, secondProgress);
        secondArm *= secondEndFade;

        float hemisphereStrength = ${hemisphere} > 0.0
          ? (latitude >= 0.0 ? 1.0 : ${mirrored})
          : (latitude <= 0.0 ? 1.0 : ${mirrored});
        return clamp(max(firstArm, secondArm) * hemisphereStrength, 0.0, 1.0);
      }

      float longitudeMask(float longitude) {
        float primary = exp(-pow(angleDistance(longitude, ${lonCenter}) / ${lonWidth}, 2.0));
        float secondary = exp(-pow(angleDistance(longitude, ${secondaryLonCenter}) / ${secondaryLonWidth}, 2.0)) * ${secondaryLonStrength};
        return clamp(primary + secondary, 0.0, 1.0);
      }

      void main() {
        vec3 localNormal = normalize(position);
        float latitude = localNormal.y;
        float longitude = atan(localNormal.z, localNormal.x);
        float progress = spiralProgress(latitude, longitude);
        float ovalMask = ovalBandMask(latitude);
        float spiralMask = spiralBandMask(latitude, longitude, progress);
        float latMask = mix(ovalMask, spiralMask, ${spiralMix});
        float lonMask = longitudeMask(longitude);
        float mask = latMask * lonMask;

        float sweepingArc = sin(longitude * ${arcFreq} + uTime * (${speed} * 0.35) + sin(longitude * (${arcFreq} * 1.8)) * 0.35) * 0.5 + 0.5;
        float spikes = pow(sin(longitude * ${spikeFreq} + latitude * 16.0 + uTime * (${speed} * 0.7)) * 0.5 + 0.5, 3.0);
        float localHeight = mask * (${displacement} * (0.22 + sweepingArc * 0.52 + spikes * 0.76));
        vec3 displaced = position + localNormal * localHeight;

        vLocalPosition = displaced;
        vBandMask = mask;
        vSpikeField = spikes;
        vLongitudeMask = lonMask;
        vSpiralProgress = progress;
        vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAuroraStrength;
      uniform float uSpectrum;
      uniform float uEyeLevel;
      uniform vec3 uEyeColorA;
      uniform vec3 uEyeColorB;
      uniform float uUvOverride;
      uniform vec3 uUvColorA;
      uniform vec3 uUvColorB;
      uniform float uUvGain;
      uniform float uUvDayLift;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying float vBandMask;
      varying float vSpikeField;
      varying float vLongitudeMask;
      varying float vSpiralProgress;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amplitude;
          p = p * 2.05 + vec2(31.1, 17.7);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 localNormal = normalize(vLocalPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(-vWorldPosition);
        float longitude = atan(localNormal.z, localNormal.x);
        float latitude = localNormal.y;

        float nightside = 1.0 - smoothstep(-0.18, 0.22, dot(normal, lightDirection));
        float limb = pow(1.0 - max(dot(normal, viewDirection), 0.0), 1.08);
        float viewingVisibility = ${viewFloor} + smoothstep(0.03, 0.76, limb) * (1.0 - ${viewFloor});
        float darknessVisibility = mix(${dayFloor}, 1.0, nightside);
        // In the ultraviolet view the sunlit disc is dim in the aurora's own
        // band, so the aurora is not lost against it as it is to an eye.
        darknessVisibility = mix(darknessVisibility, 1.0, uUvDayLift * uUvOverride * uSpectrum);

        float arcNoise = fbm(vec2(longitude * 2.4 + uTime * (${speed} * 0.08), latitude * 24.0));
        float mainArc = sin(longitude * ${arcFreq} + arcNoise * 2.4 + uTime * (${speed} * 0.12)) * 0.5 + 0.5;
        float secondaryArc = sin(longitude * (${arcFreq} * 1.9) - arcNoise * 3.2 - uTime * (${speed} * 0.1)) * 0.5 + 0.5;
        float arcMask = smoothstep(0.18, 0.82, mainArc) * 0.72 + smoothstep(0.44, 0.90, secondaryArc) * 0.28;

        float broadBands = fbm(vec2(longitude * 8.2 + uTime * (${speed} * 0.26), latitude * 28.0 - uTime * (${speed} * 0.12)));
        float fineBands = fbm(vec2(longitude * 22.0 - uTime * (${speed} * 0.65), latitude * 58.0 + uTime * (${speed} * 0.18)));
        float ribs = pow(smoothstep(0.36, 0.92, 0.58 * broadBands + 0.42 * fineBands), 1.6);
        float spikeColumns = pow(smoothstep(0.68, 0.992, sin(longitude * ${spikeFreq} + fineBands * 8.0 + uTime * (${speed} * 0.38)) * 0.5 + 0.5), 2.45);

        float curtain = arcMask * (0.30 + ribs * 0.70) * (0.62 + spikeColumns * 0.50);
        float breathing = 0.92 + sin(uTime * (${speed} * 0.35) + longitude * 2.0) * 0.08;
        // Some planets, especially Mars, can produce diffuse ultraviolet
        // aurora across much of the nightside rather than a narrow polar oval.
        float geographicMask = mix(vBandMask, 1.0, ${diffuseStrength});
        float diffuseTexture = 0.36 + broadBands * 0.40 + fineBands * 0.24;
        float structuredEmission = mix(
          diffuseTexture,
          0.28 + curtain * 0.72,
          1.0 - ${diffuseStrength} * 0.72
        );
        float alpha = geographicMask
          * structuredEmission
          * darknessVisibility
          * viewingVisibility
          * breathing
          * ${brightness}
          * uAuroraStrength;

        // Blue and turquoise form the main emission. In spiral mode, sparse
        // hot knots receive the telescope-mapped orange accent instead of
        // tinting the whole polar region.
        vec3 color = mix(${primary}, ${secondary}, smoothstep(0.34, 0.88, fineBands));
        float upperFringe = smoothstep(0.82, 1.0, clamp(abs(latitude), 0.0, 1.0)) * smoothstep(0.18, 0.82, spikeColumns);
        float hotNoise = fbm(vec2(
          longitude * 11.0 - uTime * (${speed} * 0.24),
          vSpiralProgress * 38.0 + latitude * 21.0
        ));
        float warmKnots = smoothstep(0.69, 0.93, hotNoise)
          * (0.32 + spikeColumns * 0.68)
          * smoothstep(0.16, 0.84, mainArc);
        float tertiaryField = mix(upperFringe, warmKnots, ${spiralMix});
        color = mix(color, ${tertiary}, clamp(tertiaryField * ${fringe}, 0.0, 0.92));
        color *= 0.76 + limb * 1.14;
        color *= 0.92 + spikeColumns * 0.38 + vSpikeField * 0.22;
        color *= 0.80 + vLongitudeMask * 0.24;

        // The ultraviolet view's own colours (second final round): the false
        // colour the published ultraviolet images give each aurora. Only the
        // four eye-limited planets set it; Earth keeps its own.
        vec3 uvColor = mix(uUvColorA, uUvColorB, smoothstep(0.34, 0.88, fineBands));
        uvColor *= (0.76 + limb * 1.14) * (0.92 + spikeColumns * 0.38) * sqrt(uUvGain);
        color = mix(color, uvColor, uUvOverride);
        alpha *= mix(1.0, uUvGain, uUvOverride * uSpectrum);

        // The eye's version: the same shape and motion, in the colour the
        // gas really emits, and a small fraction of the brightness.
        vec3 eyeColor = mix(uEyeColorA, uEyeColorB, smoothstep(0.34, 0.88, fineBands));
        eyeColor *= 0.76 + limb * 1.14;
        color = mix(eyeColor, color, uSpectrum);
        alpha *= mix(uEyeLevel, 1.0, uSpectrum);

        // Earth (and the ultraviolet view) keep the original cut-off.
        if (alpha < mix(0.002, 0.008, uSpectrum)) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, ${alphaMax}));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function segmentsForQuality(quality) {
  if (quality === "low") return 80;
  if (quality === "medium") return 112;
  return 160;
}

export function createPlanetAuroraLayer({
  planet,
  radius,
  quality = "high",
  shellScale = 1.03,
  latitudeCenter = 0.92,
  latitudeWidth = 0.04,
  mirroredStrength = 1,
  longitudeCenter = 0,
  longitudeWidth = Math.PI,
  secondaryLongitudeCenter = Math.PI * 0.7,
  secondaryLongitudeWidth = Math.PI,
  secondaryLongitudeStrength = 0,
  globalDiffuseStrength = 0,
  intensity = 1,
  faceOnVisibility = 0.35,
  daysideVisibility = 0.18,
  arcFrequency = 3.4,
  spikeFrequency = 20,
  displacementStrength = 0.014,
  shellAlpha = 0.95,
  animationSpeed = 1,
  redFringeStrength = 0.30,
  primaryColor = 0x1fff70,
  secondaryColor = 0x49d9ff,
  tertiaryColor = 0xff3d20,
  // Optional polar spiral mode. The default remains the original oval so
  // Earth and Mars keep their existing appearance.
  spiralStrength = 0,
  spiralTurns = 1.35,
  spiralInnerRadius = 0.07,
  spiralRadiusSpan = 0.24,
  spiralArmWidth = 0.018,
  spiralPhase = 0,
  spiralDirection = 1,
  spiralTwistNoise = 0.28,
  spiralHemisphere = 1,
  side = THREE.DoubleSide,
}) {
  const material = buildShaderMaterial({
      primaryColor,
      secondaryColor,
      tertiaryColor,
      latitudeCenter,
      latitudeWidth,
      mirroredStrength,
      longitudeCenter,
      longitudeWidth,
      secondaryLongitudeCenter,
      secondaryLongitudeWidth,
      secondaryLongitudeStrength,
      globalDiffuseStrength,
      intensity,
      faceOnVisibility,
      daysideVisibility,
      arcFrequency,
      spikeFrequency,
      displacementStrength,
      shellAlpha,
      animationSpeed,
      redFringeStrength,
      spiralStrength,
      spiralTurns,
      spiralInnerRadius,
      spiralRadiusSpan,
      spiralArmWidth,
      spiralPhase,
      spiralDirection,
      spiralTwistNoise,
      spiralHemisphere,
    });
  material.side = side;

  const aurora = new THREE.Mesh(
    new THREE.SphereGeometry(radius * shellScale, segmentsForQuality(quality), segmentsForQuality(quality)),
    material,
  );
  aurora.renderOrder = 6;
  aurora.name = `${planet.name} aurora`;
  const eye = EYE_AURORA[planet.name];
  if (eye) {
    material.uniforms.uSpectrum.value = 0;
    material.uniforms.uEyeLevel.value = eye.level;
    material.uniforms.uEyeColorA.value.set(eye.colorA);
    material.uniforms.uEyeColorB.value.set(eye.colorB);
    material.uniforms.uUvOverride.value = 1;
    material.uniforms.uUvColorA.value.set(eye.uvA);
    material.uniforms.uUvColorB.value.set(eye.uvB);
    material.uniforms.uUvGain.value = eye.uvGain ?? 1;
    material.uniforms.uUvDayLift.value = eye.uvDayLift ?? 0;
    aurora.userData.eyeAurora = true;
    /* Where the emission is centred, in the shell's own frame, so the
     * ultraviolet view can turn the camera to face it (latitude is the
     * sine, as the shader reads it; longitude is atan(z, x)). In spiral mode
     * the arms wind round the shell's own pole, a few degrees out, so the
     * centre is pulled to that pole by the spiral's share. */
    aurora.userData.auroraCentre = {
      sinLatitude: latitudeCenter,
      longitude: longitudeCenter,
      wholeRing: longitudeWidth >= Math.PI * 0.9,
      spiral: THREE.MathUtils.clamp(spiralStrength, 0, 1),
    };
  }
  planet.add(aurora);
  return aurora;
}

export function updatePlanetAuroraLayer(aurora, frameScale = 1, { rotationSpeed = 0.00042 } = {}) {
  if (!aurora?.material?.uniforms?.uTime) return;
  aurora.material.uniforms.uTime.value += 0.018 * frameScale;
  aurora.rotation.y += rotationSpeed * frameScale;
}

/**
 * Switches every eye-limited aurora under `root` between the eye (false) and
 * the ultraviolet view (true). Earth's has no eye entry and is left alone.
 */
export function setAuroraSpectrum(root, ultraviolet) {
  root?.traverse?.((object) => {
    if (!object.userData?.eyeAurora) return;
    const uniforms = object.material?.uniforms;
    if (uniforms?.uSpectrum) uniforms.uSpectrum.value = ultraviolet ? 1 : 0;
  });
}

export function setPlanetAuroraStrength(aurora, strength = 1) {
  if (!aurora?.material?.uniforms?.uAuroraStrength) return;
  aurora.material.uniforms.uAuroraStrength.value = THREE.MathUtils.clamp(strength, 0, 1.25);
}

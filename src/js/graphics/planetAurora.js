import * as THREE from "three";

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

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAuroraStrength: { value: 1 },
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

      float angleDistance(float a, float b) {
        float delta = abs(a - b);
        return min(delta, 6.28318530718 - delta);
      }

      float bandMask(float latitude) {
        float primaryBand = exp(-pow((latitude - ${center}) / ${width}, 2.0));
        float mirroredBand = exp(-pow((latitude + ${center}) / (${width} * 1.15), 2.0)) * ${mirrored};
        return clamp(primaryBand + mirroredBand, 0.0, 1.0);
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
        float latMask = bandMask(latitude);
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
        vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAuroraStrength;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying float vBandMask;
      varying float vSpikeField;
      varying float vLongitudeMask;

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

        vec3 color = mix(${primary}, ${secondary}, smoothstep(0.42, 0.86, fineBands));
        float upperFringe = smoothstep(0.82, 1.0, clamp(abs(latitude), 0.0, 1.0)) * smoothstep(0.18, 0.82, spikeColumns);
        color = mix(color, ${tertiary}, upperFringe * ${fringe});
        color *= 0.76 + limb * 1.14;
        color *= 0.92 + spikeColumns * 0.38 + vSpikeField * 0.22;
        color *= 0.80 + vLongitudeMask * 0.24;

        if (alpha < 0.008) discard;
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
}) {
  const aurora = new THREE.Mesh(
    new THREE.SphereGeometry(radius * shellScale, segmentsForQuality(quality), segmentsForQuality(quality)),
    buildShaderMaterial({
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
    }),
  );
  aurora.renderOrder = 6;
  aurora.name = `${planet.name} aurora`;
  planet.add(aurora);
  return aurora;
}

export function updatePlanetAuroraLayer(aurora, frameScale = 1, { rotationSpeed = 0.00042 } = {}) {
  if (!aurora?.material?.uniforms?.uTime) return;
  aurora.material.uniforms.uTime.value += 0.018 * frameScale;
  aurora.rotation.y += rotationSpeed * frameScale;
}

export function setPlanetAuroraStrength(aurora, strength = 1) {
  if (!aurora?.material?.uniforms?.uAuroraStrength) return;
  aurora.material.uniforms.uAuroraStrength.value = THREE.MathUtils.clamp(strength, 0, 1.25);
}

export const galaxyVertexShader = `
  attribute vec4 aGalaxyData;
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vData;
  varying vec3 vWorldDirection;

  void main() {
    vUv = uv;
    vColor = instanceColor;
    vData = aGalaxyData;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const galaxyFragmentShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  varying vec4 vData;
  varying vec3 vWorldDirection;
  uniform float uVisibility;
  uniform float uExposure;
  uniform float uJourneyProgress;
  uniform vec3 uSunDirection;
  uniform float uSunAngularRadius;

  float hash21(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 point = vUv - 0.5;
    float radius = length(point);
    float angle = atan(point.y, point.x);
    float seed = vData.z * 6.2831853;

    float nucleus = exp(-radius * radius * 138.0);
    float disk = exp(-radius * radius * 24.0);
    float broadDisk = exp(-radius * radius * 11.0);
    float armWave = 0.5 + 0.5 * cos(angle * 2.0 - radius * 38.0 + seed);
    float armWaveSecondary = 0.5 + 0.5 * cos(angle * 3.0 - radius * 24.0 - seed * 0.6);
    float spiralArms = disk * (pow(armWave, 2.0) * 0.78 + pow(armWaveSecondary, 3.0) * 0.26)
      * smoothstep(0.03, 0.38, radius);
    float spiral = broadDisk * 0.26 + disk * 0.42 + spiralArms * 0.96 + nucleus * 1.42;

    float edgeDisk = exp(-(point.x * point.x * 12.0 + point.y * point.y * 180.0));
    float edgeBulge = exp(-(point.x * point.x * 54.0 + point.y * point.y * 74.0));
    float dustLane = exp(-abs(point.y) * 108.0) * exp(-point.x * point.x * 22.0);
    float edgeOn = max(0.0, edgeDisk * 1.04 + edgeBulge * 1.26 - dustLane * 0.40);

    float elliptical = exp(-(point.x * point.x * 34.0 + point.y * point.y * 48.0)) * 1.00
      + broadDisk * 0.18 + nucleus * 0.86;

    float irregularNoise = 0.50 + hash21(floor((point + seed) * 18.0)) * 0.50;
    float irregular = (disk * 0.64 + broadDisk * 0.22) * irregularNoise + nucleus * 0.78;

    float typeA = 1.0 - step(0.5, vData.y);
    float typeB = step(0.5, vData.y) * (1.0 - step(1.5, vData.y));
    float typeC = step(1.5, vData.y) * (1.0 - step(2.5, vData.y));
    float typeD = step(2.5, vData.y);
    float shape = spiral * typeA + edgeOn * typeB + elliptical * typeC + irregular * typeD;

    float outerFade = 1.0 - smoothstep(0.46, 0.72, radius);
    shape *= outerFade;

    // Galaxies exist during the whole journey. Zooming outward increases both
    // their visible envelope and nucleus glow instead of spawning them abruptly.
    float adaptation = mix(0.96, 1.70, uJourneyProgress);
    float sunAlignment = clamp(dot(normalize(vWorldDirection), normalize(uSunDirection)), -1.0, 1.0);
    float angularSeparation = acos(sunAlignment);
    float diskFeather = clamp(uSunAngularRadius * 0.035, 0.00008, 0.0012);
    float solarDiskVisibility = smoothstep(
      max(0.0, uSunAngularRadius - diskFeather),
      uSunAngularRadius + diskFeather,
      angularSeparation
    );
    float alpha = shape * vData.x * uVisibility * adaptation * solarDiskVisibility;
    if (alpha < 0.0017) discard;

    vec3 warmCore = vec3(1.0, 0.82, 0.62);
    vec3 galaxyColor = mix(vColor, warmCore, nucleus * (0.38 + uJourneyProgress * 0.24));
    float glow = 1.08 + shape * (1.02 + uJourneyProgress * 0.58) + broadDisk * 0.18;
    gl_FragColor = vec4(galaxyColor * uExposure * glow, alpha);
  }
`;

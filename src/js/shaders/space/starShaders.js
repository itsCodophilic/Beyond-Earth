/** GPU program shared by distant and mid-distance point-star layers. */
export const starVertexShader = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aBrightness;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aHalo;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vPhase;
  varying float vSpeed;
  varying float vHalo;
  varying vec3 vWorldDirection;

  uniform float uPixelRatio;
  uniform float uMaxPointSize;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;

    vColor = aColor;
    vBrightness = aBrightness;
    vPhase = aPhase;
    vSpeed = aSpeed;
    vHalo = aHalo;
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);

    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(
      aSize * uPixelRatio * (1850.0 / max(1.0, -viewPosition.z)),
      0.72,
      uMaxPointSize
    );
  }
`;

export const starFragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vPhase;
  varying float vSpeed;
  varying float vHalo;
  varying vec3 vWorldDirection;

  uniform float uTime;
  uniform float uVisibility;
  uniform float uExposure;
  uniform float uSolarSuppression;
  uniform float uReducedMotion;
  uniform vec3 uSunDirection;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);

    float pinCore = 1.0 - smoothstep(0.025, 0.165, radius);
    float softCore = (1.0 - smoothstep(0.09, 0.33, radius)) * 0.42;
    float halo = (1.0 - smoothstep(0.14, 0.50, radius)) * vHalo * 0.58;

    float shimmer = 1.0 + sin(uTime * vSpeed + vPhase) * 0.018 * (1.0 - uReducedMotion);
    float sunAlignment = max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0);
    float localGlare = pow(sunAlignment, 20.0) * uSolarSuppression;
    float glareSuppression = 1.0 - localGlare * 0.91;

    float alpha = (pinCore + softCore + halo)
      * vBrightness
      * shimmer
      * uVisibility
      * glareSuppression;

    if (alpha < 0.0035 || radius > 0.5) discard;

    vec3 color = vColor * (0.82 + vBrightness * 0.62) * uExposure;
    gl_FragColor = vec4(color, alpha);
  }
`;

/** Rare bright-star shader with tapered four-point optical sparkles. */
export const heroStarVertexShader = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aBrightness;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSpikeAngle;
  attribute float aGlintStrength;

  varying vec3 vColor;
  varying float vBrightness;
  varying float vPhase;
  varying float vSpeed;
  varying float vSpikeAngle;
  varying float vGlintStrength;
  varying vec3 vWorldDirection;

  uniform float uPixelRatio;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;

    vColor = aColor;
    vBrightness = aBrightness;
    vPhase = aPhase;
    vSpeed = aSpeed;
    vSpikeAngle = aSpikeAngle;
    vGlintStrength = aGlintStrength;
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);

    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * (2150.0 / max(1.0, -viewPosition.z)), 8.5, 40.0);
  }
`;

export const heroStarFragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vPhase;
  varying float vSpeed;
  varying float vSpikeAngle;
  varying float vGlintStrength;
  varying vec3 vWorldDirection;

  uniform float uTime;
  uniform float uVisibility;
  uniform float uExposure;
  uniform float uSolarSuppression;
  uniform float uReducedMotion;
  uniform vec3 uSunDirection;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float c = cos(vSpikeAngle);
    float s = sin(vSpikeAngle);
    vec2 rotated = mat2(c, -s, s, c) * point;
    float radius = length(rotated);

    float core = 1.0 - smoothstep(0.018, 0.100, radius);
    float halo = (1.0 - smoothstep(0.055, 0.48, radius)) * 0.24;

    // Long, tapered four-point spikes create the optical ✦ appearance while
    // retaining a physically small stellar core.
    float horizontal = exp(-abs(rotated.y) * 150.0)
      * pow(max(1.0 - abs(rotated.x) * 2.0, 0.0), 2.2);
    float vertical = exp(-abs(rotated.x) * 150.0)
      * pow(max(1.0 - abs(rotated.y) * 2.0, 0.0), 2.2);

    vec2 diagonalPoint = vec2(rotated.x + rotated.y, rotated.x - rotated.y) * 0.7071;
    float diagonals = (
      exp(-abs(diagonalPoint.x) * 168.0) * pow(max(1.0 - abs(diagonalPoint.y) * 2.4, 0.0), 2.2)
      + exp(-abs(diagonalPoint.y) * 168.0) * pow(max(1.0 - abs(diagonalPoint.x) * 2.4, 0.0), 2.2)
    ) * 0.14;

    float slowShimmer = 1.0 + sin(uTime * vSpeed + vPhase) * 0.035 * (1.0 - uReducedMotion);
    float glintWave = 0.5 + 0.5 * sin(uTime * (vSpeed * 0.42) + vPhase * 1.7);
    float rareGlint = 1.0 + pow(glintWave, 16.0) * vGlintStrength * 0.45 * (1.0 - uReducedMotion);

    float glare = pow(max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0), 18.0);
    float spikes = (horizontal + vertical) * (0.54 + vGlintStrength * 0.28) + diagonals;
    float alpha = (core + halo + spikes)
      * vBrightness
      * slowShimmer
      * rareGlint
      * uVisibility
      * (1.0 - glare * uSolarSuppression * 0.90);

    if (alpha < 0.0030 || radius > 0.5) discard;
    gl_FragColor = vec4(vColor * uExposure * (1.08 + core * 0.82 + spikes * 0.42), alpha);
  }
`;

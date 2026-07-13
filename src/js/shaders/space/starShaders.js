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
      aSize * uPixelRatio * (1150.0 / max(1.0, -viewPosition.z)),
      0.55,
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
    float distanceFromCentre = length(point);
    float core = 1.0 - smoothstep(0.08, 0.24, distanceFromCentre);
    float halo = (1.0 - smoothstep(0.10, 0.50, distanceFromCentre)) * vHalo;

    // In vacuum stars remain stable. The optional cinematic variation is kept
    // inside the requested 0.96–1.04 range and is disabled for reduced motion.
    float shimmer = 1.0 + sin(uTime * vSpeed + vPhase) * 0.02 * (1.0 - uReducedMotion);
    float sunAlignment = max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0);
    float localGlare = pow(sunAlignment, 18.0) * uSolarSuppression;
    float glareSuppression = 1.0 - localGlare * 0.88;
    float alpha = (core + halo) * vBrightness * shimmer * uVisibility * glareSuppression;

    if (alpha < 0.012 || distanceFromCentre > 0.5) discard;
    vec3 color = vColor * (0.70 + vBrightness * 0.45) * uExposure;
    gl_FragColor = vec4(color, alpha);
  }
`;

/** Rare bright-star shader with optical—not physical—diffraction spikes. */
export const heroStarVertexShader = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aBrightness;
  attribute float aPhase;
  attribute float aSpeed;
  varying vec3 vColor;
  varying float vBrightness;
  varying float vPhase;
  varying float vSpeed;
  varying vec3 vWorldDirection;
  uniform float uPixelRatio;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vColor = aColor;
    vBrightness = aBrightness;
    vPhase = aPhase;
    vSpeed = aSpeed;
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * (1700.0 / max(1.0, -viewPosition.z)), 5.0, 22.0);
  }
`;

export const heroStarFragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vPhase;
  varying float vSpeed;
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
    float core = 1.0 - smoothstep(0.025, 0.13, radius);
    float halo = (1.0 - smoothstep(0.08, 0.48, radius)) * 0.25;
    float horizontal = exp(-abs(point.y) * 92.0) * (1.0 - smoothstep(0.08, 0.50, abs(point.x)));
    float vertical = exp(-abs(point.x) * 92.0) * (1.0 - smoothstep(0.08, 0.50, abs(point.y)));
    vec2 diagonalPoint = vec2(point.x + point.y, point.x - point.y) * 0.7071;
    float diagonals = (
      exp(-abs(diagonalPoint.x) * 112.0) + exp(-abs(diagonalPoint.y) * 112.0)
    ) * (1.0 - smoothstep(0.05, 0.34, radius)) * 0.20;
    float shimmer = 1.0 + sin(uTime * vSpeed + vPhase) * 0.06 * (1.0 - uReducedMotion);
    float glare = pow(max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0), 16.0);
    float alpha = (core + halo + (horizontal + vertical) * 0.52 + diagonals)
      * vBrightness * shimmer * uVisibility * (1.0 - glare * uSolarSuppression * 0.92);

    if (alpha < 0.01 || radius > 0.5) discard;
    gl_FragColor = vec4(vColor * uExposure * (0.9 + core * 0.55), alpha);
  }
`;


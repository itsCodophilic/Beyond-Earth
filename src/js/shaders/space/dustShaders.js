export const dustVertexShader = `
  attribute float aSize;
  attribute float aPhase;

  varying float vScatter;
  varying float vPhase;

  uniform float uPixelRatio;
  uniform vec3 uSunPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vec3 lightDirection = normalize(uSunPosition - worldPosition.xyz);
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
    float alignment = max(dot(lightDirection, viewDirection), 0.0);

    // Grains become visible primarily in forward-scattering geometry.
    vScatter = 0.012 + pow(alignment, 10.0) * 0.988;
    vPhase = aPhase;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * (150.0 / max(1.0, -viewPosition.z)), 0.34, 1.55);
  }
`;

export const dustFragmentShader = `
  varying float vScatter;
  varying float vPhase;

  uniform float uTime;
  uniform float uVisibility;
  uniform float uReducedMotion;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float grain = 1.0 - smoothstep(0.08, 0.44, radius);
    float driftLight = 0.97 + sin(uTime * 0.07 + vPhase) * 0.03 * (1.0 - uReducedMotion);
    float alpha = grain * vScatter * uVisibility * driftLight;

    if (alpha < 0.008) discard;
    gl_FragColor = vec4(vec3(0.86, 0.77, 0.64), alpha * 0.16);
  }
`;

export const zodiacalVertexShader = `
  varying vec3 vWorldDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const zodiacalFragmentShader = `
  varying vec3 vWorldDirection;

  uniform vec3 uSunDirection;
  uniform float uVisibility;

  float hash31(vec3 point) {
    return fract(sin(dot(point, vec3(17.17, 91.73, 43.11))) * 43758.5453);
  }

  void main() {
    vec3 direction = normalize(vWorldDirection);
    float ecliptic = exp(-pow(abs(direction.y) / 0.075, 1.65));
    float towardSun = pow(max(dot(direction, normalize(uSunDirection)), 0.0), 6.0);
    float oppositeSun = pow(max(dot(direction, -normalize(uSunDirection)), 0.0), 9.0) * 0.10;
    float variation = 0.88 + hash31(floor(direction * 52.0)) * 0.12;
    float alpha = ecliptic * (towardSun + oppositeSun) * uVisibility * variation * 0.055;

    if (alpha < 0.0015) discard;
    gl_FragColor = vec4(vec3(0.55, 0.45, 0.34), alpha);
  }
`;

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
    vScatter = 0.06 + pow(alignment, 7.0) * 0.94;
    vPhase = aPhase;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * (180.0 / max(1.0, -viewPosition.z)), 0.45, 2.4);
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
    float grain = 1.0 - smoothstep(0.10, 0.48, radius);
    float driftLight = 0.94 + sin(uTime * 0.10 + vPhase) * 0.06 * (1.0 - uReducedMotion);
    float alpha = grain * vScatter * uVisibility * driftLight;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vec3(0.92, 0.82, 0.64), alpha * 0.42);
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
    float ecliptic = exp(-pow(abs(direction.y) / 0.105, 1.42));
    float towardSun = pow(max(dot(direction, normalize(uSunDirection)), 0.0), 4.0);
    float oppositeSun = pow(max(dot(direction, -normalize(uSunDirection)), 0.0), 7.0) * 0.18;
    float variation = 0.82 + hash31(floor(direction * 48.0)) * 0.18;
    float alpha = ecliptic * (towardSun + oppositeSun) * uVisibility * variation * 0.20;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vec3(0.62, 0.51, 0.37), alpha);
  }
`;


export const dustVertexShader = `
  attribute float aSize;
  attribute float aPhase;

  varying float vScatter;
  varying float vPhase;
  varying float vSunClearance;

  uniform float uPixelRatio;
  uniform vec3 uSunPosition;
  uniform float uSunRadius;
  uniform float uSunAngularRadius;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * worldPosition;
    vec3 lightDirection = normalize(uSunPosition - worldPosition.xyz);
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
    float alignment = max(dot(lightDirection, viewDirection), 0.0);

    // Suppress only fragments whose point centre lies on the physical solar disk.
    // The corona and surrounding dust remain visible, avoiding an artificial dark cavity.
    vec3 cameraToGrain = normalize(worldPosition.xyz - cameraPosition);
    vec3 cameraToSun = normalize(uSunPosition - cameraPosition);
    float angularSeparation = acos(clamp(dot(cameraToGrain, cameraToSun), -1.0, 1.0));
    float diskFeather = clamp(uSunAngularRadius * 0.035, 0.00008, 0.0012);
    vSunClearance = smoothstep(
      max(0.0, uSunAngularRadius - diskFeather),
      uSunAngularRadius + diskFeather,
      angularSeparation
    );

    // Grains become visible primarily in forward-scattering geometry.
    vScatter = 0.030 + pow(alignment, 8.0) * 0.970;
    vPhase = aPhase;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = clamp(aSize * uPixelRatio * (175.0 / max(1.0, -viewPosition.z)), 0.40, 2.25);
  }
`;

export const dustFragmentShader = `
  varying float vScatter;
  varying float vPhase;
  varying float vSunClearance;

  uniform float uTime;
  uniform float uVisibility;
  uniform float uReducedMotion;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    float grain = 1.0 - smoothstep(0.06, 0.46, radius);
    float driftLight = 0.97 + sin(uTime * 0.07 + vPhase) * 0.03 * (1.0 - uReducedMotion);
    float alpha = grain * vScatter * uVisibility * driftLight * vSunClearance;

    if (alpha < 0.006) discard;
    gl_FragColor = vec4(vec3(0.88, 0.80, 0.69), alpha * 0.18);
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
  uniform float uSunAngularRadius;
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
    float sunAlignment = clamp(dot(direction, normalize(uSunDirection)), -1.0, 1.0);
    float angularSeparation = acos(sunAlignment);
    float diskFeather = clamp(uSunAngularRadius * 0.035, 0.00008, 0.0012);
    float solarDiskVisibility = smoothstep(
      max(0.0, uSunAngularRadius - diskFeather),
      uSunAngularRadius + diskFeather,
      angularSeparation
    );
    float alpha = ecliptic * (towardSun + oppositeSun) * uVisibility * variation * 0.055
      * solarDiskVisibility;

    if (alpha < 0.0015) discard;
    gl_FragColor = vec4(vec3(0.55, 0.45, 0.34), alpha);
  }
`;

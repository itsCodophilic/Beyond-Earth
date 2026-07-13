export const milkyWayVertexShader = `
  varying vec3 vDirection;
  varying vec3 vWorldDirection;
  void main() {
    vDirection = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const milkyWayFragmentShader = `
  varying vec3 vDirection;
  varying vec3 vWorldDirection;
  uniform float uVisibility;
  uniform float uContrast;
  uniform float uSolarSuppression;
  uniform vec3 uSunDirection;

  float hash(vec3 point) {
    point = fract(point * 0.3183099 + 0.1);
    point *= 17.0;
    return fract(point.x * point.y * point.z * (point.x + point.y + point.z));
  }

  float noise3(vec3 point) {
    vec3 cell = floor(point);
    vec3 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1,0,0)), local.x),
          mix(hash(cell + vec3(0,1,0)), hash(cell + vec3(1,1,0)), local.x), local.y),
      mix(mix(hash(cell + vec3(0,0,1)), hash(cell + vec3(1,0,1)), local.x),
          mix(hash(cell + vec3(0,1,1)), hash(cell + vec3(1,1,1)), local.x), local.y),
      local.z
    );
  }

  float fbm(vec3 point) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 5; octave++) {
      value += noise3(point) * amplitude;
      point = point * 2.03 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.48;
    }
    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float latitude = asin(clamp(direction.y, -1.0, 1.0));
    float longitude = atan(direction.z, direction.x);
    float cloudA = fbm(direction * 7.0 + vec3(3.2, 8.4, 1.7));
    float cloudB = fbm(direction * 20.0 + vec3(11.0, 2.0, 6.0));
    float warpedLatitude = latitude + sin(longitude * 2.0) * 0.026 + sin(longitude * 5.0 + cloudA) * 0.014;
    // A broad, soft veil keeps some galactic structure in ordinary Solar-System
    // camera angles; the brighter ridge still identifies the true galactic plane.
    float broadBand = exp(-pow(abs(warpedLatitude) / 0.38, 1.42));
    float centralRidge = exp(-pow(abs(warpedLatitude) / 0.16, 1.58));
    float core = exp(-pow(abs(longitude) / 0.82, 1.65));

    // Multiple offset absorptive structures read as branching dust rifts rather
    // than one clean black stripe painted across the sky.
    float laneA = exp(-pow(abs(warpedLatitude - sin(longitude * 3.1 + cloudA * 2.4) * 0.021) / 0.033, 1.32));
    float laneB = exp(-pow(abs(warpedLatitude + 0.055 + sin(longitude * 1.7 - 0.8) * 0.018) / 0.020, 1.42));
    float dustAbsorption = clamp(laneA * (0.38 + cloudB * 0.52) + laneB * cloudA * 0.42, 0.0, 0.88);
    float density = broadBand * (0.28 + cloudA * 0.58 + cloudB * 0.24);
    density += centralRidge * (0.09 + cloudB * 0.15);
    density *= 0.68 + core * 0.76;
    density *= 1.0 - dustAbsorption;

    float luminousClouds = broadBand * smoothstep(0.66, 1.05, cloudB);
    density += luminousClouds * (0.08 + core * 0.10);

    vec3 coolOuter = vec3(0.38, 0.49, 0.69);
    vec3 warmCore = vec3(0.92, 0.69, 0.52);
    vec3 color = mix(coolOuter, warmCore, core * 0.70 + cloudA * 0.12);
    color = mix(color, vec3(0.68, 0.58, 0.76), luminousClouds * 0.16);

    // Bright local glare hides only the small patch of sky close to the Sun.
    // It never globally removes the Milky Way from the Solar System.
    float sunAlignment = max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0);
    float localGlare = pow(sunAlignment, 16.0) * uSolarSuppression;
    float alpha = density * uVisibility * 0.92 * uContrast * (1.0 - localGlare * 0.82);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(color * (0.68 + density * 0.82), clamp(alpha, 0.0, 0.78));
  }
`;

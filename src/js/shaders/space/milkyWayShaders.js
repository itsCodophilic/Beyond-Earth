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
      mix(
        mix(hash(cell), hash(cell + vec3(1.0, 0.0, 0.0)), local.x),
        mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), local.x),
        local.y
      ),
      mix(
        mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), local.x),
        mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0, 1.0, 1.0)), local.x),
        local.y
      ),
      local.z
    );
  }

  float fbm(vec3 point) {
    float value = 0.0;
    float amplitude = 0.52;

    for (int octave = 0; octave < 5; octave++) {
      value += noise3(point) * amplitude;
      point = point * 2.04 + vec3(7.1, 3.7, 5.9);
      amplitude *= 0.47;
    }

    return value;
  }

  float sphericalCloud(vec3 direction, vec3 centre, float sharpness) {
    return pow(max(dot(direction, normalize(centre)), 0.0), sharpness);
  }

  void main() {
    vec3 direction = normalize(vDirection);

    float largeClouds = fbm(direction * 4.4 + vec3(3.2, 8.4, 1.7));
    float mediumClouds = fbm(direction * 12.0 + vec3(11.0, 2.0, 6.0));
    float fineClouds = fbm(direction * 30.0 + vec3(5.7, 14.0, 2.6));

    // Use only continuous Cartesian direction components. Unlike atan-based
    // longitude, these expressions have no +/-PI discontinuity and therefore
    // cannot create the straight vertical seam seen in the previous version.
    float warpedPlane = direction.y
      - sin(direction.x * 4.8 + direction.z * 1.7) * 0.048
      - sin(direction.z * 7.1 - direction.x * 2.2) * 0.017;
    float bandDistance = abs(warpedPlane);
    float broadBand = exp(-pow(bandDistance / 0.29, 1.55));
    float resolvedRidge = exp(-pow(bandDistance / 0.105, 1.60));

    vec3 galacticCoreDirection = normalize(vec3(0.94, 0.055, 0.31));
    float centralBulge = pow(max(dot(direction, galacticCoreDirection), 0.0), 4.2);

    float cloudyEnvelope = smoothstep(0.22, 0.82, largeClouds * 0.66 + mediumClouds * 0.34);
    float fineStructure = smoothstep(0.32, 0.79, mediumClouds * 0.58 + fineClouds * 0.42);

    float density = broadBand * (0.065 + cloudyEnvelope * 0.32);
    density += resolvedRidge * (0.055 + fineStructure * 0.31);
    density *= 0.75 + centralBulge * 0.84;

    // Broken absorbing lanes follow the galactic plane, but never form one
    // continuous black ruler-like stripe.
    float laneWarp = warpedPlane + (mediumClouds - 0.5) * 0.029;
    float lane = exp(-pow(abs(laneWarp) / 0.017, 1.5));
    lane *= smoothstep(0.44, 0.78, fineClouds);
    lane *= 0.35 + smoothstep(0.30, 0.76, largeClouds) * 0.65;
    density *= 1.0 - lane * 0.44;

    // Sparse high-latitude dust islands distribute structure above and below
    // the principal Milky Way band. This keeps the sky three-dimensional and
    // avoids a scene where every cloud is compressed into a horizontal strip.
    float islandA = sphericalCloud(direction, vec3(-0.46, 0.72, -0.52), 7.0);
    float islandB = sphericalCloud(direction, vec3(0.34, -0.76, -0.55), 8.0);
    float islandC = sphericalCloud(direction, vec3(-0.72, -0.33, 0.61), 9.0);
    float islandD = sphericalCloud(direction, vec3(0.62, 0.55, 0.56), 10.0);
    float islandMask = islandA + islandB * 0.82 + islandC * 0.70 + islandD * 0.62;
    float islandTexture = smoothstep(0.36, 0.78, largeClouds * 0.58 + mediumClouds * 0.42);
    float offPlaneClouds = islandMask * islandTexture * (0.030 + fineStructure * 0.075);
    density += offPlaneClouds;

    float warmKnots = resolvedRidge * smoothstep(0.70, 0.93, fineClouds) * centralBulge;

    vec3 coolOuter = vec3(0.34, 0.42, 0.58);
    vec3 neutralDust = vec3(0.62, 0.58, 0.57);
    vec3 warmCore = vec3(0.84, 0.66, 0.50);
    vec3 highLatitudeDust = vec3(0.44, 0.49, 0.60);
    vec3 color = mix(coolOuter, neutralDust, cloudyEnvelope * 0.52);
    color = mix(color, warmCore, centralBulge * 0.50 + warmKnots * 0.30);
    color = mix(color, highLatitudeDust, clamp(offPlaneClouds * 5.5, 0.0, 0.42));

    float sunAlignment = max(dot(normalize(vWorldDirection), normalize(uSunDirection)), 0.0);
    float localGlare = pow(sunAlignment, 18.0) * uSolarSuppression;

    float alpha = density * uVisibility * uContrast * (1.0 - localGlare * 0.88);
    alpha = min(alpha, 0.66);
    if (alpha < 0.0010) discard;

    vec3 finalColor = color * (0.68 + density * 1.90 + warmKnots * 0.54);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

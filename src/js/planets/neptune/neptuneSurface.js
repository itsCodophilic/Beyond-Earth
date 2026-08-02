/**
 * Neptune's procedural visible atmosphere.
 *
 * The planet is intentionally not image-wrapped. A flat photograph pinches at
 * the poles and stretches when it is placed on a sphere. These materials sample
 * continuous 3D directions instead, then place two real cloud shells above the
 * deep atmosphere. The result stays seamless while the camera circles Neptune.
 */
import * as THREE from "three";

const NEPTUNE_OBLATENESS = 0.983;

const noiseFunctions = /* glsl */ `
  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 p) {
    vec3 cell = floor(p);
    vec3 local = fract(p);
    local = local * local * (3.0 - 2.0 * local);

    float n000 = hash31(cell + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(cell + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(cell + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(cell + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(cell + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(cell + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(cell + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(cell + vec3(1.0, 1.0, 1.0));

    float x00 = mix(n000, n100, local.x);
    float x10 = mix(n010, n110, local.x);
    float x01 = mix(n001, n101, local.x);
    float x11 = mix(n011, n111, local.x);
    return mix(mix(x00, x10, local.y), mix(x01, x11, local.y), local.z);
  }

  float fbm3D(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      value += noise3D(p) * amplitude;
      p = p * 2.03 + vec3(7.1, 11.7, 5.9);
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 rotateY(vec3 direction, float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return vec3(
      cosine * direction.x + sine * direction.z,
      direction.y,
      -sine * direction.x + cosine * direction.z
    );
  }

  float wrappedLongitudeDelta(float longitude, float center) {
    return atan(sin(longitude - center), cos(longitude - center));
  }

  vec2 ovalCoordinates(
    float longitude,
    float latitude,
    float centerLongitude,
    float centerLatitude,
    float width,
    float height
  ) {
    return vec2(
      wrappedLongitudeDelta(longitude, centerLongitude) / width,
      (latitude - centerLatitude) / height
    );
  }

  float latitudeLane(float latitude, float center, float halfWidth, float feather) {
    return 1.0 - smoothstep(halfWidth, halfWidth + feather, abs(latitude - center));
  }

  mat2 rotate2D(float angle) {
    float cosine = cos(angle);
    float sine = sin(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  // Breaks up an analytical oval with multiple atmospheric flow fields. The
  // wide feather is important: gas vortices blend into nearby cloud lanes and
  // never have the clean edge of a decal or painted circle.
  float organicVortex(vec2 coordinates, float broadFlow, float fineFlow) {
    float radius = length(coordinates);
    float angle = atan(coordinates.y, coordinates.x);
    float boundary = 0.94
      + (broadFlow - 0.5) * 0.36
      + (fineFlow - 0.5) * 0.15
      + sin(angle * 3.0 + broadFlow * 4.0) * 0.055;
    return 1.0 - smoothstep(boundary * 0.58, boundary * 1.16, radius);
  }

  // Produces a broken, curved methane-cloud streamer rather than a geometric
  // ellipse. Coordinates remain local to a storm so the wisp follows it.
  float turbulentWisp(vec2 coordinates, float broadFlow, float fineFlow) {
    float bend = sin(coordinates.x * 2.35 + broadFlow * 4.0) * 0.18;
    float ridge = exp(-(
      coordinates.x * coordinates.x * 0.82
      + pow(coordinates.y + bend, 2.0) * 5.6
    ));
    float brokenEdge = smoothstep(0.24, 0.78, broadFlow * 0.58 + fineFlow * 0.42);
    return ridge * mix(0.20, 1.0, brokenEdge);
  }
`;

const sharedVertexShader = /* glsl */ `
  varying vec3 vObjectDirection;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Object-space direction keeps all atmosphere patterns continuous across
    // longitude zero and prevents UV spokes at Neptune's poles.
    vObjectDirection = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

/**
 * Creates the opaque, deep atmosphere seen beneath Neptune's methane clouds.
 */
export function createNeptuneSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uInspection: { value: 0 },
    },
    vertexShader: sharedVertexShader,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uInspection;

      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      ${noiseFunctions}

      void main() {
        // Neptune's differential winds move latitude lanes at subtly different
        // rates. Motion remains slow enough to feel planetary rather than liquid.
        vec3 direction = normalize(vObjectDirection);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float wind = 0.0032 + abs(latitude) * 0.0018;
        vec3 movingDirection = rotateY(direction, uTime * wind);
        float longitude = atan(movingDirection.z, movingDirection.x);

        float broadHaze = fbm3D(vec3(
          movingDirection.x * 3.4,
          movingDirection.y * 15.0,
          movingDirection.z * 3.4
        ));
        float fineHaze = fbm3D(vec3(
          movingDirection.x * 7.0,
          movingDirection.y * 54.0,
          movingDirection.z * 7.0
        ) + vec3(0.0, uTime * 0.0013, 0.0));

        // A deep cobalt body with a brighter methane-blue equatorial region.
        vec3 polarBlue = vec3(0.018, 0.075, 0.31);
        vec3 middleBlue = vec3(0.025, 0.22, 0.67);
        vec3 equatorialBlue = vec3(0.025, 0.39, 0.82);
        float equatorialWeight = 1.0 - smoothstep(0.12, 0.88, abs(direction.y));
        vec3 color = mix(polarBlue, middleBlue, smoothstep(0.02, 0.66, equatorialWeight));
        color = mix(color, equatorialBlue, equatorialWeight * 0.48);

        // Voyager-like belts are very restrained: wide atmospheric lanes with
        // soft edges, never repeated graphic stripes.
        float northLane = latitudeLane(latitude, 0.47, 0.055, 0.09);
        float equatorialLane = latitudeLane(latitude, 0.02, 0.10, 0.13);
        float southLane = latitudeLane(latitude, -0.55, 0.045, 0.09);
        float laneVariation = mix(0.72, 1.0, broadHaze);
        color = mix(color, vec3(0.11, 0.46, 0.86), northLane * laneVariation * 0.13);
        color = mix(color, vec3(0.03, 0.27, 0.70), equatorialLane * 0.11);
        color = mix(color, vec3(0.12, 0.42, 0.82), southLane * laneVariation * 0.10);
        color *= 0.94 + (broadHaze - 0.5) * 0.12 + (fineHaze - 0.5) * 0.055;

        // The Great Dark Spot is sculpted from turbulent flow rather than an
        // ellipse drawn on the globe. Noise warps its footprint, a gentle twist
        // shears its atmosphere, and its edges dissolve into the jet stream.
        float stormLongitude = -0.64 + uTime * 0.0015;
        vec2 greatSpotCoordinates = ovalCoordinates(
          longitude,
          latitude,
          stormLongitude,
          -0.20,
          0.34,
          0.145
        );
        float stormBroadFlow = fbm3D(movingDirection * 17.0 + vec3(4.2, -2.8, uTime * 0.002));
        float stormFineFlow = fbm3D(movingDirection * 49.0 + vec3(-7.3, 3.1, -uTime * 0.004));
        float stormRadius = length(greatSpotCoordinates);
        float stormTwist = (1.0 - smoothstep(0.12, 1.35, stormRadius))
          * (0.42 + (stormBroadFlow - 0.5) * 0.34);
        vec2 warpedStorm = rotate2D(stormTwist) * greatSpotCoordinates;
        warpedStorm += vec2(stormBroadFlow - 0.5, stormFineFlow - 0.5) * 0.17;
        float greatSpot = organicVortex(warpedStorm, stormBroadFlow, stormFineFlow);
        float stormDepth = greatSpot * mix(0.55, 0.88, stormBroadFlow);
        vec3 stormColor = mix(
          vec3(0.007, 0.030, 0.115),
          vec3(0.018, 0.105, 0.28),
          smoothstep(0.20, 0.84, stormFineFlow)
        );
        color = mix(color, stormColor, stormDepth * 0.72);

        // A diffuse wake trails into the surrounding latitude lane. Because it
        // shares the same noise field, it reads as weather—not a second circle.
        vec2 wakeCoordinates = vec2(
          max(greatSpotCoordinates.x - 0.48, 0.0) * 0.70,
          greatSpotCoordinates.y + sin(greatSpotCoordinates.x * 1.8) * 0.15
        );
        float stormWake = turbulentWisp(wakeCoordinates, stormBroadFlow, stormFineFlow)
          * smoothstep(0.16, 0.92, greatSpotCoordinates.x);
        color = mix(color, vec3(0.018, 0.13, 0.36), stormWake * 0.24);

        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float sunAmount = dot(normal, lightDirection);
        float daylight = smoothstep(-0.15, 0.24, sunAmount);
        float diffuse = 0.17 + max(sunAmount, 0.0) * 1.02;

        // Nearby inspection retains a restrained blue bounce light while the
        // far-side terminator remains unmistakably dark and spherical.
        float viewFacing = max(dot(normal, viewDirection), 0.0);
        float inspectionFill = mix(0.045, 0.105, uInspection);
        float cameraFacingBounce = pow(viewFacing, 0.72) * uInspection * 0.30;
        color *= mix(inspectionFill + cameraFacingBounce, diffuse, daylight);

        float limb = pow(1.0 - viewFacing, 3.1);
        float forwardScattering = pow(max(dot(viewDirection, lightDirection), 0.0), 12.0);
        color += vec3(0.055, 0.31, 0.92) * limb * (0.08 + daylight * 0.12);
        color += vec3(0.12, 0.40, 0.90) * forwardScattering * 0.035;

        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
      }
    `,
    depthWrite: true,
    depthTest: true,
  });
}

/**
 * Creates one transparent cloud altitude. The lower deck carries broad haze;
 * the upper deck carries sparse, brilliant methane-ice formations.
 */
function createNeptuneCloudMaterial({ layer, opacity }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLayer: { value: layer },
      uOpacity: { value: opacity },
    },
    vertexShader: sharedVertexShader,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLayer;
      uniform float uOpacity;

      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      ${noiseFunctions}

      void main() {
        vec3 direction = normalize(vObjectDirection);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float windSpeed = mix(0.0047, 0.0074, uLayer) + abs(latitude) * 0.0015;
        vec3 movingDirection = rotateY(direction, uTime * windSpeed + uLayer * 1.7);
        float longitude = atan(movingDirection.z, movingDirection.x);

        // Stretch noise along latitude so clouds follow Neptune's zonal winds.
        float broadFlow = fbm3D(vec3(
          movingDirection.x * mix(3.1, 4.8, uLayer),
          movingDirection.y * mix(30.0, 51.0, uLayer),
          movingDirection.z * mix(3.1, 4.8, uLayer)
        ) + vec3(uTime * 0.0014, 0.0, -uTime * 0.0011));
        float detailFlow = fbm3D(vec3(
          movingDirection.x * mix(8.0, 12.0, uLayer),
          movingDirection.y * mix(86.0, 126.0, uLayer),
          movingDirection.z * mix(8.0, 12.0, uLayer)
        ) + vec3(-uTime * 0.003, uTime * 0.001, uTime * 0.002));

        float laneA = latitudeLane(latitude, -0.105, 0.13, 0.105);
        float laneB = latitudeLane(latitude, 0.37, 0.065, 0.085);
        float laneC = latitudeLane(latitude, -0.58, 0.05, 0.075);
        float activeLanes = max(laneA, max(laneB, laneC));

        float threshold = mix(0.595, 0.700, uLayer);
        float wisps = smoothstep(threshold, threshold + 0.12, broadFlow * 0.63 + detailFlow * 0.37);
        wisps *= activeLanes * mix(0.64, 1.0, detailFlow);

        // Bright companion clouds skirt the Great Dark Spot just as Voyager
        // observed, but occupy a genuine higher altitude than the dark vortex.
        float greatLongitude = -0.64 + uTime * 0.0015;
        vec2 companionCoordinates = ovalCoordinates(
          longitude,
          latitude,
          greatLongitude + 0.18,
          -0.105,
          0.31,
          0.052
        );
        float companionTexture = turbulentWisp(
          companionCoordinates,
          broadFlow,
          detailFlow
        );
        vec2 greatSpotCoordinates = ovalCoordinates(
          longitude,
          latitude,
          greatLongitude,
          -0.20,
          0.34,
          0.145
        );
        float stormFlow = fbm3D(movingDirection * 31.0 + vec3(4.2, -3.1, uTime * 0.003));
        vec2 upperWakeCoordinates = vec2(
          greatSpotCoordinates.x * 0.66,
          (greatSpotCoordinates.y - 0.72) * 1.18
        );
        float upperStormWake = turbulentWisp(
          upperWakeCoordinates,
          stormFlow,
          detailFlow
        ) * smoothstep(-0.78, 0.18, greatSpotCoordinates.x);

        vec2 scooterCoordinates = ovalCoordinates(
          longitude,
          latitude,
          1.63 + uTime * 0.006,
          -0.42,
          0.17,
          0.038
        );
        float scooter = turbulentWisp(scooterCoordinates, broadFlow, detailFlow);

        vec2 northCloudCoordinates = ovalCoordinates(
          longitude,
          latitude,
          -2.23 + uTime * 0.004,
          0.32,
          0.14,
          0.030
        );
        float northCloud = turbulentWisp(northCloudCoordinates, detailFlow, broadFlow);

        float stormClouds = max(
          max(companionTexture, upperStormWake * 0.82),
          max(scooter * 0.82, northCloud * 0.72)
        );
        float alpha = max(wisps * mix(0.42, 0.56, uLayer), stormClouds);
        alpha *= uOpacity;

        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float sunlight = smoothstep(-0.08, 0.34, dot(normal, lightDirection));
        float edge = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.0);
        alpha *= mix(0.05, 1.0, sunlight);
        alpha *= 1.0 - edge * 0.38;

        if (alpha < 0.008) discard;

        vec3 lowerCloud = vec3(0.18, 0.58, 0.94);
        vec3 iceCloud = vec3(0.75, 0.93, 1.0);
        vec3 cloudColor = mix(lowerCloud, iceCloud, uLayer * 0.72 + stormClouds * 0.28);
        cloudColor *= 0.70 + detailFlow * 0.32 + sunlight * 0.24;
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
  });
}

/**
 * Adds two separately rotating cloud shells above Neptune's deep atmosphere.
 */
export function createNeptuneAtmosphereLayers({ planet, radius, segmentScale = 1 }) {
  const group = new THREE.Group();
  group.name = "Neptune moving methane clouds";

  const widthSegments = Math.max(96, Math.round(176 * segmentScale));
  const heightSegments = Math.max(72, Math.round(120 * segmentScale));
  const layerDefinitions = [
    { name: "Neptune lower methane haze", scale: 1.0045, layer: 0, opacity: 0.62 },
    { name: "Neptune high methane-ice clouds", scale: 1.0105, layer: 1, opacity: 0.92 },
  ];

  layerDefinitions.forEach((definition) => {
    const geometry = new THREE.SphereGeometry(
      radius * definition.scale,
      widthSegments,
      heightSegments,
    );
    geometry.scale(1, NEPTUNE_OBLATENESS, 1);

    const shell = new THREE.Mesh(
      geometry,
      createNeptuneCloudMaterial(definition),
    );
    shell.name = definition.name;
    shell.renderOrder = 4 + definition.layer;
    group.add(shell);
  });

  planet.add(group);
  return group;
}

/**
 * Advances Neptune's independent wind layers and adapts inspection fill to the
 * camera distance. This does not alter Neptune's orbit or axial rotation.
 */
export function updateNeptuneAtmosphereLayers(planet, cloudGroup, time, motionScale, camera) {
  if (planet.material?.uniforms?.uTime) planet.material.uniforms.uTime.value = time;

  if (camera && planet.material?.uniforms?.uInspection) {
    const worldPosition = new THREE.Vector3();
    planet.getWorldPosition(worldPosition);
    const radius = planet.userData.visualRadius || 1;
    const normalizedDistance = camera.position.distanceTo(worldPosition) / radius;
    planet.material.uniforms.uInspection.value = 1 - THREE.MathUtils.smoothstep(
      normalizedDistance,
      5.0,
      17.0,
    );
  }

  cloudGroup.children.forEach((shell, index) => {
    if (shell.material?.uniforms?.uTime) shell.material.uniforms.uTime.value = time;
    shell.rotation.y += (index === 0 ? 0.000030 : 0.000052) * motionScale;
  });
}

/** Applies Neptune's small, measured equatorial bulge to a sphere geometry. */
export function applyNeptuneOblateness(geometry) {
  geometry.scale(1, NEPTUNE_OBLATENESS, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

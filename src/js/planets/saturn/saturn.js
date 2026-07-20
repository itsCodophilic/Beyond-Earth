/**
 * Saturn configuration and dedicated visible-light surface shader.
 *
 * The surface palette is sampled from the supplied Cassini/NASA north-polar
 * reference: warm ivory equatorial zones, cool pearl-grey high latitudes and a
 * compact blue-grey north-polar hexagon. The pattern is latitude-driven so the
 * cloud regions remain circular around the planet instead of becoming random
 * zigzags or Jupiter-like patches.
 */
import * as THREE from "three";
import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

const scale = PLANET_SCALE_PROFILES.Saturn;

export const saturn = {
  name: "Saturn", texture: "saturn", radius: scale.visualRadius, orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm, diameterEarths: scale.diameterEarths, volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.08, spinSpeed: 0.017, axialTilt: 0.47, angle: 3.1,
  orbitEccentricity: 0.0539, orbitRotation: 4.16, orbitInclination: 0.043,
  bump: 0.01, orbitColor: 0xd9bd84,
  detail: "Ringed giant | about 9× Earth diameter", focusScale: 0.82,
  minFocusDistance: scale.focusDistance * 0.88, focusDistance: scale.focusDistance, focusEase: 0.07, focusFov: 34,
  info: {
    type: "Planet", diameter: "116,460 km", orbitalSpeed: "9.69 km/s",
    distanceFromEarth: "≈ 1.2 billion km at closest approach",
    sizeComparison: getPlanetSizeComparison("Saturn"),
    description: "A pale gas giant encircled by countless shards of ice and rock forming the Solar System's grandest rings.",
  },
};

/**
 * Creates Saturn's Cassini-inspired visible-light cloud surface.
 *
 * The source image is a polar perspective rather than an equirectangular map,
 * so it cannot be wrapped directly around a sphere. This shader reconstructs
 * the same visual language procedurally in true 3D:
 * - circular latitude zones with many fine, low-contrast cloud bands
 * - bright ivory equatorial atmosphere
 * - cooler pearl-grey northern latitudes
 * - a six-sided blue-grey north-polar hexagon and concentric vortex eye
 * - a narrow, pale storm track matching the reference's mid-latitude ribbon
 */
export function createSaturnSurfaceMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture },

      // Palette sampled from the supplied reference image. Hex values are kept
      // together here so the look can be tuned without editing GLSL logic.
      uEquatorialIvory: { value: new THREE.Color(0xf3e5cb) },
      uWarmCream: { value: new THREE.Color(0xd7c4a7) },
      uSoftSand: { value: new THREE.Color(0xb8a48f) },
      uPearlGrey: { value: new THREE.Color(0x91a2a3) },
      uCoolHighLatitude: { value: new THREE.Color(0x4f7f89) },
      uHexagonBlue: { value: new THREE.Color(0x3d8a98) },
      uVortexBlue: { value: new THREE.Color(0x0f2f66) },
      uEyeLavender: { value: new THREE.Color(0x7064ad) },
      uStormWhite: { value: new THREE.Color(0xf3ecde) },
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vObjectDirection = normalize(position);

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,

    fragmentShader: `
      #define PI 3.14159265359

      uniform float uTime;
      uniform sampler2D uMap;
      uniform vec3 uEquatorialIvory;
      uniform vec3 uWarmCream;
      uniform vec3 uSoftSand;
      uniform vec3 uPearlGrey;
      uniform vec3 uCoolHighLatitude;
      uniform vec3 uHexagonBlue;
      uniform vec3 uVortexBlue;
      uniform vec3 uEyeLavender;
      uniform vec3 uStormWhite;

      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
      }

      float fbm3D(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int octave = 0; octave < 4; octave++) {
          value += noise3D(p) * amplitude;
          p = p * 2.02 + vec3(6.4, 10.1, 4.8);
          amplitude *= 0.5;
        }
        return value;
      }

      mat2 rotate2D(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat2(c, -s, s, c);
      }

      float latitudeBand(float latitude, float centre, float halfWidth, float feather) {
        return 1.0 - smoothstep(halfWidth, halfWidth + feather, abs(latitude - centre));
      }

      // Signed distance-like measurement for a regular hexagon. Applied to the
      // x/z plane near the north pole, it creates Saturn's true circular polar
      // region with a six-sided boundary rather than a painted zigzag stripe.
      float hexDistance(vec2 point) {
        vec2 p = abs(point);
        return max(p.y, dot(p, vec2(0.8660254, 0.5)));
      }

      void main() {
        vec3 direction = normalize(vObjectDirection);
        float latitude = asin(clamp(direction.y, -1.0, 1.0));
        float longitude = atan(direction.z, direction.x);
        float north = max(direction.y, 0.0);
        float northLatitude = smoothstep(0.08, 1.22, latitude);
        float equatorialWeight = 1.0 - smoothstep(0.08, 0.72, abs(latitude));

        // Broad colour zoning. These transitions form complete circular regions
        // around Saturn, matching the reference instead of producing isolated
        // Jupiter-like patches.
        vec3 colour = uWarmCream;
        colour = mix(colour, uEquatorialIvory, equatorialWeight * 0.86);
        colour = mix(colour, uSoftSand, smoothstep(0.30, 0.78, abs(latitude)) * 0.56);
        colour = mix(colour, uPearlGrey, northLatitude * 0.66);

        // Outside the actual north-polar hexagon, Saturn returns to neutral
        // pearl-grey, taupe and warm cloud colours. Do not wash the entire
        // northern hemisphere with cyan or blue.
        float upperLatitudeWeight = smoothstep(0.70, 1.30, latitude);
        vec3 naturalUpperClouds = mix(uSoftSand, uPearlGrey, 0.62);
        colour = mix(colour, naturalUpperClouds, upperLatitudeWeight * 0.76);
        colour = mix(
          colour,
          mix(uPearlGrey, uStormWhite, 0.24),
          smoothstep(1.00, 1.36, latitude) * 0.34
        );

        // Saturn's surface is dominated by zonal cloud bands. Longitude only
        // introduces tiny natural drift; it never breaks the bands into patches.
        float veryBroadBands = 0.5 + 0.5 * sin(
          latitude * 19.0
          + sin(longitude * 2.0) * 0.055
        );
        float broadBands = 0.5 + 0.5 * sin(
          latitude * 46.0
          + sin(longitude * 3.0 + 0.6) * 0.045
        );
        float mediumBands = 0.5 + 0.5 * sin(
          latitude * 116.0
          + sin(longitude * 5.0 - 0.8) * 0.035
        );
        float fineBands = 0.5 + 0.5 * sin(
          latitude * 286.0
          + sin(longitude * 7.0 + 1.7) * 0.022
        );

        float bandBrightness =
          (veryBroadBands - 0.5) * 0.070
          + (broadBands - 0.5) * 0.052
          + (mediumBands - 0.5) * 0.030
          + (fineBands - 0.5) * 0.014;

        // A few wider latitude zones reproduce the visible concentric changes in
        // the reference without resorting to arbitrary surface shapes.
        float warmZone = latitudeBand(latitude, 0.13, 0.105, 0.060);
        float paleZone = latitudeBand(latitude, 0.46, 0.075, 0.050);
        float greyZone = latitudeBand(latitude, 0.82, 0.090, 0.060);
        float southernPearl = latitudeBand(latitude, -0.38, 0.105, 0.070);

        colour = mix(colour, uEquatorialIvory, warmZone * 0.20);
        colour = mix(colour, uStormWhite, paleZone * 0.10);
        colour = mix(colour, uPearlGrey, greyZone * 0.15);
        colour = mix(colour, uSoftSand, southernPearl * 0.12);

        // The prominent pale ribbon in the supplied image is kept as a narrow,
        // nearly circular storm track. It is gently irregular, not zigzagged.
        float stormCentre = 0.525
          + sin(longitude * 2.0 + 0.45) * 0.007
          + sin(longitude * 5.0 - 0.90) * 0.0025;
        float stormCore = 1.0 - smoothstep(0.007, 0.018, abs(latitude - stormCentre));
        float stormHalo = 1.0 - smoothstep(0.020, 0.052, abs(latitude - stormCentre));
        float stormBreakup = 0.82 + fbm3D(direction * 26.0 + vec3(4.2, 1.1, 7.4)) * 0.18;
        colour = mix(colour, uStormWhite, stormHalo * 0.13);
        colour = mix(colour, uStormWhite, stormCore * stormBreakup * 0.44);

        // North-polar hexagon. The supplied image shows more than just a single
        // blue eye: a cool blue cap, an uneven hexagonal boundary and additional
        // concentric blue circular decks extending below the pole.
        vec2 polePlane = rotate2D(PI / 6.0) * direction.xz;
        vec2 skewedPolePlane = polePlane + vec2(0.012, -0.004) * smoothstep(0.68, 1.0, north);
        skewedPolePlane.x *= 1.0 + sin(longitude * 1.2 + 0.4) * 0.055 * smoothstep(0.68, 1.0, north);
        skewedPolePlane.y *= 1.0 + cos(longitude * 1.7 - 0.3) * 0.038 * smoothstep(0.68, 1.0, north);
        float polarRadius = length(polePlane);
        float hexWarp = (fbm3D(vec3(skewedPolePlane * 34.0, north * 12.0)) - 0.5) * 0.018;
        float hexRadius = hexDistance(skewedPolePlane) + hexWarp;
        float hexInterior = (1.0 - smoothstep(0.205, 0.235, hexRadius))
          * smoothstep(0.72, 0.98, north);
        float hexOuterHaze = (1.0 - smoothstep(0.275, 0.350, polarRadius))
          * smoothstep(0.65, 0.97, north);
        float hexBoundary = smoothstep(0.185, 0.206, hexRadius)
          * (1.0 - smoothstep(0.220, 0.244, hexRadius))
          * smoothstep(0.72, 0.98, north);

        // Blue is tightly localised to the actual polar cap and vortex. The
        // observed sequence is: blue hexagon, then a whitish scattered shoulder,
        // then one circular blue ring, and beyond that the usual Saturn tones.
        float coolBlueDisc = (1.0 - smoothstep(0.050, 0.242, polarRadius))
          * smoothstep(0.76, 0.995, north);
        float innerBlueLane = smoothstep(0.095, 0.132, polarRadius)
          * (1.0 - smoothstep(0.175, 0.225, polarRadius))
          * smoothstep(0.82, 0.995, north);

        float whiteScatteredShoulder = smoothstep(0.225, 0.270, polarRadius)
          * (1.0 - smoothstep(0.405, 0.475, polarRadius))
          * smoothstep(0.57, 0.97, north);
        float outerBlueRing = smoothstep(0.445, 0.500, polarRadius)
          * (1.0 - smoothstep(0.595, 0.680, polarRadius))
          * smoothstep(0.42, 0.94, north);
        float postBlueReturn = smoothstep(0.640, 0.705, polarRadius)
          * (1.0 - smoothstep(0.825, 0.915, polarRadius))
          * smoothstep(0.26, 0.88, north);

        float polarFlow = 0.5 + 0.5 * sin(
          polarRadius * 41.0
          - longitude * 2.6
          + fbm3D(direction * 23.0 + vec3(1.3, 4.1, 2.7)) * 5.2
        );
        float shoulderCloudNoise = fbm3D(
          direction * 47.0 + vec3(7.2, 2.4, 5.9)
        );
        float shoulderWhiteFlecks = smoothstep(0.56, 0.80, shoulderCloudNoise)
          * whiteScatteredShoulder;
        float shoulderGreyFlecks = smoothstep(0.38, 0.57, shoulderCloudNoise)
          * (1.0 - smoothstep(0.57, 0.80, shoulderCloudNoise))
          * whiteScatteredShoulder;

        vec3 polarCapColour = mix(
          uCoolHighLatitude,
          uHexagonBlue,
          1.0 - smoothstep(0.025, 0.245, polarRadius)
        );
        vec3 innerBlueColour = mix(
          uCoolHighLatitude,
          uHexagonBlue,
          0.46 + polarFlow * 0.42
        );
        vec3 whiteShoulderColour = mix(uPearlGrey, uStormWhite, 0.52);
        vec3 shoulderGreyColour = mix(uSoftSand, uPearlGrey, 0.50);
        vec3 outerBlueRingColour = mix(uPearlGrey, uHexagonBlue, 0.20 + polarFlow * 0.16);
        vec3 saturnReturnColour = mix(uWarmCream, uPearlGrey, 0.36);

        colour = mix(colour, whiteShoulderColour, hexOuterHaze * 0.10);
        colour = mix(colour, polarCapColour, coolBlueDisc * hexInterior * 0.48);
        colour = mix(colour, polarCapColour, hexInterior * 0.84);
        colour = mix(colour, innerBlueColour, innerBlueLane * hexInterior * 0.34);

        // Directly beneath the hexagon: whitish scattered cloud field.
        colour = mix(colour, whiteShoulderColour, whiteScatteredShoulder * 0.58);
        colour = mix(colour, shoulderGreyColour, shoulderGreyFlecks * 0.22);
        colour = mix(colour, uStormWhite, shoulderWhiteFlecks * 0.34);

        // After that shoulder comes one blue circular ring only.
        colour = mix(colour, outerBlueRingColour, outerBlueRing * 0.30);

        // Beyond the blue ring, Saturn returns to its normal cream/grey colour.
        colour = mix(colour, saturnReturnColour, postBlueReturn * 0.48);
        colour = mix(colour, uVortexBlue * 0.82, hexBoundary * 0.24);

        // Layered blue circulation remains only inside the compact polar cap.
        float polarRingWindow = coolBlueDisc * hexInterior
          * smoothstep(0.030, 0.090, polarRadius);
        float polarRings = 0.5 + 0.5 * sin(polarRadius * 82.0 + 0.42);
        float polarFineRings = 0.5 + 0.5 * sin(polarRadius * 166.0 - 0.62);
        colour *= 1.0 + (polarRings - 0.5) * polarRingWindow * 0.070;
        colour += mix(uHexagonBlue, uStormWhite, 0.28) * (polarFineRings - 0.5) * polarRingWindow * 0.024;

        // The central cyclone is a dark blue eye with a thin muted outline, not
        // a bright white dot.
        float eyeHalo = 1.0 - smoothstep(0.080, 0.112, polarRadius);
        float eyeOuter = 1.0 - smoothstep(0.050, 0.078, polarRadius);
        float eyeMiddle = 1.0 - smoothstep(0.024, 0.045, polarRadius);
        float eyeCore = 1.0 - smoothstep(0.008, 0.020, polarRadius);
        float eyeOutline = smoothstep(0.020, 0.028, polarRadius)
          * (1.0 - smoothstep(0.034, 0.044, polarRadius));
        eyeHalo *= smoothstep(0.93, 1.0, north);
        eyeOuter *= smoothstep(0.94, 1.0, north);
        eyeMiddle *= smoothstep(0.96, 1.0, north);
        eyeCore *= smoothstep(0.975, 1.0, north);
        eyeOutline *= smoothstep(0.96, 1.0, north);
        colour = mix(colour, uHexagonBlue * 0.88, eyeHalo * 0.24);
        colour = mix(colour, uEyeLavender * 0.92 + uHexagonBlue * 0.18, eyeOuter * 0.54);
        colour = mix(colour, uEyeLavender * 0.62 + uVortexBlue * 0.38, eyeMiddle * 0.86);
        colour = mix(colour, uVortexBlue * 0.52, eyeCore * 0.95);
        colour = mix(colour, uStormWhite * 0.18 + uEyeLavender * 0.82, eyeOutline * 0.26);

        // Retain only low-amplitude luminance from the wrapped source map. This
        // adds natural micro-detail without importing its older yellow/brown hue.
        vec2 sampledUv = vec2(fract(vUv.x + uTime * 0.000025), vUv.y);
        vec3 observed = texture2D(uMap, sampledUv).rgb;
        float observedLuma = dot(observed, vec3(0.2126, 0.7152, 0.0722));
        float mapDetail = (observedLuma - 0.5) * 0.060;

        // Extremely fine cloud grain is latitude-stretched and kept subtle.
        float cloudGrain = fbm3D(direction * 92.0 + vec3(2.7, 8.1, 4.4));
        float grainContribution = (cloudGrain - 0.5) * 0.030;
        colour *= 1.0 + bandBrightness + mapDetail + grainContribution;

        // Physically oriented illumination from the Sun at the scene origin.
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float ndl = dot(normal, lightDirection);
        float terminator = smoothstep(-0.24, 0.32, ndl);
        float diffuse = 0.22 + max(ndl, 0.0) * 0.86;
        colour *= mix(0.085, diffuse, terminator);

        // A restrained pearl limb keeps Saturn soft and gaseous without washing
        // away the reference palette or the polar hexagon.
        float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.4);
        colour += mix(uWarmCream, uPearlGrey, smoothstep(0.35, 1.0, north)) * rim * 0.055;

        gl_FragColor = vec4(max(colour, vec3(0.0)), 1.0);
      }
    `,

    depthWrite: true,
    depthTest: true,
  });
}

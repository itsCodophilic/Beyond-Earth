/**
 * Jupiter module.
 *
 * Jupiter uses a dedicated builder instead of the generic planet factory
 * because its appearance depends on several specialised layers:
 *
 * - turbulent atmospheric bands
 * - irregular white and brown cloud zones
 * - polar blue-grey storms
 * - Great Red Spot
 * - high-altitude cloud highlights
 * - thin atmospheric limb
 *
 * The dimensions are visually tuned for cinematic storytelling rather than
 * being a scientifically exact scale model.
 */
import * as THREE from "three";

// Scratch vectors reused by the per-frame update below. Allocating a fresh
// Vector3 on every animation frame produced steady garbage-collector pressure,
// which surfaces as periodic frame-time spikes rather than a lower average FPS.
const jupiterWorldPosition = new THREE.Vector3();
const jupiterSunDirection = new THREE.Vector3();
import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";
import { createPlanetAuroraLayer, updatePlanetAuroraLayer } from "../../graphics/planetAurora.js";

const scale = PLANET_SCALE_PROFILES.Jupiter;

/**
 * Plain configuration used by the main solar-system simulation.
 */
export const jupiter = {
  name: "Jupiter",
  texture: "jupiter",

  radius: scale.visualRadius,
  orbitRadius: scale.orbitRadius,
  physicalDiameterKm: scale.diameterKm,
  diameterEarths: scale.diameterEarths,
  volumeEarths: scale.volumeEarths,
  orbitSpeed: 0.12,
  spinSpeed: 0.021,
  axialTilt: 0.05,
  angle: 1.35,
  orbitEccentricity: 0.0484, orbitRotation: 3.32, orbitInclination: 0.023,

  orbitColor: 0xe2bc8a,
  focusScale: 0.75,
  minFocusDistance: scale.focusDistance * 0.88,
  focusDistance: scale.focusDistance,
  focusEase: 0.07,
  focusFov: 34,

  detail:
    "Largest planet | about 11× Earth width",

  info: {
    type: "Planet",
    diameter: "139,820 km",
    orbitalSpeed: "13.07 km/s",
    distanceFromEarth:
      "≈ 588 million km at closest approach",
    sizeComparison: getPlanetSizeComparison("Jupiter"),
    description:
      "A colossal striped world of hydrogen, powerful auroras, storms large enough to swallow Earth, and a richly populated system of 115 represented satellites.",
  },
};

/**
 * Creates Jupiter's main atmosphere material.
 *
 * The supplied Jupiter texture provides the broad real-world colour structure.
 * Procedural object-space noise then adds moving cloud turbulence without
 * creating the stretched polar artefacts seen in ordinary UV-only effects.
 */
export function createJupiterSurfaceMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
      },

      uMap: {
        value: texture,
      },

      /*
       * Direction from Jupiter toward the Sun.
       * updateJupiter() refreshes this every frame.
       */
      uLightDirection: {
        value: new THREE.Vector3(1, 0, 0),
      },

      uCloudMotion: {
        value: 1,
      },

      uTextureStrength: {
        value: 0.58,
      },

      uDetailStrength: {
        value: 0.92,
      },
    },

    vertexShader: `
      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      void main() {
        vUv = uv;
        vObjectDirection = normalize(position);

        vec4 worldPosition =
          modelMatrix *
          vec4(position, 1.0);

        vWorldPosition =
          worldPosition.xyz;

        vWorldNormal =
          normalize(
            mat3(modelMatrix) *
            normal
          );

        vec4 viewPosition =
          modelViewMatrix *
          vec4(position, 1.0);

        vViewPosition =
          viewPosition.xyz;

        gl_Position =
          projectionMatrix *
          viewPosition;
      }
    `,

    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uMap;
      uniform vec3 uLightDirection;
      uniform float uCloudMotion;
      uniform float uTextureStrength;
      uniform float uDetailStrength;

      varying vec2 vUv;
      varying vec3 vObjectDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vViewPosition;

      #define PI 3.14159265359

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(
          p,
          p.yzx + 33.33
        );

        return fract(
          (p.x + p.y) *
          p.z
        );
      }

      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);

        f =
          f *
          f *
          (3.0 - 2.0 * f);

        float n000 =
          hash31(i + vec3(0.0, 0.0, 0.0));

        float n100 =
          hash31(i + vec3(1.0, 0.0, 0.0));

        float n010 =
          hash31(i + vec3(0.0, 1.0, 0.0));

        float n110 =
          hash31(i + vec3(1.0, 1.0, 0.0));

        float n001 =
          hash31(i + vec3(0.0, 0.0, 1.0));

        float n101 =
          hash31(i + vec3(1.0, 0.0, 1.0));

        float n011 =
          hash31(i + vec3(0.0, 1.0, 1.0));

        float n111 =
          hash31(i + vec3(1.0, 1.0, 1.0));

        float nx00 =
          mix(n000, n100, f.x);

        float nx10 =
          mix(n010, n110, f.x);

        float nx01 =
          mix(n001, n101, f.x);

        float nx11 =
          mix(n011, n111, f.x);

        return mix(
          mix(nx00, nx10, f.y),
          mix(nx01, nx11, f.y),
          f.z
        );
      }

      float fbm3D(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;

        for (int i = 0; i < 5; i++) {
          value +=
            noise3D(p) *
            amplitude;

          p =
            p * 2.04 +
            vec3(7.3, 11.9, 5.1);

          amplitude *=
            0.5;
        }

        return value;
      }

      /*
       * Converts an object-space sphere direction into longitude.
       */
      float longitudeOf(vec3 direction) {
        return atan(
          direction.z,
          direction.x
        );
      }

      /*
       * Creates an irregular elliptical storm around a supplied centre.
       *
       * longitudeOffset:
       * horizontal distance around the sphere.
       *
       * latitudeOffset:
       * north/south distance.
       */
      float stormMask(
        vec3 direction,
        float centreLongitude,
        float centreLatitude,
        float width,
        float height,
        float distortion
      ) {
        float longitude =
          longitudeOf(direction);

        float latitude =
          asin(
            clamp(
              direction.y,
              -1.0,
              1.0
            )
          );

        float longitudeOffset =
          atan(
            sin(
              longitude -
              centreLongitude
            ),
            cos(
              longitude -
              centreLongitude
            )
          );

        float latitudeOffset =
          latitude -
          centreLatitude;

        float irregularity =
          fbm3D(
            direction * 42.0 +
            vec3(
              uTime * 0.008,
              -uTime * 0.006,
              uTime * 0.004
            )
          );

        float ellipticalDistance =
          length(
            vec2(
              longitudeOffset /
                width,

              latitudeOffset /
                height
            )
          );

        ellipticalDistance +=
          (
            irregularity -
            0.5
          ) *
          distortion;

        return 1.0 -
          smoothstep(
            0.72,
            1.08,
            ellipticalDistance
          );
      }

      void main() {
        vec3 direction =
          normalize(
            vObjectDirection
          );

        vec3 normal =
          normalize(
            vWorldNormal
          );

        vec3 viewDirection =
          normalize(
            cameraPosition -
            vWorldPosition
          );

        vec3 lightDirection =
          normalize(
            uLightDirection
          );

        float latitude =
          asin(
            clamp(
              direction.y,
              -1.0,
              1.0
            )
          );

        float longitude =
          longitudeOf(
            direction
          );

        /*
         * Each latitude rotates at a slightly different speed.
         *
         * This creates Jupiter-like differential atmospheric movement.
         */
        float latitudeFlow =
          sin(
            latitude * 11.0
          ) *
          0.014;

        float cloudTime =
          uTime *
          uCloudMotion;

        vec3 flowingDirection =
          normalize(
            vec3(
              cos(
                longitude +
                cloudTime *
                (
                  0.014 +
                  latitudeFlow
                )
              ) *
              cos(latitude),

              sin(latitude),

              sin(
                longitude +
                cloudTime *
                (
                  0.014 +
                  latitudeFlow
                )
              ) *
              cos(latitude)
            )
          );

        /*
         * Large flow bends the cloud bands.
         */
        float broadTurbulence =
          fbm3D(
            flowingDirection *
            7.0 +
            vec3(
              cloudTime * 0.008,
              -cloudTime * 0.005,
              cloudTime * 0.004
            )
          );

        /*
         * Medium flow creates rolling storms.
         */
        float stormTurbulence =
          fbm3D(
            flowingDirection *
            22.0 +
            vec3(
              -cloudTime * 0.018,
              cloudTime * 0.013,
              cloudTime * 0.009
            )
          );

        /*
         * Fine flow adds cloud filaments.
         */
        float fineClouds =
          fbm3D(
            flowingDirection *
            68.0 +
            vec3(
              cloudTime * 0.025,
              -cloudTime * 0.018,
              cloudTime * 0.014
            )
          );

        /*
         * Curved latitude prevents bands from looking like perfectly straight
         * rings painted around the planet.
         */
        float warpedLatitude =
          latitude +
          (
            broadTurbulence -
            0.5
          ) *
          0.135 +
          (
            stormTurbulence -
            0.5
          ) *
          0.040;

        float broadBands =
          sin(
            warpedLatitude *
            22.0
          );

        float fineBands =
          sin(
            warpedLatitude *
            52.0 +
            stormTurbulence *
            3.8
          );

        float microBands =
          sin(
            warpedLatitude *
            104.0 +
            fineClouds *
            5.8
          );

        float beltShear =
          fbm3D(
            flowingDirection *
            13.0 +
            vec3(
              cloudTime * 0.012,
              cloudTime * 0.004,
              -cloudTime * 0.008
            )
          );

        /*
         * Jupiter palette in reflected sunlight.
         */
        vec3 cream =
          vec3(
            0.89,
            0.82,
            0.70
          );

        vec3 paleCloud =
          vec3(
            0.98,
            0.95,
            0.86
          );

        vec3 beige =
          vec3(
            0.73,
            0.58,
            0.42
          );

        vec3 brown =
          vec3(
            0.42,
            0.27,
            0.17
          );

        vec3 rust =
          vec3(
            0.73,
            0.38,
            0.19
          );

        vec3 blueGrey =
          vec3(
            0.32,
            0.42,
            0.52
          );

        vec3 stormWhite =
          vec3(
            0.97,
            0.97,
            0.94
          );

        float warmZone =
          smoothstep(
            -0.28,
            0.56,
            broadBands + (beltShear - 0.5) * 0.12
          );

        vec3 proceduralColor =
          mix(
            beige,
            cream,
            warmZone
          );

        proceduralColor =
          mix(
            proceduralColor,
            brown,
            smoothstep(
              0.42,
              0.92,
              -fineBands
            ) *
            0.70
          );

        proceduralColor =
          mix(
            proceduralColor,
            paleCloud,
            smoothstep(
              0.42,
              0.94,
              fineBands
            ) *
            0.70
          );

        proceduralColor +=
          rust *
          smoothstep(
            0.54,
            0.96,
            microBands
          ) *
          0.22;

        /*
         * Juno-inspired polar colouring.
         *
         * This becomes stronger toward both poles, while remaining much more
         * restrained than the heavily enhanced reference imagery.
         */
        float polarAmount =
          smoothstep(
            0.34,
            0.96,
            abs(direction.y)
          );

        float polarStorms =
          fbm3D(
            direction * 34.0 +
            vec3(
              cloudTime * 0.009,
              -cloudTime * 0.012,
              cloudTime * 0.006
            )
          );

        float polarFine =
          fbm3D(
            direction * 66.0 +
            vec3(
              -cloudTime * 0.016,
              cloudTime * 0.010,
              cloudTime * 0.008
            )
          );

        vec3 polarBlue = vec3(0.39, 0.52, 0.74);
        vec3 polarViolet = vec3(0.44, 0.41, 0.70);
        vec3 polarWhite = vec3(0.98, 0.98, 0.96);

        vec3 polarColor =
          mix(
            polarBlue,
            polarViolet,
            smoothstep(
              0.26,
              0.84,
              polarStorms
            )
          );

        polarColor =
          mix(
            polarColor,
            polarWhite,
            smoothstep(
              0.58,
              0.94,
              polarFine
            )
          );

        proceduralColor =
          mix(
            proceduralColor,
            polarColor,
            polarAmount * 0.96
          );

        /*
         * Great Red Spot.
         *
         * Located in the southern hemisphere.
         */
        float greatRedSpot =
          stormMask(
            direction,

            -0.72,

            -0.31,

            0.31,

            0.122,

            0.19
          );

        float redSpotCore =
          stormMask(
            direction,

            -0.72,

            -0.31,

            0.19,

            0.070,

            0.22
          );

        float redSpotFlow =
          sin(
            longitude * 22.0 -
            latitude * 37.0 +
            stormTurbulence * 9.0
          );

        vec3 redSpotOuter =
          mix(
            vec3(
              0.70,
              0.27,
              0.10
            ),

            vec3(
              0.96,
              0.63,
              0.32
            ),

            redSpotFlow *
              0.5 +
              0.5
          );

        vec3 redSpotInner =
          mix(
            vec3(
              0.82,
              0.39,
              0.15
            ),

            vec3(
              0.98,
              0.79,
              0.49
            ),

            stormTurbulence
          );

        proceduralColor =
          mix(
            proceduralColor,
            redSpotOuter,
            greatRedSpot * 0.96
          );

        proceduralColor =
          mix(
            proceduralColor,
            redSpotInner,
            redSpotCore * 0.94
          );

        float redSpotWake =
          stormMask(
            direction,
            -0.42,
            -0.30,
            0.42,
            0.082,
            0.22
          );

        vec3 wakeColor =
          mix(
            vec3(0.84, 0.73, 0.61),
            vec3(0.58, 0.41, 0.31),
            smoothstep(0.28, 0.92, stormTurbulence)
          );

        proceduralColor =
          mix(
            proceduralColor,
            wakeColor,
            redSpotWake * 0.34
          );

        /*
         * Add several small white oval storms.
         */
        float whiteOvalA =
          stormMask(
            direction,
            1.34,
            -0.48,
            0.095,
            0.045,
            0.12
          );

        float whiteOvalB =
          stormMask(
            direction,
            1.72,
            -0.53,
            0.074,
            0.036,
            0.15
          );

        float whiteOvalC =
          stormMask(
            direction,
            -2.18,
            0.45,
            0.068,
            0.034,
            0.19
          );

        float whiteOvals =
          max(
            whiteOvalA,
            max(
              whiteOvalB,
              whiteOvalC
            )
          );

        proceduralColor =
          mix(
            proceduralColor,
            stormWhite,
            whiteOvals * 0.96
          );

        /*
         * The real texture remains important, but it is blended with the
         * procedural atmosphere instead of being displayed alone.
         */
        vec3 textureColor =
          texture2D(
            uMap,
            vec2(
              fract(
                vUv.x +
                cloudTime *
                0.0015
              ),
              vUv.y
            )
          ).rgb;

        vec3 surfaceColor =
          mix(
            proceduralColor,
            textureColor,
            uTextureStrength
          );

        /*
         * Restore procedural details over the texture.
         */
        surfaceColor =
          mix(
            surfaceColor,
            proceduralColor,
            uDetailStrength * 0.74
          );

        surfaceColor *=
          0.88 +
          broadTurbulence * 0.24 +
          fineClouds * 0.14;

        // Preserve Juno-inspired blue/violet/white polar cyclones after the
        // broad texture blend. Previously this treatment existed only inside
        // proceduralColor and was diluted before reaching the final fragment.
        float polarFilament =
          smoothstep(
            0.34,
            0.92,
            polarFine
          );

        vec3 finalPolarColor =
          mix(
            polarColor,
            vec3(0.90, 0.94, 1.0),
            polarFilament * 0.58
          );

        surfaceColor =
          mix(
            surfaceColor,
            finalPolarColor,
            polarAmount * (0.58 + polarFilament * 0.24)
          );

        /*
         * Lighting.
         */
        float diffuse =
          max(
            dot(
              normal,
              lightDirection
            ),
            0.0
          );

        float softDiffuse =
          0.13 +
          diffuse * 0.92;

        float atmosphereScatter =
          pow(
            1.0 -
            max(
              dot(
                normal,
                viewDirection
              ),
              0.0
            ),
            3.2
          );

        /*
         * Softer night-side transition than the generic planet material.
         */
        float terminator =
          smoothstep(
            -0.15,
            0.35,
            dot(
              normal,
              lightDirection
            )
          );

        surfaceColor *=
          mix(
            0.11,
            softDiffuse,
            terminator
          );

        surfaceColor +=
          vec3(
            0.62,
            0.76,
            0.82
          ) *
          atmosphereScatter *
          0.12;

        gl_FragColor =
          vec4(
            max(
              surfaceColor,
              vec3(0.0)
            ),
            1.0
          );
      }
    `,

    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

/**
 * Creates Jupiter's thin upper-atmosphere shell.
 */
export function createJupiterAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
      },

      uColor: {
        value: new THREE.Color(
          0x91c8da
        ),
      },
    },

    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vObjectDirection;

      void main() {
        vec4 viewPosition =
          modelViewMatrix *
          vec4(position, 1.0);

        vNormalView =
          normalize(
            normalMatrix * normal
          );

        vViewDirection =
          normalize(
            -viewPosition.xyz
          );

        vObjectDirection =
          normalize(position);

        gl_Position =
          projectionMatrix *
          viewPosition;
      }
    `,

    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;

      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vObjectDirection;

      void main() {
        float facing =
          max(
            dot(
              normalize(vNormalView),
              normalize(vViewDirection)
            ),
            0.0
          );

        float fresnel =
          pow(
            1.0 - facing,
            3.6
          );

        float latitude =
          abs(
            vObjectDirection.y
          );

        vec3 atmosphereColor =
          mix(
            vec3(
              0.86,
              0.70,
              0.49
            ),

            uColor,

            smoothstep(
              0.42,
              0.94,
              latitude
            )
          );

        float pulse =
          0.94 +
          sin(
            uTime * 0.22
          ) *
          0.025;

        float alpha =
          fresnel *
          0.24 *
          pulse;

        if (alpha < 0.004) {
          discard;
        }

        gl_FragColor =
          vec4(
            atmosphereColor,
            alpha
          );
      }
    `,

    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.BackSide,
  });
}

/**
 * Builds Jupiter and registers its surface for interaction.
 */
export function createJupiter({
  textures,
  world,
  orbitRoot,
  hoverTargets,
  createOrbitLine,
}) {
  const system =
    new THREE.Group();

  system.name =
    "Jupiter system";

  /*
   * Store the normal planet simulation properties on the system group.
   *
   * main.js can orbit and rotate this object exactly as it does other planets.
   */
  system.userData = {
    ...jupiter,
  };

  const surface =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        jupiter.radius,
        192,
        128,
      ),

      createJupiterSurfaceMaterial(
        textures.jupiter
      ),
    );

  surface.name =
    "Jupiter";

  /*
   * Interaction metadata belongs on the clickable surface.
   */
  surface.userData = {
    ...jupiter,
  };

  surface.rotation.z =
    jupiter.axialTilt;

  system.add(surface);

  const atmosphere =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        jupiter.radius * 1.018,
        160,
        112,
      ),

      createJupiterAtmosphereMaterial(),
    );

  atmosphere.name =
    "Jupiter atmosphere";

  surface.add(atmosphere);

  // Compact telescope-mapped spiral aurora. The spiral is kept tight and
  // colourful, but the pole centre is now deliberately covered so the middle
  // no longer appears hollow. Two spiral layers provide the structured curl,
  // while a third compact polar-fill layer bathes the core in blue/turquoise
  // auroral emission with warm orange accents.
  const auroraOval = createPlanetAuroraLayer({
    planet: surface,
    radius: jupiter.radius,
    quality: "high",
    shellScale: 1.026,
    latitudeCenter: 0.984,
    latitudeWidth: 0.024,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 1.58,
    faceOnVisibility: 0.74,
    daysideVisibility: 0.20,
    arcFrequency: 8.8,
    spikeFrequency: 40.0,
    displacementStrength: 0.008,
    shellAlpha: 0.98,
    animationSpeed: 0.94,
    redFringeStrength: 0.84,
    primaryColor: 0x1268ff,
    secondaryColor: 0x2ff4dc,
    tertiaryColor: 0xff8a24,
    spiralStrength: 1.0,
    spiralTurns: 1.92,
    spiralInnerRadius: 0.018,
    spiralRadiusSpan: 0.224,
    spiralArmWidth: 0.026,
    spiralPhase: -0.42,
    spiralDirection: 1,
    spiralTwistNoise: 0.24,
  });
  auroraOval.name = "Jupiter compact electric-blue spiral aurora";

  const auroraCap = createPlanetAuroraLayer({
    planet: surface,
    radius: jupiter.radius,
    quality: "high",
    shellScale: 1.030,
    latitudeCenter: 0.988,
    latitudeWidth: 0.032,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.84,
    faceOnVisibility: 0.70,
    daysideVisibility: 0.14,
    arcFrequency: 7.0,
    spikeFrequency: 30.0,
    displacementStrength: 0.005,
    shellAlpha: 0.74,
    animationSpeed: 0.68,
    redFringeStrength: 0.60,
    primaryColor: 0x087cff,
    secondaryColor: 0x36ffe2,
    tertiaryColor: 0xffa13a,
    spiralStrength: 1.0,
    spiralTurns: 1.88,
    spiralInnerRadius: 0.020,
    spiralRadiusSpan: 0.214,
    spiralArmWidth: 0.046,
    spiralPhase: -0.35,
    spiralDirection: 1,
    spiralTwistNoise: 0.30,
  });
  auroraCap.name = "Jupiter turquoise spiral aurora glow";

  const auroraCore = createPlanetAuroraLayer({
    planet: surface,
    radius: jupiter.radius,
    quality: "high",
    shellScale: 1.024,
    latitudeCenter: 0.996,
    latitudeWidth: 0.074,
    mirroredStrength: 1.0,
    longitudeCenter: 0.0,
    longitudeWidth: Math.PI,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: Math.PI,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.22,
    intensity: 0.92,
    faceOnVisibility: 0.78,
    daysideVisibility: 0.18,
    arcFrequency: 5.8,
    spikeFrequency: 24.0,
    displacementStrength: 0.003,
    shellAlpha: 0.58,
    animationSpeed: 0.58,
    redFringeStrength: 0.46,
    primaryColor: 0x1e73ff,
    secondaryColor: 0x5dffe7,
    tertiaryColor: 0xffa95a,
    spiralStrength: 0.0,
    spiralTurns: 1.10,
    spiralInnerRadius: 0.0,
    spiralRadiusSpan: 0.10,
    spiralArmWidth: 0.090,
    spiralPhase: 0.0,
    spiralDirection: 1,
    spiralTwistNoise: 0.10,
  });
  auroraCore.name = "Jupiter polar aurora core fill";

  /*
   * Optional orbit-line callback keeps Jupiter compatible with your existing
   * orbitRoot architecture.
   */
  if (createOrbitLine) {
    createOrbitLine(
      jupiter.orbitRadius,
      jupiter.orbitColor,
      0.18,
      0,
    );
  }

  world.add(system);

  hoverTargets.push(
    surface
  );

  return {
    system,
    surface,
    atmosphere,
    auroraOval,
    auroraCap,
    auroraCore,
  };
}

/**
 * Updates Jupiter's clouds, rotation and lighting.
 */
export function updateJupiter({
  jupiterSystem,
  time,
  motionScale = 1,
  sunWorldPosition,
}) {
  if (!jupiterSystem) {
    return;
  }

  const {
    system,
    surface,
    atmosphere,
    auroraOval,
    auroraCap,
    auroraCore,
  } =
    jupiterSystem;

  /*
   * Jupiter rotates rapidly, but inspection mode slows it through motionScale.
   */
  system.rotation.y +=
    jupiter.spinSpeed *
    motionScale;

  /*
   * The upper atmosphere drifts at a slightly different rate.
   */
  atmosphere.rotation.y -=
    0.00075 *
    motionScale;

  if (
    surface.material.uniforms?.uTime
  ) {
    surface.material.uniforms.uTime.value =
      time;
  }

  if (
    atmosphere.material.uniforms?.uTime
  ) {
    atmosphere.material.uniforms.uTime.value =
      time;
  }

  updatePlanetAuroraLayer(
    auroraOval,
    motionScale,
    { rotationSpeed: 0.00012 }
  );

  updatePlanetAuroraLayer(
    auroraCap,
    motionScale,
    { rotationSpeed: 0.00008 }
  );

  updatePlanetAuroraLayer(
    auroraCore,
    motionScale,
    { rotationSpeed: 0.00005 }
  );

  /*
   * Jupiter needs a correct Sun direction because its material is custom and
   * does not automatically use Three.js lights like MeshStandardMaterial.
   */
  if (
    sunWorldPosition &&
    surface.material.uniforms?.uLightDirection
  ) {
    const jupiterPosition = surface.getWorldPosition(jupiterWorldPosition);

    // copy() into a reused vector instead of clone(); the result is consumed
    // immediately below and never retained past this frame.
    const directionTowardSun = jupiterSunDirection
      .copy(sunWorldPosition)
      .sub(jupiterPosition)
      .normalize();

    surface.material.uniforms.uLightDirection.value.copy(
      directionTowardSun
    );
  }
}
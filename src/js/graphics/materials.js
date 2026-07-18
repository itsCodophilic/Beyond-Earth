/**
 * Custom GPU materials written with GLSL shaders.
 *
 * A vertex shader runs once for each vertex/point and decides its screen position.
 * A fragment shader runs for generated pixels and decides their final color.
 * `uniform` values are shared by every vertex/pixel and can change each frame;
 * `attribute` values can be different for every point in a BufferGeometry.
 */
import * as THREE from "three";

/** Builds a shader material that turns each THREE.Points vertex into a twinkling star. */
export function makeTwinkleMaterial(size, opacity = 0.86) {
  return new THREE.ShaderMaterial({
    // main.js updates uTime every frame; size and opacity are creation-time controls.
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      // Attributes arrive from BufferGeometry and may differ for every star.
      attribute vec3 aColor;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aScale;

      varying vec3 vColor;
      varying float vTwinkle;

      uniform float uTime;
      uniform float uSize;

      void main() {
        vColor = aColor;

        // Sine creates a repeating brightness wave; phase/speed keep stars independent.
        vTwinkle = 0.58 + 0.42 * sin(uTime * aSpeed + aPhase);

        // Convert world position to camera/view space before projection to the screen.
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

        // Nearby points are drawn larger, providing natural perspective.
        gl_PointSize =
          uSize *
          aScale *
          (0.74 + vTwinkle * 0.65) *
          (300.0 / max(80.0, -mvPosition.z));

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;

      uniform float uOpacity;

      void main() {
        // gl_PointCoord runs from 0–1 across each square point.
        // Re-centering it allows distance-from-center calculations.
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);

        float core = smoothstep(0.24, 0.0, dist);
        float halo = smoothstep(0.5, 0.0, dist) * 0.34;

        float alpha =
          (core + halo) *
          uOpacity *
          (0.55 + vTwinkle * 0.55);

        // Discard transparent edge pixels so point squares look circular.
        if (alpha < 0.02) {
          discard;
        }

        gl_FragColor = vec4(
          vColor * (0.75 + vTwinkle * 0.72),
          alpha
        );
      }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Creates a transparent pulsing material intended for a flat corona/glow shell. */
export function makeSunCoronaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1.1 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;

        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform float uTime;
      uniform float uIntensity;

      void main() {
        // Distance from UV center creates a soft circular mask.
        vec2 uv = vUv - 0.5;
        float dist = length(uv) * 1.8;

        float glow =
          smoothstep(0.94, 0.24, dist);

        float pulse =
          0.22 +
          0.28 *
          sin(uTime * 3.8 - dist * 12.0);

        float corona =
          glow *
          pulse *
          uIntensity *
          0.76;

        float rim =
          smoothstep(
            0.58,
            0.52,
            length(uv)
          ) * 0.18;

        vec3 color =
          vec3(1.0, 0.68, 0.18) *
          (0.88 + corona * 1.1 + rim * 0.8);

        float alpha =
          clamp(
            glow * 0.54 + rim * 0.22,
            0.0,
            0.82
          );

        gl_FragColor =
          vec4(color, alpha);

        if (gl_FragColor.a < 0.01) {
          discard;
        }
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * Creates the Sun's animated photosphere.
 *
 * The surface is generated mainly from object-space 3D noise so the pattern
 * remains attached to the sphere and does not look like a flat texture sliding
 * across it.
 *
 * The shader combines:
 * - broad plasma flow
 * - tiny convection granules
 * - subtle physical relief
 * - fragmented active regions
 * - small irregular sunspot groups
 */
export function makeSunSurfaceMaterial(texture) {
  const spotDirections = [
    new THREE.Vector3(0.82, 0.16, 0.55).normalize(),
    new THREE.Vector3(0.76, 0.12, 0.64).normalize(),
    new THREE.Vector3(0.69, 0.22, 0.69).normalize(),
    new THREE.Vector3(-0.71, 0.33, 0.62).normalize(),
    new THREE.Vector3(-0.64, 0.26, 0.72).normalize(),
    new THREE.Vector3(0.22, -0.58, 0.78).normalize(),
    new THREE.Vector3(0.29, -0.52, 0.80).normalize(),
    new THREE.Vector3(-0.38, -0.70, -0.60).normalize(),
  ];

  const spotSizes = [
    0.0048,
    0.0032,
    0.0026,
    0.0040,
    0.0027,
    0.0038,
    0.0024,
    0.0030,
  ];

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
      },

      uMap: {
        value: texture,
      },

      uGlow: {
        value: 1.0,
      },

      uSpotDirections: {
        value: spotDirections,
      },

      uSpotSizes: {
        value: spotSizes,
      },
    },

    vertexShader: `
      uniform float uTime;

      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying vec3 vObjectDirection;
      varying vec2 vUv;
      varying float vHeight;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);

        return fract(
          (p.x + p.y) * p.z
        );
      }

      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);

        f = f * f * (3.0 - 2.0 * f);

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

        for (int i = 0; i < 4; i++) {
          value +=
            amplitude *
            noise3D(p);

          p =
            p * 2.03 +
            vec3(7.1, 13.7, 5.4);

          amplitude *= 0.5;
        }

        return value;
      }

      void main() {
        vec3 direction =
          normalize(position);

        vObjectDirection =
          direction;

        vUv =
          uv;

        float broad =
          fbm3D(
            direction * 6.0 +
            vec3(
              uTime * 0.010,
              -uTime * 0.007,
              uTime * 0.005
            )
          );

        float granules =
          fbm3D(
            direction * 42.0 +
            vec3(
              -uTime * 0.022,
              uTime * 0.017,
              uTime * 0.013
            )
          );

        float fine =
          fbm3D(
            direction * 96.0 +
            vec3(
              uTime * 0.031,
              -uTime * 0.024,
              uTime * 0.018
            )
          );

        float height =
          broad * 0.20 +
          granules * 0.62 +
          fine * 0.18;

        vHeight =
          height;

        /*
         * Keep physical displacement very small.
         *
         * Most depth is created by convection-cell contrast rather than
         * turning the photosphere into a rocky surface.
         */
        float displacement =
          (height - 0.5) *
          0.032;

        vec3 displacedPosition =
          position +
          normal * displacement;

        vec4 viewPosition =
          modelViewMatrix *
          vec4(displacedPosition, 1.0);

        vViewPosition =
          viewPosition.xyz;

        vNormalView =
          normalize(
            normalMatrix * normal
          );

        gl_Position =
          projectionMatrix *
          viewPosition;
      }
    `,

    fragmentShader: `
      #define SPOT_COUNT 8

      uniform float uTime;
      uniform sampler2D uMap;
      uniform float uGlow;
      uniform vec3 uSpotDirections[SPOT_COUNT];
      uniform float uSpotSizes[SPOT_COUNT];

      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying vec3 vObjectDirection;
      varying vec2 vUv;
      varying float vHeight;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);

        return fract(
          (p.x + p.y) * p.z
        );
      }

      float noise3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);

        f = f * f * (3.0 - 2.0 * f);

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
            amplitude *
            noise3D(p);

          p =
            p * 2.02 +
            vec3(11.3, 4.7, 8.9);

          amplitude *= 0.5;
        }

        return value;
      }

      void main() {
        vec3 direction =
          normalize(vObjectDirection);

        vec3 normalView =
          normalize(vNormalView);

        vec3 viewDirection =
          normalize(-vViewPosition);

        float facing =
          max(
            dot(
              normalView,
              viewDirection
            ),
            0.0
          );

        float limb =
          1.0 - facing;

        /*
         * Broad variations move slowly.
         * The fine layers move independently so the surface evolves instead
         * of looking like one texture sliding in a single direction.
         */
        float broad =
          fbm3D(
            direction * 7.0 +
            vec3(
              uTime * 0.009,
              -uTime * 0.006,
              uTime * 0.004
            )
          );

        float cellsA =
          fbm3D(
            direction * 46.0 +
            vec3(
              -uTime * 0.020,
              uTime * 0.015,
              uTime * 0.011
            )
          );

        float cellsB =
          fbm3D(
            direction * 92.0 +
            vec3(
              uTime * 0.028,
              -uTime * 0.021,
              uTime * 0.016
            )
          );

        float micro =
          fbm3D(
            direction * 150.0 +
            vec3(
              -uTime * 0.037,
              uTime * 0.030,
              -uTime * 0.023
            )
          );

        float cellularEnergy =
          clamp(
            cellsA * 0.72 +
            cellsB * 0.22 +
            micro * 0.06,
            0.0,
            1.0
          );

        /*
         * These masks form the convection cells:
         *
         * brightCell:
         * ordinary white-hot cell centres.
         *
         * whiteCell:
         * occasional brilliant-white regions.
         *
         * darkCellBorder:
         * darker plasma between the rising cells.
         */
        float brightCell =
          smoothstep(
            0.38,
            0.78,
            cellularEnergy
          );

        float whiteCell =
          smoothstep(
            0.72,
            0.93,
            cellularEnergy
          );

        float darkCellBorder =
          1.0 -
          smoothstep(
            0.25,
            0.46,
            cellularEnergy
          );

        /*
         * Natural visible-light photosphere palette.
         *
         * Sunlight contains the complete visible spectrum, so the unresolved
         * stellar disk is perceived as white from space. Warm ivory is kept
         * only in the cooler granule boundaries and limb-darkened regions.
         */
        vec3 granuleShadow =
          vec3(
            0.34,
            0.315,
            0.285
          );

        vec3 warmIvory =
          vec3(
            0.84,
            0.81,
            0.74
          );

        vec3 softWhite =
          vec3(
            1.0,
            0.985,
            0.94
          );

        vec3 photosphereWhite =
          vec3(
            1.0,
            0.998,
            0.985
          );

        vec3 brilliantWhite =
          vec3(
            1.0,
            1.0,
            1.0
          );

        vec3 finalSurface =
          mix(
            warmIvory,
            softWhite,
            brightCell
          );

        finalSurface =
          mix(
            finalSurface,
            photosphereWhite,
            smoothstep(
              0.48,
              0.80,
              cellularEnergy
            )
          );

        finalSurface =
          mix(
            finalSurface,
            brilliantWhite,
            whiteCell * 0.82
          );

        finalSurface =
          mix(
            finalSurface,
            granuleShadow,
            darkCellBorder * 0.28
          );

        finalSurface *=
          0.82 +
          broad * 0.30 +
          vHeight * 0.08;

        /*
         * Small irregular spot groups.
         *
         * Each region contains:
         * - a grey-brown penumbra
         * - a tiny dark umbra
         * - a broken bright magnetic rim
         */
        for (int i = 0; i < SPOT_COUNT; i++) {
          vec3 spotDirection =
            normalize(
              uSpotDirections[i]
            );

          float spotDistance =
            1.0 -
            dot(
              direction,
              spotDirection
            );

          float irregularity =
            fbm3D(
              direction * 180.0 +
              vec3(float(i) * 9.7)
            );

          spotDistance +=
            (irregularity - 0.5) *
            uSpotSizes[i] *
            0.55;

          float penumbra =
            1.0 -
            smoothstep(
              uSpotSizes[i] * 0.58,
              uSpotSizes[i],
              spotDistance
            );

          float umbra =
            1.0 -
            smoothstep(
              uSpotSizes[i] * 0.12,
              uSpotSizes[i] * 0.38,
              spotDistance
            );

          float activeRim =
            smoothstep(
              uSpotSizes[i] * 0.43,
              uSpotSizes[i] * 0.64,
              spotDistance
            )
            *
            (
              1.0 -
              smoothstep(
                uSpotSizes[i] * 0.64,
                uSpotSizes[i] * 0.95,
                spotDistance
              )
            );

          /*
           * Build a local coordinate system for every sunspot.
           *
           * This allows the grey-brown penumbra lines to radiate from each
           * individual spot instead of from the centre of the whole Sun.
           */
          vec3 referenceAxis =
            abs(spotDirection.y) > 0.88
              ? vec3(1.0, 0.0, 0.0)
              : vec3(0.0, 1.0, 0.0);

          vec3 tangent =
            normalize(
              cross(
                referenceAxis,
                spotDirection
              )
            );

          vec3 bitangent =
            normalize(
              cross(
                spotDirection,
                tangent
              )
            );

          vec2 localPosition =
            vec2(
              dot(direction, tangent),
              dot(direction, bitangent)
            );

          float localAngle =
            atan(
              localPosition.y,
              localPosition.x
            );

          float striations =
            0.45 +
            0.55 *
            sin(
              localAngle * 34.0 +
              irregularity * 13.0
            );

          vec3 penumbraColor =
            mix(
              vec3(
                0.16,
                0.145,
                0.135
              ),
              vec3(
                0.42,
                0.385,
                0.35
              ),
              striations
            );

          vec3 umbraColor =
            vec3(
              0.012,
              0.011,
              0.010
            );

          vec3 activeColor =
            vec3(
              1.0,
              1.0,
              0.97
            );

          finalSurface =
            mix(
              finalSurface,
              penumbraColor,
              penumbra * 0.72
            );

          finalSurface =
            mix(
              finalSurface,
              umbraColor,
              umbra * 0.86
            );

          finalSurface +=
            activeColor *
            activeRim *
            (
              0.22 +
              irregularity * 0.25
            );
        }

        /*
         * Fragmented white magnetic regions near the hottest cells.
         */
        float activeNoise =
          fbm3D(
            direction * 74.0 +
            vec3(
              uTime * 0.012,
              -uTime * 0.009,
              0.0
            )
          );

        float activeRegions =
          smoothstep(
            0.83,
            0.94,
            activeNoise
          )
          *
          smoothstep(
            0.58,
            0.88,
            cellsA
          );

        finalSurface +=
          vec3(
            1.0,
            0.995,
            0.96
          )
          *
          activeRegions
          *
          0.25;

        finalSurface +=
          vec3(
            1.0,
            1.0,
            1.0
          )
          *
          smoothstep(
            0.88,
            0.97,
            activeNoise
          )
          *
          0.18;

        /*
         * Mild limb darkening gives the Sun a spherical appearance.
         *
         * The separate chromosphere mesh supplies the bright outer edge,
         * so this shader avoids producing a thick dark-red ring.
         */
        float limbDarkening =
          mix(
            1.0,
            0.48,
            pow(limb, 1.45)
          );

        finalSurface *=
          limbDarkening;

        finalSurface +=
          vec3(
            0.92,
            0.88,
            0.80
          )
          *
          pow(limb, 5.0)
          *
          uGlow
          *
          0.12;

        /*
         * Retain the supplied texture as subtle organic variation only.
         *
         * It no longer controls the main appearance or surface movement.
         */
        vec3 textureColor =
          texture2D(
            uMap,
            vUv
          ).rgb;

        float textureLuma =
          dot(
            textureColor,
            vec3(
              0.299,
              0.587,
              0.114
            )
          );

        finalSurface *=
          mix(
            0.95,
            1.06,
            textureLuma * 0.08 + 0.46
          );

        gl_FragColor =
          vec4(
            max(
              finalSurface,
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
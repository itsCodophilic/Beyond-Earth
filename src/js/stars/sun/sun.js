/**
 * Layered Sun builder.
 *
 * A believable star cannot be represented by one textured sphere. This module
 * combines several lightweight layers, each responsible for a different effect:
 *
 * - photosphere: animated granular surface
 * - chromosphere: thin orange-red rim above the photosphere
 * - corona shells: subtle plasma glow around the silhouette
 * - glow sprite: soft light extending into surrounding space
 * - spicules: tiny uneven flames attached to the outer edge
 * - plasma jets: sparse localized eruptions
 * - coronal loops: a small number of magnetic plasma arches
 *
 * The photosphere remains the main visual layer. All outer effects are kept
 * subtle so they do not hide the granular Sun surface.
 */
import * as THREE from "three";

import {
  makeSunSurfaceMaterial,
} from "../../graphics/materials.js";

import {
  makeGlowTexture,
  makeNoiseTexture,
} from "../../graphics/proceduralTextures.js";

const SUN_RADIUS = 9.2;

/**
 * Creates a Fresnel-based atmosphere shell.
 *
 * Fresnel makes the material strongest near the outside edge of the sphere.
 * This allows the chromosphere and corona to remain nearly invisible across
 * the centre while appearing around the Sun's silhouette.
 */
function createAtmosphereMaterial({
  color,
  intensity,
  speed,
  power,
  waveScale = 1,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
      },

      uColor: {
        value: new THREE.Color(color),
      },

      uIntensity: {
        value: intensity,
      },

      uSpeed: {
        value: speed,
      },

      uPower: {
        value: power,
      },

      uWaveScale: {
        value: waveScale,
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
      uniform float uIntensity;
      uniform float uSpeed;
      uniform float uPower;
      uniform float uWaveScale;

      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      varying vec3 vObjectDirection;

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

        for (int i = 0; i < 4; i++) {
          value +=
            amplitude *
            noise3D(p);

          p =
            p * 2.03 +
            vec3(6.4, 9.1, 3.7);

          amplitude *=
            0.5;
        }

        return value;
      }

      void main() {
        float facing =
          max(
            dot(
              normalize(vNormalView),
              normalize(vViewDirection)
            ),
            0.0
          );

        /*
         * Fresnel becomes brighter toward the sphere's edge.
         */
        float fresnel =
          pow(
            1.0 - facing,
            uPower
          );

        /*
         * Slow 3D noise creates an irregular plasma edge without making
         * the entire atmosphere appear to slide around the sphere.
         */
        float plasmaNoise =
          fbm3D(
            vObjectDirection *
            uWaveScale +
            vec3(
              uTime * uSpeed,
              -uTime * uSpeed * 0.63,
              uTime * uSpeed * 0.41
            )
          );

        float plasma =
          0.70 +
          plasmaNoise * 0.42;

        float alpha =
          fresnel *
          uIntensity *
          plasma;

        if (alpha < 0.006) {
          discard;
        }

        vec3 finalColor =
          uColor *
          (
            0.78 +
            fresnel * 0.62 +
            plasmaNoise * 0.18
          );

        gl_FragColor =
          vec4(
            finalColor,
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
 * Converts latitude and longitude into an outward unit direction.
 *
 * This direction is used to position plasma jets on the Sun's surface.
 */
function sphericalDirection(latitude, longitude) {
  const phi =
    THREE.MathUtils.degToRad(
      90 - latitude
    );

  const theta =
    THREE.MathUtils.degToRad(
      longitude
    );

  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Creates many tiny radial flames around the outer edge.
 *
 * These represent spicules: narrow jets of plasma rising from the Sun's
 * chromosphere. They remain intentionally small and faint.
 */
function createSpicules() {
  const group =
    new THREE.Group();

  group.name =
    "Solar spicules";

  const geometry =
    new THREE.ConeGeometry(
      0.024,
      0.34,
      4,
      1,
      true,
    );

  /*
   * Vertex colours allow each instance to use a slightly different orange,
   * red, or gold tone.
   */
  const material =
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });

  const up =
    new THREE.Vector3(
      0,
      1,
      0,
    );

  const count =
    560;

  const mesh =
    new THREE.InstancedMesh(
      geometry,
      material,
      count,
    );

  mesh.name =
    "Instanced solar spicules";

  const matrix =
    new THREE.Matrix4();

  const quaternion =
    new THREE.Quaternion();

  const scale =
    new THREE.Vector3();

  const position =
    new THREE.Vector3();

  const palette = [
    new THREE.Color(0xff4210),
    new THREE.Color(0xff6d18),
    new THREE.Color(0xff9a24),
    new THREE.Color(0xffc34d),
  ];

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    /*
     * Fibonacci sphere distribution prevents obvious rows or clusters.
     */
    const y =
      1 -
      (
        index /
        (count - 1)
      ) *
      2;

    const ringRadius =
      Math.sqrt(
        1 - y * y
      );

    const angle =
      index *
      Math.PI *
      (
        3 -
        Math.sqrt(5)
      );

    const direction =
      new THREE.Vector3(
        Math.cos(angle) * ringRadius,
        y,
        Math.sin(angle) * ringRadius,
      );

    /*
     * Deterministic variation avoids regenerating random values each frame.
     */
    const normalizedVariation =
      (
        (index * 37) % 41
      ) /
      41;

    const height =
      0.10 +
      normalizedVariation *
      0.44;

    position
      .copy(direction)
      .multiplyScalar(
        SUN_RADIUS +
        height * 0.44
      );

    quaternion.setFromUnitVectors(
      up,
      direction,
    );

    scale.set(
      0.44 +
      (index % 4) * 0.08,

      height / 0.34,

      0.44 +
      (index % 3) * 0.09,
    );

    matrix.compose(
      position,
      quaternion,
      scale,
    );

    mesh.setMatrixAt(
      index,
      matrix,
    );

    mesh.setColorAt(
      index,
      palette[
        index %
        palette.length
      ],
    );
  }

  mesh.instanceMatrix.needsUpdate =
    true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate =
      true;
  }

  group.add(mesh);

  return group;
}

/**
 * Creates one localized plasma eruption.
 *
 * Small sprites repeatedly move outward, bend sideways, fade, and restart.
 */
function createPlasmaJet(
  {
    latitude,
    longitude,
    height,
    bend,
    phase,
  },
  fireTexture,
) {
  const direction =
    sphericalDirection(
      latitude,
      longitude,
    );

  /*
   * Tangent controls the sideways curve of the plasma stream.
   */
  const referenceAxis =
    Math.abs(direction.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

  const tangent =
    new THREE.Vector3()
      .crossVectors(
        referenceAxis,
        direction,
      )
      .normalize();

  const group =
    new THREE.Group();

  group.name =
    "Solar plasma jet";

  const colors = [
    0xff4310,
    0xff6818,
    0xff9225,
    0xffbd48,
    0xffffb5,
  ];

  const particles =
    Array.from(
      {
        length: 20,
      },

      (_, index) => {
        const material =
          new THREE.SpriteMaterial({
            map: fireTexture,
            color:
              colors[
                index %
                colors.length
              ],
            transparent: true,
            opacity: 0,
            blending:
              THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
          });

        const particle =
          new THREE.Sprite(
            material
          );

        particle.userData.offset =
          index / 20;

        particle.userData.phase =
          phase +
          index * 1.17;

        group.add(particle);

        return particle;
      },
    );

  /*
   * Compact active-region glow at the plasma jet's base.
   */
  const core =
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireTexture,
        color: 0xffe4a2,
        transparent: true,
        opacity: 0.38,
        blending:
          THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      }),
    );

  core.position
    .copy(direction)
    .multiplyScalar(
      SUN_RADIUS * 1.008
    );

  core.scale.set(
    0.46,
    0.46,
    1,
  );

  group.add(core);

  group.userData = {
    direction,
    tangent,
    height,
    bend,
    phase,
    particles,
    core,
  };

  return group;
}

/**
 * Creates a sparse magnetic arch.
 *
 * The loop is built from individual plasma fragments instead of a continuous
 * tube, preventing the effect from looking like a decorative neon ring.
 */
function createCoronalLoop(
  {
    angle,
    width,
    height,
    tilt,
    phase,
  },
  fireTexture,
) {
  const startAngle =
    angle -
    width * 0.5;

  const endAngle =
    angle +
    width * 0.5;

  const pointOnSurface = (
    value,
    radius =
      SUN_RADIUS * 1.008,
  ) =>
    new THREE.Vector3(
      Math.cos(value) * radius,
      0,
      Math.sin(value) * radius,
    );

  const start =
    pointOnSurface(
      startAngle
    );

  const end =
    pointOnSurface(
      endAngle
    );

  const middle =
    (
      startAngle +
      endAngle
    ) *
    0.5;

  const controlA =
    pointOnSurface(
      middle -
      width * 0.18,
      SUN_RADIUS + height,
    );

  const controlB =
    pointOnSurface(
      middle +
      width * 0.18,
      SUN_RADIUS + height,
    );

  controlA.y =
    height * 0.20;

  controlB.y =
    height * 0.20;

  const curve =
    new THREE.CubicBezierCurve3(
      start,
      controlA,
      controlB,
      end,
    );

  const group =
    new THREE.Group();

  group.name =
    "Coronal loop";

  group.rotation.x =
    tilt;

  const colors = [
    0xff4310,
    0xff711b,
    0xffa430,
    0xffffa3,
  ];

  const particles =
    Array.from(
      {
        length: 34,
      },

      (_, index) => {
        const particle =
          new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: fireTexture,
              color:
                colors[
                  index %
                  colors.length
                ],
              transparent: true,
              opacity: 0,
              blending:
                THREE.AdditiveBlending,
              depthWrite: false,
              depthTest: true,
            }),
          );

        particle.userData.offset =
          index / 34;

        particle.userData.phase =
          phase +
          index * 0.93;

        group.add(particle);

        return particle;
      },
    );

  group.userData = {
    curve,
    particles,
    phase,
  };

  return group;
}

/**
 * Constructs the complete Sun.
 *
 * The returned object is later passed to updateSun() every frame.
 */
export function createSun({
  world,
  hoverTargets,
  texture,
}) {
  const system =
    new THREE.Group();

  system.name =
    "Sun system";

  /*
   * Use the loaded Sun texture when available.
   *
   * The new photosphere shader uses it only as subtle organic variation.
   */
  const surfaceTexture =
    texture ??
    makeNoiseTexture("sun");

  /*
   * A moderately dense sphere provides a smooth silhouette while keeping
   * the Sun suitable for real-time browser rendering.
   */
  const surfaceGeometry =
    new THREE.SphereGeometry(
      SUN_RADIUS,
      192,
      128,
    );

  const surfaceMaterial =
    makeSunSurfaceMaterial(
      surfaceTexture
    );

  const surface =
    new THREE.Mesh(
      surfaceGeometry,
      surfaceMaterial,
    );

  surface.name =
    "Sun";

  surface.userData = {
    name: "Sun",

    detail:
      "G-type star | 99.86% of solar system mass",

    focusScale:
      1.2,

    /*
     * Prevent the focus camera from moving inside this large mesh.
     */
    minFocusDistance:
      28,

    info: {
      type:
        "Star",

      diameter:
        "1,392,700 km",

      orbitalSpeed:
        "System reference body",

      distanceFromEarth:
        "≈ 149.6 million km",

      description:
        "A living ocean of plasma whose magnetic storms, radiant light, and immense gravity sustain every world in this planetary system.",
    },
  };

  system.add(surface);

  /*
   * Chromosphere
   *
   * This shell stays very close to the photosphere and creates a narrow,
   * irregular orange-red edge.
   */
  const chromosphere =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS * 1.012,
        144,
        96,
      ),

      createAtmosphereMaterial({
        color:
          0xff6c18,

        intensity:
          0.30,

        speed:
          0.028,

        power:
          3.15,

        waveScale:
          18,
      }),
    );

  chromosphere.name =
    "Solar chromosphere";

  system.add(
    chromosphere
  );

  /*
   * Inner corona
   *
   * Kept faint so the photosphere remains clearly visible.
   */
  const innerCorona =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS * 1.027,
        128,
        88,
      ),

      createAtmosphereMaterial({
        color:
          0xff941f,

        intensity:
          0.105,

        speed:
          0.017,

        power:
          4.25,

        waveScale:
          11,
      }),
    );

  innerCorona.name =
    "Inner solar corona";

  /*
   * Outer corona
   *
   * Provides only a thin, transparent gold edge.
   */
  const outerCorona =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        SUN_RADIUS * 1.046,
        112,
        80,
      ),

      createAtmosphereMaterial({
        color:
          0xffc552,

        intensity:
          0.032,

        speed:
          -0.011,

        power:
          5.5,

        waveScale:
          8,
      }),
    );

  outerCorona.name =
    "Outer solar corona";

  system.add(
    innerCorona,
    outerCorona,
  );

  /*
   * Soft camera-facing glow.
   *
   * This is intentionally smaller and fainter than the previous version.
   */
  const glowTexture =
    makeGlowTexture();

  const glow =
    new THREE.Sprite(
      new THREE.SpriteMaterial({
        map:
          glowTexture,

        color:
          0xff6818,

        transparent:
          true,

        opacity:
          0.024,

        blending:
          THREE.AdditiveBlending,

        depthWrite:
          false,

        depthTest:
          true,
      }),
    );

  glow.name =
    "Solar glow";

  glow.scale.set(
    19.2,
    19.2,
    1,
  );

  system.add(glow);

  /*
   * Tiny chromospheric flames.
   */
  const spicules =
    createSpicules();

  system.add(spicules);

  /*
   * Sparse plasma jets.
   *
   * Fewer and smaller eruptions prevent the Sun from looking constantly
   * explosive or game-like.
   */
  const jetData = [
    {
      latitude: -24,
      longitude: 18,
      height: 1.75,
      bend: 0.42,
      phase: 0.4,
    },

    {
      latitude: 32,
      longitude: -48,
      height: 1.15,
      bend: -0.28,
      phase: 1.9,
    },

    {
      latitude: 8,
      longitude: 72,
      height: 1.45,
      bend: 0.31,
      phase: 3.2,
    },

    {
      latitude: -46,
      longitude: -82,
      height: 0.95,
      bend: -0.22,
      phase: 4.5,
    },
  ];

  const plasmaJets =
    jetData.map(
      (config) =>
        createPlasmaJet(
          config,
          glowTexture,
        ),
    );

  system.add(
    ...plasmaJets
  );

  /*
   * Only two subtle coronal arches are retained.
   */
  const coronalLoops = [
    {
      angle: 2.75,
      width: 0.25,
      height: 1.65,
      tilt: 0.42,
      phase: 1.2,
    },

    {
      angle: 5.35,
      width: 0.18,
      height: 1.05,
      tilt: -0.58,
      phase: 4.1,
    },
  ].map(
    (config) =>
      createCoronalLoop(
        config,
        glowTexture,
      ),
  );

  system.add(
    ...coronalLoops
  );

  /*
   * The Sun lights the rest of the solar system.
   *
   * This light does not directly illuminate the Sun's ShaderMaterial because
   * its surface lighting is calculated inside the custom shader.
   */
  const light =
    new THREE.PointLight(
      0xffdda0,
      5600,
      1600,
      1.45,
    );

  light.name =
    "Solar point light";

  system.add(light);

  world.add(system);

  /*
   * Only the photosphere is registered as the clickable object.
   *
   * Transparent atmosphere shells should not intercept the raycaster.
   */
  hoverTargets.push(surface);

  return {
    system,
    surface,
    chromosphere,
    innerCorona,
    outerCorona,
    glow,
    spicules,
    plasmaJets,
    coronalLoops,
    light,
  };
}

/**
 * Advances every animated Sun layer.
 *
 * motionScale can be reduced when the user is closely inspecting the Sun.
 */
export function updateSun(
  sun,
  time,
  motionScale = 1,
) {
  /*
   * The massive photosphere rotates slowly.
   *
   * Surface plasma already evolves inside its shader, so the mesh itself does
   * not need to rotate quickly.
   */
  sun.surface.rotation.y +=
    0.00135 *
    motionScale;

  sun.chromosphere.rotation.y -=
    0.00042 *
    motionScale;

  sun.innerCorona.rotation.y +=
    0.00025 *
    motionScale;

  sun.outerCorona.rotation.y -=
    0.00014 *
    motionScale;

  /*
   * Advance all Sun shader clocks.
   */
  if (
    sun.surface.material.uniforms?.uTime
  ) {
    sun.surface.material.uniforms.uTime.value =
      time;
  }

  if (
    sun.chromosphere.material.uniforms?.uTime
  ) {
    sun.chromosphere.material.uniforms.uTime.value =
      time;
  }

  if (
    sun.innerCorona.material.uniforms?.uTime
  ) {
    sun.innerCorona.material.uniforms.uTime.value =
      time;
  }

  if (
    sun.outerCorona.material.uniforms?.uTime
  ) {
    sun.outerCorona.material.uniforms.uTime.value =
      time;
  }

  /*
   * Very gentle outer glow pulse.
   */
  const glowPulse =
    1 +
    Math.sin(
      time * 0.52
    ) *
    0.012;

  sun.glow.scale.set(
    19.2 * glowPulse,
    19.2 * glowPulse,
    1,
  );

  sun.glow.material.opacity =
    0.022 +
    Math.sin(
      time * 0.67
    ) *
    0.0035;

  /*
   * Spicules rotate and breathe as one thin plasma fringe.
   */
  sun.spicules.rotation.y +=
    0.00034 *
    motionScale;

  sun.spicules.rotation.x =
    Math.sin(
      time * 0.11
    ) *
    0.005;

  const spiculePulse =
    1 +
    Math.sin(
      time * 4.8
    ) *
    0.010;

  sun.spicules.scale.setScalar(
    spiculePulse
  );

  const spiculeMesh =
    sun.spicules.children[0];

  if (spiculeMesh?.material) {
    spiculeMesh.material.opacity =
      0.15 +
      Math.sin(
        time * 5.2
      ) *
      0.024;
  }

  /*
   * Animate localized plasma jets.
   */
  sun.plasmaJets.forEach(
    (jet) => {
      const {
        direction,
        tangent,
        height,
        bend,
        phase,
        particles,
        core,
      } =
        jet.userData;

      core.material.opacity =
        0.25 +
        Math.sin(
          time * 2.8 +
          phase
        ) *
        0.09;

      const coreSize =
        0.39 +
        Math.sin(
          time * 3.4 +
          phase
        ) *
        0.055;

      core.scale.set(
        coreSize,
        coreSize,
        1,
      );

      particles.forEach(
        (particle) => {
          /*
           * Plasma repeatedly moves outward and fades.
           *
           * The lower speed makes the eruption feel massive instead of like
           * fast sparks.
           */
          const progress =
            (
              time * 0.072 +
              particle.userData.offset +
              phase * 0.05
            ) %
            1;

          const radialDistance =
            SUN_RADIUS *
              1.008 +
            progress *
              height;

          const lateralOffset =
            Math.sin(
              Math.PI *
              progress
            ) *
            bend;

          particle.position
            .copy(direction)
            .multiplyScalar(
              radialDistance
            )
            .addScaledVector(
              tangent,
              lateralOffset,
            );

          const life =
            Math.sin(
              Math.PI *
              progress
            ) *
            (
              1 -
              progress *
                0.62
            );

          const flicker =
            0.78 +
            Math.sin(
              time * 6.2 +
              particle.userData.phase
            ) *
            0.22;

          const size =
            (
              0.055 +
              life * 0.22
            ) *
            flicker;

          particle.scale.set(
            size,
            size *
              (
                1.12 +
                progress * 0.36
              ),
            1,
          );

          particle.material.opacity =
            life *
            (
              0.24 +
              flicker * 0.25
            );
        },
      );
    },
  );

  /*
   * Animate coronal-loop fragments.
   */
  sun.coronalLoops.forEach(
    (loop) => {
      const {
        curve,
        particles,
        phase,
      } =
        loop.userData;

      particles.forEach(
        (particle) => {
          const progress =
            (
              particle.userData.offset +
              time * 0.018
            ) %
            1;

          const point =
            curve.getPoint(
              progress
            );

          /*
           * Tiny turbulence breaks the perfect mathematical curve.
           */
          const turbulence =
            Math.sin(
              time * 3.6 +
              particle.userData.phase +
              phase
            ) *
            0.028;

          point.y +=
            turbulence;

          particle.position.copy(
            point
          );

          const envelope =
            Math.sin(
              Math.PI *
              progress
            );

          const flicker =
            0.72 +
            Math.sin(
              time * 5.1 +
              particle.userData.phase
            ) *
            0.28;

          const size =
            (
              0.047 +
              envelope * 0.125
            ) *
            (
              0.82 +
              flicker * 0.25
            );

          particle.scale.set(
            size,
            size * 1.20,
            1,
          );

          particle.material.opacity =
            envelope *
            (
              0.10 +
              flicker * 0.22
            );
        },
      );
    },
  );
}
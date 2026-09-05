/**
 * Layered Sun builder.
 *
 * A believable star cannot be represented by one textured sphere. This module
 * combines several lightweight layers, each responsible for a different effect:
 *
 * - photosphere: animated granular surface
 * - chromosphere: thin red-pink rim above the photosphere
 * - corona shells: white and silver-white plasma glow around the silhouette
 * - glow sprite: soft light extending into surrounding space
 * - spicules: tiny uneven flames attached to the outer edge
 * - plasma jets: sparse localized eruptions
 * - coronal loops: a small number of magnetic plasma arches
 *
 * The photosphere remains the main visual layer. All outer effects are kept
 * subtle so they do not hide the granular Sun surface.
 */
import * as THREE from "three";
import { PLANET_SCALE_PROFILES, getPlanetSizeComparison } from "../../config/celestialScale.js";

import { makeSunSurfaceMaterial } from "../../graphics/materials.js";

import {
  makeGlowTexture,
  makeNoiseTexture,
} from "../../graphics/proceduralTextures.js";

const SUN_RADIUS = PLANET_SCALE_PROFILES.Sun.visualRadius;

const SUN_CREATION_PROFILES = Object.freeze({
  high: Object.freeze({
    surfaceSegments: [192, 128],
    chromosphereSegments: [144, 96],
    innerCoronaSegments: [128, 88],
    outerCoronaSegments: [112, 80],
    spicules: 560,
    jetParticles: 42,
    loopParticles: 34,
    flareArcParticles: 92,
    flareEjectaParticles: 34,
    flareRingSegments: 96,
  }),
  medium: Object.freeze({
    surfaceSegments: [144, 96],
    chromosphereSegments: [112, 72],
    innerCoronaSegments: [96, 64],
    outerCoronaSegments: [80, 56],
    spicules: 420,
    jetParticles: 32,
    loopParticles: 26,
    flareArcParticles: 68,
    flareEjectaParticles: 26,
    flareRingSegments: 72,
  }),
  low: Object.freeze({
    surfaceSegments: [112, 72],
    chromosphereSegments: [80, 56],
    innerCoronaSegments: [72, 48],
    outerCoronaSegments: [64, 40],
    spicules: 280,
    jetParticles: 24,
    loopParticles: 20,
    flareArcParticles: 48,
    flareEjectaParticles: 18,
    flareRingSegments: 48,
  }),
});

const SUN_RUNTIME_PROFILES = Object.freeze({
  high: Object.freeze({ detailRatio: 1, resolvePixels: 7 }),
  medium: Object.freeze({ detailRatio: 0.76, resolvePixels: 12 }),
  low: Object.freeze({ detailRatio: 0.50, resolvePixels: 18 }),
});

const sunCurvePoint = new THREE.Vector3();

function createDistantStarTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const centre = size * 0.5;

  context.clearRect(0, 0, size, size);

  /*
   * A broad, cool-white bloom represents light scattering around an
   * overexposed solar disk. It is deliberately faint at the edge so the sprite
   * never looks like a flat circular badge against the star field.
   */
  const halo = context.createRadialGradient(centre, centre, 0, centre, centre, centre);
  halo.addColorStop(0, "rgba(255,255,255,1)");
  halo.addColorStop(0.022, "rgba(255,255,252,1)");
  halo.addColorStop(0.07, "rgba(255,250,226,0.94)");
  halo.addColorStop(0.16, "rgba(238,244,255,0.54)");
  halo.addColorStop(0.38, "rgba(198,215,255,0.13)");
  halo.addColorStop(0.68, "rgba(177,199,255,0.035)");
  halo.addColorStop(1, "rgba(220,235,255,0)");
  context.fillStyle = halo;
  context.fillRect(0, 0, size, size);

  /*
   * Paint a tapered ray in one direction. Every ray combines a translucent
   * triangular beam with a hairline centre, giving the Sun long photographic
   * diffraction spikes without drawing an opaque cross through the scene.
   */
  function paintRay(angle, length, width, opacity) {
    context.save();
    context.translate(centre, centre);
    context.rotate(angle);

    const beam = context.createLinearGradient(0, 0, length, 0);
    beam.addColorStop(0, `rgba(255,255,255,${opacity})`);
    beam.addColorStop(0.08, `rgba(252,253,255,${opacity * 0.62})`);
    beam.addColorStop(0.42, `rgba(222,233,255,${opacity * 0.16})`);
    beam.addColorStop(1, "rgba(196,216,255,0)");
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(0, -width);
    context.quadraticCurveTo(length * 0.2, -width * 0.28, length, 0);
    context.quadraticCurveTo(length * 0.2, width * 0.28, 0, width);
    context.closePath();
    context.fill();

    const needle = context.createLinearGradient(0, 0, length, 0);
    needle.addColorStop(0, `rgba(255,255,255,${Math.min(1, opacity * 1.35)})`);
    needle.addColorStop(0.18, `rgba(247,250,255,${opacity * 0.58})`);
    needle.addColorStop(0.62, `rgba(218,232,255,${opacity * 0.12})`);
    needle.addColorStop(1, "rgba(205,225,255,0)");
    context.fillStyle = needle;
    context.fillRect(0, -0.55, length, 1.1);
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "lighter";
  [
    { angle: 0, length: 0.97, width: 5.8, opacity: 0.88 },
    { angle: Math.PI * 0.5, length: 0.97, width: 5.8, opacity: 0.88 },
    { angle: Math.PI * 0.25, length: 0.78, width: 4.2, opacity: 0.62 },
    { angle: -Math.PI * 0.25, length: 0.78, width: 4.2, opacity: 0.62 },
    { angle: Math.PI * 0.125, length: 0.52, width: 2.4, opacity: 0.24 },
    { angle: -Math.PI * 0.125, length: 0.52, width: 2.4, opacity: 0.24 },
  ].forEach(({ angle, length, width, opacity }) => {
    paintRay(angle, centre * length, width, opacity);
    paintRay(angle + Math.PI, centre * length, width, opacity);
  });
  context.restore();

  /*
   * Repaint the white-hot centre last. This keeps the physical Sun hidden
   * inside an overexposed core when it is too small to resolve from a planet.
   */
  const core = context.createRadialGradient(
    centre,
    centre,
    0,
    centre,
    centre,
    centre * 0.19,
  );
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.2, "rgba(255,255,255,1)");
  core.addColorStop(0.48, "rgba(255,248,214,0.96)");
  core.addColorStop(0.76, "rgba(225,235,255,0.32)");
  core.addColorStop(1, "rgba(210,228,255,0)");
  context.fillStyle = core;
  context.fillRect(centre * 0.81, centre * 0.81, centre * 0.38, centre * 0.38);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

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
  const phi = THREE.MathUtils.degToRad(90 - latitude);

  const theta = THREE.MathUtils.degToRad(longitude);

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
function createSpicules(count = 560) {
  const group = new THREE.Group();

  group.name = "Solar spicules";

  const geometry = new THREE.ConeGeometry(0.024, 0.34, 4, 1, true);

  /*
   * Vertex colours allow each instance to use a slightly different orange,
   * red, or gold tone.
   */
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  const up = new THREE.Vector3(0, 1, 0);

  const mesh = new THREE.InstancedMesh(geometry, material, count);

  mesh.name = "Instanced solar spicules";

  const matrix = new THREE.Matrix4();

  const quaternion = new THREE.Quaternion();

  const scale = new THREE.Vector3();

  const position = new THREE.Vector3();

  const palette = [
    new THREE.Color(0xff4210),
    new THREE.Color(0xff6d18),
    new THREE.Color(0xff9a24),
    new THREE.Color(0xffc34d),
  ];

  for (let index = 0; index < count; index += 1) {
    /*
     * Fibonacci sphere distribution prevents obvious rows or clusters.
     */
    const y = 1 - (index / (count - 1)) * 2;

    const ringRadius = Math.sqrt(1 - y * y);

    const angle = index * Math.PI * (3 - Math.sqrt(5));

    const direction = new THREE.Vector3(
      Math.cos(angle) * ringRadius,
      y,
      Math.sin(angle) * ringRadius,
    );

    /*
     * Deterministic variation avoids regenerating random values each frame.
     */
    const normalizedVariation = ((index * 37) % 41) / 41;

    const height = 0.1 + normalizedVariation * 0.44;

    position.copy(direction).multiplyScalar(SUN_RADIUS + height * 0.44);

    quaternion.setFromUnitVectors(up, direction);

    scale.set(
      0.44 + (index % 4) * 0.08,

      height / 0.34,

      0.44 + (index % 3) * 0.09,
    );

    matrix.compose(position, quaternion, scale);

    mesh.setMatrixAt(index, matrix);

    mesh.setColorAt(index, palette[index % palette.length]);
  }

  mesh.instanceMatrix.needsUpdate = true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  mesh.userData.capacity = count;
  group.add(mesh);

  return group;
}

/**
 * Creates a warm plasma texture exclusively for solar flares, jets and loops.
 *
 * Unlike the generic glow texture, this contains no cyan or blue halo.
 */
function createSolarPlasmaTexture() {
  const size = 256;

  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  const center = size * 0.5;

  /*
   * Slightly stretched radial gradient.
   * It produces a white-hot centre surrounded by yellow, orange and red fire.
   */
  context.save();

  context.translate(center, center);

  context.scale(0.72, 1);

  const gradient = context.createRadialGradient(
    0,
    0,
    0,

    0,
    0,
    center,
  );

  gradient.addColorStop(0, "rgba(255, 255, 245, 1)");

  gradient.addColorStop(0.08, "rgba(255, 248, 205, 0.98)");

  gradient.addColorStop(0.2, "rgba(255, 205, 95, 0.92)");

  gradient.addColorStop(0.4, "rgba(255, 111, 22, 0.72)");

  gradient.addColorStop(0.64, "rgba(210, 38, 4, 0.34)");

  gradient.addColorStop(0.82, "rgba(105, 9, 0, 0.10)");

  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  context.fillStyle = gradient;

  context.fillRect(-center, -center, size, size);

  context.restore();

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  texture.minFilter = THREE.LinearFilter;

  texture.magFilter = THREE.LinearFilter;

  texture.generateMipmaps = false;

  return texture;
}


/**
 * Every plasma sprite on the Sun, drawn in one call.
 *
 * The flares, the jets and the coronal arches used to be six hundred and
 * twenty-one separate `Sprite` objects, each with its own material. That is a
 * perfectly reasonable way to author them and a very expensive way to draw
 * them: a sprite is a draw call, and six hundred draw calls were over half of
 * everything this scene submitted in a frame -- from anywhere in the Solar
 * System, whether or not the Sun was more than a few pixels across. Measured
 * against the rest of the scene it came to about four milliseconds a frame,
 * roughly a third of the frame budget, spent on the star's decoration.
 *
 * They are all the same quad, with the same texture, blended the same way, so
 * they can be one instanced mesh instead: position, size, colour and opacity
 * become per-instance attributes and the whole star's plasma costs a single
 * call. The billboarding is done in the vertex shader exactly the way a sprite
 * does it -- offset the corners in view space, so the quad always faces the
 * camera and never foreshortens.
 *
 * `acquire()` hands back an object with the same surface the animation code
 * was already writing to (`position`, `scale`, `material.opacity`, `visible`,
 * `userData`), which is why none of that code had to change. `flush()` copies
 * the frame's worth of it into the buffers in one pass.
 */
function createSolarSpriteBatch(texture) {
  const handles = [];
  let mesh = null;
  let offsets = null;
  let scales = null;
  let alphas = null;
  const worldPoint = new THREE.Vector3();

  return {
    /**
     * A stand-in for one `THREE.Sprite`.
     *
     * `frame` is an optional rotation applied at flush time, for the arches:
     * their tilt used to live on the group they were parented to, and there is
     * no per-particle parent any more.
     */
    acquire(colour, owner = null, frame = null) {
      const handle = {
        position: new THREE.Vector3(),
        scale: new THREE.Vector3(1, 1, 1),
        material: { opacity: 0, color: new THREE.Color(colour) },
        visible: true,
        userData: {},
        owner,
        frame,
      };
      handles.push(handle);
      return handle;
    },

    /** Called once, after every sprite that will ever exist has been claimed. */
    build(name) {
      const count = handles.length;
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
        -0.5, -0.5, 0,
        0.5, -0.5, 0,
        0.5, 0.5, 0,
        -0.5, 0.5, 0,
      ]), 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([
        0, 0, 1, 0, 1, 1, 0, 1,
      ]), 2));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);

      offsets = new Float32Array(count * 3);
      scales = new Float32Array(count * 2);
      alphas = new Float32Array(count);
      const colours = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) {
        const { color } = handles[index].material;
        colours[index * 3] = color.r;
        colours[index * 3 + 1] = color.g;
        colours[index * 3 + 2] = color.b;
      }

      geometry.setAttribute("iOffset", new THREE.InstancedBufferAttribute(offsets, 3));
      geometry.setAttribute("iScale", new THREE.InstancedBufferAttribute(scales, 2));
      geometry.setAttribute("iColour", new THREE.InstancedBufferAttribute(colours, 3));
      geometry.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(alphas, 1));
      geometry.instanceCount = count;

      const material = new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: true,
        vertexShader: /* glsl */`
          attribute vec3 iOffset;
          attribute vec2 iScale;
          attribute vec3 iColour;
          attribute float iAlpha;

          varying vec2 vUv;
          varying vec3 vColour;
          varying float vAlpha;

          void main() {
            vUv = uv;
            vColour = iColour;
            vAlpha = iAlpha;
            /*
             * Billboarding, done the way a sprite does it: put the instance
             * where it belongs in view space, then push the quad's corners out
             * sideways from there. Because the offset happens after the view
             * transform, the quad has no orientation of its own to turn away.
             */
            vec4 viewPosition = modelViewMatrix * vec4(iOffset, 1.0);
            viewPosition.xy += position.xy * iScale;
            gl_Position = projectionMatrix * viewPosition;
          }
        `,
        fragmentShader: /* glsl */`
          uniform sampler2D map;

          varying vec2 vUv;
          varying vec3 vColour;
          varying float vAlpha;

          void main() {
            vec4 texel = texture2D(map, vUv);
            gl_FragColor = vec4(vColour * texel.rgb, texel.a * vAlpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      });

      mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      // The Sun's plasma sits in a known, fixed shell around the origin of the
      // solar system, and the bounding sphere three would compute for a
      // one-quad geometry is not that shell -- so culling is done by hand,
      // which here means not at all.
      mesh.frustumCulled = false;
      // Not a pick target. The photosphere is the only clickable part of the
      // star, and it is registered separately.
      mesh.raycast = () => {};
      return mesh;
    },

    mesh: () => mesh,

    /**
     * One pass over every sprite, once a frame.
     *
     * A sprite whose group is switched off, or which the animation has faded
     * out, is collapsed to zero size rather than merely made transparent: a
     * transparent quad still costs the pixels it covers, and a degenerate one
     * costs nothing.
     */
    flush() {
      if (!mesh) return;
      for (let index = 0; index < handles.length; index += 1) {
        const handle = handles[index];
        const at2 = index * 2;
        const live = handle.visible
          && handle.material.opacity > 0.001
          && (!handle.owner || handle.owner.visible);
        if (!live) {
          scales[at2] = 0;
          scales[at2 + 1] = 0;
          alphas[index] = 0;
          continue;
        }
        worldPoint.copy(handle.position);
        if (handle.frame) worldPoint.applyQuaternion(handle.frame);
        const at3 = index * 3;
        offsets[at3] = worldPoint.x;
        offsets[at3 + 1] = worldPoint.y;
        offsets[at3 + 2] = worldPoint.z;
        scales[at2] = handle.scale.x;
        scales[at2 + 1] = handle.scale.y;
        alphas[index] = handle.material.opacity;
      }
      const { attributes } = mesh.geometry;
      attributes.iOffset.needsUpdate = true;
      attributes.iScale.needsUpdate = true;
      attributes.iAlpha.needsUpdate = true;
    },
  };
}

/**
 * Creates one localized plasma eruption.
 *
 * Small sprites repeatedly move outward, bend sideways, fade, and restart.
 */
function createPlasmaJet(
  { latitude, longitude, height, bend, phase },
  batch,
  particleCount = 42,
) {
  const direction = sphericalDirection(latitude, longitude);

  /*
   * Tangent controls the sideways curve of the plasma stream.
   */
  const referenceAxis =
    Math.abs(direction.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

  const tangent = new THREE.Vector3()
    .crossVectors(referenceAxis, direction)
    .normalize();

  const group = new THREE.Group();

  group.name = "Solar plasma jet";

  const colors = [0xff3508, 0xff4f0b, 0xff7014, 0xff9d25, 0xffc84a, 0xffffa1];

  const particles = Array.from(
    {
      length: particleCount,
    },

    (_, index) => {
      const particle = batch.acquire(colors[index % colors.length], group);

      particle.userData.offset = index / particleCount;

      particle.userData.phase = phase + index * 1.17;

      return particle;
    },
  );

  /*
   * Compact active-region glow at the plasma jet's base.
   */
  const core = batch.acquire(0xffffee, group);

  core.material.opacity = 0.52;

  core.position.copy(direction).multiplyScalar(SUN_RADIUS * 1.008);

  core.scale.set(0.46, 0.46, 1);

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
function createCoronalLoop({ angle, width, height, tilt, phase }, batch, particleCount = 34) {
  const startAngle = angle - width * 0.5;

  const endAngle = angle + width * 0.5;

  const pointOnSurface = (value, radius = SUN_RADIUS * 1.008) =>
    new THREE.Vector3(Math.cos(value) * radius, 0, Math.sin(value) * radius);

  const start = pointOnSurface(startAngle);

  const end = pointOnSurface(endAngle);

  const middle = (startAngle + endAngle) * 0.5;

  const controlA = pointOnSurface(middle - width * 0.18, SUN_RADIUS + height);

  const controlB = pointOnSurface(middle + width * 0.18, SUN_RADIUS + height);

  controlA.y = height * 0.2;

  controlB.y = height * 0.2;

  const curve = new THREE.CubicBezierCurve3(start, controlA, controlB, end);

  const group = new THREE.Group();

  group.name = "Coronal loop";

  /*
   * The arch's tilt. It used to be the group's own rotation, and the particles
   * inherited it by being parented to the group. They are instances in a
   * shared mesh now and have no parent to inherit from, so the same rotation
   * is carried on each one and applied where the position is written out.
   */
  group.rotation.x = tilt;
  const tiltFrame = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt);

  const colors = [0xff4310, 0xff711b, 0xffa430, 0xffffa3];

  const particles = Array.from(
    {
      length: particleCount,
    },

    (_, index) => {
      const particle = batch.acquire(colors[index % colors.length], group, tiltFrame);

      particle.userData.offset = index / particleCount;

      particle.userData.phase = phase + index * 0.93;

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
 * Creates a solar flare eruption.
 *
 * The flare contains:
 * - a bright active-region core
 * - an expanding plasma arc
 * - several outward-moving particles
 * - a shock-wave ring that expands and fades
 */
function createSolarFlare(
  { latitude, longitude, height, width, bend, phase },
  batch,
  { arcCount = 92, ejectaCount = 34, ringSegments = 96 } = {},
) {
  const group = new THREE.Group();
  group.name = "Solar flare";

  const direction = sphericalDirection(latitude, longitude);

  const referenceAxis =
    Math.abs(direction.y) > 0.88
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);

  const tangent = new THREE.Vector3()
    .crossVectors(referenceAxis, direction)
    .normalize();

  const bitangent = new THREE.Vector3()
    .crossVectors(direction, tangent)
    .normalize();

  /*
   * Bright flare footpoint.
   */
  const core = batch.acquire(0xffffd2, group);

  core.position.copy(direction).multiplyScalar(SUN_RADIUS * 1.008);

  core.scale.set(0.35, 0.35, 1);

  /*
   * Build the curved magnetic flare path.
   *
   * The curve starts on the Sun, rises outward, bends sideways,
   * and ends back near the surface.
   */
  const start = direction
    .clone()
    .multiplyScalar(SUN_RADIUS * 1.01)
    .addScaledVector(tangent, -width * 0.5);

  const end = direction
    .clone()
    .multiplyScalar(SUN_RADIUS * 1.01)
    .addScaledVector(tangent, width * 0.5);

  const controlA = direction
    .clone()
    .multiplyScalar(SUN_RADIUS + height)
    .addScaledVector(tangent, -width * 0.2)
    .addScaledVector(bitangent, bend);

  const controlB = direction
    .clone()
    .multiplyScalar(SUN_RADIUS + height)
    .addScaledVector(tangent, width * 0.2)
    .addScaledVector(bitangent, bend);

  const curve = new THREE.CubicBezierCurve3(start, controlA, controlB, end);

  /*
   * Fragmented flare particles.
   *
   * Sprites are used instead of a solid tube so the flare
   * feels like plasma rather than a neon wire.
   */
  const colors = [0xff4210, 0xff6f18, 0xffa62d, 0xffd85c, 0xffffc4, 0xffffff];

  const arcParticles = Array.from(
    {
      length: arcCount,
    },

    (_, index) => {
      const particle = batch.acquire(colors[index % colors.length], group);

      particle.userData.offset = index / arcCount;

      particle.userData.phase = phase + index * 0.63;

      return particle;
    },
  );

  /*
   * Outward-moving flare fragments.
   */
  const ejectaParticles = Array.from(
    {
      length: ejectaCount,
    },

    (_, index) => {
      const particle = batch.acquire(colors[index % colors.length], group);

      particle.userData.offset = index / ejectaCount;

      particle.userData.angle = (index / ejectaCount) * Math.PI * 2;

      particle.userData.phase = phase + index * 1.13;

      return particle;
    },
  );

  /*
   * Expanding shock-wave ring.
   *
   * This gives the impression of a solar wave travelling
   * away from the flare region.
   */
  const shockWave = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1, ringSegments),

    new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    }),
  );

  shockWave.position.copy(direction).multiplyScalar(SUN_RADIUS * 1.025);

  shockWave.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction,
  );

  shockWave.scale.setScalar(0.1);

  group.add(shockWave);

  group.userData = {
    direction,
    tangent,
    bitangent,
    curve,
    height,
    width,
    bend,
    phase,
    core,
    arcParticles,
    ejectaParticles,
    shockWave,
  };

  return group;
}

/**
 * Constructs the complete Sun.
 *
 * The returned object is later passed to updateSun() every frame.
 */
export function createSun({ world, hoverTargets, texture, quality = "high" }) {
  const qualityName = SUN_CREATION_PROFILES[quality] ? quality : "medium";
  const creationProfile = SUN_CREATION_PROFILES[qualityName];
  const system = new THREE.Group();

  system.name = "Sun system";

  /*
   * Use the loaded Sun texture when available.
   *
   * The new photosphere shader uses it only as subtle organic variation.
   */
  const surfaceTexture = texture ?? makeNoiseTexture("sun");

  /*
   * A moderately dense sphere provides a smooth silhouette while keeping
   * the Sun suitable for real-time browser rendering.
   */
  const surfaceGeometry = new THREE.SphereGeometry(SUN_RADIUS, ...creationProfile.surfaceSegments);

  const surfaceMaterial = makeSunSurfaceMaterial(surfaceTexture);

  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);

  surface.name = "Sun";

  surface.userData = {
    name: "Sun",

    detail: "G-type star | 99.86% of solar system mass",

    focusScale: 1.2,

    visualRadius: SUN_RADIUS,
    focusVisualRadius: SUN_RADIUS * 1.62,
    physicalDiameterKm: PLANET_SCALE_PROFILES.Sun.diameterKm,
    diameterEarths: PLANET_SCALE_PROFILES.Sun.diameterEarths,
    volumeEarths: PLANET_SCALE_PROFILES.Sun.volumeEarths,
    sizeComparison: getPlanetSizeComparison("Sun"),

    /*
     * Prevent the focus camera from moving inside this large mesh.
     */
    minFocusDistance: PLANET_SCALE_PROFILES.Sun.focusDistance * 0.88,
    focusDistance: PLANET_SCALE_PROFILES.Sun.focusDistance,
    focusEase: 0.065,
    focusFov: 34,

    info: {
      type: "Star",

      diameter: "1,392,700 km",

      orbitalSpeed: "System reference body",

      distanceFromEarth: "≈ 149.6 million km",

      sizeComparison: getPlanetSizeComparison("Sun"),

      description:
        "A living ocean of plasma whose magnetic storms, radiant light, and immense gravity sustain every world in this planetary system.",
    },
  };

  system.add(surface);

  /*
   * Chromosphere
   *
   * This shell stays very close to the photosphere and creates a narrow,
   * irregular pale red-pink edge.
   */
  const chromosphere = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.012, ...creationProfile.chromosphereSegments),

    createAtmosphereMaterial({
      color: 0xff6b4a,

      intensity: 0.3,

      speed: 0.028,

      power: 3.15,

      waveScale: 18,
    }),
  );

  chromosphere.name = "Solar chromosphere";

  system.add(chromosphere);

  /*
   * Inner corona
   *
   * Kept faint so the photosphere remains clearly visible.
   */
  const innerCorona = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.027, ...creationProfile.innerCoronaSegments),

    createAtmosphereMaterial({
      color: 0xfffbf2,

      intensity: 0.105,

      speed: 0.017,

      power: 4.25,

      waveScale: 11,
    }),
  );

  innerCorona.name = "Inner solar corona";

  /*
   * Outer corona
   *
   * Provides only a thin, transparent silver-blue edge.
   */
  const outerCorona = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS * 1.046, ...creationProfile.outerCoronaSegments),

    createAtmosphereMaterial({
      color: 0xe4efff,

      intensity: 0.032,

      speed: -0.011,

      power: 5.5,

      waveScale: 8,
    }),
  );

  outerCorona.name = "Outer solar corona";

  system.add(innerCorona, outerCorona);

  /*
   * Soft camera-facing glow.
   *
   * This is intentionally smaller and fainter than the previous version.
   */
  // const glowTexture =
  //   makeGlowTexture();
  const glowTexture = makeGlowTexture();

  /*
   * Warm texture used only by chromospheric plasma and prominences.
   * This prevents blue/cyan edges from appearing in flares.
   */
  const solarPlasmaTexture = createSolarPlasmaTexture();

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,

      color: 0xfffdf4,

      transparent: true,

      opacity: 0.024,

      blending: THREE.AdditiveBlending,

      depthWrite: false,

      depthTest: true,

      // Solar radiance is already authored in display-space colours. Keeping
      // it outside scene tone mapping prevents a distant halo from dimming when
      // focus changes the camera exposure and surrounding scene brightness.
      toneMapped: false,
    }),
  );

  glow.name = "Solar glow";

  glow.scale.set(SUN_RADIUS * 2.1, SUN_RADIUS * 2.1, 1);

  system.add(glow);

  // At planetary and interstellar viewpoints, the solar disk becomes too small
  // to resolve. This depth-tested sprite turns it into a bright star-like point
  // with restrained diffraction rays and can be naturally hidden by a planet.
  const distantStar = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createDistantStarTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    }),
  );
  distantStar.name = "Distant solar star flare";
  distantStar.visible = false;
  distantStar.renderOrder = 8;
  distantStar.scale.set(1, 1, 1);
  system.add(distantStar);

  /*
   * Tiny chromospheric flames.
   */
  const spicules = createSpicules(creationProfile.spicules);

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

  /*
   * One instanced mesh for the whole star's plasma. Every flare, jet and arch
   * particle is claimed from it here and drawn from it once per frame; see
   * `createSolarSpriteBatch` for why.
   */
  const spriteBatch = createSolarSpriteBatch(solarPlasmaTexture);

  const plasmaJets = jetData.map((config) =>
    createPlasmaJet(config, spriteBatch, creationProfile.jetParticles),
  );

  system.add(...plasmaJets);

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
  ].map((config) => createCoronalLoop(
    config,
    spriteBatch,
    creationProfile.loopParticles,
  ));

  /*
   * Larger solar flare events.
   *
   * These remain sparse so the Sun does not look permanently explosive.
   */
  const flareData = [
    {
      latitude: 18,
      longitude: 38,
      height: 3.2,
      width: 1.5,
      bend: 0.45,
      phase: 0.7,
    },

    {
      latitude: -31,
      longitude: -62,
      height: 2.4,
      width: 1.1,
      bend: -0.34,
      phase: 3.4,
    },

    {
      latitude: 47,
      longitude: 124,
      height: 2.75,
      width: 1.25,
      bend: 0.28,
      phase: 6.2,
    },
  ];

  const solarFlares = flareData.map((config) =>
    createSolarFlare(config, spriteBatch, {
      arcCount: creationProfile.flareArcParticles,
      ejectaCount: creationProfile.flareEjectaParticles,
      ringSegments: creationProfile.flareRingSegments,
    }),
  );

  system.add(...solarFlares);

  system.add(...coronalLoops);

  // Built only now, because it sizes itself to exactly the number of sprites
  // the three families between them turned out to want.
  system.add(spriteBatch.build("Solar plasma sprites"));

  /*
   * The Sun lights the rest of the solar system.
   *
   * This light does not directly illuminate the Sun's ShaderMaterial because
   * its surface lighting is calculated inside the custom shader.
   */
  const light = new THREE.PointLight(0xffffff, 28000, 6500, 1.28);

  light.name = "Solar point light";

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
    distantStar,
    spicules,
    plasmaJets,
    coronalLoops,
    solarFlares,
    spriteBatch,
    light,
    capacityQualityName: qualityName,
    performanceSignature: "",
  };
}

/**
 * Applies a distance-aware runtime budget without changing the authored Sun.
 * Invisible sub-pixel effects are disabled first; close focused views retain
 * the richest version available in the device's creation tier.
 */
export function setSunPerformanceProfile(
  sun,
  qualityName,
  { projectedRadiusPixels = Infinity, focused = false } = {},
) {
  if (!sun) return;
  const requested = SUN_RUNTIME_PROFILES[qualityName] ?? SUN_RUNTIME_PROFILES.medium;
  const capacity = SUN_RUNTIME_PROFILES[sun.capacityQualityName]
    ?? SUN_RUNTIME_PROFILES.medium;
  const relativeRatio = Math.min(1, requested.detailRatio / capacity.detailRatio);
  const resolved = focused || projectedRadiusPixels >= requested.resolvePixels;
  const close = focused || projectedRadiusPixels >= 72;
  const signature = `${qualityName}|${resolved ? 1 : 0}|${close ? 1 : 0}`;
  if (sun.performanceSignature === signature) return;
  sun.performanceSignature = signature;
  const spiculeMesh = sun.spicules?.children?.[0];
  if (spiculeMesh) {
    const capacityCount = spiculeMesh.userData.capacity ?? spiculeMesh.count;
    spiculeMesh.count = resolved
      ? Math.max(1, Math.round(capacityCount * relativeRatio))
      : 0;
  }
  if (sun.spicules) sun.spicules.visible = resolved;

  const visibleJetCount = resolved
    ? Math.max(1, Math.ceil(sun.plasmaJets.length * (close ? relativeRatio : relativeRatio * 0.55)))
    : 0;
  const visibleLoopCount = resolved
    ? Math.max(1, Math.ceil(sun.coronalLoops.length * (close ? relativeRatio : relativeRatio * 0.45)))
    : 0;
  const visibleFlareCount = resolved
    ? Math.max(1, Math.ceil(sun.solarFlares.length * (close ? relativeRatio : relativeRatio * 0.34)))
    : 0;

  sun.plasmaJets.forEach((jet, index) => {
    jet.visible = index < visibleJetCount;
    const particleRatio = close ? relativeRatio : relativeRatio * 0.62;
    jet.userData.particles.forEach((particle, particleIndex, particles) => {
      particle.visible = particleIndex < Math.max(1, Math.round(particles.length * particleRatio));
    });
  });
  sun.coronalLoops.forEach((loop, index) => {
    loop.visible = index < visibleLoopCount;
    const particleRatio = close ? relativeRatio : relativeRatio * 0.58;
    loop.userData.particles.forEach((particle, particleIndex, particles) => {
      particle.visible = particleIndex < Math.max(1, Math.round(particles.length * particleRatio));
    });
  });
  sun.solarFlares.forEach((flare, index) => {
    flare.visible = index < visibleFlareCount;
    const particleRatio = close ? relativeRatio : relativeRatio * 0.52;
    flare.userData.arcParticles.forEach((particle, particleIndex, particles) => {
      particle.visible = particleIndex < Math.max(1, Math.round(particles.length * particleRatio));
    });
    flare.userData.ejectaParticles.forEach((particle, particleIndex, particles) => {
      particle.visible = particleIndex < Math.max(1, Math.round(particles.length * particleRatio));
    });
  });
}

/**
 * Advances every animated Sun layer.
 *
 * motionScale can be reduced when the user is closely inspecting the Sun.
 */
export function updateSun(sun, time, motionScale = 1) {
  /*
   * The massive photosphere rotates slowly.
   *
   * Surface plasma already evolves inside its shader, so the mesh itself does
   * not need to rotate quickly.
   */
  sun.surface.rotation.y += 0.00135 * motionScale;

  sun.chromosphere.rotation.y -= 0.00042 * motionScale;

  sun.innerCorona.rotation.y += 0.00025 * motionScale;

  sun.outerCorona.rotation.y -= 0.00014 * motionScale;

  /*
   * Advance all Sun shader clocks.
   */
  if (sun.surface.material.uniforms?.uTime) {
    sun.surface.material.uniforms.uTime.value = time;
  }

  if (sun.chromosphere.material.uniforms?.uTime) {
    sun.chromosphere.material.uniforms.uTime.value = time;
  }

  if (sun.innerCorona.material.uniforms?.uTime) {
    sun.innerCorona.material.uniforms.uTime.value = time;
  }

  if (sun.outerCorona.material.uniforms?.uTime) {
    sun.outerCorona.material.uniforms.uTime.value = time;
  }

  /*
   * Very gentle outer glow pulse.
   */
  const glowPulse = 1 + Math.sin(time * 0.52) * 0.012;

  sun.glow.scale.set(19.2 * glowPulse, 19.2 * glowPulse, 1);

  sun.glow.material.opacity = 0.022 + Math.sin(time * 0.67) * 0.0035;

  /*
   * Spicules rotate and breathe as one thin plasma fringe.
   */
  if (sun.spicules.visible) sun.spicules.rotation.y += 0.00034 * motionScale;

  if (sun.spicules.visible) sun.spicules.rotation.x = Math.sin(time * 0.11) * 0.005;

  const spiculePulse = 1 + Math.sin(time * 4.8) * 0.01;

  if (sun.spicules.visible) sun.spicules.scale.setScalar(spiculePulse);

  const spiculeMesh = sun.spicules.children[0];

  if (sun.spicules.visible && spiculeMesh?.material) {
    spiculeMesh.material.opacity = 0.15 + Math.sin(time * 5.2) * 0.024;
  }

  /*
   * Animate localized plasma jets.
   */
  sun.plasmaJets.forEach((jet) => {
    if (!jet.visible) return;
    const { direction, tangent, height, bend, phase, particles, core } =
      jet.userData;

    core.material.opacity = 0.25 + Math.sin(time * 2.8 + phase) * 0.09;

    const coreSize = 0.39 + Math.sin(time * 3.4 + phase) * 0.055;

    core.scale.set(coreSize, coreSize, 1);

    particles.forEach((particle) => {
      if (!particle.visible) return;
      /*
       * Plasma repeatedly moves outward and fades.
       *
       * The lower speed makes the eruption feel massive instead of like
       * fast sparks.
       */
      const progress =
        (time * 0.072 + particle.userData.offset + phase * 0.05) % 1;

      const radialDistance = SUN_RADIUS * 1.008 + progress * height;

      const lateralOffset = Math.sin(Math.PI * progress) * bend;

      particle.position
        .copy(direction)
        .multiplyScalar(radialDistance)
        .addScaledVector(tangent, lateralOffset);

      const life = Math.sin(Math.PI * progress) * (1 - progress * 0.62);
      const turbulence =
        Math.sin(time * 5.4 + particle.userData.phase) * life * 0.075;

      particle.position.addScaledVector(tangent, turbulence);
      const flicker =
        0.78 + Math.sin(time * 6.2 + particle.userData.phase) * 0.22;

      const size = (0.09 + life * 0.29) * (0.88 + flicker * 0.18);

      particle.scale.set(size * 1.1, size * (1.35 + progress * 0.55), 1);

      particle.material.opacity = life * (0.3 + flicker * 0.22);
    });
  });

  /*
   * Animate coronal-loop fragments.
   */
  sun.coronalLoops.forEach((loop) => {
    if (!loop.visible) return;
    const { curve, particles, phase } = loop.userData;

    particles.forEach((particle) => {
      if (!particle.visible) return;
      const progress = (particle.userData.offset + time * 0.018) % 1;

      const point = curve.getPoint(progress, sunCurvePoint);

      /*
       * Tiny turbulence breaks the perfect mathematical curve.
       */
      const turbulence =
        Math.sin(time * 3.6 + particle.userData.phase + phase) * 0.028;

      point.y += turbulence;

      particle.position.copy(point);

      const envelope = Math.sin(Math.PI * progress);

      const flicker =
        0.72 + Math.sin(time * 5.1 + particle.userData.phase) * 0.28;

      const size = (0.047 + envelope * 0.125) * (0.82 + flicker * 0.25);

      particle.scale.set(size, size * 1.2, 1);

      particle.material.opacity = envelope * (0.1 + flicker * 0.22);
    });
  });
  /*
   * Animate large solar flares.
   */
  sun.solarFlares.forEach((flare) => {
    if (!flare.visible) return;
    const {
      direction,
      tangent,
      bitangent,
      curve,
      height,
      phase,
      core,
      arcParticles,
      ejectaParticles,
      shockWave,
    } = flare.userData;

    /*
     * Each flare goes through a repeating life cycle:
     *
     * quiet
     * → ignition
     * → bright eruption
     * → outward expansion
     * → fade
     */
    const cycle = (time * 0.055 + phase * 0.13) % 1;

    const ignition = THREE.MathUtils.smoothstep(cycle, 0.05, 0.18);

    const fading = 1 - THREE.MathUtils.smoothstep(cycle, 0.68, 0.96);

    const flareLife = ignition * fading;

    /*
     * Bright active-region core.
     */
    const corePulse = 0.72 + Math.sin(time * 9 + phase) * 0.28;

    const coreSize = 0.24 + flareLife * 0.52 * corePulse;

    core.scale.set(coreSize, coreSize, 1);

    core.material.opacity = flareLife * (0.36 + corePulse * 0.38);

    /*
     * Plasma moves in both directions around the magnetic arch.
     */
    arcParticles.forEach((particle) => {
      if (!particle.visible) return;
      const travel = (particle.userData.offset + time * 0.028) % 1;

      const point = curve.getPoint(travel, sunCurvePoint);

      const turbulence = Math.sin(time * 5.8 + particle.userData.phase) * 0.045;

      point
        .addScaledVector(bitangent, turbulence)
        .addScaledVector(direction, turbulence * 0.25);

      particle.position.copy(point);

      const envelope = Math.sin(Math.PI * travel);

      const flicker =
        0.68 + Math.sin(time * 8.5 + particle.userData.phase) * 0.32;

      const particleSize =
        (0.065 + envelope * 0.17) * (0.82 + flicker * 0.35) * flareLife;

      particle.scale.set(particleSize * 1.12, particleSize * 1.55, 1);

      particle.material.opacity = envelope * flareLife * (0.18 + flicker * 0.5);
    });

    /*
     * Outward solar ejecta.
     *
     * These particles rise away from the surface, spread,
     * slow down, and fade.
     */
    ejectaParticles.forEach((particle) => {
      if (!particle.visible) return;
      const progress = (cycle + particle.userData.offset * 0.42) % 1;

      const outwardLife = Math.sin(Math.PI * progress);

      const radialDistance = SUN_RADIUS * 1.015 + progress * height * 1.35;

      const spread = Math.sin(Math.PI * progress) * (0.18 + progress * 0.85);

      const angle = particle.userData.angle;

      particle.position
        .copy(direction)
        .multiplyScalar(radialDistance)
        .addScaledVector(tangent, Math.cos(angle) * spread)
        .addScaledVector(bitangent, Math.sin(angle) * spread);

      const flicker =
        0.66 + Math.sin(time * 7.2 + particle.userData.phase) * 0.34;

      const size = (0.035 + outwardLife * 0.16) * flicker * flareLife;

      particle.scale.set(size, size * (1.25 + progress * 0.8), 1);

      particle.material.opacity =
        outwardLife * flareLife * (0.12 + flicker * 0.34);
    });

    /*
     * Expanding shock wave.
     *
     * The wave starts close to the flare and grows outward.
     */
    const waveProgress = THREE.MathUtils.clamp((cycle - 0.15) / 0.55, 0, 1);

    const waveScale = 0.2 + waveProgress * 3.8;

    shockWave.scale.setScalar(waveScale);

    shockWave.material.opacity =
      Math.sin(Math.PI * waveProgress) * flareLife * 0.16;

    shockWave.rotation.z += 0.0015 * motionScale;
  });

  /*
   * Everything the three loops above just wrote, copied into the instanced
   * buffers in one pass. This is the only place the plasma reaches the GPU.
   */
  sun.spriteBatch?.flush();
}

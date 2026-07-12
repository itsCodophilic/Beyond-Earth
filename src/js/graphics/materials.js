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
        gl_PointSize = uSize * aScale * (0.74 + vTwinkle * 0.65) * (300.0 / max(80.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uOpacity;
      void main() {
        // gl_PointCoord runs from 0–1 across each square point. Re-centering it
        // allows distance-from-center calculations for a circular glow.
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        float core = smoothstep(0.24, 0.0, dist);
        float halo = smoothstep(0.5, 0.0, dist) * 0.34;
        float alpha = (core + halo) * uOpacity * (0.55 + vTwinkle * 0.55);
        // Discard transparent edge pixels so point squares look like round stars.
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(vColor * (0.75 + vTwinkle * 0.72), alpha);
      }
    `,
    transparent: true,
    vertexColors: true,
    // Additive blending makes overlapping particles brighter like emitted light.
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
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
        float glow = smoothstep(0.94, 0.24, dist);
        float pulse = 0.22 + 0.28 * sin(uTime * 3.8 - dist * 12.0);
        float corona = glow * pulse * uIntensity * 0.76;
        float rim = smoothstep(0.58, 0.52, length(uv)) * 0.18;
        vec3 color = vec3(1.0, 0.68, 0.18) * (0.88 + corona * 1.1 + rim * 0.8);
        float alpha = clamp(glow * 0.54 + rim * 0.22, 0.0, 0.82);
        gl_FragColor = vec4(color, alpha);
        if (gl_FragColor.a < 0.01) discard;
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Creates the Sun's animated surface by combining texture pixels and procedural noise. */
export function makeSunSurfaceMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture },
      uGlow: { value: 1.25 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vObjectNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;

      float vertexHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float vertexNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(vertexHash(i), vertexHash(i + vec2(1.0, 0.0)), u.x),
          mix(vertexHash(i + vec2(0.0, 1.0)), vertexHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vObjectNormal = normalize(normal);
        // Three planar samples avoid a flat UV-only bump and physically move the
        // sphere vertices into evolving convection-cell hills and sinking edges.
        vec3 n = normalize(normal);
        float flow = uTime * 0.035;
        float granules = (
          vertexNoise(n.xy * 28.0 + flow) +
          vertexNoise(n.yz * 29.0 - flow * 0.8) +
          vertexNoise(n.zx * 27.0 + vec2(-flow, flow * 0.6))
        ) / 3.0;
        float fineRelief = vertexNoise(n.xy * 63.0 - flow * 1.4) - 0.5;
        float displacement = (granules - 0.5) * 0.22 + fineRelief * 0.045;
        vec3 displacedPosition = position + normal * displacement;
        vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
        vViewPosition = mvPosition.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uMap;
      uniform float uGlow;
      varying vec3 vNormal;
      varying vec3 vObjectNormal;
      varying vec3 vViewPosition;
      varying vec2 vUv;

      // A deterministic pseudo-random value: same coordinate, same result.
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // Smoothly interpolate four random grid corners to create coherent noise.
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      // Fractal Brownian Motion stacks noise at several scales for richer detail.
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.0;
          amplitude *= 0.52;
          p += vec2(1.7, 9.2);
        }
        return value;
      }

      vec2 hash2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453123);
      }

      // Cellular/Worley-style distance creates granular, cell-like solar patterns.
      float cellular(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float minDist = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i + neighbor) + neighbor;
            minDist = min(minDist, length(f - point));
          }
        }
        return minDist;
      }

      void main() {
        // Moving UV/noise coordinates over time makes the surface flow continuously.
        vec2 uv = vUv * 2.2 + vec2(uTime * 0.08, -uTime * 0.05);
        vec3 baseColor = texture2D(uMap, uv * 0.78).rgb;
        vec2 noisePos = vNormal.xy * 2.4 + vec2(uTime * 0.12, -uTime * 0.07);

        float pattern = fbm(noisePos * 3.8);
        float molten = fbm(noisePos * 8.2 + vec2(uTime * 0.18, uTime * 0.14));
        float detail = fbm(noisePos * 16.4 + vec2(-uTime * 0.22, uTime * 0.19));
        float cells = cellular(vUv * 15.0 + vec2(uTime * 0.06, -uTime * 0.09));

        float granule = mix(pattern, molten, 0.52);
        float plasma = mix(granule, 1.0 - cells * 1.28, 0.38);
        float energy = clamp(plasma + detail * 0.17, 0.0, 1.0);

        // Compact active regions imitate the reference's white-hot magnetic areas.
        // Object-space directions keep these regions attached while the Sun rotates.
        float activeA = pow(max(dot(vObjectNormal, normalize(vec3(0.72, 0.1, 0.68))), 0.0), 112.0);
        float activeB = pow(max(dot(vObjectNormal, normalize(vec3(-0.5, -0.42, 0.76))), 0.0), 138.0);
        float activeC = pow(max(dot(vObjectNormal, normalize(vec3(0.18, 0.58, 0.79))), 0.0), 124.0);
        float activeD = pow(max(dot(vObjectNormal, normalize(vec3(-0.8, 0.28, 0.52))), 0.0), 148.0);
        float activeRegions = clamp((activeA + activeB + activeC + activeD)
          * (0.82 + detail * 0.55), 0.0, 1.0);

        // Sunspots are cooler magnetic openings. A dark umbra is surrounded by a
        // wider striped penumbra whose radial filaments drift very slowly.
        vec3 spotDirectionA = normalize(vec3(0.48, -0.28, 0.83));
        vec3 spotDirectionB = normalize(vec3(-0.72, 0.34, 0.6));
        float spotDotA = dot(vObjectNormal, spotDirectionA);
        float spotDotB = dot(vObjectNormal, spotDirectionB);
        float umbraA = smoothstep(0.988, 0.997, spotDotA);
        float umbraB = smoothstep(0.991, 0.998, spotDotB);
        float outerA = smoothstep(0.962, 0.989, spotDotA);
        float outerB = smoothstep(0.972, 0.992, spotDotB);
        float penumbra = max(outerA - umbraA, outerB - umbraB);
        float umbra = max(umbraA, umbraB);
        float penumbraAngle = atan(vObjectNormal.y, vObjectNormal.x);
        float striations = 0.45 + 0.55 * sin(penumbraAngle * 54.0 + detail * 9.0 + uTime * 0.025);

        // Convert the calculated energy level into a red → orange → white heat ramp.
        vec3 darkRed = vec3(0.15, 0.01, 0.0);
        vec3 fieryOrange = vec3(0.85, 0.25, 0.0);
        vec3 goldOrange = vec3(1.0, 0.55, 0.0);
        vec3 flareWhite = vec3(1.0, 0.95, 0.8);

        vec3 finalSurface = mix(darkRed, fieryOrange, smoothstep(0.0, 0.4, energy));
        finalSurface = mix(finalSurface, goldOrange, smoothstep(0.4, 0.75, energy));
        finalSurface = mix(finalSurface, flareWhite, smoothstep(0.75, 0.98, energy));
        // Hot cores reach near-white while a broader gold fringe suggests flare rays.
        finalSurface = mix(finalSurface, vec3(1.0, 0.72, 0.16), smoothstep(0.04, 0.38, activeRegions));
        finalSurface = mix(finalSurface, vec3(1.0, 0.98, 0.84), smoothstep(0.38, 0.9, activeRegions));
        finalSurface = mix(finalSurface, vec3(0.28, 0.045, 0.008), umbra * 0.92);
        finalSurface = mix(finalSurface, mix(vec3(0.38, 0.07, 0.01), vec3(0.88, 0.28, 0.025), striations), penumbra * 0.78);

        // Surface normals facing away from the camera receive a darker glowing rim.
        float edgeFactor = 1.0 - max(dot(normalize(vNormal), normalize(-vViewPosition)), 0.0);
        float rimGlow = pow(edgeFactor, 3.5);
        finalSurface = mix(finalSurface, vec3(0.4, 0.02, 0.0), rimGlow * 0.92);

        float heat = smoothstep(0.18, 0.72, detail * 0.82 + granule * 0.18);
        finalSurface += vec3(0.3, 0.11, 0.02) * rimGlow * uGlow * 0.42;
        finalSurface *= 0.82 + 0.24 * heat;

        vec3 surfaceColor = clamp(finalSurface + baseColor * 0.16, 0.0, 1.0);
        gl_FragColor = vec4(surfaceColor, 1.0);
      }
    `,
    transparent: false,
    depthWrite: true,
  });
}

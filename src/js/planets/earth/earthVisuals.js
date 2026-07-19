/**
 * Earth visible-light rendering layers.
 *
 * NASA's Blue Marble surface is rendered by the planet mesh. This module adds
 * a softly filtered cloud deck, a sunlit atmospheric limb, and city lights that
 * appear only on the nightside.
 */
import * as THREE from "three";

function createCloudMaterial(cloudMap, {
  opacity = 0.82,
  threshold = 0.18,
  softness = 0.32,
  uvOffset = new THREE.Vector2(),
} = {}) {
  const imageWidth = cloudMap?.image?.width ?? 1024;
  const imageHeight = cloudMap?.image?.height ?? 512;

  return new THREE.ShaderMaterial({
    uniforms: {
      uCloudMap: { value: cloudMap },
      uOpacity: { value: opacity },
      uThreshold: { value: threshold },
      uSoftness: { value: softness },
      uUvOffset: { value: uvOffset },
      uTexel: { value: new THREE.Vector2(1 / imageWidth, 1 / imageHeight) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudMap;
      uniform float uOpacity;
      uniform float uThreshold;
      uniform float uSoftness;
      uniform vec2 uUvOffset;
      uniform vec2 uTexel;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float cloudValue(vec2 uv) {
        vec2 wrappedUv = vec2(fract(uv.x), clamp(uv.y, 0.001, 0.999));
        vec4 sampleColor = texture2D(uCloudMap, wrappedUv);
        float luminance = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));

        // NASA's JPEG uses black as clear sky; the backup PNG stores clear sky
        // in alpha. Taking the smaller signal supports both without ever turning
        // transparent white pixels into an opaque global veil.
        return min(luminance, sampleColor.a);
      }

      void main() {
        vec2 uv = vUv + uUvOffset;

        // A nine-tap filter removes the blocky/pixelated edge seen in the old
        // 1K alpha shell while preserving the real NASA cloud structures.
        float centre = cloudValue(uv) * 0.28;
        float axial = (
          cloudValue(uv + vec2(uTexel.x, 0.0))
          + cloudValue(uv - vec2(uTexel.x, 0.0))
          + cloudValue(uv + vec2(0.0, uTexel.y))
          + cloudValue(uv - vec2(0.0, uTexel.y))
        ) * 0.12;
        float diagonal = (
          cloudValue(uv + uTexel)
          + cloudValue(uv - uTexel)
          + cloudValue(uv + vec2(uTexel.x, -uTexel.y))
          + cloudValue(uv + vec2(-uTexel.x, uTexel.y))
        ) * 0.06;
        float filteredCloud = centre + axial + diagonal;

        // Suppress low-level grey haze and preserve only coherent cloud fields.
        // A gentle power curve keeps wispy edges while avoiding posterised blobs.
        filteredCloud = pow(clamp(filteredCloud, 0.0, 1.0), 1.28);
        float cloudAlpha = smoothstep(
          uThreshold,
          uThreshold + uSoftness,
          filteredCloud
        );
        cloudAlpha *= smoothstep(0.055, 0.24, filteredCloud);

        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float daylight = smoothstep(-0.18, 0.38, dot(normal, lightDirection));
        float limb = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);

        vec3 shadowWhite = vec3(0.70, 0.73, 0.77);
        vec3 sunlitWhite = vec3(1.0, 0.995, 0.975);
        vec3 cloudColor = mix(shadowWhite, sunlitWhite, daylight);
        cloudColor += vec3(0.08, 0.16, 0.24) * limb * daylight * 0.15;

        // Clouds remain visible on the nightside, but sunlight—not a dark tint—
        // determines their photographic brightness.
        float alpha = cloudAlpha * uOpacity * mix(0.26, 0.82, daylight);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(cloudColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    roughness: 1,
    side: THREE.FrontSide,
  });
}

function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(-vWorldPosition);

        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 3.25);
        float daylight = smoothstep(-0.25, 0.34, dot(normal, lightDirection));
        float terminator = 1.0 - abs(dot(normal, lightDirection));
        float sunsetRim = pow(clamp(terminator, 0.0, 1.0), 9.0)
          * smoothstep(-0.28, 0.08, dot(normal, lightDirection));

        vec3 blue = vec3(0.16, 0.56, 1.0);
        vec3 paleBlue = vec3(0.48, 0.82, 1.0);
        vec3 sunset = vec3(1.0, 0.38, 0.12);
        vec3 color = mix(blue, paleBlue, daylight);
        color += sunset * sunsetRim * 0.18;

        float alpha = fresnel * mix(0.035, 0.34, daylight);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
}

function createNightLightsMaterial(lightMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLightMap: { value: lightMap },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uLightMap;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 lights = texture2D(uLightMap, vUv).rgb;
        float intensity = max(max(lights.r, lights.g), lights.b);
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDirection = normalize(-vWorldPosition);

        // City lights vanish under sunlight and emerge gradually across the
        // terminator, rather than glowing over the daytime continents.
        float nightside = 1.0 - smoothstep(-0.18, 0.12, dot(normal, lightDirection));
        float alpha = smoothstep(0.08, 0.68, intensity) * nightside * 0.78;
        if (alpha < 0.008) discard;

        vec3 warmLight = vec3(1.0, 0.67, 0.30) * (0.55 + intensity * 1.25);
        gl_FragColor = vec4(warmLight, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createEarthVisualSystem({
  earth,
  textures,
  radius,
  quality = "high",
}) {
  const segments = quality === "low" ? 80 : quality === "medium" ? 112 : 160;
  const clouds = new THREE.Group();
  clouds.name = "Earth NASA cloud system";

  if (textures.earthClouds) {
    const cloudGeometry = new THREE.SphereGeometry(radius * 1.020, segments, segments);
    const primaryClouds = new THREE.Mesh(
      cloudGeometry,
      createCloudMaterial(textures.earthClouds, {
        opacity: 0.62,
        threshold: 0.20,
        softness: 0.46,
      }),
    );
    primaryClouds.name = "Earth primary cloud deck";
    clouds.add(primaryClouds);

    const highClouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.026, segments, segments),
      createCloudMaterial(textures.earthClouds, {
        opacity: 0.10,
        threshold: 0.46,
        softness: 0.38,
        uvOffset: new THREE.Vector2(0.0022, -0.0011),
      }),
    );
    highClouds.name = "Earth high cirrus veil";
    highClouds.rotation.y = 0.012;
    clouds.add(highClouds);
  }
  earth.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.060, segments, segments),
    createAtmosphereMaterial(),
  );
  atmosphere.name = "Earth sunlit atmospheric limb";
  earth.add(atmosphere);

  let lights = null;
  if (textures.earthLights) {
    lights = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.011, segments, segments),
      createNightLightsMaterial(textures.earthLights),
    );
    lights.name = "Earth nightside city lights";
    earth.add(lights);
  }

  return {
    clouds,
    atmosphere,
    lights,
  };
}

export function updateEarthVisualSystem(system, frameScale = 1) {
  if (!system) return;
  system.clouds.rotation.y += 0.00155 * frameScale;
  system.clouds.children.forEach((layer, index) => {
    if (index === 1) layer.rotation.y += 0.00034 * frameScale;
  });
  system.atmosphere.rotation.y -= 0.00018 * frameScale;
}

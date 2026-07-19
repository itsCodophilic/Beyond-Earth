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


function createAuroraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying float vAuroraBand;
      varying float vSpikeField;

      void main() {
        vec3 localNormal = normalize(position);
        float absY = abs(localNormal.y);
        float longitude = atan(localNormal.z, localNormal.x);

        // A narrow auroral oval near the polar regions, with local vertical
        // protrusions so the sheet does not feel completely flat.
        float coreBand = exp(-pow((absY - 0.922) / 0.028, 2.0));
        float outerBand = exp(-pow((absY - 0.902) / 0.048, 2.0)) * 0.40;
        float auroraBand = clamp(coreBand + outerBand, 0.0, 1.0);

        float broadArc = sin(longitude * 3.4 + uTime * 0.18 + sin(longitude * 6.2) * 0.35) * 0.5 + 0.5;
        float spikeField = pow(
          sin(longitude * 18.0 + uTime * 0.42 + absY * 14.0) * 0.5 + 0.5,
          3.0
        );
        float displacement = length(position)
          * auroraBand
          * (0.003 + 0.013 * broadArc + 0.016 * spikeField);

        vec3 displacedPosition = position + localNormal * displacement;
        vLocalPosition = displacedPosition;
        vAuroraBand = auroraBand;
        vSpikeField = spikeField;

        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying vec3 vLocalPosition;
      varying float vAuroraBand;
      varying float vSpikeField;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x)
          + (c - a) * u.y * (1.0 - u.x)
          + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amplitude;
          p = p * 2.07 + vec2(31.1, 17.7);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 localNormal = normalize(vLocalPosition);
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        vec3 lightDirection = normalize(-vWorldPosition);

        float absY = abs(localNormal.y);
        float longitude = atan(localNormal.z, localNormal.x);

        float nightside = 1.0 - smoothstep(-0.16, 0.22, dot(normal, lightDirection));
        float limb = pow(1.0 - max(dot(normal, viewDirection), 0.0), 1.10);

        // Keep the visibility you approved while allowing a face-on focused
        // Earth to still reveal the oval.
        float darknessVisibility = mix(0.20, 1.0, nightside);
        float viewingVisibility = 0.36 + smoothstep(0.04, 0.74, limb) * 0.64;

        // Build structured auroral arcs rather than a broad polar wash.
        float arcNoise = fbm(vec2(longitude * 2.2 + uTime * 0.05, absY * 18.0));
        float mainArc = sin(longitude * 2.8 + arcNoise * 2.4 + uTime * 0.10) * 0.5 + 0.5;
        float secondaryArc = sin(longitude * 5.8 - arcNoise * 3.2 - uTime * 0.08) * 0.5 + 0.5;
        float arcMask = smoothstep(0.18, 0.82, mainArc) * 0.72 + smoothstep(0.42, 0.90, secondaryArc) * 0.28;

        float broadBands = fbm(vec2(longitude * 8.0 + uTime * 0.22, absY * 28.0 - uTime * 0.12));
        float fineBands = fbm(vec2(longitude * 22.0 - uTime * 0.70, absY * 58.0 + uTime * 0.20));
        float ribs = pow(smoothstep(0.36, 0.92, 0.58 * broadBands + 0.42 * fineBands), 1.65);

        float spikeColumns = pow(
          smoothstep(
            0.68,
            0.992,
            sin(longitude * 20.0 + fineBands * 8.0 + uTime * 0.35) * 0.5 + 0.5
          ),
          2.5
        );

        float curtain = arcMask * (0.30 + ribs * 0.70) * (0.62 + spikeColumns * 0.50);
        float diffuseCurtain = 0.26 + curtain * 0.74;
        float breathing = 0.92 + sin(uTime * 0.82 + longitude * 2.0) * 0.08;

        float alpha = vAuroraBand
          * diffuseCurtain
          * darknessVisibility
          * viewingVisibility
          * breathing
          * 1.06;

        vec3 green = vec3(0.12, 1.0, 0.42);
        vec3 cyan = vec3(0.16, 0.92, 1.0);
        vec3 red = vec3(1.0, 0.18, 0.08);
        vec3 color = mix(green, cyan, smoothstep(0.42, 0.86, fineBands));

        float redFringe = smoothstep(0.91, 0.985, absY) * smoothstep(0.18, 0.82, spikeColumns);
        color = mix(color, red, redFringe * 0.30);

        // Strong base visibility stays, but the brighter columns and arcs now
        // shape the aurora into recognisable ribbons and spiky curtains.
        color *= 0.76 + limb * 1.16;
        color *= 0.92 + spikeColumns * 0.38 + vSpikeField * 0.24;

        if (alpha < 0.008) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
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
        opacity: 0.68,
        threshold: 0.19,
        softness: 0.46,
      }),
    );
    primaryClouds.name = "Earth primary cloud deck";
    clouds.add(primaryClouds);

    const highClouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.026, segments, segments),
      createCloudMaterial(textures.earthClouds, {
        opacity: 0.14,
        threshold: 0.44,
        softness: 0.40,
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

  const aurora = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.032, segments, segments),
    createAuroraMaterial(),
  );
  aurora.name = "Earth polar aurora";
  aurora.renderOrder = 6;
  earth.add(aurora);

  return {
    clouds,
    atmosphere,
    lights,
    aurora,
  };
}

export function updateEarthVisualSystem(system, frameScale = 1) {
  if (!system) return;
  system.clouds.rotation.y += 0.00155 * frameScale;
  system.clouds.children.forEach((layer, index) => {
    if (index === 1) layer.rotation.y += 0.00034 * frameScale;
  });
  system.atmosphere.rotation.y -= 0.00018 * frameScale;

  if (system.aurora?.material?.uniforms?.uTime) {
    system.aurora.material.uniforms.uTime.value += 0.018 * frameScale;
    system.aurora.rotation.y += 0.00042 * frameScale;
  }
}

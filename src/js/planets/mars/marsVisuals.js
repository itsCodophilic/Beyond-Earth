import * as THREE from "three";
import { createPlanetAuroraLayer, updatePlanetAuroraLayer } from "../../graphics/planetAurora.js";

function createMarsAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
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
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 3.6);
        float daylight = smoothstep(-0.28, 0.30, dot(normal, lightDirection));
        float terminator = 1.0 - abs(dot(normal, lightDirection));
        float blueTwilight = pow(clamp(terminator, 0.0, 1.0), 9.0) * smoothstep(-0.20, 0.08, dot(normal, lightDirection));
        vec3 dustyDay = vec3(0.96, 0.62, 0.40);
        vec3 paleDust = vec3(0.80, 0.47, 0.29);
        vec3 blue = vec3(0.22, 0.56, 1.0);
        vec3 color = mix(paleDust, dustyDay, daylight);
        color = mix(color, blue, blueTwilight * 0.34);
        float alpha = fresnel * mix(0.018, 0.13, daylight);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
}

export function createMarsVisualSystem({ mars, radius, quality = "high" }) {
  const segments = quality === "low" ? 72 : quality === "medium" ? 104 : 144;
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.018, segments, segments),
    createMarsAtmosphereMaterial(),
  );
  atmosphere.name = "Mars thin atmosphere";
  mars.add(atmosphere);

  // For the current visual direction, keep the aurora constrained to the
  // polar regions instead of spreading across the entire nightside hemisphere.
  const aurora = createPlanetAuroraLayer({
    planet: mars,
    radius,
    quality,
    shellScale: 1.024,
    latitudeCenter: 0.82,
    latitudeWidth: 0.15,
    mirroredStrength: 0.96,
    longitudeCenter: 0.0,
    longitudeWidth: 3.1416,
    secondaryLongitudeCenter: 0.0,
    secondaryLongitudeWidth: 3.1416,
    secondaryLongitudeStrength: 0.0,
    globalDiffuseStrength: 0.0,
    intensity: 0.94,
    faceOnVisibility: 0.34,
    daysideVisibility: 0.012,
    arcFrequency: 5.4,
    spikeFrequency: 24.0,
    displacementStrength: 0.010,
    shellAlpha: 0.90,
    animationSpeed: 0.58,
    redFringeStrength: 0.06,
    primaryColor: 0x6f86ff,
    secondaryColor: 0xf2f6ff,
    tertiaryColor: 0xa06cff,
  });
  aurora.name = "Mars polar ultraviolet aurora";
  aurora.rotation.z = 0.0;
  aurora.rotation.x = 0.0;

  return { atmosphere, aurora };
}

export function updateMarsVisualSystem(system, frameScale = 1) {
  if (!system) return;
  system.atmosphere.rotation.y -= 0.00012 * frameScale;
  updatePlanetAuroraLayer(system.aurora, frameScale, { rotationSpeed: 0.00012 });
}

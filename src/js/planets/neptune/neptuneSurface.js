/**
 * Neptune surface rendering.
 *
 * This version deliberately uses an image-based surface instead of generating
 * artificial storms in GLSL. The supplied Neptune artwork is already a proper
 * 2:1 equirectangular map, and its north/south polar regions have been rebuilt
 * from the supplied pole-on reference before being stored in the final texture.
 *
 * Runtime texture:
 *   src/assets/textures/neptune/neptune-enhanced-polar-equirectangular.png
 *
 * Source/reference images are also kept alongside it for future refinement:
 *   neptune-enhanced-equirectangular.png
 *   neptune-pole-reference.png
 */
import * as THREE from "three";

const NEPTUNE_OBLATENESS = 0.983;

const NEPTUNE_TEXTURE_URL = new URL(
  "../../../assets/textures/neptune/neptune-enhanced-polar-equirectangular.png",
  import.meta.url,
).href;

let cachedNeptuneTexture = null;

function getNeptuneTexture() {
  if (cachedNeptuneTexture) return cachedNeptuneTexture;

  const texture = new THREE.TextureLoader().load(NEPTUNE_TEXTURE_URL);
  texture.name = "Neptune enhanced polar texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;

  // Keep the visual orientation used by the generated reference texture.
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.needsUpdate = true;

  cachedNeptuneTexture = texture;
  return cachedNeptuneTexture;
}

/**
 * Main visible Neptune surface.
 *
 * There are intentionally no procedural dark spots or fake cloud layers here.
 * All weather detail, including the polar vortex structure, comes from the
 * prepared seamless texture so it remains coherent while the camera orbits.
 */
export function createNeptuneSurfaceMaterial() {
  const material = new THREE.MeshStandardMaterial({
    map: getNeptuneTexture(),
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    emissive: new THREE.Color(0x06162f),
    emissiveIntensity: 0.045,
    envMapIntensity: 0.02,
  });

  material.name = "Neptune enhanced image surface";
  material.userData.baseEmissiveIntensity = 0.045;
  return material;
}

/**
 * A very thin optical rim around Neptune.
 *
 * The previous implementation used separate procedural cloud shells. Those
 * layers have been removed because the texture already contains the atmospheric
 * detail. This shader adds only a subtle blue edge at the limb.
 */
function createNeptuneRimMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x42bfff) },
      uOpacity: { value: 0.14 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalView;
      varying vec3 vViewPosition;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;

      varying vec3 vNormalView;
      varying vec3 vViewPosition;

      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float facing = max(dot(normalize(vNormalView), viewDirection), 0.0);
        float rim = pow(1.0 - facing, 3.5);
        float alpha = rim * uOpacity;

        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

/**
 * Preserve the API expected by planetFactory.js while keeping Neptune's
 * atmosphere visually clean. Only a single subtle rim shell is created.
 */
export function createNeptuneAtmosphereLayers({
  planet,
  radius,
  segmentScale = 1,
}) {
  const group = new THREE.Group();
  group.name = "Neptune atmosphere";

  const widthSegments = Math.max(96, Math.round(160 * segmentScale));
  const heightSegments = Math.max(72, Math.round(112 * segmentScale));

  const geometry = new THREE.SphereGeometry(
    radius * 1.012,
    widthSegments,
    heightSegments,
  );
  geometry.scale(1, NEPTUNE_OBLATENESS, 1);

  const rim = new THREE.Mesh(geometry, createNeptuneRimMaterial());
  rim.name = "Neptune subtle atmospheric rim";
  rim.renderOrder = 5;
  group.add(rim);

  planet.add(group);
  return group;
}

/**
 * Adjust close-inspection fill and the limb atmosphere only.
 * The actual surface map remains fixed to the rotating planet, preventing the
 * weather from sliding independently over the texture.
 */
export function updateNeptuneAtmosphereLayers(
  planet,
  cloudGroup,
  time,
  motionScale,
  camera,
) {
  if (!camera) return;

  const worldPosition = new THREE.Vector3();
  planet.getWorldPosition(worldPosition);

  const radius = planet.userData.visualRadius || 1;
  const normalizedDistance =
    camera.position.distanceTo(worldPosition) / Math.max(radius, 0.0001);

  const inspection =
    1 -
    THREE.MathUtils.smoothstep(
      normalizedDistance,
      5.0,
      17.0,
    );

  if (planet.material?.isMeshStandardMaterial) {
    const base = planet.material.userData.baseEmissiveIntensity ?? 0.045;
    planet.material.emissiveIntensity = base + inspection * 0.035;
  }

  const rimMaterial = cloudGroup?.children?.[0]?.material;
  if (rimMaterial?.uniforms?.uOpacity) {
    rimMaterial.uniforms.uOpacity.value = 0.12 + inspection * 0.045;
  }
}

/** Apply Neptune's small equatorial bulge. */
export function applyNeptuneOblateness(geometry) {
  geometry.scale(1, NEPTUNE_OBLATENESS, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

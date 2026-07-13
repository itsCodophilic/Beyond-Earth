import * as THREE from "three";
import { zodiacalFragmentShader, zodiacalVertexShader } from "../../shaders/space/dustShaders.js";

/** Broad, extremely restrained sunlight scattering along the ecliptic plane. */
export function createZodiacalLight({ radius }) {
  const geometry = new THREE.SphereGeometry(radius, 64, 40);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uVisibility: { value: 0 },
      uSunDirection: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: zodiacalVertexShader,
    fragmentShader: zodiacalFragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Subtle zodiacal light";
  mesh.frustumCulled = false;
  mesh.renderOrder = -25;

  return {
    object: mesh,
    update({ visibility, sunDirection }) {
      material.uniforms.uVisibility.value = visibility;
      material.uniforms.uSunDirection.value.copy(sunDirection);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}


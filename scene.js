import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export function initScene(canvas) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x01040a, 0.0018);

  const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const world = new THREE.Group();
  const orbitRoot = new THREE.Group();
  scene.add(world, orbitRoot);

  const ambientLight = new THREE.AmbientLight(0x8da1c6, 0.34);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffe6aa, 5200, 1450, 1.5);
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x8bdcff, 0.75);
  fillLight.position.set(-50, 40, 90);
  scene.add(fillLight);

  return {
    scene,
    camera,
    renderer,
    clock,
    raycaster,
    world,
    orbitRoot,
  };
}

export function resizeScene(camera, renderer) {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

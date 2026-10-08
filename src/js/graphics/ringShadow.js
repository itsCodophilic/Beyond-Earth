import * as THREE from "three";

/**
 * The shadow a body casts on its own rings (fourth final round, the owner:
 * "all celestial objects who have rings ... those rings must also experience
 * a slight shadow of it right?").
 *
 * Yes. Sunlight comes from one side, so behind every ringed body there is a
 * cylinder of shadow, and wherever a ring passes through it the ring goes
 * dark. On Saturn it is the black wedge across the rings in every Cassini
 * image; Jupiter's, Uranus's and Neptune's rings cross their planets' shadows
 * the same way, and so do the small rings of Haumea, Quaoar, Chariklo and
 * Chiron. Until now no ring here knew where its planet was.
 *
 * One patch for every ring material, whatever it is -- the hand-written
 * particle shaders and three's own PointsMaterial alike:
 *
 *   - the shader's own `main` is renamed and called from a new one, so
 *     nothing in it changes and an early `return` still works;
 *   - after it runs, the vertex shader turns `gl_Position` back into a
 *     view-space point with the inverse projection, so it does not matter how
 *     that shader moved its particles (Saturn's orbit on the GPU), and asks
 *     whether the line from that point to the Sun passes through the body;
 *   - the fragment shader multiplies its colour by the answer.
 *
 * The test is per vertex -- per particle for the point clouds -- so it costs a
 * handful of operations each and nothing per pixel. The Sun is at the origin
 * of the scene; the body and the Sun are moved into view space once per frame
 * per ring object, in `onBeforeRender`.
 *
 * `floor` is how much light is left in the shadow: 32 % by default, more for
 * the faint dust rings (planetFactory.js), so the shadowed arc always reads
 * as the same ring, dimmer, never as a gap. The first version kept 10 % and
 * the rings went black there; the owner wanted the shadowed arc "very very
 * dimmer" but still visible in the ring's own colour -- and it is, in
 * Cassini's images, lit faintly by sunlight scattered through the rings and
 * by light reflected off the planet. The edge is softened over 3 % of the
 * radius, about the width of the real penumbra for Saturn.
 */

const VERTEX_PATCH = /* glsl */ `
uniform mat4 uRsInvProjection;
uniform vec3 uRsCentre;
uniform vec3 uRsSun;
uniform float uRsRadius;
uniform float uRsFloor;
uniform float uRsUv;
uniform int uRsBandCount;
uniform float uRsBandEdge;
uniform float uRsBandIn[16];
uniform float uRsBandOut[16];
uniform vec3 uRsBandCol[16];
uniform float uRsBandGain[16];
varying float vRingShadow;
varying vec3 vRingUvColour;
varying float vRingUvIn;
varying float vRingUvGain;
void main() {
  ringShadowOriginalMain();
  vec4 rsView = uRsInvProjection * gl_Position;
  vec3 rsPoint = rsView.xyz / rsView.w;
  vec3 rsToSun = normalize(uRsSun - rsPoint);
  vec3 rsToCentre = uRsCentre - rsPoint;
  float rsAlong = dot(rsToCentre, rsToSun);
  float rsMiss = length(rsToCentre - rsToSun * rsAlong);
  float rsLit = smoothstep(uRsRadius * 0.97, uRsRadius * 1.03, rsMiss);
  vRingShadow = rsAlong > 0.0 ? mix(uRsFloor, 1.0, rsLit) : 1.0;
  vRingUvColour = vec3(0.0);
  vRingUvIn = 0.0;
  vRingUvGain = 1.0;
  if (uRsUv > 0.5) {
    // Distance from the body's centre in its own radii: the ring band.
    float rsR = length(rsToCentre) / max(uRsRadius, 1e-6);
    float rsWeight = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uRsBandCount) break;
      float inside = smoothstep(uRsBandIn[i] - uRsBandEdge, uRsBandIn[i] + uRsBandEdge, rsR)
        * (1.0 - smoothstep(uRsBandOut[i] - uRsBandEdge, uRsBandOut[i] + uRsBandEdge, rsR));
      vRingUvColour += uRsBandCol[i] * inside;
      vRingUvGain += (uRsBandGain[i] - 1.0) * inside;
      rsWeight += inside;
    }
    vRingUvIn = clamp(rsWeight, 0.0, 1.0);
    vRingUvColour /= max(rsWeight, 1e-4);
  }
}
`;

const FRAGMENT_PATCH = /* glsl */ `
uniform float uRsUv;
varying float vRingShadow;
varying vec3 vRingUvColour;
varying float vRingUvIn;
varying float vRingUvGain;
void main() {
  ringShadowOriginalMain();
  if (uRsUv > 0.5) {
    // The ultraviolet view: each particle keeps its own brightness and
    // takes its band's false colour, so the ring stays made of pieces.
    vec3 rsLuma = vec3(0.2126, 0.7152, 0.0722);
    float rsLum = dot(gl_FragColor.rgb, rsLuma);
    float rsHueLum = max(dot(vRingUvColour, rsLuma), 0.02);
    vec3 rsBand = vRingUvColour * (rsLum / rsHueLum) * clamp(vRingUvGain, 0.0, 2.0);
    gl_FragColor.rgb = mix(vec3(rsLum) * 0.5, rsBand, vRingUvIn);
  }
  gl_FragColor.rgb *= vRingShadow;
}
`;

const MAIN = /void\s+main\s*\(\s*\)/;
const patched = new WeakSet();
const _centre = new THREE.Vector3();
const _scale = new THREE.Vector3();

function patchMaterial(material, uniforms) {
  if (patched.has(material)) return;
  patched.add(material);
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    if (!MAIN.test(shader.vertexShader) || !MAIN.test(shader.fragmentShader)) return;
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `${shader.vertexShader.replace(MAIN, "void ringShadowOriginalMain()")}\n${VERTEX_PATCH}`;
    shader.fragmentShader = `${shader.fragmentShader.replace(MAIN, "void ringShadowOriginalMain()")}\n${FRAGMENT_PATCH}`;
  };
  const previousKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|ring-shadow`;
  material.needsUpdate = true;
}

/**
 * Makes every drawn part of `root` (a ring system) dark where `body`'s shadow
 * falls. `radius` is the body's radius in its own local units.
 */
export function applyRingShadow(root, { body, radius, floor = 0.32 } = {}) {
  if (!root || !body || !(radius > 0)) return;
  const uniforms = {
    uRsInvProjection: { value: new THREE.Matrix4() },
    uRsCentre: { value: new THREE.Vector3() },
    uRsSun: { value: new THREE.Vector3() },
    uRsRadius: { value: radius },
    uRsFloor: { value: floor },
    uRsUv: { value: 0 },
    uRsBandCount: { value: 0 },
    uRsBandEdge: { value: 0.005 },
    uRsBandIn: { value: new Array(16).fill(0) },
    uRsBandOut: { value: new Array(16).fill(0) },
    uRsBandCol: { value: Array.from({ length: 16 }, () => new THREE.Vector3()) },
    uRsBandGain: { value: new Array(16).fill(1) },
  };
  const update = (camera) => {
    body.getWorldPosition(_centre);
    body.getWorldScale(_scale);
    uniforms.uRsRadius.value = radius * _scale.x;
    uniforms.uRsCentre.value.copy(_centre).applyMatrix4(camera.matrixWorldInverse);
    uniforms.uRsSun.value.set(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
    uniforms.uRsInvProjection.value.copy(camera.projectionMatrixInverse);
  };
  root.traverse((object) => {
    if (!object.isPoints && !object.isMesh) return;
    const material = object.material;
    if (!material || Array.isArray(material)) return;
    // Pointer targets are never drawn; leave them alone.
    if (material.colorWrite === false || /interaction field|hit area|pointer/i.test(object.name ?? "")) return;
    patchMaterial(material, uniforms);
    object.userData.ringShadow = uniforms;
    const previous = object.onBeforeRender;
    object.onBeforeRender = function onBeforeRender(renderer, scene, camera, ...rest) {
      update(camera);
      previous?.call(this, renderer, scene, camera, ...rest);
    };
  });
}

/**
 * The ultraviolet view's ring colours (sixth final round, the owner: "in UV
 * mode it becomes continuous, which breaks our reality ... flip the colours
 * of those small and large particles"). The particles stay; each takes the
 * false colour of the band it is in, keeping its own brightness. `look` is
 * { edge, bands: [[innerRadii, outerRadii, Vector3 colour, gain], ...] } in
 * the body's radii, or null to go back to visible light.
 */
export function setRingUltraviolet(root, look = null) {
  const seen = new Set();
  root?.traverse?.((object) => {
    const uniforms = object.userData?.ringShadow;
    if (!uniforms || seen.has(uniforms)) return;
    seen.add(uniforms);
    if (!look) {
      uniforms.uRsUv.value = 0;
      return;
    }
    const bands = look.bands.slice(0, 16);
    uniforms.uRsBandCount.value = bands.length;
    uniforms.uRsBandEdge.value = look.edge;
    bands.forEach(([inner, outer, colour, gain], index) => {
      uniforms.uRsBandIn.value[index] = inner;
      uniforms.uRsBandOut.value[index] = outer;
      uniforms.uRsBandCol.value[index].copy(colour);
      uniforms.uRsBandGain.value[index] = gain;
    });
    uniforms.uRsUv.value = 1;
  });
  return seen.size > 0;
}

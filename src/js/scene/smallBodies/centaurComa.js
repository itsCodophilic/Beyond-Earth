import * as THREE from "three";

/**
 * The dust around an active Centaur, lit by the Sun.
 *
 * Two of the four are comets as well as asteroids: Chiron is 95P and
 * Echeclus is 174P. What makes either look like anything other than a rock
 * is a cloud of dust and ice grains it has lifted off itself -- and that
 * cloud does not glow. It is *lit*. Every photon anyone has ever recorded
 * from a Centaur coma is sunlight scattered off a grain, so the brightness
 * has a direction, and the direction is the Sun.
 *
 * ## Why this is the third version
 *
 * The first was one round sprite, which read as a lamp. The second added a
 * dust fan, surface vents and jets, all as camera-facing sprites -- and the
 * verdict on that was exact: the brightness changed far too much with
 * viewpoint and seemed to float in the air, when it should come from the
 * Sun's side. Both are consequences of drawing with sprites. A sprite is a
 * picture pasted towards the camera, so it knows where the viewer is and
 * nothing about where the Sun is: the fan swung round as the camera did,
 * the jets foreshortened and popped, and nothing anchored the light to the
 * one thing that actually produces it.
 *
 * So everything except the vents is now **geometry in the world**, shaded by
 * one small shader whose inputs are the Sun's direction and the body's
 * position:
 *
 *   - **The coma** is an envelope around the nucleus, biased towards the
 *     Sun because that is the side the ice sublimates from.
 *   - **The dust fan** is a second, fainter envelope stretched away from
 *     the Sun, which is where radiation pressure pushes the grains. It is
 *     re-aimed as the body goes round its orbit, which takes decades, so to
 *     a viewer it is fixed.
 *   - **Echeclus's jets** are cones fixed to the surface, turning with it.
 *   - **Echeclus's 2005 fragment** is a small envelope of its own beside the
 *     nucleus.
 *
 * And in the shader, four physical terms and nothing else:
 *
 *   1  *Density falls with distance from the nucleus*, measured as the
 *      closest approach of the viewing ray -- which is what column density
 *      through a centrally-condensed cloud depends on.
 *   2  *The sunward side is brighter*, because more dust is there and all
 *      of it faces the light.
 *   3  *The nucleus casts a shadow* down-sun. Dust directly behind the rock
 *      is in the dark.
 *   4  *The rock itself stays dark.* The cloud's light is suppressed across
 *      the nucleus's own disc, so a seven-per-cent-albedo surface reads as
 *      asphalt inside a glow rather than as a lamp.
 *
 * There is one view-dependent term, forward scattering -- fine dust really
 * is brighter when you look through it towards the Sun -- and it is kept
 * deliberately small, because a large one is exactly the "changes too much
 * with perspective" that was reported.
 *
 * ## The designs (round 3)
 *
 * Reported: on Hartley 2 the light looked wrong -- "a hollow gap on the
 * whole body and light surrounds it". Term 4 is why. It clears the cloud
 * over a *disc* the size of the body's longest half-axis, and Hartley 2 is a
 * bowling pin 2.3 km long and half that wide: across its narrow middle the
 * cleared disc is far wider than the rock, so a dark moat of empty sky
 * opened round it. The same is true, less strongly, of every elongated
 * nucleus. It is also not needed for what it was for: the envelope is drawn
 * back faces only, which always lie behind the nucleus, so the depth test
 * already hides the cloud exactly where the rock is -- to its real outline.
 *
 * So the shader takes a design, picked in coma-lab.html by the owner:
 *
 *   A  as it was: the cleared disc (kept to compare against).
 *   B  true silhouette: no cleared disc; the rock hides the cloud behind it
 *      by depth, to its own shape.
 *   C  B, with a centrally condensed cloud: column density falling as one
 *      over the distance from the nucleus, which is what every comet
 *      photograph shows (a near-1/rho coma is the textbook steady-outflow
 *      result) instead of the old flat-topped profile.
 *   D  C, with the near half of the cloud drawn in front of the rock as a
 *      thin veil -- the nucleus seen *through* its coma, as it really is,
 *      and as 2I and 3I always were (no telescope ever saw their surfaces).
 *
 *   E  D, plus what a comet's light is made of (round 4, the owner's
 *      brief). Two processes, not one. Dust *reflects* sunlight (Mie
 *      scattering): the coma and the dust tail are whitish-yellow, and much
 *      brighter looking towards the Sun through them (forward scattering).
 *      Gas *fluoresces* under the Sun's ultraviolet: C2 and CN glow green in
 *      the head, and C2 breaks up within a short distance, so the green
 *      stays close to the nucleus; CO+ ions glow blue and are carried
 *      straight out by the solar wind -- a narrow, straight, slightly
 *      rippling ion tail pointing exactly away from the Sun. The dust tail is
 *      broad and curved, bent back along the orbit because the grains are
 *      pushed out more slowly than the comet moves on. Every comet gets
 *      all three; a non-comet that is active says what it has in
 *      `record.emission` (round 5): Chiron and Echeclus, Centaurs whose gas
 *      is measured (CN and CO on Chiron, CO on Echeclus), and Phaethon,
 *      whose only gas is sodium -- a yellow-orange tail with no green head
 *      and almost no dust.
 *
 * `COMA_DESIGN` is the scene's choice; the lab overrides it per material.
 *
 * ## Cost
 *
 * Two to five meshes per active body, one shared shader program, no
 * textures. Per frame: re-aim one group and write three uniforms, for two
 * bodies.
 */

const DUST_VERTEX = /* glsl */`
  varying vec3 vPositionWorld;
  varying vec3 vNormalWorld;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const DUST_FRAGMENT = /* glsl */`
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform vec3 uSunDirection;
  uniform vec3 uBodyPosition;
  uniform float uBodyRadius;
  uniform float uReach;
  uniform float uAlongFade;
  uniform float uForward;
  uniform float uClearDisc;
  uniform float uCondensed;
  uniform float uVeil;
  varying vec3 vPositionWorld;
  varying vec3 vNormalWorld;
  varying vec2 vUv;
  void main() {
    vec3 ray = normalize(vPositionWorld - cameraPosition);
    vec3 toBody = uBodyPosition - cameraPosition;
    float along = dot(toBody, ray);
    vec3 closest = cameraPosition + ray * along;
    vec3 offset = closest - uBodyPosition;
    float miss = length(offset);

    // 1. Column density through a centrally condensed cloud. Design C/D:
    // one over the distance (floored at 1.2 body radii so it stays finite
    // at the limb), rolled off to zero at the envelope's edge, and scaled
    // by 1.2 so the cloud's total light is close to the old profile's
    // (judged in the lab).
    float flatProfile = pow(1.0 - clamp(miss / uReach, 0.0, 1.0), 1.7);
    float knee = uBodyRadius * 1.2;
    float condensed = 1.2 * (knee / max(miss, knee)) * (1.0 - smoothstep(0.35, 1.0, miss / uReach));
    float density = mix(flatProfile, condensed, uCondensed);

    // A soft envelope edge, so the mesh never shows as an outline.
    float facing = abs(dot(normalize(vNormalWorld), -ray));
    // Jets (uAlongFade 1) are brightest down their own axis and fall away
    // steeply to the sides, which is what makes a narrow linear jet rather
    // than a searchlight cone. The power 2.5 is judged on screen.
    float edge = uAlongFade > 0.5
      ? pow(facing, 2.5)
      : smoothstep(0.0, 0.45, facing);

    // 2. Brighter on the side the Sun is on.
    float sunSide = miss > 1e-5 ? dot(offset / miss, uSunDirection) : 0.0;
    float lit = mix(0.32, 1.0, smoothstep(-0.6, 0.8, sunSide));

    // 3. The nucleus's shadow, straight down-sun.
    // Measured on the viewing ray, like everything else, so which face of
    // the envelope happens to be drawn never changes the answer.
    float downSun = dot(offset, -uSunDirection);
    float offAxis = length(offset + uSunDirection * downSun);
    // Eased in over the first body radius behind the rock, not switched on
    // at the plane through its centre: the hard switch drew a straight
    // seam through the cloud on screen, through the nucleus and well above
    // and below it (found in coma-lab.html, round 3; present in every
    // design, including the old one).
    float shadow = mix(1.0,
      mix(0.5, 1.0, smoothstep(uBodyRadius * 0.7, uBodyRadius * 1.8, offAxis)),
      smoothstep(0.0, uBodyRadius, downSun));

    // 4. Keep the rock dark: no cloud light across the nucleus's own disc.
    // The ramp ends just past the limb (1.08 radii): a wider one, tried at
    // 1.55, left a dark moat around the rock where the cloud is densest.
    float clearOfDisc = mix(1.0, smoothstep(uBodyRadius * 0.9, uBodyRadius * 1.08, miss), uClearDisc);

    // Design D: front faces are the near half of the cloud, drawn over the
    // rock as a veil at uVeil of a back face; the total is renormalised so
    // the sky round the body is no brighter than with back faces alone.
    // Only with a veil: a BackSide material is drawn with the winding
    // flipped, so its back faces report gl_FrontFacing true -- reading it
    // unconditionally blanked every non-veil cloud (caught in the lab).
    float face = uVeil > 0.0 ? (gl_FrontFacing ? uVeil : 1.0) : 1.0;
    float veilNorm = 1.0 / (1.0 + uVeil);

    // Mild forward scattering, and nothing more view-dependent than this.
    float phase = 1.0 + uForward * pow(max(0.0, dot(ray, uSunDirection)), 3.0);

    // Jets fade along their length; envelopes do not use this.
    float lengthFade = mix(1.0, pow(max(0.0, 1.0 - vUv.y), 1.6), uAlongFade);

    float alpha = uOpacity * density * edge * lit * shadow * clearOfDisc * phase * lengthFade * face * veilNorm;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/* The scene's design -- see "The designs" above. "A" until the owner picks
 * in coma-lab.html. */
export const COMA_DESIGNS = Object.freeze({
  A: { clearDisc: 1, condensed: 0, veil: 0, title: "As it was", why: "The cloud is cleared over a disc as wide as the body's longest half-axis. Round a long, thin nucleus that leaves a dark moat of empty sky -- the reported hollow gap." },
  B: { clearDisc: 0, condensed: 0, veil: 0, title: "True silhouette", why: "No cleared disc: the rock hides the cloud behind it to its own outline, by depth. Same soft, flat-topped cloud as before." },
  C: { clearDisc: 0, condensed: 1, veil: 0, title: "Condensed coma", why: "True silhouette, and a cloud that is brightest right at the nucleus and fades as one over the distance -- how every comet photograph looks." },
  D: { clearDisc: 0, condensed: 1, veil: 0.35, title: "Seen through the coma", why: "Condensed, and the near half of the cloud drawn over the rock as a thin veil: the nucleus seen through its own haze, as it really is." },
  E: { clearDisc: 0, condensed: 1, veil: 0.35, emission: true, forward: 1.6, title: "Gas, ions and dust", why: "D, plus a comet's two kinds of light: a green fluorescent gas head (C2, CN), a straight blue ion tail (CO+) pointing away from the Sun, and a broad curved whitish dust tail that brightens looking towards the Sun." },
});
/* Round 5: the owner moved to E ("E design looks good") and asked for it
 * on Chiron, Echeclus and Phaethon as well. */
export let COMA_DESIGN = "E";

/* For the lab: switch every material built from now on, and any passed in. */
export function applyComaDesign(key, materials = []) {
  const design = COMA_DESIGNS[key];
  if (!design) return;
  COMA_DESIGN = key;
  materials.forEach((material) => {
    const u = material.uniforms;
    if (!u?.uClearDisc) return;
    u.uClearDisc.value = design.clearDisc;
    u.uCondensed.value = material.userData.isJet ? 0 : design.condensed;
    u.uVeil.value = material.userData.isJet ? 0 : design.veil;
    material.side = material.userData.isJet ? THREE.DoubleSide : design.veil > 0 ? THREE.DoubleSide : THREE.BackSide;
    material.needsUpdate = true;
  });
}

const _world = new THREE.Vector3();
const _antiSun = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _quaternion = new THREE.Quaternion();
const _basis = new THREE.Matrix4();

function dustMaterial({ colour, opacity, reach, bodyRadius, alongFade = 0, forward = 0.25 }) {
  const design = COMA_DESIGNS[COMA_DESIGN];
  const isJet = alongFade > 0.5;
  const material = new THREE.ShaderMaterial({
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    uniforms: {
      uColour: { value: new THREE.Color(colour) },
      uOpacity: { value: opacity },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uBodyPosition: { value: new THREE.Vector3() },
      uBodyRadius: { value: bodyRadius },
      uReach: { value: reach },
      uAlongFade: { value: alongFade },
      /* E: forward scattering raised -- fine dust is far brighter seen
       * towards the Sun through it. Capped at 1 + 1.6 = 2.6x straight into
       * the light; the real effect can reach tens of times, which would
       * white out the frame. */
      uForward: { value: design.forward && !isJet ? Math.max(forward, design.forward) : forward },
      uClearDisc: { value: design.clearDisc },
      /* A jet is a narrow cone, not a cloud round the nucleus: it keeps the
       * old profile and gets no veil in any design. */
      uCondensed: { value: isJet ? 0 : design.condensed },
      uVeil: { value: isJet ? 0 : design.veil },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    /* Back faces: one layer from outside and still one layer from inside, so
     * zooming down through the cloud to the surface never makes it vanish.
     * Every term is computed from the viewing ray, not from the face drawn. */
    side: design.veil > 0 && !isJet ? THREE.DoubleSide : THREE.BackSide,
    toneMapped: true,
  });
  material.userData.isJet = isJet;
  return material;
}

/*
 * Design E's emission layers: light the gas makes itself, not light it
 * reflects, so none of the dust shader's lit-side, shadow or phase terms --
 * except the dust tail, which is dust and takes the phase term.
 *
 *   uMode 0  gas head: density falling over a short scale length round the
 *            nucleus (C2's short life keeps the green close).
 *   uMode 1  ion tail: a thin tube along +z; bright near the head, fading
 *            along its length, with slow streamers rippling down it.
 *   uMode 2  dust tail: a broad curved fan; fades along its length and
 *            brightens with forward scattering.
 */
const EMISSION_VERTEX = /* glsl */`
  uniform float uTime;
  uniform float uMode;
  uniform float uLength;
  uniform float uRipple;
  varying vec3 vPositionWorld;
  varying vec3 vNormalWorld;
  varying vec2 vUv;
  void main() {
    vec3 p = position;
    // The ion tail ripples: a slow sideways wave travelling down it, growing
    // with distance from the head, as the solar wind's field kinks it.
    if (uMode > 0.5 && uMode < 1.5) {
      float s = uv.x;
      p.x += sin(s * 9.0 - uTime * 0.7) * s * s * uLength * 0.025 * uRipple;
      p.y += sin(s * 6.0 - uTime * 0.45 + 1.3) * s * s * uLength * 0.015 * uRipple;
    }
    vec4 world = modelMatrix * vec4(p, 1.0);
    vPositionWorld = world.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EMISSION_FRAGMENT = /* glsl */`
  uniform vec3 uColour;
  uniform float uOpacity;
  uniform float uMode;
  uniform float uTime;
  uniform float uReach;
  uniform float uBodyRadius;
  uniform vec3 uBodyPosition;
  uniform vec3 uSunDirection;
  uniform float uForward;
  uniform float uRipple;
  varying vec3 vPositionWorld;
  varying vec3 vNormalWorld;
  varying vec2 vUv;
  void main() {
    vec3 ray = normalize(vPositionWorld - cameraPosition);
    float facing = abs(dot(normalize(vNormalWorld), -ray));
    float alpha = 0.0;
    if (uMode < 0.5) {
      vec3 toBody = uBodyPosition - cameraPosition;
      float miss = length(cameraPosition + ray * dot(toBody, ray) - uBodyPosition);
      float knee = uBodyRadius * 1.2;
      float core = (knee / max(miss, knee)) * exp(-miss / (uReach * 0.32));
      // Front faces over the rock at a third, as design D's veil.
      float face = gl_FrontFacing ? 0.35 : 1.0;
      alpha = uOpacity * core * smoothstep(0.0, 0.45, facing) * face / 1.35;
    } else if (uMode < 1.5) {
      float along = pow(1.0 - vUv.x, 1.4) * smoothstep(0.0, 0.04, vUv.x);
      float streamers = mix(1.0, 0.72 + 0.28 * sin(vUv.y * 6.2832 * 3.0 + vUv.x * 14.0 - uTime * 0.9), uRipple);
      alpha = uOpacity * along * pow(facing, 1.6) * streamers;
    } else {
      float along = pow(1.0 - vUv.x, 1.15) * smoothstep(0.0, 0.08, vUv.x);
      float phase = 1.0 + uForward * pow(max(0.0, dot(ray, uSunDirection)), 3.0);
      alpha = uOpacity * along * smoothstep(0.0, 0.6, facing) * phase;
    }
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

let emissionClock = 0;
function emissionMaterial({ mode, colour, opacity, reach = 1, bodyRadius = 1, length = 1, forward = 0, ripple = 1, side = THREE.DoubleSide }) {
  const material = new THREE.ShaderMaterial({
    vertexShader: EMISSION_VERTEX,
    fragmentShader: EMISSION_FRAGMENT,
    uniforms: {
      uColour: { value: new THREE.Color(colour) },
      uOpacity: { value: opacity },
      uMode: { value: mode },
      uTime: { value: 0 },
      uLength: { value: length },
      uReach: { value: reach },
      uBodyRadius: { value: bodyRadius },
      uBodyPosition: { value: new THREE.Vector3() },
      uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      uForward: { value: forward },
      uRipple: { value: ripple },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side,
    toneMapped: true,
  });
  material.userData.emission = true;
  return material;
}

/*
 * A tube along a centre line that bends in x as s^2 (s = 0 at the head, 1 at
 * the end) and widens linearly; flattened in y, because a dust tail is a fan
 * in the orbit's plane. uv.x runs along it, uv.y round it.
 */
function tailTube({ length, startRadius, endRadius, bend = 0, flatten = 1, segments = 48, radial = 18 }) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const s = i / segments;
    const cx = bend * length * s * s;
    const cz = length * s;
    const r = startRadius + (endRadius - startRadius) * s;
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * r, Math.sin(a) * r * flatten, cz);
      uvs.push(s, j / radial);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* Colours. Green: the C2 Swan bands peak at 516 nm, an emerald; blue: CO+
 * emits at 400-430 nm; dust: sunlight, whitish with a warm cast. sRGB
 * values judged in the lab. */
const GAS_GREEN = 0x3ff07e;
const ION_BLUE = 0x3f74ff;
const DUST_WARM = 0xf1e4c4;
/* Sodium D lines, 589 nm: the colour Mercury's sodium-tail event uses. */
const SODIUM = 0xffb347;

/*
 * How much of each layer a body gets: 1 for a comet (the default), less or
 * none where the measurements say so. `record.emission` may be false (none),
 * true or absent (a comet), or an object overriding any of these.
 */
const EMISSION_DEFAULT = Object.freeze({ gas: 1, ion: 1, dust: 1, gasColour: GAS_GREEN, ionColour: ION_BLUE, ripple: 1 });
function emissionFor(record) {
  if (record.emission === false) return null;
  return { ...EMISSION_DEFAULT, ...(typeof record.emission === "object" ? record.emission : {}) };
}

function buildEmission(record, reach, parts, mix) {
  const coma = record.coma;
  const k = (coma.opacity ?? 0.16) / 0.16;
  const comaRadius = reach * (coma.radii ?? 5);
  const tailLength = reach * ((record.tail?.length ?? 16) * 1.25);

  const gas = emissionMaterial({ mode: 0, colour: mix.gasColour, opacity: 0.34 * k * mix.gas, reach: comaRadius, bodyRadius: reach });
  const gasMesh = new THREE.Mesh(new THREE.SphereGeometry(comaRadius * 0.8, 40, 28), gas);
  gasMesh.name = `${record.name} gas coma`;
  gasMesh.renderOrder = -2;
  gasMesh.frustumCulled = false;
  gasMesh.visible = mix.gas > 0;
  parts.aimed.add(gasMesh);

  const ionLength = tailLength * 1.9;
  const ion = emissionMaterial({ mode: 1, colour: mix.ionColour, opacity: 0.34 * k * mix.ion, length: ionLength, ripple: mix.ripple });
  const ionMesh = new THREE.Mesh(tailTube({ length: ionLength, startRadius: reach * 0.25, endRadius: reach * 0.6, radial: 14 }), ion);
  ionMesh.name = `${record.name} ion tail`;
  ionMesh.renderOrder = -3;
  ionMesh.frustumCulled = false;
  ionMesh.visible = mix.ion > 0;
  parts.aimed.add(ionMesh);

  /* The dust tail hangs off its own pivot, turned each frame so +z is
   * away from the Sun and +x is the way the comet has just come from. */
  const curved = new THREE.Group();
  curved.name = `${record.name} dust tail pivot`;
  const dust = emissionMaterial({ mode: 2, colour: DUST_WARM, opacity: 0.09 * k * mix.dust, forward: 1.6 });
  const dustMesh = new THREE.Mesh(tailTube({
    length: tailLength, startRadius: reach * 1.1, endRadius: reach * 3.8, bend: 0.5, flatten: 0.45,
  }), dust);
  dustMesh.name = `${record.name} dust tail`;
  dustMesh.renderOrder = -3;
  dustMesh.frustumCulled = false;
  dustMesh.visible = mix.dust > 0;
  curved.add(dustMesh);
  parts.group.add(curved);

  parts.materials.push(gas, ion, dust);
  parts.emission = { curved, ion, gas, dust, lastPosition: null, trailing: new THREE.Vector3(1, 0, 0) };
}

let ventTexture = null;
function getVentTexture() {
  if (ventTexture) return ventTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0.0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  ventTexture = new THREE.CanvasTexture(canvas);
  ventTexture.colorSpace = THREE.SRGBColorSpace;
  return ventTexture;
}

/**
 * Builds one body's activity.
 *
 * `reach` is the body's rendered half-extent, so every size in the catalogue
 * is read in body radii and a 60 km Centaur and a 200 km one both get a
 * cloud in proportion to themselves.
 *
 * Returns `{ group, spinning, materials, aimed, vents }`, or null for a body
 * with nothing going on and for the headless harness. **Two parents**:
 * `group` holds what ignores the body's rotation -- the coma, the dust fan,
 * the fragment -- and `spinning` holds what is fixed to the surface and must
 * turn with it, which is the vents and the jets.
 */
export function createCentaurComa(record, reach) {
  if (typeof document === "undefined") return null;
  const coma = record.coma;
  if (!coma) return null;

  const group = new THREE.Group();
  group.name = `${record.name} activity`;
  const spinning = new THREE.Group();
  spinning.name = `${record.name} surface activity`;
  const materials = [];
  const radius = reach * (coma.radii ?? 5);

  /* The envelopes hang off one pivot that is turned each frame so its +z
   * points away from the Sun. Everything in it is authored in that frame. */
  let tailMesh = null;
  const aimed = new THREE.Group();
  aimed.name = `${record.name} sun-aligned dust`;
  group.add(aimed);

  const design = COMA_DESIGNS[COMA_DESIGN];
  /* E builds gas, ions and a curved dust tail of its own. */
  /* A comet (it has an activity law), or anything whose record describes
   * its own emission -- the Centaurs and Phaethon. */
  const emissionMix = design.emission && (record.activity || typeof record.emission === "object")
    ? emissionFor(record)
    : null;
  const emission = Boolean(emissionMix);

  // The coma: a sphere, pulled a little towards the Sun, where the ice goes.
  /* In E the dust coma is sunlight off dust, so whitish-yellow: the
   * record's colour pulled 60% of the way to it. */
  const comaColour = new THREE.Color(coma.colour ?? 0xbccad2);
  if (emission) comaColour.lerp(new THREE.Color(DUST_WARM), 0.6);
  const comaMaterial = dustMaterial({
    colour: comaColour,
    opacity: coma.opacity ?? 0.1,
    reach: radius,
    bodyRadius: reach,
    forward: coma.forward ?? 0.25,
  });
  materials.push(comaMaterial);
  const comaMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), comaMaterial);
  comaMesh.name = `${record.name} coma`;
  comaMesh.position.set(0, 0, -radius * (coma.sunwardBias ?? 0.14));
  comaMesh.renderOrder = -2;
  comaMesh.frustumCulled = false;
  aimed.add(comaMesh);

  // The dust fan: a stretched envelope pushed down-sun. (E draws a curved
  // dust tail instead.)
  if (record.tail && !emission) {
    const length = reach * (record.tail.length ?? 9);
    const width = reach * (record.tail.width ?? 3.2);
    const geometry = new THREE.SphereGeometry(1, 40, 28);
    // Scaling the geometry rather than the mesh keeps the normals right.
    geometry.scale(width, width, length * 0.5);
    const tailMaterial = dustMaterial({
      colour: record.tail.colour ?? coma.colour ?? 0xbccad2,
      opacity: record.tail.opacity ?? 0.05,
      reach: length,
      bodyRadius: reach,
      forward: coma.forward ?? 0.25,
    });
    materials.push(tailMaterial);
    const tail = new THREE.Mesh(geometry, tailMaterial);
    tail.name = `${record.name} dust fan`;
    tail.position.set(0, 0, length * 0.42);
    tail.renderOrder = -3;
    tail.frustumCulled = false;
    tail.userData.baseZ = tail.position.z;
    aimed.add(tail);
    tailMesh = tail;
  }

  // The fragment from Echeclus's 2005 outburst: its own small cloud.
  if (record.fragment) {
    const fragmentRadius = reach * (record.fragment.radii ?? 1.6);
    const fragmentMaterial = dustMaterial({
      colour: record.fragment.colour ?? coma.colour ?? 0x8fb4ee,
      opacity: record.fragment.opacity ?? 0.12,
      reach: fragmentRadius,
      bodyRadius: reach * 0.05,
      forward: coma.forward ?? 0.25,
    });
    materials.push(fragmentMaterial);
    const fragment = new THREE.Mesh(
      new THREE.SphereGeometry(fragmentRadius, 32, 20),
      fragmentMaterial,
    );
    fragment.name = `${record.name} fragment`;
    fragment.position.set(...record.fragment.offset).multiplyScalar(reach);
    // Its cloud is centred on itself, not on the nucleus it came off.
    fragmentMaterial.userData.centre = fragment;
    fragment.renderOrder = -2;
    fragment.frustumCulled = false;
    group.add(fragment);
  }

  // Jets: cones rooted on the surface and turning with it.
  (record.jets ?? []).forEach((jet, index) => {
    const length = reach * (jet.length ?? 8);
    const spread = jet.spread ?? 0.12;
    const geometry = new THREE.CylinderGeometry(
      length * spread, reach * 0.05, length, 24, 1, true,
    );
    // Base at the origin, opening along +y; uv.y runs 0 at the base to 1 at
    // the far end, which is what the shader's length fade reads.
    geometry.translate(0, length * 0.5, 0);
    const jetMaterial = dustMaterial({
      colour: jet.colour ?? coma.colour ?? 0x9cc0f4,
      opacity: jet.opacity ?? 0.2,
      reach: length,
      bodyRadius: reach,
      alongFade: 1,
      forward: coma.forward ?? 0.25,
    });
    jetMaterial.side = THREE.DoubleSide;
    materials.push(jetMaterial);
    const mesh = new THREE.Mesh(geometry, jetMaterial);
    mesh.name = `${record.name} jet ${index + 1}`;
    _axis.set(...jet.dir).normalize();
    mesh.quaternion.setFromUnitVectors(_up, _axis);
    mesh.position.copy(_axis).multiplyScalar(reach * 0.9);
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    spinning.add(mesh);
  });

  /* Vents stay sprites. They are points on the surface, not clouds, and a
   * point looks the same from every direction -- which is exactly the
   * property that made the other layers wrong as sprites and makes these
   * right. They are lit only while their patch of ground faces the Sun. */
  const vents = [];
  const vent = record.vents;
  if (vent?.count) {
    for (let i = 0; i < vent.count; i += 1) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getVentTexture(),
        color: new THREE.Color(vent.colour ?? 0xdcecf4),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }));
      sprite.name = `${record.name} vent ${i + 1}`;
      sprite.scale.setScalar(reach * (vent.size ?? 0.3) * 2);
      sprite.renderOrder = 2;
      sprite.userData.peakOpacity = vent.opacity ?? 0.4;
      // Golden-angle scatter: nobody has resolved a vent on either body.
      const golden = i * 2.399963;
      const lat = (((i * 0.37) % 1) - 0.5) * 1.5;
      _axis.set(
        Math.cos(lat) * Math.cos(golden),
        Math.sin(lat),
        Math.cos(lat) * Math.sin(golden),
      ).normalize();
      sprite.position.copy(_axis).multiplyScalar(reach * 0.97);
      sprite.userData.ventNormal = _axis.clone();
      spinning.add(sprite);
      vents.push(sprite);
    }
  }

  const parts = { group, spinning, materials, aimed, vents, tail: tailMesh, strength: 1, emission: null };
  if (emission) buildEmission(record, reach, parts, emissionMix);
  materials.forEach((material) => {
    material.userData.baseOpacity = material.uniforms.uOpacity.value;
  });
  return parts;
}

/**
 * Turns a comet's activity up or down, 0 to 1.
 *
 * The Centaurs' clouds are always on; a comet's follows its distance from
 * the Sun (`cometActivity` in smallBodies.js). Everything fades together, and
 * the dust fan also shortens -- a comet that has only just woken up has a
 * stubby tail, not a faint long one. At zero the whole thing is hidden, so a
 * dormant comet costs no draw calls. Skips the writes when nothing changed
 * by more than half a per cent, which is almost every frame.
 */
export function setComaStrength(parts, strength) {
  if (!parts) return;
  const s = THREE.MathUtils.clamp(strength, 0, 1);
  if (Math.abs(s - parts.strength) < 0.005 && (s > 0) === parts.group.visible) return;
  parts.strength = s;
  const on = s > 0.005;
  parts.group.visible = on;
  parts.spinning.visible = on;
  if (!on) return;
  /* Round 7: opacity follows a root of the activity, not the activity
   * itself. Perceived brightness is compressive -- Stevens' power law,
   * exponent about 0.33 to 0.5 for brightness (Stevens 1957, Psych. Review
   * 64, 153) -- so a coma at 10% opacity over black reads as nothing at all,
   * and a comet just waking up looked asleep. Round 9 moved to the 0.33 end
   * (an extended source, which a coma is) because the activity law became
   * straight in log distance and starts more gently: just inside its wake-up
   * distance a comet at 4% is now drawn at 34%. At 1 (every Centaur, every
   * comet at full glow) nothing changes. */
  const seen = Math.cbrt(s);
  for (let i = 0; i < parts.materials.length; i += 1) {
    const material = parts.materials[i];
    material.uniforms.uOpacity.value = material.userData.baseOpacity * seen;
  }
  if (parts.tail) {
    const k = 0.3 + 0.7 * s;
    parts.tail.scale.z = k;
    parts.tail.position.z = parts.tail.userData.baseZ * k;
  }
  if (parts.emission) {
    // Tails grow with activity, as the fan does.
    const k = 0.3 + 0.7 * s;
    parts.emission.curved.scale.setScalar(k);
    parts.aimed.children.forEach((child) => { if (/ion tail/.test(child.name)) child.scale.z = k; });
  }
  for (let i = 0; i < parts.vents.length; i += 1) {
    const vent = parts.vents[i];
    if (vent.userData.basePeak === undefined) vent.userData.basePeak = vent.userData.peakOpacity;
    vent.userData.peakOpacity = vent.userData.basePeak * seen;
  }
}

/**
 * Re-aims the dust away from the Sun and tells the shader where the Sun is.
 *
 * The Sun sits at the scene origin, so the anti-sunward direction is the
 * body's own position, normalised -- nothing to look up. The body moves
 * round its orbit over decades, so on screen the dust is effectively fixed
 * in space while the camera moves round it, which is the whole point.
 */
export function updateCentaurComa(parts, group) {
  if (!parts || !parts.group.visible) return;
  group.getWorldPosition(_world);
  _antiSun.copy(_world).normalize();
  if (_antiSun.lengthSq() < 0.5) return;

  // The group itself never rotates, so local and world directions agree.
  parts.aimed.quaternion.setFromUnitVectors(_forward, _antiSun);

  if (parts.emission) {
    const e = parts.emission;
    /* Which way the comet is going: from its own motion, frame to frame,
     * eased so a single jerky frame cannot swing the tail. Until it has
     * moved (the lab, or a paused clock) the trailing side stays as built. */
    if (e.lastPosition) {
      // Trailing = where it has just been: minus its motion, with the
      // part along the Sun line removed.
      _axis.copy(e.lastPosition).sub(_world);
      if (_axis.lengthSq() > 1e-12) {
        _axis.addScaledVector(_antiSun, -_axis.dot(_antiSun));
        if (_axis.lengthSq() > 1e-12) e.trailing.lerp(_axis.normalize(), 0.08).normalize();
      }
    } else e.lastPosition = new THREE.Vector3();
    e.lastPosition.copy(_world);
    // Basis: z away from the Sun, x the trailing side, kept perpendicular.
    const x = e.trailing.clone().addScaledVector(_antiSun, -e.trailing.dot(_antiSun));
    if (x.lengthSq() < 1e-8) x.set(0, 1, 0).cross(_antiSun);
    x.normalize();
    const y = new THREE.Vector3().crossVectors(_antiSun, x);
    _basis.makeBasis(x, y, _antiSun);
    e.curved.quaternion.setFromRotationMatrix(_basis);
    emissionClock = performance.now() / 1000;
    e.ion.uniforms.uTime.value = emissionClock;
  }

  for (let i = 0; i < parts.materials.length; i += 1) {
    const uniforms = parts.materials[i].uniforms;
    uniforms.uSunDirection.value.copy(_antiSun).negate();
    const centre = parts.materials[i].userData.centre;
    if (centre) centre.getWorldPosition(uniforms.uBodyPosition.value);
    else uniforms.uBodyPosition.value.copy(_world);
  }

  for (let i = 0; i < parts.vents.length; i += 1) {
    const sprite = parts.vents[i];
    if (!sprite.parent) continue;
    sprite.parent.getWorldQuaternion(_quaternion);
    _axis.copy(sprite.userData.ventNormal).applyQuaternion(_quaternion);
    // Lit when its outward normal faces the Sun; off, not dim, when it does not.
    const lit = Math.max(0, -_axis.dot(_antiSun));
    sprite.material.opacity = sprite.userData.peakOpacity * Math.pow(lit, 2.2);
  }
}

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

    // 1. Column density through a centrally condensed cloud.
    float density = pow(1.0 - clamp(miss / uReach, 0.0, 1.0), 1.7);

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
    float shadow = downSun > 0.0
      ? mix(0.5, 1.0, smoothstep(uBodyRadius * 0.7, uBodyRadius * 1.8, offAxis))
      : 1.0;

    // 4. Keep the rock dark: no cloud light across the nucleus's own disc.
    // The ramp ends just past the limb (1.08 radii): a wider one, tried at
    // 1.55, left a dark moat around the rock where the cloud is densest.
    float clearOfDisc = smoothstep(uBodyRadius * 0.9, uBodyRadius * 1.08, miss);

    // Mild forward scattering, and nothing more view-dependent than this.
    float phase = 1.0 + uForward * pow(max(0.0, dot(ray, uSunDirection)), 3.0);

    // Jets fade along their length; envelopes do not use this.
    float lengthFade = mix(1.0, pow(max(0.0, 1.0 - vUv.y), 1.6), uAlongFade);

    float alpha = uOpacity * density * edge * lit * shadow * clearOfDisc * phase * lengthFade;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const _world = new THREE.Vector3();
const _antiSun = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _quaternion = new THREE.Quaternion();

function dustMaterial({ colour, opacity, reach, bodyRadius, alongFade = 0, forward = 0.25 }) {
  return new THREE.ShaderMaterial({
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
      uForward: { value: forward },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    /* Back faces: one layer from outside and still one layer from inside, so
     * zooming down through the cloud to the surface never makes it vanish.
     * Every term is computed from the viewing ray, not from the face drawn. */
    side: THREE.BackSide,
    toneMapped: true,
  });
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
  const aimed = new THREE.Group();
  aimed.name = `${record.name} sun-aligned dust`;
  group.add(aimed);

  // The coma: a sphere, pulled a little towards the Sun, where the ice goes.
  const comaMaterial = dustMaterial({
    colour: coma.colour ?? 0xbccad2,
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

  // The dust fan: a stretched envelope pushed down-sun.
  if (record.tail) {
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
    aimed.add(tail);
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

  return { group, spinning, materials, aimed, vents };
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
  if (!parts) return;
  group.getWorldPosition(_world);
  _antiSun.copy(_world).normalize();
  if (_antiSun.lengthSq() < 0.5) return;

  // The group itself never rotates, so local and world directions agree.
  parts.aimed.quaternion.setFromUnitVectors(_forward, _antiSun);

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

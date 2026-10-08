import * as THREE from "three";
import { createPlanetAuroraLayer } from "./planetAurora.js";

/**
 * Aurorae on the other bodies in the scene that have one (fifth final round,
 * the owner: "add up aurora for the celestial bodies").
 *
 * Mars, Jupiter, Saturn and Uranus build their own in their visuals files;
 * Earth's is visible light and lives in earthVisuals.js. These are the rest
 * with a detected aurora. Each uses the same shell as the giants
 * (planetAurora.js): barely there to the eye -- or not drawn at all, where
 * no eye could see it -- and full strength in the ultraviolet view.
 *
 *   Neptune   JWST confirmed it in infrared (H3+, June 2023 data; Melin et
 *             al., Nature Astronomy 2025) in the southern mid-latitudes,
 *             30-60 deg S, where the steeply tilted (47 deg) and offset field
 *             puts the auroral zone; Voyager 2 saw a weak ultraviolet glow on
 *             the night side in 1989. A partial band there, and a fainter
 *             counterpart in the north.
 *   Io        two bright "equatorial spots" on the sides facing towards and
 *             away from Jupiter, where Jupiter's field lines graze the moon
 *             (Hubble STIS; Roesler et al. 1999, Retherford et al. 2000),
 *             plus a faint glow round the limb. The shell is turned every frame so
 *             its longitude 0 faces Jupiter.
 *   Europa    an oxygen glow round the limb, from its thin oxygen atmosphere
 *             (Hubble; Roth et al. 2016) -- not over the face of the moon,
 *             which the first version lit and the owner found confusing.
 *   Ganymede  two auroral ovals, one in each hemisphere -- it is the only
 *             moon with its own magnetic field. Their rocking with Jupiter's
 *             field is the evidence for its salt-water ocean (Hubble STIS;
 *             Saur et al. 2015). Drawn at about +/-43 deg.
 *   Callisto  a faint oxygen glow round the limb (Keck HIRES, de Kleer et al.
 *             2023; Hubble, Cunningham et al. 2015); its face, night side
 *             included, keeps its own surface.
 *   Venus     no magnetic field; a diffuse glow over the night side --
 *             ultraviolet oxygen (Pioneer Venus) and the green oxygen line
 *             (Gray et al. 2014), strongest after solar storms.
 *   Mercury   electrons from the tail of its small magnetosphere rain onto
 *             the bare surface on the dawn side and make it shine in X-rays
 *             (BepiColombo, 1 October 2021 flyby; Aizawa et al. 2023). A thin
 *             low-latitude glow at the surface, turned every frame to stay on
 *             the dawn side; not drawn outside the view.
 *   67P       a far-ultraviolet aurora in the coma, from solar-wind electrons
 *             accelerated near the nucleus (Rosetta Alice; Galand et al. 2020,
 *             Nature Astronomy -- rechecked in the sixth round: it is real,
 *             the first aurora found at a comet). The first version wrapped
 *             it in a sphere shell, which looked like a cage; a coma has no
 *             surface, so it is now a soft violet glow that fades outwards
 *             from the nucleus, on a camera-facing sprite. Not drawn outside
 *             the view.
 *
 * Triton is left out: Voyager 2's ultraviolet emission there may be auroral,
 * but it has not been confirmed.
 *
 * Cost: the moons' and small bodies' shells use the low-quality sphere
 * (80 x 80), and the hidden ones cost nothing until the view opens.
 */
const EXTRA_AURORAE = Object.freeze({
  Neptune: {
    shellScale: 1.035, latitudeCenter: -0.72, latitudeWidth: 0.1, mirroredStrength: 0.35,
    longitudeCenter: 0.8, longitudeWidth: 1.5, globalDiffuseStrength: 0.04,
    faceOnVisibility: 0.72, daysideVisibility: 0.14, arcFrequency: 3.0, spikeFrequency: 16,
    displacementStrength: 0.006, shellAlpha: 0.62, intensity: 1.0, animationSpeed: 0.8,
  },
  Io: {
    shellScale: 1.06, latitudeCenter: 0.0, latitudeWidth: 0.32, mirroredStrength: 0,
    longitudeCenter: 0, longitudeWidth: 0.55, secondaryLongitudeCenter: Math.PI,
    secondaryLongitudeWidth: 0.55, secondaryLongitudeStrength: 1, globalDiffuseStrength: 0.06,
    faceOnVisibility: 0.4, daysideVisibility: 0.12, arcFrequency: 2.0, spikeFrequency: 10,
    displacementStrength: 0.01, shellAlpha: 0.7, intensity: 1.15, animationSpeed: 0.7,
    facesParent: true,
  },
  Europa: {
    // A glow at the limb only: Hubble sees Europa's oxygen emission brightest
    // round the edge of the disc (Roth et al. 2016), not over its face.
    shellScale: 1.05, latitudeCenter: 0.6, latitudeWidth: 0.35, mirroredStrength: 1,
    globalDiffuseStrength: 0.75, faceOnVisibility: 0, limbGlowStart: 0.5, daysideVisibility: 0.14,
    arcFrequency: 2.4, spikeFrequency: 9, displacementStrength: 0.008, shellAlpha: 0.55,
    intensity: 0.9, animationSpeed: 0.6,
  },
  Ganymede: {
    shellScale: 1.045, latitudeCenter: 0.68, latitudeWidth: 0.06, mirroredStrength: 1,
    globalDiffuseStrength: 0.05, faceOnVisibility: 0.55, daysideVisibility: 0.14,
    arcFrequency: 3.2, spikeFrequency: 14, displacementStrength: 0.008, shellAlpha: 0.7,
    intensity: 1.1, animationSpeed: 0.7,
  },
  Callisto: {
    // The same: a thin oxygen atmosphere glowing at the limb, so the surface
    // on its face -- day or night side -- is left as it is.
    shellScale: 1.05, latitudeCenter: 0.5, latitudeWidth: 0.4, mirroredStrength: 1,
    globalDiffuseStrength: 0.9, faceOnVisibility: 0, limbGlowStart: 0.5, daysideVisibility: 0.14,
    arcFrequency: 2.0, spikeFrequency: 8, displacementStrength: 0.006, shellAlpha: 0.45,
    intensity: 0.75, animationSpeed: 0.5,
  },
  Venus: {
    shellScale: 1.035, latitudeCenter: 0.3, latitudeWidth: 0.5, mirroredStrength: 1,
    globalDiffuseStrength: 0.9, faceOnVisibility: 0.15, daysideVisibility: 0.03,
    arcFrequency: 2.2, spikeFrequency: 9, displacementStrength: 0.006, shellAlpha: 0.55,
    intensity: 0.9, animationSpeed: 0.5,
  },
  Mercury: {
    shellScale: 1.01, latitudeCenter: 0.0, latitudeWidth: 0.35, mirroredStrength: 0,
    longitudeCenter: 0, longitudeWidth: 0.7, globalDiffuseStrength: 0.1,
    faceOnVisibility: 0.6, daysideVisibility: 0.7,
    arcFrequency: 2.0, spikeFrequency: 8, displacementStrength: 0.004, shellAlpha: 0.5,
    intensity: 0.7, animationSpeed: 0.5,
    facesDawn: true,
  },
  "67P/Churyumov–Gerasimenko": {
    // Not a shell: the coma is a cloud with no surface, so the aurora is a
    // soft glow fading outwards from the nucleus (see createHalo).
    style: "halo",
    haloScale: 3.4,
    // Blue-violet, not lavender: added over the grey nucleus the old shade
    // read as pink.
    colour: 0x6f86ff,
  },
});

export const EXTRA_AURORA_NAMES = Object.freeze(Object.keys(EXTRA_AURORAE));

const attached = new Map();
let haloClock = 0;
const _toParent = new THREE.Vector3();
const _dawn = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/* In the body's own units: a moon's sphere is often a unit sphere scaled up,
 * so its geometry -- not its world-space visualRadius -- is what a child
 * shell has to match. */
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _bodyScale = new THREE.Vector3();
export function bodyRadius(body) {
  // A small body is a group; its nucleus hangs under "<name> tilt".
  const nucleus = !body.geometry ? body.children.find((child) => / tilt$/.test(child.name)) : null;
  if (nucleus) {
    // Its solid meshes only: glows and sprites round it are far larger.
    _box.makeEmpty();
    nucleus.updateWorldMatrix(true, true);
    nucleus.traverse((object) => {
      if (object.isMesh && object.geometry && !/glow|coma|halo|jet|fan|dust|tail/i.test(object.name ?? "")) {
        _box.expandByObject(object);
      }
    });
    _box.getSize(_size);
    body.getWorldScale(_bodyScale);
    const radius = Math.max(_size.x, _size.y, _size.z) * 0.5 / Math.max(_bodyScale.x, 1e-6);
    if (radius > 0) return radius;
  }
  if (body.geometry) {
    if (!body.geometry.boundingSphere) body.geometry.computeBoundingSphere();
    const radius = body.geometry.boundingSphere?.radius;
    if (radius > 0) return radius;
  }
  const radius = Number(body.userData?.visualRadius);
  return radius > 0 ? radius : 1;
}

let haloTexture = null;
function getHaloTexture() {
  if (haloTexture) return haloTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.75)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.42)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.14)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  haloTexture = new THREE.CanvasTexture(canvas);
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  return haloTexture;
}

/* A glow with no surface: a camera-facing sprite, additive, hidden until the
 * ultraviolet view opens (setAuroraSpectrum shows it there). */
function createHalo(body, radius, { haloScale = 3, colour = 0xffffff }) {
  /* depthTest off: the sprite is a flat card through the comet's centre, and
   * with depth testing the half of the nucleus behind the card was tinted and
   * the half in front was not -- a pink edge that slid round as the comet
   * turned (the owner). The glow now lies evenly over the nucleus, as the
   * coma it stands for surrounds it. */
  const material = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: colour,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
  });
  const halo = new THREE.Sprite(material);
  halo.scale.setScalar(radius * haloScale * 2);
  halo.renderOrder = 6;
  halo.userData.eyeAurora = true;
  halo.userData.eyeHidden = true;
  halo.visible = false;
  body.add(halo);
  return halo;
}

/**
 * Adds the shells to whichever of these bodies exist yet. The Jovian moons
 * are built a few at a time after the opening, so this is called again until
 * all are there; it returns true when nothing is left to add.
 */
export function attachExtraAurorae(findBody) {
  EXTRA_AURORA_NAMES.forEach((name) => {
    if (attached.has(name)) return;
    const body = findBody(name);
    if (!body) return;
    const { facesParent = false, facesDawn = false, style = "shell", ...config } = EXTRA_AURORAE[name];
    if (style === "halo") {
      const halo = createHalo(body, bodyRadius(body), config);
      halo.name = `${name} aurora`;
      halo.raycast = () => {};
      attached.set(name, { body, shell: halo, halo: true });
      return;
    }
    const isSmall = name !== "Neptune" && name !== "Venus" && name !== "Mercury";
    const shell = createPlanetAuroraLayer({
      planet: body,
      radius: bodyRadius(body),
      quality: isSmall ? "low" : "medium",
      primaryColor: 0xffffff,
      secondaryColor: 0xffffff,
      tertiaryColor: 0xffffff,
      ...config,
    });
    shell.name = `${name} aurora`;
    shell.raycast = () => {};
    const parent = facesParent && body.userData?.parentPlanet ? findBody(body.userData.parentPlanet) : null;
    attached.set(name, { body, shell, facesParent, facesDawn, parent });
  });
  return attached.size === EXTRA_AURORA_NAMES.length;
}

/** Per frame: the shells' time, and Io's turned to face Jupiter. */
export function updateExtraAurorae(frameScale = 1) {
  attached.forEach(({ body, shell, facesParent, facesDawn, parent, halo }) => {
    if (!shell.visible || !body.visible) return;
    if (halo) {
      // A slow swell, like the aurora shells' breathing.
      haloClock += 0.018 * frameScale;
      shell.material.opacity = 0.72 + Math.sin(haloClock * 0.6) * 0.13;
      return;
    }
    const uniforms = shell.material.uniforms;
    if (uniforms?.uTime) uniforms.uTime.value += 0.018 * frameScale;
    if (facesDawn) {
      /* Mercury's electrons rain on the dawn side: the morning terminator,
       * where the prograde spin carries the ground into sunlight. In the
       * body's frame that is (Sun direction) x (spin axis). */
      _toParent.set(0, 0, 0);
      body.worldToLocal(_toParent).normalize();
      _dawn.crossVectors(_toParent, _up);
      shell.rotation.set(0, Math.atan2(-_dawn.z, _dawn.x), 0);
    }
    if (facesParent) {
      if (parent?.getWorldPosition) {
        parent.getWorldPosition(_toParent);
        body.worldToLocal(_toParent);
        shell.rotation.set(0, Math.atan2(-_toParent.z, _toParent.x), 0);
      }
    }
  });
}

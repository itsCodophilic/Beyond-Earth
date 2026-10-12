import * as THREE from "three";
import { bodyRadius } from "./extraAurorae.js";

/**
 * Magnetospheres, drawn as labelled diagrams round the bodies that have one.
 *
 * Final round (the owner: "do all buddy everything at once" -- the
 * "magnetospheres and radiation belts, as labelled diagrams" of
 * `docs/populations-not-yet-built.md`, and the solar wind they stand in).
 *
 * Seven bodies make their own magnetic field: Mercury, Earth, Jupiter,
 * Saturn, Uranus, Neptune -- and Ganymede, the only moon that does. Each
 * field carves a cavity in the solar wind (Ganymede's, in Jupiter's own
 * flowing plasma). The diagram draws what every textbook figure draws:
 *
 *   bow shock      where the supersonic solar wind first slows, upstream
 *   magnetopause   the cavity's wall, where the field's pressure balances
 *                  the wind's
 *   magnetotail    the night side, stretched downwind for hundreds of radii
 *   field lines    the planet's dipole, squashed on the day side, dragged
 *                  out on the night side
 *   belts / tori   trapped radiation (Earth's Van Allen belts) and the
 *                  plasma a moon feeds in (Io's torus, Enceladus's)
 *
 * ## Distances: the real ones, through the planet's own moon curve
 *
 * Every boundary is placed at its measured distance in planet radii, then
 * put through the same compression the scene already uses for that planet's
 * moons (the `compressedOrbitScale` of each moon catalogue, repeated below
 * with its source). So the diagram agrees with the moons drawn round it:
 * Earth's magnetopause at 10 Earth radii lands well inside the Moon's drawn
 * orbit (60 radii), Jupiter's at 75 radii lands outside Callisto's, Saturn's
 * at 22 radii just outside Titan's -- the true arrangement, which is the
 * point. Mercury and Ganymede have no moons to agree with and are drawn at
 * their true ratios.
 *
 * Shapes: the magnetopause follows Shue et al. (1997)'s form, r = r0 (2 / (1
 * + cos theta))^0.5, flaring into a tail; the bow shock is a conic with the
 * measured standoff and an eccentricity of 0.8 (chosen, the usual fit). The
 * dipole is tilted from the spin axis by the measured angle -- 59 degrees at
 * Uranus and 47 at Neptune, and offset from the centre, which is why those
 * two diagrams look so lopsided -- and it turns with the planet.
 *
 * ## Cost
 *
 * Nothing until one is switched on. Each is two transparent shells, up to
 * three tori, ~40 field lines (rebuilt every sixth frame, a few thousand
 * vertices) and a handful of text sprites.
 */

const DEG = Math.PI / 180;

/* Each planet's moon curve, in planet radii -> drawn planet radii. */
const MOON_CURVES = {
  /* Earth: the Moon is drawn at 3.15 Earth radii (planets/earth/satellites/
   * moon.js, ORBIT_RADIUS) for a real 60.3; the power law through both ends
   * (1 -> 1, 60.3 -> 3.15) is d^0.280. */
  Earth: (d) => Math.pow(Math.max(1, d), 0.280),
  /* jovianMoonCatalog.js compressedOrbitScale: 0.78 + (a / 421,800 km)^0.42,
   * Jupiter's radius 71,492 km. Blended to 1 at the surface. */
  Jupiter: (d) => blendSurface(d, 0.78 + Math.pow((d * 71_492) / 421_800, 0.42), 1.6),
  /* saturnianMoonCatalog.js: 1.30 + 1.82 (max(1, a / 185,539 km))^0.34,
   * radius 60,268 km -- flat inside Mimas (the rings), so blended in. */
  Saturn: (d) => blendSurface(d, 1.30 + 1.82 * Math.pow(Math.max(1, (d * 60_268) / 185_539), 0.34), 3.1),
  /* uranianMoonCatalog.js: true radii to 100,000 km, then 3.91 -> 6.0 by
   * 583,511 km (power 0.72), then 6.15 + 2.6 x progress^0.34 to 20.4 Mkm. */
  Uranus: (d) => {
    const km = d * 25_559;
    if (km <= 100_000) return d;
    const edge = 100_000 / 25_559;
    if (km < 700_000) {
      const t = THREE.MathUtils.clamp((km - 100_000) / (583_511 - 100_000), 0, 1);
      return edge + (6.0 - edge) * Math.pow(t, 0.72);
    }
    const t = THREE.MathUtils.clamp((km - 700_000) / (20_421_400 - 700_000), 0, 1);
    return 6.15 + 2.60 * Math.pow(t, 0.34);
  },
  /* neptunianMoonCatalog.js: 1.10 + 1.70 (max(1, a / 48,227 km))^0.28,
   * radius 24,764 km. */
  Neptune: (d) => blendSurface(d, 1.10 + 1.70 * Math.pow(Math.max(1, (d * 24_764) / 48_227), 0.28), 2.0),
  Mercury: (d) => d,
  Ganymede: (d) => d,
};

/* Inside `until` radii, ease from the true distance to the moon curve, so
 * the inner belts are not lifted off the surface by a curve whose constant
 * term was written for moons. */
function blendSurface(d, curved, until) {
  if (d >= until) return curved;
  const t = THREE.MathUtils.smoothstep(d, 1, until);
  return THREE.MathUtils.lerp(d, curved, t);
}

/*
 * The measurements, in the body's own radii. Sources: Mercury -- Winslow et
 * al. 2013 (MESSENGER), dipole offset Anderson et al. 2011; Earth -- the
 * standard averages (magnetopause ~10, bow shock ~13; Van Allen belts
 * 1.2-2.5 and 3-7); Jupiter -- Joy et al. 2002 (magnetopause 45-100, bow
 * shock ~63-92), Io torus at 5.9; Saturn -- Achilleos et al. 2008
 * (magnetopause ~22), Enceladus torus at 3.95; Uranus and Neptune -- Voyager
 * 2 (Ness et al. 1986, 1989), tilts 59 and 47 degrees, offsets 0.3 and
 * 0.55 radii; Ganymede -- Kivelson et al. 1996 (Galileo), ~2 radii, no bow
 * shock because Jupiter's plasma flows past it slower than its own waves.
 */
export const MAGNETOSPHERES = Object.freeze({
  Mercury: { mp: 1.45, bs: 1.96, tail: 12, tiltDeg: 0, offset: [0, 0.2, 0], belts: [], tori: [], lines: [1.12, 1.3], colourMp: 0x7fd8ff },
  Earth: {
    mp: 10, bs: 13, tail: 1000, tiltDeg: 11, offset: [0, 0, 0],
    belts: [{ from: 1.2, to: 2.5, label: "Inner Van Allen belt", colour: 0xff8ad8 }, { from: 3, to: 7, label: "Outer Van Allen belt", colour: 0xc77dff }],
    tori: [], lines: [1.6, 2.6, 4, 6, 8],
  },
  Jupiter: {
    mp: 75, bs: 90, tail: 650, tiltDeg: 9.6, offset: [0, 0, 0],
    belts: [{ from: 1.3, to: 3, label: "Radiation belts — the harshest anywhere", colour: 0xc77dff }],
    tori: [{ at: 5.9, width: 1.0, label: "Io plasma torus", colour: 0xffb060 }],
    lines: [2.2, 6, 12, 25, 45],
  },
  Saturn: {
    mp: 22, bs: 27, tail: 250, tiltDeg: 0.06, offset: [0, 0, 0],
    belts: [{ from: 2.3, to: 3.4, label: "Radiation belt", colour: 0xc77dff }],
    tori: [{ at: 3.95, width: 0.8, label: "Enceladus plasma torus", colour: 0x9fe6ff }],
    lines: [3, 6, 10, 16],
  },
  Uranus: {
    mp: 18, bs: 23, tail: 300, tiltDeg: 59, offset: [0, 0.3, 0],
    belts: [{ from: 2, to: 5, label: "Radiation belts", colour: 0xc77dff }],
    tori: [], lines: [2.5, 5, 9, 13],
  },
  Neptune: {
    mp: 26, bs: 35, tail: 300, tiltDeg: 47, offset: [0, 0.55, 0],
    belts: [{ from: 2, to: 5, label: "Radiation belts", colour: 0xc77dff }],
    tori: [], lines: [2.5, 6, 11, 18],
  },
  Ganymede: { mp: 2.0, bs: 0, tail: 6, tiltDeg: 10, offset: [0, 0, 0], belts: [], tori: [], lines: [1.25, 1.6], colourMp: 0x9fe6ff, inJupiter: true },
});

const SHELL_VERTEX = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vAlong;
attribute float aAlong;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  vAlong = aAlong;
  gl_Position = projectionMatrix * mv;
}
`;
const SHELL_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform float uOpacity;
uniform float uTime;
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vAlong;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewV))), 2.2);
  // Faint bands drifting downwind: the solar wind sliding past the wall.
  float flow = 0.75 + 0.25 * sin(vAlong * 9.0 - uTime * 1.6);
  float a = (0.05 + 0.85 * rim) * flow * uOpacity;
  gl_FragColor = vec4(uColour, a);
}
`;

function shellMaterial(colour) {
  return new THREE.ShaderMaterial({
    vertexShader: SHELL_VERTEX,
    fragmentShader: SHELL_FRAGMENT,
    uniforms: { uColour: { value: new THREE.Color(colour) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/*
 * A surface of revolution about +x (the downwind direction, local), from a
 * profile r(theta) where theta is measured from the upwind (-x) direction.
 * Each profile point is mapped through the body's curve by its distance from
 * the centre, so the shape and the moons agree.
 */
function revolve(profile, map, segments = 48) {
  const positions = [];
  const along = [];
  const indices = [];
  const rows = profile.length;
  for (let i = 0; i < rows; i += 1) {
    const [x, rho] = profile[i];
    const dist = Math.hypot(x, rho);
    const k = dist > 1e-6 ? map(dist) / dist : 1;
    for (let j = 0; j <= segments; j += 1) {
      const phi = (j / segments) * Math.PI * 2;
      positions.push(x * k, rho * k * Math.cos(phi), rho * k * Math.sin(phi));
      along.push(i / (rows - 1));
    }
  }
  for (let i = 0; i < rows - 1; i += 1) {
    for (let j = 0; j < segments; j += 1) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* Shue-type magnetopause: r = r0 (2 / (1 + cos t))^0.5 out to t = 150 deg,
 * then a tail of constant radius to `tail`. */
function magnetopauseProfile(r0, tail) {
  const pts = [];
  for (let k = 0; k <= 40; k += 1) {
    const t = (k / 40) * 150 * DEG;
    const r = r0 * Math.sqrt(2 / (1 + Math.cos(t)));
    pts.push([-r * Math.cos(t), r * Math.sin(t)]);
  }
  const [x0, rho0] = pts[pts.length - 1];
  for (let k = 1; k <= 16; k += 1) {
    const x = x0 + ((tail - x0) * k) / 16;
    pts.push([x, rho0 * (1 + 0.15 * (k / 16))]);
  }
  return pts;
}

/* Bow shock: r = L / (1 + e cos t), L = r0 (1 + e), t from upwind; open. */
function bowShockProfile(r0, extent) {
  const e = 0.8;
  const L = r0 * (1 + e);
  const pts = [];
  for (let k = 0; k <= 48; k += 1) {
    const t = (k / 48) * 128 * DEG;
    const r = L / (1 + e * Math.cos(t));
    const x = -r * Math.cos(t);
    if (x > extent) break;
    pts.push([x, r * Math.sin(t)]);
  }
  return pts;
}

let labelCache = new Map();
function textSprite(text, colour = "#dff4ff") {
  const key = `${text}|${colour}`;
  let texture = labelCache.get(key);
  const font = "600 28px ui-sans-serif, system-ui, -apple-system, sans-serif";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 28;
  if (!texture) {
    canvas.width = width;
    canvas.height = 44;
    ctx.font = font;
    ctx.fillStyle = "rgba(6, 10, 18, 0.72)";
    ctx.beginPath();
    ctx.roundRect?.(0, 0, width, 44, 10);
    if (!ctx.roundRect) ctx.rect(0, 0, width, 44);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 14, 23);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelCache.set(key, texture);
  }
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false, opacity: 0 });
  const sprite = new THREE.Sprite(material);
  /* 0.018 of the projection's unit height: about 22 px tall (14 px text)
   * on a 760 px viewport at the 34-degree focus field (round 36, by eye;
   * 0.03 read as shouting). */
  const h = 0.018;
  const aspect = (texture.image?.width ?? width) / 44;
  sprite.scale.set(h * aspect, h, 1);
  /* sizeAttenuation:false sprites still multiply by their parents' world
   * scale, and the diagram's root is scaled by the body's radius -- so the
   * base size is kept here and divided by that scale every frame. */
  sprite.userData.baseScale = [h * aspect, h];
  sprite.renderOrder = 30;
  sprite.raycast = () => {};
  return sprite;
}

/* Dipole field line r = L cos^2(lat) in the meridian plane at longitude
 * `lon`, in the dipole frame (+y the magnetic axis). */
function dipoleLine(L, lon) {
  const pts = [];
  const latMax = Math.acos(Math.min(1, Math.sqrt(1 / L)));
  for (let k = 0; k <= 48; k += 1) {
    const lat = -latMax + (2 * latMax * k) / 48;
    const r = L * Math.cos(lat) ** 2;
    pts.push(new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)));
  }
  return pts;
}

/**
 * Builds one body's diagram, parented to the body so it moves and scales
 * with it. Returns a controller; `update(sunWorld, dt)` keeps it pointed.
 */
export function createMagnetosphere(body, name) {
  const spec = MAGNETOSPHERES[name];
  if (!spec || !body) return null;
  const map = MOON_CURVES[name] ?? ((d) => d);
  const radius = bodyRadius(body) || 1;
  const root = new THREE.Group();
  root.name = `${name} magnetosphere`;
  root.scale.setScalar(radius);
  body.add(root);

  // The Sun-facing frame: local +x points downwind (away from the Sun).
  const windFrame = new THREE.Group();
  root.add(windFrame);
  const materials = [];
  const mpMat = shellMaterial(spec.colourMp ?? 0x7fd8ff);
  materials.push({ m: mpMat, base: 0.5 });
  const mp = new THREE.Mesh(revolve(magnetopauseProfile(spec.mp, spec.tail), map), mpMat);
  mp.name = `${name} magnetopause`;
  mp.raycast = () => {};
  mp.renderOrder = 12;
  windFrame.add(mp);
  if (spec.bs > 0) {
    const bsMat = shellMaterial(0xffd2a0);
    materials.push({ m: bsMat, base: 0.42 });
    const bs = new THREE.Mesh(revolve(bowShockProfile(spec.bs, spec.tail * 0.35), map), bsMat);
    bs.name = `${name} bow shock`;
    bs.raycast = () => {};
    bs.renderOrder = 11;
    windFrame.add(bs);
  }

  // Upstream flow arrows: the wind arriving.
  const arrowMat = new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false });
  const arrows = new THREE.Group();
  const up = map(spec.bs > 0 ? spec.bs * 1.9 : spec.mp * 2.2);
  const span = map(spec.bs > 0 ? spec.bs : spec.mp) * 0.9;
  for (let k = -2; k <= 2; k += 1) {
    const y = (k / 2) * span;
    const x0 = -up * 1.25;
    const x1 = -up * 0.8;
    const head = up * 0.06;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x0, y, 0), new THREE.Vector3(x1, y, 0),
      new THREE.Vector3(x1 - head, y + head * 0.5, 0), new THREE.Vector3(x1, y, 0),
      new THREE.Vector3(x1 - head, y - head * 0.5, 0),
    ]);
    const line = new THREE.Line(geo, arrowMat);
    line.raycast = () => {};
    arrows.add(line);
  }
  windFrame.add(arrows);

  // The dipole frame: tilted from the spin axis, offset, turning with the body.
  const dipole = new THREE.Group();
  dipole.position.set(...spec.offset);
  dipole.rotation.z = spec.tiltDeg * DEG;
  root.add(dipole);
  const beltMeshes = [];
  [...spec.belts, ...spec.tori.map((t) => ({ from: t.at - t.width / 2, to: t.at + t.width / 2, label: t.label, colour: t.colour, torus: true }))].forEach((belt) => {
    const inner = map(belt.from);
    const outer = map(belt.to);
    const mid = (inner + outer) / 2;
    const tube = (outer - inner) / 2;
    const geo = new THREE.TorusGeometry(mid, tube, 16, 96);
    const mat = new THREE.MeshBasicMaterial({ color: belt.colour, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.z = belt.torus ? 0.5 : 0.75;
    mesh.raycast = () => {};
    mesh.renderOrder = 13;
    dipole.add(mesh);
    beltMeshes.push({ mesh, mat, base: belt.torus ? 0.32 : 0.2, label: belt.label, at: outer, colour: belt.colour });
  });

  // Field lines: rebuilt every few frames (they depend on where the Sun is).
  const fieldMat = new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const fieldGeo = new THREE.BufferGeometry();
  const fieldLines = new THREE.LineSegments(fieldGeo, fieldMat);
  fieldLines.raycast = () => {};
  fieldLines.frustumCulled = false;
  root.add(fieldLines);

  // Labels.
  const labels = [];
  const label = (text, colour, place) => {
    const sprite = textSprite(text, colour);
    sprite.userData.place = place;
    root.add(sprite);
    labels.push(sprite);
  };
  if (spec.bs > 0) label("Bow shock", "#ffd8a8", () => new THREE.Vector3(-map(spec.bs) * 1.04, map(spec.bs) * 0.5, 0));
  label(name === "Ganymede" ? "Magnetopause — inside Jupiter's field" : "Magnetopause", "#9fe6ff", () => new THREE.Vector3(-map(spec.mp) * 0.85, -map(spec.mp) * 0.75, 0));
  label("Magnetotail", "#9fe6ff", () => new THREE.Vector3(map(spec.tail) * 0.55, map(spec.mp) * 0.9, 0));
  label(name === "Ganymede" ? "Jupiter's plasma arrives" : "Solar wind arrives", "#ffe2a8", () => new THREE.Vector3(-up * 1.05, map(spec.bs > 0 ? spec.bs : spec.mp) * 1.05, 0));
  beltMeshes.forEach((b, i) => label(b.label, `#${new THREE.Color(b.colour).getHexString()}`, () => new THREE.Vector3(0, b.at * (0.55 + 0.25 * i), b.at * 1.05)));

  const state = { visible: false, fade: 0, time: 0, frame: 0 };
  const _q = new THREE.Quaternion();
  const _qParent = new THREE.Quaternion();
  const _sun = new THREE.Vector3();
  const _bodyPos = new THREE.Vector3();
  const _down = new THREE.Vector3();
  const _localDown = new THREE.Vector3();
  const _xAxis = new THREE.Vector3(1, 0, 0);
  const _worldScale = new THREE.Vector3();

  function rebuildFieldLines(localDown) {
    // In root-local units (body radii, already mapped below).
    const positions = [];
    const toRoot = new THREE.Matrix4().compose(dipole.position, dipole.quaternion, new THREE.Vector3(1, 1, 1));
    spec.lines.forEach((L) => {
      for (let j = 0; j < 8; j += 1) {
        const lon = (j / 8) * Math.PI * 2;
        const pts = dipoleLine(L, lon).map((p) => {
          const q = p.clone().applyMatrix4(toRoot);
          // Day side squeezed, night side dragged downwind.
          const along = q.dot(localDown);
          if (along > 0) q.addScaledVector(localDown, along * (L > spec.mp * 0.35 ? 2.4 : 0.8));
          else q.addScaledVector(localDown, along * -0.25);
          /* Kept inside the drawn wall: the Shue shape to 150 degrees from
           * the Sun, then the tail's cylinder (magnetopauseProfile). A
           * strongly tilted dipole (Uranus, Neptune) otherwise threw its
           * outer loops out through the flanks (round 36 screenshot). */
          const r = q.length();
          if (r > 1e-6) {
            const cosT = -q.dot(localDown) / r;
            const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
            const rMax = cosT > Math.cos(150 * DEG)
              ? spec.mp * Math.sqrt(2 / (1 + cosT))
              : Math.min(spec.tail, (spec.mp * 1.93) / Math.max(0.05, sinT));
            if (r > rMax * 0.95) q.multiplyScalar((rMax * 0.95) / r);
          }
          const d = q.length();
          return d > 1e-6 ? q.multiplyScalar(map(d) / d) : q;
        });
        for (let k = 0; k < pts.length - 1; k += 1) {
          positions.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
        }
      }
    });
    fieldGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    fieldGeo.computeBoundingSphere();
  }

  /* Labels are placed in 3D, so from some angles two land on one another
   * (Jupiter's belt and Io torus did). After placing them, each is checked
   * on screen against those already settled and stepped down a line until
   * it is clear -- at most six steps, a handful of projections a frame. */
  const _ndc = new THREE.Vector3();
  const _settled = [];
  function separateLabels(camera) {
    root.updateMatrixWorld();
    camera.updateMatrixWorld();
    const p5 = camera.projectionMatrix.elements[5];
    _settled.length = 0;
    labels.forEach((sprite) => {
      const [bw, bh] = sprite.userData.baseScale;
      const hN = bh * p5;
      const wN = (bw * p5) / Math.max(0.1, camera.aspect);
      _ndc.copy(sprite.position).applyMatrix4(root.matrixWorld).project(camera);
      if (_ndc.z > 1) return;
      let moved = false;
      // Kept on screen: a label half off the edge names nothing.
      const xMax = 1 - wN / 2 - 0.02;
      const yMax = 1 - hN / 2 - 0.02;
      const cx = Math.min(xMax, Math.max(-xMax, _ndc.x));
      const cy = Math.min(yMax, Math.max(-yMax, _ndc.y));
      if (cx !== _ndc.x || cy !== _ndc.y) { _ndc.x = cx; _ndc.y = cy; moved = true; }
      for (let step = 0; step < 6; step += 1) {
        const hit = _settled.find((r) => Math.abs(r.x - _ndc.x) < (r.w + wN) / 2 && Math.abs(r.y - _ndc.y) < (r.h + hN) / 2);
        if (!hit) break;
        _ndc.y = hit.y - (hit.h + hN) / 2 - hN * 0.08;
        moved = true;
      }
      _settled.push({ x: _ndc.x, y: _ndc.y, w: wN, h: hN });
      if (moved) {
        _ndc.unproject(camera);
        sprite.position.copy(root.worldToLocal(_ndc));
      }
    });
  }

  function update(dt = 1 / 60, sunWorld = null, camera = null, viewportHeight = 800) {
    const target = state.visible ? 1 : 0;
    state.fade += (target - state.fade) * Math.min(1, dt * 4);
    if (Math.abs(state.fade - target) < 0.004) state.fade = target;
    root.visible = state.fade > 0.003;
    if (!root.visible) return;
    state.time += dt;
    state.frame += 1;

    // Downwind direction in the root's local frame.
    body.getWorldPosition(_bodyPos);
    _sun.copy(sunWorld ?? new THREE.Vector3());
    _down.copy(_bodyPos).sub(_sun).normalize();
    root.getWorldQuaternion(_qParent);
    _localDown.copy(_down).applyQuaternion(_qParent.clone().invert()).normalize();
    _q.setFromUnitVectors(_xAxis, _localDown);
    windFrame.quaternion.copy(_q);
    if (state.frame % 6 === 1) rebuildFieldLines(_localDown);

    materials.forEach(({ m, base }) => {
      m.uniforms.uOpacity.value = base * state.fade;
      m.uniforms.uTime.value = state.time;
    });
    arrowMat.opacity = 0.7 * state.fade;
    fieldMat.opacity = 0.42 * state.fade;
    beltMeshes.forEach((b) => { b.mat.opacity = b.base * state.fade; });
    /* The first few labels name wind-frame things (bow shock, wall, tail,
     * wind) and turn with the wind frame; the rest name belts and tori and
     * turn with the dipole. */
    const windLabels = spec.bs > 0 ? 4 : 3;
    root.getWorldScale(_worldScale);
    const unit = Math.max(1e-9, _worldScale.x);
    /* Labels only once the diagram is big enough on screen to tell its
     * parts apart: below ~140 px across the magnetopause's nose they would
     * sit on one another (judged by eye, round 36), fully shown from ~280. */
    let labelFade = 1;
    if (camera?.isPerspectiveCamera) {
      const dist = camera.position.distanceTo(_bodyPos);
      const px = (map(spec.mp) * unit) / Math.max(1e-6, dist * Math.tan((camera.fov * DEG) / 2)) * (viewportHeight / 2);
      labelFade = Math.min(1, Math.max(0, (px - 140) / 140));
    }
    labels.forEach((sprite, i) => {
      const [bw, bh] = sprite.userData.baseScale;
      sprite.scale.set(bw / unit, bh / unit, 1);
      sprite.visible = labelFade > 0.01;
      sprite.position.copy(sprite.userData.place());
      if (i < windLabels) sprite.position.applyQuaternion(windFrame.quaternion);
      else sprite.position.applyQuaternion(dipole.quaternion).add(dipole.position);
      sprite.material.opacity = state.fade * labelFade;
    });
    if (camera && labelFade > 0.01) separateLabels(camera);
  }

  return {
    name,
    root,
    get visible() { return state.visible; },
    show(on = true) { state.visible = on; if (on) root.visible = true; },
    toggle() { state.visible = !state.visible; return state.visible; },
    /* World-space radius that holds the dayside diagram (bow shock or wall
     * and the arriving wind arrows), for the camera to frame it by. */
    extent() {
      root.getWorldScale(_worldScale);
      return map(spec.bs > 0 ? spec.bs : spec.mp) * 1.35 * _worldScale.x;
    },
    update,
    dispose() {
      body.remove(root);
    },
  };
}

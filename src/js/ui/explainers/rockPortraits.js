import * as THREE from "three";
import { buildSmallBodyPortrait } from "../../scene/smallBodies/smallBodies.js";

/**
 * "How they look in space": a few real rocks, rendered as the scene renders
 * them, for a board explanation's canvas.
 *
 * Round 38 (Prompts.md, the near-Earth families: "design each family and
 * show it individually in dashboard, how they would look like in space").
 * The rocks are the scene's own -- the same geometry, colour, map and
 * material (`buildSmallBodyPortrait`) -- lit the way space lights them: one
 * hard light, no air to scatter it, so the night side is black and the
 * terminator sharp. Black sky; a few faint, unmoving stars.
 *
 * One small WebGL renderer, made the first time the view is drawn and
 * disposed when the board closes (`dispose`). The universe is paused while
 * the board is open, so the second context costs the scene nothing.
 *
 * Lighting. The material's night-side gate takes the Sun to be the world
 * origin, so the rocks are placed at (800, 0, -460) and looked at along -z:
 * the Sun is then 60 degrees to the left of the viewer -- a phase angle of
 * 60 degrees, half-lit enough to show relief and still show the shape.
 */

const PLACE = new THREE.Vector3(800, 0, -460);

export function createRockPortraits(records, { layout = null } = {}) {
  let renderer = null;
  let scene = null;
  let camera = null;
  let pieces = [];
  let failed = false;
  let size = 0;

  function build() {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power", preserveDrawingBuffer: true });
    } catch (error) {
      failed = true;
      console.warn("[BeyondEarth] rock portraits: no WebGL", error);
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* As the scene's renderer (main.js). */
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.copy(PLACE).add(new THREE.Vector3(0, 0, 20));
    camera.lookAt(PLACE);
    /* One hard light from the Sun's direction, and almost nothing else --
     * 0.03 ambient so a night side is a shape, not a hole (chosen). */
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.2);
    sun.position.set(0, 0, 0);
    sun.target.position.copy(PLACE);
    scene.add(sun, sun.target, new THREE.AmbientLight(0xffffff, 0.03));
    const spots = layout ?? defaultLayout(records.length);
    /* Sizes: the biggest rock fills its cell; the others shrink with their
     * real diameter on a cube-root curve, so a 300 m rock beside a 38 km
     * one is small but visible. Not to scale -- the caption says so. */
    const biggest = Math.max(...records.map((r) => r.diameterKm));
    pieces = records.map((record, i) => {
      const portrait = buildSmallBodyPortrait(record);
      const holder = new THREE.Group();
      const tilt = new THREE.Group();
      tilt.rotation.set(0.35, 0, 0.25 * ((i % 2) ? 1 : -1));
      holder.add(tilt);
      tilt.add(portrait.mesh);
      const spot = spots[i];
      const scale = spot.r * (0.42 + 0.58 * Math.cbrt(record.diameterKm / biggest));
      holder.position.copy(PLACE).add(new THREE.Vector3(spot.x, spot.y, 0));
      holder.scale.setScalar(scale);
      scene.add(holder);
      /* Spin: one turn in 14-30 s, quicker for faster real rotators
       * (Aten 42 h turns slowest, a 2 h top fastest). Chosen. */
      const spin = (Math.PI * 2) / (14 + 16 * Math.min(1, Math.log10(Math.max(2, record.rotationHours ?? 6)) / 1.7));
      return { record, portrait, holder, spin, spot, scale };
    });
  }

  return {
    get failed() { return failed; },
    /** Draws the rocks into `ctx`, a `w` x `w` square; `t` in seconds. */
    draw(ctx, w, seconds, ratio = 1) {
      if (!renderer && !failed) build();
      if (failed) return false;
      const px = Math.round(w * ratio);
      if (px !== size) {
        size = px;
        renderer.setPixelRatio(1);
        renderer.setSize(px, px, false);
      }
      pieces.forEach((p) => { p.portrait.mesh.rotation.y = seconds * p.spin; });
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0, w, w);
      return true;
    },
    /** Where each rock sits on a `w`-wide canvas, for labels. */
    labels(w) {
      return pieces.map((p) => ({
        record: p.record,
        x: (0.5 + p.spot.x / 2) * w,
        y: (0.5 - p.spot.y / 2) * w + p.scale * w * 0.5 + 12,
      }));
    },
    dispose() {
      pieces.forEach((p) => p.portrait.dispose());
      pieces = [];
      renderer?.dispose();
      renderer?.forceContextLoss?.();
      renderer = null;
      scene = null;
    },
  };
}

/* Cells in the camera's -1..1 square: rows of up to three, label room
 * under each. `r` is the half-size a rock may take. */
function defaultLayout(n) {
  if (n <= 1) return [{ x: 0, y: 0.08, r: 0.55 }];
  if (n === 2) return [{ x: -0.5, y: 0.1, r: 0.36 }, { x: 0.5, y: 0.1, r: 0.36 }];
  if (n === 3) return [{ x: -0.48, y: 0.5, r: 0.3 }, { x: 0.48, y: 0.5, r: 0.3 }, { x: 0, y: -0.32, r: 0.3 }];
  if (n === 4) return [{ x: -0.48, y: 0.5, r: 0.3 }, { x: 0.48, y: 0.5, r: 0.3 }, { x: -0.48, y: -0.32, r: 0.3 }, { x: 0.48, y: -0.32, r: 0.3 }];
  const top = [{ x: -0.62, y: 0.5, r: 0.25 }, { x: 0, y: 0.5, r: 0.25 }, { x: 0.62, y: 0.5, r: 0.25 }];
  const bottom = n === 5
    ? [{ x: -0.34, y: -0.3, r: 0.25 }, { x: 0.34, y: -0.3, r: 0.25 }]
    : [{ x: -0.62, y: -0.3, r: 0.25 }, { x: 0, y: -0.3, r: 0.25 }, { x: 0.62, y: -0.3, r: 0.25 }];
  return [...top, ...bottom].slice(0, n);
}

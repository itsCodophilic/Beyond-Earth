import * as THREE from "three";
import { SOLAR_ORBIT_SCALE } from "../config/celestialScale.js";

/**
 * The Kirkwood gaps, marked on the scene's own asteroid belt.
 *
 * Round 38 (Prompts.md: "we have to explain our theory with reality, showing
 * the gaps in our asteroid belt's"). The board's "Kirkwood gaps & asteroid
 * families" view shows the real count of 861,399 numbered asteroids; this
 * puts the same structure where the viewer can see it, on the belt itself.
 *
 * The belt is drawn by `asteroidBelt.js`, which is frozen and is not touched.
 * It already leaves four empty lanes (its `isInsideKirkwoodGap`): at belt
 * radii 46.35, 48.72, 50.05 and 50.92 x SOLAR_ORBIT_SCALE, on its own linear
 * scale of 44 -> 2.2 AU and 52 -> 3.2 AU (`radiusToAU` there). Those are
 * 2.49, 2.79, 2.96 and 3.07 AU. The first three are the 3:1, 5:2 and 7:3
 * resonances with Jupiter (2.50, 2.82 and 2.96 AU); the fourth is a minor
 * lane at about 3.07 AU (near the 9:4 at 3.03), marked as such. The belt's
 * inner and outer edges sit where the 4:1 (2.06 AU, with the nu6 secular
 * resonance) and the 2:1 (3.28 AU) clear it, so the two edges are marked
 * too. Each ring is drawn exactly on the lane the belt leaves, not on the
 * textbook value, so what is marked is what is seen.
 */

const BELT_UNIT = SOLAR_ORBIT_SCALE;
const MARKS = [
  { r: 44.0, label: "Inner edge · 4:1 and ν6", colour: "#9fd0ff", edge: true },
  { r: 46.35, label: "3:1 gap · 2.50 AU", colour: "#ff8a6a" },
  { r: 48.72, label: "5:2 gap · 2.82 AU", colour: "#ff8a6a" },
  { r: 50.05, label: "7:3 gap · 2.96 AU", colour: "#ff8a6a" },
  { r: 50.92, label: "Narrow lane · 3.07 AU", colour: "#ffb98a", minor: true },
  { r: 52.0, label: "Outer edge · 2:1 at 3.28 AU", colour: "#9fd0ff", edge: true },
];

function labelSprite(text, colour) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "600 26px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = width;
  canvas.height = 40;
  ctx.font = font;
  ctx.fillStyle = "rgba(6, 10, 18, 0.72)";
  ctx.fillRect(0, 0, width, 40);
  ctx.fillStyle = colour;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, 21);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false, opacity: 0,
  }));
  /* 0.022 of the projection height: about 14 px text on a 760 px view. */
  const h = 0.022;
  sprite.scale.set((h * width) / 40, h, 1);
  sprite.center.set(0, 0.5);
  sprite.renderOrder = 40;
  sprite.raycast = () => {};
  return sprite;
}

/**
 * `parent` is the group the belt is drawn in (`asteroidBelt.system`), so the
 * rings share its frame exactly. Off until `show(true)`.
 */
export function createKirkwoodOverlay(parent) {
  const group = new THREE.Group();
  group.name = "Kirkwood gap marks";
  group.visible = false;
  const materials = [];
  const labels = [];
  MARKS.forEach((mark, i) => {
    const radius = mark.r * BELT_UNIT;
    const points = [];
    for (let k = 0; k <= 256; k += 1) {
      const a = (k / 256) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: mark.colour,
      dashSize: mark.edge ? 6 : 10,
      gapSize: mark.edge ? 6 : 4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    line.raycast = () => {};
    line.renderOrder = 39;
    group.add(line);
    materials.push({ material, base: mark.minor ? 0.45 : 0.85 });
    /* Labels a sixth of a turn apart round the belt, so wherever the camera
     * stands they do not stack (round 38 screenshot: at 0.19 rad apart they
     * piled up on the far side). */
    const a = 0.35 + i * ((Math.PI * 2) / MARKS.length);
    const sprite = labelSprite(mark.label, mark.colour);
    sprite.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    group.add(sprite);
    labels.push(sprite);
  });
  parent?.add(group);
  const state = { on: false, fade: 0 };
  return {
    group,
    get on() { return state.on; },
    show(on = true) { state.on = Boolean(on); if (state.on) group.visible = true; },
    update(dt = 1 / 60) {
      const target = state.on ? 1 : 0;
      if (state.fade === target && !group.visible) return;
      state.fade += (target - state.fade) * Math.min(1, dt * 4);
      if (Math.abs(state.fade - target) < 0.004) state.fade = target;
      group.visible = state.fade > 0.003;
      materials.forEach(({ material, base }) => { material.opacity = base * state.fade; });
      labels.forEach((sprite) => { sprite.material.opacity = state.fade; });
    },
  };
}

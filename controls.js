import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

export const state = {
  scrollProgress: 0,
  smoothProgress: 0,
  targetYaw: -0.55,
  targetPitch: 0.22,
  yaw: -0.55,
  pitch: 0.22,
  isDragging: false,
  lastPointer: { x: 0, y: 0 },
  pointerDownPosition: { x: 0, y: 0 },
  dragDistance: 0,
  focusedBody: null,
  hasCameraFocusPoint: false,
  cameraFocusPoint: new THREE.Vector3(),
};

let camera;
let raycaster;
let hoverTargets = [];
let scaleLabel;
let bodyLabel;
let bodyDetail;
let earth;
let progressBar;

export function initControls({ camera: cam, raycaster: rc, hoverTargets: targets, scaleLabel: scaleEl, bodyLabel: bodyEl, bodyDetail: detailEl, progressBar: progressEl, earth: earthPlanet }) {
  camera = cam;
  raycaster = rc;
  hoverTargets = targets;
  scaleLabel = scaleEl;
  bodyLabel = bodyEl;
  bodyDetail = detailEl;
  progressBar = progressEl;
  earth = earthPlanet;
  updateScrollProgress();
}

export function updateScrollProgress() {
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  state.scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;
  if (progressBar && progressBar.style) progressBar.style.width = `${state.scrollProgress * 100}%`;
}

export function getCameraDistance(progress) {
  const eased = progress * progress * (3 - 2 * progress);
  return THREE.MathUtils.lerp(4.8, 620, eased);
}

export function getFocusPoint(distance) {
  if (state.focusedBody) return state.focusedBody.getWorldPosition(new THREE.Vector3());
  if (distance < 18 && earth) return earth.getWorldPosition(new THREE.Vector3());
  return new THREE.Vector3(0, 0, 0);
}

export function updateScaleLabel(distance) {
  if (!scaleLabel) return;
  if (distance < 16) scaleLabel.textContent = "Earth orbit";
  else if (distance < 92) scaleLabel.textContent = "Inner solar system";
  else if (distance < 240) scaleLabel.textContent = "Outer planets";
  else scaleLabel.textContent = "Milky Way scale";
}

export function updateHoveredBody() {
  const named = getBodyAtPointer();
  if (bodyLabel) bodyLabel.textContent = named?.userData?.name ?? "Free drift";
  if (bodyDetail) bodyDetail.textContent = named?.userData?.detail ?? "Eight-planet solar system";
  document.body.classList.toggle("is-hovering-body", Boolean(named));
}

export function updatePointerFromEvent(event) {
  state.pointer = new THREE.Vector2((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
}

function findInteractiveObject(object) {
  while (object) {
    if (object.userData?.name) return object;
    object = object.parent;
  }
  return null;
}

export function getBodyAtPointer() {
  if (!raycaster || !state.pointer) return null;
  raycaster.setFromCamera(state.pointer, camera);
  const hit = raycaster.intersectObjects(hoverTargets, true)[0];
  return hit ? findInteractiveObject(hit.object) : null;
}

export function focusBody(body) {
  if (!body) {
    state.focusedBody = null;
    return;
  }
  state.focusedBody = state.focusedBody === body ? null : body;
  if (!state.focusedBody) return;

  if (bodyLabel) bodyLabel.textContent = body.userData.name;
  if (bodyDetail) bodyDetail.textContent = body.userData.detail ?? "Selected body";
  const radius = body.userData.orbitRadius ?? body.getWorldPosition(new THREE.Vector3()).length();
  const idealProgress = THREE.MathUtils.clamp(radius / 230, 0.035, 0.72);
  window.scrollTo({ top: idealProgress * (document.documentElement.scrollHeight - innerHeight), behavior: "smooth" });
}

export function setupEventHandlers() {
  addEventListener("scroll", updateScrollProgress, { passive: true });

  addEventListener("pointermove", (event) => {
    updatePointerFromEvent(event);
    if (state.isDragging) {
      state.dragDistance = Math.max(
        state.dragDistance,
        Math.hypot(event.clientX - state.pointerDownPosition.x, event.clientY - state.pointerDownPosition.y),
      );
      state.targetYaw -= (event.clientX - state.lastPointer.x) * 0.006;
      state.targetPitch -= (event.clientY - state.lastPointer.y) * 0.004;
      state.targetPitch = THREE.MathUtils.clamp(state.targetPitch, -1.1, 1.1);
    } else {
      state.targetYaw += state.pointer.x * 0.0005;
      state.targetPitch += state.pointer.y * 0.00025;
    }
  });

  addEventListener("pointerdown", (event) => {
    updatePointerFromEvent(event);
    state.isDragging = true;
    state.dragDistance = 0;
    state.pointerDownPosition = { x: event.clientX, y: event.clientY };
    state.lastPointer = { x: event.clientX, y: event.clientY };
  });

  addEventListener("pointerup", (event) => {
    updatePointerFromEvent(event);
    state.isDragging = false;
    if (event.target.closest?.(".hud")) return;
    if (state.dragDistance > 12) return;
    const body = getBodyAtPointer();
    if (body) focusBody(body);
    else focusBody(null);
  });

  addEventListener("pointercancel", () => {
    state.isDragging = false;
  });

  addEventListener("keydown", (event) => {
    if (event.key === "Escape") state.focusedBody = null;
    if (event.key === "ArrowLeft") state.targetYaw += 0.18;
    if (event.key === "ArrowRight") state.targetYaw -= 0.18;
    if (event.key === "ArrowUp") state.targetPitch = THREE.MathUtils.clamp(state.targetPitch + 0.12, -1.1, 1.1);
    if (event.key === "ArrowDown") state.targetPitch = THREE.MathUtils.clamp(state.targetPitch - 0.12, -1.1, 1.1);
  });
}

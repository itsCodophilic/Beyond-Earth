/**
 * Adaptive performance controller for the Beyond Earth WebGL experience.
 *
 * The manager deliberately separates three concerns:
 *
 * 1. `capacityName` — the maximum asset/geometry capacity created for this
 *    browser session. This is estimated from hardware and WebGL capabilities.
 * 2. `qualityName` — the runtime quality currently active. It may move below
 *    the capacity tier when sustained frame pressure is detected and recover up
 *    to the capacity tier after stable headroom.
 * 3. `pixelRatio` — the drawing-buffer density. It is calculated separately
 *    from viewport size and devicePixelRatio so a high-DPI screen does not
 *    incorrectly force lower-detail assets or an unnecessarily huge buffer.
 *
 * Navigation, camera maths, distance calculations, content, and controls are
 * never changed by this controller.
 */

export const PERFORMANCE_PRESETS = Object.freeze({
  high: Object.freeze({
    maxPixelRatio: 2,
    framebufferPixelBudget: 5_800_000,
    minimumPixelRatio: 1,
    environmentQuality: "high",
    taskIntervals: Object.freeze({
      distanceReadout: 1 / 30,
      inspectionUi: 1 / 45,
      hoverVisual: 1 / 60,
      planetVisuals: 0,
      satellites: 0,
      sun: 0,
      asteroids: 0,
      environment: 0,
    }),
    hoverDelayMs: 18,
  }),
  medium: Object.freeze({
    maxPixelRatio: 1.45,
    framebufferPixelBudget: 3_800_000,
    minimumPixelRatio: 0.9,
    environmentQuality: "medium",
    taskIntervals: Object.freeze({
      distanceReadout: 1 / 24,
      inspectionUi: 1 / 30,
      hoverVisual: 1 / 40,
      planetVisuals: 1 / 40,
      satellites: 0,
      sun: 1 / 36,
      asteroids: 1 / 30,
      environment: 1 / 40,
    }),
    hoverDelayMs: 32,
  }),
  low: Object.freeze({
    maxPixelRatio: 1.05,
    framebufferPixelBudget: 2_200_000,
    minimumPixelRatio: 0.75,
    environmentQuality: "low",
    taskIntervals: Object.freeze({
      distanceReadout: 1 / 18,
      inspectionUi: 1 / 24,
      hoverVisual: 1 / 30,
      planetVisuals: 1 / 30,
      satellites: 0,
      sun: 1 / 24,
      asteroids: 1 / 20,
      environment: 1 / 28,
    }),
    hoverDelayMs: 52,
  }),
});

const QUALITY_ORDER = Object.freeze(["low", "medium", "high"]);
const SOFTWARE_RENDERER_PATTERN = /swiftshader|llvmpipe|software raster|software renderer|basic render driver|mesa offscreen/i;
const MODERN_GPU_HINT_PATTERN = /\b(?:rtx|radeon\s+rx|intel\s+arc|apple\s+m\d|apple\s+gpu)\b/i;

function clampQualityIndex(index) {
  return Math.max(0, Math.min(QUALITY_ORDER.length - 1, index));
}

function finitePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function safeMatchMedia(windowObject, query) {
  try {
    return Boolean(windowObject?.matchMedia?.(query)?.matches);
  } catch {
    return false;
  }
}

function readRendererCapabilities(renderer) {
  const gl = renderer?.getContext?.() ?? null;
  let maxTextureSize = finitePositiveNumber(renderer?.capabilities?.maxTextureSize) ?? 8192;
  let maxRenderbufferSize = maxTextureSize;
  let maxSamples = 0;
  const isWebGL2 = Boolean(renderer?.capabilities?.isWebGL2);

  if (gl) {
    try {
      maxTextureSize = finitePositiveNumber(gl.getParameter(gl.MAX_TEXTURE_SIZE))
        ?? maxTextureSize;
      maxRenderbufferSize = finitePositiveNumber(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
        ?? maxRenderbufferSize;
      if (isWebGL2 && gl.MAX_SAMPLES !== undefined) {
        maxSamples = finitePositiveNumber(gl.getParameter(gl.MAX_SAMPLES)) ?? 0;
      }
    } catch {
      // Keep the conservative capability defaults above.
    }
  }

  let gpuRenderer = "";
  if (gl) {
    try {
      const debugInfo = gl.getExtension?.("WEBGL_debug_renderer_info");
      if (debugInfo) {
        gpuRenderer = String(
          gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "",
        );
      }
    } catch {
      // Privacy settings may intentionally block this extension. Unknown is neutral.
    }
  }

  return {
    gl,
    maxTextureSize,
    maxRenderbufferSize,
    maxSamples,
    isWebGL2,
    gpuRenderer,
  };
}

/**
 * Estimates the maximum asset capacity that may be created for the session.
 *
 * Missing or privacy-capped signals are intentionally neutral. Viewport size,
 * devicePixelRatio, and reduced-motion preferences are not hardware-capacity
 * signals and therefore do not lower this result.
 */
export function detectHardwareCapacity({
  renderer,
  navigatorObject = globalThis.navigator,
} = {}) {
  const cores = finitePositiveNumber(navigatorObject?.hardwareConcurrency);
  const memory = finitePositiveNumber(navigatorObject?.deviceMemory);
  const {
    maxTextureSize,
    maxRenderbufferSize,
    maxSamples,
    isWebGL2,
    gpuRenderer,
  } = readRendererCapabilities(renderer);

  let score = 0;
  let forceLow = false;

  if (cores !== null) {
    if (cores <= 2) forceLow = true;
    else if (cores <= 4) score -= 2;
    else if (cores <= 6) score -= 1;
    else if (cores >= 12) score += 3;
    else if (cores >= 8) score += 2;
  }

  // deviceMemory is approximate, capped by some browsers, and absent in others.
  // It is useful only as a weak optional signal and unknown never means "6 GB".
  if (memory !== null) {
    if (memory <= 2) forceLow = true;
    else if (memory <= 3) score -= 2;
    else if (memory <= 4) score -= 1;
    else if (memory >= 8) score += 1;
  }

  if (maxTextureSize < 4096) forceLow = true;
  else if (maxTextureSize < 8192) score -= 2;
  else if (maxTextureSize >= 16384) score += 1;

  if (maxRenderbufferSize < 4096) forceLow = true;
  else if (maxRenderbufferSize < 8192) score -= 1;
  else if (maxRenderbufferSize >= 16384) score += 1;

  score += isWebGL2 ? 0.5 : -0.5;
  if (maxSamples >= 4) score += 0.25;

  // The unmasked renderer string is optional and may be unavailable for privacy.
  // It is used only as a soft hint, except for explicit software renderers.
  if (SOFTWARE_RENDERER_PATTERN.test(gpuRenderer)) forceLow = true;
  else if (MODERN_GPU_HINT_PATTERN.test(gpuRenderer)) score += 1;

  if (forceLow) return "low";
  if (score <= -1.5) return "low";
  if (score >= 3.5) return "high";
  return "medium";
}

/**
 * Chooses the conservative runtime starting point independently of capacity.
 * A high-capacity touch/mobile form factor starts at Medium but retains High as
 * its recovery ceiling. Real measured frame time remains the final authority.
 */
export function detectInitialRuntimeQuality({
  capacityName = "medium",
  navigatorObject = globalThis.navigator,
  windowObject = globalThis.window,
} = {}) {
  const capacityIndex = QUALITY_ORDER.indexOf(capacityName);
  if (capacityIndex <= 0) return "low";
  if (capacityIndex === 1) return "medium";

  const coarsePointer = safeMatchMedia(windowObject, "(pointer: coarse)");
  const hasFinePointer = safeMatchMedia(windowObject, "(any-pointer: fine)");
  const coarseOnly = coarsePointer && !hasFinePointer;
  const mobileFormFactor = Boolean(navigatorObject?.userAgentData?.mobile);
  return coarseOnly || mobileFormFactor ? "medium" : "high";
}

/** Backward-compatible alias retained for existing imports and tests. */
export function detectInitialPerformanceTier(options = {}) {
  return detectHardwareCapacity(options);
}

/**
 * Calculates drawing-buffer density independently from asset capacity.
 *
 * The pixel budget limits fullscreen fill-rate on large/high-DPI viewports,
 * while the renderer's maximum renderbuffer dimension prevents invalid buffer
 * sizes. A high-capacity device can therefore keep High assets at a lower DPR.
 */
export function calculatePixelRatioLimit({
  qualityName = "medium",
  width = globalThis.window?.innerWidth ?? 1,
  height = globalThis.window?.innerHeight ?? 1,
  requestedPixelRatio = globalThis.window?.devicePixelRatio ?? 1,
  renderer = null,
} = {}) {
  const preset = PERFORMANCE_PRESETS[qualityName] ?? PERFORMANCE_PRESETS.medium;
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  const requested = Math.max(0.5, Number(requestedPixelRatio) || 1);
  const cssPixelCount = safeWidth * safeHeight;
  const budgetRatio = Math.sqrt(
    preset.framebufferPixelBudget / Math.max(1, cssPixelCount),
  );

  const { maxRenderbufferSize } = readRendererCapabilities(renderer);
  const dimensionLimit = Math.min(
    maxRenderbufferSize / safeWidth,
    maxRenderbufferSize / safeHeight,
  );

  // Do not force a browser requesting < 1 DPR upward. For normal DPR >= 1,
  // preserve at least the tier's floor unless the GPU dimension limit forbids it.
  const requestedFloor = Math.min(requested, preset.minimumPixelRatio);
  const viewportLimit = Math.max(requestedFloor, budgetRatio);

  return Math.max(
    0.5,
    Math.min(
      requested,
      preset.maxPixelRatio,
      viewportLimit,
      dimensionLimit,
    ),
  );
}

export class PerformanceManager {
  constructor({
    renderer,
    hardwareCapacity = null,
    initialQuality = null,
    reducedMotion = false,
  } = {}) {
    if (!renderer) throw new Error("PerformanceManager requires a WebGLRenderer.");

    this.renderer = renderer;
    this.reducedMotion = Boolean(reducedMotion);
    this.capacityName = hardwareCapacity
      ?? detectHardwareCapacity({ renderer });
    if (!PERFORMANCE_PRESETS[this.capacityName]) this.capacityName = "medium";
    this.hardwareCapacity = this.capacityName;

    this.maximumQualityIndex = QUALITY_ORDER.indexOf(this.capacityName);
    const requestedRuntimeQuality = initialQuality
      ?? detectInitialRuntimeQuality({ capacityName: this.capacityName });
    const requestedRuntimeIndex = QUALITY_ORDER.indexOf(requestedRuntimeQuality);
    this.currentQualityIndex = Math.min(
      requestedRuntimeIndex >= 0 ? requestedRuntimeIndex : this.maximumQualityIndex,
      this.maximumQualityIndex,
    );
    this.qualityName = QUALITY_ORDER[this.currentQualityIndex];
    this.preset = PERFORMANCE_PRESETS[this.qualityName];

    this.listeners = new Set();
    this.taskAccumulators = new Map();
    this.width = globalThis.window?.innerWidth ?? 1;
    this.height = globalThis.window?.innerHeight ?? 1;
    this.requestedPixelRatio = globalThis.window?.devicePixelRatio || 1;
    this.pixelRatio = 1;
    this.renderScale = 1;

    this.frameTimeEma = 1000 / 60;
    this.sampledSeconds = 0;
    this.evaluationSeconds = 0;
    this.warmupSeconds = 4.5;
    this.cooldownSeconds = 0;
    this.slowWindows = 0;
    this.fastWindows = 0;
    this.interactionUntil = 0;
    this.longTaskPressure = 0;

    this.longTaskObserver = null;
    if (typeof PerformanceObserver !== "undefined") {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          this.longTaskPressure = Math.min(
            6,
            this.longTaskPressure + list.getEntries().length,
          );
        });
        this.longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        this.longTaskObserver = null;
      }
    }

    this.resize(this.width, this.height, this.requestedPixelRatio);
  }

  subscribe(listener, { immediate = true } = {}) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    if (immediate) listener(this.snapshot("initial"));
    return () => this.listeners.delete(listener);
  }

  snapshot(reason = "runtime") {
    return Object.freeze({
      capacityName: this.capacityName,
      hardwareCapacity: this.capacityName,
      qualityName: this.qualityName,
      runtimeQuality: this.qualityName,
      preset: this.preset,
      requestedPixelRatio: this.requestedPixelRatio,
      pixelRatio: this.pixelRatio,
      renderScale: this.renderScale,
      framebufferPixels: Math.round(
        this.width * this.height * this.pixelRatio * this.pixelRatio,
      ),
      reason,
    });
  }

  markInteraction(durationMs = 1200) {
    this.interactionUntil = Math.max(
      this.interactionUntil,
      performance.now() + Math.max(0, durationMs),
    );
  }

  get isInteracting() {
    return performance.now() < this.interactionUntil;
  }

  resize(width, height, requestedPixelRatio = globalThis.window?.devicePixelRatio || 1) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.requestedPixelRatio = Math.max(0.5, Number(requestedPixelRatio) || 1);
    this.pixelRatio = calculatePixelRatioLimit({
      qualityName: this.qualityName,
      width: this.width,
      height: this.height,
      requestedPixelRatio: this.requestedPixelRatio,
      renderer: this.renderer,
    });
    this.renderScale = this.pixelRatio / this.requestedPixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    return this.pixelRatio;
  }

  /**
   * Returns accumulated elapsed seconds when a task should run, or zero when it
   * should wait. Passing the accumulated delta keeps time-based motion correct
   * even when expensive visual systems update less often than the camera.
   */
  consumeTaskDelta(taskName, deltaSeconds) {
    const interval = this.preset.taskIntervals[taskName] ?? 0;
    if (interval <= 0) return deltaSeconds;

    const accumulated = (this.taskAccumulators.get(taskName) ?? 0) + deltaSeconds;
    if (accumulated + 1e-8 < interval) {
      this.taskAccumulators.set(taskName, accumulated);
      return 0;
    }

    this.taskAccumulators.set(taskName, 0);
    return accumulated;
  }

  getHoverDelayMs() {
    return this.preset.hoverDelayMs;
  }

  startMonitoring() {
    this.frameTimeEma = 1000 / 60;
    this.sampledSeconds = 0;
    this.evaluationSeconds = 0;
    this.cooldownSeconds = 0;
    this.slowWindows = 0;
    this.fastWindows = 0;
    this.longTaskPressure = 0;
    this.taskAccumulators.clear();
  }

  recordFrame(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || deltaSeconds > 0.25) return;

    const frameMs = deltaSeconds * 1000;
    const alpha = frameMs > this.frameTimeEma ? 0.10 : 0.035;
    this.frameTimeEma += (frameMs - this.frameTimeEma) * alpha;
    this.sampledSeconds += deltaSeconds;
    this.evaluationSeconds += deltaSeconds;
    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - deltaSeconds);
    this.longTaskPressure = Math.max(0, this.longTaskPressure - deltaSeconds * 0.45);

    if (this.sampledSeconds < this.warmupSeconds || this.evaluationSeconds < 2.4) return;
    this.evaluationSeconds = 0;
    this.evaluateQuality();
  }

  evaluateQuality() {
    const fps = 1000 / Math.max(1, this.frameTimeEma);
    const underLoad = this.longTaskPressure >= 2;
    const downgradeThreshold = this.qualityName === "high" ? 47 : 38;
    const upgradeThreshold = this.qualityName === "low" ? 53 : 57;

    if (fps < downgradeThreshold || underLoad) {
      this.slowWindows += 1;
      this.fastWindows = 0;
    } else if (fps > upgradeThreshold && !this.isInteracting && !underLoad) {
      this.fastWindows += 1;
      this.slowWindows = Math.max(0, this.slowWindows - 1);
    } else {
      this.slowWindows = Math.max(0, this.slowWindows - 1);
      this.fastWindows = Math.max(0, this.fastWindows - 1);
    }

    if (this.cooldownSeconds > 0) return;

    if (this.slowWindows >= 2 && this.currentQualityIndex > 0) {
      this.setQualityByIndex(this.currentQualityIndex - 1, "sustained-frame-pressure");
      return;
    }

    if (
      this.fastWindows >= 4
      && this.currentQualityIndex < this.maximumQualityIndex
    ) {
      this.setQualityByIndex(this.currentQualityIndex + 1, "sustained-headroom");
    }
  }

  setQuality(qualityName, reason = "manual") {
    const requestedIndex = QUALITY_ORDER.indexOf(qualityName);
    if (requestedIndex < 0) return false;
    return this.setQualityByIndex(requestedIndex, reason);
  }

  setQualityByIndex(index, reason) {
    const nextIndex = Math.min(
      clampQualityIndex(index),
      this.maximumQualityIndex,
    );
    if (nextIndex === this.currentQualityIndex) return false;

    this.currentQualityIndex = nextIndex;
    this.qualityName = QUALITY_ORDER[nextIndex];
    this.preset = PERFORMANCE_PRESETS[this.qualityName];
    this.slowWindows = 0;
    this.fastWindows = 0;
    this.cooldownSeconds = 8;
    this.taskAccumulators.clear();
    this.resize(this.width, this.height, this.requestedPixelRatio);

    const snapshot = this.snapshot(reason);
    this.listeners.forEach((listener) => listener(snapshot));
    return true;
  }

  dispose() {
    this.longTaskObserver?.disconnect();
    this.listeners.clear();
    this.taskAccumulators.clear();
  }
}

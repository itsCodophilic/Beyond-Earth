/**
 * Opt-in performance overlay.
 *
 * The cinematic experience is GPU-bound in ways that differ enormously between
 * machines, so this panel exists to turn "it feels stuttery" into numbers that
 * can be compared before and after a change, on the machine that matters.
 *
 * It is inert unless explicitly enabled, either with `?perf=1` in the URL or by
 * pressing Shift+P. While disabled it performs no sampling, allocates no DOM,
 * and costs one boolean test per frame.
 *
 * Reported values:
 *   FPS / frame ms  - measured from the real render loop, not from rAF alone.
 *                     p95 and p99 matter far more than the average: a steady 60
 *                     with occasional 90 ms frames reads as stutter, while a
 *                     steady 50 reads as smooth.
 *   draw calls      - renderer.info.render.calls for the last frame.
 *   triangles       - geometry actually submitted, after culling.
 *   geometries /
 *   textures        - live GPU resources currently held by the renderer.
 *   est. VRAM       - unique textures reachable from the scene graph, summed as
 *                     width x height x 4 bytes and multiplied by 1.333 for the
 *                     mip chain. This is the number that silently exceeds the
 *                     budget on integrated and unified-memory GPUs, where the
 *                     browser then evicts and re-uploads textures continuously.
 */

const SAMPLE_WINDOW = 240;
const SCENE_SCAN_INTERVAL_MS = 1000;

function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor(sortedValues.length * fraction)),
  );
  return sortedValues[index];
}

function formatMegabytes(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  return `${Math.round(bytes / 1048576)} MB`;
}

export function createPerformanceHud({ renderer, scene } = {}) {
  const enabledByQuery = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).has("perf");

  let enabled = false;
  let element = null;
  let frameTimes = [];
  let lastFrameAt = 0;
  let lastSceneScanAt = -Infinity;
  let estimatedTextureBytes = 0;
  let uniqueTextureCount = 0;
  let longTaskCount = 0;
  let longTaskMs = 0;
  let observer = null;

  function ensureElement() {
    if (element) return element;
    element = document.createElement("div");
    element.className = "performance-hud";
    element.setAttribute("aria-hidden", "true");
    // Inline styles keep this diagnostic entirely self-contained; it must never
    // depend on, or accidentally restyle, the cinematic interface.
    Object.assign(element.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      zIndex: "99999",
      padding: "10px 12px",
      font: "11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace",
      color: "#cfe6ff",
      background: "rgba(4, 10, 22, 0.82)",
      border: "1px solid rgba(120, 180, 255, 0.28)",
      borderRadius: "8px",
      pointerEvents: "none",
      whiteSpace: "pre",
      backdropFilter: "blur(6px)",
    });
    document.body.append(element);
    return element;
  }

  function startObserving() {
    if (observer || typeof PerformanceObserver === "undefined") return;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCount += 1;
          longTaskMs += entry.duration;
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch (error) {
      observer = null;
    }
  }

  /**
   * Walks the scene once per second and sums every distinct texture it can
   * reach. Counting unique textures matters: a shared map referenced by two
   * hundred moons occupies GPU memory exactly once.
   */
  function scanSceneTextures() {
    if (!scene) return;
    const seen = new Set();
    let bytes = 0;
    scene.traverse((object) => {
      const material = object.material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const entry of materials) {
        if (!entry) continue;
        for (const value of Object.values(entry)) {
          if (!value || !value.isTexture || seen.has(value)) continue;
          seen.add(value);
          const image = value.image;
          const width = image?.width ?? 0;
          const height = image?.height ?? 0;
          if (!width || !height) continue;
          // RGBA8 upload plus a full mip chain.
          bytes += width * height * 4 * (value.generateMipmaps === false ? 1 : 1.3333);
        }
        if (entry.uniforms) {
          for (const uniform of Object.values(entry.uniforms)) {
            const value = uniform?.value;
            if (!value || !value.isTexture || seen.has(value)) continue;
            seen.add(value);
            const width = value.image?.width ?? 0;
            const height = value.image?.height ?? 0;
            if (!width || !height) continue;
            bytes += width * height * 4 * (value.generateMipmaps === false ? 1 : 1.3333);
          }
        }
      }
    });
    estimatedTextureBytes = bytes;
    uniqueTextureCount = seen.size;
  }

  function setEnabled(next) {
    enabled = next;
    if (!enabled) {
      element?.remove();
      element = null;
      frameTimes = [];
      lastFrameAt = 0;
      return;
    }
    ensureElement();
    startObserving();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (event) => {
      if (event.shiftKey && (event.key === "P" || event.key === "p")) {
        setEnabled(!enabled);
      }
    });
  }
  if (enabledByQuery) setEnabled(true);

  return {
    isEnabled: () => enabled,
    toggle: () => setEnabled(!enabled),

    /** Called once per rendered frame, immediately after renderer.render(). */
    update(frameTime = performance.now()) {
      if (!enabled) return;

      if (lastFrameAt > 0) {
        frameTimes.push(frameTime - lastFrameAt);
        if (frameTimes.length > SAMPLE_WINDOW) frameTimes.shift();
      }
      lastFrameAt = frameTime;

      if (frameTime - lastSceneScanAt > SCENE_SCAN_INTERVAL_MS) {
        lastSceneScanAt = frameTime;
        scanSceneTextures();
      }

      // Repaint the panel at ~4 Hz. Updating text every frame would make the
      // diagnostic a measurable cost in its own right.
      if (frameTimes.length % 15 !== 0 || !element) return;

      const sorted = [...frameTimes].sort((a, b) => a - b);
      const p50 = percentile(sorted, 0.5);
      const p95 = percentile(sorted, 0.95);
      const p99 = percentile(sorted, 0.99);
      const info = renderer?.info;
      const memory = info?.memory;
      const render = info?.render;

      element.textContent = [
        `fps        ${p50 > 0 ? (1000 / p50).toFixed(1).padStart(6) : "     -"}`,
        `frame ms   ${p50.toFixed(1).padStart(6)}  p95 ${p95.toFixed(1)}  p99 ${p99.toFixed(1)}`,
        `draw calls ${String(render?.calls ?? "-").padStart(6)}`,
        `triangles  ${String(render?.triangles ?? "-").padStart(6)}`,
        `geometries ${String(memory?.geometries ?? "-").padStart(6)}`,
        `textures   ${String(memory?.textures ?? "-").padStart(6)}   unique ${uniqueTextureCount}`,
        `est. VRAM  ${formatMegabytes(estimatedTextureBytes).padStart(6)}`,
        `long tasks ${String(longTaskCount).padStart(6)}  ${Math.round(longTaskMs)} ms total`,
        ``,
        `shift+P to hide`,
      ].join("\n");
    },
  };
}

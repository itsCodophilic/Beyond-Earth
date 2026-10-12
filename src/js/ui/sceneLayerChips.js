/**
 * Small notes that say a layer is switched on in the scene -- the solar
 * wind, a planet's magnetosphere -- each with the one button that switches
 * it off again. Final round: these layers are opened from the board's
 * explanations and the dossier, which then close, so the scene itself has
 * to say what is on and how to take it away (the same reasoning as the
 * comet placement note, cometPlacementChip.js).
 *
 * A fixed stack under the top-right controls; no timers, no per-frame work.
 */
export function createSceneLayerChips() {
  const stack = document.createElement("div");
  stack.className = "scene-layers";
  document.body.append(stack);
  ["pointerdown", "pointerup", "click", "dblclick"].forEach((type) => {
    stack.addEventListener(type, (event) => event.stopPropagation());
  });
  const chips = new Map();

  function show(id, text, { button = "Hide", onHide } = {}) {
    let chip = chips.get(id);
    if (!chip) {
      const node = document.createElement("div");
      node.className = "comet-placement scene-layers__chip";
      node.setAttribute("role", "status");
      const words = document.createElement("p");
      words.className = "comet-placement__text";
      const off = document.createElement("button");
      off.type = "button";
      off.className = "comet-placement__back";
      node.append(words, off);
      stack.append(node);
      chip = { node, words, off, onHide: null };
      off.addEventListener("click", () => {
        const fn = chip.onHide;
        hide(id);
        fn?.();
      });
      chips.set(id, chip);
    }
    chip.words.textContent = text;
    chip.off.textContent = button;
    chip.onHide = onHide ?? null;
  }

  function hide(id) {
    const chip = chips.get(id);
    if (!chip) return;
    chip.node.remove();
    chips.delete(id);
  }

  /* Round 38, second pass (Prompts.md: "hide, done or any button which we
   * get via dashboard ... should also be gone when clicked escape, the
   * scene should also be gone"): every note at once, each switching its
   * layer off as its own button would. Returns how many there were. */
  function hideAll() {
    const all = [...chips.entries()];
    all.forEach(([id, chip]) => {
      const fn = chip.onHide;
      hide(id);
      try { fn?.(); } catch { /* one layer failing must not keep the others on */ }
    });
    return all.length;
  }

  return { show, hide, hideAll, has: (id) => chips.has(id), get count() { return chips.size; } };
}

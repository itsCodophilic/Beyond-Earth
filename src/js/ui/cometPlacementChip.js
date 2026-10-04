/**
 * The note that says a comet is not where today's date puts it (round 7).
 *
 * "Fly to" from a comet's glow view takes the comet as the viewer left it:
 * placed on its real orbit at the distance they chose, glowing that much
 * (`placeCometAt` in smallBodies.js). That is a change to the scene, so it
 * is said on screen for as long as it is true, with the one way back. One
 * comet at a time: placing another first returns this one.
 *
 * A fixed chip under the top-right controls. No timers, no per-frame work:
 * it changes only when a comet is placed or returned.
 */
export function createCometPlacementChip({ onReturn }) {
  const chip = document.createElement("div");
  chip.className = "comet-placement";
  chip.setAttribute("role", "status");
  chip.hidden = true;
  const text = document.createElement("p");
  text.className = "comet-placement__text";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "comet-placement__back";
  back.textContent = "Back to today";
  chip.append(text, back);
  document.body.append(chip);
  /* Its clicks are its own. Without this a press on "Back to today" also
   * reached the scene's pointerup, which read it as a click into empty
   * space and left the comet -- it behaved like Escape (round 8). */
  ["pointerdown", "pointerup", "click", "dblclick"].forEach((type) => {
    chip.addEventListener(type, (event) => event.stopPropagation());
  });

  let current = null;

  back.addEventListener("click", () => {
    if (!current) return;
    const name = current;
    hide();
    onReturn?.(name);
  });

  function show(name, au, strength) {
    current = name;
    const pct = Math.round(Math.max(0, Math.min(1, strength)) * 100);
    const auText = au < 10 ? au.toFixed(2) : au < 1000 ? au.toFixed(1) : Math.round(au).toLocaleString("en-GB");
    text.textContent = `${name} was placed where you set it — ${auText} AU from the Sun, ${pct}% glow — and carries on along its orbit from there.`;
    back.setAttribute("aria-label", `Put ${name} back where it is today`);
    chip.hidden = false;
  }

  function hide() {
    current = null;
    chip.hidden = true;
  }

  return { show, hide, get current() { return current; } };
}

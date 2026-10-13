/**
 * The replay button (round 69, the owner: "give a play button to repeat audio
 * in info cards, space dictionary, in dashboard").
 *
 * A small round button: a speaker when she is quiet, moving bars while she is
 * saying this button's line. Pressing it plays the line again, or stops it if
 * it is playing.
 *
 * Buttons carry their line in data-line. One listener (installed with the
 * first button) restyles every button on the page when she starts or stops,
 * so cards that are thrown away (the dictionary rebuilds its cards on every
 * opening) leave nothing subscribed behind.
 */
import { toggleNarration, onNarration, currentNarration } from "../audio/narrationBus.js";

const ICON = `
  <svg class="narr-btn__speaker" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor"/>
    <path d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
  <span class="narr-btn__bars" aria-hidden="true"><i></i><i></i><i></i></span>`;

function paint(button, speaking) {
  const line = button.dataset.line || "";
  const on = Boolean(line) && speaking === line;
  button.classList.toggle("is-speaking", on);
  button.hidden = !line;
  button.setAttribute("aria-pressed", on ? "true" : "false");
  const label = button.dataset.label || "Hear this";
  button.setAttribute("aria-label", on ? "Stop the narration" : label);
  button.title = on ? "Stop" : label;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  onNarration((speaking) => {
    document.querySelectorAll(".narr-btn").forEach((button) => paint(button, speaking));
  });
}

/** A replay button for one line. `setLine` changes it later (the dossier reuses one). */
export function createNarrationButton(lineId = null, { label = "Hear this", className = "" } = {}) {
  install();
  const button = document.createElement("button");
  button.type = "button";
  button.className = `narr-btn ${className}`.trim();
  button.innerHTML = ICON;
  button.dataset.label = label;
  button.dataset.line = lineId ?? "";

  // The button lives inside clickable cards and scenes: its press is its own.
  ["pointerdown", "pointerup", "mousedown", "dblclick"].forEach((type) => {
    button.addEventListener(type, (event) => event.stopPropagation());
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.line) toggleNarration(button.dataset.line);
  });
  paint(button, currentNarration());

  return {
    element: button,
    setLine(next) {
      button.dataset.line = next ?? "";
      paint(button, currentNarration());
    },
  };
}

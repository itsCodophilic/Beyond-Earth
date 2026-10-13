/**
 * How the interface asks the narrator to speak (round 69).
 *
 * UI modules (the board, the dictionary, the dossier, the views) do not hold
 * the narrator; they post these window events, and main.js -- which owns the
 * soundscape and the narrator -- answers them and posts back what she is
 * saying, so replay buttons can show it.
 *
 *   beyond-earth:narrate        { id }        say this line (stops any other)
 *   beyond-earth:narrate-toggle { id }        say it, or stop it if it is playing
 *   beyond-earth:narrate-stop   { id|prefix } stop, if what she says matches
 *   beyond-earth:narration      { id|null }   what she is saying now (from main.js)
 */
let speaking = null;
const listeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beyond-earth:narration", (event) => {
    speaking = event.detail?.id ?? null;
    listeners.forEach((listener) => listener(speaking));
  });
}

const post = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));

/** Say a line now. */
export function narrate(id) {
  if (id) post("beyond-earth:narrate", { id });
}

/** Say a line, or stop it if it is the one playing (replay buttons). */
export function toggleNarration(id) {
  if (id) post("beyond-earth:narrate-toggle", { id });
}

/**
 * Stop her -- only if she is saying `id`, or a line starting with `prefix`
 * (e.g. "topic:"). With neither, stop whatever she says.
 */
export function stopNarration({ id = null, prefix = null } = {}) {
  post("beyond-earth:narrate-stop", { id, prefix });
}

export const currentNarration = () => speaking;

export function onNarration(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

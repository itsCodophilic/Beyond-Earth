/**
 * Round 75 (the owner: "inspect should be disabled, and selecting words or
 * anything -- people use developer tools"). Turns off, for visitors:
 *   - the right-click menu (and with it "Inspect" and "View page source");
 *   - the developer-tools and view-source shortcuts: F12, Ctrl+Shift+I/J/C/K
 *     (Windows, Linux), Cmd+Option+I/J/C/U (Mac), Ctrl+U;
 *   - Save page (Ctrl/Cmd+S) and Select all (Ctrl/Cmd+A);
 *   - selecting, copying and dragging text or images (with the user-select
 *     rules in src/css/page-guard.css).
 * Search fields and other inputs keep selection, copy and paste, so the
 * board and the events search still work normally.
 *
 * This is a deterrent, not a lock: a browser's own menu can still open its
 * developer tools, and a published site's files can always be read. It stops
 * the casual right-click / F12. On localhost it stays off, so working on the
 * site is not blocked.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", ""]);

function isEditable(target) {
  const el = target instanceof Element ? target : target?.parentElement;
  return Boolean(el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

function isBlockedShortcut(event) {
  const code = event.code;
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === "F12" || code === "F12") return true;
  // Ctrl+Shift+I/J/C/K -- Chrome, Edge, Firefox on Windows and Linux.
  if (event.ctrlKey && event.shiftKey && ["KeyI", "KeyJ", "KeyC", "KeyK"].includes(code)) return true;
  // Cmd+Option+I/J/C/U -- the same tools on a Mac (Option changes event.key, so code is used).
  if (event.metaKey && event.altKey && ["KeyI", "KeyJ", "KeyC", "KeyU"].includes(code)) return true;
  // Cmd+Shift+C -- Safari's element picker.
  if (event.metaKey && event.shiftKey && code === "KeyC") return true;
  // View source, save page.
  if (mod && !event.shiftKey && !event.altKey && (code === "KeyU" || code === "KeyS")) return true;
  // Select all, outside a text field.
  if (mod && !event.shiftKey && !event.altKey && code === "KeyA" && !isEditable(event.target)) return true;
  return false;
}

export function startPageGuard() {
  if (LOCAL_HOSTS.has(location.hostname)) return false;
  document.documentElement.classList.add("is-page-guarded");

  const block = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  // Only the menu is stopped; the page's own right-click handling still runs.
  addEventListener("contextmenu", (event) => event.preventDefault(), { capture: true });
  addEventListener("keydown", (event) => {
    if (isBlockedShortcut(event)) block(event);
  }, { capture: true });
  for (const type of ["selectstart", "copy", "cut", "dragstart"]) {
    addEventListener(type, (event) => {
      if (!isEditable(event.target)) event.preventDefault();
    }, { capture: true });
  }
  return true;
}

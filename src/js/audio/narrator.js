/**
 * The narrator's third part, played (round 69).
 *
 * One line at a time. Saying a line stops whatever she was saying (a short
 * fade), so going somewhere new always starts its own line, and leaving stops
 * her. Lines come from narrationScript.js (the words) and narrationCuts.js
 * (where each sits in its recording); the recordings are streamed by
 * soundscape.speakSpan, so nothing is decoded up front.
 *
 * Bodies without a line of their own get their family's line, worked out from
 * the board's own data (celestialBoardData.js): a Norse moon of Saturn, a
 * stony asteroid, an Apollo, a Neptune Trojan and so on.
 */
import { NARRATION } from "./narrationScript.js";
import { NARRATION_CUTS } from "./narrationCuts.js";
import { buildCelestialBoard } from "../ui/celestialBoardData.js";

const TEXT = new Map(NARRATION.map((entry) => [entry.id, entry.text]));

/* Focusable regions, by their scene names (outerBoundaries.js, kuiperBelt.js,
 * resonantSwarms.js, populationClouds.js). */
const REGION_LINES = {
  "The termination shock": "region:termination-shock",
  "The heliosheath": "region:heliosheath",
  "The heliopause": "region:heliopause",
  "The inner Oort Cloud": "region:inner-oort",
  "The outer Oort Cloud": "region:outer-oort",
  "The Plutinos": "region:plutinos",
  "The classical belt": "region:classical-belt",
  "The Kuiper Cliff": "region:kuiper-cliff",
  "The scattered disk": "region:scattered-disc",
  "The detached objects": "region:detached",
};

const JUPITER_IRREGULAR = /Himalia|Pasiphae|Carme|Ananke|Themisto|Carpo|Valetudo/;

let index = null;
/** name -> what the board knows about it: kind, classification, moon family, parent. */
function boardIndex() {
  if (index) return index;
  index = new Map();
  try {
    const board = buildCelestialBoard();
    board.bodies.forEach((row) => {
      index.set(row.name, { kind: row.kind, classification: row.classification ?? "", binary: row.binary, partnerSystem: row.partnerSystem });
      (row.moons ?? []).forEach((moon) => {
        if (!index.has(moon.name)) index.set(moon.name, { kind: "moon", family: moon.family ?? "", parent: row.name, parentKind: row.kind });
      });
    });
  } catch (error) {
    /* The board data failed to build: bodies keep only their own lines. */
  }
  return index;
}

function familyLine(info) {
  const c = info.classification ?? "";
  switch (info.kind) {
    case "moon": {
      const { family, parent, parentKind } = info;
      if (parentKind === "asteroid" || parentKind === "nea" || parentKind === "trojan") return "family:binary";
      if (/partner/i.test(family)) return "family:binary";
      if (parentKind === "dwarf" || parentKind === "tno") return parent === "Pluto" ? "family:pluto-small" : "family:dwarf-moon";
      if (/^S\/\d{4}/.test(info.name ?? "")) return "family:provisional-moon";
      if (parent === "Jupiter") return /Inner/.test(family) ? "family:jupiter-inner" : JUPITER_IRREGULAR.test(family) ? "family:jupiter-irregular" : "family:moon";
      if (parent === "Saturn") {
        if (/Norse/.test(family)) return "family:saturn-norse";
        if (/Inuit/.test(family)) return "family:saturn-inuit";
        if (/Gallic/.test(family)) return "family:saturn-gallic";
        if (/Trojan/.test(family)) return "family:saturn-trojan";
        if (/Ring|Co-orbital/.test(family)) return "family:saturn-ring";
        return "family:moon";
      }
      if (parent === "Uranus") return /Inner/.test(family) ? "family:uranus-inner" : /irregular/.test(family) ? "family:uranus-irregular" : "family:moon";
      if (parent === "Neptune") return /Inner/.test(family) ? "family:neptune-inner" : /irregular/.test(family) ? "family:neptune-irregular" : "family:moon";
      return "family:moon";
    }
    case "nea": {
      const family = /Atira/.test(c) ? "atira" : /Aten/.test(c) ? "aten" : /Apollo/.test(c) ? "apollo" : /Amor/.test(c) ? "amor" : null;
      return family ? `family:nea-${family}` : "family:asteroid";
    }
    case "trojan":
      if (/^(Venus|Earth|Mars) Trojan/.test(c)) return "family:trojan-inner";
      if (/^(Uranus|Neptune) Trojan/.test(c)) return "family:trojan-outer";
      return "family:trojan-jupiter";
    case "asteroid":
      if (/M-type|\bM\/|Xk/.test(c)) return "family:asteroid-m";
      if (/C-type|Cb-type|B-type|C \/ B|F \/ B|P-type/.test(c)) return "family:asteroid-c";
      if (/S-type|K-type/.test(c)) return "family:asteroid-s";
      return "family:asteroid";
    case "comet": return "family:comet";
    case "centaur": return "family:centaur";
    case "tno":
    case "dwarf":
      return info.partnerSystem ? "family:binary" : "family:tno";
    default: return null;
  }
}

/** The line to say for a body (or a focusable region), by its scene name. */
export function lineForBody(name) {
  if (!name) return null;
  if (NARRATION_CUTS[name]) return name;
  // A ring, by its own name (round 69, recording 3J).
  if (NARRATION_CUTS[`ring:${name}`]) return `ring:${name}`;
  if (REGION_LINES[name]) return REGION_LINES[name];
  if (/^Jupiter's Trojans/.test(name)) return "family:trojan-jupiter";
  if (/^The Hildas/.test(name)) return "Hilda";
  if (/^Neptune's Trojans/.test(name)) return "family:trojan-outer";
  if (/^Mars's Trojans/.test(name)) return "family:trojan-inner";
  const info = boardIndex().get(name);
  if (!info) return null;
  const id = familyLine({ ...info, name });
  return id && NARRATION_CUTS[id] ? id : null;
}

/** Whether a line has been recorded and cut. */
export const hasLine = (id) => Boolean(id && NARRATION_CUTS[id]);

/** The ultraviolet line for a body (ultravioletView.js names). */
export function ultravioletLine(name) {
  if (!name) return null;
  const id = /^67P/.test(name) ? "uv:67P" : `uv:${name}`;
  return NARRATION_CUTS[id] ? id : null;
}

export function createNarrator(sound) {
  let current = null; // { id, handle }
  const listeners = new Set();
  const emit = () => {
    const id = current?.id ?? null;
    listeners.forEach((listener) => listener(id));
  };

  function stop(fadeMs = 250) {
    if (!current) return;
    const was = current;
    current = null;
    was.handle.stop(fadeMs);
    emit();
  }

  /**
   * Says a line, stopping whatever she was saying. Returns false (and says
   * nothing) if there is no such line, sound is off, or audio has not been
   * unlocked by a click yet. `onEnd(how)` is called with "ended" when she
   * finishes, "stopped" if she was cut off.
   */
  function say(id, { onEnd } = {}) {
    const cut = id ? NARRATION_CUTS[id] : null;
    if (!cut || !sound.isEnabled() || !sound.isUnlocked?.()) return false;
    if (current) stop(180);
    const [file, start, end] = cut;
    const handle = sound.speakSpan(`${file}.mp3`, start, end);
    if (handle.state === "none") return false;
    const entry = { id, handle };
    current = entry;
    emit();
    handle.done.then((how) => {
      if (current === entry) { current = null; emit(); }
      onEnd?.(how);
    });
    return true;
  }

  // Sound switched off: she stops at once rather than talking on in silence.
  sound.onChange((on) => { if (!on) stop(120); });

  return {
    say,
    stop,
    /** Stops only if what she is saying passes the test (an id or a predicate). */
    stopIf(test) {
      if (!current) return;
      const ok = typeof test === "function" ? test(current.id) : current.id === test;
      if (ok) stop();
    },
    /** Says it, or stops it if it is what she is saying now (the replay buttons). */
    toggle(id) {
      if (current?.id === id) { stop(); return false; }
      return say(id);
    },
    current: () => current?.id ?? null,
    /** Seconds the line lasts (0 if there is none). */
    lengthOf: (id) => (id && NARRATION_CUTS[id] ? NARRATION_CUTS[id][2] - NARRATION_CUTS[id][1] : 0),
    /** Whether she would speak now (sound on, audio unlocked). */
    canSpeak: () => sound.isEnabled() && Boolean(sound.isUnlocked?.()),
    has: (id) => Boolean(id && NARRATION_CUTS[id]),
    textOf: (id) => TEXT.get(id) ?? "",
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

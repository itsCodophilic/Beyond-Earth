/**
 * The opening sequence.
 *
 * Act one  - a loading log driven by real construction milestones.
 * Act two  - a single drifting point of light the viewer clicks to begin.
 *
 * Two rules shape this module:
 *
 * 1. It must cost nothing. The universe is being assembled on the main thread
 *    while this is on screen, so every animation lives in CSS (compositor-driven,
 *    so it keeps moving even while JavaScript is busy) and this file does no
 *    per-frame work at all.
 *
 * 2. The progress it reports must be true. Each line is emitted from an actual
 *    construction milestone in main.js, not a timer pretending to be one. A
 *    faked progress sequence is easy to build and people can feel it.
 *
 * Startup is now fast enough (~2s) that the log would otherwise flash past
 * unreadably. The gate solves that without padding anything: the log runs at
 * whatever speed the real work takes, and the viewer then sets their own pace
 * before entering.
 */

const STEP_LABELS = {
  boot: "Establishing inertial reference frame",
  ephemeris: "Loading orbital ephemerides · epoch J2000",
  textures: "Streaming surface albedo maps",
  sun: "Igniting the solar photosphere",
  corona: "Kindling corona and chromosphere",
  moon: "Setting the Moon at perigee",
  satellites: "Binding satellite catalogues",
  environment: "Settling the zodiacal light",
  beltPool: "Compiling regolith geometry",
  beltMajor: "Placing Ceres, Vesta and Pallas",
  beltFamilies: "Distributing collisional families",
  beltBoulders: "Instancing boulder populations",
  beltDebris: "Scattering unresolved debris",
  compile: "Compiling shader programs",
  ready: "Universe stable",
};

// Minimum spacing between lines.
//
// Construction is genuinely fast now (~2s), and real milestones can land within
// a few milliseconds of one another, so without a floor the log is an
// unreadable flicker. This is deliberate pacing rather than fake progress: every
// line still marks a real event, it is simply held long enough to be read, and
// each one takes about a second to fall into place.
//
// The cost is honest -- it does extend the time before the gate appears. That is
// affordable precisely because the gate is self-paced: no one is waiting on a
// clock they did not start.
const MINIMUM_LINE_SPACING_MS = 400;

export function createIntroSequence({ root } = {}) {
  const container = root ?? document.querySelector("#loader");
  if (!container) {
    // Never let a missing overlay stop the experience from starting.
    return {
      step() {},
      ready: () => Promise.resolve(),
      land() {},
      dismiss() {},
      isDismissed: () => true,
    };
  }

  container.classList.add("intro");
  container.replaceChildren();

  const header = document.createElement("div");
  header.className = "intro__header";
  header.innerHTML = `
    <p class="intro__title"></p>
    <p class="intro__subtitle"></p>
  `;
  header.querySelector(".intro__title").textContent = "Beyond Earth";
  header.querySelector(".intro__subtitle").textContent =
    "System initialisation · heliocentric frame";

  const log = document.createElement("div");
  log.className = "intro__log";

  const stage = document.createElement("div");
  stage.className = "intro__stage";
  stage.append(header, log);
  container.append(stage);

  const gate = document.createElement("div");
  gate.className = "intro__gate";
  gate.innerHTML = `
    <button class="intro__singularity" type="button"
            aria-label="Begin the journey through the universe">
      <span class="intro__spiral" aria-hidden="true"></span>
      <span class="intro__core" aria-hidden="true"></span>
    </button>
    <div class="intro__caption">
      <p class="intro__prompt"></p>
      <div class="intro__lore">
        <p class="intro__lore-line"></p>
        <p class="intro__lore-line"></p>
      </div>
    </div>
  `;
  gate.querySelector(".intro__prompt").textContent = "Click the singularity";

  /*
   * The lore sits below the invitation, never beside it.
   *
   * The two are separate children of a column, so they cannot collide however
   * the text wraps. It is placed deliberately low in the frame -- the mark is
   * the subject of the shot, and this is a caption to it, not a competing
   * headline. Plain words on purpose: the physics is extraordinary enough
   * without the vocabulary getting in the way.
   */
  const LORE_LINES = [
    "13.8 billion years ago, everything — all matter, all space, all time — was a single point, hotter and denser than anything since.",
    "Then it expanded. Not into space; space itself was what grew. That is the Big Bang.",
  ];
  const loreLines = gate.querySelectorAll(".intro__lore-line");
  loreLines.forEach((line, index) => {
    line.textContent = LORE_LINES[index] ?? "";
    // Staggered so the two lines arrive as a thought rather than a block.
    line.style.animationDelay = `${index * 900}ms`;
  });

  /*
   * The spiral the singularity winds up before it goes.
   *
   * Physically this is the accretion beat: something spinning up, shedding
   * light as it does, faster and faster until it cannot hold. Dramatically it
   * is the wind-up a detonation needs -- the old gate went from a resting dot
   * straight into a tremble, which reads as a button being pressed rather than
   * as something losing its grip.
   *
   * The trick is that each spark only ever moves *outward*. The spiral is not
   * drawn: the emitter rotates, so a spark released a moment ago is further
   * round than one released now, and the whole set traces an Archimedean
   * spiral for free. Advance each spark's base angle in step with its head
   * start and the arms fall out of the arithmetic.
   *
   * Deterministic pseudo-random -- modular arithmetic, no `Math.random` -- so
   * the same arms appear on every run and this module keeps its promise of
   * doing no work at all per frame. Every value below is a custom property
   * read by one CSS animation; nothing here runs again after setup.
   */
  const SPARK_COUNT = 96;
  const SPARK_ARMS = 2;
  const SPARK_LIFE_MS = 2600;
  const SPARK_BIRTH_PX = 3;

  /*
   * The three beats, declared up here rather than at the click because the
   * hand-off from the outward flight to the fall is solved on paper below and
   * needs to know how long the wind-up runs.
   */
  const WIND_MS = 3200;
  const COLLAPSE_MS = 1400;
  const CHARGE_TO_PEAK_MS = 700;

  // The opacity curve of `intro-spark`, evaluated in JS. Kept in step with the
  // keyframes by hand; if those move, move these.
  const sparkOpacityAt = (phase, peak) => {
    if (phase < 0.14) return (phase / 0.14) * peak;
    if (phase < 0.7) return peak - ((phase - 0.14) / 0.56) * peak * 0.5;
    return peak * 0.5 * (1 - (phase - 0.7) / 0.3);
  };

  const spiral = gate.querySelector(".intro__spiral");
  for (let i = 0; i < SPARK_COUNT; i += 1) {
    const spark = document.createElement("span");
    spark.className = "intro__spark";
    const along = i / SPARK_COUNT;
    // How far into its own flight this spark starts. A negative delay of the
    // same size draws the arms complete on the first frame rather than growing
    // them out of a point.
    const head = along * SPARK_LIFE_MS;
    const reach = 74 + ((i * 37) % 46);
    const peak = 0.36 + ((i * 53) % 58) / 100;
    spark.style.setProperty("--a", `${(along * 360 * SPARK_ARMS).toFixed(2)}deg`);
    spark.style.setProperty("--d", `${Math.round(-head)}ms`);
    spark.style.setProperty("--life", `${SPARK_LIFE_MS}ms`);
    spark.style.setProperty("--reach", `${reach}px`);
    spark.style.setProperty("--peak", peak.toFixed(2));

    /*
     * Where this spark actually *is* when the wind-up ends.
     *
     * Without this the fall animation restarts every spark at `--reach`, so on
     * the first frame of the collapse the whole set teleports to the rim and
     * the spiral reads as a ring. Both timelines are deterministic, so the
     * position at the seam is arithmetic, not measurement: no layout is read,
     * nothing runs per frame, and the fall picks up exactly where the flight
     * left off.
     */
    const phase = ((WIND_MS + head) % SPARK_LIFE_MS) / SPARK_LIFE_MS;
    const from = SPARK_BIRTH_PX + phase * (reach - SPARK_BIRTH_PX);
    spark.style.setProperty("--from", `${from.toFixed(1)}px`);
    spark.style.setProperty("--from-s", (0.5 - phase * 0.25).toFixed(3));
    spark.style.setProperty("--from-o", sparkOpacityAt(phase, peak).toFixed(3));
    // Outermost first, so the arms are reeled in from the rim as a wave.
    spark.style.setProperty("--fall", `${Math.round((1 - phase) * 200)}ms`);
    spiral.append(spark);
  }

  container.append(gate);

  const button = gate.querySelector(".intro__singularity");
  const prompt = gate.querySelector(".intro__prompt");
  const lore = gate.querySelector(".intro__lore");
  let dismissed = false;

  // The overlay must completely seal the scene off while it is up.
  //
  // The application binds pointer and wheel handlers to `window`: pointer events
  // select celestial bodies, and pointermove drives hover raycasting. Without
  // this seal, the click that begins the experience also landed on whatever sat
  // behind the button (entering the universe immediately focused Earth), and
  // simply moving the cursor over the black overlay raised the scene's hover
  // tooltips -- planet cards and asteroid labels appearing over the intro.
  //
  // Bubble phase for pointer events: the button's own handler runs first, then
  // this stops the event before it reaches the scene.
  [
    "pointerdown", "pointerup", "pointermove", "pointerover", "pointerout",
    "mousemove", "mousedown", "mouseup", "click", "dblclick", "contextmenu",
  ].forEach((type) => {
    container.addEventListener(type, (event) => {
      if (!dismissed) event.stopPropagation();
    });
  });

  // Wheel is bound with `capture: true` on window, so a bubble-phase stop is
  // too late -- the journey would scroll behind the overlay. Capture it first
  // and cancel it outright until the viewer has entered.
  const blockWheel = (event) => {
    if (dismissed) return;
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("wheel", blockWheel, { capture: true, passive: false });

  let lastLineAt = 0;
  let queue = Promise.resolve();

  let lineCount = 0;

  function appendLine(text) {
    lineCount += 1;
    const line = document.createElement("p");
    line.className = "intro__line";

    const index = document.createElement("span");
    index.className = "intro__index";
    index.textContent = String(lineCount).padStart(2, "0");

    const label = document.createElement("span");
    label.className = "intro__label";
    label.textContent = text;

    line.append(index, label);
    log.append(line);
  }

  /** Records one real construction milestone. */
  function step(key, overrideText) {
    const text = overrideText ?? STEP_LABELS[key] ?? key;
    queue = queue.then(() => new Promise((resolve) => {
      const wait = Math.max(0, MINIMUM_LINE_SPACING_MS - (performance.now() - lastLineAt));
      const emit = () => { lastLineAt = performance.now(); appendLine(text); resolve(); };
      if (wait <= 0) emit(); else setTimeout(emit, wait);
    }));
    return queue;
  }

  /**
   * Resolves once the viewer chooses to begin. Waits for every queued log line
   * to have been shown first, so the sequence never skips its own ending.
   */
  /**
   * Resolves once the viewer chooses to begin.
   *
   * The beats are deliberate. The manifest retires, then the screen is left
   * completely empty for a moment -- no text, no mark, nothing. That emptiness
   * is the point: it makes the single point of light that follows land as an
   * event rather than as the next interface element. Only once it has come to
   * rest do the halo, the breathing and the invitation appear.
   */
  function ready() {
    return queue.then(() => new Promise((resolve) => {
      const LOG_RETIRE_MS = 700;
      const BLACKOUT_MS = 1500;
      const DESCENT_MS = 6200;

      // Bind before anything is cued, so the descent cannot finish before we
      // are listening for it.
      button.disabled = true;

      const arrive = (event) => {
        // Only the descent counts -- the breathing and halo loops fire this too.
        if (event && event.animationName !== "intro-descend") return;
        button.removeEventListener("animationend", arrive);
        button.disabled = false;
        button.classList.add("is-arrived");
        gate.classList.add("is-arrived");
        button.focus?.({ preventScroll: true });
      };
      button.addEventListener("animationend", arrive);

      /*
       * Click -> wind up -> collapse -> detonation.
       *
       * Three beats, and the order matters. It spins up calmly first, throwing
       * off light in spiral arms -- nothing is wrong yet, something is only
       * gathering. Then it loses hold: the arms are dragged back in, the mark
       * convulses, and it *shrinks* rather than swelling, which is the reading
       * that makes the blowout after it feel earned. A thing that gets bigger
       * and bigger and then explodes is a balloon; a thing that collapses to
       * nothing and then explodes is a singularity.
       *
       * The rotation runs across both of the first two beats as one animation,
       * accelerating throughout, so the collapse is the same motion carrying
       * on rather than a new one starting.
       */
      const begin = () => {
        if (button.disabled) return;
        button.removeEventListener("click", begin);
        button.disabled = true;

        button.classList.add("is-imploding", "is-winding");
        prompt.classList.add("is-spent");
        lore.classList.add("is-entering");
        loreLines.forEach((line, index) => {
          line.textContent = index === 0 ? "Entering the Big Bang" : "";
          line.style.animationDelay = "0ms";
        });

        setTimeout(() => {
          // It stops holding. The arms come back in and the mark convulses.
          button.classList.remove("is-winding");
          button.classList.add("is-collapsing");
          lore.classList.add("is-spent");
        }, WIND_MS);

        setTimeout(() => {
          // Charge, then detonate. resolve() fires at the white peak so the
          // WebGL burst starts inside the blowout and the seam is never seen.
          button.classList.remove("is-imploding", "is-collapsing");
          button.classList.add("is-charging");
          container.classList.add("is-detonating");
          setTimeout(() => {
            gate.classList.remove("is-live");
            resolve();
          }, CHARGE_TO_PEAK_MS);
        }, WIND_MS + COLLAPSE_MS);
      };
      button.addEventListener("click", begin);

      log.classList.add("is-retiring");
      header.classList.add("is-retiring");

      setTimeout(() => {
        stage.hidden = true;

        // A held beat of pure black before anything arrives.
        setTimeout(() => {
          gate.classList.add("is-live");
          // Safety net: if animationend never reports -- reduced motion, or the
          // tab backgrounded mid-descent -- the gate must still open.
          setTimeout(() => arrive(null), DESCENT_MS + 1200);
        }, BLACKOUT_MS);
      }, LOG_RETIRE_MS);
    }));
  }

  /**
   * Blooms the overlay white for the hand-off into the solar system.
   *
   * Called one beat before dismiss(), so the white is already up when the
   * scene changes underneath it and then dissolves away with the overlay.
   */
  function land() {
    if (dismissed) return;
    container.classList.remove("is-detonating");
    container.classList.add("is-landing");
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    window.removeEventListener("wheel", blockWheel, { capture: true });
    container.classList.add("is-hidden");
  }

  return { step, ready, land, dismiss, isDismissed: () => dismissed };
}

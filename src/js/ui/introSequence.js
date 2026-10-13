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

// Spacing between lines (the log's rhythm). Round 54: 500 ms -- one line
// per beat at 120 BPM, the tempo of the journey's music, so each line lands
// on a beat with its tick, and the tick (rings out in ~0.34 s) is never cut
// off by the next one. Change this to set the log's pace.
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
const LINE_SPACING_MS = 500;

const LOG_RETIRE_MS = 700;

// The gate: a held beat of black, then the point of light descends for
// DESCENT_MS (must match intro-descend in intro.css). Module-level since
// round 57, because the fall books the waiting loop against them.
const BLACKOUT_MS = 500;
const DESCENT_MS = 6200;

// When the tick's main hit lands after a line starts falling in: by 120 ms
// the line is visibly arriving (it reaches full opacity at 45% of its
// 1250 ms entrance). Design choice, round 54.
const TICK_ON_LINE_MS = 120;

/*
 * ===== THE TITLE CARD'S TIMING. Change these to set the pace. =====
 *
 * Round 48 (the owner: "make it very very slow while coming up ... give me
 * a variable I can change ... slowly the camera is driven towards the
 * letter O, then I dive into it ... give me a variable to set the
 * slowness"). All in seconds. Larger is slower.
 *
 *   riseSeconds      BEYOND EARTH rising from the bottom of the screen
 *   holdSeconds      the word at rest before the camera starts to move
 *   approachSeconds  the camera drifting towards the O: the O slides to
 *                    the middle of the screen while the view closes in
 *   diveSeconds      diving into the O until its dot is the size of the
 *                    next screen's particle
 *   fallSeconds      that particle falling off the bottom of the screen
 */
/*
 * How much bigger the O's ring grows during the dive, on top of the drift's
 * 2.2x. 8 opens the ring to about twice the screen's width as it fades -- the
 * feeling of passing through the O. Bigger = the ring rushes past faster;
 * smaller = it stays in view longer. (Design choice, round 49.)
 */
export const TITLE_RING_GROWTH = 8;

export const TITLE_TIMING = {
  riseSeconds: 10,
  holdSeconds: 1.5,
  approachSeconds: 5,
  diveSeconds: 5,
  fallSeconds: 3,
};

export function createIntroSequence({ root, sound = null } = {}) {
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
  /* Round 46 (Prompts.md): the name is no longer here -- it arrives after
   * the log, full screen. The log is headed by what it is doing. */
  header.querySelector(".intro__title").textContent = "System initialisation";
  header.querySelector(".intro__subtitle").textContent = "Heliocentric frame";

  const log = document.createElement("div");
  log.className = "intro__log";

  const stage = document.createElement("div");
  stage.className = "intro__stage";
  stage.append(header, log);
  container.append(stage);

  /*
   * Round 54: "Begin". Browsers will not play sound until the visitor has
   * clicked, and the log's ticks come before any other click, so the visit
   * opens on one quiet choice: begin (with sound) or begin without sound.
   * The universe carries on building behind it; the log starts on the
   * click, its lines booked from that moment (never before their milestone).
   */
  let begun = !sound;
  /*
   * Round 65: whether the log is on screen, which is not the same as begun.
   * Between the click and the log appearing there are ~0.65 s (the Begin
   * screen fades, the tick decodes). On a warm reload the universe builds so
   * fast that many milestones land in that gap; they used to be put in the
   * page and booked while the log was still display:none -- every line
   * measured at height 0, so the log never learned it had to glide up, and
   * every later line was drawn below the window ("stuck, and the next steps
   * are underneath"). Lines are now only placed once the log is visible.
   */
  let logOpen = !sound;
  // Music 5's handle: started by the fall, stopped by the click.
  let waitingLoop = null;
  /*
   * Round 66: the narrator (voice1, docs/voice-script.md). Her lines are
   * spoken to the moments they describe, and the point of light cannot be
   * clicked until she has finished ("...when you are ready, touch it"):
   * gateReadyAt is when her last line ends, on the page clock.
   */
  let gateReadyAt = 0;
  // Where her last line's speech ends inside its segment, measured (35.93 s
  // in the file, minus the segment's start, 30.6 s): "touch it" lands here.
  const TOUCH_SPOKEN_END_S = 35.93 - 30.6;
  // Her lines never overlap: each waits for the one before (+0.35 s).
  let voiceFreeAt = 0;
  const speak = (segment, at, options = {}) => {
    if (!sound?.has("voice1")) return at;
    const start = Math.max(at, voiceFreeAt + 350, performance.now());
    sound.playAt("voice1", start, { segment, ...options });
    voiceFreeAt = start + sound.segmentLength("voice1", segment) * 1000;
    return start;
  };
  let markBegun = () => {};
  const beganPromise = begun ? Promise.resolve() : new Promise((resolve) => { markBegun = resolve; });
  const soundToggle = document.createElement("button");
  soundToggle.type = "button";
  soundToggle.className = "intro__sound";
  if (sound) {
    stage.hidden = true;
    const opening = document.createElement("div");
    opening.className = "intro__begin";
    opening.innerHTML = `
      <button class="intro__begin-go" type="button">
        <span class="intro__begin-dot" aria-hidden="true"></span>
        <span class="intro__begin-word">Begin</span>
      </button>
      <p class="intro__begin-note">Sound on · best with headphones<svg class="intro__begin-phones" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0 1 16 0v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="2.8" y="13.5" width="4.4" height="7" rx="1.6" fill="currentColor"/><rect x="16.8" y="13.5" width="4.4" height="7" rx="1.6" fill="currentColor"/></svg></p>
      <button class="intro__begin-quiet" type="button">Begin without sound</button>
    `;
    container.append(opening);
    const renderToggle = (on) => {
      soundToggle.textContent = on ? "Sound on" : "Sound off";
      soundToggle.setAttribute("aria-pressed", String(on));
      soundToggle.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    };
    renderToggle(sound.isEnabled());
    sound.onChange(renderToggle);
    soundToggle.addEventListener("click", () => sound.toggle());
    const go = (withSound) => {
      if (begun) return;
      begun = true;
      // Inside the click: the only moment the browser lets audio start.
      sound.unlock(withSound);
      opening.classList.add("is-leaving");
      // The fade out, and the tick decoded, before the first line.
      const decoded = sound.ready(["tick", "tickFinal"]);
      const faded = new Promise((resolve) => setTimeout(resolve, 650));
      Promise.all([decoded, faded]).then(() => {
        opening.remove();
        stage.hidden = false;
        logOpen = true;
        container.append(soundToggle);
        requestAnimationFrame(() => soundToggle.classList.add("is-shown"));
        markBegun();
        flush();
      });
    };
    opening.querySelector(".intro__begin-go").addEventListener("click", () => go(true));
    opening.querySelector(".intro__begin-quiet").addEventListener("click", () => go(false));
    requestAnimationFrame(() => opening.querySelector(".intro__begin-go").focus?.({ preventScroll: true }));
  }

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
    "13.8 billion years ago, everything — all matter, all energy, all of space and time — was one point. There was no outside to it.",
    "Then it stretched. Not into anything: the stretching is what made the room. That is the Big Bang, and it has never stopped.",
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

  /*
   * The log, scheduled on the compositor (round 50: "the steps lag at 3-4
   * points ... make all steps smoother").
   *
   * Why it stuttered: each line used to be added by a timer, and the universe
   * is built on the main thread in a few long blocks (the worlds, the
   * moons, the shader compile, the first frames). While a block runs no timer
   * fires, so the log stopped dead, then caught up. On top of that, each new
   * line shoved the whole log up a row in one jump, and the lines' blur and
   * colour changes were main-thread work too.
   *
   * Now each real milestone is put in the DOM as soon as the browser can
   * take it, with its appearance booked for its slot in a steady rhythm
   * (LINE_SPACING_MS apart, never before the milestone itself happened):
   * the line's entrance, the glide of the log upward and the dimming of the
   * line before it are all transform/opacity animations with a delay. The
   * compositor plays those on its own thread, so lines already booked keep
   * arriving on the beat while the main thread is busy building. Since the
   * milestones come faster than the rhythm, there is always a run of booked
   * lines in hand when a long block starts.
   */
  const track = document.createElement("div");
  track.className = "intro__track";
  log.append(track);
  const reducedLog = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLIDE_MS = reducedLog ? 200 : 900;
  const DIM_MS = reducedLog ? 200 : 1100;
  let lineCount = 0;
  let nextSlot = 0;
  let lastShownAt = 0;
  let trackY = 0;
  let previous = null;
  const pending = [];
  let flushBooked = false;

  function buildLine(text) {
    lineCount += 1;
    const line = document.createElement("p");
    line.className = "intro__line";
    const body = document.createElement("span");
    body.className = "intro__line-body";
    const index = document.createElement("span");
    index.className = "intro__index";
    index.textContent = String(lineCount).padStart(2, "0");
    const label = document.createElement("span");
    label.className = "intro__label";
    label.textContent = text;
    // The live marker: on while this is the newest line.
    const live = document.createElement("span");
    live.className = "intro__live";
    live.setAttribute("aria-hidden", "true");
    label.append(live);
    body.append(index, label);
    line.append(body);
    return line;
  }

  /*
   * Round 58: one clock for sight and sound.
   *
   * The ticks are booked on the audio clock, which keeps time whatever the
   * page is doing. The lines used to be booked with *delays*, and a delay
   * only starts counting when the browser gets round to drawing the line --
   * so when a long block of building held up a frame, every line in that
   * batch (and its glide upward) slid later by the length of the block while
   * its tick stayed put: ticks before their lines, and glides from different
   * batches overlapping so the log stuck low and then jumped.
   *
   * Now every line is booked at an absolute moment (startTime on the page's
   * clock, the same clock the ticks use), in three frames:
   *   frame A  the lines go into the page, invisible;
   *   frame B  (A has been drawn) each line's arrival, the log's glide,
   *            the dimming of the line before, and its tick are all booked
   *            for its slot -- at least BOOK_LEAD_MS ahead, so the bookings
   *            reach the compositor before the moment comes.
   * (Ticks were briefly booked a frame later still, once the bookings were
   * known to be drawn; under heavy building that dropped ticks, and every
   * line must have its tick, so they are booked with the lines.)
   */
  const LINE_FALL_EASE = "cubic-bezier(0.17, 0.72, 0.24, 1)";
  const LINE_FALL = [
    { offset: 0, opacity: 0, transform: "translate3d(-16px, -38px, 0) rotate(-1.8deg)", easing: LINE_FALL_EASE },
    { offset: 0.45, opacity: 1, easing: LINE_FALL_EASE },
    { offset: 0.74, transform: "translate3d(2px, 4px, 0) rotate(0.3deg)", easing: LINE_FALL_EASE },
    { offset: 1, opacity: 1, transform: "none" },
  ];
  const FALL_MS = reducedLog ? 300 : 1250;
  // How far ahead of "now" a line is booked at the earliest, so its booking
  // reaches the compositor before its moment comes.
  const BOOK_LEAD_MS = 200;
  const nextFrame = (fn) => {
    if (document.hidden) setTimeout(fn, 0); else requestAnimationFrame(fn);
  };
  let unbooked = 0;
  const book = (animation, at) => {
    try { animation.startTime = at; } catch (error) { /* very old engine: plays now */ }
    return animation;
  };

  function flush() {
    flushBooked = false;
    if (!pending.length || !logOpen) return;
    const items = pending.splice(0);
    const batch = items.map((item) => {
      const line = buildLine(item.text);
      line.classList.add("is-waiting");
      return { line, key: item.key };
    });
    track.append(...batch.map((entry) => entry.line));
    // Frame B: book the batch.
    unbooked += 1;
    nextFrame(() => bookBatch(batch));
  }

  function bookBatch(batch) {
    const windowHeight = log.clientHeight;
    // Never measure a log that is not laid out (hidden, or not yet drawn):
    // every line would come out at height 0 and the glide would be lost.
    if (!windowHeight || !batch[0].line.offsetHeight) {
      nextFrame(() => bookBatch(batch));
      return;
    }
    unbooked -= 1;
    const now = performance.now();
    batch.forEach((entry) => {
      const { line } = entry;
      const at = Math.max(now + BOOK_LEAD_MS, nextSlot);
      nextSlot = at + LINE_SPACING_MS;
      lastShownAt = at;
      entry.at = at;
      line.classList.remove("is-waiting");
      if (line.animate) book(line.animate(LINE_FALL, { duration: FALL_MS, fill: "both" }), at);
      // The log glides up only once it is full, like a terminal.
      const bottom = line.offsetTop + line.offsetHeight;
      const y = Math.max(0, bottom - windowHeight);
      if (y !== trackY && track.animate) {
        book(track.animate(
          [{ transform: `translate3d(0, ${-trackY}px, 0)` }, { transform: `translate3d(0, ${-y}px, 0)` }],
          { duration: GLIDE_MS, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)", fill: "forwards" },
        ), at);
        trackY = y;
      }
      if (previous?.animate) {
        // The line before recedes into the record as this one arrives.
        book(previous.firstChild.animate([{ opacity: 1 }, { opacity: 0.3 }], { duration: DIM_MS, easing: "ease", fill: "forwards" }), at);
        book(previous.querySelector(".intro__live").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }), at);
      }
      previous = line;
    });
    // The ticks, on the audio clock, for the same moments. The last line
    // ("Universe stable") gets the "complete" tick. Each is started early by
    // its lead-in, so its main hit falls just as the line becomes visible
    // (TICK_ON_LINE_MS after the line starts).
    if (sound) {
      batch.forEach((entry) => {
        const cue = entry.key === "ready" ? "tickFinal" : "tick";
        sound.playAt(cue, entry.at + TICK_ON_LINE_MS - sound.accentOf(cue) * 1000);
      });
    }
  }

  /** Records one real construction milestone. */
  function step(key, overrideText) {
    pending.push({ key, text: overrideText ?? STEP_LABELS[key] ?? key });
    if (!flushBooked) {
      flushBooked = true;
      // On the next frame (a timer when the tab is hidden: no frames run).
      nextFrame(() => { if (flushBooked) flush(); });
    }
    return Promise.resolve();
  }

  /** Resolves once every line has been shown and held for a beat. */
  function logDone() {
    return beganPromise.then(() => new Promise((resolve) => {
      flush();
      const check = () => {
        if (pending.length) flush();
        if (unbooked > 0) { setTimeout(check, 50); return; }
        const left = lastShownAt + LINE_SPACING_MS - performance.now();
        if (left <= 0) resolve(); else setTimeout(check, left);
      };
      check();
    }));
  }

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
    return logDone().then(() => startTitle()).then(() => new Promise((resolve) => {
      // Shorter since round 46: the title card is now the held beat.
      // BLACKOUT_MS and DESCENT_MS: module constants (round 57), shared
      // with the fall, which books the waiting loop against them.

      // Bind before anything is cued, so the descent cannot finish before we
      // are listening for it.
      button.disabled = true;

      const arrive = (event) => {
        // Only the descent counts -- the breathing and halo loops fire this too.
        if (event && event.animationName !== "intro-descend") return;
        button.removeEventListener("animationend", arrive);
        if (button.classList.contains("is-arrived") || button.classList.contains("is-imploding")) return;
        // Round 66: not clickable, and no invitation, until the narrator has
        // finished her last line.
        const wait = gateReadyAt - performance.now();
        if (wait > 0) { setTimeout(() => arrive(null), wait); return; }
        button.disabled = false;
        button.classList.add("is-arrived");
        gate.classList.add("is-arrived");
        // Music 5 is already running: the fall booked it (see the fall).
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
        // Music 6: the wind-up now, the boom on the detonation (WIND_MS +
        // COLLAPSE_MS + CHARGE_TO_PEAK_MS = 5.3 s after the click).
        waitingLoop?.stop(300);
        waitingLoop = null;
        if (sound) {
          const clickAt = performance.now();
          // Faded out over its last 0.2 s, a breath before the expansion.
          sound.play("windup", { until: clickAt + WIND_MS + COLLAPSE_MS + CHARGE_TO_PEAK_MS - 250, fadeOutMs: 200 });
          // Music 6b: its crest on the white's peak, its swell under the
          // white's rise (which starts at WIND_MS + COLLAPSE_MS).
          const peakAt = clickAt + WIND_MS + COLLAPSE_MS + CHARGE_TO_PEAK_MS;
          sound.playAt("boom", peakAt - sound.accentOf("boom") * 1000, { fadeInMs: 250 });
        }

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

      // A held beat of pure black before anything arrives.
      setTimeout(() => {
        gate.classList.add("is-live");
        // Safety net: if animationend never reports -- reduced motion, or the
        // tab backgrounded mid-descent -- the gate must still open.
        setTimeout(() => arrive(null), DESCENT_MS + 1200);
      }, BLACKOUT_MS);
    }));
  }

  /*
   * The log retires and the title plays, once, after every log line has
   * been shown (round 48: the owner wants the whole log, 25+ lines, first).
   */
  let titlePromise = null;
  function startTitle() {
    if (titlePromise) return titlePromise;
    log.classList.add("is-retiring");
    header.classList.add("is-retiring");
    /*
     * Round 68 (the owner): after the log, the screen goes black and stays
     * black while the narrator begins -- "Before there were stars... smaller
     * than an atom. This is..." -- and BEYOND EARTH only starts to rise as
     * she says "Beyond Earth". Without her (no sound, or no file) it rises
     * after a short black beat as before.
     */
    let riseAt = performance.now() + LOG_RETIRE_MS + 400;
    if (sound?.has("voice1")) {
      speak("openingA", riseAt);
      const titleStart = speak("title", 0);
      riseAt = titleStart + sound.cueValue("voice1", "beyondAt") * 1000;
    }
    titlePromise = new Promise((resolve) => {
      setTimeout(() => {
        stage.hidden = true;
        playTitle(riseAt).then(resolve);
      }, LOG_RETIRE_MS);
    });
    return titlePromise;
  }

  /*
   * The title card (round 46; reworked rounds 47 and 48 from Prompts.md):
   *   1  BEYOND EARTH rises very slowly from the bottom of the screen,
   *      every letter together, huge and thin, solid from the start;
   *   2  the O carries a single dot at the exact centre of the drawn
   *      letter -- measured from the glyph's own ink box, not the letter's
   *      line box, which put it high (round 48: "near the centre, not in
   *      the centre");
   *   3  the camera drifts towards the O: the whole word slides so the O
   *      comes to the middle of the screen while the view closes in;
   *   4  then dives into the O until its dot is the next screen's 6 px
   *      particle; the letters pass out of the frame as it does;
   *   5  the particle falls slowly off the bottom, and the gate's point of
   *      light descends from the top.
   * Timings: TITLE_TIMING, above. CSS transitions do the moving (cued
   * here), so the frames are the compositor's, not this script's.
   */
  function playTitle(riseAt = performance.now()) {
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const k = reduced ? 0.3 : 1;
    const T = Object.fromEntries(Object.entries(TITLE_TIMING).map(([key, v]) => [key, Math.max(0.1, Number(v) || 0.1) * 1000 * k]));
    const marquee = document.createElement("div");
    marquee.className = "intro__marquee";
    marquee.setAttribute("aria-hidden", "true");
    const inner = document.createElement("div");
    inner.className = "intro__marquee-inner";
    marquee.append(inner);
    let oLetter = null;
    const word = (text) => {
      const w = document.createElement("span");
      w.className = "intro__word";
      [...text].forEach((ch) => {
        const letter = document.createElement("span");
        letter.className = ch === "O" ? "intro__letter intro__o" : "intro__letter";
        if (ch === "O" && !oLetter) {
          oLetter = letter;
          letter.innerHTML = '<span class="intro__probe"></span><span class="intro__o-glyph">O</span><span class="intro__o-dot"></span>';
        } else {
          const ink = document.createElement("span");
          ink.className = "intro__ink";
          ink.textContent = ch;
          letter.append(ink);
        }
        w.append(letter);
      });
      return w;
    };
    inner.append(word("BEYOND"), word("EARTH"));
    inner.style.setProperty("--rise", `${T.riseSeconds}ms`);
    container.append(marquee);
    const said = document.createElement("p");
    said.className = "intro__sr";
    said.textContent = "Beyond Earth";
    container.append(said);
    const dot = oLetter.querySelector(".intro__o-dot");
    const probe = oLetter.querySelector(".intro__probe");
    const glyph = oLetter.querySelector(".intro__o-glyph");
    /* The particle: from the dive on, the dot is this element, at a fixed
     * place on the screen, sized independently of the word. */
    const point = document.createElement("span");
    point.className = "intro__point";
    // How far the word zooms in the dive (see TITLE_RING_GROWTH).
    const DIVE_SCALE = 2.2 * Math.max(1, Number(TITLE_RING_GROWTH) || 1);

    /*
     * The dot at the O's true centre. The probe is a zero-size box sitting
     * on the baseline where the O's pen starts; the canvas reports the O's
     * ink box relative to that point, in the font actually in use.
     */
    const centreDot = () => {
      const style = getComputedStyle(glyph);
      const ctx = document.createElement("canvas").getContext("2d");
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const m = ctx.measureText("O");
      const p = probe.getBoundingClientRect();
      const box = oLetter.getBoundingClientRect();
      const x = p.left - box.left + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      const y = p.top - box.top - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    };
    const fontReady = document.fonts?.load
      ? document.fonts.load(`200 100px "Jost"`).catch(() => null)
      : Promise.resolve();

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    return fontReady.then(() => new Promise((resolve) => {
      centreDot();
      // Held in the black until the rise's moment (see startTitle), then
      // cued on a frame: within one frame of her "Beyond".
      const startRise = () => {
        marquee.classList.add("is-rising");
        // Music 2: booked so its peak lands the moment the word comes to
        // rest at the centre (the end of the rise); if the rise is set
        // shorter than the build-up, it starts part-way in.
        const restAt = performance.now() + T.riseSeconds;
        sound?.playAt("titleRise", restAt - sound.accentOf("titleRise") * 1000, { alignLate: true });
        /*
         * The narrator's lines (rounds 67-68), each after the one before:
         *   openingA, title  booked in startTitle, over the black, so that
         *            "Beyond" is the moment this rise begins;
         *   openingB "Every galaxy ... dense beginning." just after the
         *            title sound's hit (her voice would dip the hit), through
         *            the hold, the drift and the dive;
         *   look, touch  as before.
         */
        speak("openingB", restAt + 400);
      };
      wait(Math.max(0, riseAt - performance.now() - 16))
        .then(() => new Promise((r) => requestAnimationFrame(() => r())))
        .then(() => { startRise(); return wait(T.riseSeconds + T.holdSeconds); })
        .then(() => {
        centreDot();
        // Freeze the risen position as the starting point of the camera move.
        marquee.classList.add("is-risen");
        const d = dot.getBoundingClientRect();
        const box = inner.getBoundingClientRect();
        const ox = d.left + d.width / 2 - box.left;
        const oy = d.top + d.height / 2 - box.top;
        // The O to the middle of the screen: how far the word must slide.
        const dx = innerWidth / 2 - (d.left + d.width / 2);
        const dy = innerHeight / 2 - (d.top + d.height / 2);
        const midScale = 2.2;
        inner.style.transformOrigin = `${ox}px ${oy}px`;
        // 3 -- the drift towards the O. Music 3 runs through drift and dive
        // and is ended, on the audio clock, as we reach the particle.
        const driftAt = performance.now();
        sound?.playAt("focus", driftAt, { until: driftAt + T.approachSeconds + T.diveSeconds, fadeOutMs: 250 });
        // "Look closely. Somewhere in the dark, it is waiting."
        speak("look", driftAt + 300);
        inner.style.transition = `transform ${T.approachSeconds}ms cubic-bezier(0.45, 0, 0.3, 1)`;
        requestAnimationFrame(() => {
          inner.style.transform = `translate(${dx}px, ${dy}px) scale(${midScale})`;
        });
        return wait(T.approachSeconds).then(() => {
          /*
           * 4 -- the dive (round 49: "the O's rings get bigger and bigger,
           * slowly, as we dive into the O towards the particle, and only
           * fade once we are at the particle"). The word keeps zooming --
           * far past the edges of the screen, so the O's ring opens round
           * the viewer -- while the dot is handed to its own element at the
           * same spot, which grows only to the gate's 6 px. The other
           * letters go early; the ring stays until the last third.
           */
          const d = dot.getBoundingClientRect();
          point.style.left = `${d.left + d.width / 2}px`;
          point.style.top = `${d.top + d.height / 2}px`;
          point.style.transition = "none";
          point.style.transform = `scale(${(d.width / 6).toFixed(3)})`;
          point.style.setProperty("--glow", `${T.diveSeconds}ms`);
          container.append(point);
          dot.style.visibility = "hidden";
          marquee.classList.add("is-diving");
          document.querySelectorAll(".intro__ink").forEach((ink) => {
            ink.style.transition = `opacity ${Math.round(T.diveSeconds * 0.35)}ms ease`;
          });
          glyph.style.transition = `opacity ${Math.round(T.diveSeconds * 0.38)}ms ease-in ${Math.round(T.diveSeconds * 0.62)}ms`;
          inner.style.transition = `transform ${T.diveSeconds}ms cubic-bezier(0.5, 0, 0.9, 0.55)`;
          requestAnimationFrame(() => {
            inner.style.transform = `translate(${dx}px, ${dy}px) scale(${DIVE_SCALE})`;
            point.style.transition = `transform ${T.diveSeconds}ms cubic-bezier(0.5, 0, 0.9, 0.55)`;
            point.style.transform = "scale(1)";
            point.classList.add("is-glowing");
          });
          return wait(T.diveSeconds + 80);
        });
      }).then(() => {
        // 5 -- the particle falls. (Music 4 runs through both falls.)
        sound?.play("fall");
        /*
         * Music 5, booked now so the sound never breaks (round 57). Its
         * opening tone fades in under the fall's fading tail, and its first
         * beat lands the moment the point of light settles at the centre:
         * fall + the beat before the gate + its blackout + its descent.
         * Then it loops its beats until the click.
         */
        if (sound && !waitingLoop) {
          const settleAt = performance.now() + T.fallSeconds + 100 + BLACKOUT_MS + DESCENT_MS;
          waitingLoop = sound.playAt("rippleLoop", settleAt - sound.accentOf("rippleLoop") * 1000, { loop: true, fadeInMs: 2000 });
          // "That point of light is where it all begins. When you are
          // ready... touch it." -- spoken as it descends, "touch it" landing
          // as it settles; the click opens when she has finished.
          if (sound.has("voice1")) {
            speak("touch", settleAt - TOUCH_SPOKEN_END_S * 1000);
            gateReadyAt = voiceFreeAt;
          }
        }
        marquee.remove();
        point.style.transition = "none";
        point.style.animationDuration = `${T.fallSeconds}ms`;
        point.classList.add("is-falling");
        return wait(T.fallSeconds + 100).then(() => {
          point.remove();
          said.remove();
          resolve();
        });
      });
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

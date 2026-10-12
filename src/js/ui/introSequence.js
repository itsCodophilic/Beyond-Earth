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

const LOG_RETIRE_MS = 700;

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
      const emit = () => {
        lastLineAt = performance.now();
        appendLine(text);
        resolve();
      };
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
    return queue.then(() => startTitle()).then(() => new Promise((resolve) => {
      // Shorter since round 46: the title card is now the held beat.
      const BLACKOUT_MS = 500;
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
    titlePromise = new Promise((resolve) => {
      setTimeout(() => {
        stage.hidden = true;
        playTitle().then(resolve);
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
  function playTitle() {
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
      requestAnimationFrame(() => requestAnimationFrame(() => marquee.classList.add("is-rising")));
      wait(T.riseSeconds + T.holdSeconds).then(() => {
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
        // 3 -- the drift towards the O.
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
        // 5 -- the particle falls.
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

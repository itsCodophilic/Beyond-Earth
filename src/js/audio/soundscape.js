/**
 * The sound of Beyond Earth (round 54).
 *
 * One Web Audio graph for the whole visit: every sound goes through a master
 * gain, so muting is one ramp and nothing has to be stopped. Sounds are
 * *scheduled* on the audio clock rather than started by timers: the audio
 * thread plays a booked sound on time even while the main thread is busy
 * building the universe, which is exactly when the intro's log ticks.
 *
 * Browsers will not start audio before the visitor has clicked or tapped,
 * so nothing is created until unlock() is called from the intro's "Begin"
 * click. Files are fetched early (plain downloads are allowed) and decoded
 * once the context exists.
 *
 * The cue list is the one in docs/music-prompts.md. A cue whose file has not
 * been made yet is `null` and simply stays silent, so each sound can be
 * dropped in as it arrives: add its file name here and it plays.
 */

const AUDIO_ROOT = `${(import.meta.env && import.meta.env.BASE_URL) || "/"}audio/`;

/*
 * ===== The background music: tune it here =====
 * AMBIENCE_VOLUME  how loud it plays, 0 (silent) to 1 (the file as it is).
 *                  bgmusic.mp3 is already soft (mean -26 dB, peak -10 dB);
 *                  0.35 (-9 dB) puts it near -35 dB, some 16 dB under her
 *                  voice: there if you listen for it, never in front of
 *                  anything. Try 0.5 for more presence, 0.2 for less.
 * AMBIENCE_FILE    its file in public/audio/.
 * AMBIENCE_SEAM    seconds the end of the file is blended into its start,
 *                  so the loop has no join you can hear. The file fades in
 *                  over its first ~5 s and out over its last ~5 s, so 6 s
 *                  lays one fade across the other.
 * AMBIENCE_FADE_IN_MS  how slowly it comes up on reaching the Solar System.
 */
export const AMBIENCE_VOLUME = 0.35;
export const AMBIENCE_FILE = "bgmusic.mp3";
export const AMBIENCE_SEAM = 6;
export const AMBIENCE_FADE_IN_MS = 8000;

/*
 * The cues.
 *   file    the file in public/audio/
 *   start   seconds into the file where the sound proper begins
 *           (measured; any lead-in silence is skipped so it lands on cue)
 *   gain    playback level, 0-1, set by ear against the others
 *   alias   play another cue's file instead (a stand-in until the real
 *           file exists), with `detune` in cents
 *   reverse play the file backwards
 *   rate    playback speed (1 = as made; below 1 is slower and lower)
 *   envelope  [[seconds after it starts, gain multiplier], ...], ramped
 *           in straight lines (round 63: lifts the song's quiet opening)
 *   accent  where its main moment is, in seconds of the file as played
 *           (after any reversing); the intro lines this moment up
 */
export const SOUND_CUES = {
  /*
   * tick.mp3 (Suno, round 54): 0.48 s long. Measured with ffmpeg at 5 ms
   * resolution: two faint pre-clicks (0.02-0.03 s and 0.055-0.075 s), the
   * main hit at 0.09 s (-3 dBFS), then a ringing tail that is below
   * -40 dBFS by about 0.34 s -- so it rings out fully inside one 0.5 s beat.
   *   accent  seconds into the file of the main hit: the moment the intro
   *           lines up with each log line.
   */
  tick: { file: "tick.mp3", start: 0, accent: 0.09, gain: 0.5 },
  /* Stand-in for "Universe stable" until 01-tick-final exists: the same
   * tick a fifth higher (+700 cents), a touch louder. */
  tickFinal: { alias: "tick", detune: 700, gain: 0.62 },
  /*
   * riser-2.mp3 (Suno, round 55), 11.44 s. Played forwards it is a short
   * swell into a braam hit at 1.9 s (peak -2.9 dBFS) and a 9 s fading tail
   * -- loud at the start, the opposite of the brief ("low initially, loud
   * when BEYOND EARTH is at the centre"). Played *backwards* the tail
   * becomes a 9.5 s crescendo from -43 dBFS up to the hit, now at 9.545 s
   * (measured on the reversed samples), followed by the original 1.9 s
   * swell decaying away: a classic reverse swell. The intro books it so
   * that peak lands the moment the word comes to rest.
   * To hear it forwards instead, set reverse: false and accent: 1.9.
   */
  titleRise: { file: "riser-2.mp3", reverse: true, start: 0, accent: 9.545, gain: 0.8 },
  /*
   * O-1.1-Slow-0.5x.mp3 (Suno, round 55; the 0.5x take of O-1.mp3), 12.68 s.
   * Measured in 0.25 s windows: a tiny click at 0.0 s (skipped: start 0.25),
   * a slow rise from -40 to -21 dB RMS over 0.25-5.5 s, a loud bright
   * plateau (-7 to -11 dB RMS) over 5.75-10.0 s, then a fall from 10.25 s.
   * From 0.25 s that is: the rise under the 5 s drift, the plateau under
   * the 5 s dive, and the drop exactly where we reach the particle -- where
   * the intro ends it with a short fade. Chosen over the 6.4 s normal take
   * (O-1.mp3), whose whole arc is too short for the 10 s move.
   * Plateau peaks reach -0.2 dBFS, so it plays well down: a soft tone.
   */
  focus: { file: "O-1.1-Slow-0.5x.mp3", start: 0.25, gain: 0.45 },
  /*
   * Falling-3.mp3 (Suno, round 56), 10.01 s -- the scene it plays under is
   * 9.8 s (fall 3.0 s, dark 0.6 s, descent from the top 6.2 s). Measured in
   * 0.25 s windows: a click at 0.0 s (skipped: start 0.25), a swell to
   * about -15 dB RMS by 1.75 s, held to 5.5 s, then a long decay (-30 dB at
   * 8 s, -45 dB at 9 s, silent by 9.75 s); its pitch steps down from
   * ~588 Hz to ~220 Hz around 6 s. From 0.25 s it ends 9.75 s later, as the
   * point of light settles at the centre (9.8 s), so it needs no cutting.
   * Peaks -6.2 dBFS; a soft tone.
   */
  fall: { file: "Falling-3.mp3", start: 0.25, gain: 0.6 },
  /*
   * ripple-4.mp3 (Suno, round 57), 11.20 s. Measured at 10 ms resolution:
   * 0-2.8 s a steady low tone (about -19 dB RMS, fundamental ~74 Hz, a low
   * D), then four double beats -- first hits at 2.865, 4.95, 7.05 and
   * 9.13 s, each followed by a second hit ~0.3 s later -- one every ~2.09 s,
   * half a breath of the particle (4.2 s); then it fades out from 9.5 s.
   *   accent       the first beat, which lands as the particle settles
   *   loopStart/   after one pass through the tone, it repeats the beats:
   *   loopEnd      2.80-7.00 s holds two beats and is exactly one breath
   *                (4.2 s) long; both ends sit in the tone, before a beat
   *   loopFade     the last 0.3 s of the loop is blended (equal power) into
   *                the 0.3 s before loopStart, so the seam is inaudible
   * Peaks -0.7 dBFS.
   */
  rippleLoop: { file: "ripple-4.mp3", start: 0, accent: 2.865, loopStart: 2.8, loopEnd: 7.0, loopFade: 0.3, gain: 0.6 },
  /*
   * 6a-1.mp3 (Suno, round 60; replaces 6a.mp3) -- the click's wind-up,
   * 4.81 s. Measured (0.1 s loudness; 0.25 s spectrum and stereo):
   *   0.1-0.6 s  a quiet spark, a thin ~1.99 kHz glint (-57 -> -37 dB)
   *   0.6-1.0 s  a fast swell into a deep swirl (40-56 Hz; peak -2.2 dBFS
   *              at 1.03 s) -- a swell, not a hit
   *   1.0-2.0 s  the spin-up: brightening (centroid 300 Hz -> 1 kHz) and
   *              widening (left/right correlation down to -0.58 at 2.0 s)
   *   2.4-3.3 s  a second surge, darker -- the last turn of the wind-up
   *   3.4-4.8 s  a long fall away (-16 -> -36 dB) over a faint ~660 Hz
   *              glint -- the pull inward
   * Against the page's beats from the click (wind-up to 3.2 s, collapse to
   * 4.6 s, charge to 5.3 s), at 0.95 speed (0.9 semitone lower) the second
   * surge ends at 3.5 s, the fall runs 3.6-5.06 s, and the expansion at
   * 5.3 s follows a breath of quiet. The intro fades its last 0.2 s.
   */
  windup: { file: "6a-1.mp3", start: 0, rate: 0.95, gain: 0.55 },
  /*
   * 6b.mp3 (Suno, round 61), 13.09 s -- the expansion. Measured (0.1 s
   * loudness; 50 ms spectrum around the burst): a quiet 555 Hz glint, a
   * long slow build from 0.6 s (-56 dB) to -11 dB by 4.8 s; then the burst:
   * the high end (above 3 kHz) climbs 30 dB from 4.95 s to a bright crest
   * at 5.70-5.75 s, and from 5.80 s a deep, loud body (peaks +2.9 dBFS)
   * holds to ~6.4 s; then a long settle (-30 dB at 9 s, -45 dB at 10.3 s,
   * silent by 12.5 s).
   * On the page the white blowout starts at the end of the collapse (4.6 s
   * after the click) and peaks 0.7 s later (5.3 s), the moment the journey
   * is handed the screen. So only the burst is used: from 5.05 s, where its
   * brightening begins, so the sound swells with the white and its crest
   * (5.75 s) lands on the white's peak; the long settle then carries on
   * under the journey's first seconds. The slow build is left out -- the
   * wind-up covers that time.
   */
  boom: { file: "6b.mp3", start: 5.05, accent: 5.75, gain: 0.55 },
  /*
   * 6c.mp3 (Suno, round 62), 13.21 s -- "Where It Stopped". Measured (0.5 s
   * windows): rises from -46 dB to a plateau of about -10 dB RMS at 4-6.5 s
   * (peak +0.2 dBFS at 5.1 s), then settles away (-20 dB at 10 s, silent by
   * 13 s); its notes are D, F# and A -- a D major chord.
   * Round 63: it must carry the sound with no gap from 6b's burst to the
   * song, however long the journey takes to start, so it is played in two
   * parts:
   *   settleHold  from the start, its swell rising under 6b's settle (it
   *               starts 0.3 s after the white's peak), then its plateau
   *               held as long as needed: a loop of 4.20-7.32 s, found by
   *               search (spectral match 0.87 over the 85 ms before each
   *               end, both ends at -12.5 dB), its seam blended over 0.5 s
   *   settleTail  the rest of the file from 7.32 s -- the settle -- cross-
   *               faded in when "Where It Stopped" has been on for 7 s,
   *               carrying on under the song's start at the Multiverse,
   *               fading away under the song's quiet opening
   */
  /*
   * Part-1.mp3 (round 66), 36.52 s, mono -- the narrator's first part (the
   * text is docs/voice-script.md, Voice 1). Mean -23.5 dB, peak -6.5 dBFS.
   * Its pauses were found with ffmpeg silencedetect (-40 dB, 0.35 s) and
   * matched to the script's phrases by length; it is cut, in the pauses,
   * into the four moments it is spoken to:
   *   opening  0-18.95 s   "Before there were stars ... dense beginning."
   *                        (speech ends 18.58) -- from the log's first line
   *   title    19.0-26.5   "This is Beyond Earth ... we call home."
   *                        (speech 19.31-26.15) -- as BEYOND EARTH rises
   *   look     26.6-30.55  "Look closely ... it is waiting."
   *                        (speech 26.89-30.29) -- as the camera drifts in
   *   touch    30.6-36.52  "That point of light ... touch it."
   *                        (speech 30.79-35.93) -- ending as the point of
   *                        light settles; only then can it be clicked
   * The voice goes straight to the output, not through the music bus, and
   * the music dips under it (VOICE_DUCK).
   */
  voice1: {
    file: "Part-1.mp3", bus: "voice", gain: 1.5,
    segments: {
      opening: [0, 18.95], title: [19.0, 26.5], look: [26.6, 30.55], touch: [30.6, 36.52],
      // Round 67: the opening in its two sentences (pause 8.25-8.83 s), and
      // where "Beyond" begins in the title line: measured at 20 ms, "This"
      // 19.30-19.76, "is" 19.92-20.10, "Beyond" 20.12-20.62, "Earth"
      // 20.68-21.06 -- so "Beyond" is 1.12 s into the title segment.
      openingA: [0, 8.45], openingB: [8.6, 18.95],
    },
    beyondAt: 20.12 - 19.0,
  },
  /*
   * "Part 2.mp3" (round 68), 107.65 s, mono -- the narrator's second part
   * (docs/voice-script.md, Voice 2): one paragraph per act of the journey.
   * Mean -22.9 dB, peak -4.8 dBFS. Recorded without the long pauses the
   * script asked for, so the paragraphs were found by alignment: its 49
   * stretches of speech (ffmpeg silencedetect, -42 dB, 0.22 s) were matched
   * to the script's 40 phrases by length against syllable counts (dynamic
   * programming, 0.244 s a syllable), and each paragraph is cut in the
   * middle of the pause before the next (the paragraph pauses are mostly
   * the longer ones, 0.6-0.86 s; between the Orion Arm and Our Star the
   * longest, 93.05-93.91 s, was taken over the first alignment's 92.38,
   * which had squeezed "Our Star." into 0.42 s). After "beyond Earth." (ends
   * 106.37 s) the file has a breathy, laugh-like tail (106.77-107.65 s:
   * -32 to -48 dB, spectral flatness 0.6-0.7, bursts every ~0.2 s) -- it is
   * cut off at 106.55 s and never plays.
   *   p1 The Big Bang        0-10.44     p6 Laniakea          51.86-64.85
   *   p2 Where It Stopped    10.44-16.32 p7 The Milky Way     64.85-79.84
   *   p3 The Multiverse      16.32-25.38 p8 The Orion Arm     79.84-93.48
   *   p4 Our Universe        25.38-38.41 p9 Our Star          93.48-104.20
   *   p5 The Cosmic Web      38.41-51.86 p10 "Welcome..."     104.20-106.55
   * main.js speaks each as its act begins.
   */
  voice2: {
    file: "Part 2.mp3", bus: "voice", gain: 1.5,
    segments: {
      p1: [0, 10.44], p2: [10.44, 16.32], p3: [16.32, 25.38], p4: [25.38, 38.41],
      p5: [38.41, 51.86], p6: [51.86, 64.85], p7: [64.85, 79.84], p8: [79.84, 93.48],
      p9: [93.48, 104.2], p10: [104.2, 106.55],
    },
  },
  settleHold: { file: "6c.mp3", start: 0, loop: true, loopStart: 4.2, loopEnd: 7.32, loopFade: 0.5, gain: 0.6 },
  settleTail: { file: "6c.mp3", start: 7.32, gain: 0.6 },
  /*
   * journey-edit.mp3 -- "The Journey" (Suno, round 62, 224.36 s) cut to
   * 139.97 s so the journey can follow it from the Multiverse to the Sun.
   * The original is kept untouched; the edit was made with ffmpeg:
   *   cut  44.489 s -> 128.917 s (84.43 s out), joined with a 1 s
   *        equal-power crossfade. The two points were found by search: the
   *        best match of chroma (0.81), pulse (onset correlation 0.43) and
   *        loudness (1.3 dB apart) over +/-2 s around each; the 0.28 s
   *        pulse carries straight through the join.
   *   In the edit: the bass enters at ~12 s, the climax runs ~57-97 s, the
   *   breakdown ~98-121 s, the final swell rises at 122.0 s, and it fades
   *   out from 136.2 s to 139.7 s.
   * Mean -18.7 dB, peak -4.4 dBFS (ffmpeg volumedetect).
   */
  journey: { file: "journey-edit.mp3", start: 0, gain: 0.85, envelope: [[0, 2], [12, 1]] },
  /*
   * Round 71: the background music in the Solar System (the owner: "it will
   * be very low -- hearable but not loud; space does not have sounds, it is
   * just for the experience"). One minute, looped for as long as the visit
   * lasts, its seam crossfaded over AMBIENCE_SEAM seconds so the loop never
   * shows. It goes through the music bus, so it dips under her voice like
   * the rest. Set its level with AMBIENCE_VOLUME, below.
   */
  ambience: { file: AMBIENCE_FILE, start: 0, loop: true, loopFade: AMBIENCE_SEAM, gain: AMBIENCE_VOLUME },
};

const PREF_KEY = "beyond-earth:sound";

function readPreference() {
  try {
    const value = window.localStorage.getItem(PREF_KEY);
    return value === "off" ? false : true;
  } catch (error) {
    return true;
  }
}

function writePreference(on) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch (error) {
    /* private mode or blocked storage: the choice lasts this visit only */
  }
}

export function createSoundscape() {
  let ctx = null;
  let master = null;
  // Round 66: everything but the narrator goes through musicBus, so the
  // music can dip under her voice while she speaks.
  let musicBus = null;
  const VOICE_DUCK = 0.4; // music while she speaks: -8 dB
  let enabled = readPreference();
  const bytes = new Map();   // file -> Promise<ArrayBuffer>
  const buffers = new Map(); // file -> Promise<AudioBuffer|null>
  const listeners = new Set();
  const live = new Set();

  const resolveCue = (name) => {
    const cue = SOUND_CUES[name];
    if (!cue) return null;
    if (cue.alias) {
      const base = SOUND_CUES[cue.alias];
      if (!base?.file) return null;
      return { ...base, ...cue, file: base.file, start: base.start ?? 0, reverse: base.reverse };
    }
    return cue.file ? cue : null;
  };

  function fetchBytes(file) {
    if (!bytes.has(file)) {
      bytes.set(file, fetch(AUDIO_ROOT + encodeURIComponent(file))
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .catch(() => null));
    }
    return bytes.get(file);
  }

  function bufferFor(file, reverse = false) {
    if (!ctx) return Promise.resolve(null);
    const key = reverse ? `${file}#reversed` : file;
    if (!buffers.has(key)) {
      buffers.set(key, reverse
        ? bufferFor(file).then((forward) => {
          if (!forward) return null;
          const backward = ctx.createBuffer(forward.numberOfChannels, forward.length, forward.sampleRate);
          for (let c = 0; c < forward.numberOfChannels; c += 1) {
            const data = forward.getChannelData(c).slice();
            data.reverse();
            backward.copyToChannel(data, c);
          }
          return backward;
        })
        : fetchBytes(file).then((data) => {
          if (!data) return null;
          // decodeAudioData detaches its input; decode a copy so a retry works.
          return ctx.decodeAudioData(data.slice(0)).catch(() => null);
        }));
    }
    return buffers.get(key);
  }

  /*
   * A loop with its seam blended away: the file up to loopEnd, with its last
   * loopFade seconds crossfaded (equal power) into the loopFade seconds
   * before loopStart -- so where the loop jumps back, the sound is already
   * the sound that comes next. Built once per cue.
   */
  const seams = new Map();
  function seamed(cue, buffer) {
    if (!buffer) return null;
    const key = `${cue.file}#${cue.loopStart}-${cue.loopEnd}-${cue.loopFade}`;
    if (seams.has(key)) return seams.get(key);
    const rate = buffer.sampleRate;
    /*
     * Round 71: a whole-file loop (loopStart 0, no loopEnd -- the background
     * music). There is nothing before the start to blend into, so the file's
     * last loopFade seconds are laid over its first loopFade seconds instead
     * (equal power) and the loop is the file less that overlap: the end of
     * each pass has already become the start of the next.
     */
    if (!cue.loopStart && cue.loopEnd == null) {
      const n = Math.min(Math.round(cue.loopFade * rate), Math.floor(buffer.length / 3));
      const length = buffer.length - n;
      const out = ctx.createBuffer(buffer.numberOfChannels, length, rate);
      for (let c = 0; c < buffer.numberOfChannels; c += 1) {
        const src = buffer.getChannelData(c);
        const dst = src.slice(0, length);
        for (let i = 0; i < n; i += 1) {
          const g = (i + 0.5) / n;
          dst[i] = src[i] * Math.sin(g * Math.PI / 2) + src[length + i] * Math.cos(g * Math.PI / 2);
        }
        out.copyToChannel(dst, c);
      }
      seams.set(key, out);
      return out;
    }
    const a = Math.round(cue.loopStart * rate);
    const b = Math.min(buffer.length, Math.round(cue.loopEnd * rate));
    const n = Math.min(Math.round(cue.loopFade * rate), a, b - a);
    const out = ctx.createBuffer(buffer.numberOfChannels, b, rate);
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const src = buffer.getChannelData(c);
      const dst = src.slice(0, b);
      for (let i = 0; i < n; i += 1) {
        const g = (i + 0.5) / n;
        const tail = src[b - n + i];
        const lead = src[a - n + i];
        dst[b - n + i] = tail * Math.cos(g * Math.PI / 2) + lead * Math.sin(g * Math.PI / 2);
      }
      out.copyToChannel(dst, c);
    }
    seams.set(key, out);
    return out;
  }

  /** Start downloading cues now, before the click, so they are ready. */
  function preload(names) {
    names.forEach((name) => {
      const cue = resolveCue(name);
      if (cue) fetchBytes(cue.file);
    });
  }

  /**
   * Called from a click or tap: creates the audio context (the browser
   * allows it to start only inside a user gesture) and decodes what has
   * been downloaded. `on` sets whether sound is wanted at all.
   */
  function unlock(on = enabled) {
    setEnabled(on);
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      try {
        ctx = new Context({ latencyHint: "interactive" });
      } catch (error) {
        ctx = null;
        return;
      }
      master = ctx.createGain();
      master.gain.value = enabled ? 1 : 0;
      /*
       * A safety limiter on the way out (round 61): several of the Suno
       * files peak above 0 dBFS (6b at +2.9, riser-2's hit, 6a-1), and
       * cues overlap at the hand-offs. This only touches peaks above
       * -3 dBFS, so nothing ever clips; quieter sound passes untouched.
       */
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      master.connect(limiter).connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.connect(master);
      Object.keys(SOUND_CUES).forEach((name) => {
        const cue = resolveCue(name);
        if (cue) bufferFor(cue.file, cue.reverse);
      });
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  /*
   * Plays a cue at a moment on the page's clock (performance.now()), booked
   * on the audio clock so it lands on time whatever the main thread is
   * doing. Returns a handle with stop(fadeMs).
   *   options.alignLate  if that moment has already passed, start that far
   *                      into the sound, so its accent still lands on time
   *   options.until      a page-clock moment to end it, with fadeOutMs
   */
  function playAt(name, pageTime = performance.now(), options = {}) {
    const cue = resolveCue(name);
    const handle = { stop() {}, cue: name };
    /*
     * Where the sound is, in seconds of the file from where it started
     * playing, as heard (output latency taken off) -- null until it has
     * started; `state` says "pending", "playing" or "none" (nothing to
     * play). Round 62: the journey's pictures follow its music by this.
     */
    handle.state = "none";
    handle.position = () => null;
    if (!cue || !ctx) return handle;
    handle.state = "pending";
    let stopped = false;
    let source = null;
    let gainNode = null;
    handle.stop = (fadeMs = 300) => {
      stopped = true;
      if (!source || !gainNode) return;
      const now = ctx.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      try { source.stop(now + fadeMs / 1000 + 0.05); } catch (error) { /* already stopped */ }
    };
    bufferFor(cue.file, cue.reverse).then((raw) => {
      const buffer = (options.loop ?? cue.loop) && cue.loopFade ? seamed(cue, raw) : raw;
      if (!buffer || stopped) { handle.state = "none"; return; }
      const lead = (pageTime - performance.now()) / 1000;
      const when = ctx.currentTime + Math.max(0, lead);
      const late = options.alignLate && lead < 0 ? -lead : 0;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = Boolean(options.loop ?? cue.loop);
      if (source.loop) {
        source.loopStart = cue.loopStart ?? cue.start ?? 0;
        source.loopEnd = Math.min(cue.loopEnd ?? buffer.duration, buffer.duration);
      }
      const rate = options.rate ?? cue.rate ?? 1;
      if (rate !== 1) source.playbackRate.value = rate;
      const detune = options.detune ?? cue.detune ?? 0;
      if (detune && source.detune) source.detune.value = detune;
      gainNode = ctx.createGain();
      const level = (options.gain ?? cue.gain ?? 1);
      const fadeIn = (options.fadeInMs ?? 0) / 1000;
      const envelope = options.envelope ?? cue.envelope;
      if (fadeIn > 0) {
        gainNode.gain.setValueAtTime(0, when);
        gainNode.gain.linearRampToValueAtTime(level, when + fadeIn);
      } else if (envelope?.length) {
        gainNode.gain.setValueAtTime(level * envelope[0][1], when);
        envelope.slice(1).forEach(([t, g]) => gainNode.gain.linearRampToValueAtTime(level * g, when + t));
      } else {
        gainNode.gain.value = level;
      }
      const isVoice = cue.bus === "voice";
      source.connect(gainNode).connect(isVoice ? master : musicBus);
      // A named stretch of the file (round 66: one line of the narration).
      const seg = options.segment ? cue.segments?.[options.segment] : null;
      const offset = (seg ? seg[0] : (cue.start ?? 0)) + (options.offset ?? 0) + late;
      if (offset >= buffer.duration) return;
      if (seg) {
        const length = Math.max(0.05, seg[1] - offset);
        source.start(when, offset, length);
        // The edges eased (20 ms) so a cut between words never clicks.
        gainNode.gain.setValueAtTime(0, when);
        gainNode.gain.linearRampToValueAtTime(level, when + 0.02);
        gainNode.gain.setValueAtTime(level, when + length / rate - 0.02);
        gainNode.gain.linearRampToValueAtTime(0, when + length / rate);
        if (isVoice && musicBus) {
          // The music dips just before she speaks and comes back after.
          musicBus.gain.setTargetAtTime(options.duck ?? VOICE_DUCK, Math.max(ctx.currentTime, when - 0.3), 0.1);
          musicBus.gain.setTargetAtTime(1, when + length / rate + 0.15, 0.35);
        }
      } else {
        source.start(when, offset);
      }
      handle.state = "playing";
      handle.position = () => {
        const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
        return Math.max(0, heard - when) * rate;
      };
      if (options.until != null) {
        const end = ctx.currentTime + Math.max(0, (options.until - performance.now()) / 1000);
        const fade = Math.max(0.02, (options.fadeOutMs ?? 250) / 1000);
        gainNode.gain.setValueAtTime(level, Math.max(when, end - fade));
        gainNode.gain.linearRampToValueAtTime(0, end);
        source.stop(end + 0.02);
      }
      live.add(handle);
      source.onended = () => live.delete(handle);
    });
    return handle;
  }

  /*
   * Round 69: the narrator's third part -- 18 recordings, 58 minutes. Far too
   * much to decode up front the way the cues are (as float PCM, about 600 MB),
   * so each line is fetched and decoded on its own: a byte range of its MP3
   * (the recordings are constant-bitrate, so a time maps to a frame and a
   * frame to a byte), decoded with decodeAudioData and played as an ordinary
   * buffer through master -- muted with everything else, through the
   * limiter, dipping the music like the other voices.
   *
   * The first version streamed an <audio> element instead. Under a heavy
   * scene (the space events) its route into Web Audio could glitch, which is
   * the likely source of the "sharp spikes" the owner heard, and its timing
   * came from the element's clock rather than the audio clock. A decoded
   * buffer plays on the audio thread, sample-accurate, like every other cue.
   */
  const VOICE_STREAM_GAIN = 1.5; // same as voice1/voice2: Part 3 measures -22 to -23 dB mean, as Part 2 does
  const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const MP3_RATES = [44100, 48000, 32000];
  const LEAD_FRAMES = 12; // decoded and thrown away: the bit reservoir needs the frames before
  const mp3Heads = new Map();   // file -> Promise<{ start, frameBytes, rate, skip }|null>
  const fullFiles = new Map();  // file -> Promise<ArrayBuffer|null>, only if a server ignores Range
  const spanBuffers = new Map(); // "file@start-end" -> Promise<{ buffer, offset }|null>
  let speaking = 0;              // lines currently heard, for the duck

  function readMp3Head(file) {
    if (!mp3Heads.has(file)) {
      mp3Heads.set(file, fetch(AUDIO_ROOT + encodeURIComponent(file), { headers: { Range: "bytes=0-65535" } })
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .then((data) => {
          if (!data) return null;
          const b = new Uint8Array(data);
          let at = 0;
          // ID3v2 tag: 10-byte header, syncsafe size, optional footer.
          if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
            at = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) + ((b[5] & 0x10) ? 10 : 0);
          }
          while (at < b.length - 4 && !(b[at] === 0xff && (b[at + 1] & 0xe0) === 0xe0)) at += 1;
          if (at >= b.length - 4) return null;
          const bitrate = MP3_BITRATES[b[at + 2] >> 4] * 1000;
          const rate = MP3_RATES[(b[at + 2] >> 2) & 3];
          if (!bitrate || !rate) return null;
          const frameBytes = (144 * bitrate) / rate;
          const mono = (b[at + 3] >> 6) === 3;
          // A LAME "Info"/"Xing" frame first carries no audio; it holds the encoder delay.
          const tagAt = at + 4 + (mono ? 17 : 32);
          const tag = String.fromCharCode(b[tagAt], b[tagAt + 1], b[tagAt + 2], b[tagAt + 3]);
          let skip = 576 + 529; // encoder + decoder delay, LAME's usual
          let start = at;
          if (tag === "Info" || tag === "Xing") {
            const delay = (b[tagAt + 141] << 4) | (b[tagAt + 142] >> 4);
            if (delay > 0 && delay < 3000) skip = delay + 529;
            start = at + Math.floor(frameBytes) + ((b[at + 2] >> 1) & 1);
          }
          return { start, frameBytes, rate, skip };
        })
        .catch(() => null));
    }
    return mp3Heads.get(file);
  }

  async function fetchRange(file, from, to) {
    const url = AUDIO_ROOT + encodeURIComponent(file);
    if (!fullFiles.has(file)) {
      const response = await fetch(url, { headers: { Range: `bytes=${from}-${to}` } }).catch(() => null);
      if (response?.status === 206) return response.arrayBuffer();
      // The server sent the whole file: keep it, and cut ranges from it here.
      fullFiles.set(file, response?.ok ? response.arrayBuffer() : Promise.resolve(null));
    }
    const whole = await fullFiles.get(file);
    return whole ? whole.slice(from, to + 1) : null;
  }

  /** Decodes seconds [start, end] of a recording; resolves { buffer, offset } or null. */
  function spanBuffer(file, start, end) {
    const key = `${file}@${start}-${end}`;
    if (!spanBuffers.has(key)) {
      spanBuffers.set(key, (async () => {
        const head = await readMp3Head(file);
        if (!head || !ctx) return null;
        const firstSample = start * head.rate + head.skip;
        const lastSample = end * head.rate + head.skip;
        const k0 = Math.max(0, Math.floor(firstSample / 1152) - LEAD_FRAMES);
        const k1 = Math.ceil(lastSample / 1152) + 4;
        const from = head.start + Math.floor(k0 * head.frameBytes);
        const to = head.start + Math.ceil(k1 * head.frameBytes) + 4;
        const data = await fetchRange(file, from, to);
        if (!data) return null;
        // Begin exactly on a frame: the first sync word within the range.
        const b = new Uint8Array(data);
        let sync = 0;
        while (sync < 1200 && !(b[sync] === 0xff && (b[sync + 1] & 0xe0) === 0xe0 && (b[sync + 2] >> 4) !== 0)) sync += 1;
        const k = Math.round((from + sync - head.start) / head.frameBytes);
        const buffer = await ctx.decodeAudioData(data.slice(sync)).catch(() => null);
        if (!buffer) return null;
        softenSpikes(buffer);
        limitPeaks(buffer);
        // The decoded chunk starts at stream sample k * 1152, less the
        // decoder's own 1,105-sample delay, which a decoder trims from the
        // front of whatever it is given. Measured (round 69): with it, the
        // chunk matches the whole file's decode at lag 0 (envelope
        // correlation 1.00 on four lines); without it, 25 ms late.
        const offset = (firstSample - 1105 - k * 1152) / head.rate;
        return { buffer, offset, length: end - start };
      })());
      // Keep the last few dozen lines; a replay of one is then instant.
      if (spanBuffers.size > 24) spanBuffers.delete(spanBuffers.keys().next().value);
    }
    return spanBuffers.get(key);
  }

  /*
   * Round 70 (Prompts.md: "sharp spikes of sound in the CME and magnetic
   * shield events, near the end"). They are in the recordings: single 5 ms
   * bursts far above the speech around them (in the magnetosphere line a
   * 0.60 peak among 0.20-0.36; in the CME line 0.55 among about 0.27), which
   * the +3.5 dB voice gain then drove into the master limiter. Each decoded
   * line is scanned once: a 5 ms window more than 1.8x louder than everything
   * within 15-60 ms either side is brought down to 1.3x that, with the gain
   * eased in and out over a window, so the word is still there and the click
   * is not. Plosives that are merely loud are well under 1.8x their
   * neighbours and are left alone.
   */
  function softenSpikes(buffer) {
    const rate = buffer.sampleRate;
    const hop = Math.max(1, Math.round(rate * 0.005));
    let softened = 0;
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const data = buffer.getChannelData(c);
      const windows = Math.floor(data.length / hop);
      const peak = new Float32Array(windows);
      for (let w = 0; w < windows; w += 1) {
        let max = 0;
        for (let i = w * hop, end = i + hop; i < end; i += 1) { const v = Math.abs(data[i]); if (v > max) max = v; }
        peak[w] = max;
      }
      for (let w = 12; w < windows - 12; w += 1) {
        if (peak[w] < 0.3) continue;
        let ref = 0;
        for (let k = 3; k <= 12; k += 1) ref = Math.max(ref, peak[w - k], peak[w + k]);
        if (peak[w] <= 1.8 * ref) continue;
        const gain = (1.3 * ref) / peak[w];
        // The burst's window and one either side, eased over half a window.
        const from = (w - 1) * hop;
        const to = (w + 2) * hop;
        const ease = hop / 2;
        for (let i = from; i < to; i += 1) {
          const edge = Math.min(i - from, to - 1 - i);
          const g = edge >= ease ? gain : 1 - (1 - gain) * (edge / ease);
          data[i] *= g;
        }
        softened += 1;
      }
    }
    return softened;
  }

  /*
   * Round 72 (the owner: still a spike in the CME story near "one of these
   * storms painted aurora", and in the magnetic shield's after "glows green
   * and red"). Those are the loudest syllables of the two loudest event lines
   * -- 0.49 and 0.60 peak in the file, 0.74 and 0.90 at her 1.5x gain -- and
   * the master limiter (20:1 above 0.71) clamped them, which is what was
   * heard. Round 71's compressor did not help: a DynamicsCompressorNode adds
   * automatic make-up gain (about +4 dB at those settings), so it raised
   * everything else into the limiter instead. It is gone. In its place each
   * line is limited once, in the buffer, before it plays: no sample may come
   * out above 0.42 (0.63 after her gain, under the limiter's knee). The gain
   * is worked out in 64-sample blocks, held for 5 ms either side so it is
   * already down when a peak arrives, and released over 80 ms -- the way a
   * mastering limiter does it, so a loud word is only a little less loud.
   */
  const VOICE_CEILING = 0.42;
  function limitPeaks(buffer, ceiling = VOICE_CEILING) {
    const rate = buffer.sampleRate;
    const block = 64;
    const blocks = Math.ceil(buffer.length / block);
    const need = new Float32Array(blocks).fill(1);
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const data = buffer.getChannelData(c);
      for (let k = 0; k < blocks; k += 1) {
        let max = 0;
        for (let i = k * block, end = Math.min(data.length, i + block); i < end; i += 1) {
          const v = Math.abs(data[i]); if (v > max) max = v;
        }
        if (max > ceiling) need[k] = Math.min(need[k], ceiling / max);
      }
    }
    // Hold: each block takes the lowest gain within 5 ms either side.
    const hold = Math.max(1, Math.round((0.005 * rate) / block));
    const held = new Float32Array(blocks);
    for (let k = 0; k < blocks; k += 1) {
      let g = 1;
      for (let j = Math.max(0, k - hold), end = Math.min(blocks - 1, k + hold); j <= end; j += 1) g = Math.min(g, need[j]);
      held[k] = g;
    }
    // Release over 80 ms going forward, and ease in over 2 ms going back.
    const release = 1 - Math.exp(-block / (0.08 * rate));
    const attack = 1 - Math.exp(-block / (0.002 * rate));
    const gain = new Float32Array(blocks);
    let g = 1;
    for (let k = 0; k < blocks; k += 1) { g = Math.min(held[k], g + (1 - g) * release); gain[k] = g; }
    for (let k = blocks - 2; k >= 0; k -= 1) gain[k] = Math.min(gain[k], gain[k + 1] + (gain[k] - gain[k + 1]) * (1 - attack));
    let touched = 0;
    for (let k = 0; k < blocks; k += 1) if (gain[k] < 0.999) touched += 1;
    if (!touched) return 0;
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i += 1) {
        // Interpolated between block centres, so the gain never steps.
        const pos = i / block - 0.5;
        const k = Math.max(0, Math.min(blocks - 1, Math.floor(pos)));
        const t = Math.max(0, Math.min(1, pos - k));
        const gk = gain[k];
        const gn = gain[Math.min(blocks - 1, k + 1)];
        data[i] *= gk + (gn - gk) * t;
      }
    }
    return touched;
  }

  function duck(on) {
    if (!musicBus || !ctx) return;
    speaking = Math.max(0, speaking + (on ? 1 : -1));
    const now = ctx.currentTime;
    musicBus.gain.setTargetAtTime(speaking > 0 ? VOICE_DUCK : 1, now, speaking > 0 ? 0.1 : 0.35);
  }

  /*
   * Plays seconds [start, end] of a recording as narration. Returns a
   * handle: state ("pending" | "playing" | "ended" | "stopped" | "none"),
   * stop(fadeMs), and `done`, a promise that settles "ended" or "stopped".
   */
  function speakSpan(file, start, end, options = {}) {
    let settle;
    const handle = { state: "none", stop() {}, done: new Promise((resolve) => { settle = resolve; }) };
    if (!ctx || !master || !enabled) { settle("stopped"); return handle; }
    handle.state = "pending";
    const level = options.gain ?? VOICE_STREAM_GAIN;
    let source = null;
    let gainNode = null;
    let ducked = false;
    let finished = false;
    const finish = (how) => {
      if (finished) return;
      finished = true;
      if (ducked) duck(false);
      ducked = false;
      live.delete(handle);
      handle.state = how;
      settle(how);
    };
    handle.stop = (fadeMs = 250) => {
      if (finished) return;
      if (source && gainNode && ctx) {
        const now = ctx.currentTime;
        const fade = Math.max(0.02, fadeMs / 1000);
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + fade);
        source.onended = null;
        try { source.stop(now + fade + 0.02); } catch (error) { /* already stopped */ }
      }
      finish("stopped");
    };
    spanBuffer(file, start, end).then((span) => {
      if (finished) return;
      if (!span || !ctx) { finish("stopped"); return; }
      const { buffer, offset, length } = span;
      const when = ctx.currentTime + 0.02;
      const playFor = Math.max(0.05, Math.min(length, buffer.duration - offset));
      source = ctx.createBufferSource();
      source.buffer = buffer;
      gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, when);
      gainNode.gain.linearRampToValueAtTime(level, when + 0.03);
      gainNode.gain.setValueAtTime(level, when + Math.max(0.03, playFor - 0.08));
      gainNode.gain.linearRampToValueAtTime(0, when + playFor);
      source.connect(gainNode).connect(master);
      source.onended = () => finish("ended");
      source.start(when, Math.max(0, offset), playFor + 0.02);
      handle.state = "playing";
      duck(true);
      ducked = true;
      live.add(handle);
    });
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return handle;
  }

  const play = (name, options) => playAt(name, performance.now(), options);

  function setEnabled(on, { remember = true } = {}) {
    enabled = Boolean(on);
    if (remember) writePreference(enabled);
    if (master && ctx) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(enabled ? 1 : 0, now + 0.25);
      if (enabled && ctx.state === "suspended") ctx.resume().catch(() => {});
    }
    listeners.forEach((listener) => listener(enabled));
  }

  return {
    preload,
    unlock,
    play,
    playAt,
    speakSpan,
    /** True once the audio context exists (after the first click). */
    isUnlocked: () => Boolean(ctx),
    has: (name) => Boolean(resolveCue(name)),
    /** Seconds a named segment of a cue lasts (0 if there is no such cue). */
    /** A number a cue carries for timing (e.g. voice1.beyondAt). */
    cueValue(name, key) { return resolveCue(name)?.[key] ?? 0; },
    segmentLength(name, segment) {
      const seg = resolveCue(name)?.segments?.[segment];
      return seg ? seg[1] - seg[0] : 0;
    },
    /** Seconds from where a cue starts playing to its main hit. */
    accentOf(name) {
      const cue = resolveCue(name);
      return cue ? Math.max(0, (cue.accent ?? cue.start ?? 0) - (cue.start ?? 0)) : 0;
    },
    /** Resolves when these cues are decoded (or after maxMs, whichever is first). */
    ready(names, maxMs = 1500) {
      const all = Promise.all(names.map((name) => {
        const cue = resolveCue(name);
        return cue ? bufferFor(cue.file, cue.reverse) : null;
      }));
      return Promise.race([all, new Promise((resolve) => setTimeout(resolve, maxMs))]);
    },
    isEnabled: () => enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stopAll(fadeMs = 400) {
      live.forEach((handle) => handle.stop(fadeMs));
    },
    /** Round 65: releases the audio device when the page goes away. */
    close() {
      try { ctx?.close(); } catch (error) { /* already closed */ }
      ctx = null;
      spanBuffers.clear();
      fullFiles.clear();
      buffers.clear();
      seams.clear();
    },
  };
}

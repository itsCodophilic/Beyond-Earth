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
      bytes.set(file, fetch(AUDIO_ROOT + file)
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
      source.connect(gainNode).connect(master);
      const offset = (cue.start ?? 0) + (options.offset ?? 0) + late;
      if (offset >= buffer.duration) return;
      source.start(when, offset);
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
    has: (name) => Boolean(resolveCue(name)),
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
      buffers.clear();
      seams.clear();
    },
  };
}

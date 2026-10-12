# Beyond Earth — the seven sounds, made in Suno

## How to work in Suno for this

- **Suno can't hit exact lengths or timestamps.** So don't fight for exact seconds in Suno. Get the *character* right, and I'll cut, line up and fade each file in code, to the millisecond, against the timeline below.
- **Use the right Suno mode for each sound:**
  - **Sounds → One Shot** (in Create → Custom → Sounds) for single effects: ticks, risers, tones, the boom.
  - **Sounds → Loop** for the ripple loop. Set **BPM** and **Key** where noted.
  - **Song (Custom mode), Instrumental** for the journey (Music 7). Put the style tags in **Style of Music** and the structure tags in the **Lyrics** box.
- **Always:** key **D** wherever there's a Key setting, and add **"no vocals, no music"** to the effects (or **"instrumental, no vocals"** to the songs).
- **Each generation gives two takes.** Make 2–3 rounds and keep the best one. Download as **WAV** if your plan allows (MP3 is fine otherwise).
- **No names in prompts:** Suno rejects artist and film names, so the journey prompt describes the cornfield-chase feel instead.
- **Check the licence:** using the music on a public website depends on your Suno plan, so check its commercial-use terms.

## The timeline I'll sync to (for reference)

| # | File | Plays when… | Length on the site |
|---|---|---|---|
| 1 | `01-tick` + `01-tick-final` | each log line appears (35 lines, 0.4 s apart) | 0.15 s each |
| 2 | `02-title-rise` | BEYOND EARTH starts rising | 11.5 s (hit at 10.0 s) |
| 3 | `03-focus` | the camera starts drifting to the O | 10.0 s (ends at the particle) |
| 4 | `04-fall` | the particle starts falling | 9.8 s |
| 5 | `05-ripple-loop` | the particle settles | loops until the click (one ripple every 4.2 s) |
| 6 | `06a-windup` + `06b-boom` | the click | wind-up 5.3 s, then the boom and a ~6 s settle |
| 7 | `07-journey` | the journey's first frame | 97.5 s (climax at 1:04) |

---

## 1 · Tick — Sounds → One Shot · Key D

```
single soft digital tick, sci-fi mission control console registering a line of data, clean short high click with tiny glassy resonance, instant attack, very short decay, no reverb tail, gentle not harsh, close and dry, under 0.2 seconds, no music
```
**Final tick** (One Shot, Key D):
```
soft "system ready" confirmation chime, two quick glassy notes rising, sci-fi console, clean attack, short airy decay, gentle, about 0.4 seconds, no music
```

## 2 · Title rise — Sounds → One Shot · Key D

```
epic cinematic trailer riser into a massive braam hit, starts almost silent with a deep sub bass drone, slow relentless crescendo of low brass and dark synths growing bigger and wider for about 10 seconds, then one huge deep brass and synth bass braam impact that rings and sustains, title card moment, clean, wide stereo, no drums, no vocals
```
*If One Shot keeps it too short, make it as a Song (Instrumental) instead: Style `cinematic trailer, epic riser, braam, dark brass, sub bass, slow crescendo, instrumental, no vocals, no drums`, with the Lyrics box `[Intro: near silence, sub drone]` `[Build: slow crescendo]` `[Drop: massive braam hit]` `[End]`. I'll cut out the 11.5 s I need.*

## 3 · Focus on the O — Sounds → One Shot · Key D

```
soft ethereal focusing tone, warm sustained pad slowly narrowing and becoming clearer like a camera lens coming into focus, gently rising in pitch and brightness, then an accelerating soft airy inward whoosh, ending on a single pure high tone, delicate, calm, about 10 seconds, no drums, no vocals, no music
```

## 4 · Fall — Sounds → One Shot · Key D

```
soft continuous falling tone, pure gentle sine tone with faint shimmer gliding slowly downward in pitch like something falling through space in slow motion, one unbroken sound, decelerating at the end and settling softly on a low warm note, calm hypnotic, about 10 seconds, no hits, no drums, no music
```

## 5 · Ripple loop — Sounds → Loop · BPM 57 · Key D

At 57 BPM, 4 beats ≈ 4.2 s: one ripple per bar, matching the particle's breathing.

```
seamless ambient loop, soft low drone with a gentle water-like ripple of sound once every bar, resonant soft bloom pulse spreading outward in stereo and fading, calm mysterious heartbeat of light in deep space, patient, quiet, nothing sudden, no drums, no vocals
```

## 6 · Explosion — two One Shots · Key D

I'll place the boom exactly 5.3 s after the click, so it's cleaner as two parts.

**6a · Wind-up** (about 5 s):
```
cosmic energy spin-up then implosion, swirling shimmer orbiting and accelerating with rising pitch and sparkles spiralling outward, then everything sucked inward with reversed whoosh and diving pitch, convulsing faster and faster, narrowing to a tight intense point, ending in a bright thin charging tone, cinematic, no music
```
**6b · Boom** (about 8 s):
```
colossal big bang explosion, deep sub bass boom with wide stereo blast and bright white noise flash, followed by a long dark rumbling tail with glittering debris slowly settling into a quiet low drone, huge clean cinematic, no distortion, no music
```

## 7 · The journey — Song · Custom mode · Instrumental

**Style of Music:**
```
cinematic orchestral space score, instrumental, no vocals, majestic church pipe organ, grand piano, fast repeating 8th note arpeggio ostinato, minimalist building layers, strings, wordless choir pads, awe, wonder, hope, rushing sense of speed and flight, epic crescendo, 120 BPM, D minor, no drums, wide cinematic reverb
```
**Lyrics box** (structure tags only, no words):
```
[Intro: solo piano arpeggio, quiet, emerging from silence]

[Build: pipe organ enters softly under the arpeggio]

[Build: high counter arpeggio, shimmering]

[Build: low strings and organ pedal bass, growing momentum]

[Pre-Chorus: soaring strings over the ostinato]

[Chorus: choir enters, rising intensity]

[Climax: full organ, choir and strings, maximum power and wonder]

[Breakdown: only the arpeggio and a held organ chord, tense, mysterious]

[Outro: resolves to warm radiant D major, final swelling chord]

[End]
```
*Suno will probably make it longer than 97.5 s, which is fine. I'll take the section from the intro to the end of the climax and breakdown, and time it so the climax lands on the Milky Way (1:04) and the outro on the Sun. If a take comes out too short, use **Extend** from its end.*

---

When they're ready, name them as in the table, put them in `public/audio/` and tell me. I'll wire everything up with the "Click to begin" screen and a mute button.

---

## Update (round 62): 6c, and the journey now starts at the Multiverse

**Journey timeline** (seconds from the Big Bang frame; act lengths from `INTRO_TIMING`):

| Journey time | Act | Sound |
|---|---|---|
| 0–12 s | The Big Bang | 6b's burst settling (silent ~7 s in) |
| ~4–20 s | …into Where It Stopped (12–20 s) | **6c**: stretching, then stopping in patches |
| 20 s → 97.5 s | The Multiverse onwards | **7 · the journey** (77.5 s) |

### 6c · Where it stopped — Sounds → One Shot · Key D
```
cinematic space ambient, space still stretching then stopping in patches, starts wide airy and rushing outward, then slowly slowing down, cooling and settling, soft crystalline shimmering tones freezing into place one by one like bubbles closing off, deep warm low pad underneath, calm wonder, ends on a soft sustained open chord that keeps ringing, about 16 seconds, no drums, no vocals, no boom, no impact
```

### 7 · The journey (from the Multiverse) — Song · Custom · Instrumental
**Style of Music:**
```
cinematic orchestral space score, instrumental, no vocals, majestic church pipe organ, grand piano, fast repeating 8th note arpeggio ostinato, minimalist building layers, strings, wordless choir pads, awe, wonder, hope, rushing sense of flight through space, epic crescendo, 120 BPM, D minor, no drums
```
**Lyrics box:**
```
[Intro: shimmering piano arpeggio emerges softly, many worlds appearing]

[Build: pipe organ enters under the arpeggio, one bubble glowing]

[Build: low strings and organ pedal bass, momentum, threads of light]

[Chorus: choir enters, soaring, rising intensity]

[Climax: full organ, choir and strings, maximum power and wonder]

[Breakdown: only the arpeggio and a held organ chord, tense, mysterious]

[Outro: resolves to warm radiant D major, final swelling chord]

[End]
```
| Section | Act | Journey time |
|---|---|---|
| Intro | The Multiverse | 20–28 s |
| Build | Our Universe | 28–40 s |
| Build | The Cosmic Web | 40–52 s |
| Chorus | Laniakea | 52–64 s |
| Climax | The Milky Way | 64–76 s |
| Breakdown | The Orion Arm | 76–88 s |
| Outro | Our Star, then the arrival | 88–97.5 s |

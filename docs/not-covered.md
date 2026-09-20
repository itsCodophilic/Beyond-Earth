# Not covered — and the honest reason why

The companion to `docs/celestial-bodies.md` and `docs/space-events.md`. Those
two say what Beyond Earth contains. This one says what it does not, and
separates four very different reasons for that, because they call for four
different answers.

| | Reason | What to do about it |
|---|---|---|
| **A** | Not built yet | Build it. It is on the backlog. |
| **B** | **Invisible to the human eye** | Build it, and *say* what band it was shifted from. |
| **C** | Cannot be shown at true scale or true time | Build it compressed, and say the compression. |
| **D** | Never observed by anyone | Build it as inference, and never imply otherwise. |

The middle two are the interesting ones and B is the one this project keeps
getting wrong.

---

# B. The spectrum problem

**A large part of what is scientifically most interesting about the Solar
System emits no visible light at all.**

Every famous image of Jupiter's aurora, Titan's surface, Venus's surface, Io's
plasma torus and the edge of the heliosphere is a **false-colour
representation** — a measurement in some other band mapped into red, green and
blue so that a human eye can read it. That is entirely legitimate science and
entirely standard practice. What is not legitimate is drawing one and letting a
viewer believe it is what they would see out of a window.

## The rule this project adopts

> Anything drawn from outside the 380–700 nm visible band must be **labelled
> with the band it came from**, in the dossier and on the event card, in plain
> words — and nothing invisible may be drawn as though it were a photograph.

Suggested wording, short enough for a card:

> *Shown in false colour. Jupiter's aurora radiates mostly in the ultraviolet;
> the eye would see almost nothing here.*

A `spectrum` field on the roster entry, rendering as a small chip, is the
cheapest way to carry it — the same way `accuracy` already marks the four
representative stagings.

## The catalogue

### Ultraviolet — would be invisible, or nearly so

| Thing | What is actually happening |
|---|---|
| **Jupiter's aurora** | The main emission is far-ultraviolet hydrogen. Every Hubble image of it is UV mapped into colour. Jupiter's aurora is also hundreds of times more powerful than Earth's and is driven by Io's volcanoes rather than by the solar wind. |
| **Saturn's aurora** | Also predominantly ultraviolet. |
| **Ganymede's aurora** | Ultraviolet, found by Hubble — and the wobble in those UV bands is the evidence for Ganymede's subsurface ocean. |
| **Io's plasma torus** | A doughnut of sulphur and oxygen ions around Jupiter, glowing in the **extreme ultraviolet**. Utterly invisible, and one of the largest structures in the Jovian system. |
| **The Sun's corona and coronal loops** | Every image of loops and coronal holes is extreme-ultraviolet or soft X-ray. In visible light the corona is overwhelmed by the photosphere and can only be seen during a total eclipse or behind a coronagraph. **Coronal holes do not exist in visible light at all.** |

### Infrared — invisible, and in two cases it is the only way to see the ground

| Thing | What is actually happening |
|---|---|
| **Titan's surface** | Titan is wrapped in an orange haze that is opaque in visible light. Cassini mapped the ground through narrow **near-infrared windows** at about 938 nm and 2 µm, and by **radar**. Any render of Titan's lakes and rivers is one of those, not a photograph. |
| **Venus's surface** | Permanently hidden under cloud. Magellan mapped the entire planet by **radar**; the night side also glows faintly at about 1 µm in the near-infrared, which is how surface temperature differences are read. Every image of Venusian terrain is radar altimetry rendered as relief. |
| **Neptune's aurora** | Hunted for thirty years and found only in **2025**, by JWST, through H₃⁺ emission in the infrared. Voyager 2 flew past Neptune in 1989 and did not see it. |
| **Uranus's aurora** | Detected in the infrared through H₃⁺ emission near 3.9 µm, and separately in the ultraviolet. |
| **Enceladus's tiger stripes** | The stripes are defined by being *warm*. Cassini's infrared spectrometer is what showed the heat; in visible light they are four unremarkable cracks. |
| **Thermal emission generally** | Every "this region is hotter" statement about any world is infrared. |

### Radio — not light in any sense a person could see

| Thing | What is actually happening |
|---|---|
| **Jupiter's decametric radio emission** | Jupiter is one of the brightest radio sources in the sky, modulated by Io's position. There is nothing to look at. |
| **Saturn kilometric radiation** | Used to measure the planet's rotation period, since Saturn has no visible surface features tied to its interior. |
| **Radar mapping** | Venus, Titan, and near-Earth asteroid shapes. The "image" is a reconstruction from echo timing. |

### Particles and fields — not electromagnetic radiation at all

Nothing here emits anything. These can only ever be **diagrams**, and calling
them anything else is a straightforward falsehood.

- **Magnetospheres** — bow shock, magnetopause, magnetotail, field lines. A
  magnetic field is not visible at any wavelength. What is sometimes visible is
  what the field *does* to charged particles, which is the aurora.
- **Radiation belts** — Van Allen, and Jupiter's far fiercer ones. Trapped
  particles. Invisible.
- **The solar wind** — invisible in flight. It is detected by spacecraft flying
  through it and seen only where it strikes something.
- **Solar energetic particle storms** — protons at a fraction of light speed.
  Instruments register them as noise on their own detectors.
- **Cosmic rays and interstellar pickup ions** — the same.
- **Neutrinos** — a supernova releases 99% of its energy as neutrinos, and that
  99% is invisible. The light is the leftover 1%.
- **Gravitational waves** — GW170817, the kilonova already in the roster, was
  *detected* as a gravitational wave first. That detection is not light.

### The heliosphere — a special case worth stating on its own

The termination shock, heliosheath, heliopause and heliotail emit no light.
They are mapped by **energetic neutral atoms** — IBEX built the first all-sky
map of the boundary from them, and IMAP continues it — and by the two Voyagers
physically crossing the boundary and reporting the plasma density change from
the far side.

So any heliosphere region this project builds is a **model**, drawn from
particle counts and two spacecraft's worth of in-situ measurements. It should
look like an instrument's reconstruction rather than a photograph, and it
should say so.

### Things that are visible but effectively never seen

Not false colour — just far too faint for the impression most renders give.

- **Jupiter's rings.** Already handled: they are drawn in forward-scattered
  light, the geometry every real image of them used, and `celestial-bodies.md`
  records that. At their true back-scattered brightness they are nothing.
- **Uranus's rings.** Charcoal-dark. Found in 1977 by watching a star wink out
  from behind them, not by looking.
- **The zodiacal light.** Genuinely visible to the naked eye, and only from a
  properly dark site on a clear moonless night.
- **Enceladus's plume.** Visible when back-lit by the Sun and invisible
  otherwise — the same forward-scattering geometry as Jupiter's rings.

---

# C. Cannot be shown at true scale or true time

The site already compresses both, and the compression is correct. It only
becomes a problem when it is silent.

**Scale.** At true scale the Solar System is almost entirely empty and there is
nothing to look at. Neptune at 30 AU beside a 1-pixel Sun is a black screen.
Every distance in the scene is compressed; the distance readout carries the
*real* figure, which is the right split and should stay that way.

**Time.** Several phenomena on the backlog run longer than any viewer's
patience by many orders of magnitude:

| Phenomenon | Real duration |
|---|---|
| Mars global dust storm | weeks to months |
| Saturn's Great White Spot | once per **30-year** orbit |
| Ring-plane crossing | every **~15 years** |
| A Uranian season | **21 years** |
| The solar cycle | **11 years** |
| Pluto's seasonal atmosphere | a **248-year** orbit |
| Venus transit | next in **2117** |
| Pluto–Charon mutual eclipse season | every **124 years** |

The existing footnote — *"timings are compressed, but the sizes, colours,
durations and rates are the observed ones"* — is the right line and should be
repeated wherever a long-cycle event is staged.

**Population.** NASA describes roughly 1.4 million known asteroids and about
4,000 known comets. Individually modelling them is neither possible nor
useful. The asteroid belt already answers this correctly with a representative
instanced population, and the Kuiper Belt, Oort Cloud, Trojans and near-Earth
objects should all be built the same way — **statistically honest populations,
not catalogues**.

---

# D. Never observed by anyone

Two things in the plan have never been seen, and one thing already in the
roster has been seen exactly once.

**The Oort Cloud.** Never directly observed at any wavelength. It is inferred
entirely from the orbits of long-period comets and from models. NASA describes
it as a *predicted* spherical shell somewhere between roughly 5,000 and
100,000 AU. If it is built, it has to look inferred — a probability shell, not
a field of rocks — and the copy must say so outright.

**Saturn's impacts.** Nobody has caught one. The 1983 date comes from ripples
Cassini found in the rings, read backwards. Already marked in the roster.

**Triton's geysers.** Seen once, by Voyager 2, on 25 August 1989. No spacecraft
has been back in the 37 years since. The vents are thought to run for about a
year each and the driver is seasonal, so *ongoing* there means the process is
believed to continue — not that anybody has watched it. This should be marked
the same way Saturn's impact is.

---

# A. Simply not built yet

These are neither impossible nor dishonest — just absent. Full detail lives in
`docs/beyond-earth-missing-and-recommended-coverage.md`; the event-shaped ones
are filed as a sized backlog in `docs/space-events.md`.

**Regions, in priority order**

1. ~~**Kuiper Belt population**~~ — **built.** Six sub-populations with real
   orbital elements, the Kuiper Cliff as a hard edge, phased resonant groups
   and bimodal colours. See `docs/celestial-bodies.md`.
2. ~~**Oort Cloud**~~ — **built**, as inference: a limb-brightened shell of
   probability with a deliberately unresolved scattering inside it, isotropic
   rather than flat (measured mean |sin latitude| 0.507 against 0.5 for a
   perfect sphere), and every card about it says the word inferred.
3. ~~**Heliosphere**~~ — **built**: termination shock at ~85 AU and heliopause
   at ~120 AU, as squashed offset bubbles with a heliotail. Still missing the
   solar wind itself and the heliosheath as separate objects. The heliopause
   is captioned as the edge of the solar *wind*, never of the Solar System —
   the Sun's gravity reaches eight hundred times further, out through the
   Oort Cloud.
4. **Near-Earth objects** — Atens, Apollos, Amors, potentially hazardous
   asteroids, close approaches.
5. **Comets as travelable bodies** — nucleus, coma, dust tail and ion tail as a
   real object rather than the one event that exists.
6. **Trojan populations** — Jupiter's L4 and L5 swarms are mentioned in the
   asteroid belt but not built as their own thing; Neptune's are not mentioned.
7. **Asteroid families and Kirkwood gaps** — the belt is a field rather than a
   structured population.

**Bodies**

No comets as objects. No spacecraft. No Mars moons beyond placement. No
individual Kuiper Belt objects beyond the eight named worlds.

**Layers**

Magnetospheres (as diagrams, per B). Radiation belts (same). Planetary
seasons. Tidal locking, tidal heating and orbital resonance as things the site
*shows* rather than states — the Laplace resonance between Io, Europa and
Ganymede is the mechanism behind two events already in the roster and is
currently invisible. Solar System formation as a historical timeline.
Interstellar visitors.

---

## One line to take away

Roughly half of what makes the Solar System scientifically interesting cannot
be seen. Beyond Earth should show it anyway — and should always say which
window it was looking through.

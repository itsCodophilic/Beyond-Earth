# Space events — the panel redesign

The spec for replacing the current right-hand-side events sheet with a
full-screen **Dial**: an orrery you navigate by, with a table beside it you
read from.

Four concepts were drawn and this is the one that was chosen. What follows is
what it is, why each decision is what it is, and what has to be built.

---

## 1. The problem being solved

The present panel is a list of seventeen cards in a strip down the right-hand
side. Three things are wrong with it, and only the first is cosmetic.

**It hides the shape of the roster.** Seventeen cards in a column tell you
nothing about the fact that Saturn hosts three events and Venus hosts none, or
that two of them are not in the Solar System at all.

**It spends the screen badly.** The panel is a third of the width and the
scene behind it is hidden anyway while the sheet is open. Half the sheet is
whitespace and the other half is a scroll.

**It has to explain itself in words.** The `kind` and `family` tags added in
the taxonomy pass are correct and nobody reads them. A tag that has to be
defined in a tooltip has failed; the same fact placed on a chart is free.

---

## 2. The idea

> The panel becomes the Solar System.

A full 360° dial. Rings are real orbital distance. Every event is a mark on
the ring where it happens, coloured by cadence. Beside it, a table of the same
events, and the two move together — the dial is for looking, the table is for
reading.

---

## 3. Domain — the spine

The single most important change, and it is a data change before it is a
design change.

**An event does not happen on a planet. It happens in a domain.** Filing by
host body is what the current roster does and it is wrong in at least three
places: a solar eclipse does not happen *to* the Sun or *to* Earth, a coronal
mass ejection leaves the Sun almost immediately, and a supernova is not in the
Solar System at all.

So every event gains a `domain`, ordered by altitude:

| # | Domain | What it means | Now |
|---|--------|---------------|-----|
| 1 | **Beyond the Solar System** | Another star, another galaxy | 2 |
| 2 | **Interplanetary space** | The emptiness between the worlds | 2 |
| 3 | **Near-space** | Exosphere, ring plane, the space just off a world | 2 |
| 4 | **Orbital geometry** | In the line between three bodies | 1 |
| 5 | **A world's atmosphere** | In the air, above solid ground | 6 |
| 6 | **A world's surface** | On rock, ice or sulphur | 4 |

`family` stays as it is — it says what kind of *physics* an event is. `domain`
says *where in space* it takes place. They are different questions and the
roster needs both.

### Assignments for the current seventeen

| Event | Domain |
|---|---|
| Coronal mass ejection · Sungrazing comet | Interplanetary space |
| Sodium tail · Ring spokes | Near-space |
| Solar eclipse | Orbital geometry |
| Meteor shower · Global dust storm · Impact swarm ×2 · Great White Spot · Bright storm outbreak | A world's atmosphere |
| Lunar impact flash · Volcanic plume · Ocean venting · Nitrogen geysers | A world's surface |
| Supernova · Kilonova | Beyond the Solar System |

---

## 4. The dial

### Geometry

- One 200 × 200 SVG viewBox, square, scaling to its container.
- The Sun at the centre with a soft radial glow, radius ≈ 26 units.
- **Orbit rings at real distance on a log scale.** Linear distance is useless
  here: Mercury at 0.39 AU and Neptune at 30 AU differ by a factor of 77, so a
  linear dial crushes the four inner planets into the Sun. The mapping is

      r(au) = R_IN + (log10(au) − log10(0.3)) / (log10(34) − log10(0.3)) × (R_OUT − R_IN)

  with `R_IN = 17`, `R_OUT = 82`. Rings are drawn for Mercury, Earth, Mars,
  Jupiter, Saturn, Uranus and Neptune and labelled at the top of each ring.
- **A dashed ring at `r = 92`, outside every orbit, for *beyond Sol*.** This is
  where the supernova and the kilonova sit, and it is the whole reason the dial
  is honest: those two are not in the system and the drawing says so.
- A slow conic-gradient sweep behind the rings, one rotation per 64s, disabled
  under `prefers-reduced-motion`. It is what makes the dial read as an
  instrument rather than a diagram.

### Marks

Each event is a group: a faint radial spoke back to the Sun at 22% opacity, an
invisible 7-unit hit circle, and a 1.7-unit pip in its cadence colour that
grows to 2.4 on hover or selection. Selection adds an amber halo ring.

Angles are distributed evenly around the circle by roster index rather than by
true longitude. True longitudes would cluster and overlap; even spacing is the
readable lie and nothing in the design claims otherwise.

### The centre

The count of currently shown events, large, in the serif. It changes as the
domain filter changes, which makes the filter's effect obvious without a
second label.

---

## 5. The table

Directly beside the dial, sharing its selection.

| Column | Content |
|---|---|
| **Where** | Host body, mono caps, amber |
| **Event** | Title in the display serif, with its domain beneath in mono |
| **Cadence** | One chip: coloured dot + the word |
| **How often** | The real rate, in words |

Selected row carries a 2px amber inset on its first cell. Hovering a row
highlights its mark on the dial and vice versa.

A row of domain filter buttons sits above the table — `All domains · 17` plus
one per domain with its count. Filtering dims the excluded marks on the dial to
16% opacity rather than removing them, so the shape of the whole roster stays
visible while a subset is picked out.

---

## 6. Colour

**Colour encodes cadence and nothing else.** Domain is carried by position on
the dial and by words in the table. The rule matters: a chart that asks a
reader to hold two colour keys at once is a chart nobody reads.

| Cadence | Mark | Meaning |
|---|---|---|
| One-off | `#e0574b` | It happens, it is over. The next one is a separate event. |
| Recurring | `#8272e8` | Comes back on a schedule an orbit or a season sets. |
| Ongoing | `#19a87c` | Never stops. What changes is how strong it is. |

These three were run through a palette validator against the `#0a0f1c` panel
surface and pass on all five checks: lightness band, chroma floor,
colour-blind separation (worst adjacent pair ΔE 19.8 deutan / 9.9 tritan),
normal-vision floor and contrast. The earlier rose/ice-blue/green trio failed
two of them — the blue and green collided under tritanopia at ΔE 5.2.

**Chip text stays ink-coloured with a dot beside it**, never the cadence colour
itself, so identity is never carried by colour alone.

Amber `#ffc482` is reserved for interactive chrome — selection, filters,
focus. It never classifies anything.

---

## 7. Type

| Role | Face | Used for |
|---|---|---|
| Display | **Instrument Serif** | Event names, the dial's centre count, section heads |
| Data | **Martian Mono** | Every label, chip, number, axis tick |
| Body | **Inter** | Running prose only |

The serif is the deliberate move. The site is entirely monospace and sans at
present, and an event name set in a high-contrast serif reads as a *named
thing* — an observatory plate, a catalogue entry — rather than a row in a UI.

---

## 8. What has to be built

1. **`domain` on every roster entry** in `src/js/scene/events/solarSystemEvents.js`,
   with a `DOMAINS` vocabulary beside `EVENT_KINDS` and `EVENT_FAMILIES`, and
   `domain` / `domainLabel` / `domainBlurb` exposed through `list()`.
2. **A new panel module**, replacing `src/js/ui/spaceEventsDashboard.js`'s sheet
   layout. Keep its `onView` contract exactly: the dashboard never stages an
   event itself, it calls back into `presentSolarEvent`, which closes the panel,
   flies the camera and counts down. None of that changes.
3. **The dial as inline SVG**, rebuilt on filter or selection change. No library.
   Seventeen marks and eight rings is not a case for D3.
4. **The fonts**, from Google Fonts, with real fallback stacks.
5. **The detail drawer** — the existing per-event content plus a plain-language
   gloss of what the cadence and the domain mean, which is the part that stops
   the tags needing a tooltip.

### What must not change

- The five-second arrival delay and its countdown.
- `getAvailability()` and the "travel out to X first" state — moons are still
  hydrated lazily and the panel must still say so before a press fails.
- `is-space-event` taking the screen for an event's duration.

---

## 9. The three that were not chosen

Recorded because the reasons are worth keeping.

**Cadence** — a single logarithmic axis of how often each event happens, rows
by family, ongoing events in an *always* band pinned to the left. The best of
the four at *teaching* the taxonomy, and the weakest at being a place you go to
pick something. Worth building later as a second view behind a toggle.

**Plate Archive** — each event as an observatory glass plate with its
provenance stamped on it. The only layout that answers "did this really
happen?" without being asked. **Its provenance line should be folded into the
Dial's drawer**: who saw it, with what, when — and, in the two cases where
nobody has, that it is inferred rather than witnessed.

**Control** — mission control with a taxonomy rail, a large centre readout and
a dense manifest. The most usable and the least memorable.

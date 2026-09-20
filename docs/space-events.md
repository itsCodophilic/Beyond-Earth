# Space events — the catalogue

Everything in `src/js/scene/events/solarSystemEvents.js`. Seventeen events,
each staged once on request: travel to the body, wait
`EVENT_ARRIVAL_DELAY_SECONDS` (5s), watch it happen, take it apart. Nothing
loops and nothing autoplays.

This file exists so that adding an eighteenth is a matter of reading, not
archaeology. It says what is already covered, how each one is built, and —
at the end — the specific mistakes this code has already made, because most
of them are the kind anyone would make twice.

---

## The roster at a glance

| # | id | Body | Title | Kind | Family | Runs | Framing |
|---|----|------|-------|------|--------|------|---------|
| 1 | `jupiter-impact` | Jupiter | Impact swarm | one-off | impact | 15s | day side |
| 2 | `saturn-impact` | Saturn | Impact swarm | one-off | impact | 15s | day side |
| 3 | `io-eruption` | Io | Volcanic plume | ongoing | surface | 16s | default |
| 4 | `enceladus-plumes` | Enceladus | Ocean venting to space | ongoing | surface | 18s | default |
| 5 | `meteor-shower` | Earth | Meteor shower | recurring | small body | 17s | day side |
| 6 | `solar-cme` | Sun | Coronal mass ejection | one-off | solar | 18s | default |
| 7 | `sungrazer` | Sun | Sungrazing comet | one-off | small body | 18s | pulled back |
| 8 | `mars-dust-storm` | Mars | Global dust storm | recurring | planetary | 22s | day side |
| 9 | `saturn-white-spot` | Saturn | Great White Spot | recurring | planetary | 24s | day side, pitched 37° |
| 10 | `ring-spokes` | Saturn | Ring spokes | recurring | ring | 20s | day side, pitched 60°, back 2.4× |
| 11 | `lunar-impact-flash` | Moon | Lunar impact flash | one-off | impact | 20s | terminator, back 3.0× |
| 12 | `solar-eclipse` | Earth | Solar eclipse | recurring | alignment | 22s | 20° off sunward, back 2.9× |
| 13 | `supernova` | *deep sky* | Supernova | one-off | deep sky | 26s | clear sky, in view |
| 14 | `kilonova` | *deep sky* | Kilonova | one-off | deep sky | 20s | clear sky, in view |
| 15 | `mercury-sodium-tail` | Mercury | Sodium tail | ongoing | planetary | 20s | 90° off sunward, back 2.2× |
| 16 | `uranus-storms` | Uranus | Bright storm outbreak | recurring | planetary | 22s | back 1.55× |
| 17 | `triton-geysers` | Triton | Nitrogen geysers | ongoing | surface | 20s | day side, back 1.5× |

Coverage by host: Sun 2 · Mercury 1 · Earth 2 · Moon 1 · Mars 1 · Jupiter 1 ·
Io 1 · Saturn 3 · Enceladus 1 · Uranus 1 · Triton 1 · deep sky 2.

Nothing yet for: Venus, Neptune, Pluto, Ceres, Europa, Ganymede, Callisto,
Titan, the asteroid belt, or any comet that is not a sungrazer.

---

## Kind and family — what "event" actually means here

The roster had grown to seventeen and was quietly using one word for three
different things. A lunar impact flash happens once and is gone. A meteor
shower comes back on the same dates every year, because the debris stream is
a fixed place in Earth's orbit. Io's volcanoes never stop at all — what
varies is which vent is running, not whether anything is running. Calling all
three "events" is not wrong so much as unhelpful, because it tells a reader
nothing about whether they are watching a rarity, a date in the calendar, or
the ordinary state of that world.

So every entry carries a `kind` and a `family`. Both vocabularies live in
`EVENT_KINDS` and `EVENT_FAMILIES` at the top of the `EVENTS` array, both are
exposed through `list()` as raw key *plus* reader-facing words, and the
dashboard renders them as two chips. The dashboard never holds a copy of the
vocabulary, so it cannot drift out of step with it.

### Kind — three, deliberately

| Key | Shown as | Means |
|-----|----------|-------|
| `transient` | One-off event | It happens, runs its course, and is over. The next one is a separate event. |
| `recurring` | Recurring event | The same thing comes back on a schedule, set by an orbit, a season, or the solar cycle. |
| `ongoing` | Ongoing process | It never actually stops. What changes is how strong it is, not whether it is happening. |

The line between `transient` and `recurring` is whether the *schedule* is
predictable, not whether the phenomenon repeats. CMEs happen several times a
day at solar maximum, and are still `transient`: no particular one can be put
in a diary. Solar eclipses are `recurring`, because node alignments can be.

### Family — what kind of physics

`solar`, `planetary`, `smallBody`, `impact`, `ring`, `surface`, `alignment`,
`deepSky`.

The family exists because grouping by *host body* hides what events have in
common. The sungrazing comet is filed under the Sun because that is where it
is watched from — but it is a comet dying, not the Sun doing anything, so its
family is `smallBody`. Likewise a solar eclipse is not a solar event: nothing
happens to the Sun, three bodies simply line up, so it is `alignment`.

### `accuracy` — an optional fourth line

Three events are **representative stagings** rather than depictions of a
particular recorded occurrence, and they say so in the dashboard under "what
you are watching":

- **Both impact swarms.** Bodies this size do strike Jupiter and Saturn at
  the rates given, but each arrival is its own object on its own orbit and
  nobody has photographed a swarm. This is not a replay of a documented
  event.
- **The solar eclipse.** A real eclipse is total, annular, partial or hybrid
  depending on how far away the Moon happens to be that day. This is the
  total case.
- **The meteor shower.** The rate, the radiant behaviour and the fixed annual
  dates are real; the particular stream is not identified, so it is not a
  named shower.

If a future event is tied to a specific historical occurrence — the
Shoemaker–Levy 9 impact of 1994 is the obvious candidate — it should *not*
carry an `accuracy` line, because it will not need one.

---

## How an event is defined

One entry in the `EVENTS` array near the bottom of the file:

```js
{
  id: "triton-geysers",        // stable key; the dashboard and the debug console use it
  body: "Triton",              // findBody() name, or null for a deep-sky event
  title: "Nitrogen geysers",
  kind: "ongoing",             // transient | recurring | ongoing — see above
  family: "surface",           // which physics it belongs to, not which body
  detail: "...",               // one line, what the viewer is about to see
  frequency: "...",            // how often it really happens, with the numbers
  cause: "...",                // the mechanism, in prose
  note: "...",                 // the fact worth remembering
  accuracy: "...",             // optional — only if this is a representative staging
  facesSun: true,              // optional — stage on the lit hemisphere
  shotSwing: degToRad(20),     // optional — radians round from the sunward line
  facesTerminator: true,       //   ... or the readable spelling of a quarter turn
  shotPitch: degToRad(37),     // optional — camera elevation
  shotZoom: 2.4,               // optional — stand further back
  build: createTritonGeysers,
}
```

`frequency`, `cause` and `note` are the dossier, not decoration. Be exact.
"Often" tells a reader nothing; "0.68 flashes per hour, from 192 detections
over 283 hours" tells them the rate *and* how confident to be.

### The builder contract

```js
function createSomething(target, camera, context = {}) {
  const group = new THREE.Group();
  // ... build everything, add to group ...
  return {
    group,
    duration: 20,                     // seconds
    update(progress, skyApi) { },     // progress 0→1
    dispose(skyApi) { },              // free every geometry, material, texture
  };
}
```

- `target` is the body (or the sky anchor). The group is parented to it, so
  work in **local space**.
- `context.skyRadius` is the deep-sky shell radius, and `context.skyClutter`
  the list of nebulosity directions, for `body: null` events.
- `skyApi.setSkyHighlight(v)` brightens the background dust while something
  burns. The runner force-clears it on teardown; `dispose` should too.
- `update` runs every frame while `progress < 1`; at 1 the runner calls
  `stop()`, which removes the group and calls `dispose`.

### Framing flags

Read in `main.js` by `composeSolarEventShot(sunwardOf, shotZoom, shotPitch, shotSwing)`.

- **default** — whatever the camera was doing.
- **`facesSun`** — camera on the sunward side. Use whenever the event needs
  sunlight to be visible at all (dust, cloud, storms) or when the builder
  picks its site by `localSunDirection`.
- **`shotSwing`** — radians round from that sunward line. Zero frames the lit
  face; a quarter turn puts the terminator down the middle;
  `facesTerminator: true` is the readable spelling of the quarter turn.
  Negative swings the other way, which is how the Mercury tail is kept out
  from under the dossier card.
- **`shotPitch`** — camera elevation in radians. Raise it when the feature
  sits at a latitude that would otherwise be foreshortened into the limb.
- **`shotZoom`** — multiplier on the standoff. Raise it when the subject is
  bigger than the body (ring system, comet tail, an arrival from off-frame).

**The composed shot also carries a fixed elevation of 0.22 rad.** It adds to
whatever `shotSwing` asks for, so the true angle off the Sun line is
`acos(cos(swing)·cos(pitch))`, not `swing`. Forgetting that put the eclipse
shadow on the limb twice.

---

## Shared building blocks

Reach for these before writing anything new.

| Helper | What it gives you |
|--------|-------------------|
| `createSurfaceCap(radius, normal, kind, options)` | An elliptical patch that lies on the sphere and follows its curvature. `kind: "stain"` → normal-blended, so a dark colour *subtracts*; anything else → additive. `options`: `shell` (height above the surface, default 1.006), `renderOrder`, `roughness` (rim raggedness, 1 = a scar, 0.3 = a cloud), `along` (the axis `drift` runs along), `depthTest`. |
| `cap.aim(point, alongHint)` | Re-centre the patch mid-flight, for a mark that does not belong to the surface. |
| `hugSurface(material)` | Polygon offset so a decal wins the depth test. Never sufficient on its own — pair it with a real `shell` offset. |
| `pointAlong(mesh, directionLocal)` | Orient a mesh's +Y along a local-space direction. **Use this, not `lookAt`** — `lookAt` takes world space and every event here works in the body's local frame. |
| `POINT_SIZE_GLSL` / `viewportHeight()` | Correct world-size-to-pixels for `Points`. See the note below; do not size points by a constant over view depth. |
| `localCameraDirection` / `localSunDirection` / `localRadius` | Where the viewer is, where the Sun is, how big the body is — all in the body's own frame. |
| `getGlowTexture()` / `getSoftTexture()` | A point of light, and a volume. Do not build a third. |
| `makeGlow` / `makeHaze` / `makeSurfaceGlow` | Billboards: a spark, an edgeless cloud, and a spark that ignores depth (caller must fade it at the limb). |
| `placeInView(camera, scale, minDeg, maxDeg, clutter)` | A deep-sky direction that is on screen, clear of the UI panels, and as far as possible from any nebulosity. |
| `makeSkyBurst(site)` | Star + halo + echo for a point-source detonation. Shared by supernova and kilonova. |

---

## The events, one by one

### 1–2. Impact swarm — Jupiter / Saturn
`createImpactSwarm` · 15s · `facesSun`

Metre-scale bodies fall in from unrelated directions and detonate in the
upper atmosphere. Bolide streaks in, fireball blooms, a `createSurfaceCap`
stain darkens and fades. No crater — the flash *is* the event.

### 3. Volcanic plume — Io
`createIoPlume` · 16s

Sulphur thrown 300 km up in the umbrella shape Voyager photographed. Vents
sorted into sulphur and sulphur-dioxide kinds; the SO₂ ones pulse.

### 4. Ocean venting to space — Enceladus
`createEnceladusPlumes` · 18s

Over a hundred jets along the four south-polar tiger stripes, reaching
2.3 radii, modulated by orbital phase — stronger at apoapsis, as measured.

### 5. Meteor shower — Earth
`createMeteorShower` · 17s · `facesSun`

Thirty trails on a common radiant. Colours come from `METEOR_KINDS`, a table
keyed on entry speed: slow sodium yellows and oranges through to
magnesium blue-green and ionised-air violet, each with a head colour and a
*different* tail colour so the trail runs between them. The lunar impact
event borrows the same table.

### 6. Coronal mass ejection — Sun
`createSolarEjection` · 18s

A billion tonnes of plasma leaving the corona, reach 5.6 solar radii.
Deliberately not viewpoint-dependent — a CME looks the same from anywhere it
can be seen from.

### 7. Sungrazing comet — Sun
`createSungrazerComet` · 18s

A Kreutz fragment dives inside a couple of solar radii and does not come out.
The tail outlives the nucleus, which is what actually happens.

### 8. Global dust storm — Mars
`createMarsDustStorm` · 22s · `facesSun`

A regional storm fails to die and wraps the planet. Veil on a shell at 1.022.
Dust is only dust when there is sunlight on it.

### 9. Great White Spot — Saturn
`createSaturnWhiteSpot` · 24s · `facesSun` · pitch 37°

Storm head erupts at 37°N; the tail spreads along that latitude until it
wraps the planet. The pitch matches the storm's own latitude — the view every
Cassini frame of it was taken from.

### 10. Ring spokes — Saturn
`createRingSpokes` · 20s · `facesSun` · pitch 60° · back 2.4×

Radial smears across the B ring. The only event whose subject is the ring, so
the camera climbs until the ring is a disc rather than a line.

### 11. Lunar impact flash — Moon
`createLunarImpactFlash` · 20s · `facesTerminator` · back 3.0×

Twelve meteoroids on curved capture paths. The release distance is **read off
the camera** each time — the frame half-height in lunar radii, times 1.25 —
so a rock enters from the edge of the picture whether the viewer has zoomed
in or out. Sites alternate lit/unlit and are resampled until each really is
on the side it was asked for. Wakes are 40 samples in one `Points` buffer,
coloured head-to-tail from `METEOR_KINDS`. Day-side flashes are pulled 42%
toward grey and get a 1.6× contrast lift.

Flashes use `makeSurfaceGlow`, so they ignore depth — and each one is faded
by `site · cameraDirection` **recomputed every frame**, or turning the Moon
leaves them shining through it.

### 12. Solar eclipse — Earth
`createSolarEclipse` · 22s · `facesSun` · swing 20° · back 2.9×

The eclipsing body is Earth's **real Moon** — its geometry, and a clone of
its material — with the scene's satellite system hidden for the duration.
Two moons in frame was the single biggest reason the first versions did not
read.

- **Moon distance is solved, not chosen.** Given the camera distance and the
  measured angle off the Sun line, it solves for the range that puts the Moon
  2.5 body radii from the disc centre: `r = T·D / (sinθ·D + T·R·cosθ)`.
- **The handover runs on two clocks.** Distance steps out in 0.2s so the Moon
  leaves Earth's neighbourhood immediately; direction slerps over 3.5s, which
  is the part that reads as travelling along an orbit. A straight lerp between
  the two positions cuts through the planet.
- **Earth turns** so India is under the shadow rather than the Pacific. The
  satellite system is counter-rotated by the same amount, because Earth's
  spin carries its children and the Moon should not be swung round its orbit
  by a rotation that is not its own.
- **The shadow is two `createSurfaceCap("stain")` patches** at shell 1.068 —
  above Earth's clouds (1.020), atmosphere (1.026) and glow (1.060) — with
  `depthTest: false` and the live view direction passed so the far side
  dissolves instead of showing through.
- **The Moon is drawn last** (`renderOrder: 20`, moved into the transparent
  pass) so it occludes the shadow honestly instead of the shadow punching a
  hole through it.
- **The cone** is only the last quarter-radius, where Earth's air can scatter
  light around it. A shadow in vacuum cannot be seen.

### 13. Supernova — deep sky
`createSupernova` · 26s · `placeInView` + `makeSkyBurst`

Type II-P light curve — ten-day rise, hundred-day plateau, cobalt-56 tail —
and the colour run on the **same stretched clock**: `days = 400·progress^2.2`.
That is what gives each temperature stop screen time; on a linear clock the
blinding blue-white phase lasted three tenths of a second.

| day | colour |
|-----|--------|
| 0 | `(0.52, 0.72, 1.00)` blue-white |
| 8 | `(1.00, 0.98, 0.94)` white |
| 45 | `(1.00, 0.80, 0.34)` yellow |
| 140 | `(1.00, 0.42, 0.13)` orange |
| 400 | `(0.88, 0.13, 0.06)` deep red |

Brightness is compressed (`pow(shape, 0.38)`) because magnitudes are
logarithmic — linearly, the red phase happens on an invisible object. The
shock breakout is a *swell*, not a spike: it rises over the first 4.5% before
decaying, so the star arrives rather than starting at full.

### 14. Kilonova — deep sky
`createKilonova` · 20s · same rig, deliberately

Same picture, faster and dimmer — `PEAK = 0.62` against the supernova's 1.
`days = 12·progress²`, two-component fall `0.58·e^(-d/2.4) + 0.42·e^(-d/9)`.
Blue for the first sixth, then hard through white and orange into
`(0.34, 0.03, 0.03)`: the r-process builds lanthanides in seconds and they
are enormously opaque in the blue.

### 15. Sodium tail — Mercury
`createMercurySodiumTail` · 20s · `facesSun` · swing **−90°** · back 2.2×

An exosphere, not an atmosphere, and therefore not a cone. 2,600 points,
colour `0xffb347`, reach 7 radii. Every atom runs its **own continuous lap**
from the surface outward and is released again at the end, so the flow never
freezes; the light fades over the last third instead. Width is about
Mercury's own at its widest. The swing is negative so the tail does not
stream under the dossier card.

### 16. Bright storm outbreak — Uranus
`createUranusStorms` · 22s · back 1.55×

Fourteen surface caps at shell **1.042**, above the methane haze shell at
1.034 — under it they were invisible whatever the level. Four behaviours:
`vortex` (anchored, spins in place), `jet` (fast, prograde, drawn out by
shear), `equator` (slow, retrograde), `methane` (rises, flashes into ice,
dissipates). Drift is a rotation about the spin axis via `cap.aim`, so a
jet-stream cloud stays at its latitude instead of wandering over the pole.
All brilliant white, falloff 2.1, rim roughness 0.34.

### 17. Nitrogen geysers — Triton
`createTritonGeysers` · 20s · `facesSun` · back 1.5×

**No column geometry.** A cylinder, however thin, is a post standing on the
moon. The stem is the first third of each plume's grains, packed tight with
almost no lateral spread and issuing from a scattered pore mouth; the banner
is the rest, released at the tip and carried downwind. One `Points` buffer
for all ten plumes.

The summer pole is chosen from the Sun direction and then leaned toward the
viewer, so the cap is on the lit face rather than edge-on at the limb. Each
plume's wind is the global wind **projected into its own tangent plane** — a
direction that is horizontal at one place on a sphere points into the ground
at another, and un-projected the banners ran into the moon. Ground fans are
`"stain"` caps aimed `along: wind`, so all ten are parallel. The polar cap is
painted pale pink at low strength: at 30 AU the moon renders nearly black,
and dark plumes need light ice to be dark against.

---

## Mistakes this code has already made

Each of these cost real time. They are all easy to repeat.

1. **`node --check` does not work on this project.** Without
   `"type": "module"` in package.json, node treats `.js` as CommonJS, meets
   `import`, and silently exits 0 — verified by appending `function broken( {`
   to a file and watching it pass. Use `scripts/check-syntax.mjs`, which
   forces `--input-type=module`.
2. **`lookAt` takes world space.** Every event here works in the body's local
   frame. Use `pointAlong`.
3. **Point size must be derived from the projection.** `constant / -viewZ` is
   in whatever units the body happens to be built in; at Mercury's focus
   distance that came out at 200–700 pixels *per atom*. Use `POINT_SIZE_GLSL`.
4. **Additive blending cannot darken anything.** Shadows, scars, deposits and
   dark plumes all need `NormalBlending` with a dark colour.
5. **Decals must clear the body's *other* shells, not just its surface.**
   Earth carries cloud, atmosphere and glow out to 1.060; Uranus a haze at
   1.034. A patch at 1.006 is underneath all of it.
6. **A chain evaluates left to right.**
   `v.copy(dir).multiplyScalar(f(v.length()))` reads `v.length()` *after*
   `copy` has already replaced `v`. This parked the eclipse Moon one world
   unit from Earth's centre against a 0.9 radius, and every symptom that
   followed looked like a framing fault.
7. **Measure where things end up, not where they were sent.** The eclipse's
   solver reported a correct 2.5 radii of separation for a position the Moon
   never took. A build-time log of intent proves nothing; log the result.
8. **Attribution by toggling is only as good as the region measured.** A
   red-pixel count over a disc that is mostly background will blame the wrong
   object. Match the framing to how the user actually looks at it.
9. **A software-rendered harness cannot reproduce camera easing.** At one
   frame per second the camera never settles before an event plays, so every
   captured frame is at a different angle. For anything framing-dependent,
   instrument the real browser instead.
10. **Guard zero-count batches and empty spreads.** A zero-length
    `InstancedBufferGeometry` is a crash; `add(...[])` is `add(undefined)` and
    logs an error on every load.

## Testing

`?bodyDebug=1` is required for the console handles; `?skipIntro=1` lands at
the arrival directly.

```
window.__events.play("triton-geysers")   // stage one now
window.__events.list()                   // the whole roster + flags
window.__presentEvent("triton-geysers")  // travel, wait, play
```

Checks: `node scripts/check-syntax.mjs` and `node scripts/check-glsl-literals.mjs`.

## The backlog

Everything event-shaped in `docs/beyond-earth-missing-and-recommended-coverage.md`,
pulled out of that file and filed here where the roster lives. The coverage
document mixes events with celestial objects and with whole regions; the
objects and regions are not repeated here — they are tracked in
`docs/celestial-bodies.md` and the reasons anything is absent are in
`docs/not-covered.md`.

Each entry carries the `kind`, `family` and host it would be built with, so an
entry can go straight into `EVENTS` without being re-thought. Sizing is
relative to what exists: **S** reuses a builder nearly as-is, **M** is a new
builder on proven machinery, **L** needs something the engine cannot currently
do.

---

### A new family is needed: `observational`

Nine of the entries below — conjunction, opposition, elongation, transit,
occultation, planetary parade, retrograde motion, and the eclipse family
beyond the one that exists — are not physical events at all. **Nothing happens
to anything.** They are appearances, and an appearance only exists from a
viewpoint: a conjunction is a conjunction *seen from Earth* and from nowhere
else.

The engine cannot currently express that. Every builder is parented to a body
and staged in that body's local frame; there is no concept of a line of sight.
Building the observational family therefore means one piece of new machinery
first — an event that takes an **observer** as well as a host — and after that
nine events become straightforward. This is why they are marked **L** below
even though several are visually simple.

The wording matters too, and NASA is explicit about it: a planetary alignment
or "parade" is a *visual* alignment along a line of sight. The planets are not
in a straight line in three dimensions and the copy must not imply it.

---

### Solar and heliophysical

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| Solar flare | one-off | Sun | M | The light, not the plasma. Distinct from the CME already built and often accompanies it. |
| Prominence eruption | one-off | Sun | M | A loop of cool plasma held in the magnetic field, breaking loose. |
| Filament eruption | one-off | Sun | M | The same structure seen against the disc rather than the limb — worth doing as one builder with two framings. |
| Coronal-hole wind stream | recurring | Sun | M | The fast solar wind, on a roughly 27-day rotation cadence. |
| Solar energetic particle storm | one-off | Sun | L | Mostly invisible — see `not-covered.md`. |
| Sunspot emergence | ongoing | Sun | M | Active-region growth and decay over days. |
| Solar cycle: maximum to minimum | recurring | Sun | L | An 11-year cycle. Needs a time-compression concept the engine does not have. |
| **Space weather crossing the system** | one-off | *interplanetary* | **L** | The strongest single idea in the coverage file: one CME launches and is followed outward past Mercury, Venus, Earth, Mars and the giants, hitting a different magnetosphere at each stop. It is also the only event that would need to span the whole scene rather than one body. |

### Planetary atmosphere

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| Venus lightning | ongoing | Venus | M | Venus has a planet, an atmosphere and no event at all — the largest single hole in the roster. |
| Venus super-rotation | ongoing | Venus | S | The whole cloud deck laps the planet every four days while the surface takes 243. |
| Venus atmospheric wave | recurring | Venus | M | The stationary bow-shaped gravity wave Akatsuki found in 2015. |
| Jupiter lightning | ongoing | Jupiter | M | Juno found it clusters near the poles, unlike Earth's. |
| Jupiter polar cyclones | ongoing | Jupiter | M | Eight around the north pole, five around the south, in stable polygons. |
| Great Red Spot evolution | ongoing | Jupiter | M | It has been shrinking for a century and a half. |
| Saturn's north-polar hexagon | ongoing | Saturn | M | A six-sided jet stream 30,000 km across — the most recognisable thing on the planet after the rings. |
| Saturn polar vortex | ongoing | Saturn | S | Sits inside the hexagon. |
| Neptune's Great Dark Spot | recurring | Neptune | M | The Saturn white-spot machinery already proves storms work on a giant. |
| Titan methane storm and rain | recurring | Titan | M | Titan is fully modelled and does nothing. |
| Mars polar cap seasonal retreat | recurring | Mars | M | Needs the seasonal layer below. |

### Magnetic and auroral

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| Earth aurora from orbit | recurring | Earth | S | Earth already carries an aurora layer; this stages it. |
| Jupiter auroral outburst | recurring | Jupiter | M | Ultraviolet in reality — see `not-covered.md`. |
| Saturn aurora | recurring | Saturn | M | Also ultraviolet. |
| Uranus aurora | recurring | Uranus | M | Off-axis, and already modelled as a layer. |
| Neptune aurora | recurring | Neptune | M | Infrared H₃⁺; found only in 2025 by JWST, after a thirty-year hunt. |
| Ganymede aurora | recurring | Ganymede | M | The only moon with its own magnetic field. |
| Io–Jupiter flux tube footprint | ongoing | Jupiter | M | A bright spot in Jupiter's aurora that tracks Io around the planet. |
| Geomagnetic storm | one-off | Earth | M | The other half of the CME — pair them. |
| Magnetic substorm | recurring | Earth | M | |

### Geological and cryovolcanic

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| Europa water-vapour plume | one-off | Europa | S | The Enceladus builder is the template. Detections remain contested — label accordingly. |
| Ceres: Occator bright deposits | ongoing | Ceres | M | Ceres has no event. Salt deposits from brine that reached the surface. |
| Ceres transient haze | one-off | Ceres | M | |
| Pluto volatile transport | ongoing | Pluto | M | Nitrogen ice cycling across Sputnik Planitia. New Horizons data reported evidence in **August 2026** for recent liquid nitrogen moving through cracks there — worth building around. |
| Titan methane cycle | ongoing | Titan | L | Rain, rivers, lakes and evaporation as one system rather than an event. |

### Impact

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| **Shoemaker–Levy 9, July 1994** | one-off | Jupiter | M | The strongest addition in the whole backlog. Twenty-plus fragments over six days leaving scars larger than Earth — the one giant-planet impact watched start to finish, so unlike the two impact swarms it would carry **no `accuracy` caveat** and would be the first entry tied to a dated occurrence rather than a rate. |
| Bolide / atmospheric entry | one-off | Earth | S | The meteor-shower machinery, scaled up to one object. |
| Asteroid–asteroid collision | one-off | *belt* | M | |
| Crater formation and ejecta | one-off | Moon | M | The lunar flash tells you a rock arrived; this shows what it left. |
| **A generalised impact engine** | — | — | **L** | The coverage file's best structural suggestion: one builder covering entry, bolide, flash, crater and ejecta, parameterised by target and impactor. Four of the entries above collapse into it. |

### Ring

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| Density and bending waves | ongoing | Saturn | M | Spiral waves raised by moon resonances — the rings' most beautiful structure after the gaps. |
| Propeller structures | ongoing | Saturn | M | The wakes of moonlets too small to clear a gap. |
| Gravitational wakes | ongoing | Saturn | M | |
| Ring-plane crossing | recurring | Saturn | M | Every ~15 years the rings vanish edge-on from Earth. The next is **March 2025 → 2038**. |
| Shepherd-moon interaction | ongoing | Uranus | S | Cordelia and Ophelia holding the Epsilon ring's edges. Uranus's rings and both moons already exist. |

### Small body and cometary

| Event | Kind | Host | Size | Note |
|---|---|---|---|---|
| Comet perihelion outburst | one-off | *comet* | L | Needs a comet as a body, which does not exist yet. |
| Comet fragmentation | one-off | *comet* | L | Hubble caught C/2025 K1 (ATLAS) coming apart in 2026. |
| Named meteor showers | recurring | Earth | S | The current shower is generic. Perseids, Geminids, Quadrantids, Leonids, Lyrids, Orionids, Eta Aquariids, Draconids, Taurids — each with its real radiant, parent body, dates and rate. Removes that event's `accuracy` caveat. |
| Asteroid close approach | one-off | Earth | M | The near-Earth object layer's natural event. |
| **Interstellar visitor** | one-off | *interplanetary* | M | 1I/ʻOumuamua, 2I/Borisov, 3I/ATLAS. A hyperbolic path through the system that arrives from nowhere and never returns — and the bridge to the next project. |

### Orbital and observational — needs the viewpoint machinery first

| Event | Kind | Size | Note |
|---|---|---|---|
| Lunar eclipse — total, partial, penumbral | recurring | **M** | The exception: it is a real shadow on a real body, so it needs no viewpoint. Nearly all the solar-eclipse machinery applies. **Build this one first.** |
| Solar eclipse — annular, partial, hybrid | recurring | S | The existing builder plus a Moon-distance parameter. Removes its `accuracy` caveat. |
| Mercury transit of the Sun | recurring | L | Next: **2032**. |
| Venus transit of the Sun | recurring | L | Next: **2117**. Worth saying so. |
| Occultation — Moon over a planet | recurring | L | |
| Mutual satellite occultation | recurring | L | Jovian moons eclipsing each other. |
| Pluto–Charon mutual eclipse | recurring | M | A season of them every 124 years; the last ran 1985–1990. |
| Conjunction | recurring | L | |
| Opposition | recurring | L | |
| Greatest elongation | recurring | L | Mercury and Venus only. |
| Planetary parade | recurring | L | Careful wording required — a line of sight, not a line. |
| Retrograde motion | recurring | L | The apparent backward loop. The single best demonstration of why the heliocentric model won. |

---

### Suggested order

1. **Lunar eclipse** — the machinery exists, it is the obvious missing twin of #12.
2. **Shoemaker–Levy 9** — the highest-value single event in the list.
3. **Venus lightning** — closes the largest hole; Venus currently has nothing.
4. **Named meteor showers** — turns one generic event into ten real ones for little work.
5. **Saturn's hexagon** and **Neptune's dark spot** — proven storm machinery on new worlds.
6. **The generalised impact engine** — pays for itself across four entries.
7. **The viewpoint machinery**, and then the nine observational events behind it.
8. **Space weather crossing the system** — the largest and the most memorable.

---

## Ideas not yet built

Superseded by **The backlog** above, which is the same list with sizing, hosts
and classification attached. Kept only for the few that came from nowhere else:

Saturn's hexagon · a Jupiter–Io flux tube aurora · Earth's aurora from orbit ·
an asteroid-belt collision · Pluto–Charon mutual eclipse.

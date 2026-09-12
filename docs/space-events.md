# Space events — the catalogue

Everything in `src/js/scene/events/solarSystemEvents.js`. Seventeen events, each
staged once on request: travel to the body, wait `EVENT_ARRIVAL_DELAY_SECONDS`
(5s), watch it happen, take it apart. Nothing loops and nothing autoplays.

This file exists so that adding an eighteenth is a matter of reading, not
archaeology. It says what is already covered, how each one is built, and what
the shared machinery gives you for free.

---

## The roster at a glance

| # | id | Body | Title | Runs | Framing |
|---|----|------|-------|------|---------|
| 1 | `jupiter-impact` | Jupiter | Impact swarm | 15s | day side |
| 2 | `saturn-impact` | Saturn | Impact swarm | 15s | day side |
| 3 | `io-eruption` | Io | Volcanic plume | 16s | default |
| 4 | `enceladus-plumes` | Enceladus | Ocean venting to space | 18s | default |
| 5 | `meteor-shower` | Earth | Meteor shower | 17s | day side |
| 6 | `solar-cme` | Sun | Coronal mass ejection | 18s | default |
| 7 | `sungrazer` | Sun | Sungrazing comet | 18s | pulled back (`shotZoom`) |
| 8 | `mars-dust-storm` | Mars | Global dust storm | 22s | day side |
| 9 | `saturn-white-spot` | Saturn | Great White Spot | 24s | day side, pitched 37° |
| 10 | `ring-spokes` | Saturn | Ring spokes | 20s | day side, pitched 60°, pulled back |
| 11 | `lunar-impact-flash` | Moon | Lunar impact flash | 20s | **terminator** |
| 12 | `solar-eclipse` | Earth | Solar eclipse | 22s | default |
| 13 | `supernova` | *deep sky* | Supernova | 26s | in front of the lens |
| 14 | `kilonova` | *deep sky* | Kilonova | 20s | in front of the lens |
| 15 | `mercury-sodium-tail` | Mercury | Sodium tail | 20s | default |
| 16 | `uranus-storms` | Uranus | Bright storm outbreak | 22s | default |
| 17 | `triton-geysers` | Triton | Nitrogen geysers | 20s | default |

Coverage by host: Sun 2 · Mercury 1 · Earth 2 · Moon 1 · Mars 1 · Jupiter 1 ·
Io 1 · Saturn 3 · Enceladus 1 · Uranus 1 · Triton 1 · deep sky 2.

Bodies with nothing yet: Venus, Neptune, Pluto, Ceres, Europa, Ganymede,
Callisto, Titan, the asteroid belt, and every comet that is not a sungrazer.

---

## How an event is defined

One entry in the `EVENTS` array near the bottom of the file:

```js
{
  id: "triton-geysers",        // stable key; the dashboard and ?bodyDebug console use it
  body: "Triton",              // findBody() name, or null for a deep-sky event
  title: "Nitrogen geysers",   // shown on the dossier card
  detail: "...",               // one line, what the viewer is about to see
  frequency: "...",            // how often it really happens, with the numbers
  cause: "...",                // the physics, in prose
  note: "...",                 // the fact worth remembering
  facesSun: true,              // optional — stage on the lit hemisphere
  facesTerminator: true,       // optional — stage with the day/night line up the middle
  shotPitch: degToRad(37),     // optional — camera elevation
  shotZoom: 2.4,               // optional — stand further back
  build: createTritonGeysers,
}
```

`frequency`, `cause` and `note` are not decoration — they are the dossier. Be
exact. "Often" tells a reader nothing; "0.68 flashes per hour, from 192
detections over 283 hours" tells them the rate *and* how confident to be.

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
- `context.skyRadius` is the deep-sky shell radius, for `body: null` events.
- `skyApi.setSkyHighlight(v)` brightens the background dust while something
  burns. The runner force-clears it to 0 on teardown, but `dispose` should
  clear it too.
- `update` is called every frame while `progress < 1`; at 1 the runner calls
  `stop()`, which removes the group and calls `dispose`.

### Framing flags

Read in `main.js` by `composeSolarEventShot(sunwardOf, shotZoom, shotPitch, terminatorOf)`.

- **default** — the body's own framing, whatever the camera was doing.
- **`facesSun: true`** — camera placed on the sunward side. Use whenever the
  event needs sunlight to be visible at all (dust, cloud, storms) or when the
  builder picks its site by `localSunDirection`.
- **`facesTerminator: true`** — a quarter turn off the sunward line, so the
  day/night boundary runs up the middle of the disc. Only for events whose
  subject *is* the difference between the two hemispheres. Currently just the
  lunar impact flash.
- **`shotPitch`** — camera elevation in radians. Raise it when the feature sits
  at a latitude that would otherwise be foreshortened into the limb.
- **`shotZoom`** — multiplier on the standoff distance. Raise it when the
  subject is bigger than the body (ring system, comet tail).

---

## Shared building blocks

Reach for these before writing anything new.

| Helper | What it gives you |
|--------|-------------------|
| `createSurfaceCap(radius, normal, kind)` | An elliptical patch that lies on the sphere and follows its curvature. `kind: "stain"` → normal-blended, so a dark colour *subtracts* (scars, deposits, shadow). Anything else → additive (storms, glare). Ragged rim baked once; trig tabled. Sits on a shell at `radius * 1.006`. |
| `hugSurface(material)` | Polygon offset (`factor -8`, `units -16`) so a decal wins the depth test against the body it lies on. Always pair with a real shell offset — the bias alone is not enough at far focus ranges. |
| `localCameraDirection(target, camera, out)` | Where the viewer is, in the body's frame. Use it to stage on the near face. |
| `localSunDirection(target, out)` | Where the Sun is, in the body's frame. Use it for lit/unlit decisions. |
| `localRadius(target)` | The body's radius in its own local units. |
| `getGlowTexture()` | Shared soft round sprite. Do not build another. |
| `placeInView(camera, scale, minDeg, maxDeg)` | Puts a deep-sky object on screen, between `minDeg` and `maxDeg` off the view axis. |
| `makeSkyBurst(site)` | Star + halo + echo shell for a point-source detonation, returning `{star, halo, echo, addTo, dispose}`. Shared by supernova and kilonova. |
| Sprite batch (`InstancedBufferGeometry`) | For hundreds of particles at one draw call. Guard `count === 0` — a zero-length instanced attribute is a crash waiting to happen. |

---

## The events, one by one

### 1–2. Impact swarm — Jupiter / Saturn
`createImpactSwarm` · 15s · `facesSun`

Several metre-scale bodies fall in from unrelated directions and detonate in
the upper atmosphere. Bolide streaks in, fireball blooms, a `createSurfaceCap`
stain darkens and then fades. No crater — the flash *is* the event.

Note: the scar shell is at `radius * 1.006`. It used to be `1.0025`, which left
roughly two-thirds of the scar held on screen by polygon bias alone; at Saturn
focus that read as the white-spot-style distortion. If a decal ever shimmers,
the question to ask is not "does the depth test reject anything now" but "how
much would be rejected *without* the offset" — that number is the real margin.

### 3. Volcanic plume — Io
`createIoPlume` · 16s

Sulphur thrown 300 km up in the umbrella shape Voyager photographed. Vents
sorted into sulphur and sulphur-dioxide kinds; the SO₂ ones pulse. Deposits
painted with `createSurfaceCap`.

### 4. Ocean venting to space — Enceladus
`createEnceladusPlumes` · 18s

Over a hundred jets along the four south-polar tiger stripes, reaching
`radius * 2.3`. Modulated by orbital phase — measurably stronger at apoapsis.

### 5. Meteor shower — Earth
`createMeteorShower` · 17s · `facesSun`

Thirty trails on a common radiant, heading chosen relative to the viewer–Sun
line; the few that survive to the ground are aimed at land by reading the
planet's own daytime map. Both of those assume the lit face is on screen,
hence `facesSun`.

### 6. Coronal mass ejection — Sun
`createSolarEjection` · 18s

A billion tonnes of plasma leaving the corona, reach `5.6` solar radii.
Deliberately **not** viewpoint-dependent any more — a CME looks the same from
everywhere it can be seen from.

### 7. Sungrazing comet — Sun
`createSungrazerComet` · 18s · `shotZoom: SUNGRAZER_SHOT_ZOOM`

A Kreutz fragment dives inside a couple of solar radii and does not come out.
The tail outlives the nucleus, which is what actually happens. Camera stands
back, because the Sun's own framing is composed for the Sun and this event is
not about the Sun.

### 8. Global dust storm — Mars
`createMarsDustStorm` · 22s · `facesSun`

A regional storm fails to die and wraps the planet. Dust veil on a shell at
`radius * 1.022`. Dust is only dust when there is sunlight on it.

### 9. Great White Spot — Saturn
`createSaturnWhiteSpot` · 24s · `facesSun` · `shotPitch: 37°`

Storm head erupts at 37°N and its tail spreads along that latitude until it
wraps the planet. Band decal at `radius * 1.012`. The pitch matches the storm's
own latitude — it is the view every Cassini frame of it was taken from, and the
only one where the head and the length of the tail are both readable.

### 10. Ring spokes — Saturn
`createRingSpokes` · 20s · `facesSun` · `shotPitch: 60°` · `shotZoom`

Radial smears across the B ring that shear away. The only event whose subject
is the ring rather than the planet, so the camera climbs until the ring is a
disc rather than a line and stands back until all of it fits.

### 11. Lunar impact flash — Moon  *(rebuilt)*
`createLunarImpactFlash` · 20s · **`facesTerminator`**

Eleven meteoroids, sizes `0.28 → 1.0` on a `pow(r, 2.2)` curve so small ones
dominate and the occasional big one lands. Sites alternate lit/unlit
(`index % 2`), resampled until `site·sunLocal > 0.18` (day) or `< -0.04`
(night), so both hemispheres genuinely get hit. Each rock has a falling **head**
that stretches with speed, a **flash** with exponential decay
(`exp(-since / decay)`) sized from the rock, and a hot **core**. Day-side
flashes get `contrast = 1.35` so they still read against sunlit ground.

The terminator framing is load-bearing: the alternating sites are pointless if
the camera can only see one face.

### 12. Solar eclipse — Earth  *(rebuilt)*
`createSolarEclipse` · 22s

Built on `localSunDirection`, so Sun, Moon and Earth are genuinely in a line.
The Moon (`SphereGeometry(radius * 0.27)`, colour `0x15171d`, with a limb glow)
tracks in from `MOON_RANGE = 8.0` body radii along the sunward axis and crosses.
Its shadow is found by projecting the Moon onto the globe along `-sunLocal`, and
lands as two `createSurfaceCap("stain")`-style discs — penumbra
(`radius * 0.42`, `0x0a0d16`) and umbra (`radius * 0.085`, `0x03050a`), both
`hugSurface`d. Normal blending, because a shadow has to *subtract*; additive
cannot darken anything. Moon leaves, shadow leaves.

### 13. Supernova — deep sky  *(recoloured)*
`createSupernova` · 26s · `placeInView` + `makeSkyBurst`

Type II-P light curve unchanged: ten-day rise, hundred-day plateau, cobalt-56
tail. The colour now runs on a temperature table keyed to elapsed days:

| day | colour | what it is |
|-----|--------|-----------|
| 0 | `(0.74, 0.84, 1.00)` | shock breakout, blinding blue-white |
| 8 | `(1.00, 0.99, 0.96)` | white |
| 45 | `(1.00, 0.86, 0.52)` | yellow |
| 140 | `(1.00, 0.54, 0.26)` | orange |
| 400 | `(0.92, 0.24, 0.14)` | deep red |

Interpolated by `colourAtDay(days, out)`.

### 14. Kilonova — deep sky  *(rebuilt)*
`createKilonova` · 20s · `placeInView` + `makeSkyBurst`

Same architecture as the supernova, deliberately — a kilonova is not brighter
than a typical supernova in visible light, and the old version implied it was.
`PEAK = 0.45`, `days = progress * 14`, two-component fall
`0.72·exp(-d/1.1) + 0.28·exp(-d/5.5)`. The colour run is the fast, drastic one:
`(0.72, 0.86, 1.00)` at day 0 → `(0.42, 0.06, 0.05)` by day 12. Blue for a
moment, then deep cosmic red, because the r-process ejecta go opaque fast.

### 15. Sodium tail — Mercury  *(rebuilt)*
`createMercurySodiumTail` · 20s

An **exosphere**, not an atmosphere, and therefore not a cone. 2,600 points
driven by a `ShaderMaterial`, colour `0xffb347`, `REACH = 18` body radii
anti-sunward, per-atom shimmer, soft round falloff
(`1.0 - smoothstep(0.0, 0.5, length(d))`). `uGain = strength * 0.30` keeps it
faint — in reality you need a 589 nm narrowband filter to see this at all, so
it should be present but never obvious.

### 16. Bright storm outbreak — Uranus  *(rebuilt)*
`createUranusStorms` · 22s

Drawn the way Saturn's storms are: `createSurfaceCap(radius, normal, "light")`
patches on the sphere, not floating geometry. Ten spots across four kinds in
the `PLAN` array:

- `vortex` — deeply rooted, **does not drift**, spins in place (`spin` 0.9–1.4).
- `jet` — mid-latitude, prograde (west→east), the fast ones, up to 900 km/h.
- `equator` — retrograde (east→west), and slower.
- `methane` — short-lived: rises, flashes into ice, drifts briefly, dissipates.

Drift rate comes from `windAt(latitude)`, which sums a retrograde equatorial
term and a prograde mid-latitude term, so the direction reversal falls out of
the profile rather than being hard-coded per spot. Every spot is
`new THREE.Color(0xffffff)` — brilliant white, no exceptions.

### 17. Nitrogen geysers — Triton  *(rebuilt)*
`createTritonGeysers` · 20s

Triton reads pastel pink/peach; the plume material is starkly **dark**, which
means normal blending throughout — additive can only add light and would turn
the plumes into pale smoke, which is what the old version did wrong.

Six vents, `capAngle = 18°–52°` from the south pole `(0,-1,0)`, biased toward
the camera. Each has:

- a sharp narrow stem — `CylinderGeometry(r*0.006, r*0.009, r*0.11, 7, 1, true)`,
  colour `0x14121a` — the 8 km vertical column, which is genuinely very thin;
- a 90-grain `Points` cloud, colour `0x1a1720`, that begins at the column tip
  and balloons downwind with `reach = 0.30–0.44` — the 100–150 km dispersed
  plume;
- a `createSurfaceCap(radius, vent, "stain")` ground fan, deposit `0x2a2028`.

All six share one `wind` vector, so every fan points the same way (westward),
as Voyager 2 saw.

---

## House rules learned the hard way

1. **Measure, don't guess.** Render the same frame twice with different
   material state inside *one* synchronous `page.evaluate`, then diff with
   `gl.readPixels`. If the camera can move between the two renders the
   comparison is worthless.
2. **Attribution by toggling is only as good as the region you measure over.**
   A red-pixel count over a disc that is mostly background will happily blame
   the wrong object. Match the framing to how the user actually looks at it.
3. **Additive blending cannot darken anything.** Shadows, scars, deposits and
   dark plumes all need `NormalBlending` with a dark colour.
4. **Decals need a shell offset, not just polygon bias.** Depth resolution
   scales as `z² · 6e-8 / near`, and `near` is `clamp(focusRange/3600, 0.02, 2.4)`.
   The bias is specified in depth-buffer units, so it shrinks exactly when you
   need it most.
5. **Guard zero-count batches.** An `InstancedBufferGeometry` with zero-length
   attributes is a crash. Return a bare `Group` named for the thing instead.
6. **`dispose` must be complete.** Geometry, material, texture, and the sky
   highlight. An event that is replaced mid-flight still has to clean up.
7. **Absolute pixels, not body radii,** when measuring anything in free flight.
   At 5,000 units out the Sun is nine pixels across; eight solar radii is 72px,
   which is indistinguishable from background.

## Testing

`?bodyDebug=1` is required for the console handles to exist:

```
window.__events.play("triton-geysers")   // stage one now
window.__events.list()                   // the whole roster + flags
window.__focusBody("Triton")             // travel there first
window.__presentEvent("triton-geysers")  // the full sequence: travel, wait, play
```

`?introFrom=200` seeks past the opening. Note that clicking anything opens the
planet dossier, and `isInformationOverlayOpen()` halts the whole frame loop —
which is why the pointer handler bails out early while an event is staging.

## Ideas not yet built

Venus lightning · Neptune's Great Dark Spot · Titan's methane rain and lakes ·
Europa's water-vapour plumes · Pluto–Charon mutual eclipse · a Jupiter–Io flux
tube aurora · Saturn's hexagon · an asteroid-belt collision · a comet's
perihelion outburst and tail growth · Earth's aurora from orbit ·
transit of Mercury or Venus across the Sun · a lunar eclipse (Earth's shadow on
the Moon — the mirror of #12, and most of the machinery already exists).

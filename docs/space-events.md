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

| # | id | Body | Title | Runs | Framing |
|---|----|------|-------|------|---------|
| 1 | `jupiter-impact` | Jupiter | Impact swarm | 15s | day side |
| 2 | `saturn-impact` | Saturn | Impact swarm | 15s | day side |
| 3 | `io-eruption` | Io | Volcanic plume | 16s | default |
| 4 | `enceladus-plumes` | Enceladus | Ocean venting to space | 18s | default |
| 5 | `meteor-shower` | Earth | Meteor shower | 17s | day side |
| 6 | `solar-cme` | Sun | Coronal mass ejection | 18s | default |
| 7 | `sungrazer` | Sun | Sungrazing comet | 18s | pulled back |
| 8 | `mars-dust-storm` | Mars | Global dust storm | 22s | day side |
| 9 | `saturn-white-spot` | Saturn | Great White Spot | 24s | day side, pitched 37° |
| 10 | `ring-spokes` | Saturn | Ring spokes | 20s | day side, pitched 60°, back 2.4× |
| 11 | `lunar-impact-flash` | Moon | Lunar impact flash | 20s | terminator, back 3.0× |
| 12 | `solar-eclipse` | Earth | Solar eclipse | 22s | 20° off sunward, back 2.9× |
| 13 | `supernova` | *deep sky* | Supernova | 26s | clear sky, in view |
| 14 | `kilonova` | *deep sky* | Kilonova | 20s | clear sky, in view |
| 15 | `mercury-sodium-tail` | Mercury | Sodium tail | 20s | 90° off sunward, back 2.2× |
| 16 | `uranus-storms` | Uranus | Bright storm outbreak | 22s | back 1.55× |
| 17 | `triton-geysers` | Triton | Nitrogen geysers | 20s | day side, back 1.5× |

Coverage by host: Sun 2 · Mercury 1 · Earth 2 · Moon 1 · Mars 1 · Jupiter 1 ·
Io 1 · Saturn 3 · Enceladus 1 · Uranus 1 · Triton 1 · deep sky 2.

Nothing yet for: Venus, Neptune, Pluto, Ceres, Europa, Ganymede, Callisto,
Titan, the asteroid belt, or any comet that is not a sungrazer.

---

## How an event is defined

One entry in the `EVENTS` array near the bottom of the file:

```js
{
  id: "triton-geysers",        // stable key; the dashboard and the debug console use it
  body: "Triton",              // findBody() name, or null for a deep-sky event
  title: "Nitrogen geysers",
  detail: "...",               // one line, what the viewer is about to see
  frequency: "...",            // how often it really happens, with the numbers
  cause: "...",                // the mechanism, in prose
  note: "...",                 // the fact worth remembering
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

## Ideas not yet built

Venus lightning · Neptune's Great Dark Spot · Titan's methane rain and lakes ·
Europa's water-vapour plumes · Pluto–Charon mutual eclipse · a Jupiter–Io flux
tube aurora · Saturn's hexagon · an asteroid-belt collision · a comet's
perihelion outburst · Earth's aurora from orbit · a transit of Mercury or
Venus across the Sun · a lunar eclipse — Earth's shadow on the Moon, the
mirror of #12, and most of the machinery now exists.

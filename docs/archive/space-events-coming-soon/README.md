# Space events, coming soon: the first versions, kept for reference

Round 38 (Prompts.md). The owner moved four topics to the **space events**, to be redesigned there properly:

1. How the Solar System formed
2. The solar wind
3. Magnetospheres ("implementation looks crazy, just note down whatever implementation you have made")
4. Why there are seasons

Their first versions were taken out of the site. Each one is listed, disabled, under **"Coming soon"** in the space events dashboard (`src/js/ui/spaceEventsDashboard.js`, `COMING_SOON`).

The code is kept here unchanged. Nothing in `src/` imports it.

| File here | Was | What it did |
|---|---|---|
| `magnetospheres.js` | `src/js/graphics/magnetospheres.js` | The 3D magnetosphere diagrams drawn round a body in the scene |
| `solarWind.js` | `src/js/scene/solarWind.js` | The solar-wind particles and Parker spirals in the scene |
| `explainer-fields.js` | `src/js/ui/explainers/fields.js` | Board explanations "Magnetospheres" and "The solar wind", plus `MAGNETOSPHERE_TEXT` (the dossier's words) |
| `explainer-formation.js` | `src/js/ui/explainers/formation.js` | Board explanation "How the Solar System formed" |
| `explainer-seasons.js` | the `seasons` topic of `src/js/ui/explainers/mechanisms.js` | Board explanation "Why there are seasons" |

The explanation files import `./common.js`, which still exists at `src/js/ui/explainers/common.js`. The views ran inside `src/js/ui/explainerView.js`, which is still in use.

---

## 1. Magnetospheres: how the first version worked

**Bodies and measurements** (`MAGNETOSPHERES`, in each body's own radii):

| Body | Magnetopause | Bow shock | Tail | Dipole tilt | Belts / tori |
|---|---|---|---|---|---|
| Mercury | 1.45 | 1.96 | 12 | 0° | offset 0.2 R north |
| Earth | 10 | 13 | 1000 | 11° | Van Allen 1.2–2.5 and 3–7 |
| Jupiter | 75 | 90 | 650 | 9.6° | belts 1.3–3; Io torus at 5.9 |
| Saturn | 22 | 27 | 250 | 0.06° | belt 2.3–3.4; Enceladus torus at 3.95 |
| Uranus | 18 | 23 | 300 | 59° | offset 0.3 R; belts 2–5 |
| Neptune | 26 | 35 | 300 | 47° | offset 0.55 R; belts 2–5 |
| Ganymede | 2.0 | — | 6 | 10° | none; no bow shock, because Jupiter's plasma is sub-magnetosonic there |

Sources: Winslow et al. 2013 and Anderson et al. 2011 (Mercury); Joy et al. 2002 (Jupiter); Achilleos et al. 2008 (Saturn); Ness et al. 1986 and 1989 (Uranus and Neptune); Kivelson et al. 1996 (Ganymede).

**Shapes:**
- Magnetopause: the Shue profile, r = r0·√(2/(1+cos θ)), out to 150°, then a slowly flaring cylinder to the tail length.
- Bow shock: a conic with e = 0.8.
- Both are revolved round the Sun–body line and drawn with a rim-and-flow shader.

**Scale:**
- Distances are put through each planet's own moon-compression curve (`MOON_CURVES`), so the diagram sits consistently with the drawn moons (Io's torus on Io's orbit).
- Earth: d^0.280. Jupiter: 0.78 + (km/421800)^0.42. Saturn: 1.30 + 1.82·max(1, km/185539)^0.34. Uranus: piecewise. Neptune: 1.10 + 1.70·max(1, km/48227)^0.28.

**Frames:**
- A "wind frame" turns the shells so +x points away from the Sun every frame.
- A "dipole frame" carries the belts and tori, tilted and offset, turning with the body.

**Field lines:**
- Dipole lines r = L·cos²λ at eight longitudes.
- Squeezed on the day side and dragged downwind on the night side.
- Clipped to the drawn wall, so tilted dipoles (Uranus, Neptune) do not poke through.
- Rebuilt every six frames.

**Labels:**
- Fixed-size sprites; the size is divided by the root's world scale.
- They fade in only when the magnetopause is at least about 140 px across on screen.
- They are kept on screen, and step down a line when two overlap.

**Behaviour:**
- Opened from the dossier ("Show its magnetosphere") or the board.
- The camera pulled back to fit the bow shock ×1.3.
- A top-right note said it was a diagram that gives off no visible light, with a Hide button.

**Why it was pulled:** the owner found it "crazy". A space-events version should probably be one event per body: a solar-wind gust arriving and the shield flexing, rather than a static diagram parked round the planet.

## 2. The solar wind: how the first version worked

- 6,000 GPU particles leave the drawn Sun's surface.
  - Fast wind (about 750 km/s) above 25° solar latitude; slow (about 400 km/s) near the equator (McComas et al. 2000).
  - On the scene clock, a slow particle reaches the drawn termination shock in one drawn Earth year.
- Termination shock and heliopause distances are taken per direction from `heliosphereRadiusAlong()` in `outerBoundaries.js`, which is still there.
  - In the heliosheath each particle slows to about a third of its speed, reddens, and bends towards the heliotail (+Z), then fades at the heliopause.
- Eight Parker-spiral field lines in the ecliptic out to 10 AU:
  - φ = φ0 − 1.0715·(r − R☉) rad/AU, which is 2π/25.38 d over 400 km/s.
  - They turn 14.39 times per Earth year.
- A minimum pace while a body is focused, so it never freezes.

## 3. How the Solar System formed

Six stages on a log-time clock (10 thousand years to today), each with a canvas animation:
- cloud collapse
- disc and snow line
- Jupiter's early core and the gap it opens
- rocky embryos and the Moon-forming impact
- the giant-planet instability
- the settled system

Measured dates, with sources:
- First solids (CAIs), 4,567.30 Myr ago: Connelly 2012
- Jupiter's core at about 1 Myr: Kruijer 2017
- Mars finished at 2–4 Myr: Dauphas & Pourmand 2011
- Gas disc gone at about 4 Myr: Wang 2017
- The giant-planet instability: Nesvorný 2018
- Oldest zircons, 4.4 Gyr: Wilde 2001

## 4. Why there are seasons

- Earth, Mars and Uranus, each with its real tilt (23.44°, 25.19°, 97.77°).
- A top-down orbit with the axis keeping one direction.
- A sub-solar-latitude readout: declination = asin(sin tilt · cos λ).
- Steps explaining tilt versus distance.

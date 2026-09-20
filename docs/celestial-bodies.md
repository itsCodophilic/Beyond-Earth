# Celestial bodies — what the scene contains

A census of everything Beyond Earth actually builds: every body, what makes
each one distinct, what it carries in its dossier, and what the sky behind it
is made of. Written so that adding the next body — or the next event — starts
from a list rather than a search.

Counts are read from the catalogues in `src/js/`, not estimated.

---

## The four newest worlds, and what they have

Ixion, Salacia, Varda and Varuna now carry **real surface maps** built from
supplied reference photographs through `tools/dwarf-textures`, the same
unwrap-and-relight pipeline as Sedna, Eris and Gonggong. They were procedural
before.

| World | Diameter | Moon | Rings | Note |
|---|---|---|---|---|
| **Ixion** | 697 (+11/−9) km | none | none | A 2026 occultation found no companion and no circum-object material. With no moon there is nothing to weigh it with, so its mass and density are unknown |
| **Salacia** | 838 ± 44 km | **Actaea** ≈393 km | none | Doubly synchronous — Salacia's day, Actaea's day and the month between them are all 5.49 days |
| **Varda** | 740 ± 14 km | **Ilmarë** ≈403 km | none | Varda holds 84–90% of the system mass, very nearly the Pluto–Charon ratio. Prograde at 77.4°, not retrograde |
| **Varuna** | ≈668 km equivalent | none confirmed | none | A Jacobi ellipsoid about 1,000 km on its long axis, spun into that shape by a 6 h 21 m day. Density just under water's |

Both moons are in `transNeptunianMoonCatalog.js` with published mutual-orbit
elements, converted to the ecliptic frame. Two notes are recorded there and are
worth repeating: a point-of-light moon's **diameter and albedo are one choice,
not two**, and the two systems' solutions are published in **different frames** —
mixing them puts one moon 23° out of plane.

For what is still missing, see `bodies-to-draw-next.md`.


## The headline numbers

| | |
|---|---|
| Star | **1** — the Sun |
| Planets | **8** |
| Dwarf planets | **5** IAU-recognised, plus **8** candidates |
| Moons | **453** |
| Named asteroids | **5**, in a belt of ~134,500 drawn rocks |
| Visited small bodies | **15** — thirteen spacecraft targets plus Dactyl and Dimorphos, each from its published shape model |
| Kuiper Belt | a population of **~7,000** objects in 6 sub-populations |
| Outer boundaries | the **heliosphere** (termination shock, heliopause) and the **Oort Cloud** (inner and outer) |
| Ring systems | **6** — four planetary, two around small bodies — with 36 named rings and arcs |
| Named deep-sky objects | **119** |
| Background stars | up to **90,000** |
| Space events | **17** (see `docs/space-events.md`) |

**Individually named and placed: 611 Solar System bodies, plus 119 deep-sky
objects.**

---

## The Sun

One star, built in layers rather than as a ball — `src/js/stars/sun/sun.js`.

| Layer | What it is |
|-------|-----------|
| Photosphere | The visible surface, with granulation and sunspots |
| Chromosphere | The thin warm shell above it |
| Spicules | Instanced jets of gas standing on the limb |
| Inner corona | The bright close halo |
| Outer corona | The broad faint one |
| Solar glow | The bloom that carries at distance |
| Distant star flare | What the Sun becomes once you are light-years out |
| Point light | The single light source the whole system is lit by |

The Sun rescales itself every frame so it keeps its true angular size from
wherever the viewer is standing — it is not drawn at a fixed radius.

The plasma machinery (jets, coronal loops, flares) is present but its three
lists are deliberately empty: the red arcs they drew read as decoration rather
than as a star. Putting any of them back is a matter of filling a list.

---

## The planets

All eight, each with its own module under `src/js/planets/`. Diameters are the
values in the dossiers.

| Planet | Diameter | What it carries beyond a textured sphere |
|--------|----------|------------------------------------------|
| Mercury | 4,879 km | — |
| Venus | 12,104 km | — |
| Earth | 12,756 km | Cloud deck, high cirrus veil, atmospheric limb, night-side city lights, polar aurora, and the Moon |
| Mars | 6,779 km | Thin atmosphere, two discrete southern aurora groups (Terra Sirenum, Terra Cimmeria), storm aurora surge, Phobos and Deimos |
| Jupiter | 139,820 km | Dedicated upper atmosphere, compact electric-blue spiral aurora with glow and polar core fill, a 4-component dust ring system, 115 moons |
| Saturn | 116,460 km | Northern and southern spiral aurorae with glows and surges, a 7-ring system, 285 moons |
| Uranus | 50,724 km | Methane haze shell, off-axis northern and southern aurorae, broad aurora glow, a 13-ring system, 29 moons |
| Neptune | 49,244 km | A 9-ring-and-arc system, 16 moons |

Uranus's aurorae are deliberately *off-axis*: its magnetic field is strongly
tilted and offset from the rotation axis, so the bands do not sit on the
geographic poles.

---

## Dwarf planets and trans-Neptunian worlds

Thirteen bodies, of two different standings, and the difference is not
cosmetic.

**Five are IAU-recognised dwarf planets:** Ceres, Pluto, Haumea, Makemake and
Eris. That list is the complete official one — there are no others anywhere in
the Solar System at the time of writing.

**Eight are dwarf-planet candidates:** Orcus, Quaoar, Gonggong, Sedna, and —
added later — Salacia, Varda, Varuna and Ixion. Each is large enough that it
is very probably in hydrostatic equilibrium, but none has been formally
classified. They are still a selection rather than the full set: roughly ten
more are considered very likely and over a hundred are possible depending on
whose size threshold is used. The scene labels them "Dwarf planet candidate"
in their own dossiers for exactly this reason, and this document should not
quietly flatten the two groups into one count.

| Body | Diameter | Status | Note |
|------|----------|--------|------|
| Ceres | 939 km | **IAU dwarf planet** | Built inside the asteroid belt, not as a separate planet — it is the largest object there and deserves one home, not two |
| Pluto | 2,376.6 km | **IAU dwarf planet** | 5 moons |
| Haumea | 1,544 km mean · 2,122 × 1,688 × 1,036 km | **IAU dwarf planet** | Spun into an ellipsoid by a 3.9-hour rotation, the fastest of any large body in the Solar System; first TNO found to have a ring |
| Makemake | 1,430 km | **IAU dwarf planet** | |
| Eris | 2,326 km | **IAU dwarf planet** | |
| Orcus | 958.4 km | Candidate | Pluto's near-twin in orbit — same 3:2 resonance, opposite phase |
| Quaoar | 1,098 km | Candidate | Two narrow rings found by occultation in 2023, orbiting outside its Roche limit where theory says they should have formed a moon |
| Gonggong | 1,230 km | Candidate | |
| Sedna | ≈ 906 km | Candidate | The most distant of the set |
| Salacia | 846 km | Candidate | Reflects about 4% of the light reaching it — one of the darkest large bodies known, which is why it hid until 2004. Its moon Actaea is a third of its diameter |
| Varda | ≈ 750 km | Candidate | A massive binary with Ilmarë, ≈ 320 km across; dense enough to be more rock than ice |
| Varuna | ≈ 678 km | Candidate | A 6.34-hour day, fast enough that it cannot hold a round shape — stretched into an ellipsoid, as Haumea is |
| Ixion | ≈ 617 km | Candidate | A Plutino in Pluto's own 2:3 resonance, strongly reddened by tholins, no known moon |

---

## Moons — 453 of them

### By system

| Parent | Moons | Given real modelled surfaces | Rest |
|--------|-------|------------------------------|------|
| Earth | 1 | 1 | — |
| Mars | 2 | 2 | — |
| Jupiter | 115 | 39 | instanced |
| Saturn | 285 | 26 | instanced |
| Uranus | 29 | 29 | — |
| Neptune | 16 | direct-tier by size | instanced |
| Pluto | 5 | 5 | — |

"Instanced" means the body is really there, in its real orbit, drawn from a
shared low-cost geometry until the viewer gets close enough for it to be worth
more. Nothing in the list is a placeholder or a sprite standing in for a moon.

### Earth
**Moon** — LOLA topography driving the vertices directly, so crater bowls,
terraced walls, rims and basins react to light as true geometry rather than as
decals.

### Mars
**Phobos**, **Deimos** — both with their own irregular surfaces.

### Jupiter — 115
- **Galilean, fully modelled:** Io, Europa, Ganymede, Callisto
- **Inner, modelled:** Metis, Adrastea, Amalthea, Thebe
- **Outer irregulars with surfaces (31):** Himalia, Elara, Lysithea, Leda, Dia,
  Pasiphae, Sinope, Carme, Ananke, Callirrhoe, Thyone, Pasithee, Arche, Helike,
  Kore, Herse, Eirene, Philophrosyne, Eupheme, Pandia, Ersa, Aitne, Hegemone,
  Thelxinoe, Kallichore, Eukelade, Cyllene, Themisto, Magaclite, Carpo,
  Valetudo
- **The remaining 76** are catalogued provisional designations (S/2003 J 2
  through S/2021 J 8 and similar), each on its real orbit.

### Saturn — 285
Every officially named moon plus every provisional designation through the
2026 Minor Planet Center announcements.

- **Resolved with real surfaces (26):** Pan, Daphnis, Atlas, Prometheus,
  Pandora, Epimetheus, Janus, Aegaeon, Mimas, Methone, Anthe, Pallene,
  Enceladus, Tethys, Telesto, Calypso, Dione, Helene, Polydeuces, Rhea, Titan,
  Hyperion, Iapetus, Phoebe, Ymir, Paaliaq
- **Named, catalogued:** 66 in total, including the Norse group (Ymir,
  Mundilfari, Skathi, Suttungr, Thrymr, Narvi, Bergelmir, Bestla, Farbauti,
  Fenrir, Fornjot, Hati, Hyrrokkin, Kari, Loge, Skoll, Surtur, Jarnsaxa, Greip,
  Gridr, Angrboda, Skrymir, Gerd, Eggther, Beli, Gunnlod, Thiazzi, Alvaldi,
  Geirrod, Aegir, Bebhionn), the Inuit group (Kiviuq, Ijiraq, Paaliaq, Siarnaq,
  Tarqeq) and the Gallic group (Albiorix, Bebhionn, Erriapus, Tarvos)
- **Provisional:** the 2004, 2005, 2006, 2007, 2009, 2019, 2020 and 2023
  discovery series

### Uranus — 29, all with modelled surfaces
Miranda, Ariel, Umbriel, Titania, Oberon, Cordelia, Ophelia, S/2025 U1, Bianca,
Cressida, Desdemona, Juliet, Portia, Rosalind, Cupid, Belinda, Perdita, Puck,
Mab, Francisco, Caliban, S/2023 U1, Stephano, Trinculo, Sycorax, Margaret,
Prospero, Setebos, Ferdinand.

### Neptune — 16
Naiad, Thalassa, Despina, Galatea, Larissa, Hippocamp, Proteus, **Triton**,
Nereid, Halimede, Sao, S/2002 N5, Laomedeia, Psamathe, Neso, S/2021 N1.

Triton is the one with a real colour brief behind it: pastel pink-and-peach
ice, a creamy pinkish-white south polar cap tinted by tholins, a bluish-green
frost band near the equator, and reddish-yellow "cantaloupe" terrain to the
north.

### Pluto — 5
Charon (≈1,214 km, tidally locked), Styx, Nix, Kerberos, Hydra.

---

## The asteroid belt

Between 44 and 52 orbit-scale units, with Jupiter at 75 — so the belt sits in
its real place relative to the planet that shapes it.

**Named and individually modelled (5):** Ceres, Vesta, Pallas, Hygiea, Psyche.

**The population:**

| Tier | Count | Purpose |
|------|-------|---------|
| Instanced boulders, C-type | 9,000 | Carbonaceous, the dark majority |
| Instanced boulders, S-type | 4,000 | Silicaceous |
| Instanced boulders, M-type | 1,500 | Metallic |
| Unresolved pebbles | 120,000 | The dust that makes a belt look like a belt |

The belt also models **Kirkwood gaps** — the resonance-cleared bands that give
it structure — and **Jupiter's Trojans**, the two swarms sharing Jupiter's
orbit sixty degrees ahead and behind.

Any rock can be picked and inspected; close approach swaps in real surface
geometry rather than enlarging the instanced form.

---

## The visited small bodies — 15

Rank 1 of `bodies-to-draw-next.md`, in `src/js/scene/smallBodies/`. Thirteen
objects a spacecraft has flown past, orbited, landed on, hit or bounced radar
off, plus the two moons that come with them. They are the only small bodies in
the Solar System whose **shape** is known rather than assumed, and that is why
they are here: each silhouette is built from the published shape model rather
than from a noise-pushed sphere.

| Body | Size | Who measured it | What it is for |
|---|---|---|---|
| **486958 Arrokoth** | 34.5 × 19.8 × 13.8 km | New Horizons, Porter et al. 2024 shape model | The only cold classical KBO ever seen; two lobes touching over a 600 m contact |
| **99942 Apophis** | ≈450 × 170 m | Goldstone/Arecibo radar, Brozovic et al. 2018 | 13 April 2029. No photograph of it exists and the card says so |
| **101955 Bennu** | 484.44 ± 0.30 m | OSIRIS-REx OLA laser altimeter | Sample returned 2023; albedo 0.044 |
| **162173 Ryugu** | 896 ± 4 m | Hayabusa2 ONC/LIDAR | Spinning-top twin to Bennu; albedo 0.045 |
| **67P/Churyumov–Gerasimenko** | 4.3 × 4.1 × 2.6 km | Rosetta OSIRIS SHAP7 shape model | The duck. Two years of orbit, one lander |
| **433 Eros** | 34.4 × 11.2 × 11.2 km | NEAR Shoemaker NLR laser rangefinder and MSI | First asteroid orbited and landed on |
| **65803 Didymos + Dimorphos** | 761 ± 24 m / 151 ± 5 m | DART DRACO, Daly et al. 2024 | The first orbit humans deliberately changed |
| **1P/Halley** | ≈14.9 × 8.2 km | Giotto HMC, 14 March 1986 | Albedo 0.04. No reference photograph was supplied and none is needed: it is drawn from the Giotto measurements |
| **243 Ida + Dactyl** | 59.8 × 25.4 × 18.6 km / 1.4 km | Galileo SSI shape model | The discovery that asteroids can have moons |
| **25143 Itokawa** | 535 × 294 × 209 m | Hayabusa AMICA/LIDAR | First sample return; the otter-shaped rubble pile |
| **253 Mathilde** | 52.8 ± 2.6 km | NEAR Shoemaker MSI | Density 1.3; five craters nearly as wide as the body |
| **21 Lutetia** | 98 ± 2 km | Rosetta OSIRIS NAC | Possibly a surviving planetesimal |
| **951 Gaspra** | 12.2 km | Galileo SSI | The first asteroid ever seen close up |

**4 Vesta is not here.** It is number one on the Rank 1 list and it was already
built, as a `MAJOR_BODIES` entry inside `scene/asteroidBelt.js` alongside
Ceres, Pallas, Hygiea and Psyche. Adding it here would put two Vestas in one
Solar System.

### Three rules the catalogue follows

**Every number says who measured it.** Not "490 m" but "484.44 ± 0.30 m —
OSIRIS-REx OLA laser altimeter". Orbits are quoted with the JPL Small-Body
Database solution number and the epoch they were fitted at; physical
parameters name the mission or the instrument. Where something is inferred
rather than measured — Halley's relief, Apophis's entire surface, the colour
of anything only ever photographed in black and white — the card says so in
those words.

**Shape is the identity.** A sphere with a photograph on it is the wrong
drawing of nearly everything here, so the silhouette is built in geometry:
overlapping ellipsoids combined with a soft maximum for the contact binaries,
negative lobes for Eros's Himeros saddle, planar facets for Lutetia and
Gaspra, and equatorial ridges for the three spinning tops. Colour is laid on
that, never the other way round.

**Dark means dark.** Halley 0.04, Mathilde 0.0436, Bennu 0.044, Ryugu 0.045,
67P 0.062 — coal is 0.05. Every base colour is derived from the body's
measured geometric albedo in linear light, and the Sun's own 1/r falloff is
cancelled first so that on screen the brightness ordering is the *albedo*
ordering rather than an ordering of how close each body happens to be to the
Sun. Measured after that change: Eros (0.250) renders 5.6 times brighter than
Mathilde (0.0436) in linear light, against a true albedo ratio of 5.7.

### What it costs

Fifteen meshes, fifteen draw calls, 116,124 triangles, no textures, no orbit
lines, no transparency. Geometry is sculpted co-operatively during the
progressive belt build so the loader keeps animating. The per-frame update is
one Kepler solve and two quaternion compositions per body: 3,600 frames in
30 ms. `scripts/check-small-bodies.mjs` measures all of it without a GL
context.

### What is real and what is not

The orbital elements are real, and each body is placed at its real
heliocentric *distance* for today's date by propagating the published mean
anomaly forward from its own epoch. The **planets** in this scene are at
authored longitudes rather than their true ones, so the angle between one of
these bodies and Earth on screen is not a sky you could go outside and check.
Radial distance and rendered size are compressed by the same curves the rest
of the scene uses. A moon's drawn size relative to its parent is exaggerated —
Dactyl is 4.5% of Ida's mean radius and is drawn at about 15% — and both moon
cards state the real figure alongside the drawn one.

---

## Ring systems

Six bodies, 36 named rings and arcs. Every ring is a named band at its real
radius, not a generic annulus, and every one of them is clickable and reaches
the ring roster in its parent's dossier.

Two categories, which are worth keeping apart — a planetary ring system and a
ring around a 1,100 km trans-Neptunian body are not the same kind of object.

### Planetary ring systems — all four giants

| Planet | Rings | Named |
|--------|-------|-------|
| Jupiter | 4 | Halo, Main, Amalthea Gossamer, Thebe Gossamer |
| Saturn | 7 | D, C, B, A, F, G, E |
| Uranus | 13 | Zeta, 6, 5, 4, Alpha, Beta, Eta, Gamma, Delta, Lambda, Epsilon, Nu, Mu |
| Neptune | 9 | Galle, Le Verrier, Lassell, Arago, Adams, plus the four arcs — Liberté, Égalité, Fraternité, Courage |

**Jupiter's** is the faintest and the one most often left out. It is dust
rather than ice — debris knocked off the four small inner moons by
micrometeoroids — which is why it reflects so little. The distinctive thing
about it is vertical: the Halo is a thick torus some 12,500 km deep, while the
Main Ring beside it is a wafer under 100 km thick, and the two gossamer rings
are as deep as the orbits of the moons that feed them. The build carries those
real thicknesses rather than drawing four flat annuli.

**Neptune's** arcs are the other interesting case: they are incomplete,
clumped sections of the Adams ring rather than full rings, held together by a
resonance with Galatea.

### Rings around small bodies — 2

| Body | Rings | Named |
|------|-------|-------|
| Haumea | 1 | Haumea's Ring — centre 2,287 km, about 70 km wide |
| Quaoar | 2 | Q2R (2,520 km, 10 km wide) and Q1R (4,057 km, 60 km wide) |

Both are drawn, in `src/js/planets/icyRings.js`, the same way the planetary
systems are: independently orbiting particles with an invisible annulus per
ring for the pointer to hit. Quaoar's are the ones that broke the theory —
both sit outside its Roche limit, where the material should long since have
gathered into a moon.

*Ring-bearing bodies known in the Solar System is a larger number than this,
and growing; six is what Beyond Earth builds, not a census of what exists.*

### When rings are drawn

Only Saturn's rings are visible at every distance, which is also true in
life — they are the one ring system a backyard telescope shows. The other
three planetary systems fade out between 14 and 70 planet radii and are
switched off beyond that, so the system view shows planets rather than a
field of glowing hoops. The rule and the measured numbers behind it are in
`src/js/planets/ringProximity.js`.

Jupiter's are drawn in **forward-scattered light** — the geometry every real
image of them was taken in, with the spacecraft looking back through the dust
towards the Sun. At their true back-scattered reflectivity they would be
invisible on any screen. The relative brightness between the four components
is kept honest even though the absolute level is not.

---

## The Kuiper Belt

Past Neptune there used to be nothing at all: eight named worlds with empty
space between them, which is precisely backwards. Past Neptune is where the
Solar System stops being eight planets and starts being a disc of ice.

There are over a thousand catalogued Kuiper Belt objects and an estimated
hundred thousand larger than 100 km. Drawing them individually is neither
possible nor useful, so `src/js/scene/kuiperBelt.js` draws a **statistically
honest population** — the right number of objects in the right places, with
the real orbital structure, and no claim that any particular speck is any
particular body.

Six sub-populations, because the belt is not one thing:

| Population | Semi-major axis | Character |
|---|---|---|
| **Cold classical** | 42 – 47.7 AU | Nearly circular, nearly flat, and deeply red. Formed roughly where they are and never disturbed — the least-changed material in the Solar System. |
| **Hot classical** | 39.5 – 47.7 AU | Same distances, inclined up to 34°, neutral grey. Scattered outward from nearer the Sun and dropped here, which is why they look different. |
| **Plutinos** | ≈ 39.4 AU | Locked in Neptune's 3:2 resonance. Eccentric enough to cross Neptune's orbit and — the whole point of a resonance — never anywhere near Neptune when they do. Pluto is one. |
| **Twotinos** | ≈ 47.9 AU | The 2:1 resonance, at the far edge of the classical belt. |
| **Scattered disk** | 50 – 150 AU | Perihelion out at Neptune's orbit, aphelion anywhere. Steep and eccentric. Eris and Gonggong belong here. |
| **Detached** | 160 – 480 AU | Perihelion beyond Neptune's reach entirely. Nobody is sure how they got there. Sedna is the famous one, and there are very few. |

**The Kuiper Cliff is built deliberately.** The classical belt does not fade
out at its outer edge, it *stops*, at about 47.7 AU, and why it stops is an
open question. The radial distribution has a hard edge for that reason and not
for a rendering one — a soft falloff there would be drawing the wrong Solar
System.

Two other pieces of real structure: the resonant populations are **phased**,
held roughly 72° (3:2) and 92° (2:1) away from Neptune on either side, which
is the actual mechanism by which orbits that cross Neptune's never produce an
encounter. And the colours are **bimodal** — a very red group and a neutral
group — which is one of the strongest surviving clues to where each population
formed.

Positions come from real orbital elements: semi-major axis, eccentricity,
inclination, longitude of the ascending node, argument of perihelion and a
random mean anomaly, solved through one Newton step on Kepler's equation. The
belt is deterministic, so it is the same belt on every load.

It is not animated along those ellipses. A Kuiper Belt object takes 250 to 300
years to go round and a scattered-disk object can take thousands, so nothing
would move a pixel in a session; each population rotates as a rigid sheet
instead, inner populations leading, at six numbers per frame rather than
thirty thousand.

---

## The outer boundaries

Past the Kuiper Belt there are two outer edges, and they are not the same
edge. Confusing them is the most common mistake made about the outer Solar
System, and drawing them together is the clearest way to avoid it.

| Boundary | Distance | Scene radius | Observed? |
|---|---|---|---|
| Termination shock | ~85 AU | 2,590 | **Yes** — Voyager 1, Dec 2004 at 94 AU; Voyager 2, Aug 2007 at 84 AU |
| Heliopause | ~120 AU | 2,633 | **Yes** — Voyager 1, 25 Aug 2012 at 121.6 AU; Voyager 2, 5 Nov 2018 at 119 AU |
| Inner Oort Cloud | 2,000 – 20,000 AU | 3,723 | **No** — inferred |
| Outer Oort Cloud | 20,000 – 100,000 AU | 6,311 | **No** — inferred |

The termination shock and the heliopause are **completely invisible**. They
emit no light and they are not dust, cloud or any kind of surface; an
astronaut beside either one would see an ordinary starfield and could not tell
which side of it they were on. Both are drawn as **diagrams**, and both cards
say so before they say anything else. The Oort shells are a separate case —
not unobservable, just never yet observed.

The Oort shells were moved outward (from 2,965 and 3,465) because the old
spacing put the outer Oort Cloud at only 1.32× the heliopause's radius for a
real ratio of 833 — and once the heliotail was added, the heliopause reached
*further from the Sun than the Oort Cloud did*. The heliosphere's tail is now
clipped to stay inside whatever encloses it, by rule rather than by number.

The **heliopause is where the solar wind stops.** The **Oort Cloud is where
the Sun's gravity lets go** — eight hundred times further out. Voyager 1 is
the most distant object humans have built and is still, gravitationally, deep
inside the Solar System; it needs about three hundred centuries to reach the
Oort Cloud's inner edge.

### How they are drawn

All four are **limb-brightened shells**: alpha rises where the line of sight
grazes the surface and falls to almost nothing where it hits square on. That
is why a soap bubble has a visible rim, and it is what makes these read as
shells rather than as balls — from inside or outside.

The two heliosphere shells are **squashed and offset**. The Sun moves through
the interstellar medium, so its bubble is compressed on the leading side and
drawn into a long heliotail behind. That shape is the idea rather than a
solved flow: IBEX data has been read as a rounded bubble and also as a
croissant, and the argument is not settled.

The Oort Cloud is drawn as a **shell of probability**, not a field of rocks.
It has never been detected at any wavelength. What is known is that
long-period comets arrive from every direction on orbits that, traced
backwards, all reach the same enormous range of distances — we see the pieces
that fall out of the cloud, never the cloud. A belt of crisp individual
objects out there would be a lie, and an attractive one.

**The one measurement that matters:** its mean |sin(latitude)| is **0.507**.
A perfect sphere gives 0.5 and a flat disc gives nearly 0 — so the Oort Cloud
is genuinely isotropic, which is its defining difference from every other
population in the scene. Everything else here is a disc, because everything
else formed in one. This material was thrown outward and then stirred for
billions of years by passing stars and the Galaxy's own tide until no memory
of a plane survived.

All four are hoverable and open the same dossier a world does, with Sedna
travellable from the inner Oort Cloud as its only possible known member.

---

### Their surfaces are calculated, not photographed

None of these has an imaging mission. Pluto looks like a photograph because it
is one; every other world out here has never been resolved into more than a
handful of pixels, and there is no map of any of them to wrap around a sphere.

What there *is* is spectroscopy, and it is surprisingly specific — which ices
are present, how reflective the surface is, how far the tholins have reddened
it. So `graphics/dwarfWorldTextures.js` paints each one from measurements:
Eris at 0.96 albedo is nearly white, Salacia at 0.042 is nearly black, an
twentyfold difference that is the most conspicuous thing about the set. The
*arrangement* of patches is invented, because nobody knows where they are.
How much of each thing there is, how bright, and what colour are not.

---

## What every body tells you

Clicking a body opens a dossier — `src/js/ui/planetDetailsPanel.js`. Six facts
are always shown:

- Mass vs Earth
- Size vs Earth
- Physical diameter
- Distance / position
- Orbital period / motion
- System relation

Behind *Explore scientific details*, eight more:

- Atmospheric composition
- Surface / atmospheric temperature
- Rotation period · day length
- Axial tilt
- Gravity
- Surface evidence
- Ring system, with the named ring roster where there is one
- Celestial story

Values are rounded educational figures credited to NASA Science and NASA/JPL
physical parameters, with the sources linked in the panel footer.

---

## The space background

Four layers, all in `src/js/scene/space/`, three of them painted on a shell
that rides with the camera.

Be exact about what that shell is: a **rendering rule, not a distance**. Every
deep-sky object is placed in its real direction and drawn at its real angular
size, but all of them sit at the same shell radius — Alpha Centauri and the
Andromeda Galaxy included, four light-years and two and a half million
light-years away respectively. It is a sound approximation rather than a
fudge, because the nearest object in the catalogue is about 4.4 light-years
off while the whole journey spans a few hundred AU, so the parallax being
discarded is far below one pixel. It is not a statement that nothing exists
nearer than four light-years.

### Named deep sky — 119 objects

**86 stars**, the brightest in the real sky, at their real positions: Sirius,
Canopus, Rigil Kentaurus, Arcturus, Vega, Capella, Rigel, Procyon, Achernar,
Betelgeuse, Hadar, Altair, Acrux, Aldebaran, Antares, Spica, Pollux,
Fomalhaut, Deneb, Mimosa, Regulus, Adhara, Castor, Gacrux, Shaula, Bellatrix,
Elnath, Miaplacidus, Alnilam, Alnair, Alnitak, Regor, Alioth, Mirfak, Kaus
Australis, Dubhe, Wezen, Alkaid, Sargas, Avior, Menkalinan, Atria, Alhena,
Alsephina, Peacock, Polaris, Mirzam, Alphard, Hamal, Algieba, Diphda, Nunki,
Menkent, Saiph, Alpheratz, Kochab, Tiaki, Rasalhague, Algol, Almach, Denebola,
Navi, Muhlifain, Naos, Aspidiske, Alphecca, Suhail, Sadr, Mizar, Eltanin,
Schedar, Mintaka, Caph, Dschubba, Larawag, Merak, Izar, Enif, Girtab, Ankaa,
Phecda, Sabik, Scheat, Aludra, Markeb, Markab.

**23 nebulae and clusters:** Orion, Carina, Lagoon, Trifid, Eagle, Omega,
North America, Rosette, California, Heart, Soul, Veil, Helix and Dumbbell
Nebulae; the Pleiades, Hyades, Double Cluster, Omega Centauri, 47 Tucanae and
the Beehive Cluster; Rho Ophiuchi, the Coalsack and the Cygnus Rift.

**10 galaxies:** Andromeda, Triangulum, the Large and Small Magellanic Clouds,
Centaurus A, Bode's Galaxy, the Cigar Galaxy, the Sculptor Galaxy, the
Whirlpool Galaxy and the Sombrero Galaxy.

### The other three layers

| Layer | High quality | What it does |
|-------|--------------|--------------|
| Background star field | 90,000 stars | The Milky Way band is made of these — it is a field of real point sources, not a painted texture |
| Interplanetary dust motes | 2,800 | The near-field grains that give travel a sense of speed |
| Deep-sky transients | 90 clouds | The nebulosity that brightens when something out there burns |
| Zodiacal light | one shell at 1,260 units | The faint cone of dust along the ecliptic |

Medium and low quality presets scale these to 60,000 / 2,000 / 64 and
24,000 / 800 / 30, with the zodiacal light switched off at low.

---

## What is not here yet

Worth knowing before planning the next addition.

**Bodies.** Two comet nuclei are now travelable — 67P and 1P/Halley, both bare
rather than active, because at 4.8 and 35 AU neither has a coma. No comet is
drawn *with* a tail as a body; the sungrazer is still an event. No spacecraft.
Six near-Earth objects exist as named bodies but there is no near-Earth
population *layer* behind them, and no Trojan swarms beyond Jupiter's. **No Oort Cloud** — and if one is added it has to be
rendered as what it is: an *inferred* population. Nothing in the Oort Cloud
has ever been directly observed; it is deduced from the orbits of long-period
comets, and NASA describes it as a predicted shell somewhere between 5,000 and
100,000 AU. **No heliosphere region** either — and when the termination shock,
heliosheath and heliopause are built, the heliopause must not be labelled "the
edge of the Solar System". It is the edge of the solar wind's bubble. The
Sun's gravitational reach carries on past it, all the way out through the
Oort Cloud.

**Events.** Nothing yet for Venus, Neptune, Pluto, Ceres, Europa, Ganymede,
Callisto, Titan, the asteroid belt, or any comet that is not a sungrazer. The
seventeen that do exist, and the machinery for adding an eighteenth, are in
`docs/space-events.md`.

**Natural next steps, in rough order of how much exists to build on:**

1. A **lunar eclipse** — Earth's shadow on the Moon. The mirror of the solar
   eclipse, and nearly all the machinery is already written.
2. **Venus** has a planet, an atmosphere and no event at all. Lightning, or the
   super-rotating cloud deck, would be the first thing anyone looks for.
3. **Titan** is fully modelled and does nothing. Methane rain and the polar
   lakes are its signature.
4. **Neptune's Great Dark Spot** — Saturn's Great White Spot already proves the
   storm machinery works on a gas giant.
5. **Europa's water-vapour plumes** — Enceladus's jets are the template.
6. **A Kuiper Belt population**, reusing the asteroid belt's instancing.
7. **An active comet**: 67P and Halley are drawn as bare nuclei because that
   is what they are at their present distances. A nucleus with a coma and a
   growing tail, visitable near perihelion, is the piece still missing.

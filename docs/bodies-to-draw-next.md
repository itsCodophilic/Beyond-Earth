# Bodies we have not drawn yet

Compiled September 2026 from NASA/JPL, the IAU Minor Planet Center, ESA and the
published literature. The point of this file is **which of these you can find a
real photograph of**, because that decides how a body can honestly be drawn.

## Rank 1 is built

**Every one of the fourteen Rank 1 rows below is now in the scene.** Thirteen
of them were built this round, in `src/js/scene/smallBodies/`, along with the
two moons that come with them — Dactyl and Dimorphos, fifteen bodies in all.
The census is in `celestial-bodies.md`. Every card names the instrument behind every number,
every silhouette comes from a published shape model, and every base colour is
derived from the measured geometric albedo. The rows are left in place because
the reasoning in the "why it earns a place" column is what the cards were
written from.

**4 Vesta is the exception, and it is not a gap.** It was already built before
this round, as a `MAJOR_BODIES` entry inside `scene/asteroidBelt.js` with
Ceres, Pallas, Hygiea and Psyche. It is listed first below because it is the
biggest single omission *from the belt's point of view*; from the scene's, it
was never missing. What it does not have is the Dawn global photomosaic —
`images/4 Vesta.webp` is on disk and unused. If Vesta is ever given a real
surface, it has to happen inside `asteroidBelt.js`, and the note in the four
traps applies: feed a photograph to the generic rocky material and the
displacement map turns the body into a pincushion.

## Rank 2 is built

**All eleven of the Rank 2 rows that were not already in the scene are now
drawn**, in `src/js/scene/smallBodies/mainBeltCatalogue.js` — Interamnia,
52 Europa, Davida, Sylvia, Eunomia, Euphrosyne, Cybele, Juno, Camilla,
Kalliope and Kleopatra — together with six satellites: Romulus and Remus on
Sylvia, Alexhelios and Cleoselene on Kleopatra, Linus on Kalliope, and
S/2019 (31) 1 on Euphrosyne. Pallas, Hygiea and Psyche were already inside
`asteroidBelt.js`, as Vesta is.

The difference from Rank 1 is stated in every card. These have **measured
shapes and borrowed surfaces**: VLT/SPHERE resolved each into a disc and a
tri-axial ellipsoid, so the proportions, the sizes, the albedos and the
orbits are real, and the relief is taken from the nearest spectral analogue
anyone has photographed — Ida for the S-types, Mathilde for the C and P
types, Lutetia for the M and X types.

**107 Camilla's two satellites are deliberately not drawn.** They exist, but
the published orbit solutions available here disagree by more than the
separation itself, and a moon in the wrong place is worse than no moon. Its
card says so.

## Rank 3 is built

**All four Centaurs are now drawn**, in
`src/js/scene/smallBodies/centaurCatalogue.js` — Chariklo, Chiron, Pholus and
Echeclus — and with them the first ring systems in this scene that do not
belong to a planet or a dwarf planet.

These are a third kind of evidence again. Rank 1 had photographs and Rank 2
had resolved discs; **not one of these four has ever been resolved by
anything**. Everything drawn about their sizes and shapes comes from stellar
occultations — timing how long a star stays hidden behind them from several
telescopes at once — which measures a chord to within a kilometre or two and
gives a limb from enough chords. It is also how the rings were found.

- **Chariklo** carries its two rings, Oiapoque and Chuí, at the occultation
  radii, on its **measured pole**. Its pole is known to half a degree because
  the rings were edge-on in 2008 and open to 34° by 2013, and that change is
  what solved it. The rings are drawn at 7% albedo against the body's 3.6%,
  which is the measurement, and is why Chariklo looked too bright for years.
- **Chiron** carries three narrow rings and a diffuse disc, and its card says
  what makes it different from Chariklo's: the material is **not the same
  from one epoch to the next**. It also carries a coma, because it is comet
  95P as well as asteroid 2060.
- **Pholus** is the reddest object measured anywhere, drawn at its measured
  a/b of 1.9 from the 0.60 mag lightcurve. Its colour and Chiron's are the
  two ends of the Centaur bimodality, and nothing else in the scene spans it.
- **Echeclus** has a coma and, unusually, a **measured absence**: its
  occultation looked for rings and found none, to a limit that would have
  caught anything as substantial as Chariklo's.

Two things were built along the way and are reusable. `icyRings.js` now
serves small bodies as well as planets, so any future ringed body is a
catalogue entry rather than a renderer. And `pick_patch` in the texture
pipeline learned to ask for a *representative* window rather than the most
detailed one — see the note there about Phobos's grooves.

## Rank 4, batch A is built

Fourteen trans-Neptunian worlds and five moons, in
`src/js/scene/smallBodies/tnoCatalogue.js`, through the small-body builder:
Máni, Chiminigagua, Achlys, Aya, Uni, Gǃkúnǁʼhòmdímà, Huya, Goibniu, Ritona,
Xewioso, Rumina, 2014 UZ224, Chaos and Leleākūhonua, with Tinia, Gǃòʼé ǃHú,
Huya I and the unnamed moons of Chiminigagua and Achlys.

- Orbits are JPL SBDB at full precision, epoch JD 2461200.5, queried
  26 September 2026 (the `sbdb.api` endpoint takes `full-prec=1`; without it
  every element comes back rounded to three figures).
- Sizes come from occultations where they exist (Máni, Achlys,
  Gǃkúnǁʼhòmdímà, Huya, Leleākūhonua) and from thermal data otherwise.
- They are drawn on the **planet builder's size curve** (`sizeCurve:
  "dwarf"`), not the asteroid curve. On the asteroid curve Máni would have
  come out ten times Varuna's size.
- Máni's 322 km crater and its 25 km rise are geometry.
- Surfaces are borrowed from Arrokoth. Colour and albedo are measured, except
  for Xewioso and Leleākūhonua, whose colours have never been measured; they
  are drawn neutral and their cards say so.
- Four wide systems are framed on the primary, not the pair (`framePair:
  false`). Framed on the pair, the primary was a 5–10 px dot.
- "Where to next" gains a **Kuiper Belt and beyond** group. It also lists the
  twelve worlds the planet builder draws, so Pluto is in the list too.
- The Kuiper Belt region cards list the new members.

Two inconsistencies found along the way were left alone because they
predate this batch:

- Ceres and the Centaurs are drawn on the asteroid curve. The trans-Neptunian
  worlds are on the planet curve.
- Chaos's two-lobed occultation outline is not yet refereed, so it is drawn as
  one body.

**Rank 4 batch B (the near-equal binaries) and Rank 5 onward are untouched.**

## Corrections to this list

**Phobos and Deimos are already built.** They were listed here as missing in the
first draft of this file and that was wrong — `src/js/planets/mars/satellites/`
has both, with their own surface factories, and `satelliteSystem.js` routes
Mars to them. Caught on review; the row has been removed. Anything else in this
file should be checked against `celestial-bodies.md` before work starts on it.

## The imagery reality, first

This is the single most important thing on the page, and it is not obvious.

| Tier | What exists | Roughly how many |
|---|---|---|
| 1 | **Global spacecraft maps** — real photomosaic and shape model | ~40 bodies |
| 2 | **Telescope-resolved discs** — 20–60 px across, coarse but real | ~25 large main-belt asteroids |
| 3 | **Radar shape models** — true 3D geometry, **no surface** | a handful of near-Earth objects |
| 4 | **Occultation silhouettes** — a real outline, no surface | ~8 trans-Neptunian objects |
| 5 | **A point of light** — nothing. The surface must be invented | everything else |

**Outside the Pluto system, Arrokoth and Triton, no trans-Neptunian object has
ever been resolved.** Eris, Makemake, Sedna, Quaoar, Gonggong — every one of
them is a point of light, including the ones already in this scene. That is why
`tools/dwarf-textures` exists and why those cards say the surface is a
reconstruction.

---

## Rank 1 — the real holes, all spacecraft-imaged

Every one of these has a usable reference photograph today.

Every row below is now built except Vesta, which was already built elsewhere.

| # | Name | Type | Size | Why it earns a place |
|---|---|---|---|---|
| 1 | **4 Vesta** — *already in `asteroidBelt.js`* | Protoplanet | 525 km | The biggest single omission. Differentiated, with an iron core, and Rheasilvia's central peak is 22 km tall — higher than Olympus Mons. Dawn orbited it for 14 months. **Full global map + terrain model** |
| 2 | **486958 Arrokoth** — *built* | Cold classical KBO | 36 km | The most distant object ever visited and the only pristine cold classical ever seen. Two flattened lobes that settled together at walking pace. We draw the classical belt but have no body from it |
| 3 | **99942 Apophis** — *built* | Near-Earth asteroid | ~340 m | **13 April 2029**: passes ~32,000 km up, inside geosynchronous orbit, naked-eye for two billion people. Highest public interest of anything on this list. Radar shape model only — no surface photograph |
| 4 | **101955 Bennu** — *built* | Carbonaceous NEA | 490 m | Sample returned 2023. The best-characterised small body in existence, mapped to sub-centimetre |
| 5 | **162173 Ryugu** — *built* | Carbonaceous NEA | 896 m | Hayabusa2 samples contain amino acids. Spinning-top twin to Bennu |
| 6 | **67P/Churyumov–Gerasimenko** — *built* | Comet | 4.1 km | The best-imaged comet by an enormous margin. Rosetta orbited it for two years; Philae landed. If we draw one comet nucleus, this one |
| 7 | **433 Eros** — *built* | Near-Earth asteroid | 34 km | First asteroid orbited and first landed on. Fully mapped |
| 8 | **65803 Didymos + Dimorphos** — *built* | Binary NEA | 780 / 151 m | The first deliberate change to another world's orbit (DART, 2022). **ESA's Hera arrives November 2026** — new imagery within weeks |
| 9 | **1P/Halley** — *built* | Comet | 15 km | Albedo 0.04, one of the darkest things in the Solar System, which surprised everyone in 1986 |
| 10 | **243 Ida + Dactyl** — *built* | Main belt + moon | 28 km + 1.4 km | The discovery that asteroids can have moons |
| 11 | **25143 Itokawa** — *built* | Near-Earth asteroid | 350 m | First asteroid sample return; proved the rubble-pile model visually |
| 12 | **253 Mathilde** — *built* | Main belt | 53 km | Density 1.3 — half of it is empty space. Five craters nearly as wide as the body |
| 13 | **21 Lutetia** — *built* | Main belt | 100 km | Possibly a surviving planetesimal |
| 14 | **951 Gaspra** — *built* | Main belt | 12 km | The first asteroid ever seen close up |

## Rank 2 — large main-belt asteroids that are genuinely resolved worlds

All imaged in the VLT/SPHERE survey of the 42 largest — real deconvolved discs,
20–60 px, enough for a credible low-resolution texture and an accurate shape.

**2 Pallas** (511 km, the most cratered large asteroid known) · **10 Hygiea**
(433 km, nearly spherical and proposed as a dwarf planet by shape) ·
**704 Interamnia** (332 km) · **16 Psyche** (223 km, the metal world; NASA's
Psyche arrives 2029) · **216 Kleopatra** (a dog-bone with two moons — the most
visually arresting asteroid there is) · **52 Europa** · **511 Davida** ·
**87 Sylvia** (two moons, first known triple) · **15 Eunomia** ·
**31 Euphrosyne** · **65 Cybele** · **3 Juno** · **107 Camilla** ·
**22 Kalliope** (density 4.3, moon Linus)

## Rank 3 — Centaurs, and the ringed ones especially

Rings are a theme in this scene and not one centaur was in it. All four rows
below are now built; the sizes have been corrected to the occultation
measurements as part of that.

- **10199 Chariklo** (249 km volume-equivalent) — *built* — **the first
  non-planet ever found to have rings** (2013). Two narrow rings, Oiapoque and
  Chuí, 14 km apart. Point of light: the rings are known only from
  occultations
- **2060 Chiron** (196 ± 34 km) — *built* — has both an asteroid and a comet
  designation, and a ring system reported to be *in formation*
- **5145 Pholus** (99 +15/−14 km) — *built* — the reddest object in the Solar
  System. The ~99 km here is Herschel-PACS; JPL still lists an IRAS-era 190 km
  with a 0.044 albedo, and the two disagree by a factor of two in size and
  three in albedo
- **60558 Echeclus** (60.0 ± 1.0 km) — *built* — violently outbursts, once
  ejecting a fragment brighter than the nucleus

## Rank 4 — more dwarf-planet candidates

Note: there was a large IAU naming wave in 2025. Several bodies that used to be
designations now have names.

| Name | Size | Why |
|---|---|---|
| **307261 Máni** (was 2002 MS4) | 796 km | **The strongest single addition here.** Its 2020 occultation found a depression **322 km wide and 45 km deep**, plus a 25 km peak — among the most extreme topography anywhere, and far beyond what an icy body that size should support. Larger than Salacia or Varda |
| **532037 Chiminigagua** (was 2013 FY27) | 742 km | Ninth-brightest TNO known; has a 160–210 km moon |
| **208996 Achlys** (was 2003 AZ84) | ~750 km | Large plutino with a satellite larger than photometry predicted |
| **55565 Aya** (was 2002 AW197) | 768 km | One of the largest TNOs with **no moon at all** — a useful control case |
| **55637 Uni** (was 2002 UX25) | 664 km | **Density 0.82 — the largest known object less dense than water.** It directly contradicts the model that large TNOs form by accreting smaller denser ones |
| **229762 Gǃkúnǁʼhòmdímà** | 642 km | Occultation-measured shape, a 112–140 km moon, and the most remarkable name in the Solar System |
| **90568 Goibniu**, **145452 Ritona**, **78799 Xewioso**, **145451 Rumina** | 520–680 km | Newly named, well-characterised |
| **2014 UZ224 "DeeDee"** | 635 km | Aphelion 181 AU, period 1,153 years — excellent for showing the scattered disk's true reach |
| **19521 Chaos**, **38628 Huya** | 411–600 km | Huya has a ~217 km moon confirmed two independent ways |
| **541132 Leleākūhonua** | ~220 km | Third Sedna-like inner-Oort body ever found. If we draw the inner Oort Cloud, this is one of the three objects that motivate it |

**Near-equal binaries** — a system type we have no example of, and the signature
of cold-classical formation by gravitational collapse: **47171 Lempo** (a
hierarchical *triple*) · **79360 Sila–Nunam** (doubly synchronous, mutual
eclipses observed) · **88611 Teharonhiawako** · **148780 Altjira** ·
**385446 Manwë** (Tolkien pair, complements Varda–Ilmarë)

## Rank 5 — moons of dwarf planets as bodies in their own right

**Dysnomia** (Eris, 615 km — albedo 0.05 orbiting a body of 0.96, the largest
albedo contrast known) · **Vanth** (Orcus, 443 km, mass ratio 16% — higher than
Pluto–Charon; mutual eclipses begin in 2082) · **Hiʻiaka** and **Namaka**
(Haumea) · **Weywot** (Quaoar) · **MK 2** (Makemake) · **Xiangliu** (Gonggong)
— *all of these are already drawn.* Still missing: **Nix, Hydra, Kerberos,
Styx** are drawn, and they are fully imaged by New Horizons, so their textures
could be real rather than generated.

## Rank 6 — mid-sized moons, nearly all spacecraft-imaged

Best value-per-effort on the whole list after Rank 1. Most are already in the
scene; the ones worth real textures because real images exist:

**Phoebe** (a captured Kuiper Belt object orbiting Saturn, and the source of the
ring that paints Iapetus black) · **Hyperion** (chaotic rotation — its
orientation is formally unpredictable; density 0.54) · **Janus & Epimetheus**
(swap orbits every four years) · **Pan, Atlas, Daphnis** (the "ravioli" moons,
with equatorial ridges of accreted ring material) · **Telesto, Calypso, Helene,
Polydeuces** (Trojan moons at Tethys's and Dione's Lagrange points — no other
planet has these) · **Methone** (the smoothest surface known) · **Amalthea**
(density 0.86, less than water) · **Proteus** (the largest body known to be
irregularly shaped) · **Nereid** (eccentricity 0.75, the most eccentric orbit of
any major moon)

## Rank 7 — comets

**1P/Halley** · **67P** · **9P/Tempel 1** (the only comet deliberately
impacted, then revisited to photograph the crater) · **103P/Hartley 2** ·
**81P/Wild 2** · **19P/Borrelly** · **D/1993 F2 Shoemaker–Levy 9** (the string
of pearls, and the first collision between two Solar System bodies ever
observed — better as an event than a body) · **C/2014 UN271** (nucleus ~119 km,
the largest ever measured) · **C/1995 O1 Hale-Bopp** · **C/2020 F3 NEOWISE** ·
**12P/Pons-Brooks** · **2P/Encke** (shortest period of any known comet)

Nuclei: only the first six have ever been resolved. Hale-Bopp and NEOWISE are
coma and tail imagery only.

## Rank 8 — interstellar visitors, exactly three ever

**1I/ʻOumuamua** (2017) · **2I/Borisov** (2019) · **3I/ATLAS** (2025 — the
largest, the best observed, watched by Hubble, JWST and two Mars orbiters, and
possibly the oldest comet ever seen). **None of the three has ever been
resolved.** The famous cigar-shaped ʻOumuamua is an artist's impression. If we
draw these, the card has to say so.

## Rank 9 — the biggest missing *structure*

**The Jupiter Trojans.** Two swarms of 10,000+ known objects locked 60° ahead of
and behind Jupiter. We have the main belt and the Kuiper Belt as fields and no
Trojan clouds at all, and the Lagrange-point mechanic is one of the most
teachable things in the Solar System.

Named Trojans worth drawing: **624 Hektor** (largest, a bilobed contact binary
*with* a moon) · **617 Patroclus + Menoetius** · **3548 Eurybates** (Lucy flyby
**August 2027**) · **15094 Polymele** (September 2027) · **52246
Donaldjohanson** (already flown, April 2025) · **152830 Dinkinesh + Selam**
(flown 2023; Selam is itself a contact-binary moonlet, nothing like it was
known). Also the **Hilda group**, which traces a rotating triangle over time.

## Rank 10 — near-Earth objects and co-orbitals

**3200 Phaethon** (a rock comet, parent of the Geminids) · **4179 Toutatis**
(tumbles in non-principal-axis rotation) · **469219 Kamoʻoalewa** (Earth's most
stable quasi-satellite, and spectrally it looks like **lunar** material) ·
**3753 Cruithne** (the horseshoe orbit) · **66391 Moshup + Squannit** ·
**1620 Geographos** (the most elongated body of its size known)

---

## If you are sourcing images, start here

Numbers 2, 3, 4 and 6 below are done — the references were supplied and used,
and Halley was built from the Giotto measurements because no usable image of
the nucleus exists. What is left:

1. **Vesta** — Dawn global map. The image is on disk. The body is in
   `asteroidBelt.js`, which is off limits for editing, so this is blocked
   rather than pending
2. ~~**Arrokoth** — New Horizons~~ — built
3. ~~**Bennu**, **Ryugu**, **Itokawa**, **Eros**~~ — built
4. ~~**67P** and **Halley**~~ — built
5. **Pallas**, **Hygiea**, **Psyche**, **Kleopatra** — VLT/SPHERE discs. The
   first three are already drawn as `MAJOR_BODIES` in the belt with generated
   surfaces; Kleopatra is not drawn at all and is the one real gap here
6. ~~**Didymos + Dimorphos**~~ — built, from the pre-Hera numbers. **Hera
   arrives late 2026**, and when it does, Dimorphos's shape, the crater and
   the system's mass all get replaced with measurements

Everything below that line is a point of light, and honest to draw only the way
the four new dwarf worlds were drawn: a generated surface, built from measured
albedo and colour, with the card saying so.

# Small-body surface maps

Fifteen objects — thirteen small bodies and the two moons Dactyl and
Dimorphos — drawn from published shape models but, until now, wearing nothing.
Each was a sculpted silhouette under one flat colour, so Bennu's boulder field,
Itokawa's smooth Muses Sea, 67P's neck and Arrokoth's bright collar all read as
the same grey lump.

`build-small-body-textures.py` gives each of them a surface. `reference/` holds
the photographs it was run against.

## Why this is not the dwarf-planet pipeline

`../dwarf-textures/` unwraps a photograph of a **sphere**: a distant sphere
photographs orthographically, so inverting the projection is exact for the
hemisphere facing the camera. Every trans-Neptunian dwarf is close enough to
round for that to work.

None of these are. Eros is a peanut, Itokawa is two lumps of gravel touching,
67P is a duck, Arrokoth is two pancakes welded at a collar. Inverting a sphere
projection on a photograph of a duck recovers nothing — it smears.

So these take the route that file reserves for Haumea, generalised: lift the
**material** out of the photograph and grow a world from it, then put the
large-scale features that are actually published back on top.

## Method

**Find the patch by measurement, not by eye.** Every candidate window in the
photograph is scored on three things: it must lie entirely on the body with a
margin eroded from the real silhouette rather than from a bounding box, so a
window cannot clip the limb and drag a slice of empty space in with it; its
mean brightness must be mid-range, because a window in shadow has no
recoverable detail and one near saturation has had its detail clipped away;
and among what survives, the most high-frequency variance wins. That is the
definition of the thing being harvested. Hand-picked rectangles would have been
quicker and would not have survived anyone swapping a reference image.

**Keep the surface, discard the lamp.** The patch is divided by its own
low-pass, which leaves craters, boulders and grain at a mean of one and throws
away everything broader. Both halves of that matter: the broad part is mostly
the Sun's doing rather than the surface's, and it is also the part that turns
into visible symmetry the moment a patch is repeated.

**Stamp, never tile.** Mirror-tiling prints an argyle lattice — mirrored edges
meet as chevrons and the eye assembles them within a second. The patch is
stamped down several hundred times instead, at random positions, scales,
rotations and flips, each fading out through a cosine window. Nothing recurs on
any interval, so there is no pattern to find. Two things had to be fixed before
that worked: rotating a square pads its corners, and `nearest` padding smears
the edge pixels outward into hard radial wedges, so a validity mask is rotated
with the tile and carried into the blending weight; and the stamp count is
scaled by how much ground one stamp covers, because a fixed count starves a
small patch — Ryugu's is 55 px — and leaves holes.

**Put the amplitude back.** Averaging several hundred overlapping stamps is a
low-pass: measured at a quarter of the contrast the patch went in with, which
on screen is no texture at all. The structure survives the averaging; only its
amplitude does not. So the deviations are scaled until the map matches the
contrast of the real surface it was grown from. That restores a measured
quantity rather than inventing one.

**Then the geography.** Stamping gives a plausible surface and a uniform one:
right grain everywhere, no features anywhere. The published large-scale
structure goes back on as multiplicative factors with noise-roughened edges —
an equatorial ridge, a named crater with a raised rim, a regolith pond. A pond
is not painted brighter; it is *blurred*, because what makes it a pond is that
its grain is finer than anything that formed it. Every feature has a citation
in the `BODIES` table. Nothing else is added except a few per cent of broad
tonal variation, which is invented and is kept small enough that it cannot be
mistaken for a published feature.

**Then the things that make a rock a rock.** Stamped grain plus a few per
cent of broad tone gave fifteen bodies that were all, unmistakably, the same
material — reported as "you added all common textures on these bodies which
does not makes them realistic". Correct: a surface with the right grain and no
structure at any scale above the patch is a sample swatch, not a world. So
three more layers go on, in this order:

- **Regional tone** across three octaves rather than one, so a body varies
  from place to place the way a real one does.
- **Craters**, sized on a power law of slope 2.4 — the observed production
  function (Melosh 1989); a linear distribution puts far too many large ones
  on and reads as a golf ball. Counts and size ranges are per body from the
  published surveys, so Ida is saturated, Gaspra is young, Itokawa has barely
  any and Mathilde has a handful of enormous ones.
- **Boulders** for the rubble piles, where the blocks *are* the terrain:
  Bennu, Ryugu, Itokawa, Dimorphos.

Both are baked as **albedo, never as shading**. The renderer lights these
bodies from the real Sun, so a crater with its shadow painted in would be lit
from two directions at once and would swing the wrong way as the body turned.
What is baked is what a crater does to reflectance — a floor of settled fines
that is darker, a rim of freshly turned material that is brighter — which is
the contrast every close-range image shows and is correct from any angle.

Each feature is evaluated only inside its own pixel window. Doing it over the
whole map would be 157 million distance calculations per body.

**A regolith pond keeps its grain.** Blurring one to nothing and lifting it
produced a bald grey disc, which is exactly what it was reported as. A pond of
gravel is still gravel: a third of the coarse relief stays, a finer grain goes
on top, and the outline is warped at two scales because a single low-frequency
wobble on a circle still reads as a circle.

**Poles.** `equalise_resolution` blurs along longitude by a kernel constant in
*arc*, so a feature subtends the same angle at the pole as at the equator —
without it the caps detonate into a pinwheel the moment a camera looks down on
one. `close_the_poles` then converges the last twelve degrees. That range is
much narrower than the dwarf pipeline's forty, deliberately: theirs walks each
parallel towards its mean to suppress regional colour, and this map has no
regional colour to suppress — it is a detail field whose mean is one
everywhere, so the same treatment ironed the top and bottom fifth of the first
build into flat grey lids.

## The map carries variation, not colour

Every output is grey, and that is not a limitation being apologised for.

Most of these bodies were photographed by panchromatic cameras — Bennu, Ryugu,
67P, Gaspra, Itokawa and Lutetia all arrive here with zero measured chroma.
Inventing colour from a monochrome frame would be fabrication. And the colour
that *is* known for each body already lives in the scene, in the `CHROMA` table
at the top of `smallBodyCatalogue.js`, measured per body with its own source,
alongside its measured albedo.

So the division of labour is: the catalogue owns the absolute albedo and hue,
the map owns the variation. three.js multiplies them, and because a mid-grey
map has a mean linear value near 0.22 rather than 1.0, the material's `color`
is set to `1 / meanLinear` when the map loads. The script prints that constant
for each body. Total reflected light is unchanged to within a per cent, so
adding a texture cannot quietly overwrite a measured albedo.

The one real casualty is Arrokoth, whose neck is both brighter *and* less red
than its lobes. Only the brightness survives here.

## What is a photograph and what is not

Nine of the fifteen are grown from a real spacecraft image of that body:
Bennu (OSIRIS-REx), Ryugu (Hayabusa2), Itokawa (Hayabusa), Eros (NEAR),
Gaspra and Ida (Galileo), Lutetia and 67P (Rosetta), Arrokoth (New Horizons).

Six are not, and each says why in the table:

| body | relief borrowed from | because |
| --- | --- | --- |
| Mathilde | Bennu | the supplied file is a 3D render, not a NEAR frame. Both are C-type carbonaceous, both imaged as uniformly dark |
| Didymos | Itokawa | DART imaged it, but no frame was supplied. Both S-type rubble piles spun near their shedding limit |
| Dimorphos | Itokawa | as above; DART's last frames showed loose boulders and no exposed bedrock |
| Apophis | Itokawa | **never resolved by any spacecraft.** Everything known about its shape is radar. Same Sq/S family, same elongated form |
| Halley | 67P | Giotto's 1986 flyby is the only close look, and no frame was supplied. 67P is the best-mapped cometary nucleus there is |
| Dactyl | Ida | Galileo resolved it across about 24 pixels. It is a fragment of Ida, which is the body it borrows from |

A borrowed patch is re-contrasted for the borrower — Dimorphos is rougher than
Itokawa's average ground, Halley's crust smoother than 67P's lobes — and each
borrower keeps its own measured albedo and its own documented features. The
file supplied as `99942 Apophis.jpg` is the Hayabusa image of Itokawa; it is
filed here under the body it actually shows.

## Running it

    python3 build-small-body-textures.py     # needs numpy, scipy, Pillow

Outputs 1024x512 JPEGs to `public/assets/textures/smallbodies/`. Half the
dwarf planets' resolution on purpose: these render a few tens of pixels across
at almost every distance the viewer will ever see them from, and the whole set
costs about 2.3 MB.

The run prints a `meanLinear` per body. Those numbers are pasted into
`SMALL_BODY_TEXTURES` in `src/js/scene/smallBodies/smallBodies.js` and they
must be regenerated whenever a map is rebuilt.


## The size-dependence bugs, and the lab that found them

A review split the bodies into two sets: the ones that looked right, and the
ones that "seems like we are actually copy pasting one texture to all ...
looks like mixture of black white spots". The two sets turned out to divide
almost exactly along map size, and the reason is three separate places where
this pipeline measured in **pixels** something that should have been measured
in **degrees of the body**.

`../../small-body-lab.html` is what made it visible: every body in one grid,
same size on screen, same light, turning together. Side by side the
difference was obvious in a second — the good set had fine even grain, the
bad set had soft blotches — and it is not something you can see by flying to
one body, then another, thirty seconds apart.

The three:

- **Stamp scale.** `grow_patch` scaled each stamp by a fraction of the
  *patch*, so on a 512-wide map a stamp covered 11–31% of the width against
  6–16% on a 1024-wide one. Twice the angular size. Now multiplied by
  `W / 1024`, with a per-body `grain` on top so bodies sharing an analogue
  do not come out identical.
- **`equalise_resolution`'s floor.** `max(3, …)` pixels is three times the
  angle at half size. Now derived from the angle throughout.
- **`close_the_poles`' smoothing.** A fixed seven-row Gaussian is twice the
  angle at 256 rows. Now scaled with the map height.

A fourth change is a judgement rather than a bug: **`contrastCap`**. The
target contrast is the source photograph's own, which is right in principle
and wrong for a frame shot with hard shadows — 67P's NAVCAM patch comes in at
0.47. The mesh already carries craters, boulders and relief in its vertices,
lit by the real Sun; a map that contrasty adds a second, unlit crater field
on top, and the two together read as dirt. The cap is set per body where the
source is harsh.

Lower contrast is also half the cure for the reported flicker on Apophis and
Itokawa — the two smallest and most elongated bodies, which is the exact case
where high-frequency texture aliases as a body turns. The other half is
`anisotropy: 16` in `smallBodies.js`.

## Rank 3: four Centaurs, and what the picker learned from them

Four more maps — Chariklo, Chiron, Pholus, Echeclus — at full 1024 × 512
rather than the 512 the Rank 2 worlds get, because these are destinations
rather than background and two of them can be zoomed past their own rings
down to the ground. About 700 kB on top of the set's 2.3 MB.

The borrowing is by *kind of body* rather than by spectral class, because
none of these four has ever been resolved: Chariklo takes Mathilde's settings
(and therefore Bennu's pixels, since Mathilde has no photograph here either),
Chiron takes Arrokoth's, Echeclus takes 67P's, and Pholus takes the one new
reference of this round.

**`python build-small-body-textures.py chariklo chiron` builds only those
two.** Adding four bodies used to mean rebuilding thirty-two. `SBT_OUT=<dir>`
points the output somewhere other than `public/`, which is worth using: a bad
patch pick is only obvious in the finished map.

### The Phobos frame, and two new knobs

Pholus's reference was supplied as `Pholus.jpg` and is a photograph of
**Phobos** — the Mars Express HRSC frame, scale bar and all. That is not a
problem in itself, since Pholus has never been resolved and was always going
to need a loan, but it broke `pick_patch` twice and both fixes are general.

Run plain, the picker took the highest-variance window it could find, which
was a fresh crater with a **bright ray system**, and the map came out as
bright fibrous streaks. Told to avoid that, it moved onto Phobos's
**grooves** — which are Mars's doing and cannot exist on a free-flying
Centaur. Either one, stamped six hundred times across a world, is a lie.

So a source can now ask for two things:

- `representative=True` — score windows on how ordinary they are as well as
  how detailed. Skewness of the high-frequency field prices out bright ray
  systems (the ray crater measured 1.42 against a median window's 0.42);
  coherence from its structure tensor prices out lineations.
- `window=N` — override the patch size. No 220-pixel window of Phobos is
  groove-free, because most of Phobos is grooved. At 96 the chosen patch
  comes back at coherence 0.06: even, cratered ground.

Both default off, so nothing already built and checked is silently re-picked.

The frame itself was prepared before use: cropped to the body, median-filtered
to undo JPEG ringing, and unsharpened at sub-pixel radius. Measured at matched
spatial scale that raised its high-frequency energy 5–13%, and it took the
usable fraction of the frame from 23% to 61%.

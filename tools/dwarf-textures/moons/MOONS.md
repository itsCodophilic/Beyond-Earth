# Moon surface maps

Same method as `build-dwarf-textures.py` — see `README.md` for how the
unwrapping, de-lighting and far-hemisphere reconstruction work. Only three
things differ.

**One image can hold more than one moon.** Hi'iaka and Namaka both come out of
the same comparison illustration, so a body entry can name a `source` image
separately from its own name.

**Small discs are upscaled first.** Hi'iaka is 66 pixels across in that
illustration and Namaka is 39. Projecting straight off those samples a
staircase; a Lanczos upscale before projection removes the stepping. It cannot
add detail that was never photographed, and it does not pretend to — both maps
are soft by origin, and what they carry is the character the reference actually
establishes rather than invented terrain.

**Output is 1024×512, not 2048×1024.** These are moons: they are never more than
a fraction of the frame, and the source resolution does not justify more.

## What is here

| Moon | Reference | Disc in source |
|---|---|---|
| Vanth | `vanth.png` (video still) | 202 px across, left third in terminator shadow |
| Xiangliu | `xiangliu.png` | 240 px across, fills the frame |
| Hi'iaka | `haumea_family.png` | 132 px across, inside the inset panel |
| Namaka | `haumea_family.png` | 78 px across |
| Dysnomia | `dysnomia.png` (licensed) | 1,168 px across, full disc, frontal lighting |

Dysnomia is built by `build-dysnomia-texture.py` rather than the shared script,
because its reference is large enough to earn a 2048×1024 map where the others
are held at 1024×512.

Weywot and MK 2 are deliberately absent: they have no reference and keep the
sculpted, albedo-driven treatment in `transNeptunianMoonFactory.js`.

## One thing to know about exposure

The material scales its emissive term — the stand-in for the long exposure every
real image of these bodies is — by measured albedo, which is what keeps the
*painted* moons honest against each other. Mapped moons take a flat exposure
instead: a supplied map already encodes how bright the surface looks, and
multiplying it by albedo again darkens the same fact twice. Dysnomia is the case
that proves it. At an albedo of 0.05 it came out the dimmest object in the
system and its reference was barely legible, having already been rendered dark
once by the artist.

## Running it

    python3 build-moon-textures.py     # needs numpy, scipy, Pillow

Disc geometry per moon is the `BODIES` table at the top, measured by maximising
the luminance step across the limb.

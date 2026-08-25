# Dwarf-planet surface maps

Seven worlds beyond Neptune — Orcus, Haumea, Quaoar, Makemake, Gonggong, Eris
and Sedna — have never been resolved by any telescope into more than a handful
of pixels. There is no survey map of any of them to download. Every image that
exists is a single disc, lit from one side, seen from one angle.

`build-dwarf-textures.py` turns exactly that into a seamless equirectangular
map, and `reference/` holds the photographs it was run against.

## Method

**Unwrap.** A distant sphere photographs orthographically: a surface point with
outward normal `n` lands at screen position `(n.x, n.y)`. Inverting that is
exact for the hemisphere facing the camera, so for every output pixel the script
computes the normal, projects it, and samples.

**De-light.** The photograph has the lighting baked into it, and the renderer
will light the body again. A Lambertian sphere's brightness is captured almost
perfectly by spherical harmonics through order two, so nine coefficients fitted
to the observed luminance describe the illumination without touching anything
smaller than a hemisphere: craters and albedo patches survive the division,
limb darkening and the terminator do not. The fit is on luminance alone and all
three channels are divided by that one field, so the body's real colour is
untouched.

**Invent the rest, carefully.** The far hemisphere is built from four readings
of the same photograph, peaked ninety degrees apart in longitude and warped
apart by slow noise. Reflecting longitude about the limb maps the far side's
centre onto the near side's centre, so the invented half is assembled from the
sharpest pixels rather than the blurriest, and the two seam meridians are
covered by readings that were square-on to the camera.

**Refuse bad data.** A sample is discarded if it landed past the limb (part
surface, part empty space), off the edge of the photograph, in shadow too deep
to hold albedo, or on background black. What survives thin is re-lit rather than
blurred: it keeps its own high-frequency relief and borrows hue and exposure
from the well-imaged surface around it.

**Poles.** At the poles every possible view is edge-on, so there is nothing to
recover. Above 66° the sampling latitude folds back towards the last
well-imaged parallel. That alone is not enough, because folding makes every row
above 66° a copy of the one below it — a pure radial extrusion, and radial
extrusion seen pole-on is a pinwheel. Two more passes finish the job:
`equalise_resolution` blurs along longitude by a kernel that is constant in
*arc* rather than in pixels, so a feature subtends the same angle at the pole as
at the equator; and `close_the_poles` walks the map towards the average of each
parallel on a curve that reaches unity at the pole, because a function
continuous on a sphere has to become a single value there.

Every noise field in the pipeline is sampled from a three-dimensional lattice at
the surface point itself (`sphere_noise`), not on the flat map. Flat-map noise
has longitudinal structure, and longitudinal structure at the pole is a star —
four cells across the map become a four-pointed one.

## Haumea is different

Haumea is not a sphere. It is a rugby ball 1160 km long spinning every four
hours, and the reference shows it obliquely, from behind its own ring, with two
moons crossing the frame. Inverting that projection recovers almost nothing.

What the photograph does show unambiguously is the material: bright cracked
water ice over most of the body and one large dark red region. So Haumea takes
a different route — a patch of the clean ice is lifted, high-passed down to its
cracks, and stamped across the sphere nine hundred times at random positions,
scales, rotations and flips, each stamp fading out through a cosine window.
Tiling, even mirror-tiling, prints a visible argyle lattice; random stamping
recurs on no interval at all. The dark red region is then laid back on as a band
with a noise-roughened edge.

## Running it

    python3 build-dwarf-textures.py     # needs numpy, scipy, Pillow

Outputs 2048x1024 JPEGs. Disc geometry for each body — centre, semi-axes, tilt,
and sub-observer latitude — is the `BODIES` table at the top of the script; it
was measured by maximising the luminance step across the limb.

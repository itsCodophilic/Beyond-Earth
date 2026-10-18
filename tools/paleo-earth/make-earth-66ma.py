"""
Earth 66 million years ago, for the Chicxulub space event (round 83).

The owner (Prompts.md, round 83): "during dinosaur rule the earth looked vastly
different from today ... maybe you get more realistic on NASA". The picture
they found is a screenshot of someone else's interactive globe, so it is not
used. This map is built from the site's own NASA Blue Marble Next Generation
map instead (public domain, public/textures/earth-bmng-july-4k.jpg): today's
continents are cut into their plates and each plate is turned back to roughly
where it was at the end of the Cretaceous.

What is approximate (and said on the event's card):
  * The plate outlines are coarse boxes and polygons drawn here, not real
    plate boundaries.
  * Each plate's move is one rotation -- its centre carried along a great
    circle, then a turn about that centre -- estimated by eye from published
    66 Ma reconstructions (C. R. Scotese, PALEOMAP Project, "Atlas of Earth
    History"; Seton et al. 2012, Earth-Science Reviews 113, GPlates model).
    They are good to several degrees, no better.
  * The shallow seas that covered low ground (sea level was some 100-200 m
    higher; Haq 2014, Global and Planetary Change 113) are painted where those
    reconstructions show them, not computed from elevation.
  * No ice caps: the poles were forested (Antarctica's Cretaceous forests,
    e.g. Bowman et al. 2014, Gondwana Research 26), so today's ice is
    replaced with forest and tundra colours.

Run:  python3 tools/paleo-earth/make-earth-66ma.py
Out:  public/textures/earth-66ma-2k.jpg (2048 x 1024, simple cylindrical,
      longitude -180 at the left edge like every other planet map here).
"""
import math
import os

import numpy as np
from matplotlib.path import Path
from PIL import Image
from scipy.ndimage import binary_opening, distance_transform_edt, gaussian_filter, label

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "public", "textures", "earth-bmng-july-4k.jpg")
OUT = os.path.join(ROOT, "public", "textures", "earth-66ma-2k.jpg")
W, H = 2048, 1024

# ---------------------------------------------------------------- the plates
# (lon, lat) polygons in today's positions, and each plate's move:
# centre (lon, lat) today -> centre 66 Ma, then a turn in degrees about the
# new centre (positive = anticlockwise seen from outside). Earlier entries win
# where outlines overlap. Estimated by eye (see the docstring).
BOX = lambda lo0, lo1, la0, la1: [(lo0, la0), (lo1, la0), (lo1, la1), (lo0, la1)]
PLATES = [
    # Greenland was still joined to north-west Europe (the North Atlantic
    # north of Scotland opened about 56 Ma).
    ("Greenland", BOX(-75, -10, 59, 84), (-42, 72), (-26, 64), -8),
    # India: an island continent near 20 degrees south, over the Reunion hot
    # spot, where the Deccan Traps were erupting at 66 Ma.
    ("India", [(61, 25), (67, 30), (73, 35), (78, 32), (81, 30), (88, 27.5), (92, 26.5),
               (97, 28), (95, 22), (92, 20), (82, 5), (79, 5.5), (76, 7), (72, 20)],
     (78, 20), (63, -17), -20),
    # Arabia: the Red Sea and the Gulf of Aden had not opened (about 30 Ma).
    ("Arabia", [(34.5, 29.5), (36, 32), (39, 36.5), (44, 37.5), (48, 31), (57, 26.5),
                (60, 22), (54, 13), (43.5, 12.5), (35, 28)], (46, 24), (37.5, 14.5), -9),
    ("Madagascar", BOX(42, 51, -26, -11), (46.5, -19), (41, -27), 0),
    # Australia was still joined to Antarctica (they parted about 45 Ma);
    # New Zealand is carried with it.
    ("Australia", BOX(112, 155, -45, -9) + [], (134, -25), (128, -52), 0),
    ("New Guinea", BOX(130, 151, -10.5, -0.5), (134, -25), (128, -52), 0),
    ("New Zealand", BOX(165, 179.9, -48, -34), (134, -25), (128, -52), 0),
    ("Africa", [(-20, 10), (-20, 28), (-6, 35.9), (10, 37.5), (12, 33.5), (24, 32.5),
                (32, 31.7), (34.5, 29.5), (35, 28), (43.5, 12.5), (51.5, 12), (52, -15),
                (40, -36), (17, -36), (10, -20)], (20, 5), (14, -3), 0),
    # The South Atlantic was about two thirds of its width; it opened from
    # the south, so closing it turns South America's southern end east.
    ("South America", BOX(-82, -34, -56, 13), (-58, -15), (-52, -21), 6),
    # The North Atlantic was narrower; North America lay nearer Europe.
    ("North America", BOX(-170, -52, 7, 84), (-100, 45), (-87, 46), -5),
    ("Antarctica", BOX(-180, 180, -90, -60), (0, -90), (0, -90), 0),
    # Everything else: Eurasia, about eight degrees further south.
    ("Eurasia", None, (60, 50), (57, 42), 6),
]

# Shallow seas over today's land, in today's positions (they move with their
# plate). From the same reconstructions; outlines simplified.
SEAS = [
    # The last of the Western Interior Seaway (the Cannonball Sea, Dakotas).
    [(-104, 44), (-96, 44), (-95, 49), (-99, 53), (-104, 51)],
    # The Gulf coastal plain and the Mississippi embayment.
    [(-99, 28), (-84, 29), (-86, 33), (-89, 37), (-92, 35), (-97, 31)],
    # Northern Yucatan: a shallow carbonate shelf where the asteroid struck
    # (Hildebrand et al. 1991, Geology 19).
    [(-92.5, 19.4), (-86.4, 19.4), (-86.4, 21.9), (-92.5, 21.9)],
    # The Trans-Saharan Seaway.
    [(0, 16), (5, 12), (10, 13), (14, 19), (14.5, 28), (10, 31), (5, 25)],
    # Europe's shelf seas: the Paris Basin to the Russian platform.
    [(-1.5, 46), (8, 47.5), (20, 46), (32, 45), (48, 48), (50, 56), (32, 58), (20, 56.5),
     (8, 56), (3, 54.5), (-1.5, 50)],
    # The West Siberian Sea and the Turgai Strait.
    [(60, 42), (70, 44), (72, 52), (86, 56), (88, 68), (72, 70), (62, 64), (60, 52)],
]


def unit(lon, lat):
    lo, la = np.radians(lon), np.radians(lat)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)


def axis_angle(axis, ang):
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s = math.cos(ang), math.sin(ang)
    C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def plate_rotation(c0, c1, turn):
    a, b = unit(*c0), unit(*c1)
    ax = np.cross(a, b)
    if np.linalg.norm(ax) < 1e-9:
        R1 = np.eye(3)
    else:
        R1 = axis_angle(ax, math.acos(np.clip(np.dot(a, b), -1, 1)))
    R2 = axis_angle(b, math.radians(turn))
    return R2 @ R1


def main():
    src = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
    SH, SW = src.shape[:2]
    # Land: anything not the map's dark ocean blue.
    bright = src.max(axis=2)
    land_src = (bright > 52) | ((src[..., 0] + src[..., 1]) > src[..., 2] * 1.8 + 30)
    # Drop specks: JPEG noise and reef flecks in open ocean (islands under
    # about 40 pixels of the 4k map, ~300 km across, go too; drawing choice).
    land_src = binary_opening(land_src, iterations=1)
    lab, n = label(land_src)
    sizes = np.bincount(lab.ravel())
    land_src = sizes[lab] >= 40
    land_src[lab == 0] = False

    lon = (np.arange(W) + 0.5) / W * 360 - 180
    lat = 90 - (np.arange(H) + 0.5) / H * 180
    LON, LAT = np.meshgrid(lon, lat)
    V = unit(LON, LAT)

    paths = {name: Path(poly) for name, poly, *_ in PLATES if poly}
    sea_paths = [Path(p) for p in SEAS]
    names = [p[0] for p in PLATES]

    out = np.zeros((H, W, 3), np.float32)
    filled = np.zeros((H, W), bool)
    is_sea = np.zeros((H, W), bool)
    was_ice = np.zeros((H, W), bool)
    for i, (name, poly, c0, c1, turn) in enumerate(PLATES):
        R = plate_rotation(c0, c1, turn)
        P = V @ R  # R^T v: where each output point is today
        plat = np.degrees(np.arcsin(np.clip(P[..., 2], -1, 1)))
        plon = np.degrees(np.arctan2(P[..., 1], P[..., 0]))
        pts = np.stack([plon.ravel(), plat.ravel()], axis=1)
        inside = paths[name].contains_points(pts) if poly else np.ones(len(pts), bool)
        for other in names[:i] if poly else [n for n in names if n != name]:
            if other in paths:
                inside &= ~paths[other].contains_points(pts)
        inside = inside.reshape(H, W)
        sx = np.clip(((plon + 180) / 360 * SW).astype(int), 0, SW - 1)
        sy = np.clip(((90 - plat) / 180 * SH).astype(int), 0, SH - 1)
        land = land_src[sy, sx] & inside & ~filled
        out[land] = src[sy, sx][land]
        filled |= land
        sea = np.zeros(len(pts), bool)
        for sp in sea_paths:
            sea |= sp.contains_points(pts)
        is_sea |= land & sea.reshape(H, W)
        c = src[sy, sx]
        ice = (c.min(axis=2) > 150) & ((c.max(axis=2) - c.min(axis=2)) < 40)
        was_ice |= land & ice

    rng = np.random.default_rng(66)
    noise = gaussian_filter(rng.random((H, W)), 3) * 2 - 1
    # No ice: forest near the coasts, browner tundra inland (drawing choice
    # for colours; the forests themselves are in the fossil record).
    coast = distance_transform_edt(filled)
    forest = np.array([34, 64, 30], np.float32)
    tundra = np.array([78, 84, 52], np.float32)
    k = np.clip(coast / 60.0 + noise[..., None][..., 0] * 0.3, 0, 1)[..., None]
    ice_col = forest * (1 - k) + tundra * k
    out[was_ice] = ice_col[was_ice]

    # Oceans: the map's deep blue, lighter over the continental shelves.
    deep = np.array([3, 8, 26], np.float32)
    shelf = np.array([24, 84, 112], np.float32)
    shallow = np.array([32, 104, 124], np.float32)
    ocean = ~filled
    dist = distance_transform_edt(ocean)
    t = np.clip(1 - dist / 9.0, 0, 1) ** 1.5
    oc = deep * (1 - t[..., None]) + shelf * t[..., None]
    out[ocean] = oc[ocean]
    # Epicontinental seas: shallow, turquoise, with a little texture.
    sea_col = shallow * (1 + 0.12 * noise[..., None])
    # Ragged, soft shores: the outline blurred and broken up with noise
    # (drawing choice; the real shorelines are not known this finely).
    big = gaussian_filter(rng.random((H, W)), 9)
    big = (big - big.mean()) / (big.std() + 1e-6)
    m = gaussian_filter(is_sea.astype(np.float32), 7) * (1 + 0.35 * big) + 0.03 * noise
    w = np.clip((m - 0.32) / 0.22, 0, 1)
    w = w * w * (3 - 2 * w) * 0.82 * filled
    w = w[..., None]
    out = out * (1 - w) + sea_col * w

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT, quality=88)
    print("wrote", OUT)


if __name__ == "__main__":
    main()

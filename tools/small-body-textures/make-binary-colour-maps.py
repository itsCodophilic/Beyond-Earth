"""
Colour maps for the Rank 4 batch B binaries -- second design, one surface each.

The first pass painted eight of the eleven from one tholin palette whose only
input was the measured B-R. Their B-R values are 1.64 to 1.74, so the eight
came out as the same brown with different noise, and Hiisi and Paha were
Lempo's map turned and mirrored. Reported: "all five look the same, and both
partners look the same".

So each body now has its own recipe: a three-colour ramp in its own red, and
its own terrain, built on the sphere (every feature is placed and sized by
angle on the unit sphere, so nothing stretches towards the poles):

  Lempo           the supplied reference image's colour field (unwrapped by
                  tools/dwarf-textures, entry "lempo"), crimson, with a dense
                  crater field laid over it at full resolution
  Hiisi           scarlet-orange; one giant basin, long bright ridges
  Paha            Lempo's crimson (asked for: "Paha the same colour"), but a
                  densely pitted small rubble pile
  Sila            brick terracotta; smooth mottled plains, few craters, a
                  darker hemisphere (the face it keeps turned to Nunam)
  Nunam           rose-salmon; bright icy ray craters on a pinker plain
  Teharonhiawako  dark reddish-brown "dirty snowball"; craters, long
                  fractures, pale ice flecks
  Sawiskera       chocolate-maroon; saturated overlapping craters and gouges,
                  the more battered of the two
  Altjira         oxblood burgundy; a porous rubble pile of large boulders
  Altjira I       garnet, with smaller cinnamon boulders and two big craters
  Manwe           copper-cinnamon; bright frost in crater floors, fractures
                  round the neck (the mesh's plane x = 0, lon +-90 here)
  Thorondor       rust-orange; an angular fragment of flat facets with fresh
                  bright scarps

What is measured: all eleven are red to very red (B-R 1.64-1.74; Lempo system
B-V 1.03, V-R 0.69), and their ordering by redness. What is not: every
feature. No spacecraft has seen any of them; the terrains are what their
sizes, densities and histories make plausible (cold classical binaries are
primordial, unshocked, with possible fresh-ice exposures; Altjira's density
is about 0.3 g/cm3, a rubble pile; Manwe is a contact binary). The ramps are
by eye, chosen so the eleven read apart under the scene's ACES tone mapping.

Run in a Python with numpy, scipy and Pillow:
  python make-binary-colour-maps.py <lempo colour map> <out folder>
It prints the meanLinear lines for SMALL_BODY_TEXTURES.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

LEMPO = sys.argv[1]
OUT = sys.argv[2]

FROST = np.array([0.84, 0.78, 0.76])   # pale, faintly pink: ice dusted with tholin


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def sphere(w, h):
    lon = (np.arange(w) + 0.5) / w * 2 * np.pi - np.pi
    lat = np.pi / 2 - (np.arange(h) + 0.5) / h * np.pi
    lon, lat = np.meshgrid(lon, lat)
    return np.stack([np.cos(lat) * np.cos(lon), np.sin(lat), -np.cos(lat) * np.sin(lon)], axis=-1), lon, lat


def rand_dirs(rng, n):
    v = rng.standard_normal((n, 3))
    return v / np.linalg.norm(v, axis=1, keepdims=True)


# ---------------------------------------------------------------- noise

def value_noise(P, freq, seed):
    """3D value noise sampled on the sphere's points, 0..1."""
    rng = np.random.default_rng(seed)
    table = rng.random(4096)
    X = P * freq + 97.0
    i = np.floor(X).astype(np.int64)
    f = X - i
    f = f * f * (3 - 2 * f)

    def lat(ix, iy, iz):
        return table[(ix * 73856093 ^ iy * 19349663 ^ iz * 83492791) % 4096]

    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                wgt = (f[..., 0] if dx else 1 - f[..., 0]) * (f[..., 1] if dy else 1 - f[..., 1]) * (f[..., 2] if dz else 1 - f[..., 2])
                out = out + wgt * lat(i[..., 0] + dx, i[..., 1] + dy, i[..., 2] + dz)
    return out


def fbm(P, freq, octaves, seed, gain=0.5):
    total = 0
    amp = 1
    norm = 0
    for o in range(octaves):
        total = total + amp * value_noise(P, freq * 2 ** o, seed + o * 31)
        norm += amp
        amp *= gain
    return total / norm


def ridged(P, freq, octaves, seed):
    n = fbm(P, freq, octaves, seed)
    return 1 - np.abs(2 * n - 1)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- features

def craters(P, rng, count, rmin, rmax, depth=1.0, slope=2.2, fresh=0.0):
    """Bowls with raised rims. Radii in radians, power-law sizes.
    Returns (height, floor mask, ejecta brightness)."""
    height = np.zeros(P.shape[:2])
    floor = np.zeros(P.shape[:2])
    ejecta = np.zeros(P.shape[:2])
    centres = rand_dirs(rng, count)
    u = rng.random(count)
    a = rmin ** (1 - slope)
    b = rmax ** (1 - slope)
    radii = (a + u * (b - a)) ** (1 / (1 - slope))
    # Older craters are shallower and softer-rimmed: space weathering and
    # later impacts wear them down, so no two look stamped from one die.
    wear = 0.35 + 0.65 * rng.random(count)
    for c, R, age in zip(centres, radii, wear):
        cosd = P @ c
        near = cosd > np.cos(R * 3.2)
        if not near.any():
            continue
        d = np.arccos(np.clip(cosd[near], -1, 1)) / R
        bowl = np.where(d < 1, (d ** 2 - 1), 0) * depth * R * age
        rim = np.exp(-((d - 1.0) / (0.22 + 0.2 * (1 - age))) ** 2) * 0.3 * depth * R * age
        height[near] += bowl + rim
        floor[near] = np.maximum(floor[near], np.where(d < 0.7, 1 - d / 0.7, 0) * min(1, R / rmax * 3))
        if fresh and rng.random() < fresh:
            ejecta[near] = np.maximum(ejecta[near], np.where((d > 0.9) & (d < 2.6), np.exp(-(d - 1.0) * 1.3), 0))
    return height, floor, ejecta


def rays(P, rng, count, R, length):
    """Bright ray systems: thin streaks radiating from young craters."""
    out = np.zeros(P.shape[:2])
    for c in rand_dirs(rng, count):
        cosd = P @ c
        near = cosd > np.cos(length)
        d = np.arccos(np.clip(cosd[near], -1, 1))
        # Angle round the crater, from a local frame.
        t1 = np.cross(c, [0, 1, 0.3])
        t1 /= np.linalg.norm(t1)
        t2 = np.cross(c, t1)
        pn = P[near]
        ang = np.arctan2(pn @ t2, pn @ t1)
        spokes = np.zeros_like(ang)
        for k in range(rng.integers(7, 13)):
            a0 = rng.uniform(-np.pi, np.pi)
            wid = rng.uniform(0.04, 0.1)
            spokes = np.maximum(spokes, np.exp(-(((ang - a0 + np.pi) % (2 * np.pi) - np.pi) / wid) ** 2))
        fade = np.clip(1 - d / length, 0, 1) ** 1.4 * (d > R)
        out[near] = np.maximum(out[near], spokes * fade + np.exp(-((d - R) / (R * 0.5)) ** 2) * 0.6)
    return out


def voronoi(P, rng, n):
    """Cells on the sphere: (cell id, angular gap to the next cell's edge)."""
    pts = rand_dirs(rng, n)
    dist, idx = cKDTree(pts).query(P.reshape(-1, 3), k=2)
    # Chord to angle: the gap between the nearest and second-nearest centre.
    a = 2 * np.arcsin(np.clip(dist / 2, 0, 1))
    gap = (a[:, 1] - a[:, 0]).reshape(P.shape[:2])
    return idx[:, 0].reshape(P.shape[:2]), gap


def fractures(P, rng, count, width, extent, around=None):
    """Grooves along great-circle segments. `around` restricts centres to
    near a given direction (Manwe's neck)."""
    out = np.zeros(P.shape[:2])
    for _ in range(count):
        if around is None:
            c = rand_dirs(rng, 1)[0]
        else:
            c = around + rng.normal(0, 0.18, 3)
            c /= np.linalg.norm(c)
        n = np.cross(c, rand_dirs(rng, 1)[0])
        n /= np.linalg.norm(n)
        L = rng.uniform(extent * 0.5, extent)
        wob = value_noise(P, 9, int(rng.integers(1e6))) - 0.5
        wid = width * rng.uniform(0.6, 1.5)
        off = np.abs(P @ n + wob * wid * 1.6)
        along = np.arccos(np.clip(P @ c, -1, 1))
        out = np.maximum(out, np.exp(-(off / wid) ** 2) * smoothstep(L, L * 0.6, along)
                         * (0.55 + 0.45 * rng.random()))
    return out


def cavity(height):
    """Non-directional relief: pits dark, rims and ridges light, at two
    scales -- a crisp one for rims and a broad one that reads as shading in
    the bowls. Longitude wraps."""
    out = 0
    for sigma, weight in ((1.3, 0.55), (4.0, 0.45)):
        hs = ndimage.gaussian_filter(height, sigma, mode=("nearest", "wrap"))
        lap = (np.roll(hs, 1, 1) + np.roll(hs, -1, 1) - 2 * hs)
        up = np.vstack([hs[:1], hs[:-1]])
        dn = np.vstack([hs[1:], hs[-1:]])
        lap = lap + up + dn - 2 * hs
        s = np.std(lap) + 1e-9
        out = out + weight * np.clip(-lap / (2.5 * s), -1, 1)
    return out


def ramp(t, dark, mid, light):
    t = np.clip(t, 0, 1)[..., None]
    dark, mid, light = (np.array(x)[None, None] for x in (dark, mid, light))
    lo = dark + (mid - dark) * np.clip(t * 2, 0, 1)
    return np.where(t < 0.5, lo, mid + (light - mid) * np.clip(t * 2 - 1, 0, 1))


def save(name, rgb):
    path = f"{OUT}/{name}.jpg"
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(path, quality=90, optimize=True)
    s = np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255
    ml = float((srgb_to_linear(s) @ [0.2126, 0.7152, 0.0722]).mean())
    print(f"  {name}: meanLinear {ml:.4f}")


# ---------------------------------------------------------------- one recipe

def paint(name, size, seed, dark, mid, light, *,
          mottle=(3.0, 5), mottle_amp=0.5, crater=(0, 0.01, 0.1), fresh=0.0,
          frost=0.0, rubble=0, rubble_amp=0.0, facets=0, fracture=(0, 0.01, 1.0),
          neck=False, ray=(0, 0.05, 0.5), ridges=0.0, hemisphere=0.0,
          basin=None, flecks=0.0, base_field=None, relief_amp=0.55):
    w, h = size
    P, lon, lat = sphere(w, h)
    rng = np.random.default_rng(seed)

    # Tone: broad mottling in the body's own ramp.
    t = fbm(P, mottle[0], mottle[1], seed) * mottle_amp + (0.5 - mottle_amp / 2)
    if hemisphere:
        t = t - hemisphere * smoothstep(-0.2, 0.6, P[..., 0])
    height = (fbm(P, 6, 4, seed + 7) - 0.5) * 0.02

    if basin is not None:
        c = np.array(basin[0], dtype=float)
        c /= np.linalg.norm(c)
        d = np.arccos(np.clip(P @ c, -1, 1)) / basin[1]
        height += np.where(d < 1, d ** 2 - 1, 0) * 0.08 + np.exp(-((d - 1) / 0.12) ** 2) * 0.03
        t = t - np.where(d < 0.85, 0.12 * (1 - d / 0.85), 0) + np.exp(-((d - 1) / 0.1) ** 2) * 0.12

    if ridges:
        r = ridged(P, 3.5, 4, seed + 13)
        lines = smoothstep(0.9, 0.99, r)
        height += lines * 0.01
        t = t + lines * ridges

    cells_tone = np.zeros(P.shape[:2])
    if rubble:
        ids, gap = voronoi(P, rng, rubble)
        jitter = rng.random(rubble)[ids] - 0.5
        # Joints between boulders, uneven: wide in places, closed in others.
        width = (0.5 + fbm(P, 12, 2, int(rng.integers(1e6)))) * 0.6 / np.sqrt(rubble)
        edge = np.exp(-(gap / width) ** 2) * (0.45 + 0.55 * fbm(P, 20, 2, int(rng.integers(1e6))))
        # Each boulder rounded: lighter towards its middle.
        dome = smoothstep(0.0, 3.0 * width, gap)
        cells_tone = jitter * rubble_amp - edge * rubble_amp * 0.9 + dome * rubble_amp * 0.35
        height += -edge * 0.012 + jitter * 0.004
    if facets:
        ids, gap = voronoi(P, rng, facets)
        shade = rng.random(facets)[ids] - 0.5
        edge = np.exp(-(gap / 0.012) ** 2) * (0.4 + 0.6 * fbm(P, 16, 2, int(rng.integers(1e6))))
        cells_tone = cells_tone + shade * 0.34 + edge * 0.22
        height += shade * 0.02

    n, rmin, rmax = crater
    floor = np.zeros(P.shape[:2])
    ejecta = np.zeros(P.shape[:2])
    if n:
        hc, floor, ejecta = craters(P, rng, n, rmin, rmax, fresh=fresh)
        height += hc

    cracks = np.zeros(P.shape[:2])
    if fracture[0]:
        cracks = fractures(P, rng, fracture[0], fracture[1], fracture[2])
    if neck:
        for side in (np.array([0, 0, -1.0]), np.array([0, 0, 1.0])):
            cracks = np.maximum(cracks, fractures(P, rng, 5, 0.012, 0.55, around=side))
    height -= cracks * 0.02

    rel = cavity(height)
    # Regolith grain at two scales, so no surface reads as a clean drawing.
    grain = (value_noise(P, 70, seed + 50) - 0.5) * 0.10 + (value_noise(P, 190, seed + 51) - 0.5) * 0.08
    tone = (t + cells_tone * 0.5 + rel * relief_amp * 0.45 + ejecta * 0.22
            - cracks * 0.28 + grain)
    rgb = ramp(tone, dark, mid, light)
    if base_field is not None:
        # The reference image carries the colour; the terrain modulates it.
        lum = rgb.mean(axis=2, keepdims=True)
        rgb = base_field * (lum / lum.mean()) ** 1.1

    if ray[0]:
        rr = rays(P, rng, ray[0], ray[1], ray[2])
        rr = ndimage.gaussian_filter(rr, 1.2, mode=("nearest", "wrap"))
        rgb = rgb + (np.array(light)[None, None] * 1.1 - rgb) * (rr[..., None] * 0.45)
    if frost:
        patch = fbm(P, 10, 3, seed + 4) > 0.52
        fm = ndimage.gaussian_filter((floor > 0.25).astype(float) * patch, 1.0)
        fm = np.clip(fm * 1.3, 0, 1) * frost * (0.6 + 0.4 * fbm(P, 30, 2, seed + 5))
        rgb = rgb * (1 - fm[..., None]) + FROST[None, None] * fm[..., None]
    if flecks:
        speck = value_noise(P, 140, seed + 40)
        fl = smoothstep(0.86, 0.95, speck) * flecks
        rgb = rgb * (1 - fl[..., None]) + FROST[None, None] * 0.8 * fl[..., None]
    save(name, rgb)


def lempo_field(size):
    src = Image.open(LEMPO).convert("RGB").resize(size, Image.LANCZOS)
    c = np.asarray(src).astype(np.float64) / 255
    c = ndimage.gaussian_filter(c, (size[1] / 120, size[1] / 120, 0))
    return c / c.mean(axis=(0, 1), keepdims=True).mean() * 0.42


print("meanLinear per map:")
BIG, SMALL = (1024, 512), (512, 256)

# Lempo: the supplied image's crimson, cratered hard.
paint("lempo", BIG, 101, (0.25, 0.03, 0.04), (0.66, 0.10, 0.10), (0.92, 0.36, 0.28),
      crater=(420, 0.012, 0.22), fresh=0.15, rubble=300, rubble_amp=0.25,
      base_field=lempo_field(BIG))
# Hiisi: scarlet-orange, one giant basin, bright ridges.
paint("hiisi", BIG, 202, (0.30, 0.07, 0.03), (0.80, 0.27, 0.09), (0.98, 0.62, 0.34),
      mottle=(2.2, 5), crater=(170, 0.012, 0.16), basin=((0.3, 0.2, 1.0), 0.62),
      ridges=0.16, fresh=0.25)
# Paha: Lempo's crimson, a small pitted rubble pile.
paint("paha", SMALL, 303, (0.22, 0.02, 0.04), (0.64, 0.09, 0.11), (0.90, 0.34, 0.30),
      crater=(520, 0.02, 0.12), rubble=160, rubble_amp=0.55, relief_amp=0.7)
# Sila: brick terracotta, smooth plains, a darker face towards Nunam.
paint("sila", BIG, 404, (0.30, 0.11, 0.06), (0.68, 0.31, 0.16), (0.88, 0.58, 0.40),
      mottle=(1.8, 5), mottle_amp=0.75, crater=(60, 0.015, 0.12), hemisphere=0.22)
# Nunam: rose-salmon, bright ray craters.
paint("nunam", BIG, 505, (0.34, 0.09, 0.10), (0.76, 0.33, 0.31), (0.96, 0.70, 0.64),
      mottle=(2.6, 5), crater=(140, 0.012, 0.13), ray=(4, 0.05, 0.75), frost=0.35)
# Teharonhiawako: dark reddish-brown dirty snowball, fractures, ice flecks.
paint("teharonhiawako", BIG, 606, (0.12, 0.05, 0.035), (0.40, 0.17, 0.10), (0.66, 0.40, 0.29),
      crater=(260, 0.012, 0.2), fracture=(9, 0.009, 1.3), flecks=0.55)
# Sawiskera: chocolate-maroon, saturated craters and gouges.
paint("sawiskera", SMALL, 707, (0.11, 0.035, 0.04), (0.36, 0.11, 0.10), (0.60, 0.30, 0.26),
      crater=(380, 0.03, 0.34), fracture=(6, 0.02, 1.0), relief_amp=0.8, fresh=0.1)
# Altjira: oxblood burgundy boulders.
paint("altjira", BIG, 808, (0.12, 0.02, 0.04), (0.44, 0.07, 0.12), (0.68, 0.24, 0.27),
      crater=(90, 0.015, 0.14), rubble=520, rubble_amp=0.75, relief_amp=0.6)
# Altjira I: garnet with cinnamon boulders and two big craters.
paint("altjira-moon", BIG, 909, (0.16, 0.04, 0.04), (0.54, 0.16, 0.12), (0.78, 0.42, 0.30),
      crater=(40, 0.02, 0.36), rubble=1100, rubble_amp=0.5, relief_amp=0.6)
# Manwe: copper-cinnamon, frost in crater floors, cracks round the neck.
paint("manwe", BIG, 1010, (0.22, 0.08, 0.035), (0.64, 0.27, 0.10), (0.88, 0.55, 0.32),
      crater=(240, 0.012, 0.16), frost=0.85, neck=True)
# Thorondor: rust-orange facets with fresh scarps.
paint("thorondor", SMALL, 1111, (0.26, 0.10, 0.04), (0.72, 0.35, 0.14), (0.94, 0.68, 0.46),
      crater=(90, 0.02, 0.12), facets=46, relief_amp=0.4)

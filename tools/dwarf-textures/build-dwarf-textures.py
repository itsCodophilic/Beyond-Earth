"""
Turn one reference photograph of a dwarf planet into a seamless equirectangular
surface map.

A distant sphere photographs orthographically: a surface point whose outward
normal is n lands at screen position (n.x, n.y).  Inverting that is exact for
the half facing the camera, so almost everything here is about the two things
inversion cannot give you -- the lighting baked into the photograph, and the
half of the world that was pointing away.
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

# cx, cy: disc centre, in pixels.  A, B: semi-axes (equal unless the body is a
# visibly triaxial ellipsoid).  ang: tilt of the long axis in image space.
# sub: latitude of the sub-observer point -- how far the visible pole is tipped
# towards the camera.
BODIES = {
    # The Ceres reference runs off the bottom of its frame, so the southern
    # cap has to be folded much harder -- there is simply no photograph there.
    "eris":     dict(cx=660.0, cy=398.0, A=392.0, B=392.0, ang=0.0,  sub=0.0,
                     cap_s=34.0),
    "gonggong": dict(cx=444.6, cy=345.9, A=265.9, B=265.9, ang=0.0,  sub=14.0),
    # Sedna is lit from the upper left with a deep blue-black shadow across the
    # whole right third; that shadow carries no albedo information at all.
    "sedna":    dict(cx=480.2, cy=196.5, A=174.8, B=174.8, ang=0.0,  sub=0.0,
                     lit=(0.30, 0.60), dark=(0.09, 0.20)),
    "makemake": dict(cx=482.2, cy=183.3, A=167.0, B=167.0, ang=0.0,  sub=0.0),
    "orcus":    dict(cx=281.5, cy=234.1, A=204.0, B=204.0, ang=0.0,  sub=0.0),
    "quaoar":   dict(cx=874.8, cy=730.6, A=147.1, B=147.1, ang=0.0,  sub=0.0),
    # Haumea gets its own route.  It is not a sphere -- it is a rugby ball
    # spinning every four hours -- and the reference shows it obliquely, from
    # behind its own ring, with two moons crossing the frame.  Inverting that
    # projection recovers almost nothing.  What the photograph does show
    # unambiguously is the material: bright cracked water ice over most of the
    # body, and one large dark red region.  So the ice is lifted as a patch and
    # grown across the whole sphere, and the red region is laid back on top.
    "haumea":   dict(ice=(235, 258, 392, 338),
                     ice_colour=(0.88, 0.83, 0.79),
                     red_cap=dict(edge=11.0, softness=13.0, rough=34.0,
                                  colour=(0.42, 0.105, 0.125), strength=0.85)),
}

W, H = 2048, 1024
LAT = np.linspace(90, -90, H)[:, None] * np.ones((1, W))
LON = np.linspace(-180, 180, W, endpoint=False)[None, :] * np.ones((H, 1))

# Above this latitude a point is so close to the limb in every possible view
# that the photograph holds nothing usable.  Sampling is folded back towards
# the last well-imaged parallel instead, which is also what a real
# equirectangular map does at the poles: stretch one band of surface out across
# the cap.
CAP_LAT = 66.0
CAP_SQUASH = 0.24


def bilinear(img, X, Y):
    h, w, _ = img.shape
    x0 = np.floor(X).astype(np.int32); y0 = np.floor(Y).astype(np.int32)
    fx = (X - x0)[..., None]; fy = (Y - y0)[..., None]
    xa = np.clip(x0, 0, w - 1); xb = np.clip(x0 + 1, 0, w - 1)
    ya = np.clip(y0, 0, h - 1); yb = np.clip(y0 + 1, 0, h - 1)
    top = img[ya, xa] * (1 - fx) + img[ya, xb] * fx
    bot = img[yb, xa] * (1 - fx) + img[yb, xb] * fx
    return top * (1 - fy) + bot * fy


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def fold_caps(lat, p):
    north = p.get("cap_n", CAP_LAT)
    south = p.get("cap_s", CAP_LAT)
    limit = np.where(lat >= 0, north, south)
    over = np.abs(lat) - limit
    return np.where(over > 0, np.sign(lat) * (limit + over * CAP_SQUASH), lat)


def project(img, p, lat, lon):
    """Surface point -> pixel.  Also reports how square-on the point was, its
    view-space normal, how far out towards the limb it landed, and whether it
    landed on the photograph at all."""
    phi = np.radians(p["sub"])
    la, lo = np.radians(lat), np.radians(lon)
    nx = np.cos(la) * np.sin(lo)
    ny = np.sin(la)
    nz = np.cos(la) * np.cos(lo)
    sx = nx
    sy = ny * np.cos(phi) - nz * np.sin(phi)
    sz = ny * np.sin(phi) + nz * np.cos(phi)
    a = np.radians(p["ang"])
    u = sx * p["A"]; v = -sy * p["B"]
    X = p["cx"] + u * np.cos(a) - v * np.sin(a)
    Y = p["cy"] + u * np.sin(a) + v * np.cos(a)
    h, w, _ = img.shape
    inframe = ((X > 7) & (X < w - 8) & (Y > 7) & (Y < h - 8)).astype(np.float64)
    return (bilinear(img, X, Y), sz, np.stack([sx, sy, sz], axis=-1),
            np.sqrt(sx * sx + sy * sy), inframe)


def sh_basis(view):
    x, y, z = view[..., 0], view[..., 1], view[..., 2]
    return np.stack([np.ones_like(x), x, y, z, x * y, x * z, y * z,
                     x * x - y * y, 3 * z * z - 1], axis=-1)


def fit_illumination(img, p):
    """
    Recover the lighting the photographer could not avoid.

    A Lambertian sphere's brightness is described almost exactly by spherical
    harmonics through order two, so nine coefficients fitted to the observed
    luminance capture the illumination without touching anything smaller than a
    hemisphere: craters and albedo patches survive, limb darkening and the
    terminator do not.  The fit is on luminance alone, and dividing all three
    channels by that single field leaves the body's real colour untouched.
    """
    near, depth, view, rad, inframe = project(img, p, LAT, LON)
    basis = sh_basis(view)
    lum = 0.299 * near[..., 0] + 0.587 * near[..., 1] + 0.114 * near[..., 2]
    w = (np.clip(depth, 0, 1) ** 1.5) * inframe * (rad < 0.94)
    m = w > 0.02
    coef, *_ = np.linalg.lstsq(basis[m] * w[m][:, None], lum[m] * w[m], rcond=None)
    ref = np.average(basis[m] @ coef, weights=w[m])
    return coef / (ref if abs(ref) > 1e-4 else 1.0)


def reading(img, p, coef, shift, seed, mirror, flip, gain):
    """
    One reading of the surface, taken from whichever part of the photograph was
    pointing most directly at the camera for these longitudes.

    Four readings are combined, peaked ninety degrees apart, so every meridian --
    including the two that sat exactly on the limb -- is built from pixels that
    were near the middle of the disc rather than smeared along its edge.
    """
    lat_s = fold_caps(np.clip(LAT * flip + snoise(2.1, seed) * 25.0, -89.9, 89.9), p)
    base = (180.0 - LON) if mirror else LON
    lon_s = ((base + shift + snoise(2.1, seed + 7) * 42.0 + 180) % 360) - 180
    rgb, depth, view, rad, inframe = project(img, p, lat_s, lon_s)
    shade = np.clip(sh_basis(view) @ coef, 0.28, 3.0)
    albedo = rgb / shade[..., None]
    # Discard anything on or past the limb: those pixels are a mixture of
    # surface and background, and the background is empty space.
    inside = 1.0 - smoothstep(0.84, 0.955, rad)
    lo, hi = p.get("lit", (0.26, 0.58))
    lit = smoothstep(lo, hi, shade)
    # Empty space is not a surface.  Wherever the sample came back essentially
    # black it is either background bleeding past the limb or a shadow too deep
    # to hold any recoverable detail, and either way it is worse than nothing.
    d0, d1 = p.get("dark", (0.05, 0.15))
    body = smoothstep(d0, d1, rgb.max(axis=-1))
    return albedo, (np.clip(depth, 0, 1) ** 1.1) * lit * inside * inframe * body * gain + 1e-4


def grow_patch(patch, count=900, seed=5):
    """
    Grow one small square of real surface into a whole world.

    Tiling -- even mirror-tiling -- prints a lattice: mirrored cracks meet as
    chevrons and the eye assembles them into argyle within a second.  So the
    patch is not tiled at all.  It is stamped down nine hundred times at random
    positions, scales, rotations and flips, each stamp fading out through a
    cosine window and the overlaps averaged.  Nothing recurs on any interval, so
    there is no pattern to find.
    """
    rng = np.random.default_rng(seed)
    total = np.zeros((H, W)); weight = np.zeros((H, W))
    ph, pw = patch.shape
    wy = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(ph) + 0.5) / ph)
    wx = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(pw) + 0.5) / pw)
    window = np.outer(wy, wx) + 1e-3
    for _ in range(count):
        tile = patch
        if rng.random() < 0.5: tile = tile[:, ::-1]
        if rng.random() < 0.5: tile = tile[::-1, :]
        if rng.random() < 0.5: tile = tile.T
        tile = ndimage.rotate(tile, rng.uniform(0, 360), reshape=True,
                              order=1, mode="nearest")
        scale = rng.uniform(0.55, 1.35)
        th, tw = max(8, int(tile.shape[0] * scale)), max(8, int(tile.shape[1] * scale))
        tile = np.asarray(Image.fromarray((np.clip(tile, 0, 2) * 127).astype(np.uint8))
                          .resize((tw, th), Image.BILINEAR)).astype(np.float64) / 127
        wyt = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(th) + 0.5) / th)
        wxt = 0.5 - 0.5 * np.cos(2 * np.pi * (np.arange(tw) + 0.5) / tw)
        win = np.outer(wyt, wxt) + 1e-3
        y0 = int(rng.integers(-th, H)); x0 = int(rng.integers(0, W))
        ys = np.arange(y0, y0 + th)
        keep = (ys >= 0) & (ys < H)
        if not keep.any():
            continue
        xs = (np.arange(x0, x0 + tw) % W)          # longitude wraps
        sub = np.ix_(ys[keep], xs)
        total[sub] += tile[keep] * win[keep]
        weight[sub] += win[keep]
    return total / np.maximum(weight, 1e-6)


def build_from_patch(name, p):
    img = np.asarray(Image.open(f"reference/{name}.png").convert("RGB")).astype(np.float32) / 255
    x0, y0, x1, y1 = p["ice"]
    crop = img[y0:y1, x0:x1]
    lum = 0.299 * crop[..., 0] + 0.587 * crop[..., 1] + 0.114 * crop[..., 2]
    # Keep only the relief: divide out the patch's own illumination gradient so
    # what is grown is the ice, not the lamp that was pointed at it.
    # Keep only the fine cracks.  Anything broader than a few pixels would be
    # mirrored into visible symmetry when the patch is tiled, so the large-scale
    # variation is supplied separately by noise instead.
    relief = np.clip(lum / np.maximum(ndimage.gaussian_filter(lum, 2.5), 1e-3), 0.62, 1.55)
    relief = np.clip(1.0 + (relief - 1.0) * 1.9, 0.50, 1.80)
    grown = grow_patch(relief.astype(np.float64))
    # Broad tonal structure: ice fields, fracture belts, patchy frost.
    shading = (1.0 + snoise(2.6, 71) * 0.30
                   + snoise(8.0, 93, octaves=2) * 0.18)
    base = np.array(p["ice_colour"])[None, None, :] * (grown * shading)[..., None]
    return np.clip(base, 0, 1)


def build(name, p):
    if "ice" in p:
        out = build_from_patch(name, p)
        finish(name, p, out, np.ones((H, W)))
        return
    img = np.asarray(Image.open(f"reference/{name}.png").convert("RGB")).astype(np.float32) / 255
    coef = fit_illumination(img, p)

    plans = [(0.0, 3, False, 1, 1.00), (0.0, 31, True, -1, 0.90),
             (-90.0, 57, False, -1, 0.82), (90.0, 83, False, 1, 0.82)]
    acc = np.zeros((H, W, 3)); wsum = np.zeros((H, W))
    for shift, seed, mirror, flip, gain in plans:
        c, w = reading(img, p, coef, shift, seed, mirror, flip, gain)
        acc += c * w[..., None]; wsum += w
    out = acc / wsum[..., None]

    # Where the photograph gave little to work with -- deep shadow, the very
    # limb, the poles -- the pixel still has real relief in it, just no reliable
    # colour or exposure.  Rather than blur those regions away, keep their
    # texture and re-light it: take the hue and level from the surrounding
    # well-imaged surface and modulate it by the local high-frequency detail.
    conf = smoothstep(0.03, 0.22, wsum)
    blur = (18, 18)
    soft = np.stack([ndimage.gaussian_filter(out[..., c], blur, mode=("nearest", "wrap"))
                     for c in range(3)], axis=-1)
    lum = 0.299 * out[..., 0] + 0.587 * out[..., 1] + 0.114 * out[..., 2]
    relief = np.clip(lum / np.maximum(ndimage.gaussian_filter(lum, blur, mode=("nearest", "wrap")),
                                      1e-3), 0.55, 1.75)
    relit = soft * relief[..., None]
    out = out * conf[..., None] + relit * (1 - conf[..., None])

    finish(name, p, out, wsum)


def equalise_resolution(img, base_deg=0.55):
    """
    Give the map the same angular resolution everywhere on the sphere.

    An equirectangular map squeezes every meridian onto one point at each pole,
    so a band of surface that is one degree wide at the equator is stretched
    across the whole width of the image by the time it reaches eighty-five
    degrees.  Anything still varying along longitude up there detonates into a
    pinwheel of radial streaks the moment a camera looks down on the body -- and
    the streaks reach far further down the disc than the pole itself, because
    the stretching starts long before it.

    The cure is not to wash out the caps, which only trades streaks for a
    painted lid.  It is to blur along longitude by a kernel that is constant in
    *arc*: `base_deg / cos(latitude)` pixels wide, so a feature subtends the
    same angle at the pole as at the equator, exactly as it would on a map made
    from real global imagery.  At the equator this does nothing at all.
    """
    h, w, _ = img.shape
    lat = np.radians(np.linspace(90, -90, h))
    base = max(3, int(base_deg / 360.0 * w))
    triple = np.concatenate([img, img, img], axis=1)
    cs = np.concatenate([np.zeros((h, 1, 3)), np.cumsum(triple, axis=1)], axis=1)
    idx = np.arange(w) + w
    out = np.empty_like(img)
    for j in range(h):
        half = int(np.clip(base / max(np.cos(lat[j]), 1e-3), base, w) // 2)
        out[j] = (cs[j, idx + half + 1] - cs[j, idx - half]) / (2 * half + 1)
    return out


_NOISE_CACHE = {}


def snoise(freq, seed, octaves=3):
    """Cached sphere noise -- the fields do not depend on which body is being
    built, and generating them is the slowest step here."""
    key = (freq, seed, octaves)
    if key not in _NOISE_CACHE:
        _NOISE_CACHE[key] = sphere_noise(freq, seed, octaves)
    return _NOISE_CACHE[key]


def sphere_noise(freq, seed, octaves=3):
    """
    Noise that knows it is on a sphere.

    Every noise generated on the flat map has longitudinal structure, and near
    the pole longitudinal structure is a pinwheel -- four cells across the map
    become a four-pointed star.  This samples a three-dimensional lattice at the
    surface point itself, so the result is isotropic on the sphere and the poles
    are nowhere special.
    """
    la = np.radians(LAT); lo = np.radians(LON)
    pts = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    total = np.zeros((H, W)); amp = 1.0
    for o in range(octaves):
        n = 24 * (2 ** o)
        grid = np.random.default_rng(seed + o).random((n, n, n))
        coords = (pts * freq * (2 ** o) * 0.5 + 0.5) * n
        total += (ndimage.map_coordinates(grid, coords, order=1, mode="grid-wrap") - 0.5) * amp
        amp *= 0.55
    return total / 1.55


def close_the_poles(img):
    """
    Make the caps actually converge.

    A parallel's circumference shrinks to nothing at the pole, so any function
    that is continuous on a sphere has to become a single value there.  This map
    does not: the high latitudes were folded back onto the last well-imaged
    parallel, which makes every row above sixty-six degrees a copy of the one
    below it -- a pure radial extrusion, and radial extrusion viewed pole-on is
    a pinwheel.  Blurring finer detail away does not touch it, because the
    blades are as broad as the patches that cast them.

    So the map is walked towards the average of each parallel, on a curve that
    starts gently at forty degrees and reaches unity at the pole.  The ramp is
    squared to keep it nearly invisible through the mid latitudes and let it do
    its work only where the geometry demands it.  Fine grain goes back on top so
    the cap reads as frost rather than as a lid.
    """
    h, w, _ = img.shape
    lat = np.abs(np.linspace(90, -90, h))[:, None, None]
    p = smoothstep(38.0, 88.0, lat) ** 1.8
    rows = img.mean(axis=1, keepdims=True)
    rows = np.stack([ndimage.gaussian_filter1d(rows[:, 0, c], 9, mode="nearest")
                     for c in range(3)], axis=-1)[:, None, :]
    out = img * (1 - p) + rows * p
    # Put the surface back, in a form the pole cannot turn into a wheel.
    texture = (sphere_noise(11.0, 137)[..., None] * 0.30
               + sphere_noise(34.0, 211, octaves=2)[..., None] * 0.17)
    return np.clip(out * (1 + texture * p), 0, 1)


def finish(name, p, out, wsum):
    cap = p.get("red_cap")
    if cap:
        # Lay the dark red region back on as a band, its edge roughened so it
        # reads as terrain rather than a painted stripe.  Multiplying rather
        # than replacing keeps every crack and crater underneath it.
        edge = (cap["edge"] + snoise(2.3, 13) * cap["rough"] * 1.3
                + snoise(6.5, 29, octaves=2) * cap["rough"] * 0.5)
        mask = smoothstep(-cap["softness"], cap["softness"], LAT - edge)[..., None]
        tint = np.array(cap["colour"])[None, None, :]
        lum = 0.299 * out[..., 0] + 0.587 * out[..., 1] + 0.114 * out[..., 2]
        red = np.clip(tint * (lum / max(lum.mean(), 1e-3))[..., None], 0, 1)
        out = out * (1 - mask * cap["strength"]) + red * (mask * cap["strength"])

    out = equalise_resolution(out)
    out = close_the_poles(out)

    out = np.clip(out, 0, 1)
    pil = Image.fromarray((out * 255).astype(np.uint8))
    pil = pil.filter(ImageFilter.UnsharpMask(radius=2, percent=64, threshold=2))
    pil.save(f"out/{name}.jpg", quality=93, optimize=True)
    lum = 0.299 * out[..., 0] + 0.587 * out[..., 1] + 0.114 * out[..., 2]
    print(f"{name:9s} meanL={lum.mean():.3f} rgb={np.round(out.reshape(-1,3).mean(0),3)} "
          f"thin={(wsum < 0.05).mean():.3f}")


for k, v in BODIES.items():
    build(k, v)

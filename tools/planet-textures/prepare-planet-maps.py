"""
Round 41: real spacecraft maps for Earth, the Moon and Jupiter.

    python tools/planet-textures/prepare-planet-maps.py <downloads folder> public/textures

Reads the three NASA files the owner downloaded (this build's network cannot
reach NASA's servers) and writes the scene's maps:

  world.200407.3x5400x2700.jpg -> earth-bmng-july-4k.jpg   (4096 x 2048)
                                  earth-water-roughness-2k.png
      NASA Earth Observatory, Blue Marble Next Generation, July 2004 (Stöckli
      et al. 2005): true-colour MODIS mosaic, cloud-free, plain oceans (no
      bathymetry shading). Public domain.
      The roughness map is derived from it: open water (dark, blue-dominant
      pixels) 0.8 so the Sun leaves a soft glint on the oceans as it does in every
      photograph from orbit, land and ice 0.92. In the green channel, which is
      the one three.js reads.
  lroc_color_2k.jpg            -> moon-color-2k.jpg        (2048 x 1024, as is)
      NASA SVS CGI Moon Kit (2025 version), LRO Camera WAC colour. Public domain.
  PIA07782.jpg                 -> jupiter-cassini-map.jpg  (4096 x 2048)
      NASA/JPL/Space Science Institute, "Cassini's Best Maps of Jupiter",
      cylindrical, Cassini ISS narrow-angle, 11-12 December 2000. Public domain.

Each map's mean linear reflectance is printed, for the materials' notes.
"""
import sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
src, out = sys.argv[1], sys.argv[2]


def linear(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def report(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255
    print(f"{path}: mean linear {float((linear(a) @ [0.2126, 0.7152, 0.0722]).mean()):.4f}")


def wrap_resize(img, size, duplicate_meridian=False):
    """Resample a cylindrical map so its left and right edges meet.

    Round 42 (the owner: "i see separation line like two images end to end
    when wrapped ... a very very thin line"). A plain resize treats the
    map's left and right edges as image borders, and some sources do not
    meet there either: BMNG's last column differs from its first by 4.5
    levels on average against 0.5 between any two neighbouring columns
    (measured). Here the map is padded with 16 columns from its opposite
    side before resampling, so the filter sees one continuous strip, and
    then any step left at the meridian is spread over 24 columns each side
    (16 and 24 chosen: wider than the Lanczos kernel at these scales, too
    narrow to see). `duplicate_meridian`: the source repeats its first
    column as its last (Cassini's 3601 columns), which is dropped first.
    """
    a = np.asarray(img).astype(np.float64)
    if duplicate_meridian:
        a = a[:, :-1]
    h, w = a.shape[:2]
    pad = 16
    strip = np.concatenate([a[:, -pad:], a, a[:, :pad]], axis=1)
    W, H = size
    scale = W / w
    padded_w = W + 2 * int(round(pad * scale))
    out = np.asarray(
        Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8)).resize((padded_w, H), Image.LANCZOS)
    ).astype(np.float64)
    cut = int(round(pad * scale))
    out = out[:, cut:cut + W]
    feather = 24
    step = (out[:, :1] - out[:, -1:]) / 2
    ramp = (1 - np.arange(feather) / feather).reshape((1, feather) + (1,) * (out.ndim - 2))
    step = step.reshape((H, 1) + out.shape[2:])
    out[:, :feather] -= step * ramp
    out[:, -feather:][:, ::-1] += step * ramp
    return Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8))


earth = Image.open(f"{src}/world.200407.3x5400x2700.jpg").convert("RGB")
wrap_resize(earth, (4096, 2048)).save(f"{out}/earth-bmng-july-4k.jpg", quality=90, optimize=True)
report(f"{out}/earth-bmng-july-4k.jpg")

small = np.asarray(wrap_resize(earth, (2048, 1024))).astype(np.float64) / 255
r, g, b = small[..., 0], small[..., 1], small[..., 2]
# Water: blue the strongest channel and the pixel dark (BMNG oceans are deep
# navy, sRGB value under ~0.45); ice and cloud-free land fail one or both.
water = (b > r + 0.04) & (b >= g) & (small.max(axis=2) < 0.45)
water_soft = np.asarray(Image.fromarray((water * 255).astype(np.uint8)).resize((2048, 1024)).convert("L"), dtype=np.float64) / 255
rough = 0.92 - (0.92 - 0.8) * water_soft
rgb = np.zeros((1024, 2048, 3), dtype=np.uint8)
rgb[..., 1] = np.round(rough * 255).astype(np.uint8)
rgb[..., 0] = rgb[..., 1]
rgb[..., 2] = rgb[..., 1]
Image.fromarray(rgb).save(f"{out}/earth-water-roughness-2k.png", optimize=True)
print(f"water fraction {water.mean():.3f}")

moon = Image.open(f"{src}/lroc_color_2k.jpg").convert("RGB")
wrap_resize(moon, moon.size).save(f"{out}/moon-color-2k.jpg", quality=92, optimize=True)
report(f"{out}/moon-color-2k.jpg")

jup = Image.open(f"{src}/PIA07782.jpg").convert("RGB")
print("jupiter size", jup.size)
# Resampled to 4096 x 2048. Its own 3601 x 1801 (not a power of two) rendered
# blank on the owner's machine while the power-of-two Earth and Moon maps
# showed, so every map here is a power of two.
wrap_resize(jup, (4096, 2048), duplicate_meridian=True).save(f"{out}/jupiter-cassini-map.jpg", quality=86, optimize=True)
report(f"{out}/jupiter-cassini-map.jpg")

# Mercury (added the same round, the owner: "do the same for Mercury"):
#   PIA16298.jpg -> mercury-messenger-2k.jpg (2048 x 1024, greyscale)
#   NASA/JHUAPL/Carnegie Institution, MESSENGER MDIS global mosaic, simple
#   cylindrical, 5 km/pixel, >99.9% of the surface. Public domain. The few
#   rows at each pole with no data (black) are filled from the nearest row
#   that has data, so the poles do not render as black caps.
import os
if os.path.exists(f"{src}/PIA16298.jpg"):
    m = np.asarray(Image.open(f"{src}/PIA16298.jpg").convert("L")).copy()
    h = m.shape[0]
    rows = [y for y in range(h) if m[y].mean() > 8]
    top, bottom = rows[0], rows[-1]
    m[:top] = m[top]
    m[bottom + 1:] = m[bottom]
    # 2048 x 1024: a power of two, as for Jupiter above, and under 1 MB (at
    # 4096 x 2048 it was 2.9 MB, slow enough to risk the loader's time limit).
    wrap_resize(Image.fromarray(m).convert("RGB"), (2048, 1024)).save(f"{out}/mercury-messenger-2k.jpg", quality=90, optimize=True)
    print(f"mercury rows filled: top {top}, bottom {h - 1 - bottom}")
    report(f"{out}/mercury-messenger-2k.jpg")

# Earth's cloud map (earth-clouds.jpg, already in the scene): its left and
# right edges also differ (6.0 levels against 4.0 between neighbours,
# measured), so its seam is feathered in place the same way. Done only
# while the step is there, so rerunning does not re-encode it each time.
clouds_path = f"{out}/earth-clouds.jpg"
if os.path.exists(clouds_path):
    c = np.asarray(Image.open(clouds_path).convert("RGB")).astype(np.float64)
    edge = np.abs(c[:, 0] - c[:, -1]).mean()
    inner = np.abs(c[:, 0] - c[:, 1]).mean()
    if edge > 1.2 * inner:
        wrap_resize(Image.fromarray(c.astype(np.uint8)), (c.shape[1], c.shape[0])).save(clouds_path, quality=92, optimize=True)
        print(f"earth clouds seam feathered ({edge:.2f} -> neighbours {inner:.2f})")

"""
Round 38: Nessus's poles.

The supplied Nessus image is small (a disc 141 px across) and edged by a
grey-green halo, so the unwrapped map's polar caps -- folded from the limb,
see CAP_LAT in build-dwarf-textures.py -- came out a flat tan that is the
halo's colour, not the body's. Above 40 degrees this replaces the caps with
the well-imaged equatorial band mirrored into them, on a weight reaching 1 at
62 degrees, and walks the last 6 degrees to each row's mean so the pole has
one value. Run after `build-dwarf-textures.py nessus`, before
`to-small-body.py nessus`.
"""
import numpy as np
from PIL import Image

a = np.asarray(Image.open("out/nessus.jpg").convert("RGB")).astype(np.float64) / 255
H, W, _ = a.shape
lat = np.linspace(90, -90, H)
lum = a @ [0.299, 0.587, 0.114]
mid = a[int(H * 0.32):int(H * 0.68)]
mid_lum = mid @ [0.299, 0.587, 0.114]
chroma = mid / np.maximum(mid_lum[..., None], 1e-3)
out = a.copy()
band = a[int(H * 0.30):int(H * 0.70)]
n = band.shape[0]
for y in range(H):
    w = np.clip((abs(lat[y]) - 40) / 22, 0, 1)
    if w <= 0:
        continue
    # The equatorial band itself, mirrored into each cap row by row and
    # turned a third of the way round: real patches, continuous from row to
    # row, rather than the halo's flat tan.
    k = min(H - 1 - y, y)
    row = np.roll(band[(n - 1 - (k % n)) if y < H // 2 else (k % n)], W // 3, axis=0)
    # Within 6 degrees of the pole, walk towards the row's own mean, because
    # a map continuous on a sphere has one value at the pole.
    p = np.clip((abs(lat[y]) - 84) / 6, 0, 1)
    row = row * (1 - p) + row.mean(0) * p
    out[y] = a[y] * (1 - w) + row * w
Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save("out/nessus.jpg", quality=92)
print("nessus poles recoloured")

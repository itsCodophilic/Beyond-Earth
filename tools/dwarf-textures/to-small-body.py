"""
Finish a dwarf-textures map for the small-body builder.

The Rank 4 trans-Neptunian worlds are drawn by `scene/smallBodies/`, not by the
planet builder, but ten of them have reference images, so their maps come out
of `build-dwarf-textures.py` like the planet-builder worlds' do. Three things
differ on the way into `public/assets/textures/smallbodies/`:

  1. Rows are levelled. A reference lit from one side, or darkened at its
     limb, unwraps into dark bands along the top and bottom of the map --
     Huya's and Ritona's were the worst. Each row's luminance is pulled to the
     map's mean, smoothed over 12 rows and clamped to 0.6-1.9x so only the
     banding goes and the colour and the patches stay.
  2. 1024 x 512, the same size as the Rank 1 and Rank 3 maps.
  3. The mean *linear* luminance of the saved JPEG is printed, because
     `smallBodies.js` divides the material by it (`meanLinear`) so the body's
     measured albedo, not the image's exposure, sets how bright it is.

Huya I has no image. It takes Huya's map turned half a revolution and
mirrored -- the same colour, not the same face.

    python3 to-small-body.py aya chaos chiminigagua deedee gkunhomdima \\
        goibniu huya leleakuhonua ritona xewioso
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

OUT = os.environ.get("SBT_OUT", "../../public/assets/textures/smallbodies")


def srgb_to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def mean_linear(path):
    s = np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255
    return float((srgb_to_linear(s) @ [0.2126, 0.7152, 0.0722]).mean())


def finish(name):
    a = np.asarray(Image.open(f"out/{name}.jpg").convert("RGB")).astype(np.float64) / 255
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    row = ndimage.gaussian_filter1d(lum.mean(1), 12, mode="nearest")
    gain = np.clip(lum.mean() / np.maximum(row, 1e-3), 0.6, 1.9)[:, None, None]
    out = Image.fromarray((np.clip(a * gain, 0, 1) * 255).astype(np.uint8))
    path = f"{OUT}/{name}.jpg"
    out.resize((1024, 512), Image.LANCZOS).save(path, quality=90, optimize=True)
    print(f"{name:13s} meanLinear={mean_linear(path):.4f}")
    if name == "huya":
        arr = np.asarray(Image.open(path))
        arr = np.roll(arr, arr.shape[1] // 2, axis=1)[:, ::-1]
        moon = f"{OUT}/huya-moon.jpg"
        Image.fromarray(arr).resize((512, 256), Image.LANCZOS).save(moon, quality=90)
        print(f"{'huya-moon':13s} meanLinear={mean_linear(moon):.4f}")


if __name__ == "__main__":
    for n in sys.argv[1:]:
        finish(n)

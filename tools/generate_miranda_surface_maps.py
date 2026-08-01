"""Prepare seamless albedo, height, and roughness maps for Miranda.

The user's circular reference establishes Miranda's pale icy palette and its
distinctive patchwork of coronae, ridges, scarps, troughs, and cratered plains.
A generated 2:1 reconstruction supplies full longitude coverage. This tool
grades that reconstruction, makes its longitude and poles sphere-safe, and
derives material data so the terrain responds to Three.js lighting in 3D.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


WIDTH = 2048
HEIGHT = 1024


def make_sphere_safe(albedo: np.ndarray) -> np.ndarray:
    """Blend corresponding map edges without creating a smooth vertical band."""

    original = albedo.copy()
    edge_width = 48
    for index in range(edge_width):
        t = index / max(1, edge_width - 1)
        weight = t * t * (3.0 - 2.0 * t)
        paired = (original[:, index] + original[:, -1 - index]) * 0.5
        albedo[:, index] = paired * (1.0 - weight) + original[:, index] * weight
        albedo[:, -1 - index] = paired * (1.0 - weight) + original[:, -1 - index] * weight

    # All longitudes converge to one vertex at each pole. Gradually blending
    # the final rows to their mean prevents radial UV stars at close focus.
    pole_width = 42
    for index in range(pole_width):
        weight = (index / max(1, pole_width - 1)) ** 2
        for row in (index, HEIGHT - 1 - index):
            row_mean = albedo[row].mean(axis=0)
            albedo[row] = row_mean * (1.0 - weight) + albedo[row] * weight
    return albedo


def prepare_maps(source: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Grade Miranda's albedo and extract multi-scale tectonic relief."""

    image = source.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    albedo = np.asarray(image, dtype=np.float32) / 255.0
    albedo = make_sphere_safe(albedo)
    relief_source = albedo.copy()

    # Soften the tiny baked edge contrast in the generated albedo. The sharper
    # original remains available below for the height map, allowing Three.js
    # lighting—not dark outlines in the colour—to describe the 3D ridges.
    albedo_image = Image.fromarray(np.uint8(np.clip(albedo, 0, 1) * 255), mode="RGB")
    albedo = np.asarray(albedo_image.filter(ImageFilter.GaussianBlur(0.65)), dtype=np.float32) / 255.0

    # Miranda is brighter than Umbriel but not self-luminous. Preserve the
    # supplied dusty mauve-grey character while leaving illumination to the Sun.
    mean_luminance = float(albedo.mean())
    albedo *= 0.50 / max(mean_luminance, 1e-5)
    albedo = np.clip(albedo, 0.14, 0.82)

    luminance = relief_source.mean(axis=2)
    normalizer = max(float(luminance.max()), 1e-5)
    luma_image = Image.fromarray(np.uint8(luminance / normalizer * 255), mode="L")
    fine = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(0.70)), dtype=np.float32) / 255.0
    medium = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(5.0)), dtype=np.float32) / 255.0
    broad = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(26.0)), dtype=np.float32) / 255.0

    # Fine contrast defines crater rims; medium contrast carries corona ridges,
    # troughs, and scarps. Very broad color provinces stay in albedo only.
    local_relief = (fine - medium) * 1.35 + (medium - broad) * 1.05
    scale = max(0.028, float(np.percentile(np.abs(local_relief), 99.6)))
    relief = np.clip(0.5 + local_relief / scale * 0.45, 0.0, 1.0)
    roughness = np.clip(0.94 - np.abs(local_relief) / scale * 0.085, 0.81, 0.985)
    return albedo, relief, roughness


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference", type=Path, help="User-supplied Miranda disk reference")
    parser.add_argument("generated_albedo", type=Path, help="Generated seamless 2:1 Miranda reconstruction")
    parser.add_argument("output", type=Path, help="major-moons texture directory")
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.reference, args.output / "miranda-source-reference.png")
    albedo, height, roughness = prepare_maps(Image.open(args.generated_albedo))

    Image.fromarray(np.uint8(albedo * 255), mode="RGB").save(
        args.output / "miranda-albedo-v1.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(height * 255), mode="L").save(
        args.output / "miranda-height-v1.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(roughness * 255), mode="L").save(
        args.output / "miranda-roughness-v1.jpg", quality=94, optimize=True,
    )


if __name__ == "__main__":
    main()

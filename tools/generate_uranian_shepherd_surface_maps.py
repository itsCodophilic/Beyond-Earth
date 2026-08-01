"""Prepare seamless albedo, height, and roughness maps for Uranian shepherd moons.

Cordelia and Ophelia have no resolved global surface photography. ImageGen
therefore supplies restrained, non-specific icy-rock regolith rather than
invented named geography. This tool makes those generated maps sphere-safe and
derives lighting data for Three.js. It also archives the user's Cordelia image
as an artistic reference; the supplied Ophelia image is not copied because it
depicts Jupiter's moon Io.
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
    """Blend longitude edges and converge the pole rows without radial stars."""

    original = albedo.copy()
    edge_width = 56
    for index in range(edge_width):
        t = index / max(1, edge_width - 1)
        weight = t * t * (3.0 - 2.0 * t)
        paired = (original[:, index] + original[:, -1 - index]) * 0.5
        albedo[:, index] = paired * (1.0 - weight) + original[:, index] * weight
        albedo[:, -1 - index] = paired * (1.0 - weight) + original[:, -1 - index] * weight

    pole_width = 44
    for index in range(pole_width):
        weight = (index / max(1, pole_width - 1)) ** 2
        for row in (index, HEIGHT - 1 - index):
            row_mean = albedo[row].mean(axis=0)
            albedo[row] = row_mean * (1.0 - weight) + albedo[row] * weight
    return albedo


def prepare_maps(source: Image.Image, target_luminance: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Grade low-albedo regolith and derive subtle multi-scale physical relief."""

    image = source.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    albedo = np.asarray(image, dtype=np.float32) / 255.0
    albedo = make_sphere_safe(albedo)
    relief_source = albedo.copy()

    # Remove any very small generated highlight edges from colour. Fine detail
    # is retained below in the height map so the actual scene light reveals it.
    albedo_image = Image.fromarray(np.uint8(np.clip(albedo, 0, 1) * 255), mode="RGB")
    albedo = np.asarray(albedo_image.filter(ImageFilter.GaussianBlur(0.42)), dtype=np.float32) / 255.0
    albedo *= target_luminance / max(float(albedo.mean()), 1e-5)
    albedo = np.clip(albedo, 0.055, 0.42)

    luminance = relief_source.mean(axis=2)
    normalizer = max(float(luminance.max()), 1e-5)
    luma_image = Image.fromarray(np.uint8(luminance / normalizer * 255), mode="L")
    fine = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(0.62)), dtype=np.float32) / 255.0
    medium = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(4.2)), dtype=np.float32) / 255.0
    broad = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(22.0)), dtype=np.float32) / 255.0

    local_relief = (fine - medium) * 1.18 + (medium - broad) * 0.78
    scale = max(0.025, float(np.percentile(np.abs(local_relief), 99.5)))
    relief = np.clip(0.5 + local_relief / scale * 0.40, 0.02, 0.98)
    roughness = np.clip(0.975 - np.abs(local_relief) / scale * 0.055, 0.88, 0.995)
    return albedo, relief, roughness


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("body", choices=("cordelia", "ophelia"))
    parser.add_argument("generated_albedo", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--reference", type=Path)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    if args.reference:
        shutil.copy2(args.reference, args.output / f"{args.body}-artistic-reference.png")

    target_luminance = 0.205 if args.body == "cordelia" else 0.185
    albedo, height, roughness = prepare_maps(Image.open(args.generated_albedo), target_luminance)

    Image.fromarray(np.uint8(albedo * 255), mode="RGB").save(
        args.output / f"{args.body}-albedo-v1.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(height * 255), mode="L").save(
        args.output / f"{args.body}-height-v1.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(roughness * 255), mode="L").save(
        args.output / f"{args.body}-roughness-v1.jpg", quality=94, optimize=True,
    )


if __name__ == "__main__":
    main()

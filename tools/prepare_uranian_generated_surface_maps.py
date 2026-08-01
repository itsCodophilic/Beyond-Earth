"""Prepare generated surface assets for unresolved Uranian inner moons.

The input surface images are deliberately flat, evenly lit 2:1 material maps
created from the user's visual references.  This tool turns those sources into
sphere-safe albedo, height, and roughness maps while archiving both the original
reference and the generated source.  The maps are reconstructions, not claimed
spacecraft observations.
"""

from __future__ import annotations

import argparse
import shutil
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


WIDTH = 1536
HEIGHT = 768


@dataclass(frozen=True)
class SurfaceProfile:
    target_mean: float
    contrast: float
    tint: tuple[float, float, float]
    roughness: float


PROFILES = {
    "cressida": SurfaceProfile(78.0, 0.78, (0.98, 1.00, 1.01), 0.985),
    "desdemona": SurfaceProfile(66.0, 0.88, (0.93, 1.01, 0.99), 0.988),
    "juliet": SurfaceProfile(79.0, 0.86, (1.08, 1.00, 0.88), 0.984),
    "rosalind": SurfaceProfile(67.0, 0.90, (0.98, 0.99, 1.00), 0.989),
    "cupid": SurfaceProfile(58.0, 0.92, (0.97, 0.99, 1.00), 0.991),
    "belinda": SurfaceProfile(71.0, 0.88, (0.98, 1.00, 1.01), 0.987),
}


def make_seamless(array: np.ndarray, longitude_width: int = 56, pole_height: int = 30) -> np.ndarray:
    """Match longitude edges and calm polar rows without mirroring terrain."""

    result = array.copy()
    for offset in range(longitude_width):
        preserve = (offset / max(1, longitude_width - 1)) ** 2
        left = array[:, offset].copy()
        right = array[:, -(offset + 1)].copy()
        shared = (left + right) * 0.5
        result[:, offset] = shared * (1.0 - preserve) + left * preserve
        result[:, -(offset + 1)] = shared * (1.0 - preserve) + right * preserve

    top_colour = result[pole_height].mean(axis=0)
    bottom_colour = result[-(pole_height + 1)].mean(axis=0)
    for offset in range(pole_height):
        preserve = (offset / max(1, pole_height - 1)) ** 1.7
        result[offset] = top_colour * (1.0 - preserve) + result[offset] * preserve
        result[-(offset + 1)] = bottom_colour * (1.0 - preserve) + result[-(offset + 1)] * preserve
    return result


def normalise(array: np.ndarray) -> np.ndarray:
    low, high = np.percentile(array, (1.0, 99.0))
    return np.clip((array - low) / max(1e-6, high - low), 0.0, 1.0)


def prepare(body: str, generated_path: Path, reference_path: Path, output: Path) -> None:
    profile = PROFILES[body]
    source = Image.open(generated_path).convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    rgb = np.asarray(source, dtype=np.float32)

    # Generated maps intentionally arrive bright so their crater character is
    # legible.  Re-centre them to the much darker reflectance of Uranus's inner
    # moons, retaining only subtle colour differences from each reference.
    mean = float(rgb.mean())
    rgb = profile.target_mean + (rgb - mean) * profile.contrast
    rgb *= np.asarray(profile.tint, dtype=np.float32)
    rgb = make_seamless(np.clip(rgb, 10.0, 168.0))

    albedo = Image.fromarray(np.uint8(np.clip(rgb, 0, 255)), mode="RGB")
    luminance = np.asarray(albedo.convert("L"), dtype=np.float32) / 255.0
    broad = np.asarray(
        albedo.convert("L").filter(ImageFilter.GaussianBlur(12.0)),
        dtype=np.float32,
    ) / 255.0
    medium = np.asarray(
        albedo.convert("L").filter(ImageFilter.GaussianBlur(2.2)),
        dtype=np.float32,
    ) / 255.0

    # Remove broad albedo colour before deriving relief.  This prevents light
    # patches from inflating into mountains while retaining crater-scale depth.
    local_relief = (luminance - broad) * 0.62 + (luminance - medium) * 0.38
    height = 0.31 + normalise(local_relief) * 0.38
    height = make_seamless(height[..., None])[..., 0]

    detail = np.abs(luminance - medium)
    roughness = np.clip(profile.roughness - normalise(detail) * 0.055, 0.90, 0.997)
    roughness = make_seamless(roughness[..., None])[..., 0]

    output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(reference_path, output / f"{body}-artistic-reference.png")
    shutil.copy2(generated_path, output / f"{body}-generated-albedo-source.png")
    albedo.save(output / f"{body}-albedo-v1.jpg", quality=95, optimize=True)
    Image.fromarray(np.uint8(height * 255), mode="L").filter(ImageFilter.GaussianBlur(0.28)).save(
        output / f"{body}-height-v1.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(roughness * 255), mode="L").save(
        output / f"{body}-roughness-v1.jpg", quality=94, optimize=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("body", choices=tuple(PROFILES))
    parser.add_argument("generated", type=Path)
    parser.add_argument("reference", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    prepare(args.body, args.generated, args.reference, args.output)


if __name__ == "__main__":
    main()

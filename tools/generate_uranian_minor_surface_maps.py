"""Generate seamless material maps for four unresolved Uranian moons.

The supplied pictures are visual references, not spacecraft-resolved global
maps.  This tool archives those references, then creates sphere-safe 2:1
albedo, height, and roughness maps from their colour/terrain character.  All
large-scale lighting and black picture backgrounds are deliberately excluded.
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
class BodyStyle:
    seed: int
    dark: tuple[int, int, int]
    base: tuple[int, int, int]
    light: tuple[int, int, int]
    crater_count: int
    crater_depth: float
    roughness: float
    large_basin: bool = False
    streaks: bool = False


STYLES = {
    # S/2025 U1 is a point-source discovery.  The neutral charcoal palette is
    # intentionally conservative; the supplied cratered disk guides character.
    "s2025-u1": BodyStyle(2501, (29, 31, 32), (67, 70, 70), (119, 121, 118), 58, 0.22, 0.985, streaks=True),
    # NASA describes Bianca as probably dark, carbon-rich material.  Preserve
    # the reference's cool green-grey cast without its photographed star field.
    "bianca": BodyStyle(1986, (27, 34, 33), (65, 78, 73), (111, 120, 108), 31, 0.17, 0.982),
    # Mab is tiny and dark; a restrained bright ejecta field and one broad basin
    # echo the supplied concept while keeping the global albedo low.
    "mab": BodyStyle(2003, (31, 33, 34), (77, 80, 79), (139, 140, 133), 47, 0.25, 0.988, large_basin=True),
    # Caliban is a low-albedo captured irregular moon with a measured reddish
    # colour.  The palette is muted so scene lighting, not baked colour, shapes it.
    "caliban": BodyStyle(1997, (39, 27, 29), (91, 57, 54), (150, 91, 75), 36, 0.20, 0.986),
}


def normalise(value: np.ndarray) -> np.ndarray:
    low, high = np.percentile(value, (1.0, 99.0))
    return np.clip((value - low) / max(1e-6, high - low), 0.0, 1.0)


def spherical_field(rng: np.random.Generator, x: np.ndarray, y: np.ndarray, z: np.ndarray,
                    octaves: tuple[tuple[float, float], ...]) -> np.ndarray:
    """Band-limited 3D directional noise, continuous at seam and poles."""

    field = np.zeros_like(x)
    total = 0.0
    for frequency, amplitude in octaves:
        for _ in range(5):
            direction = rng.normal(size=3)
            direction /= np.linalg.norm(direction)
            phase = rng.uniform(0.0, np.pi * 2.0)
            field += np.sin(
                (x * direction[0] + y * direction[1] + z * direction[2])
                * np.pi * frequency + phase
            ) * amplitude
            total += amplitude
    return field / max(total, 1e-6)


def crater_terrain(rng: np.random.Generator, vectors: np.ndarray, count: int,
                   depth: float, large_basin: bool) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    height = np.zeros(vectors.shape[:2], dtype=np.float32)
    floors = np.zeros_like(height)
    rims = np.zeros_like(height)

    centres: list[tuple[np.ndarray, float, float]] = []
    if large_basin:
        centres.append((np.array([0.74, 0.17, 0.65], dtype=np.float32), 0.32, depth * 1.18))
    for index in range(count):
        centre = rng.normal(size=3)
        centre /= np.linalg.norm(centre)
        radius = rng.uniform(0.030, 0.135) * (1.7 if index < 3 else 1.0)
        centres.append((centre.astype(np.float32), radius, depth * rng.uniform(0.45, 1.0)))

    for centre, radius, crater_depth in centres:
        angle = np.arccos(np.clip(np.sum(vectors * centre, axis=2), -1.0, 1.0))
        q = angle / radius
        bowl = np.where(q < 1.0, -crater_depth * np.power(np.maximum(0.0, 1.0 - q * q), 1.55), 0.0)
        rim = crater_depth * 0.24 * np.exp(-np.square((q - 0.98) / 0.115))
        height += bowl + rim
        floors = np.maximum(floors, np.where(q < 1.0, np.power(np.maximum(0.0, 1.0 - q), 1.25), 0.0))
        rims = np.maximum(rims, np.exp(-np.square((q - 0.98) / 0.13)))
    return height, floors, rims


def reference_colour(reference: Image.Image, fallback: np.ndarray) -> np.ndarray:
    """Return a restrained disk colour; reject black sky, labels, and highlights."""

    image = np.asarray(reference.convert("RGB"), dtype=np.float32) / 255.0
    luminance = image.mean(axis=2)
    saturation = image.max(axis=2) - image.min(axis=2)
    height, width = luminance.shape
    yy, xx = np.mgrid[0:height, 0:width]
    centre_mask = ((xx - width * 0.52) / (width * 0.43)) ** 2 + ((yy - height * 0.52) / (height * 0.43)) ** 2 < 1
    valid = centre_mask & (luminance > 0.055) & (luminance < 0.82)
    # Bright white lettering in the Mab reference is rejected by limiting both
    # luminance and the central sampling area.
    pixels = image[valid]
    if pixels.size < 60:
        return fallback
    colour = np.median(pixels, axis=0)
    return np.clip(fallback * 0.72 + colour * 255.0 * 0.28, 0, 255)


def generate(body: str, reference_path: Path, output: Path) -> None:
    style = STYLES[body]
    rng = np.random.default_rng(style.seed)

    lon = np.linspace(-np.pi, np.pi, WIDTH, endpoint=False, dtype=np.float32)
    lat = np.linspace(np.pi / 2, -np.pi / 2, HEIGHT, dtype=np.float32)
    lon_grid, lat_grid = np.meshgrid(lon, lat)
    cos_lat = np.cos(lat_grid)
    vectors = np.stack((cos_lat * np.cos(lon_grid), np.sin(lat_grid), cos_lat * np.sin(lon_grid)), axis=2)
    x, y, z = vectors[..., 0], vectors[..., 1], vectors[..., 2]

    broad = spherical_field(rng, x, y, z, ((0.8, 1.0), (1.6, 0.62), (3.2, 0.30)))
    medium = spherical_field(rng, x, y, z, ((4.0, 1.0), (8.0, 0.55), (14.0, 0.25)))
    fine = spherical_field(rng, x, y, z, ((18.0, 1.0), (34.0, 0.48), (58.0, 0.20)))
    crater_height, floors, rims = crater_terrain(
        rng, vectors, style.crater_count, style.crater_depth, style.large_basin,
    )

    relief = broad * 0.22 + medium * 0.12 + fine * 0.040 + crater_height
    tone = normalise(broad * 0.72 + medium * 0.50 + fine * 0.14 - floors * 0.62 + rims * 0.22)
    if style.streaks:
        streak = np.sin(np.arctan2(z, x) * 7.0 + y * 9.0 + medium * 3.2)
        tone = np.clip(tone * 0.80 + normalise(streak) * 0.20, 0.0, 1.0)

    dark = np.asarray(style.dark, dtype=np.float32)
    base_fallback = np.asarray(style.base, dtype=np.float32)
    reference = Image.open(reference_path)
    base = reference_colour(reference, base_fallback)
    light = np.asarray(style.light, dtype=np.float32)
    lower = np.clip(tone * 2.0, 0.0, 1.0)[..., None]
    upper = np.clip((tone - 0.5) * 2.0, 0.0, 1.0)[..., None]
    albedo = dark * (1.0 - lower) + base * lower
    albedo = albedo * (1.0 - upper) + light * upper
    # Keep impact shading subordinate to real scene lighting. Strong painted
    # circles make craters look like decals; most depth belongs in the matching
    # height map instead.
    albedo *= (1.0 - floors[..., None] * 0.14 + rims[..., None] * 0.035)
    albedo = np.clip(albedo, 8, 182).astype(np.uint8)

    height_map = np.clip(0.50 + relief * 1.85, 0.02, 0.98)
    local_variance = np.abs(medium * 0.7 + fine)
    roughness = np.clip(style.roughness - local_variance * 0.055 - rims * 0.025, 0.89, 0.997)

    output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(reference_path, output / f"{body}-artistic-reference.png")
    Image.fromarray(albedo, mode="RGB").save(output / f"{body}-albedo-v1.jpg", quality=95, optimize=True)
    Image.fromarray(np.uint8(height_map * 255), mode="L").filter(ImageFilter.GaussianBlur(0.34)).save(
        output / f"{body}-height-v1.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(roughness * 255), mode="L").save(
        output / f"{body}-roughness-v1.jpg", quality=94, optimize=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("body", choices=tuple(STYLES))
    parser.add_argument("reference", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    generate(args.body, args.reference, args.output)


if __name__ == "__main__":
    main()

"""Build seamless, image-derived Umbriel material maps.

The supplied file is a single disk observation, not a 360-degree map. Its
large-scale disk shading and limb must therefore never be stretched around a
sphere. This tool extracts only local terrain evidence (crater edges, grooves,
and the observed grey palette), makes that detail periodic, and combines it
with a latitude-aware spherical impact field. The result is one continuous
equirectangular surface with matching albedo, relief, and roughness maps.
"""

from __future__ import annotations

import argparse
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


WIDTH = 2048
HEIGHT = 1024


def locate_disk(rgb: np.ndarray) -> tuple[float, float, float]:
    """Measure the bright moon disk while rejecting photographed black sky."""

    luminance = rgb.mean(axis=2)
    threshold = max(0.045, float(np.percentile(luminance, 62)) * 0.24)
    ys, xs = np.nonzero(luminance > threshold)
    if xs.size < 100:
        raise ValueError("The supplied reference does not contain a detectable moon disk")
    left, right = float(xs.min()), float(xs.max())
    top, bottom = float(ys.min()), float(ys.max())
    return (left + right) * 0.5, (top + bottom) * 0.5, min(right - left, bottom - top) * 0.5


def repeat_mirrored(tile: np.ndarray, width: int, height: int, offset: tuple[int, int]) -> np.ndarray:
    """Repeat a mirrored tile so both longitude edges join without a seam."""

    mirrored_x = np.concatenate((tile, np.flip(tile, axis=1)), axis=1)
    mirrored_xy = np.concatenate((mirrored_x, np.flip(mirrored_x, axis=0)), axis=0)
    repeats_y = math.ceil((height + mirrored_xy.shape[0]) / mirrored_xy.shape[0]) + 1
    repeats_x = math.ceil((width + mirrored_xy.shape[1]) / mirrored_xy.shape[1]) + 1
    field = np.tile(mirrored_xy, (repeats_y, repeats_x))
    y0 = offset[1] % mirrored_xy.shape[0]
    x0 = offset[0] % mirrored_xy.shape[1]
    return field[y0:y0 + height, x0:x0 + width]


def harmonic_noise(longitude: np.ndarray, latitude: np.ndarray, seed: int) -> np.ndarray:
    """Create longitude-periodic low-frequency variation directly on a sphere."""

    rng = np.random.default_rng(seed)
    result = np.zeros_like(longitude, dtype=np.float32)
    weight = 0.0
    for frequency, amplitude in ((1, 0.42), (2, 0.25), (4, 0.16), (7, 0.10), (13, 0.07)):
        phase_a, phase_b = rng.uniform(0, math.tau, 2)
        latitude_frequency = int(rng.integers(1, max(2, frequency + 2)))
        layer = (
            np.sin(longitude * frequency + phase_a)
            * np.cos(latitude * latitude_frequency + phase_b)
        )
        result += layer.astype(np.float32) * amplitude
        weight += amplitude
    return result / max(weight, 1e-6)


def stamp_crater(
    height_map: np.ndarray,
    albedo_detail: np.ndarray,
    centre_lon: float,
    centre_lat: float,
    radius: float,
    depth: float,
    phase: float,
    brightness: float = 1.0,
) -> None:
    """Cut a latitude-corrected irregular crater into a small wrapped patch."""

    centre_x = int((centre_lon + math.pi) / math.tau * WIDTH) % WIDTH
    centre_y = int((math.pi / 2 - centre_lat) / math.pi * HEIGHT)
    latitude_scale = max(0.16, math.cos(centre_lat))
    half_x = max(3, int(math.ceil(radius * 1.38 / math.tau * WIDTH / latitude_scale)))
    half_y = max(3, int(math.ceil(radius * 1.38 / math.pi * HEIGHT)))
    x_offsets = np.arange(-half_x, half_x + 1)
    y_indices = np.arange(max(0, centre_y - half_y), min(HEIGHT, centre_y + half_y + 1))
    x_indices = (centre_x + x_offsets) % WIDTH
    dx = x_offsets[None, :] * math.tau / WIDTH * latitude_scale
    dy = (y_indices[:, None] - centre_y) * math.pi / HEIGHT
    angular_distance = np.sqrt(dx * dx + dy * dy)
    bearing = np.arctan2(dx, -dy)
    irregularity = 1.0 + 0.055 * np.sin(bearing * 5 + phase) + 0.025 * np.sin(bearing * 9 - phase * 0.7)
    q = angular_distance / np.maximum(radius * irregularity, 1e-6)
    active = q < 1.34
    bowl = np.where(q < 1.0, -depth * np.power(np.maximum(0.0, 1.0 - q * q), 1.55), 0.0)
    rim = depth * 0.58 * np.exp(-np.square((q - 0.98) / 0.105))
    ejecta = depth * 0.11 * np.exp(-np.maximum(0.0, q - 1.0) * 5.4)
    height_patch = np.where(active, bowl + rim + ejecta, 0.0).astype(np.float32)
    albedo_patch = np.where(
        active,
        -np.clip(1.0 - q, 0.0, 1.0) * depth * 8.2
        + rim * 12.0 * brightness
        + ejecta * 3.0 * brightness,
        0.0,
    ).astype(np.float32)
    height_map[np.ix_(y_indices, x_indices)] += height_patch
    albedo_detail[np.ix_(y_indices, x_indices)] += albedo_patch


def make_global_maps(source: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Convert one observed disk into a seamless, physically useful globe."""

    rgb = np.asarray(source.convert("RGB"), dtype=np.float32) / 255.0
    centre_x, centre_y, radius = locate_disk(rgb)

    # Use the well-resolved interior only. Removing a broad blur strips baked
    # illumination and limb shading, leaving the photograph's local terrain.
    half = max(48, int(radius * 0.67))
    x0 = max(0, int(centre_x) - half)
    y0 = max(0, int(centre_y) - half)
    x1 = min(rgb.shape[1], int(centre_x) + half)
    y1 = min(rgb.shape[0], int(centre_y) + half)
    patch = rgb[y0:y1, x0:x1].mean(axis=2)
    patch_image = Image.fromarray(np.uint8(np.clip(patch, 0, 1) * 255), mode="L")
    # A tight high-pass keeps genuine granular crater texture but rejects the
    # photograph's broad fan-shaped lighting, which would become a repeated
    # kaleidoscope if treated as world geography.
    broad = np.asarray(patch_image.filter(ImageFilter.GaussianBlur(2.8)), dtype=np.float32) / 255.0
    fine = np.asarray(patch_image.filter(ImageFilter.GaussianBlur(0.75)), dtype=np.float32) / 255.0
    source_detail = np.clip((fine - broad) / max(0.025, float(np.std(fine - broad)) * 4.0), -1.0, 1.0)
    image_detail = repeat_mirrored(source_detail, WIDTH, HEIGHT, (97, 53))

    x = np.linspace(-math.pi, math.pi, WIDTH, endpoint=False, dtype=np.float32)
    y = np.linspace(math.pi / 2, -math.pi / 2, HEIGHT, dtype=np.float32)
    longitude, latitude = np.meshgrid(x, y)
    broad_noise = harmonic_noise(longitude, latitude, 1702)
    fine_noise = harmonic_noise(longitude * 3.0, latitude * 3.0, 6241)

    height_map = broad_noise * 0.010 + fine_noise * 0.0045 + image_detail * 0.0018
    albedo_detail = broad_noise * 0.060 + fine_noise * 0.038 + image_detail * 0.026

    rng = np.random.default_rng(1986)
    crater_specs: list[tuple[int, tuple[float, float], tuple[float, float]]] = [
        (16, (0.065, 0.135), (0.0028, 0.0070)),
        (64, (0.026, 0.070), (0.0012, 0.0036)),
        (190, (0.008, 0.030), (0.00045, 0.0017)),
    ]
    for count, radius_range, depth_range in crater_specs:
        for _ in range(count):
            stamp_crater(
                height_map,
                albedo_detail,
                float(rng.uniform(-math.pi, math.pi)),
                float(math.asin(rng.uniform(-0.96, 0.96))),
                float(rng.uniform(*radius_range)),
                float(rng.uniform(*depth_range)),
                float(rng.uniform(0, math.tau)),
                float(rng.uniform(0.72, 1.18)),
            )

    # Wunda is Umbriel's unusually bright ring. It is kept modest in scale so
    # it reads as one named feature rather than a cartoon target decal.
    stamp_crater(
        height_map,
        albedo_detail,
        centre_lon=-0.68,
        centre_lat=-0.22,
        radius=0.075,
        depth=0.0048,
        phase=1.7,
        brightness=1.85,
    )

    # Collapse variation smoothly at the exact poles; this removes UV pinching
    # without erasing high-latitude terrain.
    polar_blend = np.power(np.clip((np.abs(latitude) - 1.35) / 0.22, 0.0, 1.0), 2.0)
    row_mean_height = height_map.mean(axis=1, keepdims=True)
    row_mean_albedo = albedo_detail.mean(axis=1, keepdims=True)
    height_map = height_map * (1.0 - polar_blend) + row_mean_height * polar_blend
    albedo_detail = albedo_detail * (1.0 - polar_blend) + row_mean_albedo * polar_blend

    # Umbriel is the darkest major Uranian moon. Keep the map neutral and
    # restrained so brightness comes from the scene's Sun, not baked-in glare.
    tone = np.clip(0.31 + albedo_detail, 0.105, 0.59)
    albedo = np.stack((tone * 0.94, tone * 0.975, tone), axis=2)

    centred_height = height_map - float(np.median(height_map))
    scale = max(0.006, float(np.percentile(np.abs(centred_height), 99.3)))
    relief = np.clip(0.5 + centred_height / scale * 0.45, 0.0, 1.0)
    roughness = np.clip(0.965 - np.abs(centred_height) / scale * 0.055 - image_detail * 0.015, 0.86, 1.0)
    return albedo, relief, roughness


def prepare_generated_global_map(source: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Grade a generated 2:1 map and derive lighting-responsive material data."""

    image = source.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    albedo = np.asarray(image, dtype=np.float32) / 255.0

    # Force the exact longitude boundary to a shared value, then dissolve that
    # correction across a narrow strip. This protects the sphere from a visible
    # vertical seam even if the generator's edge pixels differ slightly.
    original_edges = albedo.copy()
    # Pair corresponding pixels from the two longitude edges. Unlike filling
    # the strip from one row-average colour, this preserves craters and grain
    # all the way through the blend and therefore cannot form a smooth band.
    edge_width = 48
    for index in range(edge_width):
        t = index / max(1, edge_width - 1)
        weight = t * t * (3.0 - 2.0 * t)
        paired = (original_edges[:, index] + original_edges[:, -1 - index]) * 0.5
        albedo[:, index] = paired * (1.0 - weight) + original_edges[:, index] * weight
        albedo[:, -1 - index] = paired * (1.0 - weight) + original_edges[:, -1 - index] * weight

    # A pole collapses to one vertex, so its final rows must approach one mean
    # colour instead of carrying a horizontally stretched terrain strip.
    pole_width = 42
    for index in range(pole_width):
        weight = (index / max(1, pole_width - 1)) ** 2
        for row in (index, HEIGHT - 1 - index):
            row_mean = albedo[row].mean(axis=0)
            albedo[row] = row_mean * (1.0 - weight) + albedo[row] * weight

    # Match Umbriel's low visual albedo while retaining the generated map's
    # authentic fine contrast and restrained cool-neutral balance.
    mean_luminance = float(albedo.mean())
    albedo *= 0.34 / max(mean_luminance, 1e-5)
    albedo = np.clip(albedo, 0.075, 0.68)

    luminance = albedo.mean(axis=2)
    luma_image = Image.fromarray(np.uint8(luminance / max(float(luminance.max()), 1e-5) * 255), mode="L")
    fine = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0
    medium = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(5.5)), dtype=np.float32) / 255.0
    broad = np.asarray(luma_image.filter(ImageFilter.GaussianBlur(22.0)), dtype=np.float32) / 255.0
    local_relief = (fine - medium) * 1.6 + (medium - broad) * 0.62
    scale = max(0.025, float(np.percentile(np.abs(local_relief), 99.6)))
    relief = np.clip(0.5 + local_relief / scale * 0.44, 0.0, 1.0)
    roughness = np.clip(0.95 - np.abs(local_relief) / scale * 0.07, 0.84, 0.99)
    return albedo, relief, roughness


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="User-supplied Umbriel disk image")
    parser.add_argument("output", type=Path, help="major-moons texture directory")
    parser.add_argument(
        "--generated-albedo",
        type=Path,
        help="Optional seamless 2:1 reconstruction used instead of local synthesis",
    )
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.source, args.output / "umbriel-source-reference.png")
    if args.generated_albedo:
        albedo, height, roughness = prepare_generated_global_map(Image.open(args.generated_albedo))
    else:
        albedo, height, roughness = make_global_maps(Image.open(args.source))

    Image.fromarray(np.uint8(np.clip(albedo, 0, 1) * 255), mode="RGB").save(
        args.output / "umbriel-albedo-v4.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(height * 255), mode="L").save(
        args.output / "umbriel-height-v4.jpg", quality=95, optimize=True,
    )
    Image.fromarray(np.uint8(roughness * 255), mode="L").save(
        args.output / "umbriel-roughness-v4.jpg", quality=94, optimize=True,
    )


if __name__ == "__main__":
    main()

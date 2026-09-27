"""
Encodes the raw maps written by build-binary-maps.mjs into the files the
scene loads, and prints the SMALL_BODY_TEXTURES lines.

  python encode-binary-maps.py <raw folder> <textures folder>

Colour maps as JPEG (quality 90, as every other small-body map). Normal maps
as PNG: JPEG's 8x8 blocks show up as a faint grid in the lighting, which a
colour map hides and a normal map does not. meanLinear is measured on the
saved JPEG, as for every other body, so the albedo still sets the brightness.
"""
import json
import sys
import numpy as np
from PIL import Image

raw, out = sys.argv[1], sys.argv[2]
manifest = json.load(open(f"{raw}/manifest.json"))


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


for file, m in manifest.items():
    w, h = m["width"], m["height"]
    albedo = np.fromfile(f"{raw}/{file}.albedo.raw", dtype=np.uint8).reshape(h, w, 4)[..., :3]
    normal = np.fromfile(f"{raw}/{file}.normal.raw", dtype=np.uint8).reshape(h, w, 4)[..., :3]
    Image.fromarray(albedo).save(f"{out}/{file}.jpg", quality=90, optimize=True)
    Image.fromarray(normal).save(f"{out}/{file}-normal.png", optimize=True)
    saved = np.asarray(Image.open(f"{out}/{file}.jpg").convert("RGB")).astype(np.float64) / 255
    ml = float((to_linear(saved) @ [0.2126, 0.7152, 0.0722]).mean())
    key = m["body"] if m["body"].isidentifier() else json.dumps(m["body"], ensure_ascii=False)
    print(f'  {key}: {{ file: "{file}", meanLinear: {ml:.4f}, normal: "{file}-normal" }},')

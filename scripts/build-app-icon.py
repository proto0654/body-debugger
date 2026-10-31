"""Build the application icon from the default character's happy emotion.

The icon is a dark rounded tile with a soft emerald glow and the Desk Hulk
"happy" bust, matching the tray brand colour. The same artwork is exported as a
1024 px PNG master and a multi-size Windows ICO (16-256 px).

Requires Pillow (`pip install pillow`).
Run from the repository root: `python scripts/build-app-icon.py`
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "assets" / "character" / "desk-hulk" / "frames" / "emotion-happy-average.png"
OUT_DIR = ROOT / "electron" / "resources"

SIZE = 1024
SUPERSAMPLE = 4
CORNER_RADIUS = 232
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

BG_TOP = (15, 23, 42)
BG_BOTTOM = (2, 6, 23)
EMERALD = (52, 211, 153)


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    t = np.linspace(0.0, 1.0, size, dtype=np.float32)[:, None, None]
    top_arr = np.array(top, dtype=np.float32)
    bottom_arr = np.array(bottom, dtype=np.float32)
    rows = (top_arr * (1.0 - t) + bottom_arr * t).astype(np.uint8)
    return Image.fromarray(np.repeat(rows, size, axis=1), "RGB").convert("RGBA")


def emerald_glow(size: int) -> Image.Image:
    """Soft light behind the character so the dark tile does not look flat."""
    coords = np.mgrid[0:size, 0:size].astype(np.float32)
    cx, cy = size * 0.5, size * 0.56
    radius = size * 0.52
    distance = np.sqrt((coords[1] - cx) ** 2 + (coords[0] - cy) ** 2) / radius
    alpha = np.clip(1.0 - distance, 0.0, 1.0) ** 2.4 * 88.0
    glow = np.zeros((size, size, 4), dtype=np.uint8)
    glow[..., 0], glow[..., 1], glow[..., 2] = EMERALD
    glow[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(glow, "RGBA")


def rounded_mask(size: int) -> Image.Image:
    big = Image.new("L", (size * SUPERSAMPLE, size * SUPERSAMPLE), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        [0, 0, size * SUPERSAMPLE - 1, size * SUPERSAMPLE - 1],
        radius=CORNER_RADIUS * SUPERSAMPLE,
        fill=255,
    )
    return big.resize((size, size), Image.Resampling.LANCZOS)


def character_layer(size: int) -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    bbox = source.getbbox()
    if bbox:
        source = source.crop(bbox)

    target_height = int(size * 0.82)
    scale = target_height / source.height
    resized = source.resize(
        (max(1, round(source.width * scale)), target_height), Image.Resampling.LANCZOS
    )

    resized = fade_bottom(resized, ratio=0.16)

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    left = (size - resized.width) // 2
    top = size - resized.height - int(size * 0.075)
    layer.paste(resized, (left, top), resized)
    return layer


def fade_bottom(layer: Image.Image, ratio: float) -> Image.Image:
    """Dissolve the cropped bust into the tile instead of ending on a hard edge."""
    pixels = np.array(layer)
    height = pixels.shape[0]
    fade_start = int(height * (1.0 - ratio))
    ramp = np.linspace(1.0, 0.0, height - fade_start, dtype=np.float32)[:, None]
    pixels[fade_start:, :, 3] = (pixels[fade_start:, :, 3] * ramp).astype(np.uint8)
    return Image.fromarray(pixels, "RGBA")


def build() -> Image.Image:
    canvas = vertical_gradient(SIZE, BG_TOP, BG_BOTTOM)
    canvas.alpha_composite(emerald_glow(SIZE))
    canvas.alpha_composite(character_layer(SIZE))

    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        [18, 18, SIZE - 19, SIZE - 19],
        radius=CORNER_RADIUS - 18,
        outline=(*EMERALD, 84),
        width=10,
    )
    canvas.alpha_composite(ring)
    canvas.putalpha(rounded_mask(SIZE))
    return canvas


def main() -> None:
    icon = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png_path = OUT_DIR / "icon.png"
    ico_path = OUT_DIR / "icon.ico"
    icon.save(png_path, "PNG", optimize=True)
    icon.save(ico_path, "ICO", sizes=ICO_SIZES)
    print(f"wrote {png_path.relative_to(ROOT)} ({icon.width}x{icon.height})")
    print(f"wrote {ico_path.relative_to(ROOT)} ({len(ICO_SIZES)} sizes)")


if __name__ == "__main__":
    main()

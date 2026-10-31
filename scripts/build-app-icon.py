"""Build the application icons from the default character's happy emotion.

Two variants share the same artwork but are distinguishable at executable,
shortcut and taskbar size:

    prod  dark tile with an emerald glow/ring
    dev   dark tile with an amber glow/ring and a small "DEV" tag

Each variant is exported as a 1024 px PNG master and a multi-size Windows ICO
(16-256 px): icon.png / icon.ico and icon-dev.png / icon-dev.ico.

Requires Pillow (`pip install pillow`).
Run from the repository root: `python scripts/build-app-icon.py`
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

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
AMBER = (245, 158, 11)

VARIANTS = {
    "prod": {"accent": EMERALD, "badge": None},
    "dev": {"accent": AMBER, "badge": "DEV"},
}


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    t = np.linspace(0.0, 1.0, size, dtype=np.float32)[:, None, None]
    top_arr = np.array(top, dtype=np.float32)
    bottom_arr = np.array(bottom, dtype=np.float32)
    rows = (top_arr * (1.0 - t) + bottom_arr * t).astype(np.uint8)
    return Image.fromarray(np.repeat(rows, size, axis=1), "RGB").convert("RGBA")


def accent_glow(size: int, accent: tuple[int, int, int]) -> Image.Image:
    """Soft light behind the character so the dark tile does not look flat."""
    coords = np.mgrid[0:size, 0:size].astype(np.float32)
    cx, cy = size * 0.5, size * 0.56
    radius = size * 0.52
    distance = np.sqrt((coords[1] - cx) ** 2 + (coords[0] - cy) ** 2) / radius
    alpha = np.clip(1.0 - distance, 0.0, 1.0) ** 2.4 * 88.0
    glow = np.zeros((size, size, 4), dtype=np.uint8)
    glow[..., 0], glow[..., 1], glow[..., 2] = accent
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


def badge_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("arialbd.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def dev_badge(size: int, accent: tuple[int, int, int]) -> Image.Image:
    """A small high-contrast tag; the amber ring still distinguishes 16 px icons."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    tag_w = int(size * 0.27)
    tag_h = int(size * 0.135)
    margin = int(size * 0.055)
    x0 = size - tag_w - margin
    y0 = size - tag_h - margin
    draw.rounded_rectangle(
        [x0, y0, x0 + tag_w, y0 + tag_h],
        radius=tag_h // 2,
        fill=(2, 6, 23, 238),
        outline=(*accent, 225),
        width=max(2, size // 256),
    )

    font = badge_font(int(tag_h * 0.56))
    text = "DEV"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    draw.text(
        (x0 + (tag_w - text_w) / 2 - bbox[0], y0 + (tag_h - text_h) / 2 - bbox[1]),
        text,
        fill=(*accent, 255),
        font=font,
    )
    return layer


def build(variant: str) -> Image.Image:
    config = VARIANTS[variant]
    accent: tuple[int, int, int] = config["accent"]
    badge: str | None = config["badge"]

    canvas = vertical_gradient(SIZE, BG_TOP, BG_BOTTOM)
    canvas.alpha_composite(accent_glow(SIZE, accent))
    canvas.alpha_composite(character_layer(SIZE))
    if badge:
        canvas.alpha_composite(dev_badge(SIZE, accent))

    ring = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        [18, 18, SIZE - 19, SIZE - 19],
        radius=CORNER_RADIUS - 18,
        outline=(*accent, 84),
        width=10,
    )
    canvas.alpha_composite(ring)
    canvas.putalpha(rounded_mask(SIZE))
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for variant in VARIANTS:
        icon = build(variant)
        suffix = "" if variant == "prod" else "-dev"
        png_path = OUT_DIR / f"icon{suffix}.png"
        ico_path = OUT_DIR / f"icon{suffix}.ico"
        icon.save(png_path, "PNG", optimize=True)
        icon.save(ico_path, "ICO", sizes=ICO_SIZES)
        print(f"wrote {png_path.relative_to(ROOT)} ({icon.width}x{icon.height})")
        print(f"wrote {ico_path.relative_to(ROOT)} ({len(ICO_SIZES)} sizes)")


if __name__ == "__main__":
    main()

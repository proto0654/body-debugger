"""Build the tray icon frames (CONCEPT.md §13) from a vector-like glyph.

The tray icon is a small "person stretching" pictogram drawn from primitives and
re-coloured per state:

    idle     static emerald mark
    soon     soft pulse
    standup  strong pulse + slight sway
    success  short jump + mint flash
    streak   mint glow pulse

Every frame is a 32×32 PNG; Windows scales it down for the 16 px notification
area (and uses it natively on HiDPI).

Requires Pillow (`pip install pillow`).
Run from the repository root: `python scripts/build-tray-icons.py`
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "electron" / "resources" / "tray"

SUPERSAMPLE = 8
SIZE = 32
CANVAS = SIZE * SUPERSAMPLE

EMERALD = (52, 211, 153)
MINT = (167, 243, 208)


def draw_glyph(color: tuple[int, int, int], dx: float = 0, dy: float = 0) -> Image.Image:
    """A stretching figure: head, torso, raised arms, legs."""
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    unit = CANVAS / SIZE

    def dot(px: float, py: float, radius: float) -> None:
        cx = (px + dx) * unit
        cy = (py + dy) * unit
        r = radius * unit
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, 255))

    def stroke(start: tuple[float, float], end: tuple[float, float], width: float) -> None:
        draw.line(
            [(start[0] + dx) * unit, (start[1] + dy) * unit,
             (end[0] + dx) * unit, (end[1] + dy) * unit],
            fill=(*color, 255),
            width=int(round(width * unit))
        )
        dot(*start, width / 2)
        dot(*end, width / 2)

    stroke((16.0, 9.0), (16.0, 18.5), 3.4)
    stroke((16.0, 10.6), (7.2, 5.2), 2.8)
    stroke((16.0, 10.6), (24.8, 5.2), 2.8)
    stroke((16.0, 18.2), (12.0, 27.0), 3.0)
    stroke((16.0, 18.2), (20.0, 27.0), 3.0)
    dot(16.0, 5.6, 2.5)
    return image


def frame(name: str, color: tuple[int, int, int], alpha: int = 255,
          dx: float = 0, dy: float = 0) -> None:
    glyph = draw_glyph(color, dx, dy)
    if alpha < 255:
        channel = glyph.getchannel("A").point(lambda value: value * alpha // 255)
        glyph.putalpha(channel)
    large = glyph.resize((SIZE, SIZE), Image.LANCZOS)
    large.save(OUT_DIR / f"{name}.png", optimize=True)


def build() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.png"):
        stale.unlink()

    frame("idle-0", EMERALD)
    frame("soon-0", EMERALD)
    frame("soon-1", EMERALD, alpha=165)
    frame("standup-0", EMERALD)
    frame("standup-1", EMERALD, alpha=140, dx=1.0)
    frame("standup-2", EMERALD, alpha=255, dx=-1.0)
    frame("success-0", EMERALD)
    frame("success-1", MINT, dy=-2.0)
    frame("success-2", EMERALD)
    frame("streak-0", MINT)
    frame("streak-1", MINT, alpha=175)

    files = sorted(OUT_DIR.glob("*.png"))
    total = sum(path.stat().st_size for path in files)
    print(f"wrote {len(files)} tray frames to {OUT_DIR.relative_to(ROOT)} ({total // 1024} KiB)")


if __name__ == "__main__":
    build()

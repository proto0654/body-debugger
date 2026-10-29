"""Cut the Desk Hulk sprite sheets into per-frame PNG files.

Source sheets live in `src/assets/character/desk-hulk/` and are 3-column grids
drawn by hand/AI. A fixed equal-grid crop clips figures that spill over the cell
borders, so this script detects figures as connected components of a foreground
mask and then groups them back into the grid.

Output goes to `src/assets/character/desk-hulk/frames/`:

    stage-{stage}-{build}.png    body frame for a stage tier (0, 2 or 4)
    pose-{branch}-{build}.png    branch pose (neutral / power / mobility)
    emotion-{emotion}-{build}.png emotion bust, named by CharacterEmotion

Requires Pillow and NumPy (`pip install pillow numpy`).
Run from the repository root: `python scripts/cut-character-sprites.py`
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
CHARACTER_DIR = ROOT / "src" / "assets" / "character" / "desk-hulk"
OUT_DIR = CHARACTER_DIR / "frames"

LIGHTNESS_THRESHOLD = 52
CHROMA_THRESHOLD = 9
COMPONENT_SCALE = 4
MIN_COMPONENT_AREA = 2_000
# The background is a flat dark grey; dark clothing stays inside this tolerance
# band, so flood fill must stay tight or it bleeds into trousers and hoodies.
BACKGROUND_TOLERANCE = 12


@dataclass(frozen=True)
class Box:
    x0: int
    y0: int
    x1: int
    y1: int

    @property
    def width(self) -> int:
        return self.x1 - self.x0

    @property
    def height(self) -> int:
        return self.y1 - self.y0

    @property
    def center(self) -> tuple[float, float]:
        return (self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2


def foreground_mask(image: Image.Image) -> np.ndarray:
    """Background is a flat dark grey; figures are brighter or more saturated."""
    rgb = np.asarray(image.convert("RGB")).astype(np.int16)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    lightness = rgb.mean(axis=2)
    return (spread > CHROMA_THRESHOLD) | (lightness > LIGHTNESS_THRESHOLD)


def _label_small(mask_small: np.ndarray) -> list[tuple[int, int, int, int]]:
    """4-connected labelling on a downscaled mask via union-find."""
    height, width = mask_small.shape
    parent: dict[int, int] = {}

    def find(node: int) -> int:
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    for y in range(height):
        for x in range(width):
            if not mask_small[y, x]:
                continue
            here = y * width + x
            parent[here] = here
            if x > 0 and mask_small[y, x - 1]:
                union(here, here - 1)
            if y > 0 and mask_small[y - 1, x]:
                union(here, here - width)

    groups: dict[int, list[int]] = {}
    for node in parent:
        groups.setdefault(find(node), []).append(node)

    boxes: list[tuple[int, int, int, int]] = []
    for members in groups.values():
        if len(members) * COMPONENT_SCALE * COMPONENT_SCALE < MIN_COMPONENT_AREA:
            continue
        xs = [node % width for node in members]
        ys = [node // width for node in members]
        boxes.append(
            (
                min(xs) * COMPONENT_SCALE,
                min(ys) * COMPONENT_SCALE,
                (max(xs) + 1) * COMPONENT_SCALE,
                (max(ys) + 1) * COMPONENT_SCALE,
            )
        )
    return boxes


def figure_boxes(mask: np.ndarray) -> list[Box]:
    """Connected figures, with close fragments (hair, headphones) merged."""
    height, width = mask.shape
    small = Image.fromarray(mask.astype(np.uint8) * 255).resize(
        (width // COMPONENT_SCALE, height // COMPONENT_SCALE), Image.BILINEAR
    )
    small = small.point(lambda value: 255 if value > 96 else 0)
    small = small.filter(ImageFilter.MaxFilter(3))
    boxes = [Box(*raw) for raw in _label_small(np.array(small) > 0)]
    return boxes


def _bbox_of(mask: np.ndarray, box: Box) -> Box | None:
    region = mask[box.y0 : box.y1, box.x0 : box.x1]
    rows = np.flatnonzero(region.any(axis=1))
    cols = np.flatnonzero(region.any(axis=0))
    if rows.size == 0 or cols.size == 0:
        return None
    return Box(
        box.x0 + int(cols[0]),
        box.y0 + int(rows[0]),
        box.x0 + int(cols[-1]) + 1,
        box.y0 + int(rows[-1]) + 1,
    )


def split_component(box: Box, mask: np.ndarray) -> list[Box]:
    """Split a component that swallowed two neighbouring figures.

    Figures occasionally touch (a hand, a strand of hair), so the component
    covers two columns. Cut it at the emptiest vertical strip in the middle.
    """
    region = mask[box.y0 : box.y1, box.x0 : box.x1]
    profile = region.sum(axis=0)
    low = int(box.width * 0.35)
    high = int(box.width * 0.65)
    if high <= low:
        return [box]
    cut = low + int(np.argmin(profile[low:high]))

    left = Box(box.x0, box.y0, box.x0 + cut, box.y1)
    right = Box(box.x0 + cut, box.y0, box.x1, box.y1)
    parts = [part for part in (_bbox_of(mask, left), _bbox_of(mask, right)) if part]
    return parts if len(parts) == 2 else [box]


def split_rows(boxes: list[Box]) -> list[list[Box]]:
    """Group figures into rows using the vertical gaps between their centres."""
    ordered = sorted(boxes, key=lambda box: box.center[1])
    median_height = float(np.median([box.height for box in ordered]))
    rows: list[list[Box]] = [[ordered[0]]]
    for box in ordered[1:]:
        if box.center[1] - rows[-1][-1].center[1] > median_height * 0.5:
            rows.append([box])
        else:
            rows[-1].append(box)
    return [sorted(row, key=lambda box: box.center[0]) for row in rows]


def grid_figures(sheet: Image.Image, name: str, rows: int) -> list[list[Box]]:
    """Detect a rows x 3 grid; extra rows (extras, heads) are dropped."""
    mask = foreground_mask(sheet)
    found = figure_boxes(mask)
    if not found:
        raise SystemExit(f"{name}: no figures detected")

    detected = split_rows(found)
    if len(detected) < rows:
        raise SystemExit(f"{name}: expected at least {rows} rows, found {len(detected)}")

    grid: list[list[Box]] = []
    for index, row in enumerate(detected[:rows]):
        row = sorted(row, key=lambda box: box.center[0])
        while len(row) < 3:
            widest = max(row, key=lambda box: box.width)
            parts = split_component(widest, mask)
            if len(parts) != 2:
                raise SystemExit(f"{name}: cannot split row {index} into 3 figures")
            row.remove(widest)
            row.extend(parts)
            row.sort(key=lambda box: box.center[0])
        if len(row) != 3:
            raise SystemExit(f"{name}: row {index} has {len(row)} figures, expected 3")
        grid.append(row)
    return grid


def cut_frame(sheet: Image.Image, box: Box) -> Image.Image:
    """Crop a figure, drop the flat background and trim the transparent border."""
    pad = 4
    left = max(0, box.x0 - pad)
    top = max(0, box.y0 - pad)
    right = min(sheet.width, box.x1 + pad)
    bottom = min(sheet.height, box.y1 + pad)
    cell = sheet.crop((left, top, right, bottom)).convert("RGB")
    width, height = cell.size
    pixels = cell.load()

    border = (
        [pixels[x, 0] for x in range(width)]
        + [pixels[x, height - 1] for x in range(width)]
        + [pixels[0, y] for y in range(height)]
        + [pixels[width - 1, y] for y in range(height)]
    )
    background = tuple(
        sorted(channel[index] for channel in border)[len(border) // 2]
        for index in range(3)
    )

    def is_background(x: int, y: int) -> bool:
        red, green, blue = pixels[x, y]
        return all(
            abs(channel - base) <= BACKGROUND_TOLERANCE
            for channel, base in zip((red, green, blue), background)
        )

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    visited = [[False] * width for _ in range(height)]
    stack = [(x, 0) for x in range(width)] + [(x, height - 1) for x in range(width)]
    stack += [(0, y) for y in range(height)] + [(width - 1, y) for y in range(height)]

    while stack:
        x, y = stack.pop()
        if visited[y][x] or not is_background(x, y):
            continue
        visited[y][x] = True
        alpha_pixels[x, y] = 0
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height and not visited[next_y][next_x]:
                stack.append((next_x, next_y))

    frame = cell.convert("RGBA")
    frame.putalpha(alpha)
    trimmed = frame.getbbox()
    if trimmed:
        frame = frame.crop(trimmed)
    return frame


def build() -> None:
    stages = Image.open(CHARACTER_DIR / "sprite-sheet-stages.png")
    branches = Image.open(CHARACTER_DIR / "sprite-sheet-branches.png")
    emotions = {
        name: Image.open(CHARACTER_DIR / "emotions" / f"emotions-set-{name.rsplit('-', 1)[1]}.png")
        for name in ("set-1", "set-2", "set-3")
    }

    builds = ("lean", "average", "stocky")
    stage_rows = (0, 2, 4)
    branch_columns = ("neutral", "power", "mobility")
    # Source column -> CharacterEmotion. Columns 0/1/2 map to the busts in each
    # emotions sheet (tired / content / focused for set 1, etc.).
    emotion_columns = {
        "set-1": ((0, "tired"), (1, "neutral"), (2, "focused")),
        "set-2": ((1, "happy"),),
        "set-3": ((1, "proud"),),
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.png"):
        stale.unlink()

    written = 0

    stage_grid = grid_figures(stages, "stages", rows=len(stage_rows))
    for row_index, stage in enumerate(stage_rows):
        for column, build in enumerate(builds):
            frame = cut_frame(stages, stage_grid[row_index][column])
            frame.save(OUT_DIR / f"stage-{stage}-{build}.png", optimize=True)
            written += 1

    branch_grid = grid_figures(branches, "branches", rows=len(builds))
    for row_index, build in enumerate(builds):
        for column, branch in enumerate(branch_columns):
            frame = cut_frame(branches, branch_grid[row_index][column])
            frame.save(OUT_DIR / f"pose-{branch}-{build}.png", optimize=True)
            written += 1

    for set_name, columns in emotion_columns.items():
        sheet = emotions[set_name]
        grid = grid_figures(sheet, set_name, rows=len(builds))
        for row_index, build in enumerate(builds):
            for column, emotion in columns:
                frame = cut_frame(sheet, grid[row_index][column])
                frame.save(OUT_DIR / f"emotion-{emotion}-{build}.png", optimize=True)
                written += 1

    total_bytes = sum(path.stat().st_size for path in OUT_DIR.glob("*.png"))
    print(f"wrote {written} frames to {OUT_DIR.relative_to(ROOT)} ({total_bytes // 1024} KiB)")


if __name__ == "__main__":
    try:
        build()
    except KeyboardInterrupt:
        sys.exit(130)

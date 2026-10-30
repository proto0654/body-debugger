"""Cut the Desk Hulk sprite sheets into per-frame PNG files.

Source sheets live in `src/assets/character/desk-hulk/` and are 3-column grids
drawn by hand/AI. A fixed equal-grid crop clips figures that spill over the cell
borders, so this script detects figures as connected components of a foreground
mask and then groups them back into the grid.

Output goes to `src/assets/character/desk-hulk/frames/`:

    stage-{stage}-{build}.png    body frame for a stage tier (0, 2 or 4)
    pose-{branch}-{build}.png    branch pose (neutral / power / mobility)
    emotion-{emotion}-{build}.png emotion bust, named by CharacterEmotion
    neglect-{level}-{build}.png temporary condition (levels 1, 2 or 3)

Requires Pillow and NumPy (`pip install pillow numpy`).
Run from the repository root: `python scripts/cut-character-sprites.py`
Use `--packs` to cut all nine additional characters (48 frames each), or
`--packs alt-girl punk` to rebuild selected packs from packs.json.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

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


def _label_small(mask_small: np.ndarray, scale: int = COMPONENT_SCALE) -> list[tuple[int, int, int, int]]:
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
        if len(members) * scale * scale < MIN_COMPONENT_AREA:
            continue
        xs = [node % width for node in members]
        ys = [node // width for node in members]
        boxes.append(
            (
                min(xs) * scale,
                min(ys) * scale,
                (max(xs) + 1) * scale,
                (max(ys) + 1) * scale,
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


def grid_figures(sheet: Image.Image, name: str, rows: int, *, transparent: bool = False) -> list[list[Box]]:
    """Detect a rows x 3 grid; extra rows (extras, heads) are dropped."""
    mask = np.asarray(sheet.getchannel("A")) > 32 if transparent else foreground_mask(sheet)
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


def cut_frame(sheet: Image.Image, box: Box, *, preserve_alpha: bool = False) -> Image.Image:
    """Crop a figure, drop the flat background and trim the transparent border."""
    pad = 4
    left = max(0, box.x0 - pad)
    top = max(0, box.y0 - pad)
    right = min(sheet.width, box.x1 + pad)
    bottom = min(sheet.height, box.y1 + pad)
    if preserve_alpha:
        # Preserve the generated alpha, including antialiased edges.
        return sheet.crop((left, top, right, bottom))
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
    neglect = Image.open(CHARACTER_DIR / "sprite-sheet-neglect.png")
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

    neglect_grid = grid_figures(neglect, "neglect", rows=3, transparent=True)
    for row_index, row in enumerate(neglect_grid):
        for column, build in enumerate(builds):
            frame = cut_frame(neglect, row[column], preserve_alpha=True)
            frame.save(OUT_DIR / f"neglect-{row_index + 1}-{build}.png", optimize=True)
            written += 1

    total_bytes = sum(path.stat().st_size for path in OUT_DIR.glob("*.png"))
    print(f"wrote {written} frames to {OUT_DIR.relative_to(ROOT)} ({total_bytes // 1024} KiB)")


def pack_grid(sheet: Image.Image, rows: int, columns: int) -> list[list[Box]]:
    """Find authored-alpha sprites without dilation joining neighbouring rows."""
    if sheet.mode != "RGBA" or sheet.getchannel("A").getextrema()[0] != 0:
        raise ValueError("Pack sheets must contain a transparent RGBA background")
    for scale in (COMPONENT_SCALE, 2, 1):
        alpha = sheet.getchannel("A").resize(
            (sheet.width // scale, sheet.height // scale), Image.Resampling.BOX
        )
        boxes = [Box(*raw) for raw in _label_small(np.asarray(alpha) > 128, scale)]
        if len(boxes) == rows * columns:
            break
    mask = np.asarray(sheet.getchannel("A")) > 128
    while boxes and len(boxes) < rows * columns:
        tallest = max(boxes, key=lambda box: box.height)
        median_height = float(np.median([box.height for box in boxes]))
        if tallest.height < median_height * 1.25:
            break
        region = mask[tallest.y0 : tallest.y1, tallest.x0 : tallest.x1]
        profile = region.sum(axis=1)
        low, high = int(tallest.height * 0.3), int(tallest.height * 0.7)
        cut = low + int(np.argmin(profile[low:high]))
        # Generated antialiasing can create a tiny bridge between two rows.
        # Split only an unusually tall component with a near-empty waist.
        if profile[cut] > max(4, tallest.width * 0.12):
            break
        top = Box(tallest.x0, tallest.y0, tallest.x1, tallest.y0 + cut)
        bottom = Box(tallest.x0, tallest.y0 + cut, tallest.x1, tallest.y1)
        if any(mask[part.y0 : part.y1, part.x0 : part.x1].sum() < MIN_COMPONENT_AREA
               for part in (top, bottom)):
            break
        parts = [_bbox_of(mask, part) for part in (top, bottom)]
        if not all(parts):
            break
        boxes.remove(tallest)
        boxes.extend(part for part in parts if part)
    if len(boxes) != rows * columns:
        raise ValueError(f"Expected {rows * columns} sprites, detected {len(boxes)}")
    # Each row has exactly four figures; sorting their centres handles sheets
    # whose body rows are taller than their portrait rows.
    ordered = sorted(boxes, key=lambda box: box.center[1])
    return [sorted(ordered[row * columns : (row + 1) * columns], key=lambda box: box.center[0])
            for row in range(rows)]


def cut_pack_frame(sheet: Image.Image, box: Box) -> Image.Image:
    """Isolate the selected connected figure so a neighbour cannot leak into its crop."""
    frame = cut_frame(sheet, box, preserve_alpha=True)
    alpha = np.asarray(frame.getchannel("A"))
    mask = Image.fromarray(np.where(alpha > 128, 255, 0).astype(np.uint8)).copy()
    points = np.argwhere(alpha > 128)
    center = np.array([frame.height / 2, frame.width / 2])
    seed_y, seed_x = points[np.argmin(((points - center) ** 2).sum(axis=1))]
    ImageDraw.floodfill(mask, (int(seed_x), int(seed_y)), 128)
    selected = Image.fromarray(np.where(np.asarray(mask) == 128, 255, 0).astype(np.uint8))
    # Restore low-alpha antialiased edges around the isolated figure.
    selected = selected.filter(ImageFilter.MaxFilter(7))
    frame.putalpha(Image.fromarray(np.where(np.asarray(selected) > 0, alpha, 0).astype(np.uint8)))
    bounds = frame.getbbox()
    if not bounds:
        raise ValueError("An extracted sprite is empty")
    return frame.crop(bounds)


def build_packs(pack_ids: list[str] | None = None) -> None:
    """Build the approved cast, retaining distinct art for all three builds."""
    root = CHARACTER_DIR.parent
    manifest = json.loads((root / "packs.json").read_text(encoding="utf-8"))
    unknown = set(pack_ids or []) - {pack["id"] for pack in manifest["packs"]}
    if unknown:
        raise ValueError(f"Unknown character packs: {', '.join(sorted(unknown))}")
    written = 0
    for pack in manifest["packs"]:
        if pack_ids and pack["id"] not in pack_ids:
            continue
        pack_dir = root / pack["id"]
        prepared: dict[str, Image.Image] = {}
        for file_name, builds in pack.get("sheets", manifest["sheets"]).items():
            with Image.open(pack_dir / file_name) as sheet:
                rows = manifest["rowsPerBuild"] * len(builds)
                grid = pack_grid(sheet, rows, manifest["columns"])
                cells = [box for row in grid for box in row]
                for build_index, build in enumerate(builds):
                    for index, frame_key in enumerate(manifest["frames"]):
                        cell = cells[build_index * len(manifest["frames"]) + index]
                        prepared[f"{frame_key}-{build}.png"] = cut_pack_frame(sheet, cell)
        for frame_key, file_name in pack.get("overrides", {}).items():
            name = f"{frame_key}.png"
            if name not in prepared:
                raise ValueError(f"Unknown override frame: {frame_key}")
            with Image.open(pack_dir / file_name) as sheet:
                frame = cut_pack_frame(sheet, pack_grid(sheet, 1, 1)[0][0])
                frame.thumbnail((512, 512), Image.Resampling.LANCZOS)
                prepared[name] = frame
        # Validate and cut the complete pack before writing any output.
        output = pack_dir / "frames"
        output.mkdir(parents=True, exist_ok=True)
        for name, frame in prepared.items():
            frame.save(output / name, optimize=True)
            written += 1
        print(f"{pack['id']}: wrote {len(prepared)} frames")
    print(f"wrote {written} pack frames")
    preview_pack_builds(root, manifest)


def preview_pack_builds(root: Path, manifest: dict) -> None:
    """Compose real output frames side by side for a build/identity art review."""
    builds = ("lean", "average", "stocky")
    paths = [root / pack["id"] / "frames" / f"stage-5-{build}.png"
             for pack in manifest["packs"] for build in builds]
    if not all(path.exists() for path in paths):
        print("preview deferred until every pack has been cut")
        return

    def font(size: int) -> ImageFont.ImageFont:
        for name in ("arial.ttf", "DejaVuSans.ttf"):
            try:
                return ImageFont.truetype(name, size)
            except OSError:
                continue
        return ImageFont.load_default(size=size)

    canvas = Image.new("RGBA", (1440, 1400), (17, 24, 39, 255))
    draw = ImageDraw.Draw(canvas)
    title_font, label_font, build_font = font(34), font(25), font(16)
    draw.text((36, 24), "BODY DEBUGGER / 9 ПЕРСОНАЖЕЙ × 3 БИЛДА", font=title_font, fill="#f8fafc")
    for index, pack in enumerate(manifest["packs"]):
        x, y = 24 + (index % 3) * 472, 90 + (index // 3) * 428
        draw.rounded_rectangle((x, y, x + 448, y + 404), radius=18, fill="#1e293b")
        draw.text((x + 20, y + 15), pack["label"], font=label_font, fill="#e2e8f0")
        for column, (build, label) in enumerate(zip(builds, ("Худой", "Обычный", "Плотный"))):
            with Image.open(root / pack["id"] / "frames" / f"stage-5-{build}.png") as source:
                frame = source.copy()
            frame.thumbnail((136, 306), Image.Resampling.LANCZOS)
            left = x + 9 + column * 144 + (136 - frame.width) // 2
            canvas.alpha_composite(frame, (left, y + 62 + 306 - frame.height))
            draw.text((x + 77 + column * 144, y + 378), label, anchor="mm", font=build_font, fill="#94a3b8")
    path = root / "character-builds-preview.png"
    canvas.convert("RGB").save(path, optimize=True)
    print(f"preview: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--packs":
            build_packs(sys.argv[2:] or None)
        elif not sys.argv[1:]:
            build()
        else:
            raise SystemExit("Usage: python scripts/cut-character-sprites.py [--packs [pack-id ...]]")
    except KeyboardInterrupt:
        sys.exit(130)

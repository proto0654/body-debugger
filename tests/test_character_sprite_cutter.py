"""Optional source-art tooling tests: python -m unittest discover -s tests -p 'test_*.py'."""
import runpy
import json
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

MODULE = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/cut-character-sprites.py"))


class CharacterSpriteCutterTests(unittest.TestCase):
    def test_shipped_frames_have_real_transparency_and_visible_artwork(self):
        root = Path(__file__).resolve().parents[1] / "src/assets/character"
        manifest = json.loads((root / "packs.json").read_text(encoding="utf-8"))
        checked = 0
        for pack in manifest["packs"]:
            for path in (root / pack["id"] / "frames").glob("*.png"):
                with self.subTest(frame=str(path)), Image.open(path) as frame:
                    self.assertEqual(frame.mode, "RGBA")
                    low, high = frame.getchannel("A").getextrema()
                    self.assertEqual(low, 0)
                    self.assertGreaterEqual(high, 200)
                    self.assertIsNotNone(frame.getbbox())
                    checked += 1
        self.assertEqual(checked, 432)

    def test_rejects_missing_figures_and_opaque_background(self):
        with self.assertRaisesRegex(ValueError, "transparent RGBA"):
            MODULE["pack_grid"](Image.new("RGBA", (200, 200), "white"), 1, 1)
        with self.assertRaisesRegex(ValueError, "Expected 1 sprites"):
            MODULE["pack_grid"](Image.new("RGBA", (200, 200)), 1, 1)

    def test_orders_unequal_height_rows_without_equal_grid_clipping(self):
        sheet = Image.new("RGBA", (400, 400))
        draw = ImageDraw.Draw(sheet)
        for x in [15, 115, 215, 315]:
            draw.rectangle((x, 10, x + 65, 245), fill=(40, 90, 120, 254))
            draw.rectangle((x, 280, x + 65, 380), fill=(40, 90, 120, 254))
        rows = MODULE["pack_grid"](sheet, 2, 4)
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(box.y1 < 260 for box in rows[0]))
        self.assertTrue(all(box.y0 > 270 for box in rows[1]))
        self.assertEqual([box.x0 for box in rows[0]], sorted(box.x0 for box in rows[0]))

    def test_crop_excludes_neighbour_fragments_and_preserves_authored_alpha(self):
        sheet = Image.new("RGBA", (120, 150))
        draw = ImageDraw.Draw(sheet)
        draw.rectangle((30, 30, 85, 105), fill=(40, 90, 120, 220))
        draw.rectangle((32, 28, 83, 29), fill=(40, 90, 120, 80))
        draw.rectangle((30, 111, 85, 119), fill=(255, 0, 0, 255))
        frame = MODULE["cut_pack_frame"](sheet, MODULE["Box"](28, 28, 88, 110))
        pixels = np.asarray(frame)
        self.assertEqual(frame.getchannel("A").getextrema(), (0, 220))
        self.assertTrue((pixels[:, :, 3] == 80).any())
        self.assertFalse(((pixels[:, :, 0] == 255) & (pixels[:, :, 3] > 0)).any())

    def test_separates_neighbouring_rows_joined_by_a_tiny_alpha_bridge(self):
        sheet = Image.new("RGBA", (200, 320))
        draw = ImageDraw.Draw(sheet)
        for x in (20, 120):
            draw.rectangle((x, 10, x + 55, 135), fill=(30, 80, 120, 254))
            draw.rectangle((x, 175, x + 55, 300), fill=(30, 80, 120, 254))
        draw.line((45, 135, 45, 175), fill=(30, 80, 120, 254), width=1)
        rows = MODULE["pack_grid"](sheet, 2, 2)
        self.assertEqual([len(row) for row in rows], [2, 2])
        self.assertTrue(all(box.center[1] < 160 for box in rows[0]))
        self.assertTrue(all(box.center[1] > 160 for box in rows[1]))


if __name__ == "__main__":
    unittest.main()

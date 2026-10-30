"""Audio tooling checks: python -m unittest discover -s tests -p test_audio_batch_cutter.py."""
from array import array
from pathlib import Path
import runpy
import unittest

MODULE = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/cut-audio-batch.py"))


class AudioBatchCutterTests(unittest.TestCase):
    def test_rejects_unbounded_silence_settings_before_reading_files(self):
        for value in (float("nan"), float("inf"), 0, 0.19, 5.1):
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "Minimum silence"):
                MODULE["process_batch"](Path("missing.mp3"), "engineer", [], "pilot", 1, value)

    def test_splits_long_separators_and_ignores_leading_and_trailing_silence(self):
        self.assertEqual(MODULE["split_regions"](9, [(0, 1), (3, 4), (6, 7), (8, 9)], 3),
                         [(1, 3), (4, 6), (7, 8)])

    def test_rejects_missing_extra_unordered_and_nonfinite_boundaries(self):
        cases = [(9, [(3, 4)], 3), (9, [(2, 3), (4, 5)], 2),
                 (9, [(4, 5), (3, 4)], 3), (9, [(2, float("nan"))], 2),
                 (9, [(2, 12)], 2), (float("inf"), [], 1)]
        for duration, silences, count in cases:
            with self.subTest(silences=silences), self.assertRaises(ValueError):
                MODULE["split_regions"](duration, silences, count)

    def test_trims_outer_quiet_samples_preserving_internal_pause_and_edge_padding(self):
        samples = array("h", [0] * 100 + [500] * 100 + [0] * 300 + [500] * 100 + [0] * 100)
        start, end = MODULE["trim_region"](samples, 1000, (0, 0.7))
        self.assertAlmostEqual(start, 0.07)
        self.assertAlmostEqual(end, 0.64)
        with self.assertRaisesRegex(ValueError, "silent"):
            MODULE["trim_region"](array("h", [0] * 1000), 1000, (0, 1))

    def test_rejects_unknown_duplicate_and_path_traversal_clip_requests(self):
        character = {"id": "engineer", "selectedVoiceId": "saved-id", "usedModel": "eleven_v4",
                     "clips": [{"id": "engineer__done__01"}]}
        valid = ["engineer__done__01"]
        self.assertEqual(MODULE["validate_request"](character, valid, "pilot", 1), character["clips"])
        cases = [(valid * 2, "pilot", 1), (["other__done__01"], "pilot", 1),
                 (valid, "../elsewhere", 1), (valid, "pilot", 0), ([], "pilot", 1)]
        for clip_ids, batch_id, take in cases:
            with self.subTest(batch=batch_id), self.assertRaises(ValueError):
                MODULE["validate_request"](character, clip_ids, batch_id, take)
        with self.assertRaisesRegex(ValueError, "actual selected"):
            MODULE["validate_request"]({**character, "selectedVoiceId": None}, valid, "pilot", 1)


if __name__ == "__main__":
    unittest.main()

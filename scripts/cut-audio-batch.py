"""Split a manually generated ElevenLabs batch and record pending/rejected takes.

Requires ffmpeg and ffprobe on PATH; no Python packages. Long silent separators
must produce exactly the requested number of clips. No speech recognition or
listening approval is implied. Sources are archived unchanged on the project drive.
"""

from __future__ import annotations

import argparse
from array import array
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOUNDS = ROOT / "src/assets/sounds"
CATALOG = SOUNDS / "production.json"
SEPARATOR = "\n[long pause]\n"


def run(*arguments: str) -> bytes:
    return subprocess.run(arguments, check=True, capture_output=True).stdout


def decode(path: Path, rate: int) -> array:
    samples = array("h", run("ffmpeg", "-v", "error", "-i", str(path),
                             "-f", "s16le", "-ac", "1", "-ar", str(rate), "pipe:1"))
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def split_regions(duration: float, silences: list[tuple[float, float]], expected: int):
    if not math.isfinite(duration) or duration <= 0 or expected < 1:
        raise ValueError("Invalid duration or expected clip count")
    regions = []
    cursor = 0.0
    for start, end in silences:
        if not all(math.isfinite(value) for value in (start, end)):
            raise ValueError("Non-finite silence boundary")
        if start < cursor or end <= start or start > duration or end > duration + 0.05:
            raise ValueError("Unordered or out-of-range silence boundary")
        if start - cursor > 0.05:
            regions.append((cursor, start))
        cursor = min(duration, end)
    if duration - cursor > 0.05:
        regions.append((cursor, duration))
    if len(regions) != expected:
        raise ValueError(f"Expected {expected} clips, found {len(regions)}; review separators before cutting")
    return regions


def trim_region(samples: array, rate: int, region: tuple[float, float]):
    start, end = region
    left, right = int(start * rate), min(len(samples), int(end * rate))
    threshold = 10 ** (-48 / 20) * 32768
    while left < right and abs(samples[left]) < threshold:
        left += 1
    while right > left and abs(samples[right - 1]) < threshold:
        right -= 1
    if right - left < rate * 0.03:
        raise ValueError("Empty or nearly silent clip; manual review required")
    return max(start, left / rate - 0.03), min(end, right / rate + 0.04)


def validate_request(character: dict, clip_ids: list[str], batch_id: str, take: int):
    if not re.fullmatch(r"[a-z0-9-]+", character["id"]) or not re.fullmatch(r"[a-z0-9-]+", batch_id):
        raise ValueError("Unsafe character or batch ID")
    if take < 1 or not clip_ids or len(set(clip_ids)) != len(clip_ids):
        raise ValueError("Take must be positive and clip IDs must be unique")
    available = {clip["id"]: clip for clip in character["clips"]}
    if any(clip_id not in available for clip_id in clip_ids):
        raise ValueError("Clip ID does not belong to the selected character")
    if not character["selectedVoiceId"] or not character["usedModel"]:
        raise ValueError("Record the actual selected voice and speech model first")
    for clip_id in clip_ids:
        if not re.fullmatch(r"[a-z0-9-]+__[a-z0-9-]+__[a-z0-9-]+", clip_id):
            raise ValueError("Unsafe clip ID")
    return [available[clip_id] for clip_id in clip_ids]


def write_json(path: Path, value):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     suffix=".tmp", delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def process_batch(source: Path, character_id: str, clip_ids: list[str], batch_id: str, take: int,
                  min_silence: float = 0.8):
    if not math.isfinite(min_silence) or not 0.2 <= min_silence <= 5:
        raise ValueError("Minimum silence must be between 0.2 and 5 seconds")
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    character = next((item for item in catalog["characters"] if item["id"] == character_id), None)
    if character is None:
        raise ValueError("Unknown character")
    clips = validate_request(character, clip_ids, batch_id, take)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    output = (SOUNDS / character_id).resolve()
    output.relative_to(SOUNDS.resolve())
    archive = output / "source"
    archive.mkdir(parents=True, exist_ok=True)
    report_path = archive / f"{batch_id}__take-{take}.json"
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
        if report["sourceSha256"] != digest or report["clipIds"] != clip_ids:
            raise ValueError("Existing batch identity differs; choose a new batch/take")
        if not all((ROOT / record["deliveryFile"]).is_file() for record in report["takes"]):
            raise ValueError("Existing report has missing delivery files")
        return report
    destinations = [output / f"{clip['id']}__take-{take}.mp3" for clip in clips]
    if any(path.exists() for path in destinations):
        raise ValueError("Delivery file already exists; never overwrite a take")
    if any(record["clipId"] in clip_ids and record["takeNumber"] == take
           for record in character["takes"]):
        raise ValueError("Catalog already contains one of these takes")
    metadata = json.loads(run("ffprobe", "-v", "error", "-select_streams", "a:0",
                              "-show_entries", "stream=sample_rate", "-of", "json", str(source)))
    rate = int(metadata["streams"][0]["sample_rate"])
    samples = decode(source, rate)
    duration = len(samples) / rate
    detection = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(source), "-af",
                                f"silencedetect=noise=-40dB:d={min_silence}", "-f", "null", "-"],
                               check=True, capture_output=True, text=True)
    starts = [float(value) for value in re.findall(r"silence_start: ([\d.]+)", detection.stderr)]
    ends = [float(value) for value in re.findall(r"silence_end: ([\d.]+)", detection.stderr)]
    if len(starts) == len(ends) + 1:
        ends.append(duration)
    if len(starts) != len(ends):
        raise ValueError("Incomplete silence detection")
    regions = split_regions(duration, list(zip(starts, ends)), len(clips))
    regions = [trim_region(samples, rate, region) for region in regions]
    source_path = archive / f"{batch_id}__take-{take}{source.suffix.lower()}"
    if source_path.exists() and hashlib.sha256(source_path.read_bytes()).hexdigest() != digest:
        raise ValueError("Archived source differs; never overwrite it")
    input_text = SEPARATOR.join(clip["taggedText"] for clip in clips)
    records = []
    with tempfile.TemporaryDirectory(prefix=".cut-", dir=output) as scratch_name:
        scratch = Path(scratch_name).resolve()
        scratch.relative_to(output)
        for clip, destination, (start, end) in zip(clips, destinations, regions):
            staged = scratch / destination.name
            run("ffmpeg", "-v", "error", "-n", "-i", str(source), "-ss", str(start),
                "-t", str(end - start), "-c:a", "libmp3lame", "-b:a", "192k", str(staged))
            measured = len(decode(staged, rate)) / rate
            minimum = clip.get("minDurationSec", 0)
            fits = minimum <= measured <= clip["maxDurationSec"]
            records.append({"clipId": clip["id"], "takeNumber": take,
                            "voiceId": character["selectedVoiceId"], "model": character["usedModel"],
                            "inputText": input_text, "clipText": clip["taggedText"],
                            "generatedOn": datetime.now(timezone.utc).date().isoformat(),
                            "sourceFile": source_path.relative_to(ROOT).as_posix(),
                            "deliveryFile": destination.relative_to(ROOT).as_posix(),
                            "sourceFormat": source.suffix.lstrip(".").lower(),
                            "measuredDurationSec": round(measured, 6),
                            "segmentStartSec": round(start, 6), "segmentEndSec": round(end, 6),
                            "boundaryReviewRequired": min_silence < 0.8,
                            "reviewStatus": "pending" if fits else "rejected",
                            "notes": "Listening review pending." if fits else "Outside duration budget; rewrite/regenerate, do not speed up."})
        if not source_path.exists():
            shutil.copy2(source, source_path)
        for destination in destinations:
            (scratch / destination.name).rename(destination)
    character["takes"].extend(records)
    catalog["status"] = "in-production"
    write_json(CATALOG, catalog)
    report = {"batchId": batch_id, "characterId": character_id, "takeNumber": take,
              "sourceSha256": digest, "sourceFile": source_path.relative_to(ROOT).as_posix(),
              "sourceDurationSec": round(duration, 6), "separator": "[long pause]",
              "minSilenceSec": min_silence, "silenceThresholdDb": -40,
              "clipIds": clip_ids, "takes": records}
    write_json(report_path, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--character", required=True)
    parser.add_argument("--clip-ids", nargs="+", required=True)
    parser.add_argument("--batch-id", required=True)
    parser.add_argument("--take", type=int, required=True)
    parser.add_argument("--min-silence", type=float, default=0.8)
    arguments = parser.parse_args()
    report = process_batch(arguments.source, arguments.character, arguments.clip_ids,
                           arguments.batch_id, arguments.take, arguments.min_silence)
    print(json.dumps({"sourceDurationSec": report["sourceDurationSec"], "clips": [
        {key: record[key] for key in ("clipId", "takeNumber", "measuredDurationSec", "reviewStatus")}
        for record in report["takes"]]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

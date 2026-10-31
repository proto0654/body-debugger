# Audio production — ElevenLabs package

## Status and ownership

This is a **production package with pilot recordings**, not shipped audio. The [production catalog](../src/assets/sounds/production.json) is the only source of truth for voice descriptions, Russian scripts, tagged inputs, durations and output names: ten characters × (32 lines + eight vocal reactions) = **400 voice positions**, plus **nine shared effects**. Selection and take records distinguish generated material from pending positions. Empty records mean that generation/selection has not happened; no listening approval is inferred from generation or measured duration.

The current player, preferences and laboratory are unchanged. See [Sounds](SOUNDS.md) for implemented behavior and [CONCEPT.md](../CONCEPT.md) for the approved product direction. The catalog is not imported by the renderer, is not a runtime manifest and does not extend public application types. Production supports two paths: manual browser downloads with the batch cutter, and per-clip generation through the ElevenLabs API (`scripts/generate-audio-api.mjs`). The API path reads a local `ELEVENLABS_API_KEY` from `.env` (gitignored), adds no package dependencies, and writes a take report beside the catalog; neither path changes the renderer.

## Creative direction

- Adult Russian-speaking characters; one saved voice per identity across every build and evolution stage. Change performance, not identity, for emotions.
- Direct, meme-aware roast. Profanity and jokes about a belly, slouching, physical shape, sitting and excuses are allowed. At most eight of each character's 32 lines may contain profanity; the catalog conservatively counts crude body slang too.
- Skipping and snoozing receive brief roasts; pausing receives a calm acknowledgment. This deliberately supersedes the former product rule against reproach for skip/snooze. Existing runtime captions are still calm until a separate integration changes them.
- Do not target illness, disability, ethnicity or other protected characteristics. Do not make health claims, equate a recorded exercise with a medical outcome, or encourage exercising through pain.
- The selected character also delivers system messages. An error must clearly describe the failed action before any joke; never read raw exceptions, private data or an invented cause.
- No background chatter. The common effects use a compact comic/tactile palette: rubber, wood, elastic clicks and soft movement accents. Keep voices and effects as separate files.

### Cast

| Catalog ID | Character | Voice and writing direction |
|------------|-----------|-----------------------------|
| `desk-hulk` | Desk Hulk | Low, gravelly gym buddy; chairs, strength and blunt competitive approval |
| `alt-girl` | Альтуха | Lower female register, dry and lightly husky; darkness, boredom and reluctant approval |
| `punk` | Нефор | Rough male rasp, clipped explosive rhythm; rebellion against the chair |
| `zoomer` | Зумер | Agile young adult male; gaming metaphors, quests and amused disbelief |
| `cool-mom` | Милфа | Warm mature female, brisk and assured; caring dressing-down without baby talk |
| `metro` | Метро | Smooth precise male; posture, presentation and exacting understatement |
| `streetwear` | Стритвир | Warm rhythmic male; movement, clothes and easy friendly teasing; no invented ethnic accent |
| `insta-diva` | Инстадива | Bright theatrical female; angles, filters and mock-glamorous enthusiasm |
| `engineer` | Инженер | Dry precise male, deadpan timing; diagnostics, maintenance and technical debt |
| `hipster` | Хипстер | Velvety relaxed male, ironic snobbery; craft, authenticity and absurd refinement |

## Catalog contract

The JSON uses English field names and production directions; spoken lines, preview paragraphs and reaction transcripts are Russian. Each character record contains a complete `voiceDesignPrompt` and `previewText`. `selectedVoiceId` and `usedModel` remain `null` until a real selection; `candidateSpeechModel` is the proposed trial model, not a claim about account access or an already used model.

Each `clips` item contains its stable `id`, `characterId`, `kind`, semantic `event`, `variant`, `spokenText`, `emotion`, copy-ready `taggedText`, `maxDurationSec`, `containsProfanity`, `usageContext` and first-take `outputFile`. Vocal reactions also have a Russian `transcript`, an English `performanceDirection`, and `minDurationSec: 0.2`. For nonverbal reactions, `spokenText` is empty: the transcript explains what to hear and must **not** be pasted as speech.

`events` owns line counts and duration budgets. `reactionVariants` owns the eight reaction assignments. IDs do not contain the model, build or stage, and remain stable when a prompt is refined. `effects` contains independent copy-ready prompts, target and maximum durations, output names and take logs. The `system` filename prefix identifies shared effects, not a narrator.

### Event matrix and existing hooks

| Semantic event | Lines per voice | Maximum seconds | Current application hook |
|----------------|-----------------|-----------------|--------------------------|
| `ready` | 4 | 2.2 | `popup` effect on popup mount |
| `active` | 2 | 1.0 | Text reaction on start; no start audio |
| `done` | 4 | 2.2 | `done` effect after durable result acknowledgment |
| `first-done` | 3 | 2.2 | Text reaction available; no dedicated audio |
| `stage-up` | 3 | 3.2 | `stage-up` effect replaces ordinary result cue |
| `streak` | 3 | 3.2 | Effect preview available; automatic milestone audio is not wired |
| `welcome` | 2 | 2.2 | No automatic greeting audio |
| `paused` | 2 | 1.0 | Text reaction available; no pause audio |
| `skipped` | 3 | 1.0 | `skip` effect after result acknowledgment |
| `snoozed` | 3 | 1.0 | `snooze` effect after result acknowledgment |
| `error` | 2 | 2.2 | Effect preview available; no general automatic error narration |
| `alert` | 1 | 2.2 | Effect preview available; no general automatic alert narration |

All voice clips are planned, including events with existing **effect** hooks. The reaction set is two approvals, two victory exclamations, one chuckle, one skeptical hum, one sigh and one surprised exclamation; each finished reaction must fit **0.2–0.9 seconds**. `welcome` and `streak` are reserve voice material; the shared `start` effect is also reserve. Do not add triggers merely because a catalog item exists.

The two error entries are deliberately context-specific, not interchangeable variants: `failed-session-save` can play only after a failed durable session save; `failed-operation` is a generic failed-operation acknowledgment. An `alert` with `visible-action-required` needs a visible actionable message. The voice does not replace the exact visible explanation. Other entries require the corresponding event to have actually occurred; do not infer a save, milestone or result from an animation.

## Copying prompts into ElevenLabs

Use the website manually. No API setup or key is required for this workflow. Check the subscription's saved-voice slots, generation allowance and available export formats before mass casting. Do not discard an approved saved voice to free a slot without first confirming that it remains usable for later retakes. If slots are insufficient, stop expansion and keep the approved pilot voices intact.

The following PowerShell commands run from the repository root and copy the exact catalog fields. Keep this shell open between commands. The catalog supplies finished prompts, not text templates that an operator must complete.

```powershell
$audioCatalog = Get-Content -LiteralPath 'src/assets/sounds/production.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$audioCharacter = $audioCatalog.characters | Where-Object id -EQ 'engineer'
$audioCharacter.voiceDesignPrompt | Set-Clipboard
```

### 1. Voice Design: save a consistent identity

Open Voices → My Voices → Add a new voice → Voice Design. Paste `voiceDesignPrompt` as the voice description. It specifies adult age, native Russian, timbre, pacing, personality and dry recording quality. Copy the full Russian preview paragraph separately:

```powershell
$audioCharacter.previewText | Set-Clipboard
```

The paragraph demonstrates ordinary speech, sarcasm and approval; it is a casting script, not a duration-limited runtime clip. Compare three candidates for the same character using the same paragraph. Preserve native Russian pronunciation and character distinction before optimizing expressive range. Record real candidate information in `castingCandidates`: candidate label, provider voice ID if assigned, actual model shown, preview filename and listening notes. Do not invent voice IDs for unsaved previews.

Desk Hulk uses the user's chosen Voice 2. For future characters, the user has authorized a random choice among the three candidates: draw an integer from 1 through 3 once per casting batch, save that numbered candidate and record `method: random`. Do not describe random selection as a listening evaluation.

After selection, populate `selectedVoiceId` and `usedModel`, and append `selectionHistory` with the date, actual voice/model IDs and reason. Record the exact model displayed by the provider; a Voice Design model and a later speech model may differ. Preserve superseded selections for provenance.

### 2. Text to Speech: direct one performance

Use the approved saved voice. Start trials with `candidateSpeechModel` (`eleven_v4`). Account availability has not been verified: if it is unavailable, use `eleven_v3` for a new pilot, explicitly record that model and evaluate all six pilot cases again before expansion. Do not mix models silently within an approved voice batch.

```powershell
$audioClip = $audioCharacter.clips | Where-Object id -EQ 'engineer__ready__01'
$audioClip.taggedText | Set-Clipboard
$audioClip | Select-Object id, maxDurationSec, usageContext, outputFile
```

Paste **only `taggedText`** into the speech input. `persona`, `emotion`, `performanceDirection`, `usageContext` and transcripts are operator directions, not extra spoken text. Use directions to judge the result; the saved voice establishes timbre. The supplied short English tags direct delivery, followed by Russian text. Do not add SSML break tags for v4/v3. Tags are performance hints, not guaranteed commands; reject spoken tags and extraneous sound effects.

For tag-only chuckles, hums and sighs, first try the supplied input with the same saved voice. If it produces silence, spoken tags or added words, record the failed take. Then generate a short contextual sentence containing the same reaction tag, record the actual input, and manually isolate the clean nonverbal segment. Preserve the uncut source and segment offsets. Do not substitute an unrelated SFX voice. If no clean segment fits, leave the position pending rather than marking it accepted.

Never force a long line into its budget by accelerating it into unintelligibility. Rewrite a too-long line in the catalog under the same ID, preserve its earlier take/input in the log, and regenerate. A breath, chuckle and trailing silence count toward the clip budget. Only generated take records have measured durations; catalog limits are targets, not measurements.

### Batch tracks and cutting

Group six to eight positions for one saved voice into a single track. Keep the exact ordered clip IDs and join their `taggedText` values with a newline, `[long pause]`, and another newline. Do not add spoken numbering or labels. Retain each line's own emotion tag. This reduces UI work; it is not a promise of fewer billed credits. Do not combine different characters in one track.

The first v4 pilot produced two generations from one submission. Download **both** using the separate Generation 1/2 download controls; do not assume a second Generate click is needed. Record the actual output format. The current production session supports MP3 44.1 kHz / 192 kbps; WAV choices were disabled, so the downloaded MP3 is the original source, not a lossless master.

Use [the batch cutter](../scripts/cut-audio-batch.py) with existing `ffmpeg` and `ffprobe` executables on PATH. It archives the downloaded source unchanged, finds pauses of at least 0.8 seconds below -40 dB, requires **exactly** the expected number of clips, trims only outer quiet samples with small edge padding, and writes MP3 derivatives and source-side JSON reports. A count mismatch stops the cut rather than guessing which line is which. No external transcription service is used.

```powershell
python scripts/cut-audio-batch.py --source src/assets/sounds/desk-hulk/source/pilot-01__take-1.mp3 --character desk-hulk --batch-id pilot-01 --take 1 --clip-ids desk-hulk__ready__01 desk-hulk__done__01 desk-hulk__stage-up__01 desk-hulk__skipped__01 desk-hulk__error__01 desk-hulk__done__chuckle-01
```

Before cutting a new download, set the character's actual saved voice ID and speech model in the catalog. Cut while the catalog texts still match the submitted batch: input and clip text are captured in the take records. Generated sources live under the character's `source` directory; delivery clips sit beside it. New take numbers must not overwrite earlier files. Repeating a completed batch with the same source hash and clip order returns the existing report. Reports preserve the source hash, boundaries and complete submitted text.

The cutter measures **decoded audio duration**, excluding MP3 encoder padding. It marks out-of-budget takes `rejected` and other takes `pending`; it cannot verify words, accent, emotional quality or the identity of a chuckle. Listen before setting `accepted`. If only some lines fail, rewrite those stable IDs and regenerate a smaller batch with new take numbers; keep the original tracks and rejected cuts.

Actual `[long pause]` lengths vary. If the default 0.8-second threshold misses separators, inspect the silence timings and explicitly pass `--min-silence` with a value between 0.2 and 5 seconds. The exact-count guard still applies. Thresholds below 0.8 flag every cut with `boundaryReviewRequired`: sentence pauses may look like separators, so listen to each boundary before approval. Do not keep reducing the threshold merely to force the expected count.

### 3. Sound Effects: one independent cue

```powershell
$audioEffect = $audioCatalog.effects | Where-Object event -EQ 'done'
$audioEffect.prompt | Set-Clipboard
$audioEffect | Select-Object targetDurationSec, maxDurationSec, outputFile
```

Use the Sound Effects tool, not the character TTS voice. The initial candidate is `eleven_text_to_sound_v2`. SFX v3 is an optional later audition with limited availability; record the actual model per take. Set the target duration when the UI supports it and measure the exported result regardless of the setting. Do not enable looping. Reject music beds, voices, alarms, long tails and piercing high-frequency peaks. Most cues cap at **0.7 seconds**; `stage-up` and `streak` cap at **1.2 seconds**.

## API generation — one clip per request

[`scripts/generate-audio-api.mjs`](../scripts/generate-audio-api.mjs) generates one catalog clip per TTS request. It is the low-friction path for short feedback lines: no browser, no track cutting and no per-line manual download. It covers character clips only; the nine shared effects still use the manual Sound Effects flow.

### Setup

- Create a restricted ElevenLabs key: **Text to Speech**, **Voices: Read** and **User: Read**. Add **Sound Effects** only if effects will move to the API later. Do not grant account, billing or admin access.
- Put the key in `.env` at the repository root:

  ```dotenv
  ELEVENLABS_API_KEY=...
  ```

  `.env` is gitignored; [`.env.example`](../.env.example) is the committed template. Never put the key in the catalog, docs, source or a commit.
- Node 20+ and `ffmpeg`/`ffprobe` on `PATH`. The script has no package dependencies.

### Run

```powershell
node scripts/generate-audio-api.mjs --character desk-hulk --dry-run
node scripts/generate-audio-api.mjs --character desk-hulk --event ready,done --limit 2
node scripts/generate-audio-api.mjs --character desk-hulk --skip-existing
node scripts/generate-audio-api.mjs --character desk-hulk --all --skip-existing
```

| Flag | Meaning |
|------|---------|
| `--character <id>` | Catalog character; omit to use every character with a saved voice |
| `--event a,b` | Restrict to semantic events; default is the runtime set (`ready`, `done`, `skipped`, `snoozed`, `stage-up`, `error`, `alert`) |
| `--all` | Include reserve events (`active`, `first-done`, `streak`, `welcome`, `paused`) |
| `--limit N` | Cap the number of clips in this run |
| `--take N` | Output take number; default `1` |
| `--model <id>` | Override `candidateSpeechModel` (`eleven_v4` in the catalog) |
| `--output-format <fmt>` | Default `mp3_44100_192`; falls back to `mp3_44100_128` when rejected |
| `--skip-existing` | Skip a clip when its delivery file already exists |
| `--force` | Overwrite an existing take instead of stopping |
| `--no-trim` | Keep leading/trailing silence; trimming is on by default |
| `--dry-run` | List the selection without calling the API |

### Outputs and records

- Raw response: `src/assets/sounds/<character>/source/api__<clipId>__take-N.mp3`.
- Delivery clip: `src/assets/sounds/<character>/<outputFile>`, with outer silence trimmed below `-40 dB`.
- Take log: [`src/assets/sounds/api-report.json`](../src/assets/sounds/api-report.json), one record per generated clip with clip ID, character, event, take, voice ID, model, input text, source/delivery paths, measured duration and `pending`/`over-budget` status.
- The catalog is **not** edited by the script. Merge accepted takes into `takes` only after listening.

### Consistency and billing

- Identity comes from the saved `voiceId`, not from a single track. The script always uses the selected voice with `eleven_v4` and the same `voice_settings` (`stability 0.5`, `similarity_boost 0.75`, `style 0`, speaker boost on), so separate requests keep the timbre.
- Separate requests vary slightly in prosody. Generate **one take per clip** for the MVP; produce a second take only when the first fails listening, and record the reason.
- Credits are billed per character, the same as the web UI. The API does not reduce ElevenLabs spend; it removes model tokens and UI work. `GET /v1/user/subscription` may lag behind generation, so compare `character_count` before and after a batch rather than per request.
- Nonverbal clips (`done.chuckle`) may return silence when only a tag is sent. Use the manual contextual-sentence fallback described above and keep the clean segment.

## Pilot and expansion

1. Cast Desk Hulk, Альтуха and Инженер: three candidates each. The cast must sound distinct even when auditioned on identical neutral words.
2. For each selected voice, generate the six exact entries in `pilot.clipIds`: `ready/01`, `done/01`, `stage-up/01`, `skipped/01`, `error/01` and `done/chuckle-01`. Generate two takes each: **18 positions, 36 control takes**, plus nine casting previews. Use one separated track per voice when possible; consult take records for the actual completion state.
3. Evaluate native Russian, intelligibility, character identity, emotion, comfortable loudness and the one-second skip limit. Also reject added words, spoken tags, harshness, noise and clipped endings. Full-set production starts only after these listening checks and voice selection pass.
4. Correct scripts/directions as needed; then cast the other seven identities using the same procedure and produce the full matrix. Keep the selected voice fixed across body builds and evolution stages.
5. Audition the nine shared effects against representative voice clips before final export. Do not bake effects into the speech masters or create a universal narrator.

### Production checkpoint — 2026-10-30

- The user listened to the Desk Hulk, Альтуха and Инженер pilot review tracks and approved the Russian delivery, emotion and cut boundaries, authorizing full-set production. The selected pilot performances are marked `accepted` in the catalog; alternate takes remain pending or rejected according to their measured duration.
- Saved voices: Desk Hulk, Альтуха and Инженер (three of ten). The next seven characters have not been cast. The three saved voices use `eleven_v4` for speech; candidate 2 was selected for each, with the user's explicit choice for Desk Hulk and random selection for the next two.
- The 18 pilot positions have at least one accepted take. The remaining 382 voice positions have not been generated. Continue by casting the other seven voices, then generate the unfilled positions and keep the approved pilot voices fixed.
- Three of nine effects have catalogued takes: `popup` and `done` are pending listening; the first `start` take was rejected for exceeding the duration budget and needs regeneration. Other effects have no catalogued take yet.
- Full production is not complete. The current player still does not load any of these assets.

### API pilot — 2026-10-31

- The per-clip API path was validated on Desk Hulk: `ready__02` 2.00 s, `done__02` 1.46 s and `stage-up__02` 0.878 s, all within their budgets and pending listening.
- A second take of `stage-up__02` (0.910 s) confirmed that separate requests vary in prosody; it was removed as a test artifact. [`api-report.json`](../src/assets/sounds/api-report.json) keeps the three delivery takes.
- The catalog and renderer are unchanged. Credits are billed per character, and the subscription counter lags behind generation.

## Files, takes and acceptance

The filename stem is `{character}__{event}__{variant}__take-{number}`. Each `outputFile` already names take 1; increment only the final take number for retakes. Shared cues use `system` as the character prefix. Accepted derivatives keep the source take number; do not overwrite a rejected source or reuse its filename for a different performance.

- Save available lossless masters as WAV or FLAC at their original sample rate. If only MP3 export is available, retain that original MP3; converting it to WAV does not create a lossless master. Choose available formats on the account instead of assuming an entitlement.
- Keep uncut sources separate from trimmed delivery versions. The cutter stores both under the existing sound asset area, with uncut tracks and reports in `source`. The current player does not import them, and existing `default/*.mp3` files are not replaced.
- Keep voice and effects as separate assets. Trim unintended silence without chopping consonants, breaths or decay. For contextual nonverbal extractions, record the segment boundaries.
- Align perceived loudness across voices and effects through listening at the same playback volume; avoid clipping and sudden peaks. Do not normalize every tiny effect to maximum peak amplitude.

Append records to the owning character's `takes` or effect's `takes`. Character take records include the `clipId`; effect ownership supplies the effect ID. Record `takeNumber`, actual `voiceId` (voices only), actual `model`, `inputText`, generation date, `sourceFile`, `deliveryFile`, source format, `measuredDurationSec`, listening notes and `reviewStatus` (`pending`, `accepted` or `rejected`). For cut segments, also record `segmentStartSec` and `segmentEndSec`. Files may be relative to an operator-controlled media archive; do not put machine-specific absolute paths or credentials in committed records. A generation setting or a target duration is not a measured duration.

Accept a take only after listening confirms the exact words or intended nonverbal reaction, natural Russian, correct emotion, stable voice identity, a clean beginning/end, no noise or overload, and compliance with the duration limits. Keep rejected takes and reasons in the archive/log so failed prompts are not retried blindly. Credits, subscriptions and subjective voice acceptance have not been verified by the repository checks.

## Future integration contract — not implemented

- One principal voice clip per event: select a line **or** a vocal reaction; never stack multiple spoken replies. Stage/streak milestones replace the ordinary success reply. Define collision ordering in the later integration, rather than firing every available line.
- Avoid immediate variant repeats. Retain semantic event identity; a new stage or body build must not select a different saved voice.
- The native popup remains the sole owner of its result audio; dashboard mirrors and laboratory snapshots must not duplicate it. Playback after a result requires durable acknowledgment. `missed` remains silent. Local approved files must work offline.
- A compatible effect may later be balanced separately against a voice, but layering and frequency controls are not implemented here. No new default speech setting is implied by adding the catalog.
- The current player exposes only `enabled`, `volume` and `packId`, imports eight default cues, has no voice selector/manifest loading, and creates independent audio elements without voice interruption/queue coordination. Automatic greeting/start/streak narration, cross-window arbitration and pause acknowledgments need explicit later wiring.
- The current playback gate checks mute, positive volume, pause and an optional quiet context. The standard player does **not** detect OS DND or active calls and does not currently pass an OS quiet detector. Paused speech is reserve material; the normal gate would suppress it while paused.
- Existing feedback waits are 2.5 seconds for ordinary completion, 3.5 for milestones and 1.2 for skip/snooze, plus a 180 ms exit. Catalog budgets leave room for these windows but are not proof against truncation. The later integration must coordinate start latency, cancellation, window close and actual audio completion without delaying the durable core result.

## Repository verification

Run the catalog acceptance tests with `npm test -- tests/unit/audio-production.test.ts`. They check cast coverage, event/reaction counts, IDs, filenames, duration budgets, context-sensitive messages, ready-to-copy inputs and profanity annotations. They do not synthesize or listen to audio. Typecheck and build must remain unaffected by the inert catalog.

Run cutter boundary, padding, count and path checks with `python -m unittest discover -s tests -p test_audio_batch_cutter.py`. Real generated sources also need the exact-count cutting check and listening review; silence detection does not establish transcript correctness.

Run the API generator without spending credits:

```powershell
node scripts/generate-audio-api.mjs --character desk-hulk --dry-run
```

Repository tests cover the catalog and the cutter; they do not synthesize audio. For an API run, check the new files with `ffprobe`, compare `character_count` before and after, and listen before marking a take accepted.

After documentation edits, run the `/project-context` link checker from the repository root:

```powershell
node "$env:USERPROFILE/.agents/skills/project-context/scripts/check-doc-links.mjs" .
```

The checker location belongs to the local skill installation, not the repository; resolve it from the active skill catalog on another machine.

## Provider references

Checked on 2026-10-30. Recheck account availability before production. These references describe provider features, not completed project work.

- [Voice Design](https://elevenlabs.io/docs/eleven-creative/voices/voice-design): prompt descriptions, preview paragraphs and saved-voice slots.
- [Speech best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices): expressive tags and model-specific prompting.
- [Sound Effects](https://elevenlabs.io/docs/overview/capabilities/sound-effects): independent effects, duration controls and model availability.

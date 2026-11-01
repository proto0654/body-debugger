# Audio production — ElevenLabs package

## Status and ownership

This is a **production package with pilot recordings**, not shipped audio. The [production catalog](../src/assets/sounds/production.json) is the only source of truth for voice descriptions, Russian scripts, tagged inputs, durations and output names: ten characters × (32 lines + eight vocal reactions) = **400 voice positions**, plus **nine shared effects**. Selection and take records distinguish generated material from pending positions. Empty records mean that generation/selection has not happened; no listening approval is inferred from generation or measured duration. All ten voices are cast and every position has a first take, but that material is unreviewed — see the 2026-10-31 checkpoint.

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

Two paths exist. The API scripts in this document are the default for casting, per-clip speech and effects; the website remains the fallback for manual batches and for casting that must be judged by ear first. Check the subscription's saved-voice slots, generation allowance and available export formats before mass casting. Do not discard an approved saved voice to free a slot without first confirming that it remains usable for later retakes. If slots are insufficient, stop expansion and keep the approved pilot voices intact.

The following PowerShell commands run from the repository root and copy the exact catalog fields. Keep this shell open between commands. The catalog supplies finished prompts, not text templates that an operator must complete.

```powershell
$audioCatalog = Get-Content -LiteralPath 'src/assets/sounds/production.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$audioCharacter = $audioCatalog.characters | Where-Object id -EQ 'engineer'
$audioCharacter.voiceDesignPrompt | Set-Clipboard
```

### 1. Voice Design: save a consistent identity

Both paths use the same `voiceDesignPrompt` and `previewText` from the catalog; the prompt specifies adult age, native Russian, timbre, pacing, personality and dry recording quality.

#### API path — default

```powershell
node scripts/cast-voices-api.mjs --character punk --dry-run
node scripts/cast-voices-api.mjs --character punk
node scripts/cast-voices-api.mjs --missing
```

[`scripts/cast-voices-api.mjs`](../scripts/cast-voices-api.mjs) calls `POST /v1/text-to-voice/design` with `voiceDesignPrompt`, `previewText`, `model_id: eleven_multilingual_ttv_v2`, `quality 0.9` and `loudness 0.5`, then saves the chosen candidate with `POST /v1/text-to-voice`.

The Voice Design request has **no preview-count or single-preview option** (checked against the provider OpenAPI schema on 2026-10-31): one design call returns its whole preview batch. There is therefore nothing to compare or draw from on this path — the script archives every returned preview as `source/design__<character>__candidate-<n>__<date>.mp3` and saves candidate 1 by default (`--preview N` saves another one). Do not describe an API cast as a listening evaluation; the archived previews are the material for a later retake.

The script writes `selectedVoiceId`, `usedModel`, `castingCandidates` and a `selectionHistory` entry with `method: api-first-preview`. Voice names follow `Body Debugger - <Character>`, and the provider voice description is truncated to its 500-character metadata limit; the generation prompt stays unchanged.

#### Website path

Use the website when candidates must be judged by ear before a voice exists in the account. Open Voices → My Voices → Add a new voice → Voice Design. Paste `voiceDesignPrompt` as the voice description. Copy the full Russian preview paragraph separately:

```powershell
$audioCharacter.previewText | Set-Clipboard
```

The paragraph demonstrates ordinary speech, sarcasm and approval; it is a casting script, not a duration-limited runtime clip. Compare three candidates for the same character using the same paragraph. Preserve native Russian pronunciation and character distinction before optimizing expressive range. Record real candidate information in `castingCandidates`: candidate label, provider voice ID if assigned, actual model shown, preview filename and listening notes. Do not invent voice IDs for unsaved previews.

Desk Hulk uses the user's chosen Voice 2. For characters cast through the website, the user has authorized a random choice among the three candidates: draw an integer from 1 through 3 once per casting batch, save that numbered candidate and record `method: random`. Do not describe random selection as a listening evaluation.

After a manual selection, populate `selectedVoiceId` and `usedModel`, and append `selectionHistory` with the date, actual voice/model IDs and reason. Record the exact model displayed by the provider; a Voice Design model and a later speech model may differ. Preserve superseded selections for provenance.

### 2. Text to Speech: direct one performance

Use the approved saved voice. Start trials with `candidateSpeechModel` (`eleven_v4`). Account availability has not been verified: if it is unavailable, use `eleven_v3` for a new pilot, explicitly record that model and evaluate all six pilot cases again before expansion. Do not mix models silently within an approved voice batch.

```powershell
$audioClip = $audioCharacter.clips | Where-Object id -EQ 'engineer__ready__01'
$audioClip.taggedText | Set-Clipboard
$audioClip | Select-Object id, maxDurationSec, usageContext, outputFile
```

Paste **only `taggedText`** into the speech input. `persona`, `emotion`, `performanceDirection`, `usageContext` and transcripts are operator directions, not extra spoken text. Use directions to judge the result; the saved voice establishes timbre. The supplied short English tags direct delivery, followed by Russian text. Do not add SSML break tags for v4/v3. Tags are performance hints, not guaranteed commands; reject spoken tags and extraneous sound effects.

For tag-only chuckles, hums and sighs, first try the supplied input with the same saved voice. If it produces silence, spoken tags or added words, record the failed take. Then generate a short contextual sentence containing the same reaction tag, record the actual input, and manually isolate the clean nonverbal segment. Preserve the uncut source and segment offsets. Do not substitute an unrelated SFX voice. If no clean segment fits, leave the position pending rather than marking it accepted. On the API path the generator already retries a rejected tag-only input with a terminal period, so this manual route is the fallback for a take that still fails; see the nonverbal note under [API generation](#api-generation--one-clip-per-request).

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

#### API path

```powershell
node scripts/generate-effects-api.mjs --dry-run
node scripts/generate-effects-api.mjs
node scripts/generate-effects-api.mjs --event start --take 2
node scripts/generate-effects-api.mjs --retrim
```

[`scripts/generate-effects-api.mjs`](../scripts/generate-effects-api.mjs) sends each catalogued prompt to `POST /v1/sound-generation` with `prompt_influence 0.5` and writes `system/source/api__<effectId>__take-N.mp3` plus the delivery file.

- The endpoint rejects `duration_seconds` below **0.5 s**, so a shorter catalogued target (`start` 0.2 s, `skip` 0.35 s) is requested at 0.5 s. The take record keeps both `requestedDurationSec` and the measured length.
- Only **leading** silence is trimmed. Short cues decay fast, so trimming the tail as well removed the sound itself and left sub-0.2 s blips on the first pass; `--retrim` re-derives every delivery file from the archived source without spending credits and updates the measured duration in the report.
- Take records go to [`api-report.json`](../src/assets/sounds/api-report.json) with `kind: "effect"`. The catalog is not edited; merge accepted takes into the effect's `takes` after listening.
- Regenerate a rejected effect under a new take number; keep the earlier source.

## API generation — one clip per request

[`scripts/generate-audio-api.mjs`](../scripts/generate-audio-api.mjs) generates one catalog clip per TTS request. It is the low-friction path for short feedback lines: no browser, no track cutting and no per-line manual download. It covers character clips only; shared effects use [`scripts/generate-effects-api.mjs`](../scripts/generate-effects-api.mjs).

### Setup

- Create a restricted ElevenLabs key with Text to Speech, Sound Effects, Voice Design (saving a designed voice needs write access to voices), Voices: Read and User: Read. Do not grant account, billing or admin access.
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
- A tag-only nonverbal input (`[chuckles]`, `[skeptical hum]`, `[sighs]`) has no text left after tag removal and fails with `400 input_text_empty`. The generator retries exactly once with a terminal period appended (`[sighs] .`). A period is not pronounceable, so the take keeps the reaction instead of adding words. Measured trimmed desk-hulk results: 0.62 s sigh, 0.64 s skeptical hum, 0.19 s chuckle; the API returns roughly 1.2 s of audio for such an input, so the trim does most of the work. The report records the changed `inputText` and `inputFallback: "terminal period"`. Listening still decides whether the take is the intended reaction; fall back to the manual contextual-sentence route for a take that fails.

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

- The first per-clip batch covered the Desk Hulk runtime set: 19 clips selected, 17 generated, two rejected by the API as tag-only nonverbal inputs (`skipped__skeptic-01`, `snoozed__sigh-01`, `input_text_empty`), and two generated takes exceeded their 1 s skip/snooze budget (`skipped__02` 1.51 s, `snoozed__02` 1.14 s).
- The remaining takes are pending listening. [`api-report.json`](../src/assets/sounds/api-report.json) holds 20 records: the three earlier pilot clips plus the 17 generated runtime clips.
- The catalog and renderer are unchanged. Credits are billed per character, and the subscription counter lags behind generation.

### Full-set API production — 2026-10-31

- All ten voices are cast and saved. The three approved pilot voices are unchanged; the other seven were cast through the Voice Design API, saving candidate 1 of each returned batch without auditioning (`method: api-first-preview`). Every candidate is archived as `src/assets/sounds/<character>/source/design__<character>__candidate-<n>__2026-10-31.mp3`.
- All **400** voice positions and all **nine** effects have a take-1 delivery file. `api-report.json` holds 382 voice takes and 7 effect takes; the other 18 voice takes came from the manual pilot tracks. The catalog `takes` arrays still contain only the pilot records, because none of the new material has been listened to.
- 27 takes used the terminal-period nonverbal fallback: all three nonverbal positions for the seven new characters plus the two missing ones for Desk Hulk, Альтуха and Инженер. Four chuckles landed below the 0.2 s reaction minimum: `punk` 0.13 s, `zoomer` 0.13 s, `streetwear` 0.15 s, `hipster` 0.16 s.
- 45 voice takes exceed their catalog budget and are recorded as `over-budget`: `skipped` 18, `ready` 10, `snoozed` 7, `welcome` 6, `done` 4. The 1-second skip/snooze window is the real gap — those roasts were written for a longer read, so the next pass shortens the lines under the same stable IDs and regenerates small batches instead of accelerating the delivery.
- Effects were generated with `eleven_text_to_sound_v2`: `skip` 0.48 s, `snooze` 0.48 s, `stage-up` 1.00 s, `streak` 0.88 s, `alert` 0.46 s, `error` 0.48 s. `popup` and `done` keep their manual take 1; `start` take 2 replaces the rejected take 1 and measures 0.28 s. All nine are pending listening.
- Roughly 6 400 credits were spent on this pass (account counter 52 732 → 59 134; the counter lags behind generation).
- Nothing is wired into the renderer at that point: the player still plays only `default/*.mp3`. The voice layer landed later the same day and is now on by default — see [Runtime integration](#runtime-integration).

## Files, takes and acceptance

The filename stem is `{character}__{event}__{variant}__take-{number}`. Each `outputFile` already names take 1; increment only the final take number for retakes. Shared cues use `system` as the character prefix. Accepted derivatives keep the source take number; do not overwrite a rejected source or reuse its filename for a different performance.

- Save available lossless masters as WAV or FLAC at their original sample rate. If only MP3 export is available, retain that original MP3; converting it to WAV does not create a lossless master. Choose available formats on the account instead of assuming an entitlement.
- Keep uncut sources separate from trimmed delivery versions. The cutter stores both under the existing sound asset area, with uncut tracks and reports in `source`. The current player does not import them, and existing `default/*.mp3` files are not replaced.
- Keep voice and effects as separate assets. Trim unintended silence without chopping consonants, breaths or decay. For contextual nonverbal extractions, record the segment boundaries.
- Align perceived loudness across voices and effects through listening at the same playback volume; avoid clipping and sudden peaks. Do not normalize every tiny effect to maximum peak amplitude.

Append records to the owning character's `takes` or effect's `takes`. Character take records include the `clipId`; effect ownership supplies the effect ID. Record `takeNumber`, actual `voiceId` (voices only), actual `model`, `inputText`, generation date, `sourceFile`, `deliveryFile`, source format, `measuredDurationSec`, listening notes and `reviewStatus` (`pending`, `accepted` or `rejected`). For cut segments, also record `segmentStartSec` and `segmentEndSec`. Files may be relative to an operator-controlled media archive; do not put machine-specific absolute paths or credentials in committed records. A generation setting or a target duration is not a measured duration.

Accept a take only after listening confirms the exact words or intended nonverbal reaction, natural Russian, correct emotion, stable voice identity, a clean beginning/end, no noise or overload, and compliance with the duration limits. Keep rejected takes and reasons in the archive/log so failed prompts are not retried blindly. Credits, subscriptions and subjective voice acceptance have not been verified by the repository checks.

## Runtime integration

Wired on 2026-10-31; behaviour is documented in [Sounds](SOUNDS.md#character-voice-layer-default-on).

- **Implemented.** The generated package is the default experience: `sound.voiceEnabled` is on for new and existing profiles, and an explicit opt-out is the only way to silence it. Cue files are the generated `system/` takes (newest take wins, `default/*.mp3` only as fallback). The identity is `settings.characterPackId`. `VOICE_CUE_EVENTS` maps `popup → ready`, `done → done`, `skip → skipped`, `snooze → snoozed`, `stage-up → stage-up`; `active` (timer start) and `first-done` are spoken directly through `playVoiceEvent`, and the popup also speaks `error/01` from its rejected-save path. One clip per event: lines and vocal reactions rotate through `pickVoiceVariant`, which never repeats the previous take (last take remembered across popup windows; chronicle preview uses a separate rotation namespace). The line of the same event replaces the signal, so one event never plays both; a missing take or a gated layer leaves the signal alone. The gate is unchanged (mute, volume, pause, quiet). The manifest is `src/voice-assets.ts`; the catalog itself is still not imported by the renderer.
- **Listening tool.** Laboratory «Звуки» (`src/debug/SoundAuditionPanel.vue`) plays any variant, all variants of an event in order, and every effect take, ignoring the switch. It writes nothing.
- **Not implemented.** Queueing or interrupting a previous line, `welcome`/`paused`/`streak`/`alert` narration, per-event mixing controls, OS DND detection, cross-window arbitration and any automatic greeting. The popup remains the sole automatic owner of its result audio; `missed` stays silent.
- **Mixed-take caveat.** The layer plays whatever take-1 file exists. 45 takes exceed their catalog budget and four chuckles are under 0.2 s; until those IDs are rewritten and regenerated, an over-long skip/snooze line is cut by the 2.5 s feedback window.
- **Feedback windows.** Existing waits are 4.5 seconds for ordinary completion, 6 for milestones and 2.5 for skip/snooze, plus a 180 ms exit. Over-budget takes simply do not finish inside the skip/snooze window; nothing currently cancels the audio when the window closes.
- **Offline.** Clips are bundled with the renderer through `import.meta.glob` (418 mp3 assets, ~11 MB), so the voice works without network access.

## Repository verification

Run the catalog acceptance tests with `npm test -- tests/unit/audio-production.test.ts`. They check cast coverage, event/reaction counts, IDs, filenames, duration budgets, context-sensitive messages, ready-to-copy inputs and profanity annotations. They do not synthesize or listen to audio.

The runtime layer has its own coverage: `tests/unit/voice-assets.test.ts` (manifest parsing and full package coverage), `tests/unit/sounds.test.ts` (cue → event map, rotation, default-on setting), `tests/unit/sound-player.test.ts` (gating, generated effect preference, direct events, explicit variant, durable rotation across players), `tests/components/SoundAuditionPanel.test.ts` (sequential audition) and `tests/components/PopupView.test.ts` (signal plus line, active on start, first-done, failed-save line only after a rejected save).

Run cutter boundary, padding, count and path checks with `python -m unittest discover -s tests -p test_audio_batch_cutter.py`. Real generated sources also need the exact-count cutting check and listening review; silence detection does not establish transcript correctness.

Run the API scripts without spending credits:

```powershell
node scripts/cast-voices-api.mjs --missing --dry-run
node scripts/generate-audio-api.mjs --character desk-hulk --dry-run
node scripts/generate-effects-api.mjs --dry-run
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

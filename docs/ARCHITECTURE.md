# Architecture

What the code already reflects. Product rules: [CONCEPT.md](../CONCEPT.md).

An [explorable architecture snapshot](../.archify/architecture-app-20261030-020407/body-debugger-architecture.html)
captures the tray, windows, IPC and persistence flow as of 2026-10-30. Its saved
sources and check receipts are archival evidence; current behavior, including
popup geometry and character condition, is described below.

## Layout

```
electron/main/              # Tray, windows, IPC, app wiring
electron/main/trigger-loop.ts # Reminder schedule + active session (main SoT)
electron/main/tray.ts       # Tray menu and image slot
electron/main/tray-portrait.ts # Character face + countdown ring for the tray and taskbar
electron/main/tray-icons.ts # Legacy glyph frames; not the live icon
electron/resources/tray/    # Generated tray frames (idle / soon / standup / success / streak)
electron/main/broadcast.ts  # Window broadcast helpers
electron/main/persistence/  # JSON SoT (settings / progress / sessions / weights)
electron/main/photos.ts     # Photo files + metadata (main-owned)
electron/main/photo-protocol.ts # photo://<id> scheme for the renderer
electron/main/catalog-store.ts # Catalog V2 SoT (catalog.json + changesets)
electron/main/custom-exercises.ts # Compatibility re-exports over catalog-store
electron/main/llm/          # Optional OpenAI-compatible provider, secrets, orchestrator
electron/main/ipc/          # session-cycle, persistence, photos, catalog, llm, debug channels
electron/preload/           # contextBridge → window.api
src/                        # Vue renderer
src/bootstrap/              # hydrate Pinia from main snapshot + optional layers
src/motion.ts               # Motion preference (settings + OS) and popup exit timings
src/sounds.ts               # Cue URLs + gated renderer player (effects and character voice)
src/voice-assets.ts         # Manifest of the generated voice/effect takes (import.meta.glob)
src/photos.ts               # photo:// URL helper
src/styles/index.css        # Tailwind entry, keyframes, theme tokens, reduced-motion overrides
src/stores/                 # sessions, progress, settings, character, reminder, weight, photos, catalog, AI
src/components/             # UI (character, weight, stats, photos, catalog, AI)
src/components/catalog/     # Dashboard «Упражнения» (library / sandbox / coverage / sets / AI)
src/debug/                  # Laboratory host, panels and previews (dashboard «Лаборатория»)
src/components/character/   # Portraits, journey, chronicle and the shared progress charts
src/assets/character/       # Manifest, ten selectable identities and cut frames
src/assets/sounds/default/  # Default cue pack (mp3)
src/assets/sounds/<character>/ # Generated voice takes + archived sources
src/assets/sounds/system/   # Shared effect takes
shared/types/               # Exercise, Session, Character, Progress, Settings, Photo, Events, Persistence
shared/domain/              # Pure rules: picker v2, catalog, dose, tune, sandbox helpers, queue, character, severity, extras, weight, sounds, photos, AI, streak, stats, chronicle
shared/validation/          # Exercise + Session payload guards
shared/constants/           # stage keys, exercise/equipment catalogs, catalog axes/tuning/field-docs, themes, popup geometry
shared/types/exercise-v2.ts # Zone / Method / ExerciseV2 / FocusV2 / catalog file types
```

## Persistence (main-owned)

Main process holds the source of truth (in-memory cache + disk). Each BrowserWindow has its own Pinia; renderers hydrate via IPC and re-apply on `data:updated`.

On disk under `.userdata/data/` (see [DEVELOPMENT.md](DEVELOPMENT.md)):

| File | Payload |
|------|---------|
| `settings.json` | `AppSettings` (includes Focus V2, λ, LLM config without key, overrides, autoTune) |
| `progress.json` | `UserProgress` |
| `sessions.json` | `Session[]` (optional `plannedSec`, `pickTrace`) |
| `weights.json` | `WeightEntry[]` (optional layer) |
| `catalog.json` | Catalog V2 user/llm layer (`version: 2`, exercises + named batches) |
| `changesets.json` | Last ~30 LLM/catalog changesets (ops, inverse, status, usage) |
| `queue.json` | Next-breaks planning queue (pins / zone·method constraints / exclude-today) |
| `custom-exercises.json` | Legacy AI approvals; migrated once into `catalog.json` as batch `legacy-import` |
| `photos.json` | Photo metadata (optional layer) |

Photo **files** live outside `data/` in `.userdata/photos/`; `photos.json` only stores
`{ id, fileName, mimeType, sizeBytes, createdAt, sessionId? }`.

Envelope: `{ version: 1, data }`. Missing/corrupt → defaults. Writes are temp-file + rename.
Settings files written before a field existed are merged with the current defaults on load (`normalizeSettings`), so new optional switches never break an existing profile.
`weights.json` is backfilled from stored sessions on first load after the layer appeared, so old session weights are not lost.

Module: `electron/main/persistence/`.  
IPC: `electron/main/ipc/persistence.ts`.  
Hydrate: `src/bootstrap/hydrate.ts` loads the core snapshot and subscribes before mount. Optional photos/exercises load in the background with independent error handling.

## Session cycle (events)

```
timer / idle / manual (trigger-loop)  →  tray:set-state(standup)
                                      →  popup window (main holds the active session)
renderer pulls session:get-current-popup → { sessionId, exercise }
[Начать] → local countdown; [Готово | Отложить | Пропустить] →  session:result (+ optional reps / feeling / weight / photoIds)
                                      →  append session JSON (+ day-based streak and character recompute on done;
                                         a done weight lands in weights.json; photo ids must exist in main)
                                      →  data:updated + session:updated + session:loop-changed
                                      →  tray success/soon/idle, next trigger rescheduled
session:result acknowledgement         →  { saved: boolean }, then success feedback and close
popup closed without an answer        →  skipped
no answer for 5 minutes               →  missed (popup closed by main)
```

Main accepts only the active session's matching session/exercise identity. Replaying the same stored result returns `{ saved: true }` without appending, rewarding or rescheduling again; a conflicting replay returns false. A failed session write leaves the active session retryable and never emits success. Optional weight/progress write failures are logged separately after the session is durable. A popup still showing its saved confirmation prevents opening another session in that window.

The persisted JSON schema stays at version 1: no migration is needed. Character stage/branch are recovered from sessions on load, even if a progress checkpoint previously failed. Reverting this code does not require rewriting the profile; rollback preserves `sessions.json`, with derived progress recalculated by the current code.

### Trigger loop

`electron/main/trigger-loop.ts` owns the schedule; renderers only display it.

| Rule | Behaviour |
|------|-----------|
| Interval | Next trigger = last resolved `completedAt` + `intervalMinutes` |
| Snooze | Instead of the interval, retry after 5 minutes |
| Idle | No popups while the system is idle ≥ 60 s; away ≥ 5 min counts as a break and restarts the cycle on return |
| Pause | `settings.paused` stops scheduling; tray + dashboard toggle it; manual trigger still works |
| Missed | Open popup without an answer for 5 min → `missed`, popup closed |
| Closed popup | Closing the popup without a result → `skipped` |

### Catalog V2

Design reference: [CATALOG-V2.md](CATALOG-V2.md). Runtime pieces:

| Piece | Owner |
|-------|-------|
| Types / upgrade / validation | `shared/types/exercise-v2.ts`, `shared/domain/exercise-v2.ts` |
| Hand-retag overlays (34 shipped) | `shared/constants/exercise-v2-tags.ts` (preferred by `upgradeExercise`) |
| Resolve layers | `shared/domain/catalog.ts`, `electron/main/catalog-store.ts` |
| Picker + explanation | `shared/domain/picker.ts`; `exercise-picker.ts` is a thin v1 adapter |
| Dose / intensity cap | `shared/domain/dose.ts` (trigger loop writes `plannedSec`) |
| Coverage / target vs actual | `shared/domain/coverage.ts` |
| Changesets / LLM parse | `shared/domain/changeset.ts`, `llm-prompt.ts`, `llm-parse.ts` |
| Progress hints | `shared/domain/tune.ts` (`autoTune`: suggest / auto / off) |
| Focus V2 + λ | `shared/domain/focus-v2.ts`; old primary/accents migrate on load |
| Dashboard tab | `src/components/catalog/*`, `src/stores/catalog.ts` / `catalog-view.ts` / `sandbox.ts` / `queue.ts` |
| Field docs / playground helpers | `shared/constants/field-docs.ts`, `shared/domain/catalog-sandbox.ts` — [CATALOG-UI.md](CATALOG-UI.md) |
| Next-breaks queue | `shared/domain/queue.ts`, `electron/main/queue-store.ts`; adapter applies queue before pick |
| Pick simulator (lab) | `src/components/catalog/PickSimulatorBlock.vue` (uses `simulate()`; also embedded in Laboratory) |
| LLM IPC | `electron/main/llm/*`, `electron/main/ipc/llm.ts`, `ipc/catalog.ts` |

Shipped exercises are immutable; edits fork into a user batch (including manual library edits via `edit` changesets). `custom-exercises.json` migrates once into `catalog.json`. The LLM never runs in the reminder loop; keys stay in `safeStorage`. Mock provider: `baseUrl === 'mock://local'` (unique per-cell mock drafts; parse aliases + timer-floor bump — see [CATALOG-V2.md](CATALOG-V2.md) §7.1). UI depth (library, number explainer, playground, preference board, queue): [CATALOG-UI.md](CATALOG-UI.md).

### Exercise picker

`shared/domain/picker.ts` (adapter: `exercise-picker.ts`) — main calls it on every trigger. Optional `queue.json` slots are applied via `applyQueue` so explain and pick stay identical. Weights use zone-vector overlap, method repeat, zone neglect, share-based profile boost (λ) and mode.

| Rule | Behaviour |
|------|-----------|
| Hard filters | Missing inventory, intensity above `intensityCap(interval)`, `avoidIf` ∩ limitations, archived / disabled batch, context prefs |
| Previous / today | `1 − 0.8·overlap` with last done zones; `1 − 0.55·overlap` with today's clipped zone load |
| Method repeat | ×0.75 when the method matches the last done method |
| Neglect | Zone-weighted ×1…×1.8 by days since that zone was last done (cap 7) |
| Profile | Share-based boost toward Focus V2 targets over 14 days; λ = `profileStrength` (focus mode ×1.5, clamped) |
| Inventory | Equipment exercises need `inventory.enabled` and every listed item owned |
| Modes | `balance`; `rotation` cycles zones upper→lower→core→full; `focus` strengthens λ; `push` ×3 the most neglected zone |
| Dose | Timer scaled by `(interval/45)^0.35` inside per-exercise min/max; optional personal `overrides[id].scale` |

Skipped / snoozed / missed sessions never count as training. Character branch scoring uses Catalog V2 rules (dominant zone / method) via `upgradeExercise` in `character-progress.ts`.

### Core preferences

`shared/domain/preferences.ts` — interval and picker mode; Focus V2 lives in `shared/domain/focus-v2.ts`. `PreferencesPanel.vue` renders them on «Настройки».

| Rule | Behaviour |
|------|-----------|
| Interval | `settings.intervalMinutes`, integer 5–240; out-of-range rejected; save reschedules via `syncLoopFromSettings` and changes dose |
| Picker mode | `balance` / `rotation` / `focus` / `push`; unknown → `balance` |
| Focus V2 | Zone and method chips cycle `− / 0 / + / ++`; legacy primary/accents migrate to levels |
| λ | `profileStrength` 0…1 (default 0.7), labelled Мягко / Обычно / Жёстко |
| autoTune | `suggest` (default) / `auto` / `off` for personal dose hints on «Наборы» |
| Build | `progress.characterBuild` (`lean` / `average` / `stocky`); presentation only |
| Character | `settings.characterPackId`; Desk Hulk plus nine manifest identities |
| Storage | Interval, mode, Focus V2, λ, LLM config (no key), overrides and identity in `settings.json`; build in `progress.json` |

`#/dashboard?tab=settings` and `?tab=exercises` open those tabs. The tray «Настройки» item still deep-links settings.

The dashboard has six primary sections: «Сегодня», «Персонаж», «Лаборатория», «Прогресс», «Упражнения» and «Настройки». «Упражнения» uses `SectionTabs` for Каталог / Песочница / Покрытие / Наборы / AI (see [CATALOG-UI.md](CATALOG-UI.md)). Today contains the hero, day counts, streak, an optional next-breaks queue hint, a compact journey and optional quick weight entry. «Персонаж» uses `SectionTabs.vue`: «Профиль» and «Хроника». «Лаборатория» mounts via `LaboratoryHost.vue`. `ProgressPanel.vue` groups calendar, statistics, weight and photos. Legacy `tab=calendar` / `tab=stats` select progress subsections; `tab=playground` aliases to laboratory.

`PreferencesPanel.vue` groups interval/strictness, picker mode and Focus V2 + λ + autoTune. Selection still reuses `ComfortSettingsPanel.vue` for inventory; «Импорт из AI» links to «Упражнения». Character identity/build remain on «Персонаж».

### Popup severity

`shared/domain/severity.ts` — rules only; the popup enforces the timer/hold; main validates session identity and durable persistence. The timer is a self-report aid, not proof of physical activity.

| Level | «Готово» |
|-------|----------|
| `soft` | enabled immediately after «Начать», timer is only a hint |
| `medium` (default) | unlocks at 80% of the exercise timer |
| `hardcore` | same unlock + press-and-hold for 1.5 s |

The popup shows a countdown (`mm:ss`), a progress bar and a one-line hint for the
current level. It stays at full duration until «Начать». Keyboard hold uses Space/Enter, ignores repeat keydowns and cancels on blur/release. A durable result enters a separate readable scene: done 4500 ms, stage-up 6000 ms, skip/snooze 2500 ms, followed by a 180 ms exit. Reduced motion keeps the reading time and removes the animated exit. Every saved scene has an early-close button; unmount/early close cancels its timer. A failed save shows a retryable error without optimistic history or a reward. Closing the popup without an answer is `skipped` at every level.
Extra hardcore checks (CONCEPT §3) are not implemented yet.

### Optional session details

`shared/domain/session-extras.ts` — pure validation for historical / future payloads. ROADMAP #8 shipped the fields; the popup UI no longer collects them.

| Field | Range | Notes |
|-------|-------|-------|
| `reps` | 1–999, integer | Kept on stored `done` sessions when present |
| `feeling` | 1–5 | Same |
| `weightKg` | 20–300, one decimal | Prefer the dashboard weight card for new entries |

«Детали в попапе» was removed from «Настройки». Weight and photos are dashboard layers. Main still normalizes extras if a client sends them; values outside the ranges are dropped, never clamped.

### Weight history

`shared/domain/weight.ts` — validation, series and summary rules; `weights.json` is the SoT, written by main only.

| Rule | Behaviour |
|------|-----------|
| Range | 20–300 kg, one decimal (shared with the popup `weightKg` detail) |
| Sources | Historical `done` sessions carrying `weightKg`, or a manual entry on the dashboard |
| Idempotency | Session measurements get a deterministic id `weight:session:<sessionId>` and are skipped when present |
| Backfill | On load, `done` sessions from before this layer are merged once into `weights.json` |
| Chart window | Last 90 days (`WEIGHT_HISTORY_DAYS`); points are sorted oldest → newest |
| Summary | Latest entry overall, change = latest − earliest inside the window, goal gap = latest − target |
| Stored file | Re-validated on load; malformed entries are dropped |

The layer is **off by default** (`settings.weight.enabled`). «История веса» on «Настройки» turns it on. Today shows a compact `WeightCard` for quick entry; «Прогресс» → «Вес» shows the current value, sparkline, manual entry, goal and last five measurements (deletable). A target outside the range is ignored, `null` clears it. Nothing in the core cycle reads weight history.

### Streak

`shared/domain/streak.ts` — day-based, not a raw session counter.

| Rule | Behaviour |
|------|-----------|
| Current | Consecutive calendar days with ≥1 `done`; may end today or yesterday, otherwise 0 |
| Max | Longest consecutive run in the whole history, never lowered |
| Ignored | `skipped` / `snoozed` / `missed`, duplicate sessions on the same day |

Main stores it on `done` and recomputes it when reading a snapshot; the historical maximum is preserved. The dashboard also recomputes from history every 30 seconds and on visibility changes, so midnight and long gaps work without another session.

### Dashboard stats

`shared/domain/stats.ts` — pure aggregation, no Vue and no persistence.

| Function | Output |
|----------|--------|
| `buildHeatmap` | Last N local days (default 91), per-status counts, 0–3 intensity, Monday-first weeks with `null` padding |
| `summarizeStats` | Done/skipped/snoozed/missed totals, active days, done in the last 7 days, average per active day, zone shares, group counts, top 5 exercises |

`CalendarHeatmap` and `StatsPanel` render these (heatmap, seven-day bars, zone shares, top list); unknown exercise ids fall back to the raw id.

### Sounds

`shared/domain/sounds.ts` + `src/sounds.ts` — optional layer, enabled at 40% for new profiles. Explicit stored preferences are preserved; legacy files without a sound block stay muted.

| Rule | Behaviour |
|------|-----------|
| Settings | `sound { enabled, volume 0..1, packId, voiceEnabled }`, normalized on load; unknown pack → `default`; missing voice flag → on, explicit false stays off |
| Gate | Master switch, audible volume, paused reminders and quiet/DND context suppress playback |
| Cues | `popup`, `done`, `skip`, `snooze`, `stage-up`, `streak`, `alert`, `error` map to the generated `system/` effect takes, with `default/*.mp3` as fallback |
| Voice | `VOICE_CUE_EVENTS` maps a cue to a spoken event plus direct `active` / `first-done` calls; variants rotate without immediate repeats (last take survives popup recreation; chronicle preview uses a separate namespace via `SessionPopupPayload.preview`) and the line replaces the signal, which stays as the fallback |
| Popup | Line on mount (`ready`), `active` on timer start, result voice after the durable acknowledgement with the generated cue as fallback; a done session that raises the stage speaks `stage-up` instead of `done`; `error/01` only after a rejected save |
| Failure | A rejected `audio.play()` is logged and swallowed; audio never breaks the core cycle |

Stage-up is automatic; `streak` has a generated effect and a debug preview but no automatic milestone trigger yet. The generated voice is authored in [Audio production](AUDIO-PRODUCTION.md), on by default, and auditioned in the laboratory «Звуки» tab.

### Progress photos

`shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`.

| Rule | Behaviour |
|------|-----------|
| Input | Renderer sends bytes + MIME; JPEG/PNG/WebP only, 1 byte–8 MB |
| Storage | Main writes `.userdata/photos/<uuid>.<ext>` + `data/photos.json`; renderer only sees metadata |
| Serving | `photo://<id>` resolves only ids present in metadata; unknown → 404 |
| Session | At most 6 `photoIds`; main drops ids that do not exist before writing the session |
| UI | «Прогресс» → «Фотографии» shows a gallery with add/delete; the popup no longer attaches photos |

The layer is off by default (`settings.photos.enabled`). `photoIds` are only carried by `done` sessions.

`<img src="photo://…">` only works because the renderer CSP lists `photo:` in `img-src` ([index.html](../index.html)); `'self'` does not cover a different scheme. `tests/unit/csp.test.ts` pins that down — dropping the scheme silently blanks the popup thumbnail and the gallery.

### AI proposals and Catalog LLM

Paste-import (legacy UI path): `shared/domain/ai-proposal.ts` still validates a single `Exercise` and `catalog-store.addCustomExercise` writes into `catalog.json` (batch «Мои упражнения»). Shipped ids always win.

Provider path (dashboard «Упражнения → AI»): OpenAI-compatible chat via `electron/main/llm/` (DeepSeek-compatible). Config in settings; API key in `safeStorage` only. Flow: preview payload → run → parse/validate ops → awaiting approval → atomic apply with inverse ops → revert. Kinds: `generate`, `edit`, `retag`, `tune`. Nothing is written without approval. Runtime picker never calls the network. `llm.shareProgress` (default off) gates progress-advisor payloads. Details: [CATALOG-V2.md](CATALOG-V2.md).

### Themes and inventory

| Layer | Rules |
|-------|-------|
| Themes | `shared/constants/themes.ts`; `<html data-theme>` swaps Tailwind color tokens in `src/styles/index.css`; unknown id → `default` |
| Inventory | `shared/constants/equipment.ts` lists bag / punching bag / band / dumbbells; owned ids gate equipment exercises in the picker |

### Chronicle, laboratory and shared playback

«Персонаж → Хроника» is the read-only view of the real profile: timeline, calendar and statistics wrapped in a `CharacterContext` object, plus `ManualCharacterControls` that change only the preview (form, condition, build, branch, emotion). The manual override is component state; it is never persisted. Play uses the shared arcade `NativePlayback` engine in preview mode (popups without writes, LabDriver on `active.preview`). «Лаборатория» mounts the full laboratory natively in the same dashboard window.

The laboratory is no longer a separate window or a `dev:lab` entry. Main spawns a headless Electron child with `--body-debugger-lab --body-debugger-lab-headless` and an isolated profile: `.userdata/laboratory/` when unpackaged, `<userData>/laboratory` when packaged. The child runs the reminder loop, owns the laboratory plan, native popup/preview windows and settings/data; it opens no tray or dashboard. The normal dashboard stays open the whole time.

The embedded lab is a native Vue host (`LaboratoryHost`) with a nested Pinia and a lab-facing renderer API stack (`rendererApi`). `electron/main/lab-engine.ts` is the parent half of the bridge: the host sends `lab:view-register`, then `lab:bridge-request` calls; the engine pre-warms/spawns the child, forwards requests over Node IPC and relays only `LabChanged` (with sandbox snapshot) back. `electron/main/lab-headless.ts` dispatches those requests in the child. Only the registered dashboard host is accepted by the bridge; the real profile never receives laboratory mutations. The sandbox does not initialize the updater. Leaving the tab pauses the run but leaves the headless engine alive for the app session. Chronicle and laboratory share `playback-coordinator` (mutex + 30 s reminder grace).

| Part | Owner |
|------|-------|
| Chronicle context and manual preview | `ManualCharacterControls.vue`, `shared/domain/character-context.ts` |
| Chronicle → LabPlan adapter / IPC playback | `shared/domain/chronicle.ts` (`chronicleToLabPlan`), `electron/main/chronicle-playback.ts` |
| Shared playback mutex + reminder grace (+30 s) | `shared/domain/playback-coordinator.ts`, `electron/main/playback-coordinator.ts` |
| Lab host / panel / API stack | `src/debug/LaboratoryHost.vue`, `src/debug/LaboratoryPanel.vue`, `src/renderer-api.ts` |
| Profile gate and path | `electron/main/lab-environment.ts`; unpackaged `.userdata/laboratory/`, packaged `<userData>/laboratory`; checked before persistence loads |
| Stories, deterministic generator, import boundary and checkpoint explanations | `shared/domain/laboratory.ts` |
| Plans, rewind, saved runs, native popup controls and manual branching | `electron/main/laboratory.ts` |
| Parent/child bridge and lab-only data services | `electron/main/lab-engine.ts`, `electron/main/lab-headless.ts`, `electron/main/ipc/` |
| Native phases, action acknowledgements and cancellation | `electron/main/laboratory-playback.ts`, `shared/domain/laboratory-playback.ts` |
| Compact completion/condition charts and activity strip | `src/components/character/ProgressDynamics.vue`; shared condition transitions and stage thresholds |
| Runtime app clock | `shared/domain/clock.ts`; clock metadata travels with main snapshots |
| Renderer runtime projection | `src/stores/runtime.ts`; applied before hydrating domain stores |
| Laboratory UI sections | `src/debug/LaboratoryPanel.vue`, `src/debug/AppearancePanel.vue`, `src/debug/SoundAuditionPanel.vue` |

Silent date viewing reconstructs only the selected prefix. Arcade replay is a non-overlapping chain: cursor jump and scene beat, popup ready, semantic start/choice (no exercise wall-clock), durable save, voice-gated reaction, close, next event. There is no user tempo control; fixed `ARCADE_SCENE_MS` beats separate links. Reading time is at least `reactionDuration` and never shorter than the spoken line plus a 1 s tail (`waitForPlayback`); arcade advances only after `feedback-complete`, not merely because the window closed. The active popup sends that ack before closing; main also waits for the window to disappear and reports a retryable error if closing stalls. A paused/stepped run cannot bypass an open result scene. The semantic driver runs for laboratory clock **or** chronicle `preview`, unlocks the severity gate for arcade, and keeps a real-time Hardcore hold. Main checks generation, command sequence and session identity; driver acknowledgements are accepted from the active popup WebContents (lab child or main preview). Late popup close/resize requests also require the currently active WebContents.

Controller-owned popup openings do not interrupt replay. Actual user actions cancel automatic dispatch and form a manual branch; the original resolved future is retained separately. A durable outcome publishes its cursor and snapshot together to the laboratory. Normal dashboard hydration uses the same canonical result. Pause freezes application time and result deadlines, cancels a partial hold and rearms remaining work on resume. Leaving the laboratory tab pauses the driver without losing the run; the headless engine stays alive for the app session. Seeking/reset/mode changes invalidate the generation and cancel the discarded native session before closing its window.

The laboratory uses a permanent scenario transport above a responsive workspace on the «Лаборатория» tab: sticky live/profile scene and dynamics beside six sections («Сценарии», «Попап и цикл», «Ручная проверка», «Звуки», «Данные», «Настройки»). Profile settings reuse production components through the lab bridge. The manual section exposes six clickable stage cards, four temporary condition levels, branches, builds and emotions. Its cached local state drives the permanent scene while the manual tab is active; returning to scenarios restores history-derived visuals. A shared `PopupFeedback.vue` renders durable popup results and visual result previews. Inline popup buttons and `#/laboratory-preview` use runtime-only visual state (`shared/domain/laboratory-preview.ts`), never the session-result IPC. Main validates every override; `visual-preview` updates a separate native window and `close-preview` closes it without touching history, clock or playback. Native and inline previews can be clicked through ready/start/result/skip/snooze/error states, and manual selections are held by default. `popup.exerciseId` is optional and must exist in the merged approved catalog before any preset mutation. The normal preset preserves all preferences; named presets change only their advertised setting/history. `restore-preferences` restores the original plan's settings/build without changing the cursor or sessions. `reset-history` preserves preferences and auxiliary data; `reset` resets sessions/progress/settings and retains weights, photos, approved exercises and the saved run.

Saved plans use laboratory format 2 with semantic actions, character/build, settings, generator parameters and resolved events; the save envelope also retains the original plan, branch flag, mode and cursor. Version-1 imports are explicitly converted to inferred actions, not presented as recorded input. Production history/envelope schemas are unchanged. The sound block is the exception inside a plan snapshot: applying a plan keeps the live `settings.sound`, so a mute saved in a scenario cannot silence replay, and a muted profile is called out in the transport with a one-click enable. Detailed migration, rollback and verification limits: [TESTING.md](TESTING.md).

### Character chronicle

`shared/domain/chronicle.ts` builds a read-only timeline over the real session history. It normalizes timestamps, sorts and de-duplicates identities, then precomputes an entry per session: `start`, each resolved session and a final `now` entry when it is later than the last result. Stage is computed incrementally from the done count, branch from the last 30 done sessions, condition from the shared transition rules; streak changes and gaps become milestone markers. `chronicleSummary` reuses `shared/domain/character-summary.ts`, the same helper behind `labSummary`; `describeSummaryChange` is shared by the laboratory explanation and the chronicle. `chronicleDateIndex` maps a local date to the last entry before its end.

`CharacterChronicle.vue` receives `now` and a `CharacterContext` (`shared/domain/character-context.ts`: sessions, pack, build, `allowStart`, optional `manual`) under «Персонаж → Хроника» (with the start action and temporary manual controls). Transport play/pause/seek/step/date goes through `chronicleCommand` IPC into `electron/main/chronicle-playback.ts`, which feeds the shared arcade `NativePlayback` from `chronicleToLabPlan` in preview mode (popups open with `playbackCharacterAt` overlay; `commit` does not write the real profile). The scene portrait follows the cursor's stage/branch/condition/emotion; preview popups use the overlay instead of live progress; a manual state replaces only those scene values, while calendar, statistics and metrics continue to follow the cursor. `CalendarHeatmap`, `ProgressDynamics` and `StatsPanel` receive only the prefix up to the cursor. Playback stops on pause, unmount, hidden window and the end of history. Real timer/manual reminders stay deferred while chronicle or laboratory playback is busy and for 30 s after `endPlayback`. `ProgressDynamics.vue` and `buildProgressDynamics` are shared by the laboratory and the chronicle.

### Character progress

`shared/domain/character-progress.ts`, recomputed in main on every `done` and stored in `progress.json`.

| Rule | Behaviour |
|------|-----------|
| Stage | Total **done** sessions: 3 → 1, 8 → 2, 20 → 3, 45 → 4, 80 → 5 (`start`…`peak`) |
| Branch | Last 30 done sessions; each scores one point for its primary direction |
| Direction order | Posture zone (neck / shoulders / upper back / lower back) → strength / striking (`power`) → mobility / balance (`mobility`) |
| Neutral fallback | Fewer than 3 points for the leader, or the leader does not beat the runner-up by 20% |
| Streak | Day-based `current` / `max` recomputed on `done` (see above) |

`characterBuild` stays a user preference; visuals resolve from stage + branch + build + emotion + temporary condition.

### Temporary character condition

[shared/domain/character-condition.ts](../shared/domain/character-condition.ts) derives visual condition from saved sessions; `useCharacterStore` recomputes it after hydration and every history update.

| Rule | Behaviour |
|------|-----------|
| Neglect | `skipped` (including closing a popup) / `missed` add 1 point, capped at 10 |
| Recovery | `done` subtracts 2, floored at 0; no future credit; at most five completions fully restore condition |
| Levels | 0 below 3 points; 1 at 3; 2 at 6; 3 at 10 |
| No passive penalty | Snoozes and time passing without saved results do not change condition, including pause, idle and a closed app |
| History | Chronological result timestamps (`completedAt`, otherwise `triggeredAt`); invalid timestamps ignored, duplicate ids counted once |
| Presentation | `lean` becomes scrawny, `average` / unset build slouches, `stocky` becomes potbellied; earned stage, branch and selected build stay unchanged |
| UI | Today shows condition points and completions needed for full recovery; completion portraits remain expressive |

No field or schema version is added to JSON: existing saved results immediately determine condition, including historical skips. Rollback only requires reverting code/assets; session history and earned progression remain compatible.

### Character visuals

Rules: `shared/domain/character-visual.ts` (pure). Frames: `src/assets/character/*/frames/`, cut from the source sheets by `scripts/cut-character-sprites.py`.

Desk Hulk source frames (the other identities follow the manifest contract linked below):

| Frame | Key | Drawn in |
|-------|-----|----------|
| Stage body | `stage-{0,2,4}-{build}` | `sprite-sheet-stages.png`, first three rows |
| Branch pose | `pose-{branch}-{build}` | `sprite-sheet-branches.png` |
| Emotion bust | `emotion-{emotion}-{build}` | `emotions/emotions-set-{1,2,3}.png` |
| Neglect body | `neglect-{1,2,3}-{build}` | `sprite-sheet-neglect.png`, rows = severity, columns = lean / average / stocky |

| Rule | Behaviour |
|------|-----------|
| Build | `neutral` (not chosen) → `average` body |
| Stage tiers | Desk Hulk: stages 0–1 → `stage-0`, 2–3 → `stage-2`, 4–5 → `stage-4`. Other supplied identities have six distinct `stage-{0..5}` frames |
| Branch pose | `power` / `mobility` replace the body from stage 4 (strong/peak form) |
| Neglect | Condition levels 1–3 override stage and branch body; fallback: matching neglect build → average neglect → matching stage-0 body → average stage-0 → emoji |
| Emotion | `emotion-*` busts feed the popup face; `surprised` uses the happy bust |
| Fallback | requested frame/build → average build → neutral body/face of the same identity → emoji. Image-load errors continue through the same candidates; laboratory diagnostics report the fallback |

`CharacterPortrait` normally renders `variant="body"` on the dashboard and switches to a large `variant="face"` for 4.5 seconds after a completion or 6 seconds after a milestone; the popup uses `variant="face"`; `src/components/character/frames.ts` maps a winning key to the bundled URL. Source sheets stay in the repo as the only art source — never edit `frames/` by hand.

The runtime glob bundles Desk Hulk and all nine supplied characters (432 additional frames). [packs.json](../src/assets/character/packs.json) owns the cast IDs and labels; `shared/constants/character-packs.ts` adds the built-in default and normalizes unknown IDs. `CharacterPicker.vue` is reused by the character profile and laboratory, with a compact selector beside the live test scene. The chosen identity is passed through dashboard bodies, popup faces/reactions and appearance previews. Frame lookup never switches to a different identity when a selected pack lacks a frame. The cutter and source contracts remain in the [art library](../src/assets/character/README.md).

### Comic reactions

`shared/domain/character-reaction.ts` owns event → emotion/tone/caption/silhouette/decor rules. Variants are deterministic; UI reaction identities allow the same emotion to animate again. `useCharacterStore.react` keeps the caption and emotion together without writing progress. Session-history length seeds variation across separate popup windows; a previous-caption guard prevents immediate repeats. Reaction counters are UI-only and are not persisted.

`ComicBubble.vue` renders text safely as text, with a heading variant for the hero and a compact variant for the popup. Speech clouds, SVG bursts, achievement ribbons and soft clouds share CSS paper, ink and milestone tokens across all themes. Cheer/milestone captions pop briefly; calm invitations, pause and skips do not. Global reduced-motion rules suppress those animations.

The dashboard restores the current body (including temporary neglect) after a reaction and keeps skip/snooze captions calm. The popup changes ready → focused on explicit start, then chooses first-done/done/stage-up only after durable acknowledgement. No caption is treated as proof of physical activity. Corner HUD geometry is a normal bottom-packed flex column (full-width title/instruction, then timer/actions + portrait): 360 px base, plus 36 px for errors (max 460) in `shared/constants/popup.ts`.

### Motion

CONCEPT §13 micro-animations. Each surface owns its own effect:

| Surface | Motion |
|---------|--------|
| Tray | The live icon is the current character's head plus a green countdown ring (`shared/domain/tray-countdown.ts`, `electron/main/tray-portrait.ts`). The last 20 seconds blink yellow; reduced motion keeps that arc solid yellow. The same image is the dashboard taskbar icon |
| Popup | `.popup-in` entrance, `.timer-urgent` pulse in the last 10 s, then on `done`: flash + happy crossfade + `.popup-out-done`; skip / snooze use `.popup-out-quiet`. Reading time and the 180 ms exit are separate; `shared/domain/reaction-timing.ts` owns the durations |
| Character | `CharacterPortrait` crossfades sprite frames (`<Transition name="frame-fade">`), bounces on happy/surprised reactions, and fades in on the dashboard |
| Dashboard | Large reaction portrait, then restoration of the stage body; selection feedback and brief panel entrances; a one-second environmental accent every ten seconds while idle |

Reduced motion: `src/motion.ts` combines `settings.reduceMotion` with the OS `prefers-reduced-motion`. `App.vue` mirrors it into `data-reduce-motion` on `<html>` and tracks window visibility; idle accents stop in hidden windows and during reactions; `src/styles/index.css` then collapses animation/transition durations. Timed effects check the preference in code — the tray warning blink uses the app setting only, because the main process cannot read the media query.

The stretching-figure glyph in `electron/resources/tray/` is no longer the live icon. `success` still swaps the face to happy for 1.5 seconds. The `streak` frame set is unused until a milestone drives it.

### Data channels

| Channel | Direction | Role |
|---------|-----------|------|
| `data:get-snapshot` | invoke | Full `{ settings, progress, sessions, weights }` |
| `data:save-settings` | invoke | Replace settings, broadcast, reschedule if interval/pause changed |
| `data:save-progress` | invoke | Replace progress, broadcast |
| `data:add-weight` | invoke | Append a manual measurement (`{ weightKg, at? }`), broadcast |
| `data:remove-weight` | invoke | Delete a measurement by `{ id }`, broadcast |
| `data:updated` | main → renderers | Snapshot after any write |
| `photo:list` / `photo:add` / `photo:remove` | invoke | Photo metadata, byte upload (main validates + writes), delete |
| `photos:updated` | main → renderers | Photo metadata after add/remove |
| `exercise:list-custom` / `exercise:add-custom` / `exercise:remove-custom` | invoke | Approved AI exercises |
| `exercise:updated` | main → renderers | Approved list after add/remove |
| `app:get-info` / `app:open-logs` | invoke | Build identity (version, commit, date, packaged, channel, profile, log dir) and opening the log folder |
| `app:get-launch-at-login` / `app:set-launch-at-login` | invoke | Read/write the OS login item; installed Windows builds only, always with `--hidden` |
| `app:get-tray-pin` / `app:set-tray-pin` | invoke | Read/write Windows 11 `NotifyIconSettings` `IsPromoted` for this executable; installed builds only |
| `app:update-state` / `app:update-check` / `app:update-install` | invoke | Current update state, manual check, restart into a downloaded version; a refusal reports `popup-open` / `not-ready` |
| `app:update-dismiss` | invoke | Hide the update prompt for the current version until the next run |
| `app:update-changed` | main → renderers | Update state after every check, download progress, ready and error |
| `lab:view-register` | laboratory host → main | Registers the only WebContents allowed to use the laboratory bridge |
| `lab:bridge-request` | laboratory host invoke → main engine | Forwards snapshot/settings/progress/weight/photo/exercise/loop/lab requests to the headless child |
| `lab:get-state` / `lab:command` / `lab:changed` | invoke / main → renderers | Laboratory-child popup/preview and lab service timeline/native phases; durable outcomes include a coherent snapshot |
| `lab:driver` / `lab:driver-ack` | main → popup / invoke | Semantic popup actions and correlated acknowledgements; active lab/chronicle popup only |
| `playback:get-state` / `playback:begin` / `playback:end` / `playback:changed` | invoke / main → renderers | Shared playback mutex (`chronicle` \| `laboratory`) and post-run reminder grace |
| `chronicle:get-state` / `chronicle:command` / `chronicle:changed` | invoke / main → renderers | Real-history arcade playback transport (preview, no profile writes) |
| `window:open-dashboard` | invoke | Open / focus the dashboard |
| `session:get-current-popup` | invoke | Active popup payload (`{ sessionId, exercise }` or `null`) |
| `session:get-loop-state` | invoke | `{ paused, nextTriggerAt, intervalMinutes }` |
| `session:loop-changed` | main → renderers | Same payload after every reschedule |
| `session:result` | invoke | Matching active result → `{ saved: boolean }`; exact retries are idempotent |
| `window:navigate-dashboard` | main → renderer | Open «Настройки» in an existing dashboard |
| `session:updated` | main → renderers | Resolved session + tray state |
| `window:open-popup` / `window:close-popup` | invoke | Open / close the popup window |
| `window:resize-popup` | invoke | Grow / shrink the popup (base height; +36 px when a save error is shown) |

Channels: `shared/types/events.ts` (`IpcChannels`).
Registration: `electron/main/ipc/session-cycle.ts`, `electron/main/ipc/persistence.ts`, `electron/main/ipc/updates.ts`, `electron/main/ipc/app.ts`, `electron/main/lab-engine.ts`, `electron/main/playback-coordinator.ts`, `electron/main/chronicle-playback.ts`.
Preload: `electron/preload/index.ts`.

Gotcha: sandbox `DataUpdated` is **not** forwarded to the dashboard host — only `LabChanged` with an attached snapshot — so the real-profile Pinia cannot be overwritten by laboratory hydrates.

### Delivery windows and identities

- `electron/main/app-identity.ts` derives the channel from `app.getName()`/`app.isPackaged`: prod `Body Debugger`/`com.bodydebugger.app`, dev `Body Debugger Dev`/`com.bodydebugger.app.dev`. `index.ts` applies the AUMID, the dashboard window uses the title/icon, and the tray tooltip gets a `Dev · ` prefix.
- `electron/main/windows/update-prompt.ts` owns a separate 420×232 always-on-top window at `#/update-prompt`. It is not a session popup: it has no session IPC, reads `app:update-state`/`app:update-changed`, and hides while the exercise popup is open.
- `electron/main/launch-at-login.ts` reads/writes the Windows login item with `name = product title`, `path = process.execPath`, `args = ['--hidden']`. `index.ts` skips the dashboard when that argument is present, while a manual second launch still opens it. No profile field stores this state.
- `electron/main/updater.ts` selects `dev` channel + prerelease for the dev build and stable `latest` for prod; the prompt gate and dismissal live in `shared/domain/update.ts`.

## Already in code

| Area | Status |
|------|--------|
| Types (Exercise, Session, Character, Progress, Settings, Persistence) | Yes |
| Exercise type-guard | Yes — `shared/validation/exercise.ts` |
| Pinia stores + hydrate from main | Yes |
| JSON persistence (settings / progress / sessions) | Yes |
| Character stage/branch from history (persisted on `done`) | Yes — [ROADMAP.md](ROADMAP.md) #4 |
| Exercise catalog (34 exercises, zones, equipment, focus tags) | Yes |
| Weighted picker (penalties, neglect, Focus, modes) | Yes — [ROADMAP.md](ROADMAP.md) #3 |
| Tray + menu (Dashboard / Trigger now / Pause / Quit) | Yes |
| Popup (320×360 corner HUD, up to 460 for errors) + Dashboard windows | Yes |
| IPC cycle + persistence wiring | Yes |
| Trigger loop (interval, idle, snooze, missed, pause) | Yes — [ROADMAP.md](ROADMAP.md) #2 |
| Popup shows the triggered exercise (pulled from main) | Yes |
| Popup severity (timer gate, hold to confirm) | Yes — [ROADMAP.md](ROADMAP.md) #5 |
| Dashboard: character hero + day counts + next form; grouped settings, separate character profile and progress sections | Yes |
| Core preferences (interval, picker mode, Focus, build) + «Настройки» tab | Yes — dashboard tab and tray deep link |
| Optional session details (reps / feeling / weight) | Domain + history yes; popup UI removed — weight/photos on dashboard; ROADMAP #8 |
| Weight history (sparkline, manual entries, goal) | Yes — dashboard card; sessions backfilled once; ROADMAP #8 (partial) |
| Tailwind + routed dashboard / popup views | Yes |
| Desk Hulk source sheets + 42 cut frames under `src/assets/character/desk-hulk/` | Yes — includes nine temporary neglect bodies |
| CharacterPortrait (body / face frames + emoji fallback) | Yes |
| Tray portrait + countdown ring (taskbar shares the image) | Yes — [ROADMAP.md](ROADMAP.md) #7 |
| Motion preference (popup, character, tray) | Yes — dashboard switch + OS setting |
| Default sound pack + gated playback + mute/volume | Yes — [SOUNDS.md](SOUNDS.md) |
| Progress photos (main files, popup attach, dashboard gallery) | Yes — ROADMAP #8 |
| AI proposal validation + explicit approval + custom catalog | Yes — ROADMAP #8 |
| Themes + inventory UI | Yes — ROADMAP #8 |
| Dashboard heatmap + stats | Yes — ROADMAP #11 |
| Vitest suite + laboratory sandbox + playback coordinator | Yes — chronicle/lab mutex, headless engine/bridge, native semantic replay, virtual app time, seeded calendars, manual branches and compact dynamics; [TESTING.md](TESTING.md) |

## Where rules live

| Rule | File |
|------|------|
| Reminder schedule (interval, idle, snooze, missed, pause) | [electron/main/trigger-loop.ts](../electron/main/trigger-loop.ts) |
| Exercise weights / penalties / modes | [shared/domain/exercise-picker.ts](../shared/domain/exercise-picker.ts) |
| Interval bounds, picker modes, Focus normalization | [shared/domain/preferences.ts](../shared/domain/preferences.ts) |
| Focus directions + labels | [shared/constants/focus.ts](../shared/constants/focus.ts) |
| Exercise catalog (ids are permanent) | [shared/constants/exercises.ts](../shared/constants/exercises.ts) |
| Popup severity rules | [shared/domain/severity.ts](../shared/domain/severity.ts) |
| Session detail ranges + normalization | [shared/domain/session-extras.ts](../shared/domain/session-extras.ts) |
| Weight ranges, series, goal gap | [shared/domain/weight.ts](../shared/domain/weight.ts) |
| Popup geometry (heights / margins) | [shared/constants/popup.ts](../shared/constants/popup.ts) |
| Stage / branch from history | [shared/domain/character-progress.ts](../shared/domain/character-progress.ts) |
| Temporary neglect / recovery | [shared/domain/character-condition.ts](../shared/domain/character-condition.ts) |
| Character frame keys + fallbacks | [shared/domain/character-visual.ts](../shared/domain/character-visual.ts) |
| Motion keyframes + reduced-motion CSS | [src/styles/index.css](../src/styles/index.css) |
| Motion preference + popup exit timings | [src/motion.ts](../src/motion.ts) |
| Tray portrait + ring | [electron/main/tray-portrait.ts](../electron/main/tray-portrait.ts) |
| Character presentation | `src/components/character/` + `src/assets/character/` |
| Sound cues / packs | [SOUNDS.md](SOUNDS.md) + `src/assets/sounds/` |
| Sound settings + playback gate | `shared/domain/sounds.ts` + `src/sounds.ts` |
| Progress photos (types, limits, file naming) | `shared/domain/photos.ts` |
| AI proposal parsing / approval / merge | `shared/domain/ai-proposal.ts` |
| Streak (day-based current / max) | `shared/domain/streak.ts` |
| Dashboard heatmap / stats | `shared/domain/stats.ts` |
| Theme ids + token overrides | `shared/constants/themes.ts` + `src/styles/index.css` |
| Equipment catalog | `shared/constants/equipment.ts` |
| Native laboratory plans / main controller | [shared/domain/laboratory.ts](../shared/domain/laboratory.ts), [electron/main/laboratory.ts](../electron/main/laboratory.ts) |
| App time / real-time default | [shared/domain/clock.ts](../shared/domain/clock.ts) |
| Tests + native laboratory workflow | [TESTING.md](TESTING.md) |
| IPC schema | `shared/types/events.ts` + `electron/main/ipc/` |
| JSON persistence | `electron/main/persistence/` |
| External Exercise validation | [shared/validation/exercise.ts](../shared/validation/exercise.ts) |

## Invariants

1. One popup = one exercise (`PopupView` must not render a list).
2. Optional fields stay optional; core does not depend on AI/photos/sounds.
3. Character progress from data; PNGs and sound packs are presentation only.
4. External Exercise payloads must pass validation before entering the catalog.
5. Approved AI exercises never overwrite shipped ids and require explicit confirmation.
6. Photos are main-owned files; renderers get metadata and a `photo://` URL only.
7. Optional layers fail closed: bad sound settings, photo bytes or proposals are dropped, not clamped into the core.
8. Durable state is owned by main; Pinia is a per-window projection.

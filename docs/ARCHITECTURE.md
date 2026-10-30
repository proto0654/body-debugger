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
electron/main/tray.ts       # Tray icon animation + menu
electron/main/tray-icons.ts # Frame sets per TrayState
electron/resources/tray/    # Generated tray frames (idle / soon / standup / success / streak)
electron/main/broadcast.ts  # Window broadcast helpers
electron/main/persistence/  # JSON SoT (settings / progress / sessions / weights)
electron/main/photos.ts     # Photo files + metadata (main-owned)
electron/main/photo-protocol.ts # photo://<id> scheme for the renderer
electron/main/custom-exercises.ts # Approved AI exercises
electron/main/ipc/          # session-cycle, persistence, photos, AI, debug channels
electron/preload/           # contextBridge → window.api
src/                        # Vue renderer
src/bootstrap/              # hydrate Pinia from main snapshot + optional layers
src/motion.ts               # Motion preference (settings + OS) and popup exit timings
src/sounds.ts               # Cue URLs + gated renderer player
src/photos.ts               # photo:// URL helper
src/styles/index.css        # Tailwind entry, keyframes, theme tokens, reduced-motion overrides
src/stores/                 # sessions, progress, settings, character, reminder, weight, photos, AI
src/components/             # UI (character, weight, stats, photos, AI)
src/debug/                  # Dev-only panel + scenario builders
src/assets/character/       # Desk Hulk source sheets + cut frames
src/assets/sounds/default/  # Default cue pack (mp3)
shared/types/               # Exercise, Session, Character, Progress, Settings, Photo, Events, Persistence
shared/domain/              # Pure rules: picker, character, severity, extras, weight, sounds, photos, AI, streak, stats
shared/validation/          # Exercise + Session payload guards
shared/constants/           # stage keys, exercise/equipment catalogs, themes, popup geometry
```

## Persistence (main-owned)

Main process holds the source of truth (in-memory cache + disk). Each BrowserWindow has its own Pinia; renderers hydrate via IPC and re-apply on `data:updated`.

On disk under `.userdata/data/` (see [DEVELOPMENT.md](DEVELOPMENT.md)):

| File | Payload |
|------|---------|
| `settings.json` | `AppSettings` |
| `progress.json` | `UserProgress` |
| `sessions.json` | `Session[]` |
| `weights.json` | `WeightEntry[]` (optional layer) |
| `custom-exercises.json` | Approved AI exercises (optional layer) |
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

### Exercise picker

`shared/domain/exercise-picker.ts` — pure function, main calls it on every trigger.

| Rule | Behaviour |
|------|-----------|
| Base | Every available exercise starts at weight 1 |
| Previous session | ×0.2 for the same category, ×0.45 for the same group (last **done** session only) |
| Done today | ×0.45 for a category already trained today, ×0.8 for the group |
| Neglect | ×1…×1.8 by days since the category was last done (caps at 7 days) |
| Focus | ×1.6 for the primary direction, ×1.25 for an accent |
| Inventory | Equipment exercises need `inventory.enabled` and the owned item |
| Modes | `balance` (default), `rotation` (drops the previous category), `focus` (×2.4 primary), `push` (×3 for the most neglected category) |

Skipped / snoozed / missed sessions never count as training. Difficulty and
`exerciseLevels` are not weighted yet — a later pass, once stage/severity data is used.

### Core preferences

`shared/domain/preferences.ts` — interval, picker mode and Focus rules; `src/components/settings/PreferencesPanel.vue` renders them on the dashboard «Настройки» tab.

| Rule | Behaviour |
|------|-----------|
| Interval | `settings.intervalMinutes`, integer 5–240; out-of-range and non-numeric input is rejected, never clamped; every save reschedules the loop through `syncLoopFromSettings` |
| Picker mode | `balance` / `rotation` / `focus` / `push`; an unknown id falls back to `balance` on load |
| Focus | One primary direction plus accents; unknown ids are dropped, accents stay unique and never repeat the primary |
| Build | `progress.characterBuild` (`lean` / `average` / `stocky`); presentation only, `neutral` means "not chosen" |
| Storage | Interval, mode and Focus live in `settings.json`; build lives in `progress.json` |

`#/dashboard?tab=settings` opens the tab directly. The tray «Настройки» item opens it in a new dashboard or sends `window:navigate-dashboard` to an existing window without reloading the renderer.

`ComfortSettingsPanel.vue` owns severity, themes, reduced motion and optional switches; AI imports appear there. «Сегодня» contains the character hero, day counts, live streak and `characterJourney` (the same thresholds used by character progression), plus enabled weight/photo cards. Stage changes and completed breaks trigger a brief non-blocking banner. The Electron application menu is hidden by default. The dashboard height is capped at 900 px and the available work area minus 80 px; shorter screens keep normal scrolling.

### Popup severity

`shared/domain/severity.ts` — rules only; the popup enforces the timer/hold; main validates session identity and durable persistence. The timer is a self-report aid, not proof of physical activity.

| Level | «Готово» |
|-------|----------|
| `soft` | enabled immediately after «Начать», timer is only a hint |
| `medium` (default) | unlocks at 80% of the exercise timer |
| `hardcore` | same unlock + press-and-hold for 1.5 s |

The popup shows a countdown (`mm:ss`), a progress bar and a one-line hint for the
current level. It stays at full duration until «Начать». Keyboard hold uses Space/Enter, ignores repeat keydowns and cancels on blur/release. A saved done result remains readable for 1000 ms even with reduced motion; skip/snooze exit quietly. A failed save shows a retryable error without optimistic history or a reward. Closing the popup without an answer is `skipped` at every level.
Extra hardcore checks (CONCEPT §3) are not implemented yet.

### Optional session details

`shared/domain/session-extras.ts` — pure validation; the popup collects the values, main normalizes them before writing. This is the first slice of ROADMAP #8.

| Field | Range | Input |
|-------|-------|-------|
| `reps` | 1–999, integer | number |
| `feeling` | 1–5 | five chips |
| `weightKg` | 20–300, one decimal | number (step 0.1) |

The block is **off by default**. «Детали в попапе» on «Настройки» sets `settings.sessionExtras.enabled`; the popup then shows a collapsed «Детали (необязательно)» row. Values outside the ranges are dropped, never clamped, and a result still resolves without details. Details are stored only for `done` sessions — snooze / skip / miss never carry them. Expanding the block grows the popup via `window:resize-popup` (heights in `shared/constants/popup.ts`) while the window stays anchored to the bottom-right corner. Values remain in session history; weight measurements also feed the optional weight card.

### Weight history

`shared/domain/weight.ts` — validation, series and summary rules; `weights.json` is the SoT, written by main only.

| Rule | Behaviour |
|------|-----------|
| Range | 20–300 kg, one decimal (shared with the popup `weightKg` detail) |
| Sources | A `done` session carrying `weightKg` (popup details), or a manual entry on the dashboard |
| Idempotency | Session measurements get a deterministic id `weight:session:<sessionId>` and are skipped when present |
| Backfill | On load, `done` sessions from before this layer are merged once into `weights.json` |
| Chart window | Last 90 days (`WEIGHT_HISTORY_DAYS`); points are sorted oldest → newest |
| Summary | Latest entry overall, change = latest − earliest inside the window, goal gap = latest − target |
| Stored file | Re-validated on load; malformed entries are dropped |

The layer is **off by default** (`settings.weight.enabled`). «История веса» on «Настройки» turns it on and reveals `WeightCard` with the current value, a sparkline, a manual entry form, a goal input and the last five measurements (deletable). A target outside the range is ignored, `null` clears it. Nothing in the core cycle reads weight history.

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

`shared/domain/sounds.ts` + `src/sounds.ts` — optional layer, off by default.

| Rule | Behaviour |
|------|-----------|
| Settings | `sound { enabled, volume 0..1, packId }`, normalized on load; unknown pack → `default` |
| Gate | Master switch, audible volume, paused reminders and quiet/DND context suppress playback |
| Cues | `popup`, `done`, `skip`, `snooze`, `stage-up`, `streak`, `alert`, `error` map to bundled mp3 files |
| Popup | Plays `popup` on mount; result cue after the durable acknowledgement; a done session that raises the stage plays `stage-up` instead of `done` |
| Failure | A rejected `audio.play()` is logged and swallowed; audio never breaks the core cycle |

Stage-up is automatic; `streak` has a file and a debug preview but no automatic milestone trigger yet.

### Progress photos

`shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`.

| Rule | Behaviour |
|------|-----------|
| Input | Renderer sends bytes + MIME; JPEG/PNG/WebP only, 1 byte–8 MB |
| Storage | Main writes `.userdata/photos/<uuid>.<ext>` + `data/photos.json`; renderer only sees metadata |
| Serving | `photo://<id>` resolves only ids present in metadata; unknown → 404 |
| Session | At most 6 `photoIds`; main drops ids that do not exist before writing the session |
| UI | Popup attaches/removes photos inside the optional details block; dashboard shows a gallery with delete |

The layer is off by default (`settings.photos.enabled`). `photoIds` are only carried by `done` sessions.

`<img src="photo://…">` only works because the renderer CSP lists `photo:` in `img-src` ([index.html](../index.html)); `'self'` does not cover a different scheme. `tests/unit/csp.test.ts` pins that down — dropping the scheme silently blanks the popup thumbnail and the gallery.

### AI proposals

`shared/domain/ai-proposal.ts`, `electron/main/custom-exercises.ts`.

| Rule | Behaviour |
|------|-----------|
| Input | User pastes an AI answer; JSON may sit inside prose or a markdown fence |
| Validation | The object must pass `isValidExercise` (required fields, difficulty, group, focus tags) |
| Approval | Nothing is written until «Утвердить»; a shipped or already-approved id cannot be replaced |
| Storage | `data/custom-exercises.json`; shipped catalog wins on id conflicts |
| Picker | Main merges shipped + approved exercises for every trigger |
| No AI | The layer is off by default and the app works without it; no network call is made |

### Themes and inventory

| Layer | Rules |
|-------|-------|
| Themes | `shared/constants/themes.ts`; `<html data-theme>` swaps Tailwind color tokens in `src/styles/index.css`; unknown id → `default` |
| Inventory | `shared/constants/equipment.ts` lists bag / punching bag / band / dumbbells; owned ids gate equipment exercises in the picker |

### Native laboratory

The dev dashboard entry launches a separate Electron process with `--body-debugger-lab` and a `.userdata/laboratory/` profile. Packaged builds register no laboratory IPC. Main rejects mutation commands in a normal profile even if the renderer exposes a debug entry.

| Part | Owner |
|------|-------|
| Profile gate and path | `electron/main/lab-environment.ts`; checked before persistence loads |
| Stories, deterministic generator, import boundary and checkpoint explanations | `shared/domain/laboratory.ts` |
| Playback, rewind, saved runs, native popup controls and manual branching | `electron/main/laboratory.ts` |
| Runtime app clock | `shared/domain/clock.ts`; clock metadata travels with main snapshots |
| Renderer runtime projection | `src/stores/runtime.ts`; applied before hydrating domain stores |
| Separate controls and visual previews | `electron/main/windows/laboratory.ts`, `src/debug/LaboratoryPanel.vue`, `src/debug/AppearancePanel.vue` |

Timeline seeks cancel pending popup work before closing its window, then reconstruct the event prefix through ordinary main-owned persistence. Live native popups use the normal session loop; opening one interrupts playback. Frame-only overrides remain local to the appearance viewer. Detailed workflow and verification limits: [TESTING.md](TESTING.md).

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

Rules: `shared/domain/character-visual.ts` (pure). Frames: `src/assets/character/desk-hulk/frames/`, cut from the source sheets by `scripts/cut-character-sprites.py`.

| Frame | Key | Drawn in |
|-------|-----|----------|
| Stage body | `stage-{0,2,4}-{build}` | `sprite-sheet-stages.png`, first three rows |
| Branch pose | `pose-{branch}-{build}` | `sprite-sheet-branches.png` |
| Emotion bust | `emotion-{emotion}-{build}` | `emotions/emotions-set-{1,2,3}.png` |
| Neglect body | `neglect-{1,2,3}-{build}` | `sprite-sheet-neglect.png`, rows = severity, columns = lean / average / stocky |

| Rule | Behaviour |
|------|-----------|
| Build | `neutral` (not chosen) → `average` body |
| Stage tiers | Stages 0–1 → `stage-0`, 2–3 → `stage-2`, 4–5 → `stage-4` |
| Branch pose | `power` / `mobility` replace the body from stage 4 (strong/peak form) |
| Neglect | Condition levels 1–3 override stage and branch body; fallback: matching neglect build → average neglect → matching stage-0 body → average stage-0 → emoji |
| Emotion | `emotion-*` busts feed the popup face; `surprised` uses the happy bust |
| Fallback | exact build → `average` build → emoji; an image load error also shows the emoji |

`CharacterPortrait` normally renders `variant="body"` on the dashboard and switches to a large `variant="face"` for 3.5 seconds after a completion or milestone; the popup uses `variant="face"`; `src/components/character/frames.ts` maps a winning key to the bundled URL. Source sheets stay in the repo as the only art source — never edit `frames/` by hand.

The runtime glob currently bundles Desk Hulk only. Nine additional characters
have 432 generated frames (three builds × sixteen states per character) in the
[art library](../src/assets/character/README.md). Their [manifest](../src/assets/character/packs.json)
drives `scripts/cut-character-sprites.py --packs`; it is not yet connected to a
runtime pack resolver or settings selector. Their six individual stage bodies
do not change Desk Hulk's existing three-tier mapping.

### Comic reactions

`shared/domain/character-reaction.ts` owns event → emotion/tone/caption rules. `useCharacterStore.react` keeps the caption and emotion together without writing progress. Session-history length seeds variation across separate popup windows; a previous-caption guard prevents immediate repeats. Reaction counters are UI-only and are not persisted.

`ComicBubble.vue` renders text safely as text, with a heading variant for the hero and a compact variant for the popup. CSS paper, ink and milestone tokens support all themes. Cheer/milestone captions pop briefly; calm invitations, pause and skips do not. Global reduced-motion rules suppress those animations.

The dashboard restores the current body (including temporary neglect) after a reaction and keeps skip/snooze captions calm. The popup changes ready → focused on explicit start, then chooses first-done/done/stage-up only after durable acknowledgement. No caption is treated as proof of physical activity. Geometry reserves a 40 px dialogue row: 260 px base, 290 px collapsed details, 380 px expanded, plus 36 px for errors (max 420).

### Motion

CONCEPT §13 micro-animations. Each surface owns its own effect:

| Surface | Motion |
|---------|--------|
| Tray | `electron/main/tray-icons.ts` maps every `TrayState` to frames + interval; `tray.ts` swaps them on a timer. `success` plays once (jump + flash), `soon` / `standup` / `streak` loop |
| Popup | `.popup-in` entrance, `.timer-urgent` pulse in the last 10 s, then on `done`: flash + happy crossfade + `.popup-out-done`; skip / snooze use `.popup-out-quiet`. The window stays open for `POPUP_EXIT_MS` while the exit runs |
| Character | `CharacterPortrait` crossfades sprite frames (`<Transition name="frame-fade">`), bounces on happy/surprised reactions, and fades in on the dashboard |
| Dashboard | Large reaction portrait with contextual comic speech, then restoration of the stage body; reduced-motion switch on «Настройки» |

Reduced motion: `src/motion.ts` combines `settings.reduceMotion` with the OS `prefers-reduced-motion`. `App.vue` mirrors it into `data-reduce-motion` on `<html>`; `src/styles/index.css` then collapses animation/transition durations. Timed effects check the preference in code — the tray uses the app setting only, because the main process cannot read the media query.

Tray frames are generated by `scripts/build-tray-icons.py` (a placeholder stretching-figure glyph); see [DEVELOPMENT.md](DEVELOPMENT.md). The `streak` frame set exists, but no event sets the `streak` tray state yet — it waits for streak milestones.

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
| `debug:apply-scenario` | invoke | Compatibility replacement of validated sessions/settings/progress; isolated laboratory process only |
| `lab:open` / `lab:get-state` | invoke | Unpackaged builds: launch/focus the separate native laboratory, read its state |
| `lab:command` / `lab:changed` | invoke / main → renderers | Laboratory-only main-owned timeline/native commands and state pushes |
| `window:open-dashboard` | invoke | Open / focus the dashboard |
| `session:get-current-popup` | invoke | Active popup payload (`{ sessionId, exercise }` or `null`) |
| `session:get-loop-state` | invoke | `{ paused, nextTriggerAt, intervalMinutes }` |
| `session:loop-changed` | main → renderers | Same payload after every reschedule |
| `session:result` | invoke | Matching active result → `{ saved: boolean }`; exact retries are idempotent |
| `window:navigate-dashboard` | main → renderer | Open «Настройки» in an existing dashboard |
| `session:updated` | main → renderers | Resolved session + tray state |
| `window:open-popup` / `window:close-popup` | invoke | Open / close the popup window |
| `window:resize-popup` | invoke | Grow / shrink the popup for the optional details block |

Channels: `shared/types/events.ts` (`IpcChannels`).  
Registration: `electron/main/ipc/session-cycle.ts`, `electron/main/ipc/persistence.ts`.  
Preload: `electron/preload/index.ts`.

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
| Popup (320×260, 380 with details, up to 420 for errors) + Dashboard windows | Yes |
| IPC cycle + persistence wiring | Yes |
| Trigger loop (interval, idle, snooze, missed, pause) | Yes — [ROADMAP.md](ROADMAP.md) #2 |
| Popup shows the triggered exercise (pulled from main) | Yes |
| Popup severity (timer gate, hold to confirm) | Yes — [ROADMAP.md](ROADMAP.md) #5 |
| Dashboard: character hero + day counts + next form; all switches on «Настройки» | Yes |
| Core preferences (interval, picker mode, Focus, build) + «Настройки» tab | Yes — dashboard tab and tray deep link |
| Optional session details (reps / feeling / weight) | Yes — popup block + dashboard switch; ROADMAP #8 (partial) |
| Weight history (sparkline, manual entries, goal) | Yes — dashboard card; sessions backfilled once; ROADMAP #8 (partial) |
| Tailwind + routed dashboard / popup views | Yes |
| Desk Hulk source sheets + 42 cut frames under `src/assets/character/desk-hulk/` | Yes — includes nine temporary neglect bodies |
| CharacterPortrait (body / face frames + emoji fallback) | Yes |
| Tray frame animation (pulse / sway / jump per state) | Yes — [ROADMAP.md](ROADMAP.md) #7 |
| Motion preference (popup, character, tray) | Yes — dashboard switch + OS setting |
| Default sound pack + gated playback + mute/volume | Yes — [SOUNDS.md](SOUNDS.md) |
| Progress photos (main files, popup attach, dashboard gallery) | Yes — ROADMAP #8 |
| AI proposal validation + explicit approval + custom catalog | Yes — ROADMAP #8 |
| Themes + inventory UI | Yes — ROADMAP #8 |
| Dashboard heatmap + stats | Yes — ROADMAP #11 |
| Vitest suite + isolated native laboratory | Yes — timeline, virtual app time, seeded calendars, popup controls; [TESTING.md](TESTING.md) |

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
| Tray frames per state | [electron/main/tray-icons.ts](../electron/main/tray-icons.ts) |
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

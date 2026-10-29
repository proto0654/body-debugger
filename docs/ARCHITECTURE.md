# Architecture

What the code already reflects. Product rules: [CONCEPT.md](../CONCEPT.md).

## Layout

```
electron/main/              # Tray, windows, IPC, app wiring
electron/main/trigger-loop.ts # Reminder schedule + active session (main SoT)
electron/main/tray.ts       # Tray icon animation + menu
electron/main/tray-icons.ts # Frame sets per TrayState
electron/resources/tray/    # Generated tray frames (idle / soon / standup / success / streak)
electron/main/broadcast.ts  # Window broadcast helpers
electron/main/persistence/  # JSON SoT (settings / progress / sessions)
electron/main/ipc/          # session-cycle + persistence channels
electron/preload/           # contextBridge → window.api
src/                        # Vue renderer
src/bootstrap/              # hydrate Pinia from main snapshot
src/motion.ts               # Motion preference (settings + OS) and popup exit timings
src/styles/index.css        # Tailwind entry, keyframes, reduced-motion overrides
src/stores/                 # sessions, progress, settings, character, reminder
src/components/             # UI (CharacterPortrait + frame resolver)
src/assets/character/       # Desk Hulk source sheets + cut frames
src/assets/sounds/default/  # Optional cue pack (mp3); playback not wired
shared/types/               # Exercise, Session, Character, Progress, Settings, Events, Persistence
shared/domain/              # Pure rules: picker, character progress, character frames, severity
shared/validation/          # isValidExercise
shared/constants/           # stage keys / labels, exercise catalog
```

## Persistence (main-owned)

Main process holds the source of truth (in-memory cache + disk). Each BrowserWindow has its own Pinia; renderers hydrate via IPC and re-apply on `data:updated`.

On disk under `.userdata/data/` (see [DEVELOPMENT.md](DEVELOPMENT.md)):

| File | Payload |
|------|---------|
| `settings.json` | `AppSettings` |
| `progress.json` | `UserProgress` |
| `sessions.json` | `Session[]` |

Envelope: `{ version: 1, data }`. Missing/corrupt → defaults. Writes are temp-file + rename.
Settings files written before a field existed are merged with the current defaults on load (`normalizeSettings`), so new optional switches never break an existing profile.

Module: `electron/main/persistence/`.  
IPC: `electron/main/ipc/persistence.ts`.  
Hydrate: `src/bootstrap/hydrate.ts` (called from `src/main.ts` before mount).

## Session cycle (events)

```
timer / idle / manual (trigger-loop)  →  tray:set-state(standup)
                                      →  popup window (main holds the active session)
renderer pulls session:get-current-popup → { sessionId, exercise }
[Готово | Отложить | Пропустить]      →  session:result (+ optional reps / feeling / weight)
                                      →  append session JSON (+ streak bump and character recompute on done)
                                      →  data:updated + session:updated + session:loop-changed
                                      →  tray success/soon/idle, next trigger rescheduled
popup closed without an answer        →  skipped
no answer for 5 minutes               →  missed (popup closed by main)
```

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

### Popup severity

`shared/domain/severity.ts` — rules only; the popup enforces them, main records any result.

| Level | «Готово» |
|-------|----------|
| `soft` | enabled immediately, timer is only a hint |
| `medium` (default) | unlocks at 80% of the exercise timer |
| `hardcore` | same unlock + press-and-hold for 1.5 s |

The popup shows a countdown (`mm:ss`), a progress bar and a one-line hint for the
current level. Closing the popup without an answer is `skipped` at every level.
Extra hardcore checks (CONCEPT §3) are not implemented yet.

### Optional session details

`shared/domain/session-extras.ts` — pure validation; the popup collects the values, main normalizes them before writing. This is the first slice of ROADMAP #8.

| Field | Range | Input |
|-------|-------|-------|
| `reps` | 1–999, integer | number |
| `feeling` | 1–5 | five chips |
| `weightKg` | 20–300, one decimal | number (step 0.1) |

The block is **off by default**. «Детали в попапе» on the dashboard sets `settings.sessionExtras.enabled`; the popup then shows a collapsed «Детали (необязательно)» row. Values outside the ranges are dropped, never clamped, and a result still resolves without details. Details are stored only for `done` sessions — snooze / skip / miss never carry them. Expanding the block grows the popup via `window:resize-popup` (heights in `shared/constants/popup.ts`) while the window stays anchored to the bottom-right corner. Saved values appear on the dashboard as a short «Последняя сессия» line.

### Character progress

`shared/domain/character-progress.ts`, recomputed in main on every `done` and stored in `progress.json`.

| Rule | Behaviour |
|------|-----------|
| Stage | Total **done** sessions: 3 → 1, 8 → 2, 20 → 3, 45 → 4, 80 → 5 (`start`…`peak`) |
| Branch | Last 30 done sessions; each scores one point for its primary direction |
| Direction order | Posture zone (neck / shoulders / upper back / lower back) → strength / striking (`power`) → mobility / balance (`mobility`) |
| Neutral fallback | Fewer than 3 points for the leader, or the leader does not beat the runner-up by 20% |
| Streak | `current` / `max` bumped on `done` in the same write |

`characterBuild` stays a user preference; visuals resolve from stage + branch + build + emotion.

### Character visuals

Rules: `shared/domain/character-visual.ts` (pure). Frames: `src/assets/character/desk-hulk/frames/`, cut from the source sheets by `scripts/cut-character-sprites.py`.

| Frame | Key | Drawn in |
|-------|-----|----------|
| Stage body | `stage-{0,2,4}-{build}` | `sprite-sheet-stages.png`, first three rows |
| Branch pose | `pose-{branch}-{build}` | `sprite-sheet-branches.png` |
| Emotion bust | `emotion-{emotion}-{build}` | `emotions/emotions-set-{1,2,3}.png` |

| Rule | Behaviour |
|------|-----------|
| Build | `neutral` (not chosen) → `average` body |
| Stage tiers | Stages 0–1 → `stage-0`, 2–3 → `stage-2`, 4–5 → `stage-4` |
| Branch pose | `power` / `mobility` replace the body from stage 4 (strong/peak form) |
| Emotion | `emotion-*` busts feed the popup face; `surprised` uses the happy bust |
| Fallback | exact build → `average` build → emoji |

`CharacterPortrait` renders `variant="body"` on the dashboard and `variant="face"` in the popup; `src/components/character/frames.ts` maps a winning key to the bundled URL. Source sheets stay in the repo as the only art source — never edit `frames/` by hand.

### Motion

CONCEPT §13 micro-animations. Each surface owns its own effect:

| Surface | Motion |
|---------|--------|
| Tray | `electron/main/tray-icons.ts` maps every `TrayState` to frames + interval; `tray.ts` swaps them on a timer. `success` plays once (jump + flash), `soon` / `standup` / `streak` loop |
| Popup | `.popup-in` entrance, `.timer-urgent` pulse in the last 10 s, then on `done`: flash + happy crossfade + `.popup-out-done`; skip / snooze use `.popup-out-quiet`. The window stays open for `POPUP_EXIT_MS` while the exit runs |
| Character | `CharacterPortrait` crossfades sprite frames (`<Transition name="frame-fade">`), bounces on the happy emotion, and fades in on the dashboard |
| Dashboard | «Анимации» switch under «Строгость»; the portrait fades in on mount |

Reduced motion: `src/motion.ts` combines `settings.reduceMotion` with the OS `prefers-reduced-motion`. `App.vue` mirrors it into `data-reduce-motion` on `<html>`; `src/styles/index.css` then collapses animation/transition durations. Timed effects check the preference in code — the tray uses the app setting only, because the main process cannot read the media query.

Tray frames are generated by `scripts/build-tray-icons.py` (a placeholder stretching-figure glyph); see [DEVELOPMENT.md](DEVELOPMENT.md). The `streak` frame set exists, but no event sets the `streak` tray state yet — it waits for streak milestones.

### Data channels

| Channel | Direction | Role |
|---------|-----------|------|
| `data:get-snapshot` | invoke | Full `{ settings, progress, sessions }` |
| `data:save-settings` | invoke | Replace settings, broadcast, reschedule if interval/pause changed |
| `data:save-progress` | invoke | Replace progress, broadcast |
| `data:updated` | main → renderers | Snapshot after any write |
| `session:get-current-popup` | invoke | Active popup payload (`{ sessionId, exercise }` or `null`) |
| `session:get-loop-state` | invoke | `{ paused, nextTriggerAt, intervalMinutes }` |
| `session:loop-changed` | main → renderers | Same payload after every reschedule |
| `session:result` | invoke | Renderer reports done / snoozed / skipped, plus optional reps / feeling / weight |
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
| Popup (320×220, up to 340 with details) + Dashboard windows | Yes |
| IPC cycle + persistence wiring | Yes |
| Trigger loop (interval, idle, snooze, missed, pause) | Yes — [ROADMAP.md](ROADMAP.md) #2 |
| Popup shows the triggered exercise (pulled from main) | Yes |
| Popup severity (timer gate, hold to confirm) | Yes — [ROADMAP.md](ROADMAP.md) #5 |
| Dashboard: next reminder + pause + severity + motion + details switches | Yes |
| Optional session details (reps / feeling / weight) | Yes — popup block + dashboard switch; ROADMAP #8 (partial) |
| Tailwind + stub views | Yes |
| Desk Hulk source sheets + 33 cut frames under `src/assets/character/desk-hulk/` | Yes — [ROADMAP.md](ROADMAP.md) #6 |
| CharacterPortrait (body / face frames + emoji fallback) | Yes |
| Tray frame animation (pulse / sway / jump per state) | Yes — [ROADMAP.md](ROADMAP.md) #7 |
| Motion preference (popup, character, tray) | Yes — dashboard switch + OS setting |
| Default sound pack under `src/assets/sounds/default/` | Assets only |
| Sound playback / mute / pack settings | Not yet — [SOUNDS.md](SOUNDS.md) |
| Vitest suite / `src/debug/` panel | Suite yes; debug panel not yet — [TESTING.md](TESTING.md) |

## Where rules live

| Rule | File |
|------|------|
| Reminder schedule (interval, idle, snooze, missed, pause) | [electron/main/trigger-loop.ts](../electron/main/trigger-loop.ts) |
| Exercise weights / penalties / modes | [shared/domain/exercise-picker.ts](../shared/domain/exercise-picker.ts) |
| Exercise catalog (ids are permanent) | [shared/constants/exercises.ts](../shared/constants/exercises.ts) |
| Popup severity rules | [shared/domain/severity.ts](../shared/domain/severity.ts) |
| Session detail ranges + normalization | [shared/domain/session-extras.ts](../shared/domain/session-extras.ts) |
| Popup geometry (heights / margins) | [shared/constants/popup.ts](../shared/constants/popup.ts) |
| Stage / branch from history | [shared/domain/character-progress.ts](../shared/domain/character-progress.ts) |
| Character frame keys + fallbacks | [shared/domain/character-visual.ts](../shared/domain/character-visual.ts) |
| Motion keyframes + reduced-motion CSS | [src/styles/index.css](../src/styles/index.css) |
| Motion preference + popup exit timings | [src/motion.ts](../src/motion.ts) |
| Tray frames per state | [electron/main/tray-icons.ts](../electron/main/tray-icons.ts) |
| Character presentation | `src/components/character/` + `src/assets/character/` |
| Sound cues / packs | [SOUNDS.md](SOUNDS.md) + `src/assets/sounds/` |
| Tests + debug panel | [TESTING.md](TESTING.md) |
| IPC schema | `shared/types/events.ts` + `electron/main/ipc/` |
| JSON persistence | `electron/main/persistence/` |
| External Exercise validation | [shared/validation/exercise.ts](../shared/validation/exercise.ts) |

## Invariants

1. One popup = one exercise (`PopupView` must not render a list).
2. Optional fields stay optional; core does not depend on AI/photos/sounds.
3. Character progress from data; PNGs and sound packs are presentation only.
4. External Exercise payloads must pass validation before entering the catalog.
5. Durable state is owned by main; Pinia is a per-window projection.

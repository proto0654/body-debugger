# Architecture

What the code already reflects. Product rules: [CONCEPT.md](../CONCEPT.md).

## Layout

```
electron/main/              # Tray, windows, IPC, app wiring
electron/main/trigger-loop.ts # Reminder schedule + active session (main SoT)
electron/main/broadcast.ts  # Window broadcast helpers
electron/main/persistence/  # JSON SoT (settings / progress / sessions)
electron/main/ipc/          # session-cycle + persistence channels
electron/preload/           # contextBridge → window.api
src/                        # Vue renderer
src/bootstrap/              # hydrate Pinia from main snapshot
src/stores/                 # sessions, progress, settings, character, reminder
src/components/             # UI (CharacterPortrait, …)
src/assets/character/       # Desk Hulk sprites
src/assets/sounds/default/  # Optional cue pack (mp3); playback not wired
shared/types/               # Exercise, Session, Character, Progress, Settings, Events, Persistence
shared/domain/              # Pure rules: picker, character progress, severity
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

Module: `electron/main/persistence/`.  
IPC: `electron/main/ipc/persistence.ts`.  
Hydrate: `src/bootstrap/hydrate.ts` (called from `src/main.ts` before mount).

## Session cycle (events)

```
timer / idle / manual (trigger-loop)  →  tray:set-state(standup)
                                      →  popup window (main holds the active session)
renderer pulls session:get-current-popup → { sessionId, exercise }
[Готово | Отложить | Пропустить]      →  session:result
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
| `session:result` | invoke | Renderer reports done / snoozed / skipped |
| `session:updated` | main → renderers | Resolved session + tray state |

Channels: `shared/types/events.ts` (`IpcChannels`).  
Registration: `electron/main/ipc/session-cycle.ts`, `electron/main/ipc/persistence.ts`.  
Preload: `electron/preload/index.ts`.

## Already in code

| Area | Status |
|------|--------|
| Types (Exercise, Session, Character, Progress, Settings, Persistence) | Yes |
| Exercise type-guard | Stub |
| Pinia stores + hydrate from main | Yes |
| JSON persistence (settings / progress / sessions) | Yes |
| Character stage/branch from history (persisted on `done`) | Yes — [ROADMAP.md](ROADMAP.md) #4 |
| Exercise catalog (34 exercises, zones, equipment, focus tags) | Yes |
| Weighted picker (penalties, neglect, Focus, modes) | Yes — [ROADMAP.md](ROADMAP.md) #3 |
| Tray + menu (Dashboard / Trigger now / Pause / Quit) | Yes |
| Popup (~320×220) + Dashboard windows | Yes |
| IPC cycle + persistence wiring | Yes |
| Trigger loop (interval, idle, snooze, missed, pause) | Yes — [ROADMAP.md](ROADMAP.md) #2 |
| Popup shows the triggered exercise (pulled from main) | Yes |
| Popup severity (timer gate, hold to confirm) | Yes — [ROADMAP.md](ROADMAP.md) #5 |
| Dashboard: next reminder + pause + severity switch | Yes |
| Tailwind + stub views | Yes |
| Desk Hulk assets under `src/assets/character/desk-hulk/` | Yes |
| CharacterPortrait (emoji + sheet backdrop) | Yes |
| Default sound pack under `src/assets/sounds/default/` | Assets only |
| Sound playback / mute / pack settings | Not yet — [SOUNDS.md](SOUNDS.md) |
| Vitest suite / `src/debug/` panel | Not yet — [TESTING.md](TESTING.md) |

## Where rules live

| Rule | File |
|------|------|
| Reminder schedule (interval, idle, snooze, missed, pause) | [electron/main/trigger-loop.ts](../electron/main/trigger-loop.ts) |
| Exercise weights / penalties / modes | [shared/domain/exercise-picker.ts](../shared/domain/exercise-picker.ts) |
| Exercise catalog (ids are permanent) | [shared/constants/exercises.ts](../shared/constants/exercises.ts) |
| Popup severity rules | [shared/domain/severity.ts](../shared/domain/severity.ts) |
| Stage / branch from history | [shared/domain/character-progress.ts](../shared/domain/character-progress.ts) |
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

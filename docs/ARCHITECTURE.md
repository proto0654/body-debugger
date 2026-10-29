# Architecture

What the code already reflects. Product rules: [CONCEPT.md](../CONCEPT.md).

## Layout

```
electron/main/              # Tray, BrowserWindow, IPC
electron/main/persistence/  # JSON SoT (settings / progress / sessions)
electron/main/ipc/          # session-cycle + persistence channels
electron/preload/           # contextBridge → window.api
src/                        # Vue renderer
src/bootstrap/              # hydrate Pinia from main snapshot
src/domain/                 # Rule stubs: picker, character progress
src/stores/                 # sessions, progress, settings, character
src/components/             # UI (CharacterPortrait, …)
src/assets/character/       # Desk Hulk sprites
shared/types/               # Exercise, Session, Character, Progress, Settings, Events, Persistence
shared/validation/          # isValidExercise
shared/constants/           # stage keys / labels
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
session:trigger  →  tray:set-state(standup)
                 →  session:show-popup (+ Popup BrowserWindow)
                 →  [Done | Snooze | Skip]
session:result   →  append session JSON + stub streak bump on done
                 →  data:updated (all windows) + session:updated + tray flash/idle
```

### Data channels

| Channel | Direction | Role |
|---------|-----------|------|
| `data:get-snapshot` | invoke | Full `{ settings, progress, sessions }` |
| `data:save-settings` | invoke | Replace settings, broadcast |
| `data:save-progress` | invoke | Replace progress, broadcast |
| `data:updated` | main → renderers | Snapshot after any write |

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
| Domain stubs (`exercise-picker`, `character-progress`) | TODO bodies |
| Tray + menu (Dashboard / Popup-dev / Quit) | Yes |
| Popup (~320×220) + Dashboard windows | Yes |
| IPC cycle + persistence wiring | Yes |
| Tailwind + stub views | Yes |
| Desk Hulk assets under `src/assets/character/desk-hulk/` | Yes |
| CharacterPortrait (emoji + sheet backdrop) | Yes |
| Trigger timer / idle / tray Pause | Not yet |

## Where rules live

| Rule | File |
|------|------|
| Exercise weights / penalties / modes | [src/domain/exercise-picker.ts](../src/domain/exercise-picker.ts) |
| Stage / branch from history | [src/domain/character-progress.ts](../src/domain/character-progress.ts) |
| Character presentation | `src/components/character/` + `src/assets/character/` |
| IPC schema | `shared/types/events.ts` + `electron/main/ipc/` |
| JSON persistence | `electron/main/persistence/` |
| External Exercise validation | [shared/validation/exercise.ts](../shared/validation/exercise.ts) |

## Invariants

1. One popup = one exercise (`PopupView` must not render a list).
2. Optional fields stay optional; core does not depend on AI/photos.
3. Character progress from data; PNGs are presentation only.
4. External Exercise payloads must pass validation before entering the catalog.
5. Durable state is owned by main; Pinia is a per-window projection.

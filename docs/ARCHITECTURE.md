# Architecture (skeleton)

What the code already reflects. Product rules: [CONCEPT.md](../CONCEPT.md).

## Layout

```
electron/main/          # Tray, BrowserWindow, IPC cycle
electron/preload/       # contextBridge → window.api
src/                    # Vue renderer
src/domain/             # Rule stubs: picker, character progress
src/stores/             # sessions, progress, settings, character
src/components/         # UI (CharacterPortrait, …)
src/assets/character/   # Desk Hulk sprites
shared/types/           # Exercise, Session, Character, Progress, Settings, Events
shared/validation/      # isValidExercise
shared/constants/       # stage keys / labels
```

## Session cycle (events)

```
session:trigger  →  tray:set-state(standup)
                 →  session:show-popup (+ Popup BrowserWindow)
                 →  [Done | Snooze | Skip]
session:result   →  session:updated + tray flash/idle
                 →  (later) streak / stage / stats
```

Channels: `shared/types/events.ts` (`IpcChannels`).  
Registration: `electron/main/ipc/session-cycle.ts`.  
Preload: `electron/preload/index.ts`.

## Already in code

| Area | Status |
|------|--------|
| Types (Exercise, Session, Character, Progress, Settings) | Yes |
| Exercise type-guard | Stub |
| Pinia stores | Skeleton |
| Domain stubs (`exercise-picker`, `character-progress`) | TODO bodies |
| Tray + menu (Dashboard / Popup-dev / Quit) | Yes |
| Popup (~320×220) + Dashboard windows | Yes |
| IPC cycle wiring | Stubs |
| Tailwind + stub views | Yes |
| Desk Hulk assets under `src/assets/character/desk-hulk/` | Yes |
| CharacterPortrait (emoji + sheet backdrop) | Yes |

## Where rules live

| Rule | File |
|------|------|
| Exercise weights / penalties / modes | [src/domain/exercise-picker.ts](../src/domain/exercise-picker.ts) |
| Stage / branch from history | [src/domain/character-progress.ts](../src/domain/character-progress.ts) |
| Character presentation | `src/components/character/` + `src/assets/character/` |
| IPC schema | `shared/types/events.ts` + `electron/main/ipc/session-cycle.ts` |
| External Exercise validation | [shared/validation/exercise.ts](../shared/validation/exercise.ts) |

## Invariants

1. One popup = one exercise (`PopupView` must not render a list).
2. Optional fields stay optional; core does not depend on AI/photos.
3. Character progress from data; PNGs are presentation only.
4. External Exercise payloads must pass validation before entering the catalog.

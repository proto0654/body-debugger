# Body Debugger — project context

Permanent snapshot for agents. Domain detail lives in linked docs — no session changelogs here.

## What this is

- Desktop **system-tray** app for IT workers: remind → one exercise popup → record result → update streak / character / stats.
- Core principle: **one popup = one exercise**. Stats, character, weight, photos, AI, inventory are optional layers.
- Current stage: **core cycle works** — trigger loop, weighted picker, character stage/branch, severity + popup timer. Optional layers (sounds, photos, AI, inventory UI, stats) are still ahead.

## Communication

| Channel | Language |
|---------|----------|
| Chat | Russian |
| `docs/**`, `AGENTS.md`, Cursor commands | English |
| [CONCEPT.md](../CONCEPT.md) | Russian (product SoT) |
| UI strings | Russian |

## Stack

- Electron + Vue 3 + Vite (`electron-vite`) + TypeScript
- Pinia, Vue Router (hash routes `#/popup`, `#/dashboard`)
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Persistence: **JSON files** in `.userdata/data/` (main process SoT; Pinia hydrates via IPC)

## Key paths

| Purpose | Path |
|---------|------|
| Main process | `electron/main/` |
| Reminder schedule (interval / idle / pause / missed) | `electron/main/trigger-loop.ts` |
| Persistence (JSON) | `electron/main/persistence/` |
| Tray | `electron/main/tray.ts` |
| Windows | `electron/main/windows/` |
| Session-cycle IPC | `electron/main/ipc/session-cycle.ts` |
| Persistence IPC | `electron/main/ipc/persistence.ts` |
| Preload API | `electron/preload/index.ts` |
| Renderer entry | `src/main.ts`, `src/App.vue`, `src/router.ts` |
| Hydrate bootstrap | `src/bootstrap/hydrate.ts` |
| Stores | `src/stores/` |
| Reminder schedule store (UI mirror) | `src/stores/reminder.ts` |
| Domain rules (picker, character, severity) | `shared/domain/` |
| Exercise catalog (34) | `shared/constants/exercises.ts` |
| Shared types | `shared/types/` |
| Exercise validation | `shared/validation/exercise.ts` |
| Desk Hulk assets (sheets + cut frames) | `src/assets/character/desk-hulk/` |
| Character frame rules (stage → body, branch pose, emotion bust) | `shared/domain/character-visual.ts` |
| Frame key → bundled URL | `src/components/character/frames.ts` |
| Sprite cutting script | `scripts/cut-character-sprites.py` |
| Motion preference + popup exit timings | `src/motion.ts` |
| Keyframes / reduced-motion CSS | `src/styles/index.css` |
| Tray frames + specs | `electron/resources/tray/`, `electron/main/tray-icons.ts` |
| Tray icon script | `scripts/build-tray-icons.py` |
| Sound packs (default mp3) | `src/assets/sounds/default/` |
| Electron userData + JSON | `.userdata/` → `.userdata/data/*.json` (gitignored) |

## Source of truth

| Concern | Owner |
|---------|-------|
| Product rules (cycle, severity, character model, picker) | [CONCEPT.md](../CONCEPT.md) |
| What code already reflects | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How to run / caches | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Optional sound cues + packs | [SOUNDS.md](SOUNDS.md) |
| Unit / store tests + debug panel | [TESTING.md](TESTING.md) |
| Next work | [ROADMAP.md](ROADMAP.md) |

## Current focus

- Keep the app runnable (`npm run dev` → tray + dashboard; data survives restart).
- Trigger loop is in place: interval from last completion, idle hold/reset, snooze, tray + dashboard pause, `missed` timeout.
- Picker is in place: 34-exercise catalog, zone/group penalties, neglect bonus, Focus, inventory gate, four modes.
- Character stage/branch now derive from history and are persisted on every `done`.
- Severity is live: countdown + progress in the popup, Medium/Hardcore gate «Готово» (80% of the timer), Hardcore needs a hold; switch it on the dashboard.
- Character art is cut per frame: dashboard shows the stage body, the popup shows the emotion bust; emoji is the fallback.
- Motion is live: popup entrance/exit + urgent timer, emotion crossfade/bounce, tray frame animation; «Анимации» switch and the OS setting collapse it.
- Next roadmap item: **#8 optional layers** (weight, photos, feeling, inventory, AI, themes).
- Still stubs: streak counters (simple `done` bump), sounds playback, debug panel, Vitest suite.

## Doc index

| Doc | Role |
|-----|------|
| [README.md](README.md) | Hub / TOC |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, IPC, persistence |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Dev commands, E: caches |
| [SOUNDS.md](SOUNDS.md) | Optional sound layer + default pack |
| [TESTING.md](TESTING.md) | Vitest priorities + debug panel |
| [ROADMAP.md](ROADMAP.md) | Post-skeleton milestones |
| [../CONCEPT.md](../CONCEPT.md) | Product SoT |
| [../AGENTS.md](../AGENTS.md) | Agent entry |

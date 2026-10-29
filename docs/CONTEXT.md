# Body Debugger — project context

Permanent snapshot for agents. Domain detail lives in linked docs — no session changelogs here.

## What this is

- Desktop **system-tray** app for IT workers: remind → one exercise popup → record result → update streak / character / stats.
- Core principle: **one popup = one exercise**. Stats, character, weight, photos, AI, inventory are optional layers.
- Current stage: **skeleton + JSON persistence** (main-owned). Trigger loop and domain math still deferred.

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
| Persistence (JSON) | `electron/main/persistence/` |
| Tray | `electron/main/tray.ts` |
| Windows | `electron/main/windows/` |
| Session-cycle IPC | `electron/main/ipc/session-cycle.ts` |
| Persistence IPC | `electron/main/ipc/persistence.ts` |
| Preload API | `electron/preload/index.ts` |
| Renderer entry | `src/main.ts`, `src/App.vue`, `src/router.ts` |
| Hydrate bootstrap | `src/bootstrap/hydrate.ts` |
| Stores | `src/stores/` |
| Domain stubs | `src/domain/exercise-picker.ts`, `src/domain/character-progress.ts` |
| Shared types | `shared/types/` |
| Exercise validation | `shared/validation/exercise.ts` |
| Desk Hulk assets | `src/assets/character/desk-hulk/` |
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
- Next roadmap item: **trigger loop** (interval / idle / pause).
- Do not implement full picker / stage math until their roadmap items are in play.
- Sounds and debug/testing are **documented + assets only** — no playback or Vitest suite yet.

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

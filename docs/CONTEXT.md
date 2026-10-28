# Body Debugger — project context

Permanent snapshot for agents. Domain detail lives in linked docs — no session changelogs here.

## What this is

- Desktop **system-tray** app for IT workers: remind → one exercise popup → record result → update streak / character / stats.
- Core principle: **one popup = one exercise**. Stats, character, weight, photos, AI, inventory are optional layers.
- Current stage: **runnable skeleton** (tray, popup, dashboard stubs, types, Pinia stores, IPC cycle schema). Business logic deferred.

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
- Persistence: **not implemented** (in-memory stores only)

## Key paths

| Purpose | Path |
|---------|------|
| Main process | `electron/main/` |
| Tray | `electron/main/tray.ts` |
| Windows | `electron/main/windows/` |
| Session-cycle IPC | `electron/main/ipc/session-cycle.ts` |
| Preload API | `electron/preload/index.ts` |
| Renderer entry | `src/main.ts`, `src/App.vue`, `src/router.ts` |
| Stores | `src/stores/` |
| Domain stubs | `src/domain/exercise-picker.ts`, `src/domain/character-progress.ts` |
| Shared types | `shared/types/` |
| Exercise validation | `shared/validation/exercise.ts` |
| Desk Hulk assets | `src/assets/character/desk-hulk/` |
| Electron userData | `.userdata/` (project root, gitignored) |

## Source of truth

| Concern | Owner |
|---------|-------|
| Product rules (cycle, severity, character model, picker) | [CONCEPT.md](../CONCEPT.md) |
| What code already reflects | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How to run / caches | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Next work | [ROADMAP.md](ROADMAP.md) |

## Current focus

- Keep the skeleton runnable (`npm run dev` → tray + Tailwind dashboard).
- Do not implement full picker / stage math / persistence until the matching roadmap item is in play.
- Docs graph + `/actualize` pipeline in place.

## Doc index

| Doc | Role |
|-----|------|
| [README.md](README.md) | Hub / TOC |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, IPC, skeleton checklist |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Dev commands, E: caches |
| [ROADMAP.md](ROADMAP.md) | Post-skeleton milestones |
| [../CONCEPT.md](../CONCEPT.md) | Product SoT |
| [../AGENTS.md](../AGENTS.md) | Agent entry |

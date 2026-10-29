# Body Debugger — agent entry

Desktop tray app that nudges desk workers to do one short exercise at a time.

## Precedence

Project docs and this file override global agent rules when they conflict.

## Language

| Channel | Language |
|---------|----------|
| Chat with the user | **Russian** |
| `docs/**`, `AGENTS.md`, `.cursor/commands/**` | **English** |
| Product concept ([CONCEPT.md](CONCEPT.md)) | **Russian** (source of truth; do not machine-translate) |
| UI copy | **Russian** |

## Start here

1. [docs/CONTEXT.md](docs/CONTEXT.md) — permanent snapshot
2. [docs/README.md](docs/README.md) — docs hub
3. [CONCEPT.md](CONCEPT.md) — product rules (cycle, character, picker)
4. Optional layers: [docs/SOUNDS.md](docs/SOUNDS.md), [docs/TESTING.md](docs/TESTING.md)

## Key paths

| Area | Path |
|------|------|
| Main / tray / windows / IPC | `electron/main/` |
| JSON persistence | `electron/main/persistence/` |
| Preload bridge | `electron/preload/` |
| Vue renderer | `src/` |
| Pinia hydrate | `src/bootstrap/hydrate.ts` |
| Shared types & validation | `shared/` |
| Domain stubs (picker, stage) | `src/domain/` |
| Character assets | `src/assets/character/desk-hulk/` |
| Sound packs | `src/assets/sounds/default/` |
| Docs | `docs/` |
| `/actualize` | [.cursor/commands/actualize.md](.cursor/commands/actualize.md) |

## Commands

```bash
npm run dev          # electron-vite: tray + dashboard
npm run build
npm run typecheck
```

Caches and Electron binary stay on **E:** — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Do not download Electron into `%LOCALAPPDATA%` on the system drive.

## Hard rules (from CONCEPT)

1. One popup = one exercise.
2. Optional layers must not break the core cycle.
3. Character progress is computed from data; visuals are swappable.
4. Validate external / AI `Exercise` payloads before use.
5. Prefer stubs and incremental delivery over full logic dumps.

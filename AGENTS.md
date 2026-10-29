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
| Reminder loop (interval / idle / pause / missed) | `electron/main/trigger-loop.ts` |
| JSON persistence | `electron/main/persistence/` |
| Preload bridge | `electron/preload/` |
| Vue renderer | `src/` |
| Pinia hydrate | `src/bootstrap/hydrate.ts` |
| Shared types & validation | `shared/` |
| Exercise catalog + domain rules (picker, character) | `shared/constants/exercises.ts`, `shared/domain/` |
| Character assets (source sheets + cut frames) | `src/assets/character/desk-hulk/` |
| Character frame rules / resolver | `shared/domain/character-visual.ts`, `src/components/character/frames.ts` |
| Sprite cutting script | `scripts/cut-character-sprites.py` |
| Motion preference / exit timings | `src/motion.ts` |
| Keyframes + reduced-motion CSS | `src/styles/index.css` |
| Tray frames + animation specs | `electron/resources/tray/`, `electron/main/tray-icons.ts` |
| Tray icon script | `scripts/build-tray-icons.py` |
| Tests (Vitest) | `tests/`, `vitest.config.ts` |
| Sound packs | `src/assets/sounds/default/` |
| Docs | `docs/` |
| `/actualize` | [.cursor/commands/actualize.md](.cursor/commands/actualize.md) |

## Commands

```bash
npm run dev          # electron-vite: tray + dashboard
npm run build
npm run typecheck    # main + renderer + tests
npm test             # Vitest suite
```

Caches and Electron binary stay on **E:** — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Do not download Electron into `%LOCALAPPDATA%` on the system drive.

## Hard rules (from CONCEPT)

1. One popup = one exercise.
2. Optional layers must not break the core cycle.
3. Character progress is computed from data; visuals are swappable.
4. Validate external / AI `Exercise` payloads before use.
5. Prefer stubs and incremental delivery over full logic dumps.

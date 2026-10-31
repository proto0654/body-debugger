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
| Weight history (rules, store, card) | `shared/domain/weight.ts`, `src/stores/weight.ts`, `src/components/weight/` |
| Streak (day-based) | `shared/domain/streak.ts` |
| Sounds (rules, player, pack) | `shared/domain/sounds.ts`, `src/sounds.ts`, `src/assets/sounds/default/` |
| Voice production catalog + manual batch cutter | `src/assets/sounds/production.json`, `scripts/cut-audio-batch.py` |
| Per-clip audio API generator + take log | `scripts/generate-audio-api.mjs`, `src/assets/sounds/api-report.json` |
| Progress photos (rules, main store, protocol, UI) | `shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`, `src/components/photos/` |
| AI proposals (parsing, approval, store, UI) | `shared/domain/ai-proposal.ts`, `electron/main/custom-exercises.ts`, `src/components/ai/` |
| Themes / equipment | `shared/constants/themes.ts`, `shared/constants/equipment.ts`, `src/styles/index.css` |
| Core preferences (interval, picker mode, Focus, identity/build) | `shared/domain/preferences.ts`, `shared/constants/focus.ts`, `src/components/settings/` |
| Dashboard calendar + stats | `shared/domain/stats.ts`, `src/components/stats/` |
| Native laboratory (dev-only, isolated profile) | `src/debug/`, `shared/domain/laboratory.ts`, `electron/main/laboratory.ts` |
| Manual visual preview | `src/debug/AppearancePanel.vue`, `src/views/LaboratoryPreviewView.vue`, `shared/domain/laboratory-preview.ts` |
| Native replay phases / semantic driver | `electron/main/laboratory-playback.ts`, `shared/domain/laboratory-playback.ts` |
| Application clock / laboratory time | `shared/domain/clock.ts`, `src/stores/runtime.ts` |
| Preload bridge | `electron/preload/` |
| Vue renderer | `src/` |
| Pinia hydrate | `src/bootstrap/hydrate.ts` |
| Shared types & validation | `shared/` |
| Exercise catalog + domain rules (picker, character, session extras, weight) | `shared/constants/exercises.ts`, `shared/domain/` |
| Character assets (source sheets + cut frames) | `src/assets/character/desk-hulk/` |
| Additional character art (nine packs, three builds) | [Art library](src/assets/character/README.md), `src/assets/character/packs.json` |
| Character profile / evolution | `src/components/character/CharacterSettingsPanel.vue`, `src/components/character/CharacterJourney.vue` |
| Character identity catalog / picker | `shared/constants/character-packs.ts`, `src/components/character/CharacterPicker.vue` |
| Temporary character condition (neglect / recovery) | `shared/domain/character-condition.ts` |
| Character frame rules / resolver | `shared/domain/character-visual.ts`, `src/components/character/frames.ts` |
| Sprite cutting script | `scripts/cut-character-sprites.py` |
| Motion preference / feedback timings | `src/motion.ts`, `shared/domain/reaction-timing.ts` |
| Keyframes + reduced-motion CSS | `src/styles/index.css` |
| Tray frames + animation specs | `electron/resources/tray/`, `electron/main/tray-icons.ts` |
| Tray icon script | `scripts/build-tray-icons.py` |
| Tests (Vitest) | `tests/`, `vitest.config.ts` |
| Docs | `docs/` |
| `/actualize` | [.cursor/commands/actualize.md](.cursor/commands/actualize.md) |

## Commands

```bash
npm run dev          # electron-vite: tray + dashboard
npm run dev:lab      # isolated native visual laboratory + tray + dashboard
npm run build
npm run typecheck    # main + renderer + tests
npm test             # Vitest suite
```

Audio production: `node scripts/generate-audio-api.mjs --character <id> --dry-run` lists the next clips without spending credits; see [docs/AUDIO-PRODUCTION.md](docs/AUDIO-PRODUCTION.md).

Caches and Electron binary stay on **E:** — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Do not download Electron into `%LOCALAPPDATA%` on the system drive.

## Hard rules (from CONCEPT)

1. One popup = one exercise.
2. Optional layers must not break the core cycle.
3. Character progress is computed from data; visuals are swappable.
4. Validate external / AI `Exercise` payloads before use.
5. Prefer stubs and incremental delivery over full logic dumps.

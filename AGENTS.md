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
| Generated voice manifest + audition panel | `src/voice-assets.ts`, `src/debug/SoundAuditionPanel.vue` |
| Voice production catalog + manual batch cutter | `src/assets/sounds/production.json`, `scripts/cut-audio-batch.py` |
| Per-clip audio API generator + take log | `scripts/generate-audio-api.mjs`, `src/assets/sounds/api-report.json` |
| Voice Design casting + sound effects generators | `scripts/cast-voices-api.mjs`, `scripts/generate-effects-api.mjs` |
| Progress photos (rules, main store, protocol, UI) | `shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`, `src/components/photos/` |
| AI proposals (parsing, approval, store, UI) | `shared/domain/ai-proposal.ts`, `electron/main/custom-exercises.ts`, `src/components/ai/` |
| Themes / equipment | `shared/constants/themes.ts`, `shared/constants/equipment.ts`, `src/styles/index.css` |
| Core preferences (interval, picker mode, Focus, identity/build) | `shared/domain/preferences.ts`, `shared/constants/focus.ts`, `src/components/settings/` |
| Dashboard calendar + stats | `shared/domain/stats.ts`, `src/components/stats/` |
| Real-history chronicle (read-only timeline, no writes) | `shared/domain/chronicle.ts`, `src/components/character/CharacterChronicle.vue` |
| Shared session summary / transition text | `shared/domain/character-summary.ts` |
| Native laboratory (dev-only, isolated profile, one window) | `src/debug/`, `shared/domain/laboratory.ts`, `electron/main/laboratory.ts`, `electron/main/windows/dashboard.ts` |
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
| Installer config + icons | `electron-builder.yml`, `electron-builder.dev.yml`, `electron/resources/icon.ico`, `electron/resources/icon-dev.ico`, `scripts/build-app-icon.py` |
| Release script + CI | `scripts/publish-build.mjs`, `.github/workflows/release.yml` |
| Build identity / profiles | `shared/domain/app-identity.ts`, `electron/main/app-identity.ts`, `electron/main/lab-environment.ts` |
| Update feed, install gating, update UI | `electron/main/updater.ts`, `electron/main/ipc/updates.ts`, `shared/domain/update.ts`, `src/components/settings/AboutPanel.vue` |
| Update prompt window | `electron/main/windows/update-prompt.ts`, `src/views/UpdatePromptView.vue` |
| Launch at login / system settings | `shared/domain/launch-at-login.ts`, `electron/main/launch-at-login.ts`, `src/components/settings/SystemPanel.vue` |
| Main-process log, build stamp, app info IPC | `electron/main/logger.ts`, `electron/main/build-info.ts`, `electron/main/ipc/app.ts`, `src/components/settings/AboutPanel.vue` |
| Tests (Vitest) | `tests/`, `vitest.config.ts` |
| Docs | `docs/` |
| `/actualize` | [.cursor/commands/actualize.md](.cursor/commands/actualize.md) |

## Commands

```bash
npm run dev          # electron-vite: tray + dashboard
npm run dev:lab      # isolated native visual laboratory (one dashboard window with a lab tab)
npm run build
npm run build:win    # prod NSIS installer + latest.yml in dist/ (see docs/DELIVERY.md)
npm run build:dir    # unpacked prod package for a quick packaged run
npm run build:dev    # dev NSIS installer in dist-dev/; dev.yml for a -dev.N version
npm run build:dev:dir # unpacked dev app in dist-dev/win-unpacked
npm run publish:prod # build + publish stable (requires GH_TOKEN)
npm run publish:dev  # build + publish dev prerelease (requires GH_TOKEN)
npm run typecheck    # main + renderer + tests
npm test             # Vitest suite
```

Audio production: `node scripts/generate-audio-api.mjs --character <id> --dry-run` lists the next clips without spending credits; casting and effects dry-runs: `node scripts/cast-voices-api.mjs --missing --dry-run`, `node scripts/generate-effects-api.mjs --dry-run`. See [docs/AUDIO-PRODUCTION.md](docs/AUDIO-PRODUCTION.md).

Caches and Electron binary stay on **E:** — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Do not download Electron into `%LOCALAPPDATA%` on the system drive.

## Hard rules (from CONCEPT)

1. One popup = one exercise.
2. Optional layers must not break the core cycle.
3. Character progress is computed from data; visuals are swappable.
4. Validate external / AI `Exercise` payloads before use.
5. Prefer stubs and incremental delivery over full logic dumps.

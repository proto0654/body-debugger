# Body Debugger — project context

Permanent snapshot for agents. Domain detail lives in linked docs — no session changelogs here.

## What this is

- Desktop **system-tray** app for IT workers: remind → one exercise popup → record result → update streak / character / stats.
- Core principle: **one popup = one exercise**. Stats, character, weight, photos, AI, inventory are optional layers.
- Current stage: working product prototype with a complete core loop, optional local layers and a character-led dashboard. Remaining product limits are tracked in [ROADMAP.md](ROADMAP.md).

## Communication

| Channel | Language |
|---------|----------|
| Chat | Russian |
| `docs/**`, `AGENTS.md`, Cursor commands | English |
| [CONCEPT.md](../CONCEPT.md) | Russian (product SoT) |
| UI strings | Russian |

## Stack

- Electron + Vue 3 + Vite (`electron-vite`) + TypeScript
- Pinia, Vue Router (hash routes `#/popup`, `#/dashboard`, `#/lab-playground`, `#/laboratory-preview`)
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
| Weight history rules (range, series, goal, backfill) | `shared/domain/weight.ts` |
| Weight store / dashboard card | `src/stores/weight.ts`, `src/components/weight/` |
| Streak rules (day-based current / max) | `shared/domain/streak.ts` |
| Sounds rules + renderer player + generated voice manifest | `shared/domain/sounds.ts`, `src/sounds.ts`, `src/voice-assets.ts` |
| Sound auditioning (Playground laboratory) | `src/debug/SoundAuditionPanel.vue` |
| Photo rules / main store / protocol / UI | `shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`, `src/components/photos/` |
| AI proposal parsing + approval | `shared/domain/ai-proposal.ts`, `electron/main/custom-exercises.ts`, `src/components/ai/` |
| Themes + equipment catalogs | `shared/constants/themes.ts`, `shared/constants/equipment.ts` |
| Dashboard aggregation (heatmap / stats) | `shared/domain/stats.ts`, `src/components/stats/` |
| Real-history chronicle (read-only timeline) | `shared/domain/chronicle.ts`, `src/components/character/CharacterChronicle.vue`, `shared/domain/character-context.ts` |
| Shared session summary / transition text | `shared/domain/character-summary.ts` |
| Playground (main character context, manual preview, lab context) | `src/components/character/PlaygroundPanel.vue`, `src/components/character/ManualCharacterControls.vue`, `src/components/character/PlaygroundLabWebview.vue` |
| Native laboratory (Playground tab, headless sandbox engine) | `src/debug/`, `src/views/PlaygroundLabView.vue`, `shared/domain/laboratory.ts`, `electron/main/laboratory.ts`, `electron/main/lab-engine.ts`, `electron/main/lab-headless.ts`, `electron/preload/lab.ts` |
| Native replay phases / semantic actions | `electron/main/laboratory-playback.ts`, `shared/domain/laboratory-playback.ts` |
| App clock / renderer runtime metadata | `shared/domain/clock.ts`, `src/stores/runtime.ts` |
| Preload API | `electron/preload/index.ts` (real app), `electron/preload/lab.ts` (playground lab webview) |
| Renderer entry | `src/main.ts`, `src/App.vue`, `src/router.ts` |
| Hydrate bootstrap | `src/bootstrap/hydrate.ts` |
| Stores | `src/stores/` |
| Reminder schedule store (UI mirror) | `src/stores/reminder.ts` |
| Domain rules (picker, character, severity, session extras, weight) | `shared/domain/` |
| Core preferences (interval, picker mode, Focus, identity/build) | `shared/domain/preferences.ts`, `shared/constants/focus.ts`, `src/components/settings/` |
| Exercise catalog (34) | `shared/constants/exercises.ts` |
| Shared types | `shared/types/` |
| Exercise validation | `shared/validation/exercise.ts` |
| Desk Hulk assets (sheets + cut frames) | `src/assets/character/desk-hulk/` |
| Character frame rules (stage → body, branch pose, emotion bust, neglect) | `shared/domain/character-visual.ts` |
| Temporary condition from saved results | `shared/domain/character-condition.ts` |
| Additional character art manifest | `src/assets/character/packs.json` |
| Character identity catalog / picker | `shared/constants/character-packs.ts`, `src/components/character/CharacterPicker.vue` |
| Frame key → bundled URL | `src/components/character/frames.ts` |
| Sprite cutting script | `scripts/cut-character-sprites.py` |
| Motion preference + popup exit timings | `src/motion.ts` |
| Keyframes / reduced-motion CSS | `src/styles/index.css` |
| Tray frames + specs | `electron/resources/tray/`, `electron/main/tray-icons.ts` |
| Tray icon script | `scripts/build-tray-icons.py` |
| Delivery config, dev build, release scripts | `electron-builder.yml`, `electron-builder.dev.yml`, `scripts/publish-build.mjs`, `.github/workflows/release.yml` |
| Build identity / profile split | `shared/domain/app-identity.ts`, `electron/main/app-identity.ts`, `electron/main/lab-environment.ts` |
| Updates + update prompt | `electron/main/updater.ts`, `electron/main/windows/update-prompt.ts`, `src/views/UpdatePromptView.vue` |
| Launch at login | `shared/domain/launch-at-login.ts`, `electron/main/launch-at-login.ts`, `src/components/settings/SystemPanel.vue` |
| Tests (Vitest) | `tests/` (unit / stores / components), config `vitest.config.ts` |
| Sound packs (default mp3) | `src/assets/sounds/default/` |
| Generated voice + effect takes | `src/assets/sounds/<character>/`, `src/assets/sounds/system/` |
| Electron userData + JSON | `.userdata/` → `.userdata/data/*.json` (gitignored) |

## Source of truth

| Concern | Owner |
|---------|-------|
| Product rules (cycle, severity, character model, picker) | [CONCEPT.md](../CONCEPT.md) |
| What code already reflects | [ARCHITECTURE.md](ARCHITECTURE.md) |
| How to run / caches | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Installer, updates, build stamp | [DELIVERY.md](DELIVERY.md) |
| Optional sound cues + packs | [SOUNDS.md](SOUNDS.md) |
| Tests + native laboratory | [TESTING.md](TESTING.md) |
| Next work | [ROADMAP.md](ROADMAP.md) |

## Current focus

- Keep the app runnable (`npm run dev` → tray + dashboard; data survives restart).
- Trigger loop: interval from last completion, idle hold/reset, snooze, tray + dashboard pause, `missed` timeout.
- Picker: 34-exercise catalog plus approved AI exercises, zone/group penalties, neglect bonus, Focus, inventory gate, four modes.
- Character stage/branch and a **day-based streak** derive from history. Streak is recomputed on snapshot reads and in the dashboard clock, so a gap cannot leave an old active run visible.
- Temporary character condition also derives from history: skips/misses add points (cap 10), completions remove 2; levels at 3/6/10 select nine generated neglect bodies. Earned stage/branch and selected build are preserved; see [ARCHITECTURE.md](ARCHITECTURE.md#temporary-character-condition).
- Severity: explicit «Начать» starts the timer. Medium/Hardcore gate «Готово» at 80%; Hardcore accepts pointer or keyboard hold. Results are acknowledged after a durable session write and retries are idempotent.
- Optional photo/AI hydration runs in the background and cannot block mounting the core renderer.
- Comic reactions: `shared/domain/character-reaction.ts` owns contextual captions/emotions; `ComicBubble.vue` renders them. Deterministic speech/burst/ribbon/cloud variants and UI reaction identities support repeated effects. Shared reading times are 4500 ms for done, 6000 ms for milestones and 2500 ms for skip/snooze; popup exit adds 180 ms.
- Character art is cut per frame; emoji fallback also handles a failed image load. Motion respects the dashboard switch and the OS setting.
- Nine additional character packs have 432 source-derived frames (three builds × sixteen states each), indexed by `src/assets/character/packs.json`. They are selectable alongside Desk Hulk through the manifest-backed picker; their six distinct stages resolve across all windows. See the [character art library](../src/assets/character/README.md).
- Optional layers are live (new profiles enable sounds at 40%; other layers are off by default): session details, weight history, photos, inventory, sounds, AI proposals, themes.
- The [audio production package](AUDIO-PRODUCTION.md) authors ten voice profiles, 400 voice positions and nine shared effect prompts in `src/assets/sounds/production.json`. Manual pilots use separated batch tracks with `scripts/cut-audio-batch.py`; Voice Design casting, per-clip speech and Sound Effects generation use `scripts/cast-voices-api.mjs`, `scripts/generate-audio-api.mjs` and `scripts/generate-effects-api.mjs`, logging takes in `src/assets/sounds/api-report.json`. Selection, duration and review records live with the catalog/sources. All ten voices are cast and every position has a first take, but nothing has been listened to: 45 takes exceed their budget and four chuckles are under 0.2 s.
- The generated voice and effects are the default sound experience (`sound.voiceEnabled` on; toggle in «Настройки → Звуки»). Cue files are the generated `system/` takes; the popup speaks `ready`, `active`, `first-done`, `done`, `skipped`, `snoozed`, `stage-up` and the failed-save error, with the generated cue as the fallback and variants rotating without immediate repeats. Clips are bundled through `src/voice-assets.ts` (418 mp3 assets, ~11 MB). Queueing, `streak`/`welcome`/`alert` narration, per-event mixes and OS DND detection are not implemented. Laboratory «Звуки» auditions every variant and effect take without changing settings.
- Dashboard: five primary sections. «Сегодня» foregrounds the large character, day totals, current streak and progress to the next form. «Персонаж» groups identity/build and preview under «Профиль» and adds a read-only «Хроника» over the real session history (scrub/play, milestones, calendar and statistics up to the cursor; no writes). «Плейграунд» has a read-only «Основной персонаж» context (same chronicle plus a temporary manual form/condition/build/branch/emotion preview that is never saved) and a «Лаборатория» context that embeds the full sandbox UI. «Прогресс» groups calendar/stats, weight history and photos. «Настройки» groups rhythm/strictness, picker/Focus with inventory/AI, sound and appearance; current-day values refresh while open.
- Core preferences: the «Настройки» tab edits interval (5–240 min), picker mode and Focus; character identity and build on «Персонаж»; values are normalized on load, and an interval change reschedules the loop.
- Renderer CSP lists `photo:` in `img-src`, so progress photos load through the custom scheme.
- Native laboratory: the full lab UI lives in «Плейграунд → Лаборатория»; there is no separate lab window and no `dev:lab` command. The normal main process spawns a headless Electron child with `--body-debugger-lab --body-debugger-lab-headless` and an isolated profile — `.userdata/laboratory/` when unpackaged and `%APPDATA%\Body Debugger\laboratory` (or the dev-channel equivalent) when packaged. The child runs the reminder loop, owns the six laboratory stories, silent seeking, native phased replay with automatic/interactive modes, original/manual branches, seeded calendars, action plans, popup/idle/write-failure controls, settings/data and its native popup/preview windows; it opens no tray or dashboard. The main dashboard embeds the lab panel in a webview at `#/lab-playground` with the dedicated `electron/preload/lab.ts`; `electron/main/lab-engine.ts` forwards typed requests and child events over Node IPC, and `electron/main/lab-headless.ts` dispatches data/lab commands inside the sandbox. The bridge accepts only the registered lab webview; the real dashboard stays open and the real profile is never touched. «Ручная проверка» exposes clickable forms, condition, branches, builds, emotions and popup states; the independent native preview synchronizes visual overrides without writing sessions or changing scenario time. Replay uses the profile's live sound settings and waits for completed popup feedback and actual window closure; only the popup owns its result audio. Shared app time follows the virtual cursor/rate; pause freezes deadlines and dispatch while animation/hold time stays real. The sandbox never runs the update feed. See [TESTING.md](TESTING.md).
- Distribution: two Windows identities — prod `Body Debugger` (`com.bodydebugger.app`, `%APPDATA%\Body Debugger`, emerald icon) and side-by-side dev `Body Debugger Dev` (`com.bodydebugger.app.dev`, `%APPDATA%\Body Debugger Dev`, amber `DEV` icon). Each has its own updater cache, single-instance lock and autostart registry value. Prod reads stable `latest.yml`; dev reads `dev.yml` from `-dev.N` prereleases. Auto-update checks 25 s after start and every 4 hours, opens a bottom-right prompt with download progress, hides it while an exercise popup is open, offers a restart (refused during a popup) and installs on quit. Autostart is an off-by-default setting that launches hidden in the tray; the OS registry is the source of truth and uninstall removes it. See [DELIVERY.md](DELIVERY.md).
- Tests: Vitest covers domain rules, stores, persistence, preferences, popup/portrait/weight/heatmap/stats/photo/AI components, the playground contexts and manual preview, the headless laboratory engine/bridge, the sandbox laboratory controller/driver, the dashboard chronicle, the dashboard window contract, update schedule/gating/prompt rules, build identity and autostart.
- Known gaps: six distinct body illustrations for the default Desk Hulk (still three tiers), personal exercise-level progression, automatic AI analysis, export, external-event triggers and Playwright E2E. Window/tray integration still needs manual Electron smoke checks.

## Doc index

| Doc | Role |
|-----|------|
| [README.md](README.md) | Hub / TOC |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, IPC, persistence |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Dev commands, E: caches |
| [DELIVERY.md](DELIVERY.md) | Installer, update feed, build stamp, release flow |
| [SOUNDS.md](SOUNDS.md) | Optional sound layer + default pack |
| [TESTING.md](TESTING.md) | Vitest suite + native laboratory workflow and limits |
| [ROADMAP.md](ROADMAP.md) | Post-skeleton milestones |
| [../CONCEPT.md](../CONCEPT.md) | Product SoT |
| [../AGENTS.md](../AGENTS.md) | Agent entry |

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
- Pinia, Vue Router (hash routes `#/popup`, `#/dashboard`, `#/laboratory-preview`)
- Repositories: public source `proto0654/body-debugger`; public release feed `proto0654/body-debugger-releases`
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
| Sound auditioning (laboratory) | `src/debug/SoundAuditionPanel.vue` |
| Photo rules / main store / protocol / UI | `shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`, `src/components/photos/` |
| Catalog V2 (resolve, picker, dose, tune, LLM) | [CATALOG-V2.md](CATALOG-V2.md), `shared/domain/catalog.ts`, `picker.ts`, `dose.ts`, `tune.ts`, `llm-parse.ts`, `electron/main/catalog-store.ts`, `electron/main/llm/`, `shared/constants/exercise-v2-tags.ts`, `src/components/catalog/` |
| Catalog UI (library, explainer, playground, queue) | [CATALOG-UI.md](CATALOG-UI.md), `shared/constants/field-docs.ts`, `shared/domain/catalog-sandbox.ts`, `shared/domain/queue.ts`, `electron/main/queue-store.ts` |
| AI proposal parsing + approval (legacy paste + catalog write) | `shared/domain/ai-proposal.ts`, `electron/main/custom-exercises.ts`, `src/components/ai/` |
| Themes + equipment catalogs | `shared/constants/themes.ts`, `shared/constants/equipment.ts` |
| Dashboard aggregation (heatmap / stats) | `shared/domain/stats.ts`, `src/components/stats/` |
| Real-history chronicle (shared playback engine, no profile writes) | `shared/domain/chronicle.ts`, `src/components/character/CharacterChronicle.vue`, `electron/main/chronicle-playback.ts`, `shared/domain/character-context.ts` |
| Shared session summary / transition text | `shared/domain/character-summary.ts` |
| Manual character preview (chronicle) | `src/components/character/ManualCharacterControls.vue` |
| Native laboratory (dashboard tab, nested host, headless sandbox) | `src/debug/LaboratoryHost.vue`, `src/debug/`, `shared/domain/laboratory.ts`, `electron/main/laboratory.ts`, `electron/main/lab-engine.ts`, `electron/main/lab-headless.ts` |
| Shared playback coordinator (chronicle + lab mutex, +30s defer) | `shared/domain/playback-coordinator.ts`, `electron/main/playback-coordinator.ts`, `electron/main/chronicle-playback.ts` |
| Shared arcade replay (lab + chronicle) / semantic actions | `electron/main/laboratory-playback.ts`, `shared/domain/laboratory-playback.ts` |
| App clock / renderer runtime metadata | `shared/domain/clock.ts`, `src/stores/runtime.ts` |
| Preload API | `electron/preload/index.ts` |
| Renderer entry | `src/main.ts`, `src/App.vue`, `src/router.ts` |
| Hydrate bootstrap | `src/bootstrap/hydrate.ts` |
| Stores | `src/stores/` |
| Reminder schedule store (UI mirror) | `src/stores/reminder.ts` |
| Domain rules (picker, character, severity, session extras, weight) | `shared/domain/` |
| Core preferences (interval, picker mode, Focus V2 / λ, identity/build) | `shared/domain/preferences.ts`, `shared/domain/focus-v2.ts`, `shared/constants/focus.ts`, `src/components/settings/` |
| Exercise catalog (34 shipped) + V2 axes/tuning | `shared/constants/exercises.ts`, `shared/constants/catalog-axes.ts`, `shared/constants/catalog-tuning.ts` |
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
| Tray portrait + countdown ring | `electron/main/tray-portrait.ts`, `shared/domain/tray-countdown.ts` |
| Tray pin (show next to the clock) | `electron/main/tray-pin.ts`, `shared/domain/tray-pin.ts` |
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
| Catalog V2 design + acceptance | [CATALOG-V2.md](CATALOG-V2.md) |
| Catalog UI (dashboard library / sandbox / queue) | [CATALOG-UI.md](CATALOG-UI.md) |
| How to run / caches | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Installer, updates, build stamp | [DELIVERY.md](DELIVERY.md) |
| Optional sound cues + packs | [SOUNDS.md](SOUNDS.md) |
| Tests + native laboratory | [TESTING.md](TESTING.md) |
| Next work | [ROADMAP.md](ROADMAP.md) |

## Current focus

- Happy path: `npm run dev` (HMR) for daily work; stable GitHub prod installs + in-app updates for shipped use. Retiring the side-by-side Dev channel is ROADMAP #18.
- Keep the app runnable (`npm run dev` → tray + dashboard; data survives restart).
- Trigger loop: interval from last completion, idle hold/reset, snooze, tray + dashboard pause, `missed` timeout.
- Picker (Catalog V2): zone-vector weights, share-based Focus V2 + λ, dose by interval, inventory / intensity / limitations filters, four modes (rotation = zone cycle). User/llm exercises live in `catalog.json`; legacy `custom-exercises.json` migrates once.
- Character stage/branch and a **day-based streak** derive from history. Streak is recomputed on snapshot reads and in the dashboard clock, so a gap cannot leave an old active run visible.
- Temporary character condition also derives from history: skips/misses add points (cap 10), completions remove 2; levels at 3/6/10 select nine generated neglect bodies. Earned stage/branch and selected build are preserved; see [ARCHITECTURE.md](ARCHITECTURE.md#temporary-character-condition).
- Severity: explicit «Начать» starts the timer. Medium/Hardcore gate «Готово» at 80%; Hardcore accepts pointer or keyboard hold. Results are acknowledged after a durable session write and retries are idempotent.
- Optional photo/AI hydration runs in the background and cannot block mounting the core renderer.
- Comic reactions: `shared/domain/character-reaction.ts` owns contextual captions/emotions; `ComicBubble.vue` renders them. Deterministic speech/burst/ribbon/cloud variants and UI reaction identities support repeated effects. Shared reading times are 4500 ms for done, 6000 ms for milestones and 2500 ms for skip/snooze; popup exit adds 180 ms.
- Character art is cut per frame; emoji fallback also handles a failed image load. Motion respects the dashboard switch and the OS setting.
- Nine additional character packs have 432 source-derived frames (three builds × sixteen states each), indexed by `src/assets/character/packs.json`. They are selectable alongside Desk Hulk through the manifest-backed picker; their six distinct stages resolve across all windows. See the [character art library](../src/assets/character/README.md).
- Optional layers are live (new profiles enable sounds at 40%; other layers are off by default): weight history, photos, inventory, sounds, AI proposals, themes. Session-detail fields remain in history/validation; the popup no longer collects them.
- The [audio production package](AUDIO-PRODUCTION.md) authors ten voice profiles, 400 voice positions and nine shared effect prompts in `src/assets/sounds/production.json`. Manual pilots use separated batch tracks with `scripts/cut-audio-batch.py`; Voice Design casting, per-clip speech and Sound Effects generation use `scripts/cast-voices-api.mjs`, `scripts/generate-audio-api.mjs` and `scripts/generate-effects-api.mjs`, logging takes in `src/assets/sounds/api-report.json`. Selection, duration and review records live with the catalog/sources. All ten voices are cast and every position has a first take, but nothing has been listened to: 45 takes exceed their budget and four chuckles are under 0.2 s.
- The generated voice and effects are the default sound experience (`sound.voiceEnabled` on; toggle in «Настройки → Звуки»). Cue files are the generated `system/` takes; the popup speaks `ready`, `active`, `first-done`, `done`, `skipped`, `snoozed`, `stage-up` and the failed-save error, with the generated cue as the fallback and variants rotating without immediate repeats (last take remembered across popup windows; chronicle preview keeps a separate rotation namespace). Clips are bundled through `src/voice-assets.ts` (418 mp3 assets, ~11 MB). The popup player queues lines so entry/`active`/result never cut each other; `streak`/`welcome`/`alert` narration, per-event mixes and OS DND detection are not implemented. Laboratory «Звуки» auditions every variant and effect take without changing settings.
- Dashboard: six primary sections. «Сегодня» foregrounds the large character, day totals, current streak and progress to the next form. «Персонаж» groups identity/build under «Профиль» and «Хроника» (real history scrub/play via the shared arcade `NativePlayback` engine, preview character overlay, milestones, calendar/statistics up to the cursor; no profile writes). «Лаборатория» mounts the sandbox UI natively in the same dashboard (nested Pinia + lab bridge; headless child owns the test profile). «Прогресс» groups calendar/stats, weight history and photos. «Упражнения» covers the exercise library (numbers explained via `field-docs`), playground sandbox, coverage matrix, named sets and the optional LLM layer; a next-breaks queue can pin or constrain upcoming picks. «Настройки» groups rhythm/strictness, picker/Focus V2/λ/autoTune with inventory, sound, weight/photos and appearance (including tray pin on installed Windows 11); current-day values refresh while open.
- Core preferences: the «Настройки» tab edits interval (5–240 min), picker mode and Focus V2; character identity and build on «Персонаж»; values are normalized on load, and an interval change reschedules the loop and scales dose.
- Renderer CSP lists `photo:` in `img-src`, so progress photos load through the custom scheme.
- Native laboratory: the full lab UI lives on the «Лаборатория» dashboard tab (`LaboratoryHost` + nested Pinia); there is no separate lab window, no webview guest and no `dev:lab` command. The main process pre-warms a headless Electron child with `--body-debugger-lab --body-debugger-lab-headless` and an isolated profile — `.userdata/laboratory/` when unpackaged and `%APPDATA%\Body Debugger\laboratory` (or the dev-channel equivalent) when packaged. The child runs the reminder loop, owns the six laboratory stories, silent seeking, native phased replay, seeded calendars, action plans, popup/idle/write-failure controls, settings/data and its native popup/preview windows; it opens no tray or dashboard. `lab-engine.ts` registers the dashboard host and forwards bridge requests; only `LabChanged` (with sandbox snapshot) is relayed to the host so the real Pinia is never overwritten. Chronicle play and laboratory play share one arcade `NativePlayback` sequencer (event → scene beat → popup → semantic driver → voice-gated feedback → next; no tempo control) behind `playback-coordinator` (mutex); real timer/manual reminders are deferred until the run ends + 30 s. See [TESTING.md](TESTING.md).
- Distribution: primary path is prod `Body Debugger` (`com.bodydebugger.app`, `%APPDATA%\Body Debugger`, emerald icon) updating from stable `latest.yml`. A legacy side-by-side `Body Debugger Dev` identity still exists and is scheduled for removal (ROADMAP #18). Current stable is `0.7.0` (published 2026-11-02). Auto-update checks 25 s after start and every hour, opens a bottom-right prompt with download progress, hides it while an exercise popup is open, offers a restart (refused during a popup) and installs on quit. Autostart is an off-by-default setting that launches hidden in the tray; the OS registry is the source of truth and uninstall removes it. See [DELIVERY.md](DELIVERY.md).
- Tests: Vitest covers domain rules, stores, persistence, preferences, popup/portrait/weight/heatmap/stats/photo/AI components, the playback coordinator, the headless laboratory engine/bridge, the sandbox laboratory controller/driver, the dashboard chronicle, the dashboard window contract, update schedule/gating/prompt rules, build identity and autostart.
- Known gaps: six distinct body illustrations for the default Desk Hulk (still three tiers), custom pack import, exercise-level progression beyond autoTune scales, export, external-event triggers and Playwright E2E. Window/tray integration still needs manual Electron smoke checks. Optional LLM catalog editing is implemented behind approval + `safeStorage` key. The 34 shipped exercises carry hand-retagged Catalog V2 fields in `shared/constants/exercise-v2-tags.ts`.

## Doc index

| Doc | Role |
|-----|------|
| [README.md](README.md) | Hub / TOC |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, IPC, persistence |
| [CATALOG-V2.md](CATALOG-V2.md) | Catalog / picker / dose / LLM design |
| [CATALOG-UI.md](CATALOG-UI.md) | Catalog dashboard UI phases 4a–8b |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Dev commands, E: caches |
| [DELIVERY.md](DELIVERY.md) | Installer, update feed, build stamp, release flow |
| [SOUNDS.md](SOUNDS.md) | Optional sound layer + default pack |
| [TESTING.md](TESTING.md) | Vitest suite + native laboratory workflow and limits |
| [ROADMAP.md](ROADMAP.md) | Post-skeleton milestones |
| [../CONCEPT.md](../CONCEPT.md) | Product SoT |
| [../AGENTS.md](../AGENTS.md) | Agent entry |

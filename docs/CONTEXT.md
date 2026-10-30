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
| Weight history rules (range, series, goal, backfill) | `shared/domain/weight.ts` |
| Weight store / dashboard card | `src/stores/weight.ts`, `src/components/weight/` |
| Streak rules (day-based current / max) | `shared/domain/streak.ts` |
| Sounds rules + renderer player | `shared/domain/sounds.ts`, `src/sounds.ts` |
| Photo rules / main store / protocol / UI | `shared/domain/photos.ts`, `electron/main/photos.ts`, `electron/main/photo-protocol.ts`, `src/components/photos/` |
| AI proposal parsing + approval | `shared/domain/ai-proposal.ts`, `electron/main/custom-exercises.ts`, `src/components/ai/` |
| Themes + equipment catalogs | `shared/constants/themes.ts`, `shared/constants/equipment.ts` |
| Dashboard aggregation (heatmap / stats) | `shared/domain/stats.ts`, `src/components/stats/` |
| Debug panel + scenarios | `src/debug/`, `electron/main/ipc/debug.ts` |
| Preload API | `electron/preload/index.ts` |
| Renderer entry | `src/main.ts`, `src/App.vue`, `src/router.ts` |
| Hydrate bootstrap | `src/bootstrap/hydrate.ts` |
| Stores | `src/stores/` |
| Reminder schedule store (UI mirror) | `src/stores/reminder.ts` |
| Domain rules (picker, character, severity, session extras, weight) | `shared/domain/` |
| Core preferences (interval, picker mode, Focus, build) | `shared/domain/preferences.ts`, `shared/constants/focus.ts`, `src/components/settings/` |
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
| Tests (Vitest) | `tests/` (unit / stores / components), config `vitest.config.ts` |
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
- Trigger loop: interval from last completion, idle hold/reset, snooze, tray + dashboard pause, `missed` timeout.
- Picker: 34-exercise catalog plus approved AI exercises, zone/group penalties, neglect bonus, Focus, inventory gate, four modes.
- Character stage/branch and a **day-based streak** derive from history. Streak is recomputed on snapshot reads and in the dashboard clock, so a gap cannot leave an old active run visible.
- Severity: explicit «Начать» starts the timer. Medium/Hardcore gate «Готово» at 80%; Hardcore accepts pointer or keyboard hold. Results are acknowledged after a durable session write and retries are idempotent.
- Optional photo/AI hydration runs in the background and cannot block mounting the core renderer.
- Character art is cut per frame; emoji fallback also handles a failed image load. Motion respects the dashboard switch and the OS setting.
- Optional layers are live and off by default unless noted: session details, weight history, photos, inventory, sounds, AI proposals, themes.
- Dashboard: «Сегодня» foregrounds the large character, day totals, current streak and progress to the next form. «Настройки» owns all switches and AI imports. Calendar/stats remain separate; current-day values refresh while open.
- Core preferences: the «Настройки» tab edits interval (5–240 min), picker mode, Focus and character build; values are normalized on load, and an interval change reschedules the loop.
- Renderer CSP lists `photo:` in `img-src`, so progress photos load through the custom scheme.
- Debug panel: dev-only, with state view, quick actions, six scenario presets and per-cue sound preview.
- Tests: Vitest covers domain rules, stores, persistence, preferences, popup/portrait/weight/heatmap/stats/photo/AI components and the debug panel.
- Known gaps: six distinct body illustrations, personal exercise-level progression, automatic AI analysis, export, external-event triggers and Playwright E2E. Window/tray integration still needs manual Electron smoke checks.

## Doc index

| Doc | Role |
|-----|------|
| [README.md](README.md) | Hub / TOC |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Structure, IPC, persistence |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Dev commands, E: caches |
| [SOUNDS.md](SOUNDS.md) | Optional sound layer + default pack |
| [TESTING.md](TESTING.md) | Vitest suite (commands, coverage, gaps) + debug panel plan |
| [ROADMAP.md](ROADMAP.md) | Post-skeleton milestones |
| [../CONCEPT.md](../CONCEPT.md) | Product SoT |
| [../AGENTS.md](../AGENTS.md) | Agent entry |

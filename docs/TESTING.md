# Testing and debug mode

How we verify domain logic and run visual scenarios without fighting the tray. Product rules stay in [CONCEPT.md](../CONCEPT.md).

## Commands

```bash
npm test             # vitest run — CI-style single pass
npm run test:watch   # watch mode
npm run typecheck    # node + renderer + tests (tsconfig.test.json)
```

Stack: **Vitest** + **happy-dom** + **@vue/test-utils**. Config: [vitest.config.ts](../vitest.config.ts) (aliases `@` / `@shared` mirror the renderer). Pure domain and persistence tests run with `// @vitest-environment node` and skip the DOM setup.

## Layout

```
tests/
  fixtures.ts        # exercise / session / settings / weight builders, seeded RNG, fixed "now"
  unit/              # pure domain + JSON envelope + persistence store (node env)
  stores/            # Pinia stores with a stubbed window.api
  components/        # Vue Test Utils: CharacterPortrait, PopupView, WeightCard
```

## Covered

| Area | What the suite pins down | File |
|------|--------------------------|------|
| Reminder loop | manual trigger, single popup, done / snoozed / skipped / missed, tray states, success blink, pause, idle hold + long-break restart, interval reschedule | `tests/unit/trigger-loop.test.ts` (Electron mocked) |
| Picker | inventory gate, previous/today penalties, neglect cap, focus bonuses, four modes, deterministic roll edges | `tests/unit/exercise-picker.test.ts` |
| Character progress | stage thresholds, branch window (last 30), 20% margin, status filtering | `tests/unit/character-progress.test.ts` |
| Frame rules | stage tiers, branch pose from stage 4, build fallback, every resolved frame exists on disk | `tests/unit/character-visual.test.ts` |
| Severity | 80% unlock boundary, timer-less exercises, `mm:ss` rounding | `tests/unit/severity.test.ts` |
| Session details | ranges, weight rounding, blank / invalid input, popup toggle + resize, trigger-loop normalization | `tests/unit/session-extras.test.ts`, `tests/components/PopupView.test.ts`, `tests/unit/trigger-loop.test.ts` |
| Weight history | entry validation + rounding, session entry ids, series window/sort, change and goal gap, backfill idempotency, store add/remove guards, card validation + goal commit | `tests/unit/weight.test.ts`, `tests/unit/persistence-weight.test.ts`, `tests/stores/weight.test.ts`, `tests/components/WeightCard.test.ts` |
| Settings defaults | merge of an older settings file, nested array copies | `tests/unit/persistence-defaults.test.ts` |
| Exercise payloads | required/optional fields, bad numbers, `assertExercise` | `tests/unit/exercise-validation.test.ts` |
| Catalog | 34 entries, unique ids/titles, valid focus tags, inventory-tagged equipment | `tests/unit/exercise-catalog.test.ts` |
| JSON persistence | atomic write, missing/corrupt/outdated envelope | `tests/unit/json-file.test.ts` |
| Stores | settings persistence + weight switch/goal, progress streak, session lifecycle, weight history, character derivation, reminder labels | `tests/stores/` |
| Popup / portrait | severity gate, done + skip exits, flash and crossfade, double-submit guard, reduced motion, emoji fallback | `tests/components/` |

Rules for new tests: no snapshots for logic, inject time (`now`) and randomness (seeded RNG), assert on behaviour rather than internal constants.

## Not covered yet

- **Main-process windows, tray and IPC wiring** — needs a real Electron session; keep the manual smoke run (`npm run dev`).
- **Debug / scenario panel** — see below; fixtures do not exist yet.
- **E2E (Playwright)** — low priority until the tray flow ships.

## Manual checklist

- Tray: right-click menu, «Напоминание сейчас», pause / resume, animations (and «Уменьшить анимации» off / on).
- Popup: one exercise, Medium gate at 80%, Hardcore hold, closing the popup = `skipped`.
- Popup details: turn «Детали в попапе» on, expand the block, save reps / feeling / weight, check they land in `sessions.json` and on the dashboard.
- Weight history: turn «Вес» on, add a manual measurement, set a goal, delete an entry, relaunch and confirm `weights.json` keeps the history; a done session with a weight adds to the same list.
- Persistence: streak, stage and sessions survive a relaunch (`.userdata/data/`).
- Dashboard: form label, next reminder, severity, motion, details and weight switches.

## Debug / admin panel (planned)

Dev-only (env flag, build mode, or hidden hotkey). Must not alter production UX.

**Quick actions**

- Trigger popup now
- Simulate `done` / `snoozed` / `skipped` / `missed`
- Force stage / branch / build / emotion
- Reset progress
- Seed history sessions
- Play each sound cue ([SOUNDS.md](SOUNDS.md))

**State view**

- Current stage / branch / build
- Active Focus
- Recent sessions
- Next pick + weight breakdown

**Preset scenarios**

- Steady week of activity
- Many skips in a row
- Upper-body only
- Frequent snooze
- Forced stage-up
- Inventory emphasis

**Visual checks**

- Emotion switches
- Popup states
- Tray / popup animations with «Уменьшить анимации» on and off
- Line / quote previews

## Planned tree (debug panel)

```
src/
  debug/
    DebugPanel.vue
    scenarios.ts
```

## Principles

1. Debug mode must not change default app behavior when off.
2. Scenarios apply and roll back cleanly (prefer writing through persistence IPC so hydrate stays honest).
3. Domain logic stays testable without UI.
4. Panel covers both logic and presentation in one place.

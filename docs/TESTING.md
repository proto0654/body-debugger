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
  unit/              # pure domain, validation, JSON envelope, persistence stores (node env)
  stores/            # Pinia stores with a stubbed window.api
  components/        # Vue Test Utils: popup, portrait, weight, heatmap/stats, photos, AI, dashboard
```

## Covered

| Area | What the suite pins down | Files |
|------|--------------------------|-------|
| Reminder loop | idempotent acknowledgement, mismatched identity rejection, retry after disk failure, manual trigger, single popup, done / snoozed / skipped / missed, tray states, success blink, pause, idle hold + long-break restart, interval reschedule, photo id filtering | `tests/unit/trigger-loop.test.ts` (Electron mocked) |
| Picker | inventory gate, previous/today penalties, neglect cap, focus bonuses, four modes, deterministic roll edges | `tests/unit/exercise-picker.test.ts` |
| Character progress | stage thresholds, branch window (last 30), 20% margin, status filtering | `tests/unit/character-progress.test.ts` |
| Streak | expiration on later snapshot reads, unique days, today/yesterday grace, gaps, longest run, bad timestamps, main recompute | `tests/unit/streak.test.ts`, `tests/unit/persistence-streak.test.ts` |
| Frame rules | stage tiers, branch pose from stage 4, build fallback, every resolved frame exists on disk | `tests/unit/character-visual.test.ts` |
| Severity | 80% unlock boundary, timer-less exercises, `mm:ss` rounding | `tests/unit/severity.test.ts` |
| Session details | ranges, weight rounding, blank / invalid input, popup toggle + resize, trigger-loop normalization | `tests/unit/session-extras.test.ts`, `tests/components/PopupView.test.ts` |
| Session payloads | required fields, optional details, timestamps, photo ids, `sanitizeSessions` | `tests/unit/session-validation.test.ts` |
| Weight history | entry validation + rounding, session ids, series window/sort, change and goal gap, backfill idempotency, store guards, card validation | `tests/unit/weight.test.ts`, `tests/unit/persistence-weight.test.ts`, `tests/stores/weight.test.ts`, `tests/components/WeightCard.test.ts` |
| Photos | MIME/size limits, id normalization, main file + metadata store, missing-file cleanup, renderer store, popup attach/send/remove, gallery | `tests/unit/photos.test.ts`, `tests/unit/photo-store.test.ts`, `tests/stores/photos.test.ts`, `tests/components/PhotoGallery.test.ts` |
| AI proposals | JSON / fenced / prose parsing, invalid payloads, duplicate ids, catalog merge, main approval store, panel preview + explicit approval | `tests/unit/ai-proposal.test.ts`, `tests/unit/custom-exercises.test.ts`, `tests/stores/custom-exercises.test.ts`, `tests/components/AiProposalPanel.test.ts` |
| Sounds | settings normalization, cue map, master/volume/pause/DND gate, autoplay failure, preload, popup cues incl. stage-up | `tests/unit/sounds.test.ts`, `tests/unit/sound-player.test.ts`, `tests/components/PopupView.test.ts` |
| Themes | ids unique, unknown → default, App mirrors `data-theme` | `tests/unit/themes.test.ts`, `tests/components/App.test.ts` |
| Inventory UI | equipment catalog covers the exercise catalog, store toggle guards, dashboard chips | `tests/unit/equipment.test.ts`, `tests/stores/settings.test.ts`, `tests/components/DashboardView.test.ts` |
| Calendar / stats | local-day buckets, Monday-first weeks, intensity cap, window size, status counts, seven-day bars, zone shares, top exercises | `tests/unit/stats.test.ts`, `tests/components/CalendarHeatmap.test.ts`, `tests/components/StatsPanel.test.ts` |
| Debug panel | dev-only visibility, state view, quick actions, reset, all six scenarios, deterministic payloads, main apply | `tests/unit/debug-enabled.test.ts`, `tests/unit/debug-scenarios.test.ts`, `tests/unit/persistence-debug.test.ts`, `tests/components/DebugPanel.test.ts` |
| Settings defaults | merge of an older settings file, nested arrays, sound/theme/AI/photo blocks | `tests/unit/persistence-defaults.test.ts` |
| Core preferences | interval bounds / presets / rejection, picker mode guard, Focus normalization (dedupe, primary exclusion), store setters, «Настройки» tab + hash deep link, `photo:` CSP guard | `tests/unit/preferences.test.ts`, `tests/stores/settings.test.ts`, `tests/components/PreferencesPanel.test.ts`, `tests/components/DashboardView.test.ts`, `tests/unit/csp.test.ts` |
| Exercise payloads | required/optional fields, bad numbers, group/focus tags, `assertExercise` | `tests/unit/exercise-validation.test.ts` |
| Catalog | 34 entries, unique ids/titles, valid focus tags, inventory equipment | `tests/unit/exercise-catalog.test.ts` |
| JSON persistence | atomic write, missing/corrupt/outdated envelope | `tests/unit/json-file.test.ts` |
| Stores | settings, progress, sessions, weight, photos, approved AI, reminder labels | `tests/stores/` |
| Popup / portrait | severity gate, done/skip exits, flash and crossfade, double-submit guard, reduced motion, emoji fallback, details + photos | `tests/components/` |
| Dashboard | character hero, next-form progress, midnight refresh, optional switches on settings, theme, photos, AI panel, calendar/stats tabs | `tests/components/DashboardView.test.ts` |

Comic reactions are covered by `tests/unit/character-reaction.test.ts`, the character store, `ComicBubble` and dashboard/popup tests: caption variation, immediate-repeat prevention, calm skips, a large happy/proud portrait, restoration to the stage body and no progress mutation.

Optional hydration (`tests/stores/hydrate.test.ts`) also covers a failed photo query alongside a pending AI query: the core still starts and subscribes.

Rules for new tests: no snapshots for logic, inject time (`now`) and randomness (seeded RNG), assert on behaviour rather than internal constants. Write the test against the documented rule **before** the implementation; if the fixture assumption is wrong, fix the test, never the rule.

## Not covered yet

- **Main-process windows, tray and IPC wiring** — needs a real Electron session; keep the manual smoke run (`npm run dev`).
- **`photo://` protocol and native file handling** — main store logic is unit-tested with real temp files; the protocol needs a running Electron app.
- **E2E (Playwright)** — future work; the tray flow still needs the manual checklist.
- **Visual regression** — frame/gallery/heatmap appearance is checked by hand.

## Manual checklist

- Tray: right-click menu, «Напоминание сейчас», pause / resume, animations (and «Уменьшить анимации» off / on).
- Popup: one exercise; wait before «Начать» and confirm the timer stays full. Start, verify Medium at 80% and Hardcore with pointer/Space/Enter hold. Saved confirmation lasts one second; closing without an answer = `skipped`.
- Reliability: failed save offers retry without a success reaction; repeated delivery cannot add another result or close a different session. Photo/AI loading failures must not block the core renderer.
- Comic dialogue: ready/start/saved captions, a large happy/proud portrait after a real result, body restored after 3.5 s; calm skips/pause, all themes and reduced motion. Confirm details plus an error still fit 420 px.
- Today: character hero, day count, live streak across midnight and the next attainable form; optional switches are on «Настройки». Tray «Настройки» must select it in both a new and an existing dashboard.
- Popup details: turn «Детали в попапе» on, expand, save reps / feeling / weight; turn «Фото» on, attach a photo, submit, confirm the thumbnail appears in the popup and the photo in the dashboard gallery.
- Settings: change the interval (500 reverts), switch the picker mode, set a primary direction plus accents, change the build, relaunch and confirm all four persist.
- Sounds: turn «Звуки» on, set volume, get a popup / done / skip / snooze cue; the pause switch mutes cues.
- Inventory: turn it on, select «Мешок 50 кг», confirm bag exercises start appearing.
- AI: turn «AI-предложения» on, paste an invalid JSON (error) and a valid one (preview → approve → appears under «Утверждённые» and can be picked).
- Themes: switch all three, relaunch, confirm the theme persists.
- Weight: add/remove a measurement, set a goal, relaunch and confirm `weights.json`.
- Calendar / stats: check today's cell details, a gap day, zone bars and top exercises.
- Debug: open the «Debug» tab, apply each scenario, preview every cue, simulate each result, reset history.
- Persistence: streak, stage and sessions survive a relaunch (`.userdata/data/`).

## Debug panel (implemented)

Dev-only. The dashboard shows a **Debug** tab when `import.meta.env.DEV` is true or
`VITE_DEBUG_PANEL=1` is set. Main registers `debug:apply-scenario` only while
`app.isPackaged` is false, so a production renderer cannot replace history.

**Quick actions**

- Trigger popup now
- Simulate `done` / `snoozed` / `skipped` / `missed`
- Reset history + progress
- Force stage / branch / build through `data:save-progress`
- Force each character emotion
- Play every sound cue (preview ignores the master switch, so each file is audible)

**State view**

- Stage / branch / emotion / active Focus
- Next pick (`pickNextExercise` with deterministic roll)
- Last five sessions

**Preset scenarios** (`src/debug/scenarios.ts`)

- Steady week of activity
- Many skips in a row
- Upper-body only
- Frequent snooze
- Forced stage-up
- Inventory emphasis

**Safety**

- Scenario sessions are validated with `sanitizeSessions`, settings with `normalizeSettings`.
- Main recomputes the character from the seeded history; a hand-written stage cannot drift.
- Writes go through the normal JSON files, then `data:updated` + loop reschedule run as usual.

## Principles

1. Debug mode must not change default app behavior when off.
2. Scenarios apply through main-owned persistence, never through renderer-only state.
3. Domain logic stays testable without UI.
4. Panel covers both logic and presentation in one place.

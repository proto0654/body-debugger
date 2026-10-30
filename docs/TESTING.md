# Testing and debug mode

How we verify domain logic and run visual scenarios without fighting the tray. Product rules stay in [CONCEPT.md](../CONCEPT.md).

## Commands

```bash
npm run dev:lab      # isolated native laboratory
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
| Character condition | neglect thresholds, missed/closed popups, snooze exclusion, capped debt, recovery without future credit, chronology, replays, invalid timestamps, build variants, stage preservation and dashboard restoration | `tests/unit/character-condition.test.ts`, `tests/stores/character.test.ts`, `tests/components/DashboardView.test.ts` |
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
| Laboratory | isolated profile gate, six chronological stories, seeded calendars, import validation, virtual clock, rewind without future data, popup cancellation, main-owned playback, manual interruption, timeout, one-shot write failure and idempotent retry, saved runs, UI entry and commands | `tests/unit/lab-environment.test.ts`, `tests/unit/laboratory-scenarios.test.ts`, `tests/unit/laboratory-controller.test.ts`, `tests/unit/clock.test.ts`, `tests/components/LaboratoryPanel.test.ts`, `tests/components/DebugPanel.test.ts` |
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

The additional character art library has static completeness/PNG/build checks in
`tests/unit/character-packs.test.ts`. Optional cutter tests run with
`python -m unittest discover -s tests -p 'test_*.py'` (existing Pillow + NumPy tooling).
These also check real transparency and nonempty foreground in all 432 delivered frames.
Source mapping and regeneration: [character art library](../src/assets/character/README.md).

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
- Character condition: open the laboratory and choose «Форма → спад → восстановление». Seek to the neglect milestones, check the three build variants and the 10/10 indicator. Step through completions to see 8/6/4/2/0 points and restoration of the earned body. Snooze and pause alone must not worsen condition; relaunch must preserve it. Check transparent sprite edges on all themes.
- Today: character hero, day count, live streak across midnight and the next attainable form; optional switches are on «Настройки». Tray «Настройки» must select it in both a new and an existing dashboard.
- Popup details: turn «Детали в попапе» on, expand, save reps / feeling / weight; turn «Фото» on, attach a photo, submit, confirm the thumbnail appears in the popup and the photo in the dashboard gallery.
- Settings: change the interval (500 reverts), switch the picker mode, set a primary direction plus accents, change the build, relaunch and confirm all four persist.
- Sounds: turn «Звуки» on, set volume, get a popup / done / skip / snooze cue; the pause switch mutes cues.
- Inventory: turn it on, select «Мешок 50 кг», confirm bag exercises start appearing.
- AI: turn «AI-предложения» on, paste an invalid JSON (error) and a valid one (preview → approve → appears under «Утверждённые» and can be picked).
- Themes: switch all three, relaunch, confirm the theme persists.
- Weight: add/remove a measurement, set a goal, relaunch and confirm `weights.json`.
- Calendar / stats: check today's cell details, a gap day, zone bars and top exercises.
- Laboratory: launch from «Лаборатория» or `npm run dev:lab`; use the timeline, native popup presets and the checks below. Keep normal-profile files unchanged.
- Persistence: streak, stage and sessions survive a relaunch (`.userdata/data/`).

## Native visual laboratory

Start with `npm run dev:lab`, or open **«Лаборатория» → «Открыть лабораторию»** in the dev dashboard. The launcher starts a separate Electron process with `--body-debugger-lab`; a per-profile instance lock brings an existing laboratory forward. A separate control window leaves the real dashboard and popup available for inspection.

All laboratory stores and Chromium state live under `.userdata/laboratory/` on the project drive. Normal data stays under `.userdata/`. Main registers laboratory IPC only in an unpackaged app; mutation commands and the compatibility `debug:apply-scenario` channel also require the laboratory process. Setting a renderer debug flag cannot authorize normal-profile replacement.

### Character history

Six stories are built in [shared/domain/laboratory.ts](../shared/domain/laboratory.ts):

| Story | Checkpoints |
|-------|-------------|
| «От новичка до пика» | First completion, daily streaks, all earned stages, 80 completions |
| «Форма → спад → восстановление» | 45 completions, ten skipped/missed results, five recovery completions; earned stage stays intact |
| «Перерыв и возвращение» | Seven active days, seven empty days, return; streak expires without adding neglect |
| «Смена направления» | Posture, power, mobility through the real last-30-completions rule |
| «Всё откладываю» | Snooze followed by completion or missed result; snooze itself never adds neglect |
| «Неровный месяц» | A resolved seeded month with active days, gaps, skips and recovery |

Choose event/day/milestone steps, scrub, select a date, jump to the beginning/end, or play at 0.5/1.5/3.5 seconds per event. Controls are owned by [electron/main/laboratory.ts](../electron/main/laboratory.ts), so closing a control view does not lose the run. Reopening the laboratory controls reads the current main-owned position.

Seeking reconstructs only the event prefix up to the cursor, normalizes settings and progress, and recomputes earned stage/branch and streak. Future events do not enter the live calendar or statistics. The character, current metrics, explanation, frame candidates and calendar appear together. Checkpoint agreement verifies that the native persistence/projection path matches the domain calculation; it is not an independent oracle for the domain rules.

Scrubbing is silent. Playback permits reactions and optional audio without opening a popup for every historical event. A manually triggered real exercise stops playback immediately; its resolved result replaces the future timeline with a manual branch. Seeking returns to the selected prefix. Reload the scenario to regenerate its original future, or restore a previously saved variant.

### Random calendars and saved runs

Use 7/30/90 days, regular/uneven/frequent-skip activity, low/normal/high load, a direction, an end date and a 32-bit seed. Active days are correlated, weekends have a lower probability, and daily counts vary within a narrow range. Exercises are selected by the existing picker. Repeating the same parameters reproduces the same calendar under the current generator/catalog.

«Сохранить вариант» writes the resolved plan and cursor to `data/laboratory-run.json` in the laboratory profile. «Восстановить» restores that explicit save. JSON export/import uses native dialogs and stores resolved events as well as generator parameters; replay does not regenerate historical picks after generator changes. Format version is 1. Imports are limited to 2 MB / 2,000 chronological events, known exercise IDs, valid session payloads and unique session identities. Dates and day boundaries use the current OS time zone; replay on another time zone can regroup calendar days. Changing domain rules intentionally changes their computed interpretation.

«Сбросить тестовую историю» clears laboratory sessions/progress and resets settings. It preserves the explicit saved run and optional test media/measurements. It never deletes the normal profile.

### Real popup and tray

The «Попап и трей» section opens the real Electron window and uses the normal reminder/result/persistence path. Presets cover ordinary exercises, one completion before stage-up, Soft/Medium/Hardcore and optional session details. The current timeline position provides starting history.

- Click «Начать» in the actual popup, then advance application time by a selected number of seconds; use +1 second around unlock boundaries.
- Advance five minutes to inspect an unanswered popup becoming `missed`, or a snoozed reminder returning.
- Simulate 90 seconds / ten minutes of system idle and returning, or use the real pause switch.
- «Ошибка следующей записи» fails exactly one session write before persistence; retry in the popup must create one result and only then show success.
- Sound previews deliberately bypass the master mute switch. Normal playback respects sound settings, pause and reduced motion.
- Theme, build and motion/sound changes affect the isolated native dashboard/popup too. The appearance tab has local-only stage/branch/build/emotion/neglect overrides and a six-stage gallery; it does not edit history.

### Time and cancellation

[shared/domain/clock.ts](../shared/domain/clock.ts) defaults to real time. Laboratory snapshots carry runtime-only clock metadata; [src/stores/runtime.ts](../src/stores/runtime.ts) applies it before hydrating domain stores. Streak, picker, calendar, statistics, session timestamps, photos, weight and the popup exercise countdown share application time. A historical cursor freezes it; opening a real popup resumes it from the virtual anchor. Animation delays and Hardcore hold confirmation always use real elapsed time. Windows time is never modified.

Before a seek/reset/preset, main cancels the outstanding result timeout and success-tray reset, clears the active session identity, then closes the discarded popup. Its close callback cannot record a skip. Automatic reminders are held while viewing the historical timeline. Native mode resumes scheduling; returning to the timeline cancels that native cycle.

### Native checks still required

Unit/controller/component tests mock Electron surfaces. Verify visually on target Windows configurations: tray animation/menu, real popup completion and retry, Soft/Medium/Hardcore, keyboard hold, details/errors fitting the window, reduced motion, audio, focus, Windows scaling and multiple monitors/taskbar positions. Launching the laboratory and loading a story are smoke checks, not full visual regression coverage.

## Principles

1. Normal app behavior uses the real clock and existing persistence paths.
2. Test mutations stay in a separate main-owned laboratory profile.
3. Domain logic stays testable without UI; existing character and picker rules remain the source of truth.
4. Native visual inspection complements deterministic tests and does not replace them.

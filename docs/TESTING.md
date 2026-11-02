# Testing and debug mode

How we verify domain logic and run visual scenarios without fighting the tray. Product rules stay in [CONCEPT.md](../CONCEPT.md).

## Commands

```bash
npm run dev          # tray + dashboard; Лаборатория starts the sandbox
npm test             # vitest run — CI-style single pass
npm run test:watch   # watch mode
npm run typecheck    # node + renderer + tests (tsconfig.test.json)
npm run build:dev    # dev NSIS installer for native update/autostart checks
npm run build:dev:dir # unpacked dev app for a quick packaged run
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
| Picker / Catalog V2 | inventory gate, Focus V2 adapter, rotation/push modes, upgrade+validate of 34 shipped, resolve layers, overlap/explainPick parity, dose/intensityCap, tune hints, focus migration, LLM parse, changeset round-trip | `tests/unit/exercise-picker.test.ts`, `tests/unit/picker-v2.test.ts`, `tests/unit/exercise-v2.test.ts`, `tests/unit/catalog-resolve.test.ts`, `tests/unit/dose.test.ts`, `tests/unit/tune.test.ts`, `tests/unit/focus-v2.test.ts`, `tests/unit/llm-parse.test.ts`, `tests/unit/changeset.test.ts` |
| Character progress | stage thresholds, branch window (last 30), 20% margin, status filtering | `tests/unit/character-progress.test.ts` |
| Character condition | neglect thresholds, missed/closed popups, snooze exclusion, capped debt, recovery without future credit, chronology, replays, invalid timestamps, build variants, stage preservation and dashboard restoration | `tests/unit/character-condition.test.ts`, `tests/stores/character.test.ts`, `tests/components/DashboardView.test.ts` |
| Streak | expiration on later snapshot reads, unique days, today/yesterday grace, gaps, longest run, bad timestamps, main recompute | `tests/unit/streak.test.ts`, `tests/unit/persistence-streak.test.ts` |
| Frame rules | stage tiers, branch pose from stage 4, build fallback, every resolved frame exists on disk | `tests/unit/character-visual.test.ts` |
| Severity | 80% unlock boundary, timer-less exercises, `mm:ss` rounding | `tests/unit/severity.test.ts` |
| Session details | ranges, weight rounding, blank / invalid input, trigger-loop normalization (popup UI removed) | `tests/unit/session-extras.test.ts` |
| Session payloads | required fields, optional details, timestamps, photo ids, `sanitizeSessions` | `tests/unit/session-validation.test.ts` |
| Weight history | entry validation + rounding, session ids, series window/sort, change and goal gap, backfill idempotency, store guards, card validation | `tests/unit/weight.test.ts`, `tests/unit/persistence-weight.test.ts`, `tests/stores/weight.test.ts`, `tests/components/WeightCard.test.ts` |
| Photos | MIME/size limits, id normalization, main file + metadata store, missing-file cleanup, renderer store, popup attach/send/remove, gallery | `tests/unit/photos.test.ts`, `tests/unit/photo-store.test.ts`, `tests/stores/photos.test.ts`, `tests/components/PhotoGallery.test.ts` |
| AI proposals / catalog store | JSON / fenced / prose parsing, invalid payloads, duplicate ids, catalog.json migration from legacy custom-exercises, archive-instead-of-delete, panel preview + explicit approval | `tests/unit/ai-proposal.test.ts`, `tests/unit/custom-exercises.test.ts`, `tests/stores/custom-exercises.test.ts`, `tests/components/AiProposalPanel.test.ts` |
| Sounds | settings normalization and default-on voice, cue map, master/volume/pause/DND gate, autoplay failure, preload, generated effect preference, signal plus line, variant rotation (live vs preview scopes), `active`/`first-done`, failed-save line, audition panel, laboratory keeps live sound | `tests/unit/sounds.test.ts`, `tests/unit/sound-player.test.ts`, `tests/unit/voice-assets.test.ts`, `tests/components/SoundAuditionPanel.test.ts`, `tests/components/PopupView.test.ts`, `tests/unit/trigger-loop.test.ts`, `tests/unit/laboratory-controller.test.ts`, `tests/components/LaboratoryPanel.test.ts` |
| Themes | ids unique, unknown → default, App mirrors `data-theme` | `tests/unit/themes.test.ts`, `tests/components/App.test.ts` |
| Inventory UI | equipment catalog covers the exercise catalog, store toggle guards, dashboard chips | `tests/unit/equipment.test.ts`, `tests/stores/settings.test.ts`, `tests/components/DashboardView.test.ts` |
| Calendar / stats | local-day buckets, Monday-first weeks, intensity cap, window size, status counts, seven-day bars, zone shares, top exercises | `tests/unit/stats.test.ts`, `tests/components/CalendarHeatmap.test.ts`, `tests/components/StatsPanel.test.ts` |
| Laboratory | isolated profile gate in unpackaged and packaged builds, headless engine/bridge, native LaboratoryHost, playback coordinator mutex/defer, six chronological stories, seeded calendars, import validation, virtual clock, rewind without future data, popup cancellation, main-owned playback, manual interruption, timeout, one-shot write failure and idempotent retry, saved runs, lab commands/data | `tests/unit/lab-environment.test.ts`, `tests/unit/lab-engine.test.ts`, `tests/unit/lab-headless.test.ts`, `tests/unit/laboratory-scenarios.test.ts`, `tests/unit/laboratory-controller.test.ts`, `tests/unit/native-playback.test.ts`, `tests/unit/laboratory-ipc.test.ts`, `tests/unit/playback-coordinator.test.ts`, `tests/unit/clock.test.ts`, `tests/components/LaboratoryPanel.test.ts` |
| Dashboard chronicle | normalization/de-duplication, start/session/now entries, incremental stage/branch/condition, streak breaks, milestone indexes, end summary equals the shared domain rules, date seek, empty history; component scrub/play/date/calendar prefix, temporary manual override and no writes | `tests/unit/chronicle.test.ts`, `tests/components/CharacterChronicle.test.ts`, `tests/components/DashboardView.test.ts` |
| Settings defaults | merge of an older settings file, nested arrays, sound/theme/AI/photo blocks | `tests/unit/persistence-defaults.test.ts` |
| Updates | check schedule and interval gate, progress clamping, install gating (not ready, open popup), «О программе» statuses, install action and pushed state, prompt show/close/dismiss rules, progress → ready transition, refused restart, missing bridge | `tests/unit/update.test.ts`, `tests/components/AboutPanel.test.ts`, `tests/components/UpdatePrompt.test.ts` |
| Build identity | prod/dev productName, appId, title, unpackaged runs treated as dev, «О программе» channel row | `tests/unit/app-identity.test.ts`, `tests/components/AboutPanel.test.ts`, `tests/unit/dashboard-window.test.ts` |
| Autostart | Windows-only gate, `--hidden` parsing, get/set executable + hidden arg + product name, unsupported dev run, Task Manager warning, save failure, missing bridge | `tests/unit/launch-at-login.test.ts`, `tests/unit/launch-at-login-main.test.ts`, `tests/components/SystemPanel.test.ts` |
| Version backup | first-run marker, no-op on the same version, copy before the new version reads, existing backup preserved, rotation to two, unusable data directory | `tests/unit/persistence-backup.test.ts` |
| Core preferences | interval bounds / presets / rejection, picker mode guard, Focus V2 migration + λ/autoTune settings, store setters, «Настройки» / «Упражнения» tabs + hash deep links, `photo:` CSP guard | `tests/unit/preferences.test.ts`, `tests/unit/focus-v2.test.ts`, `tests/stores/settings.test.ts`, `tests/components/PreferencesPanel.test.ts`, `tests/components/DashboardView.test.ts`, `tests/unit/csp.test.ts` |
| Exercise payloads | required/optional fields, bad numbers, group/focus tags, `assertExercise` | `tests/unit/exercise-validation.test.ts` |
| Catalog | 34 entries, unique ids/titles, valid focus tags, inventory equipment | `tests/unit/exercise-catalog.test.ts` |
| JSON persistence | atomic write, missing/corrupt/outdated envelope | `tests/unit/json-file.test.ts` |
| Stores | settings, progress, sessions, weight, photos, approved AI, reminder labels | `tests/stores/` |
| Popup / portrait | severity gate, corner HUD layout, done/skip exits, flash and crossfade, double-submit guard, reduced motion, emoji fallback | `tests/components/` |
| Dashboard | character hero, next-form progress, midnight refresh, optional switches on settings, theme, photos, AI panel, calendar/stats tabs | `tests/components/DashboardView.test.ts` |

Comic reactions are covered by `tests/unit/character-reaction.test.ts`, the character store, `ComicBubble` and dashboard/popup tests: caption variation, immediate-repeat prevention, calm skips, a large happy/proud portrait, restoration to the stage body and no progress mutation.

Optional hydration (`tests/stores/hydrate.test.ts`) also covers a failed photo query alongside a pending AI query: the core still starts and subscribes.

Rules for new tests: no snapshots for logic, inject time (`now`) and randomness (seeded RNG), assert on behaviour rather than internal constants. Write the test against the documented rule **before** the implementation; if the fixture assumption is wrong, fix the test, never the rule.

The additional character art library has static completeness/PNG/build checks in
`tests/unit/character-packs.test.ts`. Optional cutter tests run with
`python -m unittest discover -s tests -p 'test_*.py'` (existing Pillow + NumPy tooling).
These also check real transparency and nonempty foreground in all 432 delivered frames. `tests/unit/character-resolver.test.ts` checks every identity/build, six-stage resolution, branch/condition/emotion frames and unknown IDs; portrait tests cover image-load fallback within the selected identity.
Source mapping and regeneration: [character art library](../src/assets/character/README.md).

## Not covered yet

- **Main-process windows, tray and IPC wiring** — needs a real Electron session; keep the manual smoke run (`npm run dev`).
- **Update download and install against a real feed** — the schedule, prompt gating and panel are unit-tested, but a real download, `quitAndInstall` and relaunch were verified by hand once (before the prompt). Repeat the recipe in [DELIVERY.md](DELIVERY.md#verifying-an-update-without-a-public-release) and the native dev-channel check before a release.
- **Autostart as a native toggle** — the login item, hidden launch and uninstall cleanup are covered by unit tests and an installed-build uninstall check; clicking the settings toggle still needs a manual pass.
- **`photo://` protocol and native file handling** — main store logic is unit-tested with real temp files; the protocol needs a running Electron app.
- **E2E (Playwright)** — future work; the tray flow still needs the manual checklist.
- **Visual regression** — frame/gallery/heatmap appearance is checked by hand.

## Manual checklist

- Tray: right-click menu, «Напоминание сейчас», pause / resume, animations (and «Уменьшить анимации» off / on).
- Popup: one exercise; wait before «Начать» and confirm the timer stays full. Start, verify Medium at 80% and Hardcore with pointer/Space/Enter hold. Saved confirmation lasts 4.5 s (6 s for stage-up, 2.5 s for skip/snooze), followed by a 180 ms exit; «Закрыть» can end it early; closing without an answer = `skipped`.
- Reliability: failed save offers retry without a success reaction; repeated delivery cannot add another result or close a different session. Photo/AI loading failures must not block the core renderer.
- Comic dialogue: ready/start/saved captions, a large happy/proud portrait after a real result, body restored after 4.5 s for completion or 6 s for a milestone; calm skips/pause, all themes and reduced motion. Confirm a two-line title plus a long instruction still fit 360 px, and an error still fits 460 px.
- Character condition: open the laboratory and choose «Форма → спад → восстановление». Seek to the neglect milestones, check the three build variants and the 10/10 indicator. Step through completions to see 8/6/4/2/0 points and restoration of the earned body. Snooze and pause alone must not worsen condition; relaunch must preserve it. Check transparent sprite edges on all themes.
- Today: character hero, day count, live streak across midnight and the next attainable form; optional switches are on «Настройки». Tray «Настройки» must select it in both a new and an existing dashboard.
- Weight / photos: enter weight on «Сегодня» / «Прогресс»; with photos enabled, add a shot from the gallery and confirm it appears under «Прогресс» → «Фотографии» (popup no longer attaches session details or photos).
- Settings: change interval (500 reverts), strictness, picker mode and Focus; change identity/build on «Персонаж»; relaunch and confirm persistence. Check «Прогресс» subsections and legacy calendar/stats deep links. Arrow keys, Home/End and visible focus must work on subsection tabs.
- Sounds: new profiles start enabled at 40%; existing mute/volume and legacy mute survive. Set volume, get a popup / done / skip / snooze cue; the pause switch mutes cues.
- Inventory: turn it on, select «Мешок 50 кг», confirm bag exercises start appearing.
- AI: turn «AI-предложения» on, paste an invalid JSON (error) and a valid one (preview → approve → appears under «Утверждённые» and can be picked).
- Themes: switch all three, relaunch, confirm the theme persists.
- Weight: add/remove a measurement, set a goal, relaunch and confirm `weights.json`.
- Calendar / stats: check today's cell details, a gap day, zone bars and top exercises.
- Laboratory: open «Лаборатория» in an unpackaged or installed prod/dev dashboard; use the timeline, native popup presets and the checks below. Keep normal-profile files unchanged; the packaged sandbox lives under `%APPDATA%\Body Debugger\laboratory` (or the dev-channel equivalent).
- Chronicle: open «Персонаж → Хроника»; the initial position is «Сейчас» and matches «Сегодня»; scrub back to a form/condition change, play through the history, step by day/milestone, jump to a date and check the calendar ends at the cursor. No session result is written and the profile stays unchanged.
- Updates: install a packaged dev build, publish a newer `-dev.N` prerelease and wait 25 s. The prompt appears with progress, hides while an exercise popup is open and returns after it closes; «Позже» stops the prompt for that version; «Перезапустить и обновить» relaunches into the new version. A stable build must not see the dev prerelease.
- Autostart: in an installed build open «Настройки → Система», enable autostart, verify `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` contains the product title with `--hidden`, and launch with `--hidden` (tray only, no dashboard). A second normal launch opens the dashboard. Disable it and confirm the entry disappears; uninstall also removes it while keeping the profile.
- Dev/prod identity: install/run prod and dev together and confirm the emerald/amber icons, different window titles, separate tray tooltips, separate `%APPDATA%` profiles and locks. Confirm `win-unpacked/resources/app-update.yml` shows `body-debugger-dev-updater` for dev.
- Persistence: streak, stage and sessions survive a relaunch (`.userdata/data/`).

## Native visual laboratory

Run `npm run dev` and open **«Лаборатория»**. The normal main process pre-warms a headless Electron child with `--body-debugger-lab --body-debugger-lab-headless`; a per-profile instance lock prevents a second sandbox. The child has no tray or dashboard and opens no separate lab window: the lab panel mounts natively via `LaboratoryHost` (nested Pinia + lab bridge). The real dashboard stays open. Leaving the tab pauses the run; reopening reads the retained lab state.

All laboratory stores and Chromium state live under `.userdata/laboratory/` on the project drive when unpackaged and under `%APPDATA%\Body Debugger\laboratory` (or the dev-channel equivalent) when packaged. Normal data stays in the sibling profile. `electron/main/lab-engine.ts` spawns the child and forwards only `lab:bridge-request` calls from the registered dashboard host; `electron/main/lab-headless.ts` dispatches them to the sandbox. Only `LabChanged` (with snapshot) is relayed to the host. The sandbox does not initialize the updater.

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

The permanent transport above the workspace contains scenario, «Автоматически» / «Выбираю сам», «Проиграть сценарий», «Следующий шаг», «Сначала» and pace. The sticky scene contains compact identity/build controls. Five sections group scenarios, popup/cycle, character/effects, data and settings; all user options reuse production components. Character/build and other preferences survive choosing a story and seeking; «Восстановить параметры сценария» restores original settings/build without changing history or cursor. The same identity appears in the live scene, normal dashboard and real popup. The live scene shows captions, earned progress, condition and streak; the compact SVG charts show only resolved observations up to current time, with stage thresholds, change markers and a 14-day activity strip. Frame fallback details remain expandable.

«Просмотр даты» is silent prefix reconstruction: scrub, date, beginning/end and event/day/milestone navigation never replay old interactions. «Проиграть сценарий» runs the shared arcade sequencer: one non-overlapping link at a time (cursor/calendar jump → short scene beat → real popup → semantic driver → durable save → voice-gated reaction → close → next). There is no tempo control and no accelerated exercise wall-clock; the driver unlocks the severity gate, Hardcore still uses a real hold, and unanswered reminders call `missActivePopup` immediately (chronicle has no laboratory clock, so a deadline tick would never fire). The popup queues entry → `active` → result lines (never cutting the previous take), acks `ready`/`start applied` only after each line finishes, then waits for the reaction (`ended` plus a 1 s tail, and never less than `reactionDuration`) before `feedback-complete`; arcade will not open the next event until that ack arrives. Pause/resume and phase stepping cannot force-close a saved result. Close actions are inferred from saved `popup-closed` outcomes.

Interactive playback stops at the choice point and accepts actual popup input. Any user intervention during automatic replay cancels automatic dispatch and labels a manual branch. Only the real save path records that branch; its original future remains available through «Вернуться к исходному». «Продолжить вручную» opens another ordinary popup against the branch. Leaving the laboratory tab pauses automatic work; reopening reads the retained main-owned run. Chronicle play and laboratory play cannot run together; real reminders wait until the active run ends + 30 s.

Seeking reconstructs only the event prefix up to the cursor, normalizes settings and progress, and recomputes earned stage/branch and streak. Future events do not enter the live calendar or statistics. The character, current metrics, explanation, frame candidates and calendar appear together. Checkpoint agreement verifies that the native persistence/projection path matches the domain calculation; it is not an independent oracle for the domain rules.

Scrubbing is silent; native replay permits reactions and optional audio. A separately triggered popup stops automatic playback. Seeking discards an unresolved popup before reconstructing the prefix, so its close callback cannot create a historical skip. A failed result write leaves the same session retryable and shows no success; duplicate deliveries cannot append another result.

### Random calendars and saved runs

Use 7/30/90 days, regular/uneven/frequent-skip activity, low/normal/high load, a direction, an end date and a 32-bit seed. Active days are correlated, weekends have a lower probability, and daily counts vary within a narrow range. Exercises are selected by the existing picker. Repeating the same parameters reproduces the same calendar under the current generator/catalog.

«Сохранить вариант» writes the resolved plan and cursor to `data/laboratory-run.json` in the laboratory profile. «Восстановить» restores that explicit save. JSON export/import uses native dialogs and stores resolved events as well as generator parameters; replay does not regenerate historical picks after generator changes. Format version is 2: each exercise includes a validated semantic action sequence. The save envelope retains both current and original plans, branch state, playback mode and cursor. Version-1 files are converted with `convertedFrom: 1` and explicitly described as inferred actions; their source files are not rewritten on import. Silent viewing keeps their timestamps; replay uses real timeout/hold semantics and may shift later event times forward when a legacy interval is too short. Newly resolved times are saved rather than rerolled. Imports are limited to 2 MB / 2,000 chronological events, exercise IDs from the current built-in/approved catalog, valid session payloads and unique session identities. Dates and day boundaries use the current OS time zone; replay on another time zone can regroup calendar days. Changing domain rules intentionally changes their computed interpretation. Unknown packs, exercises, action sequences and unsupported versions are rejected. A scenario referencing an approved exercise requires that exercise to remain approved in the target laboratory profile; JSON does not implicitly approve or bundle exercise definitions. Production session/settings envelope versions are unchanged. For rollback, revert code/assets and retain a version-1 export if an older build must reopen a laboratory save; older code cannot read version 2. No production data migration or rewrite is required.

«Сбросить только историю» clears sessions/progress while preserving settings/build. «Сбросить историю и настройки» also resets preferences, including the enabled sound default. It preserves the explicit saved run and optional test media/measurements. It never deletes the normal profile.

### Real popup and tray

The «Попап и цикл» section opens the real Electron window and uses the normal reminder/result/persistence path. Presets cover ordinary exercises, one completion before stage-up, Soft/Medium/Hardcore and optional session details. The current timeline position provides starting history. An optional catalog selector opens a specific built-in or approved exercise; an unknown ID is rejected before mutation. Ordinary popup launch preserves settings. Strictness presets only change strictness, details only enables details, and stage-up prepares the required history.

- Click «Начать» in the actual popup, then advance application time by a selected number of seconds; use +1 second around unlock boundaries.
- Advance five minutes to inspect an unanswered popup becoming `missed`, or a snoozed reminder returning.
- Simulate 90 seconds / ten minutes of system idle and returning, or use the real pause switch.
- «Ошибка следующей записи» fails exactly one session write before persistence; retry in the popup must create one result and only then show success.
- Sound previews deliberately bypass the master mute switch. Normal popup playback respects sound settings and pause; the controls do not duplicate result audio. Visual effects respect reduced motion.
- The «Звуки» tab auditions the generated package: pick a character, play one variant, play all variants of an event in sequence, or play a shared effect take. It ignores the master switch and the «Голос персонажа» toggle, changes no setting and writes no history; the «Стоп» button ends a sequence. Coverage: `tests/components/SoundAuditionPanel.test.ts`.
- The generated voice is on by default: open a popup and you should hear the selected character's line on mount, on «Начать» and after the result. One event plays one sound — the line replaces the generated cue, which returns when «Настройки → Звуки → Голос персонажа» is off or the character has no take for that event. Which variant plays rotates per event, so two neighbouring results must not repeat the same take.
- The laboratory replays with the profile's live sound preferences. A legacy laboratory profile can be muted; the transport then shows «Звук выключен» with a one-click «Включить звук». A scenario snapshot never carries a mute, so enabling sound survives seeks, restarts and scenario switches.
- Theme, build and motion/sound changes affect the laboratory child's panel, popup and preview too. The «Ручная проверка» tab has clickable stage cards and condition/branch/build/emotion buttons; it does not edit history. Each contextual reaction can be repeated or held (held by default). Inline popup controls step through preview states; «Открыть предпросмотр у трея» opens an independent 320×360 native surface synchronized with manual choices. Native preview buttons use visual commands and never save workout results. The permanent scene mirrors manual form, condition and face selections and restores computed history state on returning to scenarios. Manual choices survive switching lab sections. Changing a preview stage/condition/emotion/build never changes the profile, scenario cursor or clock. Boundary and UI coverage: `tests/unit/laboratory-preview.test.ts`, `tests/components/AppearancePanel.test.ts`, `tests/components/LaboratoryPreviewView.test.ts`.

### Time and cancellation

[shared/domain/clock.ts](../shared/domain/clock.ts) defaults to real time. Laboratory snapshots carry runtime-only clock metadata; [src/stores/runtime.ts](../src/stores/runtime.ts) applies it before hydrating domain stores. Streak, picker, calendar, statistics, session timestamps, photos, weight and the popup exercise countdown share application time. A historical cursor freezes it. Native replay uses an explicit rate for exercise/scheduling time and freezes it at observable choice/reaction boundaries. Pause also freezes the missed deadline and pending automatic work; resume rearms the remaining deadline. A partial Hardcore hold is cancelled and must start again. Animation delays and Hardcore hold confirmation always use real elapsed time. Windows time is never modified.

Before a seek/reset/preset, main cancels the outstanding result timeout and success-tray reset, clears the active session identity, then closes the discarded popup. Its close callback cannot record a skip. Automatic reminders are held while viewing the historical timeline. Standalone native presets resume scheduling; replay keeps unrelated automatic reminders held. Returning to the timeline cancels that native cycle. Session identity, run generation and command sequence reject stale acknowledgements. Only the active native popup WebContents can acknowledge driver actions, and only the current popup may close/resize itself.

### Native checks still required

Unit/controller/component tests mock Electron surfaces. Verify visually on target Windows configurations: tray animation/menu, real popup completion and retry, Soft/Medium/Hardcore, keyboard hold, details/errors fitting the window, reduced motion, audio, focus, Windows scaling and multiple monitors/taskbar positions. A Windows smoke run inspected the responsive laboratory layout, visible scenario transport, character grouping, local appearance controls and held comic feedback. The native popup exposed its ready text, timer and controls through accessibility, but the Windows helper rejected clicks as being over `ChatGPT.exe` even after activation and retry. Pointer/keyboard completion, exact popup visuals, scaling, multiple monitors and the full tray/audio matrix remain unverified. These observations do not establish full visual regression coverage.

## Dashboard chronicle

The normal profile owns a read-only timeline under «Персонаж → Хроника». It starts at «Сейчас» and scrubs the real `sessions.json` history — no laboratory profile writes. Entries are reconstructed by `shared/domain/chronicle.ts`; form, direction, temporary condition and streak use the same `summarizeSessions` helper as the laboratory. Play uses the same arcade `NativePlayback` engine as the laboratory (preview popups + LabDriver, no persist) behind `playback-coordinator`. Preview popups carry a character overlay from the timeline prefix (not live Pinia progress), reuse the voice layer with a separate rotation namespace, and gate auto-close on the spoken line. Temporary manual controls replace only the scene values and are never saved.

Coverage: `tests/unit/chronicle.test.ts` pins normalization, entries, milestones, date seeking and agreement with `computeCharacterProgress`/`computeCharacterCondition`/`computeStreak`; `tests/components/CharacterChronicle.test.ts` pins the end position, scrubbing, date seek, autoplay stop, calendar prefix, manual override and absence of writes; `tests/components/DashboardView.test.ts` pins chronicle + manual controls under «Персонаж». Manual checks: the end position matches «Сегодня»; a gap shows the streak break; the calendar ends at the cursor; empty history shows the start prompt; the manual preview leaves the real profile unchanged.

## Principles

1. Normal app behavior uses the real clock and existing persistence paths.
2. Test mutations stay in a separate main-owned laboratory profile.
3. Domain logic stays testable without UI; existing character and picker rules remain the source of truth.
4. Native visual inspection complements deterministic tests and does not replace them.

# Roadmap

Post-skeleton milestones. Product detail: [CONCEPT.md](../CONCEPT.md).

| # | Milestone | Notes |
|---|-----------|--------|
| 1 | Persistence | **Done** — JSON in `.userdata/data/` (settings, progress, sessions, weights); main SoT + Pinia hydrate |
| 2 | Trigger loop | **Done** — interval from last completion, idle hold/reset, snooze, pause (tray + dashboard), `missed` timeout |
| 3 | Exercise picker | **Done** — 34-exercise catalog + approved AI additions, zone/group penalties, neglect, Focus, inventory, four modes (`shared/domain/exercise-picker.ts`) |
| 4 | Character progress | **Done** — earned stage/branch plus temporary neglect/recovery from saved results; see [Architecture](ARCHITECTURE.md#temporary-character-condition) |
| 5 | Severity + timer | **Done** — countdown + progress in popup; explicit «Начать»; Soft unlocks after starting, Medium at 80%, Hardcore adds a 1.5 s hold |
| 6 | Sprite cut | **Done** — Desk Hulk body/pose/emotion/neglect frames and runtime fallback; nine additional packs have 432 frames across three builds, available through runtime selection — [Art library](../src/assets/character/README.md) |
| 7 | Micro-animations | **Done** — popup entrance/exit, urgent timer, emotion crossfade + bounce; tray frame animation; «Анимации» switch |
| 8 | Optional layers | **Done** — session details, weight history, photos, inventory UI, AI proposals, themes |
| 9 | Sounds | **Done** — generated effect takes and the character voice play by default on popup/result/stage-up moments, with mute, volume, pause/DND gate and an opt-out for the voice; theme packs, queueing and automatic milestone audio later — [SOUNDS.md](SOUNDS.md) |
| 10 | Tests + native laboratory | **Done** — Vitest suite plus an isolated native profile, six timeline stories, seeded calendars, saved runs, popup/idle/error controls and appearance previews — [TESTING.md](TESTING.md) |
| 11 | Dashboard depth | **Done** — 13-week calendar heatmap with day details, stats cards, seven-day chart, zone distribution, top exercises |
| 12 | Core preferences UI | **Done** — «Настройки» tab: interval (5–240 + presets), picker mode, Focus (primary + accents), character build; normalized on load, interval changes reschedule the loop |
| 13 | Character selection + synchronized native scenario playback | **Implemented; native acceptance pending** — character picker, semantic native phases, automatic/interactive modes, preserved branches and compact dynamics; remaining Windows checks below |

Prototype milestones 1–12 are implemented; they do not mean that every long-term idea in the concept is shipped. Milestone 13 is implemented and awaiting the remaining native acceptance checks. The current dashboard includes the tray settings deep link, a character-led «Сегодня» screen, next-form progress and durable result feedback.

Remaining product gaps, not scheduled: six distinct body illustrations for the default Desk Hulk (currently three tiers), custom pack import, personal exercise-level progression and difficulty weighting, automatic AI analysis (currently manual import), external-event triggers, automatic streak audio/tray milestones, theme sound packs, user-data export and Playwright E2E. Runtime selection/resolution of the nine supplied character packs is implemented in milestone 13.

## Milestone 13: character selection and synchronized native playback

**Status: implementation complete; native acceptance incomplete.** Delivery steps 1–5 are implemented. Step 6 has automated coverage and a Windows automatic-playback smoke run; actual manual pointer/keyboard completion, the full tray/audio matrix, scaling and multiple-monitor checks remain open. See [TESTING.md](TESTING.md) for the observed Windows automation limitation. The requirements below remain the acceptance checklist.

### User outcome

The user selects a character and a typical or generated history, presses **«Проиграть сценарий»**, and watches a period of the character's life unfold. The real tray popup opens, the exercise starts, a visible action is chosen, the character reacts, and the saved outcome changes the open laboratory/dashboard at the same time. Compact charts show how accumulated activity, temporary condition and streak develop over that period.

Two modes must support both observation and hands-on testing:

- **«Автоматически»**: the scenario visibly performs its planned actions, including starting the exercise and choosing the result. The viewer can pause or step through each phase.
- **«Выбираю сам»**: the real popup waits for the user's action. The outcome goes through the normal save path, and the resulting history can continue as a reproducible manual branch.

This is a native event replay feature. Existing character rules, severity gates, result validation, durable acknowledgements and optional-layer behavior remain authoritative.

### Original starting point (before milestone 13)

The original laboratory baseline was commit `16ac755` (`feat(debug): add isolated native visual laboratory`). Read the current files before editing; later commits may extend this baseline.

- `npm run dev:lab` opens an isolated `.userdata/laboratory/` profile with separate controls and a normal dashboard.
- Six histories, seeded 7/30/90-day calendars, main-owned cursor/playback, prefix reconstruction, checkpoint explanations and saved/exported resolved events already exist.
- The existing **«▶ Играть»** button appears after selecting a history. It advances stored history snapshots; it does not replay the full popup interaction for each result.
- Real popup presets are currently a separate tab. Opening one interrupts history playback; the user can manually test its result, idle handling and a failed write.
- The appearance tab changes local stage/branch/build/emotion/condition previews. It does not select another character identity.
- [packs.json](../src/assets/character/packs.json) declares nine additional characters with 432 prepared frames. The current runtime resolver still bundles Desk Hulk only; character identity is not wired through every portrait.
- Calendar/statistics already reflect the current prefix. The next step needs a persistent live progress view and compact time-series charts rather than requiring separate inspection of these sections.

Current behavior and verification limits: [TESTING.md](TESTING.md). Supplied artwork and frame contract: [character art library](../src/assets/character/README.md).

### A. Make character choice real and discoverable

1. Add a visible **«Персонаж»** picker with thumbnails and names to the laboratory's main controls and the normal character preferences. Keep **«Телосложение»** as a separate choice.
2. Offer Desk Hulk and all nine supplied packs: Альтуха, Нефор, Зумер, Милфа, Метро, Стритвир, Инстадива, Инженер, Хипстер. Reuse manifest IDs and labels; do not maintain a second independent cast list.
3. Persist the selected pack in the existing `characterPackId` setting. Laboratory selection stays inside its isolated profile; normal preferences stay in the normal profile. Selecting a history or seeking must preserve the chosen identity/build and viewing preferences.
4. Pass the active pack through body and face rendering in the normal dashboard, native popup, laboratory live scene and appearance gallery. A selected identity must remain consistent across windows and reactions.
5. Resolve each additional pack's six distinct stage frames, three condition levels, available branch poses and emotion portraits for all three builds. Preserve Desk Hulk's current three-body/six-stage mapping as its own art capability; do not apply that limitation to packs with six separate bodies.
6. Define explicit fallback behavior: try the requested frame/build in the selected pack, then its average build, then a neutral frame from that identity, finally the existing emoji fallback. Unknown/removed pack IDs normalize to the default. Report missing-frame fallback in laboratory diagnostics so an identity does not silently change to another character.
7. Reuse the existing assets and components. New artwork, custom pack import and a new character progression model are outside this milestone.

### B. Put playback controls and live feedback together

- Keep the character picker, selected scenario, mode, **«Проиграть сценарий»**, **«Пауза»**, **«Следующий шаг»**, **«Сначала»**, speed and virtual date visible in a stable control area. The primary play action must be discoverable before scrolling into detailed history.
- Keep the live character, current emotion/caption, stage, branch, completions, condition and streak visible beside or directly below playback controls. Technical frame candidates belong in expandable diagnostics.
- Show the current phase in plain Russian: for example, **«Появилось напоминание» → «Начал упражнение» → «Выбрал: Готово» → «Результат сохранён» → «Новая форма»**.
- Show the native popup as a separate real Electron window while the laboratory and optional normal dashboard remain observable. A miniature popup summary may explain the current phase, but cannot substitute for the native window.
- Keep calendar, checkpoint navigation and detailed event log available without displacing the live scene. Check the layout at the existing minimum window width and normal Windows scaling.
- Clearly distinguish **«Просмотр даты»** (silent prefix reconstruction) from **«Проиграть события»** (visible interactions and reactions). Backward seeking must not emit a burst of historical sounds or popups.

### C. Replay each exercise as a sequence of native phases

Extend the main-owned controller with explicit playback phases. A representative completed exercise is:

| Phase | Visible behavior | Required synchronization |
|-------|------------------|--------------------------|
| Move to event time | Virtual date/time advances; an empty gap is skipped quickly | Only past events contribute to charts, calendar and streak |
| Open reminder | One real popup appears with the planned exercise and selected character | Main owns session identity; wait for renderer readiness |
| Start exercise | «Начать» is visibly activated; focused emotion and countdown appear | Use the normal start/timer action |
| Exercise in progress | Timer/progress advances at the selected simulation pace | Preserve Soft/Medium/Hardcore rules and boundary visibility |
| Choose outcome | The planned button/action is visibly highlighted and performed, or the user chooses | Dispatch through shared popup actions, not a separate fake result writer |
| Save outcome | Pending state is visible; failures offer retry | Await the main-process durable acknowledgement |
| Show reaction | Caption, emotion, success/quiet exit and tray state are visible | No success reaction before a successful write |
| Update progress | Laboratory and open dashboard reflect the saved result and chart cursor | Publish one coherent state revision for the outcome |
| Continue | Reaction remains readable, popup finishes closing, then the next event starts | Never overlap sessions or discard the current reaction immediately |

Cover `done`, `skipped`, `snoozed`, popup close and `missed`. A timeout must visibly follow the unanswered-popup path. An automatic snooze needs a clear repeat-reminder phase; showing a saved `snoozed` row alone is insufficient.

Prefer a lab-only semantic action driver using the existing renderer actions and IPC path. Do not implement this by clicking screen coordinates, evaluating arbitrary renderer code, or appending the final stored result directly. Keep the driver disabled outside the isolated laboratory process.

The existing loop treats all popup openings/results as manual interruptions. Distinguish controller-owned playback actions from real user interventions so an automatic scenario does not stop itself. Correlate each phase acknowledgement with the run generation and active session ID; stale replies after reset/seek must be rejected.

### D. Define automatic and interactive behavior

- Automatic mode executes the planned action and makes the chosen control visible before activation. It must also visibly perform the initial start and the normal Hardcore hold confirmation when applicable.
- Interactive mode pauses at the choice point and accepts actual pointer/keyboard input in the popup. It must not also execute the preplanned result afterward.
- Manual intervention during automatic playback transfers control predictably: stop automatic action dispatch, label the intervention, record one result and offer to continue the manual branch or return to the original scenario.
- Preserve the original resolved scenario separately from its manual branch. Returning to the original should not require reconstructing a lost future from memory.
- Retrying a failed result save must keep the same session identity. Test a duplicate/late result, closing during save, and retry after the one-shot injected write failure.
- Keep standalone popup presets for targeted checks, but provide the full synchronized replay from the primary history view.

### E. Treat application time and presentation time separately

- Keep one virtual application clock across main and all renderers. History dates, exercise duration, reminder deadlines, streak, calendar and chart cursor must agree.
- Skip long inactive gaps automatically. Scale exercise/scheduling time independently from the real-time minimum needed to read captions, observe a button choice and see a reaction.
- Provide a small set of useful speed presets. Fast mode must still expose the important phases and outcomes; do not turn the entire history into unreadable flashes.
- Pause must stop scenario advancement, pending automatic actions, virtual exercise time and the missed-result deadline. Rearm remaining deadlines on resume. UI entrance/exit transitions may finish normally; cancel an incomplete confirmation hold instead of letting it submit during pause.
- A phase step advances one observable action. Retain event/day/milestone navigation for coarse movement. Seeking cancels playback work and reconstructs the selected prefix silently.
- Reset, new scenario, seek, mode change and window closure need explicit cancellation behavior. No leftover timeout, scheduled click, delayed success blink or old acknowledgement may affect the next run.
- Do not change Windows time or accelerate production behavior when laboratory mode is off.

### F. Add compact progress dynamics

Keep these visible while replaying rather than hiding them under the full statistics section:

1. A compact accumulated-completions/progression chart with stage thresholds and the current virtual cursor.
2. A compact temporary-condition chart (0–10) showing deterioration and recovery, separate from earned stage.
3. Current streak and a small daily activity strip/calendar, with markers for streak breaks, new stages and branch changes.

All series must derive from the same resolved events and current prefix as the live character. Seeking moves every cursor consistently; future observations cannot enter current totals. Use restrained colors and clear labels, including an empty-state display. Reuse the existing chart/heatmap patterns or native SVG; adding a chart dependency requires separate approval.

### G. Extend scenarios and saved runs without losing reproducibility

- Reuse the six current stories and the seeded generator. Add action/phase plans sufficient to show how each stored outcome happened: reminder, start, choice or timeout, repeat after snooze.
- Preserve the generated exercise choice, seed, date range, settings, selected character/build and resolved action plan in a saved run. Replaying a save must not reroll exercises or action choices.
- Define the compatibility path for format-version-1 snapshot plans before changing their schema: explicitly convert supported saved histories to action plans, or retain a clearly labelled snapshot-view mode. Never silently reinterpret old data as a full recorded interaction.
- Document format/version changes and any migration/rollback needed for saved laboratory runs. Do not modify the production history schema merely to store playback presentation phases.
- Make unknown exercises/packs, malformed action sequences, oversized imports and unsupported versions fail with an understandable message. Keep current input validation and laboratory isolation.

### Delivery order

| Step | Bounded deliverable | Exit check |
|------|---------------------|------------|
| 1 | Pack-aware resolver and visible character picker | Each supplied identity renders consistently in the laboratory, dashboard and popup; six-frame packs use all six stages |
| 2 | Discoverable controls and phase/action contract | The main view has an obvious play button and can explain its current/next phase; version-1 compatibility is defined |
| 3 | One complete automatic native cycle | One exercise visibly opens, starts, completes, saves, reacts and updates the open laboratory/dashboard before continuing |
| 4 | Full outcomes, pause/step and interactive branching | Skip, snooze/repeat, close, timeout, manual intervention and write-failure retry are observable and idempotent |
| 5 | Multi-day replay and compact dynamics | Existing stories and random calendars run through native phases; charts and character stay synchronized across gaps and seeks |
| 6 | Verification, documentation and one fresh running instance | Automated checks pass, the Windows smoke checklist is completed, docs describe actual behavior and a fresh laboratory is launched for review |

### Acceptance and verification

- From a fresh laboratory window, a user can find the character picker, select a history and start playback without inspecting developer-only diagnostics or searching another tab.
- Demonstrate at least one complete automatic cycle and one interactive cycle with the real popup, visible action, reaction and simultaneous updates in the open dashboard/laboratory.
- Replay «Форма → спад → восстановление»: earned stage stays intact, condition reaches all three neglect levels, then recovers through five completions. Charts and portraits agree at every checkpoint.
- Replay a gap and a direction change: streak expiry, unchanged earned progress during absence, and the real branch-window rule remain intact.
- Test every pack/build and supported body/face state, unknown IDs, missing-frame/image-load fallback and persisted selection. Verify that additional packs retain six distinct stage bodies.
- Test phase ordering/readiness, paused deadlines, real-time hold behavior, cancellation mid-phase, stale acknowledgements, simultaneous commands, double submission, retry and exact replay from a saved seed/action plan.
- Verify that normal-profile files are unchanged and no laboratory action driver can run in a packaged/normal process.
- Run affected tests, then `npm test`, `npm run typecheck`, `npm run build`, `git diff --check` and the project-context link checker after documentation changes. Use the existing Vitest framework and current installed dependencies.
- Perform native Windows smoke checks for actual tray changes, Soft/Medium/Hardcore pointer/keyboard interaction, readable reaction timing, details/errors fitting the popup, reduced motion, scaling and multiple monitors. Record what remains unverified; mocked Electron tests alone do not establish native visual correctness.

### Implementation entry points

Read [AGENTS.md](../AGENTS.md), [CONTEXT.md](CONTEXT.md), [TESTING.md](TESTING.md), the current diff and the art manifest first. Inspect the implemented phase controller and finish the remaining native acceptance checks; do not rebuild the existing laboratory.

| Concern | Starting files |
|---------|----------------|
| Scenario data, cursor and commands | [shared/domain/laboratory.ts](../shared/domain/laboratory.ts), [electron/main/laboratory.ts](../electron/main/laboratory.ts) |
| Native phase controller and semantic action contract | [electron/main/laboratory-playback.ts](../electron/main/laboratory-playback.ts), [shared/domain/laboratory-playback.ts](../shared/domain/laboratory-playback.ts) |
| Loop, active popup and result acknowledgement | [electron/main/trigger-loop.ts](../electron/main/trigger-loop.ts), [electron/main/ipc/session-cycle.ts](../electron/main/ipc/session-cycle.ts) |
| Popup start/timer/hold/result actions | [src/views/PopupView.vue](../src/views/PopupView.vue) |
| Laboratory live view and appearance gallery | [src/debug/LaboratoryPanel.vue](../src/debug/LaboratoryPanel.vue), [src/debug/AppearancePanel.vue](../src/debug/AppearancePanel.vue) |
| Normal dashboard reactions | [src/views/DashboardView.vue](../src/views/DashboardView.vue) |
| Pack manifest, resolver and portrait | [packs.json](../src/assets/character/packs.json), [src/components/character/frames.ts](../src/components/character/frames.ts), [CharacterPortrait.vue](../src/components/character/CharacterPortrait.vue) |
| Character state and frame rules | [src/stores/character.ts](../src/stores/character.ts), [shared/domain/character-visual.ts](../shared/domain/character-visual.ts) |
| Clock and cross-window projections | [shared/domain/clock.ts](../shared/domain/clock.ts), [src/stores/runtime.ts](../src/stores/runtime.ts), [src/bootstrap/hydrate.ts](../src/bootstrap/hydrate.ts) |
| Existing replay tests | [laboratory-controller.test.ts](../tests/unit/laboratory-controller.test.ts), [laboratory-scenarios.test.ts](../tests/unit/laboratory-scenarios.test.ts), [LaboratoryPanel.test.ts](../tests/components/LaboratoryPanel.test.ts) |

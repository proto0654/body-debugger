# Catalog UI — library, explainer, playground, preferences

Status: **implemented** (phases 4a–8b). Companion to [CATALOG-V2.md](CATALOG-V2.md). Every function and field referenced here is defined there unless listed in §9. This file describes the dashboard side only.

Goal: choose an exercise, understand the movement, start a break, and review its effect without opening diagnostic tools. Demonstrations use existing text instructions; illustrations and video are future work.

## 0. Principles

1. Put the action and instruction before algorithm details.
2. Use shared picker hard filters and dose rules in both manual and automatic paths.
3. Keep previews read-only: no session writes, queue consumption or earned-character changes.
4. Reveal probabilities, coefficients and raw payloads only on request.
5. Preserve keyboard navigation, visible focus and list context on return.
6. Optional AI and diaries must not block the core cycle.

## 1. Navigation

Primary sections: «Сегодня», «Упражнения», «Персонаж», «Прогресс». Settings are a separate utility entry. Navigation uses `#/dashboard?tab=...&section=...`, with optional `exercise` and AI `task` parameters; browser Back restores the selected location. Legacy calendar/stats and laboratory/playground links remain supported.

| Exercise subsection | Purpose |
|---|---|
| **Каталог** | Search, basic zone/availability filters, text instruction and explicit exercise start |
| **Подбор под меня** | Mode, priorities, temporary accents, dose hints, equipment and physical limitations |
| **Наборы** | Existing set management and dose-hint approval/revert |
| **Следующие перерывы** | Keyboard-accessible queue editing |
| **ИИ-помощник** | Task → request preview → proposals → reviewed application |

JSON import and manual editing are catalog actions. Settings → developer tools retains the native laboratory, picker sandbox and coverage matrix. Their data/profile isolation remains unchanged.

## 2. Library and exercise preview

At 960px window width the list and selected exercise appear side by side. Below 880px the selected exercise replaces the list; returning retains search, filters and list scroll. The library includes archived, disabled and shadowed entries for inspection, while the default view contains only active available entries. Hard filters are enforced again in main before launch.

Rows show title, calculated duration, direction and equipment. The preview contains the existing instruction, duration, posture, conditions, start and pin actions. History, selection explanations and technical parameters are disclosure sections. Archived/unavailable entries explain why launch is disabled.

## 3. Main-owned preview and launch

`previewNextExercise` computes the normal picker result without side effects and returns an ephemeral token, or null when there is no eligible recommendation. The token is invalidated by relevant state changes and the next minute. Previewing does not reserve the future automatic pick.

`startExercise` distinguishes recommendation and catalog sources. A recommendation must match its current token; stale requests require review and another click. Only its successful popup creation consumes the corresponding queue slot. An explicit catalog start leaves the queue untouched, resolves the exercise in main and calculates the current dose. Existing popups are focused; playback/grace blocks new launches; manual starts remain available while paused.

V2 metadata (timer, intensity, zones, conditions and physical limitations) survives the legacy popup adapter. A failed queue write or popup creation does not consume the queued exercise. The existing tray/openPopup path remains available.

## 4. AI assistant

Connection configuration belongs to settings. The assistant supports generating selected zone/method variants or thin coverage cells, editing a user set, and analysing progress. Retagging is an additional tool. Only progress analysis requires the existing aggregate-sharing opt-in; weight, photos and physical limitations are not added to requests.

Before sending, users inspect the task, target set and actual payload. If it changes before dispatch, the assistant refreshes the preview and requires another confirmation. Pinia retains pending requests, instructions and drafts across navigation; stored drafts can be reopened after restart.

Main computes proposal titles, actions and field comparisons from the actual apply input. A review token covers operations, catalog, profile shifts, overrides and model; applying stale comparisons requires re-review. Rejected operations cannot be selected; an empty selection cannot be applied. Historical entries without saved before-values show the stored operations without fabricated comparisons. Existing discard/revert semantics remain in place.

## 5. Character fitting and progress

Appearance drafts live in Pinia and do not write until Apply. Pack and build use the existing independent persistence operations; partial failure retains the remaining draft and shows saved values. Cancel restores the saved appearance. Earned form/branch and temporary condition are distinct from cosmetic choices. Voice preview lives with the character; global audio remains in settings. The chronicle is read-only, with manual state controls confined to the laboratory.

Progress keeps the calendar/statistics and enabled diaries. Disabled weight/photo diaries have compact opt-in actions. The contextual AI entry opens the same assistant with the tune task.

## 6. Pure helpers (`shared/domain/catalog-sandbox.ts`, `queue.ts`)

| Function | Returns |
|---|---|
| `poolSnapshot(input)` | candidates + eligible count, effective size, top mass |
| `effectiveSize(probs)` | `1 / Σ p²` |
| `comboMatrix(input)` | 20 cells: top-3, mass, effective size |
| `simulate(input, n, seed)` | zone/method shares, uniqueness, streaks, histogram |
| `simulateWeek(input, days, perDay, seed)` | day strips + heatmap |
| `previewDelta(before, after)` | gained / lost / moved rows |
| `applyQueue(input, queue)` | restricted pool + skip notes |

## 7. Edge states

Pool too small (effective size &lt; 8) → warning + generate / import. Sandbox unsaved changes kept until reload (no leave prompt). Archived pin → недоступно. Empty history → neutral chance/history. Large catalogs → virtualise when needed.

## 8. Phases (extends CATALOG-V2 §12)

| # | Phase | Acceptance |
|---|---|---|
| 4a | `field-docs`, «Как это работает», read-only «Каталог» | instruction/action first; technical explanation uses `explainPick` |
| 4b | Playground + Пул + `poolSnapshot` / baseline A | level change re-ranks; Apply writes after diff |
| 4c | Combo matrix | dead cells marked; click loads combination |
| 7a | Simulation + Week | same seed → identical; λ moves shares toward targets |
| 7b | Preference board + user `profile_shift` | Today expires at midnight; delta matches picker |
| 8a | Next-breaks queue | pin shown once at next trigger; invalid pins skipped |
| 8b | Manual `edit` changeset + consequence panel | undo works; shipped forks |

## 9. Deltas against CATALOG-V2

1. `ProfileShift.changesetId` optional; add `source: 'llm' | 'user'`. Preference board writes user shifts without a changeset.
2. Pick path and explain path share `applyQueue` (or equivalent constraint) so they stay identical.
3. Durable `queue.json` under `.userdata/data/` (envelope `{ version, data }`, atomic writes).
4. `FieldDoc` registry + `catalog-tuning.ts` are the sources for explanatory text and constants.

## 10. Locked decisions

1. Pin = once (repeat toggle later).
2. Sandbox shares scaffolding ideas with Laboratory; separate controls / Pinia `sandbox` store until both settle.
3. Preference-board «Что изменится» computes **on drop**, not during drag.

## Related

- Domain SoT: [CATALOG-V2.md](CATALOG-V2.md)
- Components: `src/components/catalog/`
- Constants: `shared/constants/field-docs.ts`, `catalog-tuning.ts`

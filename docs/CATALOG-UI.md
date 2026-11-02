# Catalog UI — library, explainer, playground, preferences

Status: **implemented** (phases 4a–8b). Companion to [CATALOG-V2.md](CATALOG-V2.md). Every function and field referenced here is defined there unless listed in §9. This file describes the dashboard side only.

Goal: a person can click through every exercise in the pool, see each number with an explanation, try combinations without touching real settings, and arrange upcoming breaks by dragging.

## 0. Principles

1. **Every number explains itself.** Values show unit + `?` popover from `shared/constants/field-docs.ts`.
2. **Effects in words and multipliers** (e.g. `×0.2 — вы только что делали верх`).
3. **Read-only by default.** Playground writes real settings only on «Применить».
4. **No duplicated logic.** UI calls pure `shared/domain/` functions (`pickExercise`, `explainPick`, `dose`, `coverageMatrix`, `targetVsActual`, plus sandbox helpers below).
5. **Keyboard path for every drag.**
6. **Color carries meaning, never alone** (boost / penalty / filtered + sign or icon).

## 1. Tab structure

«Упражнения» subtabs:

| Subtab | Purpose |
|---|---|
| **Каталог** | browse and inspect every exercise |
| **Песочница** | try settings, pool, simulate, plan next breaks (replaces «Выбор») |
| **Покрытие** | Zone × Method matrix + target vs actual |
| **Наборы** | sets, hints, revert |
| **AI** | provider, changesets, progress advisor |

## 2–5. Surfaces

See implementation under `src/components/catalog/`: library (filter / list / drawer), number explainer + «Как это работает», sandbox (controls + Пул / матрица / симуляция / неделя / что если), preference board, next-breaks queue strip.

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
| 4a | `field-docs`, «Как это работает», read-only «Каталог» | every drawer number has a popover; probs match `explainPick` |
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

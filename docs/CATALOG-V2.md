# Catalog V2 — exercise model, picker v2, dose, LLM layer

Status: **implemented** (runtime summary in [ARCHITECTURE.md](ARCHITECTURE.md#catalog-v2); this file remains the detailed design and acceptance reference). Product rules stay in [CONCEPT.md](../CONCEPT.md). Types live in `shared/types/exercise-v2.ts`; the v1 `Exercise` shape remains for popup/stats compatibility via `toExerciseV1`.

## 0. Goals and non-goals

Goals

1. Remove the duplication between "Основное" and "Акценты" by separating two orthogonal axes: **Zone** (where) and **Method** (how).
2. Describe each exercise as a vector over zones, so penalties and bonuses are proportional instead of binary.
3. Store timer limits per exercise and scale the dose by the reminder interval.
4. Let an optional LLM (OpenAI-compatible API, e.g. DeepSeek) **propose** catalog changes: new pools, edits, archives. Nothing is written without explicit approval, and every applied change is revertible.
5. A dashboard tab that explains how the pool is formed and why an exercise was picked.

Non-goals

- LLM in the runtime loop. The picker, dose and timer stay deterministic and offline.
- Sending sessions, weight, photos or health limitations to any provider.
- Medical advice. Generated exercises are suggestions with conservative limits.

Invariants (from ARCHITECTURE.md, restated because this work touches all of them)

- One popup = one exercise.
- Core does not depend on the LLM layer; every failure of the layer leaves the core untouched.
- Main owns durable state, keys and network. Pinia is a projection.
- Exercise ids are permanent. Shipped ids are never overwritten.
- External payloads are validated; invalid values are rejected, not clamped (one documented exception: zone-sum normalization within ±0.05).

## 1. Axes

Equipment is a **filter**, not an axis.

| Zone id | Label | Covers |
|---|---|---|
| `upper` | Верх | neck, shoulders, upper back, arms, wrists |
| `core` | Кор и пояс | lower back, abs, obliques, "around the waist" |
| `lower` | Низ | hips, glutes, legs |
| `full` | Комплекс | whole-body |

| Method id | Label |
|---|---|
| `mobility` | Растяжки и йога |
| `strength` | Силовая |
| `cardio` | Лёгкая атлетика |
| `striking` | Ударка |
| `balance` | Баланс |

Why four zones: this is the usual split in physical training (upper body / core / lower body / full body). Core is separate on purpose: for desk work the lower back and abdomen are the main complaint, and `full` stays for genuinely whole-body movements. The old «Пояса и части тела» is no longer a direction: the shoulder girdle belongs to `upper`, the pelvic girdle to `lower` (and `core`).

"По кругу" is **not** a zone. It is the rotation picker mode, see §4.5.

### 1.1 Mapping from the current Focus directions

| Old `FocusDirection` | New |
|---|---|
| `mobility` | method `mobility` |
| `light_athletics` | method `cardio` |
| `strength` | method `strength` |
| `striking` | method `striking` |
| `balance` | method `balance` |
| `body_belts` | zones `upper` and `lower` at the same level (shoulder and pelvic girdle) |

Old `focus.primary` migrates to level `++`, each old accent to level `+`.

### 1.2 Character branch

`character-progress.ts` currently scores the primary direction per done session. New per-session rule, evaluated on the exercise's dominant zone and method, first match wins:

1. dominant zone `upper` → `posture`
2. dominant zone `core` and method `mobility` → `posture` (trunk and lower-back mobility, which the old rules also counted as posture)
3. method `strength` or `striking` → `power`
4. method `mobility` or `balance` → `mobility`
5. otherwise (`cardio`, ...) → no point

Abs and plank-style `core` strength therefore count as `power`, not `posture`. No extra field is needed.

## 2. Exercise model

```ts
type Zone = 'upper' | 'core' | 'lower' | 'full'
type Method = 'mobility' | 'strength' | 'cardio' | 'striking' | 'balance'
type Limitation = 'neck' | 'shoulder' | 'wrist' | 'lower_back' | 'knee' | 'ankle'

interface ExerciseV2 {
  id: string
  title: string                      // <= 40 chars
  description: string                // <= 220 chars, imperative, one technique cue
  method: Method
  zones: Partial<Record<Zone, number>> // load shares, sum = 1.0
  intensity: 1 | 2 | 3 | 4 | 5       // load on the body (new)
  difficulty: 1 | 2 | 3 | 4 | 5      // technique complexity (existing)
  timer: { minSec: number; defaultSec: number; maxSec: number; perSide?: boolean }
  reps?: { min: number; max: number }
  equipment?: string[]               // ids from shared/constants/equipment.ts
  context: { posture: 'seated' | 'standing' | 'floor'; quiet: boolean; noSweat: boolean }
  avoidIf?: Limitation[]
  modificationOf?: string
  emojiFallback: string
  imageKey?: string
  status: 'active' | 'archived'
  source: { kind: 'shipped' | 'user' | 'llm'; batchId?: string; model?: string; createdAt?: string }
}
```

Derived (kept for backward compatibility with existing code and stats):

- `dominantZone` = zone with the largest share (ties: fixed order `upper, core, lower, full`).
- `group` = from `dominantZone`.
- `category` = existing field; for new exercises `${method}:${dominantZone}`.
- `durationSec` = `timer.defaultSec`.

### 2.1 Upgrade of v1 exercises

`upgradeExercise(v1): ExerciseV2` gives working defaults so the app runs before any manual tagging:

```
zones     ← from group: upper→{upper:1}, lower→{lower:1}, full→{full:1}, equipment→ by category table
method    ← from category (lookup table, unknown → 'mobility')
timer     ← { minSec: round5(0.7·d), defaultSec: d, maxSec: round5(1.5·d) }  (d = durationSec)
intensity ← difficulty
context   ← { posture: 'standing', quiet: true, noSweat: true }  (reviewed by hand for the 34 shipped)
status    ← 'active'
source    ← { kind: 'shipped' }
```

The 34 shipped exercises are hand-retagged in `shared/constants/exercise-v2-tags.ts` and merged into `EXERCISE_CATALOG`; `upgradeExercise` prefers those explicit fields over §2.1 defaults.

## 3. Catalog layers and persistence

```
shipped (immutable)  <  catalog.json (user / llm)  <  overrides (disabled ids, per-user timer tweaks)
```

`shared/domain/catalog.ts` → `resolveCatalog(shipped, user, overrides): ExerciseV2[]` is the only function the picker reads.

Rules

- Shipped exercises cannot be edited. Editing = **fork**: a user-layer copy with `modificationOf = <shipped id>` that shadows the original in the resolved catalog.
- Delete = `status: 'archived'`. Records are never removed, because old sessions reference ids (stats would otherwise fall back to raw ids).
- Ids of new exercises are generated by the app (`llm-<batchId>-<slug>`); the LLM never chooses ids.
- A shipped id always wins over a user id (unchanged invariant).

Files under `.userdata/data/`

| File | Payload |
|---|---|
| `catalog.json` | `{ version: 2, exercises: ExerciseV2[], batches: Batch[] }` |
| `changesets.json` | last ~30 changesets with ops, inverse ops, status, token usage |
| `settings.json` | new fields: `llm`, `focus` (v2), `profileStrength`, `limitations`, `overrides` |

`Batch` is the unit the UI calls a **набор** (set): `{ id, name, kind: 'legacy-import'|'llm'|'user', createdAt, model?, enabled, count }`. One user set, «Мои упражнения» (`user-main`), always exists and is the default target for forks and accepted changes; the user can create more sets and rename them.

Migration: `custom-exercises.json` is converted once into `catalog.json` as batch `legacy-import`, upgraded through `upgradeExercise`. Writes stay temp-file + rename; the envelope stays `{ version, data }`. Settings are merged with defaults by `normalizeSettings`.

Settings additions

```ts
interface FocusV2 {
  zones:   Record<Zone,   -1 | 0 | 1 | 2>   // − / 0 / + / ++
  methods: Record<Method, -1 | 0 | 1 | 2>
}
interface LlmSettings {
  enabled: boolean; baseUrl: string; model: string   // no key here
  shareProgress: boolean                             // opt-in for the progress advisor (§9.2), default false
}
// settings.autoTune: 'off' | 'suggest' | 'auto'      (default 'suggest', §9.1)
// settings.profileShifts: { axis: 'zone'|'method'; key: string; level: -1|1|2; until: string; changesetId: string }[]
// settings.profileStrength: number 0..1  (λ), default 0.7
// settings.limitations: Limitation[]   (local filter only, never sent anywhere)
```

## 4. Picker v2

File: `shared/domain/picker.ts` (replaces `exercise-picker.ts`; keep the old export as a thin adapter during migration).

### 4.1 Hard filters (weight = 0)

- equipment missing (`inventory.enabled` and owned ids, as today)
- `context` does not match the user's context settings (quiet / noSweat)
- `avoidIf ∩ settings.limitations ≠ ∅`
- `intensity > intensityCap(intervalMinutes)` (see §5)
- `status !== 'active'` or batch disabled

### 4.2 Multipliers

```
w = prevSession · doneToday · methodRepeat · neglect · profile · mode
```

| Factor | Definition |
|---|---|
| `overlap(a, b)` | `Σ_z min(a_z, b_z)` over zone vectors, in [0, 1] |
| `prevSession` | `1 − 0.8·overlap(zones, zonesOfLastDone)` (full overlap = the old ×0.2) |
| `doneToday` | `1 − 0.55·overlap(zones, loadToday)`, where `loadToday` is the clipped sum of zone vectors of today's done sessions (full overlap = the old ×0.45) |
| `methodRepeat` | ×0.75 if the method equals the last done method |
| `neglect` | `Σ_z zones_z · neglectZone[z]`, `neglectZone ∈ [1, 1.8]` by days since the zone was last done (caps at 7 days, as today) |
| `profile` | `1 + λ·(boost − 1)` with λ = `profileStrength` (default 0.7); `focus` mode uses λ×1.5, effective λ is clamped to ≤ 1.5 |
| `mode` | `balance`: none. `rotation`: zone cycle, see §4.5. `focus`: λ×1.5. `push`: ×3 for the most neglected zone |

Skipped / snoozed / missed sessions never count as training (unchanged).

### 4.3 Profile boost

Level multipliers: `−`=0.6, `0`=1.0, `+`=1.25, `++`=1.6 (the last two are today's accent and primary values).

**Step 1 (multipliers).**
`boost = zoneBoost · methodBoost`, `zoneBoost = Σ_z zones_z · levelMul[z]`, `methodBoost = levelMul[method]`.

**Step 2 (shares, replaces step 1, never stacked with it).**
`target_k ∝ levelMul[k]`, normalized per axis. Actual shares come from the last 14 days of done sessions. `boost_k = clamp((target_k / max(actual_k, ε))^0.5, 0.7, 1.8)` and the exercise boost is the zone-weighted product as above. This generalizes the existing days-based neglect to shares and makes "target 45%, actual 38%" explainable on the dashboard.

Do not enable step 2 while step 1 is active, otherwise a priority is counted twice.

### 4.4 Determinism and explanation

Selection uses a seeded RNG so a pick can be replayed.

```ts
interface PickExplanation {
  chosenId: string
  seed: number
  candidates: {
    id: string; weight: number; probability: number
    filteredBy?: 'inventory' | 'intensityCap' | 'avoidIf' | 'context' | 'archived'
    factors: { key: 'prev'|'today'|'method'|'neglect'|'profile'|'mode'; mult: number; note: string }[]
  }[]
}
export function pickExercise(input: PickInput, seed: number): ExerciseV2
export function explainPick(input: PickInput, seed: number): PickExplanation
```

Invariant: `explainPick(input, seed).chosenId === pickExercise(input, seed).id`.

Sessions store only a compact `pickTrace` (seed + factors of the chosen exercise) for the last N sessions, to keep `sessions.json` small. No schema version bump; the field is optional.

### 4.5 Rotation as a zone cycle ("по кругу")

`rotation` cycles zones `upper → lower → core → full → upper …`. The next zone is fixed by the cycle; the exercise inside the zone is picked by the usual weights.

- Cycle position is derived from history (the dominant zone of the last done session), so it survives restarts and needs no extra state.
- Levels change slot counts: `++` gives the zone two slots per cycle, `0` and `+` one slot, `−` one slot every second cycle.
- A zone with no eligible exercise after the hard filters is skipped.
- `balance` stays the soft variant: no fixed cycle, only the penalties from §4.2.
- The method is not cycled; `methodRepeat` still applies.
- The dashboard shows "следующая зона: низ".

## 5. Dose

File: `shared/domain/dose.ts`.

```
intensityCap(interval):  <= 20 min → 2 · 21–59 → 3 · >= 60 → 5
dose = clamp(timer.minSec, timer.maxSec, round5(timer.defaultSec · (interval / 45)^0.35))
```

| Interval | Multiplier |
|---|---|
| 15 min | ×0.68 |
| 45 min | ×1.00 |
| 90 min | ×1.27 |

Reps scale the same way inside `reps.min..max`.

Rationale: short intervals mean many reminders per hour, so each one is a micro-dose of low intensity; long intervals allow more volume and intensity per break.

Rules

- `perSide: true` means the timer is per side; the popup must say so.
- Severity `medium` unlocks "Готово" at 80% of the timer, so the effective minimum is `0.8 · minSec`; validation of `minSec` accounts for it.
- `Session` stores `plannedSec` (the dose actually shown) so stats stay interpretable after the interval changes. Optional field; no migration needed.

Timer floors (validator, starting values, tune by feel)

| Method | `minSec` floor |
|---|---|
| `mobility`, `balance` | 20 |
| `strength`, `cardio`, `striking` | 30 |

Possible later: shorten an exercise's personal dose when it is often skipped (stored in `overrides`).

## 6. LLM layer: architecture

```
shared/domain/
  exercise-v2.ts       types, upgradeExercise, isValidExerciseV2
  catalog.ts           resolveCatalog
  picker.ts            pickExercise, explainPick
  dose.ts              dose, intensityCap
  coverage.ts          coverageMatrix, targetVsActual
  changeset.ts         ops, applyOps, invertOps, summarize
  llm-prompt.ts        prompt builders (pure, no network)
  llm-parse.ts         JSON extraction + validation
electron/main/llm/
  provider.ts          OpenAI-compatible client
  secrets.ts           key in Electron safeStorage; renderer only sees hasKey
  orchestrator.ts      changeset state machine
electron/main/ipc/llm.ts, catalog.ts
src/stores/catalog.ts, llm.ts
src/components/catalog/*
```

### 6.1 Provider

- Config: `{ baseUrl, model }` in settings; the key is stored with `safeStorage` and is write-only for the renderer (`llm:set-key`; `llm:get-config` returns `hasKey: boolean`).
- OpenAI-compatible chat completions endpoint. DeepSeek exposes such an API; check its current model names and JSON-mode parameters in the provider docs before wiring. The same adapter then works with other compatible providers and local servers.
- JSON mode, when available, is only an aid. Output is always validated by `llm-parse.ts`.
- Network rules: 60 s timeout, `AbortController` for cancel, one retry with backoff on 429/5xx, none on 4xx. Request limits: at most 24 exercises or 30 ops per call so the answer fits `max_tokens`.
- No network call happens unless `llm.enabled` and a key exists. The CSP / main-only fetch means the renderer never talks to the provider.

### 6.2 IPC channels

`llm:get-config`, `llm:save-config`, `llm:set-key`, `llm:test`, `llm:preview-request`, `llm:run`, `llm:cancel`, `llm:get-changeset`, `llm:toggle-op`, `llm:apply`, `llm:discard`, `llm:revert`, `llm:changed` (main → renderers), `catalog:list`, `catalog:set-status`, `catalog:updated` (main → renderers). Add them to `shared/types/events.ts` (`IpcChannels`).

### 6.3 Data flow

```
tab: "Сгенерировать для пустых клеток" / "Изменить набор"
  → llm:preview-request     main builds the payload; renderer shows exactly what leaves the machine + token estimate
  → llm:run                 provider call
  → llm-parse + validation  → Changeset { status: awaiting_approval, ops[], issues[] }
  → llm:changed             renderer shows the diff
  → llm:toggle-op / llm:apply   atomic: all enabled ops or none; inverse ops stored
  → catalog:updated         next trigger already sees the new exercises
  → llm:revert              applies the stored inverse ops
```

### 6.4 Privacy

Sent: equipment ids, requested cells, existing exercise titles, a few example exercises, the user's free-text instruction.
Never sent: sessions, weights, photos, `limitations`, character data. `limitations` only filter the catalog locally.

Exception: `tune` changesets (§9.2) send per-axis aggregates and only when `llm.shareProgress` is on; see §9.2 for the exact payload.

## 7. Changesets

```ts
type Op =
  | { op: 'add'; exercise: Omit<ExerciseV2, 'id' | 'source' | 'status'> }
  | { op: 'update'; id: string; patch: Partial<Pick<ExerciseV2,
      'title' | 'description' | 'timer' | 'reps' | 'intensity' | 'zones' | 'avoidIf' | 'context' | 'method'>> }
  | { op: 'archive'; id: string; reason?: string }
  | { op: 'profile_shift'; axis: 'zone' | 'method'; key: string; level: -1 | 1 | 2; until: string }  // temporary, <= 28 days

interface Changeset {
  id: string; status: ChangesetStatus; createdAt: string
  kind: 'generate' | 'edit' | 'retag' | 'tune'
  targetSetId?: string                      // where forks and new exercises land, default 'user-main'
  ops: { op: Op; state: 'ok' | 'warn' | 'rejected'; enabled: boolean; issues: string[]; reason?: string }[]
  inverse?: Op[]; usage?: { promptTokens: number; completionTokens: number }
}
```

State machine

```
requested → generating → parsed → awaiting_approval → applied → reverted
                │           │              │
                └─ failed   └─ failed      └─ discarded
```

Rules

- `rejected` ops cannot be enabled; `warn` ops can be approved consciously.
- Apply is atomic. `inverse` is built before applying (`add` → `archive`, `update` → reverse patch with old values, `archive` → `unarchive`), so revert works after an app restart.
- An op that targets a shipped id becomes **fork + patch** automatically.
- `update` is whitelisted (above). `id`, `source`, `equipment` can never be changed through the LLM.
- **Regenerate a set** = archive the batch + new `generate` changeset.
- `profile_shift` expires by itself: `until` is at most 28 days ahead, and expired shifts are dropped on load. Its inverse removes the shift.
- `kind: 'retag'` is the same machinery used to fill `zones` / `method` / `timer` for existing exercises; this is the first real test of the layer.

### 7.1 Validation

`llm-parse.ts` normalizes drafts before validation:

- Axis enums accept ASCII ids, Russian UI labels, and common synonyms (`ударка` → `striking`, `кор` → `core`, …); string numbers/bools are coerced.
- When `method` is known, timer fields are bumped so `minSec ≥` method floor and `min ≤ default ≤ max` (models often emit `minSec: 25` for every method).
- `mock://local` generate replies use distinct titles/cues per cell index so coverage fills (threshold 6) are not false-flagged as duplicates of an earlier mock add.

Reject (never reaches the catalog)

- not JSON, schema mismatch, unknown zone / method / equipment id / limitation tag (after alias normalize)
- `zones` empty, or sum outside [0.95, 1.05] (inside that range: normalize to 1.0)
- `min ≤ default ≤ max` violated, or `minSec` still below the method floor after the bump above
- `title` > 40 chars or `description` > 220 chars (popup geometry is 320×360)
- id collision

Warn (approve consciously)

- likely duplicate: same method, same dominant zone, and (identical title, description Jaccard > 0.85, or description Jaccard > 0.6 with title Jaccard > 0.7); also checked against earlier `add` ops in the same changeset
- `intensity ≥ 4` without `avoidIf`
- `posture: seated` with `intensity ≥ 4`
- strength exercise without a safety cue in the description

The AI tab can generate for **all coverage cells below threshold** or for the **selected cell only**; a selected cell must not hijack the “all empty” action.

## 8. Prompts

System

```
You design short desk-friendly micro-workouts (30–120 seconds) for a desktop app.
Reply with VALID JSON only, matching the schema. No prose, no markdown.
Rules: doable at a work desk, no pain, no equipment outside the provided list,
description <= 220 chars in the imperative with one technique cue, title <= 40 chars,
all texts in Russian. `zones` are load shares summing to 1.0. Do not invent ids.
Do not repeat existing titles.
```

Generate payload (this exact JSON is shown to the user before sending)

```json
{
  "task": "generate",
  "cells": [{ "zone": "upper", "method": "strength", "count": 6 }],
  "equipment": ["band"],
  "intensityRange": [1, 3],
  "context": { "quiet": true, "noSweat": true },
  "existingTitles": ["..."],
  "examples": ["3–4 best shipped ExerciseV2 objects"],
  "schema": "ExerciseV2 without id, source, status"
}
```

Edit payload: replace `cells` with `instruction` (the user's text, e.g. "сделай растяжки длиннее, добавь для запястий") and a compact digest of the catalog (`id, title, method, zones, timer`, roughly 25 tokens per exercise). The answer must be `{ "ops": [...] }` using only `add`, `update`, `archive`.

Budget: a 24-exercise generate call is about 4–5k output tokens. The prompt builders are pure functions in `shared/domain/llm-prompt.ts` and are unit-tested without network access.

## 9. Progress tuning

Two layers. The first is deterministic and works offline; the second is an optional LLM advisor. Neither changes anything silently unless the user chose `auto`.

### 9.1 Layer 1: hints and personal dose (no LLM)

Derived from `done` / `skipped` per exercise. `skipped` and `missed` count as skips, `snoozed` is ignored (same convention as character condition). Reps and feeling are not needed.

| Hint | Rule (starting values) | Suggested action |
|---|---|---|
| `ready_to_progress` | the last 5 shows of the exercise are all `done` | dose `+10%` (inside `[timer.min, timer.max]` and the interval intensity cap), or a harder variant along the `modificationOf` chain |
| `often_skipped` | at least 3 skips among the last 5 shows | dose `−10%`, an easier variant, or "в архив" |

- `exerciseHints(sessions, catalog)` lives in `shared/domain/tune.ts`; hints are derived on the fly and not stored.
- **UI marks are dashboard only** (badges in «Наборы», tooltips in «Покрытие»). The popup stays clean (one popup = one exercise).
- `settings.autoTune`: `suggest` (default) shows a mark with «Принять»; accepting writes `overrides[id].scale` and clears the mark. `auto` applies the same step silently and lists it in the history. `off` hides hints.
- Dose with personal scale: `dose = clamp(min, max, round5(default · scale · (interval / 45)^0.35))` (extends §5).
- Cooldown: after a change the exercise is not re-evaluated until it has 5 new shows.
- Accepted scales appear in the history list with undo.

### 9.2 Layer 2: LLM advisor («Проанализировать прогресс»)

- Button on the AI subtab. Separate opt-in `llm.shareProgress` (default off), because this payload describes the user, unlike catalog payloads. The exact payload is shown before sending.
- Payload: aggregates only. Done and skip share per zone and method (14 and 56 days), top skipped exercises (ids), current dose vs `[min, max]`, stage, interval, active profile, and the layer-1 hints. No per-session dates, no raw session list, no weight, photos or limitations.
- Output: a changeset of kind `tune` with ops `update`, `add` (easier or harder variant with `modificationOf`), `archive`, `profile_shift`. Each op carries a short `reason`, shown in the diff.
- Division of labour: the engine proposes the numbers (layer 1 hints are part of the input); the LLM adds variations and explanations. Guard: a `tune` update may not move a timer by more than ±25% of its current default in one changeset (reject otherwise).
- Effective profile = base `focus` + active `profileShifts`, clamped to [−1, 2]. The Focus UI shows an active shift with its end date ("до 15 ноября").

### 9.3 Accepting changes into your sets

- Review is the usual changeset flow: diff, per-op checkboxes, atomic apply, revert.
- On apply the user picks the **target set**: «Мои упражнения» (default), another user set, or a new one. Ops on shipped exercises become forks in that set; ops on exercises already in a user set edit them in place.
- "Save" means the change is durable: `catalog.json` and `changesets.json` are written atomically and the UI confirms it. The `reason` strings stay in the history, so "почему это изменилось" can always be answered.

## 10. Dashboard tab «Упражнения»

New top-level tab using `SectionTabs.vue`: **Покрытие · Выбор · Наборы · AI**. The «Импорт из AI» block on «Настройки» becomes a link to this tab.

| Subtab | Content | Data |
|---|---|---|
| Покрытие | Zone × Method matrix with counts; cells under a threshold (start at 6) highlighted with a "сгенерировать" action | `coverageMatrix(catalog)` → `{ zone, method, count, avgIntensity }[]`, cell = dominant zone, tooltip shows share breakdown |
| Выбор | target vs actual bars per axis (14 days); "Почему это" for the next candidate and the last shown exercise; profile simulator (200 seeded runs vs targets) with the λ slider | `targetVsActual`, `explainPick`, simulator reuses the pure picker; can also be mounted in «Лаборатория» |
| Наборы | sets (named batches) with badge `shipped / user / llm`, date, model, count, "включён" toggle, "откатить пакет", rename / create set; per-exercise hint marks (`ready_to_progress`, `often_skipped`) with «Принять» | `catalog.json`, inverse ops |
| AI | provider config, «Проанализировать прогресс» (needs `llm.shareProgress`), payload preview + token estimate, target-set picker, current changeset with diff (`+5 / ~3 / −2`) and per-op checkboxes, changeset history with revert | `changesets.json` |

Settings UI («Направления» block): one row per axis (Зона, Метод), each chip cycles `— / + / ++` (and `−` for "реже"); a **«Следовать профилю»** slider (λ, 0–1, default 0.7, labelled Мягко / Обычно / Жёстко). It is a single setting that the picker already consumes, so it ships together with the two-axis UI in phase 2. Primary/accent rows disappear.

State: the changeset lives in main and arrives through `llm:changed`. Pinia keeps only UI filters and the selected cell.

## 11. Tests (Vitest, pure functions first)

- `upgradeExercise` over all 34 shipped exercises (valid result, derived fields)
- `overlap`, `prevSession`, `doneToday`: full overlap gives ×0.2 / ×0.45 equivalents, zero overlap gives ×1
- `dose`: boundaries at 15 / 45 / 90 min, clamp by min and max, round to 5 s
- `intensityCap` thresholds
- `applyOps → invertOps → applyOps` round trip returns the original catalog
- parser on garbage input: JSON inside prose, markdown fence, truncated answer, unknown ids
- validation matrix from §7.1 (one case per rule)
- `explainPick(...).chosenId === pickExercise(...).id` for many seeds
- settings migration: old `focus.primary/accents` → `FocusV2` levels
- rotation cycle: order, slot counts per level, skipped empty zones, position recovered from history
- `exerciseHints`: thresholds, snoozed ignored, cooldown after a change
- `tune` guards: ±25% timer limit, `profile_shift` expiry and clamping
- catalog layering: shipped wins on id conflict; fork shadows the original; archived items never reach the picker

## 12. Implementation phases

Each phase ships on its own and leaves the app working without the LLM. **Phases 0–8 are implemented** (hand-retag of the 34 shipped exercises via `shared/constants/exercise-v2-tags.ts`; pick simulator in Laboratory; AI generate/edit/retag/tune UI).

| # | Phase | Acceptance |
|---|---|---|
| 0 | Types + `upgradeExercise` + validation V2 | all 34 shipped upgrade and validate; no runtime behaviour change |
| 1 | `resolveCatalog`, `catalog.json`, migration of `custom-exercises.json` | existing approved AI exercises still show up in the picker; rollback keeps `sessions.json` intact |
| 2 | Picker v2 + `explainPick` + settings migration + two-axis Focus UI + λ slider | old profiles load with equivalent behaviour; `explainPick` matches `pickExercise`; moving the slider changes the profile factor shown by `explainPick` |
| 3 | Dose + `intensityCap` + `plannedSec` in `Session` + `perSide` in popup | changing the interval changes timer and intensity; stats unaffected |
| 4 | Dashboard tab: Покрытие, Выбор, Наборы | matrix and target-vs-actual match test fixtures; "Почему это" renders the factors |
| 5 | LLM provider, secrets, IPC, generate flow, changeset approve/discard, AI subtab | with a mock provider: full flow works; with the layer off, no network call is ever made |
| 6 | Edit and retag changesets, revert, history, named sets with a target-set picker | revert restores the exact previous catalog, also after restart; shipped ids become forks in the chosen set |
| 7 | Share-based profile (step 2 of §4.3) + simulator in the laboratory | the existing λ slider visibly moves simulated shares toward targets without ever removing rotation |
| 8 | Progress tuning: layer-1 hints and personal scale (`autoTune`), then the `tune` changeset and `profile_shift` | hints appear and clear after «Принять»; a `tune` changeset can be accepted into a chosen set and reverted; without `shareProgress` nothing about progress leaves the machine |

## 13. Tuning constants and open questions

All of these live in one `shared/constants/catalog-tuning.ts` so they can change without touching logic.

- Overlap weights `0.8` / `0.55`, method repeat `0.75`, neglect cap `1.8`
- Level multipliers `0.6 / 1.0 / 1.25 / 1.6`
- Dose exponent `0.35`, intensity cap breakpoints (20 / 60 min)
- Timer floors per method, coverage threshold (6), share window (14 days)
- Boost clamp `[0.7, 1.8]`, λ default `0.7`

Resolved

- Zones: four (`upper`, `core`, `lower`, `full`); «Пояса» is covered by `upper` and `lower`.
- "По кругу" is the `rotation` zone cycle (§4.5), not a zone.
- Named sets are in scope (§3, §9.3); `Batch` gets a name and a target-set picker.
- Branch rule: `core` + `mobility` counts as `posture`, other `core` is `power` (§1.2).
- λ is a user-visible slider, default 0.7, shipped in phase 2 (§10).
- `autoTune` defaults to `suggest`: `auto` would change the workout without approval, `off` hides useful hints (§9.1).

Open questions

None at the moment. Constants above are starting values; tune them against the simulator (phase 7) and real use.

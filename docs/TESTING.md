# Testing and debug mode

How we verify domain logic and run visual scenarios without fighting the tray. Product rules stay in [CONCEPT.md](../CONCEPT.md).

## Goals

- Unit-cover picker, stage/branch, streak, severity, `Exercise` validation
- Give a **dev-only** debug surface for full scenarios (no manual tray clicking)
- Keep debug tools out of normal user runs

## Levels

| Level | What | Tool | Priority |
|-------|------|------|----------|
| Unit | Stage/branch, picker weights, validation, streak, statuses | Vitest | High |
| Store | Pinia transitions (+ hydrate from snapshot) | Vitest | High |
| Component | Popup, character portrait, base states | Vitest + Vue Test Utils | Medium |
| Scenario / visual | End-to-end flows by eye | Debug panel | High |
| E2E | Real tray / windows | Playwright (if needed) | Low |

## Cover first

1. `characterStage` / `characterBranch` (`src/domain/character-progress.ts`)
2. Next-exercise selection — zone penalties, Focus bonuses (`src/domain/exercise-picker.ts`)
3. `isValidExercise` (`shared/validation/exercise.ts`)
4. Session statuses: `done` / `snoozed` / `skipped` / `missed`
5. Streak updates on result
6. Severity level effects on the popup timer

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
- Line / quote previews

## Planned tree

```
tests/
  unit/
  stores/
  components/
  scenarios/          # fixtures for the debug panel
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

## Status

No Vitest suite or `src/debug/` panel yet. Tray still has **Popup (dev)** as a manual hook — see [DEVELOPMENT.md](DEVELOPMENT.md).

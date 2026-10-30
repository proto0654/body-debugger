# Roadmap

Post-skeleton milestones. Product detail: [CONCEPT.md](../CONCEPT.md).

| # | Milestone | Notes |
|---|-----------|--------|
| 1 | Persistence | **Done** — JSON in `.userdata/data/` (settings, progress, sessions, weights); main SoT + Pinia hydrate |
| 2 | Trigger loop | **Done** — interval from last completion, idle hold/reset, snooze, pause (tray + dashboard), `missed` timeout |
| 3 | Exercise picker | **Done** — 34-exercise catalog + approved AI additions, zone/group penalties, neglect, Focus, inventory, four modes (`shared/domain/exercise-picker.ts`) |
| 4 | Character progress | **Done** — stage from done-session thresholds, branch from the last 30 sessions (`shared/domain/character-progress.ts`) |
| 5 | Severity + timer | **Done** — countdown + progress in popup; Soft unlocks immediately, Medium at 80%, Hardcore adds a 1.5 s hold |
| 6 | Sprite cut | **Done** — `stage-{n}-{build}`, `pose-{branch}-{build}`, `emotion-{emotion}-{build}` under `frames/`; resolver + emoji fallback |
| 7 | Micro-animations | **Done** — popup entrance/exit, urgent timer, emotion crossfade + bounce; tray frame animation; «Анимации» switch |
| 8 | Optional layers | **Done** — session details, weight history, photos, inventory UI, AI proposals, themes |
| 9 | Sounds | **Done** — default pack playback, mute + volume, pause/DND gate, popup/result/stage-up cues; theme packs later — [SOUNDS.md](SOUNDS.md) |
| 10 | Tests + debug panel | **Done** — Vitest suite for domain, stores, persistence, components; dev-only debug panel with state, quick actions, six scenarios and cue preview — [TESTING.md](TESTING.md) |
| 11 | Dashboard depth | **Done** — 13-week calendar heatmap with day details, stats cards, seven-day chart, zone distribution, top exercises |
| 12 | Core preferences UI | **Done** — «Настройки» tab: interval (5–240 + presets), picker mode, Focus (primary + accents), character build; normalized on load, interval changes reschedule the loop |

All planned milestones are **done**. Future ideas, not scheduled: tray «Настройки» deep link,
theme sound packs, Playwright E2E, custom character packs, data export.

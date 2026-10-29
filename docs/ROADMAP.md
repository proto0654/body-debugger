# Roadmap

Post-skeleton milestones. Product detail: [CONCEPT.md](../CONCEPT.md).

| # | Milestone | Notes |
|---|-----------|--------|
| 1 | Persistence | **Done** — JSON in `.userdata/data/` (settings, progress, sessions); main SoT + Pinia hydrate |
| 2 | Trigger loop | **Done** — interval from last completion, idle hold/reset, snooze, pause (tray + dashboard), `missed` timeout |
| 3 | Exercise picker | **Done** — 34-exercise catalog, zone/group penalties, neglect, Focus, inventory, four modes (`shared/domain/exercise-picker.ts`) |
| 4 | Character progress | **Done** — stage from done-session thresholds, branch from the last 30 sessions (`shared/domain/character-progress.ts`) |
| 5 | Severity + timer | **Done** — countdown + progress in popup; Soft unlocks immediately, Medium at 80%, Hardcore adds a 1.5 s hold (extra checks later) |
| 6 | Sprite cut | **Done** — `stage-{n}-{build}`, `pose-{branch}-{build}`, `emotion-{emotion}-{build}` under `frames/`; resolver + emoji fallback |
| 7 | Micro-animations | **Done** — popup entrance/exit, urgent timer, emotion crossfade + bounce; tray frame animation; «Анимации» switch (reduce motion) |
| 8 | Optional layers | Weight, photos, feeling, inventory, AI, themes |
| 9 | Sounds | Wire default pack + mute/volume; theme packs later — [SOUNDS.md](SOUNDS.md) |
| 10 | Tests + debug panel | Vitest for domain/stores; dev-only scenarios — [TESTING.md](TESTING.md) |
| 11 | Dashboard depth | Calendar heatmap + stats charts |

Skeleton (tray, windows, types, stores, IPC schema, Tailwind) = **done**.  
Persistence (#1), trigger loop (#2), picker (#3), character progress (#4), severity/timer (#5), sprite cut (#6) and micro-animations (#7) = **done**. Default sound **assets** landed (playback = #9). Next: **#8 Optional layers**.

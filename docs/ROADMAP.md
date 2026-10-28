# Roadmap

Post-skeleton milestones. Product detail: [CONCEPT.md](../CONCEPT.md).

| # | Milestone | Notes |
|---|-----------|--------|
| 1 | Persistence | JSON first (progress, settings, sessions); SQLite optional later |
| 2 | Trigger loop | Interval from last completion; idle; pause in tray menu |
| 3 | Exercise picker | Penalties / bonuses / Focus / modes in `src/domain/exercise-picker.ts` |
| 4 | Character progress | Stage/branch from history in `src/domain/character-progress.ts` |
| 5 | Severity + timer | Soft / Medium (default) / Hardcore in popup |
| 6 | Sprite cut | `stage-{n}-{build}`, `pose-{branch}`, `emotion-*` |
| 7 | Micro-animations | Tray + popup (CONCEPT §13); respect `reduceMotion` |
| 8 | Optional layers | Weight, photos, feeling, inventory, AI, themes |
| 9 | Dashboard depth | Calendar heatmap + stats charts |

Skeleton (tray, windows, types, stores, IPC schema, Tailwind) = **done**.

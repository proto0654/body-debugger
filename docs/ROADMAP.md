# Roadmap

Post-skeleton milestones. Product detail: [CONCEPT.md](../CONCEPT.md).

| # | Milestone | Notes |
|---|-----------|--------|
| 1 | Persistence | **Done** — JSON in `.userdata/data/` (settings, progress, sessions, weights); main SoT + Pinia hydrate |
| 2 | Trigger loop | **Done** — interval from last completion, idle hold/reset, snooze, pause (tray + dashboard), `missed` timeout |
| 3 | Exercise picker | **Done** — 34-exercise catalog + approved AI additions, zone/group penalties, neglect, Focus, inventory, four modes (`shared/domain/exercise-picker.ts`) |
| 4 | Character progress | **Done** — earned stage/branch plus temporary neglect/recovery from saved results; see [Architecture](ARCHITECTURE.md#temporary-character-condition) |
| 5 | Severity + timer | **Done** — countdown + progress in popup; explicit «Начать»; Soft unlocks after starting, Medium at 80%, Hardcore adds a 1.5 s hold |
| 6 | Sprite cut | **Done** — Desk Hulk body/pose/emotion/neglect frames and runtime fallback; nine additional packs have 432 frames across three builds, awaiting runtime selection — [Art library](../src/assets/character/README.md) |
| 7 | Micro-animations | **Done** — popup entrance/exit, urgent timer, emotion crossfade + bounce; tray frame animation; «Анимации» switch |
| 8 | Optional layers | **Done** — session details, weight history, photos, inventory UI, AI proposals, themes |
| 9 | Sounds | **Done** — default pack playback, mute + volume, pause/DND gate, popup/result/stage-up cues; theme packs later — [SOUNDS.md](SOUNDS.md) |
| 10 | Tests + native laboratory | **Done** — Vitest suite plus an isolated native profile, six timeline stories, seeded calendars, saved runs, popup/idle/error controls and appearance previews — [TESTING.md](TESTING.md) |
| 11 | Dashboard depth | **Done** — 13-week calendar heatmap with day details, stats cards, seven-day chart, zone distribution, top exercises |
| 12 | Core preferences UI | **Done** — «Настройки» tab: interval (5–240 + presets), picker mode, Focus (primary + accents), character build; normalized on load, interval changes reschedule the loop |

The prototype milestones above are implemented; they do not mean that every long-term idea in the concept is shipped. The current dashboard includes the tray settings deep link, a character-led «Сегодня» screen, next-form progress and durable result feedback.

Remaining product gaps, not scheduled: six distinct body illustrations for the default Desk Hulk (currently three tiers), runtime selection/resolution of the nine additional art-ready packs, custom pack import, personal exercise-level progression and difficulty weighting, automatic AI analysis (currently manual import), external-event triggers, automatic streak audio/tray milestones, theme sound packs, data export and Playwright E2E.

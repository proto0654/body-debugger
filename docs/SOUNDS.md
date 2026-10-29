# Sounds

Optional feedback layer. Product rule: sounds must not affect the core cycle (remind → one exercise → result). Companion ideas originated next to [CONCEPT.md](../CONCEPT.md); this file is the project SoT for sound assets and wiring.

## Goals

- Short cues that reinforce popup / result / milestone feedback
- Never nagging; one master mute, volume control, DND / call-safe silence
- Theme-swappable packs without code changes

## Event → cue

| Event | File (default pack) | Priority |
|-------|---------------------|----------|
| Popup appears | `popup.mp3` | Optional |
| Timer start | *(not in pack yet — soft tick)* | Optional |
| Result `done` | `done.mp3` | Recommended |
| Result `skipped` / dismiss | `skip.mp3` | Optional |
| Result `snoozed` | `snooze.mp3` | Optional |
| Stage up | `stage-up.mp3` | Optional |
| Streak record | `streak.mp3` | Optional |
| Soft alert / warning | `alert.mp3` | Optional |
| Error / invalid action | `error.mp3` | Optional |

## Principles

1. Master switch off = no playback.
2. Volume is user-controlled; default is muted or very quiet.
3. Clips stay short (~0.3–1.5 s).
4. While paused / DND / on a call, do not play.
5. Visual themes may point at different sound packs (`themeId` / future `soundPackId`).
6. Optional layer only — core cycle works with audio disabled.

## Asset layout

```
src/assets/sounds/
  default/           # shipped pack (mp3)
    popup.mp3
    done.mp3
    skip.mp3
    snooze.mp3
    stage-up.mp3
    streak.mp3
    alert.mp3
    error.mp3
  silent/            # optional near-silent stubs (future)
```

Settings (when wired): enabled flag + volume + selected pack id. See [ARCHITECTURE.md](ARCHITECTURE.md) / `shared/types/settings.ts` — sound fields are not in `AppSettings` yet.

## Implementation notes (planned)

- Prefer Web Audio API or lightweight `Audio` elements in the renderer
- Preload the default pack on app / popup start
- Swap packs by path / import map; keep event keys stable
- Debug panel: play-each-cue buttons — see [TESTING.md](TESTING.md)

## Status

Assets for the **default** pack are in-repo. Playback, settings fields, and theme packs are **not** implemented yet (roadmap optional layer).

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

Settings live in `AppSettings.sound` (`shared/types/settings.ts`): `{ enabled, volume, packId }`.
Defaults: off, volume `0.4`, pack `default`; an older settings file gets the block filled by
`normalizeSettings`. See [ARCHITECTURE.md](ARCHITECTURE.md#sounds).

## Implementation

- Renderer player: `src/sounds.ts` (`createSoundPlayer` + `useSoundPlayer`), lightweight `Audio` elements.
- Pack URLs are imported through Vite (`?url`), so the default pack ships with the renderer bundle.
- The player preloads the pack on popup start and logs+swallows an autoplay rejection.
- Playback is gated by the master switch, volume > 0, `settings.paused` and a `quiet` context
  (DND/call). The app does not detect OS DND yet; the gate is ready for it.
- Event → cue map: `shared/domain/sounds.ts`; `missed` has no cue.
- Popup: `popup` on mount, `done` / `skip` / `snooze` after a durable result acknowledgement, `stage-up` when a done session
  raises the character stage.
- Laboratory «Попап и трей»: every cue has a preview button that ignores the master switch — see [TESTING.md](TESTING.md).
- `streak` has a bundled file and a preview button; no automatic milestone trigger yet.
- Theme packs are future work: keep cue keys stable and swap the URL map by `packId`.

## Status

Default pack, settings, playback, gating and popup cues are **implemented**. Automatic `streak`
milestones and theme sound packs are **not** wired yet.

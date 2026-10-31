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
2. Volume is user-controlled; new profiles start enabled at 40%. Explicit stored mute/volume choices and legacy profiles without a sound block are preserved.
3. Current default effect clips stay short (~0.3–1.5 s). Planned voice production has separate budgets in [Audio production](AUDIO-PRODUCTION.md).
4. While paused / DND / on a call, do not play.
5. Visual themes may point at different sound packs (`themeId` / future `soundPackId`).
6. Optional layer only — core cycle works with audio disabled.

## Asset layout

```
src/assets/sounds/
  production.json    # authored generation catalog; not loaded by the player
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
Defaults for new or explicitly reset profiles: on, volume `0.4`, pack `default`. `normalizeSettings` keeps an existing profile with no sound block muted and preserves explicit settings. See [ARCHITECTURE.md](ARCHITECTURE.md#sounds).

## Implementation

- Renderer player: `src/sounds.ts` (`createSoundPlayer` + `useSoundPlayer`), lightweight `Audio` elements.
- Pack URLs are imported through Vite (`?url`), so the default pack ships with the renderer bundle.
- The player preloads the pack on popup start and logs+swallows an autoplay rejection.
- Playback is gated by the master switch, volume > 0, `settings.paused` and a `quiet` context
  (DND/call). The app does not detect OS DND yet; the gate is ready for it.
- Event → cue map: `shared/domain/sounds.ts`; `missed` has no cue.
- Popup: `popup` on mount, `done` / `skip` / `snooze` after a durable result acknowledgement, `stage-up` when a done session
  raises the character stage.
- Laboratory «Попап и цикл»: every cue has a preview button that ignores the master switch — see [TESTING.md](TESTING.md).
- The native popup is the sole owner of popup/result audio; laboratory controls never replay those cues on snapshot changes. Explicit cue previews remain available in sound settings and the laboratory and use at least 10% volume.
- `streak` has a bundled file and a preview button; no automatic milestone trigger yet.
- Theme packs are future work: keep cue keys stable and swap the URL map by `packId`.

## Status

Default pack, settings, playback, gating and popup cues are **implemented**. Automatic `streak`
milestones and theme sound packs are **not** wired yet.

## Authored production package — not integrated

[Audio production](AUDIO-PRODUCTION.md) owns the manual and per-clip API ElevenLabs workflow, casting, export,
review and future playback contract. The [catalog](../src/assets/sounds/production.json) contains
ten voice profiles, 400 voice positions and nine shared effect prompts. It is inert production
data, not a replacement for the current default pack or an application manifest.

The approved direction uses a distinct voice per character, including system messages, and
short roasts for both skip and snooze. This changes the intended copy policy in
[CONCEPT.md](../CONCEPT.md); the existing runtime captions and public settings types are unchanged.
Voice selection and generated pilot takes are recorded in the catalog and source-side reports;
duration checks do not imply listening approval. The batch cutter archives and splits manual
downloads, and the API generator writes one clip per request with a take log in
[`api-report.json`](../src/assets/sounds/api-report.json); neither path imports clips into the player.
Greeting/streak voice material and the start effect remain reserve content.

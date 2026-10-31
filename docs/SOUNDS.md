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
  production.json    # authored generation catalog; not imported by the renderer
  default/           # shipped pack (mp3)
    popup.mp3
    done.mp3
    skip.mp3
    snooze.mp3
    stage-up.mp3
    streak.mp3
    alert.mp3
    error.mp3
  <character>/       # generated voice takes, one file per position
    <character>__<event>__<variant>__take-1.mp3
    source/          # archived API responses, casting previews and cut tracks
  system/            # shared effect takes: system__<event>__01__take-N.mp3
  silent/            # optional near-silent stubs (future)
```

Settings live in `AppSettings.sound` (`shared/types/settings.ts`): `{ enabled, volume, packId, voiceEnabled }`.
Defaults for new or explicitly reset profiles: on, volume `0.4`, pack `default`, voice off. `normalizeSettings` keeps an existing profile with no sound block muted, defaults the missing `voiceEnabled` to `false` and preserves explicit settings. See [ARCHITECTURE.md](ARCHITECTURE.md#sounds).

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

## Character voice layer (opt-in)

The generated voice package plays through the same gate and the same player:

- `sound.voiceEnabled` (default **off**) switches it on; the toggle is in «Настройки → Звуки». The voice is keyed by
  `settings.characterPackId`, so the character identity owns the voice.
- `VOICE_CUE_EVENTS` maps a cue to a spoken event: `popup → ready`, `done → done`, `skip → skipped`,
  `snooze → snoozed`, `stage-up → stage-up`, `streak → streak`, `alert → alert`, `error → error`.
- One principal clip per event. Variants of that event (lines and vocal reactions) rotate through
  `pickVoiceVariant`, which never repeats the previous take; the rotation state is per character and event.
- The voice **replaces** the effect for the same event. When the layer is off, the character has no take, or
  playback is gated, the shipped effect remains the audible feedback, so nothing depends on the generated files.
- `error/01` is the catalogued *failed-session-save* line and the popup speaks it only from the rejected-save
  path; `error/02` stays a generic acknowledgement and is not triggered automatically.
- Manifest: `src/voice-assets.ts` imports the take-1 files with `import.meta.glob` and exposes
  `voiceClips(characterId, event)` and `EFFECT_CLIPS`. The catalog is still not imported by the renderer.
- Bundle cost: the build emits 418 mp3 assets (~11 MB) next to the existing art; the scripts return URLs, so the
  JavaScript chunk does not carry audio data.
- Laboratory «Звуки» (`src/debug/SoundAuditionPanel.vue`) lists every variant per event and every effect take,
  plays one clip or all variants of an event in sequence, and ignores the master switch and the voice toggle.
  It changes no setting, profile or history.

Not wired: automatic `welcome`/`paused`/`streak` narration, voice for `alert`, queueing or interrupting a
previous line, effect-plus-voice mixing, OS DND detection and cross-window arbitration. The popup remains the
only automatic voice owner.

## Status

Default pack, settings, playback, gating, popup cues and the opt-in character voice are **implemented**.
Automatic `streak` milestones, theme sound packs, voice queueing and DND detection are **not** wired yet.

## Authored production package

[Audio production](AUDIO-PRODUCTION.md) owns the manual and per-clip API ElevenLabs workflow, casting, export,
review and the playback contract. The [catalog](../src/assets/sounds/production.json) contains
ten voice profiles, 400 voice positions and nine shared effect prompts. It is production data; the
player does not read it, because the renderer manifest (`src/voice-assets.ts`) is built from the files
on disk while the catalog keeps the authoring, casting and take records.

The approved direction uses a distinct voice per character, including system messages, and
short roasts for both skip and snooze. This changes the intended copy policy in
[CONCEPT.md](../CONCEPT.md); the existing runtime captions are unchanged.
All ten voices are cast and every one of the 400 voice positions and nine shared effects now has a
first take, produced by `scripts/generate-audio-api.mjs` and `scripts/generate-effects-api.mjs`
(casting: `scripts/cast-voices-api.mjs`). Nothing has passed listening review yet, so none of it is
accepted production material: 45 takes exceed their duration budget and four chuckles are shorter than
the 0.2 s reaction minimum. That is why the voice layer ships switched off. Voice selection and pilot
takes stay recorded in the catalog, generated takes in
[`api-report.json`](../src/assets/sounds/api-report.json). Greeting/streak voice material and the
start effect remain reserve content.

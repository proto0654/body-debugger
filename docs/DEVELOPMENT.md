# Development

## Commands

```bash
npm run dev          # tray + dashboard (electron-vite)
npm run build
npm run preview
npm run typecheck    # main + preload + shared (tsc) and renderer (vue-tsc)
```

## Dependency caches (project drive only)

Heavy downloads stay on **E:**, never the system partition.

| What | Where |
|------|--------|
| npm cache | `E:/Electron/.cache/npm` ([.npmrc](../.npmrc)) |
| Electron zip cache | `E:/Electron/.cache/electron` (`electron_config_cache` / `ELECTRON_CACHE`) |
| Unpacked runtime | `node_modules/electron/dist/` |
| Chromium userData | `.userdata/` at repo root (`app.setPath` in `electron/main/index.ts`) |
| App JSON (settings / progress / sessions) | `.userdata/data/*.json` (main persistence; gitignored with `.userdata/`) |

Before / during Electron postinstall:

```powershell
$env:electron_config_cache = "E:\Electron\.cache\electron"
$env:ELECTRON_CACHE = "E:\Electron\.cache\electron"
```

`scripts/ensure-electron.js` (postinstall) prefers that cache and skips work if `electron.exe` already exists.

Do **not** download Electron into `%LOCALAPPDATA%\electron` or park the profile under `%APPDATA%` on `C:`.

## Windows notes

- App stays in the tray when all windows close.
- Tray menu: **Дашборд**, **Напоминание сейчас**, **Пауза / Продолжить**, Quit. There is no settings screen yet — pause and severity live on the dashboard.
- Renderer routes: `#/dashboard`, `#/popup`.
- After a **Готово** in the popup, streak, sessions and character survive quit/relaunch (check `.userdata/data/`).
- If the shell exports `ELECTRON_RUN_AS_NODE=1` (some editors/agents do), `electron.exe .` boots as plain Node and crashes on `electron.app`. Clear the variable for smoke runs.

## Reminder loop

Rules live in [electron/main/trigger-loop.ts](../electron/main/trigger-loop.ts) (main process).

| Knob | Value |
|------|-------|
| Interval | `settings.intervalMinutes` (default 45), counted from the last resolved session |
| Snooze | retry after 5 minutes |
| Idle hold | no popup while system idle ≥ 60 s |
| Idle reset | away ≥ 5 min = break; cycle restarts on return |
| Missed | no answer for 5 min → `missed`, popup closed |
| First trigger after launch | due time, but at least 60 s after start |

The popup pulls its exercise from main (`session:get-current-popup`), so **Напоминание сейчас** always exercises the real cycle. Pause is persisted in `settings.json`.

## Popup severity

Rules live in [shared/domain/severity.ts](../shared/domain/severity.ts); switch on the dashboard.

| Level | «Готово» |
|-------|----------|
| Мягкая | Enabled at once, timer is a hint |
| Средняя (default) | Unlocks at 80% of the exercise timer |
| Жёсткая | Same unlock + hold the button for 1.5 s |

Closing the popup without an answer is recorded as `skipped` at every level.

## Sounds (assets only)

Default cue pack: `src/assets/sounds/default/*.mp3`. Playback and settings are not wired — see [SOUNDS.md](SOUNDS.md). When implementing, keep mute / DND respect and treat audio as an optional layer.

## Testing / debug

No Vitest scripts yet. Manual hook: tray **Напоминание сейчас** (runs the real trigger cycle). Planned suite + debug panel: [TESTING.md](TESTING.md).

# Development

## Commands

```bash
npm run dev          # tray + dashboard (electron-vite)
npm run build
npm run preview
npm run typecheck    # main + preload + shared (tsc), renderer and tests (vue-tsc)
npm test             # Vitest suite (see TESTING.md)
npm run test:watch
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

## Character sprites

Source sheets in `src/assets/character/desk-hulk/` (`sprite-sheet-stages.png`, `sprite-sheet-branches.png`, `emotions/emotions-set-*.png`) are the only art source. After replacing a sheet, re-cut the frames:

```bash
python scripts/cut-character-sprites.py   # needs Pillow + NumPy
```

The script detects figures, drops the flat sheet background and writes individual PNGs to `src/assets/character/desk-hulk/frames/`. Do not edit `frames/` by hand. Naming and resolution rules: [ARCHITECTURE.md](ARCHITECTURE.md).

## Motion

Keyframes and reduced-motion overrides live in `src/styles/index.css`; popup exit timings in `src/motion.ts` — keep the CSS durations and `POPUP_EXIT_MS` in sync. The «Анимации» switch on the dashboard persists `settings.reduceMotion`; the main process reads it for tray frames through `TrayHandlers.isReducedMotion`, so no IPC round trip is needed.

The OS `prefers-reduced-motion` setting is honoured in the renderer only; the main process cannot read it.

## Tray icons

Frames in `electron/resources/tray/` are generated, not hand-drawn:

```bash
python scripts/build-tray-icons.py   # needs Pillow
```

The glyph is a placeholder "person stretching" mark. Replace the drawing in the script and re-run to change the tray identity; adding a state means new frames plus a `TRAY_FRAME_SPECS` entry in `electron/main/tray-icons.ts`. Frames are 32×32 PNGs — Windows scales them down for the 16 px notification area.

## Sounds (assets only)

Default cue pack: `src/assets/sounds/default/*.mp3`. Playback and settings are not wired — see [SOUNDS.md](SOUNDS.md). When implementing, keep mute / DND respect and treat audio as an optional layer.

## Testing / debug

`npm test` runs the Vitest suite (domain, stores, JSON envelope, popup/portrait). `npm run typecheck` includes the test project (`tsconfig.test.json`). Layout, covered areas and gaps: [TESTING.md](TESTING.md). Manual hook for end-to-end checks: tray **Напоминание сейчас** (runs the real trigger cycle).

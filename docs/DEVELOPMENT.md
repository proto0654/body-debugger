# Development

## Commands

```bash
npm run dev          # primary: HMR tray + dashboard; Лаборатория starts the sandbox
npm run build:dir    # optional packaged prod smoke in dist/win-unpacked
npm run build:win    # local NSIS + latest.yml in dist/ (no upload)
npm run publish:prod # ship stable to the release repo (GH_TOKEN) — client updates from here
npm run typecheck    # main + preload + shared (tsc), renderer and tests (vue-tsc)
npm test             # Vitest suite (see TESTING.md)
npm run test:watch
# Legacy until ROADMAP #18 (avoid for normal work):
# npm run build:dev / build:dev:dir / publish:dev
```

**Mental model:** develop with `npm run dev`; ship and update only through the stable GitHub prod installer. See [DELIVERY.md](DELIVERY.md).

## First run

```powershell
$env:electron_config_cache = "E:\Electron\.cache\electron"
$env:ELECTRON_CACHE = "E:\Electron\.cache\electron"

npm install
npm run dev
```

`npm run dev` builds main / preload, starts the renderer dev server (port 5173, or the next free one) and launches Electron. Expected: an emerald tray icon, the dashboard window, and a popup after **Размяться сейчас** (dashboard) or **Напоминание сейчас** (tray). Data is written to `.userdata/data/*.json`, photos to `.userdata/photos/`; delete `.userdata/` to reset progress.

If Electron boots as plain Node and crashes on `electron.app`, the shell exports `ELECTRON_RUN_AS_NODE=1`. The `npm run dev` wrapper ([scripts/run-electron-vite.cjs](../scripts/run-electron-vite.cjs)) removes it before starting Electron; a direct `electron.exe .` or packaged launch still needs it cleared (see Windows notes).

What to click for a manual smoke: [TESTING.md](TESTING.md#manual-checklist).

## Dependency caches (project drive only)

Heavy downloads stay on **E:**, never the system partition.

| What | Where |
|------|--------|
| npm cache | `E:/Electron/.cache/npm` ([.npmrc](../.npmrc)) |
| Electron zip cache | `E:/Electron/.cache/electron` (`electron_config_cache` / `ELECTRON_CACHE`) |
| electron-builder downloads (NSIS, winCodeSign) | `E:/Electron/.cache/electron-builder` (`ELECTRON_BUILDER_CACHE`) |
| Unpacked runtime | `node_modules/electron/dist/` |
| Chromium userData (development) | `.userdata/` at repo root (`app.setPath` in `electron/main/index.ts`) |
| Chromium userData (installed prod) | `app.getPath('userData')` = `%APPDATA%\Body Debugger` — a packaged app cannot write next to `resources/app.asar` |
| Chromium userData (installed dev) | `%APPDATA%\Body Debugger Dev`; separate `appId`, lock and updater cache |
| Main-process log | `<userData>/logs/app.log`, rotated once to `app.1.log` at 512 KB |
| App JSON (settings / progress / sessions / weights / photos / AI) | `.userdata/data/*.json` (main persistence; gitignored with `.userdata/`) |
| Progress photo files | `.userdata/photos/` (gitignored; metadata in `data/photos.json`) |

An installed build writes to the OS profile and keeps its log there; how a build is identified and how updates reach testers: [DELIVERY.md](DELIVERY.md).

Before / during Electron postinstall:

```powershell
$env:electron_config_cache = "E:\Electron\.cache\electron"
$env:ELECTRON_CACHE = "E:\Electron\.cache\electron"
```

`scripts/ensure-electron.js` (postinstall) prefers that cache and skips work if `electron.exe` already exists.

Do **not** download Electron into `%LOCALAPPDATA%\electron` or park the profile under `%APPDATA%` on `C:`.

## Windows notes

- App stays in the tray when all windows close.
- Tray menu: **Дашборд**, **Напоминание сейчас**, **Пауза / Продолжить**, Quit. **Настройки** opens the preferences tab directly, including in an existing dashboard.
- Two builds can run side by side: prod (`Body Debugger`) and dev (`Body Debugger Dev`). They have separate icons, titles, `appId`, profiles, single-instance locks, updater caches and autostart registry values; the dev tray tooltip is prefixed with `Dev · `.
- **Настройки → Система** controls autostart. It is available only in an installed Windows build; the login item starts the app with `--hidden`, so only the tray opens. A manual launch opens the dashboard. The uninstaller removes the entry.
- Dashboard sections: **Сегодня** (character, day totals, next form, quick weight entry), **Персонаж** (**Профиль**: identity/build, preview, evolution; **Хроника**: read-only scrub/play of the real history with calendar and statistics), **Прогресс** (calendar, statistics, weight history, photos), **Настройки** (rhythm/strictness, selection/Focus, inventory/AI, sounds and appearance); the **Лаборатория** entry opens the sandboxed process from any shipped build — see [ARCHITECTURE.md](ARCHITECTURE.md#core-preferences).
- Renderer routes: `#/dashboard`, `#/popup`, `#/laboratory-preview` (visual popup preview inside the sandbox child); `#/dashboard?tab=settings` or `?tab=laboratory` open those tabs directly. The dashboard has five primary sections including «Лаборатория»; the native laboratory host is the only laboratory UI.
- After a **Готово** in the popup, streak, sessions and character survive quit/relaunch (check `.userdata/data/`).
- If the shell exports `ELECTRON_RUN_AS_NODE=1` (some editors/agents do), `electron.exe .` boots as plain Node and crashes on `electron.app`. The npm `dev` script strips it for the Electron child; clear it yourself for a direct `electron.exe .` or a packaged smoke run — it also makes a packaged `Body Debugger.exe` exit instantly with no profile and no log.

## Packaging

`electron-builder` produces a per-user NSIS one-click installer. The production config and publish target live in [electron-builder.yml](../electron-builder.yml); the side-by-side dev build is described by [electron-builder.dev.yml](../electron-builder.dev.yml). Full flow: [DELIVERY.md](DELIVERY.md).

```powershell
$env:ELECTRON_BUILDER_CACHE = "E:\Electron\.cache\electron-builder"
npm run build:win      # dist\Body-Debugger-Setup-<version>.exe, .blockmap, latest.yml
npm run build:dir      # dist\win-unpacked\Body Debugger.exe
npm run build:dev      # dist-dev\Body-Debugger-Dev-Setup-<version>.exe, .blockmap, dev.yml for -dev.N
npm run build:dev:dir  # dist-dev\win-unpacked\Body Debugger Dev.exe
```

These scripts rebuild `out/` themselves; a packaged run never uses a stale bundle. The dev config sets `extraMetadata.name` and `extraMetadata.productName`: the first separates the updater cache, the second the profile and window identity. Keep both in sync with `shared/domain/app-identity.ts`.

The installed production application writes its profile to `%APPDATA%\Body Debugger` (not the repo), takes the single-instance lock, and keeps user data across uninstall. The dev build writes to `%APPDATA%\Body Debugger Dev` and can run at the same time.

The application icon is generated from the Desk Hulk happy emotion, not hand-drawn:

```bash
python scripts/build-app-icon.py   # needs Pillow + NumPy; writes prod + dev ICO/PNG pairs
```

## Reminder loop

Rules live in [electron/main/trigger-loop.ts](../electron/main/trigger-loop.ts) (main process).

| Knob | Value |
|------|-------|
| Interval | `settings.intervalMinutes` (default 45, bounds 5–240, edited on «Настройки»), counted from the last resolved session |
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
| Мягкая | Enabled after «Начать», timer is a hint |
| Средняя (default) | Unlocks at 80% of the exercise timer |
| Жёсткая | Same unlock + hold the button for 1.5 s |

The popup window is transparent and frameless: the card paints its own rounded
surface (`html.window-popup` in `src/styles/index.css`), so the corners let the
desktop through. Transparent pixels still belong to the window rectangle and
capture clicks — a click-through margin would need `setIgnoreMouseEvents`.

The 320×260 popup includes a compact comic caption; expanded details use 380 px (plus 36 px for errors, capped at 420). The timer waits for «Начать». A saved result shows feedback for 4.5 seconds (6 for a new form, 2.5 for skip/snooze) and then a 180 ms exit; an always-available close button skips the remaining reading time; a failed write leaves the popup retryable. Duplicate results do not count twice. Closing the popup without an answer is recorded as `skipped` at every level.

## Session details

Optional, off by default. «Детали в попапе» on «Настройки» adds a collapsible
row to the popup (reps / feeling / weight). Ranges and normalization live in
`shared/domain/session-extras.ts`; the popup grows through `window:resize-popup`
with heights in `shared/constants/popup.ts`. Out-of-range values are dropped,
never clamped, and the core cycle resolves without any details.

## Character sprites

Source sheets in `src/assets/character/desk-hulk/` (`sprite-sheet-stages.png`, `sprite-sheet-branches.png`, `sprite-sheet-neglect.png`, `emotions/emotions-set-*.png`) are the only art source. After replacing a sheet, re-cut the frames:

```bash
python scripts/cut-character-sprites.py   # needs Pillow + NumPy
```

The script detects figures, drops the flat background from legacy sheets and writes 42 individual PNGs to `src/assets/character/desk-hulk/frames/`. The neglect sheet has authored alpha: detection uses that alpha and cropping preserves its antialiased transparency. Its three rows are levels 1/2/3 and columns are lean/average/stocky; fixed equal-cell cuts would clip the first row's shoes. Generation used the built-in `image_gen` tool with the existing stage sheet as an identity/style reference; the exact prompt is [stored beside the source](../src/assets/character/desk-hulk/sprite-sheet-neglect.prompt.txt). Do not edit `frames/` by hand. Naming and resolution rules: [ARCHITECTURE.md](ARCHITECTURE.md).

The approved [nine-character casting sheet](../src/assets/character/character-casting-sheet.png) now has 432 separate RGBA frames: three builds and sixteen states per character. Sources, exact prompts, the build comparison and regeneration commands live in the [character art library](../src/assets/character/README.md). Use `python scripts/cut-character-sprites.py --packs` for these packs. The runtime resolver and character profile support these packs alongside Desk Hulk in dashboard, popup and laboratory.

## Motion

Keyframes and reduced-motion overrides live in `src/styles/index.css`; reading/exit timings in `shared/domain/reaction-timing.ts`. The popup separates feedback from closing; the laboratory waits for feedback completion and actual closure. `src/motion.ts` owns the combined app/OS motion preference. The «Уменьшить анимации» switch on «Настройки» persists `settings.reduceMotion`; the main process reads it for tray frames through `TrayHandlers.isReducedMotion`, so no IPC round trip is needed.

The OS `prefers-reduced-motion` setting is honoured in the renderer only; the main process cannot read it.

## Tray icons

Frames in `electron/resources/tray/` are generated, not hand-drawn:

```bash
python scripts/build-tray-icons.py   # needs Pillow
```

The glyph is a placeholder "person stretching" mark. Replace the drawing in the script and re-run to change the tray identity; adding a state means new frames plus a `TRAY_FRAME_SPECS` entry in `electron/main/tray-icons.ts`. Frames are 32×32 PNGs — Windows scales them down for the 16 px notification area.

## Sounds

Default cue pack: `src/assets/sounds/default/*.mp3`. Settings (`sound.enabled` / `volume` / `packId`) and the gated renderer player live in `shared/domain/sounds.ts` + `src/sounds.ts`; mute/DND rules: [SOUNDS.md](SOUNDS.md). New profiles enable the default pack at 40%; explicit stored choices and legacy mute are preserved. Audio remains an optional layer: a failed play is logged, never surfaced.

## Photos

The popup sends bytes; main validates JPEG/PNG/WebP up to 8 MB and writes `.userdata/photos/<id>.<ext>` plus `data/photos.json`. The renderer loads `<img src="photo://<id>">`; main's protocol resolves only known ids. The photo layer is off by default and never blocks a session result.

## AI proposals

No network call is made. The dashboard panel accepts pasted AI JSON, validates it as an `Exercise`, and only writes `data/custom-exercises.json` after «Утвердить». The picker merges the shipped catalog with approved entries; shipped ids always win. Rules: `shared/domain/ai-proposal.ts`.

## Themes

`src/styles/index.css` defines `:root[data-theme='night']` / `[data-theme='warm']` token overrides. `App.vue` mirrors `settings.themeId` onto `<html>`; no component reads the theme directly. Unknown ids normalize to `default`.

## Testing / laboratory

`npm test` runs the Vitest suite (domain, stores, persistence, popup/portrait, photos, AI, stats, chronicle, playback coordinator, laboratory engine/bridge). `npm run typecheck` includes the test project (`tsconfig.test.json`). Layout, covered areas and gaps: [TESTING.md](TESTING.md). For native visual checks run `npm run dev` and open **«Лаборатория»**. The main app pre-warms a headless Electron child with `--body-debugger-lab --body-debugger-lab-headless`; the child uses `.userdata/laboratory/` when unpackaged and `%APPDATA%\Body Debugger\laboratory` (or the dev-channel equivalent) when packaged, including media and Chromium cache. It has no tray or dashboard: the lab panel mounts natively in the dashboard. The real profile is untouched; native popups/previews are child windows. The lab run pauses when leaving the tab; reopening shows the paused state and the user can continue.

The npm `dev` wrapper removes `ELECTRON_RUN_AS_NODE` from the Electron child environment entirely; an empty value still enables Node mode in Electron. For a direct terminal launch or packaged smoke, clear the variable as described in the Windows notes. The packaged lab engine is started without the asar argument and skips the updater.

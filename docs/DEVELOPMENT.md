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

## First run

```powershell
$env:electron_config_cache = "E:\Electron\.cache\electron"
$env:ELECTRON_CACHE = "E:\Electron\.cache\electron"

npm install
npm run dev
```

`npm run dev` builds main / preload, starts the renderer dev server (port 5173, or the next free one) and launches Electron. Expected: an emerald tray icon, the dashboard window, and a popup after **Размяться сейчас** (dashboard) or **Напоминание сейчас** (tray). Data is written to `.userdata/data/*.json`, photos to `.userdata/photos/`; delete `.userdata/` to reset progress.

If Electron boots as plain Node and crashes on `electron.app`, the shell exports `ELECTRON_RUN_AS_NODE=1` — clear it for the run (see Windows notes).

What to click for a manual smoke: [TESTING.md](TESTING.md#manual-checklist).

## Dependency caches (project drive only)

Heavy downloads stay on **E:**, never the system partition.

| What | Where |
|------|--------|
| npm cache | `E:/Electron/.cache/npm` ([.npmrc](../.npmrc)) |
| Electron zip cache | `E:/Electron/.cache/electron` (`electron_config_cache` / `ELECTRON_CACHE`) |
| Unpacked runtime | `node_modules/electron/dist/` |
| Chromium userData | `.userdata/` at repo root (`app.setPath` in `electron/main/index.ts`) |
| App JSON (settings / progress / sessions / weights / photos / AI) | `.userdata/data/*.json` (main persistence; gitignored with `.userdata/`) |
| Progress photo files | `.userdata/photos/` (gitignored; metadata in `data/photos.json`) |

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
- Dashboard tabs: **Сегодня** (character, day totals, next form, weight and photos), **Календарь**, **Статистика**, **Настройки** (interval, picker mode, Focus, character build, comfort and optional-layer switches, AI imports) plus a dev-only **Debug** tab — see [ARCHITECTURE.md](ARCHITECTURE.md#core-preferences).
- Renderer routes: `#/dashboard`, `#/popup`; `#/dashboard?tab=settings` opens the settings tab directly (direct links and the tray settings action).
- After a **Готово** in the popup, streak, sessions and character survive quit/relaunch (check `.userdata/data/`).
- If the shell exports `ELECTRON_RUN_AS_NODE=1` (some editors/agents do), `electron.exe .` boots as plain Node and crashes on `electron.app`. Clear the variable for smoke runs.

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

The 320×260 popup includes a compact comic caption; expanded details use 380 px (plus 36 px for errors, capped at 420). The timer waits for «Начать». A saved result shows feedback for one second; a failed write leaves the popup retryable. Duplicate results do not count twice. Closing the popup without an answer is recorded as `skipped` at every level.

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

The approved [nine-character casting sheet](../src/assets/character/character-casting-sheet.png) now has 432 separate RGBA frames: three builds and sixteen states per character. Sources, exact prompts, the build comparison and regeneration commands live in the [character art library](../src/assets/character/README.md). Use `python scripts/cut-character-sprites.py --packs` for these packs. The runtime resolver and settings still use Desk Hulk; selecting the new packs is a separate integration step.

## Motion

Keyframes and reduced-motion overrides live in `src/styles/index.css`; popup exit timings in `src/motion.ts` — keep the CSS durations and `POPUP_EXIT_MS` in sync. The «Уменьшить анимации» switch on «Настройки» persists `settings.reduceMotion`; the main process reads it for tray frames through `TrayHandlers.isReducedMotion`, so no IPC round trip is needed.

The OS `prefers-reduced-motion` setting is honoured in the renderer only; the main process cannot read it.

## Tray icons

Frames in `electron/resources/tray/` are generated, not hand-drawn:

```bash
python scripts/build-tray-icons.py   # needs Pillow
```

The glyph is a placeholder "person stretching" mark. Replace the drawing in the script and re-run to change the tray identity; adding a state means new frames plus a `TRAY_FRAME_SPECS` entry in `electron/main/tray-icons.ts`. Frames are 32×32 PNGs — Windows scales them down for the 16 px notification area.

## Sounds

Default cue pack: `src/assets/sounds/default/*.mp3`. Settings (`sound.enabled` / `volume` / `packId`) and the gated renderer player live in `shared/domain/sounds.ts` + `src/sounds.ts`; mute/DND rules: [SOUNDS.md](SOUNDS.md). Audio remains an optional layer: a failed play is logged, never surfaced.

## Photos

The popup sends bytes; main validates JPEG/PNG/WebP up to 8 MB and writes `.userdata/photos/<id>.<ext>` plus `data/photos.json`. The renderer loads `<img src="photo://<id>">`; main's protocol resolves only known ids. The photo layer is off by default and never blocks a session result.

## AI proposals

No network call is made. The dashboard panel accepts pasted AI JSON, validates it as an `Exercise`, and only writes `data/custom-exercises.json` after «Утвердить». The picker merges the shipped catalog with approved entries; shipped ids always win. Rules: `shared/domain/ai-proposal.ts`.

## Themes

`src/styles/index.css` defines `:root[data-theme='night']` / `[data-theme='warm']` token overrides. `App.vue` mirrors `settings.themeId` onto `<html>`; no component reads the theme directly. Unknown ids normalize to `default`.

## Testing / debug

`npm test` runs the Vitest suite (domain, stores, persistence, popup/portrait, photos, AI, stats, debug panel). `npm run typecheck` includes the test project (`tsconfig.test.json`). Layout, covered areas and gaps: [TESTING.md](TESTING.md). Manual hook for end-to-end checks: tray **Напоминание сейчас** (runs the real trigger cycle).

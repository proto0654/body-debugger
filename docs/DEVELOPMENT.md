# Development

## Commands

```bash
npm run dev          # tray + dashboard (electron-vite)
npm run build
npm run preview
npm run typecheck
```

## Dependency caches (project drive only)

Heavy downloads stay on **E:**, never the system partition.

| What | Where |
|------|--------|
| npm cache | `E:/Electron/.cache/npm` ([.npmrc](../.npmrc)) |
| Electron zip cache | `E:/Electron/.cache/electron` (`electron_config_cache` / `ELECTRON_CACHE`) |
| Unpacked runtime | `node_modules/electron/dist/` |
| Chromium userData | `.userdata/` at repo root (`app.setPath` in `electron/main/index.ts`) |

Before / during Electron postinstall:

```powershell
$env:electron_config_cache = "E:\Electron\.cache\electron"
$env:ELECTRON_CACHE = "E:\Electron\.cache\electron"
```

`scripts/ensure-electron.js` (postinstall) prefers that cache and skips work if `electron.exe` already exists.

Do **not** download Electron into `%LOCALAPPDATA%\electron` or park the profile under `%APPDATA%` on `C:`.

## Windows notes

- App stays in the tray when all windows close.
- Dev menu: **Dashboard**, **Popup (dev)**, Quit. Pause / Settings are stubs.
- Renderer routes: `#/dashboard`, `#/popup`.

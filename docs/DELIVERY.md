# Delivery and updates

How testers receive new versions and how a build is identified. Phases 0–2 are implemented; phase 3 (release workflow) is planned.

## Decisions

| Topic | Decision |
|-------|----------|
| Target | Windows, per-user NSIS installer (`oneClick`, no admin rights) |
| Feed | Public GitHub release repository: [proto0654/body-debugger-releases](https://github.com/proto0654/body-debugger-releases); application code stays private |
| Update model | `electron-updater` downloads in the background and asks for a restart; it never restarts on its own |
| Channel | One `latest` feed during closed beta with plain versions (`0.2.0`, `0.2.1`); a separate `beta` channel needs its own `beta.yml` and is deferred |
| Signing | Unsigned for the beta; `publisherName` stays unset until a certificate exists, otherwise updates reject themselves |

A public release repository is required: a private one would force an access token into the client. The repository holds only artifacts, `latest.yml` and a short README; issues and wiki are disabled. Releases are empty until the first installer is published, and publishing needs an account with write access to it.

## What a build is

- `package.json` `version` is the SemVer identity the updater compares.
- The build stamp is `version` + short git commit + build date, injected by `electron-vite` `define` ([electron.vite.config.ts](../electron.vite.config.ts)) and exposed by `electron/main/build-info.ts`.
- Both are shown in **Настройки → «О программе»** and written to the log on start, so a screenshot identifies the exact build.
- `commit` is `git rev-parse --short HEAD` at build time; it degrades to `nogit` when git is unavailable.

## Current state (phases 0–2)

- Development keeps the profile at `.userdata/`; an installed build writes to `app.getPath('userData')` = `%APPDATA%\Body Debugger`, because `resources/app.asar` is read-only. `getUserDataPath()` in [lab-environment.ts](../electron/main/lab-environment.ts) owns that split.
- A packaged application takes the single-instance lock; launching it again focuses the dashboard instead of starting a second reminder loop. The development laboratory keeps its own lock.
- `electron/main/logger.ts` mirrors `console.log/warn/error` into `<userData>/logs/app.log` (one rotated file at 512 KB) and logs start/quit, so a tester can send a log without a console.
- «О программе» reads `app:get-info` and can open the log directory through `app:open-logs`.
- Packaging lives in [electron-builder.yml](../electron-builder.yml): `appId: com.bodydebugger.app` (matches `setAppUserModelId`), `productName: Body Debugger`, NSIS one-click per-user, `deleteAppDataOnUninstall: false`, GitHub publish target. Production `node_modules` are packed as-is.
- The icon is generated from the Desk Hulk happy emotion by [scripts/build-app-icon.py](../scripts/build-app-icon.py) into `electron/resources/icon.ico` (16–256 px) and a 1024 px PNG master. Do not hand-edit the icon; change the script and re-run it.
- Verified locally: silent install into `%LOCALAPPDATA%\Programs\body-debugger`, start with `packaged=true` and the profile under `%APPDATA%\Body Debugger`, second launch blocked by the lock, silent uninstall removes the program and keeps the profile.
- Electron-builder downloads (NSIS, winCodeSign) live in `E:\Electron\.cache\electron-builder` via `ELECTRON_BUILDER_CACHE`; without it they land on the system drive.

## Update behavior (phase 2)

The updater lives in [electron/main/updater.ts](../electron/main/updater.ts); scheduling rules and progress math are shared in [shared/domain/update.ts](../shared/domain/update.ts).

1. The first check runs 25 s after `app.whenReady`, then every 4 hours. A check is one request to `latest.yml`; offline or failed checks stay silent in the log, and only a manual check shows an error.
2. Download starts automatically. The «О программе» panel shows progress and offers **«Перезапустить и обновить»**; a downloaded update also installs on a normal quit (`autoInstallOnAppQuit`).
3. The restart is refused while a popup is open (`installBlocker`), so an exercise is never cut off. The tray menu and tooltip then advertise the ready version; the update installs on the next quit.
4. The updater is disabled outside a packaged build; `npm run dev` never touches the feed.
5. `quitAndInstall(true, true)` restarts silently: no installer window, then the app relaunches into the new version. The trigger loop is stopped before quitting; persistence writes are synchronous, so nothing is lost.
6. A GitHub release must be a normal release: an app on the `latest` channel ignores prereleases and drafts.

## Release flow

Local build (writes `dist/`; the script rebuilds `out/` first, so a packaged build is never stale):

```powershell
$env:ELECTRON_BUILDER_CACHE = "E:\Electron\.cache\electron-builder"
npm run build:win   # dist\Body-Debugger-Setup-<version>.exe + .blockmap + latest.yml
```

1. `npm version <next>` — bump. Keep plain versions while the `latest` channel is in use.
2. Push the `v*` tag; GitHub Actions on `windows-latest` runs `npm ci`, `typecheck`, `test`, `electron-builder --win nsis --publish always`.
3. The workflow uploads the installer, `.blockmap` and `latest.yml`; the last one is the feed the installed app compares against.
4. Publish it as a normal GitHub release (not a draft, not a prerelease), otherwise a `latest`-channel app will not see it.
5. Testers update within the check interval; release notes name the previous installer for a manual rollback.

`latest.yml` is generated locally by `npm run build:win` too, so a release can be published by hand before CI exists:

```powershell
gh release create v0.2.1 dist/Body-Debugger-Setup-0.2.1.exe dist/latest.yml dist/Body-Debugger-Setup-0.2.1.exe.blockmap --repo proto0654/body-debugger-releases
```

`v0.2.1` is the first published release (manual, unsigned). A freshly installed 0.2.1 asks the GitHub feed, gets `0.2.1` back and reports «Установлена последняя версия»; from the next version on, the same check delivers it.

## Verifying an update without a public release

Build an older version with a local feed, install it, then serve a newer build from `dist/`:

1. A throwaway config copies [electron-builder.yml](../electron-builder.yml) with `directories.output: dist-test` and `publish: { provider: generic, url: http://127.0.0.1:8788/ }`; build it and install it silently.
2. `npm version <next> && npm run build:win` produces the newer installer and `latest.yml` in `dist/`.
3. `python -m http.server 8788 --directory dist` serves the feed.
4. Start the installed app; after 25 s it downloads the new version (full download — the Python server has no `Range` support, so differential download falls back) and reports `ready`.
5. Restart from the panel or quit the app; the installer runs silently and the app relaunches into the new version. Both feed switches and user data remain in the same profile.

Verified this way on 0.2.0 → 0.2.1: detection, download, `quitAndInstall(true, true)`, relaunch, and the `app-update.yml` switch from a local feed to GitHub.

## Data safety

- A version change copies the stored JSON to `data-backup/<previousVersion>/` before the new build reads or rewrites it; the last two backups are kept ([version-backup.ts](../electron/main/persistence/version-backup.ts)). Photos are not copied — they are not part of the schema.
- Uninstall must keep the profile (`deleteAppDataOnUninstall: false`).
- The JSON envelope stays at version 1 with defaults for new fields; only additive changes are allowed without a migration.

## Status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Profile split, single instance, build stamp, log file, «О программе» | Done |
| 1 | `electron-builder` config, NSIS installer, icon, installed-build smoke test | Done — installer and `latest.yml` build locally, install/uninstall verified |
| 2 | `electron-updater` + IPC + tray/dashboard update UI + install gating | Done — download, silent restart and feed switch verified end to end |
| 3 | Release workflow, release checklist, tester instructions | Not started |
| 4 | Heartbeat, `beta`/`stable` split, code signing | Later |

# Delivery and updates

How the production app receives new versions, and how a build is identified. Daily work uses HMR; shipped use is one stable GitHub channel with client auto-update.

## Happy path (use this)

| Mode | Command / action | Updates |
|------|------------------|---------|
| Develop | `npm run dev` | Disabled (HMR only; `.userdata/`) |
| Ship | `npm run publish:prod` or CI on a stable `v*` tag | Writes `latest.yml` to [body-debugger-releases](https://github.com/proto0654/body-debugger-releases) |
| Use | Install `Body-Debugger-Setup-<version>.exe`, then update from the client | Background check ~25 s after start and every 4 h |

Do **not** use the side-by-side Dev product for ordinary work. Removing `Body Debugger Dev` / `publish:dev` / `dev.yml` is the next delivery wave — [ROADMAP.md](ROADMAP.md) #18.

## Decisions

| Topic | Decision |
|-------|----------|
| Target | Windows, per-user NSIS installer (`oneClick`, no admin rights) |
| Feed | Public GitHub release repository: [proto0654/body-debugger-releases](https://github.com/proto0654/body-debugger-releases); holds artifacts and channel manifests only |
| Source | Public source repository: [proto0654/body-debugger](https://github.com/proto0654/body-debugger) |
| Primary channel | `latest.yml` for stable prod |
| Legacy channel (to remove in #18) | `dev.yml` for prerelease `Body Debugger Dev` builds (`x.y.z-dev.N`) |
| Update model | `electron-updater` downloads in the background, shows a small prompt with progress and asks for a restart; it never restarts on its own |
| Restart gating | A restart is refused while an exercise popup is open; a downloaded update also installs on a normal quit |
| Autostart | Off by default; a settings toggle registers a per-user login item that launches the app hidden in the tray |
| Signing | Unsigned for the beta; `publisherName` stays unset until a certificate exists, otherwise updates reject themselves |

A public release repository is required: a private one would force an access token into the client. The repository holds only artifacts, channel manifests (`latest.yml`, and legacy `dev.yml`) and a short README; issues and wiki are disabled.

## Build identities

**Preferred identity:** prod only (`Body Debugger`). Unpackaged `npm run dev` still reports the unpackaged/dev identity in «О программе», but it is not a second shipped product.

**Legacy (remove in milestone 18):** prod and the side-by-side Dev app can still run at the same time without sharing data, locks, updater caches or autostart entries.

| | Prod | Dev |
|---|------|-----|
| Product name / window title | `Body Debugger` | `Body Debugger Dev` |
| `appId` (AppUserModelId) | `com.bodydebugger.app` | `com.bodydebugger.app.dev` |
| Installer | `Body-Debugger-Setup-<version>.exe` | `Body-Debugger-Dev-Setup-<version>.exe` |
| Icon | `electron/resources/icon.ico` (emerald) | `electron/resources/icon-dev.ico` (amber + DEV tag) |
| Profile | `%APPDATA%\Body Debugger` | `%APPDATA%\Body Debugger Dev` |
| Laboratory sandbox | `%APPDATA%\Body Debugger\laboratory` | `%APPDATA%\Body Debugger Dev\laboratory` |
| Updater cache | `body-debugger-updater` | `body-debugger-dev-updater` |
| Feed | stable `latest.yml` | `dev.yml` from a `-dev.N` prerelease |
| Build command | `npm run build:win` / `publish:prod` | `npm run build:dev` / `publish:dev` |
| Config | [electron-builder.yml](../electron-builder.yml) | [electron-builder.dev.yml](../electron-builder.dev.yml) |

`electron-builder.dev.yml` extends the base config and overrides `appId`, `productName`, output directory, icon and artifact names. It also sets `extraMetadata.name: body-debugger-dev` and `extraMetadata.productName: Body Debugger Dev`:

- `productName` drives `app.getName()`, the `userData` path, the window title and the login-item registry value;
- `name` drives `updaterCacheDirName`, so prod and dev never overwrite each other's downloaded installer.

Keep those two values in sync with `shared/domain/app-identity.ts`; an unpackaged run (`npm run dev`) is always treated as dev.

## What a build is

- `package.json` `version` is the SemVer identity the updater compares.
- The build stamp is `version` + short git commit + build date, injected by `electron-vite` `define` ([electron.vite.config.ts](../electron.vite.config.ts)) and exposed by `electron/main/build-info.ts`.
- Version, build stamp, channel (`стабильный` / `тестовый (dev)`), profile path and log directory are shown in **Настройки → «О программе»** and written to the log on start, so a screenshot identifies the exact build.
- `commit` is `git rev-parse --short HEAD` at build time; it degrades to `nogit` when git is unavailable.

## Identities and profiles

- Development keeps the profile at `.userdata/`; an installed build writes to `app.getPath('userData')` = `%APPDATA%\<productName>`. `getUserDataPath()` in [lab-environment.ts](../electron/main/lab-environment.ts) owns that split.
- A packaged application takes the single-instance lock per profile, so prod and dev can both run. Launching the same build again focuses its dashboard instead of starting a second reminder loop.
- The dev build writes to its own profile; prod data is never read or migrated by dev.
- `electron/main/logger.ts` mirrors `console.log/warn/error` into `<userData>/logs/app.log` (one rotated file at 512 KB) and logs start/quit, so a tester can send a log without a console.
- «О программе» reads `app:get-info` and can open the log directory through `app:open-logs`.

## Icons

The icon is generated from the Desk Hulk happy emotion by [scripts/build-app-icon.py](../scripts/build-app-icon.py), not hand-drawn:

```bash
python scripts/build-app-icon.py   # needs Pillow + NumPy
```

It writes both pairs:

- `electron/resources/icon.ico` + `icon.png` — prod, emerald ring/glow (16–256 px ICO + 1024 px PNG);
- `electron/resources/icon-dev.ico` + `icon-dev.png` — dev, amber ring/glow and a `DEV` tag.

Packaged builds embed their icon in the exe and shortcut through `win.icon`. An unpackaged `npm run dev` window uses `icon-dev.png` as its `BrowserWindow` icon. The tray glyph stays the shared animated brand mark; the dev tray tooltip is prefixed with `Dev · `.

Change the script and re-run it; do not hand-edit the `.ico` files.

## Update behavior

The updater lives in [electron/main/updater.ts](../electron/main/updater.ts); scheduling rules and progress math are shared in [shared/domain/update.ts](../shared/domain/update.ts).

1. The first check runs 25 s after `app.whenReady`, then every 4 hours. A check is one request to the channel manifest; offline or failed background checks stay silent in the log, and only a manual check shows an error.
2. Download starts automatically. On `update-available` a small always-on-top prompt opens at the bottom-right corner with the version and download percentage; it updates in place as `download-progress` arrives and becomes a **«Перезапустить и обновить»** button when the download is ready.
3. The prompt is hidden while an exercise popup is open and returns after it closes. A restart is refused while a popup is open (`installBlocker`), so an exercise is never cut off.
4. **«Позже»** (or the close button) dismisses the prompt for that version until the next run. While the download is running, closing only hides the prompt; once downloaded, the update installs on a normal quit (`autoInstallOnAppQuit`). The tray tooltip and the tray menu also advertise a ready version.
5. A manual check never starts while an update is already downloading or ready, so it cannot drop a pending restart.
6. `quitAndInstall(true, true)` restarts silently: no installer window, then the app relaunches into the new version. The trigger loop is stopped before quitting; persistence writes are synchronous, so nothing is lost.
7. The updater is disabled outside a packaged build; `npm run dev` never touches the feed.
8. The prompt never participates in the reminder/session cycle: it has a separate route (`#/update-prompt`) and window.

### Channels

- Prod runs with `allowPrerelease=false` and reads the GitHub `/releases/latest` stable release, then its `latest.yml`.
- Dev runs with `channel = "dev"` and `allowPrerelease=true`; it reads `dev.yml` from a `-dev.N` prerelease. It never sees a stable-only release as an automatic upgrade.
- A packaged build is dev when its `productName` ends with ` Dev` (`Body Debugger Dev`); an unpackaged `npm run dev` is always dev. Prod is `Body Debugger`.

### Autostart

- **Настройки → Система → «Запускать при входе в Windows»** is off by default.
- Only a packaged Windows build can change it; `npm run dev` shows the setting as unavailable.
- The login item launches the executable with `--hidden`: the tray, reminder loop and updater start, but the dashboard is not opened. A manual second launch opens the dashboard.
- The registry value name is the product title (`Body Debugger` or `Body Debugger Dev`), so both builds can have independent entries. Windows can disable the entry in Task Manager; the UI then shows a warning.
- The state lives in Windows, not in the JSON profile. No schema migration is needed.
- The NSIS uninstaller removes the product's autostart entry and keeps the profile.

## Personal use flow

> The published `0.2.1` predates the update prompt and autostart. Install `0.3.0` (or later) for the flow below; a `0.2.1` install will still update itself once `0.3.0` is published.

1. Install the latest stable installer from the release repository once (`Body-Debugger-Setup-<version>.exe`).
2. Open **Настройки → Система**, enable **«Запускать при входе в Windows»**. The app now lives in the tray and starts hidden after login.
3. When a new stable version is published, the background check finds it within the 4-hour interval, downloads it and shows the prompt with progress. Press **«Перезапустить и обновить»** — or choose **«Позже»** and quit normally, which installs it too.
4. If an exercise popup is open, the prompt waits; the update applies on the next quit at the latest.
5. Roll back by installing the previous installer manually. The updater never downgrades on its own (`allowDowngrade=false`).

## Parallel development flow

| Situation | What to run |
|-----------|-------------|
| Daily code edits | `npm run dev` — HMR, `.userdata`, updater disabled |
| Packaged prod smoke (no publish) | `npm run build:dir`, then `dist\win-unpacked\Body Debugger.exe` |
| Install / client update | Stable installer from GitHub; updates via the in-app prompt |
| Laboratory | **«Лаборатория»** in any installed or unpackaged dashboard; headless sandbox profile, lab UI mounted natively in the dashboard |
| Legacy Dev channel (until #18) | `build:dev` / `publish:dev` / `Body Debugger Dev` — optional; do not use for normal shipping |

Never publish a stable version from the legacy dev config; never install the legacy Dev build over prod.

## Release flow

### Versioning

- **Dev prerelease**: `npm version prerelease --preid dev` from the current version. If the current is `0.2.1`, this yields `0.2.2-dev.0`; repeating yields `0.2.2-dev.1`.
- **Stable**: `npm version minor` (or `patch`) from the current line. `0.3.0` first shipped the delivery pipeline; `0.4.0` first shipped the laboratory-in-dashboard line; `0.5.0` ships the native laboratory tab and shared playback engine. Current stable: `0.5.0`, published 2026-11-01; previous installer `0.4.0` for rollback.
- `npm version` creates a commit and a `v*` tag. Keep the working tree clean; the publish script refuses a dirty tree.

### Local publish

```powershell
$env:ELECTRON_BUILDER_CACHE = "E:\Electron\.cache\electron-builder"
$env:GH_TOKEN = "<token with contents:write on body-debugger-releases>"

npm run publish:dev    # dev.yml + prerelease release
npm run publish:prod   # latest.yml + normal release
```

`scripts/publish-build.mjs` validates the channel against the version, requires `GH_TOKEN`/`GITHUB_TOKEN`, rebuilds `out/`, runs electron-builder with `--publish never` and uploads one complete asset set (`installer`, `.blockmap`, `dev.yml`/`latest.yml`) with `gh release create`/`gh release upload`. The config `publish` block still defines the updater feed written into `app-update.yml`. electron-builder's own GitHub publisher is intentionally not used: it created the same release twice from concurrent artifact tasks, which left `dev.yml` and the blockmap out of the release.

The stable command produces `dist\Body-Debugger-Setup-<version>.exe`, `.blockmap` and `latest.yml`. The dev command produces the same set in `dist-dev\` and `dev.yml` **when the version contains `-dev.N`**; a stable-version dev build is only a local identity smoke and is rejected by `publish:dev`. `npm run build:win` and `npm run build:dev` build installers without publishing.

The dev config also pins `publish.releaseType: prerelease` and `publish.channel: dev`, so even a manual publish cannot create a normal stable release from the dev product.

### CI

`.github/workflows/release.yml` runs on a `v*` tag on `windows-latest`:

1. `npm ci`, `npm run typecheck`, `npm test`;
2. verifies that the tag equals `v${package.json.version}`;
3. chooses `dev` when the tag contains `-`, otherwise `prod`;
4. runs `node scripts/publish-build.mjs <channel>` with `GH_TOKEN` from `secrets.RELEASE_TOKEN`;
5. uploads `dist/` / `dist-dev/` as artifacts.

CI runs from the public source repository [proto0654/body-debugger](https://github.com/proto0654/body-debugger) and needs a `RELEASE_TOKEN` secret: a fine-grained PAT with `Contents: Read and write` on `proto0654/body-debugger-releases`. Until the secret exists, it is dormant; the local `publish:*` commands are the primary path. The CI job overrides the repo-local `E:` npm cache with a workspace-local `.npm-cache`; `scripts/ensure-electron.js` also falls back to the temp directory when `E:` is unavailable.

Publish the release as a normal release (stable) or a prerelease (dev), never as a draft for the `latest` channel. Release notes should name the previous installer for a manual rollback.

## Verifying an update without a public release

Build an older version with a local feed, install it, then serve a newer build from `dist/`:

1. A throwaway config copies [electron-builder.yml](../electron-builder.yml) with `directories.output: dist-test` and `publish: { provider: generic, url: http://127.0.0.1:8788/ }`; build it and install it silently.
2. `npm version <next> && npm run build:win` produces the newer installer and `latest.yml` in `dist/`.
3. `python -m http.server 8788 --directory dist` serves the feed.
4. Start the installed app; after 25 s it downloads the new version (full download — the Python server has no `Range` support, so differential download falls back) and shows the update prompt with progress.
5. Restart from the prompt or quit the app; the installer runs silently and the app relaunches into the new version. Both feed switches and user data remain in the same profile.

Verified this way before the prompt existed on `0.2.0 → 0.2.1`: detection, download, `quitAndInstall(true, true)`, relaunch and the `app-update.yml` switch from a local feed to GitHub. The native dev-channel check below then verified the prompt end to end on `0.2.2-dev.0 → 0.2.2-dev.3`: progress, ready state, `quitAndInstall`, silent install and relaunch into the new version.

### Native dev-channel check

1. `npm version prerelease --preid dev` → `0.2.2-dev.0`.
2. `npm run build:dev`, install `dist-dev\Body-Debugger-Dev-Setup-0.2.2-dev.0.exe`.
3. `npm version prerelease --preid dev` → `0.2.2-dev.1`; `npm run publish:dev`.
4. Start the installed dev app and wait for the first check (25 s). The prompt should show progress, survive a dismissed popup-safe restart and install `0.2.2-dev.1`.
5. Confirm an installed stable `0.2.1` never sees `0.2.2-dev.*`.

## Data safety

- A version change copies the stored JSON to `data-backup/<previousVersion>/` before the new build reads or rewrites it; the last two backups are kept ([version-backup.ts](../electron/main/persistence/version-backup.ts)). Photos are not copied — they are not part of the schema.
- Prod and dev keep separate profiles, so a dev update never rewrites prod data.
- Uninstall must keep the profile (`deleteAppDataOnUninstall: false`) and remove only the autostart entry.
- The JSON envelope stays at version 1 with defaults for new fields; only additive changes are allowed without a migration. This work adds no profile fields.

## Status

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Profile split, single instance, build stamp, log file, «О программе» | Done |
| 1 | `electron-builder` config, NSIS installer, icon, installed-build smoke test | Done |
| 2 | `electron-updater` + IPC + tray/dashboard update UI + install gating | Done |
| 3 | Release workflow, release checklist, tester instructions | Done — local scripts, CI workflow, personal/parallel/test flows documented; CI activates once `RELEASE_TOKEN` is configured on the public source repo |
| 4 | Dev prerelease channel, update prompt with progress, autostart | Implemented and partly verified — packaged prod/dev identity, dev installer/uninstall, `dev.yml`, `channel: dev`, `body-debugger-dev-updater`, prompt download/restart and stable `0.3.0` install were verified locally; the autostart toggle remains in the manual checklist |
| 5 | Heartbeat, `beta`/`stable` split, code signing | Later |

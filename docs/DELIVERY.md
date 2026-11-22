# Delivery and updates

How the production app receives new versions, and how a build is identified. Daily work uses HMR; shipped use is one stable GitHub channel with client auto-update.

## Happy path (use this)

| Mode | Command / action | Updates |
|------|------------------|---------|
| Develop | `npm run dev` | Disabled (HMR only; `.userdata/`) |
| Ship | `npm run publish:prod` or CI on a stable `v*` tag | Writes Windows `latest.yml`, then Mac `latest-mac.yml` + zip and Linux `latest-linux.yml` + AppImage to [body-debugger-releases](https://github.com/proto0654/body-debugger-releases) |
| Use (Windows) | Install `Body-Debugger-Setup-<version>.exe`, then update from the client | Background check ~25 s after start and every 1 h |
| Use (Mac) | Download `Body-Debugger-<version>-mac-arm64.zip`, clear quarantine once, then update from the client | Same prompt; install swaps the `.app` (no Apple Developer ID) |
| Use (Linux, local) | `node scripts/publish-build.mjs prod linux` (or the CI job) publishes the AppImage; run it from a writable directory | In place, from the same prompt — only while the app runs from the AppImage itself |

Do **not** use the side-by-side Dev product for ordinary work. Removing `Body Debugger Dev` / `publish:dev` / `dev.yml` is the next delivery wave — [ROADMAP.md](ROADMAP.md) #18.

## Decisions

| Topic | Decision |
|-------|----------|
| Target | Windows per-user NSIS (`oneClick`, no admin), macOS Apple Silicon zip (ad-hoc signed, not notarized) and a portable Linux x64 AppImage for local use |
| Feed | Public GitHub release repository: [proto0654/body-debugger-releases](https://github.com/proto0654/body-debugger-releases); holds artifacts and channel manifests only |
| Source | Public source repository: [proto0654/body-debugger](https://github.com/proto0654/body-debugger) |
| Primary channel | `latest.yml` (Windows) and `latest-mac.yml` (Mac) for stable prod |
| Legacy channel (to remove in #18) | `dev.yml` / `dev-mac.yml` for prerelease `Body Debugger Dev` builds (`x.y.z-dev.N`) |
| Update model | `electron-updater` downloads in the background, shows a small prompt with progress and asks for a restart; it never restarts on its own. Windows installs via NSIS; Mac swaps the `.app` after quit because Squirrel.Mac requires a Developer ID |
| Restart gating | A restart is refused while an exercise popup is open; a downloaded update also installs on a normal quit. Mac refuses the swap when the app still lives under App Translocation or a read-only folder |
| Autostart | Off by default; a settings toggle registers a per-user login item that launches the app hidden in the tray (Windows only today) |
| Linux updates | `latest-linux.yml` feeds `electron-updater`, which replaces the AppImage in place — but only when the process runs from that file (`APPIMAGE` env) in a writable directory. An unpacked copy (`dist/linux-unpacked`, a hand-copied directory) logs `APPIMAGE env is not defined` and never updates |
| Linux install | `node scripts/publish-build.mjs prod linux` uploads the AppImage onto the existing release (it never creates one); `npm run build:linux` builds without uploading, and `dist/linux-unpacked/` runs as-is. The AppImage needs FUSE 2 (`libfuse.so.2`, Arch: `fuse2`) or `--appimage-extract-and-run` |
| Signing | Unsigned Windows beta (`publisherName` unset). Mac uses ad-hoc `identity: "-"` so arm64 launches; Gatekeeper needs a one-time `xattr` clear on first open |

A public release repository is required: a private one would force an access token into the client. The repository holds only artifacts, channel manifests (`latest.yml`, and legacy `dev.yml`) and a short README; issues and wiki are disabled.

## Build identities

**Preferred identity:** prod only (`Body Debugger`). Unpackaged `npm run dev` still reports the unpackaged/dev identity in «О программе», but it is not a second shipped product.

**Legacy (remove in milestone 18):** prod and the side-by-side Dev app can still run at the same time without sharing data, locks, updater caches or autostart entries.

| | Prod | Dev |
|---|------|-----|
| Product name / window title | `Body Debugger` | `Body Debugger Dev` |
| `appId` (AppUserModelId) | `com.bodydebugger.app` | `com.bodydebugger.app.dev` |
| Windows installer | `Body-Debugger-Setup-<version>.exe` | `Body-Debugger-Dev-Setup-<version>.exe` |
| Mac zip | `Body-Debugger-<version>-mac-arm64.zip` | `Body-Debugger-Dev-<version>-mac-arm64.zip` |
| Linux AppImage | `Body-Debugger-<version>-linux-x86_64.AppImage` | — |
| Icon | `electron/resources/icon.ico` / `icon.png` (emerald) | `electron/resources/icon-dev.ico` / `icon-dev.png` (amber + DEV tag) |
| Profile | `%APPDATA%\Body Debugger` / `~/Library/Application Support/Body Debugger` | `%APPDATA%\Body Debugger Dev` / `~/Library/Application Support/Body Debugger Dev` |
| Laboratory sandbox | `%APPDATA%\Body Debugger\laboratory` | `%APPDATA%\Body Debugger Dev\laboratory` |
| Updater cache | `body-debugger-updater` | `body-debugger-dev-updater` |
| Feed | stable `latest.yml` + `latest-mac.yml` | `dev.yml` + `dev-mac.yml` from a `-dev.N` prerelease |
| Build command | `npm run build:win` / `build:mac` / `publish:prod` | `npm run build:dev` / `publish:dev` |
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

Packaged builds embed their icon in the exe and shortcut through `win.icon`. An unpackaged `npm run dev` window starts from `icon-dev.png`, then the running dashboard button and the tray both switch to the character face with a green countdown ring. The dev tray tooltip is prefixed with `Dev · `.

**Packaged taskbar ring:** Windows groups a Start-menu / desktop shortcut with the process AppUserModelId and keeps that static `icon.ico` on the taskbar button, so a plain `BrowserWindow.setIcon(NativeImage)` is ignored even though the same call works in unpackaged dev. `electron/main/tray-portrait.ts` gives the dashboard window a live-scoped AUMID (`{appId}.live`) once via `setAppDetails`, then reapplies the painted portrait (including the countdown ring) with `setIcon`. The process-level AUMID in `index.ts` stays unchanged for notifications and the installer shortcut.

Change the script and re-run it; do not hand-edit the `.ico` files.

## Update behavior

The updater lives in [electron/main/updater.ts](../electron/main/updater.ts); scheduling rules and progress math are shared in [shared/domain/update.ts](../shared/domain/update.ts).

1. The first check runs 25 s after `app.whenReady`, then every hour. A check is one request to the channel manifest; offline or failed background checks stay silent in the log, and only a manual check shows an error.
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
3. When a new stable version is published, the background check finds it within the hourly interval, downloads it and shows the prompt with progress. Press **«Перезапустить и обновить»** — or choose **«Позже»** and quit normally, which installs it too.
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
- **Stable**: `npm version minor` (or `patch`) from the current line. `0.3.0` first shipped the delivery pipeline; `0.4.0` first shipped the laboratory-in-dashboard line; `0.5.0` ships the native laboratory tab and shared playback engine; `0.6.0` ships Catalog V2 (Zone×Method picker, dose, «Упражнения», optional LLM changesets); `0.7.0` ships Catalog UI (library, playground, preference board, next-breaks queue); `0.7.1` caps empty-cell LLM generate (≤24, 120 s) and surfaces provider errors; `0.7.2` restores the live countdown ring on the packaged Windows taskbar. Current Windows stable: `0.8.0`, published 2026-11-14 from commit `bd80141`; previous installer `0.7.2` for rollback. The `0.8.0` macOS assets have not yet been published.
- `npm version` creates a commit and a `v*` tag. Keep the working tree clean; the publish script refuses a dirty tree.

### Local publish

```powershell
$env:ELECTRON_BUILDER_CACHE = "E:\Electron\.cache\electron-builder"
$env:GH_TOKEN = "<token with contents:write on body-debugger-releases>"

npm run publish:dev    # Windows: dev.yml + prerelease release
npm run publish:prod   # Windows: latest.yml + normal release
# On macOS, after the Windows assets exist for the same tag:
node scripts/publish-build.mjs prod mac
```

`scripts/publish-build.mjs <channel> [win|mac]` validates the channel against the version, requires `GH_TOKEN`/`GITHUB_TOKEN`, rebuilds `out/`, runs electron-builder with `--publish never` and uploads assets with `gh release create`/`gh release upload`. `win` (default) creates the release when needed. `mac` only uploads onto an existing tag and appends the first-launch Gatekeeper note. The config `publish` block still defines the updater feed written into `app-update.yml`. electron-builder's own GitHub publisher is intentionally not used: it created the same release twice from concurrent artifact tasks, which left `dev.yml` and the blockmap out of the release.

The stable Windows command produces `dist\Body-Debugger-Setup-<version>.exe`, `.blockmap` and `latest.yml`. The Mac command produces `dist/Body-Debugger-<version>-mac-arm64.zip` and `latest-mac.yml`. The dev channel produces the same sets in `dist-dev\` with `dev.yml` / `dev-mac.yml` **when the version contains `-dev.N`**. `npm run build:win`, `npm run build:mac` and `npm run build:dev` build without publishing.

The dev config also pins `publish.releaseType: prerelease` and `publish.channel: dev`, so even a manual publish cannot create a normal stable release from the dev product.

### First Mac install

1. Download `Body-Debugger-<version>-mac-arm64.zip` from the release.
2. Unzip and move `Body Debugger.app` into `/Applications`.
3. Clear quarantine once:

```bash
xattr -dr com.apple.quarantine "/Applications/Body Debugger.app"
```

4. Open the app. Later versions install from the same update prompt as Windows; the client swaps the `.app` after «Перезапустить» or on quit. If the app was never moved out of Downloads (App Translocation), the prompt asks to move it into Applications first.

### Linux (AppImage)

Linux ships a portable x64 AppImage on the same release tag as Windows and macOS. Because the updater replaces the AppImage file in place, the channel only works for a build that runs **from** that file.

```bash
npm run build:linux                          # dist/Body-Debugger-<version>-linux-x86_64.AppImage + latest-linux.yml
node scripts/publish-build.mjs prod linux    # upload onto the existing release (needs GH_TOKEN)
```

- The `linux:` block in [electron-builder.yml](../electron-builder.yml) sets the executable name, the `Utility` category, a 1024 px icon and the `.desktop` `Name` / `Comment`. The embedded entry also carries `StartupWMClass=Body Debugger`, so a launcher groups the running window with its icon. [electron-builder.dev.yml](../electron-builder.dev.yml) has its own block for `Body-Debugger-Dev-…-linux-x86_64.AppImage` and `dev-linux.yml`.
- `publish-build.mjs … linux` uploads onto an **existing** release, like `mac`: the Windows job creates the tag, the Mac and Linux jobs only append their assets and their install-note section. It refuses to run outside Linux.
- The AppImage needs FUSE 2 (`fuse2` on Arch). Without it, either install the package or run `--appimage-extract-and-run`.
- `dist/linux-unpacked/body-debugger` runs without FUSE and is the faster loop for a packaged smoke test — but it can never auto-update, because `APPIMAGE` is unset.
- Updates behave like the other platforms while the app runs from a writable AppImage: the same bottom-right prompt, download, restart gate during a popup, and in-place replacement on quit. No code signing on Linux — integrity comes from the sha512 in `latest-linux.yml`.
- What a Linux build does **not** have: autostart (`launch-at-login` is Windows-only), the tray pin and the live tray portrait repaint (both win32-only). Everything else — reminder loop, popup, dashboard, sounds, persistence — works.
- Window placement is the compositor's job on Wayland: the popup cannot position itself, so a Hyprland/Omarchy desktop needs one window rule for it. The popup window keeps a fixed title, `Body Debugger Popup`, for exactly that match — see [DEVELOPMENT.md](DEVELOPMENT.md#linux-notes).

### CI

`.github/workflows/release.yml` runs on a `v*` tag:

1. **windows-latest** — `npm ci`, typecheck, test; verifies the tag equals `v${package.json.version}`; chooses `dev` when the tag contains `-`, otherwise `prod`; runs `node scripts/publish-build.mjs <channel> win` with `GH_TOKEN` from `secrets.RELEASE_TOKEN`; uploads Windows artifacts.
2. **macos-latest** (after the Windows job) — `npm ci`; runs `node scripts/publish-build.mjs <channel> mac`; uploads the arm64 zip and `*-mac.yml`. A Mac failure leaves the Windows release in place.
3. **ubuntu-latest** (after the Mac job, so two jobs never edit the release body at once) — `npm ci`; runs `node scripts/publish-build.mjs <channel> linux`; uploads the AppImage and `*-linux.yml`.

CI runs from the public source repository [proto0654/body-debugger](https://github.com/proto0654/body-debugger) and needs a `RELEASE_TOKEN` secret: a fine-grained PAT with `Contents: Read and write` on `proto0654/body-debugger-releases`. Until the secret exists, it is dormant; the local `publish:*` commands are the primary path. The Windows job overrides the repo-local `E:` npm cache with a workspace-local `.npm-cache`; `scripts/ensure-electron.js` also falls back to the temp directory when `E:` is unavailable.

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

/**
 * Replace the running unsigned Mac .app with a downloaded zip without Squirrel.
 * A detached shell waits for this process to exit, then ditto-swaps the bundle.
 */
import { spawn } from 'node:child_process'
import { accessSync, constants, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  macUpdateInstallGate,
  type MacUpdateInstallGate
} from '../../shared/domain/mac-update'
import { logError, logInfo } from './logger'

const INSTALL_SCRIPT = `#!/bin/bash
set -euo pipefail
ZIP="$1"
APP="$2"
PID="$3"
while kill -0 "$PID" 2>/dev/null; do
  sleep 0.2
done
sleep 0.5
EXTRACT="$(mktemp -d)"
cleanup() { rm -rf "$EXTRACT"; }
trap cleanup EXIT
ditto -x -k "$ZIP" "$EXTRACT"
NEW_APP="$(find "$EXTRACT" -name "*.app" -type d -maxdepth 3 | head -n 1)"
if [ -z "$NEW_APP" ]; then
  echo "mac update zip has no .app" >&2
  exit 1
fi
xattr -dr com.apple.quarantine "$NEW_APP" || true
rm -rf "$APP"
ditto "$NEW_APP" "$APP"
xattr -dr com.apple.quarantine "$APP" || true
open "$APP"
`

function parentWritable(appPath: string): boolean {
  try {
    accessSync(dirname(appPath), constants.W_OK)
    return true
  } catch {
    return false
  }
}

export function resolveMacUpdateInstallGate(execPath: string = process.execPath): MacUpdateInstallGate {
  const probe = macUpdateInstallGate({ execPath, parentWritable: true })
  if (!probe.ok) return probe
  return macUpdateInstallGate({
    execPath,
    parentWritable: parentWritable(probe.appPath)
  })
}

let installStarted = false

export function macUpdateInstallInFlight(): boolean {
  return installStarted
}

/**
 * Spawns the post-quit swap and returns whether it started. Callers must quit
 * the app shortly after a successful start so the shell can replace the bundle.
 */
export function startMacAppSwap(input: {
  zipPath: string
  execPath?: string
  pid?: number
}): { started: true } | { started: false; reason: 'not-relocated' | 'already-started' } {
  if (installStarted) return { started: false, reason: 'already-started' }
  if (process.platform !== 'darwin') return { started: false, reason: 'not-relocated' }

  const gate = resolveMacUpdateInstallGate(input.execPath ?? process.execPath)
  if (!gate.ok) {
    logInfo('updater', `mac swap refused: ${gate.reason}`)
    return { started: false, reason: 'not-relocated' }
  }

  try {
    const dir = mkdtempSync(join(tmpdir(), 'body-debugger-mac-update-'))
    const scriptPath = join(dir, 'install.sh')
    writeFileSync(scriptPath, INSTALL_SCRIPT, { mode: 0o755 })
    const child = spawn(
      '/bin/bash',
      [scriptPath, input.zipPath, gate.appPath, String(input.pid ?? process.pid)],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()
    installStarted = true
    logInfo('updater', `mac swap started for ${gate.appPath}`)
    return { started: true }
  } catch (cause) {
    logError('updater', 'mac swap failed to start', cause)
    return { started: false, reason: 'not-relocated' }
  }
}

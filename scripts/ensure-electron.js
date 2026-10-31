/**
 * Ensures the Electron binary is present. Locally the zip cache stays on the
 * project drive (E:); CI has no E: drive, so it falls back to the runner temp
 * directory instead of failing the install.
 */
const { existsSync, mkdirSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')
const { spawnSync } = require('child_process')

const exe = join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
if (existsSync(exe)) {
  process.exit(0)
}

function resolveCacheRoot() {
  const preferred = process.env.electron_config_cache || 'E:/Electron/.cache/electron'
  try {
    mkdirSync(preferred, { recursive: true })
    return preferred
  } catch (cause) {
    const fallback = join(tmpdir(), 'body-debugger-electron-cache')
    mkdirSync(fallback, { recursive: true })
    console.warn(
      `[ensure-electron] cache ${preferred} is unavailable (${cause.code || cause.message}); using ${fallback}`
    )
    return fallback
  }
}

const cacheRoot = resolveCacheRoot()
process.env.electron_config_cache = cacheRoot
process.env.ELECTRON_CACHE = cacheRoot
if (!process.env.ELECTRON_MIRROR && !process.env.CI) {
  process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
}

const installJs = join(__dirname, '..', 'node_modules', 'electron', 'install.js')
if (!existsSync(installJs)) {
  console.warn('[ensure-electron] electron package missing; skip')
  process.exit(0)
}

console.log('[ensure-electron] installing binary with cache at', cacheRoot)
const result = spawnSync(process.execPath, [installJs], {
  stdio: 'inherit',
  env: process.env,
  shell: false
})
process.exit(result.status ?? 1)

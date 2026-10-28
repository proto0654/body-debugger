/**
 * Ensures Electron binary is present under the project drive (E:),
 * never downloading into the system-partition default cache.
 */
const { existsSync, mkdirSync } = require('fs')
const { join } = require('path')
const { spawnSync } = require('child_process')

const exe = join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
if (existsSync(exe)) {
  process.exit(0)
}

const cacheRoot = process.env.electron_config_cache || 'E:/Electron/.cache/electron'
mkdirSync(cacheRoot, { recursive: true })

process.env.electron_config_cache = cacheRoot
process.env.ELECTRON_CACHE = cacheRoot
if (!process.env.ELECTRON_MIRROR) {
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

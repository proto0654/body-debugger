/**
 * Starts electron-vite with `ELECTRON_RUN_AS_NODE` removed.
 *
 * Agent shells and some editors export that variable. Electron then boots as
 * plain Node and crashes on `electron.app` before the app is ready. The npm
 * `dev` script goes through this wrapper; a direct `electron.exe .` or a
 * packaged launch still needs the caller to clear the variable.
 */
const { spawn } = require('node:child_process')
const { dirname, join } = require('node:path')

const packagePath = require.resolve('electron-vite/package.json')
const packageJson = require(packagePath)
const cli = join(dirname(packagePath), packageJson.bin['electron-vite'])

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const args = [cli, 'dev']
const child = spawn(process.execPath, args, { stdio: 'inherit', env, windowsHide: false })
child.once('error', (error) => {
  console.error('[dev] failed to start electron-vite', error)
  process.exit(1)
})
child.once('exit', (code) => process.exit(code ?? 1))

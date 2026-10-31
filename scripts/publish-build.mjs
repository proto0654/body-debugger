#!/usr/bin/env node
/**
 * Build and publish a Body Debugger release.
 *
 *   node scripts/publish-build.mjs prod   # stable latest.yml from a plain version
 *   node scripts/publish-build.mjs dev    # prerelease dev.yml from x.y.z-dev.N
 *
 * electron-builder only builds the installer and update manifest here. The
 * upload is a single `gh release create/upload`, because electron-builder's
 * GitHub publisher creates the release twice when several artifacts are
 * uploaded concurrently.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const RELEASE_REPO = 'proto0654/body-debugger-releases'
const CHANNELS = new Set(['prod', 'dev'])

function run(command, args, env) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    // .cmd shims on Windows need the shell; the arguments are fixed paths here.
    shell: process.platform === 'win32'
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function fail(message) {
  console.error(`\n[publish] ${message}`)
  process.exit(1)
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  return !result.error && result.status === 0
}

const channel = process.argv[2]
if (!CHANNELS.has(channel)) fail('usage: node scripts/publish-build.mjs prod|dev')

const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = String(packageJson.version ?? '')
const prerelease = version.includes('-')
const devVersion = /^\d+\.\d+\.\d+-dev\.\d+$/.test(version)

if (channel === 'dev' && !devVersion) {
  fail(`dev releases need an x.y.z-dev.N version (current ${version}); run: npm version prerelease --preid dev`)
}
if (channel === 'prod' && prerelease) {
  fail(`prod releases need a stable version (current ${version}); run: npm version minor|patch`)
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token) fail('GH_TOKEN (or GITHUB_TOKEN) is required to publish to the release repository')
process.env.GH_TOKEN = token
if (!commandExists('gh')) fail('the GitHub CLI (gh) is required to create the release and upload assets')

const status = spawnSync('git', ['status', '--porcelain'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32'
})
if (status.error) fail(status.error.message)
if (status.stdout.trim()) fail('the working tree is not clean; commit the release first')

const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32'
}).stdout?.trim() || 'nogit'

const env = {
  ...process.env,
  GH_TOKEN: token,
  // The beta is unsigned; never try to discover a local certificate in CI.
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'
}
if (channel === 'dev') {
  env.EP_PRE_RELEASE = 'true'
  delete env.EP_DRAFT
} else {
  delete env.EP_PRE_RELEASE
  delete env.EP_PRELEASE
  delete env.EP_DRAFT
}

const config = channel === 'dev' ? 'electron-builder.dev.yml' : 'electron-builder.yml'
const outputDir = join(ROOT, channel === 'dev' ? 'dist-dev' : 'dist')
const artifactStem = channel === 'dev' ? 'Body-Debugger-Dev-Setup' : 'Body-Debugger-Setup'
const manifestName = channel === 'dev' ? 'dev.yml' : 'latest.yml'
const tag = `v${version}`
const title = channel === 'dev' ? 'Body Debugger Dev' : 'Body Debugger'

console.log(`[publish] channel=${channel} version=${version} commit=${commit} config=${config}`)

run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], env)
run(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    '--no-install',
    'electron-builder',
    '--config',
    config,
    '--win',
    'nsis',
    // The upload is done below with one gh call; electron-builder must not
    // create the same GitHub release concurrently from two artifact tasks.
    '--publish',
    'never'
  ],
  env
)

const artifacts = [
  join(outputDir, `${artifactStem}-${version}.exe`),
  join(outputDir, `${artifactStem}-${version}.exe.blockmap`),
  join(outputDir, manifestName)
]
for (const file of artifacts) {
  if (!existsSync(file)) fail(`expected release asset is missing: ${file}`)
}

const view = spawnSync('gh', ['release', 'view', tag, '--repo', RELEASE_REPO], {
  cwd: ROOT,
  env,
  stdio: 'ignore',
  shell: process.platform === 'win32'
})
if (view.error) fail(view.error.message)
const releaseExists = view.status === 0

const notes = channel === 'dev'
  ? `Dev build ${version}. Channel: dev; stable installs ignore this prerelease.`
  : `Stable build ${version}. Installs from the latest channel update to this version.`

if (releaseExists) {
  console.log(`[publish] release ${tag} exists; uploading/replacing assets`)
  run(
    'gh',
    ['release', 'upload', tag, ...artifacts, '--repo', RELEASE_REPO, '--clobber'],
    env
  )
} else {
  const args = [
    'release',
    'create',
    tag,
    ...artifacts,
    '--repo',
    RELEASE_REPO,
    '--title',
    `${title} ${version}`,
    '--notes',
    notes
  ]
  if (channel === 'dev') args.push('--prerelease')
  else args.push('--latest')
  run('gh', args, env)
}

console.log(
  [`\n[publish] done: ${channel} ${tag} (${commit})`, `assets: ${artifacts.map(file => file.replace(ROOT + '\\', '')).join(', ')}`].join('\n')
)

#!/usr/bin/env node
/**
 * Build and publish a Body Debugger release.
 *
 *   node scripts/publish-build.mjs prod [win|mac]
 *   node scripts/publish-build.mjs dev  [win|mac]
 *
 * `win` (default) creates or updates the GitHub release with the NSIS installer
 * and `latest.yml` / `dev.yml`. `mac` uploads the Apple Silicon zip and
 * `latest-mac.yml` / `dev-mac.yml` onto that existing release; it never creates
 * a second release. Mac builds must run on macOS.
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
const PLATFORMS = new Set(['win', 'mac'])
const GH = process.platform === 'win32' ? 'gh.exe' : 'gh'

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

/** gh is a native executable, so keep its arguments intact (titles contain spaces). */
function runGh(args, env) {
  console.log(`\n> gh ${args.join(' ')}`)
  const result = spawnSync(GH, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: false
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
    shell: false
  })
  return !result.error && result.status === 0
}

function ghCapture(args, env) {
  const result = spawnSync(GH, args, {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    shell: false
  })
  if (result.error) fail(result.error.message)
  if (result.status !== 0) {
    fail(`gh ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`)
  }
  return result.stdout ?? ''
}

const channel = process.argv[2]
const platform = process.argv[3] ?? 'win'
if (!CHANNELS.has(channel) || !PLATFORMS.has(platform)) {
  fail('usage: node scripts/publish-build.mjs prod|dev [win|mac]')
}

if (platform === 'mac' && process.platform !== 'darwin') {
  fail('mac releases must be built on macOS (Apple Silicon CI or a Mac)')
}

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
if (!commandExists(GH)) fail('the GitHub CLI (gh) is required to create the release and upload assets')

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
const tag = `v${version}`
const title = channel === 'dev' ? 'Body Debugger Dev' : 'Body Debugger'

const winArtifactStem = channel === 'dev' ? 'Body-Debugger-Dev-Setup' : 'Body-Debugger-Setup'
const macArtifactStem = channel === 'dev' ? 'Body-Debugger-Dev' : 'Body-Debugger'
const winManifestName = channel === 'dev' ? 'dev.yml' : 'latest.yml'
const macManifestName = channel === 'dev' ? 'dev-mac.yml' : 'latest-mac.yml'

console.log(`[publish] channel=${channel} platform=${platform} version=${version} commit=${commit} config=${config}`)

run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], env)

const builderArgs = [
  '--no-install',
  'electron-builder',
  '--config',
  config,
  // The upload is done below with one gh call; electron-builder must not
  // create the same GitHub release concurrently from two artifact tasks.
  '--publish',
  'never'
]
if (platform === 'win') {
  builderArgs.push('--win', 'nsis')
} else {
  builderArgs.push('--mac', 'zip', '--arm64')
}

run(process.platform === 'win32' ? 'npx.cmd' : 'npx', builderArgs, env)

const artifacts = platform === 'win'
  ? [
      join(outputDir, `${winArtifactStem}-${version}.exe`),
      join(outputDir, `${winArtifactStem}-${version}.exe.blockmap`),
      join(outputDir, winManifestName)
    ]
  : [
      join(outputDir, `${macArtifactStem}-${version}-mac-arm64.zip`),
      join(outputDir, macManifestName)
    ]

for (const file of artifacts) {
  if (!existsSync(file)) fail(`expected release asset is missing: ${file}`)
}

const view = spawnSync(GH, ['release', 'view', tag, '--repo', RELEASE_REPO], {
  cwd: ROOT,
  env,
  stdio: 'ignore',
  shell: false
})
if (view.error) fail(view.error.message)
const releaseExists = view.status === 0

const baseNotes = channel === 'dev'
  ? `Dev build ${version}. Channel: dev; stable installs ignore this prerelease.`
  : `Stable build ${version}. Installs from the latest channel update to this version.`

const macZipName = `${macArtifactStem}-${version}-mac-arm64.zip`
const macInstallNote = [
  '',
  '### macOS (Apple Silicon)',
  `Download \`${macZipName}\`, unzip, move \`Body Debugger.app\` into Applications, then clear Gatekeeper quarantine once:`,
  '```bash',
  `xattr -dr com.apple.quarantine "/Applications/Body Debugger${channel === 'dev' ? ' Dev' : ''}.app"`,
  '```',
  'Later versions install from the in-app update prompt (no App Store).'
].join('\n')

if (platform === 'mac') {
  if (!releaseExists) {
    fail(`release ${tag} does not exist yet; publish the Windows assets first`)
  }
  console.log(`[publish] release ${tag} exists; uploading Mac assets`)
  runGh(['release', 'upload', tag, ...artifacts, '--repo', RELEASE_REPO, '--clobber'], env)

  const currentBody = ghCapture(
    ['release', 'view', tag, '--repo', RELEASE_REPO, '--json', 'body', '--jq', '.body'],
    env
  ).replace(/\r\n/g, '\n').trimEnd()
  if (!currentBody.includes('### macOS (Apple Silicon)')) {
    const nextBody = `${currentBody || baseNotes}${macInstallNote}\n`
    runGh(['release', 'edit', tag, '--repo', RELEASE_REPO, '--notes', nextBody], env)
  }
} else if (releaseExists) {
  console.log(`[publish] release ${tag} exists; uploading/replacing assets`)
  runGh(['release', 'upload', tag, ...artifacts, '--repo', RELEASE_REPO, '--clobber'], env)
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
    baseNotes
  ]
  if (channel === 'dev') args.push('--prerelease')
  else args.push('--latest')
  runGh(args, env)
}

console.log(
  [
    `\n[publish] done: ${channel} ${platform} ${tag} (${commit})`,
    `assets: ${artifacts.map(file => file.replace(ROOT + '\\', '').replace(ROOT + '/', '')).join(', ')}`
  ].join('\n')
)

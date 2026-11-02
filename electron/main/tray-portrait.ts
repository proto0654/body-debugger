import { app, nativeImage } from 'electron'
import type { BrowserWindow, NativeImage } from 'electron'
import type { CharacterBuild } from '../../shared/types/character'
import type { TrayState } from '../../shared/types/events'
import { characterFaceCandidates, CHARACTER_EMOJI_FRAME, frameBuild } from '../../shared/domain/character-visual'
import { normalizeCharacterPackId } from '../../shared/constants/character-packs'
import {
  TRAY_BLINK_MS,
  TRAY_RING_STEPS,
  TRAY_WARNING_MS,
  trayFaceEmotion,
  trayRingColor,
  trayRingFill,
  trayRingPhase,
  trayRingStep,
  trayWaitLabel
} from '../../shared/domain/tray-countdown'
import { composeTrayIcon, cropHeadSquare, trayIconMetrics, type BgraImage } from '../../shared/domain/tray-icon-bitmap'
import { APP_IDENTITY } from './app-identity'
import { getDashboardWindow, onDashboardCreated } from './windows/dashboard'
import { hasTray, setTrayDetail, setTrayImage } from './tray'

const TRAY_SIZES = [16, 20, 24, 32] as const
/** Master size for the dashboard taskbar button; extras cover common DPI scales. */
const TASKBAR_SIZES = [64, 32, 48, 16, 24] as const

const faceAssets = {
  ...import.meta.glob<string>(
    '../../src/assets/character/*/frames/emotion-neutral-*.png',
    { eager: true, query: '?asset', import: 'default' }
  ),
  ...import.meta.glob<string>(
    '../../src/assets/character/*/frames/emotion-tired-*.png',
    { eager: true, query: '?asset', import: 'default' }
  ),
  ...import.meta.glob<string>(
    '../../src/assets/character/*/frames/emotion-happy-*.png',
    { eager: true, query: '?asset', import: 'default' }
  )
}

const facePaths = new Map<string, string>()
for (const [path, asset] of Object.entries(faceAssets)) {
  const parts = path.split('/')
  const pack = parts[parts.length - 3]
  const fileName = parts[parts.length - 1]
  const file = fileName ? fileName.replace(/\.png$/, '') : undefined
  if (!pack || !file || !/^emotion-(neutral|tired|happy)-/.test(file)) continue
  if (typeof asset === 'string') facePaths.set(`${pack}/${file}`, asset)
}

export interface TrayPortraitInput {
  paused: boolean
  popupOpen: boolean
  anchorAt: number | null
  dueAt: number | null
  heldProgress: number | null
  now: number
  reduceMotion: boolean
  trayState: TrayState
  packId: string
  build: CharacterBuild
  conditionLevel: number
}

let lastInput: TrayPortraitInput | null = null
let blinkOn = true
let blinkTimer: NodeJS.Timeout | null = null
let warningTimer: NodeJS.Timeout | null = null
let repaint: (() => void) | null = null
let taskbarIcon: NativeImage | null = null
let liveTaskbarIdentityApplied = false
let appliedKey = ''
const painted = new Map<string, { tray: NativeImage; taskbar: NativeImage }>()
const scaledFaces = new Map<string, BgraImage | null>()

/**
 * Unpackaged Electron picks up `setIcon(NativeImage)` on the taskbar.
 * Packaged Windows binds the button to the Start-menu / desktop shortcut via
 * AppUserModelId and keeps that static `icon.ico` (no countdown ring). Give the
 * dashboard window a live-scoped AUMID so `setIcon` wins like it does in dev.
 */
function ensureLiveTaskbarIdentity(win: BrowserWindow): void {
  if (liveTaskbarIdentityApplied || win.isDestroyed()) return
  if (process.platform !== 'win32' || !app.isPackaged) return
  if (typeof win.setAppDetails !== 'function') return
  win.setAppDetails({
    appId: `${APP_IDENTITY.appId}.live`,
    relaunchDisplayName: APP_IDENTITY.title,
    relaunchCommand: process.execPath
  })
  liveTaskbarIdentityApplied = true
}

function applyDashboardTaskbarIcon(win: BrowserWindow, image: NativeImage): void {
  if (win.isDestroyed()) return
  ensureLiveTaskbarIdentity(win)
  win.setIcon(image)
}

export function setTrayPortraitRepaint(next: () => void): void {
  repaint = next
}

export function stopTrayPortrait(): void {
  if (blinkTimer) clearInterval(blinkTimer)
  if (warningTimer) clearTimeout(warningTimer)
  blinkTimer = null
  warningTimer = null
}

export function paintTrayPortrait(input: TrayPortraitInput): void {
  lastInput = input
  if (!hasTray()) return
  render(input)
}

export function repaintTrayPortrait(): void {
  appliedKey = ''
  if (lastInput) paintTrayPortrait(lastInput)
}

onDashboardCreated(win => {
  liveTaskbarIdentityApplied = false
  if (taskbarIcon) applyDashboardTaskbarIcon(win, taskbarIcon)
  win.on('show', () => {
    if (taskbarIcon && !win.isDestroyed()) applyDashboardTaskbarIcon(win, taskbarIcon)
  })
  win.on('closed', () => {
    liveTaskbarIdentityApplied = false
  })
})

function render(input: TrayPortraitInput): void {
  const phase = trayRingPhase(input)
  syncBlink(phase === 'blink')
  armWarning(input)

  const fill = trayRingFill(input)
  const step = trayRingStep(fill)
  const color = trayRingColor(phase, blinkOn)
  const emotion = trayFaceEmotion(input.trayState, input.conditionLevel)
  const packId = normalizeCharacterPackId(input.packId)
  const faceKey = resolveFacePath(emotion, input.build, packId) ?? 'none'
  const cacheKey = `${faceKey}|${step}|${color}|${input.trayState}`
  const cached = painted.get(cacheKey)
  const images = cached ?? paintImages(faceKey, step / TRAY_RING_STEPS, color)
  if (!cached) painted.set(cacheKey, images)
  taskbarIcon = images.taskbar
  if (cacheKey !== appliedKey) {
    appliedKey = cacheKey
    setTrayImage(images.tray)
    const dashboard = getDashboardWindow()
    if (dashboard && !dashboard.isDestroyed()) applyDashboardTaskbarIcon(dashboard, images.taskbar)
  }

  const remaining = input.dueAt === null ? null : input.dueAt - input.now
  setTrayDetail(trayWaitLabel(remaining, phase))
}

function syncBlink(active: boolean): void {
  if (active && !blinkTimer) {
    blinkTimer = setInterval(() => {
      blinkOn = !blinkOn
      repaint?.()
    }, TRAY_BLINK_MS)
    return
  }
  if (!active && blinkTimer) {
    clearInterval(blinkTimer)
    blinkTimer = null
    blinkOn = true
  }
}

function armWarning(input: TrayPortraitInput): void {
  if (warningTimer) {
    clearTimeout(warningTimer)
    warningTimer = null
  }
  if (input.paused || input.popupOpen || input.dueAt === null) return
  const delay = input.dueAt - TRAY_WARNING_MS - input.now
  if (delay <= 0 || delay > 60_000) return
  warningTimer = setTimeout(() => {
    warningTimer = null
    repaint?.()
  }, delay)
}

function paintImages(faceKey: string, progress: number, color: ReturnType<typeof trayRingColor>): {
  tray: NativeImage
  taskbar: NativeImage
} {
  const trayImage = nativeImage.createFromBitmap(frameBuffer(TRAY_SIZES[0], faceKey, progress, color), {
    width: TRAY_SIZES[0],
    height: TRAY_SIZES[0],
    scaleFactor: 1
  })
  const scales: Array<[number, number]> = [[20, 1.25], [24, 1.5], [32, 2]]
  for (const [size, scale] of scales) {
    trayImage.addRepresentation({
      scaleFactor: scale,
      width: size,
      height: size,
      buffer: frameBuffer(size, faceKey, progress, color)
    })
  }
  const master = TASKBAR_SIZES[0]
  const taskbarImage = nativeImage.createFromBitmap(frameBuffer(master, faceKey, progress, color), {
    width: master,
    height: master,
    scaleFactor: 1
  })
  for (const size of TASKBAR_SIZES.slice(1)) {
    taskbarImage.addRepresentation({
      scaleFactor: size / master,
      width: size,
      height: size,
      buffer: frameBuffer(size, faceKey, progress, color)
    })
  }
  return {
    tray: trayImage,
    taskbar: taskbarImage
  }
}

function frameBuffer(size: number, faceKey: string, progress: number, color: ReturnType<typeof trayRingColor>): Buffer {
  const { faceSize } = trayIconMetrics(size)
  const face = faceKey === 'none' ? null : loadFace(faceKey, faceSize)
  return Buffer.from(composeTrayIcon({ size, face, progress, color }))
}

function loadFace(path: string, size: number): BgraImage | null {
  const cacheKey = `${path}|${size}`
  const cached = scaledFaces.get(cacheKey)
  if (cached !== undefined) return cached
  const image = nativeImage.createFromPath(path)
  if (image.isEmpty()) {
    scaledFaces.set(cacheKey, null)
    return null
  }
  const { width, height } = image.getSize()
  const bytes = image.toBitmap()
  const source = bytes.length === width * height * 4
    ? cropHeadSquare({ width, height, pixels: new Uint8Array(bytes) })
    : null
  const bitmap = (source
    ? nativeImage.createFromBitmap(Buffer.from(source.pixels), {
      width: source.width,
      height: source.height,
      scaleFactor: 1
    })
    : image
  ).resize({ width: size, height: size, quality: 'best' })
  const scaledBytes = bitmap.toBitmap()
  if (scaledBytes.length !== size * size * 4) {
    scaledFaces.set(cacheKey, null)
    return null
  }
  const face = { width: size, height: size, pixels: new Uint8Array(scaledBytes) }
  scaledFaces.set(cacheKey, face)
  return face
}

function resolveFacePath(emotion: ReturnType<typeof trayFaceEmotion>, build: CharacterBuild, packId: string): string | undefined {
  for (const key of characterFaceCandidates(emotion, build)) {
    if (key === CHARACTER_EMOJI_FRAME) break
    const path = facePaths.get(`${packId}/${key}`)
    if (path) return path
  }
  const average = facePaths.get(`${packId}/emotion-neutral-${frameBuild(build)}`)
  return average
}

import { app, ipcMain, type WebContents } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { LAB_ARGUMENT, LAB_HEADLESS_ARGUMENT } from './lab-environment'
import { IpcChannels } from '../../shared/types/events'
import { LAB_BRIDGE_METHODS, type LabBridgeMethod, type LabBridgeResponse, type LabChildMessage, type LabParentMessage } from '../../shared/types/lab-bridge'

/**
 * The playground hosts the full laboratory UI in a webview. The sandbox itself
 * stays a separate, headless Electron process: its profile, reminder loop and
 * real popup windows must not share the main process. This module is the only
 * bridge between the lab view and that engine.
 */

let engine: ChildProcess | null = null
let ready: Promise<void> | null = null
let labView: WebContents | null = null
let nextRequestId = 0
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()

function clearPending(error: Error): void {
  for (const entry of Array.from(pending.values())) {
    clearTimeout(entry.timer)
    entry.reject(error)
  }
  pending.clear()
}

function settle(response: LabBridgeResponse): void {
  const entry = pending.get(response.id)
  if (!entry) return
  pending.delete(response.id)
  clearTimeout(entry.timer)
  if (response.ok) entry.resolve(response.value)
  else entry.reject(new Error(response.error ?? 'Laboratory request failed'))
}

function onChildMessage(message: LabChildMessage): void {
  if (!message || typeof message !== 'object') return
  if (message.type === 'ready') return
  if (message.type === 'response') { settle(message.response); return }
  if (message.type === 'event' && labView && !labView.isDestroyed()) {
    labView.send(message.channel, message.payload)
  }
}

export function ensureLabEngine(): Promise<void> {
  if (ready) return ready
  const args = app.isPackaged
    ? [LAB_ARGUMENT, LAB_HEADLESS_ARGUMENT, `--user-data-dir=${app.getPath('userData')}`]
    : [app.getAppPath(), LAB_ARGUMENT, LAB_HEADLESS_ARGUMENT]
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(process.execPath, args, {
    cwd: app.isPackaged ? process.cwd() : app.getAppPath(),
    env,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc']
  })
  engine = child
  ready = new Promise<void>((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      if (engine === child) { engine = null; ready = null }
      child.kill()
      reject(new Error('Laboratory engine did not start'))
    }, 20_000)
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve()
    }
    child.once('error', error => {
      engine = null
      ready = null
      finish(error)
    })
    child.once('exit', () => {
      engine = null
      ready = null
      const error = new Error('Laboratory engine stopped')
      clearPending(error)
      finish(error)
    })
    child.on('message', (message: LabChildMessage) => {
      if (message?.type === 'ready') { finish(); return }
      onChildMessage(message)
    })
  })
  return ready
}

export function requestLab(method: LabBridgeMethod, payload?: unknown): Promise<unknown> {
  return ensureLabEngine().then(() => {
    const child = engine
    if (!child) throw new Error('Laboratory engine is unavailable')
    const id = ++nextRequestId
    const request: LabParentMessage = { type: 'request', request: { id, method, payload } }
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Laboratory request timed out'))
      }, 20_000)
      pending.set(id, { resolve, reject, timer })
      try {
        child.send(request)
      } catch (cause) {
        pending.delete(id)
        clearTimeout(timer)
        reject(cause instanceof Error ? cause : new Error(String(cause)))
      }
    })
  })
}

function expectedLabViewUrl(): string {
  const base = process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(join(__dirname, '../renderer/index.html')).toString()
  const url = new URL(base)
  url.hash = '/lab-playground'
  return url.toString()
}

export function stopLabEngine(): void {
  if (!engine) return
  const child = engine
  engine = null
  ready = null
  child.kill()
  clearPending(new Error('Laboratory engine stopped'))
}

export function registerLabEngineIpc(): void {
  ipcMain.on(IpcChannels.LabViewRegister, (event) => {
    const sender = event.sender
    if (sender.getType() !== 'webview' || new URL(sender.getURL()).toString() !== expectedLabViewUrl()) return
    labView = sender
    sender.once('destroyed', () => {
      if (labView === sender) labView = null
      // Leaving the Playground lab context pauses the sandbox run, matching the
      // old window-close behaviour, but keeps the headless engine alive.
      if (engine) void requestLab(LAB_BRIDGE_METHODS.labCommand, { action: 'pause' }).catch(() => undefined)
    })
    void ensureLabEngine().catch((cause: unknown) => {
      console.error('[lab-engine] failed to start', cause)
    })
  })

  ipcMain.handle(IpcChannels.LabBridgeRequest, (event, request: { method: LabBridgeMethod; payload?: unknown }) => {
    if (event.sender !== labView) throw new Error('Laboratory bridge is available only to the playground lab view')
    return requestLab(request.method, request.payload)
  })
}

import { app, ipcMain, type WebContents } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { LAB_ARGUMENT, LAB_HEADLESS_ARGUMENT } from './lab-environment'
import { IpcChannels } from '../../shared/types/events'
import {
  LAB_BRIDGE_METHODS,
  type LabBridgeMethod,
  type LabBridgeResponse,
  type LabChildMessage,
  type LabParentMessage
} from '../../shared/types/lab-bridge'
import { beginPlayback, endPlayback, registerPlaybackStopper } from './playback-coordinator'
import type { LabCommand, LabState } from '../../shared/domain/laboratory'

/**
 * Dashboard hosts the laboratory UI natively. The sandbox stays a separate
 * headless Electron process so its profile, reminder loop and popup windows
 * never share the main process. This module bridges the host to that engine.
 */

let engine: ChildProcess | null = null
let ready: Promise<void> | null = null
let labHost: WebContents | null = null
let nextRequestId = 0
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
>()

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
  if (message.type === 'response') {
    settle(message.response)
    return
  }
  if (message.type === 'event') {
    if (message.channel === IpcChannels.LabChanged) {
      const state = message.payload as LabState
      if (!state?.playing) endPlayback('laboratory')
      // Only LabChanged reaches the dashboard host — never DataUpdated, so the
      // real-profile Pinia cannot be overwritten by sandbox snapshots.
      if (labHost && !labHost.isDestroyed()) labHost.send(message.channel, message.payload)
      return
    }
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
      if (engine === child) {
        engine = null
        ready = null
      }
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
    child.once('error', (error) => {
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
      if (message?.type === 'ready') {
        finish()
        return
      }
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

export function stopLabEngine(): void {
  if (!engine) return
  const child = engine
  engine = null
  ready = null
  child.kill()
  clearPending(new Error('Laboratory engine stopped'))
}

function pauseLabEngine(): void {
  if (!engine) return
  void requestLab(LAB_BRIDGE_METHODS.labCommand, { action: 'pause' }).catch(() => undefined)
  endPlayback('laboratory')
}

export function registerLabEngineIpc(): void {
  registerPlaybackStopper('laboratory', pauseLabEngine)

  ipcMain.on(IpcChannels.LabViewRegister, (event) => {
    const sender = event.sender
    // Native dashboard host (window) or legacy webview.
    if (sender.getType() !== 'window' && sender.getType() !== 'webview') return
    labHost = sender
    sender.once('destroyed', () => {
      if (labHost === sender) labHost = null
      pauseLabEngine()
    })
    void ensureLabEngine().catch((cause: unknown) => {
      console.error('[lab-engine] failed to start', cause)
    })
  })

  ipcMain.handle(
    IpcChannels.LabBridgeRequest,
    async (event, request: { method: LabBridgeMethod; payload?: unknown }) => {
      if (event.sender !== labHost) {
        throw new Error('Laboratory bridge is available only to the registered lab host')
      }
      if (request.method === LAB_BRIDGE_METHODS.labCommand) {
        const command = request.payload as LabCommand
        if (command?.action === 'play') beginPlayback('laboratory')
        if (command?.action === 'pause' || command?.action === 'seek' || command?.action === 'reset'
          || command?.action === 'reset-history' || command?.action === 'restart') {
          endPlayback('laboratory')
        }
      }
      return requestLab(request.method, request.payload)
    }
  )
}

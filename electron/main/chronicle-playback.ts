import { ipcMain } from 'electron'
import { chronicleToLabPlan } from '../../shared/domain/chronicle'
import { playbackCharacterAt } from '../../shared/domain/character-context'
import type { ChronicleCommand, ChroniclePlaybackState } from '../../shared/domain/chronicle-playback'
import { labMilestones, type LabPlan } from '../../shared/domain/laboratory'
import type { LabDriverAck } from '../../shared/domain/laboratory-playback'
import { localDateKey } from '../../shared/domain/stats'
import { nowDate, nowMs } from '../../shared/domain/clock'
import { IpcChannels } from '../../shared/types/events'
import { NativePlayback } from './laboratory-playback'
import { getSnapshot } from './persistence'
import { getAvailableCatalog } from './custom-exercises'
import { broadcastToWindows } from './broadcast'
import {
  beginPlayback,
  endPlayback,
  registerPlaybackStopper
} from './playback-coordinator'
import {
  cancelLoopForLaboratory,
  configureLoopSimulation,
  missActivePopup,
  setPreviewCharacter,
  setSessionPreviewMode,
  triggerPreviewExercise
} from './trigger-loop'
import { closePopupWindow, getPopupWindow } from './windows/popup'

let plan: LabPlan | null = null
let cursor = 0
let openingReplay = false
let message = 'Просмотр реальной истории'

const playback = new NativePlayback({
  plan: () => plan,
  cursor: () => cursor,
  now: nowMs,
  severity: () => plan?.settings.severity ?? getSnapshot().settings.severity,
  clock: () => undefined,
  move: (index) => {
    cursor = index
    publish()
  },
  open: (event) => {
    openingReplay = true
    try {
      const sessions = (plan?.events ?? [])
        .slice(0, Math.max(0, (playback.state.eventIndex ?? 0) + 1))
        .map((item) => item.session)
        .filter((session): session is NonNullable<typeof session> => !!session)
      const identity = plan?.settings.characterPackId ?? getSnapshot().settings.characterPackId
      const build = plan?.progress.characterBuild ?? getSnapshot().progress.characterBuild
      setPreviewCharacter(playbackCharacterAt(
        sessions,
        new Date(event.at),
        identity,
        build,
        event.session
      ))
      return triggerPreviewExercise(event.session!.exerciseId, event.session!.durationSec).sessionId
    } finally {
      openingReplay = false
    }
  },
  active: () => !!getPopupWindow(),
  close: closePopupWindow,
  timeout: () => {
    missActivePopup()
  },
  send: (command) => getPopupWindow()?.webContents?.send(IpcChannels.LabDriver, command),
  commit: () => {
    // Preview only — real history stays untouched.
  },
  intervention: () => {
    message = 'Сценарий прерван'
  },
  changed: () => {
    if (playback.state.phase === 'finished') endPlayback('chronicle')
    publish()
  }
})

function publish(): ChroniclePlaybackState {
  const state = getChroniclePlaybackState()
  broadcastToWindows(IpcChannels.ChronicleChanged, state)
  return state
}

export function getChroniclePlaybackState(): ChroniclePlaybackState {
  return {
    cursor,
    playing: playback.playing,
    eventCount: plan?.events.length ?? 0,
    playback: plan ? { ...playback.state } : null,
    message
  }
}

function rebuildPlan(): void {
  const snapshot = getSnapshot()
  plan = chronicleToLabPlan(
    snapshot.sessions,
    snapshot.settings,
    snapshot.progress,
    nowDate(),
    getAvailableCatalog()
  )
  if (cursor >= plan.events.length) cursor = Math.max(0, plan.events.length - 1)
}

function seek(next: number): void {
  if (!plan || !Number.isInteger(next) || next < 0 || next >= plan.events.length) {
    throw new Error('Invalid chronicle position')
  }
  playback.cancel()
  cancelLoopForLaboratory()
  setSessionPreviewMode(false)
  cursor = next
  message = plan.events[cursor]!.label
}

function dateCursor(date: string): number {
  if (!plan || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid chronicle date')
  const at = new Date(`${date}T23:59:59.999`).getTime()
  if (!Number.isFinite(at) || localDateKey(new Date(at)) !== date) throw new Error('Invalid chronicle date')
  let result = 0
  for (let index = 0; index < plan.events.length; index++) {
    if (Date.parse(plan.events[index]!.at) > at) break
    result = index
  }
  return result
}

export function stopChroniclePlayback(): void {
  playback.cancel()
  cancelLoopForLaboratory()
  setSessionPreviewMode(false)
  endPlayback('chronicle')
  publish()
}

export function acknowledgeChronicleDriver(ack: LabDriverAck): void {
  if (openingReplay) return
  playback.acknowledge(ack)
}

function onPreviewResolved(session: import('../../shared/types/session').Session): void {
  if (!playback.resolved(session)) {
    playback.pause()
    message = 'Просмотр остановлен'
    endPlayback('chronicle')
    publish()
  }
}

export function executeChronicleCommand(command: ChronicleCommand): ChroniclePlaybackState {
  if (!command || typeof command.action !== 'string') throw new Error('Invalid chronicle command')
  rebuildPlan()
  if (!plan || plan.events.length < 2) throw new Error('Недостаточно истории для проигрывания')

  switch (command.action) {
    case 'seek':
      seek(command.cursor)
      break
    case 'date':
      seek(dateCursor(command.date))
      break
    case 'step': {
      playback.pause()
      if (![-1, 1].includes(command.direction) || !['event', 'day', 'milestone'].includes(command.unit)) {
        throw new Error('Invalid chronicle step')
      }
      let next = cursor + command.direction
      if (command.unit === 'milestone') {
        const candidates = labMilestones(plan).filter((index) =>
          command.direction > 0 ? index > cursor : index < cursor
        )
        next = command.direction > 0 ? candidates[0] ?? cursor : candidates[candidates.length - 1] ?? cursor
      } else if (command.unit === 'day') {
        const day = localDateKey(new Date(plan.events[cursor]!.at))
        while (next >= 0 && next < plan.events.length && localDateKey(new Date(plan.events[next]!.at)) === day) {
          next += command.direction
        }
      }
      seek(Math.min(plan.events.length - 1, Math.max(0, next)))
      break
    }
    case 'pause':
      playback.pause()
      endPlayback('chronicle')
      message = 'Воспроизведение остановлено'
      break
    case 'play': {
      beginPlayback('chronicle')
      setSessionPreviewMode(true)
      configureLoopSimulation({
        hold: false,
        freezeDeadline: false,
        idleSeconds: 0,
        onResolved: onPreviewResolved,
        onTriggered: () => undefined
      })
      if (cursor >= plan.events.length - 1) seek(0)
      playback.play()
      message = 'Проигрывание хроники'
      break
    }
    default:
      throw new Error('Invalid chronicle command')
  }
  return publish()
}

export function registerChroniclePlaybackIpc(): void {
  registerPlaybackStopper('chronicle', () => {
    playback.pause()
    cancelLoopForLaboratory()
    setSessionPreviewMode(false)
    endPlayback('chronicle')
    publish()
  })
  ipcMain.handle(IpcChannels.ChronicleGetState, () => {
    rebuildPlan()
    return getChroniclePlaybackState()
  })
  ipcMain.handle(IpcChannels.ChronicleCommand, (_event, command: ChronicleCommand) =>
    executeChronicleCommand(command)
  )
}

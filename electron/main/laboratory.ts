import { app, dialog } from 'electron'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { buildLabScenario, buildRandomCalendar, labMilestones, labSessionsAt, validateLabPlan,
  type LabCommand, type LabPlan, type LabState } from '../../shared/domain/laboratory'
import { nowDate, nowMs, setLaboratoryClock } from '../../shared/domain/clock'
import { localDateKey } from '../../shared/domain/stats'
import { IpcChannels } from '../../shared/types/events'
import type { Session } from '../../shared/types/session'
import { applyDebugState, getSnapshot } from './persistence'
import { defaultProgress, defaultSettings, normalizeProgress, normalizeSettings } from './persistence/defaults'
import { readJsonEnvelope, writeJsonEnvelope } from './persistence/json-file'
import { getDataDir } from './persistence/paths'
import { broadcastToWindows, notifyDataUpdated } from './broadcast'
import { isLabProcess, LAB_ARGUMENT } from './lab-environment'
import { openLaboratoryWindow } from './windows/laboratory'
import { cancelLoopForLaboratory, configureLoopSimulation, getActivePopup, syncLoopFromSettings,
  tickTriggerLoop, triggerNow } from './trigger-loop'

let plan: LabPlan | null = null
let cursor = 0
let playing: ReturnType<typeof setInterval> | undefined
let detached = false
let interrupted = false
let message = 'Выберите историю или создайте календарь'

export async function launchLaboratory(): Promise<void> {
  if (app.isPackaged) throw new Error('Laboratory is only available in development')
  if (isLabProcess()) { openLaboratoryWindow(); return }
  const environment = { ...process.env }
  delete environment.ELECTRON_RUN_AS_NODE
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [app.getAppPath(), LAB_ARGUMENT], {
      cwd: app.getAppPath(), env: environment, windowsHide: true, stdio: 'ignore'
    })
    child.once('spawn', resolve)
    child.once('error', reject)
  })
}

export function getLabState(): LabState {
  return { enabled: isLabProcess(), plan, cursor, playing: !!playing, detached, interrupted, message,
    now: nowDate().toISOString(), activePopup: getActivePopup() !== null }
}

function publish(): LabState {
  const state = getLabState()
  broadcastToWindows(IpcChannels.LabChanged, state)
  return state
}

function pause(): void {
  clearInterval(playing)
  playing = undefined
}

function seek(next: number, silent = true): void {
  if (!plan || !Number.isInteger(next) || next < 0 || next >= plan.events.length) throw new Error('Invalid timeline position')
  cancelLoopForLaboratory()
  configureLoopSimulation({ hold: true, idleSeconds: 0 })
  cursor = next
  detached = false
  interrupted = false
  setLaboratoryClock({ at: plan.events[cursor]!.at, running: false, silent })
  applyDebugState({ sessions: labSessionsAt(plan, cursor), settings: plan.settings, progress: plan.progress })
  syncLoopFromSettings()
  notifyDataUpdated()
  message = plan.events[cursor]!.label
}

function load(next: LabPlan): void {
  pause()
  plan = validateLabPlan(next)
  // Imports cross the same normalization boundary as regular persisted settings.
  plan.settings = normalizeSettings(plan.settings)
  plan.progress = normalizeProgress(plan.progress)
  seek(0)
}

function onResolved(session: Session): void {
  pause()
  interrupted = true
  detached = true
  if (plan) {
    plan = { ...plan, events: [...plan.events.slice(0, cursor + 1), {
      at: session.completedAt ?? session.triggeredAt, label: `Ручное событие · ${session.status}`, session
    }] }
    cursor = plan.events.length - 1
  }
  message = 'Событие записано. Воспроизведение остановлено; будущая история заменена ручной веткой.'
  publish()
}

function onTriggered(): void {
  pause()
  configureLoopSimulation({ hold: false })
  detached = true
  setLaboratoryClock({ at: nowDate().toISOString(), running: true, silent: false })
  notifyDataUpdated()
  message = 'Открыто настоящее упражнение. Таймлайн остановлен.'
  publish()
}

export function initializeLaboratory(): void {
  if (!isLabProcess()) return
  setLaboratoryClock({ at: new Date().toISOString(), running: false, silent: true })
  configureLoopSimulation({ hold: true, idleSeconds: 0, onTriggered, onResolved })
}

export function stopLaboratory(): void { pause() }

export function rememberLabPreferences(): void {
  if (!isLabProcess() || !plan) return
  const snapshot = getSnapshot()
  plan.settings = snapshot.settings
  plan.progress.characterBuild = snapshot.progress.characterBuild
  publish()
}

function dateCursor(date: string): number {
  if (!plan || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid timeline date')
  const at = new Date(`${date}T23:59:59.999`).getTime()
  if (!Number.isFinite(at) || localDateKey(new Date(at)) !== date) throw new Error('Invalid timeline date')
  let result = 0
  for (let index = 0; index < plan.events.length; index++) {
    if (Date.parse(plan.events[index]!.at) > at) break
    result = index
  }
  return result
}

function openPopup(preset: Extract<LabCommand, { action: 'popup' }>['preset']): void {
  pause()
  if (!['normal', 'stage-up', 'soft', 'medium', 'hardcore', 'details'].includes(preset)) throw new Error('Invalid popup preset')
  cancelLoopForLaboratory()
  if (preset === 'stage-up') {
    const next = buildLabScenario('growth', nowDate(), defaultSettings(), defaultProgress())
    const milestones = labMilestones(next)
    const stageUp = milestones.find(index => labSessionsAt(next, index).filter(session => session.status === 'done').length === 3)
    load(next)
    seek(Math.max(0, (stageUp ?? 1) - 1))
  }
  const snapshot = getSnapshot()
  const settings = { ...snapshot.settings, severity: preset === 'soft' || preset === 'hardcore' ? preset : 'medium',
    sessionExtras: { enabled: preset === 'details' } } as typeof snapshot.settings
  applyDebugState({ sessions: snapshot.sessions, settings, progress: snapshot.progress })
  const at = nowDate().toISOString()
  setLaboratoryClock({ at, running: true, silent: false })
  configureLoopSimulation({ hold: false, idleSeconds: 0 })
  detached = true
  notifyDataUpdated()
  syncLoopFromSettings()
  triggerNow('manual')
  message = 'Настоящее окно Electron. Начните упражнение и проверьте результат вручную.'
}

function savedPath(): string { return join(getDataDir(), 'laboratory-run.json') }

export async function executeLabCommand(command: LabCommand): Promise<LabState> {
  if (!isLabProcess()) throw new Error('Open the isolated laboratory first')
  if (!command || typeof command.action !== 'string') throw new Error('Invalid laboratory command')
  switch (command.action) {
    case 'scenario': load(buildLabScenario(command.id, new Date(), defaultSettings(), defaultProgress())); break
    case 'generate': load(buildRandomCalendar(command.options, defaultSettings(), defaultProgress())); break
    case 'seek': pause(); seek(command.cursor); break
    case 'date': pause(); seek(dateCursor(command.date)); break
    case 'step': {
      pause()
      if (!plan || ![-1, 1].includes(command.direction) || !['event', 'day', 'milestone'].includes(command.unit)) throw new Error('Invalid timeline step')
      let next = cursor + command.direction
      if (command.unit === 'milestone') {
        const candidates = labMilestones(plan).filter(index => command.direction > 0 ? index > cursor : index < cursor)
        next = command.direction > 0 ? candidates[0] ?? cursor : candidates[candidates.length - 1] ?? cursor
      } else if (command.unit === 'day') {
        const day = localDateKey(new Date(plan.events[cursor]!.at))
        while (next >= 0 && next < plan.events.length && localDateKey(new Date(plan.events[next]!.at)) === day) next += command.direction
      }
      seek(Math.min(plan.events.length - 1, Math.max(0, next)))
      break
    }
    case 'play': {
      pause()
      if (!plan || ![500, 1500, 3500].includes(command.delayMs)) throw new Error('Invalid playback speed')
      if (detached) seek(cursor)
      playing = setInterval(() => {
        try {
          if (!plan || cursor >= plan.events.length - 1) { pause(); publish(); return }
          seek(cursor + 1, false)
          if (cursor === plan.events.length - 1) pause()
          publish()
        } catch (error) {
          pause()
          console.error('[laboratory] playback failed', error)
          message = 'Воспроизведение остановлено: не удалось применить событие.'
          publish()
        }
      }, command.delayMs)
      break
    }
    case 'pause': pause(); message = 'Воспроизведение остановлено'; break
    case 'popup': openPopup(command.preset); break
    case 'advance': {
      pause()
      if (!Number.isFinite(command.seconds) || command.seconds < 0 || command.seconds > 86400) throw new Error('Invalid time jump')
      const at = new Date(nowMs() + command.seconds * 1000).toISOString()
      setLaboratoryClock({ at, running: true, silent: false })
      configureLoopSimulation({ hold: false })
      detached = true
      notifyDataUpdated()
      tickTriggerLoop()
      message = `Время продвинуто на ${command.seconds} с`
      break
    }
    case 'idle':
      if (!Number.isFinite(command.seconds) || command.seconds < 0 || command.seconds > 86400) throw new Error('Invalid idle duration')
      pause()
      configureLoopSimulation({ hold: false, idleSeconds: command.seconds })
      tickTriggerLoop()
      message = command.seconds ? `Эмуляция отсутствия: ${command.seconds} с` : 'Пользователь вернулся'
      break
    case 'fail-save':
      configureLoopSimulation({ failNextWrite: true })
      message = 'Следующая запись результата завершится ошибкой. Повтор должен сохранить её один раз.'
      break
    case 'reset':
      pause()
      cancelLoopForLaboratory()
      configureLoopSimulation({ hold: true, idleSeconds: 0 })
      plan = null; cursor = 0; detached = false; interrupted = false
      setLaboratoryClock({ at: new Date().toISOString(), running: false, silent: true })
      applyDebugState({ sessions: [], settings: defaultSettings(), progress: defaultProgress() })
      syncLoopFromSettings(); notifyDataUpdated()
      message = 'Тестовая история и настройки сброшены. Сохранённый вариант доступен для восстановления.'
      break
    case 'save':
      if (!plan) throw new Error('Choose a scenario first')
      validateLabPlan(plan)
      writeJsonEnvelope(savedPath(), { plan, cursor })
      message = 'Вариант и позиция сохранены в тестовом профиле'
      break
    case 'restore': {
      const saved = readJsonEnvelope<{ plan: unknown; cursor: number }>(savedPath())
      if (!saved || !Number.isInteger(saved.cursor)) throw new Error('No saved laboratory run')
      const restored = validateLabPlan(saved.plan)
      if (saved.cursor < 0 || saved.cursor >= restored.events.length) throw new Error('Invalid saved position')
      load(restored); seek(saved.cursor)
      message = 'Сохранённый вариант восстановлен'
      break
    }
    case 'export': {
      pause()
      if (!plan) throw new Error('Choose a scenario first')
      validateLabPlan(plan)
      const result = await dialog.showSaveDialog({ title: 'Сохранить сценарий лаборатории', defaultPath: 'body-debugger-scenario.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
      if (!result.canceled && result.filePath) {
        writeFileSync(result.filePath, JSON.stringify({ plan, cursor }, null, 2), 'utf8')
        message = 'Сценарий экспортирован'
      }
      break
    }
    case 'import': {
      pause()
      const result = await dialog.showOpenDialog({ title: 'Открыть сценарий лаборатории', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
      const path = result.filePaths[0]
      if (!result.canceled && path) {
        if (statSync(path).size > 2 * 1024 * 1024) throw new Error('Laboratory file is too large')
        const saved = JSON.parse(readFileSync(path, 'utf8')) as { plan: unknown; cursor: number }
        const imported = validateLabPlan(saved.plan)
        if (!Number.isInteger(saved.cursor) || saved.cursor < 0 || saved.cursor >= imported.events.length) throw new Error('Invalid saved position')
        load(imported); seek(saved.cursor)
        message = 'Сценарий импортирован'
      }
      break
    }
    case 'detach': openLaboratoryWindow(); break
    default: throw new Error('Unknown laboratory command')
  }
  return publish()
}

import { dialog } from 'electron'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LAB_MAX_IMPORT_BYTES, buildLabScenario, buildRandomCalendar, labMilestones, labSessionsAt, validateLabPlan, upgradeLabPlan,
  type LabCommand, type LabPlan, type LabState } from '../../shared/domain/laboratory'
import { nowDate, nowMs, setLaboratoryClock } from '../../shared/domain/clock'
import { localDateKey } from '../../shared/domain/stats'
import { IpcChannels } from '../../shared/types/events'
import type { Session } from '../../shared/types/session'
import { NativePlayback } from './laboratory-playback'
import { labActions, type LabDriverAck } from '../../shared/domain/laboratory-playback'
import { closePopupWindow, getPopupWindow } from './windows/popup'
import { applyDebugState, getSnapshot, updateSettings, updateProgress } from './persistence'
import { getAvailableCatalog } from './custom-exercises'
import { defaultProgress, defaultSettings, normalizeProgress, normalizeSettings } from './persistence/defaults'
import { readJsonEnvelope, writeJsonEnvelope } from './persistence/json-file'
import { getDataDir } from './persistence/paths'
import { broadcastToWindows, notifyDataUpdated } from './broadcast'
import { isLabProcess } from './lab-environment'
import { closeLabPreviewWindow, openLabPreviewWindow } from './windows/laboratory-preview'
import { validateLabVisualPreview, type LabVisualPreview } from '../../shared/domain/laboratory-preview'
import { cancelLoopForLaboratory, configureLoopSimulation, getActivePopup, syncLoopFromSettings,
  tickTriggerLoop, triggerNow, triggerLaboratoryExercise } from './trigger-loop'

let plan: LabPlan | null = null
let cursor = 0
let originalPlan: LabPlan | null = null
let openingReplay = false
let detached = false
let interrupted = false
let hasBranch = false
let projectingResult = false
let message = 'Выберите историю или создайте календарь'
let visualPreview: LabVisualPreview | null = null

const playback = new NativePlayback({
  plan: () => plan, cursor: () => cursor, now: nowMs, severity: () => getSnapshot().settings.severity,
  clock: (at, running, rate) => {
    setLaboratoryClock({ at: new Date(at).toISOString(), running, rate, silent: false })
    configureLoopSimulation({ hold: true, freezeDeadline: !running })
    if (!projectingResult) notifyDataUpdated()
  },
  move: index => { cursor = index; notifyDataUpdated() },
  open: event => {
    openingReplay = true
    try { return triggerLaboratoryExercise(event.session!.exerciseId, event.session!.durationSec).sessionId }
    finally { openingReplay = false }
  },
  active: () => !!getPopupWindow(), close: closePopupWindow,
  timeout: () => {
    configureLoopSimulation({ freezeDeadline: false })
    tickTriggerLoop()
  },
  send: command => getPopupWindow()?.webContents?.send(IpcChannels.LabDriver, command),
  commit: (index, session, manual) => {
    if (!plan) return
    const events = plan.events.slice()
    const resolvedAt = session.completedAt ?? session.triggeredAt
    const shift = Math.max(0, Date.parse(resolvedAt) - Date.parse(events[index]!.at))
    if (!manual && shift > 0) {
      for (let next = index + 1; next < events.length; next++) {
        const event = events[next]!
        const move = (at: string) => new Date(Date.parse(at) + shift).toISOString()
        events[next] = { ...event, at: move(event.at), ...(event.session ? { session: {
          ...event.session, triggeredAt: move(event.session.triggeredAt),
          ...(event.session.completedAt ? { completedAt: move(event.session.completedAt) } : {})
        } } : {}) }
      }
    }
    events[index] = { at: resolvedAt, label: `Результат · ${session.status}`,
      session, actions: labActions(session) }
    // A manual outcome retains the original future separately and makes an explicit branch.
    plan = { ...plan, events: manual ? events.slice(0, index + 1) : events }
    cursor = index
    interrupted = manual
    hasBranch ||= manual
    detached = false
    message = manual ? 'Ручная ветка записана. Можно продолжить её или вернуться к исходному сценарию.' : 'Результат сохранён обычным циклом приложения.'
  },
  intervention: () => {
    interrupted = true
    message = 'Вы управляете попапом. Автоматические действия отменены; исходный сценарий сохранён.'
  },
  changed: () => { publish() }
})

export function acknowledgeLabDriver(ack: LabDriverAck): void {
  if (!isLabProcess()) throw new Error('Native driver requires the isolated laboratory')
  playback.acknowledge(ack)
}

export function getLabState(): LabState {
  return { enabled: isLabProcess(), plan, cursor, playing: playback.playing, detached, interrupted, message,
    now: nowDate().toISOString(), activePopup: getActivePopup() !== null, playback: { ...playback.state }, hasOriginal: !!originalPlan && hasBranch,
    visualPreview: visualPreview ? { ...visualPreview } : null }
}

let labCommandQueue: Promise<unknown> = Promise.resolve()

/** Serialize commands from the lab host bridge and the native preview window. */
export function enqueueLabCommand(command: LabCommand): Promise<LabState> {
  const request = labCommandQueue.then(() => executeLabCommand(command)) as Promise<LabState>
  labCommandQueue = request.catch(() => undefined)
  return request
}

function publish(): LabState {
  const state = getLabState()
  // Always attach the sandbox snapshot so the embedded host can hydrate its
  // nested Pinia without sharing DataUpdated with the real dashboard profile.
  state.snapshot = getSnapshot()
  broadcastToWindows(IpcChannels.LabChanged, state)
  return state
}

function pause(): void {
  playback.pause()
}

function seek(next: number, silent = true): void {
  if (!plan || !Number.isInteger(next) || next < 0 || next >= plan.events.length) throw new Error('Invalid timeline position')
  playback.cancel()
  cancelLoopForLaboratory()
  configureLoopSimulation({ hold: true, freezeDeadline: true, idleSeconds: 0 })
  cursor = next
  detached = false
  interrupted = false
  setLaboratoryClock({ at: plan.events[cursor]!.at, running: false, silent })
  // Sound is a user preference, not a scenario parameter: a plan snapshot must not
  // mute the laboratory, otherwise a legacy muted profile silences every replay.
  applyDebugState({
    sessions: labSessionsAt(plan, cursor),
    settings: { ...plan.settings, sound: { ...getSnapshot().settings.sound } },
    progress: plan.progress
  })
  syncLoopFromSettings()
  notifyDataUpdated()
  message = plan.events[cursor]!.label
}

function knownExerciseIds(): string[] { return getAvailableCatalog().map(exercise => exercise.id) }

function load(next: LabPlan): void {
  pause()
  plan = upgradeLabPlan(next, knownExerciseIds())
  hasBranch = false
  // Imports cross the same normalization boundary as regular persisted settings.
  plan.settings = normalizeSettings(plan.settings)
  plan.progress = normalizeProgress(plan.progress)
  originalPlan = structuredClone(plan)
  seek(0)
  if (plan.convertedFrom) message = 'Формат 1: действия выведены из исходов, а не записаны. Просмотр дат сохраняет исходную историю.'
}

function projectResolved(session: Session): void {
  if (playback.resolved(session)) return
  pause()
  interrupted = true
  hasBranch = true
  detached = true
  if (plan) {
    plan = { ...plan, events: [...plan.events.slice(0, cursor + 1), {
      at: session.completedAt ?? session.triggeredAt, label: `Ручное событие · ${session.status}`, session, actions: labActions(session)
    }] }
    cursor = plan.events.length - 1
  }
  message = 'Событие записано. Воспроизведение остановлено; доступны ручная ветка и возврат к исходному сценарию.'
  publish()
}

function onResolved(session: Session): void {
  projectingResult = true
  try { projectResolved(session) }
  finally { projectingResult = false }
}

function onTriggered(): void {
  if (openingReplay) return
  playback.cancel()
  configureLoopSimulation({ hold: false, freezeDeadline: false })
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

export function stopLaboratory(): void { if (isLabProcess()) playback.cancel() }

/** Closing controls freezes the run and cancels the driver; the native popup remains inspectable. */
export function pauseLaboratory(): void { if (isLabProcess()) playback.pause() }

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

function openPopup(preset: Extract<LabCommand, { action: 'popup' }>['preset'], exerciseId?: string): void {
  if (!['normal', 'stage-up', 'soft', 'medium', 'hardcore', 'details'].includes(preset)) throw new Error('Invalid popup preset')
  if (exerciseId !== undefined && (typeof exerciseId !== 'string' || !getAvailableCatalog().some(exercise => exercise.id === exerciseId))) throw new Error('Unknown laboratory exercise')
  if (getPopupWindow()) throw new Error('Close the current popup first')
  pause()
  cancelLoopForLaboratory()
  if (preset === 'stage-up') {
    const next = buildLabScenario('growth', nowDate(), getSnapshot().settings, getSnapshot().progress)
    const milestones = labMilestones(next)
    const stageUp = milestones.find(index => labSessionsAt(next, index).filter(session => session.status === 'done').length === 3)
    load(next)
    seek(Math.max(0, (stageUp ?? 1) - 1))
  }
  const snapshot = getSnapshot()
  const settings = { ...snapshot.settings,
    ...(['soft', 'medium', 'hardcore'].includes(preset) ? { severity: preset as 'soft' | 'medium' | 'hardcore' } : {}),
    ...(preset === 'details' ? { sessionExtras: { enabled: true } } : {}) }
  applyDebugState({ sessions: snapshot.sessions, settings, progress: snapshot.progress })
  rememberLabPreferences()
  const at = nowDate().toISOString()
  setLaboratoryClock({ at, running: true, silent: false })
  configureLoopSimulation({ hold: false, idleSeconds: 0 })
  detached = true
  notifyDataUpdated()
  syncLoopFromSettings()
  if (exerciseId) triggerLaboratoryExercise(exerciseId)
  else triggerNow('manual')
  message = 'Настоящее окно Electron. Начните упражнение и проверьте результат вручную.'
}

function savedPath(): string { return join(getDataDir(), 'laboratory-run.json') }

export async function executeLabCommand(command: LabCommand): Promise<LabState> {
  if (!isLabProcess()) throw new Error('Open the isolated laboratory first')
  if (!command || typeof command.action !== 'string') throw new Error('Invalid laboratory command')
  switch (command.action) {
    case 'visual-preview': {
      const next = validateLabVisualPreview(command.preview)
      if (command.open !== undefined && typeof command.open !== 'boolean') throw new Error('Invalid visual preview')
      if (command.open || visualPreview) {
        const previous = visualPreview
        visualPreview = next
        try { if (command.open) openLabPreviewWindow(() => { visualPreview = null; publish() }) }
        catch (cause) { visualPreview = previous; throw cause }
      }
      break
    }
    case 'close-preview': closeLabPreviewWindow(); visualPreview = null; break
    case 'scenario': load(buildLabScenario(command.id, new Date(), getSnapshot().settings, getSnapshot().progress)); break
    case 'generate': load(buildRandomCalendar(command.options, getSnapshot().settings, getSnapshot().progress)); break
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
    case 'play':
      if (!plan || ![500, 1500, 3500].includes(command.delayMs)) throw new Error('Invalid playback speed or scenario')
      if (detached) seek(cursor)
      playback.play(command.delayMs)
      break
    case 'phase-step': playback.step(); break
    case 'mode':
      if (command.mode !== 'automatic' && command.mode !== 'interactive') throw new Error('Invalid playback mode')
      seek(cursor)
      playback.setMode(command.mode)
      break
    case 'restart': seek(0); break
    case 'original': {
      if (!originalPlan) throw new Error('No original scenario')
      const preferences = getSnapshot()
      const baseline = structuredClone(originalPlan)
      const selected = structuredClone(originalPlan)
      selected.settings = preferences.settings
      selected.progress.characterBuild = preferences.progress.characterBuild
      load(selected)
      originalPlan = baseline
      message = 'Исходный сценарий восстановлен. Ручная ветка заменена только в текущем просмотре.'
      break
    }
    case 'pause': pause(); message = 'Воспроизведение остановлено'; break
    case 'popup': openPopup(command.preset, command.exerciseId); break
    case 'restore-preferences': {
      if (!originalPlan) throw new Error('Choose a scenario first')
      if (getPopupWindow()) throw new Error('Close the current popup first')
      pause()
      updateSettings(originalPlan.settings)
      updateProgress({ ...getSnapshot().progress, characterBuild: originalPlan.progress.characterBuild })
      rememberLabPreferences()
      syncLoopFromSettings(); notifyDataUpdated()
      message = 'Параметры исходного сценария восстановлены. История и позиция сохранены.'
      break
    }
    case 'advance': {
      pause()
      if (!Number.isFinite(command.seconds) || command.seconds < 0 || command.seconds > 86400) throw new Error('Invalid time jump')
      const at = new Date(nowMs() + command.seconds * 1000).toISOString()
      setLaboratoryClock({ at, running: true, silent: false })
      configureLoopSimulation({ hold: false, freezeDeadline: false })
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
    case 'reset-history':
    case 'reset': {
      const preferences = getSnapshot()
      pause()
      cancelLoopForLaboratory()
      configureLoopSimulation({ hold: true, idleSeconds: 0 })
      playback.cancel()
      plan = null; originalPlan = null; hasBranch = false; cursor = 0; detached = false; interrupted = false
      setLaboratoryClock({ at: new Date().toISOString(), running: false, silent: true })
      applyDebugState({ sessions: [], settings: command.action === 'reset-history' ? preferences.settings : defaultSettings(),
        progress: { ...defaultProgress(), ...(command.action === 'reset-history' ? { characterBuild: preferences.progress.characterBuild } : {}) } })
      syncLoopFromSettings(); notifyDataUpdated()
      message = command.action === 'reset-history' ? 'История сброшена. Настройки, вес, фотографии и AI-упражнения сохранены.'
        : 'История и настройки сброшены. Вес, фотографии, AI-упражнения и сохранённый вариант не удалены.'
      break
    }
    case 'save':
      if (!plan) throw new Error('Choose a scenario first')
      validateLabPlan(plan, knownExerciseIds())
      writeJsonEnvelope(savedPath(), { plan, cursor, originalPlan, hasBranch, mode: playback.state.mode })
      message = 'Вариант и позиция сохранены в тестовом профиле'
      break
    case 'restore': {
      const saved = readJsonEnvelope<{ plan: unknown; cursor: number; originalPlan?: unknown; hasBranch?: boolean; mode?: string }>(savedPath())
      if (!saved || !Number.isInteger(saved.cursor)) throw new Error('No saved laboratory run')
      const restored = validateLabPlan(saved.plan, knownExerciseIds())
      if (saved.cursor < 0 || saved.cursor >= restored.events.length) throw new Error('Invalid saved position')
      const original = saved.originalPlan ? upgradeLabPlan(saved.originalPlan, knownExerciseIds()) : null
      load(restored); seek(saved.cursor)
      if (original) originalPlan = original
      hasBranch = saved.hasBranch === true
      if (saved.mode === 'interactive') playback.setMode(saved.mode)
      message = 'Сохранённый вариант восстановлен'
      break
    }
    case 'export': {
      pause()
      if (!plan) throw new Error('Choose a scenario first')
      validateLabPlan(plan, knownExerciseIds())
      const serialized = JSON.stringify({ plan, cursor, originalPlan, hasBranch, mode: playback.state.mode })
      if (Buffer.byteLength(serialized, 'utf8') > LAB_MAX_IMPORT_BYTES) throw new Error('Laboratory file is too large')
      const result = await dialog.showSaveDialog({ title: 'Сохранить сценарий лаборатории', defaultPath: 'body-debugger-scenario.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
      if (!result.canceled && result.filePath) {
        writeFileSync(result.filePath, serialized, 'utf8')
        message = 'Сценарий экспортирован'
      }
      break
    }
    case 'import': {
      pause()
      const result = await dialog.showOpenDialog({ title: 'Открыть сценарий лаборатории', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
      const path = result.filePaths[0]
      if (!result.canceled && path) {
        if (statSync(path).size > LAB_MAX_IMPORT_BYTES) throw new Error('Laboratory file is too large')
        const saved = JSON.parse(readFileSync(path, 'utf8')) as { plan: unknown; cursor: number; originalPlan?: unknown; hasBranch?: boolean; mode?: string }
        const imported = validateLabPlan(saved.plan, knownExerciseIds())
        if (!Number.isInteger(saved.cursor) || saved.cursor < 0 || saved.cursor >= imported.events.length) throw new Error('Invalid saved position')
        const original = saved.originalPlan ? upgradeLabPlan(saved.originalPlan, knownExerciseIds()) : null
        load(imported); seek(saved.cursor)
        if (original) originalPlan = original
        hasBranch = saved.hasBranch === true
        if (saved.mode === 'interactive') playback.setMode(saved.mode)
        message = 'Сценарий импортирован'
      }
      break
    }
    default: throw new Error('Unknown laboratory command')
  }
  return publish()
}

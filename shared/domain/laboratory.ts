import { EXERCISE_CATALOG } from '../constants/exercises'
import { computeCharacterProgress, characterJourney } from './character-progress'
import { computeCharacterCondition } from './character-condition'
import { computeStreak } from './streak'
import { pickNextExercise } from './exercise-picker'
import { cloneSettings } from './settings'
import { localDateKey } from './stats'
import { sanitizeSessions } from '../validation/session'
import type { AppSettings } from '../types/settings'
import type { UserProgress } from '../types/progress'
import type { Session, SessionStatus } from '../types/session'
import type { CharacterBranch } from '../types/character'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '../constants/character'

export const LAB_SCENARIOS = [
  { id: 'growth', title: 'От новичка до пика', description: 'Первые шаги, серии дней и все шесть форм' },
  { id: 'recovery', title: 'Форма → спад → восстановление', description: 'Заработанная форма, 10 пропусков и 5 восстановлений' },
  { id: 'return', title: 'Перерыв и возвращение', description: 'Серия дней, пустая неделя и возвращение без потери стадии' },
  { id: 'branches', title: 'Смена направления', description: 'Осанка → сила → подвижность; окно последних 30 выполнений' },
  { id: 'snooze', title: 'Всё откладываю', description: 'Откладывание, повтор, выполнение и таймаут' },
  { id: 'uneven', title: 'Неровный месяц', description: 'Рабочие дни, выходные, пропуски и восстановление' }
] as const

export type LabScenarioId = typeof LAB_SCENARIOS[number]['id']
export type LabActivity = 'regular' | 'uneven' | 'skips'
export type LabLoad = 'low' | 'normal' | 'high'
export interface LabGeneratorOptions {
  days: 7 | 30 | 90
  activity: LabActivity
  load: LabLoad
  direction: CharacterBranch
  seed: number
  endDate: string
}

export interface LabEvent {
  at: string
  label: string
  session?: Session
}

/** Resolved events are stored alongside parameters, so generator changes cannot alter saved runs. */
export interface LabPlan {
  version: 1
  id: string
  title: string
  settings: AppSettings
  progress: UserProgress
  events: LabEvent[]
  generator?: LabGeneratorOptions
}

export interface LabState {
  enabled: boolean
  plan: LabPlan | null
  cursor: number
  playing: boolean
  detached: boolean
  interrupted: boolean
  message: string
  now: string
  activePopup: boolean
}

export type LabCommand =
  | { action: 'scenario'; id: LabScenarioId }
  | { action: 'generate'; options: LabGeneratorOptions }
  | { action: 'seek'; cursor: number }
  | { action: 'step'; direction: -1 | 1; unit: 'event' | 'day' | 'milestone' }
  | { action: 'date'; date: string }
  | { action: 'play'; delayMs: number }
  | { action: 'popup'; preset: 'normal' | 'stage-up' | 'soft' | 'medium' | 'hardcore' | 'details' }
  | { action: 'advance'; seconds: number }
  | { action: 'idle'; seconds: number }
  | { action: 'pause' | 'reset' | 'save' | 'restore' | 'export' | 'import' | 'detach' | 'fail-save' }

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function normalizeGenerator(value: LabGeneratorOptions): LabGeneratorOptions {
  if (!value || ![7, 30, 90].includes(value.days) || !['regular', 'uneven', 'skips'].includes(value.activity)
    || !['low', 'normal', 'high'].includes(value.load)
    || !['neutral', 'posture', 'power', 'mobility'].includes(value.direction)
    || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff
    || typeof value.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.endDate)) {
    throw new Error('Invalid calendar parameters')
  }
  const date = new Date(`${value.endDate}T12:00:00`)
  if (!Number.isFinite(date.getTime()) || localDateKey(date) !== value.endDate
    || date.getFullYear() < 2000 || date.getFullYear() > 2100) throw new Error('Invalid calendar date')
  if (new Date(date.getFullYear(), date.getMonth(), date.getDate() - value.days + 1).getFullYear() < 2000) {
    throw new Error('Calendar period starts before 2000')
  }
  return { ...value }
}

function buildDirectionCatalog(direction: CharacterBranch) {
  const withoutEquipment = EXERCISE_CATALOG.filter(exercise => !exercise.equipment?.length)
  if (direction === 'neutral') return withoutEquipment
  return withoutEquipment.filter(exercise => computeCharacterProgress(
    Array.from({ length: 3 }, (_, index) => ({
      id: `classify-${index}`, exerciseId: exercise.id, status: 'done' as const,
      durationSec: exercise.durationSec, triggeredAt: '2026-01-01T09:00:00Z'
    }))
  ).branch === direction)
}

const DIRECTION_CATALOGS = {
  neutral: buildDirectionCatalog('neutral'), posture: buildDirectionCatalog('posture'),
  power: buildDirectionCatalog('power'), mobility: buildDirectionCatalog('mobility')
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  done: 'Выполнено', skipped: 'Пропуск', snoozed: 'Отложено', missed: 'Таймаут'
}

function createPlan(id: string, title: string, settings: AppSettings, progress: UserProgress): LabPlan {
  return {
    version: 1, id, title, settings: cloneSettings(settings),
    progress: { ...progress, streak: { current: 0, max: 0 }, characterStage: 0, characterBranch: 'neutral',
      exerciseLevels: {}, focus: { primary: progress.focus.primary, accents: [...progress.focus.accents] } },
    events: []
  }
}

function addSession(plan: LabPlan, at: Date, status: SessionStatus, direction: CharacterBranch, random: () => number) {
  const catalog = DIRECTION_CATALOGS[direction]
  if (!catalog.length) throw new Error(`No exercises for ${direction}`)
  const exercise = pickNextExercise({ catalog, recentSessions: plan.events.flatMap(event => event.session ? [event.session] : []),
    settings: plan.settings, now: at, random })
  const completedAt = new Date(at.getTime() + exercise.durationSec * 1000).toISOString()
  const session: Session = {
    id: `lab-${plan.id}-${plan.events.length}`, exerciseId: exercise.id, status,
    durationSec: exercise.durationSec, triggeredAt: at.toISOString(), completedAt
  }
  plan.events.push({ at: completedAt, label: `${STATUS_LABELS[status]} · ${exercise.title}`, session })
}

export function buildRandomCalendar(raw: LabGeneratorOptions, settings: AppSettings, progress: UserProgress): LabPlan {
  const options = normalizeGenerator(raw)
  const random = seededRandom(options.seed)
  const plan = createPlan(`random-${options.seed}`, `Случайный календарь · ${options.days} дней · #${options.seed}`, settings, progress)
  plan.generator = options
  const end = new Date(`${options.endDate}T12:00:00`)
  let activeYesterday = true
  for (let day = 0; day < options.days; day++) {
    const date = new Date(end.getFullYear(), end.getMonth(), end.getDate() - options.days + 1 + day, 8)
    plan.events.push({ at: date.toISOString(), label: 'Начало дня' })
    const weekend = date.getDay() === 0 || date.getDay() === 6
    const chance = options.activity === 'regular' ? 0.95 : options.activity === 'uneven' ? 0.78 : 0.65
    const active: boolean = random() < chance - (weekend ? 0.2 : 0) - (activeYesterday ? 0 : 0.15)
    activeYesterday = active
    if (!active) continue
    const base = options.load === 'low' ? 1 : options.load === 'normal' ? 3 : 5
    const count = Math.max(1, base + Math.floor(random() * 3) - 1)
    for (let index = 0; index < count; index++) {
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9 + index, Math.floor(random() * 20))
      const roll = random()
      const skipChance = options.activity === 'skips' ? 0.4 : 0.1
      const status: SessionStatus = roll < skipChance ? 'skipped' : roll < skipChance + 0.07 ? 'missed' : 'done'
      if (random() < 0.15) {
        addSession(plan, at, 'snoozed', options.direction, random)
        at.setMinutes(at.getMinutes() + 5)
      }
      addSession(plan, at, status, options.direction, random)
    }
  }
  plan.events.push({ at: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 20).toISOString(), label: 'Конец периода' })
  return plan
}

export function buildLabScenario(id: LabScenarioId, end: Date, settings: AppSettings, progress: UserProgress): LabPlan {
  const descriptor = LAB_SCENARIOS.find(scenario => scenario.id === id)
  if (!descriptor) throw new Error('Unknown laboratory scenario')
  if (id === 'uneven') return { ...buildRandomCalendar({ days: 30, activity: 'uneven', load: 'normal',
    direction: 'neutral', seed: 4242, endDate: localDateKey(end) }, settings, progress), id, title: descriptor.title }
  const plan = createPlan(id, descriptor.title, settings, progress)
  const random = seededRandom(73)
  const days = id === 'branches' ? 36 : id === 'growth' ? 40 : id === 'recovery' ? 30 : 16
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - days + 1, 8)
  plan.events.push({ at: start.toISOString(), label: 'Начало истории' })
  for (let day = 0; day < days; day++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day, 9)
    plan.events.push({ at: new Date(date.getTime() - 3600000).toISOString(), label: 'Начало дня' })
    if (id === 'return' && day >= 7 && day < 14) continue
    const count = id === 'growth' ? 2 : id === 'branches' ? 3 : id === 'recovery' && day < 15 ? 3 : 1
    for (let index = 0; index < count; index++) {
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9 + index)
      const direction = id === 'branches' ? (day < 12 ? 'posture' : day < 24 ? 'power' : 'mobility') : 'neutral'
      const status = id === 'recovery' && day >= 15 && day < 25 ? (day % 2 ? 'skipped' : 'missed') : 'done'
      if (id === 'snooze') {
        addSession(plan, at, 'snoozed', direction, random)
        at.setMinutes(5)
        addSession(plan, at, day % 3 === 0 ? 'missed' : 'done', direction, random)
      } else addSession(plan, at, status, direction, random)
    }
  }
  return plan
}

export function labSessionsAt(plan: LabPlan, cursor: number): Session[] {
  return plan.events.slice(0, cursor + 1).flatMap(event => event.session ? [{ ...event.session }] : [])
}

export function labSummary(plan: LabPlan, cursor: number) {
  const sessions = labSessionsAt(plan, cursor)
  const at = new Date(plan.events[cursor]!.at)
  return { journey: characterJourney(sessions), character: computeCharacterProgress(sessions),
    condition: computeCharacterCondition(sessions), streak: computeStreak(sessions, at) }
}

export function labMilestones(plan: LabPlan): number[] {
  const result = [0]
  let previous = labSummary(plan, 0)
  for (let index = 1; index < plan.events.length; index++) {
    const current = labSummary(plan, index)
    if (current.character.stage !== previous.character.stage || current.character.branch !== previous.character.branch
      || current.condition.level !== previous.condition.level || (previous.streak.current > 0 && current.streak.current === 0)) result.push(index)
    previous = current
  }
  const last = plan.events.length - 1
  if (result[result.length - 1] !== last) result.push(last)
  return result
}

export function labEventExplanation(plan: LabPlan, cursor: number): string {
  if (cursor === 0) return 'Начальное состояние. Будущие события не участвуют в расчётах.'
  const before = labSummary(plan, cursor - 1)
  const after = labSummary(plan, cursor)
  const changes: string[] = []
  if (before.character.stage !== after.character.stage) changes.push(`Новая форма: ${CHARACTER_STAGE_LABELS[after.character.stage]}`)
  if (before.character.branch !== after.character.branch) changes.push(`Направление: ${CHARACTER_BRANCH_LABELS[after.character.branch]}`)
  if (before.condition.points !== after.condition.points) changes.push(`Ухудшение: ${before.condition.points} → ${after.condition.points} / 10; достигнутая форма сохранена`)
  if (before.streak.current > 0 && after.streak.current === 0) changes.push('Серия дней прервана; пустые дни не ухудшают тело')
  else if (after.streak.current > before.streak.current) changes.push(`Серия: ${after.streak.current} дней`)
  if (plan.events[cursor]?.session?.status === 'snoozed') changes.push('Откладывание не добавляет ухудшения и не продвигает форму')
  return changes.join(' · ') || 'Форма и состояние без изменений'
}

/** Strict import boundary: bounded size, known exercises, chronology and unique identities. */
export function validateLabPlan(raw: unknown): LabPlan {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid laboratory file')
  const value = raw as LabPlan
  if (value.version !== 1 || typeof value.id !== 'string' || value.id.length > 80
    || typeof value.title !== 'string' || value.title.length > 200 || !value.settings || !value.progress
    || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 2000) throw new Error('Invalid laboratory file')
  let previous = -Infinity
  const ids = new Set<string>()
  const catalog = new Set(EXERCISE_CATALOG.map(exercise => exercise.id))
  for (const event of value.events) {
    const at = Date.parse(event?.at)
    if (!Number.isFinite(at) || at < previous || new Date(at).getUTCFullYear() < 2000 || new Date(at).getUTCFullYear() > 2100
      || typeof event.label !== 'string' || event.label.length > 300) throw new Error('Invalid laboratory event')
    previous = at
    if (!event.session) continue
    const session = sanitizeSessions([event.session])[0]
    if (!session || ids.has(session.id) || !catalog.has(session.exerciseId)
      || Date.parse(session.completedAt ?? session.triggeredAt) !== at
      || Date.parse(session.triggeredAt) > at) throw new Error('Invalid laboratory session')
    ids.add(session.id)
  }
  return JSON.parse(JSON.stringify(value)) as LabPlan
}

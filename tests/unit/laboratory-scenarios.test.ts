// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { LAB_SCENARIOS, buildLabScenario, buildRandomCalendar, labMilestones, labSessionsAt, labSummary,
  validateLabPlan, type LabGeneratorOptions } from '@shared/domain/laboratory'
import { localDateKey } from '@shared/domain/stats'
import { defaultProgress, defaultSettings } from '../../electron/main/persistence/defaults'

const NOW = new Date(2026, 9, 30, 12)
function build(id: typeof LAB_SCENARIOS[number]['id']) {
  return buildLabScenario(id, NOW, defaultSettings(), defaultProgress())
}
const options: LabGeneratorOptions = { days: 30, activity: 'uneven', load: 'normal', direction: 'neutral', seed: 4242, endDate: '2026-10-30' }

describe('laboratory stories', () => {
  it.each(LAB_SCENARIOS)('builds a valid reproducible $id story without mutating inputs', ({ id }) => {
    const settings = defaultSettings()
    const progress = defaultProgress()
    const plan = buildLabScenario(id, NOW, settings, progress)
    expect(validateLabPlan(plan)).toEqual(plan)
    expect(build(id)).toEqual(plan)
    expect(settings).toEqual(defaultSettings())
    expect(progress).toEqual(defaultProgress())
    expect(plan.settings).not.toBe(settings)
    expect(labSummary(plan, 0).journey.done).toBe(0)
  })

  it('visits every earned stage and reaches the peak at 80 completions', () => {
    const plan = build('growth')
    expect(new Set(plan.events.map((_, index) => labSummary(plan, index).character.stage))).toEqual(new Set([0, 1, 2, 3, 4, 5]))
    expect(labSummary(plan, plan.events.length - 1).journey.done).toBe(80)
    expect(labMilestones(plan)).toContain(plan.events.length - 1)
  })

  it('keeps earned form through all neglect levels and recovers in five completions', () => {
    const plan = build('recovery')
    const peakDebt = plan.events.findIndex((_, index) => labSummary(plan, index).condition.points === 10)
    expect(peakDebt).toBeGreaterThan(0)
    expect(labSummary(plan, peakDebt)).toMatchObject({ character: { stage: 4 }, condition: { level: 3, recoverySessions: 5 } })
    const recovered = labSummary(plan, plan.events.length - 1)
    expect(recovered.character.stage).toBe(4)
    expect(recovered.condition.points).toBe(0)
    expect(new Set(plan.events.map((_, index) => labSummary(plan, index).condition.level))).toEqual(new Set([0, 1, 2, 3]))
  })

  it('lets empty days expire a streak without adding neglect or losing the stage', () => {
    const plan = build('return')
    const breakAt = plan.events.findIndex((event, index) => !event.session && index > 15 && labSummary(plan, index).streak.current === 0)
    expect(breakAt).toBeGreaterThan(0)
    expect(labSummary(plan, breakAt)).toMatchObject({ character: { stage: 1 }, condition: { points: 0 }, streak: { current: 0, max: 7 } })
    expect(labMilestones(plan)).toContain(breakAt)
  })

  it('passes through posture, power and mobility using the real branch rules', () => {
    const plan = build('branches')
    const branches = new Set(plan.events.map((_, index) => labSummary(plan, index).character.branch))
    expect(branches).toEqual(new Set(['neutral', 'posture', 'power', 'mobility']))
    expect(labSummary(plan, plan.events.length - 1).character.branch).toBe('mobility')
  })

  it('reconstructs an earlier prefix without leaking future sessions or aliasing the plan', () => {
    const plan = build('growth')
    const later = labSessionsAt(plan, plan.events.length - 1)
    const before = labSessionsAt(plan, 3)
    expect(before.length).toBeLessThan(later.length)
    expect(labSummary(plan, 0).streak.max).toBe(0)
    before[0]!.status = 'missed'
    expect(labSessionsAt(plan, 3)[0]!.status).toBe('done')
  })
})

describe('random calendars', () => {
  it.each([7, 30, 90] as const)('keeps %i local days bounded, valid and deterministic', days => {
    const plan = buildRandomCalendar({ ...options, days }, defaultSettings(), defaultProgress())
    expect(validateLabPlan(plan)).toEqual(plan)
    expect(plan).toEqual(buildRandomCalendar({ ...options, days }, defaultSettings(), defaultProgress()))
    const dates = new Set(plan.events.map(event => localDateKey(new Date(event.at))))
    expect(dates.size).toBe(days)
    expect(localDateKey(new Date(plan.events[plan.events.length - 1]!.at))).toBe(options.endDate)
    expect(plan.events.length).toBeLessThan(800)
  })
  it('changes the resolved calendar when the seed changes', () => {
    expect(buildRandomCalendar(options, defaultSettings(), defaultProgress()).events).not.toEqual(
      buildRandomCalendar({ ...options, seed: 74 }, defaultSettings(), defaultProgress()).events)
  })
  it.each(['posture', 'power', 'mobility'] as const)('honors the %s direction', direction => {
    const plan = buildRandomCalendar({ ...options, days: 90, activity: 'regular', direction }, defaultSettings(), defaultProgress())
    expect(labSummary(plan, plan.events.length - 1).character.branch).toBe(direction)
  })
  it.each([
    { days: 365 }, { seed: -1 }, { seed: 1.5 }, { seed: 4294967296 }, { endDate: '2026-02-30' },
    { endDate: '1999-12-31' }, { endDate: '2000-01-01' }, { activity: 'unknown' }, { load: null }, { direction: 'unknown' }
  ])('rejects invalid options %j', invalid => {
    expect(() => buildRandomCalendar({ ...options, ...invalid } as LabGeneratorOptions, defaultSettings(), defaultProgress())).toThrow()
  })
})

describe('laboratory import boundary', () => {
  it.each(['duplicate', 'unknown-exercise', 'backwards', 'wrong-completion', 'oversized', 'empty'] as const)('rejects %s events', kind => {
    const plan = build('growth')
    const first = plan.events.find(event => event.session)!
    if (kind === 'duplicate') plan.events.push({ ...plan.events[plan.events.length - 1]!, session: { ...first.session! } })
    if (kind === 'unknown-exercise') first.session!.exerciseId = 'not-in-catalog'
    if (kind === 'backwards') plan.events.reverse()
    if (kind === 'wrong-completion') first.session!.completedAt = '2026-01-01T00:00:00Z'
    if (kind === 'oversized') plan.events = Array(2001).fill(plan.events[0])
    if (kind === 'empty') plan.events = []
    expect(() => validateLabPlan(plan)).toThrow()
  })
})

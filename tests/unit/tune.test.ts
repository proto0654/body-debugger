// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { exerciseHints } from '@shared/domain/tune'
import { upgradeExercise } from '@shared/domain/exercise-v2'
import { resolveCatalog } from '@shared/domain/catalog'
import { makeExercise, makeSession, daysAgo } from '../fixtures'

describe('exerciseHints', () => {
  const catalog = resolveCatalog(
    [upgradeExercise(makeExercise({ id: 'a', category: 'neck' }))],
    []
  )

  it('marks ready_to_progress after five done shows', () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(5 - index) })
    )
    const hints = exerciseHints(sessions, catalog)
    expect(hints).toEqual([
      expect.objectContaining({ exerciseId: 'a', kind: 'ready_to_progress', suggestedScale: 1.1 })
    ])
  })

  it('marks often_skipped after three skips in five shows and ignores snoozed', () => {
    const sessions = [
      makeSession({ exerciseId: 'a', status: 'skipped', triggeredAt: daysAgo(5) }),
      makeSession({ exerciseId: 'a', status: 'missed', triggeredAt: daysAgo(4) }),
      makeSession({ exerciseId: 'a', status: 'skipped', triggeredAt: daysAgo(3) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(2) }),
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(1) }),
      makeSession({ exerciseId: 'a', status: 'snoozed', triggeredAt: daysAgo(0) })
    ]
    const hints = exerciseHints(sessions, catalog)
    expect(hints[0]?.kind).toBe('often_skipped')
  })

  it('respects cooldown ids', () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      makeSession({ exerciseId: 'a', status: 'done', triggeredAt: daysAgo(5 - index) })
    )
    expect(exerciseHints(sessions, catalog, {}, new Set(['a']))).toEqual([])
  })
})

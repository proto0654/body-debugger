import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionsStore } from '@/stores/sessions'
import { makeExercise, makeSession } from '../fixtures'

const exercise = makeExercise({ id: 'neck-circles', durationSec: 45 })

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('sessions store', () => {
  it('starts a session from the main-provided exercise', () => {
    const store = useSessionsStore()
    const session = store.beginSession(exercise, 'session-1')

    expect(session.id).toBe('session-1')
    expect(session.exerciseId).toBe('neck-circles')
    expect(session.status).toBe('missed')
    expect(session.durationSec).toBe(45)
    expect(store.current?.id).toBe('session-1')
    expect(store.currentExercise?.id).toBe('neck-circles')
  })

  it('picks an exercise from the catalog when none is provided', () => {
    const store = useSessionsStore()
    const session = store.beginSession()
    expect(session.exerciseId).toBeTruthy()
    expect(store.currentExercise?.id).toBe(session.exerciseId)
  })

  it('records a result into history and clears the current session', () => {
    const store = useSessionsStore()
    store.beginSession(exercise, 'session-2')

    const recorded = store.recordResult('done', { reps: 12 })

    expect(recorded?.status).toBe('done')
    expect(recorded?.reps).toBe(12)
    expect(recorded?.completedAt).toBeTruthy()
    expect(store.history).toHaveLength(1)
    expect(store.history[0].id).toBe('session-2')
    expect(store.current).toBeNull()
    expect(store.lastSession?.id).toBe('session-2')
  })

  it('returns null when there is no active session', () => {
    const store = useSessionsStore()
    expect(store.recordResult('done')).toBeNull()
    expect(store.history).toHaveLength(0)
  })

  it('hydrates a copy of the history', () => {
    const store = useSessionsStore()
    const source = [makeSession({ exerciseId: 'neck-circles' })]
    store.hydrate(source)

    source.push(makeSession({ exerciseId: 'hips' }))

    expect(store.history).toHaveLength(1)
    expect(store.lastSession?.exerciseId).toBe('neck-circles')
  })

  it('clears both the current session and its exercise', () => {
    const store = useSessionsStore()
    store.beginSession(exercise, 'session-3')
    store.clearCurrent()
    expect(store.current).toBeNull()
    expect(store.currentExercise).toBeNull()
  })
})

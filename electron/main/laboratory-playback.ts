import type { LabEvent, LabPlan } from '../../shared/domain/laboratory'
import { ARCADE_SCENE_MS, labActions, type LabDriverAck, type LabDriverAction, type LabDriverCommand,
  type LabPlaybackMode, type LabPlaybackState, type LabPhase } from '../../shared/domain/laboratory-playback'
import type { Session } from '../../shared/types/session'
import type { SeverityLevel } from '../../shared/types/settings'
import { REACTION_TIMING_MS } from '../../shared/domain/reaction-timing'

export { ARCADE_SCENE_MS }

/** Wait for popup ready / save / hold without tying to exercise wall-clock. */
const ARCADE_ACTION_MS = 15_000
/**
 * Voice lines can outlast the reading floor; keep the window open until
 * feedback-complete or this generous ceiling while the popup is still alive.
 */
const ARCADE_FEEDBACK_MS = REACTION_TIMING_MS.milestone + REACTION_TIMING_MS.exit + 120_000

export interface NativePlaybackPort {
  plan(): LabPlan | null
  cursor(): number
  now(): number
  severity(): SeverityLevel
  move(index: number): void
  /** Optional sandbox/app clock; arcade play does not accelerate exercise timers. */
  clock(at: number, running: boolean, rate: number): void
  open(event: LabEvent, generation: number): string
  active(): boolean
  close(): void
  timeout(): void
  send(command: LabDriverCommand): void
  commit(index: number, session: Session, manual: boolean): void
  changed(): void
  intervention(): void
}

/**
 * Shared arcade replay for laboratory + chronicle: one non-overlapping link at a
 * time (cursor jump → scene beat → popup → semantic driver → voice feedback → close).
 */
export class NativePlayback {
  state: LabPlaybackState = { generation: 0, mode: 'automatic', phase: 'idle', eventIndex: null,
    sessionId: null, action: '', waiting: false, paused: true, error: '' }
  lastCommand: LabDriverCommand | null = null
  private timer?: ReturnType<typeof setTimeout>
  private due = 0
  private remaining = 0
  private sequence = 0
  private ready = false
  private manual = false
  private failedPhase: LabPhase | null = null
  private feedbackComplete = false
  private feedbackDeadline = 0

  constructor(private readonly port: NativePlaybackPort) {}

  get playing(): boolean { return !this.state.paused }

  private update(phase?: LabPhase): void {
    if (phase) this.state.phase = phase
    this.port.changed()
  }

  private send(action: LabDriverAction): void {
    if (!this.state.sessionId) return
    this.lastCommand = { generation: this.state.generation, sessionId: this.state.sessionId,
      sequence: ++this.sequence, action }
    this.port.send(this.lastCommand)
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }

  private schedule(delay: number): void {
    this.clearTimer()
    if (!this.playing) return
    const generation = this.state.generation
    this.due = Date.now() + delay
    this.timer = setTimeout(() => {
      this.timer = undefined
      if (generation !== this.state.generation || !this.playing) return
      try { this.advance() }
      catch (error) {
        console.error('[playback] arcade phase failed', error)
        this.fail('Не удалось выполнить фазу. Повторите действие или перейдите к дате.')
      }
    }, delay)
  }

  private freeze(): void { this.port.clock(this.port.now(), false, 1) }

  pause(): void {
    this.remaining = this.timer ? Math.max(0, this.due - Date.now()) : 0
    this.clearTimer()
    this.state.paused = true
    this.freeze()
    this.send('cancel')
    this.update()
  }

  cancel(): void {
    this.pause()
    this.state = { ...this.state, generation: this.state.generation + 1, phase: 'idle', eventIndex: null,
      sessionId: null, waiting: false, action: '', error: '' }
    this.lastCommand = null
    this.ready = false
    this.manual = false
    this.remaining = 0
    this.update()
  }

  setMode(mode: LabPlaybackMode): void {
    if (mode !== 'automatic' && mode !== 'interactive') throw new Error('Invalid playback mode')
    this.cancel()
    this.state.mode = mode
    this.update()
  }

  /** Start or resume arcade play. Tempo controls are gone — beats are fixed. */
  play(): void {
    if (!this.port.plan()) throw new Error('Invalid playback scenario')
    if (this.state.phase === 'finished') return
    const wasPaused = this.state.paused
    this.state.paused = false
    if (this.state.phase === 'error') {
      this.feedbackDeadline = Date.now() + ARCADE_FEEDBACK_MS
      this.state.error = ''
      this.state.waiting = false
      this.state.phase = this.failedPhase ?? 'idle'
      if (this.state.phase === 'saving' || this.state.phase === 'choice') {
        this.highlightChoice()
        return
      }
      if (this.state.phase === 'reminder' && !this.ready) {
        this.schedule(ARCADE_ACTION_MS)
        this.update()
        return
      }
    }
    if (wasPaused && this.state.phase === 'exercise') {
      // Arcade skips wall-clock exercise — jump straight to the choice.
      this.highlightChoice()
    } else if (this.state.phase === 'saving') this.choose()
    else this.schedule(this.remaining || ARCADE_SCENE_MS)
    this.remaining = 0
    this.update()
  }

  step(): void {
    if (!this.port.plan()) throw new Error('Choose a scenario first')
    this.pause()
    this.advance()
  }

  private fail(message: string): void {
    this.failedPhase = this.state.phase
    this.pause()
    this.state.error = message
    this.state.waiting = false
    this.update('error')
  }

  private event(): LabEvent | undefined {
    return this.state.eventIndex === null ? undefined : this.port.plan()?.events[this.state.eventIndex]
  }

  private nextEvent(): void {
    const plan = this.port.plan()
    const index = this.port.cursor() + 1
    const event = plan?.events[index]
    if (!event) {
      this.pause()
      this.state.sessionId = null
      this.update('finished')
      return
    }
    this.state.eventIndex = index
    this.state.sessionId = null
    this.state.waiting = false
    this.state.action = event.label
    this.port.move(index)
    this.port.clock(Math.max(this.port.now(), Date.parse(event.at)), false, 1)
    if (!event.session) {
      this.update('gap')
      this.schedule(ARCADE_SCENE_MS)
      return
    }
    this.ready = false
    this.manual = false
    this.feedbackComplete = false
    // Scene beat first so calendar/portrait jump before the popup opens.
    this.update('gap')
    this.schedule(ARCADE_SCENE_MS)
  }

  private openCurrent(): void {
    const event = this.event()
    if (!event?.session) {
      this.nextEvent()
      return
    }
    this.ready = false
    this.manual = false
    this.state.sessionId = this.port.open(event, this.state.generation)
    this.state.waiting = true
    this.update('reminder')
    this.schedule(ARCADE_ACTION_MS)
  }

  acknowledge(ack: LabDriverAck): void {
    if (!ack || ack.sessionId !== this.state.sessionId) return
    if (ack.kind === 'feedback-complete') {
      if (!['saved', 'reaction', 'closing'].includes(this.state.phase)) return
      this.feedbackComplete = true
      this.update('closing')
      this.schedule(100)
      return
    }
    if (ack.kind === 'ready') {
      if ((this.state.phase !== 'reminder' && !(this.state.phase === 'error' && this.failedPhase === 'reminder')) || this.ready) return
      this.ready = true
      this.remaining = 0
      this.state.waiting = false
      this.clearTimer()
      this.update()
      this.schedule(ARCADE_SCENE_MS)
      return
    }
    if (ack.kind === 'manual') {
      // Automatic arcade: a click aborts the whole run. Interactive lab keeps
      // the popup open for a real choice.
      if (this.state.mode === 'automatic') this.abortFromUser()
      else this.intervene()
      return
    }
    const last = this.lastCommand
    if (!last || ack.generation !== last.generation || ack.generation !== this.state.generation
      || ack.sequence !== last.sequence || last.action === 'cancel') return
    if (ack.kind === 'failed') {
      this.fail('Результат не сохранён. Повтор использует то же упражнение и ту же сессию.')
      return
    }
    if (ack.kind === 'applied' && last.action === 'start') {
      this.state.waiting = false
      // No exercise clock — go to the outcome highlight immediately.
      this.update('exercise')
      this.schedule(ARCADE_SCENE_MS)
    }
  }

  intervene(): void {
    if (!this.state.sessionId || this.state.phase === 'saved' || this.state.phase === 'reaction' || this.state.phase === 'closing') return
    this.clearTimer()
    this.remaining = 0
    this.manual = true
    this.state.mode = 'interactive'
    this.state.waiting = true
    this.send('cancel')
    this.port.clock(this.port.now(), !this.state.paused, 1)
    this.port.intervention()
    this.update()
  }

  /** Stop automatic arcade immediately — used when the user clicks the driven popup. */
  private abortFromUser(): void {
    this.clearTimer()
    this.remaining = 0
    this.send('cancel')
    this.port.close()
    this.port.intervention()
    this.state.paused = true
    this.state.waiting = false
    this.state.sessionId = null
    this.state.action = 'Сценарий прерван'
    this.state.error = ''
    this.update('finished')
  }

  resolved(session: Session): boolean {
    if (session.id !== this.state.sessionId || this.state.eventIndex === null
      || ['saved', 'reaction', 'closing', 'repeat', 'finished', 'idle'].includes(this.state.phase)) return false
    this.clearTimer()
    const event = this.event()
    const manual = this.manual || this.state.mode === 'interactive' || session.status !== event?.session?.status
      || (session.skipReason === 'popup-closed' && !event?.actions?.includes('close'))
    this.freeze()
    this.feedbackComplete = session.status === 'missed' || session.skipReason === 'popup-closed'
    this.feedbackDeadline = Date.now() + ARCADE_FEEDBACK_MS
    this.state.waiting = false
    this.port.commit(this.state.eventIndex, session, manual)
    this.update('saved')
    this.schedule(ARCADE_SCENE_MS)
    return true
  }

  private highlightChoice(): void {
    const session = this.event()?.session
    if (!session) return
    const outcome = session.status
    this.state.action = outcome === 'done' ? 'Выбрал: Готово' : outcome === 'snoozed' ? 'Выбрал: Отложить'
      : outcome === 'missed' ? 'Напоминание осталось без ответа' : session.skipReason === 'popup-closed' ? 'Закрыл попап' : 'Выбрал: Пропустить'
    if (outcome !== 'missed' && session.skipReason !== 'popup-closed') {
      this.send(outcome === 'done' ? 'highlight-done' : outcome === 'snoozed' ? 'highlight-snoozed' : 'highlight-skipped')
    }
    this.state.waiting = this.state.mode === 'interactive'
    this.update('choice')
    if (!this.state.waiting) this.schedule(ARCADE_SCENE_MS)
  }

  private choose(): void {
    const event = this.event()
    if (!event?.session) return
    this.state.waiting = true
    this.update('saving')
    if (event.session.status === 'missed') {
      // Arcade never waits out the real miss timer (chronicle has no lab clock).
      this.port.timeout()
    } else if (event.actions?.includes('close')) {
      this.port.close()
    } else {
      // Automatic arcade emulates Hardcore — no real hold gesture. Interactive
      // lab still uses the genuine hold path.
      const status = event.session.status
      if (status === 'done' && this.port.severity() === 'hardcore' && this.state.mode === 'interactive') {
        this.send('hold')
      } else {
        this.send(status as LabDriverAction)
      }
    }
    if (this.state.phase === 'saving') this.schedule(ARCADE_ACTION_MS)
  }

  private advance(): void {
    switch (this.state.phase) {
      case 'idle': case 'repeat':
        this.nextEvent()
        break
      case 'gap': {
        const event = this.event()
        if (event?.session && !this.state.sessionId) this.openCurrent()
        else this.nextEvent()
        break
      }
      case 'reminder':
        if (!this.ready) {
          if (this.playing) this.fail('Попап не подтвердил готовность. Откройте сценарий заново.')
          return
        }
        if ((this.event()?.actions ?? labActions(this.event()!.session!)).includes('start')) {
          this.send('highlight-start')
          this.update('start')
          this.schedule(ARCADE_SCENE_MS)
        } else if (this.event()?.session?.status === 'missed') {
          if (this.state.mode === 'interactive') { this.highlightChoice(); return }
          this.state.action = 'Таймаут без ответа'
          this.update('exercise')
          this.schedule(ARCADE_SCENE_MS)
        } else this.highlightChoice()
        break
      case 'start':
        this.state.waiting = true
        this.schedule(ARCADE_ACTION_MS)
        this.send('start')
        break
      case 'exercise':
        this.highlightChoice()
        break
      case 'choice':
        if (this.state.mode === 'interactive') { this.state.waiting = true; this.update(); return }
        this.choose()
        break
      case 'saving': this.fail('Ожидаем сохранения. Проверьте попап и повторите действие.'); break
      case 'saved': this.update('reaction'); this.schedule(100); break
      case 'reaction':
        // Arcade must not skip ahead on a closed window alone — wait for the popup
        // to finish the spoken line (`feedback-complete`) or the safety deadline.
        if (this.feedbackComplete) { this.update('closing'); this.schedule(100) }
        else if (Date.now() >= this.feedbackDeadline) this.fail('Результат сохранён. Закройте попап, чтобы продолжить сценарий.')
        else this.schedule(100)
        break
      case 'closing':
        if (this.port.active() && !this.feedbackComplete) {
          if (Date.now() >= this.feedbackDeadline) this.fail('Результат сохранён. Закройте попап, чтобы продолжить сценарий.')
          else this.schedule(100)
          break
        }
        if (this.port.active()) {
          this.port.close()
          this.schedule(100)
          break
        }
        this.state.sessionId = null
        // Arcade: no five-minute snooze wait — scene beat happens inside nextEvent.
        this.nextEvent()
        break
      case 'error': case 'finished': break
    }
  }
}

import type { LabEvent, LabPlan } from '../../shared/domain/laboratory'
import { labActions, type LabDriverAck, type LabDriverAction, type LabDriverCommand,
  type LabPlaybackMode, type LabPlaybackState, type LabPhase } from '../../shared/domain/laboratory-playback'
import type { Session } from '../../shared/types/session'
import type { SeverityLevel } from '../../shared/types/settings'

export interface NativePlaybackPort {
  plan(): LabPlan | null
  cursor(): number
  now(): number
  severity(): SeverityLevel
  move(index: number): void
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

/** Main-owned semantic replay. All results still come from the real session loop. */
export class NativePlayback {
  state: LabPlaybackState = { generation: 0, mode: 'automatic', phase: 'idle', eventIndex: null,
    sessionId: null, action: '', waiting: false, paused: true, error: '' }
  lastCommand: LabDriverCommand | null = null
  private timer?: ReturnType<typeof setTimeout>
  private due = 0
  private remaining = 0
  private delay = 1500
  private sequence = 0
  private ready = false
  private manual = false
  private targetTime = 0
  private exerciseEnd = 0
  private failedPhase: LabPhase | null = null

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

  private schedule(delay = this.delay): void {
    this.clearTimer()
    if (!this.playing) return
    const generation = this.state.generation
    this.due = Date.now() + delay
    this.timer = setTimeout(() => {
      this.timer = undefined
      if (generation !== this.state.generation || !this.playing) return
      try { this.advance() }
      catch (error) {
        console.error('[laboratory] native phase failed', error)
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

  play(delay: number): void {
    if (![500, 1500, 3500].includes(delay) || !this.port.plan()) throw new Error('Invalid playback speed or scenario')
    this.delay = delay
    if (this.state.phase === 'finished') return
    const wasPaused = this.state.paused
    this.state.paused = false
    if (this.state.phase === 'error') {
      this.state.error = ''
      this.state.waiting = false
      this.state.phase = this.failedPhase ?? 'idle'
      if (this.state.phase === 'saving' || this.state.phase === 'choice') {
        this.highlightChoice()
        return
      }
      if (this.state.phase === 'reminder' && !this.ready) {
        this.schedule(15000)
        this.update()
        return
      }
    }
    if (wasPaused && this.state.phase === 'exercise') this.runExercise(this.remaining || delay)
    else if (this.state.phase === 'saving') this.choose()
    else this.schedule(this.remaining || Math.min(delay, 500))
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
    if (!event.session) {
      this.port.clock(Math.max(this.port.now(), Date.parse(event.at)), false, 1)
      this.port.move(index)
      this.update('gap')
      this.schedule(Math.min(this.delay, 500))
      return
    }
    this.ready = false
    this.manual = false
    this.targetTime = Date.parse(event.at)
    const duration = event.session.status === 'missed' ? 300000 : event.session.status === 'done' ? event.session.durationSec * 1000 : 0
    const start = Math.max(this.port.now(), this.targetTime - duration)
    this.targetTime = Math.max(this.targetTime, start + duration)
    this.exerciseEnd = this.targetTime
    this.port.clock(start, false, 1)
    this.state.sessionId = this.port.open(event, this.state.generation)
    this.state.waiting = true
    this.update('reminder')
    this.schedule(15000)
  }

  acknowledge(ack: LabDriverAck): void {
    if (!ack || ack.sessionId !== this.state.sessionId) return
    if (ack.kind === 'ready') {
      if ((this.state.phase !== 'reminder' && !(this.state.phase === 'error' && this.failedPhase === 'reminder')) || this.ready) return
      this.ready = true
      this.remaining = 0
      this.state.waiting = false
      this.clearTimer()
      this.update()
      this.schedule(Math.min(this.delay, 700))
      return
    }
    if (ack.kind === 'manual') {
      this.intervene()
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
      this.update('exercise')
      this.runExercise(Math.max(700, this.delay))
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

  resolved(session: Session): boolean {
    if (session.id !== this.state.sessionId || this.state.eventIndex === null
      || ['saved', 'reaction', 'closing', 'repeat', 'finished', 'idle'].includes(this.state.phase)) return false
    this.clearTimer()
    const event = this.event()
    const manual = this.manual || this.state.mode === 'interactive' || session.status !== event?.session?.status
      || (session.skipReason === 'popup-closed' && !event?.actions?.includes('close'))
    this.freeze()
    this.state.waiting = false
    this.port.commit(this.state.eventIndex, session, manual)
    this.update('saved')
    this.schedule(Math.max(700, this.delay))
    return true
  }

  private runExercise(delay: number): void {
    const duration = Math.max(0, this.exerciseEnd - this.port.now())
    const rate = Math.min(1000, Math.max(1, duration / delay))
    this.port.clock(this.port.now(), this.playing && duration > 0, rate)
    this.schedule(Math.max(delay, duration / rate))
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
    if (!this.state.waiting) this.schedule(Math.max(700, this.delay))
  }

  private choose(): void {
    const event = this.event()
    if (!event?.session) return
    this.state.waiting = true
    this.update('saving')
    if (event.session.status === 'missed') {
      this.port.timeout()
    } else if (event.actions?.includes('close')) {
      this.port.close()
    } else {
      this.send(event.session.status === 'done' && this.port.severity() === 'hardcore' ? 'hold' : event.session.status as LabDriverAction)
    }
    if (this.state.phase === 'saving') this.schedule(15000)
  }

  private advance(): void {
    switch (this.state.phase) {
      case 'idle': case 'gap': case 'repeat': this.nextEvent(); break
      case 'reminder':
        if (!this.ready) {
          if (this.playing) this.fail('Попап не подтвердил готовность. Откройте сценарий заново.')
          return
        }
        if ((this.event()?.actions ?? labActions(this.event()!.session!)).includes('start')) {
          this.send('highlight-start')
          this.update('start')
          this.schedule(Math.max(700, this.delay))
        } else if (this.event()?.session?.status === 'missed') {
          if (this.state.mode === 'interactive') { this.highlightChoice(); return }
          this.state.action = 'Ожидаем ответ до таймаута'
          this.update('exercise')
          this.runExercise(Math.max(1200, this.delay))
        } else this.highlightChoice()
        break
      case 'start':
        this.state.waiting = true
        this.schedule(15000)
        this.send('start')
        break
      case 'exercise':
        this.port.clock(this.exerciseEnd, false, 1)
        this.highlightChoice()
        break
      case 'choice':
        if (this.state.mode === 'interactive') { this.state.waiting = true; this.update(); return }
        this.choose()
        break
      case 'saving': this.fail('Ожидаем сохранения. Проверьте попап и повторите действие.'); break
      case 'saved': this.update('reaction'); this.schedule(Math.max(1200, this.delay)); break
      case 'reaction': this.update('closing'); this.schedule(Math.min(this.delay, 700)); break
      case 'closing':
        if (this.port.active()) this.port.close()
        this.state.sessionId = null
        if (this.event()?.session?.status === 'snoozed') {
          this.state.action = 'Пять минут до повторного напоминания'
          this.port.clock(this.port.now() + 300000, false, 1)
          this.update('repeat'); this.schedule(Math.max(700, this.delay))
        } else this.nextEvent()
        break
      case 'error': case 'finished': break
    }
  }
}

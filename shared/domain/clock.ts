/** App time can be controlled by the isolated native laboratory. UI animation time stays real. */
export interface LaboratoryClock {
  at: string
  running: boolean
  silent: boolean
}

let clock: LaboratoryClock | undefined
let anchor = 0

export function setLaboratoryClock(next?: LaboratoryClock): void {
  if (next && !Number.isFinite(Date.parse(next.at))) throw new Error('Invalid laboratory time')
  clock = next ? { ...next } : undefined
  anchor = Date.now()
}

export function nowMs(): number {
  if (!clock) return Date.now()
  return Date.parse(clock.at) + (clock.running ? Date.now() - anchor : 0)
}

export function nowDate(): Date {
  return new Date(nowMs())
}

export function getLaboratoryClock(): LaboratoryClock | undefined {
  return clock ? { ...clock, at: nowDate().toISOString() } : undefined
}

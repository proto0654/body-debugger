/** App time can be controlled by the isolated native laboratory. UI animation time stays real. */
export interface LaboratoryClock {
  at: string
  running: boolean
  silent: boolean
  /** Laboratory exercise/scheduling pace; absent in production and version-1 saves. */
  rate?: number
}

let clock: LaboratoryClock | undefined
let anchor = 0

export function setLaboratoryClock(next?: LaboratoryClock): void {
  if (next && !Number.isFinite(Date.parse(next.at))) throw new Error('Invalid laboratory time')
  if (next?.rate !== undefined && (!Number.isFinite(next.rate) || next.rate < 1 || next.rate > 1000)) throw new Error('Invalid laboratory clock rate')
  clock = next ? { ...next } : undefined
  anchor = Date.now()
}

export function nowMs(): number {
  if (!clock) return Date.now()
  return Date.parse(clock.at) + (clock.running ? (Date.now() - anchor) * (clock.rate ?? 1) : 0)
}

export function nowDate(): Date {
  return new Date(nowMs())
}

export function getLaboratoryClock(): LaboratoryClock | undefined {
  return clock ? { ...clock, at: nowDate().toISOString() } : undefined
}

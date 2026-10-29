/**
 * Weight history (CONCEPT.md §10) — an optional layer on top of the core cycle.
 *
 * A measurement either belongs to a completed session (popup details) or is
 * added manually from the dashboard. `sessionId` doubles as the idempotency key
 * so replaying a session result never duplicates history.
 */
export interface WeightEntry {
  id: string
  /** ISO timestamp of the measurement */
  at: string
  weightKg: number
  /** Session that produced the measurement, if any */
  sessionId?: string
}

export interface WeightSettings {
  /** Show the weight history card on the dashboard */
  enabled: boolean
  /** Optional goal in kg; null when the user did not set one */
  targetKg: number | null
}

/** Parses a finite number from a number or a numeric string; null otherwise. */
export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (trimmed === '') return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

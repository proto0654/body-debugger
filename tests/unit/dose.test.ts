// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dose, intensityCap } from '@shared/domain/dose'

describe('dose', () => {
  const timer = { minSec: 30, defaultSec: 45, maxSec: 90 }

  it('scales at 15 / 45 / 90 minute boundaries', () => {
    expect(dose(timer, 45)).toBe(45)
    expect(dose(timer, 15)).toBe(30) // ×0.68 → 30.6 → 30, clamped to min
    expect(dose(timer, 90)).toBe(55) // ×1.27 → 57.15 → 55
  })

  it('clamps to min and max', () => {
    expect(dose({ minSec: 40, defaultSec: 45, maxSec: 50 }, 15)).toBe(40)
    expect(dose({ minSec: 20, defaultSec: 60, maxSec: 70 }, 240)).toBe(70)
  })

  it('applies personal scale', () => {
    expect(dose(timer, 45, 1.1)).toBe(50)
  })
})

describe('intensityCap', () => {
  it('uses 20 / 60 minute thresholds', () => {
    expect(intensityCap(15)).toBe(2)
    expect(intensityCap(20)).toBe(2)
    expect(intensityCap(21)).toBe(3)
    expect(intensityCap(59)).toBe(3)
    expect(intensityCap(60)).toBe(5)
  })
})

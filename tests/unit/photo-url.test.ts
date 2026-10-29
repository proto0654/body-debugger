import { describe, expect, it } from 'vitest'
import { photoUrl } from '@/photos'

describe('photoUrl', () => {
  it('builds the custom scheme url used by the main protocol', () => {
    expect(photoUrl('photo-1')).toBe('photo://photo-1')
  })

  it('encodes an id so it cannot break out of the host segment', () => {
    expect(photoUrl('a b/c')).toBe('photo://a%20b%2Fc')
  })
})

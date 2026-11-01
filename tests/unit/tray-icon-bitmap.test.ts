import { describe, expect, it } from 'vitest'
import { composeTrayIcon, cropHeadSquare, trayIconMetrics, type BgraImage } from '../../shared/domain/tray-icon-bitmap'

const GREEN = [94, 197, 34]
const YELLOW = [21, 204, 250]

function pixel(bitmap: Uint8Array, size: number, x: number, y: number): number[] {
  const index = (y * size + x) * 4
  return [bitmap[index], bitmap[index + 1], bitmap[index + 2], bitmap[index + 3]]
}

/** A point on the middle of the ring. Angle 0 is 12 o'clock, clockwise. */
function ringPoint(size: number, angle: number): { x: number; y: number } {
  const { outer, inner } = trayIconMetrics(size)
  const radius = (outer + inner) / 2
  const center = (size - 1) / 2
  return {
    x: Math.round(center + Math.sin(angle) * radius),
    y: Math.round(center - Math.cos(angle) * radius)
  }
}

describe('tray icon bitmap', () => {
  it('crops the head from the top of a bust', () => {
    const width = 4
    const height = 10
    const pixels = new Uint8Array(width * height * 4)
    pixels[width * 9 * 4] = 255
    const cropped = cropHeadSquare({ width, height, pixels })
    expect(cropped.width).toBe(4)
    expect(cropped.height).toBe(4)
    expect(cropped.pixels[0]).toBe(0)
  })

  it('draws a green clockwise ring and leaves the left side for the second half', () => {
    const size = 32
    const empty = composeTrayIcon({ size, face: null, progress: 0, color: 'green' })
    const half = composeTrayIcon({ size, face: null, progress: 0.5, color: 'green' })
    const full = composeTrayIcon({ size, face: null, progress: 1, color: 'green' })
    const right = ringPoint(size, Math.PI / 2)
    const left = ringPoint(size, Math.PI * 1.5)
    const center = pixel(empty, size, 16, 16)

    expect(center[3]).toBe(0)
    expect(pixel(empty, size, right.x, right.y).slice(0, 3)).not.toEqual(GREEN)
    expect(pixel(half, size, right.x, right.y).slice(0, 3)).toEqual(GREEN)
    expect(pixel(half, size, left.x, left.y).slice(0, 3)).not.toEqual(GREEN)
    expect(pixel(full, size, left.x, left.y).slice(0, 3)).toEqual(GREEN)
  })

  it('paints the warning ring yellow', () => {
    const size = 32
    const bitmap = composeTrayIcon({ size, face: null, progress: 1, color: 'yellow' })
    const right = ringPoint(size, Math.PI / 2)
    expect(pixel(bitmap, size, right.x, right.y).slice(0, 3)).toEqual(YELLOW)
  })

  it('keeps an opaque face pixel inside the ring', () => {
    const size = 32
    const { faceSize } = trayIconMetrics(size)
    const face: BgraImage = {
      width: faceSize,
      height: faceSize,
      pixels: new Uint8Array(faceSize * faceSize * 4)
    }
    for (let index = 0; index < face.pixels.length; index += 4) {
      face.pixels[index] = 10
      face.pixels[index + 1] = 20
      face.pixels[index + 2] = 30
      face.pixels[index + 3] = 255
    }
    const bitmap = composeTrayIcon({ size, face, progress: 0, color: 'green' })
    const center = pixel(bitmap, size, Math.floor(size / 2), Math.floor(size / 2))
    expect(center[3]).toBeGreaterThan(200)
    expect(center[2]).toBeGreaterThan(20)
  })
})

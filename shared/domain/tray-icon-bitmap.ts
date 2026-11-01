import type { TrayRingColor } from './tray-countdown'

export interface BgraImage {
  width: number
  height: number
  pixels: Uint8Array
}

/** BGRA. Green is the waiting ring, yellow the warning, dim the pause. */
const FILL: Record<TrayRingColor, readonly [number, number, number, number]> = {
  green: [94, 197, 34, 255],
  yellow: [21, 204, 250, 255],
  dim: [120, 130, 140, 180]
}

const TRACK: readonly [number, number, number, number] = [48, 64, 56, 210]

export function trayIconMetrics(size: number): { outer: number; inner: number; faceSize: number } {
  const pad = Math.max(1, Math.round(size * 0.04))
  const thickness = Math.max(2, Math.round(size * 0.12))
  const outer = size / 2 - pad
  const inner = Math.max(1, outer - thickness)
  const faceSize = Math.max(1, Math.floor(inner * 2) - 1)
  return { outer, inner, faceSize }
}

/**
 * Busts include the shoulders. The icon keeps the top of the frame so the
 * face, not the hoodie, survives a 16 px tray slot.
 */
export function cropHeadSquare(image: BgraImage): BgraImage {
  const side = Math.max(1, Math.min(image.width, image.height, Math.round(image.height * 0.62)))
  const x0 = Math.max(0, Math.floor((image.width - side) / 2))
  const pixels = new Uint8Array(side * side * 4)
  for (let y = 0; y < side; y += 1) {
    const src = (y * image.width + x0) * 4
    pixels.set(image.pixels.subarray(src, src + side * 4), y * side * 4)
  }
  return { width: side, height: side, pixels }
}

/**
 * Square BGRA icon: the face sits in the circle, the ring fills clockwise
 * from 12 o'clock. `progress` is 0..1.
 */
export function composeTrayIcon(input: {
  size: number
  face: BgraImage | null
  progress: number
  color: TrayRingColor
}): Uint8Array {
  const size = Math.max(8, Math.round(input.size))
  const { outer, inner } = trayIconMetrics(size)
  const pixels = new Uint8Array(size * size * 4)
  const fill = FILL[input.color]
  const progress = Math.min(1, Math.max(0, input.progress))
  const center = (size - 1) / 2

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let b = 0
      let g = 0
      let r = 0
      let a = 0
      for (let sy = 0; sy < 2; sy += 1) {
        for (let sx = 0; sx < 2; sx += 1) {
          const px = x + (sx + 0.5) / 2
          const py = y + (sy + 0.5) / 2
          const sample = samplePixel(px, py, center, outer, inner, progress, fill, input.face, size)
          b += sample[0]
          g += sample[1]
          r += sample[2]
          a += sample[3]
        }
      }
      const index = (y * size + x) * 4
      pixels[index] = Math.round(b / 4)
      pixels[index + 1] = Math.round(g / 4)
      pixels[index + 2] = Math.round(r / 4)
      pixels[index + 3] = Math.round(a / 4)
    }
  }
  return pixels
}

function samplePixel(
  px: number,
  py: number,
  center: number,
  outer: number,
  inner: number,
  progress: number,
  fill: readonly [number, number, number, number],
  face: BgraImage | null,
  size: number
): [number, number, number, number] {
  const dx = px - center
  const dy = py - center
  const dist = Math.hypot(dx, dy)
  let color: [number, number, number, number] = [0, 0, 0, 0]

  if (face && dist <= inner - 0.4) {
    const left = (size - face.width) / 2
    const top = (size - face.height) / 2
    color = sampleBilinear(face, px - left, py - top)
  }

  const ring = ringCoverage(dist, inner, outer)
  if (ring > 0) {
    const arc = coveredByProgress(dx, dy, progress) ? fill : TRACK
    const ringColor: [number, number, number, number] = [arc[0], arc[1], arc[2], Math.round(arc[3] * ring)]
    color = sourceOver(color, ringColor)
  }
  return color
}

function ringCoverage(dist: number, inner: number, outer: number): number {
  const feather = 0.7
  const outerEdge = clamp01((outer - dist) / feather)
  const innerEdge = clamp01((dist - inner) / feather)
  return outerEdge * innerEdge
}

/** Clockwise from 12 o'clock. A full turn covers every angle. */
function coveredByProgress(dx: number, dy: number, progress: number): boolean {
  if (progress >= 1) return true
  if (progress <= 0) return false
  let angle = Math.atan2(dx, -dy)
  if (angle < 0) angle += Math.PI * 2
  return angle <= progress * Math.PI * 2
}

function sampleBilinear(image: BgraImage, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return [0, 0, 0, 0]
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const c00 = pixelAt(image, x0, y0)
  const c10 = pixelAt(image, x0 + 1, y0)
  const c01 = pixelAt(image, x0, y0 + 1)
  const c11 = pixelAt(image, x0 + 1, y0 + 1)
  return [0, 1, 2, 3].map(channel => {
    const top = c00[channel] * (1 - tx) + c10[channel] * tx
    const bottom = c01[channel] * (1 - tx) + c11[channel] * tx
    return top * (1 - ty) + bottom * ty
  }) as [number, number, number, number]
}

function pixelAt(image: BgraImage, x: number, y: number): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return [0, 0, 0, 0]
  const index = (y * image.width + x) * 4
  return [image.pixels[index], image.pixels[index + 1], image.pixels[index + 2], image.pixels[index + 3]]
}

function sourceOver(
  dst: [number, number, number, number],
  src: [number, number, number, number]
): [number, number, number, number] {
  const alpha = src[3] / 255
  const inverse = 1 - alpha
  return [
    src[0] * alpha + dst[0] * inverse,
    src[1] * alpha + dst[1] * inverse,
    src[2] * alpha + dst[2] * inverse,
    src[3] + dst[3] * inverse
  ]
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

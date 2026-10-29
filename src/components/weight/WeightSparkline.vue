<script setup lang="ts">
import { computed } from 'vue'
import type { WeightPoint } from '@shared/domain/weight'

const props = defineProps<{ points: WeightPoint[] }>()

const WIDTH = 300
const HEIGHT = 72
const PAD = 8

function round(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Normalised coordinates: x follows time, y follows weight. A flat series gets
 * an artificial ±0.5 kg window so the line does not collapse onto one edge.
 */
const coords = computed(() => {
  const points = props.points
  if (points.length === 0) return []

  const values = points.map((point) => point.weightKg)
  const times = points.map((point) => point.at)

  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1) {
    const middle = (max + min) / 2
    min = middle - 0.5
    max = middle + 0.5
  }

  const from = Math.min(...times)
  const to = Math.max(...times)

  return points.map((point) => {
    const x = to === from ? WIDTH / 2 : PAD + ((point.at - from) / (to - from)) * (WIDTH - PAD * 2)
    const y = PAD + (1 - (point.weightKg - min) / (max - min)) * (HEIGHT - PAD * 2)
    return { x: round(x), y: round(y) }
  })
})

const line = computed(() => coords.value.map(({ x, y }) => `${x},${y}`).join(' '))

const last = computed(() => coords.value[coords.value.length - 1] ?? null)

const label = computed(() => {
  const points = props.points
  if (points.length === 0) return 'График веса: нет данных'
  const last = points[points.length - 1]
  return `График веса: ${points.length} измерений, последнее ${last.weightKg} кг`
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    class="block h-16 w-full"
    preserveAspectRatio="none"
    role="img"
    :aria-label="label"
    data-testid="weight-chart"
  >
    <polyline
      v-if="line"
      :points="line"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
    <circle v-if="last" :cx="last.x" :cy="last.y" r="3" fill="currentColor" />
  </svg>
</template>

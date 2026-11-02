<script setup lang="ts">
import { onMounted } from 'vue'
import { ZONE_LABELS, METHOD_LABELS, ZONES, METHODS } from '@shared/constants/catalog-axes'
import type { Method, Zone } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'
import { useQueueStore } from '@/stores/queue'

const catalog = useCatalogStore()
const queue = useQueueStore()

onMounted(() => {
  void queue.refresh()
})

function titleOf(id: string): string {
  return catalog.resolved.find((ex) => ex.id === id)?.title ?? id
}

function slotLabel(index: number): string {
  const slot = queue.queue.slots[index]
  if (!slot || slot.kind === 'empty') return 'обычный пик'
  if (slot.kind === 'pin') {
    const ex = catalog.resolved.find((e) => e.id === slot.exerciseId)
    if (!ex || ex.status !== 'active') return 'недоступно'
    return titleOf(slot.exerciseId)
  }
  if (slot.axis === 'zone') return `зона: ${ZONE_LABELS[slot.key as Zone]}`
  return `метод: ${METHOD_LABELS[slot.key as Method]}`
}

async function moveToSlot(exerciseId: string, index: number): Promise<void> {
  await queue.pinExercise(exerciseId, index)
}

async function setConstraint(index: number, axis: 'zone' | 'method', key: string): Promise<void> {
  await queue.setSlot(index, { kind: 'constraint', axis, key: key as Zone | Method })
}
</script>

<template>
  <section class="settings-card space-y-2" data-testid="queue-strip" aria-label="Очередь следующих перерывов">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-white">Следующие перерывы</h2>
      <p v-if="queue.summary" class="text-[11px] text-slate-400">План: {{ queue.summary }}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <div
        v-for="(slot, index) in queue.queue.slots"
        :key="index"
        class="min-w-[140px] flex-1 rounded border border-dashed border-slate-700 bg-slate-950/50 p-2 text-xs"
      >
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Слот {{ index + 1 }}</p>
        <p class="mt-1 text-slate-200">{{ slotLabel(index) }}</p>
        <div class="mt-2 flex flex-wrap gap-1">
          <button type="button" class="setting-chip text-[10px]" @click="queue.clearSlot(index)">Очистить</button>
          <details class="relative">
            <summary class="setting-chip cursor-pointer text-[10px]">В очередь</summary>
            <div class="absolute z-20 mt-1 max-h-48 w-56 overflow-y-auto rounded border border-slate-700 bg-slate-950 p-1 shadow-lg">
              <button
                v-for="ex in catalog.resolved.filter((e) => e.status === 'active').slice(0, 40)"
                :key="ex.id"
                type="button"
                class="block w-full truncate px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800"
                @click="moveToSlot(ex.id, index)"
              >
                {{ ex.emojiFallback }} {{ ex.title }}
              </button>
            </div>
          </details>
          <details class="relative">
            <summary class="setting-chip cursor-pointer text-[10px]">Ограничение</summary>
            <div class="absolute z-20 mt-1 w-48 rounded border border-slate-700 bg-slate-950 p-1 shadow-lg">
              <button
                v-for="zone in ZONES"
                :key="zone"
                type="button"
                class="block w-full px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800"
                @click="setConstraint(index, 'zone', zone)"
              >
                {{ ZONE_LABELS[zone] }}
              </button>
              <button
                v-for="method in METHODS"
                :key="method"
                type="button"
                class="block w-full px-2 py-1 text-left text-[11px] text-slate-300 hover:bg-slate-800"
                @click="setConstraint(index, 'method', method)"
              >
                {{ METHOD_LABELS[method] }}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
    <p class="text-[11px] text-slate-500">
      Не сегодня:
      <span v-if="queue.queue.excludeToday.length === 0">пусто</span>
      <span v-for="id in queue.queue.excludeToday" :key="id" class="mr-1 text-slate-400">{{ titleOf(id) }}</span>
    </p>
  </section>
</template>

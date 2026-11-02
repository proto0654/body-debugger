<script setup lang="ts">
import { METHODS, METHOD_LABELS, ZONES, ZONE_LABELS } from '@shared/constants/catalog-axes'
import { EQUIPMENT_CATALOG } from '@shared/constants/equipment'
import type { Method, Zone } from '@shared/types/exercise-v2'
import { useCatalogStore } from '@/stores/catalog'
import { useCatalogViewStore } from '@/stores/catalog-view'

const catalog = useCatalogStore()
const view = useCatalogViewStore()

function toggleZone(zone: Zone): void {
  const list = view.filters.zones
  view.filters.zones = list.includes(zone) ? list.filter((z) => z !== zone) : [...list, zone]
}

function toggleMethod(method: Method): void {
  const list = view.filters.methods
  view.filters.methods = list.includes(method) ? list.filter((m) => m !== method) : [...list, method]
}

function toggleEquipment(id: string): void {
  const list = view.filters.equipmentIds
  view.filters.equipmentIds = list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}
</script>

<template>
  <aside class="space-y-4 text-xs" data-testid="catalog-filter-rail">
    <label class="block">
      <span class="text-slate-500">Поиск</span>
      <input
        v-model="view.filters.query"
        type="search"
        class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-200"
        placeholder="Название или описание"
      />
    </label>

    <div>
      <p class="mb-1 text-slate-500">Зона</p>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="zone in ZONES"
          :key="zone"
          type="button"
          class="setting-chip text-[11px]"
          :class="view.filters.zones.includes(zone) ? 'ring-1 ring-emerald-500' : ''"
          @click="toggleZone(zone)"
        >
          {{ ZONE_LABELS[zone] }}
        </button>
      </div>
    </div>

    <div>
      <p class="mb-1 text-slate-500">Метод</p>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="method in METHODS"
          :key="method"
          type="button"
          class="setting-chip text-[11px]"
          :class="view.filters.methods.includes(method) ? 'ring-1 ring-emerald-500' : ''"
          @click="toggleMethod(method)"
        >
          {{ METHOD_LABELS[method] }}
        </button>
      </div>
    </div>

    <div>
      <p class="mb-1 text-slate-500">Интенсивность {{ view.filters.intensityMin }}–{{ view.filters.intensityMax }}</p>
      <div class="flex gap-2">
        <input v-model.number="view.filters.intensityMin" type="range" min="1" max="5" class="w-full accent-emerald-500" />
        <input v-model.number="view.filters.intensityMax" type="range" min="1" max="5" class="w-full accent-emerald-500" />
      </div>
    </div>

    <div>
      <p class="mb-1 text-slate-500">Таймер (default) до {{ view.filters.timerMax }} с</p>
      <input v-model.number="view.filters.timerMax" type="range" min="15" max="180" step="5" class="w-full accent-emerald-500" />
    </div>

    <div>
      <p class="mb-1 text-slate-500">Инвентарь</p>
      <div class="flex flex-wrap gap-1">
        <button
          type="button"
          class="setting-chip text-[11px]"
          :class="view.filters.equipmentMode === 'any' ? 'ring-1 ring-emerald-500' : ''"
          @click="view.filters.equipmentMode = 'any'"
        >
          любой
        </button>
        <button
          type="button"
          class="setting-chip text-[11px]"
          :class="view.filters.equipmentMode === 'have' ? 'ring-1 ring-emerald-500' : ''"
          @click="view.filters.equipmentMode = 'have'"
        >
          есть у меня
        </button>
        <button
          type="button"
          class="setting-chip text-[11px]"
          :class="view.filters.equipmentMode === 'missing' ? 'ring-1 ring-emerald-500' : ''"
          @click="view.filters.equipmentMode = 'missing'"
        >
          нет
        </button>
      </div>
      <div class="mt-2 flex flex-wrap gap-1">
        <button
          v-for="item in EQUIPMENT_CATALOG"
          :key="item.id"
          type="button"
          class="setting-chip text-[11px]"
          :class="view.filters.equipmentIds.includes(item.id) ? 'ring-1 ring-emerald-500' : ''"
          @click="toggleEquipment(item.id)"
        >
          {{ item.emoji }} {{ item.title }}
        </button>
      </div>
    </div>

    <label class="block">
      <span class="text-slate-500">Набор</span>
      <select
        class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
        :value="view.filters.batchId ?? ''"
        @change="view.filters.batchId = (($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">Все</option>
        <option v-for="batch in catalog.batches" :key="batch.id" :value="batch.id">{{ batch.name }}</option>
      </select>
    </label>

    <label class="block">
      <span class="text-slate-500">Статус</span>
      <select v-model="view.filters.status" class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5">
        <option value="all">Все</option>
        <option value="active">Активные</option>
        <option value="archived">Архив</option>
      </select>
    </label>

    <label class="block">
      <span class="text-slate-500">Источник</span>
      <select v-model="view.filters.source" class="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5">
        <option value="all">Все</option>
        <option value="shipped">shipped</option>
        <option value="user">user</option>
        <option value="llm">llm</option>
      </select>
    </label>

    <label class="flex items-center gap-2 text-slate-300">
      <input v-model="view.filters.hintsOnly" type="checkbox" class="accent-emerald-500" />
      Только с подсказками
    </label>

    <label class="flex items-center gap-2 text-slate-300">
      <input v-model="view.filters.availableNow" type="checkbox" class="accent-emerald-500" />
      Доступно сейчас
    </label>

    <button type="button" class="setting-chip text-[11px]" @click="view.resetFilters()">Сбросить фильтры</button>
  </aside>
</template>

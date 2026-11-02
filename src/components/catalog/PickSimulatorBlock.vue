<script setup lang="ts">
import { computed, ref } from 'vue'
import { ZONE_LABELS } from '@shared/constants/catalog-axes'
import { simulate } from '@shared/domain/catalog-sandbox'
import { useCatalogStore } from '@/stores/catalog'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'

const catalog = useCatalogStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()
const saving = ref(false)

const pickInput = computed(() => ({
  catalog: catalog.resolved,
  recentSessions: sessions.history,
  settings: settings.asSettings(),
  focus: settings.focusV2,
  profileStrength: settings.profileStrength,
  overrides: settings.overrides,
  limitations: settings.limitations,
  useShareProfile: true as const
}))

const simulation = computed(() => simulate(pickInput.value, 200, 0).zoneShares)

async function onProfileStrength(event: Event): Promise<void> {
  const value = Number((event.target as HTMLInputElement).value) / 100
  if (saving.value) return
  saving.value = true
  try {
    await settings.setProfileStrength(value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-3" data-testid="pick-simulator">
    <label class="block text-sm font-semibold text-white">Следовать профилю (λ)</label>
    <p class="text-xs text-slate-400">
      Share-based профиль: λ тянет симулируемые доли к целям. Ротация при этом не отключается.
    </p>
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      class="w-full accent-emerald-500"
      :disabled="saving"
      :value="Math.round(settings.profileStrength * 100)"
      aria-label="Сила следования профилю"
      @change="onProfileStrength"
    />
    <div class="flex justify-between text-[11px] text-slate-500">
      <span>Мягко</span>
      <span>Обычно</span>
      <span>Жёстко</span>
    </div>
    <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Симулятор 200 прогонов</h3>
    <ul class="space-y-1 text-xs text-slate-400">
      <li v-for="(share, zone) in simulation" :key="zone">
        {{ ZONE_LABELS[zone as keyof typeof ZONE_LABELS] }} · {{ Math.round(share * 100) }}%
      </li>
    </ul>
  </div>
</template>

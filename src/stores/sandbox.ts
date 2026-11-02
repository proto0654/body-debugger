import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { FocusLevel, FocusV2, Limitation, Method, Zone } from '@shared/types/exercise-v2'
import type { ExercisePickerMode } from '@shared/types/settings'
import type { Session } from '@shared/types/session'
import { emptyFocusV2 } from '@shared/domain/focus-v2'
import {
  comboMatrix,
  poolSnapshot,
  previewDelta,
  simulate,
  simulateWeek,
  type PoolSnapshot,
  type PreviewDelta
} from '@shared/domain/catalog-sandbox'
import { useCatalogStore } from '@/stores/catalog'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'

export type SandboxResultTab = 'pool' | 'combo' | 'sim' | 'week' | 'ab' | 'prefs' | 'edit'

export interface SandboxControls {
  intervalMinutes: number
  pickerMode: ExercisePickerMode
  focus: FocusV2
  profileStrength: number
  inventoryEnabled: boolean
  inventoryItems: string[]
  limitations: Limitation[]
  quiet?: boolean
  noSweat?: boolean
}

function cloneFocus(focus: FocusV2): FocusV2 {
  return {
    zones: { ...focus.zones },
    methods: { ...focus.methods }
  }
}

export const useSandboxStore = defineStore('catalogSandbox', () => {
  const controls = ref<SandboxControls | null>(null)
  const virtualHistory = ref<Session[]>([])
  const baseline = ref<PoolSnapshot | null>(null)
  const resultTab = ref<SandboxResultTab>('pool')
  const simN = ref(200)
  const simSeed = ref(42)

  function resetFromReal(): void {
    const settings = useSettingsStore()
    const sessions = useSessionsStore()
    controls.value = {
      intervalMinutes: settings.intervalMinutes,
      pickerMode: settings.pickerMode,
      focus: cloneFocus(settings.focusV2),
      profileStrength: settings.profileStrength,
      inventoryEnabled: settings.inventory.enabled,
      inventoryItems: [...settings.inventory.items],
      limitations: [...settings.limitations]
    }
    virtualHistory.value = [...sessions.history]
    baseline.value = null
  }

  const pickInput = computed(() => {
    const catalog = useCatalogStore()
    const settings = useSettingsStore()
    const c = controls.value
    if (!c) return null
    const base = settings.asSettings()
    return {
      catalog: catalog.resolved,
      recentSessions: virtualHistory.value,
      settings: {
        ...base,
        intervalMinutes: c.intervalMinutes,
        pickerMode: c.pickerMode,
        inventory: { enabled: c.inventoryEnabled, items: c.inventoryItems },
        limitations: c.limitations
      },
      focus: c.focus,
      profileStrength: c.profileStrength,
      overrides: settings.overrides,
      limitations: c.limitations,
      contextPrefs:
        c.quiet !== undefined || c.noSweat !== undefined
          ? { quiet: c.quiet, noSweat: c.noSweat }
          : undefined,
      useShareProfile: true as const
    }
  })

  const snapshot = computed(() => {
    const input = pickInput.value
    return input ? poolSnapshot(input, 1) : null
  })

  const combo = computed(() => {
    const input = pickInput.value
    return input ? comboMatrix(input, 1) : []
  })

  const simulation = computed(() => {
    const input = pickInput.value
    return input ? simulate(input, simN.value, simSeed.value) : null
  })

  const week = computed(() => {
    const input = pickInput.value
    if (!input) return null
    const perDay = Math.max(1, Math.round((8 * 60) / Math.max(15, controls.value?.intervalMinutes ?? 45)))
    return simulateWeek(input, 7, Math.min(8, perDay), simSeed.value)
  })

  const deltaVsBaseline = computed((): PreviewDelta | null => {
    if (!baseline.value || !pickInput.value) return null
    const settings = useSettingsStore()
    const catalog = useCatalogStore()
    // Reconstruct a before input is expensive; compare via stored baseline probs vs current.
    const after = snapshot.value
    if (!after) return null
    const beforeMap = new Map(
      baseline.value.candidates.filter((c) => !c.filteredBy).map((c) => [c.id, c.probability])
    )
    const afterMap = new Map(
      after.candidates.filter((c) => !c.filteredBy).map((c) => [c.id, c.probability])
    )
    // Use previewDelta with synthetic inputs by swapping focus only when both exist:
    void catalog
    void settings
    const gained = []
    const lost = []
    const moved = []
    for (const id of Array.from(new Set([...Array.from(beforeMap.keys()), ...Array.from(afterMap.keys())]))) {
      const b = beforeMap.get(id)
      const a = afterMap.get(id)
      if (b === undefined && a !== undefined) gained.push({ id, before: 0, after: a, delta: a, status: 'gained' as const })
      else if (b !== undefined && a === undefined) lost.push({ id, before: b, after: 0, delta: -b, status: 'lost' as const })
      else if (b !== undefined && a !== undefined && Math.abs(a - b) > 1e-9)
        moved.push({ id, before: b, after: a, delta: a - b, status: 'moved' as const })
    }
    const byDelta = [...gained, ...lost, ...moved].sort((x, y) => y.delta - x.delta)
    return {
      gained,
      lost,
      moved,
      topGain: byDelta.filter((r) => r.delta > 0).slice(0, 3),
      topLose: byDelta.filter((r) => r.delta < 0).slice(-3).reverse()
    }
  })

  function pinBaseline(): void {
    if (snapshot.value) baseline.value = structuredClone(snapshot.value)
  }

  function setZoneLevel(zone: Zone, level: FocusLevel): void {
    if (!controls.value) return
    controls.value = {
      ...controls.value,
      focus: { ...controls.value.focus, zones: { ...controls.value.focus.zones, [zone]: level } }
    }
  }

  function setMethodLevel(method: Method, level: FocusLevel): void {
    if (!controls.value) return
    controls.value = {
      ...controls.value,
      focus: {
        ...controls.value.focus,
        methods: { ...controls.value.focus.methods, [method]: level }
      }
    }
  }

  function loadCombo(zone: Zone, method: Method): void {
    if (!controls.value) return
    const focus = emptyFocusV2()
    focus.zones[zone] = 2
    focus.methods[method] = 2
    controls.value = { ...controls.value, focus }
  }

  async function applyToSettings(): Promise<number> {
    if (!controls.value) return 0
    const settings = useSettingsStore()
    let changed = 0
    const c = controls.value
    if (c.intervalMinutes !== settings.intervalMinutes) {
      await settings.setIntervalMinutes(c.intervalMinutes)
      changed += 1
    }
    if (c.pickerMode !== settings.pickerMode) {
      await settings.setPickerMode(c.pickerMode)
      changed += 1
    }
    if (c.profileStrength !== settings.profileStrength) {
      await settings.setProfileStrength(c.profileStrength)
      changed += 1
    }
    await settings.setFocusV2(cloneFocus(c.focus))
    changed += 1
    return changed
  }

  return {
    controls,
    virtualHistory,
    baseline,
    resultTab,
    simN,
    simSeed,
    pickInput,
    snapshot,
    combo,
    simulation,
    week,
    deltaVsBaseline,
    resetFromReal,
    pinBaseline,
    setZoneLevel,
    setMethodLevel,
    loadCombo,
    applyToSettings,
    previewDelta
  }
})

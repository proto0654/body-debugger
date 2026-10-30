import { defineStore } from 'pinia'
import { ref } from 'vue'
import { setLaboratoryClock, type LaboratoryClock } from '@shared/domain/clock'

/** Runtime-only laboratory metadata travels with every main-owned snapshot. */
export const useRuntimeStore = defineStore('runtime', () => {
  const laboratory = ref<LaboratoryClock>()
  const revision = ref(0)
  function apply(clock?: LaboratoryClock): void {
    setLaboratoryClock(clock)
    laboratory.value = clock
    revision.value++
  }
  return { laboratory, revision, apply }
})

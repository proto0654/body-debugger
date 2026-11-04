import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dashboardHash, parseDashboardLocation, type DashboardLocation, type DashboardTab } from '@shared/domain/dashboard-navigation'

export const useDashboardNavigation = defineStore('dashboardNavigation', () => {
  const location = ref(parseDashboardLocation(window.location.hash))
  function read(): void { location.value = parseDashboardLocation(window.location.hash) }
  function navigate(tab: DashboardTab, section?: string, extra: Pick<DashboardLocation, 'exerciseId' | 'task'> = {}): void {
    const next = parseDashboardLocation(dashboardHash({ tab, section: section ?? '', ...extra }))
    const hash = dashboardHash(next)
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    location.value = next
  }
  return { location, read, navigate }
})

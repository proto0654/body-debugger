export type DashboardTab = 'today' | 'exercises' | 'character' | 'progress' | 'settings'
export interface DashboardLocation {
  tab: DashboardTab
  section: string
  exerciseId?: string
  task?: 'generate' | 'edit' | 'tune' | 'retag'
}
const SECTIONS: Record<DashboardTab, readonly string[]> = {
  today: ['overview'], exercises: ['library', 'profile', 'sets', 'queue', 'ai', 'import', 'edit'],
  character: ['appearance', 'development', 'chronicle'], progress: ['calendar', 'stats', 'weight', 'photos'],
  settings: ['general', 'comfort', 'system', 'ai', 'developer', 'laboratory', 'sandbox', 'coverage']
}

export function parseDashboardLocation(hash: string): DashboardLocation {
  const params = new URLSearchParams(hash.split('?')[1] ?? '')
  const requested = params.get('tab') ?? 'today'
  if (requested === 'calendar' || requested === 'stats') return { tab: 'progress', section: requested }
  if (requested === 'laboratory' || requested === 'playground') return { tab: 'settings', section: 'laboratory' }
  const tab = Object.prototype.hasOwnProperty.call(SECTIONS, requested) ? requested as DashboardTab : 'today'
  let section = params.get('section') ?? SECTIONS[tab][0]!
  if (tab === 'character' && section === 'profile') section = 'appearance'
  if (tab === 'exercises' && ['sandbox', 'coverage'].includes(section)) return { tab: 'settings', section }
  if (!SECTIONS[tab].includes(section)) section = SECTIONS[tab][0]!
  const task = params.get('task')
  return { tab, section, ...(tab === 'exercises' && params.get('exercise') ? { exerciseId: params.get('exercise')! } : {}), ...(['generate', 'edit', 'tune', 'retag'].includes(task ?? '') ? { task: task as DashboardLocation['task'] } : {}) }
}

export function dashboardHash(location: DashboardLocation): string {
  const params = new URLSearchParams({ tab: location.tab, section: location.section })
  if (location.exerciseId) params.set('exercise', location.exerciseId)
  if (location.task) params.set('task', location.task)
  return `#/dashboard?${params}`
}

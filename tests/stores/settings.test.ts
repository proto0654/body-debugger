import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { makeSettings } from '../fixtures'
import type { DataSnapshot } from '@shared/types/persistence'

const defaultProgress = {
  streak: { current: 0, max: 0 },
  characterStage: 0 as const,
  characterBranch: 'neutral' as const,
  characterBuild: 'average' as const,
  exerciseLevels: {},
  focus: { primary: null, accents: [] }
}

function snapshot(settings = makeSettings()): DataSnapshot {
  return { settings, progress: defaultProgress, sessions: [], weights: [] }
}

const saveSettings = vi.fn(async (settings: DataSnapshot['settings']) => snapshot(settings))

beforeEach(() => {
  setActivePinia(createPinia())
  saveSettings.mockClear()
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { saveSettings }
  })
})

describe('settings store', () => {
  it('starts from the documented defaults', () => {
    const settings = useSettingsStore()
    expect(settings.severity).toBe('medium')
    expect(settings.pickerMode).toBe('balance')
    expect(settings.reduceMotion).toBe(false)
    expect(settings.sessionExtras).toEqual({ enabled: false })
    expect(settings.paused).toBe(false)
    expect(settings.characterPackId).toBe('desk-hulk')
  })

  it('exports a complete settings payload', () => {
    const settings = useSettingsStore()
    settings.hydrate(makeSettings({ intervalMinutes: 25, themeId: 'night' }))
    const payload = settings.asSettings()
    expect(payload.intervalMinutes).toBe(25)
    expect(payload.themeId).toBe('night')
    expect(payload.focus).toEqual({ primary: null, accents: [] })
  })

  it('hydrates copies so later mutations do not leak', () => {
    const settings = useSettingsStore()
    const source = makeSettings({
      focus: { primary: 'strength', accents: ['mobility'] },
      inventory: { enabled: true, items: ['bag-50'] }
    })
    settings.hydrate(source)

    source.focus.accents.push('balance')
    source.inventory.items.push('punching-bag')

    expect(settings.focus.accents).toEqual(['mobility'])
    expect(settings.inventory.items).toEqual(['bag-50'])
  })

  it('persists a severity change and hydrates the stored snapshot', async () => {
    const settings = useSettingsStore()
    await settings.setSeverity('hardcore')

    expect(settings.severity).toBe('hardcore')
    expect(saveSettings).toHaveBeenCalledTimes(1)
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ severity: 'hardcore' })
    expect(settings.asSettings().severity).toBe('hardcore')
  })

  it('does not persist a no-op severity change', async () => {
    const settings = useSettingsStore()
    await settings.setSeverity('medium')
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('persists the reduce-motion switch', async () => {
    const settings = useSettingsStore()
    await settings.setReduceMotion(true)
    expect(settings.reduceMotion).toBe(true)
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('persists the optional-details switch', async () => {
    const settings = useSettingsStore()
    await settings.setSessionExtrasEnabled(true)

    expect(settings.sessionExtras.enabled).toBe(true)
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ sessionExtras: { enabled: true } })
  })

  it('persists the AI proposal switch', async () => {
    const settings = useSettingsStore()

    await settings.setAiEnabled(true)

    expect(settings.ai.enabled).toBe(true)
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ ai: { enabled: true } })
  })

  it('persists the photo layer switch', async () => {
    const settings = useSettingsStore()

    await settings.setPhotosEnabled(true)

    expect(settings.photos.enabled).toBe(true)
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ photos: { enabled: true } })
  })

  it('persists a theme change and ignores an unknown theme', async () => {
    const settings = useSettingsStore()

    await settings.setTheme('night')
    expect(settings.themeId).toBe('night')
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ themeId: 'night' })

    await settings.setTheme('rave')
    expect(settings.themeId).toBe('night')
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('persists the inventory switch and toggles owned items', async () => {
    const settings = useSettingsStore()

    await settings.setInventoryEnabled(true)
    await settings.toggleInventoryItem('bag-50')

    expect(settings.inventory).toEqual({ enabled: true, items: ['bag-50'] })
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ inventory: { enabled: true } })
    expect(saveSettings.mock.calls[1][0]).toMatchObject({ inventory: { items: ['bag-50'] } })

    await settings.toggleInventoryItem('bag-50')
    expect(settings.inventory).toEqual({ enabled: true, items: [] })
  })

  it('ignores an unknown inventory item', async () => {
    const settings = useSettingsStore()

    await settings.toggleInventoryItem('treadmill')

    expect(settings.inventory.items).toEqual([])
    expect(saveSettings).not.toHaveBeenCalled()
  })

  it('persists the sound layer switch, volume and pack', async () => {
    const settings = useSettingsStore()

    await settings.setSoundEnabled(true)
    await settings.setSoundVolume(0.35)

    expect(settings.sound).toEqual({ enabled: true, volume: 0.35, packId: 'default' })
    expect(saveSettings.mock.calls[0][0]).toMatchObject({ sound: { enabled: true } })
    expect(saveSettings.mock.calls[1][0]).toMatchObject({ sound: { volume: 0.35 } })
  })

  it('clamps the sound volume and ignores an unknown pack', async () => {
    const settings = useSettingsStore()

    await settings.setSoundVolume(2)
    expect(settings.sound.volume).toBe(1)

    await settings.setSoundPack('rave')
    expect(settings.sound.packId).toBe('default')
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('persists the weight layer switch and goal', async () => {
    const settings = useSettingsStore()

    await settings.setWeightEnabled(true)
    await settings.setWeightTarget(72.55)

    expect(settings.weight).toEqual({ enabled: true, targetKg: 72.6 })
    expect(saveSettings.mock.calls[1][0]).toMatchObject({ weight: { enabled: true, targetKg: 72.6 } })
  })

  it('ignores an out-of-range weight goal and clears it explicitly', async () => {
    const settings = useSettingsStore()
    await settings.setWeightTarget(500)
    expect(settings.weight.targetKg).toBeNull()
    expect(saveSettings).not.toHaveBeenCalled()

    settings.hydrate(makeSettings({ weight: { enabled: true, targetKg: 70 } }))
    await settings.setWeightTarget(null)
    expect(settings.weight.targetKg).toBeNull()
    expect(saveSettings).toHaveBeenCalledTimes(1)
  })

  it('keeps working when the preload bridge is absent', async () => {
    Object.defineProperty(window, 'api', { configurable: true, value: undefined })
    const settings = useSettingsStore()
    await expect(settings.setSeverity('soft')).resolves.toBeUndefined()
    expect(settings.severity).toBe('soft')
  })
})

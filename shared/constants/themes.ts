/**
 * Visual themes (CONCEPT.md §10). A theme only overrides CSS custom properties
 * on <html data-theme>; every component keeps using the same Tailwind tokens.
 */
export interface AppTheme {
  id: string
  title: string
  description: string
}

export const DEFAULT_THEME_ID = 'default'

export const THEMES: readonly AppTheme[] = [
  {
    id: DEFAULT_THEME_ID,
    title: 'Тёмная',
    description: 'Базовый тёмный интерфейс'
  },
  {
    id: 'night',
    title: 'Полночь',
    description: 'Глубокий синий с холодными акцентами'
  },
  {
    id: 'warm',
    title: 'Тёплая',
    description: 'Светлый песочный интерфейс'
  }
]

const THEME_IDS = new Set(THEMES.map((theme) => theme.id))

export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && THEME_IDS.has(value)
}

export function normalizeThemeId(value: unknown): string {
  return isThemeId(value) ? value : DEFAULT_THEME_ID
}

export function themeById(id: string): AppTheme | null {
  return THEMES.find((theme) => theme.id === id) ?? null
}

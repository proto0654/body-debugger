import { computed, onScopeDispose, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

/**
 * Motion preference: the dashboard toggle («Уменьшить анимации») or the OS-level
 * reduce-motion setting. CSS reacts to `data-reduce-motion` on <html> (see
 * `src/styles/index.css`); timed effects must check `reduced` themselves.
 */
export function useMotionPreference() {
  const settings = useSettingsStore()
  const query =
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  const systemReduced = ref(query?.matches ?? false)

  const onChange = (event: MediaQueryListEvent): void => {
    systemReduced.value = event.matches
  }
  query?.addEventListener('change', onChange)
  onScopeDispose(() => query?.removeEventListener('change', onChange))

  const reduced = computed(() => settings.reduceMotion || systemReduced.value)
  return { reduced }
}

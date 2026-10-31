<script setup lang="ts">
import { onBeforeUnmount, watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useMotionPreference } from '@/motion'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { reduced } = useMotionPreference()
function updateVisibility(): void {
  document.documentElement.dataset.windowVisible = String(!document.hidden)
}
updateVisibility()
document.addEventListener('visibilitychange', updateVisibility)
onBeforeUnmount(() => document.removeEventListener('visibilitychange', updateVisibility))

watchEffect(() => {
  document.documentElement.dataset.reduceMotion = String(reduced.value)
})

// The theme only swaps CSS variables (src/styles/index.css); components are unchanged.
watchEffect(() => {
  document.documentElement.dataset.theme = settings.themeId
})
</script>

<template>
  <RouterView />
</template>

<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useMotionPreference } from '@/motion'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { reduced } = useMotionPreference()

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

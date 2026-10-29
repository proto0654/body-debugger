<script setup lang="ts">
import { watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useMotionPreference } from '@/motion'

const { reduced } = useMotionPreference()

watchEffect(() => {
  document.documentElement.dataset.reduceMotion = String(reduced.value)
})
</script>

<template>
  <RouterView />
</template>

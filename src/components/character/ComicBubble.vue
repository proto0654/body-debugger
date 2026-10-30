<script setup lang="ts">
import type { CharacterReactionTone } from '@shared/domain/character-reaction'

withDefaults(defineProps<{
  caption: string
  tone?: CharacterReactionTone
  compact?: boolean
  heading?: boolean
  tail?: 'bottom' | 'right'
}>(), { tone: 'calm', compact: false, heading: false, tail: 'bottom' })
</script>

<template>
  <component
    :is="heading ? 'h2' : 'p'"
    class="comic-bubble"
    :class="{ 'comic-bubble--compact': compact }"
    :data-tone="tone"
    :data-tail="tail"
  >
    <span>{{ caption }}</span>
  </component>
</template>

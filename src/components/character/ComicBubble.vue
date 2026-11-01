<script setup lang="ts">
import type { CharacterReactionTone, ComicVariant } from '@shared/domain/character-reaction'

withDefaults(defineProps<{
  caption: string
  tone?: CharacterReactionTone
  compact?: boolean
  heading?: boolean
  tail?: 'bottom' | 'right' | 'top'
  variant?: ComicVariant
  decoration?: string
  animationId?: string | number
}>(), { tone: 'calm', compact: false, heading: false, tail: 'bottom', variant: 'speech', decoration: '', animationId: 0 })
</script>

<template>
  <component
    :is="heading ? 'h2' : 'p'"
    :key="animationId"
    class="comic-bubble"
    :class="{ 'comic-bubble--compact': compact }"
    :data-tone="tone"
    :data-tail="tail"
    :data-variant="variant"
  >
    <svg v-if="variant === 'burst'" class="comic-burst" aria-hidden="true" viewBox="0 0 300 100" preserveAspectRatio="none">
      <!-- Opaque ink offset instead of drop-shadow: alpha filters punch through a transparent Electron window. -->
      <path class="comic-burst-ink" vector-effect="non-scaling-stroke" transform="translate(5 6)" d="M4 12 L32 18 L37 3 L70 12 L93 2 L118 10 L148 1 L173 10 L206 2 L226 12 L264 4 L265 20 L296 13 L288 39 L299 56 L285 66 L295 90 L264 85 L257 98 L224 88 L199 99 L175 90 L145 99 L118 91 L86 98 L68 87 L34 96 L31 80 L3 88 L12 65 L1 48 L13 36 Z" />
      <path class="comic-burst-fill" vector-effect="non-scaling-stroke" d="M4 12 L32 18 L37 3 L70 12 L93 2 L118 10 L148 1 L173 10 L206 2 L226 12 L264 4 L265 20 L296 13 L288 39 L299 56 L285 66 L295 90 L264 85 L257 98 L224 88 L199 99 L175 90 L145 99 L118 91 L86 98 L68 87 L34 96 L31 80 L3 88 L12 65 L1 48 L13 36 Z" />
    </svg>
    <span>{{ caption }}</span>
    <i v-if="decoration" class="comic-decoration" aria-hidden="true">{{ decoration }}</i>
  </component>
</template>

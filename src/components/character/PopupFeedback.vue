<script setup lang="ts">
import CharacterPortrait from './CharacterPortrait.vue'
import ComicBubble from './ComicBubble.vue'
import type { CharacterState } from '@shared/types/character'
import type { CharacterReaction } from '@shared/domain/character-reaction'
defineProps<{
  character: CharacterState
  reaction: CharacterReaction
  quiet?: boolean
  label: string
  detail: string
  error?: string
  /** Arcade autoplay hides the close control — the parent click aborts instead. */
  hideClose?: boolean
}>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="popup-success absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center" :data-result="quiet ? 'quiet' : 'done'" role="status">
    <div class="reaction-portrait relative pointer-events-none" :data-tone="reaction.tone">
      <CharacterPortrait :pack-id="character.packId" variant="face" size="md" :reaction-id="reaction.animationId" :stage="character.stage" :branch="character.branch" :build="character.build" :emotion="character.emotion" />
      <span class="reaction-accent" aria-hidden="true">{{ quiet ? '···' : reaction.decoration }}</span>
    </div>
    <p class="sr-only">{{ label }}</p>
    <ComicBubble compact :caption="reaction.caption" :tone="reaction.tone" :variant="reaction.variant" :decoration="reaction.decoration" :animation-id="reaction.animationId" class="pointer-events-none" />
    <p class="popup-detail pointer-events-none">{{ detail }}</p>
    <p v-if="error" role="alert" class="pointer-events-none text-xs text-red-300">{{ error }}</p>
    <button v-if="!hideClose" type="button" data-testid="close-result" class="setting-chip" @click.stop="$emit('close')">Закрыть</button>
    <p v-else class="pointer-events-none text-[10px] text-amber-300">Клик — прервать сценарий</p>
  </div>
</template>

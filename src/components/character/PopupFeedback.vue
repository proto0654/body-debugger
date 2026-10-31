<script setup lang="ts">
import CharacterPortrait from './CharacterPortrait.vue'
import ComicBubble from './ComicBubble.vue'
import type { CharacterState } from '@shared/types/character'
import type { CharacterReaction } from '@shared/domain/character-reaction'
defineProps<{ character: CharacterState; reaction: CharacterReaction; quiet?: boolean; label: string; detail: string; error?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="popup-success absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl p-4 text-center" :data-result="quiet ? 'quiet' : 'done'" role="status">
    <div class="reaction-portrait relative" :data-tone="reaction.tone">
      <CharacterPortrait :pack-id="character.packId" variant="face" size="md" :reaction-id="reaction.animationId" :stage="character.stage" :branch="character.branch" :build="character.build" :emotion="character.emotion" />
      <span class="reaction-accent" aria-hidden="true">{{ quiet ? '···' : reaction.decoration }}</span>
    </div>
    <p class="sr-only">{{ label }}</p>
    <ComicBubble compact :caption="reaction.caption" :tone="reaction.tone" :variant="reaction.variant" :decoration="reaction.decoration" :animation-id="reaction.animationId" />
    <p class="text-xs text-slate-400">{{ detail }}</p>
    <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
    <button type="button" data-testid="close-result" class="setting-chip" @click="$emit('close')">Закрыть</button>
  </div>
</template>

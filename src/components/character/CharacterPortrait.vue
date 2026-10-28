<script setup lang="ts">
import { computed } from 'vue'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterEmotion,
  CharacterStage
} from '@shared/types/character'
import { CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import stagesSheet from '@/assets/character/desk-hulk/sprite-sheet-stages.png'

const props = withDefaults(
  defineProps<{
    stage?: CharacterStage
    branch?: CharacterBranch
    build?: CharacterBuild
    emotion?: CharacterEmotion
    emojiFallback?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    stage: 0,
    branch: 'neutral',
    build: 'average',
    emotion: 'neutral',
    emojiFallback: '💪',
    size: 'md'
  }
)

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'h-16 w-16 text-3xl'
  if (props.size === 'lg') return 'h-40 w-40 text-6xl'
  return 'h-24 w-24 text-5xl'
})

const label = computed(() => CHARACTER_STAGE_LABELS[props.stage])
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div
      class="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-inner"
      :class="sizeClass"
      :title="`${label} · ${branch} · ${build} · ${emotion}`"
    >
      <!-- Sprite sheet as temporary backdrop until individual frames are cut -->
      <img
        :src="stagesSheet"
        alt=""
        class="absolute inset-0 h-full w-full object-cover object-left-top opacity-40"
      />
      <div class="relative flex h-full w-full items-center justify-center">
        <span aria-hidden="true">{{ emojiFallback }}</span>
      </div>
    </div>
    <p class="text-xs text-slate-400">
      stage {{ stage }} · {{ branch }}
    </p>
  </div>
</template>

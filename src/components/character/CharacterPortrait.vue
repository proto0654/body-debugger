<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterEmotion,
  CharacterStage
} from '@shared/types/character'
import { CHARACTER_BRANCH_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import {
  characterBodyCandidates,
  characterFaceCandidates
} from '@shared/domain/character-visual'
import { resolveFrameUrl } from './frames'

const props = withDefaults(
  defineProps<{
    stage?: CharacterStage
    branch?: CharacterBranch
    build?: CharacterBuild
    emotion?: CharacterEmotion
    emojiFallback?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showLabel?: boolean
    /** `body` = full sprite for the dashboard, `face` = emotion bust for the popup */
    variant?: 'body' | 'face'
  }>(),
  {
    stage: 0,
    branch: 'neutral',
    build: 'average',
    emotion: 'neutral',
    emojiFallback: '💪',
    size: 'md',
    variant: 'body',
    showLabel: true
  }
)

const sizeClass = computed(() => {
  if (props.size === 'xl') return 'h-52 w-44 text-6xl'
  if (props.size === 'sm') return 'h-16 w-16 text-3xl'
  if (props.size === 'lg') return 'h-40 w-40 text-6xl'
  return 'h-24 w-24 text-5xl'
})

const label = computed(() => CHARACTER_STAGE_LABELS[props.stage])

const frameUrl = computed(() =>
  resolveFrameUrl(
    props.variant === 'face'
      ? characterFaceCandidates(props.emotion, props.build)
      : characterBodyCandidates(props.stage, props.branch, props.build)
  )
)
const imageFailed = ref(false)
watch(frameUrl, () => { imageFailed.value = false })

/** Short bounce when the character reacts to a finished exercise (CONCEPT §13). */
const bouncing = ref(false)
let bounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.emotion,
  (next) => {
    if (next !== 'happy' && next !== 'surprised') return
    bouncing.value = true
    if (bounceTimer) clearTimeout(bounceTimer)
    bounceTimer = setTimeout(() => {
      bouncing.value = false
    }, 400)
  }
)

onBeforeUnmount(() => {
  if (bounceTimer) clearTimeout(bounceTimer)
})
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div
      class="character-portrait relative overflow-hidden rounded-2xl"
      :class="[sizeClass, { 'portrait-bounce': bouncing, 'fade-rise': variant === 'body', 'portrait-proud': emotion === 'proud', 'portrait-hero': size === 'xl' }]"
      :data-stage="stage"
      role="img"
      :aria-label="`${label} · ${CHARACTER_BRANCH_LABELS[branch]}`"
      :title="`${label} · ${CHARACTER_BRANCH_LABELS[branch]}`"
    >
      <Transition name="frame-fade">
        <img
          v-if="frameUrl && !imageFailed"
          :key="frameUrl"
          :src="frameUrl"
          alt=""
          class="absolute inset-0 h-full w-full object-contain"
          @error="imageFailed = true"
        />
      </Transition>
      <div v-if="!frameUrl || imageFailed" class="relative flex h-full w-full items-center justify-center">
        <span aria-hidden="true">{{ emojiFallback }}</span>
      </div>
    </div>
    <p v-if="variant === 'body' && showLabel" class="text-xs text-slate-400">
      {{ label }} · {{ CHARACTER_BRANCH_LABELS[branch] }}
    </p>
  </div>
</template>

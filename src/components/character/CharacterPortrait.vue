<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  CharacterBranch,
  CharacterBuild,
  CharacterConditionLevel,
  CharacterEmotion,
  CharacterStage
} from '@shared/types/character'
import { CHARACTER_BRANCH_LABELS, CHARACTER_EMOTION_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { characterConditionLabel } from '@shared/domain/character-condition'
import {
  characterBodyCandidates,
  characterFaceCandidates
} from '@shared/domain/character-visual'
import { resolveFrameUrl, preloadFrameUrl } from './frames'
import { DEFAULT_CHARACTER_PACK } from '@shared/constants/character'

const props = withDefaults(
  defineProps<{
    stage?: CharacterStage
    packId?: string
    branch?: CharacterBranch
    build?: CharacterBuild
    emotion?: CharacterEmotion
    condition?: CharacterConditionLevel
    emojiFallback?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showLabel?: boolean
    /** `body` = full sprite for the dashboard, `face` = emotion bust for the popup */
    variant?: 'body' | 'face'
    reactionId?: string | number
  }>(),
  {
    stage: 0,
    packId: DEFAULT_CHARACTER_PACK,
    branch: 'neutral',
    build: 'average',
    emotion: 'neutral',
    condition: 0,
    emojiFallback: '💪',
    size: 'md',
    variant: 'body',
    showLabel: true
  }
)
const emit = defineEmits<{ 'frame-status': [status: { packId: string; fallback: boolean; failed: number; url?: string }] }>()

const sizeClass = computed(() => {
  if (props.size === 'xl') return 'h-52 w-44 text-6xl'
  if (props.size === 'sm') return 'h-16 w-16 text-3xl'
  if (props.size === 'lg') return 'h-40 w-40 text-6xl'
  return 'h-24 w-24 text-5xl'
})

const label = computed(() => CHARACTER_STAGE_LABELS[props.stage])
const conditionLabel = computed(() => props.variant === 'body' && props.condition > 0
  ? ` · ${characterConditionLabel(props.condition, props.build)}` : '')

const candidates = computed(() => props.variant === 'face'
  ? characterFaceCandidates(props.emotion, props.build)
  : characterBodyCandidates(props.stage, props.branch, props.build, props.condition, props.packId))
const failedUrls = ref<string[]>([])
watch([candidates, () => props.packId], () => { failedUrls.value = [] })
const frameUrl = computed(() => resolveFrameUrl(candidates.value.filter(key => {
  const url = resolveFrameUrl([key, 'emoji'], props.packId)
  return !url || !failedUrls.value.includes(url)
}), props.packId))
const frameFallback = computed(() => !frameUrl.value || frameUrl.value !== resolveFrameUrl([candidates.value[0]!, 'emoji'], props.packId))
watch([frameUrl, frameFallback, () => failedUrls.value.length, () => props.packId], () => {
  emit('frame-status', { packId: props.packId, fallback: frameFallback.value, failed: failedUrls.value.length, url: frameUrl.value })
}, { immediate: true })
function rejectImage(): void {
  if (frameUrl.value) failedUrls.value = [...failedUrls.value, frameUrl.value]
}

/**
 * The result scene mounts a fresh face portrait, so the popup's header portrait
 * warms every emotion up front; the swap then paints instantly instead of
 * showing an empty frame.
 */
watch(
  [() => props.variant, () => props.build, () => props.packId],
  () => {
    if (props.variant !== 'face') return
    for (const emotion of Object.keys(CHARACTER_EMOTION_LABELS) as CharacterEmotion[]) {
      for (const key of characterFaceCandidates(emotion, props.build)) {
        preloadFrameUrl(resolveFrameUrl([key], props.packId))
      }
    }
  },
  { immediate: true }
)

/** Short bounce when the character reacts to a finished exercise (CONCEPT §13). */
const bouncing = ref(false)
let bounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => [props.emotion, props.reactionId] as const,
  ([next]) => {
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
      :class="[sizeClass, { 'portrait-bounce': bouncing, 'fade-rise': variant === 'body', 'portrait-proud': emotion === 'proud', 'portrait-hero': size === 'xl', 'portrait-expression': variant === 'face' && size === 'xl' }]"
      :data-stage="stage"
      :data-pack="packId"
      :data-frame-fallback="frameFallback"
      :data-emotion="emotion"
      :data-condition="condition"
      role="img"
      :aria-label="`${label} · ${CHARACTER_BRANCH_LABELS[branch]} · ${CHARACTER_EMOTION_LABELS[emotion]}${conditionLabel}`"
      :title="`${label} · ${CHARACTER_BRANCH_LABELS[branch]}${conditionLabel}`"
    >
      <Transition name="frame-fade">
        <img
          v-if="frameUrl"
          :key="frameUrl"
          :src="frameUrl"
          alt=""
          class="absolute inset-0 h-full w-full object-contain"
          @error="rejectImage"
        />
      </Transition>
      <div v-if="!frameUrl" class="relative flex h-full w-full items-center justify-center">
        <span aria-hidden="true">{{ emojiFallback }}</span>
      </div>
    </div>
    <p v-if="variant === 'body' && showLabel" class="text-xs text-slate-400">
      {{ label }} · {{ CHARACTER_BRANCH_LABELS[branch] }}{{ conditionLabel }}
    </p>
  </div>
</template>

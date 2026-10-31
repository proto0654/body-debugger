<script setup lang="ts">
import { computed } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import PopupFeedback from '@/components/character/PopupFeedback.vue'
import { characterReaction } from '@shared/domain/character-reaction'
import { LAB_POPUP_LABELS, type LabVisualPreview } from '@shared/domain/laboratory-preview'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'

const props = defineProps<{ preview: LabVisualPreview }>()
defineEmits<{ close: []; start: []; done: []; skip: []; snooze: [] }>()
const reaction = computed(() => characterReaction(props.preview.popup === 'error' ? 'active' : props.preview.popup, props.preview.sequence))
const feedback = computed(() => ['done', 'first-done', 'stage-up', 'streak', 'skipped', 'snoozed'].includes(props.preview.popup))
const active = computed(() => props.preview.popup === 'active' || props.preview.popup === 'error')
const exercise = EXERCISE_CATALOG[0]!
</script>

<template>
  <div class="lab-popup-preview relative flex h-full flex-col gap-2 p-3" data-testid="popup-preview" :data-state="preview.popup">
    <PopupFeedback v-if="feedback" :key="preview.sequence" :character="preview" :reaction="reaction"
      :quiet="preview.popup === 'skipped' || preview.popup === 'snoozed'" :label="LAB_POPUP_LABELS[preview.popup]"
      detail="Визуальный предпросмотр · без записи результата" @close="$emit('close')" />
    <template v-else>
      <ComicBubble compact :caption="reaction.caption" :tone="reaction.tone" :variant="reaction.variant" :animation-id="reaction.animationId" class="popup-speech" />
      <header class="flex items-start gap-2"><div class="min-w-0 flex-1"><p class="brand-label text-emerald-400">BODY DEBUGGER · ПРОСМОТР</p><h2 class="text-sm font-semibold text-white">{{ exercise.title }}</h2><p class="mt-1 text-xs text-slate-400">{{ exercise.description }}</p></div>
        <CharacterPortrait :pack-id="preview.packId" :stage="preview.stage" :build="preview.build" :branch="preview.branch" :emotion="preview.emotion" :reaction-id="reaction.animationId" variant="face" size="sm" />
      </header>
      <div class="flex items-center gap-3"><span class="text-2xl tabular-nums text-white">{{ active ? '00:08' : '00:30' }}</span><div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"><div class="h-full bg-emerald-500" :style="{ width: active ? '80%' : '0%' }" /></div></div>
      <p v-if="preview.popup === 'error'" role="alert" class="text-xs text-red-300">Не удалось сохранить. Попробуйте ещё раз.</p>
      <p v-else class="text-[11px] text-slate-400">{{ active ? 'Выполняем упражнение · предпросмотр' : 'Таймер начнётся, когда будешь готов' }}</p>
      <div class="mt-auto flex flex-wrap gap-2"><button type="button" class="setting-chip" @click="$emit('snooze')">Отложить</button><button type="button" class="setting-chip" @click="$emit('skip')">Пропустить</button><button type="button" class="setting-chip ml-auto" @click="active ? $emit('done') : $emit('start')">{{ active ? 'Готово' : 'Начать' }}</button></div>
    </template>
  </div>
</template>

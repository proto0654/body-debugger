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
  <div class="popup-hud lab-popup-preview relative flex h-full flex-col overflow-hidden" data-testid="popup-preview" :data-state="preview.popup">
    <PopupFeedback v-if="feedback" :key="preview.sequence" :character="preview" :reaction="reaction"
      :quiet="preview.popup === 'skipped' || preview.popup === 'snoozed'" :label="LAB_POPUP_LABELS[preview.popup]"
      detail="Визуальный предпросмотр · без записи результата" @close="$emit('close')" />
    <template v-else>
      <header class="popup-head">
        <h2 class="popup-hud-title">{{ exercise.title }}</h2>
        <p class="popup-hud-copy">{{ exercise.description }}</p>
        <p v-if="preview.popup === 'error'" role="alert" class="popup-hud-alert">Не удалось сохранить. Попробуйте ещё раз.</p>
      </header>
      <div class="popup-body">
        <div class="popup-side">
          <div class="popup-cast">
            <div class="popup-cast-track"><div class="popup-cast-fill" :style="{ width: active ? '80%' : '0%' }" /></div>
            <span class="popup-cast-time">{{ active ? '00:08' : '00:30' }}</span>
          </div>
          <div class="popup-actions">
            <button type="button" class="popup-action" @click="$emit('snooze')">Отложить</button>
            <button type="button" class="popup-action" @click="$emit('skip')">Пропустить</button>
            <button type="button" class="popup-action-primary" @click="active ? $emit('done') : $emit('start')">{{ active ? 'Готово' : 'Начать' }}</button>
          </div>
        </div>
        <div class="popup-face">
          <div class="reaction-portrait relative" :data-tone="reaction.tone">
            <CharacterPortrait :pack-id="preview.packId" :stage="preview.stage" :build="preview.build" :branch="preview.branch" :emotion="preview.emotion" :reaction-id="reaction.animationId" variant="face" size="popup" />
            <span class="reaction-accent" aria-hidden="true">{{ reaction.decoration }}</span>
            <ComicBubble compact tail="top" :caption="reaction.caption" :tone="reaction.tone" :variant="reaction.variant" :decoration="reaction.decoration" :animation-id="reaction.animationId" class="popup-speech" />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

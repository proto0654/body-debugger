<script setup lang="ts">
import CharacterPortrait from './CharacterPortrait.vue'
import {
  CHARACTER_BRANCHES,
  CHARACTER_BRANCH_LABELS,
  CHARACTER_BUILD_LABELS,
  CHARACTER_BUILDS,
  CHARACTER_EMOTION_LABELS,
  CHARACTER_STAGE_LABELS
} from '@shared/constants/character'
import { characterConditionLabel } from '@shared/domain/character-condition'
import type { ManualCharacterState } from '@shared/domain/character-context'
import type { CharacterBuild, CharacterConditionLevel, CharacterEmotion, CharacterStage } from '@shared/types/character'

const props = defineProps<{
  modelValue: ManualCharacterState | null
  defaults: ManualCharacterState
  packId: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ManualCharacterState | null] }>()

const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
const conditions: CharacterConditionLevel[] = [0, 1, 2, 3]
const builds = CHARACTER_BUILDS.filter((build): build is Exclude<CharacterBuild, 'neutral'> => build !== 'neutral')
const emotions = Object.keys(CHARACTER_EMOTION_LABELS) as CharacterEmotion[]

function enable(): void { emit('update:modelValue', { ...props.defaults }) }
function reset(): void { emit('update:modelValue', null) }
function update(patch: Partial<ManualCharacterState>): void {
  if (!props.modelValue) return
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <section class="settings-card space-y-3" data-testid="manual-character-controls">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p class="brand-label text-amber-300">РУЧНОЙ ВИД</p>
        <h3 class="mt-1 text-sm font-semibold text-white">Временный предпросмотр</h3>
      </div>
      <button v-if="!modelValue" type="button" class="setting-chip" @click="enable">Включить ручной вид</button>
      <button v-else type="button" class="setting-chip" @click="reset">Сбросить к таймлайну</button>
    </div>

    <p v-if="!modelValue" class="max-w-2xl text-xs leading-relaxed text-slate-400">Форма, состояние, направление и телосложение идут за выбранной позицией истории. Включите ручной вид, чтобы временно посмотреть другое состояние — без записи в профиль.</p>

    <template v-else>
      <div class="preview-stage flex flex-wrap items-center justify-center gap-6 rounded-2xl bg-slate-900 p-5" data-testid="manual-character-preview">
        <CharacterPortrait :pack-id="packId" :stage="modelValue.stage" :branch="modelValue.branch" :build="modelValue.build" :condition="modelValue.condition" :emotion="modelValue.emotion" size="md" :show-label="false" />
        <CharacterPortrait :pack-id="packId" :stage="modelValue.stage" :branch="modelValue.branch" :build="modelValue.build" :emotion="modelValue.emotion" variant="face" size="sm" :show-label="false" />
      </div>

      <fieldset>
        <legend class="mb-2 text-xs font-semibold text-white">Форма</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="value in stages" :key="value" type="button" class="setting-chip" :data-preview-stage="value" :aria-pressed="modelValue.stage === value" @click="update({ stage: value })">{{ value + 1 }} · {{ CHARACTER_STAGE_LABELS[value] }}</button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-2 text-xs font-semibold text-white">Состояние тела</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="value in conditions" :key="value" type="button" class="setting-chip" :data-preview-condition="value" :aria-pressed="modelValue.condition === value" @click="update({ condition: value })">{{ value }} · {{ characterConditionLabel(value, modelValue.build) }}</button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-2 text-xs font-semibold text-white">Направление</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="value in CHARACTER_BRANCHES" :key="value" type="button" class="setting-chip" :data-preview-branch="value" :aria-pressed="modelValue.branch === value" @click="update({ branch: value })">{{ CHARACTER_BRANCH_LABELS[value] }}</button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-2 text-xs font-semibold text-white">Телосложение предпросмотра</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="value in builds" :key="value" type="button" class="setting-chip" :data-preview-build="value" :aria-pressed="modelValue.build === value" @click="update({ build: value })">{{ CHARACTER_BUILD_LABELS[value] }}</button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-2 text-xs font-semibold text-white">Эмоция</legend>
        <div class="flex flex-wrap gap-2">
          <button v-for="value in emotions" :key="value" type="button" class="setting-chip" :data-preview-emotion="value" :aria-pressed="modelValue.emotion === value" @click="update({ emotion: value })">{{ CHARACTER_EMOTION_LABELS[value] }}</button>
        </div>
      </fieldset>

      <p class="text-[11px] text-slate-500">Ручной вид временный и не сохраняется. Реальная история, настройки и прогресс не меняются.</p>
    </template>
  </section>
</template>

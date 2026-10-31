<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ComicBubble from '@/components/character/ComicBubble.vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import PopupPreview from './PopupPreview.vue'
import { characterReaction } from '@shared/domain/character-reaction'
import { LAB_POPUP_STATES, LAB_POPUP_LABELS, type LabVisualPreview, type LabPopupState } from '@shared/domain/laboratory-preview'
import { reactionDuration } from '@shared/domain/reaction-timing'
import { useCharacterStore } from '@/stores/character'
import { useSettingsStore } from '@/stores/settings'
import { CHARACTER_BRANCHES, CHARACTER_BRANCH_LABELS, CHARACTER_BUILDS, CHARACTER_BUILD_LABELS, CHARACTER_EMOTION_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import { characterConditionLabel } from '@shared/domain/character-condition'
import type { CharacterBuild, CharacterConditionLevel, CharacterEmotion, CharacterStage } from '@shared/types/character'
import { characterBodyCandidates } from '@shared/domain/character-visual'
import { resolveFrameUrl } from '@/components/character/frames'

const props = withDefaults(defineProps<{ nativePreview?: LabVisualPreview | null }>(), { nativePreview: null })
const emit = defineEmits<{ change: [preview: LabVisualPreview] }>()
const settings = useSettingsStore()
const profile = useCharacterStore()
const stage = ref(profile.state.stage)
const build = ref(profile.state.build)
const branch = ref(profile.state.branch)
const condition = ref(profile.condition.level)
const emotion = ref<CharacterEmotion>('neutral')
const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
const conditions: CharacterConditionLevel[] = [0, 1, 2, 3]
const builds = CHARACTER_BUILDS.filter(value => value !== 'neutral')
const emotions = Object.keys(CHARACTER_EMOTION_LABELS) as CharacterEmotion[]
const popup = ref<LabPopupState>('ready')
const hold = ref(true)
const reacting = ref(false)
const sequence = ref(0)
const error = ref('')
const reaction = computed(() => characterReaction(popup.value === 'error' ? 'active' : popup.value, sequence.value))
const visual = computed<LabVisualPreview>(() => ({ packId: settings.characterPackId, stage: stage.value,
  build: build.value, branch: branch.value, condition: condition.value, emotion: emotion.value,
  popup: popup.value, sequence: sequence.value }))
let timer: ReturnType<typeof setTimeout> | undefined
let updates = 0
let lastSent = ''
function resetReaction(): void { reacting.value = false; emotion.value = 'neutral'; popup.value = 'ready' }
function replay(value: LabPopupState = popup.value): void {
  clearTimeout(timer)
  popup.value = value
  sequence.value++
  emotion.value = reaction.value.emotion
  reacting.value = true
  if (!hold.value) timer = setTimeout(resetReaction, reactionDuration(value === 'error' ? 'active' : value))
}
function selectEmotion(value: CharacterEmotion): void {
  clearTimeout(timer)
  reacting.value = false
  emotion.value = value
  sequence.value++
}
function selectBuild(value: CharacterBuild): void { build.value = value }
function stepForm(direction: number): void { stage.value = stages[(stage.value + direction + stages.length) % stages.length]! }
function fromProfile(): void {
  clearTimeout(timer)
  resetReaction()
  stage.value = profile.state.stage; build.value = profile.state.build
  branch.value = profile.state.branch; condition.value = profile.condition.level
}
async function sendPreview(open = false): Promise<void> {
  const snapshot = { ...visual.value }
  const key = JSON.stringify(snapshot)
  if (!open && key === lastSent) return
  lastSent = key
  updates++
  error.value = ''
  try { await window.api.labCommand({ action: 'visual-preview', preview: snapshot, open }) }
  catch (cause) { lastSent = ''; console.error('[laboratory-preview] update failed', cause); error.value = 'Не удалось открыть или обновить предпросмотр.' }
  finally { updates-- }
}
watch(visual, value => { emit('change', { ...value }); if (props.nativePreview) void sendPreview() }, { immediate: true })
watch(() => props.nativePreview, value => {
  if (!value) { lastSent = ''; return }
  const key = JSON.stringify(value)
  if (updates && key !== lastSent) return
  clearTimeout(timer)
  lastSent = key
  stage.value = value.stage; build.value = value.build; branch.value = value.branch
  condition.value = value.condition; emotion.value = value.emotion; popup.value = value.popup; sequence.value = value.sequence
}, { immediate: true })
watch(hold, () => { if (reacting.value) replay() })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section class="space-y-5" data-testid="lab-appearance">
    <div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-sm font-semibold text-white">Ручная проверка состояний</h2><button type="button" class="setting-chip" @click="fromProfile">Взять параметры профиля</button></div>
    <p class="text-xs text-slate-400">Нажимай на формы, состояния и эмоции в любом порядке. Эти переключения не меняют историю, достигнутый прогресс или настройки профиля. У Desk Hulk три иллюстрации тела на шесть форм, у остальных персонажей — шесть.</p>
    <section class="settings-card space-y-3" aria-label="Формы персонажа">
      <div class="flex items-center justify-between gap-2"><h3 class="text-sm font-semibold text-white">Форма {{ stage + 1 }} / 6 · {{ CHARACTER_STAGE_LABELS[stage] }}</h3><div class="flex gap-1"><button type="button" class="setting-chip" aria-label="Предыдущая форма" @click="stepForm(-1)">←</button><button type="button" class="setting-chip" aria-label="Следующая форма" @click="stepForm(1)">→</button></div></div>
      <div class="lab-form-grid"><button v-for="item in stages" :key="item" type="button" class="lab-form-card" :data-preview-stage="item" :aria-pressed="stage === item" @click="stage = item">
        <CharacterPortrait :pack-id="settings.characterPackId" :stage="item" :branch="branch" :build="build" :condition="0" size="sm" :show-label="false" />
        <span>{{ item + 1 }} · {{ CHARACTER_STAGE_LABELS[item] }}</span>
      </button></div>
    </section>
    <section class="settings-card space-y-4">
      <fieldset><legend class="mb-2 text-sm font-semibold text-white">Состояние тела</legend><div class="flex flex-wrap gap-2"><button v-for="level in conditions" :key="level" type="button" class="setting-chip" :data-preview-condition="level" :aria-pressed="condition === level" @click="condition = level">{{ level }} · {{ characterConditionLabel(level, build) }}</button></div><p class="mt-2 text-xs text-slate-400">Ухудшение временно заменяет тело. Выбранная форма сохраняется.</p></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold text-white">Направление</legend><div class="flex flex-wrap gap-2"><button v-for="value in CHARACTER_BRANCHES" :key="value" type="button" class="setting-chip" :data-preview-branch="value" :aria-pressed="branch === value" @click="branch = value">{{ CHARACTER_BRANCH_LABELS[value] }}</button></div></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold text-white">Телосложение предпросмотра</legend><div class="flex flex-wrap gap-2"><button v-for="value in builds" :key="value" type="button" class="setting-chip" :data-preview-build="value" :aria-pressed="build === value" @click="selectBuild(value)">{{ CHARACTER_BUILD_LABELS[value] }}</button></div></fieldset>
      <fieldset><legend class="mb-2 text-sm font-semibold text-white">Эмоция</legend><div class="flex flex-wrap gap-2"><button v-for="value in emotions" :key="value" type="button" class="setting-chip" :data-preview-emotion="value" :aria-pressed="emotion === value" @click="selectEmotion(value)">{{ CHARACTER_EMOTION_LABELS[value] }}</button></div></fieldset>
    </section>
    <div class="preview-stage flex flex-wrap justify-center gap-6 rounded-2xl bg-slate-900 p-5" :data-idle="!reacting">
      <CharacterPortrait data-testid="manual-body" :pack-id="settings.characterPackId" :stage="stage" :branch="branch" :build="build" :condition="condition" :emotion="emotion" size="xl" />
      <CharacterPortrait data-testid="manual-face" :pack-id="settings.characterPackId" :stage="stage" :branch="branch" :build="build" :emotion="emotion" :reaction-id="reaction.animationId" variant="face" size="xl" />
    </div>
    <section class="settings-card space-y-4" aria-label="Ручные состояния попапа">
      <h3 class="text-sm font-semibold text-white">Попап и комиксные реакции</h3>
      <div class="flex flex-wrap gap-2"><button v-for="value in LAB_POPUP_STATES" :key="value" type="button" class="setting-chip" :data-preview-popup="value" :aria-pressed="popup === value" @click="replay(value)">{{ LAB_POPUP_LABELS[value] }}</button></div>
      <div class="flex flex-wrap items-center gap-3"><button type="button" class="setting-chip" data-testid="replay-reaction" @click="replay()">Повторить реакцию</button><label class="text-xs text-slate-300 flex items-center gap-2"><input v-model="hold" type="checkbox" aria-label="Удерживать предпросмотр">Удерживать предпросмотр</label></div>
      <ComicBubble v-if="reacting" :caption="reaction.caption" :tone="reaction.tone" :variant="reaction.variant" :decoration="reaction.decoration" :animation-id="reaction.animationId" />
      <div class="manual-popup-frame"><PopupPreview :preview="visual" @close="replay('ready')" @start="replay('active')" @done="replay('done')" @skip="replay('skipped')" @snooze="replay('snoozed')" /></div>
      <button type="button" class="setting-chip" data-testid="open-visual-popup" @click="sendPreview(true)">{{ nativePreview ? 'Показать отдельное окно ↗' : 'Открыть предпросмотр у трея ↗' }}</button>
      <p class="text-xs text-slate-400">Отдельное окно повторяет выбранное состояние и обновляется при переключениях. Его кнопки тоже можно прокликивать; тренировки и результаты не записываются. Для реального цикла используй «Попап и цикл».</p>
      <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
    </section>
    <details class="text-xs text-slate-500"><summary>Диагностика выбранного тела</summary><p class="mt-2 break-all">{{ characterBodyCandidates(stage, branch, build, condition, settings.characterPackId).join(' → ') }}<br>{{ resolveFrameUrl(characterBodyCandidates(stage, branch, build, condition, settings.characterPackId), settings.characterPackId) ?? 'Эмодзи' }}</p></details>
  </section>
</template>

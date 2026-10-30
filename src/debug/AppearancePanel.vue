<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
const settings = useSettingsStore()
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import { CHARACTER_BRANCH_LABELS, CHARACTER_BUILD_LABELS, CHARACTER_EMOTION_LABELS, CHARACTER_STAGE_LABELS } from '@shared/constants/character'
import type { CharacterBranch, CharacterBuild, CharacterConditionLevel, CharacterEmotion, CharacterStage } from '@shared/types/character'
import { characterBodyCandidates } from '@shared/domain/character-visual'
import { resolveFrameUrl } from '@/components/character/frames'

const stage = ref<CharacterStage>(4)
const build = ref<CharacterBuild>('average')
const branch = ref<CharacterBranch>('neutral')
const condition = ref<CharacterConditionLevel>(0)
const emotion = ref<CharacterEmotion>('neutral')
const stages: CharacterStage[] = [0, 1, 2, 3, 4, 5]
</script>

<template>
  <section class="space-y-5" data-testid="lab-appearance">
    <p class="text-xs text-slate-400">Визуальный просмотр. Параметры здесь не записываются в историю. Desk Hulk использует три тела; остальные персонажи — шесть. Позы силы и подвижности появляются со стадии 4.</p>
    <div class="lab-controls">
      <label>Форма<select v-model="stage"><option v-for="item in stages" :key="item" :value="item">{{ item }} · {{ CHARACTER_STAGE_LABELS[item] }}</option></select></label>
      <label>Телосложение<select v-model="build"><option v-for="(title, key) in CHARACTER_BUILD_LABELS" :key="key" :value="key">{{ title }}</option></select></label>
      <label>Направление<select v-model="branch"><option v-for="(title, key) in CHARACTER_BRANCH_LABELS" :key="key" :value="key">{{ title }}</option></select></label>
      <label>Ухудшение<select v-model="condition"><option v-for="level in [0, 1, 2, 3]" :key="level" :value="level">{{ level }}</option></select></label>
      <label>Эмоция<select v-model="emotion"><option v-for="(title, key) in CHARACTER_EMOTION_LABELS" :key="key" :value="key">{{ title }}</option></select></label>
    </div>
    <div class="flex flex-wrap justify-center gap-10 rounded-2xl bg-slate-900 p-5">
      <CharacterPortrait :pack-id="settings.characterPackId" :stage="stage" :branch="branch" :build="build" :condition="condition" :emotion="emotion" size="xl" />
      <CharacterPortrait :pack-id="settings.characterPackId" :stage="stage" :branch="branch" :build="build" :emotion="emotion" variant="face" size="xl" />
    </div>
    <p class="break-all text-xs text-slate-500">Кандидаты кадра: {{ characterBodyCandidates(stage, branch, build, condition, settings.characterPackId).join(' → ') }}<br>Ресурс: {{ resolveFrameUrl(characterBodyCandidates(stage, branch, build, condition, settings.characterPackId), settings.characterPackId) ?? 'Эмодзи' }}</p>
    <div class="grid grid-cols-3 gap-2">
      <div v-for="item in stages" :key="item" class="rounded-xl border border-slate-700 p-3 text-center">
        <CharacterPortrait :pack-id="settings.characterPackId" :stage="item" :branch="branch" :build="build" :condition="condition" :emotion="emotion" size="lg" :show-label="false" />
        <p class="mt-2 text-xs text-slate-400">{{ item }} · {{ CHARACTER_STAGE_LABELS[item] }}</p>
      </div>
    </div>
  </section>
</template>

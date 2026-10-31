<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { CHARACTER_PACKS } from '@shared/constants/character-packs'
import { SOUND_CUE_LABELS, VOICE_EVENTS, VOICE_EVENT_LABELS, type VoiceEvent } from '@shared/domain/sounds'
import { EFFECT_CLIPS, voiceClips, type EffectClip, type VoiceClip } from '@/voice-assets'
import { useSettingsStore } from '@/stores/settings'

/**
 * Manual auditioning of the generated package (docs/AUDIO-PRODUCTION.md).
 * Deliberately independent of the sound settings: previews bypass the master
 * switch and the opt-in voice layer, exactly like the existing cue previews.
 */
const settings = useSettingsStore()
const characterId = ref(settings.characterPackId)
const playing = ref('')
const error = ref('')

let audio: HTMLAudioElement | null = null
let queue: string[] = []

const groups = computed(() => VOICE_EVENTS
  .map((event) => ({ event, clips: voiceClips(characterId.value, event) }))
  .filter((group) => group.clips.length > 0))

const effectGroups = computed(() => {
  const byEvent = new Map<string, EffectClip[]>()
  for (const clip of EFFECT_CLIPS) {
    const bucket = byEvent.get(clip.event)
    if (bucket) bucket.push(clip)
    else byEvent.set(clip.event, [clip])
  }
  return Array.from(byEvent, ([event, clips]) => ({ event, clips }))
})

const volume = computed(() => Math.max(0.1, settings.sound.volume))

function eventLabel(event: string): string {
  if (event === 'start') return 'Старт'
  return (SOUND_CUE_LABELS as Record<string, string>)[event] ?? event
}

function variantLabel(variant: string): string {
  return /^\d+$/.test(variant) ? `вариант ${Number(variant)}` : variant
}

function clipKey(clip: VoiceClip): string {
  return `${clip.characterId}__${clip.event}__${clip.variant}`
}

function stop(): void {
  queue = []
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio = null
  }
  playing.value = ''
}

function advance(): void {
  const url = queue.shift()
  if (!url) {
    stop()
    return
  }
  const element = new Audio(url)
  audio = element
  element.volume = volume.value
  element.addEventListener('ended', advance)
  element.addEventListener('error', () => {
    console.warn('[audition] clip could not be decoded', url)
    advance()
  })
  void element.play().catch((cause: unknown) => {
    console.warn('[audition] clip could not start', url, cause)
    error.value = 'Не удалось воспроизвести файл. Проверьте громкость системы.'
    advance()
  })
}

function startQueue(urls: string[], id: string): void {
  stop()
  error.value = ''
  if (!urls.length) return
  queue = [...urls]
  playing.value = id
  advance()
}

function playClip(clip: VoiceClip): void {
  startQueue([clip.url], clipKey(clip))
}

function playEvent(event: VoiceEvent, clips: readonly VoiceClip[]): void {
  startQueue(clips.map((clip) => clip.url), `event:${event}`)
}

function playEffect(clip: EffectClip): void {
  startQueue([clip.url], `effect:${clip.id}:${clip.take}`)
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="space-y-4" data-testid="sound-audition">
    <section class="settings-card space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-semibold text-white">Голос персонажа</h2>
          <p class="mt-1 text-xs leading-relaxed text-slate-400">Все варианты событий из пакета. «Все варианты» играет их подряд, чтобы сравнить подачу и длину.</p>
        </div>
        <button type="button" class="setting-chip" data-testid="audition-stop" :disabled="!playing" @click="stop">Стоп</button>
      </div>
      <label class="block space-y-2 text-xs text-slate-300">Персонаж
        <select v-model="characterId" class="profile-select" aria-label="Персонаж для прослушивания" data-testid="audition-character">
          <option v-for="pack in CHARACTER_PACKS" :key="pack.id" :value="pack.id">{{ pack.label }}</option>
        </select>
      </label>
      <p class="text-xs text-slate-500">Прослушивание включает звук независимо от общего переключателя и от настройки «Голос персонажа».</p>
      <p v-if="!groups.length" class="text-xs text-amber-300">Для этого персонажа клипов нет.</p>
      <div v-for="group in groups" :key="group.event" class="space-y-2 border-t border-slate-800 pt-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs font-semibold text-slate-200">{{ VOICE_EVENT_LABELS[group.event] }} <span class="text-slate-500">· {{ group.clips.length }}</span></p>
          <button type="button" class="setting-chip" :data-audition-play-event="group.event"
            :aria-pressed="playing === `event:${group.event}`" @click="playEvent(group.event, group.clips)">▶ все варианты</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-for="clip in group.clips" :key="clip.variant" type="button" class="setting-chip"
            :data-audition-clip="clipKey(clip)" :aria-pressed="playing === clipKey(clip)" @click="playClip(clip)">{{ variantLabel(clip.variant) }}</button>
        </div>
      </div>
    </section>

    <section class="settings-card space-y-3">
      <h2 class="text-sm font-semibold text-white">Эффекты <span class="text-slate-500">· {{ EFFECT_CLIPS.length }}</span></h2>
      <p class="text-xs leading-relaxed text-slate-400">Общие сигналы вместо голоса. Если у эффекта есть тейки, кнопки подписаны номером тейка.</p>
      <div v-for="group in effectGroups" :key="group.event" class="space-y-2 border-t border-slate-800 pt-3">
        <p class="text-xs font-semibold text-slate-200">{{ eventLabel(group.event) }}</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="clip in group.clips" :key="`${clip.id}:${clip.take}`" type="button" class="setting-chip"
            :data-audition-effect="clip.id" :aria-pressed="playing === `effect:${clip.id}:${clip.take}`"
            @click="playEffect(clip)">{{ group.clips.length > 1 ? `тейк ${clip.take}` : '▶' }}</button>
        </div>
      </div>
    </section>

    <p v-if="error" role="alert" class="text-xs text-red-300">{{ error }}</p>
  </div>
</template>

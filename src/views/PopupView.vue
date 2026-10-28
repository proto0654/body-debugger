<script setup lang="ts">
import { onMounted, ref } from 'vue'
import CharacterPortrait from '@/components/character/CharacterPortrait.vue'
import { useSessionsStore } from '@/stores/sessions'
import { useCharacterStore } from '@/stores/character'
import type { SessionStatus } from '@shared/types/session'

const sessions = useSessionsStore()
const character = useCharacterStore()
const busy = ref(false)

onMounted(() => {
  if (!sessions.current) {
    sessions.beginSession()
  }
  character.setEmotion('focused')
})

async function submit(status: SessionStatus): Promise<void> {
  if (busy.value) return
  busy.value = true

  if (status === 'done') {
    character.setEmotion('happy')
  } else if (status === 'skipped') {
    character.setEmotion('tired')
  }

  const session = sessions.recordResult(status)
  if (session && window.api) {
    await window.api.sessionResult({
      sessionId: session.id,
      exerciseId: session.exerciseId,
      status: session.status,
      durationSec: session.durationSec
    })
    await window.api.closePopup()
  }
  busy.value = false
}
</script>

<template>
  <div class="flex h-full flex-col gap-3 p-3">
    <header class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
          Body Debugger
        </p>
        <h1 class="truncate text-sm font-semibold text-slate-50">
          {{ sessions.currentExercise?.title ?? 'Упражнение' }}
        </h1>
        <p class="mt-1 line-clamp-2 text-xs text-slate-400">
          {{ sessions.currentExercise?.description ?? 'Один попап — одно упражнение.' }}
        </p>
      </div>
      <CharacterPortrait
        size="sm"
        :stage="character.state.stage"
        :branch="character.state.branch"
        :build="character.state.build"
        :emotion="character.emotion"
        :emoji-fallback="sessions.currentExercise?.emojiFallback ?? '💪'"
      />
    </header>

    <div class="mt-auto flex items-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        :disabled="busy"
        @click="submit('snoozed')"
      >
        Отложить
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        :disabled="busy"
        @click="submit('skipped')"
      >
        Пропустить
      </button>
      <button
        type="button"
        class="ml-auto rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
        :disabled="busy"
        @click="submit('done')"
      >
        Готово
      </button>
    </div>
  </div>
</template>

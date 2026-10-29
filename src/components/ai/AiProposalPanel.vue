<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCustomExercisesStore } from '@/stores/custom-exercises'
import { EXERCISE_CATALOG } from '@shared/constants/exercises'
import {
  canApproveExercise,
  parseExerciseProposal,
  type ProposalError
} from '@shared/domain/ai-proposal'
import type { Exercise } from '@shared/types/exercise'

const props = withDefaults(defineProps<{ enabled?: boolean }>(), { enabled: true })

const store = useCustomExercisesStore()
const text = ref('')
const proposal = ref<Exercise | null>(null)
const error = ref('')
const status = ref('')

const errorLabels: Record<ProposalError, string> = {
  empty: 'Вставьте JSON упражнения',
  'invalid-json': 'Не удалось разобрать JSON',
  'invalid-exercise': 'JSON не соответствует схеме Exercise'
}

const takenIds = computed(() => [
  ...EXERCISE_CATALOG.map((exercise) => exercise.id),
  ...store.entries.map((exercise) => exercise.id)
])

const canApprove = computed(
  () => proposal.value !== null && canApproveExercise(proposal.value, takenIds.value).ok
)

function check(): void {
  status.value = ''
  const result = parseExerciseProposal(text.value)
  if (!result.exercise) {
    proposal.value = null
    error.value = result.error ? errorLabels[result.error] : errorLabels['invalid-exercise']
    return
  }

  proposal.value = result.exercise
  error.value = canApproveExercise(result.exercise, takenIds.value).ok
    ? ''
    : 'Упражнение с таким id уже есть'
}

async function approve(): Promise<void> {
  if (!proposal.value || !canApprove.value) return

  const added = await store.approve(proposal.value)
  if (!added) {
    error.value = 'Не удалось добавить упражнение'
    return
  }

  proposal.value = null
  text.value = ''
  error.value = ''
  status.value = `«${added.title}» добавлено в каталог`
}

async function remove(id: string): Promise<void> {
  await store.remove(id)
}

onMounted(() => {
  void store.refresh()
})
</script>

<template>
  <section
    v-if="props.enabled"
    class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
    data-testid="ai-panel"
  >
    <header class="space-y-1">
      <h2 class="text-sm font-semibold text-white">AI-предложение</h2>
      <p class="text-xs text-slate-500">
        Вставьте JSON упражнения из внешнего AI. Оно попадёт в каталог только после проверки и
        подтверждения.
      </p>
    </header>

    <textarea
      v-model="text"
      data-testid="ai-input"
      rows="4"
      spellcheck="false"
      placeholder='{ "id": "ai-neck-reset", "title": "…", "description": "…", "durationSec": 40, "difficulty": 2, "category": "neck", "emojiFallback": "🧘" }'
      class="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-[11px] text-slate-100 outline-none focus:border-emerald-500"
    />

    <div class="flex flex-wrap gap-1">
      <button
        type="button"
        data-testid="ai-check"
        class="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
        @click="check"
      >
        Проверить
      </button>
      <button
        type="button"
        data-testid="ai-approve"
        class="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        :disabled="!canApprove"
        @click="approve"
      >
        Утвердить
      </button>
    </div>

    <p v-if="error" class="text-xs text-red-300" data-testid="ai-error">{{ error }}</p>
    <p v-if="status" class="text-xs text-emerald-300" data-testid="ai-status">{{ status }}</p>

    <section
      v-if="proposal"
      class="space-y-1 rounded-lg border border-slate-700 bg-slate-950 p-2"
      data-testid="ai-preview"
    >
      <p class="text-sm font-medium text-white">{{ proposal.emojiFallback }} {{ proposal.title }}</p>
      <p class="text-xs text-slate-400">{{ proposal.description }}</p>
      <p class="text-[10px] text-slate-500">
        {{ proposal.id }} · {{ proposal.category }} · {{ proposal.durationSec }} с · сложность
        {{ proposal.difficulty }}
      </p>
    </section>

    <section v-if="store.entries.length" class="space-y-1">
      <h3 class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Утверждённые
      </h3>
      <ul class="space-y-1" data-testid="ai-approved">
        <li
          v-for="exercise in store.entries"
          :key="exercise.id"
          class="flex items-center justify-between rounded-lg bg-slate-950 px-2 py-1 text-xs"
        >
          <span class="text-slate-300">{{ exercise.emojiFallback }} {{ exercise.title }}</span>
          <button
            type="button"
            :data-ai-remove="exercise.id"
            class="rounded px-1 text-slate-500 hover:text-red-300"
            :aria-label="`Удалить ${exercise.title}`"
            @click="remove(exercise.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </section>
  </section>
</template>

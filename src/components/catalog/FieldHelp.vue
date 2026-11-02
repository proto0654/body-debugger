<script setup lang="ts">
import { computed, ref } from 'vue'
import { fieldDoc } from '@shared/constants/field-docs'

const props = defineProps<{ fieldKey: string }>()
const open = ref(false)
const doc = computed(() => fieldDoc(props.fieldKey))
</script>

<template>
  <span v-if="doc" class="relative inline-flex align-middle">
    <button
      type="button"
      class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 text-[10px] text-slate-400 hover:border-emerald-500 hover:text-emerald-400"
      :aria-label="`Справка: ${doc.label}`"
      :aria-expanded="open"
      @click.stop="open = !open"
      @blur="open = false"
    >
      ?
    </button>
    <span
      v-if="open"
      role="tooltip"
      class="absolute left-0 top-5 z-30 w-64 rounded-md border border-slate-700 bg-slate-950 p-2 text-left text-[11px] text-slate-300 shadow-lg"
    >
      <strong class="block text-slate-100">{{ doc.label }}<span v-if="doc.unit"> · {{ doc.unit }}</span></strong>
      <span class="mt-1 block">{{ doc.what }}</span>
      <ul v-if="doc.affects.length" class="mt-2 space-y-1 text-slate-400">
        <li v-for="(item, index) in doc.affects" :key="index">
          <span class="text-slate-300">{{ item.where }}:</span> {{ item.how }}
        </li>
      </ul>
      <p v-if="doc.formula" class="mt-2 font-mono text-[10px] text-emerald-400/90">{{ doc.formula }}</p>
    </span>
  </span>
</template>

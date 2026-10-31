<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'
const props = defineProps<{ modelValue: T; items: readonly { id: T; label: string }[]; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
const id = useId()
function navigate(event: KeyboardEvent, index: number): void {
  const count = props.items.length
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1
    : event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : null
  if (next === null) return
  event.preventDefault()
  emit('update:modelValue', props.items[next]!.id)
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  buttons?.[next]?.focus()
}
</script>

<template>
  <div class="section-tabs">
    <nav class="dashboard-tabs" role="tablist" :aria-label="label">
      <button v-for="(item, index) in items" :id="`${id}-${item.id}`" :key="item.id" type="button" role="tab"
        :aria-selected="modelValue === item.id" :aria-controls="`${id}-panel`" :tabindex="modelValue === item.id ? 0 : -1"
        :class="{ 'is-active': modelValue === item.id }" @click="emit('update:modelValue', item.id)" @keydown="navigate($event, index)">{{ item.label }}</button>
    </nav>
    <section :id="`${id}-panel`" class="section-panel space-y-4" role="tabpanel" :aria-labelledby="`${id}-${modelValue}`" tabindex="0"><slot /></section>
  </div>
</template>

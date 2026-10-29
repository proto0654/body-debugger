<script setup lang="ts">
import { photoUrl } from '@/photos'
import type { PhotoEntry } from '@shared/types/photo'

defineProps<{ photos: PhotoEntry[] }>()
defineEmits<{ remove: [id: string] }>()

function displayDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('ru-RU')
}
</script>

<template>
  <section class="space-y-2" data-testid="photo-gallery">
    <p v-if="photos.length === 0" class="text-xs text-slate-500">Фото пока нет</p>
    <ul v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <li
        v-for="photo in photos"
        :key="photo.id"
        class="group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
      >
        <img
          :src="photoUrl(photo.id)"
          alt="Фото прогресса"
          loading="lazy"
          class="aspect-square w-full object-cover"
        />
        <span class="absolute inset-x-0 bottom-0 bg-slate-950/70 px-1 py-0.5 text-[9px] text-slate-300">
          {{ displayDate(photo.createdAt) }}
        </span>
        <button
          type="button"
          class="absolute right-1 top-1 rounded bg-slate-950/80 px-1 text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
          :aria-label="`Удалить фото от ${displayDate(photo.createdAt)}`"
          :data-photo-remove="photo.id"
          @click="$emit('remove', photo.id)"
        >
          ×
        </button>
      </li>
    </ul>
  </section>
</template>

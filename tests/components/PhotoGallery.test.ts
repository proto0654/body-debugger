import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoGallery from '@/components/photos/PhotoGallery.vue'
import type { PhotoEntry } from '@shared/types/photo'

function entry(id: string, createdAt: string): PhotoEntry {
  return {
    id,
    fileName: `${id}.png`,
    mimeType: 'image/png',
    sizeBytes: 10,
    createdAt
  }
}

describe('PhotoGallery', () => {
  it('shows an empty state before the first photo', () => {
    const wrapper = mount(PhotoGallery, { props: { photos: [] } })
    expect(wrapper.text()).toContain('Фото пока нет')
  })

  it('renders thumbnails through the photo protocol', () => {
    const wrapper = mount(PhotoGallery, {
      props: { photos: [entry('photo-1', '2026-10-30T09:00:00.000Z')] }
    })

    const image = wrapper.get('img')
    expect(image.attributes('src')).toBe('photo://photo-1')
    expect(image.attributes('alt')).toBe('Фото прогресса')
  })

  it('emits the id when a photo is removed', async () => {
    const wrapper = mount(PhotoGallery, {
      props: {
        photos: [
          entry('photo-1', '2026-10-30T09:00:00.000Z'),
          entry('photo-2', '2026-10-29T09:00:00.000Z')
        ]
      }
    })

    await wrapper.get('[data-photo-remove="photo-2"]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['photo-2']])
  })
})

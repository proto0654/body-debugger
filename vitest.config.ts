import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const sharedDir = fileURLToPath(new URL('./shared', import.meta.url))

/** Unit / store / component tests — see docs/TESTING.md. */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': srcDir,
      '@shared': sharedDir
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true
  }
})

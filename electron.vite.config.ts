import { execFileSync } from 'node:child_process'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/** Identifies the exact build a tester is running; git may be absent in CI checkouts. */
function resolveBuildStamp(): { commit: string; date: string } {
  let commit = 'nogit'
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    commit = 'nogit'
  }
  return { commit, date: new Date().toISOString().slice(0, 10) }
}

const buildStamp = resolveBuildStamp()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __BUILD_COMMIT__: JSON.stringify(buildStamp.commit),
      __BUILD_DATE__: JSON.stringify(buildStamp.date)
    },
    resolve: {
      alias: {
        '@shared': resolve('shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('electron/preload/index.ts'),
          lab: resolve('electron/preload/lab.ts')
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve('index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@shared': resolve('shared')
      }
    },
    plugins: [vue(), tailwindcss()]
  }
})

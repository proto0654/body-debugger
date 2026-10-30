import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { hydrateFromMain } from './bootstrap/hydrate'
import './styles/index.css'

async function boot(): Promise<void> {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  await hydrateFromMain()

  app.mount('#app')
}

void boot()

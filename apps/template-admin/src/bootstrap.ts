import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import NuxtUI from '@nuxt/ui/vue-plugin'

import './styles/main.css'

// oxlint-disable-next-line no-unused-vars
async function bootstrap(namespace: string) {
  const app = createApp(App)

  app.use(router)

  app.use(NuxtUI)

  app.mount('#app')
}

export { bootstrap }

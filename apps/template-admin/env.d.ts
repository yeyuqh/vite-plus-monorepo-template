// oxlint-disable typescript/no-empty-object-type
/// <reference types="vite-plus/client" />

import type { AdminAppConfigRaw } from '@monorepo-admin-core/types/global'

declare global {
  interface ImportMetaEnv extends AdminAppConfigRaw {}
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}

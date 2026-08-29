import type { AdminRouteMeta } from './src/route.d.ts'

import 'vue-router'

declare module 'vue-router' {
  // oxlint-disable-next-line typescript/no-empty-object-type
  interface RouteMeta extends AdminRouteMeta {}
}

export interface AdminAppConfigRaw {
  VITE_GLOB_API_URL: string
}

export interface AdminAppConfig {
  apiURL: string
}

declare global {
  interface Window {
    __ADMIN_APP_CONFIG_RAW__: AdminAppConfigRaw
  }
}

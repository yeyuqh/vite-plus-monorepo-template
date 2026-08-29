import type { AdminAppConfigRaw, AdminAppConfig } from '@monorepo-admin-core/types/global'

/** Resolves the public application configuration for the current runtime. */
export function useAdminAppConfig(env: AdminAppConfigRaw, isProd: boolean): AdminAppConfig {
  const config = isProd ? window.__ADMIN_APP_CONFIG_RAW__ : env

  const { VITE_GLOB_API_URL } = config

  const applicationConfig = {
    apiURL: VITE_GLOB_API_URL,
  }

  return applicationConfig
}

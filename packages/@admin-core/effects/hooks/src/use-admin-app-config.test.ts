import type { AdminAppConfigRaw } from '@monorepo-admin-core/types/global'

import { afterEach, describe, expect, it } from 'vite-plus/test'

import { useAdminAppConfig } from './use-admin-app-config.ts'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow)
    return
  }

  Reflect.deleteProperty(globalThis, 'window')
})

describe('useAdminAppConfig', () => {
  it('uses import.meta.env-compatible values outside production', () => {
    const env: AdminAppConfigRaw = { VITE_GLOB_API_URL: '/development-api' }

    expect(useAdminAppConfig(env, false)).toEqual({ apiURL: '/development-api' })
  })

  it('uses the injected window configuration in production', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __ADMIN_APP_CONFIG_RAW__: { VITE_GLOB_API_URL: 'https://api.example.com' },
      },
    })

    const env: AdminAppConfigRaw = { VITE_GLOB_API_URL: '/bundled-api' }

    expect(useAdminAppConfig(env, true)).toEqual({ apiURL: 'https://api.example.com' })
  })
})

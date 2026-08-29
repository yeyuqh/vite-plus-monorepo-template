import type { Plugin } from 'vite-plus'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const APP_CONFIG_FILE_NAME = '_app.config.js'
const APP_CONFIG_GLOBAL_NAME = '__ADMIN_APP_CONFIG_RAW__'
const APP_CONFIG_PREFIX = 'VITE_GLOB_'

interface InjectAppConfigPluginOptions {
  env: Record<string, string | undefined>
  isBuild: boolean
  root?: string
}

function createAppConfigSource(env: Record<string, string | undefined>) {
  const config = Object.fromEntries(Object.entries(env).filter(([key, value]) => key.startsWith(APP_CONFIG_PREFIX) && value !== undefined))
  const serializedConfig = JSON.stringify(config).replaceAll('<', '\\u003c')
  const windowVariable = `window.${APP_CONFIG_GLOBAL_NAME}`

  return `${windowVariable}=${serializedConfig};Object.freeze(${windowVariable});Object.defineProperty(window,"${APP_CONFIG_GLOBAL_NAME}",{configurable:false,writable:false});`
}

function ensureTrailingSlash(path: string) {
  return path.endsWith('/') ? path : `${path}/`
}

async function readPackageVersion(root: string) {
  try {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { version?: unknown }
    return typeof packageJson.version === 'string' ? packageJson.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Injects deployment-editable `VITE_GLOB_*` values into production builds. */
async function viteInjectAppConfigPlugin({ env, isBuild, root = process.cwd() }: InjectAppConfigPluginOptions): Promise<Plugin | undefined> {
  if (!isBuild) return

  const source = createAppConfigSource(env)
  const version = await readPackageVersion(root)
  const contentHash = createHash('sha256').update(source).digest('hex').slice(0, 8)
  let publicPath = '/'

  return {
    configResolved(config) {
      publicPath = ensureTrailingSlash(config.base)
    },
    generateBundle() {
      this.emitFile({
        fileName: APP_CONFIG_FILE_NAME,
        source,
        type: 'asset',
      })
    },
    name: 'vite:inject-app-config',
    transformIndexHtml: {
      handler(html) {
        return {
          html,
          tags: [
            {
              attrs: {
                'data-app-config': '',
                src: `${publicPath}${APP_CONFIG_FILE_NAME}?v=${version}-${contentHash}`,
              },
              injectTo: 'head-prepend',
              tag: 'script',
            },
          ],
        }
      },
      order: 'post',
    },
  }
}

export { viteInjectAppConfigPlugin }
export type { InjectAppConfigPluginOptions }

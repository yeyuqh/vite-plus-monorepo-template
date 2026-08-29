import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'

import { afterEach, describe, expect, it } from 'vite-plus/test'
import { build } from 'vite-plus'

import { viteInjectAppConfigPlugin } from './index'

const temporaryDirectories: string[] = []

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })))
})

describe('viteInjectAppConfigPlugin', () => {
  it('does nothing outside production builds', async () => {
    await expect(viteInjectAppConfigPlugin({ env: {}, isBuild: false })).resolves.toBeUndefined()
  })

  it('emits and injects an immutable public runtime configuration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vite-app-config-'))
    temporaryDirectories.push(root)

    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.2.3' }))
    await writeFile(join(root, 'index.html'), '<!doctype html><html><head></head><body><script type="module" src="/src.js"></script></body></html>')
    await writeFile(join(root, 'src.js'), 'console.log("fixture")')

    const plugin = await viteInjectAppConfigPlugin({
      env: {
        VITE_GLOB_API_URL: 'https://api.example.com',
        VITE_PRIVATE_VALUE: 'must-not-leak',
      },
      isBuild: true,
      root,
    })

    await build({
      base: '/console/',
      build: { outDir: 'dist' },
      logLevel: 'silent',
      plugins: [plugin],
      root,
    })

    const html = await readFile(join(root, 'dist/index.html'), 'utf8')
    const source = await readFile(join(root, 'dist/_app.config.js'), 'utf8')

    expect(html).toMatch(/<script data-app-config="" src="\/console\/_app\.config\.js\?v=1\.2\.3-[a-f\d]{8}"><\/script>/)
    expect(html.indexOf('data-app-config')).toBeLessThan(html.indexOf('type="module"'))
    expect(source).toContain('VITE_GLOB_API_URL')
    expect(source).not.toContain('VITE_PRIVATE_VALUE')
    expect(source).not.toContain('must-not-leak')

    const context = { window: {} as Record<string, unknown> }
    runInNewContext(source, context)

    const config = context.window.__ADMIN_APP_CONFIG_RAW__ as Record<string, unknown>
    const descriptor = Object.getOwnPropertyDescriptor(context.window, '__ADMIN_APP_CONFIG_RAW__')
    expect(config).toEqual({ VITE_GLOB_API_URL: 'https://api.example.com' })
    expect(Object.isFrozen(config)).toBe(true)
    expect(descriptor).toMatchObject({ configurable: false, writable: false })
  })
})

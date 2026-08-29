# vite-plugin-app-config

Emits deployment-editable `VITE_GLOB_*` values to `_app.config.js` and loads the file before the application entry.

```ts
import { viteInjectAppConfigPlugin } from '@monorepo/vite-plugin-app-config'

await viteInjectAppConfigPlugin({
  env,
  isBuild: command === 'build',
  root,
})
```

Development builds continue to use `import.meta.env`. Production applications read the frozen `window.__ADMIN_APP_CONFIG_RAW__` object created by the emitted script.

# Admin Hooks

Reusable hooks for Vite+ admin applications.

`useAdminAppConfig(import.meta.env, import.meta.env.PROD)` reads `VITE_GLOB_*` values from `import.meta.env` during development and from the production runtime configuration injected into `window.__ADMIN_APP_CONFIG_RAW__`.

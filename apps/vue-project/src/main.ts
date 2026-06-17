async function initApplication() {
  const namespace = '123123'

  const { bootstrap } = await import('./bootstrap')
  await bootstrap(namespace)
}

void initApplication()

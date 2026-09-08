import type { RouteRecordRaw } from 'vue-router'
import { expect, test, vi } from 'vite-plus/test'
import { mergeBackendMenusWithFileRoutes } from './merge'
import { createAdminNavigationRoutes } from './navigation'
import { collectRawRoutePaths, createAdminRoutePathMatcher, filterRawRouteRecords } from './path'
import { filterRoutesByAuthority } from './permission'
import { resolveAdminAccess } from './resolve'

const component = { template: '<div />' }
const forbiddenComponent = { template: '<div>403</div>' }
const iframeComponent = { template: '<div>iframe</div>' }
const externalLinkComponent = { template: '<div>external link</div>' }

test('merges backend menu meta onto matching file routes only', () => {
  const routes: RouteRecordRaw[] = [
    {
      component,
      path: '/dashboard',
      meta: { title: 'Old dashboard' },
      children: [{ component, path: 'workbench', meta: { title: 'Old workbench' } }],
    },
  ]
  const menus: Parameters<typeof mergeBackendMenusWithFileRoutes>[0] = [
    {
      id: 'dashboard',
      path: '/dashboard',
      meta: { group: { label: '工作台', order: 10 }, title: 'Dashboard' },
      children: [
        {
          id: 'dashboard-workbench',
          path: 'workbench',
          meta: { icon: 'i-lucide-monitor', title: '工作台' },
        },
        {
          id: 'missing',
          path: 'missing',
          meta: { title: '不存在' },
        },
      ],
    },
  ]

  const mergedRoutes = mergeBackendMenusWithFileRoutes(menus, routes)

  expect(mergedRoutes).toHaveLength(1)
  expect(mergedRoutes[0]?.meta?.title).toBe('Dashboard')
  expect(mergedRoutes[0]?.children?.map((route) => route.path)).toEqual(['workbench'])
  expect(mergedRoutes[0]?.children?.[0]?.meta?.group).toEqual({ label: '工作台', order: 10 })
})

test('promotes a deeply nested file page to an absolute top-level backend route', () => {
  const routes: RouteRecordRaw[] = [
    {
      path: '/docs',
      children: [{ component, path: 'vite-plus' }],
    },
  ]

  const mergedRoutes = mergeBackendMenusWithFileRoutes([{ id: 'docs-vite-plus', path: '/docs/vite-plus', meta: { title: 'Vite+ Docs' } }], routes)

  expect(mergedRoutes[0]?.path).toBe('/docs/vite-plus')
  expect(mergedRoutes[0]?.component).toBe(component)
})

test('creates iframe routes and their structural parent without matching file pages', () => {
  const mergedRoutes = mergeBackendMenusWithFileRoutes(
    [
      {
        id: 'embedded',
        path: '/embedded',
        meta: { group: { label: '链接', order: 40 }, title: '内嵌页面' },
        children: [
          {
            id: 'embedded-vben',
            path: 'vben',
            meta: { iframeSrc: ' https://doc.vben.pro ', title: 'Vben 文档' },
          },
        ],
      },
    ],
    [],
    { iframeComponent },
  )

  expect(mergedRoutes).toHaveLength(1)
  expect(mergedRoutes[0]?.path).toBe('/embedded')
  expect(mergedRoutes[0]?.component).toBeUndefined()
  expect(mergedRoutes[0]?.children).toHaveLength(1)
  expect(mergedRoutes[0]?.children?.[0]?.path).toBe('vben')
  expect(mergedRoutes[0]?.children?.[0]?.component).toBe(iframeComponent)
  expect(mergedRoutes[0]?.children?.[0]?.meta?.iframeSrc).toBe('https://doc.vben.pro')
  expect(mergedRoutes[0]?.children?.[0]?.meta?.group).toEqual({ label: '链接', order: 40 })
})

test('creates external-link routes without matching file pages', () => {
  const mergedRoutes = mergeBackendMenusWithFileRoutes(
    [
      {
        id: 'docs-vite-plus',
        path: '/docs/vite-plus',
        meta: { externalLink: ' https://viteplus.dev/guide/ ', title: 'Vite+ 文档' },
      },
    ],
    [],
    { externalLinkComponent },
  )

  expect(mergedRoutes).toHaveLength(1)
  expect(mergedRoutes[0]?.path).toBe('/docs/vite-plus')
  expect(mergedRoutes[0]?.component).toBe(externalLinkComponent)
  expect(mergedRoutes[0]?.meta?.externalLink).toBe('https://viteplus.dev/guide/')
})

test('keeps multi-segment backend root menus as navigation roots', () => {
  const result = resolveAdminAccess(
    [],
    [
      {
        id: 'docs-vite-plus',
        path: '/docs/vite-plus',
        meta: { externalLink: 'https://viteplus.dev/guide/', group: '链接', order: 20, title: 'Vite+ 文档' },
      },
      {
        id: 'tailwindcss-document',
        path: '/tailwindcss/document',
        meta: { externalLink: 'https://tailwindcss.com/docs', group: '链接', order: 10, title: 'Tailwind CSS 文档' },
      },
    ],
    ['admin'],
    { externalLinkComponent, forbiddenComponent },
  )

  expect(result.navigationRoutes.map((route) => route.parentPath)).toEqual([void 0, void 0])
  expect(result.menuGroups[0]?.children).toMatchObject([
    { children: undefined, id: 'tailwindcss-document', title: 'Tailwind CSS 文档' },
    { children: undefined, id: 'docs-vite-plus', title: 'Vite+ 文档' },
  ])
})

test('does not create routes for button menu nodes', () => {
  const mergedRoutes = mergeBackendMenusWithFileRoutes(
    [{ id: 'system-role-create', path: '/system/role/create', type: 'button', meta: { title: '创建角色' } }],
    [{ component, path: '/system/role/create' }],
  )

  expect(mergedRoutes).toEqual([])
})

test('applies authority filtering to generated iframe routes', () => {
  const menus: Parameters<typeof resolveAdminAccess>[1] = [
    {
      id: 'embedded-admin',
      path: '/embedded/admin',
      meta: { authority: ['admin'], iframeSrc: 'https://doc.vben.pro', title: '管理文档' },
    },
  ]
  const options = { forbiddenComponent, iframeComponent }

  expect(resolveAdminAccess([], menus, ['user'], options).routePathSet.size).toBe(0)
  expect([...resolveAdminAccess([], menus, ['admin'], options).routePathSet]).toEqual(['/embedded/admin'])
})

test('filters route trees without flattening and collects canonical paths', () => {
  const routes: RouteRecordRaw[] = [
    {
      path: '/auth',
      children: [
        { component, path: 'login', meta: { initial: true } },
        { component, path: 'register' },
      ],
    },
  ]

  const initialRoutes = filterRawRouteRecords(routes, (route) => route.meta?.initial === true)

  expect(initialRoutes).toHaveLength(1)
  expect(initialRoutes[0]?.path).toBe('/auth')
  expect(initialRoutes[0]?.children?.map((route) => route.path)).toEqual(['login'])
  expect(collectRawRoutePaths(initialRoutes)).toEqual(['/auth', '/auth/login'])
})

test('matches dynamic access paths and aliases with the Vue Router matcher', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const matchesAccessPath = createAdminRoutePathMatcher([
    {
      alias: '/members/:id',
      component,
      path: '/users/:id',
    },
  ])

  expect(matchesAccessPath('/users/42?tab=profile')).toBe(true)
  expect(matchesAccessPath('/members/42')).toBe(true)
  expect(matchesAccessPath('/users')).toBe(false)
  expect(matchesAccessPath('/unknown/42')).toBe(false)
  expect(warn).toHaveBeenCalledTimes(2)
  warn.mockRestore()
})

test('filters unauthorized routes while keeping visible forbidden menu entries', () => {
  const routes: RouteRecordRaw[] = [
    { component, path: '/dashboard', meta: { title: 'Dashboard' } },
    { component, path: '/system/role', meta: { authority: ['admin'], title: '角色管理' } },
    { component, path: '/access/menu-visible-403', meta: { authority: ['admin'], menuVisibleWithForbidden: true, title: '可见但无权限' } },
  ]

  const filteredRoutes = filterRoutesByAuthority(routes, ['user'], forbiddenComponent)

  expect(filteredRoutes.map((route) => route.path)).toEqual(['/dashboard', '/access/menu-visible-403'])
  expect(filteredRoutes[1]?.component).toBe(forbiddenComponent)
})

test('creates default canonical navigation fields from route paths and sources', () => {
  const navigationRoutes = createAdminNavigationRoutes([
    {
      component,
      path: '/dashboard',
      meta: { source: 'access', title: 'Dashboard' },
      children: [
        {
          component,
          path: 'workbench',
          meta: { source: 'access', title: '工作台' },
        },
      ],
    },
  ])

  expect(navigationRoutes).toEqual([
    {
      activePath: '/dashboard',
      meta: { source: 'access', title: 'Dashboard' },
      parentPath: void 0,
      path: '/dashboard',
      source: 'access',
      tabPath: '/dashboard',
    },
    {
      activePath: '/dashboard/workbench',
      meta: { source: 'access', title: '工作台' },
      parentPath: '/dashboard',
      path: '/dashboard/workbench',
      source: 'access',
      tabPath: '/dashboard/workbench',
    },
  ])
})

test('derives canonical active and tab paths independently from route meta', () => {
  const navigationRoutes = createAdminNavigationRoutes([
    {
      component,
      path: '/system',
      meta: { group: { label: '系统管理', order: 30 }, title: '系统' },
      children: [
        {
          component,
          path: 'settings/theme',
          meta: {
            activePath: '/system/settings',
            hideInMenu: true,
            tabPath: '/system/settings',
            title: '主题设置',
          },
        },
      ],
    },
  ])

  expect(navigationRoutes).toEqual([
    {
      activePath: '/system',
      meta: { group: { label: '系统管理', order: 30 }, title: '系统' },
      parentPath: void 0,
      path: '/system',
      source: void 0,
      tabPath: '/system',
    },
    {
      activePath: '/system/settings',
      meta: {
        activePath: '/system/settings',
        hideInMenu: true,
        tabPath: '/system/settings',
        title: '主题设置',
      },
      parentPath: '/system',
      path: '/system/settings/theme',
      source: void 0,
      tabPath: '/system/settings',
    },
  ])
})

test('resolves accessible routes menus and route paths with injected forbidden component', () => {
  const result = resolveAdminAccess(
    [
      { component, path: '/dashboard', meta: { title: 'Dashboard' } },
      { component, path: '/access', children: [{ component, path: 'menu-visible-403' }] },
      { component, path: '/system', children: [{ component, path: 'role' }] },
    ],
    [
      {
        id: 'dashboard',
        path: '/dashboard',
        meta: { group: { label: '工作台', order: 10 }, title: 'Dashboard' },
      },
      {
        id: 'access',
        path: '/access',
        meta: { group: { label: '工作台', order: 10 }, title: '权限演示' },
        children: [
          {
            id: 'access-menu-visible-403',
            path: 'menu-visible-403',
            meta: { authority: ['admin'], menuVisibleWithForbidden: true, title: '可见但无权限' },
          },
        ],
      },
      {
        id: 'system',
        path: '/system',
        meta: { authority: ['admin'], title: '系统' },
        children: [
          {
            id: 'system-role',
            path: 'role',
            meta: { authority: ['admin'], title: '角色管理' },
          },
        ],
      },
    ],
    ['user'],
    { forbiddenComponent },
  )

  const accessRoute = result.accessibleRoutes.find((route) => route.path === '/access')
  const forbiddenRoute = accessRoute?.children?.find((route) => route.path === 'menu-visible-403')

  expect([...result.routePathSet]).toEqual(['/dashboard', '/access', '/access/menu-visible-403'])
  expect(result.menuGroups.flatMap((group) => group.children).map((item) => item.path)).toEqual(['/dashboard', '/access'])
  expect(forbiddenRoute?.component).toBe(forbiddenComponent)
})

test('prunes structural directory ancestors after their last child loses authority', () => {
  const result = resolveAdminAccess(
    [],
    [
      {
        id: 'root',
        type: 'directory',
        path: '/root',
        meta: { title: 'Root' },
        children: [
          {
            id: 'nested',
            type: 'directory',
            path: 'nested',
            meta: { title: 'Nested' },
            children: [{ id: 'restricted', path: 'page', meta: { title: 'Restricted', authority: ['admin'], iframeSrc: 'https://example.com' } }],
          },
        ],
      },
    ],
    ['user'],
    { forbiddenComponent, iframeComponent },
  )

  expect(result.accessibleRoutes).toEqual([])
  expect(result.navigationRoutes).toEqual([])
  expect(result.menuGroups).toEqual([])
  expect(result.routePathSet.size).toBe(0)
})

test('removes empty menu directories while keeping their hidden pages accessible', () => {
  const result = resolveAdminAccess(
    [],
    [
      {
        id: 'root',
        type: 'directory',
        path: '/root',
        meta: { title: 'Root' },
        children: [{ id: 'hidden', path: 'page', meta: { title: 'Hidden', hideInMenu: true, iframeSrc: 'https://example.com' } }],
      },
    ],
    ['user'],
    { forbiddenComponent, iframeComponent },
  )

  expect(result.menuGroups).toEqual([])
  expect(createAdminRoutePathMatcher(result.accessibleRoutes)('/root/page')).toBe(true)
  expect(result.navigationRoutes.find((route) => route.path === '/root/page')?.meta.iframeSrc).toBe('https://example.com')
})

test('retains a real page after all of its children are filtered out', () => {
  const result = resolveAdminAccess(
    [{ path: '/page', component }],
    [
      {
        id: 'page',
        type: 'menu',
        path: '/page',
        meta: { title: 'Page' },
        children: [{ id: 'restricted', path: 'child', meta: { title: 'Restricted', authority: ['admin'], iframeSrc: 'https://example.com' } }],
      },
    ],
    ['user'],
    { forbiddenComponent, iframeComponent },
  )

  expect(result.accessibleRoutes[0]?.component).toBe(component)
  expect(result.menuGroups[0]?.children).toMatchObject([{ id: 'page', path: '/page', children: undefined }])
})

test('inherits groups through hidden ancestors and retains explicit child group overrides', () => {
  const result = resolveAdminAccess(
    [],
    [
      {
        id: 'root',
        path: '/root',
        meta: { title: 'Root', group: { id: 'main', label: 'Main', order: 10 } },
        children: [
          { id: 'hidden', path: 'hidden', meta: { title: 'Hidden', hideInMenu: true }, children: [{ id: 'nested', path: 'nested', meta: { title: 'Nested', iframeSrc: 'https://example.com' } }] },
          { id: 'link', path: 'link', meta: { title: 'Link', group: { id: 'links', label: 'Links', order: 20 }, externalLink: 'https://example.com' } },
        ],
      },
    ],
    ['user'],
    { forbiddenComponent, iframeComponent, externalLinkComponent },
  )

  expect(result.menuGroups.map(({ id }) => id)).toEqual(['main', 'links'])
  expect(result.menuGroups[0]?.children).toMatchObject([{ id: 'nested', path: '/root/hidden/nested', children: undefined }])
  expect(result.menuGroups[1]?.children).toMatchObject([{ id: 'link', externalLink: 'https://example.com' }])
  expect(result.navigationRoutes.find((route) => route.path === '/root/hidden/nested')).toMatchObject({
    parentPath: '/root/hidden',
    meta: { group: { id: 'main', label: 'Main', order: 10 }, menuId: 'nested', menuType: 'menu' },
  })
})

test('keeps a visible forbidden directory as an actual 403 page after filtering its children', () => {
  const result = resolveAdminAccess(
    [],
    [
      {
        id: 'root',
        type: 'directory',
        path: '/root',
        meta: { title: 'Root', authority: ['admin'], menuVisibleWithForbidden: true },
        children: [{ id: 'restricted', path: 'child', meta: { title: 'Restricted', authority: ['admin'], iframeSrc: 'https://example.com' } }],
      },
    ],
    ['user'],
    { forbiddenComponent, iframeComponent },
  )

  expect(result.accessibleRoutes[0]?.component).toBe(forbiddenComponent)
  expect(result.menuGroups[0]?.children).toMatchObject([{ id: 'root', path: '/root', children: undefined }])
})

test.each([
  { label: 'page component', routes: [{ path: '/root', component }], meta: { title: 'Root' } },
  { label: 'redirect', routes: [{ path: '/root', redirect: '/target' }], meta: { title: 'Root' } },
  { label: 'iframe', routes: [], meta: { title: 'Root', iframeSrc: 'https://example.com' } },
  { label: 'external link', routes: [], meta: { title: 'Root', externalLink: 'https://example.com' } },
])('preserves a directory with a $label when no children remain', ({ routes, meta }) => {
  const result = resolveAdminAccess(routes, [{ id: 'root', type: 'directory', path: '/root', meta }], ['user'], { forbiddenComponent, iframeComponent, externalLinkComponent })
  expect(result.routePathSet.has('/root')).toBe(true)
  expect(result.menuGroups[0]?.children).toHaveLength(1)
})

test('preserves the parent path argument when deriving navigation records for a subtree', () => {
  const records = createAdminNavigationRoutes([{ path: 'child', component }], '/parent')
  expect(records[0]).toMatchObject({ path: '/parent/child', parentPath: '/parent' })
})

test('keeps a directory page in the menu when all of its children are hidden', () => {
  const result = resolveAdminAccess(
    [{ path: '/root', component }],
    [
      {
        id: 'root',
        type: 'directory',
        path: '/root',
        meta: { title: 'Root' },
        children: [{ id: 'hidden', path: 'hidden', meta: { title: 'Hidden', hideInMenu: true, iframeSrc: 'https://example.com' } }],
      },
    ],
    ['user'],
    { forbiddenComponent, iframeComponent },
  )
  expect(result.menuGroups[0]?.children).toMatchObject([{ id: 'root', children: undefined }])
  expect(result.routePathSet.has('/root/hidden')).toBe(true)
})

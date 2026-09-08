import type { AdminNavigationRouteNode, AdminRouteMeta } from '@monorepo-admin-core/types'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { buildAdminMenuGroups, buildAdminMenus, markActiveAdminMenuGroups, markActiveAdminMenus } from './route-menu'

function page(path: string, meta: AdminRouteMeta = {}, children?: AdminNavigationRouteNode[]): AdminNavigationRouteNode {
  return { id: path, type: 'menu', navigable: true, path, meta: { title: path, ...meta }, children }
}

function deepTree() {
  return [
    page('/one', { icon: 'i-lucide-one' }, [
      page('/one/two', { icon: 'i-lucide-two' }, [
        page('/one/two/three', { icon: 'i-lucide-three' }, [
          page('/one/two/three/four', { order: 10 }),
          page('/one/two/three/five/six', { order: 20 }),
          page('/one/two/three/hidden', { hideInMenu: true }),
        ]),
      ]),
    ]),
  ]
}

afterEach(() => vi.restoreAllMocks())

test('builds sorted trees and derives missing parent order from visible children', () => {
  const tree = [
    page('/system', { title: 'System' }, [page('/system/role', { title: '角色管理', order: 20 }), page('/system/user', { title: '用户管理', order: 10 })]),
    page('/dashboard', { title: 'Dashboard', order: 5 }),
    page('/hidden/audit', { hideInMenu: true, order: 1 }),
  ]
  const before = structuredClone(tree)
  const menus = buildAdminMenus(tree)

  expect(menus.map(({ id, order }) => ({ id, order }))).toEqual([
    { id: '/dashboard', order: 5 },
    { id: '/system', order: 10 },
  ])
  expect(menus[1]?.children?.map(({ id }) => id)).toEqual(['/system/user', '/system/role'])
  expect(tree).toEqual(before)
})

test('preserves path order for equal titles and weights even when backend ids sort differently', () => {
  const menus = buildAdminMenus([{ ...page('/first', { title: 'Same' }), id: 'b' }, { ...page('/second', { title: 'Same' }), id: 'a' }, page('/third', { title: 'Alpha' })])
  expect(menus.map(({ id }) => id)).toEqual(['/third', 'b', 'a'])
})

test('preserves backend ids and keeps a multi-segment external link at the root', () => {
  const menus = buildAdminMenus([
    {
      ...page('/external/docs', { authority: ['admin'], externalLink: 'https://viteplus.dev/guide/', icon: 'i-lucide-book-open', title: 'Docs' }),
      id: 'documentation',
    },
  ])
  expect(menus).toHaveLength(1)
  expect(menus[0]).toMatchObject({
    id: 'documentation',
    path: 'https://viteplus.dev/guide/',
    activePath: '/external/docs',
    authority: ['admin'],
    icon: 'i-lucide-book-open',
    title: 'Docs',
    children: undefined,
  })
})

test('keeps three levels and preserves icons for the renderer to control their visibility', () => {
  const menus = buildAdminMenus([page('/one', {}, [page('/one/two', {}, [page('/one/two/three', { icon: 'i-lucide-three' })])])])
  expect(menus[0]?.children?.[0]?.children?.[0]).toMatchObject({ id: '/one/two/three', icon: 'i-lucide-three', children: undefined })
})

test('promotes every visible deep page to the third level and warns', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const menus = buildAdminMenus(deepTree())
  expect(menus[0]?.children?.[0]?.children?.map(({ id, children }) => ({ id, children }))).toEqual([
    { id: '/one/two/three', children: undefined },
    { id: '/one/two/three/four', children: undefined },
    { id: '/one/two/three/five/six', children: undefined },
  ])
  expect(warn).toHaveBeenCalledTimes(2)
  expect(warn).toHaveBeenNthCalledWith(1, expect.stringContaining('/one/two/three/four'))
  expect(warn).toHaveBeenNthCalledWith(2, expect.stringContaining('/one/two/three/five/six'))
})

test('clamps the maximum depth to three', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  expect(buildAdminMenus(deepTree(), { maxDepth: 4 })).toEqual(buildAdminMenus(deepTree()))
})

test('supports a single-level menu without losing deep pages', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const menus = buildAdminMenus(deepTree(), { maxDepth: 1 })
  expect(menus).toHaveLength(5)
  expect(menus.every((item) => !item.children)).toBe(true)
})

test('promotes deep pages past the depth limit without leaving an empty directory link', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const menus = buildAdminMenus([page('/one', {}, [page('/one/two', {}, [{ ...page('/one/two/three', {}, [page('/one/two/three/four')]), type: 'directory', navigable: false }])])])
  expect(menus[0]?.children?.[0]?.children).toMatchObject([{ id: '/one/two/three/four', children: undefined }])
  expect(menus[0]?.children?.[0]?.children).toHaveLength(1)
})

test('sorts explicit groups before the unlabeled default group', () => {
  const groups = buildAdminMenuGroups([
    page('/ungrouped', { order: -10 }),
    page('/last-group', { group: { id: 'last', label: 'Last', order: 999 } }),
    page('/first-group', { group: { label: 'First', order: 10 } }),
  ])
  expect(groups.map(({ id }) => id)).toEqual(['group:First', 'last', 'default'])
  expect(groups[2]).toMatchObject({ label: undefined, children: [{ id: '/ungrouped' }] })
})

test('keeps the resolved group on every level of a menu tree', () => {
  const group = { id: 'operations', label: '运维', order: 10 }
  const groups = buildAdminMenuGroups([page('/monitor', { group }, [page('/monitor/jobs', { group }, [page('/monitor/jobs/history', { group })])])])
  expect(groups).toHaveLength(1)
  expect(groups[0]).toMatchObject({ id: 'operations', label: '运维', order: 10 })
  expect(groups[0]?.children[0]?.children?.[0]?.children?.[0]?.id).toBe('/monitor/jobs/history')
})

test('moves an explicit child group to its own root and drops the emptied directory', () => {
  const groups = buildAdminMenuGroups([
    {
      ...page('/parent', { group: 'A' }, [page('/parent/child', { group: 'B' })]),
      type: 'directory',
      navigable: false,
    },
  ])
  expect(groups).toHaveLength(1)
  expect(groups[0]).toMatchObject({ id: 'group:B', children: [{ id: '/parent/child', children: undefined }] })
})

test('applies a custom default group and can build ungrouped menus from the same tree', () => {
  const routes = [page('/parent', { group: 'A' }, [page('/parent/child', { group: 'B' })]), page('/default')]
  const groups = buildAdminMenuGroups(routes, { defaultGroup: { id: 'misc', label: '其他', order: -100 } })
  expect(groups.at(-1)).toMatchObject({ id: 'misc', label: '其他' })
  expect(buildAdminMenus(routes).find((item) => item.id === '/parent')?.children?.[0]?.id).toBe('/parent/child')
})

test('omits empty directories and keeps page nodes whose children are hidden', () => {
  const menus = buildAdminMenus([
    { ...page('/empty'), type: 'directory', navigable: false },
    { ...page('/directory', {}, [page('/directory/hidden', { hideInMenu: true })]), type: 'directory', navigable: false },
    page('/page', {}, [page('/page/hidden', { hideInMenu: true })]),
  ])
  expect(menus.map(({ id }) => id)).toEqual(['/page'])
})

test('promotes children of hidden nodes without inferring parents from the URL', () => {
  const menus = buildAdminMenus([page('/root', {}, [page('/root/hidden', { hideInMenu: true }, [page('/root/hidden/visible')])])])
  expect(menus.map(({ id }) => id)).toEqual(['/root', '/root/hidden/visible'])
  expect(menus.every((item) => !item.children)).toBe(true)
})

test('does not expose dynamic, catch-all, root or untitled routes as menus', () => {
  const routes = [page('/'), page('/users/:id'), page('/files/*'), page('/files/(.*)'), page('/untitled', { title: '' }), page('/visible')]
  expect(buildAdminMenus(routes).map(({ id }) => id)).toEqual(['/visible'])
})

test('marks only the exact menu and its real ancestors, even when URLs do not reflect the tree', () => {
  const menus = buildAdminMenus([page('/reports'), page('/catalog', {}, [page('/reports/sales')])])
  const marked = markActiveAdminMenus(menus, '/reports/sales?range=month#chart')
  expect(marked.find((item) => item.id === '/reports')?.active).toBe(false)
  expect(marked.find((item) => item.id === '/catalog')?.active).toBe(true)
  expect(marked.find((item) => item.id === '/catalog')?.children?.[0]?.active).toBe(true)
  expect(menus.every((item) => item.active === undefined)).toBe(true)
})

test('does not activate a visible detail entry merely because it points to another active menu', () => {
  const menus = buildAdminMenus([page('/list'), { ...page('/detail', { activePath: '/list' }), activePath: '/list' }])
  expect(
    markActiveAdminMenus(menus, '/list')
      .filter((item) => item.active)
      .map(({ id }) => id),
  ).toEqual(['/list'])
})

test('marks all three levels in a group without mutating its state', () => {
  const groups = buildAdminMenuGroups([page('/one', {}, [page('/one/two', {}, [page('/one/two/three')])])])
  const before = structuredClone(groups)
  const marked = markActiveAdminMenuGroups(groups, '/one/two/three')
  expect(marked[0]?.children[0]?.active).toBe(true)
  expect(marked[0]?.children[0]?.children?.[0]?.active).toBe(true)
  expect(marked[0]?.children[0]?.children?.[0]?.children?.[0]?.active).toBe(true)
  expect(groups).toEqual(before)
})

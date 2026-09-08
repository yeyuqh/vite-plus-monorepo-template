# Admin Access Effect

Route access helpers for Vite+ admin templates.

## 菜单与路由的数据流

应用通过 `resolveAdminAccess(fileRoutes, backendMenus, roles, options)` 初始化访问数据：

1. `mergeBackendMenusWithFileRoutes` 按完整路径匹配页面组件，继承后端分组，并在路由 meta 中保留 `menuId`、`menuType`。
2. `filterRoutesByAuthority` 过滤权限、替换可见的 403 入口，并裁剪失去全部子路由且没有页面或跳转目标的目录。
3. `createAdminNavigationTree` 保留 `children`，统一生成完整路径、激活路径、标签页路径和稳定菜单 ID。
4. 导航树直接传给 `buildAdminMenuGroups`；`flattenAdminNavigationTree` 单独派生面包屑等功能需要的查询记录。

`AdminLayout` 接收解析结果中的 `menuGroups` 和 `navigationRoutes`（通过 `routeRecords` prop），负责当前菜单高亮和渲染。

## 导航约定

- `buildAdminMenus` 和 `buildAdminMenuGroups` 接收 `AdminNavigationRouteNode[]` 树，分组已由路由合并阶段继承。
- 菜单 `id` 使用后端 ID；`path` 用于跳转，菜单的 `activePath` 是自身的完整路由路径。
- 详情页通过当前路由的 `meta.activePath` 指定要高亮的菜单；祖先高亮沿菜单树传播。
- 菜单最多展示三级。更深的页面提升到第三级，无页面或跳转目标的空目录被移除；这些展示规则不改变授权路由树。
- 节点身份与排序独立：权重、标题相同时，继续按路由路径排序。
- `hideInMenu` 仅影响导航展示，隐藏页面仍可访问。图标的层级显示规则由菜单组件负责。

## Tab 标识与打开数量

Tab 标识规则为：`query.pageKey` 优先；否则 `meta.fullPathKey: false` 使用路径，默认使用包含 query/hash 的完整 URL。标识会尝试 URI 解码，实际跳转地址保持原样。

```ts
{
  name: 'UserDetail',
  path: '/system/user/:id',
  meta: {
    title: '用户详情',
    hideInMenu: true,
    activePath: '/system/user',
    fullPathKey: false,
    maxNumOfOpenTab: 3,
  },
}
```

- 不同路径 ID 默认分别打开 Tab；`fullPathKey: false` 只忽略 query 和 hash。
- `/system/user/1?pageKey=user-detail` 与 `/system/user/2?pageKey=user-detail` 共用一个 Tab，保留最后访问的地址和标题。重复的 `pageKey` 查询参数取第一个。
- `maxNumOfOpenTab` 为正数时按路由 `name` 限制数量，超出后移除最早打开的同名 Tab；请为需要限额的路由设置唯一名称。值为 1 表示淘汰旧 Tab 后新建，复用应使用相同的 `pageKey`。
- 被淘汰 Tab 的缓存、刷新版本和滚动位置会一起清理。恢复标签时根据最新权限路由重新解析实际地址，并重新应用数量限制。
- 已有 `tabPath` 配置继续兼容。显式设置 `pageKey` 或 `fullPathKey` 后，新规则优先，标题来自当前详情路由；`activePath` 只控制菜单高亮。

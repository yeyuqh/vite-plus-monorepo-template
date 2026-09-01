<script setup lang="ts">
import { Layout } from '@monorepo-admin-core/layout-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AdminRouteContent } from './basic/content'
import { LayoutHeader } from './basic/header'
import { LayoutTabbar } from './basic/tabbar'
import { LayoutMenu } from './basic/menu'
import { buildAdminBreadcrumbPrefix, buildAdminBreadcrumbs } from './navigation/route-breadcrumb'
import type { AdminCurrentRouteRecord } from './navigation/route-breadcrumb'
import { buildAdminMenuGroups, markActiveAdminMenuGroups } from './navigation/route-menu'
import type { AdminMenuGroup, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'

const props = defineProps<{
  menuGroups?: AdminMenuGroup[]
  routeRecords?: AdminNavigationRouteRecord[]
  tabStorageKey?: string
}>()

const router = useRouter()
const route = useRoute()
const adminRoute = route as unknown as AdminCurrentRouteRecord

// 把路由表和当前激活路径统一收口 避免模板层再次拼接路由语义
const routeRecords = computed<AdminNavigationRouteRecord[]>(() => props.routeRecords ?? (router.getRoutes() as unknown as AdminNavigationRouteRecord[]))
const activeMenuPath = computed(() => (route.meta as AdminRouteMeta).activePath ?? route.path)
const breadcrumbPrefix = computed(() => buildAdminBreadcrumbPrefix(adminRoute))
const breadcrumbs = computed(() => buildAdminBreadcrumbs(adminRoute, routeRecords.value))
const menuGroups = computed(() => markActiveAdminMenuGroups(props.menuGroups ?? buildAdminMenuGroups(routeRecords.value), activeMenuPath.value))
</script>

<template>
  <Layout :tabbar-enable="true">
    <slot>
      <AdminRouteContent />
    </slot>

    <template #header="{ sidebarOpen, toggleSidebar }">
      <LayoutHeader :breadcrumb-prefix="breadcrumbPrefix" :breadcrumbs="breadcrumbs">
        <template #toggle="slotProps">
          <slot v-if="$slots['header-toggle']" name="header-toggle" v-bind="{ ...slotProps, sidebarOpen, toggleSidebar }" />
          <UButton
            v-else
            data-sidebar-toggle
            :icon="sidebarOpen ? 'i-lucide-x' : 'i-lucide-menu'"
            :aria-label="sidebarOpen ? '隐藏边栏' : '显示边栏'"
            :aria-expanded="sidebarOpen"
            title="显示或隐藏边栏"
            color="neutral"
            variant="ghost"
            :ui="{ leadingIcon: 'size-5' }"
            class="md:hidden"
            @click="toggleSidebar"
          />
        </template>

        <template v-if="$slots['header-left']" #left="slotProps">
          <slot name="header-left" v-bind="slotProps" />
        </template>

        <template v-if="$slots['header-right']" #right="slotProps">
          <slot name="header-right" v-bind="slotProps" />
        </template>
      </LayoutHeader>
    </template>

    <template #menu="{ collapsed, opened, setOverlayOpen }">
      <slot name="sidebar-top" :collapsed="collapsed" :opened="opened" :set-overlay-open="setOverlayOpen" />
      <LayoutMenu :collapsed="collapsed" :groups="menuGroups" :opened="opened" />
    </template>

    <template #footer="{ collapsed, opened, setOverlayOpen }">
      <slot name="footer" :collapsed="collapsed" :opened="opened" :set-overlay-open="setOverlayOpen" />
    </template>

    <template #tabbar>
      <LayoutTabbar :storage-key="tabStorageKey" />
    </template>
  </Layout>
</template>

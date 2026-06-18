<script setup lang="ts"></script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar resizable />

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar>
          <template #title>
            <div>DashboardNavbar</div>
          </template>
        </UDashboardNavbar>

        <UDashboardToolbar>
          <div>DashboardToolbar</div>
        </UDashboardToolbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>

<script setup lang="ts">
const props = defineProps<{ title: string }>();

const links = [
  ["/admin", "群组配置"],
  ["/admin/appointments", "任职管理"],
  ["/admin/administrators", "系统管理权限"],
  ["/admin/handover", "换届"],
  ["/admin/settings", "站点设置"],
] as const;

useHead({ title: () => props.title });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader class="admin-heading">
      <template #title>
        <h1>{{ props.title }}</h1>
      </template>
      <template #extra>
        <NButton href="/admin/keycloak" tag="a" target="_blank">
          Keycloak 管理
        </NButton>
      </template>
    </NPageHeader>
    <NavTabs :links />
    <slot />
  </NuxtLayout>
</template>

<style scoped>
.admin-heading :deep(.n-page-header) {
  flex-wrap: wrap;
  gap: 12px;
}

.admin-heading :deep(.n-page-header__main) {
  min-width: 0;
  max-width: 100%;
}

.admin-heading :deep(.n-page-header__title) {
  min-width: 0;
  margin-right: 0;
  overflow-wrap: anywhere;
}
</style>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{ title: string; back?: RouteLocationRaw }>();

const route = useRoute();
const links = [
  ["/admin", "群组配置"],
  ["/admin/users", "用户目录"],
  ["/admin/appointments", "任职管理"],
  ["/admin/administrators", "系统管理权限"],
  ["/admin/handover", "换届"],
  ["/admin/settings", "站点设置"],
] as const;
const active = computed(() =>
  route.path.startsWith("/admin/users") ? "/admin/users" : route.path,
);

function navigate(to: string) {
  if (to === "/admin/users" && active.value === to) {
    return navigateTo({ path: to, query: route.query });
  }

  return navigateTo(to);
}

useHead({ title: () => props.title });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader
      class="admin-heading"
      :on-back="props.back ? () => navigateTo(props.back) : undefined"
    >
      <template #title>
        <h1>{{ props.title }}</h1>
      </template>
      <template #extra>
        <NButton href="/admin/keycloak" tag="a" target="_blank">
          Keycloak 管理
        </NButton>
      </template>
    </NPageHeader>
    <NTabs type="line" :value="active">
      <NTab
        v-for="[to, label] in links"
        :key="to"
        :name="to"
        @click="navigate(to)"
      >
        {{ label }}
      </NTab>
    </NTabs>
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

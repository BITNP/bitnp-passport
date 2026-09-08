<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{ title: string; back?: RouteLocationRaw }>();

const route = useRoute();
const links = [
  ["/admin", "群组配置"],
  ["/admin/users", "用户目录"],
  ["/admin/administrators", "管理员"],
  ["/admin/terms", "任期配置"],
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

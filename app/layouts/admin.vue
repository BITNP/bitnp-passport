<script setup lang="ts">
defineProps<{ title: string }>();

const links = [
  ["/admin", "群组配置"],
  ["/admin/appointments", "任职管理"],
  ["/admin/administrators", "系统管理权限"],
  ["/admin/handover", "换届"],
  ["/admin/settings", "站点设置"],
] as const;
</script>

<template>
  <NuxtLayout :links name="section" :title>
    <template #extra>
      <NButton href="/admin/keycloak" tag="a" target="_blank">
        Keycloak 管理
      </NButton>
    </template>
    <slot />
  </NuxtLayout>
</template>

<script setup lang="ts">
const props = defineProps<{ title: string }>();

const links = [
  ["/account", "个人资料"],
  ["/account/security", "账户安全"],
  ["/account/sessions", "登录设备"],
] as const;

useHead({ title: () => props.title });
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader>
      <template #title>
        <h1>{{ props.title }}</h1>
      </template>
    </NPageHeader>
    <NavTabs :links />

    <slot />
  </NuxtLayout>
</template>

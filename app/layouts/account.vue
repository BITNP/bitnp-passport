<script setup lang="ts">
defineProps<{ title: string }>();

const links = [
  ["/account", "个人资料"],
  ["/account/security", "账户安全"],
  ["/account/sessions", "登录设备"],
] as const;
</script>

<template>
  <NuxtLayout :links name="section" :title>
    <slot />
  </NuxtLayout>
</template>

<script setup lang="ts">
const links = [
  ["/account", "账户概览"],
  ["/account/profile", "个人资料"],
  ["/account/security", "账户安全"],
  ["/account/sessions", "登录设备"],
] as const;
</script>

<template>
  <UiTabs label="账户设置">
    <NuxtLink v-for="[to, label] in links" :key="to" :to>{{ label }}</NuxtLink>
  </UiTabs>
</template>

<script setup lang="ts">
const links = [
  ["/manage", "成员目录"],
  ["/groups", "我管理的群组"],
  ["/jobs", "任务"],
  ["/audit", "操作记录"],
] as const;
</script>

<template>
  <NuxtLayout name="page">
    <NavTabs :links />
    <slot />
  </NuxtLayout>
</template>

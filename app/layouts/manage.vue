<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineProps<{ title: string; back?: RouteLocationRaw }>();

const links = [
  ["/manage", "成员目录"],
  ["/groups", "我管理的群组"],
  ["/jobs", "任务"],
  ["/audit", "操作记录"],
] as const;
</script>

<template>
  <NuxtLayout :back :links name="section" :title>
    <template v-if="$slots.extra" #extra>
      <slot name="extra" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
    <slot />
  </NuxtLayout>
</template>

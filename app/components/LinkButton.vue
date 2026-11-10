<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineOptions({ inheritAttrs: false });

defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <NuxtLink :to>
    <NButton v-bind="$attrs" tag="span">
      <slot />
    </NButton>
  </NuxtLink>
</template>

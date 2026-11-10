<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineOptions({ inheritAttrs: false });

defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <NuxtLink v-slot="{ href, navigate }" custom :to>
    <NButton v-bind="$attrs" :href tag="a" @click="navigate">
      <slot />
    </NButton>
  </NuxtLink>
</template>

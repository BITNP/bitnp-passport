<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{ to: string }>();
</script>

<template>
  <NuxtLink :to>
    <NButton v-bind="$attrs" tag="span">
      <slot />
    </NButton>
  </NuxtLink>
</template>

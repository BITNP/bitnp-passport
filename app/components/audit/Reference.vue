<script setup lang="ts">
const { reference, fallback = "—" } = defineProps<{
  reference: { label: string | null; to: string | null } | null;
  fallback?: string;
}>();
</script>

<template>
  <NuxtLink v-if="reference?.to" :to="reference.to">
    {{ reference.label ?? fallback }}
  </NuxtLink>
  <template v-else>{{ reference?.label ?? fallback }}</template>
</template>

<script setup lang="ts">
const { groups } = defineProps<{
  groups: { groupId: string; label: string; path?: string }[];
}>();

const options = computed(() =>
  groups.map((group) => ({
    value: group.groupId,
    label: group.path ? `${group.label} · ${group.path}` : group.label,
  })),
);
</script>

<template>
  <NSelect filterable :options placeholder="选择群组" />
</template>

<script setup lang="ts">
const { groups } = defineProps<{
  groups: { groupId: string; label: string; path?: string }[];
}>();
const value = defineModel<string | null>("value", { default: null });

const options = computed(() =>
  groups.map((group) => ({
    value: group.groupId,
    label: group.path ? `${group.label}（${group.path}）` : group.label,
  })),
);
</script>

<template>
  <NSelect v-model:value="value" filterable :options placeholder="选择群组" />
</template>

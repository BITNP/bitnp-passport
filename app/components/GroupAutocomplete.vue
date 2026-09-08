<script setup lang="ts">
const emit = defineEmits<{ select: [groupId: string] }>();

const { groups } = defineProps<{
  groups: { groupId: string; label: string; path?: string; note?: string }[];
}>();

const value = defineModel<string>("value", { required: true });

const options = computed(() => {
  const query = value.value.trim().toLocaleLowerCase();

  return groups
    .filter((group) =>
      [group.label, group.path, group.note].some((text) =>
        text?.toLocaleLowerCase().includes(query),
      ),
    )
    .map((group) => ({
      value: group.groupId,
      label: group.label,
      description: group.path ? `${group.label} · ${group.path}` : group.label,
    }));
});

type GroupOption = (typeof options.value)[number];
</script>

<template>
  <NAutoComplete
    clearable
    :options
    placeholder="搜索群组"
    :render-label="(option: GroupOption) => option.description"
    :value
    @select="emit('select', $event)"
    @update:value="value = $event ?? ''"
  />
</template>

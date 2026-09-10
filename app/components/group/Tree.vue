<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { flattenGroups } from "~/utils/groupDirectory";

const emit = defineEmits<{ select: [id: string]; create: [] }>();
const { tree, groups, selectedId } = defineProps<{
  tree: InternalApi["/api/admin/groups"]["get"]["groups"];
  groups: ReturnType<typeof flattenGroups>;
  selectedId?: string;
  disabled: boolean;
  loading: boolean;
}>();
const search = defineModel<string>("search", { required: true });
const expanded = ref<(string | number)[]>([]);
const nodes = computed(
  () => new Map(groups.map((group) => [group.groupId, group])),
);

watch(
  () => [nodes.value, selectedId] as const,
  ([nodes, id]) => {
    const group = id ? nodes.get(id) : undefined;
    if (group) {
      expanded.value = [...new Set([...expanded.value, ...group.ancestors])];
    }
  },
  { immediate: true },
);

function matchesGroup(pattern: string, id: string) {
  const group = nodes.value.get(id)!;
  const query = pattern.trim().toLocaleLowerCase();

  return [group.path, group.label].some((value) =>
    value.toLocaleLowerCase().includes(query),
  );
}
</script>

<template>
  <NCard size="small" title="全部群组">
    <template #header-extra>
      <NButton :disabled size="small" @click="emit('create')">新建群组</NButton>
    </template>
    <NFlex :size="16" vertical>
      <GroupAutocomplete
        v-model:value="search"
        :disabled
        :groups
        @select="emit('select', $event)"
      />
      <NSpin :show="loading">
        <NScrollbar class="group-tree">
          <NTree
            v-if="tree.length > 0"
            v-model:expanded-keys="expanded"
            block-line
            :cancelable="false"
            :data="tree"
            :disabled
            :filter="(pattern, node) => matchesGroup(pattern, String(node.id))"
            key-field="id"
            label-field="name"
            :pattern="search"
            :render-label="({ option }) => nodes.get(String(option.id))!.label"
            :selected-keys="selectedId ? [selectedId] : []"
            show-line
            @update:selected-keys="emit('select', String($event[0]))"
          />
          <NEmpty v-else description="暂无群组" />
        </NScrollbar>
      </NSpin>
    </NFlex>
  </NCard>
</template>

<style scoped>
.group-tree {
  max-height: 65vh;
}

@media (max-width: 1023px) {
  .group-tree {
    max-height: 35vh;
  }
}
</style>

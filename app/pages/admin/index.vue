<script setup lang="ts">
import { flattenGroups } from "~/utils/groupDirectory";

definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();
const {
  data: directory,
  error,
  refresh,
  status,
} = await useFetch("/api/admin/groups");
const mutation = useMutation();
const { pending } = mutation;
const search = ref("");
const groups = computed(() =>
  flattenGroups(directory.value?.groups ?? [], directory.value?.settings ?? []),
);
const selection = computed(() => {
  const { groupId, create } = route.query;

  if (typeof groupId === "string") {
    return { groupId };
  }

  if (typeof create === "string") {
    return { parentId: create || undefined };
  }

  return undefined;
});
const editor = computed(() => {
  const { groupId, parentId } = selection.value ?? {};

  return {
    group: groups.value.find((group) => group.groupId === groupId),
    parent: groups.value.find((group) => group.groupId === parentId),
    settings: directory.value?.settings.find(
      (settings) => settings.groupId === groupId,
    ),
  };
});

const select = (groupId: string) =>
  navigateTo({ path: "/admin", query: { groupId } }, { replace: true });

const create = (parentId?: string) =>
  navigateTo(
    { path: "/admin", query: { create: parentId ?? "" } },
    { replace: true },
  );

async function refreshSelection(groupId: string) {
  await refresh();
  search.value = "";
  await select(groupId);
}
</script>

<template>
  <NuxtLayout name="admin" title="群组配置">
    <NGrid
      v-if="directory"
      cols="1 m:3"
      item-responsive
      responsive="screen"
      :x-gap="20"
      :y-gap="20"
    >
      <NGi>
        <GroupTree
          v-model:search="search"
          :disabled="pending"
          :groups
          :loading="status === 'pending'"
          :selected-id="selection?.groupId"
          :tree="directory.groups"
          @create="create()"
          @select="select"
        />
      </NGi>
      <NGi span="1 m:2">
        <GroupEditor
          v-if="selection && (!selection.groupId || editor.group)"
          :mutation
          :refresh="refreshSelection"
          :selection="editor"
          @create-child="create"
        />
        <NCard v-else class="editor-empty">
          <NEmpty description="选择群组进行编辑" />
        </NCard>
      </NGi>
    </NGrid>
    <LoadError v-else-if="error" :error :retry="refresh" />
  </NuxtLayout>
</template>

<style scoped>
.editor-empty {
  padding-block: 64px;
}
</style>

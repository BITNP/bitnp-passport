<script setup lang="ts">
import type { GroupNode } from "#shared/types";

definePageMeta({ middleware: ["auth", "admin"] });

const route = useRoute();
const {
  data: directory,
  error: loadError,
  refresh,
  status,
} = await useFetch("/api/admin/groups");
const { submit, pending } = useMutation();
const message = useMessage();
const search = ref("");
const expanded = ref<(string | number)[]>([]);

const editor = ref<{
  group?: GroupNode;
  parent?: GroupNode;
  name: string;
  label: string;
  note: string;
  allowInvites: boolean;
}>();

const nodes = computed(() => {
  const result = new Map<string, GroupNode & { ancestors: string[] }>();

  function visit(groups: GroupNode[], ancestors: string[]) {
    for (const group of groups) {
      result.set(group.id, { ...group, ancestors });
      visit(group.children, [...ancestors, group.id]);
    }
  }

  if (directory.value) {
    visit(directory.value.groups, []);
  }

  return result;
});

const labels = computed(
  () =>
    new Map(
      directory.value?.settings.map((group) => [group.groupId, group.label]),
    ),
);

const groupLabel = (group: GroupNode) =>
  labels.value.get(group.id) ?? group.name;

function matchesGroup(pattern: string, group: GroupNode) {
  const query = pattern.trim().toLocaleLowerCase();

  return [group.path, groupLabel(group)].some((value) =>
    value.toLocaleLowerCase().includes(query),
  );
}

const searchGroups = computed(() =>
  [...nodes.value.values()].map((group) => ({
    groupId: group.id,
    label: groupLabel(group),
    path: group.path,
  })),
);

function edit(group: GroupNode) {
  const settings = directory.value!.settings.find(
    (item) => item.groupId === group.id,
  );
  editor.value = {
    group,
    name: group.name,
    label: settings?.label ?? "",
    note: settings?.note ?? "",
    allowInvites: settings?.allowInvites ?? false,
  };

  expanded.value = [
    ...new Set([...expanded.value, ...nodes.value.get(group.id)!.ancestors]),
  ];
}

const select = (keys: (string | number)[]) =>
  navigateTo(
    { path: "/admin", query: { groupId: String(keys[0]) } },
    { replace: true },
  );

function create(parent?: GroupNode) {
  editor.value = { parent, name: "", label: "", note: "", allowInvites: false };

  return navigateTo("/admin", { replace: true });
}

async function save() {
  const draft = editor.value!;
  const result = await submit(() =>
    $fetch(draft.group ? "/api/admin/groups" : "/api/admin/groups/create", {
      method: "POST",
      body: {
        groupId: draft.group?.id,
        parentId: draft.parent?.id,
        name: draft.name,
        label: draft.label.trim() || draft.name,
        note: draft.note,
        allowInvites: draft.allowInvites,
      },
    }),
  );

  if (result) {
    await refresh();
    search.value = "";
    await select([result.groupId]);
    message.success("群组已保存");
  }
}

watch(
  () => [nodes.value, route.query.groupId] as const,
  ([groups, groupId]) => {
    if (typeof groupId !== "string") {
      return;
    }

    const group = groups.get(groupId);

    if (group) {
      edit(group);
    }
  },
  { immediate: true },
);

useFetchError(loadError, refresh);
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
        <NCard size="small" title="群组">
          <template #header-extra>
            <NButton :disabled="pending" size="small" @click="create()">
              新建群组
            </NButton>
          </template>
          <NFlex :size="16" vertical>
            <GroupAutocomplete
              v-model:value="search"
              :disabled="pending"
              :groups="searchGroups"
              @select="select([$event])"
            />
            <NSpin :show="status === 'pending'">
              <NScrollbar class="group-tree">
                <NTree
                  v-if="directory.groups.length > 0"
                  v-model:expanded-keys="expanded"
                  block-line
                  :cancelable="false"
                  :data="directory.groups"
                  :disabled="pending"
                  :filter="
                    (pattern, node) =>
                      matchesGroup(pattern, nodes.get(String(node.id))!)
                  "
                  key-field="id"
                  label-field="name"
                  :pattern="search"
                  :render-label="
                    ({ option }) => groupLabel(nodes.get(String(option.id))!)
                  "
                  :selected-keys="editor?.group ? [editor.group.id] : []"
                  show-line
                  @update:selected-keys="select"
                />
                <NEmpty v-else description="暂无群组" />
              </NScrollbar>
            </NSpin>
          </NFlex>
        </NCard>
      </NGi>
      <NGi span="1 m:2">
        <NCard
          v-if="editor"
          :title="editor.group ? groupLabel(editor.group) : '新建群组'"
        >
          <template v-if="editor.group" #header-extra>
            <NButton
              :disabled="pending"
              size="small"
              @click="create(editor.group)"
            >
              新建子群组
            </NButton>
          </template>
          <NFlex :size="20" vertical>
            <NText class="group-path" depth="3">
              <template v-if="editor.group">{{ editor.group.path }}</template>
              <template v-else-if="editor.parent">
                父群组：{{ editor.parent.path }}
              </template>
              <template v-else>顶层群组</template>
            </NText>
            <NForm :disabled="pending" @submit.prevent="save">
              <NFormItem label="路径名" required>
                <NInput
                  v-model:value="editor.name"
                  :input-props="{ required: true }"
                  placeholder="例如：techdept"
                />
              </NFormItem>
              <NFormItem label="显示名称">
                <NInput
                  v-model:value="editor.label"
                  placeholder="留空使用路径名称"
                />
              </NFormItem>
              <NFormItem label="管理备注">
                <NInput
                  v-model:value="editor.note"
                  :autosize="{ minRows: 3, maxRows: 6 }"
                  type="textarea"
                />
              </NFormItem>
              <NFlex :size="20" vertical>
                <NCheckbox v-model:checked="editor.allowInvites">
                  允许群组管理员创建邀请链接
                </NCheckbox>
                <NFlex align="center">
                  <NButton attr-type="submit" :loading="pending" type="primary">
                    {{ editor.group ? "保存" : "创建群组" }}
                  </NButton>
                  <LinkButton
                    v-if="
                      editor.group &&
                      directory.settings.some(
                        (item) => item.groupId === editor?.group?.id,
                      )
                    "
                    :to="`/groups/${encodeURIComponent(editor.group.id)}`"
                  >
                    成员与授权
                  </LinkButton>
                </NFlex>
              </NFlex>
            </NForm>
          </NFlex>
        </NCard>
        <NCard v-else class="editor-empty">
          <NEmpty description="选择群组进行编辑" />
        </NCard>
      </NGi>
    </NGrid>
  </NuxtLayout>
</template>

<style scoped>
.group-tree {
  max-height: 65vh;
}

.group-path {
  overflow-wrap: anywhere;
}

.editor-empty {
  padding-block: 64px;
}

@media (max-width: 1023px) {
  .group-tree {
    max-height: 35vh;
  }
}
</style>

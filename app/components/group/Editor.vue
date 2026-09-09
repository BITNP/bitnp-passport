<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { flattenGroups } from "~/utils/groupDirectory";

type Group = ReturnType<typeof flattenGroups>[number];

const emit = defineEmits<{
  createChild: [parentId: string];
}>();
const { selection, mutation, refresh } = defineProps<{
  selection: {
    group?: Group;
    parent?: Group;
    settings?: InternalApi["/api/admin/groups"]["get"]["settings"][number];
  };
  mutation: ReturnType<typeof useMutation>;
  refresh: (groupId: string) => Promise<void>;
}>();
const { submit, pending } = mutation;
const message = useMessage();
const form = ref({ name: "", label: "", note: "", allowInvites: false });

watch(
  () => selection,
  ({ group, settings }) => {
    form.value = {
      name: group?.name ?? "",
      label: settings?.label ?? "",
      note: settings?.note ?? "",
      allowInvites: settings?.allowInvites ?? false,
    };
  },
  { immediate: true },
);

const save = () =>
  submit(async () => {
    const { group, parent } = selection;
    const result = await $fetch(
      group ? "/api/admin/groups" : "/api/admin/groups/create",
      {
        method: "POST",
        body: {
          ...form.value,
          groupId: group?.groupId,
          parentId: parent?.groupId,
          label: form.value.label.trim() || form.value.name,
        },
      },
    );
    await refresh(result.groupId);
    message.success("群组已保存");
  });
</script>

<template>
  <NCard :title="selection.group?.label ?? '新建群组'">
    <template v-if="selection.group" #header-extra>
      <NButton
        :disabled="pending"
        size="small"
        @click="emit('createChild', selection.group.groupId)"
      >
        新建子群组
      </NButton>
    </template>
    <NFlex :size="20" vertical>
      <NText class="group-path" depth="3">
        <template v-if="selection.group">{{ selection.group.path }}</template>
        <template v-else-if="selection.parent">
          父群组：{{ selection.parent.path }}
        </template>
        <template v-else>顶层群组</template>
      </NText>
      <NForm :disabled="pending" @submit.prevent="save">
        <NFormItem label="路径名" required>
          <NInput
            v-model:value="form.name"
            :input-props="{ required: true }"
            placeholder="例如：techdept"
          />
        </NFormItem>
        <NFormItem label="显示名称">
          <NInput v-model:value="form.label" placeholder="留空使用路径名称" />
        </NFormItem>
        <NFormItem label="管理备注">
          <NInput
            v-model:value="form.note"
            :autosize="{ minRows: 3, maxRows: 6 }"
            type="textarea"
          />
        </NFormItem>
        <NFlex :size="20" vertical>
          <NCheckbox v-model:checked="form.allowInvites">
            允许群组管理员创建邀请链接
          </NCheckbox>
          <NFlex align="center">
            <NButton attr-type="submit" :loading="pending" type="primary">
              {{ selection.group ? "保存" : "创建群组" }}
            </NButton>
            <LinkButton
              v-if="selection.group"
              :to="`/groups/${encodeURIComponent(selection.group.groupId)}`"
            >
              成员与授权
            </LinkButton>
          </NFlex>
        </NFlex>
      </NForm>
    </NFlex>
  </NCard>
</template>

<style scoped>
.group-path {
  overflow-wrap: anywhere;
}
</style>

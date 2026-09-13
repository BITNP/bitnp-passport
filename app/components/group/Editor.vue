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
const enrolled = computed(() => selection.settings?.enrolled ?? false);
const formChanged = computed(
  () =>
    form.value.name !== (selection.group?.name ?? "") ||
    form.value.label !== (selection.settings?.label ?? "") ||
    form.value.note !== (selection.settings?.note ?? "") ||
    form.value.allowInvites !== (selection.settings?.allowInvites ?? false),
);

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
    const { name, label, note, allowInvites } = form.value;
    const result = group
      ? await $fetch("/api/admin/groups", {
          method: "POST",
          body: {
            groupId: group.groupId,
            name,
            settings: enrolled.value
              ? { label: label.trim() || name, note, allowInvites }
              : undefined,
          },
        })
      : await $fetch("/api/admin/groups/create", {
          method: "POST",
          body: { name, parentId: parent?.groupId },
        });
    await refresh(result.groupId);
    message.success(group ? "群组已保存" : "群组已创建");
  });

const setEnrollment = (groupId: string, enrolled: boolean) =>
  submit(async () => {
    const result = await $fetch("/api/admin/groups/enrollment", {
      method: "PUT",
      body: { groupId, enrolled },
    });
    await refresh(result.groupId);
    message.success(enrolled ? "群组已纳入通行证" : "群组已取消纳入通行证");
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
      <NFlex
        v-if="selection.group"
        :key="selection.group.groupId"
        align="center"
        :size="12"
      >
        <NTag size="small" :type="enrolled ? 'success' : 'default'">
          {{ enrolled ? "已纳入通行证" : "未纳入通行证" }}
        </NTag>
        <NPopconfirm
          :disabled="pending || formChanged"
          :negative-text="enrolled ? '保留纳入' : '取消'"
          :positive-button-props="{
            type: enrolled ? 'error' : 'primary',
            disabled: pending || formChanged,
          }"
          :positive-text="enrolled ? '取消纳入' : '纳入通行证'"
          @positive-click="setEnrollment(selection.group.groupId, !enrolled)"
        >
          <template #trigger>
            <NButton :disabled="pending || formChanged" size="small">
              {{ enrolled ? "取消纳入" : "纳入通行证" }}
            </NButton>
          </template>
          <span class="confirmation">
            <template v-if="enrolled">
              确认将「{{ selection.group.path }}」取消纳入通行证？
            </template>
            <template v-else>
              确认将「{{ selection.group.path }}」纳入通行证？
            </template>
          </span>
        </NPopconfirm>
        <NText v-if="formChanged" depth="3">
          有未保存的更改，请先保存后再{{ enrolled ? "取消纳入" : "纳入" }}
        </NText>
      </NFlex>
      <NForm :disabled="pending" @submit.prevent="save">
        <NFormItem label="路径名" required>
          <NInput
            v-model:value="form.name"
            :input-props="{ required: true }"
            placeholder="例如：techdept"
          />
        </NFormItem>
        <template v-if="enrolled">
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
        </template>
        <NFlex :size="20" vertical>
          <NCheckbox v-if="enrolled" v-model:checked="form.allowInvites">
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

.confirmation {
  display: inline-block;
  max-width: 280px;
}
</style>

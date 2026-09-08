<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";
import { NText } from "naive-ui";

import type { MembershipPreview } from "#shared/types";

definePageMeta({ middleware: "auth" });
useHead({ title: "批量成员操作" });

const route = useRoute();
const groupId = computed(() => encodeURIComponent(String(route.params.id)));
const {
  data: group,
  error: loadError,
  refresh,
} = await useFetch(() => `/api/groups/${groupId.value}`);

const text = ref("");
const preview = ref<MembershipPreview>();
const selected = ref<string[]>([]);
const operation = ref<"add" | "remove">("add");
const { submit, pending } = useMutation();

const candidates = computed(() => {
  if (!preview.value) {
    return [];
  }

  const users = preview.value.rows.flatMap(({ user, member }) =>
    user && (operation.value === "add" ? !member && user.enabled : member)
      ? [user]
      : [],
  );
  if (operation.value === "remove") {
    users.push(...preview.value.outside);
  }

  return [...new Map(users.map((user) => [user.id, user])).values()];
});

watch(operation, () => {
  selected.value = [];
});

watch(text, () => {
  preview.value = undefined;
  selected.value = [];
});

const compare = () =>
  submit(async () => {
    const result = await $fetch(`/api/groups/${groupId.value}/preview`, {
      method: "POST",
      body: { text: text.value },
    });
    preview.value = result;
    selected.value = [];
  });

const enqueue = () =>
  submit(async () => {
    const result = await $fetch(`/api/groups/${groupId.value}/jobs`, {
      method: "POST",
      body: { subjects: selected.value, operation: operation.value },
    });
    await navigateTo(`/jobs/${result.id}`);
  });

const previewColumns: DataTableColumns<MembershipPreview["rows"][number]> = [
  { title: "输入", key: "identifier", minWidth: 200 },
  {
    title: "匹配账户",
    key: "username",
    minWidth: 160,
    render: (row) => row.user?.username ?? "—",
  },
  {
    title: "当前状态",
    key: "status",
    minWidth: 200,
    render: (row) =>
      row.error
        ? h(NText, { type: "error" }, () => row.error)
        : `${row.member ? "已在群组中" : "未加入"}${row.user?.enabled ? "" : " · 账户已停用"}`,
  },
];
const candidateColumns: DataTableColumns<(typeof candidates.value)[number]> = [
  { type: "selection" },
  { title: "用户名", key: "username", minWidth: 160 },
  { title: "邮箱", key: "email", minWidth: 240 },
];

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="page">
    <NPageHeader @back="navigateTo(`/groups/${groupId}`)">
      <template #title><h1>批量成员操作</h1></template>
      <template v-if="group" #footer>
        <NuxtLink :to="`/groups/${groupId}`">
          {{ group.settings.label }}
        </NuxtLink>
      </template>
      <template #extra>
        <LinkButton :to="`/jobs?groupId=${groupId}`">群组任务</LinkButton>
      </template>
    </NPageHeader>
    <NCard v-if="group" title="对比名单">
      <NForm @submit.prevent="compare">
        <NFormItem
          label="完整用户名或邮箱（每行一个，最多 200 个）"
          :label-props="{ for: 'batch-users' }"
          required
        >
          <NInput
            v-model:value="text"
            :autosize="{ minRows: 6, maxRows: 12 }"
            :input-props="{ id: 'batch-users', required: true }"
            type="textarea"
          />
        </NFormItem>
        <NButton attr-type="submit" :loading="pending" type="primary">
          预览差异
        </NButton>
      </NForm>
    </NCard>
    <template v-if="preview">
      <NCard title="匹配结果">
        <template #header-extra>
          <NText depth="3">
            群组 {{ preview.memberCount }} 人 · 名单
            {{ preview.rows.length }} 项
          </NText>
        </template>
        <NFlex :size="20" vertical>
          <NDataTable
            :bordered="false"
            :columns="previewColumns"
            :data="preview.rows"
            :row-key="(row) => row.identifier"
            :scroll-x="560"
          />
          <NCollapse v-if="preview.outside.length > 0">
            <NCollapseItem
              name="outside"
              :title="`名单外成员（${preview.outside.length}）`"
            >
              {{ preview.outside.map((user) => user.username).join("、") }}
            </NCollapseItem>
          </NCollapse>
        </NFlex>
      </NCard>
      <NCard title="选择变更">
        <NFlex :size="20" vertical>
          <NRadioGroup v-model:value="operation">
            <NRadioButton value="add">添加成员</NRadioButton>
            <NRadioButton value="remove">移除成员</NRadioButton>
          </NRadioGroup>
          <NDataTable
            :bordered="false"
            :checked-row-keys="selected"
            :columns="candidateColumns"
            :data="candidates"
            :row-key="(user) => user.id"
            :scroll-x="450"
            @update:checked-row-keys="selected = $event as string[]"
          />
          <NFlex align="center" justify="space-between">
            <NText
              depth="3"
              :type="selected.length > 200 ? 'error' : undefined"
            >
              已选 {{ selected.length }} 人
              <template v-if="selected.length > 200">
                （最多选择 200 人）
              </template>
            </NText>
            <ConfirmAction
              confirm-label="确认并创建任务"
              :disabled="
                pending || selected.length === 0 || selected.length > 200
              "
              :message="`确认${operation === 'add' ? '添加' : '移除'}这 ${selected.length} 位成员？`"
              @confirm="enqueue"
            >
              创建任务
            </ConfirmAction>
          </NFlex>
        </NFlex>
      </NCard>
    </template>
  </NuxtLayout>
</template>

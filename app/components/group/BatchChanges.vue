<script setup lang="ts">
import type { DataTableColumns } from "naive-ui";

import type { MembershipPreview } from "#shared/types";

const { groupId, preview } = defineProps<{
  groupId: string;
  preview: MembershipPreview | undefined;
}>();
const job = reactive<{ subjects: string[]; operation: "add" | "remove" }>({
  subjects: [],
  operation: "add",
});
const { submit, pending } = useMutation();

const candidates = computed(() => {
  if (!preview) {
    return [];
  }

  const users = preview.rows.flatMap(({ user, member }) =>
    user && (job.operation === "add" ? !member && user.enabled : member)
      ? [user]
      : [],
  );
  if (job.operation === "remove") {
    users.push(...preview.outside);
  }

  return [...new Map(users.map((user) => [user.id, user])).values()];
});

watch([() => job.operation, () => preview], () => (job.subjects = []));

const enqueue = () =>
  submit(async () => {
    const result = await $fetch(
      `/api/groups/${encodeURIComponent(groupId)}/jobs`,
      {
        method: "POST",
        body: job,
      },
    );
    await navigateTo(`/jobs/${result.id}`);
  });

const columns: DataTableColumns<(typeof candidates.value)[number]> = [
  { type: "selection" },
  { title: "用户名", key: "username", minWidth: 160 },
  { title: "邮箱", key: "email", minWidth: 240 },
];
</script>

<template>
  <NCard v-if="preview" title="选择变更">
    <NFlex :size="20" vertical>
      <NRadioGroup v-model:value="job.operation">
        <NRadioButton value="add">添加成员</NRadioButton>
        <NRadioButton value="remove">移除成员</NRadioButton>
      </NRadioGroup>
      <NDataTable
        :bordered="false"
        :checked-row-keys="job.subjects"
        :columns
        :data="candidates"
        :row-key="(user) => user.id"
        :scroll-x="450"
        @update:checked-row-keys="job.subjects = $event as string[]"
      />
      <NFlex align="center" justify="space-between">
        <NText
          depth="3"
          :type="job.subjects.length > 200 ? 'error' : undefined"
        >
          已选 {{ job.subjects.length }} 人
          <template v-if="job.subjects.length > 200">
            （最多选择 200 人）
          </template>
        </NText>
        <ConfirmAction
          confirm-label="确认并创建任务"
          :disabled="
            pending || job.subjects.length === 0 || job.subjects.length > 200
          "
          :message="`确认${job.operation === 'add' ? '添加' : '移除'}这 ${job.subjects.length} 位成员？`"
          @confirm="enqueue"
        >
          创建任务
        </ConfirmAction>
      </NFlex>
    </NFlex>
  </NCard>
</template>

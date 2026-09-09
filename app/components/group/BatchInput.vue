<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { MembershipPreview } from "#shared/types";

const emit = defineEmits<{
  preview: [value: MembershipPreview | undefined];
}>();
const { groupId, groups } = defineProps<{
  groupId: string;
  groups: InternalApi["/api/groups"]["get"] | undefined;
}>();
const text = ref("");
const { submit, pending } = useMutation();
const message = useMessage();

watch(text, () => emit("preview", undefined));

const importMembers = (sourceGroupId: string) =>
  submit(async () => {
    emit("preview", undefined);
    const members = await $fetch(
      `/api/groups/${encodeURIComponent(sourceGroupId)}/members`,
    );
    if (members.length === 0) {
      message.info("该群组暂无成员");

      return;
    }

    const identifiers = new Set(
      text.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );

    for (const member of members) {
      if (!identifiers.has(member.email)) {
        identifiers.add(member.username);
      }
    }

    text.value = [...identifiers].join("\n");
    message.success("名单已导入");
  });

const compare = () =>
  submit(async () => {
    emit("preview", undefined);
    const result = await $fetch(
      `/api/groups/${encodeURIComponent(groupId)}/preview`,
      {
        method: "POST",
        body: { text: text.value },
      },
    );
    emit("preview", result);
  });
</script>

<template>
  <NCard title="对比名单">
    <NForm @submit.prevent="compare">
      <NFormItem v-if="groups" label="从群组追加名单">
        <GroupSelect
          :disabled="pending"
          :groups
          placeholder="选择来源群组"
          :value="null"
          @update:value="importMembers"
        />
      </NFormItem>
      <NFormItem
        label="完整用户名或邮箱（每行一个，最多 200 个）"
        :label-props="{ for: 'batch-users' }"
        required
      >
        <NInput
          v-model:value="text"
          :autosize="{ minRows: 6, maxRows: 12 }"
          :disabled="pending"
          :input-props="{ id: 'batch-users', required: true }"
          type="textarea"
        />
      </NFormItem>
      <NButton attr-type="submit" :loading="pending" type="primary">
        预览差异
      </NButton>
    </NForm>
  </NCard>
</template>

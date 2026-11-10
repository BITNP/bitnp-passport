<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { DirectoryUser } from "#shared/user";
import { userLabel } from "#shared/user";

type UserAdministration = NonNullable<
  InternalApi["/api/manage/users/:id"]["get"]["administration"]
>;

const { user, memberships, refresh } = defineProps<{
  user: DirectoryUser;
  memberships: UserAdministration["permissions"]["memberships"];
  refresh: () => Promise<void>;
}>();
const {
  data: groups,
  error,
  refresh: refreshGroups,
  status,
} = await useFetch("/api/groups");
const selectedGroupId = ref<string | null>(null);
const availableGroups = computed(() =>
  groups.value?.filter(
    (group) =>
      !memberships.some((membership) => membership.id === group.groupId),
  ),
);

const { submit, pending, running } = useMutation(refresh);
const message = useMessage();

const addGroup = () =>
  submit(async () => {
    await $fetch(
      `/api/groups/${encodeURIComponent(selectedGroupId.value!)}/members`,
      {
        method: "POST",
        body: { identifier: user.username },
      },
    );
    selectedGroupId.value = null;
    message.success("已加入群组");
  }, "add");

const removeGroup = (groupId: string) =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "DELETE",
      body: { subject: user.id },
    });
    message.success("已从群组移除");
  }, "remove");
</script>

<template>
  <NCard title="所属群组">
    <NFlex :size="20" vertical>
      <NForm v-if="availableGroups" @submit.prevent="addGroup">
        <NFormItem label="添加到群组" :show-feedback="false">
          <NInputGroup>
            <GroupSelect
              v-model:value="selectedGroupId"
              clearable
              :disabled="pending || !user.enabled"
              :groups="availableGroups"
              :loading="status === 'pending'"
            />
            <NButton
              attr-type="submit"
              :disabled="pending || !selectedGroupId || !user.enabled"
              :loading="running === 'add'"
              type="primary"
            >
              添加
            </NButton>
          </NInputGroup>
        </NFormItem>
      </NForm>
      <LoadError v-else-if="error" :error :retry="refreshGroups" />
      <NList v-if="memberships.length > 0">
        <NListItem v-for="group in memberships" :key="group.id">
          <NuxtLink :to="`/groups/${encodeURIComponent(group.id)}`">
            {{ group.label }}
          </NuxtLink>
          <NText depth="3" tag="div">{{ group.path }}</NText>
          <template #suffix>
            <ConfirmAction
              :disabled="pending"
              :message="`确认将 ${userLabel(user)} 从 ${group.label} 移除？`"
              @confirm="removeGroup(group.id)"
            >
              移除
            </ConfirmAction>
          </template>
        </NListItem>
      </NList>
      <NEmpty v-else description="暂无群组" />
    </NFlex>
  </NCard>
</template>

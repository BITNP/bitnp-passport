<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

const { user, memberships, refresh } = defineProps<{
  user: { id: string; username: string; enabled: boolean };
  memberships: InternalApi["/api/admin/users/:id"]["get"]["permissions"]["memberships"];
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

const { submit, pending } = useMutation(refresh);
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
  });

const removeGroup = (groupId: string) =>
  submit(async () => {
    await $fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
      method: "DELETE",
      body: { subject: user.id },
    });
    message.success("已从群组移除");
  });

useFetchError(error, refreshGroups);
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
              :loading="pending"
              type="primary"
            >
              添加
            </NButton>
          </NInputGroup>
        </NFormItem>
      </NForm>
      <NList v-if="memberships.length > 0">
        <NListItem v-for="group in memberships" :key="group.id">
          <NuxtLink :to="`/groups/${encodeURIComponent(group.id)}`">
            {{ group.label }}
          </NuxtLink>
          <NText depth="3" tag="div">{{ group.path }}</NText>
          <template #suffix>
            <ConfirmAction
              :disabled="pending"
              :message="`确认将 ${user.username} 从 ${group.label} 移除？`"
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

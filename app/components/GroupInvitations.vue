<script setup lang="ts">
const { groupId, allowInvites } = defineProps<{
  groupId: string;
  allowInvites: boolean;
}>();

const endpoint = computed(
  () => `/api/groups/${encodeURIComponent(groupId)}/invitations` as const,
);
const { data: invitations, error, refresh, status } = await useFetch(endpoint);
const { submit, pending } = useMutation();
const message = useMessage();
const days = ref(7);

const durations = [1, 7, 14, 30].map((value) => ({
  label: `${value} 天`,
  value,
}));

const date = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

const createInvitation = () =>
  submit(async () => {
    await $fetch(endpoint.value, {
      method: "POST",
      body: { days: days.value },
    });
    message.success("邀请已创建");
    await refresh();
  });

const revokeInvitation = (id: string) =>
  submit(async () => {
    await $fetch(endpoint.value, { method: "DELETE", body: { id } });
    message.success("邀请已撤销");
    await refresh();
  });

const copyInvitation = (url: string) =>
  submit(async () => {
    await navigator.clipboard.writeText(url);
    message.success("链接已复制");
  });

useFetchError(error, refresh);
</script>

<template>
  <NCard title="邀请链接">
    <NFlex :size="20" vertical>
      <NForm v-if="allowInvites" @submit.prevent="createInvitation">
        <NFlex align="end" :size="12">
          <NFormItem label="有效期" :show-feedback="false">
            <NSelect
              v-model:value="days"
              class="duration-select"
              :options="durations"
            />
          </NFormItem>
          <NButton attr-type="submit" :loading="pending" type="primary">
            创建邀请
          </NButton>
        </NFlex>
      </NForm>
      <NText v-else depth="3">此群组未开放邀请</NText>
      <NSpin :show="status === 'pending'">
        <NList v-if="invitations?.length" show-divider>
          <NListItem v-for="invitation in invitations" :key="invitation.id">
            <NFlex :size="12" vertical>
              <NInputGroup>
                <NInput
                  readonly
                  :value="invitation.url"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <NButton
                  :disabled="pending"
                  @click="copyInvitation(invitation.url)"
                >
                  复制
                </NButton>
              </NInputGroup>
              <NFlex align="center" justify="space-between" :size="12">
                <NFlex :size="12">
                  <NText depth="3">
                    创建：{{ date(invitation.createdAt) }}
                  </NText>
                  <NText depth="3">
                    到期：{{ date(invitation.expiresAt) }}
                  </NText>
                  <NText v-if="invitation.revokedAt" depth="3">
                    撤销：{{ date(invitation.revokedAt) }}
                  </NText>
                </NFlex>
                <NTag
                  v-if="invitation.revokedAt"
                  :bordered="false"
                  size="small"
                >
                  已撤销
                </NTag>
                <ConfirmAction
                  v-else
                  :disabled="pending"
                  message="确认撤销此邀请？"
                  @confirm="revokeInvitation(invitation.id)"
                >
                  撤销
                </ConfirmAction>
              </NFlex>
            </NFlex>
          </NListItem>
        </NList>
        <NEmpty v-else-if="status === 'success'" description="暂无邀请链接" />
      </NSpin>
    </NFlex>
  </NCard>
</template>

<style scoped>
.duration-select {
  width: 140px;
}
</style>

<script setup lang="ts">
import type { AdminUserProfile, MemberProfileInput } from "#shared/user";

const { user, refresh } = defineProps<{
  user: AdminUserProfile;
  refresh: () => Promise<void>;
}>();

const form = reactive<MemberProfileInput>({ qqNumber: user.qqNumber });
watch(
  () => user,
  (value) => {
    form.qqNumber = value.qqNumber;
  },
);

const { submit, pending } = useMutation(refresh);
const message = useMessage();
const save = () =>
  submit(async () => {
    await $fetch(`/api/manage/users/${encodeURIComponent(user.id)}/profile`, {
      method: "PUT",
      body: form,
    });
    message.success("成员资料已保存");
  });
</script>

<template>
  <NCard title="成员资料">
    <NFlex :size="24" vertical>
      <UserIdentity show-username :size="48" :user />
      <NDescriptions :column="1" label-placement="left">
        <NDescriptionsItem label="真实姓名">{{ user.name }}</NDescriptionsItem>
        <NDescriptionsItem label="邮箱">
          {{ user.email || "未填写" }}
        </NDescriptionsItem>
        <NDescriptionsItem label="账户状态">
          {{ user.enabled ? "已启用" : "已停用" }}
        </NDescriptionsItem>
      </NDescriptions>
      <NForm :disabled="pending" @submit.prevent="save">
        <NFormItem label="QQ 号" :label-props="{ for: 'member-qq' }">
          <NInput
            v-model:value="form.qqNumber"
            :input-props="{
              id: 'member-qq',
              autocomplete: 'off',
              inputmode: 'numeric',
            }"
          />
        </NFormItem>
        <NButton attr-type="submit" :loading="pending" type="primary">
          保存成员资料
        </NButton>
      </NForm>
    </NFlex>
  </NCard>
</template>

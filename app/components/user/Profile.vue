<script setup lang="ts">
import type { AdminProfileInput, AdminUserProfile } from "#shared/user";
import { formatDateTime } from "#shared/utils";

const { user, refresh } = defineProps<{
  user: AdminUserProfile;
  refresh: () => Promise<void>;
}>();

const form = reactive<AdminProfileInput>({
  name: user.name,
  email: user.email,
  qqNumber: user.qqNumber,
  githubUsername: user.githubUsername,
  enabled: user.enabled,
  emailVerified: user.emailVerified,
});
watch(
  () => user,
  (value) => {
    Object.assign(form, {
      name: value.name,
      email: value.email,
      qqNumber: value.qqNumber,
      githubUsername: value.githubUsername,
      enabled: value.enabled,
      emailVerified: value.emailVerified,
    });
  },
);
watch(
  () => form.email,
  (value) => {
    if (value !== user.email) {
      form.emailVerified = false;
    }
  },
);

const { submit, pending } = useMutation();
const { data: session } = await usePortalSession();
const message = useMessage();
const save = () =>
  submit(async () => {
    await $fetch(`/api/admin/users/${encodeURIComponent(user.id)}/profile`, {
      method: "PUT",
      body: form,
    });
    await refreshNuxtData("portal-session");
    if (!session.value) {
      await navigateTo("/account");

      return;
    }
    await refresh();
    message.success("用户资料已保存");
  });

const keycloakPages = {
  settings: "用户信息",
  groups: "群组管理",
  sessions: "登录会话",
};
</script>

<template>
  <NCard title="成员资料">
    <template #header-extra>
      <NuxtLink :to="{ path: '/audit', query: { actor: user.username } }">
        操作记录
      </NuxtLink>
    </template>
    <UserIdentity class="profile-header" show-username :size="64" :user />
    <NForm :disabled="pending" @submit.prevent="save">
      <NFormItem label="真实姓名" :label-props="{ for: 'admin-name' }">
        <NInput
          v-model:value="form.name"
          :input-props="{
            id: 'admin-name',
            autocomplete: 'off',
          }"
        />
      </NFormItem>
      <NFormItem label="邮箱" :label-props="{ for: 'admin-email' }">
        <NInput
          v-model:value="form.email"
          :input-props="{
            id: 'admin-email',
            type: 'email',
            autocomplete: 'off',
          }"
        />
      </NFormItem>
      <NFormItem label="QQ 号" :label-props="{ for: 'admin-qq' }">
        <NInput
          v-model:value="form.qqNumber"
          :input-props="{
            id: 'admin-qq',
            autocomplete: 'off',
            inputmode: 'numeric',
          }"
        />
      </NFormItem>
      <NFormItem
        label="GitHub 用户名"
        :label-props="{ for: 'admin-github-username' }"
      >
        <NInput
          v-model:value="form.githubUsername"
          :input-props="{ id: 'admin-github-username', autocomplete: 'off' }"
        />
      </NFormItem>
      <NFormItem label="邮箱验证">
        <NCheckbox v-model:checked="form.emailVerified" :disabled="!form.email">
          已验证
        </NCheckbox>
      </NFormItem>
      <NFormItem label="账户状态">
        <NCheckbox v-model:checked="form.enabled">允许登录</NCheckbox>
      </NFormItem>
      <NButton attr-type="submit" :loading="pending" type="primary">
        保存资料
      </NButton>
    </NForm>
    <NDivider />
    <NDescriptions :column="1" label-placement="left">
      <NDescriptionsItem label="创建时间">
        {{
          user.createdTimestamp ? formatDateTime(user.createdTimestamp) : " - "
        }}
      </NDescriptionsItem>
      <NDescriptionsItem label="用户 ID">
        <span class="mono">{{ user.id }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="Keycloak">
        <NFlex :size="16">
          <a
            v-for="(label, page) in keycloakPages"
            :key="page"
            :href="`/admin/keycloak?user=${encodeURIComponent(user.id)}&page=${page}`"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ label }}
          </a>
        </NFlex>
      </NDescriptionsItem>
    </NDescriptions>
  </NCard>
</template>

<style scoped>
.profile-header {
  width: 100%;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--divider-color);
  font-size: 18px;
  font-weight: 600;
}
</style>

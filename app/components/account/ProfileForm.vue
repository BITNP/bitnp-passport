<script setup lang="ts">
import type { AccountProfile, ProfileInput } from "#shared/user";

const emit = defineEmits<{ saved: [profile: AccountProfile] }>();
const { profile } = defineProps<{ profile: AccountProfile }>();
const { data: session } = await usePortalSession();
const { submit, pending } = useMutation(() =>
  refreshNuxtData("portal-session"),
);
const message = useMessage();

const form = reactive<ProfileInput>({
  name: "",
  email: null,
  qqNumber: null,
  githubUsername: null,
});

watch(
  () => profile,
  (value) => {
    form.name = value.user.name;
    form.email = value.user.email;
    form.qqNumber = value.qqNumber;
    form.githubUsername = value.githubUsername;
  },
  { immediate: true },
);

const save = () =>
  submit(async () => {
    const saved = await $fetch("/api/account/profile", {
      method: "PUT",
      body: {
        name: form.name,
        email: form.email,
        ...(session.value?.management && {
          qqNumber: form.qqNumber,
          githubUsername: form.githubUsername,
        }),
      },
    });
    emit("saved", saved);
    message.success("个人资料已保存");
  });
</script>

<template>
  <NCard title="个人资料">
    <NForm @submit.prevent="save">
      <NFormItem label="用户名">
        <NText>{{ profile.user.username }}</NText>
      </NFormItem>
      <NFormItem label="真实姓名" :label-props="{ for: 'name' }" required>
        <NInput
          v-model:value="form.name"
          :disabled="profile.readOnly.name"
          :input-props="{
            id: 'name',
            autocomplete: 'name',
            required: true,
          }"
        />
      </NFormItem>
      <NFormItem
        label="邮箱"
        :label-props="{ for: 'email' }"
        :required="profile.emailRequired"
      >
        <template #label>
          邮箱
          <NTag
            v-if="profile.user.email && form.email === profile.user.email"
            :bordered="false"
            size="small"
            :type="profile.emailVerified ? 'success' : 'warning'"
          >
            {{ profile.emailVerified ? "已验证" : "未验证" }}
          </NTag>
        </template>
        <NInput
          v-model:value="form.email"
          :disabled="profile.readOnly.email"
          :input-props="{
            id: 'email',
            autocomplete: 'email',
            required: profile.emailRequired,
            type: 'email',
          }"
        />
      </NFormItem>
      <NFormItem
        v-if="session?.management"
        label="QQ 号"
        :label-props="{ for: 'qqNumber' }"
      >
        <NInput
          v-model:value="form.qqNumber"
          :disabled="pending"
          :input-props="{ id: 'qqNumber', autocomplete: 'off' }"
        />
      </NFormItem>
      <NFormItem v-else label="QQ 号">
        <NFlex align="baseline" :size="12" wrap>
          <NText>{{ profile.qqNumber || "未填写" }}</NText>
          <NText depth="3">由管理层维护</NText>
        </NFlex>
      </NFormItem>
      <NFormItem
        v-if="session?.management"
        label="GitHub 用户名"
        :label-props="{ for: 'github-username' }"
      >
        <NInput
          v-model:value="form.githubUsername"
          :disabled="pending"
          :input-props="{ id: 'github-username', autocomplete: 'off' }"
        />
      </NFormItem>
      <NFormItem v-else label="GitHub 用户名">
        <NFlex align="baseline" :size="12" wrap>
          <a
            v-if="profile.githubUsername"
            class="profile-username"
            :href="`https://github.com/${encodeURIComponent(profile.githubUsername)}`"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ profile.githubUsername }}
          </a>
          <NText v-else>未填写</NText>
          <NText depth="3">由管理层维护</NText>
        </NFlex>
      </NFormItem>
      <NButton attr-type="submit" :loading="pending" type="primary">
        保存资料
      </NButton>
    </NForm>
  </NCard>
</template>

<style scoped>
.profile-username {
  overflow-wrap: anywhere;
}
</style>

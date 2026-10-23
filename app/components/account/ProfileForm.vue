<script setup lang="ts">
import type { AccountProfile, ProfileInput } from "#shared/user";

const emit = defineEmits<{ saved: [profile: AccountProfile] }>();
const { profile } = defineProps<{ profile: AccountProfile }>();
const { submit, pending } = useMutation(() =>
  refreshNuxtData("portal-session"),
);
const message = useMessage();

const form = reactive<ProfileInput>({ name: "" });

watch(
  () => profile,
  (value) => {
    form.name = value.user.name;
    form.email = value.user.email;
  },
  { immediate: true },
);

const save = () =>
  submit(async () => {
    const profile = await $fetch("/api/account/profile", {
      method: "PUT",
      body: form,
    });
    emit("saved", profile);
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
          :input-props="{
            id: 'name',
            autocomplete: 'name',
            required: true,
          }"
          :readonly="profile.readOnly.name"
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
          :input-props="{
            id: 'email',
            autocomplete: 'email',
            required: profile.emailRequired,
            type: 'email',
          }"
          :readonly="profile.readOnly.email"
        />
      </NFormItem>
      <NButton attr-type="submit" :loading="pending" type="primary">
        保存资料
      </NButton>
    </NForm>
  </NCard>
</template>

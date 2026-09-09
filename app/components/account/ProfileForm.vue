<script setup lang="ts">
import type { InternalApi } from "nitropack/types";

import type { ProfileInput } from "#shared/types";

type Profile = InternalApi["/api/account"]["get"]["profile"];

const emit = defineEmits<{ saved: [profile: Profile] }>();
const { profile } = defineProps<{ profile: Profile }>();
const { submit, pending } = useMutation(() =>
  refreshNuxtData("portal-session"),
);
const message = useMessage();

const form = reactive<ProfileInput>({ name: "" });

watch(
  () => profile,
  (value) => {
    form.name = [value.lastName, value.firstName].join("");
    form.email = value.email;
  },
  { immediate: true },
);

const nameReadOnly = computed(() =>
  profile.userProfileMetadata?.attributes.some(
    (field) =>
      (field.name === "firstName" || field.name === "lastName") &&
      field.readOnly,
  ),
);
const emailMetadata = computed(() =>
  profile.userProfileMetadata?.attributes.find(
    (field) => field.name === "email",
  ),
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
        <NText>{{ profile.username }}</NText>
      </NFormItem>
      <NFormItem label="真实姓名" :label-props="{ for: 'name' }" required>
        <NInput
          v-model:value="form.name"
          :input-props="{
            id: 'name',
            autocomplete: 'name',
            required: true,
          }"
          :readonly="nameReadOnly"
        />
      </NFormItem>
      <NFormItem
        label="邮箱"
        :label-props="{ for: 'email' }"
        :required="emailMetadata?.required"
      >
        <template #label>
          邮箱
          <NTag
            v-if="profile.email && form.email === profile.email"
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
            required: emailMetadata?.required,
            type: 'email',
          }"
          :readonly="emailMetadata?.readOnly"
        />
      </NFormItem>
      <NButton attr-type="submit" :loading="pending" type="primary">
        保存资料
      </NButton>
    </NForm>
  </NCard>
</template>

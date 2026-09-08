<script setup lang="ts">
import type { ProfileInput } from "#shared/types";

definePageMeta({ middleware: "auth" });

const [{ data: account, error: loadError, refresh }, { data: session }] =
  await Promise.all([useFetch("/api/account"), usePortalSession()]);
const { submit, pending } = useMutation();
const message = useMessage();
const profile = computed(() => account.value?.profile);
const form = reactive<ProfileInput>({ name: "" });

watch(
  profile,
  (value) => {
    if (value) {
      form.name = [value.lastName, value.firstName].join("");
      form.email = value.email;
    }
  },
  { immediate: true },
);

const nameReadOnly = computed(() =>
  profile.value?.userProfileMetadata?.attributes.some(
    (field) =>
      (field.name === "firstName" || field.name === "lastName") &&
      field.readOnly,
  ),
);
const emailMetadata = computed(() =>
  profile.value?.userProfileMetadata?.attributes.find(
    (field) => field.name === "email",
  ),
);

const save = () =>
  submit(async () => {
    const profile = await $fetch("/api/account/profile", {
      method: "PUT",
      body: form,
    });
    account.value = { ...account.value!, profile };
    message.success("个人资料已保存");
    await refreshNuxtData("portal-session");
  });

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="account" title="我的账户">
    <NGrid
      v-if="account"
      cols="1 m:3"
      item-responsive
      responsive="screen"
      :x-gap="20"
      :y-gap="20"
    >
      <NGi span="1 m:2">
        <NCard title="个人资料">
          <NForm @submit.prevent="save">
            <NFormItem label="用户名">
              <NText>{{ account.profile.username }}</NText>
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
                  v-if="
                    account.profile.email &&
                    form.email === account.profile.email
                  "
                  :bordered="false"
                  size="small"
                  :type="account.profile.emailVerified ? 'success' : 'warning'"
                >
                  {{ account.profile.emailVerified ? "已验证" : "未验证" }}
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
      </NGi>
      <NGi>
        <NCard title="权限信息">
          <NDescriptions :column="1" label-placement="left">
            <NDescriptionsItem label="身份">
              <NFlex align="center" :size="8">
                <NTag
                  :bordered="false"
                  size="small"
                  :type="account.activeMember ? 'success' : 'warning'"
                >
                  {{ account.activeMember ? "网协现任" : "非网协现任" }}
                </NTag>
                <NTag
                  v-for="group in account.memberships"
                  :key="group.id"
                  :bordered="false"
                  size="small"
                  type="info"
                >
                  <NuxtLink
                    v-if="
                      account.groups.some(
                        (managed) => managed.groupId === group.id,
                      )
                    "
                    :to="`/groups/${encodeURIComponent(group.id)}`"
                  >
                    {{ group.label }}
                  </NuxtLink>
                  <template v-else>{{ group.label }}</template>
                </NTag>
              </NFlex>
            </NDescriptionsItem>
            <NDescriptionsItem label="管理权限">
              <NTag
                v-if="session?.administrator || account.groups.length > 0"
                :bordered="false"
                size="small"
                type="info"
              >
                <NuxtLink
                  :to="
                    session?.administrator ? '/admin/administrators' : '/groups'
                  "
                >
                  {{ session?.administrator ? "系统管理员" : "群组管理员" }}
                </NuxtLink>
              </NTag>
              <NText v-else depth="3" italic>无管理权限</NText>
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
    </NGrid>
  </NuxtLayout>
</template>

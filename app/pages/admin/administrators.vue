<script setup lang="ts">
definePageMeta({ middleware: ["auth", "admin"] });

const [
  { data: administrators, error: loadError, refresh, status: loadStatus },
  { data: session },
] = await Promise.all([
  useFetch("/api/admin/administrators"),
  usePortalSession(),
]);

const { submit, pending } = useMutation();
const message = useMessage();
const identifier = ref("");

const grant = () =>
  submit(async () => {
    const result = await $fetch("/api/admin/administrators", {
      method: "POST",
      body: { identifier: identifier.value },
    });
    message.success(`已授权 ${result.username}`);
    identifier.value = "";
    await refresh();
  });

const revoke = (subject: string) =>
  submit(async () => {
    await $fetch("/api/admin/administrators", {
      method: "DELETE",
      body: { subject },
    });
    if (session.value?.user.subject === subject) {
      await refreshNuxtData("portal-session");
      await navigateTo("/account");
    } else {
      await refresh();
    }
  });

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="admin" title="系统管理员">
    <NCard title="授予系统管理权限">
      <NForm class="grant-form" @submit.prevent="grant">
        <NFormItem
          label="用户名或邮箱"
          :label-props="{ for: 'administrator' }"
          required
        >
          <NInputGroup>
            <UserAutocomplete
              v-model:value="identifier"
              :input-props="{
                id: 'administrator',
                autocomplete: 'off',
                required: true,
              }"
            />
            <NButton attr-type="submit" :loading="pending" type="primary">
              授权
            </NButton>
          </NInputGroup>
        </NFormItem>
      </NForm>
    </NCard>
    <NCard v-if="administrators" title="当前管理员">
      <UserTable :loading="loadStatus === 'pending'" :users="administrators">
        <template #actions="{ user }">
          <ConfirmAction
            :disabled="pending"
            :message="
              session?.user.subject === user.id
                ? '确认撤销你自己的系统管理权限？'
                : '确认撤销此人的系统管理权限？'
            "
            @confirm="revoke(user.id)"
          >
            撤销授权
          </ConfirmAction>
        </template>
      </UserTable>
    </NCard>
  </NuxtLayout>
</template>

<style scoped>
.grant-form {
  max-width: 560px;
}
</style>

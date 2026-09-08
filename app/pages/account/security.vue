<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const {
  data: security,
  error: loadError,
  refresh,
} = await useFetch("/api/account/security");
const { submit, pending } = useMutation();
const message = useMessage();
const form = reactive({
  currentPassword: "",
  newPassword: "",
  confirmation: "",
});
const confirmationError = computed(() =>
  form.confirmation && form.newPassword !== form.confirmation
    ? "两次输入的新密码不一致"
    : undefined,
);
const password = computed(() =>
  security.value?.credentials.find((type) => type.type === "password"),
);
const authenticators = computed(
  () =>
    security.value?.credentials.filter(
      (type) =>
        type.type !== "password" &&
        // Keycloak 9 会返回未配置且创建动作已禁用的认证项，过滤它们以免显示空卡片
        (type.credentials.length > 0 || type.createAction),
    ) ?? [],
);

const labels: Record<string, string> = {
  "otp": "身份验证器",
  "webauthn": "安全密钥",
  "webauthn-passwordless": "通行密钥",
  "recovery-authn-codes": "恢复码",
};

const createdAt = (value: number | null | undefined) =>
  value && value > 0
    ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    : "未知";

async function changePassword() {
  if (confirmationError.value) {
    return;
  }

  const result = await submit(() =>
    $fetch("/api/account/password", { method: "POST", body: form }),
  );
  form.currentPassword = "";
  form.newPassword = "";
  form.confirmation = "";

  if (result) {
    message.success("密码已修改");
    await refresh();
  }
}

async function startAction(action: string) {
  const result = await submit(() =>
    $fetch("/api/account/actions", { method: "POST", body: { action } }),
  );
  if (result) {
    await navigateTo(result.url, { external: true });
  }
}

async function removeCredential(id: string) {
  const result = await submit(() =>
    $fetch(`/api/account/credentials/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  );
  if (result?.url) {
    await navigateTo(result.url, { external: true });
  } else if (result) {
    message.success("凭据已移除");
    await refresh();
  }
}

useFetchError(loadError, refresh);
</script>

<template>
  <NuxtLayout name="account" title="账户安全">
    <template v-if="security">
      <NCard
        v-if="
          password &&
          ((security.passwordForm && password.credentials.length > 0) ||
            password.updateAction ||
            password.createAction)
        "
        title="密码"
      >
        <NForm
          v-if="security.passwordForm && password.credentials.length > 0"
          class="password-form"
          @submit.prevent="changePassword"
        >
          <NFormItem
            label="当前密码"
            :label-props="{ for: 'current-password' }"
            required
          >
            <NInput
              v-model:value="form.currentPassword"
              :input-props="{
                id: 'current-password',
                autocomplete: 'current-password',
                required: true,
              }"
              show-password-on="click"
              type="password"
            />
          </NFormItem>
          <NFormItem
            label="新密码"
            :label-props="{ for: 'new-password' }"
            required
          >
            <NInput
              v-model:value="form.newPassword"
              :input-props="{
                id: 'new-password',
                autocomplete: 'new-password',
                required: true,
              }"
              show-password-on="click"
              type="password"
            />
          </NFormItem>
          <NFormItem
            :feedback="confirmationError"
            label="再次输入新密码"
            :label-props="{ for: 'confirm-password' }"
            required
            :validation-status="confirmationError ? 'error' : undefined"
          >
            <NInput
              v-model:value="form.confirmation"
              :input-props="{
                id: 'confirm-password',
                autocomplete: 'new-password',
                required: true,
              }"
              show-password-on="click"
              type="password"
            />
          </NFormItem>
          <NButton attr-type="submit" :loading="pending" type="primary">
            修改密码
          </NButton>
        </NForm>
        <NButton
          v-else
          :loading="pending"
          type="primary"
          @click="
            startAction((password.updateAction || password.createAction)!)
          "
        >
          {{ password.credentials.length > 0 ? "修改密码" : "设置密码" }}
        </NButton>
      </NCard>
      <NCard
        v-for="type in authenticators"
        :key="type.type"
        :title="labels[type.type] || type.type"
      >
        <template #header-extra>
          <NButton
            v-if="type.createAction"
            :disabled="pending"
            size="small"
            @click="startAction(type.createAction)"
          >
            添加
          </NButton>
        </template>
        <NList v-if="type.credentials.length > 0">
          <NListItem
            v-for="credential in type.credentials"
            :key="credential.id"
          >
            <NThing
              :description="`添加时间：${createdAt(credential.createdDate)}`"
              :title="credential.userLabel || labels[type.type] || type.type"
            />
            <template #suffix>
              <NFlex :size="8">
                <NButton
                  v-if="type.updateAction"
                  :disabled="pending"
                  size="small"
                  @click="startAction(type.updateAction)"
                >
                  更新
                </NButton>
                <ConfirmAction
                  v-if="type.removeable"
                  :disabled="pending"
                  message="确认移除此凭据？"
                  @confirm="removeCredential(credential.id)"
                >
                  移除
                </ConfirmAction>
              </NFlex>
            </template>
          </NListItem>
        </NList>
        <NEmpty v-else description="尚未设置" />
      </NCard>
    </template>
  </NuxtLayout>
</template>

<style scoped>
.password-form {
  max-width: 440px;
}
</style>
